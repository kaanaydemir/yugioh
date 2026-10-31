// ash — Kül Ejderi's (ashen_drake) compressed ash cloak (docs/v3/kart-a/ashen_drake.md §3.4, §6.5).
// PLACEHOLDER written by the lane-A shared-infrastructure step from the blueprint so the new 'ash'
// ShatterMaterial and the generated hitAsh* sounds have a definition; the ashen_drake builder owns this
// file from here on and tunes every value (status stays 'draft' until the card is accepted).
// Grey ash planes (stone0…stone3, never stone4: ash has no hard edge), ember light inside (fire1…fire4),
// a void2 rim. Death: it SETTLES ('ash' shatter, fire accent). Sound: a soft dead knock, a pink puff
// around 1.2 kHz, a dry ember crackle tail (the 'crackle' ring) — never a pitched ring.

import { PAL, RAMPS } from '../../palette';
import type { MaterialDef } from '../types';

export default {
  id: 'ash',
  status: 'draft',
  firstUser: 'ashen_drake',
  draw: {
    ramp: [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3],
    th: [-0.9, -0.2, 0.5],
    farShift: 1,
    far: { ramp: [PAL.stone0, PAL.stone0, PAL.stone1, PAL.stone2], th: [-0.9, -0.2, 0.5] },
    seam: 'stepDown',
    crease: 'stepDown2',
    edge: { hi: PAL.stone3, lo: null, lit: 0.4, dark: -0.35 },
    rim: PAL.void2,
    glint: null,
    texture: { kind: 'grain', density: 5 },
    emissive: { tones: [PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4], pulse: 'breath' },
    interior: 'embers',
    noiseMax: 0.1,
  },
  hit: { sparks: [PAL.stone1, PAL.stone2, PAL.fire2, PAL.fire3], debris: 'ember', flash: PAL.fire4 },
  death: { shatter: 'ash', accent: 'fire', pass: 'crumble', revive: 'reassemble' },
  matter: RAMPS.stone, // = MATTER_RAMP.ash (src/cinematics/_v3/presets.ts)
  sound: {
    thump: [140, 70, 0.3, 0.1], // a soft, dead knock: compressed ash, no ring
    surf: [1200, 0.18], // the ash cloud puffing off the body
    ring: { kind: 'crackle', hp: 2200, rate: 60 }, // the ember tail: dry crackle (decays 0.25 s Light / 0.4 s Heavy)
    sizzle: 1800, // the magic variant: embers flaring under the spell
  },
  light: { glow: PAL.fire3, pool: PAL.fire3 },
} satisfies MaterialDef;
