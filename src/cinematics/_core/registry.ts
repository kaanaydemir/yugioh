// Cinematic registry: which handler animates which engine event.
//
//   registerEvent('battle', async (ctx) => { ... })                // every battle
//   registerCardHook('crystal_wyrm', 'attack', async (ctx) => { ... })  // battles it attacks in
//   registerStrike('ember_wolf', async (s) => { ... s.impact() ... }) // only the strike motion
//
// For one event the Director builds a CHAIN of matching handlers and runs the first one.
// A handler may call `await ctx.base()` to run the next handler in the chain (middleware style),
// e.g. to add a flourish before/after the default, or to fall back for cases it does not cover.
//
// Chain order (first = runs first):
//   1. higher `priority` first (default 0; the built-in defaults use DEFAULT_PRIORITY = -100)
//   2. at equal priority, card hooks before event-type handlers (card hooks are more specific;
//      among card hooks, the order of the hook keys in HOOK_KEYS below)
//   3. at equal priority and specificity, the LATER registration first (overrides)
// So a new file that registers a card hook or an event handler at the default priority always
// replaces the built-in behaviour, whatever the import order.

import type { CardId, MonsterId } from '../../data/cards';
import type { GameEvent, GameEventType } from '../../engine/types';
import type { CinematicContext, StrikeArgs } from './types';

export type EventOf<T extends GameEventType> = Extract<GameEvent, { type: T }>;

/** A cinematic for one event. Resolve when the visuals for every event you handled are final. */
export type CinematicHandler<E extends GameEvent = GameEvent> = (ctx: CinematicContext<E>) => void | Promise<void>;

/**
 * Card hook kinds and the event each one receives. The hook is keyed by the card named below.
 * Hidden events (setMonster / setSpellTrap / draw) have no card hooks (the card is secret).
 */
export interface CardHookEvents {
  /** `summon` of the card (normal / tribute / special). Flip summons arrive as 'flip' (see there). */
  summon: EventOf<'summon'>;
  /**
   * `flip` of the card. cause 'flipSummon': the default also plays the paired `summon` event
   * right after it (consumed); cause 'attacked': the card is flipped face-up in defense before
   * damage calculation.
   */
  flip: EventOf<'flip'>;
  /** `tribute` event, keyed by the monster being TRIBUTE SUMMONED (ev.forUid) — its entrance. */
  tribute: EventOf<'tribute'>;
  /** `tribute` event, keyed by the monster being tributed (consulted after 'tribute'). */
  tributed: EventOf<'tribute'>;
  /** `attackDeclare`, keyed by the attacker. */
  attackDeclare: EventOf<'attackDeclare'>;
  /**
   * `battle`, keyed by the attacker. The default battle handler consumes the following battle
   * damage and battle destroy events (and plays them via ctx.play at the impact). If you only
   * want a different strike motion, use registerStrike instead.
   */
  attack: EventOf<'battle'>;
  /** `battle`, keyed by the attacked monster (consulted after 'attack'; not for direct attacks). */
  defend: EventOf<'battle'>;
  /** `activate` of a spell or trap card (kind 'spell' | 'trap'). */
  activate: EventOf<'activate'>;
  /** `activate` with kind 'monsterEffect', keyed by the monster (on-summon, battle triggers, FLIP). */
  effect: EventOf<'activate'>;
  /** `target`, keyed by the source card (ev.sourceUid). */
  target: EventOf<'target'>;
  /** `destroy` of the card (monster / spell / trap / field). */
  destroyed: EventOf<'destroy'>;
  /** `destroy` keyed by the card that caused it (ev.sourceUid: judgment_bolt, a trap, the battle winner...). */
  destroys: EventOf<'destroy'>;
  /** `toGraveyard` of the card. */
  toGraveyard: EventOf<'toGraveyard'>;
  /** `equip`, keyed by the equip spell. */
  equip: EventOf<'equip'>;
  /** `fieldSpell` (active or not), keyed by the field spell. */
  field: EventOf<'fieldSpell'>;
  /** `statChange` of the monster. */
  statChange: EventOf<'statChange'>;
  /** `damage`, keyed by the card that dealt it (ev.sourceUid; battle or effect). */
  damage: EventOf<'damage'>;
  /** `lpGain`, keyed by its source card (ev.sourceUid). */
  lpGain: EventOf<'lpGain'>;
  /** `discard` of the card from the hand. */
  discard: EventOf<'discard'>;
  /** `attackNegated`, keyed by the negating card (ev.byUid). */
  negate: EventOf<'attackNegated'>;
}

export type CardHookKind = keyof CardHookEvents;

/** Consultation order of hook kinds for the same event (earlier = more specific). */
export const HOOK_KEYS: readonly CardHookKind[] = [
  'summon',
  'flip',
  'tribute',
  'tributed',
  'attackDeclare',
  'attack',
  'defend',
  'activate',
  'effect',
  'target',
  'destroyed',
  'destroys',
  'toGraveyard',
  'equip',
  'field',
  'statChange',
  'damage',
  'lpGain',
  'discard',
  'negate',
];

/** Priority of every built-in default handler. */
export const DEFAULT_PRIORITY = -100;

export interface RegisterOpts {
  /** Higher runs first. Default 0. Built-in defaults use DEFAULT_PRIORITY (-100). */
  priority?: number;
  /** Label for logs / debugging (shows in __neon.duel.handlers()). */
  name?: string;
}

