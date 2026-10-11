// HD render — math kit: 2D/3D vectors, paths (Bézier / Catmull-Rom spines), easing and
// deterministic noise. Everything here is allocation-light and works in Node and the browser.
//
// Conventions (shared by the whole src/hd/render library):
//   - Screen space: x → right, y → DOWN, z → TOWARD THE VIEWER (bigger z = in front).
//   - Angles given in degrees are named `deg`; radians are named `rad` / `a`.
//   - V2 / V3 are readonly tuples; helpers always return new tuples.

export type V2 = readonly [number, number];
export type V3 = readonly [number, number, number];

export const DEG = Math.PI / 180;
export const TAU = Math.PI * 2;

// ------------------------------------------------------------------ scalars

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Inverse lerp: where `v` sits between a and b (unclamped). */
export const invLerp = (a: number, b: number, v: number): number => (b === a ? 0 : (v - a) / (b - a));
export const remap = (v: number, a0: number, a1: number, b0: number, b1: number): number => lerp(b0, b1, invLerp(a0, a1, v));
export const smoothstep = (a: number, b: number, v: number): number => {
  const t = clamp01(invLerp(a, b, v));
  return t * t * (3 - 2 * t);
};
export const fract = (v: number): number => v - Math.floor(v);
/** Positive modulo (wraps negatives the way animation loops expect). */
export const mod = (v: number, m: number): number => ((v % m) + m) % m;
/** Shortest signed difference between two angles in degrees (b - a, in -180..180). */
export const angleDiffDeg = (a: number, b: number): number => mod(b - a + 180, 360) - 180;
/** Interpolate angles (degrees) along the shortest arc. */
export const lerpAngleDeg = (a: number, b: number, t: number): number => a + angleDiffDeg(a, b) * t;

// ------------------------------------------------------------------ 2D vectors

export const v2 = (x: number, y: number): V2 => [x, y];
export const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: V2, k: number): V2 => [a[0] * k, a[1] * k];
/** a + b * k */
export const madd = (a: V2, b: V2, k: number): V2 => [a[0] + b[0] * k, a[1] + b[1] * k];
export const dot = (a: V2, b: V2): number => a[0] * b[0] + a[1] * b[1];
export const cross = (a: V2, b: V2): number => a[0] * b[1] - a[1] * b[0];
export const len = (a: V2): number => Math.hypot(a[0], a[1]);
export const dist = (a: V2, b: V2): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const norm = (a: V2): V2 => {
  const l = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / l, a[1] / l];
};
/** Perpendicular (rotated +90° on screen, i.e. clockwise because y points down). */
export const perp = (a: V2): V2 => [-a[1], a[0]];
export const lerpV = (a: V2, b: V2, t: number): V2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const mid = (a: V2, b: V2): V2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
export const rotV = (a: V2, rad: number): V2 => {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [a[0] * c - a[1] * s, a[0] * s + a[1] * c];
};
/** Rotate point p around center c. */
export const rotAround = (p: V2, c: V2, rad: number): V2 => add(c, rotV(sub(p, c), rad));
/** Vector of length r at `deg` degrees (0 = right, 90 = DOWN). */
export const polar = (deg: number, r: number): V2 => [Math.cos(deg * DEG) * r, Math.sin(deg * DEG) * r];
export const angleOf = (a: V2): number => Math.atan2(a[1], a[0]);
export const angleDegOf = (a: V2): number => Math.atan2(a[1], a[0]) / DEG;
export const round2 = (a: V2): V2 => [Math.round(a[0]), Math.round(a[1])];
export const floor2 = (a: V2): V2 => [Math.floor(a[0]), Math.floor(a[1])];

// ------------------------------------------------------------------ 3D vectors

export const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot3 = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm3 = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// ------------------------------------------------------------------ paths / spines

/** Points along a quadratic (3 points) or cubic (4 points) Bézier, n segments (n + 1 points). */
export function bezier(p0: V2, p1: V2, p2: V2, p3?: V2, n = 16): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    if (p3) {
      const a = u * u * u;
      const b = 3 * u * u * t;
      const c = 3 * u * t * t;
      const d = t * t * t;
      out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
    } else {
      out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
    }
  }
  return out;
}

