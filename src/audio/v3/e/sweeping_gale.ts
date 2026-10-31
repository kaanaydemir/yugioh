// Lane E sounds — sweeping_gale (docs/v3/YENI_KARTLAR.md §5.1, §7). Owned by this card's builder: add recipes here only.
// Names are prefixed 'e_' + a short card key (e.g. e_wellCrank) so no name collides with another lane.
// Built from ./../kit.ts blocks and the Voice primitives (src/audio/synth.ts). Aggregated by ../lane-e.ts.
//
// Identity (§5.1 S4 Süpürge Rüzgarı): the main colour is a WIDE L→R NOISE (a gale crossing the whole stereo field:
// pink + white bands opening and travelling, never a tone), the material is PAPER + LEAVES (dry paper snaps, leaf
// rustle = sparse high crackle), the separating layer is the FALLING CARDS' RECEDING WHISTLE (a thin sine whistle
// that bends down and fades as each card drops off the platform edge into the void — a doppler-like fall).
// No glass (S3), no chain, no "pof" (R3), no page-flip "fırfır" train (S11: our paper is a single dry snap).
//   e_galeStir     the hovering card stirs the air: a soft inhale (band noise rising), a few leaves ticking
//   e_galeWhirl    the whirl winds up at the row's end: a rotating whoosh (band noise swirling L/R, rising)
//   e_galeRattle   the doomed cards rattle in their slots: a dry paper chatter, accelerating
//   e_galeSweep    THE STROKE, L → R: a wide body of pink + white noise travelling across the stereo field, its
//                  band opening (300 → 2.6 kHz) then settling; a low push under its front; leaf rustle riding it
//   e_galeSweepRL  the same stroke, R → L (the mirrored sweep when player 2 casts)
//   e_galeSnap     one card torn off its slot: a dry paper SNAP (short high crack + a papery flap) — pitched per card
//   e_galeGlimpse  a face-down card flashes its face for a frame: a quick paper flip "fft" + a tiny bright tick
//   e_galeFall     a card drops off the platform edge: the RECEDING WHISTLE (sine 2.3 k → 0.6 k, fading, a little
//                  air around it), its distance in the closing lowpass
//   e_galeSnuff    the field spell's environment is snuffed like a candle: "vump" — a low pressure thud, a short
//                  breath out, a wick hiss under it
//   e_galeTail     the gale leaves over the far edge: the tail whistle (a high sine sliding down, airy noise fading)
//   e_galePile     a swept card is delivered to its graveyard: a soft paper flop + a little leaf rustle

import type { Recipe } from '../../sounds';
import type { Voice } from '../../synth';
import { perc } from '../../synth';
import { crack, puff, sweep, thump } from '../kit';

/** Leaf rustle: sparse, high, dry ticks (band-passed crackle) over `d`, optionally panned l → r. */
function rustle(v: Voice, t: number, d: number, g: number, n: number, pan?: readonly [number, number]): void {
  const out = pan ? v.panner([[0, pan[0]], [d, pan[1]]], { t }) : undefined;
  v.crackle({ t, d, n, g, f: 4800, q: 1.8, dec: 0.004, curve: 1, to: out });
}

/** The gale's body travelling across the stereo field (`pan` from → to) over `d` seconds. */
function galeBody(v: Voice, d: number, pan: readonly [number, number]): void {
  const p = v.panner([[0, pan[0]], [d * 0.5, pan[0] * 0.15 + pan[1] * 0.85], [d, pan[1], 'e']]);
  // the wide body: pink noise through a band that opens and settles (the front arriving, passing)
  const bp = v.filt('bandpass', [[0, 300], [d * 0.35, 2600, 'e'], [d, 700, 'e']], [[0, 0.7], [d * 0.35, 1.1], [d, 0.8]], { to: p });
  // gusting: the body buffets in irregular surges (a gale, not a steady hiss)
  v.noise('pink', {
    g: [[0, 0], [d * 0.12, 0.66], [d * 0.2, 0.42], [d * 0.28, 0.72], [d * 0.37, 0.48], [d * 0.45, 0.68], [d * 0.56, 0.4], [d * 0.66, 0.5], [d, 0.0001, 'e']],
    to: bp,
  });
  // the hiss on top (white, higher band), later and shorter: the bristles' edge
  const hp = v.filt('bandpass', [[0, 1800], [d * 0.4, 6200, 'e'], [d, 3000, 'e']], 1.4, { to: p });
  v.noise('white', { t: d * 0.08, g: [[0, 0], [d * 0.22, 0.34], [d * 0.3, 0.2], [d * 0.38, 0.32], [d * 0.75, 0.0001, 'e']], to: hp });
  // the low push under the front (felt, not heard as a tone)
  const lp = v.filt('lowpass', [[0, 120], [d * 0.3, 260, 'e'], [d, 90, 'e']], 0.9, { to: p });
  v.noise('brown', { g: [[0, 0], [d * 0.12, 0.24], [d * 0.5, 0.1], [d, 0.0001, 'e']], to: lp });
  thump(v, 0.02, 95, 48, 0.13, 0.2);
  // leaves and paper scraps ride the front
  rustle(v, d * 0.1, d * 0.75, 0.11, 30, pan);
}

