// QA scenarios for Hurda Akıncıları (scrap_raiders, lane D, C5) — its v3 life cycle on the 5 + 5 board:
//   node tools/shot.mjs "?dev=duel&s=raSummon&look=v3" --fresh --film 16 --every 100 --cols 4
// The cart stands in zone 2 (the middle lane) unless a key says otherwise.
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';
import type { MonSpec } from '../scenario';

const N = null;
const five = (...xs: (MonSpec | null)[]): (MonSpec | null)[] => [...xs, ...Array.from({ length: Math.max(0, 5 - xs.length) }, () => null)];
const attack = (attackerZone: number, targetZone: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone, targetZone });
const summon = (id: CardId, zone: number, player: PlayerId = 0): Step => (D) => ({ type: 'normalSummon', player, uid: D.uid(id, player), zone, tributes: [] });
const end = (player: PlayerId): Action => ({ type: 'endTurn', player });

const scenarios: Record<string, Scenario> = {
  raSummon: {
    desc: 'Hurda Akıncıları: normal çağırma (hurda yağmuru, üç çekiç, soba "vuf", tezahürat)',
    stage: { zones: 5, p0: { hand: ['scrap_raiders'] }, p1: { monsters: five(N, N, 'ember_wolf') } },
    steps: [summon('scrap_raiders', 2)],
  },
  raSummonP2: {
    desc: 'Hurda Akıncıları: oyuncu 2 çağırır',
    stage: { zones: 5, active: 1, p0: { monsters: five(N, N, 'ember_wolf') }, p1: { hand: ['scrap_raiders'] } },
    steps: [summon('scrap_raiders', 2, 1)],
  },
  raAttack: {
    desc: 'Hurda Akıncıları "Hurda Hücumu" saldırı pozisyonundaki Fırtına Atmacası’nı yok eder',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'scrap_raiders') }, p1: { monsters: five(N, N, { id: 'storm_hawk', position: 'attack' }) } },
    steps: [attack(2, 2)],
  },
  raAttackP2: {
    desc: 'Hurda Akıncıları (oyuncu 2) saldırır',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: five(N, N, { id: 'storm_hawk', position: 'attack' }) }, p1: { monsters: five(N, N, 'scrap_raiders') } },
    steps: [attack(2, 2, 1)],
  },
  raAttackFar: {
    desc: 'Hurda Akıncıları çapraz şeritteki hedefe hücum eder (uzun yol, üç zıplama)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five('scrap_raiders') }, p1: { monsters: five(N, N, N, N, { id: 'thorn_lurker', position: 'attack' }) } },
    steps: [attack(0, 4)],
  },
  raDirect: {
    desc: 'Hurda Akıncıları doğrudan saldırı',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'scrap_raiders') } },
    steps: [attack(2, null)],
  },
  raBlocked: {
    desc: 'Hurda Akıncıları savunmadaki Taş Muhafız’a (DEF 2100) çarpar ve geri teper',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'scrap_raiders') }, p1: { monsters: five(N, N, { id: 'stone_sentinel', position: 'defense' }) } },
    steps: [attack(2, 2)],
  },
  raLose: {
    desc: 'Hurda Akıncıları daha güçlü Magma Titanı’na saldırır ve yok olur',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'scrap_raiders') }, p1: { monsters: five(N, N, { id: 'magma_titan', position: 'attack' }) } },
    steps: [attack(2, 2)],
  },
  raKill: {
    desc: 'Hurda Akıncıları savaşta yok edilir (Magma Titanı saldırır): araba çöker, goblinler üç yöne kaçar',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'magma_titan') }, p1: { monsters: five(N, N, { id: 'scrap_raiders', position: 'attack' }) } },
    steps: [attack(2, 2)],
  },
  raKillP2: {
    desc: 'Hurda Akıncıları (oyuncu 1) savaşta yok edilir',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: five(N, N, { id: 'scrap_raiders', position: 'attack' }) }, p1: { monsters: five(N, N, 'magma_titan') } },
    steps: [attack(2, 2, 1)],
  },
  raGuardKill: {
    desc: 'Savunmadaki (yorgun) Hurda Akıncıları (DEF 0) Kor Kurdu’nun saldırısıyla yok olur',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'ember_wolf') }, p1: { monsters: five(N, N, { id: 'scrap_raiders', position: 'defense' }) } },
    steps: [attack(2, 2)],
  },
  raLock: {
    desc: 'Hurda Akıncıları saldırır, tur biter: tekerlek düşer, yorgun savunma + kilit (anahtarlı goblin tamir eder)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'scrap_raiders') }, p1: { monsters: five(N, N, { id: 'storm_hawk', position: 'attack' }) } },
    steps: [attack(2, 2), end(0)],
  },
  raLockP2: {
    desc: 'Hurda Akıncıları (oyuncu 2) doğrudan saldırır, tur biter: yorgun savunma + kilit',
    stage: { zones: 5, phase: 'battle', active: 1, p1: { monsters: five(N, N, 'scrap_raiders') } },
    steps: [attack(2, null, 1), end(1)],
  },
  raLockEnd: {
    desc: 'Kilit biter: sonraki turunun sonunda tekerlek geri takılır (ÇAT!), kilit kalkar',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'scrap_raiders') } },
    steps: [attack(2, null), end(0), end(1), end(0)],
  },
  raPositionUp: {
    desc: 'Savunmadaki Hurda Akıncıları saldırı pozisyonuna geçer (tekerlek takılır)',
    stage: { zones: 5, p0: { monsters: five(N, N, { id: 'scrap_raiders', position: 'defense' }) } },
    steps: [{ type: 'changePosition', player: 0, zone: 2 }],
  },
  raPosition: {
    desc: 'Hurda Akıncıları elle savunma pozisyonuna geçer',
    stage: { zones: 5, p0: { monsters: five(N, N, 'scrap_raiders') } },
    steps: [{ type: 'changePosition', player: 0, zone: 2 }],
  },
  raRevive: {
    desc: 'Ruh Çağrısı Hurda Akıncıları’nı mezarlıktan geri getirir',
    stage: { zones: 5, p0: { hand: ['soul_recall'], graveyard: ['scrap_raiders'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('soul_recall', 0), target: { kind: 'graveyard', uid: D.uid('scrap_raiders', 0), toZone: 2 } })],
  },
  raFlip: {
    desc: 'Kapalı Hurda Akıncıları açılarak çağrılır',
    stage: { zones: 5, p0: { monsters: five(N, N, { id: 'scrap_raiders', faceUp: false, position: 'defense' }) } },
    steps: [{ type: 'flipSummon', player: 0, zone: 2 }],
  },
};

export default scenarios;
