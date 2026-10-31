// Lane E — Boşluk Gözü (void_eye): the film stages (src/duel/scenarios/e_void_eye.ts) play through the engine and
// emit the events the presentation claims (one massDestroy from the spell, then the per-card destroys / vanishes /
// the guardian charm's save).
import { describe, expect, it } from 'vitest';
import { apply, type Action, type GameEvent, type GameState } from '../../src/engine';
import { buildStage, uidOf } from '../../src/duel/scenario';
import PACK from '../../src/duel/scenarios/e_void_eye';
import type { CardId } from '../../src/data/cards';
import type { PlayerId } from '../../src/engine/types';

function runStage(key: string): { state: GameState; events: GameEvent[] } {
  const sc = PACK[key];
  let state = buildStage(sc.stage);
  const events: GameEvent[] = [];
  for (const step of sc.steps) {
    const a = (typeof step === 'function' ? step({ uid: (id: CardId, p?: PlayerId) => uidOf(state, id, p) }) : step) as Action;
    const r = apply(state, a);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

describe('e_void_eye stages', () => {
  it('every stage casts the eye: one massDestroy with the spell as its source', () => {
    for (const key of Object.keys(PACK)) {
      const { state, events } = runStage(key);
      const m = events.filter((e): e is Extract<GameEvent, { type: 'massDestroy' }> => e.type === 'massDestroy');
      expect(m, key).toHaveLength(1);
      expect(m[0].sourceUid, key).not.toBeNull();
      expect(state.cards[m[0].sourceUid!]?.cardId ?? 'void_eye', key).toBe('void_eye');
    }
  });
  it('the crowded stages: a token vanishes, the charmed monster stays, both sides lose the rest', () => {
    for (const key of ['eVoid', 'eVoidP2']) {
      const { state, events } = runStage(key);
      const i = events.findIndex((e) => e.type === 'massDestroy');
      const after = events.slice(i);
      expect(after.some((e) => e.type === 'tokenVanish'), key).toBe(true);
      expect(after.some((e) => e.type === 'activate' && e.cardId === 'guardian_charm'), key).toBe(true);
      const left = state.players.flatMap((p) => p.monsters.filter(Boolean).map((m) => state.cards[m!.uid].cardId));
      expect(left, key).toEqual(['tide_golem']);
    }
  });
  it('the wipe run holds only what the eye presents (destroys, vanishes, the charm) before the spell leaves', () => {
    const { events } = runStage('eVoid');
    const i = events.findIndex((e) => e.type === 'massDestroy');
    const end = events.findIndex((e, k) => k > i && e.type === 'toGraveyard' && e.cardId === 'void_eye');
    const kinds = new Set(events.slice(i + 1, end).map((e) => e.type));
    expect([...kinds].sort()).toEqual(['activate', 'destroy', 'toGraveyard', 'tokenVanish']);
  });
});
