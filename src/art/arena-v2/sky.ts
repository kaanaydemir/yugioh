// Arena v2 sky: deep night blue with stars and a soft milky band; the floodlights wash the haze
// over the stands a lighter blue (light pollution). Volcano variant: an ember sky with smoke.

import { PAL } from '../palette';
import { type Color, PixelCanvas, mulberry32 } from '../pixel';
import { SKY_RECT, TOWERS } from './geom';
import { bandify, bayer, clamp01, coarseNoise, curve, dpick, periodicNoise, put } from './util';

export function drawSky2(hot: boolean): PixelCanvas {
  const R = SKY_RECT;
  const p = new PixelCanvas(R.w, R.h);
  const neb = coarseNoise(R.w, R.h, 10, 8, hot ? 43 : 19, 4);
  const smoke = hot ? coarseNoise(R.w, R.h, 7, 6, 97, 4) : null;
  const cool = [PAL.ink, PAL.night0, PAL.night1, PAL.night2, PAL.night3, PAL.night4];
  const hotCols = [PAL.ink, PAL.crim0, PAL.fire0, PAL.fire1, PAL.fire2, PAL.fire3];
  const keys: [number, number][] = hot
    ? [
        [-150, 0.3],
        [-60, 1.0],
        [20, 1.7],
        [90, 2.6],
        [170, 3.4],
        [260, 3.8],
      ]
    : [
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
      // light pollution: the haze glows around each floodlight bank
      let glow = 0;
      for (const t of TOWERS) {
        const d = Math.hypot((wx - t.x) / 90, (wy - t.y) / 60);
        if (d < 1) glow = Math.max(glow, (1 - d) * (1 - d));
      }
      v += glow * 1.3;
      if (!hot) {
        // a milky band across the sky (upper left → upper right, arching)
        const dl = Math.abs(wy + 40 - Math.pow((wx - 320) / 300, 2) * 70) / 34;
        const m = clamp01(1 - dl);
        const cloud = m * nn;
        if (cloud > 0.32) v += (cloud - 0.32) * 1.6;
        let c = dpick(cool, bandify(v, 0.5), wx, wy);
        if (cloud > 0.5 && bayer(wx, wy) < (cloud - 0.5) * 40) c = cloud > 0.62 ? PAL.void1 : PAL.void0;
        put(p, x, y, c);
      } else {
        const s = smoke![y * R.w + x];
        v -= Math.min(1.1, Math.max(0, s - 0.5) * 2.2);
        v += Math.max(0, nn - 0.6) * 1.2;
        v = Math.max(v, 0.6);
        put(p, x, y, dpick(hotCols, bandify(v, 0.55), wx, wy));
      }
    }
  }
  // baked dim stars
  const rnd = mulberry32(hot ? 6 : 4);
  const count = hot ? 120 : 1100;
  for (let i = 0; i < count; i++) {
    const wx = Math.floor(R.x + rnd() * R.w);
    const wy = Math.floor(R.y + rnd() * R.h);
    if (wy > 140) continue;
    const r = rnd();
    const c: Color = hot ? (r < 0.7 ? PAL.crim1 : PAL.fire2) : r < 0.5 ? PAL.night3 : r < 0.82 ? PAL.night4 : r < 0.95 ? PAL.steel : PAL.mist;
    p.set(wx - R.x, wy - R.y, c);
  }
  if (!hot) {
    // a thin crescent moon high above the stadium (seen during the opening descent)
    const mx = 470 - R.x;
    const my = -34 - R.y;
    for (let y = -7; y <= 7; y++)
      for (let x = -7; x <= 7; x++) {
        const a = Math.hypot(x + 0.5, y + 0.5);
        const b = Math.hypot(x + 0.5 - 3, y + 0.5 - 2);
        if (a <= 6.5 && b > 6) p.set(mx + x, my + y, a > 5.5 ? PAL.mist : PAL.white);
        else if (a <= 8 && a > 6.5 && bayer(x, y) < 5) p.set(mx + x, my + y, PAL.night3);
      }
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
      if (v <= 0 || bayer(x, y) >= v * 16) continue;
      const below = n[Math.min(h - 1, y + 2) * w + x];
      p.set(x, y, below < n[y * w + x] - 0.03 ? PAL.night4 : v > 0.55 ? PAL.night3 : PAL.night2);
    }
  }
  return p;
}
