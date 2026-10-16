// Art Lab C — wizard rig: colour ramps registry, map stamping, compositing with contact seams,
// banded cloth fills, the selective outline and the neon rim. Owned by the variant-C wizard.
//
// Light comes from the upper LEFT of the drawing (the original abyss magus' key light), so a part
// laid over another throws its contact seam to the right / below, the lit-side outline is the top
// and the back (left) edge, and the void rim sits on the front (right) edges facing away from it.

import { PixelCanvas } from '../../art/pixel';
import { C_ARMOR, C_CAPE, C_GLOW, C_INK, C_VOID, KEY, type PixMap } from './wizard-maps';

export type V2 = readonly [number, number];
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ------------------------------------------------------------------ colour info

interface CInfo {
  ramp: readonly number[];
  i: number;
  /** Outline on the lit side (top / back edge). */
  lit: number;
  /** Outline on the shadow side (bottom / front edge) and on the ground. */
  ink: number;
  /** Material id (for the rim / erosion passes). */
  mat: Mat;
}
export type Mat = 'armor' | 'void' | 'cape' | 'glow' | 'ink';
const INFO = new Map<number, CInfo>();
function reg(ramp: readonly number[], lit: number, ink: number, mat: Mat): void {
  ramp.forEach((c, i) => {
    if (!INFO.has(c)) INFO.set(c, { ramp, i, lit, ink, mat });
  });
}
// the cape shares two tones with the armour ramp: register the armour first (the outline of a
// shared tone then follows the armour, which is what sits on the silhouette there)
reg(C_ARMOR, C_ARMOR[2], C_INK.ink, 'armor');
reg(C_VOID, C_VOID[2], C_INK.ink, 'void');
reg(C_CAPE, C_CAPE[3], C_INK.ink, 'cape');
reg(C_GLOW, C_GLOW[1], C_INK.ink, 'glow');
reg([C_INK.ink, C_INK.bounce0, C_INK.bounce1], C_INK.ink, C_INK.ink, 'ink');

export function info(c: number | null): CInfo | undefined {
  return c === null ? undefined : INFO.get(c);
}

/** Step a colour along its ramp (clamped); unknown colours come back unchanged. */
export function stepColor(c: number, n: number): number {
  const k = INFO.get(c);
  if (!k) return c;
  return k.ramp[clamp(k.i + n, 0, k.ramp.length - 1)];
}

// ------------------------------------------------------------------ maps

export interface StampOpts {
  /** Only paint where this canvas is opaque. */
  mask?: PixelCanvas;
  /** Character → colour override. */
  key?: Readonly<Record<string, number>>;
  /** Per-row x shift (map row → px): a drawn shear, whole pixels only. */
  rowShift?: (row: number) => number;
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
      const px = ox + i + sx;
      const py = oy + j;
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

// ------------------------------------------------------------------ compositing

/**
 * Paint `top` over `base`. Pixels of `base` right of / below `top` (in the shadow it throws, the
 * key light being upper left) step `shade` tones darker: the contact seam between two parts.
 */
export function composite(base: PixelCanvas, top: PixelCanvas, shade = 1): void {
  if (shade) {
    const ch: [number, number, number][] = [];
    for (let y = 0; y < base.h; y++)
      for (let x = 0; x < base.w; x++) {
        if (top.isOpaque(x, y)) continue;
        const c = base.get(x, y);
        if (c === null) continue;
        if (top.isOpaque(x - 1, y) || top.isOpaque(x, y - 1)) ch.push([x, y, stepColor(c, -shade)]);
      }
    for (const [x, y, c] of ch) base.set(x, y, c);
  }
  base.blit(top, 0, 0);
}

/** Draw with `fn` on a scratch canvas, keep only what lands on the opaque pixels of `q`. */
export function clip(q: PixelCanvas, fn: (t: PixelCanvas) => void): void {
  const t = new PixelCanvas(q.w, q.h);
  fn(t);
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      if (!q.isOpaque(x, y)) continue;
      const c = t.get(x, y);
      if (c !== null) q.set(x, y, c);
    }
}

