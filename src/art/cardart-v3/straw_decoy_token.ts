// Card art v3 — Saman Korkuluk (straw_decoy_token, EARTH, Bitki): the sprite's own pixels, 1:1, in a dusk field
// (style sheet docs/v3/KART_RESIMLERI.md; YENI_KARTLAR §S9 "Akşam tarlasında kolları açık korkuluklar, uzaktan
// bakan bir karga, rüzgarda saman").
//
// big (88×68)   the scarecrow in front of a low dusty sun, arms open, its button eyes lit; another scarecrow stands
//               small on the far ridge, a crow sits on its arm and looks this way; straw blows past.
// small (44×34) the SAME picture, closer: a 1:1 crop of the sprite — hat, sack head with the lit buttons, the open
//               arms — over the sun's upper arc.
// Living (4 frames, 160 ms): the straw hands and skirt flutter, the hat lifts a pixel, a straw fleck drifts.
// The brightest point is the near button eye. Colours only from PAL (≤ 20 tones per picture).

import { PixelCanvas } from '../pixel';
import { PAL } from '../palette';
import { drawStraw, pose, H as SH, W as SW, RX, GY } from '../monsters-v3/straw_decoy_token-rig';
import { ink, paintBackdrop, recolor } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

const FL = [0, 1, 0, -1];
const cardPose = (f: number) =>
  pose({ spread: 1, eye: 2, slR: 1, slL: -1, fiR: FL[f % 4], fiL: FL[(f + 2) % 4], skirt: FL[(f + 1) % 4], hatY: f % 4 === 2 ? -1 : 0, look: 1, flap: f % 2 });

/** Tones folded together so a picture stays within its colour budget. */
const FOLD: Record<number, number> = { [PAL.crim3]: PAL.crim2, [PAL.stone2]: PAL.stone3, [PAL.mist]: PAL.white, [PAL.night1]: PAL.ink, [PAL.earth0]: PAL.ink };

function sprite(f: number): PixelCanvas {
  const p = new PixelCanvas(SW, SH);
  drawStraw(p, cardPose(f), 'left');
  return recolor(p, FOLD);
}

const BIG_DX = 44 - RX;
const BIG_DY = 65 - GY;
/** the near button eye (head centre + 3, −2) in sprite px */
const EYE: readonly [number, number] = [RX + 1 + 3, GY - 42 - 2];
const FOCUS: readonly [number, number] = [EYE[0] + BIG_DX, EYE[1] + BIG_DY];
const SMALL_CROP = [RX - 21, GY - 54, 44, 34] as const;
const FOCUS_SMALL: readonly [number, number] = [EYE[0] - SMALL_CROP[0], EYE[1] - SMALL_CROP[1]];

/** A small far scarecrow on the ridge: stake, bar, head, hat (flat earth silhouette). */
function farScarecrow(s: PixelCanvas, x: number, y: number, k: number, crow: boolean): void {
  const c = PAL.earth1;
  s.vline(x, y - 14 * k, y, c);
  s.hline(x - 6 * k, x + 6 * k, y - 10 * k, c);
  s.rect(x - 2 * k, y - 10 * k, 4 * k + 1, 6 * k, c);
  s.disc(x, y - 13 * k, 2 * k, c);
  s.hline(x - 3 * k, x + 3 * k, y - 15 * k, c);
  s.rect(x - k, y - 17 * k, 2 * k + 1, 2 * k, c);
  if (crow) {
    // the crow on its arm, looking toward the big scarecrow
    const cx = x - 5 * k;
    const cy = y - 11 * k;
    s.rect(cx - 1, cy - 2, 3, 2, PAL.ink);
    s.set(cx - 2, cy - 3, PAL.ink).set(cx - 2, cy - 2, PAL.ink).set(cx + 2, cy - 1, PAL.ink);
  }
}

function big(l: ArtLayers, f: number): void {
  // the low sun sits behind the near shoulder (the sack head's lit side reads against the dark sky)
  paintBackdrop(l.backdrop, 'EARTH', { focus: [FOCUS[0] + 15, FOCUS[1] + 4], radius: 22 });
  const s = l.subject;
  farScarecrow(s, 13, 47, 1, true);
  ink(s);
  s.blit(sprite(f), BIG_DX, BIG_DY);
  // straw blowing past (light layer: no outline)
  const dx = (f % 4) * 2;
  l.light.hline(8 + dx, 10 + dx, 30, PAL.gold3);
  l.light.hline(70 - dx, 72 - dx, 20 + (f % 2), PAL.gold2);
  // the lit button: the brightest pixel of the card
  const [fx, fy] = FOCUS;
  l.light.rect(fx, fy, 2, 2, PAL.white);
}

function small(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'EARTH', { focus: [FOCUS_SMALL[0] * 2 + 26, FOCUS_SMALL[1] * 2 + 8], horizon: 60, radius: 26 });
  const s = l.subject;
  const sp = sprite(f).crop(SMALL_CROP[0], SMALL_CROP[1], SMALL_CROP[2], SMALL_CROP[3]);
  s.blit(sp, 0, 0);
  const [fx, fy] = FOCUS_SMALL;
  l.light.set(fx, fy, PAL.white);
}

const art: CardArtV3 = {
  id: 'straw_decoy_token',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 4,
  holdMs: 160,
  big,
  small,
};

export default art;
