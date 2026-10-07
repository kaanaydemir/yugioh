// Neon Düello rules engine. Pure TypeScript, deterministic (mulberry32 in state.rng),
// never mutates its input. See docs/GAME_DESIGN.md §2–§3 and src/engine/types.ts.
//
// Resolution model: an action performs its immediate effects, then pushes follow-up steps
// ("tasks") onto `state.internal.queue`. `run()` drains the queue in order; a task may open a
// PendingDecision, which pauses the queue until the decision is answered by a later action.

import { CARDS, DEFAULT_DECK, type CardId } from '../data/cards';
import {
  EngineError,
  HAND_LIMIT,
  MONSTER_ZONES,
  SPELL_TRAP_ZONES,
  START_HAND,
  START_LP,
  other,
  type Action,
  type ApplyResult,
  type DestroyReason,
  type GameEvent,
  type GameState,
  type GraveyardFrom,
  type NewGameOptions,
  type PendingDecision,
  type Phase,
  type PlayerId,
  type PlayerState,
  type Uid,
  type WinReason,
  type ZoneRef,
} from './types';
import {
  CHASM_MIN_ATK,
  PLAYERS,
  actionKey,
  currentAtk as qCurrentAtk,
  currentDef as qCurrentDef,
  findMonster,
  findSpellTrap,
  locate as qLocate,
  monsterDefOf,
  monsterRefs,
  normalizeAction,
  respondableTraps,
  spellDefOf,
  spellTrapRefs,
  trapDefOf,
} from './query';
import { legalActions as qLegalActions } from './legal';
import { nextRandom, shuffleInPlace } from './rng';

// ---------------------------------------------------------------------------
// Public API (re-exported through ./index.ts)
// ---------------------------------------------------------------------------

export function actingPlayer(state: GameState): PlayerId {
  return state.pending ? state.pending.player : state.activePlayer;
}

export function legalActions(state: GameState): Action[] {
  return qLegalActions(state);
}

export function currentAtk(state: GameState, uid: Uid): number {
  return qCurrentAtk(state, uid);
}

export function currentDef(state: GameState, uid: Uid): number {
  return qCurrentDef(state, uid);
}

export function locate(state: GameState, uid: Uid): ZoneRef | null {
  return qLocate(state, uid);
}

/** True if `action` is legal right now (surrender is always accepted while the game runs). */
export function isLegal(state: GameState, action: Action): boolean {
  if (state.winner !== null) return false;
  if (action.type === 'surrender') return action.player === 0 || action.player === 1;
  let key: string;
  try {
    key = actionKey(normalizeAction(state, action));
  } catch {
    return false;
  }
  return qLegalActions(state).some((a) => actionKey(normalizeAction(state, a)) === key);
}

export function newGame(opts: NewGameOptions): ApplyResult {
  const decks: [CardId[], CardId[]] = opts.decks ?? [DEFAULT_DECK, DEFAULT_DECK];
  const s: GameState = {
    cards: {},
    players: [emptyPlayer(0), emptyPlayer(1)],
    turn: 1,
    activePlayer: 0,
    firstPlayer: 0,
    phase: 'draw',
    pending: null,
    winner: null,
    winReason: null,
    rng: opts.seed >>> 0,
    internal: { queue: [] },
  };
  const r = new Resolver(s);

  const first: PlayerId = opts.firstPlayer ?? (nextRandom(s) < 0.5 ? 0 : 1);
  if (first !== 0 && first !== 1) throw new EngineError(`invalid firstPlayer ${String(first)}`);
  s.firstPlayer = first;
  s.activePlayer = first;

  let uid = 1;
  for (const p of PLAYERS) {
    for (const id of decks[p]) {
      if (!CARDS[id]) throw new EngineError(`unknown card id ${String(id)}`);
      s.cards[uid] = { uid, cardId: id, owner: p };
      s.players[p].deck.push(uid);
      uid++;
    }
  }
  if (!opts.noShuffle) for (const p of PLAYERS) shuffleInPlace(s, s.players[p].deck);

  r.emit({ type: 'gameStart', firstPlayer: first, seed: opts.seed });
  for (const p of PLAYERS) r.emit({ type: 'shuffle', player: p });
  for (let i = 0; i < START_HAND; i++) {
    r.drawCard(first, true);
    r.drawCard(other(first), true);
  }
  r.beginTurn(first, 1, true);
  return { state: s, events: r.ev };
}

