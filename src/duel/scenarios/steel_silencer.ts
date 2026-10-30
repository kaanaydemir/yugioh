// QA scenarios for Çelik Susturucu (steel_silencer) — film its life cycle through the DEFAULT cinematic path:
//   node tools/shot.mjs "?dev=duel&s=ssSummon&look=v3&zones=5" --fresh --film 16 --every 120 --cols 4
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
  ssSummon: {
    desc: 'Çelik Susturucu: tribute summoned (Sv6, one tribute)',
    stage: { p0: { hand: ['steel_silencer'], monsters: ['stone_sentinel'] }, p1: { monsters: [null, 'volt_lizard'] } },
    steps: [summon('steel_silencer', 1, ['stone_sentinel'])],
  },
  ssSummonP2: {
    desc: 'Çelik Susturucu: player 2 tribute summons it',
    stage: { active: 1, p0: { monsters: ['stone_sentinel'] }, p1: { hand: ['steel_silencer'], monsters: ['ember_wolf'] } },
    steps: [summon('steel_silencer', 1, ['ember_wolf'], 1)],
  },
  ssAttack: {
    desc: 'Çelik Susturucu attacks an attack-position monster and destroys it',
    stage: { phase: 'battle', p0: { monsters: ['steel_silencer'] }, p1: { monsters: [{ id: 'stone_sentinel', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  ssAttackP2: {
    desc: 'Çelik Susturucu (player 2) attacks',
    stage: { phase: 'battle', active: 1, p0: { monsters: [{ id: 'stone_sentinel', position: 'attack' }] }, p1: { monsters: ['steel_silencer'] } },
    steps: [attack(0, 0, 1)],
  },
  ssHit: {
    desc: 'Çelik Susturucu is struck but survives (ATK 2400 vs a wolf)',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: [{ id: 'steel_silencer', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  ssKill: {
    desc: 'Çelik Susturucu is destroyed in battle (hit, death)',
    stage: { phase: 'battle', p0: { monsters: ['dusk_sorcerer'] }, p1: { monsters: [{ id: 'steel_silencer', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  ssKillP2: {
    desc: 'Çelik Susturucu (player 1) is destroyed in battle',
    stage: { phase: 'battle', active: 1, p1: { monsters: ['dusk_sorcerer'] }, p0: { monsters: [{ id: 'steel_silencer', position: 'attack' }] } },
    steps: [attack(0, 0, 1)],
  },
  ssGuard: {
    desc: 'Çelik Susturucu in defense (guard) takes an attack',
    stage: { phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: [{ id: 'steel_silencer', position: 'defense' }] } },
    steps: [attack(0, 0)],
  },
};

export default scenarios;
