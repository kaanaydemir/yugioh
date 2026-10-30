// Card art v3 — Mühürlü Baş (seal_head, the colossus head of the Beş Mühür set): the sprite's own pixels, 1:1, on the set's shared
// "Seal Eclipse" backdrop (docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
//
// big (88×68)   the head as the board draws it: crest, brow slab with the forehead disc, the huge eye socket at the eclipse's
//               centre, the straps and the chain loop, the torn neck stump with its seam. Backdrop: the kit's DARK eclipse plus
//               FIVE short stepped rays at the pentagon angles (the set's mark); a "pentad" of five dots sits in the top-left
//               corner, this card's vertex (the head, the apex) lit mag4, the other four mag2 (light layer).
// small (44×34) the SAME picture, closer: a 1:1 crop of the sprite on the eye, the brow and the strap.
// Living (4 frames, 170 ms): the sprite's own idle frames 0 / 3 / 6 / 9 (the eye swells, the forehead disc breathes, the chains swing).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import sealHead from '../monsters-v3/seal_head';
import { paintBackdrop } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

/** The eye socket's centre in BIG px (the eclipse is centred on it). */
const FOCUS = [44, 27] as const;
const FOCUS_SMALL = [22, 14] as const;
const BIG_CROP = [12, 6, 88, 68] as const;
const SMALL_CROP = [34, 19, 44, 34] as const;
const IDLE_FRAMES = [0, 3, 6, 9] as const;

function sprite(f: number): PixelCanvas {
  const p = new PixelCanvas(sealHead.w, sealHead.h);
  sealHead.draw(p, 'idle', IDLE_FRAMES[f % IDLE_FRAMES.length], { lightFrom: 'left' });
  return p;
}

/** The set's five rays: short stepped bars at -90, -18, 54, 126, 198 degrees round the eclipse centre. */
function rays(p: PixelCanvas, cx: number, cy: number, r0: number, len: number): void {
  for (const a of [-90, -18, 54, 126, 198]) {
    const c = Math.cos((a * Math.PI) / 180);
    const s = Math.sin((a * Math.PI) / 180);
    for (let t = r0; t <= r0 + len; t++) p.set(Math.round(cx + c * t * 1.0), Math.round(cy + s * t * 0.8), PAL.void2);
  }
}

/** The pentad: five dots on a pentagon (apex up); vertex 0 (the head) is this card's own, lit mag4. */
function pentad(p: PixelCanvas, pts: readonly (readonly [number, number])[]): void {
  pts.forEach(([x, y], i) => p.set(x, y, i === 0 ? PAL.mag4 : PAL.mag2));
}

function big(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'DARK', { focus: FOCUS });
  rays(l.backdrop, FOCUS[0], FOCUS[1], 24, 7);
  l.subject.blit(sprite(f).crop(BIG_CROP[0], BIG_CROP[1], BIG_CROP[2], BIG_CROP[3]), 0, 0);
  pentad(l.light, [[7, 4], [10, 6], [9, 10], [5, 10], [4, 6]]);
}

function small(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'DARK', { focus: FOCUS_SMALL, horizon: 24 });
  rays(l.backdrop, FOCUS_SMALL[0], FOCUS_SMALL[1], 12, 4);
  l.subject.blit(sprite(f).crop(SMALL_CROP[0], SMALL_CROP[1], SMALL_CROP[2], SMALL_CROP[3]), 0, 0);
  pentad(l.light, [[4, 2], [6, 3], [5, 6], [3, 6], [2, 3]]);
}

const art: CardArtV3 = {
  id: 'seal_head',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 4,
  holdMs: 170,
  big,
  small,
};

export default art;
