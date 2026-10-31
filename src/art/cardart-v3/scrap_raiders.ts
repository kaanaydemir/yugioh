// Card art v3 — Hurda Akıncıları (scrap_raiders, FIRE, Savaşçı): the sprite's own pixels, 1:1, in a new composition
// (style sheet docs/v3/KART_RESIMLERI.md §5, contract ./_types.ts; YENI_KARTLAR §C5 "Üç çeyrek açıdan hücum eden
// araba, bağıran goblinler, kıvılcım, alev").
//
// big (88×68)   the cart mid-charge, nose up on a bounce, the rear (stove, flag) bleeding off the left edge, the
//               coal stove spitting its fire ball, the rear tyre throwing sparks, all three goblins yelling, the
//               wrench levelled forward; FIRE backdrop, the sun behind the stove's fire ball. Brightest point: the
//               fire ball over the pipe.
// small (44×34) the SAME picture, closer: a 1:1 crop of the sprite — the yelling crew, the wrench and the spiked
//               ram (the hand-version focus is the wrench goblin's open mouth and the levelled jaw).
// Living (4 frames, 150 ms): wheels turn, sparks fly, smoke and flag move, the fire ball breathes.
// Colours only from PAL (the sprite and the kit), folded to the card's tone budget.

import { PixelCanvas } from '../pixel';
import { PAL } from '../palette';
import { drawRaiders, pose, H as SH, W as SW } from '../monsters-v3/scrap_raiders-rig';
import { paintBackdrop, recolor } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

/** where the sprite frame sits in the big picture (sprite px → picture px 1:1), and the small crop */
const BIG_DX = -8;
const BIG_DY = -15;
const SMALL_CROP = [44, 18, 44, 34] as const;
/** the stove's fire ball (big px) and the wrench goblin's yell (small px) */
const FOCUS = [56, 17] as const;
const FOCUS_SMALL = [22, 12] as const;

const VUF = [0, 0, 0, 0];

function cardPose(f: number) {
  const ph = (f % 4) / 4;
  return pose({
    by: 2, tilt: -2, bob: -1, wr: ph * 0.5, wf: ph * 0.7, spark: 0.2 + ph * 0.5, smk: 2, sm: ph, flag: ph * 2, flagK: 1.6,
    door: 3, vuf: VUF[f % 4], pM: 2, pHx: 1, pE: 0, wM: 2, wE: 0, wHx: 2, wAng: 0, wAy: -1, wAx: 6, sM: 2, sE: 1, sPull: 1, sAx: 5, sAy: -4,
    t: ph,
  });
}

function sprite(f: number): PixelCanvas {
  const p = new PixelCanvas(SW, SH);
  drawRaiders(p, cardPose(f), 'left');
  // the card's tone budget (≤ 20): fold the rarest sprite tones into their neighbours
  return recolor(p, {
    [PAL.gold0]: PAL.earth0, [PAL.gold1]: PAL.earth1, [PAL.gold2]: PAL.earth3, [PAL.gold3]: PAL.fire4, [PAL.gold4]: PAL.fire4, [PAL.earth4]: PAL.earth3, [PAL.stone4]: PAL.stone3,
    [PAL.leaf0]: PAL.ink, [PAL.fire0]: PAL.ink, [PAL.leaf4]: PAL.leaf3, [PAL.steel]: PAL.stone3, [PAL.water3]: PAL.mist, [PAL.water4]: PAL.mist,
  });
}

function big(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'FIRE', { focus: [FOCUS[0] - 10, 16], horizon: 50 });
  l.subject.blit(sprite(f), BIG_DX, BIG_DY);
}

function small(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'FIRE', { focus: [FOCUS_SMALL[0], 6], horizon: 27 });
  l.subject.blit(sprite(f).crop(SMALL_CROP[0], SMALL_CROP[1], SMALL_CROP[2], SMALL_CROP[3]), 0, 0);
}

const art: CardArtV3 = {
  id: 'scrap_raiders',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 4,
  holdMs: 150,
  big,
  small,
};

export default art;
