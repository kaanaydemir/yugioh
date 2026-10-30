// Neon Tower layer: LIGHTS — owner C (docs/v3/ARENA_NEON_TOWER.md §8, §9).
// Will add (through src/view/light: addLight / the stepped light layer, never bloom, no lens flares):
// ceiling spotlight pools on the back wall and the platform's far side, side light pools under the
// stands, glow spilling from the holograms, the screens and the slots (blue near / red far), all
// FLAT STEPPED tones. Owner C also makes the stepped light's floor knowledge pluggable
// (src/view/light/stepped.ts padColorAt reads the calm still's topAt()). SKELETON: nothing.

import type { NtCtx, NtLayer } from './layer';

export function createLightsLayer(_ctx: NtCtx): NtLayer {
  return { name: 'lights', owner: 'C', destroy() {} };
}
