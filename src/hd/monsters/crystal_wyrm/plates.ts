// Kristal Ejder HD — crystal scale plates. Two custom volume primitives on top of the render
// library's G-buffer: the surface is split into flat PLATES (one tilted normal per plate, a
// little of the smooth normal mixed in), each with its own id, so the key light picks a tone per
// plate, crystal edge light draws a bright seam on the lit side of every plate border and spec
// glints flash on single plates as the body turns. Depth stays smooth, so plates still
// depth-merge with the rest of the part like clay.
//
// Plates are anchored to the volume (ellipsoid frame / arc length along a tube), never to the
// screen, so they travel with the body instead of swimming across it.

import { type Brush, GBuffer, type PerPoint, type V2, type V3, TAU, clamp, clamp01, hash3, pathLengths } from '../../render';

/**
 * Seam / lip pixels recorded by the plate primitives (pixel index + plate id). After lighting,
 * `applyMarks` shifts exactly one tone down (seam) or up (lip) — crisp, continuous scale lines
 * instead of a bias that only sometimes crosses a band edge. A pixel later overwritten by another
 * primitive (different id) is skipped.
 */
export interface Marks {
  seam: number[];
  lip: number[];
}
export const newMarks = (): Marks => ({ seam: [], lip: [] });

export function applyMarks(p: { g: GBuffer; detail(fn: (d: { shift(x: number, y: number, s: number): void }) => void): unknown }, m: Marks, down = 1, up = 1): void {
  const g = p.g;
  p.detail((d) => {
    for (let k = 0; k < m.seam.length; k += 2) {
      const i = m.seam[k];
      if (g.id[i] === m.seam[k + 1]) d.shift(i % g.w, Math.floor(i / g.w), -down);
    }
    for (let k = 0; k < m.lip.length; k += 2) {
      const i = m.lip[k];
      if (g.id[i] === m.lip[k + 1]) d.shift(i % g.w, Math.floor(i / g.w), up);
    }
  });
}

const perPoint = (v: PerPoint | undefined, i: number, t: number, dflt: number): number => {
  if (v === undefined) return dflt;
  if (typeof v === 'number') return v;
  if (typeof v === 'function') return v(t);
  return v[Math.min(i, v.length - 1)] ?? dflt;
};

// ------------------------------------------------------------------ ellipsoid plates

export interface PlateEllipsoidOpts {
  /** Rotation of the (rx, ry) axes, radians. */
  angle?: number;
  /** Depth radius (default min(rx, ry)). */
  rz?: number;
  z?: number;
  /** Normal z multiplier (>1 flatter front). */
  flat?: number;
  /** Approximate plate size in px. */
  cell: number;
  seed?: number;
  /** Random tilt of each plate normal (default 0.22). */
  tilt?: number;
  /** 0..1 share of the smooth normal inside a plate (default 0.25). */
  smooth?: number;
  /** First plate id (ids idBase .. idBase + plates). */
  idBase?: number;
  /** Optional bias per plate from its local center (u, v in -1..1): decals that follow plates. */
  plateBias?: (u: number, v: number) => number;
  /** Darken plate borders (1 px seams) by this bias (default 0 = no seams). */
  seam?: number;
  /** Record seam pixels here instead of biasing them (see applyMarks). */
  marks?: Marks;
}

interface PlateSet {
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  n: number;
}
const plateCache = new Map<string, PlateSet>();

/** Fibonacci points on the unit sphere's front (z > -0.35), jittered per seed. Cached. */
function spherePlates(count: number, seed: number): PlateSet {
  const key = count + ':' + seed;
  const hit = plateCache.get(key);
  if (hit) return hit;
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const jy = (hash3(i, 1, 7, seed) - 0.5) * 0.9;
    const yy = clamp(1 - (2 * (i + 0.5 + jy)) / count, -1, 1);
    const r = Math.sqrt(1 - yy * yy);
    const ph = i * golden + (hash3(i, 2, 9, seed) - 0.5) * 0.8;
    const x = Math.cos(ph) * r;
    const z = Math.sin(ph) * r;
    if (z < -0.35) continue;
    xs.push(x);
    ys.push(yy);
    zs.push(z);
  }
  const set = { x: Float32Array.from(xs), y: Float32Array.from(ys), z: Float32Array.from(zs), n: xs.length };
  plateCache.set(key, set);
  return set;
}

