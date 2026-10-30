// Hortlak Muhafız v3 (biped/v1, A4 batch 1): registered art, P2 relight (same silhouette, other light), marks and
// holds clean (validateArt), the feet never move on the ground, the dissolve death erodes from the horns down and
// leaves little, the summon climbs out of its grave, every extra ends on its exact pose, the cleaver is the muzzle,
// the card pictures paint both sizes within the kit's budgets. Frames are deterministic.

import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/grim_warden';
import { hasMonsterArtV3 } from '../../src/art/monsters';
import { drawFrame, frameDelta, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';
import { renderArt, artStats } from '../../src/art/cardart-v3/_kit';
import card from '../../src/art/cardart-v3/grim_warden';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'summon', 'death', 'revive', 'hitHeavy', 'hitMagic', 'victory', 'toGuard', 'fromGuard'];
const specOf = (a: AnyMonsterAnim) => (art.anims as Record<string, { frames: number; holds?: number[]; marks?: Record<string, number> }>)[a] ?? art.extraAnims![a as never]!;
const opaque = (p: ReturnType<typeof drawFrame>) => {
  let n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) n++;
  return n;
};

describe('grim_warden v3', () => {
  it('is registered and has every anim the default cinematic path needs', () => {
    expect(hasMonsterArtV3('grim_warden')).toBe(true);
    expect([art.w, art.h, art.anchorX, art.anchorY]).toEqual([92, 96, 38, 90]);
    for (const a of ALL) expect(specOf(a), a).toBeTruthy();
  });

  it('P2 is a relight: every frame keeps the P1 silhouette, and idle f0 really changes its light', () => {
    for (const anim of ALL)
      for (let f = 0; f < specOf(anim).frames; f++) {
        const p1 = drawFrame(art, anim, f, 'left');
        const p2 = drawFrame(art, anim, f, 'right');
        let diff = 0;
        for (let y = 0; y < art.h; y++) for (let x = 0; x < art.w; x++) if (p1.isOpaque(x, y) !== p2.isOpaque(x, y)) diff++;
        expect(diff, `${anim} f${f}`).toBe(0);
      }
    expect(frameDelta(drawFrame(art, 'idle', 0, 'left'), drawFrame(art, 'idle', 0, 'right'))).toBeGreaterThan(300);
  }, 120000);

  it('marks, holds and out (validateArt) are clean', () => {
    const findings = validateArt(art, { tier: 'normal', attack: 'melee' });
    expect(findings.filter((f) => f.severity === 'error' || (f as { level?: string }).level === 'error')).toEqual([]);
  });

  it('the chop: charge < release < contact < recover; the coil is the longest hold', () => {
    const s = specOf('attack');
    const m = s.marks!;
    expect(m.charge).toBeLessThan(m.release);
    expect(m.release).toBeLessThan(m.contact);
    expect(m.contact).toBeLessThan(m.recover);
    expect(Math.max(...s.holds!.slice(0, m.release))).toBe(190);
  });

  it('a standing warden never moves its feet; the death leaves little of the body; the summon starts sunk in the floor', () => {
    const feet = (p: ReturnType<typeof drawFrame>) => {
      let lo = 99;
      let hi = 0;
      for (let x = 0; x < p.w; x++) if (p.isOpaque(x, 89)) (lo = Math.min(lo, x)), (hi = Math.max(hi, x));
      return [lo, hi];
    };
    const f0 = feet(drawFrame(art, 'idle', 0));
    for (let f = 0; f < specOf('idle').frames; f++) expect(feet(drawFrame(art, 'idle', f))).toEqual(f0);
    const last = specOf('death').frames - 1;
    expect(opaque(drawFrame(art, 'death', last))).toBeLessThan(opaque(drawFrame(art, 'idle', 0)) * 0.4);
    expect(opaque(drawFrame(art, 'summon', 0))).toBeLessThan(opaque(drawFrame(art, 'idle', 0)) * 0.6);
    for (const a of ['attack', 'roar', 'hit', 'summon', 'revive', 'hitHeavy', 'hitMagic', 'toGuard', 'fromGuard'] as const) {
      const n = specOf(a).frames - 1;
      expect(frameDelta(drawFrame(art, a, n), drawFrame(art, a === 'toGuard' ? 'guard' : 'idle', 0)), a).toBe(0);
    }
  });

  it('the muzzle is the cleaver tip and stays on the floor line or above', () => {
    for (const a of ALL)
      for (let f = 0; f < specOf(a).frames; f++) {
        const pt = art.points!(a, f).muzzle!;
        expect(pt.y, `${a} f${f}`).toBeLessThanOrEqual(90);
      }
  });

  it('is deterministic', () => {
    expect(frameDelta(drawFrame(art, 'attack', 4), drawFrame(art, 'attack', 4))).toBe(0);
  });
});

describe('grim_warden card picture (cardart-v3)', () => {
  it('paints both sizes within the kit budgets, all three living frames', () => {
    for (let f = 0; f < 3; f++) {
      const r = renderArt(card, f);
      for (const [l, px, focus] of [[r.big, r.bigPx, card.focus], [r.small, r.smallPx, [card.focus[0] / 2, card.focus[1] / 2] as const]] as const) {
        const st = artStats(l, px, focus);
        expect(st.offPalette).toBe(0);
        expect(st.isolated).toBeLessThanOrEqual(0.1);
        expect(st.colors).toBeLessThanOrEqual(20);
      }
    }
  });
});
