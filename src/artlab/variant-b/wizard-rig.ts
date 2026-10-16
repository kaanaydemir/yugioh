// Art Lab B — wizard rig: palette, compositing, selective outline, mesh-warped cloth panels, the
// staff and its claw head. Owned by the variant-B wizard; nothing else imports it.
//
// Cloth is a Coons patch: four boundary curves (top, bottom, back side, front side) computed from
// the pose's joints define a smooth warp of the unit square (u: back → front, v: top → hem). Every
// pixel inside knows its (u, v), so the shading bands, the fold wedges, the trims and the motifs
// are attached to the CLOTH and follow it when the body leans, kneels or the hem sways — nothing is
// resampled or scaled. Fold valleys / lit ridges and trims are painted as whole-pixel strokes after
// the banded base (only the automatic base is despeckled; painted details are never touched).
// Rigid parts (hood, face, eyes, pauldrons, hands, buckle, boots, orb) are hand-authored maps
// (wizard-maps.ts) placed at integer offsets.

import { PixelCanvas } from '../../art/pixel';
import { A_INK, A_RAMPS } from '../variant-a/palette';
import { clamp, hash2, lerp, shear, shiftRows } from '../variant-a/wizard-rig';

export { clamp, hash2, lerp, shear, shiftRows };
export type V2 = readonly [number, number];

// ------------------------------------------------------------------ palette (A's warm ramps + locals)

/** Outer cloak, hood, pauldrons, collar: A's warm robe plum. */
export const CL = A_RAMPS.robe;
/** Inner robe: a lighter violet (local) — the layer under the cloak. */
export const VI = [0x241040, 0x3c1a60, 0x5a2b84, 0x7a45a8, 0x9d68c8, 0xc293e2] as const;
/** The long front panel (tabard) and the stole: deep wine (local) under gold trims. */
export const WI = [0x220a1c, 0x40122e, 0x611c40, 0x842c52, 0xa84468] as const;
export const GO = A_RAMPS.gold;
export const BO = A_RAMPS.bone;
export const MG = A_RAMPS.magic;
export const FS = A_RAMPS.faceShadow;
/** Staff: dark heartwood (A's staff ramp). */
export const WO = A_RAMPS.staff;
/** Gloves: dusky mauve leather (local) — reads against both the purple robe and the brown staff. */
export const GL = [0x2c1a30, 0x4c3656, 0x735d86, 0xa08cb0, 0xcabcd8] as const;
/** Belt / boot leather (local). */
export const LE = [0x1c0a14, 0x34161e, 0x522a2a, 0x74443a] as const;
export const INK = A_INK.plum;
export const INK_WARM = A_INK.warm;

// ------------------------------------------------------------------ colour info (outline + seams)

interface CInfo {
  ramp: readonly number[];
  i: number;
  /** Outline colour on the lit side (top / front). */
  lit: number;
  /** Outline colour on the shadow side and on the ground. */
  ink: number;
}
const INFO = new Map<number, CInfo>();
function reg(ramp: readonly number[], lit: number, ink: number): void {
  ramp.forEach((c, i) => {
    if (!INFO.has(c)) INFO.set(c, { ramp, i, lit, ink });
  });
}
reg(CL, CL[1], INK);
reg(VI, VI[1], INK);
reg(WI, WI[1], INK);
reg(GO, GO[1], INK_WARM);
reg(BO, BO[1], INK_WARM);
reg(MG, MG[1], INK);
reg(FS, INK, INK);
reg(WO, WO[1], INK); // plum ink under / behind the shaft: it separates from any wood (the rail)
reg(GL, GL[1], INK);
reg(LE, LE[1], INK);
reg([INK], INK, INK);

/** Step a colour along its ramp (clamped); unknown colours are returned unchanged. */
export function stepColor(c: number, n: number): number {
  const k = INFO.get(c);
  if (!k) return c;
  return k.ramp[clamp(k.i + n, 0, k.ramp.length - 1)];
}
export function rampOf(c: number): readonly number[] | null {
  return INFO.get(c)?.ramp ?? null;
}

// ------------------------------------------------------------------ maps

