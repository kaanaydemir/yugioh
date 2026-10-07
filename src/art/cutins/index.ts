// Ace cut-in portrait registry + the small rendering kit the portraits are painted with.
//
// Each portrait lives in `./<monster_id>.ts`. Its default export is either a CutinArt or a
// factory `(kit: CutinKit) => CutinArt`. The factory form lets the art files use the kit below
// without importing this module at runtime (index.ts eagerly imports them, so a value import
// back into index.ts would be a circular dependency); they only `import type` from here.
//
//   cutinArt(id)      → the portrait (or a placeholder built from the monster sprite)
//   hasCutin(id)      → true when a hand-made portrait exists
//   cutinSequence(a)  → the frame timeline the boot step turns into the `cutin:<id>` animation
//
// Textures: `cutin:<id>` (frames 'f0'…'fN'), animation `cutin:<id>` (one-shot, ~2 s, built by
// src/boot/25-cutins.ts). The timeline is tuned to src/vfx/cutin.ts: the portrait slides in at
// ~180–480 ms, the eyes flare at ~590 ms (lens glint is placed on the brightest eye pixel of the
// LAST frame), the name plate slams at ~690 ms, the white flash-out comes at ~1.3 s.

import type { MonsterId } from '../../data/cards';
import { MONSTER_IDS, cardDef } from '../../data/cards';
import { ATTRIBUTE_RAMP, PAL } from '../palette';
import { PixelCanvas, shade } from '../pixel';
import type { CutinArt } from '../types';
import { monsterArt } from '../monsters';

// ================================================================== kit

export type V = readonly [number, number];

const DEG = Math.PI / 180;
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k];
const lerpV = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const len = (a: V) => Math.hypot(a[0], a[1]);
const norm = (a: V): V => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};
const rotV = (a: V, rad: number): V => [a[0] * Math.cos(rad) - a[1] * Math.sin(rad), a[0] * Math.sin(rad) + a[1] * Math.cos(rad)];
const polar = (deg: number, r: number): V => [Math.cos(deg * DEG) * r, Math.sin(deg * DEG) * r];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Key light: top-left, a little toward the viewer (same as the monster sprites). */
const KEY: readonly [number, number, number] = (() => {
  const l = [-0.5, -0.74, 0.46];
  const m = Math.hypot(l[0], l[1], l[2]);
  return [l[0] / m, l[1] / m, l[2] / m] as const;
})();

export interface Mat {
  /** dark → light */
  ramp: readonly number[];
  /** ascending light thresholds (length ramp.length - 1) */
  th: readonly number[];
  /** the pixel's bias IS the ramp index (hand-toned planes) */
  direct?: boolean;
  /** direct mats: fractional bias is ordered-dithered between the two nearest tones */
  dither?: boolean;
}

export interface PrimOpt {
  z?: number;
  bias?: number | ((x: number, y: number) => number);
  /** scale of the normal's z (lower = flatter, more contrast at the rims) */
  flat?: number;
  /** quantize a tube's cross-section into this many facets (crystal / carved look) */
  facets?: number;
  /** ventral band: cross-section v > from gets `lift` added to the bias */
  belly?: { from: number; lift: number };
  /** tubes: extra bias from (distance along the path in px, cross-section -1..1) — scales, rings */
  pattern?: (s: number, v: number) => number;
}

/** Scanline polygon fill sampled at pixel centers. */
function fillPoly(pts: readonly V[], cb: (x: number, y: number) => void): void {
  if (pts.length < 3) return;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const sy = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy)) xs.push(a[0] + ((sy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) cb(x, y);
  }
}

/**
 * A G-buffer layer: primitives carry a material, a surface normal and a depth (z-union, so
 * overlapping primitives merge like clay). render() lights it with the key light and quantizes
 * every pixel onto its material ramp, then despeckles. (Same pipeline idea as crystal_wyrm.ts.)
 */
