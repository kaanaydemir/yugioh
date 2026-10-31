// Card art v3 — Zehir Ejderi (venom_drake, DARK dragon). INTERIM picture of the scorpion-wyvern redesign
// (docs/v3/kart-a/venom_drake.md §7): the old bust drew the deleted serpent head (venom_drake-head.ts), so
// until the card-art stage paints the real composition, the picture is the NEW sprite's own idle f0 (the
// same pixels, the same key light from the top left) cropped on the kit's DARK backdrop:
//   big   the whole wyvern, 1 sprite px = 1 big px (true 1-px detail), the bulb near the focus;
//   small the head and the glowing throat sac, 1 sprite px = 1 small px (a crop, never a downscale).
// The venom bulb is the focus (the brightest point). Living art: none yet (frames 1).
// Colours only from PAL (the sprite's own palette + the backdrop's).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import art from '../monsters-v3/venom_drake-wyvern';
import { paintBackdrop } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

let sprite: PixelCanvas | null = null;
function idle0(): PixelCanvas {
  if (!sprite) {
    sprite = new PixelCanvas(art.w, art.h);
    art.draw(sprite, 'idle', 0);
  }
  return sprite;
}

/** Blit the sprite's region (sx, sy, w, h) at (dx, dy). */
function crop(dst: PixelCanvas, sx: number, sy: number, dx: number, dy: number): void {
  const s = idle0();
  for (let y = 0; y < dst.h; y++)
    for (let x = 0; x < dst.w; x++) {
      const c = s.get(sx + x - dx, sy + y - dy);
      if (c !== null) dst.set(x, y, c);
    }
}

const BULB = art.points!('idle', 0).staff!;
const EYE = { x: art.points!('idle', 0).head!.x - 9, y: art.points!('idle', 0).head!.y - 6 };
// big: the sprite x 10…98, y 4…72 → the bulb lands at (BULB − (10, 4))
const BIG_O: readonly [number, number] = [10, 4];
const FOCUS: readonly [number, number] = [BULB.x - BIG_O[0], BULB.y - BIG_O[1]];

const venomDrakeArt: CardArtV3 = {
  id: 'venom_drake' as CardArtV3['id'],
  focus: FOCUS,
  frames: 1,
  holdMs: 150,
  big(l: ArtLayers) {
    paintBackdrop(l.backdrop, 'DARK', { focus: [FOCUS[0], FOCUS[1] + 4], radius: 30, horizon: 60 });
    crop(l.subject, BIG_O[0], BIG_O[1], 0, 0);
  },
  small(l: ArtLayers) {
    // the head with its glowing throat sac and the folded wing's peak: sprite x 54…97, y 34…67
    paintBackdrop(l.backdrop, 'DARK', { focus: [EYE.x - 54, EYE.y - 34], radius: 15, horizon: 30 });
    crop(l.subject, 54, 34, 0, 0);
  },
};
void PAL;

export default venomDrakeArt;
