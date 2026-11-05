// hedef-gorunum-3: the BACK HALL dressing — stone pillars with hanging banners on the dark back wall (where the
// stands used to be) and floor pipes / metal plates on the hall floor. Pure PixelCanvas painters (palette only,
// opaque pixels, 1-px ink outlines, light from the top left), registered once and drawn by the wall layer.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { ensureNtTexture } from './textures';

export const NT_PILLAR_KEY = 'nt:hall:pillar';
export const NT_BANNER_KEY = (side: 0 | 1, frame: number): string => `nt:hall:banner:${side}:${frame}`;
export const NT_PIPES_KEY = 'nt:hall:pipes';

/** A square stone pillar, 22 × 120: lit left face, shaded right face, stone courses every 9 px, base + capital. */
export function paintPillar(): PixelCanvas {
  const W = 22;
  const H = 120;
  const p = new PixelCanvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const capital = y < 8;
      const base = y >= H - 10;
      const inset = capital || base ? 0 : 2;
      if (x < inset || x >= W - inset) continue;
      let c: number;
      const lx = x - inset;
      const w = W - 2 * inset;
      if (lx === 0 || lx === w - 1 || y === 0 || y === H - 1) c = PAL.ink;
      else if (capital || base) c = y === 1 || y === H - 9 ? PAL.stone2 : lx < w / 2 ? PAL.stone1 : PAL.stone0;
      else if ((y - 8) % 9 === 0) c = PAL.ink; // stone course seam
      else if ((y - 8) % 9 === 1) c = lx < w / 2 ? PAL.stone2 : PAL.stone1; // lit lip under the seam
      else c = lx < 3 ? PAL.stone2 : lx < w / 2 ? PAL.stone1 : lx < w - 3 ? PAL.night1 : PAL.stone0;
      p.set(x, y, c);
    }
  return p;
}

/** The banner sigil, 8 × 9 at banner (4, 15): o = gold3, x = gold2, - = gold1 shade. */
const SIGIL: readonly string[] = [
  'x......x',
  'xx....xx',
  '-xx..xx-',
  '.-xoox-.',
  '..-xo-..',
  '...xo...',
  '...-x...',
  '........',
];

/** A hanging banner, 16 × 50 in the player's colour with a gold emblem; `frame` 0..2 sways the swallowtail by a pixel. */
export function paintBanner(side: 0 | 1, frame: number): PixelCanvas {
  const W = 16;
  const H = 50;
  const p = new PixelCanvas(W, H);
  const R: readonly number[] = side === 0 ? [PAL.cyan0, PAL.cyan1, PAL.cyan2] : [PAL.crim0, PAL.crim1, PAL.crim2];
  const sway = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  // the rod
  p.hline(0, W - 1, 0, PAL.ink);
  p.hline(1, W - 2, 1, PAL.gold2);
  p.hline(0, W - 1, 2, PAL.ink);
  for (let y = 3; y < H; y++) {
    const tail = y >= H - 8;
    const k = y - (H - 8);
    for (let x = 2; x < W - 2; x++) {
      const dx = x + (tail ? sway : 0);
      if (tail && Math.abs(dx + 0.5 - W / 2) < k) continue; // swallowtail notch
      const edge = x === 2 || x === W - 3 || y === H - 1 || (tail && Math.abs(dx + 0.5 - W / 2) < k + 1);
      let c: number = edge ? PAL.ink : x < 5 ? R[2] : x < W - 5 ? R[1] : R[0];
      // a 1-px lit edge on the cloth (light from the left) so the banner separates from the dark brick
      if (!edge && x === 3 && y > 3) c = side === 0 ? PAL.cyan3 : PAL.crim3;
      // a gold border stripe and a small diamond emblem
      if (!edge && (x === 4 || x === W - 5) && y > 4 && !tail) c = PAL.gold2;
      // hedef-gorunum-3: a gold winged-V sigil (the arena emblem in miniature)
      const sig = SIGIL[y - 15];
      if (!edge && sig && x >= 4 && x <= 11 && sig[x - 4] !== '.') c = sig[x - 4] === 'o' ? PAL.gold4 : sig[x - 4] === 'x' ? PAL.gold3 : PAL.gold2;
      p.set(x, y, c);
    }
  }
  return p;
}

/** Floor pipes + plates, 120 × 24: two parallel iso pipes (running down-left) with clamps, on a riveted plate. */
export function paintPipes(): PixelCanvas {
  const W = 120;
  const H = 40;
  const p = new PixelCanvas(W, H);
  // the metal plate: an iso parallelogram
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = x - 2 * (H - 1 - y);
      if (u < 0 || u > W - 2 * H + 40) continue;
      const edge = u === 0 || u === W - 2 * H + 40 || y === 0 || y === H - 1;
      p.set(x, y, edge ? PAL.ink : (x + y) % 11 === 0 ? PAL.night2 : PAL.night1);
    }
  // two pipes running along the plate's long axis (2 px down per 4 px left = iso)
  for (const off of [10, 20]) {
    for (let i = 0; i < W; i++) {
      const y = H - 1 - off - Math.floor(i / 2) + 18;
      const x = i;
      if (y < 1 || y > H - 4) continue;
      p.set(x, y - 1, PAL.ink);
      p.set(x, y, PAL.steel);
      p.set(x, y + 1, PAL.night3);
      p.set(x, y + 2, PAL.ink);
      if (i % 24 === 0) for (let d = -2; d <= 3; d++) p.set(x, y + d, d === -2 || d === 3 ? PAL.ink : PAL.stone2);
    }
  }
  return p;
}

export function ensureBackHallTextures(scene: Phaser.Scene): void {
  ensureNtTexture(scene, 'wall', NT_PILLAR_KEY, paintPillar);
  for (const side of [0, 1] as const) for (let f = 0; f < 3; f++) ensureNtTexture(scene, 'wall', NT_BANNER_KEY(side, f), () => paintBanner(side, f));
  ensureNtTexture(scene, 'wall', NT_PIPES_KEY, paintPipes);
}

/** Pillar x positions (left edge) and their banner side: outside the screens and the holograms' heads, two per side. */
export const HALL_PILLARS: readonly { x: number; y: number; side: 0 | 1 }[] = [
  { x: 122, y: 8, side: 0 },
  { x: 244, y: 14, side: 0 },
  { x: 374, y: 14, side: 1 },
  { x: 496, y: 30, side: 1 },
];

/** Floor pipe plates on the hall floor (left / right of the stage, under the low fog). */
export const HALL_PIPES: readonly { x: number; y: number; flip: boolean }[] = [
  { x: 4, y: 240, flip: false },
  { x: 516, y: 248, flip: true },
];
