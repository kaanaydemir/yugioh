// Neon Tower painter: crowd — owner B1 (docs/v3/ARENA_NEON_TOWER.md §2 / §5 / §6).
// Will paint: spectator atlas: 8 looks x 5 poses (+ glow-stick frames), pre-baked.
// SKELETON: a placeholder swatch only. Pure PixelCanvas code (no Phaser): runs in Node for tests.

import type { PixelCanvas } from '../pixel';
import { NT_PAL } from './palette';
import { swatch } from './stub';

/** Texture key of this layer's atlas / sheet (frames named inside). */
export const NT_CROWD_KEY = 'nt:crowd';

/** Placeholder: replaced by the real painter(s) of this layer. */
export function paintCrowd(): PixelCanvas {
  void NT_PAL;
  return swatch(24, 12, NT_PAL.skin);
}
