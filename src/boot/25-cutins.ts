// Ace cut-in portraits (`cutin:<id>`, frames f0…, one-shot anim `cutin:<id>`) and the two
// duelist avatars (`duelist:<p>`, anims `duelist:<p>:<anim>`).
//
// The duelists are cheap and built right away. The portraits are big (200×144, ~25 frames in
// all, a few hundred ms of drawing), so they are painted in small time-sliced chunks after boot
// (the first ace summon is seconds away behind the title screen); each texture is registered only
// once all its frames exist, and whenCutinsBuilt() resolves at the end. Until then src/vfx/cutin.ts
// simply uses its monster-sprite fallback. With ?test (screenshot tooling) they are built
// synchronously so films stay deterministic.
import type Phaser from 'phaser';
import type { BootStep } from './types';
import type { MonsterId } from '../data/cards';
import { cutinAnimKey, cutinArt, cutinFrame, cutinFrameName, cutinIds, cutinSequence, cutinTextureKey, markCutinsBuilt } from '../art/cutins';
import { sheetTexture } from '../art/textures';
import type { PixelCanvas } from '../art/pixel';
import type { PlayerId } from '../engine/types';
import { DUELIST_ANIMS, DUELIST_H, DUELIST_SPECS, DUELIST_W, duelistAnimKey, duelistFrame, duelistFrameName, duelistTextureKey } from '../art/duelists';

function registerCutin(scene: Phaser.Scene, id: MonsterId): void {
  const art = cutinArt(id);
  const frames: [string, PixelCanvas][] = [];
  for (let f = 0; f < art.frames; f++) frames.push([cutinFrameName(f), cutinFrame(id, f)]);
  const key = cutinTextureKey(id);
  sheetTexture(scene, key, art.w, art.h, frames);
  const ak = cutinAnimKey(id);
  if (scene.anims.exists(ak)) scene.anims.remove(ak);
  scene.anims.create({
    key: ak,
    // per-frame durations: hold on the stare, build to the roar, then a trembling roar hold
    frames: cutinSequence(art).map((s) => ({ key, frame: cutinFrameName(s.frame), duration: s.ms })),
    frameRate: art.fps,
    repeat: 0,
  });
}

function buildDuelists(scene: Phaser.Scene): void {
  for (const p of [0, 1] as PlayerId[]) {
    try {
      const frames: [string, PixelCanvas][] = [];
      for (const anim of DUELIST_ANIMS) for (let f = 0; f < DUELIST_SPECS[anim].frames; f++) frames.push([duelistFrameName(anim, f), duelistFrame(p, anim, f)]);
      const key = duelistTextureKey(p);
      sheetTexture(scene, key, DUELIST_W, DUELIST_H, frames);
      for (const anim of DUELIST_ANIMS) {
        const spec = DUELIST_SPECS[anim];
        const ak = duelistAnimKey(p, anim);
        if (scene.anims.exists(ak)) scene.anims.remove(ak);
        scene.anims.create({
          key: ak,
          frames: Array.from({ length: spec.frames }, (_, f) => ({ key, frame: duelistFrameName(anim, f) })),
          frameRate: spec.fps,
          repeat: spec.loop ? -1 : 0,
        });
      }
    } catch (err) {
      console.error(`[boot] duelist ${p} failed`, err);
    }
  }
}

const step: BootStep = {
  name: 'cutins',
  order: 25,
  build(scene) {
    buildDuelists(scene);

    const ids = cutinIds();
    const sync = typeof location !== 'undefined' && new URLSearchParams(location.search).has('test');
    if (sync) {
      for (const id of ids) {
        try {
          registerCutin(scene, id);
        } catch (err) {
          console.error(`[boot] cut-in ${id} failed`, err);
        }
      }
      markCutinsBuilt();
      return;
    }
    // time-sliced: paint ~one frame per tick, register each portrait when complete
    const queue: [MonsterId, number][] = [];
    for (const id of ids) for (let f = 0; f < cutinArt(id).frames; f++) queue.push([id, f]);
    const tick = () => {
      const t0 = performance.now();
      try {
        while (queue.length && performance.now() - t0 < 10) {
          const [id, f] = queue.shift()!;
          cutinFrame(id, f);
          const last = queue.length === 0 || queue[0][0] !== id;
          if (last) registerCutin(scene, id);
        }
      } catch (err) {
        console.error('[boot] cut-in build failed', err);
      }
      if (queue.length) setTimeout(tick, 0);
      else markCutinsBuilt();
    };
    setTimeout(tick, 0);
  },
};
export default step;
