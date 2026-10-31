// Kül Ejderi (ashen_drake) v3 — the cloak: two plate fields (docs/v3/kart-a/ashen_drake.md §1.2, §1.3, §3.1).
//
// Each wing is a hooded cloak hanging from its wrist peak: a Coons patch between four boundary
// curves (back edge, front edge = the arm, the short top edge at the peak, the hem), cut into 8 rows
// of plates (1·2·2·3·3·3·4·4 = 22 per wing, 44 in all). The plates give the COVERAGE (the scalloped hem,
// the per-plate states of the summon / tear / regrowth); the TEXTURE is shingle courses laid over the
// hood's (u, v) field: rows ≈ 3.5 px with a full-width darker crease, short staggered joint ticks, 2–3
// large light planes (stone2 lit / stone1 shadow, stone0 only in creases, stone3 lips on the top two
// courses), sampled from the hood WITHOUT its wrist offset so the breath moves the silhouette, not the
// tiles. P2's relight is the same geometry lit from the right (the opaque mask never depends on the light).
//   - shape keys per wing (FOLD hood, OPEN spread, MANTLE canopy, COCOON wrap) blended by the pose;
//   - plate states by the shared accretion order ASHEN_ORDER (summon build, attack tear-off / regrowth);
//   - the bare wing struts (arm + 3 fingers) under the plates, the bony wrist spur over them;
//   - the ripple (one row 1 px down), the hem flakes (2×2 chips that peel off and re-seat).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { add, despeckle, fillPoly, lerpV, mul, n3, sub, len, norm, type Light, type V, type Workspace } from '../rigkit';
import { CLOAK_RAMP, M, W, H, hash } from './ashen_drake-gbuf';

export type WingId = 'N' | 'F';

/** the cloak's boundary: back edge (top→hem), front edge (top→hem); top = back[0]→front[0], hem = back[n]→front[n] */
export interface CloakShape {
  readonly back: readonly V[];
  readonly front: readonly V[];
  /** mid control of the top edge (back[0] → front[0]) and of the hem (back[last] → front[last]) */
  readonly topMid: V;
  readonly hemMid: V;
}

const S = (back: V[], front: V[], topMid: V, hemMid: V): CloakShape => ({ back, front, topMid, hemMid });

/** Key shapes (frame px, body offset 0, breath 0). The near wrist is front[0], the far wrist back[0]. */
type Key = 'fold' | 'open' | 'mantle' | 'cocoon' | 'spread';
export const SHAPES: Readonly<Record<WingId, Readonly<Record<Key, CloakShape>>>> = {
  N: {
    // the hood (critic r3 #3): the two wrists round into ONE shoulders-up curve, the near half from the
    // shallow notch (x 47) over its crown to the wrist, never a separate cone tip
    fold: S(
      [[47, 18], [40, 25], [36, 42], [34, 60], [35, 80]],
      [[61, 15], [63, 25], [61, 38], [53, 57], [47, 77]],
      [54, 12.5],
      [40, 83],
    ),
    open: S(
      [[46, 22], [32, 24], [20, 34], [13, 46], [10, 60]],
      [[66, 15], [64, 25], [58, 39], [48, 55], [34, 70]],
      [56, 16],
      [20, 68],
    ),
    // the victory canopy (critic r3 #5): a SHORT forward hood over the shoulders, its hem ending behind the
    // skull so the head (out in front, below) reads as its own shape with a floor-navy gap above the crest
    mantle: S(
      [[50, 20], [55, 22], [61, 28], [66, 36], [69, 44]],
      [[60, 15], [70, 17], [78, 23], [83, 31], [85, 39]],
      [55, 15],
      [78, 44],
    ),
    cocoon: S(
      [[50, 18], [42, 28], [38, 46], [38, 62], [40, 80]],
      [[64, 20], [70, 30], [72, 46], [70, 62], [64, 82]],
      [57, 17],
      [52, 84],
    ),
    // the summon's burst (§4.7): the near hand thrown forward and UP over the head, its hem a
    // trailing edge from the shoulder to the forward tip, so the skull stays readable under it
    // (critic r3 #6) a WING, not an umbrella: the wrist flung out to the far end of a long leading edge, the
    // fingers fanning back from it to a ragged trailing edge that runs back to the shoulder
    spread: S(
      [[98, 10], [88, 14], [78, 19], [70, 25], [63, 32]],
      [[101, 10], [104, 17], [106, 24], [107, 30], [108, 35]],
      [99.5, 9],
      [86, 37],
    ),
  },
  F: {
    fold: S(
      [[36, 19], [30, 26], [28, 42], [26, 58], [29, 77]],
      [[47, 18], [48, 30], [47, 46], [44, 62], [40, 78]],
      [41.5, 14.5],
      [33, 81],
    ),
    open: S(
      [[36, 19], [22, 22], [12, 31], [7, 42], [6, 56]],
      [[40, 20], [37, 27], [34, 38], [30, 50], [24, 64]],
      [38, 18],
      [12, 62],
    ),
    mantle: S(
      [[45, 18], [49, 21], [55, 27], [60, 35], [63, 42]],
      [[51, 15], [60, 16], [68, 21], [74, 29], [77, 37]],
      [48, 15],
      [71, 41],
    ),
    cocoon: S(
      [[42, 18], [34, 27], [30, 44], [30, 62], [32, 80]],
      [[46, 20], [52, 30], [56, 46], [56, 62], [52, 80]],
      [44, 18],
      [42, 82],
    ),
    // the burst: the far hand thrown BACK, full height
    spread: S(
      [[13, 10], [10, 17], [8, 24], [6, 30], [5, 36]],
      [[17, 10], [26, 14], [35, 19], [42, 25], [47, 31]],
      [15, 9],
      [26, 37],
    ),
  },
};

