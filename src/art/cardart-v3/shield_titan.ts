// Card art v3 — Kalkan Devi (shield_titan, EARTH warrior): the sprite's own pixels, 1:1, in a new composition
// (style sheet docs/v3/KART_RESIMLERI.md §5, contract ./_types.ts).
//
// big (88×68)   the whole creature as the board draws it (idle, the sprite's pixels moved by whole pixels, never
//               scaled), standing on the kit's EARTH floor in front of the low dusty sun: the tall ogive slab with
//               the amber eyes in its sight slot, the gold tower on the crest, the dark pauldron and gauntlet on its
//               left rim. The slab BRISTLES with what has failed against it: three more arrows than the one the
//               sprite carries, each planted in the face and reaching out past the rim (they carry the silhouette
//               to the right so the creature fills the window), a snapped sword-blade stuck in the ground leaning on
//               it, pebbles at its foot. Light (after the outline): the eyes' amber, the tower's gold windows, one
//               spark where the last arrow struck.
// small (44×34) the SAME picture, closer (KART_RESIMLERI §1): a 1:1 crop of the sprite's upper half — the eyes, the
//               crest's tower, the pauldron and the arch — on the same floor and sun; the arrows' tails come in from
//               the right.
// Living (4 frames, 160 ms): the sprite's idle breath (its own frames 0 / 3 / 6 / 9: pauldron, crown creak, the
// glint, the lids), the spark steps through three positions.
// Colours only from PAL (the sprite and the kit).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import shieldTitan from '../monsters-v3/shield_titan';
import { ink, paintBackdrop } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

/** The eyes' centre in BIG px (the frame (36, 31) of the sprite, moved by BIG_AT). */
const FOCUS = [40, 19] as const;
/** The sprite frame → the big picture (whole px). */
const BIG_AT = [4, -12] as const;
/** The sprite frame's crop that is the small picture, and where it lands (1:1). */
const SMALL_CROP = [12, 17, 44, 34] as const;
const FOCUS_SMALL = [29, 13] as const;

/** The idle frame of the card's loop (the sprite's own: 0 = rest, 3 = inhale + glint, 6 = the blink, 9 = the exhale). */
const IDLE_FRAMES = [0, 3, 6, 9] as const;

/** The creature as the board draws it. */
function sprite(f: number): PixelCanvas {
  const p = new PixelCanvas(shieldTitan.w, shieldTitan.h);
  shieldTitan.draw(p, 'idle', IDLE_FRAMES[f % IDLE_FRAMES.length], { lightFrom: 'left' });
  return p;
}

/** A planted arrow: a 1-px shaft of earth3 stepping up by `rise` px over `run` px, a mist fletching at the tail. */
function arrow(q: PixelCanvas, x0: number, y0: number, run: number, rise: number): void {
  for (let i = 0; i <= run; i++) {
    const x = x0 + i;
    const y = y0 - Math.floor((i * rise) / run);
    q.set(x, y, i < 3 ? PAL.earth2 : PAL.earth3);
    if (i > 0 && Math.floor(((i - 1) * rise) / run) !== Math.floor((i * rise) / run)) q.set(x - 1, y, i < 3 ? PAL.earth2 : PAL.earth3); // keep the shaft 4-connected
  }
  const tx = x0 + run;
  const ty = y0 - rise;
  // the fletching: a three-px vane that opens toward the tail
  q.set(tx + 1, ty, PAL.mist).set(tx + 1, ty - 1, PAL.steel).set(tx + 1, ty + 1, PAL.steel).set(tx + 2, ty - 1, PAL.mist).set(tx + 2, ty + 1, PAL.mist);
}

/** The snapped blade stuck in the ground, leaning on the slab: iron planes (lit left edge, mid, shade right), a broken top. */
function blade(q: PixelCanvas): void {
  // base on the floor at x 71..74, y 60; leaning left as it rises to the snap at (67..70, 33)
  for (let y = 33; y <= 60; y++) {
    const lean = Math.round(((60 - y) * 4) / 27); // 0 at the foot … 4 at the snap
    const x0 = 71 - lean;
    q.set(x0, y, PAL.steel);
    q.set(x0 + 1, y, PAL.night4);
    q.set(x0 + 2, y, PAL.night3);
    q.set(x0 + 3, y, PAL.night2);
  }
  // the snap: a jagged top
  q.set(67, 32, PAL.steel).set(68, 32, PAL.night4).set(69, 31, PAL.night3).set(70, 32, PAL.night2);
  // the fuller: a darker groove down the middle
  for (let y = 38; y <= 56; y++) q.set(Math.round(71 - ((60 - y) * 4) / 27) + 1, y, PAL.night3);
}

/** Pebbles and a clod at the foot of the slab (big px). */
function pebbles(q: PixelCanvas): void {
  for (const [x, y, w] of [[12, 61, 3], [17, 62, 2], [6, 62, 2], [66, 62, 3], [79, 61, 2]] as const) {
    q.rect(x, y, w, 1, PAL.earth3);
    q.rect(x, y + 1, w, 1, PAL.earth1);
  }
}

/** The spark where the last arrow struck (light layer; 3 positions of the loop). */
const SPARK: readonly (readonly [number, number])[] = [[63, 38], [64, 37], [63, 36]];

function big(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'EARTH', { focus: FOCUS });
  const behind = new PixelCanvas(l.subject.w, l.subject.h);
  blade(behind);
  pebbles(behind);
  l.subject.blit(ink(behind), 0, 0);
  l.subject.blit(sprite(f), BIG_AT[0], BIG_AT[1]);
  // the arrows planted in the face, reaching out to the right past the rim (card coords): drawn over the sprite with their own ink
  const front = new PixelCanvas(l.subject.w, l.subject.h);
  arrow(front, 50, 27, 11, 3); // the upper face, a shallow rise
  arrow(front, 52, 46, 14, 4); // the lower face
  arrow(front, 36, 8, 0, 0); // a stub in the crown's shoulder (the head of a shaft that broke off)
  l.subject.blit(ink(front), 0, 0);
  const [sx, sy] = SPARK[f % SPARK.length];
  l.light.set(sx, sy, PAL.white).set(sx - 1, sy, PAL.mist).set(sx + 1, sy, PAL.mist).set(sx, sy - 1, PAL.mist).set(sx, sy + 1, PAL.mist);
}

function small(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'EARTH', { focus: FOCUS_SMALL, horizon: 24 });
  const spr = sprite(f);
  l.subject.blit(spr.crop(SMALL_CROP[0], SMALL_CROP[1], SMALL_CROP[2], SMALL_CROP[3]), 0, 0);
  // the arrows' tails come in from the right at 1× density
  const front = new PixelCanvas(l.subject.w, l.subject.h);
  arrow(front, 36, 16, 6, 2);
  l.subject.blit(ink(front), 0, 0);
}

const art: CardArtV3 = {
  id: 'shield_titan',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 4,
  holdMs: 160,
  big,
  small,
};

export default art;
