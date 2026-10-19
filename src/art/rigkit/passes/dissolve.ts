// rigkit / passes / dissolve — dark erosion in part space, with rising motes (shadow death; A2 magus).
//
// COPIED from abyss_magus-rig.ts dissolvePass and generalised: the part → rest-space mapping (which
// the magus derives from its rig) is a callback, the erosion's vertical span and the tones are
// options with the A2 values as defaults.
//
// The body erodes in 2×2 clusters of its own part space (the pattern rides the parts, never
// crawls), from the top of the rest frame down — a dark front, then gone — and motes rise off what
// is gone. Parts whose restOf() is null (the magus' staff) stay whole. Revive runs `diss` backwards
// (with motes off: the gather has its own look).

import { PAL } from '../../palette';
import { DIR4, type PartComp } from '../composite';
import { clamp, type V } from '../geom';
import { hash2 } from './types';

export interface DissolveOpts {
  /** erosion progress 0…1 (+ the front width) */
  readonly diss: number;
  /** rest-space (part space) coordinates of pixel (x, y) owned by `part`; null = never erodes */
  readonly restOf: (part: number, x: number, y: number) => V | null;
  /** rising motes off the eroded clusters. Default true (the magus turns them off while gathering). */
  readonly motes?: boolean;
  /** width of the dark front (progress units). A2: 0.1. */
  readonly front?: number;
  /** rest-space row where the erosion starts and its height (px). A2: 4, 70. */
  readonly top?: number;
  readonly span?: number;
  /** tones: the dark front, near / far motes. A2: void0, void2, void1. */
  readonly frontTone?: number;
  readonly moteNear?: number;
  readonly moteFar?: number;
}

/** Erode the frame of `f` (its part ids are cleared where the body is gone). */
export function dissolvePass(f: PartComp, o: DissolveOpts): void {
  const { p, id } = f;
  const W = p.w;
  const H = p.h;
  const front = o.front ?? 0.1;
  const top = o.top ?? 4;
  const span = o.span ?? 70;
  const withMotes = o.motes ?? true;
  const near = o.moteNear ?? PAL.void2;
  const far = o.moteFar ?? PAL.void1;
  const gone: number[] = [];
  const dark: number[] = [];
  const motes: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!p.isOpaque(x, y)) continue;
      let part = id[y * W + x];
      if (part === 0) {
        // an outline pixel: it belongs to the part it hugs
        for (const [ddx, ddy] of DIR4) {
          const n = id[(y + ddy) * W + x + ddx];
          if (x + ddx >= 0 && x + ddx < W && y + ddy >= 0 && y + ddy < H && n !== 0) {
            part = n;
            break;
          }
        }
      }
      const r = o.restOf(part, x, y);
      if (!r) continue;
      const cx = Math.floor(r[0] / 2);
      const cy = Math.floor(r[1] / 2);
      const u = clamp((r[1] - top) / span, 0, 1);
      const thr = 0.9 * u + 0.1 * hash2(cx, cy, 7);
      if (thr < o.diss - front) {
        gone.push(x, y);
        // one mote per cluster (its top-left pixel), rising off it as the front moves on
        if (withMotes && (r[0] & 1) === 0 && (r[1] & 1) === 0 && hash2(cx, cy, 11) < 0.14) {
          const rise = 2 + (o.diss - front - thr) * 80;
          if (rise < 18) motes.push(x + Math.round(Math.sin(cy * 1.7 + rise * 0.3)), y - Math.round(rise), rise < 8 ? near : far);
        }
      } else if (thr < o.diss && p.get(x, y) !== PAL.ink) dark.push(x, y);
    }
  for (let i = 0; i < gone.length; i += 2) {
    p.erase(gone[i], gone[i + 1]);
    id[gone[i + 1] * W + gone[i]] = 0;
  }
  const ft = o.frontTone ?? PAL.void0;
  for (let i = 0; i < dark.length; i += 2) p.set(dark[i], dark[i + 1], ft);
  for (let i = 0; i < motes.length; i += 3) if (!p.isOpaque(motes[i], motes[i + 1])) p.set(motes[i], motes[i + 1], motes[i + 2]);
}
