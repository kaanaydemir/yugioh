// Zehir Ejderi — the presentation recipe (docs/v3/kart-a/venom_drake.md §8.1), read only in the v3 look for
// the v3 art (presentation/registry v3Recipe). An ace: its strike ("Zehir Havanı" / "Zehir Sağanağı"), entrance
// ("Zehirli Sis" + cut-in), death ("Kendi Zehri") and flip (three drops roll off the card) are its own files
// (src/cinematics/kart-a/venom_drake-*.ts), so the recipe layer registers nothing for it. The glob is matter:
// blow 'physical' keeps hit<Mat>Magic's sizzle off the held breath after the splat (§5.2). The body breaks as
// shadow (darkened, pulled to the floor point: it sinks into its pool) with the lane-A 'acid' accent (falling
// acid drops, a dark acid pool, no white orbit). The light follows the acid only (the bulb, the sac, the beads).

import { PAL } from '../../art/palette';
import type { PresentationRecipe } from '../types';

export default {
  id: 'venom_drake',
  tier: 'ace',
  body: { physical: 'venomscale' },
  attack: { type: 'projectile', blow: 'physical', from: 'muzzle', vfx: 'venomGlob', tone: PAL.leaf3, direct: 'projectile', blocked: 'splash', ranged: true, ramp: 'leaf' },
  summon: { style: 'pool', matter: 'shadow', roarPeak: 9 },
  death: { material: 'shadow', accent: 'acid' },
  // no `flip` field: 'drop' is RAMPS.water + waterSplash and ramp 'leaf' brings leaf4 (the custom flip, §5.1)
  // the hand-made set (src/audio/v3/venom.ts, CHARACTER_SOUNDS.venom_drake, §6)
  voice: { custom: 'venom_drake' },
  light: {
    glow: { emissive: [[PAL.gold4, 1], [PAL.gold3, 1], [PAL.leaf3, 0.6], [PAL.gold2, 0.5]], halo: 0.5, pool: 0.85, spill: PAL.leaf2 },
    strike: PAL.leaf3,
  },
  cutIn: { rhythm: { flare: 280, slam: 360, exit: 720 } },
  custom: { strike: true, summon: true, death: true, flip: true },
} satisfies PresentationRecipe;
