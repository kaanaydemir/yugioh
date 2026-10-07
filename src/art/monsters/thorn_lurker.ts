// Dikenli Pusucu (thorn_lurker) — EARTH carnivorous plant, 48×48.
//
// A fat flytrap bulb half-buried in a mound of earth, facing right. Its upper half is a hinged
// lid (hinge at the back-left): it lifts to reveal a crimson maw lined with white fangs, a pink
// tongue and a dark throat. A crest of purple-pink thorn spikes runs over the lid, small glowing
// eye spots sit above the lip, a rosette of leaves splays on the ground and two thorny vines rise
// out of the soil — the front one is the whip ("Diken Kırbacı").
//
// The pod sits on the left of the frame (anchor x = 17) so the whip has ~30 px of free reach to
// the right: it arches back over the pod (anticipation), then cracks forward horizontally at
// mouth height (impact).
//
// Parametric rig: every frame is a Pose (numbers). The lid and the fangs are rasterized by
// inverse rotation around the hinge so they stay crisp at any angle; vines are cubic Bézier
// paths (+ an optional tip curl) resampled at 1 px and drawn as tapered strokes with a lit ridge
// and tapered thorn spikes. Paint order: back vine → back leaves → jaw → maw → lid → fangs →
// soil mound + roots → front leaves → front vine → particles → outline → light pass.

import { PAL } from '../palette';
import { PixelCanvas, bezier, type Pt } from '../pixel';
import type { MonsterAnim, MonsterArt } from '../types';

const W = 48;
const H = 48;
const TAU = Math.PI * 2;
const GROUND = 44;
/** Hinge of the lid at rest (frame px) and bulb radii. The pod's center is x = HX + RX - 0.5 = 17. */
const HX = 4.5;
const HY = 33.5;
const RX = 13;
const RY = 11;

type Canvas = PixelCanvas;

// ---------------------------------------------------------------- pose

/** A vine: cubic Bézier root → c1 → c2 → tip, then `cl` px of tip curl turning `curl` rad/px (+ = clockwise on screen). */
interface Vine {
  r: Pt;
  c1: Pt;
  c2: Pt;
  t: Pt;
  curl: number;
  cl: number;
}

interface Bit {
  x: number;
  y: number;
  k: 'leaf' | 'thorn' | 'spore' | 'drip';
  /** shape / color variant */
  v: number;
}

interface Pose {
  /** Body offset from rest (px). */
  bx: number;
  by: number;
  /** Lid angle (rad, negative = open). */
  lid: number;
  /** Jaw tremble (px, applied to the lid only). */
  jit: number;
  vF: Vine;
  vB: Vine;
  /** Vines wrapped around the bulb in front (guard). */
  wrap: boolean;
  /** Thorn length scale (bristle). */
  thorn: number;
  /** Eye glow 0..2 (0 = shut). */
  eye: number;
  /** Maw glow 0..2 (inner mouth brightness). */
  maw: number;
  /** Leaf flap (-1 droop .. 1 lifted). */
  flap: number;
  /** Whip smear: earlier poses of the front vine, oldest first (motion arcs drawn between them and vF). */
  ghosts: Vine[];
  /** Whip-crack flash 0..1, at the vine tip (or at `crackAt`). */
  crack: number;
  crackAt: Pt | null;
  bits: Bit[];
  /** Glow phase of the lure pores on the lid (0..1). */
  lure: number;
}

const V = (r: Pt, c1: Pt, c2: Pt, t: Pt, curl = 0, cl = 0): Vine => ({ r, c1, c2, t, curl, cl });
const add = (a: Pt, dx: number, dy = 0): Pt => [a[0] + dx, a[1] + dy];

/** Rest vines: the whip rises at the pod's front-right and hooks toward the enemy; the back vine hooks away. */
const VF0 = V([30, 43], [31, 34], [34, 27], [35, 21], 0.42, 5);
const VB0 = V([10, 41], [9, 32], [6, 23], [7, 17], -0.45, 4);
/** Where the whip vine leaves the soil (frame px) — VFX vines should start here. */
export const VINE_ROOT = { x: 30, y: 42 };

const N: Pose = {
  bx: 0,
  by: 0,
  lid: -0.16,
  jit: 0,
  vF: VF0,
  vB: VB0,
  wrap: false,
  thorn: 1,
  eye: 1,
  maw: 1,
  flap: 0,
  ghosts: [],
  crack: 0,
  crackAt: null,
  bits: [],
  lure: 0,
};

const P = (o: Partial<Pose>): Pose => ({ ...N, ...o });

// ---------------------------------------------------------------- animations

function idlePose(f: number, n: number): Pose {
  const t = f / n;
  const s = Math.sin(t * TAU); // pulse: + = swell (lid lifts, maw breathes)
  // a wave runs up each vine: base first, tip last
  const w = (lag: number) => Math.sin((t - lag) * TAU);
  const vF = V(VF0.r, add(VF0.c1, 0.5 * w(0)), add(VF0.c2, 1.1 * w(0.1)), add(VF0.t, 1.8 * w(0.22), -0.5 * w(0.22)), VF0.curl + 0.07 * w(0.3), VF0.cl);
  const vB = V(VB0.r, add(VB0.c1, -0.5 * w(0.4)), add(VB0.c2, -1.0 * w(0.5)), add(VB0.t, -1.6 * w(0.62), -0.4 * w(0.62)), VB0.curl - 0.07 * w(0.7), VB0.cl);
  return P({
    by: s > 0.6 ? -1 : 0,
    lid: -0.16 - 0.04 * s,
    vF,
    vB,
    eye: f === 6 ? 0 : 1 + 0.35 * Math.max(0, w(0.1)),
    maw: 1 + 0.5 * s,
    flap: w(0.35) > 0.3 ? 1 : w(0.35) < -0.6 ? -1 : 0,
    bits: idleBits(t),
    lure: t,
  });
}

