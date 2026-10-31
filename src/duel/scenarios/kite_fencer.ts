// QA scenarios for Uçurtma Eskrimci (kite_fencer, C9) — the card's own v3 presentation
// (src/cinematics/kartc/kite_fencer.ts). Film them in the v3 look on the 5-zone board:
//   node tools/shot.mjs "?dev=duel&s=kfnDouble&look=v3&zones=5" --fresh --film 24 --every 100 --cols 6 --clip 120,40,400,240 --scale 2
// Mind the ATKs: the kite is ATK 900 / DEF 600 (lumen_sprite 400, stone_sentinel 500, thorn_lurker 600 lose to it;
// ember_wolf 1700, volt_lizard 1500 kill it).
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';

const N = null;
const attack = (attackerZone: number, targetZone: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone, targetZone });
const summon = (id: CardId, zone: number, player: PlayerId = 0): Step => (D) => ({ type: 'normalSummon', player, uid: D.uid(id, player), zone, tributes: [] });

const S: Record<string, Scenario> = {
  kfnSummon: {
    desc: 'Uçurtma Eskrimci: normal çağırma — boş uçurtma yaprak gibi süzülür, yere yatar, eskrimci altından kalkar, selam',
    stage: { zones: 5, p0: { hand: ['kite_fencer'] }, p1: { monsters: [N, N, 'lumen_sprite', N, N] } },
    steps: [summon('kite_fencer', 2)],
  },
  kfnSummonP2: {
    desc: 'Uçurtma Eskrimci: Oyuncu 2 çağırır (aynalı, sağdan ışık)',
    stage: { zones: 5, active: 1, p0: { monsters: [N, N, 'lumen_sprite', N, N] }, p1: { hand: ['kite_fencer'] } },
    steps: [summon('kite_fencer', 2, 1)],
  },
  kfnAttack: {
    desc: '1. saldırı "Pike": düz fleş, iğne çizgisi, 60 ms, geri sekmeler, pelerin paneli yanar (lumen_sprite yok olur)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'kite_fencer', N, N] }, p1: { monsters: [N, N, { id: 'lumen_sprite', position: 'attack' }, N, N] } },
    steps: [attack(2, 2)],
  },
  kfnAttackP2: {
    desc: '1. saldırı, Oyuncu 2',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: [N, N, { id: 'lumen_sprite', position: 'attack' }, N, N] }, p1: { monsters: [N, N, 'kite_fencer', N, N] } },
    steps: [attack(2, 2, 1)],
  },
  kfnDirect: {
    desc: 'Doğrudan saldırı: düelloya fleş (yalnız 1. saldırı), panel yanar',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'kite_fencer', N, N] } },
    steps: [attack(2, null)],
  },
  kfnHit: {
    desc: 'Darbe alır ama dayanır (lumen_sprite 400 vs 900): saldıran kırılır',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'lumen_sprite', N, N] }, p1: { monsters: [N, N, { id: 'kite_fencer', position: 'attack' }, N, N] } },
    steps: [attack(2, 2)],
  },
  kfnKill: {
    desc: 'Savaşta yok olur (ember_wolf 1700 vs 900): ip gerilir ve kopar, pelerin ekrandan uçar, keten parçası, kılıç takırdar',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: [N, N, { id: 'kite_fencer', position: 'attack' }, N, N] }, p1: { monsters: [N, N, 'ember_wolf', N, N] } },
    steps: [attack(2, 2, 1)],
  },
  kfnKillP2: {
    desc: 'Savaşta yok olur, Oyuncu 2 (pelerin sol üste uçar)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'ember_wolf', N, N] }, p1: { monsters: [N, N, { id: 'kite_fencer', position: 'attack' }, N, N] } },
    steps: [attack(2, 2)],
  },
  kfnGuard: {
    desc: 'Savunma tutar (thorn_lurker 600 vs DEF 600): kapalı baklava kalkan',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'thorn_lurker', N, N] }, p1: { monsters: [N, N, { id: 'kite_fencer', position: 'defense' }, N, N] } },
    steps: [attack(2, 2)],
  },
  kfnGuardDies: {
    desc: 'Savunmada yok olur (volt_lizard 1500 vs DEF 600)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'volt_lizard', N, N] }, p1: { monsters: [N, N, { id: 'kite_fencer', position: 'defense' }, N, N] } },
    steps: [attack(2, 2)],
  },
  kfnBlocked: {
    desc: 'Engellenir (stone_sentinel DEF 2100): kılıç yay gibi bükülür, geri kayar',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'kite_fencer', N, N] }, p1: { monsters: [N, N, { id: 'stone_sentinel', position: 'defense' }, N, N] } },
    steps: [attack(2, 2)],
  },
  kfnLoser: {
    desc: 'Güçlü hedefe saldırır ve kaybeder (volt_lizard 1500): temas karesinde ölür',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'kite_fencer', N, N] }, p1: { monsters: [N, N, { id: 'volt_lizard', position: 'attack' }, N, N] } },
    steps: [attack(2, 2)],
  },
  kfnDouble: {
    desc: 'Çift saldırı: 1. "Pike" (lumen_sprite), panel yanar; 2. "Uçurtma Süzülüşü" sarkaç kesişi (stone_sentinel), panel söner',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, 'kite_fencer', N, N] }, p1: { monsters: [N, { id: 'lumen_sprite', position: 'attack' }, { id: 'stone_sentinel', position: 'attack' }, N, N] } },
    steps: [attack(2, 1), attack(2, 2)],
  },
  kfnDoubleP2: {
    desc: 'Çift saldırı, Oyuncu 2',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: [N, { id: 'lumen_sprite', position: 'attack' }, { id: 'stone_sentinel', position: 'attack' }, N, N] }, p1: { monsters: [N, N, 'kite_fencer', N, N] } },
    steps: [attack(2, 1, 1), attack(2, 2, 1)],
  },
  kfnSecond: {
    desc: 'Yalnız 2. saldırı (1. saldırı yapılmış: attacks 1): uçurtma yükselir, sarkaç, yandan kesiş',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, { id: 'kite_fencer', attacks: 1 }, N, N] }, p1: { monsters: [N, N, { id: 'stone_sentinel', position: 'attack' }, N, N] } },
    steps: [attack(2, 2)],
  },
  kfnSecondHit: {
    desc: '2. saldırı dayanan hedefe (thorn_lurker savunmada, DEF 800): kesiş tutulur',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [N, N, { id: 'kite_fencer', attacks: 1 }, N, N] }, p1: { monsters: [N, N, { id: 'thorn_lurker', position: 'defense' }, N, N] } },
    steps: [attack(2, 2)],
  },
};

export default S;
