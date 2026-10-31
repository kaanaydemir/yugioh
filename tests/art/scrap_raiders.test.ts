// Hurda Akıncıları (v3 art): every anim exists with marks and holds, validateArt (normal tier, melee) reports no
// errors, a frame is deterministic, P2 is a relight of the same silhouette, the wheels' feet band never moves in idle,
// guard and the transitions (HA-9, even while the front wheel falls flat and the wrench goblin kneels), the guard is
// the tired lock pose (front wheel flat on the floor), the summon starts as a falling scrap pile without the cart,
// and the card picture paints within the kit budgets.

import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/scrap_raiders';
import card from '../../src/art/cardart-v3/scrap_raiders';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';
import { framePose } from '../../src/art/monsters-v3/scrap_raiders-anims';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive'];
type Spec = { frames: number; holds?: number[]; marks?: Record<string, number> };
const spec = (a: AnyMonsterAnim): Spec => (art.anims as Record<string, Spec>)[a] ?? (art.extraAnims as Record<string, Spec>)[a];

describe('scrap_raiders', () => {
  it('has every anim, marks and holds', () => {
    for (const a of ALL) {
      const s = spec(a);
      expect(s, a).toBeTruthy();
      expect(s.holds?.length, a).toBe(s.frames);
      for (const h of s.holds ?? []) expect(h, a).toBeGreaterThanOrEqual(40);
    }
    expect(spec('attack').marks).toEqual({ charge: 1, release: 5, impact: 5, contact: 6, recover: 8 });
    expect(spec('summon').marks?.land).toBeDefined();
    expect(spec('death').marks?.dissolve).toBeDefined();
    expect(art.p2).toBe('relight');
    expect(art.hover).toBe(0);
    expect(art.weight).toBe('heavy');
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
  it('keeps the feet band fixed in idle, guard and the transitions (HA-9)', () => {
    const band = (anim: AnyMonsterAnim, f: number, side: 'left' | 'right') => {
      const p = drawFrame(art, anim, f, side);
      const b = p.bounds()!;
      const bottom = b.y + b.h - 1;
      let x0 = Infinity;
      let x1 = -1;
      for (let y = bottom - 5; y <= bottom; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
      return `${bottom} ${x0}..${x1}`;
    };
    for (const side of ['left', 'right'] as const) {
      const ref = band('idle', 0, side);
      for (const a of ['idle', 'guard', 'toGuard', 'fromGuard'] as const) for (let f = 0; f < spec(a).frames; f++) expect(band(a, f, side), `${side} ${a} f${f}`).toBe(ref);
    }
  });
  it('guard is the tired lock pose: the front wheel lies flat, the wrench goblin kneels on the floor', () => {
    for (let f = 0; f < spec('guard').frames; f++) {
      const o = framePose('guard', f);
      expect(o.fwF, `guard f${f}`).toBe(1);
      expect(o.wLeg, `guard f${f}`).toBe(1);
      expect(o.sweat, `guard f${f}`).toBeGreaterThan(0);
    }
    expect(framePose('idle', 0).fwF).toBe(0);
    expect(framePose('fromGuard', spec('fromGuard').frames - 1).fwF).toBe(0);
  });
  it('summon f0 is a falling scrap pile: no cart, no crew', () => {
    const o = framePose('summon', 0);
    expect(o.heap).toBeGreaterThan(0);
    expect(o.heapY).toBeGreaterThan(0);
    expect([o.aTub, o.aWh, o.aRam, o.aTop, o.pVis, o.wVis, o.sVis]).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
  it('card picture: 4 living frames, both sizes inside the kit budgets', () => {
    expect(card.frames).toBe(4);
    const r = renderArt(card, 0);
    expect(r.auto).toBe(false);
    const big = artStats(r.big, r.bigPx, card.focus, true);
    const small = artStats(r.small, r.smallPx, card.focusSmall, true);
    for (const st of [big, small]) {
      expect(st.offPalette).toBe(0);
      expect(st.colors).toBeLessThanOrEqual(20);
      expect(st.backdropColors).toBeLessThanOrEqual(6);
      expect(st.isolated).toBeLessThanOrEqual(0.1);
      expect(st.focusOk).toBe(true);
    }
    expect(big.subjectFill).toBeGreaterThanOrEqual(0.6);
    expect(big.subjectFill).toBeLessThanOrEqual(0.75);
  });
});
