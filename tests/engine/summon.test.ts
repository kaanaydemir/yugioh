import { describe, expect, it } from 'vitest';
import { EngineError, apply, legalActions, type Action } from '../../src/engine';
import { isListed, play, scenario, seq, uidOf } from './helpers';

const summons = (acts: Action[]) => acts.filter((a) => a.type === 'normalSummon');
const sets = (acts: Action[]) => acts.filter((a) => a.type === 'setMonster');

describe('normal summon', () => {
  it('summons a level ≤4 monster in face-up attack position to any free zone', () => {
    const s = scenario({ p0: { hand: ['shade_assassin'], monsters: [null, 'stone_sentinel', null] } });
    const uid = uidOf(s, 'shade_assassin');
    const zones = summons(legalActions(s)).map((a) => (a.type === 'normalSummon' ? a.zone : -1));
    expect(zones).toEqual([0, 2]);
    const r = play(s, { type: 'normalSummon', player: 0, uid, zone: 2, tributes: [] });
    expect(r.events).toEqual([
      { type: 'summon', player: 0, uid, cardId: 'shade_assassin', zone: 2, method: 'normal', position: 'attack', from: 'hand', sourceUid: null },
    ]);
    expect(r.state.players[0].monsters[2]).toEqual({ uid, position: 'attack', faceUp: true, enteredTurn: 3, attacksThisTurn: 0, positionChangedTurn: -1 });
    expect(r.state.players[0].hand).toEqual([]);
  });

  it('only one normal summon or set per turn', () => {
    const s = scenario({ p0: { hand: ['shade_assassin', 'ember_wolf'] } });
    const r = play(s, { type: 'setMonster', player: 0, uid: uidOf(s, 'shade_assassin'), zone: 0, tributes: [] });
    expect(summons(legalActions(r.state))).toHaveLength(0);
    expect(sets(legalActions(r.state))).toHaveLength(0);
    expect(() => apply(r.state, { type: 'normalSummon', player: 0, uid: uidOf(s, 'ember_wolf'), zone: 1, tributes: [] })).toThrow(EngineError);
  });

  it('no summon when all monster zones are full and no tribute is needed', () => {
    const s = scenario({ p0: { hand: ['shade_assassin'], monsters: ['stone_sentinel', 'tide_golem', 'lumen_sprite'] } });
    expect(summons(legalActions(s))).toHaveLength(0);
  });
});

