// Kristal Ejder (crystal_wyrm) — LIGHT ace dragon, the poster monster. 96×96, faces right.
//
// Built as a small parametric rig rendered through a tiny "deferred" pipeline:
//   1. every body part is rasterized into its own G-buffer layer as primitives that carry a
//      surface normal (ellipsoids, tapered tubes, flat crystal facets) and a depth (z-union
//      inside the layer, so overlapping primitives merge like clay);
//   2. each layer is lit with one top-left key light and quantized onto hand-picked palette
//      ramps per material (crystal hide, gold, glowing crystal, wing glass, mouth);
//   3. hand-placed details (eyes, teeth, veins, glints) are painted on top, the layer gets
//      its own 1px ink contour and is composited back-to-front.
// A pose is a set of numbers (hip offset, torso lean, head position/angle, jaw, wing angles,
// tail phase, energy glow...). Every animation frame is a pose, so proportions never drift.

import type { MonsterAnim, MonsterArt } from '../types';
import { PixelCanvas, bezier } from '../pixel';
import { PAL } from '../palette';

const W = 96;
const H = 96;

type V = readonly [number, number];

// ------------------------------------------------------------------ vector helpers

const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k];
const lerpV = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const len = (a: V) => Math.hypot(a[0], a[1]);
const norm = (a: V): V => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};
const DEG = Math.PI / 180;
const polar = (deg: number, r: number): V => [Math.cos(deg * DEG) * r, Math.sin(deg * DEG) * r];
const rotV = (a: V, rad: number): V => [a[0] * Math.cos(rad) - a[1] * Math.sin(rad), a[0] * Math.sin(rad) + a[1] * Math.cos(rad)];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rnd = (a: V): V => [Math.round(a[0]), Math.round(a[1])];

function hash2(i: number, j: number): number {
  let h = (i * 374761393 + j * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Cut-crystal plates: a jittered Voronoi tiling expressed in a part's local frame (so the
 * facets ride with the body instead of swimming). Each plate tilts the light a little, and the
 * seams between plates catch a thin highlight.
 */
function crystalPlates(origin: V, ang: number, cell: number, amp: number, seed: number, seamK = 0) {
  const cs = Math.cos(-ang);
  const sn = Math.sin(-ang);
  return (x: number, y: number): number => {
    const dx = x + 0.5 - origin[0];
    const dy = y + 0.5 - origin[1];
    const gx = (dx * cs - dy * sn) / cell;
    const gy = (dx * sn + dy * cs) / cell;
    const ci = Math.floor(gx);
    const cj = Math.floor(gy);
    let d1 = Infinity;
    let d2 = Infinity;
    let id = 0;
    for (let j = cj - 1; j <= cj + 1; j++)
      for (let i = ci - 1; i <= ci + 1; i++) {
        const sx = i + 0.2 + 0.6 * hash2(i + seed, j);
        const sy = j + 0.2 + 0.6 * hash2(i, j + seed * 7);
        const d = (gx - sx) * (gx - sx) + (gy - sy) * (gy - sy);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          id = hash2(i * 3 + seed, j * 5);
        } else if (d < d2) d2 = d;
      }
    const seam = Math.sqrt(d2) - Math.sqrt(d1) < 0.12;
    return (id - 0.5) * amp + (seam ? seamK * amp : 0);
  };
}

// ------------------------------------------------------------------ materials

// Key light from the top-left, slightly toward the viewer.
const LIGHT = (() => {
  const l = [-0.5, -0.74, 0.46];
  const m = Math.hypot(l[0], l[1], l[2]);
  return [l[0] / m, l[1] / m, l[2] / m] as const;
})();
// Blinn half vector (viewer at +z) for crystal glints.
const HALF = (() => {
  const h = [LIGHT[0], LIGHT[1], LIGHT[2] + 1];
  const m = Math.hypot(h[0], h[1], h[2]);
  return [h[0] / m, h[1] / m, h[2] / m] as const;
})();

interface Mat {
  ramp: number[];
  /** ascending intensity thresholds, length = ramp.length - 1 */
  th: number[];
  /** specular threshold on N·H → brightest tone */
  spec?: number;
  /** the pixel's bias IS the ramp index (hand-authored tone levels, e.g. wing glass) */
  direct?: boolean;
}

const M = {
  HIDE: 0,
  HIDE_FAR: 1,
  GOLD: 2,
  GOLD_FAR: 3,
  CRYS: 4,
  CRYS_FAR: 5,
  GLASS: 6,
  GLASS_FAR: 7,
  MOUTH: 8,
  CLAW: 9,
  CLAW_FAR: 10,
  BELLY: 11,
} as const;

const MATS: Mat[] = [];
MATS[M.HIDE] = { ramp: [PAL.night2, PAL.night3, PAL.steel, PAL.mist, PAL.white], th: [-0.6, -0.25, 0.12, 0.58] };
MATS[M.HIDE_FAR] = { ramp: [PAL.night1, PAL.night2, PAL.night3, PAL.steel, PAL.mist], th: [-0.55, -0.15, 0.22, 0.7] };
MATS[M.GOLD] = { ramp: [PAL.gold0, PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4], th: [-0.6, -0.2, 0.15, 0.6] };
MATS[M.GOLD_FAR] = { ramp: [PAL.gold0, PAL.gold0, PAL.gold1, PAL.gold2, PAL.gold3], th: [-0.55, -0.1, 0.3, 0.78] };
MATS[M.CRYS] = { ramp: [PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white], th: [], direct: true };
MATS[M.CRYS_FAR] = { ramp: [PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4], th: [], direct: true };
MATS[M.GLASS] = { ramp: [PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white], th: [], direct: true };
MATS[M.GLASS_FAR] = { ramp: [PAL.night1, PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4], th: [], direct: true };
MATS[M.MOUTH] = { ramp: [PAL.night0, PAL.night1, PAL.crim1], th: [0.3, 0.8] };
MATS[M.CLAW] = { ramp: [PAL.night3, PAL.steel, PAL.mist, PAL.white], th: [-0.2, 0.3, 0.75] };
MATS[M.CLAW_FAR] = { ramp: [PAL.night2, PAL.night3, PAL.steel, PAL.mist], th: [-0.2, 0.3, 0.75] };
MATS[M.BELLY] = { ramp: [PAL.night2, PAL.night3, PAL.steel, PAL.mist, PAL.white], th: [-0.35, 0.05, 0.45, 0.9] };

function toneOf(m: Mat, i: number): number {
  let k = 0;
  while (k < m.th.length && i >= m.th[k]) k++;
  return k;
}

// ------------------------------------------------------------------ G-buffer layer

class G {
  mat = new Int8Array(W * H).fill(-1);
  reset(): this {
    this.mat.fill(-1);
    this.z.fill(-1e9);
    return this;
  }
  nx = new Float32Array(W * H);
  ny = new Float32Array(W * H);
  nz = new Float32Array(W * H);
  z = new Float32Array(W * H).fill(-1e9);
  bias = new Float32Array(W * H);
  /** free per-pixel tags for detail passes (e.g. tube u / v) */
  u = new Float32Array(W * H);
  v = new Float32Array(W * H);

