import { ARENA_NT } from '../view/board-nt/flag';
import { ensureScreenTextures } from '../view/board-nt/screens';
import type { BootStep } from './types';

/**
 * Neon Tower arena (screens layer, docs/v3/ARENA_NEON_TOWER.md): builds this layer's textures (the portrait
 * atlas: frames, the two pictures, their lit twins and the blink / wince / smile / hair-sway patches) — only with
 * ?look=v3&arena=nt (ARENA_NT; in every other page this step returns at once and builds nothing).
 */
const step: BootStep = {
  name: 'arena-nt-screens',
  order: 27,
  build: (scene) => {
    if (!ARENA_NT) return;
    ensureScreenTextures(scene);
  },
};
export default step;
