// Art Lab A — sunset sky, distant floating islands and the sea of clouds (background layers).
// Everything here is value-compressed: no pure darks, no pure brights — the characters own the
// full value range.

import { PixelCanvas, type Color } from '../../art/pixel';
import { dith, hash, mixc } from './arena-iso';
import { A_RAMPS } from './palette';

const SKY = A_RAMPS.sky;
const CL = A_RAMPS.cloud;
const FI = A_RAMPS.farIsland;
const SUN = A_RAMPS.sun;

/** Horizon line (top of the far cloud bank). */
export const HORIZON = 88;
export const SUN_X = 574;
export const SUN_Y = 80;
export const SUN_R = 14;

// ---------------------------------------------------------------- gradient

/** Main sunset bands (start of each band in gradient units, 0 top .. 1 horizon). */
const MAIN: [number, Color][] = [
  [0.0, SKY[2]],
  [0.3, SKY[3]],
  [0.5, SKY[4]],
  [0.68, SKY[5]],
  [0.84, SKY[6]],
  [0.96, SKY[7]],
];
/**
 * Bands actually drawn: each main band plus a thin in-between tone (local colour, half way) just
 * above every boundary, so a transition is two half-size value steps instead of one hard jump.
 */
const MID_W = 0.05;
const STOPS: [number, Color][] = MAIN.flatMap(([f, c], i): [number, Color][] =>
  i === 0 ? [[f, c]] : [[f - MID_W, mixc(MAIN[i - 1][1], c, 0.5)], [f, c]],
);

/**
 * Sky colour at (x, y): plain flat bands (no checker dither — 1-px dither rows read as scanlines at
 * 1×). The band edges are displaced by a slow undulation plus a per-row horizontal streak term, so
 * every transition is a 2–4 row zone of long, soft, interleaved slivers — thin stratus streaks of
 * the next band reaching into this one — instead of a straight line.
 */
export function skyColor(x: number, y: number): Color {
  const und = 2.4 * (vnoise(x, 501, 120) - 0.5) + 1.2 * (vnoise(x, 502, 43) - 0.5);
  const streak = 4.2 * (vnoise(x + Math.floor(y) * 977, 503, 21) - 0.5);
  const yy = y + und + streak;
  let f = yy / HORIZON;
  // the glow climbs higher around the sun
  const dx = (x - SUN_X) / 150;
  const dy = (yy - SUN_Y) / 70;
  f += 0.22 * Math.exp(-(dx * dx + dy * dy));
  for (let i = STOPS.length - 1; i >= 0; i--) if (f >= STOPS[i][0]) return STOPS[i][1];
  return STOPS[0][1];
}

// ---------------------------------------------------------------- clouds

export interface CloudRow {
  /** Baseline y (flat bottoms of the cumulus mounds). */
  y: number;
  /** Mean puff radius. */
  r: number;
  light: Color;
  body: Color;
  shade: Color;
  seed: number;
}

interface Puff {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  top: number;
  bottom: number;
}

/**
 * One row of cumulus mounds (clusters of round puffs with flat bottoms), periodic in x with period
 * p.w so a layer can wrap. oy = canvas y of screen y 0. Shading: lit rim on the sun side, body,
 * shaded lower third, and a crease line where a nearer puff overlaps a farther one.
 */
