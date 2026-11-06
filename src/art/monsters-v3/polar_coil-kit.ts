// Kutup Bobini v3 — shared drawing kit of the coil piece (C14). Exported as pure primitives so the Kutup Hükümdarı
// rig can reuse the SAME parts: the coil becomes the sovereign's CHEST (the wound drum with its two-colour core
// window between two magnetite flanges, the two shoulder spools). Everything is drawn by geometry in flat value
// planes measured from the part's own edges (IŞ-3) — the windings are real 3-row wire turns (lit lip, body,
// underside seam) whose lines sag on the cylinder's front, never a gradient or dither.
//
//   - tones: copper wire (warm skin/earth ramp), the light ring that climbs the turns (gold), magnetite
//     (stone + PAL.steel), gold binder, pole lights N = fire, S = water;
//   - paintDrum(): the wound cylinder (turns, the recessed core window, partial winding for the summon / death);
//   - paintSpool(): a shoulder reel face (flange ring, copper wound inside, gold hub, a notch that turns);
//   - flangePoly(): a magnetite disc of the spindle seen from slightly above (two stacked iso ellipses);
//   - bands(): flat lit / mid / shade planes for any part (lit toward the key light and the top rows).

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import { run, type Light } from '../rigkit';
import { planes } from './steel_silencer-kit';

export { Comp, planes } from './steel_silencer-kit';

export type Pt = readonly [number, number];

export interface Tones {
  H: number;
  L: number;
  M: number;
  S: number;
  D: number;
}
/** copper wire: pale shine → rose copper → dark copper → the deep underside */
export const COPPER: Tones = { H: PAL.skin3, L: PAL.fire3, M: PAL.fire2, S: PAL.fire1, D: PAL.fire0 };
/** copper turned away (far whip, far spool) */
export const COPPER_FAR: Tones = { H: PAL.fire3, L: PAL.fire2, M: PAL.fire1, S: PAL.fire0, D: PAL.ink };
/** a turn lit by a climbing light ring */
export const RING: Tones = { H: PAL.white, L: PAL.gold4, M: PAL.gold3, S: PAL.gold2, D: PAL.gold1 };
/** magnetite (the spindle, flanges, head, feet) */
export const MAG: Tones = { H: PAL.stone4, L: PAL.stone3, M: PAL.stone2, S: PAL.stone1, D: PAL.stone0 };
export const MAG_FAR: Tones = { H: PAL.stone3, L: PAL.stone2, M: PAL.stone1, S: PAL.stone0, D: PAL.ink };
export const GOLD: Tones = { H: PAL.gold4, L: PAL.gold3, M: PAL.gold2, S: PAL.gold1, D: PAL.gold0 };
/** pole light ramps (index 0 dim … 3 hot): N = fire, S = water */
export const POLE_N = [PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4] as const;
export const POLE_S = [PAL.water1, PAL.water2, PAL.water3, PAL.water4] as const;

export const TAU = Math.PI * 2;
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const ramp = (t: Tones): readonly number[] => [t.D, t.S, t.M, t.L, t.H];

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

/** An iso ellipse polygon (n points). */
export function ellipsePoly(cx: number, cy: number, rx: number, ry: number, n = 28): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
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

// ---------------------------------------------------------------- the wound drum

/** rows of the drum, bottom → top: 4 turns (12 rows), the core window (3 rows), 3 turns (9 rows) */
export const DRUM_ROWS = 24;
export const WIN_LO = 12;
export const WIN_HI = 14;
/** the drum's full half-width and the turn lines' sag at the front centre */
export const DRUM_RX = 11;
export const DRUM_SAG = 1.6;
/** the bare spindle rod's half-width (x from cx − 2 to cx + 1) */
export const ROD_RX = 2;

export interface DrumSpec {
  /** centre column and the y of the lowest row at the drum's silhouette edge */
  cx: number;
  yb: number;
  /** half-width (DRUM_RX full … ROD_RX bare) */
  rx: number;
  /** wound share 0…1 and from which end the winding exists (0: from the bottom up, 1: from the top down) */
  wind: number;
  fromTop: number;
  /** hit rattle: the odd turns shift by this many px */
  rattle: number;
}

