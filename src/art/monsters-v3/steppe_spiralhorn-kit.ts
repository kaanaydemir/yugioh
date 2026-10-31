// Bozkır Boynuzlusu v3 — drawing kit of the saiga rig: box-limited compositing (the part-id buffer the light passes
// read), flat value planes measured from a part's own edges (IŞ-3: lit band toward the key light and the top, shade
// band away from it and at the bottom — never a gradient, never dither), a deterministic hash and small geometry.
// Pure and Phaser-free; no module state.

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

/** A tone per opaque pixel chosen on a snapshot (the part's own silhouette), visiting only the part's box. */
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

/** Frame + part-id buffer; add() lays a part over the frame with optional 1-px separation lines (IŞ-5 seams). */
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
  /** Part that owns a pixel (0 = none / outside). */
  at(x: number, y: number): number {
    const { p } = this;
    if (x < 0 || y < 0 || x >= p.w || y >= p.h) return 0;
    return this.id[y * p.w + x];
  }
}

export interface Tones {
  L: number;
  M: number;
  S: number;
  D: number;
}

export interface BandOpts {
  /** lit band: rows from the top edge, columns from the edge toward the light, diagonal (up + toward light) */
  top?: number;
  lit?: number;
  diag?: number;
  /** shade band: rows from the bottom edge, columns from the edge away from the light */
  bottom?: number;
  away?: number;
  /** a 4th tone (D) under the shade band: rows from the bottom edge */
  deep?: number;
}

/**
 * Flat planes measured from the part's own silhouette (IŞ-3): L toward the light and the top, S away from it and at
 * the bottom, D the last rows facing the floor, M elsewhere. `light.side` = −1 when the key light is at the frame's left.
 */
export function bands(q: PixelCanvas, t: Tones, light: Light, o: BandOpts = {}): void {
  const ls = light.side;
  // the P2 relight's value lift (rigkit P2_LIFT_A2 in band form): the relit side shows the front, turned a little
  // away from the light — one more lit column keeps P2 as bright as P1
  const lift = light.lift > 0 ? 1 : 0;
  const top = o.top ?? 2;
  const lit = (o.lit ?? 2) + (o.lit ? lift : 0);
  const diag = o.diag ?? 0;
  const bottom = o.bottom ?? 2;
  const away = o.away ?? 2;
  const deep = o.deep ?? 0;
  planes(q, (x, y, src) => {
    const dn = run(src, x, y, 0, 1, Math.max(bottom, deep) + 1);
    if (deep > 0 && dn < deep) return t.D;
    const up = run(src, x, y, 0, -1, top + 1);
    const tl = run(src, x, y, ls, 0, lit + 1);
    const dg = diag > 0 ? run(src, x, y, ls, -1, diag + 1) : 99;
    if (up < top || tl < lit || dg < diag) return t.L;
    const aw = run(src, x, y, -ls, 0, away + 1);
    if (dn < bottom || aw < away) return t.S;
    return t.M;
  });
}

export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** A tube (thick segment) as a polygon with square ends. */
export function tube(a: Pt, b: Pt, w0: number, w1 = w0, extA = 0, extB = 0): Pt[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const a2: Pt = [a[0] - ux * extA, a[1] - uy * extA];
  const b2: Pt = [b[0] + ux * extB, b[1] + uy * extB];
  return [
    [a2[0] - uy * (w0 / 2), a2[1] + ux * (w0 / 2)],
    [b2[0] - uy * (w1 / 2), b2[1] + ux * (w1 / 2)],
    [b2[0] + uy * (w1 / 2), b2[1] - ux * (w1 / 2)],
    [a2[0] + uy * (w0 / 2), a2[1] - ux * (w0 / 2)],
  ];
}

/** Rotate a point about the origin (degrees), then translate. */
export function rt(p: Pt, deg: number, ox: number, oy: number): Pt {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [ox + p[0] * c - p[1] * s, oy + p[0] * s + p[1] * c];
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const rnd = Math.round;
