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
//   e_wellSpill    the overflow: a bright trickle running over the lip, drops pattering on stone
//   e_wellCatch    the pawl catches at the top: "klak" (two clicks, a wooden thud)
//   e_wellLeap     a card leaps out like a fish: "şlap-fwip" (a wet slap, then a paper flick)
//   e_wellShake    the second card shakes the water off: three wet flutters + flung droplets
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

/** One water bubble: a sine blip gliding upward (the classic resonant bubble). */
function bubble(v: Voice, t: number, f: number, g: number, d = 0.05): void {
  v.tone('sine', [[0, f], [d, f * 1.9, 'e']], { t, g: [[0, 0], [0.004, g], [d, 0.0001, 'e']] });
}

export const RECIPES = {
  e_wellStone: {
    cap: 3,
    gap: 0.03,
    verb: 0.3,
    play(v) {
      // a stone block set down on stone: a dry mid knock (no long ring), a little grit sliding
      thump(v, 0, 260, 140, 0.24, 0.05);
      v.noise('white', { g: perc(0.22, 0.012, 0.0003), to: v.filt('bandpass', 1900, 1.4) });
      v.noise('pink', { t: 0.004, g: [[0, 0], [0.01, 0.06], [0.09, 0.0001, 'e']], to: v.filt('bandpass', 3600, 1.1) });
      v.tone('sine', 520, { g: perc(0.05, 0.03, 0.0005) });
    },
  },
  e_wellFrame: {
    cap: 1,
    gap: 0.2,
    verb: 0.38,
    play(v) {
      // the two posts knock into the stone (left, right), then the axle drops onto them (lower, heavier)
      woodTick(v, 0, 330, 0.3, { snap: 0.8 });
      woodTick(v, 0.055, 349, 0.28, { snap: 0.8 });
      woodTick(v, 0.15, 247, 0.4, { snap: 1.2, body: 1.4 });
      thump(v, 0.15, 150, 95, 0.16, 0.08);
      // the axle settles in its forks: a tiny wooden rattle
      v.bursts([0.2, 0.226, 0.246, 0.262], [0.07, 0.05, 0.035, 0.02], { dec: 0.008, f: 2400, q: 2 });
    },
  },
  e_wellClick: {
    cap: 8,
    gap: 0.018,
    verb: 0.22,
    play(v) {
      // one ratchet tooth: the card's 330 Hz signature (the scene raises the pitch as the crank speeds up)
      woodTick(v, 0, 330, 0.34);
    },
  },
  e_wellRope: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play(v) {
      // fibres under load: a slow pulse train (≈ 38 → 70 /s) of tiny frictions through a woody band, rising a little
      const d = 0.55;
      const bp = v.filt('bandpass', [[0, 700], [d, 1100, 'e']], 3.5);
      const fl = v.flutter(38, 0.9, { d, base: 0.1, to: bp });
      v.noise('white', { g: [[0, 0], [0.06, 0.3], [d * 0.6, 0.22], [d, 0.0001, 'e']], to: fl });
      v.tone('sawtooth', [[0, 92], [d, 120, 'e']], { g: [[0, 0], [0.08, 0.035], [d, 0.0001, 'e']], to: v.filt('lowpass', 600, 1.5) });
    },
  },
  e_wellSlosh: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.25,
    play(v) {
      // the bucket breaks the surface: a short gulp, its wet staves knock the stone (wood, the card's 330 Hz family),
      // then the water sloshes from side to side inside it (a fast-wobbling mid band, no low rumble)
      puff(v, 0, 0.2, 0.08, 2200, { kind: 'pink' });
      woodTick(v, 0.03, 294, 0.22, { snap: 0.5, body: 1.2 });
      const lp = v.filt('bandpass', 1250, 1.6);
      v.wander(lp.frequency, 9, 700, { d: 0.6 });
      v.noise('pink', { t: 0.06, g: [[0, 0], [0.06, 0.24], [0.2, 0.08], [0.32, 0.18], [0.62, 0.0001, 'e']], to: lp });
      bubble(v, 0.12, 520, 0.09);
      bubble(v, 0.24, 690, 0.07, 0.04);
      bubble(v, 0.33, 440, 0.06);
    },
  },
  e_wellSpill: {
    cap: 1,
    gap: 0.3,
    verb: 0.35,
    play(v) {
      // the separating layer: water running over the lip — a bright, gently wobbling trickle — and drops on stone
      const d = 0.75;
      const bp = v.filt('bandpass', [[0, 2600], [d, 3400, 'e']], 1.8);
      v.wander(bp.frequency, 11, 600, { d });
      v.noise('white', { g: [[0, 0], [0.05, 0.14], [d * 0.7, 0.11], [d, 0.0001, 'e']], to: bp });
      v.crackle({ t: 0.05, d: d - 0.1, n: 14, g: 0.07, f: 4200, q: 3, dec: 0.01, curve: 1 });
      for (let i = 0; i < 6; i++) bubble(v, 0.08 + i * 0.1 + v.r(0, 0.04), v.r(900, 1500), v.r(0.03, 0.05), 0.03);
    },
  },
  e_wellCatch: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play(v) {
      // the pawl drops into its tooth and holds the weight: "kla-k" — two ticks, a wooden thud under the second
      woodTick(v, 0, 392, 0.32);
      woodTick(v, 0.045, 330, 0.42, { body: 1.5 });
      thump(v, 0.045, 170, 110, 0.12, 0.06);
    },
  },
  e_wellLeap: {
    cap: 2,
    gap: 0.06,
    verb: 0.35,
    duck: 0.3,
    play(v) {
      // "şlap": a wet slap out of the water (a lowpassed noise burst + a small body)
      puff(v, 0, 0.42, 0.09, 2600, { kind: 'white', att: 0.001 });
      thump(v, 0, 210, 120, 0.15, 0.06);
      bubble(v, 0.02, 600, 0.06, 0.04);
      // "fwip": the card flicks through the air (a fast band sweep up, paper-thin) …
      sweep(v, 0.07, 0.13, [1400, 5200, 3600], 0.2, { kind: 'white', q: 2.2, peakAt: 0.55 });
      // … shedding a few drops
      for (let i = 0; i < 4; i++) bubble(v, 0.1 + i * 0.045, v.r(1400, 2300), 0.025, 0.025);
    },
  },
  e_wellShake: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    play(v) {
      // three wet flutters (a card shaken hard: paper + water) …
      [0, 0.075, 0.15].forEach((t, i) => {
        sweep(v, t, 0.065, [2200, 4200, 2600], 0.26 - i * 0.04, { kind: 'white', q: 1.6, peakAt: 0.4 });
        puff(v, t, 0.08, 0.05, 1800, { kind: 'pink' });
      });
      // … and the flung droplets pattering away, bright and spread
      const pans = [v.panner(-0.5), v.panner(0.1), v.panner(0.55)];
      for (let i = 0; i < 9; i++) {
        const t = 0.04 + i * 0.03 + v.r(0, 0.02);
        const f = v.r(1500, 2800);
        v.tone('sine', [[0, f], [0.025, f * 1.6, 'e']], { t, g: perc(0.055, 0.03, 0.001), to: pans[i % 3] });
      }
    },
  },
  e_wellDown: {
    cap: 1,
    gap: 0.2,
    verb: 0.42,
    play(v) {
      // the ratchet freewheels as the bucket drops: a run of ticks speeding up and falling in pitch …
      let t = 0;
      for (let i = 0; i < 10; i++) {
        woodTick(v, t, 330 * Math.pow(0.97, i), 0.2 * (1 - i * 0.05), { body: 0.6 });
        t += 0.045 * Math.pow(0.86, i);
      }
      // … the rope hisses through …
      sweep(v, 0, 0.3, [1800, 1200, 700], 0.06, { kind: 'pink', q: 1.4, peakAt: 0.5 });
      // … and the bucket plops deep into the well (a low resonant plop, a bubble)
      const tp = 0.3;
      v.tone('sine', [[0, 300], [0.08, 120, 'e']], { t: tp, g: perc(0.3, 0.14, 0.002) });
      puff(v, tp, 0.18, 0.2, 800, { kind: 'pink' });
      bubble(v, tp + 0.08, 380, 0.07, 0.07);
    },
  },
  e_wellLast: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    play(v) {
      // the last tooth: one brighter tick that rings a moment (the windlass at rest)
      woodTick(v, 0, 440, 0.38, { snap: 1.3 });
      v.tone('sine', 440 * 2.71, { t: 0.002, g: perc(0.05, 0.22, 0.001) });
      v.tone('triangle', 330, { t: 0.002, g: perc(0.06, 0.28, 0.002) });
    },
  },
  e_wellFade: {
    cap: 1,
    gap: 0.3,
    verb: 0.6,
    play(v) {
      // the well dissolves upward into teal motes: water bubbles rising in an E-major pentatonic ladder + a soft air lift
      const steps = [64, 66, 68, 71, 73, 76, 78];
      steps.forEach((m, i) => bubble(v, 0.03 + i * 0.055, midiHz(m), 0.08 * (1 - i * 0.08), 0.06));
      sweep(v, 0, 0.55, [600, 2400, 4200], 0.1, { kind: 'pink', q: 1.2, peakAt: 0.6 });
      v.tone('sine', midiHz(76), { t: 0.3, g: [[0, 0], [0.05, 0.03], [0.45, 0.0001, 'e']] });
    },
  },
} satisfies Record<string, Recipe>;
export type Sfx = keyof typeof RECIPES;
