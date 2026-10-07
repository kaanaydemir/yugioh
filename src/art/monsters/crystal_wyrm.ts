// Kristal Ejder (crystal_wyrm) — LIGHT ace dragon, the poster monster. 96×96, faces right.
//
// Built as a small parametric rig rendered through a tiny "deferred" pipeline:
//   1. every body part is rasterized into its own G-buffer layer as primitives that carry a
//      surface normal (ellipsoids, tapered tubes, flat crystal facets) and a depth (z-union
//      inside the layer, so overlapping primitives merge like clay);
//   2. each layer is lit with one top-left key light, quantized onto hand-picked palette ramps
//      per material (crystal hide, gold, glowing crystal, wing glass, mouth) and despeckled
//      (no lonely pixels survive quantization);
//   3. hand-placed details (eyes, teeth, veins, glints) are painted on top and the layer is
//      composited back-to-front. Where a layer overlaps parts already drawn it gets a soft
//      contact-shadow seam (one or two steps down the ramp of the surface behind it); the
//      silhouette gets exactly one 1px PAL.ink contour at the very end.
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
const flo = (a: V): V => [Math.floor(a[0]), Math.floor(a[1])];

// ------------------------------------------------------------------ materials

// Key light from the top-left, slightly toward the viewer.
const LIGHT = (() => {
  const l = [-0.5, -0.74, 0.46];
  const m = Math.hypot(l[0], l[1], l[2]);
  return [l[0] / m, l[1] / m, l[2] / m] as const;
})();

interface Mat {
  ramp: number[];
  /** ascending intensity thresholds, length = ramp.length - 1 */
  th: number[];
  /** the pixel's bias IS the ramp index (hand-authored tone levels, e.g. wing glass) */
  direct?: boolean;
}

const M = {
  HIDE: 0,
  HIDE_FAR: 1,
  GOLD: 2,
  CRYS: 4,
  GLASS: 6,
  GLASS_FAR: 7,
  MOUTH: 8,
  HIDE_D: 9,
} as const;

const MATS: Mat[] = [];
MATS[M.HIDE] = { ramp: [PAL.night2, PAL.night3, PAL.steel, PAL.mist, PAL.white], th: [-0.6, -0.25, 0.12, 0.58] };
MATS[M.HIDE_FAR] = { ramp: [PAL.night1, PAL.night2, PAL.night3, PAL.steel, PAL.mist], th: [-0.55, -0.15, 0.22, 0.7] };
MATS[M.GOLD] = { ramp: [PAL.gold0, PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4], th: [-0.6, -0.2, 0.15, 0.6] };
MATS[M.CRYS] = { ramp: [PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white], th: [], direct: true };
MATS[M.GLASS] = { ramp: [PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white], th: [], direct: true };
MATS[M.GLASS_FAR] = { ramp: [PAL.night1, PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4], th: [], direct: true };
MATS[M.MOUTH] = { ramp: [PAL.night0, PAL.night1, PAL.crim1], th: [0.3, 0.8] };
// hand-toned hide (the head is cut in flat planes: 2 steel, 3 mist, 4 white)
MATS[M.HIDE_D] = { ramp: [PAL.night2, PAL.night3, PAL.steel, PAL.mist, PAL.white], th: [], direct: true };

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

  put(x: number, y: number, mat: number, nx: number, ny: number, nz: number, z: number, bias = 0) {
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
  }

  /** Light + quantize into a canvas, then despeckle so every tone forms a cluster. */
  render(shift = 0): PixelCanvas {
    const out = newCanvas();
    for (let i = 0; i < W * H; i++) {
      const mi = this.mat[i];
      if (mi < 0) continue;
      const m = MATS[mi];
      const I = this.nx[i] * LIGHT[0] + this.ny[i] * LIGHT[1] + this.nz[i] * LIGHT[2] + this.bias[i] + shift;
      const k = m.direct ? clamp(Math.round(this.bias[i]), 0, m.ramp.length - 1) : toneOf(m, I);
      out.set(i % W, Math.floor(i / W), m.ramp[k]);
    }
    despeckle(out);
    return out;
  }
}

/**
 * Light quantization leaves lonely pixels along tone borders. Any pixel with no 8-neighbour of
 * its own colour takes the colour most of its neighbours share (two passes).
 */
function despeckle(c: PixelCanvas) {
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
        if (c0 < 0) continue;
        let same = false;
        const votes = new Map<number, number>();
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const n = col(x + dx, y + dy);
            if (n < 0) continue;
            if (n === c0) same = true;
            // 4-neighbours weigh double so straight runs win over corner touches
            else votes.set(n, (votes.get(n) ?? 0) + (dx && dy ? 1 : 2));
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
  /** ventral scales: pixels with v > from are lifted by `lift` (one lighter band, no grooves) */
  belly?: { from: number; lift: number };
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
      g.put(x, y, mat, lx * cs - ly * sn, lx * sn + ly * cs, nz * flat, z0 + nz * Math.min(rx, ry), o.bias ?? 0);
    }
  }
}

/** Tapered tube along a polyline with cylinder normals. */
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
      let bias = o.bias ?? 0;
      if (o.belly && v > o.belly.from) bias += o.belly.lift;
      g.put(x, y, mat, nx, ny, nz, z0 + hz * r, bias);
    }
  }
}

