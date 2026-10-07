// Şimşek Kertenkelesi (volt_lizard) — LIGHT thunder lizard, 64×64, side profile facing right.
//
// A big, agile monitor-drake standing tall on sprawled legs: gold scales shaded as a cylinder (lit
// back, gold flank, dark lower flank, pale gold-white belly stripe), a regular row of dark
// lightning-kinked scale bands, a raised S-neck carrying a wedge head (brow ridge over a glowing eye, separate lower
// jaw), a curled tail, and a row of gold-white crest spikes running from the crown down the spine to
// the tail tip. Electricity (the only cyan) is light: arcs jumping spike to spike, sparks, the rim of
// the charge between the jaws.
//
// Parametric rig: every frame is a Pose (numbers); draw() paints far legs → tail → crest → torso →
// neck/head → near legs back-to-front with separation lines between parts, outlines the solid body,
// then paints the electricity. The jaw is a real hinge: opening rotates the upper head up and the
// lower jaw down around the hinge, so the attack/roar gape is a clear V with teeth on both edges.
// Each crest spike has an energy level so a charge wave can travel tail tip → crown (attack
// anticipation). The tail is a chain whose curl and wave lag the body (secondary motion).

import { PAL } from '../palette';
import { PixelCanvas, bezier, type Pt } from '../pixel';
import type { MonsterAnim, MonsterArt } from '../types';

const W = 64;
const H = 64;
const TAU = Math.PI * 2;
/** Bottom row of the feet. */
const GROUND = 59;

type Canvas = PixelCanvas;

// ---------------------------------------------------------------- pose

interface Pose {
  /** Torso root = middle of the torso (frame px), pitch (rad, + = chest up), length stretch. */
  x: number;
  y: number;
  tilt: number;
  st: number;
  /** Neck direction (screen rad, −π/2 = straight up) and length; head pitch (rad, + = snout up). */
  na: number;
  nl: number;
  hp: number;
  /** Jaw 0 shut .. 1 wide V; eye 0 squeezed .. 1 open .. 2 blazing; tongue flick 0..1. */
  jaw: number;
  eye: number;
  tongue: number;
  /** Paw ground/air points: front near/far, hind near/far. */
  fn: Pt;
  ff: Pt;
  hn: Pt;
  hf: Pt;
  /** Front claws spread 0..1 (rear-up / lunge). */
  claw: number;
  /** Tail: base direction offset (rad, + = up), curl per segment (+ = curls up), wave phase/amp. */
  tb: number;
  tc: number;
  tw: number;
  ta: number;
  /** Tail wrap (guard): 0 behind, 1 coiled tight. */
  wrap: number;
  /** Crest energy 0 (dim) .. 1 (lit) .. 2 (blazing); charge wave front 0 (tail tip) .. 1 (crown), <0 = none. */
  en: number;
  wave: number;
  /** Crest shorted out (hit): 0..1 → dark. */
  dark: number;
  /** Arc count multiplier, spark spray 0..1 (hit / roar), mouth charge 0..1. */
  arcs: number;
  burst: number;
  charge: number;
  /** Speed lines streaming back from the head (lunge) 0..1. */
  dash: number;
  /** Flicker phase (frames advance it). */
  t: number;
}

const N: Pose = {
  x: 32,
  y: 43,
  tilt: 0.18,
  st: 1,
  na: -1.12,
  nl: 11,
  hp: 0.06,
  jaw: 0,
  eye: 1,
  tongue: 0,
  fn: [45, GROUND],
  ff: [39, GROUND],
  hn: [25, GROUND],
  hf: [17, GROUND],
  claw: 0,
  tb: 0.55,
  tc: 0.2,
  tw: 0,
  ta: 0.6,
  wrap: 0,
  en: 1.3,
  wave: -1,
  dark: 0,
  arcs: 1,
  burst: 0,
  charge: 0,
  dash: 0,
  t: 0,
};

const P = (o: Partial<Pose>): Pose => ({ ...N, ...o });

// ---------------------------------------------------------------- animations

function idlePose(f: number, n: number): Pose {
  const t = f / n;
  const breath = Math.sin(t * TAU);
  const up = breath > 0.35 ? 1 : 0;
  return P({
    y: N.y - up,
    na: N.na - up * 0.03,
    hp: N.hp + (f === 3 || f === 4 ? 0.06 : 0),
    // the tail tip flicks: a wave travels down the chain once per loop
    tw: t,
    ta: 0.6,
    tc: N.tc + 0.015 * Math.sin((t - 0.2) * TAU),
    // tongue flick on frames 3-4, blink on 6
    tongue: f === 3 ? 1 : f === 4 ? 0.55 : 0,
    eye: f === 6 ? 0.2 : 1,
    en: 1.3 + 0.12 * Math.sin(t * TAU * 2),
    t,
  });
}

