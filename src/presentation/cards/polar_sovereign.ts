// Kutup Hükümdarı (polar_sovereign, lane D, C15) — the fused ace. Fusion (the summon), split, strike "Pusula Fırtınası"
// and death are its own (src/cinematics/d/polar_sovereign*.ts, priority 20, v3 only); the recipe gives the body
// material (a blow on it sounds and sparks as metal), the thrown spear as a ranged projectile from the spear point,
// the death preset (only a fallback: the death ends in the three pieces' own finals, no generic material break), the
// glow of its two-colour core and crown, the cut-in rhythm (an ace: the band slams on the third KLAK's echo), and its
// hand-made voice (_v3/sound.ts CHARACTER_SOUNDS.polar_sovereign).

import { PAL } from '../../art/palette';
import type { PresentationRecipe } from '../types';

export default {
  id: 'polar_sovereign',
  tier: 'ace',
  body: { physical: 'metal' },
  attack: { type: 'projectile', blow: 'physical', from: 'muzzle', vfx: 'compassSpear', tone: PAL.fire4, ranged: true },
  summon: { style: 'assemble', matter: 'stone', shake: 4 },
  death: { material: 'stone', accent: 'crystal' },
  flip: { accent: 'sparks', ramp: 'fire' },
  voice: { custom: 'polar_sovereign' },
  light: {
    glow: { emissive: [[PAL.fire4, 0.9], [PAL.water4, 0.9], [PAL.gold4, 0.8], [PAL.white, 0.4]], halo: 0.7, pool: 1.1, spill: PAL.water3 },
    strike: PAL.fire4,
  },
  cutIn: { rhythm: { flare: 300, slam: 400, exit: 720 } },
  custom: { strike: true, summon: true, death: true, flip: true, effect: true, revive: true, position: true },
} satisfies PresentationRecipe;
