// Lane A5-A step A-8 — the reduced-motion profile of the lane's v3 scenes (docs/v3/A5_PLAN.md §3.0, §6.4,
// §6.5: "REDUCED_MOTION'da sahne süreleri ≤ normal"; KO-9 spirit): particles halved (never to 0), no local
// tremble, no overshoot — on the very same frames, so every time stays ≤ the normal one. The scenes read
// these pure helpers; the films (?motion=reduced) and the measure runs check the rest.
// (Its own file, like a5-blade.test.ts / a5-spring.test.ts.)

import { afterAll, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  (globalThis as { __NEON_LOOK?: string }).__NEON_LOOK = 'v3';
});
vi.mock('phaser', async () => (await import('../presentation/_phaser-stub')).phaserStub());

import { FOUNTAIN_H } from '../../src/art/spellmotifs-v3';
import { SPRING_V3, riseHeight } from '../../src/cinematics/spells/_spring_v3';
import { OPEN_MS, abyssOpenAt, openShiver } from '../../src/cinematics/traps/_chasm_v3';
import { fxCount, jitter } from '../../src/cinematics/_v3/spellfx';

afterAll(() => {
  delete (globalThis as { __NEON_LOOK?: string }).__NEON_LOOK;
});

const FRAME = 1000 / 60;

describe('A-8 reduced motion (A5 §3.0 / §6.4)', () => {
  it('Şifa Pınarı: the jet never passes its full height (no crest overshoot) on the same rise frames', () => {
    const n = SPRING_V3.rise.length;
    const full = Array.from({ length: n }, (_, i) => riseHeight(i, false));
    const red = Array.from({ length: n }, (_, i) => riseHeight(i, true));
    // the normal rise has its crest over the full height (the overshoot this profile removes)…
    expect(Math.max(...full)).toBeGreaterThan(FOUNTAIN_H);
    // …the reduced one stops at it, reaches it on the same last frame and never goes down on the way up
    expect(Math.max(...red)).toBe(FOUNTAIN_H);
    expect(red[n - 1]).toBe(FOUNTAIN_H);
    for (let i = 1; i < n; i++) expect(red[i]).toBeGreaterThanOrEqual(red[i - 1]);
    // the same number of frames: the drops leave on the same crest frame (times unchanged)
    expect(red.length).toBe(full.length);
    expect(red[SPRING_V3.dropFrame]).toBeGreaterThan(0);
  });

  it('Yer Yarığı: the abyss opens without passing 1 and the victim does not shiver, on the same frames', () => {
    const frames = Math.max(2, Math.round(OPEN_MS / FRAME));
    const full = Array.from({ length: frames }, (_, k) => abyssOpenAt((k + 1) / frames, false));
    const red = Array.from({ length: frames }, (_, k) => abyssOpenAt((k + 1) / frames, true));
    expect(Math.max(...full)).toBeGreaterThan(1); // the overshoot of the normal profile
    expect(Math.max(...red)).toBeLessThanOrEqual(1);
    expect(red[frames - 1]).toBeCloseTo(1, 9);
    for (let k = 1; k < frames; k++) expect(red[k]).toBeGreaterThanOrEqual(red[k - 1]);
    const shiverFull = Array.from({ length: frames }, (_, k) => openShiver(k, false));
    const shiverRed = Array.from({ length: frames }, (_, k) => openShiver(k, true));
    expect(shiverFull.some((x) => x !== 0)).toBe(true);
    expect(shiverRed.every((x) => x === 0)).toBe(true);
    // whole pixels only
    for (const x of shiverFull) expect(Number.isInteger(x)).toBe(true);
  });

  it('the shared kit: particles halved (never to 0, never more), the local tremble off', async () => {
    for (const n of [1, 2, 3, 7, 10, 22, 26]) {
      expect(fxCount(n, false)).toBe(n);
      expect(fxCount(n, true)).toBe(Math.max(1, Math.ceil(n / 2)));
      expect(fxCount(n, true)).toBeLessThanOrEqual(n);
    }
    expect(fxCount(0, true)).toBe(0);
    // jitter with reduced motion resolves at once and never moves the object
    const obj = { x: 10, y: 20, moved: 0, setPosition(x: number, y: number) { this.moved++; this.x = x; this.y = y; } };
    await jitter({} as never, obj, 120, true);
    expect(obj.moved).toBe(0);
    expect([obj.x, obj.y]).toEqual([10, 20]);
  });
});
