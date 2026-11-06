// QA scenarios for Kutup İğnesi (polar_needle, lane D, C12) — its v3 life cycle on the 5 + 5 board:
//   node tools/shot.mjs "?dev=duel&s=pnSummon&look=v3" --fresh --film 16 --every 100 --cols 4
// The needle stands in zone 2 (the middle lane) unless a key says otherwise.
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';
import type { MonSpec } from '../scenario';

const N = null;
const five = (...xs: (MonSpec | null)[]): (MonSpec | null)[] => [...xs, ...Array.from({ length: Math.max(0, 5 - xs.length) }, () => null)];
const attack = (attackerZone: number, targetZone: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone, targetZone });
const summon = (id: CardId, zone: number, player: PlayerId = 0): Step => (D) => ({ type: 'normalSummon', player, uid: D.uid(id, player), zone, tributes: [] });

const scenarios: Record<string, Scenario> = {
  pnSummon: {
    desc: 'Kutup İğnesi: normal çağırma (ucunun üstünde iki tur döner, rakibe kilitlenir)',
    stage: { zones: 5, p0: { hand: ['polar_needle'] }, p1: { monsters: five(N, N, 'ember_wolf') } },
    steps: [summon('polar_needle', 2)],
  },
  pnSummonP2: {
    desc: 'Kutup İğnesi: oyuncu 2 çağırır',
    stage: { zones: 5, active: 1, p0: { monsters: five(N, N, 'ember_wolf') }, p1: { hand: ['polar_needle'] } },
    steps: [summon('polar_needle', 2, 1)],
  },
  pnAttack: {
    desc: 'Kutup İğnesi "Kıskaç Hamlesi" saldırı pozisyonundaki Fırtına Atmacası’nı yok eder',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'polar_needle') }, p1: { monsters: five(N, N, { id: 'storm_hawk', position: 'attack' }) } },
    steps: [attack(2, 2)],
  },
  pnAttackP2: {
    desc: 'Kutup İğnesi (oyuncu 2) saldırır',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: five(N, N, { id: 'storm_hawk', position: 'attack' }) }, p1: { monsters: five(N, N, 'polar_needle') } },
    steps: [attack(2, 2, 1)],
  },
  pnAttackFar: {
    desc: 'Kutup İğnesi çapraz şeritteki hedefe saldırır (uzun hamle)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five('polar_needle') }, p1: { monsters: five(N, N, N, N, { id: 'thorn_lurker', position: 'attack' }) } },
    steps: [attack(0, 4)],
  },
  pnDirect: {
    desc: 'Kutup İğnesi doğrudan saldırı',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'polar_needle') } },
    steps: [attack(2, null)],
  },
  pnBlocked: {
    desc: 'Kutup İğnesi savunmadaki Taş Muhafız’a çarpar (parantezler kalkanda kırılır, iğne geri teper)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'polar_needle') }, p1: { monsters: five(N, N, { id: 'stone_sentinel', position: 'defense' }) } },
    steps: [attack(2, 2)],
  },
  pnLose: {
    desc: 'Kutup İğnesi daha güçlü Kor Kurdu’na saldırır ve yok olur',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'polar_needle') }, p1: { monsters: five(N, N, { id: 'ember_wolf', position: 'attack' }) } },
    steps: [attack(2, 2)],
  },
  pnKill: {
    desc: 'Kutup İğnesi savaşta yok edilir (Kor Kurdu saldırır): kuvvet iğneyi söker, levhalar düşer',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'ember_wolf') }, p1: { monsters: five(N, N, { id: 'polar_needle', position: 'attack' }) } },
    steps: [attack(2, 2)],
  },
  pnKillP2: {
    desc: 'Kutup İğnesi (oyuncu 1) savaşta yok edilir',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: five(N, N, { id: 'polar_needle', position: 'attack' }) }, p1: { monsters: five(N, N, 'ember_wolf') } },
    steps: [attack(2, 2, 1)],
  },
  pnGuard: {
    desc: 'Kutup İğnesi savunmada (DEF 1100) Gelgit Golemi’ni karşılar',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'tide_golem') }, p1: { monsters: five(N, N, { id: 'polar_needle', position: 'defense' }) } },
    steps: [attack(2, 2)],
  },
  pnRevive: {
    desc: 'Ruh Çağrısı Kutup İğnesi’ni mezarlıktan geri getirir',
    stage: { zones: 5, p0: { hand: ['soul_recall'], graveyard: ['polar_needle'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('soul_recall', 0), target: { kind: 'graveyard', uid: D.uid('polar_needle', 0), toZone: 2 } })],
  },
  pnPosition: {
    desc: 'Kutup İğnesi savunma pozisyonuna geçer',
    stage: { zones: 5, p0: { monsters: five(N, N, 'polar_needle') } },
    steps: [{ type: 'changePosition', player: 0, zone: 2 }],
  },
  pnFlip: {
    desc: 'Kapalı Kutup İğnesi açılarak çağrılır',
    stage: { zones: 5, p0: { monsters: five(N, N, { id: 'polar_needle', faceUp: false, position: 'defense' }) } },
    steps: [{ type: 'flipSummon', player: 0, zone: 2 }],
  },
};

export default scenarios;
