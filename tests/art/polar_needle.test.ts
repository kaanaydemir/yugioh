// Kutup İğnesi (polar_needle, v3 art, registered): every anim the v3 contract needs exists with holds and marks, validateArt
// (normal tier, melee attack) is clean, a frame is deterministic, P2 is a relight of the SAME silhouette, every frame keeps its
// 2-px margin, the piece is a tall thin biped (a needle, not a block), the torso shows both poles (fire N over water S), the
// hitMagic contact frame flips them, the summon spins (the dancer faces away mid-turn), and both card pictures paint within budget.
import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/polar_needle';
import card from '../../src/art/cardart-v3/polar_needle';
import { PAL } from '../../src/art/palette';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive', 'special', 'victory'];
type S = { frames: number; holds?: number[]; marks?: Record<string, number> };
const spec = (a: AnyMonsterAnim): S => (art.anims as Record<string, S>)[a] ?? (art.extraAnims as Record<string, S>)[a];
const count = (a: AnyMonsterAnim, f: number, c: number) => {
  const p = drawFrame(art, a, f, 'left');
  let n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.get(x, y) === c) n++;
  return n;
};

describe('polar_needle', () => {
  it('has every anim with holds and marks', () => {
    for (const a of ALL) {
      const s = spec(a);
      expect(s, a).toBeTruthy();
      expect(s.holds?.length, a).toBe(s.frames);
    }
    expect(spec('attack').marks).toEqual({ charge: 1, release: 6, impact: 6, contact: 7, recover: 9 });
    expect(spec('special').marks?.release).toBe(5);
    expect(spec('summon').marks?.land).toBe(1);
    expect(spec('death').marks?.dissolve).toBe(4);
    expect(art.p2).toBe('relight');
    expect(art.weight).toBe('mediumHeavy');
  });

  it('validateArt (normal tier) has no errors', { timeout: 60000 }, () => {
    expect(validateArt(art, { tier: 'normal', attack: 'melee' }).filter((f) => f.severity === 'error').map((f) => `${f.rule} ${f.anim} ${f.message}`)).toEqual([]);
  });

  it('draws deterministically and P2 keeps the silhouette', () => {
    const a = drawFrame(art, 'idle', 5, 'left');
    const b = drawFrame(art, 'idle', 5, 'left');
    expect(a.data.every((v: number, i: number) => v === b.data[i])).toBe(true);
    const r = drawFrame(art, 'idle', 5, 'right');
    let diff = 0;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (a.isOpaque(x, y) !== r.isOpaque(x, y)) diff++;
    expect(diff).toBe(0);
  });

  it('is a tall thin biped and every frame keeps a 2-px margin', { timeout: 60000 }, () => {
    const f = drawFrame(art, 'idle', 0, 'left').bounds()!;
    expect(f.h).toBeGreaterThanOrEqual(66);
    expect(f.w / f.h).toBeLessThan(0.8);
    for (const a of ALL) {
      for (let i = 0; i < spec(a).frames; i++) {
        const b = drawFrame(art, a, i, 'left').bounds();
        if (!b) continue;
        expect(Math.min(b.x, b.y, art.w - b.x - b.w, art.h - b.y - b.h), `${a} f${i}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('the needle torso shows both poles; hitMagic f0 flips them', () => {
    const p = drawFrame(art, 'idle', 0, 'left');
    const sk = art.points!('idle', 0).core!;
    const above = [p.get(sk.x - 2, sk.y - 8), p.get(sk.x - 1, sk.y - 8)];
    const below = [p.get(sk.x - 2, sk.y + 8), p.get(sk.x - 1, sk.y + 8)];
    expect(above.some((c) => c === PAL.fire3 || c === PAL.fire2 || c === PAL.fire4)).toBe(true);
    expect(below.some((c) => c === PAL.water3 || c === PAL.water2 || c === PAL.water4)).toBe(true);
    const m = drawFrame(art, 'hitMagic', 0, 'left');
    expect([m.get(sk.x - 2, sk.y - 8), m.get(sk.x - 1, sk.y - 8)].some((c) => c === PAL.water3 || c === PAL.water2 || c === PAL.water4)).toBe(true);
  });

  it('summon: lands on its point and the mid-turn frame faces away (pirouette)', () => {
    // f2 (yaw 150°): the visor point is on the left of the root
    const a = drawFrame(art, 'summon', 2, 'left').bounds()!;
    const r = drawFrame(art, 'summon', 11, 'left').bounds()!;
    expect(a.x).toBeLessThan(r.x);
    expect(count('summon', 11, PAL.white)).toBeGreaterThan(0);
  });

  it('points: the muzzle is the spear point and moves forward on contact', () => {
    const p = art.points!('idle', 0);
    expect(p.muzzle!.x).toBeGreaterThan(art.anchorX + 25);
    expect(art.points!('attack', 7).muzzle!.x).toBeGreaterThan(p.muzzle!.x + 8);
  });

  it('card picture: 4 living frames, both sizes inside the kit budgets', () => {
    expect(card.frames).toBe(4);
    const r = renderArt(card, 0);
    expect(r.auto).toBe(false);
    for (const [l, px, foc] of [[r.big, r.bigPx, card.focus], [r.small, r.smallPx, card.focusSmall]] as const) {
      const st = artStats(l, px, foc, true);
      expect(st.offPalette).toBe(0);
      expect(st.colors).toBeLessThanOrEqual(24);
      expect(st.focusOk).toBe(true);
      expect(st.isolated).toBeLessThanOrEqual(0.1);
    }
  });
});
