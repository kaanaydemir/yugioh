// Kutup İğnesi (polar_needle, lane D, C12) — the compass-needle dancer. Strike, summon and death are its own
// (src/cinematics/d/polar_needle*.ts, registered at priority 20, v3 only); the recipe gives the body material
// (a blow on it sounds and sparks as metal), the melee lunge, the death preset (its shell breaks as dark
// magnetite after its own rip-out pose), the flip accent, the glow of its orange N pole / blue S pole / gold
// pivot and its hand-made voice (_v3/sound.ts CHARACTER_SOUNDS.polar_needle).

import { PAL } from '../../art/palette';
import type { PresentationRecipe } from '../types';

export default {
  id: 'polar_needle',
  tier: 'normal',
  body: { physical: 'metal' },
  attack: { type: 'lunge', blow: 'physical', from: 'muzzle', vfx: 'clamp', tone: PAL.fire4 },
  summon: { style: 'assemble', matter: 'stone' },
  death: { material: 'stone', accent: 'stone' },
  flip: { accent: 'dust', ramp: 'fire' }, // 'dust' scores the flip with the voice's own land (the lock TIK)
  voice: { custom: 'polar_needle' },
  light: {
    glow: { emissive: [[PAL.fire4, 1], [PAL.water4, 0.8], [PAL.gold4, 0.6]], halo: 0.5, pool: 0.8, spill: PAL.fire3 },
    strike: PAL.fire4,
  },
  custom: { strike: true, summon: true, death: true },
} satisfies PresentationRecipe;
