import { describe, expect, it } from 'vitest';
import type { CardId } from '../../src/data/cards';
import { EngineError, apply, legalActions, type Action, type GameState } from '../../src/engine';
import { isListed, play, scenario, seq, uidOf, type MonSpec } from './helpers';

/** P0 (active, battle phase) attacks with zone 0 into P1's zone 0. */
function duel(attacker: MonSpec, target: MonSpec | null, extra: { p1lp?: number; p0lp?: number; field?: CardId } = {}) {
  const s = scenario({
    phase: 'battle',
    p0: { monsters: [attacker], lp: extra.p0lp, field: extra.field },
    p1: { monsters: target ? [target] : [], lp: extra.p1lp },
  });
  const r = play(s, { type: 'attack', player: 0, attackerZone: 0, targetZone: target ? 0 : null });
  return { s, ...r, seq: seq(r.state, r.events) };
}

const battleEv = (r: { events: { type: string }[] }) => r.events.find((e) => e.type === 'battle') as Extract<
  ReturnType<typeof apply>['events'][number],
  { type: 'battle' }
>;

describe('damage calculation', () => {
  it('ATK vs ATK, higher wins: target destroyed, difference to its controller', () => {
    const r = duel('shade_assassin', 'tide_golem');
    expect(r.seq).toEqual(['attackDeclare:shade_assassin', 'battle:targetDestroyed', 'damage:p1:800', 'destroy:tide_golem', 'toGraveyard:tide_golem']);
    const b = battleEv(r);
    expect(b).toMatchObject({ attackerAtk: 1900, targetPosition: 'attack', targetValue: 1100, attackerZone: 0, targetZone: 0 });
    expect(r.events[3]).toMatchObject({ player: 1, reason: 'battle', sourceUid: uidOf(r.s, 'shade_assassin'), location: 'monster', zone: 0 });
    expect(r.events[4]).toMatchObject({ owner: 1, from: 'monster', zone: 0 });
    expect(r.state.players[1].lp).toBe(3200);
    expect(r.state.players[0].monsters[0]!.attacksThisTurn).toBe(1);
  });

  it('ATK vs ATK, lower loses: attacker destroyed, difference to the attacking player', () => {
    const r = duel('tide_golem', 'shade_assassin');
    expect(r.seq).toEqual(['attackDeclare:tide_golem', 'battle:attackerDestroyed', 'damage:p0:800', 'destroy:tide_golem', 'toGraveyard:tide_golem']);
    expect(r.events[2]).toMatchObject({ source: 'battle', sourceUid: uidOf(r.s, 'shade_assassin'), lpAfter: 3200 });
  });

  it('ATK vs ATK tie: both destroyed, no damage', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: ['shade_assassin'] } });
    const r = play(s, { type: 'attack', player: 0, attackerZone: 0, targetZone: 0 });
    expect(seq(r.state, r.events)).toEqual([
      'attackDeclare:shade_assassin',
      'battle:bothDestroyed',
      'destroy:shade_assassin',
      'toGraveyard:shade_assassin',
      'destroy:shade_assassin',
      'toGraveyard:shade_assassin',
    ]);
    // target is destroyed first, then the attacker
    expect(r.events[2]).toMatchObject({ player: 1 });
    expect(r.events[4]).toMatchObject({ player: 0 });
    expect(r.state.players[0].lp).toBe(4000);
    expect(r.state.players[1].lp).toBe(4000);
  });

  it('ATK vs DEF: higher ATK destroys without damage', () => {
    const r = duel('crystal_wyrm', { id: 'tide_golem', position: 'defense' });
    expect(r.seq).toEqual([
      'attackDeclare:crystal_wyrm',
      'battle:targetDestroyed',
      'destroy:tide_golem',
      'toGraveyard:tide_golem',
      'activate:tide_golem',
      'damage:p0:300',
    ]);
    expect(battleEv(r)).toMatchObject({ targetPosition: 'defense', targetValue: 2000 });
    expect(r.state.players[1].lp).toBe(4000);
  });

  it('ATK vs DEF: lower ATK bounces, attacker takes DEF − ATK, nothing destroyed', () => {
    const r = duel('ember_wolf', { id: 'stone_sentinel', position: 'defense' });
    expect(r.seq).toEqual(['attackDeclare:ember_wolf', 'battle:noDestroy', 'damage:p0:400']);
    expect(r.events[2]).toMatchObject({ sourceUid: uidOf(r.s, 'stone_sentinel', 1) });
  });

  it('ATK equal to DEF: nothing happens', () => {
    const r = duel('volt_lizard', { id: 'magma_titan', position: 'defense' });
    expect(r.seq).toEqual(['attackDeclare:volt_lizard', 'battle:noDestroy']);
  });

  it('piercing (coral_serpent) deals ATK − DEF through a defender; also under volcano', () => {
    const r = duel('coral_serpent', { id: 'shade_assassin', position: 'defense' });
    expect(r.seq).toEqual(['attackDeclare:coral_serpent', 'battle:targetDestroyed', 'damage:p1:1600', 'destroy:shade_assassin', 'toGraveyard:shade_assassin']);
    const v = duel('coral_serpent', { id: 'shade_assassin', position: 'defense' }, { field: 'volcano_arena' });
    expect(battleEv(v)).toMatchObject({ attackerAtk: 1700 });
    expect(v.seq).toContain('damage:p1:1300');
    // no piercing without piercing
    const n = duel('shade_assassin', { id: 'lumen_sprite', position: 'defense' });
    expect(n.seq.filter((x) => x.startsWith('damage'))).toEqual([]);
  });

  it('direct attack when the opponent has no monsters', () => {
    const r = duel('ember_wolf', null);
    expect(r.seq).toEqual(['attackDeclare:ember_wolf', 'battle:direct', 'damage:p1:1700']);
    expect(battleEv(r)).toMatchObject({ targetUid: null, targetZone: null, targetPosition: null, targetValue: null, result: 'direct' });
    expect(r.events[0]).toMatchObject({ targetUid: null, targetZone: null });
  });
});

