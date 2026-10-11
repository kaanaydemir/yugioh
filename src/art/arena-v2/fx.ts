// Arena v2 effect textures: zone highlight pieces sized for the 80×40 tiles, the soft floodlight
// pools and cones (golden rule 3: a subtle light layer over flat pixels), small sprites.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { HH, HW, tileDV } from './geom';
import { bayer, linePx } from './util';

/** Highlight textures are the 80×40 tile plus a 4px halo. */
export const HL_W = 88;
export const HL_H = 48;
export const MARCH_FRAMES = 16;

export function drawHlOutline(): PixelCanvas {
  const p = new PixelCanvas(HL_W, HL_H);
  for (let j = 0; j < HL_H; j++)
    for (let i = 0; i < HL_W; i++) {
      const d = tileDV(i - 4, j - 4);
      if (d >= 0 && d < 1) p.set(i, j, 0xffffff);
      else if (d >= 1 && d < 2) p.set(i, j, 0xbcbcbc);
      else if (d >= 2 && d < 4 && bayer(i, j) < (d < 3 ? 8 : 3)) p.set(i, j, 0x787878);
      else if (d >= -2 && d < 0 && bayer(i, j) < (d >= -1 ? 8 : 3)) p.set(i, j, 0x9a9a9a);
    }
  return p;
}

export function drawHlMarch(f: number): PixelCanvas {
  const p = new PixelCanvas(HL_W, HL_H);
  const phase = f / MARCH_FRAMES;
  for (let j = 0; j < HL_H; j++)
    for (let i = 0; i < HL_W; i++) {
      const d = tileDV(i - 4, j - 4);
      if (d < -1 || d >= 1.5) continue;
      const a = Math.atan2((j + 0.5 - HL_H / 2) * 2, i + 0.5 - HL_W / 2) / (Math.PI * 2) + 0.5;
      for (const off of [0, 0.5]) {
        let u = (a - phase - off) % 1;
        if (u < 0) u += 1;
        if (u < 0.06) p.set(i, j, u < 0.03 ? 0xffffff : 0xbcbcbc);
      }
    }
  return p;
}

/** Chevron hugging a diamond tip: TOP tip (pointing up) or LEFT tip (pointing left). */
export function drawTip(top: boolean): PixelCanvas {
  if (top) {
    const p = new PixelCanvas(26, 7);
    linePx(0, 6, 12, 0, (x, y) => p.set(x, y, 0xffffff));
    linePx(25, 6, 13, 0, (x, y) => p.set(x, y, 0xffffff));
    linePx(7, 6, 12, 3, (x, y) => p.set(x, y, 0x9a9a9a));
    linePx(18, 6, 13, 3, (x, y) => p.set(x, y, 0x9a9a9a));
    return p;
  }
  const p = new PixelCanvas(13, 16);
  linePx(12, 1, 0, 7, (x, y) => p.set(x, y, 0xffffff));
  linePx(12, 14, 0, 8, (x, y) => p.set(x, y, 0xffffff));
  linePx(12, 4, 6, 7, (x, y) => p.set(x, y, 0x9a9a9a));
  linePx(12, 11, 6, 8, (x, y) => p.set(x, y, 0x9a9a9a));
  return p;
}

export function drawTileFill(): PixelCanvas {
  const p = new PixelCanvas(HW * 2, HH * 2);
  for (let j = 0; j < HH * 2; j++) for (let i = 0; i < HW * 2; i++) if (tileDV(i, j) >= 0) p.set(i, j, 0xffffff);
  return p;
}

/**
 * A soft iso light pool (2:1 ellipse) — white, quantized alpha levels dithered between
 * neighbours so the falloff has no hard rings. `levels` alpha steps up to `peak`.
 */
