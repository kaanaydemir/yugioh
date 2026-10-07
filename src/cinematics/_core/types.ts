// CinematicContext — everything a cinematic handler gets for one engine event.
import type Phaser from 'phaser';
import type { CardDef, CardId, MonsterCardDef } from '../../data/cards';
import type { GameEvent, GameEventType, GameState, PlayerId, Uid, ZoneRef } from '../../engine/types';
import type { SfxName, SfxOpts, music } from '../../audio/sfx';
import type { DuelMode, Settings } from '../../scenes/launch';
import type { XY } from '../../view/layout';
import type { TileCard } from '../../view/TileCard';
import type { DuelViews, Disposable } from '../../duel/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';

/**
 * Which moment a stat / location query refers to:
 *  - 'now'  (default) the projected state right BEFORE this event
 *  - 'next' right AFTER this event
 *  - 'after' the engine's state at the end of the whole batch
 *  - 'before' the engine's state at the start of the batch
 */
export type When = 'now' | 'next' | 'after' | 'before';

export interface FindOpts {
  /** First index to look at (default: ctx.index + 1). */
  from?: number;
  /** Stop searching (return -1) when this returns true for an event before a match. */
  until?: (ev: GameEvent, i: number) => boolean;
  /** Also match events that were already consumed / played (default false). */
  includeConsumed?: boolean;
}

export interface FocusOpts {
  /** Camera zoom (1 = none). Default 1.06. The bible allows 1.0 → 1.08. */
  zoom?: number;
  /** Tween time (default 260 ms). */
  ms?: number;
  /** How far toward the point to pan (0..1 of the offset from the screen centre, default 0.35). */
  pan?: number;
}

export interface CinematicContext<E extends GameEvent = GameEvent> {
  readonly scene: Phaser.Scene;
  readonly views: DuelViews;
  /** The event this handler animates. */
  readonly ev: E;
  /** Its index in `events`. */
  readonly index: number;
  /** The whole batch returned by one engine.apply (or newGame). */
  readonly events: readonly GameEvent[];
  /** Engine state before / after the whole batch. */
  readonly before: GameState;
  readonly after: GameState;
  /** Projected state right before this event (all earlier events of the batch applied). */
  readonly state: GameState;
  /** Projected state right after this event. */
  readonly stateNext: GameState;
  /** Projected state right before events[i] (i = events.length → end of the batch). */
  stateAt(i: number): GameState;
  /** Extra data passed by a handler that played this event with ctx.play(i, hints). */
  readonly hints: Readonly<Record<string, unknown>>;

  // ---- hidden information ------------------------------------------------------------
  readonly mode: DuelMode;
  /** The player whose hand is on screen (hot-seat: who holds the device). */
  readonly viewer: PlayerId;
  /** True if `player`'s private cards (hand, draws) may be shown face-up right now. */
  canSee(player: PlayerId): boolean;
  isHuman(player: PlayerId): boolean;
  /** Opening cinematic requested to be skipped (QA / quick restart). */
  readonly skipIntro: boolean;
  /** Player settings (speed, sound, music, curtain). Respect `music` before music.play(). */
  readonly settings: Settings;

  // ---- lookups -------------------------------------------------------------------------
  cardId(uid: Uid): CardId;
  card(uid: Uid): CardDef;
  /** Monster definition, or null when the card is not a monster. */
  monster(uid: Uid): MonsterCardDef | null;
  owner(uid: Uid): PlayerId;
  /** Current ATK / DEF (equips + field spell) at the given moment. */
  atk(uid: Uid, when?: When): number;
  def(uid: Uid, when?: When): number;
  /** Field location at the given moment (null when not on the field). */
  locate(uid: Uid, when?: When): ZoneRef | null;
  /** The monster unit on screen (sprite + badge) for a uid, or null. */
  unit(uid: Uid): MonsterUnit | null;
  /** The TileCard on screen for a uid (monster / spell-trap / field zone), or null. */
  tile(uid: Uid): TileCard | null;

  // ---- the event queue -------------------------------------------------------------
  /** events[index + n] (raw, consumed or not). */
  peek(n?: number): GameEvent | undefined;
  /** Index of the next event matching `pred` (see FindOpts), or -1. */
  find(pred: (ev: GameEvent, i: number) => boolean, opts?: FindOpts): number;
  /** Typed helper: the next unconsumed event of `type` matching `pred` before `until`, or -1. */
  findType<T extends GameEventType>(type: T, pred?: (ev: Extract<GameEvent, { type: T }>, i: number) => boolean, opts?: FindOpts): number;
  /** Mark events[index+1 .. index+n] consumed (the Director will not play them). Returns them. */
  consume(n?: number): GameEvent[];
  /** Mark one later event consumed without playing it (you animated it yourself). */
  consumeAt(i: number): void;
  isConsumed(i: number): boolean;
  /**
   * Run the full handler chain of a later event NOW (card hooks, overrides, defaults) and mark
   * it consumed. `hints` reach that handler as ctx.hints (e.g. { at: hitPoint }). Await it.
   */
  play(i: number, hints?: Record<string, unknown>): Promise<void>;
  /** Run the next (lower) handler in this event's chain. No-op at the end of the chain. */
  base(): Promise<void>;

  // ---- presentation helpers -------------------------------------------------------
  sfx(name: SfxName, opts?: SfxOpts): void;
  readonly music: typeof music;
  /** Scene-time wait (respects speed and hit-stop). */
  wait(ms: number): Promise<void>;
  tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void>;
  /** Swallow errors of a fire-and-forget promise (logged). */
  safe(p: Promise<unknown>): Promise<void>;
  /** Camera: zoom/pan the world camera toward a point (HUD stays put). */
  focus(xy: XY, opts?: FocusOpts): Promise<void>;
  unfocus(ms?: number): Promise<void>;
  /** Keep a handle alive across events / batches (e.g. 'attackArrow'); replaces (destroys) an older one. */
  keep(key: string, handle: Disposable): void;
  /** Take back a kept handle (null if none). The caller destroys it. */
  take(key: string): Disposable | null;
  /** Append a line to the battle log. */
  log(text: string, color?: PlayerId | number): void;
  /** Pause the handler watchdog while waiting for the user (curtain, prompt). */
  userWait<T>(p: Promise<T>): Promise<T>;
}

/** Arguments of a strike (registerStrike): the attack MOTION inside the default battle handler. */
export interface StrikeArgs {
  ctx: CinematicContext<Extract<GameEvent, { type: 'battle' }>>;
  scene: Phaser.Scene;
  attacker: MonsterUnit;
  /** The attacked monster, or null for a direct attack. */
  target: MonsterUnit | null;
  /** Aim point: the target's core, or the defending duelist for a direct attack. */
  to: XY;
  /** Floor point under `to` (target tile centre, or the duelist podium). */
  toGround: XY;
  direct: boolean;
  /** The attack bounces (defender survives with DEF ≥ ATK, or the attacker loses). */
  blocked: boolean;
  /** Suggested impact power from the damage / outcome (1 light … 3 heavy). */
  power: 1 | 2 | 3;
  /** Call once at the moment of contact (later calls are ignored). Optional point override. */
  impact(at?: XY): void;
  /** Resolves when impact() has been called. */
  readonly impacted: Promise<void>;
}
