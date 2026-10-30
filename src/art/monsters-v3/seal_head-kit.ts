// Mühürlü Baş (seal_head) v3 — drawing kit of the "gaze" rig: bounding-box compositor with pooled layers, flat value
// planes measured from a part's own edges, paths, and the three tone sets of the Beş Mühür set (obsidian, bronze, seal
// glow). Pure and deterministic; palette only. (Written for this piece; the set's shared kit is the ramps below.)

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
// part's box again and gives the canvas back.
const POOL: PixelCanvas[] = [];
export function layer(w: number, h: number): PixelCanvas {
  const q = POOL.pop();
  return q && q.w === w && q.h === h ? q : new PixelCanvas(w, h);
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

// ---------------------------------------------------------------- materials (Beş Mühür set ramps, palette only)

export interface Tones {
  /** edge run (light-facing corner), lit plane, mid plane, shadow plane, crease / seam */
  E: number;
  L: number;
  M: number;
  S: number;
  D: number;
}

/** Obsidian colossus stone: creases are violet-black void0 (not the Titan's night0), edge runs stone3. */
export const OBS: Tones = { E: PAL.stone3, L: PAL.stone2, M: PAL.stone1, S: PAL.stone0, D: PAL.void0 };
/** The far side of the stone, a value darker. */
export const OBS_FAR: Tones = { E: PAL.stone2, L: PAL.stone1, M: PAL.stone0, S: PAL.void0, D: PAL.ink };
/** Bronze bindings. */
export const BRONZE: Tones = { E: PAL.gold3, L: PAL.gold3, M: PAL.gold2, S: PAL.gold1, D: PAL.gold0 };
/** Seal glow ramp, dim to hot. */
export const MAG: readonly number[] = [PAL.mag0, PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag4];

/**
 * Flat three-band planes (IŞ-3): the band toward the key light, the shade band away from it, the mid tone between.
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

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
