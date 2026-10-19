// rigkit / composite — laying parts over each other (A3_MIMARI §3.1; REHBER IŞ-4, IŞ-5, IŞ-6, IŞ-9).
//
// COPIED from the slice and generalised to any frame size:
//   - composite / seams / creases / Fold / maskOf     crystal_wyrm-gbuf.ts
//   - castShadow (layer shape moved away from the light), cleanCrumbs (+ keep mask)
//                                                     crystal_wyrm-rig.ts (private there)
//   - PartComp (part-id buffer + 1-px separation lines, stamped cast shadows)
//                                                     abyss_magus-rig.ts comp() / castShadow()
// Seams and creases are tables "colour → colour" (one / two steps down the ramp); the A2 tables are
// the wyrm's SEAM / CREASE, and seamOf / creaseOf build them from a material's ramp.

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import type { V } from './geom';
import type { Light } from './light';

// ------------------------------------------------------------------ seams

/** Colour of a seam pixel at (x, y), given the colour already there ("behind"). */
export type SeamFn = (x: number, y: number, behind: number) => number;
/** colour → colour step table (missing colours fall back to PAL.ink). */
export type StepTable = Readonly<Record<number, number>>;

/** One step down the ramp: the 1-px contact seam (A2, crystal_wyrm-gbuf.ts SEAM). */
export const SEAM_A2: StepTable = Object.freeze({
  [PAL.white]: PAL.steel,
  [PAL.mist]: PAL.steel,
  [PAL.steel]: PAL.night3,
  [PAL.night4]: PAL.night2,
  [PAL.night3]: PAL.night2,
  [PAL.night2]: PAL.night1,
  [PAL.night1]: PAL.night0,
  [PAL.cyan4]: PAL.cyan2,
  [PAL.cyan3]: PAL.cyan1,
  [PAL.cyan2]: PAL.cyan1,
  [PAL.cyan1]: PAL.cyan0,
  [PAL.cyan0]: PAL.night0,
  [PAL.gold4]: PAL.gold2,
  [PAL.gold3]: PAL.gold1,
  [PAL.gold2]: PAL.gold1,
  [PAL.gold1]: PAL.gold0,
});
/** Junction crease (A2 CREASE): hide folds into night3, darker tones one step further, glass to its deep tone. */
export const CREASE_A2: StepTable = Object.freeze({
  [PAL.white]: PAL.night3,
  [PAL.mist]: PAL.night3,
  [PAL.steel]: PAL.night3,
  [PAL.night4]: PAL.night2,
  [PAL.night3]: PAL.night2,
  [PAL.night2]: PAL.night1,
  [PAL.night1]: PAL.night0,
  [PAL.cyan4]: PAL.cyan1,
  [PAL.cyan3]: PAL.cyan1,
  [PAL.cyan2]: PAL.cyan1,
  [PAL.cyan1]: PAL.cyan0,
  [PAL.cyan0]: PAL.night0,
  [PAL.gold4]: PAL.gold2,
  [PAL.gold3]: PAL.gold1,
  [PAL.gold2]: PAL.gold1,
  [PAL.gold1]: PAL.gold0,
});

/** A seam function from a step table (unknown colours → PAL.ink, as A2). */
export function seamFrom(t: StepTable): SeamFn {
  return (_x, _y, c) => t[c] ?? PAL.ink;
}
/** The A2 contact seam (crystal_wyrm-gbuf.ts selout). */
export const selout: SeamFn = seamFrom(SEAM_A2);
/** The A2 junction crease (crystal_wyrm-gbuf.ts crease). */
export const crease: SeamFn = seamFrom(CREASE_A2);

/** What seamOf / creaseOf read of a material (a src/art/materials MaterialDef fits structurally). */
export interface SeamSource {
  readonly draw: {
    readonly ramp: readonly number[];
    readonly seam: 'stepDown' | StepTable;
    readonly crease: 'stepDown2' | StepTable;
  };
}

/** Step table "k steps down the ramp" (the darkest tone steps to `floor`, default PAL.ink). */
export function stepDown(ramp: readonly number[], k: number, floor: number = PAL.ink): StepTable {
  const t: Record<number, number> = {};
  for (let i = 0; i < ramp.length; i++) t[ramp[i]] = i - k >= 0 ? ramp[i - k] : floor;
  return Object.freeze(t);
}

/** One step down the material's ramp (SEAM): its own table, or the ramp stepped once. */
export function seamOf(m: SeamSource): SeamFn {
  return seamFrom(m.draw.seam === 'stepDown' ? stepDown(m.draw.ramp, 1) : m.draw.seam);
}
/** 1–2 steps down (CREASE): its own table, or the ramp stepped twice. */
export function creaseOf(m: SeamSource): SeamFn {
  return seamFrom(m.draw.crease === 'stepDown2' ? stepDown(m.draw.ramp, 2) : m.draw.crease);
}

// ------------------------------------------------------------------ composite

