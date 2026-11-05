// Hortlak Muhafız v3 ("Fener Bekçisi") — light and effects painted AFTER the outline (never outlined, IŞ-9): the soul
// flame inside the lantern, the glass glow, the single cage eye, soul motes, the lantern's burst, glass shards, the
// whirl trail of the chain swing and floor dust. Stepped palette tones only (no alpha, no gradients); every random shape
// comes from a seed (no Math.random): a different flame silhouette every frame, the same frame every time.

import { PAL } from '../palette';
import { PixelCanvas, mulberry32 } from '../pixel';

export type Pt = readonly [number, number];

/**
 * The soul flame in a lantern whose glass interior spans x0..x1 × y0..y1 (inclusive). `k` 0…1.5 is the intensity
 * (0 = dark glass, 0.5 = ember, 1 = burning, 1.4+ = white heart), `seed` picks one of the flame silhouettes, `lean`
 * (−1…1) tilts the tongue against the swing.
 */
export function soulFlame(p: PixelCanvas, x0: number, y0: number, x1: number, y1: number, k: number, seed: number, lean = 0, own: (x: number, y: number) => boolean = () => true): void {
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  // the glass itself: dark green panes, lit when the flame burns
  const pane = k < 0.25 ? PAL.leaf0 : k < 0.6 ? PAL.leaf1 : PAL.leaf2;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (p.isOpaque(x, y) && own(x, y)) p.set(x, y, pane);
  if (k < 0.25) return;
  const rnd = mulberry32(seed * 131 + 7);
  const cx = x0 + (w - 1) / 2 + lean * 0.8;
  // tongue height grows with k; its shape wobbles per seed
  const top = y1 - Math.round((h - 1) * Math.min(1, 0.35 + 0.5 * k)) + Math.round(rnd() * 1.2);
  const tilt = (rnd() - 0.5) * 1.4 + lean;
  for (let y = Math.max(y0, top); y <= y1; y++) {
    const t = (y - top) / Math.max(1, y1 - top); // 0 tip → 1 base
    const half = 0.5 + t * (w * 0.42) * Math.min(1, k + 0.2);
    const mx = cx + tilt * (1 - t) * 1.6;
    for (let x = x0; x <= x1; x++) {
      const d = Math.abs(x - mx);
      if (d > half || !own(x, y)) continue;
      const core = d < half * 0.5 && t > 0.35;
      const c = core ? (k >= 1.4 && t > 0.55 && d < 0.8 ? PAL.white : PAL.leaf4) : PAL.leaf3;
      p.set(x, y, c);
    }
  }
}

/**
 * The single eye light inside the cage, top-left cell (x, y): ember (2 px leaf2) / burning (2×2 leaf3) / blazing (2×2
 * leaf4 core with a leaf3 halo left and right and a leaf2 glow on the brow) / white heart. The second-brightest point
 * of the figure after the lantern.
 */
export function eyeLight(p: PixelCanvas, x: number, y: number, e: number): void {
  if (e <= 0.08) return;
  if (e < 0.45) {
    p.set(x, y + 1, PAL.leaf2);
    p.set(x + 1, y + 1, PAL.leaf2);
    return;
  }
  const core = e >= 0.8 ? PAL.leaf4 : PAL.leaf3;
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) p.set(x + i, y + j, core);
  if (e >= 0.8) {
    p.set(x - 1, y, PAL.leaf3);
    p.set(x - 1, y + 1, PAL.leaf2);
    p.set(x + 2, y, PAL.leaf3);
    p.set(x + 2, y + 1, PAL.leaf3);
    p.set(x + 1, y - 1, PAL.leaf2);
  }
  if (e >= 1.3) {
    p.set(x + 1, y, PAL.white);
    p.set(x + 1, y - 1, PAL.leaf3);
  }
}

/** Soul motes: 1–2 px points of green that rise off the lantern (each [x, y, size 1..3]). */
export function motes(p: PixelCanvas, pts: readonly (readonly [number, number, number])[]): void {
  for (const [x, y, s] of pts) {
    const X = Math.round(x);
    const Y = Math.round(y);
    if (s >= 3) {
      p.set(X, Y, PAL.leaf4);
      p.set(X + 1, Y, PAL.leaf3);
      p.set(X, Y + 1, PAL.leaf3);
    } else if (s === 2) {
      p.set(X, Y, PAL.leaf3);
      p.set(X, Y + 1, PAL.leaf2);
    } else p.set(X, Y, PAL.leaf2);
  }
}

/** Motes drifting up from (cx, cy): `n` points on their own seeded paths at age `t` (0…1). */
export function driftMotes(p: PixelCanvas, cx: number, cy: number, t: number, seed: number, n = 3, spread = 6): void {
  const rnd = mulberry32(seed * 977 + 3);
  const pts: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const ph = (t + rnd()) % 1;
    const x = cx + (rnd() - 0.5) * spread + Math.sin((ph + i) * 6.2) * 1.2;
    const y = cy - 2 - ph * 14;
    pts.push([x, y, ph < 0.35 ? 2 : 1]);
  }
  motes(p, pts);
}

/**
 * The lantern's soul burst at (cx, cy): a stepped green star (one hard ring at most, EF-7), `k` 0…1 age, `r` size.
 * Young: white core + leaf4 rays; old: leaf2 ring fragments.
 */
