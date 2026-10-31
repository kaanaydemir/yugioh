// Çamur Pençe Ruhu (mudgrasp_spirit, C10): the v3 card picture (88×68 + hand-corrected 44×34) and its hand-drawn
// 16×12 field icon. The rig has (or will have) its own test.
import { describe, expect, it } from 'vitest';
import card, { mudgraspIcon } from '../../src/art/cardart-v3/mudgrasp_spirit';
import { PixelCanvas } from '../../src/art/pixel';
import { PAL } from '../../src/art/palette';
import { artStats, checkerCount, foreignBackdropTones, renderArt } from '../../src/art/cardart-v3/_kit';

const lum = (c: number | null) => (c === null ? 0 : (((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.55 + (c & 255) * 0.15) / 255);
const PALETTE = new Set<number>(Object.values(PAL) as number[]);

describe('mudgrasp_spirit card art (v3)', () => {
  it('paints both sizes, every living frame, within the kit budgets; small is hand-made, not the auto draft', () => {
    expect(card.id).toBe('mudgrasp_spirit');
    expect(card.frames).toBe(6);
    for (let f = 0; f < (card.frames ?? 1); f++) {
      const r = renderArt(card, f);
      expect(r.auto).toBeFalsy();
      expect([r.bigPx.w, r.bigPx.h]).toEqual([88, 68]);
      expect([r.smallPx.w, r.smallPx.h]).toEqual([44, 34]);
      for (const [l, px, focus] of [
        [r.big, r.bigPx, card.focus],
        [r.small, r.smallPx, card.focusSmall!],
      ] as const) {
        const st = artStats(l, px, focus, l.size === 'small');
        const visible = (px.w - 2 * (l.size === 'big' ? 2 : 1)) * (px.h - 2 * (l.size === 'big' ? 2 : 1));
        expect(st.offPalette, `${l.size} ${f}`).toBe(0);
        expect(st.isolated, `${l.size} ${f}`).toBeLessThanOrEqual(0.1);
        expect(st.colors, `${l.size} ${f}`).toBeLessThanOrEqual(20);
        expect(st.backdropColors, `${l.size} ${f}`).toBeLessThanOrEqual(6);
        expect(st.focusOk, `${l.size} ${f}`).toBe(true);
        expect(st.outlineInk, `${l.size} ${f}`).toBeGreaterThanOrEqual(0.9);
        expect(checkerCount(px) / visible, `${l.size} ${f} checker`).toBeLessThanOrEqual(0.005);
        expect(foreignBackdropTones(l.backdrop, 'EARTH'), `${l.size} ${f} backdrop`).toEqual([]);
      }
    }
  });

  it('the near eye\'s glint is the picture\'s brightest point (white at the focus), the eye violet', () => {
    const r = renderArt(card, 0);
    for (const [px, [fx, fy]] of [
      [r.bigPx, card.focus],
      [r.smallPx, card.focusSmall!],
    ] as const) {
      let max = 0;
      for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) max = Math.max(max, lum(px.get(x, y)));
      expect(px.get(fx, fy)).toBe(PAL.white);
      expect(lum(PAL.white)).toBeGreaterThanOrEqual(max - 1e-9);
      expect([PAL.void2, PAL.void3, PAL.void4]).toContain(px.get(fx + 1, fy));
      // the only white of the picture is the glint
      let whites = 0;
      for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) if (px.get(x, y) === PAL.white) whites++;
      expect(whites).toBe(1);
    }
  });

  it('the glint dims on frames 2–4 (living art) and the bubble pops violet on frame 3', () => {
    expect(renderArt(card, 3).bigPx.get(card.focus[0], card.focus[1])).toBe(PAL.void3);
    expect(renderArt(card, 3).smallPx.get(card.focusSmall![0], card.focusSmall![1])).toBe(PAL.void3);
  });

  it('is deterministic', () => {
    const a = renderArt(card, 2).smallPx;
    const b = renderArt(card, 2).smallPx;
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
  });

  it('field icon: 16×12, opaque palette tones, the pale mask with violet eyes', () => {
    const p = new PixelCanvas(16, 12);
    mudgraspIcon(p);
    let violet = 0;
    let mask = 0;
    for (let y = 0; y < 12; y++)
      for (let x = 0; x < 16; x++) {
        expect(p.isOpaque(x, y), `${x},${y}`).toBe(true);
        expect(PALETTE.has(p.get(x, y)!), `${x},${y}`).toBe(true);
        if (p.get(x, y) === PAL.void3) violet++;
        if (p.get(x, y) === PAL.stone4) mask++;
      }
    expect(violet).toBe(2);
    expect(mask).toBeGreaterThanOrEqual(10);
  });
});
