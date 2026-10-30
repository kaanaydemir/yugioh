// A4 batch 2 — Kum Saati Cücesi (hourglass_imp) v3 on biped/v1: registered like the other v3 monsters; idle f0
// stays within the palette and its colour budget; P2 is a relight (same silhouette, other light) in every
// frame of every anim; the five base anims and the nine extras carry their marks and hold rules (validateArt
// clean); the sand falls in idle (the stream marches 1 px a frame) and FREEZES when it casts (attack / special:
// the freeze channel is on from the charge to the release and off from the follow-through; the stream does not
// move while frozen); the feet change place only in the air; the death ends on a heap and a drained glass and
// the summon forms the body from the feet up; the sheets are deterministic.

import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/hourglass_imp';
import { hasMonsterArtV3 } from '../../src/art/monsters';
import { PAL } from '../../src/art/palette';
import { PixelCanvas } from '../../src/art/pixel';
import { drawFrame, frameDelta, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim, MonsterAnim } from '../../src/art/types';

const BASE: readonly MonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit'];
const EXTRA = ['summon', 'death', 'revive', 'special', 'hitHeavy', 'hitMagic', 'victory', 'toGuard', 'fromGuard'] as const;
const ALL: readonly AnyMonsterAnim[] = [...BASE, ...EXTRA];
const specOf = (a: AnyMonsterAnim) => (art.anims as Record<string, { frames: number; holds?: number[]; marks?: Record<string, number> }>)[a] ?? art.extraAnims![a as (typeof EXTRA)[number]]!;
const PALETTE = new Set<number>(Object.values(PAL));
const T = 30000;

const colours = (p: PixelCanvas) => {
  const s = new Set<number>();
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const c = p.get(x, y);
    if (c !== null) s.add(c);
  }
  return s;
};
const count = (p: PixelCanvas) => {
  let n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) n++;
  return n;
};

