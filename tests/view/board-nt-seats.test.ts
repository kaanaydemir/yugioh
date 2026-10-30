// Neon Tower seats (owner A2): the grandstand seat list is deterministic, inside the frame, clear of the HUD
// keep-out rects (apart from the allowed "behind" ones) and respects the depth contract with the railings.
import { describe, expect, it } from 'vitest';
import { KEEP_OUT, NT_DEPTH, rectsOverlap, CROWD_CELL } from '../../src/view/board-nt/layout-nt';
import { SEATS, railDepth, seatDepth, seatsOf } from '../../src/view/board-nt/seats';

describe('neon tower seats', () => {
  it('has both stands filled, left blue and right crimson', () => {
    expect(seatsOf(0).length).toBeGreaterThan(20);
    expect(seatsOf(1).length).toBeGreaterThan(40);
    expect(SEATS.every((s) => s.team === s.side && s.flipX === (s.side === 1))).toBe(true);
  });
  it('keeps every spectator cell inside the frame and off the always-visible HUD', () => {
    for (const s of SEATS) {
      const r = { x: s.x - CROWD_CELL.w / 2, y: s.y - CROWD_CELL.h, w: CROWD_CELL.w, h: CROWD_CELL.h };
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(640);
      for (const k of ['hint', 'p1Panel', 'hand', 'buttons', 'p2Panel', 'toolbar', 'phaseBar'])
        expect(rectsOverlap(r, KEEP_OUT[k]), `seat ${s.id} vs ${k}`).toBe(false);
    }
  });
  it('is deterministic and integer', () => {
    for (const s of SEATS) expect(Number.isInteger(s.x) && Number.isInteger(s.y)).toBe(true);
    expect(SEATS.map((s) => s.id)).toEqual(SEATS.map((_, i) => i));
  });
  it('puts a row\'s railing between its own spectators and the next row\'s', () => {
    for (let k = 0; k < 3; k++) {
      expect(railDepth(k)).toBeGreaterThan(seatDepth(k));
      expect(railDepth(k)).toBeLessThan(seatDepth(k + 1));
    }
    expect(railDepth(2)).toBeLessThan(NT_DEPTH.crowdFx);
    expect(seatDepth(0)).toBeGreaterThan(NT_DEPTH.stands);
  });
});
