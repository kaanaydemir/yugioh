// rigkit / passes / foam — a water body losing its cohesion (the water death, A4.1 Mercan Yılanı's hide;
// later any water body: Gelgit Golemi melts the same way), and 'surge' — the revive, the same field read
// backwards (the water comes back into the body). Material-generic: the tones come from a style.
//
// Works in PART space on the frame BEFORE the outline (a "pass part" in the member's front slot: the
// outline then runs round the broken edge, IŞ-9), like crumble / dissolve:
//   - every body pixel has a place in its part's pattern space (restOf: rest px of a rigid part, a soft
//     part's still px — whatever rides the part, so the pattern never crawls); places fall in K×K
//     CLUSTERS (≥ 2 px: MA-2 / IŞ-4, foam is never speckle);
//   - each cluster turns at its own moment: (1 − jitter) · order(its centre) + jitter · hash — the
//     member says which way the water goes (order 0 first: the top of the rest silhouette, the
//     extremities…);
//   - before its moment a cluster is untouched; for `band` of progress after it, it is FOAM (one of the
//     style's two tones per cluster: white crests on a lighter body tone, flat, no dither); after that
//     it is GONE (erased, its part id cleared) — unless it is one of the `keep` share that stays foam to
//     the end (the remains a death kit breaks after the last frame).
// restOf → null keeps a pixel whole (a stone crown on a water body, glow, matter).
// Everything is a pure function of the progress and the part-space places: the same progress gives the
// same frame, and a cluster that went at t is gone at every later t (monotonic for a fixed order).

import { clamp, type V } from '../geom';
import type { PartComp } from '../composite';
import { hash2 } from './types';

export interface FoamStyle {
  /** the foam's tones: [crest, body] — a cluster takes one of them (crest share: `crest`) */
  readonly foam: readonly [crest: number, body: number];
  /** share of the foam clusters in the crest tone. Default 0.4. */
  readonly crest?: number;
}

export interface FoamOpts {
  /** progress 0…1 (+ band): 0 untouched … 1 every non-kept cluster gone */
  readonly t: number;
  /** pattern-space place of pixel (x, y) owned by `part` (1-based part id); null = never foams */
  readonly restOf: (part: number, x: number, y: number) => V | null;
  /** when a place turns, 0 (first) … 1 (last), evaluated at a cluster's centre */
  readonly order: (rest: V, part: number) => number;
  readonly style: FoamStyle;
  /** progress a cluster stays foam before it goes. Default 0.22. */
  readonly band?: number;
  /** share of a cluster's moment that is hashed (the ragged front). Default 0.25. */
  readonly jitter?: number;
  /** cluster size in pattern px. Default 2. */
  readonly cluster?: number;
  /** share of the clusters that never go (they stay foam once foamed). Default 0. */
  readonly keep?: number;
  readonly seed?: number;
}

export interface FoamResult {
  /** pixels turned to foam / erased this frame */
  readonly foam: number;
  readonly gone: number;
}

const NONE: FoamResult = Object.freeze({ foam: 0, gone: 0 });

/** The water body of frame `f` at progress o.t (see the header). Works on f.p in place, BEFORE the outline. */
export function foamPass(f: PartComp, o: FoamOpts): FoamResult {
  const t = o.t;
  if (!(t > 0)) return NONE;
  const { p, id } = f;
  const W = p.w;
  const H = p.h;
  const K = Math.max(1, Math.round(o.cluster ?? 2));
  const band = Math.max(0, o.band ?? 0.22);
  const jitter = clamp(o.jitter ?? 0.25, 0, 1);
  const keep = clamp(o.keep ?? 0, 0, 1);
  const seed = o.seed ?? 0;
  const crestShare = clamp(o.style.crest ?? 0.4, 0, 1);
  const [crest, body] = o.style.foam;
  // per (part, cluster): its moment, computed once from the cluster's centre (every pixel of a cluster
  // takes the same decision: no 1-px fragments)
  const moments = new Map<number, number>();
  const gone: number[] = [];
  const foam: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const part = id[i];
      if (part === 0 || !p.isOpaque(x, y)) continue;
      const r = o.restOf(part, x, y);
      if (!r) continue;
      const cx = Math.floor(r[0] / K);
      const cy = Math.floor(r[1] / K);
      const key = ((part & 0xff) * 4096 + ((cx + 2048) & 0xfff)) * 4096 + ((cy + 2048) & 0xfff);
      let m = moments.get(key);
      if (m === undefined) {
        const c: V = [(cx + 0.5) * K, (cy + 0.5) * K];
        m = (1 - jitter) * clamp(o.order(c, part), 0, 1) + jitter * hash2(cx, cy, seed + part * 7);
        moments.set(key, m);
      }
      if (m >= t) continue;
      const kept = keep > 0 && hash2(cx, cy, seed + 101) < keep;
      if (!kept && m < t - band) gone.push(x, y);
      else foam.push(x, y, hash2(cx, cy, seed + 31) < crestShare ? crest : body);
    }
  for (let k = 0; k < gone.length; k += 2) {
    p.erase(gone[k], gone[k + 1]);
    id[gone[k + 1] * W + gone[k]] = 0;
  }
  for (let k = 0; k < foam.length; k += 3) p.set(foam[k], foam[k + 1], foam[k + 2]);
  return { foam: foam.length / 3, gone: gone.length / 2 };
}

export interface SurgeOpts extends Omit<FoamOpts, 't'> {
  /** progress 0…1 (0 = as broken as the foam left it at 1, 1 = whole) */
  readonly t: number;
}

/**
 * The water revive: the foam field read backwards — the gone clusters come back as foam in the reverse
 * order and the foam settles back into the body (the member draws the water running back to it).
 */
export function surgePass(f: PartComp, o: SurgeOpts): FoamResult {
  return foamPass(f, { ...o, t: 1 - clamp(o.t, 0, 1) });
}