/** Scanline polygon fill sampled at pixel centers; calls cb for every covered pixel. */
function fillPoly(pts: readonly V[], cb: (x: number, y: number) => void) {
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

const FLAT_N = [0, 0, 1] as const;

function gFacet(g: G, pts: readonly V[], mat: number, n: readonly [number, number, number], z = 0, bias: number | ((x: number, y: number) => number) = 0) {
  fillPoly(pts, (x, y) => g.put(x, y, mat, n[0], n[1], n[2], z, typeof bias === 'number' ? bias : bias(x, y)));
}

/**
 * Faceted crystal shard: base → tip along dir, two facets split down the ridge. The facet that
 * faces the key light takes the bright tone, the other the deep tone; `glow` (0..1) lifts both.
 * Small shards are a single tone (two tones on a 3-pixel shard is just noise).
 */
function gShard(g: G, base: V, dir: V, length: number, hw: number, mat: number, z = 0, glow = 0) {
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
  const lit1 = p[0] * LIGHT[0] + p[1] * LIGHT[1] > 0;
  gFacet(g, [l, sl, tip, b0], mat, FLAT_N, z, (lit1 ? 3 : 1) + up);
  gFacet(g, [b0, tip, sr, r], mat, FLAT_N, z, (lit1 ? 1 : 3) + up);
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
  /** bone length multiplier (a spread far wing turns toward the viewer and reads bigger) */
  span: number;
  /** where the inner membrane meets the body, in torso space (undefined = default) */
  at?: V;
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
  /** motion smear: the head's path from this pose to the current one is drawn as a light trail */
  smearFrom?: PoseDelta;
}

const NEUTRAL: Pose = {
  hx: 0,
  hy: 0,
  lean: 0,
  headX: 0,
  headY: 0,
  ha: 0.1,
  jaw: 0,
  nw: { a1: -108, a2: -138, a3: -118, fan: -40, span: 1 },
  fw: { a1: -84, a2: -110, a3: -92, fan: -28, span: 1 },
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

/** Numeric in-between of two poses (used for the attack smear). */
function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const w = (x: Wing, y: Wing): Wing => ({ a1: lerp(x.a1, y.a1, t), a2: lerp(x.a2, y.a2, t), a3: lerp(x.a3, y.a3, t), fan: lerp(x.fan, y.fan, t), span: lerp(x.span, y.span, t), at: y.at });
  return {
    ...b,
    hx: lerp(a.hx, b.hx, t),
    hy: lerp(a.hy, b.hy, t),
    lean: lerp(a.lean, b.lean, t),
    headX: lerp(a.headX, b.headX, t),
    headY: lerp(a.headY, b.headY, t),
    ha: lerp(a.ha, b.ha, t),
    jaw: lerp(a.jaw, b.jaw, t),
    nw: w(a.nw, b.nw),
    fw: w(a.fw, b.fw),
  };
}

// ------------------------------------------------------------------ skeleton

const NEAR_FINGERS = [19.5, 22.5, 19];
const FAR_FINGERS = [17.5, 16, 12.5];

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
  const E = keepIn(S, add(S, polar(w.a1, l1 * w.span)));
  const Wr = keepIn(E, add(E, polar(w.a2, l2 * w.span)));
  const tips = fingers.map((fl, i) => keepIn(Wr, add(Wr, polar(w.a3 + w.fan * i, fl * w.span))));
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

/** Contact shadow a front part casts on the surface right behind its edge (same ramp, darker). */
const SEAM: Record<number, number> = {
  [PAL.white]: PAL.steel,
  [PAL.mist]: PAL.steel,
  [PAL.steel]: PAL.night2,
  [PAL.night4]: PAL.night2,
  [PAL.night3]: PAL.night1,
  [PAL.night2]: PAL.night1,
  [PAL.night1]: PAL.night0,
  [PAL.cyan4]: PAL.cyan2,
  [PAL.cyan3]: PAL.cyan1,
  [PAL.cyan2]: PAL.cyan1,
  [PAL.cyan1]: PAL.cyan0,
  [PAL.cyan0]: PAL.night0,
  [PAL.gold4]: PAL.gold2,
  [PAL.gold3]: PAL.gold1,
  [PAL.gold2]: PAL.gold1,
  [PAL.gold1]: PAL.gold0,
};
type SeamFn = (x: number, y: number, behind: number) => number;
const selout: SeamFn = (_x, _y, c) => SEAM[c] ?? PAL.ink;

/**
 * Blit a layer. Its edge pixels that fall over parts already drawn become a seam line
 * (contact shadow by default); over empty space nothing is added — the single silhouette
 * contour comes from the final p.outline(PAL.ink).
 */
function composite(dst: PixelCanvas, layer: PixelCanvas, seam: SeamFn = selout) {
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
      if (!dst.isOpaque(x, y)) continue;
      if (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1)) edge.push(x, y);
    }
  for (let i = 0; i < edge.length; i += 2) {
    const x = edge[i];
    const y = edge[i + 1];
    layer.set(x, y, seam(x, y, dst.get(x, y)!));
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

/** Mark a layer's opaque pixels in a mask. */
function maskOf(c: PixelCanvas, into: Uint8Array) {
  into.fill(0);
  for (let i = 0; i < W * H; i++) if (c.data[i * 4 + 3]) into[i] = 1;
}

/** paint a pixel only over this layer's opaque pixels */
function dot(c: PixelCanvas, p: V, col: number) {
  c.paint(Math.floor(p[0]), Math.floor(p[1]), col);
}

/** 1px Bresenham line painted only over a layer's opaque pixels (optionally only over `only`). */
function lineOn(c: PixelCanvas, a: V, b: V, col: number, only?: (cur: number) => boolean) {
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

/**
 * Cool reflected light from the arena on the shadow-side silhouette (bottom/right edges) of the
 * crystal hide: one continuous cyan line, only where the edge faces empty space.
 */
function rimLight(c: PixelCanvas, dst: PixelCanvas) {
  const d = c.data;
  const inL = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 0;
  const open = (x: number, y: number) => !inL(x, y) && !dst.isOpaque(x, y);
  const hits: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!inL(x, y)) continue;
      if (!(open(x + 1, y) || open(x, y + 1))) continue;
      if (!inL(x - 1, y) || !inL(x, y - 1)) continue;
      const col = c.get(x, y);
      if (col === PAL.night2 || col === PAL.night3 || col === PAL.steel) hits.push(x, y);
    }
  for (let i = 0; i < hits.length; i += 2) c.set(hits[i], hits[i + 1], PAL.cyan2);
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
  return { hip, chest, tAng, att, neck0: att([3, -5]), head: rnd(add(chest, [14 + P.headX, -28 + P.headY])) };
}

function wings(P: Pose) {
  const { hip, chest, att } = rig(P);
  const backAttach = add(lerpV(hip, chest, 0.3), rotV([-8, -5], P.lean));
  const farWing = wingRig(att([1, -8]), P.fw, FAR_FINGERS, 11, 13, att(P.fw.at ?? [-6, -4]));
  const nearWing = wingRig(att([-6, -6]), P.nw, NEAR_FINGERS, 13, 16, P.nw.at ? att(P.nw.at) : backAttach);
  if (P.guard) {
    nearWing.attach = add(hip, [0, 8]);
    farWing.attach = att([12, 10]);
  }
  return { farWing, nearWing };
}

