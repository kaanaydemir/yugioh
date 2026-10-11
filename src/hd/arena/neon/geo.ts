// HD Neon arena — geometry. Exactly the shipped arena's composition (src/art/arena.ts) scaled ×1.5 into the
// 960×540 HD space: same platform outline and podiums, same hull tiers and energy core, same stadium ellipses and
// light towers. Everything here is in HD world pixels / grid units.

import { PAL } from '../../../art/palette';
import type { PlayerId } from '../../../engine/types';
import { BOARD_COLS, BOARD_ROWS, duelistXY, type BoardSpot, type XY } from '../../../view/layout';
import { HD_BOARD_OX, HD_BOARD_OY, HD_SCALE, HD_TILE_H, HD_TILE_W, hdIsoToScreen } from '../../contracts';
import { lerp } from './raster';

export const K = HD_SCALE;
export const TW = HD_TILE_W; // 96
export const TH = HD_TILE_H; // 48
export const iso = hdIsoToScreen;

/** Inverse projection: HD screen → fractional grid coords. */
export function screenToGrid(x: number, y: number): { col: number; row: number } {
  const a = (x - HD_BOARD_OX) / (TW / 2);
  const b = (y - HD_BOARD_OY) / (TH / 2);
  return { col: (a + b) / 2, row: (b - a) / 2 };
}

/** Vertical distance (HD px) from a point to the edge of grid cell (col,row)'s diamond (negative outside). */
export function cellDV(x: number, y: number, col: number, row: number): number {
  const c = iso(col, row);
  return TH / 2 - (Math.abs(x - c.x) / 2 + Math.abs(y - c.y));
}

// ---------------------------------------------------------------- platform

export const SLAB_E = 0.375;
/** Slab face height (HD px). */
export const SLAB_T = 22;
export const G0 = -0.5 - SLAB_E;
export const G1 = BOARD_COLS - 0.5 + SLAB_E;

/** Union outline of the platform top (slab + the two duelist podiums), grid (col,row), CCW. */
export const OUTLINE: readonly [number, number][] = [
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

export function insideOutline(c: number, r: number): boolean {
  if (c >= G0 && c <= G1 && r >= G0 && r <= G1) return true;
  if (c >= 1.25 && c <= 2.75 && ((r >= G1 && r <= 6.0) || (r >= -2.0 && r <= G0))) return true;
  return false;
}

/** Distance (grid units) from (c,r) to the outline, and the outward normal of the nearest edge. */
export function outlineDist(c: number, r: number): { d: number; nx: number; ny: number } {
  let best = Infinity;
  let nx = 0;
  let ny = 0;
  const n = OUTLINE.length;
  for (let i = 0; i < n; i++) {
    const a = OUTLINE[i];
    const b = OUTLINE[(i + 1) % n];
    let d: number;
    if (a[1] === b[1]) {
      const cc = Math.max(Math.min(a[0], b[0]), Math.min(Math.max(a[0], b[0]), c));
      d = Math.hypot(c - cc, r - a[1]);
    } else {
      const rr = Math.max(Math.min(a[1], b[1]), Math.min(Math.max(a[1], b[1]), r));
      d = Math.hypot(c - a[0], r - rr);
    }
    if (d < best) {
      best = d;
      nx = Math.sign(b[1] - a[1]);
      ny = -Math.sign(b[0] - a[0]);
    }
  }
  return { d: best, nx, ny };
}

/** Inset a CCW rectilinear grid polygon by d (grid units; negative = outset). */
export function insetOutline(poly: readonly [number, number][], d: number): [number, number][] {
  const n = poly.length;
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = poly[(i + n - 1) % n];
    const b = poly[i];
    const c = poly[(i + 1) % n];
    const n1 = [-Math.sign(b[1] - a[1]), Math.sign(b[0] - a[0])];
    const n2 = [-Math.sign(c[1] - b[1]), Math.sign(c[0] - b[0])];
    out.push([b[0] + (n1[0] + n2[0]) * d, b[1] + (n1[1] + n2[1]) * d]);
  }
  return out;
}

/** Trim classes: 0 = player 1 half, 1 = player 2 half, 2 = neutral (no-man's-land band). */
export type TrimClass = 0 | 1 | 2;
export function rowClass(row: number): TrimClass {
  return row > 2.5 ? 0 : row < 1.5 ? 1 : 2;
}

/** Hull tiers under the slab (inset in tiles, face height HD px). */
export const HULL = [
  { inset: 0.45, t: 14 },
  { inset: 1.05, t: 10 },
] as const;

export interface TierGeo {
  inset: number;
  top: number;
  t: number;
}
export const TIERS: TierGeo[] = (() => {
  let depth = SLAB_T;
  let prev = 0;
  return HULL.map((h) => {
    const top = depth + TH * (h.inset - prev);
    depth = top + h.t;
    prev = h.inset;
    return { inset: h.inset, top, t: h.t };
  });
})();

