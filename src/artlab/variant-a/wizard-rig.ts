// Art Lab A — wizard rig: compositing, selective outline, the procedural cloth (robe) and the staff.
// Owned by the variant-A wizard; nothing else imports it.
//
// Rigid parts (hat, horns, face, eyes, arms + gloves, orb) are hand-authored maps
// (wizard-maps.ts) placed with integer offsets — and, for the hat, integer per-row / per-column
// shifts (a drawn shear, never a runtime rotation). Cloth is computed from a few pose numbers so
// the hem can lag and sway, but its folds, trims and stars are explicit, hand-placed parameters and
// its shading uses hand-tuned bands (no dithering). Only the automatic cloth base is despeckled;
// details painted afterwards (fold strokes, trims, stars, hem) are never touched. The robe's
// pattern is anchored to the hem (a breath only stretches the yoke rows), its silhouette steps are
// re-ordered into clean monotonic runs, and its two front trims are offset from one centre line by
// the same whole pixels, so they stay exactly parallel.

import { PixelCanvas } from '../../art/pixel';
import { A_INK, A_RAMPS } from './palette';
import { KEY, type PixMap } from './wizard-maps';

export type V2 = readonly [number, number];
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const R = A_RAMPS.robe;
const G = A_RAMPS.gold;

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
reg(R, R[1], A_INK.plum);
reg(G, G[1], A_INK.warm);
reg(A_RAMPS.bone, A_RAMPS.bone[1], A_INK.warm);
reg(A_RAMPS.magic, A_RAMPS.magic[1], A_INK.plum);
reg(A_RAMPS.faceShadow, A_INK.plum, A_INK.plum);
reg(A_RAMPS.staff, A_RAMPS.staff[1], A_RAMPS.staff[0]);
reg(A_RAMPS.glove, A_RAMPS.glove[0], A_INK.plum);
reg([A_INK.plum], A_INK.plum, A_INK.plum);

/** Step a colour along its ramp (clamped); unknown colours are returned unchanged. */
export function stepColor(c: number, n: number): number {
  const k = INFO.get(c);
  if (!k) return c;
  return k.ramp[clamp(k.i + n, 0, k.ramp.length - 1)];
}

// ------------------------------------------------------------------ maps

export interface StampOpts {
  /** Per-row x shift (row index of the map → px). */
  rowShift?: (row: number) => number;
  /** Per-column y shift (column index of the map → px). */
  colShift?: (col: number) => number;
  /** Only paint where this canvas is opaque. */
  mask?: PixelCanvas;
  /** Character → colour override. */
  key?: Readonly<Record<string, number>>;
}

/** Place a map so that its anchor lands on (x, y). */
export function stamp(p: PixelCanvas, m: PixMap, x: number, y: number, o: StampOpts = {}): void {
  const key = o.key ?? KEY;
  const ox = Math.round(x) - m.ax;
  const oy = Math.round(y) - m.ay;
  for (let j = 0; j < m.rows.length; j++) {
    const row = m.rows[j];
    const sx = o.rowShift ? Math.round(o.rowShift(j)) : 0;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      const sy = o.colShift ? Math.round(o.colShift(i)) : 0;
      const px = ox + i + sx;
      const py = oy + j + sy;
      if (ch === '_') {
        p.erase(px, py);
        continue;
      }
      const c = key[ch];
      if (c === undefined) continue;
      if (o.mask && !o.mask.isOpaque(px, py)) continue;
      p.set(px, py, c);
    }
  }
}

/** Raw rows stamped at a top-left corner. */
export function stampRows(p: PixelCanvas, rows: readonly string[], x: number, y: number, mask?: PixelCanvas): void {
  stamp(p, { rows, ax: 0, ay: 0 }, x, y, { mask });
}

// ------------------------------------------------------------------ compositing

/**
 * Paint `top` over `base`. Pixels of `base` touching `top` get a contact seam: `shade` steps darker
 * below / behind the covering part (light comes from the upper front), `lit` steps on the other side.
 */
export function composite(base: PixelCanvas, top: PixelCanvas, shade = 1, lit = 0): void {
  if (shade || lit) {
    const ch: [number, number, number][] = [];
    for (let y = 0; y < base.h; y++)
      for (let x = 0; x < base.w; x++) {
        if (top.isOpaque(x, y)) continue;
        const c = base.get(x, y);
        if (c === null) continue;
        // `top` above or in front (right) of this pixel → it lies in top's shadow
        const under = top.isOpaque(x, y - 1) || top.isOpaque(x + 1, y);
        const over = top.isOpaque(x, y + 1) || top.isOpaque(x - 1, y);
        if (under && shade) ch.push([x, y, stepColor(c, -shade)]);
        else if (over && lit) ch.push([x, y, stepColor(c, -lit)]);
      }
    for (const [x, y, c] of ch) base.set(x, y, c);
  }
  base.blit(top, 0, 0);
}

/**
 * The single exterior outline: deep plum (or the colour's ink) where the sprite lies above the
 * pixel (bottom edges, ground), the colour's softer tinted line on the top / front edges. `rim`
 * may colour an edge pixel instead (a selective, coloured outline where the sun rims the
 * silhouette): it is asked for top edges ('top': the sprite is below the pixel) and back edges
 * ('back': the sprite is to the right of the pixel) and returns a colour or null for the default.
 */
