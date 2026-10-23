// Turns code-drawn PixelCanvas art into Phaser textures + animations.
//
// Conventions:
//   texture `mon:<id>`          — monster sheet, frame names `<anim>:<i>`
//   animation `mon:<id>:<anim>` — Phaser animation (repeat -1 when loop)
//
// v3 (A1): a sheet holds every animation of `animList(art)` — the five base anims in
// MONSTER_ANIMS order (so the old monsters' sheets are unchanged), then the optional extras
// (`extraAnims` / `drawExtra`). Frames with an AnimSpec hold get it as the Phaser frame
// `duration` (Phaser plays `frame.duration || msPerFrame`); frames without one keep the
// frameRate timing, exactly as before. Read timings through src/art/animtime.ts, and never pass
// `frameRate` / `duration` to play() for such an anim: Phaser then ignores the frame durations.
// A sheet can also be built under another key with DrawOpts (`SheetOpts`), e.g. a P2 'relight'
// variant drawn with { lightFrom: 'right' }.
//
// A4.1 scaling pre-step (docs/v3/A3_MIMARI.md §11.2):
//   - CROPPED ATLAS for the v3 arts (src/art/atlas.ts): every frame is stored trimmed to its opaque
//     box (+1 px), packed one canvas per animation group — the five base anims together, then each
//     extra anim — added to the sheet's texture as extra sources; the frames keep the art's full
//     size (Phaser trim), so what is drawn is pixel-identical. The old (v1) arts keep their full-cell
//     grid sheets exactly as before (one canvas, ≤ 4096 px wide).
//   - STAGED PAINTING: buildAllMonsters(scene, plan) paints ahead only the sheets of a SheetPlan (a
//     staged scenario's monsters and the ones in its decks, or the decks' monsters in a real game;
//     the P2 'relight' sheets only for monsters player 2 can control); every other sheet is
//     registered (frames + anims exist) and painted on first use, synchronously (?test:
//     deterministic under the frozen clock).
//   - FRAME CACHE LIMIT: the v3 arts' frames requested through monsterFrame() live in an LRU of
//     FRAME_CACHE_BUDGET bytes (a miss reads the frame back from its atlas canvas, or draws it);
//     only the frames the boot warming and the card art need are kept for good (idle 0, the
//     shattered hit frame, the last death frame). The old arts' frame cache is unchanged.
//   - Statistics for tools/texmem.mjs: sheetPaintStats(), frameCacheStats().

import Phaser from 'phaser';
import type { MonsterId } from '../data/cards';
import { MONSTER_IDS } from '../data/cards';
import { animList, animSpec, hasAnim, holdOf, isExtraAnim } from './animtime';
import { canvasExact, frameRGBA, packRects, trimRect, type Rect, type SheetPlan } from './atlas';
import { monsterArt, monsterArtV3 } from './monsters';
import { PixelCanvas } from './pixel';
import type { AnyMonsterAnim, DrawOpts, MonsterArt } from './types';
import { MONSTER_ANIMS } from './types';

export { animList, animSpec, hasAnim } from './animtime';
export type { SheetPlan } from './atlas';

/**
 * Register a finished canvas as a STATIC texture (frames can be added as usual). Unlike
 * textures.addCanvas(), this does not wrap it in a CanvasTexture — that reads the whole canvas
 * back with getImageData() and keeps that ImageData copy alive next to the canvas for good
 * (~35 MB of boot art held twice in the soak test). Use addCanvas() only for canvases that are
 * redrawn later (they need CanvasTexture.refresh()).
 */
export function addStaticCanvas(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): Phaser.Textures.Texture {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  return scene.textures.addImage(key, canvas as unknown as HTMLImageElement)!;
}

/** Add (or replace) a texture from a PixelCanvas. Returns the key. */
export function canvasTexture(scene: Phaser.Scene, key: string, pc: PixelCanvas): string {
  addStaticCanvas(scene, key, pc.toCanvas());
  return key;
}

/** Create a texture once by drawing into a fresh PixelCanvas. */
export function ensureTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (p: PixelCanvas) => void): string {
  if (scene.textures.exists(key)) return key;
  const p = new PixelCanvas(w, h);
  draw(p);
  addStaticCanvas(scene, key, p.toCanvas());
  return key;
}

/**
 * Build a texture holding several named frames laid out in a grid.
 * `frames` maps frame name → PixelCanvas (all must share size w×h).
 */
export function sheetTexture(scene: Phaser.Scene, key: string, w: number, h: number, frames: [string, PixelCanvas][]): string {
  const cols = Math.max(1, Math.min(frames.length, Math.floor(4096 / w)));
  const rows = Math.ceil(frames.length / cols);
  const sheet = new PixelCanvas(cols * w, rows * h);
  frames.forEach(([, pc], i) => sheet.blit(pc, (i % cols) * w, Math.floor(i / cols) * h));
  const tex = addStaticCanvas(scene, key, sheet.toCanvas());
  frames.forEach(([name], i) => tex.add(name, 0, (i % cols) * w, Math.floor(i / cols) * h, w, h));
  return key;
}

// ---------------------------------------------------------------- cropped arts

/**
 * Is this art stored as a cropped atlas? The v3 arts (the objects of the v3 registry: the art
 * ?look=v3 draws, fixtures registered as v3 art included); every other art keeps its grid sheet.
 */
export function cropsArt(art: MonsterArt): boolean {
  return monsterArtV3(art.id) === art;
}

// ---------------------------------------------------------------- monster frames

/** Frames of the registry arts (monsterArt(id)), keyed by id — shared by sheets, shatter, card art. */
const frameCache = new Map<string, PixelCanvas>();
/** Frames of other art objects (dev / test arts passed to buildMonster), per object. */
const otherCaches = new WeakMap<MonsterArt, Map<string, PixelCanvas>>();

/** Byte budget of the cropped arts' recently used frames (pinned frames do not count). */
export const FRAME_CACHE_BUDGET = 8 * 1048576;
/** Cropped arts: frames kept for good (pinnedFrameKeys). */
const pinnedFrames = new Map<string, PixelCanvas>();
/** Cropped arts: everything else, least recently used first. */
const lruFrames = new Map<string, PixelCanvas>();
let lruBytes = 0;
const cacheCounts = { hits: 0, misses: 0, readbacks: 0, draws: 0, evictions: 0 };

