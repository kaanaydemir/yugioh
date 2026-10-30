// Hortlak Muhafız v3 — the LIGHT and MATTER effects: eye lightning, rib glow, blade crackle, the grave's
// mouth, dust, bone chips. Light is drawn after the outline and never outlined (IŞ-9); lightning is a
// 4-connected 1-px zigzag (no lone pixels, IŞ-10), the same shape for at most two frames (REHBER §2.3 electric).

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import type { V } from '../rigkit/geom';

// ------------------------------------------------------------------ lightning

/** A small deterministic generator (no Math.random in art paths). */
function lcg(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * A zigzag path of `len` px from (0, 0): 4-connected steps that climb (dy −1) and wander sideways; `out` is the
 * side it favours (−1 left, +1 right). Set `k` (1…8) fixes the shape.
 */
export function arcPath(k: number, len: number, out: -1 | 1): V[] {
  const r = lcg(k * 7919 + (out > 0 ? 31 : 17));
  const pts: V[] = [[0, 0]];
  let x = 0;
  let y = 0;
  let sideRun = 0;
  while (pts.length < len) {
    const roll = r();
    if (sideRun < 2 && roll < 0.5) {
      // a sideways step, biased outward
      x += r() < 0.72 ? out : -out;
      sideRun++;
    } else {
      y -= 1;
      sideRun = 0;
    }
    pts.push([x, y]);
  }
  return pts;
}

/** Cached per (set, len, side). */
const ARCS = new Map<string, V[]>();
function arcOf(k: number, len: number, out: -1 | 1): V[] {
  const key = `${k}:${len}:${out}`;
  let a = ARCS.get(key);
  if (!a) {
    a = arcPath(k, len, out);
    ARCS.set(key, a);
  }
  return a;
}

export interface ArcOpts {
  /** the eye socket centres (frame px): near (left) and far (right) */
  eyes: readonly [V, V];
  /** lightning set 1…8 (0 = none) and its reach 0…2 */
  set: number;
  reach: number;
  /** skip pixels inside this predicate (the sockets keep their own light) */
  skip?: (x: number, y: number) => boolean;
}

/** The crackle: a main bolt out of each socket (up and outward) with a short fork; cyan3 body, white tip pixel. */
export function eyeArcs(p: PixelCanvas, o: ArcOpts): void {
  if (o.set <= 0 || o.reach <= 0) return;
  const len = Math.max(4, Math.round(9 * o.reach));
  const eyeSides: [V, -1 | 1][] = [
    [o.eyes[0], -1],
    [o.eyes[1], 1],
  ];
  eyeSides.forEach(([c, out], i) => {
    const k = ((o.set + i * 3 - 1) % 8) + 1;
    const path = arcOf(k, len, out);
    path.forEach(([dx, dy], j) => {
      const x = c[0] + dx;
      const y = c[1] - 2 + dy;
      if (o.skip?.(x, y)) return;
      p.set(x, y, j >= path.length - 2 ? PAL.cyan4 : PAL.cyan3);
    });
    // a short fork off the middle of the bolt, back toward the other side
    if (o.reach >= 1.2) {
      const m = path[Math.floor(path.length * 0.55)];
      const fork = arcOf(k + 3, Math.round(len * 0.45), (out * -1) as -1 | 1);
      fork.forEach(([dx, dy], j) => {
        const x = c[0] + m[0] + dx;
        const y = c[1] - 2 + m[1] + dy;
        if (o.skip?.(x, y)) return;
        p.set(x, y, j >= fork.length - 1 ? PAL.cyan4 : PAL.cyan2);
      });
    }
  });
}

/** A bolt between two points (frame px): a 4-connected jagged line, cyan3 with a white core every other run. */
export function bolt(p: PixelCanvas, a: V, b: V, seed: number, core = true): V[] {
  const r = lcg(seed * 104729 + 7);
  const pts: V[] = [];
  let x = Math.round(a[0]);
  let y = Math.round(a[1]);
  const tx = Math.round(b[0]);
  const ty = Math.round(b[1]);
  pts.push([x, y]);
  let guard = 0;
  while ((x !== tx || y !== ty) && guard++ < 200) {
    const dx = tx - x;
    const dy = ty - y;
    // mostly along the longer axis, with a jag across it
    const along = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
    const jag = r() < 0.34 && Math.abs(dx) + Math.abs(dy) > 2;
    if (jag) {
      if (along === 'x') y += r() < 0.5 ? 1 : -1;
      else x += r() < 0.5 ? 1 : -1;
    } else if (along === 'x') x += Math.sign(dx);
    else y += Math.sign(dy);
    pts.push([x, y]);
  }
  pts.forEach(([px, py], i) => p.set(px, py, core && i % 4 === 2 ? PAL.white : PAL.cyan3));
  return pts;
}

// ------------------------------------------------------------------ eyes

/**
 * One eye socket's light (3×3 hollow at `at` = its top-left): 0 = a single dim ember, 1 = rest (cyan1 socket,
 * cyan3 core 2×2), 1.5 = bright (core cyan4), 2 = flaring (the socket white-cyan, a white heart).
 */
export function eyeLight(p: PixelCanvas, at: V, level: number): void {
  const [x, y] = at;
  if (level <= 0.05) {
    p.set(x + 1, y + 2, PAL.cyan1);
    return;
  }
  if (level < 0.7) {
    p.set(x + 1, y + 1, PAL.cyan1);
    p.set(x + 1, y + 2, PAL.cyan2);
    p.set(x + 2, y + 2, PAL.cyan1);
    return;
  }
  const rim = level >= 2 ? PAL.cyan3 : PAL.cyan1;
  const core = level >= 2 ? PAL.white : level >= 1.4 ? PAL.cyan4 : PAL.cyan3;
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) p.set(x + i, y + j, rim);
  // the core sits low and toward the foe: the stare
  for (const [i, j] of [[1, 1], [2, 1], [1, 2], [2, 2]] as const) p.set(x + i, y + j, core);
  if (level >= 2) p.set(x, y + 1, PAL.cyan4);
}

