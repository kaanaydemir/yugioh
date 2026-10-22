// tools/monster-gates.ts helpers (tools/lib/framelib.ts; REHBER §8.1 KK-3…KK-6, KK-13): the IŞ-10 frame
// classes, the HA-1 mandatory marks, the feet band (HA-9), the size class and sheet byte budget, and the
// monster-sheet pixel metrics they rest on. The full gate run on the slice is a tool run, not a test.

import { describe, expect, it } from 'vitest';
import { SHEET_BUDGET_MB, delta, feetBand, isolated, missingMarks, noiseClass, sizeClass } from '../../tools/lib/framelib';
import { PAL } from '../../src/art/palette';
import { PixelCanvas } from '../../src/art/pixel';
import type { MonsterArt } from '../../src/art/types';
import { animList, animSpec } from '../../src/art/animtime';
import { monsterArt, monsterArtV3 } from '../../src/art/monsters';

describe('IŞ-10 frame classes', () => {
  it('attack / special from the charge mark on are effect frames (≤ 20 %), before it body frames', () => {
    const atk = { charge: 1, release: 6, impact: 6, recover: 8 };
    expect(noiseClass('attack', 0, atk, 12)).toEqual({ cls: 'body', limit: 0.15 });
    expect(noiseClass('attack', 6, atk, 12)).toEqual({ cls: 'effect', limit: 0.2 });
    expect(noiseClass('special', 9, { charge: 1, release: 6, recover: 9 }, 12).cls).toBe('effect');
    // a v1 attack without marks: from attackImpactFrame on
    expect(noiseClass('attack', 4, { 'impact*': 5 }, 10).cls).toBe('body');
    expect(noiseClass('attack', 5, { 'impact*': 5 }, 10).cls).toBe('effect');
  });
  it('summon / revive are effect frames, death only from dissolve, the rest body', () => {
    expect(noiseClass('summon', 0, { land: 6 }, 12).cls).toBe('effect');
    expect(noiseClass('revive', 11, { land: 5 }, 12).cls).toBe('effect');
    expect(noiseClass('death', 3, { impact: 0, dissolve: 4 }, 10).cls).toBe('body');
    expect(noiseClass('death', 4, { impact: 0, dissolve: 4 }, 10).cls).toBe('effect');
    for (const a of ['idle', 'guard', 'hit', 'hitHeavy', 'roar', 'toGuard', 'victory'] as const) expect(noiseClass(a, 2, {}, 6).cls).toBe('body');
  });
});

describe('HA-1 marks', () => {
  it('finds missing and misplaced mandatory marks', () => {
    expect(missingMarks('death', { impact: 0, dissolve: 4 })).toEqual(['contact']); // the wyrm (REHBER §10.6)
    expect(missingMarks('death', { impact: 0, contact: 0, dissolve: 4 })).toEqual([]);
    expect(missingMarks('hit', { impact: 1, contact: 0, recover: 3 })).toEqual(['impact≠f0']);
    expect(missingMarks('attack', { charge: 1, impact: 5, recover: 9 })).toEqual([]); // impact stands in for release
    expect(missingMarks('attack', { 'impact*': 5 })).toEqual(['charge', 'recover']);
    expect(missingMarks('summon', {})).toEqual(['land']);
    expect(missingMarks('idle', {})).toEqual([]);
  });
});

describe('frame metrics', () => {
  it('feet band: bottom row and the x range of the lowest 6 rows', () => {
    const p = new PixelCanvas(20, 20);
    p.rect(5, 2, 4, 10, PAL.stone2); // body, ends at y 11
    p.rect(3, 12, 3, 6, PAL.stone1); // far foot y 12–17
    p.rect(10, 15, 4, 3, PAL.stone1); // near foot y 15–17
    expect(feetBand(p)).toEqual({ bottom: 17, x0: 3, x1: 13 });
    expect(feetBand(new PixelCanvas(4, 4))).toBeNull();
  });
  it('delta and isolated follow tools/monster-sheet.ts', () => {
    const a = new PixelCanvas(6, 6);
    a.rect(1, 1, 3, 3, PAL.stone2);
    const b = a.clone();
    b.set(2, 2, PAL.stone3); // one recoloured pixel, isolated (its 4 neighbours are stone2)
    b.set(5, 5, PAL.stone1); // one new pixel, no opaque neighbour: not counted as isolated
    expect(delta(a, b)).toBe(2);
    expect(isolated(b)).toBe(1);
    expect(isolated(a)).toBe(0);
  });
  it('size class and the uncropped byte budget (A3_MIMARI §11.1)', () => {
    const art = { bodyPlan: undefined } as unknown as MonsterArt;
    const plan = { bodyPlan: { id: 'biped', version: 1 } } as unknown as MonsterArt;
    expect(sizeClass(art, 96, true)).toBe('ace');
    expect(sizeClass(plan, 80, true)).toBe('large');
    expect(sizeClass(plan, 64, true)).toBe('medium');
    expect(sizeClass(plan, 48, true)).toBe('small');
    expect(sizeClass(art, 64, false)).toBe('medium');
    // the slice, computed from its v3 art as monster-gates does (w × h × 4 × every anim's frames, per
    // side): 6.56 MB and 6.76 MB, both in the ace budget (A3 core review F7: no longer literals)
    const bytes = (id: 'crystal_wyrm' | 'abyss_magus') => {
      const a = monsterArtV3(id)!;
      return (a.w * a.h * 4 * animList(a).reduce((n, k) => n + animSpec(a, k)!.frames, 0)) / 1e6;
    };
    expect(bytes('crystal_wyrm')).toBeCloseTo(6.56, 2);
    expect(bytes('abyss_magus')).toBeCloseTo(6.76, 2);
    for (const id of ['crystal_wyrm', 'abyss_magus'] as const) {
      expect(sizeClass(monsterArtV3(id)!, monsterArt(id).w, true)).toBe('ace');
      expect(bytes(id)).toBeLessThanOrEqual(SHEET_BUDGET_MB.ace);
    }
    expect(SHEET_BUDGET_MB).toEqual({ ace: 7, large: 5, medium: 3.6, small: 2.2 });
  });
});
