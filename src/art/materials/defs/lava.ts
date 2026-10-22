// lava — Magma Titanı's seams, chest core, eyes, mouth and fist heat (REHBER §2.3 lava / fire row,
// DRAFT until the titan's acceptance in A4.1). LIGHT, not matter: drawn after the outline and never
// outlined (IŞ-9), only on the pixels of the rock part it lives in (part space: an arm in front hides
// the chest's seams), and it pulses (`emissive.pulse`: the core leads, the seams follow outward).
//   tones   fire1 the dim / cooling glow and the 1-px reflection lip a hot seam throws on the basalt
//           below it (REHBER: "çatlağa bakan taş kenarı fire1/2 yansıma kenarı alır" — the warm twin of
//           the wyrm's cyan2 rim: `rim`); fire2 a seam's edge and a thin seam; fire3 the seam body;
//           fire4 the hot core of a wide seam, the eye, the core's heart; gold4 / white only at full
//           heat (the core at the peak of a charge, the fist on contact) — never at rest.
//   seams   4-connected lines (a diagonal 1-px line is all isolated pixels: IŞ-10), 2 px wide at the
//           core and tapering to 1 px, at most one fork each; no lava speckle.
//   flames  2–3 flat tones (fire2 outer, fire3, fire4 core), stepped, no alpha; ≥ 3 different
//           silhouettes in a loop. Embers cool fire4 → fire2 → stone1 (1 px).
// Seams / creases on lava step down the fire ramp. On death the light drains out of the seams first
// ("soğuma": `drain`), then the basalt breaks; a blow on a seam lands on the rock (sound = basalt).
// Light: the glow the light layer picks up = today's MONSTER_GLOW.magma_titan top emissive tone; the
// strike's impact pool = today's STRIKE_LIGHT.magma_titan (the lava fist).

import { PAL } from '../../palette';
import type { MaterialDef } from '../types';

export default {
  id: 'lava',
  status: 'draft',
  firstUser: 'magma_titan',
  draw: {
    ramp: [PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4],
    th: [],
    farShift: 0,
    seam: { [PAL.fire4]: PAL.fire3, [PAL.fire3]: PAL.fire2, [PAL.fire2]: PAL.fire1, [PAL.fire1]: PAL.fire0 },
    crease: { [PAL.fire4]: PAL.fire2, [PAL.fire3]: PAL.fire1, [PAL.fire2]: PAL.fire1, [PAL.fire1]: PAL.fire0 },
    edge: { hi: null, lo: null, lit: 0.35, dark: -0.35 },
    rim: PAL.fire1,
    glint: null,
    emissive: { tones: [PAL.fire4, PAL.fire3, PAL.fire2], pulse: 'breath' },
    interior: 'embers',
    noiseMax: 0.15,
  },
  hit: { sparks: [PAL.fire2, PAL.fire3, PAL.fire4], debris: 'ember', flash: PAL.fire4 },
  death: { shatter: 'fire', accent: 'stone', pass: 'drain', revive: 'drain' },
  matter: [PAL.fire0, PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4],
  sound: { same: 'basalt' },
  light: { glow: PAL.fire4, pool: PAL.fire3 },
} satisfies MaterialDef;
