// Kutup Hükümdarı (polar_sovereign, lane D, C15) — the fused ace's own sound set (?look=v3 only; YENI_KARTLAR §C15,
// §5.1). src/audio/sounds.ts spreads V3_POLAR_SOVEREIGN_RECIPES and SfxName gains PolarSovereignSfxName.
//
// Identity (§5.1, the polar family): the family's 110 / 111 Hz beating pair, iron-dust glass pings — and what is the
// sovereign's alone: the CHORD of the three pieces' pitches (anvil E2 82 Hz, coil D3 147 Hz, needle A3 220 Hz) sounding
// together, and the 35 Hz IRON GONG (a huge struck plate: a sub fundamental with slow inharmonic partials) that no
// other card uses. The fusion's three KLAKs each fall a whole tone; the split plays the chord coming apart into its
// three notes.
//
//   fusion  sovereignDust      the iron-dust compass rose drawn across three zones (metallic glassRain sweep)
//           sovereignRise      the three pieces rise humming their own pitches (sustained → the swap)
//           sovereignTumble    the swap → KLAK 1: the chord held, the anvil's tumbling creak, a whine rising into the clamp
//           sovereignCutin     the ace cut-in's own whine: two poles' FM sweeps crossing
//           sovereignKlak1/2/3 KLAK: heavy clank + 35 Hz gong + crack, each a whole tone lower
//           sovereignLand      the landing: the gong full, the chord, the iron-dust shock ring
//           sovereignSpear     the spear struck down: the butt's ring and the crown's chime
//           sovereignTick      a tribute card settles on the graveyard (soft iron-dust tick)
//   roar    sovereignRoar      the chord swells, the field blazes, the pieces KLAK back
//   attack  sovereignCompass   the spear spins as a compass card: ticks accelerating (sustained → lock)
//           sovereignLock      "TIK": locked on the foe
//           sovereignThrow     the throw: a two-colour whoosh
//           sovereignRose      the rose of field lines closing round the target (two opposite-pitched FM sweeps)
//           sovereignPierce    the spear in the rose's heart: pole blast + gong + iron rain
//           sovereignRecall    the spear snaps back into the fist
//   death   sovereignCrack     cracks run along the joints
//           sovereignStrain    the field building in the cracked body (sustained → the repel)
//           sovereignRepel     magnetic repulsion: the chord splits into its three notes, flung apart
//           sovereignFall      (fail) the pieces drop and clatter
//           sovereignBurst     the last breath: the hum dies, the dust settles
//   split   sovereignHang      the three pieces held in the field over their zones (sustained → the first drop)
//           sovereignPieceLand a piece lands in its zone (pitched per piece by the cinematic's `rate`)
//   revive  sovereignReviveGather / sovereignReviveLock
// Levels follow the slice (pre-chain linear amplitudes); big beats duck ≥ 0.55, small ≤ 0.3 (SE-7).

import type { Recipe } from '../sounds';
import { midiHz, perc, type Pt } from '../synth';
import type { Voice } from '../synth';
import { clank, crack, glassRain, link, puff, scaled, sweep, thump } from './kit';

/** the pieces' pitches: anvil E2, coil D3, needle A3 */
const E2 = midiHz(40);
const D3 = midiHz(50);
const A3 = midiHz(57);
/** iron dust: high A-minor pings */
const DUST = [105, 108, 112, 115] as const;

function poleHum(v: Voice, t: number, env: readonly Pt[], k = 1): void {
  v.tone('sine', 110, { t, g: scaled(env, k) });
  v.tone('sine', 111, { t, g: scaled(env, k * 0.9) });
}

/** The 35 Hz iron gong: a sub fundamental and slow inharmonic plate modes (f = the fundamental). */
function gong(v: Voice, t: number, g: number, dec: number, f = 35): void {
  v.tone('sine', [[0, f * 1.06], [0.08, f, 'e']], { t, g: perc(g, dec, 0.004) });
  v.tone('sine', f * 2.02, { t, g: perc(g * 0.5, dec * 0.8, 0.004) });
  v.bell(f * 4.2, { t, g: g * 0.22, dec: dec * 0.7, ratio: 1.47, index: 1.6, idxDec: dec * 0.3 });
  v.bell(f * 7.9, { t, g: g * 0.1, dec: dec * 0.45, ratio: 1.33, index: 1.2, idxDec: dec * 0.2 });
  v.noise('brown', { t, g: perc(g * 0.5, 0.18, 0.003), to: v.filt('lowpass', 260, 0.8) });
}

