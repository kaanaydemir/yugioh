// Kum Saati Cücesi v3 — the small drawing kit of the rig (docs/v3/oturum-f/hourglass_imp.md §2–§3): bounding-box
// versions of rigkit planes / PartComp (they visit only the part's own box), flat three-band part shading, the tone
// sets, and the "turn to sand" recolour (summon sculpt, death drying). Colours only from PAL: felt fire0–fire2, brass
// gold1–gold2, skin1–skin3 (+ skin4 nose glint), coat night2–night4, wood / leather earth0–earth2, glass night1 + mist,
// sand earth3–earth4. gold3 / gold4 are LIGHT only (the stream, the landing grain, the eyes), never a body tone.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { DIR4, run, type Light, type SepOpts } from '../rigkit';

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
export function planes(q: PixelCanvas, tone: (x: number, y: number, src: PixelCanvas) => number | null): void {
  const src = q.clone();
  const b = boxOf(q);
  if (!b) return;
  for (let y = b.y0; y <= b.y1; y++)
    for (let x = b.x0; x <= b.x1; x++) {
      if (!src.isOpaque(x, y)) continue;
      const c = tone(x, y, src);
      if (c !== null) q.set(x, y, c);
    }
}

/** Frame + part-id buffer; add() lays a part, optionally drawing a one-step-darker seam where it covers others. */
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

export interface Tones {
  L: number;
  M: number;
  S: number;
}
export const FELT: Tones = { L: PAL.fire2, M: PAL.fire1, S: PAL.fire0 };
export const SKIN: Tones = { L: PAL.skin3, M: PAL.skin2, S: PAL.skin1 };
export const SKIN_FAR: Tones = { L: PAL.skin2, M: PAL.skin1, S: PAL.skin1 };
export const COAT: Tones = { L: PAL.night4, M: PAL.night3, S: PAL.night2 };
export const COAT_FAR: Tones = { L: PAL.night3, M: PAL.night2, S: PAL.night2 };
export const WOOD: Tones = { L: PAL.earth2, M: PAL.earth1, S: PAL.earth0 };
export const BRASS: Tones = { L: PAL.gold2, M: PAL.gold2, S: PAL.gold1 };
export const SAND: Tones = { L: PAL.earth4, M: PAL.earth3, S: PAL.earth2 };

/** Flat three-band planes (IŞ-3): lit band toward the key light (and the top), shade band away / at the bottom. */
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

/** Body tone → its "dry sand" tone (summon sculpt / death drying): light planes stay light, so the form survives. */
export const TO_SAND: ReadonlyMap<number, number> = new Map<number, number>([
  [PAL.skin4, PAL.earth4], [PAL.skin3, PAL.earth4], [PAL.skin2, PAL.earth3], [PAL.skin1, PAL.earth2], [PAL.skin0, PAL.earth2],
  [PAL.night4, PAL.earth4], [PAL.night3, PAL.earth3], [PAL.night2, PAL.earth2],
  [PAL.fire2, PAL.earth4], [PAL.fire1, PAL.earth3], [PAL.fire0, PAL.earth2],
  [PAL.gold2, PAL.earth4], [PAL.gold1, PAL.earth3],
  [PAL.earth2, PAL.earth3], [PAL.earth1, PAL.earth2], [PAL.earth0, PAL.earth2],
]);

/** Deterministic hash in [0, 1). */
export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
