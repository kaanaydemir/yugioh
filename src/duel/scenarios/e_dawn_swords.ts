// Lane E — Şafak Kılıçları (dawn_swords) new signature, the gilded dawn cage (src/cinematics/spells/_dawn_e.ts).
//   node tools/shot.mjs "?dev=duel&s=eDawn&look=v3" --fresh --film 30 --every 100 --cols 6 --out shots/e/dawn_swords/cast.png
// Casts (hand / set, P1 and P2, an empty row, a full row, the 3-zone board), the counter ticks (3 → 2, 2 → 1), the
// expiry (1 → 0: the lock springs, the cage is hauled up) and the early destruction (Arınma Dalgası: the cage breaks).
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { MonSpec, STSpec } from '../scenario';

const N = null;
const five = <T,>(...xs: (T | null)[]): (T | null)[] => [...xs, ...Array.from({ length: Math.max(0, 5 - xs.length) }, () => null)];
const mons = (...xs: (MonSpec | null)[]) => five<MonSpec>(...xs);
const sts = (...xs: (STSpec | null)[]) => five<STSpec>(...xs);

const cast = (p: PlayerId, zone?: number): Step => (D) =>
  ({ type: 'activateSpell', player: p, uid: D.uid('dawn_swords', p), ...(zone !== undefined ? { zone } : {}) }) as Action;
const endTurn = (p: PlayerId): Step => ({ type: 'endTurn', player: p });
const purge = (p: PlayerId, index: number): Step => (D) =>
  ({ type: 'activateSpell', player: p, uid: D.uid('purging_wave', p), target: { kind: 'card', ref: { player: (1 - p) as PlayerId, zone: 'spellTrap', index } } }) as Action;
const down = (id: 'thorn_lurker' | 'tide_golem' | 'shade_assassin'): MonSpec => ({ id, faceUp: false, position: 'defense' });
const lock = (n: number): STSpec => ({ id: 'dawn_swords', faceUp: true, counter: n });

const PACK: Record<string, Scenario> = {
  eDawn: {
    desc: 'Şafak Kılıçları (P1, elden): kafes rakibin sırasına iner, iki kapalı canavar açılır, kapı çarpar, kilit 3 dil',
    stage: { zones: 5, p0: { hand: ['dawn_swords'], monsters: mons(N, 'stone_sentinel') }, p1: { monsters: mons(down('thorn_lurker'), 'ember_wolf', N, down('tide_golem'), 'crystal_wyrm') } },
    steps: [cast(0, 2)],
  },
  eDawnP2: {
    desc: 'Şafak Kılıçları (P2, elden): kafes Oyuncu 1’in sırasına iner',
    stage: { zones: 5, active: 1, p1: { hand: ['dawn_swords'], monsters: mons(N, 'stone_sentinel') }, p0: { monsters: mons(down('thorn_lurker'), 'ember_wolf', N, down('tide_golem'), 'crystal_wyrm') } },
    steps: [cast(1, 2)],
  },
  eDawnSet: {
    desc: 'kapalı Şafak Kılıçları kendi karosunda açılır (P1)',
    stage: { zones: 5, p0: { spellTraps: sts(N, N, N, 'dawn_swords'), monsters: mons('stone_sentinel') }, p1: { monsters: mons(N, down('shade_assassin'), 'ember_wolf') } },
    steps: [cast(0)],
  },
  eDawnSetP2: {
    desc: 'kapalı Şafak Kılıçları (P2)',
    stage: { zones: 5, active: 1, p1: { spellTraps: sts(N, 'dawn_swords'), monsters: mons('stone_sentinel') }, p0: { monsters: mons('ember_wolf', N, down('shade_assassin')) } },
    steps: [cast(1)],
  },
  eDawnEmpty: {
    desc: 'boş sıraya kafes (kapalı canavar yok, soğuyan canavar yok)',
    stage: { zones: 5, p0: { hand: ['dawn_swords'] } },
    steps: [cast(0, 1)],
  },
  eDawnFull: {
    desc: 'beş canavarlı dolu sıra: hepsi kafeste',
    stage: { zones: 5, p0: { hand: ['dawn_swords'] }, p1: { monsters: mons('ember_wolf', 'stone_sentinel', 'crystal_wyrm', 'tide_golem', 'thorn_lurker') } },
    steps: [cast(0, 0)],
  },
  eDawnZ3: {
    desc: '3 + 3 tahta: kafes üç şeridi kaplar',
    stage: { zones: 3, p0: { hand: ['dawn_swords'], monsters: [N, 'stone_sentinel'] }, p1: { monsters: [down('thorn_lurker'), 'ember_wolf', down('tide_golem')] } },
    steps: [cast(0, 1)],
  },
  eDawnTick: {
    desc: 'rakip turu bitirir: sayaç 3 → 2, bir dil döner + çan',
    stage: { zones: 5, active: 1, p0: { spellTraps: sts(N, lock(3)), monsters: mons('stone_sentinel') }, p1: { monsters: mons(N, 'ember_wolf', N, 'crystal_wyrm'), deck: ['stone_sentinel', 'stone_sentinel'] } },
    steps: [endTurn(1)],
  },
  eDawnTickP2: {
    desc: 'Oyuncu 1 turu bitirir: Oyuncu 2’nin kafesi 3 → 2',
    stage: { zones: 5, active: 0, p1: { spellTraps: sts(lock(3)), monsters: mons('stone_sentinel') }, p0: { monsters: mons('ember_wolf', N, 'crystal_wyrm') } },
    steps: [endTurn(0)],
  },
  eDawnTick2: {
    desc: 'sayaç 2 → 1',
    stage: { zones: 5, active: 1, p0: { spellTraps: sts(N, lock(2)) }, p1: { monsters: mons(N, 'ember_wolf'), deck: ['stone_sentinel', 'stone_sentinel'] } },
    steps: [endTurn(1)],
  },
  eDawnExpire: {
    desc: 'son dil döner: kilit yaylanıp düşer, kafes yukarı çekilir, kart mezarlığa',
    stage: { zones: 5, active: 1, p0: { spellTraps: sts(N, lock(1)), monsters: mons('stone_sentinel') }, p1: { monsters: mons(N, 'ember_wolf', N, 'crystal_wyrm'), deck: ['stone_sentinel', 'stone_sentinel'] } },
    steps: [endTurn(1)],
  },
  eDawnExpireP2: {
    desc: 'Oyuncu 2’nin kafesi Oyuncu 1’in turu sonunda kalkar',
    stage: { zones: 5, active: 0, p1: { spellTraps: sts(lock(1)), monsters: mons('stone_sentinel') }, p0: { monsters: mons('ember_wolf', N, 'crystal_wyrm') } },
    steps: [endTurn(0)],
  },
  eDawnPurge: {
    desc: 'Arınma Dalgası kafesi erken yok eder: kafes kırılır',
    stage: { zones: 5, p0: { hand: ['purging_wave'], monsters: mons('stone_sentinel') }, p1: { spellTraps: sts(N, lock(2)), monsters: mons('ember_wolf', N, 'crystal_wyrm') } },
    steps: [purge(0, 1)],
  },
  eDawnPurgeP2: {
    desc: 'Oyuncu 2 Arınma Dalgası ile Oyuncu 1’in kafesini kırar',
    stage: { zones: 5, active: 1, p1: { hand: ['purging_wave'] }, p0: { spellTraps: sts(N, N, lock(3)), monsters: mons(N, 'stone_sentinel') }, },
    steps: [purge(1, 2)],
  },
};

export default PACK;
