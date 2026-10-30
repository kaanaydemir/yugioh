// Card art v3 — Akşam Büyücüsü (dusk_sorcerer, DARK master spellcaster): the sprite's own pixels, 1:1, in a new
// composition (style sheet docs/v3/KART_RESIMLERI.md §5, contract ./_types.ts).
//
// big (88×68)   the figure from the hat down to the raised hand, as the board draws it (the "comet coat" idle frame, the
//               sprite's pixels moved by whole pixels, never scaled): the wide violet brim, the two violet eyes under it,
//               the silver beard, the winged collar, the long sleeve reaching right to the open hand with its violet flame,
//               the crescent-moon staff hovering beside it. Ground: the kit's DARK recipe, the eclipse behind the head so the
//               hat and the beard read against it.
// small (44×34) the SAME picture, closer (KART_RESIMLERI §1): a 1:1 crop of the sprite — the hat's cone and brim, the eyes,
//               the flame and the horn of the crescent — on the same eclipse.
// Living (4 frames, 170 ms): the sprite's own idle frames 0 / 4 / 8 / 12 (the flame's cycle, the crescent's loop, the coat).
// Colours only from PAL (the sprite and the kit).

import { PixelCanvas } from '../pixel';
import duskSorcerer from '../monsters-v3/dusk_sorcerer';
import { paintBackdrop } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

/** The eyes' centre in BIG px. */
const FOCUS = [30, 30] as const;
const FOCUS_SMALL = [10, 22] as const;
/** The sprite frame's crop that is the picture (frame px → picture px 1:1). */
const BIG_CROP = [32, 12, 88, 68] as const;
const SMALL_CROP = [52, 18, 44, 34] as const;
const IDLE_FRAMES = [0, 4, 8, 12] as const;

function sprite(f: number): PixelCanvas {
  const p = new PixelCanvas(duskSorcerer.w, duskSorcerer.h);
  duskSorcerer.draw(p, 'idle', IDLE_FRAMES[f % IDLE_FRAMES.length], { lightFrom: 'left' });
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
  id: 'dusk_sorcerer',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 4,
  holdMs: 170,
  big,
  small,
};

export default art;