function cacheOf(art: MonsterArt): Map<string, PixelCanvas> {
  if (monsterArt(art.id) === art) return frameCache;
  let m = otherCaches.get(art);
  if (!m) otherCaches.set(art, (m = new Map()));
  return m;
}

/**
 * Draw one frame of any animation the art has into `p` (already cleared, w×h): base anims via
 * `draw`, extras via `drawExtra`. The frame is clamped to the last one; an animation the art
 * does not have draws idle frame 0. `o` is passed on only when given (old arts see 3 args).
 */
export function drawMonsterFrame(p: PixelCanvas, art: MonsterArt, anim: AnyMonsterAnim, frame: number, o?: DrawOpts): void {
  const spec = animSpec(art, anim);
  if (!spec) {
    if (o) art.draw(p, 'idle', 0, o);
    else art.draw(p, 'idle', 0);
    return;
  }
  const f = Math.min(frame, spec.frames - 1);
  if (isExtraAnim(anim)) art.drawExtra!(p, anim, f, o);
  else if (o) art.draw(p, anim, f, o);
  else art.draw(p, anim, f);
}

function frameKey(art: MonsterArt, anim: AnyMonsterAnim, frame: number, o?: DrawOpts): string {
  return `${art.id}|${anim}|${frame}${o?.lightFrom === 'right' ? '|r' : ''}`;
}

/**
 * The frames of a cropped art that are kept for good: what the first-use warming (src/duel/warm.ts:
 * the unit shadow and card art's idle 0, the shatter of the default death's hit frame, the v3 death
 * pose's last frame — P1 and relit) and the card / light code read again and again.
 */
function pinnedFrameKeys(art: MonsterArt): Set<string> {
  const keys = new Set<string>([frameKey(art, 'idle', 0), frameKey(art, 'hit', Math.min(1, art.anims.hit.frames - 1))]);
  const dn = art.extraAnims?.death?.frames ?? 0;
  if (dn > 0 && art.drawExtra) {
    keys.add(frameKey(art, 'death', dn - 1));
    keys.add(frameKey(art, 'death', dn - 1, { lightFrom: 'right' }));
  }
  return keys;
}

const pinsOf = new WeakMap<MonsterArt, Set<string>>();
function isPinned(art: MonsterArt, k: string): boolean {
  let s = pinsOf.get(art);
  if (!s) pinsOf.set(art, (s = pinnedFrameKeys(art)));
  return s.has(k);
}

/** A cropped art's frame read back from its committed atlas canvas (exact frames only), or null. */
function readBack(art: MonsterArt, anim: AnyMonsterAnim, frame: number, o?: DrawOpts): PixelCanvas | null {
  const key = o?.lightFrom === 'right' ? monsterP2TextureKey(art.id) : monsterTextureKey(art.id);
  const st = croppedSheets.get(key);
  if (!st || st.art !== art || !st.tex.frames) return null;
  const spec = animSpec(art, anim);
  if (!spec) return null;
  const name = monsterFrameName(anim, Math.min(frame, spec.frames - 1));
  const i = st.index.get(name);
  if (i === undefined || !st.exact[i]) return null;
  const fr = (st.tex.frames as Record<string, Phaser.Textures.Frame | undefined>)[name];
  const data = fr ? frameRGBA(fr) : null;
  if (!data || data.length !== art.w * art.h * 4) return null;
  const pc = new PixelCanvas(art.w, art.h);
  pc.data.set(data);
  return pc;
}

/** Cropped arts: the frame from the pinned set / the LRU, else read back or drawn (and cached). */
function croppedFrame(art: MonsterArt, anim: AnyMonsterAnim, frame: number, o: DrawOpts | undefined, k: string): PixelCanvas {
  const pin = pinnedFrames.get(k);
  if (pin) {
    cacheCounts.hits++;
    return pin;
  }
  const hit = lruFrames.get(k);
  if (hit) {
    cacheCounts.hits++;
    lruFrames.delete(k);
    lruFrames.set(k, hit);
    return hit;
  }
  cacheCounts.misses++;
  let pc = readBack(art, anim, frame, o);
  if (pc) cacheCounts.readbacks++;
  else {
    pc = new PixelCanvas(art.w, art.h);
    drawMonsterFrame(pc, art, anim, frame, o);
    cacheCounts.draws++;
  }
  if (isPinned(art, k)) pinnedFrames.set(k, pc);
  else {
    lruFrames.set(k, pc);
    lruBytes += pc.data.length;
    for (const [ek, ev] of lruFrames) {
      if (lruBytes <= FRAME_CACHE_BUDGET || ek === k) break;
      lruFrames.delete(ek);
      lruBytes -= ev.data.length;
      cacheCounts.evictions++;
    }
  }
  return pc;
}

/** Rendered pixels of one frame of `art` (cached). */
export function artFrame(art: MonsterArt, anim: AnyMonsterAnim, frame: number, o?: DrawOpts): PixelCanvas {
  const cache = cacheOf(art);
  const k = frameKey(art, anim, frame, o);
  if (cache === frameCache && cropsArt(art)) return croppedFrame(art, anim, frame, o, k);
  let pc = cache.get(k);
  if (!pc) {
    pc = new PixelCanvas(art.w, art.h);
    drawMonsterFrame(pc, art, anim, frame, o);
    cache.set(k, pc);
  }
  return pc;
}

/** Rendered pixels of a monster frame (cached). Used by shatter VFX and card art. */
export function monsterFrame(id: MonsterId, anim: AnyMonsterAnim, frame: number, o?: DrawOpts): PixelCanvas {
  return artFrame(monsterArt(id), anim, frame, o);
}

