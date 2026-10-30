// Card art v3 — Çelik Susturucu (steel_silencer, DARK machine): the sprite's own pixels, 1:1, in a new composition
// (style sheet docs/v3/KART_RESIMLERI.md §5, contract ./_types.ts).
//
// big (88×68)   the walker from the stacks down to the belt, as the board draws it (the idle frame, whole pixels, never
//               scaled): the flat visor head with its violet eye slit, the copper-steel barrel chest with the core port,
//               the hexagonal seal-shield and the pile-driver forearm. Ground: the kit's DARK recipe, the eclipse behind
//               the head so the copper brow and the steel plates read against it.
// small (44×34) the SAME picture, closer: a 1:1 crop of the sprite — visor, core port and the shield's edge — on the same eclipse.
// Living (4 frames, 170 ms): the sprite's own idle frames 0 / 3 / 6 / 9 (servo ticks, steam, eye sweep, core pulse).
// Colours only from PAL (the sprite and the kit).

import { PixelCanvas } from '../pixel';
import silencer from '../monsters-v3/steel_silencer';
import { paintBackdrop } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

/** The eye slit's centre in BIG px. */
const FOCUS = [48, 22] as const;
const FOCUS_SMALL = [22, 12] as const;
/** The sprite frame's crop that is the picture (frame px → picture px 1:1). */
const BIG_CROP = [16, 16, 88, 68] as const;
const SMALL_CROP = [42, 26, 44, 34] as const;
const IDLE_FRAMES = [0, 3, 6, 9] as const;

function sprite(f: number): PixelCanvas {
  const p = new PixelCanvas(silencer.w, silencer.h);
  silencer.draw(p, 'idle', IDLE_FRAMES[f % IDLE_FRAMES.length], { lightFrom: 'left' });
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
  id: 'steel_silencer',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 4,
  holdMs: 170,
  big,
  small,
};

export default art;
