// Neon Tower painter: screens — owner B2 (docs/v3/ARENA_NEON_TOWER.md §2 / §5 / §6).
// Will paint: the two portrait screens: frame, 80x56 portrait maps (exactly two duelists), scanline, name labels.
// SKELETON: a placeholder swatch only. Pure PixelCanvas code (no Phaser): runs in Node for tests.

import type { PixelCanvas } from '../pixel';
import { NT_PAL } from './palette';
import { swatch } from './stub';

/** Texture key of this layer's atlas / sheet (frames named inside). */
export const NT_SCREENS_KEY = 'nt:screens';

/** Placeholder: replaced by the real painter(s) of this layer. */
export function paintScreens(): PixelCanvas {
  void NT_PAL;
  return swatch(24, 12, NT_PAL.blue);
}