export function selectiveOutline(
  p: PixelCanvas,
  groundY: number,
  rim?: (x: number, y: number, side: 'top' | 'back') => number | null,
): void {
  const add: [number, number, number][] = [];
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      if (p.isOpaque(x, y)) continue;
      const up = p.get(x, y - 1);
      const right = p.get(x + 1, y);
      const down = p.get(x, y + 1);
      const left = p.get(x - 1, y);
      const shadowN = up ?? right;
      const litN = down ?? left;
      if (shadowN === null && litN === null) continue;
      let c: number;
      if (up !== null || y >= groundY) c = INFO.get((shadowN ?? litN)!)?.ink ?? A_INK.plum;
      else if (right !== null) c = rim?.(x, y, 'back') ?? INFO.get(right)?.ink ?? A_INK.plum;
      else if (down !== null) c = rim?.(x, y, 'top') ?? INFO.get(down)?.lit ?? A_INK.plum;
      else c = INFO.get(litN!)?.lit ?? A_INK.plum;
      add.push([x, y, c]);
    }
  for (const [x, y, c] of add) p.set(x, y, c);
}

/** Lonely pixels (no 4-neighbour of the same colour, ≥3 neighbours of one other colour) adopt it. */
function despeckle(tone: Int8Array, w: number, h: number): void {
  const src = tone.slice();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const t = src[i];
      if (t < 0) continue;
      const n: number[] = [];
      if (x > 0) n.push(src[i - 1]);
      if (x < w - 1) n.push(src[i + 1]);
      if (y > 0) n.push(src[i - w]);
      if (y < h - 1) n.push(src[i + w]);
      const inside = n.filter((v) => v >= 0);
      if (inside.length < 3 || inside.includes(t)) continue;
      const counts = new Map<number, number>();
      for (const v of inside) counts.set(v, (counts.get(v) ?? 0) + 1);
      let best = t;
      let bc = 0;
      for (const [v, c] of counts) if (c > bc) [best, bc] = [v, c];
      tone[i] = best;
    }
}

// ------------------------------------------------------------------ robe (cloth)

/**
 * One fold of the cape: a crease that starts at an apex near the collar and runs straight down to
 * the hem (two folds sharing an apex make a V pinch). Left of the crease the cloth bulges toward
 * the light (a lit ridge), right of it a shadow wedge widens toward the hem, and where the crease
 * meets the ground it pinches the hem up into a rounded notch (the scallops between the folds).
 */
export interface Fold {
  /** Apex relative to the neck (px, rest pose; y counts rows down from the neck row). */
  ax: number;
  ay: number;
  /** Where the crease meets the hem (0 back corner .. 1 front corner). */
  u: number;
  /** Shadow wedge width at the hem (px) and lit ridge width at the hem (px, 1..2). */
  w: number;
  ridge: number;
  /** Hem notch at the crease end (px, 0..2). */
  lift: number;
  /** Ridge tone boost (default 1; 2 = a strong fold that reads at 1×) and a deep R0 crease. */
  hi?: number;
  deep?: boolean;
}

export interface Star {
  u: number;
  v: number;
  rows: readonly string[];
}

export interface RobeSpec {
  /** Neck (top centre of the cloth) and half width at the shoulders. */
  nx: number;
  ny: number;
  sw: number;
  /**
   * Rows from the neck to the ground row in the REST pose. The cloth pattern (folds, trims, stars,
   * hem) is anchored to the hem: when the neck rises or drops only the yoke rows under the collar
   * stretch, so a breath does not re-sample the whole robe.
   */
  span0: number;
  /** Hem extremes (x) and the ground row under the front of the hem. */
  hl: number;
  hr: number;
  gy: number;
  /** The hem is the front half of a floor ellipse: its sides sit this many px above its front. */
  arc: number;
  /** Secondary motion: lower cloth lag (px, + = forward). */
  sway: number;
  /** Hem corner curls (px lift of the back / front corners) and how far the corners flick out. */
  curlL: number;
  curlR: number;
  flickL: number;
  flickR: number;
  /** Outward belly of the sides (0 straight cone .. 6 round bell). */
  belly: number;
  /** Front opening: centre (u at the hem) and how far the cape parts at the hem (px). */
  front: number;
  open: number;
  folds: readonly Fold[];
  stars: readonly Star[];
  /** v below which the brim's shadow darkens the cloth. */
  shadowV: number;
  /** A 1-px hem ripple: a short lifted stretch of the hem centred at u (0 back .. 1 front). */
  ripple?: number;
}

export interface RobeOut {
  canvas: PixelCanvas;
  /** Row → [left, right] silhouette (for placing other parts). */
  edge(y: number): [number, number] | null;
}

/**
 * Re-order the step runs of a steep edge (one x per row, |Δx| ≤ 1) inside rows [a, b] so their
 * lengths grow (asc) or shrink monotonically: a drawn curve (1,1,2,2,3,3) instead of the jitter
 * (1,2,1,3) that rounding a curve leaves. The end points stay where they are.
 */
function evenRuns(xs: Map<number, number>, a: number, b: number, asc: boolean): void {
  if (b - a < 4) return;
  const dir = Math.sign(xs.get(b)! - xs.get(a)!);
  if (!dir) return;
  for (let y = a; y < b; y++) {
    const d = xs.get(y + 1)! - xs.get(y)!;
    if (d !== 0 && d !== dir) return;
  }
  const runs: number[] = [];
  let n = 1;
  for (let y = a + 1; y <= b; y++) {
    if (xs.get(y) === xs.get(y - 1)) n++;
    else {
      runs.push(n);
      n = 1;
    }
  }
  runs.push(n);
  if (runs.length < 4) return;
  // the end runs are cut by the segment ends: keep them, sort the inner ones
  const inner = runs.slice(1, -1).sort((p, q) => (asc ? p - q : q - p));
  const all = [runs[0], ...inner, runs[runs.length - 1]];
  let x = xs.get(a)!;
  let y = a;
  for (const r of all) {
    for (let i = 0; i < r; i++) xs.set(y++, x);
    x += dir;
  }
}

