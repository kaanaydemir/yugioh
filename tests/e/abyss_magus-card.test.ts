// Uçurum Büyücüsü (abyss_magus) — the v3 card picture (src/art/cardart-v3/abyss_magus.ts): the v3 sprite's own pixels 1:1
// in a card pose, both sizes hand-made (no blind reduction), inside the style sheet's budgets (docs/v3/KART_RESIMLERI.md §10),
// deterministic, living by the light layer only (flame, orb heart, motes), and wired: the v3 card-face registry (lane-e.ts)
// and the v3 sprite's `portrait` (under V3_CARDS) paint the 44×34 picture; without the v3 faces the v1 close-up stays.
import { afterEach, describe, expect, it, vi } from 'vitest';
import card from '../../src/art/cardart-v3/abyss_magus';
import { artStats, checkerCount, renderArt } from '../../src/art/cardart-v3/_kit';
import { ART_BIG, ART_SMALL, BACKDROP_COLORS_MAX, COLORS_MAX, ISOLATED_MAX, SUBJECT_FILL } from '../../src/art/cardart-v3/_types';
import { LANE_E_ART } from '../../src/art/cardart-v3/lane-e';
import { PixelCanvas } from '../../src/art/pixel';
import { PAL } from '../../src/art/palette';

vi.mock('phaser', async () => (await import('../presentation/_phaser-stub')).phaserStub());

const VOID: readonly number[] = [PAL.void0, PAL.void1, PAL.void2, PAL.void3, PAL.void4];
const SLATE: readonly number[] = [PAL.night2, PAL.night3, PAL.night4, PAL.steel, PAL.mist];

function count(p: PixelCanvas, tones: readonly number[]): number {
  let n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (tones.includes(p.get(x, y) ?? -1)) n++;
  return n;
}

const G = globalThis as Record<string, unknown>;
afterEach(() => {
  delete G.__NEON_LOOK;
  delete G.__NEON_V3FLAGS;
});