export interface WingPose {
  /** wrist peak offset from its key position (px) */
  wrist: [number, number];
  open: number;
  mantle: number;
  cocoon: number;
  /** the summon's burst: the near hand forward and up, the far hand back (0 … 1; optional, default 0) */
  spread?: number;
  /** the plate row offset 1 px down this frame (−1 none) */
  ripple: number;
}

const blendV = (k: Record<Key, V>, w: WingPose): V => {
  const f = k.fold;
  const sp = w.spread ?? 0;
  return [
    f[0] + (k.open[0] - f[0]) * w.open + (k.mantle[0] - f[0]) * w.mantle + (k.cocoon[0] - f[0]) * w.cocoon + (k.spread[0] - f[0]) * sp,
    f[1] + (k.open[1] - f[1]) * w.open + (k.mantle[1] - f[1]) * w.mantle + (k.cocoon[1] - f[1]) * w.cocoon + (k.spread[1] - f[1]) * sp,
  ];
};

/** The blended, posed shape: `off` moves the whole cloak, the wrist moves the top (fading to the hem). */
export function cloakShape(wing: WingId, w: WingPose, off: V): CloakShape {
  const K = SHAPES[wing];
  const pick = (get: (s: CloakShape) => V): V => blendV({ fold: get(K.fold), open: get(K.open), mantle: get(K.mantle), cocoon: get(K.cocoon), spread: get(K.spread) }, w);
  const n = K.fold.back.length;
  const wristAt = (i: number) => mul(w.wrist, 1 - i / (n - 1));
  const back = K.fold.back.map((_, i) => add(add(pick((s) => s.back[i]), off), wristAt(i)));
  const front = K.fold.front.map((_, i) => add(add(pick((s) => s.front[i]), off), wristAt(i)));
  return {
    back,
    front,
    topMid: add(add(pick((s) => s.topMid), off), w.wrist),
    hemMid: add(pick((s) => s.hemMid), off),
  };
}

// ------------------------------------------------------------------ the patch

/** point on a polyline at arc fraction t (Catmull-Rom smoothed between its control points) */
function curveAt(pts: readonly V[], t: number): V {
  const n = pts.length - 1;
  const x = Math.max(0, Math.min(n - 1e-9, t * n));
  const i = Math.floor(x);
  const s = x - i;
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(n, i + 2)];
  const s2 = s * s;
  const s3 = s2 * s;
  const c = (a: number, b: number, d: number, e: number) => 0.5 * (2 * b + (-a + d) * s + (2 * a - 5 * b + 4 * d - e) * s2 + (-a + 3 * b - 3 * d + e) * s3);
  return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])];
}
const quad = (a: V, m: V, b: V, t: number): V => {
  const u = 1 - t;
  // m is a point the curve passes through at t = 0.5
  const c: V = [2 * m[0] - 0.5 * (a[0] + b[0]), 2 * m[1] - 0.5 * (a[1] + b[1])];
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
};

/** Coons patch: u 0 = back edge … 1 = front edge, v 0 = top … 1 = hem (v may run a little past 1) */
export function patchAt(s: CloakShape, u: number, v: number): V {
  const n = s.back.length - 1;
  const vv = Math.min(1, Math.max(0, v));
  const L = curveAt(s.back, vv);
  const R = curveAt(s.front, vv);
  const T = quad(s.back[0], s.topMid, s.front[0], u);
  const B = quad(s.back[n], s.hemMid, s.front[n], u);
  const P00 = s.back[0];
  const P10 = s.front[0];
  const P01 = s.back[n];
  const P11 = s.front[n];
  const x = (1 - vv) * T[0] + vv * B[0] + (1 - u) * L[0] + u * R[0] - ((1 - u) * (1 - vv) * P00[0] + u * (1 - vv) * P10[0] + (1 - u) * vv * P01[0] + u * vv * P11[0]);
  const y = (1 - vv) * T[1] + vv * B[1] + (1 - u) * L[1] + u * R[1] - ((1 - u) * (1 - vv) * P00[1] + u * (1 - vv) * P10[1] + (1 - u) * vv * P01[1] + u * vv * P11[1]);
  if (v <= 1) return [x, y];
  // past the hem: continue straight down the patch's v direction
  const a = patchAt(s, u, 0.97);
  const d = norm(sub([x, y], a));
  return add([x, y], mul(d, (v - 1) * len(sub(B, T))));
}

// ------------------------------------------------------------------ plates

/** row boundaries in v (row r spans ROWS[r] … ROWS[r + 1]) and plates per row */
export const ROWS: readonly number[] = [0, 0.08, 0.17, 0.27, 0.38, 0.5, 0.63, 0.79, 1];
export const COLS: readonly number[] = [1, 2, 2, 3, 3, 3, 4, 4];
export const NROW = COLS.length;

export interface Plate {
  readonly id: number;
  readonly wing: WingId;
  readonly row: number;
  readonly col: number;
  readonly u0: number;
  readonly u1: number;
}

function layout(wing: WingId, base: number): Plate[] {
  const out: Plate[] = [];
  let id = base;
  for (let r = 0; r < NROW; r++) {
    const n = COLS[r];
    // staggered courses: odd rows shift half a plate toward the front
    const stag = r % 2 ? 0.5 / n : 0;
    for (let c = 0; c < n; c++) {
      const u0 = Math.max(0, (c - 0.5 + 0.5) / n - (c === 0 ? 0 : 0.04) + (c === 0 ? 0 : stag));
      const u1 = Math.min(1, (c + 1) / n + (c === n - 1 ? 0 : stag));
      out.push({ id: id++, wing, row: r, col: c, u0, u1 });
    }
  }
  return out;
}

