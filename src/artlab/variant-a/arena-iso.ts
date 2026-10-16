// Art Lab A — arena geometry and a tiny iso rasteriser.
//
// World → screen (2:1 isometric, 1 art pixel = 1 game pixel):
//   a = battle axis  (toward the wizard, screen (+1, -1/2))
//   b = depth axis   (toward the viewer's right, screen (+1, +1/2))
//   z = height       (screen (0, -1))
//   screen = (OX + a + b, OY + (b - a) / 2 - z)
// Every surface is rasterised PER PIXEL by inverting that mapping at the pixel centre, so all
// edges are clean 2-px-per-row iso staircases and faces partition exactly (no gaps, no doubles).

import type { Color, PixelCanvas } from '../../art/pixel';
import type { XY } from '../types';

/** Screen position of the platform centre (a = b = 0, z = 0). */
export const OX = 320;
export const OY = 186;

/** Platform half extents (iso units) and build sizes. */
export const HA = 126;
export const HB = 88;
/** Wooden rim beam: width on top (iso units) and height above the floor (px). */
export const RW = 5;
export const RH = 4;
/** Slab thickness below the floor (px). */
export const SLAB = 24;

/** Mats: square size, centres along b, and the two slot rows along a. */
export const MAT = 44;
export const MAT_B = [-50, 0, 50] as const;
export const SLOT_A = 76;

export function scr(a: number, b: number, z = 0): XY {
  return { x: OX + a + b, y: OY + (b - a) / 2 - z };
}

/** Integer screen point (for sprite placement). */
export function scrI(a: number, b: number, z = 0): XY {
  const p = scr(a, b, z);
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

/** Iso coordinates of the plane at height z under the centre of pixel (x, y). */
export function isoAt(x: number, y: number, z = 0): { a: number; b: number } {
  const X = x + 0.5 - OX;
  const Y = y + 0.5 - OY + z;
  return { a: (X - 2 * Y) / 2, b: (X + 2 * Y) / 2 };
}

/** Face shader: local coords on the face (see box()), and the screen pixel. null = leave as is. */
export type FaceFn = (u: number, v: number, x: number, y: number) => Color | null;

export interface BoxFaces {
  /** Top face (z = z1): u = a - a0, v = b - b0. */
  top?: FaceFn;
  /** Front-left face (plane a = a0, faces screen lower-left): u = b - b0, v = z1 - z (0 at the top edge). */
  left?: FaceFn;
  /** Front-right face (plane b = b1, faces screen lower-right): u = a - a0, v = z1 - z. */
  right?: FaceFn;
}

/** Rasterise the three visible faces of an iso box into `p` (screen coordinates, offset ox/oy). */
export function box(
  p: PixelCanvas,
  a0: number,
  a1: number,
  b0: number,
  b1: number,
  z0: number,
  z1: number,
  f: BoxFaces,
  off: XY = { x: 0, y: 0 },
): void {
  const xMin = Math.floor(OX + a0 + b0) - 1;
  const xMax = Math.ceil(OX + a1 + b1) + 1;
  const yMin = Math.floor(OY + (b0 - a1) / 2 - z1) - 1;
  const yMax = Math.ceil(OY + (b1 - a0) / 2 - z0) + 1;
  for (let y = yMin; y <= yMax; y++) {
    const cy = y - off.y;
    if (cy < 0 || cy >= p.h) continue;
    for (let x = xMin; x <= xMax; x++) {
      const cx = x - off.x;
      if (cx < 0 || cx >= p.w) continue;
      const X = x + 0.5 - OX;
      const Y = y + 0.5 - OY;
      // top
      const ta = (X - 2 * (Y + z1)) / 2;
      const tb = (X + 2 * (Y + z1)) / 2;
      if (ta >= a0 && ta < a1 && tb >= b0 && tb < b1) {
        if (f.top) {
          const c = f.top(ta - a0, tb - b0, x, y);
          if (c !== null) p.set(cx, cy, c);
        }
        continue;
      }
      // left face, plane a = a0
      const lb = X - a0;
      const lz = (lb - a0) / 2 - Y;
      if (lb >= b0 && lb < b1 && lz >= z0 && lz < z1) {
        if (f.left) {
          const c = f.left(lb - b0, z1 - lz, x, y);
          if (c !== null) p.set(cx, cy, c);
        }
        continue;
      }
      // right face, plane b = b1
      const ra = X - b1;
      const rz = (b1 - ra) / 2 - Y;
      if (ra >= a0 && ra < a1 && rz >= z0 && rz < z1) {
        if (f.right) {
          const c = f.right(ra - a0, z1 - rz, x, y);
          if (c !== null) p.set(cx, cy, c);
        }
      }
    }
  }
}

/** Deterministic hash → [0, 1). */
export function hash(i: number, j = 0, s = 0): number {
  let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Ordered 4×4 Bayer threshold (0..15). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** True where a dither of strength f (0..1) puts the second colour. */
export function dith(x: number, y: number, f: number): boolean {
  return BAYER[(y & 3) * 4 + (x & 3)] < Math.round(f * 16);
}

/** Step `c` along `ramp` (clamped). Colours not in the ramp are returned unchanged. */
export function step(ramp: readonly number[], c: number, k: number): number {
  const i = ramp.indexOf(c);
  if (i < 0) return c;
  return ramp[Math.max(0, Math.min(ramp.length - 1, i + k))];
}

/** Mix two colours (t = 0 → a). */
export function mixc(a: number, b: number, t: number): number {
  const r = Math.round(((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t));
  const g = Math.round(((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t));
  const bl = Math.round((a & 255) + (((b & 255) - (a & 255)) * t));
  return (r << 16) | (g << 8) | bl;
}
