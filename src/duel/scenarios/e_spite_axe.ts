// Lane E — Hınç Baltası (spite_axe) film / QA stages (docs/v3/YENI_KARTLAR.md §7 S10). Every stage is a 5 + 5 board.
//   node tools/shot.mjs "?dev=duel&s=eAxe&look=v3" --fresh --film 30 --every 100 --cols 6 --out shots/e/spite_axe/equip.png
// The equip (from the hand / a set card, P1 and P2), then the axe leaving the field: destroyed itself (Arındırma
// Dalgası), its monster destroyed (Yıldırım Hükmü, a lost battle), on a borrowed monster (Kukla İpi first: the axe
// still goes back to ITS owner's deck), and in a mass wipe (Süpürge Rüzgarı).
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';
import type { MonSpec, STSpec } from '../scenario';

const N = null;
const five = <T,>(...xs: (T | null)[]): (T | null)[] => [...xs, ...Array.from({ length: Math.max(0, 5 - xs.length) }, () => null)];
const mons = (...xs: (MonSpec | null)[]) => five<MonSpec>(...xs);
const sts = (...xs: (STSpec | null)[]) => five<STSpec>(...xs);

/** Hınç Baltası from `p`'s hand (or its set card) onto `p`'s own monster zone `index`. */
const axe = (p: PlayerId, index: number, zone?: number): Step => (D) =>
  ({ type: 'activateSpell', player: p, uid: D.uid('spite_axe', p), ...(zone !== undefined ? { zone } : {}), target: { kind: 'monster', ref: { player: p, zone: 'monster', index } } }) as Action;
/** A spell of `p` aimed at the opponent's spell/trap zone `index`. */
const atST = (p: PlayerId, id: CardId, index: number): Step => (D) =>
  ({ type: 'activateSpell', player: p, uid: D.uid(id, p), target: { kind: 'card', ref: { player: (1 - p) as PlayerId, zone: 'spellTrap', index } } }) as Action;
/** A spell of `p` aimed at the opponent's monster zone `index`. */
const atMon = (p: PlayerId, id: CardId, index: number): Step => (D) =>
  ({ type: 'activateSpell', player: p, uid: D.uid(id, p), target: { kind: 'monster', ref: { player: (1 - p) as PlayerId, zone: 'monster', index } } }) as Action;
const plain = (p: PlayerId, id: CardId): Step => (D) => ({ type: 'activateSpell', player: p, uid: D.uid(id, p) }) as Action;

