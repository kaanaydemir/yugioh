// Neon Tower — grandstand part painters: 16-px-wide tiles that follow a row's feet line.
// Readability pass: darker, lower contrast, desaturated grandstands that sit quietly in the background fog.

import { PixelCanvas } from '../pixel';
import { T } from './wall-kit';

export const TILE_W = 16;
export const RISER = 13;

export type StandSide = 0 | 1;
export type TileKind = 'tread' | 'rail' | 'back' | 'aisle' | 'skirt' | 'cap';

export const KIND: Record<TileKind, { up: number; down: number }> = {
  tread: { up: 0, down: 13 },
  rail: { up: 8, down: 1 },
  back: { up: 38, down: 1 },
  aisle: { up: 24, down: 13 },
  skirt: { up: 0, down: 27 },
  cap: { up: 40, down: 1 },
};

export function lineOrigin(side: StandSide, kind: TileKind): number {
  return side === 0 ? KIND[kind].up : KIND[kind].up + 8;
}
function lineY(side: StandSide, kind: TileKind, j: number): number {
  return side === 0 ? KIND[kind].up + Math.floor(j / 2) : KIND[kind].up + 8 - Math.ceil(j / 2);
}
export const tileH = (kind: TileKind): number => KIND[kind].up + 9 + KIND[kind].down;

/** Muted dark slate accent tones so stands do not compete with the duel board. */
function accent(_side: StandSide): readonly [number, number, number, number] {
  return [T.n0, T.n1, T.n1, T.n2];
}
const litCol = (side: StandSide, j: number): boolean => (side === 0 ? j === 1 : j === 14);

function strip(side: StandSide, kind: TileKind, fn: (p: PixelCanvas, j: number, y0: number) => void): PixelCanvas {
  const p = new PixelCanvas(TILE_W, tileH(kind));
  for (let j = 0; j < TILE_W; j++) fn(p, j, lineY(side, kind, j));
  return p;
}

export function paintTread(side: StandSide, variant: 0 | 1 | 2): PixelCanvas {
  const [dim] = accent(side);
  return strip(side, 'tread', (p, j, y) => {
    p.set(j, y, T.n2);
    p.set(j, y + 1, T.n1);
    p.set(j, y + 2, T.n1);
    p.set(j, y + 3, T.n0);
    p.set(j, y + 4, T.n0);
    for (let k = 5; k <= 11; k++) p.set(j, y + k, T.n0);
    p.set(j, y + 12, T.ink);
    if (j === 0) for (let k = 3; k <= 12; k++) p.set(j, y + k, T.ink);
    if (litCol(side, j)) for (let k = 4; k <= 9; k++) p.set(j, y + k, T.n1);
    if (variant === 1 && j >= 5 && j <= 10) {
      p.set(j, y + 5, T.ink);
      p.set(j, y + 6, T.n1);
      p.set(j, y + 7, T.ink);
    }
    if (variant === 2 && j >= 3 && j <= 12) {
      p.set(j, y + 6, dim);
    }
  });
}

export function paintRail(side: StandSide, lit: 0 | 1): PixelCanvas {
  const [dim, mid] = accent(side);
  return strip(side, 'rail', (p, j, y) => {
    p.set(j, y - 5, T.n2);
    p.set(j, y - 4, T.n1);
    p.set(j, y - 3, T.n1);
    p.set(j, y - 2, T.n0);
    p.set(j, y - 1, T.ink);
    if (j === 7 || j === 8) {
      p.set(j, y - 6, T.n2);
      p.set(j, y - 5, T.n2);
      p.set(j, y - 4, T.n1);
      p.set(j, y - 3, T.n1);
      p.set(j, y - 2, T.n0);
    }
    if (j >= 1 && j <= 14 && j !== 7 && j !== 8) {
      p.set(j, y - 4, lit ? mid : dim);
    }
  });
}

