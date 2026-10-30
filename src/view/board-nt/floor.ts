// Neon Tower layer: FLOOR (slots / grid) — owner A1 (docs/v3/ARENA_NEON_TOWER.md §2, §7, §8).
// Will draw: the slot art on the top plate — thin glowing borders (dim when empty), the neutral dark
// centre strip with the tiny original emblem, field / banish / graveyard / deck pads; for 5+5 and 3+3
// (slots only where zoneXY says there is a zone). Hover / selection highlight, flashes, pulses, the
// ignition and the volcano theme stay in BoardViewCalm (the floor ENGINE, it keeps zoneAt / tileImage
// aligned) until this layer re-skins its pad frames (§7). Depth: NT_DEPTH.floor / floorFx.
// SKELETON: a debug swatch only.

import { NT_FLOOR_KEY, paintFloor } from '../../art/arena-nt/floor';
import { CENTER_EMBLEM, NT_DEPTH } from './layout-nt';
import { type NtCtx, type NtLayer, placeholder } from './layer';

export function createFloorLayer(ctx: NtCtx): NtLayer {
  placeholder(ctx, 'floor', NT_FLOOR_KEY, paintFloor, CENTER_EMBLEM.x, CENTER_EMBLEM.y, NT_DEPTH.floor);
  return { name: 'floor', owner: 'A1', destroy() {} };
}
