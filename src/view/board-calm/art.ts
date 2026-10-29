// Calm arena art (look v3, docs/v3/A0_ENVANTER.md §5.5 / §6.1 item 8) — the still preview's arena
// (src/still/arena.ts: the ORIGINAL v1 board geometry as a dark matte slab, flat navy zone pads with
// one thin player-coloured outline, one neon trim along the platform edge, a calm ink / violet
// background) cut into the layers the in-game board needs to light, highlight and animate it:
//
//   background  four flat WHITE masks (violet haze band, upper + lower stand tiers, the floor disc) over
//               an ink base, tinted with their PAL tone in the game, so the lights-off intro and the
//               volcano theme are tint swaps (no second background). Reaches BG_RECT, i.e. past the
//               640×360 frame by more than the camera's 1× lean + shake (CameraRig.PAN_LIMIT_DEFAULT).
//               Stored as 64-px strips with tight vertical bounds (the bands are thin arcs).
//   slab        hull + side faces + top surface (zones, lines, trims, rim) exactly as the still.
//   pads        per zone: that zone's own pixels (gap ring + line + pad), for BoardView.tileImage().
//   masks       shared 64×32 white masks of one zone (pad interior / zone line / whole tile) — every
//               zone has the same local geometry. A light step on a pad = the interior mask tinted with
//               the stepped PAL tone (the LUT approach of src/still/scene.ts: one flat tone, no alpha).
//   trims       the neon edge strip as white masks: each side's strip is walked pixel by pixel from its
//               seam and cut into straight runs (one tone, monotonic x), so every pixel has its position
//               along the strip (runners, pulses) and a run can be revealed by an x crop (ignition).
//   tips        the highlight's corner chevrons (white masks, parallel to the 2:1 tile edges).
//
// Reuse: every platform-top colour comes from the still's own topAt(); geometry comes from
// src/still/arena-geom.ts. The hull, the side faces and the background are the still's drawHull /
// drawFaces / drawBackground, copied here because the still does not export them (and src/still
// stays untouched as the reference). drawArena() itself is not called: its full topAt() pass over
// the slab (68k calls) costs ~90 ms cold, above the <100 ms boot budget. Instead topAt() is asked
// ~1k times and its answers are reused where the geometry repeats exactly: one quadrant of one zone
// tile gives every grid tile (all 25 share their local geometry; the cell type only picks colours),
// and in the border band a pixel copies the one a grid step back along its straight edge, the lower
// half is the upper half rotated about the board centre, and pixels provably far from every feature
// are plain border. tests/view/board-calm.test.ts proves the composed layers pixel-identical to
// drawArena() over the whole 640×360 frame.
// Pure PixelCanvas code (no Phaser): runs in Node for tests and timing.

import { PAL } from '../../art/palette';
import { type Color, PixelCanvas, type Pt } from '../../art/pixel';
import type { PlayerId } from '../../engine/types';
import { topAt, type TopKind } from '../../still/arena';
import { G0, G1, GR1, HULL, KEEL_TIP, OUTLINE, SLAB_T, WALL_H, gp, inGrid, insideOutline, pixelGrid, rimY, standsBottomY } from '../../still/arena-geom';
import { BOARD_COLS, BOARD_MID_COL, BOARD_ROWS, type BoardSpot, GAME_H, GAME_W, LANES, ZONES5, cellKind, isoToScreen, zoneAtCell, zoneCell } from '../layout';

// ---------------------------------------------------------------- tones (as src/still/arena.ts T)

/** The still's tones (src/still/arena.ts `T`), every one a PAL entry. */
export const CALM_T = {
  sky: PAL.ink,
  haze: PAL.void0,
  canopy: PAL.ink,
  stands: PAL.night1,
  standsLow: PAL.night0,
  ground: PAL.ink,
  floorDisc: PAL.night0,
  hullL: PAL.night1,
  hullR: PAL.ink,
  hullRLip: PAL.night0,
  hullEdge: PAL.ink,
  keelL: PAL.night0,
  keelR: PAL.ink,
  keelRidge: PAL.night2,
  faceLLip: PAL.night2,
  faceL: PAL.night1,
  faceR: PAL.night0,
  faceBottom: PAL.ink,
  border: PAL.stone0,
  pad: PAL.night1,
  pile: PAL.night0,
  /** neon: full strength on the front edges, one tone down behind; [P1, P2, neutral] */
  trim: [PAL.cyan2, PAL.crim2, PAL.night3] as const,
  trimBack: [PAL.cyan1, PAL.crim1, PAL.night2] as const,
  line: [PAL.cyan1, PAL.crim1] as const,
};

// ---------------------------------------------------------------- texture keys

export const CALM = {
  /** the background masks (white; tint haze void0, stands night1, standsLow night0, disc night0), as
   *  64-px wide strips packed into one texture: frame `bg:<part>:<i>` */
  bg: 'calm:bg',
  bgFrame: (part: CalmBgPart, i: number) => `bg:${part}:${i}`,
  slab: 'calm:slab',
  /** one atlas texture holding every small layer below (frame names) */
  atlas: 'calm:atlas',
  /** a zone's own pixels (gap ring + zone line + pad), 64×32, centred on the zone */
  pad: (player: PlayerId, spot: BoardSpot, index: number) => `pad:${player}:${spot}:${index}`,
  /** shared 64×32 white masks of one zone, centred on the zone */
  maskFill: 'mask:fill',
  maskLine: 'mask:line',
  maskTile: 'mask:tile',
  /** neon trim piece n (white mask) */
  trim: (n: number) => `trim:${n}`,
  /** highlight chevrons: top (flipY → bottom), left (flipX → right) */
  tipT: 'tip:t',
  tipL: 'tip:l',
} as const;

export type CalmBgPart = 'haze' | 'stands' | 'standsLow' | 'disc';
export const CALM_BG_PARTS: readonly CalmBgPart[] = ['haze', 'stands', 'standsLow', 'disc'];

/** The tone each background mask has in the still. */
export const CALM_BG_TONE: Record<CalmBgPart, Color> = {
  haze: CALM_T.haze,
  stands: CALM_T.stands,
  standsLow: CALM_T.standsLow,
  disc: CALM_T.floorDisc,
};

/** World rect the background masks cover (past the frame by the camera's lean + shake). */
export const BG_RECT = { x: -80, y: 0, w: 800, h: 412 } as const;

