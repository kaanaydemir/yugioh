// Kaya Baltacı (v3 art): every anim exists with marks and holds, validateArt (normal tier, melee) reports no errors, frames
// are deterministic and palette-only in both lights, P2 is a relight of the same silhouette, the medium-class sheet budget
// holds, the signature beats exist (the six spin facings, the bite on the floor, the split death with the planted axe) and
// the card picture (both sizes, living frames) stays within the kit budgets.

import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/crag_axeman';
import card from '../../src/art/cardart-v3/crag_axeman';
import { framePose } from '../../src/art/monsters-v3/crag_axeman-anims';
import { PAL } from '../../src/art/palette';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive'];
type Spec = { frames: number; holds?: number[]; marks?: Record<string, number> };
const spec = (a: AnyMonsterAnim): Spec => (art.anims as Record<string, Spec>)[a] ?? (art.extraAnims as Record<string, Spec>)[a];

describe('crag_axeman', () => {
  it('has every anim with holds and marks, a relit P2 and the heavy class', () => {
    let total = 0;
    for (const a of ALL) {
      const s = spec(a);
      expect(s, a).toBeTruthy();
      expect(s.holds?.length, a).toBe(s.frames);
      total += s.frames;
    }
    const m = spec('attack').marks!;
    expect([m.charge, m.release, m.contact, m.recover]).toEqual([1, 12, 13, 14]);
    expect(spec('death').marks!.dissolve).toBeDefined();
    expect(spec('summon').marks!.land).toBeDefined();
    expect(art.p2).toBe('relight');
    expect(art.weight).toBe('heavy');
    // medium class: ≤ 3.6 MB per side, ≤ 140 frames
    expect(total).toBeLessThanOrEqual(140);
    expect(art.w * art.h * 4 * total).toBeLessThanOrEqual(3.6e6);
  });

  it('validateArt (normal tier, melee) has no errors', () => {
    expect(validateArt(art, { tier: 'normal', attack: 'melee' }).filter((f) => f.severity === 'error').map((f) => `${f.rule} ${f.anim}`)).toEqual([]);
  });

  it('draws deterministically, palette only, and P2 keeps the silhouette', () => {
    const palette = new Set<number>(Object.values(PAL) as number[]);
    for (const [a, f] of [['idle', 0], ['attack', 13], ['death', 8], ['summon', 6]] as const) {
      const p = drawFrame(art, a, f, 'left');
      const q = drawFrame(art, a, f, 'left');
      expect(p.data.every((v: number, i: number) => v === q.data[i]), `${a} ${f}`).toBe(true);
      const r = drawFrame(art, a, f, 'right');
      for (let y = 0; y < p.h; y++)
        for (let x = 0; x < p.w; x++) {
          if (p.isOpaque(x, y)) expect(palette.has(p.get(x, y)!)).toBe(true);
          if (r.isOpaque(x, y)) expect(palette.has(r.get(x, y)!)).toBe(true);
        }
    }
    const a = drawFrame(art, 'idle', 0, 'left');
    const r = drawFrame(art, 'idle', 0, 'right');
    let diff = 0;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (a.isOpaque(x, y) !== r.isOpaque(x, y)) diff++;
    expect(diff).toBe(0);
  });

  it('carries its signature beats: six spin facings, the bite, the split and the planted axe, the boulder', () => {
    const facings = new Set<number>();
    for (let f = 2; f <= 7; f++) facings.add(framePose('attack', f).fc);
    expect(facings.size).toBe(6);
    const bite = framePose('attack', 13);
    expect(bite.bury).toBe(1);
    expect(bite.crack).toBeGreaterThan(0);
    const d = framePose('death', 8);
    expect(d.split).toBeGreaterThan(0);
    expect(d.ag).toBe(1);
    expect(framePose('summon', 0).bould).toBe(1);
    // the seam colours: white core / earth4 lips, never fire on the floor seam at the bite
    const p = drawFrame(art, 'attack', 13, 'left');
    let white = 0;
    for (let x = 0; x < p.w; x++) if (p.get(x, art.anchorY) === PAL.white) white++;
    expect(white).toBeGreaterThan(3);
  });

  it('paints the card picture at both sizes within the kit budgets (living frames)', () => {
    for (let f = 0; f < (card.frames ?? 1); f++) {
      const r = renderArt(card, f);
      expect([r.bigPx.w, r.bigPx.h]).toEqual([88, 68]);
      expect([r.smallPx.w, r.smallPx.h]).toEqual([44, 34]);
      for (const [l, px, focus] of [[r.big, r.bigPx, card.focus], [r.small, r.smallPx, card.focusSmall!]] as const) {
        const st = artStats(l, px, focus);
        expect(st.offPalette).toBe(0);
        expect(st.isolated).toBeLessThanOrEqual(0.1);
        expect(st.colors).toBeLessThanOrEqual(20);
        expect(st.focusOk).toBe(true);
      }
    }
  });
});
