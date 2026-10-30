// Neon Tower layer: PLATFORM — owner A1 (docs/v3/ARENA_NEON_TOWER.md §2, §5, §8).
// Will draw: the ONE raised isometric metal battle platform around the existing tiles — layered armour
// side panels, corner armour, embedded energy strips (blue near / red far, dim → bright), a few vents,
// the contact shadow under it, a plain graphite top. Geometry: layout-nt.ts PLATE_* (footprint = the calm
// slab's, so the HUD relations stay). Depth: NT_DEPTH.shadow / platform / platformFx.
// Handover: when this layer is real, BoardViewNt passes skip.slab = true to BoardViewCalm.
// SKELETON: a debug swatch only.

import { NT_PLATFORM_KEY, paintPlatform } from '../../art/arena-nt/platform';
import { NT_DEPTH, PLATE_TOP } from './layout-nt';
import { type NtCtx, type NtLayer, placeholder } from './layer';

export function createPlatformLayer(ctx: NtCtx): NtLayer {
  placeholder(ctx, 'platform', NT_PLATFORM_KEY, paintPlatform, PLATE_TOP.x, PLATE_TOP.y, NT_DEPTH.platform);
  return { name: 'platform', owner: 'A1', destroy() {} };
}
