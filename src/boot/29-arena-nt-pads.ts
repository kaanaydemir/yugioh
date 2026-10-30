import { registerPadsTextures } from '../view/board-nt/pads';
import { ARENA_NT } from '../view/board-nt/flag';
import type { BootStep } from './types';

/**
 * Neon Tower arena (pads layer, docs/v3/ARENA_NEON_TOWER.md): builds this layer's atlas (the duelists' corner pads at
 * four border levels) — only with ?look=v3&arena=nt (ARENA_NT; in every other page this step returns at once and
 * builds nothing).
 */
const step: BootStep = {
  name: 'arena-nt-pads',
  order: 29,
  build: (scene) => {
    if (!ARENA_NT) return;
    registerPadsTextures(scene);
  },
};
export default step;
