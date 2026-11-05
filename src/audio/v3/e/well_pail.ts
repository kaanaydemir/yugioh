// Lane E sounds — well_pail (docs/v3/YENI_KARTLAR.md §5.1, §7). Owned by this card's builder: add recipes here only.
// Names are prefixed 'e_' + a short card key (e.g. e_wellCrank) so no name collides with another lane.
// Built from ./../kit.ts blocks and the Voice primitives (src/audio/synth.ts). Aggregated by ../lane-e.ts.
//
// Identity (§5.1 S1 Kuyu Kovası): the main colour is the 330 Hz WOODEN WINDLASS RATCHET (dry clicks that speed up),
// the material is wood + water, the separating layer is the water SPILLING OVER THE BUCKET'S LIP (a bright trickle
// with drops). No glass partials (crystal / Boşluk Gözü), no 180 Hz hollow-log knock (Kovuk Devi), no rope at
// 220 Hz (Zıpkıncı): the rope here is a short creak, not a pitched string.
//   e_wellStone    one course of the stone ring lands: a dry stone knock + grit (×3, pitched up per course)
//   e_wellFrame    the wooden posts and the axle drop on: two dry wood clacks (330 Hz body) + a small rattle
//   e_wellClick    one ratchet tooth of the crank: a 330 Hz wooden tick (played once per crank step, faster)
//   e_wellRope     the rope takes the weight: a short fibrous creak (pulse train through a wooden band)
//   e_wellSlosh    the full bucket breaks the surface: a gulp, sloshing water, two bubbles
//   e_wellSpill    the overflow: a liquid pour (pink 800–1500 Hz band, slow wobble) made of dense small resonant
//                  bubbles (700–2000 Hz) and drops pattering on stone — no hiss
//   e_wellCatch    the pawl catches at the top: "klak" (two clicks, a wooden thud)
//   e_wellLeap     a card leaps out like a fish: "şlap-GLOOP-fwip" (a wet slap over a deep 150–250 Hz resonant gulp,
//                  then a pitched paper flutter that follows the flight down to the hand)
//   e_wellTap      the wet card lands in the hand: a soft paper slap with one drip (replaces the hand's cardPlace)
//   e_wellShake    the second card shakes the water off: hard wet flutters + a bright spray of droplets (the
//                  brightest cue of the scene)
//   e_wellDown     the bucket drops back: the ratchet freewheels (a fast, falling click run) → a deep plop
//   e_wellLast     the crank's very last tooth: one brighter tick and a short wooden ring
//   e_wellFade     the well dissolves into teal motes: rising water bubbles and a soft airy lift

import type { Recipe } from '../../sounds';
import type { Voice } from '../../synth';
import { midiHz, perc } from '../../synth';
import { puff, sweep, thump } from '../kit';

/** The windlass' voice: a dry wooden tick at `f` (Hz) — a short noise snap through a wooden band + a quick body. */
function woodTick(v: Voice, t: number, f: number, g: number, o: { snap?: number; body?: number } = {}): void {
  // the tooth's snap (short, band-passed high)
  v.noise('white', { t, g: perc(g * (o.snap ?? 1), 0.006, 0.0002), to: v.filt('bandpass', f * 8, 2.2) });
  // the wooden body: the fundamental with its stiff-wood partials (2.7, 5.1 ×), all short
  v.tone('triangle', [[0, f * 1.06], [0.02, f, 'e']], { t, g: perc(g * 0.55 * (o.body ?? 1), 0.045, 0.0008) });
  v.tone('sine', f * 2.71, { t, g: perc(g * 0.28 * (o.body ?? 1), 0.025, 0.0006) });
  v.tone('sine', f * 5.13, { t, g: perc(g * 0.12, 0.012, 0.0004) });
}

/**
 * Run `play` through a gain stage of `db` decibels (the suite sits at the level of the reference v3 spells:
 * springRise ≈ −23, mirrorBreak ≈ −22 LUFS-I). The voice's own destination is swapped for the stage while it plays.
 */
