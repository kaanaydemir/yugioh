// Kristal Ejder HD — materials. Built only from palette colors (src/art/palette.ts) on top of the
// render library presets: a white / ice-blue crystal hide with plate edge light and a little
// light transmission, pale ventral plates, glowing crystal (spikes, blade, claws), translucent
// faceted wing glass, polished gold horns, the mouth and the emissive eye / energy.

import { PAL } from '../../../art/palette';
import { MAT, farSide, material, variant } from '../../render';

/** Crystal hide: navy-violet core shadows, steel / mist mid tones, white top, warm glint. */
export const HIDE = material({
  name: 'wyrmHide',
  ramp: [PAL.night1, PAL.night2, PAL.night3, PAL.night4, PAL.steel, PAL.mist, PAL.white],
  thresholds: [0.08, 0.17, 0.28, 0.4, 0.52, 0.7],
  wrap: 0.35,
  transmit: 0.25,
  spec: { power: 60, min: 0.985, color: PAL.white },
  outline: { dark: PAL.night0, lit: PAL.night3 },
  line: PAL.night1,
});

export const HIDE_FAR = farSide(HIDE, PAL.night0);

/** Hide with crystal edge light: the lit side of every facet ridge gets a 1 px bright edge. */
export const HIDE_EDGE = variant(HIDE, { name: 'wyrmHideEdge', edgeLight: true, spec: { power: 60, min: 0.985, color: PAL.white } });
export const HIDE_EDGE_FAR = farSide(HIDE_EDGE, PAL.night0);

/** Ventral plates (throat, chest, belly, tail underside): paler, ice-blue tinted. */
export const BELLY = material({
  name: 'wyrmBelly',
  ramp: [PAL.night2, PAL.night3, PAL.steel, PAL.mist, PAL.cyan4, PAL.white],
  thresholds: [0.1, 0.22, 0.38, 0.56, 0.78],
  wrap: 0.45,
  spec: { power: 40, min: 0.96, color: PAL.white },
  outline: { dark: PAL.night0, lit: PAL.night3 },
  line: PAL.night1,
});

export const BELLY_FAR = farSide(BELLY, PAL.night1);

/** Glowing crystal (spikes, tail blade, claws, elbow spurs). */
export const CRYS = variant(MAT.crystal, { name: 'wyrmCrystal' });
export const CRYS_FAR = farSide(MAT.crystal, PAL.night1);

/** Translucent faceted wing glass. */
export const GLASS = variant(MAT.glass, {
  name: 'wyrmGlass',
  edgeLight: true,
  wrap: 0.3,
  thresholds: [0.12, 0.26, 0.4, 0.52, 0.7, 0.9],
  translucent: { alpha: 0.82, behind: -1 },
});

/** Far wing glass: one step deeper, a little more see-through. */
export const GLASS_FAR = variant(farSide(GLASS, PAL.night0), { name: 'wyrmGlassFar', translucent: { alpha: 0.78, behind: -1 } });

/** Polished gold horns: both outline tones dark (a thin horn's diagonal edge would otherwise read serrated). */
export const GOLD = variant(MAT.gold, { name: 'wyrmGold', outline: { dark: PAL.void0, lit: PAL.gold0 } });
export const GOLD_FAR = farSide(GOLD, PAL.void0);

export const MOUTH = MAT.mouth;
export const ENERGY = MAT.energy;
export const EYE = MAT.eyeCyan;
