// Kül Ejderi v3 — the little "deferred" raster pipeline of the drake rig (ashen_drake-rig.ts).
//
// The pipeline itself (G-buffer layers, value-plane quantization, 4-neighbour despeckle, junction
// creases, selective edge paint) is the craft of the aces (see crystal_wyrm-gbuf.ts); what is the
// drake's own here: the frame (a wide, low quadruped), the materials (charcoal hide with a lighter
// mid-tone band so it reads on the navy floor, ember-seamed membrane, ash bone, horn) and the
// seam / crease tables of those ramps.
// Everything here is pure (no Phaser) and deterministic.

import { PixelCanvas } from '../pixel';
import { PAL } from '../palette';

/** Frame of the drake: a wide, low quadruped (nose ~x 126, tail tip ~x 10; ground line at GY). */
export const W = 144;
export const H = 88;
/** Ground line (anchor row): the soles of the planted claws. */
export const GY = 81;
/** Kept for the art file's anchor maths (the frame has no v1 offset). */
export const OX = 0;
export const OY = 0;

export type V = readonly [number, number];

// ------------------------------------------------------------------ vector helpers

export const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: V, k: number): V => [a[0] * k, a[1] * k];
export const lerpV = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const len = (a: V) => Math.hypot(a[0], a[1]);
export const norm = (a: V): V => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};
export const DEG = Math.PI / 180;
export const polar = (deg: number, r: number): V => [Math.cos(deg * DEG) * r, Math.sin(deg * DEG) * r];
export const rotV = (a: V, rad: number): V => [a[0] * Math.cos(rad) - a[1] * Math.sin(rad), a[0] * Math.sin(rad) + a[1] * Math.cos(rad)];
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const rnd = (a: V): V => [Math.round(a[0]), Math.round(a[1])];
export const flo = (a: V): V => [Math.floor(a[0]), Math.floor(a[1])];
export const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1];

// ------------------------------------------------------------------ the key light

type V3 = readonly [number, number, number];
const n3 = (x: number, y: number, z: number): V3 => {
  const m = Math.hypot(x, y, z);
  return [x / m, y / m, z / m];
};
const LIGHT_LEFT = n3(-0.5, -0.74, 0.46);
const LIGHT_RIGHT = n3(0.5, -0.74, 0.46);

/** Current key light (3-D, toward the light) and its screen-plane direction. */
export const LIGHT = { v: LIGHT_LEFT as V3, v2: norm([LIGHT_LEFT[0], LIGHT_LEFT[1]]) as V, side: -1, lift: 0 };

/** 'left' = the frame's top-left (P1 and every default sheet); 'right' = P2 relight. */
export function setLight(from: 'left' | 'right'): void {
  LIGHT.v = from === 'right' ? LIGHT_RIGHT : LIGHT_LEFT;
  LIGHT.v2 = norm([LIGHT.v[0], LIGHT.v[1]]);
  LIGHT.side = from === 'right' ? 1 : -1;
  // the relit side shows the dragon's front, which the body turns a little away from the light:
  // a small lift keeps P2 as bright as P1 (the same character, the same value balance)
  LIGHT.lift = from === 'right' ? 0.1 : 0;
}

/** Mirror an x offset that encodes "toward the light" (authored for the P1 light). */
export const lx = (dx: number) => (LIGHT.side < 0 ? dx : -dx);

// ------------------------------------------------------------------ materials

export interface Mat {
  ramp: number[];
  /** ascending intensity thresholds, length = ramp.length - 1 */
  th: number[];
  /** the pixel's bias IS the ramp index (hand-authored tone levels: glass, head planes) */
  direct?: boolean;
}

export const M = {
  HIDE: 0,
  HIDE_FAR: 1,
  HORN: 2,
  HORN_D: 3,
  MEMB: 4,
  MEMB_FAR: 5,
  MOUTH: 6,
  HIDE_D: 7,
  BONE: 8,
  BONE_FAR: 9,
  EMBER: 10,
  PLATE: 11,
} as const;

