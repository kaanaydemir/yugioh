// Magma Titanı (magma_titan) — FIRE ace giant, 80×80.
//
// A hunched basalt colossus in 3/4 view facing right: craggy shoulder boulders tower over a small
// sunken head, a molten core burns in the chest and lava seams radiate from it across the rock
// plates. Parametric rig: every frame is a Pose (numbers) and drawTitan() paints the parts
// back-to-front — far arm → far leg → torso → near leg → head → near arm — each part in its own
// layer (ink separation where parts overlap). Limbs are 2-bone IK chains built from faceted rock
// chunks (lit / mid / dark facets, light from the top-left). All lava (seams, core, eyes, fists,
// drips, vent flares, embers, the punch smear) is driven by pose intensities so it pulses.

import { PAL } from '../palette';
import { PixelCanvas, type Pt } from '../pixel';
import type { MonsterAnim, MonsterArt } from '../types';

const W = 80;
const H = 80;
const TAU = Math.PI * 2;
const GROUND = 77;

// ---------------------------------------------------------------- pose

interface Chip {
  x: number;
  y: number;
  /** size 1..3 */
  s: number;
  /** lava ember instead of rock */
  hot?: boolean;
}

interface Pose {
  /** Pelvis center (frame px). */
  px: number;
  py: number;
  /** Torso lean (rad, + = forward / toward the right), breathing lift of the chest (px). */
  lean: number;
  breath: number;
  /** Shoulder twist: -1 = near shoulder pulled back (wind-up), +1 = rolled forward (punch). */
  twist: number;
  /** Head offset and expression. */
  hdx: number;
  hdy: number;
  head: 'n' | 'roar' | 'hit' | 'guard';
  /** Near (screen-left, in front) fist, far (screen-right, behind) fist + knuckle direction (rad). */
  nh: Pt;
  nd: number;
  fh: Pt;
  fd: number;
  /** Far arm drawn in front of the torso (guard / chest beat). */
  farFront: boolean;
  /** Feet (ground contact points). */
  nf: Pt;
  ff: Pt;
  /** Glow intensities: core 0..2, seams 0..2, eyes 0..2. */
  core: number;
  seam: number;
  eye: number;
  /** Shoulder vent flare 0..1.6. */
  flare: number;
  /** Near fist heat 0..1 (impact), lava burst at the knuckles 0..1. */
  heat: number;
  burst: number;
  /** Motion smear for the near fist: previous fist positions (oldest first). */
  smear: Pt[];
  /** Rock chips / embers flying (hit). */
  chips: Chip[];
  /** Lava drip phase 0..1 (loops). */
  drip: number;
  /** Chest beat flash: 0 none, 1 near pec, 2 far pec. */
  beat: number;
  /** Stomp splash at the front (far) foot 0..1. */
  stomp: number;
  /** Flicker phase (any number). */
  t: number;
}

const N: Pose = {
  px: 37,
  py: 56,
  lean: 0,
  breath: 0,
  twist: 0,
  hdx: 0,
  hdy: 0,
  head: 'n',
  nh: [17, 57],
  nd: Math.PI / 2,
  fh: [60, 56],
  fd: Math.PI / 2,
  farFront: false,
  nf: [29, GROUND],
  ff: [49, GROUND],
  core: 1,
  seam: 1,
  eye: 1,
  flare: 0,
  heat: 0,
  burst: 0,
  smear: [],
  chips: [],
  drip: 0,
  beat: 0,
  stomp: 0,
  t: 0,
};

const P = (o: Partial<Pose>): Pose => ({ ...N, ...o });

// ---------------------------------------------------------------- animations

function idlePose(f: number, n: number): Pose {
  const t = f / n;
  const s = Math.sin(t * TAU); // breath: + = inhale (chest up)
  const lag = Math.sin((t - 0.12) * TAU); // fists follow the shoulders a beat later
  const fy = (lag > 0.4 ? -1 : 0) + (lag < -0.6 ? 1 : 0);
  return P({
    breath: s > 0.35 ? 1 : s < -0.35 ? -1 : 0,
    py: N.py + (s < -0.5 ? 1 : 0),
    nh: [N.nh[0], N.nh[1] + fy],
    fh: [N.fh[0], N.fh[1] + fy],
    core: 1 + 0.55 * s,
    seam: 1 + 0.25 * Math.sin((t + 0.15) * TAU),
    drip: t,
    // a slow ember blink
    eye: f === 6 ? 0.5 : 1,
    t,
  });
}

