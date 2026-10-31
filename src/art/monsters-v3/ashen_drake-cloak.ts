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
    fold: S(
      [[50, 24], [42, 30], [36, 44], [34, 60], [35, 80]],
      [[60, 14], [63, 25], [61, 38], [53, 57], [47, 77]],
      [55, 18],
      [40, 83],
    ),
    open: S(
      [[46, 22], [32, 24], [20, 34], [13, 46], [10, 60]],
      [[66, 15], [64, 25], [58, 39], [48, 55], [34, 70]],
      [56, 16],
      [20, 68],
    ),
    mantle: S(
      [[52, 22], [58, 24], [65, 34], [70, 46], [74, 60]],
      [[64, 20], [76, 24], [88, 34], [96, 48], [100, 66]],
      [58, 20],
      [94, 68],
    ),
    cocoon: S(
      [[50, 18], [42, 28], [38, 46], [38, 62], [40, 80]],
      [[64, 20], [70, 30], [72, 46], [70, 62], [64, 82]],
      [57, 17],
      [52, 84],
    ),
    // the summon's burst (§4.7): the near hand thrown forward and UP over the head, its hem a
    // trailing edge from the shoulder to the forward tip, so the skull stays readable under it
    spread: S(
      [[80, 12], [75, 19], [70, 26], [65, 33], [61, 41]],
      [[84, 12], [91, 16], [98, 20], [103, 25], [107, 30]],
      [82, 11],
      [86, 31],
    ),
  },
  F: {
    fold: S(
      [[40, 18], [32, 27], [28, 42], [26, 58], [29, 77]],
      [[47, 25], [48, 33], [47, 46], [44, 62], [40, 78]],
      [43, 21],
      [33, 81],
    ),
    open: S(
      [[36, 19], [22, 22], [12, 31], [7, 42], [6, 56]],
      [[40, 20], [37, 27], [34, 38], [30, 50], [24, 64]],
      [38, 18],
      [12, 62],
    ),
    mantle: S(
      [[52, 17], [56, 21], [63, 29], [72, 42], [78, 58]],
      [[56, 16], [62, 21], [72, 30], [82, 44], [88, 60]],
      [53, 15],
      [83, 60],
    ),
    cocoon: S(
      [[42, 18], [34, 27], [30, 44], [30, 62], [32, 80]],
      [[46, 20], [52, 30], [56, 46], [56, 62], [52, 80]],
      [44, 18],
      [42, 82],
    ),
    // the burst: the far hand thrown BACK, full height
    spread: S(
      [[30, 12], [23, 18], [16, 25], [9, 32], [5, 40]],
      [[34, 13], [38, 20], [42, 27], [45, 35], [48, 43]],
      [32, 11],
      [26, 34],
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
const TH_LIT = 0.1;
const CJ = new Uint8Array(W * H);
const NU_CELLS = 8;
const PLANE = new Uint8Array(32 * 16);
const CR = new Uint8Array(W * H);
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
    const fan = o.fan ?? 1;
    // the far hand fans further back and shorter, so its fingers stay behind / above the near ones
    const farRot = o.far ? 6 : 0;
    for (const [deg, lk, wd, bow, pu, pv] of [[34, 0.86, 2.4, 4.4, 0.08, 0.92], [4, 0.95, 2.2, 4, 0.4, 0.98], [-26, 0.78, 2, 3.4, 0.74, 0.86]] as const) {
      // fan 1: the stripped bat hand; fan 0: the fingers lie inside the cloak's own outline (the
      // summon builds the hand under the plates it is about to carry)
      const fanEnd = add(wrist, mul(rot(dir, deg + farRot), reach * lk * (o.reach ?? 1) * (o.far ? 0.74 : 1)));
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
      r.tube([s0, lerpV(s0, knuckle, 0.5), knuckle], wd, wd - 0.3, M.HIDE + (o.far ? 1 : 0), { z: 1, flat: 1.4 });
      r.tube([knuckle, mid2, end, hook], wd - 0.4, 1, M.HIDE + (o.far ? 1 : 0), { z: 1, flat: 1.4 });
      knuckles.push(knuckle);
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
    // the knuckle blobs: 2×2, lit corner on the light side
    const hi = o.far ? PAL.stone2 : PAL.stone3;
    const mid = o.far ? PAL.stone1 : PAL.stone2;
    for (const kn of knuckles) {
      const x = Math.round(kn[0] - 1);
      const y = Math.round(kn[1] - 1);
      // only on its finger: a knuckle never floats free of the bone it belongs to
      if (!c.isOpaque(x, y) || !c.isOpaque(x + 1, y + 1)) continue;
      const lx = light.side < 0 ? 0 : 1;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) q.set(x + dx, y + dy, dx === lx && dy === 0 ? hi : mid);
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
  // ---- the tone pass (§1.3 plate rule, IŞ-5, MA-2): the plates give the coverage (and their states);
  //      the TEXTURE is shingle courses laid over the whole hood — rows ≈ 3.5 px tall, each with a full-width
  //      crease one step darker at its lower edge, vertical joints staggered like brickwork, the body tone
  //      a large light plane (stone2 lit / stone1 shadow; stone0 only in creases), stone3 lips only on the
  //      top 2 courses of the lit plane and the wrist peak. The rippled plate row samples the field 1 px up
  //      (its tiles drop with it).
  const n = s.back.length - 1;
  let Lv = 0;
  // the courses are laid on the hood WITHOUT its wrist offset (the breath, the sway): the silhouette breathes
  // while the tiles stay put, so the idle varies by its edges, not by a re-mapped texture (HA-21 phase)
  const ts = cloakShape(wing, { ...w, wrist: [0, 0] }, off);
  for (let i = 1; i <= n; i++) Lv += (len(sub(ts.back[i], ts.back[i - 1])) + len(sub(ts.front[i], ts.front[i - 1]))) / 2;
  const NR = Math.max(4, Math.min(24, Math.round(Lv / 3.6)));
  const NU = NU_CELLS;
  RID.fill(-1);
  const GP: V[] = [];
  for (let r = 0; r <= NR + 2; r++) for (let j = 0; j <= NU; j++) GP.push(patchAt(ts, j / NU, r / NR));
  const gp = (r: number, j: number) => GP[r * (NU + 1) + j];
  for (let r = 0; r <= NR + 1; r++)
    for (let j = 0; j < NU; j++)
      fillPoly([gp(r, j), gp(r, j + 1), gp(r + 1, j + 1), gp(r + 1, j)], (x, y) => {
        if (x < 0 || y < 0 || x >= W || y >= H || OWN[y * W + x] < 0) return;
        RID[y * W + x] = r;
        CJ[y * W + x] = j;
      });
  // gaps of the quad raster (and the wrist's lift above the course field): the pixel above / left, then
  // the one below / right, else the plate's own course
  for (let y = by0; y <= by1; y++)
    for (let x = bx0; x <= bx1; x++) {
      const i = y * W + x;
      if (OWN[i] < 0 || RID[i] >= 0) continue;
      const j = y > 0 && RID[i - W] >= 0 ? i - W : x > 0 && RID[i - 1] >= 0 ? i - 1 : -1;
      if (j >= 0) {
        RID[i] = RID[j];
        CJ[i] = CJ[j];
      }
    }
  for (let y = by1; y >= by0; y--)
    for (let x = bx1; x >= bx0; x--) {
      const i = y * W + x;
      if (OWN[i] < 0 || RID[i] >= 0) continue;
      const j = y + 1 < H && RID[i + W] >= 0 ? i + W : x + 1 < W && RID[i + 1] >= 0 ? i + 1 : -1;
      if (j >= 0) {
        RID[i] = RID[j];
        CJ[i] = CJ[j];
      } else {
        const pl = PLATES[OWN[i]];
        RID[i] = Math.round(ROWS[pl.row] * NR);
        CJ[i] = Math.min(NU - 1, Math.floor(((pl.u0 + pl.u1) / 2) * NU));
      }
    }
  const spread = w.spread ?? 0;
  const NB = 3;
  // the light plane: one value per (course, u-cell), read in the light's SCREEN direction only (P1 and the
  // P2 relight split alike); the burst's sail is a lit upper plane over a dark underside
  const NC = (NR + 2) * NU;
  for (let r = 0; r < NR + 2; r++)
    for (let j = 0; j < NU; j++) {
      const u = (j + 0.5) / NU;
      const v = (r + 0.5) / NR;
      const nn = hoodNormal(wing, u, v, w);
      let Ixy = nn[0] * L.v[0] + (nn[1] - 0.2) * L.v[1];
      if (spread > 0.5) Ixy = v < 0.5 ? 1 : -1;
      let k = Ixy >= TH_LIT ? 2 : 1;
      // the far cloak's inner half one step darker (never stone0: that is for creases only)
      if (shift && (L.side < 0 ? u > 0.45 : u < 0.55)) k = 1;
      PLANE[r * NU + j] = k + (Ixy >= TH_LIT + 0.25 && r <= 1 ? 4 : 0);
    }
  void NC;
  const rid = (x: number, y: number): number => (x < 0 || y < 0 || x >= W || y >= H ? -2 : RID[y * W + x]);
  for (let y = by0; y <= by1; y++)
    for (let x = bx0; x <= bx1; x++) {
      const i0 = y * W + x;
      const id = OWN[i0];
      if (id < 0) continue;
      // the rippled row's tiles drop 1 px with their plate (the wave travels hem → wrist)
      const i = PLATES[id].row === w.ripple && y > 0 && RID[i0 - W] >= 0 ? i0 - W : i0;
      const r = RID[i];
      const j = CJ[i];
      const pl = PLANE[Math.min(NR + 1, r) * NU + j];
      let k = pl & 3;
      const below = i === i0 ? rid(x, y + 1) : r === RID[i0] ? RID[i0] : rid(x, y);
      const crease = below === -2 || (below >= 0 && below !== r) || (y + 1 < H && OWN[i0 + W] < 0);
      let joint = false;
      if (!crease && spread <= 0.5 && x > 0) {
        // a joint is a short 1-px tick just above the crease (a tile's side under the one above)
        const b2 = rid(x, y + 2);
        if (b2 >= 0 && b2 !== r && RID[i - 1] === r && CJ[i - 1] !== j) {
          const stag = (r % 2) * 0.5;
          joint = Math.floor(((CJ[i - 1] + 0.5) / NU) * NB + stag) !== Math.floor(((j + 0.5) / NU) * NB + stag);
        }
      }
      if (crease || joint) k -= 1;
      else if (pl >= 4 && k === 2) {
        // a lit lip on the top 2 courses, only as a horizontal run (a 1-px staircase step reads as a dot)
        const top = (xx: number) => {
          if (xx < 0 || xx >= W || OWN[y * W + xx] < 0 || RID[y * W + xx] !== r) return false;
          const a = rid(xx, y - 1);
          return a === -2 || (a >= 0 && a !== r) || OWN[(y - 1) * W + xx] < 0;
        };
        if (top(x) && (top(x - 1) || top(x + 1))) k = 3;
      }
      q.set(x, y, CLOAK_RAMP[Math.max(0, k)]);
      CR[i0] = crease ? 1 : 0;
    }
  // the welds: a re-seated plate shows a fire2 lip on a course crease — at most 6 px a frame
  for (let y = 0; y < H && welds.length < 12; y++)
    for (let x = 0; x < W && welds.length < 12; x++) {
      const id = OWN[y * W + x];
      if (id < 0 || !CR[y * W + x] || state(id) !== 'weld') continue;
      if (Math.abs(x + 0.5 - TIPX[id]) < 1.6 && (welds.length === 0 || hash(x, y, 77) < 0.6)) welds.push(x, y);
    }
  if ((o.spars ?? 0) > 0) sailSpars(q, s, wing, light, NR, Lv, o.spars!, o.far);
  // the hem: ONE lip per column — the lowest cloak pixel with open air below
  for (let x = 0; x < W; x++)
    for (let y = H - 2; y >= 0; y--) {
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
  const depth = (u: number): number => {
    for (let i = 0; i + 1 < SPAR_U.length; i++) {
      const a = SPAR_U[i];
      const b = SPAR_U[i + 1];
      if (u >= a && u <= b) return Math.sin(((u - a) / (b - a)) * Math.PI) * 3 * k;
    }
    return 1.5 * k;
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
  // loose plates torn off the edge, flying out beyond it (2×2, lit corner)
  const n = Math.round(2 + 3 * k);
  for (let j = 0; j < n; j++) {
    const u = 0.12 + (0.78 * (j + 0.5)) / n;
    const p = patchAt(s, u, 1.12 + 0.12 * hash(j, 81, wing === 'N' ? 1 : 2));
    const x = Math.round(p[0] + (hash(j, 82) - 0.5) * 3);
    const y = Math.round(p[1] + 1 + hash(j, 83) * 2);
    const lx = light.side < 0 ? 0 : 1;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) if (x + dx >= 0 && x + dx < W && y + dy >= 0 && y + dy < H) q.set(x + dx, y + dy, dx === lx && dy === 0 ? (far ? PAL.stone2 : PAL.stone3) : far ? PAL.stone1 : PAL.stone2);
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
  const tip: V = add(wrist, [-3.2 - lean, -5.4]);
  return { base, tip };
}