/**
 * Centripetal-ish Catmull-Rom spline THROUGH the given points (good for spines built from bone
 * joints: the curve passes every joint). `perSeg` samples between consecutive points.
 */
export function catmull(pts: readonly V2[], perSeg = 6): V2[] {
  if (pts.length < 3) return pts.slice();
  const out: V2[] = [];
  const P = (i: number) => pts[clamp(i, 0, pts.length - 1)];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1);
    const p1 = P(i);
    const p2 = P(i + 1);
    const p3 = P(i + 2);
    for (let s = 0; s < perSeg; s++) {
      const t = s / perSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Cumulative arc lengths of a polyline (lens[0] = 0, lens[n-1] = total). */
export function pathLengths(path: readonly V2[]): number[] {
  const lens = [0];
  for (let i = 1; i < path.length; i++) lens.push(lens[i - 1] + dist(path[i], path[i - 1]));
  return lens;
}

/** Point and unit tangent at arc-length fraction t (0..1) of a polyline. */
export function samplePath(path: readonly V2[], t: number, lens = pathLengths(path)): { p: V2; tan: V2 } {
  if (path.length < 2) return { p: path[0] ?? [0, 0], tan: [1, 0] };
  const target = clamp01(t) * lens[lens.length - 1];
  for (let i = 1; i < path.length; i++) {
    if (lens[i] >= target || i === path.length - 1) {
      const seg = lens[i] - lens[i - 1] || 1;
      const k = clamp01((target - lens[i - 1]) / seg);
      return { p: lerpV(path[i - 1], path[i], k), tan: norm(sub(path[i], path[i - 1])) };
    }
  }
  return { p: path[path.length - 1], tan: [1, 0] };
}

/** Resample a polyline into n + 1 points evenly spaced by arc length. */
export function resample(path: readonly V2[], n: number): V2[] {
  const lens = pathLengths(path);
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) out.push(samplePath(path, i / n, lens).p);
  return out;
}

/** Offset a point sideways from a path sample: + side = perp(tangent) (screen-clockwise). */
export function offsetFromPath(path: readonly V2[], t: number, side: number): V2 {
  const s = samplePath(path, t);
  return madd(s.p, perp(s.tan), side);
}

