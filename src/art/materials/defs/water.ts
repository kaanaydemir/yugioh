// water — the serpent's matter: its drip, the water gathering in its throat and mouth, spray and splashes
// (REHBER §2.3 "Su" row, DRAFT until the serpent's acceptance in A4.1; the jet itself is the next step's
// 'beam' strike, drawn by the cinematic from points().muzzle). Later: Gelgit Golemi's body (A4.3).
// Rules (MA-4: no alpha): three bands — water4 the lit top of a drop / a sheet's leading edge, water3
// the body, water2 the underside; the inner depth is shown by a darker band (water1), never by
// transparency. Foam is white / water4 in clusters ≥ 2 px. Current lines are 1-px water4 that move ≥ 1
// px a frame along the flow (A0 §1.3 "inner currents"). A wet edge's glint: one 1-px white, counted
// in the anim's single glint (IŞ-8). Water is matter: drawn before the outline and outlined with the
// body, except light IN it (a charge's cyan core), which is drawn after the outline (IŞ-9).
// THE JET'S ROOT and the water gathering in a mouth (A4.1 fix round, Mercan Yılanı: the first user):
// water, never light — no cyan at all (cyan is the eye's / a charge core's) and never a white line: the
// stream is water3 with a water4 lit top and a water2 underside, 2 px each side of its axis, narrowing
// to 1 px over its last 3 px; its CURRENTS are 1-px water4 dashes 3 px long every 5 px that advance 2 px
// a frame (the anim's flow phase); its top and bottom edges wobble 1 px, alternating with that phase (a
// pressurised stream, not a laser); WHITE only as foam clusters ≥ 2 px (at the lips, at the tip). The
// gathering orb in the mouth is the same three bands with a ≥ 2-px white cap on its lit side.
// Spray and charge drops: ≥ 2-px clusters (a lone 1-px speck reads as noise at 1×), few of them (3 a
// burst); a falling charge drop is a 2-px vertical streak (water4 head, water3 tail).
// Hit: spray (water2 → water4 → white) and drops. Death: water, the splash preset; a water body melts —
// pass 'foam' (a water line runs down, the new top a 2-px white / water4 crest, 1-px water3 meltwater
// streaks; never speckle) and revives with 'surge' (the line back up) — first user the serpent's part 2,
// next Gelgit Golemi. Sound: an impact noise and bubbles —
// 'slosh' has no interpreter yet (src/audio/v3/materials.ts RING_KINDS), so the draft uses the noise
// flutter as its stand-in until the audio step brings one; nothing plays it yet.

import { PAL } from '../../palette';
import type { MaterialDef } from '../types';

export default {
  id: 'water',
  status: 'draft',
  firstUser: 'coral_serpent',
  draw: {
    ramp: [PAL.water1, PAL.water2, PAL.water3, PAL.water4, PAL.white],
    th: [-0.4, 0.05, 0.5, 0.88],
    farShift: 1,
    far: { ramp: [PAL.water0, PAL.water1, PAL.water2, PAL.water3, PAL.water4], th: [-0.4, 0.05, 0.5, 0.88] },
    seam: { [PAL.white]: PAL.water4, [PAL.water4]: PAL.water3, [PAL.water3]: PAL.water2, [PAL.water2]: PAL.water1, [PAL.water1]: PAL.water0, [PAL.water0]: PAL.water0 },
    crease: { [PAL.white]: PAL.water3, [PAL.water4]: PAL.water2, [PAL.water3]: PAL.water1, [PAL.water2]: PAL.water0, [PAL.water1]: PAL.water0, [PAL.water0]: PAL.water0 },
    edge: { hi: PAL.white, lo: null, lit: 0.35, dark: -0.35 },
    rim: PAL.water4,
    glint: { tone: PAL.white, anchors: 'edge' },
    texture: { kind: 'currents', density: 3 },
    interior: 'currents',
    noiseMax: 0.2,
  },
  hit: { sparks: [PAL.water2, PAL.water4, PAL.white], debris: 'drop', flash: PAL.white },
  death: { shatter: 'water', accent: 'water', pass: 'foam', revive: 'surge' },
  matter: [PAL.water0, PAL.water1, PAL.water2, PAL.water3, PAL.water4],
  sound: {
    thump: [110, 40, 0.36, 0.22],
    surf: [2400, 0.55],
    ring: { kind: 'flutter', band: [900, 750], dec: [0.16, 0.22] },
    sizzle: 3200,
  },
  light: { glow: PAL.water3, pool: PAL.water3 },
} satisfies MaterialDef;