/** Width of a junction crease (px) above, beside and under the front part (IŞ-5). */
export interface Fold {
  readonly top: number;
  readonly side: number;
  readonly bottom: number;
}
export const FOLD1: Fold = Object.freeze({ top: 1, side: 1, bottom: 1 });

/**
 * Blit a layer. The surface already drawn right around its edge becomes a seam / crease band
 * (`fold` widths: above / beside / under the layer); over empty space nothing is added — the
 * single silhouette contour comes from the final p.outline(PAL.ink). Layers never carry partial
 * alpha (the copy is opaque). NOTE: the seam pixels are written into `layer` (as A2).
 */
export function composite(dst: PixelCanvas, layer: PixelCanvas, seam: SeamFn = selout, fold: Fold = FOLD1) {
  const lw = layer.w;
  const lh = layer.h;
  const la = layer.data;
  let x0 = lw;
  let y0 = lh;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < lh; y++)
    for (let x = 0, i = y * lw * 4 + 3; x < lw; x++, i += 4)
      if (la[i]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return;
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < lw && y < lh && la[(y * lw + x) * 4 + 3] > 0;
  const edge: number[] = [];
  const reach = Math.max(fold.top, fold.side, fold.bottom);
  for (let y = Math.max(0, y0 - reach); y <= Math.min(lh - 1, y1 + reach); y++)
    for (let x = Math.max(0, x0 - reach); x <= Math.min(lw - 1, x1 + reach); x++) {
      if (la[(y * lw + x) * 4 + 3] > 0) continue;
      if (!dst.isOpaque(x, y)) continue;
      let hit = op(x - 1, y) || op(x + 1, y) || (fold.bottom > 0 && op(x, y - 1)) || (fold.top > 0 && op(x, y + 1));
      // wider bands: the layer lies below this pixel (top band), beside it, or above it (bottom band)
      for (let k = 2; !hit && k <= fold.top; k++) hit = op(x, y + k);
      for (let k = 2; !hit && k <= fold.side; k++) hit = op(x - k, y) || op(x + k, y) || op(x - k + 1, y + 1) || op(x + k - 1, y + 1);
      for (let k = 2; !hit && k <= fold.bottom; k++) hit = op(x, y - k) || op(x - 1, y - k + 1) || op(x + 1, y - k + 1);
      if (hit) edge.push(x, y);
    }
  for (let i = 0; i < edge.length; i += 2) {
    const x = edge[i];
    const y = edge[i + 1];
    layer.set(x, y, seam(x, y, dst.get(x, y)!));
  }
  const dw = dst.w;
  const dd = dst.data;
  for (let y = Math.max(0, y0 - reach); y <= Math.min(lh - 1, dst.h - 1, y1 + reach); y++)
    for (let x = Math.max(0, x0 - reach); x <= Math.min(lw - 1, dw - 1, x1 + reach); x++) {
      const si = (y * lw + x) * 4;
      if (la[si + 3] === 0) continue;
      const di = (y * dw + x) * 4;
      dd[di] = la[si];
      dd[di + 1] = la[si + 1];
      dd[di + 2] = la[si + 2];
      dd[di + 3] = 255;
    }
}

/** Mark a canvas' opaque pixels in a mask (cleared first; mask length = c.w × c.h). */
export function maskOf(c: PixelCanvas, into: Uint8Array) {
  into.fill(0);
  const n = c.w * c.h;
  for (let i = 0; i < n; i++) if (c.data[i * 4 + 3]) into[i] = 1;
}
/** Add a canvas' opaque pixels to a mask (not cleared). */
export function orMask(c: PixelCanvas, into: Uint8Array) {
  const n = c.w * c.h;
  for (let i = 0; i < n; i++) if (c.data[i * 4 + 3]) into[i] = 1;
}

// ------------------------------------------------------------------ cast shadow (IŞ-6)

/** One value down: the shadow a part casts on the hide behind it (A2, crystal_wyrm-rig.ts SHADOW). */
export const SHADOW_A2: StepTable = Object.freeze({
  [PAL.white]: PAL.steel,
  [PAL.mist]: PAL.steel,
  [PAL.steel]: PAL.night3,
  [PAL.cyan2]: PAL.cyan1,
  [PAL.cyan3]: PAL.cyan1,
  [PAL.cyan4]: PAL.cyan2,
});

export interface CastShadowOpts {
  /** offset of the shadow (px): x away from the light, y down. Default [2, 2] (A2). */
  readonly off?: V;
  /** colour → its shadow colour; colours missing from it receive no shadow. Default SHADOW_A2. */
  readonly shade?: StepTable;
  /** only pixels marked here receive a shadow (default: every opaque pixel of dst) */
  readonly onto?: Uint8Array;
}

/**
 * Cast shadow of a front part (`caster`: its layer, or a mask of dst's size) on what is already
 * drawn in dst: the caster's shape moved away from the key light (down, and to the far side),
 * painted one value down over existing pixels only (never under the caster, never growing the
 * silhouette). A2: the wyrm's raised near arm.
 */