describe('tribute summon', () => {
  it('level 5–6 needs exactly 1 tribute; the new monster may take the freed zone', () => {
    const s = scenario({ p0: { hand: ['coral_serpent'], monsters: ['stone_sentinel', null, 'lumen_sprite'] } });
    const acts = summons(legalActions(s)) as Extract<Action, { type: 'normalSummon' }>[];
    // tribute sentinel → zones 0,1 ; tribute sprite → zones 1,2
    expect(acts.map((a) => `${a.tributes.length}@${a.zone}`).sort()).toEqual(['1@0', '1@1', '1@1', '1@2']);
    expect(acts.every((a) => a.tributes.length === 1)).toBe(true);
    const sentinel = uidOf(s, 'stone_sentinel');
    const serpent = uidOf(s, 'coral_serpent');
    const r = play(s, { type: 'normalSummon', player: 0, uid: serpent, zone: 0, tributes: [sentinel] });
    expect(seq(r.state, r.events)).toEqual(['tribute:stone_sentinel', 'toGraveyard:stone_sentinel', 'summon:coral_serpent']);
    expect(r.events[0]).toEqual({ type: 'tribute', player: 0, uid: sentinel, cardId: 'stone_sentinel', zone: 0, forUid: serpent });
    expect(r.events[1]).toEqual({ type: 'toGraveyard', owner: 0, uid: sentinel, cardId: 'stone_sentinel', from: 'monster', zone: 0 });
    expect(r.events[2]).toMatchObject({ method: 'tribute', zone: 0, from: 'hand' });
    expect(r.state.players[0].graveyard).toEqual([sentinel]);
  });

  it('level 7 needs 2 tributes (every combination × destination zone is listed)', () => {
    const s = scenario({ p0: { hand: ['crystal_wyrm'], monsters: ['stone_sentinel', { id: 'tide_golem', faceUp: false }, 'lumen_sprite'] } });
    const acts = summons(legalActions(s)) as Extract<Action, { type: 'normalSummon' }>[];
    expect(acts).toHaveLength(6); // C(3,2)=3 combos × 2 freed zones
    expect(acts.every((a) => a.tributes.length === 2)).toBe(true);
    expect(sets(legalActions(s))).toHaveLength(6);
    const one = scenario({ p0: { hand: ['crystal_wyrm'], monsters: ['stone_sentinel'] } });
    expect(summons(legalActions(one))).toHaveLength(0);
    const wyrm = uidOf(s, 'crystal_wyrm');
    const golem = uidOf(s, 'tide_golem');
    const sprite = uidOf(s, 'lumen_sprite');
    // tribute order in the action does not matter; events follow zone order
    const r = play(s, { type: 'normalSummon', player: 0, uid: wyrm, zone: 2, tributes: [sprite, golem] });
    expect(seq(r.state, r.events)).toEqual([
      'tribute:tide_golem',
      'toGraveyard:tide_golem',
      'tribute:lumen_sprite',
      'toGraveyard:lumen_sprite',
      'summon:crystal_wyrm',
    ]);
    expect(r.state.players[0].monsters.map((m) => m && r.state.cards[m.uid].cardId)).toEqual(['stone_sentinel', null, 'crystal_wyrm']);
  });

  it('wrong tribute count or tributing an opponent monster is illegal', () => {
    const s = scenario({ p0: { hand: ['coral_serpent', 'ember_wolf'], monsters: ['stone_sentinel', 'lumen_sprite'] }, p1: { monsters: ['tide_golem'] } });
    const serpent = uidOf(s, 'coral_serpent');
    const both = [uidOf(s, 'stone_sentinel'), uidOf(s, 'lumen_sprite')];
    expect(() => apply(s, { type: 'normalSummon', player: 0, uid: serpent, zone: 2, tributes: [] })).toThrow(EngineError);
    expect(() => apply(s, { type: 'normalSummon', player: 0, uid: serpent, zone: 0, tributes: both })).toThrow(EngineError);
    expect(() => apply(s, { type: 'normalSummon', player: 0, uid: serpent, zone: 2, tributes: [uidOf(s, 'tide_golem')] })).toThrow(EngineError);
    expect(() => apply(s, { type: 'normalSummon', player: 0, uid: uidOf(s, 'ember_wolf'), zone: 2, tributes: [both[0]] })).toThrow(EngineError);
  });

  it('a tributed monster takes its equip spell with it (destroy by rule)', () => {
    const s = scenario({ p0: { hand: ['magma_titan'], monsters: ['shade_assassin'], spellTraps: [null, { id: 'dragon_blade', equippedTo: 0 }] } });
    const r = play(s, { type: 'normalSummon', player: 0, uid: uidOf(s, 'magma_titan'), zone: 0, tributes: [uidOf(s, 'shade_assassin')] });
    expect(seq(r.state, r.events).slice(0, 5)).toEqual([
      'tribute:shade_assassin',
      'toGraveyard:shade_assassin',
      'destroy:dragon_blade',
      'toGraveyard:dragon_blade',
      'summon:magma_titan',
    ]);
    expect(r.events[2]).toMatchObject({ reason: 'rule', location: 'spellTrap', zone: 1 });
    expect(r.events[3]).toMatchObject({ from: 'spellTrap', zone: 1 });
  });
});

