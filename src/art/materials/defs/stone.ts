// stone — Taş Muhafız (the A3 pilot), later Magma Titanı's rock (REHBER §2.3, DRAFT until the pilot's
// acceptance). Tones and rules from the approved idle f0, src/still/sentinel-map.ts: three planes per
// block — stone3 lit (left- and top-facing, the largest plane), stone2 mid (front-facing, the turn),
// stone1 shadow (right-facing, undersides); stone0 only for carved cuts (a negative bias) and creases;
// stone4 only as the 1-px edge of light-facing blocks. Creases at most two steps below the plane they
// fall on (lit → stone1, mid → stone0, shadow → stone0), seams one step, never ink inside the stone.
// The far side one value darker (the far pauldron and leg: stone2 top, stone1 front, stone0 sole).
// Masonry courses ~4 px high, no speckle texture (the still: isolated pixels 1.9 %). Death = today's
// DEATH_PRESETS.stone_sentinel (stone: chunks bounce once and lie as rubble), the crumble / reassemble
// passes arrive with the pilot (Y8). Sound: a low rumble + gravel, brown noise, no ring (REHBER §2.3,
// SE-5), rendered by src/audio/v3/materials.ts as hitStoneLight / Heavy / Magic. The strike light =
// today's STRIKE_LIGHT.stone_sentinel.
//
// Thresholds on n·L for the key light (−0.50, −0.74, 0.46): top 0.74 and left 0.50 → stone3, front
// 0.46 and a 45° front-right turn −0.03 → stone2, right −0.50 and the underside −0.74 → stone1; no
// surface facing the viewer gets below −0.89, so stone0 comes only with a cut's negative bias.

import { PAL } from '../../palette';
import type { MaterialDef } from '../types';

export default {
  id: 'stone',
  status: 'draft',
  firstUser: 'stone_sentinel',
  draw: {
    ramp: [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3],
    th: [-0.9, -0.15, 0.48],
    farShift: 1,
    far: { ramp: [PAL.stone0, PAL.stone0, PAL.stone1, PAL.stone2], th: [-0.9, -0.15, 0.48] },
    seam: { [PAL.stone4]: PAL.stone3, [PAL.stone3]: PAL.stone2, [PAL.stone2]: PAL.stone1, [PAL.stone1]: PAL.stone0, [PAL.stone0]: PAL.stone0 },
    crease: { [PAL.stone4]: PAL.stone2, [PAL.stone3]: PAL.stone1, [PAL.stone2]: PAL.stone0, [PAL.stone1]: PAL.stone0, [PAL.stone0]: PAL.stone0 },
    edge: { hi: PAL.stone4, lo: null, lit: 0.35, dark: -0.35 },
    rim: null,
    glint: null,
    texture: { kind: 'courses', density: 4 },
    interior: null,
    noiseMax: 0.1,
  },
  hit: { sparks: [PAL.stone2, PAL.stone3, PAL.stone4], debris: 'chip', flash: PAL.stone4 },
  death: { shatter: 'stone', accent: 'stone', pass: 'crumble', revive: 'reassemble' },
  matter: [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4],
  sound: {
    thump: [110, 36, 0.55, 0.3],
    surf: [3000, 0.42],
    ring: { kind: 'rumble', f: 70, grit: 1 },
    sizzle: 4200,
  },
  light: { pool: PAL.earth3 },
} satisfies MaterialDef;
