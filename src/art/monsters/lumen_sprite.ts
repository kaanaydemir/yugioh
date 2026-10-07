// Işık Perisi (lumen_sprite) — LIGHT fairy, 48×48 frame, ~24 px tall body, hovering (hover 12).
//
// A tiny glowing fairy: golden hair streaming behind her, a white-and-gold petal dress, four
// translucent butterfly wings (cyan upper pair, gold lower pair, bright rims), sparkles orbiting
// her. Parametric rig: every frame is a Pose (numbers). The face is hand-pixelled (3/4, front and
// back stamps — the roar is a full pirouette through all four views). Wings are 2D shapes whose
// outward axis is foreshortened by the flutter angle (they rotate about her spine, seen with her
// turned slightly toward the camera), drawn with an inner gradient, veins, an eye-spot and a white
// rim; where the near wings overlap the far ones the far rim shows through (translucency). Hair,
// skirt hem and wings lag the body (secondary motion). Sparkles, the charge orb, the hand flash and
// the roar burst are light (drawn after the outline).

import { PAL } from '../palette';
import { PixelCanvas, bezier, type Pt } from '../pixel';
import type { MonsterAnim, MonsterArt } from '../types';

const W = 48;
const H = 48;
const TAU = Math.PI * 2;
/** She is turned slightly toward the camera (3/4 view). */
const YAW = 0.5;

type Canvas = PixelCanvas;
type View = 'right' | 'front' | 'left' | 'back';

// ---------------------------------------------------------------- pose

interface Pose {
  /** Waist position (frame px) and torso lean (rad, + = forward/right). */
  x: number;
  y: number;
  lean: number;
  view: View;
  /** Head offset (px). */
  hx: number;
  hy: number;
  /** 0 shut (happy arcs), 1 open, 2 squeezed (><), 3 shining. Mouth 0 smile, 1 open. */
  eye: number;
  mouth: number;
  /** Arms: shoulder angle (screen rad, π/2 = straight down) and elbow bend (rad), near & far. */
  aN: number;
  bN: number;
  aF: number;
  bF: number;
  /** Legs: angle from straight down (rad, + = forward) and knee bend (rad), near & far. */
  lN: number;
  kN: number;
  lF: number;
  kF: number;
  /** Wing opening angle α (rad: 0 closed back, ~1.6 spread wide) for upper and lower pairs. */
  wU: number;
  wL: number;
  /** Extra wing tilt (rad, + = swept back/down). */
  wTilt: number;
  /** Cocoon 0..1: the wings fold forward around her (guard). */
  wrap: number;
  /** Skirt flare 0..1, hem sway (px, + = forward). */
  flare: number;
  sway: number;
  /** Hair stream: direction offset (rad, + = lifts up/back) and wave phase. */
  hair: number;
  hw: number;
  /** Charge orb between the hands 0..1, hand flash 0..1, roar burst 0..1, aura pulse 0..1. */
  glow: number;
  blast: number;
  burst: number;
  aura: number;
  /** Light trail left by the hands sweeping forward from the hip (attack thrust) 0..1. */
  trail: number;
  /** Sparkle/flicker phase (0..1 loops). */
  t: number;
}

const N: Pose = {
  x: 24,
  y: 27,
  lean: 0.05,
  view: 'right',
  hx: 0,
  hy: 0,
  eye: 1,
  mouth: 0,
  aN: 1.95,
  bN: -0.7,
  aF: 1.35,
  bF: 0.5,
  lN: 0.15,
  kN: 0.35,
  lF: -0.05,
  kF: 0.6,
  wU: 1.2,
  wL: 1.1,
  wTilt: 0,
  wrap: 0,
  flare: 0.2,
  sway: 0,
  hair: 0,
  hw: 0,
  glow: 0,
  blast: 0,
  burst: 0,
  aura: 0,
  trail: 0,
  t: 0,
};

const P = (o: Partial<Pose>): Pose => ({ ...N, ...o });

// ---------------------------------------------------------------- animations

function idlePose(f: number, n: number): Pose {
  const t = f / n;
  const bob = Math.sin(t * TAU);
  // two quick flutters per bob; hem and hair trail the body by ~1 frame
  const flut = Math.sin(t * TAU * 2);
  return P({
    y: N.y + Math.round(-bob * 1.4),
    wU: 1.15 + 0.4 * flut,
    wL: 1.05 + 0.35 * Math.sin((t - 0.06) * TAU * 2),
    sway: Math.round(Math.sin((t - 0.12) * TAU) * 1),
    hair: 0.12 * Math.sin((t - 0.15) * TAU),
    hw: t,
    lN: 0.15 + 0.1 * Math.sin((t - 0.1) * TAU),
    lF: -0.05 + 0.1 * Math.sin((t + 0.3) * TAU),
    aN: N.aN + 0.08 * Math.sin((t - 0.1) * TAU),
    eye: f === 5 ? 0 : 1,
    t,
  });
}

