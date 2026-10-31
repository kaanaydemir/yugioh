// QA scenarios for Kutup Örsü (polar_anvil, lane D, C13) — its v3 life cycle on the 5 + 5 board:
//   node tools/shot.mjs "?dev=duel&s=paSummon&look=v3" --fresh --film 16 --every 100 --cols 4
// The anvil stands in zone 2 (the middle lane) unless a key says otherwise.
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';
import type { MonSpec } from '../scenario';

const N = null;
const five = (...xs: (MonSpec | null)[]): (MonSpec | null)[] => [...xs, ...Array.from({ length: Math.max(0, 5 - xs.length) }, () => null)];
const attack = (attackerZone: number, targetZone: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone, targetZone });
const summon = (id: CardId, zone: number, player: PlayerId = 0): Step => (D) => ({ type: 'normalSummon', player, uid: D.uid(id, player), zone, tributes: [] });

const scenarios: Record<string, Scenario> = {
  paSummon: {
    desc: 'Kutup Örsü: normal çağırma (iki yarım örs kayar, KLAK, kıvılcım fıskiyesi)',
    stage: { zones: 5, p0: { hand: ['polar_anvil'] }, p1: { monsters: five(N, N, 'ember_wolf') } },
    steps: [summon('polar_anvil', 2)],
  },
  paSummonP2: {
    desc: 'Kutup Örsü: oyuncu 2 çağırır',
    stage: { zones: 5, active: 1, p0: { monsters: five(N, N, 'ember_wolf') }, p1: { hand: ['polar_anvil'] } },
    steps: [summon('polar_anvil', 2, 1)],
  },
  paAttack: {
    desc: 'Kutup Örsü "İtme Dalgası" saldırı pozisyonundaki Fırtına Atmacası’nı yok eder',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'polar_anvil') }, p1: { monsters: five(N, N, { id: 'storm_hawk', position: 'attack' }) } },
    steps: [attack(2, 2)],
  },
  paAttackP2: {
    desc: 'Kutup Örsü (oyuncu 2) saldırır',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: five(N, N, { id: 'storm_hawk', position: 'attack' }) }, p1: { monsters: five(N, N, 'polar_anvil') } },
    steps: [attack(2, 2, 1)],
  },
  paAttackFar: {
    desc: 'Kutup Örsü çapraz şeritteki hedefe saldırır (dalga uzun yol)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five('polar_anvil') }, p1: { monsters: five(N, N, N, N, { id: 'thorn_lurker', position: 'attack' }) } },
    steps: [attack(0, 4)],
  },
  paDirect: {
    desc: 'Kutup Örsü doğrudan saldırı',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'polar_anvil') } },
    steps: [attack(2, null)],
  },
  paBlocked: {
    desc: 'Kutup Örsü savunmadaki Taş Muhafız’a çarpar (dalga kalkanda kırılır, geri teper)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'polar_anvil') }, p1: { monsters: five(N, N, { id: 'stone_sentinel', position: 'defense' }) } },
    steps: [attack(2, 2)],
  },
  paLose: {
    desc: 'Kutup Örsü daha güçlü Kor Kurdu’na saldırır ve yok olur',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'polar_anvil') }, p1: { monsters: five(N, N, { id: 'ember_wolf', position: 'attack' }) } },
    steps: [attack(2, 2)],
  },
  paKill: {
    desc: 'Kutup Örsü savaşta yok edilir (Kor Kurdu saldırır): kutuplar yer değiştirir, parçalar dışa iter',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'ember_wolf') }, p1: { monsters: five(N, N, { id: 'polar_anvil', position: 'attack' }) } },
    steps: [attack(2, 2)],
  },
  paKillP2: {
    desc: 'Kutup Örsü (oyuncu 1) savaşta yok edilir',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: five(N, N, { id: 'polar_anvil', position: 'attack' }) }, p1: { monsters: five(N, N, 'ember_wolf') } },
    steps: [attack(2, 2, 1)],
  },
  paGuard: {
    desc: 'Kutup Örsü savunmada (DEF 1700) Volt Kertenkelesi’ni karşılar',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'volt_lizard') }, p1: { monsters: five(N, N, { id: 'polar_anvil', position: 'defense' }) } },
    steps: [attack(2, 2)],
  },
  paRevive: {
    desc: 'Ruh Çağrısı Kutup Örsü’nü mezarlıktan geri getirir',
    stage: { zones: 5, p0: { hand: ['soul_recall'], graveyard: ['polar_anvil'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('soul_recall', 0), target: { kind: 'graveyard', uid: D.uid('polar_anvil', 0), toZone: 2 } })],
  },
  paPosition: {
    desc: 'Kutup Örsü savunma pozisyonuna geçer',
    stage: { zones: 5, p0: { monsters: five(N, N, 'polar_anvil') } },
    steps: [{ type: 'changePosition', player: 0, zone: 2 }],
  },
  paFlip: {
    desc: 'Kapalı Kutup Örsü açılarak çağrılır',
    stage: { zones: 5, p0: { monsters: five(N, N, { id: 'polar_anvil', faceUp: false, position: 'defense' }) } },
    steps: [{ type: 'flipSummon', player: 0, zone: 2 }],
  },
};

export default scenarios;
