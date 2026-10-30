// Neon Tower — which PAL ramp paints what (docs/v3/ARENA_NEON_TOWER.md §5). Colours ONLY from
// src/art/palette.ts: no ramp is added (checked in the plan: every needed hue exists; tools/palcheck.mjs
// stays the gate). The arena is DARK and calm: bright neon is only ever a 1-px line.

import { PAL, RAMPS } from '../palette';

export const NT_PAL = {
  /** outline of everything (1 px) */
  ink: PAL.ink,
  /** very dark navy / violet backdrop: wall, floor far from the platform, stand steps */
  back: [PAL.ink, PAL.night0, PAL.night1, PAL.void0] as const,
  /** the platform's metal: hull / armour bands dark → light (night0 … steel) + 1 glint (mist) */
  metal: [PAL.night0, PAL.night1, PAL.night2, PAL.night3, PAL.night4, PAL.steel] as const,
  glint: PAL.mist,
  /** the plain graphite top plate and its seams */
  graphite: [PAL.stone0, PAL.stone1, PAL.stone2] as const,
  /** the player's blue half: slot borders, energy strips, screen frame, glow sticks */
  blue: RAMPS.cyan,
  /** the opponent's red half */
  red: RAMPS.crim,
  /** violet: the right hologram, the wall's ambient accents, banners */
  violet: RAMPS.void,
  /** the crystal hologram's body (blue-white): the cyan ramp + white */
  crystal: [PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white] as const,
  /** white: only for one-pixel glints and the emblem's core, never a fill */
  white: PAL.white,
  /** warm gold: spectators' hair / the tiny centre emblem accent only */
  gold: RAMPS.gold,
  /** skin tones of the spectators */
  skin: RAMPS.skin,
} as const;