/** Draw the robe into a new layer. */
export function drawRobe(w: number, h: number, s: RobeSpec): RobeOut {
  const top = Math.round(s.ny);
  const gy = s.gy;
  const span0 = s.span0;
  const top0 = gy - span0;
  // hem-anchored rows: below the yoke zone every row keeps its rest place; the zone stretches
  const dy = top - top0;
  const Z = clamp(Math.max(8, Math.abs(dy) * 3), 1, span0);
  const zEnd = top0 + Z;
  const restY = (y: number) => (y >= zEnd ? y : top0 + ((y - top) * Z) / Math.max(1, zEnd - top));
  const toY = (ry: number) => (ry >= zEnd ? ry : top + ((ry - top0) * (zEnd - top)) / Z);
  const vOf = (y: number) => clamp((restY(y) - top0) / span0, 0, 1);

  // ---- silhouette: rounded shoulders, a bell that bulges and then flares into the hem corners
  const b = clamp(0.25 + 0.1 * s.belly, 0, 0.85);
  const prof = (v: number) => (1 - b) * v + b * (1 - Math.pow(1 - v, 3));
  const FL = 0.8;
  const flare = (v: number, f: number) => (v > FL ? f * Math.pow((v - FL) / (1 - FL), 2) : 0);
  const cap = (v: number) => (v < 0.12 ? 2.5 * (1 - Math.sqrt(v / 0.12)) : 0);
  const XL = new Map<number, number>();
  const XR = new Map<number, number>();
  for (let y = top; y <= gy; y++) {
    const v = vOf(y);
    XL.set(y, Math.round(lerp(s.nx - s.sw, s.hl, prof(v)) - flare(v, s.flickL) + cap(v)));
    XR.set(y, Math.round(lerp(s.nx + s.sw, s.hr, prof(v)) + flare(v, s.flickR) - cap(v)));
  }
  // clean step runs on the long body stretch (fixed rest rows → stable while breathing)
  const bodyA = Math.max(top + 2, zEnd);
  const bodyB = Math.round(toY(top0 + FL * span0));
  evenRuns(XL, bodyA, bodyB, true);
  evenRuns(XR, bodyA, bodyB, true);

  // ---- hem: front half of a floor ellipse, corners curled up, notched where the folds land
  const hemL = XL.get(gy)!;
  const hemR = XR.get(gy)!;
  const hemX = (u: number) => Math.round(hemL + u * (hemR - hemL));
  const UC = 0.56;
  const notch = new Map<number, number>();
  const addNotch = (x: number, d: number) => notch.set(x, Math.max(notch.get(x) ?? 0, d));
  for (const f of s.folds) {
    const fx = hemX(f.u);
    if (f.lift >= 2) {
      addNotch(fx - 2, 1);
      addNotch(fx - 1, 2);
      addNotch(fx, 2);
      addNotch(fx + 1, 1);
    } else if (f.lift >= 1) {
      addNotch(fx - 1, 1);
      addNotch(fx, 1);
    }
  }
  if (s.ripple !== undefined) {
    // a soft travelling wave: 4 px lifted by one row, its ends eased by the neighbouring notches
    const rx = hemX(s.ripple);
    for (let dx = -2; dx <= 1; dx++) addNotch(rx + dx, 1);
  }
  const ybCache = new Map<number, number>();
  const yb = (x: number) => {
    let y = ybCache.get(x);
    if (y !== undefined) return y;
    const u = clamp((x + 0.5 - hemL) / Math.max(1, hemR + 1 - hemL), 0, 1);
    const e = u < UC ? (UC - u) / UC : (u - UC) / (1 - UC);
    let f = gy - s.arc * (1 - Math.sqrt(Math.max(0, 1 - e * e)));
    if (u < 0.1) f -= s.curlL * Math.pow((0.1 - u) / 0.1, 2);
    if (u > 0.9) f -= s.curlR * Math.pow((u - 0.9) / 0.1, 2);
    y = Math.round(f) - (notch.get(x) ?? 0);
    ybCache.set(x, y);
    return y;
  };

  // ---- base tones: light wraps from the back (u 0, dark) to the lit front; the brim shades the yoke
  const tone = new Int8Array(w * h).fill(-1);
  const U = new Float32Array(w * h);
  const T = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : tone[y * w + x]);
  for (let y = top; y <= gy; y++) {
    if (y < 0 || y >= h) continue;
    const v = vOf(y);
    const xl = XL.get(y)!;
    const xr = XR.get(y)!;
    for (let x = xl; x <= xr; x++) {
      if (x < 0 || x >= w || y > yb(x)) continue;
      const u = clamp((x + 0.5 - xl) / Math.max(1, xr + 1 - xl), 0, 1);
      const lam = Math.cos((u - 0.5) * 2.8 - 0.75);
      let t = 1.05 + 2.0 * Math.max(0, lam) + 0.25 * v;
      if (v < s.shadowV) t -= 1.0;
      else if (v < s.shadowV + 0.07) t -= 0.5;
      tone[y * w + x] = clamp(Math.floor(t + 0.5), 0, 4);
      U[y * w + x] = u;
    }
  }
  despeckle(tone, w, h);

  // ---- folds (painted strokes over the base: wedges, then ridges, then creases)
  const base = tone.slice();
  const strokes = s.folds.map((f) => {
    const vA = clamp(f.ay / span0, 0, 0.95);
    const ax = s.nx + f.ax;
    const hx = hemL + f.u * (hemR - hemL);
    const rows: [number, number, number][] = []; // y, crease x, k
    for (let y = top; y <= gy; y++) {
      const v = vOf(y);
      if (v < vA) continue;
      const k = (v - vA) / (1 - vA);
      rows.push([y, Math.round(lerp(ax, hx, k)), k]);
    }
    return { f, rows };
  });
  const put = (x: number, y: number, t: number) => {
    if (T(x, y) >= 0) tone[y * w + x] = clamp(t, 0, 4);
  };
  for (const { f, rows } of strokes)
    for (const [y, cx, k] of rows) {
      const ww = Math.round(f.w * Math.pow(k, 0.9));
      for (let i = 1; i <= ww; i++) if (base[y * w + cx + i] >= 0) put(cx + i, y, base[y * w + cx + i] - 1);
    }
  for (const { f, rows } of strokes)
    for (const [y, cx, k] of rows) {
      if (k < 0.1) continue;
      const rw = k < 0.45 ? 1 : f.ridge;
      const hi = k < 0.3 ? 1 : (f.hi ?? 1);
      for (let i = 1; i <= rw; i++) if (base[y * w + cx - i] >= 0) put(cx - i, y, base[y * w + cx - i] + hi);
    }
  for (const { f, rows } of strokes)
    for (const [y, cx, k] of rows) {
      const b0 = base[y * w + cx];
      if (b0 >= 0) put(cx, y, (f.deep && k > 0.25) || b0 < 2 ? 0 : 1);
    }

  const p = new PixelCanvas(w, h);
  for (let i = 0; i < w * h; i++) if (tone[i] >= 0) p.set(i % w, Math.floor(i / w), R[tone[i]]);
  const cloth = p.clone();

  // ---- front opening: the cape parts over the inner robe. One straight centre line; both gold
  // trims are offset from it by the same whole pixels (exactly parallel) and part symmetrically
  // near the hem.
  const oTop = top + 3;
  const ox0 = s.nx + 3;
  const ox1 = hemL + s.front * (hemR - hemL);
  const oRest = restY(oTop);
  let prevL = -1;
  let prevR = -1;
  for (let y = oTop; y <= gy; y++) {
    const v = vOf(y);
    const k = clamp((restY(y) - oRest) / Math.max(1, gy - oRest), 0, 1);
    const xc = Math.round(lerp(ox0, ox1, k));
    const part = v > 0.5 ? Math.round((s.open / 2) * Math.pow((v - 0.5) / 0.5, 2)) : 0;
    const tl = xc - 2 - part;
    const tr = xc + 2 + part;
    const dark = v < s.shadowV + 0.04;
    for (let x = tl + 1; x < tr; x++) {
      if (!cloth.isOpaque(x, y)) continue;
      let c: number = dark || x >= tr - 2 ? R[1] : R[2];
      // the inner robe's centre seam: a dark crease with small gold buttons
      if (x === xc && v > 0.12) c = (Math.round(restY(y)) - top0) % 6 === 2 ? G[3] : R[1];
      p.set(x, y, c);
    }
    const trim = (x: number, c: number) => {
      if (cloth.isOpaque(x, y)) p.set(x, y, c);
    };
    const cL = dark ? G[2] : G[3];
    const cR = dark ? G[1] : G[2];
    trim(tl, cL);
    trim(tr, cR);
    // keep the lines continuous where they part by more than a pixel per row
    if (prevL >= 0) for (let x = tl + 1; x < prevL; x++) trim(x, cL);
    if (prevR >= 0) for (let x = prevR + 1; x < tr; x++) trim(x, cR);
    prevL = tl;
    prevR = tr;
  }

  // ---- stars (on the cloth only, placed in hem-anchored rows)
  for (const st of s.stars) {
    const y = Math.round(toY(top0 + st.v * span0));
    const xl = XL.get(y);
    const xr = XR.get(y);
    if (xl === undefined || xr === undefined) continue;
    const x = Math.round(lerp(xl, xr, st.u));
    const rw = st.rows[0].length;
    stampRows(p, st.rows, x - (rw >> 1), y - (st.rows.length >> 1), cloth);
  }

  // ---- hem trim: the two lowest cloth pixels of every column (it follows the scallops)
  for (let x = 0; x < w; x++) {
    let yy = -1;
    for (let y = gy; y >= top; y--)
      if (p.isOpaque(x, y)) {
        yy = y;
        break;
      }
    if (yy < 0) continue;
    const u = U[yy * w + x];
    const lam = Math.cos((u - 0.5) * 2.8 - 0.75);
    const lit = lam > 0.55;
    p.set(x, yy, lit ? G[2] : G[1]);
    if (p.isOpaque(x, yy - 1)) p.set(x, yy - 1, lit ? G[3] : G[2]);
    // the curled corners show the dark lining above the trim
    const hu = (x + 0.5 - hemL) / Math.max(1, hemR + 1 - hemL);
    if ((hu < 0.07 && s.curlL > 1) || (hu > 0.93 && s.curlR > 1)) if (p.isOpaque(x, yy - 2)) p.set(x, yy - 2, R[0]);
  }

  // ---- secondary motion: the cloth lags in the middle rows (whole pixels; yoke and hem stay)
  const shift = (y: number) => (y < top || y > gy ? 0 : Math.round(s.sway * Math.sin(Math.PI * Math.pow(vOf(y), 1.25))));
  const out = s.sway ? shiftRows(p, shift) : p;
  return {
    canvas: out,
    edge: (y: number) => {
      const xl = XL.get(y);
      const xr = XR.get(y);
      return xl === undefined || xr === undefined ? null : [xl + shift(y), xr + shift(y)];
    },
  };
}

