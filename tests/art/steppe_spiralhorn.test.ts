// Bozkır Boynuzlusu (v3 art): every anim exists with marks and holds, validateArt (normal tier) reports no errors, frames
// are deterministic, P2 is a relight of the same silhouette, the hooves stay planted in idle / guard, the horns are rigid
// per head angle, the attack's three bounds rise and end in an upward toss, the death ends as grass on the wind, and the
// card picture keeps the kit budgets at both sizes.

import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/steppe_spiralhorn';
import card from '../../src/art/cardart-v3/steppe_spiralhorn';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import { PAL } from '../../src/art/palette';
import { PixelCanvas } from '../../src/art/pixel';
import type { AnyMonsterAnim } from '../../src/art/types';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive'];
type Spec = { frames: number; holds?: number[]; marks?: Record<string, number> };
const spec = (a: AnyMonsterAnim): Spec => (art.anims as Record<string, Spec>)[a] ?? (art.extraAnims as Record<string, Spec>)[a];
const count = (p: PixelCanvas, pred: (c: number) => boolean) => {
  let n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const c = p.get(x, y);
    if (c !== null && pred(c)) n++;
  }
  return n;
};

describe('steppe_spiralhorn', () => {
  it('has every anim, marks and holds; medium weight, relit P2', () => {
    for (const a of ALL) {
      const s = spec(a);
      expect(s, a).toBeTruthy();
      expect(s.holds?.length, a).toBe(s.frames);
    }
    expect(spec('idle').frames).toBe(18);
    expect(art.anims.attack.marks?.contact).toBe((art.anims.attack.marks?.release ?? -9) + 1);
    expect(art.p2).toBe('relight');
    expect(art.weight).toBe('medium');
  });

  it('validateArt (normal tier) has no errors', () => {
    expect(validateArt(art, { tier: 'normal', attack: 'melee' }).filter((f) => f.severity === 'error').map((f) => `${f.rule} ${f.anim} ${f.message}`)).toEqual([]);
  });

  it('draws deterministically and P2 keeps the silhouette', () => {
    for (const [a, f] of [['idle', 0], ['attack', 10], ['death', 7]] as const) {
      const x = drawFrame(art, a, f, 'left');
      const y = drawFrame(art, a, f, 'left');
      expect(x.data.every((v: number, i: number) => v === y.data[i]), a).toBe(true);
      const r = drawFrame(art, a, f, 'right');
      let diff = 0;
      for (let yy = 0; yy < x.h; yy++) for (let xx = 0; xx < x.w; xx++) if (x.isOpaque(xx, yy) !== r.isOpaque(xx, yy)) diff++;
      expect(diff, a).toBe(0);
    }
  });

  it('keeps the hooves planted (feet band) through idle, guard and the guard transitions', () => {
    const band = (p: PixelCanvas) => {
      const b = p.bounds()!;
      const bottom = b.y + b.h - 1;
      let x0 = 999;
      let x1 = -1;
      for (let y = bottom - 5; y <= bottom; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
      return `${bottom}:${x0}..${x1}`;
    };
    const ref = band(drawFrame(art, 'idle', 0, 'left'));
    for (const a of ['idle', 'guard', 'toGuard', 'fromGuard'] as const)
      for (let f = 0; f < spec(a).frames; f++) expect(band(drawFrame(art, a, f, 'left')), `${a} ${f}`).toBe(ref);
  });

  it('bounds three times, each higher, and ends the strike with an upward horn toss', () => {
    const tipY = (f: number) => art.points!('attack', f).muzzle!.y;
    const core = (f: number) => art.points!('attack', f).core!.y;
    // the three apexes (f5, f7, f9) rise
    expect(core(7)).toBeLessThan(core(5));
    expect(core(9)).toBeLessThan(core(7));
    // release (pike: horns forward) → contact (toss): the horn tips go UP
    expect(tipY(10)).toBeLessThan(tipY(9) - 8);
    // the release hold is short, the full rear the longest
    const h = spec('attack').holds!;
    expect(h[art.anims.attack.marks!.release!]).toBeLessThanOrEqual(70);
    expect(Math.max(...h)).toBe(h[3]);
  });

  it('dies into grass carried by the wind (no ash, no stone), the horns last', () => {
    const d = spec('death');
    const leaf = (c: number) => c === PAL.leaf1 || c === PAL.leaf2 || c === PAL.leaf3 || c === PAL.leaf4;
    const mid = drawFrame(art, 'death', 6, 'left');
    expect(count(mid, leaf)).toBeGreaterThan(count(mid, (c) => c === PAL.earth3) * 3);
    const last = drawFrame(art, 'death', d.frames - 1, 'left');
    expect(count(last, (c) => c === PAL.white)).toBeGreaterThan(10);
    expect(count(last, (c) => c === PAL.stone2 || c === PAL.stone3 || c === PAL.fire2)).toBe(0);
  });

  it('paints the card picture at both sizes within the kit budgets (living frames); the portrait is the small one', () => {
    for (let f = 0; f < (card.frames ?? 1); f++) {
      const r = renderArt(card, f);
      expect([r.bigPx.w, r.bigPx.h]).toEqual([88, 68]);
      expect([r.smallPx.w, r.smallPx.h]).toEqual([44, 34]);
      const b = artStats(r.big, r.bigPx, card.focus);
      const s = artStats(r.small, r.smallPx, card.focusSmall!, true);
      for (const st of [b, s]) {
        expect(st.offPalette).toBe(0);
        expect(st.isolated).toBeLessThanOrEqual(0.1);
        expect(st.colors).toBeLessThanOrEqual(20);
        expect(st.backdropColors).toBeLessThanOrEqual(6);
        expect(st.focusOk).toBe(true);
      }
      expect(b.subjectFill).toBeGreaterThanOrEqual(0.6);
      expect(b.subjectFill).toBeLessThanOrEqual(0.75);
    }
    const pp = new PixelCanvas(44, 34);
    art.portrait!(pp);
    expect(pp.bounds()).not.toBeNull();
  });
});
