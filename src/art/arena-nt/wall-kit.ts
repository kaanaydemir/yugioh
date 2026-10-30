// Neon Tower — shared helpers of the wall / stands painters (owner A2). Pure PixelCanvas code, no Phaser.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';

/** Short tone names. Everything here is a PAL colour; the wall and the stands stay at or below cyan2 / crim1 / void2. */
export const T = {
  ink: PAL.ink,
  n0: PAL.night0,
  n1: PAL.night1,
  n2: PAL.night2,
  n3: PAL.night3,
  n4: PAL.night4,
  steel: PAL.steel,
  mist: PAL.mist,
  white: PAL.white,
  v0: PAL.void0,
  v1: PAL.void1,
  v2: PAL.void2,
  v3: PAL.void3,
  c0: PAL.cyan0,
  c1: PAL.cyan1,
  c2: PAL.cyan2,
  c3: PAL.cyan3,
  c4: PAL.cyan4,
  r0: PAL.crim0,
  r1: PAL.crim1,
  r2: PAL.crim2,
  r3: PAL.crim3,
  g1: PAL.gold1,
  g2: PAL.gold2,
} as const;

export interface AtlasRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface NtAtlas {
  canvas: PixelCanvas;
  frames: Record<string, AtlasRect>;
}

/** Shelf-pack named canvases into one sheet (tallest first, 1 px gutters, deterministic). */
export function packAtlas(parts: readonly [string, PixelCanvas][], width = 256): NtAtlas {
  const order = parts.map((p, i) => ({ p, i })).sort((a, b) => b.p[1].h - a.p[1].h || a.i - b.i);
  const frames: Record<string, AtlasRect> = {};
  let x = 0;
  let y = 0;
  let rowH = 0;
  const place: { name: string; pc: PixelCanvas; x: number; y: number }[] = [];
  for (const { p } of order) {
    const [name, pc] = p;
    if (x + pc.w > width) {
      x = 0;
      y += rowH + 1;
      rowH = 0;
    }
    place.push({ name, pc, x, y });
    frames[name] = { x, y, w: pc.w, h: pc.h };
    x += pc.w + 1;
    rowH = Math.max(rowH, pc.h);
  }
  const canvas = new PixelCanvas(width, y + rowH);
  for (const q of place) canvas.blit(q.pc, q.x, q.y);
  return { canvas, frames };
}

/** A 2×2 / 1×1 ordered-dither style helper: true on the pixels of a checker. */
export function checker(x: number, y: number, phase = 0): boolean {
  return ((x + y + phase) & 1) === 0;
}

/** Deterministic hash → 0…1 (no Math.random in art paths). */
export function hash01(a: number, b = 0, c = 0): number {
  let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
