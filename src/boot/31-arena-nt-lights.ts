import { ARENA_NT } from '../view/board-nt/flag';
import { ensureLightsTextures } from '../view/board-nt/lights';
import type { BootStep } from './types';

/**
 * Neon Tower arena (lights layer, docs/v3/ARENA_NEON_TOWER.md §11): builds this layer's atlas (the ordered-dither light
 * stipples: cones, pools, screen halos, the platform's contact glow tiles) — only with the v3 look and the Neon Tower
 * arena (ARENA_NT; in every other page this step returns at once and builds nothing).
 */
const step: BootStep = {
  name: 'arena-nt-lights',
  order: 31,
  build: (scene) => {
    if (!ARENA_NT) return;
    ensureLightsTextures(scene);
  },
};
export default step;