export function cloudRow(p: PixelCanvas, row: CloudRow, oy: number, fillBelow: number, sunGlint = false): void {
  const W = p.w;
  const puffs: Puff[] = [];
  let x = Math.floor(hash(0, row.seed, 9) * row.r * 3);
  let k = 0;
  while (x < W) {
    const cw = row.r * (3.2 + hash(k, row.seed, 1) * 5);
    const R = row.r * (0.9 + hash(k, row.seed, 2) * 0.6);
    const n = 3 + Math.floor(cw / (row.r * 1.4));
    const top = row.y - R * 1.25;
    for (let i = 0; i < n; i++) {
      const o = n === 1 ? 0 : i / (n - 1) - 0.5; // -0.5..0.5 across the mound
      const pr = Math.max(row.r * 0.45, R * (1 - Math.abs(o) * 1.1) * (0.75 + hash(i, row.seed * 31 + k, 3) * 0.45));
      const cx = x + cw / 2 + o * cw;
      puffs.push({ cx, cy: row.y - pr * 0.55, rx: pr, ry: pr * 0.72, top, bottom: row.y });
    }
    // one or two small bumps riding on top
    const bumps = hash(k, row.seed, 4) < 0.6 ? 2 : 1;
    for (let i = 0; i < bumps; i++) {
      const pr = R * (0.45 + hash(i, k + row.seed, 5) * 0.25);
      const cx = x + cw * (0.3 + hash(i, k + row.seed, 6) * 0.4);
      puffs.push({ cx, cy: row.y - R * 1.0 - pr * 0.2, rx: pr, ry: pr * 0.72, top, bottom: row.y });
    }
    x += cw * (0.75 + hash(k, row.seed, 7) * 0.5) + row.r * hash(k, row.seed, 8) * 1.5;
    k++;
  }
  // flat cloud floor under the mounds (shade), so the next nearer row always has a backdrop
  for (let y = Math.round(row.y - row.r * 0.35); y < fillBelow; y++)
    for (let xx = 0; xx < W; xx++) p.set(xx, y + oy, y < row.y + 1 ? row.body : row.shade);
  // farther (higher) puffs first; nearer puffs overlap them with a crease
  puffs.sort((a, b) => a.cy + a.ry - (b.cy + b.ry));
  const wrap = (v: number) => ((v % W) + W) % W;
  for (const q of puffs) {
    const x0 = Math.floor(q.cx - q.rx) - 2;
    const x1 = Math.ceil(q.cx + q.rx) + 2;
    const y0 = Math.floor(q.cy - q.ry) - 2;
    const y1 = Math.min(Math.ceil(q.cy + q.ry) + 1, q.bottom);
    // crease: darken what is already there just outside this puff's left / upper-left edge
    for (let y = y0; y <= y1; y++)
      for (let xx = x0; xx <= x1; xx++) {
        const nx = (xx + 0.5 - q.cx) / q.rx;
        const ny = (y + 0.5 - q.cy) / q.ry;
        const d = Math.sqrt(nx * nx + ny * ny);
        if (d > 1 && d < 1 + 1.3 / q.rx && nx < 0.2 && p.isOpaque(wrap(xx), y + oy)) p.set(wrap(xx), y + oy, row.shade);
      }
    for (let y = y0; y <= y1; y++)
      for (let xx = x0; xx <= x1; xx++) {
        const nx = (xx + 0.5 - q.cx) / q.rx;
        const ny = (y + 0.5 - q.cy) / q.ry;
        if (nx * nx + ny * ny > 1) continue;
        const rel = (y - q.top) / Math.max(1, q.bottom - q.top); // 0 top of mound .. 1 bottom
        const lit = -ny * 0.7 + nx * 0.35 - rel * 0.5 + 0.15;
        let c = lit > 0.42 ? row.light : lit > -0.38 ? row.body : row.shade;
        const nyUp = (y - 0.5 - q.cy) / q.ry;
        if (nx * nx + nyUp * nyUp > 1 && ny < 0 && nx > -0.55) c = row.light; // lit top rim
        if (sunGlint && c === row.light && Math.abs(xx - SUN_X) < 30 && ny < -0.2) c = SUN[0];
        p.set(wrap(xx), y + oy, c);
      }
  }
}

// ---------------------------------------------------------------- islands

export interface Island {
  x: number;
  y: number;
  w: number;
  seed: number;
  house?: number;
  tree?: number;
  /** x offset of a waterfall pouring off the rim. */
  falls?: number;
}

export const ISLANDS: Island[] = [
  { x: 74, y: 44, w: 64, seed: 1, house: 6, tree: -17, falls: 23 },
  { x: 200, y: 24, w: 26, seed: 2, tree: 3 },
  { x: 508, y: 36, w: 36, seed: 3, house: -1 },
];

/** Haze-tinted island colours: grass, dirt lip, rock (shade → lit), sun rim. */
const IS_GRASS = [mixc(A_RAMPS.leaf[2], FI[2], 0.6), mixc(A_RAMPS.leaf[3], FI[3], 0.55), mixc(A_RAMPS.leaf[4], SKY[6], 0.6)];
const IS_DIRT = mixc(A_RAMPS.wood[1], FI[1], 0.55);
const IS_ROCK = [FI[0], FI[1], FI[2], FI[3]];
const IS_RIM = mixc(FI[3], SKY[6], 0.5);