export const MATS: Mat[] = [];
// charcoal hide: the lit plane stone3, the mid plane stone2 (the band that reads on the navy floor),
// the shadow plane stone1, the turned-under tone stone0
MATS[M.HIDE] = { ramp: [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3], th: [-0.28, 0.5, 0.98] };
// the far side of the body: one value darker
MATS[M.HIDE_FAR] = { ramp: [PAL.ink, PAL.stone0, PAL.stone1, PAL.stone2], th: [-0.3, 0.45, 1.0] };
// horn / claw: bone-ash bands (direct): 0 root, 1 underside, 2 body, 3 top edge
MATS[M.HORN] = { ramp: [PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4], th: [-0.5, 0.1, 0.62] };
MATS[M.HORN_D] = { ramp: [PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4], th: [], direct: true };
// torn wing skin: wine shadow, burnt brown mid, dull ember lit plane
MATS[M.MEMB] = { ramp: [PAL.crim0, PAL.fire0, PAL.fire1], th: [-0.35, 0.3] };
MATS[M.MEMB_FAR] = { ramp: [PAL.ink, PAL.crim0, PAL.fire0], th: [-0.35, 0.3] };
MATS[M.MOUTH] = { ramp: [PAL.ink, PAL.night0, PAL.fire0], th: [0.3, 0.8] };
// hand-toned hide (head planes): 0 stone0, 1 stone1, 2 stone2, 3 stone3, 4 stone4
MATS[M.HIDE_D] = { ramp: [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4], th: [], direct: true };
// wing bones: one flat mid tone (edges are painted afterwards)
MATS[M.BONE] = { ramp: [PAL.stone1, PAL.stone2, PAL.stone3], th: [-0.2, 0.75] };
MATS[M.BONE_FAR] = { ramp: [PAL.stone0, PAL.stone1, PAL.stone2], th: [-0.2, 0.8] };
// ember: hand-toned (0 fire0 … 4 fire4)
MATS[M.EMBER] = { ramp: [PAL.fire0, PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4], th: [], direct: true };
// dorsal plates: dark, hard-edged (direct 0 ink … 3 stone2)
MATS[M.PLATE] = { ramp: [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3], th: [], direct: true };

function toneOf(m: Mat, i: number): number {
  let k = 0;
  while (k < m.th.length && i >= m.th[k]) k++;
  return k;
}

// ------------------------------------------------------------------ G-buffer layer

export class G {
  mat = new Int8Array(W * H).fill(-1);
  nx = new Float32Array(W * H);
  ny = new Float32Array(W * H);
  nz = new Float32Array(W * H);
  z = new Float32Array(W * H).fill(-1e9);
  bias = new Float32Array(W * H);

  reset(): this {
    this.mat.fill(-1);
    this.z.fill(-1e9);
    this.x0 = W;
    this.y0 = H;
    this.x1 = -1;
    this.y1 = -1;
    return this;
  }

  /** bounding box of the written pixels (render() only walks it) */
  x0 = W;
  y0 = H;
  x1 = -1;
  y1 = -1;

