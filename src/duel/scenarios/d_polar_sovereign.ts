// QA scenarios for Kutup Hükümdarı (polar_sovereign, lane D, C15) — its v3 life cycle on the 5 + 5 board:
//   node tools/shot.mjs "?dev=duel&s=psAttack&look=v3" --fresh --film 16 --every 150 --cols 4
// The fusion and the split themselves: b2FusionAuto / b2Fusion / b2SplitAuto (src/duel/scenarios/b2.ts).
import type { Scenario, Step } from '../scenarios';
import type { Action, GameState, PlayerId } from '../../engine/types';
import type { MonSpec } from '../scenario';

const N = null;
const five = (...xs: (MonSpec | null)[]): (MonSpec | null)[] => [...xs, ...Array.from({ length: Math.max(0, 5 - xs.length) }, () => null)];
const attack = (attackerZone: number, targetZone: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone, targetZone });
const fuse = (player: PlayerId, zone: number): Step => (D) => {
  const s = (D as unknown as { state(): GameState }).state();
  const uid = (id: string) => s.players[player].monsters.find((m) => m && s.cards[m.uid]?.cardId === id)!.uid;
  return { type: 'specialSummon', player, uid: D.uid('polar_sovereign', player), zone, tributes: [uid('polar_needle'), uid('polar_anvil'), uid('polar_coil')].sort((a, b) => a - b) };
};

const scenarios: Record<string, Scenario> = {
  psFusionP2: {
    desc: 'Kutup Hükümdarı: oyuncu 2 birleşmesi (üç parça kurban, özel çağırma)',
    stage: { zones: 5, active: 1, p1: { hand: ['polar_sovereign'], monsters: five('polar_needle', N, 'polar_anvil', N, 'polar_coil') } },
    steps: [fuse(1, 2)],
  },
  psAttack: {
    desc: 'Kutup Hükümdarı "Pusula Fırtınası" saldırı pozisyonundaki Magma Titanı’nı yok eder',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'polar_sovereign') }, p1: { monsters: five(N, N, { id: 'magma_titan', position: 'attack' }) } },
    steps: [attack(2, 2)],
  },
  psAttackP2: {
    desc: 'Kutup Hükümdarı (oyuncu 2) saldırır',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: five(N, N, { id: 'magma_titan', position: 'attack' }) }, p1: { monsters: five(N, N, 'polar_sovereign') } },
    steps: [attack(2, 2, 1)],
  },
  psDirect: {
    desc: 'Kutup Hükümdarı doğrudan saldırı',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'polar_sovereign') } },
    steps: [attack(2, null)],
  },
  psGuard: {
    desc: 'Savunmadaki Kalkan Devi (DEF 2600) Pusula Fırtınası’nı karşılayamaz',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'polar_sovereign') }, p1: { monsters: five(N, N, { id: 'stone_sentinel', position: 'defense' }) } },
    steps: [attack(2, 2)],
  },
  psKill: {
    desc: 'Kutup Hükümdarı Yıldırım Hükmü ile yok edilir; mezarlıkta parça yok: ayrılma tutmaz, üç parça kendi sonlarıyla söner',
    stage: { zones: 5, p0: { hand: ['judgment_bolt'] }, p1: { monsters: five(N, N, { id: 'polar_sovereign', position: 'attack' }) } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('judgment_bolt', 0), target: { kind: 'monster', ref: { player: 1, zone: 'monster', index: 2 } } })],
  },
  psSplitBolt: {
    desc: 'Kutup Hükümdarı Yıldırım Hükmü ile yok edilir; mezarlıkta üç parça: ayrılır, parçalar savunmada iner',
    stage: { zones: 5, p0: { hand: ['judgment_bolt'] }, p1: { monsters: five(N, N, { id: 'polar_sovereign', position: 'attack' }), graveyard: ['polar_needle', 'polar_anvil', 'polar_coil'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('judgment_bolt', 0), target: { kind: 'monster', ref: { player: 1, zone: 'monster', index: 2 } } })],
  },
  psTrade: {
    desc: 'Kutup Hükümdarı (3000) Kristal Ejder’e (2800) saldırır — ejder yok olur',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, N, 'polar_sovereign') }, p1: { monsters: five(N, N, { id: 'crystal_wyrm', position: 'attack' }) } },
    steps: [attack(2, 2)],
  },
  psPosition: {
    desc: 'Kutup Hükümdarı savunma pozisyonuna geçer',
    stage: { zones: 5, p0: { monsters: five(N, N, 'polar_sovereign') } },
    steps: [{ type: 'changePosition', player: 0, zone: 2 }],
  },
};

export default scenarios;