export function drawPool(w: number, h: number, falloff: number, peak: number, levels = 6): PixelCanvas {
  const p = new PixelCanvas(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ex = (x + 0.5 - w / 2) / (w / 2);
      const ey = (y + 0.5 - h / 2) / (h / 2);
      const r = Math.sqrt(ex * ex + ey * ey);
      if (r >= 1) continue;
      const v = Math.pow(1 - r, falloff) * levels;
      const lo = Math.floor(v);
      const a = ((lo + (bayer(x, y) < (v - lo) * 16 ? 1 : 0)) / levels) * peak;
      if (a > 0) p.set(x, y, 0xffffff, Math.round(Math.min(1, a) * 255));
    }
  return p;
}

/**
 * A floodlight cone: a soft trapezoid from a narrow top (the lamp) to a wide bottom (the pool),
 * brightest along its axis and fading toward the bottom. Drawn pointing DOWN; rotated at runtime.
 */
export function drawCone(len: number, top: number, bottom: number): PixelCanvas {
  const W = bottom + 4;
  const p = new PixelCanvas(W, len);
  for (let y = 0; y < len; y++) {
    const t = y / len;
    const half = (top + (bottom - top) * t) / 2;
    for (let x = 0; x < W; x++) {
      const off = Math.abs(x + 0.5 - W / 2);
      if (off > half) continue;
      const across = 1 - off / half;
      let a = Math.pow(across, 1.5) * Math.pow(1 - t, 1.6) * (t < 0.05 ? t / 0.05 : 1);
      a = Math.round(a * 7) / 7;
      if (a <= 0) continue;
      if (a < 0.34 && bayer(x, y) >= 10) continue;
      p.set(x, y, 0xffffff, Math.round(a * 255));
    }
  }
  return p;
}

/** Searchlight beam pointing RIGHT from its origin (left edge, middle row). */
export function drawSearchBeam(len: number, h: number): PixelCanvas {
  const p = new PixelCanvas(len, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < len; x++) {
      const off = Math.abs(y + 0.5 - h / 2);
      const half = 1.5 + x * 0.075;
      if (off > half) continue;
      const across = 1 - off / half;
      const along = 1 - x / len;
      let a = Math.pow(across, 1.2) * Math.pow(along, 1.1) * 0.8;
      if (off < 0.8 + x * 0.012) a += 0.25 * along;
      a = Math.round(a * 8) / 8;
      if (a > 0) p.set(x, y, 0xffffff, Math.round(Math.min(1, a) * 255));
    }
  return p;
}

export const RING_FRAMES = 8;
export const RING_W = 176;
export const RING_H = 92;

export function drawRing(f: number): PixelCanvas {
  const p = new PixelCanvas(RING_W, RING_H);
  const rx = 14 + (f / (RING_FRAMES - 1)) * 70;
  p.ellipseRing(RING_W / 2, RING_H / 2, rx, rx / 2, 0xffffff);
  if (f > 2) p.ellipseRing(RING_W / 2, RING_H / 2, rx - 1.5, rx / 2 - 0.75, 0x787878);
  return p;
}

/** Confetti piece: 4 tumble frames (wide → diagonal → tall → other diagonal), white (tinted). */
export function drawConfetti(): [string, PixelCanvas][] {
  const out: [string, PixelCanvas][] = [];
  const shapes = [
    [
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [0, 2],
      [1, 1],
      [2, 0],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
  ];
  shapes.forEach((s, i) => {
    const p = new PixelCanvas(3, 3);
    s.forEach(([x, y], k) => p.set(x, y, k === 1 ? 0xffffff : 0xd0d0d0));
    out.push([String(i), p]);
  });
  // edge-on frames (a thin sliver)
  const thin = new PixelCanvas(3, 3);
  thin.set(1, 1, 0xa0a0a0);
  out.push(['4', thin]);
  return out;
}

/** A 1px light with a dim cross (phones in the crowd, maintenance LEDs). */
export function drawPinLight(): PixelCanvas {
  const p = new PixelCanvas(3, 3);
  p.set(1, 1, 0xffffff).set(0, 1, 0x707070).set(2, 1, 0x707070).set(1, 0, 0x707070).set(1, 2, 0x707070);
  return p;
}

export { PAL };
