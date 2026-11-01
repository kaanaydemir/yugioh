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
//   harpSeat          the reeled head seats back in the shaft's socket (a hollow wooden tock + the wet line slapping the coil)
//   harpWhip          blocked: the failed pull — the line whips back slack off the guard, wet, falling
//   harpClack         the crab outclasses its attacker: the claw door clacks, the nacre lip flicks, the shell tok answers
//   harpTang          blocked: the harpoon bites the guard and pops free (a woody knock + a slack twang)
//   harpStake         direct: the harpoon stakes into the LP panel (a dry board thock + the line snapping taut)
//   harpStruck(…)     the shell struck: Light (tok + slosh), Heavy (deeper rings + two glugs), Magic (rings up + fizz)
//   harpGuard         guard: the crab withdraws ("shuck") and the claw shuts the aperture (clack-clack)
//   harpRetract       death start: drawn into the shell (falling pink sweep + a muffled tok)
//   harpRoll          death dissolve: the shell tips and rolls (tok 620, then tok 520)
//   harpBury          death sink (sustained from the first sink frame): a closing high hiss "şşş" + 5 kHz grains
//   harpSettle        death burst: the sand settles over the apex + the last breathy whisper 220→196
//   harpRoll2         death: the second roll-map frame (lower tok + a heavier sand thud)
//   harpFwip          direct: the dry air-pass over the duelist
//   harpTik           summon: the eye stalks pop (a short wet tik)
//   harpVent          summon roar: the vapour vent (breath burst + a conch swell with a pitch dip)
//   harpSplinter      the planted harpoon splinters (+0.5 s): dry wood cracks + a small thud
//   harpBayRaise      Körfez kalkanı rises: circling water on A3/A2 (NO tritone, no sub, a deep 0.42 Hz slosh in 300–900 Hz) + plips
//   harpBayLap        the aura: one soft lap every 4 crest cycles (−32 dB class)
//   harpShlup         deflect: the oily "şlup" (sine 900→260) + the skid along the wall
//   harpStamp         the KORUNUYOR plate: a soft stamp + a conch hint on 220
//   harpBayDrop       the Bay leaves: the wall collapses and soaks into the tile

