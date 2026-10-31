// Neon Tower — grandstand part painters: 16-px-wide tiles that follow a row's feet line (slope ±½: each 2 columns the
// line steps 1 px). The stand is assembled from them (baked into ONE static image per side + a few Blitters for the
// animated railings / wall light line), so a whole side costs a few KB of texture. Pure PixelCanvas code.
//
// Quality pass (J5): every material is a small ramp of 5–7 tone steps painted as deliberate bands (lit edge → face → shadow
// → ink), no dither, no noise: panels have a bevel, a seam with a catch-light on the platform side, rivets, louvres and
// accent strips. The light comes from the platform (centre of the screen): left stand lit on its right, right stand lit on
// its left (`litCol`).
//
// Every tile is painted in ROW-LOCAL coordinates: a tile kind has `up` rows above the highest point of the feet line and
// `down` rows below its lowest point; the feet line of the row passes through local
//   left  (line falls to the right):  ly(j) = up + floor(j / 2)
//   right (line rises to the right):  ly(j) = up + 8 − ceil(j / 2)
// so a tile placed at (x_t, feetY(x_t) − lineOrigin) sits exactly on the seats' line (x_t even; seats.ts feetY).
// Vertical layout around the feet line y (spectator cell 22 px above it, railing 5 px above it, tiers rowDy = 13 apart):
//   y−38 … y−14   back wall behind row 0 (above the heads: cap, light groove, panelled face)
//   y−5  … y−1    railing (post 1 px higher)
//   y    … y+12   tread + riser of the step (mostly hidden by the next tier's spectators)
//   y+0  … y+25   outer skirt of the last tier (the stand's front face, with the team banner and a floor light line)

import { PixelCanvas } from '../pixel';
import { T } from './wall-kit';

export const TILE_W = 16;
/** Row height (tier pitch) the riser has to span, see layout-nt STANDS.rowDy. */
export const RISER = 13;

export type StandSide = 0 | 1;
export type TileKind = 'tread' | 'rail' | 'back' | 'aisle' | 'skirt' | 'cap';

/** Rows above the highest / below the lowest point of the feet line, per tile kind. */
export const KIND: Record<TileKind, { up: number; down: number }> = {
  tread: { up: 0, down: 13 },
  rail: { up: 8, down: 1 },
  back: { up: 38, down: 1 },
  aisle: { up: 24, down: 13 },
  skirt: { up: 0, down: 27 },
  cap: { up: 40, down: 1 },
};

/** Local y of the feet line at column 0 of a tile (the tile origin sits at feetY(x_t) − this). */
export function lineOrigin(side: StandSide, kind: TileKind): number {
  return side === 0 ? KIND[kind].up : KIND[kind].up + 8;
}
function lineY(side: StandSide, kind: TileKind, j: number): number {
  return side === 0 ? KIND[kind].up + Math.floor(j / 2) : KIND[kind].up + 8 - Math.ceil(j / 2);
}
export const tileH = (kind: TileKind): number => KIND[kind].up + 9 + KIND[kind].down;

/** Accent tones of a side: [dim, mid, lit, core]. */
function accent(side: StandSide): readonly [number, number, number, number] {
  return side === 0 ? [T.c1, T.c2, T.c3, T.c4] : [T.r1, T.r2, T.r3, T.r3];
}
/** The column next to a seam that faces the platform (catches the light). */
const litCol = (side: StandSide, j: number): boolean => (side === 0 ? j === 1 : j === 14);
const seamCol = (j: number): boolean => j === 0 || j === 15;

/** Draw a column-wise strip: for each column call `col(p, j, y0)` with y0 = the feet line y of that column. */
function strip(side: StandSide, kind: TileKind, fn: (p: PixelCanvas, j: number, y0: number) => void): PixelCanvas {
  const p = new PixelCanvas(TILE_W, tileH(kind));
  for (let j = 0; j < TILE_W; j++) fn(p, j, lineY(side, kind, j));
  return p;
}

/**
 * The step a row stands on: a catch-lit nosing, the tread, then a 10-px riser: bevel, panel face with a seam, rivets
 * and (variant 1) a louvre vent or (variant 2) a light strip, a dark foot. The next tier's spectators and railing cover
 * most of it; what shows between them is this.
 */
