// Sazlık Balıkçılı (reed_heron) — lane C, C8 (docs/v3/oturum-c-tasarim.md §2.2). Normal tier, no effect.
// Its strike (the coil, the 200 ms freeze, two gliding strides, ta-ta-TAK) and its summon (mist wall → eye glint →
// the mist parts, he is already there → one wing fan) are its own (src/cinematics/kartc/reed_heron.ts: `custom`).
// The death and the flip stay on the recipe layer (docs/v3/oturum-c-mimari.md §3.4 gotcha): the death is the v3
// death kit on the heron's own `death` pose (wings close, the back-step, the mist takes him bottom-up), and the
// card's own 'destroyed' hook (priority 20) keeps only the reeds and one ripple ring on the water — the body never
// shatters ('water' is the API material; the kit's break is skipped because the mist has already taken him).
// body: 'water' gives no generic material hit (the heron scores its own feather + water struck sound).

import { PAL } from '../../art/palette';
import type { PresentationRecipe } from '../types';

export default {
  id: 'reed_heron',
  tier: 'normal',
  body: { physical: 'water' },
  attack: { type: 'melee', blow: 'physical', from: 'muzzle', vfx: 'beakTriple', tone: PAL.white, blocked: 'rebound', ranged: false },
  summon: { style: 'pool', matter: 'water', roarPeak: 3 },
  death: { material: 'water', accent: 'plant' },
  flip: { accent: 'mist', ramp: 'water' },
  voice: { custom: 'reed_heron' },
  // the dimmest presence on the board: the gold eye and the beak's one white glint; no halo of its own
  light: { glow: { emissive: [[PAL.gold4, 1], [PAL.white, 0.5]], halo: 0.3, pool: 0.4 }, strike: PAL.white },
  custom: { strike: true, summon: true },
} satisfies PresentationRecipe;
