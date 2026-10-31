// Neon Tower: the grandstand SEATS (consumed by the crowd layer and the stands painter).
//
// Pure data, no Phaser: where every spectator stands, which row draws when, and how the row's depth
// interleaves with the stand's railings. The geometry follows layout-nt.ts STANDS (docs §8): four
// tiers per side, the feet line of tier k being
//     left  (side 0, blue):    y = a + floor(x / 2) + rowDy·k
//     right (side 1, crimson): y = a − ceil(x / 2) + rowDy·k
// and tier k covering x0 + shiftA·k … min(xMax, x1 + shiftB·k): every tier lies rowDy px lower at the same
// x and is shifted outward along the iso diagonal, so the tiers stack like a flight of terraces and each row
// shows a clean band of heads above the railing of the one in front of it.
//
// DEPTH CONTRACT (the stand's railings sit IN FRONT of their own row and BEHIND the next row):
//   row k spectators  → seatDepth(k)  = NT_DEPTH.crowd + 0.1·k
//   row k railing     → railDepth(k)  = NT_DEPTH.crowd + 0.1·k + 0.05          (stands.ts draws it)
//   steps / skirt     → NT_DEPTH.stands (below every spectator)
// The crowd layer draws one batch PER ROW at seatDepth(row) (still a single atlas). Glow sticks / reaction
// sparks stay at NT_DEPTH.crowdFx (18, above all rails). The railing hides the lowest RAIL_H pixels of the
// spectator cell (feet and shins), so poses keep everything that matters above `y − RAIL_H`.
//
// Seats are listed row by row, left to right, front row (nearest the platform) first. Every number is
// an integer screen pixel (feet = bottom centre of the 14×22 spectator cell, CROWD_CELL).

import { CROWD_CELL, NT_DEPTH, type StandBlock } from './layout-nt';

/**
 * J5 re-fit to the thick platform (FACE_H 52, armour bottom y = 178 + x/2 left / 448 − x/2 right): large stepped terraces
 * that fill the side bays. Row 0 is the highest tier (nearest the platform, a back wall rises behind it), every further tier
 * lies 13 px lower and steps outward along the iso diagonal, so the terraces climb up to the wall like a flight of stairs.
 * Left bay (beside the platform's left end cap, under the hologram plinth): 7 tiers down to the P1 panel (rows clamp at
 * x = SEAT_X_MIN so the outer tiers stay inside the frame). Right bay: 7 tiers, ending above the button column.
 */
export const MAIN_STANDS: readonly StandBlock[] = [
  { side: 0, rows: 7, feet0: { a: 128, slope: 0.5 }, x0: 76, x1: 150, rowDy: 13, shiftA: -16, shiftB: -16, xMax: 150, pitch: 8 },
  { side: 1, rows: 7, feet0: { a: 480, slope: -0.5 }, x0: 476, x1: 626, rowDy: 13, shiftA: 16, shiftB: 0, xMax: 626, pitch: 8 },
];
/**
 * Front-left terrace (J-fit): continues the blue crowd along the platform's lower-left (front) face, row 0 8 px below the armour
 * bottom (feet y = 162 + x/2, the same offset the right stand has: 480 − x/2 vs 472 − x/2). Six tiers step outward (down-left) into
 * the lower-left corner; it stops left of the hint plate (x 174) and above the P1 panel (y 292). Same side / team as block 0.
 */
export const EXTRA_STANDS: readonly StandBlock[] = [
  { side: 0, rows: 6, feet0: { a: 162, slope: 0.5 }, x0: 126, x1: 190, rowDy: 13, shiftA: -16, shiftB: -16, xMax: 190, pitch: 8 },
];
/** Every stand block: the two bays first (ids 0 = left, 1 = right), then the extra terraces. The index is the block id. */
export const ALL_STANDS: readonly StandBlock[] = [...MAIN_STANDS, ...EXTRA_STANDS];
/** Left-most spectator foot x (the cell is 14 wide and must stay in the frame). */
export const SEAT_X_MIN = 8;

/** Height of the railing in front of a row: the spectator cell's bottom RAIL_H pixels are covered. */
export const RAIL_H = 4;