  put(x: number, y: number, mat: number, nx: number, ny: number, nz: number, z: number, bias = 0, u = 0, v = 0) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (z < this.z[i]) return;
    const m = Math.hypot(nx, ny, nz) || 1;
    this.mat[i] = mat;
    this.nx[i] = nx / m;
    this.ny[i] = ny / m;
    this.nz[i] = nz / m;
    this.z[i] = z;
    this.bias[i] = bias;
    this.u[i] = u;
    this.v[i] = v;
  }

  /** Light + quantize into a canvas. `toneShift` lets callers nudge whole layers (energy glow). */
  render(shift = 0, tint?: (x: number, y: number, mat: number) => number): PixelCanvas {
    const out = newCanvas();
    for (let i = 0; i < W * H; i++) {
      const mi = this.mat[i];
      if (mi < 0) continue;
      const m = MATS[mi];
      const nx = this.nx[i];
      const ny = this.ny[i];
      const nz = this.nz[i];
      let I = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2] + this.bias[i] + shift;
      if (tint) I += tint(i % W, Math.floor(i / W), mi);
      let k = m.direct ? clamp(Math.round(this.bias[i] + (tint ? tint(i % W, Math.floor(i / W), mi) : 0)), 0, m.ramp.length - 1) : toneOf(m, I);
      if (m.spec !== undefined && nx * HALF[0] + ny * HALF[1] + nz * HALF[2] > m.spec) k = m.ramp.length - 1;
      out.set(i % W, Math.floor(i / W), m.ramp[k]);
    }
    return out;
  }
}

// Layers and their canvases are recycled within a frame (allocation was the hot spot at boot).
const G_POOL: G[] = [];
const C_POOL: PixelCanvas[] = [];
let gNext = 0;
let cNext = 0;
function newG(): G {
  if (gNext >= G_POOL.length) G_POOL.push(new G());
  return G_POOL[gNext++].reset();
}
function newCanvas(): PixelCanvas {
  if (cNext >= C_POOL.length) C_POOL.push(new PixelCanvas(W, H));
  return C_POOL[cNext++].clear();
}
function resetPools() {
  gNext = 0;
  cNext = 0;
}

interface PrimOpt {
  z?: number;
  bias?: number;
  /** squash of the normal's z (lower = flatter / more contrast at the rims) */
  flat?: number;
  /** quantize the cylinder normal into this many facets (crystal look) */
  facets?: number;
  /** ventral plates: pixels with v > from get lighter plates separated by grooves every `period` px */
  plates?: { from: number; period: number };
  /** extra per-pixel brightness (surface texture that rides with the part) */
  tex?: (x: number, y: number) => number;
}

function gEll(g: G, c: V, rx: number, ry: number, ang: number, mat: number, o: PrimOpt = {}) {
  const cs = Math.cos(ang);
  const sn = Math.sin(ang);
  const R = Math.max(rx, ry) + 1;
  const z0 = o.z ?? 0;
  const flat = o.flat ?? 1;
  for (let y = Math.floor(c[1] - R); y <= Math.ceil(c[1] + R); y++) {
    for (let x = Math.floor(c[0] - R); x <= Math.ceil(c[0] + R); x++) {
      const dx = x + 0.5 - c[0];
      const dy = y + 0.5 - c[1];
      const lx = (dx * cs + dy * sn) / rx;
      const ly = (-dx * sn + dy * cs) / ry;
      const d2 = lx * lx + ly * ly;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      let qx = lx;
      let qy = ly;
      let qz = nz;
      if (o.facets) {
        // gem cut: a table facet in the middle and a ring of crown facets around it
        const r = Math.sqrt(d2);
        const step = (Math.PI * 2) / o.facets;
        const th = (Math.floor(Math.atan2(ly, lx) / step) + 0.5) * step;
        const rq = r < 0.5 ? 0.15 : r < 0.85 ? 0.62 : 0.9;
        qx = Math.cos(th) * rq;
        qy = Math.sin(th) * rq;
        qz = Math.sqrt(1 - rq * rq);
      }
      g.put(x, y, mat, qx * cs - qy * sn, qx * sn + qy * cs, qz * flat, z0 + nz * Math.min(rx, ry), (o.bias ?? 0) + (o.tex ? o.tex(x, y) : 0));
    }
  }
}

/** Tapered tube along a polyline with cylinder normals. u = arc length, v = signed offset (-1..1). */
function gTube(g: G, path: V[], w0: number, w1: number, mat: number, o: PrimOpt = {}) {
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
      // signed cross-section coordinate (perp = (-ty, tx))
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
      let bias = (o.bias ?? 0) + (o.tex ? o.tex(x, y) : 0);
      if (o.plates && v > o.plates.from) {
        bias += 0.16;
        if (bu % o.plates.period < 1) bias -= 0.5;
      }
      g.put(x, y, mat, nx, ny, nz, z0 + hz * r, bias, bu / total, v);
    }
  }
}

