// Test helpers: build arbitrary board states directly, apply action chains, summarise events,
// and check engine invariants.

import { CARDS, type CardId } from '../../src/data/cards';
import {
  MONSTER_ZONES,
  SPELL_TRAP_ZONES,
  START_LP,
  apply,
  legalActions,
  type Action,
  type GameEvent,
  type GameState,
  type MonsterSlot,
  type Phase,
  type PlayerId,
  type PlayerState,
  type Position,
  type SpellTrapSlot,
  type Uid,
} from '../../src/engine';
import { actionKey, normalizeAction } from '../../src/engine/query';

export type MonSpec =
  | CardId
  | { id: CardId; position?: Position; faceUp?: boolean; enteredTurn?: number; attacks?: number; posChanged?: number };
export type STSpec = CardId | { id: CardId; faceUp?: boolean; setTurn?: number; equippedTo?: number };

export interface Side {
  hand?: CardId[];
  deck?: CardId[];
  graveyard?: CardId[];
  monsters?: (MonSpec | null)[];
  spellTraps?: (STSpec | null)[];
  field?: CardId | null;
  lp?: number;
  normalSummonUsed?: boolean;
}

export interface ScenarioOpts {
  p0?: Side;
  p1?: Side;
  turn?: number;
  active?: PlayerId;
  phase?: Phase;
  first?: PlayerId;
}

/**
 * Build a GameState directly. Defaults: turn 3, player 0 active, main phase, monsters arrived
 * last turn (so they may attack / change position), spells/traps set last turn (traps ready),
 * each deck holds three stone_sentinels so draws work.
 */
