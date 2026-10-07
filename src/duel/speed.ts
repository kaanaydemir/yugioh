// SpeedControl — global animation speed = Settings.speed (HUD 1×/2×/3× button) × 3 while
// Space (or a pointer on an empty spot) is held. Applied through core.setSpeed; re-applied each
// frame after hit-stops (which save/restore the time scale) so a freeze can never lose it.

import Phaser from 'phaser';
import { setSpeed } from '../vfx/core';

export const FAST_FORWARD = 3;

export class SpeedControl {
  readonly scene: Phaser.Scene;
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
      if (this.slowLeft > 0) {
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
      setSpeed(scene, 1);
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

  private apply(): void {
    const s = this.scene;
    // frozen by a hit-stop: leave it alone, re-apply when it thaws
    if (s.tweens.timeScale === 0 || s.time.timeScale === 0) return;
    const k = this.value;
    if (s.tweens.timeScale !== k || s.time.timeScale !== k || s.anims.globalTimeScale !== k) setSpeed(s, k);
    if (k !== this.last) {
      this.last = k;
      this.onChange?.(k);
    }
  }
}
