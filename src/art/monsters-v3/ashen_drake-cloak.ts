// Kül Ejderi (ashen_drake) v3 — the cloak: two plate fields (docs/v3/kart-a/ashen_drake.md §1.2, §1.3, §3.1).
//
// Each wing is a hooded cloak hanging from its wrist peak: a Coons patch between four boundary
// curves (back edge, front edge = the arm, the short top edge at the peak, the hem), cut into 8 rows
// of shingled plates (1·2·2·3·3·3·4·4 = 22 per wing, 44 in all). Rows overlap downward like roof
// tiles (the hem row is drawn first, every upper row lies over the one below); a plate is two flat
// tones (an upper band facing up, a lower band) with its tip row one step darker (the IŞ-5 crease).
// The plate's normal follows the hood's curvature, so the ONE key light tones it: P2's relight is
// the same geometry lit from the right (the opaque mask never depends on the light).
//   - shape keys per wing (FOLD hood, OPEN spread, MANTLE canopy, COCOON wrap) blended by the pose;
//   - plate states by the shared accretion order ASHEN_ORDER (summon build, attack tear-off / regrowth);
//   - the bare wing struts (arm + 3 fingers) under the plates, the bony wrist spur over them;
//   - the ripple (one row 1 px down), the hem flakes (2×2 chips that peel off and re-seat).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { add, despeckle, fillPoly, lerpV, mul, n3, sub, len, norm, type Light, type V, type Workspace } from '../rigkit';
import { CLOAK_RAMP, M, W, H, cloakTone, hash } from './ashen_drake-gbuf';

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
export const SHAPES: Readonly<Record<WingId, Readonly<Record<'fold' | 'open' | 'mantle' | 'cocoon', CloakShape>>>> = {
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
      [[52, 22], [58, 22], [70, 30], [80, 44], [86, 62]],
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
      [[44, 20], [52, 20], [62, 28], [72, 42], [78, 58]],
      [[50, 18], [60, 22], [72, 30], [82, 44], [88, 60]],
      [47, 18],
      [83, 60],
    ),
    cocoon: S(
      [[42, 18], [34, 27], [30, 44], [30, 62], [32, 80]],
      [[46, 20], [52, 30], [56, 46], [56, 62], [52, 80]],
      [44, 18],
      [42, 82],
    ),
  },
};

export interface WingPose {
  /** wrist peak offset from its key position (px) */
  wrist: [number, number];
  open: number;
  mantle: number;
  cocoon: number;
  /** the plate row offset 1 px down this frame (−1 none) */
  ripple: number;
}

const blendV = (k: Record<'fold' | 'open' | 'mantle' | 'cocoon', V>, w: WingPose): V => {
  const f = k.fold;
  return [
    f[0] + (k.open[0] - f[0]) * w.open + (k.mantle[0] - f[0]) * w.mantle + (k.cocoon[0] - f[0]) * w.cocoon,
    f[1] + (k.open[1] - f[1]) * w.open + (k.mantle[1] - f[1]) * w.mantle + (k.cocoon[1] - f[1]) * w.cocoon,
  ];
};

