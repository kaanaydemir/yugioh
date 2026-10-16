// Art Lab B — dragon rig renderer (owned by the variant-B dragon; nothing else imports it).
//
// The same layered technique as variant A (src/artlab/variant-a/dragon-rig.ts), kept as a
// separate copy ON PURPOSE: the outline / seam colour registry below is B's own, so loading B can
// never change a pixel of A (A's registry is "first registration wins" and global to its module).
//
// A frame is painted back to front from LAYERS. A layer is a tiny G-buffer: rounded primitives
// (ellipsoids, tapered tubes) write a material, a light value and a depth (z-union, so overlapping
// masses merge like clay); flat polygons write a hand-chosen tone directly. The layer is then
// quantized onto its material ramp with hand-tuned bands (no dithering) and ONLY this automatic
// base is despeckled. Everything painted afterwards (plates, spikes, the head, talons...) is
// hand-placed and never touched by an automatic pass. Layers are composited with a contact seam
// (the pixels just outside a covering part step down their own ramp), and the silhouette gets one
// SELECTIVE coloured outline at the very end: a soft tinted line on the lit (top-left) edges, deep
// ink on the shadow side and the ground contact. Key light: top-left, toward the viewer — the
// same as A's characters.

import { PixelCanvas } from '../../art/pixel';

export type V2 = readonly [number, number];

export const DEG = Math.PI / 180;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const polar = (deg: number, r: number): V2 => [Math.cos(deg * DEG) * r, Math.sin(deg * DEG) * r];
export const addV = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
export const subV = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]];
export const mulV = (a: V2, k: number): V2 => [a[0] * k, a[1] * k];
export const lerpV = (a: V2, b: V2, t: number): V2 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
export const lenV = (a: V2) => Math.hypot(a[0], a[1]);
export const normV = (a: V2): V2 => {
  const l = lenV(a) || 1;
  return [a[0] / l, a[1] / l];
};
export const roundV = (a: V2): V2 => [Math.round(a[0]), Math.round(a[1])];

