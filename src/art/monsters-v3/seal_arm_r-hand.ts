// Sağ Kol Mührü v3 — the fist. Painted upright on its own layer from plates (every plate a chamfered obsidian slab with
// its own flat bands, so the plates read as separate stones), then leaned with the arm: a row shear for small angles (a
// pixel-art lean: horizontal creases stay intact) and RotSprite for the big turns (cock-back, droop, grip on the lip).
//
// Local frame: origin = the wrist's top centre, +x right, +y down (the fist rises into negative y), light from `light`.
// Closed fist, 24 × 21 px: a lit side plane on the left, four knuckle plates in an arc (the middle finger highest), the four
// curled finger plates under them, a fat thumb slab across the lower fingers and the heel of the palm down to the wrist.
// The open hand (grip ≥ 3) reuses the knuckle plates as the backs of the fingers' roots and lifts each finger as a bar of
// two phalanx plates; the thumb can lift or stand out.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { rotSprite } from '../rotsprite';
import type { Light } from '../rigkit';
import { OBS, OBS_FAR, bands, chamfer, layer, release, type Pt, type Tones } from './seal_arm_r-kit';

/** Canvas of the hand layer and where the wrist's top centre sits on it. */
export const HW = 64;
export const HH = 64;
export const HOX = 32;
export const HOY = 46;

export interface HandState {
  /** 0 tight · 1 rest · 2 loose · 3 half-open (fingers bent up) · 4 open / splayed · 5 curled hook (revive grip) */
  grip: number;
  /** thumb: 0 across the fingers · 1 lifted off them · 2 standing out */
  thumb: number;
  /** extra dx / dy of the four knuckle plates (the plates shudder one by one) */
  kx: readonly [number, number, number, number];
  ky: readonly [number, number, number, number];
  /** dy of the four finger-curl plates (the fingers tighten) */
  fy: readonly [number, number, number, number];
  /** dy / dx of the side plane and of the thumb slab */
  sy: number;
  ty: number;
  tx: number;
  /** a hairline crack across the back plate (hitHeavy / death) */
  crack: number;
  /** mask of finger-curl plates / knuckle plates that have fallen off (death): bit i = finger i */
  gone: number;
  /** extra spread of the open fingers (splay) */
  splay: number;
}

export const HAND0: HandState = { grip: 1, thumb: 0, kx: [0, 0, 0, 0], ky: [0, 0, 0, 0], fy: [0, 0, 0, 0], sy: 0, ty: 0, tx: 0, crack: 0, gone: 0, splay: 0 };

// corner-grid x edges of the five columns: side plane, then four fingers
const XE = [-12, -8, -3, 2, 7, 12];
// knuckle tops (the arc: middle finger highest) and the row split
const KTOP = [-19, -21, -20, -17];
const KBOT = -13;

interface Plate {
  id: number;
  pts: Pt[];
  t: Tones;
  litW: number;
  shW: number;
  top?: number;
  bottom?: number;
  edge?: number;
}

const shift = (pts: readonly Pt[], dx: number, dy: number): Pt[] => pts.map(([x, y]) => [x + dx, y + dy] as Pt);

/** The plates of the hand for a state, back to front. */
export function handPlates(s: HandState): Plate[] {
  const out: Plate[] = [];
  const g = s.grip;
  const open = g >= 3;
  let id = 1;

  // heel of the palm (down to the wrist, 16 wide at y = 0)
  out.push({ id: id++, t: OBS_FAR, litW: 2, shW: 3, top: 1, bottom: 1, pts: [[-8, 0], [8, 0], [11, -4], [12, -9], [-12, -9], [-10, -4]] });

  // the side plane (the left face of the fist)
  out.push({ id: id++, t: OBS, litW: 2, shW: 1, top: 1, bottom: 1, edge: 3, pts: shift(chamfer(-12, -17, -8, -4, [3, 0, 0, 2]), 0, s.sy) });

  if (!open) {
    // finger-curl plates (second row)
    for (let i = 0; i < 4; i++) {
      if (s.gone & (1 << i)) continue;
      const x0 = XE[i + 1];
      const x1 = XE[i + 2];
      const tight = g === 0 ? -1 : g === 2 ? 1 : 0;
      const yT = KBOT + (i === 3 ? 2 : 0);
      const yB = -5 + (i === 3 ? -1 : 0) + tight + s.fy[i];
      out.push({ id: id++, t: OBS, litW: 1, shW: 1, top: 1, bottom: 1, pts: chamfer(x0, yT, x1, yB, [0, 0, i === 3 ? 2 : 1, i === 0 ? 2 : 1]) });
    }
  } else {
    // the palm face where the fingers have lifted
    out.push({ id: id++, t: OBS_FAR, litW: 2, shW: 2, top: 1, bottom: 1, pts: chamfer(-8, KBOT, 12, -4, [0, 0, 2, 2]) });
  }

  // knuckle plates (the arc), or in the open hand the roots of the fingers
  for (let i = 0; i < 4; i++) {
    if (s.gone & (1 << i)) continue;
    const x0 = XE[i + 1] + s.kx[i];
    const x1 = XE[i + 2] + s.kx[i];
    const yT = KTOP[i] + s.ky[i] + (g === 2 ? -1 : 0) + (g === 0 ? 1 : 0);
    const yB = KBOT + (open ? -1 : 0) + s.ky[i];
    out.push({ id: id++, t: OBS, litW: 2, shW: 2, top: 1, bottom: 1, edge: 3, pts: chamfer(x0, yT, x1, yB, [i === 0 ? 3 : 2, i === 3 ? 3 : 2, 0, 0]) });
  }

  if (open) {
    // fingers: two phalanx bars each, rising from the knuckle plates
    const len = g === 3 ? [6, 8, 7, 5] : g === 5 ? [5, 6, 6, 4] : [10, 12, 11, 8];
    const sp = s.splay;
    for (let i = 0; i < 4; i++) {
      if (s.gone & (1 << i)) continue;
      const x0 = XE[i + 1] + 1 + (i - 1.5 > 0 ? Math.ceil(sp * (i - 1.5)) : Math.floor(sp * (i - 1.5))) + s.kx[i];
      const x1 = x0 + 4;
      const yBase = KTOP[i] + s.ky[i];
      const yMid = yBase - Math.ceil(len[i] * 0.55);
      const yTip = yBase - len[i];
      const bend = g === 5 ? 2 : 0;
      out.push({ id: id++, t: OBS, litW: 1, shW: 1, top: 1, bottom: 1, pts: chamfer(x0, yMid, x1, yBase + 1, [0, 0, 0, 0]) });
      out.push({ id: id++, t: OBS, litW: 1, shW: 1, top: 1, bottom: 1, edge: 2, pts: chamfer(x0 + bend, yTip, x1 + bend, yMid, [1, 1, 0, 0]) });
    }
  }

  // the thumb: a fat slab across the lower fingers (closed), lifted off them, or standing out to the left
  if (s.thumb === 0) {
    out.push({ id: id++, t: OBS, litW: 2, shW: 2, top: 1, bottom: 1, edge: 4, pts: shift([[-11, -6], [-10, -10], [-4, -12], [3, -12], [6, -10], [5, -7], [-2, -4], [-9, -3]], s.tx, s.ty) });
  } else if (s.thumb === 1) {
    out.push({ id: id++, t: OBS, litW: 2, shW: 2, top: 1, bottom: 1, edge: 4, pts: shift([[-12, -8], [-11, -12], [-5, -14], [1, -13], [3, -11], [1, -8], [-4, -5], [-10, -4]], s.tx, s.ty - 1) });
  } else {
    out.push({ id: id++, t: OBS, litW: 2, shW: 2, top: 1, bottom: 1, edge: 3, pts: shift([[-19, -14], [-17, -19], [-13, -18], [-9, -12], [-8, -6], [-13, -5], [-17, -8]], s.tx, s.ty) });
  }
  return out;
}

