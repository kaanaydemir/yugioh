// Lane E — Boşluk Gözü (void_eye) film / QA stages (docs/v3/YENI_KARTLAR.md §7 S3). Every stage is a 5 + 5 board.
//   node tools/shot.mjs "?dev=duel&s=eVoid&look=v3" --fresh --film 30 --every 100 --cols 6 --out shots/e/void_eye/take.png
// The crowded stages first fill the caster's last free zone with a straw token (Saman Korkuluklar from the hand,
// its own presentation plays first: film with --start to skip it). Then the eye opens over a full 5 + 5 board:
// face-up and face-down monsters on both sides, a token, and one monster that a Koruyucu Tılsım saves.
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';
import type { MonSpec, STSpec } from '../scenario';

const eye = (p: PlayerId): Step => (D) => ({ type: 'activateSpell', player: p, uid: D.uid('void_eye', p) }) as Action;
const decoys = (p: PlayerId): Step => (D) => ({ type: 'activateSpell', player: p, uid: D.uid('straw_decoys', p) }) as Action;

/** The caster's side of the crowded board (4 monsters, one face-down; the 5th zone gets the token). */
const casterRow: (MonSpec | null)[] = ['crag_axeman', { id: 'thorn_lurker', faceUp: false, position: 'defense' }, 'reed_heron', 'kite_fencer', null];
/** The other side: 5 monsters, one face-down, the tide golem wears a guardian charm (it survives). */
const otherRow: (MonSpec | null)[] = ['magma_titan', { id: 'steppe_spiralhorn', faceUp: false, position: 'defense' }, 'tide_golem', 'abyss_magus', 'mudgrasp_spirit'];
const otherST: (STSpec | null)[] = [null, { id: 'guardian_charm', equippedTo: 2 }, 'mirror_barrier', null, null];

function crowded(p: PlayerId): Scenario['stage'] {
  const me = { hand: ['straw_decoys', 'void_eye'] as CardId[], monsters: casterRow, graveyard: ['ember_wolf'] as CardId[] };
  const them = { monsters: otherRow, spellTraps: otherST };
  return p === 0 ? { zones: 5, p0: me, p1: them } : { zones: 5, active: 1, p1: me, p0: them };
}

const PACK: Record<string, Scenario> = {
  // ---- the full board (P1 casts): token + face-down on both sides + a guardian charm save
  eVoid: {
    desc: 'Boşluk Gözü (P1, elden): dolu 5+5 saha — jeton, kapalı canavarlar, Koruyucu Tılsım bir canavarı kurtarır',
    stage: crowded(0),
    steps: [decoys(0), eye(0)],
  },
  // ---- mirrored: player 2 casts
  eVoidP2: {
    desc: 'Boşluk Gözü (P2, elden): aynı dolu saha, aynalı',
    stage: crowded(1),
    steps: [decoys(1), eye(1)],
  },
  // ---- the eye alone over a full board (no token beat first: the film starts at the eye)
  eVoidQuick: {
    desc: 'Boşluk Gözü (P1, elden): dolu saha, jetonsuz (film doğrudan gözle başlar)',
    stage: { zones: 5, p0: { hand: ['void_eye'], monsters: casterRow }, p1: { monsters: otherRow, spellTraps: otherST } },
    steps: [eye(0)],
  },
  // ---- from a set card (it stands up on its own tile)
  eVoidSet: {
    desc: 'Boşluk Gözü kapalıdan (P1): kart kendi karosunda açılır; iki tarafta üçer canavar',
    stage: {
      zones: 5,
      p0: { spellTraps: [null, null, 'void_eye'], monsters: [null, 'stone_sentinel', { id: 'ember_wolf', faceUp: false, position: 'defense' }, 'lumen_sprite'] },
      p1: { monsters: ['storm_hawk', null, 'crystal_wyrm', null, 'shade_assassin'] },
    },
    steps: [eye(0)],
  },
  eVoidSetP2: {
    desc: 'Boşluk Gözü kapalıdan (P2): kart kendi karosunda açılır',
    stage: {
      zones: 5,
      active: 1,
      p1: { spellTraps: [null, 'void_eye'], monsters: ['coral_serpent', null, 'volt_lizard'] },
      p0: { monsters: [null, 'magma_titan', { id: 'thorn_lurker', faceUp: false, position: 'defense' }, 'crystal_wyrm'] },
    },
    steps: [eye(1)],
  },
  // ---- a single monster on the whole field (the eye still opens fully; one lonely rise)
  eVoidOne: {
    desc: 'Boşluk Gözü: sahada tek canavar (rakipte)',
    stage: { zones: 5, p0: { hand: ['void_eye'] }, p1: { monsters: [null, null, 'shade_assassin'] } },
    steps: [eye(0)],
  },
  // ---- only the save: every monster rises, the charmed one is pulled back down
  eVoidCharm: {
    desc: 'Boşluk Gözü: Koruyucu Tılsım — tek canavar kurtulur (P1’in kendi tılsımı)',
    stage: {
      zones: 5,
      p0: { hand: ['void_eye'], monsters: [null, 'tide_golem', null, 'ember_wolf'], spellTraps: [null, { id: 'guardian_charm', equippedTo: 1 }] },
      p1: { monsters: [null, 'crystal_wyrm', 'abyss_magus'] },
    },
    steps: [eye(0)],
  },
  // ---- polar sovereign: swallowed, then its three pieces come back (the split follows the eye)
  eVoidSovereign: {
    desc: 'Boşluk Gözü: Kutup Hükümdarı yutulur, sonra üç parçası savunmada döner',
    stage: { zones: 5, active: 1, p0: { monsters: [null, 'ember_wolf', 'polar_sovereign'], graveyard: ['polar_needle', 'polar_anvil', 'polar_coil'] }, p1: { hand: ['void_eye'], monsters: [null, 'storm_hawk'] } },
    steps: [eye(1)],
  },
  // ---- equips go with their monsters (a dragon blade on a monster that is swallowed)
  eVoidEquip: {
    desc: 'Boşluk Gözü: Ejder Kılıcı takılı canavar yutulur, kılıç kartı da mezarlığa',
    stage: {
      zones: 5,
      p0: { hand: ['void_eye'], monsters: ['stone_sentinel', null, 'ember_wolf'] },
      p1: { monsters: [null, 'crystal_wyrm', null, 'tide_golem'], spellTraps: [null, { id: 'dragon_blade', equippedTo: 1 }] },
    },
    steps: [eye(0)],
  },
};

export default PACK;
