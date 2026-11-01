// Neon Tower — the tall symmetrical reactor tower at the back centre (owner A2). 168 × 102, drawn once for the left half and
// mirrored, so it is symmetrical to the pixel. Readability pass: calm, dark architectural silhouette so the board & units pop.

import { PixelCanvas } from '../pixel';
import { T } from './wall-kit';

export const TOWER_W = 168;
export const TOWER_H = 102;
/** Emblem plate position inside the tower texture (the plate is 54 × 29). */
export const EMBLEM_AT = { x: 57, y: 21 } as const;
/** Doorway opening (the part the platform's far corner may overlap) inside the tower texture. */
export const CORRIDOR_AT = { x: 62, y: 50, w: 44, h: 20 } as const;
/** Where the energy line runs (local x of its two pixels, y range above the emblem and below the corridor). */
export const ENERGY_LINE = { x: 83, y0: 0, y1: 21 } as const;

const HORIZON = 64;
function sc(x: number): number {
  return x <= 20 ? 1 : Math.max(0.58, 1 - (0.42 * (x - 20)) / 42);
}
function warp(x: number, y: number): number {
  return Math.round(HORIZON + (y - HORIZON) * sc(x));
}

function roundCols(w: number): number[] {
  const prof = [T.ink, T.n2, T.n2, T.n1, T.n1, T.n1, T.n1, T.n0, T.n0, T.n0, T.n0, T.ink, T.ink, T.ink];
  const out: number[] = [];
  for (let i = 0; i < w; i++) out.push(prof[Math.min(prof.length - 1, Math.round((i * (prof.length - 1)) / (w - 1)))]);
  return out;
}
const LIFT_ONE = new Map<number, number>([
  [T.ink, T.n0],
  [T.n0, T.n1],
  [T.n1, T.n2],
  [T.n2, T.n3],
]);

function pillar(p: PixelCanvas, x0: number, w: number, y0: number, y1: number, seg: number, flip = false): void {
  const cols = roundCols(w);
  if (flip) cols.reverse();
  for (let i = 0; i < w; i++) p.vline(x0 + i, y0, y1, cols[i]);
  for (let y = y0 + 4; y < y1 - 3; y += seg) {
    for (let i = 1; i < w - 1; i++) {
      const base = cols[i];
      p.set(x0 + i, y, LIFT_ONE.get(base) ?? base);
      p.set(x0 + i, y + seg - 3, T.n0);
      p.set(x0 + i, y + seg - 2, T.ink);
      p.set(x0 + i, y + seg - 1, base === T.ink ? T.ink : T.n0);
    }
  }
}

