// basalt — Magma Titanı's rock (REHBER §2.3 stone row, DRAFT until the titan's acceptance in A4.1).
// The stone family one value darker and glassy: the same three planes per block and the same light
// thresholds as `stone` (the pilot's approved still, src/still/sentinel-map.ts), every tone one step
// down the ramp —
//   stone2 lit (top- and light-facing, the largest plane of a block), stone1 mid (front, the turn),
//   stone0 shadow (away from the light, undersides), night0 only for carved cuts (a negative bias:
//   the eye sockets, the core socket rim, a crack's cold groove) and creases on the shadow plane;
// — and, what makes it glass rather than masonry, a crisp 1-px stone3 edge on the light-facing
// silhouette of the big near blocks (boulders, head, fists, knee caps, feet: `edge.hi`) and at most
// one stone4 glint per anim on a facet corner (IŞ-8). No courses, no speckle: basalt is plates and
// facets ≥ 6 px, split by creases; its texture is the lava (`lava`, drawn as light after the outline).
// Creases at most two steps below the plane they fall on (lit → stone0, mid → stone0, shadow →
// night0), seams one step, never ink inside the rock (IŞ-9). The far side one value darker.
// Death = today's DEATH_PRESETS.magma_titan (stone that breaks with a fire accent: "soğuma + moloz",
// the lava drains first — `lava.death`), the crumble / reassemble passes arrive with the pilot (Y8).
// Sound: the stone rumble, lower and with a brighter, glassier surface transient; a draft — nothing
// plays it until the audio generator lists it (src/audio/v3/materials.ts GENERATED_HIT_MATERIALS, A4.1).
//
// Thresholds on n·L for the key light (−0.50, −0.74, 0.46), as `stone`: top 0.74 and left 0.50 →
// stone2, front 0.46 and a 45° front-right turn −0.03 → stone1, right −0.50 and the underside −0.74 →
// stone0; no surface facing the viewer gets below −0.89, so night0 comes only with a cut's bias.

import { PAL } from '../../palette';
import type { MaterialDef } from '../types';

export default {
  id: 'basalt',
  status: 'draft',
  firstUser: 'magma_titan',
  draw: {
    ramp: [PAL.night0, PAL.stone0, PAL.stone1, PAL.stone2],
    th: [-0.9, -0.15, 0.48],
    farShift: 1,
    far: { ramp: [PAL.night0, PAL.night0, PAL.stone0, PAL.stone1], th: [-0.9, -0.15, 0.48] },
    seam: { [PAL.stone3]: PAL.stone2, [PAL.stone2]: PAL.stone1, [PAL.stone1]: PAL.stone0, [PAL.stone0]: PAL.night0, [PAL.night0]: PAL.night0 },
    crease: { [PAL.stone3]: PAL.stone1, [PAL.stone2]: PAL.stone0, [PAL.stone1]: PAL.stone0, [PAL.stone0]: PAL.night0, [PAL.night0]: PAL.night0 },
    edge: { hi: PAL.stone3, lo: null, lit: 0.35, dark: -0.35 },
    rim: null,
    glint: { tone: PAL.stone4, anchors: 'facet' },
    texture: { kind: 'facets', density: 6 },
    interior: null,
    noiseMax: 0.1,
  },
  hit: { sparks: [PAL.stone1, PAL.stone3, PAL.fire3], debris: 'chip', flash: PAL.fire4 },
  death: { shatter: 'stone', accent: 'fire', pass: 'crumble', revive: 'reassemble' },
  matter: [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4],
  sound: {
    thump: [96, 30, 0.6, 0.34],
    surf: [3600, 0.38],
    ring: { kind: 'rumble', f: 60, grit: 1.4 },
    sizzle: 4600,
  },
} satisfies MaterialDef;
