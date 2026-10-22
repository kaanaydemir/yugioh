// shadow / void — Uçurum Büyücüsü's death and the rift (REHBER §2.2 "Gölge / boşluk", binding).
// From the slice: void0 … void4 and ink, never white; the body dissolves in ≥ 2 px clusters in part
// space, helm and shoulders first (rigkit dissolve, abyss_magus-rig.ts dissolvePass; the revive runs
// it backwards), the pieces darken and are pulled into the floor point (vfx/shatter shadow,
// attract 900); DEATH_PRESETS / MATTER_RAMP shadow; a blow on it sounds like the magus' cloth (the
// slice's cloth recipe is "cloth + shadow"); MONSTER_GLOW / STRIKE_LIGHT of abyss_magus. Its frames
// are effect frames (IŞ-10: ≤ 20 %).

import { PAL } from '../../palette';
import type { MaterialDef } from '../types';

export default {
  id: 'shadow',
  status: 'verified',
  firstUser: 'abyss_magus',
  draw: {
    ramp: [PAL.void0, PAL.void1, PAL.void2, PAL.void3, PAL.void4],
    th: [],
    farShift: 0,
    seam: 'stepDown',
    crease: 'stepDown2',
    edge: { hi: null, lo: null, lit: 0.35, dark: -0.35 },
    rim: null,
    glint: null,
    interior: null,
    noiseMax: 0.2,
  },
  hit: { sparks: [PAL.void2, PAL.void3, PAL.void4], debris: 'wisp', flash: PAL.void4 },
  death: { shatter: 'shadow', accent: 'shadow', pass: 'dissolve', revive: 'dissolve' },
  matter: [PAL.void0, PAL.void1, PAL.void2, PAL.void3, PAL.void4],
  sound: { same: 'cloth' },
  light: { glow: PAL.void4, pool: PAL.void3 },
} satisfies MaterialDef;
