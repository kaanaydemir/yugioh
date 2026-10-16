// Art Lab C — dragon rig renderer (owned by the variant-C dragon; nothing else imports it).
//
// The same layered technique as variants A/B, kept as a separate copy ON PURPOSE: the outline /
// seam colour registry below is C's own (A's and B's registries are module-global, "first
// registration wins"), so loading C can never change a pixel of A or B.
//
// A frame is painted back to front from LAYERS, like the original crystal wyrm
// (src/art/monsters/crystal_wyrm.ts). A layer is a tiny G-buffer: primitives that carry a surface
// normal — ellipsoids, tapered tubes whose cross-section is cut into flat FACETS (the crystal
// planes of the original), flat polygons with a hand-chosen tone — write a material, a light
// value and a depth (z-union, so overlapping masses merge like clay). The layer is quantized onto
// its material ramp with hand-tuned bands (no dithering) and ONLY this automatic base loses its
// lonely pixels; everything painted afterwards (facet lines, glints, claws, the head maps, the
// spikes) is hand-placed and never touched by an automatic pass. Layers are composited with a
// contact seam (the pixels just outside a covering part step down their own ramp). At the very end
// the silhouette gets ONE selective coloured outline (ink on the shadow side and the ground, a
// coloured line on the lit edges) and a reflected neon rim.

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
export const rotV = (a: V2, rad: number): V2 => [a[0] * Math.cos(rad) - a[1] * Math.sin(rad), a[0] * Math.sin(rad) + a[1] * Math.cos(rad)];
export const roundV = (a: V2): V2 => [Math.round(a[0]), Math.round(a[1])];
export const floorV = (a: V2): V2 => [Math.floor(a[0]), Math.floor(a[1])];

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

/** Point and tangent at fraction t of a polyline's length. */
export function samplePath(path: readonly V2[], t: number): { p: V2; tan: V2 } {
  const lens = [0];
  for (let i = 1; i < path.length; i++) lens.push(lens[i - 1] + lenV(subV(path[i], path[i - 1])));
  const target = t * lens[lens.length - 1];
  for (let i = 1; i < path.length; i++) {
    if (lens[i] >= target || i === path.length - 1) {
      const seg = lens[i] - lens[i - 1] || 1;
      const k = clamp((target - lens[i - 1]) / seg, 0, 1);
      return { p: lerpV(path[i - 1], path[i], k), tan: normV(subV(path[i], path[i - 1])) };
    }
  }
  return { p: path[0], tan: [1, 0] };
}

/** Two-bone IK: the middle joint of a limb from `a` to `b` (bend side by `sign`). */
export function ik(a: V2, b: V2, l1: number, l2: number, sign: number): V2 {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01);
  const c = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const ang = Math.atan2(dy, dx) + sign * Math.acos(c);
  return [a[0] + Math.cos(ang) * l1, a[1] + Math.sin(ang) * l1];
}

/** Key light of the original sprites: top-left, slightly toward the viewer. */
export const LIGHT = (() => {
  const l = [-0.5, -0.74, 0.46];
  const m = Math.hypot(l[0], l[1], l[2]);
  return [l[0] / m, l[1] / m, l[2] / m] as const;
})();

/** A material: its ramp (dark → light) and the light thresholds between its tones. */
export interface Mat {
  ramp: readonly number[];
  /** Ascending light thresholds (length ramp.length - 1). Omit for direct-tone materials. */
  th?: readonly number[];
  /** Tone offset applied after quantizing (far limbs sit a step darker). */
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

/** Register a single colour with explicit outline colours. */
export function registerColor(c: number, lit: number, ink: number): void {
  if (!COLOR_INFO.has(c)) COLOR_INFO.set(c, { ramp: [c], index: 0, lit, ink });
}

/** Step a colour along its registered ramp (clamped). Unknown colours are returned unchanged. */
export function stepColor(c: number, steps: number): number {
  const info = COLOR_INFO.get(c);
  if (!info) return c;
  return info.ramp[clamp(info.index + steps, 0, info.ramp.length - 1)];
}

// ------------------------------------------------------------------ G-buffer layer

export interface PrimOpt {
  /** depth offset (bigger = in front) */
  z?: number;
  /** light bias (+ lighter) */
  bias?: number;
  /** squash of the normal's z (< 1 = more contrast at the rims) */
  flat?: number;
  /** cut the surface into this many flat facets across (tubes) / around (ellipsoids) */
  facets?: number;
  /** ventral plates of a tube: cross-section side v > from is lifted by `lift` */
  belly?: { from: number; lift: number };
}

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

