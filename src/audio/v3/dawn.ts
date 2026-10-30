// Şafak Kılıçları (dawn_swords) sounds — the continuous spell whose light blades fence the opponent in.
// Kept in a file of its own (the A5 spell table in ./spells.ts is pinned at 23 recipes by its test);
// src/audio/sounds.ts spreads V3_DAWN_RECIPES next to V3_SPELL_RECIPES and SfxName gains DawnSfxName.
//
// Palette: bright gold glass, a major-pentatonic ladder on G (G5 B5 D6 E6 G6) — higher and thinner than the
// spring's water (A minor) and clearly apart from the sword's FM clanks (the blades here are LIGHT, not
// forged metal): a falling air whoosh with a chime on arrival, a short stone "tok" with a metal tick when
// the blade plants, a rising glassy sweep for the reveal, a shimmer that fans out when a blade dissolves.
// Levels follow the spells (A5 §4.6): the small beats duck the music ≤ 0.3. Built from ./kit.ts blocks and
// the Voice primitives only.
//   dawnDrop      one blade falls (×6, the scene passes `pitch` up the ladder) — whoosh + chime
//   dawnPlant     the blade bites the floor (×6) — thud + tick + a puff of dust
//   dawnSweep     the reveal: the light sweeps over the opponent's field
//   dawnDissolve  a turn ends: one blade dissolves into light motes (≤ 0.6 s)
//   dawnFade      the last blade fades (the spell expires)
//   dawnShatter   the fence is destroyed early: every blade breaks at once

import type { Recipe } from '../sounds';
import { midiHz } from '../synth';
import { clank, crack, link, puff, sweep, thump } from './kit';

/** G major pentatonic, G5 … G6 (midi). */
const LADDER = [79, 83, 86, 88, 91] as const;

export const V3_DAWN_RECIPES = {
  /** A blade falls from the sky: a descending air whoosh, a glass chime (G6) as it arrives. */
  dawnDrop: {
    cap: 6,
    gap: 0.02,
    verb: 0.35,
    play(v) {
      sweep(v, 0, 0.17, [2800, 1000, 520], 0.11, { kind: 'white', q: 1.2, peakAt: 0.25 });
      v.bell(midiHz(LADDER[4]), { t: 0.07, g: 0.045, dec: 0.3, ratio: 2, index: 0.5 });
      v.tone('sine', midiHz(LADDER[4] + 12), { t: 0.07, g: [[0, 0], [0.002, 0.012], [0.12, 0.0001, 'e']] });
    },
  },
  /** The blade bites the floor: a short stone thud, a metal tick, a puff of dust. */
  dawnPlant: {
    cap: 6,
    gap: 0.02,
    verb: 0.3,
    play(v) {
      thump(v, 0, 175, 64, 0.4, 0.14, { drive: 1.2 });
      clank(v, 1320, 0, 0.06, 0.2, { ratio: 1.41, index: 1.5, click: 0.6 });
      puff(v, 0.01, 0.09, 0.15, 1900, { kind: 'pink' });
    },
  },
  /** The light sweep of the reveal: a rising glassy sweep with three bell steps up the ladder. */
  dawnSweep: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    duck: 0.2,
    play(v) {
      sweep(v, 0, 0.44, [800, 4200, 6400], 0.17, { kind: 'white', q: 3, peakAt: 0.65 });
      [LADDER[2], LADDER[3], LADDER[4]].forEach((m, i) => v.bell(midiHz(m), { t: 0.08 + i * 0.1, g: 0.04, dec: 0.4, ratio: 2, index: 0.5 }));
      v.tone('sine', [[0, 392], [0.4, 784, 'e']], { g: [[0, 0], [0.06, 0.045], [0.4, 0.035], [0.56, 0.0001, 'e']] });
    },
  },
  /** One blade dissolves into light: a thin shimmer of glass ticks falling in pitch, one soft bell. */
  dawnDissolve: {
    cap: 2,
    gap: 0.05,
    verb: 0.5,
    play(v) {
      sweep(v, 0, 0.42, [5200, 2400, 1400], 0.07, { kind: 'white', q: 5, peakAt: 0.2 });
      for (let i = 0; i < 6; i++) link(v, 3700 - i * 300 + v.r(-80, 80), 0.02 + i * 0.055, 0.045 * (1 - i * 0.1), 0.08);
      v.bell(midiHz(LADDER[3] + 12), { t: 0, g: 0.032, dec: 0.45, ratio: 2, index: 0.4 });
    },
  },
  /** The last blade fades: a soft descending triad (B5, G5, D5) and a breath of air. */
  dawnFade: {
    cap: 1,
    gap: 0.2,
    verb: 0.6,
    play(v) {
      [LADDER[1], LADDER[0], LADDER[0] - 5].forEach((m, i) => v.bell(midiHz(m), { t: i * 0.11, g: 0.045, dec: 0.5, ratio: 2, index: 0.35 }));
      puff(v, 0, 0.07, 0.5, 2400, { kind: 'pink' });
    },
  },
  /** Destroyed early: every blade breaks at once — a dry crack and a scatter of glass shards. */
  dawnShatter: {
    cap: 1,
    gap: 0.1,
    verb: 0.4,
    duck: 0.3,
    play(v) {
      crack(v, 0, 0.5, { hp: 2600, n: 2, gap: 0.012 });
      clank(v, 960, 0, 0.1, 0.35, { ratio: 1.41, index: 2, click: 0 });
      for (let i = 0; i < 7; i++) link(v, 3800 - i * 280 + v.r(-90, 90), 0.05 + i * 0.045, 0.08 * (1 - i * 0.09), 0.07);
    },
  },
} satisfies Record<string, Recipe>;

export type DawnSfxName = keyof typeof V3_DAWN_RECIPES;