export interface PixMap {
  rows: readonly string[];
  /** Anchor inside the map (px). */
  ax: number;
  ay: number;
}

export interface StampOpts {
  key?: Readonly<Record<string, number>>;
  /** Only paint where this canvas is opaque. */
  mask?: PixelCanvas;
  /** Mirror horizontally around the anchor column. */
  flip?: boolean;
}

/** Place a map so that its anchor lands on (x, y). '.' leaves a pixel, '_' erases it. */
export function stamp(p: PixelCanvas, m: PixMap, x: number, y: number, key: Readonly<Record<string, number>>, o: StampOpts = {}): void {
  const ox = Math.round(x);
  const oy = Math.round(y);
  for (let j = 0; j < m.rows.length; j++) {
    const row = m.rows[j];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      const px = o.flip ? ox - (i - m.ax) : ox + (i - m.ax);
      const py = oy + (j - m.ay);
      if (ch === '_') {
        p.erase(px, py);
        continue;
      }
      const c = (o.key ?? key)[ch];
      if (c === undefined) continue;
      if (o.mask && !o.mask.isOpaque(px, py)) continue;
      p.set(px, py, c);
    }
  }
}

// ------------------------------------------------------------------ compositing

/**
 * Paint `top` over `base`. Pixels of `base` touching `top` get a contact seam: `shade` steps darker
 * below / behind the covering part (light comes from the upper front = the drawn right).
 */
export function composite(base: PixelCanvas, top: PixelCanvas, shade = 1): void {
  if (shade) {
    const ch: [number, number, number][] = [];
    for (let y = 0; y < base.h; y++)
      for (let x = 0; x < base.w; x++) {
        if (top.isOpaque(x, y)) continue;
        const c = base.get(x, y);
        if (c === null) continue;
        if (top.isOpaque(x, y - 1) || top.isOpaque(x + 1, y)) ch.push([x, y, stepColor(c, -shade)]);
      }
    for (const [x, y, c] of ch) base.set(x, y, c);
  }
  base.blit(top, 0, 0);
}

/**
 * The single exterior outline: ink where the sprite lies above the pixel (bottom edges, ground)
 * and on the back; the colour's softer tinted line on the top / front edges. `rim` may colour an
 * edge pixel instead (the low sun behind the wizard rims its back): it is asked for top edges
 * ('top': the sprite is below the pixel) and back edges ('back': the sprite is right of it).
 */
export function selectiveOutline(
  p: PixelCanvas,
  groundY: number,
  rim?: (x: number, y: number, side: 'top' | 'back', nb: number) => number | null,
): void {
  const add: [number, number, number][] = [];
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      if (p.isOpaque(x, y)) continue;
      const up = p.get(x, y - 1);
      const right = p.get(x + 1, y);
      const down = p.get(x, y + 1);
      const left = p.get(x - 1, y);
      if (up === null && right === null && down === null && left === null) continue;
      let c: number;
      if (up !== null || y >= groundY) c = INFO.get((up ?? right ?? left ?? down)!)?.ink ?? INK;
      else if (right !== null) c = rim?.(x, y, 'back', right) ?? INFO.get(right)?.ink ?? INK;
      else if (down !== null) c = rim?.(x, y, 'top', down) ?? INFO.get(down)?.lit ?? INK;
      else c = INFO.get(left!)?.lit ?? INK;
      add.push([x, y, c]);
    }
  for (const [x, y, c] of add) p.set(x, y, c);
}

// ------------------------------------------------------------------ curves

export type Curve = (t: number) => V2;

export const seg = (a: V2, b: V2): Curve => (t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
export const bez2 = (a: V2, c: V2, b: V2): Curve => (t) => {
  const s = 1 - t;
  return [s * s * a[0] + 2 * s * t * c[0] + t * t * b[0], s * s * a[1] + 2 * s * t * c[1] + t * t * b[1]];
};
export const bez3 = (a: V2, c1: V2, c2: V2, b: V2): Curve => (t) => {
  const s = 1 - t;
  const k0 = s * s * s;
  const k1 = 3 * s * s * t;
  const k2 = 3 * s * t * t;
  const k3 = t * t * t;
  return [k0 * a[0] + k1 * c1[0] + k2 * c2[0] + k3 * b[0], k0 * a[1] + k1 * c1[1] + k2 * c2[1] + k3 * b[1]];
};
/** A polyline, parametrized by arc length. */
export function poly(pts: readonly V2[]): Curve {
  const L: number[] = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const tot = L[L.length - 1] || 1;
  return (t) => {
    const d = clamp(t, 0, 1) * tot;
    let i = 1;
    while (i < L.length - 1 && L[i] < d) i++;
    const k = (d - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
    return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)];
  };
}

