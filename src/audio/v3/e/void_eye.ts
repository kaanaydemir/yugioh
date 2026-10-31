// Lane E sounds — void_eye (docs/v3/YENI_KARTLAR.md §5.1, §7). Owned by this card's builder: add recipes here only.
// Names are prefixed 'e_' + a short card key (e.g. e_wellCrank) so no name collides with another lane.
// Built from ./../kit.ts blocks and the Voice primitives (src/audio/synth.ts). Aggregated by ../lane-e.ts.
//
// Identity (§5.1 S3 Boşluk Gözü): the main colour is a 28 Hz SWELL (no tremolo: steady partials only, the swell is
// in the amplitude and the opening lowpass, never in an LFO), the material is void + a GLASS SURFACE (the sky is a
// pane that strains and cracks; high glass partials, glass ticks), the separating layer is the EYELID "şııııp" (a
// slowly opening band-pass noise) and the PUPIL's dry contraction tick (close, no reverb).
//   e_voidDim      the arena lights power down: a falling hum + a relay clunk far away
//   e_voidRift     the sky pane strains and tears vertically: rising glass partials beating, micro-cracks, a crack
//   e_voidLid      the lids open: "şııııp" — band-pass noise opening slowly upward, a soft wet parting at the end
//   e_voidGaze     the eye looks down: a deep glass tone + a descending glass shimmer (the gaze falls on the field)
//   e_voidReveal   a face-down card is seen through: a tiny high glass tick
//   e_voidSwell    (sustained) the 28 Hz swell under the rise: sine 28 + 56 + a lowpassed saw opening slowly
//   e_voidRise     (sustained) the upward choir: five "aah" voices gliding up a fifth, formant filtered, no vibrato
//   e_voidSave     a guardian charm yanks its monster back: a gold snap (link pings + a bell) and a rope whip
//   e_voidThud     the saved monster lands back on its tile: a soft low thump + dust
//   e_voidTick     the pupil contracts: a DRY close tick (no reverb), two clicks 22 ms apart
//   e_voidGulp     the swallow: a reverse suction swell into a deep glassy gulp
//   e_voidBlink    an eyelid blink: a soft wet "tup"
//   e_voidDrip     the single purple tear lands: a water-drop "tıp" (a fast upward blip) + a tiny ring

import type { Recipe } from '../../sounds';
import type { Voice } from '../../synth';
import { perc } from '../../synth';
import { crack, glassBell, puff, sweep, thump } from '../kit';

/** Glass partials under strain: inharmonic sines slowly bending up, two of them beating. */
function strain(v: Voice, t: number, d: number, f: number, g: number): void {
  const ratios = [1, 1.0062, 1.73, 2.41, 3.02];
  ratios.forEach((r, i) => {
    v.tone('sine', [[0, f * r], [d, f * r * 1.12, 'e']], { t: t + i * 0.012, g: [[0, 0], [d * 0.7, g / (1 + i * 0.6)], [d, 0.0001, 'e']] });
  });
}