/** The blended, posed shape: `off` moves the whole cloak, the wrist moves the top (fading to the hem). */
export function cloakShape(wing: WingId, w: WingPose, off: V): CloakShape {
  const K = SHAPES[wing];
  const pick = (get: (s: CloakShape) => V): V => blendV({ fold: get(K.fold), open: get(K.open), mantle: get(K.mantle), cocoon: get(K.cocoon) }, w);
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
  const ny = -0.85 + 1.15 * v - 0.4 * w.open + 0.5 * w.mantle;
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
const TT = new Float32Array(W * H);
const TIPX = new Float32Array(64);

/**
 * Draw one cloak into a pooled layer. `state(id)` says whether each plate is seated, welded this
 * frame or gone (torn off / not yet built). The struts are drawn first (bare bones), the plates over
 * them hem row first, then the spur.
 */
export function drawCloak(ws: Workspace, light: Light, wing: WingId, w: WingPose, off: V, state: (id: number) => PlateState, o: { far: boolean; struts: boolean }): CloakDraw {
  const s = cloakShape(wing, w, off);
  const q = ws.canvas();
  const hem: number[] = [];
  const welds: number[] = [];
  OWN.fill(-1);
  const plates = PLATES.filter((p) => p.wing === wing);
  const shift = o.far ? 1 : 0;

  // ---- the bare struts: the arm (shoulder → wrist) and three finger bones fanning down from the wrist
  if (o.struts) {
    const r = ws.raster();
    const wrist = s.front[0];
    const arm = [s.front[2], s.front[1], wrist];
    r.tube(arm, 3.4, 2.4, o.far ? M.FAR : M.BONE, { z: 2, flat: 1.4 });
    for (const [u, v, wd] of [[0.12, 0.92, 2.4], [0.42, 0.98, 2.2], [0.74, 0.86, 2]] as const) {
      const a = patchAt(s, u * 0.5 + 0.5 * 1, 0.08);
      const mid = patchAt(s, u, v * 0.5);
      const end = patchAt(s, u, v);
      r.tube([lerpV(wrist, a, 0.2), mid, end], wd, wd - 1, o.far ? M.FAR : M.BONE, { z: 1, flat: 1.4 });
    }
    const c = ws.render(r);
    q.blit(c, 0, 0);
  }

  // ---- plates: placed hem row first, each upper row over the one below (OWN / TT: owner, height
  //      fraction), then toned in a second pass so a plate's seams see its final neighbours
  const L = light;
  const tone: [number, number, number][] = [];
  for (let r = NROW - 1; r >= 0; r--) {
    for (const p of plates.filter((pp) => pp.row === r)) {
      const st = state(p.id);
      if (st === 'gone') continue;
      const { poly, top, tip } = platePoly(s, p, w.ripple);
      const axis = sub(tip, top);
      const a2 = axis[0] * axis[0] + axis[1] * axis[1] || 1;
      const um = (p.u0 + p.u1) / 2;
      const vm = (ROWS[p.row] + ROWS[p.row + 1]) / 2;
      const n = hoodNormal(wing, um, vm, w);
      // two flat bands: the upper one faces up (lighter), the lower one hangs
      const jit = hash(p.id, 3) < 0.28 ? -1 : 0;
      const kUp = cloakTone(L, n3(n[0], n[1] - 0.55, n[2]), 0.05 * hash(p.id, 4));
      const kLo = cloakTone(L, n3(n[0], n[1] + 0.25, n[2]), -0.02);
      // the far cloak is a step darker except its outer (back) face, which still turns to the light
      const sh = shift && (L.side < 0 ? um > 0.45 : um < 0.55) ? shift : 0;
      let up = Math.max(0, kUp - (p.row < 3 ? 0 : sh) + jit);
      let lo = Math.max(0, Math.min(kLo, up) - sh + jit);
      if (up > 2 && !(p.row <= 1 && wing === 'N')) up = 2; // stone3 only on the near wrist's own plates
      if (lo === up && up > 0) lo = up - 1;
      tone[p.id] = [up, lo, 0.3 + 0.14 * hash(p.id, 6)];
      TIPX[p.id] = tip[0];
      fillPoly(poly, (x, y) => {
        if (x < 0 || y < 0 || x >= W || y >= H) return;
        OWN[y * W + x] = p.id;
        TT[y * W + x] = ((x + 0.5 - top[0]) * axis[0] + (y + 0.5 - top[1]) * axis[1]) / a2;
      });
    }
  }
  const sx = -L.side; // a plate's shadow-side neighbour (P1: +x)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const id = OWN[y * W + x];
      if (id < 0) continue;
      const [up, lo, band] = tone[id];
      const t = TT[y * W + x];
      const below = y + 1 < H ? OWN[(y + 1) * W + x] : -1;
      const isTip = below !== id;
      const nb = x + sx >= 0 && x + sx < W ? OWN[y * W + x + sx] : -1;
      const isSide = nb >= 0 && nb !== id && PLATES[nb].row === PLATES[id].row && t > 0.15;
      let k = t < band ? up : lo;
      if (isTip || isSide) k = Math.max(0, lo - 1);
      q.set(x, y, CLOAK_RAMP[k]);
      if (isTip && state(id) === 'weld' && Math.abs(x + 0.5 - TIPX[id]) < 1.6) welds.push(x, y);
    }
  // the hem: tip pixels of the hem row plates with open air (or another part) below
  for (let y = 0; y < H - 1; y++)
    for (let x = 0; x < W; x++) {
      const id = OWN[y * W + x];
      if (id < 0 || OWN[(y + 1) * W + x] >= 0) continue;
      const p = PLATES[id];
      if (p.row >= NROW - 2) hem.push(x, y);
    }
  despeckle(q, 1);
  return { layer: q, hem, welds, shape: s, own: OWN.slice() };
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
  for (let i = 0; i < hits.length; i += 2) q.set(hits[i], hits[i + 1], c);
}

/** The bony wrist spur: a 3 px wide claw, 5–6 px tall, leaning back, a void2 tip (drawn over the plates). */
export function spurPts(s: CloakShape, wing: WingId, lean: number): { base: V; tip: V } {
  const wrist = wing === 'N' ? s.front[0] : s.back[0];
  const base: V = add(wrist, [0, 1]);
  const tip: V = add(wrist, [-3 - lean, -6]);
  return { base, tip };
}