export const RECIPES = {
  e_galeStir: {
    cap: 1,
    gap: 0.3,
    verb: 0.35,
    play(v) {
      // an inhale: soft band noise rising under the card, a couple of leaf ticks circling
      sweep(v, 0, 0.42, [500, 1500, 2300], 0.32, { kind: 'pink', q: 1.3, peakAt: 0.85, pan: [-0.3, 0.3] });
      rustle(v, 0.08, 0.32, 0.12, 9, [0.3, -0.3]);
    },
  },
  e_galeWhirl: {
    cap: 1,
    gap: 0.3,
    verb: 0.4,
    play(v) {
      // a rotating whoosh: the band swirls left / right (three turns, faster each) and rises
      const d = 0.36;
      const p = v.panner([[0, -0.5], [0.12, 0.45], [0.21, -0.4], [0.28, 0.35], [0.33, -0.25], [d, 0.1]]);
      const bp = v.filt('bandpass', [[0, 420], [d, 1900, 'e']], [[0, 2.2], [d, 1.2]], { to: p });
      v.noise('pink', { g: [[0, 0], [0.05, 0.22], [d * 0.9, 0.4], [d, 0.12]], to: bp });
      // the curl's airy whistle (a breath on a bottle neck), rising a fourth
      v.tone('sine', [[0, 880], [d, 1175, 'e']], { g: [[0, 0], [0.1, 0.012], [d, 0.02], [d + 0.06, 0.0001, 'e']], to: p });
      rustle(v, 0.04, d, 0.06, 10, [-0.4, 0.4]);
    },
  },
  e_galeRattle: {
    cap: 1,
    gap: 0.2,
    verb: 0.2,
    play(v) {
      // dry paper chatter in the slots: ticks getting denser (the wind is coming)
      const times = [0, 0.07, 0.125, 0.17, 0.205, 0.235, 0.26, 0.28, 0.297, 0.312];
      v.bursts(
        times,
        times.map((_, i) => 0.06 + i * 0.012),
        { dec: 0.007, f: 3300, q: 1.6, kind: 'white' },
      );
      v.tone('sine', [[0, 180], [0.3, 240]], { g: [[0, 0], [0.3, 0.008], [0.34, 0.0001, 'e']] });
    },
  },
  e_galeSweep: {
    cap: 1,
    gap: 0.3,
    verb: 0.45,
    duck: 0.35,
    play(v) {
      galeBody(v, 0.9, [-0.95, 0.95]);
    },
  },
  e_galeSweepRL: {
    cap: 1,
    gap: 0.3,
    verb: 0.45,
    duck: 0.35,
    play(v) {
      galeBody(v, 0.9, [0.95, -0.95]);
    },
  },
  e_galeSnap: {
    cap: 4,
    gap: 0.04,
    verb: 0.25,
    vary: 0.05,
    play(v) {
      // the card tears out of its slot: a dry high snap (two strikes) and the paper's flap
      crack(v, 0, 0.6, { hp: 1700, lp: 9000, n: 2, gap: 0.009, dec: 0.01 });
      v.bursts([0.022, 0.05, 0.07], [0.24, 0.16, 0.1], { dec: 0.012, f: 2100, q: 1.1, kind: 'white' });
      // the stiff card body (a small low knock)
      v.tone('sine', [[0, 420], [0.03, 260, 'e']], { g: perc(0.1, 0.035, 0.0006) });
    },
  },
  e_galeGlimpse: {
    cap: 3,
    gap: 0.05,
    verb: 0.3,
    play(v) {
      // "fft": a paper flip (a fast high band sweep) + a tiny bright tick on the face
      sweep(v, 0, 0.07, [2600, 5200, 3600], 0.22, { kind: 'white', q: 2.2, peakAt: 0.5 });
      v.tone('sine', [[0, 3950], [0.04, 4300]], { t: 0.03, g: perc(0.07, 0.05, 0.0005) });
    },
  },
  e_galeFall: {
    cap: 5,
    gap: 0.05,
    verb: 0.55,
    vary: 0.04,
    play(v) {
      // THE RECEDING WHISTLE: a thin sine bending down and fading as the card drops away into the void
      const d = 0.75;
      const lp = v.filt('lowpass', [[0, 9000], [d, 1400, 'e']], 0.7);
      v.tone('sine', [[0, 2350], [0.08, 2280], [d, 610, 'e']], { g: [[0, 0], [0.03, 0.07], [0.25, 0.055], [d, 0.0001, 'e']], to: lp });
      // a faint second partial (the card's edge), a little sharp: it beats as it falls
      v.tone('sine', [[0, 3540], [d, 930, 'e']], { g: [[0, 0], [0.04, 0.012], [d * 0.7, 0.0001, 'e']], to: lp });
      // the air it falls through
      sweep(v, 0, d * 0.8, [2400, 1600, 500], 0.035, { kind: 'pink', q: 1.5, peakAt: 0.15, to: lp });
    },
  },
  e_galeSnuff: {
    cap: 1,
    gap: 0.3,
    verb: 0.35,
    duck: 0.25,
    play(v) {
      // "vump": the flame's air is cut — a low pressure thud with a muffled breath out
      thump(v, 0, 105, 38, 0.6, 0.28, { drive: 1.3 });
      puff(v, 0.004, 0.32, 0.2, 700, { kind: 'brown' });
      v.tone('sine', [[0, 62], [0.25, 34, 'e']], { g: [[0, 0], [0.015, 0.22], [0.4, 0.0001, 'e']] });
      // the breath out over the wick, then the wick's tiny hiss
      sweep(v, 0.01, 0.22, [1200, 700, 300], 0.07, { kind: 'pink', q: 1, peakAt: 0.2 });
      v.noise('white', { t: 0.08, g: [[0, 0], [0.04, 0.018], [0.42, 0.0001, 'e']], to: v.filt('bandpass', 7400, 2.5) });
    },
  },
  e_galeTail: {
    cap: 1,
    gap: 0.3,
    verb: 0.6,
    play(v) {
      // the tail whistle: the gale leaves over the far edge (a high sine sliding down, air thinning out)
      const d = 0.7;
      v.tone('sine', [[0, 1650], [0.1, 1720], [d, 820, 'e']], { g: [[0, 0], [0.06, 0.05], [d, 0.0001, 'e']] });
      v.tone('sine', [[0, 2480], [d, 1230, 'e']], { g: [[0, 0], [0.08, 0.008], [d * 0.8, 0.0001, 'e']] });
      sweep(v, 0, d, [1800, 1100, 400], 0.14, { kind: 'pink', q: 1.1, peakAt: 0.12 });
      rustle(v, 0.05, 0.4, 0.035, 8);
    },
  },
  e_galePile: {
    cap: 3,
    gap: 0.06,
    verb: 0.2,
    vary: 0.05,
    play(v) {
      // a soft paper flop on the pile + two leaf ticks settling
      puff(v, 0, 0.26, 0.05, 2400, { kind: 'pink' });
      v.tone('sine', [[0, 300], [0.04, 200, 'e']], { g: perc(0.15, 0.05, 0.001) });
      v.bursts([0.05, 0.09], [0.04, 0.03], { dec: 0.005, f: 4600, q: 1.8, kind: 'white' });
    },
  },
} satisfies Record<string, Recipe>;
export type Sfx = keyof typeof RECIPES;
