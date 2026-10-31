// Kabuk Zıpkıncı (tide_harpooner) sounds — lane C, C1 (docs/v3/oturum-c-tasarim.md §2.1 "SOUND", YENI_KARTLAR §5.1).
// src/audio/sounds.ts spreads V3_HARPOONER_RECIPES into the game's table, SfxName gains HarpoonerSfxName and
// _v3/sound.ts CHARACTER_SOUNDS.tide_harpooner = HARPOONER_VOICE (the declaration charge, the death kit's beats, the
// cut-in's flare and the direct-hit ducking speak with this set). Nothing in the old look plays them.
//
// Identity (§5.1): the CONCH on A3 (220 Hz) — a conical, breathy horn "uuu" with two formants; the ROPE never rests on
// 220: it glides 196 ↔ 247 with stick-slip friction (§0.4.2: polar_needle owns a steady 220 hum); the material is WET
// ROPE + SEASHELL (a hollow ceramic "tok": a click into resonant band-passes at 620 / 1240 Hz). Everything is wet and
// mid-low: no glass, no metal ring, no shared v1 recipe, no tritone, no pentatonic runs, no single "pof".
//
//   harpBubble        idle: a bubble pops at the lip ("plip", a 700→1500 sine chirp) + a mussel click (−28 dB class)
//   harpTideIn        summon (arrive, sustained): the tide sheet slides in L→R, then out R→L, foam fizzing
//   harpHeave         summon: the shell heaves out of the sand (sand puff + low thump + the shell tok)
//   harpShellTok      the hollow shell "tok" alone (it rights itself, it rolls in the death)
//   harpConch         roar / cut-in flare: the conch sounds — saw scoop 196→220, two breath formants, a slow vibrato
//   harpPlant         summon land: the harpoon planted in wet sand (thump + squelch + grains)
//   harpTwirl         attack charge (sustained): the rope tension tone rising 196→233 with friction flutter
//   harpSwish         one pass of the twirl overhead (the scene steps `pitch` +8 % per pass and swings the pan)
//   harpBeads         foam beads flung off at the front pass (tiny wet crackle)
//   harpLoose         release: the rope twang (220→196, fibrous FM) + the harpoon's flight with the line paying out
//   harpWetTok        contact: the wet puncture "tok" + the jet through the far side + three droplets
//   harpHaul          haul 1: the rope creaks taut (stick-slip at 420 Hz) and its tone glides UP 220→247
//   harpRip           haul 2: the harpoon rips out ("şlk") and the slack tone falls 247→196
//   harpReel          the harpoon reeled back along the rope toward the crab
//   harpReplant       recover: re-planted ("tok") with a sand click
//   harpTang          blocked: the harpoon bites the guard and pops free (a woody knock + a slack twang)
//   harpStake         direct: the harpoon stakes into the LP panel (a dry board thock + the line snapping taut)
//   harpStruck(…)     the shell struck: Light (tok + slosh), Heavy (deeper rings + two glugs), Magic (rings up + fizz)
//   harpGuard         guard: the crab withdraws ("shuck") and the claw shuts the aperture (clack-clack)
//   harpRetract       death start: drawn into the shell (falling pink sweep + a muffled tok)
//   harpRoll          death dissolve: the shell tips and rolls (tok 620, then tok 520)
//   harpBury          death burst: buried in sand ("şşş" + thinning grains) and a last breathy whisper 220→196
//   harpSplinter      the planted harpoon splinters (+0.5 s): dry wood cracks + a small thud
//   harpBayRaise      Körfez kalkanı rises: circling water (drone on A2, NO tritone, sloshing 0.42 Hz) + plips
//   harpBayLap        the aura: one soft lap every 4 crest cycles (−32 dB class)
//   harpShlup         deflect: the oily "şlup" (sine 900→260) + the skid along the wall
//   harpStamp         the KORUNUYOR plate: a soft stamp + a conch hint on 220
//   harpBayDrop       the Bay leaves: the wall collapses and soaks into the tile

import type { Recipe } from '../sounds';
import type { CharacterSounds } from '../../cinematics/_v3/sound';
import { perc, type Pt, type Voice } from '../synth';
import { crack, drone, puff, sweep, thump } from './kit';

