import { NT_SCREENS_KEY, paintScreens } from '../art/arena-nt/screens';
import { ARENA_NT } from '../view/board-nt/flag';
import { ensureNtTexture } from '../view/board-nt/textures';
import type { BootStep } from './types';

/**
 * Neon Tower arena (screens layer, docs/v3/ARENA_NEON_TOWER.md): builds this layer's textures — only with
 * ?look=v3&arena=nt (ARENA_NT; in every other page this step returns at once and builds nothing).
 */
const step: BootStep = {
  name: 'arena-nt-screens',
  order: 27,
  build: (scene) => {
    if (!ARENA_NT) return;
    ensureNtTexture(scene, 'screens', NT_SCREENS_KEY, paintScreens);
  },
};
export default step;
