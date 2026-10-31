// Kutup İğnesi (polar_needle, lane D, C12) — the compass-needle dancer's own sound set (?look=v3 only;
// YENI_KARTLAR §C12, §5.1). src/audio/sounds.ts spreads V3_POLAR_NEEDLE_RECIPES and SfxName gains
// PolarNeedleSfxName.
//
// Identity (§5.1, the polar family): the family's 110 / 111 Hz beating sine pair (a 1 Hz magnetic "wah") under
// the needle's own pitch A3 = 220 Hz (with 221 Hz beside it: the needle's tone also beats, faster, 1 Hz up an
// octave), iron-dust pings on high A-major notes (E7 A7 C#8 E8 — the anvil's are E-minor) — and what is the
// needle's alone: the COMPASS (a dry pivot ratchet whose clicks slow as the needle settles, a crisp lock "TIK")
// and the PIERCE (a thin steel ring on A6 = 1760 Hz that beats against 1767 Hz: a needle singing as it goes
// through). The anvil (82 Hz, its long anvil ring) and the coil (147 Hz, winding buzz) keep their registers;
// the sovereign's 35 Hz gong is not used here.
//
//   arrive  polarNeedleDrop        the needle falls point-first out of the sky: a falling steel whistle + air
//           polarNeedleTip         its point strikes the marble: "tink" — the 220 hum wakes
//           polarNeedleSpin        two compass turns on the tip: the pivot ratchet slows down (sustained → lock)
//   land    polarNeedleLock        it locks on the opponent: "TIK" + the 220/221 ring
//           polarNeedleUnfold      the limbs open, the rose crown fans out: two light swishes + a pinged triad
//   roar    polarNeedleRoar        the spear raised, the field blazes (FM whine up an octave + dust)
//   charge  polarNeedleCharge      the spear drawn back level, the long locked aim (sustained → release)
//           polarNeedleBracket     the two field brackets "( )" appear either side of the target (L / R "tşk")
//           polarNeedleClamp       the brackets slam shut on the target — it is locked (L / R crossed)
//   release polarNeedleLunge       the 60 ms lunge: a thin steel whistle cutting the air
//   impact  polarNeedlePierce      through the brackets: the pierce ring (1760 / 1767) + the brackets breaking
//           polarNeedleDeflect     blocked: the point skids off the guard (a bent squeal) + the brackets bounce
//   (death f1) polarNeedleSeize    an invisible force grips the needle (the beat swells, a strained creak)
//           polarNeedleRip         it is ripped out of the shell: "şvuup" (a rising tear)
//   dissolve   polarNeedleWhirl    it spins away madly off the screen (a receding, quickening whirl)
//   afterDissolve polarNeedlePlate a magnetite plate drops onto the marble
//   burst   polarNeedleBurst       the shell settles: plates clatter, the spear rings flat, the hum dies
//   reviveGather polarNeedleReviveGather  the needle whirls back down out of the sky (sustained → land)
//   reviveLand   polarNeedleReviveLock    it seats in the shell and locks
// Levels follow the slice (pre-chain linear amplitudes); big beats duck ≥ 0.55, small ≤ 0.3 (SE-7).

import type { Recipe } from '../sounds';
import { midiHz, perc, type Pt, type Voice } from '../synth';
import { clank, crack, glassRain, link, puff, scaled, sweep, thump } from './kit';

/** The needle's pitch (A3 = 220 Hz). */
const A3 = midiHz(57);
/** The pierce ring (A6). */
const A6 = midiHz(93);
/** The iron dust: high A-major pings (E7 A7 C#8 E8). */
const DUST = [100, 105, 109, 112] as const;

/** The family hum: two sines at 110 / 111 Hz (1 Hz beat) under an envelope. */
function poleHum(v: Voice, t: number, env: readonly Pt[], k = 1): void {
  v.tone('sine', 110, { t, g: scaled(env, k) });
  v.tone('sine', 111, { t, g: scaled(env, k * 0.9) });
}

/** The needle's own tone: 220 / 221 Hz (a faster beat an octave above the family's) with a soft octave. */
function needleTone(v: Voice, t: number, env: readonly Pt[], k = 1, to?: AudioNode): void {
  v.tone('sine', A3, { t, g: scaled(env, k), to });
  v.tone('sine', A3 + 1, { t, g: scaled(env, k * 0.8), to });
  v.tone('triangle', A3 * 2, { t, g: scaled(env, k * 0.18), to });
}