/** Cubic Bézier sampled into `n` + 1 points. */
export function bezier(p0: V2, p1: V2, p2: V2, p3: V2, n: number): V2[] {
  const out: V2[] = [];
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

/** Centripetal-ish Catmull-Rom spline through `pts` (end points duplicated), `n` samples per span. */
export function spline(pts: readonly V2[], n: number): V2[] {
  const out: V2[] = [];
  const P = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1);
    const p1 = P(i);
    const p2 = P(i + 1);
    const p3 = P(i + 2);
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Key light: top-left, toward the viewer (the same direction as variant A's sprites). */
const LIGHT = (() => {
  const l = [-0.45, -0.55, 0.7];
  const m = Math.hypot(l[0], l[1], l[2]);
  return [l[0] / m, l[1] / m, l[2] / m] as const;
})();

/** A material: its ramp (dark → light) and the light thresholds between its tones. */
export interface Mat {
  ramp: readonly number[];
  /** Ascending light thresholds (length ramp.length - 1). Omit for direct-tone materials. */
  th?: readonly number[];
  /** Tone offset applied after quantizing (far limbs sit one step darker). */
  shift?: number;
}

// ------------------------------------------------------------------ outline colours per ramp

interface RampInfo {
  ramp: readonly number[];
  index: number;
  /** Outline on the lit (top/left) side. */
  lit: number;
  /** Outline on the shadow side / ground. */
  ink: number;
}

const COLOR_INFO = new Map<number, RampInfo>();

/** Register a ramp so seams can step along it and the outline knows its colours. First wins. */
export function registerRamp(ramp: readonly number[], lit: number, ink: number): void {
  ramp.forEach((c, index) => {
    if (!COLOR_INFO.has(c)) COLOR_INFO.set(c, { ramp, index, lit, ink });
  });
}

/** Register single colours with explicit outline colours. */
export function registerColor(c: number, lit: number, ink: number): void {
  if (!COLOR_INFO.has(c)) COLOR_INFO.set(c, { ramp: [c], index: 0, lit, ink });
}

/** Step a colour along its registered ramp (clamped). Unknown colours are returned unchanged. */
export function stepColor(c: number, steps: number): number {
  const info = COLOR_INFO.get(c);
  if (!info) return c;
  const j = clamp(info.index + steps, 0, info.ramp.length - 1);
  return info.ramp[j];
}

// ------------------------------------------------------------------ G-buffer layer

export class Layer {
  readonly mat: Int16Array;
  readonly val: Float32Array;
  readonly z: Float32Array;
  constructor(readonly w: number, readonly h: number, readonly mats: readonly Mat[]) {
    this.mat = new Int16Array(w * h).fill(-1);
    this.val = new Float32Array(w * h);
    this.z = new Float32Array(w * h).fill(-1e9);
  }

  put(x: number, y: number, mat: number, val: number, z: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    if (z < this.z[i]) return;
    this.mat[i] = mat;
    this.val[i] = val;
    this.z[i] = z;
  }

  has(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    return this.mat[y * this.w + x] >= 0;
  }

  /**
   * Rounded volume. `flat` < 1 flattens the bulge toward the viewer (wider light band), `bias`
   * nudges the light value (+ lighter) for hand control, `zc` pushes the primitive forward.
   */
  ellipsoid(cx: number, cy: number, rx: number, ry: number, mat: number, zc = 0, bias = 0, flat = 1): this {
    if (rx <= 0 || ry <= 0) return this;
    for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry) + 1; y++) {
      for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx) + 1; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        const d2 = nx * nx + ny * ny;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2) * flat + (1 - flat) * 0.6;
        const m = Math.hypot(nx, ny, nz) || 1;
        const l = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / m;
        this.put(x, y, mat, l + bias, zc + Math.sqrt(1 - d2) * Math.min(rx, ry));
      }
    }
    return this;
  }

  /** Tapered round tube along a polyline (spheres swept along it, z-unioned). */
  tube(path: readonly V2[], r0: number, r1: number, mat: number, zc = 0, bias = 0, flat = 1): this {
    if (path.length === 0) return this;
    const lens = [0];
    for (let i = 1; i < path.length; i++) lens.push(lens[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    const total = lens[lens.length - 1] || 1;
    if (path.length === 1) return this.ellipsoid(path[0][0], path[0][1], r0, r0, mat, zc, bias, flat);
    for (let i = 1; i < path.length; i++) {
      const [ax, ay] = path[i - 1];
      const [bx, by] = path[i];
      const seg = lens[i] - lens[i - 1];
      const steps = Math.max(1, Math.ceil(seg * 2));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const d = lens[i - 1] + seg * t;
        const r = lerp(r0, r1, d / total);
        this.ellipsoid(ax + (bx - ax) * t, ay + (by - ay) * t, r, r, mat, zc, bias, flat);
      }
    }
    return this;
  }

  /** Tube with a radius per path point (muscle swells along a limb). */
  tubeR(path: readonly V2[], radii: readonly number[], mat: number, zc = 0, bias = 0, flat = 1): this {
    for (let i = 1; i < path.length; i++) {
      const [ax, ay] = path[i - 1];
      const [bx, by] = path[i];
      const seg = Math.hypot(bx - ax, by - ay);
      const steps = Math.max(1, Math.ceil(seg * 2));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const r = lerp(radii[i - 1], radii[i], t);
        this.ellipsoid(ax + (bx - ax) * t, ay + (by - ay) * t, r, r, mat, zc, bias, flat);
      }
    }
    return this;
  }

  /** Flat polygon with a hand-chosen tone index (direct materials) or light value. */
  poly(pts: readonly V2[], mat: number, val: number, z = 0): this {
    if (pts.length < 3) return this;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of pts) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const sy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= sy && y1 > sy) || (y1 <= sy && y0 > sy)) xs.push(x0 + ((sy - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) this.put(x, y, mat, val, z);
      }
    }
    return this;
  }

  /** Quantize to colours. Lonely tone pixels of the automatic base are merged into their neighbours. */
  render(): PixelCanvas {
    const { w, h } = this;
    const tone = new Int16Array(w * h).fill(-1);
    for (let i = 0; i < w * h; i++) {
      const m = this.mat[i];
      if (m < 0) continue;
      const def = this.mats[m];
      let k: number;
      if (def.th) {
        k = 0;
        while (k < def.th.length && this.val[i] >= def.th[k]) k++;
      } else k = Math.round(this.val[i]);
      k = clamp(k + (def.shift ?? 0), 0, def.ramp.length - 1);
      tone[i] = k;
    }
    const out = tone.slice();
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (tone[i] < 0) continue;
        const m = this.mat[i];
        const counts = new Map<number, number>();
        let same = 0;
        let nb = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (tone[j] < 0 || this.mat[j] !== m) continue;
          nb++;
          if (tone[j] === tone[i]) same++;
          counts.set(tone[j], (counts.get(tone[j]) ?? 0) + 1);
        }
        if (nb >= 2 && same === 0) {
          let best = tone[i];
          let bc = 0;
          for (const [t, c] of counts) if (c > bc) [best, bc] = [t, c];
          out[i] = best;
        }
      }
    const p = new PixelCanvas(w, h);
    for (let i = 0; i < w * h; i++) {
      if (out[i] < 0) continue;
      p.set(i % w, Math.floor(i / w), this.mats[this.mat[i]].ramp[out[i]]);
    }
    return p;
  }
}

// ------------------------------------------------------------------ compositing

/**
 * Paint `top` over `base`. Pixels of `base` that touch `top` from outside get a contact seam:
 * `litSteps` down their own ramp above/left of the covering part, `shadeSteps` below/right of it.
 * `cast` darkens the base where `top` shifted by (dx, dy) would cover it (a short cast shadow).
 */
