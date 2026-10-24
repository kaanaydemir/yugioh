// Lane A5-A step A-6 — Şifa Pınarı v3 (docs/v3/A5_PLAN.md §3.5): the signature fountain painter
// (palette only, deterministic, never smaller than the old 82-px geyser, lit from the screen's top
// left), its pool, the scene plan (rise / sink heights, the drops and their rising pitch) and where
// the spring stands (beside the duelist, off every monster zone; a set card's on its own tile).
// (Its own file, like a5-blade.test.ts: tests/cinematics/a5-spells.test.ts belongs to other steps.)

import { afterAll, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // the v3 look (decided once at module init by src/view/layout.ts): set before any import runs
  (globalThis as { __NEON_LOOK?: string }).__NEON_LOOK = 'v3';
});
vi.mock('phaser', async () => (await import('../presentation/_phaser-stub')).phaserStub());

import { PAL } from '../../src/art/palette';
import { PixelCanvas } from '../../src/art/pixel';
import { FOUNTAIN_H, fountainTop, paintFountain, paintFountainPool, type FountainOpts } from '../../src/art/spellmotifs-v3';
import { TILE_H, TILE_W, duelistXY, zoneXY } from '../../src/view/layout';
import { SPRING_V3, dropPitch, springSpot } from '../../src/cinematics/spells/_spring_v3';

afterAll(() => {
  delete (globalThis as { __NEON_LOOK?: string }).__NEON_LOOK;
});

const PALETTE = new Set<number>(Object.values(PAL));

function paletteOnly(p: PixelCanvas): string[] {
  const bad: string[] = [];
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const a = p.alpha(x, y);
      if (a === 0) continue;
      const c = p.get(x, y)!;
      if (a !== 255 || !PALETTE.has(c)) bad.push(`${x},${y}:${c.toString(16)}@${a}`);
    }
  return bad.slice(0, 5);
}

function bounds(p: PixelCanvas): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++)
      if (p.alpha(x, y) > 0) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  return { x0, y0, x1, y1 };
}

const CX = 60;
const BY = 110;
function fountain(h: number, o: FountainOpts = {}): PixelCanvas {
  const p = new PixelCanvas(120, 124);
  paintFountain(p, CX, BY, h, o);
  return p;
}

/** The jet's opaque run on row y (the run through the white core at cx − 1). */
function jetRun(p: PixelCanvas, y: number): { l: number; r: number } {
  let l = CX - 1;
  let r = CX - 1;
  while (p.alpha(l - 1, y) > 0) l--;
  while (p.alpha(r + 1, y) > 0) r++;
  return { l, r };
}

describe('Şifa Pınarı v3 — the signature fountain painter (spellmotifs-v3)', () => {
  const STATES: FountainOpts[] = [
    { phase: 0 },
    { phase: 3, fall: 0.4 },
    { phase: 7, fall: 1 },
    { phase: 11, fall: 1, drain: 0.5, curtainH: FOUNTAIN_H },
    { phase: 2, curtains: 'front' },
    { phase: 5, curtains: 'back' },
  ];

  it('is palette-only and fully opaque at every height and state', () => {
    for (const h of [6, 14, 30, 48, 64, 80, 86])
      for (const o of STATES) expect(paletteOnly(fountain(h, o)), `h ${h} ${JSON.stringify(o)}`).toEqual([]);
  });

  it('is a pure function of its arguments (deterministic, no randomness)', () => {
    for (const o of STATES) expect(Array.from(fountain(80, o).data)).toEqual(Array.from(fountain(80, o).data));
  });

  it('is never smaller than the old 82-px geyser (the user rule of 24 Oct)', () => {
    const b = bounds(fountain(FOUNTAIN_H, { phase: 4, reach: SPRING_V3.reach }));
    // the jet + its crown rise at least 82 px above the floor; the scene's curtains spread at least
    // as wide as the old geyser's (52 px)
    expect(BY - b.y0 + 1).toBeGreaterThanOrEqual(82);
    expect(b.x1 - b.x0 + 1).toBeGreaterThanOrEqual(52);
    expect(Math.max(...SPRING_V3.rise)).toBeGreaterThanOrEqual(82);
    expect(FOUNTAIN_H).toBeGreaterThanOrEqual(80);
  });

  it('thins as it climbs: 11 px at its foot, 9 in the middle, 7 under the crown', () => {
    const p = fountain(FOUNTAIN_H, { phase: 0, curtains: 'none' });
    const w = (y: number) => {
      const r = jetRun(p, y);
      return r.r - r.l + 1;
    };
    // the edges ripple (a gap or a 1-px swell climbs each side): take the commonest width of a few rows
    const mode = (ys: number[]) => {
      const n = new Map<number, number>();
      for (const v of ys.map(w)) n.set(v, (n.get(v) ?? 0) + 1);
      return [...n.entries()].sort((a, b) => b[1] - a[1])[0][0];
    };
    const rows = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => BY - (a + i));
    expect(mode(rows(4, 12))).toBe(11);
    expect(mode(rows(30, 50))).toBe(9);
    expect(mode(rows(66, 74))).toBe(7);
  });

  it('is lit from the screen top left: a white core left of centre, the lit edge left, the shade right', () => {
    const p = fountain(FOUNTAIN_H, { phase: 1, curtains: 'none' });
    let whites = 0;
    let rows = 0;
    for (let y = BY - 60; y <= BY - 20; y++) {
      rows++;
      if (p.get(CX - 1, y) === PAL.white) whites++;
      const r = jetRun(p, y);
      // the left edge is water4 / teal4 (lit), the right edge teal1 / teal2 (shade)
      expect([PAL.water4, PAL.teal4]).toContain(p.get(r.l, y));
      expect([PAL.teal1, PAL.teal2]).toContain(p.get(r.r, y));
    }
    expect(whites / rows).toBeGreaterThan(0.85);
  });

  it('the crown sits on the jet and the drops leave from its top (fountainTop)', () => {
    const p = fountain(FOUNTAIN_H, { phase: 0, curtains: 'none' });
    const top = fountainTop(BY, FOUNTAIN_H);
    // the cap's top row is opaque at the crown top; nothing of the jet itself above it but the thrown drops
    expect(p.alpha(CX - 1, top)).toBeGreaterThan(0);
  });

  it('the curtains fall from the crown (fall 0 → none, more fall → more pixels) and drain from the top', () => {
    const n = (o: FountainOpts) => {
      const p = fountain(FOUNTAIN_H, { phase: 2, ...o });
      let k = 0;
      for (let i = 0; i < p.data.length; i += 4) if (p.data[i + 3]) k++;
      return k;
    };
    const none = n({ curtains: 'none' });
    expect(n({ fall: 0 })).toBe(none);
    expect(n({ fall: 0.5 })).toBeGreaterThan(none);
    expect(n({ fall: 1 })).toBeGreaterThan(n({ fall: 0.5 }));
    expect(n({ fall: 1, drain: 0.6, curtainH: FOUNTAIN_H })).toBeLessThan(n({ fall: 1 }));
  });

  it('the pool is palette-only, with its light band (teal0) round a dark water disc and a teal3 rim', () => {
    const p = new PixelCanvas(90, 50);
    paintFountainPool(p, 45, 25, 24, { phase: 3, halo: 6 });
    expect(paletteOnly(p)).toEqual([]);
    expect(p.get(45 - 28, 25)).toBe(PAL.teal0);
    expect(p.get(45 - 24, 25)).toBe(PAL.teal3);
  });
});

