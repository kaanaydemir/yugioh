// scale — Mercan Yılanı's hide (REHBER §2.3 "Pullu deri (koyu / renkli)" row, DRAFT until the serpent's
// acceptance in A4.1). Tones and rules from the approved idle f0, src/still/serpent-map.ts:
//   water3 lit plane (the largest: the top of the coil, the light-facing side of the neck), water2 mid,
//   water1 shadow, water0 underside and creases; water4 only as the 1-px edge of light-facing contours
//   (facing ≥ 0.35, IŞ-8) and the head's top plane; where a lit band's contour turns away from the
//   light (the lower S of the neck) its edge turns water2 instead. The far side (the back arc of the
//   coil) is one value darker: edge water3, lit water2, mid water1, underside water0.
// SCALE ROWS — A4.1 still decision (binding, 23 Oct 2026; REHBER §2.3 updated by the orchestrator): scale
//   rows are 2-px TEETH of the darker band, about every 5 px along the body, ONLY on the mid / shadow
//   boundary; the lit planes stay calm. This corrects the REHBER §2.3 draft's "1-px notches every 3–4 px"
//   for the serpent: at its size 1-px notches read as speckle.
// The same hide carries two more tone sets that never get their own material (their draw / hit / death /
// sound do not differ from the scales'): the VENTRAL PLATES (a lighter material in shadow: mist = the
//   plate edge facing forward, steel = plate, night3 = the far side; a one-step-darker seam across the
//   steel / night3 every 3 px along the neck; under the P2 relight they step up once) and the CORAL /
//   MEMBRANE tones (mag0…mag4: opaque coral branches — mag4 tips and lit top edges, mag3 lit side, mag2
//   shadow side — and translucent membranes read through value: mag1 web, a 1-px mag2 rim on the thin
//   free edge, a mag0 crease where they meet the body, mag3 rays with a mag4 tip). The painters take
//   those from the art's tone tables (src/art/monsters-v3/coral_serpent-build.ts TONES); this ramp is
//   the scales'.
// Thresholds (G-buffer parts only) on n·L for the key light (−0.50, −0.74, 0.46): the top of a tube (0.74)
// and its light-facing side lit, the front (0.46) on the lit / mid border, a 45° turn down mid, the
// underside (−0.74) shadow, cuts by bias only. Creases at most two steps below the plane they fall on,
// seams one step, never ink inside the hide (IŞ-9; the open mouth is the one interior ink, the gape).
// Hit: a wet slap — water sparks and drops, the flash a pale water tone. Death: the serpent breaks as
// water (DEATH_PRESETS.coral_serpent: water / water); the passes are drafts until part 2 (dissolve into
// spray, gather for the revive). Sound: a blow on wet scales is a short noise slap — the 'slosh' ring
// (REHBER §2.3 water) has no interpreter yet (src/audio/v3/materials.ts RING_KINDS), so the draft uses
// the interpretable noise flutter as its stand-in until the audio step brings one; nothing plays it yet.

import { PAL } from '../../palette';
import type { MaterialDef } from '../types';

export default {
  id: 'scale',
  status: 'draft',
  firstUser: 'coral_serpent',
  draw: {
    ramp: [PAL.water0, PAL.water1, PAL.water2, PAL.water3, PAL.water4],
    th: [-0.55, -0.12, 0.3, 0.86],
    farShift: 1,
    far: { ramp: [PAL.water0, PAL.water0, PAL.water1, PAL.water2, PAL.water3], th: [-0.55, -0.12, 0.3, 0.86] },
    seam: { [PAL.water4]: PAL.water3, [PAL.water3]: PAL.water2, [PAL.water2]: PAL.water1, [PAL.water1]: PAL.water0, [PAL.water0]: PAL.water0 },
    crease: { [PAL.water4]: PAL.water2, [PAL.water3]: PAL.water1, [PAL.water2]: PAL.water0, [PAL.water1]: PAL.water0, [PAL.water0]: PAL.water0 },
    edge: { hi: PAL.water4, lo: null, lit: 0.35, dark: -0.35 },
    rim: null,
    glint: { tone: PAL.white, anchors: 'edge' },
    texture: { kind: 'scales', density: 5 },
    interior: null,
    noiseMax: 0.1,
  },
  hit: { sparks: [PAL.water2, PAL.water3, PAL.water4], debris: 'drop', flash: PAL.water4 },
  death: { shatter: 'water', accent: 'water', pass: 'dissolve', revive: 'gather' },
  matter: [PAL.water0, PAL.water1, PAL.water2, PAL.water3, PAL.water4],
  sound: {
    thump: [130, 48, 0.42, 0.18],
    surf: [1900, 0.5],
    ring: { kind: 'flutter', band: [1400, 1100], dec: [0.09, 0.14] },
    sizzle: 3800,
  },
  light: { glow: PAL.cyan3, pool: PAL.water3 },
} satisfies MaterialDef;
