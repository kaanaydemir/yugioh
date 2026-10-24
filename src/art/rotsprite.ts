// RotSprite — turning pixel art the pixel-art way (Xenowhirl's RotSprite; the A4.1 serpent head
// does the same for its skull). The source is scaled up 8× by three Scale2x passes, which keep its
// diagonals and its 1-px lines as lines, and every output pixel takes the up-scaled pixel under its
// centre, mapped back through the turn. Never a blend, never a new colour: each output pixel shows
// exactly one source pixel, or nothing. At 0° the output is the source, pixel for pixel.
//
// The maps carry source INDICES (y · w + x), not colours: one map serves every recolouring of the
// same shape (a rim in another tone, an overlay frame on the same card) at the cost of a lookup.
// The Scale2x decisions are taken on the `col` values given (−1 = empty), so a caller can decide on
// stand-in colours (e.g. one marker for a rim that is drawn in several tones) and colour later.
//
//   const up = upscale8(colorsOf(px), px.w, px.h);           // once per source (≈ 1 ms for a card)
//   const m = rotMap(up, 3, [24, 34]);                         // per angle (≈ 0.2 ms): indices + pivot
//   const out = paintMap(m, (i) => colourOfSourcePixel(i));   // colours through the map
//   const { px: turned, x, y } = rotSprite(px, 3);             // all three in one (x, y: the pivot)
//   upscale8(edgeDecisions(colorsOf(px), px.w, px.h), …)       // smooth the outline band only
//
// Fine print (measured on the 48 × 68 cards, shots/v3/handarc/build/rotcmp*): Scale2x rounds the
// corners of 1-px strokes, and a sample a little off a pixel's centre then drops such a corner —
// at 1° a card's "1700" reads "1?00". Deciding on edgeDecisions keeps RotSprite's clean steps on the
// outline and the rim while the inside (art, digits) is sampled plain nearest, intact.
//
// Only the samples under output pixel centres are ever read, so the last (biggest) Scale2x pass is
// evaluated on demand at those points; the first two are kept (4× and 16× the source).
// Angle: degrees, positive = clockwise on screen (y down), as a Phaser rotation. Pure (no Phaser).

import { PixelCanvas } from './pixel';

/** The up-scale factor (three Scale2x passes). */
export const ROT_K = 8;

/** A source scaled up 8× (lazily, see the header). */
export interface UpScaled {
  /** Source size. */
  readonly sw: number;
  readonly sh: number;
  /** Up-scaled size (8 · sw × 8 · sh). */
  readonly w: number;
  readonly h: number;
  /** The index of the source pixel the up-scaled pixel (bx, by) shows (−1 = empty or outside). */
  at(bx: number, by: number): number;
}

/** A turned source: per output pixel the index of the source pixel it shows (−1 = empty). */
export interface RotMap {
  readonly w: number;
  readonly h: number;
  /** The angle it was turned by (degrees, clockwise). */
  readonly deg: number;
  /** Where the source's pivot lands in the output (same fraction as the source pivot). */
  readonly px: number;
  readonly py: number;
  /** Source width (index = y · sw + x). */
  readonly sw: number;
  readonly idx: Int32Array;
}

/** The decision colours of a canvas: 0xRRGGBB per pixel, −1 where it is transparent. */
export function colorsOf(px: PixelCanvas): Int32Array {
  const out = new Int32Array(px.w * px.h);
  const d = px.data;
  for (let i = 0, j = 0; i < out.length; i++, j += 4) out[i] = d[j + 3] === 0 ? -1 : (d[j] << 16) | (d[j + 1] << 8) | d[j + 2];
  return out;
}

/**
 * One Scale2x pass (AdvMAME2x) deciding on `col` (−1 = empty; outside the canvas counts as empty)
 * and carrying `idx` along the same choices. Each pixel P becomes four:
 *     A          E0 = C==A && C!=D && A!=B ? A : P      E1 = A==B && A!=C && B!=D ? B : P
 *   C P B        E2 = D==C && D!=B && C!=A ? C : P      E3 = B==D && B!=A && D!=C ? D : P
 *     D
 */
export function scale2x(col: Int32Array, idx: Int32Array, w: number, h: number): { col: Int32Array; idx: Int32Array } {
  const W = w * 2;
  const oc = new Int32Array(W * h * 2);
  const oi = new Int32Array(W * h * 2);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const k = row + x;
      const o = y * 2 * W + x * 2;
      for (let q = 0; q < 4; q++) {
        const r = pick(col, w, h, x, y, k, q);
        const e = r < 0 ? -1 : col[r];
        const oq = o + (q & 1) + (q >> 1) * W;
        oc[oq] = e;
        oi[oq] = e < 0 ? -1 : idx[r];
      }
    }
  }
  return { col: oc, idx: oi };
}

