// Card art v3 — Hortlak Muhafız (grim_warden, DARK skeleton knight): the sprite's own pixels, 1:1, in a new composition
// (style sheet docs/v3/KART_RESIMLERI.md §5, contract ./_types.ts).
//
// big (88×68)   the knight from the horn tips down to the belt, as the board draws him (idle frames, the sprite's pixels moved
//               by whole pixels, never scaled): the two lyre horns, the skull with its slanted sockets crackling violet, the
//               bare rib cage between the two huge spiked charcoal pauldrons, the greatblade's grip in the bone hands. Ground:
//               the kit's DARK recipe — the eclipse behind the head, so the horns and the bone skull read against it.
// small (44×34) the SAME picture, closer (KART_RESIMLERI §1): a 1:1 crop of the sprite — horns, skull, sockets and the
//               shoulders' spikes — on the same eclipse.
// Living (4 frames, 170 ms): the sprite's own idle frames 0 / 4 / 7 / 10 (the eye lightning crackles in 4 and 10, the rib charge
//               crawls, the cloak breathes).
// Colours only from PAL (the sprite and the kit).

import { PixelCanvas } from '../pixel';
import grimWarden from '../monsters-v3/grim_warden';
import { paintBackdrop } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

/** The near eye's centre in BIG px. */
const FOCUS = [38, 24] as const;
const FOCUS_SMALL = [18, 22] as const;
/** The sprite frame's crop that is the picture (frame px → picture px 1:1). */
const BIG_CROP = [28, 10, 88, 68] as const;
const SMALL_CROP = [48, 12, 44, 34] as const;
const IDLE_FRAMES = [0, 4, 7, 10] as const;

function sprite(f: number): PixelCanvas {
  const p = new PixelCanvas(grimWarden.w, grimWarden.h);
  grimWarden.draw(p, 'idle', IDLE_FRAMES[f % IDLE_FRAMES.length], { lightFrom: 'left' });
  return p;
}

function big(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'DARK', { focus: FOCUS });
  l.subject.blit(sprite(f).crop(BIG_CROP[0], BIG_CROP[1], BIG_CROP[2], BIG_CROP[3]), 0, 0);
}

function small(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'DARK', { focus: FOCUS_SMALL, horizon: 24 });
  l.subject.blit(sprite(f).crop(SMALL_CROP[0], SMALL_CROP[1], SMALL_CROP[2], SMALL_CROP[3]), 0, 0);
}

const art: CardArtV3 = {
  id: 'grim_warden',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 4,
  holdMs: 170,
  big,
  small,
};

export default art;
