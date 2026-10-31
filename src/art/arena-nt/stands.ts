// Neon Tower painter: STANDS — owner A2 (docs/v3/ARENA_NEON_TOWER.md §2 / §6 / §8).
// The two tiered grandstands as geometry WITHOUT spectators: per row a tread + riser (the staircase the
// crowd stands on), the railing in front of the row, a back strip behind row 0, an outer skirt (with team banners)
// under the last row, newel posts at the row ends, an aisle staircase in the long (right) stand. All of it is
// 16-px tiles that follow the feet line of seats.ts, packed in one tiny atlas; the layer bakes the static tiles
// into ONE image per side (bakeStandBody) and draws the railings with Blitters (animated light chase).
// Pure PixelCanvas code (Node-safe).

import { PixelCanvas } from '../pixel';
import type { StandBlock } from '../../view/board-nt/layout-nt';
import { ALL_STANDS, AISLE_W, aisleX, feetY, rowRange } from '../../view/board-nt/seats';
import { packAtlas, type NtAtlas } from './wall-kit';
import { POST_H, TILE_W, lineOrigin, paintAisle, paintBack, paintBanner, paintCap, paintPost, paintRail, paintSkirt, paintTread, tileH, type StandSide, type TileKind } from './stands-parts';

/** Texture key of the stands atlas (frames named inside). */
export const NT_STANDS_KEY = 'nt:stands';
/** Key of the baked static body of a side. */
export const ntStandBodyKey = (block: number): string => `nt:stands:body:${block}`;

export function paintStandsAtlas(): NtAtlas {
  const f: [string, PixelCanvas][] = [];
  for (const s of [0, 1] as const) {
    for (const v of [0, 1, 2] as const) {
      f.push([`tread:${s}:${v}`, paintTread(s, v)]);
      f.push([`back:${s}:${v}`, paintBack(s, v)]);
      f.push([`cap:${s}:${v}`, paintCap(s, v)]);
    }
    f.push([`rail:${s}:0`, paintRail(s, 0)]);
    f.push([`rail:${s}:1`, paintRail(s, 1)]);
    f.push([`aisle:${s}`, paintAisle(s)]);
    f.push([`skirt:${s}:0`, paintSkirt(s, 0)]);
    f.push([`skirt:${s}:1`, paintSkirt(s, 1)]);
    f.push([`post:${s}:0`, paintPost(0, s)]);
    f.push([`post:${s}:1`, paintPost(1, s)]);
    f.push([`banner:${s}`, paintBanner(s)]);
  }
  return packAtlas(f, 176);
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
  /** back wall tiles (row 0 only) */
  back: StandPiece[];
  /** the animated accent line over the back wall's groove (row 0 only; index = position in the wall light wave) */
  cap: StandPiece[];
  /** outer skirt tiles (last row only) */
  skirt: StandPiece[];
  /** banners hanging on the skirt (last row only) */
  banners: StandPiece[];
  /** newel posts at both ends of the row (drawn with the rail) */
  posts: StandPiece[];
}

/** Tile origin y of a tile of `kind` whose feet line is at `fy` (x_t). */
const oy = (side: StandSide, kind: TileKind, fy: number): number => fy - lineOrigin(side, kind);

function rowPieces(b: StandBlock, bi: number, k: number): StandRow {
  const side = b.side as StandSide;
  const { xa, xb } = rowRange(b, k);
  const out: StandRow = { side, block: bi, row: k, tread: [], rail: [], back: [], cap: [], skirt: [], banners: [], posts: [] };
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
    const fy = feetY(b, k, xt);
    const isAisle = ax !== null && xt === ax;
    out.tread.push({ frame: isAisle ? `aisle:${side}` : `tread:${side}:${(i + k * 2) % 5 === 0 ? 1 : (i + k) % 4 === 0 ? 2 : 0}`, x: xt, y: oy(side, isAisle ? 'aisle' : 'tread', fy) });
    if (!isAisle) out.rail.push({ frame: `rail:${side}:0`, x: xt, y: oy(side, 'rail', fy) });
    if (k === 0 && !isAisle) {
      out.back.push({ frame: `back:${side}:${(i + b.rows) % 3}`, x: xt, y: oy(side, 'back', fy) });
      out.cap.push({ frame: `cap:${side}:0`, x: xt, y: oy(side, 'cap', fy) });
    }
    if (last) out.skirt.push({ frame: `skirt:${side}:${i % 2}`, x: xt, y: oy(side, 'skirt', fy) });
  });
  if (last) {
    // a banner on every third skirt tile (not at the very ends)
    xs.forEach((xt, i) => {
      if (i % 3 !== 1 || i === 0 || i === xs.length - 1 || xt === ax) return;
      const bx = xt + 2;
      out.banners.push({ frame: `banner:${side}`, x: bx, y: feetY(b, k, bx + 6) + 5 });
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

/** Atlas the layer and the bakers share (painted once). */
let atlasMemo: NtAtlas | null = null;
export function standsAtlasShared(): NtAtlas {
  return (atlasMemo ??= paintStandsAtlas());
}

/** Every static piece (back wall, treads, skirt, banners) of block `block`, in paint order. */
function bodyPieces(block: number): StandPiece[] {
  const out: StandPiece[] = [];
  for (const row of standRows()) if (row.block === block) out.push(...row.back, ...row.tread, ...row.skirt, ...row.banners);
  return out;
}

/** Where the baked static body of a side sits (screen rect: the union of its pieces, 2 px margin). */
export function standBodyRect(block: number): { x: number; y: number; w: number; h: number } {
  const atlas = standsAtlasShared();
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const q of bodyPieces(block)) {
    const f = atlas.frames[q.frame];
    x0 = Math.min(x0, q.x);
    y0 = Math.min(y0, q.y);
    x1 = Math.max(x1, q.x + f.w);
    y1 = Math.max(y1, q.y + f.h);
  }
  return { x: x0 - 2, y: y0 - 2, w: x1 - x0 + 4, h: y1 - y0 + 4 };
}

/**
 * The static body of one side (back wall, treads, skirt, banners): one canvas the layer shows as one image.
 * Rows paint in order so a lower row covers the riser of the one behind it.
 */
export function bakeStandBody(block: number, atlas: NtAtlas = standsAtlasShared()): { canvas: PixelCanvas; x: number; y: number } {
  const r = standBodyRect(block);
  const canvas = new PixelCanvas(r.w, r.h);
  for (const q of bodyPieces(block)) {
    const f = atlas.frames[q.frame];
    canvas.blit(atlas.canvas.crop(f.x, f.y, f.w, f.h), q.x - r.x, q.y - r.y);
  }
  return { canvas, x: r.x, y: r.y };
}

/** Scratch / test composite: draws the bodies, rails and posts (no spectators) onto `canvas` (screen coordinates). */
export function composeStandsStatic(canvas: PixelCanvas): void {
  const atlas = standsAtlasShared();
  const put = (q: StandPiece): void => {
    const f = atlas.frames[q.frame];
    canvas.blit(atlas.canvas.crop(f.x, f.y, f.w, f.h), q.x, q.y);
  };
  const rows = standRows();
  for (let bi = 0; bi < ALL_STANDS.length; bi++) {
    const body = bakeStandBody(bi, atlas);
    canvas.blit(body.canvas, body.x, body.y);
  }
  for (const r of rows) for (const q of [...r.cap, ...r.rail, ...r.posts]) put(q);
}
