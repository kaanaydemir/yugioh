// Neon Tower layer: STANDS (grandstand structure) — owner A2 (docs/v3/ARENA_NEON_TOWER.md §2, §6).
// Will draw: the left (blue) and right (crimson) tiered stands, 3 rows each, as steps / rails with the
// dark floor around the hologram plinths. Block geometry: layout-nt.ts STANDS (feet lines, x ranges, row
// steps). The spectators are the crowd layer's job (B1); this layer provides the slots they stand in
// (STANDS + CROWD_CELL) and the steps behind them. Depth: NT_DEPTH.stands. SKELETON: a debug swatch only.

import { NT_STANDS_KEY, paintStands } from '../../art/arena-nt/stands';
import { NT_DEPTH, STANDS, standsBounds } from './layout-nt';
import { type NtCtx, type NtLayer, placeholder } from './layer';

export function createStandsLayer(ctx: NtCtx): NtLayer {
  for (const b of STANDS) {
    const r = standsBounds(b);
    placeholder(ctx, 'stands', NT_STANDS_KEY, paintStands, r.x, r.y, NT_DEPTH.stands);
  }
  return { name: 'stands', owner: 'A2', destroy() {} };
}
