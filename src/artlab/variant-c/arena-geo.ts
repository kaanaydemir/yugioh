// Art Lab C — arena geometry: the ORIGINAL Neon Düello v1 board (64×32 tiles, the slab with its
// two duelist podiums, the stepped hull with the energy core), stretched along the duel axis so
// the lab's larger characters stand 5 rows (179 px) apart instead of the game's 2 rows (72 px).
//
//   grid (col, row) → screen: x = OX + (col - row) * 32,  y = OY + (col + row) * 16   (tile centre)
//
//   row 0: P2 spell/trap      row 1: P2 monsters      row 2: P2 lane (chevrons toward P1)
//   row 3, row 4: the energy bridge (two rows deep, central channel on the row 3.5 seam)
//   row 5: P1 lane            row 6: P1 monsters      row 7: P1 spell/trap
//   col 0 / col 4: field / graveyard / deck / banish exactly like v1 (P2 = P1 rotated 180°)
//
// P1 (cyan) is the lower-left half, P2 (crimson) the upper-right half, as in the game.
// Every helper here mirrors one in src/art/arena.ts, parametrised by this grid.

import type { BoardSpot } from '../../view/layout';

export const COLS = 5;
export const ROWS = 8;
/** Screen position of the centre of grid cell (0, 0). The board centre (2, 3.5) lands on (320, 170). */
export const OX = 368;
export const OY = 82;
export const TILE_W = 64;
export const TILE_H = 32;

/** Rows of each side (P1 = id 0, lower-left). */
export const P1_ROWS = { monster: 6, back: 7, lane: 5 } as const;
export const P2_ROWS = { monster: 1, back: 0, lane: 2 } as const;
export const BRIDGE_ROWS = [3, 4] as const;
/** Row seams where the trim class changes (P2 | neutral | P1). */
export const CUT_P2 = 2.5;
export const CUT_P1 = 4.5;

export interface XY {
  x: number;
  y: number;
}

export function iso(col: number, row: number): XY {
  return { x: OX + (col - row) * (TILE_W / 2), y: OY + (col + row) * (TILE_H / 2) };
}

export function isoI(col: number, row: number): XY {
  const p = iso(col, row);
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

export function screenToGrid(x: number, y: number): { col: number; row: number } {
  const a = (x - OX) / (TILE_W / 2);
  const b = (y - OY) / (TILE_H / 2);
  return { col: (a + b) / 2, row: (b - a) / 2 };
}

/** Grid point + depth below the platform top → world pixel. */
export function gp(c: number, r: number, depth = 0): [number, number] {
  const s = iso(c, r);
  return [s.x, s.y + depth];
}

/** Monster slots (ground contact points) of the two lab actors: the middle monster zones. */
export const SLOT_DRAGON = isoI(2, P1_ROWS.monster); // (240, 210)
export const SLOT_WIZARD = isoI(2, P2_ROWS.monster); // (400, 130)

// ---------------------------------------------------------------- trim classes

/** 0 = P1 half, 1 = P2 half, 2 = neutral (the bridge band). */
export type TrimClass = 0 | 1 | 2;

export function rowClass(row: number): TrimClass {
  return row > CUT_P1 ? 0 : row < CUT_P2 ? 1 : 2;
}

// ---------------------------------------------------------------- cells

export type CellKind = { kind: 'zone'; player: 0 | 1; spot: BoardSpot } | { kind: 'lane'; player: 0 | 1 } | { kind: 'bridge' };

/** What sits on a grid cell (null outside the grid). Same zone map as v1 (src/art/arena.ts cellZone). */
export function cellAt(col: number, row: number): CellKind | null {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return null;
  if (row === 3 || row === 4) return { kind: 'bridge' };
  if (row === P1_ROWS.lane) return { kind: 'lane', player: 0 };
  if (row === P2_ROWS.lane) return { kind: 'lane', player: 1 };
  const player: 0 | 1 = row >= 5 ? 0 : 1;
  const c = player === 0 ? col : COLS - 1 - col;
  const front = player === 0 ? row === P1_ROWS.monster : row === P2_ROWS.monster;
  if (front) {
    if (c === 0) return { kind: 'zone', player, spot: 'field' };
    if (c === 4) return { kind: 'zone', player, spot: 'graveyard' };
    return { kind: 'zone', player, spot: 'monster' };
  }
  if (c === 0) return { kind: 'zone', player, spot: 'banish' };
  if (c === 4) return { kind: 'zone', player, spot: 'deck' };
  return { kind: 'zone', player, spot: 'spellTrap' };
}

/** Rows from the back of its side (0 = back row), for the glyph glow wave. */
export function backness(row: number): number {
  return row >= 5 ? 7 - row : row;
}

// ---------------------------------------------------------------- slab outline (grid units)

/** The slab extends SLAB_E tiles beyond the 5×8 grid (v1: 0.375), faces are SLAB_T px tall. */
export const SLAB_E = 0.375;
export const SLAB_T = 14;
export const G0 = -0.5 - SLAB_E; // -0.875 (both axes)
export const G1C = COLS - 0.5 + SLAB_E; // 4.875
export const G1R = ROWS - 0.5 + SLAB_E; // 7.875
/** Duelist podiums: v1's cross arms (cols 1.25..2.75, 1.125 tiles deep) behind each back row. */
export const POD_C0 = 1.25;
export const POD_C1 = 2.75;
export const POD_P1 = G1R + 1.125; // 9.0
export const POD_P2 = G0 - 1.125; // -2.0

/** Union outline of the platform top (slab + the two podiums), in grid (col,row). CCW like v1. */
export const OUTLINE: readonly [number, number][] = [
  [G0, G0],
  [POD_C0, G0],
  [POD_C0, POD_P2],
  [POD_C1, POD_P2],
  [POD_C1, G0],
  [G1C, G0],
  [G1C, G1R],
  [POD_C1, G1R],
  [POD_C1, POD_P1],
  [POD_C0, POD_P1],
  [POD_C0, G1R],
  [G0, G1R],
];

export function insideOutline(c: number, r: number): boolean {
  if (c >= G0 && c <= G1C && r >= G0 && r <= G1R) return true;
  if (c >= POD_C0 && c <= POD_C1 && ((r >= G1R && r <= POD_P1) || (r >= POD_P2 && r <= G0))) return true;
  return false;
}

export function insideGrid(c: number, r: number): boolean {
  return c >= -0.5 && c <= COLS - 0.5 && r >= -0.5 && r <= ROWS - 0.5;
}

/** Distance (grid units) from (c,r) to the outline and the outward normal of the nearest edge. */
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

/** Polyline (world px) of a player's neon trim line, from one end of its half to the other (v1 trimPath). */
export function trimPath(player: 0 | 1): XY[] {
  const poly = insetOutline(OUTLINE, 4.5 / 32);
  const keep = (r: number) => (player === 0 ? r >= CUT_P1 : r <= CUT_P2);
  const cut = player === 0 ? CUT_P1 : CUT_P2;
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
      out.push([a[0] + (b[0] - a[0]) * t, cut]);
    }
  }
  return out.map(([c, r]) => isoI(c, r));
}

