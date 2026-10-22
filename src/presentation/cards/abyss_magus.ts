// Uçurum Büyücüsü — the slice ace (A2). Every part is the card's own (L5, `custom`): the recipe layer
// registers nothing for it and the slice plays exactly as it did. The recipe DOCUMENTS the data the
// shared kits read for it, with today's table values (A3_MIMARI §6.3): STRIKE_KIND, STRIKE_LIGHT,
// RANGED, ROAR_PEAK, DEATH_PRESETS, MONSTER_GLOW, the cut-in RHYTHM, _v3/sound.ts materialOf (metal
// armour to a body blow, cloth + shadow to a spell) and its hand-made sound set
// (CHARACTER_SOUNDS.abyss_magus). In the v3 look the accessors read these values through the bridge;
// tests/presentation/accessors-v3.test.ts proves they equal the tables.

import { PAL } from '../../art/palette';
import type { PresentationRecipe } from '../types';

export default {
  id: 'abyss_magus',
  tier: 'ace',
  body: { physical: 'metal', magic: 'cloth' },
  attack: { type: 'projectile', blow: 'magic', from: 'staff', vfx: 'darkOrb', tone: PAL.void3, ranged: true },
  summon: { style: 'rift', matter: 'shadow', roarPeak: 3 },
  death: { material: 'shadow', accent: 'shadow' },
  flip: { accent: 'mist' },
  voice: { custom: 'abyss_magus' },
  light: {
    glow: { emissive: [[PAL.void4, 1], [PAL.white, 1], [PAL.mag4, 1], [PAL.mag3, 0.9], [PAL.mag2, 0.4]], near: [[PAL.void3, 0.9]], halo: 1, pool: 1 },
    strike: PAL.void3,
  },
  cutIn: { rhythm: { flare: 250, slam: 320, exit: 660 } },
  custom: { strike: true, summon: true, death: true, flip: true, effect: true, revive: true, position: true },
} satisfies PresentationRecipe;