/**
 * Row-span banding: u = 0..1 across each row's opaque span (left → right), v = 0..1 down the
 * part's bounds. `fn` returns the tone (or null to keep the pixel).
 */
export function bands(q: PixelCanvas, fn: (u: number, v: number, x: number, y: number, span: number) => number | null): void {
  const b = q.bounds();
  if (!b) return;
  const src = q.clone();
  for (let y = b.y; y < b.y + b.h; y++) {
    let xl = -1;
    let xr = -1;
    for (let x = b.x; x < b.x + b.w; x++)
      if (src.isOpaque(x, y)) {
        if (xl < 0) xl = x;
        xr = x;
      }
    if (xl < 0) continue;
    const span = Math.max(1, xr - xl);
    const v = (y - b.y) / Math.max(1, b.h - 1);
    for (let x = xl; x <= xr; x++) {
      if (!src.isOpaque(x, y)) continue;
      const c = fn((x - xl) / span, v, x, y, span + 1);
      if (c !== null) q.set(x, y, c);
    }
  }
}

/** Recolour the pixels of `q` whose neighbour in direction (dx, dy) is empty. */
export function edge(q: PixelCanvas, dx: number, dy: number, fn: (c: number) => number): void {
  const src = q.clone();
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      const c = src.get(x, y);
      if (c !== null && !src.isOpaque(x + dx, y + dy)) q.set(x, y, fn(c));
    }
}

/** Lonely pixels (no 4-neighbour of their colour, ≥3 neighbours of one other) adopt that colour. */
export function despeckle(q: PixelCanvas, keep?: (c: number) => boolean): void {
  const src = q.clone();
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      const c = src.get(x, y);
      if (c === null || keep?.(c)) continue;
      const n = [src.get(x - 1, y), src.get(x + 1, y), src.get(x, y - 1), src.get(x, y + 1)].filter((v): v is number => v !== null);
      if (n.length < 3 || n.includes(c)) continue;
      const counts = new Map<number, number>();
      for (const v of n) counts.set(v, (counts.get(v) ?? 0) + 1);
      let best = c;
      let bc = 0;
      for (const [v, k] of counts) if (k > bc) [best, bc] = [v, k];
      if (bc >= 3 || (bc >= 2 && n.length === 3)) q.set(x, y, best);
    }
}

// ------------------------------------------------------------------ folds

/**
 * One fold of a cloth: a crease along `pts` (top → bottom, y increasing). Per row: `ridge` px left
 * of the crease bulge toward the light (+lift tones), the crease itself sinks `deep` tones, and a
 * shadow wedge right of it (`w0` px at the top → `w1` at the bottom) sinks one tone. Pixels are only
 * recoloured where `q` is opaque, so the fold follows the cloth's own bands.
 */
export interface FoldBand {
  pts: readonly V2[];
  ridge: number;
  lift: number;
  deep: number;
  w0: number;
  w1: number;
  /** Rows at the top where the fold fades in (no ridge, crease only one tone deep). */
  fade?: number;
}

export function foldBands(q: PixelCanvas, folds: readonly FoldBand[]): void {
  const src = q.clone();
  const out = new Map<number, number>();
  for (const f of folds) {
    const y0 = Math.round(f.pts[0][1]);
    const y1 = Math.round(f.pts[f.pts.length - 1][1]);
    for (let y = y0; y <= y1; y++) {
      // crease x at this row (linear along the polyline)
      let cx = f.pts[0][0];
      for (let i = 1; i < f.pts.length; i++) {
        const [ax, ay] = f.pts[i - 1];
        const [bx, by] = f.pts[i];
        if (y + 0.5 >= ay && y + 0.5 <= by + 1e-6) {
          cx = by > ay ? lerp(ax, bx, (y + 0.5 - ay) / (by - ay)) : bx;
          break;
        }
        if (y + 0.5 > by) cx = bx;
      }
      const x0 = Math.round(cx);
      const t = y1 > y0 ? (y - y0) / (y1 - y0) : 1;
      const fading = f.fade !== undefined && y - y0 < f.fade;
      const w = Math.round(lerp(f.w0, f.w1, t));
      const put = (x: number, n: number) => {
        const c = src.get(x, y);
        if (c === null) return;
        const k = y * q.w + x;
        if (!out.has(k)) out.set(k, stepColor(c, n));
      };
      put(x0, fading ? -1 : -f.deep);
      if (!fading) for (let i = 1; i <= f.ridge; i++) put(x0 - i, f.lift);
      for (let i = 1; i <= w; i++) put(x0 + i, -1);
    }
  }
  for (const [k, c] of out) q.set(k % q.w, Math.floor(k / q.w), c);
}

