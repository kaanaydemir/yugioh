// ShowClock — the single "show" clock of a scene (v3 plan §0 "Zaman", A1 item 6;
// docs/v3/A0_ENVANTER.md §5.2, docs/v3/a0/altyapi-olcum.md §4.1).
//
//   const clock = showClock(scene);          // one per scene, made on first use, gone on SHUTDOWN
//   clock.setSpeed(3);                       // 1× / 2× / 3× × fast-forward × slow motion (SpeedControl)
//   await clock.freeze(80);                  // hit-stop (core.hitStop, combat.stopTime, setpieces.freeze)
//   const resume = clock.pause(); … resume(); // the duel menu (HumanInput; the v3 look only)
//
// It is the only writer of Phaser's three time scales (tweens.timeScale, time.timeScale,
// anims.globalTimeScale). Every tween, timer, sprite anim and custom frame clock of the game reads
// one of them, so all of them follow:
//
//   scale = paused ? 0 : frozen ? 0 : speed
//
// • speed  — set by SpeedControl every frame (setting × fast-forward × slow motion) or by
//            core.setSpeed. Changing it during a freeze / pause only takes effect when time flows
//            again, and it is never lost (no save / restore pairs).
// • freeze — hit-stop for `ms` of REAL time (unscaled loop delta, like before). Overlapping calls
//            merge into ONE freeze that ends when the longest is over, and every caller resolves
//            then. So hit-stops nest safely: none can restore a 0 (stuck scene).
//            The countdown runs in an UPDATE listener added when the freeze starts — the same
//            listener order as the old stopTime / core.hitStop, so cinematic timings do not move.
//            How the speed comes back (`legacyThaw`):
//              v3 look (false): the current speed, at once.
//              v1 / v2 (no look switch, true): exactly the old save / restore pair. The speed the
//              stop BEGAN with comes back — for combat.stopTime at once (the rest of that frame),
//              for core.hitStop at the end of that frame (its `await` continuation) — and holds
//              until SpeedControl writes the current one at the next frame's PRE_UPDATE. So a
//              slowMo called during a stop (gameOver's 0.7 inside directHit's 110 ms stop) starts
//              one frame late, as it always did: the "one-frame drift" of A0 §5.2, kept in v1 so
//              old monsters keep identical timings.
// • pause  — the duel menu (Esc / ≡; only the v3 look pauses, v1 / v2 never do). Nested-safe
//            (counted). The show stops: scales 0, the hit-stop countdown and SpeedControl's
//            slow-motion countdown wait, show time stops.
//            Tweens and timers CREATED while paused (the menu itself, its confirm prompt, button
//            feedback) are stepped by the clock at 1× real time, so the menu stays alive.
//
// Show time: `now` advances by the frame delta × scale (what scene.time sees). `fxNow` is the
// time of the two effects that used to ignore the clock — the hologram shader's uTime and camera
// shake — and advances by the loop time × `fxScale`:
//   • v3 look (`strictFx`, default LOOK_V3): fxScale = scale. Hit-stop freezes the hologram scan
//     and holds the shake (the freeze frame keeps the shake's first offset: the impact "kick");
//     3× shortens a shake to 1/3 and the menu pause stops both.
//   • v1 / v2 (no look switch): fxScale = 1 — real time, exactly as before (fxNow ===
//     game.loop.time; a shake lasts its ms of real time at any speed and runs through hit-stops).
//
// • tempo  — the v3 look's presentation tempo (owner feedback "animations far too fast even at
//            1×", docs/v3/TEMPO.md): while a cinematic plays, SpeedControl sets tempo = V3_TEMPO
//            (default 1.35) and every show clock runs `tempo` times longer:
//              scale = speed / tempo, and a hit-stop of `ms` freezes for ms × tempo × V3_HIT_HOLD
//              (1.15: the impact frame gets a touch more than the rest) of real time.
//            The speed setting (1× / 2× / 3×), fast-forward and slow motion still multiply on top.
//            Between cinematics (the player's own input: hover, menus) tempo is 1. v1 / v2 never
//            set it: tempo stays exactly 1 and no division happens (byte / timing identical).
//
// No runtime Phaser import (type-only), so the clock is unit-tested in node (tests/duel/showclock.test.ts).