// ------------------------------------------------------------------ capelet (cloth)

export interface CapeSpec {
  /** Neck (top centre of the cape) — the hood's base sits on it. */
  nx: number;
  ny: number;
  /** Half widths at the top (hood edges) and at the hem, back (left) and front (right). */
  topL: number;
  topR: number;
  hemL: number;
  hemR: number;
  /** Rows from the neck to the hem's lowest point (front of the hem). */
  len: number;
  /** The hem is the front of a floor ellipse: its sides sit this many px higher. */
  arc: number;
  /** The clasp's x offset from the neck; the front panel's edge runs from it to the hem. */
  clasp: number;
  /** Secondary motion: lower rows lag (px, + forward); the back corner lifts (px). */
  sway: number;
  lift: number;
  /** Creases: x offset from the neck at the top / at the hem, first row; the ridge sits behind. */
  folds: readonly { x0: number; x1: number; y0: number }[];
}

/**
 * The short hooded capelet over the shoulders, drawn in tone bands. The top plane of the shoulders
 * (a 3-row band that follows the shoulder line) faces up into the light — R3, R4 on the front
 * shoulder; the draped sides wrap from R1 at the back to R3 at the front; the underside rolls into
 * shadow above a 1-px gold hem that dips to a point under the clasp. The front panel overlaps the
 * back one along a gold edge from the clasp (a gold diamond with a magic stone) to that point and
 * shades the back panel beside it. A few creases (dark crease, 2-px lit ridge behind it) notch the
 * hem. The centre top stays clear of the hood's chin lip.
 */
