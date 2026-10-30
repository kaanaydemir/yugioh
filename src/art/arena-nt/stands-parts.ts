// Neon Tower — grandstand part painters (owner A2): 16-px-wide tiles that follow a row's feet line
// (slope ±½: each 2 columns the line steps 1 px). The stand is assembled from them with Blitters, so a whole
// side costs a few KB of texture and a handful of draw objects. Pure PixelCanvas code.
//
// Every tile is painted in ROW-LOCAL coordinates: the feet line of the row passes through local
//   left  (line falls to the right):  ly(j) = LEFT_Y0 + floor(j / 2)
//   right (line rises to the right):  ly(j) = RIGHT_Y0 − ceil(j / 2)
// so a tile placed at (x_t, feetY(x_t) − Y0) sits exactly on the seats' line (x_t even; seats.ts feetY).

import { PixelCanvas } from '../pixel';
import { T } from './wall-kit';

export const TILE_W = 16;
/** The feet line enters a tile's column 0 at this local y (left: top; right: below the 8 px rise). */
export const LEFT_Y0 = 24;
export const RIGHT_Y0 = 32;
/** Rows of tile height above / below the feet line (back wall 24 above, skirt 14 below). */
export const TILE_H = 58;

export type StandSide = 0 | 1;

function lineY(side: StandSide, j: number): number {
  return side === 0 ? LEFT_Y0 + Math.floor(j / 2) : RIGHT_Y0 - Math.ceil(j / 2);
}

/** Accent tones of a side: [dim, lit]. */
function accent(side: StandSide): readonly [number, number] {
  return side === 0 ? [T.c0, T.c1] : [T.r0, T.r1];
}

/** Draw a column-wise strip: for each column call `col(j, y0)` with y0 = the feet line y of that column. */
function strip(side: StandSide, fn: (p: PixelCanvas, j: number, y0: number) => void): PixelCanvas {
  const p = new PixelCanvas(TILE_W, TILE_H);
  for (let j = 0; j < TILE_W; j++) fn(p, j, lineY(side, j));
  return p;
}

/**
 * The tread + riser a row stands on: 3 px of tread (top lit, two plain) and 6 px of riser (night0, an ink bottom
 * line, an inset dim light dash on variant 1). Total 9 px = exactly the row pitch, so rows tile into a staircase.
 */
export function paintTread(side: StandSide, variant: 0 | 1): PixelCanvas {
  const [dim, lit] = accent(side);
  return strip(side, (p, j, y) => {
    p.set(j, y, T.n2);
    p.set(j, y + 1, T.n1);
    p.set(j, y + 2, T.n1);
    for (let k = 3; k <= 7; k++) p.set(j, y + k, T.n0);
    p.set(j, y + 8, T.ink);
    // riser seam every 16 and a lit dash on variant 1
    if (j === 0) for (let k = 3; k <= 7; k++) p.set(j, y + k, T.ink);
    if (variant === 1 && j >= 4 && j <= 11) {
      p.set(j, y + 5, dim);
      if (j >= 6 && j <= 9) p.set(j, y + 5, lit);
    }
  });
}

/**
 * The railing in front of a row's spectators: it covers the lowest 4 px of the 12×16 cell
 * (rows y−4 … y−1 relative to the feet line y). Top bar lit, panel, ink foot; a post every 16 px.
 * `lit` = 1: a stretch of the top bar glows in the side's accent (the slow light chase swaps frames).
 */
export function paintRail(side: StandSide, lit: 0 | 1): PixelCanvas {
  const [dim, glow] = accent(side);
  return strip(side, (p, j, y) => {
    p.set(j, y - 4, T.n3);
    p.set(j, y - 3, T.n2);
    p.set(j, y - 2, T.n1);
    p.set(j, y - 1, T.ink);
    // glass panel: every 4th column slightly darker
    if (j % 4 === 3) p.set(j, y - 2, T.n0);
    // post
    if (j === 7 || j === 8) {
      p.set(j, y - 5, T.n3);
      p.set(j, y - 4, T.n4);
      p.set(j, y - 3, T.n3);
      p.set(j, y - 2, T.n2);
    }
    // dim accent along the top bar
    if (j >= 2 && j <= 13 && j !== 7 && j !== 8) p.set(j, y - 4, lit ? glow : dim);
  });
}

/** The back wall behind the first row: a dark strip above the heads (rows y−23 … y−13). */
export function paintBack(side: StandSide): PixelCanvas {
  const [dim] = accent(side);
  return strip(side, (p, j, y) => {
    p.set(j, y - 23, T.ink);
    p.set(j, y - 22, T.n2);
    for (let k = 21; k >= 13; k--) p.set(j, y - k, T.n0);
    p.set(j, y - 13, T.ink);
    if (j === 0) for (let k = 22; k >= 13; k--) p.set(j, y - k, T.ink);
    if (j === 1) for (let k = 21; k >= 14; k--) p.set(j, y - k, T.n1);
    if (j >= 5 && j <= 10) p.set(j, y - 17, dim);
  });
}

/**
 * The outer skirt under the last row's riser: a 14 px dark face (night1 plates, ink seams, an inset dim light
 * dash) that lets the stand sit on the floor. Rows y+9 … y+22.
 */
export function paintSkirt(side: StandSide, variant: 0 | 1): PixelCanvas {
  const [dim, lit] = accent(side);
  return strip(side, (p, j, y) => {
    p.set(j, y + 9, T.n2);
    for (let k = 10; k <= 20; k++) p.set(j, y + k, T.n1);
    p.set(j, y + 21, T.n0);
    p.set(j, y + 22, T.ink);
    if (j >= 2 && j <= 13) p.set(j, y + 23, dim);
    if (j === 0 || j === 15) for (let k = 9; k <= 21; k++) p.set(j, y + k, T.ink);
    if (j >= 3 && j <= 12) {
      p.set(j, y + 14, T.ink);
      p.set(j, y + 15, variant ? lit : dim);
      p.set(j, y + 16, T.n0);
    }
  });
}

/** A newel post at a row end: 4 px wide, 16 tall (stands on the feet line, rises 14), a light on top. */
export function paintPost(lit: 0 | 1, side: StandSide): PixelCanvas {
  const [dim, glow] = accent(side);
  const p = new PixelCanvas(4, 16);
  p.rect(0, 2, 4, 14, T.n1);
  p.vline(0, 2, 15, T.n2);
  p.vline(3, 2, 15, T.ink);
  p.hline(0, 3, 2, T.n3);
  p.hline(0, 3, 15, T.ink);
  p.rect(1, 0, 2, 2, lit ? glow : dim);
  return p;
}

/**
 * An aisle step (the stair gap between two seat groups): a lighter tread with a lit lip and two small side lights,
 * a night1 riser with a dim dash, so the gap reads as a staircase running down the stand.
 */
export function paintAisle(side: StandSide): PixelCanvas {
  const [dim, lit] = accent(side);
  return strip(side, (p, j, y) => {
    p.set(j, y, T.n3);
    p.set(j, y + 1, T.n2);
    p.set(j, y + 2, T.n2);
    for (let k = 3; k <= 7; k++) p.set(j, y + k, T.n1);
    p.set(j, y + 8, T.ink);
    if (j === 0 || j === 15) for (let k = 0; k <= 7; k++) p.set(j, y + k, T.n0);
    if (j === 2 || j === 13) p.set(j, y + 1, lit);
    if (j >= 5 && j <= 10) p.set(j, y + 5, dim);
  });
}