/** What the frame caches hold (tools/texmem.mjs). Bytes are the PixelCanvas RGBA buffers. */
export function frameCacheStats(): { grid: { frames: number; bytes: number }; pinned: { frames: number; bytes: number }; lru: { frames: number; bytes: number; budget: number }; counts: typeof cacheCounts } {
  let gb = 0;
  for (const pc of frameCache.values()) gb += pc.data.length;
  let pb = 0;
  for (const pc of pinnedFrames.values()) pb += pc.data.length;
  return {
    grid: { frames: frameCache.size, bytes: gb },
    pinned: { frames: pinnedFrames.size, bytes: pb },
    lru: { frames: lruFrames.size, bytes: lruBytes, budget: FRAME_CACHE_BUDGET },
    counts: { ...cacheCounts },
  };
}

/** Does this monster draw the animation (base anims always; extras when its art defines them)? */
export function hasMonsterAnim(id: MonsterId, anim: AnyMonsterAnim): boolean {
  return hasAnim(monsterArt(id), anim);
}

export function monsterTextureKey(id: MonsterId): string {
  return `mon:${id}`;
}

// ---------------------------------------------------------------- P2 lighting (v3, A1 item 10)
//
// Monsters are drawn facing right with the key light from the frame's top-left; player 2 shows
// the same sheet mirrored (flipX), so by default ('mirror') its light comes from the screen's
// top-RIGHT. An art with `p2: 'relight'` also gets a second sheet `mon:<id>:p2`, drawn with
// DrawOpts { lightFrom: 'right' } (same layout, frame names and anims `mon:<id>:p2:<anim>`):
// mirrored, it is lit from the screen top-left again. MonsterUnit picks the sheet from its
// controller (monsterSheetKey; applyFacing / setController) and keeps the sprite on it whatever
// anim key is played, so the anim keys and their events stay `mon:<id>:<anim>`.
// monsterTextureKey(id) stays the P1 / default sheet (cut-ins, card art, gallery...).

/** Key of a monster's optional P2 'relight' sheet (exists only when one was built). */
export function monsterP2TextureKey(id: MonsterId): string {
  return `mon:${id}:p2`;
}

/** Does this art ask for a P2 'relight' sheet? (Default 'mirror': P2 flips the P1 sheet.) */
export function relightsP2(art: MonsterArt): boolean {
  return art.p2 === 'relight';
}

/**
 * The sheet a monster controlled by `player` shows: player 2 gets `mon:<id>:p2` when such a sheet
 * was built or prepared here (art.p2 === 'relight' at boot, or a dev / test sheet built with
 * SheetOpts.key = monsterP2TextureKey(id)); everything else the default `mon:<id>`.
 */
export function monsterSheetKey(id: MonsterId, player: 0 | 1): string {
  if (player === 1) {
    const k = monsterP2TextureKey(id);
    // a lazy P2 sheet is registered the first time a player-2 unit (or a cinematic warming its
    // poses) asks for it (A2 tech review r3 #8)
    if (!knownSheets.has(k)) prepareLazyP2(k);
    if (knownSheets.has(k)) return k;
  }
  return monsterTextureKey(id);
}

export function monsterAnimKey(id: MonsterId, anim: AnyMonsterAnim): string {
  return sheetAnimKey(monsterTextureKey(id), anim);
}

/** Animation key of `anim` on a monster sheet registered under texture `key`. */
export function sheetAnimKey(key: string, anim: AnyMonsterAnim): string {
  return `${key}:${anim}`;
}

export function monsterFrameName(anim: AnyMonsterAnim, frame: number): string {
  return `${anim}:${frame}`;
}

// ---------------------------------------------------------------- sheet layout + anims

/** Where and how a monster sheet is built (defaults: `mon:<id>`, the art's default lighting). */
export interface SheetOpts {
  /** Texture key; its animations are `<key>:<anim>`. Default monsterTextureKey(art.id). */
  key?: string;
  /** Passed to every draw call (e.g. { lightFrom: 'right' } for a P2 relight sheet). */
  draw?: DrawOpts;
}

interface Cell {
  anim: AnyMonsterAnim;
  f: number;
  /** cell position on a grid sheet (cropped sheets place frames when a group is committed) */
  x: number;
  y: number;
}

/** Grid of a sheet: every frame of animList(art) in order, ≤ 4096 px wide (as sheetTexture). */
function layoutSheet(art: MonsterArt): { cols: number; rows: number; cells: Cell[] } {
  const names: { anim: AnyMonsterAnim; f: number }[] = [];
  for (const anim of animList(art)) for (let f = 0; f < animSpec(art, anim)!.frames; f++) names.push({ anim, f });
  const cols = Math.max(1, Math.min(names.length, Math.floor(4096 / art.w)));
  const rows = Math.ceil(names.length / cols);
  const cells = names.map((n, i) => ({ ...n, x: (i % cols) * art.w, y: Math.floor(i / cols) * art.h }));
  return { cols, rows, cells };
}

/** (Re)create the Phaser animations of a sheet. Holds become per-frame `duration`s. */
function createSheetAnims(scene: Phaser.Scene, art: MonsterArt, key: string): void {
  for (const anim of animList(art)) {
    const spec = animSpec(art, anim)!;
    const animKey = sheetAnimKey(key, anim);
    if (scene.anims.exists(animKey)) scene.anims.remove(animKey);
    scene.anims.create({
      key: animKey,
      frames: Array.from({ length: spec.frames }, (_, f) => {
        const d = holdOf(spec, f);
        // no `duration` at all without a hold: the old anims are created exactly as before
        return d ? { key, frame: monsterFrameName(anim, f), duration: d } : { key, frame: monsterFrameName(anim, f) };
      }),
      frameRate: spec.fps,
      repeat: spec.loop ? -1 : 0,
    });
  }
}

/** Pixels of one sheet cell. Base frames of the default grid sheet share the frame cache; extras,
 *  DrawOpts variants and every frame of a cropped sheet are drawn fresh (not cached: the sheet
 *  holds them — monsterFrame() caches them on request), except the cropped arts' pinned frames. */
function cellPixels(art: MonsterArt, c: Cell, o: DrawOpts | undefined, crop: boolean): PixelCanvas {
  if (!crop && !o && !isExtraAnim(c.anim)) return artFrame(art, c.anim, c.f);
  if (crop && cacheOf(art) === frameCache && isPinned(art, frameKey(art, c.anim, c.f, o))) return artFrame(art, c.anim, c.f, o);
  const pc = new PixelCanvas(art.w, art.h);
  drawMonsterFrame(pc, art, c.anim, c.f, o);
  return pc;
}