const ANIMS: Record<MonsterAnim, { fps: number; loop: boolean; poses: Pose[] }> = {
  idle: { fps: 10, loop: true, poses: Array.from({ length: 8 }, (_, f) => idlePose(f, 8)) },

  // Roar: dip and gather (wings closed) → spring up into a pirouette (front → left → back →
  // right) with arms rising, skirt flaring → arms up in a V, wings flung open, a burst of
  // sparkles rings outward → float back down.
  roar: {
    fps: 12,
    loop: false,
    poses: [
      idlePose(0, 8),
      P({ y: 29, lean: -0.05, aN: 0.9, bN: 1.2, aF: 2.4, bF: -1.4, kN: 1.1, kF: 1.2, lN: 0.5, lF: 0.4, wU: 0.45, wL: 0.4, flare: 0, sway: -1, eye: 0, hair: -0.2, t: 0.1 }),
      P({ y: 25, view: 'front', aN: -2.5, bN: -0.4, aF: -0.6, bF: 0.4, wU: 0.9, wL: 0.8, flare: 0.6, sway: 1, hair: 0.4, eye: 1, t: 0.2 }),
      P({ y: 24, view: 'left', aN: -1.9, bN: -0.3, aF: -1.2, bF: 0.3, wU: 1.0, wL: 0.9, flare: 1, sway: 2, hair: 0.6, eye: 1, t: 0.3 }),
      P({ y: 24, view: 'back', aN: -2.1, bN: -0.2, aF: -1.0, bF: 0.2, wU: 1.1, wL: 1.0, flare: 1, sway: -2, hair: 0.6, t: 0.4 }),
      P({ y: 24, aN: -2.05, bN: -0.2, aF: -1.05, bF: 0.25, wU: 1.65, wL: 1.5, flare: 0.8, sway: -1, hair: 0.5, eye: 3, mouth: 1, burst: 0.2, aura: 1, t: 0.5 }),
      P({ y: 24, aN: -2.1, bN: -0.25, aF: -1.0, bF: 0.2, wU: 1.6, wL: 1.45, flare: 0.6, sway: 0, hair: 0.4, eye: 3, mouth: 1, burst: 0.5, aura: 0.8, t: 0.6 }),
      P({ y: 25, aN: -2.4, bN: -0.4, aF: -0.6, bF: 0.4, wU: 1.5, wL: 1.35, flare: 0.45, sway: 1, hair: 0.25, eye: 0, mouth: 0, burst: 0.8, aura: 0.5, t: 0.7 }),
      P({ y: 26, aN: 2.6, bN: -0.6, aF: 0.9, bF: 0.6, wU: 1.3, wL: 1.2, flare: 0.3, sway: 0, hair: 0.1, eye: 1, burst: 1, aura: 0.2, t: 0.8 }),
      P({ y: 27, wU: 1.2, wL: 1.1, t: 0.9 }),
    ],
  },

  // Attack ("Işık Kıvılcımı"): lean back and pull both hands to the hip while a light orb swells
  // between them (anticipation) → thrust both hands forward → IMPACT: palms open, a flash bursts
  // at the hands (projectiles spawn here), wings flare, hair whips back → recoil drift → settle.
  attack: {
    fps: 12,
    loop: false,
    poses: [
      idlePose(0, 8),
      P({ x: 23, lean: -0.2, aN: 2.5, bN: -1.6, aF: 2.3, bF: -1.5, wU: 0.8, wL: 0.75, wTilt: 0.15, glow: 0.35, hair: 0.2, sway: 1, eye: 1, t: 0.1 }),
      P({ x: 23, y: 28, lean: -0.32, aN: 2.65, bN: -1.8, aF: 2.5, bF: -1.7, wU: 0.55, wL: 0.5, wTilt: 0.25, glow: 0.7, hair: 0.3, sway: 1, kN: 0.8, lN: 0.4, eye: 3, t: 0.2 }),
      P({ x: 23, y: 28, lean: -0.35, aN: 2.7, bN: -1.85, aF: 2.55, bF: -1.75, wU: 0.45, wL: 0.45, wTilt: 0.3, glow: 1, hair: 0.35, sway: 1, kN: 0.9, lN: 0.45, eye: 3, t: 0.3 }),
      P({ x: 25, y: 27, lean: 0.25, aN: 0.25, bN: -0.2, aF: 0.1, bF: -0.15, wU: 1.2, wL: 1.1, glow: 1, hair: -0.3, sway: -1, eye: 3, mouth: 1, trail: 1, t: 0.4 }),
      P({ x: 26, y: 27, lean: 0.35, aN: -0.12, bN: 0, aF: -0.22, bF: 0, wU: 1.7, wL: 1.6, wTilt: -0.1, blast: 1, hair: -0.55, sway: -2, flare: 0.5, eye: 3, mouth: 1, lN: -0.25, kN: 0.2, trail: 0.5, t: 0.5 }),
      P({ x: 25, y: 27, lean: 0.2, aN: 0.0, bN: -0.1, aF: -0.1, bF: -0.05, wU: 1.5, wL: 1.4, blast: 0.5, hair: -0.35, sway: -1, flare: 0.4, eye: 1, mouth: 1, t: 0.6 }),
      P({ x: 24, y: 27, lean: 0.1, aN: 1.0, bN: -0.5, aF: 0.8, bF: 0.2, wU: 1.3, wL: 1.2, hair: -0.1, sway: 0, eye: 1, t: 0.7 }),
      P({ t: 0.8 }),
    ],
  },

  // Hit: knocked back with eyes squeezed shut (><), arms flung, wings crumpled, sparkles knocked
  // loose; she rights herself.
  hit: {
    fps: 10,
    loop: false,
    poses: [
      P({ x: 22, y: 26, lean: -0.45, hx: -1, eye: 2, mouth: 1, aN: -2.6, bN: -0.5, aF: -0.4, bF: 0.6, wU: 0.35, wL: 0.3, wTilt: 0.45, lN: 0.6, kN: 0.3, lF: 0.4, kF: 0.4, hair: 0.6, sway: 2, flare: 0.6, burst: 0.15, t: 0.15 }),
      P({ x: 22, y: 27, lean: -0.3, eye: 2, mouth: 1, aN: -2.9, bN: -0.3, aF: 0.4, bF: 0.6, wU: 0.6, wL: 0.5, wTilt: 0.3, lN: 0.45, lF: 0.3, hair: 0.45, sway: 1, flare: 0.4, burst: 0.4, t: 0.3 }),
      P({ x: 22, y: 27, lean: -0.12, eye: 0, aN: 2.4, bN: -0.9, aF: 1.1, bF: 0.6, wU: 0.95, wL: 0.9, wTilt: 0.1, hair: 0.2, sway: 0, burst: 0.7, t: 0.45 }),
      P({ x: 23, y: 27, eye: 1, wU: 1.1, wL: 1.0, burst: 0, t: 0.6 }),
    ],
  },

  // Guard: the four wings close forward around her like a glowing cocoon; she curls up, arms
  // crossed, eyes closed, the wings breathing with a soft light.
  guard: {
    fps: 4,
    loop: true,
    poses: [0, 1, 2, 3].map((f) => {
      const t = f / 4;
      const s = Math.sin(t * TAU);
      return P({
        y: 28 + (s > 0.5 ? -1 : 0),
        lean: 0.12,
        hy: 1,
        eye: 0,
        aN: 0.4,
        bN: -2.3,
        aF: 0.8,
        bF: -2.0,
        lN: 0.9,
        kN: 2.2,
        lF: 0.7,
        kF: 2.1,
        wrap: 1,
        wU: 1.0 + 0.05 * s,
        wL: 0.95 + 0.05 * s,
        flare: 0,
        hair: -0.15,
        hw: t,
        aura: 0.5 + 0.5 * s,
        t,
      });
    }),
  },
};

