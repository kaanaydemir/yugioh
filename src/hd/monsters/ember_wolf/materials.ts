// Kor Kurdu HD — materials. Charcoal fur (cool navy shadows, grey-violet tops) against living
// flame (emissive fire ramp fire1 → fire3 → fire4 → gold4 → white core). All tones come from
// src/art/palette.ts. The flames also LIGHT the fur: see fire.ts (warm tone table below).

import { PAL } from '../../../art/palette';
import { MAT, farSide, material, variant } from '../../render';

/** Charcoal fur: 6 clean bands, clump lines between overlapping tufts. */
export const FUR = material({
  name: 'emberFur',
  ramp: [PAL.night0, PAL.night1, PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3],
  gamma: 0.86,
  wrap: 0.42,
  clumpLines: true,
  outline: { dark: PAL.void0, lit: PAL.night2 },
  line: PAL.void0,
});

/** Far-side limbs / ear: one step darker. */
export const FUR_FAR = farSide(FUR, PAL.void0);

/** Smooth hide (muzzle bridge, paws): same ramp, no clump lines. */
export const HIDE = variant(FUR, { name: 'emberHide', clumpLines: false, occlusion: 0.5, gamma: 0.85 });
export const HIDE_FAR = farSide(HIDE, PAL.void0);

/** Inner ear: an ember-lit bowl glowing from the mane behind it. */
export const EAR_IN = material({
  name: 'earIn',
  ramp: [PAL.fire0, PAL.crim0, PAL.fire1, PAL.fire2],
  gamma: 1.1,
  wrap: 0.4,
  outline: { dark: PAL.void0, lit: PAL.fire0 },
  line: PAL.void0,
  rim: false,
});

/** Wet black nose with a cold glint. */
export const NOSE = material({
  name: 'nose',
  ramp: [PAL.ink, PAL.night0, PAL.void0, PAL.night1, PAL.night2],
  gamma: 1.2,
  wrap: 0.2,
  spec: { power: 22, min: 0.88, color: PAL.night3 },
  outline: { dark: PAL.ink, lit: PAL.night0 },
  line: PAL.ink,
  despeckle: false,
});

/** Fangs: bone white, warm-lit from the furnace below. */
export const TOOTH = material({
  name: 'tooth',
  ramp: [PAL.stone2, PAL.stone3, PAL.stone4, PAL.white],
  gamma: 0.8,
  wrap: 0.5,
  outline: { dark: PAL.night0, lit: PAL.stone1 },
  line: PAL.night0,
  despeckle: false,
});

/** Claws: hot horn (tips glow). */
export const CLAW = material({
  name: 'claw',
  ramp: [PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4],
  gamma: 0.9,
  wrap: 0.4,
  outline: { dark: PAL.void0, lit: PAL.stone1 },
  line: PAL.void0,
  despeckle: false,
});

/** Living flame (emissive). */
export const FLAME = MAT.flame;

/** Furnace inside the jaws (emissive; heat from the throat outward). */
export const FURNACE = variant(MAT.flame, { name: 'furnace', outline: { dark: PAL.fire0, lit: PAL.fire1 } });

/** Tongue: dark crimson, lit from above by the furnace (warm top). */
export const TONGUE = material({
  name: 'tongue',
  ramp: [PAL.crim0, PAL.crim1, PAL.crim2, PAL.fire2, PAL.fire3],
  gamma: 1,
  wrap: 0.3,
  outline: { dark: PAL.void0, lit: PAL.crim0 },
  line: PAL.void0,
  rim: false,
});

/** Glowing amber eyes. */
export const EYE = MAT.eyeAmber;

/**
 * Warm tone table for fur lit by its own flames: fur color → [faint, lit, hot]. Shadows turn
 * deep ember red, mid tones fire1/fire2, the light tops fire3/fire4. Applied per pixel in fire.ts.
 */
export const WARM = new Map<number, readonly [number, number, number]>([
  [PAL.void0, [PAL.void0, PAL.fire0, PAL.fire1]],
  [PAL.night0, [PAL.fire0, PAL.fire0, PAL.fire1]],
  [PAL.night1, [PAL.fire0, PAL.fire1, PAL.fire1]],
  [PAL.stone0, [PAL.fire0, PAL.fire1, PAL.fire2]],
  [PAL.stone1, [PAL.fire1, PAL.fire1, PAL.fire2]],
  [PAL.stone2, [PAL.fire1, PAL.fire2, PAL.fire3]],
  [PAL.stone3, [PAL.fire2, PAL.fire3, PAL.fire4]],
  [PAL.stone4, [PAL.fire3, PAL.fire4, PAL.gold4]],
  // tooth / claw ramp tops
  [PAL.white, [PAL.gold4, PAL.gold4, PAL.white]],
  // nose
  [PAL.ink, [PAL.ink, PAL.fire0, PAL.fire0]],
  [PAL.night2, [PAL.fire0, PAL.fire1, PAL.fire1]],
  [PAL.night3, [PAL.fire1, PAL.fire1, PAL.fire2]],
  // inner ear
  [PAL.fire0, [PAL.fire0, PAL.fire1, PAL.fire1]],
  [PAL.crim0, [PAL.fire1, PAL.fire1, PAL.fire2]],
  [PAL.fire1, [PAL.fire1, PAL.fire2, PAL.fire2]],
]);
