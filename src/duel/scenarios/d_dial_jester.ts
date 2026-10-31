// QA scenarios for Kadran Soytarısı (dial_jester, lane D, C2) — its v3 life cycle on the 5 + 5 board:
//   node tools/shot.mjs "?dev=duel&s=djSummon&look=v3" --fresh --film 16 --every 100 --cols 4
// The coin (rng 12345): the next toss is YAZI ('tails') — call 'tails' to win, 'heads' to lose.
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';
import type { MonSpec } from '../scenario';

const N = null;
const five = (...xs: (MonSpec | null)[]): (MonSpec | null)[] => [...xs, ...Array.from({ length: Math.max(0, 5 - xs.length) }, () => null)];
const attack = (attackerZone: number, targetZone: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone, targetZone });
const summon = (id: CardId, zone: number, player: PlayerId = 0): Step => (D) => ({ type: 'normalSummon', player, uid: D.uid(id, player), zone, tributes: [] });
const coin = (player: PlayerId, zone: number, call: 'heads' | 'tails'): Step[] => [{ type: 'activateMonster', player, zone }, { type: 'callCoin', player, call }];

const scenarios: Record<string, Scenario> = {
  djSummon: {
    desc: 'Kadran Soytarısı: normal çağırma (kadran yansır, gece yarısı çanı, guguk kuşu gibi fırlar)',
    stage: { zones: 5, p0: { hand: ['dial_jester'] }, p1: { monsters: five(N, N, 'ember_wolf') } },
    steps: [summon('dial_jester', 2)],
  },
  djSummonP2: {
    desc: 'Kadran Soytarısı: oyuncu 2 çağırır',
    stage: { zones: 5, active: 1, p0: { monsters: five(N, N, 'ember_wolf') }, p1: { hand: ['dial_jester'] } },
    steps: [summon('dial_jester', 2, 1)],
  },
  djAttack: {
    desc: 'Kadran Soytarısı "Kurmalı Takla" saldırı pozisyonundaki Işık Perisi’ni yok eder',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'dial_jester') }, p1: { monsters: five(N, N, { id: 'lumen_sprite', position: 'attack' }) } },
    steps: [attack(2, 2)],
  },
  djAttackP2: {
    desc: 'Kadran Soytarısı (oyuncu 2) saldırır',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: five(N, N, { id: 'lumen_sprite', position: 'attack' }) }, p1: { monsters: five(N, N, 'dial_jester') } },
    steps: [attack(2, 2, 1)],
  },
  djDirect: {
    desc: 'Kadran Soytarısı doğrudan saldırır',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'dial_jester') }, p1: {} },
    steps: [attack(2, null)],
  },
  djBlocked: {
    desc: 'Kadran Soytarısı savunmadaki Taş Nöbetçi’ye çarpar (DEF 2100): para kenarı seker',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'dial_jester') }, p1: { monsters: five(N, N, { id: 'stone_sentinel', position: 'defense' }) } },
    steps: [attack(2, 2)],
  },
  djKill: {
    desc: 'Kadran Soytarısı savaşta yok edilir (yaylar fırlar, dişliler yuvarlanır, son tik)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'storm_hawk') }, p1: { monsters: five(N, N, { id: 'dial_jester', position: 'attack' }) } },
    steps: [attack(2, 2)],
  },
  djKillP2: {
    desc: 'Kadran Soytarısı (oyuncu 1) savaşta yok edilir',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: five(N, N, { id: 'dial_jester', position: 'attack' }) }, p1: { monsters: five(N, N, 'storm_hawk') } },
    steps: [attack(2, 2, 1)],
  },
  djGuard: {
    desc: 'Kadran Soytarısı savunmada (DEF 300) Tüy Hayalet’i karşılar (300 = 300, kimse ölmez)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'wisp_imp') }, p1: { monsters: five(N, N, { id: 'dial_jester', position: 'defense' }) } },
    steps: [attack(2, 2)],
  },
  djRevive: {
    desc: 'Ruh Çağrısı Kadran Soytarısı’nı mezarlıktan geri getirir',
    stage: { zones: 5, p0: { hand: ['soul_recall'], graveyard: ['dial_jester'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('soul_recall', 0), target: { kind: 'graveyard', uid: D.uid('dial_jester', 0), toZone: 2 } })],
  },
  djPosition: {
    desc: 'Kadran Soytarısı savunma pozisyonuna geçer',
    stage: { zones: 5, p0: { monsters: five(N, N, 'dial_jester') } },
    steps: [{ type: 'changePosition', player: 0, zone: 2 }],
  },
  djFlip: {
    desc: 'Kapalı Kadran Soytarısı açılarak çağrılır',
    stage: { zones: 5, p0: { monsters: five(N, N, { id: 'dial_jester', faceUp: false, position: 'defense' }) } },
    steps: [{ type: 'flipSummon', player: 0, zone: 2 }],
  },
  djCoinWin: {
    desc: 'Yazı-tura: bildi — rakibin üç canavarı (biri kapalı) zamanda geri sarılır',
    stage: { zones: 5, p0: { monsters: five(N, 'dial_jester', 'crag_axeman') }, p1: { monsters: five('magma_titan', N, 'reed_heron', { id: 'stone_sentinel', faceUp: false, position: 'defense' }) } },
    steps: coin(0, 1, 'tails'),
  },
  djCoinLose: {
    desc: 'Yazı-tura: bilemedi — kendi canavarları geri sarılır, kartlar LP paneline çarpar',
    stage: { zones: 5, p0: { monsters: five(N, 'dial_jester', 'crag_axeman', 'storm_hawk') }, p1: { monsters: five('magma_titan', N, 'reed_heron') } },
    steps: coin(0, 1, 'heads'),
  },
  djCoinWinP2: {
    desc: 'Yazı-tura (oyuncu 2): bildi',
    stage: { zones: 5, active: 1, p0: { monsters: five('magma_titan', N, 'reed_heron') }, p1: { monsters: five(N, 'dial_jester', 'cloud_hatchling') } },
    steps: coin(1, 1, 'tails'),
  },
  djCoinLoseP2: {
    desc: 'Yazı-tura (oyuncu 2): bilemedi',
    stage: { zones: 5, active: 1, p0: { monsters: five('magma_titan', N, 'reed_heron') }, p1: { monsters: five(N, 'dial_jester', 'crag_axeman') } },
    steps: coin(1, 1, 'heads'),
  },
};

export default scenarios;
