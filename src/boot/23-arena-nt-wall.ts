import { NT_WALL_KEY, paintWall } from '../art/arena-nt/wall';
import { ARENA_NT } from '../view/board-nt/flag';
import { ensureNtTexture } from '../view/board-nt/textures';
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
    ensureNtTexture(scene, 'wall', NT_WALL_KEY, paintWall);
  },
};
export default step;