/** Catmull-Rom spline through the points (uniform per segment), as a curve over t in [0, 1]. */
export function spline(pts: readonly V2[]): Curve {
  const n = pts.length - 1;
  const P = (i: number) => pts[clamp(i, 0, n)];
  return (t) => {
    const f = clamp(t, 0, 1) * n;
    const i = Math.min(n - 1, Math.floor(f));
    const s = f - i;
    const p0 = P(i - 1);
    const p1 = P(i);
    const p2 = P(i + 1);
    const p3 = P(i + 2);
    const s2 = s * s;
    const s3 = s2 * s;
    const c = (a: number, b: number, c2: number, d: number) => 0.5 * (2 * b + (-a + c2) * s + (2 * a - 5 * b + 4 * c2 - d) * s2 + (-a + 3 * b - 3 * c2 + d) * s3);
    return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])];
  };
}

/**
 * Coons patch through four boundary curves: top(u) and bottom(u) run back → front, back(v) and
 * front(v) run top → bottom; their end points must meet at the corners.
 */
export function coons(top: Curve, bottom: Curve, back: Curve, front: Curve): (u: number, v: number) => V2 {
  const p00 = top(0);
  const p10 = top(1);
  const p01 = bottom(0);
  const p11 = bottom(1);
  return (u, v) => {
    const a = top(u);
    const b = bottom(u);
    const c = back(v);
    const d = front(v);
    const x = (1 - v) * a[0] + v * b[0] + (1 - u) * c[0] + u * d[0] - ((1 - u) * (1 - v) * p00[0] + u * (1 - v) * p10[0] + (1 - u) * v * p01[0] + u * v * p11[0]);
    const y = (1 - v) * a[1] + v * b[1] + (1 - u) * c[1] + u * d[1] - ((1 - u) * (1 - v) * p00[1] + u * (1 - v) * p10[1] + (1 - u) * v * p01[1] + u * v * p11[1]);
    return [x, y];
  };
}

// ------------------------------------------------------------------ cloth panels

const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;

/** Inverse bilinear map of p in the quad a b c d (a→b = +s, a→d = +t); null when outside. */
function invBilinear(px: number, py: number, a: V2, b: V2, c: V2, d: V2): [number, number] | null {
  const ex = b[0] - a[0];
  const ey = b[1] - a[1];
  const fx = d[0] - a[0];
  const fy = d[1] - a[1];
  const gx = a[0] - b[0] + c[0] - d[0];
  const gy = a[1] - b[1] + c[1] - d[1];
  const hx = px - a[0];
  const hy = py - a[1];
  const k2 = cross(gx, gy, fx, fy);
  const k1 = cross(ex, ey, fx, fy) + cross(hx, hy, gx, gy);
  const k0 = cross(hx, hy, ex, ey);
  const solveS = (t: number) => {
    const dx = ex + gx * t;
    const dy = ey + gy * t;
    return Math.abs(dx) > Math.abs(dy) ? (hx - fx * t) / dx : (hy - fy * t) / dy;
  };
  const E = 1e-4;
  const ok = (s: number, t: number) => s >= -E && s <= 1 + E && t >= -E && t <= 1 + E;
  if (Math.abs(k2) < 1e-7) {
    if (Math.abs(k1) < 1e-9) return null;
    const t = -k0 / k1;
    const s = solveS(t);
    return ok(s, t) ? [s, t] : null;
  }
  let w = k1 * k1 - 4 * k0 * k2;
  if (w < 0) return null;
  w = Math.sqrt(w);
  const ik2 = 0.5 / k2;
  let t = (-k1 - w) * ik2;
  let s = solveS(t);
  if (ok(s, t)) return [s, t];
  t = (-k1 + w) * ik2;
  s = solveS(t);
  return ok(s, t) ? [s, t] : null;
}