  put(x: number, y: number, mat: number, nx: number, ny: number, nz: number, z: number, bias = 0) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (z < this.z[i]) return;
    if (x < this.x0) this.x0 = x;
    if (x > this.x1) this.x1 = x;
    if (y < this.y0) this.y0 = y;
    if (y > this.y1) this.y1 = y;
    const m = Math.hypot(nx, ny, nz) || 1;
    this.mat[i] = mat;
    this.nx[i] = nx / m;
    this.ny[i] = ny / m;
    this.nz[i] = nz / m;
    this.z[i] = z;
    this.bias[i] = bias;
  }

  /** Light + quantize into a canvas, then despeckle so every tone forms a calm cluster. */
  render(shift = 0, speck = true): PixelCanvas {
    const out = newCanvas();
    const L = LIGHT.v;
    const d = out.data;
    for (let y = this.y0; y <= this.y1; y++)
      for (let x = this.x0, i = y * W + this.x0; x <= this.x1; x++, i++) {
        const mi = this.mat[i];
        if (mi < 0) continue;
        const m = MATS[mi];
        const I = this.nx[i] * L[0] + this.ny[i] * L[1] + this.nz[i] * L[2] + this.bias[i] + shift + LIGHT.lift;
        const k = m.direct ? clamp(Math.round(this.bias[i]), 0, m.ramp.length - 1) : toneOf(m, I);
        const c = m.ramp[k];
        const o = i * 4;
        d[o] = (c >> 16) & 255;
        d[o + 1] = (c >> 8) & 255;
        d[o + 2] = c & 255;
        d[o + 3] = 255;
      }
    if (speck && this.x1 >= 0) despeckle(out, 2, this.x0, this.y0, this.x1, this.y1);
    return out;
  }
}

/**
 * Light quantization leaves crumbs along tone borders. A pixel with no 4-neighbour of its own
 * colour takes the colour its neighbours share most (two passes): planes stay flat clusters.
 */
export function despeckle(c: PixelCanvas, passes = 2, bx0 = 0, by0 = 0, bx1 = W - 1, by1 = H - 1) {
  const d = c.data;
  const col = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return -1;
    const i = (y * W + x) * 4;
    return d[i + 3] ? (d[i] << 16) | (d[i + 1] << 8) | d[i + 2] : -1;
  };
  const vc = new Array<number>(8);
  const vw = new Array<number>(8);
  for (let pass = 0; pass < passes; pass++) {
    const fix: number[] = [];
    for (let y = by0; y <= by1; y++)
      for (let x = bx0; x <= bx1; x++) {
        const c0 = col(x, y);
        if (c0 < 0) continue;
        let same = false;
        let opaque4 = 0;
        let nv = 0;
        for (let dy = -1; dy <= 1 && !same; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const n = col(x + dx, y + dy);
            if (n < 0) continue;
            const four = !(dx && dy);
            if (four) opaque4++;
            if (n === c0) {
              if (four) {
                same = true;
                break;
              }
              continue;
            }
            const w = four ? 2 : 1;
            let k = 0;
            while (k < nv && vc[k] !== n) k++;
            if (k === nv) {
              vc[nv] = n;
              vw[nv++] = w;
            } else vw[k] += w;
          }
        // a 1-px wide sliver at the silhouette (≤1 opaque 4-neighbour) keeps its colour
        if (same || nv === 0 || opaque4 <= 1) continue;
        let best = -1;
        let bv = 0;
        for (let k = 0; k < nv; k++) if (vw[k] > bv) [best, bv] = [vc[k], vw[k]];
        fix.push(x, y, best);
      }
    if (!fix.length) break;
    for (let i = 0; i < fix.length; i += 3) c.set(fix[i], fix[i + 1], fix[i + 2]);
  }
}

// Layers and their canvases are recycled within a frame (allocation was the hot spot at boot).
const G_POOL: G[] = [];
const C_POOL: PixelCanvas[] = [];
let gNext = 0;
let cNext = 0;
export function newG(): G {
  if (gNext >= G_POOL.length) G_POOL.push(new G());
  return G_POOL[gNext++].reset();
}
export function newCanvas(): PixelCanvas {
  if (cNext >= C_POOL.length) C_POOL.push(new PixelCanvas(W, H));
  return C_POOL[cNext++].clear();
}
export function resetPools() {
  gNext = 0;
  cNext = 0;
}

// ------------------------------------------------------------------ primitives

export interface PrimOpt {
  z?: number;
  bias?: number;
  /** extra per-pixel bias of an ellipse: (x, y) = the normalized offset from its centre (-1 … 1, screen axes) */
  biasEll?: (x: number, y: number) => number;
  /** squash of the normal's z (higher = flatter, calmer planes) */
  flat?: number;
}