/** The energy crystal at the tip of the hull (the platform's "engine"). */
export const CORE_XY: XY = (() => {
  const last = TIERS[TIERS.length - 1];
  const c = G1 - last.inset;
  const s = iso(c, c);
  return { x: Math.round(s.x), y: Math.round(s.y + last.top + last.t + 42) };
})();

/** Anti-gravity thruster points under the first hull tier (world px) with their trim class. */
export const THRUSTERS: { x: number; y: number; cls: TrimClass }[] = (() => {
  const t0 = TIERS[0];
  const c0 = G0 + t0.inset;
  const c1 = G1 - t0.inset;
  const out: { x: number; y: number; cls: TrimClass }[] = [];
  for (const k of [0.2, 0.55, 0.85]) {
    const a = iso(lerp(c0, c1, k), c1);
    out.push({ x: Math.round(a.x), y: Math.round(a.y + t0.top + t0.t), cls: 0 });
    const r = lerp(c1, c0, k);
    const b = iso(c1, r);
    out.push({ x: Math.round(b.x), y: Math.round(b.y + t0.top + t0.t), cls: rowClass(r) });
  }
  return out;
})();

/** Polyline (world px) of a player's neon trim line on the slab top, from one end of their half to the other. */
export function trimPath(player: PlayerId, insetPx = 6.5): XY[] {
  const poly = insetOutline(OUTLINE, insetPx / TH);
  const keep = (r: number) => (player === 0 ? r >= 2.5 : r <= 1.5);
  const cut = player === 0 ? 2.5 : 1.5;
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
    const s = iso(c, r);
    return { x: s.x, y: s.y };
  });
}

/** Duelist podium centers (HD). */
export function podiumXY(player: PlayerId): XY {
  const s = duelistXY(player);
  return { x: s.x * K, y: s.y * K };
}

// ---------------------------------------------------------------- zones

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

// ---------------------------------------------------------------- stadium (HD world px)

/** Top of the stadium roof rim at screen x (an ellipse arc peaking behind the platform). */
export function rimY(x: number): number {
  const u = (x - 480) / 660;
  return 330 - 210 * Math.sqrt(Math.max(0, 1 - u * u));
}
/** Bottom of the stands (top of the inner wall) at screen x. */
export function standsBottomY(x: number): number {
  const u = (x - 480) / 570;
  return 357 - 159 * Math.sqrt(Math.max(0, 1 - u * u));
}
export const WALL_H = 16;
/** Center / radii of the big glowing ring on the arena floor under the platform. */
export const FLOOR_RING = { x: 480, y: 477, rx: 450, ry: 111 };

export interface Tower {
  x: number;
  lampY: number;
  baseY: number;
  beam: { angle: number; amp: number; period: number; phase: number; tint: number } | null;
}

export const TOWERS: Tower[] = (
  [
    [-45, 69, null],
    [87, 78, { angle: -2.3, amp: 0.34, period: 9800, phase: 0.1, tint: PAL.cyan4 }],
    [219, 84, { angle: -0.98, amp: 0.38, period: 12400, phase: 0.55, tint: PAL.white }],
    [348, 87, { angle: -2.05, amp: 0.3, period: 11000, phase: 0.3, tint: PAL.cyan3 }],
    [612, 87, { angle: -1.1, amp: 0.3, period: 11800, phase: 0.8, tint: PAL.crim3 }],
    [741, 84, { angle: -2.16, amp: 0.38, period: 13100, phase: 0.2, tint: PAL.white }],
    [873, 78, { angle: -0.84, amp: 0.34, period: 10300, phase: 0.65, tint: PAL.crim4 }],
    [1005, 69, null],
  ] as [number, number, Tower['beam']][]
).map(([x, h, beam]) => {
  const baseY = Math.round(rimY(x)) - 6;
  return { x, baseY, lampY: baseY - h, beam };
});

// ---------------------------------------------------------------- layer rects (world px, with margins for camera moves)

export const SKY_RECT = { x: -72, y: -96, w: 1104, h: 456 };
export const STADIUM_RECT = { x: -96, y: -24, w: 1152, h: 612 };
export const SLAB_RECT = { x: 144, y: 0, w: 672, h: 504 };
export const BRIDGE_RECT = (() => {
  const l = iso(-0.5, 2.5);
  const r = iso(4.5, 1.5);
  const t = iso(4.5, 2.5);
  const b = iso(-0.5, 1.5);
  const x0 = Math.floor(Math.min(l.x, b.x)) - 2;
  const x1 = Math.ceil(Math.max(r.x, t.x)) + 2;
  const y0 = Math.floor(Math.min(r.y, b.y)) - 2;
  const y1 = Math.ceil(Math.max(l.y, t.y)) + 2;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
})();
