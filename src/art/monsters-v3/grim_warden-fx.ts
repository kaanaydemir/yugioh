// Hortlak Muhafız v3 — light and effects painted AFTER the outline (never outlined, IŞ-9): the violet-white lightning
// (eye sockets, rib gaps, bolts up the spine, sparks on the blade), the afterimage arc of the cut, floor dust and
// the dissolve motes. Every shape comes from a seed (no Math.random): a different shape every frame.

import { PAL } from '../palette';
import { PixelCanvas, mulberry32 } from '../pixel';

export type Pt = readonly [number, number];

const BOLT = PAL.void4;
const BOLT2 = PAL.void3;
const BOLT3 = PAL.void2;
const CORE = PAL.white;

/**
 * A 1-px 4-connected lightning bolt from a to b: a random walk across the line, `amp` px wide. Runs of void3 / void4
 * with a white core run when `hot`. Returns the pixels it set (for branches).
 */
export function bolt(p: PixelCanvas, a: Pt, b: Pt, seed: number, amp = 2, hot = false): Pt[] {
  const rnd = mulberry32(seed * 7919 + 13);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const n = Math.max(1, Math.round(Math.max(Math.abs(dx), Math.abs(dy))));
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const pts: Pt[] = [];
  let off = 0;
  let last: Pt | null = null;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // the walk is pinned to 0 at both ends
    const env = Math.min(1, t * 4, (1 - t) * 4);
    off += (rnd() - 0.5) * 2.6;
    off = Math.max(-amp, Math.min(amp, off));
    const x = Math.round(a[0] + dx * t + px * off * env);
    const y = Math.round(a[1] + dy * t + py * off * env);
    if (last && last[0] !== x && last[1] !== y) pts.push([x, last[1]]);
    if (!last || last[0] !== x || last[1] !== y) pts.push([x, y]);
    last = [x, y];
  }
  for (let i = 0; i < pts.length; i++) {
    const run = Math.floor(i / 3) % 3;
    const c = hot && i > pts.length * 0.15 && i < pts.length * 0.85 && run === 1 ? CORE : run === 2 ? BOLT2 : BOLT;
    p.set(pts[i][0], pts[i][1], c);
  }
  return pts;
}

/** A short fork off a bolt: two or three pixels leaving it sideways. */
export function fork(p: PixelCanvas, from: Pt, dir: Pt, len: number, seed: number): void {
  const rnd = mulberry32(seed * 31 + 5);
  let x = from[0];
  let y = from[1];
  for (let i = 0; i < len; i++) {
    if (rnd() < 0.5) x += Math.sign(dir[0]);
    else y += Math.sign(dir[1]);
    p.set(x, y, i === len - 1 ? BOLT3 : BOLT2);
  }
}

/** Colours of a lit eye socket for intensity `e` (0…1.5). */
export function eyeGlow(p: PixelCanvas, x0: number, y0: number, w: number, h: number, e: number): void {
  if (e <= 0.05) return;
  // dim: a violet ember in the middle; mid: void3 band; hot: void4 core; white-hot: white heart
  const cx = x0 + Math.floor((w - 1) / 2);
  const cy = y0 + Math.floor((h - 1) / 2);
  const c1 = e < 0.45 ? BOLT3 : BOLT2;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (e > 0.45 || (y === cy && x >= cx && x <= cx + 1)) p.set(x, y, c1);
  if (e >= 0.8) for (let y = cy; y <= Math.min(cy + 1, y0 + h - 1); y++) for (let x = cx; x <= Math.min(cx + 1, x0 + w - 1); x++) p.set(x, y, BOLT);
  if (e >= 1.25) p.set(cx, cy, CORE);
}

/** Crackle out of an eye socket: 1–2 bolts leaving up / forward, a new shape per `seed`. */
export function eyeBolts(p: PixelCanvas, at: Pt, up: number, seed: number, n = 2, hot = false): void {
  const rnd = mulberry32(seed * 977 + 3);
  for (let i = 0; i < n; i++) {
    const ang = (-90 + (rnd() - 0.45) * 110 + i * 38) * (Math.PI / 180);
    const l = up * (0.6 + rnd() * 0.6);
    const b: Pt = [Math.round(at[0] + Math.cos(ang) * l), Math.round(at[1] + Math.sin(ang) * l)];
    const pts = bolt(p, at, b, seed + i * 17, 2, hot);
    if (pts.length > 5 && rnd() < 0.6) fork(p, pts[Math.floor(pts.length * 0.55)], [rnd() < 0.5 ? -1 : 1, -1], 2 + Math.floor(rnd() * 2), seed + i);
  }
}

/** A bright segment running along a rib gap (a slit from x0..x1 at rows y..y+h-1): the charge crawls through the ribs. */
export function gapCharge(p: PixelCanvas, x0: number, x1: number, y: number, h: number, pos: number, len: number, hot: number): void {
  for (let x = x0; x <= x1; x++) {
    const d = x - pos;
    if (d < 0 || d >= len) continue;
    const core = d >= 1 && d < len - 1;
    for (let r = 0; r < h; r++) {
      if (!p.isOpaque(x, y + r)) continue;
      const c = core && hot > 0.6 && r === Math.floor(h / 2) ? BOLT : core ? BOLT2 : BOLT3;
      p.set(x, y + r, c);
    }
  }
}

/** Floor dust puffs (clusters ≥ 2 px, tones of the dust, rising and thinning). `k` 0…1 is the age. */
export function dust(p: PixelCanvas, cx: number, cy: number, k: number, seed: number, side = 1): void {
  const rnd = mulberry32(seed * 101 + 9);
  const n = 5;
  for (let i = 0; i < n; i++) {
    const a = rnd();
    const dx = (a - 0.25) * 26 * (0.35 + k) * side;
    const dy = -(2 + rnd() * 7) * k - 1;
    const r = 1.5 + (1 - k) * 1.6 + rnd();
    const c = k < 0.45 ? PAL.stone3 : k < 0.75 ? PAL.stone2 : PAL.stone1;
    p.disc(cx + dx, cy + dy, r, c);
  }
}

/** Dissolve motes rising: 2×2 / 3×3 void clusters above the frame's body. */
export function motes(p: PixelCanvas, pts: readonly (readonly [number, number, number])[]): void {
  for (const [x, y, s] of pts) {
    const c = s >= 3 ? PAL.void4 : s === 2 ? PAL.void3 : PAL.void2;
    p.rect(Math.round(x), Math.round(y), 2, 2, c);
    if (s >= 3) p.set(Math.round(x), Math.round(y), PAL.white);
  }
}