/** Ellipsoid covered in crystal plates (Voronoi cells on the ellipsoid's own sphere). */
export function plateEllipsoid(g: GBuffer, b: Brush, c: V2, rx: number, ry: number, o: PlateEllipsoidOpts): void {
  if (rx <= 0 || ry <= 0) return;
  const ang = o.angle ?? 0;
  const cs = Math.cos(ang);
  const sn = Math.sin(ang);
  const rz = o.rz ?? Math.min(rx, ry);
  const flat = o.flat ?? 1;
  const z0 = o.z ?? 0;
  const tilt = o.tilt ?? 0.22;
  const smooth = o.smooth ?? 0.25;
  const seed = o.seed ?? 1;
  const idBase = o.idBase ?? 1;
  const seam = o.seam ?? 0;
  const R = Math.sqrt(rx * ry);
  const count = Math.max(8, Math.round((4 * Math.PI * R * R) / (o.cell * o.cell * 0.95)));
  const P = spherePlates(count, seed);
  // plate normals (screen space), from the ellipsoid gradient at each plate center + a tilt
  const PN = new Float32Array(P.n * 3);
  const PB = new Float32Array(P.n);
  for (let k = 0; k < P.n; k++) {
    const lx = P.x[k] / rx;
    const ly = P.y[k] / ry;
    const lz = (P.z[k] / rz) * flat;
    let nx = lx * cs - ly * sn;
    let ny = lx * sn + ly * cs;
    let nz = lz;
    const m = Math.hypot(nx, ny, nz) || 1;
    nx = nx / m + (hash3(k, 3, 1, seed) - 0.5) * 2 * tilt;
    ny = ny / m + (hash3(k, 4, 2, seed) - 0.5) * 2 * tilt;
    nz = nz / m + (hash3(k, 5, 3, seed) - 0.5) * tilt;
    const m2 = Math.hypot(nx, ny, nz) || 1;
    PN[k * 3] = nx / m2;
    PN[k * 3 + 1] = ny / m2;
    PN[k * 3 + 2] = nz / m2;
    PB[k] = o.plateBias ? o.plateBias(P.x[k], P.y[k]) : 0;
  }
  const BR: (Brush | undefined)[] = new Array(P.n);
  const RR = Math.max(rx, ry) + 1;
  for (let y = Math.floor(c[1] - RR); y <= Math.ceil(c[1] + RR); y++) {
    for (let x = Math.floor(c[0] - RR); x <= Math.ceil(c[0] + RR); x++) {
      const dx = x + 0.5 - c[0];
      const dy = y + 0.5 - c[1];
      const u = (dx * cs + dy * sn) / rx;
      const v = (-dx * sn + dy * cs) / ry;
      const d2 = u * u + v * v;
      if (d2 > 1) continue;
      const w = Math.sqrt(1 - d2);
      // nearest plate center on the unit sphere (max dot product)
      let best = -2;
      let second = -2;
      let k = 0;
      for (let q = 0; q < P.n; q++) {
        const dd = P.x[q] * u + P.y[q] * v + P.z[q] * w;
        if (dd > best) {
          second = best;
          best = dd;
          k = q;
        } else if (dd > second) second = dd;
      }
      // distance to the border with the next plate, in px (angle difference on the sphere × radius, foreshortened)
      const edgePx = ((Math.acos(Math.max(-1, Math.min(1, second))) - Math.acos(Math.max(-1, Math.min(1, best)))) / 2) * R * Math.max(0.35, w);
      const isSeam = edgePx < 0.75;
      const seamB = seam && isSeam && !o.marks ? -seam : 0;
      // smooth normal at this pixel
      const lx = u / rx;
      const ly = v / ry;
      const lz = (w / rz) * flat;
      let sx = lx * cs - ly * sn;
      let sy = lx * sn + ly * cs;
      let sz = lz;
      const sm = Math.hypot(sx, sy, sz) || 1;
      sx /= sm;
      sy /= sm;
      sz /= sm;
      const nx = PN[k * 3] * (1 - smooth) + sx * smooth;
      const ny = PN[k * 3 + 1] * (1 - smooth) + sy * smooth;
      const nz = PN[k * 3 + 2] * (1 - smooth) + sz * smooth;
      let br = seamB ? undefined : BR[k];
      if (!br) {
        br = { ...b, id: idBase + k, bias: b.bias + PB[k] + seamB };
        if (!seamB) BR[k] = br;
      }
      if (g.put(x, y, nx, ny, nz, z0 + w * rz, br) && o.marks && isSeam) o.marks.seam.push(y * g.w + x, idBase + k);
    }
  }
}

