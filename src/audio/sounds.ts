// Every SfxName as a synthesis recipe. Levels are pre-chain linear amplitudes; the master chain
// (glue comp → limiter → soft clip) sits behind them. Big moments are layered: transient +
// body + sub + texture + air, then a reverb send. UI sounds are short, soft and nearly dry.
//
// Use ?dev=audio to see every recipe rendered offline (waveform + RMS + spectrogram).

import type { SfxName } from './sfx';
import { ahr, midiHz, perc, swell, type Pt, type Voice } from './synth';

export interface Recipe {
  /** Reverb send 0..1. */
  verb?: number;
  /** Max simultaneous voices of this sound (oldest is faded out). Default 4. */
  cap?: number;
  /** Min seconds between two triggers (rate limit). Default 0.02. */
  gap?: number;
  /** Duck the music by this much (0..1) for a moment. */
  duck?: number;
  /** Random pitch spread for live plays (fraction, e.g. 0.05 = ±5 %). */
  vary?: number;
  play(v: Voice): void;
}

/** Scale an envelope's values. */
function k(pts: readonly Pt[], s: number): Pt[] {
  return pts.map(([t, val, c]) => [t, val * s, c] as Pt);
}

/** Brass-ish note: two detuned saws through a lowpass with a quick "blat" opening. */
function brass(v: Voice, m: number, t: number, d: number, g: number, o: { bright?: number; to?: AudioNode } = {}): void {
  const top = o.bright ?? 3800;
  const lp = v.filt('lowpass', [[0, 450], [0.035, top, 'e'], [Math.max(0.05, d), top * 0.45, 'e']], 1.4, { t, to: o.to });
  for (const det of [-7, 7]) {
    v.tone('sawtooth', midiHz(m), { t, g: [[0, 0], [0.018, g], [Math.max(0.03, d * 0.85), g * 0.75], [d + 0.18, 0.0001, 'e']], to: lp, detune: det });
  }
}

/** A short inharmonic metal ping (2–3 partials). */
function clink(v: Voice, f: number, t: number, g: number, dec: number, to?: AudioNode): void {
  for (const [r, a] of [
    [1, 1],
    [2.31, 0.55],
  ] as const) {
    v.tone('sine', f * r, { t, g: perc(g * a, dec * (1.1 - r * 0.15), 0.0005), to });
  }
}

/** Heavy hit core shared by impactHeavy / directHit / summonBurst: crack + sub kick + blast. */
function bigHit(v: Voice, t: number, s: number, o: { sub?: number; blast?: number } = {}): void {
  v.noise('white', { t, g: perc(0.5 * s, 0.02, 0.0003), to: v.filt('highpass', 1800) });
  v.tone('sine', [[0, o.sub ?? 140], [0.25, 36, 'e']], { t, g: perc(0.75 * s, 0.55, 0.001), to: v.drive(2.5, { trim: 0.75 }) });
  v.tone('triangle', [[0, 320], [0.08, 90, 'e']], { t, g: perc(0.28 * s, 0.12, 0.001) });
  v.noise('white', { t, g: perc((o.blast ?? 0.5) * s, 0.45, 0.002), to: v.filt('lowpass', [[0, 7000], [0.5, 300, 'e']], 0.9) });
}

