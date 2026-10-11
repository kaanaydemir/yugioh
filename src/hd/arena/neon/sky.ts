// HD Neon arena — the night sky: banded gradient with a purple city-glow at the horizon, the milky way (nebula
// clouds, a dark dust lane, a dense star field), aurora curtains with fine vertical rays (tileable, drifting),
// twinkling star sprites, shooting stars and the soft volumetric searchlight beams.

import { PAL } from '../../../art/palette';
import { SKY_RECT, rimY } from './geo';
import { Raster, bandify, bayer, clamp01, curve, dpick, fbm, fbmX, hash2, qalpha, smoothstep, vnoiseX } from './raster';

const SKY_COLS = [PAL.ink, PAL.night0, PAL.night1, PAL.night2, PAL.night3];
const SKY_KEYS: [number, number][] = [
  [-96, 0.35],
  [-20, 0.95],
  [40, 1.3],
  [120, 1.8],
  [185, 2.3],
  [260, 2.7],
  [360, 2.85],
];

/** Milky way band (from lower-left to upper-right): 0 outside .. 1 on its spine. */
function milky(x: number, y: number): number {
  const dl = Math.abs((x - 90) * 0.42 + (y - 180) * 0.91) / 74;
  return clamp01(1 - dl);
}

export function drawSky(P: number): Raster {
  const r = new Raster(SKY_RECT, P);
  r.each((i, j, x, y) => {
    let v = curve(SKY_KEYS, y);
    const m = milky(x, y);
    const n = fbm(x / 120, y / 120, 4, 17);
    const cloud = m * n;
    if (cloud > 0.3) v += (cloud - 0.3) * 1.5;
    // dark dust lane along the band's spine
    const lane = m > 0.35 ? smoothstep(0.6, 0.7, fbm(x / 70 + 3.1, y / 70, 3, 23)) * smoothstep(0.35, 0.8, m) : 0;
    v -= lane * 0.5;
    let c = dpick(SKY_COLS, bandify(v, 0.4), i, j);
    // the city-glow above the stadium rim: banded rise night3 → void1 with short dithered transitions
    const above = rimY(x) - y;
    if (above > -10 && above < 100) {
      const k = Math.pow(1 - Math.max(0, above) / 100, 1.5);
      const hv = Math.min(2, k * 2.05);
      if (hv > 0.2) c = dpick([c, PAL.night3, PAL.void1], bandify(hv, P === 1 ? 0.45 : 0.3), i, j);
    }
    if (cloud > 0.5 && bayer(i, j) < (cloud - 0.5) * 40 - lane * 12) c = cloud > 0.62 ? PAL.void1 : PAL.void0;
    if (cloud > 0.68 && bayer(i, j) < (cloud - 0.68) * 30) c = PAL.night4;
    r.put(i, j, c);
  });
  // stars: dim tiers baked in (the bright tier is animated sprites)
  const area = (SKY_RECT.w * SKY_RECT.h) / (P * P);
  const count = Math.round(area / (P === 1 ? 105 : 150));
  for (let k = 0; k < count; k++) {
    const x = SKY_RECT.x + hash2(k, 1, 3) * SKY_RECT.w;
    const y = SKY_RECT.y + hash2(k, 2, 3) * SKY_RECT.h;
    if (y > rimY(x) + 4) continue;
    const m = milky(x, y);
    if (m < 0.1 && hash2(k, 3, 3) < 0.4) continue; // denser in the milky way
    const q = hash2(k, 4, 3);
    const c = q < 0.5 ? PAL.night3 : q < 0.8 ? PAL.night4 : q < 0.95 ? PAL.steel : PAL.mist;
    const i = r.ix(x);
    const j = r.iy(y);
    r.put(i, j, c);
    if (q > 0.985 && P === 1) {
      r.put(i - 1, j, PAL.night3);
      r.put(i + 1, j, PAL.night3);
      r.put(i, j - 1, PAL.night3);
      r.put(i, j + 1, PAL.night3);
    }
  }
  // a few warm/cool tinted stars (old giants)
  for (let k = 0; k < 40; k++) {
    const x = SKY_RECT.x + hash2(k, 5, 9) * SKY_RECT.w;
    const y = SKY_RECT.y + hash2(k, 6, 9) * SKY_RECT.h * 0.7;
    if (y > rimY(x) - 6) continue;
    r.put(r.ix(x), r.iy(y), hash2(k, 7, 9) < 0.5 ? PAL.gold2 : PAL.cyan2);
  }
  return r;
}