// ------------------------------------------------------------------ tube plates

export interface PlateTubeOpts {
  /** Depth along the spine (per point or fn of arc fraction). */
  depth?: PerPoint;
  z?: number;
  flat?: number;
  /** Plate length along the spine, px. */
  seg: number;
  /** Facets across the visible half of the cross-section. */
  facets: number;
  /** Offset every other row by half a facet (scale / brick pattern). Default true. */
  stagger?: boolean;
  /** Each plate leans back toward the root by this much (overlapping scales). Default 0.22. */
  lean?: number;
  /** Random tilt per plate (default 0.12). */
  jitter?: number;
  /** 0..1 smooth normal share (default 0.2). */
  smooth?: number;
  seed?: number;
  idBase?: number;
  /** Arc offset of the plate rows (px) — slide the pattern along the tube. */
  offset?: number;
  /** Round end caps (default true). */
  caps?: boolean;
  /**
   * Ventral band: pixels on `side` beyond `from` (cross-section −1..1) become wide belly plates
   * (one smooth-ish plate per row, rows `seg` px long), drawn with `brush` (else +`bias`).
   */
  belly?: { from: number; side?: 1 | -1; brush?: Brush; bias?: number; seg?: number };
  /** Per-pixel extra bias from (u = arc fraction, v = cross-section −1..1). */
  biasFn?: (u: number, v: number) => number;
  /** Dark 1 px seam under the trailing edge of every plate row (bias, default 0 = none). */
  seam?: number;
  /** Lit 1 px lip on the leading edge of every plate row (bias, default 0). */
  lip?: number;
  /** Pointed scales: 0 = straight rows, ~0.8 = sharp V tips (fraction of a row). Default 0. */
  vee?: number;
  /** Which way the V tips point along the spine: +1 toward the end, −1 toward the start. */
  point?: 1 | -1;
  /** Record seam / lip pixels here instead of biasing them (see applyMarks). */
  marks?: Marks;
  /** Seams along the facet borders too (default false: facets meet in a ridge, rows get seams). */
  facetSeam?: boolean;
}

