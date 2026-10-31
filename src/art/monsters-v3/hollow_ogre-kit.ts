// Kovuk Devi v3 — small drawing kit of the hollow-log rig: bounding-box compositor + flat value planes (copies of the
// steel_silencer / mudgrasp kit loops, kept local so the card owns them), tube primitives, cylinder bands, twist
// seams for the root bundles, a deterministic hash.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { DIR4, run, type Light, type SepOpts } from '../rigkit';

export type Pt = readonly [number, number];

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Box of the opaque pixels of q, grown by `pad` (clamped); null when empty. */
export function boxOf(q: PixelCanvas, pad = 0): Box | null {
  const { w, h, data } = q;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4 + 3;
    for (let x = 0; x < w; x++)
      if (data[row + x * 4]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  }
  if (x1 < 0) return null;
  return { x0: Math.max(0, x0 - pad), y0: Math.max(0, y0 - pad), x1: Math.min(w - 1, x1 + pad), y1: Math.min(h - 1, y1 + pad) };
}

/** A tone per opaque pixel chosen on a snapshot, visiting only the part's box. */
export function planes(q: PixelCanvas, tone: (x: number, y: number, src: PixelCanvas) => number | null): PixelCanvas {
  const src = q.clone();
  const b = boxOf(q);
  if (!b) return src;
  for (let y = b.y0; y <= b.y1; y++)
    for (let x = b.x0; x <= b.x1; x++) {
      if (!src.isOpaque(x, y)) continue;
      const c = tone(x, y, src);
      if (c !== null) q.set(x, y, c);
    }
  return src;
}

/** Frame + part-id buffer; add() paints a part over the frame, with an optional crease on what it covers. */
export class Comp {
  readonly p: PixelCanvas;
  readonly id: Uint8Array;
  constructor(p: PixelCanvas) {
    this.p = p;
    this.id = new Uint8Array(p.w * p.h);
  }
  add(q: PixelCanvas, part: number, o: SepOpts = {}): void {
    const { p, id } = this;
    const W = p.w;
    const b = boxOf(q, 1);
    if (!b) return;
    const outs: number[] = [];
    const ins: number[] = [];
    for (let y = b.y0; y <= b.y1; y++)
      for (let x = b.x0; x <= b.x1; x++) {
        const qo = q.isOpaque(x, y);
        if (!qo) {
          if (o.out === undefined || !p.isOpaque(x, y)) continue;
          if (o.outSkip && o.outSkip.includes(id[y * W + x])) continue;
          if (q.isOpaque(x - 1, y) || q.isOpaque(x + 1, y) || q.isOpaque(x, y - 1) || q.isOpaque(x, y + 1)) outs.push(x, y);
          continue;
        }
        if (o.in === undefined) continue;
        for (const [dx, dy] of o.inDirs ?? DIR4)
          if (!q.isOpaque(x + dx, y + dy) && p.isOpaque(x + dx, y + dy)) {
            ins.push(x, y);
            break;
          }
      }
    for (let i = 0; i < outs.length; i += 2) p.set(outs[i], outs[i + 1], o.out!);
    for (let y = b.y0; y <= b.y1; y++)
      for (let x = b.x0; x <= b.x1; x++) {
        const c = q.get(x, y);
        if (c === null) continue;
        p.set(x, y, c);
        id[y * W + x] = part;
      }
    for (let i = 0; i < ins.length; i += 2) p.set(ins[i], ins[i + 1], o.in!);
  }
}

export interface Tones {
  L: number;
  M: number;
  S: number;
}

/**
 * Flat three-band planes (IŞ-3): a lit band toward the key light (and the top), a shade band away from it and at
 * the bottom, the body tone between. Bands are measured from the part's own edges (no gradient, no dither).
 */
export function bands(q: PixelCanvas, t: Tones, light: Light, litW = 2, shW = 2, opt: { top?: number; bottom?: number } = {}): void {
  const ls = light.side;
  const top = opt.top ?? 2;
  const bottom = opt.bottom ?? 2;
  planes(q, (x, y, src) => {
    const toLight = Math.min(run(src, x, y, ls, -1, litW + 1), run(src, x, y, ls, 0, litW + 1) + 1);
    const up = run(src, x, y, 0, -1, top + 1);
    if ((up < top && run(src, x, y, -ls, -1, 2) < 2) || toLight < litW) return t.L;
    const away = Math.min(run(src, x, y, -ls, 1, shW + 1), run(src, x, y, -ls, 0, shW + 1) + 1);
    const dn = run(src, x, y, 0, 1, bottom + 1);
    if (dn < bottom || away < shW) return t.S;
    return t.M;
  });
}

