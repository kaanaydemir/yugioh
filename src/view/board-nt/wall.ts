// Neon Tower layer: WALL (tower + emblem + back walls) — owner A2 (docs/v3/ARENA_NEON_TOWER.md §2, §3, §8).
// Will draw: the dark navy / violet back wall (panels, LED strips, banners), the tall symmetrical dark
// metal tower at the back centre with the ORIGINAL winged-shield tournament emblem and the small
// corridor, and the dark floor behind the platform (replaces BoardViewCalm's ink base + bg masks:
// BoardViewNt then passes skip.background = true). Static art + one or two slow glints. Rich but calm:
// bright neon only as 1-px lines. Depth: NT_DEPTH.wall / wallLights. SKELETON: a debug swatch only.

import { NT_WALL_KEY, paintWall } from '../../art/arena-nt/wall';
import { NT_DEPTH, TOWER } from './layout-nt';
import { type NtCtx, type NtLayer, placeholder } from './layer';

export function createWallLayer(ctx: NtCtx): NtLayer {
  placeholder(ctx, 'wall', NT_WALL_KEY, paintWall, TOWER.x, TOWER.y, NT_DEPTH.wall);
  return { name: 'wall', owner: 'A2', destroy() {} };
}
