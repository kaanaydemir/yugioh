// HD render — volume primitives. Each one rasterizes a pseudo-3D shape into a G-buffer: for
// every covered pixel (sampled at the pixel center, no anti-aliasing) it writes a surface normal
// and a depth, so the light, the normal map and the depth-merge all come from the same volume.
//
// Most authors use these through `Part` (renderer.ts), which turns an HDMaterial + options
// into the `Brush` taken here. Geometry is in sprite pixels (floats are fine).
//
//   ellipsoid / sphere    — bodies, heads, joints, orbs (true ellipsoid normals, rotatable)
//   capsule / tube        — limbs, necks, tails along polylines or Bézier spines (taper, depth
//                           per point, crystal facets, belly band, segment rings)
//   facet / facet3 / gem / shard — faceted solids with flat, sharp normals (crystals, plates)
//   membrane / cloth      — wings, fins, capes (flat or billowed panels, fold strips)
//   flame (+ wisp)        — animated noise-driven fire silhouettes, seamless loops, emissive heat
//   furClump / furFringe / furCoat — tufted fur with clump normals over a body volume
//   biasPoly / paintPoly / biasWhere — decals: tone patches and material markings

import type { Brush } from './gbuffer';
import { GBuffer } from './gbuffer';
import {
  type V2,
  type V3,
  TAU,
  add,
  bezier,
  centroid,
  clamp,
  clamp01,
  dist,
  flowNoise,
  lerpV,
  madd,
  mul,
  norm,
  norm3,
  pathLengths,
  perp,
  rng,
  samplePath,
  smoothstep,
  sub,
} from './math';

// ------------------------------------------------------------------ shared

export interface ShapeOpts {
  /** Depth offset of the whole primitive (bigger = in front). */
  z?: number;
  /** Multiplies the normal's z before normalizing: >1 flatter front, <1 rounder/contrastier. */
  flat?: number;
}

const withBias = (b: Brush, d: number): Brush => (d === 0 ? b : { ...b, bias: b.bias + d });

/** Scanline polygon fill (even-odd), sampled at pixel centers. */
export function fillPoly(pts: readonly V2[], cb: (x: number, y: number) => void): void {
  if (pts.length < 3) return;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  const xs: number[] = [];
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const sy = y + 0.5;
    xs.length = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy)) xs.push(a[0] + ((sy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    if (xs.length === 2) {
      // the common case (convex shapes): no sort needed
      const a = xs[0] < xs[1] ? xs[0] : xs[1];
      const b = xs[0] < xs[1] ? xs[1] : xs[0];
      for (let x = Math.ceil(a - 0.5); x <= Math.floor(b - 0.5); x++) cb(x, y);
      continue;
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) cb(x, y);
    }
  }
}

/** Normal stored at a pixel (or null if empty). */
export function normalAt(g: GBuffer, x: number, y: number): V3 | null {
  x = Math.floor(x);
  y = Math.floor(y);
  if (!g.has(x, y)) return null;
  const i = y * g.w + x;
  return [g.nx[i], g.ny[i], g.nz[i]];
}

/** Depth stored at a pixel (or null if empty). */
export function depthAt(g: GBuffer, x: number, y: number): number | null {
  x = Math.floor(x);
  y = Math.floor(y);
  if (!g.has(x, y)) return null;
  return g.z[y * g.w + x];
}

// ------------------------------------------------------------------ spine field

/**
 * A polyline prepared for fast "nearest point" queries (typed segment table, no allocation per
 * query). Gives the arc fraction u (0 at the first point, 1 at the last; past the ends when
 * `extend` is on), the signed side offset v (+ = screen-clockwise of the direction) and the
 * local tangent. Used by flames and fur; handy for custom primitives too.
 */
export class Spine {
  readonly n: number;
  readonly length: number;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  /** Result of the last query. */
  u = 0;
  v = 0;
  tx = 1;
  ty = 0;
  d2 = 0;
  private readonly S: Float64Array;

  constructor(pts: readonly V2[], readonly extend = false) {
    const n = Math.max(1, pts.length - 1);
    this.n = n;
    const S = new Float64Array(n * 7);
    let total = 0;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of pts) {
      if (p[0] < x0) x0 = p[0];
      if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1];
      if (p[1] > y1) y1 = p[1];
    }
    for (let i = 0; i < n; i++) {
      const A = pts[i];
      const B = pts[Math.min(i + 1, pts.length - 1)];
      const sx = B[0] - A[0];
      const sy = B[1] - A[1];
      const s2 = sx * sx + sy * sy || 1e-6;
      const sl = Math.sqrt(s2);
      S[i * 7] = A[0];
      S[i * 7 + 1] = A[1];
      S[i * 7 + 2] = sx;
      S[i * 7 + 3] = sy;
      S[i * 7 + 4] = s2;
      S[i * 7 + 5] = sl;
      S[i * 7 + 6] = total;
      total += sl;
    }
    this.S = S;
    this.length = total || 1e-6;
    this.x0 = x0;
    this.y0 = y0;
    this.x1 = x1;
    this.y1 = y1;
  }

  /** Nearest point to (px, py): fills u, v, tx, ty, d2. */
  nearest(px: number, py: number): this {
    const S = this.S;
    const n = this.n;
    const ext = this.extend;
    let best = Infinity;
    for (let i = 0, k = 0; i < n; i++, k += 7) {
      const ax = S[k];
      const ay = S[k + 1];
      const sx = S[k + 2];
      const sy = S[k + 3];
      let t = ((px - ax) * sx + (py - ay) * sy) / S[k + 4];
      if (!(ext && i === 0) && t < 0) t = 0;
      if (!(ext && i === n - 1) && t > 1) t = 1;
      const qx = ax + sx * t;
      const qy = ay + sy * t;
      const d2 = (px - qx) * (px - qx) + (py - qy) * (py - qy);
      if (d2 < best) {
        best = d2;
        const sl = S[k + 5];
        const tx = sx / sl;
        const ty = sy / sl;
        this.u = (S[k + 6] + sl * t) / this.length;
        this.tx = tx;
        this.ty = ty;
        this.v = (px - qx) * -ty + (py - qy) * tx;
      }
    }
    this.d2 = best;
    return this;
  }
}

