// Fırtına Şövalyesi (windmane_knight) — v3 sounds (lane F). Spread into the game through ./kart-f.ts.
// Identity: docs/v3/oturum-f/windmane_knight.md §6 + §0.1 (#1 gale not sand, #9 no thunder / lightning, #10 the
// banner snap without a low whomp), checked against docs/v3/YENI_KARTLAR.md §5.1. Built from ./kit.ts blocks and the
// Voice primitives only (no new DSP).
//
// Palette:
//   the VISOR HOWL   band-passed pink noise through two resonances on C3 / G3 (131 / 196 Hz, q ≈ 8) whose centre
//                    sways slowly (0.6 Hz): low, hollow, wind through a barred grille — never a tonal hum, never treble
//   the BANNER SNAP  "ŞAK": a hard broadband crack (hp 1.5 kHz) + a 2–3 kHz horsehair "whssh"; no low cloth whomp
//   PLATE            bright storm-steel: FM clank on 330 Hz with the 2.76 ratio (away from the magus' 1.41) + a
//                    hollow helm ring on C3 (131 Hz)
//   the GALE         band-limited air (300–900 Hz) with a hair whisper on top; never grain ticks (sand belongs to the
//                    hourglass), never a full-band L→R sweep (S4)
//   the BOOM         the storm contact: a pressure thump 70 → 38 Hz + a brown pressure puff + a long pink hiss tail —
//                    no bright pre-crack (it is not thunder: judgment_bolt / volt_lizard own those)
// Sustained recipes (charges, the gale front, the gathers) are written longer than their picture; the cinematics stop
// them on the mark that ends it (src/cinematics/kart-f/windmane_knight.ts).

import type { Recipe } from '../sounds';
import type { CharacterSounds } from '../../cinematics/_v3/sound';
import { perc, type Pt, type Voice } from '../synth';
import { clank, crack, link, puff, scaled, sweep, thump } from './kit';

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

/** The plate's own ring: the FM clank on ~330 Hz (ratio 2.76) and, with `helm`, the hollow C3 ring of the empty helm. */
function plate(v: Voice, t: number, g: number, dec: number, o: { f?: number; helm?: number; to?: AudioNode } = {}): void {
  clank(v, o.f ?? 330, t, g, dec, { ratio: 2.76, index: 2.4, click: 1.4, to: o.to });
  if (o.helm) v.tone('sine', C3, { t, g: perc(g * o.helm, dec * 2.2, 0.002), to: o.to });
}

/** A heavy armoured footfall: a short low thump + a dirt puff + a faint plate tick. */
function footfall(v: Voice, t: number, g: number, o: { to?: AudioNode } = {}): void {
  thump(v, t, 92, 50, g, 0.12, { to: o.to });
  puff(v, t + 0.004, g * 0.35, 0.1, 900, { kind: 'brown', to: o.to });
  clank(v, 360, t + 0.008, g * 0.08, 0.12, { ratio: 2.76, index: 1.2, click: 0.3, to: o.to });
}

/** A pennon flutter bed: pink noise chopped by a fluttering gain (≈ `rate` Hz), band-limited 700–2400 Hz. */
function flutterBed(v: Voice, t: number, d: number, g: readonly Pt[], rate: number, o: { lp?: number; to?: AudioNode } = {}): void {
  const lp = v.filt('lowpass', o.lp ?? 2400, 0.9, { t, to: o.to });
  const hp = v.filt('highpass', 700, 0.8, { t, to: lp });
  const fl = v.flutter(rate, 0.5, { t, d, base: 0.5, to: hp });
  v.noise('pink', { t, d, g, to: fl });
}

