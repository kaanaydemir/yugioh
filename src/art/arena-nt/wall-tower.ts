// Neon Tower — the tall symmetrical tower at the back centre (owner A2). 168 × 102, drawn once for the
// left half and mirrored, so it is symmetrical to the pixel. Dark metal; the only colour is the dim vertical
// energy line, the emblem plate (separate frames, wall-emblem.ts), the corridor's threshold glow and a few LEDs.
// Local x 0..167 = screen x 236..403, local y = screen y (the tower starts at the top of the frame).
//
//   x   0..33  outer buttress (lit, 2 panels, ribs, LED column)
//   x  34..61  recessed inner column (dark, a dim neon strip)
//   x  62..105 centre spine: energy line above, the emblem plate (44 × 26) at y 22..47, the corridor below
//
// The corridor is the small gate (28 × 10) under the emblem, with a three-step stair leading to the platform.

import { PixelCanvas } from '../pixel';
import { T } from './wall-kit';

export const TOWER_W = 168;
export const TOWER_H = 102;
/** Emblem plate position inside the tower texture. */
export const EMBLEM_AT = { x: 62, y: 22 } as const;
/** Corridor opening (the part the platform's far corner may overlap) inside the tower texture. */
export const CORRIDOR_AT = { x: 70, y: 48, w: 28, h: 10 } as const;
/** Where the energy line runs (local x of its two pixels, y range above the emblem and below the corridor). */
export const ENERGY_LINE = { x: 83, y0: 0, y1: 21 } as const;