// ------------------------------------------------------------------ ellipsoid

export interface EllipsoidOpts extends ShapeOpts {
  /** Rotation of the (rx, ry) axes on screen, radians. */
  angle?: number;
  /** Depth radius (toward the viewer). Default min(rx, ry): smaller = flatter disc. */
  rz?: number;
  /** Emissive heat: a number, or 'radial' (hot center → cool rim: 0.1 at the rim, 0.88 at the center). */
  heat?: number | 'radial';
}

/** Ellipsoid with radii rx, ry (screen) and rz (depth). True ellipsoid normals. */
export function ellipsoid(g: GBuffer, b: Brush, c: V2, rx: number, ry: number, o: EllipsoidOpts = {}): void {
  if (rx <= 0 || ry <= 0) return;
  const ang = o.angle ?? 0;
  const cs = Math.cos(ang);
  const sn = Math.sin(ang);
  const rz = o.rz ?? Math.min(rx, ry);
  const flat = o.flat ?? 1;
  const z0 = o.z ?? 0;
  const R = Math.max(rx, ry) + 1;
  const radial = o.heat === 'radial';
  const heat = typeof o.heat === 'number' ? o.heat : 0;
  for (let y = Math.floor(c[1] - R); y <= Math.ceil(c[1] + R); y++) {
    for (let x = Math.floor(c[0] - R); x <= Math.ceil(c[0] + R); x++) {
      const dx = x + 0.5 - c[0];
      const dy = y + 0.5 - c[1];
      const u = (dx * cs + dy * sn) / rx;
      const v = (-dx * sn + dy * cs) / ry;
      const d2 = u * u + v * v;
      if (d2 > 1) continue;
      const w = Math.sqrt(1 - d2);
      // gradient of the implicit ellipsoid: (u/rx, v/ry, w/rz) in local axes
      const lx = u / rx;
      const ly = v / ry;
      const nz = (w / rz) * flat;
      g.put(x, y, lx * cs - ly * sn, lx * sn + ly * cs, nz, z0 + w * rz, b, radial ? 0.1 + 0.78 * w * w + heat : heat);
    }
  }
}

export function sphere(g: GBuffer, b: Brush, c: V2, r: number, o: EllipsoidOpts = {}): void {
  ellipsoid(g, b, c, r, r, o);
}

// ------------------------------------------------------------------ tubes

export type PerPoint = number | readonly number[] | ((t: number) => number);

function perPoint(v: PerPoint | undefined, i: number, n: number, t: number, dflt: number): number {
  if (v === undefined) return dflt;
  if (typeof v === 'number') return v;
  if (typeof v === 'function') return v(t);
  return v[Math.min(i, v.length - 1)] ?? dflt;
}

export interface TubeOpts extends ShapeOpts {
  /** Depth along the spine (per point / function of arc fraction t). Lets a tail pass behind. */
  depth?: PerPoint;
  /** Quantize the cross-section into this many flat facets (crystal / armored look). */
  facets?: number;
  /** Ventral band: pixels on the `side` (+1 = screen-clockwise of the spine direction) beyond `from` (0..1). */
  belly?: { from: number; bias?: number; brush?: Brush; side?: 1 | -1 };
  /** Segment rings every `every` px of arc length (tail plates, horn ridges). */
  rings?: { every: number; width?: number; bias?: number; offset?: number; brush?: Brush; from?: number; to?: number };
  /** Emissive heat: number, or 'core' (hot along the axis). */
  heat?: number | 'core';
  /** Round end caps (default true). With false the ends are cut square (joints hidden by other parts). */
  caps?: boolean;
}

/**
 * Tapered tube along a polyline (sample Béziers with `bezier()` / joints with `catmull()`).
 * `radius` is per point (array), constant, or a function of the arc fraction t (0..1).
 * Each segment is a cone with round caps; segments depth-merge into one smooth tube.
 */