export class GBuf {
  readonly w: number;
  readonly h: number;
  readonly mat: Int16Array;
  readonly nx: Float32Array;
  readonly ny: Float32Array;
  readonly nz: Float32Array;
  readonly z: Float32Array;
  readonly bias: Float32Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.mat = new Int16Array(n).fill(-1);
    this.nx = new Float32Array(n);
    this.ny = new Float32Array(n);
    this.nz = new Float32Array(n);
    this.z = new Float32Array(n).fill(-1e9);
    this.bias = new Float32Array(n);
  }

  put(x: number, y: number, mat: number, nx: number, ny: number, nz: number, z: number, bias = 0): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    if (z < this.z[i]) return;
    const m = Math.hypot(nx, ny, nz) || 1;
    this.mat[i] = mat;
    this.nx[i] = nx / m;
    this.ny[i] = ny / m;
    this.nz[i] = nz / m;
    this.z[i] = z;
    this.bias[i] = bias;
  }

  has(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.mat[y * this.w + x] >= 0;
  }

  /** Remove pixels (e.g. carve a mouth out of a head). */
  carve(test: (x: number, y: number) => boolean): void {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        if (this.mat[i] >= 0 && test(x, y)) {
          this.mat[i] = -1;
          this.z[i] = -1e9;
        }
      }
  }

  /** Add to the bias of covered pixels (glow regions, tone shifts). */
  lift(test: (x: number, y: number) => number): void {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        if (this.mat[i] >= 0) this.bias[i] += test(x, y);
      }
  }

  /** Ellipsoid (rotated by `ang` radians). */
  ell(c: V, rx: number, ry: number, ang: number, mat: number, o: PrimOpt = {}): this {
    const cs = Math.cos(ang);
    const sn = Math.sin(ang);
    const R = Math.max(rx, ry) + 1;
    const z0 = o.z ?? 0;
    const flat = o.flat ?? 1;
    for (let y = Math.floor(c[1] - R); y <= Math.ceil(c[1] + R); y++)
      for (let x = Math.floor(c[0] - R); x <= Math.ceil(c[0] + R); x++) {
        const dx = x + 0.5 - c[0];
        const dy = y + 0.5 - c[1];
        const lx = (dx * cs + dy * sn) / rx;
        const ly = (-dx * sn + dy * cs) / ry;
        const d2 = lx * lx + ly * ly;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2);
        const b = typeof o.bias === 'function' ? o.bias(x, y) : (o.bias ?? 0);
        this.put(x, y, mat, lx * cs - ly * sn, lx * sn + ly * cs, nz * flat, z0 + nz * Math.min(rx, ry), b);
      }
    return this;
  }

  /** Tapered tube along a polyline, cylinder normals (optionally faceted). */
  tube(path: readonly V[], w0: number, w1: number, mat: number, o: PrimOpt = {}): this {
    if (path.length < 2) return this;
    const lens = [0];
    for (let i = 1; i < path.length; i++) lens.push(lens[i - 1] + len(sub(path[i], path[i - 1])));
    const total = lens[lens.length - 1] || 1;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of path) {
      x0 = Math.min(x0, p[0]);
      y0 = Math.min(y0, p[1]);
      x1 = Math.max(x1, p[0]);
      y1 = Math.max(y1, p[1]);
    }
    const R = Math.max(w0, w1) / 2 + 1;
    const z0 = o.z ?? 0;
    const flat = o.flat ?? 1;
    for (let y = Math.max(0, Math.floor(y0 - R)); y <= Math.min(this.h - 1, Math.ceil(y1 + R)); y++)
      for (let x = Math.max(0, Math.floor(x0 - R)); x <= Math.min(this.w - 1, Math.ceil(x1 + R)); x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        let best = Infinity;
        let bu = 0;
        let bqx = 0;
        let bqy = 0;
        let btx = 1;
        let bty = 0;
        for (let i = 1; i < path.length; i++) {
          const ax = path[i - 1][0];
          const ay = path[i - 1][1];
          const sx = path[i][0] - ax;
          const sy = path[i][1] - ay;
          const sl2 = sx * sx + sy * sy || 1;
          const t = clamp(((px - ax) * sx + (py - ay) * sy) / sl2, 0, 1);
          const qx = ax + sx * t;
          const qy = ay + sy * t;
          const d2 = (px - qx) * (px - qx) + (py - qy) * (py - qy);
          if (d2 < best) {
            best = d2;
            const sl = Math.sqrt(sl2);
            bu = lens[i - 1] + sl * t;
            bqx = qx;
            bqy = qy;
            btx = sx / sl;
            bty = sy / sl;
          }
        }
        const r = lerp(w0, w1, bu / total) / 2;
        const d = Math.sqrt(best);
        if (d > r) continue;
        const ox = (px - bqx) / Math.max(r, 0.5);
        const oy = (py - bqy) / Math.max(r, 0.5);
        const v = clamp(ox * -bty + oy * btx, -1, 1);
        let nx: number;
        let ny: number;
        let nz: number;
        if (o.facets) {
          const phi = Math.asin(v);
          const step = Math.PI / o.facets;
          const q = (Math.floor(phi / step) + 0.5) * step;
          nx = -bty * Math.sin(q);
          ny = btx * Math.sin(q);
          nz = Math.cos(q) * flat;
        } else {
          const o2 = Math.min(1, ox * ox + oy * oy);
          nx = ox;
          ny = oy;
          nz = Math.sqrt(1 - o2) * flat;
        }
        const hz = Math.sqrt(Math.max(0, 1 - Math.min(1, ox * ox + oy * oy)));
        let b = typeof o.bias === 'function' ? o.bias(x, y) : (o.bias ?? 0);
        if (o.belly && v > o.belly.from) b += o.belly.lift;
        if (o.pattern) b += o.pattern(bu, v);
        this.put(x, y, mat, nx, ny, nz, z0 + hz * r, b);
      }
    return this;
  }

  /** Flat polygon with one normal (a carved plane). */
  facet(pts: readonly V[], mat: number, n: readonly [number, number, number] = [0, 0, 1], z = 0, bias: number | ((x: number, y: number) => number) = 0): this {
    fillPoly(pts, (x, y) => this.put(x, y, mat, n[0], n[1], n[2], z, typeof bias === 'number' ? bias : bias(x, y)));
    return this;
  }

  /** Light + quantize (+ despeckle) into a canvas of the same size. */
  render(mats: readonly Mat[], o: { light?: readonly [number, number, number]; shift?: number; speckle?: boolean } = {}): PixelCanvas {
    const L = o.light ?? KEY;
    const shift = o.shift ?? 0;
    const out = new PixelCanvas(this.w, this.h);
    for (let i = 0; i < this.w * this.h; i++) {
      const mi = this.mat[i];
      if (mi < 0) continue;
      const m = mats[mi];
      if (!m) continue;
      let k: number;
      if (m.direct) {
        const x = i % this.w;
        const y = Math.floor(i / this.w);
        k = clamp(m.dither ? Math.floor(this.bias[i] + (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16) : Math.round(this.bias[i]), 0, m.ramp.length - 1);
      }
      else {
        const I = this.nx[i] * L[0] + this.ny[i] * L[1] + this.nz[i] * L[2] + this.bias[i] + shift;
        k = 0;
        while (k < m.th.length && I >= m.th[k]) k++;
      }
      out.set(i % this.w, Math.floor(i / this.w), m.ramp[k]);
    }
    if (o.speckle !== false) despeckle(out);
    return out;
  }
}

