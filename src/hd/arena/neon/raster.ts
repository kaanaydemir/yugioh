// HD Neon arena — raster toolkit shared by every layer generator.
//
// Every layer is described procedurally in HD WORLD pixels (the 960×540 trial space) and rasterized at the
// requested environment pixel size P (ArenaBuildOptions.envPixel): art pixel (i, j) covers the world square
// [x0 + i·P, x0 + (i+1)·P) and is sampled at its center. So the same description renders crisp at P = 1 (same
// density as the monsters) and chunky at P = 2 (HD-2D environment pixels, shown with setScale(2), nearest).
// Line widths and dither patterns are expressed in ART pixels, positions in world pixels.
//
// A Raster carries up to three buffers of the same size:
//   col  — RGBA colour (palette colours only; ordered dither between ramp neighbours)
//   nrm  — view-space normal (float xyz, encoded RGB = n·0.5 + 0.5, +Y UP, +Z toward the viewer)
//   glw  — RGBA additive glow overlay (neon lines for the bloom layer; usually white levels, tinted at runtime)

export interface WorldRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---------------------------------------------------------------- math

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smooth = (t: number): number => t * t * (3 - 2 * t);
export function smoothstep(a: number, b: number, x: number): number {
  return smooth(clamp01((x - a) / (b - a)));
}
/** Piecewise-linear lookup over sorted [x, y] keys. */
export function curve(keys: readonly (readonly [number, number])[], x: number): number {
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

// ---------------------------------------------------------------- dithering

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** 4×4 ordered dither threshold 0..15 at an ART pixel. */
export function bayer(x: number, y: number): number {
  return BAYER4[(y & 3) * 4 + (x & 3)];
}
/** Pick colors[i] / colors[i+1] by ordered dither; v is a continuous index into colors. */
export function dpick(colors: readonly number[], v: number, x: number, y: number): number {
  const n = colors.length - 1;
  if (v <= 0) return colors[0];
  if (v >= n) return colors[n];
  const i = Math.floor(v);
  return bayer(x, y) < (v - i) * 16 ? colors[i + 1] : colors[i];
}
/** Flat bands with short dithered transitions (pixel-art gradient). w = transition width 0..1. */
export function bandify(v: number, w: number): number {
  const i = Math.floor(v);
  const f = v - i;
  return i + clamp01((f - (1 - w) / 2) / w);
}
/** Quantize an alpha (0..1) to `levels` steps with ordered dither between steps. */
export function qalpha(a: number, levels: number, x: number, y: number): number {
  if (a <= 0) return 0;
  if (a >= 1) return 1;
  const v = a * levels;
  const lo = Math.floor(v);
  return (lo + (bayer(x, y) < (v - lo) * 16 ? 1 : 0)) / levels;
}

// ---------------------------------------------------------------- noise (world space, deterministic)

/** Integer hash → [0, 1). */
export function hash2(ix: number, iy: number, seed = 0): number {
  let h = (ix | 0) * 374761393 + (iy | 0) * 668265263 + (seed | 0) * 2246822519;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}
export function hash1(i: number, seed = 0): number {
  return hash2(i, 0x51ed27, seed);
}

/** Smooth value noise in [0, 1). */
export function vnoise(x: number, y: number, seed = 0): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smooth(x - x0);
  const ty = smooth(y - y0);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
}

/** Fractal value noise in [0, 1). x, y in noise cells. */
export function fbm(x: number, y: number, octaves = 4, seed = 0, gain = 0.5): number {
  let amp = 1;
  let sum = 0;
  let tot = 0;
  for (let o = 0; o < octaves; o++) {
    sum += vnoise(x, y, seed + o * 101) * amp;
    tot += amp;
    amp *= gain;
    x *= 2.03;
    y *= 2.03;
  }
  return sum / tot;
}