const ANIMS: Record<MonsterAnim, { fps: number; loop: boolean; poses: Pose[] }> = {
  idle: { fps: 7, loop: true, poses: Array.from({ length: 8 }, (_, f) => idlePose(f, 8)) },

  // Roar: hunch and gather (anticipation) → rise, fists thrown high, head back, shoulder vents
  // erupt → pound the chest (near, far, near — the core flashes on every beat) → settle.
  roar: {
    fps: 10,
    loop: false,
    poses: [
      P({ t: 0.0 }),
      P({ py: 58, lean: 0.1, hdy: 1, nh: [21, 60], fh: [56, 60], core: 0.5, seam: 0.6, eye: 0.8, t: 0.1 }),
      P({ py: 55, lean: -0.06, nh: [8, 40], nd: -2.2, fh: [68, 38], fd: -0.9, core: 1.4, seam: 1.3, eye: 1.4, flare: 0.5, t: 0.2 }),
      P({ py: 54, lean: -0.12, hdx: -1, hdy: -1, head: 'roar', nh: [11, 13], nd: -1.9, fh: [66, 12], fd: -1.25, core: 2, seam: 2, eye: 2, flare: 1.3, t: 0.3 }),
      P({ py: 54, lean: -0.13, hdx: -1, hdy: -1, head: 'roar', nh: [10, 12], nd: -1.9, fh: [67, 11], fd: -1.25, core: 2, seam: 1.8, eye: 2, flare: 1.6, t: 0.4 }),
      P({ py: 56, lean: 0.04, head: 'roar', nh: [26, 40], nd: 0.15, fh: [66, 24], fd: -1.0, core: 2.3, seam: 2, eye: 2, flare: 1.2, beat: 1, t: 0.5 }),
      P({ py: 56, lean: 0.02, head: 'roar', nh: [10, 34], nd: -2.3, fh: [53, 39], fd: Math.PI - 0.15, farFront: true, core: 2.3, seam: 1.9, eye: 2, flare: 1.1, beat: 2, t: 0.6 }),
      P({ py: 56, lean: 0.04, head: 'roar', nh: [26, 40], nd: 0.15, fh: [66, 26], fd: -1.0, core: 2.3, seam: 2, eye: 2, flare: 1.0, beat: 1, t: 0.7 }),
      P({ py: 56, lean: 0.02, nh: [20, 51], nd: 1.9, fh: [60, 47], fd: 1.2, core: 1.4, seam: 1.3, eye: 1.3, flare: 0.4, t: 0.8 }),
      P({ core: 1.1, seam: 1.1, flare: 0.1, t: 0.9 }),
    ],
  },

  // Attack ("Lav Yumruğu"): rear back, near fist cocked far behind (anticipation, core charging) →
  // stomp forward and swing (smear) → IMPACT: arm fully extended, knuckles white-hot → hold →
  // follow-through → recover.
  attack: {
    fps: 12,
    loop: false,
    poses: [
      P({ t: 0 }),
      P({ px: 36, lean: -0.08, twist: -0.5, nh: [12, 48], nd: 2.6, fh: [58, 47], fd: -0.6, ff: [50, 75], core: 1.3, seam: 1.2, t: 0.1 }),
      P({ px: 35, py: 57, lean: -0.15, twist: -1, hdx: -1, nh: [12, 25], nd: -2.2, fh: [57, 43], fd: -0.4, ff: [51, 73], nf: [28, GROUND], core: 1.8, seam: 1.5, eye: 1.5, flare: 0.25, heat: 0.5, t: 0.2 }),
      P({ px: 35, py: 57, lean: -0.17, twist: -1, hdx: -1, nh: [11, 24], nd: -2.25, fh: [57, 43], fd: -0.4, ff: [51, 73], nf: [28, GROUND], core: 2, seam: 1.7, eye: 1.8, flare: 0.4, heat: 0.75, t: 0.3 }),
      P({ px: 39, py: 57, lean: 0.1, twist: 0.4, nh: [42, 29], nd: -0.4, fh: [52, 50], fd: 2.6, ff: [55, GROUND], nf: [27, GROUND], core: 2, seam: 1.6, eye: 2, flare: 0.4, heat: 0.6,
        smear: [[11, 25], [15, 20], [24, 19], [34, 23]], stomp: 1, t: 0.4 }),
      P({ px: 41, py: 57, lean: 0.2, twist: 1, nh: [64, 37], nd: 0.08, fh: [50, 52], fd: 2.4, ff: [56, GROUND], nf: [25, GROUND], core: 2, seam: 2, eye: 2, flare: 0.6, heat: 1, burst: 1,
        smear: [[34, 27], [44, 30], [54, 34]], stomp: 0.6, t: 0.5 }),
      P({ px: 41, py: 57, lean: 0.21, twist: 1, nh: [65, 38], nd: 0.08, fh: [50, 52], fd: 2.4, ff: [56, GROUND], nf: [25, GROUND], core: 1.8, seam: 1.8, eye: 2, flare: 0.4, heat: 0.8, burst: 0.6, t: 0.6 }),
      P({ px: 40, py: 57, lean: 0.14, twist: 0.7, nh: [62, 46], nd: 0.6, fh: [53, 52], fd: 2.0, ff: [55, GROUND], nf: [26, GROUND], core: 1.5, seam: 1.4, eye: 1.5, heat: 0.4, burst: 0.25, t: 0.7 }),
      P({ px: 38, py: 57, lean: 0.05, twist: 0.2, nh: [30, 57], nd: 1.6, fh: [58, 54], fd: 1.7, ff: [51, GROUND], core: 1.2, seam: 1.1, t: 0.8 }),
      P({ t: 0.9 }),
    ],
  },

  // Hit: rocked back, head snaps, seams flash, rock chips and embers burst off the chest; recover.
  hit: {
    fps: 10,
    loop: false,
    poses: [
      P({ px: 34, lean: -0.17, head: 'hit', hdx: -1, nh: [11, 53], nd: 2.2, fh: [64, 48], fd: -0.2, core: 0.4, seam: 2, eye: 0.3,
        chips: [{ x: 63, y: 29, s: 3 }, { x: 67, y: 37, s: 2 }, { x: 60, y: 23, s: 2 }, { x: 67, y: 30, s: 1, hot: true }, { x: 64, y: 41, s: 1, hot: true }], t: 0.1 }),
      P({ px: 34, lean: -0.13, head: 'hit', nh: [12, 55], nd: 2.0, fh: [63, 51], fd: 0.4, core: 0.7, seam: 1.5, eye: 0.3,
        chips: [{ x: 68, y: 24, s: 3 }, { x: 72, y: 34, s: 2 }, { x: 64, y: 16, s: 2 }, { x: 73, y: 26, s: 1, hot: true }, { x: 70, y: 41, s: 1, hot: true }], t: 0.2 }),
      P({ px: 35, lean: -0.07, nh: [15, 57], nd: 1.8, fh: [62, 54], fd: 1.0, core: 0.9, seam: 1.2, eye: 0.9,
        chips: [{ x: 72, y: 23, s: 2 }, { x: 76, y: 36, s: 1 }, { x: 67, y: 13, s: 1 }, { x: 77, y: 27, s: 1, hot: true }], t: 0.3 }),
      P({ px: 36, lean: -0.02, core: 1, seam: 1, t: 0.4 }),
    ],
  },

  // Guard: crouched, forearms crossed low in front of the belly, fists up at the pecs — the core
  // glows in the V between them; seams banked low, slow breathing.
  guard: {
    fps: 4,
    loop: true,
    poses: [0, 1, 2, 3].map((f) => {
      const t = f / 4;
      const s = Math.sin(t * TAU);
      const up = s > 0.5 ? 1 : 0;
      return P({
        py: 58,
        lean: 0.06,
        twist: 0.4,
        breath: up,
        head: 'guard',
        hdy: 1,
        nh: [49, 43 - up],
        nd: -0.9,
        fh: [29, 43 - up],
        fd: -2.25,
        farFront: true,
        nf: [27, GROUND],
        ff: [50, GROUND],
        core: 0.85 + 0.35 * s,
        seam: 0.55 + 0.15 * s,
        eye: 1,
        drip: t,
        t,
      });
    }),
  },
};