export function paintTread(side: StandSide, variant: 0 | 1 | 2): PixelCanvas {
  const [dim, mid] = accent(side);
  return strip(side, 'tread', (p, j, y) => {
    p.set(j, y, T.steel);
    p.set(j, y + 1, T.n4);
    p.set(j, y + 2, T.n3);
    p.set(j, y + 3, T.n2);
    p.set(j, y + 4, T.n2);
    for (let k = 5; k <= 8; k++) p.set(j, y + k, T.n1);
    p.set(j, y + 9, T.n1);
    p.set(j, y + 10, T.n0);
    p.set(j, y + 11, T.n0);
    p.set(j, y + 12, T.ink);
    // panel seam + catch-light, rivets
    if (j === 0) for (let k = 3; k <= 12; k++) p.set(j, y + k, T.ink);
    if (litCol(side, j)) for (let k = 4; k <= 9; k++) p.set(j, y + k, T.n2);
    if (j === 4 || j === 11) p.set(j, y + 4, T.n3);
    if (variant === 1 && j >= 5 && j <= 10) {
      // louvre vent: three slats
      p.set(j, y + 5, T.n0);
      p.set(j, y + 6, T.n2);
      p.set(j, y + 7, T.n0);
    }
    if (variant === 2 && j >= 3 && j <= 12) {
      p.set(j, y + 6, dim);
      if (j >= 6 && j <= 9) p.set(j, y + 6, mid);
    }
  });
}

/**
 * The railing in front of a row's spectators: it covers the lowest 5 px of the cell (y−5 … y−1). A bright top bar with
 * a catch-light, a glass panel with a diagonal glint, an ink foot, a post every 16 px with a cap. `lit` = 1: a stretch
 * of the top accent line glows (the slow light chase swaps frames).
 */
export function paintRail(side: StandSide, lit: 0 | 1): PixelCanvas {
  const [dim, mid, glow, core] = accent(side);
  return strip(side, 'rail', (p, j, y) => {
    p.set(j, y - 5, T.steel);
    p.set(j, y - 4, T.n4);
    p.set(j, y - 3, T.n3);
    p.set(j, y - 2, T.n2);
    p.set(j, y - 1, T.ink);
    // glass: a diagonal glint every 8 columns, darker panes between
    if ((j + 2) % 8 === 0 || (j + 3) % 8 === 0) p.set(j, y - 2, T.n4);
    if (j % 8 === 5) p.set(j, y - 3, T.n2);
    // post
    if (j === 7 || j === 8) {
      p.set(j, y - 6, T.mist);
      p.set(j, y - 5, j === 7 ? T.mist : T.steel);
      p.set(j, y - 4, j === 7 ? T.steel : T.n4);
      p.set(j, y - 3, j === 7 ? T.n4 : T.n3);
      p.set(j, y - 2, j === 7 ? T.n3 : T.n2);
    }
    // accent along the top bar
    if (j >= 1 && j <= 14 && j !== 7 && j !== 8) {
      p.set(j, y - 4, lit ? glow : dim);
      if (lit && j >= 5 && j <= 10) p.set(j, y - 4, core);
      if (lit && (j === 4 || j === 11)) p.set(j, y - 4, mid);
    }
  });
}

/**
 * The wall behind row 0, between the platform armour and the heads: 38 rows of panelled face under a capped top edge.
 * The cap carries a dark light GROOVE (the animated accent line is drawn over it by `paintCap`); the face has a bevel,
 * a recessed inset per 16-px bay, vertical light bars, a vent grille or a chevron mark; a plinth with a lip at the
 * bottom. Three variants alternate along the row.
 */
