// Art Lab A — dragon rig renderer (owned by the variant-A dragon; nothing else imports it).
//
// A frame is built from a few LAYERS painted back to front (far wing, tail, far legs, body, near
// legs, neck, near wing, head...). Each layer is a tiny G-buffer: rounded primitives (ellipsoids,
// tapered tubes) write a material, a light value and a depth (z-union, so overlapping primitives
// merge like clay); flat crystal facets write a hand-chosen tone directly. The layer is then
// quantized onto the material's ramp with hand-tuned bands (no dithering), cleaned of lonely
// pixels (ONLY this automatic base is cleaned — details painted afterwards are never touched),
// detailed by hand (spots, claws, the face stamp...) and composited with a contact seam: where a
// layer covers the layers below, the pixels just outside it are pushed one or two steps down
// their own ramp (a coloured interior line, darker on the shadow side). The silhouette gets one
// SELECTIVE coloured outline at the very end: a soft tinted line on the lit (top-left) edges, deep
// navy / plum on the shadow side and on the ground contact.

import { PixelCanvas } from '../../art/pixel';

export type V2 = readonly [number, number];

export const DEG = Math.PI / 180;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const polar = (deg: number, r: number): V2 => [Math.cos(deg * DEG) * r, Math.sin(deg * DEG) * r];
export const addV = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
export const lerpV = (a: V2, b: V2, t: number): V2 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

/** Key light: top-left, toward the viewer (sunset fill is warm, but the key stays readable). */
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

/** Register single colours (eye ink, claws...) with explicit outline colours. */
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
  tube(path: readonly V2[], r0: number, r1: number, mat: number, zc = 0, bias = 0): this {
    if (path.length === 0) return this;
    const lens = [0];
    for (let i = 1; i < path.length; i++) lens.push(lens[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    const total = lens[lens.length - 1] || 1;
    if (path.length === 1) return this.ellipsoid(path[0][0], path[0][1], r0, r0, mat, zc, bias);
    for (let i = 1; i < path.length; i++) {
      const [ax, ay] = path[i - 1];
      const [bx, by] = path[i];
      const seg = lens[i] - lens[i - 1];
      const steps = Math.max(1, Math.ceil(seg * 2));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const d = lens[i - 1] + seg * t;
        const r = lerp(r0, r1, d / total);
        this.ellipsoid(ax + (bx - ax) * t, ay + (by - ay) * t, r, r, mat, zc, bias);
      }
    }
    return this;
  }

  /** Flat facet with a hand-chosen tone index (direct materials) or light value. */
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
    // despeckle (base only): a tone pixel with no same-tone 4-neighbour inside the same material
    // takes the most common neighbouring tone.
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
 */
export function composite(
  base: PixelCanvas,
  top: PixelCanvas,
  litSteps = 1,
  shadeSteps = 2,
  cast?: { dx: number; dy: number; steps?: number },
  /** only base colours passing this test get the contact seam (default: all) */
  seamOn?: (c: number) => boolean,
): void {
  const { w, h } = base;
  if (cast) {
    // cast shadow: base pixels the covering part would hide if shifted by (dx, dy)
    const changes: [number, number, number][] = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (top.isOpaque(x, y) || !top.isOpaque(x - cast.dx, y - cast.dy)) continue;
        const c = base.get(x, y);
        if (c !== null) changes.push([x, y, stepColor(c, -(cast.steps ?? 1))]);
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
        // which side of `top` is this pixel on?
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
 * deep ink, the lit side (sprite below / right of the pixel) the soft tinted line.
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
  // one outline colour per run: an outline pixel whose colour no neighbouring outline pixel shares
  // (the lit / ink choice flipping on a jagged edge) takes the colour of its outline neighbours
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

/** Stamp an ASCII map; `mask` limits it to pixels already opaque in that canvas. */
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