  private lit(nx: number, ny: number, nz: number): number {
    const m = Math.hypot(nx, ny, nz) || 1;
    return (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / m;
  }

  /** Rotated ellipsoid (ang in radians). With `facets` the dome is cut like a gem: a flat table
   *  in the middle and a ring of `facets` flat bevels around it. */
  ellipsoid(c: V2, rx: number, ry: number, ang: number, mat: number, o: PrimOpt = {}): this {
    if (rx <= 0 || ry <= 0) return this;
    const cs = Math.cos(ang);
    const sn = Math.sin(ang);
    const R = Math.max(rx, ry) + 1;
    const flat = o.flat ?? 1;
    for (let y = Math.floor(c[1] - R); y <= Math.ceil(c[1] + R); y++)
      for (let x = Math.floor(c[0] - R); x <= Math.ceil(c[0] + R); x++) {
        const dx = x + 0.5 - c[0];
        const dy = y + 0.5 - c[1];
        let lx = (dx * cs + dy * sn) / rx;
        let ly = (-dx * sn + dy * cs) / ry;
        const d2 = lx * lx + ly * ly;
        if (d2 > 1) continue;
        let nzl = Math.sqrt(1 - d2);
        if (o.facets) {
          const d = Math.sqrt(d2);
          if (d < 0.42) {
            lx = 0;
            ly = 0;
            nzl = 1;
          } else {
            const step = (Math.PI * 2) / o.facets;
            const a = (Math.floor(Math.atan2(ly, lx) / step) + 0.5) * step;
            const r = d < 0.8 ? 0.6 : 0.92;
            lx = Math.cos(a) * r;
            ly = Math.sin(a) * r;
            nzl = Math.sqrt(1 - r * r);
          }
        }
        const nx = lx * cs - ly * sn;
        const ny = lx * sn + ly * cs;
        this.put(x, y, mat, this.lit(nx, ny, nzl * flat) + (o.bias ?? 0), (o.z ?? 0) + Math.sqrt(1 - d2) * Math.min(rx, ry));
      }
    return this;
  }

  /** Tapered tube along a polyline (widths w0 → w1) with cylinder normals, optionally faceted. */
  tube(path: readonly V2[], w0: number, w1: number, mat: number, o: PrimOpt = {}): this {
    if (path.length < 2) return this;
    const lens = [0];
    for (let i = 1; i < path.length; i++) lens.push(lens[i - 1] + lenV(subV(path[i], path[i - 1])));
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
    const flat = o.flat ?? 1;
    for (let y = Math.floor(y0 - R); y <= Math.ceil(y1 + R); y++)
      for (let x = Math.floor(x0 - R); x <= Math.ceil(x1 + R); x++) {
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
            bu = lens[i - 1] + Math.sqrt(sl2) * t;
            bqx = qx;
            bqy = qy;
            const sl = Math.sqrt(sl2);
            btx = sx / sl;
            bty = sy / sl;
          }
        }
        const r = lerp(w0, w1, bu / total) / 2;
        if (Math.sqrt(best) > r) continue;
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
        let bias = o.bias ?? 0;
        if (o.belly && v > o.belly.from) bias += o.belly.lift;
        this.put(x, y, mat, this.lit(nx, ny, nz) + bias, (o.z ?? 0) + hz * r);
      }
    return this;
  }

  /** Flat polygon with a hand-chosen tone index (direct materials) or light value. */
  poly(pts: readonly V2[], mat: number, val: number | ((x: number, y: number) => number), z = 0): this {
    fillPoly(pts, (x, y) => this.put(x, y, mat, typeof val === 'number' ? val : val(x, y), z));
    return this;
  }

  /** Quantize to colours. Lonely tone pixels of this automatic base merge into their neighbours. */
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
      tone[i] = clamp(k + (def.shift ?? 0), 0, def.ramp.length - 1);
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