export function tube(g: GBuffer, b: Brush, path: readonly V2[], radius: PerPoint, o: TubeOpts = {}): void {
  if (path.length === 0) return;
  if (path.length === 1) path = [path[0], add(path[0], [0.01, 0])];
  const lens = pathLengths(path);
  const total = lens[lens.length - 1] || 1;
  const n = path.length;
  const flat = o.flat ?? 1;
  const z0 = o.z ?? 0;
  const caps = o.caps ?? true;
  const facets = o.facets ?? 0;
  const step = facets ? Math.PI / facets : 0;
  const bellySide = o.belly?.side ?? 1;
  const bellyBrush = o.belly ? (o.belly.brush ?? withBias(b, o.belly.bias ?? 0.15)) : null;
  const ringBrush = o.rings ? (o.rings.brush ?? withBias(b, o.rings.bias ?? -0.18)) : null;
  const ringW = o.rings?.width ?? 1;
  const heatCore = o.heat === 'core';
  const heatNum = typeof o.heat === 'number' ? o.heat : 0;
  const R: number[] = [];
  const Z: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = lens[i] / total;
    R.push(Math.max(0.35, perPoint(radius, i, n, t, 2)));
    Z.push(perPoint(o.depth, i, n, t, 0));
  }
  for (let s = 0; s < n - 1; s++) {
    const A = path[s];
    const B = path[s + 1];
    const sx = B[0] - A[0];
    const sy = B[1] - A[1];
    const sl2 = sx * sx + sy * sy;
    const sl = Math.sqrt(sl2) || 1e-6;
    const tx = sx / sl;
    const ty = sy / sl;
    const px = -ty; // perp
    const py = tx;
    const rA = R[s];
    const rB = R[s + 1];
    const rM = Math.max(rA, rB) + 1;
    const x0 = Math.floor(Math.min(A[0], B[0]) - rM);
    const x1 = Math.ceil(Math.max(A[0], B[0]) + rM);
    const y0 = Math.floor(Math.min(A[1], B[1]) - rM);
    const y1 = Math.ceil(Math.max(A[1], B[1]) + rM);
    const first = s === 0;
    const last = s === n - 2;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const qx0 = x + 0.5 - A[0];
        const qy0 = y + 0.5 - A[1];
        let t = sl2 > 0 ? (qx0 * sx + qy0 * sy) / sl2 : 0;
        if (!caps && ((first && t < 0) || (last && t > 1))) continue;
        t = clamp01(t);
        const r = rA + (rB - rA) * t;
        const ox = (qx0 - sx * t) / r;
        const oy = (qy0 - sy * t) / r;
        const o2 = ox * ox + oy * oy;
        if (o2 > 1) continue;
        const h = Math.sqrt(1 - o2);
        const v = ox * px + oy * py; // signed cross-section coordinate
        let nx: number;
        let ny: number;
        let nz: number;
        if (facets) {
          const phi = Math.asin(clamp(v, -1, 1));
          const q = (Math.floor(phi / step) + 0.5) * step;
          const sq = Math.sin(q);
          nx = px * sq;
          ny = py * sq;
          nz = Math.cos(q) * flat;
        } else {
          nx = ox;
          ny = oy;
          nz = h * flat;
        }
        const u = (lens[s] + sl * t) / total;
        let br = b;
        if (bellyBrush && v * bellySide > o.belly!.from) br = bellyBrush;
        if (ringBrush) {
          const from = o.rings!.from ?? 0;
          const to = o.rings!.to ?? 1;
          if (u >= from && u <= to) {
            const a = u * total + (o.rings!.offset ?? 0);
            const every = o.rings!.every;
            if (a - Math.floor(a / every) * every < ringW) br = ringBrush;
          }
        }
        const heat = heatCore ? Math.sqrt(Math.max(0, 1 - v * v)) : heatNum;
        g.put(x, y, nx, ny, nz, z0 + Z[s] + (Z[s + 1] - Z[s]) * t + h * r, br, heat);
      }
    }
  }
}

/** Cone-capsule between two points (radii ra → rb). */
export function capsule(g: GBuffer, b: Brush, a: V2, bPt: V2, ra: number, rb: number, o: TubeOpts = {}): void {
  tube(g, b, [a, bPt], [ra, rb], o);
}

// ------------------------------------------------------------------ flat & faceted solids

export interface FacetOpts {
  z?: number;
  /** Emissive heat for emissive materials. */
  heat?: number;
}

/** Flat polygon with one constant normal (default facing the viewer). */
export function facet(g: GBuffer, b: Brush, pts: readonly V2[], n: V3 = [0, 0, 1], o: FacetOpts = {}): void {
  const z = o.z ?? 0;
  const heat = o.heat ?? 0;
  fillPoly(pts, (x, y) => g.put(x, y, n[0], n[1], n[2], z, b, heat));
}

/** Newell normal of a 3D polygon, oriented toward the viewer (+z). */
export function polyNormal3(pts: readonly V3[]): V3 {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const c = pts[(i + 1) % pts.length];
    nx += (a[1] - c[1]) * (a[2] + c[2]);
    ny += (a[2] - c[2]) * (a[0] + c[0]);
    nz += (a[0] - c[0]) * (a[1] + c[1]);
  }
  const n = norm3([nx, ny, nz]);
  return n[2] < 0 ? [-n[0], -n[1], -n[2]] : n;
}

/**
 * Planar facet from 3D points (x, y screen; z depth toward the viewer). The normal comes from
 * the plane (sharp, constant), the depth is interpolated on the plane — so neighbouring facets
 * of a crystal light differently and meet along crisp edges.
 */
export function facet3(g: GBuffer, b: Brush, pts: readonly V3[], o: FacetOpts = {}): V3 {
  const n = polyNormal3(pts);
  const p0 = pts[0];
  const nz = Math.max(0.08, n[2]);
  const z0 = o.z ?? 0;
  const heat = o.heat ?? 0;
  fillPoly(
    pts.map((p) => [p[0], p[1]] as V2),
    (x, y) => {
      const z = p0[2] - (n[0] * (x + 0.5 - p0[0]) + n[1] * (y + 0.5 - p0[1])) / nz;
      g.put(x, y, n[0], n[1], n[2], z0 + z, b, heat);
    },
  );
  return n;
}

export interface GemOpts extends FacetOpts {
  /** Peak point (default: centroid of the outline). */
  apex?: V2;
  /** Height of the apex / table above the outline (depth units ≈ px). */
  height: number;
  /** 0..1: cut a flat table at the top (fraction of the outline size). 0 = pointed. */
  table?: number;
  /** First facet id (each facet gets its own id; edge light uses them). Default 1. */
  idBase?: number;
}

/**
 * Faceted solid over a convex-ish outline: every outline edge rises to the apex (or to a flat
 * table) as one flat facet. Use for crystal clusters, gem eyes, armor studs, rock chunks.
 */
