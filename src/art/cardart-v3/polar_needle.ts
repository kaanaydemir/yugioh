// Card art v3 — Kutup İğnesi (polar_needle, EARTH, Kutup ailesi): the sprite's own pixels, 1:1, in a new composition
// (style sheet docs/v3/KART_RESIMLERI.md §5, contract ./_types.ts; YENI_KARTLAR §C12 "dönen pusula gülü üstünde ucunda
// duran iğne-savaşçı, turuncu uç en parlak").
//
// big (88×68)   the needle-dancer en pointe in a deep relevé-plié on the centre of a huge iso compass rose laid on the
//               floor (N point fire, S point water, E / W magnetite, gold dial ring and ticks); spear level at the foe,
//               far arm high, the crown turning. The brightest point is the spear's orange point (the EARTH sun
//               sits behind it). The rose's back half is behind the legs, its front half over the floor in front.
// small (44×34) the SAME picture, closer: a 1:1 crop of the sprite — crown, visor, the fire/water needle torso and
//               the spear's glowing point — on the same sun.
// Living (4 frames, 160 ms): the floor rose and the crown turn a step, the iron dust runs, the point quivers.
// Colours only from PAL (the sprite, the kit tones and the backdrop recipe).

import { PixelCanvas } from '../pixel';
import { PAL } from '../palette';
import { drawNeedle, pose, skeleton, RX, GY, W as SW, H as SH } from '../monsters-v3/polar_needle-rig';
import { rose } from '../monsters-v3/polar_needle-kit';
import { CARD_LIGHT, ink, paintBackdrop } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

/** Where the needle's point (the sprite's root) stands in the big picture, and the rose dial under it. */
const TIP = [38, 67] as const;
const BIG_DX = TIP[0] - RX;
const BIG_DY = TIP[1] - GY;
/** The sprite frame's crop that is the small picture (frame px → picture px 1:1). */
const SMALL_CROP = [29, 12, 44, 34] as const;
const cardPose = (f: number, small = false) =>
  pose({
    toe: 1, nfx: -6, ffx: 7, py: 9, tx: 0, lean: 1, hx: 1,
    nx: small ? 17 : 20, ny: small ? -37 : -35, sa: (small ? -24 : -14) + [0, -2, 0, 2][f % 4], fx: -14, fy: -53,
    tip: 3, poleN: 2, poleS: 1.5, eye: 1.8, roseY: -1,
    rose: (f % 4) / 16, dust: (f % 4) / 4, dustK: 1, t: f / 4,
  });
/** The spear's point (frame 0) in BIG px: the card's brightest point; the small picture's is the same point, cropped. */
const SPT = skeleton(cardPose(0)).spt;
const FOCUS = [Math.round(SPT[0] + BIG_DX - 0.5), Math.round(SPT[1] + BIG_DY - 0.5)] as const;
const SPT_S = skeleton(cardPose(0, true)).spt;
const FOCUS_SMALL = [Math.round(SPT_S[0] - SMALL_CROP[0] - 0.5), Math.round(SPT_S[1] - SMALL_CROP[1] - 0.5)] as const;

function sprite(f: number, small = false): PixelCanvas {
  const p = new PixelCanvas(SW, SH);
  drawNeedle(p, cardPose(f, small), 'left');
  return p;
}

function floorRose(l: PixelCanvas, f: number, front: boolean): void {
  rose(l, { cx: TIP[0], cy: TIP[1], phase: 0.03 + (f % 4) / 32, rx: 26, ry: 6, arm: 9, ring: true }, front, CARD_LIGHT);
}

function big(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'EARTH', { focus: FOCUS });
  const s = l.subject;
  floorRose(s, f, false);
  s.blit(sprite(f), BIG_DX, BIG_DY);
  floorRose(s, f, true);
  ink(s);
  // light: the spear point blazes (the card's brightest pixel), a pole spark on each rose tip
  const [fx, fy] = FOCUS;
  l.light.rect(fx - 1, fy - 1, 3, 3, PAL.white);
  for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]] as const) l.light.set(fx + dx, fy + dy, PAL.fire4);
  l.light.set(fx + 2, fy - 2, PAL.gold4).set(fx - 2, fy + 2, PAL.gold4);
}

function small(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'EARTH', { focus: FOCUS_SMALL, horizon: 24, radius: 14 });
  const sp = sprite(f, true).crop(SMALL_CROP[0], SMALL_CROP[1], SMALL_CROP[2], SMALL_CROP[3]);
  l.subject.blit(sp, 0, 0);
  ink(l.subject);
  const [fx, fy] = FOCUS_SMALL;
  l.light.set(fx, fy, PAL.white).set(fx + 1, fy, PAL.fire4).set(fx, fy - 1, PAL.fire4);
}

const art: CardArtV3 = {
  id: 'polar_needle',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 4,
  holdMs: 160,
  big,
  small,
};

export default art;
