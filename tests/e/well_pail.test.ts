// Lane E — Kuyu Kovası (well_pail): the film stages (src/duel/scenarios/e_well_pail.ts) play through the engine and
// emit what the presentation (src/cinematics/spells/well_pail.ts) consumes: two draws of the caster right after the
// activation, then the spell's own trip to the graveyard — or, when the first draw completes the seals, one draw and
// the game over (no second draw).
import { describe, expect, it } from 'vitest';
import { apply, type Action, type GameEvent, type GameState } from '../../src/engine';
import { buildStage, uidOf } from '../../src/duel/scenario';
import PACK from '../../src/duel/scenarios/e_well_pail';
import type { CardId } from '../../src/data/cards';
import type { PlayerId } from '../../src/engine/types';
import art from '../../src/art/cardart-v3/well_pail';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';

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

describe('e_well_pail stages', () => {
  it('the normal stages: activate → draw → draw → toGraveyard (the caster draws both)', () => {
    for (const key of ['eWellPail', 'eWellPailP2', 'eWellPailSet', 'eWellPailSetP2']) {
      const { events } = runStage(key);
      const p = PACK[key].stage.active ?? 0;
      const types = events.map((e) => e.type);
      expect(types, key).toEqual(['activate', 'draw', 'draw', 'toGraveyard']);
      for (const e of events) if (e.type === 'draw') expect(e.player, key).toBe(p);
    }
  });
  it('the seal stages: one draw wins the duel, no second draw', () => {
    for (const key of ['eWellPailSeal', 'eWellPailSealP2']) {
      const { state, events } = runStage(key);
      expect(events.filter((e) => e.type === 'draw'), key).toHaveLength(1);
      expect(events.some((e) => e.type === 'gameOver'), key).toBe(true);
      expect(state.winner, key).toBe(PACK[key].stage.active ?? 0);
    }
  });
});

describe('well_pail card art', () => {
  it('stays in the palette and the style-sheet budgets, both sizes, every frame', () => {
    for (let f = 0; f < (art.frames ?? 1); f++) {
      const r = renderArt(art, f);
      for (const [layers, pic] of [
        [r.big, r.bigPx],
        [r.small, r.smallPx],
      ] as const) {
        const s = artStats(layers, pic, art.focus);
        expect(s.offPalette).toBe(0);
        expect(s.colors).toBeLessThanOrEqual(20);
        expect(s.backdropColors).toBeLessThanOrEqual(6);
      }
    }
  });
});
