// Hurda Akıncıları (scrap_raiders, lane D, C5) — the scrap cart-tank. Strike, summon, death and the
// attack-then-defense position change (the tired guard, the lock's end) are its own (src/cinematics/d/scrap_raiders.ts,
// priority 20, v3 only); the recipe gives the body material (a blow on it clangs as metal), the death preset (the
// scrap heap breaks as dark stone-iron with the stove's embers, after its own collapse pose), the flip accent, the
// glow of its stove door / fire / ram spikes and its hand-made voice (_v3/sound.ts CHARACTER_SOUNDS.scrap_raiders,
// src/audio/v3/raiders.ts).

import { PAL } from '../../art/palette';
import type { PresentationRecipe } from '../types';

export default {
  id: 'scrap_raiders',
  tier: 'normal',
  body: { physical: 'metal' },
  attack: { type: 'lunge', blow: 'physical', from: 'muzzle', vfx: 'ramCharge', tone: PAL.fire4 },
  summon: { style: 'assemble', matter: 'stone' },
  death: { material: 'stone', accent: 'fire' },
  flip: { accent: 'sparks', ramp: 'fire' },
  voice: { custom: 'scrap_raiders' },
  light: {
    glow: { emissive: [[PAL.fire4, 1], [PAL.fire3, 0.7], [PAL.gold4, 0.5]], halo: 0.5, pool: 0.85, spill: PAL.fire3 },
    strike: PAL.fire4,
  },
  custom: { strike: true, summon: true, death: true, position: true },
} satisfies PresentationRecipe;