import type Phaser from 'phaser';
import { LOOK_V3 } from '../view/layout';

/** Phaser.Scenes.Events names (string values; no runtime Phaser import). */
const EV_UPDATE = 'update';
const EV_SHUTDOWN = 'shutdown';
const EV_DESTROY = 'destroy';

// ------------------------------------------------------------------ Phaser internals we touch

interface TweenLike {
  update(delta: number): boolean;
  isPendingRemove(): boolean;
  isDestroyed(): boolean;
  destroy(): void;
}
interface TimerLike {
  paused: boolean;
}
interface ShakeEffectLike {
  isRunning: boolean;
  update(time: number, delta: number): void;
  _elapsed: number;
}
interface SceneInternals {
  tweens: { timeScale: number; tweens?: TweenLike[]; processing?: boolean };
  time: { timeScale: number; update(time: number, delta: number): void; _active?: TimerLike[]; _pendingInsertion?: TimerLike[] };
  anims: { globalTimeScale: number };
  events: {
    on(e: string, fn: (...a: never[]) => void): unknown;
    once(e: string, fn: (...a: never[]) => void): unknown;
    off(e: string, fn: (...a: never[]) => void): unknown;
  };
  game: { loop: { time: number } };
}

/** What a QA tool reads (window.__neon.showClock('Duel')). */
export interface ShowClockSnapshot {
  now: number;
  fxNow: number;
  scale: number;
  fxScale: number;
  speed: number;
  userSpeed: number;
  frozen: boolean;
  freezeLeft: number;
  paused: boolean;
  pauses: number;
  strictFx: boolean;
  /** The v3 presentation tempo now (1 = none; see the header). */
  tempo: number;
}

/** Who started a freeze: combat.stopTime / setpieces.freeze ('stop') or core.hitStop ('hit'). */
export type FreezeKind = 'stop' | 'hit';

interface FreezeState {
  remaining: number;
  waiters: (() => void)[];
  end: () => void;
  /** The scale when it began (0 → 1, as the old stopTime saved it): what legacyThaw restores. */
  saved: number;
  kind: FreezeKind;
}

interface PauseState {
  tweens: WeakSet<object>;
  timers: WeakSet<object>;
}

const clocks = new WeakMap<object, ShowClock>();