export const RECIPES = {
  e_voidDim: {
    cap: 1,
    gap: 0.3,
    verb: 0.45,
    duck: 0.3,
    play(v) {
      // the floodlights' hum falls away (mains hum 110 → 40 Hz) under a low air sigh
      v.tone('sawtooth', [[0, 110], [0.55, 40, 'e']], { g: [[0, 0], [0.04, 0.07], [0.6, 0.0001, 'e']], to: v.filt('lowpass', [[0, 900], [0.6, 160, 'e']], 1.2) });
      v.tone('sine', [[0, 55], [0.6, 28, 'e']], { g: [[0, 0], [0.05, 0.22], [0.7, 0.0001, 'e']] });
      sweep(v, 0, 0.6, [1400, 700, 260], 0.05, { kind: 'pink', q: 1.2, peakAt: 0.25 });
      // a far relay clunk (the stadium lights switching off)
      thump(v, 0.05, 140, 70, 0.12, 0.07);
      crack(v, 0.05, 0.05, { hp: 900, lp: 3000, dec: 0.02 });
    },
  },
  e_voidRift: {
    cap: 1,
    gap: 0.3,
    verb: 0.55,
    play(v) {
      // the pane strains (high glass partials beating, rising), micro-cracks run along it, then it tears
      strain(v, 0, 0.32, 3100, 0.035);
      strain(v, 0.04, 0.3, 4650, 0.018);
      v.crackle({ t: 0.03, d: 0.28, n: 18, g: 0.12, f: 6200, q: 2.4, dec: 0.006, curve: 0.6 });
      crack(v, 0.31, 0.22, { hp: 2400, lp: 12000, n: 3, gap: 0.011, dec: 0.03 });
      glassBell(v, 2650, 0.31, 0.05, 0.9);
      // the tear's breath (the void behind the sky)
      sweep(v, 0.3, 0.4, [5200, 2400, 900], 0.04, { kind: 'white', q: 2.5, peakAt: 0.15 });
      v.tone('sine', [[0, 56], [0.4, 28, 'e']], { t: 0.3, g: [[0, 0], [0.02, 0.2], [0.55, 0.0001, 'e']] });
    },
  },
  e_voidLid: {
    cap: 1,
    gap: 0.3,
    verb: 0.4,
    play(v) {
      // "şııııp": white noise through a band that opens slowly upward (narrow → wider), a long rise, a fast cut
      const d = 0.5;
      const bp = v.filt('bandpass', [[0, 520], [d, 3800, 'e']], [[0, 9], [d, 2.2, 'e']]);
      v.noise('white', { g: [[0, 0], [d * 0.85, 0.42], [d, 0.12], [d + 0.06, 0.0001, 'e']], to: bp });
      const bp2 = v.filt('bandpass', [[0, 1600], [d, 7200, 'e']], 6);
      v.noise('white', { g: [[0, 0], [d * 0.9, 0.09], [d + 0.04, 0.0001, 'e']], to: bp2 });
      // the wet parting of the lids at the end ("p")
      thump(v, d - 0.01, 210, 120, 0.12, 0.05);
      crack(v, d, 0.06, { hp: 1200, lp: 4200, dec: 0.008 });
      // a low glass hum under the eye as it opens (28 Hz family: 56 Hz)
      v.tone('sine', 56, { g: [[0, 0], [d, 0.12], [d + 0.5, 0.0001, 'e']] });
    },
  },
  e_voidGaze: {
    cap: 1,
    gap: 0.3,
    verb: 0.6,
    duck: 0.2,
    play(v) {
      // a deep glass tone sinks onto the field + a descending shimmer of glass partials (the gaze falling)
      v.tone('sine', [[0, 84], [0.5, 56, 'e']], { g: [[0, 0], [0.05, 0.2], [0.9, 0.0001, 'e']] });
      v.tone('triangle', [[0, 168], [0.5, 112, 'e']], { g: [[0, 0], [0.05, 0.05], [0.7, 0.0001, 'e']] });
      [3520, 2960, 2490, 2090].forEach((f, i) => glassBell(v, f, 0.02 + i * 0.07, 0.03 - i * 0.004, 0.6, { modes: 3 }));
      sweep(v, 0, 0.55, [6400, 3000, 900], 0.03, { kind: 'white', q: 3, peakAt: 0.2 });
    },
  },
  e_voidReveal: {
    cap: 4,
    gap: 0.03,
    verb: 0.35,
    vary: 0.05,
    play(v) {
      glassBell(v, 4180, 0, 0.035, 0.25, { modes: 2 });
      crack(v, 0, 0.04, { hp: 5000, lp: 12000, dec: 0.004 });
    },
  },
  e_voidSwell: {
    cap: 1,
    gap: 0.3,
    verb: 0.25,
    duck: 0.35,
    play(v) {
      // the 28 Hz swell (no tremolo): steady sines, the swell is only amplitude + an opening lowpass
      const d = 2.2;
      v.tone('sine', 28, { g: [[0, 0], [d * 0.85, 0.26], [d, 0.0001, 'e']] });
      v.tone('sine', 56, { g: [[0, 0], [d * 0.85, 0.12], [d, 0.0001, 'e']] });
      const lp = v.filt('lowpass', [[0, 70], [d * 0.85, 420, 'e'], [d, 120, 'e']], 0.9);
      v.tone('sawtooth', 28, { g: [[0, 0], [d * 0.85, 0.11], [d, 0.0001, 'e']], to: lp });
      v.tone('sawtooth', 42, { g: [[0, 0], [d * 0.85, 0.04], [d, 0.0001, 'e']], to: lp });
    },
  },
  e_voidRise: {
    cap: 1,
    gap: 0.3,
    verb: 0.7,
    play(v) {
      // five "aah" voices gliding up a fifth together (A2 E3 A3 C4 E4 → ×1.5), formant filtered, NO vibrato
      const d = 1.6;
      const f1 = v.filt('bandpass', 760, 5);
      const f2 = v.filt('bandpass', 1180, 7);
      const f3 = v.filt('bandpass', 2500, 9);
      [110, 164.8, 220, 261.6, 329.6].forEach((f, i) => {
        const env: [number, number, ('e' | 'l')?][] = [[0, 0], [0.45 + i * 0.05, 0.13], [d * 0.9, 0.15], [d, 0.0001, 'e']];
        for (const to of [f1, f2, f3]) v.tone('sawtooth', [[0, f], [d, f * 1.5, 'e']], { g: env, to, detune: (i - 2) * 3 });
      });
      // a thin glass halo high above (the eye's surface)
      v.tone('sine', [[0, 1760], [d, 2640, 'e']], { g: [[0, 0], [0.6, 0.012], [d, 0.0001, 'e']] });
    },
  },
  e_voidSave: {
    cap: 2,
    gap: 0.1,
    verb: 0.4,
    play(v) {
      // the charm flares (gold bell), its tether snaps taut and whips the body down
      v.bell(1568, { g: 0.12, dec: 0.7, ratio: 2.01, index: 0.6 });
      v.bell(2093, { t: 0.03, g: 0.08, dec: 0.6, ratio: 2.01, index: 0.5 });
      [0.06, 0.09, 0.12].forEach((t, i) => v.tone('sine', 2900 + i * 230, { t, g: perc(0.09, 0.05, 0.0005) }));
      sweep(v, 0.08, 0.2, [900, 2600, 500], 0.08, { kind: 'pink', q: 2, peakAt: 0.4 });
    },
  },
  e_voidThud: {
    cap: 2,
    gap: 0.06,
    verb: 0.2,
    play(v) {
      thump(v, 0, 120, 52, 0.42, 0.16, { drive: 1.5 });
      puff(v, 0.005, 0.12, 0.18, 1400, { kind: 'brown' });
      crack(v, 0, 0.05, { hp: 600, lp: 2600, dec: 0.015 });
    },
  },
  e_voidTick: {
    cap: 2,
    gap: 0.05,
    verb: 0,
    play(v) {
      // dry and close: two tiny clicks (the iris' blades) and a short sine knock, no tail
      v.noise('white', { g: perc(0.5, 0.004, 0.0002), to: v.filt('bandpass', 2600, 3) });
      v.noise('white', { t: 0.022, g: perc(0.38, 0.005, 0.0002), to: v.filt('bandpass', 3400, 3) });
      v.tone('sine', [[0, 1900], [0.012, 1300, 'e']], { g: perc(0.18, 0.018, 0.0003) });
      v.tone('sine', [[0, 140], [0.03, 70, 'e']], { t: 0.02, g: perc(0.25, 0.04, 0.001) });
    },
  },
  e_voidGulp: {
    cap: 1,
    gap: 0.3,
    verb: 0.5,
    duck: 0.4,
    play(v) {
      // suction: noise rising and narrowing into the pupil (reverse swell), then the deep glassy gulp
      const bp = v.filt('bandpass', [[0, 300], [0.3, 2600, 'e']], [[0, 1.4], [0.3, 6, 'e']]);
      v.noise('pink', { g: [[0, 0], [0.29, 0.5], [0.31, 0.0001, 'e']], to: bp });
      v.tone('sine', [[0, 40], [0.3, 110, 'e']], { g: [[0, 0], [0.28, 0.2], [0.31, 0.0001, 'e']] });
      thump(v, 0.3, 90, 28, 0.6, 0.45, { drive: 1.4 });
      v.tone('sine', 28, { t: 0.3, g: [[0, 0], [0.02, 0.35], [0.8, 0.0001, 'e']] });
      glassBell(v, 1240, 0.3, 0.045, 1.1, { modes: 4 });
      glassBell(v, 1860, 0.32, 0.025, 0.8, { modes: 3 });
    },
  },
  e_voidBlink: {
    cap: 3,
    gap: 0.05,
    verb: 0.3,
    vary: 0.04,
    play(v) {
      // soft wet "tup": a lowpassed noise touch + a falling low sine
      v.noise('pink', { g: perc(0.34, 0.03, 0.002), to: v.filt('lowpass', 900, 1) });
      v.tone('sine', [[0, 230], [0.05, 120, 'e']], { g: perc(0.36, 0.07, 0.002) });
      crack(v, 0.004, 0.03, { hp: 1500, lp: 4000, dec: 0.006 });
    },
  },
  e_voidDrip: {
    cap: 2,
    gap: 0.1,
    verb: 0.65,
    play(v) {
      // "tıp": the drop's bubble blip (900 → 1900 Hz in 18 ms), its tiny splash, a violet ring of glass
      v.tone('sine', [[0, 900], [0.018, 1900, 'e'], [0.05, 1700, 'e']], { g: perc(0.3, 0.06, 0.0008) });
      crack(v, 0, 0.08, { hp: 2000, lp: 8000, dec: 0.01 });
      glassBell(v, 2480, 0.02, 0.025, 1.2, { modes: 3 });
      v.tone('sine', 28, { t: 0, g: [[0, 0], [0.02, 0.25], [0.6, 0.0001, 'e']] });
    },
  },
} satisfies Record<string, Recipe>;
export type Sfx = keyof typeof RECIPES;