export interface Seat {
  /** Index in SEATS (stable). */
  readonly id: number;
  /** 0 = blue stand on the left, 1 = crimson stand on the right. */
  readonly side: 0 | 1;
  /** 0 = front row (nearest the platform), 1, 2, 3 = further out and lower. */
  readonly row: number;
  /** Column in the row, left to right. */
  readonly col: number;
  /** Feet position (bottom centre of the cell), integer screen pixels. */
  readonly x: number;
  readonly y: number;
  /** Spectators face the platform: the left stand looks right (default art), the right stand is mirrored. */
  readonly flipX: boolean;
  /** Draw depth of this seat's batch (see the contract above). */
  readonly depth: number;
  /** The team colour of the glow sticks: 0 blue, 1 red. */
  readonly team: 0 | 1;
  /** Deterministic 0…1 hash per seat (look, pose phase and period seed: no Math.random). */
  readonly seed: number;
}

export function seatDepth(row: number): number {
  return NT_DEPTH.crowd + 0.1 * row;
}
export function railDepth(row: number): number {
  return NT_DEPTH.crowd + 0.1 * row + 0.05;
}

/** Row `k` of block `b`: the feet y at screen x (integer math, shared by seats and the stand painter). */
export function feetY(b: StandBlock, k: number, x: number): number {
  return b.side === 0 ? b.feet0.a + Math.floor(x / 2) + b.rowDy * k : b.feet0.a - Math.ceil(x / 2) + b.rowDy * k;
}

/** x range [xa, xb] (feet x of the first / last seat) of row `k` of block `b`. */
export function rowRange(b: StandBlock, k: number): { xa: number; xb: number } {
  return { xa: Math.max(SEAT_X_MIN, b.x0 + b.shiftA * k), xb: Math.min(b.xMax, b.x1 + b.shiftB * k) };
}

/**
 * The aisles (a lit stair gap without seats): one in the long right stand (row k's gap starts at x = x0 + shift·k, the tiers step
 * outward so the aisle runs down the iso diagonal) and one in the left bay. AISLE_W px wide; seats keep AISLE_PAD px clear on both
 * sides (half a spectator cell). A gap that would fall off a short row is dropped for that row.
 */
export const AISLE_W = 16;
export const AISLE_PAD = 7;
const AISLES = new Map<StandBlock, { x0: number; shift: number }>([
  [ALL_STANDS[0], { x0: 92, shift: -16 }],
  [ALL_STANDS[1], { x0: 544, shift: 16 }],
]);

/** Left x of the aisle gap in row `k` of block `b` (null = no aisle in that stand / row). */
export function aisleX(b: StandBlock, k: number): number | null {
  const a = AISLES.get(b);
  if (!a) return null;
  const x = a.x0 + a.shift * k;
  const { xa, xb } = rowRange(b, k);
  return x >= xa + 24 && x + AISLE_W <= xb - 8 ? x : null;
}

function hash(n: number): number {
  let h = (n ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function build(): Seat[] {
  const out: Seat[] = [];
  ALL_STANDS.forEach((b, bi) => {
    for (let k = 0; k < b.rows; k++) {
      const { xa, xb } = rowRange(b, k);
      // odd rows start half a pitch in, so the spectators do not stack in columns
      const start = xa + (k % 2 === 1 ? b.pitch / 2 : 0);
      const ax = aisleX(b, k);
      let col = 0;
      const push = (x: number): void => {
        out.push({
          id: out.length,
          side: b.side,
          row: k,
          col: col++,
          x,
          y: feetY(b, k, x),
          flipX: b.side === 1,
          depth: seatDepth(k),
          team: b.side,
          seed: hash(b.side * 1000 + k * 100 + col + bi * 5000),
        });
      };
      // group A: from the row start up to the aisle (or the row end); group B restarts right after the gap
      for (let x = start; x <= xb; x += b.pitch) {
        if (ax !== null && x > ax - AISLE_PAD) break;
        push(x);
      }
      if (ax !== null) for (let x = ax + AISLE_W + AISLE_PAD; x <= xb; x += b.pitch) push(x);
    }
  });
  return out;
}

/** Every spectator seat, both stands. */
export const SEATS: readonly Seat[] = build();

/** The seats of one side, row by row. */
export function seatsOf(side: 0 | 1): readonly Seat[] {
  return SEATS.filter((s) => s.side === side);
}

/** Sprite cell size re-exported for convenience (feet at the bottom centre). */
export const SEAT_CELL = CROWD_CELL;
