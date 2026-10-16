// Art Lab cameras: the world camera (zoom 1, or the 2× inspection zoom — integers only, integer
// scroll, clamped to the 640×360 world, integer shake offsets) and a UI camera (zoom 1) for the
// control bar. Each camera ignores the other's objects: anything created inside ui(() => ...) is
// UI, everything else (arena, actors, effects — even ones created lazily) is world.

import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../../view/layout';
import type { XY } from '../types';

export type ZoomTarget = 'off' | 'dragon' | 'wizard';
export const ZOOMS: readonly ZoomTarget[] = ['off', 'dragon', 'wizard'];

/** Largest camera shake on screen (game px) at any zoom (the brief: ≤ 2 px). */
const MAX_SHAKE_SCREEN = 2;

export class LabCameras {
  readonly world: Phaser.Cameras.Scene2D.Camera;
  readonly ui: Phaser.Cameras.Scene2D.Camera;
  private uiDepth = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.world = scene.cameras.main;
    this.world.setZoom(1).setScroll(0, 0).setRoundPixels(true);
    this.ui = scene.cameras.add(0, 0, GAME_W, GAME_H, false, 'artlab-ui').setRoundPixels(true);
    scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAdded, this);
    // objects that already exist belong to the world
    for (const o of scene.children.list) this.onAdded(o);
  }

  private onAdded(obj: Phaser.GameObjects.GameObject): void {
    obj.cameraFilter |= this.uiDepth > 0 ? this.world.id : this.ui.id;
  }

  /** Run `fn` with every object it creates marked as UI (rendered by the UI camera only). */
  uiBuild<T>(fn: () => T): T {
    this.uiDepth++;
    try {
      return fn();
    } finally {
      this.uiDepth--;
    }
  }

  /** Apply zoom (1 or 2), the zoom target and a shake offset. Everything integer. */
  apply(zoom: ZoomTarget, focus: Partial<Record<Exclude<ZoomTarget, 'off'>, XY>>, shake: XY): void {
    const f = zoom === 'off' ? undefined : focus[zoom];
    const z = f ? 2 : 1;
    if (this.world.zoom !== z) this.world.setZoom(z);
    let cx = GAME_W / 2;
    let cy = GAME_H / 2;
    if (f) {
      const hw = GAME_W / (2 * z);
      const hh = GAME_H / (2 * z);
      cx = Math.max(hw, Math.min(GAME_W - hw, Math.round(f.x)));
      cy = Math.max(hh, Math.min(GAME_H - hh, Math.round(f.y)));
    }
    // the shake is a SCREEN budget (≤ MAX_SHAKE_SCREEN game px): at zoom 2 one world px is two
    // screen px, so the offset is capped at ±1 world px there (still integer, still visible)
    const m = Math.floor(MAX_SHAKE_SCREEN / z);
    const sx = Math.max(-m, Math.min(m, Math.trunc(shake.x)));
    const sy = Math.max(-m, Math.min(m, Math.trunc(shake.y)));
    this.world.setScroll(Math.round(cx - GAME_W / 2) + sx, Math.round(cy - GAME_H / 2) + sy);
  }

  setBackground(color: number): void {
    this.world.setBackgroundColor(color);
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAdded, this);
    if (this.scene.cameras) this.scene.cameras.remove(this.ui, true);
    this.world.setZoom(1).setScroll(0, 0);
  }
}