export function scenario(o: ScenarioOpts = {}): GameState {
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
    rng: 12345,
    internal: { queue: [] },
  };
  let next = 1;
  const mk = (id: CardId, owner: PlayerId): Uid => {
    if (!CARDS[id]) throw new Error(`bad card ${id}`);
    const uid = next++;
    s.cards[uid] = { uid, cardId: id, owner };
    return uid;
  };
  for (const p of [0, 1] as PlayerId[]) {
    const side = (p === 0 ? o.p0 : o.p1) ?? {};
    const ps = s.players[p];
    ps.lp = side.lp ?? START_LP;
    ps.normalSummonUsed = side.normalSummonUsed ?? false;
    ps.deck = (side.deck ?? ['stone_sentinel', 'stone_sentinel', 'stone_sentinel']).map((id) => mk(id, p));
    ps.hand = (side.hand ?? []).map((id) => mk(id, p));
    ps.graveyard = (side.graveyard ?? []).map((id) => mk(id, p));
    (side.monsters ?? []).forEach((spec, i) => {
      if (!spec) return;
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
      if (!spec) return;
      const st = typeof spec === 'string' ? { id: spec } : spec;
      const equipTarget = st.equippedTo !== undefined ? ps.monsters[st.equippedTo]?.uid ?? null : null;
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

/** uid of the first card with `id` (optionally of `owner`). */
export function uidOf(s: GameState, id: CardId, owner?: PlayerId): Uid {
  const inDeck = new Set([...s.players[0].deck, ...s.players[1].deck]);
  const all = Object.values(s.cards).filter((c) => c.cardId === id && (owner === undefined || c.owner === owner));
  const c = all.find((x) => !inDeck.has(x.uid)) ?? all[0];
  if (!c) throw new Error(`no ${id} for owner ${owner}`);
  return c.uid;
}

/** Apply several actions in a row; returns the final state and all events (invariants checked). */
export function play(s: GameState, ...actions: Action[]): { state: GameState; events: GameEvent[] } {
  let state = s;
  const events: GameEvent[] = [];
  for (const a of actions) {
    const r = apply(state, a);
    checkInvariants(r.state);
    checkEvents(r.state, r.events);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

/** Compact event strings: "type" or "type:cardId" (or extra detail for some types). */
export function seq(s: GameState, events: GameEvent[]): string[] {
  return events.map((e) => {
    const any = e as Record<string, unknown>;
    let id = (any.cardId as string | undefined) ?? undefined;
    if (!id && typeof any.uid === 'number' && s.cards[any.uid as number]) id = s.cards[any.uid as number].cardId;
    switch (e.type) {
      case 'phaseChange':
        return `phaseChange:${e.phase}`;
      case 'battle':
        return `battle:${e.result}`;
      case 'damage':
        return `damage:p${e.player}:${e.amount}`;
      case 'lpGain':
        return `lpGain:p${e.player}:${e.amount}`;
      case 'decision':
        return `decision:${e.pending.kind}`;
      case 'statChange':
        return `statChange:${s.cards[e.uid].cardId}:${e.prevAtk}>${e.atk}`;
      case 'equip':
        return `equip:${s.cards[e.targetUid].cardId}`;
      case 'attackDeclare':
        return `attackDeclare:${s.cards[e.attackerUid].cardId}`;
      case 'attackNegated':
        return `attackNegated`;
      case 'turnStart':
        return `turnStart:p${e.player}`;
      case 'gameOver':
        return `gameOver:p${e.winner}:${e.reason}`;
      case 'target':
        return 'target';
      default:
        return id ? `${e.type}:${id}` : e.type;
    }
  });
}

export function isListed(s: GameState, a: Action): boolean {
  const key = actionKey(normalizeAction(s, a));
  return legalActions(s).some((l) => actionKey(normalizeAction(s, l)) === key);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`invariant violated: ${msg}`);
}

/** Structural invariants that must hold after every apply (plain asserts: fast enough for fuzzing). */
export function checkInvariants(s: GameState): void {
  const seen = new Map<Uid, string>();
  const put = (uid: Uid, where: string) => {
    assert(s.cards[uid], `unknown uid ${uid} in ${where}`);
    assert(!seen.has(uid), `uid ${uid} both in ${seen.get(uid)} and ${where}`);
    seen.set(uid, where);
  };
  let fieldSpells = 0;
  for (const p of [0, 1] as PlayerId[]) {
    const ps = s.players[p];
    assert(ps.id === p, `players[${p}].id`);
    assert(ps.monsters.length === MONSTER_ZONES, 'monster zone count');
    assert(ps.spellTraps.length === SPELL_TRAP_ZONES, 'spell/trap zone count');
    assert(Number.isInteger(ps.lp) && ps.lp >= 0, `lp ${ps.lp}`);
    for (const u of ps.deck) {
      put(u, `deck${p}`);
      assert(s.cards[u].owner === p, 'deck owner');
    }
    for (const u of ps.hand) {
      put(u, `hand${p}`);
      assert(s.cards[u].owner === p, 'hand owner');
    }
    for (const u of ps.graveyard) {
      put(u, `gy${p}`);
      assert(s.cards[u].owner === p, 'graveyard owner');
    }
    ps.monsters.forEach((m, i) => {
      if (!m) return;
      put(m.uid, `mon${p}.${i}`);
      assert(CARDS[s.cards[m.uid].cardId].kind === 'monster', 'non-monster in monster zone');
      assert(m.faceUp || m.position === 'defense', 'face-down monster must be in defense');
      assert(m.enteredTurn <= s.turn, 'enteredTurn in the future');
    });
    ps.spellTraps.forEach((st, i) => {
      if (!st) return;
      put(st.uid, `st${p}.${i}`);
      const d = CARDS[s.cards[st.uid].cardId];
      assert(d.kind !== 'monster', 'monster in spell/trap zone');
      assert(!(d.kind === 'spell' && d.spellType === 'field'), 'field spell in spell/trap zone');
      if (st.equippedTo !== null) {
        assert(st.faceUp, 'equip must be face-up');
        const host = s.players[p].monsters.find((x) => x?.uid === st.equippedTo);
        assert(host && host.faceUp, 'equip host must be an own face-up monster');
      }
      // Face-up spell/trap cards only persist when they are continuous (equips here).
      if (st.faceUp) assert(st.equippedTo !== null, 'face-up non-equip left on the field');
    });
    if (ps.fieldSpell) {
      put(ps.fieldSpell.uid, `field${p}`);
      fieldSpells++;
    }
  }
  assert(fieldSpells <= 1, 'more than one field spell');
  assert(seen.size === Object.keys(s.cards).length, 'a card is nowhere');
  if (s.winner === null) {
    assert(s.phase !== 'draw', 'stuck in draw phase');
    if (s.pending?.kind === 'discard') assert(s.phase === 'end', 'discard outside end phase');
    if (!s.pending) assert(s.phase === 'main' || s.phase === 'battle', `idle in ${s.phase}`);
    if (s.pending?.kind === 'trapResponse') {
      assert(s.pending.player !== s.activePlayer, 'trap response by the turn player');
      for (const u of s.pending.options) {
        const st = s.players[s.pending.player].spellTraps.find((x) => x?.uid === u);
        assert(st && !st.faceUp && st.setTurn < s.turn, 'trap option must be set on an earlier turn');
      }
    }
    assert(legalActions(s).length > 0, 'no legal actions while the game runs');
  } else {
    assert(s.pending === null, 'pending after gameOver');
    assert(legalActions(s).length === 0, 'legal actions after gameOver');
  }
}

const UID_FIELDS = ['uid', 'attackerUid', 'targetUid', 'sourceUid', 'spellUid', 'forUid', 'byUid', 'graveyardUid', 'monsterUid'];

/** Every uid referenced by an event exists, and cardIds match. */
export function checkEvents(s: GameState, events: GameEvent[]): void {
  for (const e of events) {
    const any = e as Record<string, unknown>;
    for (const f of UID_FIELDS) {
      const v = any[f];
      if (v === null || v === undefined) continue;
      assert(typeof v === 'number' && s.cards[v], `${e.type}.${f}=${String(v)} is not a real uid`);
    }
    if (typeof any.uid === 'number' && typeof any.cardId === 'string')
      assert(s.cards[any.uid as number].cardId === any.cardId, `${e.type} cardId mismatch`);
    if (e.type === 'decision') {
      const pd = e.pending;
      if (pd.kind === 'trapResponse') for (const u of pd.options) assert(s.cards[u], 'decision option uid');
      if (pd.kind === 'chooseTarget') assert(s.cards[pd.sourceUid], 'decision source uid');
    }
    if (e.type === 'toGraveyard') assert(s.cards[e.uid].owner === e.owner, 'toGraveyard owner');
    if (e.type === 'damage' || e.type === 'lpGain') assert(e.amount > 0 && e.lpAfter >= 0, `${e.type} amounts`);
  }
}
