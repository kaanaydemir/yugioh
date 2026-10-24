// Crisp card rasters for the v3 card object (lane A6-A, step A1; docs/v3/A6_PLAN.md §4.1 "Kart
// nesnesi", K1 / K2, KO-1). A v3 card is never drawn rotated or at a fractional scale: a card shown
// at another size is a NEW raster of whole-pixel size, sampled nearest-neighbour from the closest
// source level, with its 1-px outline and its 1-px trim kept exactly one pixel wide ("en yakın
// komşu + yeniden 1 px kontur"). Its turn is a short series of sharp frames (48 → 34 → 18 → 4 →
// 18 → 34 → 48 px wide, the face after the edge-on frame) instead of a fractional x-squash.
//
//   rasterCard(src, w, h)                 src (a card side, outline + trim) at w × h, rings kept
//   squeezeCard(src, w)                   the same side narrowed to w px (turn frames)
//   edgeFrame(w, h, tones)                the edge-on frame: a thin card edge catching the light
//   turnWidths(w)                         the widths of the turn frames for a card w px wide
//   turnFrames(from, to, w, h, opts)      the turn from one side to the other, every frame w × h
//   displaySize(scaleX, scaleY)           the whole-pixel size of a card at a logical scale
//
// Pure (PixelCanvas in, PixelCanvas out; palette tones only): usable from node tools and tests.

import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';

/** The upright card size every source side has at level 0 (cards.ts FACE_W × FACE_H). */
export const CARD_SRC_W = 48;
export const CARD_SRC_H = 68;

/** Outline + trim: the two border rings a raster keeps one pixel wide. */
const BORDER = 2;

/**
 * Map a target coordinate t ∈ [0, n) onto a source axis of length sn, keeping the first and last
 * `b` pixels (the rings) one-to-one and sampling the inside nearest-neighbour (pixel centres).
 */
export function mapAxis(t: number, n: number, sn: number, b = BORDER): number {
  if (n === sn) return t;
  if (n <= 2 * b || sn <= 2 * b) return Math.min(sn - 1, Math.floor(((t + 0.5) * sn) / n));
  if (t < b) return t;
  if (t >= n - b) return sn - (n - t);
  return b + Math.min(sn - 2 * b - 1, Math.floor(((t - b + 0.5) * (sn - 2 * b)) / (n - 2 * b)));
}

/**
 * `src` (a card side: 1-px outline, 1-px trim, cut corners) at w × h whole pixels: the two border
 * rings stay one pixel wide and continuous (re-outlined), the inside is sampled nearest-neighbour.
 * Same size → a copy.
 */
export function rasterCard(src: PixelCanvas, w: number, h: number, border = BORDER): PixelCanvas {
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  if (w === src.w && h === src.h) return src.clone();
  const out = new PixelCanvas(w, h);
  const xs = new Int32Array(w);
  const ys = new Int32Array(h);
  for (let x = 0; x < w; x++) xs[x] = mapAxis(x, w, src.w, border);
  for (let y = 0; y < h; y++) ys[y] = mapAxis(y, h, src.h, border);
  const sd = src.data;
  const od = out.data;
  for (let y = 0; y < h; y++) {
    const sy = ys[y];
    for (let x = 0; x < w; x++) {
      const si = (sy * src.w + xs[x]) * 4;
      const oi = (y * w + x) * 4;
      od[oi] = sd[si];
      od[oi + 1] = sd[si + 1];
      od[oi + 2] = sd[si + 2];
      od[oi + 3] = sd[si + 3];
    }
  }
  return out;
}

/** The same side narrowed to `w` px (full height): a turn frame's card, before centring. */
export function squeezeCard(src: PixelCanvas, w: number): PixelCanvas {
  return rasterCard(src, w, src.h);
}

/** Tones of the edge-on frame. */
export interface EdgeTones {
  /** The lit 1-px line (K2: white). */
  glint: number;
  /** The card stock behind it. */
  stock: number;
  /** Outline. */
  ink: number;
}

export const EDGE_TONES: EdgeTones = { glint: PAL.white, stock: PAL.steel, ink: PAL.ink };

/**
 * The edge-on turn frame: a card w px wide (w ≥ 2) and h tall seen on its edge — an ink outline
 * with cut corners around one lit white column and the stock behind it.
 */
