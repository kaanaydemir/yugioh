// hatchhide — Bulut Yavrusu's (cloud_hatchling) soft leaf-green hide (docs/v3/kart-a/cloud_hatchling.md
// §1.3, §3.4, §6.5). PLACEHOLDER written by the lane-A shared-infrastructure step so the generated
// hitHatchhide* names exist from now on; the cloud_hatchling builder owns this file and tunes every
// value (status stays 'draft' until the card is accepted).
// Sound, phase 1: `{ same: 'cloth' }` (soft, no ring) — a blow on it plays hitCloth*, and the generated
// hitHatchhide* recipes (cloth's parameters) stay silent. Phase 2 needs no shared edit: give `sound`
// its own MaterialSound here (a soft rubbery thump + a shell tick) and hitSfxName switches to hitHatchhide*.

import { PAL, RAMPS } from '../../palette';
import type { MaterialDef } from '../types';

export default {
  id: 'hatchhide',
  status: 'draft',
  firstUser: 'cloud_hatchling',
  draw: {
    ramp: [PAL.leaf1, PAL.leaf2, PAL.leaf3, PAL.leaf4], // leaf4 the big calm lit plane, leaf1 the crease
    th: [-0.85, -0.2, 0.45],
    farShift: 1,
    far: { ramp: [PAL.leaf0, PAL.leaf1, PAL.leaf2, PAL.leaf3], th: [-0.85, -0.2, 0.45] },
    seam: 'stepDown',
    crease: 'stepDown2',
    edge: { hi: null, lo: null, lit: 0.4, dark: -0.35 },
    rim: PAL.water4, // the sky's reflection: the only rim colour on the hide
    glint: null, // the anim's one glint sits on the eggshell, not on the hide
    texture: { kind: 'scales', density: 4 },
    interior: null,
    noiseMax: 0.1,
  },
  hit: { sparks: [PAL.leaf3, PAL.leaf4, PAL.white], debris: 'wisp', flash: PAL.mist },
  death: { shatter: 'plant', accent: 'light', pass: 'dissolve', revive: 'gather' },
  matter: RAMPS.leaf, // = MATTER_RAMP.plant
  sound: { same: 'cloth' },
  light: { pool: PAL.leaf2 },
} satisfies MaterialDef;