export function soulBurst(p: PixelCanvas, cx: number, cy: number, k: number, r: number, seed: number): void {
  const rnd = mulberry32(seed * 313 + 11);
  const R = r * (0.45 + 0.75 * k);
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.35;
    if (k >= 0.5) continue;
    const l0 = R * (k < 0.5 ? 0.15 : 0.55);
    const l1 = R * (0.75 + rnd() * 0.45);
    const c = k < 0.35 ? PAL.leaf4 : k < 0.7 ? PAL.leaf3 : PAL.leaf2;
    for (let d = l0; d <= l1; d += 0.7) p.set(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d * 0.8), c);
  }
  if (k < 0.45) {
    const c0 = Math.max(1, Math.round(R * 0.32));
    p.disc(cx, cy, c0 + 1, PAL.leaf3);
    p.disc(cx, cy, c0, PAL.leaf4);
    if (k < 0.25) p.disc(cx, cy, Math.max(1, c0 - 1), PAL.white);
  } else {
    // old: the flame breaks into drifting embers (no ring: a ring + rays read as a reticle, critic r1)
    for (let i = 0; i < 7; i++) {
      const a = rnd() * Math.PI * 2;
      const d = R * (0.6 + rnd() * 0.5);
      const x = Math.round(cx + Math.cos(a) * d);
      const y = Math.round(cy + Math.sin(a) * d * 0.8 - k * 4);
      p.set(x, y, k < 0.7 ? PAL.leaf3 : PAL.leaf2);
      if (i % 2 === 0) p.set(x, y - 1, PAL.leaf2);
    }
  }
}

/** Glass shards flying from (cx, cy) at age k (0…1): 2-px iron / green-glass bits that fall to the floor at fy. */
export function shards(p: PixelCanvas, cx: number, cy: number, fy: number, k: number, seed: number, n = 7): void {
  const rnd = mulberry32(seed * 53 + 17);
  for (let i = 0; i < n; i++) {
    const vx = (rnd() - 0.45) * 26;
    const vy = -6 - rnd() * 10;
    const x = Math.round(cx + vx * k);
    const y = Math.min(fy - 1, Math.round(cy + vy * k + 30 * k * k));
    const c = i % 3 === 0 ? PAL.stone3 : i % 3 === 1 ? PAL.leaf2 : PAL.leaf3;
    p.set(x, y, c);
    p.set(x + 1, y, i % 2 ? c : PAL.leaf1);
  }
}

/** Floor dust puffs (clusters ≥ 2 px, rising and thinning). `k` 0…1 is the age. */
export function dust(p: PixelCanvas, cx: number, cy: number, k: number, seed: number, side = 1, spread = 22): void {
  const rnd = mulberry32(seed * 101 + 9);
  for (let i = 0; i < 5; i++) {
    const a = rnd();
    const dx = (a - 0.25) * spread * (0.35 + k) * side;
    const dy = -(2 + rnd() * 6) * k - 1;
    const r = 1.4 + (1 - k) * 1.5 + rnd() * 0.8;
    const c = k < 0.45 ? PAL.stone3 : k < 0.75 ? PAL.stone2 : PAL.stone1;
    p.disc(cx + dx, cy + dy, r, c);
  }
}

/** Earth clods thrown up while rising out of the floor (summon): small earth clusters at age k. */
export function clods(p: PixelCanvas, cx: number, fy: number, k: number, seed: number, n = 6): void {
  const rnd = mulberry32(seed * 71 + 5);
  for (let i = 0; i < n; i++) {
    const vx = (rnd() - 0.5) * 34;
    const vy = -10 - rnd() * 12;
    const x = Math.round(cx + vx * k);
    const y = Math.round(fy + vy * k + 26 * k * k);
    if (y >= fy) continue;
    const c = i % 2 ? PAL.earth1 : PAL.earth2;
    p.rect(x, y, 2, 2, c);
  }
}

/**
 * The whirl smear of the lantern on its chain: a stepped arc BAND round (cx, cy) on radii rx / ry from angle a0 to a1
 * (rad; a1 = the lantern's side): 1 px leaf1 at the tail widening to 3 px (leaf2 → leaf3, a leaf4 leading core) at
 * the head, stopping short of the lantern itself. Painted only on empty pixels: the smear passes BEHIND the figure.
 */
export function whirlTrail(p: PixelCanvas, cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): void {
  const span = a1 - a0;
  const r = Math.max(rx, ry);
  const stop = Math.min(0.85, 6 / Math.max(1, r * Math.abs(span)));
  const n = Math.max(6, Math.round(Math.abs(span) * r * 1.6));
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * (1 - stop);
    const a = a0 + span * u;
    const th = u < 0.3 ? 0 : u < 0.65 ? 1 : 2;
    for (let d = -th + (th === 2 ? 1 : 0); d <= (th === 0 ? 0 : 1); d++) {
      const x = Math.round(cx + Math.cos(a) * (rx + d));
      const y = Math.round(cy + Math.sin(a) * (ry + d));
      if (p.isOpaque(x, y)) continue;
      const edge = d !== 0 && th > 0;
      const c = u > 0.78 ? (edge ? PAL.leaf3 : PAL.leaf4) : u > 0.5 ? (edge ? PAL.leaf2 : PAL.leaf3) : u > 0.25 ? PAL.leaf2 : PAL.leaf1;
      p.set(x, y, c);
    }
  }
}
