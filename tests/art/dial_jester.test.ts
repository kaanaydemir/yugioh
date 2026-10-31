// Kadran Soytarısı (dial_jester, v3 art, registered): every anim the v3 contract needs exists with holds and marks,
// validateArt (normal tier, melee attack) is clean, a frame is deterministic, P2 is a relight of the SAME silhouette,
// every frame keeps its 2-px margin, the jester is a ~48-px figure whose head is a white dial in a gold bezel, the coin
// is gold and flips (edge-on in the air), the summon starts inside the floor dial and pops out on a spring, the attack
// somersaults (the dial passes below the coin hand) and strikes forward, and both card pictures paint within budget.
import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/dial_jester';
import card from '../../src/art/cardart-v3/dial_jester';
import { PAL } from '../../src/art/palette';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive', 'special', 'victory'];
type S = { frames: number; holds?: number[]; marks?: Record<string, number> };
const spec = (a: AnyMonsterAnim): S => (art.anims as Record<string, S>)[a] ?? (art.extraAnims as Record<string, S>)[a];
const count = (a: AnyMonsterAnim, f: number, cs: number[]) => {
  const p = drawFrame(art, a, f, 'left');
  let n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (cs.includes(p.get(x, y) as number)) n++;
  return n;
};

describe('dial_jester', () => {
  it('has every anim with holds and marks', () => {
    for (const a of ALL) {
      const s = spec(a);
      expect(s, a).toBeTruthy();
      expect(s.holds?.length, a).toBe(s.frames);
    }
    expect(spec('attack').marks).toEqual({ charge: 1, release: 6, impact: 6, contact: 7, recover: 9 });
    expect(spec('special').marks?.release).toBe(5);
    expect(spec('summon').marks?.land).toBe(2);
    expect(spec('death').marks?.dissolve).toBe(4);
    expect(spec('idle').frames).toBe(16);
    expect(art.p2).toBe('relight');
    expect(art.weight).toBe('medium');
  });

  it('validateArt (normal tier) has no errors', { timeout: 60000 }, () => {
    expect(validateArt(art, { tier: 'normal', attack: 'melee' }).filter((f) => f.severity === 'error').map((f) => `${f.rule} ${f.anim} ${f.message}`)).toEqual([]);
  });

  it('draws deterministically and P2 keeps the silhouette', () => {
    const a = drawFrame(art, 'idle', 5, 'left');
    const b = drawFrame(art, 'idle', 5, 'left');
    expect(a.data.every((v: number, i: number) => v === b.data[i])).toBe(true);
    const r = drawFrame(art, 'idle', 3, 'right');
    const l = drawFrame(art, 'idle', 3, 'left');
    let diff = 0;
    for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) if (l.isOpaque(x, y) !== r.isOpaque(x, y)) diff++;
    expect(diff).toBe(0);
  });

  it('is a ~48-px figure and every frame keeps a 2-px margin', { timeout: 60000 }, () => {
    const f = drawFrame(art, 'idle', 0, 'left').bounds()!;
    expect(f.h).toBeGreaterThanOrEqual(46);
    expect(f.h).toBeLessThanOrEqual(54);
    for (const a of ALL) {
      for (let i = 0; i < spec(a).frames; i++) {
        const b = drawFrame(art, a, i, 'left').bounds();
        if (!b) continue;
        expect(Math.min(b.x, b.y, art.w - b.x - b.w, art.h - b.y - b.h), `${a} f${i}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('the head is a white enamel dial in a gold bezel; the coin is gold and flips', () => {
    const p = drawFrame(art, 'idle', 0, 'left');
    const hd = art.points!('idle', 0).head!;
    expect([PAL.white, PAL.mist]).toContain(p.get(hd.x, hd.y));
    expect([PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4]).toContain(p.get(hd.x - 8, hd.y));
    const m = art.points!('idle', 0).muzzle!;
    expect([PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4]).toContain(p.get(m.x, m.y));
    // in the air the coin turns edge-on: far fewer gold pixels round its centre than face-on
    const gold: number[] = [PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4];
    const around = (a: AnyMonsterAnim, f: number) => {
      const q = drawFrame(art, a, f, 'left');
      const c = art.points!(a, f).muzzle!;
      let n = 0;
      for (let y = c.y - 5; y <= c.y + 5; y++) for (let x = c.x - 5; x <= c.x + 5; x++) if (gold.includes(q.get(x, y) as number)) n++;
      return n;
    };
    expect(around('idle', 5)).toBeLessThan(around('idle', 0) * 0.6);
  });

  it('summon: hidden in the floor dial first, then pops out above the ground on a spring', () => {
    expect(count('summon', 0, [PAL.night2, PAL.stone3])).toBe(0);
    expect(count('summon', 1, [PAL.white])).toBeGreaterThan(10);
    const pop = drawFrame(art, 'summon', 3, 'left').bounds()!;
    const rest = drawFrame(art, 'summon', 13, 'left').bounds()!;
    expect(pop.y).toBeLessThan(rest.y - 12);
    expect(count('summon', 3, [PAL.stone4, PAL.stone2])).toBeGreaterThan(6);
  });

  it('attack: the somersault turns the dial below the coin hand, the contact reaches forward', () => {
    const top = art.points!('attack', 6);
    expect(top.head!.y).toBeGreaterThan(top.core!.y);
    const rest = art.points!('idle', 0);
    expect(art.points!('attack', 7).muzzle!.x).toBeGreaterThanOrEqual(rest.muzzle!.x + 12);
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
