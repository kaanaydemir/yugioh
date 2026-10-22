// crystal / glass — Kristal Ejder's wings and dorsal spines (REHBER §2.2, binding).
// Copied from the slice: crystal_wyrm-gbuf.ts MATS[GLASS] / MATS[GLASS_FAR] (hand-toned, the bias is
// the ramp index), SEAM / CREASE restricted to these tones; crystal_wyrm-rig.ts: the near wing's free
// trailing edge (white toward the light, cyan4 away, split at facing −0.05; the far / guard / flared
// wing set their own), one white glint on a facet corner (GLINT_ON cyan1–cyan3); DEATH_PRESETS /
// MATTER_RAMP crystal; the hit sound = src/audio/v3/slice.ts MATERIALS.crystal; MONSTER_GLOW /
// STRIKE_LIGHT of crystal_wyrm. The hit sparks are not a slice table (the slice keeps today's
// combat impact for its aces): the shatter's shard tones.

import { PAL } from '../../palette';
import type { MaterialDef } from '../types';

export default {
  id: 'crystal',
  status: 'verified',
  firstUser: 'crystal_wyrm',
  draw: {
    ramp: [PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white],
    th: [],
    farShift: 1,
    far: { ramp: [PAL.night1, PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4], th: [] },
    seam: { [PAL.white]: PAL.steel, [PAL.cyan4]: PAL.cyan2, [PAL.cyan3]: PAL.cyan1, [PAL.cyan2]: PAL.cyan1, [PAL.cyan1]: PAL.cyan0, [PAL.cyan0]: PAL.night0, [PAL.night1]: PAL.night0 },
    crease: { [PAL.white]: PAL.night3, [PAL.cyan4]: PAL.cyan1, [PAL.cyan3]: PAL.cyan1, [PAL.cyan2]: PAL.cyan1, [PAL.cyan1]: PAL.cyan0, [PAL.cyan0]: PAL.night0, [PAL.night1]: PAL.night0 },
    edge: { hi: PAL.white, lo: PAL.cyan4, lit: -0.05, dark: -0.05 },
    rim: null,
    glint: { tone: PAL.white, anchors: 'facet' },
    texture: { kind: 'facets', density: 6 },
    interior: null,
    noiseMax: 0.1,
  },
  hit: { sparks: [PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white], debris: 'shard', flash: PAL.white },
  death: { shatter: 'crystal', accent: 'crystal', pass: 'cracks', revive: 'gather' },
  matter: [PAL.night2, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4],
  sound: {
    // glass: a hard click, a short low knock, the body rings in bar modes (E5 / B5), shards tinkle
    thump: [170, 58, 0.55, 0.22],
    surf: [4200, 0.5],
    ring: { kind: 'bar', notes: [88, 90, 92, 95, 97, 100, 102, 104, 107], root: [83, 76], dec: [0.35, 0.8], fifth: [0.25, 0.55], rain: [0.18, 0.42], shards: [4, 9] },
    sizzle: 3300,
  },
  light: { glow: PAL.cyan4, pool: PAL.cyan4 },
} satisfies MaterialDef;