export function paintBack(side: StandSide, variant: 0 | 1 | 2): PixelCanvas {
  const [dim, mid, lit] = accent(side);
  return strip(side, 'back', (p, j, y) => {
    // cap
    p.set(j, y - 38, T.steel);
    p.set(j, y - 37, T.n4);
    p.set(j, y - 36, T.n3);
    p.set(j, y - 35, T.n1); // groove (accent line over it)
    p.set(j, y - 34, T.n0);
    p.set(j, y - 33, T.n2);
    // face
    for (let k = 32; k >= 15; k--) p.set(j, y - k, T.n1);
    p.set(j, y - 32, T.n2);
    p.set(j, y - 31, T.n2);
    // shadow under the face, plinth
    p.set(j, y - 15, T.n0);
    p.set(j, y - 14, T.n2);
    p.set(j, y - 13, T.n1);
    p.set(j, y - 12, T.n0);
    for (let k = 11; k >= 1; k--) p.set(j, y - k, T.n0);
    // bay seam + catch-light
    if (j === 0) for (let k = 36; k >= 12; k--) p.set(j, y - k, T.ink);
    if (litCol(side, j)) for (let k = 31; k >= 15; k--) p.set(j, y - k, T.n2);
    // inset (recessed panel): frame n2 top / n0 bottom, glass n0
    if (j >= 3 && j <= 12) {
      p.set(j, y - 29, T.n3);
      p.set(j, y - 17, T.n0);
      for (let k = 28; k >= 18; k--) p.set(j, y - k, T.n0);
    }
    if (j === 3 || j === 12) for (let k = 29; k >= 18; k--) p.set(j, y - k, j === 3 ? T.n3 : T.n1);
    if (variant === 0 && (j === 7 || j === 8)) {
      // vertical light bar with a bright core
      for (let k = 27; k >= 19; k--) p.set(j, y - k, k % 4 === 0 ? mid : dim);
      p.set(j, y - 23, lit);
    }
    if (variant === 1 && j >= 5 && j <= 10) {
      // vent grille: slats
      for (let k = 27; k >= 19; k -= 2) p.set(j, y - k, T.n2);
    }
    if (variant === 2) {
      // chevron mark
      const c = j < 8 ? j - 4 : 11 - j;
      if (c >= 0 && c <= 3) {
        p.set(j, y - 24 + c, mid);
        p.set(j, y - 21 + c, dim);
      }
    }
  });
}

/** The animated accent line over the back wall's groove (frames 0 … 2 = dim, mid, lit; 16×1 at the groove, plus a soft light under it). */
export function paintCap(side: StandSide, level: 0 | 1 | 2): PixelCanvas {
  const [dim, mid, lit, core] = accent(side);
  return strip(side, 'cap', (p, j, y) => {
    const c = level === 2 ? lit : level === 1 ? mid : dim;
    p.set(j, y - 35, c);
    if (level === 2 && j >= 5 && j <= 10) p.set(j, y - 35, core);
    // the light spilling onto the cap's lower lip, only when lit
    if (level >= 1 && j >= 2 && j <= 13) p.set(j, y - 34, level === 2 ? dim : T.n0);
  });
}

/**
 * The outer skirt under the last tier: the stand's front face, 26 px: a catch-lit lip, bevelled night plates with ink seams
 * and rivets, an inset window (frame, scan-lined glass, accent readout), a foot, a floor light line. Variants differ in
 * the window light.
 */
export function paintSkirt(side: StandSide, variant: 0 | 1): PixelCanvas {
  const [dim, mid, lit] = accent(side);
  return strip(side, 'skirt', (p, j, y) => {
    p.set(j, y, T.steel);
    p.set(j, y + 1, T.n4);
    p.set(j, y + 2, T.n3);
    p.set(j, y + 3, T.n2);
    p.set(j, y + 4, T.n2);
    for (let k = 5; k <= 21; k++) p.set(j, y + k, T.n1);
    p.set(j, y + 22, T.n0);
    p.set(j, y + 23, T.n0);
    p.set(j, y + 24, T.ink);
    // floor light line
    if (j >= 1 && j <= 14) p.set(j, y + 25, variant ? mid : dim);
    // plate seam + catch-light + rivets
    if (j === 0) for (let k = 3; k <= 24; k++) p.set(j, y + k, T.ink);
    if (litCol(side, j)) for (let k = 5; k <= 21; k++) p.set(j, y + k, T.n2);
    if (j === 3 || j === 12) {
      p.set(j, y + 5, T.n3);
      p.set(j, y + 20, T.n3);
    }
    // inset window: frame n3 / n0, glass with a scan line, accent readout
    if (j >= 3 && j <= 12) {
      p.set(j, y + 8, T.n3);
      p.set(j, y + 17, T.n0);
      for (let k = 9; k <= 16; k++) p.set(j, y + k, T.n0);
      p.set(j, y + 10, variant ? T.n1 : T.n0);
      p.set(j, y + 12, variant ? lit : mid);
      p.set(j, y + 13, variant ? mid : dim);
      if (j % 2 === 0) p.set(j, y + 15, T.n1);
    }
    if (j === 3 || j === 12) for (let k = 8; k <= 16; k++) p.set(j, y + k, j === 3 ? T.n3 : T.n2);
  });
}