const ANIMS: Record<MonsterAnim, { fps: number; loop: boolean; poses: Pose[] }> = {
  idle: { fps: 8, loop: true, poses: Array.from({ length: 8 }, (_, f) => idlePose(f, 8)) },

  // Roar: dip low (anticipation) → rear up on the hind legs, forelegs clawing the air, jaws open in a
  // wide V pointed at the sky, the crest blazes white with arcs leaping spike to spike and sparks
  // raining → drop back down.
  roar: {
    fps: 10,
    loop: false,
    poses: [
      idlePose(0, 8),
      P({ y: 47, tilt: 0.04, na: -0.8, nl: 9, hp: -0.15, eye: 1.4, fn: [46, GROUND], hn: [24, GROUND], tb: 0.45, tc: 0.24, en: 1.4, t: 0.1 }),
      P({ x: 31, y: 42, tilt: 0.42, na: -1.2, nl: 10, hp: 0.3, jaw: 0.45, eye: 2, fn: [45, 50], ff: [41, 52], hn: [26, GROUND], hf: [19, GROUND], claw: 0.6, tb: 0.42, tc: 0.25, tw: 0.2, en: 1.7, arcs: 1.5, t: 0.2 }),
      P({ x: 30, y: 41, tilt: 0.62, na: -1.38, nl: 10, hp: 0.6, jaw: 1, eye: 2, fn: [45, 43], ff: [42, 46], hn: [27, GROUND], hf: [20, GROUND], claw: 1, tb: 0.36, tc: 0.27, tw: 0.3, en: 2, arcs: 2.5, burst: 0.3, t: 0.3 }),
      P({ x: 30, y: 41, tilt: 0.64, na: -1.4, nl: 10, hp: 0.64, jaw: 1, eye: 2, fn: [46, 42], ff: [43, 45], hn: [27, GROUND], hf: [20, GROUND], claw: 1, tb: 0.36, tc: 0.28, tw: 0.4, en: 2, arcs: 3, burst: 0.6, t: 0.4 }),
      P({ x: 30, y: 41, tilt: 0.63, na: -1.39, nl: 10, hp: 0.62, jaw: 0.95, eye: 2, fn: [45, 43], ff: [42, 45], hn: [27, GROUND], hf: [20, GROUND], claw: 1, tb: 0.36, tc: 0.27, tw: 0.5, en: 2, arcs: 3, burst: 0.9, t: 0.5 }),
      P({ x: 30, y: 42, tilt: 0.56, na: -1.34, nl: 10, hp: 0.5, jaw: 0.8, eye: 2, fn: [46, 45], ff: [43, 47], hn: [27, GROUND], hf: [20, GROUND], claw: 0.8, tb: 0.38, tc: 0.26, tw: 0.6, en: 1.8, arcs: 2, burst: 1, t: 0.6 }),
      P({ x: 31, y: 43, tilt: 0.3, na: -1.22, hp: 0.2, jaw: 0.3, eye: 1.5, fn: [46, 54], ff: [42, 56], hn: [25, GROUND], hf: [18, GROUND], claw: 0.4, tb: 0.45, tc: 0.23, tw: 0.7, en: 1.5, arcs: 1.2, t: 0.7 }),
      P({ y: 46, tilt: 0.08, na: -0.95, nl: 10, hp: -0.05, jaw: 0.05, eye: 1.2, tb: 0.5, tc: 0.21, tw: 0.8, en: 1.4, t: 0.8 }),
      P({ tw: 0.9, t: 0.9 }),
    ],
  },

  // Attack ("Şimşek Kuyruğu"): crouch low, neck drawn back into an S, while a charge climbs the
  // crest from the tail tip to the crown and the eye brightens (anticipation) → IMPACT: the head
  // thrusts forward and up, forelegs braced, jaws snap open in a wide V with a white-hot core — the
  // lightning starts between the jaws → hold the discharge → recoil → settle.
  attack: {
    fps: 12,
    loop: false,
    poses: [
      idlePose(0, 8),
      P({ x: 31, y: 47, tilt: 0.05, na: -0.95, nl: 8, hp: -0.12, eye: 0.6, hn: [24, GROUND], tb: 0.45, tc: 0.24, en: 0.6, wave: 0.0, arcs: 0.5, t: 0.1 }),
      P({ x: 30, y: 48, tilt: 0.03, na: -0.9, nl: 7.5, hp: -0.16, eye: 1.0, fn: [44, GROUND], hn: [24, GROUND], tb: 0.45, tc: 0.26, tw: 0.15, en: 0.6, wave: 0.35, arcs: 0.8, t: 0.2 }),
      P({ x: 30, y: 48, tilt: 0.02, na: -0.88, nl: 7.2, hp: -0.18, jaw: 0.12, eye: 1.4, fn: [44, GROUND], hn: [24, GROUND], tb: 0.45, tc: 0.27, tw: 0.25, en: 0.6, wave: 0.7, arcs: 1, charge: 0.3, t: 0.3 }),
      P({ x: 29, y: 48, tilt: 0.0, na: -0.86, nl: 7, hp: -0.2, jaw: 0.2, eye: 2, fn: [44, GROUND], hn: [24, GROUND], tb: 0.45, tc: 0.28, tw: 0.35, en: 0.6, wave: 1, arcs: 1.4, charge: 0.6, t: 0.4 }),
      P({ x: 33, y: 46, tilt: 0.12, st: 1.04, na: -0.6, nl: 10.5, hp: 0.12, jaw: 1, eye: 2, fn: [51, GROUND], ff: [46, GROUND], hn: [26, GROUND], hf: [19, GROUND], claw: 0.6, tb: 0.5, tc: 0.2, tw: 0.45, en: 2, arcs: 2.5, charge: 1, dash: 1, t: 0.5 }),
      P({ x: 33, y: 46, tilt: 0.12, st: 1.04, na: -0.62, nl: 10.5, hp: 0.1, jaw: 0.95, eye: 2, fn: [51, GROUND], ff: [46, GROUND], hn: [26, GROUND], hf: [19, GROUND], claw: 0.6, tb: 0.52, tc: 0.2, tw: 0.55, en: 1.8, arcs: 2, charge: 0.8, dash: 0.45, t: 0.6 }),
      P({ x: 32, y: 45, tilt: 0.2, na: -1.02, nl: 10, hp: 0.25, jaw: 0.4, eye: 1.5, fn: [48, GROUND], ff: [42, GROUND], tb: 0.52, tc: 0.2, tw: 0.65, en: 1.5, arcs: 1, charge: 0.2, t: 0.7 }),
      P({ x: 32, y: 44, na: -1.1, hp: 0.08, jaw: 0.08, eye: 1.2, tw: 0.75, en: 1.35, t: 0.8 }),
      P({ tw: 0.85, t: 0.9 }),
    ],
  },

  // Hit: shoved back, head snapped back with the jaw clamped shut and the eye squeezed, the crest
  // shorts out (dark) → the crest flares white in a spray of sparks → it shakes itself back.
  hit: {
    fps: 10,
    loop: false,
    poses: [
      P({ x: 29, y: 44, tilt: 0.26, na: -1.6, nl: 8.5, hp: 0.3, jaw: 0, eye: 0, fn: [42, 56], ff: [37, GROUND], hn: [22, GROUND], hf: [15, GROUND], tb: 0.42, tc: 0.25, tw: 0.1, ta: 0.9, en: 0.2, dark: 1, arcs: 0, t: 0.15 }),
      P({ x: 30, y: 44, tilt: 0.2, na: -1.42, nl: 9.5, hp: 0.2, jaw: 0.25, eye: 0, fn: [43, GROUND], hn: [23, GROUND], hf: [16, GROUND], tb: 0.45, tc: 0.23, tw: 0.2, ta: 0.9, en: 2.2, arcs: 2.5, burst: 0.5, t: 0.3 }),
      P({ x: 31, y: 43, tilt: 0.18, na: -1.2, hp: 0.08, jaw: 0.05, eye: 0.6, tw: 0.3, en: 0.7, arcs: 0.5, burst: 0.85, t: 0.45 }),
      P({ tw: 0.4, en: 1.2, t: 0.6 }),
    ],
  },

  // Guard: belly pressed to the ground, legs folded flat, head low and level, tail coiled tight
  // around the hips, crest banked to a slow pulse.
  guard: {
    fps: 5,
    loop: true,
    poses: [0, 1, 2, 3].map((f) => {
      const t = f / 4;
      const s = Math.sin(t * TAU);
      return P({
        x: 32,
        y: 50 + (s > 0.5 ? -1 : 0),
        tilt: 0.02,
        st: 0.97,
        na: -0.55,
        nl: 6,
        hp: -0.06,
        eye: 1.3,
        fn: [48, GROUND],
        ff: [43, GROUND],
        hn: [25, GROUND],
        hf: [19, GROUND],
        wrap: 1,
        tw: t,
        ta: 0.3,
        en: 0.8 + 0.3 * s,
        arcs: 0.3,
        t,
      });
    }),
  },
};

