// Hurda Akıncıları v3 — shared tones, flat value planes and small geometry helpers of the scrap cart-tank rig.
// Exported so the card art can reuse the same parts. Colours only from PAL: the cart is scrap (stone iron +
// earth rust), the goblins are leaf, the stove and the flag fire (YENI_KARTLAR C5 ramps: stone earth leaf fire).

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import { run, type Light } from '../rigkit';
import { planes } from './steel_silencer-kit';

export { Comp, planes } from './steel_silencer-kit';

export type Pt = readonly [number, number];

export interface Tones {
  L: number;
  M: number;
  S: number;
  D: number;
}
/** scrap iron plates */
export const IRON: Tones = { L: PAL.stone3, M: PAL.stone2, S: PAL.stone1, D: PAL.stone0 };
/** rusty plates */
export const RUST: Tones = { L: PAL.earth3, M: PAL.earth2, S: PAL.earth1, D: PAL.earth0 };
/** wood (spokes, ram beam, flag pole) */
export const WOOD: Tones = { L: PAL.earth4, M: PAL.earth3, S: PAL.earth2, D: PAL.earth1 };
/** goblin skin */
export const SKIN: Tones = { L: PAL.leaf3, M: PAL.leaf2, S: PAL.leaf1, D: PAL.leaf0 };
/** polished steel (wrench, spikes, goggles) */
export const STEEL: Tones = { L: PAL.white, M: PAL.mist, S: PAL.steel, D: PAL.stone2 };
/** brass (hubs, rivets, buckles) */
export const BRASS: Tones = { L: PAL.gold3, M: PAL.gold2, S: PAL.gold1, D: PAL.gold0 };
/** red cloth (the flag, the slinger's scarf) */
export const CLOTH: Tones = { L: PAL.fire3, M: PAL.fire2, S: PAL.fire1, D: PAL.fire0 };
/** leather (vests, caps) */
export const LEATHER: Tones = { L: PAL.earth2, M: PAL.earth1, S: PAL.earth0, D: PAL.ink };

export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Flat three-band planes: lit band toward the key light (and the top rows), shade band away / at the bottom. */
export function bands(q: PixelCanvas, t: Tones, light: Light, litW = 1, shW = 1, opt: { top?: number; bottom?: number } = {}): void {
  const ls = light.side;
  const top = opt.top ?? 1;
  const bottom = opt.bottom ?? 1;
  planes(q, (x, y, src) => {
    const toLight = Math.min(run(src, x, y, ls, -1, litW + 1), run(src, x, y, ls, 0, litW + 1) + 1);
    const up = run(src, x, y, 0, -1, top + 1);
    if (up < top || toLight < litW) return t.L;
    const away = Math.min(run(src, x, y, -ls, 1, shW + 1), run(src, x, y, -ls, 0, shW + 1) + 1);
    const dn = run(src, x, y, 0, 1, bottom + 1);
    if (dn < bottom || away < shW) return t.S;
    return t.M;
  });
}

/** A tube (thick segment) as a polygon with square ends. */
export function tubePoly(a: Pt, b: Pt, w: number, extA = 0, extB = 0): Pt[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const nx = -uy * (w / 2);
  const ny = ux * (w / 2);
  const a2: Pt = [a[0] - ux * extA, a[1] - uy * extA];
  const b2: Pt = [b[0] + ux * extB, b[1] + uy * extB];
  return [[a2[0] + nx, a2[1] + ny], [b2[0] + nx, b2[1] + ny], [b2[0] - nx, b2[1] - ny], [a2[0] - nx, a2[1] - ny]];
}

/** A chamfered box polygon (corner cut c), x1 / y1 exclusive edges. */
export function boxPoly(x0: number, y0: number, x1: number, y1: number, c = 1): Pt[] {
  return [[x0 + c, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1 - c], [x1 - c, y1], [x0 + c, y1], [x0, y1 - c], [x0, y0 + c]];
}

/** a 4-connected 1-px line on q drawn only over q's opaque pixels (no lone diagonal pixels: IŞ-10 noise) */
export function lineIn4(q: PixelCanvas, x0: number, y0: number, x1: number, y1: number, c: number): void {
  let x = x0;
  let y = y0;
  const sx = Math.sign(x1 - x0);
  const sy = Math.sign(y1 - y0);
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  let ix = 0;
  let iy = 0;
  const paint = () => {
    if (q.isOpaque(x, y)) q.set(x, y, c);
  };
  paint();
  while (ix < dx || iy < dy) {
    // step along the axis whose progress lags behind
    if (iy >= dy || (ix < dx && (0.5 + ix) / dx < (0.5 + iy) / dy)) {
      x += sx;
      ix++;
    } else {
      y += sy;
      iy++;
    }
    paint();
  }
}

/** a 1-px line on q drawn only over q's opaque pixels */
export function lineIn(q: PixelCanvas, x0: number, y0: number, x1: number, y1: number, c: number): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n);
    const y = Math.round(y0 + ((y1 - y0) * i) / n);
    if (q.isOpaque(x, y)) q.set(x, y, c);
  }
}