export function drawCape(w: number, h: number, s: CapeSpec): PixelCanvas {
  const p = new PixelCanvas(w, h);
  const top = Math.round(s.ny);
  const nx = Math.round(s.nx);
  const L = s.len;
  const prof = (v: number) => 1 - Math.pow(1 - v, 2.2);
  const xl = (r: number) => nx - Math.round(lerp(s.topL, s.hemL, prof(clamp(r / L, 0, 1))));
  const xr = (r: number) => nx + Math.round(lerp(s.topR, s.hemR, prof(clamp(r / L, 0, 1))));
  const cx = nx + s.clasp;
  // the front panel's edge: from the clasp down and slightly forward to the hem point
  const edge = (r: number) => cx + Math.floor((Math.max(0, r - 2) * 2) / Math.max(1, L - 2));
  const hemL = xl(L);
  const hemR = xr(L);
  const notch = new Map<number, number>();
  for (const f of s.folds) {
    notch.set(nx + f.x1, 1);
    notch.set(nx + f.x1 - 1, 1);
  }
  const tip = edge(L);
  const yb = (x: number) => {
    const u = clamp((x + 0.5 - hemL) / Math.max(1, hemR + 1 - hemL), 0, 1);
    const e = u < 0.55 ? (0.55 - u) / 0.55 : (u - 0.55) / 0.45;
    let y = top + L - s.arc * (1 - Math.sqrt(Math.max(0, 1 - e * e)));
    if (u < 0.15) y -= s.lift * Math.pow((0.15 - u) / 0.15, 1.5);
    // the panels hang to a point under the clasp
    const dt = Math.abs(x - tip);
    if (dt <= 3) y += dt <= 1 ? 2 : 1;
    return Math.round(y) - (notch.get(x) ?? 0);
  };
  // first row of each column: the chin lip of the hood stays visible above the clasp
  const r0 = (x: number) => (x >= nx - 3 && x <= nx + 8 ? 1 : 0);
  const tone = new Int8Array(w * h).fill(-1);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : tone[y * w + x]);
  const topEdge = new Map<number, number>();
  for (let r = 0; r <= L + 3; r++) {
    const y = top + r;
    if (y < 0 || y >= h) continue;
    const a = xl(Math.min(r, L));
    const b = xr(Math.min(r, L));
    for (let x = a; x <= b; x++) {
      if (x < 0 || x >= w || y > yb(x) || r < r0(x)) continue;
      if (!topEdge.has(x)) topEdge.set(x, y);
      const u = (x + 0.5 - a) / Math.max(1, b + 1 - a);
      const d = y - topEdge.get(x)!;
      let t: number;
      if (d < 3) t = x > cx ? (d < 2 ? 4 : 3) : u < 0.12 ? 2 : 3; // the shoulder's top plane
      else t = u < 0.3 ? 1 : x <= edge(r) ? 2 : 3; // the drape: back → front
      tone[y * w + x] = t;
    }
  }
  // underside: the row above the hem rolls into shadow
  for (let x = 0; x < w; x++) {
    const y = yb(x);
    if (at(x, y) < 0 || at(x, y - 1) < 0 || y - 1 - (topEdge.get(x) ?? 0) < 3) continue;
    tone[(y - 1) * w + x] = Math.max(0, at(x, y - 1) - 1);
  }
  // creases: dark crease, lit ridge behind it (2 px lower down), from the shoulder line to the hem
  for (const f of s.folds) {
    for (let y = top + f.y0; y <= top + L + 1; y++) {
      const k = clamp((y - top - f.y0) / Math.max(1, L - f.y0), 0, 1);
      const x = nx + Math.round(lerp(f.x0, f.x1, k));
      if (at(x, y) < 0 || y >= yb(x)) continue;
      const b0 = at(x, y);
      tone[y * w + x] = b0 >= 3 ? 1 : 0;
      for (let i = 1; i <= (k > 0.35 ? 2 : 1); i++) if (at(x - i, y) >= 0 && y < yb(x - i)) tone[y * w + x - i] = Math.min(4, b0 + 1);
    }
  }
  // the front panel shades the back panel beside its edge
  for (let r = 3; r <= L + 3; r++) {
    const y = top + r;
    const x = edge(Math.min(r, L)) - 1;
    if (at(x, y) > 0 && y < yb(x)) tone[y * w + x] = 1;
  }
  for (let i = 0; i < w * h; i++) if (tone[i] >= 0) p.set(i % w, Math.floor(i / w), R[tone[i]]);
  const shape = p.clone();
  // gold hem (the lowest pixel of each column) and the gold edge of the front panel
  for (let x = 0; x < w; x++) {
    let y = -1;
    for (let yy = top + L + 4; yy >= top; yy--)
      if (shape.isOpaque(x, yy)) {
        y = yy;
        break;
      }
    if (y < 0) continue;
    const u = (x + 0.5 - hemL) / Math.max(1, hemR + 1 - hemL);
    p.set(x, y, u < 0.18 ? G[1] : x <= tip ? G[2] : G[3]);
  }
  for (let r = 2; r <= L + 2; r++) {
    const y = top + r;
    const x = edge(Math.min(r, L));
    if (shape.isOpaque(x, y)) p.set(x, y, r < 4 ? G[3] : G[2]);
  }
  // the clasp: a gold diamond with a magic stone
  p.set(cx, top, G[4]);
  p.set(cx - 1, top + 1, G[2]);
  p.set(cx, top + 1, A_RAMPS.magic[4]);
  p.set(cx + 1, top + 1, G[3]);
  p.set(cx, top + 2, G[1]);
  // secondary motion: the lower rows lag (whole pixels)
  if (!s.sway) return p;
  return shiftRows(p, (y) => (y - top > L * 0.45 ? Math.round(s.sway * ((y - top - L * 0.45) / (L * 0.55))) : 0));
}

