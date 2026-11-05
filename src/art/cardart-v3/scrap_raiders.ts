// Card art v3 — Hurda Akıncıları (scrap_raiders, FIRE, Savaşçı): the sprite's own pixels, 1:1, in a new composition
// (style sheet docs/v3/KART_RESIMLERI.md §5, contract ./_types.ts; YENI_KARTLAR §C5 "Üç çeyrek açıdan hücum eden
// araba, bağıran goblinler, kıvılcım, alev").
//
// big (88×68)   the cart CHARGING from three-quarters (the side-on rig sheared on the arena's 4:1 iso stair: the long
//               side runs down-right at the viewer, the ram comes at us), all three goblins yelling, the stove
//               spitting flame out of the pipe, the rear tyre throwing sparks; the ram strikes its KLANG — the one
//               brightest point. FIRE backdrop, the light pool behind the ram.
// small (44×34) the SAME picture, closer: a 1:1 crop of it — the yelling crew, the wrench and the spiked ram.
// Living (4 frames, 150 ms): wheels turn, sparks fly, smoke and flag move, the fire ball breathes.
// Colours only from PAL (the sprite and the kit), folded to the card's tone budget.

import { PixelCanvas } from '../pixel';
import { PAL } from '../palette';
import { drawRaiders, pose, H as SH, W as SW } from '../monsters-v3/scrap_raiders-rig';
import { paintBackdrop, recolor } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

/**
 * The three-quarter turn: the side-on sprite is sheared column by column (each column drops by (x − SHEAR_X0) / 4,
 * whole px — the 4:1 stair of the arena's own iso lines), so the cart's long side runs down-right toward the
 * viewer and the ram comes at us. Vertical lines stay vertical, the outline stays one pixel.
 */
const SHEAR = 0.18;
const SHEAR_X0 = 20;
/** where the sheared sprite sits in the big picture (sprite px → picture px 1:1), and the small crop of it */
const BIG_DX = -12;
const BIG_DY = -15;
const SMALL_CROP = [24, 14, 44, 34] as const;
/** the ram's KLANG (big px) — the one brightest point — and the wrench goblin's yell (small px) */
const FOCUS = [60, 42] as const;
const FOCUS_SMALL = [20, 11] as const;

function cardPose(f: number) {
  const ph = (f % 4) / 4;
  return pose({
    // mid-bounce, nose down into the charge
    by: 2, tilt: 1, bob: 0, wr: ph * 0.5, wf: ph * 0.7, spark: 0.25 + ph * 0.5, smk: 2.4, sm: ph, flag: ph * 2, flagK: 1.8,
    // the stove spits flame out of the pipe; the ram strikes sparks (the brightest point)
    door: 3, vuf: [0.35, 0.45, 0.4, 0.5][f % 4], flash: [0.45, 0.55, 0.5, 0.6][f % 4],
    // all three yell: the pedaller with fists up, the wrench goblin swinging forward, the slinger up on the deck
    pM: 2, pHx: 1, pE: 0, pArm: 1, wM: 2, wE: 0, wHx: 2, wHy: -1, wAng: -0.4, wAy: -4, wAx: 6, sM: 2, sE: 0, sHy: -2, sY: -3, sPull: 1, sAx: 5, sAy: -6,
    t: ph,
  });
}

/** Columns of the side view dropped to foreshorten the long side (every DROP-th column, none through the goblins' faces). */
const DROP = 4;
const KEEP_FACES: readonly (readonly [number, number])[] = [[28, 40], [40, 50], [53, 66]];

function shear(p: PixelCanvas): PixelCanvas {
  // 1. foreshorten: the cart's side seen at an angle is shorter — drop every DROP-th column of the hull and the ram
  const cols: number[] = [];
  for (let x = 0; x < p.w; x++) {
    const face = KEEP_FACES.some(([a, b]) => x >= a && x < b);
    if (!face && x % DROP === DROP - 1) continue;
    cols.push(x);
  }
  // 2. the 4:1 stair: each kept column drops by (i − SHEAR_X0) · SHEAR
  const extra = Math.ceil(cols.length * SHEAR) + 1;
  const o = new PixelCanvas(cols.length, p.h + extra);
  cols.forEach((x, i) => {
    const dy = Math.max(0, Math.floor((i - SHEAR_X0) * SHEAR));
    for (let y = 0; y < p.h; y++) {
      const c = p.get(x, y);
      if (c !== null) o.set(i, y + dy, c);
    }
  });
  return o;
}

function sprite(f: number): PixelCanvas {
  const p = new PixelCanvas(SW, SH);
  drawRaiders(p, cardPose(f), 'left');
  // the card's tone budget (≤ 20): fold the rarest sprite tones into their neighbours
  return shear(
    recolor(p, {
      [PAL.gold0]: PAL.earth0, [PAL.gold1]: PAL.earth1, [PAL.gold2]: PAL.earth3, [PAL.gold3]: PAL.fire4, [PAL.gold4]: PAL.fire4, [PAL.earth4]: PAL.earth3, [PAL.stone4]: PAL.stone3,
      [PAL.leaf0]: PAL.ink, [PAL.fire0]: PAL.ink, [PAL.leaf4]: PAL.leaf3, [PAL.steel]: PAL.stone3, [PAL.water3]: PAL.mist, [PAL.water4]: PAL.mist,
    }),
  );
}

function big(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'FIRE', { focus: [FOCUS[0], FOCUS[1] - 8], horizon: 44 });
  l.subject.blit(sprite(f), BIG_DX, BIG_DY);
}

function small(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'FIRE', { focus: [FOCUS_SMALL[0] + 14, 16], horizon: 22 });
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
