// Neon Tower — the baked LIGHT stipples, layered FOG banks, and warm TORCH lights (owner C).
// Every texel is an exact PAL colour with alpha 255 or 0 (ordered Bayer dither, zero alpha blending).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { FACE_H, PLATE_OUTLINE, ntIso } from '../../view/board-nt/layout-nt';
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
  fogBack: (variant: number): string => `fog:back:${variant}`,
  fogFront: (variant: number): string => `fog:front:${variant}`,
  fogWisp: (variant: number): string => `fog:wisp:${variant}`,
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

interface Lobe {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  w: number;
}

function sampleLobes(x: number, y: number, lobes: readonly Lobe[], phase: number): number {
  let d = 0;
  for (let i = 0; i < lobes.length; i++) {
    const l = lobes[i];
    const waveX = Math.sin((y * 0.09) + phase + i * 1.7) * 6;
    const waveY = Math.cos((x * 0.07) - phase + i * 1.3) * 4;
    const dx = (x - (l.cx + waveX)) / l.rx;
    const dy = (y - (l.cy + waveY)) / l.ry;
    const r2 = dx * dx + dy * dy;
    if (r2 < 1) {
      const v = (1 - r2) * (1 - r2) * l.w;
      d = 1 - (1 - d) * (1 - v);
    }
  }
  return d;
}

/** Upper-outer fog bank covering stands, wall corners, and hologram statues (210 × 150). */
function paintFogBack(variant: number): PixelCanvas {
  const W = 210;
  const H = 150;
  const p = new PixelCanvas(W, H);
  const phase = variant * 1.6;
  const lobes: readonly Lobe[] = [
    { cx: 24, cy: 52, rx: 95, ry: 48, w: 0.92 },
    { cx: 70, cy: 78, rx: 110, ry: 54, w: 0.85 },
    { cx: 118, cy: 96, rx: 92, ry: 46, w: 0.72 },
    { cx: 36, cy: 112, rx: 88, ry: 44, w: 0.88 },
    { cx: 145, cy: 68, rx: 64, ry: 34, w: 0.52 },
  ];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = sampleLobes(x, y, lobes, phase);
      if (d <= 0.08) continue;
      const th = bayer4(x + variant * 2, y + variant);
      if (d < th * 0.75) continue;
      // Billow crest highlight vs deep mist body
      const crest = sampleLobes(x, y - 6, lobes, phase) < d - 0.06;
      if (d > 0.72) {
        p.set(x, y, crest && d < 0.84 && th < 0.5 ? PAL.night2 : d > 0.86 && x < 48 ? PAL.ink : PAL.night0);
      } else if (d > 0.45) {
        p.set(x, y, crest && th < 0.45 ? PAL.night2 : th < 0.6 ? PAL.night1 : PAL.night0);
      } else {
        p.set(x, y, th < 0.35 ? PAL.night1 : PAL.night0);
      }
    }
  }
  return p;
}

/** Lower-outer fog bank covering lower stands, hologram plinths, and apron floor corners (250 × 185). */
function paintFogFront(variant: number): PixelCanvas {
  const W = 250;
  const H = 185;
  const p = new PixelCanvas(W, H);
  const phase = variant * 1.8 + 0.7;
  const lobes: readonly Lobe[] = [
    { cx: 28, cy: 48, rx: 105, ry: 48, w: 0.9 },
    { cx: 82, cy: 84, rx: 118, ry: 56, w: 0.86 },
    { cx: 40, cy: 136, rx: 125, ry: 60, w: 0.95 },
    { cx: 124, cy: 142, rx: 116, ry: 52, w: 0.82 },
    { cx: 176, cy: 158, rx: 82, ry: 38, w: 0.62 },
  ];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = sampleLobes(x, y, lobes, phase);
      if (d <= 0.08) continue;
      const th = bayer4(x + variant * 2, y + variant);
      if (d < th * 0.72) continue;
      const crest = sampleLobes(x, y - 5, lobes, phase) < d - 0.05;
      if (d > 0.74) {
        p.set(x, y, crest && d < 0.85 && th < 0.55 ? PAL.night2 : d > 0.88 && x < 54 && y > 110 ? PAL.ink : PAL.night0);
      } else if (d > 0.44) {
        p.set(x, y, crest && th < 0.5 ? PAL.night2 : th < 0.65 ? PAL.night1 : PAL.night0);
      } else {
        p.set(x, y, th < 0.4 ? PAL.night1 : PAL.night0);
      }
    }
  }
  return p;
}

/** Soft drifting mist wisp layer (150 × 84) that glides slowly across the fog banks. */
function paintFogWisp(variant: number): PixelCanvas {
  const W = 150;
  const H = 84;
  const p = new PixelCanvas(W, H);
  const phase = variant * 2.1;
  const lobes: readonly Lobe[] = [
    { cx: 52, cy: 42, rx: 56, ry: 26, w: 0.72 },
    { cx: 94, cy: 48, rx: 48, ry: 24, w: 0.66 },
    { cx: 34, cy: 50, rx: 38, ry: 20, w: 0.6 },
  ];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = sampleLobes(x, y, lobes, phase);
      if (d <= 0.14) continue;
      const th = bayer4(x + variant, y);
      if (d * 0.82 > th) {
        p.set(x, y, d > 0.52 && th < 0.45 ? PAL.night2 : PAL.night1);
      }
    }
  }
  return p;
}

