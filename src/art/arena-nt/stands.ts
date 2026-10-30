// Neon Tower painter: stands — owner A2 (docs/v3/ARENA_NEON_TOWER.md §2 / §5 / §6).
// Will paint: left / right tiered grandstand steps, rails, the dark floor around the plinths.
// SKELETON: a placeholder swatch only. Pure PixelCanvas code (no Phaser): runs in Node for tests.

import type { PixelCanvas } from '../pixel';
import { NT_PAL } from './palette';
import { swatch } from './stub';

/** Texture key of this layer's atlas / sheet (frames named inside). */
export const NT_STANDS_KEY = 'nt:stands';

/** Placeholder: replaced by the real painter(s) of this layer. */
export function paintStands(): PixelCanvas {
  void NT_PAL;
  return swatch(24, 12, NT_PAL.back);
}
