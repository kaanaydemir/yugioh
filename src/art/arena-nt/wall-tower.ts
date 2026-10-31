// Neon Tower — the tall symmetrical reactor tower at the back centre (owner A2). 168 × 102, drawn once for the left half and
// mirrored, so it is symmetrical to the pixel. Built as RECEDING LAYERS (near → far, brightest → darkest) so the wall has depth:
//
//   x   2..19  thick outer pillar A  (rounded: 9 column tones, plated segments, a glowing neon channel)
//   x  20..43  two wall bays B1 / B2 receding to the vanishing point (their seams converge on the horizon, y 64)
//   x  44..55  thick door-frame pillar C  (lit inner trim)
//   x  56..83  the emblem plaque (a lit backing, banded arch halo) over the reactor doorway
//   y 20..48 plaque, y 49..  doorway: a tall glowing slot, a lit threshold whose light spills out over the platform's far edge
//
// Local x 0..167 = screen x 236..403, local y = screen y. Flat tone bands, clean clusters, no dither.

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
/** Perspective scale of a column: 1 at the outer pillar, shrinking toward the doorway (x 62). */
function sc(x: number): number {
  return x <= 20 ? 1 : Math.max(0.58, 1 - (0.42 * (x - 20)) / 42);
}
/** A y (at scale 1) moved onto the receding wall at column x. */
function warp(x: number, y: number): number {
  return Math.round(HORIZON + (y - HORIZON) * sc(x));
}

/** Column tones of a rounded pillar of width w, outside rim → inside: ink, lit rim, two bright, mid ..., shade, dark, ink. */
function roundCols(w: number): number[] {
  const prof = [T.ink, T.steel, T.n4, T.n3, T.n2, T.n2, T.n2, T.n2, T.n1, T.n1, T.n1, T.n0, T.n0, T.ink];
  const out: number[] = [];
  for (let i = 0; i < w; i++) out.push(prof[Math.min(prof.length - 1, Math.round((i * (prof.length - 1)) / (w - 1)))]);
  return out;
}
const LIFT_ONE = new Map<number, number>([
  [T.ink, T.n0],
  [T.n0, T.n1],
  [T.n1, T.n2],
  [T.n2, T.n3],
  [T.n3, T.n4],
  [T.n4, T.steel],
]);

/** A plated pillar: rounded column tones, horizontal armour segments (lit lip, ink seam, shaded foot), bolts. */
function pillar(p: PixelCanvas, x0: number, w: number, y0: number, y1: number, seg: number, flip = false): void {
  const cols = roundCols(w);
  if (flip) cols.reverse();
  for (let i = 0; i < w; i++) p.vline(x0 + i, y0, y1, cols[i]);
  for (let y = y0 + 4; y < y1 - 3; y += seg) {
    for (let i = 1; i < w - 1; i++) {
      const base = cols[i];
      p.set(x0 + i, y, LIFT_ONE.get(base) ?? base); // lit lip
      p.set(x0 + i, y + seg - 3, T.n0); // shade above the seam
      p.set(x0 + i, y + seg - 2, T.ink); // seam
      p.set(x0 + i, y + seg - 1, base === T.ink ? T.ink : T.n1); // seam bounce
    }
    // bolts
    for (const bx of [x0 + 3, x0 + w - 4]) {
      p.set(bx, y + 3, T.n4);
      p.set(bx + 1, y + 4, T.ink);
    }
  }
}