describe('attack legality', () => {
  it('no direct attack while the opponent has monsters, except storm_hawk', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['ember_wolf', 'storm_hawk'] }, p1: { monsters: [null, 'stone_sentinel'] } });
    const attacks = legalActions(s).filter((a) => a.type === 'attack') as Extract<Action, { type: 'attack' }>[];
    expect(attacks.map((a) => `${a.attackerZone}>${a.targetZone}`)).toEqual(['0>1', '1>1', '1>null']);
    const r = play(s, { type: 'attack', player: 0, attackerZone: 1, targetZone: null });
    expect(seq(r.state, r.events)).toEqual(['attackDeclare:storm_hawk', 'battle:direct', 'damage:p1:1000']);
  });

  it('each monster attacks once per turn', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['ember_wolf'] } });
    const r = play(s, { type: 'attack', player: 0, attackerZone: 0, targetZone: null });
    expect(isListed(r.state, { type: 'attack', player: 0, attackerZone: 0, targetZone: null })).toBe(false);
    expect(() => apply(r.state, { type: 'attack', player: 0, attackerZone: 0, targetZone: null })).toThrow(EngineError);
  });

  it('a monster summoned this turn may attack (not on the very first turn)', () => {
    const s = scenario({ p0: { hand: ['shade_assassin'] } });
    const r = play(s, { type: 'normalSummon', player: 0, uid: uidOf(s, 'shade_assassin'), zone: 0, tributes: [] }, { type: 'enterBattle', player: 0 });
    expect(isListed(r.state, { type: 'attack', player: 0, attackerZone: 0, targetZone: null })).toBe(true);
    const t1 = scenario({ turn: 1, phase: 'battle', p0: { monsters: [{ id: 'shade_assassin', enteredTurn: 1 }] } });
    expect(legalActions(t1).some((a) => a.type === 'attack')).toBe(false);
  });
});