const PACK: Record<string, Scenario> = {
  // ---- the equip
  eAxe: {
    desc: 'Hınç Baltası (P1, elden): balta Kor Kurdu’nun yanına saplanır, kurt söker, ATK +800',
    stage: { zones: 5, p0: { hand: ['spite_axe'], monsters: mons(N, 'ember_wolf', 'stone_sentinel') }, p1: { monsters: mons(N, 'magma_titan'), spellTraps: sts(N, 'mirror_barrier') } },
    steps: [axe(0, 1, 2)],
  },
  eAxeP2: {
    desc: 'Hınç Baltası (P2, elden): Kristal Ejder baltayı söker',
    stage: { zones: 5, active: 1, p1: { hand: ['spite_axe'], monsters: mons(N, N, 'crystal_wyrm') }, p0: { monsters: mons(N, 'ember_wolf') } },
    steps: [axe(1, 2, 1)],
  },
  eAxeSet: {
    desc: 'Hınç Baltası kapalıdan (P1): kart kendi karosunda açılır; Taş Nöbetçi baltayı söker',
    stage: { zones: 5, p0: { spellTraps: sts(N, N, N, 'spite_axe'), monsters: mons(N, N, 'stone_sentinel') }, p1: { monsters: mons('shade_assassin') } },
    steps: [axe(0, 2)],
  },
  eAxeSetP2: {
    desc: 'Hınç Baltası kapalıdan (P2): Uçurum Büyücüsü baltayı söker',
    stage: { zones: 5, active: 1, p1: { spellTraps: sts('spite_axe'), monsters: mons(N, 'abyss_magus') }, p0: { monsters: mons(N, N, 'tide_golem') } },
    steps: [axe(1, 1)],
  },
  // ---- the return: the axe itself destroyed
  eAxePurge: {
    desc: 'Hınç Baltası yok edilir (P2 Arındırma Dalgası): balta P1’in destesine döner, zincir P1’in LP’sini kırbaçlar (−500)',
    stage: {
      zones: 5,
      active: 1,
      p0: { monsters: mons(N, 'ember_wolf'), spellTraps: sts(N, N, { id: 'spite_axe', equippedTo: 1 }) },
      p1: { hand: ['purging_wave'], monsters: mons(N, 'magma_titan') },
    },
    steps: [atST(1, 'purging_wave', 2)],
  },
  eAxePurgeP2: {
    desc: 'Hınç Baltası yok edilir (P1 Arındırma Dalgası): balta P2’nin destesine döner (−500 P2)',
    stage: {
      zones: 5,
      p1: { monsters: mons(N, N, 'crystal_wyrm'), spellTraps: sts(N, { id: 'spite_axe', equippedTo: 2 }) },
      p0: { hand: ['purging_wave'], monsters: mons(N, 'ember_wolf') },
    },
    steps: [atST(0, 'purging_wave', 1)],
  },
  // ---- the return: its monster destroyed
  eAxeDie: {
    desc: 'Hınç Baltası’nın canavarı ölür (P2 Yıldırım Hükmü): balta kurdun elinden kayar, P1’in destesine döner',
    stage: {
      zones: 5,
      active: 1,
      p0: { monsters: mons(N, 'ember_wolf'), spellTraps: sts(N, { id: 'spite_axe', equippedTo: 1 }) },
      p1: { hand: ['judgment_bolt'], monsters: mons(N, 'magma_titan') },
    },
    steps: [atMon(1, 'judgment_bolt', 1)],
  },
  eAxeDieP2: {
    desc: 'Hınç Baltası’nın canavarı ölür (P1 Yıldırım Hükmü): balta P2’nin destesine döner',
    stage: {
      zones: 5,
      p1: { monsters: mons(N, N, 'abyss_magus'), spellTraps: sts(N, N, N, { id: 'spite_axe', equippedTo: 2 }) },
      p0: { hand: ['judgment_bolt'], monsters: mons(N, 'ember_wolf') },
    },
    steps: [atMon(0, 'judgment_bolt', 2)],
  },
  // ---- full loop: equip from the hand, then the opponent's purge (P1)
  eAxeLoop: {
    desc: 'Hınç Baltası tam döngü (P1): kuşan, sonra P2 Arındırma Dalgası ile yok eder',
    stage: { zones: 5, p0: { hand: ['spite_axe'], monsters: mons(N, 'ember_wolf') }, p1: { hand: ['purging_wave'], monsters: mons(N, 'magma_titan') } },
    steps: [axe(0, 1, 0), { type: 'endTurn', player: 0 }, atST(1, 'purging_wave', 0)],
  },
  // ---- a borrowed monster: Kukla İpi takes P2's Taş Nöbetçi, the axe goes on it, it dies attacking: the axe goes
  // back to P1's (its owner's) deck, the monster to P2's graveyard
  eAxeBorrow: {
    desc: 'Hınç Baltası ödünç canavarda: Kukla İpi + balta, Nöbetçi Magma Titanı’na saldırıp ölür; balta P1’in destesine döner',
    stage: {
      zones: 5,
      p0: { hand: ['puppet_string', 'spite_axe'], monsters: mons('ember_wolf') },
      p1: { monsters: mons(N, 'stone_sentinel', 'magma_titan') },
    },
    steps: [
      (D) => ({ type: 'activateSpell', player: 0, uid: D.uid('puppet_string', 0), target: { kind: 'monster', ref: { player: 1, zone: 'monster', index: 1 } } }) as Action,
      axe(0, 1, 1),
      { type: 'enterBattle', player: 0 } as Action,
      { type: 'attack', player: 0, attackerZone: 1, targetZone: 2 } as Action,
    ],
  },
  // ---- the equip only, on a borrowed monster
  eAxeBorrowEquip: {
    desc: 'Hınç Baltası ödünç canavara (P1): Kukla İpi ile alınan Uçurum Büyücüsü baltayı söker',
    stage: { zones: 5, p0: { hand: ['puppet_string', 'spite_axe'], monsters: mons('ember_wolf') }, p1: { monsters: mons(N, N, 'abyss_magus') } },
    steps: [
      (D) => ({ type: 'activateSpell', player: 0, uid: D.uid('puppet_string', 0), target: { kind: 'monster', ref: { player: 1, zone: 'monster', index: 2 } } }) as Action,
      axe(0, 1, 1),
    ],
  },
  // ---- a mass wipe: Süpürge Rüzgarı clears P1's row (the axe returns inside the gale's pass)
  eAxeGale: {
    desc: 'Hınç Baltası toplu yok etmede (P2 Süpürge Rüzgarı): balta P1’in destesine döner, −500',
    stage: {
      zones: 5,
      active: 1,
      p0: { monsters: mons(N, 'ember_wolf'), spellTraps: sts(N, { id: 'spite_axe', equippedTo: 1 }, 'mirror_barrier') },
      p1: { hand: ['sweeping_gale'], monsters: mons(N, 'magma_titan') },
    },
    steps: [plain(1, 'sweeping_gale')],
  },
};

export default PACK;