/** One pivot click of the compass: a dry, very short band-passed tick and a tiny steel ping. */
function pivotClick(v: Voice, t: number, g: number, f: number, to?: AudioNode): void {
  v.noise('white', { t, g: perc(g, 0.005, 0.0002), to: v.filt('bandpass', f, 2.2, { to }) });
  v.tone('sine', f * 0.62, { t, g: perc(g * 0.2, 0.03, 0.0004), to });
}

/** The pierce ring: a thin steel string on A6 beating against 1767 Hz, with its upper partials. */
function pierceRing(v: Voice, t: number, g: number, dec: number, to?: AudioNode): void {
  v.tone('sine', A6, { t, g: perc(g, dec, 0.0006), to });
  v.tone('sine', A6 + 7, { t, g: perc(g * 0.8, dec, 0.0006), to });
  v.tone('sine', A6 * 2.02, { t, g: perc(g * 0.3, dec * 0.5, 0.0006), to });
  v.tone('sine', A6 * 3.1, { t, g: perc(g * 0.12, dec * 0.25, 0.0006), to });
}

export const V3_POLAR_NEEDLE_RECIPES = {
  /** Summon: the needle falls point-first out of the sky — a falling steel whistle with the air it cuts. */
  polarNeedleDrop: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.25,
    play(v) {
      const D = 0.3;
      const w = v.tone('sine', [[0, 3520], [D, 1320, 'e']], { g: [[0, 0], [0.06, 0.05], [D - 0.02, 0.07], [D + 0.02, 0.0001, 'e']] });
      v.lfo(w.osc.detune, 22, 18, { d: D + 0.03 });
      v.tone('sine', [[0, 1760], [D, 660, 'e']], { g: [[0, 0], [0.1, 0.03], [D, 0.04], [D + 0.02, 0.0001, 'e']] });
      sweep(v, 0, D + 0.02, [5200, 2600, 900], 0.1, { kind: 'pink', q: 1.8, peakAt: 0.85 });
      poleHum(v, 0.1, [[0, 0], [D - 0.1, 0.06], [D, 0.0001, 'e']]);
    },
  },
  /** Summon 'land': the point strikes the marble — "tink", a tiny body thump, the 220 hum wakes. */
  polarNeedleTip: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.35,
    play(v) {
      link(v, 3520, 0, 0.09, 0.16);
      link(v, 2640, 0.004, 0.05, 0.22);
      v.noise('white', { g: perc(0.14, 0.004, 0.0002), to: v.filt('highpass', 4200, 0.8) });
      thump(v, 0, 210, 110, 0.22, 0.07);
      needleTone(v, 0, [[0, 0], [0.02, 0.1], [0.4, 0.05], [0.8, 0.0001, 'e']]);
      poleHum(v, 0, perc(0.12, 0.45, 0.004));
    },
  },
  /**
   * Summon: two compass turns on the tip — the pivot ratchet slows down (28 → 6 clicks / s) while the needle's
   * tone pulses with each half turn and sweeps the stereo field (stopped on the lock).
   */
  polarNeedleSpin: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.25,
    play(v) {
      const D = 1.15;
      // the ratchet: click times from a decelerating rate (r(t) = 28 → 6 / s)
      let t = 0;
      let i = 0;
      while (t < D) {
        const k = t / D;
        const rate = 28 - 22 * Math.pow(k, 0.7);
        pivotClick(v, t, 0.12 * (0.75 + 0.25 * (1 - k)), i % 2 ? 4600 : 3900);
        t += 1 / rate;
        i++;
      }
      // the turning needle: its tone pulses at the half-turn rate and pans round with it
      const pan = v.panner([[0, -0.5], [0.2, 0.5], [0.42, -0.45], [0.66, 0.4], [0.9, -0.2], [D, 0.1]]);
      const am = v.ring([[0, 9], [D, 2, 'e']], { d: D + 0.1, mix: 0.7, to: pan });
      needleTone(v, 0, [[0, 0], [0.05, 0.14], [D * 0.8, 0.11], [D + 0.08, 0.0001, 'e']], 1, am);
      // the air the spear sweeps (a soft whoosh per turn, slowing)
      sweep(v, 0, 0.42, [900, 2400, 1200], 0.05, { kind: 'pink', q: 1.4, pan: [-0.6, 0.6], peakAt: 0.5 });
      sweep(v, 0.42, 0.62, [800, 2000, 900], 0.04, { kind: 'pink', q: 1.4, pan: [0.6, -0.4], peakAt: 0.5 });
      poleHum(v, 0, [[0, 0], [0.1, 0.1], [D, 0.12], [D + 0.08, 0.0001, 'e']]);
    },
  },
  /** Summon: the needle locks on the opponent — a crisp "TIK" and the 220/221 ring settling. */
  polarNeedleLock: {
    cap: 2,
    gap: 0.05,
    verb: 0.4,
    duck: 0.5,
    play(v) {
      pivotClick(v, 0, 0.32, 5200);
      pivotClick(v, 0.012, 0.16, 3600);
      clank(v, 880, 0, 0.1, 0.18, { ratio: 2.02, index: 1.6, click: 0.6 });
      needleTone(v, 0.004, [[0, 0], [0.006, 0.22], [0.25, 0.12], [0.9, 0.0001, 'e']]);
      v.tone('sine', A3 * 4, { t: 0.004, g: perc(0.04, 0.5, 0.0008) });
      poleHum(v, 0, perc(0.16, 0.7, 0.004));
      glassRain(v, { t: 0.03, d: 0.35, n: 6, g: 0.025, notes: DUST, dec: [0.04, 0.1], curve: 1.4, modes: 2 });
    },
  },
  /** Summon: the limbs open, the rose crown fans out — two light swishes and a quick pinged triad (A E C#). */
  polarNeedleUnfold: {
    cap: 1,
    gap: 0.1,
    verb: 0.4,
    duck: 0.2,
    play(v) {
      sweep(v, 0, 0.16, [1400, 3200, 1800], 0.06, { kind: 'pink', q: 1.6, pan: [0.3, -0.4] });
      sweep(v, 0.05, 0.16, [1500, 3400, 1900], 0.05, { kind: 'pink', q: 1.6, pan: [-0.3, 0.4] });
      for (const [t, m, g] of [
        [0.04, 93, 0.05],
        [0.09, 100, 0.045],
        [0.14, 97, 0.04],
      ] as const)
        link(v, midiHz(m), t, g, 0.22);
      v.noise('white', { t: 0.02, g: perc(0.05, 0.006, 0.0002), to: v.filt('bandpass', 3200, 1.5) });
    },
  },
  /** The roar: the spear raised, the field blazes — an FM whine climbing an octave over the beat, dust swirling. */
  polarNeedleRoar: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.55,
    play(v) {
      const D = 0.55;
      const w = v.tone('sine', [[0, A3 * 2], [D * 0.6, A3 * 4, 'e'], [D, A3 * 4]], { g: [[0, 0], [0.12, 0.07], [D * 0.6, 0.1], [D + 0.25, 0.0001, 'e']] });
      v.lfo(w.osc.detune, [[0, 4], [D, 11, 'e']], [[0, 6], [D, 22]], { d: D + 0.3 });
      needleTone(v, 0, [[0, 0], [0.1, 0.12], [D, 0.15], [D + 0.3, 0.0001, 'e']]);
      clank(v, 880, D * 0.6, 0.12, 0.3, { ratio: 2.02, index: 2, click: 0.8 });
      pierceRing(v, D * 0.6, 0.035, 0.5);
      poleHum(v, 0, [[0, 0], [D * 0.6, 0.2], [D + 0.3, 0.0001, 'e']]);
      glassRain(v, { t: 0.1, d: D, n: 12, g: 0.03, notes: DUST, dec: [0.03, 0.1], curve: 0.8, modes: 2 });
    },
  },
  /**
   * Strike charge: the spear drawn back level and the long locked aim — the 220 tone tightens through a
   * narrowing band, a field whine trembles above it, the family beat swells (faded at the release).
   */
  polarNeedleCharge: {
    cap: 2,
    gap: 0.1,
    verb: 0.35,
    duck: 0.25,
    play(v) {
      const D = 0.75;
      const H = D + 0.5;
      const E = H + 0.15;
      const env: Pt[] = [[0, 0], [0.12, 0.05], [D, 0.11], [H, 0.11], [E, 0.0001, 'e']];
      const bp = v.filt('bandpass', [[0, 500], [D, 1500, 'e'], [E, 1500]], [[0, 1.2], [D, 4]]);
      v.tone('sawtooth', A3, { g: env, to: bp });
      v.tone('sawtooth', A3 * 1.004, { g: scaled(env, 0.7), to: bp });
      needleTone(v, 0, [[0, 0], [D, 0.1], [H, 0.1], [E, 0.0001, 'e']]);
      poleHum(v, 0, [[0, 0], [D, 0.16], [H, 0.16], [E, 0.0001, 'e']]);
      // the aim trembles: a high whine (A5 → E6) with a quickening vibrato
      const w = v.tone('sine', [[0, 880], [D, 1320, 'e'], [E, 1320]], { g: [[0, 0], [D, 0.03], [H, 0.034], [E, 0.0001, 'e']] });
      v.lfo(w.osc.detune, [[0, 5], [H, 14, 'e']], [[0, 6], [H, 18]], { d: E });
      glassRain(v, { t: 0.05, d: D, n: 9, g: 0.026, notes: DUST, dec: [0.03, 0.08], curve: 0.6, fade: 0, modes: 2 });
    },
  },
  /** Strike: the field brackets appear either side of the target — orange left, blue right: "tş… tş". */
  polarNeedleBracket: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.2,
    play(v) {
      for (const [t, pan, f] of [
        [0, -0.7, 2900],
        [0.07, 0.7, 3300],
      ] as const) {
        const p = v.panner(pan);
        v.noise('white', { t, g: [[0, 0], [0.004, 0.12], [0.06, 0.0001, 'e']], to: v.filt('bandpass', [[0, f * 1.6], [0.06, f, 'e']], 2, { t, to: p }) });
        v.tone('sine', [[0, f * 0.3], [0.05, f * 0.4, 'e']], { t, g: perc(0.03, 0.12, 0.002), to: p });
      }
      poleHum(v, 0, perc(0.06, 0.3, 0.01));
    },
  },
  /** Strike: the brackets slam shut on the target — a crossed L / R "TŞK" with a short rising zip into it. */
  polarNeedleClamp: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.35,
    play(v) {
      sweep(v, 0, 0.09, [1800, 4200, 5200], 0.05, { kind: 'white', q: 2.4, peakAt: 0.9 });
      for (const [pan, f, dt] of [
        [-0.75, 3000, 0.085],
        [0.75, 3400, 0.09],
      ] as const) {
        const p = v.panner(pan);
        v.noise('white', { t: dt, g: perc(0.2, 0.03, 0.0003), to: v.filt('bandpass', f, 1.6, { to: p }) });
        clank(v, f * 0.4, dt, 0.06, 0.12, { ratio: 1.17, index: 1.4, click: 0, to: p });
      }
      needleTone(v, 0.09, perc(0.08, 0.3, 0.003));
      poleHum(v, 0.09, perc(0.12, 0.35, 0.003));
    },
  },
  /** Strike release: the lunge — a thin steel whistle cutting the air, rising. */
  polarNeedleLunge: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.35,
    play(v) {
      sweep(v, 0, 0.18, [1200, 6200, 3000], 0.17, { kind: 'white', q: 2.2, peakAt: 0.35 });
      v.tone('sine', [[0, A6 * 0.75], [0.1, A6 * 1.5, 'e'], [0.18, A6 * 1.4]], { g: [[0, 0], [0.03, 0.05], [0.2, 0.0001, 'e']] });
      needleTone(v, 0, perc(0.1, 0.18, 0.004));
      v.noise('white', { g: perc(0.06, 0.008, 0.0003), to: v.filt('bandpass', 2400, 1.2) });
    },
  },
  /** Strike contact: through the brackets — the pierce ring, the brackets breaking (L / R cracks), a small thud. */
  polarNeedlePierce: {
    cap: 2,
    gap: 0.05,
    verb: 0.45,
    duck: 0.6,
    play(v) {
      pierceRing(v, 0, 0.16, 0.8);
      v.noise('white', { g: perc(0.18, 0.006, 0.0002), to: v.filt('bandpass', 5200, 1.2) });
      crack(v, 0.006, 0.16, { hp: 3200, n: 2, gap: 0.012, to: v.panner(-0.6) });
      crack(v, 0.014, 0.16, { hp: 3600, n: 2, gap: 0.01, to: v.panner(0.6) });
      thump(v, 0, 170, 80, 0.24, 0.09, { drive: 1.3 });
      needleTone(v, 0, perc(0.07, 0.4, 0.003));
      poleHum(v, 0, perc(0.1, 0.45, 0.003));
      glassRain(v, { t: 0.02, d: 0.45, n: 10, g: 0.035, notes: DUST, dec: [0.04, 0.12], curve: 1.6, modes: 2 });
    },
  },
  /** Blocked: the point skids off the guard — a bent squeal sliding down, the brackets bounce away. */
  polarNeedleDeflect: {
    cap: 1,
    gap: 0.1,
    verb: 0.4,
    duck: 0.4,
    play(v) {
      v.tone('sine', [[0, A6], [0.22, A6 * 0.7, 'e']], { g: perc(0.07, 0.3, 0.001) });
      v.tone('sine', [[0, A6 + 9], [0.22, A6 * 0.69, 'e']], { g: perc(0.05, 0.3, 0.001) });
      sweep(v, 0, 0.2, [6000, 3800, 1800], 0.1, { kind: 'white', q: 3, peakAt: 0.15 });
      clank(v, 620, 0, 0.13, 0.22, { ratio: 2.4, index: 2, click: 1 });
      for (const [t, pan] of [
        [0.09, -0.7],
        [0.11, 0.7],
      ] as const)
        v.noise('white', { t, g: perc(0.07, 0.02, 0.0003), to: v.filt('bandpass', 2600, 1.6, { to: v.panner(pan) }) });
      poleHum(v, 0, perc(0.12, 0.3, 0.004));
    },
  },
  /** Death f1: an invisible force grips the needle — the beat swells and shudders, a strained steel creak. */
  polarNeedleSeize: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.45,
    play(v) {
      const D = 0.2;
      const trem = v.ring([[0, 14], [D, 30, 'e']], { d: D + 0.12, mix: 0.75 });
      v.tone('sine', 110, { g: [[0, 0], [0.03, 0.22], [D, 0.26], [D + 0.1, 0.0001, 'e']], to: trem });
      v.tone('sine', 111, { g: [[0, 0], [0.03, 0.2], [D, 0.24], [D + 0.1, 0.0001, 'e']], to: trem });
      needleTone(v, 0, [[0, 0], [0.02, 0.12], [D, 0.14], [D + 0.08, 0.0001, 'e']]);
      // the creak: a slow FM squeal on a bent metal
      const c = v.tone('sawtooth', [[0, 300], [D, 360, 'e']], { g: [[0, 0], [0.04, 0.05], [D, 0.06], [D + 0.05, 0.0001, 'e']], to: v.filt('bandpass', 1300, 5) });
      v.lfo(c.osc.detune, 38, 40, { d: D + 0.06 });
      clank(v, 520, 0, 0.1, 0.18, { ratio: 1.17, index: 1.8, click: 0.6 });
    },
  },
  /** Death f2: ripped out of the shell — "şvuup": a rising tear with the needle's tone torn up two octaves. */
  polarNeedleRip: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.55,
    play(v) {
      sweep(v, 0, 0.26, [380, 2600, 6000], 0.22, { kind: 'pink', q: 1.5, peakAt: 0.4 });
      v.tone('sine', [[0, A3], [0.24, A3 * 6, 'e']], { g: [[0, 0], [0.02, 0.14], [0.2, 0.08], [0.3, 0.0001, 'e']] });
      v.tone('triangle', [[0, A3 * 0.5], [0.2, A3 * 2, 'e']], { g: [[0, 0], [0.02, 0.1], [0.24, 0.0001, 'e']] });
      // the shell lets go: a short metal tear
      crack(v, 0.01, 0.2, { hp: 1800, lp: 8000, n: 3, gap: 0.014, dec: 0.016 });
      clank(v, 400, 0.01, 0.16, 0.22, { ratio: 1.41, index: 2.6, click: 1 });
      thump(v, 0, 140, 60, 0.3, 0.12, { drive: 1.3 });
    },
  },
  /** Death 'dissolve': the needle spins away madly off the screen — a whirl quickening, rising and receding. */
  polarNeedleWhirl: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    duck: 0.4,
    play(v) {
      const D = 0.7;
      const pan = v.panner([[0, 0], [D, -0.55]]);
      const am = v.ring([[0, 9], [D, 26, 'e']], { d: D + 0.05, mix: 0.9, to: pan });
      const bp = v.filt('bandpass', [[0, 1400], [D, 3600, 'e']], 2.2, { to: am });
      v.noise('pink', { g: [[0, 0], [0.04, 0.2], [D * 0.5, 0.11], [D, 0.0001, 'e']], to: bp });
      v.tone('sine', [[0, A3 * 4], [D, A3 * 6, 'e']], { g: [[0, 0], [0.04, 0.05], [D, 0.0001, 'e']], to: am });
      needleTone(v, 0, [[0, 0], [0.03, 0.06], [D * 0.6, 0.0001, 'e']], 1, am);
    },
  },
  /** Death: a magnetite plate drops onto the marble (a dull stone-metal clack and a tiny bounce). */
  polarNeedlePlate: {
    cap: 3,
    gap: 0.03,
    verb: 0.3,
    play(v) {
      clank(v, 760, 0, 0.1, 0.12, { ratio: 1.17, index: 1.6, click: 1.4 });
      thump(v, 0, 190, 90, 0.2, 0.06);
      puff(v, 0, 0.08, 0.1, 1400);
      link(v, 2200, 0.05, 0.02, 0.05);
    },
  },
  /** Death burst: the shell settles — plates clatter, the spear rings flat twice, the hum dies, dust falls. */
  polarNeedleBurst: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    duck: 0.35,
    play(v) {
      const hits = [0, 0.05, 0.12, 0.2, 0.31];
      hits.forEach((t, i) => clank(v, 700 + ((i * 173) % 260), t, 0.09 * (1 - i * 0.13), 0.12, { ratio: 1.17, index: 1.6, click: 1.3 }));
      thump(v, 0, 130, 55, 0.26, 0.16, { drive: 1.2 });
      // the spear lies down: its pierce ring twice, softer
      pierceRing(v, 0.08, 0.03, 0.25);
      pierceRing(v, 0.22, 0.016, 0.2);
      // the field lets go: the beat sags and dies
      v.tone('sine', [[0, 110], [0.8, 74, 'e']], { g: [[0, 0], [0.02, 0.12], [0.8, 0.0001, 'e']] });
      v.tone('sine', [[0, 111], [0.8, 73, 'e']], { g: [[0, 0], [0.02, 0.1], [0.8, 0.0001, 'e']] });
      v.tone('sine', [[0, A3], [0.5, A3 * 0.7, 'e']], { g: [[0, 0], [0.02, 0.06], [0.5, 0.0001, 'e']] });
      glassRain(v, { t: 0.04, d: 0.7, n: 12, g: 0.03, notes: DUST, dec: [0.04, 0.12], curve: 1.6, modes: 2 });
    },
  },
  /** Revive: the needle whirls back down out of the sky — the whirl slows and falls, the beat swells (stopped on 'land'). */
  polarNeedleReviveGather: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.3,
    play(v) {
      const D = 0.65;
      const E = D + 0.25;
      const am = v.ring([[0, 24], [D, 7, 'e']], { d: E + 0.02, mix: 0.8, to: v.panner([[0, -0.5], [D, 0]]) });
      const bp = v.filt('bandpass', [[0, 3400], [D, 1500, 'e']], 2, { to: am });
      v.noise('pink', { g: [[0, 0], [D * 0.6, 0.12], [D, 0.15], [E, 0.0001, 'e']], to: bp });
      needleTone(v, 0, [[0, 0], [D, 0.12], [E, 0.0001, 'e']], 1, am);
      poleHum(v, 0, [[0, 0], [D, 0.18], [E, 0.0001, 'e']]);
      glassRain(v, { d: D, n: 10, g: 0.026, notes: DUST, dec: [0.03, 0.08], curve: 0.5, fade: 0, modes: 2 });
    },
  },
  /** Revive 'land': the needle seats in its shell and locks — a lighter TIK with a seat clank. */
  polarNeedleReviveLock: {
    cap: 1,
    gap: 0.1,
    verb: 0.35,
    duck: 0.4,
    play(v) {
      clank(v, 520, 0, 0.14, 0.24, { ratio: 1.41, index: 2.2, click: 1 });
      pivotClick(v, 0.03, 0.24, 5000);
      needleTone(v, 0.03, [[0, 0], [0.006, 0.16], [0.3, 0.08], [0.7, 0.0001, 'e']]);
      poleHum(v, 0, perc(0.12, 0.5, 0.004));
      thump(v, 0, 150, 70, 0.26, 0.1, { drive: 1.2 });
    },
  },
} satisfies Record<string, Recipe>;

export type PolarNeedleSfxName = keyof typeof V3_POLAR_NEEDLE_RECIPES;
