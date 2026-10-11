import { buildArenaTextures } from '../art/arena';
import { buildArenaV2Textures } from '../art/arena-v2';
import { ARENA_V2 } from '../view/layout';
import type { BootStep } from './types';

/**
 * Arena textures: sky, stadium, platform slab, zone tiles, highlight / lava art.
 * Arena v2 (?arena=v2, demo.html) builds its own "floodlit night match" set instead.
 */
const step: BootStep = { name: 'arena', order: 15, build: (scene) => (ARENA_V2 ? buildArenaV2Textures(scene) : buildArenaTextures(scene)) };
export default step;
