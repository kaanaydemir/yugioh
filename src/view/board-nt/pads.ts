// Neon Tower layer: PADS (duelist corner pads) — owner A1 (docs/v3/ARENA_NEON_TOWER.md §2, §3).
// Will draw: the two small raised pads the duelists stand on (layout.duelistXY: P1 (213, 214) with a
// cyan border, P2 (427, 106) with a crimson one), part of the platform's top outline (PAD_C0..PAD_C1).
// The duelist sprites themselves (src/duel/DuelistView.ts) stay as they are; phase C only aligns
// their feet. Depth: NT_DEPTH.pads. SKELETON: a debug swatch only.

import { NT_PADS_KEY, paintPads } from '../../art/arena-nt/pads';
import { DUELIST_PADS, NT_DEPTH } from './layout-nt';
import { type NtCtx, type NtLayer, placeholder } from './layer';

export function createPadsLayer(ctx: NtCtx): NtLayer {
  for (const r of DUELIST_PADS) placeholder(ctx, 'pads', NT_PADS_KEY, paintPads, r.x, r.y, NT_DEPTH.pads);
  return { name: 'pads', owner: 'A1', destroy() {} };
}