/** Distance from p to segment ab. */
export function distSeg(p: V2, a: V2, b: V2): number {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const t = clamp01(((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / (abx * abx + aby * aby || 1));
  return Math.hypot(p[0] - a[0] - abx * t, p[1] - a[1] - aby * t);
}

/** Polygon area sign (+ = clockwise on screen because y points down). */
export function polyArea(pts: readonly V2[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) a += cross(pts[i], pts[(i + 1) % pts.length]);
  return a / 2;
}

export function centroid(pts: readonly V2[]): V2 {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
  }
  return [x / pts.length, y / pts.length];
}

// ------------------------------------------------------------------ easing

export type EaseFn = (t: number) => number;

/** Easing curves (t in 0..1 → 0..1, except back/elastic which overshoot). */
export const ease = {
  linear: (t: number) => t,
  step: (t: number) => (t < 1 ? 0 : 1),
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outExpo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t: number) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  inBack: (t: number) => {
    const c1 = 1.70158;
    return (c1 + 1) * t * t * t - c1 * t * t;
  },
  outElastic: (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  /** Smooth loop: 0 → 1 → 0 over t in 0..1. */
  pingpong: (t: number) => 0.5 - 0.5 * Math.cos(t * TAU),
  /** Snappy hold-then-snap used for pixel poses (holds the start, snaps late). */
  snap: (t: number): number => (t < 0.7 ? 0.25 * (t / 0.7) * (t / 0.7) : 0.25 + 0.75 * (1 - Math.pow(1 - (t - 0.7) / 0.3, 3))),
} satisfies Record<string, EaseFn>;

export type EaseName = keyof typeof ease;

export function easeFn(e: EaseName | EaseFn | undefined): EaseFn {
  if (!e) return ease.inOutQuad;
  return typeof e === 'function' ? e : ease[e];
}

/** Sine wave over a loop phase t (0..1) with a phase offset (in loop fractions), range -1..1. */
export const wave = (t: number, phase = 0): number => Math.sin((t + phase) * TAU);

// ------------------------------------------------------------------ deterministic random + noise

/** Mulberry32 PRNG — deterministic per seed. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer hash → 0..1 (deterministic, stateless). */
export function hash3(x: number, y: number, z: number, seed = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1440662683) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const sm = (t: number) => t * t * (3 - 2 * t);

// Value-noise lattices are cached per seed (128 × 128, periodic): a lookup instead of a hash
// per corner makes fire / fur noise several times cheaper. Period 128 noise units — far larger
// than any sprite feature, so the tiling is never visible.
const LAT = 128;
const LATM = LAT - 1;
const lattices = new Map<number, Float32Array>();
const latSmall: (Float32Array | undefined)[] = [];
function lattice(seed: number): Float32Array {
  // small non-negative seeds (the usual case) hit a plain array; others a Map
  if (seed >= 0 && seed < 4096) {
    const l = latSmall[seed];
    if (l) return l;
  } else {
    const l = lattices.get(seed);
    if (l) return l;
  }
  const l = new Float32Array(LAT * LAT);
  for (let y = 0; y < LAT; y++) for (let x = 0; x < LAT; x++) l[y * LAT + x] = hash3(x, y, 0, seed);
  if (seed >= 0 && seed < 4096) latSmall[seed] = l;
  else {
    if (lattices.size > 64) lattices.clear();
    lattices.set(seed, l);
  }
  return l;
}

/** Smooth value noise in 2D, range 0..1 (periodic every 128 units). */
export function noise2(x: number, y: number, seed = 0): number {
  const l = lattice(seed | 0);
  const xf = Math.floor(x);
  const yf = Math.floor(y);
  const fx = sm(x - xf);
  const fy = sm(y - yf);
  const x0 = xf & LATM;
  const y0 = (yf & LATM) * LAT;
  const x1 = (xf + 1) & LATM;
  const y1 = ((yf + 1) & LATM) * LAT;
  const a = l[y0 + x0];
  const b = l[y0 + x1];
  const c = l[y1 + x0];
  const d = l[y1 + x1];
  const ab = a + (b - a) * fx;
  return ab + (c + (d - c) * fx - ab) * fy;
}

/** Smooth value noise in 3D, range 0..1. */
export function noise3(x: number, y: number, z: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const fx = sm(x - xi);
  const fy = sm(y - yi);
  const fz = sm(z - zi);
  const h = (i: number, j: number, k: number) => hash3(xi + i, yi + j, zi + k, seed);
  const x00 = lerp(h(0, 0, 0), h(1, 0, 0), fx);
  const x10 = lerp(h(0, 1, 0), h(1, 1, 0), fx);
  const x01 = lerp(h(0, 0, 1), h(1, 0, 1), fx);
  const x11 = lerp(h(0, 1, 1), h(1, 1, 1), fx);
  return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz);
}

/** Fractal (fbm) value noise in 2D, range ~0..1. */
export function fbm2(x: number, y: number, octaves = 3, seed = 0): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += noise2(x, y, seed + o * 17) * amp;
    norm += amp;
    x *= 2.03;
    y *= 2.03;
    amp *= 0.5;
  }
  return sum / norm;
}

/**
 * Seamlessly LOOPING scrolling noise: the field flows along +flow (e.g. upward for fire) as the
 * loop phase t goes 0 → 1, and frame t = 1 equals t = 0 exactly. Two scrolled copies are
 * cross-faded (with contrast restored), so it never "pops" at the loop seam. Range ~0..1.
 */
export function flowNoise(x: number, y: number, t: number, flow: V2, octaves = 3, seed = 0): number {
  const tt = fract(t);
  const a = fbm2(x - flow[0] * tt, y - flow[1] * tt, octaves, seed);
  const b = fbm2(x - flow[0] * (tt - 1), y - flow[1] * (tt - 1), octaves, seed);
  const w = tt;
  const m = (1 - w) * (a - 0.5) + w * (b - 0.5);
  const k = 1 / Math.sqrt((1 - w) * (1 - w) + w * w);
  return 0.5 + m * k;
}