// ------------------------------------------------------------------ staff

const W_ = A_RAMPS.staff;

export interface StaffSpec {
  /** Grip point (px) and angle in degrees (0 = straight up, + = top leaning forward). */
  gx: number;
  gy: number;
  deg: number;
  /** Distance grip → top end (cradle base) and grip → bottom end. */
  up: number;
  down: number;
}

export function staffDir(deg: number): V2 {
  const a = (deg * Math.PI) / 180;
  return [Math.sin(a), -Math.cos(a)];
}

/** Two-pixel wooden staff with gold rings and a gold foot. Returns its top point. */
export function drawStaff(p: PixelCanvas, s: StaffSpec, rings: readonly number[] = [5, 9]): V2 {
  const d = staffDir(s.deg);
  const top: V2 = [s.gx + d[0] * s.up, s.gy + d[1] * s.up];
  const bot: V2 = [s.gx - d[0] * s.down, s.gy - d[1] * s.down];
  const steep = Math.abs(d[1]) >= Math.abs(d[0]);
  const len = Math.hypot(top[0] - bot[0], top[1] - bot[1]);
  const n = Math.max(1, Math.ceil(len * 2));
  const seen = new Set<number>();
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const x = Math.round(lerp(top[0], bot[0], t));
    const y = Math.round(lerp(top[1], bot[1], t));
    const key = y * 4096 + x;
    if (seen.has(key)) continue;
    seen.add(key);
    const along = t * len; // from the top
    let dark: number = W_[2];
    let light: number = W_[3];
    if (along > len - 2.5) {
      dark = G[1];
      light = G[2];
    } else if (rings.some((r) => Math.abs(along - r) < 0.75)) {
      dark = G[2];
      light = G[3];
    } else if (along > len * 0.62) {
      dark = W_[1];
      light = W_[2];
    }
    if (steep) {
      p.set(x, y, dark);
      p.set(x + 1, y, light);
    } else {
      p.set(x, y, dark);
      p.set(x, y - 1, light);
    }
  }
  return top;
}

/**
 * Gold claw cradle hugging the orb, behind it: two side prongs (2 px thick at the base, curling to
 * bright tips) on a cup where they meet the staff. The third, middle prong runs up the orb's front
 * face — see drawCradleFront, painted after the orb.
 */
export function drawCradle(p: PixelCanvas, ox: number, oy: number, r: number, deg: number): void {
  const d = staffDir(deg);
  const back = Math.atan2(-d[1], -d[0]); // from the orb centre toward the staff
  const rr = r + 1.2;
  for (const side of [-1, 1]) {
    for (let a = 0.18; a <= 1.8; a += 0.04) {
      const ang = back + side * a;
      const x = Math.round(ox + Math.cos(ang) * rr);
      const y = Math.round(oy + Math.sin(ang) * rr);
      const lit = Math.cos(ang) - Math.sin(ang) > 0.3;
      p.set(x, y, a > 1.6 ? G[4] : lit ? G[3] : G[1]);
      if (a < 0.85) p.set(Math.round(ox + Math.cos(ang) * (rr + 1)), Math.round(oy + Math.sin(ang) * (rr + 1)), lit ? G[2] : G[0]);
    }
  }
  // the cup where the prongs meet the staff
  const cx = Math.round(ox + Math.cos(back) * (rr + 0.6));
  const cy = Math.round(oy + Math.sin(back) * (rr + 0.6));
  p.set(cx, cy, G[2]);
  p.set(cx + 1, cy, G[3]);
  p.set(cx - 1, cy, G[1]);
}