function leftHalf(): PixelCanvas {
  const W = 84;
  const H = TOWER_H;
  const p = new PixelCanvas(W, H);
  // ---- outer buttress x 0..33
  p.rect(0, 0, 34, H, T.n1);
  p.rect(0, 0, 34, 14, T.n0); // the head of the tower sits in shadow
  p.vline(0, 0, H - 1, T.ink);
  p.vline(1, 0, H - 1, T.n2); // lit outer edge
  p.vline(33, 0, H - 1, T.ink);
  p.vline(32, 0, H - 1, T.n0);
  // two vertical panels with a seam
  p.vline(16, 14, H - 1, T.ink);
  p.vline(17, 14, H - 1, T.n2);
  // horizontal ribs with an ink shadow under
  for (const y of [14, 40, 64, 84]) {
    p.hline(2, 32, y, T.n2);
    p.hline(2, 32, y + 1, T.ink);
  }
  // armour plates: four recessed windows
  for (const [x, y, w, h] of [
    [4, 20, 10, 16],
    [19, 20, 11, 16],
    [4, 46, 10, 14],
    [19, 46, 11, 14],
  ] as const) {
    p.rect(x, y, w, h, T.n0);
    p.hline(x, x + w - 1, y, T.ink);
    p.vline(x, y, y + h - 1, T.ink);
    p.hline(x + 1, x + w - 1, y + h - 1, T.n2);
    p.vline(x + w - 1, y + 1, y + h - 1, T.n2);
  }
  // vent slits in the lower windows
  for (let i = 0; i < 3; i++) {
    p.hline(6, 11, 50 + i * 3, T.ink);
    p.hline(21, 27, 50 + i * 3, T.ink);
  }
  // an inset data strip in the upper left window (dim cyan0 dashes)
  for (let i = 0; i < 4; i++) p.hline(6, 6 + 3 + ((i * 3) % 5), 24 + i * 3, T.c0);
  // red status plate in the upper right window
  p.rect(22, 24, 5, 8, T.ink);
  p.vline(24, 25, 30, T.r0);
  // lower base block
  p.rect(2, 66, 30, 36, T.n0);
  p.hline(2, 32, 66, T.n2);
  p.hline(2, 32, 67, T.ink);
  for (let x = 6; x < 32; x += 8) p.vline(x, 70, 98, T.n1);

  // ---- recessed inner column x 34..61 (darker, with a dim neon strip)
  p.rect(34, 0, 28, H, T.n0);
  p.rect(34, 0, 28, 12, T.ink);
  p.vline(34, 0, H - 1, T.ink);
  p.vline(35, 14, H - 1, T.n1);
  p.vline(61, 0, H - 1, T.n1); // spine's outer edge catches light
  // stepped ribs
  for (const y of [14, 36, 58, 78]) {
    p.hline(36, 60, y, T.n1);
    p.hline(36, 60, y + 1, T.ink);
  }
  // the dim neon strip: 2 px wide, x 44..45, dashes of cyan1 on cyan0
  p.rect(43, 16, 4, 76, T.ink);
  p.vline(44, 17, 90, T.c0);
  p.vline(45, 17, 90, T.c0);
  for (let y = 22; y < 88; y += 14) {
    p.vline(44, y, y + 4, T.c1);
    p.vline(45, y, y + 4, T.c1);
  }
  // little vent rows either side of the strip
  for (let i = 0; i < 5; i++) {
    p.hline(38, 41, 20 + i * 5, T.ink);
    p.hline(49, 58, 20 + i * 5, T.n1);
  }
  p.rect(38, 70, 20, 14, T.ink);
  p.frame(38, 70, 20, 14, T.n1);
  for (let i = 0; i < 3; i++) p.hline(41, 54, 73 + i * 3, T.n1);
  // base of the column
  p.rect(34, 90, 28, 12, T.n0);
  p.hline(35, 60, 90, T.n2);

  // ---- centre spine x 62..83 (left half)
  p.rect(62, 0, 22, H, T.n1);
  p.vline(62, 0, H - 1, T.ink);
  p.vline(63, 0, H - 1, T.n2);
  // energy line housing above the emblem (x 76..83): a dark channel with the line itself drawn in wall.ts
  p.rect(76, 0, 8, 22, T.ink);
  p.vline(76, 0, 21, T.n2);
  p.vline(77, 0, 21, T.n0);
  // line (left pixel of the pair at local 83): dim glass, core, glow
  p.vline(83, 0, 21, T.c1);
  p.vline(82, 0, 21, T.c0);
  for (let y = 3; y < 22; y += 6) p.vline(83, y, y + 2, T.c2);
  // spine panels around the emblem plate (plate occupies x 62..83 of the half, y 22..47)
  p.rect(62, 22, 22, 26, T.ink);
  // below the plate: lintel of the corridor
  p.rect(62, 48, 22, 10, T.n1);
  p.hline(62, 83, 48, T.n2);
  // corridor opening (28 wide: local x 70..83 in the half)
  p.rect(70, 49, 14, 9, T.ink);
  p.vline(70, 49, 57, T.n3);
  p.vline(71, 49, 57, T.n2);
  p.hline(70, 83, 49, T.n3);
  p.hline(71, 83, 50, T.n2);
  // inner depth: a dim cyan back light and three lit steps
  p.hline(73, 83, 54, T.c0);
  p.hline(73, 83, 55, T.c1);
  p.hline(72, 83, 56, T.c0);
  p.hline(72, 83, 57, T.c1);
  // stair below the corridor: three steps, each wider, edge lit dim
  p.rect(66, 58, 18, 2, T.n2);
  p.hline(66, 83, 58, T.n3);
  p.hline(66, 83, 59, T.c0);
  p.rect(62, 60, 22, 2, T.n1);
  p.hline(62, 83, 60, T.n2);
  p.hline(62, 83, 61, T.c0);
  p.rect(58, 62, 26, 3, T.n0);
  p.hline(58, 83, 62, T.n1);
  p.hline(58, 83, 63, T.c0);
  p.hline(58, 83, 64, T.ink);
  // guide strips along the stair sides leading down to the base: dim cyan0 lines
  p.vline(60, 65, 92, T.c0);
  p.vline(61, 65, 92, T.n1);
  // podium below the stair: darker mass with plates
  p.rect(62, 65, 22, 37, T.n0);
  p.vline(62, 65, 101, T.n1);
  for (const y of [74, 86]) {
    p.hline(64, 83, y, T.n1);
    p.hline(64, 83, y + 1, T.ink);
  }
  p.rect(66, 90, 18, 8, T.ink);
  p.frame(66, 90, 18, 8, T.n1);
  // small LED group on the spine flank above the corridor
  p.set(66, 40, T.c1);
  p.set(66, 43, T.r1);
  p.set(66, 46, T.c1);
  return p;
}

/** The tower texture (168 × 102): the left half mirrored to the right. The emblem plate area is left ink (frames drawn on top). */
export function paintTower(): PixelCanvas {
  const half = leftHalf();
  const p = new PixelCanvas(TOWER_W, TOWER_H);
  p.blit(half, 0, 0);
  p.blit(half, 84, 0, { flipX: true });
  // the centre seam of the energy line: both pixels of the pair
  p.vline(83, 0, 21, T.c1);
  p.vline(84, 0, 21, T.c1);
  p.vline(82, 0, 21, T.c0);
  p.vline(85, 0, 21, T.c0);
  for (let y = 3; y < 22; y += 6) {
    p.vline(83, y, y + 2, T.c2);
    p.vline(84, y, y + 2, T.c2);
  }
  return p;
}
