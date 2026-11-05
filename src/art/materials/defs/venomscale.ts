// venomscale — Zehir Ejderi's (venom_drake) plum-black hide (docs/v3/kart-a/venom_drake.md §3, §6).
// PLACEHOLDER written by the lane-A shared-infrastructure step from the blueprint so the 'crackle'
// ring and the generated hitVenomscale* sounds have a definition; the venom_drake builder owns this
// file from here on and tunes every value (status stays 'draft' until the card is accepted).
// Deviation from the blueprint (for the materials test, matter = MATTER_RAMP[death.shatter]): the
// definition's own death is { shatter: 'acid', accent: 'acid' } (its matter is the blueprint's green
// matter = MATTER_RAMP.acid); the card's RECIPE still breaks the body as it likes ('shadow' + 'acid').

import { PAL } from '../../palette';
import type { MaterialDef } from '../types';

export default {
  id: 'venomscale',
  status: 'draft',
  firstUser: 'venom_drake',
  draw: {
    // one value step above the floor (night1 / night2): void0 only in creases, mag1 the plum lit plane
    ramp: [PAL.void0, PAL.void1, PAL.void2, PAL.mag1],
    th: [-0.85, -0.2, 0.45],
    farShift: 1,
    seam: { [PAL.mag1]: PAL.void2, [PAL.void3]: PAL.void2, [PAL.void2]: PAL.void1, [PAL.void1]: PAL.void0, [PAL.void0]: PAL.void0 },
    crease: { [PAL.mag1]: PAL.void1, [PAL.void3]: PAL.void1, [PAL.void2]: PAL.void0, [PAL.void1]: PAL.void0, [PAL.void0]: PAL.void0 },
    edge: { hi: PAL.void3, lo: null, lit: 0.4, dark: -0.35 }, // 1-px lit edge only (IŞ-8)
    rim: PAL.leaf2, // the toxic under-glow (IŞ-7)
    glint: null, // the bulb is the only bright point
    texture: { kind: 'scales', density: 5 },
    emissive: { tones: [PAL.gold4, PAL.gold3, PAL.leaf3], pulse: 'breath' },
    interior: null,
    noiseMax: 0.1,
  },
  hit: { sparks: [PAL.leaf1, PAL.leaf2, PAL.leaf3, PAL.gold3], debris: 'drop', flash: PAL.gold3 },
  death: { shatter: 'acid', accent: 'acid', pass: 'dissolve', revive: 'gather' },
  matter: [PAL.void0, PAL.void1, PAL.leaf1, PAL.leaf2, PAL.leaf3], // = MATTER_RAMP.acid
  sound: {
    thump: [120, 55, 0.5, 0.1],
    surf: [5600, 0.2],
    // the hide fizzes where it is struck: dense high clicks over a short tonal knock (120 Hz, 150 on a
    // light blow, falling to 60), two stinger rattle clicks on a heavy one (4.2 kHz)
    ring: { kind: 'crackle', hp: 6500, rate: 260, dec: [0.12, 0.35], knock: 120, rattle: 4200 },
    sizzle: 7000,
  },
  light: { glow: PAL.leaf3, pool: PAL.leaf3 },
} satisfies MaterialDef;