/** Scanline polygon fill sampled at pixel centers; calls cb for every covered pixel. */
function fillPoly(pts: V[], cb: (x: number, y: number) => void) {
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

function gFacet(g: G, pts: V[], mat: number, n: readonly [number, number, number], z = 0, bias: number | ((x: number, y: number) => number) = 0) {
  fillPoly(pts, (x, y) => g.put(x, y, mat, n[0], n[1], n[2], z, typeof bias === 'number' ? bias : bias(x, y)));
}

/** Faceted crystal shard: base → tip along dir, two facets split down the ridge. */
/**
 * Faceted crystal shard: base → tip along dir, two facets split down the ridge. The facet that
 * faces the key light takes the bright tone, the other the deep tone; `glow` (0..1) lifts both.
 */
function gShard(g: G, base: V, dir: V, length: number, hw: number, mat: number, z = 0, glow = 0) {
  const d = norm(dir);
  const p: V = [-d[1], d[0]];
  const tip = add(base, mul(d, length));
  const b0 = sub(base, mul(d, 2));
  const l = add(b0, mul(p, hw));
  const r = sub(b0, mul(p, hw));
  const sl = add(add(base, mul(p, hw * 0.85)), mul(d, length * 0.45));
  const sr = add(sub(base, mul(p, hw * 0.85)), mul(d, length * 0.45));
  const lit1 = p[0] * LIGHT[0] + p[1] * LIGHT[1] > 0;
  const up = glow >= 0.75 ? 1 : 0;
  const n: [number, number, number] = [0, 0, 1];
  gFacet(g, [l, sl, tip, b0], mat, n, z, (lit1 ? 3 : 1) + up);
  gFacet(g, [b0, tip, sr, r], mat, n, z, (lit1 ? 1 : 3) + up);
}

// ------------------------------------------------------------------ pose

interface Wing {
  /** humerus angle (deg, screen space) */
  a1: number;
  /** forearm angle */
  a2: number;
  /** first (outer) finger angle */
  a3: number;
  /** finger fan step (deg); sign picks the fan direction */
  fan: number;
}

interface Pose {
  hx: number;
  hy: number;
  /** torso rotation around the hip (rad, negative = rear up) */
  lean: number;
  /** head pivot offset from its neutral spot (relative to the chest) */
  headX: number;
  headY: number;
  /** head angle (rad, + = nose down) */
  ha: number;
  /** 0..1 */
  jaw: number;
  nw: Wing;
  fw: Wing;
  /** tail sway phase (0..1) and amplitude (deg) */
  tail: number;
  tailAmp: number;
  /** extra tail curl (deg, + lifts the tip) */
  tailLift: number;
  /** arm raise (deg) */
  arm: number;
  /** 0..1 energy in veins / spikes */
  glow: number;
  /** 0..1 light gathered in the mouth */
  mouth: number;
  /** 1 open, 0 squeezed shut (hit) */
  eye: number;
  /** guard: wings wrapped forward (selects the shield wing layout) */
  guard: boolean;
  /** glint sweep position across the wing glass (0..1, <0 = none) */
  glint: number;
  /** crystal twinkles: [anchor index, size 1|2] (anchors: 0/1/3 near-wing glass, 2 far wing, 4 tail) */
  sparkles: [number, number][];
}

const NEUTRAL: Pose = {
  hx: 0,
  hy: 0,
  lean: 0,
  headX: 0,
  headY: 0,
  ha: 0.12,
  jaw: 0,
  nw: { a1: -108, a2: -138, a3: -118, fan: -40 },
  fw: { a1: -84, a2: -110, a3: -92, fan: -28 },
  tail: 0,
  tailAmp: 4,
  tailLift: 0,
  arm: 0,
  glow: 0.3,
  mouth: 0,
  eye: 1,
  guard: false,
  glint: -1,
  sparkles: [],
};

type PoseDelta = Partial<Omit<Pose, 'nw' | 'fw'>> & { nw?: Partial<Wing>; fw?: Partial<Wing> };

function pose(d: PoseDelta): Pose {
  return { ...NEUTRAL, ...d, nw: { ...NEUTRAL.nw, ...(d.nw ?? {}) }, fw: { ...NEUTRAL.fw, ...(d.fw ?? {}) } };
}

// ------------------------------------------------------------------ skeleton

const NEAR_FINGERS = [19.5, 22.5, 19];
const FAR_FINGERS = [17, 15.5, 12];

interface WingRig {
  S: V;
  E: V;
  Wr: V;
  tips: V[];
  attach: V;
}

const MARGIN = 2.5;

/** Keep a point reached from `from` inside the frame by shortening the reach (soft safety for wind-ups). */
function keepIn(from: V, to: V): V {
  let k = 1;
  const d = sub(to, from);
  if (to[0] < MARGIN && d[0] < 0) k = Math.min(k, (from[0] - MARGIN) / -d[0]);
  if (to[1] < MARGIN && d[1] < 0) k = Math.min(k, (from[1] - MARGIN) / -d[1]);
  if (to[0] > W - 1 - MARGIN && d[0] > 0) k = Math.min(k, (W - 1 - MARGIN - from[0]) / d[0]);
  return add(from, mul(d, clamp(k, 0, 1)));
}

function wingRig(S: V, w: Wing, fingers: number[], l1: number, l2: number, attach: V): WingRig {
  const E = add(S, polar(w.a1, l1));
  const Wr = add(E, polar(w.a2, l2));
  const tips = fingers.map((fl, i) => keepIn(Wr, add(Wr, polar(w.a3 + w.fan * i, fl))));
  return { S, E, Wr, tips, attach };
}

function ik(a: V, b: V, l1: number, l2: number, sign: number): V {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01);
  const c = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const ang = Math.atan2(dy, dx) + sign * Math.acos(c);
  return [a[0] + Math.cos(ang) * l1, a[1] + Math.sin(ang) * l1];
}

function dorsal(t: V): V {
  const a: V = [-t[1], t[0]];
  const b: V = [t[1], -t[0]];
  const ref: V = [-0.45, -0.89];
  return a[0] * ref[0] + a[1] * ref[1] > b[0] * ref[0] + b[1] * ref[1] ? a : b;
}

function samplePath(path: V[], t: number): { p: V; tan: V } {
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

// ------------------------------------------------------------------ compositing helpers

/**
 * Outline the layer and blit it. Where the contour falls over something already drawn it uses
 * `inner` (a softer internal line); over empty space it is the ink silhouette.
 */
function composite(dst: PixelCanvas, layer: PixelCanvas, inner: number = PAL.ink) {
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
  for (let y = Math.max(0, y0 - 1); y <= Math.min(lh - 1, y1 + 1); y++)
    for (let x = Math.max(0, x0 - 1); x <= Math.min(lw - 1, x1 + 1); x++) {
      if (la[(y * lw + x) * 4 + 3] > 0) continue;
      if (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1)) edge.push(x, y);
    }
  for (let i = 0; i < edge.length; i += 2) {
    const x = edge[i];
    const y = edge[i + 1];
    layer.set(x, y, dst.isOpaque(x, y) ? inner : PAL.ink);
  }
  // opaque copy (layers never carry partial alpha)
  const dw = dst.w;
  const dd = dst.data;
  for (let y = Math.max(0, y0 - 1); y <= Math.min(lh - 1, dst.h - 1, y1 + 1); y++)
    for (let x = Math.max(0, x0 - 1); x <= Math.min(lw - 1, dw - 1, x1 + 1); x++) {
      const si = (y * lw + x) * 4;
      if (la[si + 3] === 0) continue;
      const di = (y * dw + x) * 4;
      dd[di] = la[si];
      dd[di + 1] = la[si + 1];
      dd[di + 2] = la[si + 2];
      dd[di + 3] = 255;
    }
}

/** paint a pixel only over this layer's opaque pixels */
function dot(c: PixelCanvas, p: V, col: number) {
  c.paint(Math.floor(p[0]), Math.floor(p[1]), col);
}

/**
 * Cool reflected light from the arena on the shadow-side rim (bottom-right) of the crystal hide:
 * the last dark pixel before the contour turns teal, which makes the body read as glassy.
 */
function rimLight(c: PixelCanvas) {
  const d = c.data;
  const a = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) a[i] = d[i * 4 + 3] > 0 ? 1 : 0;
  const open = (x: number, y: number) => x < 0 || y < 0 || x >= W || y >= H || a[y * W + x] === 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!a[y * W + x]) continue;
      if (!(open(x + 1, y + 1) && (open(x + 1, y) || open(x, y + 1)) && !open(x - 1, y - 1))) continue;
      const col = c.get(x, y);
      if (col === PAL.night3 || col === PAL.night2) c.set(x, y, PAL.cyan2);
      else if (col === PAL.steel) c.set(x, y, PAL.cyan3);
    }
}

/** 4-point star glint drawn only over the body (never spills past the silhouette). */
function twinkle(p: PixelCanvas, at: V, size: number) {
  const put = (dx: number, dy: number, col: number) => {
    const x = at[0] + dx;
    const y = at[1] + dy;
    const cur = p.get(x, y);
    if (cur !== null && cur !== PAL.ink) p.set(x, y, col);
  };
  put(0, 0, PAL.white);
  const arm = size >= 2 ? PAL.white : PAL.cyan4;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    put(dx, dy, arm);
    if (size >= 2) put(dx * 2, dy * 2, PAL.cyan3);
  }
}

function veinLine(c: PixelCanvas, a: V, b: V, col: number) {
  const n = Math.max(1, Math.ceil(len(sub(b, a))));
  for (let i = 0; i <= n; i++) dot(c, lerpV(a, b, i / n), col);
}

// ------------------------------------------------------------------ the dragon

const FOOT_NEAR: V = [52, 88];
const ANKLE_NEAR: V = [44.5, 83];
const FOOT_FAR: V = [62, 85];
const ANKLE_FAR: V = [55, 80];

interface Rig {
  hip: V;
  chest: V;
  tAng: number;
  neck0: V;
  head: V;
  att: (o: V) => V;
}

