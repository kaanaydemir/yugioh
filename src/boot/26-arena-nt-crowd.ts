import { ensureCrowdTextures } from '../view/board-nt/crowd';
import { ARENA_NT } from '../view/board-nt/flag';
import type { BootStep } from './types';

/**
 * Neon Tower arena (crowd layer, docs/v3/ARENA_NEON_TOWER.md): the arena has NO spectators any more (owner decision);
 * this step builds only the tiny empty-seat atlas (2 teams × 3 variants × 4 LED levels of 9×14, ≈ 6 KB) — only with
 * ?look=v3&arena=nt (ARENA_NT; in every other page this step returns at once and builds nothing).
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