// ---------------------------------------------------------------- types

/** A layer image: `canvas` placed with its top-left at world (x, y). */
export interface CalmLayer {
  x: number;
  y: number;
  canvas: PixelCanvas;
}

/** 0 = P1 half, 1 = P2 half, 2 = the neutral bridge band (as still/arena-geom.ts rowSide). */
export type TrimSide = 0 | 1 | 2;

export interface TrimPx {
  x: number;
  y: number;
  /** position along the side's strip (px steps; 0 at the side's seam start) */
  s: number;
}

export interface TrimPiece {
  n: number;
  side: TrimSide;
  /** on an edge facing away from the camera (the still draws it one tone down) */
  back: boolean;
  layer: CalmLayer;
  /** pixels sorted by s */
  px: TrimPx[];
  /** +1 if s grows with x across this piece, −1 if it shrinks (the ignition reveal crops along x) */
  dirX: 1 | -1;
}

export interface TrimPath {
  /** strip length (px) */
  len: number;
  /** s of the strip pixel nearest the duelist podium's outer edge midpoint (pulses start there) */
  podium: number;
  /** every trim pixel of the side, sorted by s, with its still tone */
  px: (TrimPx & { tone: Color })[];
}

export interface CalmArt {
  /** each background part as 64-px wide strips (tight vertical bounds), and their packed texture */
  bg: Record<CalmBgPart, CalmLayer[]>;
  bgAtlas: CalmArt['atlas'];
  slab: CalmLayer;
  /** keyed `${player}:${spot}:${index}` (20 zones) */
  pads: Map<string, CalmLayer>;
  /** 64×32 white masks; the zone centre is at local (32, 16) */
  masks: { fill: PixelCanvas; line: PixelCanvas; tile: PixelCanvas };
  /** zone-line pixels (local to the 64×32 box), ordered clockwise from the top tip */
  linePath: { x: number; y: number }[];
  trims: TrimPiece[];
  paths: Record<0 | 1, TrimPath>;
  tips: { t: PixelCanvas; l: PixelCanvas };
  /** the small layers packed into one texture: frame name → rect */
  atlas: { canvas: PixelCanvas; frames: Map<string, { x: number; y: number; w: number; h: number }> };
  /** per screen pixel of the 640×360 frame: TOP_CODE of the platform top (0 = not on the top) */
  kinds: Uint8Array;
  /** build time per part, ms */
  ms: Record<string, number>;
}

/** TopKind → small code (0 = off the top surface). */
export const TOP_CODE: Record<TopKind, number> = { rim: 1, border: 2, trim: 3, join: 4, gap: 5, pad: 6, pile: 7, line: 8, bridge: 9 };

// ---------------------------------------------------------------- background (still drawBackground)

const HAZE_H = 36;
const FLOOR = { cx: 320, cy: 353, rx: 310, ry: 51 } as const;

function wave(x: number, amp: number, period: number, phase: number): number {
  return amp * Math.sin((x / period + phase) * Math.PI * 2);
}

const BG_CODE: Record<CalmBgPart, number> = { haze: 1, stands: 2, standsLow: 3, disc: 4 };

/**
 * src/still/arena.ts drawBackground() evaluated at world coordinates (so it runs on past the
 * frame), as vertical runs per column: [x, y0, y1) for each part (sky, roof and ground are ink).
 * Every class is one contiguous run per column, so only the run ends are searched, with the
 * still's own per-pixel expressions (exact at the boundaries).
 */
function backgroundRuns(rect: { x: number; y: number; w: number; h: number }): Record<CalmBgPart, number[]> {
  const runs: Record<CalmBgPart, number[]> = { haze: [], stands: [], standsLow: [], disc: [] };
  const yLo = rect.y;
  const yHi = rect.y + rect.h;
  const push = (part: CalmBgPart, x: number, a: number, b: number) => {
    a = Math.max(a, yLo);
    b = Math.min(b, yHi);
    if (b > a) runs[part].push(x, a, b);
  };
  for (let i = 0; i < rect.w; i++) {
    const x = rect.x + i;
    const top = rimY(x + 0.5);
    const bot = standsBottomY(x + 0.5);
    const yTop = Math.round(top) - 4;
    const hazeTop = Math.round(top - 4 - HAZE_H - wave(x, 3, 210, 0.15) - wave(x, 2, 97, 0.6));
    // y < yTop: sky above hazeTop, haze below; yTop ≤ y < top: the roof (ink)
    push('haze', x, hazeTop, yTop);
    // top ≤ y < bot + WALL_H: the stands, split where t = (y + 0.5 − top) / (bot − top) reaches 0.47
    // (run ends from the closed form, then settled with the still's own expression)
    const y0 = Math.max(yTop, Math.ceil(top));
    const y1 = Math.max(y0, Math.ceil(bot + WALL_H));
    const below = (y: number) => (y + 0.5 - top) / (bot - top) < 0.47;
    let split = Math.min(y1, Math.max(y0, Math.ceil(top + 0.47 * (bot - top) - 0.5)));
    while (split > y0 && !below(split - 1)) split--;
    while (split < y1 && below(split)) split++;
    push('stands', x, y0, split);
    push('standsLow', x, split, y1);
    // below: the floor disc (one ellipse) on the ink ground
    const ex = (x + 0.5 - FLOOR.cx) / FLOOR.rx;
    const inDisc = (y: number) => {
      const ey = (y + 0.5 - FLOOR.cy) / FLOOR.ry;
      return ex * ex + ey * ey <= 1;
    };
    if (ex * ex <= 1) {
      const half = FLOOR.ry * Math.sqrt(1 - ex * ex);
      let d0 = Math.max(y1, Math.ceil(FLOOR.cy - 0.5 - half));
      let d1 = Math.max(d0, Math.floor(FLOOR.cy - 0.5 + half) + 1);
      while (d0 > y1 && inDisc(d0 - 1)) d0--;
      while (d0 < d1 && !inDisc(d0)) d0++;
      while (inDisc(d1)) d1++;
      while (d1 > d0 && !inDisc(d1 - 1)) d1--;
      push('disc', x, d0, d1);
    }
  }
  return runs;
}

/** The still's background colour of world pixel (x, y). */
export function backgroundColor(x: number, y: number): Color {
  const runs = backgroundRuns({ x, y, w: 1, h: 1 });
  const part = CALM_BG_PARTS.find((p) => runs[p].length > 0);
  return part ? CALM_BG_TONE[part] : PAL.ink;
}

