// Neon Tower — the baked LIGHT stipples, layered FOG banks, and warm TORCH lights (owner C).
// Every texel is an exact PAL colour with alpha 255 or 0 (ordered Bayer dither, zero alpha blending).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { FACE_H, PLATE_OUTLINE, ntIso } from '../../view/board-nt/layout-nt';
import { BOARD_V4 } from '../../view/layout';
import { type NtAtlas, packAtlas } from './wall-kit';

export const NT_LIGHTS_KEY = 'arena-nt:lights';

export const LIGHT_LV = [0, 0.4, 0.66, 0.92] as const;
export const LIGHT_LEVELS = 3;

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;
export const bayer4 = (x: number, y: number): number => (BAYER4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

export const lightFrame = {
  cone: (shape: number, level: number): string => `cone:${shape}:${level}`,
  pool: (shape: number, level: number): string => `pool:${shape}:${level}`,
  halo: (level: number): string => `halo:${level}`,
  tile: (side: 0 | 1, level: number, i: number): string => `edge:${side}:${level}:${i}`,
  /** arena v3 "Fog": one low cumulus fog streak of FOG_BANKS (hedef-gorunum-3). */
  fogBank: (i: number): string => `fog:bank:${i}`,
  torch: (frame: number): string => `torch:${frame}`,
};

export interface ConeShape {
  lean: number;
  h: number;
  hw0: number;
  grow: number;
}
export const CONES: readonly ConeShape[] = [
  { lean: -0.42, h: 84, hw0: 2.5, grow: 0.36 },
  { lean: -0.14, h: 76, hw0: 2.5, grow: 0.3 },
];

export function coneBox(c: ConeShape): { w: number; h: number; ax: number } {
  const reach = c.hw0 + c.h * c.grow;
  const drift = Math.abs(c.lean) * c.h;
  const w = Math.ceil(2 * reach + drift) + 2;
  const ax = c.lean < 0 ? Math.ceil(reach + drift) + 1 : Math.ceil(reach) + 1;
  return { w, h: c.h, ax };
}

function paintCone(c: ConeShape, level: number): PixelCanvas {
  const { w, h, ax } = coneBox(c);
  const p = new PixelCanvas(w, h);
  for (let r = 0; r < h; r++) {
    const cx = ax + c.lean * r;
    const hw = c.hw0 + c.grow * r;
    const fall = Math.pow(1 - r / h, 1.25);
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
      const u = Math.abs(x + 0.5 - cx) / hw;
      if (u > 1) continue;
      const d = 0.95 * fall * (1 - 0.6 * u * u);
      if (d * LIGHT_LV[level] > bayer4(x, r)) p.set(x, r, PAL.white);
    }
  }
  return p;
}

export interface PoolShape {
  rx: number;
  ry: number;
  peak: number;
}
export const POOLS: readonly PoolShape[] = [
  { rx: 74, ry: 28, peak: 0.85 },
  { rx: 66, ry: 24, peak: 0.7 },
];

function paintPool(s: PoolShape, level: number): PixelCanvas {
  const w = s.rx * 2 + 1;
  const h = s.ry * 2 + 1;
  const p = new PixelCanvas(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (x - s.rx) / (s.rx + 0.5);
      const dy = (y - s.ry) / (s.ry + 0.5);
      const d2 = dx * dx + dy * dy;
      if (d2 >= 1) continue;
      const d = s.peak * (1 - d2);
      if (d * LIGHT_LV[level] > 0.24) p.set(x, y, PAL.white);
    }
  return p;
}

export const HALO_M = 8;
export const HALO_BAY = { w: 98, h: 74 } as const;

function paintHalo(level: number): PixelCanvas {
  const W = HALO_BAY.w + 2 * HALO_M;
  const H = HALO_BAY.h + 2 * HALO_M;
  const p = new PixelCanvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ox = Math.max(HALO_M - x - 1, x - (HALO_M + HALO_BAY.w), 0);
      const oy = Math.max(HALO_M - y - 1, y - (HALO_M + HALO_BAY.h), 0);
      if (ox === 0 && oy === 0) continue;
      const d = Math.hypot(ox, oy);
      if (d > HALO_M) continue;
      const f = 0.8 * (1 - (d - 0.5) / HALO_M);
      if (f * LIGHT_LV[level] > bayer4(x, y)) p.set(x, y, PAL.white);
    }
  return p;
}