// ---------------------------------------------------------------- helpers

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function hash(a: number, b = 0, c = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Draw into a fresh layer, then composite with a separation line where it overlaps. */
function layer(p: Canvas, fn: (q: Canvas) => void, sep: number | null = PAL.ink): Canvas {
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
  return q;
}

function ik(sx: number, sy: number, hx: number, hy: number, l1: number, l2: number, bend: 1 | -1): Pt {
  const dx = hx - sx;
  const dy = hy - sy;
  const d = Math.max(0.01, Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01));
  const a = Math.atan2(dy, dx);
  const ca = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const ang = a + bend * Math.acos(Math.max(-1, Math.min(1, ca)));
  return [sx + Math.cos(ang) * l1, sy + Math.sin(ang) * l1];
}

const rotAbout = (p: Pt, c: Pt, a: number): Pt => {
  const s = Math.sin(a);
  const k = Math.cos(a);
  const dx = p[0] - c[0];
  const dy = p[1] - c[1];
  return [c[0] + dx * k - dy * s, c[1] + dx * s + dy * k];
};

/**
 * Cylinder shading of every `base`-coloured column run: lit top band, base middle, a darker lower
 * flank, and (when `belly` > 0) a pale gold-white belly stripe along the bottom.
 */
function cylinder(q: Canvas, base: number, belly: boolean, far = false): void {
  const src = q.clone();
  for (let x = 0; x < q.w; x++) {
    let y = 0;
    while (y < q.h) {
      if (src.get(x, y) !== base) {
        y++;
        continue;
      }
      const top = y;
      while (y < q.h && src.get(x, y) === base) y++;
      const bot = y - 1;
      const L = bot - top + 1;
      for (let yy = top; yy <= bot; yy++) {
        const f = L <= 1 ? 0.5 : (yy - top) / (L - 1);
        let c: number;
        if (far) c = f < 0.3 && L >= 3 ? PAL.gold2 : f > 0.75 && L >= 3 ? PAL.gold0 : PAL.gold1;
        else if (L <= 2) c = yy === top ? PAL.gold3 : PAL.gold2;
        else if (f < 0.3) c = PAL.gold3;
        else if (!belly) c = f > 0.78 ? PAL.gold1 : PAL.gold2;
        else if (L >= 6 && f > 0.8) c = PAL.gold4;
        else if (f > 0.58) c = PAL.gold1;
        else c = PAL.gold2;
        q.set(x, yy, c);
      }
    }
  }
}

/** Zig-zag lightning between two points (1px), seeded; bright core at the kinks. */
function bolt(p: Canvas, a: Pt, b: Pt, seed: number, jag: number, col: number, core: number, onlyEmpty = true): void {
  const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3));
  const pts: Pt[] = [a];
  const nx = -(b[1] - a[1]);
  const ny = b[0] - a[0];
  const nl = Math.hypot(nx, ny) || 1;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const off = (hash(seed, i, 3) - 0.5) * 2 * jag;
    pts.push([lerp(a[0], b[0], t) + (nx / nl) * off, lerp(a[1], b[1], t) + (ny / nl) * off]);
  }
  pts.push(b);
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const m = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let j = 0; j <= m; j++) {
      const x = Math.round(lerp(x0, x1, j / m));
      const y = Math.round(lerp(y0, y1, j / m));
      if (x < 1 || y < 1 || x > W - 2 || y > H - 2) continue;
      if (onlyEmpty && p.isOpaque(x, y)) continue;
      p.set(x, y, j === 0 && i > 0 ? core : col);
    }
  }
}

// ---------------------------------------------------------------- rig

/** Torso silhouette (body-local px: u forward, v down): deep chest, arched back, sagging belly. */
const TORSO: Pt[] = [
  ...bezier([14, -0.5], [14.5, -3.6], [13.2, -5.8], [10.5, -6.4], 6),
  ...bezier([10.5, -6.4], [5, -7.2], [-4, -7.0], [-10, -6.2], 8).slice(1),
  ...bezier([-10, -6.2], [-14, -5.4], [-16.5, -3], [-16.6, 0], 6).slice(1),
  ...bezier([-16.6, 0], [-16.2, 3], [-13, 5], [-9, 5.8], 6).slice(1),
  ...bezier([-9, 5.8], [-3, 7.0], [4, 7.0], [9, 5.6], 8).slice(1),
  ...bezier([9, 5.6], [12.5, 4.2], [14, 2.4], [14, -0.5], 6).slice(1),
];

/** Torso length (u) and thickness (v) scales. */
const TU = 0.94;
const TV = 1.26;
/** Top of the spine (body-local v at u), matching the TORSO top edge. */
function spineV(u: number): number {
  let v: number;
  if (u > 10.5) v = -6.4 + (u - 10.5) * 0.9;
  else if (u > -10) v = -6.9 + (u < -4 ? (u + 4) * -0.12 : 0) + (u > 5 ? (u - 5) * 0.09 : 0);
  else v = -6.2 + (u + 10) * -0.45;
  return v * TV;
}
const SPINE_U = [9.5, 5, 0.5, -4, -8.5, -12.6];

/** Upper head (skull + snout) in head-local px (u along the snout, v down); hinge at (−2, 1.3). */
const SKULL: Pt[] = [
  [-4.4, -2.0],
  [-3.0, -4.0],
  [-0.4, -4.6],
  [1.2, -5.7],
  [3.6, -5.6],
  [4.8, -4.4],
  [7.4, -3.4],
  [10.2, -2.2],
  [11.4, -1.0],
  [11.6, 0.4],
  [10.8, 1.2],
  [5.0, 1.5],
  [-1.8, 1.7],
  [-4.4, 1.2],
];
/** Lower jaw (closed), head-local. */
const JAW: Pt[] = [
  [-3.8, 1.2],
  [3.0, 1.4],
  [10.4, 1.3],
  [10.8, 2.2],
  [7.6, 3.3],
  [2.6, 4.1],
  [-1.6, 4.5],
  [-3.9, 3.6],
];
const HINGE: Pt = [-2.2, 1.3];