describe('face-down targets', () => {
  it('flip happens before damage calculation, the monster stays in defense', () => {
    const r = duel('ember_wolf', { id: 'stone_sentinel', faceUp: false });
    expect(r.seq).toEqual(['attackDeclare:ember_wolf', 'flip:stone_sentinel', 'battle:noDestroy', 'damage:p0:400']);
    expect(r.events[1]).toMatchObject({ type: 'flip', player: 1, zone: 0, cause: 'attacked' });
    expect(r.state.players[1].monsters[0]).toMatchObject({ faceUp: true, position: 'defense' });
  });

  it('magma_titan flipped by an attack is not summoned (no burn)', () => {
    const r = duel('crystal_wyrm', { id: 'magma_titan', faceUp: false });
    expect(r.seq).toEqual(['attackDeclare:crystal_wyrm', 'flip:magma_titan', 'battle:targetDestroyed', 'destroy:magma_titan', 'toGraveyard:magma_titan']);
  });

  it('thorn_lurker: flip → battle → destroyed → its FLIP effect still destroys an attacker-side monster', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['ember_wolf', 'storm_hawk'] }, p1: { monsters: [{ id: 'thorn_lurker', faceUp: false }] } });
    const r = play(s, { type: 'attack', player: 0, attackerZone: 0, targetZone: 0 });
    expect(seq(r.state, r.events)).toEqual([
      'attackDeclare:ember_wolf',
      'flip:thorn_lurker',
      'battle:targetDestroyed',
      'destroy:thorn_lurker',
      'toGraveyard:thorn_lurker',
      'activate:ember_wolf',
      'damage:p1:300',
      'decision:chooseTarget',
    ]);
    const pd = r.state.pending!;
    expect(pd).toEqual({
      kind: 'chooseTarget',
      player: 1,
      sourceUid: uidOf(s, 'thorn_lurker'),
      candidates: [
        { player: 0, zone: 'monster', index: 0 },
        { player: 0, zone: 'monster', index: 1 },
      ],
    });
    expect(legalActions(r.state)).toHaveLength(2);
    const c = play(r.state, { type: 'chooseTarget', player: 1, target: { player: 0, zone: 'monster', index: 1 } });
    expect(seq(c.state, c.events)).toEqual(['activate:thorn_lurker', 'target', 'destroy:storm_hawk', 'toGraveyard:storm_hawk']);
    expect(c.events[0]).toMatchObject({ kind: 'monsterEffect', from: 'graveyard', zone: null, player: 1 });
    expect(c.events[2]).toMatchObject({ reason: 'effect', sourceUid: uidOf(s, 'thorn_lurker') });
    expect(c.state.phase).toBe('battle');
    expect(c.state.activePlayer).toBe(0);
  });

  it('thorn_lurker surviving the attack keeps its zone and fires from the field', () => {
    const r = duel('lumen_sprite', { id: 'thorn_lurker', faceUp: false });
    expect(r.seq).toEqual(['attackDeclare:lumen_sprite', 'flip:thorn_lurker', 'battle:noDestroy', 'damage:p0:400', 'decision:chooseTarget']);
    const c = play(r.state, { type: 'chooseTarget', player: 1, target: { player: 0, zone: 'monster', index: 0 } });
    expect(c.events[0]).toMatchObject({ type: 'activate', from: 'monster', zone: 0 });
  });

  it('a face-up thorn_lurker attacked does nothing special', () => {
    const r = duel('ember_wolf', { id: 'thorn_lurker', position: 'defense' });
    expect(r.state.pending).toBeNull();
  });
});

