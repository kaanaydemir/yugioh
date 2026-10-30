// QA scenarios for Zehir Ejderi (venom_drake) — film its life cycle through the DEFAULT cinematic path:
//   node tools/shot.mjs "?dev=duel&s=vdSummon&look=v3&zones=5" --fresh --film 16 --every 120 --cols 4
// vdSummon / vdAttack / vdHit / vdKill stage it for player 1 (P1 look); the *P2 variants put it on player 2's side.
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';

const attack = (attackerZone: number, targetZone: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone, targetZone });
const battle = (player: PlayerId = 0): Action => ({ type: 'enterBattle', player });
const summon = (id: CardId, zone: number, tributes: CardId[] = [], player: PlayerId = 0): Step => (D) => ({
  type: 'normalSummon',
  player,
  uid: D.uid(id, player),
  zone,
  tributes: tributes.map((t) => D.uid(t, player)),
});

const scenarios: Record<string, Scenario> = {
  vdSummon: {
    desc: 'Zehir Ejderi: tribute summoned (Sv5) into lane 3',
    stage: { p0: { hand: ['venom_drake'], monsters: ['stone_sentinel', null, 'storm_hawk'] }, p1: { monsters: [null, 'volt_lizard'] } },
    steps: [summon('venom_drake', 1, ['stone_sentinel'])],
  },
  vdSummonP2: {
    desc: 'Zehir Ejderi: player 2 tribute summons it',
    stage: { p0: { monsters: ['stone_sentinel', null, 'storm_hawk'] }, p1: { hand: ['venom_drake'], monsters: ['ember_wolf'] } },
    steps: [summon('venom_drake', 1, ['ember_wolf'], 1)],
  },
  vdAttack: {
    desc: 'Zehir Ejderi attacks an attack-position monster and destroys it',
    stage: { phase: 'battle', p0: { monsters: ['venom_drake'] }, p1: { monsters: [{ id: 'stone_sentinel', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  vdAttackP2: {
    desc: 'Zehir Ejderi (player 2) attacks',
    stage: { phase: 'battle', active: 1, p0: { monsters: [{ id: 'stone_sentinel', position: 'attack' }] }, p1: { monsters: ['venom_drake'] } },
    steps: [attack(0, 0, 1)],
  },
  vdHit: {
    desc: 'Zehir Ejderi is struck (loses the exchange but survives: ATK 2000 vs 1500 wolf)',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: [{ id: 'venom_drake', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  vdKill: {
    desc: 'Zehir Ejderi is destroyed in battle (hit, death)',
    stage: { phase: 'battle', p0: { monsters: ['crystal_wyrm'] }, p1: { monsters: [{ id: 'venom_drake', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
};

export default scenarios;
