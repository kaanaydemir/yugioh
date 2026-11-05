// Bozkır Boynuzlusu (steppe_spiralhorn) — lane C, C11 (docs/v3/oturum-c-tasarim.md §2.5). Normal tier, no effect.
// Its strike ("Bozkır Sıçrayışı": rear – bound, bound, BOUND – the upward horn toss – the seed burst – rebound) and its
// summon (the gust grass wave, one long bound in from off screen, the tiptoe landing, honk + flute) are its own
// (src/cinematics/kartc/steppe_spiralhorn*.ts: `custom`). The death and the flip stay on the recipe layer
// (docs/v3/oturum-c-mimari.md §3.4 gotcha): the death is the v3 death kit on the saiga's own `death` pose (kneel, the
// coat turns to grass, the wind takes the mound, the horns go last as two plumes), decorated at priority 20 by the
// card's own 'destroyed' watcher (the fold thuds, the seed stream carried on past the frame, the two plumes lifting off).
// body: hide + horn has no struck-sound material (GENERATED_HIT_MATERIALS is pinned to stone), and 'hide' maps to the
//   crystal ring — so the body names a library material WITHOUT a hit recipe ('scale') and the card's own defend hook
//   scores the struck hide + keratin tick (sshStruck / sshGuardClack) on the contact frame.
// death: §5.2 — the seed / grass cloud on the wind is drawn by the pose; the kit's last-frame break of the remaining
//   stub (the plumes) goes as LIGHT motes drifting up (never rubble, ash, feathers or pollen); the accent is plant (a few
//   grass bits falling off while it dies).
// light: §2.5 "Light" — gold4 (the horn tips) 1.0, leaf4 (wind curls, grass tips) 0.5, halo 0.5, pool 0.7; the contact
//   light is a small white pool.

import { PAL } from '../../art/palette';
import type { PresentationRecipe } from '../types';

export default {
  id: 'steppe_spiralhorn',
  tier: 'normal',
  body: { physical: 'scale' },
  attack: { type: 'melee', blow: 'physical', from: 'muzzle', vfx: 'hornToss', tone: PAL.white, blocked: 'rebound', ranged: false },
  summon: { style: 'swoop', matter: 'plant', roarPeak: 3 },
  death: { material: 'light', accent: 'plant' },
  flip: { accent: 'dust', ramp: 'leaf' },
  voice: { custom: 'steppe_spiralhorn' },
  light: { glow: { emissive: [[PAL.gold4, 1], [PAL.leaf4, 0.5]], halo: 0.5, pool: 0.7 }, strike: PAL.white },
  custom: { strike: true, summon: true },
} satisfies PresentationRecipe;
