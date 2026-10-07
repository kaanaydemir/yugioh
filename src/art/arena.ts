// Arena art — the night stadium, the floating duel platform and its zone tiles.
//
// Everything is drawn in code with PixelCanvas at boot (src/boot/15-arena.ts) and animated by
// src/view/BoardView.ts. Big layers are drawn in WORLD pixel coordinates; each layer's texture
// covers a rect (SKY, STADIUM, SLAB, ...) that is a little larger than the screen so camera
// shake, zoom and parallax never reveal an edge.
//
// Layer stack (back → front): sky (+aurora / volcano smoke, stars, searchlight beams) → stadium
// (stands, crowd lights, light towers, LED ribbon, fog) → under-platform glow → slab (faces,
// hull, podiums) + neon trim → zone tiles + energy bridge → lava cracks (volcano) → tile FX.

import type Phaser from 'phaser';
import type { PlayerId } from '../engine/types';
import { BOARD_COLS, BOARD_ROWS, type BoardSpot, duelistXY, isoToScreen, screenToIso } from '../view/layout';
import { PAL, RAMPS, type Ramp } from './palette';
import { type Color, PixelCanvas, mix, mulberry32 } from './pixel';
import { canvasTexture, sheetTexture } from './textures';

// ---------------------------------------------------------------- keys & rects

export type ArenaTheme = 'normal' | 'volcano';
/** Trim classes: 0 = player 1 half, 1 = player 2 half, 2 = neutral (the no-man's-land band). */
export type TrimClass = 0 | 1 | 2;

export const AK = {
  sky: 'arena:sky',
  skyHot: 'arena:sky:hot',
  aurora: (i: number) => `arena:aurora:${i}`,
  smoke: 'arena:smoke',
  star: 'arena:star', // sheet, frames '0'..'3' (dot → big cross)
  beam: 'arena:beam',
  glow: 'arena:glow', // 48×48 soft radial glow (white, for ADD)
  dot: 'arena:dot', // 9×9 soft dot (white, for ADD)
  mote: 'arena:mote', // 3×3 plus-shaped mote
  stadium: 'arena:stadium',
  stadiumHot: 'arena:stadium:hot',
  rimCool: 'arena:rim:cool',
  rimHot: 'arena:rim:hot',
  haze: 'arena:haze',
  crowd: (i: number) => `arena:crowd:${i}`,
  led: (i: number) => `arena:led:${i}`,
  lamp: 'arena:lamp', // lit floodlight bank
  fog: (i: number) => `arena:fog:${i}`,
  slab: 'arena:slab',
  trim: (hot: boolean, cls: TrimClass) => `arena:trim:${hot ? 'hot' : 'cool'}:${cls}`,
  under: (hot: boolean) => `arena:under:${hot ? 'hot' : 'cool'}`,
  coreBeam: 'arena:corebeam',
  shaft: 'arena:shaft',
  ringFx: 'arena:ringfx', // sheet, frames '0'..'7' (growing ellipse ring)
  tile: (spot: BoardSpot, player: PlayerId) => `arena:tile:${spot}:${player}`,
  tileGlow: (spot: BoardSpot) => `arena:tileglow:${spot}`,
  bridge: 'arena:bridge',
  bridgeFlow: 'arena:bridge:flow', // sheet, frames '0'..'15'
  hlOutline: 'arena:hl:outline',
  hlMarch: 'arena:hl:march', // sheet, frames '0'..'15'
  hlTipT: 'arena:hl:tipT',
  hlTipL: 'arena:hl:tipL',
  tileFill: 'arena:tile:fill',
} as const;

export interface WorldRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Sky covers well above the screen so a camera descending from the sky (gameStart) has stars to show. */
export const SKY_RECT: WorldRect = { x: -48, y: -232, w: 736, h: 660 };
export const STADIUM_RECT: WorldRect = { x: -64, y: -40, w: 768, h: 460 };
export const SLAB_RECT: WorldRect = { x: 96, y: 40, w: 448, h: 288 };
export const BRIDGE_RECT: WorldRect = { x: 224, y: 112, w: 192, h: 96 };
export const AURORA_SIZE = { w: 320, h: 120 };
export const SMOKE_SIZE = { w: 320, h: 150 };
export const FOG_SIZE = [
  { w: 320, h: 48 }, // 0: far haze at the stadium floor
  { w: 320, h: 72 }, // 1: under the platform
  { w: 320, h: 56 }, // 2: near, bottom of the screen
] as const;
export const BEAM_LEN = 300;
export const HL_W = 72; // highlight textures are the 64×32 tile plus a 4px halo
export const HL_H = 40;
export const FLOW_FRAMES = 16;
export const MARCH_FRAMES = 16;
export const RING_FRAMES = 8;
export const RING_W = 136;
export const RING_H = 72;

/** Slab geometry (grid units / pixels). The slab extends SLAB_E tiles beyond the 5×5 grid. */
export const SLAB_E = 0.375;
export const SLAB_T = 14; // face thickness
const G0 = -0.5 - SLAB_E; // -0.875
const G1 = BOARD_COLS - 0.5 + SLAB_E; // 4.875

/** Union outline of the platform top (slab + the two duelist podiums), in grid (col,row). CCW. */
const OUTLINE: readonly [number, number][] = [
  [G0, G0],
  [1.25, G0],
  [1.25, -2.0],
  [2.75, -2.0],
  [2.75, G0],
  [G1, G0],
  [G1, G1],
  [2.75, G1],
  [2.75, 6.0],
  [1.25, 6.0],
  [1.25, G1],
  [G0, G1],
];

/** Hull tiers under the slab (inset in tiles, face height px). */
const HULL = [
  { inset: 0.45, t: 9 },
  { inset: 1.05, t: 7 },
] as const;
/** Anti-gravity thruster points under the first hull tier (world px) with their trim class. */
export const THRUSTERS: { x: number; y: number; cls: TrimClass }[] = (() => {
  const top = SLAB_T + 32 * HULL[0].inset;
  const c0 = -0.5 - SLAB_E + HULL[0].inset;
  const c1 = BOARD_COLS - 0.5 + SLAB_E - HULL[0].inset;
  const out: { x: number; y: number; cls: TrimClass }[] = [];
  for (const k of [0.2, 0.55, 0.85]) {
    const a = isoToScreen(lerp(c0, c1, k), c1);
    out.push({ x: Math.round(a.x), y: Math.round(a.y + top + HULL[0].t), cls: 0 });
    const r = lerp(c1, c0, k);
    const b = isoToScreen(c1, r);
    out.push({ x: Math.round(b.x), y: Math.round(b.y + top + HULL[0].t), cls: r > 2.5 ? 0 : r < 1.5 ? 1 : 2 });
  }
  return out;
})();

/** World position of the energy crystal at the tip of the hull (the platform's "engine"). */
export const CORE_XY = (() => {
  let depth = SLAB_T;
  let prev = 0;
  for (const h of HULL) {
    depth += 32 * (h.inset - prev) + h.t;
    prev = h.inset;
  }
  const c = BOARD_COLS - 0.5 + SLAB_E - prev;
  const s = isoToScreen(c, c);
  return { x: Math.round(s.x), y: Math.round(s.y + depth + 28) };
})();

// ---------------------------------------------------------------- stadium geometry (world px)

/** Top of the stadium roof rim at screen x (an ellipse arc peaking behind the platform). */
export function rimY(x: number): number {
  const u = (x - 320) / 440;
  return 220 - 140 * Math.sqrt(Math.max(0, 1 - u * u));
}
/** Bottom of the stands (top of the inner wall) at screen x. */
export function standsBottomY(x: number): number {
  const u = (x - 320) / 380;
  return 238 - 106 * Math.sqrt(Math.max(0, 1 - u * u));
}
const WALL_H = 11;

export interface Tower {
  x: number;
  /** y of the lamp bank's center */
  lampY: number;
  baseY: number;
  /** searchlight beam: base angle (rad, 0 = right, negative = up), sweep amplitude, period ms, tint */
  beam: { angle: number; amp: number; period: number; phase: number; tint: number } | null;
}

export const TOWERS: Tower[] = (
  [
    [-30, 46, null],
    [58, 52, { angle: -2.3, amp: 0.34, period: 9800, phase: 0.1, tint: PAL.cyan4 }],
    [146, 56, { angle: -0.98, amp: 0.38, period: 12400, phase: 0.55, tint: PAL.white }],
    [232, 58, { angle: -2.05, amp: 0.3, period: 11000, phase: 0.3, tint: PAL.cyan3 }],
    [408, 58, { angle: -1.1, amp: 0.3, period: 11800, phase: 0.8, tint: PAL.crim3 }],
    [494, 56, { angle: -2.16, amp: 0.38, period: 13100, phase: 0.2, tint: PAL.white }],
    [582, 52, { angle: -0.84, amp: 0.34, period: 10300, phase: 0.65, tint: PAL.crim4 }],
    [670, 46, null],
  ] as [number, number, Tower['beam']][]
).map(([x, h, beam]) => {
  const baseY = Math.round(rimY(x)) - 4;
  return { x, baseY, lampY: baseY - h, beam };
});

// ---------------------------------------------------------------- zone ↔ cell

export interface ZoneHit {
  player: PlayerId;
  spot: BoardSpot;
  index: number;
}

/** Which zone a grid cell is (null for the no-man's-land row and outside the grid). */
export function cellZone(col: number, row: number): ZoneHit | null {
  if (col < 0 || row < 0 || col >= BOARD_COLS || row >= BOARD_ROWS || row === 2) return null;
  const player: PlayerId = row >= 3 ? 0 : 1;
  const c = player === 0 ? col : BOARD_COLS - 1 - col;
  const r = player === 0 ? row : BOARD_ROWS - 1 - row;
  if (r === 3) {
    if (c === 0) return { player, spot: 'field', index: 0 };
    if (c === 4) return { player, spot: 'graveyard', index: 0 };
    return { player, spot: 'monster', index: c - 1 };
  }
  if (c === 0) return { player, spot: 'banish', index: 0 };
  if (c === 4) return { player, spot: 'deck', index: 0 };
  return { player, spot: 'spellTrap', index: c - 1 };
}

/** Trim class of a point on the platform from its grid row. */
export function rowClass(row: number): TrimClass {
  return row > 2.5 ? 0 : row < 1.5 ? 1 : 2;
}

