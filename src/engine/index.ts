// Public engine API. Implementation lives in ./rules.ts and friends (engine agent owns them).
// Signatures here are the contract used by the UI, the Director and tests.

import type { CardId } from '../data/cards';
import type {
  Action,
  ApplyResult,
  GameState,
  NewGameOptions,
  PlayerId,
  Uid,
  ZoneRef,
} from './types';
import * as impl from './rules';

export * from './types';

/** Create a game: shuffles, draws opening hands, starts turn 1 (first player skips the draw). */
export function newGame(opts: NewGameOptions): ApplyResult {
  return impl.newGame(opts);
}

/** The player who must act now (pending decision owner, else the active player). */
export function actingPlayer(state: GameState): PlayerId {
  return impl.actingPlayer(state);
}

/** All legal actions for the acting player. Empty when the game is over. */
export function legalActions(state: GameState): Action[] {
  return impl.legalActions(state);
}

/** Apply an action. Throws EngineError if illegal. Never mutates `state`. */
export function apply(state: GameState, action: Action): ApplyResult {
  return impl.apply(state, action);
}

/** Current ATK including equips and field spells (face-up monsters on field; base ATK otherwise). */
export function currentAtk(state: GameState, uid: Uid): number {
  return impl.currentAtk(state, uid);
}

/** Current DEF including modifiers. */
export function currentDef(state: GameState, uid: Uid): number {
  return impl.currentDef(state, uid);
}

export function cardIdOf(state: GameState, uid: Uid): CardId {
  return state.cards[uid].cardId;
}

/** Where a card currently is on the field, or null if not on the field. */
export function locate(state: GameState, uid: Uid): ZoneRef | null {
  return impl.locate(state, uid);
}

// --- Additive exports (engine agent) ---------------------------------------------------
/** Greedy CPU player: always returns a legal action for actingPlayer(state). */
export { chooseAction } from './bot';
/** Short Turkish battle-log line for an event (null = not logged), plus name inflection helpers. */
export { describeEvent, describeEvents, describePending, cardName, playerName, inflect } from './describe';
/** True if `action` would be accepted by apply() right now. */
export { isLegal } from './rules';
