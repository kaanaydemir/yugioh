// Small raster helpers shared by the arena v2 generators (pure functions, no Phaser).

import { type Color, PixelCanvas, mulberry32 } from '../pixel';

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** 4×4 ordered-dither threshold 0..15. */
export function bayer(x: number, y: number): number {
  return BAYER4[(y & 3) * 4 + (x & 3)];
}

/** Pick between colors[i] and colors[i+1] by ordered dither; v is a continuous index into colors. */
export function dpick(colors: readonly Color[], v: number, x: number, y: number): Color {
  const n = colors.length - 1;
  if (v <= 0) return colors[0];
  if (v >= n) return colors[n];
  const i = Math.floor(v);
  return bayer(x, y) < (v - i) * 16 ? colors[i + 1] : colors[i];
}

/** Flat bands with short dithered transitions (classic pixel-art gradient). w = transition width 0..1. */
export function bandify(v: number, w: number): number {
  const i = Math.floor(v);
  const f = v - i;
  return i + clamp01((f - (1 - w) / 2) / w);
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Piecewise-linear lookup over sorted [x, y] keys. */
export function curve(keys: readonly [number, number][], x: number): number {
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (x <= keys[i][0]) {
      const [x0, y0] = keys[i - 1];
      const [x1, y1] = keys[i];
      return lerp(y0, y1, (x - x0) / (x1 - x0));
    }
  }
  return keys[keys.length - 1][1];
}

/** Tileable value noise in [0,1] (periodic over w×h). */
export function periodicNoise(w: number, h: number, cellsX: number, cellsY: number, seed: number, octaves = 3): Float32Array {
  const out = new Float32Array(w * h);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const cx = cellsX << o;
    const cy = cellsY << o;
    const rnd = mulberry32(seed * 7919 + o * 104729);
    const grid = new Float32Array(cx * cy);
    for (let i = 0; i < grid.length; i++) grid[i] = rnd();
    const g = (i: number, j: number) => grid[(((j % cy) + cy) % cy) * cx + (((i % cx) + cx) % cx)];
    for (let y = 0; y < h; y++) {
      const fy = (y / h) * cy;
      const y0 = Math.floor(fy);
      const ty = smooth(fy - y0);
      for (let x = 0; x < w; x++) {
        const fx = (x / w) * cx;
        const x0 = Math.floor(fx);
        const tx = smooth(fx - x0);
        const v = lerp(lerp(g(x0, y0), g(x0 + 1, y0), tx), lerp(g(x0, y0 + 1), g(x0 + 1, y0 + 1), tx), ty);
        out[y * w + x] += v * amp;
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/** Smooth noise for big canvases: computed `k`× coarser and bilinearly upsampled. */
export function coarseNoise(w: number, h: number, cellsX: number, cellsY: number, seed: number, octaves: number, k = 4): Float32Array {
  const cw = Math.ceil(w / k) + 1;
  const ch = Math.ceil(h / k) + 1;
  const small = periodicNoise(cw, ch, cellsX, cellsY, seed, octaves);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = y / k;
    const y0 = Math.min(ch - 2, Math.floor(fy));
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = x / k;
      const x0 = Math.min(cw - 2, Math.floor(fx));
      const tx = fx - x0;
      const a = small[y0 * cw + x0];
      const b = small[y0 * cw + x0 + 1];
      const c = small[(y0 + 1) * cw + x0];
      const d = small[(y0 + 1) * cw + x0 + 1];
      out[y * w + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    }
  }
  return out;
}

/** Write an opaque pixel straight into the buffer (bounds-checked). */
export function put(p: PixelCanvas, x: number, y: number, c: Color): void {
  if (x < 0 || y < 0 || x >= p.w || y >= p.h) return;
  const i = (y * p.w + x) * 4;
  p.data[i] = (c >> 16) & 255;
  p.data[i + 1] = (c >> 8) & 255;
  p.data[i + 2] = c & 255;
  p.data[i + 3] = 255;
}

/** Iterate the pixels of a Bresenham line, calling fn(x, y, t) with t in 0..1 along the line. */
export function linePx(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number, t: number) => void): void {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  const n = Math.max(dx, -dy) || 1;
  let err = dx + dy;
  let k = 0;
  for (;;) {
    fn(x0, y0, k / n);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
    k++;
  }
}

/** Opaque bounds of a canvas ({0,0,1,1} when empty). */
export function fastBounds(p: PixelCanvas): { x: number; y: number; w: number; h: number } {
  const d = p.data;
  let x0 = p.w;
  let y0 = p.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < p.h; y++) {
    const row = y * p.w * 4;
    for (let x = 0; x < p.w; x++) {
      if (d[row + x * 4 + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      y1 = y;
    }
  }
  return x1 < 0 ? { x: 0, y: 0, w: 1, h: 1 } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function fastCrop(p: PixelCanvas, x: number, y: number, w: number, h: number): PixelCanvas {
  const out = new PixelCanvas(w, h);
  for (let j = 0; j < h; j++) {
    const src = ((y + j) * p.w + x) * 4;
    out.data.set(p.data.subarray(src, src + w * 4), j * w * 4);
  }
  return out;
}

/** Union bounds of several same-sized canvases (for multi-frame layers cropped to one rect). */
export function unionBounds(ps: readonly PixelCanvas[]): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of ps) {
    const b = fastBounds(p);
    if (b.w === 1 && b.h === 1 && p.alpha(b.x, b.y) === 0) continue;
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
  }
  return x1 < x0 ? { x: 0, y: 0, w: 1, h: 1 } : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Recolor every opaque pixel through a palette map (unmapped colors stay). */
export function remap(src: PixelCanvas, map: ReadonlyMap<Color, Color>): PixelCanvas {
  const out = src.clone();
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const c = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    const m = map.get(c);
    if (m !== undefined) {
      d[i] = (m >> 16) & 255;
      d[i + 1] = (m >> 8) & 255;
      d[i + 2] = m & 255;
    }
  }
  return out;
}

/** Soft radial glow (white with quantized alpha) — for additive light. */
export function radialGlow(w: number, h: number, falloff: number, levels = 8, peak = 1): PixelCanvas {
  const p = new PixelCanvas(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const r = Math.hypot((x + 0.5 - w / 2) / (w / 2), (y + 0.5 - h / 2) / (h / 2));
      if (r >= 1) continue;
      const v = Math.pow(1 - r, falloff) * levels * peak;
      const lo = Math.floor(v);
      const a = (lo + (bayer(x, y) < (v - lo) * 16 ? 1 : 0)) / levels;
      if (a > 0) p.set(x, y, 0xffffff, Math.round(Math.min(1, a) * 255));
    }
  return p;
}
