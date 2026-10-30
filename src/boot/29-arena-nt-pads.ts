import { NT_PADS_KEY, paintPads } from '../art/arena-nt/pads';
import { ARENA_NT } from '../view/board-nt/flag';
import { ensureNtTexture } from '../view/board-nt/textures';
import type { BootStep } from './types';

/**
 * Neon Tower arena (pads layer, docs/v3/ARENA_NEON_TOWER.md): builds this layer's textures — only with
 * ?look=v3&arena=nt (ARENA_NT; in every other page this step returns at once and builds nothing).
 */
const step: BootStep = {
  name: 'arena-nt-pads',
  order: 29,
  build: (scene) => {
    if (!ARENA_NT) return;
    ensureNtTexture(scene, 'pads', NT_PADS_KEY, paintPads);
  },
};
export default step;
