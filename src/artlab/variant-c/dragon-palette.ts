// Art Lab C — the crystal dragon's own ramps, DERIVED from the game's neon palette
// (src/art/palette.ts, imported read-only). Every tone is either a PAL colour or an in-between of
// two neighbouring PAL tones of the same family (nudged a hair toward cyan for the hide), so the
// dragon keeps the original crystal wyrm's colour identity (steel → white hide, cyan glass, gold
// horn) with more steps per ramp and no foreign hue. Ramps run dark → light.

import { PAL } from '../../art/palette';

/** Crystal hide: night3 → night4 → steel → (steel/mist) → mist → (mist/white, cyan tint) → white. */
export const C_HIDE = [PAL.night3, PAL.night4, PAL.steel, 0x8396c8, PAL.mist, 0xc6d8f0, PAL.white] as const;

/** Wing glass and crystal spikes: cyan0 → cyan4 with two in-betweens, white glints on top. */
export const C_GLASS = [PAL.cyan0, PAL.cyan1, 0x0c7f98, PAL.cyan2, 0x27c0d2, PAL.cyan3, PAL.cyan4, PAL.white] as const;

/** Gold horns (the game's gold ramp as is). */
export const C_GOLD = [PAL.gold0, PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4] as const;

/** Mouth: throat dark → tongue (the original's crimson tongue, one more step). */
export const C_MOUTH = [PAL.night0, PAL.night1, PAL.crim0, PAL.crim1, 0x9a1838] as const;

/** Outline inks: the deepest ink on the ground contact and the shadow side. */
export const C_INK = {
  /** shadow-side / ground outline (the game's universal ink, a near-black navy) */
  ink: PAL.ink,
  /** deep navy creases inside the drawing (mouth line, nostril, the darkest occlusion) */
  navy: PAL.night2,
  /** lit-side outline of the hide: a dark neon-blue line (the hide's rim against the night) */
  litHide: PAL.night4,
} as const;
