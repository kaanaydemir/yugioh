// QA scenarios for Sağ Kol Mührü (seal_arm_r) — film its life cycle through the DEFAULT cinematic path:
//   node tools/shot.mjs "?dev=duel&s=arSummon&look=v3&zones=5" --fresh --film 16 --every 120 --cols 4
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
  arSummon: {
    desc: 'Sağ Kol Mührü: normal summoned (Sv3)',
    stage: { p0: { hand: ['seal_arm_r'] }, p1: { monsters: [null, 'volt_lizard'] } },
    steps: [summon('seal_arm_r', 1)],
  },
  arSummonP2: {
    desc: 'Sağ Kol Mührü: player 2 summons it',
    stage: { active: 1, p0: { monsters: ['stone_sentinel'] }, p1: { hand: ['seal_arm_r'] } },
    steps: [summon('seal_arm_r', 1, 1)],
  },
  arAttack: {
    desc: 'Sağ Kol Mührü attacks an attack-position monster',
    stage: { phase: 'battle', p0: { monsters: ['seal_arm_r'] }, p1: { monsters: [{ id: 'stone_sentinel', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  arAttackP2: {
    desc: 'Sağ Kol Mührü (player 2) attacks',
    stage: { phase: 'battle', active: 1, p0: { monsters: [{ id: 'stone_sentinel', position: 'attack' }] }, p1: { monsters: ['seal_arm_r'] } },
    steps: [attack(0, 0, 1)],
  },
  arHit: {
    desc: 'Sağ Kol Mührü is struck but survives',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: [{ id: 'seal_arm_r', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  arKill: {
    desc: 'Sağ Kol Mührü is destroyed in battle',
    stage: { phase: 'battle', p0: { monsters: ['crystal_wyrm'] }, p1: { monsters: [{ id: 'seal_arm_r', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  arKillP2: {
    desc: 'Sağ Kol Mührü (player 1) is destroyed in battle',
    stage: { phase: 'battle', active: 1, p1: { monsters: ['crystal_wyrm'] }, p0: { monsters: [{ id: 'seal_arm_r', position: 'attack' }] } },
    steps: [attack(0, 0, 1)],
  },
  arGuard: {
    desc: 'Sağ Kol Mührü in defense (guard) takes an attack',
    stage: { phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: [{ id: 'seal_arm_r', position: 'defense' }] } },
    steps: [attack(0, 0)],
  },
  arHand: {
    desc: 'Sağ Kol Mührü in hand next to other cards (card picture)',
    stage: { p0: { hand: ['stone_sentinel', 'seal_arm_r', 'crystal_wyrm', 'ember_wolf'] }, p1: { monsters: ['volt_lizard'] } },
    steps: [],
  },
};

export default scenarios;