function drawDragon(p: PixelCanvas, P: Pose) {
  resetPools();
  const R = rig(P);
  const { hip, chest, tAng, att, neck0, head } = R;
  const { farWing, nearWing } = wings(P);

  composite(p, drawWing(farWing, true, P));

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
    const wr = add(el, polar(-35 - P.arm * 1.4, 8));
    gTube(g, [s, el, wr], 4.8, 3.4, M.HIDE_FAR);
    gEll(g, add(wr, polar(-35 - P.arm * 1.4, 1)), 2.2, 1.7, (-35 - P.arm * 1.4) * DEG, M.HIDE_FAR, { z: 2 });
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
    for (let i = 1; i < tailPts.length - 2; i += 2) {
      const t = norm(sub(tailPts[i + 1], tailPts[i]));
      const dn = dorsal(t);
      const k = i / tailPts.length;
      const r = lerp(10, 2.6, k) / 2;
      const b = add(tailPts[i], mul(dn, r));
      gShard(gs, b, add(dn, mul(t, 0.6)), lerp(6, 4, k), lerp(2, 1.4, k), M.CRYS, 0, P.glow);
    }
    composite(p, gs.render());
    const g = newG();
    gTube(g, tailPts, 10, 2.6, M.HIDE, { facets: 4, belly: { from: 0.35, lift: 0.16 } });
    const tip = tailPts[tailPts.length - 1];
    const tdir = norm(sub(tip, tailPts[tailPts.length - 3]));
    gShard(g, sub(tip, mul(tdir, 1)), tdir, 8, 2.8, M.CRYS, 6, P.glow);
    const c = g.render();
    rimLight(c, p);
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
    gEll(g, hip, 11, 9.5, tAng * 0.3, M.HIDE, { flat: 1.3 });
    gEll(g, chest, 8.5, 10, tAng, M.HIDE, { flat: 1.3 });
    gTube(g, [hip, chest, att([3, -5])], 17, 13, M.HIDE, { flat: 1.3 });
    const c = g.render();
    // two crystal facet lines across the chest (cut-gem planes, not cracks)
    const fl = PAL.cyan2;
    const onHide = (cur: number) => cur === PAL.white || cur === PAL.mist || cur === PAL.steel;
    lineOn(c, att([-7, 0]), att([-3, 8]), fl, onHide);
    lineOn(c, att([-3, 8]), att([1, 10]), fl, onHide);
    rimLight(c, p);
    composite(p, c);
  }

  // ---------------- near hind leg
  {
    const g = newG();
    const j = add(hip, [3, 3]);
    const knee = ik(j, ANKLE_NEAR, 11, 9.5, -1);
    gTube(g, [j, knee], 13, 7.5, M.HIDE, { z: 2, flat: 1.2 });
    gTube(g, [knee, ANKLE_NEAR], 6.5, 4.6, M.HIDE, { z: 1 });
    gTube(g, [ANKLE_NEAR, add(FOOT_NEAR, [-1, 0])], 4.6, 4, M.HIDE, { z: 2 });
    gEll(g, FOOT_NEAR, 3.8, 2.2, 0, M.HIDE, { z: 2 });
    const c = g.render();
    // one facet line down the thigh
    const ax = norm(sub(knee, j));
    const pr: V = [-ax[1], ax[0]];
    lineOn(c, add(lerpV(j, knee, 0.05), mul(pr, -2.5)), add(lerpV(j, knee, 0.62), mul(pr, -0.5)), PAL.cyan2, (cur) => cur === PAL.white || cur === PAL.mist);
    rimLight(c, p);
    claws(c, FOOT_NEAR, false);
    composite(p, c);
  }

  // ---------------- neck (+ crystal crest)
  const neckPath = bezier(neck0, add(neck0, rotV([-3, -12], P.lean * 0.6)), add(head, polar(P.ha / DEG + 128, 9)), head, 18);
  {
    const gs = newG();
    for (const t of [0.3, 0.45, 0.6, 0.74, 0.87]) {
      const s = samplePath(neckPath, t);
      const dn = dorsal(s.tan);
      const r = lerp(10, 7, t) / 2;
      const b = add(s.p, mul(dn, r - 0.5));
      gShard(gs, b, add(dn, mul(s.tan, -0.55)), lerp(8, 5, t), lerp(2.4, 1.7, t), M.CRYS, 0, P.glow);
    }
    composite(p, gs.render());
    const g = newG();
    gTube(g, neckPath, 10.5, 7, M.HIDE, { facets: 4, belly: { from: 0.3, lift: 0.16 } });
    const c = g.render();
    rimLight(c, p);
    composite(p, c);
  }

  // ---------------- head
  drawHead(p, head, P);

  // ---------------- near arm
  {
    const g = newG();
    const s = att([2, 3]);
    const el = add(s, polar(68 - P.arm, 7.5));
    const wa = -30 - P.arm * 1.4;
    const wr = add(el, polar(wa, 9));
    gEll(g, add(s, [0.5, 1]), 3.6, 3.2, 0, M.HIDE, { z: 1 });
    gTube(g, [s, el, wr], 5.8, 4.2, M.HIDE);
    gEll(g, add(wr, polar(wa, 1)), 2.6, 2, wa * DEG, M.HIDE, { z: 2, bias: 0.4 });
    const c = g.render();
    rimLight(c, p);
    hand(c, wr, wa, false);
    composite(p, c);
  }

  // ---------------- near wing (in front)
  composite(p, drawWing(nearWing, false, P));

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

  // motion smear behind the lunging head (light, not matter: unoutlined, only on empty pixels)
  if (P.smearFrom) smear(p, pose(P.smearFrom), P);

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

/**
 * Motion smear of the lunging head: the paths swept by the brow, the nose and the chin between the
 * previous pose and this one, as light streaks (white nose streak, cyan4/cyan3 brow and chin) that
 * thicken toward the head. Only on empty pixels, never outlined: it is light, not matter.
 */