// ---------------------------------------------------------------------------------------------- layered fog & warm torches

// ---------------------------------------------------------------------------------------------- v3 cumulus fog banks
// hedef-gorunum-3: the fog is low, a step LIGHTER than the slate floor, cool grey-violet banks lying on the floor. One
// cool family only (night2 → night3 → night4): body night3, the lit upper-left cap a thin night4 band, the underside /
// tuck seams night2, so the bank melts into the night1/night2 floor at its foot. Each bank is 1–3 stacked rows of
// overlapping puffs of varied size and spacing, its ends tapering into 1–2 px body-tone wisps. Back banks (layer 'back')
// are larger and darker (no cap) and their outer rim is a 1 px off-board checker fade (never on the board top).

export interface FogBankSpec {
  w: number;
  h: number;
  seed: number;
  /** puff radius range (x radius; y radius = rx * squash) */
  r0: number;
  r1: number;
  squash: number;
  /** stacked puff rows (1 = a streak, 2–3 = a bank) */
  rows: number;
  layer: 'back' | 'front';
}

export const FOG_BANKS: readonly FogBankSpec[] = [
  // back layer: large, dark, low-cap banks behind the streaks
  { w: 190, h: 52, seed: 41, r0: 10, r1: 24, squash: 0.58, rows: 3, layer: 'back' },
  { w: 170, h: 46, seed: 43, r0: 9, r1: 22, squash: 0.58, rows: 3, layer: 'back' },
  { w: 210, h: 50, seed: 47, r0: 10, r1: 24, squash: 0.56, rows: 3, layer: 'back' },
  { w: 150, h: 40, seed: 53, r0: 8, r1: 20, squash: 0.58, rows: 2, layer: 'back' },
  // front layer: lit-cap banks and thin streaks
  { w: 136, h: 34, seed: 3, r0: 6, r1: 17, squash: 0.45, rows: 2, layer: 'front' },
  { w: 160, h: 38, seed: 11, r0: 7, r1: 19, squash: 0.43, rows: 2, layer: 'front' },
  { w: 112, h: 28, seed: 7, r0: 5, r1: 14, squash: 0.45, rows: 2, layer: 'front' },
  { w: 124, h: 30, seed: 19, r0: 6, r1: 16, squash: 0.43, rows: 2, layer: 'front' },
  { w: 92, h: 16, seed: 23, r0: 4, r1: 9, squash: 0.37, rows: 1, layer: 'front' },
  { w: 80, h: 14, seed: 29, r0: 4, r1: 8, squash: 0.37, rows: 1, layer: 'front' },
  { w: 146, h: 34, seed: 31, r0: 6, r1: 18, squash: 0.43, rows: 2, layer: 'front' },
  { w: 118, h: 30, seed: 37, r0: 5, r1: 15, squash: 0.45, rows: 2, layer: 'front' },
  { w: 100, h: 16, seed: 59, r0: 4, r1: 9, squash: 0.37, rows: 1, layer: 'front' },
  { w: 86, h: 15, seed: 61, r0: 4, r1: 8, squash: 0.37, rows: 1, layer: 'front' },
  // around the hologram plinths' feet (left dragon)
  { w: 170, h: 40, seed: 67, r0: 8, r1: 20, squash: 0.58, rows: 2, layer: 'back' },
  { w: 104, h: 24, seed: 71, r0: 5, r1: 12, squash: 0.43, rows: 2, layer: 'front' },
  // critique 2: along the stage's base (left skirt, front skirt) and the right hologram plinth's foot
  { w: 124, h: 30, seed: 73, r0: 6, r1: 15, squash: 0.43, rows: 2, layer: 'front' },
  { w: 112, h: 24, seed: 79, r0: 5, r1: 12, squash: 0.43, rows: 2, layer: 'front' },
  { w: 100, h: 22, seed: 83, r0: 5, r1: 11, squash: 0.43, rows: 2, layer: 'front' },
  { w: 160, h: 40, seed: 89, r0: 8, r1: 20, squash: 0.58, rows: 2, layer: 'back' },
  { w: 108, h: 26, seed: 97, r0: 5, r1: 13, squash: 0.43, rows: 2, layer: 'front' },
];

