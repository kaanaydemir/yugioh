import { ARENA_NT } from '../view/board-nt/flag';
import { ensureHoloTextures } from '../view/board-nt/holograms';
import type { BootStep } from './types';

/**
 * Neon Tower arena (holograms layer, docs/v3/ARENA_NEON_TOWER.md): builds the static hologram atlas (plinth rings,
 * light pools, cones, motes) — only with ?look=v3&arena=nt (ARENA_NT; in every other page this step returns at
 * once and builds nothing). The creature frames are baked later, in slices, by the layer itself (after the
 * monster sheets are painted).
 */
const step: BootStep = {
  name: 'arena-nt-holograms',
  order: 28,
  build: (scene) => {
    if (!ARENA_NT) return;
    ensureHoloTextures(scene);
  },
};
export default step;
