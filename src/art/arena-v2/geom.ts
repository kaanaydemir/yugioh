// Arena v2 world geometry ("floodlit night match", docs/ARENA_V2.md). Everything is in WORLD
// pixels (= screen pixels at camera rest) on top of the v2 grid of src/view/layout.ts:
//
//   P(c, r, z) = (300 + (c − r)·40, 66 + (c + r)·20 − z)        z = height above the marble top
//
// The marble platform is the 7×6 tile grid plus a BORDER, standing FACE_T px above the stadium
// floor (z = −FACE_T). The two duelist podiums stick out of the platform at P1 (3, 6.25) and
// P2 (3, −1.25). Behind the platform's back edges the two stands rise in iso tiers (c < STAND_C
// on the left, r < STAND_C on the right) and meet in the back corner (top center).

import type { PlayerId } from '../../engine/types';
import { BOARD_COLS, BOARD_ROWS, BOARD_OX, BOARD_OY, TILE_H, TILE_W, deckPylonXY } from '../../view/layout';

export const HW = TILE_W / 2; // 40
export const HH = TILE_H / 2; // 20

/** Grid (c, r) + height z (px above the marble top) → world pixel. */
export function P(c: number, r: number, z = 0): [number, number] {
  return [BOARD_OX + (c - r) * HW, BOARD_OY + (c + r) * HH - z];
}

/** World pixel at height z → grid (c, r). */
export function gridAt(x: number, y: number, z = 0): { c: number; r: number } {
  const a = (x - BOARD_OX) / HW;
  const b = (y + z - BOARD_OY) / HH;
  return { c: (a + b) / 2, r: (b - a) / 2 };
}

/** Vertical px distance of tile-local pixel (i, j) to the 80×40 diamond's edge (negative outside). */
export function tileDV(i: number, j: number): number {
  return HH - (Math.abs(i + 0.5 - HW) / 2 + Math.abs(j + 0.5 - HH));
}

// ---------------------------------------------------------------- platform

/** Marble border around the tile grid (grid units). */
export const BORDER = 0.3;
/** Height of the platform's front faces (px) = how far the stadium floor lies below the marble. */
export const FACE_T = 18;
export const GC0 = -0.5 - BORDER;
export const GC1 = BOARD_COLS - 0.5 + BORDER;
export const GR0 = -0.5 - BORDER;
export const GR1 = BOARD_ROWS - 0.5 + BORDER;

/** Duelist podium tabs (grid rects sticking out of the platform). */
export const PODIUM = {
  0: { c0: 2.3, c1: 3.7, r0: GR1, r1: 6.55 },
  1: { c0: 2.3, c1: 3.7, r0: -1.55, r1: GR0 },
} as const;

/** The platform top outline (grid coords), clockwise on screen. */
export const OUTLINE: readonly [number, number][] = [
  [GC0, GR0],
  [PODIUM[1].c0, GR0],
  [PODIUM[1].c0, PODIUM[1].r0],
  [PODIUM[1].c1, PODIUM[1].r0],
  [PODIUM[1].c1, GR0],
  [GC1, GR0],
  [GC1, GR1],
  [PODIUM[0].c1, GR1],
  [PODIUM[0].c1, PODIUM[0].r1],
  [PODIUM[0].c0, PODIUM[0].r1],
  [PODIUM[0].c0, GR1],
  [GC0, GR1],
];

export function insidePlatform(c: number, r: number): boolean {
  if (c >= GC0 && c <= GC1 && r >= GR0 && r <= GR1) return true;
  for (const pl of [0, 1] as PlayerId[]) {
    const t = PODIUM[pl];
    if (c >= t.c0 && c <= t.c1 && r >= t.r0 && r <= t.r1) return true;
  }
  return false;
}

export function insideGrid(c: number, r: number): boolean {
  return c >= -0.5 && c <= BOARD_COLS - 0.5 && r >= -0.5 && r <= BOARD_ROWS - 0.5;
}

/** Trim classes: 0 = player 1 half, 1 = player 2 half, 2 = neutral (the bridge band). */
export type TrimClass = 0 | 1 | 2;

export function rowClass(r: number): TrimClass {
  return r > 3.5 ? 0 : r < 1.5 ? 1 : 2;
}

/** Distance (grid units) from (c, r) to the platform outline (inside points). */
export function outlineDist(c: number, r: number): number {
  let best = Infinity;
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
    if (d < best) best = d;
  }
  return best;
}

/** Outline edges facing the camera (outward normal +c or +r): these show a front face. */
export function frontEdges(): { a: [number, number]; b: [number, number]; ll: boolean }[] {
  const out: { a: [number, number]; b: [number, number]; ll: boolean }[] = [];
  const n = OUTLINE.length;
  for (let i = 0; i < n; i++) {
    const a = OUTLINE[i];
    const b = OUTLINE[(i + 1) % n];
    // midpoint nudged outward along each axis: outside the platform → that is the outward side
    const mc = (a[0] + b[0]) / 2;
    const mr = (a[1] + b[1]) / 2;
    if (a[0] === b[0] && !insidePlatform(mc + 0.01, mr) && insidePlatform(mc - 0.01, mr)) out.push({ a: [a[0], a[1]], b: [b[0], b[1]], ll: false });
    if (a[1] === b[1] && !insidePlatform(mc, mr + 0.01) && insidePlatform(mc, mr - 0.01)) out.push({ a: [a[0], a[1]], b: [b[0], b[1]], ll: true });
  }
  // back to front
  out.sort((f, g) => f.a[0] + f.a[1] + f.b[0] + f.b[1] - (g.a[0] + g.a[1] + g.b[0] + g.b[1]));
  return out;
}

// ---------------------------------------------------------------- stadium

