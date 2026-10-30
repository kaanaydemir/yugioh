import { registerPlatformTextures } from '../view/board-nt/platform';
import { ARENA_NT } from '../view/board-nt/flag';
import type { BootStep } from './types';

/**
 * Neon Tower arena (platform layer, docs/v3/ARENA_NEON_TOWER.md): builds this layer's textures (the body with its
 * contact shadow, the fx atlas) — only with ?look=v3&arena=nt (ARENA_NT; in every other page this step returns at
 * once and builds nothing).
 */
const step: BootStep = {
  name: 'arena-nt-platform',
  order: 21,
  build: (scene) => {
    if (!ARENA_NT) return;
    registerPlatformTextures(scene);
  },
};
export default step;
