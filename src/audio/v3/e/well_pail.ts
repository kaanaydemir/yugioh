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
//   e_wellSpill    the overflow over the wooden lip: a thin high water thread + drips knocking on the staves in the
//                  330 Hz family (each with a tiny drip), a few dull drops far down the shaft — no broad pour
//   e_wellTip      the bucket tips on its bail: a short wooden creak ending on a small tick (softer on the tip back)
//   e_wellCatch    the pawl catches at the top: "klak" (two clicks, a wooden thud)
//   e_wellLeap     a card leaps out like a fish: "şlap-GLOOP-fwip" (a wet slap over a deep 150–250 Hz resonant gulp,
//                  then a pitched paper flutter that follows the flight down to the hand)
//   e_wellFall     the card's fall into the hand (started at the apex, stopped on the flop): a quiet paper flutter
//                  whose band falls and whose rate slows as the card comes down — the whole fall has sound
//   e_wellTap      the wet card lands in the hand: a soft paper slap with one drip (replaces the hand's cardPlace)
//   e_wellShake    the second card shakes the water off: a wet paper rattle (fast flutter) with a hard flap per
//                  jerk + a bright spray of droplets flung sideways (the brightest cue of the scene)
//   e_wellDown     the bucket drops back: the ratchet freewheels (a fast, falling click run) → a deep plop
//   e_wellLast     the crank's very last tooth: one brighter tick and a short wooden ring
//   e_wellFade     the well dissolves into teal motes: a last wooden creak that sags then lifts, deep irregular
//                  bubbles from the shaft, a soft airy lift