/** Sag of the turn lines at column x: 0 at the drum's edges … DRUM_SAG·(rx/DRUM_RX) at the front centre. */
export function sagAt(x: number, cx: number, rx: number): number {
  const u = (x + 0.5 - cx) / (rx + 0.5);
  const k = DRUM_SAG * Math.min(1, rx / DRUM_RX);
  return Math.round(k * Math.sqrt(Math.max(0, 1 - u * u)));
}

/** Drum row index r (0 = bottom) of pixel (x, y): turn lines sag on the front. */
export function drumRow(x: number, y: number, d: DrumSpec): number {
  return d.yb + sagAt(x, d.cx, d.rx) - y;
}

/** Turn index (0…6, −1 window) and the row inside the turn (0 underside seam, 1 body, 2 lit lip). */
export function turnOf(r: number): [number, number] {
  if (r < WIN_LO) return [Math.floor(r / 3), r % 3];
  if (r <= WIN_HI) return [-1, 0];
  return [4 + Math.floor((r - WIN_HI - 1) / 3), (r - WIN_HI - 1) % 3];
}
export const TURNS = 7;

export function isWound(r: number, d: DrumSpec): boolean {
  const f = (r + 0.5) / DRUM_ROWS;
  return d.fromTop ? f >= 1 - d.wind : f <= d.wind;
}

/**
 * Paints the wound drum (and the bare rod where it is unwound) into q. Cylinder planes by the column's facing
 * (lit toward the key light), each turn: lit lip row / body row / underside seam row.
 */
export function paintDrum(q: PixelCanvas, d: DrumSpec, light: Light): void {
  const cu = ramp(COPPER);
  const mg = ramp(MAG);
  const rxi = Math.round(d.rx);
  for (let x = d.cx - rxi - 1; x <= d.cx + rxi + 1; x++) {
    const s = sagAt(x, d.cx, d.rx);
    for (let rr = 0; rr < DRUM_ROWS; rr++) {
      const y = d.yb + s - rr;
      const [turn, row] = turnOf(rr);
      const wound = isWound(rr, d);
      const dx = wound && turn >= 0 && turn % 2 === 1 ? d.rattle : 0;
      const lx = x - dx;
      const rod = lx >= d.cx - ROD_RX && lx <= d.cx + ROD_RX - 1;
      const inDrum = Math.abs(lx + 0.5 - d.cx) <= d.rx + 0.5;
      if (!wound || d.rx <= ROD_RX + 0.5) {
        if (!rod) continue;
        const k = lx - d.cx;
        const lit = light.side < 0 ? k === -2 : k === 1;
        const sh = light.side < 0 ? k === 1 : k === -2;
        q.set(x, y, lit ? mg[3] : sh ? mg[1] : mg[2]);
        continue;
      }
      if (!inDrum) continue;
      const u = (lx + 0.5 - d.cx) / (d.rx + 0.5);
      const t = u * light.side;
      if (turn < 0) {
        // the core window: the recessed core cylinder (2 px in from the turns), a dark well the core light fills
        const core = Math.abs(lx + 0.5 - d.cx) <= d.rx - 1.5;
        if (!core) continue;
        q.set(x, y, t > 0.55 ? mg[2] : t > -0.6 ? mg[1] : mg[0]);
        continue;
      }
      // cylinder planes: lit band toward the light (its middle carries the specular stripe), mid, shade, dark rim
      const band = t > 0.3 ? 3 : t > -0.45 ? 2 : 1;
      const spec = t > 0.42 && t < 0.78;
      const edge = t < -0.86;
      let c: number;
      if (row === 2) c = spec ? cu[4] : cu[band];
      else if (row === 1) c = cu[band];
      else c = cu[band - 1];
      if (edge) c = row === 0 ? cu[0] : cu[1];
      q.set(x, y, c);
    }
  }
}