/** all 44 plates: near 0…21, far 22…43 */
export const PLATES: readonly Plate[] = Object.freeze([...layout('N', 0), ...layout('F', 22)]);
export const NPLATES = PLATES.length;

/**
 * The accretion order (§3.1, §4.7): hem-first, spread over both cloaks in scattered patches; row k
 * seats only when ≥ 60 % of row k + 1 is seated. The summon seats plates in this order, the attack
 * tears them off in its reverse and regrows them in it again.
 */
export const ASHEN_ORDER: readonly number[] = (() => {
  const seated = new Set<number>();
  const order: number[] = [];
  const rowDone = (wing: WingId, r: number) => {
    const all = PLATES.filter((p) => p.wing === wing && p.row === r);
    return all.filter((p) => seated.has(p.id)).length / all.length;
  };
  let k = 0;
  while (order.length < NPLATES) {
    const ready = PLATES.filter((p) => !seated.has(p.id) && (p.row === NROW - 1 || rowDone(p.wing, p.row + 1) >= 0.6));
    // prefer the lowest rows, scattered by a seeded hash
    ready.sort((a, b) => b.row - a.row + (hash(a.id, 7, k) - hash(b.id, 7, k)) * 1.6);
    const p = ready[0];
    seated.add(p.id);
    order.push(p.id);
    k++;
  }
  return Object.freeze(order);
})();

/** rank of a plate in the accretion order */
const RANK: readonly number[] = (() => {
  const r: number[] = [];
  ASHEN_ORDER.forEach((id, i) => (r[id] = i));
  return r;
})();
export const plateRank = (id: number) => RANK[id];

/** the plate's outline in screen px (top edge, side, rounded tip) */
export function platePoly(s: CloakShape, p: Plate, rippleRow: number): { poly: V[]; top: V; tip: V } {
  const v0 = ROWS[p.row];
  const v1 = ROWS[p.row + 1];
  const long = p.row >= NROW - 2;
  const tip = (v1 - v0) * (p.row === NROW - 1 ? 0.5 + 0.25 * hash(p.id, 9) : long ? 0.75 : 0.62);
  const dy = p.row === rippleRow ? 1 : 0;
  const pts: V[] = [];
  const K = 4;
  for (let i = 0; i <= K; i++) pts.push(patchAt(s, p.u0 + ((p.u1 - p.u0) * i) / K, v0));
  pts.push(patchAt(s, p.u1, v1));
  // a feather tip: a pointed V, a little rounded; the tip leans back (toward u 0)
  const lean = long ? 0.38 : 0.45;
  for (let i = K; i >= 0; i--) {
    const t = i / K;
    const tri = t < lean ? t / lean : (1 - t) / (1 - lean);
    const bulge = 0.2 + 0.8 * Math.pow(tri, 0.8);
    pts.push(patchAt(s, p.u0 + (p.u1 - p.u0) * t, v1 + tip * bulge));
  }
  pts.push(patchAt(s, p.u0, v1));
  const um = (p.u0 + p.u1) / 2;
  const off: V = [0, dy];
  return { poly: pts.map((q) => add(q, off)), top: add(patchAt(s, um, v0), off), tip: add(patchAt(s, um, v1 + tip), off) };
}

/** the centre of a plate (its middle, half way down) */
export function plateCenter(s: CloakShape, p: Plate): V {
  return patchAt(s, (p.u0 + p.u1) / 2, (ROWS[p.row] + ROWS[p.row + 1]) / 2);
}

/** the hood's surface normal at (u, v) of a wing (authored for the P1 view; the light does the rest) */
function hoodNormal(wing: WingId, u: number, v: number, w: WingPose): [number, number, number] {
  const nx = wing === 'N' ? -0.95 + 1.45 * u : -1.1 + 0.6 * u;
  // the canopy (mantle) turns its back UP to the light: its top courses lit, the hem side dark
  const ny = -0.85 + 1.15 * v - 0.4 * w.open - 0.3 * w.mantle - 0.35 * (w.spread ?? 0);
  const nz = 0.7 + 0.2 * w.cocoon;
  return [nx, ny, nz];
}

// ------------------------------------------------------------------ the layer

export type PlateState = 'seated' | 'weld' | 'gone';

export interface CloakDraw {
  readonly layer: PixelCanvas;
  /** pixels of the hem row's tip edge (the ember lip runs on them): x, y pairs */
  readonly hem: number[];
  /** the tip edge pixels of plates welded this frame: x, y pairs */
  readonly welds: number[];
  readonly shape: CloakShape;
  /** which plate owns each pixel (−1 none): a copy for the frame */
  readonly own: Int16Array;
}

