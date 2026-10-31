// Neon Tower — the two hologram colour looks (owner B2, docs/v3/ARENA_NEON_TOWER.md §9). The creatures themselves are painted in
// holo-dragon.ts (Kristal Ejder, blue-white crystal) and holo-magus.ts (Uçurum Büyücüsü, violet / magenta) from these ramps; the pedestal,
// rings, cone, flare and glows in holo.ts use them too. Everything is a PAL colour, no alpha.

import { PAL } from '../palette';

export interface HoloLook {
  /** six tones, dark → light (ramp[5] is white-ish) */
  ramp: readonly [number, number, number, number, number, number];
  /** the creature faces left in the arena (the right hologram) */
  flip: boolean;
}

export const HOLO_LOOKS: readonly [HoloLook, HoloLook] = [
  // Kristal Ejder: deep blue, blue, bright azure, ice, pale ice, white
  { ramp: [PAL.water0, PAL.water1, PAL.water2, PAL.water3, PAL.water4, PAL.white], flip: false },
  // Uçurum Büyücüsü: ink violet, violet, bright violet, magenta, lilac, white
  { ramp: [PAL.void1, PAL.void2, PAL.void3, PAL.mag3, PAL.void4, PAL.white], flip: true },
];
