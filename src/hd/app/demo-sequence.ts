// A small built-in demo sequence (?view=scene&seq=demo): exercises the whole shell API the way a real cine
// sequence would — owner rim lights, event light, impact flashes, bloom-layer beams, animations, camera shake.
// It doubles as a worked example for src/hd/cine/*.ts (see api.ts).

import Phaser from 'phaser';
import { wait } from '../../vfx/core';
import type { HDSceneContext, HDSequence } from './api';
import { SOFT } from './fx';
import type { HDMonsterSprite } from './units';

function beam(ctx: HDSceneContext, from: { x: number; y: number }, to: { x: number; y: number }, color: number, ms: number): Promise<void> {
  const { scene, kit } = ctx;
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  const mk = (h: number, tint: number, a: number) => {
    const im = scene.add.image(from.x, from.y, SOFT.streak).setOrigin(0, 0.5).setRotation(ang).setDisplaySize(len, h).setTint(tint).setAlpha(a).setBlendMode(Phaser.BlendModes.ADD);
    return kit.fx.glow(im, 'front');
  };
  const outer = mk(34, color, 0.9);
  const core = mk(10, 0xffffff, 1);
  return new Promise((resolve) => {
    scene.tweens.add({
      targets: [outer, core],
      alpha: 0,
      scaleY: 0.2,
      duration: ms,
      ease: 'Quad.In',
      onComplete: () => {
        outer.destroy();
        core.destroy();
        resolve();
      },
    });
  });
}

async function strike(ctx: HDSceneContext, a: HDMonsterSprite, b: HDMonsterSprite, color: number): Promise<void> {
  const { scene, kit } = ctx;
  const spec = a.art.anims.attack;
  const toImpact = (a.art.attackImpactFrame / spec.fps) * 1000;
  void a.playOnce('attack');
  await wait(scene, toImpact);
  const from = a.point('muzzle');
  const to = b.point('core');
  void kit.lighting.flashLight(from.x, from.y, color, 260, 1.4, 200);
  await wait(scene, 60);
  void beam(ctx, from, to, color, 340);
  void kit.lighting.flashLight(to.x, to.y, color, 420, 2.2, 260);
  void b.playOnce('hit');
  void kit.camera.shake(180, 3);
  const spark = kit.fx.glowSprite(to.x, to.y, 0xffffff, 110, 0.75, 'front', SOFT.core);
  scene.tweens.add({ targets: spark, alpha: 0, scale: spark.scale * 1.6, duration: 320, ease: 'Quad.Out', onComplete: () => spark.destroy() });
  await wait(scene, 700);
}

const seq: HDSequence = {
  name: 'Demo: rim ışığı + saldırı + parlama',
  loopGapMs: 1200,
  async run(ctx) {
    const { scene, kit, p1, p2 } = ctx;
    await wait(scene, 500);
    // P1 roars: its rim light swells
    const rim = p1.rim;
    void p1.playOnce('roar');
    void rim?.tweenTo({ intensity: 1.8, radius: 260 }, 500, 'Quad.Out');
    void kit.lighting.flashLight(p1.x, p1.y - 60, 0x3fe0ea, 500, 1.2, 280);
    await wait(scene, 900);
    void rim?.tweenTo({ intensity: 0.95, radius: 190 }, 500, 'Quad.InOut');
    await wait(scene, 300);
    void kit.camera.zoomTo(1.08, 700, { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 - 20 });
    await strike(ctx, p1, p2, 0x3fe0ea);
    await wait(scene, 400);
    await strike(ctx, p2, p1, 0xff8a1e);
    await kit.camera.reset(500);
    await wait(scene, 200);
  },
};

export default seq;
