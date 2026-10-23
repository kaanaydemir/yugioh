// rigkit / passes / foam — a water body losing its cohesion (the water death, A4.1 Mercan Yılanı's hide;
// later any water body: Gelgit Golemi melts the same way), and 'surge' — the revive, the same line run
// back up (the water comes back into the body). Material-generic: the tones come from a style.
//
// Water does not crumble or erode in clusters (the part-space passes of stone and shadow): it MELTS. A
// water line runs down through the frame (gravity: screen space), lumpy (two slow waves along x), from
// `top` at progress 0 to `floor` at 1. Everything that melts above the line is gone (erased, its part id
// cleared: the outline then runs round the melted edge, IŞ-9); the body's new top, where the line cuts
// it, FOAMS — a 2-px crest (the style's top tone, then its under tone: white over water4), flat bands,
// never speckle (MA-2, IŞ-4); a few columns run meltwater down the body under the crest (1-px streaks).
// Parts that do not melt (`keep`: a stone crown, glow, matter) stay whole. Run on the frame BEFORE the
// outline, as a "pass part" in the member's front slot (like crumble / dissolve).
// Pure: the same progress gives the same frame; for a body that stays put, a px gone at t is gone at
// every later t.

import { clamp } from '../geom';
import type { PartComp } from '../composite';
import { hash2 } from './types';

export interface FoamStyle {
  /** the crest's two rows, top first (white over water4) */
  readonly crest: readonly [top: number, under: number];
  /** the meltwater streaks' tone (default: the under tone) */
  readonly drip?: number;
}

export interface FoamOpts {
  /** progress 0…1: the line at `top` (nothing melted) … at `floor` */
  readonly t: number;
  /** frame rows the line runs between */
  readonly top: number;
  readonly floor: number;
  readonly style: FoamStyle;
  /** parts (1-based ids) that never melt */
  readonly keep?: (part: number) => boolean;
  /** the line's lumps: px amplitude, px wavelength, phase (0…1; let it creep with t for a live surface). Default 2 / 23 / t. */
  readonly wave?: { readonly amp: number; readonly len: number; readonly phase: number };
  /** meltwater streaks: the share of columns that run one (default 0.12) and their longest length in px (default 4) */
  readonly drips?: { readonly share: number; readonly len: number };
  readonly seed?: number;
}

export interface FoamResult {
  /** px erased / crested this frame */
  readonly gone: number;
  readonly crest: number;
}

const NONE: FoamResult = Object.freeze({ gone: 0, crest: 0 });

/** The water line's row at column x (whole px). */
export function foamLevel(o: Pick<FoamOpts, 't' | 'top' | 'floor' | 'wave'>, x: number): number {
  const t = clamp(o.t, 0, 1);
  const amp = o.wave?.amp ?? 2;
  const len = Math.max(4, o.wave?.len ?? 23);
  const ph = o.wave?.phase ?? t;
  const lump = Math.sin(2 * Math.PI * (x / len + ph)) + 0.5 * Math.sin(2 * Math.PI * (x / (len * 0.43) + 1.3 * ph + 0.7));
  return Math.round(o.top + (o.floor - o.top) * t + amp * lump * Math.min(1, t * 6));
}

/** Melt frame `f` down to its water line at progress o.t (see the header). Works on f.p in place, BEFORE the outline. */
export function foamPass(f: PartComp, o: FoamOpts): FoamResult {
  if (!(o.t > 0)) return NONE;
  const { p, id } = f;
  const W = p.w;
  const H = p.h;
  const melts = (x: number, y: number) => {
    const part = id[y * W + x];
    return part !== 0 && p.isOpaque(x, y) && !(o.keep?.(part) ?? false);
  };
  const [crestTop, crestUnder] = o.style.crest;
  const drip = o.style.drip ?? crestUnder;
  const share = o.drips?.share ?? 0.12;
  const maxLen = o.drips?.len ?? 4;
  const seed = o.seed ?? 0;
  let gone = 0;
  let crest = 0;
  for (let x = 0; x < W; x++) {
    const L = foamLevel(o, x);
    // the streak this column runs (if any): its length grows with the melt
    const runs = hash2(x, 0, seed + 3) < share;
    const runLen = runs ? 1 + Math.floor(hash2(x, 1, seed + 3) * maxLen * clamp(o.t * 2, 0, 1)) : 0;
    let erased = false;
    // the row this column's crest starts on: −1 none yet, −2 done (a gap, or a body the line never cut)
    let from = -1;
    for (let y = 0; y < H; y++) {
      if (!melts(x, y)) {
        if (from >= 0) from = -2;
        continue;
      }
      if (y < L) {
        p.erase(x, y);
        id[y * W + x] = 0;
        erased = true;
        gone++;
        continue;
      }
      if (from === -1) from = erased ? y : -2; // the melted top (cut by the line, or where its water landed)
      if (from < 0) continue;
      const k = y - from;
      if (k >= 2 + runLen) {
        from = -2;
        continue;
      }
      p.set(x, y, k === 0 ? crestTop : k === 1 ? crestUnder : drip);
      crest++;
    }
  }
  return { gone, crest };
}

export interface SurgeOpts extends Omit<FoamOpts, 't'> {
  /** progress 0…1: 0 = as melted as the foam left it at 1, 1 = whole */
  readonly t: number;
}

/**
 * The water revive: the foam's line run back up — the body comes back out of the water from the bottom
 * up under its foam crest (the member draws the puddle's water running back into it).
 */
export function surgePass(f: PartComp, o: SurgeOpts): FoamResult {
  return foamPass(f, { ...o, t: 1 - clamp(o.t, 0, 1) });
}
