// Arena v2 effect textures: zone highlight pieces sized for the 80×40 tiles, the soft floodlight
// pools and cones (golden rule 3: a subtle light layer over flat pixels), small sprites.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { HH, HW, tileDV } from './geom';
import { bayer, linePx, periodicNoise } from './util';

/** Highlight textures are the 80×40 tile plus a 4px halo. */
export const HL_W = 88;
export const HL_H = 48;
export const MARCH_FRAMES = 16;

/**
 * Zone highlight outline (tinted at runtime): a solid bright band hugging the tile edge, framed by
 * dark ink edges on both sides so it reads on white marble, glass and the dark pitch alike.
 * `hot` (the hovered / chosen candidate) is one pixel thicker.
 */
export function drawHlOutline(hot = false): PixelCanvas {
  const p = new PixelCanvas(HL_W, HL_H);
  const w = hot ? 3 : 2;
  for (let j = 0; j < HL_H; j++)
    for (let i = 0; i < HL_W; i++) {
      const d = tileDV(i - 4, j - 4);
      if (d >= -2 && d < -1) p.set(i, j, PAL.ink, 190);
      else if (d >= -1 && d < w - 1) p.set(i, j, 0xffffff);
      else if (d >= w - 1 && d < w) p.set(i, j, 0xbcbcbc);
      else if (d >= w && d < w + 1) p.set(i, j, PAL.ink, 110);
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
    const p = new PixelCanvas(28, 9);
    linePx(1, 7, 13, 1, (x, y) => p.set(x, y, 0xffffff).set(x, y + 1, 0xffffff));
    linePx(26, 7, 14, 1, (x, y) => p.set(x, y, 0xffffff).set(x, y + 1, 0xffffff));
    linePx(8, 7, 13, 4, (x, y) => p.set(x, y, 0x9a9a9a));
    linePx(19, 7, 14, 4, (x, y) => p.set(x, y, 0x9a9a9a));
    p.outline(PAL.ink);
    return p;
  }
  const p = new PixelCanvas(15, 18);
  linePx(13, 2, 1, 8, (x, y) => p.set(x, y, 0xffffff).set(x, y + 1, 0xffffff));
  linePx(13, 15, 1, 9, (x, y) => p.set(x, y, 0xffffff).set(x, y - 1, 0xffffff));
  linePx(13, 5, 7, 8, (x, y) => p.set(x, y, 0x9a9a9a));
  linePx(13, 12, 7, 9, (x, y) => p.set(x, y, 0x9a9a9a));
  p.outline(PAL.ink);
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

/**
 * A smooth floodlight cone for the light layer (no dither; LINEAR filtered and drawn with a
 * screen blend at low alpha): a soft trapezoid from the lamp (top) to the pool, brightest on its
 * axis and fading out well before it reaches the marble.
 */
export function drawSoftCone(len: number, top: number, bottom: number): PixelCanvas {
  const W = bottom + 4;
  const p = new PixelCanvas(W, len);
  for (let y = 0; y < len; y++) {
    const t = y / len;
    const half = (top + (bottom - top) * t) / 2;
    for (let x = 0; x < W; x++) {
      const off = Math.abs(x + 0.5 - W / 2);
      if (off > half) continue;
      const across = 1 - off / half;
      const a = Math.pow(across, 1.4) * Math.pow(1 - t, 1.5) * Math.min(1, t / 0.06);
      if (a > 0.004) p.set(x, y, 0xffffff, Math.round(Math.min(1, a) * 255));
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

export const FOG_W = 256;
export const FOG_H = 36;

/**
 * Low ground fog (horizontally tileable): soft banks in three flat alpha levels with hard pixel
 * edges — drifts over the dark pitch as a light-layer veil (white, tinted at runtime).
 */
export function drawFog(seed: number): PixelCanvas {
  const p = new PixelCanvas(FOG_W, FOG_H);
  const n = periodicNoise(FOG_W, FOG_H, 7, 2, seed, 3);
  for (let y = 0; y < FOG_H; y++) {
    const env = Math.sin(((y + 0.5) / FOG_H) * Math.PI);
    for (let x = 0; x < FOG_W; x++) {
      const v = n[y * FOG_W + x] - (1 - env) * 0.45;
      const a = v > 0.6 ? 190 : v > 0.51 ? 130 : v > 0.43 ? 72 : 0;
      if (a) p.set(x, y, 0xffffff, a);
    }
  }
  return p;
}
