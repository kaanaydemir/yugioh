// Neon Tower — hologram creature baking (owner B2, docs/v3/ARENA_NEON_TOWER.md §9). Pure PixelCanvas code
// (no Phaser, no Math.random): turns a creature's own v3 idle frame into a translucent hologram frame.
//
//   * one ramp (crystal: cyan0 … cyan4 + white; wizard: void0 … void4 + white), the source's value picks the tone
//   * translucency WITHOUT alpha: the dark tones are dithered (checker), every second row is blank (the scan
//     lines), so the dark hall shows through; only the outer rim and the lit highlights are solid
//   * a bright 1-px rim round the silhouette (one tone brighter on the edges that face the top-left light)
//   * a lit scan band (3 rows, one tone brighter) that sits at a different height in every frame, so one pass of
//     the loop is one sweep from the head to the feet
// The result is opaque or fully transparent per pixel: palcheck never sees a blended colour.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';

export interface HoloLook {
  /** six tones, dark → light (ramp[5] is white) */
  ramp: readonly [number, number, number, number, number, number];
  /** the creature faces left in the arena (the right hologram): mirror the frames */
  flip: boolean;
  /** tones the body is lowered (bright creatures need more, so they stay see-through) */
  lower: number;
}

export const HOLO_LOOKS: readonly [HoloLook, HoloLook] = [
  { ramp: [PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white], flip: false, lower: 1 },
  { ramp: [PAL.void0, PAL.void1, PAL.void2, PAL.void3, PAL.void4, PAL.white], flip: true, lower: -1 },
];

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Union of the opaque bounds of `frames` (all the same size), or null. */
export function unionBounds(frames: readonly PixelCanvas[]): Box | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (const f of frames) {
    const b = f.bounds();
    if (!b) continue;
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w - 1);
    y1 = Math.max(y1, b.y + b.h - 1);
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function lum(c: number): number {
  return ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;
}

/** Tone (0 … 3) of a source value: the brightest body plane only reaches tone 2, highlights tone 3. */
function toneOf(c: number): number {
  const l = lum(c);
  if (c === PAL.ink || l < 46) return 0;
  if (l < 104) return 1;
  if (l < 188) return 2;
  return 3;
}

/**
 * Bake one hologram frame of `src` (a full creature frame), cropped to `box` (the union box of all the
 * creature's frames, so the cropped frames keep their registration). `index` / `count` place the scan band.
 */
export function bakeHoloFrame(src: PixelCanvas, box: Box, look: HoloLook, index: number, count: number): PixelCanvas {
  const R = look.ramp;
  const out = new PixelCanvas(box.w, box.h);
  const opaque = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < box.w && y < box.h && src.isOpaque(box.x + x, box.y + y);
  // the scan band of this frame: 3 rows, from above the head to below the feet over one loop
  const travel = box.h + 6;
  const band = Math.floor((index * travel) / count) - 3;
  for (let y = 0; y < box.h; y++)
    for (let x = 0; x < box.w; x++) {
      if (!opaque(x, y)) continue;
      const c = src.get(box.x + x, box.y + y)!;
      const ox = look.flip ? box.w - 1 - x : x;
      const left = !opaque(x - 1, y);
      const right = !opaque(x + 1, y);
      const up = !opaque(x, y - 1);
      const down = !opaque(x, y + 1);
      const inBand = y >= band && y < band + 3;
      let tone = -1;
      if (left || right || up || down) {
        // the rim: one tone brighter where the edge faces the top-left light
        tone = (look.flip ? right : left) || up ? 4 : 3;
        // the outline keeps a thin dark gap on its under-side so the rim reads as a line
        if (down && !up && !left && !right && (x + y) % 3 === 0) tone = 2;
      } else {
        let t = Math.min(3, Math.max(0, toneOf(c) - look.lower));
        if (inBand) t = Math.min(4, t + 1);
        // translucency without alpha: scan rows and a checker thin out the dark tones
        const scan = y % 2 === 1;
        if (!inBand) {
          if (t === 0) {
            if (scan || (x + y) % 2 === 1) t = -1;
          } else if (t === 1) {
            if (scan && (x % 2 === 1)) t = -1;
            else if (scan) t = 0;
          } else if (t === 2) {
            if (scan) t = 1;
          }
        }
        tone = t;
      }
      if (tone < 0) continue;
      out.set(ox, y, R[Math.min(5, tone)]);
    }
  // a single white glint on the rim near the top-left of the head region (one per frame, moves with the band)
  return out;
}

/** The flash frame of a summon: the whole silhouette in the lightest tones (rim white, body tone 4). */
export function bakeHoloFlash(src: PixelCanvas, box: Box, look: HoloLook): PixelCanvas {
  const R = look.ramp;
  const out = new PixelCanvas(box.w, box.h);
  for (let y = 0; y < box.h; y++)
    for (let x = 0; x < box.w; x++) {
      if (!src.isOpaque(box.x + x, box.y + y)) continue;
      const edge = !src.isOpaque(box.x + x - 1, box.y + y) || !src.isOpaque(box.x + x + 1, box.y + y) || !src.isOpaque(box.x + x, box.y + y - 1) || !src.isOpaque(box.x + x, box.y + y + 1);
      const ox = look.flip ? box.w - 1 - x : x;
      out.set(ox, y, edge ? R[5] : R[4]);
    }
  return out;
}
