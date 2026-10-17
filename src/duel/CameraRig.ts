// CameraRig — two cameras: the main (world) camera that cinematics pan / cut / shake, and an
// un-zoomed UI camera on top for the HUD band (depth ≥ DEPTH.HUD: HUD, hand, inspect, menus,
// banners, cut-ins, overlays, curtains). Every frame each top-level object is assigned to one
// of them by its depth, so no other module has to know about the split.
//
//   await camera.focus({ x, y });                    // lean (integer-pixel pan) toward a point
//   await camera.focus({ x, y }, { closeUp: true }); // CUT to an exact 2× close-up on the point
//   await camera.unfocus();
//   await camera.descend(1800);                      // gameStart: from the sky down to the arena
//
// Integer camera (v3 plan A1.2, docs/v3/A0_ENVANTER.md §5.3): the world camera only ever shows
// the pixel art at a whole-number scale, so 1-px outlines, zone lines and dither never split
// into uneven columns. focus() pans by whole pixels at zoom 1 — its `zoom` option is accepted
// for the existing callers and ignored — and `closeUp: true` cuts (no tween) to zoom 2 with a
// whole-pixel scroll. Leaving a close-up (unfocus / a plain focus) cuts back to zoom 1 first.
//
// core.shake() shakes only the world camera, so the HUD stays readable during impacts.

import Phaser from 'phaser';
import { DEPTH, GAME_H, GAME_W, type XY } from '../view/layout';
import { tween } from '../vfx/core';

export interface CameraFocusOpts {
  /**
   * Legacy (the 1.03–1.08 lean of the v1 cinematics). Accepted and IGNORED: the world camera
   * never scales fractionally any more. Use `closeUp` for a (2×) close-up.
   */
  zoom?: number;
  /** Pan tween time (default 260 ms). A close-up is a cut and ignores it. */
  ms?: number;
  /** How far toward the point to pan (0..1 of the offset from the screen centre, default 0.35). */
  pan?: number;
  /** Cut (no tween) to an exact 2× close-up centred on the point (kept inside the 640×360 world). */
  closeUp?: boolean;
}

/** The close-up scale: exactly two screen pixels per art pixel. */
export const CLOSE_UP_ZOOM = 2;

/**
 * Largest pan (whole px, each axis) of a 1× lean — about the most world the old 1.06–1.08 zoom +
 * pan showed past the 640×360 frame. The v1 / v2 backdrops (sky, stadium, with parallax) reach
 * further than that, so a lean never shows an edge; a view whose backdrop covers less (it must
 * reach PAN_LIMIT px past every side of the frame) calls setPanLimit().
 */
export const PAN_LIMIT_DEFAULT: Readonly<XY> = { x: 48, y: 32 };

export class CameraRig {
  readonly scene: Phaser.Scene;
  readonly main: Phaser.Cameras.Scene2D.Camera;
  readonly ui: Phaser.Cameras.Scene2D.Camera;
  private readonly assign: () => void;
  private focusTween: Phaser.Tweens.Tween | null = null;
  private zoomed = false;
  private panLimit: XY = { ...PAN_LIMIT_DEFAULT };

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

  /** The camera was sent somewhere by focus() and not brought back by unfocus() / reset(). */
  get isFocused(): boolean {
    return this.zoomed;
  }

  /** The world camera is in a 2× close-up. */
  get isCloseUp(): boolean {
    return this.main.zoom !== 1;
  }

  /** Clamp of the 1× lean (whole px per axis; default PAN_LIMIT_DEFAULT). For views with a smaller backdrop. */
  setPanLimit(x: number, y: number): void {
    this.panLimit = { x: Math.max(0, Math.floor(x)), y: Math.max(0, Math.floor(y)) };
  }

  /**
   * Lean toward `xy`: an integer-pixel pan at zoom 1 (`zoom` is ignored), or with
   * `{ closeUp: true }` a cut to an exact 2× close-up centred on it. Resolves when the pan is
   * done (a cut resolves at once).
   */
  focus(xy: XY, o: CameraFocusOpts = {}): Promise<void> {
    if (o.closeUp) {
      this.zoomed = true;
      return this.cutCloseUp(xy);
    }
    const pan = o.pan ?? 0.35;
    const L = this.panLimit;
    const dx = clampInt((xy.x - GAME_W / 2) * pan, L.x);
    const dy = clampInt((xy.y - GAME_H / 2) * pan, L.y);
    // as before: any focus that asked for a lean (every caller does) counts as "focused"
    this.zoomed = (o.zoom ?? 1.06) > 1.001 || dx !== 0 || dy !== 0;
    return this.move(dx, dy, o.ms ?? 260, 'Sine.Out');
  }

  unfocus(ms = 320): Promise<void> {
    this.zoomed = false;
    return this.move(0, 0, ms, 'Sine.InOut');
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

  /** Cut to zoom 2 with the view (320×180 world px) centred on `xy`, inside the 640×360 world. */
  private cutCloseUp(xy: XY): Promise<void> {
    this.focusTween?.stop();
    this.focusTween = null;
    // at zoom Z the camera shows world [scroll + W/2 − W/2Z, …]: centre it on xy, keep it in frame
    const hw = GAME_W / 2 - GAME_W / (2 * CLOSE_UP_ZOOM);
    const hh = GAME_H / 2 - GAME_H / (2 * CLOSE_UP_ZOOM);
    const sx = clampInt(xy.x - GAME_W / 2, hw);
    const sy = clampInt(xy.y - GAME_H / 2, hh);
    this.main.setZoom(CLOSE_UP_ZOOM).setScroll(sx, sy);
    return Promise.resolve();
  }

  /** Out of a close-up: cut back to zoom 1, keeping the lean inside the pan limit. */
  private cutToWide(): void {
    const cam = this.main;
    if (cam.zoom === 1) return;
    cam.setZoom(1).setScroll(clampInt(cam.scrollX, this.panLimit.x), clampInt(cam.scrollY, this.panLimit.y));
  }

  /** Whole-pixel pan tween at zoom 1. */
  private move(sx: number, sy: number, ms: number, ease: string): Promise<void> {
    this.focusTween?.stop();
    this.focusTween = null;
    this.cutToWide();
    const cam = this.main;
    const o = { x: cam.scrollX, y: cam.scrollY };
    return new Promise<void>((resolve) => {
      this.focusTween = this.scene.tweens.add({
        targets: o,
        x: sx,
        y: sy,
        duration: ms,
        ease,
        onUpdate: () => cam.setScroll(Math.round(o.x), Math.round(o.y)),
        onComplete: () => {
          cam.setScroll(sx, sy);
          resolve();
        },
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

/** Round to a whole pixel and clamp to ±limit. */
function clampInt(v: number, limit: number): number {
  const r = Math.round(v);
  return r > limit ? limit : r < -limit ? -limit : r === 0 ? 0 : r;
}