// ---------------------------------------------------------------- hull, thrusters, core

/** Hull tiers under the slab (inset in tiles, face height px) — v1's numbers. */
export const HULL = [
  { inset: 0.45, t: 9 },
  { inset: 1.05, t: 7 },
] as const;
/** Height of the keel spike below the last tier (v1: 28; shorter here so the core crystal stays
 * above the lab's 17-px control bar on the longer, lower board). */
export const SPIKE = 18;

export interface Tier {
  inset: number;
  top: number;
  t: number;
}

export const TIERS: Tier[] = (() => {
  const out: Tier[] = [];
  let depth = SLAB_T;
  let prev = 0;
  for (const h of HULL) {
    const top = depth + 32 * (h.inset - prev);
    out.push({ inset: h.inset, top, t: h.t });
    depth = top + h.t;
    prev = h.inset;
  }
  return out;
})();

/** World position of the energy crystal at the tip of the keel. */
export const CORE_XY: XY = (() => {
  const last = TIERS[TIERS.length - 1];
  const s = iso(G1C - last.inset, G1R - last.inset);
  return { x: Math.round(s.x), y: Math.round(s.y + last.top + last.t + SPIKE) };
})();

/** Anti-gravity thruster points under the first hull tier (world px) with their trim class. */
export const THRUSTERS: { x: number; y: number; cls: TrimClass }[] = (() => {
  const t0 = TIERS[0];
  const c0 = G0 + t0.inset;
  const c1 = G1C - t0.inset;
  const r1 = G1R - t0.inset;
  const out: { x: number; y: number; cls: TrimClass }[] = [];
  for (const k of [0.2, 0.55, 0.85]) {
    const a = iso(c0 + (c1 - c0) * k, r1);
    out.push({ x: Math.round(a.x), y: Math.round(a.y + t0.top + t0.t), cls: 0 });
  }
  for (const k of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    const r = r1 + (c0 - r1) * k;
    const b = iso(c1, r);
    out.push({ x: Math.round(b.x), y: Math.round(b.y + t0.top + t0.t), cls: rowClass(r) });
  }
  return out;
})();

/** Duelist podium pad centres (the hologram pedestals of v1). */
export const PODIUM_XY: Record<0 | 1, XY> = {
  0: isoI((POD_C0 + POD_C1) / 2, (G1R + POD_P1) / 2),
  1: isoI((POD_C0 + POD_C1) / 2, (POD_P2 + G0) / 2),
};

// ---------------------------------------------------------------- the 2-row energy bridge

/** Screen rect of the bridge rows 3..4 (cols -0.5..4.5, rows 2.5..4.5). */
export const BRIDGE_RECT = (() => {
  const l = iso(-0.5, 4.5);
  const t = iso(-0.5, 2.5);
  const r = iso(4.5, 2.5);
  const b = iso(4.5, 4.5);
  return { x: Math.floor(l.x), y: Math.floor(t.y), w: Math.ceil(r.x - l.x), h: Math.ceil(b.y - t.y) };
})();

// ---------------------------------------------------------------- small shared helpers

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function bayer(x: number, y: number): number {
  return BAYER4[(y & 3) * 4 + (x & 3)];
}
/** Pick between colors[i] and colors[i+1] by ordered dither; v is a continuous index into colors. */
export function dpick(colors: readonly number[], v: number, x: number, y: number): number {
  const n = colors.length - 1;
  if (v <= 0) return colors[0];
  if (v >= n) return colors[n];
  const i = Math.floor(v);
  return bayer(x, y) < (v - i) * 16 ? colors[i + 1] : colors[i];
}
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
/** Deterministic hash → [0, 1). */
export function hash(i: number, j: number, seed: number): number {
  let h = (i * 374761393 + j * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Iterate the pixels of a Bresenham line, calling fn(x, y, t) with t in 0..1 along the line. */
export function linePx(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number, t: number) => void): void {
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
