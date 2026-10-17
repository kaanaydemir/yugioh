import { buildArenaSharedTextures, buildArenaTextures } from '../art/arena';
import { buildArenaV2Textures } from '../art/arena-v2';
import { buildCalmTextures } from '../view/board-calm/textures';
import { ARENA_V2, LOOK_V3 } from '../view/layout';
import type { BootStep } from './types';

/**
 * Arena textures: sky, stadium, platform slab, zone tiles, highlight / lava art.
 * Arena v2 (?arena=v2, demo.html) builds its own "floodlit night match" set instead, and the v3
 * look (?look=v3) the calm arena of the still preview (src/view/board-calm, ~2 MB).
 * Every look ends with the small generic arena VFX textures (AK.glow / AK.dot / AK.mote, star,
 * beam) that the cinematic kits import from src/art/arena.ts (idempotent: the v1 and v2 builders
 * already made them, so this only adds them where a look does not).
 */
const step: BootStep = {
  name: 'arena',
  order: 15,
  build: (scene) => {
    if (LOOK_V3) buildCalmTextures(scene);
    else if (ARENA_V2) buildArenaV2Textures(scene);
    else buildArenaTextures(scene);
    buildArenaSharedTextures(scene);
  },
};
export default step;