/** A bead of nectar swells on the lip and drops into the soil; a spore drifts up off the lid. */
function idleBits(t: number): Bit[] {
  const out: Bit[] = [];
  if (t >= 0.375) {
    const k = (t - 0.375) / 0.625;
    out.push({ x: 27, y: 36 + Math.round(k * k * 7), k: 'drip', v: k < 0.25 ? 0 : 1 });
  }
  const u = (t + 0.5) % 1;
  out.push({ x: 13 + Math.round(Math.sin(u * TAU) * 1.5), y: 20 - Math.round(u * 9), k: 'spore', v: u < 0.5 ? 0 : 1 });
  return out;
}

const LEAF_BURST = (k: number): Bit[] =>
  [
    [32, 30, 1.2, -1.6, 0],
    [3, 30, -0.4, -1.3, 1],
    [36, 38, 1.5, -0.6, 2],
    [2, 37, -0.2, -0.5, 3],
  ].map(([x, y, vx, vy, v]) => ({ x: x + vx * k * 6, y: y + vy * k * 8 + k * k * 6, k: 'leaf' as const, v }));

const SPORES = (k: number): Bit[] =>
  [
    [25, 21, 0.6, -1],
    [22, 17, 0.2, -1.2],
    [28, 20, 1, -0.6],
    [19, 19, -0.3, -1.1],
    [26, 15, 0.5, -1.3],
  ].map(([x, y, vx, vy], i) => ({ x: x + vx * k * 9, y: y + vy * k * 9, k: 'spore' as const, v: i % 2 }));

// Attack whip key poses (also used for the smear ghosts).
const A_REAR = V([29, 44], [36, 26], [28, 7], [12, 13], -0.32, 4);
const A_SWING = V([30, 43], [38, 29], [40, 10], [31, 6], -0.3, 3);
const A_LASH = V([30, 43], [31, 33], [34, 30], [42, 30], 0, 0);
const A_OVER = V([30, 43], [31, 36], [37, 35], [42, 39], 0.35, 2);