import type { Recipe } from '../sounds';
import type { CharacterSounds } from '../../cinematics/_v3/sound';
import { perc, type Pt, type Voice } from '../synth';
import { crack, puff, sweep, thump } from './kit';

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
      // ONE wide L → R wash (its contour is SPATIAL, not a spectral sweep): a broad, fixed band of water travelling
      // hard left → hard right as the sheet crosses the tile, its foam hiss riding the same pan
      const wash = v.panner([[0, -0.85], [0.55, 0.85], [1.0, 0.6]]);
      v.noise('pink', { g: [[0, 0], [0.22, 0.3], [0.5, 0.24], [0.95, 0.0001, 'e']], to: v.filt('bandpass', 760, 0.6, { to: wash }) });
      v.noise('white', { g: [[0, 0], [0.18, 0.05], [0.5, 0.035], [0.8, 0.0001, 'e']], to: v.filt('highpass', 3800, 0.7, { to: wash }) });
      v.crackle({ t: 0.06, d: 0.5, n: 34, g: 0.05, f: 6500, q: 0.6, dec: 0.006, curve: 1.1, to: wash });
      // the draw-back is NOT a second wash: a soft low gurgle as the sheet soaks away under the shell (bubbles 260–380 Hz)
      [0.6, 0.68, 0.79, 0.88, 0.99].forEach((t, i) => v.tone('sine', [[0, 380 - i * 22], [0.035, 240 - i * 12, 'e']], { t, g: perc(0.07 - i * 0.008, 0.045, 0.003) }));
      v.noise('brown', { t: 0.55, g: [[0, 0], [0.12, 0.12], [0.55, 0.0001, 'e']], to: v.filt('lowpass', 420, 1.1, { t: 0.55 }) });
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
      // a breathing envelope (never a flat block): the lip catches, swells to a peak at 0.45 s, eases, then droops
      const env = (g: number): Pt[] => [[0, 0], [0.09, g * 0.8], [0.45, g], [D, g * 0.72], [D + R, 0.0001, 'e']];
      const bus = v.amp(1);
      const echo = v.echo(0.18, 0.25, { wet: 0.2, tone: 2200 });
      bus.connect(echo);
      // the onset chiff: 40 ms of breath catching on the lip (a bright pink puff, then the horn speaks)
      v.noise('pink', { g: [[0, 0], [0.006, 0.22], [0.04, 0.0001, 'e']], to: v.filt('bandpass', 1900, 1.4) });
      // pitch: scoop up a whole tone onto A3, sit, and droop 220 → 212 on the release
      const F = (k: number): Pt[] => [[0, 196 * k], [0.12, 220 * k, 'e'], [D, 219 * k], [D + R, 212 * k, 'e']];
      const lp = v.filt('lowpass', [[0, 500], [0.12, 900, 'e'], [0.45, 1050, 'e'], [D, 780], [D + R, 380, 'e']], 1.1, { to: bus });
      const horn = v.tone('sawtooth', F(1), { g: env(0.17), to: lp });
      v.lfo(horn.osc.detune, 4.5, [[0, 0], [0.4, 0], [0.6, 6], [D + R, 7]], { d: D + R });
      // the bore's formants (breath "uuu"): the same saw, quieter, through 520 / 1150 Hz
      const f1 = v.filt('bandpass', 520, 3, { to: bus });
      const f2 = v.filt('bandpass', 1150, 4, { to: bus });
      const h2 = v.tone('sawtooth', F(1), { g: env(0.1), to: f1 });
      v.lfo(h2.osc.detune, 4.5, [[0, 0], [0.4, 0], [0.6, 6], [D + R, 7]], { d: D + R });
      v.tone('sawtooth', F(1), { g: env(0.045), to: f2 });
      v.tone('triangle', F(2), { g: env(0.05), to: bus });
      // the breath itself through the formants (pink, conical), swelling with the horn
      v.noise('pink', { g: [[0, 0], [0.08, 0.14], [0.45, 0.17], [D, 0.1], [D + R, 0.0001, 'e']], to: f1 });
      v.noise('pink', { g: [[0, 0], [0.1, 0.06], [0.45, 0.075], [D, 0.045], [D + R, 0.0001, 'e']], to: f2 });
      v.tone('sine', F(1), { g: env(0.1) });
    },
  },
  harpPlant: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.35,
    play(v) {
      // LEADS with the wet squelch (pink through a band falling 900 → 400) and the grains; the low thump is a
      // supporting layer only (−4 dB, kept above 90 Hz: the planting stays wet, not a body fall)
      v.noise('pink', { g: perc(2.6, 0.14, 0.003), to: v.filt('bandpass', [[0, 900], [0.06, 380, 'e']], 4.5) });
      v.noise('white', { t: 0.002, g: perc(0.9, 0.035, 0.001), to: v.filt('bandpass', 760, 4, { t: 0.002 }) });
      thump(v, 0.004, 200, 150, 0.4, 0.07, { drive: 1.1 });
      crack(v, 0.01, 0.45, { hp: 4200, lp: 9000, n: 3, gap: 0.009, dec: 0.006 });
      v.crackle({ t: 0.025, d: 0.28, n: 18, g: 0.3, f: 5200, q: 2.2, dec: 0.007, kind: 'pink', curve: 1.4 });
      // the wet slap of the sand taking the shaft (a low-mid body, 380 Hz, 90 ms)
      v.noise('pink', { t: 0.003, g: perc(1.2, 0.09, 0.004), to: v.filt('bandpass', 380, 2.2, { t: 0.003 }) });
      // the shaft settles in the wet sand: a short suck closing 600 → 300 (wet, mid — not a thump)
      v.noise('pink', { t: 0.05, g: [[0, 0], [0.02, 0.9], [0.16, 0.0001, 'e']], to: v.filt('bandpass', [[0, 600], [0.14, 300, 'e']], 4, { t: 0.05 }) });
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
    duck: 0.45,
    play(v) {
      // the SNAP of the throw: a short driven thump 250 → 140 and a fibre crack (the line leaving the claw's grip)
      thump(v, 0, 250, 140, 0.8, 0.07, { drive: 1.8 });
      crack(v, 0.002, 0.5, { hp: 2200, lp: 9000, n: 2, gap: 0.007, dec: 0.008 });
      v.noise('pink', { g: perc(0.22, 0.025, 0.0008), to: v.filt('bandpass', 1300, 2.2) });
      // the rope twang (+6 dB): a triangle snapping 228 → 196, fibrous FM (ratio 1.5, index 1 — not a metal ring)
      v.tone('triangle', [[0, 236], [0.05, 220], [0.36, 196, 'e']], { g: perc(0.48, 0.36, 0.002), to: v.filt('lowpass', 1700, 0.9) });
      v.bell(440, { g: 0.13, dec: 0.22, ratio: 1.5, index: 1, idxDec: 0.06 });
      // the throw's air (a short breath out of the shell)
      puff(v, 0, 0.14, 0.08, 1800, { kind: 'pink' });
      // flight: the harpoon with the line paying out behind it (white band, a 60 Hz flutter)
      const fl = v.flutter(60, 0.55, { t: 0.02, d: 0.3, base: 0.55, to: v.panner([[0, -0.15], [0.28, 0.3]], { t: 0.02 }) });
      v.noise('white', { t: 0.02, g: [[0, 0], [0.1, 0.15], [0.26, 0.0001, 'e']], to: v.filt('bandpass', [[0, 2000], [0.14, 3500, 'e'], [0.28, 2500, 'e']], 2, { t: 0.02, to: fl }) });
    },
  },
  harpWetTok: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.45,
    play(v) {
      // the wet puncture: its weight is the CLICK (1.1 kHz), the hollow shell / driftwood ring the head carries
      // (740 / 1480) and the JET (1.5–3 kHz) — the low thump is only a short knock under it
      v.noise('white', { g: perc(1.4, 0.014, 0.0003), to: v.filt('bandpass', 1100, 4) });
      shellTok(v, 0.001, 0.35, { f: 740, dec: 0.1 });
      thump(v, 0, 210, 140, 0.56, 0.045, { drive: 1.3 });
      // the puncture jet through the far side: hp white, a band falling 3 kHz → 1.5 kHz
      const hp = v.filt('highpass', 1500, 0.7, { to: v.filt('bandpass', [[0, 3200], [0.3, 1500, 'e']], 1.3) });
      v.noise('white', { t: 0.004, g: perc(0.82, 0.3, 0.004), to: hp });
      // three droplets landing
      plip(v, 0.12, 0.13, 900, 1800, 0.015);
      plip(v, 0.19, 0.1, 950, 1900, 0.015);
      plip(v, 0.26, 0.08, 860, 1720, 0.015);
    },
  },
  harpHaul: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.55,
    play(v) {
      // haul 1 — the second-loudest beat. t = 0: the BRACE (rear legs dig in: a low driven thump + a sand scrape)
      thump(v, 0, 130, 62, 0.5, 0.13, { drive: 1.5 });
      v.noise('pink', { g: [[0, 0], [0.006, 0.32], [0.1, 0.0001, 'e']], to: v.filt('bandpass', [[0, 1600], [0.1, 700, 'e']], 1.6) });
      sand(v, 0, 0.26, 0.14, 900);
      // the rope snaps taut: its tone glides UP 220 → 247 and RINGS there 50 ms longer, creaking (double gain)
      ropeTone(v, 0, [[0, 220], [0.08, 247, 'e'], [0.31, 247]], [[0, 0], [0.012, 0.22], [0.23, 0.15], [0.36, 0.0001, 'e']], { rate: 22, depth: 0.5, d: 0.38, lp: 1700 });
      creak(v, 0, 0.22, 1.0, 420);
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
  harpSeat: {
    cap: 2,
    gap: 0.05,
    verb: 0.25,
    duck: 0.2,
    play(v) {
      // the toggle head seats in the socket: a hollow wooden tock (driftwood on driftwood, the collar rings once)
      thump(v, 0, 300, 190, 0.22, 0.04, { drive: 1.2 });
      v.noise('white', { g: perc(0.26, 0.008, 0.0003), to: v.filt('bandpass', 1750, 6) });
      shellTok(v, 0.001, 0.035, { f: 880, dec: 0.06 });
      // the wet line slapping into the coil, a drip off it
      v.noise('pink', { t: 0.03, g: perc(0.14, 0.05, 0.002), to: v.filt('bandpass', 900, 1.5, { t: 0.03 }) });
      plip(v, 0.11, 0.03, 880, 1760, 0.014);
    },
  },
  harpWhip: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      // the pull failed: the line whips back slack (a falling pink whip), its tone sagging 233 → 185, water flicked off
      sweep(v, 0, 0.2, [1500, 700, 300], 0.22, { kind: 'pink', q: 1.6, peakAt: 0.15, pan: [0.15, -0.15] });
      ropeTone(v, 0.01, [[0, 233], [0.26, 185, 'e']], [[0, 0], [0.015, 0.09], [0.28, 0.0001, 'e']], { rate: 12, depth: 0.7, d: 0.3, lp: 1100 });
      v.crackle({ t: 0.04, d: 0.16, n: 8, g: 0.05, f: 3800, q: 1, dec: 0.005, curve: 1.4 });
      plip(v, 0.16, 0.03, 900, 1800, 0.015);
    },
  },
  harpClack: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.35,
    play(v) {
      // the attacker breaks on the shell: the claw door clacks twice, the shell tok rings (620 / 1240), a slosh inside
      crack(v, 0, 0.24, { hp: 3000, lp: 8000, n: 2, gap: 0.014, dec: 0.005 });
      shellTok(v, 0.004, 0.13, { f: 620, dec: 0.14 });
      thump(v, 0, 150, 90, 0.22, 0.07);
      // the nacre lip flicks: a short wet upward chirp (water, not glass)
      plip(v, 0.03, 0.05, 700, 1500, 0.02);
      v.noise('pink', { t: 0.02, g: [[0, 0], [0.04, 0.12], [0.22, 0.0001, 'e']], to: v.filt('lowpass', 700, 1.4, { t: 0.02 }) });
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
    duck: 0.35,
    play(v) {
      // drawn into the shell: a wet suck (pink band falling 1.2 kHz → 300) and the muffled tok as the claw door shuts
      v.noise('pink', { g: [[0, 0], [0.03, 1.0], [0.24, 0.0001, 'e']], to: v.filt('bandpass', [[0, 1300], [0.22, 320, 'e']], 1.6) });
      v.noise('white', { g: perc(0.2, 0.04, 0.002), to: v.filt('bandpass', 2400, 2) });
      shellTok(v, 0.13, 0.2, { f: 560, dec: 0.1, to: v.filt('lowpass', 1400, 0.8) });
      thump(v, 0.13, 110, 70, 0.45, 0.09, { drive: 1.2 });
    },
  },
  harpRoll: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.35,
    play(v) {
      // death dissolve, first roll-map frame: the shell tips over — its tok (620) and a SAND THUD under it
      shellTok(v, 0, 0.5, { f: 620, dec: 0.13 });
      thump(v, 0, 120, 70, 0.6, 0.12, { drive: 1.3 });
      sand(v, 0.003, 0.6, 0.14, 650);
    },
  },
  harpRoll2: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.35,
    play(v) {
      // the second roll-map frame: it lands on its side — the lower tok (520) and a heavier sand thud
      shellTok(v, 0, 0.45, { f: 520, dec: 0.14 });
      thump(v, 0, 105, 58, 0.7, 0.15, { drive: 1.4 });
      sand(v, 0.003, 0.7, 0.18, 550);
    },
  },
  harpBury: {
    cap: 1,
    gap: 0.3,
    verb: 0.35,
    duck: 0.35,
    play(v) {
      // SUSTAINED (started on the first sink frame, faded on the burst): the burial "şşş" — a HIGH hiss that closes
      // (its band stays put at 1.8 kHz → narrowing; no sweep), sand grains at 5 kHz thinning out, the sand bed high-
      // passed at 150 Hz so the hiss is the body, never a low rumble
      const D = 1.2;
      const hiss = v.filt('bandpass', 2000, [[0, 0.7], [D, 2.6, 'e']], { to: v.filt('highpass', 400, 0.7) });
      v.noise('white', { g: [[0, 0], [0.03, 0.6], [0.45, 0.45], [0.9, 0.28], [D, 0.0001, 'e']], to: hiss });
      v.crackle({ d: D, n: 46, g: 0.16, f: 5000, q: 0.9, dec: 0.006, curve: 1.9 });
      v.crackle({ t: 0.05, d: D - 0.1, n: 18, g: 0.11, f: 2600, q: 1.1, dec: 0.008, kind: 'pink', curve: 1.6 });
      v.noise('brown', { g: [[0, 0], [0.05, 0.42], [D, 0.0001, 'e']], to: v.filt('highpass', 150, 0.7, { to: v.filt('lowpass', 700, 0.8) }) });
    },
  },
  harpSettle: {
    cap: 1,
    gap: 0.3,
    verb: 0.4,
    duck: 0.3,
    play(v) {
      // the burst role: the sand closes over the apex (a soft settle, high-passed) and the LAST BREATH — a breathy
      // conch whisper 220 → 196 through the bore's formant
      v.noise('pink', { g: perc(0.6, 0.12, 0.004), to: v.filt('bandpass', 1500, 1.2) });
      v.crackle({ d: 0.25, n: 10, g: 0.14, f: 4200, q: 1, dec: 0.006, curve: 1.8 });
      const bp = v.filt('bandpass', 520, 3);
      v.noise('pink', { t: 0.06, g: [[0, 0], [0.08, 0.3], [0.45, 0.0001, 'e']], to: bp });
      v.tone('sine', [[0, 220], [0.45, 196, 'e']], { t: 0.06, g: [[0, 0], [0.08, 0.15], [0.45, 0.0001, 'e']] });
    },
  },
  harpSplinter: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.25,
    play(v) {
      crack(v, 0, 0.42, { hp: 1800, lp: 6500, n: 3, gap: 0.015, dec: 0.01 });
      v.noise('pink', { g: perc(0.3, 0.05, 0.002), to: v.filt('bandpass', 1100, 2) });
      thump(v, 0.03, 170, 100, 0.32, 0.06);
      // the bits land flat (tiny wood ticks)
      v.crackle({ t: 0.12, d: 0.22, n: 7, g: 0.11, f: 2400, q: 1.6, dec: 0.006 });
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
      // circling water on A (110 / 220, the 220 leading — never the magus' D sub drone, no tritone), nothing under
      // 90 Hz; the energy is the SLOSH: pink noise in the 300–900 Hz band, deeply amplitude-modulated at 0.42 Hz (the
      // crest's period) while a panner circles at the same rate
      const pan = v.panner([[0, -0.45], [0.6, 0.45], [1.2, -0.45], [1.8, 0.45], [2.4, -0.3]]);
      const hp = v.filt('highpass', 95, 0.7, { to: pan });
      const slosh = v.amp(0.9, { to: hp });
      v.lfo(slosh.gain, 0.42, 0.72, { d: D });
      // the tone: triangle 220 over a quieter 110, breathing through a low-pass that opens with each lap
      const lpT = v.filt('lowpass', [[0, 500], [0.5, 1300, 'e'], [D, 600, 'e']], 1.2, { to: slosh });
      v.lfo(lpT.frequency, 0.42, 380, { d: D });
      const envT = (g: number): Pt[] => [[0, 0], [0.45, g], [1.9, g * 0.8], [D, 0.0001, 'e']];
      v.tone('triangle', [[0, 208], [0.3, 220, 'e'], [D, 218]], { g: envT(0.075), to: lpT });
      v.tone('triangle', [[0, 104], [0.3, 110, 'e'], [D, 109]], { g: envT(0.03), to: lpT });
      v.tone('sine', [[0, 440], [D, 436]], { g: envT(0.018), to: lpT });
      // the water: pink through a band rocking 300 ↔ 900 Hz with the laps
      const bp = v.filt('bandpass', [[0, 340], [0.6, 820, 'e'], [1.2, 380, 'e'], [1.8, 860, 'e'], [D, 420, 'e']], 2.6, { to: slosh });
      v.noise('pink', { g: [[0, 0], [0.4, 0.34], [1.9, 0.26], [D, 0.0001, 'e']], to: bp });
      // the wall rising: a pink swell
      sweep(v, 0, 0.45, [300, 1200, 800], 0.12, { kind: 'pink', q: 1.2, peakAt: 0.8 });
      // the foam crest running round once: a fizz that travels with the pan, bubble plips
      v.crackle({ t: 0.3, d: 0.6, n: 22, g: 0.035, f: 6000, q: 0.7, dec: 0.006, to: pan });
      [0.5, 0.86, 1.3, 1.75].forEach((t, i) => plip(v, t, 0.04 - i * 0.004, 700 + i * 60, 1500 + i * 90, 0.018));
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
      // the wall COLLAPSES: one flat slap of water on the tile (a hard-attack band at 1.2 kHz + a short knock) …
      v.noise('white', { g: perc(0.36, 0.06, 0.0008), to: v.filt('bandpass', 1200, 1.6) });
      thump(v, 0, 170, 85, 0.26, 0.07);
      // … then it SOAKS into the tile: a gurgle (sine bubbles falling) under a fading low wet bed
      [0.08, 0.15, 0.2, 0.29, 0.36, 0.47].forEach((t, i) => v.tone('sine', [[0, 340 - i * 18], [0.04, 200 - i * 10, 'e']], { t, g: perc(0.09 - i * 0.01, 0.05, 0.003) }));
      v.noise('brown', { t: 0.05, g: [[0, 0], [0.06, 0.2], [0.6, 0.0001, 'e']], to: v.filt('lowpass', 380, 1.2, { t: 0.05 }) });
    },
  },
  harpFwip: {
    cap: 2,
    gap: 0.05,
    verb: 0.2,
    duck: 0.2,
    play(v) {
      // direct: the head passes the duelist — a dry air "fwip" (white, a fast band rise and fall), no water
      sweep(v, 0, 0.09, [1400, 3200, 1800], 0.85, { kind: 'white', q: 2.2, peakAt: 0.4, pan: [-0.2, 0.25] });
      v.noise('pink', { g: perc(0.2, 0.04, 0.003), to: v.filt('bandpass', 700, 2) });
    },
  },
  harpTik: {
    cap: 2,
    gap: 0.05,
    verb: 0.2,
    duck: 0,
    play(v) {
      // summon: the eye stalks pop up — a short WET "tik" (a tight 2.6 kHz click with a tiny water tail), not a bubble
      v.noise('white', { g: perc(0.3, 0.006, 0.0002), to: v.filt('bandpass', 2600, 6) });
      v.tone('sine', [[0, 1700], [0.012, 1250, 'e']], { g: perc(0.06, 0.02, 0.001) });
      v.noise('white', { t: 0.035, g: perc(0.18, 0.005, 0.0002), to: v.filt('bandpass', 3000, 6, { t: 0.035 }) });
    },
  },
  harpVent: {
    cap: 1,
    gap: 0.3,
    verb: 0.45,
    duck: 0.4,
    play(v) {
      // the roar's VENT (vapour out of the apex): a breath burst (pink, a fast bright onset) and a conch SWELL — the
      // horn crescendos +4 dB and dips 220 → 214 on the release
      v.noise('pink', { g: [[0, 0], [0.012, 0.36], [0.25, 0.08], [0.5, 0.0001, 'e']], to: v.filt('bandpass', [[0, 2400], [0.4, 900, 'e']], 0.9) });
      v.noise('white', { g: perc(0.1, 0.06, 0.002), to: v.filt('highpass', 4000, 0.7) });
      const lp = v.filt('lowpass', [[0, 700], [0.3, 1300, 'e'], [0.62, 600, 'e']], 1.1);
      const g: Pt[] = [[0, 0], [0.05, 0.1], [0.3, 0.16], [0.62, 0.0001, 'e']];
      const f: Pt[] = [[0, 220], [0.3, 220], [0.62, 214, 'e']];
      v.tone('sawtooth', f, { g, to: lp });
      v.tone('sawtooth', f, { g: g.map(([t, x, c]) => [t, x * 0.6, c] as Pt), to: v.filt('bandpass', 520, 3) });
      v.tone('sine', f, { g: g.map(([t, x, c]) => [t, x * 0.6, c] as Pt) });
    },
  },
} satisfies Record<string, Recipe>;

export type HarpoonerSfxName = keyof typeof V3_HARPOONER_RECIPES;

/** The sustained ones (started with sfx.start, faded on the mark that ends their picture). */
export const HARPOONER_SUSTAINED: readonly HarpoonerSfxName[] = ['harpTideIn', 'harpTwirl', 'harpBayRaise', 'harpBury'];

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
  burst: 'harpSettle',
  reviveGather: 'harpTideIn',
  reviveLand: 'harpPlant',
} satisfies CharacterSounds;