/** The hollow seashell resonance: a click into two resonant band-passes (620 / 1240 Hz by default). */
function shellTok(v: Voice, t: number, g: number, o: { f?: number; dec?: number; to?: AudioNode } = {}): void {
  const f = o.f ?? 620;
  const dec = o.dec ?? 0.12;
  const out = o.to;
  const b1 = v.filt('bandpass', f, 12, { to: out });
  const b2 = v.filt('bandpass', f * 2, 10, { to: out });
  // the strike: a few ms of noise excites the two modes (Q 10–12 rings them for ≈ dec)
  v.noise('white', { t, g: perc(g * 9, 0.006, 0.0003), to: b1 });
  v.noise('white', { t, g: perc(g * 5, 0.005, 0.0003), to: b2 });
  // the body of the ring (a sine pair under the band-passes keeps it from sounding like a click only)
  v.tone('sine', f, { t, g: perc(g * 0.5, dec, 0.001), to: out });
  v.tone('sine', f * 2.01, { t, g: perc(g * 0.22, dec * 0.6, 0.001), to: out });
}

/** A water droplet "plip": a sine chirp up (f0 → f1) in `d` s. */
function plip(v: Voice, t: number, g: number, f0 = 900, f1 = 1800, d = 0.015, to?: AudioNode): void {
  v.tone('sine', [[0, f0], [d, f1, 'e']], { t, g: [[0, 0], [0.002, g], [d + 0.02, 0.0001, 'e']], to });
}

/** The rope's tension tone: a triangle gliding along `f`, rubbed (stick-slip flutter at `rate` Hz). */
function ropeTone(v: Voice, t: number, f: readonly Pt[], g: readonly Pt[], o: { rate?: number; depth?: number; d: number; lp?: number; to?: AudioNode }): void {
  const lp = v.filt('lowpass', o.lp ?? 1400, 0.9, { t, to: o.to });
  const fl = v.flutter(o.rate ?? 30, o.depth ?? 0.4, { t, d: o.d, base: 0.6, to: lp });
  v.tone('triangle', f, { t, g, to: fl });
  // a fibre buzz an octave up, very low (the rope is a rough thing, not a string)
  v.tone('sawtooth', f.map(([tt, ff, c]) => [tt, ff * 2, c] as Pt), { t, g: g.map(([tt, gg, c]) => [tt, gg * 0.12, c] as Pt), to: v.filt('bandpass', 700, 2, { t, to: fl }) });
}

/** Wet rope creak: pink noise through a resonant band at 420 Hz, chopped by a stick-slip flutter (22 Hz). */
function creak(v: Voice, t: number, d: number, g: number, f = 420, to?: AudioNode): void {
  const bp = v.filt('bandpass', [[0, f * 0.92], [d, f * 1.06]], 6, { t, to });
  const fl = v.flutter(22, 0.7, { t, d, base: 0.3, to: bp });
  v.noise('pink', { t, g: [[0, 0], [0.02, g], [d * 0.7, g * 0.8], [d, 0.0001, 'e']], to: fl });
}

/** Sand: brown noise through a low-pass (a soft heavy settle). */
function sand(v: Voice, t: number, g: number, dec: number, lp = 500, to?: AudioNode): void {
  puff(v, t, g, dec, lp, { kind: 'brown', att: 0.006, to });
}

