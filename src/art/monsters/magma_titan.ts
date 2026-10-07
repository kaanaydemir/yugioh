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

type Expr = 'n' | 'blaze' | 'snarl' | 'roar' | 'hit' | 'guard';

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
  /** Head offset (torso-local) and expression. */
  hdx: number;
  hdy: number;
  head: Expr;
  /** Absolute head center (frame px) — overrides the torso-attached position (punch frames). */
  hxy: Pt | null;
  /** Head painted over the near shoulder (punch: the face pokes out ahead of the shoulder line). */
  headFront: boolean;
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
  hxy: null,
  headFront: false,
  // 3/4 stance facing right: near fist hangs forward with the knuckles angled at the foe, the far
  // fist hangs behind the chest, far foot planted ahead.
  nh: [21, 56],
  nd: 1.15,
  fh: [60, 55],
  fd: 1.4,
  farFront: false,
  nf: [28, GROUND],
  ff: [51, GROUND],
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
  // Breathing straight from the sine at 1px resolution: the chest leads, the pelvis settles a frame
  // later and the hanging fists lag one more frame, so the 1px steps are spread over the cycle
  // (no frame moves every part at once) and the parts move rigidly (no edge shimmer).
  const s = Math.sin(t * TAU); // + = inhale (chest up)
  const lag1 = Math.sin((t - 1 / n) * TAU);
  const lag2 = Math.sin((t - 2 / n) * TAU);
  return P({
    breath: Math.round(1.3 * s),
    py: N.py + Math.round(0.5 - 0.6 * lag1),
    nh: [N.nh[0], N.nh[1] + Math.round(-1.1 * lag2)],
    fh: [N.fh[0], N.fh[1] + Math.round(-1.1 * lag2)],
    core: 1 + 0.55 * s,
    seam: 1 + 0.25 * Math.sin((t + 0.15) * TAU),
    drip: t,
    // a slow ember blink
    eye: f === 6 ? 0.5 : 1,
    t,
  });
}

/** Idle frame 0 — every one-shot starts from it and returns to it (no pop when switching anims). */
const IDLE0 = idlePose(0, 8);
const I0 = (o: Partial<Pose>): Pose => ({ ...IDLE0, ...o });

