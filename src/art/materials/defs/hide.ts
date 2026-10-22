// hide — Kristal Ejder's pale scaled body (REHBER §2.2 "Pullu deri (açık)", binding).
// Copied from the slice: crystal_wyrm-gbuf.ts MATS[HIDE] (lit by thresholds: the big calm white plane)
// and MATS[HIDE_FAR] (one value darker with its own thresholds), SEAM / CREASE restricted to these
// tones, the rim light (rimLight's cyan2 over night2 / night3 / steel), the near wing bone's edge
// paint (white toward the light from facing 0.12, crystal_wyrm-rig.ts); death / matter = the wyrm's
// (crystal); a blow on the hide sounds like glass (REHBER: "Darbe ve ses: kristal (gövde camdır)" —
// the slice plays hitCrystal* for any blow on the wyrm). Scale notches only on the mid / shadow
// planes, ≥ 3 px apart.

import { PAL } from '../../palette';
import type { MaterialDef } from '../types';

export default {
  id: 'hide',
  status: 'verified',
  firstUser: 'crystal_wyrm',
  draw: {
    ramp: [PAL.night2, PAL.night3, PAL.steel, PAL.mist, PAL.white],
    th: [-0.62, -0.28, 0.14, 0.56],
    farShift: 1,
    far: { ramp: [PAL.night1, PAL.night2, PAL.night3, PAL.steel, PAL.mist], th: [-0.55, -0.1, 0.3, 0.72] },
    seam: { [PAL.white]: PAL.steel, [PAL.mist]: PAL.steel, [PAL.steel]: PAL.night3, [PAL.night3]: PAL.night2, [PAL.night2]: PAL.night1, [PAL.night1]: PAL.night0 },
    crease: { [PAL.white]: PAL.night3, [PAL.mist]: PAL.night3, [PAL.steel]: PAL.night3, [PAL.night3]: PAL.night2, [PAL.night2]: PAL.night1, [PAL.night1]: PAL.night0 },
    edge: { hi: PAL.white, lo: null, lit: 0.12, dark: -0.35 },
    rim: PAL.cyan2,
    glint: null,
    texture: { kind: 'scales', density: 3 },
    interior: null,
    noiseMax: 0.1,
  },
  hit: { sparks: [PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white], debris: 'shard', flash: PAL.white },
  death: { shatter: 'crystal', accent: 'crystal', pass: 'cracks', revive: 'gather' },
  matter: [PAL.night2, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4],
  sound: { same: 'crystal' },
} satisfies MaterialDef;
