// PixelCanvas — a tiny raster toolkit for authoring pixel art in code.
//
// All coordinates are integer pixels (floats are floored). Colors are 0xRRGGBB numbers
// (use the PAL palette). Every shape is rasterized "pixel-art style": no anti-aliasing,
// sampled at pixel centers, so results are crisp at any integer zoom.
//
// Works in the browser and in Node (toCanvas() needs a DOM).

import { RAMPS } from './palette';

export type Color = number;
export type Pt = readonly [number, number];

export class PixelCanvas {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8ClampedArray;

  constructor(w: number, h: number) {
    this.w = Math.max(1, Math.floor(w));
    this.h = Math.max(1, Math.floor(h));
    this.data = new Uint8ClampedArray(this.w * this.h * 4);
  }

  // ---------------------------------------------------------------- basics

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  clear(): this {
    this.data.fill(0);
    return this;
  }

  /** Color at (x, y) or null if fully transparent / out of bounds. */
  get(x: number, y: number): Color | null {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inBounds(x, y)) return null;
    const i = (y * this.w + x) * 4;
    if (this.data[i + 3] === 0) return null;
    return (this.data[i] << 16) | (this.data[i + 1] << 8) | this.data[i + 2];
  }

  alpha(x: number, y: number): number {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inBounds(x, y)) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }

  isOpaque(x: number, y: number): boolean {
    return this.alpha(x, y) > 0;
  }

  /** Set a pixel. alpha < 255 blends over what is there (source-over). */
  set(x: number, y: number, c: Color, a = 255): this {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inBounds(x, y) || a <= 0) return this;
    const i = (y * this.w + x) * 4;
    const r = (c >> 16) & 255;
    const g = (c >> 8) & 255;
    const b = c & 255;
    if (a >= 255) {
      this.data[i] = r;
      this.data[i + 1] = g;
      this.data[i + 2] = b;
      this.data[i + 3] = 255;
      return this;
    }
    const sa = a / 255;
    const da = this.data[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    if (oa <= 0) return this;
    this.data[i] = (r * sa + this.data[i] * da * (1 - sa)) / oa;
    this.data[i + 1] = (g * sa + this.data[i + 1] * da * (1 - sa)) / oa;
    this.data[i + 2] = (b * sa + this.data[i + 2] * da * (1 - sa)) / oa;
    this.data[i + 3] = oa * 255;
    return this;
  }

  erase(x: number, y: number): this {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inBounds(x, y)) return this;
    this.data.fill(0, (y * this.w + x) * 4, (y * this.w + x) * 4 + 4);
    return this;
  }

  /** Set only if the pixel is already opaque (paint "inside" a silhouette). */
  paint(x: number, y: number, c: Color, a = 255): this {
    if (this.isOpaque(x, y)) this.set(x, y, c, a);
    return this;
  }

  // ---------------------------------------------------------------- shapes

  rect(x: number, y: number, w: number, h: number, c: Color, a = 255): this {
    x = Math.floor(x);
    y = Math.floor(y);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c, a);
    return this;
  }

  /** 1px rectangle outline. */
  frame(x: number, y: number, w: number, h: number, c: Color, a = 255): this {
    this.hline(x, x + w - 1, y, c, a);
    this.hline(x, x + w - 1, y + h - 1, c, a);
    this.vline(x, y + 1, y + h - 2, c, a);
    this.vline(x + w - 1, y + 1, y + h - 2, c, a);
    return this;
  }

  hline(x0: number, x1: number, y: number, c: Color, a = 255): this {
    if (x1 < x0) [x0, x1] = [x1, x0];
    for (let x = Math.floor(x0); x <= Math.floor(x1); x++) this.set(x, y, c, a);
    return this;
  }

  vline(x: number, y0: number, y1: number, c: Color, a = 255): this {
    if (y1 < y0) [y0, y1] = [y1, y0];
    for (let y = Math.floor(y0); y <= Math.floor(y1); y++) this.set(x, y, c, a);
    return this;
  }

  /** Bresenham line (1px). */
  line(x0: number, y0: number, x1: number, y1: number, c: Color, a = 255): this {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c, a);
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
    }
    return this;
  }

  /** Thick line made of stamped discs. */
  thickLine(x0: number, y0: number, x1: number, y1: number, width: number, c: Color, a = 255): this {
    if (width <= 1) return this.line(x0, y0, x1, y1, c, a);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(len * 2));
    const r = width / 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, c, a);
    }
    return this;
  }

  /**
   * Filled disc. Center may be fractional; radius in pixels. Sampled at pixel centers.
   * Note: discs with alpha < 255 should not overlap themselves — use `a` only on single shapes.
   */
  disc(cx: number, cy: number, r: number, c: Color, a = 255): this {
    if (r <= 0.5) return this.set(Math.floor(cx), Math.floor(cy), c, a);
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) this.set(x, y, c, a);
      }
    }
    return this;
  }

  /** 1px circle outline. */
  ring(cx: number, cy: number, r: number, c: Color, a = 255): this {
    return this.ellipseRing(cx, cy, r, r, c, a);
  }

  /** Filled ellipse, sampled at pixel centers. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: Color, a = 255): this {
    if (rx <= 0 || ry <= 0) return this;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c, a);
      }
    }
    return this;
  }

  /** 1px ellipse outline (pixels inside the ellipse that touch the outside). */
  ellipseRing(cx: number, cy: number, rx: number, ry: number, c: Color, a = 255): this {
    const inside = (x: number, y: number) => {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      return dx * dx + dy * dy <= 1;
    };
    for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry) + 1; y++) {
      for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx) + 1; x++) {
        if (!inside(x, y)) continue;
        if (!inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1)) this.set(x, y, c, a);
      }
    }
    return this;
  }

  /** Filled polygon (even-odd), sampled at pixel centers. */
  poly(points: readonly Pt[], c: Color, a = 255): this {
    if (points.length < 3) return this;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of points) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const sy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i];
        const [x1, y1] = points[(i + 1) % points.length];
        if ((y0 <= sy && y1 > sy) || (y1 <= sy && y0 > sy)) {
          xs.push(x0 + ((sy - y0) / (y1 - y0)) * (x1 - x0));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.ceil(xs[k] - 0.5);
        const xb = Math.floor(xs[k + 1] - 0.5);
        for (let x = xa; x <= xb; x++) this.set(x, y, c, a);
      }
    }
    return this;
  }

  tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: Color, a = 255): this {
    return this.poly(
      [
        [x0, y0],
        [x1, y1],
        [x2, y2],
      ],
      c,
      a,
    );
  }

  /** Polyline outline (1px). */
  polyline(points: readonly Pt[], c: Color, closed = false, a = 255): this {
    for (let i = 0; i + 1 < points.length; i++) this.line(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], c, a);
    if (closed && points.length > 2) {
      const l = points[points.length - 1];
      this.line(l[0], l[1], points[0][0], points[0][1], c, a);
    }
    return this;
  }

  /**
   * Tapered stroke along a path (great for tails, necks, tentacles, horns, vines).
   * Width interpolates from w0 at the start to w1 at the end.
   */
  stroke(path: readonly Pt[], w0: number, w1: number, c: Color, a = 255): this {
    if (path.length === 0) return this;
    if (path.length === 1) return this.disc(path[0][0], path[0][1], w0 / 2, c, a);
    const lens: number[] = [0];
    for (let i = 1; i < path.length; i++) lens.push(lens[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    const total = lens[lens.length - 1] || 1;
    for (let i = 1; i < path.length; i++) {
      const [ax, ay] = path[i - 1];
      const [bx, by] = path[i];
      const seg = lens[i] - lens[i - 1];
      const steps = Math.max(1, Math.ceil(seg * 2));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const d = lens[i - 1] + seg * t;
        const w = w0 + (w1 - w0) * (d / total);
        const x = ax + (bx - ax) * t;
        const y = ay + (by - ay) * t;
        if (w <= 1.2) this.set(Math.floor(x), Math.floor(y), c, a);
        else this.disc(x, y, w / 2, c, a);
      }
    }
    return this;
  }

  /**
   * Ordered (Bayer 4x4) dither fill: `level` 0..16 = fraction of pixels painted with `c`.
   * If `mask` is true, only paints pixels that are already opaque.
   */
  dither(x: number, y: number, w: number, h: number, c: Color, level: number, mask = false): this {
    for (let yy = Math.floor(y); yy < y + h; yy++) {
      for (let xx = Math.floor(x); xx < x + w; xx++) {
        if (BAYER4[(yy & 3) * 4 + (xx & 3)] < level) {
          if (mask) this.paint(xx, yy, c);
          else this.set(xx, yy, c);
        }
      }
    }
    return this;
  }

  /** True if (x, y) passes the Bayer threshold for `level` (0..16). Handy for custom dithered gradients. */
  static ditherAt(x: number, y: number, level: number): boolean {
    return BAYER4[(y & 3) * 4 + (x & 3)] < level;
  }

  /**
   * Draw an ASCII pattern. Each row is a string; each char maps through `key` to a color.
   * '.' and ' ' are transparent unless mapped. Great for eyes, runes, icons, small details.
   */
  stamp(rows: readonly string[], key: Record<string, Color>, x: number, y: number, opts: { flipX?: boolean } = {}): this {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        const col = key[ch];
        if (col === undefined) continue;
        const px = opts.flipX ? x + row.length - 1 - i : x + i;
        this.set(px, y + j, col);
      }
    }
    return this;
  }

  // ---------------------------------------------------------------- passes

  /**
   * Add a 1px outline in transparent pixels touching opaque ones.
   * corners=false (default) uses 4-neighbors (the classic pixel-art outline).
   */
  outline(c: Color, opts: { corners?: boolean } = {}): this {
    const add: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.isOpaque(x, y)) continue;
        let hit = this.isOpaque(x - 1, y) || this.isOpaque(x + 1, y) || this.isOpaque(x, y - 1) || this.isOpaque(x, y + 1);
        if (!hit && opts.corners)
          hit = this.isOpaque(x - 1, y - 1) || this.isOpaque(x + 1, y - 1) || this.isOpaque(x - 1, y + 1) || this.isOpaque(x + 1, y + 1);
        if (hit) add.push(x, y);
      }
    }
    for (let i = 0; i < add.length; i += 2) this.set(add[i], add[i + 1], c);
    return this;
  }

  /**
   * Automatic form shading on a silhouette. For each opaque pixel, if the pixel toward the
   * light (dx, dy) is transparent it is lightened; if the pixel away from the light is
   * transparent it is darkened. Shifts are along palette ramps (see shade()).
   * depth = how many pixels deep the dark side reaches.
   */
  bevel(opts: { light?: Pt; lift?: number; drop?: number; depth?: number; skip?: (c: Color) => boolean } = {}): this {
    const [lx, ly] = opts.light ?? [-1, -1];
    const lift = opts.lift ?? 1;
    const drop = opts.drop ?? 1;
    const depth = opts.depth ?? 1;
    const src = this.clone();
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = src.get(x, y);
        if (c === null) continue;
        if (opts.skip && opts.skip(c)) continue;
        if (!src.isOpaque(x + lx, y + ly)) {
          this.set(x, y, shade(c, lift));
          continue;
        }
        for (let d = 1; d <= depth; d++) {
          if (!src.isOpaque(x - lx * d, y - ly * d)) {
            this.set(x, y, shade(c, -drop));
            break;
          }
        }
      }
    }
    return this;
  }

  /** Replace every pixel of color `from` with `to`. */
  replace(from: Color, to: Color): this {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.get(x, y) === from) this.set(x, y, to);
    return this;
  }

  /** Map every opaque pixel's color through fn (return null to erase). */
  map(fn: (c: Color, x: number, y: number) => Color | null): this {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.get(x, y);
        if (c === null) continue;
        const n = fn(c, x, y);
        if (n === null) this.erase(x, y);
        else if (n !== c) this.set(x, y, n);
      }
    }
    return this;
  }

  // ---------------------------------------------------------------- composition

  /** Draw `src` onto this canvas at (dx, dy). Transparent source pixels are skipped. */
  blit(src: PixelCanvas, dx: number, dy: number, opts: { flipX?: boolean; flipY?: boolean; alpha?: number } = {}): this {
    dx = Math.floor(dx);
    dy = Math.floor(dy);
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const sx = opts.flipX ? src.w - 1 - x : x;
        const sy = opts.flipY ? src.h - 1 - y : y;
        const a = src.alpha(sx, sy);
        if (a === 0) continue;
        const c = src.get(sx, sy)!;
        this.set(dx + x, dy + y, c, Math.round(a * (opts.alpha ?? 1)));
      }
    }
    return this;
  }

  clone(): PixelCanvas {
    const p = new PixelCanvas(this.w, this.h);
    p.data.set(this.data);
    return p;
  }

  flippedX(): PixelCanvas {
    const p = new PixelCanvas(this.w, this.h);
    p.blit(this, 0, 0, { flipX: true });
    return p;
  }

  crop(x: number, y: number, w: number, h: number): PixelCanvas {
    const p = new PixelCanvas(w, h);
    for (let yy = 0; yy < h; yy++)
      for (let xx = 0; xx < w; xx++) {
        const a = this.alpha(x + xx, y + yy);
        if (a) p.set(xx, yy, this.get(x + xx, y + yy)!, a);
      }
    return p;
  }

  /** Nearest-neighbor integer upscale. */
  scaled(k: number): PixelCanvas {
    k = Math.max(1, Math.floor(k));
    const p = new PixelCanvas(this.w * k, this.h * k);
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < p.w; x++) {
        const a = this.alpha(Math.floor(x / k), Math.floor(y / k));
        if (a) p.set(x, y, this.get(Math.floor(x / k), Math.floor(y / k))!, a);
      }
    return p;
  }

  /** Bounding box of opaque pixels (null if empty). */
  bounds(): { x: number; y: number; w: number; h: number } | null {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (this.isOpaque(x, y)) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  /** Count of opaque pixels. */
  coverage(): number {
    let n = 0;
    for (let i = 3; i < this.data.length; i += 4) if (this.data[i] > 0) n++;
    return n;
  }

  toImageData(): ImageData {
    return new ImageData(new Uint8ClampedArray(this.data), this.w, this.h);
  }

  /** Browser only. */
  toCanvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.w;
    cv.height = this.h;
    cv.getContext('2d')!.putImageData(this.toImageData(), 0, 0);
    return cv;
  }
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// ---------------------------------------------------------------- color helpers

