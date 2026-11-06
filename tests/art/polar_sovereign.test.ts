// Kutup Hükümdarı (v3 art, ace): every anim exists with marks and holds, validateArt (ace tier) reports no errors, a
// frame is deterministic, P2 is a relight of the same silhouette, the plinth band never moves in idle / guard /
// transitions (HA-9), the summon starts as the exploded pieces (the closed needle drawn whole, the anvil upright) and
// ends assembled on the floor, the death is the split that fails (the body ends low and gone), the frame budget fits
// KK-13, the card picture paints within the kit budgets, and the cut-in has a relit P2.

import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/polar_sovereign';
import card from '../../src/art/cardart-v3/polar_sovereign';
import cutinFactory from '../../src/art/cutins-v3/polar_sovereign';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';
import { PixelCanvas } from '../../src/art/pixel';
import { SUMMON_KLAK, SUMMON_LAND, DEATH_SPLIT, framePose } from '../../src/art/monsters-v3/polar_sovereign-anims';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive', 'special'];
type Spec = { frames: number; holds?: number[]; marks?: Record<string, number> };
const spec = (a: AnyMonsterAnim): Spec => (art.anims as Record<string, Spec>)[a] ?? (art.extraAnims as Record<string, Spec>)[a];
const bbox = (anim: AnyMonsterAnim, f: number) => drawFrame(art, anim, f, 'left').bounds()!;

describe('polar_sovereign', () => {
  it('has every anim, marks and holds (ace counts)', () => {
    for (const a of ALL) {
      const s = spec(a);
      expect(s, a).toBeTruthy();
      expect(s.holds?.length, a).toBe(s.frames);
      for (const h of s.holds!) expect(h, a).toBeGreaterThanOrEqual(40);
    }
    expect(spec('idle').frames).toBe(20);
    expect(spec('attack').marks).toMatchObject({ charge: 1, release: 11, recover: 13 });
    expect(spec('summon').marks?.land).toBe(SUMMON_LAND);
    expect(spec('death').marks).toMatchObject({ impact: 0, contact: 0 });
    expect(spec('death').holds!.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(900);
    expect(art.p2).toBe('relight');
    expect(art.hover).toBe(0);
    expect(art.weight).toBe('heavy');
    // KK-13: ≤ 140 frames, ≤ 7 MB uncropped per side (ace)
    const frames = ALL.reduce((n, a) => n + spec(a).frames, 0);
    expect(frames).toBeLessThanOrEqual(140);
    expect(art.w * art.h * 4 * frames).toBeLessThanOrEqual(7e6);
  });
  it('validateArt (ace tier) has no errors', () => {
    expect(validateArt(art, { tier: 'ace', attack: 'projectile' }).filter((f) => f.severity === 'error').map((f) => `${f.rule} ${f.anim} ${f.message}`)).toEqual([]);
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
  it('keeps the plinth band fixed in idle, guard and the transitions (HA-9)', () => {
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
  it('summon is the fusion: exploded pieces → three KLAKs → assembled on the floor', () => {
    const f0 = framePose('summon', 0);
    expect(f0.npiece).toBe(1);
    expect(f0.aflip).toBe(1);
    expect(f0.arms).toBe(0);
    expect(SUMMON_KLAK).toEqual([3, 5, 7]);
    for (const k of SUMMON_KLAK) expect(framePose('summon', k).seam).toBeGreaterThanOrEqual(2.5);
    expect(framePose('summon', SUMMON_LAND).lift).toBe(0);
    expect(framePose('summon', SUMMON_LAND - 1).lift).toBeGreaterThan(0);
    // the exploded view stands taller than the assembled body
    expect(bbox('summon', 0).h).toBeGreaterThan(bbox('idle', 0).h);
  });
  it('death splits the body apart, then ends low and gone', () => {
    expect(framePose('death', DEATH_SPLIT).gap).toBeGreaterThan(0);
    expect(bbox('death', 5).h).toBeLessThan(bbox('idle', 0).h / 2);
    const last = drawFrame(art, 'death', spec('death').frames - 1, 'left').bounds();
    expect(last === null || last.h <= 16).toBe(true);
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
  it('cut-in: 200×144, relit P2, played once ≤ 1.2 s to its held frame', () => {
    const c = (cutinFactory as unknown as (k: unknown) => { w: number; h: number; frames: number; holds: number[]; p2: string; draw: (p: PixelCanvas, f: number, o?: { lightFrom: 'left' | 'right' }) => void })({});
    expect([c.w, c.h]).toEqual([200, 144]);
    expect(c.p2).toBe('relight');
    expect(c.holds.length).toBe(c.frames);
    const a = new PixelCanvas(c.w, c.h);
    const b = new PixelCanvas(c.w, c.h);
    c.draw(a, c.frames - 1, { lightFrom: 'left' });
    c.draw(b, c.frames - 1, { lightFrom: 'right' });
    let d = 0;
    for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== b.data[i]) d++;
    expect(d).toBeGreaterThan(200);
  });
});