export function apply(state: GameState, action: Action): ApplyResult {
  if (!action || typeof action !== 'object') throw new EngineError('action must be an object');
  if (state.winner !== null) throw new EngineError('the game is over');

  if (action.type === 'surrender') {
    if (action.player !== 0 && action.player !== 1) throw new EngineError('invalid player');
    const s = structuredClone(state);
    const r = new Resolver(s);
    r.win(other(action.player), 'surrender');
    return { state: s, events: r.ev };
  }

  let norm: Action;
  try {
    norm = normalizeAction(state, action);
  } catch {
    throw new EngineError(`malformed action: ${safeJson(action)}`);
  }
  const key = actionKey(norm);
  const legal = qLegalActions(state);
  if (!legal.some((a) => actionKey(normalizeAction(state, a)) === key))
    throw new EngineError(`illegal action: ${safeJson(action)}`);

  const s = structuredClone(state);
  if (!Array.isArray(s.internal.queue)) s.internal.queue = [];
  const r = new Resolver(s);
  r.perform(norm);
  r.checkWin();
  r.run();
  return { state: s, events: r.ev };
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function emptyPlayer(id: PlayerId): PlayerState {
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

// ---------------------------------------------------------------------------
// Continuation tasks (stored in state.internal.queue — plain data, structuredClone-safe)
// ---------------------------------------------------------------------------

type SummonMethod = 'normal' | 'tribute' | 'special' | 'flip';

type Task =
  /** chasm_trap window after a Normal/Tribute Summon. */
  | { k: 'summonWindow'; uid: Uid }
  /** On-summon effects (magma_titan, lumen_sprite, abyss_magus, thorn_lurker on flip summon). */
  | { k: 'summonTriggers'; uid: Uid; method: SummonMethod }
  /** mirror_barrier / chains_of_light window after an attack declaration. */
  | { k: 'attackWindow'; attackerUid: Uid; targetUid: Uid | null }
  | { k: 'battle'; attackerUid: Uid; targetUid: Uid | null }
  /** Post-battle triggers, queued in rule order: volt → ember → tide → thorn. */
  | { k: 'voltBurn'; uid: Uid; controller: PlayerId }
  | { k: 'emberBurn'; uid: Uid }
  | { k: 'tideBurn'; uid: Uid; controller: PlayerId }
  | { k: 'flipEffect'; uid: Uid; controller: PlayerId }
  | { k: 'endPhase' }
  | { k: 'nextTurn' };

const ATTACK_TRAPS = ['attackDestroyAllAttackPosition', 'attackNegateEndBattle'] as const;
const SUMMON_TRAPS = ['summonDestroy1000Plus'] as const;

class Resolver {
  readonly ev: GameEvent[] = [];
  private statDepth = 0;

  constructor(readonly s: GameState) {}

  emit(e: GameEvent): void {
    this.ev.push(e);
  }

  get queue(): Task[] {
    let q = this.s.internal.queue as Task[] | undefined;
    if (!Array.isArray(q)) {
      q = [];
      this.s.internal.queue = q;
    }
    return q;
  }

  private ps(p: PlayerId): PlayerState {
    return this.s.players[p];
  }

  private cardId(uid: Uid): CardId {
    return this.s.cards[uid].cardId;
  }

  // ---- queue -------------------------------------------------------------------------

  run(): void {
    const s = this.s;
    while (s.winner === null && !s.pending && this.queue.length > 0) {
      const t = this.queue.shift()!;
      this.exec(t);
      this.checkWin();
    }
  }

  private exec(t: Task): void {
    switch (t.k) {
      case 'summonWindow':
        return this.summonWindow(t.uid);
      case 'summonTriggers':
        return this.summonTriggers(t.uid, t.method);
      case 'attackWindow':
        return this.attackWindow(t.attackerUid, t.targetUid);
      case 'battle':
        return this.resolveBattle(t.attackerUid, t.targetUid);
      case 'voltBurn':
        this.activateMonsterEffect(t.uid, t.controller);
        this.damage(other(t.controller), 500, 'effect', t.uid);
        return;
      case 'emberBurn': {
        const loc = findMonster(this.s, t.uid);
        if (!loc || !loc.slot.faceUp) return;
        this.activateMonsterEffect(t.uid, loc.player);
        this.damage(other(loc.player), 300, 'effect', t.uid);
        return;
      }
      case 'tideBurn':
        this.activateMonsterEffect(t.uid, t.controller);
        this.damage(other(t.controller), 300, 'effect', t.uid);
        return;
      case 'flipEffect':
        return this.openFlipEffect(t.uid, t.controller);
      case 'endPhase':
        return this.endPhase();
      case 'nextTurn':
        return this.beginTurn(other(this.s.activePlayer), this.s.turn + 1, false);
    }
  }

  // ---- primitives ----------------------------------------------------------------------

  drawCard(p: PlayerId, initial: boolean): boolean {
    const ps = this.ps(p);
    const uid = ps.deck.shift();
    if (uid === undefined) return false;
    ps.hand.push(uid);
    this.emit({ type: 'draw', player: p, uid, cardId: this.cardId(uid), initial });
    return true;
  }

  private setPhase(phase: Phase): void {
    this.s.phase = phase;
    this.emit({ type: 'phaseChange', player: this.s.activePlayer, phase });
  }

  beginTurn(p: PlayerId, turn: number, skipDraw: boolean): void {
    const s = this.s;
    s.turn = turn;
    s.activePlayer = p;
    for (const pl of PLAYERS) {
      this.ps(pl).normalSummonUsed = false;
      for (const m of this.ps(pl).monsters) if (m) m.attacksThisTurn = 0;
    }
    this.emit({ type: 'turnStart', player: p, turn });
    this.setPhase('draw');
    if (!skipDraw && !this.drawCard(p, false)) {
      this.emit({ type: 'deckOut', player: p });
      this.win(other(p), 'deckout');
      return;
    }
    this.setPhase('main');
  }

  private endPhase(): void {
    this.setPhase('end');
    const p = this.s.activePlayer;
    const hand = this.ps(p).hand.length;
    if (hand > HAND_LIMIT) this.openPending({ kind: 'discard', player: p, count: hand - HAND_LIMIT });
  }

  private openPending(pd: PendingDecision): void {
    this.s.pending = pd;
    this.emit({ type: 'decision', pending: structuredClone(pd) });
  }

  private toGraveyard(uid: Uid, from: GraveyardFrom, zone: number | null): void {
    const owner = this.s.cards[uid].owner;
    this.ps(owner).graveyard.push(uid);
    this.emit({ type: 'toGraveyard', owner, uid, cardId: this.cardId(uid), from, zone });
  }

  private damage(p: PlayerId, amount: number, source: 'battle' | 'effect', sourceUid: Uid | null): void {
    if (amount <= 0) return;
    const ps = this.ps(p);
    ps.lp = Math.max(0, ps.lp - amount);
    this.emit({ type: 'damage', player: p, amount, source, sourceUid, lpAfter: ps.lp });
  }

  private gain(p: PlayerId, amount: number, sourceUid: Uid | null): void {
    const ps = this.ps(p);
    ps.lp += amount;
    this.emit({ type: 'lpGain', player: p, amount, sourceUid, lpAfter: ps.lp });
  }

  checkWin(): void {
    const s = this.s;
    if (s.winner !== null) return;
    const dead0 = s.players[0].lp <= 0;
    const dead1 = s.players[1].lp <= 0;
    if (!dead0 && !dead1) return;
    // Both at 0 at the same time: the turn player wins.
    const winner: PlayerId = dead0 && dead1 ? s.activePlayer : dead0 ? 1 : 0;
    this.win(winner, 'lp');
  }

  win(winner: PlayerId, reason: WinReason): void {
    const s = this.s;
    if (s.winner !== null) return;
    s.winner = winner;
    s.winReason = reason;
    s.pending = null;
    this.queue.length = 0;
    this.emit({ type: 'gameOver', winner, reason });
  }

  /** Runs `fn` and emits statChange for every monster face-up before and after whose values changed. */
  private withStats(fn: () => void): void {
    if (this.statDepth > 0) {
      fn();
      return;
    }
    const before = this.snapshotStats();
    this.statDepth++;
    try {
      fn();
    } finally {
      this.statDepth--;
    }
    for (const [uid, now] of this.snapshotStats()) {
      const prev = before.get(uid);
      if (prev && (prev.atk !== now.atk || prev.def !== now.def))
        this.emit({ type: 'statChange', uid, atk: now.atk, def: now.def, prevAtk: prev.atk, prevDef: prev.def });
    }
  }

  private snapshotStats(): Map<Uid, { atk: number; def: number }> {
    const m = new Map<Uid, { atk: number; def: number }>();
    for (const p of PLAYERS)
      for (const slot of this.ps(p).monsters)
        if (slot && slot.faceUp) m.set(slot.uid, { atk: qCurrentAtk(this.s, slot.uid), def: qCurrentDef(this.s, slot.uid) });
    return m;
  }

  /** destroy → toGraveyard for a monster, then its equips (destroy reason 'rule' → toGraveyard). */
  private destroyMonster(p: PlayerId, index: number, reason: DestroyReason, sourceUid: Uid | null): void {
    const slot = this.ps(p).monsters[index];
    if (!slot) return;
    this.emit({ type: 'destroy', player: p, uid: slot.uid, cardId: this.cardId(slot.uid), location: 'monster', zone: index, reason, sourceUid });
    this.ps(p).monsters[index] = null;
    this.toGraveyard(slot.uid, 'monster', index);
    this.dropEquips(slot.uid);
  }

  /** tribute → toGraveyard, then its equips. */
  private tributeMonster(p: PlayerId, index: number, forUid: Uid): void {
    const slot = this.ps(p).monsters[index];
    if (!slot) return;
    this.emit({ type: 'tribute', player: p, uid: slot.uid, cardId: this.cardId(slot.uid), zone: index, forUid });
    this.ps(p).monsters[index] = null;
    this.toGraveyard(slot.uid, 'monster', index);
    this.dropEquips(slot.uid);
  }

  /** Equip spells attached to a monster that left the field are destroyed by rule. */
  private dropEquips(monsterUid: Uid): void {
    for (const p of PLAYERS) {
      const sts = this.ps(p).spellTraps;
      for (let i = 0; i < sts.length; i++) {
        const st = sts[i];
        if (!st || st.equippedTo !== monsterUid) continue;
        this.emit({ type: 'destroy', player: p, uid: st.uid, cardId: this.cardId(st.uid), location: 'spellTrap', zone: i, reason: 'rule', sourceUid: monsterUid });
        sts[i] = null;
        this.toGraveyard(st.uid, 'spellTrap', i);
      }
    }
  }

  /** Destroy a card in a spell/trap or field zone (statChange for equips / field spells). */
  private destroySpellTrap(ref: ZoneRef, reason: DestroyReason, sourceUid: Uid | null): void {
    this.withStats(() => {
      const ps = this.ps(ref.player);
      if (ref.zone === 'field') {
        const fs = ps.fieldSpell;
        if (!fs) return;
        this.emit({ type: 'destroy', player: ref.player, uid: fs.uid, cardId: this.cardId(fs.uid), location: 'field', zone: 0, reason, sourceUid });
        ps.fieldSpell = null;
        this.toGraveyard(fs.uid, 'field', 0);
        if (fs.faceUp) this.emit({ type: 'fieldSpell', player: ref.player, uid: fs.uid, cardId: this.cardId(fs.uid), active: false });
      } else if (ref.zone === 'spellTrap') {
        const st = ps.spellTraps[ref.index];
        if (!st) return;
        this.emit({ type: 'destroy', player: ref.player, uid: st.uid, cardId: this.cardId(st.uid), location: 'spellTrap', zone: ref.index, reason, sourceUid });
        ps.spellTraps[ref.index] = null;
        this.toGraveyard(st.uid, 'spellTrap', ref.index);
      }
    });
  }

  /** `activate` for a monster effect; `zone` null + from 'graveyard' when it already left the field. */
  private activateMonsterEffect(uid: Uid, controller: PlayerId): void {
    const loc = findMonster(this.s, uid);
    this.emit({
      type: 'activate',
      player: loc ? loc.player : controller,
      uid,
      cardId: this.cardId(uid),
      kind: 'monsterEffect',
      from: loc ? 'monster' : 'graveyard',
      zone: loc ? loc.index : null,
    });
  }

  // ---- actions --------------------------------------------------------------------------

  perform(a: Action): void {
    switch (a.type) {
      case 'normalSummon':
      case 'setMonster':
        return this.summonFromHand(a.player, a.uid, a.zone, a.tributes, a.type === 'setMonster');
      case 'flipSummon':
        return this.flipSummon(a.player, a.zone);
      case 'changePosition': {
        const slot = this.ps(a.player).monsters[a.zone]!;
        slot.position = slot.position === 'attack' ? 'defense' : 'attack';
        slot.positionChangedTurn = this.s.turn;
        this.emit({ type: 'positionChange', player: a.player, uid: slot.uid, zone: a.zone, position: slot.position });
        return;
      }
      case 'setSpellTrap': {
        const ps = this.ps(a.player);
        ps.hand.splice(ps.hand.indexOf(a.uid), 1);
        ps.spellTraps[a.zone] = { uid: a.uid, faceUp: false, setTurn: this.s.turn, equippedTo: null };
        this.emit({ type: 'setSpellTrap', player: a.player, uid: a.uid, zone: a.zone });
        return;
      }
      case 'activateSpell':
        return this.activateSpell(a);
      case 'enterBattle':
        return this.setPhase('battle');
      case 'attack':
        return this.declareAttack(a.player, a.attackerZone, a.targetZone);
      case 'endTurn':
        this.queue.length = 0;
        this.queue.push({ k: 'endPhase' }, { k: 'nextTurn' });
        return;
      case 'respond':
        return this.respond(a.player, a.uid);
      case 'chooseTarget':
        return this.chooseTarget(a.target);
      case 'discard': {
        this.s.pending = null;
        const ps = this.ps(a.player);
        for (const uid of a.uids) {
          ps.hand.splice(ps.hand.indexOf(uid), 1);
          this.emit({ type: 'discard', player: a.player, uid, cardId: this.cardId(uid) });
          this.toGraveyard(uid, 'hand', null);
        }
        return;
      }
      case 'surrender':
        return this.win(other(a.player), 'surrender');
    }
  }

  private summonFromHand(p: PlayerId, uid: Uid, zone: number, tributes: Uid[], set: boolean): void {
    const s = this.s;
    const ps = this.ps(p);
    ps.hand.splice(ps.hand.indexOf(uid), 1);
    const tribs = tributes
      .map((t) => findMonster(s, t)!)
      .sort((a, b) => a.index - b.index);
    for (const t of tribs) this.tributeMonster(p, t.index, uid);
    ps.normalSummonUsed = true;
    if (set) {
      ps.monsters[zone] = { uid, position: 'defense', faceUp: false, enteredTurn: s.turn, attacksThisTurn: 0, positionChangedTurn: -1 };
      this.emit({ type: 'setMonster', player: p, uid, zone });
      return;
    }
    ps.monsters[zone] = { uid, position: 'attack', faceUp: true, enteredTurn: s.turn, attacksThisTurn: 0, positionChangedTurn: -1 };
    const method: SummonMethod = tribs.length ? 'tribute' : 'normal';
    this.emit({ type: 'summon', player: p, uid, cardId: this.cardId(uid), zone, method, position: 'attack', from: 'hand', sourceUid: null });
    this.queue.unshift({ k: 'summonWindow', uid }, { k: 'summonTriggers', uid, method });
  }

  private flipSummon(p: PlayerId, zone: number): void {
    const slot = this.ps(p).monsters[zone]!;
    slot.faceUp = true;
    slot.position = 'attack';
    slot.positionChangedTurn = this.s.turn;
    const cardId = this.cardId(slot.uid);
    this.emit({ type: 'flip', player: p, uid: slot.uid, cardId, zone, cause: 'flipSummon' });
    this.emit({ type: 'summon', player: p, uid: slot.uid, cardId, zone, method: 'flip', position: 'attack', from: 'field', sourceUid: null });
    this.queue.unshift({ k: 'summonTriggers', uid: slot.uid, method: 'flip' });
  }

  private summonWindow(uid: Uid): void {
    const loc = findMonster(this.s, uid);
    if (!loc || !loc.slot.faceUp) return;
    if (qCurrentAtk(this.s, uid) < CHASM_MIN_ATK) return;
    const defender = other(loc.player);
    const options = respondableTraps(this.s, defender, SUMMON_TRAPS);
    if (options.length)
      this.openPending({ kind: 'trapResponse', player: defender, trigger: { kind: 'summoned', monsterUid: uid }, options });
  }

  private summonTriggers(uid: Uid, method: SummonMethod): void {
    const s = this.s;
    const loc = findMonster(s, uid);
    if (!loc || !loc.slot.faceUp) return; // did not survive the trap window
    const d = monsterDefOf(s, uid);
    if (!d) return;
    switch (d.effect) {
      case 'summonBurn500':
        this.activateMonsterEffect(uid, loc.player);
        this.damage(other(loc.player), 500, 'effect', uid);
        return;
      case 'normalSummonGain500':
        if (method !== 'normal') return;
        this.activateMonsterEffect(uid, loc.player);
        this.gain(loc.player, 500, uid);
        return;
      case 'tributeSummonDestroySpellTrap': {
        if (method !== 'tribute') return;
        const candidates = spellTrapRefs(s, other(loc.player));
        if (candidates.length) this.openPending({ kind: 'chooseTarget', player: loc.player, sourceUid: uid, candidates });
        return;
      }
      case 'flipDestroyMonster':
        if (method === 'flip') this.openFlipEffect(uid, loc.player);
        return;
      default:
        return;
    }
  }

  private openFlipEffect(uid: Uid, controller: PlayerId): void {
    const candidates = monsterRefs(this.s, other(controller));
    if (candidates.length) this.openPending({ kind: 'chooseTarget', player: controller, sourceUid: uid, candidates });
  }

  private activateSpell(a: Extract<Action, { type: 'activateSpell' }>): void {
    const s = this.s;
    const p = a.player;
    const ps = this.ps(p);
    const d = spellDefOf(s, a.uid)!;
    const fromHand = ps.hand.includes(a.uid);
    let stZone: number | null = null;
    if (fromHand) {
      ps.hand.splice(ps.hand.indexOf(a.uid), 1);
    } else {
      stZone = ps.spellTraps.findIndex((st) => st?.uid === a.uid);
      ps.spellTraps[stZone]!.faceUp = true;
    }
    const from = fromHand ? 'hand' : 'spellTrap';
    const base = { type: 'activate', player: p, uid: a.uid, cardId: d.id, kind: 'spell' } as const;

    if (d.spellType === 'normal') {
      this.emit({ ...base, from, zone: stZone });
      const after: Task[] = [];
      switch (d.effect) {
        case 'destroyOpponentMonster': {
          const ref = (a.target as { kind: 'monster'; ref: ZoneRef }).ref;
          this.emit({ type: 'target', player: p, sourceUid: a.uid, targets: [{ ...ref }] });
          this.destroyMonster(ref.player, ref.index, 'effect', a.uid);
          break;
        }
        case 'gain1000':
          this.gain(p, 1000, a.uid);
          break;
        case 'reviveFromGraveyard': {
          const t = a.target as { kind: 'graveyard'; uid: Uid; toZone: number };
          const owner = s.cards[t.uid].owner;
          this.emit({ type: 'target', player: p, sourceUid: a.uid, targets: [{ player: p, zone: 'monster', index: t.toZone }], graveyardUid: t.uid });
          const gy = this.ps(owner).graveyard;
          gy.splice(gy.indexOf(t.uid), 1);
          ps.monsters[t.toZone] = { uid: t.uid, position: 'attack', faceUp: true, enteredTurn: s.turn, attacksThisTurn: 0, positionChangedTurn: -1 };
          this.emit({ type: 'summon', player: p, uid: t.uid, cardId: this.cardId(t.uid), zone: t.toZone, method: 'special', position: 'attack', from: 'graveyard', sourceUid: a.uid });
          after.push({ k: 'summonTriggers', uid: t.uid, method: 'special' });
          break;
        }
        default:
          break;
      }
      if (stZone !== null) ps.spellTraps[stZone] = null;
      this.toGraveyard(a.uid, 'resolved', stZone);
      this.queue.unshift(...after);
      return;
    }

    if (d.spellType === 'equip') {
      const zone = fromHand ? a.zone! : stZone!;
      if (fromHand) ps.spellTraps[zone] = { uid: a.uid, faceUp: true, setTurn: -1, equippedTo: null };
      this.emit({ ...base, from, zone });
      const ref = (a.target as { kind: 'monster'; ref: ZoneRef }).ref;
      const targetUid = this.ps(ref.player).monsters[ref.index]!.uid;
      this.emit({ type: 'target', player: p, sourceUid: a.uid, targets: [{ ...ref }] });
      this.withStats(() => {
        ps.spellTraps[zone]!.equippedTo = targetUid;
        this.emit({ type: 'equip', player: p, spellUid: a.uid, spellZone: zone, targetUid });
      });
      return;
    }

    // Field spell: only one on the whole field — the new one destroys any existing one.
    this.emit({ ...base, from, zone: null });
    this.withStats(() => {
      for (const op of PLAYERS) if (this.ps(op).fieldSpell) this.destroySpellTrap({ player: op, zone: 'field', index: 0 }, 'rule', a.uid);
      ps.fieldSpell = { uid: a.uid, faceUp: true, setTurn: -1, equippedTo: null };
      this.emit({ type: 'fieldSpell', player: p, uid: a.uid, cardId: d.id, active: true });
    });
  }

  private declareAttack(p: PlayerId, attackerZone: number, targetZone: number | null): void {
    const slot = this.ps(p).monsters[attackerZone]!;
    slot.attacksThisTurn++;
    const targetUid = targetZone === null ? null : this.ps(other(p)).monsters[targetZone]!.uid;
    this.emit({ type: 'attackDeclare', player: p, attackerUid: slot.uid, attackerZone, targetUid, targetZone });
    this.queue.unshift(
      { k: 'attackWindow', attackerUid: slot.uid, targetUid },
      { k: 'battle', attackerUid: slot.uid, targetUid },
    );
  }

  private attackWindow(attackerUid: Uid, targetUid: Uid | null): void {
    const loc = findMonster(this.s, attackerUid);
    if (!loc) return;
    const defender = other(loc.player);
    const options = respondableTraps(this.s, defender, ATTACK_TRAPS);
    if (options.length)
      this.openPending({ kind: 'trapResponse', player: defender, trigger: { kind: 'attackDeclared', attackerUid, targetUid }, options });
  }

  private respond(p: PlayerId, uid: Uid | null): void {
    const s = this.s;
    const pd = s.pending;
    s.pending = null;
    if (uid === null || !pd || pd.kind !== 'trapResponse') {
      this.emit({ type: 'responseDeclined', player: p });
      return;
    }
    const loc = findSpellTrap(s, uid)!;
    loc.slot.faceUp = true;
    const d = trapDefOf(s, uid)!;
    this.emit({ type: 'activate', player: p, uid, cardId: d.id, kind: 'trap', from: 'spellTrap', zone: loc.index });
    const finish = () => {
      this.ps(p).spellTraps[loc.index] = null;
      this.toGraveyard(uid, 'spellTrap', loc.index);
    };
    switch (d.effect) {
      case 'attackDestroyAllAttackPosition': {
        const attacker = other(p);
        const victims: number[] = [];
        this.ps(attacker).monsters.forEach((m, i) => {
          if (m && m.faceUp && m.position === 'attack') victims.push(i);
        });
        for (const i of victims) this.destroyMonster(attacker, i, 'effect', uid);
        finish();
        return; // the pending 'battle' task finds no attacker and does nothing
      }
      case 'attackNegateEndBattle': {
        const attackerUid = pd.trigger.kind === 'attackDeclared' ? pd.trigger.attackerUid : -1;
        this.emit({ type: 'attackNegated', player: other(p), attackerUid, byUid: uid });
        finish();
        // The battle phase ends and the turn passes.
        this.queue.length = 0;
        this.queue.push({ k: 'endPhase' }, { k: 'nextTurn' });
        return;
      }
      case 'summonDestroy1000Plus': {
        if (pd.trigger.kind === 'summoned') {
          const mloc = findMonster(s, pd.trigger.monsterUid);
          if (mloc) this.destroyMonster(mloc.player, mloc.index, 'effect', uid);
        }
        finish();
        return; // summonTriggers will see the monster is gone
      }
    }
  }

  private chooseTarget(ref: ZoneRef): void {
    const s = this.s;
    const pd = s.pending;
    s.pending = null;
    if (!pd || pd.kind !== 'chooseTarget') return;
    const src = pd.sourceUid;
    this.activateMonsterEffect(src, pd.player);
    this.emit({ type: 'target', player: pd.player, sourceUid: src, targets: [{ player: ref.player, zone: ref.zone, index: ref.index }] });
    if (ref.zone === 'monster') this.destroyMonster(ref.player, ref.index, 'effect', src);
    else this.destroySpellTrap(ref, 'effect', src);
  }

  private resolveBattle(attackerUid: Uid, targetUid: Uid | null): void {
    const s = this.s;
    const aLoc = findMonster(s, attackerUid);
    // The attacker may have been destroyed in the trap window (mirror_barrier).
    if (!aLoc || !aLoc.slot.faceUp || aLoc.slot.position !== 'attack' || aLoc.player !== s.activePlayer) return;
    const ap = aLoc.player;
    const dp = other(ap);
    const aDef = monsterDefOf(s, attackerUid)!;

    if (targetUid === null) {
      const atk = qCurrentAtk(s, attackerUid);
      this.emit({
        type: 'battle', player: ap, attackerUid, attackerZone: aLoc.index, targetUid: null, targetZone: null,
        attackerAtk: atk, targetPosition: null, targetValue: null, result: 'direct',
      });
      this.damage(dp, atk, 'battle', attackerUid);
      return;
    }

    const tLoc = findMonster(s, targetUid);
    if (!tLoc || tLoc.player !== dp) return;
    const tDef = monsterDefOf(s, targetUid)!;

    // A face-down target is flipped face-up before damage calculation.
    let flipped = false;
    if (!tLoc.slot.faceUp) {
      tLoc.slot.faceUp = true;
      flipped = true;
      this.emit({ type: 'flip', player: dp, uid: targetUid, cardId: tDef.id, zone: tLoc.index, cause: 'attacked' });
    }

    const atk = qCurrentAtk(s, attackerUid);
    const tPos = tLoc.slot.position;
    const tVal = tPos === 'attack' ? qCurrentAtk(s, targetUid) : qCurrentDef(s, targetUid);
    let killT = false;
    let killA = false;
    let dmgTo: PlayerId | null = null;
    let dmg = 0;
    if (tPos === 'attack') {
      if (atk > tVal) {
        killT = true;
        dmgTo = dp;
        dmg = atk - tVal;
      } else if (atk < tVal) {
        killA = true;
        dmgTo = ap;
        dmg = tVal - atk;
      } else if (atk > 0) {
        killT = killA = true;
      }
    } else if (atk > tVal) {
      killT = true;
      if (aDef.effect === 'piercing') {
        dmgTo = dp;
        dmg = atk - tVal;
      }
    } else if (atk < tVal) {
      dmgTo = ap;
      dmg = tVal - atk;
    }
    const result = killT && killA ? 'bothDestroyed' : killT ? 'targetDestroyed' : killA ? 'attackerDestroyed' : 'noDestroy';
    this.emit({
      type: 'battle', player: ap, attackerUid, attackerZone: aLoc.index, targetUid, targetZone: tLoc.index,
      attackerAtk: atk, targetPosition: tPos, targetValue: tVal, result,
    });
    if (dmgTo !== null) this.damage(dmgTo, dmg, 'battle', dmgTo === dp ? attackerUid : targetUid);
    if (killT) this.destroyMonster(dp, tLoc.index, 'battle', attackerUid);
    if (killA) this.destroyMonster(ap, aLoc.index, 'battle', targetUid);

    // Post-battle triggers in rule order (§2): volt → ember → tide → thorn.
    const tasks: Task[] = [];
    if (killA && aDef.effect === 'destroyedByBattleBurn500') tasks.push({ k: 'voltBurn', uid: attackerUid, controller: ap });
    if (killT && tDef.effect === 'destroyedByBattleBurn500') tasks.push({ k: 'voltBurn', uid: targetUid, controller: dp });
    if (killT && !killA && aDef.effect === 'battleDestroyBurn300') tasks.push({ k: 'emberBurn', uid: attackerUid });
    if (killA && !killT && tDef.effect === 'battleDestroyBurn300') tasks.push({ k: 'emberBurn', uid: targetUid });
    if (tPos === 'defense' && tDef.effect === 'defenseAttackedBurn300') tasks.push({ k: 'tideBurn', uid: targetUid, controller: dp });
    if (flipped && tDef.effect === 'flipDestroyMonster') tasks.push({ k: 'flipEffect', uid: targetUid, controller: dp });
    this.queue.unshift(...tasks);
  }
}
