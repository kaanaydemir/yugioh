// Ace cut-in portraits (`cutin:<id>`, frames f0…, one-shot anim `cutin:<id>`) and the two
// duelist avatars (`duelist:<p>`, anims `duelist:<p>:<anim>`).
//
// The duelists are cheap and built right away. The portraits are big (200×144, ~25 frames in
// all, a few hundred ms of drawing), so they are painted in small time-sliced chunks after boot
// (the first ace summon is seconds away behind the title screen); each texture is registered only
// once all its frames exist, and whenCutinsBuilt() resolves at the end. Until then src/vfx/cutin.ts
// simply uses its monster-sprite fallback. With ?test (screenshot tooling) they are built
// synchronously so films stay deterministic.
// Robustness: the portrait registry and the duelist art belong to other modules. They are
// pulled in through eager import.meta.glob (as DuelistView does), so a missing module yields
// nothing instead of breaking every page load, and each part is built inside try/catch.
import type Phaser from 'phaser';
import type { BootStep } from './types';
import type { MonsterId } from '../data/cards';
import { sheetTexture } from '../art/textures';
import type { PixelCanvas } from '../art/pixel';
import type { PlayerId } from '../engine/types';

/** The parts of src/art/cutins/index.ts this step uses. */
interface CutinModule {
  cutinIds(): MonsterId[];
  cutinArt(id: MonsterId): { w: number; h: number; frames: number; fps: number };
  cutinFrame(id: MonsterId, frame: number): PixelCanvas;
  cutinFrameName(frame: number): string;
  cutinSequence(art: never): { frame: number; ms: number }[];
  cutinTextureKey(id: MonsterId): string;
  cutinAnimKey(id: MonsterId): string;
  markCutinsBuilt(): void;
}

/** The parts of src/art/duelists.ts this step uses. */
interface DuelistsModule {
  DUELIST_ANIMS: readonly string[];
  DUELIST_W: number;
  DUELIST_H: number;
  DUELIST_SPECS: Record<string, { frames: number; fps: number; loop: boolean }>;
  duelistTextureKey(p: PlayerId): string;
  duelistAnimKey(p: PlayerId, anim: never): string;
  duelistFrameName(anim: never, frame: number): string;
  duelistFrame(p: PlayerId, anim: never, frame: number): PixelCanvas;
}

const CUTINS: CutinModule | null = (Object.values(import.meta.glob('../art/cutins/index.ts', { eager: true }))[0] as CutinModule | undefined) ?? null;
const DUELISTS: DuelistsModule | null = (Object.values(import.meta.glob('../art/duelists.ts', { eager: true }))[0] as DuelistsModule | undefined) ?? null;

function registerCutin(scene: Phaser.Scene, C: CutinModule, id: MonsterId): void {
  const art = C.cutinArt(id);
  const frames: [string, PixelCanvas][] = [];
  for (let f = 0; f < art.frames; f++) frames.push([C.cutinFrameName(f), C.cutinFrame(id, f)]);
  const key = C.cutinTextureKey(id);
  sheetTexture(scene, key, art.w, art.h, frames);
  const ak = C.cutinAnimKey(id);
  if (scene.anims.exists(ak)) scene.anims.remove(ak);
  scene.anims.create({
    key: ak,
    // per-frame durations: hold on the stare, build to the roar, then a trembling roar hold
    frames: C.cutinSequence(art as never).map((s) => ({ key, frame: C.cutinFrameName(s.frame), duration: s.ms })),
    frameRate: art.fps,
    repeat: 0,
  });
}

function buildDuelists(scene: Phaser.Scene, D: DuelistsModule): void {
  for (const p of [0, 1] as PlayerId[]) {
    try {
      const frames: [string, PixelCanvas][] = [];
      for (const anim of D.DUELIST_ANIMS) for (let f = 0; f < D.DUELIST_SPECS[anim].frames; f++) frames.push([D.duelistFrameName(anim as never, f), D.duelistFrame(p, anim as never, f)]);
      const key = D.duelistTextureKey(p);
      sheetTexture(scene, key, D.DUELIST_W, D.DUELIST_H, frames);
      for (const anim of D.DUELIST_ANIMS) {
        const spec = D.DUELIST_SPECS[anim];
        const ak = D.duelistAnimKey(p, anim as never);
        if (scene.anims.exists(ak)) scene.anims.remove(ak);
        scene.anims.create({
          key: ak,
          frames: Array.from({ length: spec.frames }, (_, f) => ({ key, frame: D.duelistFrameName(anim as never, f) })),
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
    if (DUELISTS) buildDuelists(scene, DUELISTS);
    else console.warn('[boot] src/art/duelists.ts is missing: no duelist avatars');

    const C = CUTINS;
    if (!C) {
      console.warn('[boot] src/art/cutins is missing: cut-ins use the monster-sprite fallback');
      return;
    }
    let ids: MonsterId[] = [];
    try {
      ids = C.cutinIds();
    } catch (err) {
      console.error('[boot] cut-in registry failed', err);
    }
    const done = () => {
      try {
        C.markCutinsBuilt();
      } catch (err) {
        console.error('[boot] markCutinsBuilt failed', err);
      }
    };
    const sync = typeof location !== 'undefined' && new URLSearchParams(location.search).has('test');
    if (sync) {
      for (const id of ids) {
        try {
          registerCutin(scene, C, id);
        } catch (err) {
          console.error(`[boot] cut-in ${id} failed`, err);
        }
      }
      done();
      return;
    }
    // time-sliced: paint ~one frame per tick, register each portrait when complete
    const queue: [MonsterId, number][] = [];
    for (const id of ids) {
      try {
        for (let f = 0; f < C.cutinArt(id).frames; f++) queue.push([id, f]);
      } catch (err) {
        console.error(`[boot] cut-in ${id} failed`, err);
      }
    }
    const tick = () => {
      const t0 = performance.now();
      while (queue.length && performance.now() - t0 < 10) {
        const [id, f] = queue.shift()!;
        try {
          C.cutinFrame(id, f);
          const last = queue.length === 0 || queue[0][0] !== id;
          if (last) registerCutin(scene, C, id);
        } catch (err) {
          // a broken portrait is skipped (its frames too); the others still build
          console.error(`[boot] cut-in ${id} failed`, err);
          while (queue.length && queue[0][0] === id) queue.shift();
        }
      }
      if (queue.length) setTimeout(tick, 0);
      else done();
    };
    setTimeout(tick, 0);
  },
};
export default step;
