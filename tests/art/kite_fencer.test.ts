// Uçurtma Eskrimci (kite_fencer, v3 art, registered): every anim of the v3 contract exists with holds and marks,
// validateArt (normal tier, melee) is clean, frames are deterministic and palette-only, P2 is a relight of the SAME
// silhouette, the art fits the small class sheet budget, the feet / floor string never move in idle and guard (HA-9),
// the two attacks are different anims with their own rhythm (the shortest charge vs the kite flight), the indicator
// panel lights at the end of the first attack and goes out at the end of the second, the death snaps the string and
// sheds the cloak (the last frames have no kite), and the card picture paints within the kit budgets at both sizes.
import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/kite_fencer';
import card from '../../src/art/cardart-v3/kite_fencer';
import { framePose, panelPoint, tailPoint } from '../../src/art/monsters-v3/kite_fencer-anims';
import { PAL } from '../../src/art/palette';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive', 'special'];
type Spec = { frames: number; holds?: number[]; marks?: Record<string, number> };
const spec = (a: AnyMonsterAnim): Spec => (art.anims as Record<string, Spec>)[a] ?? (art.extraAnims as Record<string, Spec>)[a];
const palette = new Set<number>(Object.values(PAL) as number[]);

describe('kite_fencer', () => {
  it('has every anim with holds and marks, a relit P2 and the mediumLight class', () => {
    for (const a of ALL) {
      const s = spec(a);
      expect(s, a).toBeTruthy();
      expect(s.holds?.length, a).toBe(s.frames);
    }
    expect(spec('attack').marks).toMatchObject({ charge: 1, release: 4, impact: 4, contact: 5, recover: 6 });
    expect(spec('special').marks).toMatchObject({ charge: 1, release: 9, impact: 9, recover: 10 });
    expect(spec('death').marks).toMatchObject({ impact: 0, contact: 0, dissolve: 4 });
    expect(art.p2).toBe('relight');
    expect(art.weight).toBe('mediumLight');
  });

  it('validateArt (normal tier, melee) has no errors', () => {
    expect(validateArt(art, { tier: 'normal', attack: 'melee' }).filter((f) => f.severity === 'error').map((f) => `${f.rule} ${f.anim} ${f.message}`)).toEqual([]);
  });

  it('fits the small class: 72×64, ≤ 140 frames and ≤ 2.2 MB per side', () => {
    const frames = ALL.reduce((n, a) => n + spec(a).frames, 0);
    expect([art.w, art.h]).toEqual([72, 64]);
    expect(frames).toBeLessThanOrEqual(140);
    expect(art.w * art.h * 4 * frames).toBeLessThanOrEqual(2.2e6);
  });

  it('draws deterministically, palette only, and P2 keeps the silhouette', () => {
    for (const a of ['idle', 'attack', 'special', 'death'] as const) {
      const n = spec(a).frames;
      for (let f = 0; f < n; f += 3) {
        const p = drawFrame(art, a, f, 'left');
        const q = drawFrame(art, a, f, 'left');
        expect(p.data.every((v: number, i: number) => v === q.data[i]), `${a} ${f}`).toBe(true);
        const r = drawFrame(art, a, f, 'right');
        let diff = 0;
        for (let y = 0; y < p.h; y++)
          for (let x = 0; x < p.w; x++) {
            if (p.isOpaque(x, y) !== r.isOpaque(x, y)) diff++;
            if (p.isOpaque(x, y)) expect(palette.has(p.get(x, y)!)).toBe(true);
          }
        expect(diff, `${a} ${f}`).toBe(0);
      }
    }
  });

  it('keeps the feet band and the floor string fixed in idle and guard (HA-9)', () => {
    const band = (a: AnyMonsterAnim, f: number) => {
      const p = drawFrame(art, a, f, 'left');
      const b = p.bounds()!;
      const bottom = b.y + b.h - 1;
      let x0 = 99;
      let x1 = -1;
      for (let y = bottom - 5; y <= bottom; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
      return `${bottom} ${x0} ${x1}`;
    };
    const ref = band('idle', 0);
    for (const a of ['idle', 'guard', 'toGuard', 'fromGuard'] as const) for (let f = 0; f < spec(a).frames; f++) expect(band(a, f), `${a} ${f}`).toBe(ref);
  });

  it('has two different attacks: the shortest charge and a straight fleche vs the kite flight and pendulum', () => {
    const a = spec('attack');
    const s = spec('special');
    const charge = (x: Spec) => x.holds!.slice(x.marks!.charge, x.marks!.release).reduce((m, h) => m + h, 0);
    expect(charge(a)).toBeLessThan(charge(s));
    expect(s.frames).toBeGreaterThan(a.frames);
    // attack 2 lifts off (the feet leave the floor) and the string goes taut; attack 1 never lifts beyond a hop
    expect(Math.max(...Array.from({ length: s.frames }, (_, f) => framePose('special', f).lift))).toBeGreaterThanOrEqual(3);
    expect(Array.from({ length: s.frames }, (_, f) => framePose('special', f).smode).includes(1)).toBe(true);
    expect(Math.max(...Array.from({ length: a.frames }, (_, f) => framePose('attack', f).lift))).toBeLessThanOrEqual(1);
  });

  it('lights the indicator panel at the end of attack 1 and puts it out at the end of attack 2', () => {
    expect(framePose('attack', spec('attack').frames - 1).lamp).toBeGreaterThan(0);
    expect(framePose('attack', 0).lamp).toBe(0);
    expect(framePose('special', 0).lamp).toBeGreaterThan(0);
    expect(framePose('special', spec('special').frames - 1).lamp).toBe(0);
    for (let f = 0; f < spec('idle').frames; f++) expect(framePose('idle', f).lamp).toBe(0);
    const pt = panelPoint('idle', 0)!;
    expect(pt).toBeTruthy();
    // the upper LEADING panel: above the shoulders, in front of the kite's spine
    expect(pt.y).toBeLessThan(art.core.y);
    expect(tailPoint('idle', 0)!.y).toBeGreaterThan(pt.y);
  });

  it('dies by the string snapping and the cloak flying off: the last death frames have no kite, a scrap and the rapier', () => {
    const n = spec('death').frames;
    const modes = Array.from({ length: n }, (_, f) => framePose('death', f).smode);
    expect(modes.indexOf(1)).toBeLessThan(modes.indexOf(2));
    expect(framePose('death', n - 1).kmode).toBe(3);
    expect(framePose('death', n - 1).sliver).toBe(3);
    expect(framePose('death', n - 1).sword).toBe(1);
  });

  it('paints the card picture at both sizes within the kit budgets (living frames)', () => {
    for (let f = 0; f < (card.frames ?? 1); f++) {
      const r = renderArt(card, f);
      expect([r.bigPx.w, r.bigPx.h]).toEqual([88, 68]);
      expect([r.smallPx.w, r.smallPx.h]).toEqual([44, 34]);
      for (const [l, px, focus] of [[r.big, r.bigPx, card.focus], [r.small, r.smallPx, card.focusSmall ?? ([card.focus[0] / 2, card.focus[1] / 2] as const)]] as const) {
        const st = artStats(l, px, focus);
        expect(st.offPalette).toBe(0);
        expect(st.isolated).toBeLessThanOrEqual(0.1);
        expect(st.colors).toBeLessThanOrEqual(20);
        expect(st.focusOk).toBe(true);
      }
      const big = artStats(r.big, r.bigPx, card.focus);
      expect(big.subjectFill).toBeGreaterThanOrEqual(0.6);
      expect(big.subjectFill).toBeLessThanOrEqual(0.75);
      expect(big.outlineInk).toBeGreaterThanOrEqual(0.9);
    }
  });
});