/**
 * One cloth panel: the warp f(u, v) rasterized at pixel centres into a tone map (indices into
 * `ramp`) with per-pixel (u, v). Details are painted onto the canvas after toCanvas().
 */
export class Cloth {
  readonly w: number;
  readonly h: number;
  readonly tone: Int8Array;
  readonly U: Float32Array;
  readonly V: Float32Array;
  constructor(
    w: number,
    h: number,
    readonly f: (u: number, v: number) => V2,
    readonly ramp: readonly number[],
    nu = 14,
    nv = 18,
  ) {
    this.w = w;
    this.h = h;
    this.tone = new Int8Array(w * h).fill(-1);
    this.U = new Float32Array(w * h);
    this.V = new Float32Array(w * h);
    const G: V2[][] = [];
    for (let j = 0; j <= nv; j++) {
      const row: V2[] = [];
      for (let i = 0; i <= nu; i++) row.push(f(i / nu, j / nv));
      G.push(row);
    }
    for (let j = 0; j < nv; j++)
      for (let i = 0; i < nu; i++) {
        const a = G[j][i];
        const b = G[j][i + 1];
        const c = G[j + 1][i + 1];
        const d = G[j + 1][i];
        const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0], d[0])));
        const x1 = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0], c[0], d[0])));
        const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1], d[1])));
        const y1 = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1], c[1], d[1])));
        for (let y = y0; y <= y1; y++)
          for (let x = x0; x <= x1; x++) {
            const k = y * w + x;
            if (this.tone[k] >= 0) continue;
            const st = invBilinear(x + 0.5, y + 0.5, a, b, c, d);
            if (!st) continue;
            this.tone[k] = 0;
            this.U[k] = clamp((i + st[0]) / nu, 0, 1);
            this.V[k] = clamp((j + st[1]) / nv, 0, 1);
          }
      }
  }
  has(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.tone[y * this.w + x] >= 0;
  }
  u(x: number, y: number): number {
    return this.U[y * this.w + x];
  }
  v(x: number, y: number): number {
    return this.V[y * this.w + x];
  }
  get(x: number, y: number): number {
    return this.has(x, y) ? this.tone[y * this.w + x] : -1;
  }
  put(x: number, y: number, t: number): void {
    if (this.has(x, y)) this.tone[y * this.w + x] = clamp(t, 0, this.ramp.length - 1);
  }
  /** Base tones from a shading function of (u, v, x, y). */
  shade(fn: (u: number, v: number, x: number, y: number) => number): this {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const k = y * this.w + x;
        if (this.tone[k] < 0) continue;
        this.tone[k] = clamp(Math.round(fn(this.U[k], this.V[k], x, y)), 0, this.ramp.length - 1);
      }
    return this;
  }
  /** Lonely pixels (no 4-neighbour of the same tone, ≥3 neighbours of one other tone) adopt it. */
  despeckle(): this {
    const src = this.tone.slice();
    const w = this.w;
    for (let y = 1; y < this.h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const t = src[i];
        if (t < 0) continue;
        const n = [src[i - 1], src[i + 1], src[i - w], src[i + w]].filter((v) => v >= 0);
        if (n.length < 3 || n.includes(t)) continue;
        const counts = new Map<number, number>();
        for (const v of n) counts.set(v, (counts.get(v) ?? 0) + 1);
        let best = t;
        let bc = 0;
        for (const [v, c] of counts) if (c > bc) [best, bc] = [v, c];
        this.tone[i] = best;
      }
    return this;
  }
  /** Pixels of a (u, v) segment, mapped through the warp: a connected whole-pixel path. */
  path(u0: number, v0: number, u1: number, v1: number): [number, number, number][] {
    const a = this.f(u0, v0);
    const b = this.f(u1, v1);
    const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 3));
    const out: [number, number, number][] = [];
    let last = '';
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const p = this.f(lerp(u0, u1, k), lerp(v0, v1, k));
      const x = Math.floor(p[0]);
      const y = Math.floor(p[1]);
      const key = `${x},${y}`;
      if (key === last) continue;
      last = key;
      // keep it 8-connected without double steps: drop an L corner (both neighbours present)
      if (out.length >= 2) {
        const [px, py] = out[out.length - 2];
        if (Math.abs(px - x) <= 1 && Math.abs(py - y) <= 1) out.pop();
      }
      out.push([x, y, k]);
    }
    return out;
  }
  toCanvas(): PixelCanvas {
    const p = new PixelCanvas(this.w, this.h);
    for (let i = 0; i < this.w * this.h; i++) if (this.tone[i] >= 0) p.set(i % this.w, Math.floor(i / this.w), this.ramp[this.tone[i]]);
    return p;
  }
  /** Edge pixels of the panel on one side: a 4-neighbour outside, in the given (u, v) region. */
  edge(x: number, y: number, side: 'up' | 'down' | 'left' | 'right'): boolean {
    if (!this.has(x, y)) return false;
    if (side === 'up') return !this.has(x, y - 1);
    if (side === 'down') return !this.has(x, y + 1);
    if (side === 'left') return !this.has(x - 1, y);
    return !this.has(x + 1, y);
  }
}

