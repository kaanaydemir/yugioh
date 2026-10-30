// QA scenarios for Hortlak Muhafız (grim_warden) — film its life cycle through the DEFAULT cinematic path:
//   node tools/shot.mjs "?dev=duel&s=gwSummon&look=v3&zones=5" --fresh --film 16 --every 120 --cols 4
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
  gwSummon: {
    desc: 'Hortlak Muhafız: tribute summoned (Sv6, one tribute)',
    stage: { p0: { hand: ['grim_warden'], monsters: ['stone_sentinel'] }, p1: { monsters: [null, 'volt_lizard'] } },
    steps: [summon('grim_warden', 1, ['stone_sentinel'])],
  },
  gwSummonP2: {
    desc: 'Hortlak Muhafız: player 2 tribute summons it',
    stage: { active: 1, p0: { monsters: ['stone_sentinel'] }, p1: { hand: ['grim_warden'], monsters: ['ember_wolf'] } },
    steps: [summon('grim_warden', 1, ['ember_wolf'], 1)],
  },
  gwAttack: {
    desc: 'Hortlak Muhafız attacks an attack-position monster and destroys it',
    stage: { phase: 'battle', p0: { monsters: ['grim_warden'] }, p1: { monsters: [{ id: 'stone_sentinel', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  gwAttackP2: {
    desc: 'Hortlak Muhafız (player 2) attacks',
    stage: { phase: 'battle', active: 1, p0: { monsters: [{ id: 'stone_sentinel', position: 'attack' }] }, p1: { monsters: ['grim_warden'] } },
    steps: [attack(0, 0, 1)],
  },
  gwHit: {
    desc: 'Hortlak Muhafız is struck but survives',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: [{ id: 'grim_warden', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  gwKill: {
    desc: 'Hortlak Muhafız is destroyed in battle (hit, death)',
    stage: { phase: 'battle', p0: { monsters: ['crystal_wyrm'] }, p1: { monsters: [{ id: 'grim_warden', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  gwKillP2: {
    desc: 'Hortlak Muhafız (player 1) is destroyed in battle',
    stage: { phase: 'battle', active: 1, p1: { monsters: ['crystal_wyrm'] }, p0: { monsters: [{ id: 'grim_warden', position: 'attack' }] } },
    steps: [attack(0, 0, 1)],
  },
  gwGuard: {
    desc: 'Hortlak Muhafız in defense (guard) takes an attack',
    stage: { phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: [{ id: 'grim_warden', position: 'defense' }] } },
    steps: [attack(0, 0)],
  },
};

export default scenarios;
