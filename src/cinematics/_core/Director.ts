// Director — plays one engine batch (the events of one apply()) as a sequence of cinematics.
//
//   await director.play(events, before, after);
//
// For each event that no earlier handler consumed, it builds the handler chain (registry.ts),
// runs the first handler with a CinematicContext, catches/logs any error and enforces a
// watchdog, then reconciles every view with the projected state up to the furthest finished
// event (views.sync) so the screen is right even if a cinematic skipped something or threw.
// After the batch it syncs to the engine's real `after` state.

import Phaser from 'phaser';
import { CARDS, isMonster, type CardDef, type CardId, type MonsterCardDef } from '../../data/cards';
import { currentAtk, currentDef, describeEvent, locate } from '../../engine';
import type { GameEvent, GameEventType, GameState, PlayerId, Uid } from '../../engine/types';
import { PAL } from '../../art/palette';
import { music, sfx } from '../../audio/sfx';
import type { DuelMode, Settings } from '../../scenes/launch';
import { safe, tween, wait } from '../../vfx/core';
import type { Disposable, DuelViews } from '../../duel/types';
import { buildChain, eventObservers, type CardHookKind, type ChainLink } from './registry';
import { projectBatch, stateDiff } from './project';
import type { CinematicContext, FindOpts, FocusOpts, When } from './types';

export interface DirectorDeps {
  scene: Phaser.Scene;
  views: DuelViews;
  mode: DuelMode;
  skipIntro: boolean;
  settings: Settings;
  /** Reconcile every view with `state` instantly. `final` = end of a batch (engine truth). */
  sync(state: GameState, final: boolean): void;
}

/** Max real (game-loop) time a single handler may take before the Director moves on. */
const WATCHDOG_MS = 20000;

interface Batch {
  events: readonly GameEvent[];
  before: GameState;
  after: GameState;
  snaps: GameState[];
  /** Started (cursor reached it, played, or consumed). */
  started: boolean[];
  logged: boolean[];
}

export interface HandlerError {
  event: GameEventType;
  index: number;
  handler: string;
  error: string;
}

export class Director {
  readonly scene: Phaser.Scene;
  readonly views: DuelViews;
  readonly mode: DuelMode;
  skipIntro: boolean;
  /** Handler errors (also console.error'd). */
  readonly errors: HandlerError[] = [];
  /** Handlers that hit the watchdog. */
  readonly timeouts: string[] = [];
  private readonly deps: DirectorDeps;
  private readonly kept = new Map<string, Disposable>();
  private holds = 0;
  private playing = 0;
  private stopped = false;
  private lastEvents: GameEvent[] = [];

