// Job B: what the ATK/DEF plates show during a battle (battlePlates) and the lock markers (plateLock).
import { describe, expect, it } from 'vitest';
import { battlePlates, currentAtk, currentDef, plateLock } from '../../src/engine';
import { scenario, uidOf } from './helpers';

describe('battlePlates', () => {
  it('Hortlak Muhafiz (declare -400): the attacked ATK-position monster shows ATK-400, the attacker its own', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['grim_warden'] }, p1: { monsters: [{ id: 'venom_drake', position: 'attack' }] } });
    const a = uidOf(s, 'grim_warden');
    const t = uidOf(s, 'venom_drake');
    const p = battlePlates(s, a, t);
    expect(p.attacker).toEqual({ atk: 2500, def: 1200 });
    expect(p.target).toEqual({ atk: 1600, def: currentDef(s, t) });
    expect(currentAtk(s, t)).toBe(2000); // battle-only: the persistent number is untouched
  });
  it('Kalkan Devi (defense, -500 on the attacker): the attacker plate drops, the target keeps DEF', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: [{ id: 'shield_titan', position: 'defense' }] } });
    const p = battlePlates(s, uidOf(s, 'shade_assassin'), uidOf(s, 'shield_titan'));
    expect(p.attacker.atk).toBe(1400);
    expect(p.target).toEqual({ atk: 100, def: 2600 });
  });
  it('in attack position the titan does not lower anything', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: [{ id: 'shield_titan', position: 'attack' }] } });
    expect(battlePlates(s, uidOf(s, 'shade_assassin'), uidOf(s, 'shield_titan')).attacker.atk).toBe(1900);
  });
  it('a one-turn boost (+1000, Savas Narasi / Gizli Takviye) shows on the plate', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: [{ id: 'ember_wolf', position: 'attack' }] } });
    const slot = s.players[0].monsters[0]!;
    slot.boostAtk = 1000;
    slot.boostDef = 0;
    slot.boostTurn = s.turn;
    expect(battlePlates(s, uidOf(s, 'shade_assassin'), uidOf(s, 'ember_wolf')).attacker.atk).toBe(2900);
  });
  it('a direct attack has no target plate', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: {} });
    const p = battlePlates(s, uidOf(s, 'shade_assassin'), null);
    expect(p.target).toBeNull();
    expect(p.attacker.atk).toBe(1900);
  });
});

describe('plateLock', () => {
  it('freeze shows from the effect until the end of the frozen turn, then clears', () => {
    const s = scenario({ p1: { monsters: ['ember_wolf', { id: 'shade_assassin', faceUp: false }] } });
    const slot = s.players[1].monsters[0]!;
    expect(plateLock(s, slot)).toBeNull();
    slot.noAttackTurn = s.turn + 1;
    expect(plateLock(s, slot)).toBe('freeze');
    s.turn += 1;
    expect(plateLock(s, slot)).toBe('freeze'); // the controller's turn: still frozen
    s.turn += 1;
    expect(plateLock(s, slot)).toBeNull();
  });
  it('Diz Cokturme: the position lock shows as a kneel marker for its turns only', () => {
    const s = scenario({ p1: { monsters: ['ember_wolf'] } });
    const slot = s.players[1].monsters[0]!;
    slot.lockPositionTurn = s.turn + 1;
    expect(plateLock(s, slot)).toBe('kneel');
    s.turn += 2;
    expect(plateLock(s, slot)).toBeNull();
  });
  it('a face-down monster shows nothing; freeze wins over kneel', () => {
    const s = scenario({ p1: { monsters: [{ id: 'ember_wolf', faceUp: false }] } });
    const slot = s.players[1].monsters[0]!;
    slot.noAttackTurn = s.turn + 1;
    expect(plateLock(s, slot)).toBeNull();
    slot.faceUp = true;
    slot.lockPositionTurn = s.turn + 1;
    expect(plateLock(s, slot)).toBe('freeze');
  });
});