/** Width of the background mask strips (each strip gets its own tight vertical bounds). */
const BG_STRIP = 64;

function maskLayers(runs: Record<CalmBgPart, number[]>): Record<CalmBgPart, CalmLayer[]> {
  const out = {} as Record<CalmBgPart, CalmLayer[]>;
  for (const part of CALM_BG_PARTS) {
    const r = runs[part];
    // one run per column: [x, y0, y1) by column offset from BG_RECT.x
    const A = new Int32Array(BG_RECT.w).fill(1 << 30);
    const B = new Int32Array(BG_RECT.w).fill(-(1 << 30));
    for (let k = 0; k < r.length; k += 3) {
      A[r[k] - BG_RECT.x] = r[k + 1];
      B[r[k] - BG_RECT.x] = r[k + 2];
    }
    const strips: CalmLayer[] = [];
    for (let s0 = 0; s0 < BG_RECT.w; s0 += BG_STRIP) {
      const s1 = Math.min(BG_RECT.w, s0 + BG_STRIP);
      let i0 = s1;
      let i1 = -1;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (let i = s0; i < s1; i++) {
        if (B[i] <= A[i]) continue;
        i0 = Math.min(i0, i);
        i1 = i;
        y0 = Math.min(y0, A[i]);
        y1 = Math.max(y1, B[i]);
      }
      if (i1 < 0) continue;
      const w = i1 - i0 + 1;
      const h = y1 - y0;
      const p = new PixelCanvas(w, h);
      const d = new Uint32Array(p.data.buffer);
      for (let j = 0; j < h; j++) {
        const y = y0 + j;
        for (let i = 0; i < w; i++) if (A[i0 + i] <= y && y < B[i0 + i]) d[j * w + i] = 0xffffffff;
      }
      strips.push({ x: BG_RECT.x + i0, y: y0, canvas: p });
    }
    out[part] = strips;
  }
  return out;
}

// ---------------------------------------------------------------- hull + faces (still drawHull / drawFaces)

function rowAt(A: Pt, B: Pt, x: number): number {
  return Math.round(A[1] + ((B[1] - A[1]) * (x + 0.5 - A[0])) / (B[0] - A[0]) - 0.5);
}

function band(p: PixelCanvas, A: Pt, B: Pt, h: number, colour: (k: number) => Color, lead = 0): void {
  const [L, R] = A[0] < B[0] ? [A, B] : [B, A];
  for (let x = Math.round(L[0]); x < Math.round(R[0]); x++) {
    const yt = rowAt(L, R, x);
    for (let k = -lead; k < h; k++) p.set(x, yt + k, colour(Math.max(0, k)));
  }
}

const rp = (q: Pt): Pt => [Math.round(q[0]), Math.round(q[1])];
const RIDGE_GAP = 12;

function drawHull(p: PixelCanvas): void {
  const T = CALM_T;
  let depth = SLAB_T;
  let prevInset = 0;
  const tiers: { inset: number; top: number; t: number }[] = [];
  for (const h of HULL) {
    const top = depth + 32 * (h.inset - prevInset);
    tiers.push({ inset: h.inset, top, t: h.t });
    depth = top + h.t;
    prevInset = h.inset;
  }
  const last = tiers[tiers.length - 1];
  const spikeTop = last.top + last.t;
  const lft = rp(gp(G0 + last.inset, GR1 - last.inset, spikeTop));
  const bot = rp(gp(G1 - last.inset, GR1 - last.inset, spikeTop));
  const rgt = rp(gp(G1 - last.inset, G0 + last.inset, spikeTop));
  const apex: Pt = [KEEL_TIP.x, KEEL_TIP.y];
  for (let x = lft[0]; x < bot[0]; x++) {
    const yb = rowAt(lft, apex, x);
    for (let y = rowAt(lft, bot, x) - 2; y <= yb; y++) p.set(x, y, y === yb ? T.hullEdge : T.keelL);
  }
  const ridgeEnd = apex[1] - RIDGE_GAP;
  for (let x = bot[0]; x < rgt[0]; x++) {
    const yb = rowAt(apex, rgt, x);
    for (let y = rowAt(bot, rgt, x) - 2; y <= yb; y++) p.set(x, y, y === yb ? T.hullEdge : x === bot[0] && y < ridgeEnd ? T.keelRidge : T.keelR);
  }
  for (let k = tiers.length - 1; k >= 0; k--) {
    const { inset, top, t } = tiers[k];
    const l = rp(gp(G0 + inset, GR1 - inset, top));
    const b = rp(gp(G1 - inset, GR1 - inset, top));
    const r = rp(gp(G1 - inset, G0 + inset, top));
    const keel = k === tiers.length - 1;
    band(p, l, b, t, () => (keel ? T.keelL : T.hullL), 2);
    band(p, b, r, t, (j) => (keel ? T.keelR : j === 0 ? T.hullRLip : T.hullR), 2);
    if (keel) for (let y = b[1] - 2; y < b[1] + t; y++) p.set(b[0], y, T.keelRidge);
  }
}

function drawFaces(p: PixelCanvas): void {
  const T = CALM_T;
  const n = OUTLINE.length;
  const faces: { a: [number, number]; b: [number, number]; lit: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const a = OUTLINE[i];
    const b = OUTLINE[(i + 1) % n];
    const nx = Math.sign(b[1] - a[1]);
    const ny = -Math.sign(b[0] - a[0]);
    if (nx > 0 || ny > 0) faces.push({ a: [a[0], a[1]], b: [b[0], b[1]], lit: ny > 0 });
  }
  faces.sort((f, g) => f.a[0] + f.a[1] + f.b[0] + f.b[1] - (g.a[0] + g.a[1] + g.b[0] + g.b[1]));
  for (const f of faces) {
    const A = rp(gp(f.a[0], f.a[1]));
    const B = rp(gp(f.b[0], f.b[1]));
    if (f.lit) band(p, A, B, SLAB_T, (k) => (k === SLAB_T - 1 ? T.faceBottom : k === 0 ? T.faceLLip : T.faceL));
    else band(p, A, B, SLAB_T, (k) => (k === SLAB_T - 1 ? T.faceBottom : T.faceR));
  }
}

// ---------------------------------------------------------------- top surface (still topAt)