/** The cradle's middle prong over the orb's front face, from the cup toward the centre. */
export function drawCradleFront(p: PixelCanvas, ox: number, oy: number, r: number, deg: number): void {
  const d = staffDir(deg);
  const n = Math.max(2, Math.round(r * 0.6));
  for (let i = 0; i <= n; i++) {
    const k = r + 1 - i;
    const x = Math.round(ox - d[0] * k);
    const y = Math.round(oy - d[1] * k);
    p.set(x, y, i === n ? G[4] : i === 0 ? G[2] : G[3]);
  }
}

// ------------------------------------------------------------------ sleeve (cloth)

export interface SleeveSpec {
  /** Shoulder (hidden under the brim) and cuff centre (the wrist). */
  sx: number;
  sy: number;
  cx: number;
  cy: number;
  /** Tube radius at the shoulder and at the cuff. */
  r0: number;
  r1: number;
  /** The bell: how far its tip hangs below the cuff, and its lag (px, + forward). */
  droop: number;
  lag: number;
}

function inPoly(poly: readonly V2[], px: number, py: number): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[j];
    if (y0 > py !== y1 > py && px < x0 + ((py - y0) / (y1 - y0)) * (x1 - x0)) c = !c;
  }
  return c;
}

function quad(a: V2, c: V2, b: V2, n = 10): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
}

/**
 * A big bell sleeve draped in front of the robe: a puffy tube from the shoulder to the cuff and a
 * bell of cloth hanging from the whole forearm (its tip lags behind the hand). Banded shading: a lit
 * top ridge, mid, the under side with one curved elbow crease; the bell is lit along its front edge
 * and curls into shadow toward its back, with a drape fold (dark crease + lit ridge) running from
 * the armpit into the bell. The opening is a tall narrow ellipse — the dark lining inside a gold
 * rim — and the glove comes out of it.
 */