/** Any pixel with no 8-neighbour of its own colour takes the majority neighbour colour. */
export function despeckle(c: PixelCanvas, keep?: (col: number) => boolean): void {
  const W = c.w;
  const H = c.h;
  const d = c.data;
  const col = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return -1;
    const i = (y * W + x) * 4;
    return d[i + 3] ? (d[i] << 16) | (d[i + 1] << 8) | d[i + 2] : -1;
  };
  for (let pass = 0; pass < 2; pass++) {
    const fix: number[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c0 = col(x, y);
        if (c0 < 0 || (keep && keep(c0))) continue;
        let same = false;
        const votes = new Map<number, number>();
        for (let dy = -1; dy <= 1 && !same; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const n = col(x + dx, y + dy);
            if (n < 0) continue;
            if (n === c0) {
              same = true;
              break;
            }
            votes.set(n, (votes.get(n) ?? 0) + (dx && dy ? 1 : 2));
          }
        if (same || votes.size === 0) continue;
        let best = -1;
        let bv = 0;
        for (const [k, v] of votes) if (v > bv) [best, bv] = [k, v];
        fix.push(x, y, best);
      }
    if (!fix.length) break;
    for (let i = 0; i < fix.length; i += 3) c.set(fix[i], fix[i + 1], fix[i + 2]);
  }
}

/**
 * Composite `layer` over `dst`. Where the layer overlaps parts already drawn, the surface
 * behind gets a contact-shadow seam: `seam` ramp steps darker on the shadow side (right/below
 * the layer edge), one step on the lit side. seam 0 = plain blit.
 */