import type { Recipe } from '../../sounds';
import type { Voice } from '../../synth';
import { perc } from '../../synth';
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
      woodTick(v, 0.034, 349, 0.28, { snap: 0.8 });
      // (the axle lands 80 scene ms = 108 ms after the first post: synced to the picture)
      woodTick(v, 0.108, 247, 0.42, { snap: 1.2, body: 1.5 });
      thump(v, 0.108, 150, 95, 0.2, 0.09);
      v.bursts([0.158, 0.184, 0.204, 0.22], [0.07, 0.05, 0.035, 0.02], { dec: 0.008, f: 2400, q: 2 });
    }),
  },
  e_wellClick: {
    cap: 8,
    gap: 0.018,
    verb: 0.22,
    play: lift(6, (v) => {
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
    play: lift(7, (v) => {
      // the separating layer: water running over a WOODEN lip — not a pour but a trickle: a thin, fast-wandering
      // water thread (one narrow band, low level) and, on top of it, drips knocking on the wet staves in the
      // windlass' own 330 Hz family (each knock with its tiny bright drip), then a few drops landing far down in the
      // shaft (dull, distant plinks)
      const d = 0.82;
      const bp = v.filt('bandpass', [[0, 1150], [d, 1450, 'e']], 3.2);
      v.wander(bp.frequency, 17, 300, { d });
      v.noise('pink', { g: [[0, 0], [0.04, 0.13], [d * 0.7, 0.1], [d, 0.0001, 'e']], to: bp });
      const fam = [825, 990, 1155, 1320, 990]; // the 330 Hz family (×2½…×4), high: the staves are thin, wet wood
      let t = 0.02;
      let i = 0;
      while (t < d - 0.08) {
        const f = fam[i % fam.length] * v.r(0.98, 1.03);
        const g = v.r(0.12, 0.2) * (1 - (t / d) * 0.45);
        // the knock on the stave: a damp wooden tick (little snap, short body)
        v.noise('white', { t, g: perc(g * 0.5, 0.004, 0.0002), to: v.filt('bandpass', f * 6, 3) });
        v.tone('sine', [[0, f * 1.04], [0.015, f, 'e']], { t, g: perc(g * 0.6, 0.026, 0.0006) });
        v.tone('sine', f * 2.71, { t, g: perc(g * 0.22, 0.018, 0.0004) });
        // … and its drip
        bubble(v, t + 0.006, v.r(1400, 2200), g * 0.4, v.r(0.012, 0.02));
        t += v.r(0.05, 0.11);
        i++;
      }
      // drops landing on the water far below: dull, low, late
      for (let k = 0; k < 4; k++) {
        const tt = 0.16 + k * 0.17 + v.r(0, 0.04);
        v.tone('sine', [[0, 620], [0.04, 980, 'e']], { t: tt, g: perc(0.035, 0.05, 0.001), to: v.filt('lowpass', 1400, 0.8) });
      }
    }),
  },
  e_wellTip: {
    cap: 2,
    gap: 0.06,
    verb: 0.3,
    play: lift(6, (v) => {
      // the bucket tips on its bail: the iron pin turns in its wet wooden ear — a short tonal SQUEAK (a sine
      // gliding up, rattled by a fast friction tremolo) with a little grit, ending on a small 330-family tick
      const d = 0.13;
      const am = v.flutter(70, 0.9, { d, base: 0.1 });
      v.tone('sine', [[0, 1450], [d, 1720, 'e']], { g: [[0, 0], [0.015, 0.09], [d * 0.8, 0.07], [d, 0.0001, 'e']], to: am });
      v.tone('sine', [[0, 2900], [d, 3440, 'e']], { g: [[0, 0], [0.015, 0.025], [d, 0.0001, 'e']], to: am });
      v.noise('white', { g: [[0, 0], [0.01, 0.06], [d, 0.0001, 'e']], to: v.filt('bandpass', 2600, 3) });
      woodTick(v, d - 0.01, 495, 0.18, { snap: 0.7, body: 0.9 });
    }),
  },
  e_wellCatch: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play: lift(8, (v) => {
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
  e_wellFall: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    play: lift(4, (v) => {
      // a long, quiet paper flutter (the handle stops it on the flop): the papery band falls with the card and the
      // flap rate slows a little as it comes down; a faint airy whoosh under it, two drops shed on the way
      const d = 1.1;
      const bp = v.filt('bandpass', [[0, 2100], [d, 1100, 'e']], 3.2);
      const fl = v.flutter(24, 0.8, { d, base: 0.2, to: bp });
      v.noise('white', { g: [[0, 0], [0.05, 0.12], [d * 0.7, 0.09], [d, 0.0001, 'e']], to: fl });
      v.noise('pink', { g: [[0, 0], [0.08, 0.035], [d, 0.0001, 'e']], to: v.filt('bandpass', [[0, 900], [d, 520, 'e']], 1.2) });
      bubble(v, 0.18, 1650, 0.025, 0.025);
      bubble(v, 0.41, 1380, 0.02, 0.025);
    }),
  },
  e_wellShake: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    play: lift(7, (v) => {
      // the brightest cue: a WET PAPER RATTLE — the card flaps hard in the air: a fast paper flutter (a ~45 Hz
      // amplitude rattle through a papery band) under the whole shake, one hard wet flap per jerk …
      const d = 0.41; // ten 30-ms steps (the first two jerks held two) × the 1.35 tempo
      const pb = v.filt('bandpass', [[0, 1300], [d * 0.4, 1900, 'e'], [d, 1200, 'e']], 1.6);
      const fl = v.flutter(46, 0.9, { d, base: 0.08, to: pb });
      v.noise('white', { g: [[0, 0], [0.01, 0.3], [d * 0.5, 0.2], [d, 0.0001, 'e']], to: fl });
      v.noise('pink', { g: [[0, 0], [0.01, 0.1], [d, 0.0001, 'e']], to: v.flutter(23, 0.8, { d, base: 0.2, to: v.filt('bandpass', 520, 1.4) }) });
      // (the first two jerks are the big held throws: harder, longer flaps)
      [0, 0.081, 0.162, 0.203, 0.243, 0.284, 0.324, 0.365].forEach((t, i) => {
        sweep(v, t, i < 2 ? 0.07 : 0.045, [2200, 4600, 2800], i < 2 ? 0.26 : 0.2 - i * 0.02, { kind: 'white', q: 1.8, peakAt: 0.3 });
        puff(v, t, i < 2 ? 0.09 : 0.06, 0.035, 2000, { kind: 'pink' });
      });
      // … and a bright spray of droplets flung sideways, spread wide (heaviest on the first two reversals)
      const pans = [v.panner(-0.75), v.panner(-0.25), v.panner(0.25), v.panner(0.75)];
      for (let i = 0; i < 16; i++) {
        const t = (i < 7 ? 0.01 + i * 0.025 : 0.2 + (i - 7) * 0.03) + v.r(0, 0.012);
        const f = v.r(1700, 3400);
        const g = i < 7 ? 0.075 : 0.045;
        v.tone('sine', [[0, f], [0.02, f * 1.7, 'e']], { t, g: perc(g, 0.024, 0.001), to: pans[i % 4] });
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
    verb: 0.55,
    play: lift(8, (v) => {
      // the well comes apart into motes: the windlass' wood CREAKS one last time — a friction pulse train that sags
      // (falling) and then lifts away (rising) as the frame goes — over a few deep, irregular bubbles from the shaft
      // (low pops gliding up, no scale) and a soft airy lift that carries the motes up
      const d = 0.58;
      const bp = v.filt('bandpass', [[0, 1250], [0.22, 820, 'e'], [d, 1700, 'e']], 4.5);
      const rate = v.flutter(30, 0.9, { d, base: 0.08, to: bp });
      v.noise('white', { g: [[0, 0], [0.04, 0.22], [0.25, 0.16], [d, 0.0001, 'e']], to: rate });
      v.tone('sawtooth', [[0, 150], [0.22, 104, 'e'], [d, 190, 'e']], { g: [[0, 0], [0.05, 0.028], [d, 0.0001, 'e']], to: v.filt('lowpass', 520, 1.6) });
      [
        [0.05, 820, 0.09, 0.06],
        [0.13, 1150, 0.07, 0.045],
        [0.21, 930, 0.08, 0.05],
        [0.33, 1380, 0.05, 0.04],
      ].forEach(([t, f, g, dd]) => bubble(v, t, f, g, dd));
      sweep(v, 0.12, 0.5, [2200, 5200, 8200], 0.1, { kind: 'white', q: 1.3, peakAt: 0.65 });
    }),
  },
} satisfies Record<string, Recipe>;
export type Sfx = keyof typeof RECIPES;