export function gem(g: GBuffer, b: Brush, outline: readonly V2[], o: GemOpts): void {
  const apex = o.apex ?? centroid(outline);
  const h = o.height;
  const n = outline.length;
  const idBase = o.idBase ?? 1;
  const tb = o.table ?? 0;
  const inner = tb > 0 ? outline.map((p) => lerpV(apex, p, tb)) : null;
  for (let i = 0; i < n; i++) {
    const a = outline[i];
    const c = outline[(i + 1) % n];
    const br: Brush = { ...b, id: idBase + i };
    if (inner) {
      const ia = inner[i];
      const ic = inner[(i + 1) % n];
      facet3(g, br, [[a[0], a[1], 0], [c[0], c[1], 0], [ic[0], ic[1], h], [ia[0], ia[1], h]], o);
    } else {
      facet3(g, br, [[a[0], a[1], 0], [c[0], c[1], 0], [apex[0], apex[1], h]], o);
    }
  }
  if (inner) facet(g, { ...b, id: idBase + n }, inner, [0, 0, 1], { z: (o.z ?? 0) + h, heat: o.heat });
}

export interface CutGemOpts extends FacetOpts {
  /** Number of sides of the girdle polygon (default 10). */
  sides?: number;
  /**
   * Rings from the girdle inward: [scale (fraction of the radius), height (px)]. The last ring
   * becomes the flat table. Default [[0.78, 0.5·r], [0.46, 0.78·r]].
   */
  rings?: readonly (readonly [number, number])[];
  /** Offset every other ring by half a side → star / kite facets (brilliant cut). Default true. */
  twist?: boolean;
  /** Rotation of the cut (radians). */
  angle?: number;
  /** First facet id (default 1). */
  idBase?: number;
}

/**
 * Brilliant-cut gem seen from the front: a girdle polygon rising through rings of flat facets
 * to a flat table. Great for orbs, gem eyes, crystal cores — every facet catches the key light
 * differently and crystal materials add light edges between them.
 */
export function cutGem(g: GBuffer, b: Brush, c: V2, rx: number, ry: number, o: CutGemOpts = {}): void {
  const n = o.sides ?? 10;
  const r = Math.min(rx, ry);
  const rings = o.rings ?? [
    [0.78, 0.5 * r],
    [0.46, 0.78 * r],
  ];
  const twist = o.twist ?? true;
  const a0 = o.angle ?? 0;
  const cs = Math.cos(a0);
  const sn = Math.sin(a0);
  const ring = (scale: number, z: number, rot: number): V3[] => {
    const out: V3[] = [];
    for (let i = 0; i < n; i++) {
      const a = ((i + rot) / n) * TAU;
      const lx = Math.cos(a) * rx * scale;
      const ly = Math.sin(a) * ry * scale;
      out.push([c[0] + lx * cs - ly * sn, c[1] + lx * sn + ly * cs, z]);
    }
    return out;
  };
  let id = o.idBase ?? 1;
  let prev = ring(1, 0, 0);
  let prevRot = 0;
  for (let k = 0; k < rings.length; k++) {
    const rot = twist ? prevRot + 0.5 : 0;
    const cur = ring(rings[k][0], rings[k][1], rot);
    for (let i = 0; i < n; i++) {
      const a = prev[i];
      const a2 = prev[(i + 1) % n];
      if (twist) {
        // kite between two girdle points and the inner point between them, plus the star triangle
        const inner = cur[i];
        const innerPrev = cur[(i - 1 + n) % n];
        facet3(g, { ...b, id: id++ }, [a, a2, inner], o);
        facet3(g, { ...b, id: id++ }, [a, inner, innerPrev], o);
      } else {
        facet3(g, { ...b, id: id++ }, [a, a2, cur[(i + 1) % n], cur[i]], o);
      }
    }
    prev = cur;
    prevRot = rot;
  }
  facet(
    g,
    { ...b, id: id++ },
    prev.map((p) => [p[0], p[1]] as V2),
    [0, 0, 1],
    { z: (o.z ?? 0) + rings[rings.length - 1][1], heat: o.heat },
  );
}

export interface ShardOpts extends FacetOpts {
  /** Ridge height (default 1.1 × halfWidth). */
  height?: number;
  /** Where the shard is widest, as a fraction of its length (default 0.38). */
  shoulder?: number;
  /** Width at the base relative to the shoulder (default 0.8). */
  baseWidth?: number;
  /** First facet id (4 ids are used). Default 1. */
  idBase?: number;
}

/**
 * Elongated crystal shard from `base` to `tip`: a raised ridge splits it into two long side
 * facets and two tip facets (4 flat normals). The key light picks the bright side by itself.
 * Returns the four facet normals (left, right, left tip, right tip).
 */
export function shard(g: GBuffer, b: Brush, base: V2, tip: V2, halfWidth: number, o: ShardOpts = {}): void {
  const L = dist(base, tip);
  if (L < 0.5) return;
  const d = norm(sub(tip, base));
  const p = perp(d);
  const hw = halfWidth;
  const h = o.height ?? hw * 1.1;
  const sh = o.shoulder ?? 0.38;
  const bw = o.baseWidth ?? 0.8;
  const id = o.idBase ?? 1;
  const bL = madd(base, p, hw * bw);
  const bR = madd(base, p, -hw * bw);
  const m = madd(base, d, L * sh);
  const sL = madd(m, p, hw);
  const sR = madd(m, p, -hw);
  const P = (q: V2, z: number): V3 => [q[0], q[1], z];
  if (L < 4 || hw < 1.2) {
    // tiny shard: two facets split down the middle are noise at this size — one flat facet
    facet3(g, { ...b, id }, [P(bL, 0), P(tip, 0), P(bR, 0), P(base, h * 0.5)], o);
    return;
  }
  facet3(g, { ...b, id }, [P(bL, 0), P(sL, 0), P(m, h), P(base, h)], o);
  facet3(g, { ...b, id: id + 1 }, [P(base, h), P(m, h), P(sR, 0), P(bR, 0)], o);
  facet3(g, { ...b, id: id + 2 }, [P(sL, 0), P(tip, 0), P(m, h)], o);
  facet3(g, { ...b, id: id + 3 }, [P(m, h), P(tip, 0), P(sR, 0)], o);
}

// ------------------------------------------------------------------ membranes & cloth

