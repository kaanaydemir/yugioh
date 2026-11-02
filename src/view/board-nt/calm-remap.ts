// Readability pass (docs/v3/ref/hedef-gorunum-2.png): the background of the Neon Tower arena reads as dark,
// desaturated grey stone instead of saturated navy + neon. Applied once, at texture registration
// (./textures.ts), to the background layers only (wall, stands, seats, platform hull, apron). Colours stay
// inside src/art/palette.ts: every PAL tone maps onto another PAL tone. Warm tones (gold, fire, earth,
// skin) are kept, so torches and the key light stay warm.

import { PAL } from '../../art/palette';
import type { PixelCanvas } from '../../art/pixel';

/** Layers whose textures go through the calm remap. */
// Owner decision 2026-11-02: the target is hedef-gorunum-1 (navy / violet colours) with hedef-2's fog and
// torches, so the grey remap is OFF (kept for a later A/B: list the layers here to turn it back on).
export const CALM_LAYERS: ReadonlySet<string> = new Set<string>([]);

const MAP = new Map<number, number>([
  // navy → grey stone (one step brighter at the bottom so the hall is not pitch black)
  [PAL.night0, PAL.stone0],
  [PAL.night1, PAL.stone0],
  [PAL.night2, PAL.stone1],
  [PAL.night3, PAL.stone1],
  [PAL.night4, PAL.stone2],
  [PAL.steel, PAL.stone2],
  [PAL.mist, PAL.stone3],
  [PAL.white, PAL.stone3],
  // violet accents → stone
  [PAL.void0, PAL.stone0],
  [PAL.void1, PAL.stone1],
  [PAL.void2, PAL.stone1],
  [PAL.void3, PAL.stone2],
  [PAL.void4, PAL.stone3],
  // neon: two tones down (a faint coloured seam, no glow)
  [PAL.cyan1, PAL.cyan0],
  [PAL.cyan2, PAL.cyan0],
  [PAL.cyan3, PAL.cyan1],
  [PAL.cyan4, PAL.cyan1],
  [PAL.crim1, PAL.crim0],
  [PAL.crim2, PAL.crim0],
  [PAL.crim3, PAL.crim1],
  [PAL.crim4, PAL.crim1],
  [PAL.mag1, PAL.mag0],
  [PAL.mag2, PAL.mag0],
  [PAL.mag3, PAL.mag1],
  [PAL.mag4, PAL.mag1],
  [PAL.teal1, PAL.teal0],
  [PAL.teal2, PAL.teal0],
  [PAL.teal3, PAL.teal1],
  [PAL.teal4, PAL.teal1],
  [PAL.water1, PAL.water0],
  [PAL.water2, PAL.water0],
  [PAL.water3, PAL.water1],
  [PAL.water4, PAL.water1],
]);

/** A remapped copy of `pc` (the source canvas may be cached by its painter: never mutated). */
export function calmRemap(pc: PixelCanvas): PixelCanvas {
  return pc.clone().map((c) => MAP.get(c) ?? c);
}
