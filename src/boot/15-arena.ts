import { buildArenaTextures } from '../art/arena';
import type { BootStep } from './types';

/** Arena textures: sky, stadium, platform slab, zone tiles, highlight / lava art. */
const step: BootStep = { name: 'arena', order: 15, build: (scene) => buildArenaTextures(scene) };
export default step;
