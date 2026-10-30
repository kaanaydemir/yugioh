// Çelik Susturucu v3 — the painting kit: band-shaded tubes (pistons), discs (joints), the silencing
// cone, creases and rings. Everything is flat tone bands chosen by a pixel's place against the key light
// (REHBER IŞ-3: no gradients, no dither), whole-pixel and deterministic.

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import type { Light } from '../rigkit/light';
import type { V } from '../rigkit/geom';

/** Four tones dark → light: the shaded flank, the mid body, the lit flank, the 1-px edge light. */
export type Bands = readonly [number, number, number, number];

export const BRONZE_B: Bands = [PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4];
export const BRONZE_FAR: Bands = [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3];
export const STEEL_B: Bands = [PAL.night2, PAL.night3, PAL.night4, PAL.steel];
export const STEEL_FAR: Bands = [PAL.night1, PAL.night2, PAL.night3, PAL.night4];

/** The key light as a screen vector (pointing TO the light): P1 from the upper left, P2 the upper right. */
export function lightVec(light: Light): V {
  return light.from === 'right' ? [0.55, -0.83] : [-0.55, -0.83];
}

const ramps: readonly (readonly number[])[] = [
  [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4],
  [PAL.night0, PAL.night1, PAL.night2, PAL.night3, PAL.night4, PAL.steel],
];
/** One step down its own ramp (colours off the ramps stay). */
export function darker(c: number, k = 1): number {
  for (const r of ramps) {
    const i = r.indexOf(c);
    if (i >= 0) return r[Math.max(0, i - k)];
  }
  return c;
}
export function lighter(c: number, k = 1): number {
  for (const r of ramps) {
    const i = r.indexOf(c);
    if (i >= 0) return r[Math.min(r.length - 1, i + k)];
  }
  return c;
}

export interface TubeOpt {
  /** radius at the start / end (px); default both r */
  r1?: number;
  /** 1-px dark rings across the tube at these t (0…1) */
  grooves?: readonly number[];
  /** the groove tone (default: the shade band one step down) */
  groove?: number;
  /** keep the ends flat (default true; false = round caps) */
  flat?: boolean;
  /** t range to draw (default 0…1) */
  t0?: number;
  t1?: number;
  /** rim ring: the last `rim` share of the tube (from the end) is drawn in these bands */
  rim?: { from: number; bands: Bands };
}

/** A shaded tube from a to b (frame px). Writes tones to `c`; returns nothing. */
export function tube(c: PixelCanvas, a: V, b: V, r0: number, bands: Bands, light: Light, o: TubeOpt = {}): void {
  const r1 = o.r1 ?? r0;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1e-6;
  const ux = dx / len;
  const uy = dy / len;
  // the perpendicular pointing to the light's side
  const L = lightVec(light);
  let nx = -uy;
  let ny = ux;
  if (nx * L[0] + ny * L[1] < 0) {
    nx = -nx;
    ny = -ny;
  }
  const rmax = Math.max(r0, r1);
  const x0 = Math.floor(Math.min(a[0], b[0]) - rmax - 1);
  const x1 = Math.ceil(Math.max(a[0], b[0]) + rmax + 1);
  const y0 = Math.floor(Math.min(a[1], b[1]) - rmax - 1);
  const y1 = Math.ceil(Math.max(a[1], b[1]) + rmax + 1);
  const tMin = o.t0 ?? 0;
  const tMax = o.t1 ?? 1;
  const flat = o.flat ?? true;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - a[0];
      const py = y + 0.5 - a[1];
      const along = px * ux + py * uy;
      const t = along / len;
      if (flat ? t < tMin || t > tMax : false) continue;
      const tt = Math.max(0, Math.min(1, t));
      const r = r0 + (r1 - r0) * tt;
      const across = px * nx + py * ny;
      let d = Math.abs(across);
      if (!flat && (t < tMin || t > tMax)) {
        const over = t < tMin ? tMin * len - along : along - tMax * len;
        d = Math.hypot(across, over);
      }
      if (d > r) continue;
      const u = across / r;
      let tone = u < -0.3 ? bands[0] : u < 0.2 ? bands[1] : u < (r >= 3 ? 0.68 : 0.8) ? bands[2] : bands[3];
      if (o.rim && t >= o.rim.from) tone = u < -0.3 ? o.rim.bands[0] : u < 0.2 ? o.rim.bands[1] : u < 0.68 ? o.rim.bands[2] : o.rim.bands[3];
      c.set(x, y, tone);
    }
  if (o.grooves) {
    const g = o.groove ?? darker(bands[0]);
    for (const gt of o.grooves) {
      const cx = a[0] + dx * gt;
      const cy = a[1] + dy * gt;
      const r = r0 + (r1 - r0) * gt;
      // a 1-px ring perpendicular to the axis: the pixels whose centre lies within half a px of the plane
      for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
        for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
          const px = x + 0.5 - cx;
          const py = y + 0.5 - cy;
          const al = px * ux + py * uy;
          const ac = Math.abs(px * nx + py * ny);
          if (Math.abs(al) <= 0.5 && ac <= r && c.isOpaque(x, y)) c.set(x, y, g);
        }
    }
  }
}

/** A shaded disc (a joint, a knob): flat bands by the offset against the light. */
export function disc(c: PixelCanvas, cx: number, cy: number, r: number, bands: Bands, light: Light): void {
  const L = lightVec(light);
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const px = x + 0.5 - cx;
      const py = y + 0.5 - cy;
      const d = Math.hypot(px, py);
      if (d > r) continue;
      const k = (px * L[0] + py * L[1]) / r; // -1 (away from the light) … 1 (toward it)
      c.set(x, y, k < -0.35 ? bands[0] : k < 0.15 ? bands[1] : k < 0.62 ? bands[2] : bands[3]);
    }
}

/**
 * A crease (IŞ-5): where `layer` meets what is already in `dst`, the pixel behind that lies 1 px to the
 * shadow side (away from the light, and below) of a layer pixel is darkened by one ramp step — the
 * overhang shadow travels with the part in front.
 */
export function crease(dst: PixelCanvas, layer: PixelCanvas, light: Light, k = 1): void {
  const sx = light.from === 'right' ? -1 : 1;
  const hit: number[] = [];
  for (let y = 0; y < layer.h; y++)
    for (let x = 0; x < layer.w; x++) {
      if (!layer.isOpaque(x, y)) continue;
      for (const [ox, oy] of [[sx, 0], [0, 1]] as const) {
        const nx = x + ox;
        const ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= dst.w || ny >= dst.h) continue;
        if (!layer.isOpaque(nx, ny) && dst.isOpaque(nx, ny)) hit.push(ny * dst.w + nx);
      }
    }
  for (const i of hit) {
    const x = i % dst.w;
    const y = (i / dst.w) | 0;
    const c = dst.get(x, y);
    if (c !== null) dst.set(x, y, darker(c, k));
  }
}

/** An arc (a ring segment) of radius r about (cx, cy) between angles a0…a1 (rad); thickness 1 px. */
export function arc(c: PixelCanvas, cx: number, cy: number, r: number, a0: number, a1: number, tone: number): void {
  const n = Math.max(8, Math.ceil(r * Math.abs(a1 - a0) * 1.6));
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    c.set(Math.round(cx + Math.cos(a) * r - 0.5), Math.round(cy + Math.sin(a) * r - 0.5), tone);
  }
}