// ---------------------------------------------------------------- spindle flanges and spools

/** A magnetite disc of the spindle (radius rx, thickness th) whose top face centre is (cx, cy). */
export function flangePoly(cx: number, cy: number, rx: number, ry: number, th: number): Pt[] {
  // the outline of two stacked ellipses: the top face's back arc, then down the sides and the bottom's front arc
  const pts: Pt[] = [];
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (i / n) * Math.PI;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI;
    pts.push([cx + Math.cos(a) * rx, cy + th + Math.sin(a) * ry]);
  }
  return pts;
}

/** Paints a flange: the top face (lighter, its rim lip gold), the side band (planes) — into q, already filled. */
export function paintFlange(q: PixelCanvas, cx: number, cy: number, rx: number, ry: number, th: number, light: Light, far = false): void {
  const t = far ? MAG_FAR : MAG;
  q.poly(flangePoly(cx, cy, rx, ry, th), t.M);
  bands(q, t, light, 3, 3, { top: 0 });
  // the top face (an ellipse) one value up; its front lip is the gold binder
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const u = (x + 0.5 - cx) / rx;
      const v = (y + 0.5 - cy) / ry;
      const e = u * u + v * v;
      if (e > 1 || !q.isOpaque(x, y)) continue;
      const lit = u * light.side > 0.25;
      q.set(x, y, e > 0.62 && v > 0.2 ? (far ? GOLD.S : GOLD.M) : lit ? t.L : t.M);
    }
  // gold band on the side's front (one row under the face)
  for (let x = Math.floor(cx - rx + 2); x <= Math.ceil(cx + rx - 2); x++) {
    const y = Math.round(cy + th - 1 + ry * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - cx) / rx) ** 2)));
    if (q.isOpaque(x, y) && (x & 3) !== 1) q.set(x, y, far ? GOLD.D : GOLD.S);
  }
}

/**
 * A shoulder spool seen face-on: a magnetite flange ring, copper wound inside (or empty: the bare hub), a gold hub,
 * a dark notch in the flange ring at angle `spin`·TAU (the turn reads from it), a copper glint opposite.
 */
export function paintSpool(q: PixelCanvas, cx: number, cy: number, r: number, spin: number, light: Light, wound: number, far = false): void {
  const mg = far ? MAG_FAR : MAG;
  const cu = far ? COPPER_FAR : COPPER;
  const ls = light.side;
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d > r + 0.35) continue;
      // facing: toward the key light (left-top for P1)
      const f = (dx * ls - dy * 0.9) / Math.max(1, d);
      let c: number;
      if (d > r - 1.6) c = f > 0.35 ? mg.L : f < -0.45 ? mg.S : mg.M;
      else if (d < 1.6) c = f > 0 ? GOLD.L : GOLD.M;
      else if (wound <= 0 || d > 1.6 + (r - 3.2) * wound) c = d < 2.6 ? GOLD.S : mg.D;
      else c = f > 0.3 ? cu.L : f < -0.4 ? cu.S : cu.M;
      q.set(x, y, c);
    }
  // the notch turns in the flange ring; a copper glint on the winding, opposite
  const a = spin * TAU;
  const spokes = r >= 5 ? 3 : 2;
  for (let i = 0; i < spokes; i++) {
    const b = a + (i / spokes) * TAU;
    const nx = Math.round(cx - 0.5 + Math.cos(b) * (r - 0.8));
    const ny = Math.round(cy - 0.5 + Math.sin(b) * (r - 0.8));
    if (q.isOpaque(nx, ny)) q.set(nx, ny, mg.D);
  }
  if (wound > 0.4) {
    const gx = Math.round(cx - 0.5 + Math.cos(a + Math.PI) * (r - 2.6));
    const gy = Math.round(cy - 0.5 + Math.sin(a + Math.PI) * (r - 2.6));
    if (q.isOpaque(gx, gy)) q.set(gx, gy, cu.H);
  }
}
