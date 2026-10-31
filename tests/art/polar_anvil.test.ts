// Kutup Örsü (v3 art): every anim exists with marks and holds, validateArt (normal tier) reports no errors, a frame is
// deterministic, P2 is a relight of the same silhouette, the idle feet / field ring band never moves (HA-9), the
// summon starts as two separated half-anvils, and the card picture paints within the kit budgets.

import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/polar_anvil';
import card from '../../src/art/cardart-v3/polar_anvil';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';
import { PAL } from '../../src/art/palette';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive', 'special', 'victory'];
type Spec = { frames: number; holds?: number[]; marks?: Record<string, number> };
const spec = (a: AnyMonsterAnim): Spec => (art.anims as Record<string, Spec>)[a] ?? (art.extraAnims as Record<string, Spec>)[a];

describe('polar_anvil', () => {
  it('has every anim, marks and holds', () => {
    for (const a of ALL) {
      const s = spec(a);
      expect(s, a).toBeTruthy();
      expect(s.holds?.length, a).toBe(s.frames);
    }
    expect(spec('attack').marks).toEqual({ charge: 1, release: 5, impact: 5, contact: 6, recover: 8 });
    expect(spec('summon').marks?.land).toBeDefined();
    expect(spec('death').marks?.dissolve).toBeDefined();
    expect(art.p2).toBe('relight');
    expect(art.hover).toBe(0);
  });
  it('validateArt (normal tier) has no errors', () => {
    expect(validateArt(art, { tier: 'normal', attack: 'beam' }).filter((f) => f.severity === 'error').map((f) => `${f.rule} ${f.anim} ${f.message}`)).toEqual([]);
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
    const band = (anim: AnyMonsterAnim, f: number) => {
      const p = drawFrame(art, anim, f, 'left');
      const b = p.bounds()!;
      const bottom = b.y + b.h - 1;
      let x0 = Infinity;
      let x1 = -1;
      for (let y = bottom - 5; y <= bottom; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
      return `${bottom} ${x0}..${x1}`;
    };
    const ref = band('idle', 0);
    for (const a of ['idle', 'guard', 'toGuard', 'fromGuard'] as const) for (let f = 0; f < spec(a).frames; f++) expect(band(a, f), `${a} f${f}`).toBe(ref);
  });
  it('summon f0 shows two half-anvils apart (a column with no iron between them, only the arc)', () => {
    const p = drawFrame(art, 'summon', 0, 'left');
    const b = p.bounds()!;
    let gapCols = 0;
    for (let x = b.x; x < b.x + b.w; x++) {
      let solid = 0;
      for (let y = 30; y < 72; y++) { const c = p.get(x, y); if (c === PAL.stone1 || c === PAL.stone2 || c === PAL.ink) solid++; }
      if (solid === 0) gapCols++;
    }
    expect(gapCols).toBeGreaterThan(0);
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
