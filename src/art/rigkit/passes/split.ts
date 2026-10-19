// rigkit / passes / split — the body parts along its main crack (crystal death; A2 wyrm).
//
// COPIED from crystal_wyrm-rig.ts splitLine / splitBody, with the line passed in.

import type { PixelCanvas } from '../../pixel';
import { add, distSeg, mul, norm, sub, type V } from '../geom';

/** The main crack a → m → b extended `ext` px beyond both ends (A2: 80): the line the body splits along. */
export function splitLine(a: V, m: V, b: V, ext = 80): V[] {
  const up = norm(sub(a, m));
  const dn = norm(sub(b, m));
  return [add(a, mul(up, ext)), a, m, b, add(b, mul(dn, ext))];
}

/**
 * The front piece (the side of `line` with a negative cross product) parts from the back piece by
 * 1 px (split ≥ 0.5: moved [1, 1]) or 2 px (split ≥ 1: [2, 1]); the final outline fills the gap with
 * ink. `scratch` (optional, the frame's size) avoids an allocation.
 */
export function splitBody(p: PixelCanvas, line: readonly V[], split: number, scratch?: PixelCanvas) {
  const k = split >= 1 ? 2 : split >= 0.5 ? 1 : 0;
  if (!k) return;
  const W = p.w;
  const H = p.h;
  const src = scratch ?? p.clone();
  if (scratch) src.data.set(p.data);
  p.clear();
  const side = (q: V) => {
    let best = Infinity;
    let s = 0;
    for (let i = 1; i < line.length; i++) {
      const d = distSeg(q, line[i - 1], line[i]);
      if (d < best) {
        best = d;
        const ab = sub(line[i], line[i - 1]);
        const aq = sub(q, line[i - 1]);
        s = ab[0] * aq[1] - ab[1] * aq[0];
      }
    }
    return s;
  };
  const mv: V = k === 2 ? [2, 1] : [1, 1];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const cur = src.get(x, y);
      if (cur === null) continue;
      const front = side([x + 0.5, y + 0.5]) < 0;
      if (!front) p.set(x, y, cur);
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const cur = src.get(x, y);
      if (cur === null) continue;
      if (side([x + 0.5, y + 0.5]) < 0) {
        const tx = x + mv[0];
        const ty = y + mv[1];
        if (tx < W - 1 && ty < H - 1) p.set(tx, ty, cur);
      }
    }
}
