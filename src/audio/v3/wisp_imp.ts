// Tüy Hayalet (wisp_imp) — v3 sounds (lane B). Spread into the game through ./kart-b.ts.
// Identity: docs/v3/YENI_KARTLAR.md §5.1 R3 "5 kHz tüy · tüy · yastık 'pof' (tek 'pof' sahibi)".
// Built from ./kit.ts blocks and the Voice primitives only (no new DSP).
//
// Palette (one parameter set, clear of the slice's two characters and the lane's other three cards):
//   feathers   a 5 kHz rustle: white noise through a 4.4–5.6 kHz band, chopped by an irregular 30–70 Hz
//              flutter (vanes brushing) plus sparse 6–7 kHz quill ticks. Never the reed heron's low
//              wing "fuff" (that one sits at 600 Hz–1.5 kHz), never straw (no 2–3 kHz crunch).
//   voice      a tiny ghost: a triangle + soft saw glottis at 420–620 Hz through two formants — "uu"
//              (F1 300 Hz / F2 800 Hz) and "ö" (F1 380 / F2 1500 Hz) — with a breathy pink layer and
//              a slow, wide vibrato. "bö!" is a plosive + a quick upward-then-down "ö".
//   key        F lydian (F G A B C): the chimes (the KORUNDU bell, the pendulum hum, the revive) stay
//              off the wyrm's E-major glass and the warden's B♭ minor.
//   pillow     the ONLY "pof" in the game (§5.1): a thick low-passed pink burst with a cloth thump and
//              an airy "ff" tail, then down drifting — fired by the pillow effect only. The wind death
//              (no event) never plays it: its feathers just leave on a gust.
//
//   wiDrift      summon (sustained): one feather swings down like a pendulum — whooshing swings L/R + a hum
//   wiTouch      summon: the feather touches the tile (a tiny tick + a soft high ping + a puff of down)
//   wiFountain   summon: the feather fountain whirls up and builds the ghost (rising rustle whirl)
//   wiLand       summon 'land': the ghost settles on its float (a down cushion "fumf", feathers settle)
//   wiBoo        summon peak / roar: "bö!" (also its quieter "hu?" variant via pitch)
//   wiPuff       strike charge (sustained): it inhales and puffs to 130 % (breath + bristling feathers)
//   wiVolley     strike 'release': the sheaf of homing feather darts leaves (six staggered swishes)
//   wiImpact     strike contact: the first dart jabs in (cloth thump + tsk + feather burst)
//   wiTsk        strike: each of the micro jabs that follow (cap 8, tiny gap)
//   wiShed       strike recover: the stuck feathers flake off, the ghost deflates (a little sigh)
//   wiGust       death 'dissolve' (no event): the wind strips the feathers off — gust + rustle + whimper
//   wiAway       death: the last feathers flutter off on the wind (soft; NOT a pof)
//   wiCloud      effect: the ghost bursts into a feather cloud (bright airy whump + dense rustle)
//   wiFlock      effect (sustained): the cloud streams to the LP panel (swirling rustle, panned)
//   wiStuff      effect: the feathers pack into a pillow (two soft fabric fluffs + a seam squeak)
//   wiCatch      effect: the prevented damage hits the pillow (muffled LP thump + a springy bounce)
//   wiSafe       effect: "0 · KORUNDU" (a gold bell pair in F lydian + shimmer)
//   wiPof        effect: THE pillow pof (the game's only one)
//   wiReviveGather / wiReviveLand   soul_recall's revive pair (the wind brings the feathers back)

import type { Recipe } from '../sounds';
import type { CharacterSounds } from '../../cinematics/_v3/sound';
import { midiHz, perc, type Pt, type Voice } from '../synth';
import { puff, scaled, sweep, thump } from './kit';

// ================================================================ palette

/** F lydian, F5 … C7 (midi). */
const KEY = [77, 79, 81, 83, 84, 86, 88, 89, 91, 93, 95, 96] as const;

type Vowel = 'u' | 'o';
const FORMANTS: Record<Vowel, readonly [number, number]> = { u: [300, 800], o: [380, 1500] };

