// v3 UI sounds, cards — docs/v3/A6_PLAN.md §4.3 (contract S-10). One family with ./ui-flow.ts:
// "neon cam + keçe", centred on A minor pentatonic, 8–12 dB under the character sounds, ≤ 200 ms,
// no tails, never the same sound twice in one frame, ±2 % deterministic pitch spread.
// A56.0 SKELETON: every name of §4.3 with an EMPTY recipe (silent). src/audio/sounds.ts spreads
// UI_CARD_RECIPES into the game's table and SfxName gains UiCardSfxName (written once in A56.0).
// Lane A6-A writes the recipes of BOTH files (step A7, one sound design); lane A6-B only calls them.

import type { Recipe } from '../sounds';

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
  ui3PanelOpen: todo(),
  ui3PanelClose: todo(),
  ui3Card: todo(),
} satisfies Record<string, Recipe>;

export type UiCardSfxName = keyof typeof UI_CARD_RECIPES;