// ------------------------------------------------------------------ matter: dust, chips

const EARTH = [PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4] as const;

/** A low puff of floor dust at (x, y) (the floor point): phase 0…1 = it grows and thins. Two-pixel blobs, no lone px. */
export function dustPuff(p: PixelCanvas, x: number, y: number, phase: number, dir: -1 | 1 = 1): void {
  if (phase <= 0) return;
  const t = Math.min(1, phase);
  const BLOBS: readonly (readonly [number, number, number])[] = [
    [-5, 0, 1],
    [4, 0, 1],
    [-9, -1, 0],
    [8, -1, 0],
    [-2, -2, 2],
    [2, -3, 2],
  ];
  BLOBS.forEach(([bx, by, size], i) => {
    const gone = t > 0.55 + 0.08 * i;
    if (gone) return;
    const px = Math.round(x + bx * (0.5 + t) * dir * (bx < 0 ? 1 : 1));
    const py = Math.round(y + by - t * (3 + size));
    const tone = EARTH[Math.min(3, Math.max(0, Math.round(3 - t * 3 - (size === 0 ? 0 : 0))))];
    p.rect(px, py, 2, size === 2 ? 2 : 1, tone);
    p.rect(px, py, 2, 1, tone);
  });
}

/** Bone chips flying off a struck place (frame px at c): phase 0…1; 2×2 and 2×1 blobs, bone tones. */
export function boneChips(p: PixelCanvas, c: V, phase: number, dir: -1 | 1 = -1): void {
  if (phase <= 0) return;
  const t = Math.min(1, phase);
  const CH: readonly (readonly [number, number, number, number])[] = [
    [4, -6, 2, 2],
    [7, -3, 2, 1],
    [3, -9, 2, 2],
    [9, -7, 1, 2],
    [6, 0, 2, 1],
  ];
  CH.forEach(([vx, vy, w, h], i) => {
    if (t > 0.9 - i * 0.04) return;
    const x = Math.round(c[0] + dir * -vx * t * 3.2);
    const y = Math.round(c[1] + vy * t * 3 + 9 * t * t * 3);
    p.rect(x, y, w, h, i % 2 ? PAL.earth4 : PAL.skin4);
    p.set(x + w - 1, y + h - 1, PAL.earth3);
  });
}

// ------------------------------------------------------------------ the grave's mouth

/**
 * The pit the summon climbs out of (and the revive sinks into): an ellipse in the floor at (cx, cy), `open`
 * 0…1…2 (1 fully open, 2 closed again). Ink-dark void with a violet lip lit from the key light, cyan cracks
 * radiating at the mouth when it opens. Drawn BEHIND the body (it is matter: outlined with the rest).
 */
export function pit(p: PixelCanvas, cx: number, cy: number, open: number, left: boolean): void {
  if (open <= 0 || open >= 2) return;
  const k = open <= 1 ? open : 2 - open;
  const rx = Math.round(5 + 15 * k);
  const ry = Math.round(1 + 2 * k);
  p.ellipse(cx, cy, rx, ry, PAL.void0);
  // the lip: the back edge lit (void2), the front edge shaded (void1)
  for (let x = -rx; x <= rx; x++) {
    const t = x / rx;
    const yy = Math.round(ry * Math.sqrt(Math.max(0, 1 - t * t)));
    if (yy < 1) continue;
    const lit = left ? x < 0 : x > 0;
    p.set(cx + x, cy - yy, lit ? PAL.void3 : PAL.void2);
    p.set(cx + x, cy + yy, PAL.void1);
  }
  // a hot core: cracks of cyan across the hollow while it is open
  if (k > 0.5) {
    for (let i = -rx + 3; i <= rx - 3; i += 5) p.set(cx + i, cy, i % 2 === 0 ? PAL.cyan1 : PAL.cyan2);
  }
}

/** The crack the grave leaves running out of the pit across the floor (cyan1 / cyan2 light, 4-connected). */
export function floorCrack(p: PixelCanvas, cx: number, cy: number, reach: number, seed = 3): void {
  if (reach <= 0) return;
  const r = lcg(seed * 977);
  for (const side of [-1, 1] as const) {
    let x = cx + side * 6;
    let y = cy;
    const n = Math.round(reach * 12);
    for (let i = 0; i < n; i++) {
      p.set(x, y, i > n - 3 ? PAL.cyan1 : PAL.cyan2);
      if (r() < 0.45) y += r() < 0.5 ? 1 : -1;
      else x += side;
      p.set(x, y, i > n - 3 ? PAL.cyan1 : PAL.cyan2);
    }
  }
}