/**
 * The feather rustle: white noise through the 5 kHz band, chopped by an irregular flutter (vanes
 * brushing past each other). `env` shapes it; `f` the band centre; `rate` the flutter.
 */
function rustle(v: Voice, t: number, env: readonly Pt[], o: { f?: number; rate?: number; q?: number; pan?: number | readonly Pt[]; to?: AudioNode; fTo?: number } = {}): void {
  const d = env[env.length - 1][0];
  const out = o.pan !== undefined ? v.panner(o.pan, { t, to: o.to }) : o.to;
  const f = o.f ?? 5000;
  const bp = v.filt('bandpass', o.fTo ? [[0, f], [d, o.fTo, 'e']] : f, o.q ?? 1.4, { t, to: out });
  const hp = v.filt('highpass', 2600, 0.7, { to: bp });
  const fl = v.flutter(o.rate ?? 45, 0.55, { t, d: d + 0.02, base: 0.45, to: hp });
  v.noise('white', { t, g: env, to: fl });
}

/** Quill ticks: a sparse train of tiny 6–7 kHz clicks (single feathers flicking). */
function quills(v: Voice, t: number, d: number, n: number, g: number, o: { curve?: number; to?: AudioNode; f?: number } = {}): void {
  v.crackle({ t, d, n, g, f: o.f ?? 6400, q: 2.2, dec: 0.005, curve: o.curve ?? 1, to: o.to });
}

/**
 * The little ghost's voice: a triangle + soft saw glottis on the contour `f` (Hz at 0, d/2, d)
 * through the vowel's two formants (morphing `from` → `to`), a breathy pink layer, slow vibrato.
 */
function ghostVoice(v: Voice, t: number, d: number, f: readonly [number, number, number], g: number, o: { from?: Vowel; to?: Vowel; breath?: number; out?: AudioNode; vib?: number } = {}): void {
  const [a1, a2] = FORMANTS[o.from ?? 'u'];
  const [b1, b2] = FORMANTS[o.to ?? o.from ?? 'u'];
  const sum = v.amp(1, { t, to: o.out });
  const f1 = v.filt('bandpass', [[0, a1], [d * 0.6, b1, 'e'], [d, b1 * 0.95, 'e']], 5, { t, to: sum });
  const f2 = v.filt('bandpass', [[0, a2], [d * 0.6, b2, 'e'], [d, b2 * 0.9, 'e']], 7, { t, to: v.amp(0.55, { t, to: sum }) });
  const src = v.amp(1, { t });
  src.connect(f1);
  src.connect(f2);
  const contour: Pt[] = [[0, f[0]], [d * 0.45, f[1], 'e'], [d, f[2], 'e']];
  const env: Pt[] = [[0, 0], [Math.min(0.04, d * 0.2), g], [d * 0.6, g * 0.85], [d, 0.0001, 'e']];
  const tri = v.tone('triangle', contour, { t, g: env, to: src });
  const saw = v.tone('sawtooth', contour, { t, g: scaled(env, 0.32), to: src, detune: 6 });
  for (const o2 of [tri, saw]) v.lfo(o2.osc.detune, [[0, 4.5], [d, 6.5]], [[0, 10], [d, o.vib ?? 45]], { t, d: d + 0.02 });
  v.noise('pink', { t, g: scaled(env, (o.breath ?? 0.5) * 1.6), to: src });
}

/** One feather swing: a soft whoosh through the upper band, gliding across the stereo field. */
function swing(v: Voice, t: number, d: number, g: number, dir: 1 | -1, o: { to?: AudioNode; hi?: number } = {}): void {
  const hi = o.hi ?? 5200;
  sweep(v, t, d, [hi * 0.55, hi, hi * 0.7], g, { q: 1.3, pan: [-0.45 * dir, 0.45 * dir], peakAt: 0.5, to: o.to });
  rustle(v, t + d * 0.15, [[0, 0], [d * 0.35, g * 0.45], [d * 0.8, 0.0001, 'e']], { rate: 55, pan: 0.3 * dir, to: o.to });
}