function vnoise(x: number, seed: number, scale: number): number {
  const i = Math.floor(x / scale);
  const f = x / scale - i;
  const s = f * f * (3 - 2 * f);
  const a = hash(i, seed, 71);
  const b = hash(i + 1, seed, 71);
  return a + (b - a) * s;
}

function island(p: PixelCanvas, is: Island): void {
  const rx = is.w / 2;
  const ry = Math.max(2, Math.round(is.w / 10));
  const depth = is.w * 0.8;
  // rock underside: a cluster of stalactite teeth, shaded left → lit right (sun side)
  const teeth = 3 + Math.floor(is.w / 12);
  for (let x = Math.floor(is.x - rx) + 1; x <= Math.ceil(is.x + rx) - 1; x++) {
    const t = (x + 0.5 - is.x) / rx;
    if (Math.abs(t) >= 1) continue;
    let d = depth * 0.35 * Math.sqrt(1 - t * t);
    for (let k = 0; k < teeth; k++) {
      const tx = -0.75 + (1.5 * k) / (teeth - 1) + (hash(k, is.seed, 1) - 0.5) * 0.2;
      const tw = 0.22 + hash(k, is.seed, 2) * 0.15;
      const tl = depth * (0.5 + hash(k, is.seed, 3) * 0.5) * (1 - Math.abs(tx) * 0.6);
      const u = Math.abs(t - tx) / tw;
      if (u < 1) d = Math.max(d, tl * (1 - u) ** 1.3);
    }
    const top = Math.round(is.y + ry * Math.sqrt(Math.max(0, 1 - t * t)) * 0.6);
    const bottom = top + Math.max(2, Math.round(d));
    for (let y = top; y < bottom; y++) {
      const v = (y - top) / Math.max(1, bottom - top);
      let c: Color = t > 0.35 ? IS_ROCK[3] : t > -0.25 ? IS_ROCK[2] : IS_ROCK[1];
      if (v > 0.6) c = t > 0.35 ? IS_ROCK[2] : IS_ROCK[1];
      if (y === bottom - 1 && t > -0.3) c = IS_ROCK[1];
      if (t > 0.72 && v < 0.75) c = IS_RIM; // sun-warmed edge
      if (y < top + 2) c = IS_DIRT;
      p.set(x, y, c);
    }
  }
  // grassy top with a lit back rim
  for (let y = is.y - ry; y <= is.y + ry; y++)
    for (let x = Math.floor(is.x - rx); x <= Math.ceil(is.x + rx); x++) {
      const nx = (x + 0.5 - is.x) / rx;
      const ny = (y + 0.5 - is.y) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const nyUp = (y - 0.5 - is.y) / ry;
      let c = ny < -0.2 || nx > 0.55 ? IS_GRASS[1] : IS_GRASS[0];
      if (nx * nx + nyUp * nyUp > 1 && nx > -0.4) c = IS_GRASS[2];
      p.set(x, y, c);
    }
  if (is.falls !== undefined) {
    // static part of the waterfall: a faint stream that thins out and turns to mist mid-air
    // (sparkles animate on top). Kept dim and short so it never pulls the eye from the duel.
    const f = fallsSpan(is);
    for (let i = 0; i < f.len; i++) {
      const y = f.y + i;
      const k = i / f.len;
      if (i < 2) {
        p.set(f.x, y, FALL[2]).set(f.x + 1, y, FALL[1]);
        continue;
      }
      // lower part: the stream frays — the shaded edge drops out first, then the core thins
      if (k < 0.55 || dith(f.x, y, 1 - (k - 0.55) / 0.45)) p.set(f.x, y, (y + f.x) % 5 === 0 ? FALL[2] : FALL[1]);
      if (k < 0.4 || (k < 0.75 && dith(f.x + 1, y, 1 - (k - 0.4) / 0.35))) p.set(f.x + 1, y, FALL[0]);
    }
    mistPuff(p, f.x, f.y + f.len - 2);
  }
  if (is.tree !== undefined) tree(p, is.x + is.tree, is.y);
  if (is.house !== undefined) house(p, is.x + is.house, is.y + 1, is.seed);
}

