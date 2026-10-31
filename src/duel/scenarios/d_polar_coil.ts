// QA scenarios for Kutup Bobini (polar_coil, lane D, C14) — its v3 life cycle on the 5 + 5 board:
//   node tools/shot.mjs "?dev=duel&s=pcSummon&look=v3" --fresh --film 16 --every 100 --cols 4
// The coil stands in zone 2 (the middle lane) unless a key says otherwise.
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';
import type { MonSpec } from '../scenario';

const N = null;
const five = (...xs: (MonSpec | null)[]): (MonSpec | null)[] => [...xs, ...Array.from({ length: Math.max(0, 5 - xs.length) }, () => null)];
const attack = (attackerZone: number, targetZone: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone, targetZone });
const summon = (id: CardId, zone: number, player: PlayerId = 0): Step => (D) => ({ type: 'normalSummon', player, uid: D.uid(id, player), zone, tributes: [] });

const scenarios: Record<string, Scenario> = {
  pcSummon: {
    desc: 'Kutup Bobini: normal çağırma (boş mil dikilir, bakır tel sarılır, kollar telden açılır)',
    stage: { zones: 5, p0: { hand: ['polar_coil'] }, p1: { monsters: five(N, N, 'ember_wolf') } },
    steps: [summon('polar_coil', 2)],
  },
  pcSummonP2: {
    desc: 'Kutup Bobini: oyuncu 2 çağırır',
    stage: { zones: 5, active: 1, p0: { monsters: five(N, N, 'ember_wolf') }, p1: { hand: ['polar_coil'] } },
    steps: [summon('polar_coil', 2, 1)],
  },
  pcAttack: {
    desc: 'Kutup Bobini "Tel Yörüngesi" saldırı pozisyonundaki Fırtına Atmacası’nı yok eder',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'polar_coil') }, p1: { monsters: five(N, N, { id: 'storm_hawk', position: 'attack' }) } },
    steps: [attack(2, 2)],
  },
  pcAttackP2: {
    desc: 'Kutup Bobini (oyuncu 2) saldırır',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: five(N, N, { id: 'storm_hawk', position: 'attack' }) }, p1: { monsters: five(N, N, 'polar_coil') } },
    steps: [attack(2, 2, 1)],
  },
  pcAttackFar: {
    desc: 'Kutup Bobini çapraz şeritteki hedefe saldırır (dikenler uzun yoldan yörüngeye girer)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five('polar_coil') }, p1: { monsters: five(N, N, N, N, { id: 'thorn_lurker', position: 'attack' }) } },
    steps: [attack(0, 4)],
  },
  pcDirect: {
    desc: 'Kutup Bobini doğrudan saldırı',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'polar_coil') } },
    steps: [attack(2, null)],
  },
  pcBlocked: {
    desc: 'Kutup Bobini savunmadaki Taş Muhafız’a çarpar (dikenler kalkanda kırılır)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'polar_coil') }, p1: { monsters: five(N, N, { id: 'stone_sentinel', position: 'defense' }) } },
    steps: [attack(2, 2)],
  },
  pcLose: {
    desc: 'Kutup Bobini daha güçlü Kor Kurdu’na saldırır ve yok olur',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'polar_coil') }, p1: { monsters: five(N, N, { id: 'ember_wolf', position: 'attack' }) } },
    steps: [attack(2, 2)],
  },
  pcKill: {
    desc: 'Kutup Bobini savaşta yok edilir (Kor Kurdu saldırır): tel çözülür, boş mil devrilir, makara boş döner',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'ember_wolf') }, p1: { monsters: five(N, N, { id: 'polar_coil', position: 'attack' }) } },
    steps: [attack(2, 2)],
  },
  pcKillP2: {
    desc: 'Kutup Bobini (oyuncu 1) savaşta yok edilir',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: five(N, N, { id: 'polar_coil', position: 'attack' }) }, p1: { monsters: five(N, N, 'ember_wolf') } },
    steps: [attack(2, 2, 1)],
  },
  pcGuard: {
    desc: 'Kutup Bobini savunmada (DEF 1400) Fırtına Atmacası’nı karşılar',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'storm_hawk') }, p1: { monsters: five(N, N, { id: 'polar_coil', position: 'defense' }) } },
    steps: [attack(2, 2)],
  },
  pcGuardKill: {
    desc: 'Savunmadaki Kutup Bobini’ni Volt Kertenkelesi kırar (DEF 1400 < ATK 1500)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'volt_lizard') }, p1: { monsters: five(N, N, { id: 'polar_coil', position: 'defense' }) } },
    steps: [attack(2, 2)],
  },
  pcDirectP2: {
    desc: 'Kutup Bobini (oyuncu 2) doğrudan saldırı',
    stage: { zones: 5, phase: 'battle', active: 1, p1: { monsters: five(N, N, 'polar_coil') } },
    steps: [attack(2, null, 1)],
  },
  pcRevive: {
    desc: 'Ruh Çağrısı Kutup Bobini’ni mezarlıktan geri getirir',
    stage: { zones: 5, p0: { hand: ['soul_recall'], graveyard: ['polar_coil'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('soul_recall', 0), target: { kind: 'graveyard', uid: D.uid('polar_coil', 0), toZone: 2 } })],
  },
  pcPosition: {
    desc: 'Kutup Bobini savunma pozisyonuna geçer',
    stage: { zones: 5, p0: { monsters: five(N, N, 'polar_coil') } },
    steps: [{ type: 'changePosition', player: 0, zone: 2 }],
  },
  pcFlip: {
    desc: 'Kapalı Kutup Bobini açılarak çağrılır',
    stage: { zones: 5, p0: { monsters: five(N, N, { id: 'polar_coil', faceUp: false, position: 'defense' }) } },
    steps: [{ type: 'flipSummon', player: 0, zone: 2 }],
  },
};

export default scenarios;
