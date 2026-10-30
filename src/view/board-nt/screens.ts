// Neon Tower layer: SCREENS (portrait screens) — owner B2 (docs/v3/ARENA_NEON_TOWER.md §2, §7).
// Will draw: the two big angled digital screens on the back wall (layout-nt.ts SCREENS, 90×62 with
// frame, 80×56 portrait): the player's (blue frame, brown-haired boy in blue) and the opponent's
// (crimson frame, white-haired boy in a red coat) as pixel-art portrait maps (exactly two characters),
// a slow scanline, name labels (Turkish: OYUNCU / BİLGİSAYAR or the real names), a glow spill onto
// the wall. The active side's frame is one tone brighter. Depth: NT_DEPTH.screens.
// SKELETON: a debug swatch only.

import { NT_SCREENS_KEY, paintScreens } from '../../art/arena-nt/screens';
import { NT_DEPTH, SCREENS } from './layout-nt';
import { type NtCtx, type NtLayer, placeholder } from './layer';

export function createScreensLayer(ctx: NtCtx): NtLayer {
  for (const r of SCREENS) placeholder(ctx, 'screens', NT_SCREENS_KEY, paintScreens, r.x, r.y, NT_DEPTH.screens);
  return { name: 'screens', owner: 'B2', destroy() {} };
}