export const WINDMANE_KNIGHT_RECIPES = {
  // ------------------------------------------------------------------ summon
  /** The gale front crossing his tile (sustained; panned with the front by the cinematic). Band-limited air + hair whisper. */
  wmkGaleFront: {
    cap: 2,
    gap: 0.1,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      const d = 1.6;
      sweep(v, 0, d, [300, 900, 500], 0.66, { kind: 'pink', q: 2, peakAt: 0.4 });
      sweep(v, 0.05, d * 0.9, [520, 760, 420], 0.36, { kind: 'pink', q: 3, peakAt: 0.55 });
      // the horsehair whisper riding the front (2.6–3.4 kHz, soft)
      sweep(v, 0.1, d * 0.8, [2600, 3400, 2500], 0.105, { kind: 'white', q: 4, peakAt: 0.45 });
      howl(v, 0.15, [[0, 0], [0.5, 0.05], [1.1, 0.04], [1.45, 0.0001, 'e']], C3, G3, { q: 7 });
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
  /** The unfurl (summon big beat; the storm charge's release at 0.6): the banner snap + a grit spray of air. */
  wmkManeUnfurl: {
    cap: 2,
    gap: 0.06,
    verb: 0.35,
    duck: 0.55,
    play(v) {
      bannerSnap(v, 0, 0.62);
      sweep(v, 0.01, 0.42, [1600, 3600, 1800], 0.24, { kind: 'pink', q: 1.2, peakAt: 0.2 });
      puff(v, 0.02, 0.09, 0.25, 4000, { kind: 'pink' });
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
  /** impact (normal): the lance thrust — a body thump, the plate clank (330 / 2.76), a dirt puff. */
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
  /** Fırtına Yükü (the statChange charge; sustained): the howl rising C3 → C4, a gust swirl, the low "VUMM" at 0.62 s. */
  wmkStormCharge: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.5,
    play(v) {
      const d = 1.5;
      howl(v, 0, [[0, 0], [0.3, 0.07], [0.62, 0.1], [1.1, 0.05], [d, 0.0001, 'e']], [[0, C3], [0.62, C4, 'e'], [d, C4]], [[0, G3], [0.62, G3 * 2, 'e'], [d, G3 * 2]], { q: 8, sway: 0.1 });
      for (let i = 0; i < 3; i++) sweep(v, 0.04 + i * 0.17, 0.26, [360, 900 + i * 120, 520], 0.07, { kind: 'pink', q: 1.8, peakAt: 0.6, pan: i % 2 ? [0.3, -0.3] : [-0.3, 0.3] });
      thump(v, 0.62, 70, 45, 0.55, 0.42, { drive: 0.4 });
      puff(v, 0.62, 0.12, 0.4, 700, { kind: 'brown' });
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
  /** The storm contact, the GALE BOOM: a pressure thump 70 → 38 Hz + a brown pressure puff + a long pink hiss tail, the lance's clank. */
  wmkGaleBoom: {
    cap: 1,
    gap: 0.1,
    verb: 0.45,
    duck: 0.75,
    play(v) {
      thump(v, 0, 70, 38, 0.82, 0.6, { drive: 0.5, att: 0.004 });
      puff(v, 0, 0.36, 0.38, 1100, { kind: 'brown', att: 0.006 });
      sweep(v, 0.03, 0.62, [3000, 1500, 600], 0.14, { kind: 'pink', q: 0.9, peakAt: 0.08 });
      plate(v, 0.004, 0.13, 0.28);
      howl(v, 0.08, [[0, 0.06], [0.5, 0.0001, 'e']], [[0, C4], [0.5, G3, 'e']], [[0, G3 * 2], [0.5, C4, 'e']], { q: 6 });
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
  /** The lance topples like a felled flagpole: a falling air swish, the shaft's wooden knock, a bounce. */
  wmkPoleFall: {
    cap: 1,
    gap: 0.1,
    verb: 0.35,
    duck: 0.4,
    play(v) {
      sweep(v, 0, 0.16, [500, 900, 260], 0.08, { kind: 'pink', q: 1.6, peakAt: 0.75 });
      thump(v, 0.15, 150, 80, 0.42, 0.12, { drive: 0.2 });
      crack(v, 0.15, 0.08, { hp: 900, lp: 3500, n: 1, dec: 0.02 });
      thump(v, 0.25, 140, 90, 0.14, 0.08);
      link(v, 2200, 0.152, 0.03, 0.12);
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
  /** burst: the hollow armour comes apart for good — horsehair fibres let go (a dry, falling air) + plate glints. */
  wmkHollowBurst: {
    cap: 1,
    gap: 0.1,
    verb: 0.45,
    duck: 0.45,
    play(v) {
      sweep(v, 0, 0.5, [2400, 1300, 500], 0.18, { kind: 'pink', q: 1.1, peakAt: 0.1 });
      for (let i = 0; i < 4; i++) link(v, 2900 + i * 260 + v.r(-60, 60), 0.03 + i * 0.07, 0.024 * (1 - i * 0.15), 0.1);
      plate(v, 0, 0.07, 0.3, { f: 300, helm: 0.4 });
    },
  },
  // ------------------------------------------------------------------ revive
  /** reviveGather (sustained): the pieces climb back — the howl fading in from nothing, soft rising air. */
  wmkReviveGather: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    duck: 0.3,
    play(v) {
      const d = 1.6;
      howl(v, 0, [[0, 0], [d * 0.8, 0.05], [d, 0.0001, 'e']], [[0, C3 / 2], [d, C3, 'e']], [[0, G3 / 2], [d, G3, 'e']], { q: 7 });
      sweep(v, 0, d, [260, 760, 900], 0.15, { kind: 'pink', q: 1.6, peakAt: 0.85 });
      for (let i = 0; i < 3; i++) plate(v, 0.25 + i * 0.3, 0.035, 0.14, { f: 300 + i * 30 });
    },
  },
  /** reviveLand: the wind returns — the howl fades in on C3, a small banner snap. */
  wmkReviveLand: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.5,
    play(v) {
      howl(v, 0, [[0, 0.02], [0.2, 0.07], [0.8, 0.0001, 'e']], C3, G3, { q: 8 });
      bannerSnap(v, 0.02, 0.4);
      sweep(v, 0, 0.4, [500, 1000, 600], 0.07, { kind: 'pink', q: 1.5, peakAt: 0.3 });
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
    [5, 'wmkPennonFlop', 0.85],
  ],
  burst: 'wmkHollowBurst',
  reviveGather: 'wmkReviveGather',
  reviveLand: 'wmkReviveLand',
};