export interface MembraneOpts extends FacetOpts {
  /** Base normal of the panel (default facing the viewer). */
  normal?: V3;
  /** Dome the panel: > 0 bulges toward the viewer, < 0 cups away (wings catching air). */
  billow?: number;
  /** Center of the billow (default centroid). */
  center?: V2;
}

/** Flat or billowed panel (wing membrane between finger bones, fin, banner). */
export function membrane(g: GBuffer, b: Brush, pts: readonly V2[], o: MembraneOpts = {}): void {
  const n0 = o.normal ?? [0, 0, 1];
  const bil = o.billow ?? 0;
  const z0 = o.z ?? 0;
  const heat = o.heat ?? 0;
  if (!bil) {
    fillPoly(pts, (x, y) => g.put(x, y, n0[0], n0[1], n0[2], z0, b, heat));
    return;
  }
  const c = o.center ?? centroid(pts);
  let R = 1;
  for (const p of pts) R = Math.max(R, dist(p, c));
  fillPoly(pts, (x, y) => {
    const dx = (x + 0.5 - c[0]) / R;
    const dy = (y + 0.5 - c[1]) / R;
    const d2 = Math.min(1, dx * dx + dy * dy);
    g.put(x, y, n0[0] + dx * bil, n0[1] + dy * bil, n0[2], z0 + bil * R * 0.35 * (1 - d2), b, heat);
  });
}

export interface ClothOpts extends FacetOpts {
  /** Number of fold waves across the strip (default 2). */
  folds?: number;
  /** Fold strength: how far the fold planes tilt (default 0.6). */
  depth?: number;
  /** Fold phase in radians (animate it for rippling capes / fins). */
  phase?: number;
  /** Base normal (default facing the viewer). */
  normal?: V3;
  /** First quad id (default 1). */
  idBase?: number;
}

/**
 * Strip of flat quads between two polylines of equal length (top edge / bottom edge), each
 * tilted by a sine fold → crisp pixel-art folds for capes, manes made of cloth, fins, frills.
 */
export function cloth(g: GBuffer, b: Brush, top: readonly V2[], bottom: readonly V2[], o: ClothOpts = {}): void {
  const n = Math.min(top.length, bottom.length);
  if (n < 2) return;
  const n0 = o.normal ?? [0, 0, 1];
  const folds = o.folds ?? 2;
  const depth = o.depth ?? 0.6;
  const phase = o.phase ?? 0;
  const id = o.idBase ?? 1;
  for (let i = 0; i < n - 1; i++) {
    const u = (i + 0.5) / (n - 1);
    const tilt = Math.sin(TAU * folds * u + phase) * depth;
    const across = norm(sub(lerpV(top[i + 1], bottom[i + 1], 0.5), lerpV(top[i], bottom[i], 0.5)));
    const nn: V3 = [n0[0] + across[0] * tilt, n0[1] + across[1] * tilt, n0[2]];
    facet(g, { ...b, id: id + i }, [top[i], top[i + 1], bottom[i + 1], bottom[i]], nn, { z: (o.z ?? 0) + i * 0.001, heat: o.heat });
  }
}

// ------------------------------------------------------------------ fire

export interface FlameOpts {
  /** Spine from base to tip (≥ 2 points). A straight flame is [base, tip]; a wisp follows a curve. */
  spine: readonly V2[];
  /** Half-width at the widest point, px. */
  width: number;
  /** Loop phase 0..1 — the animation is seamless (t = 1 equals t = 0). */
  t: number;
  seed?: number;
  /** Edge noise 0..1 (default 0.55). */
  turbulence?: number;
  /** Lateral sway of the upper flame, px (default 0.5 × width). */
  sway?: number;
  /** Noise feature size, px (default 0.9 × width). */
  scale?: number;
  /** How far the noise flows toward the tip per loop, in feature sizes (default 2). */
  speed?: number;
  /** Detached tongues above the tip 0..1 (default 0.5). */
  licks?: number;
  /** 'round' = teardrop base (free flame), 'flat' = grows out of a surface (mane, paws). */
  base?: 'round' | 'flat';
  /** Shift the heat (whiter / redder). */
  heatBias?: number;
  z?: number;
}

/**
 * Animated flame / wisp. The silhouette is a tapered tongue along the spine whose edge is cut
 * by flowing noise; the heat (→ emissive tone) is hottest along the core and near the base.
 * Use an emissive material (MAT.flame). Deterministic for (opts, t).
 */
