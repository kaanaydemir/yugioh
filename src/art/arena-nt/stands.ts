// Neon Tower painter: STANDS — owner A2 (docs/v3/ARENA_NEON_TOWER.md §2 / §6 / §8).
// The two tiered grandstands as geometry WITHOUT spectators: per row a tread + riser (the staircase the
// crowd stands on), the railing in front of the row, a back strip behind row 0, an outer skirt (with team banners)
// under the last row, newel posts at the row ends, an aisle staircase in the long (right) stand. All of it is
// 16-px tiles that follow the feet line of seats.ts, packed in one tiny atlas; the layer bakes the static tiles
// into ONE image per side (bakeStandBody) and draws the railings with Blitters (animated light chase).
// Pure PixelCanvas code (Node-safe).

import { PixelCanvas } from '../pixel';
import { STAND_SKIRT_H, standsBounds, type StandBlock } from '../../view/board-nt/layout-nt';
import { ALL_STANDS, AISLE_W, aisleX, feetY, rowRange } from '../../view/board-nt/seats';
import { packAtlas, type NtAtlas } from './wall-kit';
import { LEFT_Y0, POST_H, RIGHT_Y0, TILE_W, paintAisle, paintBack, paintBanner, paintPost, paintRail, paintSkirt, paintTread, type StandSide } from './stands-parts';

/** Texture key of the stands atlas (frames named inside). */
export const NT_STANDS_KEY = 'nt:stands';
/** Key of the baked static body of a side. */
export const ntStandBodyKey = (block: number): string => `nt:stands:body:${block}`;

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
    f.push([`banner:${s}`, paintBanner(s)]);
  }
  return packAtlas(f, 160);
}

export interface StandPiece {
  frame: string;
  x: number;
  y: number;
}
export interface StandRow {
  side: StandSide;
  /** index in ALL_STANDS */
  block: number;
  row: number;
  /** tiles of the staircase under the row (static) */
  tread: StandPiece[];
  /** the railing tiles in front of the row, left to right (index = position in the light chase) */
  rail: StandPiece[];
  /** back strip tiles (row 0 only) */
  back: StandPiece[];
  /** outer skirt tiles (last row only) */
  skirt: StandPiece[];
  /** banners hanging on the skirt (last row only) */
  banners: StandPiece[];
  /** newel posts at both ends of the row (drawn with the rail) */
  posts: StandPiece[];
}

const lineY0 = (s: StandSide): number => (s === 0 ? LEFT_Y0 : RIGHT_Y0);

function rowPieces(b: StandBlock, bi: number, k: number): StandRow {
  const side = b.side as StandSide;
  const { xa, xb } = rowRange(b, k);
  const out: StandRow = { side, block: bi, row: k, tread: [], rail: [], back: [], skirt: [], banners: [], posts: [] };
  const ax = aisleX(b, k);
  // tile x positions: all even (so the ½ slope steps line up with seats.ts feetY); with an aisle the grid is
  // anchored at the gap so a tile ends exactly where the aisle starts / begins
  const xs: number[] = [];
  const lo = xa - 8;
  const hi = xb + 8;
  if (ax === null) for (let x = Math.floor(lo / 2) * 2; x < hi; x += TILE_W) xs.push(x);
  else {
    for (let x = ax - TILE_W; x + TILE_W > lo; x -= TILE_W) xs.unshift(x);
    xs.push(ax);
    for (let x = ax + AISLE_W; x < hi; x += TILE_W) xs.push(x);
  }
  const last = k === b.rows - 1;
  xs.forEach((xt, i) => {
    const y = feetY(b, k, xt) - lineY0(side);
    const isAisle = ax !== null && xt === ax;
    out.tread.push({ frame: isAisle ? `aisle:${side}` : `tread:${side}:${(i + k) % 3 === 0 ? 1 : 0}`, x: xt, y });
    if (!isAisle) out.rail.push({ frame: `rail:${side}:0`, x: xt, y });
    if (k === 0 && !isAisle) out.back.push({ frame: `back:${side}`, x: xt, y });
    if (last) out.skirt.push({ frame: `skirt:${side}:${i % 2}`, x: xt, y });
  });
  if (last) {
    // a banner on every third skirt tile (not at the very ends)
    xs.forEach((xt, i) => {
      if (i % 3 !== 1 || i === 0 || i === xs.length - 1 || xt === ax) return;
      const bx = xt + 2;
      out.banners.push({ frame: `banner:${side}`, x: bx, y: feetY(b, k, bx + 6) + 3 });
    });
  }
  // newel posts (4 px wide, bottom on the feet line): both row ends, and either side of the aisle
  const ends: [number, 0 | 1][] = [
    [xa - 8, 0],
    [xb + 6, 1],
  ];
  if (ax !== null) ends.push([ax - 4, 1], [ax + AISLE_W, 0]);
  for (const [px, lit] of ends) out.posts.push({ frame: `post:${side}:${lit}`, x: px, y: feetY(b, k, px) - POST_H + 1 });
  return out;
}

/** All tile placements of both stands (screen pixels). */
export function standRows(): StandRow[] {
  const out: StandRow[] = [];
  ALL_STANDS.forEach((b, bi) => {
    for (let k = 0; k < b.rows; k++) out.push(rowPieces(b, bi, k));
  });
  return out;
}

/** Where the baked static body of a side sits (screen rect, the stand bounds + a margin). */
export function standBodyRect(block: number): { x: number; y: number; w: number; h: number } {
  const b = standsBounds(ALL_STANDS[block]);
  const x = b.x - 10;
  const y = b.y - 6;
  return { x, y, w: b.w + 20, h: b.h + 10 + 4 };
}

/**
 * The static body of one side (back strip, treads, skirt, banners): one canvas the layer shows as one image.
 * Rows paint in order so a lower row covers the riser of the one behind it.
 */
export function bakeStandBody(block: number, atlas: NtAtlas = paintStandsAtlas()): { canvas: PixelCanvas; x: number; y: number } {
  const r = standBodyRect(block);
  const canvas = new PixelCanvas(r.w, r.h);
  const put = (q: StandPiece): void => {
    const f = atlas.frames[q.frame];
    canvas.blit(atlas.canvas.crop(f.x, f.y, f.w, f.h), q.x - r.x, q.y - r.y);
  };
  for (const row of standRows()) {
    if (row.block !== block) continue;
    for (const q of [...row.back, ...row.tread, ...row.skirt, ...row.banners]) put(q);
  }
  return { canvas, x: r.x, y: r.y };
}

/** Scratch / test composite: draws the bodies, rails and posts (no spectators) onto `canvas` (screen coordinates). */
export function composeStandsStatic(canvas: PixelCanvas): void {
  const atlas = paintStandsAtlas();
  const put = (q: StandPiece): void => {
    const f = atlas.frames[q.frame];
    canvas.blit(atlas.canvas.crop(f.x, f.y, f.w, f.h), q.x, q.y);
  };
  const rows = standRows();
  for (let bi = 0; bi < ALL_STANDS.length; bi++) {
    const body = bakeStandBody(bi, atlas);
    canvas.blit(body.canvas, body.x, body.y);
  }
  for (const r of rows) for (const q of [...r.rail, ...r.posts]) put(q);
  void STAND_SKIRT_H;
}
