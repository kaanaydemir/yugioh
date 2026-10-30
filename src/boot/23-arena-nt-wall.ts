import { ARENA_NT } from '../view/board-nt/flag';
import { ensureWallTextures } from '../view/board-nt/wall';
import type { BootStep } from './types';

/**
 * Neon Tower arena (wall layer, docs/v3/ARENA_NEON_TOWER.md): builds this layer's textures — only with
 * ?look=v3&arena=nt (ARENA_NT; in every other page this step returns at once and builds nothing).
 */
const step: BootStep = {
  name: 'arena-nt-wall',
  order: 23,
  build: (scene) => {
    if (!ARENA_NT) return;
    ensureWallTextures(scene);
  },
};
export default step;
