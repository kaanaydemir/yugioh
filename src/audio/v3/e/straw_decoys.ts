// Lane E sounds — straw_decoys (docs/v3/YENI_KARTLAR.md §5.1, §7). Owned by this card's builder: add recipes here only.
// Names are prefixed 'e_' + a short card key (e.g. e_wellCrank) so no name collides with another lane.
// Built from ./../kit.ts blocks and the Voice primitives (src/audio/synth.ts). Aggregated by ../lane-e.ts.
//
// Identity (§5.1 S9 Saman Korkuluk): the main colour is a LONG DRY STRAW RUSTLE, the material straw + a wooden stake,
// the separating layers the stake's dry "tok" (three pitches) and a DISTANT CROW "gak" (FM + formants). Kept apart
// from: S5 Harman Eleği (a straw rustle ≤ 0.3 s above 4 kHz — ours is long, 1.5–5 kHz, flutters at ~22 Hz), C6 Kovuk
// Devi (the 180 Hz hollow-log knock — our stakes are solid dry hardwood, a 1.0–1.6 kHz woodblock, no hollow ring), S1 Kova (the
// 330 Hz ratchet), R3 Tüy Hayalet (the only "pof": no lowpassed soft puff anywhere here — the storyboard says so).
//   e_strawGust    the card's energy bursts into a dusk gust over the empty zones: a breath of wind + straw in it
//   e_strawDrop    one stake drops out of the sky: a short falling "fsst" (played on each stake's fall)
//   e_strawTok1/2/3  the stake stabs into the tile: a dry hardwood "tok" + the ground taking it (C6 / E6 / G6 woodblock)
//   e_strawWrap    straw bundles wind round the stakes: the long straw rustle (the card's main colour)
//   e_strawCoat    an old coat drops on and snaps tight: "fwup-ŞAK" (cloth flap + snap)
//   e_strawHead    the sack head and hat drop onto the stake: a burlap crunch + a dry wooden seat
//   e_strawArms    the crossbar arms spread: a wooden creak rising + two straw flicks at the hands
//   e_strawEye     button eyes light: two tiny bright "tik"s (one per eye)
//   e_strawCrow    a distant crow: "gaak … gak" (FM-roughened saw through crow formants, far away)
//   e_strawLure    the attacker's pick: the chosen decoy's straw shivers, its stake creaks, an eye ticks

import type { Recipe } from '../../sounds';
import type { Voice } from '../../synth';
import { perc } from '../../synth';
import { sweep, thump } from '../kit';

/** The stake's voice: a dry hardwood "tok" at `f` (Hz) — solid, short, no hollow ring — and the ground taking it. */
function tok(v: Voice, t: number, f: number, g: number): void {
  // the strike: a hard, bright snap through a high wooden band (the point punching the tile)
  v.noise('white', { t, g: perc(g * 1.4, 0.008, 0.0002), to: v.filt('bandpass', f * 2.6, 1.8) });
  // the stake's body: a woodblock pair (fundamental + a strong 2.76 × partial), short; no hollow ring
  v.tone('triangle', [[0, f * 1.08], [0.018, f, 'e']], { t, g: perc(g * 0.5, 0.05, 0.0006) });
  v.tone('sine', f * 2.76, { t, g: perc(g * 0.42, 0.035, 0.0005) });
  v.tone('sine', f * 0.5, { t, g: perc(g * 0.3, 0.03, 0.0005) });
  // the ground takes it: a low thud and a gritty crunch of earth under it, then two grains of dirt
  thump(v, t + 0.004, 150, 58, g * 0.45, 0.07);
  v.noise('brown', { t: t + 0.006, g: perc(g * 0.5, 0.035, 0.001), to: v.filt('bandpass', 700, 0.9) });
  v.bursts([t + 0.03, t + 0.052], [g * 0.1, g * 0.07], { dec: 0.006, f: 2600, q: 1.6 });
}