export function composite(dst: PixelCanvas, layer: PixelCanvas, seam = 2, ink = false): void {
  if (seam > 0) {
    const W = dst.w;
    const H = dst.h;
    const marks: number[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (layer.isOpaque(x, y) || !dst.isOpaque(x, y)) continue;
        const shadow = layer.isOpaque(x - 1, y) || layer.isOpaque(x, y - 1) || layer.isOpaque(x - 1, y - 1);
        const lit = layer.isOpaque(x + 1, y) || layer.isOpaque(x, y + 1);
        if (shadow) marks.push(x, y, ink ? -99 : seam);
        else if (lit) marks.push(x, y, ink ? -99 : 1);
      }
    for (let i = 0; i < marks.length; i += 3) {
      const c = dst.get(marks[i], marks[i + 1]);
      if (c === null) continue;
      dst.set(marks[i], marks[i + 1], marks[i + 2] === -99 ? PAL.ink : shade(c, -marks[i + 2]));
    }
  }
  dst.blit(layer, 0, 0);
}

/**
 * Silhouette rim light: pixels whose neighbour toward `dir` is transparent take cols[0]; the
 * next pixel in takes cols[1] (if given). `only` filters which surface colours may be lit.
 */
export function rim(c: PixelCanvas, dir: V, cols: readonly number[], only?: (col: number) => boolean): void {
  const W = c.w;
  const H = c.h;
  const sets: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const col = c.get(x, y);
      if (col === null || (only && !only(col))) continue;
      if (!c.isOpaque(x + dir[0], y + dir[1])) sets.push(x, y, 0);
      else if (cols.length > 1 && !c.isOpaque(x + 2 * dir[0], y + 2 * dir[1])) sets.push(x, y, 1);
    }
  for (let i = 0; i < sets.length; i += 3) c.set(sets[i], sets[i + 1], cols[sets[i + 2]]);
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Bayer threshold 0..15 at (x, y). */
export function bayer(x: number, y: number): number {
  return BAYER4[(y & 3) * 4 + (x & 3)];
}

/**
 * Emissive radial glow (no outline): rings of `ramp` from the outside (ramp[0]) to the core
 * (last), dithered at each ring border. `only` restricts it (e.g. to transparent pixels).
 */
export function glow(p: PixelCanvas, cx: number, cy: number, r: number, ramp: readonly number[], o: { sy?: number; under?: boolean } = {}): void {
  const sy = o.sy ?? 1;
  const n = ramp.length;
  for (let y = Math.floor(cy - r * sy) - 1; y <= Math.ceil(cy + r * sy) + 1; y++)
    for (let x = Math.floor(cx - r) - 1; x <= Math.ceil(cx + r) + 1; x++) {
      const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) / sy) / r;
      if (d > 1) continue;
      const t = (1 - d) * n; // 0..n
      let k = Math.floor(t);
      if (t - k < 0.35 && bayer(x, y) >= 8) k -= 1; // dithered ring borders
      if (k < 0) continue;
      k = Math.min(n - 1, k);
      if (o.under && p.isOpaque(x, y)) continue;
      p.set(x, y, ramp[k]);
    }
}

/** Four-point sparkle: arms of length r, core colour + arm colour. */
export function star(p: PixelCanvas, x: number, y: number, r: number, core: number, arm: number, tip?: number): void {
  x = Math.round(x);
  y = Math.round(y);
  for (let i = 1; i <= r; i++) {
    const c = i === r && tip !== undefined ? tip : arm;
    p.set(x + i, y, c);
    p.set(x - i, y, c);
    p.set(x, y + i, c);
    p.set(x, y - i, c);
  }
  if (r >= 3) {
    p.set(x + 1, y + 1, arm);
    p.set(x - 1, y - 1, arm);
    p.set(x + 1, y - 1, arm);
    p.set(x - 1, y + 1, arm);
  }
  p.set(x, y, core);
}

/** Dither-dissolve the canvas to transparency between rows y0 (solid) and y1 (gone). */
export function dissolveRows(p: PixelCanvas, y0: number, y1: number): void {
  for (let y = Math.max(0, Math.floor(y0)); y < p.h; y++) {
    const t = clamp((y - y0) / Math.max(1, y1 - y0), 0, 1);
    const lvl = Math.round(t * 16);
    for (let x = 0; x < p.w; x++) if (bayer(x, y) < lvl) p.erase(x, y);
  }
}

