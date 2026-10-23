// Cropped monster atlas + sheet plans (A4.1 scaling pre-step, docs/v3/A3_MIMARI.md §11.2).
// Pure helpers — no Phaser, no DOM at import time (vitest runs them in node; tests/art/atlas*.test.ts).
//
// CROPPED ATLAS. A v3 monster sheet stores every frame trimmed to its opaque box plus a 1-px
// transparent margin (clamped to the frame), packed in shelves, one canvas per animation group
// (the five base anims together, then each extra anim: src/art/textures.ts). Phaser draws a
// trimmed frame at its offset inside the full frame (Frame.setTrim keeps realWidth / realHeight =
// the art's w × h), so a sprite's size, origin, anchor, points and flips do not change, and every
// pixel outside the stored box is transparent by construction: the drawn result is the same
// pixels as the full cell. (Pixel-identical for whole-pixel positions and integer scales — the v3
// sprites are never scaled or rotated, REHBER HA-11; the old sheets keep their full cells.)
//
// FRAME READERS. Effects that take a frame's pixels from its texture source (contact flash, pose
// match, hologram box, spriteBox, cut-in eyes) read them through frameRGBA(): the frame's FULL
// pixels (realWidth × realHeight, the trim offset applied). For an untrimmed frame that is exactly
// the cut rect, as before.
//
// SHEET PLANS. Which monster sheets a page paints ahead (the rest is painted synchronously on
// first use — deterministic under the frozen test clock):
//   stagePlan(stage)   a staged scenario (?dev=duel&s=…): the monsters the scenario stages AND the
//                      ones in its decks (A3_MIMARI §11.2) — the stage is built with the scenario's
//                      own buildStage(), so its defaults (5 Taş Muhafız per deck) count too
//   deckPlan(decks)    a real game: every monster of both decks
// `p2` lists the monsters player 2 can control — its own, plus every monster of the plan when it
// holds Ruh Çağrısı (soul_recall revives from EITHER graveyard) — the only ones whose P2 'relight'
// sheet is painted ahead.

import { CARDS, isMonster, type CardId, type MonsterId } from '../data/cards';
import { buildStage, type StageSpec } from '../duel/scenario';
import type { PlayerId, Uid } from '../engine/types';

// ---------------------------------------------------------------- geometry

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  w: number;
  h: number;
}

/** Transparent pixels kept around a frame's opaque box (inside the frame). */
export const TRIM_MARGIN = 1;
/** Transparent pixels between two stored frames in an atlas canvas (no neighbour bleeding). */
export const PACK_GUTTER = 1;
/** Widest atlas canvas (the old sheets' limit too). */
export const MAX_ATLAS_W = 4096;

/** Bounding box of the pixels with alpha > 0 of a w × h RGBA buffer, or null when empty. */
export function opaqueBox(data: ArrayLike<number>, w: number, h: number): Rect | null {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++)
      if (data[row + x * 4 + 3] > 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** The stored part of a frame: its opaque box grown by `margin`, clamped to the frame; 1 × 1 at (0, 0) when empty. */
export function trimRect(data: ArrayLike<number>, w: number, h: number, margin = TRIM_MARGIN): Rect {
  const b = opaqueBox(data, w, h);
  if (!b) return { x: 0, y: 0, w: 1, h: 1 };
  const x0 = Math.max(0, b.x - margin);
  const y0 = Math.max(0, b.y - margin);
  const x1 = Math.min(w, b.x + b.w + margin);
  const y1 = Math.min(h, b.y + b.h + margin);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * True when a canvas round trip (putImageData → getImageData) gives exactly these bytes back:
 * every alpha is 0 or 255 and every alpha-0 pixel is all zero (canvases store premultiplied
 * colour, so partial alpha and colour under alpha 0 do not survive). Such a frame can be read
 * back from its atlas canvas instead of being drawn again.
 */
export function canvasExact(data: ArrayLike<number>): boolean {
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 255) continue;
    if (a !== 0 || data[i] || data[i + 1] || data[i + 2]) return false;
  }
  return true;
}

export interface Packing {
  /** Atlas size (≥ 1 × 1). */
  w: number;
  h: number;
  /** Top-left of each rect, in input order. */
  pos: { x: number; y: number }[];
}

/** Shelf packing of `sizes` into width W (tallest first, stable order). */
function shelfPack(sizes: readonly Size[], order: readonly number[], W: number, gutter: number): Packing {
  const pos: { x: number; y: number }[] = sizes.map(() => ({ x: 0, y: 0 }));
  // the first shelf starts one pixel in: texel (0, 0) of every atlas stays transparent (Phaser's
  // setCrop of a trimmed frame whose crop misses the stored box draws a quad of UV (0, 0))
  let x = 1;
  let y = 0;
  let shelf = 0;
  let used = 0;
  let onShelf = 0;
  for (const i of order) {
    const s = sizes[i];
    if (onShelf > 0 && x + s.w > W) {
      y += shelf + gutter;
      x = 0;
      shelf = 0;
      onShelf = 0;
    }
    pos[i] = { x, y };
    onShelf++;
    x += s.w + gutter;
    used = Math.max(used, x - gutter);
    shelf = Math.max(shelf, s.h);
  }
  return { w: Math.max(1, used), h: Math.max(1, y + shelf), pos };
}

