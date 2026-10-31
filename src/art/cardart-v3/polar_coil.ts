// Card art v3 — Kutup Bobini (polar_coil, EARTH, Kutup ailesi): the sprite's own pixels, 1:1, in a new composition
// (style sheet docs/v3/KART_RESIMLERI.md §5, contract ./_types.ts; YENI_KARTLAR §C14 "ışıklı sarımlar, iki renkli
// çekirdek, yörüngede dikenler").
//
// big (88×68)   the living coil fully charged: both wire whips flung up, the light rings blazing up the copper turns,
//               the two-colour core slit white-hot (the card's brightest point, the EARTH sun sits behind it), three
//               iron-dust spikes orbiting it on an ellipse, their grain wake strung out behind them.
// small (44×34) the SAME picture, closer: a 1:1 crop of the sprite — helm and visor, the shoulder spools, the upper
//               winding and the core slit, one spike crossing in front.
// Living (4 frames, 160 ms): the spikes advance on their orbit, the rings climb a row, the spools turn.
// Colours only from PAL (the sprite's tones folded to the card budget).

import { PixelCanvas } from '../pixel';
import { PAL } from '../palette';
import { drawCoil, pose, skeleton, W as SW, H as SH } from '../monsters-v3/polar_coil-rig';
import { paintBackdrop, recolor } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

/** sprite frame → big picture offset (frame px → picture px 1:1) */
const BIG_DX = -5;
const BIG_DY = -6;
/** the sprite frame's crop that is the small picture */
const SMALL_CROP = [27, 19, 44, 34] as const;

const cardPose = (f: number) =>
  pose({
    nwx: 15, nwy: -12, nlag: -3, fwx: -14, fwy: -10, flag: 3,
    eye: 2, core: 3, ringB: 2, rings: 2, climb: 0.18 + (f % 4) / 26,
    sg: 1, orb: 0.1 + (f % 4) / 24, spinN: (f % 4) / 12, spinF: -(f % 4) / 12, dust: -1, t: f / 4,
  });

const CORE = skeleton(cardPose(0)).core;
const FOCUS = [CORE[0] + BIG_DX, CORE[1] + BIG_DY] as const;
const FOCUS_SMALL = [CORE[0] - SMALL_CROP[0], CORE[1] - SMALL_CROP[1]] as const;

/** The card's tone budget (≤ 20 with the backdrop): the sprite's rarest tones folded into their neighbours. */
const FOLD: Readonly<Record<number, number>> = {
  [PAL.stone4]: PAL.stone3,
  [PAL.gold0]: PAL.gold2,
  [PAL.water1]: PAL.water2,
  [PAL.night2]: PAL.stone0,
  [PAL.mist]: PAL.steel,
  [PAL.skin3]: PAL.gold4,
  [PAL.fire0]: PAL.ink,
  [PAL.water4]: PAL.white,
  [PAL.gold1]: PAL.gold2,
};

function sprite(f: number): PixelCanvas {
  const p = new PixelCanvas(SW, SH);
  drawCoil(p, cardPose(f), 'left');
  return recolor(p, FOLD);
}

function big(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'EARTH', { focus: FOCUS });
  l.subject.blit(sprite(f), BIG_DX, BIG_DY);
  // the hottest pixel of the core slit (light, never outlined)
  const [fx, fy] = FOCUS;
  l.light.set(fx, fy, PAL.white).set(fx - 1, fy, PAL.white).set(fx + 1, fy, PAL.white);
}

function small(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'EARTH', { focus: FOCUS_SMALL, horizon: 26, radius: 14 });
  l.subject.blit(sprite(f).crop(SMALL_CROP[0], SMALL_CROP[1], SMALL_CROP[2], SMALL_CROP[3]), 0, 0);
  const [fx, fy] = FOCUS_SMALL;
  l.light.set(fx, fy, PAL.white).set(fx - 1, fy, PAL.white);
}

const art: CardArtV3 = {
  id: 'polar_coil',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 4,
  holdMs: 160,
  big,
  small,
};

export default art;