describe('post-battle triggers', () => {
  it('volt_lizard destroyed by battle burns the opponent 500, before ember_wolf burns 300', () => {
    const r = duel('ember_wolf', 'volt_lizard');
    expect(r.seq).toEqual([
      'attackDeclare:ember_wolf',
      'battle:targetDestroyed',
      'damage:p1:200',
      'destroy:volt_lizard',
      'toGraveyard:volt_lizard',
      'activate:volt_lizard',
      'damage:p0:500',
      'activate:ember_wolf',
      'damage:p1:300',
    ]);
    expect(r.events[5]).toMatchObject({ kind: 'monsterEffect', from: 'graveyard', zone: null, player: 1 });
    expect(r.events[7]).toMatchObject({ kind: 'monsterEffect', from: 'monster', zone: 0, player: 0 });
  });

  it('volt_lizard as a losing attacker also burns', () => {
    const r = duel('volt_lizard', 'shade_assassin');
    expect(r.seq).toEqual([
      'attackDeclare:volt_lizard',
      'battle:attackerDestroyed',
      'damage:p0:400',
      'destroy:volt_lizard',
      'toGraveyard:volt_lizard',
      'activate:volt_lizard',
      'damage:p1:500',
    ]);
  });

  it('ember_wolf destroying an attacker while defending in attack position also burns; not on mutual destruction', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['tide_golem'] }, p1: { monsters: ['ember_wolf'] } });
    const r = play(s, { type: 'attack', player: 0, attackerZone: 0, targetZone: 0 });
    expect(seq(r.state, r.events).slice(-2)).toEqual(['activate:ember_wolf', 'damage:p0:300']);
    const t = scenario({ phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: ['ember_wolf'] } });
    const tr = play(t, { type: 'attack', player: 0, attackerZone: 0, targetZone: 0 });
    expect(seq(tr.state, tr.events).some((x) => x.startsWith('activate'))).toBe(false);
  });

  it('tide_golem in defense burns the attacker 300 whether it survives or not; not in attack position', () => {
    const survive = duel('shade_assassin', { id: 'tide_golem', position: 'defense' });
    expect(survive.seq).toEqual(['attackDeclare:shade_assassin', 'battle:noDestroy', 'damage:p0:100', 'activate:tide_golem', 'damage:p0:300']);
    expect(survive.events[3]).toMatchObject({ from: 'monster', zone: 0 });
    const facedown = duel('ember_wolf', { id: 'tide_golem', faceUp: false });
    expect(facedown.seq).toEqual(['attackDeclare:ember_wolf', 'flip:tide_golem', 'battle:noDestroy', 'damage:p0:300', 'activate:tide_golem', 'damage:p0:300']);
    const atkPos = duel('shade_assassin', 'tide_golem');
    expect(atkPos.seq.some((x) => x.startsWith('activate'))).toBe(false);
  });

  it('trigger damage can end the game and stops the remaining triggers', () => {
    // ember_wolf (1700) beats volt_lizard (1500): 200 battle damage, then volt burns P0 for 500 → 0.
    const r = duel('ember_wolf', 'volt_lizard', { p0lp: 500 });
    expect(r.seq.slice(-3)).toEqual(['activate:volt_lizard', 'damage:p0:500', 'gameOver:p1:lp']);
    expect(r.state.winner).toBe(1);
  });

  it('battle damage that ends the game still shows the destruction first', () => {
    const r = duel('crystal_wyrm', 'lumen_sprite', { p1lp: 1000 });
    expect(r.seq).toEqual(['attackDeclare:crystal_wyrm', 'battle:targetDestroyed', 'damage:p1:2400', 'destroy:lumen_sprite', 'toGraveyard:lumen_sprite', 'gameOver:p0:lp']);
  });
});

describe('stat modifiers in battle', () => {
  it('equip and field spell change battle values', () => {
    const s: GameState = scenario({
      phase: 'battle',
      p0: { monsters: ['tide_golem'], spellTraps: [{ id: 'dragon_blade', equippedTo: 0 }], field: 'volcano_arena' },
      p1: { monsters: ['ember_wolf'] },
    });
    // tide 1100 + 700 − 300 = 1500 vs ember 1700 + 500 = 2200
    const r = play(s, { type: 'attack', player: 0, attackerZone: 0, targetZone: 0 });
    expect(battleEv(r)).toMatchObject({ attackerAtk: 1500, targetValue: 2200, result: 'attackerDestroyed' });
    expect(seq(r.state, r.events)).toEqual([
      'attackDeclare:tide_golem',
      'battle:attackerDestroyed',
      'damage:p0:700',
      'destroy:tide_golem',
      'toGraveyard:tide_golem',
      'destroy:dragon_blade',
      'toGraveyard:dragon_blade',
      'activate:ember_wolf',
      'damage:p0:300',
    ]);
    expect(r.events[5]).toMatchObject({ reason: 'rule', location: 'spellTrap', zone: 0, sourceUid: uidOf(s, 'tide_golem') });
  });
});