export function flame(g: GBuffer, b: Brush, o: FlameOpts): void {
  const sp = o.spine;
  if (sp.length < 2) return;
  const lens = pathLengths(sp);
  const L = lens[lens.length - 1] || 1;
  const W = o.width;
  const turb = o.turbulence ?? 0.55;
  const sway = o.sway ?? W * 0.5;
  const scale = o.scale ?? W * 0.9;
  const speed = o.speed ?? 2;
  const licks = o.licks ?? 0.5;
  const seed = o.seed ?? 1;
  const round = (o.base ?? 'round') === 'round';
  const hb = o.heatBias ?? 0;
  const z0 = o.z ?? 0;
  // noise flows from base to tip: flow vector in noise units (feature sizes)
  const flowDir = norm(sub(sp[sp.length - 1], sp[0]));
  const flow: V2 = [flowDir[0] * speed, flowDir[1] * speed];
  const ext = W * 1.4 + sway;
  // the sway depends on u only: tabulate it once per call (64 samples over u ∈ [-0.4, 1.6])
  const SW = new Float32Array(65);
  for (let k = 0; k <= 64; k++) {
    const u = -0.4 + (k / 64) * 2;
    SW[k] = (flowNoise(u * 1.3, seed * 0.37, o.t, [speed * 0.7, 0], 2, seed + 11) - 0.5) * 2 * sway * Math.pow(clamp01(u), 1.4);
  }
  const swayAt = (u: number) => {
    const f = clamp((u + 0.4) * 32, 0, 64);
    const k = Math.min(63, Math.floor(f));
    return SW[k] + (SW[k + 1] - SW[k]) * (f - k);
  };
  const reach = W * 1.3 + sway + 1;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of sp) {
    x0 = Math.min(x0, p[0]);
    y0 = Math.min(y0, p[1]);
    x1 = Math.max(x1, p[0]);
    y1 = Math.max(y1, p[1]);
  }
  const profile = (u: number) => {
    if (u < 0) return 0;
    const grow = round ? 0.62 + 0.38 * Math.sqrt(Math.min(1, u / 0.22)) : 1;
    return W * grow * Math.pow(Math.max(0, 1 - u), 0.72);
  };
  // licks rise past the tip along its direction
  const tipD = norm(sub(sp[sp.length - 1], sp[sp.length - 2]));
  const tipX = sp[sp.length - 1][0] + tipD[0] * L * 0.45;
  const tipY = sp[sp.length - 1][1] + tipD[1] * L * 0.45;
  x0 = Math.min(x0, tipX);
  x1 = Math.max(x1, tipX);
  y0 = Math.min(y0, tipY);
  y1 = Math.max(y1, tipY);
  const SPN = new Spine(sp, true);
  for (let y = Math.floor(y0 - ext); y <= Math.ceil(y1 + ext); y++) {
    for (let x = Math.floor(x0 - ext); x <= Math.ceil(x1 + ext); x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      // nearest spine point → arc fraction u (extends past both ends) and signed offset v
      SPN.nearest(px, py);
      const bu = SPN.u;
      const bv = SPN.v;
      const tnx = SPN.tx;
      const tny = SPN.ty;
      const u = bu;
      if (u < -0.35 || u > 1.5) continue;
      // cheap reject before any noise: too far from the (swaying) spine to ever be covered
      const sw = swayAt(u);
      const vv = bv - sw;
      if (Math.abs(vv) > reach || (u < 0 && Math.abs(u * L) > reach)) continue;
      const nA = flowNoise(px / scale, py / scale, o.t, flow, 3, seed);
      let inside = false;
      let heat = 0;
      let wEff = 1;
      if (u >= 0 && u <= 1) {
        const w = profile(u);
        const e = (nA - 0.5) * 2 * turb * W * (0.3 + u * 0.9);
        wEff = Math.max(0.01, w + e);
        if (Math.abs(vv) < wEff) {
          inside = true;
          const across = 1 - Math.abs(vv) / wEff;
          heat = across * (1 - 0.8 * Math.pow(u, 1.3)) + (nA - 0.5) * 0.4 + hb + (round ? 0.08 : 0);
        }
      } else if (u < 0 && round) {
        // teardrop bottom: a half-disc under the base
        const r = profile(0.001) * (0.92 + (nA - 0.5) * 0.3);
        const dd = Math.hypot(u * L, vv);
        if (dd < r) {
          inside = true;
          wEff = r;
          heat = (1 - dd / r) * 0.95 + (nA - 0.5) * 0.3 + hb;
        }
      }
      if (!inside && licks > 0 && u > 0.62) {
        // detached tongues rising off the tip
        const nB = flowNoise(px / (scale * 0.7), py / (scale * 0.7), o.t, [flow[0] * 1.4, flow[1] * 1.4], 2, seed + 5);
        const lim = 0.74 - licks * 0.12 + (u - 0.62) * 0.3;
        if (nB > lim && Math.abs(vv) < W * 0.5 * Math.max(0, 1.45 - u)) {
          inside = true;
          wEff = W * 0.5;
          heat = 0.3 + (nB - lim) * 3 + hb * 0.5;
        }
      }
      if (!inside) continue;
      const vn = clamp(vv / wEff, -1, 1);
      const pnx = -tny;
      const pny = tnx;
      const hz = Math.sqrt(1 - vn * vn);
      g.put(x, y, pnx * vn * 0.8, pny * vn * 0.8, hz, z0 + clamp01(heat) * W * 0.6, b, clamp01(heat));
    }
  }
}

/** A flame that follows a curved spine and grows out of a surface (mane locks, tail fire). */
export function wisp(g: GBuffer, b: Brush, spine: readonly V2[], width: number, t: number, o: Partial<FlameOpts> = {}): void {
  flame(g, b, { base: 'flat', licks: 0.3, ...o, spine, width, t });
}

// ------------------------------------------------------------------ fur

export interface ClumpOpts {
  /** Sideways bulge of the clump's spine in px (+ = screen-clockwise of root→tip). */
  bend?: number;
  /** Surface normal the clump grows from (default: sampled from the buffer at the root, else +z). */
  baseNormal?: V3;
  /** 0..1 how much the clump's own rounded normal shows over the body normal (default 0.45). */
  lean?: number;
  /** Depth of the root (default: buffer depth at the root, else 0). */
  z?: number;
  /** 'over' (default): later clumps lie on top (painter order). 'union': depth-merge. */
  layer?: 'over' | 'union';
  /** Width at the root relative to the widest point (default 0.7). */
  root?: number;
}

/**
 * One fur tuft: a curved, tapered, pointed lock from `root` to `tip`. Its normal blends the
 * body's surface normal (so the coat shades as one volume) with its own rounded cross-section
 * (so every clump has a lit side and a shadow side). Give each clump its own brush id so
 * `clumpLines` materials draw a 1 px separation where clumps overlap.
 */
