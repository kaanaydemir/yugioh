// Sol Kol Mührü (seal_arm_l) v3 — drawing kit of the "reaching palm" rig: pooled part layers with a part-id compositor,
// flat three-band planes measured from a part's OWN edges (so the lit side follows the key light and P2 is a true relight),
// quad / bar shapes on the pixel-centre grid, the three tone sets of the Beş Mühür set (obsidian, bronze, seal glow) and the
// palm glyph. Pure and deterministic; palette only; no module state except the layer pool.

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

const POOL: PixelCanvas[] = [];
/** A clean part layer of the frame's size (pooled). */
export function layer(w: number, h: number): PixelCanvas {
  const i = POOL.findIndex((q) => q.w === w && q.h === h);
  return i >= 0 ? POOL.splice(i, 1)[0] : new PixelCanvas(w, h);
}
function clearBox(q: PixelCanvas, b: Box): void {
  const { w, data } = q;
  for (let y = b.y0; y <= b.y1; y++) data.fill(0, (y * w + b.x0) * 4, (y * w + b.x1 + 1) * 4);
}
/** Give a layer back to the pool (cleared). */
export function release(q: PixelCanvas): void {
  const b = boxOf(q);
  if (b) clearBox(q, b);
  POOL.push(q);
}

let SNAP: PixelCanvas | null = null;
/** Re-tone the opaque pixels of q: `tone` sees a snapshot of q's mask (so the choice never reads its own output). */
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
  /** Lay part `q` over the frame (ids for the separation / rim passes), then recycle q. */
  add(q: PixelCanvas, part: number, o: SepOpts = {}): void {
    const { p, id } = this;
    const W = p.w;
    const b = boxOf(q, 1);
    if (!b) {
      POOL.push(q);
      return;
    }
    const outs: number[] = [];
    for (let y = b.y0; y <= b.y1; y++)
      for (let x = b.x0; x <= b.x1; x++) {
        if (q.isOpaque(x, y)) continue;
        if (o.out === undefined || !p.isOpaque(x, y)) continue;
        if (o.outSkip && o.outSkip.includes(id[y * W + x])) continue;
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
    clearBox(q, b);
    POOL.push(q);
  }
}

// ---------------------------------------------------------------- tones (Beş Mühür set ramps, palette only)

export interface Tones {
  /** edge run (light-facing corner), lit plane, mid plane, shadow plane, crease */
  E: number;
  L: number;
  M: number;
  S: number;
  D: number;
}

/** Colossus obsidian: creases are violet-black void0 (not the Titan's night0); stone3 runs only on near light corners. */
export const OBS: Tones = { E: PAL.stone3, L: PAL.stone2, M: PAL.stone1, S: PAL.stone0, D: PAL.void0 };
/** Bronze bindings (cuff, chain, the disc's ring). */
export const BRONZE: Tones = { E: PAL.gold3, L: PAL.gold3, M: PAL.gold2, S: PAL.gold1, D: PAL.gold0 };
/** Seal glow ramp, dim → hot. */
export const MAG: readonly number[] = [PAL.mag0, PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag4];

/**
 * Flat three-band planes (IŞ-3) from the part's own edges: `litW` px toward the key light (and the 1-px top) are the lit
 * plane, `shW` px away from it (and the bottom row) the shadow plane, the rest the mid tone; `edge` (px) is the stone3 run
 * on the light-facing top corner (0 = none).
 */
export function bands(q: PixelCanvas, t: Tones, light: Light, litW = 1, shW = 1, opt: { top?: number; bottom?: number; edge?: number } = {}): void {
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

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const rnd = Math.round;
export const DEG = Math.PI / 180;

/** Filled polygon on the pixel-centre grid. */
export function fill(q: PixelCanvas, pts: readonly Pt[], c: number): void {
  q.poly(pts as Pt[], c);
}

/** A straight bar from a to b (sharp square ends), width wa at a growing to wb at b. */
export function bar(q: PixelCanvas, a: Pt, b: Pt, wa: number, wb: number, c: number): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l;
  const ny = dx / l;
  const ha = wa / 2;
  const hb = wb / 2;
  q.poly(
    [
      [a[0] + nx * ha, a[1] + ny * ha],
      [b[0] + nx * hb, b[1] + ny * hb],
      [b[0] - nx * hb, b[1] - ny * hb],
      [a[0] - nx * ha, a[1] - ny * ha],
    ],
    c,
  );
}

/** Rotate offset (x, y) by deg degrees (screen space, y down: + turns clockwise on screen). */
export function rot(x: number, y: number, deg: number): Pt {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return [x * c - y * s, x * s + y * c];
}

/** Stamp a character bitmap ('#' = c) with its top-left at (x, y). */
export function stampBits(q: PixelCanvas, rows: readonly string[], x: number, y: number, c: number | ((cx: number, cy: number) => number)): void {
  for (let j = 0; j < rows.length; j++)
    for (let i = 0; i < rows[j].length; i++) if (rows[j][i] === '#') q.set(x + i, y + j, typeof c === 'number' ? c : c(i, j));
}

/** The glyph of the left arm ("the hand", five spokes): # = stroke. */
export const GLYPH_ARM_L: readonly string[] = ['#.#.#', '#.#.#', '.###.', '.###.', '..#..'];
/** The palm disc: 9 × 9 round, and its 7 × 7 round socket (rows from the top). */
export const DISC9: readonly string[] = ['..#####..', '.#######.', '#########', '#########', '#########', '#########', '#########', '.#######.', '..#####..'];
export const SOCK7: readonly string[] = ['..###..', '.#####.', '#######', '#######', '#######', '.#####.', '..###..'];