/** Cell type for the reference-tile copy: 0 bridge, 1 + player * 2 + (pile ? 1 : 0); −1 outside. */
function cellType(col: number, row: number): number {
  if (cellKind(col, row) === 'bridge') return 0;
  const z = zoneAtCell(col, row);
  if (!z) return -1;
  const pile = z.spot !== 'monster' && z.spot !== 'spellTrap';
  return 1 + z.player * 2 + (pile ? 1 : 0);
}

/** topAt() calls of the last build (the costly part: ~2–3 µs each cold). */
let topAtCalls = 0;

interface RefTile {
  kind: Uint8Array;
  color: Int32Array;
}

/** Per grid cell (row * BOARD_COLS + col): its type and the top-left of its 64×32 tile box. */
interface CellTable {
  type: Int8Array;
  bx: Int32Array;
  by: Int32Array;
}

function cellTable(): CellTable {
  const n = BOARD_COLS * BOARD_ROWS;
  const t: CellTable = { type: new Int8Array(n), bx: new Int32Array(n), by: new Int32Array(n) };
  for (let row = 0; row < BOARD_ROWS; row++)
    for (let col = 0; col < BOARD_COLS; col++) {
      const k = row * BOARD_COLS + col;
      const c = isoToScreen(col, row);
      t.type[k] = cellType(col, row);
      t.bx[k] = c.x - 32;
      t.by[k] = c.y - 16;
    }
  return t;
}

/**
 * One reference tile per cell type. Inside the 5×5 grid the still's topAt() depends only on a
 * pixel's place in its 64×32 tile box (its ring: the join, the gap ring with the line's tip points,
 * the zone line, the interior) and on the cell type (bridge / zone of a player, main or pile pad).
 * So one zone tile is classified pixel by pixel through topAt(), and each cell type then asks
 * topAt() once per ring for that type's kind and colour.
 */
function referenceTiles(cells: CellTable): { refs: RefTile[]; own: Int32Array; ring: Uint8Array } {
  const RING: Partial<Record<TopKind, number>> = { join: 1, gap: 2, line: 3, pad: 4, pile: 4 };
  const k0 = cells.type.indexOf(1);
  const ring = new Uint8Array(64 * 32);
  const sample: number[] = [];
  for (let j = 0; j < 32; j++)
    for (let i = 0; i < 64; i++) {
      const x = cells.bx[k0] + i;
      const y = cells.by[k0] + j;
      const g = pixelGrid(x, y);
      if (!inGrid(g.col, g.row)) continue;
      if (Math.floor(g.row + 0.5) * BOARD_COLS + Math.floor(g.col + 0.5) !== k0) continue;
      // the tile is symmetric about both its axes: three quadrants copy the top-left one
      let r = i >= 32 ? ring[j * 64 + (63 - i)] : j >= 16 ? ring[(31 - j) * 64 + i] : 0;
      if (!r) {
        const t = topAt(x, y);
        topAtCalls++;
        r = (t && RING[t.kind]) || 0;
        if (!r) throw new Error(`calm arena: unexpected top kind ${t?.kind} in a zone tile`);
      }
      ring[j * 64 + i] = r;
      if (sample[r] === undefined) sample[r] = j * 64 + i;
    }
  const refs: RefTile[] = [];
  for (let k = 0; k < cells.type.length; k++) {
    const ty = cells.type[k];
    if (ty < 0 || refs[ty]) continue;
    const kindOf = new Uint8Array(5);
    const colorOf = new Int32Array(5);
    for (let r = 1; r <= 4; r++) {
      const o = sample[r];
      const t = topAt(cells.bx[k] + (o % 64), cells.by[k] + Math.floor(o / 64))!;
      topAtCalls++;
      kindOf[r] = TOP_CODE[t.kind];
      colorOf[r] = t.color;
    }
    const ref: RefTile = { kind: new Uint8Array(64 * 32), color: new Int32Array(64 * 32) };
    for (let o = 0; o < 64 * 32; o++) {
      const r = ring[o];
      if (!r) continue;
      ref.kind[o] = kindOf[r];
      ref.color[o] = colorOf[r];
    }
    refs[ty] = ref;
  }
  const own: number[] = [];
  for (let o = 0; o < ring.length; o++) if (ring[o]) own.push(o);
  return { refs, own: Int32Array.from(own), ring };
}

/**
 * The platform top is symmetric under the board's 180° rotation about its centre (320, 160):
 * pixel (x, y) ↔ (639 − x, 319 − y), grid (c, r) ↔ (4 − c, 4 − r) — the outline, the inset trim
 * band, the bridge seams and the podiums all map onto themselves. What a border pixel is (rim /
 * trim / join / border) is therefore the same at both ends; only the colour follows the facing
 * and the side, which swap: the rim's lit / unlit tone (night3 ↔ night2), the trim's player and
 * front / back (P1 front cyan2 ↔ P2 back crim1, P1 back cyan1 ↔ P2 front crim2, neutral night3 ↔
 * night2). The lower half (y ≥ 160) is written from the upper half through this map;
 * tests/view/board-calm.test.ts proves the result identical to the still's drawArena().
 */
const ROT = (() => {
  const c = isoToScreen((BOARD_COLS - 1) / 2, (BOARD_ROWS - 1) / 2);
  return { x: 2 * c.x - 1, y: 2 * c.y - 1, cy: c.y };
})();
const ROTATE_COLOR = new Map<Color, Color>([
  [PAL.night3, PAL.night2],
  [PAL.night2, PAL.night3],
  [PAL.cyan2, PAL.crim1],
  [PAL.crim1, PAL.cyan2],
  [PAL.cyan1, PAL.crim2],
  [PAL.crim2, PAL.cyan1],
  [PAL.stone0, PAL.stone0],
  [PAL.night0, PAL.night0],
]);

function rgbAt(p: PixelCanvas, x: number, y: number): Color {
  const o = (y * p.w + x) * 4;
  return (p.data[o] << 16) | (p.data[o + 1] << 8) | p.data[o + 2];
}

/**
 * Along a straight outline edge the border band (rim, trim, plain border) is the same pattern
 * shifted one grid step of 1/16 tile: (+2, −1) px along a constant-col edge, (−2, −1) px along a
 * constant-row edge — both one row up, so already drawn when the rows run top-down. Returns that
 * x offset (+2 / −2) for a pixel near an edge and at least EDGE_M tiles from every corner, bridge
 * seam and podium joint (where the pattern changes), else 0 (the pixel asks topAt()).
 */
