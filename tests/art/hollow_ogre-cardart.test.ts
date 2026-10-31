// Kovuk Devi (hollow_ogre, C6): the v3 card picture (88×68 + hand-corrected 44×34). The rig has its own test.
import { describe, expect, it } from 'vitest';
import card from '../../src/art/cardart-v3/hollow_ogre';
import { PAL } from '../../src/art/palette';
import { artStats, checkerCount, foreignBackdropTones, renderArt } from '../../src/art/cardart-v3/_kit';

const lum = (c: number | null) => (c === null ? 0 : (((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.55 + (c & 255) * 0.15) / 255);
const VIOLET: readonly number[] = [PAL.void2, PAL.void3, PAL.void4];
const GOLD: readonly number[] = [PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4];

describe('hollow_ogre card art (v3)', () => {
  it('paints both sizes, every living frame, within the kit budgets; small is hand-made, not the auto draft', () => {
    expect(card.id).toBe('hollow_ogre');
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
        // the night forest speaks the EARTH recipe's tones only
        expect(foreignBackdropTones(l.backdrop, 'EARTH'), `${l.size} ${f} backdrop`).toEqual([]);
      }
    }
  });

  it("the near eye's glint is the picture's brightest point (white at the focus, the only white), the eyes gold", () => {
    const r = renderArt(card, 0);
    for (const [px, [fx, fy]] of [
      [r.bigPx, card.focus],
      [r.smallPx, card.focusSmall!],
    ] as const) {
      let max = 0;
      let whites = 0;
      for (let y = 0; y < px.h; y++)
        for (let x = 0; x < px.w; x++) {
          max = Math.max(max, lum(px.get(x, y)));
          if (px.get(x, y) === PAL.white) whites++;
        }
      expect(px.get(fx, fy)).toBe(PAL.white);
      expect(lum(PAL.white)).toBeGreaterThanOrEqual(max - 1e-9);
      expect(whites).toBe(1);
      expect(GOLD).toContain(px.get(fx - 1, fy));
    }
  });

  it('the club burns with violet seeds in both sizes (the second, dimmer light)', () => {
    const r = renderArt(card, 0);
    for (const px of [r.bigPx, r.smallPx]) {
      let violet = 0;
      for (let y = 0; y < px.h; y++) for (let x = Math.floor(px.w * 0.7); x < px.w; x++) if (VIOLET.includes(px.get(x, y)!)) violet++;
      expect(violet).toBeGreaterThanOrEqual(px.w === 88 ? 12 : 3);
    }
  });

  it('living art: the eyes blink on frame 3 (no glint), the glint is back on frame 5', () => {
    for (const k of ['big', 'small'] as const) {
      const [fx, fy] = k === 'big' ? card.focus : card.focusSmall!;
      const px = (f: number) => (k === 'big' ? renderArt(card, f).bigPx : renderArt(card, f).smallPx);
      expect(px(3).get(fx, fy)).not.toBe(PAL.white);
      expect(px(5).get(fx, fy)).toBe(PAL.white);
    }
  });

  it('is deterministic', () => {
    const a = renderArt(card, 2).smallPx;
    const b = renderArt(card, 2).smallPx;
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
  });
});
