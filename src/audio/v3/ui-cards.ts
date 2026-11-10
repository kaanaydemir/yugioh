// v3 UI sounds, cards — docs/v3/A6_PLAN.md §4.3 (contract S-10). One family with ./ui-flow.ts:
// "neon cam + keçe", centred on A minor pentatonic, 8–12 dB under the character sounds, ≤ 200 ms,
// no tails, never the same sound twice in one frame, ±2 % deterministic pitch spread.
// A56.0 SKELETON: every name of §4.3 with an EMPTY recipe (silent). src/audio/sounds.ts spreads
// UI_CARD_RECIPES into the game's table and SfxName gains UiCardSfxName (written once in A56.0).
// Lane A6-A writes the recipes of BOTH files (step A7, one sound design); lane A6-B only calls them.

import type { Recipe } from '../sounds';
import { perc } from '../synth';

/** An empty recipe (silence) until the lane writes it. */
const todo = (): Recipe => ({ play() {} });

export const UI_CARD_RECIPES = {
  ui3Hover: todo(), // stepped tick (the hand's note ladder)
  ui3Select: todo(),
  ui3Draw: todo(),
  ui3Flip: todo(),
  ui3Land: todo(),
  ui3Play: todo(),
  ui3Place: todo(),
  ui3Set: todo(),
  ui3Latch: todo(),
  ui3Turn: todo(),
  ui3Tribute: todo(),
  ui3Slide: todo(),
  ui3Burn: todo(),
  ui3PileAccept: todo(),
  ui3Riffle: todo(),
  ui3Shuffle: todo(),
  ui3Mark: todo(),
  ui3Unmark: todo(),
  // K11, the graveyard panel (step A6): a felt drawer pulled up on a glass rail (open), pushed back down
  // with the deck landing on the pile (close); one soft felt tick per card leaving the pile (the caller
  // climbs the pentatonic ladder with `pitch`)
  ui3PanelOpen: {
    cap: 1,
    gap: 0.08,
    verb: 0.12,
    play(v) {
      // the strap: felt noise swept up over the plate's three steps (0–90 ms)
      v.noise('pink', { g: [[0, 0.0001], [0.03, 0.2, 'e'], [0.085, 0.16], [0.12, 0.0001, 'e']], to: v.filt('bandpass', [[0, 520], [0.09, 2300, 'e']], 1.1) });
      // the felt thump under the first step
      v.tone('sine', [[0, 150], [0.06, 88, 'e']], { g: perc(0.26, 0.07, 0.002) });
      // the glass rail: A5 on the second step, E6 when the plate is full, and its latch
      v.tone('triangle', 880, { t: 0.03, g: perc(0.05, 0.07, 0.002) });
      v.tone('sine', 1760, { t: 0.03, g: perc(0.025, 0.05, 0.001) });
      v.tone('triangle', 1319, { t: 0.088, g: perc(0.06, 0.09, 0.002) });
      v.tone('sine', 2637, { t: 0.088, g: perc(0.018, 0.05, 0.001) });
      v.noise('white', { t: 0.09, g: perc(0.1, 0.008, 0.0005), to: v.filt('bandpass', 3800, 2.2) });
    },
  },
  ui3PanelClose: {
    cap: 1,
    gap: 0.08,
    verb: 0.1,
    play(v) {
      // the strap pushed back: the sweep falls
      v.noise('pink', { g: [[0, 0.0001], [0.02, 0.18, 'e'], [0.09, 0.12], [0.13, 0.0001, 'e']], to: v.filt('bandpass', [[0, 2200], [0.11, 480, 'e']], 1.1) });
      // the rail down: E6 → A5
      v.tone('triangle', 1319, { g: perc(0.05, 0.06, 0.002) });
      v.tone('triangle', 880, { t: 0.04, g: perc(0.05, 0.08, 0.002) });
      // the deck lands on the pile (≈ 120 ms): a felt pat, low and short
      v.tone('sine', [[0, 170], [0.05, 82, 'e']], { t: 0.115, g: perc(0.24, 0.06, 0.001) });
      v.noise('white', { t: 0.115, g: perc(0.12, 0.018, 0.0005), to: v.filt('lowpass', 1800) });
    },
  },
  ui3Card: {
    cap: 3,
    gap: 0.012,
    verb: 0.06,
    vary: 0.02,
    play(v) {
      // a card lifting off felt: a tiny brushed tick and a glass grain on top (the caller's pitch climbs the ladder)
      v.noise('white', { g: [[0, 0.0001], [0.006, 0.11, 'e'], [0.03, 0.0001, 'e']], to: v.filt('bandpass', 2600, 1.6) });
      v.tone('sine', [[0, 1760], [0.03, 1900, 'e']], { t: 0.004, g: perc(0.035, 0.035, 0.001) });
      v.tone('triangle', 880, { t: 0.004, g: perc(0.03, 0.03, 0.001) });
    },
  },
} satisfies Record<string, Recipe>;

export type UiCardSfxName = keyof typeof UI_CARD_RECIPES;
