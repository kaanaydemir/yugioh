// Uçurtma Eskrimci v3 — small drawing kit of the kite-fencer rig: a bounding-box part compositor, flat value planes
// measured from a part's own edges (IŞ-3), smooth paths, and the tone sets of the card's materials (unbleached linen
// suit, kite cloth in gold / fire panels, bamboo spars, the steel rapier). Pure, deterministic, palette only.
// (The compositor and the planes loop follow the grave-knight kit's pattern; copied, not imported, so this card owns
// its own drawing code.)

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

/** Box of the opaque pixels of q grown by `pad` (clamped); null when empty. */
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

// Layers are pooled: a part is painted on a clean frame-sized canvas, laid on the frame by Comp.add(), which clears the
// part's box and gives the canvas back. Nothing is allocated at module load (boot cost: the glob imports this file).
const POOL: PixelCanvas[] = [];
export function layer(w: number, h: number): PixelCanvas {
  const q = POOL.pop();
  if (q && q.w === w && q.h === h) return q;
  return new PixelCanvas(w, h);
}
export function release(q: PixelCanvas): void {
  const b = boxOf(q);
  if (b) clearBox(q, b);
  POOL.push(q);
}
function clearBox(q: PixelCanvas, b: Box): void {
  const { w, data } = q;
  for (let y = b.y0; y <= b.y1; y++) data.fill(0, (y * w + b.x0) * 4, (y * w + b.x1 + 1) * 4);
}
let SNAP: PixelCanvas | null = null;

/** A tone per opaque pixel chosen on a snapshot of the part's mask (visits only its box). */
export function planes(q: PixelCanvas, tone: (x: number, y: number, src: PixelCanvas) => number | null): void {
  const b = boxOf(q);
  if (!b) return;
  if (!SNAP || SNAP.w !== q.w || SNAP.h !== q.h) SNAP = new PixelCanvas(q.w, q.h);
  const src = SNAP;
  const pad = 4;
  const bb: Box = { x0: Math.max(0, b.x0 - pad), y0: Math.max(0, b.y0 - pad), x1: Math.min(q.w - 1, b.x1 + pad), y1: Math.min(q.h - 1, b.y1 + pad) };
  for (let y = bb.y0; y <= bb.y1; y++) src.data.set(q.data.subarray((y * q.w + bb.x0) * 4, (y * q.w + bb.x1 + 1) * 4), (y * q.w + bb.x0) * 4);
  for (let y = b.y0; y <= b.y1; y++)
    for (let x = b.x0; x <= b.x1; x++) {
      if (!src.isOpaque(x, y)) continue;
      const c = tone(x, y, src);
      if (c !== null) q.set(x, y, c);
    }
  clearBox(src, bb);
}

/** The frame being drawn plus a part-id buffer; add() lays a part over it with optional separation lines. */
export class Comp {
  readonly p: PixelCanvas;
  readonly id: Uint8Array;
  constructor(p: PixelCanvas) {
    this.p = p;
    this.id = new Uint8Array(p.w * p.h);
  }
  /** Lay part `q` over the frame, then clear it and return it to the pool (a part is added once). */
  add(q: PixelCanvas, part: number, o: SepOpts = {}): void {
    const { p, id } = this;
    const W = p.w;
    const b = boxOf(q, 1);
    if (!b) {
      POOL.push(q);
      return;
    }
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
    clearBox(q, b);
    POOL.push(q);
  }
}

// ---------------------------------------------------------------- materials

export interface Tones {
  /** lit plane, mid plane, shade plane, deep crease / seam */
  L: number;
  M: number;
  S: number;
  D: number;
}

