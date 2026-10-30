// Shared paint helpers for the spell/trap batch 1 placeholder pictures (docs/KART_TASLAGI_BUYU_TUZAK.md).
// Each picture is a small, readable motif per card family:
//   card flow (book / cycle) · tribute altar · control (seal + kneeling figure) · combat (burst) ·
//   equip (lance, amulet) · field scenes (bay, cavern, square) · purge wave · counter / battle traps.
// Underscore-prefixed: not picked up by the artwork registry (index.ts globs './*.ts' minus '_*.ts').
import { PAL, type Ramp } from '../palette';
import { PixelCanvas, type Pt } from '../pixel';
import { artGlow, artRng, artSparkle, artVGrad } from './index';

export const W = 44;
export const H = 34;
export { artGlow, artRng, artSparkle, artVGrad };

/** A small tilted card icon (face colour + rim), centred on (cx, cy). */
export function miniCard(p: PixelCanvas, cx: number, cy: number, w: number, h: number, ang: number, face: number, rim: number, mark?: number): void {
  const hw = w / 2;
  const hh = h / 2;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const pt = (x: number, y: number): Pt => [cx + x * c - y * s, cy + x * s + y * c];
  p.poly([pt(-hw - 1, -hh - 1), pt(hw + 1, -hh - 1), pt(hw + 1, hh + 1), pt(-hw - 1, hh + 1)], PAL.ink);
  p.poly([pt(-hw, -hh), pt(hw, -hh), pt(hw, hh), pt(-hw, hh)], rim);
  p.poly([pt(-hw + 1, -hh + 1), pt(hw - 1, -hh + 1), pt(hw - 1, hh - 1), pt(-hw + 1, hh - 1)], face);
  if (mark !== undefined) p.disc(cx, cy, Math.max(1, Math.min(w, h) * 0.18), mark);
}

/** Straight arrow with a head, `body` shaft and `core` highlight. */
export function arrow(p: PixelCanvas, x0: number, y0: number, x1: number, y1: number, body: number, core: number, head = 3): void {
  p.thickLine(x0, y0, x1, y1, 2, PAL.ink);
  p.thickLine(x0, y0, x1, y1, 1, body);
  const a = Math.atan2(y1 - y0, x1 - x0);
  const l = (r: number, d: number): Pt => [x1 + Math.cos(a + d) * r, y1 + Math.sin(a + d) * r];
  p.poly([[x1 + Math.cos(a) * 1.5, y1 + Math.sin(a) * 1.5], l(head, 2.5), l(head, -2.5)], PAL.ink);
  p.poly([[x1 + Math.cos(a), y1 + Math.sin(a)], l(head - 1, 2.5), l(head - 1, -2.5)], core);
}

/** Radial ray burst behind a motif (dithered). */
export function rays(p: PixelCanvas, cx: number, cy: number, n: number, len: number, c: number, level = 8, phase = 0): void {
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    const g = new PixelCanvas(W, H);
    g.tri(cx, cy, cx + Math.cos(a - 0.12) * len, cy + Math.sin(a - 0.12) * len, cx + Math.cos(a + 0.12) * len, cy + Math.sin(a + 0.12) * len, c);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g.isOpaque(x, y) && PixelCanvas.ditherAt(x, y, level)) p.set(x, y, c);
  }
}

/** Ground band with a darker front edge (floor under a scene). */
export function floor(p: PixelCanvas, y: number, ramp: Ramp): void {
  artVGrad(p, 0, y, W, H - y, [ramp[2], ramp[1], ramp[0]]);
  p.hline(0, W - 1, y, ramp[3]);
}

/** Dark silhouette creature blob (a stand-in monster): body + head + two eye dots. */
export function critter(p: PixelCanvas, cx: number, baseY: number, h: number, body: number, edge: number, eye: number): void {
  p.ellipse(cx, baseY - h * 0.45, h * 0.38, h * 0.45, edge);
  p.ellipse(cx, baseY - h * 0.45, h * 0.38 - 1, h * 0.45 - 1, body);
  p.disc(cx, baseY - h * 0.95, h * 0.24 + 1, edge);
  p.disc(cx, baseY - h * 0.95, h * 0.24, body);
  p.set(cx - 1, baseY - h * 0.97, eye).set(cx + 1, baseY - h * 0.97, eye);
}

export function stars(p: PixelCanvas, seed: number, n: number, ymax: number, c: number): void {
  const r = artRng(seed);
  for (let i = 0; i < n; i++) p.set(r() * W, r() * ymax, c);
}

/** Heart shape (two lobes + point). */
export function heart(p: PixelCanvas, cx: number, cy: number, r: number, c: number): void {
  p.disc(cx - r * 0.55, cy - r * 0.2, r * 0.62, c);
  p.disc(cx + r * 0.55, cy - r * 0.2, r * 0.62, c);
  p.tri(cx - r * 1.12, cy - r * 0.05, cx + r * 1.12, cy - r * 0.05, cx, cy + r * 1.15, c);
}
