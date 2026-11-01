// Bulut Yavrusu — the presentation recipe (docs/v3/kart-a/cloud_hatchling.md §8.2), read only in the v3 look
// for the v3 art (presentation/registry v3Recipe). A normal-tier card with its own strike (Hıçkırık Halkası,
// strikes-a/cloud_hatchling.ts), entrance (the egg drop, summon-a/cloud_hatchling.ts), death (Yumurtaya
// Dönüş: knitted back into its egg, floats away on a cloud) and effect (the growth after a won dial_jester
// coin, strikes-a/cloud_hatchling-grow.ts): `custom` keeps the recipe layer's defaults off for those, so it
// registers only its flip. No emissive (§1.5): the light is a soft leaf pool under the body.

import { PAL } from '../../art/palette';
import type { PresentationRecipe } from '../types';

export default {
  id: 'cloud_hatchling',
  tier: 'normal',
  body: { physical: 'hatchhide' },
  attack: { type: 'projectile', blow: 'physical', from: 'muzzle', vfx: 'windRing', tone: PAL.mist, ranged: true, blocked: 'rebound' },
  summon: { style: 'bloom', matter: 'light', roarPeak: 4, shake: 1 },
  death: { material: 'plant', accent: 'light' },
  flip: { accent: 'mist', ramp: 'leaf' },
  // the hand-made set (src/audio/v3/hatchling.ts, CHARACTER_SOUNDS.cloud_hatchling + VARIANT_SOUNDS, §6.4)
  voice: { custom: 'cloud_hatchling' },
  light: { glow: { emissive: [], halo: 0, pool: 0.8, spill: PAL.leaf2 }, strike: PAL.mist },
  custom: { strike: true, summon: true, death: true, effect: true },
} satisfies PresentationRecipe;