// ---------------------------------------------------------------- helpers

type Canvas = PixelCanvas;

/** Draw into a fresh layer, then composite with an ink separation line where it overlaps. */
function layer(p: Canvas, fn: (q: Canvas) => void, sep: number | null = PAL.ink): void {
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

function ik(sx: number, sy: number, hx: number, hy: number, l1: number, l2: number, bend: 1 | -1): [Pt, Pt] {
  const dx = hx - sx;
  const dy = hy - sy;
  const d = Math.max(0.01, Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01));
  const a = Math.atan2(dy, dx);
  const ca = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const ang = a + bend * Math.acos(Math.max(-1, Math.min(1, ca)));
  const el: Pt = [sx + Math.cos(ang) * l1, sy + Math.sin(ang) * l1];
  const fa = Math.atan2(hy - el[1], hx - el[0]);
  return [el, [el[0] + Math.cos(fa) * l2, el[1] + Math.sin(fa) * l2]];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPt = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

/** Deterministic hash noise in 0..1. */
function hash(a: number, b = 0, c = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Lava color for a glow level (0..~2.4). */
function lava(g: number): number {
  if (g < 0.35) return PAL.fire0;
  if (g < 0.75) return PAL.fire1;
  if (g < 1.15) return PAL.fire2;
  if (g < 1.6) return PAL.fire3;
  if (g < 2.1) return PAL.fire4;
  return PAL.gold4;
}

const ROCK = [PAL.ink, PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4] as const;
const isRock = (c: number | null) => c === PAL.stone0 || c === PAL.stone1 || c === PAL.stone2 || c === PAL.stone3;
const rockUp = (c: number) => ROCK[Math.min(ROCK.length - 1, ROCK.indexOf(c as (typeof ROCK)[number]) + 1)];
const rockDn = (c: number) => ROCK[Math.max(0, ROCK.indexOf(c as (typeof ROCK)[number]) - 1)];

/**
 * Light a rock layer: rock pixels on the top/left silhouette edge step up the ramp, pixels on the
 * bottom/right edge step down; top-left corners get a specular stone highlight on near parts.
 */
function rockLight(q: Canvas, near: boolean): void {
  const src = q.clone();
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      const c = src.get(x, y);
      if (c === null || !isRock(c)) continue;
      const up = !src.isOpaque(x, y - 1);
      const left = !src.isOpaque(x - 1, y);
      const down = !src.isOpaque(x, y + 1);
      const right = !src.isOpaque(x + 1, y);
      if (up || left) {
        let n = rockUp(c);
        if (!near && n === PAL.stone3) n = PAL.stone2;
        if (near && up && left && n === PAL.stone3) n = PAL.stone4;
        q.set(x, y, n);
      } else if (down || right) q.set(x, y, rockDn(c));
    }
}

/**
 * A craggy rock chunk around the segment a→b (widths wa→wb): three facets — a lit facet on the
 * side facing the top-left light, the mid body, and a dark facet on the far side.
 */
function chunk(q: Canvas, a: Pt, b: Pt, wa: number, wb: number, seed: number, near: boolean): void {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / L;
  const uy = (b[1] - a[1]) / L;
  let nx = -uy;
  let ny = ux;
  if (nx + ny > 0) {
    nx = -nx;
    ny = -ny;
  } // n = side facing the light
  const K = Math.max(2, Math.round(L / 4));
  const side = (sgn: number, k: number): Pt[] => {
    const out: Pt[] = [];
    for (let i = 0; i <= K; i++) {
      const f = i / K;
      const w = lerp(wa, wb, f) / 2 + (hash(seed, i, sgn > 0 ? 1 : 2) - 0.5) * 1.6;
      out.push([a[0] + ux * L * f + nx * w * sgn * k, a[1] + uy * L * f + ny * w * sgn * k]);
    }
    return out;
  };
  const lit = side(1, 1);
  const dark = side(-1, 1);
  const capB: Pt[] = [
    [b[0] + ux * 1.5 + nx * wb * 0.25, b[1] + uy * 1.5 + ny * wb * 0.25],
    [b[0] + ux * 1.5 - nx * wb * 0.25, b[1] + uy * 1.5 - ny * wb * 0.25],
  ];
  const capA: Pt[] = [
    [a[0] - ux * 1.5 - nx * wa * 0.25, a[1] - uy * 1.5 - ny * wa * 0.25],
    [a[0] - ux * 1.5 + nx * wa * 0.25, a[1] - uy * 1.5 + ny * wa * 0.25],
  ];
  const mid = near ? PAL.stone1 : PAL.stone0;
  const hi = near ? PAL.stone2 : PAL.stone1;
  const lo = near ? PAL.stone0 : PAL.ink;
  q.poly([...lit, ...capB, ...dark.slice().reverse(), ...capA], mid);
  // lit facet: from the lit edge to a ridge a little toward the light side
  q.poly([...lit, ...side(1, 0.15).reverse()], hi);
  // dark facet along the shadow edge
  q.poly([...dark, ...side(-1, 0.55).reverse()], lo === PAL.ink ? PAL.stone0 : lo);
}

/**
 * A flame tongue: tapered, wavy, nested heat layers (fire1 rim → fire2 → fire3 → fire4 core).
 * Drawn without outline (light). `ph` animates the wave.
 */
function flame(p: Canvas, base: Pt, dir: number, len: number, wid: number, ph: number, bright = 1): void {
  if (len < 1) return;
  const path = (L: number): Pt[] => {
    const out: Pt[] = [];
    const n = Math.max(3, Math.ceil(L / 2));
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const wob = Math.sin((ph - f * 0.9) * TAU) * f * f * wid * 0.9;
      out.push([base[0] + Math.cos(dir) * L * f - Math.sin(dir) * wob, base[1] + Math.sin(dir) * L * f + Math.cos(dir) * wob]);
    }
    return out;
  };
  p.stroke(path(len), wid + 1, 1, PAL.fire1);
  p.stroke(path(len * 0.92), wid, 1, bright > 0.6 ? PAL.fire2 : PAL.fire1);
  if (len > 3) p.stroke(path(len * 0.68), Math.max(1, wid * 0.62), 1, bright > 0.6 ? PAL.fire3 : PAL.fire2);
  if (len > 5 && bright > 0.4) p.stroke(path(len * 0.38), Math.max(1, wid * 0.3), 1, bright > 1.1 ? PAL.gold4 : PAL.fire4);
}

