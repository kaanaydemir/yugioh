// Calm arena textures (look v3): registers the layers of ./art.ts as static Phaser textures. Called
// by the boot step (src/boot/15-arena.ts) when the look is v3, and lazily by BoardViewCalm.
// Also builds the small generic arena VFX textures (AK.glow / AK.dot / AK.mote / star / beam) that
// the cinematic kits import from src/art/arena.ts in every look.

import type Phaser from 'phaser';
import { buildArenaSharedTextures } from '../../art/arena';
import { canvasTexture } from '../../art/textures';
import { CALM, type CalmArt, buildCalmArt, calmTextureBytes } from './art';

/** Boot profile of the last buildCalmTextures() (ms per part, texture bytes / count). */
export const CALM_BUILD: { ms: Record<string, number>; bytes: number; textures: number } = { ms: {}, bytes: 0, textures: 0 };

/** Which calm parts to upload (default = all, as before). The Neon Tower arena draws its own slab and background: `slab` / `bg` false skip those uploads. */
export interface CalmParts {
  slab?: boolean;
  bg?: boolean;
}

/** Build (idempotent) the calm arena textures asked for (default all) and the shared arena VFX textures. A later call may add a part an earlier one skipped. */
export function buildCalmTextures(scene: Phaser.Scene, parts: CalmParts = {}): CalmArt {
  const t0 = performance.now();
  const a = buildCalmArt();
  const want: [string, boolean][] = [
    [CALM.slab, parts.slab !== false],
    [CALM.bg, parts.bg !== false],
    [CALM.atlas, true],
  ];
  if (want.some(([k, w]) => w && !scene.textures.exists(k))) {
    const t1 = performance.now();
    let n = CALM_BUILD.textures;
    const add = (key: string, pc: CalmArt['slab']['canvas']) => {
      canvasTexture(scene, key, pc);
      n++;
    };
    if (parts.slab !== false && !scene.textures.exists(CALM.slab)) add(CALM.slab, a.slab.canvas);
    for (const [key, atlas] of [
      [CALM.bg, a.bgAtlas],
      [CALM.atlas, a.atlas],
    ] as const) {
      if (scene.textures.exists(key) || (key === CALM.bg && parts.bg === false)) continue;
      add(key, atlas.canvas);
      const tex = scene.textures.get(key);
      for (const [name, r] of atlas.frames) tex.add(name, 0, r.x, r.y, r.w, r.h);
    }
    CALM_BUILD.ms = { ...a.ms, upload: Math.round((performance.now() - t1) * 10) / 10 };
    CALM_BUILD.bytes = calmTextureBytes(a) - (parts.slab === false ? a.slab.canvas.w * a.slab.canvas.h * 4 : 0) - (parts.bg === false ? a.bgAtlas.canvas.w * a.bgAtlas.canvas.h * 4 : 0);
    CALM_BUILD.textures = n;
  }
  const fresh = !CALM_BUILD.ms.step;
  const t2 = performance.now();
  buildArenaSharedTextures(scene);
  if (fresh) {
    CALM_BUILD.ms.shared = Math.round((performance.now() - t2) * 10) / 10;
    CALM_BUILD.ms.step = Math.round((performance.now() - t0) * 10) / 10;
    const neon = (globalThis as { __neon?: Record<string, unknown> }).__neon;
    if (neon) neon.calmArena = CALM_BUILD;
  }
  return a;
}
