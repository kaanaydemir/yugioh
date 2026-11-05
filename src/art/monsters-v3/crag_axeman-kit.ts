// Kaya Baltacı v3 — small drawing kit of the "mountain barbarian" rig: a pooled bounding-box compositor, flat value
// planes measured from a part's own edges, paths (spline / ribbon), a rigid 2-D transform (the death halves are
// re-rasterised on tilted skeletons through it, never sprite-rotated) and the tone sets of the materials
// (skin, fur, stone axe, haft + vine, beard beads). Pure, deterministic; palette only.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { DIR4, run, type Light, type SepOpts } from '../rigkit';

export type Pt = readonly [number, number];

/** Frame 88×88; the anchor (AX, GY) is the floor point between the boots. */
export const W = 88;
export const H = 88;
/** Floor line: the lowest row of the boots. */
export const GY = 84;
/** Anchor x (between the boots). */
export const AX = 40;
/** The haft: grip → axe head centre (px). */
export const HAFT = 23;
/** The death seam's x (the body's centre line, groin to crown). */
export const SEAM_X = AX + 2;

/** A point on the axe head: u along the haft from the head centre, v toward the edge. */
export function axeUV(sk: { axe: Pt; dir: Pt; nrm: Pt }, u: number, v: number): Pt {
  const [ax, ay] = sk.axe;
  const n = sk.nrm;
  const d = sk.dir;
  return [ax + d[0] * u + n[0] * v, ay + d[1] * u + n[1] * v];
}

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

// Layers are pooled (lazily: nothing is allocated at import time — the module is in the boot glob).
const POOL: PixelCanvas[] = [];
export function layer(w: number, h: number): PixelCanvas {
  const q = POOL.pop();
  return q && q.w === w && q.h === h ? q : new PixelCanvas(w, h);
}
function clearBox(q: PixelCanvas, b: Box): void {
  const { w, data } = q;
  for (let y = b.y0; y <= b.y1; y++) data.fill(0, (y * w + b.x0) * 4, (y * w + b.x1 + 1) * 4);
}
export function release(q: PixelCanvas): void {
  q.clear();
  POOL.push(q);
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

/** Weathered skin: the lit mass of the arms and the face (the only skin user of lane C). */
export const SKIN: Tones = { L: PAL.skin4, M: PAL.skin3, S: PAL.skin2, D: PAL.skin1 };
export const SKIN_FAR: Tones = { L: PAL.skin3, M: PAL.skin2, S: PAL.skin1, D: PAL.skin0 };
/** Rough fur cloak: mid-dark, lit tufts earth3. */
export const FUR: Tones = { L: PAL.earth3, M: PAL.earth2, S: PAL.earth1, D: PAL.earth0 };
export const FUR_FAR: Tones = { L: PAL.earth2, M: PAL.earth1, S: PAL.earth0, D: PAL.ink };
/** Dark leather (breeches, belt, bracers, boots). */
export const HIDE: Tones = { L: PAL.earth2, M: PAL.earth1, S: PAL.earth0, D: PAL.ink };
/** Carved stone (the axe head: flat facets). */
export const ROCK: Tones = { L: PAL.stone4, M: PAL.stone3, S: PAL.stone2, D: PAL.stone1 };
export const ROCK_FAR: Tones = { L: PAL.stone3, M: PAL.stone2, S: PAL.stone1, D: PAL.stone0 };
/** The beard: stone braids. */
export const BEARD: Tones = { L: PAL.stone3, M: PAL.stone2, S: PAL.stone1, D: PAL.stone0 };
/** The haft. */
export const WOOD: Tones = { L: PAL.earth3, M: PAL.earth2, S: PAL.earth1, D: PAL.earth0 };
/** Dark legging cloth (stone-grey wool). */
export const WOOL: Tones = { L: PAL.stone2, M: PAL.stone1, S: PAL.stone0, D: PAL.ink };
export const WOOL_FAR: Tones = { L: PAL.stone1, M: PAL.stone0, S: PAL.stone0, D: PAL.ink };

/**
 * Flat three-band planes (IŞ-3): the band toward the key light, the shade band away from it, the mid tone
 * between; `top` / `bottom` are the widths of the lit upper and shaded lower edge.
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

// ---------------------------------------------------------------- paths and the rigid transform

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

/** A tube (thick segment) as a polygon with square ends. */
export function tube(a: Pt, b: Pt, w: number, extA = 0, extB = 0): Pt[] {
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

/** A rigid 2-D placement: rotate by `a` (rad, + = clockwise on screen) about (px, py), then move by (dx, dy). */
export interface Xf {
  a: number;
  px: number;
  py: number;
  dx: number;
  dy: number;
}
export const IDENT: Xf = { a: 0, px: 0, py: 0, dx: 0, dy: 0 };
export function xf(t: Xf, p: Pt): Pt {
  if (t.a === 0) return [p[0] + t.dx, p[1] + t.dy];
  const c = Math.cos(t.a);
  const s = Math.sin(t.a);
  const x = p[0] - t.px;
  const y = p[1] - t.py;
  return [t.px + x * c - y * s + t.dx, t.py + x * s + y * c + t.dy];
}
/** The inverse placement of a frame pixel centre (body space). */
export function xfInv(t: Xf, x: number, y: number): Pt {
  const X = x - t.dx - t.px;
  const Y = y - t.dy - t.py;
  if (t.a === 0) return [X + t.px, Y + t.py];
  const c = Math.cos(t.a);
  const s = Math.sin(t.a);
  return [t.px + X * c + Y * s, t.py - X * s + Y * c];
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Deterministic hash → [0, 1). */
export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