interface Rig {
  B: (u: number, v: number) => Pt;
  /** Upper head local → frame px (includes the upper-jaw lift). */
  Hd: (u: number, v: number) => Pt;
  /** Lower jaw local → frame px. */
  J: (u: number, v: number) => Pt;
  head: Pt;
  neck0: Pt;
  tail: Pt[];
  tailW: number[];
  /** Crest spikes: base point, direction (screen rad), length, width, position 0 (tail tip) .. 1 (crown). */
  spikes: { b: Pt; a: number; l: number; w: number; pos: number }[];
}

/** Leg bone lengths: front upper/lower, hind thigh/shin. */
const LF1 = 7;
const LF2 = 8.5;
const LH1 = 8.5;
const LH2 = 8.5;
/** Jaw opening: upper head lifts by UPJ·jaw, lower jaw drops by DNJ·jaw (rad). */
const UPJ = 0.36;
/** Head scale. */
const HS = 1.05;
const DNJ = 0.5;

function rigOf(o: Pose): Rig {
  const st = o.st;
  const ca = Math.cos(-o.tilt);
  const sa = Math.sin(-o.tilt);
  const B = (x: number, y: number): Pt => [o.x + x * TU * st * ca - y * sa, o.y + x * TU * st * sa + y * ca];
  const neck0 = B(10.5, -2.5);
  const head: Pt = [neck0[0] + Math.cos(o.na) * o.nl, neck0[1] + Math.sin(o.na) * o.nl];
  // head-local → frame with the head pitch (+ = snout up)
  const H0 = (u: number, v: number, extra: number): Pt => {
    // rotate about the hinge by `extra` first (jaw), then by the head pitch about the origin
    const r = rotAbout([u, v], HINGE, -extra);
    const c = Math.cos(-o.hp);
    const s = Math.sin(-o.hp);
    return [head[0] + (r[0] * c - r[1] * s) * HS, head[1] + (r[0] * s + r[1] * c) * HS];
  };
  const Hd = (u: number, v: number): Pt => H0(u, v, UPJ * o.jaw);
  const J = (u: number, v: number): Pt => H0(u, v, -DNJ * o.jaw);

  // tail chain: back from the hips, curling up; a wave travels toward the tip. If the curl would
  // carry the tail out of the frame on the left, it curls a little tighter instead.
  const nT = 11;
  const tailW: number[] = [];
  for (let i = 0; i <= nT; i++) tailW.push(lerp(12, 2.4, Math.pow(i / nT, 0.9)));
  const chain = (extra: number): Pt[] => {
    const pts: Pt[] = [B(-14.5, -0.6)];
    let [x, y] = pts[0];
    let a = Math.PI - o.tilt + o.tb;
    for (let i = 1; i <= nT; i++) {
      const f = i / nT;
      const wave = Math.sin((o.tw - f * 0.7) * TAU) * 0.2 * o.ta * f;
      let curl = o.tc * (0.25 + f * 1.3) + extra * f;
      if (o.wrap > 0) curl = lerp(curl, 0.12 + 0.7 * f * f, o.wrap);
      a += curl + wave * 0.6;
      const seg = 2.5;
      x += Math.cos(a) * seg;
      y += Math.sin(a) * seg;
      if (y > GROUND - 1) y = GROUND - 1;
      pts.push([x, y]);
    }
    return pts;
  };
  // tail crest: the tip ends in a gold-white blade (where the charge wave starts) + two spikes
  const tailSpikes = (pts: Pt[]): Rig['spikes'] => {
    const out: Rig['spikes'] = [];
    const [x0, y0] = pts[nT - 1];
    const [x1, y1] = pts[nT];
    out.push({ b: [x0, y0], a: Math.atan2(y1 - y0, x1 - x0), l: 5.6, w: 3.4, pos: 0 });
    for (let i = nT - 4; i >= 3; i -= 3) {
      const [ax, ay] = pts[i - 1];
      const [bx, by] = pts[i + 1] ?? pts[i];
      const ta = Math.atan2(by - ay, bx - ax);
      const na = ta + Math.PI / 2;
      const up = Math.sin(na) < 0 ? na : na + Math.PI;
      const w = tailW[i];
      const [cx, cy] = pts[i];
      const f = 1 - i / nT;
      out.push({ b: [cx + Math.cos(up) * (w / 2 - 0.8), cy + Math.sin(up) * (w / 2 - 0.8)], a: up + 0.5, l: 3.2 + f * 3, w: 3.6 + f * 1.6, pos: f * 0.4 });
    }
    return out;
  };
  const outside = (pts: Pt[]) =>
    pts.some(([x], i) => x - tailW[i] / 2 < 2.5) || tailSpikes(pts).some((sp) => sp.b[0] + Math.cos(sp.a) * sp.l - sp.w / 2 < 2.5);
  let tail = chain(0);
  for (let k = 1; k <= 30 && outside(tail); k++) tail = chain(k * 0.03);

  // crest spikes: tail (tip → base), spine (hips → shoulders), neck, crown
  const spikes: Rig['spikes'] = tailSpikes(tail);
  const nS = SPINE_U.length;
  for (let k = nS - 1; k >= 0; k--) {
    const u = SPINE_U[k];
    const b = B(u * st, spineV(u) + 0.9);
    const a = -Math.PI / 2 - o.tilt - 0.42;
    const tall = 6.6 + 2.6 * Math.sin(((k + 1.4) / (nS + 1)) * Math.PI);
    spikes.push({ b, a, l: tall, w: 6, pos: 0.4 + (1 - k / (nS - 1)) * 0.38 });
  }
  // neck: two spikes along the back of the neck
  for (const f of [0.35, 0.75]) {
    const c: Pt = [lerp(neck0[0], head[0], f), lerp(neck0[1], head[1], f)];
    const back = o.na - Math.PI / 2;
    const b: Pt = [c[0] + Math.cos(back) * 3, c[1] + Math.sin(back) * 3];
    spikes.push({ b, a: back - 0.5, l: 4.6, w: 3.8, pos: 0.8 + f * 0.1 });
  }
  // crown: swept spikes off the back of the skull (a little frill)
  const hpU = -o.hp - UPJ * o.jaw;
  spikes.push({ b: Hd(-3.4, -2.6), a: Math.PI + 0.95 + hpU, l: 5.4, w: 3.4, pos: 0.94 });
  spikes.push({ b: Hd(-1.2, -4.0), a: Math.PI + 1.3 + hpU, l: 4.6, w: 3, pos: 1 });
  return { B, Hd, J, head, neck0, tail, tailW, spikes };
}