// ---------------------------------------------------------------- head stamps

const HEAD_KEY: Record<string, number> = {
  h: PAL.gold3,
  H: PAL.gold4,
  j: PAL.gold2,
  J: PAL.gold1,
  f: PAL.skin3,
  F: PAL.skin4,
  n: PAL.skin2,
  k: PAL.ink,
  c: PAL.cyan3,
  b: PAL.crim4,
  m: PAL.skin1,
  w: PAL.white,
};

/** 3/4 right; face pixels: 'k' lash row, 'c' iris row (eyes), 'm' mouth. */
const HEAD_RIGHT = [
  '...hhhhh....',
  '..hHHHHHh...',
  '.hHHhhhhhh..',
  'jhhhhhhhhhh.',
  'jhhjhhFhhFh.',
  'jjhjnFFFFFf.',
  'jjhjfkfffkf.',
  'jjjjfcfffcf.',
  '.jjjbffffbf.',
  '.jj.ffffmf..',
  '..j..nnnn...',
];
const HEAD_FRONT = [
  '..hhhhhhh..',
  '.hHHHHHHhh.',
  'hHHhhhhhhhj',
  'hhhhhhhhhhj',
  'hhjhFhhFhjj',
  'hjnFFFFFFnj',
  'hjfkffffkfj',
  'jjfcffffcfj',
  'jjfbffffbfj',
  '.j.nffmfn.j',
  '....nnnn...',
];
const HEAD_BACK = [
  '..hhhhhhh..',
  '.hHHHHHHhh.',
  'hHHhhhhhhhj',
  'hhhhhhhhhhj',
  'hhhhjhhhjhj',
  'hhjhhhhhhjj',
  'jhhhjhhhhjj',
  'jjhhhhjhhjj',
  '.jjhhhhhjj.',
  '..jjjjjjj..',
];

// ---------------------------------------------------------------- helpers

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

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

/** 4-point twinkle star (light, no outline). size 0..3. */
function star(p: Canvas, x: number, y: number, size: number, core: number = PAL.white, arm: number = PAL.gold4, tip: number = PAL.gold3, onlyEmpty = true): void {
  x = Math.round(x);
  y = Math.round(y);
  const put = (xx: number, yy: number, c: number) => {
    if (onlyEmpty && p.isOpaque(xx, yy)) return;
    p.set(xx, yy, c);
  };
  if (size <= 0) return;
  if (size < 1.5) {
    put(x, y, size > 1 ? core : arm);
    return;
  }
  put(x, y, core);
  const L = Math.floor(size) - 1;
  for (let i = 1; i <= L; i++) {
    const c = i === L && L > 1 ? tip : arm;
    put(x + i, y, c);
    put(x - i, y, c);
    put(x, y + i, c);
    put(x, y - i, c);
  }
  if (size >= 3.5) {
    put(x + 1, y + 1, tip);
    put(x - 1, y - 1, tip);
    put(x + 1, y - 1, tip);
    put(x - 1, y + 1, tip);
  }
}

// ---------------------------------------------------------------- wings