function smear(p: PixelCanvas, from: Pose, to: Pose) {
  const N = 16;
  const pts = (t: number) => {
    const P = lerpPose(from, to, t);
    const { T } = headFrame(rig(P).head, P);
    return { top: T(5, -6.6), nose: T(18.6, -1.2), chin: T(13, 4.6) };
  };
  const sm = newCanvas();
  const seg = (a: V, b: V, col: number) => sm.line(Math.floor(a[0]), Math.floor(a[1]), Math.floor(b[0]), Math.floor(b[1]), col);
  let prev = pts(0.3);
  for (let i = 1; i <= N; i++) {
    const t = 0.3 + (0.7 * i) / N;
    const cur = pts(t);
    if (t > 0.55) fillPoly([prev.top, cur.top, cur.nose, prev.nose], (x, y) => sm.set(x, y, t > 0.8 ? PAL.cyan4 : PAL.cyan3));
    seg(prev.top, cur.top, PAL.cyan4);
    if (t > 0.45) seg(prev.chin, cur.chin, PAL.cyan3);
    prev = cur;
  }
  prev = pts(0.4);
  for (let i = 1; i <= N; i++) {
    const t = 0.4 + (0.6 * i) / N;
    const cur = pts(t);
    seg(prev.nose, cur.nose, PAL.white);
    prev = cur;
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = sm.get(x, y);
      if (c !== null && !p.isOpaque(x, y)) p.set(x, y, c);
    }
}

function claws(c: PixelCanvas, foot: V, far: boolean) {
  const col = far ? PAL.steel : PAL.white;
  const x = Math.floor(foot[0]);
  const y = Math.floor(foot[1]);
  c.set(x + 4, y + 1, col);
  c.set(x + 3, y + 2, col);
  c.set(x + 2, y + 2, col);
  c.set(x, y + 2, col);
  c.set(x - 1, y + 2, col);
}

/** Forefoot claws: two hooks growing straight out of the front of the palm (no gaps → no ink clutter). */
function hand(c: PixelCanvas, wr: V, ang: number, far: boolean) {
  const col = far ? PAL.steel : PAL.white;
  const tipCol = far ? PAL.night3 : PAL.mist;
  const palm = add(wr, polar(ang, 1));
  for (const [da, long] of [[0, true], [48, false]] as const) {
    // first pixel just outside the palm, touching it
    let k = 1.5;
    let a = flo(add(palm, polar(ang + da, k)));
    while (c.isOpaque(a[0], a[1]) && k < 6) {
      k += 0.5;
      a = flo(add(palm, polar(ang + da, k)));
    }
    c.set(a[0], a[1], col);
    if (long) {
      const b = flo(add(palm, polar(ang + da + 35, k + 1.2)));
      if (!c.isOpaque(b[0], b[1])) c.set(b[0], b[1], tipCol);
    }
  }
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

/**
 * Crystal wing. Every membrane panel is two flat glass facets (the leading one brighter), the
 * outer panel is the thinnest and brightest glass; the trailing edge carries one continuous
 * bright rim line, veins run from the wrist into each pleat. Bones are hide.
 */
function drawWing(r: WingRig, far: boolean, P: Pose): PixelCanvas {
  const g = newG();
  const glass = far ? M.GLASS_FAR : M.GLASS;
  const hide = far ? M.HIDE_FAR : M.HIDE;
  const { S, E, Wr, tips, attach } = r;
  const n = tips.length;
  const shield = P.guard && !far;
  // [leading, trailing] facet levels per panel (outer → inner)
  const levels: [number, number][] = shield ? [[2, 1], [2, 1], [2, 1]] : far ? [[4, 3], [3, 2], [3, 2]] : [[4, 3], [3, 2], [3, 2]];
  const gx = lerp(-20, 150, P.glint);
  const glintAt = (x: number, y: number) => {
    if (P.glint < 0) return 0;
    const d = x + y - gx;
    return d >= 0 && d < 3 ? 1 : 0;
  };
  const valleys: V[] = [];
  const curves: V[][] = [];
  for (let i = 0; i < n; i++) {
    const a = tips[i];
    const inner = i + 1 >= n;
    const b = inner ? attach : tips[i + 1];
    const hub = inner ? lerpV(Wr, E, 0.5) : Wr;
    // trailing edge: a soft scallop between two finger tips
    const curve = bezier(a, lerpV(lerpV(a, b, 0.5), hub, inner ? 0.42 : 0.62), b, undefined, 10);
    valleys.push(curve[5]);
    curves.push(curve);
    const [lead, trail] = levels[Math.min(i, levels.length - 1)];
    gFacet(g, [Wr, ...curve.slice(0, 6)], glass, FLAT_N, 0, (x, y) => lead + glintAt(x, y));
    if (!inner) gFacet(g, [Wr, ...curve.slice(5)], glass, FLAT_N, 0, (x, y) => trail + glintAt(x, y));
    else gFacet(g, [Wr, ...curve.slice(5), S, E], glass, FLAT_N, 0, (x, y) => trail + glintAt(x, y));
  }
  // arm bones (leading edge)
  gTube(g, [S, E, Wr], 4.8, 3.6, hide, { z: 4, flat: 1.2 });
  gEll(g, Wr, 2.5, 2.5, 0, hide, { z: 5 });
  gEll(g, E, 2.7, 2.7, 0, hide, { z: 5 });
  // crystal spur growing out of the elbow
  const out = norm(add(norm(sub(E, S)), norm(sub(E, Wr))));
  if (!far) gShard(g, E, out, 6, 1.8, M.CRYS, 7, P.glow);
  const c = g.render();

  // trailing-edge rim: glass pixels on the silhouette next to a scallop → one bright line
  const rim = far ? PAL.cyan3 : shield ? PAL.cyan3 : PAL.white;
  const glassCols = new Set(MATS[glass].ramp);
  const hits: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const col = c.get(x, y);
      if (col === null || !glassCols.has(col)) continue;
      if (c.isOpaque(x - 1, y) && c.isOpaque(x + 1, y) && c.isOpaque(x, y - 1) && c.isOpaque(x, y + 1)) continue;
      const q: V = [x + 0.5, y + 0.5];
      let near = false;
      for (const cv of curves) if (distPoly(q, cv) < 1.6) near = true;
      if (near) hits.push(x, y);
    }
  for (let i = 0; i < hits.length; i += 2) c.set(hits[i], hits[i + 1], rim);

  // glowing veins from the wrist down every pleat valley
  const glow = P.glow;
  const vein = far ? (glow > 0.6 ? PAL.cyan3 : PAL.cyan2) : shield ? PAL.cyan3 : glow > 0.75 ? PAL.white : PAL.cyan4;
  const onGlass = (cur: number) => glassCols.has(cur) && cur !== rim;
  if (!shield && (!far || glow > 0.4)) for (let i = 0; i < n; i++) lineOn(c, lerpV(Wr, valleys[i], 0.25), lerpV(Wr, valleys[i], 0.8), vein, onGlass);
  if (!far && !shield) {
    // the broad arm membrane gets one more vein fanning from the elbow
    const inner = curves[n - 1];
    const root = lerpV(E, Wr, 0.3);
    lineOn(c, lerpV(root, inner[7], 0.2), lerpV(root, inner[7], 0.78), vein, onGlass);
  }

  // finger bones: a two-tone 2px spar that thins to a single bright line toward the tip
  // (folded into a shield they are plain 1px ribs that stay inside the glass)
  const boneHi = far ? PAL.mist : PAL.white;
  const boneLo = far ? PAL.steel : PAL.mist;
  for (let i = 0; i < n; i++) {
    if (shield) {
      lineOn(c, lerpV(Wr, tips[i], 0.2), lerpV(Wr, tips[i], 0.86), i === 0 ? PAL.white : PAL.mist);
      continue;
    }
    const t = tips[i];
    const dir = norm(sub(t, Wr));
    // shadow side of the spar is the side away from the key light
    const side: V = Math.abs(dir[0]) > Math.abs(dir[1]) ? [0, 1] : [dir[1] > 0 ? -1 : 1, 0];
    const mid = lerpV(Wr, t, 0.55);
    const a = flo(Wr);
    const b = flo(mid);
    const e = flo(t);
    c.line(a[0], a[1], b[0], b[1], boneHi);
    c.line(a[0] + side[0], a[1] + side[1], b[0] + side[0], b[1] + side[1], boneLo);
    c.line(b[0], b[1], e[0], e[1], i === 0 ? boneHi : boneLo);
  }
  return c;
}

