// A5-A step A-1 — the spell / trap sound recipes (docs/v3/A5_PLAN.md §4.6, §6.5; REHBER SE-2, SE-3, SE-7).
// Vitest runs in Node (no WebAudio): every recipe is played through the REAL synth Voice on a recording
// fake BaseAudioContext that rejects what a browser rejects (non-finite values or times, an exponential
// ramp to 0, a stop before its start). The rendered levels (peak ≤ −1 dBFS through the v3 chain) are
// checked on real WebAudio in the dev page: ?dev=a5fx&page=sound&look=v3&log=1 (OfflineAudioContext).

import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('../presentation/_phaser-stub')).phaserStub());

import { V3_SPELL_RECIPES, V3_SPELL_SUSTAINED, type V3SpellSfxName } from '../../src/audio/v3/spells';
import { Voice } from '../../src/audio/synth';
import type { Recipe } from '../../src/audio/sounds';

// ---------------------------------------------------------------- a recording fake context

type Ev = readonly [op: string, v: number, t: number];

class FakeParam {
  value = 0;
  readonly events: Ev[] = [];
  private ok(v: number, t: number, op: string): void {
    if (!Number.isFinite(v)) throw new Error(`${op}: non-finite value ${v}`);
    if (!Number.isFinite(t) || t < 0) throw new Error(`${op}: bad time ${t}`);
    this.events.push([op, v, t]);
  }
  setValueAtTime(v: number, t: number): this {
    this.ok(v, t, 'set');
    return this;
  }
  linearRampToValueAtTime(v: number, t: number): this {
    this.ok(v, t, 'lin');
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number): this {
    if (v === 0) throw new RangeError('exponential ramp to 0');
    this.ok(v, t, 'exp');
    return this;
  }
  setTargetAtTime(v: number, t: number, c: number): this {
    if (!(c > 0) || !Number.isFinite(c)) throw new Error(`setTarget: bad constant ${c}`);
    this.ok(v, t, 'target');
    return this;
  }
  setValueCurveAtTime(curve: ArrayLike<number>, t: number, d: number): this {
    for (let i = 0; i < curve.length; i++) this.ok(curve[i], t, 'curve');
    if (!(d > 0)) throw new Error(`curve: bad duration ${d}`);
    return this;
  }
  cancelScheduledValues(): this {
    return this;
  }
}

class FakeNode {
  readonly outs: unknown[] = [];
  connect<T>(to: T): T {
    if (!to) throw new Error('connect to nothing');
    this.outs.push(to);
    return to;
  }
  disconnect(): void {}
}

interface Log {
  params: FakeParam[];
  sources: { start: number; stop: number }[];
  oscs: number;
  noises: number;
}

function fakeCtx(log: Log): BaseAudioContext {
  const P = () => {
    const p = new FakeParam();
    log.params.push(p);
    return p;
  };
  const src = <T extends object>(extra: T, kind: 'osc' | 'noise') => {
    const rec = { start: NaN, stop: NaN };
    log.sources.push(rec);
    if (kind === 'osc') log.oscs++;
    else log.noises++;
    return Object.assign(new FakeNode(), extra, {
      start(t = 0) {
        if (!Number.isFinite(t) || t < 0) throw new Error(`start at ${t}`);
        rec.start = t;
      },
      stop(t = 0) {
        if (!Number.isFinite(t)) throw new Error(`stop at ${t}`);
        if (Number.isFinite(rec.start) && t < rec.start) throw new Error(`stop ${t} before start ${rec.start}`);
        rec.stop = t;
      },
    });
  };
  const ctx = {
    sampleRate: 8000,
    currentTime: 0,
    destination: new FakeNode(),
    createGain: () => Object.assign(new FakeNode(), { gain: P() }),
    createOscillator: () => src({ frequency: P(), detune: P(), type: 'sine', setPeriodicWave() {} }, 'osc'),
    createBufferSource: () => src({ buffer: null, loop: false, playbackRate: P(), detune: P() }, 'noise'),
    createBiquadFilter: () => Object.assign(new FakeNode(), { type: 'lowpass', frequency: P(), Q: P(), gain: P(), detune: P() }),
    createWaveShaper: () => Object.assign(new FakeNode(), { curve: null, oversample: 'none' }),
    createStereoPanner: () => Object.assign(new FakeNode(), { pan: P() }),
    createDelay: () => Object.assign(new FakeNode(), { delayTime: P() }),
    createPeriodicWave: () => ({}),
    createBuffer: (ch: number, len: number, sr: number) => ({ numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr, getChannelData: () => new Float32Array(len) }),
  };
  return ctx as unknown as BaseAudioContext;
}