// ---------------------------------------------------------------------------------------------- v3 cumulus fog streaks
// hedef-gorunum-3: the fog is low, LIGHTER than the slate floor, grey-violet cumulus streaks lying on the floor: billowy
// stepped tops with a pale crest, flat-ish frayed bottoms, no screen-door dither. Each streak is a row of overlapping
// squashed puffs painted back to front: body night3, a 1–2 px stone1 crest on each puff's upper rim (the puffs in front
// cover the ones behind, so the crests read as layered billows), a night2 seam where a puff tucks under its neighbour.

export interface FogBankSpec {
  w: number;
  h: number;
  seed: number;
  /** puff radius range (x radius; y radius = rx * squash) */
  r0: number;
  r1: number;
  squash: number;
}

export const FOG_BANKS: readonly FogBankSpec[] = [
  { w: 136, h: 30, seed: 3, r0: 8, r1: 18, squash: 0.66 },
  { w: 160, h: 34, seed: 11, r0: 9, r1: 20, squash: 0.64 },
  { w: 104, h: 24, seed: 7, r0: 7, r1: 15, squash: 0.66 },
  { w: 124, h: 28, seed: 19, r0: 8, r1: 17, squash: 0.64 },
  { w: 84, h: 14, seed: 23, r0: 6, r1: 9, squash: 0.5 },
  { w: 70, h: 12, seed: 29, r0: 5, r1: 8, squash: 0.5 },
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

export function paintFogBank(spec: FogBankSpec): PixelCanvas {
  const { w: W, h: H } = spec;
  const p = new PixelCanvas(W, H);
  const rnd = fogRng(spec.seed);
  // bottom contour: a flat floor line that rises toward both ends (lens) with a slow 1 px wave
  const base = H - 2;
  const bottom = (x: number): number => {
    const u = (x + 0.5) / W;
    const lift = Math.pow(Math.abs(u - 0.5) * 2, 3) * H * 0.45;
    return Math.round(base - lift + Math.sin(x * 0.11 + spec.seed) * 0.8);
  };
  // puffs: centres march along x; the tallest in the middle third, smaller toward the tapered ends
  const puffs: { cx: number; cy: number; rx: number; ry: number }[] = [];
  let x = 4 + rnd() * 6;
  while (x < W - 4) {
    const u = x / W;
    const env = Math.sin(Math.PI * Math.min(1, Math.max(0, u))) * 0.7 + 0.3;
    const rx = (spec.r0 + (spec.r1 - spec.r0) * rnd()) * env;
    const ry = Math.max(2, rx * spec.squash);
    const cy = base - ry * (0.55 + 0.25 * rnd());
    puffs.push({ cx: x, cy, rx, ry });
    x += rx * (0.9 + 0.5 * rnd());
  }
  // back to front: shorter (lower) puffs are drawn first so the tall billows sit in front of them
  const order = puffs.map((_, i) => i).sort((a, b) => puffs[b].cy - puffs[a].cy || a - b);
  const inside = (q: { cx: number; cy: number; rx: number; ry: number }, px: number, py: number): number => {
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
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      const i = owner[py * W + px];
      if (i < 0) continue;
      const q = puffs[i];
      // crest: the lit upper-left cap of each billow (a broad flat band, not an outline) + a 1 px rim on every top edge
      const up1 = py - 1 < 0 || owner[(py - 1) * W + px] !== i;
      const ny = (py + 0.5 - q.cy) / q.ry;
      const nx = (px + 0.5 - q.cx) / q.rx;
      let c: number = PAL.night3;
      if (up1 && ny < 0.2) c = PAL.stone1;
      else if (ny < -0.28 + nx * 0.35 && nx < 0.55) c = PAL.stone1;
      // seam: where this puff tucks under the one in front of it (right edge meets another puff) → night2
      const right = px + 1 < W ? owner[py * W + px + 1] : -1;
      if (right >= 0 && right !== i && ny > -0.1) c = PAL.night2;
      p.set(px, py, c);
    }
  // frayed bottom: a few 2–4 px gaps along the bottom row so the streak does not end on a ruled line
  for (let px = 0; px < W; px++) {
    const b = bottom(px);
    if (b >= 0 && b < H && (Math.floor(px / 3) * 7 + spec.seed) % 5 === 0) p.erase(px, b);
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
const EDGE_BOX = { x: 96, y: 140, w: 464, h: 208 } as const;

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
  for (let v = 0; v < 2; v++) {
    parts.push([lightFrame.fogBack(v), paintFogBack(v)]);
    parts.push([lightFrame.fogFront(v), paintFogFront(v)]);
    parts.push([lightFrame.fogWisp(v), paintFogWisp(v)]);
  }
  FOG_BANKS.forEach((b, i) => parts.push([lightFrame.fogBank(i), paintFogBank(b)]));
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
