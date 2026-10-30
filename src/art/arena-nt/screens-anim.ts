// Neon Tower — the idle schedule of the two portrait screens (owner B2). Pure functions of the scene clock
// (no state, no Math.random): every motion is a function of `t` (ms, the arena's scaled clock) and of the
// screen's own period / offset, so the two screens are never in step and a frozen clock film is deterministic.
//
//   blink     the eyes close for 130 ms every ~6.4 s (left) / ~7.7 s (right); every third cycle blinks twice
//   sway      the hair tips move 1 px on a slow 4-step breeze (0 +1 0 −1), 620 / 700 ms per step
//   sweep     a 5-px wide column of the lit picture crosses the portrait in 800 ms, every ~9.3 s / ~11.9 s
//   scan      a 1-px lit scan row walks down the picture, one pass every 4.2 s / 3.8 s
//   flicker   the whole picture one tone brighter for 34 ms (one frame at 30 fps) every ~3.7 s / ~5.3 s
//   tear      a 4-px band of the picture slips 2 px sideways for 80 ms, very rarely
//   breath    the frame's neon line goes bright for 500 ms every ~6 s while the player is not the active one

import { PORTRAIT_H, PORTRAIT_W } from './portraits';

interface Sched {
  blinkP: number;
  blinkOff: number;
  swayP: number;
  swayOff: number;
  sweepP: number;
  sweepOff: number;
  scanP: number;
  scanOff: number;
  flickP: number;
  flickOff: number;
  tearP: number;
  tearOff: number;
  breathP: number;
  breathOff: number;
}

const S: readonly [Sched, Sched] = [
  { blinkP: 6400, blinkOff: 1800, swayP: 620, swayOff: 0, sweepP: 9300, sweepOff: 2500, scanP: 4200, scanOff: 700, flickP: 3700, flickOff: 900, tearP: 14300, tearOff: 6100, breathP: 6100, breathOff: 800 },
  { blinkP: 7700, blinkOff: 4100, swayP: 700, swayOff: 310, sweepP: 11900, sweepOff: 7000, scanP: 3800, scanOff: 2900, flickP: 5300, flickOff: 2600, tearP: 17100, tearOff: 11300, breathP: 6700, breathOff: 3900 },
];

const mod = (a: number, n: number): number => ((a % n) + n) % n;

/** Eyes closed at time t? */
export function blinkAt(who: 0 | 1, t: number): boolean {
  const s = S[who];
  const u = t + s.blinkOff;
  const cycle = Math.floor(u / s.blinkP);
  const k = mod(u, s.blinkP);
  if (cycle < 0) return false;
  if (k < 130) return true;
  return cycle % 3 === 2 && k >= 260 && k < 390;
}

/** Hair tip sway step: −1, 0 or +1. */
export function swayAt(who: 0 | 1, t: number): -1 | 0 | 1 {
  const s = S[who];
  const step = Math.floor((t + s.swayOff) / s.swayP);
  return ([0, 1, 0, -1] as const)[mod(step, 4)];
}

/** Left edge (picture px) of the 5-px sweep column, or null when no sweep is running. */
export function sweepAt(who: 0 | 1, t: number): number | null {
  const s = S[who];
  const k = mod(t + s.sweepOff, s.sweepP);
  if (k >= 800) return null;
  return Math.round(-5 + ((PORTRAIT_W + 5) * k) / 800);
}

/** The scan row (picture y). */
export function scanAt(who: 0 | 1, t: number): number {
  const s = S[who];
  return Math.floor((PORTRAIT_H * mod(t + s.scanOff, s.scanP)) / s.scanP);
}

/** Whole-picture flicker frame? */
export function flickerAt(who: 0 | 1, t: number): boolean {
  const s = S[who];
  return mod(t + s.flickOff, s.flickP) < 34;
}

/** A sideways slipped band (picture y, height, dx) or null. */
export function tearAt(who: 0 | 1, t: number): { y: number; h: number; dx: number } | null {
  const s = S[who];
  const u = t + s.tearOff;
  const k = mod(u, s.tearP);
  if (k >= 80) return null;
  const n = Math.floor(u / s.tearP);
  return { y: 8 + mod(n * 17 + who * 11, 36), h: 4, dx: n % 2 === 0 ? 2 : -2 };
}

/** The frame's neon is bright for a moment (idle breathing of the inactive side). */
export function breathAt(who: 0 | 1, t: number): boolean {
  const s = S[who];
  return mod(t + s.breathOff, s.breathP) < 500;
}
