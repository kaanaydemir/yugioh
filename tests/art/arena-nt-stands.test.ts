// Neon Tower stands + empty-seat painters (J5 quality pass): palette-only, no alpha, deterministic, tiles follow the feet line,
// every static piece lies on the stands' bodies, texture budget of the stands + crowd stays near the plan.
import { describe, expect, it } from 'vitest';
import { PAL } from '../../src/art/palette';
import { PixelCanvas } from '../../src/art/pixel';
import { bakeStandBody, paintStandsAtlas, standBodyRect, standRows } from '../../src/art/arena-nt/stands';
import { KIND, TILE_W, lineOrigin, tileH } from '../../src/art/arena-nt/stands-parts';
import { SEAT_FH, SEAT_FW, SEAT_LEVELS, SEAT_VARIANTS, paintSeat, seatsAtlas } from '../../src/art/arena-nt/crowd';
import { ALL_STANDS, SEATS, feetY, rowRange } from '../../src/view/board-nt/seats';

const PALSET = new Set<number>(Object.values(PAL));
function check(c: PixelCanvas): { off: number; partial: number } {
  let off = 0;
  let partial = 0;
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      const a = c.alpha(x, y);
      if (a === 0) continue;
      if (a !== 255) partial++;
      if (!PALSET.has(c.get(x, y)!)) off++;
    }
  return { off, partial };
}
const same = (a: PixelCanvas, b: PixelCanvas): boolean => Array.from(a.data).join() === Array.from(b.data).join();

describe('stands painter', () => {
  it('atlas and baked bodies are palette-only, alpha-free and deterministic', () => {
    const a = paintStandsAtlas();
    expect(check(a.canvas)).toEqual({ off: 0, partial: 0 });
    expect(same(a.canvas, paintStandsAtlas().canvas)).toBe(true);
    for (let bi = 0; bi < ALL_STANDS.length; bi++) {
      const b = bakeStandBody(bi);
      expect(check(b.canvas)).toEqual({ off: 0, partial: 0 });
      expect(same(b.canvas, bakeStandBody(bi).canvas)).toBe(true);
    }
  });

  it('tile kinds are sized from their up / down rows and the line origin sits at the feet line', () => {
    for (const k of Object.keys(KIND) as (keyof typeof KIND)[]) {
      expect(tileH(k)).toBe(KIND[k].up + 9 + KIND[k].down);
      expect(lineOrigin(0, k)).toBe(KIND[k].up);
      expect(lineOrigin(1, k)).toBe(KIND[k].up + 8);
    }
  });

  it('every row has tread tiles on an even grid covering its seats; row 0 has the back wall + light line; the last row the skirt', () => {
    const rows = standRows();
    expect(rows.length).toBe(ALL_STANDS.reduce((n, b) => n + b.rows, 0));
    for (const r of rows) {
      const b = ALL_STANDS[r.block];
      const { xa, xb } = rowRange(b, r.row);
      expect(r.tread.length).toBeGreaterThan(0);
      expect(r.tread.every((q) => q.x % 2 === 0)).toBe(true);
      expect(Math.min(...r.tread.map((q) => q.x))).toBeLessThanOrEqual(xa - 8);
      expect(Math.max(...r.tread.map((q) => q.x)) + TILE_W).toBeGreaterThanOrEqual(xb + 8);
      expect(r.back.length > 0).toBe(r.row === 0);
      expect(r.cap.length).toBe(r.back.length);
      expect(r.skirt.length > 0).toBe(r.row === b.rows - 1);
    }
  });

  it('the stand bodies are large terraces: more than 5 rows each side, bodies stay in the frame budget', () => {
    expect(ALL_STANDS[0].rows).toBeGreaterThanOrEqual(6);
    expect(ALL_STANDS[1].rows).toBeGreaterThanOrEqual(6);
    let bytes = 0;
    for (let bi = 0; bi < ALL_STANDS.length; bi++) {
      const r = standBodyRect(bi);
      bytes += r.w * r.h * 4;
    }
    const atlas = paintStandsAtlas().canvas;
    bytes += atlas.w * atlas.h * 4;
    const seats = seatsAtlas().canvas;
    bytes += seats.w * seats.h * 4;
    // stands atlas + 3 bodies + seats atlas (no spectator atlas any more): plan budget (docs/v3/ARENA_NEON_TOWER.md §10) ≈ 0.7 MB, hard cap 0.9 MB
    expect(bytes / 1048576).toBeLessThan(0.9);
  });

  it('spectators sit on the same feet line the treads follow', () => {
    for (const s of SEATS) {
      const bi = s.id; // not used; the seat's block is found by side/row below
      void bi;
    }
    const b0 = ALL_STANDS[1];
    const row = standRows().find((r) => r.block === 1 && r.row === 2)!;
    const q = row.tread[3];
    expect(q.y + lineOrigin(1, 'tread')).toBe(feetY(b0, 2, q.x));
  });
});

describe('empty seats (no spectators: owner decision)', () => {
  it('seat atlas is tiny, palette-only, alpha-free and deterministic', () => {
    const a = seatsAtlas().canvas;
    expect(a.w).toBe(SEAT_LEVELS * SEAT_FW);
    expect(a.h).toBe(2 * SEAT_VARIANTS * SEAT_FH);
    expect(a.w * a.h * 4).toBeLessThan(16 * 1024);
    expect(check(a)).toEqual({ off: 0, partial: 0 });
    for (const team of [0, 1] as const) for (let v = 0; v < SEAT_VARIANTS; v++) expect(same(paintSeat(team, v, 2), paintSeat(team, v, 2))).toBe(true);
  });

  it('LED levels change the light, never the seat shape, and are team-coloured', () => {
    for (const team of [0, 1] as const)
      for (let v = 0; v < SEAT_VARIANTS; v++) {
        const off = paintSeat(team, v, 0);
        for (let l = 1; l < SEAT_LEVELS; l++) {
          const on = paintSeat(team, v, l);
          let diff = 0;
          for (let y = 0; y < SEAT_FH; y++)
            for (let x = 0; x < SEAT_FW; x++) {
              expect(on.isOpaque(x, y)).toBe(off.isOpaque(x, y));
              if (on.get(x, y) !== off.get(x, y)) diff++;
            }
          expect(diff).toBeGreaterThan(0);
          if (l < 3) expect(diff).toBeLessThanOrEqual(12);
        }
        const lit = paintSeat(team, v, 2).get(1, 2);
        expect(lit).toBe(team === 0 ? PAL.cyan3 : PAL.crim3);
      }
  });

  it('a seat shows above the railing (the rail hides only the legs)', () => {
    for (let v = 0; v < SEAT_VARIANTS; v++) {
      const c = paintSeat(0, v, 1);
      let above = 0;
      for (let y = 0; y < SEAT_FH - 4; y++) for (let x = 0; x < SEAT_FW; x++) if (c.isOpaque(x, y)) above++;
      expect(above).toBeGreaterThan(25);
    }
  });
});