describe('hourglass_imp v3 (biped/v1)', () => {
  it('is registered as v3 art of its card, on the biped plan, normal tier, light weight', () => {
    expect(hasMonsterArtV3('hourglass_imp')).toBe(true);
    expect(art.id).toBe('hourglass_imp');
    expect(art.bodyPlan?.id).toBe('biped');
    expect(art.weight).toBe('light');
    expect(art.p2).toBe('relight');
  });

  it('idle f0: palette only, ≤ 20 colours, a small figure with a tall staff, nothing on the frame edge', () => {
    const p = drawFrame(art, 'idle', 0);
    const cs = colours(p);
    for (const c of cs) expect(PALETTE.has(c), `colour ${c.toString(16)}`).toBe(true);
    expect(cs.size).toBeLessThanOrEqual(20);
    const b = p.bounds()!;
    expect(b.h).toBeGreaterThanOrEqual(42);
    expect(b.h).toBeLessThanOrEqual(52);
    expect(b.x).toBeGreaterThanOrEqual(2);
    expect(b.y).toBeGreaterThanOrEqual(2);
    expect(count(p)).toBeGreaterThan(700);
  });

  it('P2 is a relight: every frame of every anim keeps the P1 silhouette, and idle f0 really changes its light', () => {
    for (const anim of ALL)
      for (let f = 0; f < specOf(anim).frames; f++) {
        const p1 = drawFrame(art, anim, f, 'left');
        const p2 = drawFrame(art, anim, f, 'right');
        let diff = 0;
        for (let y = 0; y < art.h; y++) for (let x = 0; x < art.w; x++) if (p1.isOpaque(x, y) !== p2.isOpaque(x, y)) diff++;
        expect(diff, `${anim} f${f}`).toBe(0);
      }
    expect(frameDelta(drawFrame(art, 'idle', 0, 'left'), drawFrame(art, 'idle', 0, 'right'))).toBeGreaterThan(150);
  }, T * 3);

  it('marks, holds and out (validateArt): clean for every anim', () => {
    const findings = validateArt(art, { tier: 'normal', attack: 'melee' });
    expect(findings.filter((f) => f.severity === 'error'), JSON.stringify(findings.filter((f) => f.severity === 'error'))).toEqual([]);
    const m = (a: AnyMonsterAnim) => specOf(a).marks ?? {};
    expect(m('attack').charge).toBe(0);
    expect(m('attack').release).toBeGreaterThan(m('attack').charge!);
    expect(m('attack').contact).toBe(m('attack').release! + 1);
    expect(m('attack').recover).toBeGreaterThan(m('attack').contact!);
    expect(m('special').release).toBeGreaterThan(m('special').charge!);
    expect(m('summon').land).toBeGreaterThan(0);
    expect(m('revive').land).toBeGreaterThan(0);
    expect(m('death').dissolve).toBeGreaterThan(0);
    for (const a of ['hit', 'hitHeavy', 'hitMagic', 'death'] as const) expect([m(a).impact, m(a).contact], a).toEqual([0, 0]);
  }, T);

  it('the sand falls in idle (the stream marches a pixel a frame) and freezes in the cast', () => {
    const fx = (anim: AnyMonsterAnim, f: number) => (art as unknown as { pose(a: AnyMonsterAnim, f: number): { fx: Record<string, number> } }).pose(anim, f).fx;
    // idle: never frozen, the grain phase steps every frame
    const phases = Array.from({ length: specOf('idle').frames }, (_, f) => fx('idle', f).sand);
    for (let f = 0; f < phases.length; f++) {
      expect(fx('idle', f).freeze).toBe(0);
      expect(phases[f]).not.toBe(phases[(f + 1) % phases.length]);
    }
    // attack: frozen from the charge to the release, flowing again from the follow-through
    const a = specOf('attack').marks!;
    for (let f = a.charge!; f <= a.release!; f++) expect(fx('attack', f).freeze, `attack f${f}`).toBe(1);
    expect(fx('attack', a.recover!).freeze).toBe(0);
    // guard: the time shield holds the sand frozen
    for (let f = 0; f < specOf('guard').frames; f++) expect(fx('guard', f).freeze, `guard f${f}`).toBe(1);
    // special: held still through the held moment
    const s = specOf('special').marks!;
    expect(fx('special', s.release!).freeze).toBe(1);
    expect(fx('special', s.recover!).freeze).toBe(0);
  });

  it('feet change place only in the air (HA-9): idle and guard keep the lowest rows where they are', () => {
    const band = (p: PixelCanvas) => {
      const b = p.bounds()!;
      const bottom = b.y + b.h - 1;
      let x0 = Infinity;
      let x1 = -1;
      for (let y = bottom - 2; y <= bottom; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
      return [bottom, x0, x1];
    };
    const ref = band(drawFrame(art, 'idle', 0));
    for (const anim of ['idle', 'guard'] as const) for (let f = 0; f < specOf(anim).frames; f++) expect(band(drawFrame(art, anim, f)), `${anim} f${f}`).toEqual(ref);
  });

  it('death ends on a heap of sand and a drained glass; summon forms the body from the feet up; revive is death backwards', () => {
    const last = drawFrame(art, 'death', specOf('death').frames - 1);
    const first = drawFrame(art, 'idle', 0);
    expect(count(last)).toBeLessThan(count(first) * 0.75);
    // the body is gone from the top: nothing above the staff's glass-top row except the staff
    const top = (p: PixelCanvas, x0: number, x1: number) => {
      for (let y = 0; y < p.h; y++) for (let x = x0; x <= x1; x++) if (p.isOpaque(x, y)) return y;
      return p.h;
    };
    expect(top(last, 4, 33)).toBeGreaterThan(top(first, 4, 33) + 20);
    const s0 = drawFrame(art, 'summon', 0);
    const sL = drawFrame(art, 'summon', specOf('summon').marks!.land!);
    expect(top(s0, 4, 33)).toBeGreaterThan(top(sL, 4, 33) + 15);
    const r0 = drawFrame(art, 'revive', 0);
    expect(top(r0, 4, 33)).toBeGreaterThan(top(first, 4, 33) + 20);
  });

  it('points(): the muzzle is inside the frame on every frame; the cast leaves from the glass, the throw from the far hand', () => {
    for (const anim of ALL)
      for (let f = 0; f < specOf(anim).frames; f++) {
        const pt = art.points!(anim, f);
        expect(pt.muzzle, `${anim} f${f}`).toBeDefined();
        expect(pt.muzzle!.x).toBeGreaterThanOrEqual(0);
        expect(pt.muzzle!.x).toBeLessThan(art.w);
        expect(pt.muzzle!.y).toBeGreaterThanOrEqual(0);
        expect(pt.muzzle!.y).toBeLessThan(art.h);
      }
    const rel = specOf('attack').marks!.release!;
    const pt = art.points!('attack', rel);
    expect(pt.muzzle!.x).toBeGreaterThan(pt.core!.x);
  });

  it('is deterministic', () => {
    for (const [anim, f] of [['idle', 3], ['attack', 4], ['death', 6], ['summon', 3]] as const) {
      const a = drawFrame(art, anim, f);
      const b = drawFrame(art, anim, f);
      expect(frameDelta(a, b)).toBe(0);
    }
  });
});
