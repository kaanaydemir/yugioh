// Neon Tower: the grandstand SEATS (owner A2; consumed by the crowd layer, owner B1).
//
// Pure data, no Phaser: where every spectator stands, which row draws when, and how the row's depth
// interleaves with the stand's railings. The geometry follows layout-nt.ts STANDS (docs §8): three
// rows per side, the feet line of row k being
//     left  (side 0, blue):   y = a + floor((x + 10k) / 2) + 4k      x = x0 − 10k … x1
//     right (side 1, crimson): y = a − ceil((x − 10k) / 2) + 4k       x = x0 … x1
// i.e. each row is 10 px further out and (at the same x) 9 px lower than the row behind it, so the
// rows stack like terraces and the heads of row k show above the shoulders of row k+1.
//
// DEPTH CONTRACT (the stand's railings sit IN FRONT of their own row and BEHIND the next row):
//   row k spectators  → seatDepth(k)  = NT_DEPTH.crowd + 0.1·k
//   row k railing     → railDepth(k)  = NT_DEPTH.crowd + 0.1·k + 0.05          (stands.ts draws it)
//   tiers / steps     → NT_DEPTH.stands (below every spectator)
// The crowd layer therefore draws one batch PER ROW at seatDepth(row) (three batches per side at most;
// still a single atlas). Glow sticks / reaction sparks stay at NT_DEPTH.crowdFx (18, above all rails).
// The railing hides the lowest RAIL_H pixels of the spectator cell (feet and shins), so poses should
// keep everything that matters above `y − RAIL_H`.
//
// Seats are listed row by row, left to right, front row (nearest the platform) first. Every number is
// an integer screen pixel (feet = bottom centre of the 12×16 spectator cell, CROWD_CELL).

import { CROWD_CELL, NT_DEPTH, STANDS, type StandBlock } from './layout-nt';

/** Height of the railing in front of a row: the spectator cell's bottom RAIL_H pixels are covered. */
export const RAIL_H = 4;

export interface Seat {
  /** Index in SEATS (stable). */
  readonly id: number;
  /** 0 = blue stand on the left, 1 = crimson stand on the right. */
  readonly side: 0 | 1;
  /** 0 = front row (nearest the platform), 1, 2 = further out and lower. */
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
  return b.side === 0 ? b.feet0.a + Math.floor((x + 10 * k) / 2) + 4 * k : b.feet0.a - Math.ceil((x - 10 * k) / 2) + 4 * k;
}

/** x range [xa, xb] (feet x of the first / last seat) of row `k` of block `b`. */
export function rowRange(b: StandBlock, k: number): { xa: number; xb: number } {
  return b.side === 0 ? { xa: b.x0 - 10 * k, xb: b.x1 } : { xa: b.x0, xb: Math.min(b.xMax, b.x1 + 10 * k) };
}

/**
 * The aisle (a lit stair gap without seats) of each stand. Only the right stand has one: row k's gap starts at
 * x = x0 + shift·k (the stand's rows are shifted 10 px outward per row, so the aisle runs down the iso diagonal),
 * AISLE_W px wide; seats keep AISLE_PAD px clear on both sides (half a spectator cell + 1).
 */
export const AISLE_W = 16;
export const AISLE_PAD = 7;
export const AISLES: readonly ({ x0: number; shift: number } | null)[] = [null, { x0: 540, shift: 10 }];

/** Left x of the aisle gap in row `k` of block `b` (null = no aisle in that stand). */
export function aisleX(b: StandBlock, k: number): number | null {
  const a = AISLES[b.side];
  return a ? a.x0 + a.shift * k : null;
}

function hash(n: number): number {
  let h = (n ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function build(): Seat[] {
  const out: Seat[] = [];
  for (const b of STANDS) {
    for (let k = 0; k < b.rows; k++) {
      const { xa, xb } = rowRange(b, k);
      // odd rows start half a pitch in, so the spectators do not stack in columns
      const start = xa + (k % 2 === 1 ? 4 : 0);
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
          seed: hash(b.side * 1000 + k * 100 + col),
        });
      };
      // group A: from the row start up to the aisle (or the row end); group B restarts right after the gap
      for (let x = start; x <= xb; x += b.pitch) {
        if (ax !== null && x > ax - AISLE_PAD) break;
        push(x);
      }
      if (ax !== null) for (let x = ax + AISLE_W + AISLE_PAD; x <= xb; x += b.pitch) push(x);
    }
  }
  return out;
}

/** Every spectator seat, both stands (≈ 27 left + ≈ 55 right). */
export const SEATS: readonly Seat[] = build();

/** The seats of one side, row by row. */
export function seatsOf(side: 0 | 1): readonly Seat[] {
  return SEATS.filter((s) => s.side === side);
}

/** Sprite cell size re-exported for convenience (feet at the bottom centre). */
export const SEAT_CELL = CROWD_CELL;