const ANIMS: Record<MonsterAnim, { fps: number; loop: boolean; poses: Pose[] }> = {
  idle: { fps: 8, loop: true, poses: Array.from({ length: 8 }, (_, f) => idlePose(f, 8)) },

  // Roar: clench and sink (anticipation, vines curled in) → the pod bursts open, vines fling out
  // wide, thorns bristle, spores spray → maw held wide, trembling → snap shut → settle.
  roar: {
    fps: 10,
    loop: false,
    poses: [
      P({}),
      P({ by: 1, lid: 0.04, vF: V([30, 43], [31, 37], [32, 32], [29, 28], 0.5, 6), vB: V([9, 42], [9, 37], [8, 32], [11, 28], 0.5, 6), thorn: 0.6, flap: -1, eye: 1.4 }),
      P({ bx: 1, by: -1, lid: -0.62, vF: V([30, 43], [33, 36], [38, 30], [42, 24], 0.12, 3), vB: V([9, 42], [6, 36], [3, 30], [2, 24], -0.12, 3), thorn: 1.3, flap: 1, eye: 2, maw: 1.8, bits: SPORES(0.1) }),
      P({ bx: 1, by: -1, lid: -0.84, jit: -1, vF: V([30, 43], [33, 36], [38, 29], [42, 22], 0.04, 3), vB: V([9, 42], [6, 36], [3, 29], [2, 22], -0.04, 3), thorn: 1.35, flap: 1, eye: 2, maw: 2, bits: SPORES(0.35) }),
      P({ bx: 1, by: -1, lid: -0.8, jit: 0, vF: V([30, 43], [33, 36], [38, 30], [42, 23], 0.08, 3), vB: V([9, 42], [6, 36], [3, 30], [2, 23], -0.08, 3), thorn: 1.35, flap: 1, eye: 2, maw: 2, bits: SPORES(0.6) }),
      P({ bx: 1, by: -1, lid: -0.84, jit: -1, vF: V([30, 43], [33, 36], [38, 29], [42, 22], 0.04, 3), vB: V([9, 42], [6, 36], [3, 29], [2, 22], -0.04, 3), thorn: 1.35, flap: 1, eye: 2, maw: 2, bits: SPORES(0.85) }),
      P({ lid: -0.45, vF: V([30, 43], [32, 35], [37, 28], [40, 22], 0.25, 4), vB: V([9, 42], [7, 35], [4, 29], [4, 23], -0.25, 4), thorn: 1.3, eye: 1.6, maw: 1.5 }),
      P({ by: 1, lid: 0.04, vF: V([30, 43], [31, 35], [33, 28], [33, 23], 0.5, 5), vB: V([9, 42], [8, 35], [6, 29], [6, 24], -0.5, 5), thorn: 1.1, flap: -1, eye: 1.3, bits: LEAF_BURST(0.2).slice(0, 2) }),
      P({}),
    ],
  },

  // Attack ("Diken Kırbacı"): the whip vine rears up and arches back over the pod like a scorpion
  // tail (anticipation, 2 frames, the maw snarls) → it swings over the top (smear) → IMPACT: the
  // vine cracks out horizontally at mouth height, tip at the muzzle, thorns flung → overshoot
  // down → retract → settle.
  attack: {
    fps: 12,
    loop: false,
    poses: [
      P({}),
      P({ bx: -1, lid: -0.18, vF: V([29, 43], [34, 30], [34, 19], [27, 14], -0.3, 4), vB: V([10, 42], [8, 34], [6, 27], [6, 21], -0.35, 3), thorn: 1.2, eye: 1.4, maw: 1.3 }),
      P({ bx: -1, by: 1, lid: -0.28, vF: A_REAR, vB: V([10, 43], [8, 35], [6, 29], [6, 23], -0.4, 3), thorn: 1.4, eye: 1.8, maw: 1.5, flap: -1 }),
      P({ lid: -0.36, vF: A_SWING, thorn: 1.4, eye: 2, maw: 1.6, ghosts: [A_REAR] }),
      P({ bx: 1, lid: -0.5, vF: A_LASH, vB: V([10, 42], [9, 34], [7, 28], [7, 22], -0.3, 4), thorn: 1.5, eye: 2, maw: 2, crack: 1, ghosts: [A_SWING], flap: 1,
        bits: [{ x: 39, y: 24, k: 'thorn', v: 0 }, { x: 40, y: 35, k: 'thorn', v: 1 }, { x: 35, y: 25, k: 'thorn', v: 2 }] }),
      P({ bx: 1, lid: -0.3, vF: A_OVER, thorn: 1.3, eye: 1.6, maw: 1.5, crack: 0.5, crackAt: [43, 30], ghosts: [A_LASH],
        bits: [{ x: 42, y: 20, k: 'thorn', v: 0 }, { x: 44, y: 33, k: 'thorn', v: 1 }, { x: 38, y: 18, k: 'thorn', v: 2 }, { x: 39, y: 40, k: 'leaf', v: 1 }] }),
      P({ lid: -0.15, vF: V([30, 43], [32, 35], [36, 29], [38, 24], 0.45, 4), eye: 1.3, maw: 1.2, bits: [{ x: 41, y: 42, k: 'leaf', v: 2 }] }),
      P({ lid: -0.1, vF: V([30, 43], [31, 34], [34, 27], [36, 21], 0.45, 5) }),
      P({}),
    ],
  },

  // Hit: knocked back and squashed into the soil, lid clamps shut, eyes squeezed, vines flail
  // back, torn leaves fly off to the right.
  hit: {
    fps: 10,
    loop: false,
    poses: [
      P({ bx: -2, by: 1, lid: 0.05, eye: 0, maw: 0.4, thorn: 0.8, flap: -1,
        vF: V([30, 44], [31, 35], [29, 27], [25, 21], -0.35, 4), vB: V([12, 43], [10, 35], [8, 29], [8, 23], -0.25, 3),
        bits: [{ x: 33, y: 24, k: 'leaf', v: 0 }, { x: 36, y: 31, k: 'leaf', v: 2 }, { x: 30, y: 19, k: 'leaf', v: 1 }, { x: 37, y: 22, k: 'thorn', v: 0 }] }),
      P({ bx: -1, lid: 0.02, eye: 0, maw: 0.6, thorn: 0.9,
        vF: V([30, 43], [31, 34], [31, 27], [28, 21], -0.1, 4), vB: V([11, 42], [9, 34], [6, 27], [6, 21], -0.35, 4),
        bits: [{ x: 36, y: 20, k: 'leaf', v: 1 }, { x: 39, y: 28, k: 'leaf', v: 3 }, { x: 32, y: 14, k: 'leaf', v: 2 }, { x: 40, y: 17, k: 'thorn', v: 1 }] }),
      P({ lid: -0.06, eye: 0.8, vF: V([30, 43], [31, 34], [34, 27], [36, 21], 0.3, 5),
        bits: [{ x: 38, y: 18, k: 'leaf', v: 3 }, { x: 40, y: 30, k: 'leaf', v: 0 }, { x: 34, y: 11, k: 'leaf', v: 1 }] }),
      P({ bits: [{ x: 40, y: 24, k: 'leaf', v: 2 }, { x: 37, y: 13, k: 'leaf', v: 0 }] }),
    ],
  },

  // Guard: the pod is clamped shut and sunk lower into the soil; both vines wrap around it in
  // front like a thorny cage, eyes peeking between them; a slow, tight pulse.
  guard: {
    fps: 4,
    loop: true,
    poses: [0, 1, 2, 3].map((f) => {
      const s = Math.sin((f / 4) * TAU);
      const k = s > 0.5 ? 1 : s < -0.5 ? -1 : 0;
      return P({
        by: 2,
        lid: 0.03,
        wrap: true,
        thorn: 1.2 + 0.2 * s,
        eye: 0.8 + 0.3 * s,
        maw: 0.3,
        flap: -1,
        lure: f / 4,
        vF: V([31, 43], [31, 34], [23, 28 - k * 0.5], [10, 30 - k * 0.5], -0.3, 3),
        vB: V([5, 43], [5, 34], [13, 28 - k * 0.5], [25, 30 - k * 0.5], 0.3, 3),
      });
    }),
  },
};

// ---------------------------------------------------------------- helpers

function layer(p: Canvas, fn: (q: Canvas) => void, sep: number | null = PAL.leaf0): void {
  const q = new PixelCanvas(p.w, p.h);
  fn(q);
  if (sep !== null) {
    for (let y = 0; y < q.h; y++)
      for (let x = 0; x < q.w; x++) {
        if (q.isOpaque(x, y) || !p.isOpaque(x, y)) continue;
        if (q.isOpaque(x - 1, y) || q.isOpaque(x + 1, y) || q.isOpaque(x, y - 1) || q.isOpaque(x, y + 1)) p.set(x, y, sep);
      }
  }
  p.blit(q, 0, 0);
}