/**
 * A fold: a valley from (u0, v0) to (u1, v1). On its lit side (toward the light = +x for a
 * hanging fold) a ridge of `ridge` px steps up by `hi`; the valley itself drops to `deep` (or one
 * below the base); on the shadow side a wedge `w` px wide at the hem steps one down.
 */
export interface Fold {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  w: number;
  ridge: number;
  hi?: number;
  /** The valley's tone (absolute index) where k > 0.2; default: base − 1. */
  deep?: number;
  /** The fold fades in over this part of its length (0..1). */
  fade?: number;
}

/** Paint folds into a cloth's tone map: wedges, then ridges, then valleys. lit: +1 (ridge left of the valley), −1 (right). */
export function paintFolds(cl: Cloth, folds: readonly Fold[], lit: 1 | -1 = 1): void {
  const base = cl.tone.slice();
  const B = (x: number, y: number) => (cl.has(x, y) ? base[y * cl.w + x] : -1);
  const paths = folds.map((f) => ({ f, pts: cl.path(f.u0, f.v0, f.u1, f.v1) }));
  for (const { f, pts } of paths)
    for (const [x, y, k] of pts) {
      const ww = Math.round(f.w * Math.pow(k, 0.8));
      for (let i = 1; i <= ww; i++) if (B(x + lit * i, y) >= 0) cl.put(x + lit * i, y, B(x + lit * i, y) - 1);
    }
  for (const { f, pts } of paths)
    for (const [x, y, k] of pts) {
      if (k < (f.fade ?? 0.12)) continue;
      const rw = k < 0.4 ? 1 : f.ridge;
      for (let i = 1; i <= rw; i++) if (B(x - lit * i, y) >= 0) cl.put(x - lit * i, y, B(x - lit * i, y) + (f.hi ?? 1));
    }
  for (const { f, pts } of paths)
    for (const [x, y, k] of pts) {
      const b0 = B(x, y);
      if (b0 < 0) continue;
      cl.put(x, y, f.deep !== undefined && k > 0.2 ? Math.min(f.deep, b0 - 1) : b0 - 1);
    }
}

// ------------------------------------------------------------------ staff + claw head

export function staffDir(deg: number): V2 {
  const a = (deg * Math.PI) / 180;
  return [Math.sin(a), -Math.cos(a)];
}
export const degOf = (d: V2) => (Math.atan2(d[0], -d[1]) * 180) / Math.PI;

/**
 * The staff: a 2-px dark heartwood shaft (shadow edge + lit edge; the lit edge faces up / front),
 * gold bands under the head and a gold-shod foot, from `foot` to `top` (the claw's cup).
 */
