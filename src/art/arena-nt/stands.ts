// Neon Tower painter: STANDS — owner A2 (docs/v3/ARENA_NEON_TOWER.md §2 / §6 / §8).
// The two tiered grandstands as geometry WITHOUT spectators: per row a tread + riser (the staircase the
// crowd stands on), the railing in front of the row, a back wall behind row 0, an outer skirt under the last
// row, newel posts at the row ends. All of it is 16-px tiles that follow the feet line of seats.ts, packed in
// one tiny atlas (the layer draws them with Blitters, one per depth). Pure PixelCanvas code (Node-safe).

import { PixelCanvas } from '../pixel';
import { STANDS, type StandBlock } from '../../view/board-nt/layout-nt';
import { AISLE_W, aisleX, feetY, rowRange } from '../../view/board-nt/seats';
import { T, packAtlas, type NtAtlas } from './wall-kit';
import { LEFT_Y0, RIGHT_Y0, TILE_W, paintAisle, paintBack, paintPost, paintRail, paintSkirt, paintTread, type StandSide } from './stands-parts';

/** Texture key of the stands atlas (frames named inside). */
export const NT_STANDS_KEY = 'nt:stands';

export function paintStandsAtlas(): NtAtlas {
  const f: [string, PixelCanvas][] = [];
  for (const s of [0, 1] as const) {
    f.push([`tread:${s}:0`, paintTread(s, 0)]);
    f.push([`tread:${s}:1`, paintTread(s, 1)]);
    f.push([`rail:${s}:0`, paintRail(s, 0)]);
    f.push([`rail:${s}:1`, paintRail(s, 1)]);
    f.push([`aisle:${s}`, paintAisle(s)]);
    f.push([`back:${s}`, paintBack(s)]);
    f.push([`skirt:${s}:0`, paintSkirt(s, 0)]);
    f.push([`skirt:${s}:1`, paintSkirt(s, 1)]);
    f.push([`post:${s}:0`, paintPost(0, s)]);
    f.push([`post:${s}:1`, paintPost(1, s)]);
  }
  return packAtlas(f, 128);
}

export interface StandPiece {
  frame: string;
  x: number;
  y: number;
}
export interface StandRow {
  side: StandSide;
  row: number;
  /** tiles of the staircase under the row (static, depth NT_DEPTH.stands) */
  tread: StandPiece[];
  /** the railing tiles in front of the row, left to right (index = position in the light chase) */
  rail: StandPiece[];
  /** back wall tiles (row 0 only) */
  back: StandPiece[];
  /** outer skirt tiles (last row only) */
  skirt: StandPiece[];
  /** newel posts at both ends of the row (drawn with the rail) */
  posts: StandPiece[];
}

const lineY0 = (s: StandSide): number => (s === 0 ? LEFT_Y0 : RIGHT_Y0);

function rowPieces(b: StandBlock, k: number): StandRow {
  const side = b.side as StandSide;
  const { xa, xb } = rowRange(b, k);
  const out: StandRow = { side, row: k, tread: [], rail: [], back: [], skirt: [], posts: [] };
  const ax = aisleX(b, k);
  // tile x positions: all even (so the ½ slope steps line up with seats.ts feetY); with an aisle the grid is
  // anchored at the gap so a tile ends exactly where the aisle starts / begins
  const xs: number[] = [];
  const lo = xa - 6;
  const hi = xb + 6;
  if (ax === null) for (let x = Math.floor(lo / 2) * 2; x < hi; x += TILE_W) xs.push(x);
  else {
    for (let x = ax - TILE_W; x + TILE_W > lo; x -= TILE_W) xs.unshift(x);
    xs.push(ax);
    for (let x = ax + AISLE_W; x < hi; x += TILE_W) xs.push(x);
  }
  xs.forEach((xt, i) => {
    const y = feetY(b, k, xt) - lineY0(side);
    const isAisle = ax !== null && xt === ax;
    out.tread.push({ frame: isAisle ? `aisle:${side}` : `tread:${side}:${(i + k) % 3 === 0 ? 1 : 0}`, x: xt, y });
    if (!isAisle) out.rail.push({ frame: `rail:${side}:0`, x: xt, y });
    if (k === 0 && !isAisle) out.back.push({ frame: `back:${side}`, x: xt, y });
    if (k === b.rows - 1) out.skirt.push({ frame: `skirt:${side}:${i % 2}`, x: xt, y });
  });
  // newel posts (4 px wide, bottom on the feet line): both row ends, and either side of the aisle
  const ends: [number, 0 | 1][] = [
    [xs[0] + 2, 0],
    [xs[xs.length - 1] + TILE_W - 2, 1],
  ];
  if (ax !== null)
    ends.push([ax - 4, 1], [ax + AISLE_W, 0]);
  for (const [px, lit] of ends) out.posts.push({ frame: `post:${side}:${lit}`, x: px, y: feetY(b, k, px) - 15 });
  return out;
}

/** All tile placements of both stands (screen pixels). */
export function standRows(): StandRow[] {
  const out: StandRow[] = [];
  for (const b of STANDS) for (let k = 0; k < b.rows; k++) out.push(rowPieces(b, k));
  return out;
}

/** Scratch / test composite: draws the staircase, rails and posts (no spectators) onto `canvas`. */
export function composeStandsStatic(canvas: PixelCanvas): void {
  const atlas = paintStandsAtlas();
  const put = (q: StandPiece): void => {
    const r = atlas.frames[q.frame];
    canvas.blit(atlas.canvas.crop(r.x, r.y, r.w, r.h), q.x, q.y);
  };
  const rows = standRows();
  for (const r of rows) for (const q of [...r.back, ...r.tread, ...r.skirt]) put(q);
  for (const r of rows) for (const q of [...r.rail, ...r.posts]) put(q);
  void T;
}
