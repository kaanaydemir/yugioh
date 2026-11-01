// Şafak Kılıçları (dawn_swords), lane E's new signature — the gilded dawn cage: its geometry (whole pixels, the door
// in the middle, every lane inside), the drawings (palette only, the padlock's tongues read the counter), the timing
// budget and the e_dawn* sound recipes (played through the real synth Voice on a recording fake context).
import { afterAll, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  (globalThis as { __NEON_LOOK?: string }).__NEON_LOOK = 'v3';
});
vi.mock('phaser', async () => (await import('../presentation/_phaser-stub')).phaserStub());

import { PAL } from '../../src/art/palette';
import type { PixelCanvas } from '../../src/art/pixel';
import { LANE_COLS, zoneXY } from '../../src/view/layout';
import { DOOR_ANGLES, cageGeo, cp, lockAt, paintBack, paintBadge, paintChain, paintDoor, paintFront, paintLock, paintSun, sunAt } from '../../src/cinematics/spells/_dawn_e_paint';
import { CAGE_T } from '../../src/cinematics/spells/_dawn_e';
import { RECIPES } from '../../src/audio/v3/e/dawn_swords';
import { Voice } from '../../src/audio/synth';
import type { Recipe } from '../../src/audio/sounds';

afterAll(() => {
  delete (globalThis as { __NEON_LOOK?: string }).__NEON_LOOK;
});

const PALETTE = new Set<number>(Object.values(PAL));
function offPalette(p: PixelCanvas): number {
  let bad = 0;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const a = p.alpha(x, y);
      if (a !== 0 && (a !== 255 || !PALETTE.has(p.get(x, y)!))) bad++;
    }
  return bad;
}
function same(a: PixelCanvas, b: PixelCanvas): boolean {
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (a.get(x, y) !== b.get(x, y) || a.alpha(x, y) !== b.alpha(x, y)) return false;
  return true;
}

describe('dawn cage geometry', () => {
  for (const target of [0, 1] as const) {
    it(`covers every lane of player ${target + 1}'s monster row, door in the middle`, () => {
      const g = cageGeo(target);
      // every lane's floor point lies inside the footprint (between the column ends and the two long sides)
      for (let i = 0; i < LANE_COLS.length; i++) {
        const z = zoneXY(target, 'monster', i);
        expect(z.x).toBeGreaterThan(cp(g.c0, g.rB, 0).x);
        expect(z.x).toBeLessThan(cp(g.c1, g.rA, 0).x);
      }
      // bars on a ¼-column grid: whole pixels at every height
      for (const c of g.bars) for (const h of [0, g.H, g.H + g.VR]) {
        const p = cp(c, g.rB, h);
        expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
      }
      expect(g.kl - g.kc).toBe(1);
      expect(g.kc - g.kh).toBe(1);
      expect(g.kc).toBe((g.bars.length - 1) / 2);
      // the sun and the padlock are inside the canvas
      for (const p of [sunAt(g), lockAt(g)]) {
        expect(p.x).toBeGreaterThan(g.ox);
        expect(p.x).toBeLessThan(g.ox + g.w);
        expect(p.y).toBeGreaterThan(g.oy);
        expect(p.y).toBeLessThan(g.oy + g.h);
      }
    });
  }
});

describe('dawn cage drawings', () => {
  const g = cageGeo(1);
  it('are palette only', () => {
    const all = [paintBack(g), paintFront(g), ...DOOR_ANGLES.map((d) => paintDoor(g, d)), paintDoor(g, 0, true), paintChain(120), paintSun(0, 0), paintSun(1, 0), paintSun(1, 1)];
    for (let n = 0; n <= 3; n++) all.push(paintLock(n), paintLock(n, { open: true }), paintLock(n, { turning: 0 }), paintBadge(n), paintBadge(n, { turning: 1 }));
    for (const p of all) expect(offPalette(p)).toBe(0);
  });
  it('the padlock shows the counter: every count is a different picture; the shackle opens', () => {
    const locks = [0, 1, 2, 3].map((n) => paintLock(n));
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) expect(same(locks[a], locks[b])).toBe(false);
    expect(same(paintLock(0), paintLock(0, { open: true }))).toBe(false);
    const badges = [1, 2, 3].map((n) => paintBadge(n));
    expect(same(badges[0], badges[1]) || same(badges[1], badges[2])).toBe(false);
  });
  it('the door has a different drawing for every angle; the sun twinkles', () => {
    const doors = DOOR_ANGLES.map((d) => paintDoor(g, d));
    for (let i = 1; i < doors.length; i++) expect(same(doors[i - 1], doors[i])).toBe(false);
    expect(same(paintSun(1, 0), paintSun(1, 1))).toBe(false);
  });
});

describe('dawn cage timing', () => {
  it('the signature after the land frame stays ≈ 1.3 s of scene time', () => {
    const T = CAGE_T;
    const slam = T.drop + 17 + T.doorAt + T.swing;
    const end = slam + T.endAt;
    expect(end).toBeLessThanOrEqual(1400);
    expect(T.tongue0 + 2 * T.tongueGap).toBeLessThan(T.endAt);
    expect(T.badgeAt).toBeLessThanOrEqual(T.endAt);
    expect(T.springAt).toBeLessThan(T.haulAt);
  });
});

describe('e_dawn* sounds', () => {
  const R = RECIPES as Record<string, Recipe>;
  for (const n of Object.keys(R)) {
    it(`${n} plays, every source stops, ≤ 2.2 s (a bell tail)`, () => {
      expect(n.startsWith('e_dawn')).toBe(true);
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
      expect(v.end, n).toBeLessThanOrEqual(2.2);
    });
  }
});
