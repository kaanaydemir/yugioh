// Kutup İğnesi v3 — shared drawing kit of the polar family (C12–C15), written for the needle and meant to be
// reused by the Kutup Hükümdarı builder (the needle becomes the sovereign's arms + compass spear, so the needle
// lozenge, the spear and the compass-rose crown are exported as pure primitives here).
//
//   - tones: polished magnetite (stone ramp + steel rim), the N pole `fire`, the S pole `water`, the `gold` binder;
//   - needle(): a two-faceted compass-needle lozenge at any axis, shaded by facet (the facet whose normal faces
//     the key light is lit, a 1-px ridge highlight on it, a 2-px shade band on the far facet's outer edge — IŞ-3),
//     coloured per zone along its axis (N tip fire, waist magnetite, S tip water, gold collars), poles swappable;
//   - rose(): the compass-rose crown on an iso ellipse, its four points revolving (pixel frames, never a rotated
//     sprite), split in a back and a front half so a head / body can sit between them;
//   - Comp / planes / boxOf: bounding-box part compositor (frame + part-id buffer), as the other hand rigs use.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { DIR4, run, type Light, type SepOpts } from '../rigkit';

export type Pt = readonly [number, number];

export interface Tones {
  /** lit edge / ridge highlight (1 px lines only) */
  H: number;
  L: number;
  M: number;
  S: number;
}
/** Polished magnetite armour (the family's body material). */
export const MAG: Tones = { H: PAL.stone4, L: PAL.stone3, M: PAL.stone2, S: PAL.stone1 };
/** The far side limbs: one value darker. */
export const MAG_FAR: Tones = { H: PAL.stone3, L: PAL.stone2, M: PAL.stone1, S: PAL.stone1 };
/** N pole (K kutbu). */
export const FIRE: Tones = { H: PAL.fire4, L: PAL.fire3, M: PAL.fire2, S: PAL.fire1 };
/** S pole (G kutbu). */
export const WATER: Tones = { H: PAL.water4, L: PAL.water3, M: PAL.water2, S: PAL.water1 };
/** The binder (collars, rings, the pivot). */
export const GOLD: Tones = { H: PAL.gold4, L: PAL.gold3, M: PAL.gold2, S: PAL.gold1 };
export const FIRE_FAR: Tones = { H: PAL.fire3, L: PAL.fire2, M: PAL.fire1, S: PAL.fire1 };
export const WATER_FAR: Tones = { H: PAL.water3, L: PAL.water2, M: PAL.water1, S: PAL.water1 };
export const GOLD_FAR: Tones = { H: PAL.gold3, L: PAL.gold2, M: PAL.gold1, S: PAL.gold1 };
/** The cold arena rim (IŞ-7) on the shadow-side silhouette edge of magnetite. */
export const RIM = PAL.steel;

// ---------------------------------------------------------------- compositor (bounding-box versions)

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Box of the opaque pixels of q, grown by `pad` (clamped); null when empty. */
export function boxOf(q: PixelCanvas, pad = 0): Box | null {
  const { w, h, data } = q;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4 + 3;
    for (let x = 0; x < w; x++)
      if (data[row + x * 4]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  }
  if (x1 < 0) return null;
  return { x0: Math.max(0, x0 - pad), y0: Math.max(0, y0 - pad), x1: Math.min(w - 1, x1 + pad), y1: Math.min(h - 1, y1 + pad) };
}

/** A tone per opaque pixel chosen on a snapshot, visiting only the part's box. */
export function planes(q: PixelCanvas, tone: (x: number, y: number, src: PixelCanvas) => number | null): PixelCanvas {
  const src = q.clone();
  const b = boxOf(q);
  if (!b) return src;
  for (let y = b.y0; y <= b.y1; y++)
    for (let x = b.x0; x <= b.x1; x++) {
      if (!src.isOpaque(x, y)) continue;
      const c = tone(x, y, src);
      if (c !== null) q.set(x, y, c);
    }
  return src;
}

