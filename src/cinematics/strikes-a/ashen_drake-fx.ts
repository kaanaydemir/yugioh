// Kül Ejderi (ashen_drake) — the pixel pieces of "Kül Fırtınası Nefesi" (docs/v3/kart-a/ashen_drake.md §5.2.1):
// the billow (a stepped round puff with a rim, an underside, a body and a lit cap that TUMBLES backwards),
// the bank's veil layout over a target (a soft mound of billows with gaps between them, EF-2), the
// flame tongues of the ignition and the per-billow burn-off. No registration here; ./ashen_drake.ts
// drives them. Whole pixels and palette tones only, no alpha.

import { PAL } from '../../art/palette';
import type { Px } from '../../vfx/combat';

/** A billow's four tones: rim (lower / far edge), underside, body, lit cap. */
export type Tones = readonly [number, number, number, number];

export const ASH_T: Tones = [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3];
/** frame +1 of the ignition: the inner billows first (inside-out) */
export const WHITE_T: Tones = [PAL.fire2, PAL.fire3, PAL.fire4, PAL.white];
export const HOT_T: Tones = [PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4];
export const BURN_T: Tones = [PAL.fire1, PAL.fire1, PAL.fire2, PAL.fire3];
export const COOL_T: Tones = [PAL.stone0, PAL.fire1, PAL.fire1, PAL.fire2];
export const CHAR_T: Tones = [PAL.stone0, PAL.stone0, PAL.stone1, PAL.fire1];
/** the cooled ash after a fizzle */
export const DEAD_T: Tones = [PAL.stone0, PAL.stone0, PAL.stone1, PAL.stone2];

/**
 * One billow: a stepped round puff (ry = r × squash) centred at (cx, cy). The cap is the lit crescent on
 * the side `capA` points to (radians, screen space: −π/2 = straight up); turning capA toward the attacker
 * frame by frame makes the puff tumble backwards over itself. `core` paints a small hot centre.
 */
export function drawPuff(px: Px, cx: number, cy: number, r: number, t: Tones, capA: number, squash = 0.8, core = -1): void {
  const R = Math.max(1, r);
  const ry = Math.max(1, R * squash);
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  const lx = Math.cos(capA);
  const ly = Math.sin(capA);
  const rx2 = Math.ceil(R);
  const ry2 = Math.ceil(ry);
  for (let y = -ry2; y <= ry2; y++) {
    const ny = (y + 0.5) / ry - 0.5 / ry;
    for (let x = -rx2; x <= rx2; x++) {
      const nx = x / R;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const d = Math.sqrt(d2);
      const l = nx * lx + ny * ly;
      let c: number;
      // the rim: the outer ring on the side away from the cap (separates puff from puff)
      if (d > 1 - 1.2 / R && l < 0.15) c = t[0];
      else if (core >= 0 && d < 0.38) c = core;
      else if (l > 0.42 && d > 0.3) c = t[3];
      else if (l > -0.3) c = t[2];
      else c = t[1];
      px.dot(x0 + x, y0 + y, c);
    }
  }
}

/** A cheap deterministic hash in [0, 1). */
export function hash(a: number, b = 0): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export interface VeilSlot {
  /** offset from the target's ground point (x across, h height of the puff's base over the floor) */
  x: number;
  h: number;
  r: number;
  /** draw order: lower first; the front row is drawn last */
  z: number;
  /** 0 = top row … 2 = base row (the burn-off cools the top first) */
  row: number;
}

/**
 * The veil: a soft mound of billows over the target's feet and legs, ≤ 70 % of its height, with gaps
 * between the upper puffs so the silhouette reads through (EF-2). `wall` = the blocked pile-up: wide,
 * low and flat-fronted, splaying sideways along the guard plane.
 */