export function gEll(g: G, c: V, rx: number, ry: number, ang: number, mat: number, o: PrimOpt = {}) {
  const cs = Math.cos(ang);
  const sn = Math.sin(ang);
  const R = Math.max(rx, ry) + 1;
  const z0 = o.z ?? 0;
  const flat = o.flat ?? 1;
  for (let y = Math.floor(c[1] - R); y <= Math.ceil(c[1] + R); y++) {
    for (let x = Math.floor(c[0] - R); x <= Math.ceil(c[0] + R); x++) {
      const dx = x + 0.5 - c[0];
      const dy = y + 0.5 - c[1];
      const lx_ = (dx * cs + dy * sn) / rx;
      const ly_ = (-dx * sn + dy * cs) / ry;
      const d2 = lx_ * lx_ + ly_ * ly_;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      g.put(x, y, mat, lx_ * cs - ly_ * sn, lx_ * sn + ly_ * cs, nz * flat, z0 + nz * Math.min(rx, ry), (o.bias ?? 0) + (o.biasEll ? o.biasEll(dx / rx, dy / ry) : 0));
    }
  }
}

/** Tapered tube along a polyline with cylinder normals (cross-section v: -1 … 1 across). */
export function gTube(g: G, path: V[], w0: number, w1: number, mat: number, o: PrimOpt & { biasAt?: (u: number, v: number, ox: number, oy: number) => number } = {}) {
  if (path.length < 2) return;
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
  for (let y = Math.floor(y0 - R); y <= Math.ceil(y1 + R); y++) {
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
      const d = Math.sqrt(best);
      if (d > r) continue;
      const ox = (px - bqx) / Math.max(r, 0.5);
      const oy = (py - bqy) / Math.max(r, 0.5);
      const o2 = Math.min(1, ox * ox + oy * oy);
      const hz = Math.sqrt(1 - o2);
      const v = clamp(ox * -bty + oy * btx, -1, 1);
      const bias = (o.bias ?? 0) + (o.biasAt ? o.biasAt(bu / total, v, ox, oy) : 0);
      g.put(x, y, mat, ox, oy, hz * flat, z0 + hz * r, bias);
    }
  }
}

/** Scanline polygon fill sampled at pixel centers; calls cb for every covered pixel. */
export function fillPoly(pts: readonly V[], cb: (x: number, y: number) => void) {
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
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) cb(x, y);
    }
  }
}

export const FLAT_N = [0, 0, 1] as const;

export function gFacet(g: G, pts: readonly V[], mat: number, n: readonly [number, number, number], z = 0, bias: number | ((x: number, y: number) => number) = 0) {
  fillPoly(pts, (x, y) => g.put(x, y, mat, n[0], n[1], n[2], z, typeof bias === 'number' ? bias : bias(x, y)));
}

/**
 * Faceted crystal shard, two values: the facet that faces the key light takes the bright tone
 * (cyan4), the other the deep tone (cyan2); `glow` ≥ 0.75 lifts both one step. Small shards are
 * one flat tone (two tones on a 3-pixel shard is just noise).
 */
export function gShard(g: G, base: V, dir: V, length: number, hw: number, mat: number, z = 0, glow = 0) {
  const d = norm(dir);
  const p: V = [-d[1], d[0]];
  const tip = add(base, mul(d, length));
  const b0 = sub(base, mul(d, 2));
  const l = add(b0, mul(p, hw));
  const r = sub(b0, mul(p, hw));
  const up = glow >= 0.75 ? 1 : 0;
  if (length < 4.6) {
    gFacet(g, [l, tip, r], mat, FLAT_N, z, 2 + up);
    return;
  }
  const sl = add(add(base, mul(p, hw * 0.85)), mul(d, length * 0.45));
  const sr = add(sub(base, mul(p, hw * 0.85)), mul(d, length * 0.45));
  const lit1 = dot(p, LIGHT.v2) > 0;
  gFacet(g, [l, sl, tip, b0], mat, FLAT_N, z, (lit1 ? 3 : 1) + up);
  gFacet(g, [b0, tip, sr, r], mat, FLAT_N, z, (lit1 ? 1 : 3) + up);
}