/** Frame + part-id buffer; add() lays a part over the frame, with an optional separation line on what is behind. */
export class Comp {
  readonly p: PixelCanvas;
  readonly id: Uint8Array;
  constructor(p: PixelCanvas) {
    this.p = p;
    this.id = new Uint8Array(p.w * p.h);
  }
  add(q: PixelCanvas, part: number, o: SepOpts = {}): void {
    const { p, id } = this;
    const W = p.w;
    const b = boxOf(q, 1);
    if (!b) return;
    const outs: number[] = [];
    const ins: number[] = [];
    for (let y = b.y0; y <= b.y1; y++)
      for (let x = b.x0; x <= b.x1; x++) {
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
    for (let y = b.y0; y <= b.y1; y++)
      for (let x = b.x0; x <= b.x1; x++) {
        const c = q.get(x, y);
        if (c === null) continue;
        p.set(x, y, c);
        id[y * W + x] = part;
      }
    for (let i = 0; i < ins.length; i += 2) p.set(ins[i], ins[i + 1], o.in!);
  }
}

// ---------------------------------------------------------------- flat bands on any blob (limbs, plates)

/** Three flat bands (IŞ-3): lit band toward the key light and the top, shade band away and at the bottom. */
export function bands(q: PixelCanvas, t: Tones, light: Light, litW = 2, shW = 2, o: { top?: number; bottom?: number; rim?: boolean } = {}): void {
  const ls = light.side;
  const top = o.top ?? 1;
  const bottom = o.bottom ?? 1;
  planes(q, (x, y, src) => {
    const toLight = Math.min(run(src, x, y, ls, -1, litW + 1), run(src, x, y, ls, 0, litW + 1) + 1);
    const up = run(src, x, y, 0, -1, top + 1);
    if (up < top || toLight < litW) return t.L;
    const away = Math.min(run(src, x, y, -ls, 1, shW + 1), run(src, x, y, -ls, 0, shW + 1) + 1);
    const dn = run(src, x, y, 0, 1, bottom + 1);
    if (dn < bottom || away < shW) return t.S;
    return t.M;
  });
  if (o.rim) {
    // a 1-px cold rim on the edge that faces away from the light (silhouette side only)
    const src = q.clone();
    const b = boxOf(q);
    if (!b) return;
    for (let y = b.y0; y <= b.y1; y++)
      for (let x = b.x0; x <= b.x1; x++)
        if (src.isOpaque(x, y) && !src.isOpaque(x - ls, y) && src.isOpaque(x + ls, y) && src.isOpaque(x, y - 1)) q.set(x, y, RIM);
  }
}

// ---------------------------------------------------------------- geometry helpers

export const unit = (a: number): Pt => [Math.cos(a), Math.sin(a)];
export const DEG = Math.PI / 180;

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

/** A tapered tube: width wa at a, wb at b. */
export function taperPoly(a: Pt, b: Pt, wa: number, wb: number): Pt[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l;
  const ny = dx / l;
  return [[a[0] + nx * wa / 2, a[1] + ny * wa / 2], [b[0] + nx * wb / 2, b[1] + ny * wb / 2], [b[0] - nx * wb / 2, b[1] - ny * wb / 2], [a[0] - nx * wa / 2, a[1] - ny * wa / 2]];
}

// ---------------------------------------------------------------- the compass needle

export interface NeedleSpec {
  /** pivot (centre) of the needle, frame px */
  c: Pt;
  /** unit axis toward the N tip */
  d: Pt;
  lenN: number;
  lenS: number;
  /** half width at the pivot */
  hw: number;
  /** half length (px each side of the pivot) of the magnetite waist; beyond it (after a gold collar) the pole colours */
  band: number;
  /** swap the poles (hitMagic: the field flips) */
  flip?: boolean;
  /** far side: one value darker */
  far?: boolean;
  /** a gold pivot cap of this radius at c (0 none) */
  pivot?: number;
  /** gold collar (1 px) between the pole and the magnetite */
  collar?: boolean;
  /** only draw the N half (1) or the S half (−1); both when omitted */
  half?: 1 | -1;
}

/** The lozenge polygon of a needle (N tip, side, S tip, other side). */
export function needlePoly(n: NeedleSpec): Pt[] {
  const { c, d, lenN, lenS, hw } = n;
  const px = -d[1];
  const py = d[0];
  const N: Pt = [c[0] + d[0] * lenN, c[1] + d[1] * lenN];
  const S: Pt = [c[0] - d[0] * lenS, c[1] - d[1] * lenS];
  const A: Pt = [c[0] + px * hw, c[1] + py * hw];
  const B: Pt = [c[0] - px * hw, c[1] - py * hw];
  if (n.half === 1) return [N, A, c, B];
  if (n.half === -1) return [S, B, c, A];
  return [N, A, S, B];
}

/** Paint a shaded compass needle on q (its own layer, frame sized). Returns the layer for chaining. */
export function needle(q: PixelCanvas, n: NeedleSpec, light: Light): PixelCanvas {
  const { c, d, lenN, lenS, hw, band } = n;
  q.poly(needlePoly(n), MAG.M);
  // tips: a 1-px axis line so a thin far-off needle never breaks up
  const px = -d[1];
  const py = d[0];
  const litSign = px * light.v2[0] + py * light.v2[1] > 0 ? 1 : -1;
  const nT = n.flip ? (n.far ? WATER_FAR : WATER) : n.far ? FIRE_FAR : FIRE;
  const sT = n.flip ? (n.far ? FIRE_FAR : FIRE) : n.far ? WATER_FAR : WATER;
  const mT = n.far ? MAG_FAR : MAG;
  const gT = n.far ? GOLD_FAR : GOLD;
  planes(q, (x, y) => {
    const vx = x + 0.5 - c[0];
    const vy = y + 0.5 - c[1];
    const s = vx * d[0] + vy * d[1];
    const w = vx * px + vy * py;
    const len = s >= 0 ? lenN : lenS;
    const half = Math.max(0.5, hw * (1 - Math.abs(s) / len));
    // zones from the pivot out: the magnetite waist (|s| < band), a 1-px gold collar, then the pole colour to the tip
    const a = Math.abs(s);
    let t: Tones;
    if (a < band) t = mT;
    else if (n.collar && a < band + 1.1) t = gT;
    else t = s >= 0 ? nT : sT;
    const lit = Math.sign(w || 0.001) === litSign;
    if (lit) return Math.abs(w) < 0.9 && half > 1.2 && t !== gT ? t.H : t.L;
    return half - Math.abs(w) < (half > 3 ? 1.8 : 1) ? t.S : t.M;
  });
  if (n.pivot && n.pivot > 0) {
    const g = new PixelCanvas(q.w, q.h);
    g.disc(Math.round(c[0] - 0.5), Math.round(c[1] - 0.5), n.pivot, gT.M);
    planes(g, (x, y) => {
      const vx = x + 0.5 - c[0];
      const vy = y + 0.5 - c[1];
      const dl = vx * light.v2[0] + vy * light.v2[1];
      return dl > 0.6 ? gT.L : dl < -0.9 ? gT.S : gT.M;
    });
    q.blit(g, 0, 0);
  }
  return q;
}

// ---------------------------------------------------------------- the compass-rose crown

export interface RoseSpec {
  cx: number;
  cy: number;
  /** spin phase in turns (0…1 = one full revolution) */
  phase: number;
  rx: number;
  ry: number;
  /** point length beyond the ring */
  arm: number;
  flip?: boolean;
  /** draw the gold dial ring (the iso ellipse the points stand on) */
  ring?: boolean;
}

/** Paint the back (sin φ < 0, behind a head) or the front half of the rose crown into q: four flat points on an
 *  iso plane round a pin — N long (fire), S long (water), E / W short (magnetite) — and four tiny gold ticks between. */
export function rose(q: PixelCanvas, r: RoseSpec, front: boolean, light: Light): void {
  const { cx, cy, rx, ry, arm } = r;
  if (r.ring) {
    const n = Math.max(24, Math.round((rx + ry) * 6));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const sy = Math.sin(a);
      if (front ? sy < 0 : sy >= 0) continue;
      const lit = Math.cos(a) * light.side > 0.2;
      q.set(Math.round(cx + Math.cos(a) * rx), Math.round(cy + sy * ry), front ? (lit ? GOLD.L : GOLD.M) : GOLD.S);
    }
  }
  const cols = r.flip ? [WATER, MAG, FIRE, MAG] : [FIRE, MAG, WATER, MAG];
  const lens = [1, 0.62, 1, 0.62];
  for (let k = 0; k < 8; k++) {
    const phi = (r.phase + k / 8) * Math.PI * 2;
    const cs = Math.cos(phi);
    const sn = Math.sin(phi);
    if (front ? sn < 0 : sn >= 0) continue;
    if (k % 2) {
      // gold tick between two points
      const x = Math.round(cx + cs * (rx * 0.75));
      const y = Math.round(cy + sn * (ry * 0.75));
      q.set(x, y, front ? GOLD.L : GOLD.S);
      continue;
    }
    const t = cols[k / 2];
    const L = (rx + arm) * lens[k / 2];
    const tip: Pt = [cx + 0.5 + cs * L, cy + 0.5 + sn * L * (ry / rx)];
    const w = 1.6;
    const b1: Pt = [cx + 0.5 - sn * w, cy + 0.5 + cs * w * 0.6];
    const b2: Pt = [cx + 0.5 + sn * w, cy + 0.5 - cs * w * 0.6];
    const lit = cs * light.side < 0.3;
    q.poly([tip, b1, b2], front ? (lit ? t.L : t.M) : t.S);
    q.line(Math.round(cx), Math.round(cy), Math.round(tip[0] - 0.5), Math.round(tip[1] - 0.5), front ? (lit ? t.H : t.L) : t.M);
  }
}

