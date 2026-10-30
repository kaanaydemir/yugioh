// Sağ Kol Mührü (seal_arm_r) v3 — drawing kit of the "breaker fist" rig: a bounding-box compositor with pooled layers,
// flat value planes measured from a part's own edges (the plate's lit side follows the key light, so P2 is a true relight),
// and the three tone sets of the Beş Mühür set (obsidian, bronze, seal glow). Pure and deterministic; palette only.

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

// Layers are pooled: a part is painted on a clean canvas, laid on the frame by Comp.add(), which clears the part's box
// again and gives the canvas back.
const POOL: PixelCanvas[] = [];
export function layer(w: number, h: number): PixelCanvas {
  const i = POOL.findIndex((q) => q.w === w && q.h === h);
  return i >= 0 ? POOL.splice(i, 1)[0] : new PixelCanvas(w, h);
}
function clearBox(q: PixelCanvas, b: Box): void {
  const { w, data } = q;
  for (let y = b.y0; y <= b.y1; y++) data.fill(0, (y * w + b.x0) * 4, (y * w + b.x1 + 1) * 4);
}
/** Hand a layer back to the pool (cleared). */
export function release(q: PixelCanvas): void {
  const b = boxOf(q);
  if (b) clearBox(q, b);
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
  /** Lay part `q` over the frame at offset (ox, oy) (q may be smaller than the frame), then recycle q. */
  add(q: PixelCanvas, part: number, o: SepOpts = {}, ox = 0, oy = 0): void {
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
        const fx = x + ox;
        const fy = y + oy;
        if (fx < 0 || fy < 0 || fx >= p.w || fy >= p.h) continue;
        const qo = q.isOpaque(x, y);
        if (!qo) {
          if (o.out === undefined || !p.isOpaque(fx, fy)) continue;
          if (o.outSkip && o.outSkip.includes(id[fy * W + fx])) continue;
          if (q.isOpaque(x - 1, y) || q.isOpaque(x + 1, y) || q.isOpaque(x, y - 1) || q.isOpaque(x, y + 1)) outs.push(fx, fy);
          continue;
        }
        if (o.in === undefined) continue;
        for (const [dx, dy] of o.inDirs ?? DIR4)
          if (!q.isOpaque(x + dx, y + dy) && p.isOpaque(fx + dx, fy + dy)) {
            ins.push(fx, fy);
            break;
          }
      }
    for (let i = 0; i < outs.length; i += 2) p.set(outs[i], outs[i + 1], o.out!);
    for (let y = b.y0; y <= b.y1; y++)
      for (let x = b.x0; x <= b.x1; x++) {
        const c = q.get(x, y);
        if (c === null) continue;
        const fx = x + ox;
        const fy = y + oy;
        if (fx < 0 || fy < 0 || fx >= p.w || fy >= p.h) continue;
        p.set(fx, fy, c);
        id[fy * W + fx] = part;
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
/** The far / buried side of the stone, a value darker. */
export const OBS_FAR: Tones = { E: PAL.stone2, L: PAL.stone1, M: PAL.stone0, S: PAL.void0, D: PAL.ink };
/** Violet spill: the stone next to a lit glyph (shadow side void1, lit side void2). */
export const OBS_SPILL: Tones = { E: PAL.void3, L: PAL.void2, M: PAL.void1, S: PAL.void0, D: PAL.ink };
/** Bronze bindings. */
export const BRONZE: Tones = { E: PAL.gold3, L: PAL.gold3, M: PAL.gold2, S: PAL.gold1, D: PAL.gold0 };
/** Seal glow ramp, dim to hot. */
export const MAG: readonly number[] = [PAL.mag0, PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag4];

/**
 * Flat three-band planes (IŞ-3): the band toward the key light, the shade band away from it, the mid tone between.
 * `top` / `bottom` are the widths of the lit upper and shaded lower edge; `edge` is the length of the stone3 run on the
 * light-facing top corner (0 = none).
 */
export function bands(q: PixelCanvas, t: Tones, light: Light, litW = 2, shW = 2, opt: { top?: number; bottom?: number; edge?: number } = {}): void {
  const ls = light.side;
  const top = opt.top ?? 1;
  const bottom = opt.bottom ?? 1;
  const edge = opt.edge ?? 0;
  planes(q, (x, y, src) => {
    const toLight = Math.min(run(src, x, y, ls, -1, litW + 1), run(src, x, y, ls, 0, litW + 1) + 1);
    const up = run(src, x, y, 0, -1, top + 1);
    if (up < top || toLight < litW) {
      if (edge > 0 && up < 1 && run(src, x, y, ls, 0, edge) < edge) return t.E;
      return t.L;
    }
    const away = Math.min(run(src, x, y, -ls, 1, shW + 1), run(src, x, y, -ls, 0, shW + 1) + 1);
    const dn = run(src, x, y, 0, 1, bottom + 1);
    if (dn < bottom || away < shW) return t.S;
    return t.M;
  });
}

// ---------------------------------------------------------------- shapes

/** Polygon filled on a layer (vertices on the pixel-corner grid: a rect (x, y, w, h) covers exactly w × h cells). */
export function fillPoly(q: PixelCanvas, pts: readonly Pt[], c: number): void {
  q.poly(pts, c);
}

/** Chamfered rectangle on the corner grid: x0,y0 → x1,y1 exclusive; cuts = [tl, tr, br, bl] corner cuts in px. */
export function chamfer(x0: number, y0: number, x1: number, y1: number, cuts: readonly [number, number, number, number] = [0, 0, 0, 0]): Pt[] {
  const [a, b, c, d] = cuts;
  const out: Pt[] = [];
  if (a) out.push([x0, y0 + a], [x0 + a, y0]);
  else out.push([x0, y0]);
  if (b) out.push([x1 - b, y0], [x1, y0 + b]);
  else out.push([x1, y0]);
  if (c) out.push([x1, y1 - c], [x1 - c, y1]);
  else out.push([x1, y1]);
  if (d) out.push([x0 + d, y1], [x0, y1 - d]);
  else out.push([x0, y1]);
  return out;
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const rnd = Math.round;

/** The 5×5 glyph of the right arm ("rising arrow"): # = stroke. */
export const GLYPH_ARM_R: readonly string[] = ['..#..', '.#.#.', '#...#', '..#..', '..#..'];