function rig(P: Pose): Rig {
  const hip: V = [42 + P.hx, 66 + P.hy];
  const tAng = -0.95 + P.lean;
  const chest = add(hip, [Math.cos(tAng) * 18, Math.sin(tAng) * 18]);
  const att = (o: V): V => add(chest, rotV(o, P.lean));
  return { hip, chest, tAng, att, neck0: att([3, -5]), head: rnd(add(chest, [17 + P.headX, -28 + P.headY])) };
}

function drawDragon(p: PixelCanvas, P: Pose) {
  resetPools();
  const R = rig(P);
  const { hip, chest, tAng, att, neck0, head } = R;

  // ---------------- wings rigs
  const backAttach = add(lerpV(hip, chest, 0.3), rotV([-8, -5], P.lean));
  const farWing = wingRig(att([1, -8]), P.fw, FAR_FINGERS, 11, 13, att([-6, -4]));
  const nearWing = wingRig(att([-6, -6]), P.nw, NEAR_FINGERS, 13, 16, backAttach);
  if (P.guard) {
    nearWing.attach = add(hip, [0, 8]);
    farWing.attach = att([12, 10]);
  }
  composite(p, drawWing(farWing, true, P, p));

  // ---------------- far leg / far arm
  {
    const g = newG();
    const j = add(hip, [8, 0]);
    const knee = ik(j, ANKLE_FAR, 10.5, 9.5, -1);
    gTube(g, [j, knee], 10, 6.5, M.HIDE_FAR, { z: 0 });
    gTube(g, [knee, ANKLE_FAR], 6, 4.2, M.HIDE_FAR, { z: 1 });
    gTube(g, [ANKLE_FAR, add(FOOT_FAR, [-1, 0])], 4.2, 3.8, M.HIDE_FAR, { z: 2 });
    gEll(g, FOOT_FAR, 3.4, 2, 0, M.HIDE_FAR, { z: 2 });
    const c = g.render();
    claws(c, FOOT_FAR, true);
    composite(p, c);
  }
  {
    const g = newG();
    const s = att([7, 1]);
    const el = add(s, polar(72 - P.arm, 7));
    const wr = add(el, polar(-35 - P.arm * 1.4, 6.5));
    gTube(g, [s, el, wr], 4.6, 3.2, M.HIDE_FAR);
    const c = g.render();
    hand(c, wr, -35 - P.arm * 1.4, true);
    composite(p, c);
  }

  // ---------------- tail (+ ridge crystals and the crystal blade)
  {
    const base = [142, 138, 143, 153, 166, 180, 196, 216, 238, 256];
    const chain = (seg: number) => {
      const pts: V[] = [add(hip, rotV([-7, 3], P.lean * 0.4))];
      for (let i = 0; i < base.length; i++) {
        const k = i / (base.length - 1);
        const a = base[i] - P.tailLift * k * k + Math.sin((P.tail - i * 0.07) * Math.PI * 2) * P.tailAmp * (0.3 + k);
        pts.push(add(pts[i], polar(a, seg)));
      }
      return pts;
    };
    let tailPts = chain(3.45);
    // curl the tail a little tighter instead of letting the blade leave the frame
    for (let seg = 3.35; seg > 2.6 && Math.min(...tailPts.map((q) => q[0])) < MARGIN + 1; seg -= 0.1) tailPts = chain(seg);
    const gs = newG();
    for (let i = 1; i < tailPts.length - 2; i++) {
      const t = norm(sub(tailPts[i + 1], tailPts[i]));
      const dn = dorsal(t);
      const k = i / tailPts.length;
      const r = lerp(10, 2.6, k) / 2;
      const b = add(tailPts[i], mul(dn, r));
      gShard(gs, b, add(dn, mul(t, 0.6)), lerp(5, 2.8, k), lerp(1.8, 1.1, k), M.CRYS, 0, P.glow);
    }
    composite(p, gs.render());
    const g = newG();
    gTube(g, tailPts, 10, 2.6, M.HIDE, { facets: 4, plates: { from: 0.35, period: 3 } });
    const tip = tailPts[tailPts.length - 1];
    const tdir = norm(sub(tip, tailPts[tailPts.length - 3]));
    gShard(g, sub(tip, mul(tdir, 1)), tdir, 8, 2.8, M.CRYS, 6, P.glow);
    const c = g.render();
    rimLight(c);
    composite(p, c);
  }

  // ---------------- back crystals + torso
  {
    const gs = newG();
    const axis = norm(sub(chest, hip));
    const dn = dorsal(axis);
    const spikes: [number, number, number][] = [
      [1.05, 8, 7],
      [0.74, 9.5, 8.5],
      [0.42, 10, 7],
      [0.1, 9.5, 5],
    ];
    for (const [t, off, l] of spikes) {
      const b = add(lerpV(hip, chest, t), mul(dn, off - 1));
      gShard(gs, b, add(dn, mul(axis, -0.6)), l, l * 0.36, M.CRYS, 0, P.glow);
    }
    composite(p, gs.render());
  }
  {
    const g = newG();
    const tex = crystalPlates(hip, tAng, 8, 0.5, 3);
    gEll(g, hip, 11, 9.5, tAng * 0.3, M.HIDE, { flat: 1.3, tex });
    gEll(g, chest, 8.5, 10, tAng, M.HIDE, { flat: 1.3, tex });
    gTube(g, [hip, chest, att([3, -5])], 17, 13, M.HIDE, { flat: 1.3, plates: { from: 0.3, period: 3 }, tex });
    const c = g.render();
    rimLight(c);
    composite(p, c, PAL.night1);
  }

  // ---------------- near hind leg
  {
    const g = newG();
    const j = add(hip, [3, 3]);
    const knee = ik(j, ANKLE_NEAR, 11, 9.5, -1);
    gTube(g, [j, knee], 13, 7.5, M.HIDE, { z: 2, flat: 1.2, tex: crystalPlates(j, Math.atan2(knee[1] - j[1], knee[0] - j[0]), 7, 0.45, 11) });
    gTube(g, [knee, ANKLE_NEAR], 6.5, 4.6, M.HIDE, { z: 1 });
    gTube(g, [ANKLE_NEAR, add(FOOT_NEAR, [-1, 0])], 4.6, 4, M.HIDE, { z: 2 });
    gEll(g, FOOT_NEAR, 3.8, 2.2, 0, M.HIDE, { z: 2 });
    const c = g.render();
    rimLight(c);
    claws(c, FOOT_NEAR, false);
    composite(p, c, PAL.night2);
  }

  // ---------------- neck (+ crystal crest)
  const neckPath = bezier(neck0, add(neck0, rotV([-3, -12], P.lean * 0.6)), add(head, polar(P.ha / DEG + 128, 9)), head, 18);
  {
    const gs = newG();
    for (const t of [0.3, 0.45, 0.6, 0.74, 0.87]) {
      const s = samplePath(neckPath, t);
      const dn = dorsal(s.tan);
      const r = lerp(10, 6.5, t) / 2;
      const b = add(s.p, mul(dn, r - 0.5));
      gShard(gs, b, add(dn, mul(s.tan, -0.55)), lerp(8, 5, t), lerp(2.4, 1.7, t), M.CRYS, 0, P.glow);
    }
    composite(p, gs.render());
    const g = newG();
    gTube(g, neckPath, 10, 6.5, M.HIDE, { facets: 4, plates: { from: 0.3, period: 3 } });
    const c = g.render();
    rimLight(c);
    composite(p, c, PAL.night1);
  }

  // ---------------- head
  drawHead(p, head, P);

  // ---------------- near arm
  {
    const g = newG();
    const s = att([2, 3]);
    const el = add(s, polar(68 - P.arm, 7.5));
    const wr = add(el, polar(-30 - P.arm * 1.4, 7));
    gEll(g, add(s, [0.5, 1]), 3.4, 3, 0, M.HIDE, { z: 1 });
    gTube(g, [s, el, wr], 5.2, 3.6, M.HIDE);
    const c = g.render();
    rimLight(c);
    hand(c, wr, -30 - P.arm * 1.4, false);
    composite(p, c, PAL.night2);
  }

  // ---------------- near wing (in front, translucent over what is behind it)
  composite(p, drawWing(nearWing, false, P, p));

  // ---------------- crystal twinkles
  if (P.sparkles.length) {
    const anchors: V[] = [
      lerpV(nearWing.Wr, nearWing.tips[0], 0.62),
      lerpV(nearWing.E, nearWing.attach, 0.45),
      lerpV(farWing.Wr, farWing.tips[1], 0.6),
      lerpV(nearWing.Wr, nearWing.tips[1], 0.55),
      add(hip, [-15, 7]),
    ];
    for (const [ai, size] of P.sparkles) twinkle(p, rnd(anchors[ai]), size);
  }

  p.outline(PAL.ink);

  // prism light gathering between the jaws while charging (unoutlined: it is light, not matter)
  if (P.mouth > 0.45 && P.jaw < 0.5) {
    const m = rnd(add(mouthPoint(P), [1, 0]));
    const k = P.mouth;
    const put = (dx: number, dy: number, col: number) => p.set(m[0] + dx, m[1] + dy, col);
    if (k > 0.9) {
      for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3]] as const) put(dx, dy, PAL.cyan3);
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const) put(dx, dy, PAL.cyan4);
      put(4, 0, PAL.cyan2);
      put(5, 0, PAL.cyan2);
    } else if (k > 0.7) {
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as const) put(dx, dy, PAL.cyan3);
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(dx, dy, k > 0.7 ? PAL.white : PAL.cyan4);
    put(0, 0, PAL.white);
  }
}

