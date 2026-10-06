// Shared animation/VFX primitives. Everything here is promise-based so cinematics can be
// written as straight-line async code:
//
//   await tween(scene, { targets: card, y: 100, duration: 200, ease: 'Back.Out' });
//   await Promise.all([shake(scene, 180, 3), flash(scene, 120, PAL.white, 0.6)]);
//
// Timing uses scene time (scaled by the global speed), except hitStop which freezes it.

import Phaser from 'phaser';
import { DEPTH, GAME_H, GAME_W } from '../view/layout';
import { PixelCanvas } from '../art/pixel';

/** Wait `ms` of scene time (respects speed/fast-forward). */
export function wait(scene: Phaser.Scene, ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => scene.time.delayedCall(ms, () => resolve()));
}

/** Wait `ms` of unscaled game-loop time (ignores speed and hit-stop). */
export function realWait(scene: Phaser.Scene, ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    let acc = 0;
    const fn = (_t: number, dt: number) => {
      acc += dt;
      if (acc >= ms) {
        scene.events.off(Phaser.Scenes.Events.UPDATE, fn);
        resolve();
      }
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, fn);
  });
}

/** Promise wrapper around scene.tweens.add. Resolves on complete (or immediately if targets vanish). */
export function tween(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => {
    const t = scene.tweens.add({ ...config });
    t.once(Phaser.Tweens.Events.TWEEN_COMPLETE, () => resolve());
    t.once(Phaser.Tweens.Events.TWEEN_STOP, () => resolve());
  });
}

/** Tween a plain number from→to, calling onUpdate each frame. */
export function tweenValue(
  scene: Phaser.Scene,
  from: number,
  to: number,
  duration: number,
  onUpdate: (v: number) => void,
  ease = 'Linear',
): Promise<void> {
  const o = { v: from };
  return tween(scene, { targets: o, v: to, duration, ease, onUpdate: () => onUpdate(o.v) });
}

/** Camera shake. `px` is the max offset in game pixels. */
export function shake(scene: Phaser.Scene, ms: number, px: number): Promise<void> {
  return new Promise((resolve) => {
    scene.cameras.main.shake(ms, px / GAME_W, true, (_cam: unknown, progress: number) => {
      if (progress >= 1) resolve();
    });
  });
}

/** Full-screen color flash that fades out. */
export function flash(scene: Phaser.Scene, ms: number, color = 0xffffff, alpha = 0.8, depth: number = DEPTH.OVERLAY): Promise<void> {
  const r = scene.add.rectangle(0, 0, GAME_W, GAME_H, color, alpha).setOrigin(0).setDepth(depth).setScrollFactor(0);
  return tween(scene, { targets: r, alpha: 0, duration: ms, ease: 'Quad.Out' }).then(() => r.destroy());
}

/**
 * Hit-stop: freeze tweens, timers and sprite animations for `ms` of real time —
 * the classic "impact frame" pause that sells heavy hits. Keep it short (40–120 ms).
 */
export async function hitStop(scene: Phaser.Scene, ms: number): Promise<void> {
  const tweens = scene.tweens.timeScale;
  const time = scene.time.timeScale;
  const anims = scene.anims.globalTimeScale;
  scene.tweens.timeScale = 0;
  scene.time.timeScale = 0;
  scene.anims.globalTimeScale = 0;
  await realWait(scene, ms);
  scene.tweens.timeScale = tweens;
  scene.time.timeScale = time;
  scene.anims.globalTimeScale = anims;
}

/** Global playback speed (fast-forward). 1 = normal. */
export function setSpeed(scene: Phaser.Scene, k: number): void {
  scene.tweens.timeScale = k;
  scene.time.timeScale = k;
  scene.anims.globalTimeScale = k;
}

/** Fire-and-forget helper that never lets an effect's error break a cinematic. */
export function safe(p: Promise<unknown>): Promise<void> {
  return p.then(
    () => undefined,
    (e) => {
      console.error('[vfx]', e);
    },
  );
}

// ---------------------------------------------------------------- basic particle textures

/** Small white textures for tinted particles. Built once per game (BootScene step 05-core). */
export const TEX = {
  px1: 'fx:px1', // 1×1
  px2: 'fx:px2', // 2×2
  px3: 'fx:px3', // 3×3
  plus: 'fx:plus', // 3×3 plus sign
  spark: 'fx:spark', // 5×5 four-point star
  dot5: 'fx:dot5', // 5px disc
  ring9: 'fx:ring9', // 9px ring
} as const;

export function buildCoreTextures(scene: Phaser.Scene): void {
  const mk = (key: string, w: number, h: number, draw: (p: PixelCanvas) => void) => {
    if (scene.textures.exists(key)) return;
    const p = new PixelCanvas(w, h);
    draw(p);
    scene.textures.addCanvas(key, p.toCanvas());
  };
  mk(TEX.px1, 1, 1, (p) => p.set(0, 0, 0xffffff));
  mk(TEX.px2, 2, 2, (p) => p.rect(0, 0, 2, 2, 0xffffff));
  mk(TEX.px3, 3, 3, (p) => p.rect(0, 0, 3, 3, 0xffffff));
  mk(TEX.plus, 3, 3, (p) => p.rect(1, 0, 1, 3, 0xffffff).rect(0, 1, 3, 1, 0xffffff));
  mk(TEX.spark, 5, 5, (p) => p.rect(2, 0, 1, 5, 0xffffff).rect(0, 2, 5, 1, 0xffffff));
  mk(TEX.dot5, 5, 5, (p) => p.disc(2.5, 2.5, 2.5, 0xffffff));
  mk(TEX.ring9, 9, 9, (p) => p.ring(4.5, 4.5, 4.5, 0xffffff));
}
