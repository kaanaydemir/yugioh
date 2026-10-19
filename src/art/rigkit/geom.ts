// rigkit / geom — the 2-D vector helpers, curves and IK of the v3 rigs (A3_MIMARI §2, §3.1).
//
// COPIED from the slice (src/art/monsters-v3/crystal_wyrm-gbuf.ts vector helpers, ik, dorsal,
// samplePath, pathU, distSeg / distPoly, fillPoly; the magus' ik guard) and generalised: nothing
// here knows a frame size, a light or a monster. Pure and deterministic; every formula keeps the
// slice's floating-point order so the outputs stay byte-identical (tests/art/rigkit-fidelity*.test.ts).

/** A 2-D point / vector in art pixels (x right, y down). */
export type V = readonly [number, number];
/** A 3-D unit vector (normals, the key light). */
export type V3 = readonly [number, number, number];

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
export const TAU = Math.PI * 2;
export const polar = (deg: number, r: number): V => [Math.cos(deg * DEG) * r, Math.sin(deg * DEG) * r];
export const rotV = (a: V, rad: number): V => [a[0] * Math.cos(rad) - a[1] * Math.sin(rad), a[0] * Math.sin(rad) + a[1] * Math.cos(rad)];
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const rnd = (a: V): V => [Math.round(a[0]), Math.round(a[1])];
export const flo = (a: V): V => [Math.floor(a[0]), Math.floor(a[1])];
export const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1];

/** Normalised 3-D vector. */
export const n3 = (x: number, y: number, z: number): V3 => {
  const m = Math.hypot(x, y, z);
  return [x / m, y / m, z / m];
};

/** Distance from p to the segment a–b. */
export function distSeg(p: V, a: V, b: V): number {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const t = clamp(((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / (abx * abx + aby * aby || 1), 0, 1);
  return Math.hypot(p[0] - a[0] - abx * t, p[1] - a[1] - aby * t);
}

/** Distance from p to a polyline. (The cloth band measure is cloth.ts edgeDist.) */
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

/** Point and unit tangent at arc-length fraction t (0..1) of a polyline. */
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

/**
 * Two-bone IK: the middle joint (elbow / knee) of a limb rooted at `a` reaching for `b`, bone
 * lengths l1 / l2, bending to `bend` (+1 / −1: which side of a→b the joint falls on). An
 * unreachable target is clamped 0.01 px short of full extension (the limb never snaps straight),
 * a degenerate one (closer than 0.01 px) is treated as 0.01 px away (the magus' guard: no NaN).
 */
export function ik2(a: V, b: V, l1: number, l2: number, bend: number): V {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.max(0.01, Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01));
  const c = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const ang = Math.atan2(dy, dx) + bend * Math.acos(c);
  return [a[0] + Math.cos(ang) * l1, a[1] + Math.sin(ang) * l1];
}

/** "Up and back" for a creature facing right: the side a crest / ridge grows on (the wyrm's ref). */
export const DORSAL_REF: V = [-0.45, -0.89];

/** The dorsal side of a tangent: of its two normals, the one closer to `ref`. */
export function dorsal(t: V, ref: V = DORSAL_REF): V {
  const a: V = [-t[1], t[0]];
  const b: V = [t[1], -t[0]];
  return a[0] * ref[0] + a[1] * ref[1] > b[0] * ref[0] + b[1] * ref[1] ? a : b;
}

/** Scanline polygon fill sampled at pixel centres; calls cb for every covered pixel. */
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

/** Options of chain(): the secondary-motion lag of a tail / tentacle / scarf (the wyrm's tail). */
export interface ChainLag {
  /** px the chain is pushed along `dir` at the middle (`mid` of its length) and at the tip. */
  readonly mid: number;
  readonly tip: number;
  /** where the lag starts (fraction of the length; before it the chain is rigid). Default 0.3. */
  readonly from?: number;
  /** where it reaches `mid`. Default 0.65. */
  readonly at?: number;
  /** direction the lag pushes. Default [0, 1] (down: the body stepped up, the chain follows late). */
  readonly dir?: V;
}

/**
 * A segmented secondary chain (tail, tentacle, scarf, chain): from `root`, one segment of `step` px
 * per screen angle (deg) in `angles`; then the lag — the part past `from` follows a body move late,
 * ramping to `mid` px at `at` and to `tip` px at the end (overlap, REHBER HA-6). With
 * { from 0.3, at 0.65, dir down } this is the wyrm's tail formula (crystal_wyrm-rig.ts, `tailLag`;
 * equal to float rounding — the slice divides by the literal 0.35, this by at − from).
 */
export function chain(root: V, angles: readonly number[], step: number, lag?: ChainLag): V[] {
  const pts: V[] = [root];
  for (let i = 0; i < angles.length; i++) pts.push(add(pts[i], polar(angles[i], step)));
  if (!lag) return pts;
  const from = lag.from ?? 0.3;
  const at = lag.at ?? 0.65;
  const dir = lag.dir ?? [0, 1];
  for (let i = 1; i < pts.length; i++) {
    const k = i / (pts.length - 1);
    const d = k < from ? 0 : k < at ? lag.mid * ((k - from) / (at - from)) : lerp(lag.mid, lag.tip, (k - at) / (1 - at));
    if (d) pts[i] = add(pts[i], mul(dir, d));
  }
  return pts;
}