// ---------------------------------------------------------------- small helpers

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function bayer(x: number, y: number): number {
  return BAYER4[(y & 3) * 4 + (x & 3)];
}
/** Pick between colors[i] and colors[i+1] by ordered dither; v is a continuous index into colors. */
function dpick(colors: readonly Color[], v: number, x: number, y: number): Color {
  const n = colors.length - 1;
  if (v <= 0) return colors[0];
  if (v >= n) return colors[n];
  const i = Math.floor(v);
  return bayer(x, y) < (v - i) * 16 ? colors[i + 1] : colors[i];
}
/** Flat color bands with short dithered transitions (classic pixel-art gradient). w = transition width 0..1. */
function bandify(v: number, w: number): number {
  const i = Math.floor(v);
  const f = v - i;
  return i + clamp01((f - (1 - w) / 2) / w);
}
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
/** Piecewise-linear lookup over sorted [x, y] keys. */
function curve(keys: readonly [number, number][], x: number): number {
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (x <= keys[i][0]) {
      const [x0, y0] = keys[i - 1];
      const [x1, y1] = keys[i];
      return lerp(y0, y1, (x - x0) / (x1 - x0));
    }
  }
  return keys[keys.length - 1][1];
}

/** Tileable value noise in [0,1] (periodic over w×h). */
export function periodicNoise(w: number, h: number, cellsX: number, cellsY: number, seed: number, octaves = 3): Float32Array {
  const out = new Float32Array(w * h);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const cx = cellsX << o;
    const cy = cellsY << o;
    const rnd = mulberry32(seed * 7919 + o * 104729);
    const grid = new Float32Array(cx * cy);
    for (let i = 0; i < grid.length; i++) grid[i] = rnd();
    const g = (i: number, j: number) => grid[(((j % cy) + cy) % cy) * cx + (((i % cx) + cx) % cx)];
    for (let y = 0; y < h; y++) {
      const fy = (y / h) * cy;
      const y0 = Math.floor(fy);
      const ty = smooth(fy - y0);
      for (let x = 0; x < w; x++) {
        const fx = (x / w) * cx;
        const x0 = Math.floor(fx);
        const tx = smooth(fx - x0);
        const v = lerp(lerp(g(x0, y0), g(x0 + 1, y0), tx), lerp(g(x0, y0 + 1), g(x0 + 1, y0 + 1), tx), ty);
        out[y * w + x] += v * amp;
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/**
 * Smooth noise for big canvases: computed on a grid `k`× coarser, bilinearly upsampled.
 * (Value noise is smooth anyway; this keeps boot time low for the 700px sky/stadium layers.)
 */
function coarseNoise(w: number, h: number, cellsX: number, cellsY: number, seed: number, octaves: number, k = 4): Float32Array {
  const cw = Math.ceil(w / k) + 1;
  const ch = Math.ceil(h / k) + 1;
  const small = periodicNoise(cw, ch, cellsX, cellsY, seed, octaves);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = y / k;
    const y0 = Math.min(ch - 2, Math.floor(fy));
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = x / k;
      const x0 = Math.min(cw - 2, Math.floor(fx));
      const tx = fx - x0;
      const a = small[y0 * cw + x0];
      const b = small[y0 * cw + x0 + 1];
      const c = small[(y0 + 1) * cw + x0];
      const d = small[(y0 + 1) * cw + x0 + 1];
      out[y * w + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    }
  }
  return out;
}

/** Write an opaque pixel straight into the buffer (hot loops; caller guarantees bounds). */
function put(p: PixelCanvas, x: number, y: number, c: Color): void {
  const i = (y * p.w + x) * 4;
  p.data[i] = (c >> 16) & 255;
  p.data[i + 1] = (c >> 8) & 255;
  p.data[i + 2] = c & 255;
  p.data[i + 3] = 255;
}

/** Iterate the pixels of a Bresenham line, calling fn(x, y, t) with t in 0..1 along the line. */
function linePx(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number, t: number) => void): void {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  const n = Math.max(dx, -dy) || 1;
  let err = dx + dy;
  let k = 0;
  for (;;) {
    fn(x0, y0, k / n);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
    k++;
  }
}

/** Grid (col,row) + depth below the platform top → world pixel. */
function gp(c: number, r: number, depth = 0): [number, number] {
  const s = isoToScreen(c, r);
  return [s.x, s.y + depth];
}

/** Inset a CCW rectilinear grid polygon by d (grid units; negative = outset). */
function insetOutline(poly: readonly [number, number][], d: number): [number, number][] {
  const n = poly.length;
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = poly[(i + n - 1) % n];
    const b = poly[i];
    const c = poly[(i + 1) % n];
    // inward normal of a CCW edge (dx,dy) is (-dy, dx)
    const n1 = [-(Math.sign(b[1] - a[1])), Math.sign(b[0] - a[0])];
    const n2 = [-(Math.sign(c[1] - b[1])), Math.sign(c[0] - b[0])];
    out.push([b[0] + (n1[0] + n2[0]) * d, b[1] + (n1[1] + n2[1]) * d]);
  }
  return out;
}

/** Distance (grid units) from (c,r) to the outline, and the outward normal of the nearest edge. */
function outlineDist(c: number, r: number): { d: number; nx: number; ny: number } {
  let best = Infinity;
  let nx = 0;
  let ny = 0;
  const n = OUTLINE.length;
  for (let i = 0; i < n; i++) {
    const a = OUTLINE[i];
    const b = OUTLINE[(i + 1) % n];
    let d: number;
    if (a[1] === b[1]) {
      const lo = Math.min(a[0], b[0]);
      const hi = Math.max(a[0], b[0]);
      const cc = Math.max(lo, Math.min(hi, c));
      d = Math.hypot(c - cc, r - a[1]);
    } else {
      const lo = Math.min(a[1], b[1]);
      const hi = Math.max(a[1], b[1]);
      const rr = Math.max(lo, Math.min(hi, r));
      d = Math.hypot(c - a[0], r - rr);
    }
    if (d < best) {
      best = d;
      // outward normal of CCW edge = (dy, -dx)
      nx = Math.sign(b[1] - a[1]);
      ny = -Math.sign(b[0] - a[0]);
    }
  }
  return { d: best, nx, ny };
}

function insideOutline(c: number, r: number): boolean {
  if (c >= G0 && c <= G1 && r >= G0 && r <= G1) return true;
  if (c >= 1.25 && c <= 2.75 && ((r >= G1 && r <= 6.0) || (r >= -2.0 && r <= G0))) return true;
  return false;
}

// ---------------------------------------------------------------- tiles

/** Vertical distance (px) of tile-local pixel (i,j) to the 64×32 diamond's edge (negative outside). */
export function tileDV(i: number, j: number): number {
  return 16 - (Math.abs(i + 0.5 - 32) / 2 + Math.abs(j + 0.5 - 16));
}

type Lv = (level: number) => Color;

const GRAY: Lv = (l) => [0x000000, 0x3a3a3a, 0x787878, 0xbcbcbc, 0xffffff][Math.max(0, Math.min(4, l))];

/** Glyph frame shared by all zone tiles (broken diamond with bright tips). */
function drawFrame(p: PixelCanvas, lv: Lv, dim = false): void {
  for (let j = 0; j < 32; j++) {
    for (let i = 0; i < 64; i++) {
      const d = tileDV(i, j);
      if (d < 4 || d >= 5) continue;
      const ax = Math.abs(i + 0.5 - 32);
      const ay = Math.abs(j + 0.5 - 16);
      // gap at each edge midpoint
      if (Math.abs(ax - 11.5) < 3.2) continue;
      const tip = ax < 5 || ay < 2.5;
      p.set(i, j, lv(dim ? 1 : tip ? 3 : 2));
    }
  }
  // tip accents just outside the frame (little notches pointing out)
  if (!dim) {
    p.set(31, 3, lv(2)).set(32, 3, lv(2));
    p.set(31, 28, lv(2)).set(32, 28, lv(2));
    p.set(6, 15, lv(2)).set(6, 16, lv(2));
    p.set(57, 15, lv(2)).set(57, 16, lv(2));
  }
}

/** Stamp an ASCII icon centered on the tile. Digits are levels; '.' transparent. */
function icon(p: PixelCanvas, rows: readonly string[], lv: Lv, cx = 32, cy = 16): void {
  const h = rows.length;
  const w = rows[0].length;
  const x0 = Math.round(cx - w / 2);
  const y0 = Math.round(cy - h / 2);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const ch = rows[j][i];
      if (ch >= '1' && ch <= '4') p.set(x0 + i, y0 + j, lv(Number(ch)));
    }
}

const ICON_SUMMON_CORE = ['..2..', '.232.', '23432', '.232.', '..2..'];

const ICON_SPARK = [
  '.....2.....',
  '.....3.....',
  '...2.4.2...',
  '23344444332',
  '...2.4.2...',
  '.....3.....',
  '.....2.....',
];

const ICON_FIELD = [
  '..........3.3.3.........',
  '...........333..........',
  '.......3..34443..3......',
  '.........3444443........',
  '......3.344444443.3.....',
  '.........2.44444........',
  '........212.........2...',
  '.......21112.......212..',
  '......2111112.....21112.',
  '.....211131112...211111.',
  '....21113331112.2111111.',
  '...2111133311112111111..',
  '..222222222222222222222.',
];

const ICON_TOMB = [
  '.....2222.....',
  '...22111122...',
  '..2111331112..',
  '.211113311112.',
  '.211333333112.',
  '.211113311112.',
  '.211113311112.',
  '.211113311112.',
  '.211111111112.',
  '22222222222222',
  '.3..........3.',
];

function drawGlyph(p: PixelCanvas, spot: BoardSpot, lv: Lv): void {
  switch (spot) {
    case 'monster': {
      // summoning circle: two iso rings, cardinal ticks, rune dots, a core gem
      p.ellipseRing(32, 16, 15, 7.5, lv(2));
      p.ellipseRing(32, 16, 10, 5, lv(1));
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        p.set(Math.floor(32 + Math.cos(a) * 12.6), Math.floor(16 + Math.sin(a) * 6.3), lv(2));
      }
      p.rect(16, 15, 2, 2, lv(3)).rect(46, 15, 2, 2, lv(3));
      p.rect(31, 8, 2, 1, lv(3)).rect(31, 23, 2, 1, lv(3));
      icon(p, ICON_SUMMON_CORE, lv);
      break;
    }
    case 'spellTrap': {
      // card slot: flat card outline, corner brackets, a magic sparkle
      p.frame(22, 9, 20, 14, lv(2));
      p.frame(24, 11, 16, 10, lv(1));
      for (const [x, y, sx, sy] of [
        [19, 7, 1, 1],
        [44, 7, -1, 1],
        [19, 24, 1, -1],
        [44, 24, -1, -1],
      ] as const) {
        p.set(x, y, lv(3)).set(x + sx, y, lv(3)).set(x, y + sy, lv(3));
      }
      icon(p, ICON_SPARK, lv);
      break;
    }
    case 'field':
      icon(p, ICON_FIELD, lv, 32, 15);
      break;
    case 'graveyard':
      icon(p, ICON_TOMB, lv, 32, 15);
      break;
    case 'deck': {
      // three stacked cards, the top one brightest, with a gem emblem
      const x0 = 21;
      const y0 = 9;
      for (const [k, edge] of [
        [2, 1],
        [1, 2],
        [0, 3],
      ] as const) {
        const x = x0 + (2 - k) * 2;
        const y = y0 + k * 2 + 1;
        p.rect(x, y, 18, 9, lv(0));
        p.frame(x, y, 18, 9, lv(edge));
      }
      icon(p, ['.3.', '343', '.3.'], lv, x0 + 4 + 9, y0 + 1 + 4.5);
      break;
    }
    case 'banish':
      p.ellipseRing(32, 16, 12, 6, lv(2));
      p.set(31, 9, lv(3)).set(32, 9, lv(3)).set(31, 22, lv(3)).set(32, 22, lv(3));
      p.set(19, 15, lv(3)).set(19, 16, lv(3)).set(44, 15, lv(3)).set(44, 16, lv(3));
      break;
  }
}