/** The chord of the three pieces (82 / 147 / 220) under one envelope; `split` detunes it apart. */
function chord(v: Voice, t: number, env: readonly Pt[], k = 1, split = 0): void {
  const notes: [number, number][] = [[E2, 1], [D3, 0.7], [A3, 0.5]];
  notes.forEach(([f, a], i) => {
    const d = split * (i - 1) * 0.06;
    const fq: Pt[] | number = split > 0 ? [[0, f], [0.5, f * (1 + d), 'e']] : f;
    v.tone('triangle', fq, { t, g: scaled(env, k * a * 0.6) });
    v.tone('sine', split > 0 ? [[0, f * 2], [0.5, f * 2 * (1 + d), 'e']] : f * 2, { t, g: scaled(env, k * a * 0.25) });
  });
}

/** One KLAK of the fusion: n = 0, 1, 2 — each a whole tone lower and a step heavier. */
function klak(v: Voice, n: number): void {
  const down = Math.pow(2, (-2 * n) / 12);
  clank(v, 520 * down, 0, 0.21 + n * 0.02, 0.5, { ratio: 1.41, index: 2.8, click: 1.4 });
  clank(v, 780 * down, 0.01, 0.1, 0.32, { ratio: 2.76, index: 1.8, click: 0.6 });
  thump(v, 0, 150 * down, 46 * down, 0.42 + n * 0.05, 0.24, { drive: 1.6 });
  crack(v, 0.003, 0.16 + n * 0.02, { hp: 2600, n: 2, gap: 0.01 });
  gong(v, 0.01, 0.2 + n * 0.06, 0.9 + n * 0.25, 35 * down);
  glassRain(v, { t: 0.04, d: 0.35, n: 6 + n * 2, g: 0.05, notes: DUST, dec: [0.04, 0.1], curve: 1.2, modes: 2 });
}

