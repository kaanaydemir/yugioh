// Bulut Yavrusu (cloud_hatchling) sounds — docs/v3/kart-a/cloud_hatchling.md §6. Kept in a file of its own
// (like ./dawn.ts, ./ashen.ts): src/audio/sounds.ts spreads V3_HATCH_RECIPES, SfxName gains HatchSfxName,
// CHARACTER_SOUNDS.cloud_hatchling names the baby's role set and VARIANT_SOUNDS['cloud_hatchling:grown'] the
// grown body's (src/cinematics/_v3/sound.ts).
//
// Identity (YENI §5.1 C3): key D. The baby's voice is a D6 (1175 Hz) FM chirp; the growth's six hiccups step
// down D6 B5 G5 E5 D5 A4 and the voice breaks two octaves into a D4 roar over a D3 growl body. Material:
// eggshell — a dry broadband crack + a short "tok" (420 → 180 Hz), never a tonal click. Distinguishing layer:
// THE RING WHISTLE — a gliding sine D7 → D8 (2349 → 4699 Hz) with a 6 Hz flutter over a band-passed breath
// rising 2 → 5 kHz (the grown whistle one octave lower, 4 Hz flutter). No glass rain (the wyrm's), no ratchet
// or tick-tock (dial_jester's), no saw drone (the magus'), no held wind note (steppe_spiralhorn's).
// Built from ./kit.ts blocks and the Voice primitives only. Sustained sounds: HATCH_SUSTAINED.

import type { Recipe } from '../sounds';
import type { Pt, Voice } from '../synth';
import { perc } from '../synth';
import { crack, glassBell, growl, puff, sweep, thump } from './kit';

/** The growth hiccups' pitch factors: D6 B5 G5 E5 D5 A4 (the scene passes them as `pitch`). */
export const GROW_STEPS: readonly number[] = [1, 0.841, 0.667, 0.561, 0.5, 0.375];

/** A sustained hold envelope: rise to D, plateau to H, natural fade to E. */
const hold = (g: number, D: number, H: number, E: number): Pt[] => [[0, 0.0001], [D, g, 'e'], [H, g], [E, 0.0001, 'e']];

/** The eggshell "tok": a short 420 → 180 Hz body under a dry broadband crack (never a single tonal click). */
function shellTok(v: Voice, t: number, g: number, o: { hp?: number; n?: number } = {}): void {
  crack(v, t, g, { hp: o.hp ?? 2500, lp: 8000, n: o.n ?? 2, gap: 0.009, dec: 0.008 });
  thump(v, t, 420, 180, g * 0.5, 0.05);
}

/** The baby's chirp voice: an FM chirp on f with a glide up and back, a fast 18 Hz vibrato. */
function chirp(v: Voice, t: number, f: number, up: number, g: number, d = 0.16): void {
  v.bell(f, { t, g: g * 0.8, dec: d * 0.9, ratio: 2, index: 1.2 });
  const o = v.tone('sine', [[0, f], [d * 0.38, up, 'e'], [d, f, 'e']], { t, g: [[0, 0], [0.006, g], [d * 0.6, g * 0.7], [d + 0.03, 0.0001, 'e']] });
  v.lfo(o.osc.detune, 18, 40, { t, d: d + 0.03 });
}

/**
 * The ring whistle (the distinguishing layer): a gliding sine f0 → f1 over `d` with a flutter, and a
 * band-passed breath rising through `breath` Hz, panned `pan[0] → pan[1]`.
 */
function whistle(v: Voice, d: number, f0: number, f1: number, g: number, o: { flutter: number; cents: number; breath: readonly [number, number, number]; pan: readonly [number, number] }): void {
  const out = v.panner([[0, o.pan[0]], [d, o.pan[1]]]);
  const w = v.tone('sine', [[0, f0], [d, f1, 'e']], { g: [[0, 0], [0.03, g], [d * 0.85, g * 0.9], [d + 0.06, 0.0001, 'e']], to: out });
  v.lfo(w.osc.detune, o.flutter, o.cents, { d: d + 0.06 });
  sweep(v, 0, d + 0.05, o.breath, g * 2.2, { q: 4, pan: o.pan, peakAt: 0.7 });
}

