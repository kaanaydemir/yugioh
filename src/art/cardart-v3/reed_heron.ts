// Card art v3 — Sazlık Balıkçılı (reed_heron, WATER): "Sisli sazlıkta tek ayak üstünde balıkçıl, gagası ay ışığında tek
// çizgi parlıyor." (YENI_KARTLAR C8; style sheet docs/v3/KART_RESIMLERI.md §5, contract ./_types.ts).
//
// big (88×68)   the heron as the board draws it (the rig's own pixels, 1:1, never scaled): one leg in the dark still
//               water, the straw cloak, the S-neck, the reeds and the low mist bank, set well forward so the beak blade
//               has lead room. Ground: the kit's WATER recipe, its slanted moonlight shaft falling on the head. Light:
//               the beak blade burns as ONE white line in the moonlight (the focus), the gold eye.
// small (44×34) the SAME picture, closer (KART_RESIMLERI §1 (1)): a 1:1 crop of the same rig frame — head, the white line
//               of the beak, the S-neck and the wing's top — on the same shaft.
// Living (4 frames, 170 ms): the rig's own idle frames 0 / 4 / 8 / 12 (reeds, mist, water, straw), whole pixels.
// Imports the RIG (not the monster module, which imports this file for its portrait). Colours only from PAL.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { drawHeron, skeleton } from '../monsters-v3/reed_heron-rig';
import { idlePose } from '../monsters-v3/reed_heron-anims';
import { paintBackdrop, recolor } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

/** Sprite frame → picture offsets (picture = sprite shifted by these, 1:1). */
const BIG_DX = 10;
const BIG_DY = -11;
const SMALL_DX = -29;
const SMALL_DY = -14;
const IDLE_FRAMES = [0, 4, 8, 12] as const;

const SK = skeleton(idlePose(0));
/** The beak's moonlit line / the eye in BIG px (the light shape is centred on it). */
const FOCUS = [Math.round(SK.beak0[0] + 6 + BIG_DX), Math.round(SK.beak0[1] + BIG_DY)] as const;
const FOCUS_SMALL = [Math.round(SK.beak0[0] + 2 + SMALL_DX), Math.round(SK.beak0[1] + SMALL_DY)] as const;

/** The picture's colour budget (≤ 20 with the backdrop, KART_RESIMLERI §7): a few sprite tones merge into a neighbour. */
const MERGE: Readonly<Record<number, number>> = {
  [PAL.earth0]: PAL.earth1,
  [PAL.gold1]: PAL.earth2,
  [PAL.gold3]: PAL.gold4,
  [PAL.night2]: PAL.night1,
  [PAL.night3]: PAL.night4,
  [PAL.stone3]: PAL.stone2,
  [PAL.leaf0]: PAL.ink,
};

function sprite(f: number): PixelCanvas {
  const p = new PixelCanvas(96, 84);
  drawHeron(p, idlePose(IDLE_FRAMES[f % IDLE_FRAMES.length]), 'left');
  return recolor(p, MERGE);
}

/** The moonlit beak: the blade's lit top row becomes one white line, the eye gold (light layer, never outlined). */
function moonBeak(light: PixelCanvas, subject: PixelCanvas, dx: number, dy: number): void {
  const len = 16;
  for (let s = 5; s <= len; s++) {
    const x = Math.round(SK.beak0[0] + s) + dx;
    const y = Math.round(SK.beak0[1]) + dy - (s / len < 0.72 ? 1 : 0);
    if (light.inBounds(x, y) && subject.isOpaque(x, y)) light.set(x, y, PAL.white);
  }
  const ex = SK.eye[0] + dx;
  const ey = SK.eye[1] + dy;
  if (light.inBounds(ex, ey)) light.set(ex, ey, PAL.gold4);
}

function big(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'WATER', { focus: FOCUS, radius: 34 });
  l.subject.blit(sprite(f), BIG_DX, BIG_DY);
  moonBeak(l.light, l.subject, BIG_DX, BIG_DY);
}

function small(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'WATER', { focus: [FOCUS_SMALL[0] * 2, FOCUS_SMALL[1] * 2], radius: 30 });
  l.subject.blit(sprite(f), SMALL_DX, SMALL_DY);
  moonBeak(l.light, l.subject, SMALL_DX, SMALL_DY);
}

const art: CardArtV3 = {
  id: 'reed_heron',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 4,
  holdMs: 170,
  big,
  small,
};

export default art;