/** Unbleached linen (suit, mask): the near side. §0.4.4: never white — that is the heron's plumage. */
export const LINEN: Tones = { L: PAL.earth4, M: PAL.earth3, S: PAL.earth2, D: PAL.earth1 };
/** The far side of the body, one value step down. */
export const LINEN_FAR: Tones = { L: PAL.earth3, M: PAL.earth2, S: PAL.earth1, D: PAL.earth0 };
/** Soft fencing shoes and the glove: dark leather. */
export const SHOE: Tones = { L: PAL.earth2, M: PAL.earth1, S: PAL.earth0, D: PAL.ink };
/** Kite panels: gold pair (top-left, bottom-right) and fire pair (top-right, bottom-left); D = spar shadow seen through. */
export const PANEL_GOLD: Tones = { L: PAL.gold3, M: PAL.gold3, S: PAL.gold2, D: PAL.gold1 };
export const PANEL_FIRE: Tones = { L: PAL.fire3, M: PAL.fire3, S: PAL.fire2, D: PAL.fire1 };
/** Lit (hitMagic) panels: every panel one step brighter. */
export const PANEL_GOLD_HOT: Tones = { L: PAL.gold4, M: PAL.gold4, S: PAL.gold3, D: PAL.gold2 };
export const PANEL_FIRE_HOT: Tones = { L: PAL.fire4, M: PAL.fire4, S: PAL.fire3, D: PAL.fire2 };
/** Bamboo spars. */
export const SPAR_LIT = PAL.earth3;
export const SPAR = PAL.earth2;
/** Rapier: blade, underside, bell, bell rim. */
export const BLADE = PAL.stone4;
export const BLADE_UNDER = PAL.mist;
export const BELL = PAL.stone3;
export const BELL_RIM = PAL.gold2;
/** Mask ribbons. */
export const RIBBON: Tones = { L: PAL.fire3, M: PAL.fire3, S: PAL.fire2, D: PAL.fire1 };
/** The kite string and its tail bows. */
export const STRING = PAL.earth4;
export const BOW_A = PAL.gold2;
export const BOW_B = PAL.fire2;

/**
 * Flat three-band planes (IŞ-3): the band toward the key light, the shade band away from it, the mid tone between;
 * `top` / `bottom` are the widths of the lit upper and shaded lower edge.
 */
export function bands(q: PixelCanvas, t: Tones, light: Light, litW = 2, shW = 2, opt: { top?: number; bottom?: number } = {}): void {
  const ls = light.side;
  const top = opt.top ?? 1;
  const bottom = opt.bottom ?? 1;
  planes(q, (x, y, src) => {
    const toLight = Math.min(run(src, x, y, ls, -1, litW + 1), run(src, x, y, ls, 0, litW + 1) + 1);
    const up = run(src, x, y, 0, -1, top + 1);
    if (up < top || toLight < litW) return t.L;
    const away = Math.min(run(src, x, y, -ls, 1, shW + 1), run(src, x, y, -ls, 0, shW + 1) + 1);
    const dn = run(src, x, y, 0, 1, bottom + 1);
    if (dn < bottom || away < shW) return t.S;
    return t.M;
  });
}

// ---------------------------------------------------------------- paths

/** A smooth path through points (Catmull-Rom → polyline). */
export function spline(pts: readonly Pt[], n = 8): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** The closed polygon of a tapered ribbon along `path` (width profile w(t)). */
export function ribbon(path: readonly Pt[], w: (t: number) => number): Pt[] {
  const a: Pt[] = [];
  const b: Pt[] = [];
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    const q = path[Math.min(path.length - 1, i + 1)];
    const r = path[Math.max(0, i - 1)];
    let tx = q[0] - r[0];
    let ty = q[1] - r[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    const h = w(i / (path.length - 1)) / 2;
    a.push([p[0] - ty * h, p[1] + tx * h]);
    b.push([p[0] + ty * h, p[1] - tx * h]);
  }
  return [...a, ...b.reverse()];
}

/** A 1-px path through whole pixels (each step 8-connected), drawn with `c` (or per-point colour). */
export function path1(p: PixelCanvas, pts: readonly Pt[], c: number | ((i: number, n: number) => number)): void {
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const col = typeof c === 'number' ? c : c(i, n);
    p.line(Math.round(pts[i][0]), Math.round(pts[i][1]), Math.round(pts[i + 1][0]), Math.round(pts[i + 1][1]), col);
  }
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerpP = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
