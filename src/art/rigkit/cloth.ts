// rigkit / cloth — cloth shaded by flat value planes measured from the part's own edges
// (the magus technique; A3_MIMARI §2; REHBER IŞ-3, IŞ-7).
//
// COPIED from the slice (abyss_magus-rig.ts run / spans / widenTeeth / sleevePoly / distPoly) and
// generalised to any frame size; planes() and edgeRim() are the loops the magus writes inline for
// every cloth part (cape, skirt, sleeves, tabard): a snapshot of the part's mask, a tone per opaque
// pixel chosen from distances to its edges, then a 1-px turned edge just outside the lit side.
// (Y2 proof: the magus' cape and back-sleeve loops rewritten as planes() / edgeRim() calls render
// every slice frame byte-identically — shots/v3/a3/y2/fidelity.txt.)

import type { PixelCanvas } from '../pixel';
import { lerp, type V } from './geom';

/** Steps from (x, y) along (sx, sy) that stay inside q's opaque mask (0 = the next pixel is out). */
export function run(q: PixelCanvas, x: number, y: number, sx: number, sy: number, cap: number): number {
  let d = 0;
  while (d < cap && q.isOpaque(x + sx * (d + 1), y + sy * (d + 1))) d++;
  return d;
}

/** Leftmost / rightmost opaque x of each row of q (−1 when the row is empty). */
export function spans(q: PixelCanvas): { l: Int16Array; r: Int16Array } {
  const W = q.w;
  const H = q.h;
  const l = new Int16Array(H).fill(-1);
  const r = new Int16Array(H).fill(-1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (q.isOpaque(x, y)) {
        if (l[y] < 0) l[y] = x;
        r[y] = x;
      }
  return { l, r };
}

/**
 * Hem teeth at least 2 px wide: every pixel of q from row y0 down with no opaque left or right
 * neighbour (a 1-px tip or sliver) gets a twin beside it, on the side the row above leans to (the
 * silhouette only grows; the twin takes the pixel's own colour), top row first.
 */
export function widenTeeth(q: PixelCanvas, y0: number): void {
  const W = q.w;
  const H = q.h;
  for (let y = Math.max(1, y0); y < H; y++)
    for (let x = 1; x < W - 1; x++) {
      const c = q.get(x, y);
      if (c === null || q.isOpaque(x - 1, y) || q.isOpaque(x + 1, y)) continue;
      const side = q.isOpaque(x + 1, y - 1) ? 1 : q.isOpaque(x - 1, y - 1) ? -1 : run(q, x, y - 1, 1, 0, 3) >= run(q, x, y - 1, -1, 0, 3) ? 1 : -1;
      q.set(x + side, y, c);
    }
}

/**
 * Outline polygon of a bell sleeve along shoulder → elbow → cuff with widths w0 / w1 / w2, widening,
 * with a drooping underside (`droop` px) that lags (`lag` px) behind the arm's motion.
 */
export function sleevePoly(s: V, e: V, c: V, w0: number, w1: number, w2: number, droop: number, lag: number): V[] {
  const pts = [s, e, c];
  const ws = [w0, w1, w2];
  const up: V[] = [];
  const dn: V[] = [];
  for (let i = 0; i < 3; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(2, i + 1)];
    let ux = b[0] - a[0];
    let uy = b[1] - a[1];
    const l = Math.hypot(ux, uy) || 1;
    ux /= l;
    uy /= l;
    let nx = -uy;
    let ny = ux;
    if (ny < 0 || (ny === 0 && nx < 0)) {
      nx = -nx;
      ny = -ny;
    }
    const h = ws[i] / 2;
    up.push([pts[i][0] - nx * h, pts[i][1] - ny * h]);
    dn.push([pts[i][0] + nx * h, pts[i][1] + ny * h]);
  }
  const hang: V = [dn[2][0] - 1.5 + lag, dn[2][1] + droop];
  const hang2: V = [lerp(dn[1][0], dn[2][0], 0.45) + lag * 0.5, lerp(dn[1][1], dn[2][1], 0.45) + droop * 0.55];
  return [up[0], up[1], up[2], dn[2], hang, hang2, dn[1], dn[0]];
}

/** Distance from (x, y) to a polyline — the cloth band measure (the magus' distPoly). */
export function edgeDist(x: number, y: number, pts: readonly V[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const vx = bx - ax;
    const vy = by - ay;
    const l2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / l2));
    best = Math.min(best, Math.hypot(x - (ax + vx * t), y - (ay + vy * t)));
  }
  return best;
}

/**
 * Flat cloth planes: for every opaque pixel of q (judged on a snapshot `src` of its mask, taken
 * before any change), `tone(x, y, src)` picks its colour (null = leave the pixel). Use run(),
 * edgeDist() and spans() on `src` to measure bands from the part's edges. Returns the snapshot.
 */
export function planes(q: PixelCanvas, tone: (x: number, y: number, src: PixelCanvas) => number | null): PixelCanvas {
  const src = q.clone();
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      if (!src.isOpaque(x, y)) continue;
      const c = tone(x, y, src);
      if (c !== null) q.set(x, y, c);
    }
  return src;
}

/**
 * The cloth's turned edge (IŞ-7): one pixel just outside the row span of `src` on `side`
 * ('left' = before the leftmost pixel, as the magus' cape for the P1 light), rows y0…y1, coloured by
 * `col(y)`.
 */
export function edgeRim(q: PixelCanvas, src: PixelCanvas, side: 'left' | 'right', y0: number, y1: number, col: (y: number) => number): void {
  const sp = spans(src);
  for (let y = Math.max(0, y0); y <= Math.min(q.h - 1, y1); y++) {
    if (sp.l[y] < 0) continue;
    q.set(side === 'left' ? sp.l[y] - 1 : sp.r[y] + 1, y, col(y));
  }
}
