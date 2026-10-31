// Yansıyan Okçu v3 — drawing kit: tones, the bounding-box compositor, flat bands, tube / taper polygons and the
// crumb pass. Pure, Phaser-free; shared by the rig and the card art (cardart-v3/reflection_archer.ts).
//
// Materials (YENI_KARTLAR §C4: gold light-bow, mist / white body, night + water darks for the reflection, no teal):
//   LIGHT  the light-woven body (bodice, arms, face): white lit plane, mist body, steel shade; glass edge water4
//   ROBE   the moon-blue tabard and boots: night4 lit, night3 body, night2 shade
//   GOLD   the crescent bow, the moon crown, trims
//   REFL   the inverted reflection in the puddle: night0 / night1 body, night2 lit, water2 glass edge
//   POOL   the light puddle: night3 surface, night4 / steel bands toward the far (lit) rim, mist rim line

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { DIR4, run, type Light, type SepOpts } from '../rigkit';

export type Pt = readonly [number, number];

export interface Tones {
  /** 1-px lit edge only */
  H: number;
  L: number;
  M: number;
  S: number;
}
export const LIGHTW: Tones = { H: PAL.white, L: PAL.white, M: PAL.mist, S: PAL.steel };
export const LIGHTW_FAR: Tones = { H: PAL.mist, L: PAL.mist, M: PAL.steel, S: PAL.night4 };
export const ROBE: Tones = { H: PAL.steel, L: PAL.night4, M: PAL.night3, S: PAL.night2 };
export const ROBE_FAR: Tones = { H: PAL.night4, L: PAL.night3, M: PAL.night2, S: PAL.night1 };
export const GOLD: Tones = { H: PAL.gold4, L: PAL.gold3, M: PAL.gold2, S: PAL.gold1 };
export const GOLD_FAR: Tones = { H: PAL.gold3, L: PAL.gold2, M: PAL.gold1, S: PAL.gold1 };
/** The glass edge (IŞ-7: one rim colour per material) on the light body's shadow-side silhouette. */
export const GLASS = PAL.water4;

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

// ---------------------------------------------------------------- flat bands (IŞ-3)

/** Three flat bands measured from the part's own edges: lit toward the key light and the top, shade away and below;
 *  `rim` puts the 1-px glass edge on the silhouette side away from the light (IŞ-7). */
export function bands(q: PixelCanvas, t: Tones, light: Light, litW = 2, shW = 2, o: { top?: number; bottom?: number; rim?: number } = {}): void {
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
  if (o.rim !== undefined) {
    const src = q.clone();
    const b = boxOf(q);
    if (!b) return;
    for (let y = b.y0; y <= b.y1; y++)
      for (let x = b.x0; x <= b.x1; x++)
        if (src.isOpaque(x, y) && !src.isOpaque(x - ls, y) && src.isOpaque(x + ls, y) && src.isOpaque(x, y - 1) && src.isOpaque(x, y + 1)) q.set(x, y, o.rim);
  }
}

// ---------------------------------------------------------------- geometry

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
  return [[a[0] + (nx * wa) / 2, a[1] + (ny * wa) / 2], [b[0] + (nx * wb) / 2, b[1] + (ny * wb) / 2], [b[0] - (nx * wb) / 2, b[1] - (ny * wb) / 2], [a[0] - (nx * wa) / 2, a[1] - (ny * wa) / 2]];
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

/** Deterministic hash in [0, 1). */
export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