// ------------------------------------------------------------------ head

/** head scale (the card portrait draws the same head bigger) */
let HS = 1.2;
const HINGE: V = [-1.5, 1.4];
const JAW_OPEN = 0.62; // ~35° at jaw = 1

interface HeadFrame {
  T: (x: number, y: number) => V;
  J: (x: number, y: number) => V;
  jawA: number;
}

function headFrame(hp: V, P: Pose): HeadFrame {
  const ha = P.ha;
  const T = (x: number, y: number): V => add(hp, rotV([x * HS, y * HS], ha));
  const jawA = P.jaw * JAW_OPEN;
  const J = (x: number, y: number): V => {
    const q = add(HINGE, rotV(sub([x, y], HINGE), jawA));
    return T(q[0], q[1]);
  };
  return { T, J, jawA };
}

/** Centre of the open mouth (beam origin). */
function mouthPoint(P: Pose): V {
  const { T, J } = headFrame(rig(P).head, P);
  return lerpV(T(16, 1.4), J(15.5, 1.4), 0.5);
}

// Head planes in head space (x forward along the snout, y down; scaled by HS, rotated by ha).
type P2 = [number, number];
// side plane of skull + snout (mist)
const SKULL: P2[] = [[-5, 1.4], [-6.4, -2], [-4.8, -5.4], [-0.8, -7.3], [4.4, -7.4], [7.8, -6.2], [9.8, -4.7], [14.8, -3.8], [17.4, -3.4], [18.8, -2.2], [19.1, -0.3], [18.3, 1.4], [10, 1.4], [3, 1.4]];
// lit top plane: crown, brow ridge and the bridge of the snout (white)
const SKULL_TOP: P2[] = [[-4.8, -5.4], [-0.8, -7.3], [4.4, -7.4], [7.8, -6.2], [9.8, -4.7], [14.8, -3.8], [17.4, -3.4], [18.8, -2.2], [17, -2], [14.4, -2.5], [9.2, -3.3], [7.2, -4.9], [3.6, -5.8], [-0.4, -5.8], [-4.4, -3.8]];
// shadowed cheek below/behind the eye and the upper lip band (steel)
const CHEEK: P2[] = [[-5, 1.4], [-6.4, -2], [-5.4, -1.6], [-1.6, -1.2], [2.6, 0], [4.6, 1.4]];
const LIP: P2[] = [[3.6, 0.2], [12, -0.2], [19, -0.6], [18.3, 1.4], [3, 1.4]];
// lower jaw (rotates about HINGE): side plane (mist) and its shadowed underside (steel)
const JAW: P2[] = [[-4.4, 1.4], [18, 1.4], [18.2, 2.9], [15.2, 4.2], [9, 5.0], [2, 5.8], [-2.6, 5.6], [-4.8, 3.6]];
const JAW_UNDER: P2[] = [[18.2, 2.9], [15.2, 4.2], [9, 5.0], [2, 5.8], [-2.6, 5.6], [-3.2, 4.6], [2, 4.6], [9, 3.8], [15, 3.1]];

// eye: 2×2 white core, cyan4 surround, cyan3 trail backward, under a steel brow; night3 socket
const EYE_OPEN = ['.SSSSS', '34WWn.', '.4WWn.', '..nn..'];
const EYE_SHUT = ['.SSSS', 'nnnn.', '..2..'];
const EYE_KEY: Record<string, number> = { S: PAL.steel, W: PAL.white, '4': PAL.cyan4, '3': PAL.cyan3, n: PAL.night3, '2': PAL.cyan2 };

const MOUTH_MASK = new Uint8Array(W * H);
const JAW_MASK = new Uint8Array(W * H);