function drawTile(spot: BoardSpot, ramp: Ramp): PixelCanvas {
  const p = new PixelCanvas(64, 32);
  const dimTile = spot === 'banish';
  for (let j = 0; j < 32; j++) {
    for (let i = 0; i < 64; i++) {
      const d = tileDV(i, j);
      if (d < 1) continue; // seam
      const left = i < 32;
      const top = j < 16;
      let c: Color;
      if (d < 2) {
        // bevel: light from the upper left
        c = top ? (left ? PAL.night4 : PAL.night3) : left ? PAL.night2 : PAL.ink;
      } else if (d < 4) {
        c = top ? (bayer(i, j) < 6 ? ramp[0] : PAL.night1) : ramp[0];
        if (dimTile) c = PAL.night1;
      } else {
        // dark glass: lighter toward the top, a faint diagonal sheen
        const v = 1.15 - (j / 32) * 0.55 + (d > 9 ? -0.15 : 0);
        c = dpick([PAL.night0, PAL.night1, PAL.night2], v, i, j);
        const sheen = i - 2 * j;
        if (sheen > 4 && sheen < 9 && top && d > 5) c = PAL.night2;
        if (!dimTile && d < 7 && bayer(i, j) < 3) c = ramp[0];
      }
      p.set(i, j, c);
    }
  }
  const lv: Lv = (l) => (dimTile ? [PAL.night1, PAL.night2, ramp[0], ramp[1], ramp[2]] : [PAL.night1, ramp[1], ramp[2], ramp[3], ramp[4]])[l];
  if (dimTile) {
    // the banish corner: a sealed little void vortex (decorative)
    for (let j = 0; j < 32; j++)
      for (let i = 0; i < 64; i++) {
        if (tileDV(i, j) < 5) continue;
        const dx = i + 0.5 - 32;
        const dy = (j + 0.5 - 16) * 2;
        const r = Math.hypot(dx, dy);
        if (r > 21) continue;
        const a = Math.atan2(dy, dx);
        const arm = Math.sin(2 * a + r * 0.32);
        if (r < 2.5) p.set(i, j, PAL.void4);
        else if (r < 5) p.set(i, j, PAL.void3);
        else if (arm > 0.55) p.set(i, j, r < 11 ? PAL.void2 : PAL.void1);
        else if (arm > 0.1 && bayer(i, j) < 8) p.set(i, j, PAL.void0);
      }
  }
  drawFrame(p, lv, dimTile);
  drawGlyph(p, spot, lv);
  return p;
}

function drawTileGlow(spot: BoardSpot): PixelCanvas {
  const p = new PixelCanvas(64, 32);
  const dim = spot === 'banish';
  const lv: Lv = (l) => GRAY(dim ? l - 1 : l);
  drawFrame(p, lv, dim);
  drawGlyph(p, spot, lv);
  return p;
}

// ---------------------------------------------------------------- highlight / flash textures

function drawHlOutline(): PixelCanvas {
  const p = new PixelCanvas(HL_W, HL_H);
  for (let j = 0; j < HL_H; j++)
    for (let i = 0; i < HL_W; i++) {
      const d = tileDV(i - 4, j - 4);
      if (d >= 0 && d < 1) p.set(i, j, 0xffffff);
      else if (d >= 1 && d < 2) p.set(i, j, 0xbcbcbc);
      else if (d >= 2 && d < 4 && bayer(i, j) < (d < 3 ? 8 : 3)) p.set(i, j, 0x787878);
      else if (d >= -2 && d < 0 && bayer(i, j) < (d >= -1 ? 8 : 3)) p.set(i, j, 0x9a9a9a);
    }
  return p;
}

function drawHlMarch(f: number): PixelCanvas {
  const p = new PixelCanvas(HL_W, HL_H);
  const phase = f / MARCH_FRAMES;
  for (let j = 0; j < HL_H; j++)
    for (let i = 0; i < HL_W; i++) {
      const d = tileDV(i - 4, j - 4);
      if (d < -1 || d >= 1.5) continue;
      const a = Math.atan2((j + 0.5 - 20) * 2, i + 0.5 - 36) / (Math.PI * 2) + 0.5;
      for (const off of [0, 0.5]) {
        let u = (a - phase - off) % 1;
        if (u < 0) u += 1;
        if (u < 0.07) p.set(i, j, u < 0.035 ? 0xffffff : 0xbcbcbc);
      }
    }
  return p;
}

function drawTileFill(): PixelCanvas {
  const p = new PixelCanvas(64, 32);
  for (let j = 0; j < 32; j++) for (let i = 0; i < 64; i++) if (tileDV(i, j) >= 0) p.set(i, j, 0xffffff);
  return p;
}

// ---------------------------------------------------------------- bridge (no-man's land)

function bridgeUV(x: number, y: number): { u: number; v: number; inCell: number } | null {
  const g = screenToIso(x + 0.5, y + 0.5);
  if (g.row < 1.5 || g.row > 2.5 || g.col < -0.5 || g.col > 4.5) return null;
  const col = Math.round(g.col);
  const ctr = isoToScreen(col, 2);
  const inCell = tileDV(x - (ctr.x - 32), y - (ctr.y - 16));
  return { u: g.col + 0.5, v: g.row - 2, inCell };
}

let bridgeCache: ({ u: number; v: number; inCell: number } | null)[] | null = null;
function bridgeAt(x: number, y: number): { u: number; v: number; inCell: number } | null {
  const R = BRIDGE_RECT;
  if (!bridgeCache) {
    bridgeCache = [];
    for (let yy = 0; yy < R.h; yy++) for (let xx = 0; xx < R.w; xx++) bridgeCache.push(bridgeUV(xx + R.x, yy + R.y));
  }
  return bridgeCache[y * R.w + x];
}

function drawBridge(): PixelCanvas {
  const R = BRIDGE_RECT;
  const p = new PixelCanvas(R.w, R.h);
  for (let y = 0; y < R.h; y++)
    for (let x = 0; x < R.w; x++) {
      const wx = x + R.x;
      const wy = y + R.y;
      const b = bridgeAt(x, y);
      if (!b) continue;
      const { u, v, inCell } = b;
      const edge = 0.5 - Math.abs(v); // grid units to the long edge
      const edgePx = edge * 32;
      // the two long edges are seams (transparent) like the tiles; cross seams are faint lines
      if (edgePx < 1) continue;
      if ((u < 0.03 || u > 4.97) && inCell < 1) continue;
      let c: Color = dpick([PAL.ink, PAL.night0, PAL.night1], 1.2 + (wy % 2 === 0 ? 0.25 : 0) - edge * 0.6, wx, wy);
      // hex-ish lattice
      const hx = (u * 6) % 1;
      const hv = ((v + 0.5) * 6 + (Math.floor(u * 6) % 2) * 0.5) % 1;
      if (hx < 0.08 || hv < 0.08) c = bayer(wx, wy) < 8 ? PAL.night1 : c;
      if (inCell < 1) c = PAL.night0;
      // rails: P2 rail on the upper (row 1.5) edge, P1 rail on the lower edge
      if (edgePx < 2) c = v < 0 ? PAL.crim2 : PAL.cyan2;
      else if (edgePx < 3) c = v < 0 ? PAL.crim1 : PAL.cyan1;
      else if (edgePx < 4.5) c = bayer(wx, wy) < 8 ? (v < 0 ? PAL.crim0 : PAL.cyan0) : c;
      // rail studs
      if (edgePx >= 1 && edgePx < 3 && Math.abs(((u * 4) % 1) - 0.5) < 0.04) c = v < 0 ? PAL.crim3 : PAL.cyan3;
      // central channel
      if (Math.abs(v) < 0.03) c = PAL.night2;
      else if (Math.abs(v) < 0.07) c = PAL.ink;
      p.set(x, y, c);
    }
  return p;
}

function drawBridgeFlow(f: number): PixelCanvas {
  const R = BRIDGE_RECT;
  const p = new PixelCanvas(R.w, R.h);
  const ph = f / FLOW_FRAMES;
  for (let y = 0; y < R.h; y++)
    for (let x = 0; x < R.w; x++) {
      const b = bridgeAt(x, y);
      if (!b) continue;
      const { u, v } = b;
      const edgePx = (0.5 - Math.abs(v)) * 32;
      if (edgePx < 1) continue;
      const s = u * 36; // ≈ px along the band
      // main stream: bright dashes flowing toward +col
      if (Math.abs(v) < 0.03) {
        const k = (((s / 18 - ph) % 1) + 1) % 1;
        if (k < 0.34) p.set(x, y, k < 0.12 ? 0xffffff : k < 0.24 ? 0xbcbcbc : 0x787878);
      }
      // side streams: small sparks flowing the other way
      if (Math.abs(Math.abs(v) - 0.25) < 0.035) {
        const k = (((s / 12 + ph * (v < 0 ? 1 : 2) + (v < 0 ? 0.5 : 0)) % 1) + 1) % 1;
        if (k < 0.12) p.set(x, y, 0x9a9a9a);
      }
      // rails shimmer: a slow bright run along each rail
      if (edgePx >= 1 && edgePx < 2.5) {
        const k = (((s / 90 - ph * (v < 0 ? -1 : 1)) % 1) + 1) % 1;
        if (k < 0.08) p.set(x, y, k < 0.04 ? 0xbcbcbc : 0x787878);
      }
    }
  return p;
}

// ---------------------------------------------------------------- platform slab

interface TrimMark {
  x: number;
  y: number;
  level: number; // 0..4 ramp index
  cls: TrimClass;
}