/** Scanline polygon fill sampled at pixel centres. */
export function fillPoly(pts: readonly V2[], cb: (x: number, y: number) => void): void {
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

// ------------------------------------------------------------------ compositing

/**
 * Paint `top` over `base`. Pixels of `base` that touch `top` from outside get a contact seam:
 * `shadeSteps` down their own ramp below/right of the covering part, `litSteps` above/left of it.
 */
export function composite(
  base: PixelCanvas,
  top: PixelCanvas,
  litSteps = 1,
  shadeSteps = 2,
  seamOn?: (c: number) => boolean,
): void {
  const { w, h } = base;
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
 * ink, the lit side (sprite below / right of the pixel) the coloured line. One colour per run.
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
      if (shadowN !== null || y >= groundY) c = COLOR_INFO.get(shadowN ?? litN!)?.ink ?? fallback;
      else c = COLOR_INFO.get(litN!)?.lit ?? fallback;
      add.push([x, y, c]);
    }
  const key = (x: number, y: number) => y * p.w + x;
  const col = new Map<number, number>();
  for (const [x, y, c] of add) col.set(key(x, y), c);
  const fixed = add.map(([x, y, c]): [number, number, number] => {
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

/**
 * Reflected neon rim (the original's cyan edge light): sprite pixels on the shadow-side
 * silhouette (open space right of or below them) whose colour is a key of `map` take the mapped
 * rim colour — only where the edge is at least 2 px long, so it reads as a line, not a speck.
 */
export function rimLight(p: PixelCanvas, map: ReadonlyMap<number, number>, groundY: number): void {
  const open = (x: number, y: number) => !p.isOpaque(x, y);
  const hits = new Set<number>();
  for (let y = 0; y < Math.min(p.h, groundY - 1); y++)
    for (let x = 0; x < p.w; x++) {
      const c = p.get(x, y);
      if (c === null || !map.has(c)) continue;
      if (!(open(x + 1, y) || open(x, y + 1))) continue;
      if (open(x - 1, y) && open(x, y - 1)) continue;
      hits.add(y * p.w + x);
    }
  const changes: [number, number, number][] = [];
  for (const i of hits) {
    const x = i % p.w;
    const y = Math.floor(i / p.w);
    let n = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if ((ox || oy) && hits.has((y + oy) * p.w + x + ox)) n++;
    if (n >= 1) changes.push([x, y, map.get(p.get(x, y)!)!]);
  }
  for (const [x, y, c] of changes) p.set(x, y, c);
}

// ------------------------------------------------------------------ hand painting helpers

/** Stamp ASCII rows; `mask` limits it to pixels already opaque in that canvas; '_' erases. */
export function stampMap(
  p: PixelCanvas,
  rows: readonly string[],
  key: Readonly<Record<string, number>>,
  x: number,
  y: number,
  mask?: PixelCanvas,
): void {
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '_') {
        p.erase(x + i, y + j);
        continue;
      }
      const c = key[ch];
      if (c === undefined) continue;
      if (mask && !mask.isOpaque(x + i, y + j)) continue;
      p.set(x + i, y + j, c);
    }
  }
}

/** Pixels of a 4-connected line (no diagonal single-pixel steps). */
export function line4Pixels(a: V2, b: V2): V2[] {
  let x = Math.round(a[0]);
  let y = Math.round(a[1]);
  const x1 = Math.round(b[0]);
  const y1 = Math.round(b[1]);
  const dx = Math.abs(x1 - x);
  const dy = Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let err = dx - dy;
  const out: V2[] = [[x, y]];
  while (x !== x1 || y !== y1) {
    if (2 * err > -dy && (dx >= dy || 2 * err >= dx)) {
      err -= dy;
      x += sx;
    } else {
      err += dx;
      y += sy;
    }
    out.push([x, y]);
  }
  return out;
}

/** Bresenham line pixels (8-connected). */
export function linePixels(a: V2, b: V2): V2[] {
  let x0 = Math.round(a[0]);
  let y0 = Math.round(a[1]);
  const x1 = Math.round(b[0]);
  const y1 = Math.round(b[1]);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const out: V2[] = [];
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

/** Paint a line in one colour; only over opaque pixels (and passing `only`) when masked. */
export function paintLine(p: PixelCanvas, pts: readonly V2[], c: number, only?: (cur: number) => boolean): void {
  for (const [x, y] of pts) {
    const cur = p.get(x, y);
    if (cur === null) continue;
    if (only && !only(cur)) continue;
    p.set(x, y, c);
  }
}
