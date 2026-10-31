// Lane E — Süpürge Rüzgarı (sweeping_gale): the film stages (src/duel/scenarios/e_sweeping_gale.ts) play through the
// engine and emit what the presentation claims: one massDestroy from the spell, then a destroy per opposing
// spell / trap (field spell included) with its graveyard arrival (or a spite axe's way back to its deck).
import { describe, expect, it } from 'vitest';
import { apply, type Action, type GameEvent, type GameState } from '../../src/engine';
import { buildStage, uidOf } from '../../src/duel/scenario';
import PACK from '../../src/duel/scenarios/e_sweeping_gale';
import type { CardId } from '../../src/data/cards';
import type { PlayerId } from '../../src/engine/types';

function runStage(key: string): { state: GameState; events: GameEvent[] } {
  const sc = PACK[key];
  let state = buildStage(sc.stage);
  const events: GameEvent[] = [];
  for (const step of sc.steps) {
    const a = (typeof step === 'function' ? step({ uid: (id: CardId, p?: PlayerId) => uidOf(state, id, p) }) : step) as Action;
    if (!a) continue;
    const r = apply(state, a);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

const SWEEPS = ['eGale', 'eGaleP2', 'eGaleSet', 'eGaleSetP2', 'eGaleWindow', 'eGaleVolcano', 'eGaleOne', 'eGaleAxe', 'eGaleLeash'];

describe('e_sweeping_gale stages', () => {
  it('every sweeping stage casts the gale: one massDestroy with the spell as its source, the victim’s back row empties', () => {
    for (const key of SWEEPS) {
      const { state, events } = runStage(key);
      const m = events.filter((e): e is Extract<GameEvent, { type: 'massDestroy' }> => e.type === 'massDestroy');
      expect(m, key).toHaveLength(1);
      expect(state.cards[m[0].sourceUid!]?.cardId, key).toBe('sweeping_gale');
      const victim = m[0].refs[0].player;
      expect(state.players[victim].spellTraps.every((s) => s === null), key).toBe(true);
      expect(state.players[victim].fieldSpell, key).toBeNull();
    }
  });
  it('the sealed stage never sweeps', () => {
    const { events } = runStage('eGaleSealed');
    expect(events.some((e) => e.type === 'massDestroy')).toBe(false);
  });
  it('the wipe run holds destroys / arrivals first, the side effects after (the order the presentation relies on)', () => {
    for (const key of SWEEPS) {
      const { events } = runStage(key);
      const i = events.findIndex((e) => e.type === 'massDestroy');
      const end = events.findIndex((e, k) => k > i && e.type === 'toGraveyard' && e.cardId === 'sweeping_gale');
      const kinds = new Set(events.slice(i + 1, end).map((e) => e.type));
      for (const k of kinds) expect(['destroy', 'toGraveyard', 'toDeck', 'fieldSpell', 'statChange', 'damage', 'controlChange', 'lpChange'], `${key}: ${k}`).toContain(k);
    }
  });
});