export function furClump(g: GBuffer, b: Brush, root: V2, tip: V2, width: number, o: ClumpOpts = {}): void {
  const L = dist(root, tip);
  if (L < 0.5) return;
  const d = norm(sub(tip, root));
  const p = perp(d);
  const bend = o.bend ?? 0;
  const spine = bezier(root, madd(lerpV(root, tip, 0.5), p, bend), tip, undefined, Math.max(3, Math.ceil(L / 3)));
  const ns = spine.length - 1;
  // segment table (typed, so the per-pixel loop stays monomorphic and allocation-free)
  const SA = new Float64Array(ns * 7);
  let total = 0;
  for (let i = 0; i < ns; i++) {
    const A = spine[i];
    const B = spine[i + 1];
    const sx = B[0] - A[0];
    const sy = B[1] - A[1];
    const s2 = sx * sx + sy * sy || 1e-6;
    const sl = Math.sqrt(s2);
    SA.set([A[0], A[1], sx, sy, s2, sl, total], i * 7);
    total += sl;
  }
  total = total || 1;
  const lean = o.lean ?? 0.45;
  const bn = o.baseNormal ?? normalAt(g, root[0], root[1]) ?? [0, 0, 1];
  const zr = o.z ?? depthAt(g, root[0], root[1]) ?? 0;
  const seq = ++g.seq;
  const zTop = zr + 1 + seq * 0.002;
  const br: Brush = (o.layer ?? 'over') === 'over' && b.mode === 0 ? { ...b, mode: 1 } : b;
  const r0 = o.root ?? 0.7;
  // radius profile as a lookup table over u (widest near a quarter, pointed tip)
  const PROF = new Float32Array(33);
  for (let k = 0; k <= 32; k++) {
    const u = k / 32;
    PROF[k] = width * (r0 + (1 - r0) * smoothstep(0, 0.3, u)) * Math.pow(Math.max(0, 1 - u), 0.85);
  }
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const q of spine) {
    x0 = Math.min(x0, q[0]);
    y0 = Math.min(y0, q[1]);
    x1 = Math.max(x1, q[0]);
    y1 = Math.max(y1, q[1]);
  }
  const ext = width + 1;
  const reach = Math.abs(bend) + width + 1.5;
  const b0 = bn[0] * (1 - lean);
  const b1 = bn[1] * (1 - lean);
  const b2 = bn[2] * (1 - lean);
  for (let y = Math.floor(y0 - ext); y <= Math.ceil(y1 + ext); y++) {
    for (let x = Math.floor(x0 - ext); x <= Math.ceil(x1 + ext); x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      // coarse reject: too far from the root→tip chord
      const cx = px - root[0];
      const cy = py - root[1];
      const along = cx * d[0] + cy * d[1];
      if (along < -width - 1 || along > L + 1) continue;
      const side = cx * p[0] + cy * p[1];
      if (side > reach || side < -reach) continue;
      let best = Infinity;
      let bu = 0;
      let bv = 0;
      let tx = d[0];
      let ty = d[1];
      for (let i = 0, k = 0; i < ns; i++, k += 7) {
        const ax = SA[k];
        const ay = SA[k + 1];
        const sx = SA[k + 2];
        const sy = SA[k + 3];
        let t = ((px - ax) * sx + (py - ay) * sy) / SA[k + 4];
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = ax + sx * t;
        const qy = ay + sy * t;
        const d2 = (px - qx) * (px - qx) + (py - qy) * (py - qy);
        if (d2 < best) {
          best = d2;
          const sl = SA[k + 5];
          bu = (SA[k + 6] + sl * t) / total;
          tx = sx / sl;
          ty = sy / sl;
          bv = (px - qx) * -ty + (py - qy) * tx;
        }
      }
      const fu = bu * 32;
      const ku = fu >= 32 ? 31 : Math.floor(fu);
      const r = PROF[ku] + (PROF[ku + 1] - PROF[ku]) * (fu - ku);
      if (r <= 0.3 || bv > r || bv < -r) continue;
      const vn = bv / r;
      const h = Math.sqrt(1 - vn * vn);
      g.put(x, y, b0 + -ty * vn * lean, b1 + tx * vn * lean, b2 + h * lean, zTop + h * 0.5 - bu * 0.5, br);
    }
  }
}

export interface FringeOpts extends Omit<ClumpOpts, 'baseNormal' | 'z'> {
  /** Number of clumps along the path. */
  count: number;
  /** Clump length (px) — constant or per arc fraction t. */
  length: number | ((t: number) => number);
  /** Clump half-width (px) — constant or per t. */
  width: number | ((t: number) => number);
  /** Which side of the path the clumps grow toward: +1 = screen-clockwise of the path direction. */
  side?: 1 | -1;
  /** Direction the fur is combed toward; blended with the outward direction by `comb`. */
  flow?: V2;
  /** 0..1 how much the clumps follow `flow` instead of pointing straight out (default 0.5). */
  comb?: number;
  /** Random variation 0..1 of length / angle / spacing (default 0.35). */
  jitter?: number;
  seed?: number;
  /** Body normal at each root (default: sampled from the buffer). */
  baseNormal?: (t: number, root: V2) => V3 | null;
  /** Draw order along the path: 'forward' (later clumps on top) or 'reverse'. */
  order?: 'forward' | 'reverse';
  /** Root inset: move roots this many px back inside the body (default 1.5). */
  inset?: number;
  /** First clump id (each clump gets a new id). Default 1. */
  idBase?: number;
}