// ---------------------------------------------------------------- hand-pixelled heads (13×11)
// Facing right in 3/4: craggy crown lit from the top-left, a heavy brow shelf jutting over deep
// sockets with slanted ember eyes ('e' = hot core, 'E' = rim), a jagged glowing mouth with rock
// teeth ('r'/'R'/'g' lava, 't' tooth) and an underbite jaw.

const HEAD_N = [
  '....2.32....',
  '...1222332..',
  '..112222233.',
  '113333333333',
  '11Ekk000kkE2',
  '110eEk0kEe01',
  '1100kk0kk001',
  '1100r0R0r001',
  '.1000r0r0000',
  '..000000000.',
];
const HEAD_ROAR = [
  '....2.32....',
  '...1222332..',
  '..112222233.',
  '113333333333',
  '11Ekk000kkE2',
  '110eEk0kEe01',
  '1100kkkkk001',
  '110kRgggRk01',
  '.10kRgggRk00',
  '.100rRRRr000',
  '..00krrrk00.',
  '...0000000..',
];
const HEAD_HIT = [
  '....2.32....',
  '...1222332..',
  '..112222233.',
  '113333333333',
  '110kkk00kkk2',
  '110kEE0EEk01',
  '1100000000k1',
  '110kRRRRk001',
  '.1000kkk0000',
  '..000000000.',
];
const HEAD_GUARD = [
  '....2.32....',
  '...1222332..',
  '..112222233.',
  '113333333333',
  '110kkk00kkk2',
  '110eEk0kEe01',
  '1100kk0kk001',
  '1100r0r0r001',
  '.1000r0r0000',
  '..000000000.',
];

// ---------------------------------------------------------------- the rig

const UPPER = 14;
const FORE = 13;
const THIGH = 10;
const SHIN = 9;

// Torso in pelvis-local space (x right, y up = negative), before lean.
const TORSO: Pt[] = [
  [-9, 2],
  [-12, -4],
  [-16, -11],
  [-18, -18],
  [-18, -24],
  [-14, -29],
  [-6, -32],
  [4, -32],
  [12, -30],
  [17, -26],
  [21, -19],
  [20, -11],
  [15, -4],
  [10, 2],
];
/** Rock plates: [polygon, tone] (tone 1 = mid, 2 = lit, 0 = dark). */
const PLATES: [Pt[], 0 | 1 | 2][] = [
  [[[-18, -22], [-12, -22], [-8, -19], [-3, -18], [-3, -13], [-8, -12], [-11, -15], [-17, -14]], 2],
  [[[-15, -27], [-7, -31], [-3, -26], [-6, -22], [-12, -23]], 2],
  [[[7, -14], [20, -16], [20, -11], [15, -4], [13, -8], [9, -10]], 0],
  [[[-3, -9], [1, -8], [1, -3], [-8, -2], [-8, -6]], 2],
  [[[-12, 1], [13, 0], [14, 5], [-11, 6]], 0],
];
const CORE_L: Pt = [2, -15];
/** Lava seams (local polylines) radiating from the core; first point = hottest. */
const SEAMS: { pts: Pt[]; heat: number; ph: number }[] = [
  { pts: [[-2, -17], [-5, -19], [-8, -19], [-12, -22], [-17, -22]], heat: 1.1, ph: 0 },
  { pts: [[6, -18], [8, -22], [11, -23], [13, -27]], heat: 1.05, ph: 0.3 },
  { pts: [[-2, -12], [-4, -9], [-8, -7], [-10, -3], [-12, -1]], heat: 1.0, ph: 0.2 },
  { pts: [[6, -12], [9, -9], [13, -8], [15, -4]], heat: 1.0, ph: 0.75 },
  { pts: [[2, -10], [3, -6], [1, -3], [2, 0]], heat: 1.0, ph: 0.55 },
  { pts: [[7, -15], [12, -15], [15, -17], [20, -16]], heat: 0.95, ph: 0.9 },
  { pts: [[-8, -19], [-11, -15], [-16, -14]], heat: 0.6, ph: 0.45 },
  { pts: [[-11, 1], [-6, 0], [-1, 1], [5, 0], [12, 1]], heat: 0.75, ph: 0.4 },
];

