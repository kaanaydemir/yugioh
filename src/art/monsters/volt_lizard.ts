// Şimşek Kertenkelesi (volt_lizard) — LIGHT thunder lizard, 64×64, side profile facing right.
//
// An agile, low-slung drake with gold scales, dark lightning-chevron bands and a row of
// electric-blue crest spikes running from the crown down the spine to the tail tip. Parametric
// rig: every frame is a Pose (numbers); draw() paints far legs → tail → crest → torso → neck/head
// → near legs back-to-front with ink separation between parts, outlines the solid body, then
// paints the electricity as light: arcs jumping between spike tips, sparks, the eye glow and the
// charge in the open mouth. The crest has an energy level per spike so a charge wave can travel
// from the tail tip to the head (attack anticipation). The tail is a chain whose curl and wave lag
// the body (secondary motion).

import { PAL } from '../palette';
import { PixelCanvas, bezier, type Pt } from '../pixel';
import type { MonsterAnim, MonsterArt } from '../types';

const W = 64;
const H = 64;
const TAU = Math.PI * 2;
const GROUND = 59;

type Canvas = PixelCanvas;

// ---------------------------------------------------------------- pose

interface Pose {
  /** Body root = middle of the torso (frame px), pitch (rad, + = chest up), stretch. */
  x: number;
  y: number;
  tilt: number;
  st: number;
  /** Neck direction (screen rad) and length; head pitch (rad, + = snout up). */
  na: number;
  nl: number;
  hp: number;
  /** Jaw 0..1, eye 0 shut .. 1 open .. 2 blazing, tongue flick 0..1. */
  jaw: number;
  eye: number;
  tongue: number;
  /** Paw ground/air points: front near/far, hind near/far. */
  fn: Pt;
  ff: Pt;
  hn: Pt;
  hf: Pt;
  /** Front toes spread (claws out) 0..1. */
  claw: number;
  /** Tail: base direction offset (rad, + = up), curl (rad per segment, + = curls up), wave phase/amp. */
  tb: number;
  tc: number;
  tw: number;
  ta: number;
  /** Tail wrap (guard): 0 behind, 1 curled forward around the body. */
  wrap: number;
  /** Crest energy 0 (dim) .. 1 (lit) .. 2 (blazing); charge wave front 0 (tail tip) .. 1 (head), <0 = none. */
  en: number;
  wave: number;
  /** Arc count multiplier, spark burst 0..1 (hit / roar), mouth charge glow 0..1. */
  arcs: number;
  burst: number;
  charge: number;
  /** Speed lines streaming back from the head (lunge) 0..1. */
  dash: number;
  /** Flicker phase (frames advance it). */
  t: number;
}

const N: Pose = {
  x: 35,
  y: 47,
  tilt: 0.12,
  st: 1,
  na: -0.95,
  nl: 6,
  hp: 0.0,
  jaw: 0,
  eye: 1,
  tongue: 0,
  fn: [46, GROUND],
  ff: [42, GROUND],
  hn: [27, GROUND],
  hf: [23, GROUND],
  claw: 0,
  tb: -0.1,
  tc: 0.19,
  tw: 0,
  ta: 1,
  wrap: 0,
  en: 1,
  wave: -1,
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
  return P({
    y: N.y + (breath > 0.4 ? -1 : 0),
    na: N.na + (breath > 0.4 ? -0.04 : 0),
    // the tail tip flicks: a wave travels down the chain once per loop
    tw: t,
    ta: 1,
    tc: N.tc + 0.02 * Math.sin((t - 0.2) * TAU),
    // tongue flick on frames 3-4, blink on 6
    tongue: f === 3 ? 1 : f === 4 ? 0.5 : 0,
    jaw: f === 3 || f === 4 ? 0.12 : 0,
    eye: f === 6 ? 0.3 : 1,
    en: 1 + 0.15 * Math.sin(t * TAU * 2),
    t,
  });
}