/** Periodic (tileable along x with period `px` cells) value noise. */
export function vnoiseX(x: number, y: number, px: number, seed = 0): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smooth(x - x0);
  const ty = smooth(y - y0);
  const w = (i: number) => ((i % px) + px) % px;
  const a = hash2(w(x0), y0, seed);
  const b = hash2(w(x0 + 1), y0, seed);
  const c = hash2(w(x0), y0 + 1, seed);
  const d = hash2(w(x0 + 1), y0 + 1, seed);
  return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
}
export function fbmX(x: number, y: number, px: number, octaves = 4, seed = 0, gain = 0.5): number {
  let amp = 1;
  let sum = 0;
  let tot = 0;
  for (let o = 0; o < octaves; o++) {
    sum += vnoiseX(x, y, px, seed + o * 101) * amp;
    tot += amp;
    amp *= gain;
    x *= 2;
    y *= 2;
    px *= 2;
  }
  return sum / tot;
}

/** Voronoi: distance to the nearest / second-nearest feature point and the nearest cell's id. */
export function voronoi(x: number, y: number, seed = 0): { d1: number; d2: number; id: number; cx: number; cy: number } {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let d1 = 9;
  let d2 = 9;
  let id = 0;
  let cx = 0;
  let cy = 0;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const gx = xi + i;
      const gy = yi + j;
      const px = gx + hash2(gx, gy, seed);
      const py = gy + hash2(gx, gy, seed + 7);
      const d = Math.hypot(px - x, py - y);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = hash2(gx, gy, seed + 13);
        cx = px;
        cy = py;
      } else if (d < d2) d2 = d;
    }
  return { d1, d2, id, cx, cy };
}

// ---------------------------------------------------------------- normals

/** Encode a (not necessarily unit) normal into 0..255 RGB. */
export function encodeN(nx: number, ny: number, nz: number, out: Uint8ClampedArray, o: number): void {
  const l = Math.hypot(nx, ny, nz) || 1;
  out[o] = Math.round((nx / l) * 127.5 + 127.5);
  out[o + 1] = Math.round((ny / l) * 127.5 + 127.5);
  out[o + 2] = Math.round((nz / l) * 127.5 + 127.5);
  out[o + 3] = 255;
}

/**
 * The floor's view-space normal leans slightly toward screen-up: the platform top is seen from ~30° above, so a
 * light hovering over the board lights (and glints on) the floor just below it on screen — the reflection of an
 * event light lands at the monster's feet. Kept small so the side lights still pool evenly on both halves.
 */
export const FLOOR_TILT = 0.17;
const FT_S = Math.sin(FLOOR_TILT);
const FT_C = Math.cos(FLOOR_TILT);
/** Local floor normal (x right, y screen-up / toward the back, z up out of the floor) → view space. */
export function floorToView(nx: number, ny: number, nz: number): [number, number, number] {
  return [nx, ny * FT_C + nz * FT_S, -ny * FT_S + nz * FT_C];
}

/** Outward normals of the two visible vertical slab faces in view space (2:1 iso, camera ~30° above). */
export const FACE_N_LL: [number, number, number] = [-0.69, -0.33, 0.64];
export const FACE_N_LR: [number, number, number] = [0.69, -0.33, 0.64];

// ---------------------------------------------------------------- raster

export interface RasterOpts {
  normal?: boolean;
  glow?: boolean;
}

export class Raster {
  readonly w: number;
  readonly h: number;
  readonly x0: number;
  readonly y0: number;
  readonly col: Uint8ClampedArray;
  readonly nrm: Float32Array | null;
  readonly glw: Uint8ClampedArray | null;

  constructor(
    readonly rect: WorldRect,
    readonly P: number,
    opts: RasterOpts = {},
  ) {
    this.w = Math.ceil(rect.w / P);
    this.h = Math.ceil(rect.h / P);
    this.x0 = rect.x;
    this.y0 = rect.y;
    this.col = new Uint8ClampedArray(this.w * this.h * 4);
    this.nrm = opts.normal ? new Float32Array(this.w * this.h * 3) : null;
    if (this.nrm) for (let i = 0; i < this.w * this.h; i++) this.nrm[i * 3 + 2] = 1;
    this.glw = opts.glow ? new Uint8ClampedArray(this.w * this.h * 4) : null;
  }