function leftHalf(): PixelCanvas {
  const W = 84;
  const H = TOWER_H;
  const p = new PixelCanvas(W, H);
  // ---- far wall: ink under the vault, lighter toward the middle
  p.rect(0, 0, W, H, T.n0);
  p.rect(0, 0, W, 24, T.ink);
  p.rect(0, 24, W, 6, T.n0);

  // ---- B2 (far, x 34..43) and B1 (x 20..33): bays with converging seams, darker further away
  for (const [xa, xb, face, lip] of [
    [34, 43, T.n1, T.n2],
    [20, 33, T.n2, T.n3],
  ] as const) {
    for (let x = xa; x <= xb; x++) {
      const top = warp(x, 22);
      const bot = warp(x, 100);
      p.vline(x, top, bot, face);
      // ceiling shade under the girder and a lit lower band on the plinth side
      p.vline(x, top, warp(x, 30), T.ink);
      p.set(x, warp(x, 31), T.n0);
      // converging ribs
      for (const ry of [38, 58, 78]) {
        p.set(x, warp(x, ry), lip);
        p.set(x, warp(x, ry) + 1, T.ink);
      }
      // recessed plate: lit lower edge, shaded upper edge
      if (x > xa + 1 && x < xb - 1) {
        const ya = warp(x, 44);
        const yb = warp(x, 74);
        p.vline(x, ya, yb, T.n0);
        p.set(x, ya, T.ink);
        p.set(x, yb, lip);
      }
    }
    // bay edges: a lit step edge on the near side, a shadow column on the far side
    p.vline(xa, warp(xa, 22), warp(xa, 100), T.n3);
    p.vline(xb, warp(xb, 22), warp(xb, 100), T.ink);
  }
  // data bars on B1's plate (dim cyan), shrinking with distance
  for (let i = 0; i < 4; i++) {
    const x = 23;
    p.hline(x, x + 6 - i, warp(x, 48 + i * 5), T.c0);
    p.hline(x, x + 5 - i, warp(x, 49 + i * 5), T.c1);
  }
  // a conduit on B2: a three-tone pipe and clamps
  p.vline(38, warp(38, 30), warp(38, 98), T.n3);
  p.vline(39, warp(39, 30), warp(39, 98), T.n2);
  p.vline(40, warp(40, 30), warp(40, 98), T.ink);
  for (const ry of [42, 62, 84]) p.rect(37, warp(38, ry), 5, 2, T.n4);
  // a dim neon slit between the bays
  p.vline(30, warp(30, 36), warp(30, 90), T.c0);
  for (let y = 40; y < 90; y += 10) p.vline(30, warp(30, y), warp(30, y) + 3, T.c1);

  // ---- A: the thick outer pillar (nearest, brightest) with its neon channel
  pillar(p, 2, 18, 0, H - 1, 22);
  p.vline(2, 0, H - 1, T.ink);
  p.rect(8, 0, 5, H, T.ink); // channel recess
  p.vline(9, 0, H - 1, T.c1);
  p.vline(10, 0, H - 1, T.c2);
  p.vline(11, 0, H - 1, T.c1);
  for (let y = 24; y < H; y += 11) {
    p.vline(10, y, y + 5, T.c3);
    p.vline(9, y + 1, y + 4, T.c2);
    p.vline(11, y + 1, y + 4, T.c2);
  }
  // the channel's glow on the pillar faces beside it
  p.vline(7, 20, H - 1, T.c0);
  p.vline(13, 20, H - 1, T.c0);
  p.set(10, 27, T.c4);
  p.set(10, 49, T.c4);
  // capital + foot: wide lit blocks
  p.rect(1, 16, 20, 7, T.n2);
  p.hline(1, 20, 16, T.n4);
  p.hline(1, 20, 17, T.n3);
  p.hline(1, 20, 22, T.ink);
  p.hline(2, 19, 23, T.n0);
  p.rect(1, 84, 20, 18, T.n1);
  p.hline(1, 20, 84, T.n4);
  p.hline(1, 20, 85, T.n3);
  p.hline(1, 20, 86, T.ink);

  // ---- C: the thick door-frame pillar, a lit cyan trim on its inner face
  pillar(p, 44, 12, 0, H - 1, 18, true);
  p.vline(55, 0, H - 1, T.ink);
  p.vline(54, 20, H - 1, T.c2);
  p.vline(53, 20, H - 1, T.c0);
  for (let y = 24; y < H; y += 9) p.vline(54, y, y + 4, T.c4);
  // the trim's spill on the bay beside it
  p.vline(43, 24, H - 1, T.c0);
  p.vline(42, 28, H - 1, T.c0);
  p.set(54, 26, T.c4);
  p.set(54, 44, T.c4);
  p.rect(43, 16, 14, 5, T.n3);
  p.hline(43, 56, 16, T.n4);
  p.hline(43, 56, 20, T.ink);

  // ---- plaque (x 56..83 of the left half): a lit backing with banded arch halo, framed by a neon border
  const PB = 45; // the plaque's last row
  p.rect(56, 22, 28, PB - 21, T.n0);
  // bands of halo, centre (83) outward: c1 core, c0 ring, n1 ring; arch-shaped (a chamfered head)
  for (let y = 23; y < PB; y++) {
    const dyHead = Math.max(0, 30 - y); // chamfer rows at the top
    const reach = (r: number): number => Math.max(0, r - dyHead * 1.4 - Math.abs(y - 34) * 0.4);
    for (let x = 57; x < 84; x++) {
      const d = 83 - x + 0.5;
      let c: number = T.n0;
      if (d < reach(28)) c = T.n1;
      if (d < reach(23)) c = T.c0;
      if (d < reach(15)) c = T.c1;
      p.set(x, y, c);
    }
  }
  // plaque border: ink, a neon line, the bevel
  p.hline(56, 83, 21, T.ink);
  p.hline(56, 83, 22, T.c2);
  p.hline(56, 83, 23, T.c0);
  p.vline(56, 21, PB, T.ink);
  p.vline(57, 22, PB, T.c1);
  p.hline(56, 83, PB, T.ink);
  p.hline(57, 83, PB - 1, T.n3);
  p.set(57, 22, T.ink);
  p.set(58, 22, T.c1);

  // ---- doorway below the plaque (x 62..83 left half): lit jambs, a banded slot glow, the threshold
  const D = PB + 1; // first row of the doorway
  p.rect(58, D, 26, H - D, T.n0);
  p.vline(58, D, H - 1, T.ink);
  p.vline(59, D, H - 1, T.n3);
  p.vline(60, D, H - 1, T.n2);
  p.vline(61, D, H - 1, T.c0);
  // glow slot, vertical banding by distance to the axis, brightest at the bottom (light pools on the floor)
  const ramp = [T.n0, T.c0, T.c1, T.c2, T.c3, T.c4, T.white];
  for (let y = D; y < H; y++) {
    for (let x = 62; x < 84; x++) {
      const d = 83 - x + 0.5;
      const lift = Math.min(4, Math.floor((y - D) / 3)); // 0 at the lintel -> 4 near the threshold
      const lvl = 4 - Math.floor(d / 4) + lift;
      p.set(x, y, ramp[Math.max(0, Math.min(ramp.length - 1, lvl))]);
    }
  }
  // lintel: a lit beam with an ink underside
  p.rect(58, D, 26, 2, T.n2);
  p.hline(58, 83, D, T.n4);
  p.hline(58, 83, D + 2, T.ink);
  // the threshold: bright bands that flare outwards at the platform's far edge (the spill)
  for (let i = 0; i < 4; i++) {
    const y = 53 + i * 2;
    p.hline(61 - i * 3, 83, y, i < 2 ? T.c3 : T.c2);
    p.hline(61 - i * 3, 83, y + 1, T.c1);
  }
  // a hairline of steel on the lit jamb
  p.vline(59, D + 4, D + 12, T.steel);
  // base plinth under the doorway
  p.rect(56, 88, 28, 14, T.n0);
  p.hline(56, 83, 88, T.n3);
  p.hline(56, 83, 89, T.ink);
  for (let x = 58; x < 84; x += 6) p.vline(x, 91, 99, T.n1);
  return p;
}