/** Aurora curtain, tileable horizontally: width AW, height AH (HD px). Coloured RGBA (blend ADD). */
export const AURORA = { w: 768, h: 192 };

export function drawAurora(P: number, seed: number): Raster {
  const r = new Raster({ x: 0, y: 0, w: AURORA.w, h: AURORA.h }, P);
  const W = AURORA.w;
  const cells = 5;
  for (let i = 0; i < r.w; i++) {
    const x = r.wx(i);
    const u = (x / W) * cells;
    const I = clamp01((fbmX(u, 0.5, cells, 3, seed) - 0.33) * 2.8);
    if (I <= 0) continue;
    const wave = fbmX(u * 0.8, 3.3, cells * 0.8, 2, seed + 5);
    const yb = AURORA.h - 26 - wave * 60;
    const ht = 46 + I * 80;
    // fine rays: high-frequency streaks (periodic)
    const ray = vnoiseX((x / W) * 96, 0.5, 96, seed + 9);
    const ray2 = vnoiseX((x / W) * 37, 1.5, 37, seed + 11);
    for (let j = 0; j < r.h; j++) {
      const y = r.wy(j);
      if (y > yb + 2) continue;
      const f = (yb - y) / ht;
      if (f > 1) continue;
      let a = I * Math.pow(1 - Math.max(0, f), 0.9) * (0.45 + 0.45 * ray + 0.25 * ray2);
      if (f < 0.07) a *= 1.5; // bright lower hem
      if (f < 0) a *= clamp01(1 + f * 12);
      const q = qalpha(Math.min(1, a * 0.8), P === 1 ? 7 : 5, i, j);
      if (q <= 0) continue;
      const c = f < 0.07 ? PAL.teal3 : f < 0.25 ? PAL.teal2 : f < 0.5 ? (bayer(i, j) < 8 ? PAL.teal1 : PAL.void2) : f < 0.75 ? PAL.void2 : PAL.void1;
      r.put(i, j, c, Math.round(q * 255));
    }
  }
  return r;
}

/** Twinkling star frames (dot → cross → big cross), 9×9 HD at P = 1; 5×5 art at P = 2. */
export function drawStarFrame(P: number, f: number): Raster {
  const n = P === 1 ? 9 : 5;
  const r = new Raster({ x: 0, y: 0, w: n * P, h: n * P }, P);
  const c = Math.floor(n / 2);
  const set = (dx: number, dy: number, col: number) => r.put(c + dx, c + dy, col);
  if (P === 1) {
    if (f === 0) set(0, 0, PAL.mist);
    if (f >= 1) {
      set(0, 0, PAL.white);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        set(dx, dy, PAL.steel);
    }
    if (f >= 2) {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        set(dx, dy, PAL.mist);
        set(dx * 2, dy * 2, PAL.night4);
      }
    }
    if (f >= 3) {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        set(dx * 3, dy * 3, PAL.night3);
        set(dx * 2, dy * 2, PAL.steel);
      }
      for (const [dx, dy] of [
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ])
        set(dx, dy, PAL.night3);
    }
  } else {
    if (f === 0) set(0, 0, PAL.mist);
    if (f >= 1) set(0, 0, PAL.white);
    if (f >= 2)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        set(dx, dy, f >= 3 ? PAL.mist : PAL.night4);
    if (f >= 3)
      for (const [dx, dy] of [
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2],
      ])
        set(dx, dy, PAL.night3);
  }
  return r;
}

/** Searchlight beam: soft cone (alpha), origin at the left middle. Returned as alpha function for softTex. */
export const BEAM = { w: 512, h: 128 };
export function beamAlpha(x: number, y: number): number {
  const off = Math.abs(y - BEAM.h / 2);
  const half = 2.5 + x * 0.105;
  if (off > half) return 0;
  const across = 1 - off / half;
  const along = 1 - x / BEAM.w;
  // dust striations along the beam (volumetric look)
  const dust = 0.82 + 0.18 * fbm(x / 40, (off / half) * 3, 2, 61);
  let a = Math.pow(across, 1.25) * Math.pow(along, 1.35) * 0.8 * dust;
  if (off < 1 + x * 0.014) a += 0.3 * Math.pow(along, 1.6);
  return a * Math.min(1, x / 6);
}