/** Wing outlines in wing-local space: u outward from the root, v up. */
const UPPER: Pt[] = [
  ...bezier([0, 0], [1.5, 5], [4.5, 10], [9.5, 11.2], 10),
  ...bezier([9.5, 11.2], [14, 12.2], [16, 9], [14.8, 6], 8).slice(1),
  ...bezier([14.8, 6], [13.6, 3], [7, 1], [0, -0.5], 8).slice(1),
];
const LOWER: Pt[] = [
  ...bezier([0, -1], [4, -1.5], [8, -3.2], [9.2, -6.2], 8),
  ...bezier([9.2, -6.2], [10.2, -9], [8, -10.8], [6, -9.6], 6).slice(1),
  ...bezier([6, -9.6], [4, -8.4], [1.8, -5], [0, -2], 6).slice(1),
];

interface WingSpec {
  shape: Pt[];
  /** Eye-spot position (wing-local) and veins (wing-local end points). */
  spot: Pt;
  veins: Pt[];
  base: number;
  inner: number;
  rim: number;
  vein: number;
  spotC: number;
}

const WU: WingSpec = {
  shape: UPPER,
  spot: [12, 8.5],
  veins: [
    [8, 10.5],
    [13, 8],
    [11, 4],
  ],
  base: PAL.cyan4,
  inner: PAL.cyan3,
  rim: PAL.white,
  vein: PAL.cyan3,
  spotC: PAL.gold4,
};
const WL: WingSpec = {
  shape: LOWER,
  spot: [7.4, -7.4],
  veins: [
    [8, -4.5],
    [6.5, -8.5],
  ],
  base: PAL.gold4,
  inner: PAL.gold3,
  rim: PAL.white,
  vein: PAL.gold3,
  spotC: PAL.cyan4,
};

/**
 * Project a wing: k = signed horizontal scale of the outward axis (foreshortening; negative points
 * left), tilt rotates the wing in the screen plane around the root.
 */
function wingPts(spec: WingSpec, root: Pt, k: number, tilt: number, scale = 1): (u: number, v: number) => Pt {
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  return (u: number, v: number): Pt => {
    const x = u * k * scale;
    const y = -v * scale;
    return [root[0] + x * c - y * s, root[1] + x * s + y * c];
  };
}

function drawWingShape(q: Canvas, spec: WingSpec, M: (u: number, v: number) => Pt, k: number, bright: number): void {
  const pts = spec.shape.map(([u, v]) => M(u, v));
  q.poly(pts, spec.base);
  // fill also a thin stroke so edge-on wings never vanish
  q.polyline(pts, spec.base, true);
  // inner gradient: the half nearest the root takes the deeper tone
  const root = M(0, 0);
  const far = M(spec.spot[0], spec.spot[1]);
  const span = Math.hypot(far[0] - root[0], far[1] - root[1]) || 1;
  const src = q.clone();
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      if (src.get(x, y) !== spec.base) continue;
      const d = Math.hypot(x + 0.5 - root[0], y + 0.5 - root[1]) / span;
      if (d < 0.38 && Math.abs(k) > 0.15) q.set(x, y, spec.inner);
      else if (d < 0.5 && Math.abs(k) > 0.15 && PixelCanvas.ditherAt(x, y, 8)) q.set(x, y, spec.inner);
    }
  // veins
  for (const [vu, vv] of spec.veins) {
    const a = M(vu * 0.25, vv * 0.25);
    const b = M(vu * 0.85, vv * 0.85);
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 1.5);
    for (let i = 0; i <= n; i++) q.paint(lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n), spec.vein);
  }
  // eye-spot
  if (Math.abs(k) > 0.3) {
    const sp = M(spec.spot[0], spec.spot[1]);
    q.paint(sp[0], sp[1], spec.spotC);
    q.paint(sp[0] + (k > 0 ? 1 : -1), sp[1], bright > 0.5 ? PAL.white : spec.spotC);
  }
  // bright rim just inside the edge
  const s2 = q.clone();
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      if (!s2.isOpaque(x, y)) continue;
      if (!s2.isOpaque(x - 1, y) || !s2.isOpaque(x + 1, y) || !s2.isOpaque(x, y - 1) || !s2.isOpaque(x, y + 1)) q.set(x, y, spec.rim);
    }
}

// ---------------------------------------------------------------- rig

interface Rig {
  sh: Pt;
  /** Torso-local (u right, v down from the waist) → frame px. */
  T: (u: number, v: number) => Pt;
  headX: number;
  headY: number;
  hands: [Pt, Pt];
  /** Wing root (upper back). */
  wr: Pt;
}

// 3/4 view: her near (left) side is toward the camera → screen left; far (right) side → screen right
const SH_N: Pt = [-1.5, -4.6];
const SH_F: Pt = [1.6, -4.8];
const UPPER_ARM = 3.4;
const FOREARM = 3.2;

function rigOf(o: Pose): Rig {
  const c = Math.cos(o.lean);
  const s = Math.sin(o.lean);
  const T = (u: number, v: number): Pt => [o.x + u * c - v * s, o.y + u * s + v * c];
  const neck = T(0.3, -6);
  const headX = Math.round(neck[0] - 6 + o.hx);
  const headY = Math.round(neck[1] - 10 + o.hy);
  const arm = (sh: Pt, a: number, b: number): Pt => {
    const s0 = T(sh[0], sh[1]);
    const el: Pt = [s0[0] + Math.cos(a) * UPPER_ARM, s0[1] + Math.sin(a) * UPPER_ARM];
    return [el[0] + Math.cos(a + b) * FOREARM, el[1] + Math.sin(a + b) * FOREARM];
  };
  const hands: [Pt, Pt] = [arm(SH_N, o.aN, o.bN), arm(SH_F, o.aF, o.bF)];
  const wr = T(-1.6, -3.6);
  return { sh: T(0, -4.6), T, headX, headY, hands, wr };
}

