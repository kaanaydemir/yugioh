// cloth — Uçurum Büyücüsü's cape, robe, skirt and sleeves (REHBER §2.2 "Kumaş", binding).
// Copied from the slice (abyss_magus-rig.ts): bands measured from the part's own edge (hand-toned:
// void3 lit band, void2 body, void1 fold valley), void0 as the cloth's cut tone (the robe parts'
// separation lines comp(…, { out / in: PAL.void0 }), the sleeve mouth, the far hem), so a seam or
// crease drawn ON cloth is void0; the far skirt / sleeve one value darker by hand,
// no chrome highlight (MA-3), the rim on the edge facing the light (the cape: steel; mist above y 40,
// void3 in the P2 relight — one value per material here); death / matter = the magus' (shadow); the
// hit sound = src/audio/v3/slice.ts MATERIALS.cloth (the robe snaps, the shadow exhales; no ring).
// The magus' slate tabard and wrap follow the same cloth rules on night2 … night4.

import { PAL } from '../../palette';
import type { MaterialDef } from '../types';

const SEP = { [PAL.void0]: PAL.void0, [PAL.void1]: PAL.void0, [PAL.void2]: PAL.void0, [PAL.void3]: PAL.void0 };

export default {
  id: 'cloth',
  status: 'verified',
  firstUser: 'abyss_magus',
  draw: {
    ramp: [PAL.void1, PAL.void2, PAL.void3],
    th: [],
    farShift: 1,
    seam: SEP,
    crease: SEP,
    edge: { hi: null, lo: null, lit: 0.35, dark: -0.35 },
    rim: PAL.steel,
    glint: null,
    interior: null,
    noiseMax: 0.1,
  },
  hit: { sparks: [PAL.void2, PAL.void3, PAL.void4], debris: 'wisp', flash: PAL.void4 },
  death: { shatter: 'shadow', accent: 'shadow', pass: 'dissolve', revive: 'dissolve' },
  matter: [PAL.void0, PAL.void1, PAL.void2, PAL.void3, PAL.void4],
  sound: {
    // cloth + shadow: no ring — a muffled thud, the robe snapping, a dark exhale of the shadow
    thump: [120, 40, 0.65, 0.26],
    surf: [900, 0.3],
    ring: { kind: 'flutter', band: [2100, 1000], dec: [0.07, 0.16] },
    sizzle: 1600,
  },
} satisfies MaterialDef;
