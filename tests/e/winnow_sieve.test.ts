// Lane E — Harman Eleği (winnow_sieve): the film stages (src/duel/scenarios/e_winnow_sieve.ts) play through the engine
// and emit what the presentation (src/cinematics/spells/winnow_sieve.ts) consumes: three draws of the caster, the
// spell's own trip to the graveyard and the discard decision (the sieve waits on it); then the two discards — or, when
// the first draw completes the seals, one draw and the game over (no decision, the sieve unravels at once).
import { describe, expect, it } from 'vitest';
import { apply, type Action, type GameEvent, type GameState } from '../../src/engine';
import { buildStage, uidOf } from '../../src/duel/scenario';
import PACK from '../../src/duel/scenarios/e_winnow_sieve';
import { isUiStep } from '../../src/duel/scenarios';
import type { CardId } from '../../src/data/cards';
import type { PlayerId } from '../../src/engine/types';
import art from '../../src/art/cardart-v3/winnow_sieve';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';

function runStage(key: string): { state: GameState; batches: GameEvent[][] } {
  const sc = PACK[key];
  let state = buildStage(sc.stage);
  const batches: GameEvent[][] = [];
  for (const step of sc.steps) {
    if (isUiStep(step)) continue;
    const a = (typeof step === 'function' ? step({ uid: (id: CardId, p?: PlayerId) => uidOf(state, id, p) }) : step) as Action;
    const r = apply(state, a);
    state = r.state;
    batches.push(r.events);
  }
  return { state, batches };
}

describe('e_winnow_sieve stages', () => {
  it('activate → 3 draws → toGraveyard → discard decision; then two discards of the caster', () => {
    for (const key of ['eSieve', 'eSieveP2', 'eSieveSet', 'eSieveSetP2', 'eSieveBare']) {
      const { state, batches } = runStage(key);
      const p = PACK[key].stage.active ?? 0;
      const [act, disc] = batches;
      expect(act.map((e) => e.type), key).toEqual(['activate', 'draw', 'draw', 'draw', 'toGraveyard', 'decision']);
      const d = act[5];
      expect(d.type === 'decision' && d.pending.kind === 'discard' && d.pending.player === p, key).toBe(true);
      expect(disc.filter((e) => e.type === 'discard' && e.player === p), key).toHaveLength(2);
      expect(state.pending, key).toBeNull();
    }
  });
  it('the seal stages: one draw wins the duel, no decision', () => {
    for (const key of ['eSieveSeal', 'eSieveSealP2']) {
      const { state, batches } = runStage(key);
      const ev = batches[0];
      expect(ev.filter((e) => e.type === 'draw'), key).toHaveLength(1);
      expect(ev.some((e) => e.type === 'decision'), key).toBe(false);
      expect(state.winner, key).toBe(PACK[key].stage.active ?? 0);
    }
  });
});

describe('winnow_sieve card art', () => {
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