function lift(db: number, play: (v: Voice) => void): (v: Voice) => void {
  return (v) => {
    const bus = v.amp(Math.pow(10, db / 20));
    const o = v as unknown as { out: AudioNode };
    const prev = o.out;
    Object.defineProperty(v, 'out', { value: bus, configurable: true, writable: true });
    try {
      play(v);
    } finally {
      Object.defineProperty(v, 'out', { value: prev, configurable: true, writable: true });
    }
  };
}

/** One water bubble: a sine blip gliding upward (the classic resonant bubble). */
function bubble(v: Voice, t: number, f: number, g: number, d = 0.05): void {
  v.tone('sine', [[0, f], [d, f * 1.9, 'e']], { t, g: [[0, 0], [0.004, g], [d, 0.0001, 'e']] });
}

/** A deep water gulp: a resonant bubble that swells down then up (150–250 Hz body) with a short wet onset. */
function gloop(v: Voice, t: number, f: number, g: number, d = 0.16): void {
  v.tone('sine', [[0, f * 1.25], [d * 0.35, f * 0.8, 'e'], [d, f * 1.6, 'e']], { t, g: [[0, 0], [0.006, g], [d * 0.5, g * 0.6], [d, 0.0001, 'e']] });
  v.tone('triangle', [[0, f * 2.5], [d * 0.6, f * 1.7, 'e']], { t, g: perc(g * 0.22, d * 0.6, 0.002) });
}