// ---------------------------------------------------------------- the fairy

function drawFairy(p: Canvas, o: Pose): void {
  const r = rigOf(o);
  const { T } = r;
  const view = o.view;
  const front = view === 'front';
  const backV = view === 'back';

  // ---------------------------------------- wings: per pair, near (toward camera) and far
  // opening angle α → signed horizontal scale; 3/4 view adds the yaw
  const yaw = front || backV ? 0 : YAW;
  const kOf = (alpha: number, near: boolean) => -Math.cos(near ? alpha - yaw : alpha + yaw);
  const wingSet = (q: Canvas, near: boolean, bright: number) => {
    for (const [spec, alpha, tl] of [
      [WU, o.wU, -0.22 + o.wTilt],
      [WL, o.wL, 0.25 + o.wTilt * 0.6],
    ] as const) {
      let k = kOf(alpha, near);
      if (front || backV) k = (near ? -1 : 1) * Math.sin(alpha) * 0.95;
      // tilt spreads each wing outward from her spine (upper up-and-out, lower down-and-out)
      let tilt = k < 0 ? tl : -tl;
      let scale = spec === WU ? 1.2 : 1.12;
      if (o.wrap > 0) {
        // cocoon: wings swing forward (right) around her, curling inward
        const kw = near ? 0.75 : -0.55;
        k = lerp(k, kw, o.wrap);
        tilt = lerp(tilt, near ? (spec === WU ? 0.55 : -0.5) : spec === WU ? -0.25 : 0.35, o.wrap);
        scale = lerp(scale, near ? 1.15 : 1.05, o.wrap);
      }
      // a translucent wing seen edge-on all but vanishes (and a 1px sliver reads as a glitch)
      if (Math.abs(k) < 0.3 && o.wrap < 0.5) continue;
      const root: Pt = [r.wr[0] + (near ? -0.5 : 0.5), r.wr[1] + (spec === WU ? 0 : 1)];
      const M = wingPts(spec, root, k, tilt, scale);
      layer(q, (wq) => drawWingShape(wq, spec, M, k, bright), PAL.ink);
    }
  };
  // far wings first (behind everything), near wings next — still behind the body unless
  // seen from the back or wrapped into a cocoon
  const wingsFar = new PixelCanvas(W, H);
  wingSet(wingsFar, false, 0.3);
  p.blit(wingsFar, 0, 0);
  const wingsNear = new PixelCanvas(W, H);
  wingSet(wingsNear, true, 1);
  const nearInFront = backV || o.wrap > 0.5;
  // translucency: the far wings' rim shows faintly through the near wings
  const ghost = (dst: Canvas) => {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c = wingsFar.get(x, y);
        if (c !== PAL.white) continue;
        const n = dst.get(x, y);
        if (n === PAL.cyan4) dst.set(x, y, PAL.cyan3);
        else if (n === PAL.gold4) dst.set(x, y, PAL.gold3);
      }
  };
  ghost(wingsNear);
  if (!nearInFront) layer(p, (q) => q.blit(wingsNear, 0, 0), PAL.ink);

  // ---------------------------------------- hair stream (behind the body)
  const hairRoot: Pt = [r.headX + (front ? 5.5 : backV ? 5.5 : 3), r.headY + 6];
  layer(p, (q) => {
    const strands: [number, number, number][] = [
      [0, 10, 3.2],
      [0.35, 8.5, 2.6],
      [-0.3, 7.5, 2.4],
    ];
    strands.forEach(([da, L, w0], i) => {
      const pts: Pt[] = [];
      const base = Math.PI / 2 + 0.55 + da + o.hair;
      let [x, y] = hairRoot;
      x += da * 2;
      const n = 7;
      for (let j = 0; j <= n; j++) {
        const f = j / n;
        pts.push([x, y]);
        const a = base + f * 0.5 + Math.sin((o.hw - f * 0.5 + i * 0.2) * TAU) * 0.25 * f;
        x += (Math.cos(a) * L) / n;
        y += (Math.sin(a) * L) / n;
      }
      if (front || backV) {
        // symmetric fall behind the shoulders
        q.stroke(
          pts.map(([px, py]) => [hairRoot[0] - (px - hairRoot[0]) * 0.5 - 2, py]),
          w0,
          1,
          PAL.gold2,
        );
        q.stroke(
          pts.map(([px, py]) => [hairRoot[0] + (px - hairRoot[0]) * 0.5 + 2, py]),
          w0,
          1,
          PAL.gold2,
        );
      } else q.stroke(pts, w0, 1, i === 0 ? PAL.gold3 : PAL.gold2);
    });
    // highlight streak along the top strand
    const src = q.clone();
    for (let y = 0; y < q.h; y++)
      for (let x = 0; x < q.w; x++) if (src.get(x, y) === PAL.gold3 && !src.isOpaque(x, y - 1)) q.set(x, y, PAL.gold4);
  });

  // ---------------------------------------- legs (under the skirt)
  const leg = (q: Canvas, near: boolean) => {
    const hip = T(near ? -0.8 : 1.0, 4.5);
    const a = Math.PI / 2 - (near ? o.lN : o.lF);
    const kb = near ? o.kN : o.kF;
    const knee: Pt = [hip[0] + Math.cos(a) * 3, hip[1] + Math.sin(a) * 3];
    const a2 = a + kb;
    const foot: Pt = [knee[0] + Math.cos(a2) * 3.4, knee[1] + Math.sin(a2) * 3.4];
    q.stroke([hip, knee, foot], 2, 1.4, near ? PAL.skin3 : PAL.skin2);
    // pointed golden slipper
    const toe: Pt = [foot[0] + Math.cos(a2 - 0.9) * 1.6, foot[1] + Math.sin(a2 - 0.9) * 1.6];
    q.line(foot[0], foot[1], toe[0], toe[1], near ? PAL.gold3 : PAL.gold2);
    q.set(foot[0], foot[1], near ? PAL.gold3 : PAL.gold2);
  };
  layer(p, (q) => leg(q, false));
  layer(p, (q) => leg(q, true));

  // ---------------------------------------- far arm (behind the torso)
  const armDraw = (q: Canvas, near: boolean) => {
    const sh = T(...(near ? SH_N : SH_F));
    const a = near ? o.aN : o.aF;
    const b = near ? o.bN : o.bF;
    const el: Pt = [sh[0] + Math.cos(a) * UPPER_ARM, sh[1] + Math.sin(a) * UPPER_ARM];
    const hd = near ? r.hands[0] : r.hands[1];
    q.stroke([sh, el], 1.9, 1.6, near ? PAL.skin3 : PAL.skin2);
    q.stroke([el, hd], 1.6, 1.4, near ? PAL.skin3 : PAL.skin2);
    q.set(hd[0], hd[1], near ? PAL.skin4 : PAL.skin3);
    // puffed sleeve
    q.disc(sh[0] + Math.cos(a) * 0.8, sh[1] + Math.sin(a) * 0.8, 1.3, near ? PAL.white : PAL.mist);
  };
  if (!backV) layer(p, (q) => armDraw(q, false), null);
  else layer(p, (q) => armDraw(q, true), null);

  // ---------------------------------------- skirt + bodice
  layer(p, (q) => {
    // bell skirt with a petal hem; the hem sways (lags) and flares
    const top = 0.6;
    const hemY = 7.2 + o.flare * 0.4;
    const half = 4.6 + o.flare * 2.6;
    const pts: Pt[] = [];
    pts.push(T(-1.9, top));
    const L0 = T(-half, hemY);
    const R0 = T(half, hemY);
    const sw = o.sway;
    pts.push(...bezier(T(-1.9, top), T(-2.6 - o.flare, 3), [L0[0] - 0.6 + sw, L0[1] - 2], [L0[0] + sw, L0[1]], 6).slice(1));
    // petals
    const nP = 4;
    for (let i = 0; i < nP; i++) {
      const a = lerp(-half, half, i / nP);
      const b = lerp(-half, half, (i + 1) / nP);
      const m = (a + b) / 2;
      const pa = T(a, hemY);
      const pm = T(m, hemY + 1.4 - Math.abs(m / half) * 0.4);
      const pb = T(b, hemY);
      pts.push([pa[0] + sw, pa[1]], [lerp(pa[0], pm[0], 0.6) + sw, pm[1] - 0.2], [pm[0] + sw, pm[1]], [lerp(pm[0], pb[0], 0.4) + sw, pm[1] - 0.2]);
    }
    pts.push([R0[0] + sw, R0[1]]);
    pts.push(...bezier([R0[0] + sw, R0[1]], [R0[0] + 0.6 + sw, R0[1] - 2], T(2.6 + o.flare, 3), T(1.9, top), 6).slice(1));
    q.poly(pts, PAL.white);
    // bodice
    q.poly([T(-2, -4.8), T(2.1, -4.8), T(1.8, 0.8), T(-1.8, 0.8)], PAL.white);
    // shading: the back third of the skirt (away from the light) in mist, deep folds steel
    for (let y = 0; y < q.h; y++)
      for (let x = 0; x < q.w; x++) {
        if (q.get(x, y) !== PAL.white) continue;
        const rx = x + 0.5 - o.x;
        const ry = y + 0.5 - o.y;
        const u = rx * Math.cos(o.lean) + ry * Math.sin(o.lean);
        const v = -rx * Math.sin(o.lean) + ry * Math.cos(o.lean);
        const edgeR = !q.isOpaque(x + 1, y);
        const edgeB = !q.isOpaque(x, y + 1);
        // light from the top-left: the right flank of the bell and the bodice's right side shade
        if (edgeB) q.set(x, y, PAL.gold3);
        else if (v > 0.8 && u > half * 0.42 - (v - 0.8) * 0.12) q.set(x, y, PAL.mist);
        else if (v > 5.4 && !edgeB) q.set(x, y, (x & 1) === 0 ? PAL.mist : PAL.white);
        else if (v <= 0.8 && u > 1.0) q.set(x, y, PAL.mist);
      }
    // fold lines from the waist toward the petal notches
    for (const i of [1, 3]) {
      const m = lerp(-half, half, i / 4);
      const a = T(m * 0.25, 1.6);
      const b = T(m * 0.92, hemY - 0.6);
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 1.5);
      for (let j = 0; j <= n; j++) {
        const x = lerp(a[0], b[0] + o.sway * (j / n), j / n);
        const y = lerp(a[1], b[1], j / n);
        if (q.get(x, y) === PAL.white) q.set(x, y, PAL.mist);
      }
    }
    // golden waist sash with a glowing gem
    const s0 = T(-1.9, 0.2);
    const s1 = T(1.9, 0.2);
    q.line(s0[0], s0[1], s1[0], s1[1], PAL.gold3);
    if (!backV) {
      const g = T(0.6, 0.2);
      q.set(g[0], g[1], PAL.gold4);
    }
    // neckline trim
    const n0 = T(-1.6, -4.8);
    const n1 = T(1.8, -4.8);
    q.line(n0[0], n0[1], n1[0], n1[1], PAL.gold4);
    // light catches the top-left
    const src = q.clone();
    for (let y = 0; y < q.h; y++)
      for (let x = 0; x < q.w; x++) if (src.get(x, y) === PAL.mist && !src.isOpaque(x - 1, y) && src.isOpaque(x + 1, y) && y < o.y + 2) q.set(x, y, PAL.white);
  });

  // ---------------------------------------- head (stamp) + hairpin
  layer(p, (q) => {
    const rows = front ? HEAD_FRONT : backV ? HEAD_BACK : HEAD_RIGHT;
    // neck
    const nk = T(0.3, -5.4);
    q.set(nk[0], nk[1], PAL.skin2);
    q.set(nk[0], nk[1] - 1, PAL.skin2);
    const hx = r.headX;
    const hy = r.headY;
    q.stamp(rows, HEAD_KEY, hx, hy);
    // eyes
    if (!backV) {
      const eyes: Pt[] = [];
      rows.forEach((row, yy) => {
        for (let xx = 0; xx < row.length; xx++) if (row[xx] === 'k') eyes.push([hx + xx, hy + yy]);
      });
      for (const [ex, ey] of eyes) {
        if (o.eye === 0) {
          // happy closed arcs ^ ^
          q.set(ex, ey, PAL.skin3).set(ex, ey + 1, PAL.skin1);
          q.set(ex, ey, PAL.skin1);
          q.set(ex, ey + 1, PAL.skin3);
        } else if (o.eye === 2) {
          // squeezed > <
          q.set(ex, ey, PAL.ink).set(ex, ey + 1, PAL.skin2);
        } else if (o.eye === 3) {
          q.set(ex, ey, PAL.cyan3).set(ex, ey + 1, PAL.white);
        }
      }
      if (o.mouth > 0) {
        rows.forEach((row, yy) => {
          const xx = row.indexOf('m');
          if (xx >= 0) q.set(hx + xx, hy + yy, PAL.crim2).set(hx + xx, hy + yy + 1, PAL.skin1);
        });
      }
    }
    // star hairpin
    const pin: Pt = front ? [hx + 8, hy + 1] : backV ? [hx + 2, hy + 1] : [hx + 7, hy + 1];
    q.set(pin[0], pin[1], PAL.gold4);
    q.set(pin[0] + 1, pin[1], PAL.gold4);
    q.set(pin[0], pin[1] - 1, PAL.gold4);
    q.set(pin[0] + 1, pin[1] + 1, PAL.gold3);
  });

  // ---------------------------------------- near arm (in front)
  if (!backV) layer(p, (q) => armDraw(q, true), null);
  else layer(p, (q) => armDraw(q, false), null);

  // ---------------------------------------- wings in front (cocoon / back view)
  if (nearInFront) layer(p, (q) => q.blit(wingsNear, 0, 0), PAL.ink);

  p.outline(PAL.ink);
  fx(p, o, r);
}