function slabArt(): { slab: PixelCanvas; marks: TrimMark[] } {
  const R = SLAB_RECT;
  const p = new PixelCanvas(R.w, R.h);
  const marks: TrimMark[] = [];
  const L = (x: number, y: number) => [x - R.x, y - R.y] as const;
  const mark = (wx: number, wy: number, level: number, cls: TrimClass) => {
    marks.push({ x: Math.round(wx) - R.x, y: Math.round(wy) - R.y, level, cls });
  };
  const polyW = (pts: [number, number][], c: Color) => p.poly(pts.map(([x, y]) => [x - R.x, y - R.y] as [number, number]), c);

  // ---- hull: two dark stepped tiers under the slab, then a keel spike holding the energy core.
  // Kept dark on purpose so the underside reads as a silhouette against the energy glow.
  const tiers = [
    { ...HULL[0], ll: PAL.night1, lr: PAL.night0, vent: 2 },
    { ...HULL[1], ll: PAL.night0, lr: PAL.ink, vent: 1 },
  ];
  let depth = SLAB_T;
  let prevInset = 0;
  const tierGeo: { inset: number; top: number; t: number; ll: Color; lr: Color; vent: number }[] = [];
  for (const tier of tiers) {
    const top = depth + 32 * (tier.inset - prevInset);
    tierGeo.push({ ...tier, top });
    depth = top + tier.t;
    prevInset = tier.inset;
  }
  const last = tierGeo[tierGeo.length - 1];
  const a0 = G0 + last.inset;
  const a1 = G1 - last.inset;
  const spikeTop = last.top + last.t;
  const apex: [number, number] = [CORE_XY.x, CORE_XY.y];
  {
    const lft = gp(a0, a1, spikeTop);
    const bot = gp(a1, a1, spikeTop);
    const rgt = gp(a1, a0, spikeTop);
    polyW([lft, bot, apex], PAL.night0);
    polyW([bot, rgt, apex], PAL.ink);
    // facets: a lit ridge down the middle, a secondary facet on each side
    linePx(bot[0], bot[1], apex[0], apex[1], (x, y) => p.set(...L(x, y), PAL.night2));
    const midL = gp(lerp(a0, a1, 0.55), a1, spikeTop);
    const midR = gp(a1, lerp(a1, a0, 0.55), spikeTop);
    linePx(midL[0], midL[1], apex[0], apex[1] - 6, (x, y) => p.set(...L(x, y), PAL.night1));
    linePx(midR[0], midR[1], apex[0], apex[1] - 6, (x, y) => p.set(...L(x, y), PAL.night0));
    // under-lit rims near the core
    linePx(lft[0], lft[1], apex[0], apex[1], (x, y, t) => t > 0.55 && bayer(x, y) < 10 && mark(x, y, 1, 0));
    linePx(rgt[0], rgt[1], apex[0], apex[1], (x, y, t) => t > 0.55 && bayer(x, y) < 10 && mark(x, y, 1, 1));
    // the energy crystal the platform floats on
    const CRYSTAL = ['..1..', '.121.', '.131.', '12321', '13431', '12421', '.141.', '.121.', '..1..'];
    for (let j = 0; j < CRYSTAL.length; j++)
      for (let i = 0; i < 5; i++) {
        const ch = CRYSTAL[j][i];
        if (ch !== '.') mark(apex[0] - 3 + i, apex[1] - 5 + j, Number(ch), 2);
      }
  }
  for (let k = tierGeo.length - 1; k >= 0; k--) {
    const { inset, top, t, ll, lr, vent } = tierGeo[k];
    const c0 = G0 + inset;
    const c1 = G1 - inset;
    const lft = gp(c0, c1, top);
    const bot = gp(c1, c1, top);
    const rgt = gp(c1, c0, top);
    polyW([lft, bot, [bot[0], bot[1] + t], [lft[0], lft[1] + t]], ll);
    polyW([bot, rgt, [rgt[0], rgt[1] + t], [bot[0], bot[1] + t]], lr);
    linePx(lft[0], lft[1] + t - 1, bot[0], bot[1] + t - 1, (x, y) => p.set(...L(x, y), PAL.ink));
    linePx(bot[0], bot[1] + t - 1, rgt[0], rgt[1] + t - 1, (x, y) => p.set(...L(x, y), PAL.ink));
    linePx(bot[0], bot[1], bot[0], bot[1] + t - 1, (x, y) => p.set(...L(x, y), k === 0 ? PAL.night2 : PAL.night1));
    // energy vents: dark slots with a glowing core
    const step = k === 0 ? 0.125 : 0.2;
    for (let s = step / 2; s < 1; s += step) {
      for (const [ea, eb, face] of [
        [lft, bot, 0],
        [bot, rgt, 1],
      ] as const) {
        const vx = Math.round(lerp(ea[0], eb[0], s));
        const vy = Math.round(lerp(ea[1], eb[1], s) + Math.floor(t / 2) - 1);
        p.set(vx - 1 - R.x, vy - R.y, PAL.ink).set(vx + 1 - R.x, vy - R.y, PAL.ink);
        const g = screenToIso(vx, vy - top);
        const cls = face === 0 ? 0 : rowClass(g.row);
        mark(vx, vy, vent, cls);
        if (k === 0) mark(vx + (face === 0 ? -1 : 1), vy + (face === 0 ? -1 : 1) * 0, 0, cls);
      }
    }
    // the energy seam right under the slab
    if (k === 0) {
      linePx(lft[0], lft[1], bot[0], bot[1], (x, y) => mark(x, y, 2, 0));
      linePx(bot[0], bot[1], rgt[0], rgt[1], (x, y, tt) => mark(x, y, 2, rowClass(lerp(c1, c0, tt))));
    }
  }

  // ---- slab + podium faces (front-facing outline edges), back to front
  const n = OUTLINE.length;
  const faces: { a: [number, number]; b: [number, number]; ll: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const a = OUTLINE[i];
    const b = OUTLINE[(i + 1) % n];
    const nx = Math.sign(b[1] - a[1]);
    const ny = -Math.sign(b[0] - a[0]);
    if (nx > 0 || ny > 0) faces.push({ a: [a[0], a[1]], b: [b[0], b[1]], ll: ny > 0 });
  }
  faces.sort((f, g) => f.a[0] + f.a[1] + f.b[0] + f.b[1] - (g.a[0] + g.a[1] + g.b[0] + g.b[1]));
  for (const f of faces) {
    const A = gp(f.a[0], f.a[1]);
    const B = gp(f.b[0], f.b[1]);
    const base = f.ll ? PAL.night2 : PAL.night1;
    polyW([A, B, [B[0], B[1] + SLAB_T], [A[0], A[1] + SLAB_T]], base);
    const x0 = Math.min(A[0], B[0]);
    const x1 = Math.max(A[0], B[0]);
    const yAt = (x: number) => A[1] + ((B[1] - A[1]) * (x - A[0])) / (B[0] - A[0]);
    const gridAt = (x: number) => {
      const t = (x - A[0]) / (B[0] - A[0]);
      return [lerp(f.a[0], f.b[0], t), lerp(f.a[1], f.b[1], t)] as const;
    };
    for (let x = Math.ceil(x0); x < Math.floor(x1); x++) {
      const yt = Math.round(yAt(x + 0.5) - 0.5);
      const [gc, gr] = gridAt(x + 0.5);
      const cls = rowClass(gr);
      // shading bands down the face
      p.set(x - R.x, yt - R.y, f.ll ? PAL.steel : PAL.night4);
      p.set(x - R.x, yt + 1 - R.y, f.ll ? PAL.night4 : PAL.night3);
      if (f.ll && bayer(x, yt + 2) < 6) p.set(x - R.x, yt + 2 - R.y, PAL.night3);
      p.set(x - R.x, yt + SLAB_T - 2 - R.y, PAL.night0);
      p.set(x - R.x, yt + SLAB_T - 1 - R.y, PAL.ink);
      // vertical panel seams
      const along = (gc + gr) * 16; // ≈ px along the edge
      if (Math.abs(((along % 24) + 24) % 24) < 1) for (let k = 2; k < SLAB_T - 2; k++) if (k !== 9) p.set(x - R.x, yt + k - R.y, f.ll ? PAL.night1 : PAL.night0);
      // neon strip
      mark(x, yt + 9, 3, cls);
      if (bayer(x, yt) < 8) {
        mark(x, yt + 8, 1, cls);
        mark(x, yt + 10, 1, cls);
      }
      // indicator lights between seams
      if (Math.abs((((along + 12) % 24) + 24) % 24) < 1) {
        mark(x, yt + 3, 4, cls);
        mark(x + 1, yt + 3, 3, cls);
      }
    }
  }

  // ---- top surface (slab border + podium tops). The grid area is ink; tiles cover it.
  const corners = OUTLINE.map(([c, r]) => gp(c, r));
  const minX = Math.floor(Math.min(...corners.map((q) => q[0])));
  const maxX = Math.ceil(Math.max(...corners.map((q) => q[0])));
  const minY = Math.floor(Math.min(...corners.map((q) => q[1])));
  const maxY = Math.ceil(Math.max(...corners.map((q) => q[1])));
  for (let wy = minY; wy <= maxY; wy++)
    for (let wx = minX; wx <= maxX; wx++) {
      const g = screenToIso(wx + 0.5, wy + 0.5);
      if (!insideOutline(g.col, g.row)) continue;
      const lx = wx - R.x;
      const ly = wy - R.y;
      if (g.col >= -0.5 && g.col <= 4.5 && g.row >= -0.5 && g.row <= 4.5) {
        p.set(lx, ly, PAL.ink);
        continue;
      }
      const { d, nx, ny } = outlineDist(g.col, g.row);
      const dp = d * 32; // vertical px to the outer edge
      const cls = rowClass(g.row);
      const back = nx < 0 || ny < 0;
      const litSide = nx < 0 || ny > 0; // faces toward the upper-left light
      let c: Color;
      if (dp < 1) c = back ? (nx < 0 ? PAL.mist : PAL.night4) : ny > 0 ? PAL.steel : PAL.night4;
      else if (dp < 2) c = litSide ? PAL.night3 : PAL.night2;
      else {
        c = dpick([PAL.night0, PAL.night1, PAL.night2], 1.1 + (dp < 4 ? 0.3 : 0) - (dp > 9 ? 0.25 : 0), wx, wy);
      }
      // ruler ticks continuing the tile seams across the border
      const fc = g.col + 0.5;
      const fr = g.row + 0.5;
      const onSeamLine = (v: number) => Math.abs(v - Math.round(v)) < 0.022;
      const inMain = g.col >= G0 && g.col <= G1 && g.row >= G0 && g.row <= G1;
      if (inMain && dp > 6 && dp < 10 && ((onSeamLine(fc) && (g.row < -0.5 || g.row > 4.5)) || (onSeamLine(fr) && (g.col < -0.5 || g.col > 4.5))))
        c = PAL.night3;
      // dotted inner rail just outside the grid
      if (inMain && dp >= 9 && dp < 10 && (wx & 1) === 0) c = PAL.night2;
      p.set(lx, ly, c);
      // trim: neon line 4px in from the edge, with a dithered glow either side
      if (dp >= 4 && dp < 5) mark(wx, wy, 3, cls);
      else if ((dp >= 3 && dp < 4) || (dp >= 5 && dp < 6)) {
        if (bayer(wx, wy) < 10) mark(wx, wy, 1, cls);
      }
      // a soft bevel glint on the trim's outer side for the lit edges
      if (dp < 1 && litSide && !back) mark(wx, wy, 1, cls);
    }

  // ---- corner jewels where the trim lines meet
  const GEM = ['..1..', '.131.', '13431', '.131.', '..1..'];
  for (const [c, r] of [
    [G0 + 0.14, G0 + 0.14],
    [G1 - 0.14, G0 + 0.14],
    [G1 - 0.14, G1 - 0.14],
    [G0 + 0.14, G1 - 0.14],
  ] as const) {
    const sx = Math.round(isoToScreen(c, r).x);
    const sy = Math.round(isoToScreen(c, r).y);
    const cls = rowClass(r);
    p.ellipse(sx - R.x, sy - R.y, 4, 2.5, PAL.ink);
    for (let j = 0; j < 5; j++)
      for (let i = 0; i < 5; i++) {
        const ch = GEM[j][i];
        if (ch !== '.') mark(sx - 2 + i, sy - 2 + j, Number(ch), cls);
      }
  }

  // ---- podium stand pads (where the duelists stand): a hologram pedestal
  for (const pl of [0, 1] as PlayerId[]) {
    const s = duelistXY(pl);
    const cx = Math.round(s.x);
    const cy = Math.round(s.y);
    p.ellipse(cx - R.x, cy - R.y, 14, 7, PAL.night0);
    p.ellipse(cx - R.x, cy - R.y, 12, 6, PAL.night1);
    p.ellipseRing(cx - R.x, cy - R.y + 1, 14, 7, PAL.night3);
    const tmp = new PixelCanvas(48, 24);
    tmp.ellipseRing(24, 12, 14, 7, 0x3);
    tmp.ellipseRing(24, 12, 9, 4.5, 0x2);
    tmp.ellipse(24, 12, 4, 2, 0x4);
    for (let y = 0; y < 24; y++)
      for (let x = 0; x < 48; x++) {
        const v = tmp.get(x, y);
        if (v !== null) mark(cx - 24 + x, cy - 12 + y, v === 0x3 ? 3 : v === 0x2 ? 1 : 2, pl);
        else if (Math.hypot((x + 0.5 - 24) / 9, (y + 0.5 - 12) / 4.5) < 1 && bayer(x, y) < 5) mark(cx - 24 + x, cy - 12 + y, 0, pl);
      }
  }
  return { slab: p, marks };
}

