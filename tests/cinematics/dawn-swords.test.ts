// Şafak Kılıçları (dawn_swords): the fence geometry, the drawings (palette only), the counter -> blade mapping, the
// time budgets, and the sound recipes (played through the real synth Voice on a recording fake context).
import { afterAll, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  (globalThis as { __NEON_LOOK?: string }).__NEON_LOOK = 'v3';
});
vi.mock('phaser', async () => (await import('../presentation/_phaser-stub')).phaserStub());

import { PAL } from '../../src/art/palette';
import { PixelCanvas } from '../../src/art/pixel';
import { BOARD_COLS, zoneXY } from '../../src/view/layout';
import { BLADE_H, BLADE_W, DAWN, bladesLost, bladesShown, dissolveMs, fenceSpots, paintBadge, paintBlade, plantedBy, sweepReaches } from '../../src/cinematics/spells/_dawn_v3';
import { V3_DAWN_RECIPES } from '../../src/audio/v3/dawn';
import { Voice } from '../../src/audio/synth';
import type { Recipe } from '../../src/audio/sounds';

afterAll(() => {
  delete (globalThis as { __NEON_LOOK?: string }).__NEON_LOOK;
});

const PALETTE = new Set<number>(Object.values(PAL));
function paletteOnly(p: PixelCanvas): number {
  let bad = 0;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const a = p.alpha(x, y);
      if (a !== 0 && (a !== 255 || !PALETTE.has(p.get(x, y)!))) bad++;
    }
  return bad;
}

describe('dawn_swords scene', () => {
  it('the fence has six whole-pixel blades, left to right, in the target half', () => {
    for (const target of [0, 1] as const) {
      const s = fenceSpots(target);
      expect(s).toHaveLength(6);
      s.forEach((p, i) => {
        expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
        if (i) expect(p.x).toBeGreaterThan(s[i - 1].x);
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(640);
      });
      // the fence stands on the target's side of the middle: P0 (bottom half) lower than the board centre line
      const mid = zoneXY(target, 'monster', 1).y;
      expect(Math.abs(s[2].y - mid)).toBeLessThan(40);
    }
  });
  it('drawings are palette-only, opaque, with an ink outline', () => {
    const b = paintBlade();
    expect(b.w).toBe(BLADE_W);
    expect(b.h).toBe(BLADE_H);
    expect(paletteOnly(b)).toBe(0);
    for (let n = 0; n <= 3; n++) expect(paletteOnly(paintBadge(n))).toBe(0);
  });
  it('counter -> blades: 3 shows all six, each tick removes the outer pair', () => {
    expect(bladesShown(3)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(bladesShown(2)).toEqual([1, 2, 3, 4]);
    expect(bladesShown(1)).toEqual([2, 3]);
    expect(bladesShown(0)).toEqual([]);
    expect(bladesLost(3)).toEqual([0, 5]);
    expect(bladesLost(2)).toEqual([1, 4]);
    expect(bladesLost(1)).toEqual([2, 3]);
  });
  it('time budgets: activation <= 2.2 s, a tick dissolve <= 0.6 s, the sweep crosses lanes in order', () => {
    expect(dissolveMs()).toBeLessThanOrEqual(DAWN.budgetTick);
    expect(DAWN.sweepAt + DAWN.sweepMs).toBeLessThanOrEqual(plantedBy() + 200);
    let last = -1;
    for (let z = 0; z < 3; z++) {
      const t = sweepReaches(z);
      expect(t).toBeGreaterThan(last);
      expect(t).toBeLessThan(1);
      last = t;
    }
    expect(BOARD_COLS).toBeGreaterThan(2);
  });
});

describe('dawn_swords sounds', () => {
  const R = V3_DAWN_RECIPES as Record<string, Recipe>;
  const names = Object.keys(R);
  it('six recipes that play on the real synth without scheduling errors, one-shots <= 1.6 s', () => {
    expect(names.sort()).toEqual(['dawnDissolve', 'dawnDrop', 'dawnFade', 'dawnPlant', 'dawnShatter', 'dawnSweep']);
    for (const n of names) {
      const created: { start: number; stop: number }[] = [];
      const P = () => ({ value: 0, setValueAtTime() { return this; }, linearRampToValueAtTime() { return this; }, exponentialRampToValueAtTime(v: number) { if (v === 0) throw new Error('exp to 0'); return this; }, setTargetAtTime() { return this; }, setValueCurveAtTime() { return this; }, cancelScheduledValues() { return this; } });
      const node = () => ({ connect: (t: unknown) => t, disconnect() {} });
      const src = (extra: object) => {
        const r = { start: NaN, stop: NaN };
        created.push(r);
        return Object.assign(node(), extra, { start(t = 0) { r.start = t; }, stop(t = 0) { r.stop = t; } });
      };
      const ctx = {
        sampleRate: 8000, currentTime: 0, destination: node(),
        createGain: () => Object.assign(node(), { gain: P() }),
        createOscillator: () => src({ frequency: P(), detune: P(), type: 'sine', setPeriodicWave() {} }),
        createBufferSource: () => src({ buffer: null, loop: false, playbackRate: P(), detune: P() }),
        createBiquadFilter: () => Object.assign(node(), { type: 'lowpass', frequency: P(), Q: P(), gain: P(), detune: P() }),
        createWaveShaper: () => Object.assign(node(), { curve: null, oversample: 'none' }),
        createStereoPanner: () => Object.assign(node(), { pan: P() }),
        createDelay: () => Object.assign(node(), { delayTime: P() }),
        createPeriodicWave: () => ({}),
        createBuffer: (ch: number, len: number, sr: number) => ({ numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr, getChannelData: () => new Float32Array(len) }),
      } as unknown as BaseAudioContext;
      (globalThis as { AudioParam?: unknown }).AudioParam = class {};
      let s = 7;
      const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      const v = new Voice(ctx, ctx.destination, 0.5, 1, rng);
      expect(() => R[n].play(v), n).not.toThrow();
      expect(created.length, n).toBeGreaterThan(0);
      for (const c of created) expect(c.stop).toBeGreaterThan(c.start);
      expect(v.end, n).toBeLessThanOrEqual(1.6);
    }
  });
});
