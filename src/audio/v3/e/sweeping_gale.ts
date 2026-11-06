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
//   e_galeWhirl    the whirl winds up at the row's end: a PITCHED swirl (an air band chopped by an accelerating
//                  rotor, panned round) + a breathy bottle tone rising a sixth
//   e_galeLob      the leaf-green curl leaves the card for the whirl: "fwip" (a narrow band flicked up + a tick)
//   e_galeRattle   the doomed cards rattle in their slots: a dry paper chatter, accelerating
//   e_galeSweep    THE STROKE, L → R: a BROOM "shhhk" travelling across the stereo field — a scrape at its head,
//                  dense band-passed bristle grains surging in gusts, a narrow air band, a low push, leaf rustle
//   e_galeSweepRL  the same stroke, R → L (the mirrored sweep when player 2 casts)
//   e_galeSnap     one card torn off its slot: a dry paper SNAP (short high crack + a papery flap) — pitched per card
//   e_galeGlimpse  a face-down card flashes its face for a frame: a quick paper flip "fft" + a tiny bright tick
//   e_galeFall     a card drops off the platform edge: the RECEDING WHISTLE (sine 2.3 k → 0.6 k, fading, a little
//                  air around it), its distance in the closing lowpass
//   e_galeSnuff    the field spell's environment is snuffed like a candle: "vump" — a low pressure thud, a short
//                  breath out, a wick hiss under it
//   e_galeTail     the gale leaves over the far edge: an airy sigh sinking (no sine: the fall owns the whistle)
//   e_galeCarry    a little gust carries a fallen card's leaves to its graveyard: a leaf rustle on a soft breath
//   e_galePile     a swept card is delivered to its graveyard: a soft paper flop + a little leaf rustle
//   e_galeDie      Büyü Mührü negates the gale: the stirring air sinks and chokes off, the leaves drop

import type { Recipe } from '../../sounds';
import type { Voice } from '../../synth';
import { perc } from '../../synth';
import { crack, puff, sweep, thump } from '../kit';

/** Leaf rustle: sparse, high, dry ticks (band-passed crackle) over `d`, optionally panned l → r. */
function rustle(v: Voice, t: number, d: number, g: number, n: number, pan?: readonly [number, number]): void {
  const out = pan ? v.panner([[0, pan[0]], [d, pan[1]]], { t }) : undefined;
  v.crackle({ t, d, n, g, f: 4800, q: 1.8, dec: 0.004, curve: 1, to: out });
}

/**
 * The gale's body travelling across the stereo field (`pan` from → to) over `d` seconds — a BROOM stroke, not plain
 * wind. Its identity is the STIFF BRISTLES: a hard drag transient where the broom bites (a driven low-mid knock and
 * a grit scrape), then a RHYTHM of push-drag strokes — each one a burst of sparse, hard straw scratches at 5–8 kHz
 * (band-passed crackle, a short "ksh" of bright noise) over a dull 250-Hz drag of the head on stone — accelerating
 * as the gale gathers (five strokes, the third the strongest). Between strokes the air is thin: only a quiet low
 * 400-Hz breath and a low push. The 1–4 kHz band is kept nearly EMPTY on purpose: that is where a generic gust
 * (windGust, sshGustR, e_pageGust) lives, and where each card's paper snap (e_galeSnap) has to cut through.
 */
function galeBody(v: Voice, d: number, pan: readonly [number, number]): void {
  const p = v.panner([[0, pan[0]], [d * 0.5, pan[0] * 0.15 + pan[1] * 0.85], [d, pan[1], 'e']]);
  // ---- the bite: a driven low-mid knock train (the broom head hits the stone) + a short grit scrape on top
  v.bursts([0, 0.009, 0.02, 0.034], [0.75, 0.55, 0.38, 0.22], { dec: [0.026, 0.02, 0.016, 0.012], f: 340, q: 1.1, kind: 'white', drive: 2.4, to: p });
  thump(v, 0, 120, 52, 0.3, 0.14, { drive: 1.4 });
  v.crackle({ t: 0, d: 0.07, n: 26, g: 1.1, f: 6800, q: 1.4, dec: 0.004, curve: 0.5, to: p });
  // ---- the strokes: push-drag, push-drag … (start, length, strength)
  const strokes: readonly (readonly [number, number, number])[] = [
    [0.05, 0.16, 0.75],
    [0.22, 0.15, 0.9],
    [0.38, 0.14, 1.0],
    [0.53, 0.13, 0.8],
    [0.67, 0.16, 0.55],
  ];
  const hi = v.filt('highpass', 4400, 0.9, { to: v.filt('lowpass', 8600, 0.9, { to: v.filt('lowpass', 9400, 0.7, { to: p }) }) });
  const drag = v.filt('bandpass', 250, 1.3, { to: p });
  for (const [t0, len, g] of strokes) {
    const s = t0 * d / 0.9;
    const l = len * d / 0.9;
    // the straw: sparse hard scratches, densest at the stroke's middle
    v.crackle({ t: s, d: l, n: R0(28 * g), g: 1.25 * g, f: 6400, q: 1.3, dec: 0.006, curve: 1.6, to: hi });
    // the "ksh" body of the stroke: bright noise, fast in, dragged out
    v.noise('white', { t: s, g: [[0, 0], [l * 0.18, 0.2 * g], [l * 0.6, 0.12 * g], [l, 0.0001, 'e']], to: hi });
    // the head dragging on stone (dull, under the straw)
    v.noise('brown', { t: s, g: [[0, 0], [l * 0.25, 0.4 * g], [l, 0.0001, 'e']], to: drag });
  }
  // ---- the thin air between strokes and the low push under the front (felt, never the main voice)
  const bp = v.filt('bandpass', [[0, 300], [d * 0.4, 480, 'e'], [d, 320, 'e']], 1.8, { to: p });
  v.noise('pink', { g: [[0, 0], [d * 0.1, 0.04], [d * 0.6, 0.03], [d, 0.0001, 'e']], to: bp });
  const lp = v.filt('lowpass', [[0, 120], [d * 0.3, 240, 'e'], [d, 90, 'e']], 0.9, { to: p });
  v.noise('brown', { g: [[0, 0], [d * 0.12, 0.08], [d * 0.5, 0.03], [d, 0.0001, 'e']], to: lp });
  // ---- leaves ride the front (sparse, very high)
  rustle(v, d * 0.08, d * 0.78, 0.07, 18, pan);
}
const R0 = Math.round;