/** The vocal-break voice of the roar: a glide under a growl, the ring whistle sung inside it (−12 dB). */
function bigVoice(v: Voice, o: { d: number; f: readonly [number, number, number, number, number]; g: number; grit: number; glide?: readonly [number, number] }): void {
  if (o.glide) v.tone('sine', [[0, o.glide[0]], [0.04, o.glide[1], 'e']], { g: [[0, 0], [0.004, 0.05], [0.12, 0.03], [0.3, 0.0001, 'e']] });
  growl(v, 0, { d: o.d, f: o.f, formants: [520, 1250, 2600], g: o.g, grit: o.grit, rasp: 30 });
  // the ring whistle sung inside the roar, 4 Hz flutter, ≈ −12 dB under the growl
  const s = v.tone('sine', [[0.02, 1175], [0.5, 2349, 'e']], { t: 0.02, g: [[0, 0], [0.06, 0.03], [o.d * 0.6, 0.022], [o.d, 0.0001, 'e']] });
  v.lfo(s.osc.detune, 4, 30, { t: 0.02, d: o.d });
}

export const V3_HATCH_RECIPES = {
  // ------------------------------------------------------------------ the baby's small voice

  /** One hiccup: a D6 blip with an air pop, a thin whistle tail (the idle's tiny ring). */
  hatchHiccup: {
    cap: 3,
    gap: 0.05,
    verb: 0.2,
    play(v) {
      v.tone('sine', [[0, 1175], [0.04, 1400, 'e']], { g: perc(0.06, 0.05, 0.002) });
      puff(v, 0, 0.03, 0.03, 4000, { kind: 'white' });
      v.tone('sine', [[0.05, 3520], [0.17, 4699, 'e']], { t: 0.05, g: [[0, 0], [0.02, 0.02], [0.12, 0.0001, 'e']] });
    },
  },
  /** The first squeak ("Cıyak", the baby's roar role): two FM chirps up the D major steps. */
  hatchCheep: {
    cap: 2,
    gap: 0.1,
    verb: 0.3,
    duck: 0.25,
    play(v) {
      chirp(v, 0, 1175, 1568, 0.06);
      chirp(v, 0.2, 1319, 1760, 0.05, 0.14);
    },
  },

  // ------------------------------------------------------------------ the summon: cloud, egg, hatch

  /** The cloud drifts in (summon `arrive`): a soft pink air sweep and a D5 / A5 sine pad swelling. */
  hatchCloudDrift: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    duck: 0.15,
    play(v) {
      sweep(v, 0, 0.5, [600, 1400, 800], 0.06, { kind: 'pink', q: 0.9, pan: [-0.4, 0] });
      for (const f of [587, 880]) v.tone('sine', f, { g: [[0, 0], [0.35, 0.012], [0.5, 0.008], [0.7, 0.0001, 'e']] });
    },
  },
  /** The egg falls: a short falling whistle of white air. */
  hatchEggDrop: {
    cap: 2,
    gap: 0.05,
    verb: 0.2,
    play(v) {
      sweep(v, 0, 0.18, [2400, 1500, 900], 0.07, { kind: 'white', q: 2, peakAt: 0.2 });
      v.tone('sine', [[0, 2349], [0.16, 1175, 'e']], { g: [[0, 0], [0.02, 0.012], [0.18, 0.0001, 'e']] });
    },
  },
  /** The egg lands (summon `land`): the shell tok, a dry crack, a little dust. */
  hatchEggLand: {
    cap: 2,
    gap: 0.1,
    verb: 0.25,
    duck: 0.2,
    play(v) {
      thump(v, 0, 420, 180, 0.35, 0.09);
      thump(v, 0, 120, 70, 0.25, 0.08);
      crack(v, 0.004, 0.04, { hp: 2500, lp: 7000 });
      puff(v, 0.01, 0.05, 0.12, 1200, { kind: 'brown' });
    },
  },
  /** One wobble crack (×3, the scene raises `pitch` 1 / 1.12 / 1.26): a double crack, a shell creak, a tok. */
  hatchCrack: {
    cap: 3,
    gap: 0.05,
    verb: 0.2,
    play(v) {
      crack(v, 0, 0.09, { hp: 3000, lp: 9000, n: 2, gap: 0.014 });
      v.tone('sine', [[0, 2637], [0.03, 2349, 'e']], { g: perc(0.03, 0.04, 0.001) });
      thump(v, 0, 900, 600, 0.08, 0.03);
    },
  },
  /** The top shell bursts: a multi-crack, five shell tinks (no bar modes: shell, not glass), an air pop. */
  hatchShellBurst: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      crack(v, 0, 0.14, { hp: 2000, n: 4, gap: 0.009 });
      thump(v, 0, 420, 160, 0.2, 0.06);
      for (let i = 0; i < 5; i++) v.tone('sine', v.r(3000, 5000), { t: 0.02 + i * 0.035 + v.r(0, 0.01), g: perc(0.02, 0.04, 0.0006) });
      puff(v, 0, 0.08, 0.1, 2500, { kind: 'white' });
    },
  },

  // ------------------------------------------------------------------ the attack: Hıçkırık Halkası

  /** The inhale (sustained; the strike's charge): a pink in-breath rising, two nose sniffs. */
  hatchInhale: {
    cap: 2,
    gap: 0.1,
    verb: 0.15,
    play(v) {
      sweep(v, 0, 0.8, [800, 2600, 1800], 0.07, { kind: 'pink', peakAt: 0.85 });
      for (const t of [0, 0.12]) puff(v, t, 0.03, 0.04, 5000, { kind: 'white' });
      // the held "ha…" before the sneeze: a thin breath plateau (the strike stops it on the release)
      v.noise('pink', { t: 0.6, g: hold(0.02, 0.1, 0.6, 1.0), to: v.filt('bandpass', 2200, 3, { t: 0.6 }) });
    },
  },
  /** One hop (the strike's swing beat): a small body thump and a shell rattle. */
  hatchHop: {
    cap: 2,
    gap: 0.05,
    verb: 0.15,
    play(v) {
      thump(v, 0, 300, 160, 0.12, 0.05);
      crack(v, 0.01, 0.02, { hp: 4000 });
    },
  },
  /** The sneeze (release): a bright air burst, a soft thud, the "tchoo" drop. */
  hatchSneeze: {
    cap: 2,
    gap: 0.1,
    verb: 0.2,
    duck: 0.3,
    play(v) {
      sweep(v, 0, 0.15, [3000, 5500, 2000], 0.2, { q: 2.5 });
      puff(v, 0, 0.25, 0.12, 6000, { kind: 'white' });
      thump(v, 0, 520, 260, 0.15, 0.1);
      v.tone('sine', [[0, 880], [0.03, 660, 'e']], { g: perc(0.05, 0.06, 0.002) });
    },
  },
  /** The ring whistle (sustained; the flight): D7 → D8 glide, 6 Hz flutter, breath 2 → 5 kHz, centre. */
  hatchRingWhistle: {
    cap: 2,
    gap: 0.05,
    verb: 0.25,
    play(v) {
      whistle(v, 0.3, 2349, 4699, 0.035, { flutter: 6, cents: 25, breath: [2000, 3500, 5000], pan: [-0.1, 0.1] });
    },
  },
  /** The ring whistle panned along a flight to the LEFT (player 2's attack). */
  hatchRingWhistleL: {
    cap: 2,
    gap: 0.05,
    verb: 0.25,
    play(v) {
      whistle(v, 0.3, 2349, 4699, 0.035, { flutter: 6, cents: 25, breath: [2000, 3500, 5000], pan: [0.25, -0.35] });
    },
  },
  /** The ring whistle panned along a flight to the RIGHT (player 1's attack). */
  hatchRingWhistleR: {
    cap: 2,
    gap: 0.05,
    verb: 0.25,
    play(v) {
      whistle(v, 0.3, 2349, 4699, 0.035, { flutter: 6, cents: 25, breath: [2000, 3500, 5000], pan: [-0.25, 0.35] });
    },
  },
  /** The ring closes round the target (50 ms before contact): a band-passed squeeze, a rubbery rise. */
  hatchRingSqueeze: {
    cap: 2,
    gap: 0.05,
    verb: 0.1,
    play(v) {
      sweep(v, 0, 0.08, [1200, 900, 600], 0.06, { q: 3 });
      v.tone('sine', [[0, 700], [0.05, 1400, 'e']], { g: [[0, 0], [0.01, 0.03], [0.07, 0.0001, 'e']] });
    },
  },
  /** The ring snaps (impact, baby): ONE short D7 bell (2 modes, not the wyrm's E pentatonic) + an air pop. */
  hatchRingTing: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.25,
    play(v) {
      glassBell(v, 2349, 0, 0.12, 0.06, { modes: 2 });
      puff(v, 0, 0.08, 0.05, 3000, { kind: 'white' });
      thump(v, 0, 300, 140, 0.12, 0.05);
    },
  },
  /** It plops back on its tail (the recovery). */
  hatchPlop: {
    cap: 2,
    gap: 0.1,
    verb: 0.15,
    play(v) {
      thump(v, 0, 260, 120, 0.2, 0.08);
      crack(v, 0.012, 0.03, { hp: 3800, lp: 8000, dec: 0.006 });
    },
  },
  /** Blocked: the ring cannot close and rebounds — a falling whistle, a bonk on the face, a short cheep. */
  hatchRingRebound: {
    cap: 1,
    gap: 0.1,
    verb: 0.2,
    duck: 0.2,
    play(v) {
      v.tone('sine', [[0, 4699], [0.2, 2349, 'e']], { g: [[0, 0], [0.01, 0.03], [0.17, 0.02], [0.22, 0.0001, 'e']] });
      sweep(v, 0, 0.2, [5000, 3000, 1800], 0.05, { q: 3, peakAt: 0.3 });
      thump(v, 0.2, 600, 300, 0.25, 0.06);
      crack(v, 0.2, 0.04, { hp: 3000, lp: 7000 });
      chirp(v, 0.24, 1568, 1319, 0.04, 0.1);
    },
  },
  /** Losing: the ring fizzles ("pıt") — a little air pop and a deflating glide. */
  hatchRingFizzle: {
    cap: 1,
    gap: 0.1,
    verb: 0.1,
    play(v) {
      puff(v, 0, 0.06, 0.06, 2000, { kind: 'white' });
      v.tone('sine', [[0, 2349], [0.1, 1175, 'e']], { g: [[0, 0], [0.005, 0.03], [0.12, 0.0001, 'e']] });
    },
  },

  // ------------------------------------------------------------------ the death: Yumurtaya Dönüş

  /** It curls up (deathStart): a whimper falling D6 → A5 with vibrato, a soft rustle. */
  hatchCurl: {
    cap: 1,
    gap: 0.1,
    verb: 0.25,
    play(v) {
      const o = v.tone('sine', [[0, 1175], [0.2, 880, 'e']], { g: [[0, 0], [0.01, 0.05], [0.16, 0.035], [0.24, 0.0001, 'e']] });
      v.lfo(o.osc.detune, 9, 35, { d: 0.25 });
      sweep(v, 0, 0.2, [900, 1600, 700], 0.03, { kind: 'pink' });
    },
  },
  /** The egg knits round it (dissolve): eight irregular rising stitch ticks — a knitting run, not a clock. */
  hatchKnit: {
    cap: 1,
    gap: 0.1,
    verb: 0.2,
    play(v) {
      const gaps = [0.05, 0.065, 0.045, 0.07, 0.05, 0.06, 0.045];
      let t = 0;
      for (let i = 0; i < 8; i++) {
        const k = i / 7;
        crack(v, t, 0.02 + 0.04 * k, { hp: 3500, dec: 0.005 });
        v.tone('sine', 2093 + (2794 - 2093) * k, { t, g: perc(0.018, 0.015, 0.0008) });
        t += gaps[i] ?? 0.05;
      }
    },
  },
  /** The lullaby (dissolve + 3): a music-box G6 E6 D6, ≈ 0.7 s total. */
  hatchLullaby: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.3,
    play(v) {
      [1568, 1319, 1175].forEach((f, i) => {
        v.bell(f, { t: i * 0.16, g: 0.05, dec: 0.35, ratio: 5.4, index: 0.35 });
        v.tone('sine', f * 2, { t: i * 0.16, g: perc(0.01, 0.2, 0.002) });
      });
    },
  },
  /** The egg floats away on its cloud (burst): a rising pink air and a soft D6 → D7 glide. */
  hatchFloat: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.2,
    play(v) {
      sweep(v, 0, 0.6, [500, 1200, 2400], 0.07, { kind: 'pink', peakAt: 0.6 });
      v.tone('sine', [[0, 1175], [0.5, 2349, 'e']], { g: [[0, 0], [0.08, 0.015], [0.45, 0.01], [0.6, 0.0001, 'e']] });
    },
  },

  // ------------------------------------------------------------------ revive (soul_recall)

  /** The revive's gathering (sustained): falling air and a D5 / A5 pad. */
  hatchReviveGather: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    play(v) {
      sweep(v, 0, 0.9, [2400, 1200, 600], 0.06, { kind: 'pink' });
      for (const f of [587, 880]) v.tone('sine', f, { g: hold(0.012, 0.3, 0.8, 1.2) });
    },
  },
  /** The revive lands: the egg land, three descending unstitch ticks, a short cheep. */
  hatchReviveLand: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.2,
    play(v) {
      thump(v, 0, 420, 180, 0.3, 0.09);
      crack(v, 0.004, 0.04, { hp: 2500, lp: 7000 });
      puff(v, 0.01, 0.05, 0.12, 1200, { kind: 'brown' });
      for (let i = 0; i < 3; i++) {
        crack(v, 0.06 + i * 0.05, 0.03, { hp: 3500, dec: 0.005 });
        v.tone('sine', 2794 - i * 350, { t: 0.06 + i * 0.05, g: perc(0.015, 0.015, 0.0008) });
      }
      chirp(v, 0.22, 1175, 1568, 0.045, 0.12);
    },
  },

  // ------------------------------------------------------------------ the growth: Büyüme

  /** The circling air under the dial (sustained, built 1.6 s; stopped on growth f11). */
  hatchGrowWind: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.25,
    play(v) {
      const E = 1.6;
      // L ↔ R swings accelerating (0.4 → 0.12 s per swing): the air circles faster and faster
      const pan: Pt[] = [];
      let t = 0;
      let side = -0.6;
      let sw = 0.4;
      pan.push([0, 0]);
      while (t < E) {
        t += sw;
        pan.push([Math.min(E, t), side]);
        side = -side;
        sw = Math.max(0.12, sw * 0.82);
      }
      const out = v.panner(pan);
      const bp = v.filt('bandpass', [[0, 600], [1.2, 2400, 'e'], [E, 1800, 'e']], 1.4, { to: out });
      v.noise('pink', { g: hold(0.09, 0.25, 1.3, E), to: bp });
      // a faint low body under it (the hide stretching)
      v.noise('brown', { g: hold(0.08, 0.4, 1.3, E), to: v.filt('lowpass', 220, 0.8) });
    },
  },
  /** One revolution of the dial hand: an air pulse (no click), a soft low swell. Scene `pitch` 1 → 1.25. */
  hatchGrowFwipA: {
    cap: 3,
    gap: 0.03,
    verb: 0.3,
    play(v) {
      sweep(v, 0, 0.09, [700, 2600, 1200], 0.09, { kind: 'pink', q: 1.4, peakAt: 0.35 });
      v.tone('sine', [[0, 294], [0.08, 330, 'e']], { g: [[0, 0], [0.01, 0.02], [0.08, 0.0001, 'e']] });
    },
  },
  /** The other revolutions: the same pulse + a shell creak on top (the shell creaks every second year). */
  hatchGrowFwipB: {
    cap: 3,
    gap: 0.03,
    verb: 0.3,
    play(v) {
      sweep(v, 0, 0.09, [700, 2600, 1200], 0.09, { kind: 'pink', q: 1.4, peakAt: 0.35 });
      v.tone('sine', [[0, 294], [0.08, 330, 'e']], { g: [[0, 0], [0.01, 0.02], [0.08, 0.0001, 'e']] });
      crack(v, 0.03, 0.04, { hp: 2200, lp: 6000, n: 2, gap: 0.02 });
      v.tone('sine', [[0.03, 1760], [0.07, 1568, 'e']], { t: 0.03, g: perc(0.012, 0.05, 0.001) });
    },
  },
  /**
   * One growth hiccup (×6; the scene's `pitch` 1 / 0.841 / 0.667 / 0.561 / 0.5 / 0.375 = D6 B5 G5 E5 D5
   * A4): the hiccup voice getting heavier — every frequency (voice AND body) drops with `pitch`, the FM
   * index rises as it drops (the voice roughens).
   */
  hatchGrowHic: {
    cap: 3,
    gap: 0.04,
    verb: 0.25,
    duck: 0.2,
    play(v) {
      // step 0 … 5 read back from the pitch factor (v.pm)
      const step = GROW_STEPS.reduce((b, x, i) => (Math.abs(x - v.pm) < Math.abs(GROW_STEPS[b] - v.pm) ? i : b), 0);
      v.tone('sine', [[0, 1175], [0.04, 1400, 'e']], { g: perc(0.06, 0.05, 0.002) });
      v.bell(1175, { g: 0.03, dec: 0.07, ratio: 2, index: 0.6 + 0.25 * step });
      thump(v, 0, 220, 110, 0.25, 0.06 + 0.015 * step, { drive: 1.5 });
      sweep(v, 0, 0.12, [180, 320, 140], 0.05, { kind: 'brown', q: 6 });
    },
  },
  /** f12: the breath before the roar — a sharp intake and a one-cycle vocal catch. */
  hatchGrowGasp: {
    cap: 1,
    gap: 0.1,
    verb: 0.15,
    play(v) {
      sweep(v, 0, 0.08, [900, 2400, 1600], 0.08, { kind: 'pink', peakAt: 0.8 });
      v.tone('sine', [[0, 440], [0.06, 494, 'e']], { g: [[0, 0], [0.01, 0.02], [0.07, 0.0001, 'e']] });
    },
  },
  /** f11: the dial clicks shut — a soft low D5 bell (not brass) and an air pop (not a click). */
  hatchGrowChime: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    duck: 0.2,
    play(v) {
      v.bell(587, { g: 0.06, dec: 0.9, ratio: 2, index: 0.8 });
      v.tone('sine', 1175, { g: perc(0.02, 0.6, 0.004) });
      puff(v, 0, 0.04, 0.05, 2500, { kind: 'white' });
    },
  },
  /**
   * THE SIGNATURE (growth f13 = atMark('impact')): the voice breaks into the roar on this very frame — the
   * onset at t = 0 (a 40 ms break glide A4 → D4 under the growl's onset), the D4 / D3 growl, the ring whistle
   * sung inside it, a driven thump and a brown puff. 0.7 s.
   */
  hatchVoiceDrop: {
    cap: 1,
    gap: 0.3,
    verb: 0.4,
    duck: 0.7,
    play(v) {
      bigVoice(v, { d: 0.7, f: [294, 262, 196, 165, 147], g: 0.9, grit: 4.5, glide: [440, 294] });
      thump(v, 0, 140, 55, 0.5, 0.4, { drive: 2 });
      puff(v, 0, 0.2, 0.5, 900, { kind: 'brown' });
    },
  },
  /**
   * The un-aging hint for lane D's rewind (rewindSfx): the voice crack built backward — the growl climbs
   * 147 → 294, breaks upward 587 → 1319 and ends on a tiny squeak 1319 → 1175, a pink in-breath under it.
   * Rising, never a tape whirr.
   */
  hatchVoiceCrackRev: {
    cap: 1,
    gap: 0.3,
    verb: 0.35,
    duck: 0.4,
    play(v) {
      growl(v, 0, { d: 0.6, f: [147, 165, 196, 262, 294], formants: [520, 1250, 2600], g: 0.6, grit: 3, rasp: 30 });
      v.tone('sine', [[0, 587], [0.08, 1319, 'e']], { t: 0.55, g: [[0, 0], [0.01, 0.04], [0.08, 0.03], [0.12, 0.0001, 'e']] });
      chirp(v, 0.66, 1319, 1175, 0.045, 0.18);
      sweep(v, 0, 0.6, [500, 1400, 2600], 0.05, { kind: 'pink', peakAt: 0.9 });
    },
  },

  // ------------------------------------------------------------------ the grown voice (VARIANT_SOUNDS)

  /** The grown roar: a D3-region growl with bright formants and the sung ring whistle. */
  hatchGrownRoar: {
    cap: 1,
    gap: 0.3,
    verb: 0.4,
    duck: 0.6,
    play(v) {
      bigVoice(v, { d: 1.0, f: [196, 220, 165, 147, 110], g: 0.85, grit: 4 });
      thump(v, 0, 120, 50, 0.4, 0.3);
    },
  },
  /** The grown inhale (sustained): a lower in-breath with a soft growl under it. */
  hatchGrownInhale: {
    cap: 2,
    gap: 0.1,
    verb: 0.15,
    duck: 0.2,
    play(v) {
      sweep(v, 0, 0.8, [300, 1100, 700], 0.09, { kind: 'pink', peakAt: 0.85 });
      growl(v, 0.05, { d: 0.8, f: [147, 165, 175, 165, 147], formants: [520, 1250, 2600], g: 0.25, grit: 2, rasp: 24 });
      v.noise('pink', { t: 0.7, g: hold(0.025, 0.1, 0.6, 1.0), to: v.filt('bandpass', 1100, 2.5, { t: 0.7 }) });
    },
  },
  /** One grown forepaw stomp: a driven low thump and a shell tick. */
  hatchGrownStomp: {
    cap: 2,
    gap: 0.05,
    verb: 0.2,
    duck: 0.15,
    play(v) {
      thump(v, 0, 160, 60, 0.35, 0.12, { drive: 1.4 });
      crack(v, 0.008, 0.04, { hp: 3500, lp: 8000, dec: 0.006 });
      puff(v, 0.004, 0.06, 0.1, 700, { kind: 'brown' });
    },
  },
  /** The grown sneeze: a driven chest thud, a big air burst, a short growl. */
  hatchGrownSneeze: {
    cap: 2,
    gap: 0.1,
    verb: 0.25,
    duck: 0.4,
    play(v) {
      thump(v, 0, 180, 70, 0.4, 0.15, { drive: 2 });
      puff(v, 0, 0.35, 0.2, 4000, { kind: 'white' });
      sweep(v, 0, 0.2, [1500, 3200, 900], 0.2);
      growl(v, 0, { d: 0.3, f: [220, 196, 175, 165, 147], formants: [520, 1250, 2600], g: 0.45, grit: 3, rasp: 30 });
    },
  },
  /** The grown ring whistle (sustained): one octave lower (D6 → D7), 4 Hz flutter, a lower breath. */
  hatchGrownWhistle: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    play(v) {
      whistle(v, 0.32, 1175, 2349, 0.045, { flutter: 4, cents: 30, breath: [1000, 2000, 3200], pan: [-0.1, 0.1] });
    },
  },
  /** The grown ring's contact: the "BOOM-tıng" — a D6 bell, a driven low thump, a brown puff. */
  hatchGrownRingBoom: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.55,
    play(v) {
      glassBell(v, 1175, 0, 0.14, 0.1, { modes: 3 });
      thump(v, 0, 120, 50, 0.5, 0.2, { drive: 2 });
      puff(v, 0, 0.3, 0.2, 1500, { kind: 'brown' });
    },
  },
  /** The grown death's start: a low whimper that climbs back toward the baby's voice. */
  hatchGrownCurl: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    play(v) {
      growl(v, 0, { d: 0.25, f: [196, 233, 294, 294, 294], formants: [520, 1250, 2600], g: 0.35, grit: 2, rasp: 30 });
      const o = v.tone('sine', [[0, 587], [0.2, 880, 'e']], { t: 0.2, g: [[0, 0], [0.02, 0.04], [0.18, 0.03], [0.25, 0.0001, 'e']] });
      v.lfo(o.osc.detune, 9, 35, { t: 0.2, d: 0.26 });
    },
  },
  /** Grown death f3: the un-aging — the crack climbing back, short and soft, with three reversed shell ticks. */
  hatchUnAge: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    play(v) {
      growl(v, 0, { d: 0.22, f: [165, 196, 262, 294, 294], formants: [520, 1250, 2600], g: 0.3, grit: 2, rasp: 30 });
      v.tone('sine', [[0, 587], [0.06, 1319, 'e']], { t: 0.18, g: [[0, 0], [0.01, 0.025], [0.08, 0.0001, 'e']] });
      chirp(v, 0.24, 1319, 1175, 0.025, 0.08);
      // reversed shell ticks: each one swells into its crack
      for (let i = 0; i < 3; i++) {
        const t = 0.05 + i * 0.06;
        v.noise('white', { t, g: [[0, 0.0001], [0.02, 0.03, 'e'], [0.021, 0.0001, 'e']], to: v.filt('highpass', 3500, 0.8, { t }) });
      }
    },
  },
} satisfies Record<string, Recipe>;

export type HatchSfxName = keyof typeof V3_HATCH_RECIPES;

/** The sustained sounds (started with sfx.start, stopped on the mark that ends their picture). */
export const HATCH_SUSTAINED: readonly HatchSfxName[] = ['hatchInhale', 'hatchRingWhistle', 'hatchRingWhistleL', 'hatchRingWhistleR', 'hatchGrownInhale', 'hatchGrownWhistle', 'hatchGrowWind', 'hatchReviveGather'];