const EDGE_M = 7 / 32;
const EDGE_NEAR = 6 / 32;
function edgeStep(c: number, r: number): number {
  // constant-col edges (the slab's side edges, the podiums' sides): step along the row (r − 1/16)
  const rq = r - 1 / 16;
  if ((near(c, G0) || near(c, G1)) && inRuns(r, SIDE_ROWS) && inRuns(rq, SIDE_ROWS)) return 2;
  if ((near(c, 1.25) || near(c, 2.75)) && inRuns(r, PODIUM_ROWS) && inRuns(rq, PODIUM_ROWS)) return 2;
  // constant-row edges (front / back edges, the podiums' far edges): step along the col (c − 1/16)
  const cq = c - 1 / 16;
  if ((near(r, G0) || near(r, G1)) && inRuns(c, EDGE_COLS) && inRuns(cq, EDGE_COLS)) return -2;
  if ((near(r, 6) || near(r, -2)) && inRuns(c, PODIUM_COLS) && inRuns(cq, PODIUM_COLS)) return -2;
  return 0;
}
function near(v: number, e: number): boolean {
  return Math.abs(v - e) <= EDGE_NEAR;
}
function inRuns(v: number, runs: readonly (readonly [number, number])[]): boolean {
  for (const [a, b] of runs) if (v >= a + EDGE_M && v <= b - EDGE_M) return true;
  return false;
}
/** Runs of the straight edges between corners, seams and podium joints (grid units). */
const SIDE_ROWS = [
  [G0, 1.5],
  [1.5, 2.5],
  [2.5, G1],
] as const;
const EDGE_COLS = [
  [G0, 1.25],
  [2.75, G1],
] as const;
const PODIUM_ROWS = [
  [G1, 6],
  [-2, G0],
] as const;
const PODIUM_COLS = [[1.25, 2.75]] as const;

/**
 * True for a border pixel (inside the outline, off the grid) that is provably plain border: more
 * than 5 px (grid 5/32) from every outline edge — the rim lies within 1 px of an edge and the trim
 * between 3 and 4 px — and 2+ px from the bridge seam rows. A cheap lower bound of the still's
 * outlineDist (the distance to the slab square's sides, or across a podium's opening to the
 * podium's sides and far edge — no outline edge is nearer), so only pixels near a feature pay for
 * a topAt() call.
 */
function plainBorder(c: number, r: number): boolean {
  if (Math.abs(r - 1.5) * 32 < 2 || Math.abs(r - 2.5) * 32 < 2) return false;
  // across a podium's opening the nearest edges are the podium's sides and far edge
  const pod = c >= 1.25 && c <= 2.75 ? Math.min(c - 1.25, 2.75 - c) : -1;
  let lb: number;
  if (r >= G0 && r <= G1) {
    const back = pod >= 0 ? Math.min(pod, r + 2) : r - G0;
    const front = pod >= 0 ? Math.min(pod, 6 - r) : G1 - r;
    lb = Math.min(c - G0, G1 - c, back, front);
  } else lb = Math.min(c - 1.25, 2.75 - c, r > G1 ? 6 - r : r + 2);
  return lb * 32 > 5;
}

/**
 * The still's drawTop(): every platform-top pixel, through topAt() or its reference-tile copy.
 * Fills `kinds` (frame pixels) and returns the trim pixels as [x, y, colour] triples.
 */
function drawTop(p: PixelCanvas, kinds: Uint8Array, ms: Record<string, number>): { trims: number[]; ring: Uint8Array } {
  if (ZONES5) return drawTopGeneric(p, kinds, ms);
  const t0 = performance.now();
  const cells = cellTable();
  const { refs, own, ring } = referenceTiles(cells);
  const t1 = performance.now();
  const trims: number[] = [];
  const out = new Uint32Array(p.data.buffer);
  const abgr = (c: Color) => 0xff000000 | ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff);
  const le = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
  const put = (x: number, y: number, color: Color, code: number) => {
    if (x < 0 || y < 0 || x >= p.w || y >= p.h) return;
    if (le) out[y * p.w + x] = abgr(color);
    else p.set(x, y, color);
    kinds[y * GAME_W + x] = code;
  };
  // the 5×5 grid: every cell is its type's reference tile (its own pixels only)
  for (let k = 0; k < cells.type.length; k++) {
    const ref = refs[cells.type[k]];
    if (!ref) continue;
    for (const o of own) put(cells.bx[k] + (o & 63), cells.by[k] + (o >> 6), ref.color[o], ref.kind[o]);
  }
  const t2 = performance.now();
  // the border band around it, row by row over the upper half (the grid's inner span is skipped)
  const corners = OUTLINE.map(([c, r]) => gp(c, r));
  const minX = Math.floor(Math.min(...corners.map((q) => q[0])));
  const maxX = Math.ceil(Math.max(...corners.map((q) => q[0])));
  const minY = Math.floor(Math.min(...corners.map((q) => q[1])));
  const band: number[] = [];
  for (let y = minY; y < ROT.cy; y++) {
    const [xa, xb] = rowSpan(y, OUTLINE_RECTS);
    const [ia, ib] = rowSpan(y, GRID_RECT);
    for (let x = Math.max(minX, Math.floor(xa) - 2); x <= Math.min(maxX, Math.ceil(xb) + 2); x++) {
      if (x > ia + 2 && x < ib - 2) continue;
      const g = pixelGrid(x, y);
      if (!insideOutline(g.col, g.row) || inGrid(g.col, g.row)) continue;
      let code: number;
      let color: Color;
      const plain = plainBorder(g.col, g.row);
      const step = plain ? 0 : edgeStep(g.col, g.row);
      const e = step ? (y - 1) * GAME_W + x + step : -1;
      if (plain) {
        code = TOP_CODE.border;
        color = CALM_T.border;
      } else if (e >= 0 && kinds[e]) {
        // along a straight edge the band repeats every (2 px, 1 row): copy the pixel one step back
        code = kinds[e];
        color = rgbAt(p, x + step, y - 1);
      } else {
        const t = topAt(x, y);
        topAtCalls++;
        if (!t) continue;
        code = TOP_CODE[t.kind];
        color = t.color;
      }
      put(x, y, color, code);
      band.push(x, y);
    }
  }
  // the lower half is the upper half rotated about the board centre (see ROTATE_COLOR)
  for (let k = 0; k < band.length; k += 2) {
    const x = band[k];
    const y = band[k + 1];
    const color = ROTATE_COLOR.get(rgbAt(p, x, y));
    if (color === undefined) throw new Error(`calm arena: no rotated colour for (${x}, ${y})`);
    const code = kinds[y * GAME_W + x];
    put(ROT.x - x, ROT.y - y, color, code);
    if (code === TOP_CODE.trim) trims.push(x, y, rgbAt(p, x, y), ROT.x - x, ROT.y - y, color);
  }
  const r = (v: number) => Math.round(v * 10) / 10;
  ms.topRefs = r(t1 - t0);
  ms.topGrid = r(t2 - t1);
  ms.topBand = r(performance.now() - t2);
  return { trims, ring };
}