/** Build a monster sheet + its animations synchronously (painted right now). */
export function buildMonster(scene: Phaser.Scene, art: MonsterArt, o: SheetOpts = {}): void {
  const key = o.key ?? monsterTextureKey(art.id);
  if (cropsArt(art)) {
    // the cropped atlas: registered like a deferred sheet, then every group painted + committed now
    prepareMonsterSheet(scene, art, o, false);
    finishMonsterSheet(key);
    return;
  }
  dropPending(key);
  croppedSheets.delete(key);
  const t0 = performance.now();
  const { cells } = layoutSheet(art);
  sheetTexture(
    scene,
    key,
    art.w,
    art.h,
    cells.map((c) => [monsterFrameName(c.anim, c.f), cellPixels(art, c, o.draw, false)]),
  );
  createSheetAnims(scene, art, key);
  knownSheets.add(key);
  const st = statsOf(key, false, cells.length);
  st.painted = cells.length;
  st.cpuMs += performance.now() - t0;
  st.uploads++;
  st.bytes = sheetBytes(scene.textures.get(key));
  st.doneAt = performance.now();
  notePaint(st.doneAt);
}

// ---------------------------------------------------------------- deferred monster sheets
//
// Painting all 12 monster sheets (~430 frames) took ~2.2–2.7 s of the ~3.5 s boot block that
// holds back the first frame (soak test, headless). Instead, boot now registers every sheet at
// once — blank canvas, frame rects and animations, so keys, frames and anims all exist — and the
// frames are painted afterwards in small time slices (setTimeout, ~6 ms each). Anything that
// looks a sheet up through the texture manager (sprite creation, setTexture, textures.get(...)
// for pixel reads) first finishes that sheet's BASE animations synchronously, so no consumer
// ever sees an unpainted frame; usually the background slices are long done by then. With ?test
// (screenshot tooling) the staged sheets are built synchronously at boot, as before, so films
// stay deterministic; the others are painted synchronously on first use.
//
// Per-animation laziness (v3): a sheet tracks which animations are painted and uploaded. The
// base animations (MONSTER_ANIMS) are finished together on first access — one canvas upload,
// exactly the old behaviour (and old monsters have nothing else). The optional extra animations
// are painted later in the background, or on demand the first time one is played
// (anims.get('<key>:<extra>')) or one of its frames is set by name (texture.get('<extra>:<i>')),
// each costing its own frames plus one upload — so a bigger v3 sheet does not make the first
// summon wait for its death / revive / victory poses.
//
// Cropped sheets (A4.1) paint each cell into a PixelCanvas held until its group (the base anims
// together, or one extra anim) is complete; the group is then trimmed, packed into its own canvas,
// added to the texture as a new source (one upload) and its frames are pointed at it. Until then a
// frame is a transparent 1 × 1 cut of the placeholder source 0, with the art's full size.

interface Group {
  anim: AnyMonsterAnim;
  /** cell range [start, end) */
  start: number;
  end: number;
  /** cells of the group not painted yet */
  left: number;
  /** painted AND uploaded */
  ready: boolean;
}

/** Cropped sheets: a commit unit (all base anims, or one extra anim). */
interface Pack {
  anims: AnyMonsterAnim[];
  start: number;
  end: number;
  left: number;
  done: boolean;
}

interface CropState {
  packs: Pack[];
  packOf: Map<AnyMonsterAnim, Pack>;
  /** painted cells waiting for their pack's commit */
  pcs: (PixelCanvas | null)[];
}

interface PendingSheet {
  art: MonsterArt;
  key: string;
  draw: DrawOpts | undefined;
  tex: Phaser.Textures.Texture;
  /** grid sheets: the sheet canvas the cells are painted into */
  ctx: CanvasRenderingContext2D | null;
  cells: Cell[];
  painted: Uint8Array;
  groups: Map<AnyMonsterAnim, Group>;
  /** cells not painted yet */
  left: number;
  /** background cursor */
  next: number;
  /** a cell was painted since the last upload */
  dirty: boolean;
  /** registered by buildAllMonsters (whenMonstersBuilt waits for these) */
  boot: boolean;
  /** in a background paint queue (whenSheetsPainted waits for these) */
  queued: boolean;
  /** extra anims of this sheet (have lazy hooks) */
  extras: AnyMonsterAnim[];
  /** every base anim is painted + uploaded */
  baseReady: boolean;
  /** cropped atlas state (null: grid sheet) */
  crop: CropState | null;
  stats: SheetStats;
}

/** A committed cropped sheet (kept after it settles): frame index + canvas-exact flags for readBack. */
interface CroppedSheet {
  art: MonsterArt;
  tex: Phaser.Textures.Texture;
  index: Map<string, number>;
  exact: Uint8Array;
}

/** Painting statistics of one sheet (tools/texmem.mjs). */
export interface SheetStats {
  key: string;
  crop: boolean;
  frames: number;
  painted: number;
  /** ms in the painters (drawing + putImageData) */
  cpuMs: number;
  /** ms trimming, packing and uploading the cropped groups */
  packMs: number;
  uploads: number;
  /** bytes of the sheet's texture sources now (RGBA) */
  bytes: number;
  queued: boolean;
  boot: boolean;
  /** performance.now() when the last cell was painted (0: not complete) */
  doneAt: number;
}

const pendingSheets = new Map<string, PendingSheet>();
/** anim key → sheet, for the extra anims of pending sheets (AnimationManager.get hook) */
const pendingExtraAnims = new Map<string, { ps: PendingSheet; anim: AnyMonsterAnim }>();
const whenDone: (() => void)[] = [];
const whenAllDone: (() => void)[] = [];
/** keys of every monster sheet built or prepared here (monsterSheetPending) */
const knownSheets = new Set<string>();
/** cropped sheets by key (readBack) */
const croppedSheets = new Map<string, CroppedSheet>();
/** Main-thread budget of one background painting slice (ms). */
const SLICE_MS = 6;
/** ?test (and node): sheets are built / painted synchronously, never in background slices. */
let syncMode = false;

