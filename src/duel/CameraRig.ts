// CameraRig — two cameras: the main (world) camera that cinematics zoom / pan / shake, and an
// un-zoomed UI camera on top for the HUD band (depth ≥ DEPTH.HUD: HUD, hand, inspect, menus,
// banners, cut-ins, overlays, curtains). Every frame each top-level object is assigned to one
// of them by its depth, so no other module has to know about the split.
//
//   await camera.focus({ x, y }, { zoom: 1.06 });   // ease toward a point (bible: 1.0 → 1.08)
//   await camera.unfocus();
//   await camera.descend(1800);                      // gameStart: from the sky down to the arena
//
// core.shake() shakes only the world camera, so the HUD stays readable during impacts.

import Phaser from 'phaser';
import { DEPTH, GAME_H, GAME_W, type XY } from '../view/layout';
import { tween } from '../vfx/core';

export class CameraRig {
  readonly scene: Phaser.Scene;
  readonly main: Phaser.Cameras.Scene2D.Camera;
  readonly ui: Phaser.Cameras.Scene2D.Camera;
  private readonly assign: () => void;
  private focusTween: Phaser.Tweens.Tween | null = null;
  private zoomed = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.main = scene.cameras.main;
    this.ui = scene.cameras.add(0, 0, GAME_W, GAME_H, false, 'ui');
    this.ui.setRoundPixels(true);
    this.main.setRoundPixels(true);
    this.assign = () => this.assignAll();
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.assign);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.assign);
    });
    this.assignAll();
  }

  /** World point under a screen (pointer) position, through the main camera. */
  worldPoint(x: number, y: number): XY {
    const p = this.main.getWorldPoint(x, y);
    return { x: p.x, y: p.y };
  }

  get isFocused(): boolean {
    return this.zoomed;
  }

  /** Zoom / pan the world toward `xy`. Resolves when the move is done. */
  focus(xy: XY, o: { zoom?: number; ms?: number; pan?: number } = {}): Promise<void> {
    const zoom = Math.max(1, Math.min(1.1, o.zoom ?? 1.06));
    const pan = o.pan ?? 0.35;
    const dx = (xy.x - GAME_W / 2) * pan;
    const dy = (xy.y - GAME_H / 2) * pan;
    this.zoomed = zoom > 1.001;
    return this.move(dx, dy, zoom, o.ms ?? 260, 'Sine.Out');
  }

  unfocus(ms = 320): Promise<void> {
    this.zoomed = false;
    return this.move(0, 0, 1, ms, 'Sine.InOut');
  }

  /** Instant reset (sync / restart). */
  reset(): void {
    this.focusTween?.stop();
    this.focusTween = null;
    this.zoomed = false;
    this.main.setZoom(1).setScroll(0, 0);
  }

  /** gameStart: start high above (sky + stadium) and glide down onto the arena. */
  async descend(ms = 1700, from = -300): Promise<void> {
    this.focusTween?.stop();
    this.main.setZoom(1).setScroll(0, from);
    const o = { y: from };
    await tween(this.scene, {
      targets: o,
      y: 0,
      duration: ms,
      ease: 'Cubic.InOut',
      onUpdate: () => this.main.setScroll(0, Math.round(o.y)),
    });
    this.main.setScroll(0, 0);
  }

  private move(sx: number, sy: number, zoom: number, ms: number, ease: string): Promise<void> {
    this.focusTween?.stop();
    const cam = this.main;
    const o = { x: cam.scrollX, y: cam.scrollY, z: cam.zoom };
    return new Promise<void>((resolve) => {
      this.focusTween = this.scene.tweens.add({
        targets: o,
        x: sx,
        y: sy,
        z: zoom,
        duration: ms,
        ease,
        onUpdate: () => cam.setZoom(o.z).setScroll(o.x, o.y),
        onComplete: () => resolve(),
        onStop: () => resolve(),
      });
    });
  }

  private assignAll(): void {
    const list = this.scene.sys.displayList?.list as Phaser.GameObjects.GameObject[] | undefined;
    if (!list) return;
    const mainId = this.main.id;
    const uiId = this.ui.id;
    for (const o of list) {
      const d = (o as unknown as { depth?: number }).depth ?? 0;
      (o as unknown as { cameraFilter: number }).cameraFilter = d >= DEPTH.HUD ? mainId : uiId;
    }
  }
}
