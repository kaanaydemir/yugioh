import { registerFloorTextures } from '../view/board-nt/floor';
import { ARENA_NT } from '../view/board-nt/flag';
import type { BootStep } from './types';

/**
 * Neon Tower arena (floor layer, docs/v3/ARENA_NEON_TOWER.md): builds this layer's atlas (slot frames, emblem levels,
 * dash masks) — only with ?look=v3&arena=nt (ARENA_NT; in every other page this step returns at once and builds nothing).
 */
const step: BootStep = {
  name: 'arena-nt-floor',
  order: 22,
  build: (scene) => {
    if (!ARENA_NT) return;
    registerFloorTextures(scene);
  },
};
export default step;
