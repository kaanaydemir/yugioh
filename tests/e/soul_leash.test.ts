// Lane E — Ruh Tasması (soul_leash): the film stages (src/duel/scenarios/e_soul_leash.ts) play through the engine and
// emit what the presentation (src/cinematics/spells/soul_leash.ts) consumes: activate → target → equip → controlChange
// 'take' (sourceUid = the leash); the opponent's Draw Phase an lpGain from the leash; the leash breaking a
// controlChange 'return' with sourceUid null (claimed by the slot's borrowed.byUid) — or, with no room at home, the
// rule destroy. Plus the card art budgets and the recipe names.
import { describe, expect, it } from 'vitest';
import { apply, type Action, type GameEvent, type GameState } from '../../src/engine';
import { buildStage, uidOf } from '../../src/duel/scenario';
import PACK from '../../src/duel/scenarios/e_soul_leash';
import type { CardId } from '../../src/data/cards';
import type { PlayerId } from '../../src/engine/types';
import art from '../../src/art/cardart-v3/soul_leash';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';
import { RECIPES } from '../../src/audio/v3/e/soul_leash';

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

describe('e_soul_leash stages', () => {
  it('the take: activate → target → equip → controlChange take from the leash', () => {
    for (const key of ['eLeash', 'eLeashP2', 'eLeashSet', 'eLeashSetP2']) {
      const { events } = runStage(key);
      const types = events.map((e) => e.type);
      expect(types.slice(0, 4), key).toEqual(['activate', 'target', 'equip', 'controlChange']);
      const act = events[0] as Extract<GameEvent, { type: 'activate' }>;
      const cc = events[3] as Extract<GameEvent, { type: 'controlChange' }>;
      expect(cc.reason, key).toBe('take');
      expect(cc.sourceUid, key).toBe(act.uid);
      expect(cc.to, key).toBe(PACK[key].stage.active ?? 0);
    }
  });
  it("the opponent's Draw Phase: +1000 LP from the leash", () => {
    for (const key of ['eLeashDraw', 'eLeashDrawP2']) {
      const { events } = runStage(key);
      const leash = (events[0] as Extract<GameEvent, { type: 'activate' }>).uid;
      const gain = events.find((e) => e.type === 'lpGain') as Extract<GameEvent, { type: 'lpGain' }> | undefined;
      expect(gain, key).toBeDefined();
      expect(gain!.sourceUid, key).toBe(leash);
      expect(gain!.amount, key).toBe(1000);
      expect(gain!.player, key).toBe(1 - (PACK[key].stage.active ?? 0));
    }
  });
  it('the leash breaks: the monster goes home (controlChange return, sourceUid null)', () => {
    for (const key of ['eLeashBreak', 'eLeashBreakP2']) {
      const { events } = runStage(key);
      const ret = events.find((e) => e.type === 'controlChange' && e.reason === 'return') as Extract<GameEvent, { type: 'controlChange' }> | undefined;
      expect(ret, key).toBeDefined();
      expect(ret!.sourceUid, key).toBeNull();
    }
  });
  it('no room at home: the monster is destroyed by rule', () => {
    const { events } = runStage('eLeashNoRoom');
    expect(events.some((e) => e.type === 'destroy' && e.reason === 'rule' && e.location === 'monster' && e.sourceUid === null)).toBe(true);
    expect(events.some((e) => e.type === 'controlChange' && e.reason === 'return')).toBe(false);
  });
});

describe('soul_leash card art', () => {
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
  it('has a hand-made small picture', () => {
    expect(art.small).toBeTypeOf('function');
  });
});

describe('soul_leash sounds', () => {
  it('every recipe is e_leash-prefixed', () => {
    for (const k of Object.keys(RECIPES)) expect(k.startsWith('e_leash')).toBe(true);
  });
});