/** Resample a polyline at ~1 px spacing. */
function resample(src: Pt[]): Pt[] {
  const L = [0];
  for (let i = 1; i < src.length; i++) L.push(L[i - 1] + Math.hypot(src[i][0] - src[i - 1][0], src[i][1] - src[i - 1][1]));
  const total = L[L.length - 1];
  const n = Math.max(2, Math.round(total));
  const out: Pt[] = [];
  let j = 1;
  for (let k = 0; k <= n; k++) {
    const d = (total * k) / n;
    while (j < src.length - 1 && L[j] < d) j++;
    const t = (d - L[j - 1]) / (L[j] - L[j - 1] || 1);
    out.push([src[j - 1][0] + (src[j][0] - src[j - 1][0]) * t, src[j - 1][1] + (src[j][1] - src[j - 1][1]) * t]);
  }
  return out;
}

/** Vine path: points every ~1 px plus the tangent angle at each. */
function vinePath(v: Vine, dx: number, dy: number): { pts: Pt[]; ang: number[] } {
  const o = (p: Pt): Pt => [p[0] + dx, p[1] + dy];
  const pts = resample(bezier(o(v.r), o(v.c1), o(v.c2), o(v.t), 48));
  const n = pts.length - 1;
  let a = Math.atan2(pts[n][1] - pts[n - 1][1], pts[n][0] - pts[n - 1][0]);
  let [x, y] = pts[n];
  for (let i = 0; i < v.cl; i++) {
    a += v.curl;
    x += Math.cos(a);
    y += Math.sin(a);
    pts.push([x, y]);
  }
  const ang = pts.map((_, i) => {
    const a0 = pts[Math.max(0, i - 1)];
    const a1 = pts[Math.min(pts.length - 1, i + 1)];
    return Math.atan2(a1[1] - a0[1], a1[0] - a0[0]);
  });
  return { pts, ang };
}

/**
 * Thorn spike: a tapered triangle from base `b` along `dir` — 2 px wide at the base, a 1 px tip;
 * mag2 body, mag3 point (the ink outline wraps it later).
 */
function thorn(q: Canvas, b: Pt, dir: number, len: number, hw = 1.05): void {
  if (len < 1) return;
  const ux = Math.cos(dir);
  const uy = Math.sin(dir);
  const x0 = Math.floor(Math.min(b[0], b[0] + ux * len) - 2);
  const x1 = Math.ceil(Math.max(b[0], b[0] + ux * len) + 2);
  const y0 = Math.floor(Math.min(b[1], b[1] + uy * len) - 2);
  const y1 = Math.ceil(Math.max(b[1], b[1] + uy * len) + 2);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - b[0];
      const py = y + 0.5 - b[1];
      const s = px * ux + py * uy;
      const t = -px * uy + py * ux;
      if (s < -0.2 || s > len) continue;
      if (Math.abs(t) > Math.max(0.55, hw * (1 - s / len))) continue;
      q.set(x, y, s > len * 0.55 ? PAL.mag3 : PAL.mag2);
    }
}

