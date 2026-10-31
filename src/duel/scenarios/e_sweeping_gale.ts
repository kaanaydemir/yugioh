// Lane E — Süpürge Rüzgarı (sweeping_gale) film / QA stages (docs/v3/YENI_KARTLAR.md §7 S4). Every stage is a 5 + 5 board.
//   node tools/shot.mjs "?dev=duel&s=eGale&look=v3" --fresh --film 30 --every 100 --cols 6 --out shots/e/sweeping_gale/take.png
// The gale sweeps the OPPONENT's back row: set traps / spells (they flash their faces for a frame), face-up
// continuous / equip cards and the field spell (its environment snuffs out like a candle). P2 stages are the
// mirrored twins (active: 1). Edge cases: a single card, a volcano arena (a real board theme), a spite axe
// (its own toDeck presentation follows), a soul leash (its monster goes home), Büyü Mührü answering.
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';
import type { MonSpec, STSpec } from '../scenario';

const gale = (p: PlayerId): Step => (D) => ({ type: 'activateSpell', player: p, uid: D.uid('sweeping_gale', p) }) as Action;

/** The doomed back row: two set traps, a face-up continuous, a face-up equip and a set quick-play. */
const doomedST: (STSpec | null)[] = [
  { id: 'mirror_barrier', faceUp: false },
  'dawn_swords',
  { id: 'guardian_charm', equippedTo: 2 },
  { id: 'chasm_trap', faceUp: false },
  { id: 'auger_lance', faceUp: false },
];
const theirMonsters: (MonSpec | null)[] = [null, 'reed_heron', 'tide_golem', null, 'kite_fencer'];
const myMonsters: (MonSpec | null)[] = [null, 'crag_axeman', null, 'ember_wolf', null];

type Side = NonNullable<NonNullable<Scenario['stage']>['p0']>;
function board(p: PlayerId, me: Side, them: Side): Scenario['stage'] {
  return p === 0 ? { zones: 5, p0: me, p1: them } : { zones: 5, active: 1, p1: me, p0: them };
}

const fromHand = (p: PlayerId, field: CardId = 'tidal_bay') =>
  board(p, { hand: ['ember_wolf', 'sweeping_gale', 'tide_golem'], monsters: myMonsters }, { monsters: theirMonsters, spellTraps: doomedST, field });

/** From a set card: the opponent has no answer (the direct path) — or a ready Büyü Mührü that declines (the window). */
const fromSet = (p: PlayerId, seal = false) =>
  board(
    p,
    { spellTraps: [null, null, { id: 'sweeping_gale', faceUp: false }, null, null], monsters: myMonsters },
    {
      monsters: theirMonsters,
      spellTraps: [{ id: seal ? 'spell_seal' : 'chasm_trap', faceUp: false }, null, { id: 'mirror_barrier', faceUp: false }, 'dawn_swords', null],
      field: 'shadow_cavern',
    },
  );

const PACK: Record<string, Scenario> = {
  eGale: {
    desc: 'Süpürge Rüzgarı (P1, elden): rakipte 5 B/T (kapalı tuzaklar, devamlı, kuşanma) + Gelgit Körfezi alan büyüsü',
    stage: fromHand(0),
    steps: [gale(0)],
  },
  eGaleP2: {
    desc: 'Süpürge Rüzgarı (P2, elden): aynı saha, aynalı',
    stage: fromHand(1),
    steps: [gale(1)],
  },
  eGaleBoard: {
    desc: 'Süpürge Rüzgarı (P1): sahne kurulumu (adım yok, durağan çekim için)',
    stage: fromHand(0),
    steps: [],
  },
  eGaleSet: {
    desc: 'Süpürge Rüzgarı kapalıdan (P1): kart kendi karosunda açılır; rakipte 3 B/T + Gölge Mağarası',
    stage: fromSet(0),
    steps: [gale(0)],
  },
  eGaleSetP2: {
    desc: 'Süpürge Rüzgarı kapalıdan (P2): aynalı',
    stage: fromSet(1),
    steps: [gale(1)],
  },
  eGaleWindow: {
    desc: 'Süpürge Rüzgarı kapalıdan (P1): rakibin Büyü Mührü penceresi açılır, cevap vermez → rüzgar sonraki partide doğar',
    stage: fromSet(0, true),
    steps: [gale(0), () => ({ type: 'respond', player: 1, uid: null }) as Action],
  },
  eGaleVolcano: {
    desc: 'Süpürge Rüzgarı (P1): rakibin Volkan Arenası söner (gerçek arena teması) + iki kapalı kart',
    stage: board(0, { hand: ['sweeping_gale'], monsters: myMonsters }, { monsters: [null, 'magma_titan', null, 'ember_wolf'], spellTraps: [null, { id: 'mirror_barrier', faceUp: false }, null, { id: 'spell_seal', faceUp: false }], field: 'volcano_arena' }),
    steps: [gale(0), () => ({ type: 'respond', player: 1, uid: null }) as Action],
  },
  eGaleOne: {
    desc: 'Süpürge Rüzgarı (P1): rakipte tek kapalı kart (alan büyüsü yok)',
    stage: board(0, { hand: ['sweeping_gale'], monsters: myMonsters }, { monsters: theirMonsters, spellTraps: [null, null, null, { id: 'chasm_trap', faceUp: false }, null] }),
    steps: [gale(0)],
  },
  eGaleAxe: {
    desc: 'Süpürge Rüzgarı (P1): rakibin Hınç Baltası süpürülür → destesine döner + 500 hasar (kendi sunumu sonra)',
    stage: board(0, { hand: ['sweeping_gale'], monsters: myMonsters }, { monsters: theirMonsters, spellTraps: [{ id: 'spite_axe', equippedTo: 1 }, null, { id: 'mirror_barrier', faceUp: false }, null, null], field: 'festival_square' }),
    steps: [gale(0)],
  },
  eGaleLeash: {
    desc: 'Süpürge Rüzgarı (P1): önce P2 Ruh Tasması ile P1’in canavarını alır; P1 sonraki turda süpürür → canavar sahibine döner',
    stage: board(1, { hand: ['soul_leash'], spellTraps: [null, { id: 'chasm_trap', faceUp: false }] }, { hand: ['sweeping_gale', 'ember_wolf'], monsters: [null, 'kite_fencer', null, 'crag_axeman', null] }),
    steps: [
      (D) => ({ type: 'activateSpell', player: 1, uid: D.uid('soul_leash', 1), zone: 2, target: { kind: 'monster', ref: { player: 0, zone: 'monster', index: 3 } } }) as Action,
      () => ({ type: 'endTurn', player: 1 }) as Action,
      gale(0),
    ],
  },
  eGaleSealed: {
    desc: 'Süpürge Rüzgarı (P1): rakip Büyü Mührü ile cevap verir → rüzgar doğmadan söner',
    stage: board(0, { hand: ['sweeping_gale'], monsters: myMonsters }, { monsters: theirMonsters, spellTraps: [null, { id: 'spell_seal', faceUp: false }, { id: 'mirror_barrier', faceUp: false }] }),
    steps: [gale(0), (D) => ({ type: 'respond', player: 1, uid: D.uid('spell_seal', 1) }) as Action],
  },
};

export default PACK;