/** Trim colors per theme and class; level indexes the ramp. */
function trimRamp(hot: boolean, cls: TrimClass): Ramp {
  if (hot) return cls === 2 ? [PAL.fire0, PAL.fire1, PAL.fire3, PAL.fire4, PAL.white] : RAMPS.fire;
  if (cls === 0) return RAMPS.cyan;
  if (cls === 1) return RAMPS.crim;
  return [PAL.night2, PAL.night3, PAL.steel, PAL.mist, PAL.white];
}

/** Polyline (world px) of a player's neon trim line, from one end of their half to the other. */
export function trimPath(player: PlayerId): { x: number; y: number }[] {
  const poly = insetOutline(OUTLINE, 4.5 / 32);
  const keep = (r: number) => (player === 0 ? r >= 2.5 : r <= 1.5);
  const cut = player === 0 ? 2.5 : 1.5;
  // rotate so we start at a vertex outside the kept half
  let start = poly.findIndex(([, r]) => !keep(r));
  if (start < 0) start = 0;
  const ring = [...poly.slice(start), ...poly.slice(0, start)];
  const out: [number, number][] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    if (keep(a[1])) out.push(a);
    if (keep(a[1]) !== keep(b[1])) {
      const t = (cut - a[1]) / (b[1] - a[1]);
      out.push([lerp(a[0], b[0], t), cut]);
    }
  }
  return out.map(([c, r]) => {
    const s = isoToScreen(c, r);
    return { x: Math.round(s.x), y: Math.round(s.y) };
  });
}

// ---------------------------------------------------------------- sky

function drawSky(hot: boolean): PixelCanvas {
  const R = SKY_RECT;
  const p = new PixelCanvas(R.w, R.h);
  const neb = coarseNoise(R.w, R.h, 10, 9, hot ? 41 : 17, 4);
  const smoke = hot ? coarseNoise(R.w, R.h, 7, 6, 91, 4) : null;
  const coolCols = [PAL.ink, PAL.night0, PAL.night1, PAL.night2, PAL.night3];
  const hotCols = [PAL.ink, PAL.crim0, PAL.fire0, PAL.fire1, PAL.fire2];
  const keys: [number, number][] = hot
    ? [
        [-232, 0.1],
        [-120, 0.7],
        [-20, 1.3],
        [50, 1.9],
        [100, 2.6],
        [150, 3.3],
        [230, 3.6],
      ]
    : [
        [-232, 0],
        [-120, 0.55],
        [-30, 1.0],
        [40, 1.35],
        [90, 1.95],
        [130, 2.45],
        [200, 2.7],
      ];
  for (let y = 0; y < R.h; y++) {
    const wy = y + R.y;
    const base = curve(keys, wy);
    for (let x = 0; x < R.w; x++) {
      const wx = x + R.x;
      let v = base;
      const n = neb[y * R.w + x];
      if (!hot) {
        // milky-way band from lower-left to upper-right
        const dl = Math.abs((wx - 60) * 0.42 + (wy - 120) * 0.91) / 46;
        const m = clamp01(1 - dl);
        const cloud = m * n;
        if (cloud > 0.3) v += (cloud - 0.3) * 1.5;
        let c = dpick(coolCols, bandify(v, 0.5), wx, wy);
        if (cloud > 0.5 && bayer(wx, wy) < (cloud - 0.5) * 40) c = cloud > 0.62 ? PAL.void1 : PAL.void0;
        put(p, x, y, c);
      } else {
        const s = smoke![y * R.w + x];
        v -= Math.min(1.1, Math.max(0, s - 0.5) * 2.2);
        v += Math.max(0, n - 0.6) * 1.2;
        v = Math.max(v, 0.6);
        put(p, x, y, dpick(hotCols, bandify(v, 0.55), wx, wy));
      }
    }
  }
  // dim stars (two tiers baked in; the bright tier is animated sprites)
  const rnd = mulberry32(hot ? 5 : 3);
  const count = hot ? 160 : 1500;
  for (let i = 0; i < count; i++) {
    const wx = Math.floor(R.x + rnd() * R.w);
    const wy = Math.floor(R.y + rnd() * R.h);
    if (wy > rimY(wx) + 4) continue;
    const dl = Math.abs((wx - 60) * 0.42 + (wy - 120) * 0.91) / 46;
    if (!hot && dl > 1 && rnd() < 0.35) continue; // denser in the milky way
    const r = rnd();
    const c = hot ? (r < 0.7 ? PAL.crim1 : PAL.fire2) : r < 0.55 ? PAL.night3 : r < 0.85 ? PAL.night4 : r < 0.96 ? PAL.steel : PAL.mist;
    p.set(wx - R.x, wy - R.y, c);
    if (!hot && r > 0.985) {
      p.set(wx - R.x - 1, wy - R.y, PAL.night3).set(wx - R.x + 1, wy - R.y, PAL.night3);
      p.set(wx - R.x, wy - R.y - 1, PAL.night3).set(wx - R.x, wy - R.y + 1, PAL.night3);
    }
  }
  return p;
}

function drawAurora(seed: number): PixelCanvas {
  const { w, h } = AURORA_SIZE;
  const p = new PixelCanvas(w, h);
  const curt = periodicNoise(w, 1, 9, 1, seed, 3);
  const streak = periodicNoise(w, 1, 40, 1, seed + 3, 2);
  const wave = periodicNoise(w, 1, 4, 1, seed + 5, 2);
  for (let x = 0; x < w; x++) {
    const I = clamp01((curt[x] - 0.35) * 2.6);
    if (I <= 0) continue;
    const yb = h - 18 - wave[x] * 30;
    const ht = 34 + I * 46;
    for (let y = 0; y < h; y++) {
      if (y > yb) continue;
      const f = (yb - y) / ht;
      if (f > 1) continue;
      const a = I * Math.pow(1 - f, 0.8) * (0.55 + 0.6 * streak[x]) * (f < 0.06 ? 1.4 : 1);
      if (bayer(x, y) >= a * 16) continue;
      const c = f < 0.08 ? PAL.teal3 : f < 0.28 ? PAL.teal2 : f < 0.55 ? (bayer(x, y) < 8 ? PAL.teal1 : PAL.void2) : PAL.void1;
      p.set(x, y, c);
    }
  }
  return p;
}

function drawSmoke(): PixelCanvas {
  const { w, h } = SMOKE_SIZE;
  const p = new PixelCanvas(w, h);
  const n = periodicNoise(w, h, 6, 4, 123, 4);
  for (let y = 0; y < h; y++) {
    const env = Math.sin((y / h) * Math.PI);
    for (let x = 0; x < w; x++) {
      const v = (n[y * w + x] - 0.42) * 2.4 * env;
      if (v <= 0 || bayer(x, y) >= v * 16) continue;
      // lit from below by the lava: lighter rim toward the bottom of each billow
      const below = n[Math.min(h - 1, y + 3) * w + x];
      p.set(x, y, below < n[y * w + x] - 0.05 ? PAL.fire1 : v > 0.7 ? PAL.fire0 : PAL.crim0);
    }
  }
  return p;
}

// ---------------------------------------------------------------- stadium

function ang0(x: number, y: number): number {
  return Math.atan2(y, x) / (Math.PI * 2) + 0.5;
}