const ANIMS: Record<MonsterAnim, { fps: number; loop: boolean; poses: Pose[] }> = {
  idle: { fps: 7, loop: true, poses: Array.from({ length: 8 }, (_, f) => idlePose(f, 8)) },

  // Roar: hunch and gather (anticipation) → rise, fists thrown high, head back, shoulder vents
  // erupt → pound the chest (near, far, near — the core flashes on every beat) → settle.
  roar: {
    fps: 10,
    loop: false,
    poses: [
      I0({ t: 0.0 }),
      P({ py: 58, lean: 0.1, hdy: 1, nh: [23, 60], nd: 1.3, fh: [57, 60], core: 0.5, seam: 0.6, eye: 0.8, t: 0.1 }),
      P({ py: 55, lean: -0.06, head: 'blaze', nh: [16, 40], nd: -2.1, fh: [66, 38], fd: -0.9, core: 1.4, seam: 1.3, eye: 1.6, flare: 0.5, t: 0.2 }),
      P({ py: 54, lean: -0.12, hdx: -1, hdy: -2, head: 'roar', nh: [13, 13], nd: -1.85, fh: [66, 12], fd: -1.25, core: 2, seam: 2, eye: 2, flare: 1.3, t: 0.3 }),
      P({ py: 54, lean: -0.13, hdx: -1, hdy: -2, head: 'roar', nh: [12, 13], nd: -1.85, fh: [67, 12], fd: -1.25, core: 2, seam: 1.8, eye: 2, flare: 1.6, t: 0.4 }),
      P({ py: 56, lean: 0.04, head: 'roar', nh: [27, 40], nd: 0.15, fh: [66, 24], fd: -1.0, core: 2.3, seam: 2, eye: 2, flare: 1.2, beat: 1, t: 0.5 }),
      P({ py: 56, lean: 0.02, head: 'roar', nh: [14, 35], nd: -2.2, fh: [53, 39], fd: Math.PI - 0.15, farFront: true, core: 2.3, seam: 1.9, eye: 2, flare: 1.1, beat: 2, t: 0.6 }),
      P({ py: 56, lean: 0.04, head: 'roar', nh: [27, 40], nd: 0.15, fh: [66, 26], fd: -1.0, core: 2.3, seam: 2, eye: 2, flare: 1.0, beat: 1, t: 0.7 }),
      P({ py: 56, lean: 0.02, head: 'blaze', nh: [22, 51], nd: 1.5, fh: [60, 47], fd: 1.2, core: 1.4, seam: 1.3, eye: 1.4, flare: 0.4, t: 0.8 }),
      I0({ core: 1.1, seam: 1.1, flare: 0.1, t: 0.9 }),
    ],
  },

  // Attack ("Lav Yumruğu"): rear back, near fist cocked high behind the shoulder (anticipation,
  // core charging, fist heating up) → stomp forward and swing (smear) → IMPACT: arm fully extended
  // at chest height, knuckles white-hot, face snarling over the shoulder → hold → follow-through →
  // recover. The face stays visible on every frame (f4–f7 it rides over the near shoulder).
  attack: {
    fps: 12,
    loop: false,
    poses: [
      I0({ t: 0 }),
      P({ px: 38, lean: -0.08, twist: -0.5, head: 'blaze', nh: [21, 46], nd: 2.6, fh: [59, 47], fd: -0.6, ff: [52, 75], core: 1.3, seam: 1.2, eye: 1.3, heat: 0.25, t: 0.1 }),
      P({ px: 37, py: 57, lean: -0.16, twist: -1, hdx: -1, head: 'blaze', nh: [21, 25], nd: -2.0, fh: [58, 43], fd: -0.4, ff: [53, 73], nf: [27, GROUND], core: 1.8, seam: 1.5, eye: 1.6, flare: 0.25, heat: 0.55, t: 0.2 }),
      P({ px: 37, py: 57, lean: -0.18, twist: -1, hdx: -1, head: 'blaze', nh: [20, 24], nd: -2.05, fh: [58, 43], fd: -0.4, ff: [53, 73], nf: [27, GROUND], core: 2, seam: 1.7, eye: 1.8, flare: 0.4, heat: 0.8, t: 0.3 }),
      P({ px: 39, py: 57, lean: 0.1, twist: 0.4, head: 'blaze', hxy: [48, 27], headFront: true, nh: [45, 38], nd: -0.15, fh: [53, 50], fd: 2.6, ff: [55, GROUND], nf: [26, GROUND], core: 2, seam: 1.6, eye: 2, flare: 0.4, heat: 0.75,
        smear: [[17, 21], [20, 13], [29, 10], [39, 15], [45, 26]], stomp: 1, t: 0.4 }),
      P({ px: 41, py: 57, lean: 0.2, twist: 1, head: 'snarl', hxy: [52, 26], headFront: true, nh: [64, 40], nd: 0.05, fh: [51, 52], fd: 2.4, ff: [56, GROUND], nf: [25, GROUND], core: 2, seam: 2, eye: 2, flare: 0.6, heat: 1, burst: 1,
        stomp: 0.6, t: 0.5 }),
      P({ px: 41, py: 57, lean: 0.21, twist: 1, head: 'snarl', hxy: [52, 26], headFront: true, nh: [65, 41], nd: 0.05, fh: [51, 52], fd: 2.4, ff: [56, GROUND], nf: [25, GROUND], core: 1.8, seam: 1.8, eye: 2, flare: 0.4, heat: 0.85, burst: 0.6, t: 0.6 }),
      P({ px: 40, py: 57, lean: 0.14, twist: 0.7, head: 'blaze', hxy: [50, 28], headFront: true, nh: [62, 47], nd: 0.6, fh: [54, 52], fd: 2.0, ff: [55, GROUND], nf: [26, GROUND], core: 1.5, seam: 1.4, eye: 1.6, heat: 0.45, burst: 0.25, t: 0.7 }),
      P({ px: 38, py: 57, lean: 0.05, twist: 0.2, nh: [31, 56], nd: 1.4, fh: [59, 54], fd: 1.6, ff: [52, GROUND], core: 1.2, seam: 1.1, eye: 1.2, heat: 0.15, t: 0.8 }),
      I0({ t: 0.9 }),
    ],
  },

  // Hit: rocked back, head snaps, seams flash, rock chips and embers burst off the chest; recover.
  hit: {
    fps: 10,
    loop: false,
    poses: [
      P({ px: 35, lean: -0.17, head: 'hit', hdx: -1, nh: [19, 53], nd: 2.3, fh: [64, 48], fd: -0.2, core: 0.4, seam: 2, eye: 0.3,
        chips: [{ x: 63, y: 29, s: 3 }, { x: 67, y: 37, s: 2 }, { x: 60, y: 23, s: 2 }, { x: 67, y: 30, s: 1, hot: true }, { x: 64, y: 41, s: 1, hot: true }], t: 0.1 }),
      P({ px: 34, lean: -0.13, head: 'hit', nh: [16, 55], nd: 2.0, fh: [63, 51], fd: 0.4, core: 0.7, seam: 1.5, eye: 0.3,
        chips: [{ x: 68, y: 24, s: 3 }, { x: 72, y: 34, s: 2 }, { x: 64, y: 16, s: 2 }, { x: 73, y: 26, s: 1, hot: true }, { x: 70, y: 41, s: 1, hot: true }], t: 0.2 }),
      P({ px: 35, lean: -0.07, nh: [18, 57], nd: 1.6, fh: [62, 54], fd: 1.0, core: 0.9, seam: 1.2, eye: 0.9,
        chips: [{ x: 72, y: 23, s: 2 }, { x: 74, y: 36, s: 1 }, { x: 67, y: 13, s: 1 }, { x: 76, y: 28, s: 1, hot: true }], t: 0.3 }),
      I0({ px: 36, lean: -0.02, t: 0.4 }),
    ],
  },

  // Guard: crouched, forearms crossed in an X over the core (its glow leaks through the V), the
  // head hunkered down between the shoulders with the ember eyes peering over the arms; seams
  // banked, slow continuous breathing.
  guard: {
    fps: 4,
    loop: true,
    poses: [0, 1, 2, 3].map((f) => {
      const t = f / 4;
      const s = Math.sin(t * TAU);
      const lag = Math.sin((t - 0.25) * TAU);
      return P({
        py: 58,
        lean: 0.06,
        twist: 0.4,
        breath: Math.round(0.9 * s),
        head: 'guard',
        hdy: -3,
        nh: [44, 44 - Math.round(0.8 * lag)],
        nd: -0.75,
        fh: [31, 44 - Math.round(0.8 * lag)],
        fd: -2.4,
        farFront: true,
        nf: [27, GROUND],
        ff: [51, GROUND],
        core: 1.45 + 0.3 * s,
        seam: 0.85 + 0.12 * s,
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
const norm = (x: number, y: number): Pt => {
  const d = Math.hypot(x, y) || 1;
  return [x / d, y / d];
};
/** Point at arc length d along a polyline with cumulative lengths cum. */
function along(path: Pt[], cum: number[], d: number): Pt {
  let i = 0;
  while (i + 2 < path.length && cum[i + 1] < d) i++;
  const seg = cum[i + 1] - cum[i] || 1;
  return lerpPt(path[i], path[i + 1], Math.max(0, Math.min(1, (d - cum[i]) / seg)));
}

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
 * A flame tongue: a curved teardrop (broad root → 1px tip) with nested heat — fire2 fringe →
 * fire3 body → fire4 core → gold4 at the root when very hot. Light: no outline, stray single
 * pixels dropped, never paints a cooler flame tone over a hotter one. `curl` bends the tongue
 * along its length (rad), `ph` sways it.
 */
function tongue(p: Canvas, base: Pt, dir: number, len: number, wid: number, curl: number, ph: number, heat = 1, behind: Canvas | null = null): void {
  if (len < 2) return;
  const n = Math.max(4, Math.ceil(len / 1.4));
  const C: Pt[] = [];
  {
    let a = dir + Math.sin(ph * TAU) * 0.12;
    let [x, y] = base;
    for (let i = 0; i <= n; i++) {
      C.push([x, y]);
      a += curl / n + Math.sin((ph - i / n) * TAU) * 0.05;
      x += (Math.cos(a) * len) / n;
      y += (Math.sin(a) * len) / n;
    }
  }
  const shape = (k: number, wk: number): Pt[] => {
    const m = Math.max(2, Math.round(n * k));
    const left: Pt[] = [];
    const right: Pt[] = [];
    for (let i = 0; i <= m; i++) {
      const f = i / m;
      const [x0, y0] = C[Math.max(0, i - 1)];
      const [x1, y1] = C[Math.min(m, i + 1)];
      const d = Math.hypot(x1 - x0, y1 - y0) || 1;
      const nx = -(y1 - y0) / d;
      const ny = (x1 - x0) / d;
      const w = ((wid * wk) / 2) * (f < 0.3 ? 0.85 + f * 0.5 : Math.pow((1 - f) / 0.7, 0.8));
      left.push([C[i][0] + nx * w, C[i][1] + ny * w]);
      right.push([C[i][0] - nx * w, C[i][1] - ny * w]);
    }
    return [...left, ...right.reverse()];
  };
  const t = new PixelCanvas(p.w, p.h);
  t.poly(shape(1, 1), heat > 0.35 ? PAL.fire2 : PAL.fire1);
  if (len > 3) t.poly(shape(0.72, 0.6), heat > 0.35 ? PAL.fire3 : PAL.fire2);
  if (len > 5 && heat > 0.55) t.poly(shape(0.42, 0.34), heat > 1.3 ? PAL.gold4 : PAL.fire4);
  for (let y = 0; y < t.h; y++)
    for (let x = 0; x < t.w; x++) {
      const c = t.get(x, y);
      if (c === null) continue;
      if (!t.isOpaque(x - 1, y) && !t.isOpaque(x + 1, y) && !t.isOpaque(x, y - 1) && !t.isOpaque(x, y + 1)) continue;
      if (behind && near4(behind, x, y)) continue;
      const cur = p.get(x, y);
      if (cur !== null && FIRE_RANK(cur) > FIRE_RANK(c)) continue;
      p.set(x, y, c);
    }
}

function FIRE_RANK(c: number): number {
  switch (c) {
    case PAL.fire1:
      return 1;
    case PAL.fire2:
      return 2;
    case PAL.fire3:
      return 3;
    case PAL.fire4:
      return 4;
    case PAL.gold4:
      return 5;
    case PAL.white:
      return 6;
    default:
      return 0;
  }
}

/** True if (x, y) or one of its 4-neighbours is opaque in m (a part plus its outline ring). */
function near4(m: Canvas, x: number, y: number): boolean {
  return m.isOpaque(x, y) || m.isOpaque(x - 1, y) || m.isOpaque(x + 1, y) || m.isOpaque(x, y - 1) || m.isOpaque(x, y + 1);
}

/** Paint a disc only onto pixels that already exist. */
function paintDisc(q: Canvas, cx: number, cy: number, r: number, c: number): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r * r) q.paint(x, y, c);
    }
}

/** Bresenham line painted only onto existing pixels. */
function paintLine(q: Canvas, x0: number, y0: number, x1: number, y1: number, c: number): void {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    q.paint(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

// ---------------------------------------------------------------- hand-pixelled heads (13×11)
// 3/4 view facing right: a craggy skull block lit from the top-left, a heavy brow slab jutting
// forward over deep ink sockets with 2×1 ember slits ('E' rim / 'e' hot center), and a wide lava
// jaw crack ('m' fire2 lip, 'M' fire3 body, 'g' fire4/gold4 core). 'x' = eye glow spilling onto
// the cheek (only when blazing), 't' = rock fang.

const HEAD_N = [
  '.2232.11221..',
  '233321r123321',
  '2333221r22222',
  '23321333333334',
  '2321000k000000',
  '2221kEEk00EEk.',
  '12210000000k..',
  '1221mMMMMMMm00',
  '.11100000000k.',
  '..1100000000..',
];
const HEAD_BLAZE = [
  '.2232.11221..',
  '233321r123321',
  '2333221r22222',
  '23321333333334',
  '23210kkk0kkkk0',
  '2221kEek0eEk..',
  '12210xx00xxk..',
  '1221mMMgMMMm00',
  '.11100000000k.',
  '..1100000000..',
];
const HEAD_SNARL = [
  '.2232.11221..',
  '233321r123321',
  '2333221r22222',
  '23321333333334',
  '23210kkk0kkkk0',
  '2221kEek0eEk..',
  '12210xx00xxk..',
  '1221mtMMMMtmk0',
  '122kMggggggMk0',
  '.11kmMMMMMMmk.',
  '..1100000000..',
];
const HEAD_ROAR = [
  '.2232.11221..',
  '233321r123321',
  '2333221r22222',
  '23321333333334',
  '2321000k000000',
  '2221kEek0eEk..',
  '12210xx00xxk..',
  '1221mtMMMMMtm0',
  '122kMgggggggMk',
  '122kMggggggMk.',
  '.11kmMMMMMMk..',
  '..11000000k...',
];
const HEAD_HIT = [
  '.2232.11221..',
  '233321r123321',
  '2333221r22222',
  '23321333333334',
  '23210kkk0kkkk0',
  '2221kmEk0mEk..',
  '12210000000k..',
  '1221mkMMkMkm00',
  '.11100000000k.',
  '..1100000000..',
];
const HEAD_GUARD = [
  '.2232.11221..',
  '233321r123321',
  '2333221r22222',
  '23321333333334',
  '23210kkk0kkkk0',
  '2221kkEk0kEk..',
  '12210000000k..',
  '12210mMMMMm000',
  '.11100000000k.',
  '..1100000000..',
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
/**
 * Lava fissures (local control polylines) radiating from the core; first point = root (widest,
 * hottest). w0/w1 = root/tip width, forks = side branches.
 */
const SEAMS: { pts: Pt[]; heat: number; ph: number; w0: number; w1: number; forks: number }[] = [
  { pts: [[-2, -17], [-6, -19], [-12, -21], [-17, -22]], heat: 1.1, ph: 0, w0: 2.4, w1: 0.9, forks: 1 },
  { pts: [[6, -18], [9, -23], [13, -27]], heat: 1.05, ph: 0.3, w0: 2.2, w1: 0.9, forks: 1 },
  { pts: [[-2, -12], [-6, -8], [-10, -3], [-12, -1]], heat: 1.0, ph: 0.2, w0: 2.2, w1: 0.9, forks: 1 },
  { pts: [[6, -12], [10, -9], [15, -5]], heat: 1.0, ph: 0.75, w0: 2, w1: 0.9, forks: 0 },
  { pts: [[2, -10], [2, -5], [1, 0]], heat: 1.0, ph: 0.55, w0: 1.9, w1: 1, forks: 1 },
  { pts: [[7, -15], [13, -16], [20, -15]], heat: 0.95, ph: 0.9, w0: 1.9, w1: 0.9, forks: 0 },
  { pts: [[-10, 2], [-3, 1.5], [5, 2.5], [12, 1.5]], heat: 0.75, ph: 0.4, w0: 1.3, w1: 1, forks: 1 },
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
/** The far shoulder is turned away (3/4 view): drawn smaller and darker behind the head. */
const FAR_K = 0.82;

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
  const shN = T(-16 + tw * (tw < 0 ? 3 : 7), -25 - Math.max(0, tw));
  const shF = T(13 - tw * 2, -27);
  const hipN = T(-6, 2);
  const hipF = T(8, 2);
  const headPos: Pt = o.hxy ?? T(9 + o.hdx, -24 + o.hdy);
  const coreXY = T(CORE_L[0], CORE_L[1]);

  // ------------------------------------------------ lava fissures
  /**
   * A jagged lava fissure painted onto the rock of layer q: the control polyline is broken into
   * 3–5 px zig-zag segments, width tapers root → tip with pinches and swells, forks branch off.
   * Thin parts are a 1px fire3 thread; wide parts get a fire2 lip around the fire3 body and a
   * fire4 (gold4 when very hot) core. Heat follows the pose's seam glow and flickers.
   */
  const crack = (q: Canvas, pts: Pt[], heat: number, ph: number, w0 = 1.6, w1 = 0.9, seed = 1, forks = 0) => {
    const path: Pt[] = [pts[0]];
    let zi = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const L = Math.hypot(bx - ax, by - ay) || 1;
      const n = Math.max(1, Math.round(L / 3.6));
      const nx = -(by - ay) / L;
      const ny = (bx - ax) / L;
      for (let k = 1; k <= n; k++) {
        const f = k / n;
        const j = k === n ? 0 : (zi++ % 2 ? 1 : -1) * (0.6 + 0.6 * hash(seed, zi, 3));
        path.push([ax + (bx - ax) * f + nx * j, ay + (by - ay) * f + ny * j]);
      }
    }
    const cum = [0];
    for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    const total = cum[cum.length - 1] || 1;
    const fl = 0.9 + 0.2 * Math.sin((o.t * 2 + ph) * TAU) + (hash(seed, Math.floor(o.t * 10), 5) - 0.5) * 0.12;
    const g0 = o.seam * heat * fl;
    const body = (g: number) => (g > 1.6 ? PAL.fire4 : g > 0.8 ? PAL.fire3 : g > 0.5 ? PAL.fire2 : PAL.fire1);
    const lip = (g: number) => (g > 1.6 ? PAL.fire3 : g > 0.5 ? PAL.fire2 : PAL.fire1);
    const hot = (g: number) => (g > 1.75 ? PAL.gold4 : g > 0.7 ? PAL.fire4 : PAL.fire3);
    const gAt = (d: number) => g0 * (1.15 - 0.4 * (d / total));
    const wAt = (d: number) => lerp(w0, w1, d / total) * (0.72 + 0.56 * hash(seed, Math.floor(d / 2.4), 9));
    // lips around the wide stretches
    for (let d = 0; d <= total; d += 0.5) {
      const w = wAt(d);
      if (w < 1.5) continue;
      const [x, y] = along(path, cum, d);
      paintDisc(q, x, y, w / 2, lip(gAt(d)));
    }
    // the 1px thread
    for (let i = 0; i + 1 < path.length; i++) {
      const d = (cum[i] + cum[i + 1]) / 2;
      paintLine(q, path[i][0], path[i][1], path[i + 1][0], path[i + 1][1], body(gAt(d)));
    }
    // white-hot heart where the fissure is widest
    for (let d = 0; d <= total; d += 0.5) {
      if (wAt(d) < 2.1) continue;
      const [x, y] = along(path, cum, d);
      q.paint(x, y, hot(gAt(d)));
    }
    // forks: short thin branches splitting off at an angle
    for (let k = 0; k < forks; k++) {
      const d = total * (0.35 + 0.3 * hash(seed, k, 21));
      const [x, y] = along(path, cum, d);
      const [x2, y2] = along(path, cum, Math.min(total, d + 1));
      const a = Math.atan2(y2 - y, x2 - x) + (hash(seed, k, 22) > 0.5 ? 1 : -1) * (0.6 + 0.4 * hash(seed, k, 23));
      const L = 2.5 + 2 * hash(seed, k, 24);
      const mx = x + Math.cos(a) * L * 0.5 + Math.cos(a + 1.57) * 0.6;
      const my = y + Math.sin(a) * L * 0.5 + Math.sin(a + 1.57) * 0.6;
      const col = body(gAt(d) * 0.8);
      paintLine(q, x, y, mx, my, col);
      paintLine(q, mx, my, x + Math.cos(a) * L, y + Math.sin(a) * L, col);
    }
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
    const k = near ? 1.15 : 0.8;
    // thigh: a fissure running down the outer face; shin: a split up the front; toe crack
    const [ux, uy] = norm(knee[0] - hip[0], knee[1] - hip[1]);
    crack(q, [[hip[0] - uy * 3 + ux * 1, hip[1] + ux * 3 + uy * 1], lerpPt(hip, knee, 0.55), [knee[0] - 2, knee[1] - 2]], 0.75 * k, 0.1, 1.6, 0.8, seed * 7 + 1, 1);
    const [vx, vy] = norm(an[0] - knee[0], an[1] - knee[1]);
    crack(q, [[knee[0] + 1 + vx * 3, knee[1] + vy * 3], [an[0] + 1.5 - vy, an[1] - 1]], 0.65 * k, 0.33, 1.4, 0.8, seed * 7 + 2, 0);
    crack(q, [[fx + 1, fy - 4.5], [fx + 4, fy - 2.5], [fx + 7, fy - 2]], 0.6 * k, 0.6, 1.2, 0.8, seed * 7 + 3, 0);
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
    // fissures along the bones (never straight bands across the limb)
    const [ax, ay] = norm(el[0] - sh[0], el[1] - sh[1]);
    crack(q, [[sh[0] + ax * 3 - ay * 2.5, sh[1] + ay * 3 + ax * 2.5], lerpPt(sh, el, 0.6), [el[0] - ay * 1.5, el[1] + ax * 1.5]], near ? 0.95 : 0.65, 0.15, 1.6, 0.8, seed * 5 + 1, 1);
    const [bx, by] = norm(wr[0] - el[0], wr[1] - el[1]);
    crack(q, [[el[0] + bx * 2.5 + by * 1.5, el[1] + by * 2.5 - bx * 1.5], lerpPt(el, wr, 0.55), [wr[0] - bx * 2 - by * 2, wr[1] - by * 2 + bx * 2]], near ? 0.9 : 0.6, 0.7, 1.7, 0.8, seed * 5 + 2, 1);
    // finger gaps glow (short, along the fist)
    const fh = (near ? 0.8 : 0.6) + hot * 0.9;
    crack(q, [F(3.5, -2), F(8.5, -2)], fh, 0.1, 1, 1, seed * 5 + 3, 0);
    crack(q, [F(3.5, 2), F(8.5, 2)], fh, 0.5, 1, 1, seed * 5 + 4, 0);
    if (hot > 0.15) {
      // heat: the fist turns molten from the knuckles back — fire2 fringe, fire3 body, fire4 and
      // gold4 at the knuckles, white-hot knuckle tips at the moment of impact
      const xs = fist.map((pt) => pt[0]);
      const ys = fist.map((pt) => pt[1]);
      const mask = new PixelCanvas(q.w, q.h).poly(fist, 1);
      for (const v of [-4, 0, 4]) {
        const [kx, ky] = F(7.5, v);
        mask.disc(kx, ky, 1.8 * fs, 1);
      }
      const [gx, gy] = F(6.5, 0);
      const R = 9.5 * fs;
      for (let y = Math.floor(Math.min(...ys)) - 2; y <= Math.max(...ys) + 2; y++)
        for (let x = Math.floor(Math.min(...xs)) - 2; x <= Math.max(...xs) + 2; x++) {
          if (!mask.isOpaque(x, y) || !q.isOpaque(x, y)) continue;
          const u = ((x + 0.5 - wr[0]) * ux + (y + 0.5 - wr[1]) * uy) / fs;
          const v = (-(x + 0.5 - wr[0]) * uy + (y + 0.5 - wr[1]) * ux) / fs;
          const groove = Math.abs(Math.abs(v) - 2) < 0.6 && u > 2.5;
          const d = Math.hypot(x + 0.5 - gx, y + 0.5 - gy) / R;
          const h = hot * (1.3 - d * 1.1) - (groove ? 0.2 : 0);
          let col: number | null = null;
          if (h > 0.98) col = PAL.gold4;
          else if (h > 0.74) col = PAL.fire4;
          else if (h > 0.48) col = PAL.fire3;
          else if (h > 0.26) col = PAL.fire2;
          if (col !== null) q.set(x, y, col);
        }
      if (hot > 0.9)
        for (const v of [-4, 0, 4]) {
          const [kx, ky] = F(8.6, v);
          q.paint(kx, ky, PAL.white);
        }
    }
  };

  const drawBoulder = (q: Canvas, sh: Pt, near: boolean) => {
    const B = near ? BOULDER_N : BOULDER_F;
    const BL = near ? BOULDER_N_LIT : BOULDER_F_LIT;
    const k = near ? 1 : FAR_K;
    const [x, y] = sh;
    const tr = (pts: Pt[]): Pt[] => pts.map(([u, v]) => [x + u * k, y + v * k]);
    q.poly(tr(B), near ? PAL.stone1 : PAL.stone0);
    q.poly(tr(BL), near ? PAL.stone2 : PAL.stone1);
    // dark underside
    q.poly(tr([[-9, 3], [9, 1], [8, 5], [3, 7], [-4, 7]]), PAL.stone0);
    rockLight(q, near);
    // glowing vent in the notch between the crags, a fissure splitting the face
    crack(q, tr([[-2, -8], [0, -7.5], [2, -8]]), 1.3, 0.45, 2.2, 1.6, near ? 61 : 62, 0);
    crack(q, tr([[1, -6], [3, -2], [2, 2], [5, 4]]), near ? 0.8 : 0.6, 0.15, 1.6, 0.8, near ? 63 : 64, 1);
    crack(q, tr([[-8, 2], [-5, 4], [-1, 4.5]]), near ? 0.65 : 0.45, 0.6, 1.2, 0.8, near ? 65 : 66, 0);
  };

  // ------------------------------------------------ far arm (behind the body unless guarding)
  if (!o.farFront) layer(p, (q) => drawArm(q, shF, o.fh, o.fd, false, 0, 40));
  layer(p, (q) => drawBoulder(q, shF, false));

  // ------------------------------------------------ far leg
  layer(p, (q) => drawLeg(q, hipF, o.ff, false, 20));

  // ------------------------------------------------ torso
  layer(p, (q) => {
    q.poly(TORSO.map(([x, y]) => T(x, y)), PAL.stone1);
    q.poly([T(-12, -1), T(12, -2), T(14, 4), T(9, 7), T(-9, 7), T(-13, 4)], PAL.stone1);
    for (const [pts, tone] of PLATES) q.poly(pts.map(([x, y]) => T(x, y)), [PAL.stone0, PAL.stone1, PAL.stone2][tone]);
    rockLight(q, true);
    SEAMS.forEach((sm, i) => crack(q, sm.pts.map(([x, y]) => T(x, y)), sm.heat, sm.ph, sm.w0, sm.w1, 100 + i, sm.forks));
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
      if (isRock(q.get(cx + dx, cy + dy))) q.set(cx + dx, cy + dy, k > 1.2 ? PAL.fire2 : PAL.fire1);
  });

  if (o.farFront) layer(p, (q) => drawArm(q, shF, o.fh, o.fd, false, 0, 40));

  // ------------------------------------------------ near leg
  layer(p, (q) => drawLeg(q, hipN, o.nf, true, 10));

  // ------------------------------------------------ head (sunk between the shoulders, ahead of the far one)
  let headMask: Canvas | null = null;
  const drawHead = () =>
    layer(p, (q) => {
      headMask = q;
      const rows = { n: HEAD_N, blaze: HEAD_BLAZE, snarl: HEAD_SNARL, roar: HEAD_ROAR, hit: HEAD_HIT, guard: HEAD_GUARD }[o.head];
      const e = o.eye;
      const mouthHot = Math.max(o.core, o.seam);
      const key: Record<string, number> = {
        k: PAL.ink,
        '0': PAL.stone0,
        '1': PAL.stone1,
        '2': PAL.stone2,
        '3': PAL.stone3,
        '4': PAL.stone4,
        E: e < 0.6 ? PAL.fire2 : e > 1.5 ? PAL.gold4 : PAL.fire4,
        e: e < 0.6 ? PAL.fire3 : e > 1.5 ? PAL.white : PAL.gold4,
        x: e > 1.5 ? PAL.fire2 : PAL.stone0,
        m: PAL.fire2,
        M: mouthHot > 1.7 ? PAL.fire4 : PAL.fire3,
        g: mouthHot > 1.7 ? PAL.gold4 : PAL.fire4,
        t: PAL.stone3,
        r: o.seam > 1.4 ? PAL.fire4 : o.seam > 0.75 ? PAL.fire3 : PAL.fire2,
      };
      q.stamp(rows, key, Math.round(headPos[0] - 6), Math.round(headPos[1] - 4));
    });
  if (!o.headFront) drawHead();

  // ------------------------------------------------ near arm (in front)
  layer(p, (q) => drawArm(q, shN, o.nh, o.nd, true, o.heat, 30));
  layer(p, (q) => drawBoulder(q, shN, true));
  if (o.headFront) drawHead();

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
    // the fist's swing smear: a hot arc thickening toward the fist, traced over the top of the
    // silhouette (light behind the body) — bright core, fire3 body, fire2 fringe only
    const pts = [...o.smear, o.nh];
    const sm = new PixelCanvas(p.w, p.h);
    const rank = (c: number) => FIRE_RANK(c);
    for (let i = 0; i + 1 < pts.length; i++) {
      const n = 12;
      for (let k = 0; k <= n; k++) {
        const f = (i + k / n) / (pts.length - 1);
        const [x, y] = lerpPt(pts[i], pts[i + 1], k / n);
        const w = 0.6 + f * 4.2;
        for (let yy = Math.floor(y - w); yy <= y + w; yy++)
          for (let xx = Math.floor(x - w); xx <= x + w; xx++) {
            const a = Math.hypot(xx + 0.5 - x, yy + 0.5 - y) / w;
            if (a > 1) continue;
            const col = a < 0.3 ? (f > 0.55 ? PAL.gold4 : PAL.fire4) : a < 0.65 ? PAL.fire3 : PAL.fire2;
            const cur = sm.get(xx, yy);
            if (cur === null || rank(col) > rank(cur)) sm.set(xx, yy, col);
          }
      }
    }
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < p.w; x++) {
        const c = sm.get(x, y);
        if (c === null) continue;
        const cur = p.get(x, y);
        // light behind the silhouette: only empty pixels and the outline
        if (cur !== null && cur !== PAL.ink) continue;
        p.set(x, y, c);
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
    const vy = sh[1] - (side ? 9 : 9 * FAR_K);
    if (o.flare > 0.05) {
      for (let i = 0; i < 3; i++) {
        const L = Math.min(vy - 1, o.flare * (6 + 3 * hash(i, Math.floor(o.t * 10), side)) * (i === 1 ? 1.35 : 0.9));
        const lean = (i - 1) * 0.35;
        tongue(p, [vx + (i - 1) * 2.5, vy + (i === 1 ? 0 : 1)], -Math.PI / 2 + lean, L, i === 1 ? 4.2 : 3.4, -lean * 0.6 + Math.sin((o.t * 3 + i * 0.3) * TAU) * 0.35, o.t * 3 + i * 0.33, o.flare + 0.3, side ? null : headMask);
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
      for (let i = 0; i <= L; i++) p.set(x, y + i, i === L ? PAL.fire4 : PAL.fire3);
    } else {
      const fy = y + 3 + Math.floor((t - 0.55) * 30);
      if (fy < GROUND) {
        p.set(x, fy, PAL.fire4);
        p.set(x, fy - 1, PAL.fire3);
      }
      p.set(x, y, PAL.fire3);
    }
  };
  if (!o.smear.length && o.burst === 0 && o.nd > 0.8 && o.nd < 2.4) drip([o.nh[0] + Math.cos(o.nd) * 9, o.nh[1] + Math.sin(o.nd) * 9 + 1], 0);
  if (!o.farFront && o.fd > 0.8 && o.fd < 2.4) drip([o.fh[0] + Math.cos(o.fd) * 9 - 1, o.fh[1] + Math.sin(o.fd) * 9 + 1], 0.45);

  // impact burst of magma off the knuckles
  if (o.burst > 0) {
    const ux = Math.cos(o.nd);
    const uy = Math.sin(o.nd);
    const kx = o.nh[0] + ux * 10;
    const ky = o.nh[1] + uy * 10;
    for (let i = 0; i < 5; i++) {
      const a = o.nd + (i - 2) * 0.62;
      const bx = kx - ux * 2;
      // keep the tongues 2px inside the frame (they are unoutlined light)
      const room = Math.cos(a) > 0.1 ? (W - 3 - bx) / Math.cos(a) : 99;
      tongue(p, [bx, ky - uy * 2], a, Math.min(room, o.burst * (6 + 3 * hash(i, 5)) * (i === 2 ? 1.25 : 1)), 4.2, (i - 2) * 0.3, i * 0.17 + o.t, 1.5);
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
    for (let x = -6; x <= 8; x++) if (!p.isOpaque(fx + x, fy)) p.set(fx + x, fy, Math.abs(x) < 4 ? PAL.fire3 : PAL.fire2);
  }

  // hot embers off the hit
  for (const ch of o.chips) if (ch.hot) p.set(ch.x, ch.y, PAL.fire4).set(ch.x - 1, ch.y + 1, PAL.fire3).set(ch.x - 2, ch.y + 2, PAL.fire2);
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