// ---------------------------------------------------------------- light effects

/** Orbiting sparkles: fixed slots around her, each twinkling with its own phase. */
const SPARKS: [number, number, number][] = [
  [-13, -9, 0],
  [12, -12, 0.3],
  [-10, 7, 0.55],
  [13, 4, 0.8],
  [3, -16, 0.15],
];

function fx(p: Canvas, o: Pose, r: Rig): void {
  const cx = o.x;
  const cy = o.y - 5;
  // ambient twinkles (not while the burst is ringing out)
  if (o.burst <= 0 || o.burst >= 1) {
    SPARKS.forEach(([dx, dy, ph], i) => {
      const k = (o.t + ph) % 1;
      const size = k < 0.25 ? 3 : k < 0.5 ? 2 : k < 0.7 ? 1 : 0;
      const drift = Math.sin((o.t + ph) * TAU) * 1;
      const col = i % 2 ? PAL.cyan4 : PAL.gold4;
      star(p, cx + dx, cy + dy + drift, size, PAL.white, col, i % 2 ? PAL.cyan3 : PAL.gold3);
    });
  }
  // fairy dust: motes shed by the wings drift down and fade
  if (o.wrap < 0.5) {
    for (let i = 0; i < 3; i++) {
      const ph = (o.t * 2 + i / 3) % 1;
      if (ph > 0.85) continue;
      const x = r.wr[0] - 5 - i * 2.5 + Math.sin((ph + i * 0.3) * TAU) * 1.2;
      const y = r.wr[1] + 9 + ph * 12;
      const c = ph < 0.3 ? PAL.white : ph < 0.6 ? PAL.gold4 : PAL.gold3;
      if (!p.isOpaque(x, y)) p.set(x, y, c);
    }
  }
  // aura motes rising (guard / roar)
  if (o.aura > 0) {
    for (let i = 0; i < 4; i++) {
      const ph = (o.t + i / 4) % 1;
      const x = cx + Math.sin(i * 2.1) * 9;
      const y = cy + 12 - ph * 22;
      const c = ph < 0.3 ? PAL.white : ph < 0.7 ? PAL.gold4 : PAL.gold3;
      if (!p.isOpaque(x, y) && o.aura * (1 - ph) > 0.2) p.set(x, y, c);
    }
  }
  // light trail: the orb's path from the hip to the outstretched hands
  if (o.trail > 0) {
    const [a, b] = r.hands;
    const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const hip = r.T(-3.5, 1.5);
    const ctrl: Pt = [lerp(hip[0], m[0], 0.5), Math.max(hip[1], m[1]) + 3];
    const pts = bezier(hip, ctrl, m, undefined, 14);
    pts.forEach(([x, y], i) => {
      const f = i / (pts.length - 1);
      if (f < 1 - o.trail) return;
      if (p.isOpaque(x, y)) return;
      p.set(x, y, f > 0.75 ? PAL.white : f > 0.45 ? PAL.gold4 : PAL.gold3);
      if (f > 0.5 && !p.isOpaque(x, y + 1)) p.set(x, y + 1, PAL.gold3);
    });
  }
  // charge orb between the hands
  if (o.glow > 0) {
    const [a, b] = r.hands;
    const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const R = 1 + o.glow * 2;
    p.disc(m[0], m[1], R + 0.8, PAL.gold3);
    p.disc(m[0], m[1], R, PAL.gold4);
    p.disc(m[0], m[1], Math.max(0.6, R - 1.2), PAL.white);
    if (o.glow > 0.6) star(p, m[0], m[1], 2 + o.glow * 3.5, PAL.white, PAL.gold4, PAL.gold3);
  }
  // flash at the hands (impact): a big 4-point star with long rays
  if (o.blast > 0) {
    const [a, b] = r.hands;
    const m: Pt = [(a[0] + b[0]) / 2 + 1, (a[1] + b[1]) / 2];
    const R = 2 + o.blast * 2;
    p.disc(m[0], m[1], R, PAL.gold4);
    p.disc(m[0], m[1], R - 1, PAL.white);
    star(p, m[0], m[1], 3 + o.blast * 5, PAL.white, PAL.gold4, PAL.gold3, false);
    if (o.blast > 0.7) {
      for (const [dx, dy] of [
        [5, -4],
        [5, 4],
        [8, 0],
      ] as const)
        star(p, m[0] + dx, m[1] + dy, 2, PAL.white, PAL.cyan4, PAL.cyan3);
    }
  }
  // roar burst: a ring of sparkles flying outward
  if (o.burst > 0 && o.burst < 1) {
    const n = 10;
    const R = 6 + o.burst * 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + 0.3;
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R * 0.85;
      const size = o.burst < 0.4 ? 3 : o.burst < 0.75 ? 2 : 1.2;
      star(p, x, y, size, PAL.white, i % 2 ? PAL.cyan4 : PAL.gold4, i % 2 ? PAL.cyan3 : PAL.gold3);
    }
    if (o.burst < 0.35) star(p, cx, cy - 2, 7, PAL.white, PAL.gold4, PAL.gold3);
  }
}

