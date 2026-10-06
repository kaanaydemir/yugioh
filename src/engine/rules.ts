// STUB — the engine agent replaces this file with the full implementation.
import type { Action, ApplyResult, GameState, NewGameOptions, PlayerId, Uid, ZoneRef } from './types';
import { EngineError } from './types';

export function newGame(_opts: NewGameOptions): ApplyResult {
  throw new EngineError('engine not implemented');
}
export function actingPlayer(state: GameState): PlayerId {
  return state.pending ? state.pending.player : state.activePlayer;
}
export function legalActions(_state: GameState): Action[] {
  return [];
}
export function apply(_state: GameState, _action: Action): ApplyResult {
  throw new EngineError('engine not implemented');
}
export function currentAtk(_state: GameState, _uid: Uid): number {
  return 0;
}
export function currentDef(_state: GameState, _uid: Uid): number {
  return 0;
}
export function locate(_state: GameState, _uid: Uid): ZoneRef | null {
  return null;
}