function drawStadium(): {
  base: PixelCanvas;
  rimCool: PixelCanvas;
  rimHot: PixelCanvas;
  crowd: PixelCanvas[];
  led: PixelCanvas[];
  lamp: PixelCanvas;
  haze: PixelCanvas;
} {
  const R = STADIUM_RECT;
  // light haze hanging over the bowl (white, tinted at runtime; rides with the stadium's parallax)
  const haze = new PixelCanvas(R.w, R.h);
  for (let x = 0; x < R.w; x++) {
    const wx = x + R.x;
    const top = rimY(wx + 0.5) - 4;
    for (let k = 1; k < 44; k++) {
      const wy = Math.floor(top) - k;
      const y = wy - R.y;
      if (y < 0) break;
      const v = Math.pow(1 - k / 44, 1.6);
      if (bayer(wx, wy) < v * 11) haze.set(x, y, v > 0.55 ? 0xffffff : 0xa0a0a0);
    }
  }
  const base = new PixelCanvas(R.w, R.h);
  const rimCool = new PixelCanvas(R.w, R.h);
  const rimHot = new PixelCanvas(R.w, R.h);
  const crowd = [0, 1, 2].map(() => new PixelCanvas(R.w, R.h));
  const led = [0, 1, 2].map(() => new PixelCanvas(R.w, R.h));
  const floorN = coarseNoise(R.w, R.h, 12, 8, 5, 3);
  const rim = (wx: number, wy: number, cool: Color, hot: Color) => {
    rimCool.set(wx - R.x, wy - R.y, cool);
    rimHot.set(wx - R.x, wy - R.y, hot);
  };

  for (let x = 0; x < R.w; x++) {
    const wx = x + R.x;
    const top = rimY(wx + 0.5);
    const bot = standsBottomY(wx + 0.5);
    const yTop = Math.round(top) - 4;
    for (let y = Math.max(0, yTop - R.y); y < R.h; y++) {
      const wy = y + R.y;
      let c: Color;
      if (wy < top) {
        // roof canopy
        c = wy === yTop ? PAL.night1 : PAL.ink;
        if (wy === yTop) rim(wx, wy, (wx & 7) < 5 ? PAL.night4 : PAL.night3, (wx & 7) < 5 ? PAL.fire2 : PAL.fire1);
        if (wy === yTop + 1) rim(wx, wy, PAL.night2, PAL.crim1);
      } else if (wy < bot) {
        const t = (wy - top) / (bot - top);
        const rows = 13;
        const rf = (t * rows) % 1;
        const u = (wx - 320) / lerp(440, 380, t);
        const aisle = Math.abs(u * 11 - Math.round(u * 11)) < 0.012 + 0.006 * t;
        const tierBreak = Math.abs(t - 0.47) < 0.035;
        if (tierBreak) c = PAL.ink;
        else if (aisle) c = rf < 0.35 ? PAL.night1 : PAL.night2;
        else if (rf < 0.3) c = PAL.night1;
        else c = bayer(wx, wy) < 2 ? PAL.night1 : PAL.night0;
        // balcony lights on the tier break
        if (tierBreak && Math.abs(t - 0.47) < 0.012 && (wx % 9 === 0 || wx % 9 === 1)) {
          c = PAL.gold1;
          rim(wx, wy, PAL.gold2, PAL.fire3);
        }
        // the first rows under the roof are lit by the floodlights
        if (t < 0.1 && bayer(wx, wy) < 5) rim(wx, wy, PAL.night2, PAL.fire0);
        // lava light from below on the lowest rows
        if (t > 0.78 && bayer(wx, wy) < (t - 0.78) * 30) rimHot.set(x, y, PAL.crim0);
      } else if (wy < bot + WALL_H) {
        const k = wy - Math.floor(bot);
        c = k <= 2 ? PAL.ink : k === WALL_H - 1 ? PAL.night2 : (wx % 14 === 0 ? PAL.night0 : PAL.night1);
        if (k === WALL_H - 1) rim(wx, wy, PAL.night3, PAL.fire1);
        // LED ribbon (3-phase chase)
        if (k === 1 || k === 2) {
          const seg = Math.floor((wx + 1000) / 3);
          const ph = seg % 3;
          const side = wx < 250 ? 0 : wx > 390 ? 1 : 2;
          const block = Math.floor((wx + 1000) / 27) % 4;
          if (block !== 3 && (k === 1 || block !== 1)) {
            const col = side === 0 ? (block === 0 ? PAL.cyan4 : PAL.cyan3) : side === 1 ? (block === 0 ? PAL.crim4 : PAL.crim3) : PAL.gold3;
            led[ph].set(x, y, col);
          }
        }
      } else {
        // the arena floor far below: dark, hazy, with a giant glowing ring under the platform
        const fy = wy - (bot + WALL_H);
        const n = floorN[y * R.w + x];
        let v = 0.55 + n * 0.7 - Math.min(0.5, fy / 160);
        const ex = (wx - 320) / 300;
        const ey = (wy - 318) / 74;
        const er = Math.sqrt(ex * ex + ey * ey);
        c = dpick([PAL.ink, PAL.night0, PAL.night1], v, wx, wy);
        const dash = Math.floor((ang0(ex, ey) * 360) % 8);
        if (Math.abs(er - 1) < 0.011 && dash < 5) c = dash === 0 ? (wx < 320 ? PAL.cyan1 : PAL.crim1) : wx < 320 ? PAL.cyan0 : PAL.crim0;
        else if (Math.abs(er - 0.84) < 0.007 && bayer(wx, wy) < 6) c = PAL.night1;
        // radial floor lines
        const ang = Math.atan2(ey, ex);
        if (er > 0.82 && er < 1.6 && Math.abs(((ang / (Math.PI * 2)) * 24) % 1) < 0.03 && bayer(wx, wy) < 8) c = PAL.night1;
        if (fy < 3) c = PAL.ink;
      }
      put(base, x, y, c);
    }
  }

  // crowd lights: phone screens & glow sticks; left fans cyan, right fans crimson
  for (let layer = 0; layer < 3; layer++) {
    const r2 = mulberry32(100 + layer);
    for (let i = 0; i < 230; i++) {
      const wx = Math.floor(R.x + r2() * R.w);
      const top = rimY(wx + 0.5) + 2;
      const bot = standsBottomY(wx + 0.5) - 1;
      const wy = Math.floor(lerp(top, bot, Math.pow(r2(), 0.8)));
      const side = clamp01((wx - 200) / 240);
      const q = r2();
      let c: Color;
      if (q < 0.72) c = r2() < 1 - side ? (r2() < 0.7 ? PAL.cyan3 : PAL.cyan4) : r2() < 0.7 ? PAL.crim3 : PAL.crim4;
      else if (q < 0.84) c = PAL.gold3;
      else if (q < 0.93) c = PAL.white;
      else c = PAL.mag3;
      const dim = r2() < 0.45;
      crowd[layer].set(wx - R.x, wy - R.y, dim ? mix(c, PAL.night1, 0.45) : c);
    }
  }

  // light towers: lattice masts with floodlight banks
  const lamp = new PixelCanvas(13, 8);
  for (const t of TOWERS) {
    const x = t.x - R.x;
    const by = t.baseY - R.y;
    const ty = t.lampY - R.y;
    for (let y = ty + 4; y <= by; y++) {
      base.set(x - 2, y, PAL.ink).set(x + 2, y, PAL.ink);
      const k = (y - ty) % 8;
      // zig-zag bracing
      const bx = k < 4 ? x - 2 + k : x + 2 - (k - 4);
      base.set(bx, y, PAL.ink);
      rim(t.x - 2, y + R.y, PAL.night2, PAL.crim1);
    }
    base.set(x - 3, by, PAL.ink).set(x + 3, by, PAL.ink);
    // lamp housing
    base.rect(x - 6, ty - 3, 13, 8, PAL.ink);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) base.rect(x - 5 + i * 4, ty - 2 + j * 3, 3, 2, PAL.night1);
    rim(t.x - 6, t.lampY - 4, PAL.night3, PAL.fire1);
    for (let i = -5; i <= 6; i++) rim(t.x + i, t.lampY - 4, PAL.night3, PAL.fire1);
    base.rect(x - 6, ty - 4, 13, 1, PAL.ink);
  }
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 3; i++) {
      lamp.rect(1 + i * 4, 1 + j * 3, 3, 2, PAL.gold4);
      lamp.set(1 + i * 4, 1 + j * 3, PAL.white);
    }
  return { base, rimCool, rimHot, crowd, led, lamp, haze };
}

/** The stadium as lit by lava: cool night tones remapped to dark embers. */
function heatRemap(src: PixelCanvas): PixelCanvas {
  const map = new Map<Color, Color>([
    [PAL.ink, PAL.ink],
    [PAL.night0, mix(PAL.ink, PAL.crim0, 0.45)],
    [PAL.night1, mix(PAL.night0, PAL.fire0, 0.75)],
    [PAL.night2, PAL.crim0],
    [PAL.night3, PAL.fire1],
    [PAL.night4, PAL.fire2],
    [PAL.cyan0, PAL.fire0],
    [PAL.cyan1, PAL.fire1],
    [PAL.crim0, PAL.fire0],
    [PAL.crim1, PAL.fire2],
    [PAL.gold1, PAL.fire2],
  ]);
  const out = src.clone();
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const c = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    const m = map.get(c);
    if (m !== undefined) {
      d[i] = (m >> 16) & 255;
      d[i + 1] = (m >> 8) & 255;
      d[i + 2] = m & 255;
    }
  }
  return out;
}

// ---------------------------------------------------------------- fog & glows

function drawFog(i: number): PixelCanvas {
  const { w, h } = FOG_SIZE[i];
  const p = new PixelCanvas(w, h);
  const n = periodicNoise(w, h, [6, 5, 4][i], [4, 5, 4][i], 300 + i, 4);
  for (let y = 0; y < h; y++) {
    const ty = y / (h - 1);
    const env = i === 2 ? smooth(clamp01(ty * 2.2)) : Math.sin(ty * Math.PI);
    for (let x = 0; x < w; x++) {
      const v = (n[y * w + x] - 0.3) * 1.9 * env;
      if (v <= 0) continue;
      const lvl = v * 16;
      if (bayer(x, y) < lvl) p.set(x, y, v > 0.62 ? 0xffffff : 0xb0b0b0);
    }
  }
  return p;
}

function radialGlow(size: number, falloff: number, levels = 8, color: Color = 0xffffff): PixelCanvas {
  const p = new PixelCanvas(size, size);
  const r0 = size / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x + 0.5 - r0, y + 0.5 - r0) / r0;
      if (r >= 1) continue;
      const a = Math.round(Math.pow(1 - r, falloff) * levels) / levels;
      if (a > 0) p.set(x, y, color, Math.round(a * 255));
    }
  return p;
}

function drawBeam(): PixelCanvas {
  const W = BEAM_LEN;
  const H = 64;
  const p = new PixelCanvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const off = Math.abs(y + 0.5 - H / 2);
      const half = 2 + x * 0.11;
      if (off > half) continue;
      const across = 1 - off / half;
      const along = 1 - x / W;
      let a = Math.pow(across, 1.1) * Math.pow(along, 1.25) * 0.85;
      if (off < 1 + x * 0.018) a += 0.3 * along;
      a = Math.round(a * 10) / 10;
      if (a > 0) p.set(x, y, 0xffffff, Math.round(Math.min(1, a) * 255));
    }
  return p;
}

function drawUnder(hot: boolean): PixelCanvas {
  const W = 420;
  const H = 170;
  const p = new PixelCanvas(W, H);
  const LV = 7; // alpha levels, dithered between neighbours so the falloff has no hard rings
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ex = (x + 0.5 - W / 2) / (W / 2);
      const ey = (y + 0.5 - H * 0.42) / (H * 0.55);
      const r = Math.sqrt(ex * ex + ey * ey);
      if (r >= 1) continue;
      const v = Math.pow(1 - r, 1.5) * LV;
      const lo = Math.floor(v);
      const a = (lo + (bayer(x, y) < (v - lo) * 16 ? 1 : 0)) / LV;
      if (a <= 0) continue;
      let c: Color;
      if (hot) c = r < 0.35 ? PAL.fire3 : PAL.fire2;
      else {
        const t = clamp01((ex + 0.18) / 0.36);
        c = t <= 0 ? PAL.cyan2 : t >= 1 ? PAL.crim2 : bayer(x, y) < t * 16 ? PAL.crim2 : PAL.cyan2;
        if (r < 0.25) c = mix(c, PAL.white, 0.35);
      }
      p.set(x, y, c, Math.round(a * 255));
    }
  return p;
}