/** Waterfall tones: far-island violet with a faint cool water tint (dim on purpose). */
export const FALL = [FI[2], mixc(FI[3], A_RAMPS.crystal[3], 0.22), mixc(FI[3], A_RAMPS.crystal[4], 0.38)];
/** Mist puff tones where the falls dissolve: shade, body, lit top (hazed into the low sky). */
const MIST = [mixc(FI[3], SKY[5], 0.5), mixc(A_RAMPS.cloud[5], SKY[6], 0.35), mixc(SKY[7], A_RAMPS.cloud[5], 0.4)];

/** Where a waterfall runs: x, top y and length (about 60% of the drop to the cloud bank). */
export function fallsSpan(is: Island): { x: number; y: number; len: number } {
  const x = is.x + (is.falls ?? 0);
  const y = is.y + 1;
  return { x, y, len: Math.round((HORIZON + 4 - y) * 0.6) };
}

/** A small soft cloud of spray where the falls dissolve (centre-top at x..x+1, y). */
function mistPuff(p: PixelCanvas, x: number, y: number): void {
  const rows = ['...aab...', '.aabbbba.', 'abbbbbbca', '.cbbbbcc.', '...ccc...'];
  p.stamp(rows, { a: MIST[2], b: MIST[1], c: MIST[0] }, x - 3, y - 2);
}

function tree(p: PixelCanvas, x: number, y: number): void {
  const trunk = IS_DIRT;
  p.vline(x, y - 4, y, trunk);
  const dark = mixc(A_RAMPS.leaf[1], FI[1], 0.55);
  const mid = IS_GRASS[0];
  const lit = IS_GRASS[1];
  // round canopy: dark body, lit top-right cap
  p.ellipse(x, y - 8, 4, 4, dark);
  p.ellipse(x - 3, y - 6, 2, 2, dark);
  p.ellipse(x + 1, y - 9, 3, 2, mid);
  p.set(x + 2, y - 11, lit);
  p.set(x + 3, y - 10, lit);
  p.set(x + 1, y - 11, lit);
}

function house(p: PixelCanvas, x: number, y: number, seed: number): void {
  const wallSh = mixc(FI[2], SKY[4], 0.2);
  const wall = mixc(FI[3], SKY[5], 0.35);
  const roofSh = mixc(A_RAMPS.coral[1], FI[1], 0.45);
  const roof = mixc(A_RAMPS.coral[2], FI[2], 0.4);
  const roofLit = mixc(A_RAMPS.coral[3], SKY[6], 0.45);
  // iso cottage (left wall in shade, gable wall lit by the sun)
  p.rect(x - 6, y - 7, 6, 7, wallSh);
  p.rect(x, y - 7, 6, 7, wall);
  p.tri(x, y - 7, x + 5, y - 7, x + 3, y - 10, wall);
  // roof slab over the shaded wall, its ridge rising to the gable tip
  for (let i = 0; i < 5; i++) p.hline(x - 7 + i, x + 2 + i - 2, y - 8 - i, i >= 3 ? roofLit : roof);
  p.hline(x - 7, x - 1, y - 7, roofSh);
  p.set(x + 3, y - 11, roofLit);
  // chimney, warm windows, door
  p.rect(x - 5, y - 14, 2, 4, wallSh);
  p.set(x - 4, y - 15, FI[1]);
  p.rect(x - 4, y - 5, 2, 2, A_RAMPS.lantern[2]);
  p.set(x - 4, y - 5, A_RAMPS.lantern[3]);
  p.rect(x + 3, y - 5, 2, 2, A_RAMPS.lantern[3]);
  if (seed % 2) p.set(x + 2, y - 9, A_RAMPS.lantern[3]);
  p.vline(x + 1, y - 3, y - 1, FI[0]);
}

// ---------------------------------------------------------------- mountains

