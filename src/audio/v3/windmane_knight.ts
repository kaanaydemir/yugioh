// Fırtına Şövalyesi (windmane_knight) — v3 sounds (lane F). Spread into the game through ./kart-f.ts.
// Identity: docs/v3/oturum-f/windmane_knight.md §6 + §0.1 (#1 gale not sand, #9 no thunder / lightning, #10 the
// banner snap without a low whomp), checked against docs/v3/YENI_KARTLAR.md §5.1. Built from ./kit.ts blocks and the
// Voice primitives only (no new DSP).
//
// Palette:
//   the VISOR HOWL   band-passed pink noise through two resonances on C3 / G3 (131 / 196 Hz, q ≈ 8) whose centre
//                    sways slowly (0.6 Hz): low, hollow, wind through a barred grille — never a tonal hum, never treble
//   the BANNER SNAP  "ŞAK": a hard broadband crack (hp 1.5 kHz) + a 2–3 kHz horsehair "whssh"; no low cloth whomp
//   PLATE            bright storm-steel: FM clank on 330 Hz with the 3.5 ratio + a detuned 2.03 partial (never the
//                    titan's 2.76, the magus' 1.41 or the fencer's 2.4) + ALWAYS the hollow helm ring on C3 (131 Hz):
//                    the empty-helm resonance is the identity
//   the GALE         band-limited air (300–900 Hz) with a hair whisper on top; never grain ticks (sand belongs to the
//                    hourglass), never a full-band L→R sweep (S4)
//   the BOOM         the storm contact: a pressure thump 70 → 38 Hz + a brown pressure puff + a long pink hiss tail —
//                    no bright pre-crack (it is not thunder: judgment_bolt / volt_lizard own those)
// Sustained recipes (charges, the gale front, the gathers) are written longer than their picture; the cinematics stop
// them on the mark that ends it (src/cinematics/kart-f/windmane_knight.ts).

import type { Recipe } from '../sounds';
import type { CharacterSounds } from '../../cinematics/_v3/sound';
import { perc, type Pt, type Voice } from '../synth';
import { crack, link, puff, scaled, sweep, thump } from './kit';

const C3 = 130.81;
const G3 = 196.0;
const C4 = 261.63;

/**
 * The visor howl: pink noise through two narrow band-passes (f1, f2: Hz or envelopes), the centres swaying
 * ±`sway` (fraction) at 0.6 Hz; `env` the level envelope.
 */
function howl(v: Voice, t: number, env: readonly Pt[], f1: number | readonly Pt[], f2: number | readonly Pt[], o: { q?: number; sway?: number; to?: AudioNode } = {}): void {
  const d = env[env.length - 1][0];
  const q = o.q ?? 8;
  const sum = v.amp(1, { t, to: o.to });
  for (const [f, g] of [
    [f1, 1],
    [f2, 0.62],
  ] as const) {
    const bp = v.filt('bandpass', f, q, { t, to: sum });
    const base = typeof f === 'number' ? f : f[0][1];
    v.lfo(bp.frequency, 0.6, base * (o.sway ?? 0.06), { t, d });
    v.noise('pink', { t, d, g: scaled(env, g * 13), to: bp });
  }
}

/** The banner snap "ŞAK": one hard broadband crack + a short horsehair whssh (2–3 kHz). No low whomp. */
function bannerSnap(v: Voice, t: number, g: number, o: { to?: AudioNode } = {}): void {
  crack(v, t, g, { hp: 1500, lp: 9000, n: 1, dec: 0.016, to: o.to });
  crack(v, t + 0.006, g * 0.45, { hp: 2400, lp: 7000, n: 1, dec: 0.01, to: o.to });
  sweep(v, t + 0.004, 0.09, [3200, 2400, 1900], g * 0.32, { q: 2.4, kind: 'white', peakAt: 0.15, to: o.to });
}

/**
 * The empty helm's resonance (the knight's own layer, in EVERY plate hit — round 2 #6): a hollow C3 "oo" — a sine on C3
 * with a narrow band of pink noise around it (q 12: air in a closed metal bucket) and a faint 3rd partial (G4).
 */
function helmRing(v: Voice, t: number, g: number, dec: number, o: { to?: AudioNode } = {}): void {
  v.tone('sine', C3, { t, g: perc(g, dec, 0.003), to: o.to });
  v.tone('sine', C3 * 3.01, { t, g: perc(g * 0.18, dec * 0.45, 0.002), to: o.to });
  v.noise('pink', { t, g: perc(g * 2.6, dec * 0.8, 0.004), to: v.filt('bandpass', C3, 12, { t, to: o.to }) });
}