/** The pin of the rose (a gold bead on a short stem). */
export function rosePin(q: PixelCanvas, cx: number, cy: number, light: Light): void {
  q.rect(cx - 1, cy - 1, 2, 2, GOLD.M);
  q.set(light.side < 0 ? cx - 1 : cx, cy - 1, GOLD.L);
}

/** IŞ-4: lone 1-px tones inside the matter take the colour shared by ≥ 2 of their 4 neighbours (two passes). */
export function cleanCrumbs(p: PixelCanvas, keep?: (c: number) => boolean): void {
  for (let pass = 0; pass < 2; pass++) {
    const src = p.clone();
    const b = boxOf(src);
    if (!b) return;
    for (let y = b.y0; y <= b.y1; y++)
      for (let x = b.x0; x <= b.x1; x++) {
        const c = src.get(x, y);
        if (c === null || (keep && keep(c))) continue;
        const ns = [src.get(x - 1, y), src.get(x + 1, y), src.get(x, y - 1), src.get(x, y + 1)];
        if (ns.includes(c)) continue;
        let best: number | null = null;
        let bn = 1;
        for (const n of ns) {
          if (n === null) continue;
          let k = 0;
          for (const m of ns) if (m === n) k++;
          if (k > bn) {
            bn = k;
            best = n;
          }
        }
        if (best !== null) p.set(x, y, best);
      }
  }
}