/** Tapered tube along a polyline, covered in rows of crystal plates. */
export function plateTube(g: GBuffer, b: Brush, path: readonly V2[], radius: PerPoint, o: PlateTubeOpts): void {
  if (path.length < 2) return;
  const lens = pathLengths(path);
  const total = lens[lens.length - 1] || 1;
  const n = path.length;
  const flat = o.flat ?? 1;
  const z0 = o.z ?? 0;
  const caps = o.caps ?? true;
  const facets = Math.max(1, o.facets);
  const step = Math.PI / facets;
  const stagger = o.stagger ?? true;
  const lean = o.lean ?? 0.22;
  const jit = o.jitter ?? 0.12;
  const smooth = o.smooth ?? 0.2;
  const seed = o.seed ?? 3;
  const idBase = o.idBase ?? 1;
  const off = o.offset ?? 0;
  const segL = o.seg;
  const belly = o.belly;
  const bSide = belly?.side ?? 1;
  const bSeg = belly?.seg ?? segL * 0.7;
  const seam = o.seam ?? 0;
  const lip = o.lip ?? 0;
  const vee = o.vee ?? 0;
  const point = o.point ?? 1;
  const bBrush: Brush | null = belly ? (belly.brush ?? { ...b, bias: b.bias + (belly.bias ?? 0.12) }) : null;
  const cache = new Map<number, Brush>();
  const R: number[] = [];
  const Z: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = lens[i] / total;
    R.push(Math.max(0.4, perPoint(radius, i, t, 2)));
    Z.push(perPoint(o.depth, i, t, 0));
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
    const px = -ty;
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
        const v = clamp(ox * px + oy * py, -1, 1);
        const arc = lens[s] + sl * t;
        const u = arc / total;
        const zz = z0 + Z[s] + (Z[s + 1] - Z[s]) * t + h * r;
        const extra = o.biasFn ? o.biasFn(u, v) : 0;
        if (bBrush && v * bSide > belly!.from) {
          // belly plates: one wide plate per row, rounded across, leaning back
          const ra = (arc + off) / bSeg;
          const row = Math.floor(ra);
          const fr = (ra - row) * bSeg;
          const l2 = lean * 0.8 + (hash3(row, 7, 1, seed) - 0.5) * jit;
          const nx = ox - tx * l2;
          const ny = oy - ty * l2;
          const nz = h * flat;
          const bid = idBase + 4000 + (row & 1023);
          const isS = fr > bSeg - 1;
          const isL = fr < 1;
          const sb = o.marks ? 0 : (seam && isS ? -seam : 0) + (lip && isL ? lip : 0);
          const dB = extra + sb;
          let bb = dB ? undefined : cache.get(bid);
          if (!bb) {
            bb = { ...bBrush, bias: bBrush.bias + dB, id: bid };
            if (!dB) cache.set(bid, bb);
          }
          if (g.put(x, y, nx, ny, nz, zz, bb) && o.marks) {
            if (isS && seam) o.marks.seam.push(y * g.w + x, bid);
            else if (isL && lip) o.marks.lip.push(y * g.w + x, bid);
          }
          continue;
        }
        // pointed scales: the row boundary is shifted by the position inside the facet, so each
        // scale ends in a V pointing along `point`; staggered rows nest into a diamond lattice
        const phi = Math.asin(v);
        const pf = phi / step;
        let ra = (arc + off) / segL;
        let row = Math.floor(ra);
        for (let it = 0; it < 2; it++) {
          const sh = stagger && row & 1 ? 0.5 : 0;
          const cf = pf + sh - Math.floor(pf + sh) - 0.5;
          ra = (arc + off) / segL - point * vee * (0.5 - Math.abs(cf));
          const nr = Math.floor(ra);
          if (nr === row) break;
          row = nr;
        }
        const fr = (ra - row) * segL;
        const fi = Math.floor(pf + (stagger && row & 1 ? 0.5 : 0));
        const q = (fi + (stagger && row & 1 ? 0 : 0.5)) * step;
        const qq = clamp(q, -Math.PI / 2, Math.PI / 2);
        const sq = Math.sin(qq);
        const cq = Math.cos(qq);
        const j1 = (hash3(row, fi, 11, seed) - 0.5) * 2 * jit;
        const j2 = (hash3(row, fi, 12, seed) - 0.5) * 2 * jit;
        // plate normal: faceted cross-section, leaning back toward the root, jittered
        let nx = px * sq - tx * lean + j1;
        let ny = py * sq - ty * lean + j2;
        let nz = cq * flat;
        // blend in the smooth normal
        nx = nx * (1 - smooth) + ox * smooth;
        ny = ny * (1 - smooth) + oy * smooth;
        nz = nz * (1 - smooth) + h * flat * smooth;
        const id = idBase + ((row & 255) * 16 + ((fi + 8) & 15));
        // seam along the facet border too (scaled by how close the pixel is to it, in px)
        const fb = Math.abs(phi / step + (stagger && row & 1 ? 0.5 : 0) - Math.round(phi / step + (stagger && row & 1 ? 0.5 : 0))) * step * r * Math.max(0.3, cq);
        const isS = fr > segL - 1 || (!!o.facetSeam && fb < 0.5);
        const isL = fr < 1;
        const sb = o.marks ? 0 : (seam && isS ? -seam : 0) + (lip && isL ? lip : 0);
        const dS = extra + sb;
        let bs = dS ? undefined : cache.get(id);
        if (!bs) {
          bs = { ...b, bias: b.bias + dS, id };
          if (!dS) cache.set(id, bs);
        }
        if (g.put(x, y, nx, ny, nz, zz, bs) && o.marks) {
          if (isS && seam) o.marks.seam.push(y * g.w + x, id);
          else if (isL && lip) o.marks.lip.push(y * g.w + x, id);
        }
      }
    }
  }
}

/** Unit vector of an angle in degrees (re-exported convenience for authoring). */
export const dirDeg = (deg: number): V2 => [Math.cos((deg * TAU) / 360), Math.sin((deg * TAU) / 360)];

/** Normalized 3D vector. */
export const n3 = (x: number, y: number, z: number): V3 => {
  const m = Math.hypot(x, y, z) || 1;
  return [x / m, y / m, z / m];
};