function claws(c: PixelCanvas, foot: V, far: boolean) {
  const col = far ? PAL.steel : PAL.white;
  const x = Math.floor(foot[0]);
  const y = Math.floor(foot[1]);
  c.set(x + 4, y + 1, col);
  c.set(x + 2, y + 2, col);
  c.set(x + 3, y + 2, far ? PAL.night3 : PAL.mist);
  c.set(x - 1, y + 2, far ? PAL.night3 : PAL.mist);
  c.set(x + 0, y + 2, col);
}

function hand(c: PixelCanvas, wr: V, ang: number, far: boolean) {
  const col = far ? PAL.steel : PAL.white;
  const shade = far ? PAL.night3 : PAL.mist;
  const a = add(wr, polar(ang + 30, 2));
  const b = add(wr, polar(ang - 25, 2.2));
  c.set(Math.floor(a[0]), Math.floor(a[1]), shade);
  c.set(Math.floor(a[0]) + 1, Math.floor(a[1]) + 1, col);
  c.set(Math.floor(b[0]) + 1, Math.floor(b[1]), col);
}

// ------------------------------------------------------------------ wing

function distSeg(p: V, a: V, b: V): number {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const t = clamp(((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / (abx * abx + aby * aby || 1), 0, 1);
  return Math.hypot(p[0] - a[0] - abx * t, p[1] - a[1] - aby * t);
}

function distPoly(p: V, pts: V[]): number {
  let d = Infinity;
  for (let i = 1; i < pts.length; i++) d = Math.min(d, distSeg(p, pts[i - 1], pts[i]));
  return d;
}

function drawWing(r: WingRig, far: boolean, P: Pose, behind: PixelCanvas): PixelCanvas {
  const g = newG();
  const glass = far ? M.GLASS_FAR : M.GLASS;
  const hide = far ? M.HIDE_FAR : M.HIDE;
  const { S, E, Wr, tips, attach } = r;
  const n = tips.length;
  const valleys: V[] = [];
  const curves: V[][] = [];
  const flatN = [0, 0, 1] as const;
  const gx = lerp(-20, 130, P.glint);
  for (let i = 0; i < n; i++) {
    const a = tips[i];
    const inner = i + 1 >= n;
    const b = inner ? attach : tips[i + 1];
    const hub = inner ? lerpV(Wr, E, 0.5) : Wr;
    // trailing edge: a soft scallop between two finger tips
    const curve = bezier(a, lerpV(lerpV(a, b, 0.5), hub, inner ? 0.42 : 0.62), b, undefined, 10);
    const mid = curve[5];
    valleys.push(mid);
    curves.push(curve);
    const level = (x: number, y: number, base: number) => {
      const q: V = [x + 0.5, y + 0.5];
      const de = distPoly(q, curve);
      let k = base;
      if (de < 1.1) return far ? 4 : 5; // bright rim where light pours through the thin edge
      if (de < 3.2 && !far) k += 1;
      else if (len(sub(q, Wr)) < 6) k -= 1; // thick root
      if (P.glint >= 0) {
        const d = x + y * 0.75 - gx;
        if (d >= 0 && d < 2.5) k += 1;
      }
      return k;
    };
    gFacet(g, [Wr, ...curve.slice(0, 6)], glass, flatN, 0, (x, y) => level(x, y, 3));
    if (!inner) gFacet(g, [Wr, ...curve.slice(5)], glass, flatN, 0, (x, y) => level(x, y, 2));
    else gFacet(g, [Wr, ...curve.slice(5), S, E], glass, flatN, 0, (x, y) => level(x, y, 2));
  }
  // bones
  gTube(g, [S, E, Wr], 4.8, 3.4, hide, { z: 4, flat: 1.2 });
  for (let i = 0; i < n; i++) {
    const mid = lerpV(Wr, tips[i], 0.5);
    gTube(g, [Wr, mid, tips[i]], 3.2, 1.2, hide, { z: 3 });
  }
  gEll(g, Wr, 2.5, 2.5, 0, hide, { z: 5 });
  gEll(g, E, 2.7, 2.7, 0, hide, { z: 5 });
  // crystal spur growing out of the elbow
  const out = norm(add(norm(sub(E, S)), norm(sub(E, Wr))));
  if (!far) gShard(g, E, out, 6, 1.8, M.CRYS, 7, P.glow);
  const spurDir = norm(sub(Wr, E));
  if (!far) gTube(g, [Wr, add(Wr, rotV(mul(spurDir, 5), -0.75))], 2.4, 0.8, M.GOLD, { z: 6 });

  // translucency: the glass brightens where something pale sits behind it
  const tint = far
    ? undefined
    : (x: number, y: number, mat: number) => {
        if (mat !== glass) return 0;
        const c = behind.get(x, y);
        return c === PAL.white || c === PAL.mist || c === PAL.cyan4 || c === PAL.cyan3 ? 1 : 0;
      };
  const c = g.render(0, tint);

  // glowing veins from the wrist down every pleat valley
  const glow = P.glow;
  const vein = far ? (glow > 0.6 ? PAL.cyan3 : PAL.cyan2) : glow > 0.75 ? PAL.white : PAL.cyan4;
  if (!far || glow > 0.6) for (let i = 0; i < n; i++) veinLine(c, lerpV(Wr, valleys[i], 0.22), lerpV(Wr, valleys[i], 0.8), vein);
  if (!far) {
    // the broad arm membrane gets two more veins fanning from the elbow
    const inner = curves[n - 1];
    const root = lerpV(E, Wr, 0.25);
    for (const k of [2, 8]) veinLine(c, lerpV(root, inner[k], 0.2), lerpV(root, inner[k], 0.78), vein);
  }
  if (!far) for (const t of tips) dot(c, t, PAL.white);
  return c;
}

// ------------------------------------------------------------------ head

/** head scale (the card portrait draws the same head bigger) */
let HS = 1.2;

interface HeadFrame {
  T: (x: number, y: number) => V;
  J: (x: number, y: number) => V;
}

function headFrame(hp: V, P: Pose): HeadFrame {
  const ha = P.ha;
  const T = (x: number, y: number): V => add(hp, rotV([x * HS, y * HS], ha));
  const jawA = P.jaw * 0.56;
  const hinge: V = [-1.5, 0.8];
  const J = (x: number, y: number): V => {
    const q = add(hinge, rotV(sub([x, y], hinge), jawA));
    return T(q[0], q[1]);
  };
  return { T, J };
}

/** Centre of the open mouth (beam origin). */
function mouthPoint(P: Pose): V {
  const { T, J } = headFrame(rig(P).head, P);
  return lerpV(T(17, 0.9), J(16.2, 1.6), 0.5);
}

function drawHead(p: PixelCanvas, hp: V, P: Pose) {
  const ha = P.ha;
  const { T, J } = headFrame(hp, P);
  const Ts = (pts: [number, number][]) => pts.map(([x, y]) => T(x, y));
  const Js = (pts: [number, number][]) => pts.map(([x, y]) => J(x, y));
  const rn = (x: number, y: number, z: number): [number, number, number] => {
    const q = rotV([x, y], ha);
    return [q[0], q[1], z];
  };

  // mouth interior (only visible when the jaw opens)
  if (P.jaw > 0.12) {
    const g = newG();
    gFacet(g, [T(-2, 0.2), T(17, 0.4), J(16.4, 2), J(-2, 1.8)], M.MOUTH, [0, 0, 1], 0);
    const c = g.render();
    const glowM = P.mouth;
    const back = lerpV(T(0, 0.8), J(0, 1.2), 0.5);
    const front = lerpV(T(17, 0.8), J(16.4, 1.6), 0.5);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!c.isOpaque(x, y)) continue;
        const q: V = [x + 0.5, y + 0.5];
        const d = distSeg(q, back, front);
        const along = len(sub(q, back)) / (len(sub(front, back)) || 1);
        let col: number;
        if (glowM > 0.5) col = d < 1.2 && along > 0.25 ? PAL.white : d < 2.6 ? PAL.cyan4 : PAL.cyan3;
        else if (glowM > 0.1) col = d < 1.2 && along > 0.4 ? PAL.cyan3 : along < 0.35 ? PAL.night0 : PAL.cyan1;
        else col = along < 0.4 ? PAL.night0 : d < 1.3 && along > 0.5 ? PAL.crim1 : PAL.night1;
        c.set(x, y, col);
      }
    composite(p, c);
  }

  // lower jaw (own layer → its contour separates it from the mouth)
  {
    const g = newG();
    gFacet(g, Js([[-3.5, 0.8], [16.6, 1.1], [15.8, 2.3], [9, 3.3], [1, 3.9], [-3.6, 3.0]]), M.HIDE, rn(0.05, 0.2, 0.98), 0);
    gFacet(g, Js([[15.8, 2.3], [9, 3.3], [1, 3.9], [-3.6, 3.0], [-3.2, 4.4], [1, 5], [9, 4.3]]), M.HIDE, rn(0.1, 0.95, 0.3), -0.5);
    const c = g.render();
    if (P.jaw > 0.12) for (const tx of [9, 13]) dot(c, J(tx, 1.2), PAL.white);
    composite(p, c);
  }

  // upper head: side plane, cheek, lip band, lit top plane with the brow
  const g = newG();
  gFacet(g, Ts([[-4, 0.8], [-5.2, -2.4], [-3, -5], [2, -6.4], [6.8, -5.6], [9, -3.9], [17.2, -1.7], [18.5, 0], [17.6, 1.2], [4, 1.3], [-1.5, 1.5]]), M.HIDE, rn(0.02, 0.0, 1), 0);
  gFacet(g, Ts([[-4, 0.8], [-5.2, -2.4], [-3.5, -2], [1.5, -0.6], [4, 1.3], [-1.5, 1.5]]), M.HIDE, rn(0.35, 0.45, 0.82), 0.5);
  gFacet(g, Ts([[4, 0.1], [17.8, -0.2], [17.6, 1.2], [4, 1.3]]), M.HIDE, rn(0.1, 0.6, 0.79), 0.5);
  gFacet(g, Ts([[-3, -5], [2, -6.4], [6.8, -5.6], [9, -3.9], [17.2, -1.7], [17.8, -0.9], [8.6, -2.6], [6.6, -3.9], [1.5, -4.4], [-3.6, -3.6]]), M.HIDE, rn(-0.3, -0.9, 0.42), 0.5);
  const c = g.render();
  // nostril
  dot(c, T(16, -1.1), PAL.night2);
  // eye under the brow: dark brow line + glowing slit (the brightest pixels of the sprite)
  {
    const e = rnd(T(4.9, -2.0));
    const u: V = [Math.cos(ha), Math.sin(ha)];
    const nn: V = [-Math.sin(ha), Math.cos(ha)];
    const at = (k: number, m: number): V => add(e, rnd(add(mul(u, k), mul(nn, m))));
    const put = (q: V, col: number) => {
      if (c.isOpaque(q[0], q[1])) c.set(q[0], q[1], col);
    };
    for (let k = -2; k <= 2; k++) put(at(k, -1), k === 2 ? PAL.night2 : PAL.night1);
    if (P.eye > 0.5) {
      put(at(-1, 0), PAL.cyan3);
      put(at(0, 0), PAL.cyan4);
      put(at(1, 0), PAL.white);
      put(at(-1, 1), PAL.night2);
      if (P.glow > 0.85) put(at(-2, 0), PAL.cyan2);
    } else {
      put(at(-1, 0), PAL.night1);
      put(at(0, 0), PAL.night2);
      put(at(1, 0), PAL.cyan2);
    }
  }
  if (P.jaw <= 0.12 && P.mouth > 0.2) veinLine(c, T(6, 1.0), T(16.5, 0.8), P.mouth > 0.6 ? PAL.cyan4 : PAL.cyan3);
  composite(p, c);
  // upper fangs hang over the open mouth
  if (P.jaw > 0.12) for (const tx of [7, 10.5, 14, 16.4]) p.set(Math.floor(T(tx, 1.9)[0]), Math.floor(T(tx, 1.9)[1]), PAL.white);

  // near horns (gold)
  {
    const g2 = newG();
    const k = HS / 1.2;
    gTube(g2, bezier(T(-2.2, -4.6), T(-7, -6.2), T(-11.5, -6.6), T(-15.5, -9.6), 12), 3.3 * k, 0.8, M.GOLD);
    gTube(g2, bezier(T(-3, -0.6), T(-6.5, -0.4), T(-9, 0.6), T(-11, 2.6), 8), 2.4 * k, 0.8, M.GOLD, { z: 1 });
    composite(p, g2.render());
  }
}

