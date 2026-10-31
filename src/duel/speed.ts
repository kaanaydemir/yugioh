// SpeedControl — global animation speed = Settings.speed (HUD 1×/2×/3× button) × 3 while
// Space (or a pointer on an empty spot) is held, × slow motion (slowMo). It feeds the scene's show
// clock (src/duel/showclock.ts) every frame; the clock owns the time scales, so a hit-stop or the
// menu pause holds the speed and gives it back as set (no save / restore, no one-frame drift).
// The slow-motion countdown is real time, like before, but waits while the duel menu pauses.
//
// The v3 look's presentation tempo (docs/v3/TEMPO.md): while `tempoWhen()` holds (DuelController:
// a cinematic is playing) the clock gets tempo = V3_TEMPO, so the whole show runs V3_TEMPO times
// longer (scene time, sprite anims, hit-stops) with the speed setting still on top; the player's
// own input between cinematics stays at the plain speed. A slow motion started inside a cinematic
// lasts tempo times longer too (its countdown counts show-paced real time). v1 / v2: V3_TEMPO = 1,
// nothing changes.

import Phaser from 'phaser';
import { showClock, type ShowClock } from './showclock';
import { LOOK_V3 } from '../view/layout';

export const FAST_FORWARD = 3;

/** The v3 look's default presentation tempo: every cinematic beat lasts this many times longer. */
export const V3_TEMPO_DEFAULT = 1.35;

/** On top of the tempo: a hit-stop (the impact frame) holds this much longer still (v3 only). */
export const V3_HIT_HOLD = 1.15;

/**
 * The tempo of this page: V3_TEMPO_DEFAULT in the v3 look (`&tempo=1` turns it off, `&tempo=1.5`
 * tries another; clamped to 0.5–3), always 1 without the look switch.
 */
export const V3_TEMPO: number = detectTempo();

function detectTempo(): number {
  if (!LOOK_V3) return 1;
  try {
    if (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined') {
      const p = new URLSearchParams(location.search).get('tempo');
      if (p !== null) {
        const v = Number(p);
        if (Number.isFinite(v) && v > 0) return Math.min(3, Math.max(0.5, v));
      }
    }
  } catch {
    /* no URL: default */
  }
  return V3_TEMPO_DEFAULT;
}

export class SpeedControl {
  readonly scene: Phaser.Scene;
  /** The scene's show clock (speed, hit-stop, pause). */
  readonly clock: ShowClock;
  base: number;
  private keyHeld = false;
  private pointerHeld = false;
  /** Fast-forward only allowed while this returns true (e.g. while a cinematic plays). */
  canHold: () => boolean = () => true;
  /** The v3 tempo applies only while this returns true (DuelController: while a cinematic plays). */
  tempoWhen: () => boolean = () => false;
  /** The tempo used while tempoWhen() holds (V3_TEMPO; 1 without the look switch). */
  tempo: number = V3_TEMPO;
  onChange: ((k: number) => void) | null = null;
  private last = 0;
  private slow = 1;
  private slowLeft = 0;
  private holdTimer: Phaser.Time.TimerEvent | null = null;
  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' && !e.repeat) this.keyHeld = true;
  };
  private readonly onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') this.keyHeld = false;
  };

  constructor(scene: Phaser.Scene, base: number) {
    this.scene = scene;
    this.base = base;
    this.clock = showClock(scene);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.release);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length) return;
      this.holdTimer?.remove();
      // a quick click still selects things on the board; holding ≥ 220 ms fast-forwards
      this.holdTimer = scene.time.addEvent({ delay: 220, callback: () => (this.pointerHeld = true) });
    });
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.release);
    scene.input.on(Phaser.Input.Events.GAME_OUT, this.release);
    const upd = (_t: number, dt: number) => {
      if (this.slowLeft > 0 && !this.clock.paused) {
        const t = this.clock.tempo;
        this.slowLeft -= t === 1 ? dt : dt / t;
        if (this.slowLeft <= 0) this.slow = 1;
        else if (this.slowLeft < 250) this.slow = Math.min(1, this.slow + (1 - this.slow) * (dt / Math.max(16, this.slowLeft)));
      }
      this.apply();
    };
    scene.events.on(Phaser.Scenes.Events.PRE_UPDATE, upd);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.PRE_UPDATE, upd);
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      window.removeEventListener('blur', this.release);
      this.holdTimer?.remove();
      // the clock disposed itself on this SHUTDOWN already: this is a plain reset to 1×
      this.clock.setSpeed(1);
    });
    this.apply();
  }

  get fastForward(): boolean {
    return (this.keyHeld || this.pointerHeld) && this.canHold();
  }

  /** Effective speed multiplier now. */
  get value(): number {
    return this.base * (this.fastForward ? FAST_FORWARD : 1) * this.slow;
  }

  /** Dramatic slow motion: multiply the speed by k (< 1) for `ms` of real time, then ease back. */
  slowMo(k: number, ms: number): void {
    this.slow = Math.max(0.1, Math.min(1, k));
    this.slowLeft = ms;
  }

  setBase(k: number): void {
    this.base = k;
    this.apply();
  }

  private readonly release = () => {
    this.pointerHeld = false;
    this.holdTimer?.remove();
    this.holdTimer = null;
  };

  /** The player's part of the speed (setting × fast-forward, no slow motion). */
  get userValue(): number {
    return this.base * (this.fastForward ? FAST_FORWARD : 1);
  }

  private apply(): void {
    // during a hit-stop / the menu pause the clock stays at 0 and uses this when time flows again
    const k = this.value;
    if (this.tempo !== 1) {
      const on = this.tempoWhen();
      this.clock.setTempo(on ? this.tempo : 1, on ? this.tempo * V3_HIT_HOLD : 1);
    }
    this.clock.setSpeed(k, this.userValue);
    if (k !== this.last) {
      this.last = k;
      this.onChange?.(k);
    }
  }
}
