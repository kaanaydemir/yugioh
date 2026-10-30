import { ensureCrowdTextures } from '../view/board-nt/crowd';
import { ARENA_NT } from '../view/board-nt/flag';
import type { BootStep } from './types';

/**
 * Neon Tower arena (crowd layer, docs/v3/ARENA_NEON_TOWER.md): builds the spectator atlas (8 looks × 20 frames, one
 * ~100 KB texture) — only with ?look=v3&arena=nt (ARENA_NT; in every other page this step returns at once and
 * builds nothing).
 */
const step: BootStep = {
  name: 'arena-nt-crowd',
  order: 26,
  build: (scene) => {
    if (!ARENA_NT) return;
    ensureCrowdTextures(scene);
  },
};
export default step;
