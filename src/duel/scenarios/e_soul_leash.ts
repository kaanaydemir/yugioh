// Lane E — Ruh Tasması (soul_leash) film / QA stages (docs/v3/YENI_KARTLAR.md §7 S8). Every stage is a 5 + 5 board.
//   node tools/shot.mjs "?dev=duel&s=eLeash&look=v3" --fresh --film 30 --every 100 --cols 6 --out shots/e/soul_leash/take.png
// The take: the leash lands on its spell zone, a collar is woven round the victim's neck, its SHADOW peels off and
// walks ahead to the caster's side, the body follows it one beat behind, they merge, the collar locks; a thin
// bond stays from the collar to the leash card. "…Draw" stages end the turn: in the opponent's Draw Phase the
// bond pulses and green light flows to their LP panel (+1000). "…Break" stages destroy the leash on the
// opponent's turn (Burgu Mızrağı): the monster goes home. eLeashNoRoom: the owner has no free zone left when
// the leash breaks — the monster is destroyed by rule.
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';

/** Ruh Tasması from the hand into spell zone `st`, on the opponent's monster zone `index`. */
const leash = (p: PlayerId, index: number, st?: number): Step => (D) =>
  ({
    type: 'activateSpell',
    player: p,
    uid: D.uid('soul_leash', p),
    ...(st === undefined ? {} : { zone: st }),
    target: { kind: 'monster', ref: { player: (1 - p) as PlayerId, zone: 'monster', index } },
  }) as Action;
const endTurn = (p: PlayerId): Step => ({ type: 'endTurn', player: p });
/** Burgu Mızrağı (quick spell, from the hand) on the leash in spell zone `index` of player `tp`. */
const lance = (p: PlayerId, tp: PlayerId, index: number): Step => (D) =>
  ({ type: 'activateSpell', player: p, uid: D.uid('auger_lance', p), target: { kind: 'card', ref: { player: tp, zone: 'spellTrap', index } } }) as Action;