export function drawSleeve(w: number, h: number, s: SleeveSpec): PixelCanvas {
  const S: V2 = [s.sx, s.sy];
  const C: V2 = [s.cx, s.cy];
  const len = Math.hypot(C[0] - S[0], C[1] - S[1]) || 1;
  const a: V2 = [(C[0] - S[0]) / len, (C[1] - S[1]) / len];
  let n: V2 = [a[1], -a[0]];
  if (n[0] * 0.45 - n[1] < 0) n = [-n[0], -n[1]]; // n points to the light (up and to the front)
  const P = (o: V2, k: number, r: number): V2 => [o[0] + n[0] * k * r, o[1] + n[1] * k * r];
  const mid: V2 = [(S[0] + C[0]) / 2, (S[1] + C[1]) / 2];
  const cTop = P(C, 1, s.r1);
  const cBot = P(C, -1, s.r1 * 0.7);
  const tip: V2 = [C[0] - 1 + s.lag, Math.max(cBot[1] + 2, C[1] + s.r1 + s.droop)];
  // the bell hangs from the whole forearm: its back edge starts near the armpit
  const elbow: V2 = [lerp(S[0], C[0], 0.14), lerp(S[1], C[1], 0.14) + s.r0 * 0.9 + s.droop * 0.5];
  const top = quad(P(S, 1, s.r0), P(mid, 1.35, (s.r0 + s.r1) / 2), cTop);
  const front = quad(cBot, [lerp(cBot[0], tip[0], 0.5) + 1.2, lerp(cBot[1], tip[1], 0.5)], tip, 6);
  const back = quad(tip, [lerp(tip[0], elbow[0], 0.45) - 0.5, Math.max(tip[1], elbow[1]) + 0.5], elbow, 8);
  const poly: V2[] = [...top, [C[0] + a[0] * 0.8, C[1] + a[1] * 0.8], ...front, ...back.slice(1), P(S, -1, s.r0)];
  const p = new PixelCanvas(w, h);
  const x0 = Math.floor(Math.min(...poly.map((q) => q[0]))) - 1;
  const x1 = Math.ceil(Math.max(...poly.map((q) => q[0]))) + 1;
  const y0 = Math.floor(Math.min(...poly.map((q) => q[1]))) - 1;
  const y1 = Math.ceil(Math.max(...poly.map((q) => q[1]))) + 1;
  const tone = new Int8Array(w * h).fill(-1);
  for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      if (!inPoly(poly, px, py)) continue;
      const t = clamp(((px - S[0]) * a[0] + (py - S[1]) * a[1]) / len, 0, 1);
      const r = lerp(s.r0, s.r1, t);
      const l = ((px - S[0]) * n[0] + (py - S[1]) * n[1]) / r;
      let k: number;
      // elbow bunching: one curved crease across the underside of the arm
      const bunch = Math.abs((t - 0.52 - l * 0.1) * len) < 0.55 && l < 0.3 && l > -0.95;
      if (l > 0.6) k = 4; // the lit top plane of the sleeve: a 2-px R4 ridge over R3
      else if (l > 0.0) k = bunch ? 2 : 3;
      else if (l > -0.75) k = bunch ? 1 : 2;
      else {
        // the bell: its front edge (by the opening) faces forward into the light, its back curls
        // away into shadow
        const dFront = Math.min(...front.map((q) => Math.hypot(px - q[0], py - q[1])));
        const dBack = Math.min(...back.map((q) => Math.hypot(px - q[0], py - q[1])));
        k = dFront < 1.6 ? 4 : dFront < 3.6 ? 3 : dBack < 1.6 ? 1 : 2;
      }
      tone[y * w + x] = k;
    }
  despeckle(tone, w, h);
  for (let i = 0; i < w * h; i++) if (tone[i] >= 0) p.set(i % w, Math.floor(i / w), R[tone[i]]);
  const inside = p.clone();
  // the drape fold: a crease from the underside of the arm down into the bell, lit on its front side
  const f0 = P([lerp(S[0], C[0], 0.38), lerp(S[1], C[1], 0.38)], -0.85, lerp(s.r0, s.r1, 0.38));
  const f1: V2 = [tip[0] - 2.5, tip[1] - 2];
  if (f1[1] - f0[1] > 2) {
    const n2 = Math.ceil(Math.max(Math.abs(f1[0] - f0[0]), Math.abs(f1[1] - f0[1])));
    let last = '';
    for (let i = 0; i <= n2; i++) {
      const x = Math.round(lerp(f0[0], f1[0], i / n2));
      const y = Math.round(lerp(f0[1], f1[1], i / n2));
      if (`${x},${y}` === last) continue;
      last = `${x},${y}`;
      if (!inside.isOpaque(x, y) || !inside.isOpaque(x - 1, y) || !inside.isOpaque(x + 1, y)) continue;
      p.set(x, y, R[1]);
      if (inside.get(x + 1, y) === R[2]) p.set(x + 1, y, R[3]);
    }
  }
  // the opening: a tall, narrow ellipse at the wrist end, from the top of the cuff down to the
  // bell's tip — the dark lining inside a gold rim (lit on top, darker toward the tip). The glove
  // comes out of its upper part.
  const oc: V2 = [(cTop[0] + tip[0]) / 2 - a[0] * 0.7, (cTop[1] + tip[1]) / 2 - a[1] * 0.7];
  const ol = Math.hypot(tip[0] - cTop[0], tip[1] - cTop[1]) || 1;
  const om: V2 = [(tip[0] - cTop[0]) / ol, (tip[1] - cTop[1]) / ol];
  const semiA = ol / 2 + 0.6;
  const semiB = 2.4;
  const inOpening = (x: number, y: number) => {
    const dx = x + 0.5 - oc[0];
    const dy = y + 0.5 - oc[1];
    const pa = (dx * om[0] + dy * om[1]) / semiA;
    const pb = (dx * -om[1] + dy * om[0]) / semiB;
    return pa * pa + pb * pb <= 1;
  };
  const ex0 = Math.floor(oc[0] - semiA - 2);
  const ex1 = Math.ceil(oc[0] + semiA + 2);
  const ey0 = Math.floor(oc[1] - semiA - 2);
  const ey1 = Math.ceil(oc[1] + semiA + 2);
  for (let y = ey0; y <= ey1; y++)
    for (let x = ex0; x <= ex1; x++) {
      if (!inOpening(x, y)) continue;
      const rim = !inOpening(x - 1, y) || !inOpening(x + 1, y) || !inOpening(x, y - 1) || !inOpening(x, y + 1);
      if (!rim) {
        // the lining: deep inside, the far wall of the bell catching a little light
        const side = (x + 0.5 - oc[0]) * a[0] + (y + 0.5 - oc[1]) * a[1];
        p.set(x, y, side < -0.6 ? R[1] : R[0]);
        continue;
      }
      const along = ((x + 0.5 - cTop[0]) * om[0] + (y + 0.5 - cTop[1]) * om[1]) / ol;
      const frontSide = (x + 0.5 - oc[0]) * a[0] + (y + 0.5 - oc[1]) * a[1] > 0;
      p.set(x, y, along < 0.3 ? G[3] : frontSide ? G[2] : along > 0.8 ? G[1] : G[2]);
    }
  return p;
}

// ------------------------------------------------------------------ drawn deformations

/**
 * Shear a canvas around a pivot (a drawn tilt — every pixel moves by whole pixels, rows / columns
 * stay intact): first columns slide vertically (colK px per px from the pivot column), then rows
 * slide horizontally (rowK px per px above the pivot row).
 */
export function shear(src: PixelCanvas, px: number, py: number, rowK: number, colK: number): PixelCanvas {
  if (!rowK && !colK) return src;
  const a = new PixelCanvas(src.w, src.h);
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const c = src.get(x, y);
      if (c === null) continue;
      a.set(x, y + Math.round(colK * (x - px)), c);
    }
  const b = new PixelCanvas(src.w, src.h);
  for (let y = 0; y < a.h; y++)
    for (let x = 0; x < a.w; x++) {
      const c = a.get(x, y);
      if (c === null) continue;
      b.set(x + Math.round(rowK * (py - y)), y, c);
    }
  return b;
}

/** Slide each row horizontally by fn(row) px (whole pixels). */
export function shiftRows(src: PixelCanvas, fn: (y: number) => number): PixelCanvas {
  const b = new PixelCanvas(src.w, src.h);
  for (let y = 0; y < src.h; y++) {
    const d = Math.round(fn(y));
    for (let x = 0; x < src.w; x++) {
      const c = src.get(x, y);
      if (c !== null) b.set(x + d, y, c);
    }
  }
  return b;
}

/** Deterministic per-pixel hash in [0, 1). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