  constructor(deps: DirectorDeps) {
    this.deps = deps;
    this.scene = deps.scene;
    this.views = deps.views;
    this.mode = deps.mode;
    this.skipIntro = deps.skipIntro;
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stop());
  }

  /** Stop playing (scene shutdown / restart): the current batch loop exits at the next event. */
  stop(): void {
    this.stopped = true;
    this.dropKept();
  }

  private get alive(): boolean {
    return !this.stopped && this.scene.sys.isActive();
  }

  get busy(): boolean {
    return this.playing > 0;
  }

  /** The events of the last batch played. */
  get last(): readonly GameEvent[] {
    return this.lastEvents;
  }

  /** Play a batch. Never rejects. */
  async play(events: readonly GameEvent[], before: GameState, after: GameState): Promise<void> {
    this.playing++;
    this.lastEvents = [...events];
    const batch: Batch = {
      events,
      before,
      after,
      snaps: projectBatch(before, events),
      started: events.map(() => false),
      logged: events.map(() => false),
    };
    try {
      for (let i = 0; i < events.length; i++) {
        if (!this.alive) return;
        if (!batch.started[i]) await this.runEvent(batch, i, {});
        if (!this.alive) return;
        this.logUpTo(batch, i);
        this.syncFrontier(batch);
      }
      const diff = stateDiff(batch.snaps[events.length], after);
      if (diff.length) console.warn('[director] projection drift:', diff.join('; '));
    } catch (e) {
      console.error('[director] batch failed', e);
    } finally {
      this.playing--;
      if (this.alive) {
        try {
          this.deps.sync(after, true);
        } catch (e) {
          console.error('[director] final sync failed', e);
        }
      }
      // handles kept for the next batch survive only across a pending decision (attack arrow
      // while the defender decides on a trap)
      if (!after.pending || !this.alive) this.dropKept();
    }
  }

  /** Destroy every kept handle (end of a batch, restart). */
  dropKept(): void {
    for (const h of this.kept.values()) {
      try {
        h.destroy();
      } catch {
        /* ignore */
      }
    }
    this.kept.clear();
  }

  /** Pause the watchdog while `p` waits for the user. */
  async userWait<T>(p: Promise<T>): Promise<T> {
    this.holds++;
    try {
      return await p;
    } finally {
      this.holds--;
    }
  }

  // ================================================================ internals

  private syncFrontier(b: Batch): void {
    let k = -1;
    while (k + 1 < b.events.length && b.started[k + 1]) k++;
    try {
      this.deps.sync(b.snaps[k + 1], false);
    } catch (e) {
      console.error('[director] sync failed', e);
    }
  }

  private logUpTo(b: Batch, i: number): void {
    for (let j = 0; j <= i; j++) {
      if (b.logged[j] || !b.started[j]) continue;
      b.logged[j] = true;
      const ev = b.events[j];
      let line: string | null = null;
      try {
        line = describeEvent(b.snaps[j], ev, b.events);
      } catch {
        line = null;
      }
      if (!line) continue;
      try {
        this.views.log.add(line, logColor(ev));
      } catch {
        /* log is cosmetic */
      }
    }
  }

  private runEvent(b: Batch, i: number, hints: Record<string, unknown>): Promise<void> {
    b.started[i] = true;
    const ev = b.events[i];
    const state = b.snaps[i];
    const chain = buildChain(ev.type, hookKeys(ev, state));
    const ctx = this.makeCtx(b, i, hints, chain);
    for (const obs of eventObservers()) {
      try {
        obs(ev, ctx as CinematicContext);
      } catch (e) {
        console.error('[director] observer failed', e);
      }
    }
    if (!chain.length) return Promise.resolve();
    return this.guard((ctx as unknown as { base(): Promise<void> }).base(), ev, i, chain[0].name);
  }

  private guard(p: Promise<void>, ev: GameEvent, i: number, name: string): Promise<void> {
    return new Promise<void>((resolve) => {
      let done = false;
      let acc = 0;
      const finish = () => {
        if (done) return;
        done = true;
        this.scene.events.off(Phaser.Scenes.Events.UPDATE, tick);
        resolve();
      };
      const tick = (_t: number, dt: number) => {
        if (this.holds > 0) return;
        acc += dt;
        if (acc > WATCHDOG_MS) {
          const msg = `${name} (${ev.type} #${i}) exceeded ${WATCHDOG_MS} ms`;
          console.error('[director] watchdog:', msg);
          this.timeouts.push(msg);
          finish();
        }
      };
      this.scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
      this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, finish);
      p.then(finish, (e) => {
        this.recordError(ev, i, name, e);
        finish();
      });
    });
  }

  private recordError(ev: GameEvent, i: number, name: string, e: unknown): void {
    const err = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e);
    console.error(`[cinematics] ${name} failed on ${ev.type} #${i}:`, e);
    this.errors.push({ event: ev.type, index: i, handler: name, error: err });
  }

  private makeCtx(b: Batch, index: number, hints: Record<string, unknown>, chain: ChainLink[]): CinematicContext {
    const dir = this;
    const scene = this.scene;
    const views = this.views;
    const snapAt = (i: number) => b.snaps[Math.max(0, Math.min(b.snaps.length - 1, i))];
    const pick = (when: When = 'now'): GameState =>
      when === 'now' ? b.snaps[index] : when === 'next' ? b.snaps[index + 1] : when === 'after' ? b.after : b.before;
    let link = 0;
    const ctx: CinematicContext & { base(): Promise<void> } = {
      scene,
      views,
      ev: b.events[index],
      index,
      events: b.events,
      before: b.before,
      after: b.after,
      state: b.snaps[index],
      stateNext: b.snaps[index + 1],
      stateAt: snapAt,
      hints,
      mode: this.mode,
      get viewer() {
        return views.info.viewer;
      },
      canSee: (p) => views.info.canSee(p),
      isHuman: (p) => views.info.isHuman(p),
      skipIntro: this.skipIntro,
      settings: this.deps.settings,
      cardId: (uid) => cardOf(b.snaps[index], uid) ?? cardOf(b.after, uid)!,
      card: (uid): CardDef => CARDS[ctx.cardId(uid)],
      monster: (uid): MonsterCardDef | null => {
        const d = CARDS[ctx.cardId(uid)];
        return d && isMonster(d) ? d : null;
      },
      owner: (uid) => (b.snaps[index].cards[uid] ?? b.after.cards[uid]).owner,
      atk: (uid, when) => safeStat(() => currentAtk(pick(when), uid)),
      def: (uid, when) => safeStat(() => currentDef(pick(when), uid)),
      locate: (uid, when) => {
        try {
          return locate(pick(when), uid);
        } catch {
          return null;
        }
      },
      unit: (uid) => views.field.unit(uid),
      tile: (uid) => views.field.tileOf(uid),
      peek: (n = 1) => b.events[index + n],
      find: (pred, opts: FindOpts = {}) => {
        for (let i = opts.from ?? index + 1; i < b.events.length; i++) {
          const ev = b.events[i];
          if (!opts.includeConsumed && b.started[i]) continue;
          if (pred(ev, i)) return i;
          if (opts.until?.(ev, i)) return -1;
        }
        return -1;
      },
      findType: (type, pred, opts: FindOpts = {}) =>
        ctx.find((ev, i) => ev.type === type && (!pred || pred(ev as never, i)), opts),
      consume: (n = 1) => {
        const out: GameEvent[] = [];
        for (let i = index + 1; i <= index + n && i < b.events.length; i++) {
          b.started[i] = true;
          out.push(b.events[i]);
        }
        return out;
      },
      consumeAt: (i) => {
        if (i >= 0 && i < b.events.length) b.started[i] = true;
      },
      isConsumed: (i) => !!b.started[i],
      play: (i, h = {}) => {
        if (i < 0 || i >= b.events.length) return Promise.resolve();
        if (b.started[i]) return Promise.resolve();
        return dir.runEvent(b, i, h);
      },
      base: () => {
        const l = chain[link++];
        if (!l) return Promise.resolve();
        try {
          const r = l.handler(ctx as never);
          return Promise.resolve(r).catch((e) => {
            // an error in a handler that a higher handler awaited via base(): log, keep going
            dir.recordError(b.events[index], index, l.name, e);
          });
        } catch (e) {
          dir.recordError(b.events[index], index, l.name, e);
          return Promise.resolve();
        }
      },
      sfx: (name, opts) => {
        try {
          sfx.play(name, opts);
        } catch {
          /* never break a cinematic */
        }
      },
      music,
      wait: (ms) => wait(scene, ms),
      tween: (cfg) => tween(scene, cfg),
      safe: (p) => safe(p),
      focus: (xy, opts?: FocusOpts) => views.camera.focus(xy, opts),
      unfocus: (ms) => views.camera.unfocus(ms),
      keep: (key, handle) => {
        const old = dir.kept.get(key);
        if (old && old !== handle) {
          try {
            old.destroy();
          } catch {
            /* ignore */
          }
        }
        dir.kept.set(key, handle);
      },
      take: (key) => {
        const h = dir.kept.get(key) ?? null;
        dir.kept.delete(key);
        return h;
      },
      log: (text, color = PAL.mist) => views.log.add(text, color),
      userWait: (p) => dir.userWait(p),
    };
    return ctx;
  }
}

