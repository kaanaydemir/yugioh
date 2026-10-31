// Neon Tower — grandstand part painters: 16-px-wide tiles that follow a row's feet line (slope ±½: each 2 columns the
// line steps 1 px). The stand is assembled from them (baked into ONE static image per side + a few Blitters for the
// animated railings), so a whole side costs a few KB of texture. Pure PixelCanvas code.
//
// Every tile is painted in ROW-LOCAL coordinates: the feet line of the row passes through local
//   left  (line falls to the right):  ly(j) = LEFT_Y0 + floor(j / 2)
//   right (line rises to the right):  ly(j) = RIGHT_Y0 − ceil(j / 2)
// so a tile placed at (x_t, feetY(x_t) − Y0) sits exactly on the seats' line (x_t even; seats.ts feetY).
// Vertical layout around the feet line y (spectator cell 22 px above it, railing 4 px above it, tiers rowDy = 13 apart):
//   y−17 … y−13   back strip behind row 0 (floor-level wall under the platform armour)
//   y−5  … y−1    railing (post 1 px higher)
//   y    … y+12   tread + riser of the step (mostly hidden by the next tier's spectators)
//   y+0  … y+22   outer skirt of the last tier (the stand's front face, with the team banner and a floor light line)

import { PixelCanvas } from '../pixel';
import { T } from './wall-kit';

export const TILE_W = 16;
export const LEFT_Y0 = 24;
export const RIGHT_Y0 = 32;
/** Tile height: 24 rows above the line's lowest entry … 23 below the line's lowest point. */
export const TILE_H = 56;
/** Row height (tier pitch) the riser has to span, see layout-nt STANDS.rowDy. */
export const RISER = 13;

export type StandSide = 0 | 1;

function lineY(side: StandSide, j: number): number {
  return side === 0 ? LEFT_Y0 + Math.floor(j / 2) : RIGHT_Y0 - Math.ceil(j / 2);
}

/** Accent tones of a side: [dim, mid, lit]. */
function accent(side: StandSide): readonly [number, number, number] {
  return side === 0 ? [T.c1, T.c2, T.c3] : [T.r1, T.r2, T.r3];
}

/** Draw a column-wise strip: for each column call `col(p, j, y0)` with y0 = the feet line y of that column. */
function strip(side: StandSide, fn: (p: PixelCanvas, j: number, y0: number) => void): PixelCanvas {
  const p = new PixelCanvas(TILE_W, TILE_H);
  for (let j = 0; j < TILE_W; j++) fn(p, j, lineY(side, j));
  return p;
}

/**
 * The step a row stands on: a lit tread edge, the tread and a 10-px riser (night0, ink seam, a dim light dash on
 * variant 1). The next tier's spectators and railing cover most of it; what shows between them is this.
 */
export function paintTread(side: StandSide, variant: 0 | 1): PixelCanvas {
  const [dim, mid] = accent(side);
  return strip(side, (p, j, y) => {
    p.set(j, y, T.n3);
    p.set(j, y + 1, T.n2);
    p.set(j, y + 2, T.n1);
    for (let k = 3; k <= RISER - 2; k++) p.set(j, y + k, T.n0);
    p.set(j, y + RISER - 1, T.ink);
    if (j === 0) for (let k = 3; k <= RISER - 1; k++) p.set(j, y + k, T.ink);
    if (variant === 1 && j >= 4 && j <= 11) {
      p.set(j, y + 6, dim);
      if (j >= 6 && j <= 9) p.set(j, y + 6, mid);
    }
  });
}

/**
 * The railing in front of a row's spectators: it covers the lowest 4 px of the cell (y−4 … y−1). A bright top bar,
 * a glass panel, an ink foot, a post every 16 px. `lit` = 1: a stretch of the top bar glows in the side's accent
 * (the slow light chase swaps frames).
 */
export function paintRail(side: StandSide, lit: 0 | 1): PixelCanvas {
  const [dim, , glow] = accent(side);
  return strip(side, (p, j, y) => {
    p.set(j, y - 4, T.steel);
    p.set(j, y - 3, T.n4);
    p.set(j, y - 2, T.n2);
    p.set(j, y - 1, T.ink);
    // glass panel: every 4th column slightly darker
    if (j % 4 === 3) p.set(j, y - 2, T.n1);
    // post
    if (j === 7 || j === 8) {
      p.set(j, y - 5, T.steel);
      p.set(j, y - 4, T.mist);
      p.set(j, y - 3, T.n4);
      p.set(j, y - 2, T.n3);
    }
    // accent along the top bar
    if (j >= 2 && j <= 13 && j !== 7 && j !== 8) p.set(j, y - 3, lit ? glow : dim);
  });
}

/** The back strip behind row 0, between the platform armour and the heads: a floor-level wall with a dim light dash. */
export function paintBack(side: StandSide): PixelCanvas {
  const [dim] = accent(side);
  return strip(side, (p, j, y) => {
    p.set(j, y - 18, T.ink);
    p.set(j, y - 17, T.n2);
    for (let k = 16; k >= 14; k--) p.set(j, y - k, T.n1);
    p.set(j, y - 13, T.n0);
    if (j === 0) for (let k = 17; k >= 13; k--) p.set(j, y - k, T.ink);
    if (j >= 4 && j <= 11) p.set(j, y - 15, dim);
  });
}