export const V3_HARPOONER_RECIPES = {
  // ---------------------------------------------------------------- idle
  harpBubble: {
    cap: 1,
    gap: 3.5,
    verb: 0.25,
    duck: 0,
    play(v) {
      plip(v, 0, 0.05, 700, 1500, 0.018);
      if (v.rnd() < 0.3) plip(v, 0.04, 0.035, 840, 1800, 0.016);
      crack(v, 0.11, 0.05, { hp: 3000, dec: 0.004 });
    },
  },

  // ---------------------------------------------------------------- summon
  harpTideIn: {
    cap: 1,
    gap: 0.3,
    verb: 0.4,
    duck: 0.35,
    play(v) {
      // in (L → R): the sheet slides over the sand; out (R → L): it recedes
      sweep(v, 0, 0.6, [400, 1400, 600], 0.26, { kind: 'pink', q: 1.1, pan: [-0.5, 0.45], peakAt: 0.5 });
      sweep(v, 0.55, 0.5, [300, 900, 250], 0.2, { kind: 'pink', q: 1.2, pan: [0.45, -0.4], peakAt: 0.35 });
      // foam fizz at the leading edge (high, sparse, thinning)
      v.crackle({ t: 0.08, d: 0.5, n: 40, g: 0.05, f: 6500, q: 0.6, dec: 0.006, curve: 1.2 });
      v.crackle({ t: 0.62, d: 0.4, n: 18, g: 0.035, f: 5200, q: 0.7, dec: 0.006, curve: 1.6 });
      // the wet body under it (a low slosh)
      v.noise('brown', { g: [[0, 0], [0.35, 0.16], [0.7, 0.09], [1.1, 0.0001, 'e']], to: v.filt('lowpass', [[0, 300], [0.4, 700], [1.1, 220, 'e']], 1.2) });
    },
  },
  harpHeave: {
    cap: 2,
    gap: 0.06,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      sand(v, 0, 0.32, 0.25, 500);
      thump(v, 0, 120, 70, 0.32, 0.18, { drive: 1.3 });
      shellTok(v, 0.012, 0.06, { f: 620, dec: 0.12 });
      v.crackle({ t: 0.03, d: 0.22, n: 10, g: 0.04, f: 2600, q: 1, dec: 0.008, kind: 'pink', curve: 1.4 });
    },
  },
  harpShellTok: {
    cap: 3,
    gap: 0.04,
    verb: 0.3,
    duck: 0.15,
    play(v) {
      shellTok(v, 0, 0.16, { f: 620, dec: 0.12 });
      sand(v, 0.004, 0.22, 0.12, 700);
    },
  },
  harpConch: {
    cap: 1,
    gap: 0.4,
    verb: 0.45,
    duck: 0.6,
    play(v) {
      const D = 1.1; // held
      const R = 0.3; // release
      const env = (g: number): Pt[] => [[0, 0], [0.12, g], [D, g * 0.85], [D + R, 0.0001, 'e']];
      const bus = v.amp(1);
      const echo = v.echo(0.18, 0.25, { wet: 0.2, tone: 2200 });
      bus.connect(echo);
      // the horn: a saw scooping up a whole tone onto A3 (196 → 220 in 120 ms), through the conical bore (lp 900)
      const lp = v.filt('lowpass', [[0, 500], [0.12, 900, 'e'], [D, 800], [D + R, 400, 'e']], 1.1, { to: bus });
      const horn = v.tone('sawtooth', [[0, 196], [0.12, 220, 'e'], [D + R, 216]], { g: env(0.17), to: lp });
      v.lfo(horn.osc.detune, 4.5, [[0, 0], [0.4, 0], [0.6, 6], [D + R, 6]], { d: D + R });
      // the bore's formants (breath "uuu"): the same saw, quieter, through 520 / 1150 Hz
      const f1 = v.filt('bandpass', 520, 3, { to: bus });
      const f2 = v.filt('bandpass', 1150, 4, { to: bus });
      const h2 = v.tone('sawtooth', [[0, 196], [0.12, 220, 'e'], [D + R, 216]], { g: env(0.1), to: f1 });
      v.lfo(h2.osc.detune, 4.5, [[0, 0], [0.4, 0], [0.6, 6], [D + R, 6]], { d: D + R });
      v.tone('sawtooth', [[0, 196], [0.12, 220, 'e'], [D + R, 216]], { g: env(0.045), to: f2 });
      // the octave partial (triangle 440, 0.3 of the horn)
      v.tone('triangle', [[0, 392], [0.12, 440, 'e'], [D + R, 432]], { g: env(0.05), to: bus });
      // the breath itself through the formants (pink, conical)
      v.noise('pink', { g: [[0, 0], [0.08, 0.16], [D, 0.11], [D + R, 0.0001, 'e']], to: f1 });
      v.noise('pink', { g: [[0, 0], [0.1, 0.07], [D, 0.05], [D + R, 0.0001, 'e']], to: f2 });
      // the low body (felt, not heard)
      v.tone('sine', [[0, 98], [0.12, 110, 'e'], [D + R, 108]], { g: env(0.12) });
    },
  },
  harpPlant: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.35,
    play(v) {
      thump(v, 0, 150, 60, 0.42, 0.14, { drive: 1.3 });
      // wet squelch: pink through a band falling 900 → 400 in 60 ms
      v.noise('pink', { t: 0.004, g: perc(0.28, 0.07, 0.003), to: v.filt('bandpass', [[0, 900], [0.06, 400, 'e']], 3, { t: 0.004 }) });
      crack(v, 0.01, 0.12, { hp: 2000, lp: 7000, n: 2, gap: 0.009, dec: 0.006 });
      v.crackle({ t: 0.03, d: 0.25, n: 12, g: 0.035, f: 3000, q: 0.9, dec: 0.007, kind: 'pink', curve: 1.5 });
    },
  },

  // ---------------------------------------------------------------- attack
  harpTwirl: {
    cap: 2,
    gap: 0.1,
    verb: 0.3,
    duck: 0.25,
    play(v) {
      // sustained (stopped on the release): the rope's tension tone rising 196 → 233 over the twirl
      const D = 0.95;
      const E = D + 0.35;
      ropeTone(v, 0, [[0, 196], [D, 233, 'e'], [E, 236]], [[0, 0], [0.1, 0.06], [D, 0.085], [E, 0.0001, 'e']], { rate: 30, depth: 0.4, d: E + 0.05, lp: 1300 });
      // the coil rustling in the claw (fibres on the shell)
      v.noise('pink', { g: [[0, 0], [0.12, 0.025], [D, 0.03], [E, 0.0001, 'e']], to: v.filt('bandpass', 2600, 1.4) });
    },
  },
  harpSwish: {
    cap: 4,
    gap: 0.05,
    verb: 0.3,
    duck: 0.1,
    play(v) {
      // one pass of the harpoon overhead (the scene sets pitch +8 % / pass and the pan in front / behind)
      sweep(v, 0, 0.19, [500, 1100, 600], 0.3, { kind: 'pink', q: 1.6, peakAt: 0.5 });
      // the rope's own whirr under it (a short flutter of a lower band)
      v.noise('pink', { g: [[0, 0], [0.09, 0.05], [0.19, 0.0001, 'e']], to: v.flutter(48, 0.5, { d: 0.2, base: 0.5, to: v.filt('bandpass', 340, 2.5) }) });
    },
  },
  harpBeads: {
    cap: 2,
    gap: 0.08,
    verb: 0.25,
    duck: 0,
    play(v) {
      v.crackle({ d: 0.12, n: 7, g: 0.07, f: 4200, q: 1.2, dec: 0.005, curve: 1.3 });
      plip(v, 0.05, 0.03, 1100, 2200, 0.012);
    },
  },
  harpLoose: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.4,
    play(v) {
      // the rope twang: a triangle snapping 220 → 196, fibrous FM (ratio 1.5, index 1 — not a metal ring)
      v.tone('triangle', [[0, 228], [0.06, 220], [0.35, 196, 'e']], { g: perc(0.24, 0.35, 0.002), to: v.filt('lowpass', 1600, 0.9) });
      v.bell(440, { g: 0.07, dec: 0.2, ratio: 1.5, index: 1, idxDec: 0.06 });
      // the throw's air (a short breath out of the shell)
      puff(v, 0, 0.12, 0.08, 1800, { kind: 'pink' });
      // flight: the harpoon with the line paying out behind it (white band, a 60 Hz flutter)
      const fl = v.flutter(60, 0.55, { t: 0.02, d: 0.3, base: 0.55, to: v.panner([[0, -0.15], [0.28, 0.3]], { t: 0.02 }) });
      v.noise('white', { t: 0.02, g: [[0, 0], [0.12, 0.13], [0.28, 0.0001, 'e']], to: v.filt('bandpass', [[0, 2000], [0.14, 3500, 'e'], [0.28, 2500, 'e']], 2, { t: 0.02, to: fl }) });
    },
  },
  harpWetTok: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.45,
    play(v) {
      // the wet tok: a driven thump 180 → 90 + a click into a 1.1 kHz band
      thump(v, 0, 180, 90, 0.55, 0.09, { drive: 1.4 });
      v.noise('white', { g: perc(0.3, 0.01, 0.0003), to: v.filt('bandpass', 1100, 5) });
      // the puncture jet through the far side: hp white, a band falling 3 kHz → 1.2 kHz
      const hp = v.filt('highpass', 1500, 0.7, { to: v.filt('bandpass', [[0, 3000], [0.35, 1200, 'e']], 1.4) });
      v.noise('white', { t: 0.004, g: perc(0.18, 0.35, 0.005), to: hp });
      // three droplets landing
      plip(v, 0.12, 0.05, 900, 1800, 0.015);
      plip(v, 0.19, 0.04, 950, 1900, 0.015);
      plip(v, 0.26, 0.032, 860, 1720, 0.015);
    },
  },
  harpHaul: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.5,
    play(v) {
      // haul 1 — the second-loudest beat: the rope snaps taut (tone glides UP 220 → 247), creaking
      ropeTone(v, 0, [[0, 220], [0.08, 247, 'e'], [0.26, 247]], [[0, 0], [0.012, 0.15], [0.18, 0.1], [0.3, 0.0001, 'e']], { rate: 22, depth: 0.5, d: 0.32, lp: 1600 });
      creak(v, 0, 0.18, 0.5, 420);
      // the brace: claws dig in (a short sand scrape)
      sand(v, 0, 0.18, 0.12, 900);
      thump(v, 0, 110, 70, 0.22, 0.1);
    },
  },
  harpRip: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      // the rip-out "şlk": noise through a band falling 2 kHz → 700
      v.noise('white', { g: perc(0.24, 0.12, 0.003), to: v.filt('bandpass', [[0, 2000], [0.12, 700, 'e']], 2.5) });
      plip(v, 0.03, 0.035, 820, 1600, 0.014);
      // the slack: the tone falls 247 → 196 and wobbles
      ropeTone(v, 0.02, [[0, 247], [0.22, 196, 'e']], [[0, 0], [0.02, 0.08], [0.25, 0.0001, 'e']], { rate: 14, depth: 0.6, d: 0.28, lp: 1200 });
      creak(v, 0.04, 0.16, 0.24, 380);
    },
  },
  harpReel: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.2,
    play(v) {
      // reeled back along the line toward the crab (the scene pans it)
      sweep(v, 0, 0.22, [1800, 2600, 1200], 0.24, { kind: 'white', q: 1.8, peakAt: 0.45 });
      v.noise('pink', { g: [[0, 0], [0.1, 0.12], [0.22, 0.0001, 'e']], to: v.flutter(36, 0.5, { d: 0.24, base: 0.5, to: v.filt('bandpass', 520, 3) }) });
      // the wet line slapping into the coil
      v.noise('pink', { t: 0.19, g: perc(0.24, 0.05, 0.002), to: v.filt('bandpass', 900, 1.5) });
    },
  },
  harpReplant: {
    cap: 2,
    gap: 0.05,
    verb: 0.25,
    duck: 0.2,
    play(v) {
      thump(v, 0, 200, 120, 0.3, 0.06);
      crack(v, 0.006, 0.09, { hp: 2400, lp: 7000, n: 2, gap: 0.01, dec: 0.005 });
      sand(v, 0.01, 0.1, 0.1, 900);
    },
  },
  harpTang: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.45,
    play(v) {
      // the harpoon bites the guard and does NOT go in: a dry woody knock (driftwood shaft, stone head on a ward)
      thump(v, 0, 240, 150, 0.3, 0.05, { drive: 1.2 });
      v.noise('white', { g: perc(0.32, 0.012, 0.0003), to: v.filt('bandpass', 1500, 4) });
      shellTok(v, 0.002, 0.04, { f: 780, dec: 0.08 });
      // it pops free: a slack twang falling 247 → 185 (the pull failed)
      v.tone('triangle', [[0, 247], [0.3, 185, 'e']], { t: 0.06, g: perc(0.16, 0.3, 0.003), to: v.filt('lowpass', 1300, 0.9) });
      v.bell(370, { t: 0.06, g: 0.04, dec: 0.16, ratio: 1.5, index: 0.8, idxDec: 0.05 });
    },
  },
  harpStake: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.5,
    play(v) {
      // the harpoon stakes into the LP panel: a dry board thock (no water here) and the line snapping taut
      thump(v, 0, 210, 95, 0.5, 0.08, { drive: 1.5 });
      v.noise('white', { g: perc(0.34, 0.014, 0.0003), to: v.filt('bandpass', 1900, 3) });
      v.noise('pink', { t: 0.002, g: perc(0.16, 0.09, 0.002), to: v.filt('bandpass', 700, 2) });
      ropeTone(v, 0.02, [[0, 233], [0.06, 247, 'e'], [0.24, 240]], [[0, 0], [0.01, 0.12], [0.26, 0.0001, 'e']], { rate: 26, depth: 0.45, d: 0.3, lp: 1500 });
    },
  },

  // ---------------------------------------------------------------- struck / guard
  harpStruckLight: {
    cap: 2,
    gap: 0.04,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      shellTok(v, 0, 0.09, { f: 620, dec: 0.12 });
      thump(v, 0, 140, 80, 0.26, 0.08);
      // the slosh inside the shell
      v.noise('pink', { t: 0.015, g: [[0, 0], [0.04, 0.14], [0.2, 0.0001, 'e']], to: v.filt('lowpass', 700, 1.4, { t: 0.015 }) });
    },
  },
  harpStruckHeavy: {
    cap: 2,
    gap: 0.04,
    verb: 0.35,
    duck: 0.45,
    play(v) {
      shellTok(v, 0, 0.1, { f: 520, dec: 0.16 });
      thump(v, 0, 120, 55, 0.42, 0.16, { drive: 1.6 });
      v.noise('pink', { t: 0.015, g: [[0, 0], [0.05, 0.16], [0.28, 0.0001, 'e']], to: v.filt('lowpass', 600, 1.4, { t: 0.015 }) });
      // two glugs (water swallowed back inside)
      v.tone('sine', [[0, 300], [0.04, 180, 'e']], { t: 0.1, g: perc(0.1, 0.05, 0.003) });
      v.tone('sine', [[0, 280], [0.04, 170, 'e']], { t: 0.19, g: perc(0.08, 0.05, 0.003) });
    },
  },
  harpStruckMagic: {
    cap: 2,
    gap: 0.04,
    verb: 0.4,
    duck: 0.35,
    play(v) {
      // the rings an octave up (the nacre flashes) and a wet fizz
      shellTok(v, 0, 0.07, { f: 1240, dec: 0.14 });
      thump(v, 0, 260, 130, 0.16, 0.06);
      const rm = v.ring(57, { d: 0.3, mix: 0.6, to: v.filt('bandpass', 2400, 1.2) });
      v.noise('white', { g: [[0, 0], [0.01, 0.08], [0.28, 0.0001, 'e']], to: rm });
      v.crackle({ t: 0.02, d: 0.3, n: 14, g: 0.035, f: 4800, q: 0.8, dec: 0.006, curve: 1.5 });
    },
  },
  harpGuard: {
    cap: 2,
    gap: 0.06,
    verb: 0.25,
    duck: 0.2,
    play(v) {
      // "shuck": into the shell (noise through a band falling 1.2 kHz → 500)
      v.noise('white', { g: perc(0.6, 0.11, 0.004), to: v.filt('bandpass', [[0, 1200], [0.09, 500, 'e']], 2.2) });
      thump(v, 0.06, 160, 100, 0.22, 0.06);
      // the claw clacks shut over the aperture (two clicks 14 ms apart) and the shell rings once, muffled
      crack(v, 0.06, 0.16, { hp: 3000, lp: 8000, n: 2, gap: 0.014, dec: 0.005 });
      shellTok(v, 0.065, 0.09, { f: 560, dec: 0.08 });
    },
  },

  // ---------------------------------------------------------------- death
  harpRetract: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      sweep(v, 0, 0.35, [900, 500, 250], 0.14, { kind: 'pink', q: 1.3, peakAt: 0.3 });
      shellTok(v, 0.2, 0.05, { f: 560, dec: 0.1, to: v.filt('lowpass', 1400, 0.8) });
      thump(v, 0.2, 110, 70, 0.16, 0.08);
    },
  },
  harpRoll: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      shellTok(v, 0, 0.15, { f: 620, dec: 0.12 });
      sand(v, 0, 0.28, 0.12, 600);
      shellTok(v, 0.12, 0.13, { f: 520, dec: 0.13 });
      sand(v, 0.12, 0.32, 0.16, 500);
    },
  },
  harpBury: {
    cap: 1,
    gap: 0.3,
    verb: 0.35,
    duck: 0.35,
    play(v) {
      // the burial "şşş": pink noise with its low-pass closing 1800 → 400 over 0.6 s, grains thinning out
      v.noise('pink', { g: [[0, 0], [0.04, 0.22], [0.3, 0.14], [0.62, 0.0001, 'e']], to: v.filt('lowpass', [[0, 1800], [0.6, 400, 'e']], 0.9) });
      v.crackle({ d: 0.6, n: 25, g: 0.05, f: 5000, q: 0.9, dec: 0.006, curve: 1.8 });
      sand(v, 0, 0.18, 0.4, 420);
      // the last breath: a breathy sine whisper 220 → 196, very low
      const bp = v.filt('bandpass', 520, 3);
      v.noise('pink', { t: 0.25, g: [[0, 0], [0.1, 0.05], [0.4, 0.0001, 'e']], to: bp });
      v.tone('sine', [[0, 220], [0.4, 196, 'e']], { t: 0.25, g: [[0, 0], [0.1, 0.03], [0.4, 0.0001, 'e']] });
    },
  },
  harpSplinter: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.2,
    play(v) {
      crack(v, 0, 0.22, { hp: 1800, lp: 6500, n: 3, gap: 0.015, dec: 0.01 });
      v.noise('pink', { g: perc(0.14, 0.05, 0.002), to: v.filt('bandpass', 1100, 2) });
      thump(v, 0.03, 170, 100, 0.16, 0.06);
      // the bits land flat (tiny wood ticks)
      v.crackle({ t: 0.12, d: 0.22, n: 7, g: 0.06, f: 2400, q: 1.6, dec: 0.006 });
    },
  },

  // ---------------------------------------------------------------- Körfez kalkanı (the signature)
  harpBayRaise: {
    cap: 1,
    gap: 0.5,
    verb: 0.5,
    duck: 0.4,
    play(v) {
      const D = 2.4;
      // circling water: a drone on A2 (110 Hz, tritone 0 — never the magus), sloshing AM + a pan circling at 0.42 Hz
      const pan = v.panner([[0, -0.4], [0.6, 0.4], [1.2, -0.4], [1.8, 0.4], [2.4, -0.3]]);
      const slosh = v.amp(0.7, { to: pan });
      v.lfo(slosh.gain, 0.42, 0.3, { d: D });
      drone(v, 0, D, 110, 0.07, { lp: [200, 900, 300], tritone: 0, beat: 0.4, to: slosh, att: 0.5 });
      // the water body itself (brown noise through the same breathing low-pass)
      const lp = v.filt('lowpass', [[0, 300], [0.5, 900, 'e'], [D, 300, 'e']], 1.4, { to: slosh });
      v.lfo(lp.frequency, 0.42, 200, { d: D });
      v.noise('brown', { g: [[0, 0], [0.4, 0.14], [1.8, 0.1], [D, 0.0001, 'e']], to: lp });
      // the wall rising: a pink swell
      sweep(v, 0, 0.45, [300, 1200, 800], 0.1, { kind: 'pink', q: 1.2, peakAt: 0.8 });
      // the foam crest running round once: a fizz that travels with the pan, bubble plips
      v.crackle({ t: 0.3, d: 0.6, n: 22, g: 0.03, f: 6000, q: 0.7, dec: 0.006, to: pan });
      [0.5, 0.86, 1.3, 1.75].forEach((t, i) => plip(v, t, 0.035 - i * 0.004, 700 + i * 60, 1500 + i * 90, 0.018));
    },
  },
  harpBayLap: {
    cap: 1,
    gap: 4,
    verb: 0.4,
    duck: 0,
    play(v) {
      // one soft lap against the wall: pink through a low-pass, a slow swell (−32 dB class)
      v.noise('pink', { g: [[0, 0], [0.9, 0.035], [2.0, 0.0001, 'e']], to: v.filt('lowpass', [[0, 300], [0.9, 600, 'e'], [2, 260, 'e']], 1.1) });
    },
  },
  harpShlup: {
    cap: 1,
    gap: 0.25,
    verb: 0.25,
    duck: 0,
    play(v) {
      // the oily "şlup": a sine falling 900 → 260 in 90 ms through a low-pass
      v.tone('sine', [[0, 900], [0.09, 260, 'e']], { g: [[0, 0], [0.004, 0.2], [0.11, 0.0001, 'e']], to: v.filt('lowpass', 1500, 0.9) });
      v.noise('pink', { g: perc(0.06, 0.05, 0.002), to: v.filt('bandpass', 700, 2) });
      // the skid along the wall: a band falling 2.5 kHz → 1.2 kHz, panned along it
      const pan = v.panner([[0, -0.2], [0.1, 0.25]], { t: 0.04 });
      v.noise('white', { t: 0.04, g: [[0, 0], [0.01, 0.07], [0.09, 0.0001, 'e']], to: v.filt('bandpass', [[0, 2500], [0.08, 1200, 'e']], 2, { t: 0.04, to: pan }) });
    },
  },
  harpStamp: {
    cap: 1,
    gap: 0.25,
    verb: 0.3,
    duck: 0,
    play(v) {
      // the plate: a soft wet stamp at 330 Hz and a conch hint (triangle 220, breathy)
      v.tone('sine', [[0, 360], [0.02, 330, 'e']], { g: perc(0.14, 0.12, 0.002) });
      v.noise('pink', { g: perc(0.08, 0.03, 0.001), to: v.filt('bandpass', 1300, 2) });
      v.tone('triangle', [[0, 208], [0.04, 220, 'e']], { t: 0.03, g: [[0, 0], [0.04, 0.06], [0.15, 0.04], [0.22, 0.0001, 'e']], to: v.filt('lowpass', 900, 1) });
      v.noise('pink', { t: 0.03, g: [[0, 0], [0.04, 0.03], [0.2, 0.0001, 'e']], to: v.filt('bandpass', 520, 3) });
    },
  },
  harpBayDrop: {
    cap: 1,
    gap: 0.3,
    verb: 0.45,
    duck: 0.3,
    play(v) {
      sweep(v, 0, 0.4, [1200, 600, 200], 0.3, { kind: 'pink', q: 1.1, peakAt: 0.2 });
      v.noise('brown', { g: perc(0.32, 0.3, 0.01), to: v.filt('lowpass', 500, 1) });
      v.crackle({ t: 0.05, d: 0.4, n: 22, g: 0.04, f: 5500, q: 0.8, dec: 0.006, curve: 1.6 });
    },
  },
} satisfies Record<string, Recipe>;

export type HarpoonerSfxName = keyof typeof V3_HARPOONER_RECIPES;

/** The sustained ones (started with sfx.start, faded on the mark that ends their picture). */
export const HARPOONER_SUSTAINED: readonly HarpoonerSfxName[] = ['harpTideIn', 'harpTwirl', 'harpBayRaise'];

/** The character set the shared v3 kits speak with (declaration charge, death beats, cut-in flare, revive). */
export const HARPOONER_VOICE = {
  roar: 'harpConch',
  arrive: 'harpTideIn',
  land: 'harpPlant',
  charge: 'harpTwirl',
  release: 'harpLoose',
  impact: 'harpWetTok',
  deathStart: 'harpRetract',
  dissolve: 'harpRoll',
  burst: 'harpBury',
  reviveGather: 'harpTideIn',
  reviveLand: 'harpPlant',
} satisfies CharacterSounds;
