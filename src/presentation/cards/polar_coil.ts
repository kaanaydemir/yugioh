// Kutup Bobini (polar_coil, lane D, C14) — the living copper coil. Strike, summon and death are its own
// (src/cinematics/d/polar_coil*.ts, registered at priority 20, v3 only); the recipe gives the body material
// (a blow on it sounds and sparks as metal), the ranged flag (the orbiting spikes are a ranged blow), the death
// preset (the bare magnetite spindle breaks as stone after its own unwinding pose), the flip accent, the glow
// of its two-colour core (N orange / S blue) and copper winding, and its hand-made voice
// (_v3/sound.ts CHARACTER_SOUNDS.polar_coil).

import { PAL } from '../../art/palette';
import type { PresentationRecipe } from '../types';

export default {
  id: 'polar_coil',
  tier: 'normal',
  body: { physical: 'metal' },
  attack: { type: 'projectile', blow: 'physical', from: 'muzzle', vfx: 'orbitSpikes', tone: PAL.gold4, ranged: true },
  summon: { style: 'assemble', matter: 'stone' },
  death: { material: 'stone', accent: 'stone' },
  flip: { accent: 'sparks', ramp: 'fire' },
  voice: { custom: 'polar_coil' },
  light: {
    glow: { emissive: [[PAL.fire3, 0.9], [PAL.water4, 0.8], [PAL.gold4, 0.6]], halo: 0.5, pool: 0.85, spill: PAL.fire2 },
    strike: PAL.gold4,
  },
  custom: { strike: true, summon: true, death: true },
} satisfies PresentationRecipe;
