// Kaya Baltacı — the presentation recipe (v3 look only; docs/v3/oturum-c-tasarim.md §2.3). The card draws its strike
// ("Dağ Yaran": spin, three steps, the bite and the Yarık seam), its entrance (the boulder rolled in and cut along a
// light seam, the nara) and its death (split in two along his own seam, a seam-burn; no stone end) itself:
// src/cinematics/kartc/crag_axeman*.ts. The flip stays on the recipe layer (the v3 flip with the dust accent);
// position and revive are generic on the art's own poses.
//   body     'stone': the only struck-body material with a hit sound that suits him (stone sparks and chips; the carved
//            axe and the stone-bead beard); the fur / skin body needs a generated 'fur' hit material (lane coordination)
//   death    the table values only matter to kits that read them (the split itself is the card's own): 'light'
//   light    the axe edge and the eyes are white; the halo stays small — the real light source is the floor seam (a
//            white-stepped strip along the line, crag_axeman-yarik.ts); the impact light is white (EF-6: warm or earth
//            light on the night floor turns to mud)
import { PAL } from '../../art/palette';
import type { PresentationRecipe } from '../types';

export default {
  id: 'crag_axeman',
  tier: 'normal',
  body: { physical: 'stone' },
  attack: { type: 'melee', blow: 'physical', from: 'muzzle', vfx: 'yarik', tone: PAL.white, blocked: 'rebound' },
  summon: { style: 'rift', matter: 'stone', roarPeak: 3 },
  death: { material: 'light', accent: 'light' },
  flip: { accent: 'dust', ramp: 'stone' },
  voice: { custom: 'crag_axeman' },
  light: { glow: { emissive: [[PAL.white, 0.6]], halo: 0.4, pool: 0.6 }, strike: PAL.white },
  custom: { strike: true, summon: true, death: true },
} satisfies PresentationRecipe;