/**
 * The Scale2x choice for quadrant q (0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right) of
 * pixel (x, y) (k = y · w + x): the array position of the pixel whose colour it takes, or −1 when
 * it takes an empty neighbour.
 */
function pick(col: Int32Array, w: number, h: number, x: number, y: number, k: number, q: number): number {
  const P = col[k];
  const A = y > 0 ? col[k - w] : -1;
  const D = y < h - 1 ? col[k + w] : -1;
  const C = x > 0 ? col[k - 1] : -1;
  const B = x < w - 1 ? col[k + 1] : -1;
  switch (q) {
    case 0:
      if (C === A && C !== D && A !== B) return A < 0 ? -1 : k - w;
      break;
    case 1:
      if (A === B && A !== C && B !== D) return B < 0 ? -1 : k + 1;
      break;
    case 2:
      if (D === C && D !== B && C !== A) return C < 0 ? -1 : k - 1;
      break;
    default:
      if (B === D && B !== A && D !== C) return D < 0 ? -1 : k + w;
  }
  return P < 0 ? -1 : k;
}

/** The source (`col`: w × h decision colours, −1 empty) scaled up 8× by three Scale2x passes. */
export function upscale8(col: Int32Array, w: number, h: number): UpScaled {
  let c: Int32Array = col;
  let i: Int32Array = new Int32Array(w * h);
  for (let k = 0; k < i.length; k++) i[k] = c[k] < 0 ? -1 : k;
  let cw = w;
  let ch = h;
  for (let p = 0; p < 2; p++) {
    ({ col: c, idx: i } = scale2x(c, i, cw, ch));
    cw *= 2;
    ch *= 2;
  }
  const c2 = c;
  const i2 = i;
  const w2 = cw;
  const h2 = ch;
  return {
    sw: w,
    sh: h,
    w: w2 * 2,
    h: h2 * 2,
    at(bx: number, by: number): number {
      if (bx < 0 || by < 0 || bx >= w2 * 2 || by >= h2 * 2) return -1;
      const x = bx >> 1;
      const y = by >> 1;
      const r = pick(c2, w2, h2, x, y, y * w2 + x, (bx & 1) + ((by & 1) << 1));
      return r < 0 ? -1 : i2[r];
    },
  };
}

/**
 * Turn an up-scaled source by `deg` about `pivot` (source coordinates, continuous: [24, 34] is the
 * centre of a 48 × 68 card). The output is the turned source's bounding box plus a 1-px margin; the
 * pivot lands on (px, py), which keeps the pivot's fraction, so at 0° the output is the source
 * shifted by whole pixels — pixel for pixel the same.
 * `shift` (source px, |·| ≤ 0.5 is plenty) moves every sample by a fraction of a pixel: it chooses
 * WHERE the steps of a turn fall (a small turn shears whole rows by one pixel every 1 / sin(deg)
 * rows), e.g. so a row of tiny digits sits between two steps instead of being cut by one.
 */
export function rotMap(up: UpScaled, deg: number, pivot: readonly [number, number], shift: readonly [number, number] = [0, 0]): RotMap {
  const [cx, cy] = pivot;
  const [sx0, sy0] = shift;
  const grow = Math.abs(sx0) + Math.abs(sy0);
  const r = (deg * Math.PI) / 180;
  // snap the trig of exact quarter turns (no 6e-17 drift across a block edge)
  const quarter = Math.abs(deg % 90) < 1e-9;
  const cos = quarter ? Math.round(Math.cos(r)) : Math.cos(r);
  const sin = quarter ? Math.round(Math.sin(r)) : Math.sin(r);
  // the turned corners, relative to the pivot
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of [
    [0, 0],
    [up.sw, 0],
    [0, up.sh],
    [up.sw, up.sh],
  ] as const) {
    const dx = x - cx;
    const dy = y - cy;
    const tx = dx * cos - dy * sin;
    const ty = dx * sin + dy * cos;
    minX = Math.min(minX, tx - grow);
    maxX = Math.max(maxX, tx + grow);
    minY = Math.min(minY, ty - grow);
    maxY = Math.max(maxY, ty + grow);
  }
  const fx = cx - Math.floor(cx);
  const fy = cy - Math.floor(cy);
  const eps = 1e-9;
  const px = Math.ceil(-minX - fx - eps) + 1 + fx;
  const py = Math.ceil(-minY - fy - eps) + 1 + fy;
  const w = Math.ceil(px + maxX - eps) + 1;
  const h = Math.ceil(py + maxY - eps) + 1;
  const idx = new Int32Array(w * h).fill(-1);
  const K = ROT_K;
  for (let j = 0; j < h; j++) {
    const dy = j + 0.5 - py;
    for (let i = 0; i < w; i++) {
      const dx = i + 0.5 - px;
      // back through the turn (the inverse rotation), into the up-scaled grid
      idx[j * w + i] = up.at(Math.floor((cx + sx0 + dx * cos + dy * sin) * K), Math.floor((cy + sy0 - dx * sin + dy * cos) * K));
    }
  }
  return { w, h, deg, px, py, sw: up.sw, idx };
}