/** Energy of a spike given the pose: base level, plus a travelling charge wave and crackle. */
function spikeEnergy(o: Pose, pos: number, i: number): number {
  let e = o.en;
  if (o.wave >= 0) {
    const d = o.wave - pos;
    if (d > 0.12) e = 1.4;
    else if (d > -0.06) e = 2.2;
    else e = Math.min(e, 0.6);
  }
  const fl = hash(i, Math.round(o.t * 97), 5);
  if (fl > 0.85) e += 0.5;
  else if (fl < 0.08) e -= 0.4;
  return e;
}

/** Crest spike colours [shadow face, fill, lit edge, tip] by energy (gold-white; dark when shorted). */
function crestCols(e: number, dark: number): [number, number, number, number] {
  if (dark > 0.5) return [PAL.night1, PAL.night2, PAL.night3, PAL.night4];
  if (e < 0.45) return [PAL.gold0, PAL.gold1, PAL.gold2, PAL.gold2];
  if (e < 1.0) return [PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4];
  if (e < 1.75) return [PAL.gold2, PAL.gold4, PAL.white, PAL.white];
  return [PAL.gold3, PAL.white, PAL.white, PAL.white];
}

// ---------------------------------------------------------------- drawing

function drawLizard(p: Canvas, o: Pose): void {
  const r = rigOf(o);
  const { B, Hd, J } = r;
  const st = o.st;

  // ------------------------------------------------ legs (IK), sprawled
  const shN = B(8.5 * st, 3.4);
  const shF = B(6.0 * st, 2.4);
  const hipN = B(-10 * st, 3.0);
  const hipF = B(-12.4 * st, 2.2);
  const leg = (q: Canvas, sh: Pt, paw: Pt, l1: number, l2: number, bend: 1 | -1, near: boolean, front: boolean) => {
    const air = paw[1] < GROUND - 1;
    const ankle: Pt = [paw[0] - (front ? 0 : 1.5), paw[1] - 2.2];
    let el = ik(sh[0], sh[1], ankle[0], ankle[1], l1, l2, bend);
    // a folded leg never pushes its joint into the floor: flip it up instead
    if (el[1] > GROUND - 3) el = ik(sh[0], sh[1], ankle[0], ankle[1], l1, l2, bend === 1 ? -1 : 1);
    const base = near ? PAL.gold2 : PAL.gold1;
    q.stroke([sh, el], front ? 7 : 8, 5.4, base);
    q.stroke([el, ankle], 5.2, 3.8, base);
    // elbow / knee knob (sticks out sideways)
    q.disc(el[0], el[1], 2.5, base);
    // splayed foot: three toes with claws
    const spread = front ? lerp(0.5, 0.95, o.claw) : 0.55;
    const fa = air ? (front ? -0.35 - o.claw * 0.4 : 0.6) : 0;
    const dirs = front ? [fa - spread * 0.4, fa + spread * 0.25, fa + Math.PI - 0.3] : [fa - spread * 0.3, fa + spread * 0.3, fa + Math.PI - 0.25];
    const lens = front ? [4.2, 3.4, 2.6] : [4.8, 3.8, 3];
    q.disc(ankle[0], ankle[1] + 0.8, 1.6, base);
    dirs.forEach((a, k) => {
      const L = lens[k];
      const tx = ankle[0] + Math.cos(a) * L;
      const ty = air ? ankle[1] + 1 + Math.sin(a) * L : Math.min(GROUND, ankle[1] + 1.6 + Math.sin(a) * L * 0.5 + (k === 1 ? 0.6 : 0));
      q.line(ankle[0], ankle[1] + 1, tx, ty, base);
      const cx = Math.round(tx + Math.cos(a) * 0.9);
      const cy = Math.round(ty + Math.sin(a) * 0.9);
      q.set(cx, Math.min(GROUND, cy), near ? PAL.white : PAL.stone3);
    });
    if (near) {
      // light from the top-left: lit top edges, dark undersides
      const src = q.clone();
      for (let y = 0; y < q.h; y++)
        for (let x = 0; x < q.w; x++) {
          const c = src.get(x, y);
          if (c !== base) continue;
          if (!src.isOpaque(x, y - 1) || !src.isOpaque(x - 1, y)) q.set(x, y, PAL.gold3);
          else if (!src.isOpaque(x, y + 1) || !src.isOpaque(x + 1, y)) q.set(x, y, PAL.gold1);
        }
      q.set(el[0] - 1, el[1] - 1, PAL.gold4);
    } else {
      const src = q.clone();
      for (let y = 0; y < q.h; y++)
        for (let x = 0; x < q.w; x++) {
          if (src.get(x, y) !== base) continue;
          if (!src.isOpaque(x, y - 1)) q.set(x, y, PAL.gold2);
          else if (!src.isOpaque(x, y + 1) || !src.isOpaque(x + 1, y)) q.set(x, y, PAL.gold0);
        }
    }
  };
  layer(p, (q) => leg(q, hipF, o.hf, LH1, LH2, -1, false, false));
  layer(p, (q) => leg(q, shF, o.ff, LF1, LF2, 1, false, true));

  // ------------------------------------------------ tail (behind the body)
  layer(p, (q) => {
    q.stroke(r.tail, r.tailW[0], 2, PAL.gold2);
    cylinder(q, PAL.gold2, true);
    // regular dark scale bands across the tail
    for (let i = 2; i < r.tail.length - 1; i += 2) {
      const [x, y] = r.tail[i];
      const [x2, y2] = r.tail[i + 1];
      const a = Math.atan2(y2 - y, x2 - x) + Math.PI / 2;
      const w = r.tailW[i] / 2;
      for (let k = -w; k <= w; k += 0.5) {
        const px = x + Math.cos(a) * k;
        const py = y + Math.sin(a) * k;
        const c = q.get(px, py);
        if (c === PAL.gold2 || c === PAL.gold3) q.set(px, py, PAL.gold1);
      }
    }
  });

  // ------------------------------------------------ crest spikes (behind the torso / neck edge)
  const tips: { tip: Pt; e: number }[] = [];
  const spikeLayer = (q: Canvas, list: Rig['spikes'], offset: number) => {
    list.forEach((s, j) => {
      const i = j + offset;
      const e = spikeEnergy(o, s.pos, i);
      const [c0, c1, c2, c3] = crestCols(e, o.dark);
      const tip: Pt = [s.b[0] + Math.cos(s.a) * s.l, s.b[1] + Math.sin(s.a) * s.l];
      const nx = -Math.sin(s.a) * (s.w / 2);
      const ny = Math.cos(s.a) * (s.w / 2);
      // the lit (front/top) face and the shadow (back) face
      const front: Pt = nx > 0 ? [s.b[0] + nx, s.b[1] + ny] : [s.b[0] - nx, s.b[1] - ny];
      const back: Pt = nx > 0 ? [s.b[0] - nx, s.b[1] - ny] : [s.b[0] + nx, s.b[1] + ny];
      q.tri(front[0], front[1], back[0], back[1], tip[0], tip[1], c1);
      q.line(front[0], front[1], tip[0], tip[1], c2);
      q.line(lerp(back[0], tip[0], 0.15), lerp(back[1], tip[1], 0.15), lerp(back[0], tip[0], 0.6), lerp(back[1], tip[1], 0.6), c0);
      q.set(tip[0], tip[1], c3);
      tips.push({ tip, e: o.dark > 0.5 ? 0 : e });
    });
  };
  const bodySpikes = r.spikes.slice(0, r.spikes.length - 4);
  const headSpikes = r.spikes.slice(r.spikes.length - 4);
  layer(p, (q) => spikeLayer(q, bodySpikes, 0));

  // ------------------------------------------------ torso
  layer(p, (q) => {
    q.poly(
      TORSO.map(([u, v]) => B(u, v * TV)),
      PAL.gold2,
    );
    cylinder(q, PAL.gold2, true);
    // a regular row of lightning-kinked scale bands down the upper flank
    for (let u = 7.5; u >= -14; u -= 5.2) {
      const t0 = spineV(u) + 0.6;
      const zz: Pt[] = [
        [u + 0.6, t0],
        [u - 1.2, t0 + 2.6],
        [u + 0.4, t0 + 3.6],
        [u - 1.0, t0 + 6.4],
      ];
      for (let i = 0; i + 1 < zz.length; i++) {
        const a = B(zz[i][0] * st, zz[i][1]);
        const b = B(zz[i + 1][0] * st, zz[i + 1][1]);
        const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 1.5);
        for (let j = 0; j <= n; j++) {
          const x = lerp(a[0], b[0], j / n);
          const y = lerp(a[1], b[1], j / n);
          const c = q.get(x, y);
          if (c === PAL.gold3 || c === PAL.gold2) q.set(x, y, PAL.gold1);
          // the scale ridge just ahead of the band catches the light
          const c2 = q.get(x + 1, y);
          if (c2 === PAL.gold3) q.set(x + 1, y, PAL.gold4);
        }
      }
    }
    // a lit highlight row along the shoulder and haunch
    for (const [u, v] of [
      [9, -4.6],
      [10, -4.4],
      [11, -4.0],
      [-11, -3.8],
      [-12, -3.4],
    ] as const) {
      const [x, y] = B(u * st, v);
      if (q.get(x, y) === PAL.gold3) q.set(x, y, PAL.gold4);
    }
    // ventral scutes: a dotted line in the belly stripe
    for (let u = -12; u <= 11; u += 2) {
      const [x, y] = B(u * st, (5.6 + (Math.abs(u) < 6 ? 0.9 : 0)) * TV);
      if (q.get(x, y) === PAL.gold4) q.set(x, y, PAL.gold3);
    }
  });

  // ------------------------------------------------ neck spikes + crown (behind the neck/head)
  layer(p, (q) => spikeLayer(q, headSpikes, bodySpikes.length));

  // ------------------------------------------------ neck + head
  layer(p, (q) => {
    const n0 = r.neck0;
    const n1 = Hd(-2.6, 0.2);
    // S-neck: leaves the chest forward, then rises into the back of the skull
    const path = bezier(B(9 * st, -1.2 * TV), B(14.5 * st, -3.5 * TV), [n1[0] - 1.5, n1[1] + 4.5], n1, 12);
    q.stroke(path, 10, 7, PAL.gold2);
    cylinder(q, PAL.gold2, false);
    // throat: the belly stripe continues up the front of the neck
    const ang = Math.atan2(n1[1] - n0[1], n1[0] - n0[0]);
    const fx = Math.cos(ang + Math.PI / 2);
    const fy = Math.sin(ang + Math.PI / 2);
    for (let i = 0; i <= 14; i++) {
      const f = i / 14;
      const c: Pt = [lerp(n0[0], n1[0], f), lerp(n0[1], n1[1], f)];
      const w = lerp(4.2, 2.6, f);
      for (const d of [w - 0.4, w - 1.3]) {
        const x = c[0] - fx * d;
        const y = c[1] - fy * d;
        // the front of a rising neck is its right/lower side
        const sx = c[0] + fx * d;
        const sy = c[1] + fy * d;
        const px = fx < 0 ? x : sx;
        const py = fx < 0 ? y : sy;
        const col = q.get(px, py);
        if (col !== null && col !== PAL.gold3) q.set(px, py, d > w - 1 ? PAL.gold4 : PAL.gold1);
      }
    }
  });
  layer(p, (q) => {
    // mouth interior when open (behind the teeth): dark throat, or the charge
    if (o.jaw > 0.15) {
      const m = [Hd(-1.2, 1.4), Hd(10.0, 1.2), J(9.6, 1.4), J(-1.2, 1.4)];
      q.poly(m, PAL.crim1);
      const src = q.clone();
      for (let y = 0; y < q.h; y++) for (let x = 0; x < q.w; x++) if (src.get(x, y) === PAL.crim1 && !src.isOpaque(x + 1, y) && src.isOpaque(x - 1, y)) q.set(x, y, PAL.crim2);
    }
  }, PAL.gold0);
  layer(p, (q) => {
    // lower jaw (separate part, hinged): pale underside, dark gum line
    const jaw = JAW.map(([u, v]) => J(u, v));
    q.poly(jaw, PAL.gold2);
    // jowl bulge under the hinge
    q.disc(...J(-1.6, 2.8), 2.1, PAL.gold2);
    const src = q.clone();
    for (let y = 0; y < q.h; y++)
      for (let x = 0; x < q.w; x++) {
        if (src.get(x, y) !== PAL.gold2) continue;
        if (!src.isOpaque(x, y + 1)) q.set(x, y, PAL.gold4);
        else if (!src.isOpaque(x, y - 1)) q.set(x, y, PAL.gold1);
      }
    // lower fangs pointing up into the mouth
    if (o.jaw > 0.15)
      for (const u of [8.4, 5.6]) {
        q.set(...J(u, 1.0), PAL.white);
        q.set(...J(u, 0.2), PAL.white);
      }
  });
  layer(p, (q) => {
    // skull + wedge snout
    q.poly(
      SKULL.map(([u, v]) => Hd(u, v)),
      PAL.gold2,
    );
    // shading: crown & snout ridge lit, cheek gold2, the upper lip line dark
    const src = q.clone();
    for (let y = 0; y < q.h; y++)
      for (let x = 0; x < q.w; x++) {
        if (src.get(x, y) !== PAL.gold2) continue;
        if (!src.isOpaque(x, y - 1)) q.set(x, y, PAL.gold4);
        else if (!src.isOpaque(x, y - 2)) q.set(x, y, PAL.gold3);
        else if (!src.isOpaque(x, y + 1)) q.set(x, y, PAL.gold1);
      }
    // brow ridge: a dark shadow line under the raised brow, angled down toward the snout
    for (const [u, v] of [
      [0.6, -3.9],
      [1.6, -4.1],
      [2.6, -4.1],
      [3.6, -4.0],
      [4.5, -3.6],
    ] as const)
      q.set(...Hd(u, v), PAL.gold1);
    // scale row along the cheek and the nostril
    q.set(...Hd(-2.4, -0.6), PAL.gold1);
    q.set(...Hd(-0.6, 0.0), PAL.gold3);
    q.set(...Hd(8.6, -1.2), PAL.gold0);
    // mouth line when shut (curls up at the corner)
    if (o.jaw <= 0.15) {
      for (let u = -1.6; u <= 9.6; u += 0.7) q.set(...Hd(u, u < 0 ? 0.6 : 1.0), PAL.gold0);
    }
    // upper fangs hanging into the open mouth
    if (o.jaw > 0.15)
      for (const u of [9.4, 6.9, 4.4]) {
        q.set(...Hd(u, 1.4), PAL.white);
        q.set(...Hd(u + 0.2, 2.2), PAL.white);
      }
    // eye socket (painted as light later)
    q.set(...Hd(2.2, -2.8), PAL.ink);
    q.set(...Hd(3.2, -2.8), PAL.ink);
  });
  // forked tongue flick (when the jaw is barely open)
  if (o.tongue > 0) {
    const L = 4 * o.tongue;
    const t0 = Hd(10.6, 1.0);
    const t1: Pt = [t0[0] + L, t0[1] + 0.4];
    p.line(t0[0], t0[1], t1[0], t1[1], PAL.crim3);
    if (o.tongue > 0.7) {
      p.set(t1[0] + 1, t1[1] - 1, PAL.crim3);
      p.set(t1[0] + 1, t1[1] + 1, PAL.crim3);
    }
  }

  // ------------------------------------------------ near legs
  layer(p, (q) => leg(q, hipN, o.hn, LH1, LH2, -1, true, false), PAL.gold0);
  layer(p, (q) => leg(q, shN, o.fn, LF1, LF2, 1, true, true), PAL.gold0);

  // ------------------------------------------------ outline
  p.outline(PAL.ink);

  // ------------------------------------------------ electricity (light)
  electric(p, o, r, tips);
}