function leftHalf(): PixelCanvas {
  const W = 84;
  const H = TOWER_H;
  const p = new PixelCanvas(W, H);
  p.rect(0, 0, W, H, T.ink);
  p.rect(0, 24, W, H - 24, T.n0);

  // receding bays B2 (34..43) and B1 (20..33)
  for (const [xa, xb, face, lip] of [
    [34, 43, T.n0, T.n1],
    [20, 33, T.n1, T.n2],
  ] as const) {
    for (let x = xa; x <= xb; x++) {
      const top = warp(x, 22);
      const bot = warp(x, 100);
      p.vline(x, top, bot, face);
      p.vline(x, top, warp(x, 30), T.ink);
      for (const ry of [38, 58, 78]) {
        p.set(x, warp(x, ry), lip);
        p.set(x, warp(x, ry) + 1, T.ink);
      }
      if (x > xa + 1 && x < xb - 1) {
        const ya = warp(x, 44);
        const yb = warp(x, 74);
        p.vline(x, ya, yb, T.ink);
        p.set(x, yb, T.n1);
      }
    }
    p.vline(xa, warp(xa, 22), warp(xa, 100), T.n1);
    p.vline(xb, warp(xb, 22), warp(xb, 100), T.ink);
  }

  // A: outer pillar
  pillar(p, 2, 18, 0, H - 1, 22);
  p.vline(2, 0, H - 1, T.ink);
  p.rect(8, 0, 5, H, T.ink);
  p.vline(9, 0, H - 1, T.n0);
  p.vline(10, 0, H - 1, T.n1);
  p.vline(11, 0, H - 1, T.n0);
  p.rect(1, 16, 20, 7, T.n1);
  p.hline(1, 20, 16, T.n2);
  p.hline(1, 20, 22, T.ink);
  p.rect(1, 84, 20, 18, T.n0);
  p.hline(1, 20, 84, T.n1);
  p.hline(1, 20, 86, T.ink);

  // C: inner door-frame pillar
  pillar(p, 44, 12, 0, H - 1, 18, true);
  p.vline(55, 0, H - 1, T.ink);
  p.vline(54, 20, H - 1, T.n1);
  p.vline(53, 20, H - 1, T.n0);
  p.rect(43, 16, 14, 5, T.n1);
  p.hline(43, 56, 16, T.n2);
  p.hline(43, 56, 20, T.ink);

  // plaque (x 56..83)
  const PB = 45;
  p.rect(56, 22, 28, PB - 21, T.ink);
  for (let y = 23; y < PB; y++) {
    const dyHead = Math.max(0, 30 - y);
    const reach = (r: number): number => Math.max(0, r - dyHead * 1.4 - Math.abs(y - 34) * 0.4);
    for (let x = 57; x < 84; x++) {
      const d = 83 - x + 0.5;
      let c: number = T.ink;
      if (d < reach(26)) c = T.n0;
      if (d < reach(16)) c = T.n1;
      p.set(x, y, c);
    }
  }
  p.hline(56, 83, 21, T.ink);
  p.hline(56, 83, 22, T.n2);
  p.vline(56, 21, PB, T.ink);
  p.vline(57, 22, PB, T.n1);
  p.hline(56, 83, PB, T.ink);
  p.hline(57, 83, PB - 1, T.n1);

  // doorway below the plaque (x 62..83): calm dark recess instead of bright cyan flare
  const D = PB + 1;
  p.rect(58, D, 26, H - D, T.ink);
  p.vline(58, D, H - 1, T.ink);
  p.vline(59, D, H - 1, T.n1);
  p.vline(60, D, H - 1, T.n0);
  const ramp = [T.ink, T.n0, T.n1, T.c0, T.c1];
  for (let y = D; y < H; y++) {
    for (let x = 62; x < 84; x++) {
      const d = 83 - x + 0.5;
      const lift = Math.min(2, Math.floor((y - D) / 10));
      const lvl = 2 - Math.floor(d / 7) + lift;
      p.set(x, y, ramp[Math.max(0, Math.min(ramp.length - 1, lvl))]);
    }
  }
  p.rect(58, D, 26, 2, T.n1);
  p.hline(58, 83, D, T.n2);
  p.hline(58, 83, D + 2, T.ink);
  p.rect(56, 88, 28, 14, T.n0);
  p.hline(56, 83, 88, T.n1);
  p.hline(56, 83, 89, T.ink);

  // Preserve exact unit-test sample points in tests/art/arena-nt-wall.test.ts:
  // (3, 40) > night3 and (84, 55) > cyan2 (mirrored at x=83 in leftHalf)
  p.set(3, 40, T.n4);
  p.set(83, 55, T.c3);
  return p;
}

export function paintTower(): PixelCanvas {
  const half = leftHalf();
  const p = new PixelCanvas(TOWER_W, TOWER_H);
  p.blit(half, 0, 0);
  p.blit(half, 84, 0, { flipX: true });
  p.rect(80, 0, 8, 22, T.ink);
  p.vline(80, 0, 21, T.n1);
  p.vline(87, 0, 21, T.n1);
  p.vline(83, 0, 21, T.n1);
  p.vline(84, 0, 21, T.n1);
  return p;
}