/** The decision colour edgeDecisions gives every pixel deeper inside than its band (not an RGB value). */
export const INTERIOR = 0x1000000;

/**
 * Decision colours that let Scale2x shape only the silhouette's outer band: the pixels within `band`
 * steps (4-neighbour) of the outside keep their colours, every deeper pixel takes one stand-in
 * colour (INTERIOR). Turned through these, the outline and the band smooth as RotSprite lines while
 * the inside is sampled plain nearest — 1-px glyphs (a card's ATK / DEF digits) keep their corners,
 * which Scale2x would round off and a slightly off-centre sample would then drop.
 */
export function edgeDecisions(col: Int32Array, w: number, h: number, band = 2): Int32Array {
  const BIG = 1 << 20;
  const d = new Int32Array(w * h);
  for (let k = 0; k < d.length; k++) d[k] = col[k] < 0 ? 0 : BIG;
  // city-block distance to the outside (the canvas border counts as outside)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (!d[k]) continue;
      const up = y > 0 ? d[k - w] : 0;
      const left = x > 0 ? d[k - 1] : 0;
      d[k] = Math.min(d[k], up + 1, left + 1);
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const k = y * w + x;
      if (!d[k]) continue;
      const down = y < h - 1 ? d[k + w] : 0;
      const right = x < w - 1 ? d[k + 1] : 0;
      d[k] = Math.min(d[k], down + 1, right + 1);
    }
  const out = new Int32Array(col);
  for (let k = 0; k < out.length; k++) if (d[k] > band) out[k] = INTERIOR;
  return out;
}

/** Paint a map: `color(i)` is the colour of source pixel i (null: leave it empty). */
export function paintMap(m: RotMap, color: (i: number) => number | null, into?: PixelCanvas): PixelCanvas {
  const out = into && into.w === m.w && into.h === m.h ? into.clear() : new PixelCanvas(m.w, m.h);
  const d = out.data;
  for (let k = 0; k < m.idx.length; k++) {
    const i = m.idx[k];
    if (i < 0) continue;
    const c = color(i);
    if (c === null) continue;
    const o = k * 4;
    d[o] = (c >> 16) & 255;
    d[o + 1] = (c >> 8) & 255;
    d[o + 2] = c & 255;
    d[o + 3] = 255;
  }
  return out;
}

/**
 * `src` turned by `deg` about `pivot` (default: its centre), RotSprite style. (x, y): where the
 * pivot lands in the result. One empty pixel is added round the source first, so the silhouette's
 * own corners scale (and turn) as diagonals too.
 */
export function rotSprite(src: PixelCanvas, deg: number, pivot: readonly [number, number] = [src.w / 2, src.h / 2]): { px: PixelCanvas; x: number; y: number } {
  const W = src.w + 2;
  const H = src.h + 2;
  const col = new Int32Array(W * H).fill(-1);
  const inner = colorsOf(src);
  for (let y = 0; y < src.h; y++) col.set(inner.subarray(y * src.w, (y + 1) * src.w), (y + 1) * W + 1);
  const m = rotMap(upscale8(col, W, H), deg, [pivot[0] + 1, pivot[1] + 1]);
  return { px: paintMap(m, (i) => (col[i] < 0 ? null : col[i])), x: m.px, y: m.py };
}

/** An angle snapped to `step`-degree steps (whole steps: the turns a cache can hold). */
export function quantizeDeg(deg: number, step = 1): number {
  const q = Math.round(deg / step) * step;
  return Object.is(q, -0) ? 0 : q;
}
