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
//   e_voidTwitch   the iris looks round (left, right): a tiny dry glass "tk-tk" (two ticks 95 ms apart)
//   e_voidGaze     the eye looks down: a deep glass tone + a descending glass shimmer (the gaze falls on the field)
//   e_voidReveal   a face-down card is seen through: a tiny high glass tick
//   e_voidSwell    (sustained) the 28 Hz swell under the rise: its audible body is the 112/168/336 Hz harmonics (small
//                  speakers), 28/56 Hz underneath; peaks at 1.5 s = the contraction (it is stopped 30 ms before)
//   e_voidRise     (sustained) the upward choir: five "aah" voices gliding up a fifth, formant filtered, no vibrato
//   e_voidSave     a guardian charm yanks its monster back: a gold snap (link pings + a bell) and a rope whip
//   e_voidThud     the saved monster lands back on its tile: a soft low thump + dust
//   e_voidTick     the pupil contracts: a DRY close tick (no reverb), two clicks 22 ms apart
//   e_voidGulp     the pull: an INWARD suction (a band FALLING into the dark, glass partials bending down) → a glass
//                  pinch + dry tick → 56→28 Hz fall (the lid's "şııııp" rises; the gulp falls: opposite gestures)
//   e_voidCard     a destroyed card lands on its graveyard: a soft glass tick (max 3 voices)
//   e_voidBlink    an eyelid blink: a soft wet "tup"
//   e_voidTink     the tear swells at the slit: a soft rising glass "tiiink" (two partials gliding up a fourth)
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
      // "şııııp": white noise through a band that opens slowly upward (narrow → wider), a long rise, a fast cut —
      // a slower, lower band than the gulp's falling suction, and no sub: the two read as opposite gestures.
      // Synced to the scene's ease-in lid (7 steps over 486 ms game time): the slit widens slowly while the band
      // whispers, the lids part fast as it peaks (0.45 s), the wet "p" lands on the last step (0.47 s ≈ 360 scene ms × 1.35)
      const d = 0.48;
      const bp = v.filt('bandpass', [[0, 480], [d, 2400, 'e']], [[0, 9], [d, 2.4, 'e']]);
      v.noise('white', { g: [[0, 0], [d * 0.55, 0.12], [d * 0.93, 0.42], [d, 0.14], [d + 0.06, 0.0001, 'e']], to: bp });
      const bp2 = v.filt('bandpass', [[0, 1400], [d, 5200, 'e']], 6);
      v.noise('white', { g: [[0, 0], [d * 0.9, 0.09], [d + 0.04, 0.0001, 'e']], to: bp2 });
      // the wet parting of the lids at the end ("p")
      thump(v, d - 0.01, 210, 120, 0.12, 0.05);
      crack(v, d, 0.06, { hp: 1200, lp: 4200, dec: 0.008 });
      // a soft glass hum under the eye as it opens (28 Hz family: 224 / 336 Hz, no sub)
      v.tone('sine', 224, { g: [[0, 0], [d, 0.05], [d + 0.5, 0.0001, 'e']] });
      v.tone('sine', 336, { g: [[0, 0], [d, 0.025], [d + 0.4, 0.0001, 'e']] });
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
    duck: 0.3,
    play(v) {
      // the 28 Hz swell (NO tremolo): only integer harmonics of 28 Hz, so nothing beats; the swell lives in the
      // amplitude and an opening lowpass. It climbs for 1.5 s (the scene starts it on the gaze; the contraction
      // falls 1.5 s later and the scene stops it 30 ms before the tick). Its AUDIBLE body is 112 / 168 / 224 / 336 Hz
      // (laptop / phone speakers imply the 28 Hz fundamental from them); 28 / 56 Hz stay underneath, lower.
      // SINES only, each partial starting a few ms after the last (an irregular stagger = scattered start phases),
      // so the partials never line up into a sharp 28 Hz pulse train (no motor buzz, no flutter); about 4 dB under
      // the first take, so the tick and the gulp — the climax — stay louder than the build-up
      const d = 1.6;
      const G = 0.42;
      const env = (g: number): [number, number, ('e' | 'l')?][] => [[0, 0], [0.4, g * G * 0.25], [1.5, g * G, 'e'], [d, 0.0001, 'e']];
      const lp = v.filt('lowpass', [[0, 260], [1.5, 1400, 'e'], [d, 300, 'e']], 0.8);
      const parts: [number, number, number, boolean][] = [
        // [harmonic of 28 Hz, gain, start offset s, through the opening lowpass]
        [1, 0.12, 0, false],
        [2, 0.09, 0.0071, false],
        [3, 0.06, 0.0163, false],
        [4, 0.2, 0.0029, true],
        [5, 0.05, 0.0217, true],
        [6, 0.13, 0.0113, true],
        [8, 0.08, 0.0191, true],
        [10, 0.03, 0.0053, true],
        [12, 0.05, 0.0137, false],
        [16, 0.028, 0.0241, false],
        [24, 0.012, 0.0089, false],
      ];
      for (const [h, g, t, filtered] of parts) {
        const e = env(g).map(([tt, gg, c]) => [Math.max(0, tt - t), gg, c] as [number, number, ('e' | 'l')?]);
        // two of the body partials drift < 0.1 Hz off (1.2 / −0.8 cents): the wave's shape keeps slowly changing
        const detune = h === 4 ? 1.2 : h === 6 ? -0.8 : 0;
        v.tone('sine', 28 * h, filtered ? { t, g: e, to: lp, detune } : { t, g: e, detune });
      }
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
      // dry and close (no reverb, no tail): two clicks of the iris' blades 22 ms apart, a hard glass knock and a
      // short low knock — about +8 dB over the first take so it reads in the gap the scene leaves before it
      v.noise('white', { g: perc(1.1, 0.005, 0.0002), to: v.filt('bandpass', 2600, 2.5) });
      v.noise('white', { t: 0.022, g: perc(0.95, 0.006, 0.0002), to: v.filt('bandpass', 3400, 2.5) });
      v.tone('sine', [[0, 2200], [0.014, 1400, 'e']], { g: perc(0.45, 0.02, 0.0003) });
      v.tone('sine', [[0, 2900], [0.012, 2000, 'e']], { t: 0.022, g: perc(0.3, 0.016, 0.0003) });
      v.tone('sine', [[0, 180], [0.035, 80, 'e']], { t: 0.02, g: perc(0.5, 0.045, 0.001) });
    },
  },
  e_voidGulp: {
    cap: 1,
    gap: 0.3,
    verb: 0.5,
    duck: 0.4,
    play(v) {
      // THE PULL (0 → 0.2 s, synced to the bodies being snapped into the pupil): an INWARD suction — a narrow noise
      // band FALLING into the dark (6 kHz → 700 Hz) and glass partials bending DOWN as they fade in (a reversed
      // glass inhale). The lid's "şııııp" rises and opens; the gulp falls and narrows: opposite gestures.
      const P = 0.2;
      [3960, 2790, 1980, 1320].forEach((f, i) =>
        v.tone('sine', [[0, f * 1.25], [P, f * 0.8, 'e']], { t: i * 0.008, g: [[0, 0], [P * 0.9, 0.06 / (1 + i * 0.4)], [P, 0.0001, 'e']] }),
      );
      const bp = v.filt('bandpass', [[0, 6000], [P, 700, 'e']], [[0, 3], [P, 12, 'e']]);
      v.noise('white', { g: [[0, 0], [P * 0.85, 0.42], [P, 0.0001, 'e']], to: bp });
      v.noise('pink', { g: [[0, 0], [P * 0.9, 0.12], [P + 0.02, 0.0001, 'e']], to: v.filt('lowpass', [[0, 2400], [P, 300, 'e']], 1) });
      // the PINCH at the pupil: a glass "tink" + a dry tick, no thump
      glassBell(v, 4700, P, 0.05, 0.4, { modes: 3 });
      glassBell(v, 3130, P + 0.012, 0.03, 0.6, { modes: 2 });
      crack(v, P, 0.12, { hp: 4000, lp: 12000, dec: 0.004 });
      // then the void drops away under it: a pure 56 → 28 Hz sine fall, its 112 → 84 Hz body, a dark glass ring
      v.tone('sine', [[0, 56], [0.5, 28, 'e']], { t: P + 0.01, g: [[0, 0], [0.03, 0.28], [0.85, 0.0001, 'e']] });
      v.tone('sine', [[0, 168], [0.3, 112, 'e']], { t: P + 0.01, g: [[0, 0], [0.02, 0.09], [0.45, 0.0001, 'e']] });
      glassBell(v, 1240, P + 0.04, 0.018, 1.3, { modes: 3 });
    },
  },
  e_voidTwitch: {
    cap: 1,
    gap: 0.2,
    verb: 0.15,
    play(v) {
      // the iris looks left, then right: two tiny dry glass ticks ("tk … tk"), the second a step higher
      [0, 0.095].forEach((t, i) => {
        glassBell(v, 3800 + i * 520, t, 0.07, 0.12, { modes: 2 });
        v.noise('white', { t, g: perc(0.5, 0.004, 0.0002), to: v.filt('bandpass', 5200 + i * 600, 4) });
      });
    },
  },
  e_voidTink: {
    cap: 1,
    gap: 0.2,
    verb: 0.55,
    play(v) {
      // the tear swells at the slit: a soft glass tone rising a fourth (the drop gathering), then it hangs
      v.tone('sine', [[0, 1760], [0.14, 2350, 'e']], { g: [[0, 0], [0.12, 0.05], [0.5, 0.0001, 'e']] });
      v.tone('sine', [[0, 3520], [0.14, 4700, 'e']], { g: [[0, 0], [0.12, 0.016], [0.35, 0.0001, 'e']] });
      glassBell(v, 2350, 0.13, 0.03, 0.5, { modes: 2 });
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
  e_voidCard: {
    cap: 3,
    gap: 0.04,
    verb: 0.3,
    vary: 0.06,
    play(v) {
      // a destroyed card lands on its graveyard while the eye blinks: a soft glass tick on a felt tap (not the
      // generic cardPlace click): a quiet high glass bell + a muted low tap
      glassBell(v, 3520, 0, 0.022, 0.3, { modes: 2 });
      v.noise('pink', { g: perc(0.12, 0.02, 0.001), to: v.filt('lowpass', 1400, 0.8) });
      v.tone('sine', [[0, 300], [0.03, 180, 'e']], { g: perc(0.1, 0.04, 0.001) });
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