function drawCoreBeam(): PixelCanvas {
  const W = 40;
  const H = 110;
  const p = new PixelCanvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const t = y / H;
      const half = 3 + t * 16;
      const off = Math.abs(x + 0.5 - W / 2);
      if (off > half) continue;
      const a = Math.round(Math.pow(1 - off / half, 1.3) * Math.pow(1 - t, 1.2) * 8) / 8;
      if (a > 0) p.set(x, y, 0xffffff, Math.round(a * 255));
    }
  return p;
}

/** A soft vertical light shaft (thruster / anti-gravity beam) fading downward. */
function drawShaft(): PixelCanvas {
  const W = 12;
  const H = 70;
  const p = new PixelCanvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const t = y / H;
      const half = 1.5 + t * 4.5;
      const off = Math.abs(x + 0.5 - W / 2);
      if (off > half) continue;
      const a = Math.round(Math.pow(1 - off / half, 1.2) * Math.pow(1 - t, 1.6) * 6) / 6;
      if (a > 0) p.set(x, y, 0xffffff, Math.round(a * 255));
    }
  return p;
}

function drawRing(f: number): PixelCanvas {
  const p = new PixelCanvas(RING_W, RING_H);
  const rx = 10 + (f / (RING_FRAMES - 1)) * 54;
  p.ellipseRing(RING_W / 2, RING_H / 2, rx, rx / 2, 0xffffff);
  if (f > 2) p.ellipseRing(RING_W / 2, RING_H / 2, rx - 1.5, rx / 2 - 0.75, 0x787878);
  return p;
}

function drawMote(): PixelCanvas {
  const p = new PixelCanvas(3, 3);
  p.set(1, 1, 0xffffff).set(0, 1, 0x808080).set(2, 1, 0x808080).set(1, 0, 0x808080).set(1, 2, 0x808080);
  return p;
}

function drawStarFrames(): [string, PixelCanvas][] {
  const frames: [string, PixelCanvas][] = [];
  for (let f = 0; f < 4; f++) {
    const p = new PixelCanvas(7, 7);
    if (f === 0) p.set(3, 3, PAL.mist);
    if (f >= 1) p.set(3, 3, PAL.white).set(2, 3, PAL.steel).set(4, 3, PAL.steel).set(3, 2, PAL.steel).set(3, 4, PAL.steel);
    if (f >= 2) p.set(2, 3, PAL.mist).set(4, 3, PAL.mist).set(3, 2, PAL.mist).set(3, 4, PAL.mist).set(1, 3, PAL.night4).set(5, 3, PAL.night4).set(3, 1, PAL.night4).set(3, 5, PAL.night4);
    if (f >= 3) p.set(0, 3, PAL.night3).set(6, 3, PAL.night3).set(3, 0, PAL.night3).set(3, 6, PAL.night3).set(2, 2, PAL.night3).set(4, 4, PAL.night3).set(2, 4, PAL.night3).set(4, 2, PAL.night3);
    frames.push([String(f), p]);
  }
  return frames;
}

function drawTip(top: boolean): PixelCanvas {
  // chevron hugging a diamond tip; drawn for the TOP tip (pointing up) and the LEFT tip (pointing left)
  // Both are symmetric around a 2px apex (tile tips are 2px wide / tall). Apex: top (10..11, 0), left (0, 6..7).
  if (top) {
    const p = new PixelCanvas(22, 6);
    linePx(0, 5, 10, 0, (x, y) => p.set(x, y, 0xffffff));
    linePx(21, 5, 11, 0, (x, y) => p.set(x, y, 0xffffff));
    linePx(6, 5, 10, 3, (x, y) => p.set(x, y, 0x9a9a9a));
    linePx(15, 5, 11, 3, (x, y) => p.set(x, y, 0x9a9a9a));
    return p;
  }
  const p = new PixelCanvas(11, 14);
  linePx(10, 1, 0, 6, (x, y) => p.set(x, y, 0xffffff));
  linePx(10, 12, 0, 7, (x, y) => p.set(x, y, 0xffffff));
  linePx(10, 4, 5, 6, (x, y) => p.set(x, y, 0x9a9a9a));
  linePx(10, 9, 5, 7, (x, y) => p.set(x, y, 0x9a9a9a));
  return p;
}

// ---------------------------------------------------------------- lava cracks (volcano theme)

/**
 * A crack network over the platform: glowing seams between all tiles, fissures through the slab
 * border and drips down the front faces. `dist` is the path distance from the origin tile so the
 * cracks can spread outward like a fuse. Pixel indices are into a SLAB_RECT-sized image.
 */
export interface CrackField {
  /** crack core pixels */
  core: Int32Array;
  coreDist: Float32Array;
  coreTone: Uint8Array; // 0..3 variation
  /** glow halo pixels (around the core) */
  halo: Int32Array;
  haloDist: Float32Array;
  haloRing: Uint8Array; // 1 = adjacent, 2 = two px away
  maxDist: number;
  /** distance by which 96% of the crack pixels are lit (the visible "done" point of the spread) */
  mostDist: number;
  /** a sample of seam points (world px) to spawn embers from */
  embers: { x: number; y: number; d: number }[];
}

export function buildCrackField(origin: { col: number; row: number }, seed = 7): CrackField {
  const R = SLAB_RECT;
  const W = R.w;
  const H = R.h;
  const rnd = mulberry32(seed);
  const isCrack = new Uint8Array(W * H);
  const put = (wx: number, wy: number) => {
    const x = Math.round(wx) - R.x;
    const y = Math.round(wy) - R.y;
    if (x >= 0 && y >= 0 && x < W && y < H) isCrack[y * W + x] = 1;
  };

  // 1) seams between tiles (and around the grid)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const wx = x + R.x;
      const wy = y + R.y;
      const g = screenToIso(wx + 0.5, wy + 0.5);
      if (g.col < -0.5 || g.col > 4.5 || g.row < -0.5 || g.row > 4.5) continue;
      const c = Math.round(g.col);
      const r = Math.round(g.row);
      const ctr = isoToScreen(c, r);
      const d = tileDV(wx - (ctr.x - 32), wy - (ctr.y - 16));
      if (d < 1) isCrack[y * W + x] = 1;
    }

  // 2) fissures through the border: jagged walks from the grid edge to the slab edge
  const jag = (c0: number, r0: number, dc: number, dr: number, len: number) => {
    let c = c0;
    let r = r0;
    const steps = Math.ceil(len * 32);
    let lastS: { x: number; y: number } | null = null;
    for (let i = 0; i <= steps; i++) {
      const s = isoToScreen(c, r);
      const sx = Math.round(s.x);
      const sy = Math.round(s.y);
      if (lastS) linePx(lastS.x, lastS.y, sx, sy, (x, y) => put(x, y));
      lastS = { x: sx, y: sy };
      c += dc / 32 + (dr !== 0 ? (rnd() - 0.5) * 0.05 : 0);
      r += dr / 32 + (dc !== 0 ? (rnd() - 0.5) * 0.05 : 0);
    }
    return lastS!;
  };
  const drips: { x: number; y: number }[] = [];
  for (let k = 0; k <= 5; k++) {
    const v = k - 0.5;
    // toward P1's back edge (row +) and the right edge (col +): these continue as drips down the faces
    if (rnd() < 0.85) {
      const e = jag(v, 4.5, 0, 1, SLAB_E + 0.02);
      if (k > 0 && k < 5 && (v < 1.25 || v > 2.75)) drips.push(e);
    }
    if (rnd() < 0.85) {
      const e = jag(4.5, v, 1, 0, SLAB_E + 0.02);
      if (k > 0 && k < 5) drips.push(e);
    }
    if (rnd() < 0.7) jag(v, -0.5, 0, -1, SLAB_E - 0.04);
    if (rnd() < 0.7) jag(-0.5, v, -1, 0, SLAB_E - 0.04);
  }
  // 3) drips down the faces (vertical, with a heavier drop at the end)
  for (const d of drips) {
    const len = 5 + Math.floor(rnd() * 8);
    for (let k = 0; k < len; k++) put(d.x, d.y + k);
    put(d.x + 1, d.y + len - 1);
    put(d.x, d.y + len);
    put(d.x + 1, d.y + len);
  }
  // 4) short chips biting into the tile edges (stop before the glyph frame)
  const tips: [number, number][] = [
    [0, -16],
    [32, 0],
    [0, 16],
    [-32, 0],
  ];
  for (let i = 0; i < 40; i++) {
    const c = Math.floor(rnd() * 5);
    const r = Math.floor(rnd() * 5);
    const ctr = isoToScreen(c, r);
    const e = Math.floor(rnd() * 4);
    const a = tips[e];
    const b = tips[(e + 1) % 4];
    const t = 0.2 + rnd() * 0.6;
    let x = ctr.x + a[0] + (b[0] - a[0]) * t;
    let y = ctr.y + a[1] + (b[1] - a[1]) * t;
    const len = 2 + Math.floor(rnd() * 4);
    for (let k = 0; k < len; k++) {
      const lx = Math.round(x) - (ctr.x - 32);
      const ly = Math.round(y) - (ctr.y - 16);
      if (tileDV(lx, ly) > 3.2) break;
      put(x, y);
      // step inward (toward the center) with a little jitter
      const dx = ctr.x - x;
      const dy = (ctr.y - y) * 2;
      const l = Math.hypot(dx, dy) || 1;
      x += (dx / l) * 1.2 + (rnd() - 0.5) * 1.4;
      y += ((dy / l) * 1.2) / 2 + (rnd() - 0.5) * 0.9;
    }
  }

  // BFS distance from the origin tile's seam ring
  const dist = new Float32Array(W * H).fill(Infinity);
  const queue = new Int32Array(W * H);
  let qh = 0;
  let qt = 0;
  const oc = isoToScreen(origin.col, origin.row);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!isCrack[i]) continue;
      const d = tileDV(x + R.x - (oc.x - 32), y + R.y - (oc.y - 16));
      if (d >= -1 && d < 1.5) {
        dist[i] = 0;
        queue[qt++] = i;
      }
    }
  while (qh < qt) {
    const i = queue[qh++];
    const x = i % W;
    const y = (i - x) / W;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (!isCrack[j] || dist[j] !== Infinity) continue;
        dist[j] = dist[i] + 1;
        queue[qt++] = j;
      }
  }
  let maxDist = 0;
  const coreIdx: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (!isCrack[i]) continue;
    if (dist[i] === Infinity) {
      const x = i % W;
      const y = (i - x) / W;
      dist[i] = Math.hypot(x + R.x - oc.x, (y + R.y - oc.y) * 2) * 1.2;
    }
    maxDist = Math.max(maxDist, dist[i]);
    coreIdx.push(i);
  }
  // halo rings
  const haloD = new Float32Array(W * H).fill(Infinity);
  const haloR = new Uint8Array(W * H);
  for (const i of coreIdx) {
    const x = i % W;
    const y = (i - x) / W;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (isCrack[j]) continue;
        const ring = Math.max(Math.abs(dx), Math.abs(dy)) === 1 && Math.abs(dx) + Math.abs(dy) <= 1 ? 1 : 2;
        if (ring === 2 && Math.abs(dx) + Math.abs(dy) > 2) continue;
        const d = dist[i] + ring;
        if (d < haloD[j]) haloD[j] = d;
        if (!haloR[j] || ring < haloR[j]) haloR[j] = ring;
      }
  }
  const haloIdx: number[] = [];
  for (let i = 0; i < W * H; i++) if (haloR[i]) haloIdx.push(i);

  const tone = new Uint8Array(coreIdx.length);
  const toneN = periodicNoise(W, H, 40, 26, seed + 9, 2);
  coreIdx.forEach((i, k) => (tone[k] = Math.min(3, Math.floor(toneN[i] * 4.2))));
  const embers: CrackField['embers'] = [];
  for (let k = 0; k < coreIdx.length; k += 7) {
    const i = coreIdx[k];
    const x = i % W;
    embers.push({ x: x + R.x, y: (i - x) / W + R.y, d: dist[i] });
  }
  return {
    core: Int32Array.from(coreIdx),
    coreDist: Float32Array.from(coreIdx.map((i) => dist[i])),
    coreTone: tone,
    halo: Int32Array.from(haloIdx),
    haloDist: Float32Array.from(haloIdx.map((i) => haloD[i])),
    haloRing: Uint8Array.from(haloIdx.map((i) => haloR[i])),
    maxDist,
    mostDist: (() => {
      const ds = coreIdx.map((i) => dist[i]).sort((a, b) => a - b);
      return ds[Math.floor(ds.length * 0.96)] ?? maxDist;
    })(),
    embers,
  };
}

