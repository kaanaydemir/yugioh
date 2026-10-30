// QA scenarios for Kül Ejderi (ashen_drake) — film its life cycle through the DEFAULT cinematic path:
//   node tools/shot.mjs "?dev=duel&s=adSummon&look=v3&zones=5" --fresh --film 16 --every 120 --cols 4
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';

const attack = (attackerZone: number, targetZone: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone, targetZone });
const summon = (id: CardId, zone: number, tributes: CardId[] = [], player: PlayerId = 0): Step => (D) => ({
  type: 'normalSummon',
  player,
  uid: D.uid(id, player),
  zone,
  tributes: tributes.map((t) => D.uid(t, player)),
});

const scenarios: Record<string, Scenario> = {
  adSummon: {
    desc: 'Kül Ejderi: tribute summoned (Sv7, two tributes)',
    stage: { p0: { hand: ['ashen_drake'], monsters: ['stone_sentinel', null, 'storm_hawk'] }, p1: { monsters: [null, 'volt_lizard'] } },
    steps: [summon('ashen_drake', 1, ['stone_sentinel', 'storm_hawk'])],
  },
  adSummonP2: {
    desc: 'Kül Ejderi: player 2 tribute summons it',
    stage: { p0: { monsters: ['stone_sentinel'] }, p1: { hand: ['ashen_drake'], monsters: ['ember_wolf', null, 'storm_hawk'] } },
    steps: [summon('ashen_drake', 1, ['ember_wolf', 'storm_hawk'], 1)],
  },
  adAttack: {
    desc: 'Kül Ejderi attacks an attack-position monster and destroys it',
    stage: { phase: 'battle', p0: { monsters: ['ashen_drake'] }, p1: { monsters: [{ id: 'stone_sentinel', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  adAttackP2: {
    desc: 'Kül Ejderi (player 2) attacks',
    stage: { phase: 'battle', active: 1, p0: { monsters: [{ id: 'stone_sentinel', position: 'attack' }] }, p1: { monsters: ['ashen_drake'] } },
    steps: [attack(0, 0, 1)],
  },
  adHit: {
    desc: 'Kül Ejderi is struck but survives (ATK 2400 vs 1500 wolf)',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: [{ id: 'ashen_drake', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  adKill: {
    desc: 'Kül Ejderi is destroyed in battle (hit, death)',
    stage: { phase: 'battle', p0: { monsters: ['windmane_knight'] }, p1: { monsters: [{ id: 'ashen_drake', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  adKillP2: {
    desc: 'Kül Ejderi (player 1) is destroyed in battle',
    stage: { phase: 'battle', active: 1, p1: { monsters: ['windmane_knight'] }, p0: { monsters: [{ id: 'ashen_drake', position: 'attack' }] } },
    steps: [attack(0, 0, 1)],
  },
  adGuard: {
    desc: 'Kül Ejderi in defense (guard) takes an attack',
    stage: { phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: [{ id: 'ashen_drake', position: 'defense' }] } },
    steps: [attack(0, 0)],
  },
};

export default scenarios;
