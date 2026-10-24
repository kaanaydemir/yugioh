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
//   const up = upscale8(colorsOf(px), px.w, px.h);           // once per source (≈ 0.3 ms for a card)
//   const m = rotMap(up, 3, [24, 34]);                         // per angle (≈ 0.06 ms): indices + pivot
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
// evaluated on demand at those points; the 4× level is kept as source indices only (an up-scaled
// pixel's colour is its source pixel's), and a source pixel inside a 3 × 3 of one decision colour —
// most of a card, its inside being one stand-in — is read straight from the source grid (no
// Scale2x choice reaches it). nearest8: the same turn without Scale2x (plain nearest), for frames
// too brief for its corners to matter.
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
  /**
   * Per source pixel: 1 when its 3 × 3 neighbourhood is one decision colour (then every up-scaled
   * pixel inside it shows it — no Scale2x choice reaches in), 2 when it is all empty (all show
   * nothing), else 0. A turn reads such pixels straight from the source grid.
   */
  readonly flat?: Uint8Array;
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
 * (A == D or B == C rules all four out — the uniform inside of a sprite costs one test.)
 */
export function scale2x(col: Int32Array, idx: Int32Array, w: number, h: number): { col: Int32Array; idx: Int32Array } {
  const oc = new Int32Array(w * h * 4);
  const oi = new Int32Array(w * h * 4);
  pass2x(col, idx, w, h, oc, oi);
  return { col: oc, idx: oi };
}

/**
 * scale2x into `oc` / `oi` (2w × 2h). `oc` null: the colours are not kept — an up-scaled pixel's
 * colour is its source pixel's (each one shows exactly one source pixel), so the last kept level
 * stores indices only.
 */
function pass2x(col: Int32Array, idx: ArrayLike<number>, w: number, h: number, oc: Int32Array | null, oi: Int32Array | Int16Array): void {
  const W = w * 2;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    const o0 = y * 2 * W;
    for (let x = 0; x < w; x++) {
      const k = row + x;
      const P = col[k];
      const pi = P < 0 ? -1 : idx[k];
      const A = y > 0 ? col[k - w] : -1;
      const D = y < h - 1 ? col[k + w] : -1;
      const C = x > 0 ? col[k - 1] : -1;
      const B = x < w - 1 ? col[k + 1] : -1;
      let e0 = P;
      let e1 = P;
      let e2 = P;
      let e3 = P;
      let i0 = pi;
      let i1 = pi;
      let i2 = pi;
      let i3 = pi;
      if (A !== D && C !== B) {
        // with A != D and C != B, each rule's other two tests hold by themselves
        if (C === A) {
          e0 = A;
          i0 = A < 0 ? -1 : idx[k - w];
        }
        if (A === B) {
          e1 = B;
          i1 = B < 0 ? -1 : idx[k + 1];
        }
        if (D === C) {
          e2 = C;
          i2 = C < 0 ? -1 : idx[k - 1];
        }
        if (B === D) {
          e3 = D;
          i3 = D < 0 ? -1 : idx[k + w];
        }
      }
      const o = o0 + 2 * x;
      if (oc) {
        oc[o] = e0;
        oc[o + 1] = e1;
        oc[o + W] = e2;
        oc[o + W + 1] = e3;
      }
      oi[o] = i0;
      oi[o + 1] = i1;
      oi[o + W] = i2;
      oi[o + W + 1] = i3;
    }
  }
}

/**
 * The source (`col`: w × h decision colours, −1 empty) scaled up 8× by three Scale2x passes. Kept:
 * the 4× level's source indices (16-bit for a source up to 32767 px: ≈ 120 KB for a 52 × 72 card)
 * and the source's decision colours; the 8× pass is read at the samples only.
 */