/** A row of fur clumps along a path (silhouette fringe, mane, ruff, cheek tufts). */
export function furFringe(g: GBuffer, b: Brush, path: readonly V2[], o: FringeOpts): void {
  const R = rng(o.seed ?? 7);
  const lens = pathLengths(path);
  const side = o.side ?? 1;
  const comb = o.comb ?? 0.5;
  const jit = o.jitter ?? 0.35;
  const inset = o.inset ?? 1.5;
  const items: { root: V2; tip: V2; w: number; bend: number; t: number }[] = [];
  for (let i = 0; i < o.count; i++) {
    const t = clamp01((i + 0.5 + (R() - 0.5) * jit) / o.count);
    const s = samplePath(path, t, lens);
    const out = mul(perp(s.tan), side);
    const dir = o.flow ? norm(lerpV(out, norm(o.flow), comb)) : out;
    const ang = (R() - 0.5) * jit * 0.6;
    const c = Math.cos(ang);
    const sn = Math.sin(ang);
    const dj: V2 = [dir[0] * c - dir[1] * sn, dir[0] * sn + dir[1] * c];
    const l = (typeof o.length === 'number' ? o.length : o.length(t)) * (1 + (R() - 0.5) * jit);
    const w = typeof o.width === 'number' ? o.width : o.width(t);
    const root = madd(s.p, out, -inset);
    items.push({ root, tip: madd(root, dj, l + inset), w, bend: (o.bend ?? 0) + (R() - 0.5) * jit * w, t });
  }
  if (o.order === 'reverse') items.reverse();
  let id = o.idBase ?? 1;
  for (const it of items) {
    const bn = o.baseNormal ? o.baseNormal(it.t, it.root) : null;
    furClump(g, { ...b, id: id++ }, it.root, it.tip, it.w, { ...o, bend: it.bend, baseNormal: bn ?? undefined });
  }
}

export interface CoatOpts {
  /** Rotation of the ellipse (radians). */
  angle?: number;
  /** Depth radius of the body (default min(rx, ry)). */
  rz?: number;
  /** Average spacing between clump roots, px. */
  spacing: number;
  /** Clump length and half-width, px. */
  length: number;
  width: number;
  /** Direction the fur is combed toward (screen). */
  flow: V2;
  /** Random variation 0..1 (default 0.4). */
  jitter?: number;
  seed?: number;
  lean?: number;
  z?: number;
  /** Bias of the undercoat ellipsoid drawn first (default -0.12: a touch darker). */
  undercoat?: number;
  /** First clump id. Default 1. */
  idBase?: number;
}

/**
 * A furry ellipsoid body: an undercoat ellipsoid plus layered clumps combed along `flow`, each
 * shaded with the ellipsoid's normal at its root (the coat reads as one volume, clumps as
 * tufts). Clumps are drawn down-flow first so up-flow clumps lie on top like shingles.
 */
export function furCoat(g: GBuffer, b: Brush, c: V2, rx: number, ry: number, o: CoatOpts): void {
  const ang = o.angle ?? 0;
  const cs = Math.cos(ang);
  const sn = Math.sin(ang);
  const rz = o.rz ?? Math.min(rx, ry);
  const z0 = o.z ?? 0;
  ellipsoid(g, withBias(b, o.undercoat ?? -0.12), c, rx, ry, { angle: ang, rz, z: z0 });
  const R = rng(o.seed ?? 3);
  const jit = o.jitter ?? 0.4;
  const flow = norm(o.flow);
  const roots: { p: V2; n: V3; z: number; k: number }[] = [];
  const sp = o.spacing;
  for (let gy = -ry; gy <= ry; gy += sp * 0.8) {
    const row = Math.round((gy + ry) / (sp * 0.8));
    for (let gx = -rx; gx <= rx; gx += sp) {
      const lx = gx + (row % 2 ? sp * 0.5 : 0) + (R() - 0.5) * sp * jit;
      const ly = gy + (R() - 0.5) * sp * jit;
      const u = lx / rx;
      const v = ly / ry;
      const d2 = u * u + v * v;
      if (d2 > 0.92) continue;
      const w = Math.sqrt(1 - d2);
      const nlx = u / rx;
      const nly = v / ry;
      const n = norm3([nlx * cs - nly * sn, nlx * sn + nly * cs, w / rz]);
      const p: V2 = [c[0] + lx * cs - ly * sn, c[1] + lx * sn + ly * cs];
      roots.push({ p, n, z: z0 + w * rz, k: p[0] * flow[0] + p[1] * flow[1] });
    }
  }
  roots.sort((a, b2) => b2.k - a.k);
  let id = o.idBase ?? 1;
  for (const r of roots) {
    const l = o.length * (1 + (R() - 0.5) * jit);
    const a = (R() - 0.5) * jit * 0.5;
    const dir: V2 = [flow[0] * Math.cos(a) - flow[1] * Math.sin(a), flow[0] * Math.sin(a) + flow[1] * Math.cos(a)];
    // clumps lie ON the surface: tilt toward the viewer is implied by the body normal
    furClump(g, { ...b, id: id++ }, r.p, madd(r.p, dir, l), o.width * (0.85 + R() * 0.3), {
      baseNormal: r.n,
      z: r.z,
      lean: o.lean ?? 0.4,
      bend: (R() - 0.5) * o.width,
    });
  }
}

// ------------------------------------------------------------------ decals

/** Add a lighting bias inside a polygon (only where the buffer is already covered). */
export function biasPoly(g: GBuffer, pts: readonly V2[], delta: number): void {
  fillPoly(pts, (x, y) => {
    if (!g.has(x, y)) return;
    g.bias[y * g.w + x] += delta;
  });
}

/** Add a lighting bias wherever fn returns non-zero (fn gets pixel coords; covered pixels only). */
export function biasWhere(g: GBuffer, fn: (x: number, y: number) => number): void {
  for (let y = g.y0; y <= g.y1; y++)
    for (let x = g.x0; x <= g.x1; x++) {
      const i = y * g.w + x;
      if (g.mat[i] < 0) continue;
      const d = fn(x, y);
      if (d) g.bias[i] += d;
    }
}

/** Repaint covered pixels inside a polygon with another brush's material / tone / bias (keeps normals). */
export function paintPoly(g: GBuffer, b: Brush, pts: readonly V2[]): void {
  fillPoly(pts, (x, y) => {
    if (!g.has(x, y)) return;
    const i = y * g.w + x;
    g.mat[i] = b.mat;
    g.tone[i] = b.tone;
    g.bias[i] = b.bias;
    if (b.id) g.id[i] = b.id;
  });
}

