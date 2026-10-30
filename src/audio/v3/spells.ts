// v3 spell / trap sounds — lane A5-A (docs/v3/A5_PLAN.md §4.6; REHBER SE-1 … SE-8).
// src/audio/sounds.ts spreads V3_SPELL_RECIPES into the game's table and SfxName gains V3SpellSfxName
// (both written once in A56.0; the lane never touches those two files). Nothing plays these until a
// lane-A5-A v3 scene calls them (behind V3_A5_A) on its marks (src/cinematics/_v3/sound.ts play /
// start); the old look never does.
//
// Built from the ./kit.ts blocks and the Voice primitives (no new DSP, SE-3); the only local helper
// is plateBell(), the mirror's struck-plate partials (a parameter set like kit.glassBell's, with plate
// ratios instead of the wyrm's free-free bar modes). Family: the spell / trap scenes. A6's UI sounds
// (ui3*, ./ui-cards.ts, ./ui-flow.ts) are another family ("neon cam + keçe"); no name is shared.
//
// Palettes (one per card, kept apart from the slice characters, SE-4):
//   Şifa Pınarı    water: foam sweeps, sine "bloops" on A minor pentatonic A4–E5 (far below the
//                  wyrm's E6–B7 glass); every drop one step up the ladder (the scene passes `pitch`).
//   Ruh Çağrısı    a hollow soft formant (a gentle growl, no grit), one soft bell, pink air.
//   Ejder Kılıcı   gold metal: FM clanks (ratio 1.41) and rising narrow sweeps; the bond is an anvil.
//   Volkan Arenası fire / stone: low thumps, brown rumble, crackle; steam is falling white noise.
//   Ayna Kalkanı   glass PLATE: whole-tone ticks on plate ratios (1 : 1.59 : 2.14 : 2.65), short and
//                  dry — not the wyrm's ringing bar modes: the build ticks C5–F#5 over a low "thock",
//                  the beam on E6, the break a dry plate crack with C5–F#6 shards (LSD vs the wyrm's
//                  glass roles and the crystal hits ≥ 10.8 dB, measured in A-4; ≥ 11.4 dB after A-8).
//   Yer Yarığı     earth: crackle trains, hollow low "whoomp", gravel bursts, a heavy slam and dust.
// Levels follow the slice (src/audio/v3/slice.ts): the big beats duck the music ≥ 0.55, small ones
// ≤ 0.3 (SE-7, the §4.6 table). Sounds that land on the victim's own death frame (mirrorBeam,
// chasmFall) sit an octave away from its body and stay short (SE-5 spirit).
// A5-A step A-8 (the sound pass, measured offline on the game's own renders — SE-8): the mirror's beats
// were 7–12 dB under the slice's trap climax (Işık Zincirleri chainBind −10.4 / −7.9 LUFS 400 / 100 ms
// in its scene), so its catch, beams, build and break got more weight (catch +3, break +7.6, build +2.7,
// beams +2.6 dB at 100 ms); the sword's break +3.9, the spring's rise +2, the grave's opening +1.1 dB; the
// eruption carries more of its fire (a brighter crackle) and now sits ≥ 10 dB LSD from the chasm's
// hollow opening and fall. Every recipe peaks ≤ −1.46 dBFS through the v3 chain (0 clipped samples);
// the mirror's glass stays ≥ 11.4 dB LSD from the wyrm's glass roles and the crystal hits.

import type { Recipe } from '../sounds';
import { midiHz, perc, swell, type Voice } from '../synth';
import { clank, crack, growl, link, puff, sweep, thump } from './kit';

// ================================================================ local helper

/** Struck glass-plate partials (the mirror): inharmonic plate ratios, the upper ones die first. */
const PLATE_MODES: readonly (readonly [ratio: number, gain: number, decay: number])[] = [
  [1, 1, 1],
  [1.594, 0.5, 0.6],
  [2.136, 0.3, 0.42],
  [2.653, 0.16, 0.3],
];

function plateBell(v: Voice, f: number, t: number, g: number, dec: number, o: { to?: AudioNode; modes?: number } = {}): void {
  const n = Math.min(PLATE_MODES.length, o.modes ?? 4);
  for (let i = 0; i < n; i++) {
    const [r, a, d] = PLATE_MODES[i];
    if (f * r > 15000) break;
    v.tone('sine', f * r, { t, g: perc(g * a, dec * d, 0.0006), to: o.to });
  }
}