// ------------------------------------------------------------------ compositing

/** One step down the ramp: the 1-px contact seam. */
const SEAM: Record<number, number> = {
  [PAL.stone4]: PAL.stone2,
  [PAL.stone3]: PAL.stone1,
  [PAL.stone2]: PAL.stone1,
  [PAL.stone1]: PAL.stone0,
  [PAL.stone0]: PAL.ink,
  [PAL.fire4]: PAL.fire2,
  [PAL.fire3]: PAL.fire1,
  [PAL.fire2]: PAL.fire1,
  [PAL.fire1]: PAL.fire0,
  [PAL.fire0]: PAL.ink,
  [PAL.crim0]: PAL.ink,
};
/** Junction crease: hide folds into the next darker tone, two steps for the light ones. */
const CREASE: Record<number, number> = {
  [PAL.stone4]: PAL.stone1,
  [PAL.stone3]: PAL.stone1,
  [PAL.stone2]: PAL.stone0,
  [PAL.stone1]: PAL.stone0,
  [PAL.stone0]: PAL.ink,
  [PAL.fire4]: PAL.fire1,
  [PAL.fire3]: PAL.fire1,
  [PAL.fire2]: PAL.fire0,
  [PAL.fire1]: PAL.fire0,
  [PAL.fire0]: PAL.ink,
  [PAL.crim0]: PAL.ink,
};
export type SeamFn = (x: number, y: number, behind: number) => number;
export const selout: SeamFn = (_x, _y, c) => SEAM[c] ?? PAL.ink;
export const crease: SeamFn = (_x, _y, c) => CREASE[c] ?? PAL.ink;

/** Width of a junction crease (px) above, beside and under the front part. */
export interface Fold {
  top: number;
  side: number;
  bottom: number;
}
export const FOLD1: Fold = { top: 1, side: 1, bottom: 1 };

/**
 * Blit a layer. The surface already drawn right around its edge becomes a seam / crease band
 * (`fold` widths: above / beside / under the layer); over empty space nothing is added — the
 * single silhouette contour comes from the final p.outline(PAL.ink).
 */
export function composite(dst: PixelCanvas, layer: PixelCanvas, seam: SeamFn = selout, fold: Fold = FOLD1) {
  const lw = layer.w;
  const lh = layer.h;
  const la = layer.data;
  let x0 = lw;
  let y0 = lh;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < lh; y++)
    for (let x = 0, i = y * lw * 4 + 3; x < lw; x++, i += 4)
      if (la[i]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return;
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < lw && y < lh && la[(y * lw + x) * 4 + 3] > 0;
  const edge: number[] = [];
  const reach = Math.max(fold.top, fold.side, fold.bottom);
  for (let y = Math.max(0, y0 - reach); y <= Math.min(lh - 1, y1 + reach); y++)
    for (let x = Math.max(0, x0 - reach); x <= Math.min(lw - 1, x1 + reach); x++) {
      if (la[(y * lw + x) * 4 + 3] > 0) continue;
      if (!dst.isOpaque(x, y)) continue;
      let hit = op(x - 1, y) || op(x + 1, y) || (fold.bottom > 0 && op(x, y - 1)) || (fold.top > 0 && op(x, y + 1));
      // wider bands: the layer lies below this pixel (top band), beside it, or above it (bottom band)
      for (let k = 2; !hit && k <= fold.top; k++) hit = op(x, y + k);
      for (let k = 2; !hit && k <= fold.side; k++) hit = op(x - k, y) || op(x + k, y) || op(x - k + 1, y + 1) || op(x + k - 1, y + 1);
      for (let k = 2; !hit && k <= fold.bottom; k++) hit = op(x, y - k) || op(x - 1, y - k + 1) || op(x + 1, y - k + 1);
      if (hit) edge.push(x, y);
    }
  for (let i = 0; i < edge.length; i += 2) {
    const x = edge[i];
    const y = edge[i + 1];
    layer.set(x, y, seam(x, y, dst.get(x, y)!));
  }
  // opaque copy (layers never carry partial alpha)
  const dw = dst.w;
  const dd = dst.data;
  for (let y = Math.max(0, y0 - reach); y <= Math.min(lh - 1, dst.h - 1, y1 + reach); y++)
    for (let x = Math.max(0, x0 - reach); x <= Math.min(lw - 1, dw - 1, x1 + reach); x++) {
      const si = (y * lw + x) * 4;
      if (la[si + 3] === 0) continue;
      const di = (y * dw + x) * 4;
      dd[di] = la[si];
      dd[di + 1] = la[si + 1];
      dd[di + 2] = la[si + 2];
      dd[di + 3] = 255;
    }
}

