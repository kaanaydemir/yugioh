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
export const EMBLEM_AT = { x: 48, y: 21 } as const;
/** Corridor opening (the part the platform's far corner may overlap) inside the tower texture. */
export const CORRIDOR_AT = { x: 70, y: 58, w: 28, h: 10 } as const;
/** Where the energy line runs (local x of its two pixels, y range above the emblem and below the corridor). */
export const ENERGY_LINE = { x: 83, y0: 0, y1: 21 } as const;

function leftHalf(): PixelCanvas {
  const W = 84;
  const H = TOWER_H;
  const p = new PixelCanvas(W, H);
  // ---- flanking pillar x 4..15 (tall, lit left edge, dim neon tube) and the dark gap x 0..21
  p.rect(0, 0, 22, H, T.ink);
  p.rect(0, 0, 4, H, T.n0);
  p.rect(5, 0, 10, H, T.n1);
  p.vline(4, 0, H - 1, T.ink);
  p.vline(5, 0, H - 1, T.n3);
  p.vline(14, 0, H - 1, T.n0);
  p.vline(15, 0, H - 1, T.ink);
  p.vline(9, 0, H - 1, T.c0);
  p.vline(10, 0, H - 1, T.c1);
  for (let y = 6; y < H; y += 12) p.vline(10, y, y + 4, T.c2);
  for (let y = 12; y < H; y += 24) {
    p.rect(4, y, 12, 3, T.n2);
    p.hline(4, 15, y, T.n3);
    p.hline(4, 15, y + 3, T.ink);
  }
  p.rect(3, 0, 14, 9, T.n2); // capital
  p.hline(3, 16, 0, T.n3);
  p.hline(3, 16, 9, T.ink);

  // ---- the tower body: wide base (x 22.., y 36..) under a narrower shaft (x 28.., y 0..35), a lit setback ledge between
  p.rect(22, 36, 62, H - 36, T.n1);
  p.rect(28, 0, 56, 36, T.n1);
  // outer rim light (bright, vertical = the drama): ink edge, lit edge, neon line
  const rim = (x: number, y0: number, y1: number): void => {
    p.vline(x, y0, y1, T.ink);
    p.vline(x + 1, y0, y1, T.n3);
    p.vline(x + 2, y0, y1, T.c2);
    p.vline(x + 3, y0, y1, T.c0);
    p.vline(x + 4, y0, y1, T.ink);
  };
  rim(28, 0, 35);
  rim(22, 36, H - 1);
  // the ledge: lit top, ink under, a string of cyan lamps
  p.hline(22, 27, 34, T.n3);
  p.hline(22, 27, 35, T.c1);
  p.hline(22, 27, 36, T.ink);
  p.hline(22, 27, 37, T.n2);
  for (let x = 23; x < 28; x += 2) p.set(x, 35, T.c3);
  // vertical plates of the shaft: two tall panels with a seam and a lit edge
  p.vline(40, 0, 35, T.ink);
  p.vline(41, 0, 35, T.n2);
  p.vline(52, 0, 35, T.ink);
  p.vline(53, 0, 35, T.n2);
  for (const y of [12, 32]) {
    p.hline(33, 61, y, T.n2);
    p.hline(33, 61, y + 1, T.ink);
  }
  // body plates (base): recessed windows with a lit lower edge
  for (const [x, y, w, h] of [
    [29, 42, 14, 18],
    [29, 64, 14, 16],
  ] as const) {
    p.rect(x, y, w, h, T.n0);
    p.hline(x, x + w - 1, y, T.ink);
    p.vline(x, y, y + h - 1, T.ink);
    p.hline(x + 1, x + w - 1, y + h - 1, T.n3);
    p.vline(x + w - 1, y + 1, y + h - 1, T.n2);
  }
  for (let i = 0; i < 3; i++) p.hline(32, 40, 47 + i * 3, T.ink);
  for (let i = 0; i < 3; i++) p.hline(32, 32 + 2 + i * 2, 68 + i * 3, T.c0);
  p.rect(37, 68, 4, 7, T.ink);
  p.vline(38, 69, 73, T.r0);
  // lower base block
  p.rect(22, 84, 40, 18, T.n0);
  p.hline(22, 61, 84, T.n3);
  p.hline(22, 61, 85, T.ink);
  for (let x = 28; x < 60; x += 8) p.vline(x, 88, 99, T.n1);

  // ---- recessed inner column x 56..61 (darker, a dim neon strip)
  p.rect(56, 0, 6, H, T.n0);
  p.vline(56, 0, H - 1, T.ink);
  p.vline(57, 0, H - 1, T.n1);
  p.vline(59, 4, H - 1, T.c0);
  for (let y = 22; y < H - 10; y += 14) p.vline(59, y, y + 4, T.c1);
  p.vline(61, 0, H - 1, T.n2); // spine's outer edge catches light

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
  // ---- the arch: a tall dark recess behind the big emblem (local x 46..83), chamfered at the head
  for (let y = 19; y < H; y++) {
    const x0 = y < 23 ? 46 + (23 - y) : 46;
    p.hline(x0, 83, y, T.ink);
    if (y >= 23) {
      p.set(46, y, T.n2);
      p.set(47, y, y % 6 < 3 ? T.c0 : T.n0);
    }
  }
  for (let i = 0; i < 4; i++) p.set(50 - i, 19 + i, T.n3);
  p.hline(50, 83, 19, T.n3);
  p.hline(50, 83, 20, T.n1);
  for (let y = 24; y < 58; y++)
    for (let x = 49; x < 84; x++) if (((x + y) & 1) === 0 && (x - 49) * 0.5 + Math.abs(y - 40) * 0.9 < 28) p.set(x, y, T.c0);
  // faint back-light bars inside the arch (stepped, 2 tones) so the wings read against a lit stage
  for (const [y, w] of [
    [24, 0],
    [48, 3],
  ] as const) p.hline(49 + w, 83, y, T.c0);
  // ---- corridor under the shield tip (y 58..69), three lit steps, a door glow
  const d = 9;
  p.rect(70, 49 + d, 14, 9, T.ink);
  p.vline(70, 49 + d, 57 + d, T.n3);
  p.vline(71, 49 + d, 57 + d, T.n2);
  p.hline(70, 83, 49 + d, T.n3);
  p.hline(71, 83, 50 + d, T.n2);
  p.hline(72, 83, 52 + d, T.c0);
  p.hline(72, 83, 53 + d, T.c1);
  p.hline(72, 83, 54 + d, T.c1);
  p.hline(72, 83, 55 + d, T.c2);
  p.hline(72, 83, 56 + d, T.c2);
  p.hline(72, 83, 57 + d, T.c3);
  for (let x = 72; x < 84; x += 2) p.set(x, 51 + d, T.c0);
  p.rect(66, 58 + d, 18, 2, T.n2);
  p.hline(66, 83, 58 + d, T.n3);
  p.hline(66, 83, 59 + d, T.c1);
  p.rect(62, 60 + d, 22, 2, T.n1);
  p.hline(62, 83, 60 + d, T.n2);
  p.hline(62, 83, 61 + d, T.c0);
  p.rect(58, 62 + d, 26, 3, T.n0);
  p.hline(58, 83, 62 + d, T.n1);
  p.hline(58, 83, 63 + d, T.c0);
  p.vline(60, 65 + d, 92, T.c0);
  p.vline(61, 65 + d, 92, T.n1);
  p.rect(62, 65 + d, 22, H - 65 - d, T.n0);
  p.vline(62, 65 + d, H - 1, T.n1);
  for (const y of [84, 92]) {
    p.hline(64, 83, y, T.n1);
    p.hline(64, 83, y + 1, T.ink);
  }
  return p;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;
const LIFT = new Map<number, number>([
  [T.ink, T.n0],
  [T.n0, T.n1],
  [T.n1, T.n2],
  [T.n2, T.n3],
  [T.n3, T.n4],
  [T.c0, T.c1],
  [T.c1, T.c2],
]);

/**
 * Light cones: ordered-dither wedges that lift every pixel they cover by ONE palette tone (no alpha). Two ceiling cones
 * lean in from the outer lamps onto the shaft, and a central shaft of light falls from the energy line through the
 * emblem arch to the doorway. dens(x, y) in 0..1 per pixel; level is the Bayer threshold test.
 */
function lightPass(p: PixelCanvas): void {
  const cx = TOWER_W / 2;
  const dens = (x: number, y: number): number => {
    let d = 0;
    // outer cones: apex above x 36 / 131, widening downwards, fading by y 70
    for (const ax of [38, TOWER_W - 1 - 38]) {
      const half = 3 + y * 0.32;
      const off = Math.abs(x - ax);
      if (off < half) d = Math.max(d, (1 - off / half) * Math.max(0, 1 - y / 76) * 1.15);
    }
    // central shaft: narrow, bright at the top
    const off = Math.abs(x - (cx - 0.5));
    const half = 5 + y * 0.1;
    if (off < half) d = Math.max(d, (1 - off / half) * Math.max(0, 1 - y / 64) * 0.9);
    return d;
  };
  for (let y = 0; y < TOWER_H; y++)
    for (let x = 0; x < TOWER_W; x++) {
      const d = dens(x, y);
      if (d <= 0.12) continue;
      if (d * 0.95 <= (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16) continue;
      const c = p.get(x, y);
      if (!c) continue;
      const to = LIFT.get(c);
      if (to !== undefined) p.set(x, y, to);
    }
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
  lightPass(p);
  return p;
}
