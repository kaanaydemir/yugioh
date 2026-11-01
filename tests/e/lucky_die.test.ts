// Lane E — Talih Zarı (lucky_die): the film stages (src/duel/scenarios/e_lucky_die.ts) roll the value their desc names
// and emit what the presentation (src/cinematics/spells/lucky_die.ts) consumes: activate → diceRoll → one statChange
// per face-up monster of the caster (+100 × value) → the spell's own trip to the graveyard. The die rasteriser
// (_lucky_die_cube.ts) ends every tumble with the rolled face up, and the card art stays inside its budgets.
import { describe, expect, it } from 'vitest';
import { apply, type Action, type GameEvent, type GameState } from '../../src/engine';
import { buildStage, uidOf } from '../../src/duel/scenario';
import PACK from '../../src/duel/scenarios/e_lucky_die';
import type { CardId } from '../../src/data/cards';
import type { PlayerId } from '../../src/engine/types';
import { PIPS, mul, pipOffsets, rot, topValue, upright } from '../../src/cinematics/spells/_lucky_die_cube';
import art from '../../src/art/cardart-v3/lucky_die';
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

const EXPECT: Record<string, { value: number; boosted: number }> = {
  eDie: { value: 6, boosted: 3 },
  eDieP2: { value: 6, boosted: 3 },
  eDieMid: { value: 3, boosted: 3 },
  eDieMidP2: { value: 3, boosted: 3 },
  eDieOne: { value: 1, boosted: 3 },
  eDieOneP2: { value: 1, boosted: 3 },
  eDieSet: { value: 4, boosted: 3 },
  eDieSetP2: { value: 4, boosted: 3 },
  eDieSolo: { value: 5, boosted: 1 },
  eDieTwo: { value: 2, boosted: 3 },
};

describe('e_lucky_die stages', () => {
  it('roll the named value and boost only the caster’s face-up monsters', () => {
    for (const [key, x] of Object.entries(EXPECT)) {
      const { events } = runStage(key);
      const p = PACK[key].stage.active ?? 0;
      const types = events.map((e) => e.type);
      expect(types, key).toEqual(['activate', 'diceRoll', ...Array(x.boosted).fill('statChange'), 'toGraveyard']);
      const roll = events.find((e) => e.type === 'diceRoll');
      expect(roll && roll.type === 'diceRoll' && roll.value, key).toBe(x.value);
      for (const e of events)
        if (e.type === 'statChange') {
          expect(e.atk - e.prevAtk, key).toBe(100 * x.value);
          expect(e.def - e.prevDef, key).toBe(100 * x.value);
        }
      expect(roll && roll.type === 'diceRoll' && roll.player, key).toBe(p);
    }
  });
});

describe('the die', () => {
  it('upright(N) puts face N on top, and a tumble about any horizontal axis by whole quarter turns keeps a face up', () => {
    for (let n = 1; n <= 6; n++) {
      expect(topValue(upright(n))).toBe(n);
      expect(pipOffsets(upright(n), 9, n)).toHaveLength(PIPS[n].length);
      // the scene's last roll is a quarter turn about the travel axis: before it, another face is up
      const before = mul(rot([0, 1, 0], -Math.PI / 2), upright(n));
      expect(topValue(before)).not.toBe(n);
    }
  });
  it('the card art stays in its budgets (palette, colours, no outline gaps)', () => {
    for (let f = 0; f < (art.frames ?? 1); f++) {
      const r = renderArt(art, f);
      const big = artStats(r.big, r.bigPx, art.focus);
      expect(big.offPalette).toBe(0);
      expect(big.colors).toBeLessThanOrEqual(20);
      expect(big.outlineInk).toBeGreaterThanOrEqual(0.9);
    }
  });
});
