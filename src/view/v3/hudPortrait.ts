// HUD portrait of the Neon Tower look (owner C, docs/v3/ARENA_NEON_TOWER.md §10): the two duelists' faces in the HUD
// panels' player emblem slot (src/view/v3/hudSkin.ts HUD3.emblem, 25 × 23, left of the SIRA chip's row: the hexagon that
// used to carry the player's number). Painted from the SAME portrait maps as the wall screens
// (src/art/arena-nt/portraits.ts, 80 × 56): the face is cropped and halved 2:1 (a mode filter per 2 × 2 block that keeps the
// dark outline pixels on ties, so the eyes and the jaw line survive) and clipped to the emblem's hexagon, inside the owner's
// trim ring. Three moods (idle / hurt on a loss / glad on a gain), two ring levels (resting / the side to move).
// Pure PixelCanvas code (palette only), no Phaser: runs in tests and tools. Only used when the Neon Tower arena is on.

import { FRAME_V3 } from '../../art/frame-v3';
import { PAL, RAMPS } from '../../art/palette';
import { PixelCanvas, type Pt } from '../../art/pixel';
import { paintPortrait, type PortraitMood } from '../../art/arena-nt/portraits';
import type { PlayerId } from '../../engine/types';
import { HUD3 } from './hudSkin';

export type HudMood = PortraitMood;

/** Crop of the 80 × 56 portrait that becomes the face (42 × 38 → 21 × 19, the hexagon's interior). */
const CROP = [
  { x: 25, y: 11 },
  { x: 20, y: 11 },
] as const;
const CROP_W = 42;
const CROP_H = 38;

const lum = (c: number): number => 0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255);

/** 2:1 mode downsample of a crop: the most common colour of each 2 × 2 block, the darker one on ties. */
function halve(src: PixelCanvas, x0: number, y0: number, w: number, h: number): PixelCanvas {
  const out = new PixelCanvas(w >> 1, h >> 1);
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++) {
      const count = new Map<number, number>();
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 2; i++) {
          const c = src.get(x0 + 2 * x + i, y0 + 2 * y + j);
          if (c !== null) count.set(c, (count.get(c) ?? 0) + 1);
        }
      let best = -1;
      let bn = 0;
      for (const [c, n] of count) if (n > bn || (n === bn && best >= 0 && lum(c) < lum(best))) {
        best = c;
        bn = n;
      }
      if (best >= 0) out.set(x, y, best);
    }
  return out;
}

/** The hexagon of HUD3.emblem at inset i (the same polygon hudSkin.emblemV3 fills). */
function hexPts(i: number): Pt[] {
  const { w, h } = HUD3.emblem;
  const mid = (h - 1) / 2;
  return [
    [6 + i, i],
    [w - 7 - i, i],
    [w - 1 - i, mid],
    [w - 7 - i, h - 1 - i],
    [6 + i, h - 1 - i],
    [i, mid],
  ];
}

/**
 * The portrait emblem (HUD3.emblem.w × h): ink outline, the owner's trim ring (one tone up when `lit`: the side to move)
 * and the face inside, in the given mood.
 */
export function hudPortrait(player: PlayerId, mood: HudMood = 'idle', lit = false): PixelCanvas {
  const { w, h } = HUD3.emblem;
  const R = player === 0 ? RAMPS.cyan : RAMPS.crim;
  const mid = (h - 1) / 2;
  const p = new PixelCanvas(w, h);
  p.poly(hexPts(0), PAL.ink);
  p.poly(hexPts(1), R[2]);
  const mask = new PixelCanvas(w, h);
  mask.poly(hexPts(2), PAL.white);
  // the ring: lit from the top left like the number emblem; the side to move rings one tone up all round
  p.map((c, x, y) => (c === R[2] ? (lit || y < mid || (x < 3 && y <= mid) ? R[3] : R[2]) : c));
  const face = halve(paintPortrait(player, { mood }), CROP[player].x, CROP[player].y, CROP_W, CROP_H);
  // the face sits centred in the hexagon's interior (21 × 19, from (2, 2))
  const fx = 2 + ((w - 4 - face.w) >> 1);
  const fy = 2 + ((h - 4 - face.h) >> 1);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!mask.isOpaque(x, y)) continue;
      const c = face.get(x - fx, y - fy);
      p.set(x, y, c ?? FRAME_V3.bodyBottom);
    }
  // the interior's rim: one pixel of the panel body's dark band so the face does not touch the ring
  return p;
}
