// Lane E — Kukla İpi (puppet_string) film / QA stages (docs/v3/YENI_KARTLAR.md §7 S2). Every stage is a 5 + 5 board.
//   node tools/shot.mjs "?dev=duel&s=ePuppet&look=v3" --fresh --film 30 --every 100 --cols 6 --out shots/e/puppet_string/take.png
// The "…Return" stages end the turn after the take: the borrowed monster goes back in the End Phase (film with
// --start to skip to it). ePuppetNoZone fills the owner's last free zone with a straw token first, so the return
// finds no room and the monster is destroyed by rule.
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';

/** Kukla İpi on the opponent's monster zone `index` (from the hand, or a set card). */
const pull = (p: PlayerId, index: number): Step => (D) =>
  ({ type: 'activateSpell', player: p, uid: D.uid('puppet_string', p), target: { kind: 'monster', ref: { player: (1 - p) as PlayerId, zone: 'monster', index } } }) as Action;
const endTurn = (p: PlayerId): Step => ({ type: 'endTurn', player: p });
const summon = (p: PlayerId, id: CardId, zone: number): Step => (D) => ({ type: 'normalSummon', player: p, uid: D.uid(id, p), zone, tributes: [] }) as Action;
const respond = (p: PlayerId, id: CardId): Step => (D) => ({ type: 'respond', player: p, uid: D.uid(id, p) }) as Action;

const PACK: Record<string, Scenario> = {
  // ---- the take (from the hand)
  ePuppet: {
    desc: 'Kukla İpi (P1, elden): P2’nin Uçurum Büyücüsü iplerle P1’in alanına yürür',
    stage: { zones: 5, p0: { hand: ['puppet_string'], monsters: ['stone_sentinel', null, null, 'ember_wolf'] }, p1: { monsters: [null, 'tide_golem', 'abyss_magus', null, 'thorn_lurker'] } },
    steps: [pull(0, 2)],
  },
  ePuppetReturn: {
    desc: 'Kukla İpi (P1): alır, tur biter — Bitiş Aşamasında ipler kopar, Büyücü sendeleyerek döner',
    stage: { zones: 5, p0: { hand: ['puppet_string'], monsters: ['stone_sentinel', null, null, 'ember_wolf'] }, p1: { monsters: [null, 'tide_golem', 'abyss_magus', null, 'thorn_lurker'] } },
    steps: [pull(0, 2), endTurn(0)],
  },
  // ---- mirrored: player 2 pulls player 1's dragon
  ePuppetP2: {
    desc: 'Kukla İpi (P2, elden): P1’in Kristal Ejder’i P2’nin alanına geçer; tur sonunda döner',
    stage: { zones: 5, active: 1, p1: { hand: ['puppet_string'], monsters: [null, 'abyss_magus', null, null, null] }, p0: { monsters: [null, 'stone_sentinel', 'crystal_wyrm', null, null] } },
    steps: [pull(1, 2), endTurn(1)],
  },
  // ---- a set card flips up on its own tile
  ePuppetSet: {
    desc: 'Kukla İpi kapalıdan (P1): kart kendi karosunda açılır; Kor Kurdu alınır',
    stage: { zones: 5, p0: { spellTraps: [null, null, null, 'puppet_string'], monsters: [null, null, 'stone_sentinel'] }, p1: { monsters: ['ember_wolf', null, 'tide_golem'] } },
    steps: [pull(0, 0), endTurn(0)],
  },
  // ---- a face-down target comes face-down (the strings hook the card itself)
  ePuppetFaceDown: {
    desc: 'Kukla İpi kapalı canavara: kart kapalı gelir, ipler karoyu taşır; tur sonunda kapalı döner',
    stage: { zones: 5, p0: { hand: ['puppet_string'], monsters: [null, 'stone_sentinel'] }, p1: { monsters: [null, null, { id: 'thorn_lurker', faceUp: false }], spellTraps: [null, 'mirror_barrier'] } },
    steps: [pull(0, 2), endTurn(0)],
  },
  // ---- equips travel with it (the equip card stays in its owner's row; its link follows)
  ePuppetEquip: {
    desc: 'Kukla İpi ekipmanlı canavara: Ejder Kılıcı’yla birlikte gelir (ekipman sahibinin satırında kalır)',
    stage: { zones: 5, p0: { hand: ['puppet_string'], monsters: ['stone_sentinel'] }, p1: { monsters: [null, null, 'ember_wolf'], spellTraps: [null, null, { id: 'dragon_blade', equippedTo: 2 }] } },
    steps: [pull(0, 2), endTurn(0)],
  },
  // ---- the borrowed monster attacks (the lingering light string follows it), then goes back
  ePuppetAttack: {
    desc: 'Kukla İpi: alınan Büyücü doğrudan saldırır (ışık ipi onu izler), tur sonunda döner',
    stage: { zones: 5, p0: { hand: ['puppet_string'] }, p1: { monsters: [null, null, 'abyss_magus'] } },
    steps: [pull(0, 2), { type: 'enterBattle', player: 0 } as Action, { type: 'attack', player: 0, attackerZone: 0, targetZone: null } as Action, endTurn(0)],
  },
  // ---- no free zone at the owner: destroyed by rule
  ePuppetNoZone: {
    desc: 'Kukla İpi, dönüşte boş alan yok: P2 son boş alanını Saman Korkuluk ile doldurur, Büyücü kural gereği yok olur',
    stage: {
      zones: 5,
      p0: { hand: ['puppet_string', 'kite_fencer'], monsters: [null, null, 'stone_sentinel'] },
      p1: { monsters: ['tide_golem', 'thorn_lurker', 'abyss_magus', 'ember_wolf', 'stone_sentinel'], spellTraps: [null, null, 'straw_decoys'] },
    },
    steps: [pull(0, 2), summon(0, 'kite_fencer', 1), respond(1, 'straw_decoys'), endTurn(0)],
  },
};

export default PACK;
