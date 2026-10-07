// Title camera: a slow cinematic drift over the arena, plus "world-only" shakes.
//
// The title has no zoom (non-integer zoom would smear the pixel art); the drift moves the
// scroll, so the BoardView's parallax layers give the depth. Camera shakes requested by VFX
// (core.shake → cameras.main.shake) are re-routed into scroll offsets, so they rattle the
// world (scrollFactor ≠ 0) while the logo and menus (scrollFactor 0) stay rock steady.

import Phaser from 'phaser';

interface ShakeJob {
  t: number;
  dur: number;
  px: number;
  cb: ((cam: Phaser.Cameras.Scene2D.Camera, progress: number) => void) | null;
  ctx: unknown;
}

export class TitleCamera {
  readonly cam: Phaser.Cameras.Scene2D.Camera;
  /** Where the camera rests (tween this). */
  readonly base = { x: 0, y: 0 };
  /** Drift amplitude multiplier (0 = still). */
  drift = 1;
  /** Multiplier for re-routed shakes. */
  shakeScale = 1;
  private readonly jobs: ShakeJob[] = [];
  private t = 0;
  private readonly onUpdate: (time: number, dt: number) => void;
  private readonly scene: Phaser.Scene;
  private rnd = 0x2545f491;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.cam = scene.cameras.main;
    const cam = this.cam;
    // Re-route shakes into scroll offsets (see header). Signature matches Camera#shake.
    (cam as unknown as { shake: unknown }).shake = (
      duration = 100,
      intensity: number | Phaser.Math.Vector2 = 0.05,
      _force = false,
      callback?: (cam: Phaser.Cameras.Scene2D.Camera, progress: number) => void,
      context?: unknown,
    ) => {
      const k = typeof intensity === 'number' ? intensity : intensity.x;
      this.jobs.push({ t: 0, dur: Math.max(1, duration), px: k * scene.scale.width, cb: callback ?? null, ctx: context });
      return cam;
    };
    this.onUpdate = (_time, dt) => this.update(dt);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate));
  }

  private rand(): number {
    // xorshift — independent of Math.random so films stay repeatable
    let x = this.rnd;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.rnd = x >>> 0;
    return this.rnd / 4294967296;
  }

  /** Move the resting point (eased). */
  moveTo(x: number, y: number, ms = 900, ease = 'Sine.InOut'): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({ targets: this.base, x, y, duration: ms, ease, onComplete: () => resolve(), onStop: () => resolve() });
    });
  }

  snapTo(x: number, y: number): void {
    this.scene.tweens.killTweensOf(this.base);
    this.base.x = x;
    this.base.y = y;
  }

  private update(dt: number): void {
    // drift follows real frame time (it should keep breathing through hit-stops)
    this.t += dt;
    const s = this.t / 1000;
    const dx = (Math.sin(s * 0.42) * 10 + Math.sin(s * 0.17 + 1.3) * 6) * this.drift;
    const dy = (Math.sin(s * 0.31 + 0.6) * 4 + Math.sin(s * 0.11) * 3) * this.drift;
    let sx = 0;
    let sy = 0;
    for (let i = this.jobs.length - 1; i >= 0; i--) {
      const j = this.jobs[i];
      j.t += dt * this.scene.time.timeScale;
      const p = Math.min(1, j.t / j.dur);
      const a = j.px * this.shakeScale * (1 - p * 0.6);
      sx += (this.rand() * 2 - 1) * a;
      sy += (this.rand() * 2 - 1) * a * 0.6;
      try {
        j.cb?.call(j.ctx, this.cam, p);
      } catch (e) {
        console.error('[title camera] shake callback', e);
      }
      if (p >= 1) this.jobs.splice(i, 1);
    }
    this.cam.setScroll(Math.round(this.base.x + dx + sx), Math.round(this.base.y + dy + sy));
  }
}
