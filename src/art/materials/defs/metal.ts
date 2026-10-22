// metal / armour — Uçurum Büyücüsü's helm, breastplate, pauldrons and gauntlets (REHBER §2.2, binding).
// Copied from the slice: the tones of abyss_magus-maps.ts HELM / BUST / PAUL_B / PAUL_F / FIST_F /
// FIST_B (hand-placed plates: night1 … mist — six tones, as the slice painted them; IŞ-11's "≤ 5"
// does not hold for this binding row), night0 as the armour's cut tone (the maps' '0' grooves; the
// rig picks each part's separation line itself: helm and back pauldron night0, the bust void0 over
// the robe), so a seam or crease drawn ON armour is night0; mist plate edges and one white corner
// glint per plate group (the maps: "mist edge + white corner"; REHBER's text says the glint is mist),
// the far plates one value darker by hand (PAUL_B, FIST_B); death / matter = the magus' (shadow);
// the hit sound = src/audio/v3/slice.ts MATERIALS.metal (FM 1.41 clank). No plate texture.

import { PAL } from '../../palette';
import type { MaterialDef } from '../types';

const CUT = { [PAL.night0]: PAL.night0, [PAL.night1]: PAL.night0, [PAL.night2]: PAL.night0, [PAL.night3]: PAL.night0, [PAL.night4]: PAL.night0, [PAL.steel]: PAL.night0, [PAL.mist]: PAL.night0 };

export default {
  id: 'metal',
  status: 'verified',
  firstUser: 'abyss_magus',
  draw: {
    ramp: [PAL.night1, PAL.night2, PAL.night3, PAL.night4, PAL.steel, PAL.mist],
    th: [],
    farShift: 1,
    seam: CUT,
    crease: CUT,
    edge: { hi: PAL.mist, lo: null, lit: 0.35, dark: -0.35 },
    rim: null,
    glint: { tone: PAL.white, anchors: 'plate' },
    interior: null,
    noiseMax: 0.1,
  },
  hit: { sparks: [PAL.steel, PAL.mist, PAL.white], debris: null, flash: PAL.white },
  death: { shatter: 'shadow', accent: 'shadow', pass: 'dissolve', revive: 'dissolve' },
  matter: [PAL.void0, PAL.void1, PAL.void2, PAL.void3, PAL.void4],
  sound: {
    // armour: a dry clank (FM 1.41 inharmonic plate), a dull knock under it, a short buzz of the plate
    thump: [150, 46, 0.6, 0.2],
    surf: [2600, 0.45],
    ring: { kind: 'fm', f: [760, 470], ratio: 1.41, index: 3.2, dec: [0.28, 0.6] },
    sizzle: 2200,
  },
} satisfies MaterialDef;