  /** World x of the center of art column i. */
  wx(i: number): number {
    return this.x0 + (i + 0.5) * this.P;
  }
  wy(j: number): number {
    return this.y0 + (j + 0.5) * this.P;
  }
  /** Art pixel index of a world coordinate. */
  ix(wx: number): number {
    return Math.floor((wx - this.x0) / this.P);
  }
  iy(wy: number): number {
    return Math.floor((wy - this.y0) / this.P);
  }
  inside(i: number, j: number): boolean {
    return i >= 0 && j >= 0 && i < this.w && j < this.h;
  }

  /** Colour write; a < 255 blends source-over. */
  put(i: number, j: number, c: number, a = 255): void {
    if (i < 0 || j < 0 || i >= this.w || j >= this.h || a <= 0) return;
    const o = (j * this.w + i) * 4;
    const d = this.col;
    const r = (c >> 16) & 255;
    const g = (c >> 8) & 255;
    const b = c & 255;
    if (a >= 255 || d[o + 3] === 0) {
      d[o] = r;
      d[o + 1] = g;
      d[o + 2] = b;
      d[o + 3] = Math.max(d[o + 3], Math.min(255, a));
      if (a >= 255) d[o + 3] = 255;
      return;
    }
    const sa = a / 255;
    const da = d[o + 3] / 255;
    const oa = sa + da * (1 - sa);
    d[o] = (r * sa + d[o] * da * (1 - sa)) / oa;
    d[o + 1] = (g * sa + d[o + 1] * da * (1 - sa)) / oa;
    d[o + 2] = (b * sa + d[o + 2] * da * (1 - sa)) / oa;
    d[o + 3] = oa * 255;
  }
  /** Colour at (i, j) as 0xRRGGBB, or -1 if transparent. */
  get(i: number, j: number): number {
    if (!this.inside(i, j)) return -1;
    const o = (j * this.w + i) * 4;
    if (this.col[o + 3] === 0) return -1;
    return (this.col[o] << 16) | (this.col[o + 1] << 8) | this.col[o + 2];
  }
  alpha(i: number, j: number): number {
    return this.inside(i, j) ? this.col[(j * this.w + i) * 4 + 3] : 0;
  }
  clearPx(i: number, j: number): void {
    if (!this.inside(i, j)) return;
    this.col.fill(0, (j * this.w + i) * 4, (j * this.w + i) * 4 + 4);
  }

  setN(i: number, j: number, n: readonly [number, number, number]): void {
    if (!this.nrm || !this.inside(i, j)) return;
    const o = (j * this.w + i) * 3;
    this.nrm[o] = n[0];
    this.nrm[o + 1] = n[1];
    this.nrm[o + 2] = n[2];
  }
  getN(i: number, j: number): [number, number, number] {
    if (!this.nrm || !this.inside(i, j)) return [0, 0, 1];
    const o = (j * this.w + i) * 3;
    return [this.nrm[o], this.nrm[o + 1], this.nrm[o + 2]];
  }

