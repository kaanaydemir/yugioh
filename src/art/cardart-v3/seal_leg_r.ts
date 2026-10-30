// Card art v3 — Sağ Bacak Mührü (seal_leg_r, DARK sealed relic): the colossus' right leg slams down at the lower right of the
// window — the foot slab on the floor with its three toe blocks, the shin leaning back-left up to the knee plate, the column of
// three falling-arrow runes on the eclipse, the thigh bleeding off the top edge (the broken hip is out of the picture), the
// bronze ankle band with its broken chain (style sheet docs/v3/KART_RESIMLERI.md, set design: the "Seal Eclipse" backdrop shared
// by the five Beş Mühür cards).
//
// Source of the subject: the sprite rig itself (monsters-v3/seal_leg_r-rig.ts drawLeg) at its rest pose, moved into the window and
// drawn at the picture's own density 1:1 (never scaled). big (88×68) = the whole standing leg cropped by the top edge; small
// (44×34) = the SAME leg closer: a 1:1 crop of the knee plate, the rune column and the ankle band. Ground: the kit's DARK recipe
// (eclipse centre fixed at big (44, 28) / small (22, 14)) plus the set's five short stepped rays at the pentagon angles; the
// picture's own ray tip carries a 2-px seal spark; the "pentad" corner glyph (five dots on a pentagon, the card's own vertex hot)
// sits top left. Light: the runes' double beat ("ba-dum") and a 1-px dust puff off the sole are the living loop (4 frames, 170 ms).
// Colours only from PAL.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ANKLE0, HIP0, KNEE0, drawLeg, pose, type Pose } from '../monsters-v3/seal_leg_r-rig';
import { paintBackdrop, spikes } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

/** The rune column in BIG px (within 6 px of the eclipse centre (44, 28)) and in SMALL px. */
const FOCUS = [43, 31] as const;
const FOCUS_SMALL = [22, 20] as const;
const RAY_ANGLES = [-90, -18, 54, 126, 198] as const;

/** The double beat: top → bottom levels per loop frame. */
const BEAT: readonly (readonly [number, number, number])[] = [
  [2, 3, 4],
  [3, 4, 2],
  [2, 2, 2],
  [2, 3, 3],
];

function legPose(f: number, dx: number, dy: number, dust: boolean): Pose {
  // rubble thrown off by the slam (big only): two slabs on the floor at either side, one hops a pixel
  const chips = dust ? [{ x: 16, y: 57 - (f % 2), k: 1 }, { x: 71, y: 58 - ((f + 1) % 2), k: 1 }] : [];
  const sh = (p: readonly [number, number]): [number, number] => [p[0] + dx, p[1] + dy];
  const sole = ANKLE0[1] + 12 + dy;
  const puff = dust ? ([[ANKLE0[0] + dx - 18 - f, sole - 1 - (f % 2), 2], [ANKLE0[0] + dx + 24 + f, sole - 2 - (f % 2), 1], [ANKLE0[0] + dx - 20 - f, sole - 2, 1]] as const) : [];
  return pose({
    hip: sh(HIP0),
    knee: sh(KNEE0),
    ankle: sh(ANKLE0),
    kneeP: sh(KNEE0),
    runes: BEAT[f % 4],
    seam: 2,
    spill: 2,
    floor: 0,
    sw: [0, 5, 8, 5][f % 4],
    swT: (f % 4) / 4,
    dust: [...puff],
    chips,
  });
}

function backdrop(p: PixelCanvas): void {
  paintBackdrop(p, 'DARK', { focus: [44, 28], horizon: 48, rays: false });
  spikes(p, 44, 28, 5, 31, 38, 2.4, PAL.void2, -90);
}

/** The pentad corner glyph: five dots on a pentagon, the card's own vertex (leg_r, 3rd clockwise) hot. */
function pentad(l: PixelCanvas, small: boolean): void {
  const cx = small ? 4 : 7;
  const cy = small ? 4 : 7;
  const r = small ? 2 : 3;
  RAY_ANGLES.forEach((deg, i) => {
    const a = (deg * Math.PI) / 180;
    l.set(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), i === 2 ? PAL.mag4 : PAL.mag2);
  });
}

/** This card's own ray tip (54°): a 2-px seal spark on the first free pixel along the ray. */
function sparkTip(l: PixelCanvas, subject: PixelCanvas, small: boolean): void {
  const a = (54 * Math.PI) / 180;
  const cx = small ? 22 : 44;
  const cy = small ? 14 : 28;
  for (let r = small ? 17 : 34; r < (small ? 24 : 48); r += 1) {
    const x = Math.round(cx + Math.cos(a) * r);
    const y = Math.round(cy + Math.sin(a) * r);
    if (!subject.isOpaque(x, y) && !subject.isOpaque(x + 1, y) && !subject.isOpaque(x, y + 1) && x < (small ? 41 : 85) && y < (small ? 31 : 65)) {
      l.set(x, y, PAL.mag3);
      l.set(x + 1, y, PAL.mag3);
      return;
    }
  }
}

function big(l: ArtLayers, f: number): void {
  backdrop(l.backdrop);
  const q = new PixelCanvas(88, 68);
  // the foot sole on y = 62 (floor band), the rune column on the eclipse, the thigh cut by the top edge
  drawLeg(q, legPose(f, 8, -24, true), 'left');
  l.subject.blit(q, 0, 0);
  pentad(l.light, false);
  sparkTip(l.light, l.subject, false);
}

function small(l: ArtLayers, f: number): void {
  backdrop(l.backdrop);
  const q = new PixelCanvas(44, 34);
  // the same leg closer: knee plate, rune column and ankle band at the picture's density
  drawLeg(q, legPose(f, -13, -35, false), 'left');
  l.subject.blit(q, 0, 0);
  pentad(l.light, true);
  sparkTip(l.light, l.subject, true);
}

const art: CardArtV3 = {
  id: 'seal_leg_r',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 4,
  holdMs: 170,
  big,
  small,
};

export default art;