function drawHead(p: PixelCanvas, hp: V, P: Pose) {
  const { T, J, jawA } = headFrame(hp, P);
  const Ts = (pts: P2[]) => pts.map(([x, y]) => T(x, y));
  const Js = (pts: P2[]) => pts.map(([x, y]) => J(x, y));
  const open = P.jaw > 0.1;
  MOUTH_MASK.fill(0);
  JAW_MASK.fill(0);

  // mouth cavity: dark throat at the back, glowing prism light at the front when charged
  if (open) {
    const g = newG();
    gFacet(g, [T(-2.6, 1.4), T(18.3, 1.4), J(18, 1.4), J(-2.6, 1.4)], M.MOUTH, FLAT_N, 0);
    const c = g.render();
    const back = T(-1, 1.4);
    const front = T(18.3, 1.4);
    const m = lerpV(T(16, 1.4), J(15.5, 1.4), 0.5); // == mouthPoint(P) on the dragon
    const glowM = P.mouth;
    const axis = sub(front, back);
    const al = len(axis) || 1;
    const jawLine = [J(-2, 1.4), J(18, 1.4)];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!c.isOpaque(x, y)) continue;
        const q: V = [x + 0.5, y + 0.5];
        const along = ((q[0] - back[0]) * axis[0] + (q[1] - back[1]) * axis[1]) / (al * al);
        const dm = len(sub(q, m));
        let col: number = along < 0.42 ? PAL.night0 : PAL.night1;
        if (glowM > 0.5) {
          if (dm < 1.9) col = PAL.white;
          else if (dm < 3.1) col = PAL.cyan4;
          else if (dm < 4.3) col = PAL.cyan3;
          else if (along > 0.5) col = PAL.cyan1;
        } else if (along > 0.3 && along < 0.85 && distSeg(q, jawLine[0], jawLine[1]) < 1.6) col = PAL.crim1; // tongue
        c.set(x, y, col);
      }
    maskOf(c, MOUTH_MASK);
    composite(p, c);
  }

  // lower jaw (own layer, own contour: an ink gape line where it meets the open mouth)
  {
    const g = newG();
    gFacet(g, Js(JAW), M.HIDE_D, FLAT_N, 0, 3);
    gFacet(g, Js(JAW_UNDER), M.HIDE_D, FLAT_N, 0, 2);
    const c = g.render();
    maskOf(c, JAW_MASK);
    composite(p, c, (x, y, b) => (MOUTH_MASK[y * W + x] ? PAL.ink : selout(x, y, b)));
  }

  // upper head: side plane, cheek, lip band, lit top plane with the brow
  const g = newG();
  gFacet(g, Ts(SKULL), M.HIDE_D, FLAT_N, 0, 3);
  gFacet(g, Ts(CHEEK), M.HIDE_D, FLAT_N, 0, 2);
  gFacet(g, Ts(LIP), M.HIDE_D, FLAT_N, 0, 2);
  gFacet(g, Ts(SKULL_TOP), M.HIDE_D, FLAT_N, 0, 4);
  const c = g.render();
  // nostril
  {
    const n0 = flo(T(17.4, -1.5));
    c.paint(n0[0], n0[1], PAL.night2);
    c.paint(n0[0] - 1, n0[1], PAL.night3);
  }
  // charged lips: a thread of light leaks between the closed jaws
  if (!open && P.mouth > 0.2) lineOn(c, T(6, 1.0), T(18.5, 0.8), P.mouth > 0.6 ? PAL.cyan4 : PAL.cyan3);
  composite(p, c, (x, y, b) => {
    const i = y * W + x;
    if (MOUTH_MASK[i]) return PAL.ink;
    if (JAW_MASK[i]) return open ? PAL.ink : PAL.night2;
    return selout(x, y, b);
  });
  // eye (the brightest pixels of the sprite)
  {
    const e = flo(T(4.4, -3.6));
    const rows = P.eye > 0.5 ? EYE_OPEN : EYE_SHUT;
    for (let j = 0; j < rows.length; j++)
      for (let i = 0; i < rows[j].length; i++) {
        const col = EYE_KEY[rows[j][i]];
        if (col === undefined) continue;
        const x = e[0] + i - 2;
        const y = e[1] + j - 1;
        if (p.isOpaque(x, y) && p.get(x, y) !== PAL.ink) p.set(x, y, col);
      }
    if (P.eye > 0.5 && P.glow > 0.85) {
      const x = e[0] - 3;
      const y = e[1];
      if (p.isOpaque(x, y) && p.get(x, y) !== PAL.ink) p.set(x, y, PAL.cyan3);
    }
  }

  // fangs: white teeth hang just inside the ink gape line
  if (open) {
    const down = rotV([0, 1], P.ha);
    const up = rotV([0, -1], P.ha + jawA);
    const tooth = (from: V, dir: V, long: boolean) => {
      let seenInk = false;
      let last = '';
      for (let k = 0; k < 9; k += 0.5) {
        const q = flo(add(from, mul(dir, k)));
        const key = q[0] + ',' + q[1];
        if (key === last) continue;
        last = key;
        if (q[0] < 0 || q[1] < 0 || q[0] >= W || q[1] >= H) return;
        const i = q[1] * W + q[0];
        const cur = p.get(q[0], q[1]);
        if (!MOUTH_MASK[i]) {
          if (seenInk) return;
          continue;
        }
        if (cur === PAL.ink) {
          seenInk = true;
          continue;
        }
        p.set(q[0], q[1], PAL.white);
        if (long) {
          const q2 = flo(add(from, mul(dir, k + 1)));
          if (MOUTH_MASK[q2[1] * W + q2[0]] && p.get(q2[0], q2[1]) !== PAL.ink) p.set(q2[0], q2[1], PAL.mist);
        }
        return;
      }
    };
    for (const [tx, long] of [[6.5, false], [10, true], [13.5, true], [17, true]] as const) tooth(T(tx, 0.4), down, long);
    for (const tx of [12, 16.2]) tooth(J(tx, 2.6), up, false);
  }

  // horns (gold): the main sweep off the crown and a cheek horn
  {
    const g2 = newG();
    const k = HS / 1.2;
    gTube(g2, bezier(T(-1.6, -6.2), T(-6.8, -8.4), T(-11.8, -8.8), T(-16.2, -12), 12), 3.8 * k, 1, M.GOLD);
    gTube(g2, bezier(T(-3.6, -0.4), T(-7, -0.2), T(-9.4, 0.8), T(-11.6, 3), 8), 2.6 * k, 1, M.GOLD, { z: 1 });
    composite(p, g2.render());
  }
}

// ------------------------------------------------------------------ animations

const IDLE_N = 12;
// one twinkle travels across the near wing's glass, then the arm membrane
const IDLE_SPARKS: [number, number][][] = [[], [[0, 1]], [[0, 2]], [[0, 2]], [[0, 1]], [], [], [[1, 1]], [[1, 2]], [[1, 2]], [[1, 1]], []];

