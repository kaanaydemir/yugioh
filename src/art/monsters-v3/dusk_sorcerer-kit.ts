// Akşam Büyücüsü v3 — bounding-box versions of two rigkit loops (planes, PartComp.add): the same results, but
// they only visit the part's own box instead of the whole 128×116 frame (the rig lays ~25 parts per frame and
// the full-frame loops cost over the KK-13 render budget).

import { PixelCanvas } from '../pixel';
import { DIR4, type SepOpts } from '../rigkit';

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

/** rigkit planes(): a tone per opaque pixel chosen on a snapshot, visiting only the part's box. */
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

/** rigkit PartComp (frame + part-id buffer), add() limited to the new part's box. */
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
