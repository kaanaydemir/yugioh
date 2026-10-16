// Neon Düello still preview — the ORIGINAL v1 platform / stadium geometry, copied value for value
// from src/art/arena.ts (OUTLINE, SLAB_E, SLAB_T, HULL, CORE_XY, rimY, standsBottomY, WALL_H, TOWERS)
// so the calm still keeps the exact board silhouette without importing the game's texture module.
// Grid → screen always goes through src/view/layout.ts (isoToScreen / screenToIso, 5×5 of 64×32).

import { BOARD_COLS, BOARD_ROWS, isoToScreen, screenToIso } from '../view/layout';

/** The slab extends SLAB_E tiles beyond the 5×5 grid; its side faces are SLAB_T px thick. */
export const SLAB_E = 0.375;
export const SLAB_T = 14;
export const G0 = -0.5 - SLAB_E; // -0.875
export const G1 = BOARD_COLS - 0.5 + SLAB_E; // 4.875

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

/** Hull tiers under the slab (inset in tiles, face height px). */
export const HULL = [
  { inset: 0.45, t: 9 },
  { inset: 1.05, t: 7 },
] as const;

/** Tip of the keel spike under the hull (the original's energy-core position), screen px. */
export const KEEL_TIP = (() => {
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

/** Grid (col,row) + depth below the platform top → screen px. */
export function gp(c: number, r: number, depth = 0): [number, number] {
  const s = isoToScreen(c, r);
  return [s.x, s.y + depth];
}

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

/** Which half a (fractional) grid row belongs to: 0 = player 1, 1 = player 2, 2 = the bridge band. */
export function rowSide(row: number): 0 | 1 | 2 {
  return row > 2.5 ? 0 : row < 1.5 ? 1 : 2;
}

/** Fractional grid coords of a screen pixel's centre. */
export function pixelGrid(x: number, y: number): { col: number; row: number } {
  return screenToIso(x + 0.5, y + 0.5);
}

/** True if grid point lies on the 5×5 tile area. */
export function inGrid(c: number, r: number): boolean {
  return c >= -0.5 && c < BOARD_COLS - 0.5 && r >= -0.5 && r < BOARD_ROWS - 0.5;
}

/**
 * Vertical px from tile-local pixel (i,j) of a 64×32 tile to the diamond's edge (as art/arena.ts
 * tileDV). Constant-dv bands of width 1 are clean 2:1 pixel stairs (2 px per row).
 */
export function tileDV(i: number, j: number): number {
  return 16 - (Math.abs(i + 0.5 - 32) / 2 + Math.abs(j + 0.5 - 16));
}

// ---------------------------------------------------------------- stadium (screen px)

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
export const WALL_H = 11;

/** The original floodlight masts (x, lamp-bank height above the rim) — the still keeps four, unlit. */
export const MASTS: readonly { x: number; baseY: number; lampY: number }[] = (
  [
    [58, 52],
    [146, 56],
    [494, 56],
    [582, 52],
  ] as const
).map(([x, h]) => {
  const baseY = Math.round(rimY(x)) - 4;
  return { x, baseY, lampY: baseY - h };
});
