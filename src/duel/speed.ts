// SpeedControl — global animation speed = Settings.speed (HUD 1×/2×/3× button) × 3 while
// Space (or a pointer on an empty spot) is held, × slow motion (slowMo). It feeds the scene's show
// clock (src/duel/showclock.ts) every frame; the clock owns the time scales, so a hit-stop or the
// menu pause holds the speed and gives it back as set (no save / restore, no one-frame drift).
// The slow-motion countdown is real time, like before, but waits while the duel menu pauses.

import Phaser from 'phaser';
import { showClock, type ShowClock } from './showclock';

export const FAST_FORWARD = 3;

export class SpeedControl {
  readonly scene: Phaser.Scene;
  /** The scene's show clock (speed, hit-stop, pause). */
  readonly clock: ShowClock;
  base: number;
  private keyHeld = false;
  private pointerHeld = false;
  /** Fast-forward only allowed while this returns true (e.g. while a cinematic plays). */
  canHold: () => boolean = () => true;
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
        this.slowLeft -= dt;
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
    this.clock.setSpeed(k, this.userValue);
    if (k !== this.last) {
      this.last = k;
      this.onChange?.(k);
    }
  }
}