/**
 * Light shafts: clean wedges (no dither) that lift every pixel they cover by ONE palette tone — hard edged like painted light.
 * Two ceiling cones lean in from the outer lamps onto the pillars and bays; the doorway throws a tall fan up the plaque's sides.
 */
const LIFT = new Map<number, number>([
  [T.ink, T.n0],
  [T.n0, T.n1],
  [T.n1, T.n2],
  [T.n2, T.n3],
  [T.n3, T.n4],
  [T.c0, T.c1],
  [T.c1, T.c2],
]);
function lightPass(p: PixelCanvas): void {
  const inCone = (x: number, y: number, ax: number, k: number, y1: number): boolean => y < y1 && Math.abs(x - (ax + (y - 20) * 0.18)) < 2 + (y - 8) * k;
  for (let y = 0; y < TOWER_H; y++)
    for (let x = 0; x < TOWER_W; x++) {
      const lx = x < 84 ? x : TOWER_W - 1 - x;
      if (lx > 54) continue; // the plaque and doorway are lit by themselves
      if (!(inCone(lx, y, 10, 0.2, 76) && lx < 20 && lx > 2) && !(inCone(lx, y, 40, 0.22, 66) && lx >= 20)) continue;
      const c = p.get(x, y);
      if (!c) continue;
      const to = LIFT.get(c);
      if (to !== undefined) p.set(x, y, to);
    }
}

/** The tower texture (168 × 102): the left half mirrored to the right. The emblem plate area is a lit backing (frames drawn on top). */
export function paintTower(): PixelCanvas {
  const half = leftHalf();
  const p = new PixelCanvas(TOWER_W, TOWER_H);
  p.blit(half, 0, 0);
  p.blit(half, 84, 0, { flipX: true });
  // the energy line: housing above the plaque (the vault is ink): glass, core, glow, with bright dashes
  p.rect(80, 0, 8, 22, T.ink);
  p.vline(80, 0, 21, T.n2);
  p.vline(87, 0, 21, T.n2);
  p.vline(83, 0, 21, T.c1);
  p.vline(84, 0, 21, T.c1);
  p.vline(82, 0, 21, T.c0);
  p.vline(85, 0, 21, T.c0);
  for (let y = 3; y < 22; y += 6) {
    p.vline(83, y, y + 2, T.c2);
    p.vline(84, y, y + 2, T.c2);
  }
  lightPass(p);
  return p;
}
