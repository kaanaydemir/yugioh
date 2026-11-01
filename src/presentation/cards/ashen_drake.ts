// Kül Ejderi — the presentation recipe (docs/v3/kart-a/ashen_drake.md §8.2), read only in the v3 look for
// the v3 art (presentation/registry v3Recipe). An ace: its strike, entrance and death are its own files
// (custom; strikes-a/ashen_drake.ts, summon-a/ashen_drake.ts — the cinematics stage), so the recipe layer
// registers only its flip. The light follows the ember heart ONLY (fire4 / gold4 / fire3; the hem's fire2 /
// fire1 are not emissive): the idle's LUB … DUB makes the floor pool double-pulse (§4.1). Lane-A shared hooks
// that landed: the 'ash' shatter (death settles as ash) and attack.ramp 'fire' (the ignition flash is fire,
// not DARK violet).

import { PAL } from '../../art/palette';
import type { PresentationRecipe } from '../types';

export default {
  id: 'ashen_drake',
  tier: 'ace',
  body: { physical: 'ash' },
  attack: { type: 'beam', blow: 'magic', from: 'muzzle', vfx: 'ashCone', tone: PAL.fire3, ranged: true, blocked: 'splash', ramp: 'fire' },
  summon: { style: 'vortex', matter: 'stone', roarPeak: 4 },
  death: { material: 'ash', accent: 'fire' },
  flip: { accent: 'sparks', ramp: 'fire' },
  // the hand-made set (src/audio/v3/ashen.ts, CHARACTER_SOUNDS.ashen_drake, §6.4)
  voice: { custom: 'ashen_drake' },
  light: {
    glow: { emissive: [[PAL.fire4, 1], [PAL.gold4, 1], [PAL.fire3, 0.4]], halo: 0.65, pool: 1.0, spill: PAL.void2 },
    strike: PAL.fire3,
  },
  cutIn: { rhythm: { flare: 300, slam: 430, exit: 720 } },
  custom: { strike: true, summon: true, death: true },
} satisfies PresentationRecipe;