export function drawStaff(p: PixelCanvas, foot: V2, top: V2, bands: readonly number[] = [3, 6, 30]): void {
  const len = Math.hypot(top[0] - foot[0], top[1] - foot[1]) || 1;
  const d: V2 = [(top[0] - foot[0]) / len, (top[1] - foot[1]) / len];
  const steep = Math.abs(d[1]) >= Math.abs(d[0]);
  const n = Math.max(1, Math.ceil(len * 2));
  const seen = new Set<number>();
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const x = Math.round(lerp(top[0], foot[0], t));
    const y = Math.round(lerp(top[1], foot[1], t));
    const key = y * 4096 + x;
    if (seen.has(key)) continue;
    seen.add(key);
    const along = t * len; // from the top
    let dark: number = WO[1];
    let light: number = WO[2];
    if (along > len - 2.5) {
      dark = GO[1];
      light = GO[2];
    } else if (bands.some((r) => Math.abs(along - r) < 0.75)) {
      dark = GO[2];
      light = GO[3];
    } else if (along < 9) {
      dark = WO[1];
      light = WO[3];
    }
    if (steep) {
      // lit edge on the front (right) side
      p.set(x, y, dark);
      p.set(x + 1, y, light);
    } else {
      p.set(x, y, dark);
      p.set(x, y - 1, light);
    }
  }
}

/**
 * The ornate gold claw holding the orb: a collar on the shaft, a cup, and two side talons that rise
 * around the orb from the cup and hook in over its shoulders (2 px thick at the root, bright tips),
 * plus a short back spur. Drawn behind the orb; the front talon (drawClawFront) goes over it.
 * Works at any staff angle (dir = foot → top).
 */
export function drawClaw(p: PixelCanvas, ox: number, oy: number, r: number, dir: V2): void {
  const back = Math.atan2(-dir[1], -dir[0]); // from the orb centre toward the staff
  const rr = r + 1.3;
  const lit = (ang: number) => Math.cos(ang) * 0.8 - Math.sin(ang) > 0.25; // facing the upper front
  for (const side of [-1, 1]) {
    for (let a = 0.15; a <= 2.2; a += 0.035) {
      const ang = back + side * a;
      const rad = rr + (a > 1.75 ? -(a - 1.75) * 1.6 : 0); // the tips hook inward
      const x = Math.round(ox + Math.cos(ang) * rad);
      const y = Math.round(oy + Math.sin(ang) * rad);
      p.set(x, y, a > 2.0 ? GO[4] : lit(ang) ? GO[3] : GO[1]);
      if (a < 1.2) {
        const r2 = rr + 1;
        p.set(Math.round(ox + Math.cos(ang) * r2), Math.round(oy + Math.sin(ang) * r2), lit(ang) ? GO[2] : GO[0]);
      }
    }
  }
  // cup + collar on the shaft
  const cx = ox + Math.cos(back) * (rr + 1.2);
  const cy = oy + Math.sin(back) * (rr + 1.2);
  const nx = -Math.sin(back);
  const ny = Math.cos(back);
  for (let k = -2; k <= 2; k++) {
    const x = Math.round(cx + nx * k);
    const y = Math.round(cy + ny * k);
    p.set(x, y, Math.abs(k) === 2 ? GO[1] : k * (nx - ny) > 0 ? GO[3] : GO[2]);
  }
  for (let k = -1; k <= 1; k++) {
    const x = Math.round(cx + Math.cos(back) * 1.6 + nx * k);
    const y = Math.round(cy + Math.sin(back) * 1.6 + ny * k);
    p.set(x, y, k === 0 ? GO[2] : GO[1]);
  }
}

/** The front talon over the orb's face, from the cup toward the centre. */
export function drawClawFront(p: PixelCanvas, ox: number, oy: number, r: number, dir: V2): void {
  const n = Math.max(2, Math.round(r * 0.55));
  for (let i = 0; i <= n; i++) {
    const k = r + 1 - i;
    const x = Math.round(ox - dir[0] * k);
    const y = Math.round(oy - dir[1] * k);
    p.set(x, y, i === n ? GO[4] : i === 0 ? GO[2] : GO[3]);
  }
}

// ------------------------------------------------------------------ tube folds

/**
 * A fold valley as a line in (u, v): from u0 at v0 (where the fold is born, under a belt or a
 * shoulder) to u1 at the hem (v 1). The cloth between two valleys is a tube: lit on its front
 * (right) side, in shadow on its back side, with the valley itself a dark crease.
 */