export const RECIPES = {
  e_galeStir: {
    cap: 1,
    gap: 0.3,
    verb: 0.35,
    play(v) {
      // an inhale: soft band noise rising under the card, a couple of leaf ticks circling
      sweep(v, 0, 0.42, [1400, 2700, 3900], 0.3, { kind: 'white', q: 1.6, peakAt: 0.85, pan: [-0.3, 0.3] });
      rustle(v, 0.08, 0.32, 0.12, 9, [0.3, -0.3]);
    },
  },
  e_galeWhirl: {
    cap: 1,
    gap: 0.3,
    verb: 0.4,
    play(v) {
      // a PITCHED rotating swirl (not the stir's inhale): a narrow air band chopped by an accelerating rotor
      // (6 → 11 → 18 → 24 Hz: three quickening turns), panned round the head, and a breath over a bottle neck
      // that rises a sixth as the curls tighten
      const d = 0.42;
      const p = v.panner([[0, -0.55], [0.13, 0.5], [0.23, -0.45], [0.3, 0.4], [0.35, -0.3], [0.39, 0.25], [d, 0.05]]);
      const rot = v.ring([[0, 6], [0.13, 11], [0.26, 18], [d, 24]], { d: d + 0.08, to: p, mix: 0.8 });
      const bp = v.filt('bandpass', [[0, 360], [d, 1000, 'e']], [[0, 3.2], [d, 2.2]], { to: rot });
      v.noise('pink', { g: [[0, 0], [0.05, 0.3], [d * 0.85, 0.55], [d, 0.2], [d + 0.07, 0.0001, 'e']], to: bp });
      // the bottle tone: a breathy narrow band and its sine core, rising 540 → 900 Hz
      const bt = v.filt('bandpass', [[0, 540], [d, 900, 'e']], 16, { to: p });
      v.noise('white', { g: [[0, 0], [0.12, 0.9], [d, 1.3], [d + 0.06, 0.0001, 'e']], to: bt });
      v.tone('sine', [[0, 540], [d, 900, 'e']], { g: [[0, 0], [0.12, 0.04], [d, 0.07], [d + 0.07, 0.0001, 'e']], to: p });
      rustle(v, 0.04, d, 0.06, 10, [-0.4, 0.4]);
    },
  },
  e_galeLob: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play(v) {
      // the leaf-green curl leaves the card: "fwip" — a quick narrow band flicked upward, a dry tick at its start
      // and a leaf flutter as it spins away
      v.bursts([0], [0.28], { dec: 0.006, f: 3400, q: 2.2, kind: 'white' });
      sweep(v, 0.004, 0.12, [420, 1700, 1150], 0.85, { kind: 'white', q: 3.4, peakAt: 0.6, pan: [-0.25, 0.3] });
      const fl = v.ring(34, { d: 0.2, mix: 0.7 });
      v.noise('pink', { t: 0.05, g: [[0, 0], [0.03, 0.12], [0.16, 0.0001, 'e']], to: v.filt('bandpass', 1900, 2, { to: fl }) });
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
        times.map((_, i) => 0.19 + i * 0.038),
        { dec: 0.007, f: 3300, q: 1.6, kind: 'white' },
      );
      v.tone('sine', [[0, 180], [0.3, 240]], { g: [[0, 0], [0.3, 0.025], [0.34, 0.0001, 'e']] });
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
      // the card tears out of its slot: a dry high SNAP (two strikes) over a 45-ms papery FLAP body at ~2 kHz
      // (driven, so it cuts through the stroke's bristle grains), and the stiff card's small knock
      crack(v, 0, 0.75, { hp: 1800, lp: 9500, n: 2, gap: 0.008, dec: 0.012 });
      v.bursts([0.003, 0.02, 0.036, 0.05, 0.064], [2.4, 1.6, 1.1, 0.7, 0.4], { dec: [0.045, 0.03, 0.022, 0.016, 0.014], f: 2000, q: 0.9, kind: 'white', drive: 2.2, trim: 0.8 });
      v.tone('sine', [[0, 480], [0.04, 240, 'e']], { g: perc(0.3, 0.045, 0.0006) });
    },
  },
  e_galeGlimpse: {
    cap: 3,
    gap: 0.05,
    verb: 0.3,
    play(v) {
      // "fft-ting": a paper flip (a fast high band sweep) and a bright double tick on the face that shows
      sweep(v, 0, 0.07, [3600, 7200, 5400], 0.6, { kind: 'white', q: 2.4, peakAt: 0.45 });
      v.tone('sine', [[0, 5200], [0.03, 5750]], { t: 0.025, g: perc(0.2, 0.05, 0.0005) });
      v.tone('sine', [[0, 7800], [0.03, 8300]], { t: 0.045, g: perc(0.09, 0.04, 0.0005) });
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
      // the gale leaves over the far edge: an airy SIGH (no whistle: the falling cards own the only whistle) —
      // a wide pink breath sinking, a thin breathy top fading first, the last leaves ticking down
      sweep(v, 0, 0.75, [1500, 850, 360], 0.26, { kind: 'pink', q: 0.75, peakAt: 0.1 });
      sweep(v, 0.03, 0.45, [3200, 2100, 1000], 0.07, { kind: 'white', q: 1.1, peakAt: 0.15 });
      rustle(v, 0.06, 0.5, 0.05, 10);
    },
  },
  e_galeCarry: {
    cap: 3,
    gap: 0.05,
    verb: 0.3,
    vary: 0.06,
    play(v) {
      // a little gust carries a fallen card's leaves to the pile: LEAFY and tick-led — four leaves tapping past
      // (bright dry ticks, each with a tiny scrape), a dense high rustle drawn across, only a whisper of air
      const pn = v.panner([[0, 0.5], [0.28, -0.5]]);
      v.bursts([0, 0.055, 0.105, 0.15, 0.2], [0.5, 0.42, 0.36, 0.3, 0.2], { dec: 0.005, f: 5600, q: 2.2, kind: 'white', to: pn });
      v.bursts([0.003, 0.058, 0.108, 0.153], [0.16, 0.14, 0.12, 0.1], { dec: 0.012, f: 3900, q: 3, kind: 'white', to: pn });
      rustle(v, 0, 0.26, 0.75, 16, [0.5, -0.5]);
      sweep(v, 0.02, 0.2, [4200, 6400, 5200], 0.05, { kind: 'white', q: 2.6, peakAt: 0.5, pan: [0.4, -0.4] });
    },
  },
  e_galePile: {
    cap: 3,
    gap: 0.06,
    verb: 0.2,
    vary: 0.05,
    play(v) {
      // a soft paper flop on the pile + two leaf ticks settling
      puff(v, 0, 0.42, 0.05, 2400, { kind: 'pink' });
      v.tone('sine', [[0, 300], [0.04, 200, 'e']], { g: perc(0.22, 0.05, 0.001) });
      v.bursts([0.05, 0.09], [0.08, 0.06], { dec: 0.005, f: 4600, q: 1.8, kind: 'white' });
    },
  },
  e_galeDie: {
    cap: 1,
    gap: 0.3,
    verb: 0.3,
    play(v) {
      // Büyü Mührü cuts the gale before it is born: the stirring air is CHOKED — a muffled breath bending down
      // (low-passed, sinking 520 → 140 Hz) and stopped short, the leaves dropping (a few low dull ticks), then a
      // dull paper slump as the card sags (a soft low knock, no air)
      const lp = v.filt('lowpass', [[0, 1400], [0.26, 380, 'e']], 0.9);
      const bp = v.filt('bandpass', [[0, 520], [0.24, 140, 'e']], 2.2, { to: lp });
      v.noise('pink', { g: [[0, 0], [0.03, 0.55], [0.2, 0.4], [0.235, 0.0001, 'e']], to: bp });
      v.tone('sine', [[0, 300], [0.24, 110, 'e']], { g: [[0, 0], [0.02, 0.05], [0.22, 0.03], [0.24, 0.0001, 'e']], to: lp });
      v.bursts([0.12, 0.19, 0.27], [0.12, 0.09, 0.06], { dec: 0.007, f: 1900, q: 2, kind: 'white' });
      thump(v, 0.3, 150, 70, 0.32, 0.09);
      puff(v, 0.3, 0.3, 0.09, 520, { kind: 'brown' });
    },
  },
} satisfies Record<string, Recipe>;
export type Sfx = keyof typeof RECIPES;