export const RECIPES: Record<SfxName, Recipe> = {
  // ================================================================== UI
  uiHover: {
    cap: 2,
    gap: 0.04,
    verb: 0.05,
    vary: 0.03,
    play(v) {
      v.tone('sine', [[0, 1900], [0.035, 2350, 'e']], { g: perc(0.11, 0.05, 0.003) });
      v.tone('triangle', 3800, { g: perc(0.025, 0.03, 0.002) });
    },
  },
  uiClick: {
    cap: 3,
    gap: 0.03,
    verb: 0.06,
    play(v) {
      v.tone('p25', [[0, 1400], [0.035, 900, 'e']], { g: perc(0.12, 0.05, 0.001), to: v.filt('lowpass', 5000) });
      v.tone('sine', [[0, 720], [0.045, 480, 'e']], { g: perc(0.2, 0.06) });
      v.noise('white', { g: perc(0.12, 0.008, 0.0005), to: v.filt('highpass', 4000) });
    },
  },
  uiBack: {
    cap: 2,
    gap: 0.04,
    verb: 0.08,
    play(v) {
      const lp = v.filt('lowpass', 3500);
      v.tone('p25', 988, { g: perc(0.1, 0.06), to: lp });
      v.tone('p25', 659, { t: 0.065, g: perc(0.1, 0.1), to: lp });
      v.tone('sine', 494, { t: 0.065, g: perc(0.13, 0.12) });
    },
  },
  uiError: {
    cap: 1,
    gap: 0.15,
    verb: 0.05,
    play(v) {
      const lp = v.filt('lowpass', 900, 0.8);
      for (const t of [0, 0.12]) {
        v.tone('square', 150, { t, g: ahr(0.035, 0.004, 0.06, 0.03), to: lp });
        v.tone('square', 159, { t, g: ahr(0.028, 0.004, 0.06, 0.03), to: lp });
        v.tone('triangle', 300, { t, g: ahr(0.05, 0.004, 0.05, 0.03) });
      }
    },
  },
  uiConfirm: {
    cap: 2,
    gap: 0.05,
    verb: 0.2,
    play(v) {
      const lp = v.filt('lowpass', 6000);
      [1047, 1319, 1568].forEach((f, i) => v.tone('p25', f, { t: i * 0.045, g: perc(0.08, 0.12), to: lp }));
      v.bell(2093, { t: 0.09, g: 0.07, dec: 0.45, ratio: 2, index: 1 });
      v.tone('sine', [[0, 523], [0.05, 600, 'e']], { g: perc(0.14, 0.12) });
    },
  },

  // ================================================================== cards
  cardDraw: {
    cap: 4,
    gap: 0.03,
    verb: 0.08,
    vary: 0.06,
    play(v) {
      v.noise('white', { g: [[0, 0], [0.06, 0.3], [0.16, 0.0001, 'e']], to: v.filt('bandpass', [[0, 1200], [0.14, 5200, 'e']], 1.4) });
      v.noise('white', { t: 0.13, g: perc(0.25, 0.015, 0.0005), to: v.filt('bandpass', 3500, 2) });
      v.tone('sine', [[0, 900], [0.02, 1500, 'e']], { t: 0.13, g: perc(0.07, 0.04) });
    },
  },
  cardSlide: {
    cap: 4,
    gap: 0.03,
    verb: 0.1,
    vary: 0.05,
    play(v) {
      v.noise('pink', { g: [[0, 0], [0.08, 0.38], [0.32, 0.0001, 'e']], to: v.filt('bandpass', [[0, 700], [0.18, 2200, 'e'], [0.3, 1400, 'e']], 0.9) });
      v.noise('white', { g: [[0, 0], [0.1, 0.06], [0.3, 0.0001, 'e']], to: v.filt('highpass', 6000) });
    },
  },
  cardPlace: {
    cap: 4,
    gap: 0.03,
    verb: 0.12,
    vary: 0.05,
    play(v) {
      v.tone('sine', [[0, 190], [0.07, 80, 'e']], { g: perc(0.45, 0.09, 0.001) });
      v.noise('white', { g: perc(0.22, 0.03, 0.0005), to: v.filt('lowpass', 2500) });
      v.noise('white', { g: perc(0.08, 0.01, 0.0005), to: v.filt('highpass', 5000) });
    },
  },
  cardSlam: {
    cap: 3,
    gap: 0.04,
    verb: 0.35,
    duck: 0.3,
    vary: 0.03,
    play(v) {
      v.tone('sine', [[0, 160], [0.18, 42, 'e']], { g: perc(0.75, 0.32, 0.001), to: v.drive(1.5) });
      v.noise('white', { g: perc(0.45, 0.02, 0.0003), to: v.filt('highpass', 2500) });
      v.noise('white', { g: perc(0.4, 0.2, 0.001), to: v.filt('lowpass', [[0, 4000], [0.25, 250, 'e']], 0.8) });
      for (const [f, g] of [
        [1210, 0.05],
        [1745, 0.04],
        [2630, 0.03],
      ] as const)
        v.tone('sine', f, { g: perc(g, 0.35, 0.001) });
      v.noise('brown', { t: 0.02, g: perc(0.25, 0.4, 0.02), to: v.filt('lowpass', 600) });
    },
  },
  cardFlip: {
    cap: 4,
    gap: 0.03,
    verb: 0.1,
    vary: 0.05,
    play(v) {
      for (const [t, f0, f1] of [
        [0, 1500, 4000],
        [0.07, 2000, 5500],
      ] as const) {
        v.noise('white', { t, g: [[0, 0], [0.02, 0.45], [0.06, 0.0001, 'e']], to: v.filt('bandpass', [[0, f0], [0.05, f1, 'e']], 2, { t }) });
      }
      v.tone('triangle', [[0, 1800], [0.03, 2600, 'e']], { t: 0.12, g: perc(0.09, 0.05) });
      v.tone('sine', [[0, 260], [0.04, 160, 'e']], { t: 0.1, g: perc(0.18, 0.05) });
    },
  },
  cardSet: {
    cap: 3,
    gap: 0.04,
    verb: 0.2,
    play(v) {
      v.tone('sine', [[0, 130], [0.1, 70, 'e']], { g: perc(0.3, 0.14, 0.003) });
      v.noise('pink', { g: perc(0.12, 0.05, 0.001), to: v.filt('lowpass', 1500) });
      const lp = v.filt('lowpass', [[0, 300], [0.08, 1400, 'e'], [0.3, 400, 'e']], 4, { t: 0.02 });
      v.tone('p25', [[0, 220], [0.06, 330, 'e']], { t: 0.02, g: perc(0.12, 0.25, 0.01), to: lp });
    },
  },
  shuffle: {
    cap: 1,
    gap: 0.3,
    verb: 0.1,
    play(v) {
      const n = 28;
      const times: number[] = [];
      const gains: number[] = [];
      for (let i = 0; i < n; i++) {
        const q = i / (n - 1);
        times.push(0.04 + 0.56 * Math.pow(q, 0.8) + v.r(-0.005, 0.005));
        gains.push(0.24 * (0.55 + 0.45 * Math.sin(q * Math.PI)) * v.r(0.6, 1));
      }
      v.bursts(times, gains, { dec: 0.012, f: 3200, q: 1.1 });
      v.noise('pink', { g: [[0, 0], [0.3, 0.08], [0.62, 0.0001, 'e']], to: v.filt('bandpass', 1800, 0.7) });
      for (const [t, f] of [
        [0.66, 180],
        [0.77, 200],
      ] as const) {
        v.tone('sine', [[0, f], [0.06, f / 2, 'e']], { t, g: perc(0.32, 0.08) });
        v.noise('white', { t, g: perc(0.16, 0.02), to: v.filt('lowpass', 3000) });
      }
    },
  },

  // ================================================================== flow
  turnStart: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.4,
    play(v) {
      v.noise('pink', { g: [[0, 0], [0.2, 0.32], [0.42, 0.0001, 'e']], to: v.filt('bandpass', [[0, 500], [0.25, 3000, 'e'], [0.4, 1200, 'e']], 1.2) });
      const T = 0.22;
      const lp = v.filt('lowpass', [[0, 1200], [0.04, 5000, 'e'], [0.6, 1500, 'e']], 1, { t: T });
      for (const m of [64, 71, 76]) {
        v.tone('p25', midiHz(m), { t: T, g: perc(0.08, 0.7, 0.004), to: lp });
        v.tone('sawtooth', midiHz(m), { t: T, g: perc(0.045, 0.5, 0.004), to: lp, detune: 8 });
      }
      v.tone('sine', [[0, 120], [0.2, 50, 'e']], { t: T, g: perc(0.5, 0.35, 0.002) });
      v.noise('white', { t: T, g: perc(0.2, 0.06), to: v.filt('lowpass', 3000) });
      v.bell(midiHz(88), { t: T + 0.04, g: 0.06, dec: 0.7, ratio: 2, index: 1.5 });
    },
  },
  phaseChange: {
    cap: 2,
    gap: 0.08,
    verb: 0.15,
    play(v) {
      v.noise('white', { g: perc(0.12, 0.015, 0.0005), to: v.filt('bandpass', 2500, 2) });
      const lp = v.filt('lowpass', 4000);
      v.tone('triangle', 660, { t: 0.02, g: perc(0.22, 0.08), to: lp });
      v.tone('p25', 990, { t: 0.09, g: perc(0.08, 0.12), to: lp });
      v.tone('sine', 1980, { t: 0.09, g: perc(0.05, 0.15) });
    },
  },
  yourMove: {
    cap: 1,
    gap: 0.3,
    verb: 0.3,
    play(v) {
      v.bell(midiHz(88), { g: 0.15, dec: 0.6, ratio: 2, index: 1.2 });
      v.bell(midiHz(95), { t: 0.13, g: 0.15, dec: 0.9, ratio: 2, index: 1.2 });
      v.tone('sine', midiHz(76), { g: perc(0.08, 0.3) });
    },
  },
  passDevice: {
    cap: 1,
    gap: 0.3,
    verb: 0.45,
    play(v) {
      v.noise('pink', { g: [[0, 0], [0.25, 0.22], [0.9, 0.0001, 'e']], to: v.filt('lowpass', [[0, 3500], [0.9, 300, 'e']], 0.8) });
      [69, 72, 76, 79].forEach((m, i) =>
        v.tone('triangle', midiHz(m), { t: i * 0.05, g: [[0, 0], [0.3, 0.05], [1.0, 0.0001, 'e']], detune: v.r(-6, 6) }),
      );
      v.bell(midiHz(84), { t: 0.35, g: 0.05, dec: 0.8, ratio: 3, index: 0.8 });
    },
  },

  // ================================================================== summoning
  summonCharge: {
    cap: 2,
    gap: 0.1,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      const D = 0.9;
      const lp = v.filt('lowpass', [[0, 300], [D, 5000, 'e']], [[0, 6], [D, 10]]);
      const am = v.ring([[0, 4], [D, 28, 'e']], { d: D + 0.1, mix: 0.6, to: lp });
      const env: Pt[] = [[0, 0], [D - 0.05, 0.2], [D + 0.05, 0.0001, 'e']];
      v.tone('sawtooth', [[0, 110], [D, 880, 'e']], { g: env, to: am });
      v.tone('sawtooth', [[0, 111], [D, 885, 'e']], { g: env, to: am, detune: 12 });
      v.tone('sine', [[0, 55], [D, 110, 'e']], { g: [[0, 0], [D - 0.1, 0.3], [D + 0.05, 0.0001, 'e']] });
      v.noise('white', { g: [[0, 0.0001], [D, 0.22, 'e'], [D + 0.05, 0.0001, 'e']], to: v.filt('bandpass', [[0, 800], [D, 7000, 'e']], 1.5) });
      const notes = [48, 55, 60, 64, 67, 72, 76, 79, 84, 88, 91, 96];
      const lp2 = v.filt('lowpass', 6000);
      notes.forEach((m, i) => v.tone('p12', midiHz(m), { t: i * 0.07, g: perc(0.03 + i * 0.004, 0.08), to: lp2 }));
    },
  },
  summonBurst: {
    cap: 2,
    gap: 0.08,
    verb: 0.5,
    duck: 0.6,
    play(v) {
      v.noise('white', { g: perc(0.55, 0.03, 0.0003), to: v.filt('highpass', 1500) });
      v.tone('sine', [[0, 120], [0.5, 32, 'e']], { g: perc(0.7, 0.9, 0.002), to: v.drive(1.8) });
      v.noise('white', { g: perc(0.38, 0.9, 0.003), to: v.filt('lowpass', [[0, 9000], [1.0, 200, 'e']], 0.7) });
      const lp = v.filt('lowpass', [[0, 7000], [1.2, 1200, 'e']]);
      for (const m of [60, 67, 72, 76, 79, 86]) v.tone('sawtooth', midiHz(m), { g: perc(0.04, 1.2, 0.01), to: lp, detune: v.r(-10, 10) });
      const gl = [0, 4, 7, 12, 16, 19, 24, 19];
      gl.forEach((n, i) => v.bell(midiHz(84 + n), { t: 0.05 + i * 0.07, g: 0.04, dec: 0.5, ratio: 3.01, index: 1 }));
    },
  },
  materialize: {
    cap: 2,
    gap: 0.08,
    verb: 0.35,
    play(v) {
      const bp = v.filt('bandpass', [[0, 600], [0.8, 2400, 'e']], 3);
      const am = v.ring(30, { d: 0.9, mix: 0.7, to: bp });
      v.tone('square', [[0, 60], [0.8, 120, 'e']], { g: [[0, 0], [0.1, 0.16], [0.7, 0.12], [0.9, 0.0001, 'e']], to: am });
      const lp = v.filt('lowpass', 7000);
      [72, 76, 79, 84, 88, 91, 96, 100].forEach((m, i) => v.tone('p12', midiHz(m), { t: i * 0.06, g: perc(0.06, 0.07), to: lp }));
      [84, 88, 91, 96].forEach((m, i) => v.bell(midiHz(m), { t: 0.5 + i * 0.02, g: 0.05, dec: 0.8, ratio: 2, index: 0.8 }));
      v.tone('sine', [[0, 80], [0.3, 160, 'e']], { t: 0.45, g: perc(0.3, 0.4, 0.05) });
    },
  },
  tribute: {
    cap: 2,
    gap: 0.1,
    verb: 0.55,
    play(v) {
      const out = v.amp(1);
      const split = v.amp(1, { to: v.filt('bandpass', 800, 5, { to: out }) });
      split.connect(v.filt('bandpass', 1150, 6, { to: out }));
      split.connect(v.filt('bandpass', 2900, 8, { to: out }));
      for (const m of [57, 64, 69, 73])
        v.tone('sawtooth', [[0, midiHz(m)], [1.1, midiHz(m + 5), 'e']], { g: [[0, 0], [0.4, 0.2], [1.1, 0.0001, 'e']], to: split, detune: v.r(-8, 8) });
      const s = v.tone('sine', [[0, 500], [0.9, 1600, 'e']], { g: [[0, 0], [0.15, 0.1], [0.8, 0.07], [1.0, 0.0001, 'e']] });
      v.lfo(s.osc.detune, 6, 30, { d: 1.0 });
      v.noise('pink', { g: swell(0.2, 0.9, 0.08), to: v.filt('bandpass', [[0, 500], [0.9, 4000, 'e']], 1) });
    },
  },
  cutIn: {
    cap: 1,
    gap: 0.3,
    verb: 0.5,
    duck: 0.7,
    play(v) {
      v.noise('white', { g: [[0, 0.0001], [0.15, 0.4, 'e'], [0.17, 0.0001, 'e']], to: v.filt('bandpass', [[0, 1000], [0.16, 7000, 'e']], 1.5) });
      const T = 0.16;
      for (const [r, g, d] of [
        [1, 0.08, 1.0],
        [1.47, 0.06, 0.8],
        [2.09, 0.045, 0.6],
        [2.76, 0.035, 0.5],
        [3.6, 0.025, 0.35],
      ] as const)
        v.tone('sine', 2200 * r, { t: T, g: perc(g, d, 0.001) });
      v.tone('sine', [[0, 2600], [0.4, 3400, 'e']], { t: T, g: perc(0.05, 0.5) });
      v.tone('sine', [[0, 140], [0.35, 38, 'e']], { t: T, g: perc(0.8, 0.6, 0.002), to: v.drive(2) });
      v.noise('white', { t: T, g: perc(0.35, 0.25), to: v.filt('lowpass', [[0, 6000], [0.3, 400, 'e']]) });
      const lp = v.filt('lowpass', [[0, 400], [0.05, 3200, 'e'], [0.9, 700, 'e']], 2, { t: T });
      for (const m of [45, 52, 57, 61, 64])
        v.tone('sawtooth', midiHz(m), { t: T, g: [[0, 0], [0.02, 0.07], [0.3, 0.05], [1.1, 0.0001, 'e']], to: lp, detune: v.r(-9, 9) });
    },
  },
  roarBig: {
    cap: 2,
    gap: 0.15,
    verb: 0.5,
    duck: 0.65,
    vary: 0.04,
    play(v) {
      const D = 1.7;
      // "RAAAAH": quick swell, a held peak, long falling tail
      const ampEnv: Pt[] = [[0, 0], [0.06, 0.55], [0.3, 0.8], [0.9, 0.55], [D, 0.0001, 'e']];
      // breath flutter: the whole growl rides an irregular amplitude wobble
      const breath = v.amp(0.8);
      v.wander(breath.gain, 18, 0.35, { d: D });
      // mouth: three formants that open (vowel "aa") then close, summed into a throat
      // saturator (dense, gritty, low crest factor)
      const sum = v.amp(1.6, { to: v.drive(2.5, { to: breath, trim: 0.75 }) });
      const bank = v.amp(1, { to: v.filt('bandpass', [[0, 360], [0.25, 760, 'e'], [1.0, 620, 'e'], [D, 360, 'e']], 3, { to: sum }) });
      bank.connect(v.filt('bandpass', [[0, 900], [0.25, 1300, 'e'], [D, 780, 'e']], 4, { to: sum }));
      bank.connect(v.filt('bandpass', [[0, 2300], [0.3, 2800, 'e'], [D, 2200, 'e']], 5, { to: sum }));
      const grit = v.drive(5, { to: bank, trim: 0.9 });
      // vocal folds: detuned saws with a wide pitch arc and chaotic jitter
      for (const [mul, det, g] of [
        [1, 0, 0.5],
        [1, 17, 0.42],
        [1.01, -23, 0.3],
        [0.5, -6, 0.16],
        [1.5, 5, 0.16],
      ] as const) {
        const f: Pt[] = [[0, 64 * mul], [0.18, 128 * mul, 'e'], [0.55, 112 * mul, 'e'], [1.1, 84 * mul, 'e'], [D, 50 * mul, 'e']];
        const o = v.tone('sawtooth', f, { g: k(ampEnv, g), to: grit, detune: det });
        v.wander(o.osc.detune, 22, 90, { d: D });
        v.lfo(o.osc.detune, 31 + det * 0.3, 22, { d: D, w: 'triangle' });
      }
      // throat rasp: noise, ring-modulated by a jittery ~40 Hz flutter
      const raspBp = v.filt('bandpass', [[0, 800], [0.3, 1500, 'e'], [D, 700, 'e']], 1.2, { to: breath });
      const rasp = v.flutter(40, 0.45, { d: D, base: 0.55, to: raspBp });
      v.noise('white', { g: k(ampEnv, 0.55), to: rasp });
      // chest: modest sub (felt, not heard — keeps headroom for the growl)
      v.tone('sine', [[0, 55], [0.2, 62, 'e'], [D, 38, 'e']], { g: [[0, 0], [0.06, 0.2], [0.6, 0.14], [D, 0.0001, 'e']] });
      // dragon screech riding on top
      const sc = v.tone('sawtooth', [[0, 700], [0.2, 1250, 'e'], [0.9, 950, 'e'], [D, 520, 'e']], {
        g: [[0, 0], [0.14, 0.1], [0.8, 0.075], [D, 0.0001, 'e']],
        to: v.filt('bandpass', 1700, 2, { to: breath }),
      });
      v.wander(sc.osc.detune, 14, 120, { d: D });
      v.lfo(sc.osc.detune, 9, 50, { d: D });
    },
  },
  roarSmall: {
    cap: 3,
    gap: 0.1,
    verb: 0.35,
    duck: 0.3,
    vary: 0.06,
    play(v) {
      const D = 0.75;
      const ampEnv: Pt[] = [[0, 0], [0.04, 0.6], [0.2, 0.7], [D, 0.0001, 'e']];
      const breath = v.amp(0.85);
      v.wander(breath.gain, 22, 0.3, { d: D });
      const sum = v.amp(1.5, { to: v.drive(2.2, { to: breath, trim: 0.75 }) });
      const bank = v.amp(1, { to: v.filt('bandpass', [[0, 600], [0.15, 1050, 'e'], [D, 650, 'e']], 3, { to: sum }) });
      bank.connect(v.filt('bandpass', [[0, 1400], [0.15, 1950, 'e'], [D, 1300, 'e']], 4, { to: sum }));
      bank.connect(v.filt('bandpass', 3100, 5, { to: sum }));
      const grit = v.drive(4, { to: bank, trim: 0.65 });
      for (const [mul, det, g] of [
        [1, 0, 0.5],
        [1, 16, 0.4],
        [2, -5, 0.14],
      ] as const) {
        const f: Pt[] = [[0, 140 * mul], [0.08, 240 * mul, 'e'], [0.35, 205 * mul, 'e'], [D, 120 * mul, 'e']];
        const o = v.tone('sawtooth', f, { g: k(ampEnv, g), to: grit, detune: det });
        v.wander(o.osc.detune, 28, 80, { d: D });
        v.lfo(o.osc.detune, 37, 22, { d: D, w: 'triangle' });
      }
      const rasp = v.flutter(55, 0.45, { d: D, base: 0.55, to: v.filt('bandpass', 1800, 1.2, { to: breath }) });
      v.noise('white', { g: k(ampEnv, 0.4), to: rasp });
      v.tone('sine', [[0, 110], [D, 70, 'e']], { g: [[0, 0], [0.03, 0.2], [D, 0.0001, 'e']] });
    },
  },
  flipReveal: {
    cap: 2,
    gap: 0.08,
    verb: 0.35,
    duck: 0.3,
    play(v) {
      v.noise('white', { g: [[0, 0], [0.03, 0.3], [0.09, 0.0001, 'e']], to: v.filt('bandpass', [[0, 1500], [0.08, 6000, 'e']], 2) });
      const T = 0.08;
      const lp = v.filt('lowpass', [[0, 800], [0.15, 6000, 'e'], [0.7, 1500, 'e']], 3, { t: T });
      for (const m of [62, 69, 74, 78, 81]) v.tone('p25', [[0, midiHz(m - 12)], [0.12, midiHz(m), 'e']], { t: T, g: perc(0.05, 0.55, 0.01), to: lp });
      v.tone('sine', [[0, 150], [0.2, 55, 'e']], { t: T, g: perc(0.45, 0.3) });
      v.noise('white', { t: T, g: perc(0.18, 0.05), to: v.filt('lowpass', 4000) });
      v.bell(midiHz(93), { t: T + 0.04, g: 0.05, dec: 0.5, ratio: 2, index: 1 });
    },
  },

  // ================================================================== combat
  attackDeclare: {
    cap: 2,
    gap: 0.1,
    verb: 0.4,
    duck: 0.5,
    play(v) {
      // riser lands with the lock-on reticle snapping shut (vfx lockOn: 230 ms)
      v.noise('white', { g: [[0, 0.0001], [0.21, 0.25, 'e'], [0.23, 0.0001, 'e']], to: v.filt('bandpass', [[0, 2000], [0.22, 6000, 'e']], 6) });
      const T = 0.22;
      const lp = v.filt('lowpass', [[0, 500], [0.03, 3000, 'e'], [0.7, 600, 'e']], 1.5, { t: T });
      for (const m of [50, 53, 57, 62])
        v.tone('sawtooth', midiHz(m), { t: T, g: [[0, 0], [0.015, 0.085], [0.25, 0.06], [0.75, 0.0001, 'e']], to: lp, detune: v.r(-10, 10) });
      v.tone('sine', [[0, 110], [0.4, 82, 'e']], { t: T, g: perc(0.6, 0.6, 0.002) });
      v.noise('brown', { t: T, g: perc(0.3, 0.2), to: v.filt('lowpass', 900) });
      v.noise('white', { t: T, g: perc(0.22, 0.015), to: v.filt('highpass', 3000) });
    },
  },
  whoosh: {
    cap: 4,
    gap: 0.03,
    verb: 0.15,
    vary: 0.08,
    play(v) {
      const sp = v.panner([[0, -0.35], [0.36, 0.35]]);
      const bp = v.filt('bandpass', [[0, 350], [0.16, 2600, 'e'], [0.36, 700, 'e']], [[0, 1.5], [0.16, 3], [0.36, 1.2]], { to: sp });
      v.noise('white', { g: [[0, 0], [0.12, 0.85], [0.38, 0.0001, 'e']], to: bp });
      v.noise('brown', { g: [[0, 0], [0.14, 0.4], [0.36, 0.0001, 'e']], to: v.filt('lowpass', 500, 0.707, { to: sp }) });
    },
  },
  beamCharge: {
    cap: 2,
    gap: 0.1,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      const D = 0.55;
      const lp = v.filt('lowpass', [[0, 1000], [D, 7000, 'e']], 2);
      const am = v.ring([[0, 8], [D, 40, 'e']], { d: D + 0.07, mix: 0.5, to: lp });
      for (const [f0, f1, w] of [
        [220, 1760, 'sawtooth'],
        [330, 2640, 'p25'],
        [110, 880, 'square'],
      ] as const)
        v.tone(w, [[0, f0], [D, f1, 'e']], { g: [[0, 0], [D - 0.05, 0.085], [D + 0.05, 0.0001, 'e']], to: am });
      v.tone('sine', [[0, 40], [D, 90, 'e']], { g: [[0, 0], [D - 0.05, 0.35], [D + 0.05, 0.0001, 'e']] });
      v.crackle({ d: D, n: 22, g: 0.25, f: 5000, q: 1.5, curve: 0.7 });
      v.noise('white', { g: swell(0.2, D, 0.05), to: v.filt('bandpass', [[0, 1500], [D, 8000, 'e']], 1) });
    },
  },
  beamFire: {
    cap: 2,
    gap: 0.08,
    verb: 0.4,
    duck: 0.6,
    play(v) {
      v.noise('white', { g: perc(0.5, 0.03, 0.0003), to: v.filt('highpass', 1200) });
      v.tone('sine', [[0, 180], [0.3, 45, 'e']], { g: perc(0.7, 0.45, 0.002), to: v.drive(2) });
      const body: Pt[] = [[0, 0], [0.02, 0.11], [0.45, 0.09], [0.9, 0.0001, 'e']];
      const lp = v.filt('lowpass', [[0, 9000], [0.9, 1200, 'e']], 1);
      const rm = v.ring([[0, 620], [0.9, 440, 'e']], { d: 0.92, mix: 0.4, to: lp });
      for (const [f, det] of [
        [110, 0],
        [110, 18],
        [220, -9],
        [440, 7],
        [55, 0],
      ] as const)
        v.tone('sawtooth', [[0, f * 1.3], [0.08, f, 'e']], { g: body, to: rm, detune: det });
      v.noise('white', { g: [[0, 0], [0.02, 0.28], [0.45, 0.2], [0.9, 0.0001, 'e']], to: v.filt('bandpass', [[0, 3000], [0.9, 1200, 'e']], 0.7) });
      [0, 4, 7, 12, 7, 4].forEach((n, i) => v.bell(midiHz(96 + n), { t: 0.04 + i * 0.06, g: 0.035, dec: 0.4, ratio: 2.01, index: 1.2 }));
    },
  },
  slash: {
    cap: 4,
    gap: 0.03,
    verb: 0.25,
    vary: 0.06,
    play(v) {
      v.noise('white', { g: [[0, 0], [0.05, 0.7], [0.12, 0.0001, 'e']], to: v.filt('bandpass', [[0, 1500], [0.1, 8000, 'e']], 1.4) });
      for (const [f, g, d] of [
        [3150, 0.1, 0.35],
        [4420, 0.07, 0.28],
        [5870, 0.055, 0.2],
        [7300, 0.03, 0.15],
      ] as const)
        v.tone('sine', f, { t: 0.05, g: perc(g, d, 0.001), detune: v.r(-20, 20) });
      v.noise('white', { t: 0.06, g: perc(0.3, 0.02, 0.0003), to: v.filt('highpass', 3000) });
    },
  },
  bite: {
    cap: 3,
    gap: 0.04,
    verb: 0.15,
    vary: 0.05,
    play(v) {
      for (const [t, g] of [
        [0, 1],
        [0.07, 0.8],
      ] as const) {
        v.tone('sine', [[0, 220], [0.05, 70, 'e']], { t, g: perc(0.5 * g, 0.07, 0.001) });
        v.noise('white', { t, g: perc(0.4 * g, 0.05, 0.0005), to: v.drive(6, { to: v.filt('bandpass', 1600, 1.2), trim: 0.5 }) });
      }
      v.noise('white', { t: 0.065, g: perc(0.3, 0.008, 0.0003), to: v.filt('highpass', 5000) });
      const am = v.ring(55, { d: 0.25, mix: 0.7, to: v.filt('bandpass', 700, 2) });
      v.tone('sawtooth', [[0, 160], [0.2, 110, 'e']], { t: 0.02, g: perc(0.14, 0.22, 0.01), to: am });
    },
  },
  impactLight: {
    cap: 4,
    gap: 0.03,
    verb: 0.2,
    duck: 0.25,
    vary: 0.05,
    play(v) {
      v.tone('sine', [[0, 180], [0.12, 60, 'e']], { g: perc(0.6, 0.16, 0.001) });
      v.noise('white', { g: perc(0.35, 0.06, 0.0005), to: v.filt('lowpass', [[0, 5000], [0.08, 1200, 'e']]) });
      v.noise('white', { g: perc(0.2, 0.012, 0.0003), to: v.filt('highpass', 3500) });
      v.noise('white', { g: perc(0.15, 0.04), to: v.drive(5, { to: v.filt('bandpass', 2400, 2), trim: 0.4 }) });
    },
  },
  impactHeavy: {
    cap: 3,
    gap: 0.04,
    verb: 0.45,
    duck: 0.6,
    vary: 0.03,
    play(v) {
      bigHit(v, 0, 1);
      v.noise('white', { g: perc(0.25, 0.12), to: v.drive(8, { to: v.filt('bandpass', 1800, 1.5), trim: 0.5 }) });
      v.crackle({ t: 0.05, d: 0.7, n: 16, g: 0.15, f: 2500, q: 1, curve: 1.8, dec: 0.02 });
      v.noise('brown', { t: 0.03, g: perc(0.3, 0.8, 0.03), to: v.filt('lowpass', 400) });
    },
  },
  shatter: {
    cap: 4,
    gap: 0.03,
    verb: 0.35,
    duck: 0.3,
    vary: 0.05,
    play(v) {
      v.tone('sine', [[0, 200], [0.1, 70, 'e']], { g: perc(0.35, 0.12) });
      v.noise('white', { g: perc(0.4, 0.08, 0.0005), to: v.filt('highpass', 2500) });
      v.noise('white', { g: perc(0.18, 0.35, 0.002), to: v.filt('bandpass', 6000, 0.8) });
      const pans = [v.panner(-0.55), v.panner(0), v.panner(0.55)];
      for (let i = 0; i < 20; i++) {
        const t = Math.pow(v.rnd(), 1.7) * 0.6;
        v.tone(v.rnd() < 0.5 ? 'sine' : 'triangle', v.r(2200, 7800), {
          t,
          g: perc(v.r(0.035, 0.09) * (1 - t), v.r(0.04, 0.22), 0.0005),
          to: pans[i % 3],
        });
      }
    },
  },
  shieldBlock: {
    cap: 2,
    gap: 0.06,
    verb: 0.45,
    duck: 0.4,
    play(v) {
      v.noise('white', { g: perc(0.4, 0.02, 0.0003), to: v.filt('bandpass', 3000, 1) });
      v.tone('sine', [[0, 260], [0.06, 140, 'e']], { g: perc(0.45, 0.1) });
      for (const [f, g, d] of [
        [523, 0.12, 0.9],
        [1267, 0.09, 0.7],
        [1980, 0.07, 0.55],
        [2840, 0.05, 0.4],
        [3910, 0.03, 0.3],
      ] as const)
        v.tone('sine', f, { g: perc(g, d, 0.001), detune: v.r(-5, 5) });
      v.bell(1046, { g: 0.06, dec: 0.8, ratio: 1.41, index: 2.5, idxDec: 0.2 });
      const am = v.ring(24, { d: 0.5, mix: 0.6, to: v.filt('bandpass', 900, 3) });
      v.tone('square', 220, { g: perc(0.1, 0.45, 0.01), to: am });
    },
  },
  directHit: {
    cap: 2,
    gap: 0.06,
    verb: 0.4,
    duck: 0.6,
    play(v) {
      // the blow lands on the duelist: a punchy body hit (less crack than a strike) ...
      bigHit(v, 0, 0.85, { sub: 120, blast: 0.3 });
      v.tone('triangle', [[0, 150], [0.12, 62, 'e']], { g: perc(0.3, 0.2, 0.002) });
      // ... the hologram suit sparks (ring-modulated zap) ...
      const rm = v.ring(1300, { d: 0.25, mix: 1, to: v.filt('highpass', 400) });
      v.tone('sawtooth', [[0, 2400], [0.18, 300, 'e']], { g: perc(0.16, 0.2, 0.001), to: rm });
      // ... and the retro "hurt" arpeggio tumbling down: reads as LP damage, not as an attack
      const lp = v.filt('lowpass', 3800);
      [83, 78, 74, 69, 64].forEach((m, i) => v.tone('p25', midiHz(m), { t: 0.04 + i * 0.036, g: ahr(0.16 * (1 - i * 0.1), 0.002, 0.026, 0.014), to: lp }));
      v.noise('brown', { t: 0.03, g: perc(0.3, 0.7, 0.03), to: v.filt('lowpass', 350) });
    },
  },

  // ================================================================== LP
  lpDown: {
    cap: 2,
    gap: 0.08,
    verb: 0.2,
    play(v) {
      const lp = v.filt('lowpass', [[0, 4000], [0.45, 600, 'e']]);
      v.tone('square', [[0, 660], [0.4, 110, 'e']], { g: [[0, 0], [0.01, 0.1], [0.45, 0.0001, 'e']], to: lp });
      v.tone('sawtooth', [[0, 670], [0.4, 112, 'e']], { g: [[0, 0], [0.01, 0.07], [0.45, 0.0001, 'e']], to: lp, detune: 15 });
      v.tone('sine', [[0, 140], [0.2, 50, 'e']], { g: perc(0.45, 0.25) });
      v.noise('white', { g: perc(0.25, 0.05), to: v.drive(5, { to: v.filt('bandpass', 1500, 1.5), trim: 0.5 }) });
    },
  },
  lpUp: {
    cap: 2,
    gap: 0.08,
    verb: 0.3,
    play(v) {
      const lp = v.filt('lowpass', 6000);
      [72, 76, 79, 84].forEach((m, i) => {
        v.tone('p25', midiHz(m), { t: i * 0.05, g: perc(0.13, 0.18), to: lp });
        v.tone('sine', midiHz(m + 12), { t: i * 0.05, g: perc(0.09, 0.25) });
      });
      v.bell(midiHz(96), { t: 0.2, g: 0.09, dec: 0.5, ratio: 2, index: 1 });
      v.noise('white', { g: swell(0.06, 0.2, 0.3), to: v.filt('highpass', 7000) });
    },
  },
  lpTick: {
    // coin-counter blip: a tiny pulse chirp down onto F#6 with a click on top (rate-limited).
    // Bright and short so it cuts through the music even at the HUD's volume 0.35.
    cap: 3,
    gap: 0.035,
    verb: 0.03,
    vary: 0.02,
    play(v) {
      const lp = v.filt('lowpass', 6500);
      v.tone('p25', [[0, 1900], [0.012, 1480, 'e']], { g: perc(0.26, 0.026, 0.0005), to: lp });
      v.tone('sine', 2960, { g: perc(0.1, 0.018) });
      v.noise('white', { g: perc(0.14, 0.004, 0.0003), to: v.filt('highpass', 6000) });
    },
  },
  burn: {
    cap: 2,
    gap: 0.06,
    verb: 0.3,
    duck: 0.4,
    play(v) {
      v.noise('white', { g: [[0, 0], [0.05, 0.5], [0.7, 0.0001, 'e']], to: v.filt('lowpass', [[0, 300], [0.08, 3500, 'e'], [0.7, 500, 'e']], 1.5) });
      v.tone('sine', [[0, 110], [0.3, 50, 'e']], { g: perc(0.5, 0.35, 0.005) });
      v.crackle({ t: 0.05, d: 0.8, n: 28, g: 0.2, f: 3500, q: 0.8, curve: 1.4, dec: 0.006 });
      v.noise('white', { t: 0.05, g: [[0, 0], [0.1, 0.1], [0.8, 0.0001, 'e']], to: v.filt('highpass', 6000) });
    },
  },
  heal: {
    cap: 2,
    gap: 0.1,
    verb: 0.55,
    play(v) {
      for (const m of [60, 64, 67, 71, 74]) v.tone('triangle', midiHz(m), { g: [[0, 0], [0.25, 0.065], [1.2, 0.0001, 'e']], detune: v.r(-6, 6) });
      [84, 86, 88, 91, 93, 96, 98, 100, 103, 105].forEach((m, i) =>
        v.bell(midiHz(m), { t: 0.05 + i * 0.07, g: 0.055, dec: 0.45, ratio: 2, index: 0.7 }),
      );
      v.noise('pink', { g: swell(0.08, 0.7, 0.4), to: v.filt('bandpass', [[0, 2000], [0.8, 8000, 'e']], 1) });
    },
  },

  // ================================================================== spells & traps
  spellActivate: {
    cap: 2,
    gap: 0.1,
    verb: 0.5,
    duck: 0.4,
    play(v) {
      v.tone('sine', 110, { g: [[0, 0], [0.2, 0.18], [1.0, 0.0001, 'e']] });
      v.tone('sine', 110.9, { g: [[0, 0], [0.2, 0.12], [1.0, 0.0001, 'e']] });
      v.tone('triangle', 165, { g: [[0, 0], [0.25, 0.08], [1.0, 0.0001, 'e']] });
      [62, 69, 74, 78, 81, 86, 90, 93].forEach((m, i) => v.bell(midiHz(m), { t: i * 0.05, g: 0.06, dec: 0.6, ratio: 3.01, index: 1.5 }));
      v.noise('white', { g: swell(0.16, 0.4, 0.3), to: v.filt('bandpass', [[0, 1000], [0.4, 6000, 'e']], 1.2) });
      const lp = v.filt('lowpass', [[0, 500], [0.3, 4000, 'e'], [1.0, 800, 'e']], 2, { t: 0.35 });
      for (const m of [74, 78, 81, 88]) v.tone('p25', midiHz(m), { t: 0.35, g: [[0, 0], [0.05, 0.035], [0.7, 0.0001, 'e']], to: lp, detune: v.r(-6, 6) });
    },
  },
  trapActivate: {
    // Front-loaded: the hit lands on the call (the magenta flash of trapSpring / the "Aç" press).
    cap: 2,
    gap: 0.1,
    verb: 0.5,
    duck: 0.6,
    play(v) {
      // SNAP — spring-loaded jaws: a hard metallic clack and an inharmonic clang
      v.noise('white', { g: perc(0.5, 0.012, 0.0002), to: v.filt('highpass', 2500) });
      v.noise('white', { g: perc(0.3, 0.05, 0.0005), to: v.drive(6, { to: v.filt('bandpass', 1900, 1.6), trim: 0.5 }) });
      v.bell(698, { g: 0.12, dec: 1.0, ratio: 1.41, index: 3, idxDec: 0.25 });
      v.bell(1109, { t: 0.004, g: 0.05, dec: 0.5, ratio: 2.76, index: 2, idxDec: 0.1 });
      // body: sub drop and a darkening blast
      v.tone('sine', [[0, 170], [0.25, 40, 'e']], { g: perc(0.7, 0.42, 0.001), to: v.drive(2) });
      v.noise('white', { g: perc(0.28, 0.16), to: v.filt('lowpass', [[0, 5000], [0.22, 400, 'e']]) });
      // "TUZAK!": a dissonant cluster stab (C F# G C# F#) ...
      const lp = v.filt('lowpass', [[0, 700], [0.025, 3500, 'e'], [0.8, 500, 'e']], 3, { t: 0.008 });
      for (const m of [48, 54, 55, 61, 66])
        v.tone('sawtooth', midiHz(m), { t: 0.008, g: [[0, 0], [0.01, 0.06], [0.3, 0.042], [0.85, 0.0001, 'e']], to: lp, detune: v.r(-12, 12) });
      // ... and a sinister ring-modulated dive under it
      const rm = v.ring([[0, 300], [0.5, 90, 'e']], { t: 0.02, d: 0.55, mix: 1, to: v.filt('bandpass', 900, 1.2) });
      v.tone('square', [[0, 440], [0.5, 110, 'e']], { t: 0.02, g: perc(0.12, 0.5, 0.01), to: rm });
    },
  },
  lightning: {
    cap: 2,
    gap: 0.06,
    verb: 0.55,
    duck: 0.8,
    play(v) {
      // main strike at 0, re-strikes while the bolt re-rolls (~45 / ~100 ms)
      for (const [t, g] of [
        [0, 0.55],
        [0.045, 0.3],
        [0.1, 0.38],
      ] as const) {
        v.noise('white', { t, g: perc(g, 0.025, 0.0002) });
        v.noise('white', { t, g: perc(g * 0.7, 0.09, 0.0005), to: v.filt('highpass', 2200) });
      }
      v.crackle({ d: 0.4, n: 34, g: 0.4, f: 4200, q: 0.7, curve: 1.6, dec: 0.004 });
      const rm = v.ring([[0, 900], [0.3, 300, 'e']], { d: 0.35, mix: 1, to: v.filt('bandpass', 2500, 1) });
      v.tone('sawtooth', [[0, 3000], [0.3, 400, 'e']], { g: perc(0.24, 0.3, 0.001), to: rm });
      v.tone('sine', [[0, 90], [0.8, 30, 'e']], { g: perc(0.7, 1.1, 0.003), to: v.drive(1.5) });
      v.noise('brown', { t: 0.02, g: perc(0.45, 1.2, 0.02), to: v.filt('lowpass', [[0, 800], [1.2, 150, 'e']]) });
    },
  },
  chains: {
    cap: 2,
    gap: 0.1,
    verb: 0.4,
    duck: 0.45,
    play(v) {
      // the chains shoot out of the card: a dense metallic rattle sweeping across on a rising zip
      const sp = v.panner([[0, -0.5], [0.55, 0.45]]);
      const times: number[] = [];
      for (let i = 0; i < 20; i++) {
        const t = 0.01 + Math.pow(i / 19, 0.9) * 0.5 + v.r(-0.008, 0.008);
        times.push(t);
        clink(v, v.r(2000, 4200), t, 0.07 * v.r(0.6, 1), v.r(0.03, 0.07), sp);
      }
      v.bursts(times, times.map(() => v.r(0.08, 0.16)), { dec: 0.005, f: 5500, q: 0.8, to: sp });
      v.noise('white', { g: [[0, 0], [0.42, 0.2], [0.55, 0.0001, 'e']], to: v.filt('bandpass', [[0, 1500], [0.5, 6000, 'e']], 3, { to: sp }) });
      // they wrap around the attacker: three heavier links
      for (const [t, f] of [
        [0.56, 1250],
        [0.62, 1050],
        [0.67, 1400],
      ] as const) {
        clink(v, f, t, 0.12, 0.12);
        v.noise('white', { t, g: perc(0.16, 0.015, 0.0003), to: v.filt('bandpass', 3000, 1.2) });
      }
      // LOCK — "tak!": a heavy shackle clunk with a ringing iron tail
      const T = 0.78;
      v.tone('sine', [[0, 240], [0.06, 70, 'e']], { t: T, g: perc(0.55, 0.14, 0.0005), to: v.drive(1.8, { trim: 0.8 }) });
      v.noise('white', { t: T, g: perc(0.4, 0.025, 0.0003), to: v.filt('bandpass', 2200, 1.3) });
      v.noise('white', { t: T, g: perc(0.22, 0.09, 0.001), to: v.filt('lowpass', 1200) });
      v.bell(784, { t: T, g: 0.09, dec: 0.9, ratio: 1.41, index: 3, idxDec: 0.15 });
      v.bell(1568, { t: T + 0.005, g: 0.05, dec: 0.6, ratio: 2.76, index: 1.5 });
      clink(v, 2900, T, 0.07, 0.3);
    },
  },
  mirror: {
    cap: 2,
    gap: 0.1,
    verb: 0.65,
    duck: 0.4,
    play(v) {
      [84, 88, 91, 95].forEach((m, i) => {
        v.tone('sine', midiHz(m), { t: i * 0.03, g: [[0, 0], [0.15, 0.045], [1.2, 0.0001, 'e']] });
        v.tone('sine', midiHz(m) * 1.004, { t: i * 0.03, g: [[0, 0], [0.15, 0.045], [1.2, 0.0001, 'e']] });
      });
      v.noise('white', { g: swell(0.12, 0.25, 0.3), to: v.filt('highpass', 7000) });
      const T = 0.25;
      v.bell(midiHz(100), { t: T, g: 0.1, dec: 1.0, ratio: 3.99, index: 1 });
      const rm = v.ring(1700, { t: T, d: 0.3, mix: 0.8, to: v.filt('highpass', 800) });
      v.tone('sawtooth', [[0, 4000], [0.25, 1200, 'e']], { t: T, g: perc(0.08, 0.25, 0.001), to: rm });
      v.tone('sine', [[0, 200], [0.1, 100, 'e']], { t: T, g: perc(0.3, 0.15) });
    },
  },
  groundCrack: {
    cap: 2,
    gap: 0.1,
    verb: 0.45,
    duck: 0.5,
    play(v) {
      v.noise('brown', { g: [[0, 0], [0.1, 0.6], [1.0, 0.3], [1.5, 0.0001, 'e']], to: v.filt('lowpass', 300, 1) });
      v.tone('sine', [[0, 60], [1.4, 30, 'e']], { g: [[0, 0], [0.05, 0.5], [1.4, 0.0001, 'e']] });
      const ct = Array.from({ length: 8 }, (_, i) => 0.02 + i * 0.12 + v.r(0, 0.05));
      v.bursts(ct.slice(0, 4), ct.slice(0, 4).map((_, i) => v.r(0.25, 0.45) * (1 - i * 0.07)), { dec: 0.045, f: 1500, q: 1, drive: 4, trim: 0.6 });
      v.bursts(ct.slice(4), ct.slice(4).map((_, i) => v.r(0.2, 0.35) * (1 - i * 0.07)), { dec: 0.035, f: 800, q: 1.2, drive: 4, trim: 0.6 });
      v.crackle({ t: 0.2, d: 1.1, n: 18, g: 0.15, f: 1500, curve: 1, dec: 0.025 });
    },
  },
  fieldChange: {
    cap: 1,
    gap: 0.3,
    verb: 0.55,
    duck: 0.8,
    play(v) {
      const T = 1.1;
      v.noise('pink', { g: swell(0.45, T, 0.06), to: v.filt('bandpass', [[0, 200], [T, 3000, 'e']], 1.2) });
      v.tone('sawtooth', [[0, 40], [T, 80, 'e']], { g: swell(0.25, T, 0.05), to: v.filt('lowpass', [[0, 200], [T, 1200, 'e']]) });
      v.tone('sine', [[0, 110], [0.6, 30, 'e']], { t: T, g: perc(0.9, 0.9), to: v.drive(2) });
      v.noise('white', { t: T, g: perc(0.45, 0.5), to: v.filt('lowpass', [[0, 6000], [0.6, 250, 'e']]) });
      const lp = v.filt('lowpass', [[0, 400], [0.1, 2500, 'e'], [0.9, 600, 'e']], 1.5, { t: T });
      for (const m of [48, 55, 60, 63, 67, 74]) v.tone('sawtooth', midiHz(m), { t: T, g: [[0, 0], [0.03, 0.05], [0.4, 0.04], [0.9, 0.0001, 'e']], to: lp, detune: v.r(-10, 10) });
    },
  },
  equip: {
    cap: 2,
    gap: 0.1,
    verb: 0.4,
    play(v) {
      v.tone('sine', [[0, 1200], [0.25, 3600, 'e']], { g: [[0, 0], [0.2, 0.07], [0.3, 0.0001, 'e']] });
      v.noise('white', { g: swell(0.2, 0.22, 0.02), to: v.filt('bandpass', [[0, 2000], [0.22, 8000, 'e']], 3) });
      const T = 0.24;
      for (const [f, g, d] of [
        [2400, 0.07, 0.6],
        [3420, 0.05, 0.45],
        [4710, 0.035, 0.35],
        [6130, 0.025, 0.25],
      ] as const)
        v.tone('sine', f, { t: T, g: perc(g, d, 0.001) });
      [72, 76, 79, 84].forEach((m) => v.bell(midiHz(m), { t: T, g: 0.05, dec: 0.8, ratio: 2, index: 1.2 }));
      v.tone('sine', [[0, 300], [0.05, 120, 'e']], { t: T, g: perc(0.3, 0.08) });
    },
  },
  revive: {
    cap: 1,
    gap: 0.3,
    verb: 0.6,
    duck: 0.4,
    play(v) {
      v.noise('white', { g: [[0, 0], [0.4, 0.3], [1.0, 0.0001, 'e']], to: v.filt('bandpass', [[0, 600], [1.0, 2400, 'e']], 8) });
      const s = v.tone('sine', [[0, 300], [0.9, 900, 'e']], { g: [[0, 0], [0.3, 0.11], [0.9, 0.09], [1.1, 0.0001, 'e']] });
      v.lfo(s.osc.detune, 5.5, 40, { d: 1.1 });
      const out = v.amp(1);
      const split = v.amp(1, { to: v.filt('bandpass', 700, 5, { to: out }) });
      split.connect(v.filt('bandpass', 1100, 6, { to: out }));
      for (const m of [57, 64, 69, 72]) v.tone('sawtooth', midiHz(m), { g: [[0, 0], [0.6, 0.12], [1.2, 0.0001, 'e']], to: split, detune: v.r(-8, 8) });
      const T = 0.95;
      v.bell(midiHz(88), { t: T + 0.05, g: 0.09, dec: 0.8, ratio: 2, index: 1.2 });
      v.bell(midiHz(93), { t: T + 0.12, g: 0.08, dec: 1.0, ratio: 2, index: 1.2 });
      v.tone('sine', [[0, 70], [0.4, 140, 'e']], { t: T, g: perc(0.35, 0.5, 0.05) });
    },
  },
  lockOn: {
    cap: 3,
    gap: 0.03,
    verb: 0.12,
    play(v) {
      const lp = v.filt('lowpass', 5000);
      v.tone('square', 1320, { g: ahr(0.055, 0.002, 0.04, 0.01), to: lp });
      v.tone('square', 1760, { t: 0.07, g: ahr(0.055, 0.002, 0.05, 0.02), to: lp });
      v.tone('sine', [[0, 3000], [0.12, 1500, 'e']], { g: perc(0.04, 0.12) });
      v.noise('white', { g: perc(0.05, 0.04), to: v.filt('bandpass', [[0, 2000], [0.04, 5000, 'e']], 4) });
    },
  },

  // ================================================================== elements
  fireBurst: {
    cap: 3,
    gap: 0.05,
    verb: 0.3,
    duck: 0.3,
    vary: 0.06,
    play(v) {
      v.noise('white', { g: [[0, 0], [0.03, 0.6], [0.6, 0.0001, 'e']], to: v.drive(2, { to: v.filt('lowpass', [[0, 400], [0.06, 4500, 'e'], [0.6, 600, 'e']], 1.2), trim: 0.6 }) });
      v.tone('sine', [[0, 90], [0.15, 160, 'e'], [0.5, 50, 'e']], { g: perc(0.45, 0.45, 0.02) });
      v.crackle({ t: 0.04, d: 0.6, n: 22, g: 0.2, f: 3000, q: 0.8, curve: 1.3, dec: 0.006 });
    },
  },
  waterSplash: {
    cap: 3,
    gap: 0.05,
    verb: 0.3,
    duck: 0.3,
    vary: 0.06,
    play(v) {
      v.noise('white', { g: perc(0.45, 0.18, 0.003), to: v.filt('bandpass', [[0, 1800], [0.2, 900, 'e']], 0.8) });
      v.noise('white', { t: 0.03, g: perc(0.25, 0.3, 0.01), to: v.filt('highpass', 3000) });
      v.tone('sine', [[0, 120], [0.12, 70, 'e']], { g: perc(0.3, 0.15) });
      v.noise('white', { t: 0.02, g: [[0, 0], [0.03, 0.3], [0.3, 0.0001, 'e']], to: v.filt('bandpass', [[0, 3200], [0.28, 650, 'e']], 2.5) });
      for (let i = 0; i < 12; i++) {
        const t = 0.05 + v.rnd() * 0.5;
        const f = v.r(500, 1400);
        v.tone('sine', [[0, f], [0.03, f * 1.8, 'e']], { t, g: perc(v.r(0.04, 0.09), 0.035, 0.002) });
      }
    },
  },
  windGust: {
    cap: 2,
    gap: 0.1,
    verb: 0.35,
    vary: 0.05,
    play(v) {
      const sp = v.panner([[0, -0.4], [1.0, 0.4]]);
      const bp = v.filt('bandpass', [[0, 400], [0.4, 1600, 'e'], [1.0, 500, 'e']], [[0, 2], [0.4, 5], [1.0, 2]], { to: sp });
      v.noise('pink', { g: [[0, 0], [0.3, 1.0], [1.0, 0.0001, 'e']], to: bp });
      v.noise('white', { g: [[0, 0], [0.35, 0.12], [0.9, 0.0001, 'e']], to: v.filt('highpass', 5000, 0.707, { to: sp }) });
      v.noise('brown', { g: [[0, 0], [0.25, 0.35], [0.9, 0.0001, 'e']], to: v.filt('lowpass', 350, 0.707, { to: sp }) });
      const w = v.tone('sine', [[0, 800], [0.4, 1300, 'e'], [1.0, 700, 'e']], { g: [[0, 0], [0.35, 0.06], [0.9, 0.0001, 'e']], to: sp });
      v.lfo(w.osc.detune, 4, 30, { d: 1 });
    },
  },
  earthQuake: {
    cap: 2,
    gap: 0.1,
    verb: 0.35,
    duck: 0.4,
    play(v) {
      const D = 1.3;
      const lp = v.filt('lowpass', 240, 1.1);
      v.noise('brown', { g: [[0, 0], [0.06, 0.45], [0.8, 0.3], [D, 0.0001, 'e']], to: lp });
      // irregular jolts (no periodic AM: real ground does not pulse in time)
      let t = 0;
      for (let i = 0; i < 13 && t < D - 0.2; i++) {
        v.noise('brown', { t, g: perc(v.r(0.3, 0.6) * (1 - (t / D) * 0.7), v.r(0.06, 0.18), 0.008), to: lp });
        t += v.r(0.05, 0.14);
      }
      v.tone('sine', [[0, 45], [1.2, 32, 'e']], { g: [[0, 0], [0.05, 0.45], [1.2, 0.0001, 'e']] });
      v.tone('sine', [[0, 140], [0.2, 45, 'e']], { g: perc(0.5, 0.3) });
      v.crackle({ t: 0.05, d: 1.0, n: 20, g: 0.18, f: 1200, q: 1.2, curve: 1.2, dec: 0.02, kind: 'pink' });
    },
  },
  darkPulse: {
    cap: 3,
    gap: 0.06,
    verb: 0.45,
    duck: 0.3,
    play(v) {
      v.noise('pink', { g: swell(0.25, 0.22, 0.02), to: v.filt('lowpass', [[0, 300], [0.22, 2500, 'e']], 2) });
      const T = 0.22;
      const lp = v.filt('lowpass', [[0, 1800], [0.6, 200, 'e']], 8, { t: T });
      v.lfo(lp.detune, 6, 1200, { t: T, d: 0.6 });
      for (const f of [55, 58.27, 110]) v.tone('sawtooth', f, { t: T, g: perc(0.17, 0.6, 0.005), to: lp });
      v.tone('sine', [[0, 70], [0.5, 40, 'e']], { t: T, g: perc(0.6, 0.55, 0.003) });
    },
  },
  holyChime: {
    cap: 4,
    gap: 0.04,
    verb: 0.6,
    play(v) {
      v.bell(1318.5, { g: 0.13, dec: 1.2, ratio: 3.5, index: 1.2, idxDec: 0.3 });
      v.bell(2637, { g: 0.05, dec: 0.8, ratio: 2, index: 0.8 });
      v.bell(1975.5, { t: 0.04, g: 0.06, dec: 1.0, ratio: 2, index: 0.8 });
      v.tone('sine', 659.25, { g: perc(0.06, 1.0, 0.01) });
      v.noise('white', { g: swell(0.05, 0.15, 0.6), to: v.filt('highpass', 8000) });
    },
  },
  thunder: {
    cap: 2,
    gap: 0.1,
    verb: 0.55,
    duck: 0.7,
    play(v) {
      const D = 2.6;
      // crack of the strike
      v.noise('white', { g: perc(0.4, 0.06, 0.001), to: v.filt('bandpass', 2200, 0.6) });
      v.crackle({ d: 0.25, n: 14, g: 0.25, f: 2500, q: 0.6, curve: 1.6, dec: 0.006 });
      // rumble bed, getting darker
      v.noise('brown', { g: [[0, 0], [0.08, 0.45], [1.2, 0.3], [D, 0.0001, 'e']], to: v.filt('lowpass', [[0, 700], [D, 140, 'e']], 0.9) });
      // rolling booms: irregular spacing, each softer and darker than the last
      let t = 0.03;
      for (let i = 0; i < 9 && t < D - 0.4; i++) {
        const g = (0.6 - i * 0.05) * v.r(0.6, 1);
        const dec = v.r(0.2, 0.5);
        v.noise('brown', { t, g: [[0, 0], [v.r(0.02, 0.08), g], [dec, 0.0001, 'e']], to: v.filt('lowpass', v.r(280, 650) * (1 - i * 0.07), 0.8) });
        t += v.r(0.09, 0.3);
      }
      v.tone('sine', [[0, 55], [2.0, 30, 'e']], { g: [[0, 0], [0.1, 0.42], [2.2, 0.0001, 'e']] });
    },
  },

  // ================================================================== results
  victory: {
    cap: 1,
    gap: 1,
    verb: 0.5,
    duck: 1,
    play(v) {
      brass(v, 67, 0, 0.08, 0.1);
      brass(v, 72, 0.1, 0.08, 0.1);
      brass(v, 76, 0.2, 0.08, 0.1);
      const T = 0.3;
      brass(v, 79, T, 1.6, 0.14, { bright: 4500 });
      for (const m of [60, 64, 67, 72]) brass(v, m, T, 1.6, 0.07);
      v.tone('sine', [[0, 98], [0.6, 90]], { t: T, g: perc(0.5, 0.8) });
      v.tone('sine', [[0, 98], [0.08, 90, 'e']], { g: perc(0.28, 0.25) });
      v.noise('brown', { t: T, g: perc(0.3, 0.3), to: v.filt('lowpass', 800) });
      v.noise('white', { t: T, g: perc(0.22, 1.6, 0.003), to: v.filt('highpass', 5000) });
      [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => v.bell(midiHz(84 + n), { t: T + 0.1 + i * 0.08, g: 0.04, dec: 0.6, ratio: 2, index: 1 }));
    },
  },
  defeat: {
    cap: 1,
    gap: 1,
    verb: 0.5,
    duck: 1,
    play(v) {
      // blow: the last hit lands
      v.tone('sine', [[0, 100], [0.8, 30, 'e']], { g: perc(0.42, 1.0) });
      v.noise('white', { g: perc(0.22, 0.25), to: v.filt('lowpass', [[0, 5000], [0.3, 300, 'e']]) });
      // power-down: a minor chord sags an octave+ while the filter closes; the hologram's
      // supply stutters irregularly (flutter), getting worse as it dies
      const lp = v.filt('lowpass', [[0, 3200], [1.9, 280, 'e']], 2);
      const stutter = v.flutter(7, 0.3, { d: 2.0, base: 0.75, to: lp });
      for (const m of [57, 60, 64, 69])
        v.tone('sawtooth', [[0, midiHz(m)], [0.25, midiHz(m)], [1.9, midiHz(m - 15), 'e']], {
          g: [[0, 0], [0.03, 0.075], [1.0, 0.06], [2.0, 0.0001, 'e']],
          to: stutter,
          detune: v.r(-10, 10),
        });
      // sad falling pulse motif on top: E5 D5 C5 B4
      const lp2 = v.filt('lowpass', 2600);
      [76, 74, 72, 71].forEach((m, i) => v.tone('p25', midiHz(m), { t: 0.15 + i * 0.22, g: ahr(0.05, 0.01, 0.15, 0.12), to: lp2 }));
      // final glitch crunch as it cuts out
      let gt = 1.35;
      const gts: number[] = [];
      for (let i = 0; i < 6; i++) gts.push((gt += v.r(0.05, 0.1)));
      v.bursts(gts, gts.map((_, i) => 0.12 * (1 - i * 0.12)), { dec: 0.03, f: 1600, q: 1.5, drive: 8 });
      v.tone('square', [[0, 220], [0.25, 40, 'e']], { t: 1.75, g: perc(0.06, 0.25), to: v.filt('lowpass', 1200) });
    },
  },
};