function mountains(p: PixelCanvas): void {
  const ranges = [
    // far, very hazy range (barely above the sky value)
    { from: 0, to: 330, base: HORIZON + 3, amp: 20, seed: 4, col: mixc(FI[3], SKY[6], 0.62), lit: mixc(FI[3], SKY[7], 0.78) },
    { from: 452, to: 640, base: HORIZON + 3, amp: 14, seed: 9, col: mixc(FI[3], SKY[6], 0.62), lit: mixc(FI[3], SKY[7], 0.78) },
    // nearer, a touch darker
    { from: 0, to: 200, base: HORIZON + 4, amp: 11, seed: 6, col: mixc(FI[3], SKY[5], 0.45), lit: mixc(FI[3], SKY[6], 0.62) },
  ];
  for (const r of ranges) {
    const h = (x: number) => {
      const n = 0.55 * vnoise(x, r.seed, 58) + 0.3 * vnoise(x, r.seed + 1, 21) + 0.15 * vnoise(x, r.seed + 2, 7);
      return r.amp * Math.pow(Math.max(0, n - 0.18) / 0.82, 1.6);
    };
    for (let x = r.from; x < r.to; x++) {
      const edge = Math.min(x - r.from, r.to - x);
      const fade = Math.min(1, edge / 30);
      const hh = h(x) * fade;
      if (hh < 1) continue;
      const top = Math.round(r.base - hh);
      const slope = h(x + 2) * fade - h(x - 2) * fade; // < 0: faces the sun (right)
      for (let y = top; y < r.base + 4; y++) {
        const c = slope < -0.5 && y - top < 5 ? r.lit : r.col;
        p.set(x, y, c);
      }
    }
  }
}

// ---------------------------------------------------------------- sun

function sun(p: PixelCanvas): void {
  // two-tone disc (hot upper half) inside two flat halo rings; the outer ring's edge is broken by
  // the same horizontal streaks as the sky bands (no checker dither: it reads as dots at 1×)
  for (let y = SUN_Y - SUN_R - 8; y <= SUN_Y + SUN_R; y++)
    for (let x = SUN_X - SUN_R - 8; x <= SUN_X + SUN_R + 8; x++) {
      const d = Math.hypot(x + 0.5 - SUN_X, y + 0.5 - SUN_Y);
      const streak = 3.2 * (vnoise(x + y * 977, 504, 13) - 0.5);
      if (d <= SUN_R) {
        let c: Color = SUN[1];
        if (d < SUN_R - 1.5 && y < SUN_Y + 2) c = SUN[2];
        if (d < SUN_R * 0.5 && y < SUN_Y - 1) c = SUN[2];
        p.set(x, y, c);
      } else if (d < SUN_R + 2) {
        p.set(x, y, SUN[0]);
      } else if (d + streak < SUN_R + 6) {
        p.set(x, y, SKY[7]);
      }
    }
}

// ---------------------------------------------------------------- wisps

/** A thin, tapered cloud streak lit from below (the sun is under them). */
function wisp(p: PixelCanvas, x: number, y: number, len: number, col: Color, lit: Color): void {
  for (let i = 0; i < len; i++) {
    const t = i / (len - 1);
    const th = Math.round(1 + 2.2 * Math.sin(Math.PI * t) ** 0.8);
    const lift = Math.round(Math.sin(Math.PI * t) * 1.5);
    for (let k = 0; k < th; k++) p.set(x + i, y - lift + k, k === th - 1 && th > 1 ? lit : col);
  }
}

// ---------------------------------------------------------------- layers

/** Far cloud rows painted into the static sky (they never move). */
const FAR_ROWS: CloudRow[] = [
  { y: HORIZON + 4, r: 3, light: SKY[7], body: CL[5], shade: CL[5], seed: 1 },
  { y: HORIZON + 10, r: 4, light: CL[5], body: CL[5], shade: CL[4], seed: 2 },
  { y: HORIZON + 18, r: 5, light: CL[5], body: CL[4], shade: CL[4], seed: 3 },
];

/** Drifting cloud layers (nearer = faster). Each is a 640-wide periodic strip. */
export interface CloudLayer {
  top: number;
  bottom: number;
  rows: CloudRow[];
  /** Drift speed in px per second (to the right). */
  speed: number;
}

