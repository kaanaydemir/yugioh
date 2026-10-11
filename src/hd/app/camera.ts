// HD camera rig + full-screen helpers for sequences. Everything here runs on SCENE time (tweens), so it follows the
// Space 3× speed key and tools/shot.mjs's frozen-clock stepping — unlike Phaser's own camera.shake / zoomTo /
// pan, which use real frame deltas. (vfx/core's `shake` and `flash` are sized for 640×360 and `shake` uses
// camera.shake: use these instead on the HD page.)
//
//   kit.camera.zoomTo(1.12, 500, { x: 600, y: 200 }, 'Sine.InOut')   // cinematic push-in on a world point (zoom 1.0–1.15)
//   kit.camera.reset(400)                                           // back to zoom 1, centred
//   kit.camera.shake(180, 3)                                        // px amplitude, decays linearly
//   kit.flash(120, 0xffffff, 0.6)                                   // full-screen colour flash
//
// Lights follow the camera (zoom / scroll / shake), the HDLight shader scales radii and heights with the zoom.

import Phaser from 'phaser';
import { DEPTH } from '../../view/layout';
import { HD_H, HD_W } from '../contracts';
import { tween } from '../../vfx/core';

export class HDCameraRig {
  private fx = HD_W / 2;
  private fy = HD_H / 2;
  private zoom = 1;
  private shakeAmp = 0;
  private jx = 0;
  private jy = 0;
  private seed = 1;

  constructor(private scene: Phaser.Scene) {
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.apply, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.apply, this));
  }

  private rnd(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private apply(): void {
    const cam = this.scene.cameras.main;
    if (this.shakeAmp > 0.01) {
      this.jx = Math.round((this.rnd() * 2 - 1) * this.shakeAmp);
      this.jy = Math.round((this.rnd() * 2 - 1) * this.shakeAmp);
    } else {
      this.jx = 0;
      this.jy = 0;
    }
    cam.setZoom(this.zoom);
    cam.setScroll(this.fx - HD_W / 2 + this.jx, this.fy - HD_H / 2 + this.jy);
  }

  /** Smoothly zoom (and optionally re-centre on a world point). Resolves when done. */
  zoomTo(zoom: number, ms: number, focus?: { x: number; y: number }, ease = 'Sine.InOut'): Promise<void> {
    const from = { z: this.zoom, x: this.fx, y: this.fy };
    const to = { z: zoom, x: focus?.x ?? this.fx, y: focus?.y ?? this.fy };
    const k = { t: 0 };
    return tween(this.scene, {
      targets: k,
      t: 1,
      duration: Math.max(1, ms),
      ease,
      onUpdate: () => {
        this.zoom = from.z + (to.z - from.z) * k.t;
        this.fx = from.x + (to.x - from.x) * k.t;
        this.fy = from.y + (to.y - from.y) * k.t;
      },
    });
  }

  reset(ms = 0): Promise<void> {
    if (ms <= 0) {
      this.zoom = 1;
      this.fx = HD_W / 2;
      this.fy = HD_H / 2;
      return Promise.resolve();
    }
    return this.zoomTo(1, ms, { x: HD_W / 2, y: HD_H / 2 });
  }

  /** Shake by up to `px` pixels (whole pixels, decaying to 0 over `ms`). Resolves when done. */
  shake(ms: number, px: number): Promise<void> {
    const k = { v: 1 };
    this.shakeAmp = px;
    return tween(this.scene, {
      targets: k,
      v: 0,
      duration: Math.max(1, ms),
      ease: 'Linear',
      onUpdate: () => (this.shakeAmp = px * k.v),
    }).then(() => {
      this.shakeAmp = 0;
    });
  }
}

/** Full-screen (960×540) colour flash that fades out. Normal blending unless `additive`. */
export function screenFlash(scene: Phaser.Scene, ms: number, color = 0xffffff, alpha = 0.7, additive = false): Promise<void> {
  const r = scene.add.rectangle(0, 0, HD_W, HD_H, color, alpha).setOrigin(0).setDepth(DEPTH.OVERLAY).setScrollFactor(0);
  if (additive) r.setBlendMode(Phaser.BlendModes.ADD);
  return tween(scene, { targets: r, alpha: 0, duration: ms, ease: 'Quad.Out' }).then(() => r.destroy());
}