const sheetStats = new Map<string, SheetStats>();
let firstPaintAt = 0;
let lastPaintAt = 0;

function statsOf(key: string, crop: boolean, frames: number): SheetStats {
  const st: SheetStats = { key, crop, frames, painted: 0, cpuMs: 0, packMs: 0, uploads: 0, bytes: 0, queued: false, boot: false, doneAt: 0 };
  sheetStats.set(key, st);
  return st;
}

function notePaint(t: number): void {
  if (!firstPaintAt) firstPaintAt = t;
  lastPaintAt = t;
}

function sheetBytes(tex: Phaser.Textures.Texture | null | undefined): number {
  let b = 0;
  for (const s of tex?.source ?? []) b += (s.width || 0) * (s.height || 0) * 4;
  return b;
}

/** Painting statistics of every monster sheet (tools/texmem.mjs). */
export function sheetPaintStats(): { sheets: SheetStats[]; cpuMs: number; packMs: number; uploads: number; firstAt: number; doneAt: number; pending: string[]; queuedPending: string[] } {
  const sheets = [...sheetStats.values()].map((s) => ({ ...s, cpuMs: +s.cpuMs.toFixed(1), packMs: +s.packMs.toFixed(1) }));
  return {
    sheets,
    cpuMs: +sheets.reduce((a, s) => a + s.cpuMs, 0).toFixed(1),
    packMs: +sheets.reduce((a, s) => a + s.packMs, 0).toFixed(1),
    uploads: sheets.reduce((a, s) => a + s.uploads, 0),
    firstAt: Math.round(firstPaintAt),
    doneAt: Math.round(lastPaintAt),
    pending: [...pendingSheets.keys()],
    queuedPending: [...pendingSheets.values()].filter((p) => p.queued).map((p) => p.key),
  };
}

function bootPending(): boolean {
  for (const ps of pendingSheets.values()) if (ps.boot) return true;
  return false;
}

function queuedPending(): boolean {
  for (const ps of pendingSheets.values()) if (ps.queued) return true;
  return false;
}

/** Resolves once every monster sheet built at boot is painted (immediately when nothing is pending). */
export function whenMonstersBuilt(): Promise<void> {
  if (!bootPending()) return Promise.resolve();
  return new Promise((r) => whenDone.push(r));
}

/**
 * (A4.1) Resolves once every sheet queued for background painting — the boot's P1 sheets AND the
 * P2 'relight' sheets painted ahead — is painted (immediately when nothing is queued).
 */
export function whenSheetsPainted(): Promise<void> {
  if (!queuedPending()) return Promise.resolve();
  return new Promise((r) => whenAllDone.push(r));
}

/**
 * Animations of a sheet that are not painted + uploaded yet ([] when the sheet is complete or
 * was built synchronously; null when no such sheet was ever registered as deferred).
 */
export function monsterSheetPending(key: string): AnyMonsterAnim[] | null {
  const ps = pendingSheets.get(key);
  if (!ps) return knownSheets.has(key) ? [] : null;
  return [...ps.groups.values()].filter((g) => !g.ready).map((g) => g.anim);
}

function paintCell(ps: PendingSheet, i: number): void {
  if (ps.painted[i]) return;
  const t0 = performance.now();
  const c = ps.cells[i];
  const pc = cellPixels(ps.art, c, ps.draw, !!ps.crop);
  if (ps.crop) {
    ps.crop.pcs[i] = pc;
    ps.crop.packOf.get(c.anim)!.left--;
  } else ps.ctx!.putImageData(new ImageData(pc.data as Uint8ClampedArray<ArrayBuffer>, ps.art.w, ps.art.h), c.x, c.y);
  ps.painted[i] = 1;
  ps.left--;
  ps.groups.get(c.anim)!.left--;
  ps.dirty = true;
  const t1 = performance.now();
  ps.stats.cpuMs += t1 - t0;
  ps.stats.painted++;
  notePaint(t1);
}

/**
 * Cropped sheets: trim the pack's frames, pack them into a canvas of their own, add it to the
 * sheet's texture as a new source (its upload) and point the frames at it (Phaser trim: the
 * frames keep the art's size). Frames are looked up in `tex.frames`, not through the hooked get.
 */
function commitPack(ps: PendingSheet, p: Pack): void {
  const crop = ps.crop!;
  const t0 = performance.now();
  const { w, h } = ps.art;
  const idx: number[] = [];
  for (let i = p.start; i < p.end; i++) idx.push(i);
  if (!ps.tex.manager) {
    // the texture was removed meanwhile: nothing to upload into
    for (const i of idx) crop.pcs[i] = null;
    p.done = true;
    return;
  }
  const rects: Rect[] = idx.map((i) => trimRect(crop.pcs[i]!.data, w, h));
  const pk = packRects(rects);
  const cv = document.createElement('canvas');
  cv.width = pk.w;
  cv.height = pk.h;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  const own = croppedSheets.get(ps.key);
  const cs = own && own.tex === ps.tex ? own : null;
  idx.forEach((i, k) => {
    const pc = crop.pcs[i]!;
    const r = rects[k];
    const at = pk.pos[k];
    ctx.putImageData(new ImageData(pc.data as Uint8ClampedArray<ArrayBuffer>, w, h), at.x - r.x, at.y - r.y, r.x, r.y, r.w, r.h);
    if (cs) cs.exact[i] = canvasExact(pc.data) ? 1 : 0;
  });
  const src = new Phaser.Textures.TextureSource(ps.tex, cv, pk.w, pk.h);
  ps.tex.source.push(src);
  const si = ps.tex.source.length - 1;
  idx.forEach((i, k) => {
    const c = ps.cells[i];
    const fr = (ps.tex.frames as Record<string, Phaser.Textures.Frame | undefined>)[monsterFrameName(c.anim, c.f)];
    crop.pcs[i] = null;
    if (!fr) return;
    const r = rects[k];
    const at = pk.pos[k];
    fr.source = src;
    fr.sourceIndex = si;
    fr.setSize(r.w, r.h, at.x, at.y);
    fr.setTrim(w, h, r.x, r.y, r.w, r.h);
  });
  p.done = true;
  ps.stats.packMs += performance.now() - t0;
  ps.stats.uploads++;
  ps.stats.bytes = sheetBytes(ps.tex);
}

