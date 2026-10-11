// HD render — line work: frame buffers, the selective colored outline, contact-shadow kernels
// and the 4-step pixel drop shadow.
//
//   inner line      1 px on a front part's edge where it lies over another part
//                   (shadow side: the material's line color; lit side: two tones down its ramp)
//   contact shadow  2 px on the parts BEHIND, cast toward the bottom-right (away from the key
//                   light): −2 tones next to the edge, −1 tone one pixel further
//   outline         1 px around the whole silhouette, colored per material: `outline.dark` where
//                   the edge faces away from the light, `outline.lit` where it faces it. Never black.
//   drop shadow     4 nested ellipses under the feet (alpha steps, no dither)

import { PixelCanvas } from '../../art/pixel';
import { PAL } from '../../art/palette';
import type { MatInfo } from './shading';
import type { V2, V3 } from './math';

/** Tone sentinel in frame buffers: the pixel has an explicit color (detail, glint, outline). */
export const FIXED = -128;

export const F_OUTLINE = 1;
export const F_LINE = 2;
export const F_OVERLAY = 4;
export const F_SHADOWED = 8;

/** Composited frame state (structure-of-arrays, reused between frames). */
export class FrameBuffers {
  readonly w: number;
  readonly h: number;
  /** Material slot of the visible pixel (-1 = empty). */
  readonly mat: Int16Array;
  /** Ramp index of the visible pixel, FIXED for explicit colors. Can go below 0 (deep shadow). */
  readonly tone: Int16Array;
  /** Final 0xRRGGBB. */
  readonly col: Int32Array;
  readonly alpha: Uint8Array;
  readonly nx: Float32Array;
  readonly ny: Float32Array;
  readonly nz: Float32Array;
  /** Emissive strength 0..255. */
  readonly emit: Uint8Array;
  /** Index of the part that owns the pixel (-1 = none). */
  readonly part: Int16Array;
  /** Stage copies: lit color before line work, flat albedo color. */
  readonly lit: Int32Array;
  readonly alb: Int32Array;
  readonly flags: Uint8Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.mat = new Int16Array(n);
    this.tone = new Int16Array(n);
    this.col = new Int32Array(n);
    this.alpha = new Uint8Array(n);
    this.nx = new Float32Array(n);
    this.ny = new Float32Array(n);
    this.nz = new Float32Array(n);
    this.emit = new Uint8Array(n);
    this.part = new Int16Array(n);
    this.lit = new Int32Array(n);
    this.alb = new Int32Array(n);
    this.flags = new Uint8Array(n);
    this.reset();
  }

  reset(): void {
    this.mat.fill(-1);
    this.tone.fill(FIXED);
    this.col.fill(0);
    this.alpha.fill(0);
    this.emit.fill(0);
    this.part.fill(-1);
    this.lit.fill(0);
    this.alb.fill(0);
    this.flags.fill(0);
    this.nx.fill(0);
    this.ny.fill(0);
    this.nz.fill(0);
  }

  has(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.alpha[y * this.w + x] > 0;
  }
}

/** Color for a ramp index that may run past the dark end (→ the material's deep outline color). */
export function toneColor(M: MatInfo, t: number): number {
  if (t < 0) return M.m.outline.dark;
  return M.ramp[t >= M.n ? M.n - 1 : t];
}

/**
 * Contact-shadow kernel: pixel offsets from a front part toward the shadow side (opposite the
 * key light) with the number of tone steps they darken. `width` = band width in px (default 2).
 */
export function contactKernel(key: V3, width = 2): [number, number, number][] {
  const lx = -key[0];
  const ly = -key[1];
  const l = Math.hypot(lx, ly) || 1;
  const sx = lx / l;
  const sy = ly / l;
  const out: [number, number, number][] = [];
  for (let dy = -width; dy <= width; dy++)
    for (let dx = -width; dx <= width; dx++) {
      if (!dx && !dy) continue;
      const d = Math.hypot(dx, dy);
      if (d > width + 0.5) continue;
      const along = (dx * sx + dy * sy) / d;
      if (d <= 1.01) {
        // touching pixels: a 1-step occlusion ring all around, 2 steps on the shadow side
        out.push([dx, dy, along > 0.3 ? 2 : along > -0.3 ? 1 : 0]);
      } else if (along > 0.55) {
        out.push([dx, dy, 1]);
      }
    }
  return out.filter((o) => o[2] > 0);
}

/**
 * Selective outline around everything opaque. `skipPart[p]` excludes parts (glow, light).
 * Outline pixels get an outward-facing normal so dynamic side lights catch the silhouette.
 */