export const CLOUD_LAYERS: CloudLayer[] = [
  {
    top: HORIZON + 12,
    bottom: 160,
    speed: 0.6,
    rows: [
      { y: HORIZON + 28, r: 6, light: CL[5], body: CL[4], shade: CL[4], seed: 11 },
      { y: HORIZON + 42, r: 8, light: CL[5], body: CL[4], shade: CL[3], seed: 12 },
    ],
  },
  {
    top: 128,
    bottom: 220,
    speed: 1.0,
    rows: [
      { y: 156, r: 10, light: CL[4], body: CL[4], shade: CL[3], seed: 21 },
      { y: 184, r: 13, light: CL[4], body: CL[3], shade: CL[3], seed: 22 },
    ],
  },
  {
    top: 180,
    bottom: 290,
    speed: 1.6,
    rows: [
      { y: 216, r: 16, light: CL[4], body: CL[3], shade: CL[2], seed: 31 },
      { y: 254, r: 19, light: CL[3], body: CL[3], shade: CL[2], seed: 32 },
    ],
  },
  {
    top: 252,
    bottom: 362, // 360 + SKY_BLEED
    speed: 2.4,
    rows: [
      { y: 298, r: 23, light: CL[3], body: CL[2], shade: CL[2], seed: 41 },
      { y: 348, r: 28, light: CL[3], body: CL[2], shade: CL[1], seed: 42 },
    ],
  },
];

export function drawSky(p: PixelCanvas): void {
  for (let y = 0; y < HORIZON + 8; y++) for (let x = 0; x < p.w; x++) p.set(x, y, skyColor(x, y));
  // high wisps (violet zone) and warm low streaks near the sun
  wisp(p, 236, 14, 52, SKY[3], SKY[4]);
  wisp(p, 296, 21, 26, SKY[3], SKY[4]);
  wisp(p, 14, 10, 38, SKY[3], SKY[4]);
  wisp(p, 448, 60, 44, SKY[6], SKY[7]);
  wisp(p, 598, 50, 34, SKY[6], SKY[7]);
  wisp(p, 132, 72, 54, SKY[5], SKY[6]);
  sun(p);
  mountains(p);
  for (const is of ISLANDS) island(p, is);
  for (let i = 0; i < FAR_ROWS.length; i++) {
    const next = FAR_ROWS[i + 1]?.y ?? HORIZON + 40;
    cloudRow(p, FAR_ROWS[i], 0, next, true);
  }
  // fill the rest so nothing shows through behind the drifting layers
  for (let y = HORIZON + 22; y < p.h; y++) for (let x = 0; x < p.w; x++) if (!p.isOpaque(x, y)) p.set(x, y, CL[4]);
}

/** One drifting cloud layer as a 640×(bottom-top) periodic strip. */
export function drawCloudLayer(p: PixelCanvas, layer: CloudLayer): void {
  for (let i = 0; i < layer.rows.length; i++) {
    const next = layer.rows[i + 1]?.y ?? layer.bottom;
    cloudRow(p, layer.rows[i], -layer.top, i === layer.rows.length - 1 ? layer.bottom : next + 4);
  }
}

/**
 * Bleed of the full-screen background layers (px on every side): the battle shake (≤ fx.maxShake)
 * scrolls the camera past the 640×360 world, so the sky and the cloud strips reach this far beyond
 * it and the camera background never shows at the screen edges.
 */
export const SKY_BLEED = 2;

/**
 * The static sky with SKY_BLEED px of bleed on every side: a (640+2B)×(360+2B) canvas meant to be
 * placed at (-B, -B). Plain gradient pixels at the edge continue the gradient itself (same streak
 * pattern); anything else at the edge (far cloud rows, fill) is extended by repeating the edge pixel.
 */
export function drawSkyBleed(): PixelCanvas {
  const B = SKY_BLEED;
  const src = new PixelCanvas(640, 360);
  drawSky(src);
  const out = new PixelCanvas(640 + 2 * B, 360 + 2 * B);
  for (let Y = 0; Y < out.h; Y++)
    for (let X = 0; X < out.w; X++) {
      const x = X - B;
      const y = Y - B;
      const cx = Math.max(0, Math.min(639, x));
      const cy = Math.max(0, Math.min(359, y));
      const edge = src.get(cx, cy) ?? CL[4];
      if (cx === x && cy === y) out.set(X, Y, edge);
      else if (cy < HORIZON && edge === skyColor(cx, cy)) out.set(X, Y, skyColor(x, y));
      else out.set(X, Y, edge);
    }
  return out;
}
