// Kabuk Zıpkıncı (tide_harpooner) — lane C, C1 (★ ace, Sv5; docs/v3/oturum-c-tasarim.md §2.1).
// The strike (twirl – throw – haul, the game's only PULL), the entrance (the tide uncovers the conch) and the Körfez
// kalkanı are the card's own (src/cinematics/kartc/tide_harpooner*.ts, priority 0 / 20). Death and flip stay on the
// recipe layer (A3_MIMARI §6.3 gotcha: all four custom would have to reproduce today's tables) — the card decorates
// them at priority 20 (the burial in sand, the standing harpoon that splinters).
// body: the shell has no generated hit material (GENERATED_HIT_MATERIALS is pinned): 'water' gives no hit recipe, so
// the generic body blow plays and the card's 'defend' watcher replaces it with the seashell tok on the contact frame.

import { PAL } from '../../art/palette';
import type { PresentationRecipe } from '../types';

export default {
  id: 'tide_harpooner',
  tier: 'ace',
  body: { physical: 'water' },
  attack: { type: 'projectile', blow: 'physical', from: 'muzzle', vfx: 'harpoon', tone: PAL.water4, ranged: true },
  summon: { style: 'surge', matter: 'water', roarPeak: 3 },
  // §5.2: drawn into the shell, the shell buried in wet sand (the pose does it); the last apex pixels go as water
  death: { material: 'water', accent: 'water' },
  flip: { accent: 'drop' },
  voice: { custom: 'tide_harpooner' },
  light: {
    // nacre and bubbles (water4), the harpoon tip (white), the two eyes (gold4) — never the player cyan
    glow: { emissive: [[PAL.water4, 0.8], [PAL.white, 0.8], [PAL.gold4, 0.4]], halo: 0.6, pool: 0.9 },
    strike: PAL.water4,
  },
  cutIn: { rhythm: { flare: 300, slam: 420, exit: 720 } },
  custom: { strike: true, summon: true, effect: true },
} satisfies PresentationRecipe;
