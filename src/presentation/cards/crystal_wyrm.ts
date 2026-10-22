// Kristal Ejder — the slice ace (A2). Every part is the card's own (L5, `custom`): the recipe layer
// registers nothing for it and the slice plays exactly as it did. The recipe DOCUMENTS the data the
// shared kits read for it, with today's table values (A3_MIMARI §6.3): STRIKE_KIND, STRIKE_LIGHT,
// RANGED, ROAR_PEAK, DEATH_PRESETS, MONSTER_GLOW, the cut-in RHYTHM, _v3/sound.ts materialOf (crystal
// to every blow) and its hand-made sound set (CHARACTER_SOUNDS.crystal_wyrm). In the v3 look the
// accessors read these values through the bridge; tests/presentation/accessors-v3.test.ts proves they
// equal the tables.

import { PAL } from '../../art/palette';
import type { PresentationRecipe } from '../types';

export default {
  id: 'crystal_wyrm',
  tier: 'ace',
  body: { physical: 'crystal' },
  attack: { type: 'beam', blow: 'magic', from: 'muzzle', vfx: 'prism', tone: PAL.cyan4, ranged: true },
  summon: { style: 'column', matter: 'crystal', roarPeak: 3 },
  death: { material: 'crystal', accent: 'crystal' },
  flip: { accent: 'sparks' },
  voice: { custom: 'crystal_wyrm' },
  light: {
    glow: { emissive: [[PAL.cyan4, 1], [PAL.cyan3, 0.65], [PAL.gold4, 1], [PAL.gold3, 0.6]], halo: 0.7, pool: 1.1, spill: PAL.cyan3 },
    strike: PAL.cyan4,
  },
  cutIn: { rhythm: { flare: 320, slam: 410, exit: 740 } },
  custom: { strike: true, summon: true, death: true, flip: true, effect: true, revive: true, position: true },
} satisfies PresentationRecipe;
