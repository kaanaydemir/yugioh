// Card art v3 — Sol Kol Mührü (seal_arm_l, DARK sealed relic): the open hand of the severed colossus arm enters from the lower
// left, its snapped elbow bleeding off the window, the glyph disc of the palm on the eclipse, five long fingers fanned to the
// right across the lower corona, the bronze cuff with its broken chain hanging under the wrist (style sheet
// docs/v3/KART_RESIMLERI.md, set design: the "Seal Eclipse" backdrop shared by the five Beş Mühür cards).
//
// Source of the subject: the sprite rig itself (monsters-v3/seal_arm_l-rig.ts drawArm), posed for the picture — the forearm
// longer so it leaves the window, the fan a little wider — and drawn at the picture's own density 1:1 (never scaled). big
// (88×68) = the whole hand and forearm; small (44×34) = the SAME hand closer: the palm, the fan and the cuff, hand-posed to
// fit the small window. Ground: the kit's DARK recipe (eclipse centre fixed at big (44, 28) / small (22, 14)) plus the set's
// five short stepped rays at the pentagon angles; the picture's own ray tip carries a 2-px seal spark; the "pentad" corner
// glyph (five dots on a pentagon, the card's own vertex hot) sits top left. Light: the palm glyph's travelling pulse is the
// living loop (4 frames, 170 ms): palm → knuckles → fingertips, plus the chain's 1-px swing. Colours only from PAL.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { drawArm, pose, type Pose } from '../monsters-v3/seal_arm_l-rig';
import { HAND_REST } from '../monsters-v3/seal_arm_l-hand';
import { paintBackdrop, spikes } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

/** The glyph disc in BIG px (within 6 px of the eclipse centre (44, 28)) and in SMALL px. */
const FOCUS = [44, 32] as const;
const FOCUS_SMALL = [16, 20] as const;
const RAY_ANGLES = [-90, -18, 54, 126, 198] as const;

const fan = (k: number) => ({ ...HAND_REST, sp: [-6 * k, -3 * k, 0, 4 * k, 8 * k] });

/** Pulse per loop frame: glyph level, the front of the travelling light (px from the disc), chain swing. */
const LOOP = [
  { glow: 3, pulse: -1, sw: 0, swT: 0 },
  { glow: 4, pulse: 12, sw: 6, swT: 0.25 },
  { glow: 3, pulse: 26, sw: 8, swT: 0.5 },
  { glow: 2, pulse: 38, sw: 6, swT: 0.75 },
] as const;

function bigPose(f: number): Pose {
  const L = LOOP[f % 4];
  // wrist so that the disc lands on (44, 28); the stump is far out of the window (lower left)
  return pose({ sx: -4, sy: 61, wx: 38, wy: 36, ha: -38, hand: fan(1), glow: L.glow, pulse: L.pulse, sw: L.sw, swT: L.swT, veins: 1, spill: 2, seam: 0, floor: 0, motes: [], chips: [] });
}
function smallPose(f: number): Pose {
  const L = LOOP[f % 4];
  // the same hand closer: a shorter forearm, the wrist so that the disc lands on (22, 15)
  return pose({ sx: -10, sy: 40, wx: 10, wy: 24, ha: -42, hand: fan(0.55), glow: L.glow, pulse: L.pulse, sw: L.sw, swT: L.swT, veins: 1, spill: 2, seam: 0, floor: 0, motes: [], chips: [], links: 3 });
}

function backdrop(p: PixelCanvas, small: boolean): void {
  paintBackdrop(p, 'DARK', { focus: small ? [44, 28] : [44, 28], horizon: 48, rays: false });
  // the set's five short stepped rays (void2) at the pentagon angles, past the corona
  const k = small ? 0.5 : 1;
  const c = small ? [22, 14] : [44, 28];
  void c;
  spikes(p, 44, 28, 5, 31, 38, 2.4, PAL.void2, -90);
  void k;
}

/** The pentad corner glyph: five dots on a pentagon, the card's own vertex (arm_l, 5th clockwise) hot. */
function pentad(l: PixelCanvas, small: boolean): void {
  const cx = small ? 4 : 7;
  const cy = small ? 4 : 7;
  const r = small ? 2 : 3;
  RAY_ANGLES.forEach((deg, i) => {
    const a = (deg * Math.PI) / 180;
    l.set(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), i === 4 ? PAL.mag4 : PAL.mag2);
  });
}

/** This card's own ray tip: a 2-px seal spark. */
function sparkTip(l: PixelCanvas, small: boolean): void {
  const a = (198 * Math.PI) / 180;
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
  const q = new PixelCanvas(88, 68);
  drawArm(q, bigPose(f), 'left');
  l.subject.blit(q, 0, 0);
  pentad(l.light, false);
  sparkTip(l.light, false);
}

function small(l: ArtLayers, f: number): void {
  backdrop(l.backdrop, true);
  const q = new PixelCanvas(44, 34);
  drawArm(q, smallPose(f), 'left');
  l.subject.blit(q, 0, 0);
  pentad(l.light, true);
  sparkTip(l.light, true);
}

const art: CardArtV3 = {
  id: 'seal_arm_l',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 4,
  holdMs: 170,
  big,
  small,
};

export default art;