/** A gold chime (FM bell, soft index) — the KORUNDU bell and the pendulum's glint. */
function chime(v: Voice, m: number, t: number, g: number, dec: number, o: { to?: AudioNode } = {}): void {
  v.bell(midiHz(m), { t, g, dec, ratio: 2.0, index: 0.9, idxDec: dec * 0.3, to: o.to });
  v.tone('sine', midiHz(m) * 3.01, { t, g: perc(g * 0.18, dec * 0.35, 0.001), to: o.to });
}

/** A cushion "fumf": a low-passed pink puff with a cloth body under it. */
function cushion(v: Voice, t: number, g: number, o: { lp?: number; dec?: number; f0?: number; to?: AudioNode } = {}): void {
  puff(v, t, g, o.dec ?? 0.16, o.lp ?? 1100, { kind: 'pink', att: 0.006, to: o.to });
  thump(v, t, o.f0 ?? 150, (o.f0 ?? 150) * 0.45, g * 0.55, (o.dec ?? 0.16) * 0.9, { att: 0.004, to: o.to });
}

// ================================================================ recipes

export const WISP_IMP_RECIPES = {
  /** Summon: the single feather swings down like a pendulum (sustained ≈1.5 s; stopped at the touch). */
  wiDrift: {
    cap: 1,
    gap: 0.3,
    verb: 0.5,
    duck: 0.2,
    play(v) {
      // four swings, each a little shorter, alternating sides; the hum ("vınlama") under them
      let t = 0.02;
      const swings = [0.3, 0.27, 0.24, 0.21, 0.19];
      swings.forEach((d, i) => {
        swing(v, t, d, 0.15 + i * 0.018, i % 2 ? -1 : 1);
        t += d * 0.92;
      });
      // the pendulum hum: a thin sine on C6 → A5 whose pitch bends with each swing (vibrato = the swings)
      const hum = v.tone('sine', [[0, midiHz(84)], [t, midiHz(81), 'e']], { t: 0.05, g: [[0, 0], [0.25, 0.034], [t - 0.2, 0.04], [t + 0.25, 0.0001, 'e']] });
      v.lfo(hum.osc.detune, [[0, 3.2], [t, 4.6]], 38, { t: 0.05, d: t + 0.3 });
      v.tone('sine', [[0, midiHz(96)], [t, midiHz(93), 'e']], { t: 0.1, g: [[0, 0], [0.4, 0.007], [t + 0.2, 0.0001, 'e']] });
      quills(v, 0.1, t, 9, 0.05);
    },
  },
  /** Summon: the feather's tip touches the tile — a tiny tick, a soft high ping, a puff of down. */
  wiTouch: {
    cap: 2,
    gap: 0.05,
    verb: 0.45,
    duck: 0.15,
    play(v) {
      v.noise('white', { g: perc(0.18, 0.006, 0.0003), to: v.filt('bandpass', 6800, 2.5) });
      chime(v, 93, 0.004, 0.07, 0.5);
      chime(v, 88, 0.03, 0.04, 0.4);
      puff(v, 0.01, 0.12, 0.12, 1800, { kind: 'pink' });
      rustle(v, 0.02, [[0, 0], [0.03, 0.08], [0.22, 0.0001, 'e']], { rate: 60 });
    },
  },
  /** Summon: the feather fountain whirls up and lays the ghost together (≈0.6 s rising rustle whirl). */
  wiFountain: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    duck: 0.3,
    play(v) {
      const D = 0.62;
      // the whirl: the rustle band climbs 3 → 6.5 kHz and circles the stereo field twice
      rustle(v, 0, [[0, 0], [D * 0.5, 0.22], [D * 0.9, 0.26], [D + 0.08, 0.0001, 'e']], { f: 3000, fTo: 6500, rate: 38, pan: [[0, -0.5], [D * 0.25, 0.5], [D * 0.5, -0.5], [D * 0.75, 0.5], [D, 0]] });
      // the air it pulls up: a soft rising whoosh underneath
      sweep(v, 0, D, [500, 1400, 2600], 0.12, { kind: 'pink', q: 1.1, peakAt: 0.8 });
      quills(v, 0.05, D, 24, 0.07, { curve: 0.7 });
      // a quick lydian run up as the face appears (F → B → C)
      [77, 81, 83, 84].forEach((m, i) => chime(v, m + 12, 0.18 + i * 0.09, 0.022 + i * 0.006, 0.28));
    },
  },
  /** Summon 'land': the ghost settles on its float — a down cushion "fumf" and the feathers settle. */
  wiLand: {
    cap: 2,
    gap: 0.06,
    verb: 0.35,
    duck: 0.2,
    play(v) {
      cushion(v, 0, 0.32, { lp: 900, dec: 0.2, f0: 130 });
      rustle(v, 0.03, [[0, 0], [0.04, 0.14], [0.32, 0.0001, 'e']], { rate: 50, f: 4600 });
      quills(v, 0.05, 0.35, 8, 0.045, { curve: 1.6 });
    },
  },
  /** Summon peak (and roar): "bö!" — a plosive, then a quick rising-and-falling "ö". */
  wiBoo: {
    cap: 2,
    gap: 0.1,
    verb: 0.4,
    duck: 0.4,
    play(v) {
      // the "b": a soft lip pop
      v.noise('pink', { g: perc(0.35, 0.018, 0.001), to: v.filt('lowpass', 700, 0.9) });
      thump(v, 0, 220, 120, 0.12, 0.04);
      ghostVoice(v, 0.012, 0.36, [480, 620, 410], 0.38, { from: 'u', to: 'o', breath: 0.45, vib: 55 });
      // a ghostly octave shadow, quieter, a hair late (the hollow echoes)
      ghostVoice(v, 0.03, 0.34, [960, 1240, 820], 0.08, { from: 'o', breath: 0.2 });
      // its feathers ruffle with it
      rustle(v, 0.04, [[0, 0], [0.06, 0.12], [0.35, 0.0001, 'e']], { rate: 64 });
    },
  },
  /** Strike charge (sustained ≈1.2 s, stopped on release): it inhales and puffs up to 130 %. */
  wiPuff: {
    cap: 2,
    gap: 0.1,
    verb: 0.3,
    duck: 0.2,
    play(v) {
      const D = 1.25;
      // the inhale: breath through a closing "hhuu" formant that rises with the swell
      const lp = v.filt('bandpass', [[0, 700], [D * 0.8, 2100, 'e'], [D, 1800, 'e']], 2.2);
      v.noise('pink', { g: [[0, 0], [D * 0.75, 0.26], [D, 0.16], [D + 0.1, 0.0001, 'e']], to: lp });
      // every feather bristles: the rustle grows and its flutter quickens
      rustle(v, 0.05, [[0, 0], [D * 0.8, 0.2], [D, 0.22], [D + 0.12, 0.0001, 'e']], { rate: 70, f: 4800, fTo: 5600 });
      quills(v, 0.1, D, 18, 0.06, { curve: 0.6 });
      // a held breath tone: a soft "uu" swelling up a fourth (the ghost holding its breath)
      ghostVoice(v, 0.25, D - 0.2, [430, 480, 560], 0.08, { from: 'u', breath: 0.8, vib: 25 });
    },
  },
  /** Strike 'release': the sheaf of homing feather darts leaves — six staggered high swishes + a "ffft". */
  wiVolley: {
    cap: 2,
    gap: 0.06,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      // the exhale that fires them: a quick airy "ffft"
      sweep(v, 0, 0.16, [1800, 3600, 2200], 0.5, { kind: 'pink', q: 1.2, peakAt: 0.2 });
      for (let i = 0; i < 6; i++) {
        const t = i * 0.032 + v.r(0, 0.008);
        sweep(v, t, 0.13, [4200, 8200 - i * 300, 5200], 0.26, { q: 3, pan: [-0.2 + i * 0.02, 0.3 + (i % 2) * 0.15], peakAt: 0.25 });
      }
      quills(v, 0.02, 0.2, 10, 0.06, { f: 7200 });
      thump(v, 0, 180, 120, 0.1, 0.05);
    },
  },
  /** Strike contact: the first dart jabs in — a fabric thump, a sharp "tsk" and a burst of loose down. */
  wiImpact: {
    cap: 3,
    gap: 0.04,
    verb: 0.3,
    duck: 0.45,
    play(v) {
      thump(v, 0, 190, 70, 0.4, 0.13, { drive: 1.6 });
      puff(v, 0, 0.3, 0.12, 1300, { kind: 'pink', att: 0.002 });
      // the tsk: a dry click + a short ring at 5.5 kHz
      v.noise('white', { g: perc(0.3, 0.004, 0.0002), to: v.filt('highpass', 3500, 0.8) });
      v.noise('white', { t: 0.002, g: perc(0.22, 0.03, 0.001), to: v.filt('bandpass', 5500, 8) });
      rustle(v, 0.01, [[0, 0], [0.02, 0.24], [0.3, 0.0001, 'e']], { rate: 66 });
      quills(v, 0.02, 0.3, 12, 0.08, { curve: 1.7 });
    },
  },
  /** Strike: one micro jab ("tsk") — fired for every dart after the first. */
  wiTsk: {
    cap: 8,
    gap: 0.006,
    verb: 0.2,
    duck: 0.12,
    vary: 0.1,
    play(v) {
      v.noise('white', { g: perc(0.26, 0.003, 0.0002), to: v.filt('highpass', 4000, 0.8) });
      v.noise('white', { t: 0.0015, g: perc(0.16, 0.022, 0.001), to: v.filt('bandpass', v.r(5000, 6200), 9) });
      thump(v, 0, 240, 150, 0.1, 0.035);
      rustle(v, 0.004, [[0, 0], [0.01, 0.08], [0.09, 0.0001, 'e']], { rate: 70 });
    },
  },
  /** Strike recover: the stuck feathers flake off and the ghost deflates with a little sigh. */
  wiShed: {
    cap: 2,
    gap: 0.1,
    verb: 0.4,
    duck: 0.1,
    play(v) {
      quills(v, 0, 0.7, 14, 0.06, { curve: 1.3, f: 5800 });
      rustle(v, 0, [[0, 0], [0.08, 0.08], [0.6, 0.0001, 'e']], { rate: 35, f: 4600, fTo: 3800 });
      // the deflate: a breathy falling "huu"
      ghostVoice(v, 0.06, 0.42, [520, 470, 360], 0.12, { from: 'o', to: 'u', breath: 0.9, vib: 20 });
    },
  },
  /** Death 'dissolve' (no event): the wind strips the feathers off — a gust, the rustle streaming, a whimper. */
  wiGust: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    duck: 0.35,
    play(v) {
      const D = 0.95;
      // the gust: wide pink wind swelling and passing (panned with the wind, away from the attacker)
      sweep(v, 0, D, [320, 1150, 520], 0.34, { kind: 'pink', q: 0.9, peakAt: 0.35, pan: [-0.1, 0.4] });
      sweep(v, 0.05, D * 0.8, [900, 2200, 1200], 0.12, { kind: 'white', q: 1.6, peakAt: 0.4, pan: [0, 0.45] });
      // the feathers streaming off it
      rustle(v, 0.04, [[0, 0], [D * 0.3, 0.24], [D * 0.75, 0.12], [D, 0.0001, 'e']], { rate: 52, pan: [[0, 0], [D, 0.45]] });
      quills(v, 0.05, D, 22, 0.06, { curve: 1.2 });
      // a small falling whimper "uu…" carried off
      ghostVoice(v, 0.1, 0.55, [560, 470, 330], 0.11, { from: 'u', breath: 0.7, vib: 60 });
    },
  },
  /** Death (no event): the last feathers flutter away on the wind — soft high flutter, never a pof. */
  wiAway: {
    cap: 2,
    gap: 0.1,
    verb: 0.55,
    duck: 0.1,
    play(v) {
      rustle(v, 0, [[0, 0], [0.05, 0.1], [0.55, 0.0001, 'e']], { rate: 40, f: 5600, fTo: 6800, pan: [[0, 0.1], [0.55, 0.5]] });
      quills(v, 0, 0.6, 9, 0.04, { curve: 1.5, f: 7000 });
      sweep(v, 0, 0.5, [1600, 3000, 2000], 0.05, { kind: 'pink', q: 1.4, peakAt: 0.2, pan: [0.1, 0.5] });
      chime(v, 96, 0.08, 0.012, 0.6);
    },
  },
  /** Effect: the ghost bursts into a feather cloud — a bright airy whump and a dense flutter of down. */
  wiCloud: {
    cap: 2,
    gap: 0.1,
    verb: 0.45,
    duck: 0.45,
    play(v) {
      // airy whump (higher and brighter than the pof; no low cloth body)
      sweep(v, 0, 0.22, [1200, 3800, 2400], 0.3, { kind: 'pink', q: 0.9, peakAt: 0.12 });
      rustle(v, 0, [[0, 0], [0.03, 0.34], [0.2, 0.2], [0.55, 0.0001, 'e']], { rate: 62, f: 5000 });
      quills(v, 0.01, 0.45, 26, 0.08, { curve: 1.8 });
      thump(v, 0, 260, 160, 0.1, 0.06);
      // a little startled "hu!"
      ghostVoice(v, 0.005, 0.16, [560, 680, 600], 0.14, { from: 'u', breath: 0.5 });
    },
  },
  /** Effect (sustained ≈0.8 s): the cloud streams to the LP panel — a swirling rustle sweeping across. */
  wiFlock: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.2,
    play(v) {
      const D = 0.8;
      rustle(v, 0, [[0, 0], [0.12, 0.22], [D * 0.7, 0.2], [D + 0.12, 0.0001, 'e']], { rate: 48, f: 4400, fTo: 5800 });
      // the swirl: two bands chasing each other (a whirl of wings, the doppler of the stream)
      sweep(v, 0, D, [2400, 5200, 3400], 0.09, { q: 2.4, peakAt: 0.3, pan: [-0.3, 0.3] });
      sweep(v, 0.1, D * 0.85, [3600, 6400, 4200], 0.06, { q: 3, peakAt: 0.6, pan: [0.3, -0.3] });
      sweep(v, 0, D, [400, 900, 600], 0.08, { kind: 'pink', q: 1.2, peakAt: 0.4 });
      quills(v, 0.02, D, 20, 0.05);
    },
  },
  /** Effect: the feathers pack into a pillow — two soft fabric fluffs and a tiny seam squeak. */
  wiStuff: {
    cap: 2,
    gap: 0.06,
    verb: 0.35,
    duck: 0.2,
    play(v) {
      cushion(v, 0, 0.2, { lp: 1400, dec: 0.1, f0: 180 });
      cushion(v, 0.07, 0.26, { lp: 1100, dec: 0.13, f0: 160 });
      // the seam pulls tight: a short bright squeak (B5 → C6 glide)
      v.tone('triangle', [[0, midiHz(83)], [0.06, midiHz(84), 'e']], { t: 0.1, g: perc(0.04, 0.07, 0.004), to: v.filt('bandpass', 1050, 4) });
      rustle(v, 0, [[0, 0], [0.04, 0.1], [0.2, 0.0001, 'e']], { rate: 55 });
    },
  },
  /** Effect: the prevented damage smacks into the pillow — a muffled LP thump and a springy bounce. */
  wiCatch: {
    cap: 2,
    gap: 0.06,
    verb: 0.35,
    duck: 0.55,
    play(v) {
      // the blow, muffled by the down: a deep dull thump with the top cut
      thump(v, 0, 120, 46, 0.55, 0.26, { drive: 1.4, att: 0.003 });
      puff(v, 0, 0.38, 0.2, 700, { kind: 'pink', att: 0.004 });
      // the pillow springs back: a soft damped "boing" (A4 → E5 → C5)
      const spr = v.tone('sine', [[0, midiHz(69)], [0.07, midiHz(76), 'e'], [0.3, midiHz(72), 'e']], { t: 0.04, g: [[0, 0], [0.02, 0.1], [0.32, 0.0001, 'e']] });
      v.lfo(spr.osc.detune, 11, [[0, 70], [0.3, 5]], { t: 0.04, d: 0.32 });
      rustle(v, 0.02, [[0, 0], [0.02, 0.14], [0.25, 0.0001, 'e']], { rate: 60 });
    },
  },
  /** Effect: "0 · KORUNDU" — a gold bell pair in F lydian and a little shimmer of quills. */
  wiSafe: {
    cap: 2,
    gap: 0.1,
    verb: 0.55,
    duck: 0.35,
    play(v) {
      chime(v, 84, 0, 0.14, 1.1);
      chime(v, 89, 0.09, 0.12, 1.2);
      chime(v, 95, 0.2, 0.06, 0.9); // the lydian B — the "safe!" sparkle
      chime(v, 101, 0.24, 0.03, 0.7);
      quills(v, 0.18, 0.5, 10, 0.03, { f: 7600 });
    },
  },
  /** Effect: THE pillow pof — the only "pof" in the game. A thick low burst, a cloth body, an airy tail, down drifting. */
  wiPof: {
    cap: 2,
    gap: 0.1,
    verb: 0.45,
    duck: 0.6,
    play(v) {
      // the "p": a soft plosive pop
      v.noise('white', { g: perc(0.22, 0.004, 0.0003), to: v.filt('bandpass', 2400, 1.4) });
      // the "o": a thick, round burst of air from the bursting pillow (pink, low-passed, closing)
      puff(v, 0.002, 0.7, 0.22, 950, { kind: 'pink', att: 0.005 });
      puff(v, 0.004, 0.35, 0.12, 2200, { kind: 'pink', att: 0.003 });
      thump(v, 0.002, 160, 58, 0.42, 0.17, { att: 0.004 });
      // the "f": the air hisses out
      sweep(v, 0.03, 0.28, [1600, 1100, 700], 0.14, { kind: 'pink', q: 1, peakAt: 0.15 });
      // and the down drifts out of it
      rustle(v, 0.05, [[0, 0], [0.06, 0.18], [0.7, 0.0001, 'e']], { rate: 42, f: 5200, fTo: 4600 });
      quills(v, 0.06, 0.8, 18, 0.05, { curve: 1.5 });
    },
  },
  /** Revive (sustained, stopped on 'land'): the wind turns round and brings the feathers back. */
  wiReviveGather: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    duck: 0.3,
    play(v) {
      const D = 0.75;
      // the wind blowing BACK (from the right toward the ghost), swelling into it
      sweep(v, 0, D, [500, 900, 1500], 0.25, { kind: 'pink', q: 1, peakAt: 0.85, pan: [0.45, 0] });
      rustle(v, 0, [[0, 0], [D * 0.85, 0.24], [D + 0.08, 0.0001, 'e']], { rate: 45, f: 4200, fTo: 5600, pan: [[0, 0.4], [D, 0]] });
      quills(v, 0, D, 20, 0.06, { curve: 0.5 });
      [77, 81, 84, 88].forEach((m, i) => chime(v, m, 0.2 + i * 0.12, 0.02 + i * 0.006, 0.4));
    },
  },
  /** Revive 'land': the feathers lie in, it takes its first breath — a down "fumf" and a tiny "hu?". */
  wiReviveLand: {
    cap: 2,
    gap: 0.1,
    verb: 0.4,
    duck: 0.3,
    play(v) {
      cushion(v, 0, 0.3, { lp: 1000, dec: 0.18, f0: 140 });
      ghostVoice(v, 0.08, 0.28, [430, 560, 600], 0.22, { from: 'u', to: 'o', breath: 0.6, vib: 30 });
      chime(v, 89, 0.08, 0.05, 0.7);
      rustle(v, 0.02, [[0, 0], [0.04, 0.1], [0.3, 0.0001, 'e']], { rate: 50 });
    },
  },
} satisfies Record<string, Recipe>;

export type WispImpSfxName = keyof typeof WISP_IMP_RECIPES;

/** The card's character voice (CHARACTER_SOUNDS entry). */
export const WISP_IMP_VOICE: CharacterSounds | null = {
  roar: 'wiBoo',
  arrive: 'wiDrift',
  land: 'wiLand',
  charge: 'wiPuff',
  release: 'wiVolley',
  impact: 'wiImpact',
  dissolve: 'wiGust',
  burst: 'wiAway',
  reviveGather: 'wiReviveGather',
  reviveLand: 'wiReviveLand',
};

/** Keys used by the cinematics (lane-local; no shared table reads them). */
export const WISP_KEY = KEY;
