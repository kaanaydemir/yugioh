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
//
// MATERIAL DECISION (A4.1, binding — src/still/titan-map.ts and src/art/monsters-v3/magma_titan-parts.ts
// heatStep follow it): at rest the lava keeps EXACTLY ONE gold4 pixel — the glint in the chest core's
// fire4 heart (38,40). Everything else at rest, and in every idle / guard / hit frame, tops out at
// fire4: the idle's core swell grows the fire4 heart outward (never gold), the seams' travelling pulse
// steps fire2 ↔ fire3 ↔ fire4. More gold and white come ONLY at full heat: the core ≥ 1.8 (gold), its
// 2×2 centre ≥ 2.3 (white) on a charge's peak and the release; the striking fist ≥ 1.8 (white knuckle
// face, gold4 · fire4 · fire3 bands melting back from it) on contact; the roar's vent flames' core on the
// release (the crater's pool under them tops out at fire4: a gold pool under a dark lip read as a lit eye).
// The extras (A4.1 step 2, part 2) keep the decision. Their full-heat moments: the summon's ignition (the
// core 2.1 inside its flare ring), the special (the core ≥ 1.8 through the charge, the fireball drawn like
// the core with ONE white 2×2 heart on the swing out, the lava cleft between the parted chest plates up to
// gold4), the victory's ignition (the raised fist's knuckles white for one frame, then smouldering down to
// the knuckle row), the revive's first breath (core 1.85) and the death's last heave (the eyes gold4 once
// before the light drains). ONE deliberate exception: hitMagic, a spell overloading the seams, runs a surge
// front up to gold4 along them, burns the eyes white (eye ≥ 2.4) and flickers the core gold / white: a hit
// above fire4 because the spell's light IS the blow. The light radius (fx.lit: death 1 → 0, summon /
// revive 0 → 1) turns a seam past it into a cold groove (night0 body, stone0 edges), and a dropped jaw's
// throat dims with the mouth; the summon's molten body takes the still's planes in fire tones (fire0 …
// fire4, no gold) until it cools into basalt.

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