const OWN = new Int16Array(W * H);
const RID = new Int16Array(W * H);
const CJ = new Uint8Array(W * H);
const NU_CELLS = 8;
const CR = new Uint8Array(W * H);
const FU = new Float32Array(W * H);
const FV = new Float32Array(W * H);
const SID = new Int16Array(W * H);
const SC_MAX = 40;
const SC_N = new Float32Array(SC_MAX);
const SC_ST = new Float32Array(SC_MAX);
const SC_T = new Uint8Array(SC_MAX * 64);
const IB: [number, number] = [0, 0];
const cross2 = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;
/** inverse bilinear: (s, t) of point (px, py) in the quad a(0,0) b(1,0) c(1,1) d(0,1) → IB */
function invBilinear(px: number, py: number, a: V, b: V, c: V, d: V): void {
  const ex = b[0] - a[0], ey = b[1] - a[1];
  const fx = d[0] - a[0], fy = d[1] - a[1];
  const gx = a[0] - b[0] + c[0] - d[0], gy = a[1] - b[1] + c[1] - d[1];
  const hx = px - a[0], hy = py - a[1];
  const k2 = cross2(gx, gy, fx, fy);
  const k1 = cross2(ex, ey, fx, fy) + cross2(hx, hy, gx, gy);
  const k0 = cross2(hx, hy, ex, ey);
  let v: number;
  if (Math.abs(k2) < 1e-6) v = Math.abs(k1) > 1e-9 ? -k0 / k1 : 0.5;
  else {
    const disc = k1 * k1 - 4 * k0 * k2;
    const sq = Math.sqrt(Math.max(0, disc));
    v = (-k1 - sq) / (2 * k2);
    if (v < -0.05 || v > 1.05) v = (-k1 + sq) / (2 * k2);
  }
  const dx = ex + gx * v;
  const dy = ey + gy * v;
  const u = Math.abs(dx) > Math.abs(dy) ? (hx - fx * v) / dx : Math.abs(dy) > 1e-9 ? (hy - fy * v) / dy : 0.5;
  IB[0] = Math.max(0, Math.min(1, u));
  IB[1] = Math.max(0, Math.min(1, v));
}
const TIPX = new Float32Array(64);
/** the light's intensity on a facet normal (the frame's key light + its lift) */
const lightI = (L: Light, n: readonly number[]) => n[0] * L.v[0] + n[1] * L.v[1] + n[2] * L.v[2] + L.lift;

/**
 * Draw one cloak into a pooled layer. `state(id)` says whether each plate is seated, welded this
 * frame or gone (torn off / not yet built). The struts are drawn first (bare bones), the plates over
 * them hem row first, then the spur.
 */