/**
 * Pack rects into one atlas: shelves, tallest first (ties: wider first, then input order), the
 * width chosen among a few candidates for the smallest area (width and height ≤ maxW when possible).
 * Deterministic; rects never overlap and keep `gutter` pixels between them; texel (0, 0) stays free.
 */
export function packRects(sizes: readonly Size[], o: { maxW?: number; gutter?: number } = {}): Packing {
  const maxW = o.maxW ?? MAX_ATLAS_W;
  const gutter = o.gutter ?? PACK_GUTTER;
  if (!sizes.length) return { w: 1, h: 1, pos: [] };
  const order = sizes.map((_, i) => i).sort((a, b) => sizes[b].h - sizes[a].h || sizes[b].w - sizes[a].w || a - b);
  const widest = Math.max(...sizes.map((s) => s.w));
  if (widest + 1 > maxW) throw new Error(`atlas: a ${widest} px wide frame does not fit ${maxW}`);
  const area = sizes.reduce((s, r) => s + (r.w + gutter) * (r.h + gutter), 0);
  const side = Math.sqrt(area);
  const cands = new Set<number>([widest, maxW]);
  for (const f of [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6, 1.8, 2, 2.5, 3, 4, 6]) cands.add(Math.min(maxW, Math.max(widest, Math.ceil(side * f))));
  // the smallest area among the packs within maxW on BOTH axes (a single column of tall frames could
  // pass the GPU's texture size); when none is, the flattest
  let best: Packing | null = null;
  for (const W of [...cands].sort((a, b) => a - b)) {
    const p = shelfPack(sizes, order, W, gutter);
    const fits = p.h <= maxW;
    const bestFits = !!best && best.h <= maxW;
    if (!best || (fits && !bestFits) || (fits === bestFits && (fits ? p.w * p.h < best.w * best.h : p.h < best.h))) best = p;
  }
  return best!;
}

/** Copy rect `r` of `src` (srcW wide) to (dx, dy) of `dst` (dstW wide). */
export function blitRect(dst: Uint8ClampedArray, dstW: number, src: ArrayLike<number>, srcW: number, r: Rect, dx: number, dy: number): void {
  for (let y = 0; y < r.h; y++) {
    const s = ((r.y + y) * srcW + r.x) * 4;
    const d = ((dy + y) * dstW + dx) * 4;
    for (let i = 0; i < r.w * 4; i++) dst[d + i] = src[s + i];
  }
}

/** The full frame (w × h RGBA) back from its stored region at (sx, sy) of `atlas` (atlasW wide) holding trim rect `r`. */
export function untrimFrame(atlas: ArrayLike<number>, atlasW: number, sx: number, sy: number, r: Rect, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < r.h; y++) {
    const s = ((sy + y) * atlasW + sx) * 4;
    const d = ((r.y + y) * w + r.x) * 4;
    for (let i = 0; i < r.w * 4; i++) out[d + i] = atlas[s + i];
  }
  return out;
}

// ---------------------------------------------------------------- frame readers

/** The parts of a Phaser texture frame frameRGBA() reads (structural: no Phaser import). */
export interface FrameLike {
  cutX: number;
  cutY: number;
  cutWidth: number;
  cutHeight: number;
  /** trim offset of the stored rect inside the full frame (0 when untrimmed) */
  x: number;
  y: number;
  realWidth: number;
  realHeight: number;
  source: { image: unknown } | null;
}

interface Ctx2D {
  getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray };
  clearRect(x: number, y: number, w: number, h: number): void;
  drawImage(img: unknown, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;
}
interface CanvasLike {
  width: number;
  height: number;
  getContext(kind: '2d', o?: { willReadFrequently?: boolean }): Ctx2D | null;
}

let scratch: CanvasLike | null = null;

/** A canvas (HTMLCanvasElement / OffscreenCanvas): read directly; an image goes through a scratch canvas. */
function isCanvasLike(img: unknown): img is CanvasLike {
  return !!img && typeof (img as CanvasLike).getContext === 'function';
}