/** Point between the open jaws, just ahead of the gape (where the lightning leaves). */
function gape(r: Rig): Pt {
  const a = r.Hd(9.6, 1.0);
  const b = r.J(9.2, 1.6);
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/** Light stays one pixel inside the frame (no edge clipping). */
const inside = (x: number, y: number) => x >= 1 && y >= 1 && x < W - 1 && y < H - 1;

function electric(p: Canvas, o: Pose, r: Rig, tips: { tip: Pt; e: number }[]): void {
  const fr = Math.round(o.t * 97);
  // arcs jumping between neighbouring spike tips (the only cyan on the body)
  const nArcs = Math.round(2 * o.arcs);
  for (let k = 0; k < nArcs; k++) {
    const i = Math.floor(hash(fr, k, 11) * (tips.length - 1));
    const a = tips[i];
    const b = tips[i + 1];
    if (!a || !b) continue;
    const d = Math.hypot(b.tip[0] - a.tip[0], b.tip[1] - a.tip[1]);
    if (d > 10 || d < 2) continue;
    const lift: Pt = [(a.tip[0] + b.tip[0]) / 2, Math.min(a.tip[1], b.tip[1]) - 1.5 - hash(fr, k, 2) * 2];
    const hot = (a.e + b.e) / 2 > 1.7;
    bolt(p, a.tip, lift, fr * 7 + k, 0.8, hot ? PAL.white : PAL.cyan4, PAL.white);
    bolt(p, lift, b.tip, fr * 7 + k + 1, 0.8, hot ? PAL.white : PAL.cyan4, PAL.white);
  }
  // sparks hopping off hot tips
  tips.forEach((s, i) => {
    if (s.e < 1.3) return;
    if (hash(fr, i, 19) > 0.3 + o.arcs * 0.1) return;
    const a = hash(fr, i, 23) * TAU;
    const d = 1.5 + hash(fr, i, 29) * 2.5;
    const x = s.tip[0] + Math.cos(a) * d;
    const y = s.tip[1] + Math.sin(a) * d - 1;
    if (inside(x, y) && !p.isOpaque(x, y)) p.set(x, y, s.e > 1.8 ? PAL.white : PAL.cyan4);
  });
  // short-circuit spray (hit / roar): bright dashes flying out of the crest
  if (o.burst > 0 && o.burst < 1) {
    for (let k = 0; k < 11; k++) {
      const s = tips[Math.floor(hash(k, 3, 1) * tips.length)];
      if (!s) continue;
      const a = -Math.PI / 2 + (hash(k, 4, 1) - 0.5) * 2.6;
      const d0 = 2 + o.burst * (6 + hash(k, 5, 1) * 10);
      const x = s.tip[0] + Math.cos(a) * d0;
      const y = s.tip[1] + Math.sin(a) * d0 + o.burst * o.burst * 6;
      const c = o.burst < 0.55 ? PAL.white : o.burst < 0.8 ? PAL.cyan4 : PAL.cyan3;
      if (inside(x, y) && !p.isOpaque(x, y)) p.set(x, y, c);
      const x2 = x - Math.cos(a);
      const y2 = y - Math.sin(a);
      if (o.burst < 0.7 && inside(x2, y2) && !p.isOpaque(x2, y2)) p.set(x2, y2, PAL.gold4);
    }
  }
  // lunge speed lines: bright dashes streaming back over the crest and under the belly
  if (o.dash > 0) {
    const h = r.Hd(2, 0);
    let top = H;
    for (const s of tips) top = Math.min(top, s.tip[1]);
    const belly = r.B(-2, 7.5)[1];
    const rows: [number, number, number][] = [
      [top - 1, 6, 1],
      [top + 4, 14, 0.7],
      [belly + 1, 4, 0.8],
      [h[1] - 7, -2, 0.5],
    ];
    rows.forEach(([yy, dx, k]) => {
      const L = Math.round(o.dash * k * 18);
      const y = Math.round(yy);
      const x0 = Math.round(h[0] - 4 - dx);
      for (let j = 0; j < L; j++) {
        const x = x0 - j;
        if (x < 1 || y < 1 || y > H - 2 || p.isOpaque(x, y)) continue;
        p.set(x, y, j < L * 0.25 ? PAL.white : j < L * 0.65 ? PAL.gold4 : PAL.gold3);
      }
    });
  }
  // the eye: cyan4 with a white glint (brightening with the charge); squeezed = a dark lid line
  const e0 = r.Hd(2.2, -2.8);
  const e1 = r.Hd(3.2, -2.8);
  if (o.eye < 0.4) {
    p.set(e0[0], e0[1], PAL.gold0);
    p.set(e1[0], e1[1], PAL.gold0);
    p.set(...r.Hd(1.2, -2.8), PAL.gold1);
  } else if (o.eye < 0.8) {
    p.set(e0[0], e0[1], PAL.cyan2);
    p.set(e1[0], e1[1], PAL.cyan3);
  } else if (o.eye < 1.3) {
    p.set(e0[0], e0[1], PAL.cyan3);
    p.set(e1[0], e1[1], PAL.cyan4);
  } else if (o.eye < 1.8) {
    p.set(e0[0], e0[1], PAL.cyan4);
    p.set(e1[0], e1[1], PAL.white);
  } else {
    p.set(e0[0], e0[1], PAL.white);
    p.set(e1[0], e1[1], PAL.white);
    const g = r.Hd(0.8, -3.6);
    if (!p.isOpaque(g[0], g[1])) p.set(g[0], g[1], PAL.cyan4);
  }
  // charge between the jaws: the V fills with light (white core, cyan4 rim against the jaws, the
  // teeth stay visible) and a hot ball sits just ahead of the gape where the bolt leaves
  if (o.charge > 0 && o.jaw > 0.1) {
    const k = Math.min(1, o.charge);
    const isMouth = (c: number | null) => c === PAL.crim1 || c === PAL.crim2;
    if (k >= 0.3) {
      const src = p.clone();
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          if (!isMouth(src.get(x, y))) continue;
          const nb = [src.get(x - 1, y), src.get(x + 1, y), src.get(x, y - 1), src.get(x, y + 1)];
          const rim = nb.some((c) => c !== null && !isMouth(c));
          p.set(x, y, rim ? (k > 0.6 ? PAL.cyan4 : PAL.cyan3) : k > 0.6 ? PAL.white : PAL.cyan4);
        }
    }
    const m = gape(r);
    const R = 0.4 + k * 1.2;
    const isBody = (c: number | null) => c !== null && c !== PAL.ink && !isMouth(c) && c !== PAL.cyan3 && c !== PAL.cyan4 && c !== PAL.white;
    for (let y = Math.floor(m[1] - R - 2); y <= Math.ceil(m[1] + R + 2); y++)
      for (let x = Math.floor(m[0] - R - 2); x <= Math.ceil(m[0] + R + 2); x++) {
        const d = Math.hypot(x + 0.5 - m[0], y + 0.5 - m[1]);
        if (d > R + 0.9 || isBody(p.get(x, y))) continue;
        p.set(x, y, d <= R ? PAL.white : PAL.cyan4);
      }
    if (o.charge > 0.8) {
      const reach = Math.max(2, Math.min(7, W - 3 - m[0]));
      bolt(p, [m[0] + 1, m[1]], [m[0] + reach, m[1] - 3], fr + 5, 1.2, PAL.white, PAL.cyan4);
      bolt(p, [m[0] + 1, m[1]], [m[0] + reach * 0.8, m[1] + 3], fr + 9, 1, PAL.cyan4, PAL.white);
    }
  }
}