/** Upload the canvas (if anything changed); every fully painted group becomes ready. */
function upload(ps: PendingSheet): void {
  if (ps.crop) {
    ps.dirty = false;
    for (const p of ps.crop.packs) if (!p.done && !p.left) commitPack(ps, p);
    for (const g of ps.groups.values()) if (!g.ready && ps.crop.packOf.get(g.anim)!.done) g.ready = true;
  } else {
    if (ps.dirty) {
      ps.dirty = false;
      try {
        if (ps.tex.manager) ps.tex.source[0]?.update();
        ps.stats.uploads++;
      } catch (e) {
        console.error(`[art] monster sheet ${ps.key} upload failed`, e);
      }
    }
    for (const g of ps.groups.values()) if (!g.left) g.ready = true;
  }
  ps.baseReady = MONSTER_ANIMS.every((a) => ps.groups.get(a)!.ready);
}

/** Drop a fully painted sheet from the pending set (and its lazy hooks). */
function settle(ps: PendingSheet): void {
  if (ps.left) return;
  upload(ps);
  if (pendingSheets.get(ps.key) === ps) pendingSheets.delete(ps.key);
  for (const a of ps.extras) {
    const k = sheetAnimKey(ps.key, a);
    if (pendingExtraAnims.get(k)?.ps === ps) pendingExtraAnims.delete(k);
  }
  // restore the prototype Texture.get (see hookTextureFrames)
  if (Object.prototype.hasOwnProperty.call(ps.tex, 'get')) delete (ps.tex as { get?: unknown }).get;
  if (!ps.stats.doneAt) ps.stats.doneAt = performance.now();
  if (!ps.crop) ps.stats.bytes = sheetBytes(ps.tex);
  if (ps.boot && !bootPending()) for (const r of whenDone.splice(0)) r();
  if (ps.queued && !queuedPending()) for (const r of whenAllDone.splice(0)) r();
}

/** Paint + upload the given animations of a pending sheet right now (no-op for ready ones). */
function ensureAnims(ps: PendingSheet, anims: readonly AnyMonsterAnim[]): void {
  let todo = false;
  for (const a of anims) {
    const g = ps.groups.get(a);
    if (!g || g.ready) continue;
    // a cropped sheet commits a whole pack: paint every anim of it
    const p = ps.crop?.packOf.get(a);
    const [s, e] = p ? [p.start, p.end] : [g.start, g.end];
    for (let i = s; i < e; i++) paintCell(ps, i);
    todo = true;
  }
  if (!todo) return;
  upload(ps);
  settle(ps);
}

/**
 * Paint up to `budgetMs` of pending cells of one sheet, in sheet order, up to cell `limit`;
 * true when that range is done (the sheet settles once every cell is painted). A cropped sheet
 * commits each group as soon as its last cell is painted.
 */
function paintSlice(ps: PendingSheet, budgetMs: number, limit: number): boolean {
  const t0 = performance.now();
  while (ps.next < limit) {
    const i = ps.next++;
    if (ps.painted[i]) continue;
    paintCell(ps, i);
    if (ps.crop && !ps.crop.packOf.get(ps.cells[i].anim)!.left) upload(ps);
    if (performance.now() - t0 > budgetMs && ps.next < limit) return false;
  }
  settle(ps);
  return true;
}

/** Finish a pending sheet's base animations right now (first access through the texture manager). */
function finishBase(key: string): void {
  const ps = pendingSheets.get(key);
  if (ps) ensureAnims(ps, MONSTER_ANIMS);
}

/**
 * Paint (and upload) some animations of a deferred sheet now — or all of them when `anims` is
 * omitted. For warming ahead of a cinematic; a no-op for complete / synchronous sheets.
 */
export function finishMonsterSheet(key: string, anims?: readonly AnyMonsterAnim[]): void {
  const ps = pendingSheets.get(key);
  if (!ps) return;
  ensureAnims(ps, anims ?? [...ps.groups.keys()]);
}

/**
 * (v3 A2 tech review r2 #12, additive) Paint the given animations of a deferred sheet FIRST, in
 * the background — short slices between frames like the boot painter (SLICE_MS each), one upload
 * once they are all painted — so a cinematic that will need them (a summon pose, the reactions and
 * the death of a unit on the field) finds them ready instead of painting them synchronously on its
 * impact frame. A no-op for complete / synchronous sheets and for anims already painted, and with
 * ?test (the sheets a page did not stage are painted synchronously on first use there).
 */
export function warmMonsterSheet(key: string, anims: readonly AnyMonsterAnim[]): void {
  if (syncMode) return;
  const ps = pendingSheets.get(key);
  if (!ps) return;
  const add = anims.map((a) => ps.groups.get(a)).filter((g): g is Group => !!g && !g.ready);
  if (!add.length) return;
  // a cropped sheet commits whole packs: warm every group of their packs
  if (ps.crop) {
    for (const g of [...add]) {
      const p = ps.crop.packOf.get(g.anim)!;
      for (const a of p.anims) {
        const o = ps.groups.get(a)!;
        if (!o.ready && !add.includes(o)) add.push(o);
      }
    }
  }
  // one warm queue per sheet: a later call adds its anims to the running one
  let todo = warmQueues.get(ps);
  if (todo) {
    for (const g of add) if (!todo.includes(g)) todo.push(g);
    return;
  }
  todo = [...add];
  warmQueues.set(ps, todo);
  const q = todo;
  const tick = () => {
    if (pendingSheets.get(ps.key) !== ps) {
      warmQueues.delete(ps);
      return;
    }
    const t0 = performance.now();
    while (q.length && performance.now() - t0 < SLICE_MS) {
      const g = q[0];
      let i = g.start;
      while (i < g.end && ps.painted[i]) i++;
      if (i >= g.end) q.shift();
      else paintCell(ps, i);
    }
    if (q.length) {
      setTimeout(tick, 0);
      return;
    }
    warmQueues.delete(ps);
    upload(ps);
    settle(ps);
  };
  setTimeout(tick, 0);
}

