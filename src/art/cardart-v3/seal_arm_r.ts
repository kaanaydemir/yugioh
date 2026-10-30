// Card art v3 — Sağ Kol Mührü (seal_arm_r, DARK sealed relic): the breaker fist. The basalt right arm of the colossus pushes up
// out of a cracked floor at the bottom centre-left, the clenched fist rising in front of the eclipse, the bronze wrist band with
// the glyph stud (the seal) just under the eclipse centre, rubble slabs on the crack's lips, thin seam lines of light running
// along the floor (style sheet docs/v3/KART_RESIMLERI.md, set design: the "Seal Eclipse" backdrop shared by the five Beş Mühür
// cards; this piece's own subject colour accent is LEAF green — head crimson, left arm teal, right leg earth, left leg water).
//
// Source of the subject: the sprite rig itself (monsters-v3/seal_arm_r-rig.ts drawArm), posed for the picture and drawn 1:1 at
// the picture's own density (never scaled): big (88×68) shows the arm from the crack up past the fist; small (44×34) is the SAME
// fist closer — the rig cropped on the fist and the stud (the arm 3 px lower so the knuckles keep air), the crack's lip left below the window. Ground: the kit's DARK recipe (eclipse centre fixed at big (44, 28) / small (22, 14)) with the
// corona / horizon / rim in leaf tones, plus the set's five short stepped rays at the pentagon angles; this card's own ray tip
// (the arm's vertex, 2nd clockwise from the apex) carries a 2-px seal spark; the "pentad" corner glyph has this card's dot hot.
// Living loop (4 frames, 170 ms): the stud flares on f1-2, one pebble hops on the lip, the forearm rises 1 px on f2.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { W as RW, H as RH, drawArm, pose, type Pose } from '../monsters-v3/seal_arm_r-rig';
import { BACKDROPS, paintBackdrop, spikes } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

/** The seal stud in BIG px (within 6 px of the eclipse centre (44, 28)) and in SMALL px (the fist is the picture there). */
const FOCUS = [44, 27] as const;
const FOCUS_SMALL = [22, 24] as const;
const RAY_ANGLES = [-90, -18, 54, 126, 198] as const;

/** Per loop frame: stud level, forearm rise, pebble hop, spark. */
const LOOP = [
  { glow: 2, up: 3, hop: 0, spark: 0, dust: 0.1 },
  { glow: 4, up: 3, hop: 2, spark: 1, dust: 0.3 },
  { glow: 4, up: 4, hop: 3.5, spark: 2, dust: 0.5 },
  { glow: 3, up: 3, hop: 5, spark: 0, dust: 0.7 },
] as const;

function armPose(f: number, lower = 0): Pose {
  const L = LOOP[f % 4];
  return pose({ up: L.up - lower, glow: L.glow, spill: 2, seam: 1, seamLen: 3, seamT: f / 4, hop: L.hop, dust: L.dust, dustN: 3 });
}

/** The rig's frame (80×106) drawn and cut into a window: (ox, oy) = where the frame's (0, 0) lands in the window. */
function stamp(dst: PixelCanvas, f: number, ox: number, oy: number, lower = 0): void {
  const q = new PixelCanvas(RW, RH);
  drawArm(q, armPose(f, lower), 'left');
  dst.blit(q, ox, oy);
}

function backdrop(p: PixelCanvas, small: boolean): void {
  paintBackdrop(p, RECIPE, { focus: [44, 28], horizon: 48, rays: false });
  spikes(p, 44, 28, 5, 31, 38, 2.4, PAL.leaf2, -90);
  void small;
}

/** The pentad corner glyph: five dots on a pentagon, the card's own vertex (arm_r, 2nd clockwise from the apex) hot. */
function pentad(l: PixelCanvas, small: boolean): void {
  const cx = small ? 4 : 7;
  const cy = small ? 4 : 7;
  const r = small ? 2 : 3;
  RAY_ANGLES.forEach((deg, i) => {
    const a = (deg * Math.PI) / 180;
    l.set(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), i === 1 ? PAL.mag4 : PAL.mag2);
  });
}

/** This card's own ray tip: a 2-px seal spark. */
function sparkTip(l: PixelCanvas, small: boolean): void {
  const a = (-18 * Math.PI) / 180;
  const r = small ? 18.5 : 37;
  const cx = small ? 22 : 44;
  const cy = small ? 14 : 28;
  const x = Math.round(cx + Math.cos(a) * r);
  const y = Math.round(cy + Math.sin(a) * r);
  l.set(x, y, PAL.mag3);
  l.set(x + 1, y, PAL.mag3);
}

function big(l: ArtLayers, f: number): void {
  backdrop(l.backdrop, false);
  // stud (rig (44, 58) + up 3) lands on (44, 27): the crack's centre (38, 90) lands at (38, 59)
  stamp(l.subject, f, 0, -28);
  pentad(l.light, false);
  sparkTip(l.light, false);
}

function small(l: ArtLayers, f: number): void {
  backdrop(l.backdrop, true);
  // the same fist closer: the stud lands on (22, 24), the fist fills the middle of the window in front of the eclipse
  stamp(l.subject, f, -22, -34, 3);
  pentad(l.light, true);
  sparkTip(l.light, true);
}

/** This card's accent colour (leaf): the set backdrop (eclipse, five rays, pentad) stays, its corona / horizon / rays take the piece's hue. */
const RECIPE = { ...BACKDROPS.DARK, tones: [PAL.leaf1, PAL.leaf2, PAL.leaf3, PAL.night0], horizonLine: PAL.leaf1, rim: PAL.leaf3 };

const art: CardArtV3 = {
  id: 'seal_arm_r',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 4,
  holdMs: 170,
  big,
  small,
};

export default art;
