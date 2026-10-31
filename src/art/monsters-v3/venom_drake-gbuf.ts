// Zehir Ejderi (venom_drake) v3 — the frame, the materials and the small raster helpers of the
// scorpion-wyvern rig (venom_drake-rig.ts). Blueprint: docs/v3/kart-a/venom_drake.md §1, §3.
//
// Every part is a flat polygon / tube / ellipse mask shaded by flat value planes measured from its
// own edges (the magus / silencer technique, rigkit `run`): a lit band toward the key light and the
// top, a shade band away from it and underneath, a 1-px crease line on the underside. No gradients,
// no dither in the sprite. The light (venom, eye) is painted after the outline and never outlined.
// Pure, deterministic, Phaser-free.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { DIR4, run, type Light, type SepOpts } from '../rigkit';

/** The frame (a full redesign: no v1 offset; Sİ-5 IoU waived by the owner's "full redesign"). */
export const W = 100;
export const H = 92;
/** Ground line and the anchor (between the hind feet and the planted wing-knuckles). */
export const GY = 86;
export const AX = 48;

export type Pt = readonly [number, number];

// ------------------------------------------------------------------ materials (venomscale & co.)

export interface Tones {
  /** top lit plane */
  L: number;
  /** mid plane */
  M: number;
  /** shadow plane */
  S: number;
  /** crease / underside (never a plane) */
  D: number;
  /** 1-px lit edge (IŞ-8) or null */
  E: number | null;
}

/** venomscale: void0 creases, void1 shadow, void2 mid, mag1 plum lit plane, void3 lit edge. */
export const HIDE: Tones = { L: PAL.mag1, M: PAL.void1, S: PAL.void0, D: PAL.void0, E: PAL.void3 };
/** the far side of the body: one value step darker */
export const HIDE_FAR: Tones = { L: PAL.void2, M: PAL.void1, S: PAL.void0, D: PAL.void0, E: null };
/** chitin / bone: claws, horns, belly plates, the last tail segments, the stinger */
export const CHITIN: Tones = { L: PAL.stone3, M: PAL.stone2, S: PAL.stone1, D: PAL.stone1, E: PAL.stone4 };
export const CHITIN_FAR: Tones = { L: PAL.stone2, M: PAL.stone1, S: PAL.stone1, D: PAL.stone0, E: null };
/** membrane: darker than the hide (it reads as a cape over the flank): void1 lit fold / ribs, void0 web */
export const MEMB: Tones = { L: PAL.void1, M: PAL.void0, S: PAL.void0, D: PAL.ink, E: null };
export const MEMB_FAR: Tones = { L: PAL.void1, M: PAL.void0, S: PAL.void0, D: PAL.ink, E: null };

/** The toxic under-glow rim (IŞ-7): one colour, on the side away from the key light. */
export const RIM = PAL.leaf2;

/** Venom (light, never outlined): deep, body, hot band (leaf3 + gold3 side by side), one gold4 core pixel. */
export const VEN = { deep: PAL.leaf2, body: PAL.leaf3, hot: PAL.gold3, core: PAL.gold4, dark: PAL.leaf1, etch: PAL.leaf0 } as const;

// ------------------------------------------------------------------ helpers

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rnd = Math.round;
export const DEG = Math.PI / 180;

export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export const layer = () => new PixelCanvas(W, H);

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

/** A tone per opaque pixel chosen on a snapshot of the part's mask (only the part's box is visited). */
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

export interface BandOpts {
  /** rows of the lit top plane (default 2) */
  top?: number;
  /** px of the lit band toward the light (default 3) */
  lit?: number;
  /** px of the shade band away from the light (default 2) */
  sh?: number;
  /** rows of the shade band underneath (default 2) */
  bottom?: number;
  /** paint the 1-px lit edge (default true when the tones have one) */
  edge?: boolean;
  /** paint the underside crease line (default true) */
  crease?: boolean;
  /**
   * cel split: a pixel whose distance to the top edge is ≤ `half` × its distance to the bottom edge
   * is lit (the upper part of a rounded form, leaning toward the light); 0 = off (band mode only)
   */
  half?: number;
}

/**
 * Flat value planes (IŞ-3) of a rounded body part: the top rows and the side toward the light are the
 * lit plane, the side away from it and the underside the shadow plane, the last underside row the
 * crease tone, the very top-lit edge the 1-px edge tone.
 */
export function bands(q: PixelCanvas, t: Tones, light: Light, o: BandOpts = {}): void {
  const ls = light.side;
  const top = o.top ?? 2;
  const litW = o.lit ?? 3;
  const shW = o.sh ?? 2;
  const bot = o.bottom ?? 2;
  const edge = (o.edge ?? true) && t.E !== null;
  const crease = o.crease ?? true;
  const half = o.half ?? 0;
  const cap = half > 0 ? 40 : 0;
  planes(q, (x, y, src) => {
    const up = run(src, x, y, 0, -1, Math.max(top + 2, cap));
    const dn = run(src, x, y, 0, 1, Math.max(bot + 2, cap));
    const tl = run(src, x, y, ls, 0, Math.max(litW + 2, cap));
    const ta = run(src, x, y, -ls, 0, Math.max(shW + 2, cap));
    if (crease && dn === 0 && up > 1) return t.D;
    if (edge && up === 0 && tl < litW + 1 && ta > tl) return t.E;
    if (edge && half > 0 && tl === 0 && up > 0 && up < dn && ta > 3) return t.E;
    if (up < top || (tl < litW && (up < top + 3 || half > 0) && dn > bot)) return t.L;
    if (half > 0 && up <= dn * half + (tl < ta ? 1 : -1) && ta > shW - 1) return t.L;
    if (dn < bot || ta < shW) return t.S;
    return t.M;
  });
}

/** The frame being drawn plus a part-id buffer; add() limited to the new part's box (render budget). */
export class Comp {
  readonly p: PixelCanvas;
  readonly id: Uint8Array;
  constructor(p: PixelCanvas) {
    this.p = p;
    this.id = new Uint8Array(p.w * p.h);
  }
  owner(x: number, y: number): number {
    return x >= 0 && y >= 0 && x < W && y < H ? this.id[y * W + x] : 0;
  }
  add(q: PixelCanvas, part: number, o: SepOpts = {}): void {
    const { p, id } = this;
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

/** A tube (thick segment) as a polygon. */
export function tubePoly(a: Pt, b: Pt, w0: number, w1 = w0): Pt[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l;
  const ny = dx / l;
  return [
    [a[0] + (nx * w0) / 2, a[1] + (ny * w0) / 2],
    [b[0] + (nx * w1) / 2, b[1] + (ny * w1) / 2],
    [b[0] - (nx * w1) / 2, b[1] - (ny * w1) / 2],
    [a[0] - (nx * w0) / 2, a[1] - (ny * w0) / 2],
  ];
}

/** Two-link IK: the joint between a and b for segment lengths l1, l2 (bend ±1 picks the side). */
export function ik(a: Pt, b: Pt, l1: number, l2: number, bend: number): Pt {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = clamp(Math.hypot(dx, dy), 1e-3, l1 + l2 - 1e-3);
  const ca = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const base = Math.atan2(dy, dx);
  const ang = base + bend * Math.acos(ca);
  return [a[0] + Math.cos(ang) * l1, a[1] + Math.sin(ang) * l1];
}