describe('set and flip summon', () => {
  it('set: face-down defense, no cardId in the event, counts as the normal summon', () => {
    const s = scenario({ p0: { hand: ['thorn_lurker'] } });
    const uid = uidOf(s, 'thorn_lurker');
    const r = play(s, { type: 'setMonster', player: 0, uid, zone: 1, tributes: [] });
    expect(r.events).toEqual([{ type: 'setMonster', player: 0, uid, zone: 1 }]);
    expect(r.state.players[0].monsters[1]).toMatchObject({ faceUp: false, position: 'defense', enteredTurn: 3 });
    expect(r.state.players[0].normalSummonUsed).toBe(true);
    // cannot flip or change position the turn it was set
    expect(legalActions(r.state).some((a) => a.type === 'flipSummon' || a.type === 'changePosition')).toBe(false);
  });

  it('a level 5+ can be set with tributes', () => {
    const s = scenario({ p0: { hand: ['magma_titan'], monsters: ['lumen_sprite'] } });
    const r = play(s, { type: 'setMonster', player: 0, uid: uidOf(s, 'magma_titan'), zone: 0, tributes: [uidOf(s, 'lumen_sprite')] });
    expect(seq(r.state, r.events)).toEqual(['tribute:lumen_sprite', 'toGraveyard:lumen_sprite', 'setMonster:magma_titan']);
  });

  it('flip summon on a later turn: flip → summon(method flip), then no further position change that turn', () => {
    const s = scenario({ p0: { monsters: [{ id: 'stone_sentinel', faceUp: false }] } });
    const uid = uidOf(s, 'stone_sentinel', 0);
    const r = play(s, { type: 'flipSummon', player: 0, zone: 0 });
    expect(r.events).toEqual([
      { type: 'flip', player: 0, uid, cardId: 'stone_sentinel', zone: 0, cause: 'flipSummon' },
      { type: 'summon', player: 0, uid, cardId: 'stone_sentinel', zone: 0, method: 'flip', position: 'attack', from: 'field', sourceUid: null },
    ]);
    expect(r.state.players[0].monsters[0]).toMatchObject({ faceUp: true, position: 'attack', positionChangedTurn: 3 });
    expect(legalActions(r.state).some((a) => a.type === 'changePosition')).toBe(false);
    // flip summon does not use the normal summon right
    expect(r.state.players[0].normalSummonUsed).toBe(false);
    // a flip-summoned monster may attack this turn
    const b = play(r.state, { type: 'enterBattle', player: 0 });
    expect(isListed(b.state, { type: 'attack', player: 0, attackerZone: 0, targetZone: null })).toBe(true);
  });
});

describe('position change', () => {
  it('once per turn, not on the arrival turn, not after attacking, never for face-down monsters', () => {
    const s = scenario({
      p0: {
        hand: ['ember_wolf'],
        monsters: ['shade_assassin', { id: 'stone_sentinel', faceUp: false }, { id: 'tide_golem', position: 'defense' }],
      },
    });
    const pcs = legalActions(s).filter((a) => a.type === 'changePosition');
    expect(pcs.map((a) => (a.type === 'changePosition' ? a.zone : -1))).toEqual([0, 2]);
    const r = play(s, { type: 'changePosition', player: 0, zone: 2 });
    expect(r.events).toEqual([{ type: 'positionChange', player: 0, uid: uidOf(s, 'tide_golem'), zone: 2, position: 'attack' }]);
    expect(isListed(r.state, { type: 'changePosition', player: 0, zone: 2 })).toBe(false);
    const r2 = play(r.state, { type: 'changePosition', player: 0, zone: 0 });
    expect(r2.state.players[0].monsters[0]!.position).toBe('defense');
    // arrival turn
    const fresh = scenario({ p0: { monsters: [{ id: 'shade_assassin', enteredTurn: 3 }] } });
    expect(legalActions(fresh).some((a) => a.type === 'changePosition')).toBe(false);
    // after attacking
    const attacked = scenario({ p0: { monsters: [{ id: 'shade_assassin', attacks: 1 }] } });
    expect(legalActions(attacked).some((a) => a.type === 'changePosition')).toBe(false);
  });

  it('defense-position monsters cannot attack', () => {
    const s = scenario({ p0: { monsters: [{ id: 'shade_assassin', position: 'defense' }] }, phase: 'battle' });
    expect(legalActions(s).some((a) => a.type === 'attack')).toBe(false);
  });
});

describe('spell/trap set', () => {
  it('sets traps and non-field spells face-down into free zones; field spells cannot be set', () => {
    const s = scenario({ p0: { hand: ['mirror_barrier', 'volcano_arena', 'judgment_bolt'], spellTraps: [null, 'chasm_trap', null] } });
    const setActs = legalActions(s).filter((a) => a.type === 'setSpellTrap') as Extract<Action, { type: 'setSpellTrap' }>[];
    expect(setActs.map((a) => `${s.cards[a.uid].cardId}@${a.zone}`)).toEqual(['mirror_barrier@0', 'mirror_barrier@2', 'judgment_bolt@0', 'judgment_bolt@2']);
    const uid = uidOf(s, 'mirror_barrier');
    const r = play(s, { type: 'setSpellTrap', player: 0, uid, zone: 2 });
    expect(r.events).toEqual([{ type: 'setSpellTrap', player: 0, uid, zone: 2 }]);
    expect(r.state.players[0].spellTraps[2]).toEqual({ uid, faceUp: false, setTurn: 3, equippedTo: null });
  });
});