/** Mark a layer's opaque pixels in a mask. */
export function maskOf(c: PixelCanvas, into: Uint8Array) {
  into.fill(0);
  for (let i = 0; i < W * H; i++) if (c.data[i * 4 + 3]) into[i] = 1;
}

/** 1px Bresenham line painted only over a layer's opaque pixels (optionally only over `only`). */
export function lineOn(c: PixelCanvas, a: V, b: V, col: number, only?: (cur: number) => boolean) {
  let [x0, y0] = flo(a);
  const [x1, y1] = flo(b);
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

/** Outward normal of a layer pixel from its transparent 8-neighbours (0,0 when interior). */
export function edgeNormal(c: PixelCanvas, x: number, y: number, open: (x: number, y: number) => boolean = (a, b) => !c.isOpaque(a, b)): V {
  let nx = 0;
  let ny = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      if (open(x + dx, y + dy)) {
        const w = dx && dy ? 0.7 : 1;
        nx += dx * w;
        ny += dy * w;
      }
    }
  return [nx, ny];
}

/**
 * Selective edge paint: every pixel of `c` on its own silhouette (4-neighbour test) whose outward
 * facing (dotted with the light's screen direction) is ≥ `lit` gets `hi`, ≤ `dark` gets `lo`
 * (null = leave). `only` filters the pixels touched.
 */
export function edgePaint(c: PixelCanvas, hi: number | null, lo: number | null, o: { lit?: number; dark?: number; only?: (cur: number) => boolean; open?: (x: number, y: number) => boolean } = {}) {
  const lit = o.lit ?? 0.35;
  const dark = o.dark ?? -0.35;
  const open = o.open ?? ((x: number, y: number) => !c.isOpaque(x, y));
  const hits: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const cur = c.get(x, y);
      if (cur === null) continue;
      if (!(open(x - 1, y) || open(x + 1, y) || open(x, y - 1) || open(x, y + 1))) continue;
      if (o.only && !o.only(cur)) continue;
      const n = norm(edgeNormal(c, x, y, open));
      const f = dot(n, LIGHT.v2);
      if (f >= lit && hi !== null) hits.push(x, y, hi);
      else if (f <= dark && lo !== null) hits.push(x, y, lo);
    }
  for (let i = 0; i < hits.length; i += 3) c.set(hits[i], hits[i + 1], hits[i + 2]);
}

/**
 * Reflected light on the shadow-side silhouette of the hide (the edges facing
 * away from the key light and down): one continuous line, only where the edge faces empty
 * space.
 */