export function outlinePass(F: FrameBuffers, mats: MatInfo[], key: V3, skipPart: Uint8Array): void {
  const W = F.w;
  const H = F.h;
  const lx = key[0];
  const ly = key[1];
  const ll = Math.hypot(lx, ly) || 1;
  const add: number[] = [];
  const src = (j: number) => F.alpha[j] > 0 && F.mat[j] >= 0 && !(F.flags[j] & F_OVERLAY) && !(F.part[j] >= 0 && skipPart[F.part[j]]);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (F.alpha[i] > 0) continue;
      // candidate neighbours, shadow-side first so mixed corners take the darker contour
      let best = -1;
      let bdx = 0;
      let bdy = 0;
      let bLit = 2;
      for (let k = 0; k < 4; k++) {
        const dx = k === 0 ? -1 : k === 1 ? 0 : k === 2 ? 1 : 0;
        const dy = k === 0 ? 0 : k === 1 ? -1 : k === 2 ? 0 : 1;
        const sx = x + dx;
        const sy = y + dy;
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
        const j = sy * W + sx;
        if (!src(j)) continue;
        // outward direction from the silhouette pixel to the outline pixel = (-dx, -dy)
        const ox = -dx;
        const oy = -dy;
        const facing = (ox * lx + oy * ly) / ll;
        const nl = F.nx[j] * key[0] + F.ny[j] * key[1] + F.nz[j] * key[2];
        const lit = 0.6 * facing + 0.4 * nl;
        if (lit < bLit) {
          bLit = lit;
          best = j;
          bdx = ox;
          bdy = oy;
        }
      }
      if (best < 0) continue;
      add.push(i, best, bdx, bdy, bLit > 0.2 ? 1 : 0);
    }
  }
  for (let k = 0; k < add.length; k += 5) {
    const i = add[k];
    const j = add[k + 1];
    const M = mats[F.mat[j]];
    const lit = add[k + 4] === 1;
    const c = lit ? M.m.outline.lit : M.m.outline.dark;
    F.col[i] = c;
    F.lit[i] = 0;
    F.alb[i] = 0;
    F.alpha[i] = 255;
    F.mat[i] = F.mat[j];
    F.tone[i] = FIXED;
    F.part[i] = F.part[j];
    F.flags[i] |= F_OUTLINE;
    const ox = add[k + 2];
    const oy = add[k + 3];
    F.nx[i] = ox * 0.7071;
    F.ny[i] = oy * 0.7071;
    F.nz[i] = 0.7071;
  }
}

// ------------------------------------------------------------------ drop shadow

export interface DropShadowOpts {
  /** Shadow color (default PAL.ink — the shadow is drawn with alpha steps). */
  color?: number;
  /** Alpha of the four rings, outside → inside (default 0.16, 0.28, 0.40, 0.52). */
  alphas?: readonly [number, number, number, number];
  /** Ring radii as fractions of rx/ry, outside → inside (default 1, 0.8, 0.6, 0.38). */
  rings?: readonly [number, number, number, number];
}

/**
 * Draw a 4-step pixel drop shadow (ellipse centered at c with radii rx, ry) into a canvas.
 * Only touches transparent pixels when `under` is true (draw it after the sprite).
 */
export function drawDropShadow(p: PixelCanvas, c: V2, rx: number, ry: number, o: DropShadowOpts & { under?: boolean } = {}): void {
  const col = o.color ?? PAL.ink;
  const al = o.alphas ?? [0.16, 0.28, 0.4, 0.52];
  const rr = o.rings ?? [1, 0.8, 0.6, 0.38];
  for (let y = Math.floor(c[1] - ry); y <= Math.ceil(c[1] + ry); y++)
    for (let x = Math.floor(c[0] - rx); x <= Math.ceil(c[0] + rx); x++) {
      const dx = (x + 0.5 - c[0]) / rx;
      const dy = (y + 0.5 - c[1]) / ry;
      const d = Math.sqrt(dx * dx + dy * dy);
      let a = 0;
      for (let k = 3; k >= 0; k--)
        if (d <= rr[k]) {
          a = al[k];
          break;
        }
      if (!a) continue;
      if (o.under && p.isOpaque(x, y)) continue;
      p.set(x, y, col, Math.round(a * 255));
    }
}

/** A standalone drop-shadow sprite (w × h canvas, ellipse centered). */
export function dropShadow(rx: number, ry: number, o: DropShadowOpts = {}): PixelCanvas {
  const w = Math.ceil(rx * 2) + 2;
  const h = Math.ceil(ry * 2) + 2;
  const p = new PixelCanvas(w, h);
  drawDropShadow(p, [w / 2, h / 2], rx, ry, o);
  return p;
}