interface Entry {
  seq: number;
  priority: number;
  name: string;
  handler: CinematicHandler<never>;
}

let seq = 0;
const byType = new Map<GameEventType, Entry[]>();
const byCard = new Map<string, Entry[]>();
const strikes = new Map<MonsterId, (Entry & { fn: StrikeFn })[]>();
const observers: { seq: number; fn: EventObserver }[] = [];

function add(list: Map<string, Entry[]>, key: string, e: Entry): () => void {
  let arr = list.get(key);
  if (!arr) list.set(key, (arr = []));
  arr.push(e);
  return () => {
    const a = list.get(key);
    if (!a) return;
    const i = a.indexOf(e);
    if (i >= 0) a.splice(i, 1);
  };
}

/** Animate every event of `type`. Returns an unregister function. */
export function registerEvent<T extends GameEventType>(type: T, handler: CinematicHandler<EventOf<T>>, opts: RegisterOpts = {}): () => void {
  const e: Entry = { seq: ++seq, priority: opts.priority ?? 0, name: opts.name ?? `event:${type}#${seq}`, handler: handler as CinematicHandler<never> };
  return add(byType as Map<string, Entry[]>, type, e);
}

/** Animate the events of one card (see CardHookEvents for what each kind receives). */
export function registerCardHook<K extends CardHookKind>(cardId: CardId, kind: K, handler: CinematicHandler<CardHookEvents[K]>, opts: RegisterOpts = {}): () => void {
  const e: Entry = { seq: ++seq, priority: opts.priority ?? 0, name: opts.name ?? `card:${cardId}:${kind}#${seq}`, handler: handler as CinematicHandler<never> };
  return add(byCard, `${cardId}|${kind}`, e);
}

/** The strike motion of a monster's attack (used by the default battle choreography). */
export type StrikeFn = (s: StrikeArgs) => Promise<void>;

/**
 * Replace only the attack MOTION of a monster: the default battle handler still handles the
 * arrow clean-up, outcome choreography, damage numbers, LP and destruction. Your function must
 * call `s.impact()` once at the moment of contact and resolve when the attacker is back home.
 */
export function registerStrike(monsterId: MonsterId, fn: StrikeFn, opts: RegisterOpts = {}): () => void {
  const e = { seq: ++seq, priority: opts.priority ?? 0, name: opts.name ?? `strike:${monsterId}#${seq}`, handler: (() => undefined) as CinematicHandler<never>, fn };
  let arr = strikes.get(monsterId);
  if (!arr) strikes.set(monsterId, (arr = []));
  arr.push(e);
  return () => {
    const a = strikes.get(monsterId);
    const i = a ? a.indexOf(e) : -1;
    if (a && i >= 0) a.splice(i, 1);
  };
}

/** The winning strike for a monster (null = none registered; the battle handler falls back). */
export function strikeFor(monsterId: MonsterId): StrikeFn | null {
  const arr = strikes.get(monsterId);
  if (!arr || !arr.length) return null;
  const best = [...arr].sort((a, b) => b.priority - a.priority || b.seq - a.seq)[0];
  return best.fn;
}

/**
 * Called synchronously for EVERY event when it starts (reached by the Director or played /
 * consumed by a handler) — before any handler. For bookkeeping (music intensity, stats), not
 * for animation.
 */
export type EventObserver = (ev: GameEvent, ctx: CinematicContext) => void;

export function registerObserver(fn: EventObserver): () => void {
  const o = { seq: ++seq, fn };
  observers.push(o);
  return () => {
    const i = observers.indexOf(o);
    if (i >= 0) observers.splice(i, 1);
  };
}

export function eventObservers(): readonly EventObserver[] {
  return observers.map((o) => o.fn);
}

export interface ChainLink {
  name: string;
  handler: CinematicHandler<never>;
}

/** Build the handler chain for an event given its card hook keys (in HOOK_KEYS order). */
export function buildChain(type: GameEventType, hooks: readonly (readonly [CardId, CardHookKind])[]): ChainLink[] {
  const cands: { e: Entry; spec: number; order: number }[] = [];
  hooks.forEach(([id, kind], i) => {
    for (const e of byCard.get(`${id}|${kind}`) ?? []) cands.push({ e, spec: 1, order: i });
  });
  for (const e of byType.get(type) ?? []) cands.push({ e, spec: 0, order: 0 });
  cands.sort((a, b) => b.e.priority - a.e.priority || b.spec - a.spec || a.order - b.order || b.e.seq - a.e.seq);
  return cands.map((c) => ({ name: c.e.name, handler: c.e.handler }));
}

/** Debug listing of everything registered. */
export function listHandlers(): { events: Record<string, string[]>; cards: Record<string, string[]>; strikes: Record<string, string[]> } {
  const events: Record<string, string[]> = {};
  for (const [k, v] of byType) events[k] = [...v].sort((a, b) => b.priority - a.priority || b.seq - a.seq).map((e) => `${e.name} (p${e.priority})`);
  const cards: Record<string, string[]> = {};
  for (const [k, v] of byCard) cards[k] = [...v].sort((a, b) => b.priority - a.priority || b.seq - a.seq).map((e) => `${e.name} (p${e.priority})`);
  const st: Record<string, string[]> = {};
  for (const [k, v] of strikes) st[k] = [...v].sort((a, b) => b.priority - a.priority || b.seq - a.seq).map((e) => `${e.name} (p${e.priority})`);
  return { events, cards, strikes: st };
}