function idlePose(f: number): Pose {
  const t = f / IDLE_N;
  // breathing + one slow wing beat per loop: the downstroke lifts the body; forearm and finger
  // tips trail the shoulder by one and two frames (secondary motion). Frame 0 == NEUTRAL.
  const s = Math.sin(t * Math.PI * 2);
  const beat = (lagFrames: number) => Math.sin((t - lagFrames / IDLE_N) * Math.PI * 2);
  return pose({
    hy: Math.round(s * 1),
    lean: -0.025 * s,
    headY: Math.round(beat(1.5)),
    nw: { a1: NEUTRAL.nw.a1 - 4 * s, a2: NEUTRAL.nw.a2 - 3.5 * beat(1), a3: NEUTRAL.nw.a3 - 4 * beat(2) },
    fw: { a1: NEUTRAL.fw.a1 - 4 * s, a2: NEUTRAL.fw.a2 - 4 * beat(1), a3: NEUTRAL.fw.a3 - 5 * beat(2) },
    tail: t,
    glow: 0.3 + 0.2 * Math.sin((t - 0.25) * Math.PI * 2),
    glint: t * 1.6 - 0.3,
    sparkles: IDLE_SPARKS[f % IDLE_N],
  });
}

// far wing spread wide behind the neck (roar): it turns toward the viewer, so it reads bigger
const FW_SPREAD: Partial<Wing> = { a1: -40, a2: -14, a3: -56, fan: 33, span: 1.3, at: [7, 3] };
const NW_SPREAD: Partial<Wing> = { a1: -120, a2: -144, a3: -110, fan: -46, span: 1.05 };

// roar: crouch (anticipation) → explode upward, rear, wings flung wide → trembling roar → settle
const ROAR: PoseDelta[] = [
  {},
  { hy: 2, lean: 0.07, headX: 0, headY: 4, ha: 0.4, nw: { a1: -100, a2: -122, a3: -128, fan: -26 }, fw: { a1: -92, a2: -116, a3: -100, fan: -20 }, tailLift: -5, arm: -6, glow: 0.4 },
  { hy: 3, lean: 0.12, headX: -1, headY: 7, ha: 0.55, nw: { a1: -96, a2: -118, a3: -132, fan: -22 }, fw: { a1: -94, a2: -118, a3: -104, fan: -18 }, tailLift: -8, arm: -12, glow: 0.55 },
  // explode upward: rear on the hind legs (chest high, back leaning), head thrown to the sky,
  // both wings flung open (overshoot)
  { hy: -2, lean: -0.47, headX: -7, headY: 3, ha: -0.82, jaw: 0.72, nw: { ...NW_SPREAD, a1: -124, fan: -49 }, fw: { ...FW_SPREAD, a1: -44 }, tailLift: 16, arm: 62, glow: 1, tail: 0.1, sparkles: [[0, 2], [2, 1]] },
  // trembling roar: the whole body vibrates, jaws quiver, energy pulses
  { hx: 1, hy: -1, lean: -0.42, headX: -6, headY: 2, ha: -0.8, jaw: 0.82, nw: NW_SPREAD, fw: FW_SPREAD, tailLift: 13, arm: 55, glow: 1, tail: 0.25, sparkles: [[0, 1], [1, 2]] },
  { hx: -1, hy: -1, lean: -0.43, headX: -7, headY: 2, ha: -0.83, jaw: 0.76, nw: { ...NW_SPREAD, a1: -118 }, fw: { ...FW_SPREAD, a1: -38 }, tailLift: 14, arm: 58, glow: 0.8, tail: 0.4, sparkles: [[1, 1], [3, 2]] },
  { hx: 1, hy: -1, lean: -0.42, headX: -6, headY: 2, ha: -0.8, jaw: 0.82, nw: NW_SPREAD, fw: FW_SPREAD, tailLift: 13, arm: 55, glow: 1, tail: 0.55, sparkles: [[3, 1], [2, 2]] },
  { hx: 0, hy: -1, lean: -0.34, headX: -5, headY: 2, ha: -0.64, jaw: 0.66, nw: { a1: -116, a2: -142, a3: -112, fan: -44 }, fw: { a1: -50, a2: -30, a3: -66, fan: 26, span: 1.2, at: [6, 2] }, tailLift: 11, arm: 45, glow: 0.8, tail: 0.7 },
  // release: the far wing folds back through an in-between (never pops)
  { hy: 0, lean: -0.14, headX: -1, headY: 0, ha: -0.2, jaw: 0.35, nw: { a1: -111, a2: -140, a3: -115, fan: -41 }, fw: { a1: -68, a2: -70, a3: -56, fan: -22, span: 1.08, at: [1, -2] }, tailLift: 5, arm: 18, glow: 0.6, tail: 0.85 },
  { hy: 0, lean: -0.03, ha: 0.06, nw: { a1: -108, a2: -139 }, fw: { a1: -82, a2: -106, a3: -92, fan: -24 }, glow: 0.4, tail: 0.95 },
];

