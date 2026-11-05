// Çamur Pençe Ruhu v3 — small drawing kit of the mud rig: bounding-box compositor + flat value planes (copies of the
// steel_silencer-kit loops, kept local so the card owns them), tube / blob primitives, a deterministic hash.

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

/** An ellipsoid blob of a soft body (mud): centre, radii. */
export interface Blob {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/**
 * Flat value planes of a union of blobs (G-buffer style): each pixel takes the normal of the blob it is deepest in,
 * the normal · key light picks one of three flat tones (+ an optional wet highlight in the hottest spot). The bands
 * follow the round masses (lumps read as lumps) and stay flat-toned: no gradient, no dither.
 */
export function blobShade(q: PixelCanvas, blobs: readonly Blob[], t: Tones, light: Light, opt: { hi?: number; hiAt?: number; lit?: number; shade?: number } = {}): void {
  const [lx, ly, lz] = light.v;
  const litT = opt.lit ?? 0.42;
  const shT = opt.shade ?? -0.12;
  planes(q, (x, y) => {
    let best = -Infinity;
    let nx = 0;
    let ny = 0;
    for (const b of blobs) {
      const dx = (x + 0.5 - b.x) / b.rx;
      const dy = (y + 0.5 - b.y) / b.ry;
      const k = 1 - (dx * dx + dy * dy);
      if (k > best) {
        best = k;
        nx = dx;
        ny = dy;
      }
    }
    const d2 = nx * nx + ny * ny;
    const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, d2)));
    const dot = nx * lx + ny * ly + nz * lz;
    if (opt.hi !== undefined && dot > (opt.hiAt ?? 0.93)) return opt.hi;
    return dot > litT ? t.L : dot > shT ? t.M : t.S;
  });
}