export class ShowClock {
  readonly scene: Phaser.Scene;
  /**
   * Shake and hologram follow the full show clock (hit-stop, slow motion) — the v3 look — instead
   * of real time × the user speed (v1: unchanged at 1×). See the header.
   */
  strictFx: boolean = LOOK_V3;
  /**
   * v1 / v2 (default without the look switch): when a freeze ends, the speed it began with comes
   * back until the next setSpeed — the old stopTime / hitStop save-restore, see the header. The v3
   * look: the current speed comes back at once.
   */
  legacyThaw: boolean = !LOOK_V3;
  /** Show time (ms): frame delta × scale. Starts at game.loop.time. */
  now: number;
  private _speed = 1;
  private _userSpeed = 1;
  private _tempo = 1;
  private _freezeTempo = 1;
  private fz: FreezeState | null = null;
  /** legacyThaw: the scale written after a freeze ended, until the next setSpeed (null = none). */
  private thaw: number | null = null;
  /** Identifies the pending end-of-frame restore of a core.hitStop thaw. */
  private thawToken: object | null = null;
  private pauses = 0;
  private ps: PauseState | null = null;
  private fxOffset = 0;
  private lastLoop: number;
  private disposed = false;
  private readonly s: SceneInternals;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const s = scene as unknown as SceneInternals;
    this.s = s;
    // adopt whatever speed is set (a scene that set its speed before the clock existed)
    const k = s.tweens.timeScale;
    this._speed = this._userSpeed = Number.isFinite(k) && k > 0 ? k : 1;
    this.now = this.lastLoop = s.game.loop.time;
    s.events.on(EV_UPDATE, this.tick);
    s.events.once(EV_SHUTDOWN, this.dispose);
    s.events.once(EV_DESTROY, this.dispose);
  }

  // ---------------------------------------------------------------- state

  /** The time scale every Phaser clock runs at now (0 while frozen or paused). */
  get scale(): number {
    if (this.pauses > 0 || this.fz) return 0;
    const k = this.thaw ?? this._speed;
    return this._tempo === 1 ? k : k / this._tempo;
  }

  /**
   * The scale the show runs at whenever time flows (speed / tempo; ignores a freeze or pause).
   * What a clock that runs THROUGH a hit-stop at the show's pace uses (_v3/number.ts).
   */
  get flowScale(): number {
    return this._tempo === 1 ? this._speed : this._speed / this._tempo;
  }

  /** The v3 presentation tempo now (1 = none). */
  get tempo(): number {
    return this._tempo;
  }

  /** The scale of the hologram time and camera shakes (see the header). */
  get fxScale(): number {
    return this.strictFx ? this.scale : 1;
  }

  /** Hologram / shake time (ms). v1 / v2: exactly game.loop.time. */
  get fxNow(): number {
    return this.s.game.loop.time + this.fxOffset;
  }

  /** Playback speed when time flows (1 = normal). */
  get speed(): number {
    return this._speed;
  }

  get frozen(): boolean {
    return this.fz !== null;
  }

  get paused(): boolean {
    return this.pauses > 0;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  snapshot(): ShowClockSnapshot {
    return {
      now: this.now,
      fxNow: this.fxNow,
      scale: this.scale,
      fxScale: this.fxScale,
      speed: this._speed,
      userSpeed: this._userSpeed,
      frozen: this.frozen,
      freezeLeft: this.fz ? this.fz.remaining : 0,
      paused: this.paused,
      pauses: this.pauses,
      strictFx: this.strictFx,
      tempo: this._tempo,
    };
  }

  // ---------------------------------------------------------------- speed

  /**
   * Playback speed. `user` = the part the player chose (setting × fast-forward, without slow
   * motion; default k) — what v1 shakes / holograms follow.
   */
  setSpeed(k: number, user: number = k): void {
    const v = Number.isFinite(k) && k >= 0 ? k : 1;
    if (this.disposed) {
      // the scene is gone (SpeedControl's own SHUTDOWN reset): plain write, nothing kept
      writeScales(this.s, v);
      return;
    }
    this._speed = v;
    this._userSpeed = Number.isFinite(user) && user >= 0 ? user : v;
    this.thaw = null;
    this.thawToken = null;
    this.write();
  }

  /**
   * The v3 presentation tempo (≥ 1 makes the show longer; 1 = none). SpeedControl sets it every
   * frame: V3_TEMPO while a cinematic plays, else 1. `freeze` is the factor a hit-stop's ms is
   * stretched by (default `t`; the v3 look gives the impact frame a little extra on top). A freeze
   * already running keeps its length.
   */
  setTempo(t: number, freeze: number = t): void {
    if (this.disposed) return;
    const v = Number.isFinite(t) && t > 0 ? t : 1;
    this._freezeTempo = v === 1 ? 1 : Number.isFinite(freeze) && freeze > 0 ? freeze : v;
    if (v === this._tempo) return;
    this._tempo = v;
    this.write();
  }

  // ---------------------------------------------------------------- hit-stop

  /**
   * Hit-stop: freeze the show for `ms` of real time. Nesting-safe — a call during a freeze extends
   * it to the longer of the two and resolves with it. A pause stops the countdown. `kind` only
   * matters with legacyThaw: when the old pair would have restored the speed (see the header).
   */
  freeze(ms: number, kind: FreezeKind = 'stop'): Promise<void> {
    if (!(ms > 0) || this.disposed) return Promise.resolve();
    // the v3 tempo: a hit-stop holds `tempo` times longer, like everything else of the show
    if (this._freezeTempo !== 1) ms *= this._freezeTempo;
    const cur = this.fz;
    if (cur) {
      cur.remaining = Math.max(cur.remaining, ms);
      return new Promise((r) => cur.waiters.push(r));
    }
    const ev = this.s.events;
    const upd = (_t: number, delta: number) => {
      if (this.pauses > 0) return;
      st.remaining -= delta;
      if (st.remaining <= 0) st.end();
    };
    // the speed (before the tempo divides it; equal to the old `this.scale` whenever tempo is 1)
    const saved = this.pauses > 0 ? 0 : (this.thaw ?? this._speed);
    const st: FreezeState = {
      remaining: ms,
      waiters: [],
      saved: saved > 0 ? saved : 1,
      kind,
      end: () => {
        if (this.fz !== st) return;
        ev.off(EV_UPDATE, upd);
        this.fz = null;
        if (this.legacyThaw && !this.disposed) this.legacyRestore(st);
        this.write();
        for (const w of st.waiters.splice(0)) w();
      },
    };
    this.thaw = null;
    this.thawToken = null;
    this.fz = st;
    this.write();
    return new Promise((resolve) => {
      st.waiters.push(resolve);
      ev.on(EV_UPDATE, upd);
    });
  }

  // ---------------------------------------------------------------- pause

  /**
   * Pause the show (the duel menu). Returns the release function (idempotent). Pauses nest: the
   * show resumes when every one is released. Tweens / timers made while paused run at 1×.
   */
  pause(): () => void {
    if (this.disposed) return () => undefined;
    this.pauses++;
    if (this.pauses === 1) {
      const s = this.s;
      const timers = new WeakSet<object>();
      for (const e of s.time._active ?? []) timers.add(e);
      for (const e of s.time._pendingInsertion ?? []) timers.add(e);
      this.ps = { tweens: new WeakSet<object>(s.tweens.tweens ?? []), timers };
      this.write();
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (this.disposed || this.pauses <= 0) return;
      this.pauses--;
      if (this.pauses === 0) {
        this.ps = null;
        this.write();
      }
    };
  }

  // ---------------------------------------------------------------- camera shake

  /**
   * Put a camera's shake effect on the show clock: its time advances by delta × fxScale (3× →
   * a third as long; paused → held). With strictFx a hit-stop holds it; a shake that starts inside
   * a freeze gets its first offset at once, so the freeze frame shows the kick. Idempotent.
   */
  bindShake(cam: Phaser.Cameras.Scene2D.Camera): void {
    bindShakeEffect(cam as unknown as { scene: object; shakeEffect?: ShakeEffectLike });
  }

  // ---------------------------------------------------------------- internals

  /**
   * legacyThaw: the old restore of a freeze that just ended. combat.stopTime restored the speed it
   * saved right in its UPDATE listener; core.hitStop restored it after `await realWait()`, i.e.
   * once the frame's synchronous work was over (a microtask) — the rest of that frame stays at 0.
   * Either holds until the next setSpeed (SpeedControl, next PRE_UPDATE).
   */
  private legacyRestore(st: FreezeState): void {
    if (st.kind === 'stop') {
      this.thaw = st.saved;
      return;
    }
    this.thaw = 0;
    const token = {};
    this.thawToken = token;
    queueMicrotask(() => {
      if (this.thawToken !== token || this.disposed || this.fz) return;
      this.thawToken = null;
      this.thaw = st.saved;
      this.write();
    });
  }

  private write(): void {
    if (this.disposed) return;
    writeScales(this.s, this.scale);
  }

  private readonly tick = (time: number, delta: number): void => {
    if (this.disposed) return;
    const lt = this.s.game.loop.time;
    const d = lt - this.lastLoop;
    this.lastLoop = lt;
    const fx = this.fxScale;
    if (fx !== 1 && d > 0) this.fxOffset += d * (fx - 1);
    this.now += delta * this.scale;
    if (this.ps) this.stepPaused(time, delta);
  };

  /** While paused: step what the menu created (tweens, timers) at 1×; the rest stays frozen. */
  private stepPaused(time: number, delta: number): void {
    const ps = this.ps!;
    const s = this.s;
    const tm = s.tweens;
    const list = tm.tweens;
    if (list && list.length) {
      const live = list.filter((t) => !ps.tweens.has(t));
      if (live.length) {
        const processing = tm.processing;
        tm.timeScale = 1;
        tm.processing = true;
        const done: TweenLike[] = [];
        try {
          for (const t of live) {
            try {
              if (t.update(delta)) done.push(t);
            } catch (e) {
              console.error('[showclock] tween', e);
            }
          }
        } finally {
          tm.processing = processing;
        }
        // the clean-up of TweenManager.step
        for (const t of done) {
          const i = list.indexOf(t);
          if (i > -1 && (t.isPendingRemove() || t.isDestroyed())) {
            list.splice(i, 1);
            t.destroy();
          }
        }
      }
    }
    const clock = s.time;
    const active = clock._active;
    if (active && active.some((e) => !ps.timers.has(e))) {
      const held: TimerLike[] = [];
      for (const e of active) {
        if (ps.timers.has(e) && !e.paused) {
          e.paused = true;
          held.push(e);
        }
      }
      clock.timeScale = 1;
      try {
        clock.update(time, delta);
      } catch (e) {
        console.error('[showclock] timer', e);
      } finally {
        for (const e of held) e.paused = false;
      }
    }
    this.write();
  }

  /** SHUTDOWN / DESTROY: end the freeze (its waiters resolve, like the old stopTime), drop the pause, back to 1×. */
  readonly dispose = (): void => {
    if (this.disposed) return;
    const ev = this.s.events;
    ev.off(EV_UPDATE, this.tick);
    ev.off(EV_SHUTDOWN, this.dispose);
    ev.off(EV_DESTROY, this.dispose);
    this.fz?.end();
    this.pauses = 0;
    this.ps = null;
    this._speed = this._userSpeed = 1;
    this._tempo = 1;
    this._freezeTempo = 1;
    this.thaw = null;
    this.thawToken = null;
    this.write();
    this.disposed = true;
    if (clocks.get(this.scene) === this) clocks.delete(this.scene);
  };
}