function drawVine(q: Canvas, v: Vine, dx: number, dy: number, thornK: number, w0 = 3.6, w1 = 1): Pt {
  const { pts, ang } = vinePath(v, dx, dy);
  const n = pts.length - 1;
  const width = (i: number) => w0 + (w1 - w0) * (i / n);
  // thorns first (behind the stem), alternating sides, slanted toward the tip
  for (let i = 4, k = 0; i < n - 2; i += 4, k++) {
    const side = k % 2 === 0 ? 1 : -1;
    const a = ang[i] + side * (Math.PI / 2 - 0.6);
    const f = i / n;
    const hw = width(i) / 2;
    const base: Pt = [pts[i][0] + Math.cos(a) * (hw - 0.6), pts[i][1] + Math.sin(a) * (hw - 0.6)];
    thorn(q, base, a, (3.2 - f * 1.4) * thornK);
  }
  q.stroke(pts, w0, w1, PAL.leaf1);
  // lit ridge: the side facing the top-left light
  const lit: Pt[] = pts.slice(0, Math.max(2, Math.round(n * 0.8))).map(([x, y], i) => {
    const a = ang[i];
    let nx = -Math.sin(a);
    let ny = Math.cos(a);
    if (nx + ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    return [x + nx * 0.7, y + ny * 0.7];
  });
  q.stroke(lit, Math.max(1, w0 - 1.6), 1, PAL.leaf2);
  q.stroke(lit.slice(0, Math.max(2, Math.round(lit.length * 0.55))), 1, 1, PAL.leaf3);
  return pts[n];
}

/** A leaf blade from `b` toward angle `a`, length `l`, half-width `w`. */
function leaf(q: Canvas, b: Pt, a: number, l: number, w: number, dark: boolean): void {
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const nx = -uy;
  const ny = ux;
  const pts: Pt[] = [];
  const K = 8;
  for (let i = 0; i <= K; i++) {
    const f = i / K;
    const ww = Math.sin(f * Math.PI) * w * (1 - f * 0.25);
    pts.push([b[0] + ux * l * f + nx * ww, b[1] + uy * l * f + ny * ww]);
  }
  for (let i = K; i >= 0; i--) {
    const f = i / K;
    const ww = Math.sin(f * Math.PI) * w * (1 - f * 0.25);
    pts.push([b[0] + ux * l * f - nx * ww, b[1] + uy * l * f - ny * ww]);
  }
  q.poly(pts, dark ? PAL.leaf1 : PAL.leaf2);
  // the half facing up gets the light
  const up = ny < 0 ? 1 : -1;
  const half: Pt[] = [];
  for (let i = 0; i <= K; i++) {
    const f = i / K;
    const ww = Math.sin(f * Math.PI) * w * (1 - f * 0.25) * up;
    half.push([b[0] + ux * l * f + nx * ww, b[1] + uy * l * f + ny * ww]);
  }
  for (let i = K; i >= 0; i--) half.push([b[0] + ux * l * (i / K), b[1] + uy * l * (i / K)]);
  q.poly(half, dark ? PAL.leaf2 : PAL.leaf3);
  // midrib
  q.line(b[0] + ux, b[1] + uy, b[0] + ux * l * 0.8, b[1] + uy * l * 0.8, dark ? PAL.leaf1 : PAL.leaf2);
}

// ---------------------------------------------------------------- the pod

/** Is lid-local (u, v) inside the lid dome? (v ≤ 0 is above the seam) */
const inDome = (u: number, v: number, grow = 0) => ((u - RX + 0.5) / (RX + grow)) ** 2 + (v / (RY + grow)) ** 2 <= 1;

/**
 * Fangs in lid-local cells (column u, row v; v = -1 is the lid's lip row, v = 0 the jaw's).
 * Upper fangs hang from the lid lip (base row -1, pointing down), lower fangs rise from the jaw
 * lip (base row 0, pointing up), interleaved. Each fang is a little triangle: a 3 px base (white,
 * white, mist on the shaded side) and a 1 px white point (2 px when the maw gapes).
 */
const UPPER = [10, 15, 20];
const LOWER = [7, 12, 17];
const UPPER_OPEN = [5, 10, 15, 20];
const LOWER_OPEN = [7, 12, 17];

function fangCell(cu: number, cv: number, upper: boolean, len: number, wide: boolean): number | null {
  const cols = upper ? (wide ? UPPER_OPEN : UPPER) : wide ? LOWER_OPEN : LOWER;
  const row = upper ? cv + 1 : -cv;
  if (row < 0 || row >= len) return null;
  for (const a of cols) {
    if (row === 0) {
      if (cu === a || cu === a + 1) return PAL.white;
      if (cu === a + 2) return PAL.mist;
    } else if (cu === a + 1) return PAL.white;
  }
  return null;
}

/** Eye spots in lid-local coords: [u, v, size]. */
const EYES: [number, number, number][] = [
  [17, -4, 2],
  [13.5, -5, 2],
  [20, -2.5, 1],
];
/** Lure pores (bioluminescent) on the lid top, lid-local. */
const PORES: Pt[] = [
  [7, -7],
  [10, -9],
];

function lidFrame(o: Pose) {
  const open = Math.max(0, -o.lid);
  // the hinge slides forward as the lid opens wide, so its back stays inside the frame
  const hx = HX + o.bx + Math.max(0, open - 0.25) * 6.5;
  const hy = HY + o.by;
  const c = Math.cos(o.lid);
  const s = Math.sin(o.lid);
  /** lid-local → frame */
  const L = (u: number, v: number): Pt => [hx + u * c - v * s, hy + u * s + v * c + o.jit * (u / RX) * 0.5];
  /** frame → lid-local */
  const IL = (x: number, y: number): Pt => {
    const dx = x - hx;
    const dy = y - hy - o.jit * (dx / RX) * 0.5;
    return [dx * c + dy * s, -dx * s + dy * c];
  };
  return { open, hx, hy, L, IL };
}

function drawPod(p: Canvas, o: Pose): void {
  const jx = HX + o.bx;
  const jy = HY + o.by;
  const { open, hx, L, IL } = lidFrame(o);
  const frontJ: Pt = [jx + 2 * RX - 1, jy];

  // ---- jaw (lower half of the bulb, sitting in the soil)
  layer(p, (q) => {
    for (let y = Math.floor(jy); y <= GROUND; y++)
      for (let x = Math.floor(jx - 1); x <= Math.ceil(jx + 2 * RX + 1); x++) {
        const u = x + 0.5 - jx;
        const v = y + 0.5 - jy;
        if (v < 0 || !inDome(u, v)) continue;
        // dark mouth line on the seam, red lip under it, belly darkening toward the bottom right
        let col: number = PAL.leaf2;
        if (v < 1 && u > 3) col = open > 0.25 ? PAL.crim2 : PAL.crim0;
        else if (v < 2 && u > 3) col = PAL.crim2;
        else if (u + v * 1.4 > 2 * RX + 2) col = PAL.leaf1;
        else if (u < 7 && v < 4) col = PAL.leaf3;
        q.set(x, y, col);
      }
    // veins
    for (const [u0, u1] of [
      [8, 6],
      [14, 13],
      [19, 21],
    ] as const)
      q.line(jx + u0, jy + 3, jx + u1, jy + 8, PAL.leaf1);
    // side thorns on the jaw
    thorn(q, [jx + 2 * RX - 1.5, jy + 4], 0.35, 3 * o.thorn);
    thorn(q, [jx + 1, jy + 4], Math.PI - 0.45, 2.6 * o.thorn);
  });

  // ---- maw (when the lid is open)
  if (open > 0.25) {
    layer(
      p,
      (q) => {
        const hinge: Pt = [hx + 1.5, jy];
        const frontL = L(2 * RX - 1, 0);
        q.poly([hinge, [jx + 1.5, jy], frontJ, frontL], PAL.crim1);
        // inner surfaces of lid and jaw, deep throat
        q.poly([hinge, [frontJ[0] - 1, frontJ[1] - 1.2], L(RX * 1.4, 1.2)], PAL.crim2);
        q.poly([hinge, L(RX * 1.3, 1.6), [hx + RX * 1.1, jy - 1.5]], PAL.crim0);
        // tongue
        const tl: Pt[] = [];
        for (let i = 0; i <= 8; i++) {
          const f = i / 8;
          tl.push([jx + 4 + f * (RX * 1.25), jy - 1.2 - Math.sin(f * Math.PI) * (1 + open * 3)]);
        }
        q.stroke(tl, 2.6, 1.6, PAL.mag2);
        q.stroke(tl.slice(2, 7).map(([x, y]) => [x, y - 0.6] as Pt), 1, 1, PAL.mag3);
      },
      null,
    );
  } else {
    // a sliver of dark gullet in the gap at the front of the nearly-shut mouth
    layer(
      p,
      (q) => {
        const frontL = L(2 * RX - 1, 0);
        q.poly([[jx + 3, jy + 0.5], frontJ, [frontL[0], frontL[1] - 0.5]], PAL.crim0);
      },
      null,
    );
  }

  // ---- lid
  layer(p, (q) => {
    const x0 = Math.floor(hx - RX - 4);
    const x1 = Math.ceil(hx + 2 * RX + 4);
    const y0 = Math.floor(jy - 2 * RX - 4);
    const y1 = Math.ceil(jy + RX);
    const [cxs, cys] = L(RX - 0.5, -RY * 0.25);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const [u, v] = IL(x + 0.5, y + 0.5);
        if (v > 0.2 || !inDome(u, v)) continue;
        let col: number = PAL.leaf2;
        // sphere shading in screen space: light from the top-left
        const nx = (x + 0.5 - cxs) / RX;
        const ny = (y + 0.5 - cys) / (RY * 0.95);
        const lit = -0.62 * nx - 0.78 * ny;
        if (lit > 0.42) col = PAL.leaf3;
        else if (lit < -0.42) col = PAL.leaf1;
        if (v > -1.6 && u > 3) col = PAL.crim2; // red lip
        else if (v > -2.8 && u > 2) col = PAL.leaf1; // shade above the lip
        q.set(x, y, col);
      }
    // big highlight patch + specular
    for (const [u, v, col] of [
      [6, -7, PAL.leaf3],
      [7, -7, PAL.leaf3],
      [5, -6, PAL.leaf3],
      [6, -6, PAL.leaf4],
      [8, -8, PAL.leaf3],
      [7, -8, PAL.leaf4],
      [9, -8, PAL.leaf3],
    ] as const) {
      const [x, y] = L(u, v);
      if (q.isOpaque(x, y)) q.set(x, y, col);
    }
    // spots (carnivorous pattern)
    for (const [u, v] of [
      [11, -7],
      [15, -7.5],
      [5, -3.5],
      [19, -5.5],
    ] as const) {
      const [x, y] = L(u, v);
      for (const [dx, dy] of [[0, 0], [1, 0]] as const) {
        const cc = q.get(x + dx, y + dy);
        if (cc === PAL.leaf2 || cc === PAL.leaf3) q.set(x + dx, y + dy, cc === PAL.leaf3 ? PAL.leaf2 : PAL.leaf1);
      }
    }
    // eye sockets + lure pores (the light pass lights them)
    for (const [u, v, r] of EYES) {
      const [x, y] = L(u, v);
      q.set(x, y, PAL.leaf0);
      if (r > 1) q.set(x + 1, y, PAL.leaf0);
    }
    for (const [u, v] of PORES) q.set(...L(u, v), PAL.leaf1);
    // crest thorns along the top of the lid
    for (const [a, l] of [
      [3.7, 2.6],
      [4.1, 3.4],
      [4.5, 4.2],
      [4.9, 4.2],
      [5.3, 3.6],
      [5.7, 3.2],
    ] as const) {
      const u = RX - 0.5 + Math.cos(a) * (RX - 1.2);
      const v = Math.sin(a) * (RY - 1.2);
      const nrm = Math.atan2(Math.sin(a) / RY, Math.cos(a) / RX) + o.lid;
      const len = l * o.thorn;
      thorn(q, L(u, v), nrm, len, 1.15);
    }
  });

  // ---- fangs: upper row rides on the lid, lower row on the jaw
  const wide = open > 0.3;
  const fl = wide ? 3 : 2;
  layer(
    p,
    (q) => {
      for (let y = Math.floor(jy - 26); y <= Math.ceil(jy + 4); y++)
        for (let x = Math.floor(jx); x <= Math.ceil(jx + 2 * RX + 2); x++) {
          // lower fangs (jaw space)
          const lc = fangCell(Math.floor(x + 0.5 - jx), Math.floor(y + 0.5 - jy), false, fl, wide);
          if (lc !== null) q.set(x, y, lc);
          // upper fangs (lid space)
          const [u, v] = IL(x + 0.5, y + 0.5);
          const uc = fangCell(Math.floor(u), Math.floor(v), true, fl, wide);
          if (uc !== null) q.set(x, y, uc);
        }
    },
    null,
  );
}