export function rimLight(c: PixelCanvas, dst: PixelCanvas, cols: readonly number[] = [PAL.stone0, PAL.stone1, PAL.stone2], rim = PAL.fire1, only?: (x: number, y: number) => boolean) {
  const d = c.data;
  const inL = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 0;
  const open = (x: number, y: number) => !inL(x, y) && !dst.isOpaque(x, y);
  const s = -LIGHT.side; // the shadow side: +1 = right (P1 light from the left)
  const hits: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!inL(x, y)) continue;
      // the diagonal corner too: on a staircase contour the rim stays one continuous line
      if (!(open(x + s, y) || open(x, y + 1) || open(x + s, y + 1))) continue;
      if (!inL(x - s, y) || !inL(x, y - 1)) continue;
      const col = c.get(x, y)!;
      if (cols.includes(col) && (!only || only(x, y))) hits.push(x, y);
    }
  for (let i = 0; i < hits.length; i += 2) c.set(hits[i], hits[i + 1], rim);
}

/**
 * The crystal glint on a facet vertex: size 1 = the vertex pixel alone (white), size 2 = a 3-px
 * cross (the white vertex + four white 1-px arms). Only over the body (never into the air, never
 * over the outline).
 */
export function twinkle(p: PixelCanvas, at: V, size: number) {
  const put = (dx: number, dy: number) => {
    const x = at[0] + dx;
    const y = at[1] + dy;
    const cur = p.get(x, y);
    if (cur === null || cur === PAL.ink) return;
    p.set(x, y, PAL.white);
  };
  put(0, 0);
  if (size >= 2) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(dx, dy);
}

export function distSeg(p: V, a: V, b: V): number {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const t = clamp(((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / (abx * abx + aby * aby || 1), 0, 1);
  return Math.hypot(p[0] - a[0] - abx * t, p[1] - a[1] - aby * t);
}

export function distPoly(p: V, pts: readonly V[]): number {
  let d = Infinity;
  for (let i = 1; i < pts.length; i++) d = Math.min(d, distSeg(p, pts[i - 1], pts[i]));
  return d;
}

/** Arc-length parameter (0..1) of the point of a polyline nearest to p. */
export function pathU(path: readonly V[], p: V): number {
  let best = Infinity;
  let bu = 0;
  let acc = 0;
  let total = 0;
  for (let i = 1; i < path.length; i++) total += len(sub(path[i], path[i - 1]));
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const s = sub(path[i], a);
    const sl = len(s) || 1;
    const t = clamp(((p[0] - a[0]) * s[0] + (p[1] - a[1]) * s[1]) / (sl * sl), 0, 1);
    const d = Math.hypot(p[0] - a[0] - s[0] * t, p[1] - a[1] - s[1] * t);
    if (d < best) {
      best = d;
      bu = acc + sl * t;
    }
    acc += sl;
  }
  return bu / (total || 1);
}

export function samplePath(path: readonly V[], t: number): { p: V; tan: V } {
  const lens = [0];
  for (let i = 1; i < path.length; i++) lens.push(lens[i - 1] + len(sub(path[i], path[i - 1])));
  const target = t * lens[lens.length - 1];
  for (let i = 1; i < path.length; i++) {
    if (lens[i] >= target || i === path.length - 1) {
      const seg = lens[i] - lens[i - 1] || 1;
      const k = clamp((target - lens[i - 1]) / seg, 0, 1);
      return { p: lerpV(path[i - 1], path[i], k), tan: norm(sub(path[i], path[i - 1])) };
    }
  }
  return { p: path[0], tan: [1, 0] };
}

export function ik(a: V, b: V, l1: number, l2: number, sign: number): V {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01);
  const c = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const ang = Math.atan2(dy, dx) + sign * Math.acos(c);
  return [a[0] + Math.cos(ang) * l1, a[1] + Math.sin(ang) * l1];
}

/** The dorsal side of a tangent (the side facing up-back, where the crest grows). */
export function dorsal(t: V): V {
  const a: V = [-t[1], t[0]];
  const b: V = [t[1], -t[0]];
  const ref: V = [-0.45, -0.89];
  return a[0] * ref[0] + a[1] * ref[1] > b[0] * ref[0] + b[1] * ref[1] ? a : b;
}