// synth.ts link() asks `to instanceof AudioParam`
(globalThis as { AudioParam?: unknown }).AudioParam = FakeParam;

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function playOnce(r: Recipe, pm = 1, seed = 7): { log: Log; voice: Voice } {
  const log: Log = { params: [], sources: [], oscs: 0, noises: 0 };
  const ctx = fakeCtx(log);
  const voice = new Voice(ctx, ctx.destination, 0.5, pm, seeded(seed));
  r.play(voice);
  return { log, voice };
}

const NAMES = Object.keys(V3_SPELL_RECIPES) as V3SpellSfxName[];
const R = V3_SPELL_RECIPES as Record<V3SpellSfxName, Recipe>;

/** The §4.6 table's duck column ('—' = none). */
const DUCK: Partial<Record<V3SpellSfxName, number>> = {
  springRise: 0.3,
  recallOpen: 0.3,
  bladeForge: 0.2,
  bladeBond: 0.45,
  bladeBreak: 0.3,
  volcanoSlam: 0.3,
  volcanoErupt: 0.6,
  volcanoCool: 0.3,
  mirrorCatch: 0.45,
  mirrorBeam: 0.3,
  mirrorBreak: 0.4,
  chasmOpen: 0.6,
  chasmShut: 0.5,
};

describe('A5 spell / trap sounds (§4.6)', () => {
  it('23 recipes, all written (none of the A56.0 silent skeletons left)', () => {
    expect(NAMES.length).toBe(23);
    for (const n of NAMES) {
      const { log } = playOnce(R[n]);
      expect(log.sources.length, n).toBeGreaterThan(0);
      expect(log.params.some((p) => p.events.some(([, v]) => v > 0.01)), `${n} has an audible level`).toBe(true);
    }
  });

  it('every recipe schedules only finite values / times, no exponential ramp to 0, no stop before start', () => {
    for (const n of NAMES)
      for (const pm of [1, 0.8, 1.5]) {
        expect(() => playOnce(R[n], pm), `${n} @ pitch ${pm}`).not.toThrow();
        const { log } = playOnce(R[n], pm);
        for (const s of log.sources) {
          expect(Number.isFinite(s.start), n).toBe(true);
          expect(s.stop, n).toBeGreaterThan(s.start);
        }
      }
  });

  it('lengths: one-shots are short (≤ 1.6 s), the sustained lavaCreep outlasts the lava front (≥ 2 s, SE-2)', () => {
    for (const n of NAMES) {
      const { voice } = playOnce(R[n]);
      if ((V3_SPELL_SUSTAINED as readonly string[]).includes(n)) {
        expect(voice.end, n).toBeGreaterThanOrEqual(2);
        expect(voice.end, n).toBeLessThanOrEqual(3);
      } else {
        expect(voice.end, n).toBeGreaterThan(0.04);
        expect(voice.end, n).toBeLessThanOrEqual(1.6);
      }
    }
  });

  it('the sustained list is exactly lavaCreep', () => {
    expect([...V3_SPELL_SUSTAINED]).toEqual(['lavaCreep']);
  });

  it('music ducking as the §4.6 table (SE-7: the big beats ≥ 0.55, the small ones ≤ 0.3)', () => {
    for (const n of NAMES) expect(R[n].duck, n).toBe(DUCK[n]);
    expect(R.volcanoErupt.duck).toBeGreaterThanOrEqual(0.55);
    expect(R.chasmOpen.duck).toBeGreaterThanOrEqual(0.55);
    for (const n of ['springRise', 'recallOpen', 'bladeForge', 'bladeBreak', 'volcanoSlam', 'volcanoCool', 'mirrorBeam'] as const) expect(R[n].duck, n).toBeLessThanOrEqual(0.3);
  });

  it('the repeated per-beat sounds can overlap (drops ×6, beams ×n) and are rate-limited sanely', () => {
    expect(R.springDrop.cap ?? 4).toBeGreaterThanOrEqual(6);
    expect(R.mirrorBeam.cap ?? 4).toBeGreaterThanOrEqual(3);
    for (const n of NAMES) {
      expect(R[n].cap ?? 4, n).toBeGreaterThanOrEqual(1);
      expect(R[n].gap ?? 0.02, n).toBeLessThanOrEqual(0.2);
    }
  });

  it('deterministic for a seeded voice (the same events twice)', () => {
    for (const n of NAMES) {
      const a = playOnce(R[n], 1, 99).log.params.map((p) => p.events);
      const b = playOnce(R[n], 1, 99).log.params.map((p) => p.events);
      expect(a, n).toEqual(b);
    }
  });
});