/** Paint the hand upright on a fresh layer (not outlined, not leaned). */
export function paintHand(s: HandState, light: Light): PixelCanvas {
  const L = layer(HW, HH);
  const comp = new HandComp(L);
  for (const pl of handPlates(s)) {
    const q = layer(HW, HH);
    q.poly(shift(pl.pts, HOX, HOY), PAL.stone1);
    bands(q, pl.t, light, pl.litW, pl.shW, { top: pl.top, bottom: pl.bottom, edge: pl.edge });
    comp.add(q, pl);
  }
  // hairline crack across the back plate
  if (s.crack > 0) {
    const c = PAL.void0;
    const pts: Pt[] = [[-3, -20], [-2, -17], [-4, -15], [-2, -13]];
    for (let i = 0; i + 1 < pts.length; i++) L.line(HOX + pts[i][0], HOY + pts[i][1], HOX + pts[i + 1][0], HOY + pts[i + 1][1], c);
  }
  return L;
}

/** Layer compositor for the hand: plates lay over earlier ones with a 1-px crease painted on the earlier plate. */
class HandComp {
  constructor(readonly L: PixelCanvas) {}
  add(q: PixelCanvas, _pl: Plate): void {
    const { L } = this;
    // crease under the new plate: earlier pixels touching it
    const w = L.w;
    const h = L.h;
    const mark: number[] = [];
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        if (q.isOpaque(x, y) || !L.isOpaque(x, y)) continue;
        if (q.isOpaque(x - 1, y) || q.isOpaque(x + 1, y) || q.isOpaque(x, y - 1) || q.isOpaque(x, y + 1)) mark.push(x, y);
      }
    for (let i = 0; i < mark.length; i += 2) L.set(mark[i], mark[i + 1], PAL.void0);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const c = q.get(x, y);
        if (c !== null) L.set(x, y, c);
      }
    release(q);
  }
}

/** Row shear of a layer by an angle (deg, + = leans right going up) about the wrist row: horizontal lines stay intact. */
export function shearRows(src: PixelCanvas, deg: number): PixelCanvas {
  const k = Math.tan((deg * Math.PI) / 180);
  const out = layer(src.w, src.h);
  for (let y = 0; y < src.h; y++) {
    const dx = Math.round((HOY - y) * k);
    for (let x = 0; x < src.w; x++) {
      const c = src.get(x, y);
      if (c === null) continue;
      const nx = x + dx;
      if (nx >= 0 && nx < out.w) out.set(nx, y, c);
    }
  }
  return out;
}

/** The hand turned by `deg` about the wrist (shear when small, RotSprite when large). Returns a fresh layer. */
export function turnHand(src: PixelCanvas, deg: number): PixelCanvas {
  if (deg === 0) return src;
  if (Math.abs(deg) <= 12) {
    const r = shearRows(src, deg);
    release(src);
    return r;
  }
  const t = rotSprite(src, deg, [HOX, HOY]);
  release(src);
  const out = layer(HW, HH);
  // rotSprite returns the turned bitmap and where the pivot lands in it: put that point back on the wrist
  out.blit(t.px, HOX - t.x, HOY - t.y);
  return out;
}