const ANIMS: Record<MonsterAnim, { fps: number; loop: boolean; poses: Pose[] }> = {
  idle: { fps: 8, loop: true, poses: Array.from({ length: 8 }, (_, f) => idlePose(f, 8)) },

  // Roar: dip low (anticipation) → rear up on the hind legs, forelegs clawing the air, jaws wide,
  // the crest blazes white with arcs leaping spike to spike and sparks raining → drop back down.
  roar: {
    fps: 10,
    loop: false,
    poses: [
      idlePose(0, 8),
      P({ y: 52, tilt: -0.08, na: -0.25, hp: -0.25, fn: [47, GROUND], hn: [26, GROUND], tb: 0.2, en: 1.2, t: 0.1 }),
      P({ x: 32, y: 46, tilt: 0.45, na: -1.1, nl: 5, hp: 0.3, jaw: 0.5, eye: 2, fn: [43, 50], ff: [40, 52], hn: [28, GROUND], hf: [24, GROUND], claw: 0.6, tb: 0.45, tc: 0.2, tw: 0.2, en: 1.6, arcs: 1.5, t: 0.2 }),
      P({ x: 31, y: 43, tilt: 0.72, na: -1.35, nl: 5, hp: 0.55, jaw: 1, eye: 2, fn: [43, 42], ff: [40, 45], hn: [29, GROUND], hf: [25, GROUND], claw: 1, tb: 0.7, tc: 0.22, tw: 0.3, en: 2, arcs: 2.5, burst: 0.3, charge: 0.35, t: 0.3 }),
      P({ x: 31, y: 43, tilt: 0.74, na: -1.38, nl: 5, hp: 0.6, jaw: 1, eye: 2, fn: [44, 41], ff: [41, 44], hn: [29, GROUND], hf: [25, GROUND], claw: 1, tb: 0.72, tc: 0.23, tw: 0.4, en: 2, arcs: 3, burst: 0.6, charge: 0.5, t: 0.4 }),
      P({ x: 31, y: 43, tilt: 0.73, na: -1.36, nl: 5, hp: 0.58, jaw: 0.95, eye: 2, fn: [43, 42], ff: [40, 44], hn: [29, GROUND], hf: [25, GROUND], claw: 1, tb: 0.72, tc: 0.22, tw: 0.5, en: 2, arcs: 3, burst: 0.9, charge: 0.45, t: 0.5 }),
      P({ x: 31, y: 44, tilt: 0.66, na: -1.3, nl: 5, hp: 0.45, jaw: 0.8, eye: 2, fn: [44, 44], ff: [41, 46], hn: [29, GROUND], hf: [25, GROUND], claw: 0.8, tb: 0.66, tc: 0.2, tw: 0.6, en: 1.8, arcs: 2, burst: 1, t: 0.6 }),
      P({ x: 33, y: 47, tilt: 0.3, na: -0.95, hp: 0.15, jaw: 0.35, eye: 1.5, fn: [46, 54], ff: [43, 56], hn: [27, GROUND], hf: [23, GROUND], claw: 0.4, tb: 0.35, tc: 0.18, tw: 0.7, en: 1.4, arcs: 1.2, t: 0.7 }),
      P({ x: 35, y: 51, tilt: -0.04, na: -0.45, hp: -0.1, jaw: 0.1, eye: 1.2, tb: 0.4, tc: 0.12, tw: 0.8, en: 1.2, t: 0.8 }),
      P({ tw: 0.9, t: 0.9 }),
    ],
  },

  // Attack ("Şimşek Kuyruğu"): crouch low, head drawn back, while a charge climbs the crest
  // from the tail tip to the crown (anticipation) → IMPACT: the head thrusts forward, jaws wide,
  // the mouth blazes white — the lightning starts here → hold the discharge → recoil → settle.
  attack: {
    fps: 12,
    loop: false,
    poses: [
      idlePose(0, 8),
      P({ x: 33, y: 52, tilt: -0.06, na: -0.35, nl: 4, hp: -0.15, eye: 1.5, hn: [27, GROUND], tb: -0.1, tc: 0.15, en: 0.6, wave: 0.0, arcs: 0.5, t: 0.1 }),
      P({ x: 32, y: 52, tilt: -0.08, na: -0.3, nl: 3.6, hp: -0.2, eye: 2, fn: [45, GROUND], tb: 0.0, tc: 0.2, tw: 0.15, en: 0.6, wave: 0.35, arcs: 0.8, t: 0.2 }),
      P({ x: 31, y: 52, tilt: -0.09, na: -0.28, nl: 3.4, hp: -0.22, jaw: 0.15, eye: 2, fn: [45, GROUND], tb: 0.0, tc: 0.22, tw: 0.25, en: 0.6, wave: 0.7, arcs: 1, charge: 0.3, t: 0.3 }),
      P({ x: 31, y: 52, tilt: -0.1, na: -0.26, nl: 3.4, hp: -0.25, jaw: 0.2, eye: 2, fn: [45, GROUND], tb: 0.0, tc: 0.23, tw: 0.35, en: 0.6, wave: 1, arcs: 1.4, charge: 0.6, t: 0.4 }),
      P({ x: 37, y: 50, tilt: 0.02, st: 1.08, na: -0.1, nl: 6.5, hp: 0.15, jaw: 1, eye: 2, fn: [50, GROUND], ff: [46, GROUND], hn: [27, GROUND], hf: [23, GROUND], claw: 0.5, tb: 0.45, tc: 0.1, tw: 0.45, en: 2, arcs: 2.5, charge: 1, dash: 1, t: 0.5 }),
      P({ x: 37, y: 50, tilt: 0.02, st: 1.08, na: -0.12, nl: 6.5, hp: 0.12, jaw: 0.95, eye: 2, fn: [50, GROUND], ff: [46, GROUND], claw: 0.5, tb: 0.5, tc: 0.1, tw: 0.55, en: 1.8, arcs: 2, charge: 0.8, dash: 0.45, t: 0.6 }),
      P({ x: 35, y: 49, tilt: 0.1, na: -0.6, nl: 5, hp: 0.25, jaw: 0.45, eye: 1.5, fn: [48, GROUND], ff: [44, GROUND], tb: 0.45, tc: 0.12, tw: 0.65, en: 1.3, arcs: 1, charge: 0.2, t: 0.7 }),
      P({ x: 35, y: 50, na: -0.55, hp: 0.05, jaw: 0.1, eye: 1.2, tw: 0.75, en: 1.1, t: 0.8 }),
      P({ tw: 0.85, t: 0.9 }),
    ],
  },

  // Hit: jolted back, head flung up, eyes squeezed, jaw open — the crest shorts out in a spray of
  // sparks and flickers dark — then it shakes itself back to the stance.
  hit: {
    fps: 10,
    loop: false,
    poses: [
      P({ x: 32, y: 49, tilt: 0.16, na: -1.05, nl: 4.5, hp: 0.5, jaw: 0.7, eye: 0, fn: [45, 57], ff: [41, GROUND], hn: [26, GROUND], tb: 0.35, tc: 0.17, tw: 0.1, ta: 1.2, en: 0.2, arcs: 0, burst: 0.2, t: 0.15 }),
      P({ x: 32, y: 50, tilt: 0.1, na: -0.85, hp: 0.3, jaw: 0.4, eye: 0, fn: [45, GROUND], hn: [26, GROUND], tb: 0.25, tc: 0.14, tw: 0.2, ta: 1.2, en: 1.7, arcs: 2, burst: 0.55, t: 0.3 }),
      P({ x: 33, y: 50, tilt: 0.06, na: -0.65, hp: 0.12, jaw: 0.15, eye: 0.5, tb: 0.25, tc: 0.12, tw: 0.3, en: 0.4, arcs: 0.5, burst: 0.85, t: 0.45 }),
      P({ x: 34, tw: 0.4, en: 1, t: 0.6 }),
    ],
  },

  // Guard: belly to the ground, head low and level, tail curled forward around the body, crest
  // banked to a slow pulse.
  guard: {
    fps: 5,
    loop: true,
    poses: [0, 1, 2, 3].map((f) => {
      const t = f / 4;
      const s = Math.sin(t * TAU);
      return P({
        x: 35,
        y: 53 + (s > 0.5 ? -1 : 0),
        tilt: -0.02,
        st: 0.95,
        na: -0.2,
        nl: 4,
        hp: -0.08,
        eye: 1.4,
        fn: [46, GROUND],
        ff: [42, GROUND],
        hn: [27, GROUND],
        hf: [23, GROUND],
        wrap: 1,
        tw: t,
        ta: 0.3,
        en: 0.55 + 0.25 * s,
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

/** Gold scale ramp used by the shading passes. */
const SC = [PAL.gold0, PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4] as const;
const scIdx = (c: number | null) => (c === null ? -1 : (SC as readonly number[]).indexOf(c));

/**
 * Cylinder shading per pixel column for a scaled body part: lit band on top, base, shadow band
 * underneath; `belly` rows (from the bottom) take the pale belly colour with scute lines.
 */
function volume(q: Canvas, belly: number, scutes: boolean): void {
  for (let x = 0; x < q.w; x++) {
    let y = 0;
    while (y < q.h) {
      if (q.get(x, y) !== PAL.gold2) {
        y++;
        continue;
      }
      const top = y;
      while (y < q.h && q.get(x, y) === PAL.gold2) y++;
      const bot = y - 1;
      const L = bot - top + 1;
      for (let yy = top; yy <= bot; yy++) {
        const dT = yy - top;
        const dB = bot - yy;
        let c: number = PAL.gold2;
        if (dT === 0 && L >= 3) c = PAL.gold3;
        if (L >= 5 && dB < belly) c = dB === 0 ? PAL.gold2 : (scutes && (x & 1) === 0 && dB === 1 ? PAL.gold3 : PAL.gold4);
        else if (L >= 3 && dB === 0) c = PAL.gold1;
        q.set(x, yy, c);
      }
    }
  }
}

/** Light from the top-left: exposed tops/lefts step up the gold ramp, exposed bottoms down. */
function litEdges(q: Canvas, near: boolean): void {
  const src = q.clone();
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      const c = src.get(x, y);
      const i = scIdx(c);
      if (i < 0) continue;
      if (!src.isOpaque(x, y - 1)) q.set(x, y, SC[Math.min(4, i + (near ? 1 : 0))]);
      else if (!src.isOpaque(x, y + 1) || !src.isOpaque(x + 1, y)) q.set(x, y, SC[Math.max(0, i - 1)]);
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
      if (onlyEmpty && p.isOpaque(x, y) && p.get(x, y) === PAL.ink) continue;
      p.set(x, y, j === 0 && i > 0 ? core : col);
    }
  }
}

// ---------------------------------------------------------------- rig

/** Torso silhouette (body-local: u forward, v down): long, low, slightly sagging belly. */
const TORSO: Pt[] = [
  ...bezier([10.5, -1.5], [9.5, -4.2], [4, -4.6], [-1, -4.4], 8),
  ...bezier([-1, -4.4], [-6, -4.2], [-10.5, -4], [-13.5, -2.2], 8).slice(1),
  ...bezier([-13.5, -2.2], [-15, -0.5], [-14, 2.5], [-11, 3.4], 6).slice(1),
  ...bezier([-11, 3.4], [-6, 4.8], [2, 5], [7, 3.6], 8).slice(1),
  ...bezier([7, 3.6], [10, 2.6], [11.5, 0.8], [10.5, -1.5], 6).slice(1),
];

/** Top of the spine (body-local), sampled for crest spikes, from the shoulders back to the hips. */
const SPINE_U = [7.8, 3.6, -0.6, -4.8, -9, -12.4];
function spineV(u: number): number {
  // matches the TORSO top edge closely
  if (u > 4) return -4.2 + (u - 4) * 0.12;
  if (u > -1) return -4.5;
  return -4.4 + (u + 1) * -0.03 - (u < -10 ? (u + 10) * -0.5 : 0);
}

interface Rig {
  B: (u: number, v: number) => Pt;
  Hd: (u: number, v: number) => Pt;
  J: (u: number, v: number) => Pt;
  head: Pt;
  tail: Pt[];
  tailW: number[];
  /** Crest spikes: base point, direction (screen rad), length, position 0 (tail tip) .. 1 (head). */
  spikes: { b: Pt; a: number; l: number; w: number; pos: number }[];
}

const HS = 1.15;
/** Body length squash (body-local u). */
const BK = 0.86;
/** Leg bone lengths: front upper/lower, hind thigh/shin. */
const LF1 = 6.5;
const LF2 = 6.5;
const LH1 = 7;
const LH2 = 7;

function rigOf(o: Pose): Rig {
  const st = o.st;
  const ca = Math.cos(-o.tilt);
  const sa = Math.sin(-o.tilt);
  const B = (x: number, y: number): Pt => [o.x + x * BK * st * ca - y * sa, o.y + x * BK * st * sa + y * ca];
  const neckBase = B(9.5, -1.8);
  const head: Pt = [neckBase[0] + Math.cos(o.na) * o.nl, neckBase[1] + Math.sin(o.na) * o.nl];
  const hc = Math.cos(-o.hp);
  const hs = Math.sin(-o.hp);
  const Hd = (u: number, v: number): Pt => [head[0] + (u * hc - v * hs) * HS, head[1] + (u * hs + v * hc) * HS];
  const jo = o.jaw * 0.8;
  const J = (u: number, v: number): Pt => {
    const du = u + 1.5;
    const dv = v - 1.0;
    return Hd(-1.5 + du * Math.cos(jo) - dv * Math.sin(jo), 1.0 + du * Math.sin(jo) + dv * Math.cos(jo));
  };

  // tail chain: back from the hips, curling up; a wave travels toward the tip
  const tail: Pt[] = [B(-12.5, -0.8)];
  const tailW: number[] = [];
  const nT = 10;
  {
    let [x, y] = tail[0];
    // backward along the body (screen angle π − tilt), lifted by tb; + curl turns the chain upward
    let a = Math.PI - o.tilt + o.tb;
    for (let i = 1; i <= nT; i++) {
      const f = i / nT;
      const wave = Math.sin((o.tw - f * 0.7) * TAU) * 0.22 * o.ta * f;
      let curl = o.tc * (0.4 + f * 1.2);
      // guard: the tail rolls into a tight chameleon coil
      if (o.wrap > 0) curl = lerp(curl, 0.1 + 0.75 * f * f, o.wrap);
      a += curl + wave * 0.6;
      const seg = 2.3;
      x += Math.cos(a) * seg;
      y += Math.sin(a) * seg;
      if (y > GROUND - 1) y = GROUND - 1;
      tail.push([x, y]);
    }
    for (let i = 0; i <= nT; i++) tailW.push(lerp(6.4, 1.4, i / nT));
  }

  // crest spikes: crown (head), spine, tail
  const spikes: Rig['spikes'] = [];
  const nS = SPINE_U.length;
  // tail spikes (tip → base), on the upper side of the chain
  for (let i = nT - 1; i >= 1; i -= 2) {
    const [x0, y0] = tail[i - 1];
    const [x1, y1] = tail[i + 1] ?? tail[i];
    const ta = Math.atan2(y1 - y0, x1 - x0);
    // the "upper" normal of a chain running leftward is its right-hand normal
    const na = ta + Math.PI / 2;
    const up = Math.sin(na) < 0 ? na : na + Math.PI;
    const w = tailW[i];
    const [cx, cy] = tail[i];
    spikes.push({ b: [cx + Math.cos(up) * (w / 2 - 0.6), cy + Math.sin(up) * (w / 2 - 0.6)], a: up + 0.4, l: 2.2 + (1 - i / nT) * 2.8, w: 2.8, pos: (1 - i / nT) * 0.45 });
  }
  // spine spikes (hips → shoulders): tallest over the shoulders
  for (let k = nS - 1; k >= 0; k--) {
    const u = SPINE_U[k];
    const b = B(u, spineV(u) + 0.6);
    const a = -Math.PI / 2 - o.tilt - 0.45;
    const tall = 4.4 + 3 * Math.sin(((k + 0.7) / nS) * Math.PI);
    spikes.push({ b, a, l: tall, w: 3.8, pos: 0.45 + (1 - k / (nS - 1)) * 0.43 });
  }
  // crown spikes on the back of the head
  spikes.push({ b: Hd(-2.2, -2.4), a: Math.PI + 0.95 - o.hp, l: 4.2, w: 2.6, pos: 0.93 });
  spikes.push({ b: Hd(-0.4, -3.0), a: Math.PI + 1.2 - o.hp, l: 3.4, w: 2.4, pos: 1 });
  return { B, Hd, J, head, tail, tailW, spikes };
}

/** Energy of a spike given the pose: base level, plus a travelling charge wave. */
function spikeEnergy(o: Pose, pos: number, i: number): number {
  let e = o.en;
  if (o.wave >= 0) {
    // behind the wave front (already charged): lit; at the front: white-hot; ahead: dim
    const d = o.wave - pos;
    if (d > 0.12) e = 1.4;
    else if (d > -0.05) e = 2.2;
    else e = Math.min(e, 0.6);
  }
  // crackle flicker
  const fl = hash(i, Math.round(o.t * 97), 5);
  if (fl > 0.82) e += 0.5;
  else if (fl < 0.1) e -= 0.4;
  return e;
}

// ---------------------------------------------------------------- drawing

function drawLizard(p: Canvas, o: Pose): void {
  const r = rigOf(o);
  const { B, Hd, J } = r;
  const st = o.st;

  // ------------------------------------------------ legs (IK)
  const shN = B(6.5 * st, 1.8);
  const shF = B(4.8 * st, 1.4);
  const hipN = B(-9 * st, 1.2);
  const hipF = B(-10.5 * st, 0.8);
  const leg = (q: Canvas, sh: Pt, paw: Pt, l1: number, l2: number, bend: 1 | -1, near: boolean, front: boolean) => {
    const base = near ? PAL.gold2 : PAL.gold1;
    const foot: Pt = [paw[0] - (front ? 0.5 : 1), paw[1] - 1.6];
    const el = ik(sh[0], sh[1], foot[0], foot[1], l1, l2, bend);
    q.stroke([sh, el], front ? 4.6 : 6.4, 3.4, base);
    q.stroke([el, foot], 3.2, 2.4, base);
    // splayed toes with white claws
    const spread = front ? lerp(0.25, 0.7, o.claw) : 0.35;
    const air = paw[1] < GROUND - 1;
    const fa = air ? -0.2 - o.claw * 0.5 : 0;
    for (let k = -1; k <= 1; k++) {
      const a = fa + k * spread;
      const L = 2.6 + (k === 0 ? 0.6 : 0);
      const tx = foot[0] + Math.cos(a) * L;
      const ty = Math.min(GROUND - 1, foot[1] + 1 + Math.sin(a) * L * (air ? 1 : 0.2));
      q.line(foot[0], foot[1] + 0.5, tx, ty, base);
      q.set(tx + 1, ty, near ? PAL.white : PAL.stone3);
    }
    litEdges(q, near);
    // elbow / knee scale highlight
    q.paint(el[0] - 0.5, el[1] - 1, near ? PAL.gold3 : PAL.gold2);
  };
  layer(p, (q) => leg(q, hipF, o.hf, LH1, LH2, 1, false, false));
  layer(p, (q) => leg(q, shF, o.ff, LF1, LF2, -1, false, true));

  // ------------------------------------------------ tail (behind the body unless wrapped)
  const drawTail = (q: Canvas) => {
    q.stroke(r.tail, 6.4, 1.4, PAL.gold2);
    volume(q, 2, false);
    litEdges(q, true);
    // dark chevron bands along the tail
    for (let i = 2; i < r.tail.length - 1; i += 2) {
      const [x, y] = r.tail[i];
      const [x2, y2] = r.tail[i + 1];
      const a = Math.atan2(y2 - y, x2 - x) + Math.PI / 2;
      const w = r.tailW[i] / 2;
      for (let k = -w + 0.5; k <= w - 1.5; k += 0.5) {
        const px = x + Math.cos(a) * k - (Math.abs(k) / w) * Math.cos(a - Math.PI / 2) * 1.2;
        const py = y + Math.sin(a) * k - (Math.abs(k) / w) * Math.sin(a - Math.PI / 2) * 1.2;
        const c = q.get(px, py);
        if (c === PAL.gold2 || c === PAL.gold3) q.set(px, py, PAL.gold1);
      }
    }
  };
  layer(p, drawTail);

  // ------------------------------------------------ crest spikes (behind the torso edge)
  const spikeCol = (e: number): [number, number, number] =>
    e < 0.45 ? [PAL.cyan0, PAL.cyan1, PAL.cyan2] : e < 1.15 ? [PAL.cyan1, PAL.cyan2, PAL.cyan3] : e < 1.75 ? [PAL.cyan2, PAL.cyan3, PAL.cyan4] : [PAL.cyan3, PAL.cyan4, PAL.white];
  const tips: { tip: Pt; e: number }[] = [];
  layer(p, (q) => {
    r.spikes.forEach((s, i) => {
      const e = spikeEnergy(o, s.pos, i);
      const [c0, c1, c2] = spikeCol(e);
      const tip: Pt = [s.b[0] + Math.cos(s.a) * s.l, s.b[1] + Math.sin(s.a) * s.l];
      const nx = -Math.sin(s.a) * (s.w / 2);
      const ny = Math.cos(s.a) * (s.w / 2);
      q.tri(s.b[0] + nx, s.b[1] + ny, s.b[0] - nx, s.b[1] - ny, tip[0], tip[1], c1);
      // lit leading face, dark trailing face, hot tip
      q.line(s.b[0] - nx * 0.6, s.b[1] - ny * 0.6, tip[0], tip[1], c2);
      q.set(tip[0], tip[1], c2);
      q.paint(s.b[0] + nx * 0.7, s.b[1] + ny * 0.7, c0);
      tips.push({ tip, e });
    });
  });

  // ------------------------------------------------ torso
  layer(p, (q) => {
    q.poly(
      TORSO.map(([u, v]) => B(u, v)),
      PAL.gold2,
    );
    // near thigh + upper arm belong to the body silhouette
    const elN = ik(shN[0], shN[1], o.fn[0] - 0.5, o.fn[1] - 1.6, LF1, LF2, -1);
    const knN = ik(hipN[0], hipN[1], o.hn[0] - 1, o.hn[1] - 1.6, LH1, LH2, 1);
    q.stroke([hipN, knN], 7, 4.4, PAL.gold2);
    q.stroke([shN, elN], 5, 3.6, PAL.gold2);
    volume(q, 3, true);
    litEdges(q, true);
    // lightning-chevron bands across the back
    for (const u of [5.5, -0.5, -6.5]) {
      const c0 = B(u * st, spineV(u) + 0.6);
      for (let k = 0; k < 5; k++) {
        const z = k % 2 === 0 ? 0 : 1;
        const px = c0[0] - k * 0.6 + z;
        const py = c0[1] + k;
        if (q.get(px, py) !== null && q.get(px, py) !== PAL.gold4) q.set(px, py, k === 0 ? PAL.gold0 : PAL.gold1);
      }
    }
    // shoulder & haunch muscle highlights
    const arc = (c: Pt, rr: number, a0: number, a1: number, col: number) => {
      for (let k = 0; k <= 6; k++) {
        const an = lerp(a0, a1, k / 6) - o.tilt;
        q.paint(c[0] + Math.cos(an) * rr, c[1] + Math.sin(an) * rr, col);
      }
    };
    arc(B(-9 * st, 0.4), 3.4, Math.PI * 1.05, Math.PI * 1.5, PAL.gold3);
    arc(B(6.5 * st, 0.6), 2.8, Math.PI * 1.1, Math.PI * 1.5, PAL.gold3);
    // scale flecks
    for (const [u, v] of [
      [2, -1.5],
      [-3.5, -0.8],
      [-10, -1.2],
      [7, -1],
    ] as const) {
      const [x, y] = B(u * st, v);
      if (q.get(x, y) === PAL.gold2) q.set(x, y, PAL.gold3);
      if (q.get(x + 1, y + 1) === PAL.gold2) q.set(x + 1, y + 1, PAL.gold1);
    }
  });

  // ------------------------------------------------ neck + head
  layer(p, (q) => {
    const n0 = B(8 * st, -1);
    const n1 = Hd(-1.8, 0.4);
    q.stroke([n0, [lerp(n0[0], n1[0], 0.5), lerp(n0[1], n1[1], 0.5) + 0.4], n1], 7, 5.6, PAL.gold2);
    // lower jaw (behind the upper head)
    if (o.jaw > 0.12) {
      q.poly([Hd(-1, 0.6), Hd(7.0, 0.8), J(6.4, 1.6), J(-0.5, 1.8)], PAL.crim1);
    }
    q.poly([J(-1.5, 1.0), J(6.4, 1.1), J(6.0, 2.1), J(3, 2.8), J(-1.2, 3.0)], PAL.gold2);
    // skull + tapered snout (wedge), brow ridge
    q.ellipse(...Hd(0, -0.4), 3.8, 3.4, PAL.gold2);
    q.poly([Hd(0.2, -3.6), Hd(3, -3.1), Hd(6, -1.9), Hd(7.2, -0.8), Hd(7.1, 0.8), Hd(1.5, 1.2)], PAL.gold2);
    // brow horn: a short swept spike over the eye
    q.tri(...Hd(0.4, -3.2), ...Hd(2.8, -3.0), ...Hd(-1.2, -5.2), PAL.gold2);
    // throat dewlap and a swept cheek spike at the jaw hinge
    q.ellipse(...Hd(-1.2, 1.9), 2.4, 1.7, PAL.gold2);
    q.tri(...Hd(-2.2, 0.0), ...Hd(-1.0, 1.8), ...Hd(-5.2, 1.6), PAL.gold2);
    volume(q, 2, false);
    litEdges(q, true);
    // brow ridge (dark, angled down toward the snout), nostril, mouth line
    const br = [Hd(0.2, -2.2), Hd(1.4, -2.1), Hd(2.6, -1.8)];
    for (const [x, y] of br) q.set(x, y, PAL.gold1);
    q.set(...Hd(6.3, -0.9), PAL.gold0);
    if (o.jaw <= 0.12) {
      // mouth line, curling up at the corner (a faint lizard smile)
      for (let u = 0.5; u <= 6.3; u += 0.8) q.set(...Hd(u, u < 1.5 ? 0.6 : 1.0), PAL.gold0);
    } else {
      // teeth
      q.set(...Hd(5.9, 1.1), PAL.white);
      q.set(...Hd(5.2, 1.1), PAL.stone4);
      q.set(...J(6.8, 1.5), PAL.stone4);
      // tongue
      q.set(...J(3, 1.2), PAL.crim2);
    }
    // forked tongue flick
    if (o.tongue > 0) {
      const L = 3 * o.tongue;
      const t0 = Hd(7.1, 0.6);
      const t1: Pt = [t0[0] + L, t0[1] + 0.3];
      q.line(t0[0], t0[1], t1[0], t1[1], PAL.crim3);
      if (o.tongue > 0.7) {
        q.set(t1[0] + 1, t1[1] - 1, PAL.crim3);
        q.set(t1[0] + 1, t1[1] + 1, PAL.crim3);
      }
    }
    // eye socket (dark) — the glow is painted as light later
    const e = Hd(2.1, -1.0);
    q.set(e[0], e[1], PAL.ink);
    q.set(e[0] + 1, e[1], PAL.ink);
  });

  // ------------------------------------------------ near legs
  layer(p, (q) => leg(q, hipN, o.hn, LH1, LH2, 1, true, false), PAL.gold0);
  layer(p, (q) => leg(q, shN, o.fn, LF1, LF2, -1, true, true), PAL.gold0);

  // ------------------------------------------------ outline
  p.outline(PAL.ink);

  // ------------------------------------------------ electricity (light)
  electric(p, o, r, tips);
}

function electric(p: Canvas, o: Pose, r: Rig, tips: { tip: Pt; e: number }[]): void {
  const fr = Math.round(o.t * 97);
  // arcs jumping between neighbouring spike tips
  const nArcs = Math.round(2 * o.arcs);
  for (let k = 0; k < nArcs; k++) {
    const i = Math.floor(hash(fr, k, 11) * (tips.length - 1));
    const a = tips[i];
    const b = tips[i + 1];
    if (!a || !b) continue;
    const d = Math.hypot(b.tip[0] - a.tip[0], b.tip[1] - a.tip[1]);
    if (d > 9) continue;
    const lift: Pt = [(a.tip[0] + b.tip[0]) / 2, Math.min(a.tip[1], b.tip[1]) - 1.5 - hash(fr, k, 2) * 2];
    const hot = (a.e + b.e) / 2 > 1.5;
    bolt(p, a.tip, lift, fr * 7 + k, 0.8, hot ? PAL.white : PAL.cyan4, PAL.white);
    bolt(p, lift, b.tip, fr * 7 + k + 1, 0.8, hot ? PAL.white : PAL.cyan4, PAL.white);
  }
  // sparks hopping off hot tips
  tips.forEach((s, i) => {
    if (s.e < 1.3) return;
    if (hash(fr, i, 19) > 0.35 + o.arcs * 0.1) return;
    const a = hash(fr, i, 23) * TAU;
    const d = 1.5 + hash(fr, i, 29) * 2.5;
    const x = s.tip[0] + Math.cos(a) * d;
    const y = s.tip[1] + Math.sin(a) * d - 1;
    if (!p.isOpaque(x, y)) p.set(x, y, s.e > 1.8 ? PAL.white : PAL.cyan4);
  });
  // short-circuit spray (hit / roar): bright dashes flying out of the crest
  if (o.burst > 0 && o.burst < 1) {
    for (let k = 0; k < 9; k++) {
      const s = tips[Math.floor(hash(k, 3, 1) * tips.length)];
      if (!s) continue;
      const a = -Math.PI / 2 + (hash(k, 4, 1) - 0.5) * 2.4;
      const d0 = 2 + o.burst * (6 + hash(k, 5, 1) * 10);
      const x = s.tip[0] + Math.cos(a) * d0;
      const y = s.tip[1] + Math.sin(a) * d0 + o.burst * o.burst * 6;
      const c = o.burst < 0.5 ? PAL.white : o.burst < 0.8 ? PAL.cyan4 : PAL.cyan3;
      if (!p.isOpaque(x, y)) p.set(x, y, c);
      const x2 = x - Math.cos(a);
      const y2 = y - Math.sin(a);
      if (o.burst < 0.7 && !p.isOpaque(x2, y2)) p.set(x2, y2, PAL.cyan3);
    }
  }
  // lunge speed lines: bright dashes streaming back over the crest and under the belly
  if (o.dash > 0) {
    const h = r.Hd(4, 0);
    let top = H;
    for (const s of tips) top = Math.min(top, s.tip[1]);
    const belly = r.B(-2, 5.5)[1];
    const rows: [number, number, number][] = [
      [top - 2, 0, 1],
      [top - 5, 5, 0.7],
      [belly + 1, 3, 0.8],
      [h[1] - 5, -2, 0.5],
    ];
    rows.forEach(([yy, dx, k]) => {
      const L = Math.round(o.dash * k * 18);
      const y = Math.round(yy);
      const x0 = Math.round(h[0] - 4 - dx);
      for (let j = 0; j < L; j++) {
        const x = x0 - j;
        if (x < 1 || y < 1 || y > H - 2 || p.isOpaque(x, y)) continue;
        p.set(x, y, j < L * 0.25 ? PAL.white : j < L * 0.65 ? PAL.cyan4 : PAL.cyan3);
      }
    });
  }
  // the eye glows electric
  const e = r.Hd(2.1, -1.0);
  if (o.eye < 0.4) {
    p.set(e[0], e[1], PAL.gold1);
    p.set(e[0] + 1, e[1], PAL.gold1);
  } else {
    p.set(e[0], e[1], o.eye > 1.5 ? PAL.cyan4 : PAL.cyan3);
    p.set(e[0] + 1, e[1], o.eye > 1.5 ? PAL.white : PAL.cyan4);
    if (o.eye > 1.5) {
      // a glint trailing off the eye
      if (!p.isOpaque(e[0] - 1, e[1] - 1)) p.set(e[0] - 1, e[1] - 1, PAL.cyan3);
    }
  }
  // charge in the mouth: white-hot core between the jaws
  if (o.charge > 0 && o.jaw > 0.1) {
    const m: Pt = [(r.Hd(5.6, 1.3)[0] + r.J(5.2, 1.5)[0]) / 2, (r.Hd(5.6, 1.3)[1] + r.J(5.2, 1.5)[1]) / 2];
    const R = 0.8 + o.charge * 1.6;
    p.disc(m[0], m[1], R + 0.7, PAL.cyan3);
    p.disc(m[0], m[1], R, PAL.cyan4);
    p.disc(m[0], m[1], Math.max(0.5, R - 0.9), PAL.white);
    if (o.charge > 0.8) {
      // first fork of the bolt leaving the jaws
      const reach = Math.max(2, Math.min(8, W - 2 - m[0]));
      bolt(p, [m[0] + 1, m[1]], [m[0] + reach, m[1] - 2], fr + 5, 1.2, PAL.white, PAL.cyan4, false);
      bolt(p, [m[0] + 1, m[1]], [m[0] + reach * 0.75, m[1] + 3], fr + 9, 1, PAL.cyan4, PAL.white, false);
    }
  }
}

// ---------------------------------------------------------------- portrait (44×34)

function portrait(p: Canvas): void {
  // thunder sky: night, an electric flash behind the head (gold reads hot against it), a forked bolt
  const pose = P({ x: 31, y: 47, tilt: 0.36, na: -0.9, nl: 5, hp: 0.12, jaw: 0.55, eye: 2, fn: [43, 51], ff: [40, 53], claw: 0.7, en: 2, arcs: 2.5, t: 0.37 });
  const head = rigOf(pose).head;
  const hx = 27;
  const hy = 14;
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 44; x++) {
      const d = Math.hypot(x - hx - 2, (y - hy) * 1.15);
      let col: number = PAL.night0;
      if (d < 26) col = PAL.night1;
      if (d < 18) col = PAL.cyan0;
      if (d < 12) col = PAL.cyan1;
      if (d < 6) col = PAL.cyan2;
      p.set(x, y, col);
    }
  bolt(p, [5, 0], [9, 12], 77, 1.6, PAL.cyan3, PAL.white, false);
  bolt(p, [9, 12], [4, 22], 78, 1.2, PAL.cyan2, PAL.cyan4, false);
  const big = new PixelCanvas(W, H);
  drawLizard(big, pose);
  p.blit(big, Math.round(hx - head[0]), Math.round(hy - head[1]));
}

// ---------------------------------------------------------------- export

const IMPACT_FRAME = 5;

/** Muzzle = between the open jaws in the impact frame (the lightning starts here). */
const MUZZLE = (() => {
  const r = rigOf(ANIMS.attack.poses[IMPACT_FRAME]);
  const a = r.Hd(5.6, 1.3);
  const b = r.J(5.2, 1.5);
  return { x: Math.round((a[0] + b[0]) / 2 + 1), y: Math.round((a[1] + b[1]) / 2) };
})();

const art: MonsterArt = {
  id: 'volt_lizard',
  w: W,
  h: H,
  anchorX: 35,
  anchorY: GROUND,
  hover: 0,
  muzzle: MUZZLE,
  core: { x: 35, y: 45 },
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