/** The running warm queue of each sheet (warmMonsterSheet). */
const warmQueues = new Map<PendingSheet, Group[]>();

function dropPending(key: string): void {
  const ps = pendingSheets.get(key);
  if (!ps) return;
  ps.left = 0;
  for (const g of ps.groups.values()) g.left = 0;
  if (ps.crop) {
    // nothing left to commit: the texture is about to be replaced
    for (const p of ps.crop.packs) {
      p.left = 0;
      p.done = true;
    }
    ps.crop.pcs.fill(null);
  }
  settle(ps);
}

/** A transparent 1 × 1 canvas: source 0 of a cropped sheet (its frames' cut until their group is committed). */
function placeholderCanvas(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 1;
  cv.height = 1;
  return cv;
}

/**
 * Register a monster sheet with blank frames + its animations; painting happens later (in the
 * background once paintSheetsInBackground() runs, or on first use — see above).
 */
export function prepareMonsterSheet(scene: Phaser.Scene, art: MonsterArt, o: SheetOpts = {}, boot = false): string {
  const key = o.key ?? monsterTextureKey(art.id);
  dropPending(key);
  const { cols, rows, cells } = layoutSheet(art);
  const w = art.w;
  const h = art.h;
  const crop = cropsArt(art);
  let ctx: CanvasRenderingContext2D | null = null;
  let tex: Phaser.Textures.Texture;
  if (crop) {
    tex = addStaticCanvas(scene, key, placeholderCanvas());
    for (const c of cells) tex.add(monsterFrameName(c.anim, c.f), 0, 0, 0, 1, 1)!.setTrim(w, h, 0, 0, 1, 1);
  } else {
    const cv = document.createElement('canvas');
    cv.width = cols * w;
    cv.height = rows * h;
    ctx = cv.getContext('2d', { willReadFrequently: true })!;
    tex = addStaticCanvas(scene, key, cv);
    for (const c of cells) tex.add(monsterFrameName(c.anim, c.f), 0, c.x, c.y, w, h);
  }
  createSheetAnims(scene, art, key);
  const groups = new Map<AnyMonsterAnim, Group>();
  cells.forEach((c, i) => {
    const g = groups.get(c.anim);
    if (g) {
      g.end = i + 1;
      g.left++;
    } else groups.set(c.anim, { anim: c.anim, start: i, end: i + 1, left: 1, ready: false });
  });
  const extras = [...groups.keys()].filter(isExtraAnim);
  let cropState: CropState | null = null;
  if (crop) {
    const base = [...groups.values()].filter((g) => !isExtraAnim(g.anim));
    const packs: Pack[] = [];
    if (base.length) packs.push({ anims: base.map((g) => g.anim), start: base[0].start, end: base[base.length - 1].end, left: base.reduce((s, g) => s + g.left, 0), done: false });
    for (const a of extras) {
      const g = groups.get(a)!;
      packs.push({ anims: [a], start: g.start, end: g.end, left: g.left, done: false });
    }
    const packOf = new Map<AnyMonsterAnim, Pack>();
    for (const p of packs) for (const a of p.anims) packOf.set(a, p);
    cropState = { packs, packOf, pcs: cells.map(() => null) };
    croppedSheets.set(key, { art, tex, index: new Map(cells.map((c, i) => [monsterFrameName(c.anim, c.f), i])), exact: new Uint8Array(cells.length) });
  } else croppedSheets.delete(key);
  const ps: PendingSheet = {
    art,
    key,
    draw: o.draw,
    tex,
    ctx,
    cells,
    painted: new Uint8Array(cells.length),
    groups,
    left: cells.length,
    next: 0,
    dirty: false,
    boot,
    queued: false,
    extras,
    baseReady: false,
    crop: cropState,
    stats: statsOf(key, crop, cells.length),
  };
  ps.stats.boot = boot;
  ps.stats.bytes = sheetBytes(tex);
  pendingSheets.set(key, ps);
  knownSheets.add(key);
  for (const a of extras) pendingExtraAnims.set(sheetAnimKey(key, a), { ps, anim: a });
  // anims are created: from here on, lookups of a pending sheet paint what they need first
  hookTextureManager(scene.textures);
  hookAnimationManager(scene.anims);
  if (extras.length) hookTextureFrames(ps);
  return key;
}

const hooked = new WeakSet<object>();

/** Make textures.get('mon:<id>') finish that sheet's base anims first (once per game). */
function hookTextureManager(tm: Phaser.Textures.TextureManager): void {
  if (hooked.has(tm)) return;
  hooked.add(tm);
  const get = tm.get.bind(tm);
  tm.get = ((key: string | Phaser.Textures.Texture) => {
    if (pendingSheets.size && typeof key === 'string') {
      const ps = pendingSheets.get(key);
      if (ps && !ps.baseReady) finishBase(key);
    }
    return get(key);
  }) as typeof tm.get;
}

/** Make anims.get('<key>:<extra anim>') (every play() goes through it) paint that anim first. */
function hookAnimationManager(am: Phaser.Animations.AnimationManager): void {
  if (hooked.has(am)) return;
  hooked.add(am);
  const get = am.get.bind(am);
  am.get = ((key: string) => {
    if (pendingExtraAnims.size) {
      const e = pendingExtraAnims.get(key);
      if (e) ensureAnims(e.ps, [...MONSTER_ANIMS, e.anim]);
    }
    return get(key);
  }) as typeof am.get;
}

/**
 * Only on sheets with extra anims, until they are complete: setFrame('<extra>:<i>') (poses) goes
 * through Texture.get(name), so paint that anim first. Installed after the anims were created
 * (anims.create resolves its frames through Texture.get too).
 */
function hookTextureFrames(ps: PendingSheet): void {
  const tex = ps.tex;
  const get = Phaser.Textures.Texture.prototype.get;
  tex.get = function (this: Phaser.Textures.Texture, name?: string | number) {
    if (typeof name === 'string' && pendingSheets.get(ps.key) === ps) {
      const anim = name.slice(0, name.lastIndexOf(':')) as AnyMonsterAnim;
      const g = ps.groups.get(anim);
      if (g && !g.ready) ensureAnims(ps, [...MONSTER_ANIMS, anim]);
    }
    return get.call(this, name);
  };
}

