// HDKit — the per-scene bundle of everything the shell provides: lighting, bloom layers, speed.
// Anything inside src/hd (arena themes, monsters' VFX, the cine sequence) gets it with getKit(scene).
//
//   const kit = getKit(scene);
//   kit.lighting.addPointLight(x, y, 0xffd447, 220, 1.2);     // see lighting.ts
//   kit.fx.glowSprite(x, y, 0x3fe0ea, 80, 0.8);               // see fx.ts
//   kit.fx.glow(someAdditiveSprite, 'front');                 // move an additive sprite into the bloom layer
//   kit.camera.zoomTo(1.1, 500, { x, y }); kit.camera.shake(180, 3); kit.flash(120, 0xffffff, 0.6);   // see camera.ts

import type Phaser from 'phaser';
import { HDCameraRig, screenFlash } from './camera';
import { createFx, type HDFx } from './fx';
import { getLighting, type HDLighting } from './lighting';

export interface HDKit {
  readonly scene: Phaser.Scene;
  readonly lighting: HDLighting;
  readonly fx: HDFx;
  /** Scene-time camera rig (zoom / focus / shake). */
  readonly camera: HDCameraRig;
  /** Full-screen 960×540 flash. */
  flash(ms: number, color?: number, alpha?: number, additive?: boolean): Promise<void>;
}

const kits = new WeakMap<Phaser.Scene, HDKit>();

export function getKit(scene: Phaser.Scene): HDKit {
  let k = kits.get(scene);
  if (!k) {
    const lighting = getLighting(scene);
    const fx = createFx(scene);
    k = { scene, lighting, fx, camera: new HDCameraRig(scene), flash: (ms, color, alpha, additive) => screenFlash(scene, ms, color, alpha, additive) };
    kits.set(scene, k);
    const drop = () => kits.delete(scene);
    scene.events.once('shutdown', drop);
    scene.events.once('destroy', drop);
  }
  return k;
}
