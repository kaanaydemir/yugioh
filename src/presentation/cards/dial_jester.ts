// Kadran Soytarısı (dial_jester, lane D, C2) — the clockwork jester. Strike, summon, death, effect (the coin
// toss and the rewind wipe) are its own (src/cinematics/d/dial_jester*.ts, priority 20, v3 only); the recipe
// gives the body material (a blow on it rings as brass), the death preset (light: the brass crumbs after its own
// springs-and-gears pose), the flip accent, the glow of its dial / gold coin and its hand-made voice
// (_v3/sound.ts CHARACTER_SOUNDS.dial_jester, src/audio/v3/jester.ts).

import { PAL } from '../../art/palette';
import type { PresentationRecipe } from '../types';

export default {
  id: 'dial_jester',
  tier: 'normal',
  body: { physical: 'metal' },
  attack: { type: 'melee', blow: 'physical', from: 'muzzle', vfx: 'coinEdge', tone: PAL.gold4 },
  summon: { style: 'assemble', matter: 'light' },
  death: { material: 'light', accent: 'light' },
  flip: { accent: 'sparks', ramp: 'gold' },
  voice: { custom: 'dial_jester' },
  light: {
    glow: { emissive: [[PAL.gold4, 1], [PAL.mist, 0.7], [PAL.gold3, 0.6]], halo: 0.45, pool: 0.7, spill: PAL.gold3 },
    strike: PAL.gold4,
  },
  custom: { strike: true, summon: true, death: true, effect: true },
} satisfies PresentationRecipe;
