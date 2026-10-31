// Tüy Hayalet (wisp_imp, R3 "Down Wisp"): the v3 card picture (88×68 + hand-corrected 44×34) and its hand-drawn
// 16×12 field icon. The rig has its own test (tests/art/wisp_imp.test.ts).
import { describe, expect, it } from 'vitest';
import card, { wispImpIcon } from '../../src/art/cardart-v3/wisp_imp';
import { PixelCanvas } from '../../src/art/pixel';
import { PAL } from '../../src/art/palette';
import { artStats, checkerCount, renderArt } from '../../src/art/cardart-v3/_kit';

const lum = (c: number | null) => (c === null ? 0 : (((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.55 + (c & 255) * 0.15) / 255);
const PALETTE = new Set<number>(Object.values(PAL) as number[]);

describe('wisp_imp card art (v3)', () => {
  it('paints both sizes, every living frame, within the kit budgets; small is hand-made, not the auto draft', () => {
    expect(card.id).toBe('wisp_imp');
    expect(card.frames).toBe(6);
    for (let f = 0; f < (card.frames ?? 1); f++) {
      const r = renderArt(card, f);
      expect(r.auto).toBeFalsy();
      expect([r.bigPx.w, r.bigPx.h]).toEqual([88, 68]);
      expect([r.smallPx.w, r.smallPx.h]).toEqual([44, 34]);
      for (const [l, px, focus, own] of [
        [r.big, r.bigPx, card.focus, false],
        [r.small, r.smallPx, card.focusSmall!, true],
      ] as const) {
        const st = artStats(l, px, focus, own);
        const visible = (px.w - 2 * (l.size === 'big' ? 2 : 1)) * (px.h - 2 * (l.size === 'big' ? 2 : 1));
        expect(st.offPalette, `${l.size} ${f}`).toBe(0);
        expect(st.isolated, `${l.size} ${f}`).toBeLessThanOrEqual(0.1);
        expect(st.colors, `${l.size} ${f}`).toBeLessThanOrEqual(20);
        expect(st.backdropColors, `${l.size} ${f}`).toBeLessThanOrEqual(6);
        expect(st.focusOk, `${l.size} ${f}`).toBe(true);
        expect(st.outlineInk, `${l.size} ${f}`).toBeGreaterThanOrEqual(0.9);
        expect(checkerCount(px) / visible, `${l.size} ${f} checker`).toBeLessThanOrEqual(0.005);
      }
    }
  });

  it('the near eye\'s glint is the picture\'s brightest point (white at the focus, nothing brighter), eyes gold', () => {
    const r = renderArt(card, 0);
    for (const [px, [fx, fy]] of [
      [r.bigPx, card.focus],
      [r.smallPx, card.focusSmall!],
    ] as const) {
      let max = 0;
      for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) max = Math.max(max, lum(px.get(x, y)));
      expect(px.get(fx, fy)).toBe(PAL.white);
      expect(lum(PAL.white)).toBeGreaterThanOrEqual(max - 1e-9);
      // the dot under the glint is gold (the eyes are the only gold of the picture: the light layer's emissive)
      expect(px.get(fx, fy + 1)).toBe(PAL.gold3);
    }
  });

  it('the eyes blink on frame 4 (the glint closes)', () => {
    const r = renderArt(card, 4);
    expect(r.bigPx.get(card.focus[0], card.focus[1])).not.toBe(PAL.white);
    expect(r.smallPx.get(card.focusSmall![0], card.focusSmall![1])).not.toBe(PAL.white);
  });

  it('is deterministic', () => {
    const a = renderArt(card, 2).smallPx;
    const b = renderArt(card, 2).smallPx;
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
  });

  it('field icon: 16×12, opaque palette tones, two gold eyes in the dark hollow', () => {
    const p = new PixelCanvas(16, 12);
    wispImpIcon(p);
    let gold = 0;
    for (let y = 0; y < 12; y++)
      for (let x = 0; x < 16; x++) {
        expect(p.isOpaque(x, y), `${x},${y}`).toBe(true);
        expect(PALETTE.has(p.get(x, y)!), `${x},${y}`).toBe(true);
        if (p.get(x, y) === PAL.gold3) gold++;
      }
    expect(gold).toBe(2);
  });
});