/**
 * zones5 (7×5 grid): the fast path above relies on a 5×5 grid's repeats and on its 180° symmetry
 * tables, so a 7-column board runs the still's own topAt() over every pixel of the platform top
 * (one-off ~100 ms, only with ?zones=5). Same outputs: `kinds`, the trim pixel triples, the ring.
 */
function drawTopGeneric(p: PixelCanvas, kinds: Uint8Array, ms: Record<string, number>): { trims: number[]; ring: Uint8Array } {
  const t0 = performance.now();
  const { ring } = referenceTiles(cellTable());
  const t1 = performance.now();
  const trims: number[] = [];
  const corners = OUTLINE.map(([c, r]) => gp(c, r));
  const minX = Math.floor(Math.min(...corners.map((q) => q[0])));
  const maxX = Math.ceil(Math.max(...corners.map((q) => q[0])));
  const minY = Math.floor(Math.min(...corners.map((q) => q[1])));
  const maxY = Math.ceil(Math.max(...corners.map((q) => q[1])));
  for (let y = Math.max(0, minY); y <= Math.min(p.h - 1, maxY); y++)
    for (let x = Math.max(0, minX); x <= Math.min(p.w - 1, maxX); x++) {
      const t = topAt(x, y);
      topAtCalls++;
      if (!t) continue;
      p.set(x, y, t.color);
      kinds[y * GAME_W + x] = TOP_CODE[t.kind];
      if (t.kind === 'trim') trims.push(x, y, t.color);
    }
  ms.topRefs = Math.round((t1 - t0) * 10) / 10;
  ms.topGrid = 0;
  ms.topBand = Math.round((performance.now() - t1) * 10) / 10;
  return { trims, ring };
}

const OUTLINE_RECTS: [number, number, number, number][] = [
  [G0, G1, G0, G1],
  [1.25, 2.75, G1, 6],
  [1.25, 2.75, -2, G0],
];
const GRID_RECT: [number, number, number, number][] = [[-0.5, BOARD_COLS - 0.5, -0.5, BOARD_ROWS - 0.5]];

/**
 * Screen x span [a, b] (real-valued, unrounded) of pixel row y covered by the union of grid
 * rectangles [c0, c1] × [r0, r1], solved along the row (grid col / row are linear in x there).
 * Callers widen it by a margin and still run the exact tests on every pixel they visit.
 */
function rowSpan(y: number, rects: [number, number, number, number][]): [number, number] {
  const g0 = pixelGrid(0, y);
  const g1 = pixelGrid(1, y);
  const dc = g1.col - g0.col;
  const dr = g1.row - g0.row;
  let a = Infinity;
  let b = -Infinity;
  for (const [c0, c1, r0, r1] of rects) {
    const xc0 = (c0 - g0.col) / dc;
    const xc1 = (c1 - g0.col) / dc;
    const xr0 = (r0 - g0.row) / dr;
    const xr1 = (r1 - g0.row) / dr;
    const lo = Math.max(Math.min(xc0, xc1), Math.min(xr0, xr1));
    const hi = Math.min(Math.max(xc0, xc1), Math.max(xr0, xr1));
    if (hi >= lo) {
      a = Math.min(a, lo);
      b = Math.max(b, hi);
    }
  }
  return [a, b];
}

// ---------------------------------------------------------------- zone masks + pads

/**
 * The shared zone masks from the reference tile's rings (1 join, 2 gap ring, 3 zone line,
 * 4 interior — the zone's own pixels only; the corners of its 64×32 box belong to its neighbours).
 */
function zoneMasks(ring: Uint8Array): CalmArt['masks'] & { linePath: CalmArt['linePath'] } {
  const fill = new PixelCanvas(64, 32);
  const line = new PixelCanvas(64, 32);
  const tile = new PixelCanvas(64, 32);
  const linePath: { x: number; y: number; a: number }[] = [];
  for (let j = 0; j < 32; j++)
    for (let i = 0; i < 64; i++) {
      const r = ring[j * 64 + i];
      if (r === 4) fill.set(i, j, 0xffffff);
      if (r === 3) {
        line.set(i, j, 0xffffff);
        // clockwise from the top tip (screen y down; the 2:1 diamond made round)
        linePath.push({ x: i, y: j, a: Math.atan2(i + 0.5 - 32, -(j + 0.5 - 16) * 2) });
      }
      if (r >= 2) tile.set(i, j, 0xffffff);
    }
  linePath.sort((a, b) => ((a.a + 2 * Math.PI) % (2 * Math.PI)) - ((b.a + 2 * Math.PI) % (2 * Math.PI)));
  return { fill, line, tile, linePath: linePath.map(({ x, y }) => ({ x, y })) };
}

const ZONES: [BoardSpot, number][] = [
  ['monster', LANES],
  ['spellTrap', LANES],
  ['field', 1],
  ['graveyard', 1],
  ['deck', 1],
  ['banish', 1],
];

/** Every zone of the board. */
export function calmZones(): { player: PlayerId; spot: BoardSpot; index: number }[] {
  const out: { player: PlayerId; spot: BoardSpot; index: number }[] = [];
  for (const player of [0, 1] as PlayerId[]) for (const [spot, n] of ZONES) for (let index = 0; index < n; index++) out.push({ player, spot, index });
  return out;
}

