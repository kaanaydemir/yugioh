// Kristal Ejder (crystal_wyrm) — the v3 card picture (src/art/cardart-v3/crystal_wyrm.ts): both sizes are hand-made
// (no blind reduction), inside the style sheet's budgets (docs/v3/KART_RESIMLERI.md §10), deterministic, living by
// palette swaps only, and wired: the v3 sprite's `portrait` paints the 44×34 picture and the v3 card-face registry
// (lane-e.ts) knows it.
import { describe, expect, it } from 'vitest';
import card from '../../src/art/cardart-v3/crystal_wyrm';
import { artStats, checkerCount, renderArt } from '../../src/art/cardart-v3/_kit';
import { ART_BIG, ART_SMALL, BACKDROP_COLORS_MAX, COLORS_MAX, ISOLATED_MAX } from '../../src/art/cardart-v3/_types';
import { LANE_E_ART } from '../../src/art/cardart-v3/lane-e';
import { PixelCanvas } from '../../src/art/pixel';
import { PAL } from '../../src/art/palette';

const CYAN: readonly number[] = [PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4];
const GOLD: readonly number[] = [PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4];

function count(p: PixelCanvas, tones: readonly number[]): number {
  let n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (tones.includes(p.get(x, y) ?? -1)) n++;
  return n;
}

describe('crystal_wyrm card picture', () => {
  it('both sizes are hand-made and inside the kit budgets', () => {
    expect(card.id).toBe('crystal_wyrm');
    expect(card.frames).toBe(6);
    const r = renderArt(card, 0);
    expect(r.auto).toBe(false);
    for (const [l, pic, focus, geom] of [
      [r.big, r.bigPx, card.focus, ART_BIG],
      [r.small, r.smallPx, card.focusSmall!, ART_SMALL],
    ] as const) {
      const st = artStats(l, pic, focus, true);
      expect(st.offPalette, l.size).toBe(0);
      expect(st.colors, l.size).toBeLessThanOrEqual(COLORS_MAX);
      expect(st.backdropColors, l.size).toBeLessThanOrEqual(BACKDROP_COLORS_MAX);
      expect(st.isolated, l.size).toBeLessThanOrEqual(ISOLATED_MAX);
      expect(st.outlineInk, l.size).toBeGreaterThanOrEqual(0.9);
      // no dither: 2×2 checkers ≤ 0.5 % of the visible window
      const vis = (geom.visible.x1 - geom.visible.x0 + 1) * (geom.visible.y1 - geom.visible.y0 + 1);
      expect(checkerCount(pic) / vis, l.size).toBeLessThanOrEqual(0.005);
      // the focus (the eye) sits in the focus box
      const b = geom.focusBox;
      expect(focus[0] >= b.x0 && focus[0] <= b.x1 && focus[1] >= b.y0 && focus[1] <= b.y1, l.size).toBe(true);
    }
  });

  it('reads as the LIGHT ace: cyan glass wing, gold horns, a cyan eye, on the gold sun', () => {
    const r = renderArt(card, 0);
    for (const [l, pic] of [
      [r.big, r.bigPx],
      [r.small, r.smallPx],
    ] as const) {
      const area = pic.w * pic.h;
      // the glass is a large shape (≥ 12 % of the window), the horns a clear accent (≥ 4 %) in the subject
      expect(count(l.subject, CYAN) / area, l.size).toBeGreaterThan(0.12);
      expect(count(l.subject, GOLD) / area, l.size).toBeGreaterThan(0.04);
      // the LIGHT recipe: the backdrop's light shape is gold
      expect(count(l.backdrop, [PAL.gold1, PAL.gold2]) / area, l.size).toBeGreaterThan(0.2);
    }
    // the eye: cyan iris pixels right at the focus (big) and its white glint on frame 0 (both sizes)
    const [fx, fy] = card.focus;
    let iris = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) if (CYAN.includes(r.bigPx.get(fx + dx, fy + dy) ?? -1)) iris++;
    expect(iris).toBeGreaterThanOrEqual(6);
    let glint = 0;
    for (const l of [r.big.light, r.small.light]) for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) if (l.get(x, y) === PAL.white) glint++;
    expect(glint).toBeGreaterThanOrEqual(2);
  });

  it('is deterministic and lives by palette swaps only (the silhouette never moves)', () => {
    const a = renderArt(card, 0);
    const b = renderArt(card, 0);
    expect([...a.bigPx.data]).toEqual([...b.bigPx.data]);
    expect([...a.smallPx.data]).toEqual([...b.smallPx.data]);
    let changed = 0;
    for (let f = 1; f < 6; f++) {
      const r = renderArt(card, f);
      for (const [p, q] of [
        [a.bigPx, r.bigPx],
        [a.smallPx, r.smallPx],
      ] as const) {
        let d = 0;
        for (let i = 0; i < p.data.length; i += 4) if (p.data[i] !== q.data[i] || p.data[i + 1] !== q.data[i + 1] || p.data[i + 2] !== q.data[i + 2]) d++;
        expect(d).toBeLessThanOrEqual(12);
        changed += d;
      }
      // the subject layer is the same in every frame (light-layer swaps only)
      expect([...r.big.subject.data]).toEqual([...a.big.subject.data]);
    }
    expect(changed).toBeGreaterThan(0);
  });

  it('is wired: the v3 face registry paints the hand picture', () => {
    const paint = LANE_E_ART.crystal_wyrm;
    expect(paint).toBeTruthy();
    const p = new PixelCanvas(ART_SMALL.w, ART_SMALL.h);
    paint!(p);
    expect([...p.data]).toEqual([...renderArt(card, 0).smallPx.data]);
  });
});
