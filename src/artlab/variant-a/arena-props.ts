// Art Lab A — animated props of the arena, each as a few PRE-DRAWN frames (no scaling, no
// rotation): lantern flames, banners, the pennant string, waterfall sparkle, petals, stars, plus
// the soft-light textures (white, tinted at runtime, alpha-animated, baked at the sizes used).

import { PixelCanvas, type Color } from '../../art/pixel';
import { hash } from './arena-iso';
import { A_INK, A_RAMPS } from './palette';

const W = A_RAMPS.wood;
const LN = A_RAMPS.lantern;
const G = A_RAMPS.gold;

// ---------------------------------------------------------------- flicker timing

/** One shared, irregular flicker cycle: hold (ms) and brightness of each step. */
export const FLICKER: { ms: number; k: number; frame: number }[] = [
  { ms: 130, k: 1.0, frame: 0 },
  { ms: 90, k: 0.86, frame: 1 },
  { ms: 110, k: 0.95, frame: 2 },
  { ms: 70, k: 0.8, frame: 3 },
  { ms: 150, k: 1.0, frame: 0 },
  { ms: 100, k: 0.9, frame: 2 },
  { ms: 80, k: 0.84, frame: 1 },
  { ms: 120, k: 0.97, frame: 0 },
];
const FLICKER_TOTAL = FLICKER.reduce((s, f) => s + f.ms, 0);

/** Flicker step at time t for a lantern with phase offset (ms). Pure function of t. */
export function flickerAt(t: number, phase: number): { k: number; frame: number } {
  let m = (((t + phase) % FLICKER_TOTAL) + FLICKER_TOTAL) % FLICKER_TOTAL;
  for (const f of FLICKER) {
    if (m < f.ms) return f;
    m -= f.ms;
  }
  return FLICKER[0];
}

// ---------------------------------------------------------------- lanterns

/** Flame shapes for 4 flicker frames: dx sway and half-widths from the tip down. */
const FLAMES: { dx: number; rows: number[] }[] = [
  { dx: 0, rows: [0, 0, 1, 1, 2, 1] },
  { dx: -1, rows: [0, 1, 1, 2, 1] },
  { dx: 1, rows: [0, 0, 1, 1, 1, 1] },
  { dx: 0, rows: [0, 1, 2, 1] },
];

/** Post lantern (sits on a corner post). 13×19, anchor bottom-centre (6, 18). */
export const POST_LANTERN = { w: 13, h: 19, ax: 6, ay: 18 };

export function postLantern(frame: number): PixelCanvas {
  const p = new PixelCanvas(POST_LANTERN.w, POST_LANTERN.h);
  const K = A_INK.warm;
  // roof: a little pyramid, shaded left slope, lit right slope, dark eave
  p.set(6, 0, W[1]);
  for (let i = 1; i <= 4; i++) {
    p.hline(6 - i, 6, i, W[2]);
    p.hline(7, 6 + i, i, W[4]);
    p.set(6 - i, i, W[1]);
    p.set(6, i, W[3]);
  }
  p.hline(0, 12, 5, W[1]).set(0, 5, K).set(12, 5, K);
  // body: frame posts + two glass faces (left dimmer, right brighter) + corner mullion
  const dim = frame === 3 ? 1 : 2;
  for (let y = 6; y <= 14; y++) {
    p.set(2, y, W[1]).set(10, y, W[0]);
    for (let x = 3; x <= 5; x++) p.set(x, y, y > 12 ? LN[dim] : x === 3 ? LN[dim] : LN[3]);
    p.set(6, y, W[1]);
    for (let x = 7; x <= 9; x++) p.set(x, y, y > 12 ? LN[3] : x === 9 ? LN[3] : LN[4]);
  }
  p.hline(3, 9, 6, W[2]);
  // flame (its core shows through the mullion)
  const f = FLAMES[frame % FLAMES.length];
  const top = 13 - f.rows.length;
  f.rows.forEach((hw, i) => {
    for (let x = -hw; x <= hw; x++) p.set(6 + f.dx + x, top + i, i < 1 ? LN[3] : i < 2 ? LN[4] : A_RAMPS.sun[3]);
  });
  // base
  p.hline(1, 11, 15, W[1]).hline(2, 10, 15, W[2]).hline(7, 10, 15, W[3]);
  p.hline(2, 10, 16, W[0]);
  p.hline(4, 8, 17, W[1]);
  p.hline(4, 8, 18, K);
  return p;
}