/**
 * The outer skirt under the last tier: the stand's front face, 22 px (y+0 … y+22): a lit edge, night1 plates with ink
 * seams, an inset window with an accent light, a floor light line. Variants differ in the window light.
 */
export function paintSkirt(side: StandSide, variant: 0 | 1): PixelCanvas {
  const [dim, mid, lit] = accent(side);
  return strip(side, (p, j, y) => {
    p.set(j, y, T.n4);
    p.set(j, y + 1, T.n3);
    p.set(j, y + 2, T.n2);
    for (let k = 3; k <= 19; k++) p.set(j, y + k, T.n1);
    p.set(j, y + 20, T.n0);
    p.set(j, y + 21, T.ink);
    // floor light line
    if (j >= 1 && j <= 14) p.set(j, y + 22, variant ? mid : dim);
    // plate seams
    if (j === 0 || j === 15) for (let k = 3; k <= 21; k++) p.set(j, y + k, T.ink);
    // inset window: frame night3, dark glass, accent bar
    if (j >= 3 && j <= 12) {
      p.set(j, y + 6, T.n3);
      p.set(j, y + 13, T.n0);
      for (let k = 7; k <= 12; k++) p.set(j, y + k, T.n0);
      p.set(j, y + 10, variant ? lit : mid);
      p.set(j, y + 11, dim);
    }
    if (j === 3 || j === 12) for (let k = 6; k <= 12; k++) p.set(j, y + k, T.n3);
  });
}

/** A newel post at a row end: 4 px wide, 14 tall (stands on the feet line), a light on top. */
export function paintPost(lit: 0 | 1, side: StandSide): PixelCanvas {
  const [dim, , glow] = accent(side);
  const p = new PixelCanvas(4, POST_H);
  p.rect(0, 2, 4, POST_H - 2, T.n2);
  p.vline(0, 2, POST_H - 1, T.n3);
  p.vline(3, 2, POST_H - 1, T.ink);
  p.hline(0, 3, 2, T.steel);
  p.hline(0, 3, POST_H - 1, T.ink);
  p.rect(1, 0, 2, 2, lit ? glow : dim);
  if (lit) p.set(1, 3, dim);
  return p;
}
export const POST_H = 15;

/**
 * An aisle step (the stair gap between two seat groups): the whole tier band y−22 … y+12 in a dark well with two
 * lit handrails and a lit lip, a night3 tread and two small side lights on the riser, so the gap reads as a
 * staircase running down the stand.
 */
export function paintAisle(side: StandSide): PixelCanvas {
  const [dim, mid, lit] = accent(side);
  return strip(side, (p, j, y) => {
    for (let k = 22; k >= 1; k--) p.set(j, y - k, T.n0);
    p.set(j, y, T.mist);
    p.set(j, y + 1, T.n4);
    p.set(j, y + 2, T.n3);
    for (let k = 3; k <= RISER - 2; k++) p.set(j, y + k, T.n2);
    p.set(j, y + RISER - 1, T.ink);
    // handrails
    if (j === 0 || j === 15) for (let k = 14; k >= 1; k--) p.set(j, y - k, T.n3);
    if (j === 1 || j === 14) for (let k = 14; k >= 1; k--) p.set(j, y - k, T.n1);
    if (j === 0 || j === 15) p.set(j, y - 15, lit);
    // riser lights
    if (j === 3 || j === 12) p.set(j, y + 5, mid);
    if (j >= 6 && j <= 9) p.set(j, y + 7, dim);
    // step lip glow
    if (j >= 3 && j <= 12) p.set(j, y + 1, mid);
  });
}

/**
 * A banner hanging on the skirt: 12×17, a dark cloth with a pennant bottom, the side's accent border and a diamond
 * crest with a bright core (original, abstract).
 */
export function paintBanner(side: StandSide): PixelCanvas {
  const [dim, mid, lit] = accent(side);
  const p = new PixelCanvas(12, 17);
  p.rect(0, 0, 12, 14, T.n0);
  p.poly(
    [
      [0, 14],
      [11, 14],
      [6, 17],
      [5, 17],
    ],
    T.n0,
  );
  p.hline(0, 11, 0, T.steel);
  p.hline(1, 10, 1, dim);
  p.vline(0, 1, 13, dim);
  p.vline(11, 1, 13, dim);
  // diamond crest
  p.poly(
    [
      [5, 3],
      [8, 7],
      [5, 11],
      [2, 7],
    ],
    dim,
  );
  p.poly(
    [
      [5, 4],
      [7, 7],
      [5, 10],
      [3, 7],
    ],
    mid,
  );
  p.rect(5, 6, 1, 2, lit);
  p.hline(3, 8, 13, dim);
  return p;
}
