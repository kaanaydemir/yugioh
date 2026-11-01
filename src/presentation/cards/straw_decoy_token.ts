// Saman Korkuluk (straw_decoy_token, lane D) — the S9 straw scarecrow token. Summon, strike and vanish are its own
// (src/cinematics/d/straw_decoy_token*.ts, priority 20, v3 only; the token never dies through a `destroy`: it
// leaves with `tokenVanish`); the recipe gives the body material (a blow lands on the old jacket: cloth), the
// whip strike, the plant death preset (only read if a generic death ever reaches it), the glow of its button
// eyes and its hand-made voice (_v3/sound.ts CHARACTER_SOUNDS.straw_decoy_token, src/audio/v3/straw.ts).

import { PAL } from '../../art/palette';
import type { PresentationRecipe } from '../types';

export default {
  id: 'straw_decoy_token',
  tier: 'normal',
  body: { physical: 'cloth' },
  attack: { type: 'whip', blow: 'physical', from: 'muzzle', vfx: 'strawSlap', tone: PAL.gold4 },
  summon: { style: 'assemble', matter: 'plant' },
  death: { material: 'plant', accent: 'plant' },
  flip: { accent: 'dust', ramp: 'gold' },
  voice: { custom: 'straw_decoy_token' },
  light: {
    glow: { emissive: [[PAL.gold4, 0.6], [PAL.gold3, 0.4]], halo: 0.2, pool: 0.5, spill: PAL.gold3 },
    strike: PAL.gold4,
  },
  custom: { strike: true, summon: true, death: true },
} satisfies PresentationRecipe;
