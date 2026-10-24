// v3 UI sounds, flow — docs/v3/A6_PLAN.md §4.3 (contract S-10). The same family as ./ui-cards.ts.
// Ducking only for ui3Battle (0.3) and ui3Victory / ui3Defeat (0.55); ≤ 200 ms except the
// victory / defeat stings and ui3DuelStart (≤ 1.4 s). ui3TurnStart plays in two registers (P1 / P2).
// A56.0 SKELETON: every name of §4.3 with an EMPTY recipe (silent). src/audio/sounds.ts spreads
// UI_FLOW_RECIPES into the game's table and SfxName gains UiFlowSfxName (written once in A56.0).
// Lane A6-A writes the recipes (step A7); lane A6-B places the calls on their frames (KO-7).

import type { Recipe } from '../sounds';

/** An empty recipe (silence) until the lane writes it. */
const todo = (): Recipe => ({ play() {} });

export const UI_FLOW_RECIPES = {
  ui3DuelStart: todo(),
  ui3PanelIn: todo(),
  ui3TurnStart: todo(),
  ui3Phase: todo(),
  ui3Battle: todo(),
  ui3LpLoss: todo(),
  ui3LpGain: todo(),
  ui3LpTick: todo(),
  ui3AimOpen: todo(),
  ui3Aim: todo(),
  ui3Lock: todo(),
  ui3Error: todo(),
  ui3Block: todo(),
  ui3Decision: todo(),
  ui3Confirm: todo(),
  ui3Back: todo(),
  ui3PassDevice: todo(),
  ui3DeckOut: todo(),
  ui3Victory: todo(),
  ui3Defeat: todo(),
} satisfies Record<string, Recipe>;

export type UiFlowSfxName = keyof typeof UI_FLOW_RECIPES;