/**
 * The plate's own ring (round 2 #6: off shield_titan's 2.76 and the slice's generic metal layer): a bright FM clank on
 * ~330 Hz with the 3.5 ratio, a detuned partial on 2.03 × f (the "storm-steel" shimmer, no 2.76 partial at all), a
 * short click, and ALWAYS the hollow C3 helm ring (`helm` scales it; default 0.35).
 */
function plate(v: Voice, t: number, g: number, dec: number, o: { f?: number; helm?: number; helmDec?: number; to?: AudioNode } = {}): void {
  const f = o.f ?? 330;
  v.bell(f, { t, g, dec, ratio: 3.5, index: 2.2, idxDec: dec * 0.22, to: o.to });
  v.bell(f * 2.03, { t, g: g * 0.32, dec: dec * 0.5, ratio: 1.5, index: 0.5, detune: 14, to: o.to });
  v.noise('white', { t, g: perc(g * 1.3, 0.007, 0.0002), to: v.filt('bandpass', Math.min(9000, f * 3.6), 1.4, { t, to: o.to }) });
  helmRing(v, t + 0.002, g * (o.helm ?? 0.35), o.helmDec ?? Math.max(0.18, dec * 2), { to: o.to });
}

/** Dense horsehair crackle (the mane "frizz" of a magic blow): many tiny 3–5 kHz ticks, no lightning crack. */
function frizz(v: Voice, t: number, d: number, g: number, n: number, o: { to?: AudioNode } = {}): void {
  for (let i = 0; i < n; i++) {
    const at = t + (i / n) * d + v.r(0, d / n);
    crack(v, at, g * (1 - (i / n) * 0.6) * v.r(0.6, 1), { hp: 3000, lp: 5600, n: 1, dec: 0.004, to: o.to });
  }
}

/** Hair shred: dense 2–4 kHz ribbons — white noise chopped by a fast flutter through a falling band. */
function shred(v: Voice, t: number, d: number, g: number, o: { from?: number; to?: AudioNode } = {}): void {
  const fl = v.flutter(34, 0.6, { t, d, base: 0.45, to: o.to });
  const f0 = o.from ?? 3800;
  v.noise('white', { t, d, g: [[0, 0], [0.012, g], [d * 0.4, g * 0.6], [d, 0.0001, 'e']], to: v.filt('bandpass', [[0, f0], [d, f0 * 0.55, 'e']], 2, { t, to: fl }) });
}

/** A heavy armoured footfall: a short low thump + a dirt puff + a faint plate tick. */
function footfall(v: Voice, t: number, g: number, o: { to?: AudioNode } = {}): void {
  thump(v, t, 92, 50, g, 0.12, { to: o.to });
  puff(v, t + 0.004, g * 0.35, 0.1, 900, { kind: 'brown', to: o.to });
  plate(v, t + 0.008, g * 0.08, 0.12, { f: 360, helm: 0.25, to: o.to });
}

/** A pennon flutter bed: pink noise chopped by a fluttering gain (≈ `rate` Hz), band-limited 700–2400 Hz. */
function flutterBed(v: Voice, t: number, d: number, g: readonly Pt[], rate: number, o: { lp?: number; to?: AudioNode } = {}): void {
  const lp = v.filt('lowpass', o.lp ?? 2400, 0.9, { t, to: o.to });
  const hp = v.filt('highpass', 700, 0.8, { t, to: lp });
  const fl = v.flutter(rate, 0.5, { t, d, base: 0.5, to: hp });
  v.noise('pink', { t, d, g, to: fl });
}

/** The gale front: `dir` +1 crosses right → left (P1: from the enemy side to his back), −1 the other way. */
function galeFront(v: Voice, dir: 1 | -1): void {
  const d = 1.4;
  const pan = v.panner([[0, 0.3 * dir], [0.9, -0.3 * dir], [d, -0.35 * dir]]);
  howl(v, 0, [[0, 0], [0.12, 0.11], [0.75, 0.12], [1.05, 0.08], [d, 0.0001, 'e']], [[0, C3], [0.7, C3 * 1.06], [d, C3 * 0.97]], [[0, G3], [0.7, G3 * 1.06], [d, G3 * 0.97]], { q: 8, sway: 0.09, to: pan });
  for (let i = 0; i < 3; i++) sweep(v, 0.02 + i * 0.3, 0.36, [320, 760 + i * 60, 420], 0.3 - i * 0.03, { kind: 'pink', q: 1.8, peakAt: 0.4, to: pan });
  sweep(v, 0, d, [300, 700, 420], 0.18, { kind: 'pink', q: 2, peakAt: 0.4, to: pan });
  // the horsehair whisper riding the front (2.6–3.4 kHz), each swell lifts it
  sweep(v, 0.06, d * 0.85, [2600, 3400, 2500], 0.27, { kind: 'white', q: 4, peakAt: 0.45, to: pan });
  for (let i = 0; i < 3; i++) shred(v, 0.1 + i * 0.3, 0.2, 0.06, { from: 3400, to: pan });
}