export function drawCloak(ws: Workspace, light: Light, wing: WingId, w: WingPose, off: V, state: (id: number) => PlateState, o: { far: boolean; struts: boolean; fan?: number; reach?: number; stubs?: boolean; shoulder?: V; spars?: number }): CloakDraw {
  const s = cloakShape(wing, w, off);
  const q = ws.canvas();
  const hem: number[] = [];
  const welds: number[] = [];
  OWN.fill(-1);
  const plates = PLATES.filter((p) => p.wing === wing);
  const shift = o.far ? 1 : 0;

  // ---- the bare struts: the arm (shoulder → wrist) and three finger bones FANNING from the wrist like a
  //      stripped bat hand (≈ 30° between fingers, each bowed ≥ 4 px with a knuckle blob at ~45 %, a
  //      hooked tip), ragged membrane stubs between the finger roots (stone1): never parallel rails
  const knuckles: V[] = [];
  if (o.struts) {
    const r = ws.raster();
    // the wrist the hand hangs from: the near wing's front peak, the far wing's back peak (where its spur sits)
    const wrist = o.far ? s.back[0] : s.front[0];
    const arm = [s.front[2], s.front[1], wrist];
    const mat = o.far ? M.FAR : M.BONE;
    r.tube(arm, 3.4, 2.4, mat, { z: 2, flat: 1.4 });
    // the forearm: a 3-px bone from the shoulder up to the wrist peak (the bare hand is never spider legs)
    if (o.shoulder) r.tube([o.shoulder, lerpV(o.shoulder, wrist, 0.55), wrist], 3.2, 2.6, mat, { z: 2.2, flat: 1.4 });
    const hm = patchAt(s, 0.5, 1);
    const toHem = sub(hm, wrist);
    const reach = len(toHem) || 1;
    const dir = mul(toHem, 1 / reach);
    // which way is "back" (the back edge side) as a rotation sign
    const bk = sub(s.back[s.back.length - 1], wrist);
    const sgn = dir[0] * bk[1] - dir[1] * bk[0] > 0 ? 1 : -1;
    const rot = (v: V, deg: number): V => {
      const a = (deg * sgn * Math.PI) / 180;
      return [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
    };
    const roots: V[] = [];
    const fingers: [V, V][] = [];
    const bones: V[][] = [];
    const fan = o.fan ?? 1;
    // the far hand fans further back and shorter, so its fingers stay behind / above the near ones
    const farRot = o.far ? 22 : 0;
    for (const [deg, lk, wd, bow, pu, pv] of [[o.far ? 34 : 18, o.far ? 0.86 : 0.8, 2.4, 4.4, 0.08, 0.92], [o.far ? 4 : 0, 0.95, 2.2, 4, 0.4, 0.98], [o.far ? -26 : -22, 0.78, 2, 3.4, 0.74, 0.86]] as const) {
      // fan 1: the stripped bat hand; fan 0: the fingers lie inside the cloak's own outline (the
      // summon builds the hand under the plates it is about to carry)
      const fanEnd = add(wrist, mul(rot(dir, deg + farRot), reach * lk * (o.reach ?? 1) * (o.far ? 0.58 : 1)));
      const end = lerpV(patchAt(s, pu, pv), fanEnd, fan);
      const d = norm(sub(end, wrist));
      const s0 = add(wrist, mul(d, 2.5));
      const perp: V = [-d[1] * sgn, d[0] * sgn];
      const knuckle = add(lerpV(s0, end, 0.45), mul(perp, bow));
      const mid2 = add(lerpV(s0, end, 0.74), mul(perp, bow * 0.62));
      const hook = add(end, add(mul(perp, -1.8), mul(d, -1.2)));
      if (o.stubs) {
        // the summon before the cloak is ~70 % seated: only the finger ROOTS (never wires over a half-built hood)
        r.tube([s0, lerpV(s0, knuckle, 0.4)], wd, wd - 0.4, M.HIDE + (o.far ? 1 : 0), { z: 1, flat: 1.4 });
        continue;
      }
      // the finger itself is hand-drawn after the render (2 px at the base tapering to 1, a lit edge)
      bones.push([s0, lerpV(s0, knuckle, 0.5), knuckle, mid2, end, hook]);
      knuckles.push(knuckle, mid2);
      roots.push(lerpV(s0, knuckle, 0.85));
      fingers.push([s0, knuckle]);
    }
    void mat;
    const c = ws.render(r);
    // the membrane stubs: a ragged stone1 web between neighbouring finger roots (drawn under the bones)
    const web = o.far ? PAL.stone0 : PAL.stone1;
    for (let i = 0; i < fingers.length - 1; i++) {
      const a0 = fingers[i][0];
      const a1 = roots[i];
      const b1 = roots[i + 1];
      const at = (k: number, d: number) => lerpV(a0, lerpV(a1, b1, k), d);
      const poly: V[] = [a0, a1, at(0.25, 0.84), at(0.42, 0.66), at(0.6, 0.8), at(0.8, 0.7), b1];
      fillPoly(poly, (x, y) => {
        if (x < 0 || y < 0 || x >= W || y >= H) return;
        // ragged hem of the stub: eaten notches near its free edge
        if (hash(x, y, 71) < 0.18 && Math.hypot(x - a0[0], y - a0[1]) > 6) return;
        q.set(x, y, web);
      });
    }
    q.blit(c, 0, 0);
    // the finger bones (critic r3 #10): 2 px at the base tapering to 1 px past the second joint, the edge
    // toward the light one step up (stone3 near / stone2 far), the shadow edge one down; then a knuckle
    // node on every joint (2×2, lit corner) — bony spindles, never wires
    const hi = o.far ? PAL.stone2 : PAL.stone3;
    const mid = o.far ? PAL.stone1 : PAL.stone2;
    const lo = o.far ? PAL.stone0 : PAL.stone1;
    for (const b of bones) {
      let total = 0;
      for (let i = 1; i < b.length; i++) total += len(sub(b[i], b[i - 1]));
      let acc = 0;
      for (let i = 1; i < b.length; i++) {
        const a = b[i - 1];
        const d = sub(b[i], a);
        const L = len(d) || 1;
        const steps = Math.ceil(L * 2);
        // the side toward the light, in screen px (light.side −1: the left / up side is lit)
        const nrm: V = [-d[1] / L, d[0] / L];
        // the second px always sits on the bone's upper side (the opaque mask never depends on the light);
        // only its tone follows the light
        const upSign = nrm[1] < 0 || (nrm[1] === 0 && nrm[0] < 0) ? 1 : -1;
        const litUp = (nrm[0] * upSign) * light.side + (nrm[1] * upSign) <= 0;
        for (let k = 0; k <= steps; k++) {
          const t = k / steps;
          const pnt = add(a, mul(d, t));
          const at = (acc + L * t) / (total || 1);
          const x = Math.floor(pnt[0]);
          const y = Math.floor(pnt[1]);
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          if (at < 0.62) {
            const ox = Math.round(nrm[0] * upSign);
            const oy = Math.round(nrm[1] * upSign);
            q.set(x, y, litUp ? mid : lo);
            if (x + ox >= 0 && x + ox < W && y + oy >= 0 && y + oy < H) q.set(x + ox, y + oy, litUp ? hi : mid);
          } else q.set(x, y, at > 0.93 ? lo : mid);
        }
        acc += L;
      }
    }
    for (const kn of knuckles) {
      const x = Math.round(kn[0] - 1);
      const y = Math.round(kn[1] - 1);
      if (x < 0 || y < 0 || x + 1 >= W || y + 1 >= H) continue;
      const lx = light.side < 0 ? 0 : 1;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) q.set(x + dx, y + dy, dx === lx && dy === 0 ? hi : dy === 1 && dx !== lx ? lo : mid);
    }
  }

  // ---- plates: placed hem row first, each upper row over the one below (OWN: the owner of a pixel; the
  //      plates give the coverage, the scalloped hem and the per-plate states)
  const L = light;
  let bx0 = W;
  let by0 = H;
  let bx1 = -1;
  let by1 = -1;
  for (let r = NROW - 1; r >= 0; r--) {
    for (const p of plates.filter((pp) => pp.row === r)) {
      if (state(p.id) === 'gone') continue;
      const { poly, tip } = platePoly(s, p, w.ripple);
      TIPX[p.id] = tip[0];
      fillPoly(poly, (x, y) => {
        if (x < 0 || y < 0 || x >= W || y >= H) return;
        OWN[y * W + x] = p.id;
        if (x < bx0) bx0 = x;
        if (x > bx1) bx1 = x;
        if (y < by0) by0 = y;
        if (y > by1) by1 = y;
      });
    }
  }
  // ---- the tone pass (critic r3 #2, §1.3 plate rule, IŞ-5, MA-2): the plates give the COVERAGE (and their
  //      states); the TEXTURE is overlapping SCALE PLATES laid over the hood's (u, v) field — staggered rows
  //      ≈ 4.2 px, each plate 4–6 px wide with a rounded, slightly ragged lower edge that hangs over the plate
  //      below (its underside one or two steps down: the stone1 lip). The cloak is lit as ONE form: stone3 on
  //      the upper third toward the light, falling through stone2 to stone1 toward the hem and the inside
  //      edge; the far cloak a whole value step lower. The courses are laid on the hood WITHOUT its wrist
  //      offset (the breath moves the silhouette, not the tiles); the rippled plate row samples 1 px up.
  const n = s.back.length - 1;
  let Lv = 0;
  const ts = cloakShape(wing, { ...w, wrist: [0, 0] }, off);
  for (let i = 1; i <= n; i++) Lv += (len(sub(ts.back[i], ts.back[i - 1])) + len(sub(ts.front[i], ts.front[i - 1]))) / 2;
  const NR = Math.max(4, Math.min(24, Math.round(Lv / 3.6)));
  const NU = NU_CELLS;
  RID.fill(-1);
  const GP: V[] = [];
  let gx0 = W;
  let gx1 = 0;
  let gy0 = H;
  let gy1 = 0;
  for (let r = 0; r <= NR + 2; r++)
    for (let j = 0; j <= NU; j++) {
      const g = patchAt(ts, j / NU, r / NR);
      GP.push(g);
      if (r <= NR) {
        gx0 = Math.min(gx0, g[0]);
        gx1 = Math.max(gx1, g[0]);
        gy0 = Math.min(gy0, g[1]);
        gy1 = Math.max(gy1, g[1]);
      }
    }
  const gp = (r: number, j: number) => GP[r * (NU + 1) + j];
  for (let r = 0; r <= NR + 1; r++)
    for (let j = 0; j < NU; j++) {
      const a = gp(r, j);
      const b = gp(r, j + 1);
      const c = gp(r + 1, j + 1);
      const d = gp(r + 1, j);
      fillPoly([a, b, c, d], (x, y) => {
        if (x < 0 || y < 0 || x >= W || y >= H || OWN[y * W + x] < 0) return;
        const i = y * W + x;
        RID[i] = r;
        CJ[i] = j;
        invBilinear(x + 0.5, y + 0.5, a, b, c, d);
        FU[i] = (j + IB[0]) / NU;
        FV[i] = (r + IB[1]) / NR;
      });
    }
  // gaps of the quad raster (and the wrist's lift above the course field): the pixel above / left, then
  // the one below / right, else the plate's own course
  const copy = (i: number, j: number) => {
    RID[i] = RID[j];
    CJ[i] = CJ[j];
    FU[i] = FU[j];
    FV[i] = FV[j];
  };
  for (let y = by0; y <= by1; y++)
    for (let x = bx0; x <= bx1; x++) {
      const i = y * W + x;
      if (OWN[i] < 0 || RID[i] >= 0) continue;
      const j = y > 0 && RID[i - W] >= 0 ? i - W : x > 0 && RID[i - 1] >= 0 ? i - 1 : -1;
      if (j >= 0) copy(i, j);
    }
  for (let y = by1; y >= by0; y--)
    for (let x = bx1; x >= bx0; x--) {
      const i = y * W + x;
      if (OWN[i] < 0 || RID[i] >= 0) continue;
      const j = y + 1 < H && RID[i + W] >= 0 ? i + W : x + 1 < W && RID[i + 1] >= 0 ? i + 1 : -1;
      if (j >= 0) copy(i, j);
      else {
        const pl = PLATES[OWN[i]];
        RID[i] = Math.round(ROWS[pl.row] * NR);
        CJ[i] = Math.min(NU - 1, Math.floor(((pl.u0 + pl.u1) / 2) * NU));
        FU[i] = (pl.u0 + pl.u1) / 2;
        FV[i] = ROWS[pl.row];
      }
    }
  const spread = w.spread ?? 0;
  // the scale rows: count of plates per row from the hood's width there (≈ 5 px a plate), a stagger
  const PH = 5;
  const NPR = Math.min(SC_MAX - 1, Math.ceil(Lv / PH) + 2);
  for (let pr = 0; pr <= NPR; pr++) {
    const vc = Math.min(1.1, ((pr + 0.5) * PH) / (Lv || 1));
    const wd = len(sub(patchAt(ts, 1, vc), patchAt(ts, 0, vc)));
    SC_N[pr] = Math.max(1, Math.round(wd / 6.2));
    SC_ST[pr] = (pr % 2) * 0.5 + (hash(pr, 91, shift) - 0.5) * 0.1;
  }
  const bulge = (pr: number, c: number, fx: number) => {
    const t = 2 * fx - 1;
    const dep = 2.6 + hash(pr, c, 93 + shift) * 0.6;
    // a ragged lower edge: one bite or one tooth per plate, never symmetric
    const bite = hash(pr, c, 96) < 0.4 && Math.floor(fx * 4) === 1 + Math.floor(hash(pr, c, 94) * 2) ? -1 : 0;
    return dep * (1 - t * t) + bite;
  };
  // pass 1: the owning scale of every pixel
  SID.fill(-1);
  for (let y = by0; y <= by1; y++)
    for (let x = bx0; x <= bx1; x++) {
      const i0 = y * W + x;
      SID[i0] = -1;
      const id = OWN[i0];
      if (id < 0) continue;
      const i = PLATES[id].row === w.ripple && y > 0 && RID[i0 - W] >= 0 ? i0 - W : i0;
      const vpx = FV[i] * Lv;
      const u = FU[i];
      let pr = Math.max(0, Math.min(NPR, Math.floor(vpx / PH)));
      const ly = vpx - pr * PH;
      let sp = u * SC_N[pr] + SC_ST[pr];
      if (pr > 0) {
        const su = u * SC_N[pr - 1] + SC_ST[pr - 1];
        const cu = Math.floor(su);
        if (ly < bulge(pr - 1, cu, su - cu)) {
          pr -= 1;
          sp = su;
        }
      }
      SID[i0] = pr * 64 + Math.floor(sp) + 8;
    }
  // pass 2: the tones — one body tone per plate (the form's light), its lower edge one / two steps down
  const cx = (gx0 + gx1) / 2;
  const cy = (gy0 + gy1) / 2;
  const hw = Math.max(4, (gx1 - gx0) / 2);
  const hh = Math.max(4, (gy1 - gy0) / 2);
  SC_T.fill(255);
  const toneOf = (sid: number): number => {
    if (SC_T[sid] !== 255) return SC_T[sid];
    const pr = Math.floor(sid / 64);
    const c = (sid % 64) - 8;
    const u = Math.max(0, Math.min(1, (c + 0.5 - SC_ST[pr]) / SC_N[pr]));
    const v = Math.min(1, ((pr + 0.5) * PH) / (Lv || 1));
    const P = patchAt(ts, u, v);
    let k: number;
    if (spread > 0.5) k = v < 0.42 ? 3 : v < 0.7 ? 2 : 1;
    else {
      const gx = ((P[0] - cx) / hw) * L.side;
      const gy = (cy - P[1]) / hh;
      const nn = hoodNormal(wing, u, v, w);
      const g = 0.6 * gx + 0.8 * gy + 0.35 * (nn[0] * L.v[0]) + (hash(pr, c, 97) - 0.5) * 0.22;
      k = g > 0.45 ? 3 : g > -0.3 ? 2 : 1;
    }
    if (shift) k = Math.max(1, k - 1);
    SC_T[sid] = k;
    return k;
  };
  for (let y = by0; y <= by1; y++)
    for (let x = bx0; x <= bx1; x++) {
      const i0 = y * W + x;
      const sid = SID[i0];
      if (sid < 0) continue;
      const k = toneOf(sid);
      const below = y + 1 < H ? SID[i0 + W] : -1;
      // the plate's rounded rim: its lower edge, and its sides where the plate of the row below shows
      // beside it (so the rim is one connected arc, never a dashed course)
      const row = sid >> 6;
      const side = (j: number) => j >= 0 && (SID[j] >> 6) > row;
      const edge = below !== sid || (x > 0 && side(i0 - 1)) || (x + 1 < W && side(i0 + 1));
      // the underside: stone3 → stone1, stone2 → stone1, stone1 → stone0
      const e = k >= 2 ? 1 : 0;
      // the cast shadow right under the plate above's rim: one step down (the overhang reads as depth)
      const under = !edge && y > 0 && SID[i0 - W] >= 0 && (SID[i0 - W] >> 6) < row;
      q.set(x, y, CLOAK_RAMP[edge ? e : under ? Math.max(1, k - 1) : k]);
      CR[i0] = edge ? 1 : 0;
    }
  // the welds: a re-seated plate shows a fire2 lip on a course crease — at most 6 px a frame
  let anyWeld = false;
  for (const p of plates) if (state(p.id) === 'weld') anyWeld = true;
  if (anyWeld)
  for (let y = Math.max(0, by0); y <= by1 && welds.length < 12; y++)
    for (let x = Math.max(0, bx0); x <= bx1 && welds.length < 12; x++) {
      const id = OWN[y * W + x];
      if (id < 0 || !CR[y * W + x] || state(id) !== 'weld') continue;
      if (Math.abs(x + 0.5 - TIPX[id]) < 1.6 && (welds.length === 0 || hash(x, y, 77) < 0.6)) welds.push(x, y);
    }
  if ((o.spars ?? 0) > 0) sailSpars(q, s, wing, light, NR, Lv, o.spars!, o.far);
  // the hem: ONE lip per column — the lowest cloak pixel with open air below
  for (let x = Math.max(0, bx0); x <= bx1; x++)
    for (let y = Math.min(H - 2, by1 + 1); y >= Math.max(0, by0); y--) {
      const id = OWN[y * W + x];
      if (id < 0) continue;
      if (OWN[(y + 1) * W + x] < 0 && PLATES[id].row === NROW - 1) hem.push(x, y);
      break;
    }
  if (bx1 >= 0) despeckle(q, 1, { x0: Math.max(0, bx0 - 2), y0: Math.max(0, by0 - 2), x1: Math.min(W - 1, bx1 + 2), y1: Math.min(H - 1, by1 + 2) });
  return { layer: q, hem, welds, shape: s, own: OWN.slice() };
}

