// The pilot's projectile (A3_MIMARI §6.2, rock-throw item 1): the boulder Taş Muhafız tore out of the floor —
// the SAME drawing its attack frames carry in the near hand (stone_sentinel-fx boulderTurn), spinning in the
// throw's whole-pixel turns, re-lit from the screen's top-left on each. The recipe 'throw' flies it for every
// `attack.vfx: 'boulder'` (recipe/strike.ts registerProjectile) from the frame after 'release'; it breaks into
// its own matter (the earth ramp of its map + its moss), not the grey body's stone. Ornament budget: ≤ 250 lines.

import { PAL } from '../../../art/palette';
import { boulderTurn } from '../../../art/monsters-v3/stone_sentinel-fx';
import { registerProjectile } from '../strike';

registerProjectile('boulder', ({ turn, turns }) => boulderTurn(turn, turns), {
  tones: [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4],
  accent: [PAL.leaf3, PAL.leaf2, PAL.leaf1],
});