export const WINDMANE_KNIGHT_RECIPES = {
  // ------------------------------------------------------------------ summon
  /**
   * The gale front crossing his tile (sustained). Round 2 #5: the HOWL leads (C3 / G3 at q 8, ≈ 6 dB over the air),
   * three stepped gust swells 0.3 s apart (the billow rows' rhythm), the horsehair whisper 8 dB up so it reads, the air
   * band under them — all panned WITH the front (enemy side → his back; the P2 twin runs the other way).
   */
  wmkGaleFront: {
    cap: 2,
    gap: 0.1,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      galeFront(v, 1);
    },
  },
  /** The P2 knight's gale front (it crosses the other way). */
  wmkGaleFrontP2: {
    cap: 2,
    gap: 0.1,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      galeFront(v, -1);
    },
  },
  /** land: the lance butt driven into the tile — a dirt thump, a brown puff, a small dry tick (no creak, not S10). */
  wmkLancePlant: {
    cap: 2,
    gap: 0.08,
    verb: 0.3,
    duck: 0.55,
    play(v) {
      thump(v, 0, 120, 55, 0.62, 0.22, { drive: 0.3 });
      puff(v, 0.004, 0.22, 0.24, 900, { kind: 'brown' });
      crack(v, 0, 0.12, { hp: 1800, lp: 6000, n: 2, gap: 0.009 });
      plate(v, 0.006, 0.05, 0.18, { f: 300 });
    },
  },
  /** roar (the cut-in's eye flare): the visor howl swelling up C3→G3 / G3→C4 (0.9 s), the banner snap at its crest. */
  wmkStormHowl: {
    cap: 1,
    gap: 0.3,
    verb: 0.45,
    duck: 0.6,
    play(v) {
      howl(v, 0, [[0, 0], [0.35, 0.075], [0.72, 0.095], [0.95, 0.0001, 'e']], [[0, C3], [0.7, G3, 'e'], [0.95, G3]], [[0, G3], [0.7, C4, 'e'], [0.95, C4]], { q: 8 });
      sweep(v, 0.05, 0.85, [420, 1100, 600], 0.08, { kind: 'pink', q: 1.8, peakAt: 0.7 });
      bannerSnap(v, 0.72, 0.5);
    },
  },
  /**
   * The UNFURL (summon big beat, ŞAK — round 2 #2: the loudest knight sound of the summon, ≈ −14 dB): a 60 ms pre-whoosh
   * rising 600 → 2.4 kHz, the whip crack (two cracks 8 ms apart), a 0.4 s horsehair rush (2–4 kHz) over a short gust body
   * (≈ 400 Hz) and the howl's C3 / G3 breath behind it.
   */
  wmkManeUnfurl: {
    cap: 2,
    gap: 0.06,
    verb: 0.35,
    duck: 0.65,
    play(v) {
      sweep(v, 0, 0.065, [600, 1400, 2400], 0.55, { kind: 'white', q: 1.6, peakAt: 0.92 });
      crack(v, 0.06, 0.8, { hp: 1300, lp: 10000, n: 1, dec: 0.02 });
      crack(v, 0.068, 0.7, { hp: 1800, lp: 9000, n: 1, dec: 0.016 });
      sweep(v, 0.064, 0.42, [4000, 3000, 2000], 0.62, { kind: 'white', q: 1.3, peakAt: 0.08 });
      shred(v, 0.07, 0.36, 0.3, { from: 3800 });
      sweep(v, 0.058, 0.3, [300, 460, 340], 0.85, { kind: 'pink', q: 1.5, peakAt: 0.18 });
      howl(v, 0.05, [[0, 0], [0.04, 0.12], [0.45, 0.0001, 'e']], C3, G3, { q: 7 });
    },
  },
  /** A heavy step (the summon walk, the walk home). */
  wmkStep: {
    cap: 6,
    gap: 0.03,
    verb: 0.2,
    duck: 0.15,
    vary: 0.04,
    play(v) {
      footfall(v, 0, 0.42);
    },
  },
  // ------------------------------------------------------------------ strikes
  /** charge (normal; the declaration holds it): the howl bed on C3 + the pennon flutter (≈ 12 Hz). Sustained. */
  wmkCharge: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      const d = 2.6;
      howl(v, 0, [[0, 0], [0.25, 0.06], [d - 0.3, 0.05], [d, 0.0001, 'e']], C3, G3, { q: 6 });
      flutterBed(v, 0.05, d - 0.1, [[0, 0], [0.3, 0.15], [d - 0.4, 0.13], [d - 0.1, 0.0001, 'e']], 12);
    },
  },
  /** The storm declaration (takes the charge over): the howl rising C3 → C4 over 1.2 s, a faster flutter, gusts. Sustained. */
  wmkChargeStorm: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.4,
    play(v) {
      const d = 2.8;
      howl(v, 0, [[0, 0], [0.2, 0.07], [1.2, 0.09], [d - 0.3, 0.07], [d, 0.0001, 'e']], [[0, C3], [1.2, C4, 'e'], [d, C4]], [[0, G3], [1.2, G3 * 2, 'e'], [d, G3 * 2]], { q: 7, sway: 0.08 });
      flutterBed(v, 0.02, d - 0.1, [[0, 0], [0.2, 0.18], [1.2, 0.22], [d - 0.4, 0.18], [d - 0.1, 0.0001, 'e']], 19, { lp: 3000 });
      for (let i = 0; i < 4; i++) sweep(v, 0.25 + i * 0.5, 0.36, [380, 1000, 520], 0.08, { kind: 'pink', q: 1.6, peakAt: 0.5 });
    },
  },
  /** release (normal): the lunge — a short air sweep + two heavy footfalls. */
  wmkLunge: {
    cap: 2,
    gap: 0.05,
    verb: 0.25,
    duck: 0.35,
    play(v) {
      sweep(v, 0, 0.22, [400, 1200, 700], 0.16, { kind: 'pink', q: 1.4, peakAt: 0.6 });
      footfall(v, 0.0, 0.42);
      footfall(v, 0.11, 0.5);
    },
  },
  /** impact (normal): the lance thrust — a body thump, the plate clank (330 / 3.5 + helm ring), a dirt puff. */
  wmkThrust: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.55,
    play(v) {
      thump(v, 0, 140, 60, 0.6, 0.2, { drive: 0.4 });
      plate(v, 0.002, 0.16, 0.25);
      crack(v, 0, 0.22, { hp: 2200, lp: 8000, n: 1, dec: 0.01 });
      puff(v, 0.01, 0.12, 0.2, 1400, { kind: 'pink' });
    },
  },
  /** The double hit: a frame after the thrust the mane lashes the target's head — a whip "ŞAK" (no thump). */
  wmkLash: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      sweep(v, 0, 0.07, [1400, 3600, 2600], 0.256, { kind: 'white', q: 2.2, peakAt: 0.7 });
      crack(v, 0.06, 0.34, { hp: 1700, lp: 8500, n: 1, dec: 0.012 });
      sweep(v, 0.066, 0.12, [3000, 2200, 1500], 0.08, { kind: 'white', q: 3, peakAt: 0.1 });
    },
  },
  /** Blocked (normal): the lance skids on the guard — a short clank + a high scrape. */
  wmkBlocked: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.45,
    play(v) {
      plate(v, 0, 0.17, 0.16, { f: 345 });
      sweep(v, 0.01, 0.17, [3000, 6000, 4200], 0.07, { kind: 'white', q: 6, peakAt: 0.3 });
      thump(v, 0, 110, 70, 0.28, 0.1);
    },
  },
  // ------------------------------------------------------------------ the storm
  /**
   * Fırtına Yükü (the statChange charge; sustained): the howl audible from the first frame (≈ −20 dB in 0.15 s — round 2
   * #4), rising C3 → C4, three gusts swirling L / R, the low "VUMM" at 0.62 s.
   */
  wmkStormCharge: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.5,
    play(v) {
      const d = 1.5;
      howl(v, 0, [[0, 0], [0.12, 0.13], [0.62, 0.15], [1.1, 0.07], [d, 0.0001, 'e']], [[0, C3], [0.62, C4, 'e'], [d, C4]], [[0, G3], [0.62, G3 * 2, 'e'], [d, G3 * 2]], { q: 8, sway: 0.1 });
      sweep(v, 0, 0.3, [500, 1200, 700], 0.22, { kind: 'pink', q: 1.6, peakAt: 0.35 });
      for (let i = 0; i < 3; i++) sweep(v, 0.04 + i * 0.17, 0.26, [360, 900 + i * 120, 520], 0.16, { kind: 'pink', q: 1.8, peakAt: 0.6, pan: i % 2 ? [0.3, -0.3] : [-0.3, 0.3] });
      thump(v, 0.62, 70, 45, 0.55, 0.42, { drive: 0.4 });
      puff(v, 0.62, 0.12, 0.4, 700, { kind: 'brown' });
    },
  },
  /**
   * The release of Fırtına Yükü (round 2 #4: its own beat, never the summon's unfurl): the howl jumps to C4, the "zing"
   * of hair strands pulled taut (a stepped saw-like noise band 2 → 4 kHz), a hard snap, a gust body.
   */
  wmkBladeTaut: {
    cap: 1,
    gap: 0.1,
    verb: 0.35,
    duck: 0.6,
    play(v) {
      howl(v, 0, [[0, 0.05], [0.03, 0.15], [0.5, 0.0001, 'e']], [[0, G3], [0.03, C4], [0.5, C4]], [[0, C4], [0.03, G3 * 2], [0.5, G3 * 2]], { q: 9 });
      // the zing: a narrow band climbing in four whole steps (2 → 4 kHz), chopped like a saw
      const steps: [number, number][] = [[0, 2000], [0.035, 2000], [0.036, 2500], [0.07, 2500], [0.071, 3100], [0.105, 3100], [0.106, 3900], [0.15, 3900]];
      const saw = v.flutter(90, 0.7, { d: 0.16, base: 0.5 });
      v.noise('white', { g: [[0, 0], [0.01, 0.42], [0.14, 0.55], [0.16, 0.0001, 'e']], to: v.filt('bandpass', steps, 9, { to: saw }) });
      crack(v, 0.15, 0.85, { hp: 1500, lp: 9500, n: 2, gap: 0.006, dec: 0.016 });
      sweep(v, 0.15, 0.32, [320, 520, 360], 0.7, { kind: 'pink', q: 1.5, peakAt: 0.2 });
      sweep(v, 0.152, 0.3, [3600, 2800, 2000], 0.25, { kind: 'white', q: 1.6, peakAt: 0.1 });
    },
  },
  /** The +500 chip (round 2 #4: the knight's own tick instead of the UI lpUp): a small bright plate tick + its helm ring. */
  wmkStormTick: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    duck: 0.2,
    play(v) {
      plate(v, 0, 0.12, 0.14, { f: 520, helm: 0.6, helmDec: 0.3 });
      link(v, 3120, 0.01, 0.035, 0.09);
    },
  },
  /** The storm launch: a brown pressure puff + an air sweep along the glide. */
  wmkStormRelease: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.6,
    play(v) {
      puff(v, 0, 0.6, 0.4, 1200, { kind: 'brown' });
      sweep(v, 0, 0.32, [200, 1200, 700], 0.4, { kind: 'pink', q: 1.3, peakAt: 0.7 });
      sweep(v, 0.03, 0.28, [2200, 3400, 2400], 0.07, { kind: 'white', q: 3, peakAt: 0.6 });
    },
  },
  /**
   * The storm contact, the GALE BOOM — a pressure "WHUMPF" (round 2 #3, no longer impactHeavy's shape): a short sub
   * (0.25 s), then a loud 0.6 s gale rush through the howl resonances sweeping C4 → G3, the hair shred (2–4 kHz
   * ribbons), the plate clank with the helm ring. No bright pre-crack (it is not thunder).
   */
  wmkGaleBoom: {
    cap: 1,
    gap: 0.1,
    verb: 0.45,
    duck: 0.75,
    play(v) {
      thump(v, 0, 72, 42, 0.62, 0.25, { drive: 0.4, att: 0.004 });
      puff(v, 0, 0.3, 0.22, 900, { kind: 'brown', att: 0.006 });
      howl(v, 0.02, [[0, 0], [0.04, 0.2], [0.3, 0.15], [0.62, 0.0001, 'e']], [[0, C4], [0.6, G3, 'e']], [[0, G3 * 2], [0.6, C4, 'e']], { q: 5, sway: 0.05 });
      sweep(v, 0.02, 0.62, [1000, 700, 380], 0.62, { kind: 'pink', q: 1.3, peakAt: 0.12 });
      shred(v, 0.03, 0.46, 0.32, { from: 4000 });
      plate(v, 0.004, 0.13, 0.26, { helm: 0.7, helmDec: 0.45 });
    },
  },
  /** The storm blocked: the gale splits around the guard — two air sweeps panned apart + a thump. */
  wmkStormSplit: {
    cap: 1,
    gap: 0.1,
    verb: 0.4,
    duck: 0.55,
    play(v) {
      thump(v, 0, 100, 52, 0.5, 0.24, { drive: 0.3 });
      plate(v, 0.002, 0.12, 0.2, { f: 345 });
      sweep(v, 0.02, 0.42, [500, 1500, 700], 0.13, { kind: 'pink', q: 1.5, peakAt: 0.3, pan: [-0.1, -0.7] });
      sweep(v, 0.04, 0.42, [520, 1400, 650], 0.13, { kind: 'pink', q: 1.5, peakAt: 0.3, pan: [0.1, 0.7] });
    },
  },
  /** Fırtına diner (end-phase calm): the howl falling G3 → G2 over 0.5 s, a soft settling breath. */
  wmkStormSettle: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.25,
    play(v) {
      howl(v, 0, [[0, 0.07], [0.3, 0.05], [0.6, 0.0001, 'e']], [[0, G3], [0.55, G3 / 2, 'e']], [[0, C4], [0.55, C3, 'e']], { q: 7 });
      sweep(v, 0, 0.5, [800, 500, 260], 0.15, { kind: 'pink', q: 1.4, peakAt: 0.1 });
      puff(v, 0.38, 0.125, 0.2, 700, { kind: 'brown' });
    },
  },
  // ------------------------------------------------------------------ death "Kof Zırh"
  /** deathStart: the calm — one short intake, then a cut to silence (the silence is the sound). */
  wmkCalmCut: {
    cap: 1,
    gap: 0.2,
    verb: 0.15,
    duck: 0.4,
    play(v) {
      sweep(v, 0, 0.12, [800, 560, 300], 0.35, { kind: 'pink', q: 1.6, peakAt: 0.7 });
      howl(v, 0, [[0, 0.05], [0.1, 0.06], [0.125, 0.0001, 'e']], G3, C4, { q: 6 });
    },
  },
  /** The frozen mane snaps off the crest as one rigid piece: a dry rigid crack, a stiff small knock. */
  wmkManeSnap: {
    cap: 1,
    gap: 0.1,
    verb: 0.25,
    duck: 0.35,
    play(v) {
      crack(v, 0, 0.36, { hp: 1200, lp: 7000, n: 2, gap: 0.014, dec: 0.014 });
      thump(v, 0, 210, 130, 0.2, 0.07);
    },
  },
  /** dissolve: the empty helm falls off — the plate clank and the HOLLOW helm ring (C3). */
  wmkPlateFall: {
    cap: 2,
    gap: 0.05,
    verb: 0.4,
    duck: 0.35,
    play(v) {
      plate(v, 0, 0.16, 0.4, { helm: 0.55 });
      thump(v, 0.01, 120, 70, 0.2, 0.1);
    },
  },
  /** One plate piece landing (pauldrons, cuirass): a clank on its own pitch (vary), a dull floor knock. */
  wmkPlateClank: {
    cap: 6,
    gap: 0.01,
    verb: 0.35,
    duck: 0.3,
    vary: 0.07,
    play(v) {
      plate(v, 0, 0.13, 0.26, { f: v.r(300, 380) });
      thump(v, 0.004, 110, 65, 0.22, 0.09);
    },
  },
  /** The lance topples like a felled flagpole (death f7): the falling air swish only — the knock lands on f8. */
  wmkPoleFall: {
    cap: 1,
    gap: 0.1,
    verb: 0.35,
    duck: 0.3,
    play(v) {
      sweep(v, 0, 0.18, [500, 900, 300], 0.14, { kind: 'pink', q: 1.6, peakAt: 0.8 });
    },
  },
  /** The lance shaft hits the floor (death f8, the frame it lies flat — round 2 #8): the wooden knock, a bounce, its ring. */
  wmkPoleKnock: {
    cap: 1,
    gap: 0.1,
    verb: 0.35,
    duck: 0.4,
    play(v) {
      thump(v, 0, 150, 80, 0.42, 0.12, { drive: 0.2 });
      crack(v, 0, 0.08, { hp: 900, lp: 3500, n: 1, dec: 0.02 });
      thump(v, 0.1, 140, 90, 0.14, 0.08);
      link(v, 2200, 0.002, 0.03, 0.12);
    },
  },
  /**
   * The ending (round 2 #8: the card's own last image): an empty greave tips over and lands on its side — "tunk": a
   * dull hollow knock and the hollow C3 ring of an empty boot (≈ −18 dB). `vary` makes the second greave its own.
   */
  wmkGreaveTip: {
    cap: 2,
    gap: 0.05,
    verb: 0.4,
    duck: 0.35,
    vary: 0.05,
    play(v) {
      thump(v, 0, 190, 110, 0.36, 0.08);
      plate(v, 0.002, 0.07, 0.16, { f: 280, helm: 2.4, helmDec: 0.55 });
      puff(v, 0.004, 0.08, 0.12, 900, { kind: 'brown' });
    },
  },
  /** The pennon lands last, flat: a soft cloth flop (no low whomp), a tiny tick of its ring. */
  wmkPennonFlop: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      puff(v, 0, 0.208, 0.12, 1300, { kind: 'pink', att: 0.01 });
      thump(v, 0.005, 75, 48, 0.16, 0.1);
      link(v, 2600, 0.01, 0.02, 0.08);
    },
  },
  /** The pile goes out: horsehair fibres let go (a dry, falling air) + plate glints, after the greaves lie. */
  wmkHollowBurst: {
    cap: 1,
    gap: 0.1,
    verb: 0.45,
    duck: 0.45,
    play(v) {
      sweep(v, 0, 0.5, [2400, 1300, 500], 0.3, { kind: 'pink', q: 1.1, peakAt: 0.1 });
      for (let i = 0; i < 4; i++) link(v, 2900 + i * 260 + v.r(-60, 60), 0.03 + i * 0.07, 0.04 * (1 - i * 0.15), 0.1);
      plate(v, 0, 0.09, 0.3, { f: 300, helm: 0.6 });
    },
  },
  // ------------------------------------------------------------------ revive
  /** reviveGather (sustained; round 2 #10 +8 dB): the pieces climb back — the howl fading in from nothing, rising air. */
  wmkReviveGather: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    duck: 0.3,
    play(v) {
      const d = 1.6;
      howl(v, 0, [[0, 0], [0.2, 0.06], [d * 0.8, 0.12], [d, 0.0001, 'e']], [[0, C3 / 2], [d, C3, 'e']], [[0, G3 / 2], [d, G3, 'e']], { q: 7 });
      sweep(v, 0, d, [260, 760, 900], 0.36, { kind: 'pink', q: 1.6, peakAt: 0.85 });
    },
  },
  /** One plate piece seating back on the boots (revive f1 / f3 / f5, via atFrame): a small tick + the helm ring. */
  wmkReviveTick: {
    cap: 3,
    gap: 0.04,
    verb: 0.35,
    duck: 0.2,
    vary: 0.06,
    play(v) {
      plate(v, 0, 0.11, 0.16, { f: 340, helm: 0.6 });
      thump(v, 0.003, 150, 95, 0.12, 0.06);
    },
  },
  /** reviveLand — the wind returns (round 2 #10): the summon's unfurl whip, reduced — the howl swells in, the full banner snap. */
  wmkReviveLand: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.55,
    play(v) {
      howl(v, 0, [[0, 0.03], [0.06, 0.12], [0.7, 0.0001, 'e']], C3, G3, { q: 8 });
      sweep(v, 0, 0.06, [700, 1500, 2300], 0.4, { kind: 'white', q: 1.6, peakAt: 0.9 });
      bannerSnap(v, 0.055, 1);
      sweep(v, 0.06, 0.36, [3800, 2900, 2000], 0.4, { kind: 'white', q: 1.3, peakAt: 0.08 });
      sweep(v, 0.05, 0.3, [320, 460, 340], 0.6, { kind: 'pink', q: 1.5, peakAt: 0.2 });
    },
  },
  // ------------------------------------------------------------------ struck body (round 2 #1: CharacterSounds.struck)
  /** Struck, light: the plate clank + the hollow C3 helm ring + a short horsehair whssh. */
  wmkStruck: {
    cap: 2,
    gap: 0.03,
    verb: 0.3,
    duck: 0.4,
    play(v) {
      thump(v, 0, 150, 85, 0.36, 0.09);
      plate(v, 0.001, 0.2, 0.22, { f: 340, helm: 0.9, helmDec: 0.32 });
      sweep(v, 0.02, 0.12, [3000, 2500, 1900], 0.16, { kind: 'white', q: 2.4, peakAt: 0.2 });
    },
  },
  /** Struck, heavy / lethal: a lower thump (110 → 60), the plate, a long helm ring (0.5 s) and the pennon's flop. */
  wmkStruckHeavy: {
    cap: 2,
    gap: 0.03,
    verb: 0.35,
    duck: 0.55,
    play(v) {
      thump(v, 0, 110, 60, 0.6, 0.2, { drive: 0.3 });
      plate(v, 0.001, 0.22, 0.3, { f: 310, helm: 1.1, helmDec: 0.5 });
      sweep(v, 0.02, 0.16, [2800, 2300, 1700], 0.18, { kind: 'white', q: 2.4, peakAt: 0.2 });
      puff(v, 0.08, 0.18, 0.12, 1300, { kind: 'pink', att: 0.01 });
      link(v, 2600, 0.085, 0.02, 0.07);
    },
  },
  /** Struck by a spell: the mane FRIZZ — dense 3–5 kHz hair crackle (no lightning crack) — over a muted clank. */
  wmkStruckMagic: {
    cap: 2,
    gap: 0.03,
    verb: 0.35,
    duck: 0.4,
    play(v) {
      frizz(v, 0, 0.26, 0.34, 26);
      sweep(v, 0, 0.28, [4800, 4000, 3000], 0.14, { kind: 'white', q: 3, peakAt: 0.15 });
      plate(v, 0.004, 0.08, 0.16, { f: 320, helm: 0.8 });
    },
  },
  /** A guarded blow: the lance shaft's wood + the plate — a braced "tunk", no low thump. */
  wmkGuardClang: {
    cap: 2,
    gap: 0.03,
    verb: 0.3,
    duck: 0.4,
    play(v) {
      thump(v, 0, 420, 300, 0.32, 0.05);
      v.noise('pink', { g: perc(0.5, 0.05, 0.001), to: v.filt('bandpass', 880, 3, {}) });
      plate(v, 0.002, 0.16, 0.2, { f: 360, helm: 0.6 });
    },
  },
  // ------------------------------------------------------------------ the cut-in, answered (round 2 #2)
  /** The band's whoosh → a gale gust built from the howl (C3 / G3) and a 300–900 Hz rush. */
  wmkCutGust: {
    cap: 1,
    gap: 0.1,
    verb: 0.35,
    duck: 0.4,
    play(v) {
      howl(v, 0, [[0, 0], [0.12, 0.1], [0.35, 0.07], [0.55, 0.0001, 'e']], [[0, C3], [0.5, G3, 'e']], [[0, G3], [0.5, C4, 'e']], { q: 8 });
      sweep(v, 0, 0.5, [300, 900, 500], 0.4, { kind: 'pink', q: 1.5, peakAt: 0.35 });
      sweep(v, 0.05, 0.4, [2600, 3300, 2400], 0.12, { kind: 'white', q: 4, peakAt: 0.4 });
    },
  },
  /** The band's card slam → a deep plate clank with the helm ring (no generic impact under it). */
  wmkCutClank: {
    cap: 1,
    gap: 0.1,
    verb: 0.4,
    duck: 0.5,
    play(v) {
      thump(v, 0, 96, 55, 0.5, 0.2, { drive: 0.3 });
      plate(v, 0.001, 0.2, 0.4, { f: 220, helm: 1, helmDec: 0.6 });
    },
  },
} satisfies Record<string, Recipe>;

export type WindmaneKnightSfxName = keyof typeof WINDMANE_KNIGHT_RECIPES;

/** The card's character voice (CHARACTER_SOUNDS entry); shipped with its strike + death cinematics. */
export const WINDMANE_KNIGHT_VOICE: CharacterSounds | null = {
  roar: 'wmkStormHowl',
  arrive: 'wmkGaleFront',
  land: 'wmkLancePlant',
  charge: 'wmkCharge',
  release: 'wmkLunge',
  impact: 'wmkThrust',
  deathStart: 'wmkCalmCut',
  dissolve: 'wmkPlateFall',
  afterDissolve: [
    [-1, 'wmkManeSnap', 0.9],
    [1, 'wmkPlateClank', 0.85],
    [2, 'wmkPlateClank', 0.75],
    [3, 'wmkPoleFall', 0.9],
    [4, 'wmkPoleKnock', 0.9],
    [5, 'wmkPennonFlop', 0.85],
  ],
  burst: 'wmkHollowBurst',
  reviveGather: 'wmkReviveGather',
  reviveLand: 'wmkReviveLand',
  struck: { light: 'wmkStruck', heavy: 'wmkStruckHeavy', magic: 'wmkStruckMagic', guard: 'wmkGuardClang' },
};