/** A minor pentatonic, A4 … E5 (the spring), and the mirror's whole-tone ticks C6 … F#6. */
const SPRING = [69, 72, 74, 76] as const;
const MIRROR = [84, 86, 88, 90] as const;

export const V3_SPELL_RECIPES = {
  // ================================================================ Şifa Pınarı
  /** The spring bursts up: a foam rush and three rising "blips" (A4, C5, E5), a low swell under it. */
  springRise: {
    cap: 1,
    gap: 0.15,
    verb: 0.4,
    duck: 0.3,
    play(v) {
      sweep(v, 0, 0.36, [700, 2600, 1300], 0.26, { kind: 'white', q: 1.1, peakAt: 0.3 });
      puff(v, 0.01, 0.2, 0.3, 1400, { kind: 'pink' });
      v.tone('sine', [[0, 110], [0.22, 165, 'e']], { g: perc(0.17, 0.32, 0.02) });
      [SPRING[0], SPRING[1], SPRING[3]].forEach((m, i) => {
        const f = midiHz(m);
        v.tone('sine', [[0, f * 0.86], [0.035, f, 'e']], { t: 0.03 + i * 0.06, g: perc(0.17, 0.13, 0.003) });
      });
    },
  },
  /** One drop lands on the duelist: a sine "bloop" falling 15 %, a tiny droplet tick (×6, pitch steps up). */
  springDrop: {
    cap: 6,
    gap: 0.02,
    verb: 0.35,
    play(v) {
      const f = midiHz(SPRING[0] + 12); // A5: an octave over the rise's ladder
      v.tone('sine', [[0, f], [0.07, f * 0.85, 'e']], { g: perc(0.13, 0.1, 0.002) });
      v.tone('sine', f * 2.01, { g: perc(0.03, 0.04, 0.001) });
      v.noise('white', { g: perc(0.06, 0.006, 0.0002), to: v.filt('highpass', 3200) });
    },
  },
  /** The spring sinks: a low water slap (lp 900 Hz), a short ring (E5). */
  springSettle: {
    cap: 1,
    gap: 0.15,
    verb: 0.45,
    play(v) {
      puff(v, 0, 0.32, 0.36, 900, { kind: 'pink' });
      thump(v, 0, 120, 60, 0.22, 0.2);
      v.tone('sine', midiHz(SPRING[3]), { t: 0.02, g: perc(0.05, 0.38, 0.004) });
      v.tone('sine', midiHz(SPRING[3]) * 1.5, { t: 0.02, g: perc(0.018, 0.2, 0.004) });
    },
  },

  // ================================================================ Ruh Çağrısı
  /** The grave opens: a hollow low voice (a soft formant growl, no grit) and one soft bell. */
  recallOpen: {
    cap: 1,
    gap: 0.2,
    verb: 0.55,
    duck: 0.3,
    play(v) {
      growl(v, 0, { d: 0.7, f: [62, 74, 70, 58, 46], formants: [280, 620, 1500], g: 0.33, grit: 1.2, rasp: 18 });
      clank(v, midiHz(72), 0.05, 0.09, 1.1, { ratio: 2, index: 1.1, click: 0 });
      v.noise('pink', { g: [[0, 0], [0.12, 0.1], [0.7, 0.0001, 'e']], to: v.filt('lowpass', [[0, 300], [0.7, 900, 'e']], 0.9) });
    },
  },
  /**
   * The soul glides out of the grave: a pink-noise sweep, a few soft pings. Centred: the glide runs
   * either way (P1's graveyard is on the right, P2's on the left), so the scene pans it (A-7).
   */
  recallGlide: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    play(v) {
      sweep(v, 0, 0.55, [500, 1800, 800], 0.32, { kind: 'pink', q: 1.4, peakAt: 0.5 });
      [93, 96, 100].forEach((m, i) => v.bell(midiHz(m), { t: 0.12 + i * 0.13, g: 0.05, dec: 0.4, ratio: 2, index: 0.5 }));
    },
  },

  // ================================================================ Ejder Kılıcı
  /** The sword draws itself out of the card: a rising metal "shiing". */
  bladeForge: {
    cap: 1,
    gap: 0.15,
    verb: 0.45,
    duck: 0.2,
    play(v) {
      clank(v, 880, 0, 0.1, 0.7, { ratio: 1.41, index: 2.2, click: 0.8 });
      sweep(v, 0, 0.3, [1600, 4800, 6400], 0.18, { kind: 'white', q: 6, peakAt: 0.75 });
      v.tone('sine', [[0, 1200], [0.26, 2400, 'e']], { g: [[0, 0], [0.04, 0.065], [0.28, 0.05], [0.5, 0.0001, 'e']] });
      v.tone('sine', [[0, 2400], [0.26, 4800, 'e']], { g: [[0, 0], [0.06, 0.018], [0.4, 0.0001, 'e']] });
    },
  },
  /** The sword flies to the monster: an air sweep with a ringing metal tail. */
  bladeFly: {
    cap: 2,
    gap: 0.08,
    verb: 0.4,
    play(v) {
      sweep(v, 0, 0.2, [900, 3200, 1400], 0.28, { kind: 'white', q: 1.3, pan: [-0.3, 0.3] });
      v.bell(1760, { t: 0.04, g: 0.05, dec: 0.45, ratio: 1.41, index: 1.4 });
    },
  },
  /** The bond: an anvil strike (clank + thump) and a low gold swell under it. */
  bladeBond: {
    cap: 1,
    gap: 0.1,
    verb: 0.5,
    duck: 0.45,
    play(v) {
      clank(v, 1046, 0, 0.17, 1.0, { ratio: 1.41, index: 3.2, click: 1.8 });
      clank(v, 1046 * 2.01, 0.004, 0.05, 0.6, { ratio: 1.17, index: 1.4, click: 0 });
      thump(v, 0, 150, 52, 0.55, 0.3, { drive: 1.6 });
      v.tone('sine', [[0, 82], [0.4, 110, 'e']], { g: [[0, 0], [0.06, 0.16], [0.35, 0.1], [0.9, 0.0001, 'e']] });
      for (const m of [69, 73, 76]) v.tone('triangle', midiHz(m), { t: 0.02, g: [[0, 0], [0.04, 0.035], [0.3, 0.025], [0.8, 0.0001, 'e']], detune: v.r(-5, 5) });
    },
  },
  /** The sword breaks: a crack and the shards' little metal clinks falling to the floor. */
  bladeBreak: {
    cap: 1,
    gap: 0.1,
    verb: 0.4,
    duck: 0.3,
    play(v) {
      crack(v, 0, 0.6, { hp: 2400, n: 2, gap: 0.014 });
      clank(v, 740, 0, 0.13, 0.45, { ratio: 1.41, index: 2.4, click: 0 });
      for (let i = 0; i < 6; i++) link(v, 3400 - i * 260 + v.r(-90, 90), 0.06 + i * 0.05 + v.r(0, 0.02), 0.09 * (1 - i * 0.08), 0.07);
    },
  },

  // ================================================================ Volkan Arenası
  /** The field card slams down on its zone: a thump with a crackle. */
  volcanoSlam: {
    cap: 1,
    gap: 0.1,
    verb: 0.35,
    duck: 0.3,
    play(v) {
      thump(v, 0, 130, 46, 0.55, 0.32, { drive: 1.8 });
      v.noise('white', { g: perc(0.22, 0.02, 0.0003), to: v.filt('bandpass', 1800, 1.2) });
      v.crackle({ t: 0.01, d: 0.3, n: 12, g: 0.13, f: 2800, q: 0.8, curve: 1.6, dec: 0.004 });
    },
  },
  /** The eruption: a deep thump, a brown-noise rumble and crackles (the big beat of the card). */
  volcanoErupt: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    duck: 0.6,
    play(v) {
      thump(v, 0, 78, 30, 0.8, 0.8, { drive: 2 });
      v.noise('brown', { g: [[0, 0], [0.05, 0.5], [0.55, 0.3], [1.2, 0.0001, 'e']], to: v.filt('lowpass', [[0, 520], [1.2, 150, 'e']], 0.9) });
      puff(v, 0.005, 0.3, 0.35, 1600, { kind: 'pink' });
      v.crackle({ t: 0.02, d: 0.9, n: 44, g: 0.24, f: 5200, q: 0.8, curve: 1.7, dec: 0.004 });
    },
  },
  /** The lava front creeping over the board (SUSTAINED: started at the eruption, stopped 120 ms after the last blow). */
  lavaCreep: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play(v) {
      const D = 2.6;
      const lp = v.filt('lowpass', 210, 0.8);
      const n = v.noise('brown', { g: [[0, 0], [0.18, 0.28], [D - 0.4, 0.24], [D, 0.0001, 'e']], to: lp });
      v.wander(n.amp.gain, 3, 0.06, { d: D });
      v.tone('sine', 55, { g: [[0, 0], [0.2, 0.05], [D - 0.4, 0.04], [D, 0.0001, 'e']] });
      v.crackle({ t: 0.1, d: D - 0.5, n: 14, g: 0.07, f: 2400, q: 0.8, curve: 1, dec: 0.004 });
    },
  },
  /** A FIRE monster flares (+500): a burning "fwump". */
  heatFlare: {
    cap: 2,
    gap: 0.1,
    verb: 0.35,
    play(v) {
      sweep(v, 0, 0.26, [320, 1500, 650], 0.36, { kind: 'pink', q: 1, peakAt: 0.3 });
      puff(v, 0, 0.34, 0.24, 1200, { kind: 'brown' });
      v.crackle({ t: 0.03, d: 0.24, n: 8, g: 0.1, f: 3400, q: 0.8, curve: 1.4, dec: 0.004 });
    },
  },
  /** A WATER monster steams (−300): white noise through a falling band. */
  steamHiss: {
    cap: 2,
    gap: 0.1,
    verb: 0.3,
    play(v) {
      v.noise('white', { g: [[0, 0], [0.025, 0.22], [0.42, 0.0001, 'e']], to: v.filt('bandpass', [[0, 7200], [0.42, 2600, 'e']], 0.9) });
      v.noise('white', { g: [[0, 0], [0.02, 0.06], [0.25, 0.0001, 'e']], to: v.filt('highpass', 9000) });
    },
  },
  /** Cooling / the old field breaking: a hiss and stones settling. */
  volcanoCool: {
    cap: 1,
    gap: 0.15,
    verb: 0.35,
    duck: 0.3,
    play(v) {
      v.noise('white', { g: [[0, 0], [0.03, 0.16], [0.5, 0.0001, 'e']], to: v.filt('bandpass', [[0, 5600], [0.5, 2000, 'e']], 0.8) });
      thump(v, 0.05, 100, 48, 0.32, 0.22, { drive: 1.3 });
      v.crackle({ t: 0.06, d: 0.35, n: 10, g: 0.12, f: 1100, q: 1.1, curve: 1.2, dec: 0.006, kind: 'brown' });
      puff(v, 0.08, 0.16, 0.3, 700, { kind: 'brown' });
    },
  },

  // ================================================================ Ayna Kalkanı
  /**
   * The dome builds from the floor up: four whole-tone glass-plate ticks, 100 ms apart, on a thick plate
   * (C5 D5 E5 F#5 on plate ratios: an octave under the beam's E6 and under the wyrm's E6–B7 glass —
   * LSD ≥ 10 dB against its glass roles, measured in A-4).
   */
  mirrorRaise: {
    cap: 1,
    gap: 0.15,
    verb: 0.4,
    play(v) {
      // (24 Oct, the big dome back: the ticks follow its cells rising from the floor to the crown over
      // the 380 ms build — 100 ms apart instead of the 7-cell panel's 50)
      MIRROR.forEach((m, i) => {
        plateBell(v, midiHz(m - 12), i * 0.1, 0.17 - i * 0.01, 0.2, { modes: 4 });
        // the tick itself: a dry plate click (band-passed, no airy hiss on top) on a short low "thock"
        // of the thick glass settling into place (the body the wyrm's ringing glass never has)
        v.noise('white', { t: i * 0.1, g: perc(0.05, 0.005, 0.0002), to: v.filt('bandpass', 2400, 1.4) });
        thump(v, i * 0.1, 300, 210, 0.12, 0.06);
      });
    },
  },
  /** The attack hits the mirror: a glass knock with a ring (G5) and a little weight. */
  mirrorCatch: {
    cap: 1,
    gap: 0.1,
    verb: 0.5,
    duck: 0.45,
    play(v) {
      crack(v, 0, 0.5, { hp: 3200, n: 1, dec: 0.01 });
      plateBell(v, midiHz(79), 0, 0.2, 0.8);
      plateBell(v, midiHz(86), 0.003, 0.08, 0.45, { modes: 2 });
      thump(v, 0, 190, 80, 0.5, 0.18);
    },
  },
  /** One reflected beam (×n, one step up per victim): a short zap and a falling ring. */
  mirrorBeam: {
    cap: 3,
    gap: 0.05,
    verb: 0.35,
    duck: 0.3,
    play(v) {
      const zap = v.filt('bandpass', [[0, 3400], [0.09, 700, 'e']], 2.2);
      v.tone('sawtooth', [[0, 2400], [0.09, 600, 'e']], { g: perc(0.19, 0.1, 0.002), to: zap });
      v.noise('white', { g: perc(0.17, 0.05, 0.001), to: zap });
      const f = midiHz(MIRROR[2]);
      v.tone('sine', [[0, f], [0.25, f * 0.94, 'e']], { t: 0.01, g: perc(0.14, 0.25, 0.003) });
      v.tone('sine', [[0, f * 1.594], [0.2, f * 1.5, 'e']], { t: 0.01, g: perc(0.055, 0.16, 0.003) });
    },
  },
  /**
   * The mirror breaks: a dry plate crack — lower and shorter than the wyrm's crystal shatter, no
   * cascade, no ringing tail — the plate's own last knock (C5), then a sparse glitter of plate shards
   * (C5–F#6; LSD ≥ 10 dB against the wyrm's glass roles, measured in A-4).
   */
  mirrorBreak: {
    cap: 1,
    gap: 0.15,
    verb: 0.5,
    duck: 0.4,
    play(v) {
      crack(v, 0, 0.62, { hp: 1400, lp: 6000, n: 2, gap: 0.016, dec: 0.012 });
      plateBell(v, midiHz(MIRROR[0] - 12), 0.003, 0.2, 0.32, { modes: 4 });
      thump(v, 0, 160, 70, 0.4, 0.22);
      const pans = [v.panner(-0.4), v.panner(0), v.panner(0.4)];
      for (let i = 0; i < 7; i++) {
        const m = MIRROR[i % MIRROR.length] - (i % 2 ? 0 : 12);
        plateBell(v, midiHz(m) * v.r(0.997, 1.003), 0.03 + i * 0.045 + v.r(0, 0.02), 0.065 * (1 - i * 0.07), v.r(0.08, 0.18), { to: pans[i % 3], modes: 2 });
      }
    },
  },

  // ================================================================ Yer Yarığı
  /** The crack runs across the floor: a crackle train over a rising low rumble. */
  chasmCrack: {
    cap: 1,
    gap: 0.15,
    verb: 0.35,
    play(v) {
      v.crackle({ d: 0.28, n: 20, g: 0.2, f: 1700, q: 1, curve: 0.8, dec: 0.005 });
      v.noise('brown', { g: [[0, 0], [0.26, 0.3], [0.4, 0.0001, 'e']], to: v.filt('lowpass', [[0, 110], [0.3, 320, 'e']], 0.9) });
      v.noise('white', { g: [[0, 0], [0.2, 0.04], [0.3, 0.0001, 'e']], to: v.filt('bandpass', [[0, 2000], [0.3, 4000, 'e']], 1.5) });
    },
  },
  /** The pad opens: a deep hollow "whoomp" (a cave resonance swelling) and gravel. */
  chasmOpen: {
    cap: 1,
    gap: 0.2,
    verb: 0.55,
    duck: 0.6,
    play(v) {
      thump(v, 0, 92, 34, 0.8, 0.6, { drive: 1.5 });
      v.noise('pink', { g: [[0, 0], [0.08, 0.5], [0.6, 0.0001, 'e']], to: v.filt('bandpass', [[0, 260], [0.6, 150, 'e']], 4) });
      v.crackle({ t: 0.02, d: 0.45, n: 22, g: 0.15, f: 1200, q: 1, curve: 1.5, dec: 0.006, kind: 'brown' });
      puff(v, 0, 0.26, 0.4, 900, { kind: 'brown' });
    },
  },
  /** The victim falls into the hole: a falling rumble and tumbling rubble (short, under its death sound). */
  chasmFall: {
    cap: 1,
    gap: 0.15,
    verb: 0.4,
    play(v) {
      v.noise('brown', { g: [[0, 0], [0.04, 0.4], [0.42, 0.0001, 'e']], to: v.filt('lowpass', [[0, 520], [0.42, 120, 'e']], 0.9) });
      const times = [0.03, 0.09, 0.14, 0.22, 0.27, 0.35];
      v.bursts(times, times.map((_, i) => 0.3 * (1 - i * 0.1)), { dec: 0.03, f: 700, q: 1.2, kind: 'brown' });
    },
  },
  /** The slabs slam shut: a heavy thump, a stone crack and settling dust. */
  chasmShut: {
    cap: 1,
    gap: 0.15,
    verb: 0.45,
    duck: 0.5,
    play(v) {
      thump(v, 0, 112, 38, 0.85, 0.45, { drive: 2.2 });
      crack(v, 0, 0.3, { hp: 1500, lp: 6000, n: 1, dec: 0.016 });
      v.noise('pink', { t: 0.01, g: [[0, 0], [0.04, 0.22], [0.65, 0.0001, 'e']], to: v.filt('lowpass', [[0, 2600], [0.65, 600, 'e']], 0.8) });
      v.noise('white', { t: 0.02, g: swell(0.03, 0.08, 0.3), to: v.filt('highpass', 6000) });
    },
  },

  // ================================================================ Sihirli Şapka (magic_hat)
  // Soft cloth and felt, small round "bloops" and a toy chime: no glass, no metal, nothing near the
  // mirror's plates or the chasm's stone. Every beat is short; the shuffle's swishes are quiet.
  /** The hats rise out of the floor mist: a felt whoosh up and a soft rising "bloop" (E4 -> B4). */
  hatRise: {
    cap: 1,
    gap: 0.15,
    verb: 0.3,
    play(v) {
      sweep(v, 0, 0.3, [260, 1500, 700], 0.22, { kind: 'pink', q: 0.9, peakAt: 0.55 });
      v.tone('sine', [[0, midiHz(64)], [0.18, midiHz(71), 'e']], { g: perc(0.14, 0.24, 0.02) });
      puff(v, 0.02, 0.1, 0.22, 900, { kind: 'brown' });
    },
  },
  /** A hat lands on its occupant: a dull felt thump with a little cloth air (x3, staggered by the scene). */
  hatThump: {
    cap: 3,
    gap: 0.04,
    verb: 0.2,
    play(v) {
      thump(v, 0, 170, 64, 0.5, 0.15, { drive: 1.2 });
      puff(v, 0, 0.14, 0.12, 1400, { kind: 'pink' });
    },
  },
  /** One shuffle pass: a quick cloth swish (band-passed air, rising) and a soft step. */
  hatSwish: {
    cap: 3,
    gap: 0.05,
    verb: 0.2,
    play(v) {
      sweep(v, 0, 0.2, [900, 2400, 1500], 0.13, { kind: 'white', q: 1.4, peakAt: 0.4 });
      thump(v, 0.1, 140, 80, 0.12, 0.06);
    },
  },
  /** A decoy hat lifts and pops: a round "pop" (sine 700 -> 1500), a puff and two toy sparkle ticks. */
  hatPop: {
    cap: 2,
    gap: 0.08,
    verb: 0.35,
    play(v) {
      v.tone('sine', [[0, 620], [0.05, 1500, 'e']], { g: perc(0.26, 0.09, 0.002) });
      puff(v, 0, 0.2, 0.14, 2600, { kind: 'white' });
      [midiHz(88), midiHz(93)].forEach((f, i) => v.tone('triangle', f, { t: 0.06 + i * 0.06, g: perc(0.08, 0.12, 0.002) }));
    },
  },
  /** The real monster is found: a lift whoosh and a warm two-note chime (G5 -> D6), lower than the mirror's glass. */
  hatReveal: {
    cap: 1,
    gap: 0.15,
    verb: 0.45,
    play(v) {
      sweep(v, 0, 0.18, [500, 1800, 1100], 0.12, { kind: 'pink', q: 1 });
      [midiHz(79), midiHz(86)].forEach((f, i) => {
        v.tone('sine', f, { t: 0.05 + i * 0.09, g: perc(0.18, 0.5, 0.003) });
        v.tone('sine', f * 2.01, { t: 0.05 + i * 0.09, g: perc(0.05, 0.3, 0.003) });
      });
    },
  },
} satisfies Record<string, Recipe>;

export type V3SpellSfxName = keyof typeof V3_SPELL_RECIPES;

/** The sustained ones (sfx.start, stopped on the beat that ends their picture: SE-2). */
export const V3_SPELL_SUSTAINED: readonly V3SpellSfxName[] = Object.freeze(['lavaCreep'] as const);