function zonePads(slab: PixelCanvas, tileMask: PixelCanvas): Map<string, CalmLayer> {
  const out = new Map<string, CalmLayer>();
  const src = new Uint32Array(slab.data.buffer);
  const m = tileMask.data;
  for (const z of calmZones()) {
    const cell = zoneCell(z.player, z.spot, z.index);
    const c = isoToScreen(cell.col, cell.row);
    const p = new PixelCanvas(64, 32);
    const dst = new Uint32Array(p.data.buffer);
    for (let j = 0; j < 32; j++)
      for (let i = 0; i < 64; i++) if (m[(j * 64 + i) * 4 + 3]) dst[j * 64 + i] = src[(c.y - 16 + j) * slab.w + c.x - 32 + i];
    out.set(`${z.player}:${z.spot}:${z.index}`, { x: c.x - 32, y: c.y - 16, canvas: p });
  }
  return out;
}

// ---------------------------------------------------------------- trims

/** The still's trim colours → (side, back). */
function trimClass(color: Color): { side: TrimSide; back: boolean } | null {
  for (const side of [0, 1, 2] as TrimSide[]) {
    if (color === CALM_T.trim[side]) return { side, back: false };
    if (color === CALM_T.trimBack[side]) return { side, back: true };
  }
  return null;
}

type TrimPxT = { x: number; y: number; tone: Color };

/**
 * Order a 1-px trim strip by walking it (4-neighbours first, then diagonals) from the pixel nearest
 * `start`. Every pixel of a connected strip is visited exactly once.
 */
function walkStrip(px: TrimPxT[], start: { x: number; y: number }): TrimPxT[] {
  const at = new Map<number, TrimPxT>();
  const key = (x: number, y: number) => y * 4096 + x;
  for (const q of px) at.set(key(q.x, q.y), q);
  let cur = px[0];
  let best = Infinity;
  for (const q of px) {
    const d = (q.x - start.x) ** 2 + (q.y - start.y) ** 2;
    if (d < best) {
      best = d;
      cur = q;
    }
  }
  const out: TrimPxT[] = [];
  const seen = new Set<number>();
  const N4 = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const N8 = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  for (;;) {
    out.push(cur);
    seen.add(key(cur.x, cur.y));
    let next: TrimPxT | undefined;
    for (const [dx, dy] of N4.concat(N8)) {
      const k = key(cur.x + dx, cur.y + dy);
      if (seen.has(k)) continue;
      next = at.get(k);
      if (next) break;
    }
    if (!next) break;
    cur = next;
  }
  if (out.length !== px.length) throw new Error(`calm arena: trim strip walk reached ${out.length} of ${px.length} px`);
  return out;
}

/** Screen point of grid (c, r). */
const scr = (c: number, r: number) => isoToScreen(c, r);

/**
 * Where each side's strip starts: P1 at the bridge seam on the right (front) edge, round the front
 * past its podium to the left edge's seam; P2 at the seam on the left (back) edge, round the back
 * past its podium to the right edge. The neutral pieces start at their upper seam.
 */
const STRIP_START = {
  0: scr(G1, 2.5),
  1: scr(G0, 1.5),
  left: scr(G0, 2.5),
  right: scr(G1, 1.5),
} as const;
/** Podium outer edge midpoints (pulses and the ignition start there). */
const PODIUM_XY: Record<0 | 1, { x: number; y: number }> = { 0: scr(BOARD_MID_COL, 6), 1: scr(BOARD_MID_COL, -2) };

function trimPieces(list: number[]): { trims: TrimPiece[]; paths: CalmArt['paths'] } {
  const bySide: TrimPxT[][] = [[], [], []];
  for (let k = 0; k < list.length; k += 3) {
    const cls = trimClass(list[k + 2]);
    if (!cls) throw new Error(`calm arena: unknown trim colour at (${list[k]}, ${list[k + 1]})`);
    bySide[cls.side].push({ x: list[k], y: list[k + 1], tone: list[k + 2] });
  }
  const trims: TrimPiece[] = [];
  /** Cut an ordered strip into straight runs (constant tone, monotonic x) → pieces. */
  const cut = (side: TrimSide, strip: (TrimPxT & { s: number })[]) => {
    let run: (TrimPxT & { s: number })[] = [];
    let dir = 0;
    const flush = () => {
      if (!run.length) return;
      const xs = run.map((q) => q.x);
      const ys = run.map((q) => q.y);
      const x0 = Math.min(...xs);
      const y0 = Math.min(...ys);
      const p = new PixelCanvas(Math.max(...xs) - x0 + 1, Math.max(...ys) - y0 + 1);
      for (const q of run) p.set(q.x - x0, q.y - y0, 0xffffff);
      const back = trimClass(run[0].tone)!.back;
      trims.push({ n: trims.length, side, back, layer: { x: x0, y: y0, canvas: p }, px: run.map(({ x, y, s }) => ({ x, y, s })), dirX: dir < 0 ? -1 : 1 });
      run = [];
      dir = 0;
    };
    for (const q of strip) {
      const prev = run[run.length - 1];
      if (prev) {
        const dx = Math.sign(q.x - prev.x);
        if (q.tone !== prev.tone || (dx !== 0 && dir !== 0 && dx !== dir)) flush();
        else if (dx !== 0) dir = dx;
      }
      run.push(q);
    }
    flush();
  };
  const paths = {} as CalmArt['paths'];
  for (const side of [0, 1] as const) {
    const strip = walkStrip(bySide[side], STRIP_START[side]).map((q, i) => ({ ...q, s: i }));
    let podium = 0;
    let best = Infinity;
    for (const q of strip) {
      const d = (q.x - PODIUM_XY[side].x) ** 2 + (q.y - PODIUM_XY[side].y) ** 2;
      if (d < best) {
        best = d;
        podium = q.s;
      }
    }
    paths[side] = { len: strip.length, podium, px: strip };
    cut(side, strip);
  }
  // the neutral band: one short strip on each side edge
  const left = bySide[2].filter((q) => q.x < 320);
  const right = bySide[2].filter((q) => q.x >= 320);
  if (left.length) cut(2, walkStrip(left, STRIP_START.left).map((q, i) => ({ ...q, s: i })));
  if (right.length) cut(2, walkStrip(right, STRIP_START.right).map((q, i) => ({ ...q, s: i })));
  return { trims, paths };
}

// ---------------------------------------------------------------- highlight chevrons

