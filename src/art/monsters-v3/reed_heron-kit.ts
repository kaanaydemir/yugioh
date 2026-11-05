// Sazlık Balıkçılı v3 — small drawing kit for the wader rig: part compositing limited to a part's box, flat value
// planes measured from a part's own edges toward / away from the key light, polygon helpers and a hash.
// Pure and Phaser-free; no module state (everything is a parameter), so the boot-time import costs nothing.

import { PixelCanvas } from '../pixel';
import type { Light } from '../rigkit';

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

/** Steps from (x, y) along (sx, sy) that stay inside q's opaque mask (0 = the next pixel is out). */
export function run(q: PixelCanvas, x: number, y: number, sx: number, sy: number, cap: number): number {
  let d = 0;
  while (d < cap && q.isOpaque(x + sx * (d + 1), y + sy * (d + 1))) d++;
  return d;
}

export interface Tones {
  /** lit plane (toward the key light and the top) */
  L: number;
  /** body tone */
  M: number;
  /** shade plane (away from the light, the underside) */
  S: number;
}

/**
 * Flat three-band planes (REHBER IŞ-3): a lit band of `litW` px toward the key light (screen top-left as drawn for
 * P1, top-right for the P2 relight sheet), `top` px along the top edge, a shade band of `shW` px away from the light
 * and `bottom` px along the underside; everything else the body tone. Chosen on a snapshot, so bands never feed on
 * themselves. Visits only the part's box.
 */
export function bands(q: PixelCanvas, t: Tones, light: Light, litW = 2, shW = 2, o: { top?: number; bottom?: number } = {}): void {
  const b = boxOf(q);
  if (!b) return;
  const src = q.clone();
  const ls = light.side;
  const top = o.top ?? 1;
  const bottom = o.bottom ?? 1;
  for (let y = b.y0; y <= b.y1; y++)
    for (let x = b.x0; x <= b.x1; x++) {
      if (!src.isOpaque(x, y)) continue;
      const toLight = Math.min(run(src, x, y, ls, -1, litW + 1), run(src, x, y, ls, 0, litW + 1) + 1);
      const up = run(src, x, y, 0, -1, top + 1);
      let c = t.M;
      if (up < top || toLight < litW) c = t.L;
      else {
        const away = Math.min(run(src, x, y, -ls, 1, shW + 1), run(src, x, y, -ls, 0, shW + 1) + 1);
        const dn = run(src, x, y, 0, 1, bottom + 1);
        if (dn < bottom || away < shW) c = t.S;
      }
      q.set(x, y, c);
    }
}

/** Part compositor: each part is laid over the frame; `out` draws a 1-px separation where it overlaps earlier parts. */
export class Comp {
  readonly p: PixelCanvas;
  readonly id: Uint8Array;
  constructor(p: PixelCanvas) {
    this.p = p;
    this.id = new Uint8Array(p.w * p.h);
  }
  add(q: PixelCanvas, part: number, o: { out?: number; skip?: readonly number[] } = {}): void {
    const { p, id } = this;
    const W = p.w;
    const b = boxOf(q, 1);
    if (!b) return;
    const outs: number[] = [];
    if (o.out !== undefined)
      for (let y = b.y0; y <= b.y1; y++)
        for (let x = b.x0; x <= b.x1; x++) {
          if (q.isOpaque(x, y) || !p.isOpaque(x, y)) continue;
          if (o.skip && o.skip.includes(id[y * W + x])) continue;
          if (q.isOpaque(x - 1, y) || q.isOpaque(x + 1, y) || q.isOpaque(x, y - 1) || q.isOpaque(x, y + 1)) outs.push(x, y);
        }
    for (let i = 0; i < outs.length; i += 2) p.set(outs[i], outs[i + 1], o.out!);
    for (let y = b.y0; y <= b.y1; y++)
      for (let x = b.x0; x <= b.x1; x++) {
        const c = q.get(x, y);
        if (c === null) continue;
        p.set(x, y, c);
        id[y * W + x] = part;
      }
  }
}

/** Darken (one step along `step`) the pixels of dst under the mask of `caster` shifted by (dx, dy) — a cast shadow
 * painted only on existing pixels of the listed parts (IŞ-6). */
export function castOn(comp: Comp, caster: PixelCanvas, dx: number, dy: number, parts: readonly number[], step: (c: number) => number): void {
  const b = boxOf(caster);
  if (!b) return;
  const { p, id } = comp;
  for (let y = b.y0; y <= b.y1; y++)
    for (let x = b.x0; x <= b.x1; x++) {
      if (!caster.isOpaque(x, y)) continue;
      const tx = x + dx;
      const ty = y + dy;
      if (!p.inBounds(tx, ty) || caster.isOpaque(tx, ty)) continue;
      if (!parts.includes(id[ty * p.w + tx])) continue;
      const c = p.get(tx, ty);
      if (c !== null) p.set(tx, ty, step(c));
    }
}

/** Integer hash in [0, 1). */
export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Linear interpolation of two polygons with the same vertex count. */
export function mixPoly(a: readonly Pt[], b: readonly Pt[], t: number): Pt[] {
  if (t <= 0) return a.slice();
  if (t >= 1) return b.slice();
  return a.map((p, i) => [p[0] + (b[i][0] - p[0]) * t, p[1] + (b[i][1] - p[1]) * t] as Pt);
}

/** Offset a polygon. */
export const shift = (pts: readonly Pt[], dx: number, dy: number): Pt[] => pts.map(([x, y]) => [x + dx, y + dy] as Pt);

/** Cubic Bézier sampled every ~0.5 px. */
export function bezier(a: Pt, b: Pt, c: Pt, d: Pt): Pt[] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - b[0], c[1] - b[1]) + Math.hypot(d[0] - c[0], d[1] - c[1]);
  const n = Math.max(4, Math.ceil(len * 2));
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([
      u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
      u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
    ]);
  }
  return out;
}

/** Fill a thick path: discs of radius r(t) stamped along the samples (t = 0…1 along the path). */
export function fatPath(q: PixelCanvas, path: readonly Pt[], r: (t: number) => number, c: number): void {
  const n = path.length - 1 || 1;
  path.forEach(([x, y], i) => q.disc(x, y, r(i / n), c));
}

export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