function writeScales(s: SceneInternals, k: number): void {
  s.tweens.timeScale = k;
  s.time.timeScale = k;
  s.anims.globalTimeScale = k;
}

const boundShakes = new WeakSet<object>();
/** Held shakes that already took their first offset (cleared when a shake starts). */
const kicked = new WeakSet<object>();

interface ShakeCam {
  scene: object;
  shakeEffect?: ShakeEffectLike;
  on?(event: string, fn: () => void): unknown;
}

function bindShakeEffect(cam: ShakeCam): void {
  const eff = cam.shakeEffect;
  if (!eff || boundShakes.has(eff)) return;
  boundShakes.add(eff);
  // Phaser.Cameras.Scene2D.Events.SHAKE_START
  cam.on?.('camerashakestart', () => kicked.delete(eff));
  const orig = eff.update;
  eff.update = function (this: ShakeEffectLike, time: number, delta: number): void {
    const c = clocks.get(cam.scene);
    const k = c && !c.isDisposed ? c.fxScale : 1;
    if (k > 0) {
      orig.call(this, time, delta * k);
      return;
    }
    // held (hit-stop with strictFx, or paused): no time passes and the offset stays. A shake that
    // starts inside a hit-stop takes its first offset once, so the held frame shows the kick.
    if (!this.isRunning || kicked.has(this) || (c && c.paused)) return;
    kicked.add(this);
    if (this._elapsed === 0) orig.call(this, time, 0);
  };
}