/** Corner chevrons cut from a 64×32 diamond's outer ring (so they run parallel to the tile edges). */
function chevrons(): CalmArt['tips'] {
  const ring = (i: number, j: number) => {
    const dv = 16 - (Math.abs(i + 0.5 - 32) / 2 + Math.abs(j + 0.5 - 16));
    return dv >= 0 && dv < 1;
  };
  // top: the ring's top 5 rows (x 23..40)
  const t = new PixelCanvas(18, 5);
  for (let j = 0; j < 5; j++) for (let i = 23; i <= 40; i++) if (ring(i, j)) t.set(i - 23, j, 0xffffff);
  // left: the ring's left 9 columns (rows 11..20)
  const l = new PixelCanvas(9, 10);
  for (let j = 11; j <= 20; j++) for (let i = 0; i < 9; i++) if (ring(i, j)) l.set(i, j - 11, 0xffffff);
  return { t, l };
}

/** Top-left of the chevrons around a zone centred at (cx, cy), `d` px out from the tile edge (2:1 for left / right). */
export function chevronPositions(cx: number, cy: number, d: number): { t: { x: number; y: number }; b: { x: number; y: number }; l: { x: number; y: number }; r: { x: number; y: number } } {
  return {
    t: { x: cx - 9, y: cy - 16 - d },
    b: { x: cx - 9, y: cy + 16 - 5 + d },
    l: { x: cx - 32 - 2 * d, y: cy - 5 },
    r: { x: cx + 32 - 9 + 2 * d, y: cy - 5 },
  };
}

// ---------------------------------------------------------------- build

let cached: CalmArt | null = null;

/** Build (once) every calm arena layer. */
export function buildCalmArt(): CalmArt {
  if (cached) return cached;
  const ms: Record<string, number> = {};
  const T0 = performance.now();
  let t = T0;
  const lap = (name: string) => {
    const now = performance.now();
    ms[name] = Math.round((now - t) * 10) / 10;
    t = now;
  };

  const runs = backgroundRuns(BG_RECT);
  lap('bgRuns');
  const bg = maskLayers(runs);
  const bgList: [string, PixelCanvas][] = [];
  for (const part of CALM_BG_PARTS) bg[part].forEach((L, i) => bgList.push([CALM.bgFrame(part, i), L.canvas]));
  const bgAtlas = packAtlas(bgList, 1024);
  lap('bgMasks');

  const full = new PixelCanvas(GAME_W, GAME_H);
  const kinds = new Uint8Array(GAME_W * GAME_H);
  drawHull(full);
  drawFaces(full);
  lap('hull+faces');
  const { trims: trimList, ring } = drawTop(full, kinds, ms);
  lap('top');
  // the slab lies inside the outline's x range, from its top tip down to the keel's point
  const xs = OUTLINE.map(([c, r]) => gp(c, r)[0]);
  const slab = cropOpaque(full, { x0: Math.floor(Math.min(...xs)) - 2, y0: Math.floor(gp(G0, G0)[1]) - 2, x1: Math.ceil(Math.max(...xs)) + 2, y1: KEEL_TIP.y + 2 });

  const zm = zoneMasks(ring);
  const pads = zonePads(full, zm.tile);
  const { trims, paths } = trimPieces(trimList);
  const tips = chevrons();
  const small: [string, PixelCanvas][] = [];
  for (const z of calmZones()) small.push([CALM.pad(z.player, z.spot, z.index), pads.get(`${z.player}:${z.spot}:${z.index}`)!.canvas]);
  small.push([CALM.maskFill, zm.fill], [CALM.maskLine, zm.line], [CALM.maskTile, zm.tile], [CALM.tipT, tips.t], [CALM.tipL, tips.l]);
  for (const tr of trims) small.push([CALM.trim(tr.n), tr.layer.canvas]);
  const atlas = packAtlas(small);
  lap('pads+trims');
  ms.total = Math.round((performance.now() - T0) * 10) / 10;
  ms.topAtCalls = topAtCalls;
  cached = { bg, bgAtlas, slab, pads, masks: { fill: zm.fill, line: zm.line, tile: zm.tile }, linePath: zm.linePath, trims, paths, tips, atlas, kinds, ms };
  return cached;
}

/** The still look's colour (background + slab) of a world pixel. */
export function calmColorAt(a: CalmArt, x: number, y: number): Color {
  const s = a.slab;
  const c = s.canvas.get(x - s.x, y - s.y);
  return c ?? backgroundColor(x, y);
}

/** Crop a canvas to its opaque bounds inside `area` (typed-array scan + row copies). */
function cropOpaque(p: PixelCanvas, area: { x0: number; y0: number; x1: number; y1: number }): CalmLayer {
  const d = new Uint32Array(p.data.buffer);
  let x0 = p.w;
  let y0 = p.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = Math.max(0, area.y0); y <= Math.min(p.h - 1, area.y1); y++) {
    const row = y * p.w;
    for (let x = Math.max(0, area.x0); x <= Math.min(p.w - 1, area.x1); x++) {
      if (d[row + x] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      y1 = y;
    }
  }
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const out = new PixelCanvas(w, h);
  for (let j = 0; j < h; j++) {
    const src = ((y0 + j) * p.w + x0) * 4;
    out.data.set(p.data.subarray(src, src + w * 4), j * w * 4);
  }
  return { x: x0, y: y0, canvas: out };
}

/** Shelf-pack named canvases into one atlas (1-px gutters; NEAREST sampling never bleeds). */
function packAtlas(list: [string, PixelCanvas][], W = 512): CalmArt['atlas'] {
  const sorted = [...list].sort((a, b) => b[1].h - a[1].h);
  const rects = new Map<string, { x: number; y: number; w: number; h: number }>();
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const [name, p] of sorted) {
    if (x + p.w > W) {
      x = 0;
      y += rowH + 1;
      rowH = 0;
    }
    rects.set(name, { x, y, w: p.w, h: p.h });
    x += p.w + 1;
    rowH = Math.max(rowH, p.h);
  }
  const canvas = new PixelCanvas(W, y + rowH);
  for (const [name, p] of list) {
    const r = rects.get(name)!;
    for (let j = 0; j < p.h; j++) canvas.data.set(p.data.subarray(j * p.w * 4, (j + 1) * p.w * 4), ((r.y + j) * W + r.x) * 4);
  }
  return { canvas, frames: rects };
}

/** Bytes of RGBA texture memory the calm layers take (background masks, slab, atlas). */
export function calmTextureBytes(a: CalmArt): number {
  let n = 0;
  const add = (p: PixelCanvas) => (n += p.w * p.h * 4);
  add(a.bgAtlas.canvas);
  add(a.slab.canvas);
  add(a.atlas.canvas);
  return n;
}