/** Big glass-cube lantern on the stone pedestal. 17×25, anchor bottom-centre (8, 24). */
export const CUBE_LANTERN = { w: 17, h: 25, ax: 8, ay: 24 };

export function cubeLantern(frame: number): PixelCanvas {
  const p = new PixelCanvas(CUBE_LANTERN.w, CUBE_LANTERN.h);
  const K = A_INK.warm;
  // roof cap (iso pyramid): left slope shaded, right slope lit
  p.set(8, 0, W[1]);
  for (let i = 1; i <= 5; i++) {
    p.hline(8 - i - Math.floor(i / 2), 8, i, W[2]);
    p.hline(9, 8 + i + Math.floor(i / 2), i, W[4]);
    p.set(8 - i - Math.floor(i / 2), i, W[1]);
    p.set(8, i, W[3]);
  }
  p.hline(0, 16, 6, W[1]).set(0, 6, K).set(16, 6, K);
  // glass faces: rows 7..20; frame at x=1 / 8 (corner) / 15
  const lo = frame === 3 ? 2 : 3;
  for (let y = 7; y <= 20; y++)
    for (let x = 1; x <= 15; x++) {
      let c: Color;
      if (x === 1) c = W[1];
      else if (x === 15) c = W[0];
      else if (x === 8) c = W[1];
      else if (x < 8) c = y > 18 || x < 3 ? LN[lo - 1] : LN[lo];
      else c = y > 18 || x > 13 ? LN[3] : LN[4];
      p.set(x, y, c);
    }
  p.hline(2, 14, 7, W[2]);
  // crossbars
  p.hline(2, 7, 13, W[1]);
  p.hline(9, 14, 13, W[2]);
  // flame (visible through both panes, core over the corner post)
  const f = FLAMES[frame % FLAMES.length];
  const rows = [...f.rows, 2, 2, 1];
  const top = 19 - rows.length;
  rows.forEach((hw, i) => {
    for (let x = -hw; x <= hw; x++) {
      const xx = 8 + f.dx + x;
      p.set(xx, top + i, i < 1 ? LN[3] : i < 3 ? LN[4] : A_RAMPS.sun[3]);
    }
  });
  // base plate
  p.hline(0, 16, 21, W[1]).hline(1, 15, 21, W[2]).hline(9, 15, 21, W[3]);
  p.hline(1, 15, 22, W[0]);
  p.hline(3, 13, 23, W[1]);
  p.hline(3, 13, 24, K);
  return p;
}

/** Paper lantern hanging from the rim on a short string. 7×13, anchor top-centre (3, 0). */
export const HANG_LANTERN = { w: 7, h: 13, ax: 3, ay: 0 };

export function hangLantern(frame: number): PixelCanvas {
  const p = new PixelCanvas(HANG_LANTERN.w, HANG_LANTERN.h);
  const R = A_RAMPS.rope;
  p.set(3, 0, R[1]).set(3, 1, R[1]).set(3, 2, R[2]);
  p.hline(2, 4, 3, W[1]);
  const core = frame === 3 ? LN[3] : LN[4];
  const rows = [
    [1, 5, LN[1], LN[2]],
    [0, 6, LN[1], LN[3]],
    [0, 6, LN[2], core],
    [0, 6, LN[1], LN[3]],
    [1, 5, LN[1], LN[2]],
  ] as const;
  rows.forEach(([x0, x1, edge, mid], i) => {
    for (let x: number = x0; x <= x1; x++) p.set(x, 4 + i, x === x0 || x === x1 ? edge : x === 3 ? mid : i === 2 ? LN[3] : LN[2]);
  });
  // paper ribs
  p.set(1, 6, LN[1]).set(5, 6, LN[2]);
  p.hline(2, 4, 9, W[1]);
  p.set(3, 10, A_RAMPS.coral[3]).set(3, 11, A_RAMPS.coral[2]).set(3, 12, A_RAMPS.coral[1]);
  return p;
}

// ---------------------------------------------------------------- banners

export interface BannerSpec {
  /** Cloth width (along the face) and hanging length (px). */
  w: number;
  len: number;
  ramp: readonly number[];
  emblem: 'crystal' | 'moon';
  /** Screen slope of the face (+0.5: lower-left face, -0.5: lower-right face). */
  slope: 0.5 | -0.5;
}

