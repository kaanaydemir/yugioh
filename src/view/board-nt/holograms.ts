// Neon Tower layer: HOLOGRAMS — owner B2 (docs/v3/ARENA_NEON_TOWER.md §2, §7).
// Will draw: two big translucent holograms on round pedestals with light rings (layout-nt.ts HOLOS):
// left = Kristal Ejder (crystal_wyrm, blue-white), right = Uçurum Büyücüsü (abyss_magus, violet), ALWAYS
// these two (user decision). Built from the monsters' own v3 idle frames (monsterFrame), recoloured to
// one ramp, scanline-masked, 1× integer scale; idle = slow frame loop + stepped opacity flicker +
// a scan sweep + a few motes + the ring; a summon on that side (onGameEvent 'summon') = a short strong
// flare. Never a lookalike of any trading-card monster: these are our own designs. Depth: NT_DEPTH.holoPed /
// holo / holoFx. SKELETON: a debug swatch only.

import { NT_HOLO_KEY, paintHolo } from '../../art/arena-nt/holo';
import { HOLOS, NT_DEPTH } from './layout-nt';
import { type NtCtx, type NtLayer, placeholder } from './layer';

export function createHologramsLayer(ctx: NtCtx): NtLayer {
  for (const h of HOLOS) placeholder(ctx, 'holograms', NT_HOLO_KEY, paintHolo, h.box.x, h.box.y, NT_DEPTH.holo);
  return { name: 'holograms', owner: 'B2', destroy() {} };
}
