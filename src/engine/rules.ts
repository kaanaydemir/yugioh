// Neon Düello rules engine. Pure TypeScript, deterministic (mulberry32 in state.rng),
// never mutates its input. See docs/GAME_DESIGN.md §2–§3 and src/engine/types.ts.
//
// Resolution model: an action performs its immediate effects, then pushes follow-up steps
// ("tasks") onto `state.internal.queue`. `run()` drains the queue in order; a task may open a
// PendingDecision, which pauses the queue until the decision is answered by a later action.

import { CARDS, DEFAULT_DECK, isTrap, type CardId } from '../data/cards';
import { decksFor, detectDeckPool } from '../data/decks';
import {
  EngineError,
  HAND_LIMIT,
  DEFAULT_ZONES,
  ZONES_5,
  type ZoneCounts,
  START_HAND,
  START_LP,
  other,
  type Action,
  type ApplyResult,
  type DestroyReason,
  type GameEvent,
  type GameState,
  type GraveyardFrom,
  type MonsterSlot,
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
  battleNumbers,
  hasAllSeals,
  hasPiercing,
  currentAtk as qCurrentAtk,
  currentDef as qCurrentDef,
  equipOfEffect,
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
  uidAt,
  type SpellTrapLoc,
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
  const decks: [CardId[], CardId[]] = opts.decks ?? decksFor(opts.pool ?? detectDeckPool(), opts.seed) ?? [DEFAULT_DECK, DEFAULT_DECK];
  const zc: ZoneCounts = opts.zones === 5 ? ZONES_5 : DEFAULT_ZONES;
  const s: GameState = {
    cards: {},
    players: [emptyPlayer(0, zc), emptyPlayer(1, zc)],
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
  if (opts.zones === 5) s.zones = { ...ZONES_5 };
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
  r.checkWin();
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

function emptyPlayer(id: PlayerId, z: ZoneCounts = DEFAULT_ZONES): PlayerState {
  return {
    id,
    lp: START_LP,
    deck: [],
    hand: [],
    graveyard: [],
    monsters: Array.from({ length: z.monsters }, () => null),
    spellTraps: Array.from({ length: z.spellTraps }, () => null),
    fieldSpell: null,
    normalSummonUsed: false,
  };
}

// ---------------------------------------------------------------------------
// Continuation tasks (stored in state.internal.queue — plain data, structuredClone-safe)
// ---------------------------------------------------------------------------

type SummonMethod = 'normal' | 'tribute' | 'special' | 'flip';

type Task =
  /** chasm_trap / toppling_tower window after a Summon (`method` 'special': only toppling_tower looks). */
  | { k: 'summonWindow'; uid: Uid; method?: 'special' }
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
  /** ownSpellBurn300: a Spell was activated by `controller` while `uid` was face-up on their field. */
  | { k: 'spellBurn'; uid: Uid; controller: PlayerId }
  /** last_breath window: `player` (not the turn player) just dropped below 1500 LP from damage. */
  | { k: 'lpWindow'; player: PlayerId }
  /** An activated Spell waiting for the spell_seal window to close; resolved next unless negated. */
  | { k: 'spellResolve'; a: Extract<Action, { type: 'activateSpell' }>; fromHand: boolean; stZone: number | null }
  | { k: 'endPhase' }
  | { k: 'nextTurn' };

const ATTACK_TRAPS = [
  'attackDestroyAllAttackPosition',
  'attackNegateEndBattle',
  'attackBounceAttacker',
  'attackRedirect',
  'attackNegateAllDefense',
  'attackedBoost1000',
] as const;
const SUMMON_TRAPS = ['summonDestroy1000Plus', 'summonDestroy1800Plus'] as const;
const SPELL_NEGATE_TRAPS = ['spellActivateNegate'] as const;
const LP_TRAPS = ['lpBelow1500Gain1500'] as const;
/** last_breath: an LP drop from >= this value to below it opens the window. */
const LP_LOW = 1500;
/** toppling_tower: minimum current ATK of the summoned monster. */
const TOWER_MIN_ATK = 1800;

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
        return this.summonWindow(t.uid, t.method);
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
      case 'spellBurn': {
        const loc = findMonster(this.s, t.uid);
        if (!loc || !loc.slot.faceUp) return;
        this.activateMonsterEffect(t.uid, loc.player);
        this.damage(other(loc.player), 300, 'effect', t.uid);
        return;
      }
      case 'lpWindow':
        return this.lpWindow(t.player);
      case 'spellResolve':
        return this.resolveSpell(t.a, t.fromHand, t.stZone);
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
    this.checkSeals();
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
    if (s.winner !== null) return; // the draw completed the five seals
    this.setPhase('main');
  }

  private endPhase(): void {
    this.withStats(() => this.setPhase('end'));
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
    const before = ps.lp;
    ps.lp = Math.max(0, ps.lp - amount);
    this.emit({ type: 'damage', player: p, amount, source, sourceUid, lpAfter: ps.lp });
    // last_breath: the opponent's damage pushed this player under 1500 (and not to 0): open a window once the action settles
    if (before >= LP_LOW && ps.lp < LP_LOW && ps.lp > 0 && p !== this.s.activePlayer && respondableTraps(this.s, p, LP_TRAPS).length)
      this.queue.unshift({ k: 'lpWindow', player: p });
  }

  private lpWindow(p: PlayerId): void {
    const ps = this.ps(p);
    if (ps.lp <= 0 || ps.lp >= LP_LOW || p === this.s.activePlayer) return;
    const options = respondableTraps(this.s, p, LP_TRAPS);
    if (options.length) this.openPending({ kind: 'trapResponse', player: p, trigger: { kind: 'lpLow', player: p }, options });
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
    if (!dead0 && !dead1) {
      this.checkSeals();
      return;
    }
    // Both at 0 at the same time: the turn player wins.
    const winner: PlayerId = dead0 && dead1 ? s.activePlayer : dead0 ? 1 : 0;
    this.win(winner, 'lp');
  }

  /** sealSet: the instant a hand holds all five distinct seal cards its owner wins (turn player first). */
  checkSeals(): void {
    const s = this.s;
    if (s.winner !== null) return;
    for (const p of [s.activePlayer, other(s.activePlayer)])
      if (hasAllSeals(s, this.ps(p).hand)) {
        this.win(p, 'seals');
        return;
      }
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
  private destroyMonster(p: PlayerId, index: number, reason: DestroyReason, sourceUid: Uid | null): boolean {
    const slot = this.ps(p).monsters[index];
    if (!slot) return false;
    // guardian_charm: the equip is destroyed instead and the monster stays
    const shield = equipOfEffect(this.s, slot.uid, 'equipDestroyShield');
    if (shield) {
      this.breakShield(shield, sourceUid);
      return false;
    }
    this.withStats(() => {
      this.emit({ type: 'destroy', player: p, uid: slot.uid, cardId: this.cardId(slot.uid), location: 'monster', zone: index, reason, sourceUid });
      this.ps(p).monsters[index] = null;
      this.toGraveyard(slot.uid, 'monster', index);
      this.dropEquips(slot.uid);
    });
    return true;
  }

  /** The shield equip announces itself and is destroyed in place of its monster. */
  private breakShield(sh: SpellTrapLoc, sourceUid: Uid | null): void {
    this.withStats(() => {
      const cardId = this.cardId(sh.slot.uid);
      this.emit({ type: 'activate', player: sh.player, uid: sh.slot.uid, cardId, kind: 'spell', from: 'spellTrap', zone: sh.index });
      this.emit({ type: 'destroy', player: sh.player, uid: sh.slot.uid, cardId, location: 'spellTrap', zone: sh.index, reason: 'effect', sourceUid });
      this.ps(sh.player).spellTraps[sh.index] = null;
      this.toGraveyard(sh.slot.uid, 'spellTrap', sh.index);
    });
  }

  /** A monster goes back to its owner's hand (homecoming); its equips are destroyed by rule. */
  private returnToHand(p: PlayerId, index: number): void {
    const slot = this.ps(p).monsters[index];
    if (!slot) return;
    const owner = this.s.cards[slot.uid].owner;
    this.withStats(() => {
      this.ps(p).monsters[index] = null;
      this.ps(owner).hand.push(slot.uid);
      this.emit({ type: 'toHand', player: owner, uid: slot.uid, cardId: this.cardId(slot.uid), from: 'monster', zone: index });
      this.dropEquips(slot.uid);
    });
    this.checkSeals();
  }

  /** Remove the queued battle of `attackerUid` (the attack was negated). */
  private dropBattle(attackerUid: Uid): void {
    const q = this.queue;
    for (let i = q.length - 1; i >= 0; i--) {
      const t = q[i];
      if (t.k === 'battle' && t.attackerUid === attackerUid) q.splice(i, 1);
    }
  }

  /** tribute → toGraveyard, then its equips. */
  private tributeMonster(p: PlayerId, index: number, forUid: Uid): void {
    const slot = this.ps(p).monsters[index];
    if (!slot) return;
    this.withStats(() => {
      this.emit({ type: 'tribute', player: p, uid: slot.uid, cardId: this.cardId(slot.uid), zone: index, forUid });
      this.ps(p).monsters[index] = null;
      this.toGraveyard(slot.uid, 'monster', index);
      this.dropEquips(slot.uid);
    });
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
        return this.withStats(() => this.setPhase('battle'));
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
    this.withStats(() => this.summonFromHandBody(p, uid, zone, tributes, set));
  }

  private summonFromHandBody(p: PlayerId, uid: Uid, zone: number, tributes: Uid[], set: boolean): void {
    const s = this.s;
    const ps = this.ps(p);
    ps.hand.splice(ps.hand.indexOf(uid), 1);
    const tribs = tributes
      .map((t) => findMonster(s, t)!)
      .sort((a, b) => a.index - b.index);
    for (const t of tribs) this.tributeMonster(p, t.index, uid);
    if (ps.normalSummonUsed) ps.extraSummonTurn = s.turn; // festival_square: the extra Normal Summon / Set
    else ps.normalSummonUsed = true;
    if (set) {
      ps.monsters[zone] = { uid, position: 'defense', faceUp: false, enteredTurn: s.turn, attacksThisTurn: 0, positionChangedTurn: -1 };
      this.emit({ type: 'setMonster', player: p, uid, zone });
      return;
    }
    ps.monsters[zone] = { uid, position: 'attack', faceUp: true, enteredTurn: s.turn, attacksThisTurn: 0, positionChangedTurn: -1 };
    if (monsterDefOf(s, uid)?.effect === 'summonTurnAtk500') ps.monsters[zone]!.normalSummoned = true;
    const method: SummonMethod = tribs.length ? 'tribute' : 'normal';
    this.emit({ type: 'summon', player: p, uid, cardId: this.cardId(uid), zone, method, position: 'attack', from: 'hand', sourceUid: null });
    this.queue.unshift({ k: 'summonWindow', uid }, { k: 'summonTriggers', uid, method });
  }

  private flipSummon(p: PlayerId, zone: number): void {
    const slot = this.ps(p).monsters[zone]!;
    this.withStats(() => {
      slot.faceUp = true;
      slot.position = 'attack';
      slot.positionChangedTurn = this.s.turn;
      const cardId = this.cardId(slot.uid);
      this.emit({ type: 'flip', player: p, uid: slot.uid, cardId, zone, cause: 'flipSummon' });
      this.emit({ type: 'summon', player: p, uid: slot.uid, cardId, zone, method: 'flip', position: 'attack', from: 'field', sourceUid: null });
    });
    this.queue.unshift({ k: 'summonTriggers', uid: slot.uid, method: 'flip' });
  }

  private summonWindow(uid: Uid, method?: 'special'): void {
    const loc = findMonster(this.s, uid);
    if (!loc || !loc.slot.faceUp) return;
    const atk = qCurrentAtk(this.s, uid);
    if (atk < CHASM_MIN_ATK) return;
    const defender = other(loc.player);
    // chasm_trap: Normal / Tribute Summons with ATK >= 1000; toppling_tower: any Summon with ATK >= 1800
    const options = respondableTraps(this.s, defender, SUMMON_TRAPS).filter((u) =>
      trapDefOf(this.s, u)!.effect === 'summonDestroy1800Plus' ? atk >= TOWER_MIN_ATK : method !== 'special',
    );
    if (options.length)
      this.openPending({
        kind: 'trapResponse',
        player: defender,
        trigger: method === 'special' ? { kind: 'summoned', monsterUid: uid, method } : { kind: 'summoned', monsterUid: uid },
        options,
      });
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
      case 'summonFreezeAttack': {
        // the summoner picks one opposing monster (face-down ones too); none = no effect
        const candidates = monsterRefs(s, other(loc.player));
        if (candidates.length) this.openPending({ kind: 'chooseTarget', player: loc.player, sourceUid: uid, candidates });
        return;
      }
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
    } else if (d.spellType === 'equip') {
      const zone = fromHand ? a.zone! : stZone!;
      if (fromHand) ps.spellTraps[zone] = { uid: a.uid, faceUp: true, setTurn: -1, equippedTo: null };
      this.emit({ ...base, from, zone });
    } else {
      this.emit({ ...base, from, zone: null });
    }
    // spell_seal window: only opens when the opponent has a ready, unlocked counter trap
    const opp = other(p);
    const options = respondableTraps(s, opp, SPELL_NEGATE_TRAPS);
    if (options.length) {
      this.queue.unshift({ k: 'spellResolve', a, fromHand, stZone });
      this.openPending({ kind: 'trapResponse', player: opp, trigger: { kind: 'spellActivated', spellUid: a.uid, player: p }, options });
      return;
    }
    this.resolveSpell(a, fromHand, stZone);
  }

  /** ownSpellBurn300: face-up sorcerers on `p`'s field when a Spell is activated. */
  private spellBurners(p: PlayerId): Task[] {
    const s = this.s;
    return this.ps(p).monsters.flatMap((m): Task[] =>
      m && m.faceUp && monsterDefOf(s, m.uid)?.effect === 'ownSpellBurn300' ? [{ k: 'spellBurn', uid: m.uid, controller: p }] : [],
    );
  }

  /** The effect of an activated Spell (the `activate` event is already out). */
  private resolveSpell(a: Extract<Action, { type: 'activateSpell' }>, fromHand: boolean, stZone: number | null): void {
    const s = this.s;
    const p = a.player;
    const ps = this.ps(p);
    const d = spellDefOf(s, a.uid)!;
    const burners = this.spellBurners(p);

    if (d.spellType === 'normal') {
      const after: Task[] = [];
      let askDiscard = false;
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
          this.withStats(() => {
            ps.monsters[t.toZone] = { uid: t.uid, position: 'attack', faceUp: true, enteredTurn: s.turn, attacksThisTurn: 0, positionChangedTurn: -1 };
            this.emit({ type: 'summon', player: p, uid: t.uid, cardId: this.cardId(t.uid), zone: t.toZone, method: 'special', position: 'attack', from: 'graveyard', sourceUid: a.uid });
          });
          after.push({ k: 'summonWindow', uid: t.uid, method: 'special' }, { k: 'summonTriggers', uid: t.uid, method: 'special' });
          break;
        }
        case 'draw2Discard1':
          // draw 2 (a completed seal set wins on the spot), then discard 1 once the spell has left the chain
          this.drawCard(p, false);
          if (s.winner === null) this.drawCard(p, false);
          askDiscard = s.winner === null;
          break;
        case 'doubleTribute':
          ps.tributeHelperTurn = s.turn;
          break;
        case 'forceDefense': {
          const ref = (a.target as { kind: 'monster'; ref: ZoneRef }).ref;
          this.emit({ type: 'target', player: p, sourceUid: a.uid, targets: [{ ...ref }] });
          const slot = this.ps(ref.player).monsters[ref.index];
          if (slot) {
            slot.position = 'defense';
            slot.positionChangedTurn = s.turn;
            slot.lockPositionTurn = s.turn + 1; // the global turn counter: the controller's next turn
            this.emit({ type: 'positionChange', player: ref.player, uid: slot.uid, zone: ref.index, position: 'defense' });
          }
          break;
        }
        case 'recycleGraveyard': {
          // the last three cards of the graveyard (the spell itself has not landed there yet) go back to the deck
          const gy = ps.graveyard;
          const picked = gy.splice(Math.max(0, gy.length - 3), 3);
          for (const u of picked) {
            ps.deck.push(u);
            this.emit({ type: 'toDeck', owner: p, uid: u, cardId: this.cardId(u), from: 'graveyard' });
          }
          shuffleInPlace(s, ps.deck);
          this.emit({ type: 'shuffle', player: p });
          this.drawCard(p, false);
          break;
        }
        case 'atkBoostTurn': {
          const ref = (a.target as { kind: 'monster'; ref: ZoneRef }).ref;
          this.emit({ type: 'target', player: p, sourceUid: a.uid, targets: [{ ...ref }] });
          const slot = this.ps(ref.player).monsters[ref.index];
          if (slot) this.withStats(() => this.addBoost(slot, 1000, 0));
          break;
        }
        case 'destroyOpponentSpellTrap': {
          const ref = (a.target as { kind: 'card'; ref: ZoneRef }).ref;
          this.emit({ type: 'target', player: p, sourceUid: a.uid, targets: [{ ...ref }] });
          this.destroySpellTrap(ref, 'effect', a.uid);
          break;
        }
        default:
          break;
      }
      if (stZone !== null) ps.spellTraps[stZone] = null;
      this.toGraveyard(a.uid, 'resolved', stZone);
      if (askDiscard) this.openPending({ kind: 'discard', player: p, count: 1, cost: true });
      this.queue.unshift(...after, ...burners);
      return;
    }

    if (d.spellType === 'equip') {
      const zone = fromHand ? a.zone! : stZone!;
      const ref = (a.target as { kind: 'monster'; ref: ZoneRef }).ref;
      const targetUid = this.ps(ref.player).monsters[ref.index]!.uid;
      this.emit({ type: 'target', player: p, sourceUid: a.uid, targets: [{ ...ref }] });
      this.withStats(() => {
        ps.spellTraps[zone]!.equippedTo = targetUid;
        this.emit({ type: 'equip', player: p, spellUid: a.uid, spellZone: zone, targetUid });
      });
      this.queue.unshift(...burners);
      return;
    }

    // Field spell: only one on the whole field — the new one destroys any existing one.
    this.withStats(() => {
      for (const op of PLAYERS) if (this.ps(op).fieldSpell) this.destroySpellTrap({ player: op, zone: 'field', index: 0 }, 'rule', a.uid);
      ps.fieldSpell = { uid: a.uid, faceUp: true, setTurn: -1, equippedTo: null };
      this.emit({ type: 'fieldSpell', player: p, uid: a.uid, cardId: d.id, active: true });
    });
    this.queue.unshift(...burners);
  }

  /** Add a one-turn ATK / DEF boost to a monster slot (stacks within the same turn). */
  private addBoost(slot: MonsterSlot, atk: number, def: number): void {
    const same = slot.boostTurn === this.s.turn;
    slot.boostAtk = (same ? (slot.boostAtk ?? 0) : 0) + atk;
    slot.boostDef = (same ? (slot.boostDef ?? 0) : 0) + def;
    slot.boostTurn = this.s.turn;
  }

  /** spell_seal: the activation is negated; the Spell (hand, set card or placed equip) is destroyed. */
  private negateSpell(spellUid: Uid, activator: PlayerId, trapUid: Uid): void {
    const q = this.queue;
    const qi = q.findIndex((t) => t.k === 'spellResolve' && t.a.uid === spellUid);
    if (qi >= 0) q.splice(qi, 1);
    const zone = this.ps(activator).spellTraps.findIndex((st) => st?.uid === spellUid);
    if (zone >= 0) this.destroySpellTrap({ player: activator, zone: 'spellTrap', index: zone }, 'effect', trapUid);
    else this.toGraveyard(spellUid, 'resolved', null);
    this.queue.unshift(...this.spellBurners(activator)); // the Spell was activated: the sorcerer still burns
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
    const options = respondableTraps(this.s, defender, ATTACK_TRAPS).filter((u) => this.attackTrapUsable(u, defender, targetUid));
    if (options.length)
      this.openPending({ kind: 'trapResponse', player: defender, trigger: { kind: 'attackDeclared', attackerUid, targetUid }, options });
  }

  /** Can this set attack trap do anything right now? (decoy_target needs another monster, hidden_reinforcement a target.) */
  private attackTrapUsable(trapUid: Uid, defender: PlayerId, targetUid: Uid | null): boolean {
    switch (trapDefOf(this.s, trapUid)?.effect) {
      case 'attackRedirect':
        return monsterRefs(this.s, defender).some((r) => uidAt(this.s, r) !== targetUid);
      case 'attackedBoost1000':
        return targetUid !== null && findMonster(this.s, targetUid) !== null;
      default:
        return true;
    }
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
      case 'spellActivateNegate': {
        if (pd.trigger.kind === 'spellActivated') this.negateSpell(pd.trigger.spellUid, pd.trigger.player, uid);
        finish();
        return;
      }
      case 'attackBounceAttacker': {
        const attackerUid = pd.trigger.kind === 'attackDeclared' ? pd.trigger.attackerUid : -1;
        const aLoc = findMonster(s, attackerUid);
        if (aLoc) {
          this.emit({ type: 'attackNegated', player: other(p), attackerUid, byUid: uid });
          this.dropBattle(attackerUid);
          this.returnToHand(aLoc.player, aLoc.index);
        }
        finish();
        return;
      }
      case 'attackRedirect': {
        finish();
        const targetUid = pd.trigger.kind === 'attackDeclared' ? pd.trigger.targetUid : null;
        const candidates = monsterRefs(s, p).filter((r) => uidAt(s, r) !== targetUid);
        if (candidates.length) this.openPending({ kind: 'chooseTarget', player: p, sourceUid: uid, candidates });
        return;
      }
      case 'lpBelow1500Gain1500':
        this.gain(p, 1500, uid);
        finish();
        return;
      case 'attackNegateAllDefense': {
        const attackerUid = pd.trigger.kind === 'attackDeclared' ? pd.trigger.attackerUid : -1;
        this.emit({ type: 'attackNegated', player: other(p), attackerUid, byUid: uid });
        this.dropBattle(attackerUid);
        const atkSide = other(p);
        this.ps(atkSide).monsters.forEach((m, i) => {
          if (!m || !m.faceUp || m.position !== 'attack') return;
          m.position = 'defense';
          m.positionChangedTurn = s.turn;
          this.emit({ type: 'positionChange', player: atkSide, uid: m.uid, zone: i, position: 'defense' });
        });
        finish();
        return;
      }
      case 'attackedBoost1000': {
        const targetUid = pd.trigger.kind === 'attackDeclared' ? pd.trigger.targetUid : null;
        const tLoc = targetUid === null ? null : findMonster(s, targetUid);
        if (tLoc) {
          this.emit({ type: 'target', player: p, sourceUid: uid, targets: [{ player: tLoc.player, zone: 'monster', index: tLoc.index }] });
          this.withStats(() => this.addBoost(tLoc.slot, 1000, 1000));
        }
        finish();
        return;
      }
      case 'summonDestroy1000Plus':
      case 'summonDestroy1800Plus': {
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
    const srcDef = CARDS[s.cards[src].cardId];
    if (isTrap(srcDef)) {
      // decoy_target: the attack in the queue now aims at the chosen own monster
      if (srcDef.effect === 'attackRedirect') {
        const newUid = uidAt(s, ref);
        const battle = this.queue.find((t): t is Extract<Task, { k: 'battle' }> => t.k === 'battle');
        this.emit({ type: 'target', player: pd.player, sourceUid: src, targets: [{ player: ref.player, zone: ref.zone, index: ref.index }] });
        if (battle && newUid !== null) battle.targetUid = newUid;
      }
      return;
    }
    this.activateMonsterEffect(src, pd.player);
    this.emit({ type: 'target', player: pd.player, sourceUid: src, targets: [{ player: ref.player, zone: ref.zone, index: ref.index }] });
    if (monsterDefOf(s, src)?.effect === 'summonFreezeAttack') {
      // the target cannot attack on its controller's next turn (the global turn counter + 1)
      const slot = this.ps(ref.player).monsters[ref.index];
      if (slot) slot.noAttackTurn = s.turn + 1;
      return;
    }
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

    const nums = battleNumbers(s, attackerUid, targetUid);
    const atk = nums.atk;
    const tPos = tLoc.slot.position;
    const tVal = nums.targetValue!;
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
      if (hasPiercing(s, attackerUid)) {
        dmgTo = dp;
        dmg = atk - tVal;
      }
    } else if (atk < tVal) {
      dmgTo = ap;
      dmg = tVal - atk;
    }
    // guardian_charm: a monster that would be destroyed but wears the shield survives (the shield breaks in destroyMonster)
    const wouldKillT = killT;
    const wouldKillA = killA;
    if (killT && equipOfEffect(s, targetUid, 'equipDestroyShield')) killT = false;
    if (killA && equipOfEffect(s, attackerUid, 'equipDestroyShield')) killA = false;
    // wisp_imp: destroyed in battle -> its controller takes no damage from this battle
    let impUid: Uid | null = null;
    if (dmg > 0 && dmgTo === dp && killT && tDef.effect === 'noBattleDamageOnDestroy') impUid = targetUid;
    else if (dmg > 0 && dmgTo === ap && killA && aDef.effect === 'noBattleDamageOnDestroy') impUid = attackerUid;
    if (impUid !== null) {
      dmg = 0;
      dmgTo = null;
    }
    const result = killT && killA ? 'bothDestroyed' : killT ? 'targetDestroyed' : killA ? 'attackerDestroyed' : 'noDestroy';
    // contextual ATK debuffs (grim_warden on the target, shield_titan on the attacker) announce themselves
    if (nums.targetDebuffBy !== null) this.activateMonsterEffect(nums.targetDebuffBy, ap);
    if (nums.attackerDebuffBy !== null) this.activateMonsterEffect(nums.attackerDebuffBy, dp);
    this.emit({
      type: 'battle', player: ap, attackerUid, attackerZone: aLoc.index, targetUid, targetZone: tLoc.index,
      attackerAtk: atk, targetPosition: tPos, targetValue: tVal, result,
    });
    if (impUid !== null) this.activateMonsterEffect(impUid, impUid === targetUid ? dp : ap);
    if (dmgTo !== null) this.damage(dmgTo, dmg, 'battle', dmgTo === dp ? attackerUid : targetUid);
    if (wouldKillT) this.destroyMonster(dp, tLoc.index, 'battle', attackerUid);
    if (wouldKillA) this.destroyMonster(ap, aLoc.index, 'battle', targetUid);

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