// attack "Prizma Nefesi": the whole body coils (torso leans back, wings rise and spread, head
// pulled back behind the neck) while light gathers in the jaws → the head whips forward past
// neutral with the chest leaning in, jaws flung open (beam fires from `muzzle`), wings snap
// back then flare open, tail whips → beam kickback pushes the head back 1–2 px a frame → settle.
const ATTACK: PoseDelta[] = [
  {},
  { hx: -1, hy: -1, lean: -0.08, headX: -5, headY: -1, ha: -0.04, nw: { a1: -113, a2: -144, a3: -114, fan: -44 }, fw: { a1: -88, a2: -114 }, glow: 0.5, mouth: 0.25, tailLift: 4, arm: 8 },
  { hx: -2, hy: -1, lean: -0.15, headX: -10, headY: -2, ha: -0.18, nw: { a1: -119, a2: -150, a3: -108, fan: -48 }, fw: { a1: -92, a2: -118, a3: -88 }, glow: 0.7, mouth: 0.55, tailLift: 9, arm: 16, sparkles: [[3, 1]] },
  { hx: -3, hy: -2, lean: -0.2, headX: -13, headY: -2, ha: -0.28, jaw: 0.14, nw: { a1: -123, a2: -155, a3: -104, fan: -51 }, fw: { a1: -95, a2: -121, a3: -86 }, glow: 0.9, mouth: 0.8, tailLift: 10, arm: 22, sparkles: [[3, 2], [0, 1]] },
  { hx: -3, hy: -2, lean: -0.22, headX: -14, headY: -2, ha: -0.32, jaw: 0.2, nw: { a1: -125, a2: -157, a3: -102, fan: -52 }, fw: { a1: -96, a2: -122, a3: -85 }, glow: 1, mouth: 1, tailLift: 11, arm: 26, sparkles: [[0, 2], [1, 1], [2, 1]] },
  // IMPACT — the Prism Breath fires: lunge past neutral, jaws flung wide, wings swept back
  { hx: 1, hy: 1, lean: 0.12, headX: 1, headY: 4, ha: 0.02, jaw: 1, nw: { a1: -131, a2: -167, a3: -112, fan: -46 }, fw: { a1: -104, a2: -130, a3: -84, fan: -34 }, glow: 1, mouth: 1, tailLift: -6, tail: 0.18, tailAmp: 6, arm: -14 },
  // kickback: the beam pushes the head and chest back, the wings flare open
  { hx: 1, hy: 1, lean: 0.1, headX: 0, headY: 3, ha: 0.0, jaw: 1, nw: { a1: -124, a2: -156, a3: -98, fan: -53 }, fw: { a1: -99, a2: -125, a3: -82, fan: -34 }, glow: 1, mouth: 1, tailLift: -1, tail: 0.3, tailAmp: 5, arm: -8 },
  { hx: 0, hy: 1, lean: 0.08, headX: 0, headY: 3, ha: 0.02, jaw: 0.95, nw: { a1: -117, a2: -149, a3: -106, fan: -47 }, fw: { a1: -93, a2: -119, a3: -87, fan: -31 }, glow: 0.9, mouth: 0.9, tailLift: -4, tail: 0.45, tailAmp: 5, arm: -4 },
  { hx: 0, hy: 0, lean: 0.04, headX: -1, headY: 2, ha: 0.06, jaw: 0.6, nw: { a1: -111, a2: -141, a3: -115 }, fw: { a1: -87, a2: -112 }, glow: 0.6, mouth: 0.3, tailLift: -2, tail: 0.6 },
  { hy: 0, lean: 0.01, headX: 0, headY: 1, ha: 0.09, jaw: 0.12, nw: { a1: -108 }, glow: 0.4, tail: 0.8 },
];
const IMPACT = 5;
ATTACK[IMPACT].smearFrom = ATTACK[IMPACT - 1];

// hit: snapped back, eyes squeezed shut, wings flinch inward → shakes it off
const HIT: PoseDelta[] = [
  { hx: -3, lean: -0.2, headX: -5, headY: -1, ha: -0.3, jaw: 0.28, eye: 0, nw: { a1: -95, a2: -117, a3: -117, fan: -30 }, fw: { a1: -96, a2: -122, fan: -22 }, tailLift: 4, arm: 28, glow: 0.05 },
  { hx: -4, hy: 1, lean: -0.08, headX: -2, headY: 3, ha: 0.24, jaw: 0.2, eye: 0, nw: { a1: -100, a2: -126, a3: -114, fan: -35 }, fw: { a1: -92, fan: -24 }, tailLift: -2, arm: 10, glow: 0.15, tail: 0.2 },
  { hx: -1, hy: 1, lean: -0.02, headX: -1, headY: 1, ha: 0.14, jaw: 0, eye: 1, nw: { a1: -105, a2: -134 }, glow: 0.25, tail: 0.35 },
  { hx: 0, hy: 0, lean: 0, headX: 0, headY: 0, ha: 0.11, nw: { a1: -107 }, glow: 0.3, tail: 0.45 },
];

const GUARD_N = 8;

function guardPose(f: number): Pose {
  // slow breathing in 1px steps (0,0,1,2,2,2,1,0); wing ribs and tail trail the body by a frame
  const bob = (k: number) => Math.round(1 - Math.cos((((k % GUARD_N) + GUARD_N) % GUARD_N) / GUARD_N * Math.PI * 2));
  const b = bob(f);
  const bl = bob(f - 1);
  const s = Math.sin(((f - 1) / GUARD_N) * Math.PI * 2);
  return pose({
    guard: true,
    hy: 3 + b,
    lean: 0.16,
    headX: -3,
    headY: 12 + b,
    ha: 0.34,
    nw: { a1: -64 + bl, a2: 40 + bl * 0.8, a3: 76, fan: 21 },
    fw: { a1: -50 + bl, a2: 60, a3: 85, fan: 15 },
    tailLift: -14 + bl,
    tailAmp: 2,
    tail: (f - 1) / GUARD_N,
    arm: 24,
    glow: 0.35 + 0.2 * s,
    // a slow glint sweeps across the crystal shield, then it rests
    glint: f < 2 ? -1 : 0.42 + (f - 2) * 0.09,
  });
}

function framePose(anim: MonsterAnim, f: number): Pose {
  switch (anim) {
    case 'idle':
      return idlePose(f);
    case 'roar':
      return pose(ROAR[f] ?? {});
    case 'attack':
      return pose(ATTACK[f] ?? {});
    case 'hit':
      return pose(HIT[f] ?? {});
    case 'guard':
      return guardPose(f);
  }
}

const ANIMS = {
  idle: { frames: IDLE_N, fps: 10, loop: true },
  roar: { frames: ROAR.length, fps: 10, loop: false },
  attack: { frames: ATTACK.length, fps: 10, loop: false },
  hit: { frames: HIT.length, fps: 10, loop: false },
  guard: { frames: GUARD_N, fps: 6, loop: true },
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

  // the character is built on its own transparent canvas, outlined once, then laid on the rays
  const ch = new PixelCanvas(W, H);
  const P = pose({ glow: 0.9, jaw: 0.4, mouth: 0.8, ha: 0.04 });
  const hp: V = [13, 15];
  // crystal wing glass behind, top-left
  {
    const g = newG();
    const Wr: V = [2, 2];
    gFacet(g, [Wr, [24, -6], [16, 6]], M.GLASS, FLAT_N, 0, 4);
    gFacet(g, [Wr, [16, 6], [12, 12], [0, 14]], M.GLASS, FLAT_N, 0, 3);
    const c = g.render();
    lineOn(c, [3, 3], [15, 5], PAL.white);
    lineOn(c, [3, 4], [10, 11], PAL.cyan4);
    composite(ch, c);
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
    composite(ch, gs.render());
    const g = newG();
    gTube(g, neck, 13, 16, M.HIDE, { facets: 4, belly: { from: 0.3, lift: 0.16 } });
    const c = g.render();
    rimLight(c, ch);
    composite(ch, c);
  }
  HS = 1.48;
  drawHead(ch, hp, P);
  HS = 1.2;
  ch.outline(PAL.ink);
  p.blit(ch, 0, 0);
}

// ------------------------------------------------------------------ export

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