export function bannerSize(s: BannerSpec): { w: number; h: number; ax: number; ay: number } {
  // ax/ay: canvas position of the rod's left end
  const drop = Math.ceil(s.w / 2) + 1;
  return { w: s.w + 4, h: s.len + drop + 3, ax: 2, ay: s.slope > 0 ? 1 : drop };
}

const EMBLEMS: Record<BannerSpec['emblem'], string[]> = {
  crystal: ['..X..', '.XoX.', 'XoOoX', '.XoX.', '..X..'],
  moon: ['.XX..', 'XO...', 'Xo..X', 'XoO..', '.XXX.'],
};

/** One frame of a hanging cloth banner on a sloped face. */
export function banner(s: BannerSpec, frame: number): PixelCanvas {
  const sz = bannerSize(s);
  const p = new PixelCanvas(sz.w, sz.h);
  const r = s.ramp;
  const yOf = (col: number) => sz.ay + Math.floor(col * s.slope);
  // cloth
  for (let col = 0; col < s.w; col++) {
    for (let d = 0; d < s.len; d++) {
      // swallowtail notch
      const tail = d - (s.len - 5);
      if (tail > 0 && Math.abs(col - (s.w - 1) / 2) < tail * 0.9) continue;
      const k = d / s.len;
      const off = Math.round(1.2 * k ** 1.5 * Math.sin(frame * (Math.PI / 2) + d * 0.28));
      // moving fold: a lit band and a shaded band drifting across with the wave
      const fold = Math.sin(((col + 0.5) / s.w) * Math.PI * 2 + frame * (Math.PI / 2) - d * 0.12);
      let c: Color = r[2];
      if (fold > 0.62) c = r[3];
      else if (fold < -0.7) c = r[1];
      if (col === 0) c = r[1];
      if (col === s.w - 1) c = s.slope < 0 ? r[3] : r[1];
      // gold trims
      if (d === 1 || d === s.len - 7) c = G[2];
      if (d === 2 && col > 0 && col < s.w - 1) c = r[1];
      p.set(sz.ax + col + off, yOf(col) + 1 + d, c);
    }
  }
  // emblem
  const em = EMBLEMS[s.emblem];
  const ex = Math.floor((s.w - 5) / 2);
  const ey = Math.floor(s.len * 0.32);
  for (let j = 0; j < 5; j++)
    for (let i = 0; i < 5; i++) {
      const ch = em[j][i];
      if (ch === '.') continue;
      const col = ex + i;
      const d = ey + j;
      const k = d / s.len;
      const off = Math.round(1.2 * k ** 1.5 * Math.sin(frame * (Math.PI / 2) + d * 0.28));
      p.set(sz.ax + col + off, yOf(col) + 1 + d, ch === 'X' ? G[3] : ch === 'O' ? G[4] : G[2]);
    }
  // rod with finials
  for (let col = -2; col <= s.w + 1; col++) {
    const x = sz.ax + col;
    const y = yOf(Math.max(-1, Math.min(s.w, col)));
    if (x < 0 || x >= sz.w) continue;
    p.set(x, y, col < 0 || col >= s.w ? G[2] : W[1]);
  }
  return p;
}

// ---------------------------------------------------------------- pennant string

export interface Swag {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  sag: number;
  colors: (readonly number[])[];
}

/** A rope swag with little triangular pennants, drawn into a canvas covering its bbox. */
export function swag(s: Swag, frame: number): { canvas: PixelCanvas; x: number; y: number } {
  const xMin = Math.min(s.x0, s.x1) - 3;
  const yMin = Math.min(s.y0, s.y1) - 1;
  const w = Math.abs(s.x1 - s.x0) + 7;
  const h = Math.abs(s.y1 - s.y0) + s.sag + 12;
  const p = new PixelCanvas(w, h);
  const ropeY = (x: number) => {
    const t = (x - s.x0) / (s.x1 - s.x0);
    return Math.round(s.y0 + (s.y1 - s.y0) * t + s.sag * 4 * t * (1 - t));
  };
  const R = A_RAMPS.rope;
  // pennants first (the rope passes over their tops)
  let k = 0;
  for (let x = s.x0 + 5; x <= s.x1 - 8; x += 9, k++) {
    const ramp = s.colors[k % s.colors.length];
    const y = ropeY(x + 3);
    const sway = Math.round(Math.sin(frame * (Math.PI / 2) + k * 1.3));
    for (let row = 0; row < 8; row++) {
      const half = Math.max(0, 3 - Math.floor(row / 2));
      const cx = x + 3 + Math.round((sway * row) / 7);
      for (let i = -half; i <= half; i++) {
        const c = row === 0 ? ramp[1] : i < 0 ? ramp[3] : i === 0 ? ramp[2] : ramp[1];
        p.set(cx + i - xMin, y + 1 + row - yMin, c);
      }
    }
  }
  for (let x = s.x0; x <= s.x1; x++) {
    const y = ropeY(x);
    p.set(x - xMin, y - yMin, (x & 3) === 0 ? R[1] : R[2]);
    if (ropeY(x + 1) !== y) p.set(x - xMin, y - yMin + Math.sign(ropeY(x + 1) - y), R[1]);
  }
  return { canvas: p, x: xMin, y: yMin };
}

