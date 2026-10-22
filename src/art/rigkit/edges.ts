// rigkit / edges — selective edge paint, the cool rim, glints and part-local lines
// (A3_MIMARI §3.1; REHBER IŞ-7, IŞ-8).
//
// COPIED from the slice (crystal_wyrm-gbuf.ts edgeNormal / edgePaint / rimLight / twinkle / lineOn,
// crystal_wyrm-rig.ts lineOn2) with the light passed in and any frame size.

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import { dot, flo, norm, type V } from './geom';
import type { Light } from './light';

/** Bresenham walk from a to b (floored), calling `at` for every pixel. */
function walk(a: V, b: V, at: (x: number, y: number) => void) {
  let [x0, y0] = flo(a);
  const [x1, y1] = flo(b);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    at(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/** 1-px line painted only over a layer's opaque pixels (optionally only over pixels `only` accepts). */
export function lineOn(c: PixelCanvas, a: V, b: V, col: number, only?: (cur: number) => boolean) {
  walk(a, b, (x, y) => {
    const cur = c.get(x, y);
    if (cur !== null && (!only || only(cur))) c.set(x, y, col);
  });
}

/** 1-px line over a layer's opaque pixels whose colour is chosen per pixel (null = leave it). */
export function lineWith(c: PixelCanvas, a: V, b: V, col: (x: number, y: number, cur: number) => number | null) {
  walk(a, b, (x, y) => {
    const cur = c.get(x, y);
    if (cur !== null) {
      const k = col(x, y, cur);
      if (k !== null) c.set(x, y, k);
    }
  });
}

/** Outward normal of a layer pixel from its open 8-neighbours (0,0 when interior). */
export function edgeNormal(c: PixelCanvas, x: number, y: number, open: (x: number, y: number) => boolean = (a, b) => !c.isOpaque(a, b)): V {
  let nx = 0;
  let ny = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      if (open(x + dx, y + dy)) {
        const w = dx && dy ? 0.7 : 1;
        nx += dx * w;
        ny += dy * w;
      }
    }
  return [nx, ny];
}

export interface EdgePaintOpts {
  /** facing (outward normal · light) at or above which an edge is lit. Default 0.35 (IŞ-8). */
  readonly lit?: number;
  /** facing at or below which an edge is dark. Default −0.35. */
  readonly dark?: number;
  /** only pixels whose colour this accepts are painted */
  readonly only?: (cur: number) => boolean;
  /** what counts as "outside" (default: transparent in c) */
  readonly open?: (x: number, y: number) => boolean;
}

/**
 * Selective edge paint (IŞ-8): every pixel of `c` on its own silhouette (4-neighbour test) whose
 * outward facing (dotted with the light's screen direction) is ≥ `lit` gets `hi`, ≤ `dark` gets
 * `lo` (null = leave).
 */
export function edgePaint(c: PixelCanvas, light: Light, hi: number | null, lo: number | null, o: EdgePaintOpts = {}) {
  const lit = o.lit ?? 0.35;
  const dark = o.dark ?? -0.35;
  const open = o.open ?? ((x: number, y: number) => !c.isOpaque(x, y));
  const hits: number[] = [];
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      const cur = c.get(x, y);
      if (cur === null) continue;
      if (!(open(x - 1, y) || open(x + 1, y) || open(x, y - 1) || open(x, y + 1))) continue;
      if (o.only && !o.only(cur)) continue;
      const n = norm(edgeNormal(c, x, y, open));
      const f = dot(n, light.v2);
      if (f >= lit && hi !== null) hits.push(x, y, hi);
      else if (f <= dark && lo !== null) hits.push(x, y, lo);
    }
  for (let i = 0; i < hits.length; i += 3) c.set(hits[i], hits[i + 1], hits[i + 2]);
}

/** The A2 rim: the hide tones it runs over and its colour (the wyrm's cyan2 bounce). */
export const RIM_COLS_A2: readonly number[] = Object.freeze([PAL.night2, PAL.night3, PAL.steel]);
export const RIM_A2 = PAL.cyan2;

export interface RimOpts {
  /** the layer colours the rim may replace. Default RIM_COLS_A2. */
  readonly cols?: readonly number[];
  /** the rim colour (IŞ-7: one per material). Default RIM_A2. */
  readonly rim?: number;
  /** only where this accepts (x, y) */
  readonly only?: (x: number, y: number) => boolean;
}

/**
 * Cool reflected light from the arena on the shadow-side silhouette of a layer (the edges facing
 * away from the key light and down): one continuous 1-px line, only where the edge faces empty
 * space (neither the layer nor what `dst` already holds there). IŞ-7.
 */
export function rimLight(c: PixelCanvas, dst: PixelCanvas, light: Light, o: RimOpts = {}) {
  const cols = o.cols ?? RIM_COLS_A2;
  const rim = o.rim ?? RIM_A2;
  const W = c.w;
  const H = c.h;
  const d = c.data;
  const inL = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 0;
  const open = (x: number, y: number) => !inL(x, y) && !dst.isOpaque(x, y);
  const s = -light.side; // the shadow side: +1 = right (P1 light from the left)
  const hits: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!inL(x, y)) continue;
      // the diagonal corner too: on a staircase contour the rim stays one continuous line
      if (!(open(x + s, y) || open(x, y + 1) || open(x + s, y + 1))) continue;
      if (!inL(x - s, y) || !inL(x, y - 1)) continue;
      const col = c.get(x, y)!;
      if (cols.includes(col) && (!o.only || o.only(x, y))) hits.push(x, y);
    }
  for (let i = 0; i < hits.length; i += 2) c.set(hits[i], hits[i + 1], rim);
}

/**
 * A glint on a facet vertex (IŞ-8): size 1 = the vertex pixel alone, size 2 = a 3-px cross (the
 * vertex + four 1-px arms). Only over matter (never into the air, never over the outline).
 * A2 colour: white.
 */
export function twinkle(p: PixelCanvas, at: V, size: number, col: number = PAL.white) {
  const put = (dx: number, dy: number) => {
    const x = at[0] + dx;
    const y = at[1] + dy;
    const cur = p.get(x, y);
    if (cur === null || cur === PAL.ink) return;
    p.set(x, y, col);
  };
  put(0, 0);
  if (size >= 2) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(dx, dy);
}

/** The glint's three frames on its fixed pixel (IŞ-8): 1 px → 3-px cross → 1 px. */
export const GLINT_SIZES: readonly number[] = Object.freeze([1, 2, 1]);

/**
 * Size of an anim's ONE glint (IŞ-8: at most one per anim, on one fixed pixel) at frame `f` when it
 * starts at frame `start`: 1, 2, 1 over three frames, else 0 (no glint on this frame). Draw it with
 * twinkle(p, pixel, size) — the pixel is chosen once per anim (a facet vertex on the lit edge).
 */
export function glintSize(f: number, start: number): number {
  const k = f - start;
  return k >= 0 && k < GLINT_SIZES.length ? GLINT_SIZES[k] : 0;
}