const rgbOf = (c: Color): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const LAVA_TONES = [PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4].map(rgbOf);
const HOT_FRONT = [PAL.white, PAL.fire4, PAL.fire4].map(rgbOf);

/**
 * Paint the crack field into RGBA `data` (SLAB_RECT-sized). `front` = how far (px of path) the
 * cracks have spread; `flow` = time (ms) for the steady-state lava pulses (null while spreading).
 */
export function paintCracks(f: CrackField, data: Uint8ClampedArray, front: number, flow: number | null, heat = 1): void {
  data.fill(0);
  const wave = (d: number) => (flow === null ? 0 : 0.5 + 0.5 * Math.sin((d - flow * 0.045) / 7));
  for (let k = 0; k < f.core.length; k++) {
    const d = f.coreDist[k];
    if (d > front) continue;
    const age = front - d;
    let rgb: [number, number, number];
    if (flow === null && age < 3) rgb = HOT_FRONT[Math.min(2, Math.floor(age))];
    else {
      let tone = 1 + (f.coreTone[k] >> 1);
      const w = wave(d);
      if (w > 0.88) tone = 3;
      else if (w > 0.6) tone = Math.max(tone, 2);
      else if (w < 0.15) tone = Math.max(0, tone - 1);
      if (flow === null) tone = age < 10 ? 3 : age < 40 ? Math.max(tone, 2) : tone;
      rgb = LAVA_TONES[Math.min(3, tone)];
    }
    const o = f.core[k] * 4;
    data[o] = rgb[0];
    data[o + 1] = rgb[1];
    data[o + 2] = rgb[2];
    data[o + 3] = 255;
  }
  const H1 = rgbOf(PAL.fire2);
  const H2 = rgbOf(PAL.fire1);
  for (let k = 0; k < f.halo.length; k++) {
    const d = f.haloDist[k];
    if (d > front) continue;
    const ring = f.haloRing[k];
    const age = front - d;
    const hotEdge = flow === null && age < 6;
    const rgb = ring === 1 ? (hotEdge ? rgbOf(PAL.fire3) : H1) : H2;
    const a = (ring === 1 ? 150 : 70) * heat * (hotEdge ? 1.4 : 1) * (flow === null ? 1 : 0.85 + 0.3 * wave(d));
    const o = f.halo[k] * 4;
    data[o] = rgb[0];
    data[o + 1] = rgb[1];
    data[o + 2] = rgb[2];
    data[o + 3] = Math.min(255, a);
  }
}

// ---------------------------------------------------------------- build all

const SPOTS: BoardSpot[] = ['monster', 'spellTrap', 'field', 'graveyard', 'deck', 'banish'];

const ORIGINS = new Map<string, { x: number; y: number }>();

function fastBounds(p: PixelCanvas): { x: number; y: number; w: number; h: number } {
  const d = p.data;
  let x0 = p.w;
  let y0 = p.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < p.h; y++) {
    const row = y * p.w * 4;
    for (let x = 0; x < p.w; x++) {
      if (d[row + x * 4 + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      y1 = y;
    }
  }
  return x1 < 0 ? { x: 0, y: 0, w: 1, h: 1 } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function fastCrop(p: PixelCanvas, x: number, y: number, w: number, h: number): PixelCanvas {
  const out = new PixelCanvas(w, h);
  for (let j = 0; j < h; j++) {
    const src = ((y + j) * p.w + x) * 4;
    out.data.set(p.data.subarray(src, src + w * 4), j * w * 4);
  }
  return out;
}

/**
 * World position of the top-left of a layer texture. Sparse overlay layers (rim light, crowd,
 * LED, haze, trim) are cropped to their opaque bounds at build time to save GPU memory.
 */
export function texOrigin(key: string): { x: number; y: number } {
  const o = ORIGINS.get(key);
  if (!o) throw new Error(`arena: no origin for ${key}`);
  return o;
}

/** Milliseconds spent per build step on the last buildArenaTextures() run (boot profiling). */
export const ARENA_BUILD_MS: Record<string, number> = {};

function timed<T>(name: string, fn: () => T): T {
  const t0 = performance.now();
  const r = fn();
  ARENA_BUILD_MS[name] = Math.round((performance.now() - t0) * 10) / 10;
  return r;
}

/** Generate every arena texture (idempotent). Called by the boot step and lazily by BoardView. */
export function buildArenaTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(AK.slab) && ORIGINS.size) return;
  const tAll = performance.now();
  const add = (key: string, pc: PixelCanvas) => canvasTexture(scene, key, pc);
  const addLayer = (key: string, pc: PixelCanvas, at: WorldRect) => {
    const b = fastBounds(pc);
    ORIGINS.set(key, { x: at.x + b.x, y: at.y + b.y });
    canvasTexture(scene, key, fastCrop(pc, b.x, b.y, b.w, b.h));
  };

  timed('sky', () => add(AK.sky, drawSky(false)));
  timed('skyHot', () => add(AK.skyHot, drawSky(true)));
  add(AK.aurora(0), drawAurora(1));
  add(AK.aurora(1), drawAurora(8));
  add(AK.smoke, drawSmoke());
  sheetTexture(scene, AK.star, 7, 7, drawStarFrames());
  add(AK.beam, drawBeam());
  add(AK.glow, radialGlow(48, 2.2));
  add(AK.dot, radialGlow(9, 1.2, 4));
  add(AK.mote, drawMote());

  const st = timed('stadium', () => drawStadium());
  timed('stadiumUpload', () => add(AK.stadium, st.base));
  timed('stadiumHot', () => add(AK.stadiumHot, heatRemap(st.base)));
  const tl = performance.now();
  addLayer(AK.rimCool, st.rimCool, STADIUM_RECT);
  addLayer(AK.rimHot, st.rimHot, STADIUM_RECT);
  addLayer(AK.haze, st.haze, STADIUM_RECT);
  st.crowd.forEach((c, i) => addLayer(AK.crowd(i), c, STADIUM_RECT));
  st.led.forEach((c, i) => addLayer(AK.led(i), c, STADIUM_RECT));
  add(AK.lamp, st.lamp);
  ARENA_BUILD_MS.layers = Math.round(performance.now() - tl);
  timed('fog', () => {
    for (let i = 0; i < FOG_SIZE.length; i++) add(AK.fog(i), drawFog(i));
  });

  const { slab, marks } = timed('slab', () => slabArt());
  add(AK.slab, slab);
  const tt = performance.now();
  for (const hot of [false, true])
    for (const cls of [0, 1, 2] as TrimClass[]) {
      const p = new PixelCanvas(SLAB_RECT.w, SLAB_RECT.h);
      const ramp = trimRamp(hot, cls);
      // dim levels first so bright marks win where they overlap
      for (const lvl of [0, 1, 2, 3, 4]) for (const m of marks) if (m.cls === cls && m.level === lvl) p.set(m.x, m.y, ramp[lvl]);
      addLayer(AK.trim(hot, cls), p, SLAB_RECT);
    }
  ARENA_BUILD_MS.trims = Math.round(performance.now() - tt);
  add(AK.under(false), drawUnder(false));
  add(AK.under(true), drawUnder(true));
  add(AK.coreBeam, drawCoreBeam());
  add(AK.shaft, drawShaft());
  sheetTexture(
    scene,
    AK.ringFx,
    RING_W,
    RING_H,
    Array.from({ length: RING_FRAMES }, (_, f) => [String(f), drawRing(f)] as [string, PixelCanvas]),
  );

  const tz = performance.now();
  for (const spot of SPOTS) {
    for (const pl of [0, 1] as PlayerId[]) add(AK.tile(spot, pl), drawTile(spot, pl === 0 ? RAMPS.cyan : RAMPS.crim));
    add(AK.tileGlow(spot), drawTileGlow(spot));
  }
  add(AK.bridge, drawBridge());
  sheetTexture(
    scene,
    AK.bridgeFlow,
    BRIDGE_RECT.w,
    BRIDGE_RECT.h,
    Array.from({ length: FLOW_FRAMES }, (_, f) => [String(f), drawBridgeFlow(f)] as [string, PixelCanvas]),
  );
  ARENA_BUILD_MS.tilesBridge = Math.round(performance.now() - tz);
  add(AK.hlOutline, drawHlOutline());
  sheetTexture(
    scene,
    AK.hlMarch,
    HL_W,
    HL_H,
    Array.from({ length: MARCH_FRAMES }, (_, f) => [String(f), drawHlMarch(f)] as [string, PixelCanvas]),
  );
  add(AK.hlTipT, drawTip(true));
  add(AK.hlTipL, drawTip(false));
  add(AK.tileFill, drawTileFill());
  ARENA_BUILD_MS.total = Math.round(performance.now() - tAll);
}