/**
 * Smear crescent: the area swept by the outer part of a vine moving from `old` to `cur`, found by
 * interpolating each point's angle and distance around the root (so the sweep is a true arc).
 * A bright leaf4 band trails right behind the vine, a leaf3 band behind that; thin near the root.
 */
function sweep(p: Canvas, old: Pt[], cur: Pt[]): void {
  const root = cur[0];
  for (let i = 0; i <= 48; i++) {
    const f = 0.42 + (0.58 * i) / 48;
    const a = old[Math.round(f * (old.length - 1))];
    const b = cur[Math.round(f * (cur.length - 1))];
    const ra = Math.hypot(a[0] - root[0], a[1] - root[1]);
    const rb = Math.hypot(b[0] - root[0], b[1] - root[1]);
    const aa = Math.atan2(a[1] - root[1], a[0] - root[0]);
    let d = Math.atan2(b[1] - root[1], b[0] - root[0]) - aa;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    // band widths grow toward the tip
    const g = (f - 0.42) / 0.58;
    const k4 = 1 - 0.3 * g;
    const k3 = 1 - 0.85 * g;
    for (let j = 0; j <= 40; j++) {
      const k = j / 40;
      if (k < k3) continue;
      const r = ra + (rb - ra) * k;
      const an = aa + d * k;
      const x = Math.floor(root[0] + Math.cos(an) * r);
      const y = Math.floor(root[1] + Math.sin(an) * r);
      if (p.isOpaque(x, y) && p.get(x, y) !== PAL.leaf3 && p.get(x, y) !== PAL.leaf4) continue;
      if (!p.inBounds(x, y)) continue;
      const col = k >= k4 ? PAL.leaf4 : PAL.leaf3;
      if (col === PAL.leaf3 && p.get(x, y) === PAL.leaf4) continue;
      p.set(x, y, col);
    }
  }
}

