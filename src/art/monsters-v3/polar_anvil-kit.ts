// Kutup Örsü v3 — shared shading + geometry of the anvil piece. Exported so the Kutup Hükümdarı rig (the anvil
// becomes the sovereign's hips and base, turned upside down) and the card art can reuse the SAME parts:
//   - tones of the magnetite family (stone + PAL.steel armour, gold binding, N pole fire, S pole water);
//   - `bands()` flat three-band value planes measured from a part's own edges (IŞ-3), per key light;
//   - the anvil's part outlines as point lists in BODY space (origin = the ground point under the base centre,
//     facing right): BASE_POLY (the flared foot block), WAIST, TOP_POLY (heel → face → horn);
//   - field-ring / dust helpers (light, never outlined, IŞ-9).

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
/** the near iron (magnetite: grey stone body, blue steel sheen on the lit band) */
export const IRON: Tones = { L: PAL.steel, M: PAL.stone2, S: PAL.stone1, D: PAL.stone0 };
/** iron turned away / behind the body */
export const IRON_FAR: Tones = { L: PAL.stone2, M: PAL.stone1, S: PAL.stone0, D: PAL.ink };
/** the polished striking face and the maul faces */
export const POLISH: Tones = { L: PAL.white, M: PAL.mist, S: PAL.steel, D: PAL.stone2 };
/** the gold binding (straps, bands, rivets) */
export const GOLD: Tones = { L: PAL.gold3, M: PAL.gold2, S: PAL.gold1, D: PAL.gold0 };
export const GOLD_FAR: Tones = { L: PAL.gold2, M: PAL.gold1, S: PAL.gold0, D: PAL.gold0 };
/** pole colours: N = fire (orange), S = water (blue) */
export const POLE_N = [PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4] as const;
export const POLE_S = [PAL.water1, PAL.water2, PAL.water3, PAL.water4] as const;

export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Flat three-band planes: lit band toward the key light (and the top rows), shade band away / at the bottom. */
export function bands(q: PixelCanvas, t: Tones, light: Light, litW = 2, shW = 2, opt: { top?: number; bottom?: number } = {}): void {
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

/** A chamfered box polygon (corner cut c), x1 / y1 exclusive edges. */
export function boxPoly(x0: number, y0: number, x1: number, y1: number, c = 1): Pt[] {
  return [[x0 + c, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1 - c], [x1 - c, y1], [x0 + c, y1], [x0, y1 - c], [x0, y0 + c]];
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

export const shift = (pts: readonly Pt[], dx: number, dy: number): Pt[] => pts.map(([x, y]) => [x + dx, y + dy] as Pt);

// ---------------------------------------------------------------- the anvil's parts in body space (x right, y up = −)

/** The flared foot block (the sovereign's base): two feet with an arch between them, gold band on top. Top y −11. */
export const BASE_POLY: Pt[] = [
  [-23, 1], [-21, -2], [-17, -5], [-15, -8], [-15, -11], [16, -11], [16, -8], [18, -5], [22, -2], [24, 1],
  [8, 1], [6, -2], [-5, -2], [-7, 1],
];
/** the waist between the base and the top block (height follows the body sink) */
export const WAIST_X0 = -10;
export const WAIST_X1 = 12;
/** The top block relative to its own origin T (heel at the left, horn forward): top face y −29, underside −18. */
export const TOP_POLY: Pt[] = [
  [-25, -28], [-24, -29], [15, -29], [24, -28], [31, -27], [37, -26], [36, -25], [29, -23], [22, -21], [17, -18],
  [-21, -18], [-23, -20], [-25, -21],
];
/** the horn tip (S pole) and the heel plate (N pole) relative to T */
export const HORN_TIP: Pt = [36, -26];
export const HEEL: Pt = [-25, -24];