export interface Valley {
  u0: number;
  v0: number;
  u1: number;
  /** Crease depth below the tube's base tone (default 2). */
  deep?: number;
  /** foldTone: width (px) of the fold's light plane at the hem (default 3). */
  plane?: number;
}

const valleyU = (va: Valley, v: number) => va.u0 + (va.u1 - va.u0) * clamp((v - va.v0) / Math.max(1e-3, 1 - va.v0), 0, 1);

/**
 * Tube-fold shading for one cloth pixel. `base(u)` is the cloth's global light (continuous tone);
 * each tube between two creases takes ONE flat tone (base sampled at its centre), the crease pixel
 * is one step darker (`deep`), and the tube's front lip — the pixel(s) just behind the next crease,
 * where the fold turns toward the light — one step lighter. Few, wide, flat clusters: no stripes.
 * Above a valley's birth row it is not there (the cloth is smooth under the belt); the lip appears
 * a little below the birth. `pxPerU` is the panel's width in px at this row.
 */
export function tubeTone(u: number, v: number, valleys: readonly Valley[], base: (u: number) => number, pxPerU: number, lip = 1): number {
  const live = valleys.filter((va) => v >= va.v0).map((va) => ({ u: valleyU(va, v), v0: va.v0, deep: va.deep ?? 1 })).sort((a, b) => a.u - b.u);
  let lo = 0;
  let hi: { u: number; v0: number; deep: number } | null = null;
  let crease: { u: number; deep: number } | null = null;
  for (const va of live) {
    if (Math.abs(u - va.u) * pxPerU < 0.5) crease = va;
    if (va.u <= u) lo = va.u;
    else {
      hi = va;
      break;
    }
  }
  const b = Math.round(base((lo + (hi ? hi.u : 1)) / 2));
  if (crease) return b - crease.deep;
  if (hi && v > hi.v0 + 0.1 && (hi.u - u) * pxPerU < 0.5 + lip) return b + 1;
  return b;
}

/**
 * Major-fold shading — few, wide folds instead of tubes of hatching. Each fold is a crease line in
 * (u, v) from u0 at its birth row v0 to u1 at the hem. Just in front of the crease (the wall turned
 * toward the light from the front) lies a light plane one tone up, ~2 px wide where the fold is born
 * (folds bunch under the belt / the arm) and `plane` px at the hem (they flare); the crease itself
 * is a 1-px line `deep` tones down, and on the lower half of the fold one shadow pixel behind it
 * opens the valley toward the hem. Away from the folds the cloth takes `base(u, v)`, which should
 * only change in broad bands. `pxPerU` is the panel's width in px at this row.
 */
export function foldTone(u: number, v: number, folds: readonly Valley[], base: (u: number, v: number) => number, pxPerU: number): number {
  let out = Math.round(base(u, v));
  let lit = false;
  for (const f of folds) {
    if (v < f.v0) continue;
    const k = clamp((v - f.v0) / Math.max(1e-3, 1 - f.v0), 0, 1);
    const uc = f.u0 + (f.u1 - f.u0) * k;
    const d = (uc - u) * pxPerU; // > 0: in front of the crease (toward −u … the plane side)
    const bc = Math.round(base(uc - 1 / pxPerU, v));
    if (Math.abs(d) < 0.5) return bc - (f.deep ?? 1);
    if (k < 0.06) continue;
    const pw = 2 + ((f.plane ?? 3) - 2) * Math.min(1, k * 1.8);
    if (d >= 0.5 && d < 0.5 + pw) {
      out = bc + 1;
      lit = true;
    } else if (!lit && k > 0.45 && d <= -0.5 && d > -1.5) out = Math.round(base(uc + 1 / pxPerU, v)) - 1;
  }
  return out;
}

/** Columns of the panel's bottom edge that sit in a valley get notched up by `lift` px (a scalloped hem). */
export function notchHem(cl: Cloth, valleys: readonly Valley[], lift = 1): void {
  const w = Math.abs(cl.f(1, 1)[0] - cl.f(0, 1)[0]) || 1;
  for (let x = 0; x < cl.w; x++) {
    let y = -1;
    for (let yy = cl.h - 1; yy >= 0; yy--)
      if (cl.has(x, yy)) {
        y = yy;
        break;
      }
    if (y < 0) continue;
    const u = cl.u(x, y);
    if (valleys.some((va) => Math.abs(u - valleyU(va, 1)) * w < 0.75)) for (let k = 0; k < lift; k++) cl.tone[(y - k) * cl.w + x] = -1;
  }
}