/** RGBA of the stored (cut) rect of a frame, read from its source image (canvas: getImageData). */
function cutPixels(frame: FrameLike): Uint8ClampedArray | null {
  const cw = frame.cutWidth;
  const ch = frame.cutHeight;
  if (!(cw > 0) || !(ch > 0)) return null;
  const img = frame.source?.image;
  if (!img) return null;
  if (isCanvasLike(img)) {
    const ctx = img.getContext('2d', { willReadFrequently: true });
    if (ctx) return ctx.getImageData(frame.cutX, frame.cutY, cw, ch).data;
  }
  if (typeof document === 'undefined') return null;
  scratch ??= document.createElement('canvas') as unknown as CanvasLike;
  scratch.width = cw;
  scratch.height = ch;
  const c = scratch.getContext('2d', { willReadFrequently: true });
  if (!c) return null;
  c.clearRect(0, 0, cw, ch);
  c.drawImage(img, frame.cutX, frame.cutY, cw, ch, 0, 0, cw, ch);
  return c.getImageData(0, 0, cw, ch).data;
}

/**
 * The FULL pixels of a texture frame — realWidth × realHeight RGBA, frame space (as drawn: facing
 * right) — read from its own texture source. A trimmed frame (cropped atlas) is rebuilt around its
 * stored rect (transparent outside it); an untrimmed frame is exactly its cut rect, as every reader
 * read it before. null when it cannot be read (no source / no 2D context).
 */
export function frameRGBA(frame: FrameLike | null | undefined): Uint8ClampedArray | null {
  if (!frame) return null;
  try {
    const w = frame.realWidth;
    const h = frame.realHeight;
    if (!(w > 0) || !(h > 0)) return null;
    const cut = cutPixels(frame);
    if (!cut) return null;
    const cw = frame.cutWidth;
    const ch = frame.cutHeight;
    const ox = frame.x || 0;
    const oy = frame.y || 0;
    if (ox === 0 && oy === 0 && cw === w && ch === h) return cut;
    const out = new Uint8ClampedArray(w * h * 4);
    const x0 = Math.max(0, ox);
    const x1 = Math.min(w, ox + cw);
    for (let y = 0; y < ch; y++) {
      const fy = oy + y;
      if (fy < 0 || fy >= h || x1 <= x0) continue;
      const s = (y * cw + (x0 - ox)) * 4;
      out.set(cut.subarray(s, s + (x1 - x0) * 4), (fy * w + x0) * 4);
    }
    return out;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- sheet plans

export interface SheetPlan {
  /** Monsters whose default sheet `mon:<id>` is painted ahead (both players' P1 / mirror sheet). */
  p1: MonsterId[];
  /** Monsters player 2 can control: their P2 'relight' sheet is painted ahead (when the art relights). */
  p2: MonsterId[];
}

const monsterOf = (id: CardId | null | undefined): MonsterId | null => {
  const def = id ? CARDS[id] : undefined;
  return def && isMonster(def) ? (def.id as MonsterId) : null;
};

const pushUnique = (out: MonsterId[], id: MonsterId | null): void => {
  if (id && !out.includes(id)) out.push(id);
};

/**
 * The sheets a staged scenario needs (see the header): every monster card of the built stage —
 * monster zones first, then hands, graveyards and decks (P1's side before P2's in each) — and,
 * for P2, the monsters it owns, or all of them when it holds Ruh Çağrısı (deck, hand or set).
 */
export function stagePlan(stage: StageSpec | null | undefined): SheetPlan {
  const s = buildStage(stage ?? {});
  const card = (uid: Uid | null | undefined): CardId | null => (uid ? s.cards[uid].cardId : null);
  const places = (p: PlayerId): Uid[][] => {
    const ps = s.players[p];
    return [ps.monsters.flatMap((m) => (m ? [m.uid] : [])), ps.hand, ps.graveyard, ps.deck];
  };
  const p1: MonsterId[] = [];
  const p2: MonsterId[] = [];
  const [a, b] = [places(0), places(1)];
  for (let k = 0; k < a.length; k++) {
    for (const uid of a[k]) pushUnique(p1, monsterOf(card(uid)));
    for (const uid of b[k]) {
      pushUnique(p1, monsterOf(card(uid)));
      pushUnique(p2, monsterOf(card(uid)));
    }
  }
  const ps2 = s.players[1];
  const st2 = ps2.spellTraps.flatMap((t) => (t ? [t.uid] : []));
  if ([...ps2.deck, ...ps2.hand, ...st2].some((uid) => card(uid) === 'soul_recall')) for (const id of p1) pushUnique(p2, id);
  return { p1, p2 };
}

/** The sheets a real game with these decks needs (see the header). */
export function deckPlan(decks: readonly [readonly CardId[], readonly CardId[]]): SheetPlan {
  const d0: MonsterId[] = [];
  const d1: MonsterId[] = [];
  for (const id of decks[0]) pushUnique(d0, monsterOf(id));
  for (const id of decks[1]) pushUnique(d1, monsterOf(id));
  const p1: MonsterId[] = [];
  for (const id of [...d0, ...d1]) pushUnique(p1, id);
  const p2: MonsterId[] = [...d1];
  if (decks[1].includes('soul_recall')) for (const id of p1) pushUnique(p2, id);
  return { p1, p2 };
}
