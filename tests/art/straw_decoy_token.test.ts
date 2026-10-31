// Saman Korkuluk (straw_decoy_token, v3 art, registered): every anim the v3 contract needs exists with holds and
// marks, validateArt (normal tier, melee attack) is clean, a frame is deterministic, P2 is a relight of the SAME
// silhouette, every frame keeps its 2-px margin, the scarecrow is a ~50-px figure on a planted stake, the crow
// visits in idle AND guard (the token always stands in defense) but never in f0, the summon starts as a bare stake in
// the air and ends dressed with its button eyes lit once, the death lies low on the floor, the card pictures paint
// within budget.
import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/straw_decoy_token';
import card from '../../src/art/cardart-v3/straw_decoy_token';
import { monsterArtV3 } from '../../src/art/monsters';
import { PAL } from '../../src/art/palette';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive'];
type S = { frames: number; holds?: number[]; marks?: Record<string, number> };
const spec = (a: AnyMonsterAnim): S => (art.anims as Record<string, S>)[a] ?? (art.extraAnims as Record<string, S>)[a];
const count = (a: AnyMonsterAnim, f: number, cs: number[]) => {
  const p = drawFrame(art, a, f, 'left');
  let n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (cs.includes(p.get(x, y) as number)) n++;
  return n;
};
const CROW = [PAL.night1];

describe('straw_decoy_token', () => {
  it('is the registered v3 art of the token', () => {
    expect(monsterArtV3('straw_decoy_token')).toBe(art);
  });

  it('has every anim with holds and marks', () => {
    for (const a of ALL) {
      const s = spec(a);
      expect(s, a).toBeTruthy();
      expect(s.holds?.length, a).toBe(s.frames);
    }
    expect(spec('attack').marks).toEqual({ charge: 1, release: 5, impact: 5, contact: 6, recover: 7 });
    expect(spec('summon').marks?.land).toBe(2);
    expect(spec('death').marks?.dissolve).toBe(4);
    expect(spec('idle').frames).toBe(20);
    expect(spec('guard').frames).toBe(12);
    expect(art.p2).toBe('relight');
    // 68×62×4 bytes × frames ≤ 2.2 MB (the small-class sheet budget)
    const frames = ALL.reduce((n, a) => n + spec(a).frames, 0);
    expect(art.w * art.h * 4 * frames).toBeLessThanOrEqual(2.2e6);
  });

  it('validateArt (normal tier) has no errors', { timeout: 60000 }, () => {
    expect(validateArt(art, { tier: 'normal', attack: 'melee' }).filter((f) => f.severity === 'error').map((f) => `${f.rule} ${f.anim} ${f.message}`)).toEqual([]);
  });

  it('draws deterministically and P2 keeps the silhouette', () => {
    const a = drawFrame(art, 'idle', 11, 'left');
    const b = drawFrame(art, 'idle', 11, 'left');
    expect(a.data.every((v: number, i: number) => v === b.data[i])).toBe(true);
    for (const [an, f] of [['idle', 0], ['guard', 6], ['death', 7]] as const) {
      const l = drawFrame(art, an, f, 'left');
      const r = drawFrame(art, an, f, 'right');
      let diff = 0;
      for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) if (l.isOpaque(x, y) !== r.isOpaque(x, y)) diff++;
      expect(diff, `${an} f${f}`).toBe(0);
    }
  });

  it('is a ~50-px scarecrow on a planted stake and every frame keeps a 2-px margin', { timeout: 60000 }, () => {
    const f = drawFrame(art, 'idle', 0, 'left').bounds()!;
    expect(f.h).toBeGreaterThanOrEqual(48);
    expect(f.h).toBeLessThanOrEqual(58);
    expect(f.y + f.h - 1).toBe(art.anchorY + 1); // the mound's outline row under the foot
    for (const a of ALL) {
      for (let i = 0; i < spec(a).frames; i++) {
        const b = drawFrame(art, a, i, 'left').bounds();
        if (!b) continue;
        expect(Math.min(b.x, b.y, art.w - b.x - b.w, art.h - b.y - b.h), `${a} f${i}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('the crow visits in idle and in guard, never on f0', () => {
    // night1 = the crow's body (the button eyes use 6 px of it on every frame)
    expect(count('idle', 0, CROW)).toBeLessThanOrEqual(6);
    expect(count('guard', 0, CROW)).toBeLessThanOrEqual(6);
    expect(count('idle', 11, CROW)).toBeGreaterThan(20);
    expect(count('guard', 6, CROW)).toBeGreaterThan(20);
  });

  it('summon: a bare stake in the air first, planted on land, dressed at the end with the eyes lit once', () => {
    const air = drawFrame(art, 'summon', 0, 'left').bounds()!;
    expect(air.y + air.h).toBeLessThan(art.anchorY - 4);
    expect(count('summon', 0, [PAL.night4, PAL.steel, PAL.crim2])).toBe(0); // no jacket yet
    const land = drawFrame(art, 'summon', 2, 'left').bounds()!;
    expect(land.y + land.h - 1).toBeGreaterThanOrEqual(art.anchorY);
    expect(count('summon', 11, [PAL.gold4])).toBeGreaterThan(count('idle', 0, [PAL.gold4]));
  });

  it('death: the stake topples and the last frame lies low on the floor', () => {
    const last = drawFrame(art, 'death', spec('death').frames - 1, 'left').bounds()!;
    expect(last.h).toBeLessThan(30);
    expect(last.y).toBeGreaterThan(art.anchorY - 30);
  });

  it('card picture: 4 living frames, both sizes inside the kit budgets', () => {
    expect(card.frames).toBe(4);
    const r = renderArt(card, 0);
    expect(r.auto).toBe(false);
    for (const [l, px, foc] of [[r.big, r.bigPx, card.focus], [r.small, r.smallPx, card.focusSmall]] as const) {
      const st = artStats(l, px, foc, true);
      expect(st.offPalette).toBe(0);
      expect(st.colors).toBeLessThanOrEqual(20);
      expect(st.backdropColors).toBeLessThanOrEqual(6);
      expect(st.focusOk).toBe(true);
      expect(st.isolated).toBeLessThanOrEqual(0.1);
    }
    const big = artStats(r.big, r.bigPx, card.focus, true);
    expect(big.subjectFill).toBeGreaterThanOrEqual(0.6);
    expect(big.subjectFill).toBeLessThanOrEqual(0.75);
  });
});