// ------------------------------------------------------------------ hanging drape (tubes)

/**
 * A crease of a hanging drape: born at row v0 at u0 (folds gather under a belt or a shoulder) and
 * reaching the hem at u1 — in pixels the creases fan out because the cloth widens toward the floor,
 * so folds read as V shapes converging on their gather point. `deep` tones below the tube's base
 * (default: 1 near the birth, 2 on the lower half).
 */
export interface Crease {
  u0: number;
  u1: number;
  v0: number;
  deep?: number;
}

export const creaseU = (c: Crease, v: number) => c.u0 + (c.u1 - c.u0) * Math.pow(clamp((v - c.v0) / Math.max(1e-3, 1 - c.v0), 0, 1), 0.8);

/**
 * Drape shading for one cloth pixel. The creases split the cloth into hanging tubes; every tube is
 * a small cylinder lit from the front (the drawn right): its back side one tone down (1 px), its
 * core at the tube's base tone, its front side one tone up (1 px, 2 px on wide tubes low down), the
 * crease itself a dark 1-px valley. The cloth's own back / front edges act as tube sides. `base(u, v)`
 * is sampled at the tube's centre, so it only sets each tube's overall value (keep it banded).
 */
export function drapeTone(u: number, v: number, creases: readonly Crease[], base: (u: number, v: number) => number, pxPerU: number): number {
  let lo = 0;
  let hi = 1;
  for (const c of creases) {
    if (v < c.v0) continue;
    const uc = creaseU(c, v);
    if (Math.abs(u - uc) * pxPerU < 0.5) {
      const k = (v - c.v0) / Math.max(1e-3, 1 - c.v0);
      return Math.round(base(uc, v)) - (c.deep ?? (k < 0.18 ? 1 : 2));
    }
    if (uc <= u && uc > lo) lo = uc;
    if (uc > u && uc < hi) hi = uc;
  }
  const b = Math.round(base((lo + hi) / 2, v));
  const w = (hi - lo) * pxPerU;
  const dl = (u - lo) * pxPerU;
  const dr = (hi - u) * pxPerU;
  const litW = w >= 5.5 && v > 0.45 ? 2 : 1;
  if (dr < 0.5 + litW) return b + 1;
  if (w >= 3.5 && dl < 1.5 && lo > 0) return b - 1;
  return b;
}

/**
 * Scallop the bottom edge of a drape: each tube ends in a rounded lobe on the floor, the creases
 * notch it up 2 px and their neighbours 1 px (only on the part of the hem between minU and maxU).
 */
export function scallopHem(cl: Cloth, creases: readonly Crease[], minU = 0, maxU = 1): void {
  const w = Math.abs(cl.f(1, 1)[0] - cl.f(0, 1)[0]) || 1;
  const hemU = creases.map((c) => creaseU(c, 1));
  for (let x = 0; x < cl.w; x++) {
    let y = -1;
    for (let yy = cl.h - 1; yy >= 0; yy--)
      if (cl.has(x, yy)) {
        y = yy;
        break;
      }
    if (y < 0) continue;
    const u = cl.u(x, y);
    if (u < minU || u > maxU) continue;
    let d = 99;
    for (const hu of hemU) d = Math.min(d, Math.abs(u - hu) * w);
    const lift = d < 0.75 ? 2 : d < 1.75 ? 1 : 0;
    for (let k = 0; k < lift; k++) if (cl.has(x, y - k)) cl.tone[(y - k) * cl.w + x] = -1;
  }
}

/** Panel width in px at a given v (for one-pixel creases). */
export function widthAt(cl: Cloth, v: number): number {
  return Math.max(1, Math.hypot(cl.f(1, v)[0] - cl.f(0, v)[0], cl.f(1, v)[1] - cl.f(0, v)[1]));
}
