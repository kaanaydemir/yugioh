// Lane E — Kukla İpi (puppet_string): the film stages (src/duel/scenarios/e_puppet_string.ts) play through the
// engine and emit the events the presentation claims (take / return controlChange, the rule destroy).
import { describe, expect, it } from 'vitest';
import { apply, type Action, type GameEvent, type GameState } from '../../src/engine';
import { buildStage, uidOf } from '../../src/duel/scenario';
import PACK from '../../src/duel/scenarios/e_puppet_string';
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

const cc = (e: GameEvent[]) => e.filter((x): x is Extract<GameEvent, { type: 'controlChange' }> => x.type === 'controlChange');

describe('e_puppet_string stages', () => {
  it('every stage takes a monster with the spell as the source', () => {
    for (const key of Object.keys(PACK)) {
      const { events } = runStage(key);
      const take = cc(events).find((e) => e.reason === 'take');
      expect(take, key).toBeTruthy();
      expect(take!.sourceUid, key).not.toBeNull();
    }
  });
  it('the …Return stages give it back (sourceUid null) in the End Phase', () => {
    for (const key of ['ePuppetReturn', 'ePuppetP2', 'ePuppetSet', 'ePuppetFaceDown', 'ePuppetEquip', 'ePuppetAttack']) {
      const { events } = runStage(key);
      const back = cc(events).find((e) => e.reason === 'return');
      expect(back, key).toMatchObject({ reason: 'return', sourceUid: null });
    }
  });
  it('face-down: comes and goes with cardId null', () => {
    const { events } = runStage('ePuppetFaceDown');
    expect(cc(events).map((e) => e.cardId)).toEqual([null, null]);
  });
  it('no free zone: destroyed by rule', () => {
    const { events } = runStage('ePuppetNoZone');
    expect(cc(events).filter((e) => e.reason === 'return')).toHaveLength(0);
    expect(events.find((e) => e.type === 'destroy' && e.reason === 'rule')).toMatchObject({ cardId: 'abyss_magus', player: 0 });
  });
});

describe('puppet_string eye finder (the spiral glint lands on the art\'s eyes)', () => {
  it('finds both eyes of a face, the brighter first, and skips rim highlights', async () => {
    const { findEyes } = await import('../../src/cinematics/spells/_puppet_string_body');
    const W = 20;
    const H = 20;
    const d = new Uint8ClampedArray(W * H * 4);
    const put = (x: number, y: number, v: number) => {
      const i = (y * W + x) * 4;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    };
    // a dark head block (rows 2..17), a bright 3-px near eye and a dimmer 2-px far eye on row 6 (a 2-px slit: its
    // middle rounds right, x 13)
    for (let y = 2; y <= 17; y++) for (let x = 3; x <= 16; x++) put(x, y, 40);
    for (const x of [7, 8, 9]) put(x, 6, 250);
    for (const x of [12, 13]) put(x, 6, 180);
    // a bright rim pixel on the silhouette's edge (no socket above it): never an eye
    put(3, 4, 255);
    const eyes = findEyes(d, W, H, 2, 17);
    expect(eyes).toEqual([
      { x: 8, y: 6 },
      { x: 13, y: 6 },
    ]);
  });
});