/** the spar roots / tips of the burst's sail (u across the hem) */
const SPAR_U: readonly number[] = [0.06, 0.36, 0.66, 0.95];

/**
 * The summon's burst (§4.7 f7, critic r2 #7): the sail is a WING — four finger bones run as stone3-edged
 * spars from the wrist through the sail to its trailing edge and past it into hooked tips; the trailing
 * edge between the fingertips is scalloped (2–3 px notches); 4–6 loose 2×2 plates fly off beyond it.
 */
function sailSpars(q: PixelCanvas, s: CloakShape, wing: WingId, light: Light, NR: number, Lv: number, k: number, far: boolean) {
  // the scallops: erase the sail between neighbouring fingertips, deepest half way (3 px), in field space
  // (critic r3 #6) a RAGGED, asymmetric trailing edge: each span its own depth, the notch leaning toward
  // the back finger, torn teeth along it — a burst wing, never an evenly scalloped umbrella
  const AMP = wing === 'N' ? [3.4, 4.6, 2.4] : [2.6, 3.8, 4.4];
  const depth = (u: number): number => {
    const tooth = (hash(Math.floor(u * 34), 87, wing === 'N' ? 1 : 2) - 0.5) * 2.4;
    for (let i = 0; i + 1 < SPAR_U.length; i++) {
      const a = SPAR_U[i];
      const b = SPAR_U[i + 1];
      if (u >= a && u <= b) {
        const t = (u - a) / (b - a);
        return Math.max(0, (Math.sin(Math.PI * Math.pow(t, 0.62)) * AMP[i] + tooth) * k);
      }
    }
    return Math.max(0, (1.5 + tooth * 0.5) * k);
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (OWN[i] < 0) continue;
      const v = (RID[i] + 0.5) / NR;
      if (v * Lv > Lv - depth((CJ[i] + 0.5) / NU_CELLS)) {
        q.erase(x, y);
        OWN[i] = -1;
      }
    }
  const wrist = patchAt(s, 0.5, 0.02);
  const lit = far ? PAL.stone2 : PAL.stone3;
  const dark = far ? PAL.stone0 : PAL.stone1;
  const line = (a: V, b: V, col: number, under: number) => {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 1.5);
    for (let j = 0; j <= n; j++) {
      const p = lerpV(a, b, j / n);
      const x = Math.floor(p[0]);
      const y = Math.floor(p[1]);
      if (x < 0 || y < 0 || x >= W || y + 1 >= H) continue;
      q.set(x, y, col);
      if (!q.isOpaque(x, y + 1) || q.get(x, y + 1) !== col) q.set(x, y + 1, under);
    }
  };
  for (const [i, u] of SPAR_U.entries()) {
    const tip = patchAt(s, u, 1.02);
    const mid = add(patchAt(s, u, 0.5), [0, -1]);
    // past the trailing edge: a 3-px claw hooking back toward the sail's root side
    const out = add(tip, mul(norm(sub(tip, mid)), 2.5));
    const hook = add(out, [wing === 'N' ? -1.5 : 1.5, -1]);
    line(wrist, mid, lit, dark);
    line(mid, tip, lit, dark);
    line(tip, out, i === 0 || i === 3 ? lit : PAL.stone2, dark);
    line(out, hook, PAL.stone2, dark);
  }
  // loose plates torn off the edge (critic r3 #6): flung on DIVERGING ballistic arcs, three sizes (1×2,
  // 2×2, 2×3), two turned variants, a 1-px lit edge, each its own distance — debris, never a dotted grid
  const n = Math.round(3 + 4 * k);
  const hiC = far ? PAL.stone2 : PAL.stone3;
  const body = far ? PAL.stone1 : PAL.stone2;
  const loC = far ? PAL.stone0 : PAL.stone1;
  const sd = wing === 'N' ? 1 : 2;
  for (let j = 0; j < n; j++) {
    const u = 0.06 + 0.88 * hash(j, 81, sd);
    const p0 = patchAt(s, u, 1);
    const d0 = norm(sub(p0, wrist));
    const a = (hash(j, 82, sd) - 0.5) * 0.9;
    const dir: V = [d0[0] * Math.cos(a) - d0[1] * Math.sin(a), d0[0] * Math.sin(a) + d0[1] * Math.cos(a)];
    const t = 0.25 + 0.75 * hash(j, 84, sd);
    const at = add(p0, add(mul(dir, (4 + 11 * t) * k), [0, 8 * t * t * k]));
    const [w0, h0] = j % 3 === 0 ? [1, 2] : j % 3 === 1 ? [2, 2] : [2, 3];
    const turned = hash(j, 85, sd) < 0.5;
    const x0 = Math.max(2, Math.min(W - 5, Math.round(at[0])));
    const y0 = Math.max(2, Math.min(H - 8, Math.round(at[1])));
    for (let dy = 0; dy < h0; dy++)
      for (let dx = 0; dx < w0; dx++) {
        // the turned variant leans: its lower rows shift one px toward the back
        const x = x0 + dx - (turned && dy >= 2 ? 1 : 0);
        const y = y0 + dy;
        const litEdge = dy === 0 || (light.side < 0 ? dx === 0 && !turned : dx === w0 - 1 && !turned);
        q.set(x, y, dy === h0 - 1 && h0 > 1 && !litEdge ? loC : litEdge ? hiC : body);
      }
  }
}