/** Front wall line of both stands (left stand: c = STAND_C; right stand: r = STAND_C). */
export const STAND_C = -1.8;
/** Stand front wall height (px), tier count, tier depth (grid) and tier rise (px). */
export const STAND = { wall: 12, tiers: 7, depth: 0.1, rise: 5, back: 7 } as const;
/** How far the stands run out to the sides (grid units along the stand). */
export const STAND_FAR = 10.5;

/** Height (z) of the tread of tier k (k = 0 sits right on the front wall). */
export function tierZ(k: number): number {
  return -FACE_T + STAND.wall + k * STAND.rise;
}

/** Front edge (grid line) of tier k. */
export function tierC(k: number): number {
  return STAND_C - k * STAND.depth;
}

// ---------------------------------------------------------------- world rects (layer textures)

export interface WorldRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Sky: covers above the screen for the opening's camera descent (parallax 0.2). */
export const SKY_RECT: WorldRect = { x: -72, y: -150, w: 784, h: 540 };
/** Stadium (stands, roof, floor, towers): the iso world at scroll factor 1. */
export const STAD_RECT: WorldRect = { x: -96, y: -230, w: 832, h: 680 };
/** Platform slab (faces, border, podiums) + the tile deck. */
export const SLAB_RECT: WorldRect = (() => {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [c, r] of OUTLINE) {
    const [x, y] = P(c, r);
    xs.push(x);
    ys.push(y);
  }
  const x0 = Math.floor(Math.min(...xs)) - 4;
  const y0 = Math.floor(Math.min(...ys)) - 4;
  return { x: x0, y: y0, w: Math.ceil(Math.max(...xs)) + 4 - x0, h: Math.ceil(Math.max(...ys)) + FACE_T + 8 - y0 };
})();

// ---------------------------------------------------------------- lights & props

export interface Tower {
  /** lamp bank center (world px) */
  x: number;
  y: number;
  /** foot of the mast on the stadium floor (world px) */
  baseX: number;
  baseY: number;
  /** where its floodlight lands on the platform (grid) */
  aim: { c: number; r: number };
  /** which stand it stands in front of (0 left, 1 right) */
  side: 0 | 1;
}

/** Height of a floodlight tower from its foot to the lamp bank center (px). */
export const TOWER_H = 90;
/** Grid "m" of the tower feet: on the floor strip just in front of the stand walls. */
export const TOWER_M = STAND_C + 0.3;

/**
 * Six floodlight towers on the floor strip between the platform and the stands (three per
 * stand, `a` grid units out from the back corner), each aimed at a spot on the marble.
 */
export const TOWERS: Tower[] = (
  [
    [0, 7.25, { c: 0.6, r: 4.4 }],
    [0, 5.9, { c: 1.0, r: 2.2 }],
    [0, 4.0, { c: 2.2, r: 0.5 }],
    [1, 3.7, { c: 4.3, r: 0.6 }],
    [1, 5.75, { c: 5.2, r: 2.5 }],
    [1, 7.25, { c: 4.6, r: 4.6 }],
  ] as [0 | 1, number, { c: number; r: number }][]
).map(([side, a, aim]) => {
  const [bx, by] = side === 0 ? P(TOWER_M, TOWER_M + a, -FACE_T) : P(TOWER_M + a, TOWER_M, -FACE_T);
  const baseX = Math.round(bx);
  const baseY = Math.round(by);
  return { x: baseX, y: baseY - TOWER_H, baseX, baseY, aim, side };
});

/** How far the corner pylons' bases sit inside the platform outline (grid units). */
export const PYLON_INSET = 0.14;

/**
 * Referee light pylons (base point on the marble, world px): the left and right corners, and
 * the two deck corners slid along the trim (layout deckPylonXY), so the back pylon no longer
 * stands on the x = 300 line of P2's lane behind a tall monster's head, and the front one
 * clears the deck stack / hand. Order: left, back (P2 deck), right, bottom (P1 deck).
 */
export const PYLONS: { x: number; y: number }[] = [
  P(GC0 + PYLON_INSET, GR1 - PYLON_INSET),
  [deckPylonXY(1, BORDER - PYLON_INSET).x, deckPylonXY(1, BORDER - PYLON_INSET).y],
  P(GC1 - PYLON_INSET, GR0 + PYLON_INSET),
  [deckPylonXY(0, BORDER - PYLON_INSET).x, deckPylonXY(0, BORDER - PYLON_INSET).y],
].map(([x, y]) => ({ x: Math.round(x), y: Math.round(y) }));

/** Radius (grid units) of a floodlight pool on the marble and of its white-hot core. */
export const POOL_R = 1.0;
export const POOL_CORE_R = 0.42;

/** Distance (grid units) from (c, r) to the nearest floodlight aim point. */
export function poolDist(c: number, r: number): number {
  let d = Infinity;
  for (const t of TOWERS) d = Math.min(d, Math.hypot(c - t.aim.c, r - t.aim.r));
  return d;
}

/**
 * Floodlight level of a marble pixel: 0 between the pools, 1 inside a pool, 2 in a pool's core.
 * Clean iso ellipses around each tower's aim point with a 1–2 px checker seam at each edge.
 */
export function poolLevel(c: number, r: number, wx: number, wy: number): number {
  const d = poolDist(c, r);
  const seam = 0.028;
  const step = (R: number) => (d < R - seam ? 1 : d > R + seam ? 0 : (wx + wy) & 1 ? 1 : 0);
  return step(POOL_R) + step(POOL_CORE_R);
}

/** Grid cell → which player half it is on (rows ≥ 4 P1, ≤ 1 P2, else null). */
export function halfOfRow(r: number): PlayerId | null {
  return r > BOARD_ROWS / 2 + 0.5 ? 0 : r < BOARD_ROWS / 2 - 1.5 ? 1 : null;
}