/**
 * Horizontal speed-streak dissolve: between rows y0 (solid) and y1 (gone) the picture breaks
 * into ever longer horizontal gaps, like the bust being torn into the cut-in's speed lines.
 * `x0`/`x1` limit it horizontally (default: whole width).
 */
export function streakDissolve(p: PixelCanvas, y0: number, y1: number, x0 = 0, x1 = p.w): void {
  for (let y = Math.max(0, Math.floor(y0)); y < p.h; y++) {
    const t = clamp((y - y0) / Math.max(1, y1 - y0), 0, 1);
    const period = 13 + ((y * 7) % 5);
    const off = (y * 37 + (y >> 1) * 11) % period;
    const gap = Math.round(t * t * period * 1.15);
    for (let x = Math.max(0, x0); x < Math.min(p.w, x1); x++) {
      if ((x + off) % period < gap) p.erase(x, y);
    }
  }
}

/** Drop shadow: darken `dst` pixels (not covered by `layer`) that `layer` covers when shifted by (dx, dy). */
export function castShadow(dst: PixelCanvas, layer: PixelCanvas, dx: number, dy: number, steps = 1, only?: (col: number) => boolean): void {
  const marks: number[] = [];
  for (let y = 0; y < dst.h; y++)
    for (let x = 0; x < dst.w; x++) {
      if (layer.isOpaque(x, y)) continue;
      const c = dst.get(x, y);
      if (c === null || c === PAL.ink || (only && !only(c))) continue;
      if (layer.isOpaque(x - dx, y - dy)) marks.push(x, y);
    }
  for (let i = 0; i < marks.length; i += 2) dst.set(marks[i], marks[i + 1], shade(dst.get(marks[i], marks[i + 1])!, -steps));
}

/** 1px line painted only over opaque pixels (optionally only over colours passing `only`). */
export function lineOn(c: PixelCanvas, a: V, b: V, col: number, only?: (cur: number) => boolean): void {
  let x0 = Math.floor(a[0]);
  let y0 = Math.floor(a[1]);
  const x1 = Math.floor(b[0]);
  const y1 = Math.floor(b[1]);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    const cur = c.get(x0, y0);
    if (cur !== null && (!only || only(cur))) c.set(x0, y0, col);
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
}

/** Polyline version of lineOn. */
export function pathOn(c: PixelCanvas, pts: readonly V[], col: number, only?: (cur: number) => boolean): void {
  for (let i = 1; i < pts.length; i++) lineOn(c, pts[i - 1], pts[i], col, only);
}

