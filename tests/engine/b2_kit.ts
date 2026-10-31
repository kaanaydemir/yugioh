// Shared helpers for the batch-2 card tests (docs/v3/YENI_KARTLAR.md).
import { expect } from 'vitest';
import { apply, legalActions, type Action, type GameEvent, type GameState, type PlayerId, type ZoneRef } from '../../src/engine';
import type { CardId } from '../../src/data/cards';
import { mulberry32Step } from '../../src/engine/rng';
import { checkEvents, checkInvariantsRelaxed, isListed, scenario, seq, uidOf, type ScenarioOpts } from './helpers';

export { scenario, seq, uidOf, isListed };
export type { ScenarioOpts };

/** Apply actions in a row with the relaxed invariants (a Spell in the seal window / a cost discard) and the event checks. */
export function play(s: GameState, ...actions: Action[]): { state: GameState; events: GameEvent[] } {
  let state = s;
  const events: GameEvent[] = [];
  for (const a of actions) {
    const r = apply(state, a);
    checkInvariantsRelaxed(r.state);
    checkEvents(r.state, r.events);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

export const mon = (p: PlayerId, index: number) => ({ kind: 'monster' as const, ref: { player: p, zone: 'monster' as const, index } });
export const card = (p: PlayerId, zone: 'spellTrap' | 'field', index: number) => ({ kind: 'card' as const, ref: { player: p, zone, index } });
export const ref = (p: PlayerId, zone: ZoneRef['zone'], index: number): ZoneRef => ({ player: p, zone, index });
export const sp = (s: GameState, id: CardId, p: PlayerId = 0, extra: Record<string, unknown> = {}): Action =>
  ({ type: 'activateSpell', player: p, uid: uidOf(s, id, p), ...extra }) as Action;
export const atk = (p: PlayerId, attackerZone: number, targetZone: number | null): Action => ({ type: 'attack', player: p, attackerZone, targetZone });
export const respond = (s: GameState, id: CardId | null, p: PlayerId): Action => ({ type: 'respond', player: p, uid: id === null ? null : uidOf(s, id, p) });
export const decline = (p: PlayerId): Action => ({ type: 'respond', player: p, uid: null });
export const endTurn = (p: PlayerId): Action => ({ type: 'endTurn', player: p });
export const battle = (p: PlayerId): Action => ({ type: 'enterBattle', player: p });
export const choose = (p: PlayerId, target: ZoneRef): Action => ({ type: 'chooseTarget', player: p, target });
export const evs = (s: GameState, e: GameEvent[]) => seq(s, e);
export const types = (e: GameEvent[]) => e.map((x) => x.type);

/** The coin face the engine's next random draw lands on (the coin toss reads exactly one draw). */
export function nextCoin(s: GameState): 'heads' | 'tails' {
  return mulberry32Step(s.rng).value < 0.5 ? 'heads' : 'tails';
}
export const flipFace = (c: 'heads' | 'tails') => (c === 'heads' ? 'tails' : 'heads');

/** The die value the engine's next random draw rolls. */
export function nextDie(s: GameState): number {
  return 1 + Math.floor(mulberry32Step(s.rng).value * 6);
}

/** The cardId in a monster zone (or null). */
export function at(s: GameState, p: PlayerId, i: number): CardId | null {
  const m = s.players[p].monsters[i];
  return m ? s.cards[m.uid].cardId : null;
}

export function gy(s: GameState, p: PlayerId): CardId[] {
  return s.players[p].graveyard.map((u) => s.cards[u].cardId);
}

export function legalOf(s: GameState, type: Action['type']): Action[] {
  return legalActions(s).filter((a) => a.type === type);
}

export function expectIllegal(s: GameState, a: Action): void {
  expect(isListed(s, a), JSON.stringify(a)).toBe(false);
  expect(() => apply(s, a)).toThrow();
}

/** Activation actions listed for the card `id` of `p` (from hand or set). */
export function spellActs(s: GameState, id: CardId, p: PlayerId = 0): Extract<Action, { type: 'activateSpell' }>[] {
  return legalActions(s).filter(
    (a): a is Extract<Action, { type: 'activateSpell' }> => a.type === 'activateSpell' && s.cards[a.uid].cardId === id && a.player === p,
  );
}
