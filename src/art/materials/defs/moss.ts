// moss — the caps on Taş Muhafız's helm, pauldrons and shield (REHBER §2.3 stone row, DRAFT until the
// pilot's acceptance). From the approved idle f0 (src/still/sentinel-map.ts): leaf3 on top, leaf2 the
// body, leaf1 the underside with 2-px drips; flat three-tone clumps (no texture, no highlight, no
// glint); the far pauldron's cap keeps the same tones (no far shift); it sits on the stone with a
// 1-px stone2 contact shadow (the stone's cast shadow, not a moss tone). REHBER asks ≤ 3 clusters of
// ≥ 2×2 px; the still keeps five (all v1 character) — an accepted exception. A blow on a cap lands on
// the stone under it (sound = stone); on its own a moss body would wither (plant); on the sentinel it
// crumbles with its block.

import { PAL } from '../../palette';
import type { MaterialDef } from '../types';

export default {
  id: 'moss',
  status: 'draft',
  firstUser: 'stone_sentinel',
  draw: {
    ramp: [PAL.leaf1, PAL.leaf2, PAL.leaf3],
    th: [-0.2, 0.55],
    farShift: 0,
    seam: { [PAL.leaf3]: PAL.leaf2, [PAL.leaf2]: PAL.leaf1, [PAL.leaf1]: PAL.leaf0 },
    crease: { [PAL.leaf3]: PAL.leaf1, [PAL.leaf2]: PAL.leaf0, [PAL.leaf1]: PAL.leaf0 },
    edge: { hi: null, lo: null, lit: 0.35, dark: -0.35 },
    rim: null,
    glint: null,
    interior: null,
    noiseMax: 0.1,
  },
  hit: { sparks: [PAL.leaf1, PAL.leaf2, PAL.leaf3], debris: 'leaf', flash: PAL.leaf3 },
  death: { shatter: 'plant', accent: 'plant', pass: 'crumble', revive: 'reassemble' },
  matter: [PAL.leaf0, PAL.leaf1, PAL.leaf2, PAL.leaf3, PAL.leaf4],
  sound: { same: 'stone' },
} satisfies MaterialDef;
