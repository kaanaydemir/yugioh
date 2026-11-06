// Card art v3 — Kutup Örsü (polar_anvil, EARTH machine piece): the sprite's own pixels, 1:1, in a new composition
// (style sheet docs/v3/KART_RESIMLERI.md §5, contract ./_types.ts).
//
// big (88×68)   the living anvil front-on as the board draws it, both hammer-arms raised for the strike, sparks
//               hanging in the air over the face, the blue field ring (doubled) on the floor; EARTH backdrop, the
//               kit's sun behind the raised mauls so the iron reads against it. Brightest point: the struck face.
// small (44×34) the SAME picture, closer: a 1:1 crop of the sprite — the face with its blue spark lines, the mauls
//               above it, the eyes under the brow.
// Living (4 frames, 160 ms): spark phase, face sparks and the dust on the field lines move.
// Colours only from PAL (the sprite and the kit).

import { PixelCanvas } from '../pixel';
import { drawAnvil, pose } from '../monsters-v3/polar_anvil-rig';
import { paintBackdrop, recolor } from './_kit';
import { PAL } from '../palette';
import type { ArtLayers, CardArtV3 } from './_types';

const W = 96;
const H = 76;
/** the struck face under the mauls, in BIG px */
const FOCUS = [55, 29] as const;
const FOCUS_SMALL = [36, 14] as const;
/** sprite frame → picture crops (frame px → picture px 1:1) */
const BIG_CROP = [-1, 8] as const;
const SMALL_CROP = [17, 23] as const;

function sprite(f: number): PixelCanvas {
  const p = new PixelCanvas(W, H);
  const ph = (f % 4) / 4;
  drawAnvil(
    p,
    pose({
      nx: 12, ny: -36, fx: -12, fy: -44, eye: 1.6, face: 2, pole: 2, ring: 2, flashN: 0.4,
      spark: 0.3 + ph * 0.16, t: ph, rot: ph, dust: -1,
    }),
    'left',
  );
  // the card's tone budget (≤ 20): fold the rarest sprite tones into their neighbours
  return recolor(p, { [PAL.fire4]: PAL.fire3, [PAL.stone3]: PAL.steel, [PAL.gold4]: PAL.gold3, [PAL.night2]: PAL.water1, [PAL.water2]: PAL.water1 });
}

function big(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'EARTH', { focus: [FOCUS[0], 22] });
  l.subject.blit(sprite(f).crop(0, BIG_CROP[1], 88, 68), -BIG_CROP[0], 0);
}

function small(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'EARTH', { focus: [FOCUS_SMALL[0], 8], horizon: 26 });
  l.subject.blit(sprite(f).crop(SMALL_CROP[0], SMALL_CROP[1], 44, 34), 0, 0);
}

const art: CardArtV3 = {
  id: 'polar_anvil',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 4,
  holdMs: 160,
  big,
  small,
};

export default art;