// ------------------------------------------------------------------ animations

function idlePose(f: number, n: number): Pose {
  const t = f / n;
  // breathing + one slow wing beat per loop: the downstroke (t 0.25 → 0.75) lifts the body;
  // forearm and finger tips trail the shoulder (secondary motion). Frame 0 == NEUTRAL.
  const s = Math.sin(t * Math.PI * 2);
  const beat = (lag: number) => Math.sin((t - lag) * Math.PI * 2);
  return pose({
    hy: Math.round(s * 1),
    lean: -0.025 * s,
    headY: Math.round(Math.sin((t - 0.12) * Math.PI * 2) * 1),
    nw: { a1: NEUTRAL.nw.a1 - 7 * s, a2: NEUTRAL.nw.a2 - 6 * beat(0.08), a3: NEUTRAL.nw.a3 - 9 * beat(0.16) },
    fw: { a1: NEUTRAL.fw.a1 - 5 * s, a2: NEUTRAL.fw.a2 - 5 * beat(0.08), a3: NEUTRAL.fw.a3 - 7 * beat(0.16) },
    tail: t,
    glow: 0.3 + 0.2 * Math.sin((t - 0.25) * Math.PI * 2),
    glint: t * 1.6 - 0.3,
    sparkles: (
      [[], [[0, 1]], [[0, 2]], [[0, 1]], [], [[1, 1]], [[1, 2]], [[1, 1]]] as [number, number][][]
    )[f % 8],
  });
}