// ---------------------------------------------------------------- the rig

function drawLurker(p: Canvas, o: Pose): void {
  const bx = o.bx;
  const by = o.by;
  const lx = Math.trunc(bx / 2);

  // back vine
  if (!o.wrap) layer(p, (q) => drawVine(q, o.vB, bx, by, o.thorn, 3.2));
  // back leaves (rosette)
  layer(p, (q) => {
    // leaves are rooted: they follow the pod only half way
    leaf(q, [9 + lx, 41], Math.PI + 0.42 - o.flap * 0.12, 8, 3, true);
    leaf(q, [26 + lx, 41], -0.36 + o.flap * 0.12, 11, 3.2, true);
  });
  drawPod(p, o);
  // soil mound heaped against the bulb + roots + pebbles
  layer(
    p,
    (q) => {
      const cx = 17 + bx * 0.5;
      for (let x = 1; x <= 34; x++) {
        const d = Math.abs(x + 0.5 - cx) / 15.5;
        if (d > 1) continue;
        const lump = 0.8 * Math.sin(x * 1.3 + 2) + 0.6 * Math.sin(x * 0.55 - 2);
        const top = Math.round(GROUND + 1 - (1 - d * d) * 4.2 - lump * (1 - d));
        for (let y = top; y <= GROUND + 1; y++) {
          let col: number = PAL.earth2;
          if (y === top) col = x < cx + 4 ? PAL.earth3 : PAL.earth2;
          else if (y >= GROUND) col = PAL.earth1;
          q.set(x, y, col);
        }
      }
      // clods
      for (const [x, y] of [[8, GROUND - 2], [23, GROUND - 1], [14, GROUND - 1]] as const) q.set(x, y, PAL.earth1);
      q.set(11, GROUND - 3, PAL.earth4);
      // roots crawling out of the mound
      q.stroke([[4, GROUND], [2, GROUND], [1, GROUND + 1]], 2, 1, PAL.earth2);
      q.stroke([[32, GROUND], [35, GROUND - 1], [38, GROUND + 1]], 2, 1, PAL.earth2);
      q.set(35, GROUND - 2, PAL.earth3);
      // pebbles
      q.set(26, GROUND, PAL.stone3).set(27, GROUND, PAL.stone2);
      q.set(5, GROUND, PAL.stone3);
    },
    PAL.earth0,
  );
  // front leaves
  layer(p, (q) => {
    leaf(q, [13 + lx, GROUND - 1], Math.PI - 0.12 - o.flap * 0.08, 9, 2.6, false);
    leaf(q, [22 + lx, GROUND - 1], 0.05 + o.flap * 0.08, 9, 2.4, false);
  });
  // front vine (or both vines wrapped around the pod)
  let tip: Pt = [0, 0];
  if (o.wrap) {
    layer(p, (q) => drawVine(q, o.vB, bx, by, o.thorn, 3), PAL.ink);
    layer(p, (q) => drawVine(q, o.vF, bx, by, o.thorn, 3.2), PAL.ink);
  } else layer(p, (q) => (tip = drawVine(q, o.vF, bx, by, o.thorn, 4, 1.4)), PAL.ink);

  // flying bits that get outlined
  for (const b of o.bits) {
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    if (b.k === 'leaf') {
      const shapes = [
        ['.33', '322', '2.'],
        ['3.', '322', '.22'],
        ['.3', '32', '22', '2.'],
        ['33.', '.22'],
      ];
      p.stamp(shapes[b.v % 4], { '3': PAL.leaf3, '2': PAL.leaf2 }, x, y);
    } else if (b.k === 'thorn') {
      const shapes = [['mm3'], ['m', 'm', '3'], ['m..', '.m.', '..3']];
      p.stamp(shapes[b.v % 3], { m: PAL.mag2, '3': PAL.mag3 }, x, y);
    }
  }

  p.outline(PAL.ink);

  // ---------------- light pass
  const { L } = lidFrame(o);
  if (o.eye > 0.2) {
    for (const [u, v, r] of EYES) {
      const [x, y] = L(u, v);
      const hot = o.eye >= 1.5 ? PAL.white : o.eye >= 0.8 ? PAL.gold4 : PAL.gold2;
      const rim = o.eye >= 1.2 ? PAL.gold4 : o.eye >= 0.8 ? PAL.gold3 : PAL.gold1;
      p.set(x, y, r > 1 ? rim : hot);
      if (r > 1) p.set(x + 1, y, hot);
      if (o.eye >= 1.5 && r > 1) p.set(x + 1, y - 1, PAL.gold3);
    }
  }
  // lure pores: a slow bioluminescent pulse travelling from one pore to the next
  PORES.forEach(([u, v], i) => {
    const g = 0.5 + 0.5 * Math.sin((o.lure - i * 0.3) * TAU);
    const [x, y] = L(u, v);
    if (p.isOpaque(x, y)) p.set(x, y, g > 0.75 ? PAL.leaf4 : g > 0.3 ? PAL.leaf3 : PAL.leaf2);
  });
  // drip / spores (unoutlined)
  for (const b of o.bits) {
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    if (b.k === 'drip') {
      p.set(x, y, PAL.mag3);
      if (b.v === 1) p.set(x, y - 1, PAL.mag2);
    } else if (b.k === 'spore') {
      p.set(x, y, b.v ? PAL.leaf4 : PAL.gold4);
      if (b.v === 0) p.set(x + 1, y, PAL.leaf3);
    }
  }
  // whip smear: the crescent swept by the outer part of the whip since the previous pose
  for (const g of o.ghosts) sweep(p, vinePath(g, bx, by).pts, vinePath(o.vF, bx, by).pts);
  // whip crack at the tip
  if (o.crack > 0) {
    const [x, y] = o.crackAt ?? [Math.round(tip[0]), Math.round(tip[1])];
    const r = o.crack >= 1 ? 3 : 2;
    for (let i = 1; i <= r; i++) {
      const col = i === 1 ? PAL.white : i === 2 ? PAL.leaf4 : PAL.leaf3;
      p.set(x + i, y, col).set(x - i, y, col).set(x, y - i, col).set(x, y + i, col);
    }
    p.set(x, y, PAL.white);
    if (o.crack >= 1) p.set(x + 2, y - 2, PAL.leaf4).set(x - 2, y + 2, PAL.leaf4).set(x + 2, y + 2, PAL.leaf3).set(x - 2, y - 2, PAL.leaf3);
  }
}