/** A newel post at a row end: 4 px wide, 15 tall (stands on the feet line), shaded on three faces, a light on top. */
export function paintPost(lit: 0 | 1, side: StandSide): PixelCanvas {
  const [dim, mid, glow] = accent(side);
  const p = new PixelCanvas(4, POST_H);
  p.rect(0, 3, 4, POST_H - 3, T.n2);
  const l = side === 0 ? 2 : 0;
  p.vline(l === 2 ? 3 : 0, 3, POST_H - 2, T.n4);
  p.vline(l === 2 ? 2 : 1, 3, POST_H - 2, T.n3);
  p.vline(l === 2 ? 0 : 3, 3, POST_H - 2, T.n1);
  p.hline(0, 3, 3, T.mist);
  p.hline(0, 3, POST_H - 1, T.ink);
  p.hline(0, 3, POST_H - 2, T.n0);
  p.set(1, 7, dim);
  p.set(2, 7, mid);
  p.rect(1, 0, 2, 3, lit ? glow : dim);
  if (lit) p.set(1, 3, mid);
  return p;
}
export const POST_H = 15;

/**
 * An aisle step (the stair gap between two seat groups): the whole tier band y−22 … y+12 in a dark well with two lit
 * handrails (steel / mist), a nosing-lit stair that steps down the riser and two small light posts, so the gap reads as a
 * staircase running down the stand.
 */
export function paintAisle(side: StandSide): PixelCanvas {
  const [dim, mid, lit] = accent(side);
  return strip(side, 'aisle', (p, j, y) => {
    for (let k = 22; k >= 1; k--) p.set(j, y - k, k > 16 ? T.n0 : T.n1);
    p.set(j, y, T.mist);
    p.set(j, y + 1, T.n4);
    p.set(j, y + 2, T.n3);
    for (let k = 3; k <= RISER - 2; k++) p.set(j, y + k, T.n2);
    p.set(j, y + RISER - 1, T.ink);
    // two stair nosings on the riser
    if (j >= 2 && j <= 13) {
      p.set(j, y + 5, T.n4);
      p.set(j, y + 6, T.n1);
      p.set(j, y + 9, T.n3);
      p.set(j, y + 10, T.n1);
    }
    // handrails: steel with a mist top, posts every handrail end
    if (j === 0 || j === 15) {
      for (let k = 14; k >= 1; k--) p.set(j, y - k, T.n4);
      p.set(j, y - 15, T.mist);
      p.set(j, y - 16, lit);
    }
    if (j === 1 || j === 14) for (let k = 14; k >= 1; k--) p.set(j, y - k, T.n2);
    // light dots on the nosings + step lip glow
    if (j === 3 || j === 12) p.set(j, y + 5, mid);
    if (j >= 5 && j <= 10) p.set(j, y + 1, mid);
    if (j >= 6 && j <= 9) p.set(j, y + 8, dim);
  });
}

/**
 * A banner hanging on the skirt: 12×18, a dark cloth with a pennant bottom, a fold shade, the side's accent border and a
 * diamond crest with a bright core (original, abstract).
 */
export function paintBanner(side: StandSide): PixelCanvas {
  const [dim, mid, lit] = accent(side);
  const p = new PixelCanvas(12, 18);
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
  // rod, border, fold
  p.hline(0, 11, 0, T.steel);
  p.hline(0, 11, 1, T.n4);
  p.hline(2, 9, 2, dim);
  p.vline(0, 2, 13, dim);
  p.vline(11, 2, 13, dim);
  p.vline(side === 0 ? 10 : 1, 3, 13, T.n1);
  // diamond crest
  p.poly(
    [
      [5, 4],
      [8, 8],
      [5, 12],
      [2, 8],
    ],
    dim,
  );
  p.poly(
    [
      [5, 5],
      [7, 8],
      [5, 11],
      [3, 8],
    ],
    mid,
  );
  p.rect(5, 7, 1, 2, lit);
  p.hline(3, 8, 13, dim);
  p.set(5, 16, dim);
  return p;
}
