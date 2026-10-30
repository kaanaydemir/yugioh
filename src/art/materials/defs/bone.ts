// bone — Hortlak Muhafız's skull, ribs, spine and limb bones (REHBER §2.3 style: 3 planes per ramp,
// creases one step down, no speckle texture; DRAFT until the first user is accepted).
// A warm, aged ivory — the only warm body ramp among the cold grey / blue / violet monsters, which is
// most of what keeps a skeleton knight apart from the stone sentinel and the shadow assassin:
// skin0 (cut) · skin1 (deep groove) · earth3 (shadow plane) · earth4 (mid plane) · skin4 (lit plane).
// Dies as a revenant does — the body darkens and is pulled into the floor (shatter 'shadow', the
// rigkit dissolve pass: violet clusters and rising motes), with bone chips as the accent; comes back
// the same way backwards. A blow on bone sounds like stone (a hollow knock and a gravel trickle).

import { PAL } from '../../palette';
import type { MaterialDef } from '../types';

export default {
  id: 'bone',
  status: 'draft',
  firstUser: 'grim_warden',
  draw: {
    ramp: [PAL.skin0, PAL.skin1, PAL.earth3, PAL.earth4, PAL.skin4],
    th: [],
    farShift: 1,
    seam: 'stepDown',
    crease: 'stepDown2',
    edge: { hi: PAL.skin4, lo: null, lit: 0.35, dark: -0.35 },
    rim: null,
    glint: { tone: PAL.white, anchors: 'edge' },
    interior: null,
    noiseMax: 0.1,
  },
  hit: { sparks: [PAL.earth3, PAL.earth4, PAL.skin4], debris: 'chip', flash: PAL.skin4 },
  death: { shatter: 'shadow', accent: 'stone', pass: 'dissolve', revive: 'dissolve' },
  matter: [PAL.void0, PAL.void1, PAL.void2, PAL.void3, PAL.void4],
  sound: { same: 'stone' },
  light: { glow: PAL.cyan3, pool: PAL.void3 },
} satisfies MaterialDef;