export function edgeFrame(w: number, h: number, tones: EdgeTones = EDGE_TONES): PixelCanvas {
  w = Math.max(2, Math.round(w));
  h = Math.max(3, Math.round(h));
  const p = new PixelCanvas(w, h);
  if (w === 2) {
    // too thin for an outline on both sides: the lit line and its ink shadow
    p.vline(0, 1, h - 2, tones.glint);
    p.vline(1, 1, h - 2, tones.ink);
    p.set(0, 0, tones.ink).set(0, h - 1, tones.ink);
    return p;
  }
  p.rect(0, 1, w, h - 2, tones.ink);
  p.hline(1, w - 2, 0, tones.ink);
  p.hline(1, w - 2, h - 1, tones.ink);
  p.vline(1, 1, h - 2, tones.glint);
  for (let x = 2; x < w - 1; x++) p.vline(x, 1, h - 2, tones.stock);
  return p;
}

/**
 * The widths of the turn frames of a card `w` px wide, from the full side to the edge (K2: 48 →
 * 34 → 18 → 4): ≈ 0.71 and 0.375 of the width, then the edge (w / 12, at least 2 px).
 */
export function turnWidths(w: number): { steps: number[]; edge: number } {
  w = Math.max(1, Math.round(w));
  const edge = Math.max(2, Math.round(w / 12));
  const steps: number[] = [];
  for (const k of [34 / 48, 18 / 48]) {
    const s = Math.round(w * k);
    if (s > edge && s < w && !steps.includes(s)) steps.push(s);
  }
  return { steps, edge };
}

/** `card` (narrower than w) centred on a transparent w × h canvas (whole pixels: left-biased). */
export function centreIn(card: PixelCanvas, w: number, h: number): PixelCanvas {
  const p = new PixelCanvas(w, h);
  p.blit(card, Math.floor((w - card.w) / 2), Math.floor((h - card.h) / 2));
  return p;
}

export interface TurnOpts {
  /** Edge-on frame tones (default EDGE_TONES). */
  edge?: EdgeTones;
  /** Use these sources for the narrow frames (e.g. the motion-LOD face: fewer fine details). */
  fromLod?: PixelCanvas;
  toLod?: PixelCanvas;
  /** Frames narrower than this use the LOD sources (default: half the width). */
  lodBelow?: number;
}

/**
 * The sharp turn from side `from` to side `to` of a card shown w × h: the narrowing frames of
 * `from`, the edge-on frame, the widening frames of `to` and finally `to` at full width — every
 * frame a w × h canvas with the card centred, so a caller swaps textures without moving anything.
 * `from` / `to` are card sides at any source size (rastered to w × h first).
 */
export function turnFrames(from: PixelCanvas, to: PixelCanvas, w: number, h: number, opts: TurnOpts = {}): PixelCanvas[] {
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  const a = rasterCard(from, w, h);
  const b = rasterCard(to, w, h);
  const lodBelow = opts.lodBelow ?? w / 2;
  const aLod = opts.fromLod ? rasterCard(opts.fromLod, w, h) : a;
  const bLod = opts.toLod ? rasterCard(opts.toLod, w, h) : b;
  const { steps, edge } = turnWidths(w);
  const frames: PixelCanvas[] = [];
  for (const s of steps) frames.push(centreIn(squeezeCard(s < lodBelow ? aLod : a, s), w, h));
  frames.push(centreIn(edgeFrame(edge, h, opts.edge), w, h));
  for (const s of [...steps].reverse()) frames.push(centreIn(squeezeCard(s < lodBelow ? bLod : b, s), w, h));
  frames.push(b);
  return frames;
}

/**
 * The whole-pixel display size of a card at logical scale (sx, sy): round(48·|sx|) × round(68·|sy|),
 * at least 1 × 1 (0 = hidden: the caller hides a card scaled to nothing).
 */
export function displaySize(sx: number, sy: number = sx): { w: number; h: number } {
  return { w: Math.max(0, Math.round(CARD_SRC_W * Math.abs(sx))), h: Math.max(0, Math.round(CARD_SRC_H * Math.abs(sy))) };
}

/** Whole-number scale k ≥ 1 when (sx, sy) is one (the static texture can be shown k× instead of a raster). */
export function integerScale(sx: number, sy: number = sx): number | null {
  const a = Math.abs(sx);
  const b = Math.abs(sy);
  if (Math.abs(a - b) > 1e-6) return null;
  const k = Math.round(a);
  return k >= 1 && Math.abs(a - k) < 1e-6 ? k : null;
}