/** A tube (thick segment) as a polygon with square ends. */
export function tubePoly(a: Pt, b: Pt, w0: number, w1 = w0, extA = 0, extB = 0): Pt[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const a2: Pt = [a[0] - ux * extA, a[1] - uy * extA];
  const b2: Pt = [b[0] + ux * extB, b[1] + uy * extB];
  const n0x = -uy * (w0 / 2);
  const n0y = ux * (w0 / 2);
  const n1x = -uy * (w1 / 2);
  const n1y = ux * (w1 / 2);
  return [[a2[0] + n0x, a2[1] + n0y], [b2[0] + n1x, b2[1] + n1y], [b2[0] - n1x, b2[1] - n1y], [a2[0] - n0x, a2[1] - n0y]];
}

/** A tapering limb through a chain of points: tube segments + round joints. */
export function limb(q: PixelCanvas, pts: readonly Pt[], w0: number, w1: number, c: number): void {
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const wa = w0 + ((w1 - w0) * i) / n;
    const wb = w0 + ((w1 - w0) * (i + 1)) / n;
    q.poly(tubePoly(pts[i], pts[i + 1], wa, wb), c);
    if (i > 0) q.disc(Math.round(pts[i][0]), Math.round(pts[i][1]), Math.max(1, Math.round(wa / 2 - 0.5)), c);
  }
}

export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export const DEG = Math.PI / 180;
export const polar = (a: Pt, deg: number, r: number): Pt => [a[0] + Math.cos(deg * DEG) * r, a[1] + Math.sin(deg * DEG) * r];

/** one value step down on the earth / leaf ramps (creases, twist seams, cast shadows) */
export const DARKER: Readonly<Record<number, number>> = Object.freeze({
  [PAL.earth4]: PAL.earth3,
  [PAL.earth3]: PAL.earth2,
  [PAL.earth2]: PAL.earth1,
  [PAL.earth1]: PAL.earth0,
  [PAL.earth0]: PAL.earth0,
  [PAL.leaf2]: PAL.leaf1,
  [PAL.leaf1]: PAL.leaf0,
  [PAL.leaf0]: PAL.leaf0,
});

/**
 * Cylinder planes of a log measured per row across its own span (IŞ-3): the lit band on the key-light side, the
 * shade band on the far side, the body tone between; the top rows of each column are lit (the light is high).
 * `litU` / `shU` are span fractions. Flat bands, no gradient.
 */
export function cylBands(q: PixelCanvas, t: Tones, light: Light, litU = 0.3, shU = 0.72, top = 2): void {
  const b = boxOf(q);
  if (!b) return;
  const src = q.clone();
  for (let y = b.y0; y <= b.y1; y++) {
    let l = -1;
    let r = -1;
    for (let x = b.x0; x <= b.x1; x++) if (src.isOpaque(x, y)) { if (l < 0) l = x; r = x; }
    if (l < 0) continue;
    const span = Math.max(1, r - l);
    for (let x = l; x <= r; x++) {
      if (!src.isOpaque(x, y)) continue;
      let u = (x - l) / span;
      if (light.side > 0) u = 1 - u;
      const up = run(src, x, y, 0, -1, top + 1);
      q.set(x, y, up < top && u < 0.75 ? t.L : u < litU ? t.L : u > shU ? t.S : t.M);
    }
  }
}

/**
 * Twisted-strand seams of a root bundle: every `step` px along the chain a short diagonal line across the tube,
 * one value down, painted only over the mid / shade tones (the lit plane stays calm) and never on the tube's edge.
 */
export function twistSeams(q: PixelCanvas, pts: readonly Pt[], w: number, t: Tones, step = 4, phase = 0, slant = 0.7): void {
  let acc = phase;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < 0.5) continue;
    const ux = (b[0] - a[0]) / l;
    const uy = (b[1] - a[1]) / l;
    for (let s = acc; s < l; s += step) {
      const cx = a[0] + ux * s;
      const cy = a[1] + uy * s;
      const half = Math.max(1, w / 2 - 1);
      for (let k = -half; k <= half; k += 0.5) {
        const x = Math.round(cx - uy * k + ux * k * slant);
        const y = Math.round(cy + ux * k + uy * k * slant);
        const c = q.get(x, y);
        if (c === null || (c !== t.M && c !== t.S)) continue;
        if (!q.isOpaque(x - 1, y) || !q.isOpaque(x + 1, y) || !q.isOpaque(x, y - 1) || !q.isOpaque(x, y + 1)) continue;
        q.set(x, y, DARKER[c] ?? c);
      }
    }
    acc = (acc - l) % step;
    if (acc < 0) acc += step;
  }
}

/** Quadratic Bézier point. */
export function bez(a: Pt, b: Pt, c: Pt, t: number): Pt {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]];
}