// roar: crouch (anticipation) → explode upward, rear, wings flung wide → trembling roar → settle
const ROAR: PoseDelta[] = [
  {},
  { hy: 2, lean: 0.07, headX: -3, headY: 4, ha: 0.4, nw: { a1: -100, a2: -122, a3: -128, fan: -26 }, fw: { a1: -92, a2: -116, a3: -100, fan: -20 }, tailLift: -5, arm: -6, glow: 0.4 },
  { hy: 3, lean: 0.12, headX: -4, headY: 7, ha: 0.55, nw: { a1: -96, a2: -118, a3: -132, fan: -22 }, fw: { a1: -94, a2: -118, a3: -104, fan: -18 }, tailLift: -8, arm: -12, glow: 0.55 },
  // explode upward (overshoot)
  { hy: -3, lean: -0.3, headX: 3, headY: -2, ha: -0.6, jaw: 1, nw: { a1: -128, a2: -158, a3: -98, fan: -47 }, fw: { a1: 2, a2: 10, a3: 0, fan: -26 }, tailLift: 14, arm: 60, glow: 1, tail: 0.1, sparkles: [[0, 2], [2, 1]] },
  // trembling roar: the whole body vibrates, jaws quiver, energy pulses
  { hx: 1, hy: -3, lean: -0.26, headX: 3, headY: -1, ha: -0.52, jaw: 0.95, nw: { a1: -124, a2: -153, a3: -101, fan: -45 }, fw: { a1: 2, a2: 10, a3: 0, fan: -26 }, tailLift: 12, arm: 55, glow: 1, tail: 0.25, sparkles: [[0, 1], [1, 2]] },
  { hx: -1, hy: -3, lean: -0.27, headX: 2, headY: -2, ha: -0.56, jaw: 1, nw: { a1: -126, a2: -155, a3: -99, fan: -46 }, fw: { a1: 2, a2: 10, a3: 0, fan: -26 }, tailLift: 13, arm: 58, glow: 0.8, tail: 0.4, sparkles: [[1, 1], [3, 2]] },
  { hx: 1, hy: -3, lean: -0.26, headX: 3, headY: -1, ha: -0.53, jaw: 0.92, nw: { a1: -124, a2: -153, a3: -101, fan: -45 }, fw: { a1: 2, a2: 10, a3: 0, fan: -26 }, tailLift: 12, arm: 55, glow: 1, tail: 0.55, sparkles: [[3, 1], [2, 2]] },
  { hx: 0, hy: -2, lean: -0.24, headX: 2, headY: -1, ha: -0.48, jaw: 0.8, nw: { a1: -122, a2: -151, a3: -103, fan: -44 }, fw: { a1: 2, a2: 10, a3: 0, fan: -26 }, tailLift: 11, arm: 50, glow: 0.8, tail: 0.7 },
  // release
  { hy: -1, lean: -0.1, headX: 1, headY: -1, ha: -0.15, jaw: 0.3, nw: { a1: -112, a2: -142, a3: -112, fan: -42 }, fw: { a1: -48, a2: -52, a3: -58, fan: -28 }, tailLift: 5, arm: 20, glow: 0.6, tail: 0.85 },
  { hy: 0, lean: -0.02, ha: 0.1, nw: { a1: -108, a2: -139 }, glow: 0.4, tail: 0.95 },
];

// attack "Prizma Nefesi": head rears back while light gathers in the jaws → lunges forward,
// jaws flung open at the impact frame (beam fires from `muzzle`) → holds while firing → recovers
const ATTACK: PoseDelta[] = [
  {},
  { hy: -1, lean: -0.06, headX: -4, headY: -1, ha: -0.12, nw: { a1: -112, a2: -143, a3: -116, fan: -42 }, glow: 0.5, mouth: 0.25, tailLift: 4 },
  { hx: -1, hy: -1, lean: -0.13, headX: -8, headY: -3, ha: -0.32, nw: { a1: -117, a2: -149, a3: -112, fan: -44 }, fw: { a1: -88, a2: -110 }, glow: 0.7, mouth: 0.55, tailLift: 9, arm: 15, sparkles: [[3, 1]] },
  { hx: -1, hy: -2, lean: -0.17, headX: -10, headY: -4, ha: -0.44, jaw: 0.18, nw: { a1: -120, a2: -153, a3: -110, fan: -46 }, fw: { a1: -91, a2: -113 }, glow: 0.9, mouth: 0.8, tailLift: 13, arm: 22, sparkles: [[3, 2], [0, 1]] },
  { hx: -2, hy: -2, lean: -0.19, headX: -11, headY: -4, ha: -0.5, jaw: 0.25, nw: { a1: -122, a2: -155, a3: -109, fan: -47 }, fw: { a1: -92, a2: -114 }, glow: 1, mouth: 1, tailLift: 15, arm: 26, sparkles: [[0, 2], [1, 1], [2, 1]] },
  // IMPACT — the Prism Breath fires: lunge, jaws flung wide, wings thrown back
  { hx: 1, hy: 1, lean: 0.13, headX: 0, headY: 6, ha: 0.1, jaw: 1, nw: { a1: -100, a2: -128, a3: -126, fan: -33 }, fw: { a1: -94, a2: -120 }, glow: 1, mouth: 1, tailLift: -10, arm: -12, tail: 0.15 },
  { hx: 1, hy: 1, lean: 0.11, headX: -1, headY: 5, ha: 0.08, jaw: 1, nw: { a1: -101, a2: -130, a3: -124, fan: -35 }, fw: { a1: -92 }, glow: 1, mouth: 1, tailLift: -8, arm: -8, tail: 0.3 },
  { hx: 0, hy: 1, lean: 0.09, headX: -1, headY: 4, ha: 0.1, jaw: 0.95, nw: { a1: -103, a2: -132 }, glow: 0.9, mouth: 0.9, tailLift: -6, tail: 0.45 },
  { hx: 0, hy: 0, lean: 0.05, headX: 1, headY: 3, ha: 0.12, jaw: 0.55, nw: { a1: -105, a2: -135 }, glow: 0.6, mouth: 0.3, tailLift: -3, tail: 0.6 },
  { hy: 0, lean: 0.01, headX: 0, headY: 1, ha: 0.12, jaw: 0.1, nw: { a1: -107 }, glow: 0.4, tail: 0.8 },
];