export const V3_POLAR_SOVEREIGN_RECIPES = {
  /** Fusion (0.0): the iron-dust compass rose drawn across three zones — a metallic glass sweep, dust hiss L → R. */
  sovereignDust: {
    cap: 1,
    gap: 0.3,
    verb: 0.45,
    duck: 0.35,
    play(v) {
      sweep(v, 0, 0.8, [1800, 5200, 3000], 0.12, { kind: 'pink', q: 2.2, pan: [-0.6, 0.6], peakAt: 0.6 });
      glassRain(v, { d: 0.8, n: 26, g: 0.075, notes: DUST, dec: [0.03, 0.09], curve: 0.7, spread: 0.8, modes: 2 });
      // the tail bridges into the rise: the drawn rose keeps ringing (a thinning dust shimmer) and the family beat
      // swells under the card sinking into the middle tile, the low chord waking under it
      glassRain(v, { t: 0.8, d: 0.6, n: 10, g: 0.04, notes: DUST, dec: [0.04, 0.12], curve: 1.4, spread: 0.6, modes: 2 });
      poleHum(v, 0, [[0, 0], [0.5, 0.12], [0.9, 0.14], [1.45, 0.1], [1.6, 0.0001, 'e']]);
      chord(v, 0.7, [[0, 0], [0.4, 0.07], [0.75, 0.09], [0.9, 0.0001, 'e']]);
    },
  },
  /** Fusion (0.8): the three pieces rise, each humming its own pitch over the family beat (stopped at the swap). */
  sovereignRise: {
    cap: 1,
    gap: 0.3,
    verb: 0.35,
    duck: 0.45,
    play(v) {
      const D = 1.6;
      const env = (t0: number): Pt[] => [[0, 0], [t0, 0.0001], [t0 + 0.2, 0.1], [D, 0.16], [D + 0.12, 0.0001, 'e']];
      // anvil low, then coil, then needle — staggered, each through its own colour
      v.tone('triangle', [[0, E2], [D, E2 * 1.02, 'e']], { g: env(0), to: v.filt('lowpass', 600, 0.8) });
      v.tone('sawtooth', [[0, D3], [D, D3 * 1.02, 'e']], { g: scaled(env(0.15), 0.45), to: v.filt('bandpass', 700, 2) });
      v.tone('square', [[0, A3], [D, A3 * 1.02, 'e']], { g: scaled(env(0.3), 0.3), to: v.filt('lowpass', 1400, 1) });
      poleHum(v, 0, [[0, 0], [D, 0.2], [D + 0.12, 0.0001, 'e']]);
      glassRain(v, { t: 0.2, d: D - 0.2, n: 10, g: 0.04, notes: DUST, dec: [0.03, 0.08], curve: 1, modes: 2 });
    },
  },
  /** Fusion (the swap → KLAK 1, sustained; stopped on the first KLAK): the exploded pieces hold their chord in the
   *  field, the upright anvil TUMBLES over into the base (a heavy groaning creak, iron scraping iron, a mid-air
   *  thud as it turns) and a magnetic whine rises into the clamp. */
  sovereignTumble: {
    cap: 1,
    gap: 0.3,
    verb: 0.4,
    duck: 0.5,
    play(v) {
      const D = 1.6;
      // the chord held (82 / 147 / 220) over the family beat — the bed never drops out
      chord(v, 0, [[0, 0.1], [0.3, 0.14], [D - 0.2, 0.18], [D, 0.0001, 'e']]);
      poleHum(v, 0, [[0, 0.14], [D - 0.2, 0.2], [D, 0.0001, 'e']]);
      // the tumble: a slow groaning creak (a low saw through a wandering band), iron on iron, a heavy turn
      const creak = v.filt('bandpass', [[0, 260], [0.25, 520, 'e'], [0.5, 340, 'e'], [0.8, 610, 'e']], 6);
      v.tone('sawtooth', [[0, 46], [0.3, 52], [0.6, 41], [0.85, 49]], { g: [[0, 0], [0.06, 0.16], [0.75, 0.12], [0.95, 0.0001, 'e']], to: creak });
      v.noise('pink', { t: 0.05, g: [[0, 0], [0.1, 0.06], [0.7, 0.04], [0.9, 0.0001, 'e']], to: v.filt('bandpass', [[0, 900], [0.8, 1600, 'e']], 4) });
      thump(v, 0.32, 90, 40, 0.26, 0.2, { drive: 1.4 });
      clank(v, 260, 0.34, 0.08, 0.3, { ratio: 1.41, index: 1.6, click: 0.5 });
      // the magnetic whine rising into the clamp (two poles: a falling and a rising partial converging)
      v.tone('sine', [[0, 0], [0.2, 330], [D, 1320, 'e']], { g: [[0, 0], [0.2, 0.0001], [0.6, 0.03], [D - 0.1, 0.09], [D, 0.0001, 'e']] });
      v.tone('sine', [[0, 0], [0.2, 2640], [D, 1320, 'e']], { g: [[0, 0], [0.2, 0.0001], [0.7, 0.02], [D - 0.1, 0.05], [D, 0.0001, 'e']] });
      glassRain(v, { t: 0.1, d: D - 0.2, n: 12, g: 0.035, notes: DUST, dec: [0.03, 0.08], curve: 0.8, modes: 2 });
    },
  },
  /** Fusion (3.4): the cut-in's own whine — two poles as two FM sweeps crossing (fire falling from high, water
   *  rising from low, panned to their halves of the band), a bright iron shimmer where they meet. */
  sovereignCutin: {
    cap: 1,
    gap: 0.3,
    verb: 0.45,
    duck: 0.55,
    play(v) {
      const D = 0.7;
      const pl = v.panner([[0, -0.8], [D, -0.3]]);
      const pr = v.panner([[0, 0.8], [D, 0.3]]);
      v.bell(1320, { g: 0.06, dec: D, ratio: 1.41, index: 2.2, idxDec: 0.4, to: pl });
      v.tone('sawtooth', [[0, 1320], [0.32, 660, 'e']], { g: [[0, 0], [0.03, 0.05], [0.4, 0.0001, 'e']], to: v.filt('bandpass', 1800, 4) });
      v.tone('sine', [[0, 220], [0.32, 660, 'e'], [D, 880, 'e']], { g: [[0, 0], [0.04, 0.09], [0.35, 0.08], [D, 0.0001, 'e']], to: pr });
      v.tone('sine', [[0, 1760], [0.32, 660, 'e'], [D, 495, 'e']], { g: [[0, 0], [0.04, 0.06], [0.35, 0.05], [D, 0.0001, 'e']], to: pl });
      sweep(v, 0, 0.45, [700, 3400, 1500], 0.14, { kind: 'pink', q: 2, pan: [-0.6, 0.6], peakAt: 0.3 });
      glassRain(v, { t: 0.28, d: 0.4, n: 12, g: 0.05, notes: DUST, dec: [0.03, 0.1], curve: 1, spread: 0.9, modes: 2 });
      poleHum(v, 0, [[0, 0], [0.3, 0.12], [D, 0.0001, 'e']]);
    },
  },
  sovereignKlak1: { cap: 2, gap: 0.05, verb: 0.38, duck: 0.6, play: (v) => klak(v, 0) },
  sovereignKlak2: { cap: 2, gap: 0.05, verb: 0.38, duck: 0.6, play: (v) => klak(v, 1) },
  sovereignKlak3: { cap: 2, gap: 0.05, verb: 0.42, duck: 0.65, play: (v) => klak(v, 2) },
  /** Fusion (4.6): the landing — the gong full and long, the chord, the dust shock ring rushing out. */
  sovereignLand: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    duck: 0.7,
    play(v) {
      thump(v, 0, 120, 32, 0.5, 0.4, { drive: 1.8 });
      gong(v, 0, 0.34, 2.2);
      chord(v, 0.02, [[0, 0], [0.04, 0.22], [1.6, 0.0001, 'e']]);
      puff(v, 0, 0.3, 0.6, 1800, { kind: 'pink' });
      sweep(v, 0.02, 0.7, [900, 3200, 1200], 0.12, { kind: 'white', q: 1.4, peakAt: 0.25 });
      glassRain(v, { t: 0.05, d: 0.7, n: 18, g: 0.06, notes: DUST, dec: [0.03, 0.1], curve: 1.3, modes: 2 });
    },
  },
  /** Fusion: the spear struck down — the butt on the marble, a bright ring, the crown's chime answering. */
  sovereignSpear: {
    cap: 1,
    gap: 0.1,
    verb: 0.42,
    duck: 0.35,
    play(v) {
      clank(v, 880, 0, 0.14, 0.6, { ratio: 1.41, index: 2, click: 1 });
      thump(v, 0, 200, 70, 0.22, 0.12);
      link(v, 1760, 0.06, 0.05, 0.9);
      link(v, 2640, 0.12, 0.035, 0.8);
      poleHum(v, 0, perc(0.1, 0.8, 0.01));
    },
  },
  /** Roar: the chord swells through a sweep, the pieces lift (a buzz) and KLAK back with the gong. */
  sovereignRoar: {
    cap: 1,
    gap: 0.25,
    verb: 0.45,
    duck: 0.6,
    play(v) {
      chord(v, 0, [[0, 0], [0.3, 0.2], [0.55, 0.26], [1.1, 0.0001, 'e']]);
      const bp = v.filt('bandpass', [[0, 300], [0.4, 1800, 'e']], 2.5);
      v.tone('sawtooth', E2 * 2, { g: [[0, 0], [0.3, 0.08], [0.45, 0.0001, 'e']], to: bp });
      clank(v, 470, 0.45, 0.17, 0.4, { ratio: 1.41, index: 2.6, click: 1 });
      gong(v, 0.46, 0.26, 1.3);
    },
  },
  /** Attack: the spear spins flat as a compass card — ticks accelerating, a pitch climbing (stopped at the lock). */
  sovereignCompass: {
    cap: 1,
    gap: 0.3,
    verb: 0.3,
    duck: 0.35,
    play(v) {
      let t = 0;
      let gap = 0.11;
      for (let i = 0; i < 16 && t < 0.8; i++) {
        link(v, 2200 + i * 70, t, 0.05 + i * 0.003, 0.05);
        v.noise('white', { t, g: perc(0.05, 0.004, 0.0002), to: v.filt('bandpass', 5200, 2) });
        t += gap;
        gap = Math.max(0.035, gap * 0.86);
      }
      sweep(v, 0, 0.85, [300, 1400, 2200], 0.1, { kind: 'pink', q: 3, peakAt: 0.9 });
      poleHum(v, 0, [[0, 0], [0.8, 0.14], [0.9, 0.0001, 'e']]);
    },
  },
  /** "TIK": the compass locks on the foe. */
  sovereignLock: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      link(v, 3300, 0, 0.12, 0.22);
      v.noise('white', { g: perc(0.14, 0.005, 0.0002), to: v.filt('bandpass', 6000, 1.6) });
      thump(v, 0, 300, 120, 0.12, 0.05);
    },
  },
  /** The throw: a heavy two-colour whoosh leaving the fist (pan follows the throw). */
  sovereignThrow: {
    cap: 1,
    gap: 0.15,
    verb: 0.3,
    duck: 0.4,
    play(v) {
      sweep(v, 0, 0.35, [500, 2600, 900], 0.45, { kind: 'pink', q: 1.8, pan: [-0.2, 0.6], peakAt: 0.35 });
      v.tone('sawtooth', [[0, A3 * 2], [0.3, A3 * 4, 'e']], { g: [[0, 0], [0.04, 0.05], [0.32, 0.0001, 'e']], to: v.filt('bandpass', 1800, 3) });
      thump(v, 0, 160, 60, 0.32, 0.1);
    },
  },
  /** The rose closes round the target: two FM sweeps of opposite pitch (fire falling, water rising) meeting. */
  sovereignRose: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.4,
    play(v) {
      const D = 0.42;
      const panL = v.panner([[0, -0.7], [D, 0]]);
      const panR = v.panner([[0, 0.7], [D, 0]]);
      v.tone('sine', [[0, 1400], [D, 520, 'e']], { g: [[0, 0], [0.05, 0.1], [D, 0.12], [D + 0.05, 0.0001, 'e']], to: panL });
      v.tone('sine', [[0, 260], [D, 520, 'e']], { g: [[0, 0], [0.05, 0.1], [D, 0.12], [D + 0.05, 0.0001, 'e']], to: panR });
      glassRain(v, { d: D, n: 12, g: 0.05, notes: DUST, dec: [0.03, 0.08], curve: 0.8, modes: 2 });
    },
  },
  /** The spear in the rose's heart: a pole blast (white noise + chord stab), the gong, iron rain. */
  sovereignPierce: {
    cap: 1,
    gap: 0.15,
    verb: 0.45,
    duck: 0.75,
    play(v) {
      v.noise('white', { g: perc(0.4, 0.12, 0.001), to: v.filt('bandpass', 2400, 0.9) });
      thump(v, 0, 180, 40, 0.6, 0.3, { drive: 1.8 });
      clank(v, 640, 0, 0.18, 0.5, { ratio: 1.41, index: 3, click: 1.2 });
      gong(v, 0.01, 0.34, 1.6);
      chord(v, 0, [[0, 0], [0.02, 0.18], [0.8, 0.0001, 'e']]);
      glassRain(v, { t: 0.08, d: 0.9, n: 22, g: 0.06, notes: DUST, dec: [0.03, 0.12], curve: 1.6, modes: 2 });
    },
  },
  /** The spear snaps back into the fist: a rising magnetic zip and a solid catch. */
  sovereignRecall: {
    cap: 1,
    gap: 0.15,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      sweep(v, 0, 0.28, [1200, 600, 2400], 0.22, { kind: 'pink', q: 2.4, pan: [0.6, -0.1], peakAt: 0.8 });
      v.tone('square', [[0, 220], [0.26, 660, 'e']], { g: [[0, 0], [0.05, 0.04], [0.27, 0.0001, 'e']], to: v.filt('lowpass', 2000, 1) });
      clank(v, 760, 0.27, 0.18, 0.3, { ratio: 1.41, index: 2, click: 0.8 });
    },
  },
  /** Death start: cracks run along the joints — dry splits with a hum faltering. */
  sovereignCrack: {
    cap: 1,
    gap: 0.15,
    verb: 0.35,
    duck: 0.45,
    play(v) {
      crack(v, 0, 0.26, { hp: 2200, n: 3, gap: 0.05 });
      crack(v, 0.16, 0.2, { hp: 3000, n: 2, gap: 0.03 });
      chord(v, 0, [[0, 0.16], [0.35, 0.08], [0.4, 0.0001, 'e']], 1, 0.6);
      poleHum(v, 0, [[0, 0.16], [0.4, 0.0001, 'e']]);
    },
  },
  /** Death, between the cracks and the repel (sustained; stopped on the repel): the field builds in the cracked
   *  body — a magnetic whine rising (two poles' partials pulling apart, up an octave), the chord detuning ever
   *  wider and beating faster, the seams crackling more and more densely, a low strain groaning under it. */
  sovereignStrain: {
    cap: 1,
    gap: 0.3,
    verb: 0.4,
    duck: 0.45,
    play(v) {
      const D = 1.6;
      const env = (g: number): Pt[] => [[0, 0], [0.12, g * 0.4], [D - 0.15, g], [D, 0.0001, 'e']];
      // the whine: two partials diverging upward (fire high, water under it), panned apart
      v.tone('sine', [[0, 440], [D, 1320, 'e']], { g: env(0.07), to: v.panner([[0, 0], [D, -0.5]]) });
      v.tone('sine', [[0, 466], [D, 990, 'e']], { g: env(0.06), to: v.panner([[0, 0], [D, 0.5]]) });
      // the chord detuning apart, its beat quickening
      [[E2, 0.12], [D3, 0.08], [A3, 0.06]].forEach(([f, g], i) => {
        const pts: Pt[] = [];
        for (let t = 0; t <= D; t += 0.03) pts.push([t, f * (1 + (i - 1) * 0.05 * (t / D)) * (1 + 0.01 * (t / D) * Math.sin(t * (6 + 22 * (t / D)) * Math.PI * 2))]);
        v.tone('triangle', pts, { g: env(g) });
      });
      // the strain groan: a low saw through a closing band
      v.tone('sawtooth', [[0, 41], [D, 55, 'e']], { g: env(0.08), to: v.filt('bandpass', [[0, 220], [D, 520, 'e']], 5) });
      // the seams crackling, denser and denser
      v.crackle({ t: 0.05, d: D * 0.5, n: 8, g: 0.12, f: 3800, q: 1.4, curve: 1, dec: 0.004 });
      v.crackle({ t: D * 0.5, d: D * 0.5, n: 22, g: 0.16, f: 4400, q: 1.4, curve: 0.8, dec: 0.004 });
      glassRain(v, { t: 0.2, d: D - 0.3, n: 12, g: 0.035, notes: DUST, dec: [0.03, 0.08], curve: 0.7, modes: 2 });
      poleHum(v, 0, env(0.12));
    },
  },
  /** Magnetic repulsion: the chord flies apart into its three notes (diverging pitches and pans), a heavy whoomp. */
  sovereignRepel: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    duck: 0.65,
    play(v) {
      thump(v, 0, 140, 38, 0.5, 0.3, { drive: 1.6 });
      gong(v, 0, 0.22, 1.1, 39);
      const go = (f: number, f1: number, pan: number, g: number) => {
        const p = v.panner([[0, 0], [0.5, pan]]);
        v.tone('triangle', [[0, f], [0.6, f1, 'e']], { g: [[0, 0], [0.02, g], [0.7, 0.0001, 'e']], to: p });
      };
      go(E2, E2 * 0.84, -0.7, 0.18);
      go(D3, D3, 0, 0.13);
      go(A3, A3 * 1.19, 0.7, 0.1);
      sweep(v, 0, 0.45, [400, 2400, 700], 0.18, { kind: 'pink', q: 1.4, peakAt: 0.2 });
    },
  },
  /** Fail: the three pieces drop to the marble — three clatters of their own weights. */
  sovereignFall: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.4,
    play(v) {
      clank(v, 300, 0, 0.14, 0.35, { ratio: 1.41, index: 2, click: 1 });
      thump(v, 0, 110, 45, 0.3, 0.16);
      clank(v, 470, 0.09, 0.11, 0.3, { ratio: 1.6, index: 2, click: 0.8 });
      clank(v, 900, 0.17, 0.08, 0.25, { ratio: 2.1, index: 1.6, click: 0.8 });
      v.crackle({ t: 0.05, d: 0.4, n: 14, g: 0.18, f: 3600, q: 1.2, curve: 1.2, dec: 0.005 });
    },
  },
  /** The last breath: the beat dies, the iron dust settles. */
  sovereignBurst: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    duck: 0.35,
    play(v) {
      poleHum(v, 0, [[0, 0.14], [0.7, 0.0001, 'e']]);
      glassRain(v, { d: 0.7, n: 16, g: 0.05, notes: DUST, dec: [0.03, 0.1], curve: 1.8, modes: 2 });
      puff(v, 0, 0.16, 0.5, 900, { kind: 'brown' });
    },
  },
  /** Split: the three pieces hang in the field over their zones (sustained; stopped as the first one drops) — the
   *  chord held apart: its three notes each wavering at their own rate over the family's 110 / 111 Hz beat. */
  sovereignHang: {
    cap: 1,
    gap: 0.3,
    verb: 0.45,
    duck: 0.3,
    play(v) {
      const D = 3;
      const env = (g: number): Pt[] => [[0, 0], [0.15, g], [D - 0.6, g * 0.8], [D, 0.0001, 'e']];
      const notes: [number, number, number, number][] = [[E2 * 0.84, 0.1, 5.2, -0.6], [D3, 0.07, 6.6, 0], [A3 * 1.19, 0.05, 8.1, 0.6]];
      notes.forEach(([f, g, rate, pan]) => {
        const p = v.panner(pan);
        const wob: Pt[] = [];
        for (let t = 0; t <= D; t += 0.04) wob.push([t, f * (1 + 0.012 * Math.sin(t * rate * Math.PI * 2))]);
        v.tone('triangle', wob, { g: env(g), to: p });
      });
      poleHum(v, 0, env(0.09));
      glassRain(v, { t: 0.1, d: D - 0.4, n: 14, g: 0.03, notes: DUST, dec: [0.03, 0.08], curve: 1, spread: 0.9, modes: 2 });
      // the arcs snapping between the hanging pieces
      v.crackle({ t: 0.02, d: D - 0.5, n: 30, g: 0.1, f: 4200, q: 1.3, curve: 1, dec: 0.004 });
    },
  },
  /** Fusion: a tribute card settles on the graveyard pile — a soft iron-dust tick (it takes the shared card-place
   *  sound's place: the KLAK windows stay clean). */
  sovereignTick: {
    cap: 3,
    gap: 0.04,
    verb: 0.3,
    duck: 0.1,
    play(v) {
      link(v, 2640, 0, 0.035, 0.5);
      glassRain(v, { d: 0.18, n: 4, g: 0.03, notes: DUST, dec: [0.02, 0.06], curve: 1.2, modes: 2 });
      v.noise('white', { g: perc(0.03, 0.01, 0.0005), to: v.filt('bandpass', 5200, 2) });
    },
  },
  /** Split: a piece lands in its zone in defense (the cinematic pitches it per piece with `rate`). */
  sovereignPieceLand: {
    cap: 3,
    gap: 0.04,
    verb: 0.35,
    duck: 0.4,
    vary: 0,
    play(v) {
      clank(v, 440, 0, 0.16, 0.4, { ratio: 1.41, index: 2.4, click: 1 });
      thump(v, 0, 130, 50, 0.32, 0.18, { drive: 1.3 });
      glassRain(v, { t: 0.03, d: 0.3, n: 6, g: 0.045, notes: DUST, dec: [0.03, 0.08], curve: 1.2, modes: 2 });
    },
  },
  /** Revive: the pieces are pulled together (a rising chord through the dust; stopped on land). */
  sovereignReviveGather: {
    cap: 1,
    gap: 0.3,
    verb: 0.4,
    duck: 0.4,
    play(v) {
      chord(v, 0, [[0, 0], [0.6, 0.18], [0.75, 0.0001, 'e']], 1);
      glassRain(v, { d: 0.6, n: 14, g: 0.05, notes: DUST, dec: [0.03, 0.08], curve: 0.6, modes: 2 });
      poleHum(v, 0, [[0, 0], [0.6, 0.16], [0.75, 0.0001, 'e']]);
    },
  },
  sovereignReviveLock: { cap: 1, gap: 0.2, verb: 0.4, duck: 0.55, play: (v) => klak(v, 1) },
} satisfies Record<string, Recipe>;

export type PolarSovereignSfxName = keyof typeof V3_POLAR_SOVEREIGN_RECIPES;