/**
 * Paint the given pending sheets in short slices between frames (requestIdleCallback starves
 * under load: 40+ s in the headless test); a frame is ~2–8 ms of drawing, so a slice may overrun
 * its budget a bit. Base anims of every sheet first (the `first` sheets', then the `then` ones'),
 * then the extras in the same order.
 */
function paintSheetsInBackground(first: PendingSheet[], then: PendingSheet[] = []): void {
  const sheets = [...first, ...then];
  for (const ps of sheets) {
    ps.queued = true;
    ps.stats.queued = true;
  }
  const baseEnd = (ps: PendingSheet) => (ps.extras.length ? ps.groups.get(ps.extras[0])!.start : ps.cells.length);
  const queue: { ps: PendingSheet; limit: number }[] = [
    ...sheets.map((ps) => ({ ps, limit: baseEnd(ps) })),
    ...sheets.filter((ps) => ps.extras.length).map((ps) => ({ ps, limit: ps.cells.length })),
  ];
  const tick = () => {
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < SLICE_MS) {
      const { ps, limit } = queue[0];
      if (pendingSheets.get(ps.key) !== ps || paintSlice(ps, SLICE_MS - (performance.now() - t0), limit)) queue.shift();
    }
    if (queue.length) setTimeout(tick, 0);
  };
  setTimeout(tick, 0);
}

/** Options of the optional P2 'relight' sheet of `art` (see monsterSheetKey). */
function p2SheetOpts(art: MonsterArt): SheetOpts {
  return { key: monsterP2TextureKey(art.id), draw: { lightFrom: 'right' } };
}

// A2 tech review r3 #8: the P2 'relight' sheets (13.6 MB and ~2.8 s of painting for the two v3
// slice monsters) were allocated at boot and painted in the background in every game, used or
// not. They are now LAZY unless the page's SheetPlan names the monster (A4.1: a monster player 2
// can control is painted ahead, after the P1 sheets): registered (blank frames, anims) the first
// time a player-2 unit of that monster needs its sheet — monsterSheetKey(id, 1), which MonsterUnit's
// sheet selection and the cinematics' pose warming (a summon / revive / steal of player 2 warms its
// poses before the body appears) go through — then painted in the background like the boot sheets,
// base anims first (a lookup before they are done paints them synchronously, as for any deferred
// sheet). With ?test a lazy P2 sheet is only registered: it is painted synchronously on first use.

const lazyP2 = new Map<string, { scene: Phaser.Scene; art: MonsterArt }>();

/** Register (and start painting) a lazy P2 sheet by key; no-op when there is none or it exists. */
function prepareLazyP2(key: string): void {
  const job = lazyP2.get(key);
  if (!job) return;
  lazyP2.delete(key);
  try {
    if (!job.scene.sys?.game) return;
    prepareMonsterSheet(job.scene, job.art, p2SheetOpts(job.art), false);
    if (!syncMode) paintMonsterSheets([key]);
  } catch (e) {
    console.error(`[art] lazy P2 sheet ${key} failed`, e);
    dropPending(key);
    knownSheets.delete(key);
  }
}

/**
 * Build the monster sheets at boot. With a `plan` (src/boot/20-monsters.ts: a staged scenario's
 * monsters and its decks', or the decks' monsters in a real game — src/art/atlas.ts stagePlan / deckPlan) only
 * the plan's sheets are painted ahead: every other default sheet is registered and painted on
 * first use, every other P2 'relight' sheet registered on first use. ?test paints the plan's
 * sheets synchronously right here; a real game paints them in the background, the P1 sheets'
 * base anims first, then the P2 sheets' base anims, then the extras. Without a plan: every default
 * sheet (and with ?test every P2 'relight' sheet), as before A4.1.
 */
export function buildAllMonsters(scene: Phaser.Scene, plan?: SheetPlan): void {
  const sync = typeof location === 'undefined' || new URLSearchParams(location.search).has('test');
  syncMode = sync;
  const p1Want = new Set<MonsterId>(plan ? plan.p1 : MONSTER_IDS);
  const p2Want = new Set<MonsterId>(plan ? plan.p2 : sync ? MONSTER_IDS : []);
  const p2Arts = MONSTER_IDS.map((id) => monsterArt(id)).filter(relightsP2);
  if (sync) {
    for (const id of MONSTER_IDS) {
      const art = monsterArt(id);
      if (p1Want.has(id)) buildMonster(scene, art);
      else prepareMonsterSheet(scene, art, {}, false);
    }
    // P2 'relight' sheets (opt-in per art) come after every default sheet
    for (const art of p2Arts) {
      const o = p2SheetOpts(art);
      if (p2Want.has(art.id)) buildMonster(scene, art, o);
      else lazyP2.set(o.key!, { scene, art });
    }
    return;
  }
  const first: PendingSheet[] = [];
  const then: PendingSheet[] = [];
  const prepare = (art: MonsterArt, o: SheetOpts, boot: boolean, into: PendingSheet[] | null) => {
    const key = o.key ?? monsterTextureKey(art.id);
    try {
      prepareMonsterSheet(scene, art, o, boot);
      if (into) into.push(pendingSheets.get(key)!);
    } catch (e) {
      // fall back to the synchronous path for this one
      console.error(`[art] deferred monster sheet ${key} failed, building now`, e);
      dropPending(key);
      buildMonster(scene, art, o);
    }
  };
  for (const id of MONSTER_IDS) {
    const staged = p1Want.has(id);
    prepare(monsterArt(id), {}, staged, staged ? first : null);
  }
  for (const art of p2Arts) {
    const o = p2SheetOpts(art);
    if (p2Want.has(art.id)) prepare(art, o, false, then);
    else lazyP2.set(o.key!, { scene, art });
  }
  paintSheetsInBackground(first, then);
}

/** Start background painting of deferred sheets registered with prepareMonsterSheet (by key). */
export function paintMonsterSheets(keys: readonly string[]): void {
  paintSheetsInBackground(keys.map((k) => pendingSheets.get(k)).filter((ps): ps is PendingSheet => !!ps));
}