export function composite(
  base: PixelCanvas,
  top: PixelCanvas,
  litSteps = 1,
  shadeSteps = 2,
  cast?: { dx: number; dy: number; steps?: number },
  seamOn?: (c: number) => boolean,
): void {
  const { w, h } = base;
  if (cast) {
    const changes: [number, number, number][] = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (top.isOpaque(x, y) || !top.isOpaque(x - cast.dx, y - cast.dy)) continue;
        const c = base.get(x, y);
        if (c === null) continue;
        if (seamOn && !seamOn(c)) continue;
        changes.push([x, y, stepColor(c, -(cast.steps ?? 1))]);
      }
    for (const [x, y, c] of changes) base.set(x, y, c);
  }
  if (litSteps || shadeSteps) {
    const changes: [number, number, number][] = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (top.isOpaque(x, y)) continue;
        const c = base.get(x, y);
        if (c === null) continue;
        if (seamOn && !seamOn(c)) continue;
        const below = top.isOpaque(x, y - 1) || top.isOpaque(x - 1, y);
        const above = top.isOpaque(x, y + 1) || top.isOpaque(x + 1, y);
        if (!below && !above) continue;
        changes.push([x, y, stepColor(c, below ? -shadeSteps : -litSteps)]);
      }
    for (const [x, y, c] of changes) base.set(x, y, c);
  }
  base.blit(top, 0, 0);
}

/**
 * The single exterior outline. Transparent pixels touching the sprite take the outline colours of
 * the colour they touch: the shadow side (sprite above / left of the pixel) and the ground get the
 * deep ink, the lit side (sprite below / right of the pixel) the soft tinted line. One colour per
 * run: an outline pixel whose colour no neighbouring outline pixel shares takes its neighbours'.
 */
export function selectiveOutline(p: PixelCanvas, groundY: number, fallback: number): void {
  const add: [number, number, number][] = [];
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      if (p.isOpaque(x, y)) continue;
      const up = p.get(x, y - 1);
      const left = p.get(x - 1, y);
      const down = p.get(x, y + 1);
      const right = p.get(x + 1, y);
      const shadowN = up ?? left;
      const litN = down ?? right;
      if (shadowN === null && litN === null) continue;
      let c: number;
      if (shadowN !== null || y >= groundY) {
        const src = shadowN ?? litN!;
        c = COLOR_INFO.get(src)?.ink ?? fallback;
      } else {
        c = COLOR_INFO.get(litN!)?.lit ?? fallback;
      }
      add.push([x, y, c]);
    }
  const key = (x: number, y: number) => y * p.w + x;
  const col = new Map<number, number>();
  for (const [x, y, c] of add) col.set(key(x, y), c);
  const fixed: [number, number, number][] = add.map(([x, y, c]) => {
    const counts = new Map<number, number>();
    let same = false;
    for (let oy = -1; oy <= 1; oy++)
      for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        const n = col.get(key(x + ox, y + oy));
        if (n === undefined) continue;
        if (n === c) same = true;
        else counts.set(n, (counts.get(n) ?? 0) + 1);
      }
    if (same || counts.size === 0) return [x, y, c];
    let best = c;
    let bc = 0;
    for (const [n, k] of counts) if (k > bc) [best, bc] = [n, k];
    return [x, y, best];
  });
  for (const [x, y, c] of fixed) p.set(x, y, c);
}

/** Stamp an ASCII map; '_' erases; `mask` limits it to pixels already opaque in that canvas. */
export function stampMap(
  p: PixelCanvas,
  rows: readonly string[],
  key: Readonly<Record<string, number>>,
  x: number,
  y: number,
  mask?: PixelCanvas,
  flipX = false,
): void {
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      const px = flipX ? x + row.length - 1 - i : x + i;
      if (ch === '_') {
        p.erase(px, y + j);
        continue;
      }
      const c = key[ch];
      if (c === undefined) continue;
      if (mask && !mask.isOpaque(px, y + j)) continue;
      p.set(px, y + j, c);
    }
  }
}

/** 1-px line (Bresenham), optionally only over opaque pixels. */
export function line(p: PixelCanvas, a: V2, b: V2, c: number, mask = false): void {
  let x0 = Math.round(a[0]);
  let y0 = Math.round(a[1]);
  const x1 = Math.round(b[0]);
  const y1 = Math.round(b[1]);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (!mask || p.isOpaque(x0, y0)) p.set(x0, y0, c);
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

/** Pixels of a 1-px Bresenham line, in order. */
export function linePixels(a: V2, b: V2): V2[] {
  const out: V2[] = [];
  let x0 = Math.round(a[0]);
  let y0 = Math.round(a[1]);
  const x1 = Math.round(b[0]);
  const y1 = Math.round(b[1]);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push([x0, y0]);
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
  return out;
}

/** Pixels of a polyline (Bresenham per segment, no duplicated joints). */
export function pathPixels(pts: readonly V2[]): V2[] {
  const out: V2[] = [];
  for (let i = 1; i < pts.length; i++) {
    const seg = linePixels(pts[i - 1], pts[i]);
    for (const q of i === 1 ? seg : seg.slice(1)) out.push(q);
  }
  return out;
}

/** A copy of `c` moved by a whole-pixel offset. */
export function shifted(c: PixelCanvas, dx: number, dy: number): PixelCanvas {
  if (!dx && !dy) return c;
  const o = new PixelCanvas(c.w, c.h);
  o.blit(c, dx, dy);
  return o;
}