/** Shoulder boulders, local to the shoulder joint (craggy top with a vent between the crags). */
const BOULDER_N: Pt[] = [
  [-9, 3], [-10, -2], [-8, -7], [-5, -9], [-3, -12], [-1, -9], [2, -9], [4, -12], [6, -8], [9, -5], [10, 0], [8, 5], [3, 7], [-4, 7],
];
const BOULDER_N_LIT: Pt[] = [
  [-9, 2], [-10, -2], [-8, -7], [-5, -9], [-3, -11], [-1, -8], [2, -8], [3, -5], [-1, -2], [-6, 1],
];
const BOULDER_F: Pt[] = [
  [-8, 3], [-9, -2], [-6, -7], [-3, -11], [-1, -8], [2, -8], [5, -11], [7, -6], [9, -1], [8, 4], [3, 6], [-4, 6],
];
const BOULDER_F_LIT: Pt[] = [[-8, 2], [-9, -2], [-6, -7], [-3, -10], [-1, -7], [0, -3], [-4, 0]];

function drawTitan(p: Canvas, o: Pose): void {
  const c = Math.cos(o.lean);
  const s = Math.sin(o.lean);
  /** Torso-local → frame px (lean around the pelvis, breathing lifts the chest). */
  const T = (x: number, y: number): Pt => {
    const lift = y < -8 ? o.breath * Math.min(1, (-y - 8) / 10) : 0;
    const Y = y - lift;
    return [o.px + x * c - Y * s, o.py + x * s + Y * c];
  };
  const tw = o.twist;
  const shN = T(-16 + tw * (tw < 0 ? 6 : 9), -25 - Math.max(0, tw));
  const shF = T(16 - tw * 2, -26);
  const hipN = T(-6, 2);
  const hipF = T(8, 2);
  const headPos = T(6 + o.hdx, -25 + o.hdy);
  const coreXY = T(CORE_L[0], CORE_L[1]);

  // ------------------------------------------------ seams
  const seamLine = (q: Canvas, pts: Pt[], heat: number, ph: number) => {
    // a glowing crack: hottest at its root, flickers with t; warm halo on the rock around it
    const lit: [number, number, number][] = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
      for (let k = 0; k <= n; k++) {
        const f = (i + k / n) / (pts.length - 1);
        const x = Math.floor(lerp(x0, x1, k / n));
        const y = Math.floor(lerp(y0, y1, k / n));
        const fl = 0.85 + 0.3 * Math.sin((o.t * 2 + ph + f * 0.7) * TAU) + (hash(x, y, Math.floor(o.t * 10)) - 0.5) * 0.25;
        const cd = Math.hypot(x - coreXY[0], y - coreXY[1]);
        const cl = Math.max(0, 1 - cd / 11) * o.core * 0.7;
        lit.push([x, y, o.seam * heat * fl * (1.2 - f * 0.6) + 0.4 + cl]);
      }
    }
    for (const [x, y, g] of lit) {
      if (g < 1.2) continue;
      for (const [dx, dy] of [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ])
        if (isRock(q.get(x + dx, y + dy))) q.set(x + dx, y + dy, g > 1.7 ? PAL.fire1 : PAL.fire0);
    }
    for (const [x, y, g] of lit) if (q.isOpaque(x, y)) q.set(x, y, lava(g));
  };

  // ------------------------------------------------ limbs
  const drawLeg = (q: Canvas, hip: Pt, foot: Pt, near: boolean, seed: number) => {
    const ank: Pt = [foot[0], foot[1] - 4];
    const [knee, an] = ik(hip[0], hip[1], ank[0], ank[1], THIGH, SHIN, 1);
    const mid = near ? PAL.stone1 : PAL.stone0;
    chunk(q, hip, knee, 13, 11, seed, near);
    chunk(q, knee, an, 11, 10, seed + 1, near);
    // foot: heavy slab, toes forward
    const fx = an[0];
    const fy = foot[1];
    q.poly([[fx - 6, fy - 5], [fx + 3, fy - 6], [fx + 7, fy - 4], [fx + 9, fy - 1], [fx + 9, fy], [fx - 7, fy]], mid);
    q.poly([[fx - 6, fy - 5], [fx + 3, fy - 6], [fx + 5, fy - 4], [fx - 6, fy - 3]], near ? PAL.stone2 : PAL.stone1);
    // knee cap boulder
    q.disc(knee[0] + 1, knee[1], 3.6, mid);
    q.disc(knee[0] + 0.5, knee[1] - 0.5, 2.2, near ? PAL.stone2 : PAL.stone1);
    rockLight(q, near);
    seamLine(q, [[knee[0] - 5, knee[1] + 3], [knee[0] - 1, knee[1] + 3.5], [knee[0] + 4, knee[1] + 3]], near ? 0.8 : 0.55, 0.33);
    seamLine(q, [[fx - 6, fy - 3], [fx, fy - 2.5], [fx + 4, fy - 3], [fx + 8, fy - 1]], near ? 0.6 : 0.4, 0.6);
    const m = lerpPt(hip, knee, 0.5);
    seamLine(q, [[m[0] - 2, m[1] - 3], [m[0], m[1]], [m[0] - 1, m[1] + 3]], near ? 0.55 : 0.4, 0.1);
  };

  const drawArm = (q: Canvas, sh: Pt, hand: Pt, fd: number, near: boolean, hot: number, seed: number) => {
    const bend: 1 | -1 = near ? 1 : -1;
    const [el, wr] = ik(sh[0], sh[1], hand[0], hand[1], UPPER, FORE, bend);
    const mid = near ? PAL.stone1 : PAL.stone0;
    const hi = near ? PAL.stone2 : PAL.stone1;
    chunk(q, sh, el, 12, 10, seed, near);
    chunk(q, el, wr, 10, 13, seed + 1, near);
    // elbow spur
    q.disc(el[0], el[1], 3.4, mid);
    q.set(el[0] - 1, el[1] - 2, hi).set(el[0] - 2, el[1] - 1, hi);
    // fist: a craggy block, knuckles toward fd, thumb on the light side
    const ux = Math.cos(fd);
    const uy = Math.sin(fd);
    // at the moment of impact the fist swells toward the camera (anime perspective smear)
    const fs = 1 + Math.max(0, hot - 0.7) * 0.7;
    const F = (u: number, v: number): Pt => [wr[0] + (ux * u - uy * v) * fs, wr[1] + (uy * u + ux * v) * fs];
    const fist = [F(-3, -6.5), F(2, -7.5), F(6, -6.5), F(8.5, -3.5), F(8.5, 3.5), F(6, 6.5), F(2, 7.5), F(-3, 6.5), F(-4.5, 0)];
    q.poly(fist, mid);
    // light facet: whichever half of the fist faces the top-left
    const litSide = -uy * -1 + ux * -1 > 0 ? 1 : -1; // sign of v toward the light
    q.poly([F(-2, 6 * litSide), F(2, 7 * litSide), F(6, 6 * litSide), F(8, 3 * litSide), F(6, 1.5 * litSide), F(-1, 2 * litSide)], hi);
    // knuckle bumps
    for (const v of [-4, 0, 4]) {
      const [kx, ky] = F(7.5, v);
      q.disc(kx, ky, 1.8, v * litSide > 0 ? hi : mid);
    }
    rockLight(q, near);
    // elbow seam, forearm crack, glowing finger seams
    const ed = Math.atan2(wr[1] - sh[1], wr[0] - sh[0]) + Math.PI / 2;
    const ex = Math.cos(ed) * 4.5;
    const ey = Math.sin(ed) * 4.5;
    seamLine(q, [[el[0] - ex, el[1] - ey], [el[0] + 0.5, el[1] + 0.5], [el[0] + ex, el[1] + ey]], near ? 0.85 : 0.6, 0.15);
    const m = lerpPt(el, wr, 0.5);
    seamLine(q, [lerpPt(el, wr, 0.25), [m[0] + 1, m[1] - 0.5], lerpPt(el, wr, 0.8)], near ? 0.75 : 0.5, 0.7);
    const fh = (near ? 0.85 : 0.65) + hot * 1.1;
    seamLine(q, [F(2, -2), F(5, -2), F(9, -2)], fh, 0.1);
    seamLine(q, [F(2, 2), F(5, 2), F(9, 2)], fh, 0.5);
    seamLine(q, [F(-1, -5), F(0, 0), F(-1, 5)], fh * 0.75, 0.3);
    if (hot > 0.5) {
      // white-hot knuckles
      for (const v of [-4, 0, 4]) {
        const [kx, ky] = F(8, v);
        q.set(kx, ky, hot > 0.9 ? PAL.gold4 : PAL.fire4);
        q.set(kx - ux, ky - uy, PAL.fire3);
      }
    }
  };

  const drawBoulder = (q: Canvas, sh: Pt, near: boolean) => {
    const B = near ? BOULDER_N : BOULDER_F;
    const BL = near ? BOULDER_N_LIT : BOULDER_F_LIT;
    const [x, y] = sh;
    const tr = (pts: Pt[]): Pt[] => pts.map(([u, v]) => [x + u, y + v]);
    q.poly(tr(B), near ? PAL.stone1 : PAL.stone0);
    q.poly(tr(BL), near ? PAL.stone2 : PAL.stone1);
    // dark underside
    q.poly(tr([[-9, 3], [9, 1], [8, 5], [3, 7], [-4, 7]]), near ? PAL.stone0 : PAL.stone0);
    rockLight(q, near);
    // glowing vent in the notch between the crags, a fissure running down the face, joint seam
    seamLine(q, tr([[-2, -8], [-1, -7], [1, -7], [2, -8]]), 1.3, 0.45);
    seamLine(q, tr([[1, -6], [3, -3], [2, 0], [4, 2]]), near ? 0.8 : 0.6, 0.15);
    seamLine(q, tr([[-8, 3], [-3, 4], [3, 4], [8, 2]]), near ? 0.7 : 0.5, 0.6);
  };

  // ------------------------------------------------ far arm (behind the body unless guarding)
  const farArm = () => {
    layer(p, (q) => drawArm(q, shF, o.fh, o.fd, false, 0, 40));
    layer(p, (q) => drawBoulder(q, shF, false));
  };
  if (!o.farFront) farArm();
  else layer(p, (q) => drawBoulder(q, shF, false));

  // ------------------------------------------------ far leg
  layer(p, (q) => drawLeg(q, hipF, o.ff, false, 20));

  // ------------------------------------------------ torso
  layer(p, (q) => {
    q.poly(TORSO.map(([x, y]) => T(x, y)), PAL.stone1);
    q.poly([T(-12, -1), T(12, -2), T(14, 4), T(9, 7), T(-9, 7), T(-13, 4)], PAL.stone1);
    for (const [pts, tone] of PLATES) q.poly(pts.map(([x, y]) => T(x, y)), [PAL.stone0, PAL.stone1, PAL.stone2][tone]);
    rockLight(q, true);
    for (const sm of SEAMS) seamLine(q, sm.pts.map(([x, y]) => T(x, y)), sm.heat, sm.ph);
    // molten core: dark socket, glowing magma, white heart when pulsing hard
    const [cx, cy] = T(CORE_L[0], CORE_L[1]);
    const k = o.core;
    q.disc(cx, cy, 5.2, PAL.ink);
    q.disc(cx, cy, 4.4, lava(0.45 + k * 0.3));
    q.disc(cx - 0.3, cy - 0.3, 3.4, lava(0.8 + k * 0.4));
    q.disc(cx - 0.5, cy - 0.5, 2.2, lava(1.2 + k * 0.5));
    q.disc(cx - 0.8, cy - 0.8, 1.2, lava(1.5 + k * 0.6));
    if (k > 1.4) q.set(cx - 1, cy - 1, PAL.white);
    // the socket's lower lip catches the glow
    for (const [dx, dy] of [
      [-3, 5],
      [-1, 5],
      [1, 5],
      [3, 4],
      [4, 3],
    ])
      if (isRock(q.get(cx + dx, cy + dy))) q.set(cx + dx, cy + dy, k > 1.2 ? PAL.fire1 : PAL.fire0);
  });

  if (o.farFront) layer(p, (q) => drawArm(q, shF, o.fh, o.fd, false, 0, 40));

  // ------------------------------------------------ near leg
  layer(p, (q) => drawLeg(q, hipN, o.nf, true, 10));

  // ------------------------------------------------ head (sunk between the shoulders)
  layer(p, (q) => {
    const rows = o.head === 'roar' ? HEAD_ROAR : o.head === 'hit' ? HEAD_HIT : o.head === 'guard' ? HEAD_GUARD : HEAD_N;
    const e = o.eye;
    const key: Record<string, number> = {
      k: PAL.ink,
      '0': PAL.stone0,
      '1': PAL.stone1,
      '2': PAL.stone2,
      '3': PAL.stone3,
      e: e > 1.5 ? PAL.white : e > 0.6 ? PAL.gold4 : PAL.fire2,
      E: e > 0.6 ? PAL.fire3 : PAL.fire1,
      r: lava(0.6 + o.seam * 0.45),
      R: lava(1.1 + o.core * 0.4),
      g: o.core > 1.5 ? PAL.gold4 : PAL.fire4,
      t: PAL.stone2,
    };
    q.stamp(rows, key, Math.round(headPos[0] - 6), Math.round(headPos[1] - 6));
  });

  // ------------------------------------------------ near arm (in front)
  layer(p, (q) => drawArm(q, shN, o.nh, o.nd, true, o.heat, 30));
  layer(p, (q) => drawBoulder(q, shN, true));

  // ------------------------------------------------ core light leaking through the gaps between the arms and chest
  if (o.farFront) {
    const [cx, cy] = coreXY;
    for (let y = Math.floor(cy - 8); y <= cy + 8; y++)
      for (let x = Math.floor(cx - 9); x <= cx + 9; x++) {
        if (p.get(x, y) !== PAL.ink) continue;
        const d = Math.hypot(x - cx, (y - cy) * 1.2);
        const g = o.core * (1 - d / 9.5);
        if (g > 0.55) p.set(x, y, PAL.fire3);
        else if (g > 0.3) p.set(x, y, PAL.fire2);
        else if (g > 0.1) p.set(x, y, PAL.fire1);
      }
  }

  // ------------------------------------------------ rock chips (get outlined)
  for (const ch of o.chips) {
    if (ch.hot) continue;
    // a craggy basalt shard with a lit facet and a still-glowing broken face
    const s2 = ch.s + 1;
    p.poly([[ch.x, ch.y + 0.5], [ch.x + s2 * 0.6, ch.y - 0.5], [ch.x + s2 + 0.5, ch.y + s2 * 0.5], [ch.x + s2 * 0.5, ch.y + s2], [ch.x - 0.5, ch.y + s2 * 0.7]], PAL.stone1);
    p.set(ch.x, ch.y, PAL.stone3);
    p.set(ch.x + 1, ch.y, PAL.stone2);
    if (ch.s > 1) p.set(ch.x + s2 * 0.5, ch.y + s2 - 1, PAL.fire3);
  }

  // ------------------------------------------------ outline
  p.outline(PAL.ink);

  // ------------------------------------------------ light pass (unoutlined glow)
  if (o.smear.length) {
    // the fist's swing smear: a hot arc thickening toward the fist
    const pts = [...o.smear, o.nh];
    for (let i = 0; i + 1 < pts.length; i++) {
      const n = 10;
      for (let k = 0; k <= n; k++) {
        const f = (i + k / n) / (pts.length - 1);
        const [x, y] = lerpPt(pts[i], pts[i + 1], k / n);
        const w = 0.5 + f * 6;
        for (let d = -w; d <= w; d += 0.5) {
          const yy = y + d;
          if (p.isOpaque(x, yy) && p.get(x, yy) !== PAL.ink) continue;
          const core = Math.abs(d) < w * 0.35;
          p.set(x, yy, core ? (f > 0.6 ? PAL.fire4 : PAL.fire3) : f > 0.5 ? PAL.fire2 : PAL.fire1);
        }
      }
    }
  }

  // chest beat: a hot impact star where the knuckles land on the pec
  if (o.beat) {
    const h = o.beat === 1 ? o.nh : o.fh;
    const d = o.beat === 1 ? o.nd : o.fd;
    const bx = Math.round(h[0] + Math.cos(d) * 8.5);
    const by = Math.round(h[1] + Math.sin(d) * 8.5);
    for (const [dx, dy, col] of [
      [0, 0, PAL.white],
      [1, 0, PAL.gold4],
      [-1, 0, PAL.gold4],
      [0, 1, PAL.gold4],
      [0, -1, PAL.gold4],
      [2, 0, PAL.fire4],
      [-2, 0, PAL.fire4],
      [0, -2, PAL.fire4],
      [0, 2, PAL.fire4],
      [0, -3, PAL.fire3],
      [0, 3, PAL.fire3],
      [3, -3, PAL.fire3],
      [-3, -3, PAL.fire3],
      [3, 3, PAL.fire2],
      [-3, 3, PAL.fire2],
    ] as const)
      p.set(bx + dx, by + dy, col);
  }

  // vent embers (always a little alive) and eruptions
  for (const [sh, side] of [
    [shF, 0],
    [shN, 1],
  ] as const) {
    const vx = sh[0];
    const vy = sh[1] - 9;
    if (o.flare > 0.05) {
      for (let i = 0; i < 3; i++) {
        const L = Math.min(vy - 2, o.flare * (6 + 4 * hash(i, Math.floor(o.t * 10), side)) * (i === 1 ? 1.35 : 0.9));
        flame(p, [vx + (i - 1) * 2.5, vy + (i === 1 ? 0 : 1)], -Math.PI / 2 + (i - 1) * 0.3, L, 3, o.t * 3 + i * 0.33, o.flare);
      }
    }
    for (let k = 0; k < 2; k++) {
      const ph = (o.t * 2 + k * 0.5 + side * 0.27) % 1;
      const ex = vx + Math.round(Math.sin((ph + k) * TAU) * 1.5) + (k ? 1 : -1);
      const ey = vy - 2 - Math.floor(ph * 10);
      if (!p.isOpaque(ex, ey)) p.set(ex, ey, ph < 0.4 ? PAL.fire4 : ph < 0.75 ? PAL.fire3 : PAL.fire2);
    }
  }

  // lava drips from the fists (form, stretch, fall)
  const drip = (src: Pt, ph: number) => {
    const t = (o.drip + ph) % 1;
    const [x, y] = [Math.round(src[0]), Math.round(src[1])];
    if (t < 0.55) {
      const L = Math.floor(t * 6);
      for (let i = 0; i <= L; i++) p.set(x, y + i, i === L ? PAL.fire3 : PAL.fire2);
    } else {
      const fy = y + 3 + Math.floor((t - 0.55) * 30);
      if (fy < GROUND) {
        p.set(x, fy, PAL.fire4);
        p.set(x, fy - 1, PAL.fire2);
      }
      p.set(x, y, PAL.fire2);
    }
  };
  if (!o.smear.length && o.burst === 0 && o.nd > 0.8 && o.nd < 2.4) drip([o.nh[0] + Math.cos(o.nd) * 10 + 1, o.nh[1] + Math.sin(o.nd) * 10], 0);
  if (!o.farFront && o.fd > 0.8 && o.fd < 2.4) drip([o.fh[0] + Math.cos(o.fd) * 10 - 1, o.fh[1] + Math.sin(o.fd) * 10], 0.45);

  // impact burst of magma off the knuckles
  if (o.burst > 0) {
    const ux = Math.cos(o.nd);
    const uy = Math.sin(o.nd);
    const kx = o.nh[0] + ux * 10;
    const ky = o.nh[1] + uy * 10;
    for (let i = 0; i < 7; i++) {
      const a = o.nd + (i - 3) * 0.45;
      flame(p, [kx - ux * 2, ky - uy * 2], a, o.burst * (4 + 3 * hash(i, 5)), 2.5, i * 0.17 + o.t, 1.5);
    }
    p.disc(kx, ky, 1.6 * o.burst + 0.5, PAL.gold4);
    if (o.burst > 0.8) p.disc(kx - 0.5, ky, 1, PAL.white);
  }

  // stomp: the planted foot cracks the ground, rock bits and lava spit out sideways
  if (o.stomp > 0) {
    const [fx, fy] = o.ff;
    const k = o.stomp;
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1;
      const d = 4 + (i >> 1) * 3 * k + 3;
      const x = Math.round(fx + 1 + side * d);
      const y = Math.round(fy - 1 - (i >> 1) * 1.6 * k - (k > 0.8 ? 1 : 0));
      if (!p.isOpaque(x, y)) p.set(x, y, i < 2 ? PAL.fire4 : i < 4 ? PAL.fire3 : PAL.stone2);
    }
    for (let x = -6; x <= 8; x++) if (!p.isOpaque(fx + x, fy)) p.set(fx + x, fy, Math.abs(x) < 4 ? PAL.fire3 : PAL.fire1);
  }

  // hot embers off the hit
  for (const ch of o.chips) if (ch.hot) p.set(ch.x, ch.y, PAL.fire4).set(ch.x - 1, ch.y + 1, PAL.fire3).set(ch.x - 2, ch.y + 2, PAL.fire1);
}