export function rgb(c: Color): [number, number, number] {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

export function mix(a: Color, b: Color, t: number): Color {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

const ALL_RAMPS: readonly (readonly number[])[] = Object.values(RAMPS);

/**
 * Move a palette color `steps` along its ramp (+ lighter, - darker). Colors not found in
 * any ramp are mixed toward white/black instead. Clamps at the ramp ends (the darkest
 * step below 0 becomes PAL.ink-ish via mixing).
 */
export function shade(c: Color, steps: number): Color {
  if (steps === 0) return c;
  for (const ramp of ALL_RAMPS) {
    const i = ramp.indexOf(c);
    if (i >= 0) {
      const j = i + steps;
      if (j >= 0 && j < ramp.length) return ramp[j];
      if (j < 0) return mix(ramp[0], 0x07070f, Math.min(1, -j * 0.5));
      return mix(ramp[ramp.length - 1], 0xffffff, Math.min(1, (j - ramp.length + 1) * 0.35));
    }
  }
  return steps > 0 ? mix(c, 0xffffff, Math.min(1, steps * 0.25)) : mix(c, 0x07070f, Math.min(1, -steps * 0.3));
}

// ---------------------------------------------------------------- geometry helpers

/** Points along a quadratic or cubic Bézier (n samples). */
export function bezier(p0: Pt, p1: Pt, p2: Pt, p3?: Pt, n = 16): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    if (p3) {
      out.push([
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
      ]);
    } else {
      out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
    }
  }
  return out;
}

/** Rotate point (x, y) around (cx, cy) by `rad`. */
export function rot(x: number, y: number, cx: number, cy: number, rad: number): Pt {
  const s = Math.sin(rad);
  const c = Math.cos(rad);
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}

/** Ease helpers for parametric poses (t in 0..1). */
export const ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  /** Smooth loop: 0 → 1 → 0 over t in 0..1. */
  pingpong: (t: number) => 0.5 - 0.5 * Math.cos(t * Math.PI * 2),
  /** Sine wave over t in 0..1, range -1..1. */
  wave: (t: number, phase = 0) => Math.sin((t + phase) * Math.PI * 2),
};

/** Deterministic RNG for art (speckles, cracks). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
