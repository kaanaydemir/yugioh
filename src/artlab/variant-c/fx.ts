// Art Lab C — effect palette: the ORIGINAL Neon Düello effects (src/cinematics/strikes-a: the
// abyss magus' void orb, the crystal wyrm's cyan/white prism, gold sparks), from the game's own
// palette (src/art/palette.ts). Ramps run dark → light; shared effect code reads only this.
//
// Two ramps double as emissive-halo detectors (core/actors.ts attachHalos): the wizard's orb and
// eyes are the pixels in the TOP THREE magic tones (mag3, void4, white), the dragon's wing glow is
// every pixel in a crystal tone. So the crystal ramp is the dragon's own glass ramp
// (variant-c/dragon-palette.ts C_GLASS: the cyan ramp with two in-betweens) WITHOUT white — the
// wyrm's hide is white too, and must not count as glowing glass.

import { PAL } from '../../art/palette';
import type { LabFxExtra } from '../core/actors';
import type { LabFxSettings } from '../types';

export const FX_C: LabFxSettings & LabFxExtra = {
  // void purple with a magenta step (the magus' mag3 accents) up to the white-hot core
  magic: [PAL.void0, PAL.void1, PAL.void2, PAL.void3, PAL.mag3, PAL.void4, PAL.white],
  // cyan prism glass (cyan0 → cyan4, the dragon's in-betweens 0x0c7f98 / 0x27c0d2)
  crystal: [PAL.cyan0, PAL.cyan1, 0x0c7f98, PAL.cyan2, 0x27c0d2, PAL.cyan3, PAL.cyan4],
  spark: [PAL.gold2, PAL.gold3, PAL.gold4, PAL.white],
  // dust kicked up from the dark slab: the night ramp's lit end
  dust: [PAL.night3, PAL.night4, PAL.steel, PAL.mist],
  sideP1: [PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white],
  sideP2: [PAL.crim0, PAL.crim1, PAL.crim2, PAL.crim3, PAL.crim4, PAL.white],
  lightMagic: PAL.void3,
  lightCrystal: PAL.cyan3,
  lightWarm: PAL.gold3,
  maxShake: 2,
  // contact shadows: the game's universal ink (the slab's own darkest tone)
  shadow: PAL.ink,
};