function safeStat(fn: () => number): number {
  try {
    return fn();
  } catch {
    return 0;
  }
}

function cardOf(s: GameState, uid: Uid | null | undefined): CardId | null {
  if (uid === null || uid === undefined) return null;
  return s.cards[uid]?.cardId ?? null;
}

/** Card hook keys consulted for an event, in HOOK_KEYS precedence order. */
export function hookKeys(ev: GameEvent, s: GameState): [CardId, CardHookKind][] {
  const out: [CardId, CardHookKind][] = [];
  const push = (id: CardId | null, k: CardHookKind) => {
    if (id) out.push([id, k]);
  };
  switch (ev.type) {
    case 'summon':
      push(ev.cardId, 'summon');
      break;
    case 'flip':
      push(ev.cardId, 'flip');
      break;
    case 'tribute':
      push(cardOf(s, ev.forUid), 'tribute');
      push(ev.cardId, 'tributed');
      break;
    case 'attackDeclare':
      push(cardOf(s, ev.attackerUid), 'attackDeclare');
      break;
    case 'battle':
      push(cardOf(s, ev.attackerUid), 'attack');
      push(cardOf(s, ev.targetUid), 'defend');
      break;
    case 'activate':
      push(ev.cardId, ev.kind === 'monsterEffect' ? 'effect' : 'activate');
      break;
    case 'target':
      push(cardOf(s, ev.sourceUid), 'target');
      break;
    case 'destroy':
      push(ev.cardId, 'destroyed');
      push(cardOf(s, ev.sourceUid), 'destroys');
      break;
    case 'toGraveyard':
      push(ev.cardId, 'toGraveyard');
      break;
    case 'equip':
      push(cardOf(s, ev.spellUid), 'equip');
      break;
    case 'fieldSpell':
      push(ev.cardId, 'field');
      break;
    case 'statChange':
      push(cardOf(s, ev.uid), 'statChange');
      break;
    case 'damage':
      push(cardOf(s, ev.sourceUid), 'damage');
      break;
    case 'lpGain':
      push(cardOf(s, ev.sourceUid), 'lpGain');
      break;
    case 'discard':
      push(ev.cardId, 'discard');
      break;
    case 'attackNegated':
      push(cardOf(s, ev.byUid), 'negate');
      break;
    default:
      break;
  }
  return out;
}

function logColor(ev: GameEvent): PlayerId | number {
  switch (ev.type) {
    case 'gameOver':
      return PAL.gold3;
    case 'damage':
      return PAL.crim3;
    case 'lpGain':
      return PAL.leaf3;
    case 'destroy':
      return PAL.fire3;
    case 'toGraveyard':
      return ev.owner;
    case 'statChange':
      return ev.atk >= ev.prevAtk ? PAL.leaf3 : PAL.crim3;
    case 'decision':
      return ev.pending.player;
    default:
      return 'player' in ev ? ev.player : PAL.mist;
  }
}
