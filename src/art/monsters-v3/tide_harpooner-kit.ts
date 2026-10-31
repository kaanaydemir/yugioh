// Kabuk Zıpkıncı v3 — small drawing helpers of the shell-carrier rig (bounding-box versions of the rigkit
// loops, own copies so this card depends on no other card's file). Pure, no top-level work.

import { PixelCanvas } from '../pixel';
import { DIR4, type SepOpts } from '../rigkit';

export type Pt = readonly [number, number];

export interface Tones {
  /** lit, mid, shade, deep */
  L: number;
  M: number;
  S: number;
  D: number;
}

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

/** Steps from (x, y) along (sx, sy) that stay inside q's opaque mask. */
export function run(q: PixelCanvas, x: number, y: number, sx: number, sy: number, cap: number): number {
  let d = 0;
  while (d < cap && q.isOpaque(x + sx * (d + 1), y + sy * (d + 1))) d++;
  return d;
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

/**
 * Flat value planes (IŞ-3) measured from the part's own edges: a lit band toward the key light (side `ls`,
 * -1 = left) and the top, a shade band away from it and at the bottom, a deep band (optional) under that.
 */
export function bands(q: PixelCanvas, t: Tones, ls: number, o: { lit?: number; top?: number; shade?: number; bottom?: number; deep?: number } = {}): void {
  const litW = o.lit ?? 3;
  const top = o.top ?? 2;
  const shW = o.shade ?? 2;
  const bottom = o.bottom ?? 2;
  const deep = o.deep ?? 0;
  planes(q, (x, y, src) => {
    const toLight = Math.min(run(src, x, y, ls, -1, litW + 1), run(src, x, y, ls, 0, litW + 1) + 1);
    const up = run(src, x, y, 0, -1, top + 1);
    if (up < top || toLight < litW) return t.L;
    const away = Math.min(run(src, x, y, -ls, 1, shW + deep + 1), run(src, x, y, -ls, 0, shW + deep + 1) + 1);
    const dn = run(src, x, y, 0, 1, bottom + deep + 1);
    if (deep > 0 && (dn < deep || away < deep)) return t.D;
    if (dn < bottom + deep || away < shW + deep) return t.S;
    return t.M;
  });
}

/** A tube (thick segment) as a polygon with square ends. */
export function tubePoly(a: Pt, b: Pt, w: number, extA = 0, extB = 0): Pt[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const nx = -uy * (w / 2);
  const ny = ux * (w / 2);
  const a2: Pt = [a[0] - ux * extA, a[1] - uy * extA];
  const b2: Pt = [b[0] + ux * extB, b[1] + uy * extB];
  return [[a2[0] + nx, a2[1] + ny], [b2[0] + nx, b2[1] + ny], [b2[0] - nx, b2[1] - ny], [a2[0] - nx, a2[1] - ny]];
}

/** A tapering segment polygon (width w0 at a, w1 at b). */
export function taperPoly(a: Pt, b: Pt, w0: number, w1: number): Pt[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l;
  const ny = dx / l;
  return [[a[0] + nx * w0 / 2, a[1] + ny * w0 / 2], [b[0] + nx * w1 / 2, b[1] + ny * w1 / 2], [b[0] - nx * w1 / 2, b[1] - ny * w1 / 2], [a[0] - nx * w0 / 2, a[1] - ny * w0 / 2]];
}

/** Polygon of an ellipse with semi axes a (along `ang`) and b, n points. */
export function ellPoly(cx: number, cy: number, a: number, b: number, ang = 0, n = 36): Pt[] {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = Math.cos(t) * a;
    const y = Math.sin(t) * b;
    out.push([cx + x * ca - y * sa, cy + x * sa + y * ca]);
  }
  return out;
}

/** Part composite with a part-id buffer; add() visits only the new part's box. */
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

export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Whole-pixel 2-px rope / line along a polyline: `top` on the lit upper pixel, `under` beneath. */
export function rope2(p: PixelCanvas, pts: readonly Pt[], top: number, under: number, mark?: (x: number, y: number) => void, tail?: { len: number; top: number; under: number }): void {
  // walk the polyline in unit steps, collect integer points (dedup)
  const cells: [number, number][] = [];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) {
      const x = Math.round(ax + ((bx - ax) * k) / n);
      const y = Math.round(ay + ((by - ay) * k) / n);
      const l = cells[cells.length - 1];
      if (!l || l[0] !== x || l[1] !== y) cells.push([x, y]);
    }
  }
  const N = cells.length;
  for (let i = 0; i < N; i++) {
    const [x, y] = cells[i];
    const wet = tail && i >= N - tail.len;
    const nx = cells[Math.min(N - 1, i + 1)];
    const px = cells[Math.max(0, i - 1)];
    const steep = Math.abs(nx[1] - px[1]) > Math.abs(nx[0] - px[0]);
    const t = wet ? tail!.top : top;
    const u = wet ? tail!.under : under;
    p.set(x, y, t);
    mark?.(x, y);
    if (steep) {
      if (!p.isOpaque(x + 1, y) || p.get(x + 1, y) !== t) {
        p.set(x + 1, y, u);
        mark?.(x + 1, y);
      }
    } else {
      p.set(x, y + 1, u);
      mark?.(x, y + 1);
    }
  }
}

/** Quadratic sag curve from a to b, `sag` px down at the middle and `side` px sideways (whole points). */
export function sagCurve(a: Pt, b: Pt, sag: number, side = 0, n = 14): Pt[] {
  const mx = (a[0] + b[0]) / 2 + side;
  const my = (a[1] + b[1]) / 2 + sag;
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * mx + t * t * b[0];
    const y = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * my + t * t * b[1];
    out.push([x, y]);
  }
  return out;
}
