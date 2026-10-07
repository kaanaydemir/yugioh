// Scenario staging for QA / cinematic authors: build a GameState directly (any board), then
// restart the duel from it and dispatch actions. Mirrors tests/engine/helpers.ts scenario().
//
//   await __neon.duel.restart({ stage: {
//     p0: { hand: ['crystal_wyrm'], monsters: ['ember_wolf', { id: 'tide_golem', position: 'defense' }] },
//     p1: { monsters: [null, { id: 'thorn_lurker', faceUp: false }], spellTraps: ['mirror_barrier'] },
//     phase: 'main', active: 0,
//   }, skipIntro: true });
//
// Defaults: turn 3, player 0 active, main phase, monsters arrived last turn (may attack /
// change position), spells/traps set last turn (traps ready), each deck holds 5 cards.

import { CARDS, type CardId } from '../data/cards';
import {
  MONSTER_ZONES,
  SPELL_TRAP_ZONES,
  START_LP,
  type GameState,
  type MonsterSlot,
  type Phase,
  type PlayerId,
  type PlayerState,
  type Position,
  type SpellTrapSlot,
  type Uid,
} from '../engine/types';

export type MonSpec = CardId | { id: CardId; position?: Position; faceUp?: boolean; enteredTurn?: number; attacks?: number; posChanged?: number };
/** equippedTo = the index of the monster zone (same side) it is attached to. */
export type STSpec = CardId | { id: CardId; faceUp?: boolean; setTurn?: number; equippedTo?: number };

export interface SideSpec {
  hand?: CardId[];
  /** deck[0] is drawn first. Default: 5 stone_sentinels. */
  deck?: CardId[];
  graveyard?: CardId[];
  monsters?: (MonSpec | null)[];
  spellTraps?: (STSpec | null)[];
  field?: CardId | null;
  lp?: number;
  normalSummonUsed?: boolean;
}

export interface StageSpec {
  p0?: SideSpec;
  p1?: SideSpec;
  turn?: number;
  active?: PlayerId;
  phase?: Phase;
  first?: PlayerId;
  /** RNG state (default 12345). */
  rng?: number;
}

function blank(id: PlayerId): PlayerState {
  return {
    id,
    lp: START_LP,
    deck: [],
    hand: [],
    graveyard: [],
    monsters: Array.from({ length: MONSTER_ZONES }, () => null),
    spellTraps: Array.from({ length: SPELL_TRAP_ZONES }, () => null),
    fieldSpell: null,
    normalSummonUsed: false,
  };
}

export function buildStage(o: StageSpec = {}): GameState {
  const turn = o.turn ?? 3;
  const s: GameState = {
    cards: {},
    players: [blank(0), blank(1)],
    turn,
    activePlayer: o.active ?? 0,
    firstPlayer: o.first ?? 0,
    phase: o.phase ?? 'main',
    pending: null,
    winner: null,
    winReason: null,
    rng: o.rng ?? 12345,
    internal: { queue: [] },
  };
  let next = 1;
  const mk = (id: CardId, owner: PlayerId): Uid => {
    if (!CARDS[id]) throw new Error(`unknown card ${id}`);
    const uid = next++;
    s.cards[uid] = { uid, cardId: id, owner };
    return uid;
  };
  for (const p of [0, 1] as PlayerId[]) {
    const side = (p === 0 ? o.p0 : o.p1) ?? {};
    const ps = s.players[p];
    ps.lp = side.lp ?? START_LP;
    ps.normalSummonUsed = side.normalSummonUsed ?? false;
    ps.deck = (side.deck ?? Array.from({ length: 5 }, () => 'stone_sentinel' as CardId)).map((id) => mk(id, p));
    ps.hand = (side.hand ?? []).map((id) => mk(id, p));
    ps.graveyard = (side.graveyard ?? []).map((id) => mk(id, p));
    (side.monsters ?? []).forEach((spec, i) => {
      if (!spec || i >= MONSTER_ZONES) return;
      const m = typeof spec === 'string' ? { id: spec } : spec;
      const faceUp = m.faceUp ?? true;
      const slot: MonsterSlot = {
        uid: mk(m.id, p),
        position: m.position ?? (faceUp ? 'attack' : 'defense'),
        faceUp,
        enteredTurn: m.enteredTurn ?? turn - 1,
        attacksThisTurn: m.attacks ?? 0,
        positionChangedTurn: m.posChanged ?? -1,
      };
      ps.monsters[i] = slot;
    });
    (side.spellTraps ?? []).forEach((spec, i) => {
      if (!spec || i >= SPELL_TRAP_ZONES) return;
      const st = typeof spec === 'string' ? { id: spec } : spec;
      const equipTarget = st.equippedTo !== undefined ? (ps.monsters[st.equippedTo]?.uid ?? null) : null;
      const slot: SpellTrapSlot = {
        uid: mk(st.id, p),
        faceUp: st.faceUp ?? equipTarget !== null,
        setTurn: st.setTurn ?? (equipTarget !== null ? -1 : turn - 1),
        equippedTo: equipTarget,
      };
      ps.spellTraps[i] = slot;
    });
    if (side.field) ps.fieldSpell = { uid: mk(side.field, p), faceUp: true, setTurn: -1, equippedTo: null };
  }
  return s;
}

/** uid of the first card `id` (optionally of `owner`) that is not in a deck. */
export function uidOf(s: GameState, id: CardId, owner?: PlayerId): Uid {
  const inDeck = new Set([...s.players[0].deck, ...s.players[1].deck]);
  const all = Object.values(s.cards).filter((c) => c.cardId === id && (owner === undefined || c.owner === owner));
  const c = all.find((x) => !inDeck.has(x.uid)) ?? all[0];
  if (!c) throw new Error(`no ${id}${owner !== undefined ? ` for player ${owner}` : ''}`);
  return c.uid;
}