const PACK: Record<string, Scenario> = {
  // ---- the take (from the hand)
  eLeash: {
    desc: 'Ruh Tasması (P1, elden): P2’nin Uçurum Büyücüsü’nün gölgesi önden yürür, gövde onu izler',
    stage: { zones: 5, p0: { hand: ['soul_leash'], monsters: ['stone_sentinel', null, null, 'ember_wolf'] }, p1: { monsters: [null, 'tide_golem', 'abyss_magus', null, 'thorn_lurker'] } },
    steps: [leash(0, 2, 1)],
  },
  // ---- mirrored: player 2 leashes player 1's dragon
  eLeashP2: {
    desc: 'Ruh Tasması (P2, elden): P1’in Kristal Ejder’i P2’nin alanına geçer',
    stage: { zones: 5, active: 1, p1: { hand: ['soul_leash'], monsters: [null, 'abyss_magus', null, null, null] }, p0: { monsters: [null, 'stone_sentinel', 'crystal_wyrm', null, null] } },
    steps: [leash(1, 2, 3)],
  },
  // ---- a set card stands up on its own tile and lies back down (it stays: an equip)
  eLeashSet: {
    desc: 'Ruh Tasması kapalıdan (P1): kart kendi karosunda açılır; Kor Kurdu alınır',
    stage: { zones: 5, p0: { spellTraps: [null, null, null, { id: 'soul_leash', faceUp: false }], monsters: [null, null, 'stone_sentinel'] }, p1: { monsters: ['ember_wolf', null, 'tide_golem'] } },
    steps: [leash(0, 0)],
  },
  eLeashSetP2: {
    desc: 'Ruh Tasması kapalıdan (P2): P1’in Gölge Suikastçı’sı alınır',
    stage: { zones: 5, active: 1, p1: { spellTraps: [null, { id: 'soul_leash', faceUp: false }], monsters: [null, null, 'stone_sentinel'] }, p0: { monsters: [null, null, null, 'shade_assassin'] } },
    steps: [leash(1, 3)],
  },
  // ---- the opponent's Draw Phase: the bond pulses, +1000 LP flows to their panel
  eLeashDraw: {
    desc: 'Ruh Tasması (P1): alır, tur biter — P2’nin Çekme Aşamasında bağ nabız atar, P2 +1000 LP',
    stage: { zones: 5, p0: { hand: ['soul_leash'], monsters: ['stone_sentinel'] }, p1: { monsters: [null, null, 'abyss_magus'], lp: 3000 } },
    steps: [leash(0, 2, 2), endTurn(0)],
  },
  eLeashDrawP2: {
    desc: 'Ruh Tasması (P2): alır, tur biter — P1’in Çekme Aşamasında P1 +1000 LP',
    stage: { zones: 5, active: 1, p1: { hand: ['soul_leash'] }, p0: { monsters: [null, 'crag_axeman', null], lp: 2500 } },
    steps: [leash(1, 1, 2), endTurn(1)],
  },
  // ---- the leashed monster attacks (the bond follows it)
  eLeashAttack: {
    desc: 'Ruh Tasması: alınan Büyücü doğrudan saldırır (ışık bağı onu izler)',
    stage: { zones: 5, p0: { hand: ['soul_leash'] }, p1: { monsters: [null, null, 'abyss_magus'] } },
    steps: [leash(0, 2, 2), { type: 'enterBattle', player: 0 } as Action, { type: 'attack', player: 0, attackerZone: 0, targetZone: null } as Action],
  },
  // ---- the leash breaks (Burgu Mızrağı on the opponent's turn): the monster goes home
  eLeashBreak: {
    desc: 'Ruh Tasması (P1) alır; P2 sırasında Burgu Mızrağı tasmayı kırar → Büyücü sahibine döner',
    stage: { zones: 5, p0: { hand: ['soul_leash'], monsters: ['stone_sentinel'] }, p1: { hand: ['auger_lance'], monsters: [null, 'tide_golem', 'abyss_magus'] } },
    steps: [leash(0, 2, 1), endTurn(0), lance(1, 0, 1)],
  },
  eLeashBreakP2: {
    desc: 'Ruh Tasması (P2) alır; P1 sırasında Burgu Mızrağı tasmayı kırar → Kaya Baltacı döner',
    stage: { zones: 5, active: 1, p1: { hand: ['soul_leash'] }, p0: { hand: ['auger_lance'], monsters: [null, 'crag_axeman', null] } },
    steps: [leash(1, 1, 3), endTurn(1), lance(0, 1, 3)],
  },
  // ---- no free zone at the owner when the leash breaks: destroyed by rule
  eLeashNoRoom: {
    desc: 'Ruh Tasması kırılır ama sahibinde boş alan yok: canavar kural gereği yok olur',
    stage: {
      zones: 5,
      p0: { hand: ['soul_leash'], monsters: ['stone_sentinel'] },
      p1: { hand: ['auger_lance', 'kite_fencer'], monsters: ['tide_golem', 'thorn_lurker', 'abyss_magus', 'ember_wolf', 'stone_sentinel'] },
    },
    steps: [leash(0, 2, 1), endTurn(0), (D) => ({ type: 'normalSummon', player: 1, uid: D.uid('kite_fencer', 1), zone: 2, tributes: [] }) as Action, lance(1, 0, 1)],
  },
  // ---- the leashed monster dies in battle: the leash goes to the graveyard, the bond fades
  eLeashDies: {
    desc: 'Ruh Tasması: alınan Kor Kurdu Kristal Ejder’e saldırıp yok olur — tasma mezarlığa, bağ söner',
    stage: { zones: 5, p0: { hand: ['soul_leash'] }, p1: { monsters: [null, 'ember_wolf', null, 'crystal_wyrm'] } },
    steps: [leash(0, 1, 2), { type: 'enterBattle', player: 0 } as Action, { type: 'attack', player: 0, attackerZone: 0, targetZone: 3 } as Action],
  },
};

export default PACK;
