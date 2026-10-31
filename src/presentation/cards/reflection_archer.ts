// Yansıyan Okçu (reflection_archer, lane D, C4) — the light-woven moon archer and its living reflection. Strike,
// summon and death are its own (src/cinematics/d/reflection_archer.ts, priority 20, v3 only); the recipe gives the
// body material (a blow on it rings as crystal/glass), the projectile line, the death preset (it breaks as glass,
// light accent), the glow of its gold bow / white body / crown and its hand-made voice
// (_v3/sound.ts CHARACTER_SOUNDS.reflection_archer, src/audio/v3/archer.ts).

import { PAL } from '../../art/palette';
import type { PresentationRecipe } from '../types';

export default {
  id: 'reflection_archer',
  tier: 'normal',
  body: { physical: 'crystal' },
  attack: { type: 'projectile', blow: 'magic', from: 'muzzle', vfx: 'prism', tone: PAL.gold4, ranged: true },
  summon: { style: 'pool', matter: 'light' },
  death: { material: 'crystal', accent: 'light' },
  flip: { accent: 'drop', ramp: 'gold' },
  voice: { custom: 'reflection_archer' },
  light: {
    glow: { emissive: [[PAL.gold4, 1], [PAL.white, 1], [PAL.gold3, 0.6]], halo: 0.6, pool: 0.9, spill: PAL.water3 },
    strike: PAL.gold4,
  },
  custom: { strike: true, summon: true, death: true },
} satisfies PresentationRecipe;
