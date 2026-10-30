// Neon Tower layer: CROWD (spectators) — owner B1 (docs/v3/ARENA_NEON_TOWER.md §6).
// Will draw: ~80 tiny pixel-art spectators (8 looks × 5 poses: sitting, standing, clapping, arms up,
// glow stick) as plain Images on ONE pre-baked atlas (one draw batch), standing on the slots of
// layout-nt.ts STANDS; blue glow sticks on the left, red on the right. Animation: a few scene-clock
// timers swap atlas frames, DESYNCHRONISED loops (every spectator has its own phase + period from a
// seeded stream; no per-spectator tween). Reactions: crowd(kind, side, power) and onGameEvent (summon =
// stand up + cheer on that side, attack declare = lean forward, big damage = gasp, destroy = groan) as
// short overrides that decay back to the loop. Depth: NT_DEPTH.crowd / crowdFx.
// SKELETON: no spectators yet (debug swatch only); the reaction entry points exist and do nothing.

import type { PlayerId } from '../../engine/types';
import { NT_CROWD_KEY, paintCrowd } from '../../art/arena-nt/crowd';
import type { CrowdReaction } from './api';
import { NT_DEPTH, STANDS, standsBounds } from './layout-nt';
import { type NtCtx, type NtLayer, placeholder } from './layer';

export function createCrowdLayer(ctx: NtCtx): NtLayer {
  const r = standsBounds(STANDS[0]);
  placeholder(ctx, 'crowd', NT_CROWD_KEY, paintCrowd, r.x, r.y, NT_DEPTH.crowd);
  return {
    name: 'crowd',
    owner: 'B1',
    crowd(_kind: CrowdReaction, _side: PlayerId | null, _power: number) {
      /* B1: short reaction override */
    },
    destroy() {},
  };
}
