// rigkit / passes / motes — dark motes spiralling in onto the body (shadow revive; A2 magus).
//
// COPIED from abyss_magus-rig.ts glowPass (the `o.gather` block) with the centre, the count and the
// tones as parameters (A2 values by default). The rising motes of the shadow DEATH live in
// dissolvePass (`motes: true`); these are the revive's: each mote is a 2-px streak (head + tail) on
// a squashed spiral (the floor plane) that tightens onto `centre` as `gather` runs 0 → 1, kept off
// the frame edges. They are light, not matter: drawn after the outline, only into empty pixels.

import { PAL } from '../../palette';
import type { PixelCanvas } from '../../pixel';
import { clamp, type V } from '../geom';

export interface GatherMotesOpts {
  /** number of motes. A2: 16. */
  readonly n?: number;
  /** head tone (every 4th mote: `headBright`), tail tone. A2: void3, void4, void1. */
  readonly head?: number;
  readonly headBright?: number;
  readonly tail?: number;
  /** how a mote pixel is put (default: only into empty pixels of p) */
  readonly put?: (x: number, y: number, c: number) => void;
}

/** Draw the revive motes at gather progress `gather` (nothing at 0 or ≥ 1). */
export function gatherMotes(p: PixelCanvas, centre: V, gather: number, o: GatherMotesOpts = {}): void {
  if (!(gather > 0 && gather < 1)) return;
  const W = p.w;
  const H = p.h;
  const put =
    o.put ??
    ((x: number, y: number, c: number) => {
      if (!p.isOpaque(x, y)) p.set(x, y, c);
    });
  const [gx, gy] = centre;
  const N = o.n ?? 16;
  const head = o.head ?? PAL.void3;
  const bright = o.headBright ?? PAL.void4;
  const tail = o.tail ?? PAL.void1;
  const at = (i: number, g: number): V => {
    const a = i * 2.39996 + (1 - g) * 2.4;
    const rr = (18 + (i % 4) * 5) * Math.pow(1 - g, 1.15) + 2;
    return [clamp(gx + Math.cos(a) * rr * 1.25, 3, W - 4), clamp(gy + Math.sin(a) * rr * 0.6, 3, H - 4)];
  };
  for (let i = 0; i < N; i++) {
    const g = clamp(gather - (i % 3) * 0.05, 0, 1);
    if (g >= 0.97) continue;
    const [hx, hy] = at(i, g);
    const [tx, ty] = at(i, Math.max(0, g - 0.07));
    put(tx, ty, tail);
    put(hx, hy, i % 4 === 0 ? bright : head);
  }
}