// ---------------------------------------------------------------- portrait (44×34)

function portrait(p: Canvas): void {
  // thunder sky: night, a gold-white flash behind the head, a forked bolt
  const pose = P({ x: 28, y: 46, tilt: 0.34, na: -1.2, nl: 9, hp: 0.22, jaw: 0.8, eye: 2, fn: [44, 52], ff: [41, 54], claw: 0.7, en: 2, arcs: 2.5, charge: 0.75, t: 0.37 });
  const head = rigOf(pose).head;
  const hx = 22;
  const hy = 15;
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 44; x++) {
      const d = Math.hypot(x - hx - 6, (y - hy) * 1.15);
      let col: number = PAL.night0;
      if (d < 28) col = PAL.night1;
      if (d < 20) col = PAL.night2;
      if (d < 13) col = PAL.gold1;
      if (d < 7) col = PAL.gold2;
      p.set(x, y, col);
    }
  bolt(p, [40, 0], [36, 12], 77, 1.6, PAL.gold4, PAL.white, false);
  bolt(p, [36, 12], [42, 22], 78, 1.2, PAL.cyan3, PAL.white, false);
  bolt(p, [4, 2], [8, 10], 79, 1, PAL.cyan3, PAL.cyan4, false);
  const big = new PixelCanvas(W, H);
  drawLizard(big, pose);
  p.blit(big, Math.round(hx - head[0]), Math.round(hy - head[1]));
}