describe('abyss_magus card picture', () => {
  it('both sizes are hand-made and inside the kit budgets, on every frame', () => {
    expect(card.id).toBe('abyss_magus');
    expect(card.frames).toBe(6);
    for (let f = 0; f < card.frames!; f++) {
      const r = renderArt(card, f);
      expect(r.auto).toBe(false);
      for (const [l, pic, focus, geom] of [
        [r.big, r.bigPx, card.focus, ART_BIG],
        [r.small, r.smallPx, card.focusSmall!, ART_SMALL],
      ] as const) {
        const tag = `${l.size} f${f}`;
        const st = artStats(l, pic, focus, true);
        expect(st.offPalette, tag).toBe(0);
        expect(st.colors, tag).toBeLessThanOrEqual(COLORS_MAX);
        expect(st.backdropColors, tag).toBeLessThanOrEqual(BACKDROP_COLORS_MAX);
        expect(st.isolated, tag).toBeLessThanOrEqual(ISOLATED_MAX);
        expect(st.outlineInk, tag).toBeGreaterThanOrEqual(0.9);
        // no dither: 2×2 checkers ≤ 0.5 % of the visible window
        const vis = (geom.visible.x1 - geom.visible.x0 + 1) * (geom.visible.y1 - geom.visible.y0 + 1);
        expect(checkerCount(pic) / vis, tag).toBeLessThanOrEqual(0.005);
        // the focus (the near eye) sits in the focus box
        const b = geom.focusBox;
        expect(focus[0] >= b.x0 && focus[0] <= b.x1 && focus[1] >= b.y0 && focus[1] <= b.y1, tag).toBe(true);
        // the big subject fills 60–75 % of the visible window (the small is the closer crop)
        if (l.size === 'big') {
          expect(st.subjectFill, tag).toBeGreaterThanOrEqual(SUBJECT_FILL[0]);
          expect(st.subjectFill, tag).toBeLessThanOrEqual(SUBJECT_FILL[1]);
        }
      }
    }
  });

  it('reads as the DARK spellcaster: void cloth, slate helm and plates, the white visor at the focus, a void eclipse', () => {
    const r = renderArt(card, 0);
    for (const [l, pic, focus] of [
      [r.big, r.bigPx, card.focus],
      [r.small, r.smallPx, card.focusSmall!],
    ] as const) {
      const area = pic.w * pic.h;
      // the violet cloth / horns / orb are the big mass, the slate armour a clear second
      expect(count(l.subject, VOID) / area, l.size).toBeGreaterThan(0.12);
      expect(count(l.subject, SLATE) / area, l.size).toBeGreaterThan(0.08);
      // the DARK recipe: the eclipse's corona is void (the closer hand crop pushes it out to the corners)
      expect(count(l.backdrop, [PAL.void1, PAL.void2, PAL.void3]) / area, l.size).toBeGreaterThan(l.size === 'big' ? 0.2 : 0.04);
      // the visor slit: white pixels right at the focus
      let white = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -3; dx <= 3; dx++) if (pic.get(focus[0] + dx, focus[1] + dy) === PAL.white) white++;
      expect(white, l.size).toBeGreaterThanOrEqual(2);
      // the void flame and the orb's heart live in the light layer
      expect(count(l.light, [PAL.void4, PAL.white]), l.size).toBeGreaterThan(0);
    }
  });

  it('is deterministic and lives by small light changes (the big silhouette never moves)', () => {
    const a = renderArt(card, 0);
    const b = renderArt(card, 0);
    expect([...a.bigPx.data]).toEqual([...b.bigPx.data]);
    expect([...a.smallPx.data]).toEqual([...b.smallPx.data]);
    let changed = 0;
    for (let f = 1; f < card.frames!; f++) {
      const r = renderArt(card, f);
      for (const [p, q, max] of [
        [a.bigPx, r.bigPx, 40],
        [a.smallPx, r.smallPx, 12],
      ] as const) {
        let d = 0;
        for (let i = 0; i < p.data.length; i += 4) if (p.data[i] !== q.data[i] || p.data[i + 1] !== q.data[i + 1] || p.data[i + 2] !== q.data[i + 2]) d++;
        expect(d).toBeLessThanOrEqual(max);
        changed += d;
      }
      expect([...r.big.subject.data]).toEqual([...a.big.subject.data]);
    }
    expect(changed).toBeGreaterThan(0);
  });

  it('is wired: the v3 face registry paints the hand picture', () => {
    const paint = LANE_E_ART.abyss_magus;
    expect(paint).toBeTruthy();
    const p = new PixelCanvas(ART_SMALL.w, ART_SMALL.h);
    paint!(p);
    expect([...p.data]).toEqual([...renderArt(card, 0).smallPx.data]);
  });

  it('the v3 sprite keeps the v1 close-up without the v3 faces, and paints the picture with them', async () => {
    vi.resetModules();
    G.__NEON_LOOK = 'v3';
    G.__NEON_V3FLAGS = { cards: 'v1' };
    const off = (await import('../../src/art/monsters-v3/abyss_magus')).default;
    const v1 = (await import('../../src/art/monsters/abyss_magus')).default;
    expect(off.portrait).toBe(v1.portrait);

    vi.resetModules();
    G.__NEON_LOOK = 'v3';
    delete G.__NEON_V3FLAGS;
    const on = (await import('../../src/art/monsters-v3/abyss_magus')).default;
    const flags = await import('../../src/view/v3flags');
    expect(flags.V3_CARDS).toBe(true);
    const kit = await import('../../src/art/cardart-v3/_kit');
    const art = (await import('../../src/art/cardart-v3/abyss_magus')).default;
    const pix = await import('../../src/art/pixel');
    const p = new pix.PixelCanvas(ART_SMALL.w, ART_SMALL.h);
    on.portrait!(p);
    expect([...p.data]).toEqual([...kit.renderArt(art, 0).smallPx.data]);
  });
});
