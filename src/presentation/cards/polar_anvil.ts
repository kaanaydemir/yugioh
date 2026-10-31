// Kutup Örsü (polar_anvil, lane D, C13) — the living magnetite anvil. Strike, summon and death are its own
// (src/cinematics/d/polar_anvil*.ts, registered at priority 20, v3 only); the recipe gives the body material
// (a blow on it sounds and sparks as metal), the ranged flag (the push wave is a ranged blow), the death
// preset (it breaks as dark stone-iron after its own repulsion pose), the flip accent, the glow of its blue
// field / orange N pole / gold welds and its hand-made voice (_v3/sound.ts CHARACTER_SOUNDS.polar_anvil).

import { PAL } from '../../art/palette';
import type { PresentationRecipe } from '../types';

export default {
  id: 'polar_anvil',
  tier: 'normal',
  body: { physical: 'metal' },
  attack: { type: 'slam', blow: 'physical', from: 'muzzle', vfx: 'pushWave', tone: PAL.water4, ranged: true },
  summon: { style: 'assemble', matter: 'stone' },
  death: { material: 'stone', accent: 'stone' },
  flip: { accent: 'dust', ramp: 'water' }, // 'dust' scores the flip with the voice's own land (the KLAK)
  voice: { custom: 'polar_anvil' },
  light: {
    glow: { emissive: [[PAL.water4, 1], [PAL.water3, 0.6], [PAL.fire3, 0.8], [PAL.gold4, 0.5]], halo: 0.55, pool: 0.9, spill: PAL.water3 },
    strike: PAL.water4,
  },
  custom: { strike: true, summon: true, death: true },
} satisfies PresentationRecipe;