export const RECIPES = {
  e_wellStone: {
    cap: 3,
    gap: 0.03,
    verb: 0.3,
    play: lift(5, (v) => {
      // a stone block set down on stone: a dry mid knock (no long ring), a little grit sliding
      thump(v, 0, 260, 140, 0.28, 0.06);
      v.noise('white', { g: perc(0.22, 0.012, 0.0003), to: v.filt('bandpass', 1900, 1.4) });
      v.noise('pink', { t: 0.004, g: [[0, 0], [0.01, 0.07], [0.1, 0.0001, 'e']], to: v.filt('bandpass', 3200, 1.1) });
      v.tone('sine', 520, { g: perc(0.06, 0.03, 0.0005) });
    }),
  },
  e_wellFrame: {
    cap: 1,
    gap: 0.2,
    verb: 0.38,
    play: lift(5, (v) => {
      // the two posts knock into the stone (left, right), then the axle drops onto them (lower, heavier)
      woodTick(v, 0, 330, 0.3, { snap: 0.8 });
      woodTick(v, 0.055, 349, 0.28, { snap: 0.8 });
      woodTick(v, 0.15, 247, 0.42, { snap: 1.2, body: 1.5 });
      thump(v, 0.15, 150, 95, 0.2, 0.09);
      v.bursts([0.2, 0.226, 0.246, 0.262], [0.07, 0.05, 0.035, 0.02], { dec: 0.008, f: 2400, q: 2 });
    }),
  },
  e_wellClick: {
    cap: 8,
    gap: 0.018,
    verb: 0.22,
    play: lift(5, (v) => {
      // one ratchet tooth: the card's 330 Hz signature (the scene raises the pitch as the crank speeds up)
      woodTick(v, 0, 330, 0.36);
    }),
  },
  e_wellRope: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play: lift(5, (v) => {
      // fibres under load: a slow pulse train of tiny frictions through a woody band, rising a little
      const d = 0.55;
      const bp = v.filt('bandpass', [[0, 700], [d, 1100, 'e']], 3.5);
      const fl = v.flutter(38, 0.9, { d, base: 0.1, to: bp });
      v.noise('white', { g: [[0, 0], [0.06, 0.3], [d * 0.6, 0.22], [d, 0.0001, 'e']], to: fl });
      v.tone('sawtooth', [[0, 92], [d, 120, 'e']], { g: [[0, 0], [0.08, 0.04], [d, 0.0001, 'e']], to: v.filt('lowpass', 600, 1.5) });
    }),
  },
  e_wellSlosh: {
    cap: 1,
    gap: 0.2,
    verb: 0.42,
    duck: 0.3,
    play: lift(6, (v) => {
      // the bucket breaks the surface: a deep gulp (the climax of the climb), its wet staves knock the stone,
      // then the water sloshes from side to side inside it (a wobbling mid band) with bubbles
      gloop(v, 0, 170, 0.13, 0.18);
      puff(v, 0, 0.18, 0.08, 1800, { kind: 'pink' });
      woodTick(v, 0.03, 294, 0.22, { snap: 0.5, body: 1.2 });
      const lp = v.filt('bandpass', 1150, 1.6);
      v.wander(lp.frequency, 9, 650, { d: 0.6 });
      v.noise('pink', { t: 0.06, g: [[0, 0], [0.06, 0.26], [0.2, 0.09], [0.32, 0.2], [0.62, 0.0001, 'e']], to: lp });
      bubble(v, 0.12, 520, 0.1);
      bubble(v, 0.24, 690, 0.08, 0.04);
      bubble(v, 0.33, 440, 0.07);
    }),
  },
  e_wellSpill: {
    cap: 1,
    gap: 0.3,
    verb: 0.35,
    play: lift(6, (v) => {
      // the separating layer: water pouring over the lip — a low pink pour band with a slow wobble, made liquid by
      // dense small resonant bubbles (sine glides 700–2000 Hz, 15–30 ms apart) and drops on stone; almost no hiss
      const d = 0.8;
      const bp = v.filt('bandpass', [[0, 950], [d, 1250, 'e']], 1.3);
      v.wander(bp.frequency, 4.5, 260, { d });
      v.noise('pink', { g: [[0, 0], [0.06, 0.16], [d * 0.7, 0.12], [d, 0.0001, 'e']], to: bp });
      let t = 0.03;
      let i = 0;
      while (t < d - 0.06) {
        const f = v.r(700, 2000);
        bubble(v, t, f, v.r(0.035, 0.07) * (1 - (t / d) * 0.5), v.r(0.018, 0.035));
        t += v.r(0.015, 0.03);
        i++;
      }
      // drops landing on the stones: soft, low taps
      for (let k = 0; k < 5; k++) v.tone('sine', [[0, 900], [0.02, 600, 'e']], { t: 0.1 + k * 0.13 + v.r(0, 0.03), g: perc(0.04, 0.03, 0.001) });
      v.noise('white', { g: [[0, 0], [0.1, 0.012], [d, 0.0001, 'e']], to: v.filt('bandpass', 3000, 1.5) });
      void i;
    }),
  },
  e_wellCatch: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play: lift(5, (v) => {
      // the pawl drops into its tooth and holds the weight: "kla-k" — two ticks, a wooden thud under the second
      woodTick(v, 0, 392, 0.32);
      woodTick(v, 0.045, 330, 0.44, { body: 1.6 });
      thump(v, 0.045, 170, 110, 0.16, 0.07);
    }),
  },
  e_wellLeap: {
    cap: 2,
    gap: 0.06,
    verb: 0.38,
    duck: 0.35,
    play: lift(6, (v) => {
      // "şlap": a short wet slap (lowpassed, little hiss) …
      puff(v, 0, 0.3, 0.06, 1500, { kind: 'pink', att: 0.001 });
      thump(v, 0, 230, 120, 0.2, 0.07);
      // … "GLOOP": the water lets the card go — a deep resonant gulp, then a rising bubble pair (tonal, not a splash)
      gloop(v, 0.012, 190, 0.15, 0.16);
      bubble(v, 0.05, 330, 0.12, 0.06);
      bubble(v, 0.1, 480, 0.08, 0.05);
      // … "fwip": the card flutters through the air on its way to the hand — a pitched paper flutter falling a little
      const d = 0.38;
      const bp = v.filt('bandpass', [[0, 1800], [0.08, 2600, 'e'], [d, 1500, 'e']], 4);
      const fl = v.flutter(26, 0.85, { t: 0.08, d, base: 0.15, to: bp });
      v.noise('white', { t: 0.08, g: [[0, 0], [0.03, 0.22], [d * 0.6, 0.1], [d, 0.0001, 'e']], to: fl });
      v.tone('triangle', [[0, 1300], [d, 900, 'e']], { t: 0.08, g: [[0, 0], [0.03, 0.025], [d, 0.0001, 'e']] });
      // … shedding a few drops
      for (let i = 0; i < 4; i++) bubble(v, 0.14 + i * 0.06, v.r(1300, 2100), 0.035, 0.025);
    }),
  },
  e_wellTap: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    play: lift(9, (v) => {
      // the wet card lands in the hand: a soft paper slap (low-mid, damp) and one bright drip after it
      puff(v, 0, 0.3, 0.05, 1400, { kind: 'pink', att: 0.001 });
      thump(v, 0, 300, 180, 0.14, 0.04);
      v.noise('white', { g: perc(0.08, 0.012, 0.0004), to: v.filt('bandpass', 2400, 1.2) });
      bubble(v, 0.09, 1250, 0.09, 0.04);
    }),
  },
  e_wellShake: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    play: lift(7, (v) => {
      // the brightest cue: hard wet flutters (a card shaken: paper + water), one per jerk …
      [0, 0.046, 0.092, 0.138, 0.184, 0.23].forEach((t, i) => {
        sweep(v, t, 0.05, [2400, 5200, 3000], 0.24 - i * 0.025, { kind: 'white', q: 1.8, peakAt: 0.35 });
        puff(v, t, 0.07, 0.04, 2200, { kind: 'pink' });
      });
      // … and a bright spray of droplets flung away, spread wide
      const pans = [v.panner(-0.7), v.panner(-0.2), v.panner(0.25), v.panner(0.7)];
      for (let i = 0; i < 14; i++) {
        const t = 0.02 + i * 0.022 + v.r(0, 0.015);
        const f = v.r(1800, 3600);
        v.tone('sine', [[0, f], [0.022, f * 1.7, 'e']], { t, g: perc(0.07, 0.026, 0.001), to: pans[i % 4] });
      }
    }),
  },
  e_wellDown: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    play: lift(6, (v) => {
      // the ratchet freewheels as the bucket drops: a run of ticks speeding up and falling in pitch …
      let t = 0;
      for (let i = 0; i < 10; i++) {
        woodTick(v, t, 330 * Math.pow(0.97, i), 0.2 * (1 - i * 0.05), { body: 0.6 });
        t += 0.045 * Math.pow(0.86, i);
      }
      sweep(v, 0, 0.3, [1800, 1200, 700], 0.06, { kind: 'pink', q: 1.4, peakAt: 0.5 });
      // … and the bucket plops deep into the well (a low resonant plop, a gulp, a bubble)
      const tp = 0.3;
      v.tone('sine', [[0, 300], [0.08, 110, 'e']], { t: tp, g: perc(0.22, 0.14, 0.002) });
      gloop(v, tp + 0.02, 150, 0.1, 0.18);
      puff(v, tp, 0.16, 0.2, 800, { kind: 'pink' });
      bubble(v, tp + 0.1, 380, 0.08, 0.07);
    }),
  },
  e_wellLast: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    play: lift(5, (v) => {
      // the last tooth: one brighter tick that rings a moment (the windlass at rest)
      woodTick(v, 0, 440, 0.38, { snap: 1.3 });
      v.tone('sine', 440 * 2.71, { t: 0.002, g: perc(0.05, 0.22, 0.001) });
      v.tone('triangle', 330, { t: 0.002, g: perc(0.06, 0.28, 0.002) });
    }),
  },
  e_wellFade: {
    cap: 1,
    gap: 0.3,
    verb: 0.6,
    play: lift(8, (v) => {
      // the well dissolves upward into teal motes: water bubbles rising in an E-major pentatonic ladder + a soft air lift
      const steps = [64, 66, 68, 71, 73, 76, 78];
      steps.forEach((m, i) => bubble(v, 0.03 + i * 0.055, midiHz(m), 0.09 * (1 - i * 0.08), 0.06));
      sweep(v, 0, 0.55, [600, 2400, 4200], 0.08, { kind: 'pink', q: 1.2, peakAt: 0.6 });
      v.tone('sine', midiHz(76), { t: 0.3, g: [[0, 0], [0.05, 0.03], [0.45, 0.0001, 'e']] });
    }),
  },
} satisfies Record<string, Recipe>;
export type Sfx = keyof typeof RECIPES;