// ---------------------------------------------------------------- portrait (44×34)

function portrait(p: Canvas): void {
  // volcanic sky: deep red, a hot halo behind the titan, a glowing lava horizon
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 44; x++) {
      const d = Math.hypot((x - 22) * 0.8, y - 17);
      let col: number = PAL.fire0;
      if (d < 17) col = PAL.fire1;
      if (y >= 31) col = y >= 33 ? PAL.fire3 : PAL.fire2;
      p.set(x, y, col);
    }
  // distant crags on the horizon
  for (let x = 0; x < 44; x++) {
    const hgt = Math.round(2 + 2 * Math.abs(Math.sin(x * 0.45)) + (x % 7 === 3 ? 2 : 0));
    for (let y = 31 - hgt; y < 31; y++) p.set(x, y, PAL.stone0);
  }
  const big = new PixelCanvas(W, H);
  drawTitan(big, P({ core: 1.9, seam: 1.6, eye: 2, flare: 0.9, t: 0.35, nh: [15, 52], fh: [61, 50] }));
  const ox = 17;
  const oy = 11;
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 44; x++) {
      const col = big.get(ox + x, oy + y);
      if (col !== null) p.set(x, y, col);
    }
  for (const [x, y, c] of [
    [2, 5, PAL.fire3],
    [6, 13, PAL.fire2],
    [41, 3, PAL.fire3],
    [38, 9, PAL.fire2],
    [42, 15, PAL.fire4],
    [3, 20, PAL.fire4],
  ] as const)
    if (p.get(x, y) === PAL.fire0 || p.get(x, y) === PAL.fire1) p.set(x, y, c);
}

// ---------------------------------------------------------------- export

const IMPACT_FRAME = 5;
const IMPACT = ANIMS.attack.poses[IMPACT_FRAME];

const art: MonsterArt = {
  id: 'magma_titan',
  w: W,
  h: H,
  anchorX: 39,
  anchorY: GROUND,
  hover: 0,
  muzzle: { x: Math.round(IMPACT.nh[0] + Math.cos(IMPACT.nd) * 10), y: Math.round(IMPACT.nh[1] + Math.sin(IMPACT.nd) * 10) },
  core: { x: 39, y: 41 },
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
    drawTitan(p, poses[Math.max(0, Math.min(poses.length - 1, frame))]);
  },
  portrait,
};

export default art;
