// QA scenarios for Mühürlü Baş (seal_head) — film its life cycle through the DEFAULT cinematic path:
//   node tools/shot.mjs "?dev=duel&s=shSummon&look=v3&zones=5" --fresh --film 16 --every 120 --cols 4
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
  shSummon: {
    desc: 'Mühürlü Baş: normal summoned (Sv3)',
    stage: { p0: { hand: ['seal_head'] }, p1: { monsters: [null, 'volt_lizard'] } },
    steps: [summon('seal_head', 1)],
  },
  shSummonP2: {
    desc: 'Mühürlü Baş: player 2 summons it',
    stage: { active: 1, p0: { monsters: ['stone_sentinel'] }, p1: { hand: ['seal_head'] } },
    steps: [summon('seal_head', 1, 1)],
  },
  shAttack: {
    desc: 'Mühürlü Baş attacks an attack-position monster',
    stage: { phase: 'battle', p0: { monsters: ['seal_head'] }, p1: { monsters: [{ id: 'stone_sentinel', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  shAttackP2: {
    desc: 'Mühürlü Baş (player 2) attacks',
    stage: { phase: 'battle', active: 1, p0: { monsters: [{ id: 'stone_sentinel', position: 'attack' }] }, p1: { monsters: ['seal_head'] } },
    steps: [attack(0, 0, 1)],
  },
  shHit: {
    desc: 'Mühürlü Baş is struck but survives',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: [{ id: 'seal_head', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  shKill: {
    desc: 'Mühürlü Baş is destroyed in battle',
    stage: { phase: 'battle', p0: { monsters: ['crystal_wyrm'] }, p1: { monsters: [{ id: 'seal_head', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  shKillP2: {
    desc: 'Mühürlü Baş (player 1) is destroyed in battle',
    stage: { phase: 'battle', active: 1, p1: { monsters: ['crystal_wyrm'] }, p0: { monsters: [{ id: 'seal_head', position: 'attack' }] } },
    steps: [attack(0, 0, 1)],
  },
  shGuard: {
    desc: 'Mühürlü Baş in defense (guard) takes an attack',
    stage: { phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: [{ id: 'seal_head', position: 'defense' }] } },
    steps: [attack(0, 0)],
  },
  shHand: {
    desc: 'Mühürlü Baş in hand next to other cards (card picture)',
    stage: { p0: { hand: ['stone_sentinel', 'seal_head', 'crystal_wyrm', 'ember_wolf'] }, p1: { monsters: ['volt_lizard'] } },
    steps: [],
  },
};

export default scenarios;