describe('Şifa Pınarı v3 — the scene plan (_spring_v3)', () => {
  it('rises one height per frame to its crest, then settles on FOUNTAIN_H; sinks to 0', () => {
    const r = SPRING_V3.rise;
    const crest = r.indexOf(Math.max(...r));
    for (let i = 1; i <= crest; i++) expect(r[i]).toBeGreaterThan(r[i - 1]);
    for (let i = crest + 1; i < r.length; i++) expect(r[i]).toBeLessThan(r[i - 1]);
    expect(r[r.length - 1]).toBe(FOUNTAIN_H);
    expect(SPRING_V3.dropFrame).toBe(crest);
    const s = SPRING_V3.sink;
    for (let i = 1; i < s.length; i++) expect(s[i]).toBeLessThan(s[i - 1]);
    expect(s[0]).toBeLessThan(FOUNTAIN_H);
    expect(s[s.length - 1]).toBe(0);
  });

  it('six drops, ≤ 50 ms apart, each one pentatonic step higher (an octave over the six)', () => {
    expect(SPRING_V3.drops).toBe(6);
    expect(SPRING_V3.dropGap).toBeLessThanOrEqual(50);
    for (let i = 1; i < SPRING_V3.drops; i++) expect(dropPitch(i)).toBeGreaterThan(dropPitch(i - 1));
    expect(dropPitch(0)).toBe(1);
    expect(dropPitch(5)).toBeCloseTo(2, 6);
  });

  it('the shock ring reaches the old floor ring (56 px)', () => {
    expect(SPRING_V3.shockR[1]).toBeGreaterThanOrEqual(56);
  });

  it('a hand card springs beside its duelist, off the board: no monster zone under its footprint', () => {
    for (const p of [0, 1] as const) {
      const s = springSpot(p, null);
      const d = duelistXY(p);
      expect(Math.abs(s.x - d.x)).toBeLessThanOrEqual(48);
      // the fountain's footprint (curtains ± reach, the pool's light band) vs every monster tile diamond
      const half = SPRING_V3.reach + SPRING_V3.halo;
      for (const q of [0, 1] as const)
        for (let i = 0; i < 3; i++) {
          const z = zoneXY(q, 'monster', i);
          const dx = Math.abs(z.x - s.x);
          // a body standing on the tile spans ±TILE_W/2 sideways and up to ~70 px up from its tile
          const overlapX = dx < TILE_W / 2 + half;
          const overlapY = z.y > s.y - 100 && z.y - 70 < s.y + TILE_H / 2;
          expect(overlapX && overlapY, `P${p + 1} spring vs P${q + 1} monster ${i}`).toBe(false);
        }
    }
  });

  it('EF-2: on a set tile the fountain covers well under half of a body standing on the tile behind it', () => {
    // a body's box on the monster tile one row behind the spell / trap tile (P1: +32, −16), 52 × 64 px
    // up from its feet, against every opaque pixel of the full fountain (jet, crown, all curtains)
    const p = new PixelCanvas(200, 200);
    const base = { x: 80, y: 150 };
    paintFountain(p, base.x, base.y, FOUNTAIN_H, { phase: 3, reach: SPRING_V3.reach });
    const feet = { x: base.x + 32, y: base.y - 16 };
    let inBox = 0;
    let covered = 0;
    for (let y = feet.y - 64; y < feet.y; y++)
      for (let x = feet.x - 26; x < feet.x + 26; x++) {
        inBox++;
        if (p.alpha(x, y) > 0) covered++;
      }
    expect(covered / inBox).toBeLessThan(0.2);
  });

  it('a set card springs from its own tile', () => {
    const home = zoneXY(0, 'spellTrap', 2);
    expect(springSpot(0, home)).toEqual({ x: Math.round(home.x), y: Math.round(home.y) });
  });
});