/** Points along a cubic Bézier. */
function bez(p0: V, p1: V, p2: V, p3: V, n = 16): V[] {
  const out: V[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

/** Deterministic RNG. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const KIT = {
  KEY,
  add,
  sub,
  mul,
  lerpV,
  len,
  norm,
  rotV,
  polar,
  lerp,
  clamp,
  bez,
  rng,
  fillPoly,
  GBuf,
  despeckle,
  composite,
  rim,
  bayer,
  glow,
  star,
  dissolveRows,
  lineOn,
  pathOn,
  shade,
  streakDissolve,
  castShadow,
};
export type CutinKit = typeof KIT;
export type CutinFactory = (kit: CutinKit) => CutinArt;

// ================================================================== registry

const modules = import.meta.glob<{ default: CutinArt | CutinFactory }>(['./*.ts', '!./index.ts', '!./_*.ts'], { eager: true });

const REGISTRY = new Map<MonsterId, CutinArt>();
for (const mod of Object.values(modules)) {
  const d = mod.default;
  const art = typeof d === 'function' ? d(KIT) : d;
  if (art && art.id) REGISTRY.set(art.id, art);
}

/** True when a hand-made portrait exists for this monster. */
export function hasCutin(id: MonsterId): boolean {
  return REGISTRY.has(id);
}

/** Ids of every monster that has a hand-made portrait. */
export function cutinIds(): MonsterId[] {
  return MONSTER_IDS.filter((id) => REGISTRY.has(id));
}

const PLACEHOLDERS = new Map<MonsterId, CutinArt>();

/** The cut-in portrait for a monster; a placeholder (its idle sprite, ×2 bust crop) if none. */
export function cutinArt(id: MonsterId): CutinArt {
  const art = REGISTRY.get(id);
  if (art) return art;
  let ph = PLACEHOLDERS.get(id);
  if (!ph) {
    ph = placeholderCutin(id);
    PLACEHOLDERS.set(id, ph);
  }
  return ph;
}

/** Fallback portrait: the monster's idle frames, upper body cropped and doubled, with a rim glow. */
function placeholderCutin(id: MonsterId): CutinArt {
  const def = cardDef(id);
  const ramp = def.kind === 'monster' ? ATTRIBUTE_RAMP[def.attribute] : ATTRIBUTE_RAMP.LIGHT;
  const m = monsterArt(id);
  const W = 200;
  const H = 144;
  const frames = Math.max(1, Math.min(4, m.anims.idle.frames));
  return {
    id,
    w: W,
    h: H,
    frames,
    fps: 8,
    accent: ramp[3],
    accentDark: ramp[1],
    draw(p: PixelCanvas, frame: number) {
      const src = new PixelCanvas(m.w, m.h);
      m.draw(src, 'idle', frame % m.anims.idle.frames);
      const b = src.bounds();
      if (!b) return;
      const k = Math.max(1, Math.min(4, Math.floor(Math.min(W / b.w, (H * 1.35) / b.h))));
      const big = src.crop(b.x, b.y, b.w, b.h).scaled(k);
      const dx = Math.round((W - big.w) / 2);
      p.blit(big, dx, 6);
      rim(p, [1, 0], [ramp[3]], (c) => c !== PAL.ink);
      dissolveRows(p, H - 24, H);
    },
  };
}

// ================================================================== timeline

export interface CutinStep {
  frame: number;
  ms: number;
}

/**
 * Frame timeline of the `cutin:<id>` animation (one-shot, about 2 s so it never runs out
 * during the ~1.4 s the portrait is on screen):
 *   frames 0 … N-3  build-up (calm stare → eyes ignite → jaw opens → ROAR peak at ~560 ms)
 *   frames N-2, N-1 roar hold, alternating (trembling jaw, flickering aura). The last frame is
 *   the one cutin.ts scans for the eye glint, so it must show the eyes at full flare.
 */
export function cutinSequence(art: CutinArt): CutinStep[] {
  const n = art.frames;
  const tick = Math.round(1000 / Math.max(1, art.fps));
  if (n < 4) return Array.from({ length: Math.max(1, Math.ceil(2000 / tick)) }, (_, i) => ({ frame: i % n, ms: tick }));
  const out: CutinStep[] = [];
  const build = n - 2; // frames 0 … build-1 play once; build-1 is the roar peak
  const peak = build - 1;
  // frame 0 covers the band wipe + slide-in; the peak frame starts just before the eye flare
  const first = 400;
  const peakStart = 540;
  out.push({ frame: 0, ms: first });
  const between = peak - 1; // frames 1 … peak-1
  for (let f = 1; f < peak; f++) out.push({ frame: f, ms: Math.round((peakStart - first) / between) });
  if (peak > 0) out.push({ frame: peak, ms: 130 });
  let t = out.reduce((s, x) => s + x.ms, 0);
  let k = 0;
  while (t < 2100) {
    const f = build + (k++ % 2);
    out.push({ frame: f, ms: tick });
    t += tick;
  }
  return out;
}

export function cutinTextureKey(id: MonsterId): string {
  return `cutin:${id}`;
}

export function cutinAnimKey(id: MonsterId): string {
  return `cutin:${id}`;
}

export function cutinFrameName(frame: number): string {
  return `f${frame}`;
}

let resolveBuilt: () => void = () => {};
const BUILT = new Promise<void>((r) => (resolveBuilt = r));
/** Resolves once the boot step has registered every `cutin:<id>` texture + animation. */
export function whenCutinsBuilt(): Promise<void> {
  return BUILT;
}
/** Called by the boot step when all cut-in textures exist. */
export function markCutinsBuilt(): void {
  resolveBuilt();
}

/** Rendered frame (cached). */
const FRAME_CACHE = new Map<string, PixelCanvas>();
export function cutinFrame(id: MonsterId, frame: number): PixelCanvas {
  const k = `${id}|${frame}`;
  let pc = FRAME_CACHE.get(k);
  if (!pc) {
    const art = cutinArt(id);
    pc = new PixelCanvas(art.w, art.h);
    art.draw(pc, Math.max(0, Math.min(art.frames - 1, frame)));
    FRAME_CACHE.set(k, pc);
  }
  return pc;
}
