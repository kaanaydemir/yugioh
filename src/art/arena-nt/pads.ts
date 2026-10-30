// Neon Tower painter: pads — owner A1 (docs/v3/ARENA_NEON_TOWER.md §2 / §5 / §6).
// Will paint: the two small raised duelist corner pads (cyan / crimson border).
// SKELETON: a placeholder swatch only. Pure PixelCanvas code (no Phaser): runs in Node for tests.

import type { PixelCanvas } from '../pixel';
import { NT_PAL } from './palette';
import { swatch } from './stub';

/** Texture key of this layer's atlas / sheet (frames named inside). */
export const NT_PADS_KEY = 'nt:pads';

/** Placeholder: replaced by the real painter(s) of this layer. */
export function paintPads(): PixelCanvas {
  void NT_PAL;
  return swatch(24, 12, NT_PAL.metal);
}