export function veilSlots(W: number, H: number, wall = false): VeilSlot[] {
  const out: VeilSlot[] = [];
  const base = wall ? 5 : 4;
  const rb = Math.max(4, Math.round(W * (wall ? 0.2 : 0.24)));
  for (let i = 0; i < base; i++) {
    const k = i / (base - 1) - 0.5;
    out.push({ x: Math.round(k * W * (wall ? 1.25 : 0.95)), h: 0, r: Math.round(rb * (1 - Math.abs(k) * 0.45)), z: 3, row: 2 });
  }
  // the back row (half hidden behind the base)
  for (let i = 0; i < 3; i++) out.push({ x: Math.round((i - 1) * W * 0.34), h: 2, r: Math.round(rb * 0.8), z: 0, row: 2 });
  const r2 = Math.max(3, Math.round(rb * 0.78));
  const mid = wall ? 3 : 2;
  for (let i = 0; i < mid; i++) {
    const k = i / (mid - 1) - 0.5;
    out.push({ x: Math.round(k * W * (wall ? 0.8 : 0.5)), h: Math.round(H * 0.38), r: r2, z: 1, row: 1 });
  }
  if (!wall) out.push({ x: Math.round(W * 0.06), h: Math.round(H * 0.68), r: Math.max(3, Math.round(rb * 0.55)), z: 0.5, row: 0 });
  return out.sort((a, b) => a.z - b.z || b.h - a.h);
}

/**
 * The swallowing veil over a monster (critic r1 #2): a LATTICE of ash cells climbing the body to `H`
 * (60–70 % of its bounding box), `VW` wide at the base and narrowing up. Each cell is a billow with a 1-px
 * ink seam round it (the caller draws it), so grey ash reads against grey stone targets; the lower rows are
 * packed (seams only), the top two rows leave open gaps the body shows through (EF-2). Rows step in brick
 * order; `row` 0 = the top third (it burns off first) … 2 = the base third.
 */
export function latticeSlots(VW: number, H: number): VeilSlot[] {
  const out: VeilSlot[] = [];
  const rows = Math.max(3, Math.round(H / 7));
  for (let j = 0; j < rows; j++) {
    const k = rows === 1 ? 0 : j / (rows - 1);
    const r = Math.max(3, Math.round(6 - 2.5 * k));
    const span = VW * (1 - 0.5 * k);
    const gap = j >= rows - 2 ? 3 : 0;
    const n = Math.max(1, Math.round(span / (2 * r + gap)));
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0 : i / (n - 1) - 0.5;
      const x = u * (span - 2 * r) + (j % 2 ? 2 : -1);
      out.push({ x: Math.round(x), h: Math.round(k * (H - r * 1.6)), r, z: 3 - k, row: k > 0.62 ? 0 : k > 0.3 ? 1 : 2 });
    }
  }
  return out.sort((a, b) => a.z - b.z || b.h - a.h);
}

/**
 * Flame tongues on a burning puff's top: 2-px columns of fire2 / fire3 with a fire4 tip, jagged heights
 * re-rolled every 2 frames (stepped, never boiling every frame). `heat` 0..1 scales them.
 */
export function tongues(px: Px, cx: number, topY: number, r: number, heat: number, frame: number, seedN: number): void {
  if (heat <= 0) return;
  const step = Math.floor(frame / 2);
  const n = Math.max(1, Math.round(r / 2.5));
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : i / (n - 1) - 0.5;
    const x = Math.round(cx + u * r * 1.3);
    const yTop = Math.round(topY + Math.abs(u) * r * 0.6);
    const h = Math.round((2 + hash(seedN + i, step) * 6) * heat);
    if (h < 1) continue;
    for (let j = 0; j < h; j++) {
      const y = yTop - j;
      const tip = j >= h - 1;
      const c = tip ? PAL.fire4 : j < h * 0.45 ? PAL.fire2 : PAL.fire3;
      px.dot(x, y, c);
      if (j < h * 0.55) px.dot(x + 1, y, j < h * 0.3 ? PAL.fire2 : PAL.fire3);
    }
    // a lick that leans with the step
    if (h >= 4 && hash(seedN + i * 3, step) > 0.5) px.dot(x + (step % 2 ? 1 : -1), yTop - h, PAL.fire3);
  }
}
