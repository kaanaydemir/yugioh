// QA scenarios for Yansıyan Okçu (reflection_archer, lane D, C4) — its v3 life cycle on the 5 + 5 board:
//   node tools/shot.mjs "?dev=duel&s=raSummon&look=v3" --fresh --film 16 --every 100 --cols 4
// The archer stands in zone 2 (the middle lane) unless a key says otherwise.
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';
import type { MonSpec } from '../scenario';

const N = null;
const five = (...xs: (MonSpec | null)[]): (MonSpec | null)[] => [...xs, ...Array.from({ length: Math.max(0, 5 - xs.length) }, () => null)];
const attack = (attackerZone: number, targetZone: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone, targetZone });
const summon = (id: CardId, zone: number, player: PlayerId = 0): Step => (D) => ({ type: 'normalSummon', player, uid: D.uid(id, player), zone, tributes: [] });

const scenarios: Record<string, Scenario> = {
  raSummon: {
    desc: 'Yansıyan Okçu: normal çağırma (ışık damlası ayna birikintisine döner, önce yansıma belirir)',
    stage: { zones: 5, p0: { hand: ['reflection_archer'] }, p1: { monsters: five(N, N, 'ember_wolf') } },
    steps: [summon('reflection_archer', 2)],
  },
  raSummonP2: {
    desc: 'Yansıyan Okçu: oyuncu 2 çağırır',
    stage: { zones: 5, active: 1, p0: { monsters: five(N, N, 'ember_wolf') }, p1: { hand: ['reflection_archer'] } },
    steps: [summon('reflection_archer', 2, 1)],
  },
  raAttack: {
    desc: 'Yansıyan Okçu "Ayna Atışı" ile saldırı pozisyonundaki Kor Kurdu’nu yok eder',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'reflection_archer') }, p1: { monsters: five(N, N, { id: 'ember_wolf', position: 'attack' }) } },
    steps: [attack(2, 2)],
  },
  raAttackP2: {
    desc: 'Yansıyan Okçu (oyuncu 2) saldırır',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: five(N, N, { id: 'ember_wolf', position: 'attack' }) }, p1: { monsters: five(N, N, 'reflection_archer') } },
    steps: [attack(2, 2, 1)],
  },
  raAttackFar: {
    desc: 'Yansıyan Okçu çapraz şeritteki hedefe saldırır (uzun atış)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five('reflection_archer') }, p1: { monsters: five(N, N, N, N, { id: 'storm_hawk', position: 'attack' }) } },
    steps: [attack(0, 4)],
  },
  raDirect: {
    desc: 'Yansıyan Okçu doğrudan saldırı',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'reflection_archer') } },
    steps: [attack(2, null)],
  },
  raBlocked: {
    desc: 'Yansıyan Okçu savunmadaki Taş Muhafız’a çarpar (oklar kalkanda seker, geri tepme)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'reflection_archer') }, p1: { monsters: five(N, N, { id: 'stone_sentinel', position: 'defense' }) } },
    steps: [attack(2, 2)],
  },
  raLose: {
    desc: 'Yansıyan Okçu daha güçlü Magma Titanı’na saldırır ve yok olur',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'reflection_archer') }, p1: { monsters: five(N, N, { id: 'magma_titan', position: 'attack' }) } },
    steps: [attack(2, 2)],
  },
  raKill: {
    desc: 'Yansıyan Okçu savaşta yok edilir (Magma Titanı saldırır): birikinti çatlar, yansıma kırılır, okçu cama dağılır',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'magma_titan') }, p1: { monsters: five(N, N, { id: 'reflection_archer', position: 'attack' }) } },
    steps: [attack(2, 2)],
  },
  raKillP2: {
    desc: 'Yansıyan Okçu (oyuncu 1) savaşta yok edilir',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: five(N, N, { id: 'reflection_archer', position: 'attack' }) }, p1: { monsters: five(N, N, 'magma_titan') } },
    steps: [attack(2, 2, 1)],
  },
  raGuard: {
    desc: 'Yansıyan Okçu savunmada (DEF 1000) Fırtına Atmacası’nı karşılar',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'storm_hawk') }, p1: { monsters: five(N, N, { id: 'reflection_archer', position: 'defense' }) } },
    steps: [attack(2, 2)],
  },
  raRevive: {
    desc: 'Ruh Çağrısı Yansıyan Okçu’yu mezarlıktan geri getirir',
    stage: { zones: 5, p0: { hand: ['soul_recall'], graveyard: ['reflection_archer'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('soul_recall', 0), target: { kind: 'graveyard', uid: D.uid('reflection_archer', 0), toZone: 2 } })],
  },
  raPosition: {
    desc: 'Yansıyan Okçu savunma pozisyonuna geçer',
    stage: { zones: 5, p0: { monsters: five(N, N, 'reflection_archer') } },
    steps: [{ type: 'changePosition', player: 0, zone: 2 }],
  },
  raFlip: {
    desc: 'Kapalı Yansıyan Okçu açılarak çağrılır',
    stage: { zones: 5, p0: { monsters: five(N, N, { id: 'reflection_archer', faceUp: false, position: 'defense' }) } },
    steps: [{ type: 'flipSummon', player: 0, zone: 2 }],
  },
};

export default scenarios;
