// Shared animation/VFX primitives. Everything here is promise-based so cinematics can be
// written as straight-line async code:
//
//   await tween(scene, { targets: card, y: 100, duration: 200, ease: 'Back.Out' });
//   await Promise.all([shake(scene, 180, 3), flash(scene, 120, PAL.white, 0.6)]);
//
// Timing uses scene time (scaled by the global speed), except hitStop which freezes it.
// Speed, hit-stop and pause live in ONE place, the scene's show clock (src/duel/showclock.ts):
// setSpeed / hitStop / shake below delegate to it.

import Phaser from 'phaser';
import { DEPTH, GAME_H, GAME_W, LOOK_V3 } from '../view/layout';
import { PixelCanvas } from '../art/pixel';
import { showClock } from '../duel/showclock';

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

/**
 * Camera shake. `px` is the max offset in game pixels. The v3 look: `ms` is show-clock time — 3×
 * speed makes it a third as long, a hit-stop and the duel menu pause hold it. Without the look
 * switch (v1 / v2) it is `ms` of real time, exactly as before. See src/duel/showclock.ts.
 */
export function shake(scene: Phaser.Scene, ms: number, px: number): Promise<void> {
  const cam = scene.cameras.main;
  showClock(scene).bindShake(cam);
  return new Promise((resolve) => {
    cam.shake(ms, px / GAME_W, true, (_cam: unknown, progress: number) => {
      if (progress >= 1) resolve();
    });
  });
}

/**
 * The top of the world depth band: a full-screen flash here covers the whole world (board, units,
 * every FX band) but stays under the HUD band (depth ≥ DEPTH.HUD: HUD, hand, inspect, menus,
 * banners, cut-ins, overlays), which CameraRig draws with its UI camera on top of the world.
 */
export const WORLD_FLASH_DEPTH = DEPTH.HUD - 1;

/**
 * Do flashes wash the HUD band by default? The v3 look (A1.9): no — a flash only lights the world.
 * Without the look switch (v1, and the v2 arena) the game stays exactly as it was: a flash sits at
 * the depth its caller gives, so one in the HUD band washes the HUD, hand and banners as before.
 */
export const FLASH_WASHES_HUD: boolean = !LOOK_V3;

/**
 * The depth of the old full-screen flashes, which sat on the overlay band (DEPTH.OVERLAY − 1),
 * for the active look: v1 / v2 keep that; the v3 look puts them at WORLD_FLASH_DEPTH (the world
 * only). `below` steps down from it, for layered flashes (directHit: white, vignette, red, lines).
 */
export function flashTopDepth(below = 0): number {
  return (FLASH_WASHES_HUD ? DEPTH.OVERLAY - 1 : WORLD_FLASH_DEPTH) - below;
}

/** World flashes reach this far past the frame (shake offsets, a 2× close-up around the centre). */
const FLASH_PAD = 48;

export interface FlashOpts {
  /**
   * Wash the HUD band too (the old behaviour: the flash sits at its `depth` even when that is in
   * the HUD band, exactly the frame-sized rectangle of old). Default FLASH_WASHES_HUD: true without
   * the look switch (v1 / v2, unchanged), false in the v3 look — world only, the HUD is never
   * washed by a flash.
   */
  hud?: boolean;
  /** Blend mode of the flash rectangle (default NORMAL). */
  blend?: Phaser.BlendModes | number;
}

/**
 * A full-screen flash rectangle (alpha `alpha`), screen-space; the caller animates and destroys it
 * (see flash()). World only (the v3 look's default): `depth` is clamped under the HUD band
 * (WORLD_FLASH_DEPTH) and the rectangle is padded so camera shake / a close-up never shows an
 * unflashed edge. With `hud` (the v1 / v2 default): the old rectangle — the frame at `depth`.
 */
export function flashRect(scene: Phaser.Scene, color: number, alpha: number, depth: number = DEPTH.OVERLAY, o: FlashOpts = {}): Phaser.GameObjects.Rectangle {
  const hud = o.hud ?? FLASH_WASHES_HUD;
  const r = hud
    ? scene.add.rectangle(0, 0, GAME_W, GAME_H, color, alpha).setOrigin(0).setDepth(depth).setScrollFactor(0)
    : scene.add
        .rectangle(-FLASH_PAD, -FLASH_PAD, GAME_W + FLASH_PAD * 2, GAME_H + FLASH_PAD * 2, color, alpha)
        .setOrigin(0)
        .setDepth(Math.min(depth, WORLD_FLASH_DEPTH))
        .setScrollFactor(0);
  if (o.blend !== undefined) r.setBlendMode(o.blend);
  return r;
}

/**
 * Full-screen color flash that fades out. In the v3 look it is world only (A1.9): `depth` is
 * clamped under the HUD band, so the HUD, hand, banners and cut-ins are never washed. Without the
 * look switch it is the old full-screen flash at `depth` (pass `{ hud: false }` for world only).
 */
export function flash(scene: Phaser.Scene, ms: number, color = 0xffffff, alpha = 0.8, depth: number = DEPTH.OVERLAY, o: FlashOpts = {}): Promise<void> {
  const r = flashRect(scene, color, alpha, depth, o);
  return tween(scene, { targets: r, alpha: 0, duration: ms, ease: 'Quad.Out' }).then(() => r.destroy());
}

/**
 * Hit-stop: freeze tweens, timers, sprite animations and every custom frame clock for `ms` of
 * real time — the classic "impact frame" pause that sells heavy hits. Keep it short (40–120 ms).
 * Nesting-safe (the show clock merges overlapping stops; same as combat.stopTime).
 */
export function hitStop(scene: Phaser.Scene, ms: number): Promise<void> {
  // 'hit': without the look switch the speed comes back as the old hitStop gave it back
  return showClock(scene).freeze(ms, 'hit');
}

/** Global playback speed (fast-forward). 1 = normal. Kept through hit-stops and pauses. */
export function setSpeed(scene: Phaser.Scene, k: number): void {
  showClock(scene).setSpeed(k);
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