// ---------------------------------------------------------------- portrait (44×34)

function portrait(p: Canvas): void {
  // dark loam with a warm earthy halo behind the pod; jungle leaves hang in from the corners
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 44; x++) {
      const d = Math.hypot((x - 22) * 0.8, y - 19);
      let col: number = PAL.earth0;
      if (d < 16) col = PAL.earth1;
      if (d < 16 && d >= 15 && (x + y) % 2 === 0) col = PAL.earth0;
      p.set(x, y, col);
    }
  const bg = new PixelCanvas(44, 34);
  leaf(bg, [-2, 2], 0.5, 14, 3, true);
  leaf(bg, [46, 0], Math.PI - 0.6, 15, 3.2, true);
  leaf(bg, [44, 9], Math.PI - 0.15, 9, 2.4, true);
  leaf(bg, [0, 12], 0.15, 8, 2.2, true);
  bg.map((c) => (c === PAL.leaf2 ? PAL.leaf1 : PAL.leaf0));
  p.blit(bg, 0, 0);
  const big = new PixelCanvas(W, H);
  drawLurker(big, ANIMS.roar.poses[4]);
  const ox = -4;
  const oy = 6;
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 44; x++) {
      const col = big.get(ox + x, oy + y);
      if (col !== null) p.set(x, y, col);
    }
}

// ---------------------------------------------------------------- export

/** The whip tip in the impact frame (end of the lash path). */
const IMPACT = 4;
const MUZZLE = (() => {
  const o = ANIMS.attack.poses[IMPACT];
  const { pts } = vinePath(o.vF, o.bx, o.by);
  const [x, y] = pts[pts.length - 1];
  return { x: Math.round(x), y: Math.round(y) };
})();

const art: MonsterArt = {
  id: 'thorn_lurker',
  w: W,
  h: H,
  anchorX: 17,
  anchorY: GROUND,
  hover: 0,
  muzzle: MUZZLE,
  core: { x: 17, y: 33 },
  anims: {
    idle: { frames: ANIMS.idle.poses.length, fps: ANIMS.idle.fps, loop: true },
    roar: { frames: ANIMS.roar.poses.length, fps: ANIMS.roar.fps, loop: false },
    attack: { frames: ANIMS.attack.poses.length, fps: ANIMS.attack.fps, loop: false },
    hit: { frames: ANIMS.hit.poses.length, fps: ANIMS.hit.fps, loop: false },
    guard: { frames: ANIMS.guard.poses.length, fps: ANIMS.guard.fps, loop: true },
  },
  attackImpactFrame: IMPACT,
  draw(p: Canvas, anim: MonsterAnim, frame: number) {
    const poses = ANIMS[anim].poses;
    drawLurker(p, poses[Math.max(0, Math.min(poses.length - 1, frame))]);
  },
  portrait,
};

export default art;
