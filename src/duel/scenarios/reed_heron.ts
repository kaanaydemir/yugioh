// QA scenarios for Sazlık Balıkçılı (reed_heron, lane C, C8) — its own v3 cinematics (src/cinematics/kartc/reed_heron.ts):
//   node tools/shot.mjs "?dev=duel&s=rhrAttack&look=v3&zones=5" --fresh --film 24 --every 80 --cols 6 --clip 120,40,400,240
// Every stage is 5 zones explicitly (the 3 → 5 lane shift never moves the films). Heron: ATK 1400 / DEF 1500.
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';

const N = null;
const attack = (attackerZone: number, targetZone: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone, targetZone });
const summon = (id: CardId, zone: number, player: PlayerId = 0): Step => (D) => ({ type: 'normalSummon', player, uid: D.uid(id, player), zone, tributes: [] });

const S: Record<string, Scenario> = {
  rhrSummon: {
    desc: 'Sazlık Balıkçılı: normal summon — mist wall, eye glint, the mist parts, one wing fan',
    stage: { zones: 5, p0: { hand: ['reed_heron'] }, p1: { monsters: [N, N, 'stone_sentinel', N, N] } },
    steps: [summon('reed_heron', 2)],
  },
  rhrSummonP2: {
    desc: 'Sazlık Balıkçılı: player 2 summons it',
    stage: { zones: 5, active: 1, p0: { monsters: [N, N, 'stone_sentinel', N, N] }, p1: { hand: ['reed_heron'] } },
    steps: [summon('reed_heron', 2, 1)],
  },
  rhrAttack: {
    desc: 'Gaga Hamlesi: coil, 200 ms freeze, two glides, ta-ta-TAK on an attack-position stone_sentinel (1400 vs 500)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'reed_heron', N, N] }, p1: { monsters: [N, N, { id: 'stone_sentinel', position: 'attack' }, N, N] } },
    steps: [attack(2, 2)],
  },
  rhrAttackP2: {
    desc: 'Gaga Hamlesi as player 2 (relit, mirrored)',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: [N, N, { id: 'stone_sentinel', position: 'attack' }, N, N] }, p1: { monsters: [N, N, 'reed_heron', N, N] } },
    steps: [attack(2, 2, 1)],
  },
  rhrDirect: {
    desc: 'direct attack: the glide ends at the duelist plate, the triple lands on the duelist',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'reed_heron', N, N] } },
    steps: [attack(2, null)],
  },
  rhrBlocked: {
    desc: 'blocked: tak-tak-TING on a defending stone_sentinel (DEF 2100), the hop back',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'reed_heron', N, N] }, p1: { monsters: [N, N, { id: 'stone_sentinel', position: 'defense' }, N, N] } },
    steps: [attack(2, 2)],
  },
  rhrHit: {
    desc: 'struck by a weaker attacker (storm_hawk 1000 vs 1400): the S-neck spring, the attacker breaks',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'storm_hawk', N, N] }, p1: { monsters: [N, N, { id: 'reed_heron', position: 'attack' }, N, N] } },
    steps: [attack(2, 2)],
  },
  rhrKill: {
    desc: 'destroyed in battle (shade_assassin 1900 vs 1400): back into the mist, only the reeds and one ring remain',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'shade_assassin', N, N] }, p1: { monsters: [N, N, { id: 'reed_heron', position: 'attack' }, N, N] } },
    steps: [attack(2, 2)],
  },
  rhrKillP2: {
    desc: 'destroyed in battle as player 1 by player 2 (relit P2 attacker, the heron unmirrored)',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: [N, N, { id: 'reed_heron', position: 'attack' }, N, N] }, p1: { monsters: [N, N, 'shade_assassin', N, N] } },
    steps: [attack(2, 2, 1)],
  },
  rhrGuard: {
    desc: 'defense holds (volt_lizard ATK 1500 vs DEF 1500): the cloak guard, fuff + reeds',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'volt_lizard', N, N] }, p1: { monsters: [N, N, { id: 'reed_heron', position: 'defense' }, N, N] } },
    steps: [attack(2, 2)],
  },
  rhrGuardDies: {
    desc: 'dies in defense (shade_assassin 1900 vs DEF 1500)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'shade_assassin', N, N] }, p1: { monsters: [N, N, { id: 'reed_heron', position: 'defense' }, N, N] } },
    steps: [attack(2, 2)],
  },
  rhrLoses: {
    desc: 'attacks a stronger monster (volt_lizard 1500 vs 1400): the triple lands, the counter kills him where he stands',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'reed_heron', N, N] }, p1: { monsters: [N, N, { id: 'volt_lizard', position: 'attack' }, N, N] } },
    steps: [attack(2, 2)],
  },
};
export default S;