/** Light the wrist peak's top edge: a 1-px stone3 line on the light side of the peak (§1.3). */
export function peakEdge(q: PixelCanvas, s: CloakShape, wing: WingId, light: Light, far: boolean) {
  const wrist = wing === 'N' ? s.front[0] : s.back[0];
  const hits: number[] = [];
  for (let y = Math.floor(wrist[1]) - 4; y <= Math.floor(wrist[1]) + 9; y++)
    for (let x = Math.floor(wrist[0]) - 12; x <= Math.floor(wrist[0]) + 6; x++) {
      if (!q.isOpaque(x, y) || q.isOpaque(x, y - 1)) continue;
      const dx = x + 0.5 - wrist[0];
      // the slope that faces the light (P1: the back slope, left of the peak) and the peak itself
      if (Math.abs(dx) < 1.5 || Math.sign(dx) === light.side) hits.push(x, y);
    }
  const c = far ? PAL.stone2 : PAL.stone3;
  // two rows thick on the staircase of the slope, so the lit edge reads as one line, never as dots (IŞ-10)
  for (let i = 0; i < hits.length; i += 2) {
    q.set(hits[i], hits[i + 1], c);
    if (q.isOpaque(hits[i], hits[i + 1] + 1)) q.set(hits[i], hits[i + 1] + 1, far ? PAL.stone2 : PAL.stone3);
  }
}

/** The bony wrist spur: a 3 px wide claw, 5–6 px tall, leaning back, a void2 tip (drawn over the plates). */
export function spurPts(s: CloakShape, wing: WingId, lean: number): { base: V; tip: V } {
  const wrist = wing === 'N' ? s.front[0] : s.back[0];
  const base: V = add(wrist, [0, 1]);
  const tip: V = add(wrist, [-2.6 - lean, -4.4]);
  return { base, tip };
}
export const __dbg = { SID, FV, FU };