export function upscale8(col: Int32Array, w: number, h: number): UpScaled {
  const src = Int32Array.from(col);
  const i0 = new Int32Array(w * h);
  for (let k = 0; k < i0.length; k++) i0[k] = src[k] < 0 ? -1 : k;
  const w1 = w * 2;
  const h1 = h * 2;
  const c1 = new Int32Array(w1 * h1);
  const x1 = new Int32Array(w1 * h1);
  pass2x(src, i0, w, h, c1, x1);
  const w2 = w1 * 2;
  const h2 = h1 * 2;
  const x2: Int16Array | Int32Array = w * h <= 32767 ? new Int16Array(w2 * h2) : new Int32Array(w2 * h2);
  pass2x(c1, x1, w1, h1, null, x2);
  // a 4× pixel's decision colour: its source pixel's
  const c2 = (k: number): number => {
    const i = x2[k];
    return i < 0 ? -1 : src[i];
  };
  const W8 = w2 * 2;
  const H8 = h2 * 2;
  return {
    sw: w,
    sh: h,
    w: W8,
    h: H8,
    flat: flatOf(src, w, h),
    at(bx: number, by: number): number {
      if (bx < 0 || by < 0 || bx >= W8 || by >= H8) return -1;
      const x = bx >> 1;
      const y = by >> 1;
      const k = y * w2 + x;
      const pi = x2[k];
      const A = y > 0 ? c2(k - w2) : -1;
      const D = y < h2 - 1 ? c2(k + w2) : -1;
      const C = x > 0 ? c2(k - 1) : -1;
      const B = x < w2 - 1 ? c2(k + 1) : -1;
      if (A !== D && C !== B)
        switch ((bx & 1) + ((by & 1) << 1)) {
          case 0:
            if (C === A) return A < 0 ? -1 : x2[k - w2];
            break;
          case 1:
            if (A === B) return B < 0 ? -1 : x2[k + 1];
            break;
          case 2:
            if (D === C) return C < 0 ? -1 : x2[k - 1];
            break;
          default:
            if (B === D) return D < 0 ? -1 : x2[k + w2];
        }
      return pi;
    },
  };
}

/**
 * The source pixels no Scale2x choice can change (UpScaled.flat): a 3 × 3 of one decision colour,
 * outside the canvas counting as empty — 1 (shows itself), 2 (all empty), else 0.
 */
function flatOf(src: Int32Array, w: number, h: number): Uint8Array {
  // per pixel: its row neighbours match it; then the rows above and below must match it too
  const row = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      const c = src[k];
      row[k] = (x > 0 ? src[k - 1] : -1) === c && (x < w - 1 ? src[k + 1] : -1) === c ? 1 : 0;
    }
  const flat = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (!row[k]) continue;
      const c = src[k];
      const up = y > 0 ? row[k - w] === 1 && src[k - w] === c : c < 0;
      const dn = y < h - 1 ? row[k + w] === 1 && src[k + w] === c : c < 0;
      if (up && dn) flat[k] = c < 0 ? 2 : 1;
    }
  return flat;
}

/**
 * The source on the 8× grid WITHOUT Scale2x: a turn of it is plain nearest sampling (every pixel
 * flat). For frames shown too briefly for RotSprite's corners to matter — a flip's narrow turn
 * frames (≈ 35 ms each): a card's long straight edges step the same either way; Scale2x only
 * shapes its cut corners.
 */
export function nearest8(col: Int32Array, w: number, h: number): UpScaled {
  const src = Int32Array.from(col);
  const flat = new Uint8Array(w * h);
  for (let k = 0; k < flat.length; k++) flat[k] = src[k] < 0 ? 2 : 1;
  return {
    sw: w,
    sh: h,
    w: w * ROT_K,
    h: h * ROT_K,
    flat,
    at(bx: number, by: number): number {
      const x = Math.floor(bx / ROT_K);
      const y = Math.floor(by / ROT_K);
      return x < 0 || y < 0 || x >= w || y >= h || src[y * w + x] < 0 ? -1 : y * w + x;
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
  const flat = up.flat;
  const sw = up.sw;
  const sh = up.sh;
  for (let j = 0; j < h; j++) {
    const dy = j + 0.5 - py;
    for (let i = 0; i < w; i++) {
      const dx = i + 0.5 - px;
      // back through the turn (the inverse rotation), into the up-scaled grid
      const bx = Math.floor((cx + sx0 + dx * cos + dy * sin) * K);
      const by = Math.floor((cy + sy0 - dx * sin + dy * cos) * K);
      if (flat) {
        // inside a source pixel no Scale2x choice reaches: the source grid answers
        const x = bx >> 3;
        const y = by >> 3;
        if (x >= 0 && y >= 0 && x < sw && y < sh) {
          const f = flat[y * sw + x];
          if (f === 1) {
            idx[j * w + i] = y * sw + x;
            continue;
          }
          if (f === 2) continue;
        }
      }
      idx[j * w + i] = up.at(bx, by);
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