// ---------------------------------------------------------------- small sky life

/** Waterfall sparkle overlay (frames scroll downward). */
export function fallsSparkle(h: number, frame: number, light: Color, mid: Color): PixelCanvas {
  const p = new PixelCanvas(3, h);
  for (let y = 0; y < h; y++) {
    const ph = (y - frame * 2 + 60) % 6;
    if (ph === 0) p.set(1, y, light);
    else if (ph === 1) p.set(1, y, mid);
    if ((y + frame * 3) % 9 === 0 && y > h - 10) p.set(y % 2 ? 0 : 2, y, mid);
  }
  return p;
}

/** A tiny twinkling star (3×3 plus). */
export function star(bright: boolean): PixelCanvas {
  const p = new PixelCanvas(3, 3);
  const c = A_RAMPS.sun[2];
  p.set(1, 1, bright ? A_RAMPS.sun[3] : c);
  if (bright) p.set(0, 1, A_RAMPS.sky[6]).set(2, 1, A_RAMPS.sky[6]).set(1, 0, A_RAMPS.sky[6]).set(1, 2, A_RAMPS.sky[6]);
  return p;
}

/** Petal (2 flutter frames). */
export function petal(pink: boolean, frame: number): PixelCanvas {
  const p = new PixelCanvas(3, 2);
  const r = pink ? A_RAMPS.petalPink : A_RAMPS.petalWhite;
  if (frame === 0) p.set(0, 0, r[2]).set(1, 0, r[2]).set(1, 1, r[1]);
  else p.set(1, 0, r[2]).set(1, 1, r[1]).set(2, 1, r[1]);
  return p;
}

/** Firefly core (2×2, warm). */
export function firefly(): PixelCanvas {
  const p = new PixelCanvas(2, 2);
  p.set(0, 0, LN[4]).set(1, 0, LN[3]).set(0, 1, LN[3]).set(1, 1, LN[2]);
  return p;
}

// ---------------------------------------------------------------- soft light

/** White radial glow (alpha falloff), rx×ry, optionally multiplied by a mask(x, y) in canvas px. */
export function glow(rx: number, ry: number, peak = 1, power = 2, mask?: (x: number, y: number) => number): PixelCanvas {
  const p = new PixelCanvas(2 * rx + 1, 2 * ry + 1);
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const d = Math.hypot((x - rx) / (rx + 0.5), (y - ry) / (ry + 0.5));
      if (d >= 1) continue;
      let a = Math.pow(1 - d * d, power) * peak;
      if (mask) a *= mask(x, y);
      if (a > 0.004) p.set(x, y, 0xffffff, Math.round(a * 255));
    }
  return p;
}

/** Stepped (banded) light pool: a few clean flat alpha bands instead of a smooth ramp — reads as pixel light. */
export function bandedPool(rx: number, ry: number, bands: number[], mask?: (x: number, y: number) => number): PixelCanvas {
  const p = new PixelCanvas(2 * rx + 1, 2 * ry + 1);
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const d = Math.hypot((x - rx) / (rx + 0.5), (y - ry) / (ry + 0.5));
      if (d >= 1) continue;
      const bi = Math.min(bands.length - 1, Math.floor(d * bands.length));
      let a = bands[bi];
      if (mask) a *= mask(x, y);
      if (a > 0.004) p.set(x, y, 0xffffff, Math.round(a * 255));
    }
  return p;
}

export { hash };