export function paintBack(side: StandSide, _variant: 0 | 1 | 2): PixelCanvas {
  return strip(side, 'back', (p, j, y) => {
    p.set(j, y - 38, T.n2);
    p.set(j, y - 37, T.n1);
    p.set(j, y - 36, T.n1);
    p.set(j, y - 35, T.n0);
    p.set(j, y - 34, T.ink);
    p.set(j, y - 33, T.n1);
    for (let k = 32; k >= 15; k--) p.set(j, y - k, T.n0);
    p.set(j, y - 32, T.n1);
    for (let k = 14; k >= 1; k--) p.set(j, y - k, T.ink);
    p.set(j, y - 14, T.n1);
    if (j === 0) for (let k = 36; k >= 12; k--) p.set(j, y - k, T.ink);
    if (j >= 3 && j <= 12) {
      p.set(j, y - 29, T.n1);
      for (let k = 28; k >= 18; k--) p.set(j, y - k, T.ink);
    }
  });
}

export function paintCap(side: StandSide, level: 0 | 1 | 2): PixelCanvas {
  const [dim, mid] = accent(side);
  return strip(side, 'cap', (p, j, y) => {
    p.set(j, y - 35, level >= 1 ? mid : dim);
  });
}

export function paintSkirt(side: StandSide, _variant: 0 | 1): PixelCanvas {
  return strip(side, 'skirt', (p, j, y) => {
    p.set(j, y, T.n2);
    p.set(j, y + 1, T.n1);
    p.set(j, y + 2, T.n1);
    for (let k = 3; k <= 21; k++) p.set(j, y + k, T.n0);
    p.set(j, y + 22, T.ink);
    p.set(j, y + 23, T.ink);
    p.set(j, y + 24, T.ink);
    if (j >= 1 && j <= 14) p.set(j, y + 25, T.n0);
    if (j === 0) for (let k = 3; k <= 24; k++) p.set(j, y + k, T.ink);
    if (j >= 3 && j <= 12) {
      p.set(j, y + 8, T.n1);
      for (let k = 9; k <= 16; k++) p.set(j, y + k, T.ink);
    }
  });
}

export function paintPost(lit: 0 | 1, side: StandSide): PixelCanvas {
  const [dim, mid] = accent(side);
  const p = new PixelCanvas(4, POST_H);
  p.rect(0, 3, 4, POST_H - 3, T.n1);
  p.hline(0, 3, 3, T.n2);
  p.hline(0, 3, POST_H - 1, T.ink);
  p.hline(0, 3, POST_H - 2, T.n0);
  p.rect(1, 0, 2, 3, lit ? mid : dim);
  return p;
}
export const POST_H = 15;

export function paintAisle(side: StandSide): PixelCanvas {
  return strip(side, 'aisle', (p, j, y) => {
    for (let k = 22; k >= 1; k--) p.set(j, y - k, T.ink);
    p.set(j, y, T.n2);
    p.set(j, y + 1, T.n1);
    for (let k = 2; k <= RISER - 2; k++) p.set(j, y + k, T.n0);
    p.set(j, y + RISER - 1, T.ink);
    if (j >= 2 && j <= 13) {
      p.set(j, y + 5, T.n1);
      p.set(j, y + 9, T.n1);
    }
    if (j === 0 || j === 15) {
      for (let k = 14; k >= 1; k--) p.set(j, y - k, T.n1);
      p.set(j, y - 15, T.n2);
    }
  });
}

export function paintBanner(side: StandSide): PixelCanvas {
  const [dim, mid] = accent(side);
  const p = new PixelCanvas(12, 18);
  p.rect(0, 0, 12, 14, T.ink);
  p.poly(
    [
      [0, 14],
      [11, 14],
      [6, 17],
      [5, 17],
    ],
    T.ink,
  );
  p.hline(0, 11, 0, T.n2);
  p.hline(0, 11, 1, T.n1);
  p.vline(0, 2, 13, dim);
  p.vline(11, 2, 13, dim);
  p.poly(
    [
      [5, 5],
      [7, 8],
      [5, 11],
      [3, 8],
    ],
    mid,
  );
  return p;
}
