// QA scenarios for Sol Bacak Mührü (seal_leg_l) — film its life cycle through the DEFAULT cinematic path:
//   node tools/shot.mjs "?dev=duel&s=sllSummon&look=v3&zones=5" --fresh --film 16 --every 120 --cols 4
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
  sllSummon: {
    desc: 'Sol Bacak Mührü: normal summoned',
    stage: { p0: { hand: ['seal_leg_l'] }, p1: { monsters: [null, 'volt_lizard'] } },
    steps: [summon('seal_leg_l', 1)],
  },
  sllSummonP2: {
    desc: 'Sol Bacak Mührü: player 2 summons it',
    stage: { active: 1, p0: { monsters: ['stone_sentinel'] }, p1: { hand: ['seal_leg_l'] } },
    steps: [summon('seal_leg_l', 1, 1)],
  },
  sllAttack: {
    desc: 'Sol Bacak Mührü attacks an attack-position monster',
    stage: { phase: 'battle', p0: { monsters: ['seal_leg_l'] }, p1: { monsters: [{ id: 'stone_sentinel', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  sllAttackP2: {
    desc: 'Sol Bacak Mührü (player 2) attacks',
    stage: { phase: 'battle', active: 1, p0: { monsters: [{ id: 'stone_sentinel', position: 'attack' }] }, p1: { monsters: ['seal_leg_l'] } },
    steps: [attack(0, 0, 1)],
  },
  sllHit: {
    desc: 'Sol Bacak Mührü is struck but survives',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: [{ id: 'seal_leg_l', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  sllKill: {
    desc: 'Sol Bacak Mührü is destroyed in battle',
    stage: { phase: 'battle', p0: { monsters: ['crystal_wyrm'] }, p1: { monsters: [{ id: 'seal_leg_l', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  sllKillP2: {
    desc: 'Sol Bacak Mührü (player 1) is destroyed in battle',
    stage: { phase: 'battle', active: 1, p1: { monsters: ['crystal_wyrm'] }, p0: { monsters: [{ id: 'seal_leg_l', position: 'attack' }] } },
    steps: [attack(0, 0, 1)],
  },
  sllGuard: {
    desc: 'Sol Bacak Mührü in defense (guard) takes an attack',
    stage: { phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: [{ id: 'seal_leg_l', position: 'defense' }] } },
    steps: [attack(0, 0)],
  },
  sllHand: {
    desc: 'Sol Bacak Mührü in hand next to other cards (card picture)',
    stage: { p0: { hand: ['stone_sentinel', 'seal_leg_l', 'crystal_wyrm', 'ember_wolf'] }, p1: { monsters: ['volt_lizard'] } },
    steps: [],
  },
};

export default scenarios;
