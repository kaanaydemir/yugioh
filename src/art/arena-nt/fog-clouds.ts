// Neon Tower painter: FOG CLOUDS — arena v5 step 3 (docs/v3/ref/hedef-gorunum-5.png, the lower-left / lower-right corners).
//
// Soft, chunky pixel-art fog: a low bank of stacked round puffs sitting on the hall floor (flat-ish underside, rounded tops),
// painted in three tones — a shade band under and between the puffs, the body, and a lit cap on each puff's upper-left — with
// a clean 1-px lighter-alpha rim (banded edge, no noise). Each bank is baked as CLOUD_FRAMES frames in which every puff swells
// and settles by a pixel on its own phase (a slow boil, seamless loop); the view (src/view/board-nt/lights.ts) cycles the
// frames slowly and drifts each placement a few px along x. Greys from the palette with stepped alpha (four flat levels); the
// view tints them lavender (a multiply tint in the light layer). Pure PixelCanvas code (no Phaser).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';

/** Frames per bank (the boil loop). */
export const CLOUD_FRAMES = 8;

export interface CloudSpec {
  w: number;
  h: number;
  seed: number;
  /** number of puffs in the bottom row (a second, smaller row stacks on top of the middle ones) */
  puffs: number;
  /** 'back': one tone darker (behind the stage foot); 'front': the lit bank in the hall's corners */
  layer: 'back' | 'front';
}

export const CLOUDS: readonly CloudSpec[] = [
  { w: 150, h: 48, seed: 3, puffs: 7, layer: 'back' },
  { w: 118, h: 40, seed: 7, puffs: 6, layer: 'back' },
  { w: 176, h: 52, seed: 11, puffs: 8, layer: 'back' },
  { w: 132, h: 46, seed: 13, puffs: 6, layer: 'front' },
  { w: 104, h: 38, seed: 17, puffs: 5, layer: 'front' },
  { w: 84, h: 32, seed: 19, puffs: 4, layer: 'front' },
];

export const cloudKey = (i: number, f: number): string => `nt:fog:cloud:${i}:${f}`;

const hash = (n: number): number => {
  let h = Math.imul(n ^ 0x2c1b3c6d, 0x297a2d39);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

/** Tones (shade, body, lit cap, rim) and their alpha (0..255), per layer. */
const LOOK = {
  back: { tones: [PAL.night3, PAL.stone2, PAL.stone3], rim: PAL.stone2, alpha: [176, 196, 206], rimA: 96 },
  front: { tones: [PAL.stone1, PAL.stone2, PAL.stone3], rim: PAL.stone3, alpha: [196, 214, 226], rimA: 110 },
} as const;

interface Puff {
  x: number;
  y: number;
  r: number;
  ph: number;
}

/** The puffs of a bank (frame-independent: centre, base radius, boil phase). */
export function cloudPuffs(spec: CloudSpec): Puff[] {
  const { w, h, seed: s } = spec;
  const out: Puff[] = [];
  const base = h - 3;
  // the bottom row: puffs across the bank, the middle ones bigger (a mound), each a little jittered
  for (let i = 0; i < spec.puffs; i++) {
    const u = (i + 0.5) / spec.puffs;
    const mound = Math.sin(Math.PI * u);
    const r = Math.max(6, Math.round(7 + mound * (h * 0.24) + (hash(s * 97 + i) - 0.5) * 4));
    const x = Math.round(r * 0.8 + u * (w - r * 1.6) + (hash(s * 89 + i) - 0.5) * 6);
    out.push({ x, y: base - r * 0.72, r, ph: hash(s * 83 + i) * Math.PI * 2 });
  }
  // the top row: a few smaller puffs riding on the middle of the bank
  const n2 = Math.max(1, Math.floor(spec.puffs / 2) - (hash(s * 7) < 0.5 ? 1 : 0));
  for (let i = 0; i < n2; i++) {
    const u = 0.25 + ((i + 0.5) / n2) * 0.5 + (hash(s * 71 + i) - 0.5) * 0.12;
    const r = Math.round(6 + hash(s * 67 + i) * (h * 0.14));
    out.push({ x: Math.round(u * w), y: Math.round(base - h * 0.42 - r * 0.25), r, ph: hash(s * 61 + i) * Math.PI * 2 });
  }
  return out;
}

export function paintCloud(spec: CloudSpec, frame: number): PixelCanvas {
  const { w: W, h: H } = spec;
  const p = new PixelCanvas(W, H);
  const L = LOOK[spec.layer];
  const TAU = Math.PI * 2;
  const puffs = cloudPuffs(spec).map((q) => ({ ...q, rr: q.r + Math.round(Math.sin(q.ph + (TAU * frame) / CLOUD_FRAMES) * 1.2) }));
  const floorY = H - 2; // the bank's flat underside
  // which puff covers a pixel (the nearest-in-front one: later puffs of the top row win) and how deep inside it is
  const cover = (x: number, y: number): { q: (typeof puffs)[number]; d: number } | null => {
    if (y > floorY) return null;
    let best: { q: (typeof puffs)[number]; d: number } | null = null;
    for (const q of puffs) {
      const dx = x + 0.5 - q.x;
      const dy = (y + 0.5 - q.y) / 0.86;
      const d = Math.sqrt(dx * dx + dy * dy) / q.rr;
      if (d <= 1 && (!best || q.y < best.q.y - 0.5 || (Math.abs(q.y - best.q.y) <= 0.5 && d < best.d))) best = { q, d };
    }
    return best;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = cover(x, y);
      if (!c) continue;
      // the rim: a pixel whose neighbour above / left / right is outside the bank (a clean 1-px lighter-alpha band)
      const edge = !cover(x, y - 1) || !cover(x - 1, y) || !cover(x + 1, y);
      if (edge && y < floorY) {
        p.set(x, y, L.rim, L.rimA);
        continue;
      }
      const { q, d } = c;
      const dx = (x + 0.5 - q.x) / q.rr;
      const dy = (y + 0.5 - q.y) / q.rr;
      // the lit cap: the puff's upper-left crescent; the shade: its lower part, the bank's underside and the seams where a
      // puff in front overlaps one behind (a 1-px shade line just inside the front puff's lower outline)
      const lit = -0.62 * dx - 0.78 * dy;
      let lv = 1;
      if (lit > 0.46 && d > 0.38) lv = 2;
      else if (y >= floorY - 2 || (dy > 0.5 && y > floorY - q.rr * 0.9)) lv = 0;
      // the seam where a puff overlaps the one behind it: its outline crescent on the far side of the light (lower right),
      // only where another puff continues the bank beyond it (never a ring round every puff)
      else if (d > 0.86 && dx + dy > 0.5) {
        const nx = Math.round(x + 0.5 + Math.sign(dx) * 2);
        const ny = Math.round(y + 0.5 + Math.sign(dy) * 2);
        const o = cover(nx, ny);
        if (o && o.q !== q) lv = 0;
      }
      p.set(x, y, L.tones[lv], L.alpha[lv]);
    }
  return p;
}