// ---------------------------------------------------------------- portrait (44×34)

function portrait(p: Canvas): void {
  // LIGHT: warm gold glow behind her, soft rays, specks of light
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 44; x++) {
      const d = Math.hypot(x - 22, (y - 15) * 1.15);
      let col: number = PAL.gold1;
      if (d < 21) col = PAL.gold2;
      if (d < 13) col = PAL.gold3;
      if (d < 7) col = PAL.gold4;
      const a = Math.atan2(y - 15, x - 22);
      if (d > 7 && Math.sin(a * 6) > 0.86) col = d < 13 ? PAL.gold4 : PAL.gold3;
      p.set(x, y, col);
    }
  const big = new PixelCanvas(W, H);
  drawFairy(big, P({ x: 24, y: 29, eye: 1, mouth: 0, aN: -0.9, bN: 0.3, aF: -2.2, bF: -0.2, wU: 1.5, wL: 1.4, flare: 0.5, hair: 0.3, t: 0.05 }));
  p.blit(big, -2, -11);
}

// ---------------------------------------------------------------- export

const IMPACT_FRAME = 5;

/** Muzzle = the flash between her outstretched hands in the impact frame. */
const MUZZLE = (() => {
  const r = rigOf(ANIMS.attack.poses[IMPACT_FRAME]);
  const [a, b] = r.hands;
  return { x: Math.round((a[0] + b[0]) / 2 + 1), y: Math.round((a[1] + b[1]) / 2) };
})();

const art: MonsterArt = {
  id: 'lumen_sprite',
  w: W,
  h: H,
  anchorX: 24,
  anchorY: 38,
  hover: 12,
  muzzle: MUZZLE,
  core: { x: 24, y: 24 },
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
    const o = poses[Math.max(0, Math.min(poses.length - 1, frame))];
    if (o.view === 'left') {
      // mirrored 3/4 view (mid-pirouette): draw facing right around her own axis, then flip
      const q = new PixelCanvas(W, H);
      drawFairy(q, { ...o, view: 'right', x: W - 1 - o.x });
      p.blit(q, 0, 0, { flipX: true });
      return;
    }
    drawFairy(p, o);
  },
  portrait,
};

export default art;
