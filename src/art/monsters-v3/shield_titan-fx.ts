// Kalkan Devi v3 — the MATTER and LIGHT the anims throw around: dust puffs off the planted foot, bronze
// chips off the struck face, steel sparks. Every effect is a pure function of the frame's channels (a
// phase 0…1 and a spot): no randomness, no state between frames (A3_MIMARI §3.3). Dust is the floor's
// earth ramp (or the plate's own bronze at death), chips the bronze ramp, sparks the iron ramp's light
// end plus white; they are drawn AFTER the outline (never outlined), the way the sentinel's matter is.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';

type V = readonly [number, number];

const disc = (q: PixelCanvas, cx: number, cy: number, r: number, c: number, hi: number, lo: number): void => {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r + (r > 1 ? 1 : 0)) continue;
      const lit = x + y <= -r + 1 && (x < 0 || y < 0);
      const dark = x + y >= r - 1 && (x > 0 || y > 0);
      q.set(cx + x, cy + y, r >= 2 && lit ? hi : r >= 2 && dark ? lo : c);
    }
};

/** Blob table: [x travel at p = 1 (px, + right), height at p = 1, base radius, delay (0…0.4)]. */
// prettier-ignore
const PUFF: readonly (readonly [number, number, number, number])[] = [
  [-13, 5, 2, 0], [-8, 8, 3, 0.05], [-3, 4, 2, 0.1], [4, 7, 3, 0], [9, 4, 2, 0.12], [14, 7, 2, 0.06],
];

/** A low dust puff at the ground point `at`, phase p (0…1]: blobs roll out along the floor and rise, then thin to nothing. */
export function dustPuff(q: PixelCanvas, at: V, p: number, tone: 0 | 1, wide = 1): void {
  if (!(p > 0)) return;
  const ramp = tone === 1 ? [PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4] : [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3];
  for (const [tx, h, r0, delay] of PUFF) {
    const t = Math.max(0, Math.min(1, (p - delay) / (1 - delay)));
    if (t <= 0) continue;
    const cx = Math.round(at[0] + tx * wide * (1 - (1 - t) * (1 - t)));
    const cy = Math.round(at[1] - 1 - h * Math.sin((t * Math.PI) / 2) * 0.8);
    let r = r0 + (t < 0.35 ? 0 : t < 0.7 ? 0 : -1);
    if (t > 0.5) r = Math.min(r, r0 - 1);
    if (t > 0.82) r = Math.min(r, 1);
    if (r < 1 || t > 0.94) continue;
    if (r === 1) {
      q.set(cx, cy, ramp[1]);
      continue;
    }
    disc(q, cx, cy, r, ramp[1], ramp[2], ramp[0]);
  }
}

/** Bronze chips flying from `at`, phase p (0…1]: 7 flakes on arcs (1–2 px, lit top). dir +1 right, −1 left. */
// prettier-ignore
const CHIPSET: readonly (readonly [number, number, number])[] = [
  [-9, -9, 2], [-5, -12, 1], [-2, -8, 2], [3, -11, 1], [6, -8, 2], [9, -12, 1], [12, -6, 1],
];
export function chipBurst(q: PixelCanvas, at: V, p: number, dir: 1 | -1 = 1): void {
  if (!(p > 0)) return;
  for (const [vx, vy, sz] of CHIPSET) {
    const t = Math.min(1, p);
    const x = Math.round(at[0] + dir * vx * t * 1.4);
    const y = Math.round(at[1] + vy * t + 14 * t * t);
    if (t > 0.9 && sz === 1) continue;
    q.set(x, y, PAL.earth3);
    if (sz === 2) {
      q.set(x + 1, y, PAL.earth2);
      q.set(x, y + 1, PAL.earth2);
      q.set(x + 1, y + 1, PAL.earth1);
    }
  }
}

/** Steel sparks from `at`, phase p (0…1]: a ring of 8 hairline streaks that fly out and gravitate; white → mist → steel as they age. */
// prettier-ignore
const SPARKS: readonly (readonly [number, number])[] = [
  [-7, -3], [-5, -7], [-1, -9], [3, -8], [6, -5], [8, -1], [-8, 1], [4, -11],
];
export function sparkBurst(q: PixelCanvas, at: V, p: number, dir: 1 | -1 = 1): void {
  if (!(p > 0)) return;
  const t = Math.min(1, p);
  const c = t < 0.35 ? PAL.white : t < 0.7 ? PAL.mist : PAL.steel;
  // the strike's flash: a white plus with mist rays for the first frames
  if (t <= 0.2) {
    const x = Math.round(at[0]);
    const y = Math.round(at[1]);
    for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]] as const) q.set(x + dx, y + dy, PAL.white);
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]] as const) q.set(x + dx * (dir === 1 ? 1 : -1), y + dy, PAL.mist);
  }
  for (const [vx, vy] of SPARKS) {
    const x = Math.round(at[0] + dir * vx * t * 1.2);
    const y = Math.round(at[1] + vy * t + 9 * t * t);
    if (t > 0.92) continue;
    q.set(x, y, c);
    // the streak: one pixel behind it toward the centre while it is young
    if (t < 0.5) q.set(Math.round(at[0] + dir * vx * t * 0.7), Math.round(at[1] + vy * t * 0.7 + 4 * t * t), t < 0.25 ? PAL.mist : PAL.steel);
  }
}
