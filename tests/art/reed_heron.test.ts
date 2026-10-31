// Sazlık Balıkçılı (v3 art): every anim exists with marks and holds, validateArt (normal tier) reports no errors, a frame
// is deterministic, P2 is a relight of the same silhouette, the body is the tall thin one-legged wader of the 64 class,
// the attack keeps its signature rhythm (a 200 ms freeze, then three thrusts on three distinct points), the death leaves
// only the ground (reeds + water) behind, and the card picture paints within the kit budgets at both sizes.

import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/reed_heron';
import card from '../../src/art/cardart-v3/reed_heron';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive'];
type Spec = { frames: number; holds?: number[]; marks?: Record<string, number> };
const spec = (a: AnyMonsterAnim): Spec => (art.anims as Record<string, Spec>)[a] ?? (art.extraAnims as Record<string, Spec>)[a];
const opaque = (a: ReturnType<typeof drawFrame>) => {
  let n = 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (a.isOpaque(x, y)) n++;
  return n;
};

describe('reed_heron', () => {
  it('has every anim, marks and holds, a relit P2 and the medium class', () => {
    for (const a of ALL) {
      const s = spec(a);
      expect(s, a).toBeTruthy();
      expect(s.holds?.length, a).toBe(s.frames);
    }
    const m = spec('attack').marks!;
    expect([m.charge, m.release, m.impact, m.contact, m.recover]).toEqual([1, 7, 7, 10, 11]);
    expect(art.p2).toBe('relight');
    expect(art.weight).toBe('medium');
  });

  it('validateArt (normal tier) has no errors', () => {
    expect(validateArt(art, { tier: 'normal', attack: 'melee' }).filter((f) => f.severity === 'error').map((f) => `${f.rule} ${f.anim} ${f.message}`)).toEqual([]);
  });

  it('draws deterministically and P2 keeps the silhouette', () => {
    const a = drawFrame(art, 'idle', 0, 'left');
    const b = drawFrame(art, 'idle', 0, 'left');
    expect(a.data.every((v: number, i: number) => v === b.data[i])).toBe(true);
    const r = drawFrame(art, 'idle', 0, 'right');
    let diff = 0;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (a.isOpaque(x, y) !== r.isOpaque(x, y)) diff++;
    expect(diff).toBe(0);
  });

  it('is the tall thin wader: taller than wide above the water, fits the medium sheet budget', () => {
    const a = drawFrame(art, 'idle', 0, 'left');
    const bb = a.bounds()!;
    expect(bb.h).toBeGreaterThanOrEqual(60);
    let frames = 0;
    for (const s of ALL) frames += spec(s).frames;
    expect(art.w * art.h * 4 * frames).toBeLessThanOrEqual(3.6e6);
    // the planted foot is the anchor in idle and guard
    for (const an of ['idle', 'guard'] as const) expect(art.points!(an, 0).feet).toEqual({ x: art.anchorX, y: art.anchorY });
  });

  it('keeps the signature rhythm: the freeze is the longest hold and the three thrusts hit three different points', () => {
    const s = spec('attack');
    expect(s.holds![4]).toBe(200);
    expect(Math.max(...s.holds!)).toBe(200);
    const tips = [8, 9, 10].map((f) => art.points!('attack', f).muzzle!);
    expect(new Set(tips.map((t) => `${t.x},${t.y}`)).size).toBe(3);
    const ys = tips.map((t) => t.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(5);
  });

  it('leaves only the ground behind on the last death frame (no heron pixels above the reeds band)', () => {
    const n = spec('death').frames;
    const last = drawFrame(art, 'death', n - 1, 'left');
    const idle = drawFrame(art, 'idle', 0, 'left');
    expect(opaque(last)).toBeLessThan(opaque(idle) * 0.6);
    // the head row of idle f0 is empty except for mist (no white plumage remains)
    const head = art.points!('idle', 0).head!;
    let white = 0;
    for (let x = 0; x < last.w; x++) if (last.get(x, head.y) === 0xf4f7ff) white++;
    expect(white).toBe(0);
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