// ---------------------------------------------------------------- export

const IMPACT_FRAME = 5;

/** Muzzle = between the open jaws in the impact frame (the lightning starts here). */
const MUZZLE = (() => {
  const m = gape(rigOf(ANIMS.attack.poses[IMPACT_FRAME]));
  return { x: Math.round(m[0] + 1), y: Math.round(m[1]) };
})();

const art: MonsterArt = {
  id: 'volt_lizard',
  w: W,
  h: H,
  anchorX: 32,
  anchorY: GROUND,
  hover: 0,
  muzzle: MUZZLE,
  core: { x: 31, y: 41 },
  anims: {
    idle: { frames: ANIMS.idle.poses.length, fps: ANIMS.idle.fps, loop: true },
    roar: { frames: ANIMS.roar.poses.length, fps: ANIMS.roar.fps, loop: false },
    attack: { frames: ANIMS.attack.poses.length, fps: ANIMS.attack.fps, loop: false },
    hit: { frames: ANIMS.hit.poses.length, fps: ANIMS.hit.fps, loop: false },
    guard: { frames: ANIMS.guard.poses.length, fps: ANIMS.guard.fps, loop: true },
  },
  attackImpactFrame: IMPACT_FRAME,
  draw(p, anim, frame) {
    const poses = ANIMS[anim].poses;
    drawLizard(p, poses[Math.max(0, Math.min(poses.length - 1, frame))]);
  },
  portrait,
};

export default art;
