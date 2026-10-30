// Neon Tower — tiny helpers shared by the A1 painters (platform, floor, pads): a shelf atlas packer and a
// fast typed-array pixel writer. Pure PixelCanvas code (no Phaser): runs in Node for tests.

import { type Color, PixelCanvas } from '../pixel';

export interface AtlasRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Atlas {
  canvas: PixelCanvas;
  frames: Map<string, AtlasRect>;
}

/** Shelf-pack named canvases into one atlas (1-px gutters; NEAREST sampling never bleeds). Order-independent output. */
export function packAtlas(list: readonly (readonly [string, PixelCanvas])[], W = 256): Atlas {
  const sorted = [...list].sort((a, b) => b[1].h - a[1].h || (a[0] < b[0] ? -1 : 1));
  const frames = new Map<string, AtlasRect>();
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const [name, p] of sorted) {
    if (x + p.w > W) {
      x = 0;
      y += rowH + 1;
      rowH = 0;
    }
    frames.set(name, { x, y, w: p.w, h: p.h });
    x += p.w + 1;
    rowH = Math.max(rowH, p.h);
  }
  const canvas = new PixelCanvas(W, Math.max(1, y + rowH));
  for (const [name, p] of list) {
    const r = frames.get(name)!;
    for (let j = 0; j < p.h; j++) canvas.data.set(p.data.subarray(j * p.w * 4, (j + 1) * p.w * 4), ((r.y + j) * W + r.x) * 4);
  }
  return { canvas, frames };
}

const LE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

/** Opaque RGBA word of a colour in the canvas' byte order (little-endian: 0xAABBGGRR). */
export function word(c: Color): number {
  return LE ? (0xff000000 | ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff)) >>> 0 : (((c << 8) | 0xff) >>> 0);
}

/** A canvas with an offset origin and a fast opaque pixel writer (screen coords in, canvas coords out). */
export class Surface {
  readonly canvas: PixelCanvas;
  private readonly d32: Uint32Array;

  constructor(
    readonly ox: number,
    readonly oy: number,
    readonly w: number,
    readonly h: number,
  ) {
    this.canvas = new PixelCanvas(w, h);
    this.d32 = new Uint32Array(this.canvas.data.buffer);
  }

  /** Write an opaque pixel at screen coords (x, y). */
  put(x: number, y: number, c: Color): void {
    const i = x - this.ox;
    const j = y - this.oy;
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return;
    if (c !== this.lastC) {
      this.lastC = c;
      this.lastW = word(c);
    }
    this.d32[j * this.w + i] = this.lastW;
  }
  private lastC = -1;
  private lastW = 0;

  /** True when the pixel at screen coords (x, y) is opaque. */
  has(x: number, y: number): boolean {
    const i = x - this.ox;
    const j = y - this.oy;
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return false;
    return this.d32[j * this.w + i] !== 0;
  }

  /** Colour at screen coords (null when transparent / outside). */
  at(x: number, y: number): Color | null {
    return this.canvas.get(x - this.ox, y - this.oy);
  }

  erase(x: number, y: number): void {
    const i = x - this.ox;
    const j = y - this.oy;
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return;
    this.d32[j * this.w + i] = 0;
  }
}