function fogRng(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

interface FogPuff {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export function paintFogBank(spec: FogBankSpec): PixelCanvas {
  const { w: W, h: H } = spec;
  const back = spec.layer === 'back';
  const p = new PixelCanvas(W, H);
  const rnd = fogRng(spec.seed);
  const base = H - 2;
  // wisp tails: the outer ~12 % at each end is left for 1–2 px body-tone wisps
  const tailL = Math.round(W * (0.08 + rnd() * 0.06));
  const tailR = Math.round(W * (0.08 + rnd() * 0.06));
  const x0 = tailL;
  const x1 = W - tailR;
  const span = x1 - x0;
  const puffs: FogPuff[] = [];
  for (let row = 0; row < spec.rows; row++) {
    // upper rows are shorter (centred, a random offset) and their puffs smaller → a bank that domes up unevenly
    const inset = row === 0 ? 0 : span * (0.12 + 0.12 * row + rnd() * 0.08);
    const shift = row === 0 ? 0 : (rnd() - 0.5) * span * 0.18;
    const a = x0 + inset + shift;
    const b = x1 - inset + shift;
    const scale = 1 - row * 0.2;
    let x = a + rnd() * 4;
    while (x < b) {
      const u = (x - a) / Math.max(1, b - a);
      const env = Math.sin(Math.PI * Math.min(1, Math.max(0, u))) * 0.65 + 0.35;
      const k = rnd();
      const rx = Math.max(3, (spec.r0 + (spec.r1 - spec.r0) * k * k) * env * scale);
      const ry = Math.max(2, rx * spec.squash * (0.85 + rnd() * 0.3));
      const lift = row === 0 ? 0 : puffs.filter((q) => Math.abs(q.cx - x) < q.rx).reduce((m, q) => Math.max(m, q.ry * 1.1), ry * 0.8);
      const cy = base - ry * (0.5 + 0.3 * rnd()) - lift * (0.75 + rnd() * 0.2);
      if (cy - ry >= 0) puffs.push({ cx: x, cy, rx, ry });
      x += rx * (0.55 + rnd() * 1.05);
    }
  }
  // bottom contour: flat floor line rising toward both ends with a slow 1 px wave
  const bottom = (x: number): number => {
    const u = (x + 0.5 - x0) / Math.max(1, span);
    const e = Math.min(1, Math.abs(u - 0.5) * 2);
    return Math.round(base - Math.pow(e, 3) * H * 0.25 + Math.sin(x * 0.11 + spec.seed) * 0.8);
  };
  // back to front: lower rows first, then within a row the smaller puffs first
  const order = puffs.map((_, i) => i).sort((i, j) => puffs[j].cy - puffs[i].cy || i - j);
  const inside = (q: FogPuff, px: number, py: number): number => {
    const dx = (px + 0.5 - q.cx) / q.rx;
    const dy = (py + 0.5 - q.cy) / q.ry;
    return dx * dx + dy * dy;
  };
  const owner = new Int16Array(W * H).fill(-1);
  for (const i of order) {
    const q = puffs[i];
    for (let py = Math.max(0, Math.floor(q.cy - q.ry)); py <= Math.min(H - 1, Math.ceil(q.cy + q.ry)); py++)
      for (let px = Math.max(0, Math.floor(q.cx - q.rx)); px <= Math.min(W - 1, Math.ceil(q.cx + q.rx)); px++) {
        if (py > bottom(px)) continue;
        if (inside(q, px, py) >= 1) continue;
        owner[py * W + px] = i;
      }
  }
  // wisps: 1–2 px body-tone tails trailing off each end at the bank's foot, broken into dashes
  const wisp = (from: number, to: number, dir: number): void => {
    let y = base - 1 - Math.floor(rnd() * 3);
    for (let n = 0, x = from; dir > 0 ? x < to : x > to; x += dir, n++) {
      const t = Math.abs(x - from) / Math.max(1, Math.abs(to - from));
      if (t > 0.7) break; // a clean tapering tail (critique 2 #4: no 1-px speckle fragments)
      if (n % 9 === 8 && rnd() < 0.5) y = Math.max(1, Math.min(base, y + (rnd() < 0.5 ? -1 : 1)));
      if (y >= 0 && y < H && owner[y * W + x] < 0) owner[y * W + x] = -2;
      if (t < 0.45 && y + 1 < H && owner[(y + 1) * W + x] < 0) owner[(y + 1) * W + x] = -2;
    }
  };
  const left = Math.max(0, Math.floor(Math.min(...puffs.map((q) => q.cx - q.rx * 0.6))));
  const right = Math.min(W - 1, Math.ceil(Math.max(...puffs.map((q) => q.cx + q.rx * 0.6))));
  wisp(left, 0, -1);
  wisp(right, W - 1, 1);
  const own = (x: number, y: number): number => (x < 0 || y < 0 || x >= W || y >= H ? -1 : owner[y * W + x]);
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      const i = own(px, py);
      if (i === -1) continue;
      if (i === -2) {
        p.set(px, py, PAL.stone1);
        continue;
      }
      const q = puffs[i];
      const ny = (py + 0.5 - q.cy) / q.ry;
      const nx = (px + 0.5 - q.cx) / q.rx;
      const up1 = own(px, py - 1) !== i;
      const deep = own(px, py + 2) === i && own(px, py + 1) === i; // ≥ 3 px of this puff below → never a cap-only line
      const edge = own(px - 1, py) === -1 || own(px + 1, py) === -1 || own(px, py - 1) === -1 || own(px, py + 1) === -1;
      if (back) {
        // back bank: night3 body over a night2 lower half; outer rim a 1 px checker fade (off-board only)
        // pixel pass (crit round 2 #3): no checker fringe — the outer rim is one flat 1-px night2 stair step
        if (edge) {
          p.set(px, py, PAL.night2);
          continue;
        }
        // a lit 2 px night4 rim on top of each exposed billow so the back layer reads over the night2/night3 floor
        const rim = up1 || own(px, py - 2) !== i;
        // critique 3 #1: desaturated grey-violet — body a night2/stone1 checker (≈ hedef 282949), lit rim stone1
        // pixel pass (crit round 2 #3): flat bands, no checker body — body stone1 over a 2-px night2 foot
        const fb = bottom(px) - py;
        p.set(px, py, fb <= 1 ? PAL.night2 : PAL.stone1);
        continue;
      }
      // critique 3 #1/#3: one desaturated grey-violet family — body stone1, a 1 px stone2 lit edge (+ a stone1/stone2
      // checker transition row) on the upper-left of each exposed billow, the underside stepping down to night2
      let c: number = PAL.stone1;
      const up2 = own(px, py - 2) !== i;
      if (deep && nx < 0.5 && ny < -0.2 && up1) c = PAL.stone2;
      // pixel pass (crit round 2 #3): the stone1/stone2 checker transition row is gone (flat stone1)
      else if (deep && nx < 0.5 && ny < -0.2 && up2 && q.ry >= 5) c = PAL.stone1;
      // underside falloff: body → stone1/night2 checker → night2 at the foot
      const fb = bottom(px) - py;
      if (fb <= 0) c = PAL.night2;
      else if (fb === 1) c = PAL.night2;
      // critique 3 #2: ragged side falloff — the outermost column of a billow steps to a night2/stone1 checker
      if (c === PAL.stone1 && (own(px - 1, py) === -1 || own(px + 1, py) === -1)) c = PAL.night2;
      // tuck seam where a puff slides under its right-hand neighbour
      const r = own(px + 1, py);
      if (r >= 0 && r !== i && ny > -0.2 && ny < 0.6) c = PAL.night2;
      p.set(px, py, c);
    }
  return p;
}

/** Sculpted dark iron sconce/brazier with a warm flickering flame (18 × 24, opaque PAL pixels). */
function paintTorch(frame: number): PixelCanvas {
  const W = 18;
  const H = 24;
  const cx = 9;
  const cy = 11;
  const p = new PixelCanvas(W, H);

  // Dark iron brazier bowl & stem below the flame (cy + 1 .. cy + 10)
  p.hline(cx - 3, cx + 3, cy + 1, PAL.ink);
  p.hline(cx - 2, cx + 2, cy + 1, PAL.earth2);
  p.hline(cx - 3, cx + 3, cy + 2, PAL.night2);
  p.set(cx - 3, cy + 2, PAL.ink);
  p.set(cx + 3, cy + 2, PAL.ink);
  p.hline(cx - 2, cx + 2, cy + 3, PAL.night1);
  p.set(cx - 2, cy + 3, PAL.ink);
  p.set(cx + 2, cy + 3, PAL.ink);
  // Stem / post
  for (let y = cy + 4; y <= cy + 9; y++) {
    p.set(cx - 1, y, PAL.night2);
    p.set(cx, y, PAL.night1);
    p.set(cx + 1, y, PAL.ink);
  }
  p.hline(cx - 2, cx + 2, cy + 10, PAL.ink);

  // Multi-tone flickering warm flame (white/gold4 core -> gold3/fire3 body -> fire2/fire1 tip)
  const tipDx = frame === 0 ? 0 : frame === 1 ? -1 : 1;
  const topY = frame === 1 ? cy - 7 : frame === 2 ? cy - 5 : cy - 6;
  p.set(cx + tipDx, topY, PAL.fire1);
  p.set(cx + tipDx, topY + 1, PAL.fire2);
  p.set(cx, topY + 1, PAL.fire3);
  p.hline(cx - 1, cx + 1, cy - 4, PAL.fire2);
  p.set(cx + tipDx, cy - 4, PAL.fire3);
  p.hline(cx - 2, cx + 2, cy - 3, PAL.fire2);
  p.hline(cx - 1, cx + 1, cy - 3, PAL.fire3);
  p.set(cx, cy - 3, PAL.gold3);
  p.hline(cx - 2, cx + 2, cy - 2, PAL.fire3);
  p.hline(cx - 1, cx + 1, cy - 2, PAL.gold3);
  p.set(cx, cy - 2, PAL.gold4);
  p.hline(cx - 2, cx + 2, cy - 1, PAL.fire3);
  p.hline(cx - 1, cx + 1, cy - 1, PAL.gold4);
  p.set(cx, cy - 1, PAL.white);
  p.hline(cx - 2, cx + 2, cy, PAL.fire2);
  p.hline(cx - 1, cx + 1, cy, PAL.gold3);
  p.set(cx, cy, PAL.gold4);
  return p;
}

/**
 * hedef-gorunum-3: every torch is MOUNTED. The flame of paintTorch (rows 0..cy) on
 * - kind 'sconce': an iron wall bracket (an arm bent into the wall + a back plate) — for the back wall / pillars;
 * - kind 'post': a squat brazier bowl on a stone post with a base — standing on the hall floor.
 * Canvas 18 × 40; the flame centre is at (9, 11); the bottom row (39) is the foot (post) / the bracket ends at row 22.
 */
export const TORCH_MOUNT = { w: 18, h: 40, cx: 9, flameY: 11 } as const;
function paintMountedTorch(kind: 'sconce' | 'post', frame: number): PixelCanvas {
  const p = new PixelCanvas(TORCH_MOUNT.w, TORCH_MOUNT.h);
  const f = paintTorch(frame);
  // the flame only (rows above the bowl)
  for (let y = 0; y <= 11; y++) for (let x = 0; x < f.w; x++) {
    const c = f.get(x, y);
    if (c !== null) p.set(x, y, c);
  }
  const cx = TORCH_MOUNT.cx;
  // the bowl (shared)
  p.hline(cx - 4, cx + 4, 12, PAL.ink);
  p.hline(cx - 3, cx + 3, 12, PAL.earth2);
  p.hline(cx - 4, cx + 4, 13, PAL.stone2);
  p.set(cx - 4, 13, PAL.ink).set(cx + 4, 13, PAL.ink);
  p.hline(cx - 3, cx + 3, 14, PAL.stone1);
  p.set(cx - 3, 14, PAL.ink).set(cx + 3, 14, PAL.ink);
  p.hline(cx - 2, cx + 2, 15, PAL.ink);
  if (kind === 'sconce') {
    // the arm down from the bowl, bent back into a wall plate
    for (let y = 16; y <= 19; y++) {
      p.set(cx - 1, y, PAL.stone2);
      p.set(cx, y, PAL.stone1);
      p.set(cx + 1, y, PAL.ink);
    }
    p.hline(cx - 1, cx + 3, 20, PAL.stone1);
    p.hline(cx - 1, cx + 3, 21, PAL.ink);
    // wall plate (a small iron shield behind the arm)
    for (let y = 15; y <= 23; y++) {
      p.set(cx + 4, y, y === 15 || y === 23 ? PAL.ink : PAL.stone2);
      p.set(cx + 5, y, y === 15 || y === 23 ? PAL.ink : PAL.stone1);
      p.set(cx + 6, y, PAL.ink);
    }
    p.set(cx + 5, 19, PAL.gold2);
  } else {
    // stone post with a lit left face, a seam every 7 rows, and a wider base
    for (let y = 16; y <= 35; y++) {
      p.set(cx - 3, y, PAL.ink);
      p.set(cx - 2, y, y % 7 === 0 ? PAL.stone1 : PAL.stone3);
      p.set(cx - 1, y, y % 7 === 0 ? PAL.stone1 : PAL.stone2);
      p.set(cx, y, y % 7 === 0 ? PAL.stone0 : PAL.stone2);
      p.set(cx + 1, y, y % 7 === 0 ? PAL.stone0 : PAL.stone1);
      p.set(cx + 2, y, PAL.stone0);
      p.set(cx + 3, y, PAL.ink);
    }
    p.hline(cx - 3, cx + 3, 16, PAL.ink);
    for (let y = 36; y <= 39; y++) {
      p.hline(cx - 5, cx + 5, y, y === 39 ? PAL.ink : y === 36 ? PAL.stone2 : PAL.stone1);
      p.set(cx - 5, y, PAL.ink).set(cx + 5, y, PAL.ink);
    }
    p.hline(cx - 5, cx + 5, 36, PAL.ink);
  }
  return p;
}

/** A warm torch glow: concentric ordered-dither rings of fire1 / gold1 (palette only, alpha 255). */
export const TORCH_GLOW = { w: 56, h: 44, cx: 28, cy: 20 } as const;
function paintTorchGlow(level: number): PixelCanvas {
  const p = new PixelCanvas(TORCH_GLOW.w, TORCH_GLOW.h);
  for (let y = 0; y < TORCH_GLOW.h; y++)
    for (let x = 0; x < TORCH_GLOW.w; x++) {
      const d = Math.hypot((x + 0.5 - TORCH_GLOW.cx) / 27, (y + 0.5 - TORCH_GLOW.cy) / 21);
      if (d >= 1) continue;
      const k = (1 - d) * (0.34 + 0.08 * level);
      if (k > bayer4(x, y) + 0.12) p.set(x, y, d < 0.35 ? PAL.fire1 : PAL.earth1);
      else if (k > bayer4(x, y)) p.set(x, y, PAL.earth0);
    }
  return p;
}

export const torchFrame = {
  sconce: (frame: number): string => `torch:sconce:${frame}`,
  post: (frame: number): string => `torch:post:${frame}`,
  glow: (level: number): string => `torch:glow:${level}`,
};

// ---------------------------------------------------------------------------------------------- edge glow (sparse tiles)

export const EDGE_TILE = 16;
export const EDGE_REACH = 24;
const EDGE_SKIP = 14;
const EDGE_BOX = BOARD_V4 ? ({ x: 84, y: 140, w: 472, h: 220 } as const) : ({ x: 96, y: 140, w: 464, h: 208 } as const);

function plateMask(): PixelCanvas {
  const m = new PixelCanvas(EDGE_BOX.w, EDGE_BOX.h);
  const pts = PLATE_OUTLINE.map(([c, r]) => {
    const s = ntIso(c, r);
    return [Math.round(s.x) - EDGE_BOX.x, Math.round(s.y) - EDGE_BOX.y] as const;
  });
  for (let dy = 0; dy <= FACE_H; dy++) m.poly(pts.map(([x, y]) => [x, y + dy] as const), PAL.white);
  return m;
}

export interface EdgeTile {
  side: 0 | 1;
  x: number;
  y: number;
  frames: readonly [string, string, string, string];
}

export interface EdgeArt {
  tiles: EdgeTile[];
  parts: [string, PixelCanvas][];
}

export function paintEdgeGlow(): EdgeArt {
  const S = plateMask();
  const corner = Math.round(ntIso(PLATE_OUTLINE[6][0], PLATE_OUTLINE[6][1]).x);
  const dens = new Float32Array(EDGE_BOX.w * EDGE_BOX.h);
  const kk = new Uint8Array(EDGE_BOX.w * EDGE_BOX.h);
  for (let x = 0; x < EDGE_BOX.w; x++)
    for (let y = 1; y < EDGE_BOX.h; y++) {
      if (S.isOpaque(x, y)) continue;
      let k = 0;
      for (let j = 1; j <= EDGE_REACH && y - j >= 0; j++)
        if (S.isOpaque(x, y - j)) {
          k = j;
          break;
        }
      if (k === 0) continue;
      kk[y * EDGE_BOX.w + x] = k;
      dens[y * EDGE_BOX.w + x] = 1;
    }
  const tones = (side: 0 | 1): readonly [number, number] => (side === 0 ? [PAL.cyan1, PAL.cyan0] : [PAL.crim1, PAL.crim0]);
  const cols = Math.ceil(EDGE_BOX.w / EDGE_TILE);
  const rows = Math.ceil(EDGE_BOX.h / EDGE_TILE);
  const seen = new Map<string, string>();
  const parts: [string, PixelCanvas][] = [];
  const tiles: EdgeTile[] = [];
  for (let ty = 0; ty < rows; ty++)
    for (let tx = 0; tx < cols; tx++) {
      const sx = EDGE_BOX.x + tx * EDGE_TILE;
      const side: 0 | 1 = sx + EDGE_TILE / 2 < corner ? 0 : 1;
      const frames: string[] = [''];
      let any = false;
      for (let L = 1; L <= LIGHT_LEVELS; L++) {
        const t = new PixelCanvas(EDGE_TILE, EDGE_TILE);
        let n = 0;
        for (let y = 0; y < EDGE_TILE; y++)
          for (let x = 0; x < EDGE_TILE; x++) {
            const gx = tx * EDGE_TILE + x;
            const gy = ty * EDGE_TILE + y;
            if (gx >= EDGE_BOX.w || gy >= EDGE_BOX.h) continue;
            const i = gy * EDGE_BOX.w + gx;
            if (dens[i] <= 0) continue;
            const k = kk[i] - EDGE_SKIP;
            if (k < 1 || k > 3 * L) continue;
            t.set(x, y, k <= 3 ? (L === 1 ? tones(side)[1] : tones(side)[0]) : tones(side)[1]);
            n++;
          }
        if (n === 0) {
          frames.push('');
          continue;
        }
        any = true;
        const key = `${side}:${L}:${Array.from(t.data).join(',')}`;
        let name = seen.get(key);
        if (!name) {
          name = lightFrame.tile(side, L, seen.size);
          seen.set(key, name);
          parts.push([name, t]);
        }
        frames.push(name);
      }
      if (any) tiles.push({ side, x: sx, y: EDGE_BOX.y + ty * EDGE_TILE, frames: frames as unknown as EdgeTile['frames'] });
    }
  return { tiles, parts };
}

export interface LightsBake extends NtAtlas {
  tiles: EdgeTile[];
}

export function bakeLights(): LightsBake {
  const parts: [string, PixelCanvas][] = [];
  CONES.forEach((c, i) => {
    for (let L = 1; L <= LIGHT_LEVELS; L++) parts.push([lightFrame.cone(i, L), paintCone(c, L)]);
  });
  POOLS.forEach((s, i) => {
    for (let L = 1; L <= LIGHT_LEVELS; L++) parts.push([lightFrame.pool(i, L), paintPool(s, L)]);
  });
  for (let L = 1; L <= LIGHT_LEVELS; L++) parts.push([lightFrame.halo(L), paintHalo(L)]);
  // arena v4 step 3: the cumulus banks are replaced by the fog ribbons (./fog-ribbons.ts) — not baked
  if (!BOARD_V4) FOG_BANKS.forEach((b, i) => parts.push([lightFrame.fogBank(i), paintFogBank(b)]));
  for (let f = 0; f < 3; f++) {
    parts.push([lightFrame.torch(f), paintTorch(f)]);
    parts.push([torchFrame.sconce(f), paintMountedTorch('sconce', f)]);
    parts.push([torchFrame.post(f), paintMountedTorch('post', f)]);
    parts.push([torchFrame.glow(f), paintTorchGlow(f)]);
  }
  const edge = paintEdgeGlow();
  parts.push(...edge.parts);
  const atlas = packAtlas(parts, 1024);
  return { ...atlas, tiles: edge.tiles };
}