export function castShadow(dst: PixelCanvas, caster: PixelCanvas | Uint8Array, light: Light, o: CastShadowOpts = {}) {
  const W = dst.w;
  const H = dst.h;
  const off = o.off ?? [2, 2];
  const shade = o.shade ?? SHADOW_A2;
  const ox = -light.side * off[0];
  const oy = off[1];
  const isC =
    caster instanceof Uint8Array
      ? (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && caster[y * W + x] > 0
      : (x: number, y: number) => caster.isOpaque(x, y);
  const hits: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (isC(x, y) || !dst.isOpaque(x, y)) continue;
      if (o.onto && !o.onto[y * W + x]) continue;
      if (!isC(x - ox, y - oy)) continue;
      const to = shade[dst.get(x, y)!];
      if (to !== undefined) hits.push(x, y, to);
    }
  for (let i = 0; i < hits.length; i += 3) dst.set(hits[i], hits[i + 1], hits[i + 2]);
}

// ------------------------------------------------------------------ crumbs (IŞ-4, last pass)

/**
 * A pixel inside the body (4 opaque, non-ink neighbours) with no neighbour of its own colour in any
 * of the 8 directions is a crumb left where planes, creases and rims meet: it takes the colour its
 * 4-neighbours share most. 1-px lines (8-connected), the silhouette and the pixels marked in `keep`
 * (eye glint, iris, nostril…) are never touched. (A2: crystal_wyrm-rig.ts cleanCrumbs + KEEP.)
 */
export function cleanCrumbs(p: PixelCanvas, keep?: Uint8Array) {
  const W = p.w;
  const H = p.h;
  const hits: number[] = [];
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      if (keep && keep[y * W + x]) continue;
      const c = p.get(x, y);
      if (c === null || c === PAL.ink || !p.isOpaque(x, y)) continue;
      let same = false;
      for (let dy = -1; dy <= 1 && !same; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && p.isOpaque(x + dx, y + dy) && p.get(x + dx, y + dy) === c) same = true;
      if (same) continue;
      const n4: number[] = [];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const q = p.isOpaque(x + dx, y + dy) ? p.get(x + dx, y + dy) : null;
        if (q === null || q === PAL.ink) break;
        n4.push(q);
      }
      if (n4.length < 4) continue;
      let best = n4[0];
      let bn = 0;
      for (const q of n4) {
        const k = n4.filter((v) => v === q).length;
        if (k > bn) [best, bn] = [q, k];
      }
      hits.push(x, y, best);
    }
  for (let i = 0; i < hits.length; i += 3) p.set(hits[i], hits[i + 1], hits[i + 2]);
}

// ------------------------------------------------------------------ part-id compositor

/** The four neighbour directions (default for SepOpts.inDirs). */
export const DIR4: readonly (readonly [number, number])[] = Object.freeze([
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const);
/** Horizontal neighbours only. */
export const DIRH: readonly (readonly [number, number])[] = Object.freeze([
  [-1, 0],
  [1, 0],
] as const);

export interface SepOpts {
  /** Colour painted on already-drawn pixels touching the new part (a separation line under it). */
  readonly out?: number;
  /** Parts that never get the `out` line (the new part carries its own dark edge there). */
  readonly outSkip?: readonly number[];
  /** Colour painted on the new part's own pixels that touch already-drawn pixels. */
  readonly in?: number;
  /** Neighbour directions checked for `in` (default DIR4). */
  readonly inDirs?: readonly (readonly [number, number])[];
}

/**
 * The frame being drawn plus a part-id buffer (which part owns each pixel; 0 = none) — the magus'
 * compositor (abyss_magus-rig.ts comp / Frame). add() lays a part (a canvas of the frame's size)
 * over the frame with optional 1-px separation lines; passes read `id` to work in part space.
 */
export class PartComp {
  readonly p: PixelCanvas;
  readonly id: Uint8Array;

  constructor(p: PixelCanvas, id?: Uint8Array) {
    this.p = p;
    this.id = id ?? new Uint8Array(p.w * p.h);
  }

  /** The part owning (x, y) (0 outside or none). */
  owner(x: number, y: number): number {
    return x >= 0 && y >= 0 && x < this.p.w && y < this.p.h ? this.id[y * this.p.w + x] : 0;
  }

  /** Lay part `q` (id `part`, 1…255) over the frame. */
  add(q: PixelCanvas, part: number, o: SepOpts = {}): void {
    const { p, id } = this;
    const W = p.w;
    const H = p.h;
    const outs: number[] = [];
    const ins: number[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
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
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c = q.get(x, y);
        if (c === null) continue;
        p.set(x, y, c);
        id[y * W + x] = part;
      }
    for (let i = 0; i < ins.length; i += 2) p.set(ins[i], ins[i + 1], o.in!);
  }

  /** Paint stamped cast-shadow pixels (maps' 'x', see maps.ts stamp) over pixels already there. */
  shadow(cast: readonly number[], c: number): void {
    for (let i = 0; i < cast.length; i += 2) if (this.p.isOpaque(cast[i], cast[i + 1])) this.p.set(cast[i], cast[i + 1], c);
  }
}