/** A run of dry straw: band-passed white noise fluttering at `rate` (fibres rubbing), `d` seconds. */
function rustle(v: Voice, t: number, d: number, g: number, o: { f0?: number; f1?: number; rate?: number; q?: number } = {}): void {
  const bp = v.filt('bandpass', [[0, o.f0 ?? 2200], [d, o.f1 ?? 3400, 'e']], o.q ?? 1.3, { t });
  const fl = v.flutter(o.rate ?? 22, 0.75, { t, d, base: 0.25, to: bp });
  v.noise('white', { t, d, g: [[0, 0], [d * 0.18, g], [d * 0.7, g * 0.75], [d, 0.0001, 'e']], to: fl });
}

export const RECIPES = {
  e_strawGust: {
    cap: 1,
    gap: 0.3,
    verb: 0.42,
    duck: 0.2,
    play(v) {
      // a breath of dusk wind crossing the field (left → right), with dry straw in it
      sweep(v, 0, 0.8, [320, 1100, 520], 0.24, { q: 0.9, pan: [-0.7, 0.7], kind: 'pink', peakAt: 0.35 });
      sweep(v, 0.05, 0.7, [900, 2400, 1400], 0.07, { q: 2.2, pan: [-0.5, 0.6], peakAt: 0.4 });
      rustle(v, 0.12, 0.5, 0.06, { f0: 2600, f1: 3800, rate: 26 });
    },
  },
  e_strawDrop: {
    cap: 5,
    gap: 0.04,
    verb: 0.25,
    play(v) {
      // a stake falling point-first: a short, falling air streak ("fsst")
      sweep(v, 0, 0.13, [3200, 2200, 900], 0.2, { q: 2.5, peakAt: 0.6 });
    },
  },
  e_strawTok1: {
    cap: 3,
    gap: 0.03,
    verb: 0.3,
    play(v) {
      tok(v, 0, 1047, 0.5);
    },
  },
  e_strawTok2: {
    cap: 3,
    gap: 0.03,
    verb: 0.3,
    play(v) {
      tok(v, 0, 1319, 0.48);
    },
  },
  e_strawTok3: {
    cap: 3,
    gap: 0.03,
    verb: 0.3,
    play(v) {
      tok(v, 0, 1568, 0.46);
    },
  },
  e_strawWrap: {
    cap: 1,
    gap: 0.4,
    verb: 0.36,
    play(v) {
      // the card's main colour: a LONG, dry straw rustle — bundles wound tight round the stakes (a swell, a
      // second wind, then the last strands tucked in), fibres crackling all through it
      const d = 1.0;
      rustle(v, 0, d, 0.2, { f0: 1700, f1: 3000, rate: 22 });
      rustle(v, 0.28, 0.55, 0.12, { f0: 3200, f1: 2400, rate: 30, q: 1.8 });
      v.crackle({ t: 0.02, d: d - 0.1, n: 34, g: 0.06, f: 3600, q: 2.2, dec: 0.008, curve: 0.9 });
      // the twine pulled tight at the end: two short, rising squeaks of fibre
      v.tone('sawtooth', [[0, 820], [0.06, 1150, 'e']], { t: 0.84, g: perc(0.025, 0.06, 0.004), to: v.filt('bandpass', 1300, 3) });
      v.tone('sawtooth', [[0, 900], [0.05, 1280, 'e']], { t: 0.93, g: perc(0.022, 0.05, 0.004), to: v.filt('bandpass', 1400, 3) });
    },
  },
  e_strawCoat: {
    cap: 2,
    gap: 0.08,
    verb: 0.3,
    play(v) {
      // the old coat drops on: two cloth flaps (a mid-band whump of air in the fabric) …
      v.bursts([0, 0.07], [0.34, 0.26], { dec: [0.05, 0.04], f: 700, q: 0.9, kind: 'pink' });
      // … and SNAPS tight on the shoulders: a sharp cloth crack
      v.noise('white', { t: 0.13, g: perc(0.6, 0.016, 0.0003), to: v.filt('bandpass', 2400, 1.4) });
      v.noise('white', { t: 0.136, g: perc(0.12, 0.03, 0.0005), to: v.filt('highpass', 4200, 0.8) });
    },
  },
  e_strawHead: {
    cap: 2,
    gap: 0.08,
    verb: 0.28,
    play(v) {
      // the burlap sack lands on the stake's top: a coarse crunch of stuffed straw, then the hat seats with a dry tap
      v.crackle({ d: 0.09, n: 9, g: 0.22, f: 2900, q: 1.6, dec: 0.007, curve: 1.6 });
      v.noise('white', { g: perc(0.2, 0.04, 0.002), to: v.filt('bandpass', 1300, 1.2) });
      v.tone('triangle', [[0, 470], [0.02, 430, 'e']], { t: 0.06, g: perc(0.26, 0.03, 0.0005) });
    },
  },
  e_strawArms: {
    cap: 1,
    gap: 0.2,
    verb: 0.32,
    play(v) {
      // the crossbar swings out: a wooden creak (a slowing pulse train of friction in a rising woody band)
      const d = 0.24;
      const bp = v.filt('bandpass', [[0, 620], [d, 980, 'e']], 4);
      const fl = v.flutter(46, 0.9, { d, base: 0.08, to: bp });
      v.noise('white', { g: [[0, 0], [0.03, 0.34], [d * 0.8, 0.22], [d, 0.0001, 'e']], to: fl });
      // the straw hands flick open at both ends (left, right)
      rustle(v, 0.2, 0.12, 0.1, { f0: 3000, f1: 4200, rate: 34, q: 1.6 });
      v.bursts([0.22, 0.26], [0.08, 0.07], { dec: 0.01, f: 3800, q: 1.4 });
    },
  },
  e_strawEye: {
    cap: 6,
    gap: 0.03,
    verb: 0.35,
    play(v) {
      // two button eyes catch the light: tiny bright ticks with a glassless ping (a sewn button, not a bell)
      for (const [t, f] of [[0, 1760], [0.045, 2093]] as const) {
        v.noise('white', { t, g: perc(0.12, 0.004, 0.0002), to: v.filt('highpass', 3500, 0.8) });
        v.tone('sine', f, { t, g: perc(0.07, 0.05, 0.001) });
      }
    },
  },
  e_strawCrow: {
    cap: 1,
    gap: 0.5,
    verb: 0.6,
    play(v) {
      // a crow far over the field: "gaak … gak". A nasal saw at ~480 Hz falling, roughened by FM noise (the rasp),
      // through two crow formants (1.1 / 1.9 kHz); far: little low end, a soft top, a lot of room
      const far = v.filt('lowpass', 3600, 0.7);
      const caw = (t: number, d: number, f: number, g: number) => {
        const f1 = v.filt('bandpass', 1150, 4, { t, to: far });
        const f2 = v.filt('bandpass', 1900, 5, { t, to: far });
        const rasp = v.flutter(70, 0.55, { t, d, base: 0.55, to: f1 });
        rasp.connect(f2);
        const o = v.tone('sawtooth', [[0, f * 1.12], [d * 0.25, f], [d, f * 0.82, 'e']], { t, g: [[0, 0], [0.012, g], [d * 0.6, g * 0.7], [d, 0.0001, 'e']], to: rasp });
        // FM grit: a fast modulator on the carrier's frequency
        v.tone('sine', f * 0.5, { t, d: d + 0.02, g: [[0, f * 0.35], [d, f * 0.15]], to: o.osc.frequency });
      };
      caw(0, 0.26, 480, 0.2);
      caw(0.42, 0.17, 455, 0.15);
    },
  },
  e_strawLure: {
    cap: 1,
    gap: 0.2,
    verb: 0.32,
    play(v) {
      // the chosen decoy beckons: its straw shivers, the stake creaks once, a button eye ticks
      rustle(v, 0, 0.32, 0.14, { f0: 2000, f1: 3200, rate: 28 });
      const bp = v.filt('bandpass', [[0, 560], [0.18, 760, 'e']], 4);
      const fl = v.flutter(40, 0.9, { t: 0.06, d: 0.18, base: 0.08, to: bp });
      v.noise('white', { t: 0.06, g: [[0, 0], [0.03, 0.22], [0.18, 0.0001, 'e']], to: fl });
      v.noise('white', { t: 0.24, g: perc(0.12, 0.004, 0.0002), to: v.filt('highpass', 3500, 0.8) });
      v.tone('sine', 2093, { t: 0.24, g: perc(0.07, 0.05, 0.001) });
    },
  },
} satisfies Record<string, Recipe>;
export type Sfx = keyof typeof RECIPES;