// ------------------------------------------------------------------ access

/** The scene's show clock (made on first use; a fresh one after the scene restarts). */
export function showClock(scene: Phaser.Scene): ShowClock {
  let c = clocks.get(scene);
  if (!c || c.isDisposed) {
    c = new ShowClock(scene);
    clocks.set(scene, c);
    installQaHook();
  }
  return c;
}

/** The scene's show clock if it has one (never creates). */
export function peekShowClock(scene: Phaser.Scene | null | undefined): ShowClock | undefined {
  if (!scene) return undefined;
  const c = clocks.get(scene);
  return c && !c.isDisposed ? c : undefined;
}

/** Hologram time (ms) of a scene's objects: its clock's fxNow (made on first use). */
export function showFxTimeMs(scene: Phaser.Scene | null | undefined, fallback: number): number {
  if (!scene || !(scene as unknown as Partial<SceneInternals>).events) return fallback;
  try {
    return showClock(scene).fxNow;
  } catch {
    return fallback;
  }
}

/** window.__neon.showClock(sceneKey = 'Duel') → ShowClockSnapshot | null (QA / tools). */
function installQaHook(): void {
  const neon = (globalThis as { __neon?: Record<string, unknown> }).__neon;
  if (!neon || typeof neon !== 'object' || neon.showClock) return;
  neon.showClock = (key = 'Duel'): ShowClockSnapshot | null => {
    const game = neon.game as { scene?: { getScene(k: string): unknown } } | undefined;
    const sc = game?.scene?.getScene(key) as Phaser.Scene | undefined;
    return peekShowClock(sc)?.snapshot() ?? null;
  };
}