  /** Glow write: keeps the brighter of the existing / new value (levels never darken each other). */
  glow(i: number, j: number, c: number, a = 255): void {
    if (!this.glw || !this.inside(i, j) || a <= 0) return;
    const o = (j * this.w + i) * 4;
    const d = this.glw;
    const lum = ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);
    const cur = d[o] + d[o + 1] + d[o + 2];
    if (d[o + 3] > 0 && cur * d[o + 3] >= lum * a) return;
    d[o] = (c >> 16) & 255;
    d[o + 1] = (c >> 8) & 255;
    d[o + 2] = c & 255;
    d[o + 3] = Math.min(255, a);
  }

  /** Call fn for every art pixel with its world center. */
  each(fn: (i: number, j: number, x: number, y: number) => void, box?: WorldRect): void {
    let i0 = 0;
    let j0 = 0;
    let i1 = this.w - 1;
    let j1 = this.h - 1;
    if (box) {
      i0 = Math.max(0, this.ix(box.x));
      j0 = Math.max(0, this.iy(box.y));
      i1 = Math.min(this.w - 1, this.ix(box.x + box.w));
      j1 = Math.min(this.h - 1, this.iy(box.y + box.h));
    }
    for (let j = j0; j <= j1; j++) {
      const y = this.y0 + (j + 0.5) * this.P;
      for (let i = i0; i <= i1; i++) fn(i, j, this.x0 + (i + 0.5) * this.P, y);
    }
  }

  /** Bresenham line in WORLD coordinates (1 art px wide), fn(i, j, t). */
  line(ax: number, ay: number, bx: number, by: number, fn: (i: number, j: number, t: number) => void): void {
    let x0 = this.ix(ax);
    let y0 = this.iy(ay);
    const x1 = this.ix(bx);
    const y1 = this.iy(by);
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

  /** Filled polygon (world coordinates), fn(i, j) per covered art pixel (sampled at centers). */
  poly(pts: readonly (readonly [number, number])[], fn: (i: number, j: number, x: number, y: number) => void): void {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of pts) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    for (let j = Math.max(0, this.iy(minY) - 1); j <= Math.min(this.h - 1, this.iy(maxY) + 1); j++) {
      const sy = this.wy(j);
      const xs: number[] = [];
      for (let k = 0; k < pts.length; k++) {
        const [xa, ya] = pts[k];
        const [xb, yb] = pts[(k + 1) % pts.length];
        if ((ya <= sy && yb > sy) || (yb <= sy && ya > sy)) xs.push(xa + ((sy - ya) / (yb - ya)) * (xb - xa));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const ia = Math.max(0, Math.ceil((xs[k] - this.x0) / this.P - 0.5));
        const ib = Math.min(this.w - 1, Math.floor((xs[k + 1] - this.x0) / this.P - 0.5));
        for (let i = ia; i <= ib; i++) fn(i, j, this.wx(i), sy);
      }
    }
  }

  // ---------------------------------------------------------------- output

  colorCanvas(): HTMLCanvasElement {
    return toCanvas(this.col, this.w, this.h);
  }
  normalCanvas(): HTMLCanvasElement {
    const out = new Uint8ClampedArray(this.w * this.h * 4);
    for (let i = 0; i < this.w * this.h; i++) {
      if (this.nrm) encodeN(this.nrm[i * 3], this.nrm[i * 3 + 1], this.nrm[i * 3 + 2], out, i * 4);
      else encodeN(0, 0, 1, out, i * 4);
    }
    return toCanvas(out, this.w, this.h);
  }
  glowCanvas(): HTMLCanvasElement {
    return toCanvas(this.glw ?? new Uint8ClampedArray(this.w * this.h * 4), this.w, this.h);
  }
}

export function toCanvas(data: Uint8ClampedArray, w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.putImageData(new ImageData(data as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0);
  return cv;
}

/** Crop a raster's colour (or glow) buffer to its opaque bounds: { canvas, x, y } in world px (top-left). */
export function cropped(r: Raster, which: 'col' | 'glw' = 'col'): { cv: HTMLCanvasElement; x: number; y: number; w: number; h: number } | null {
  const d = which === 'col' ? r.col : r.glw;
  if (!d) return null;
  let x0 = r.w;
  let y0 = r.h;
  let x1 = -1;
  let y1 = -1;
  for (let j = 0; j < r.h; j++) {
    const row = j * r.w * 4;
    for (let i = 0; i < r.w; i++) {
      if (d[row + i * 4 + 3] === 0) continue;
      if (i < x0) x0 = i;
      if (i > x1) x1 = i;
      if (j < y0) y0 = j;
      y1 = j;
    }
  }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let j = 0; j < h; j++) out.set(d.subarray(((y0 + j) * r.w + x0) * 4, ((y0 + j) * r.w + x0 + w) * 4), j * w * 4);
  return { cv: toCanvas(out, w, h), x: r.x0 + x0 * r.P, y: r.y0 + y0 * r.P, w, h };
}
