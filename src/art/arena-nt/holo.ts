// Neon Tower painter: holo — owner B2 (docs/v3/ARENA_NEON_TOWER.md §2 / §5 / §6).
// Will paint: hologram plinths + rings, translucent creature frames baked from the monsters' v3 idle (scanline mask).
// SKELETON: a placeholder swatch only. Pure PixelCanvas code (no Phaser): runs in Node for tests.

import type { PixelCanvas } from '../pixel';
import { NT_PAL } from './palette';
import { swatch } from './stub';

/** Texture key of this layer's atlas / sheet (frames named inside). */
export const NT_HOLO_KEY = 'nt:holo';

/** Placeholder: replaced by the real painter(s) of this layer. */
export function paintHolo(): PixelCanvas {
  void NT_PAL;
  return swatch(24, 12, NT_PAL.crystal);
}
