// Arena v2 sky: deep night blue with stars and a soft milky band; the floodlights wash the haze
// over the stands a lighter blue (light pollution). Volcano variant: an ember sky with smoke.

import { PAL } from '../palette';
import { type Color, PixelCanvas, mulberry32 } from '../pixel';
import { SKY_RECT } from './geom';
import { bandify, clamp01, coarseNoise, curve, dpick, periodicNoise, put } from './util';

export function drawSky2(hot: boolean): PixelCanvas {
  const R = SKY_RECT;
  const p = new PixelCanvas(R.w, R.h);
  const neb = coarseNoise(R.w, R.h, 10, 8, 19, 4);
  const cool = [PAL.ink, PAL.night0, PAL.night1, PAL.night2, PAL.night3, PAL.night4];
  // volcano: the same night sky (stars and all) — only the band just above the stand roofs
  // catches the lava's glow, in flat dusk tones
  const warm = new Map<Color, Color>([
    [PAL.night1, PAL.void0],
    [PAL.night2, PAL.crim0],
    [PAL.night3, PAL.crim1],
    [PAL.night4, PAL.fire1],
  ]);
  const keys: [number, number][] = [
    [-150, 0.2],
    [-70, 0.8],
    [0, 1.3],
    [60, 1.8],
    [120, 2.4],
    [200, 2.9],
  ];
  for (let y = 0; y < R.h; y++) {
    const wy = y + R.y;
    const base = curve(keys, wy);
    for (let x = 0; x < R.w; x++) {
      const wx = x + R.x;
      let v = base;
      const nn = neb[y * R.w + x];
      // a milky band across the sky (upper left → upper right, arching)
      const dl = Math.abs(wy + 40 - Math.pow((wx - 320) / 300, 2) * 70) / 34;
      const m = clamp01(1 - dl);
      const cloud = m * nn;
      if (cloud > 0.32) v += (cloud - 0.32) * 1.6;
      // flat bands with only a 1-px checker seam between them (no dither fields)
      let c = dpick(cool, bandify(v, 0.1), wx, wy);
      if (cloud > 0.56) c = cloud > 0.66 ? PAL.void1 : PAL.void0;
      if (hot && wy > -30) {
        const lift = wy > 30 ? 2 : wy > 0 ? 1 : (wx + wy) & 1;
        for (let i = 0; i < lift; i++) c = warm.get(c) ?? c;
      }
      put(p, x, y, c);
    }
  }
  // baked dim stars
  const rnd = mulberry32(4);
  for (let i = 0; i < 1100; i++) {
    const wx = Math.floor(R.x + rnd() * R.w);
    const wy = Math.floor(R.y + rnd() * R.h);
    if (wy > 140) continue;
    const r = rnd();
    const c: Color = r < 0.5 ? PAL.night3 : r < 0.82 ? PAL.night4 : r < 0.95 ? PAL.steel : PAL.mist;
    if (hot && wy > 0) continue;
    p.set(wx - R.x, wy - R.y, c);
  }
  // a thin crescent moon high above the stadium (seen during the opening descent)
  const mx = 470 - R.x;
  const my = -34 - R.y;
  for (let y = -7; y <= 7; y++)
    for (let x = -7; x <= 7; x++) {
      const a = Math.hypot(x + 0.5, y + 0.5);
      const b = Math.hypot(x + 0.5 - 3, y + 0.5 - 2);
      if (a <= 6.5 && b > 6) p.set(mx + x, my + y, a > 5.5 ? PAL.mist : PAL.white);
      else if (a <= 8 && a > 6.5 && (x + y) & 1) p.set(mx + x, my + y, PAL.night3);
    }
  return p;
}

/** Thin clouds drifting past (tileable horizontally), lit from below by the floodlights. */
export function drawClouds2(w: number, h: number, seed: number): PixelCanvas {
  const p = new PixelCanvas(w, h);
  const n = periodicNoise(w, h, 6, 2, seed, 4);
  for (let y = 0; y < h; y++) {
    const env = Math.sin((y / h) * Math.PI);
    for (let x = 0; x < w; x++) {
      const v = (n[y * w + x] - 0.5) * 2.6 * env;
      if (v <= 0.3) continue;
      const below = n[Math.min(h - 1, y + 2) * w + x];
      p.set(x, y, below < n[y * w + x] - 0.03 ? PAL.night4 : v > 0.55 ? PAL.night3 : PAL.night2);
    }
  }
  return p;
}
