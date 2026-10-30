// QA scenarios for Sağ Bacak Mührü (seal_leg_r) — film its life cycle through the DEFAULT cinematic path:
//   node tools/shot.mjs "?dev=duel&s=slrSummon&look=v3&zones=5" --fresh --film 16 --every 120 --cols 4
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';

const attack = (attackerZone: number, targetZone: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone, targetZone });
const summon = (id: CardId, zone: number, player: PlayerId = 0): Step => (D) => ({
  type: 'normalSummon',
  player,
  uid: D.uid(id, player),
  zone,
  tributes: [],
});

const scenarios: Record<string, Scenario> = {
  slrSummon: {
    desc: 'Sağ Bacak Mührü: normal summoned',
    stage: { p0: { hand: ['seal_leg_r'] }, p1: { monsters: [null, 'volt_lizard'] } },
    steps: [summon('seal_leg_r', 1)],
  },
  slrSummonP2: {
    desc: 'Sağ Bacak Mührü: player 2 summons it',
    stage: { active: 1, p0: { monsters: ['stone_sentinel'] }, p1: { hand: ['seal_leg_r'] } },
    steps: [summon('seal_leg_r', 1, 1)],
  },
  slrAttack: {
    desc: 'Sağ Bacak Mührü attacks an attack-position monster',
    stage: { phase: 'battle', p0: { monsters: ['seal_leg_r'] }, p1: { monsters: [{ id: 'stone_sentinel', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  slrAttackP2: {
    desc: 'Sağ Bacak Mührü (player 2) attacks',
    stage: { phase: 'battle', active: 1, p0: { monsters: [{ id: 'stone_sentinel', position: 'attack' }] }, p1: { monsters: ['seal_leg_r'] } },
    steps: [attack(0, 0, 1)],
  },
  slrHit: {
    desc: 'Sağ Bacak Mührü is struck but survives',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: [{ id: 'seal_leg_r', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  slrKill: {
    desc: 'Sağ Bacak Mührü is destroyed in battle',
    stage: { phase: 'battle', p0: { monsters: ['crystal_wyrm'] }, p1: { monsters: [{ id: 'seal_leg_r', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  slrKillP2: {
    desc: 'Sağ Bacak Mührü (player 1) is destroyed in battle',
    stage: { phase: 'battle', active: 1, p1: { monsters: ['crystal_wyrm'] }, p0: { monsters: [{ id: 'seal_leg_r', position: 'attack' }] } },
    steps: [attack(0, 0, 1)],
  },
  slrGuard: {
    desc: 'Sağ Bacak Mührü in defense (guard) takes an attack',
    stage: { phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: [{ id: 'seal_leg_r', position: 'defense' }] } },
    steps: [attack(0, 0)],
  },
  slrHand: {
    desc: 'Sağ Bacak Mührü in hand next to other cards (card picture)',
    stage: { p0: { hand: ['stone_sentinel', 'seal_leg_r', 'crystal_wyrm', 'ember_wolf'] }, p1: { monsters: ['volt_lizard'] } },
    steps: [],
  },
};

export default scenarios;