// hit: snapped back, eyes squeezed shut, wings flinch inward → shakes it off
const HIT: PoseDelta[] = [
  { hx: -3, lean: -0.2, headX: -7, headY: -1, ha: -0.36, jaw: 0.5, eye: 0, nw: { a1: -95, a2: -117, a3: -117, fan: -30 }, fw: { a1: -96, a2: -122, fan: -22 }, tailLift: 4, arm: 28, glow: 0.05 },
  { hx: -4, hy: 1, lean: -0.08, headX: -4, headY: 3, ha: 0.24, jaw: 0.2, eye: 0, nw: { a1: -100, a2: -126, a3: -114, fan: -35 }, fw: { a1: -92, fan: -24 }, tailLift: -2, arm: 10, glow: 0.15, tail: 0.2 },
  { hx: -1, hy: 1, lean: -0.02, headX: -1, headY: 1, ha: 0.16, jaw: 0.05, eye: 1, nw: { a1: -105, a2: -134 }, glow: 0.25, tail: 0.35 },
  { hx: 0, hy: 0, lean: 0, headX: 0, headY: 0, ha: 0.13, nw: { a1: -107 }, glow: 0.3, tail: 0.45 },
];

function guardPose(f: number, n: number): Pose {
  const t = f / n;
  const s = Math.sin(t * Math.PI * 2);
  return pose({
    guard: true,
    hy: f === 2 || f === 3 ? 4 : 3,
    lean: 0.16,
    headX: -3,
    headY: 12 + (f === 2 || f === 3 ? 1 : 0),
    ha: 0.34,
    nw: { a1: -64 + 2 * s, a2: 40 + 1.5 * s, a3: 76, fan: 21 },
    fw: { a1: -50 + 2 * s, a2: 60, a3: 85, fan: 15 },
    tailLift: -14,
    tailAmp: 2,
    tail: t,
    arm: -10,
    glow: 0.35 + 0.2 * s,
    // a slow glint sweeps across the crystal shield, then it rests
    glint: f === 0 ? -1 : 0.5 + f * 0.13,
  });
}

function framePose(anim: MonsterAnim, f: number): Pose {
  switch (anim) {
    case 'idle':
      return idlePose(f, ANIMS.idle.frames);
    case 'roar':
      return pose(ROAR[f] ?? {});
    case 'attack':
      return pose(ATTACK[f] ?? {});
    case 'hit':
      return pose(HIT[f] ?? {});
    case 'guard':
      return guardPose(f, ANIMS.guard.frames);
  }
}

const ANIMS = {
  idle: { frames: 8, fps: 7, loop: true },
  roar: { frames: ROAR.length, fps: 10, loop: false },
  attack: { frames: ATTACK.length, fps: 10, loop: false },
  hit: { frames: HIT.length, fps: 10, loop: false },
  guard: { frames: 4, fps: 4, loop: true },
};

// ------------------------------------------------------------------ portrait

function portrait(p: PixelCanvas) {
  resetPools();
  const pw = p.w;
  const ph = p.h;
  // LIGHT backdrop: deep amber with gold god-rays fanning from behind the head
  const sun: V = [30, 9];
  for (let y = 0; y < ph; y++)
    for (let x = 0; x < pw; x++) {
      const r = len(sub([x + 0.5, y + 0.5], sun));
      let col: number = r < 15 ? PAL.gold2 : PAL.gold1;
      if (r > 27 && PixelCanvas.ditherAt(x, y, Math.min(16, (r - 27) * 3))) col = PAL.gold0;
      p.set(x, y, col);
    }
  for (let i = 0; i < 7; i++) {
    const a = -170 + i * 52;
    const a0 = polar(a - 7, 60);
    const a1 = polar(a + 7, 60);
    fillPoly([sun, add(sun, a0), add(sun, a1)], (x, y) => {
      if (x < 0 || y < 0 || x >= pw || y >= ph) return;
      const r = len(sub([x + 0.5, y + 0.5], sun));
      p.set(x, y, r < 15 ? PAL.gold3 : PAL.gold2);
    });
  }
  p.disc(sun[0], sun[1], 6.5, PAL.gold3).disc(sun[0], sun[1], 3.5, PAL.gold4);
  for (const [x, y] of [[5, 5], [39, 27], [9, 24]] as const) {
    p.set(x, y, PAL.gold4);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) p.set(x + dx, y + dy, PAL.gold3);
  }

  const P = pose({ glow: 0.9, jaw: 0.45, mouth: 0.8, ha: 0.04 });
  const hp: V = [14, 16];
  // crystal wing glass behind, top-left
  {
    const g = newG();
    const Wr: V = [2, 2];
    gFacet(g, [Wr, [24, -6], [16, 6]], M.GLASS, [0, 0, 1], 0, 3);
    gFacet(g, [Wr, [16, 6], [12, 12], [0, 14]], M.GLASS, [0, 0, 1], 0, 2);
    const c = g.render();
    veinLine(c, [3, 3], [15, 5], PAL.cyan4);
    veinLine(c, [3, 4], [10, 11], PAL.cyan3);
    composite(p, c);
  }
  // neck with its crystal ridge, curling down out of frame
  {
    const neck = bezier([hp[0] - 2, hp[1] + 3], [hp[0] - 6, hp[1] + 10], [hp[0] - 2, hp[1] + 16], [hp[0] - 7, ph + 6], 12);
    const gs = newG();
    for (let t = 0.15; t < 1; t += 0.22) {
      const s = samplePath(neck, t);
      const dn = dorsal(s.tan);
      gShard(gs, add(s.p, mul(dn, 6)), add(dn, mul(s.tan, -0.5)), 7, 2.4, M.CRYS, 0, 0.5);
    }
    composite(p, gs.render());
    const g = newG();
    gTube(g, neck, 13, 16, M.HIDE, { facets: 4, plates: { from: 0.3, period: 4 } });
    const c = g.render();
    rimLight(c);
    composite(p, c);
  }
  HS = 1.48;
  drawHead(p, hp, P);
  HS = 1.2;
}

// ------------------------------------------------------------------ export

const IMPACT = 5;
const MUZZLE = rnd(mouthPoint(framePose('attack', IMPACT)));

const crystalWyrm: MonsterArt = {
  id: 'crystal_wyrm',
  w: W,
  h: H,
  // ground line under the claws, centred under the body mass (tail balances the head)
  anchorX: 50,
  anchorY: 91,
  hover: 0,
  muzzle: { x: MUZZLE[0], y: MUZZLE[1] },
  core: { x: 48, y: 58 },
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number) {
    drawDragon(p, framePose(anim, frame));
  },
  portrait,
};

/** Mouth position for every attack frame (charge particles can converge here during frames 1–4). */
export const CRYSTAL_WYRM_MOUTH: { x: number; y: number }[] = Array.from({ length: ANIMS.attack.frames }, (_, f) => {
  const m = rnd(mouthPoint(framePose('attack', f)));
  return { x: m[0], y: m[1] };
});

export default crystalWyrm;