// ------------------------------------------------------------------ outline + rim

/**
 * The single exterior outline. Bottom and front (right) edges, and every edge at or below
 * `groundY`, take the colour's ink (the universal ink); top and back (left) edges take the colour's
 * lit line — a darker tone of its own ramp — so the lit silhouette stays soft. `pick` may override
 * a pixel ('top' = the sprite lies below it, 'back' = to its right) and returns null for the default.
 */
export function selectiveOutline(p: PixelCanvas, groundY: number, pick?: (x: number, y: number, side: 'top' | 'back', nb: number) => number | null): void {
  const add: [number, number, number][] = [];
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      if (p.isOpaque(x, y)) continue;
      const up = p.get(x, y - 1);
      const left = p.get(x - 1, y);
      const down = p.get(x, y + 1);
      const right = p.get(x + 1, y);
      if (up === null && left === null && down === null && right === null) continue;
      let c: number;
      if (up !== null || left !== null || y >= groundY) c = info(up ?? left ?? down ?? right)?.ink ?? C_INK.ink;
      else if (down !== null) c = pick?.(x, y, 'top', down) ?? info(down)?.lit ?? C_INK.ink;
      else c = pick?.(x, y, 'back', right!) ?? info(right)?.lit ?? C_INK.ink;
      add.push([x, y, c]);
    }
  for (const [x, y, c] of add) p.set(x, y, c);
}

/**
 * The neon rim: body pixels on the FRONT (right) silhouette edge — away from the key light — lift
 * to the void glow (`rim(c)`); only runs of ≥2 connected candidates are kept, so it never leaves a
 * stray dot. Call before the outline (the candidates are pixels whose right neighbour is empty).
 */
export function rimPass(p: PixelCanvas, rim: (c: number, x: number, y: number) => number | null): void {
  const W = p.w;
  const H = p.h;
  const cand = new Int32Array(W * H).fill(-1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = p.get(x, y);
      if (c === null || p.isOpaque(x + 1, y) || !p.isOpaque(x - 1, y)) continue;
      const r = rim(c, x, y);
      if (r !== null) cand[y * W + x] = r;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const r = cand[y * W + x];
      if (r < 0) continue;
      let run = false;
      for (let dy = -1; dy <= 1 && !run; dy += 2) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -1; dx <= 1; dx++) if (x + dx >= 0 && x + dx < W && cand[yy * W + x + dx] >= 0) run = true;
      }
      if (run) p.set(x, y, r);
    }
}

// ------------------------------------------------------------------ misc

export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Integer pixels of a straight line (Bresenham), start → end. */
export function linePx(x0: number, y0: number, x1: number, y1: number): V2[] {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const out: V2[] = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push([x0, y0]);
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
  return out;
}

/** Points of a quadratic / cubic Bézier. */
export function bez(p0: V2, p1: V2, p2: V2, p3: V2 | null, n: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    if (p3) out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
    else out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
  }
  return out;
}

/** 2-bone IK: the elbow for shoulder s → hand h with bone lengths l1, l2 (bend ±1). */
export function ik(s: V2, h: V2, l1: number, l2: number, bend: 1 | -1): V2 {
  const dx = h[0] - s[0];
  const dy = h[1] - s[1];
  const d = Math.max(0.01, Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01));
  const a = Math.atan2(dy, dx);
  const ca = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const ang = a + bend * Math.acos(clamp(ca, -1, 1));
  return [s[0] + Math.cos(ang) * l1, s[1] + Math.sin(ang) * l1];
}
