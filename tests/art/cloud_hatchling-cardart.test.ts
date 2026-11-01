// Bulut Yavrusu (cloud_hatchling) — the v3 card art "Hapşırık" (src/art/cardart-v3/cloud_hatchling.ts):
// the KART_RESIMLERI §10 numbers at both sizes, the focus is the brightest point, the hand version is not a
// blind reduction, and the living frames only step palette / ≤ 2 px.

import { describe, expect, it } from 'vitest';
import art from '../../src/art/cardart-v3/cloud_hatchling';
import { artStats, foreignBackdropTones, renderArt } from '../../src/art/cardart-v3/_kit';
import { ART_BIG, ART_SMALL, BACKDROP_COLORS_MAX, COLORS_MAX, ISOLATED_MAX, SUBJECT_FILL } from '../../src/art/cardart-v3/_types';
import { PAL } from '../../src/art/palette';

const r0 = renderArt(art, 0);

describe('cloud_hatchling card art v3', () => {
  it('paints both sizes, fully opaque, palette only, with a hand-made small version', () => {
    expect(art.id).toBe('cloud_hatchling');
    expect(r0.auto).toBe(false);
    expect([r0.bigPx.w, r0.bigPx.h]).toEqual([ART_BIG.w, ART_BIG.h]);
    expect([r0.smallPx.w, r0.smallPx.h]).toEqual([ART_SMALL.w, ART_SMALL.h]);
    for (const pic of [r0.bigPx, r0.smallPx]) expect(pic.coverage()).toBe(pic.w * pic.h);
  });

  it('meets the §10 numbers at both sizes', () => {
    const big = artStats(r0.big, r0.bigPx, art.focus);
    const small = artStats(r0.small, r0.smallPx, art.focusSmall, true);
    for (const s of [big, small]) {
      expect(s.offPalette).toBe(0);
      expect(s.isolated).toBeLessThanOrEqual(ISOLATED_MAX);
      expect(s.colors).toBeLessThanOrEqual(COLORS_MAX);
      expect(s.backdropColors).toBeLessThanOrEqual(BACKDROP_COLORS_MAX);
      expect(s.outlineInk).toBeGreaterThanOrEqual(0.9);
      expect(s.focusOk).toBe(true);
    }
    const vis = (g: typeof ART_BIG) => (g.visible.x1 - g.visible.x0 + 1) * (g.visible.y1 - g.visible.y0 + 1);
    expect(big.checker).toBeLessThanOrEqual(vis(ART_BIG) * 0.005);
    expect(small.checker).toBeLessThanOrEqual(vis(ART_SMALL) * 0.005);
    expect(big.subjectFill).toBeGreaterThanOrEqual(SUBJECT_FILL[0]);
    expect(big.subjectFill).toBeLessThanOrEqual(SUBJECT_FILL[1]);
    // the eye lands on the ring: the brightest pixels sit around the focus
    expect(big.brightOff).toBeLessThan(18);
    expect(small.brightOff).toBeLessThan(9);
    expect(big.lead).toBeGreaterThanOrEqual(ART_BIG.air);
    expect(small.lead).toBeGreaterThanOrEqual(ART_SMALL.air);
  });

  it('keeps the WIND light: leaf tones, no foreign light colour beyond the sky and the far cloud sea', () => {
    for (const l of [r0.big, r0.small]) {
      const foreign = foreignBackdropTones(l.backdrop, 'WIND');
      for (const c of foreign) expect([PAL.night1, PAL.night2, PAL.night3, PAL.night4]).toContain(c);
      let leaf = 0;
      for (let y = 0; y < l.backdrop.h; y++) for (let x = 0; x < l.backdrop.w; x++) if (l.backdrop.get(x, y) === PAL.leaf1 || l.backdrop.get(x, y) === PAL.leaf2) leaf++;
      // the wake crescent (critic r2: the old 15 % disc swallowed the ring) still carries the WIND colour at 1×
      expect(leaf).toBeGreaterThan(l.backdrop.w * l.backdrop.h * 0.08);
    }
  });

  it('the subject wears the sprite materials and never the player colours', () => {
    const banned = new Set<number>([PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.crim0, PAL.crim1, PAL.crim2, PAL.crim3, PAL.crim4]);
    for (const pic of [r0.bigPx, r0.smallPx]) {
      const tones = new Set<number>();
      for (let y = 0; y < pic.h; y++) for (let x = 0; x < pic.w; x++) tones.add(pic.get(x, y)!);
      for (const c of [PAL.leaf4, PAL.leaf3, PAL.water4, PAL.mist, PAL.earth4, PAL.white]) expect(tones.has(c)).toBe(true);
      for (const c of tones) expect(banned.has(c)).toBe(false);
    }
  });

  it('living frames: deterministic, f0 is the still, each frame moves at most a few pixels', () => {
    expect(art.frames).toBe(6);
    const again = renderArt(art, 0);
    expect(again.bigPx.data).toEqual(r0.bigPx.data);
    expect(again.smallPx.data).toEqual(r0.smallPx.data);
    for (let f = 1; f < (art.frames ?? 1); f++) {
      const r = renderArt(art, f);
      for (const [a, b] of [
        [r.bigPx, r0.bigPx],
        [r.smallPx, r0.smallPx],
      ] as const) {
        let d = 0;
        for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) d++;
        expect(d).toBeLessThan(a.w * a.h * 0.05); // the ring steps 1 px, the streaks swap tones, one far lobe steps
      }
    }
  });
});
