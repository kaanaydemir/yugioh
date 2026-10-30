import { ARENA_NT } from '../view/board-nt/flag';
import { ensureStandsTextures } from '../view/board-nt/stands';
import type { BootStep } from './types';

/**
 * Neon Tower arena (stands layer, docs/v3/ARENA_NEON_TOWER.md): builds this layer's textures — only with
 * ?look=v3&arena=nt (ARENA_NT; in every other page this step returns at once and builds nothing).
 */
const step: BootStep = {
  name: 'arena-nt-stands',
  order: 24,
  build: (scene) => {
    if (!ARENA_NT) return;
    ensureStandsTextures(scene);
  },
};
export default step;
