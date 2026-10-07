// Gölge Suikastçı (shade_assassin) — DARK warrior, 64×64, crouched ninja stance.
//
// A parametric rig: every frame is a Pose (numbers) and draw() paints the parts back-to-front.
// Legs and arms are 2-bone IK chains, the torso leans around the hip, the hood is a rigid
// shape, and the crimson scarf / cloak tails are simulated as waving chains whose phase lags
// behind the body (secondary motion). Proportions never change between frames.

import { PAL } from '../palette';
import { PixelCanvas, type Pt } from '../pixel';
import type { MonsterAnim, MonsterArt } from '../types';

const W = 64;
const H = 64;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- pose

interface Pose {
  /** Hip position (frame px). */
  hx: number;
  hy: number;
  /** Torso lean (rad from vertical, + = forward) and breathing lift of the chest (px). */
  lean: number;
  breath: number;
  /** Head offset relative to the neck. */
  nx: number;
  ny: number;
  /** Feet (frame px). Front = near leg (drawn in front). */
  ffx: number;
  ffy: number;
  bfx: number;
  bfy: number;
  /** Hands (frame px) and dagger angles (rad, 0 = pointing right, + = clockwise/down). */
  fax: number;
  fay: number;
  fa: number;
  bax: number;
  bay: number;
  ba: number;
  /** Scarf: base direction (rad), wave amplitude, wave phase, length multiplier. */
  sDir: number;
  sAmp: number;
  sPh: number;
  sLen: number;
  /** Cloak tail flare 0..1 and lag (px). */
  cFl: number;
  cLag: number;
  /** Eye glow 0..2 (0 = shut), dagger edge glow 0..1. */
  eye: number;
  edgeGlow: number;
  /** Back hand comes around in front of the body (guard). */
  bFront: number;
  /** Glint travelling along the front blade, 0..1 (NaN = none). */
  glint: number;
  /** Shadow afterimages: earlier poses drawn as flat violet silhouettes behind the body (0..1 strength). */
  ghosts: { pose: Pose; k: number; dx: number }[];
  /** Internal: rendering an afterimage (legs dissolve into the shadow). */
  ghostOnly: number;
  /** Spin arcs and crescent slashes to draw this frame (smears). */
  arcs: Arc[];
  slashes: Slash[];
  /** Phase for flutters (any number). */
  t: number;
}

interface Arc {
  /** Center, radius, start/end angle (rad, canvas orientation), thickness (px at the head end). */
  cx: number;
  cy: number;
  r: number;
  a0: number;
  a1: number;
  w: number;
}

interface Slash {
  /** From → to (frame px), sideways bulge (px), max half-width, brightness 0..1 (fades out). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  bulge: number;
  w: number;
  k: number;
}

const NEUTRAL: Pose = {
  hx: 23,
  hy: 43,
  lean: 0.5,
  breath: 0,
  nx: 0,
  ny: 0,
  ffx: 35,
  ffy: 60,
  bfx: 10,
  bfy: 60,
  fax: 42,
  fay: 38,
  fa: -0.45,
  bax: 18,
  bay: 43,
  ba: 2.45,
  sDir: Math.PI + 0.3,
  sAmp: 1,
  sPh: 0,
  sLen: 1,
  cFl: 0,
  cLag: 0,
  eye: 1,
  edgeGlow: 0.5,
  arcs: [],
  slashes: [],
  bFront: 0,
  glint: NaN,
  ghosts: [],
  ghostOnly: 0,
  t: 0,
};

const P = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

function idlePose(f: number, n: number): Pose {
  const t = f / n;
  const s = Math.sin(t * TAU);
  return P({
    breath: s > 0.3 ? 1 : 0,
    hy: NEUTRAL.hy + (s < -0.5 ? 1 : 0),
    fay: NEUTRAL.fay - (s > 0.3 ? 1 : 0),
    bay: NEUTRAL.bay - (s > 0.3 ? 1 : 0),
    sPh: t,
    sAmp: 1,
    cLag: Math.sin((t - 0.2) * TAU) * 0.8,
    eye: f === 5 ? 0.3 : 1,
    glint: f >= 1 && f <= 3 ? (f - 1) / 2 : NaN,
    edgeGlow: 0.35 + 0.4 * (0.5 + 0.5 * Math.cos(t * TAU)),
    t,
  });
}

const ANIMS: Record<MonsterAnim, { fps: number; loop: boolean; poses: Pose[] }> = {
  idle: { fps: 8, loop: true, poses: Array.from({ length: 8 }, (_, f) => idlePose(f, 8)) },

  // Roar: rise and cross the daggers (anticipation) → spin both daggers with arcing smears while
  // the scarf whips up → flourish pose, arms spread, eyes flare → settle back into the crouch.
  roar: {
    fps: 12,
    loop: false,
    poses: [
      P({ sPh: 0, t: 0 }),
      P({ hy: 44, lean: 0.4, fax: 36, fay: 35, fa: -1.6, bax: 34, bay: 37, ba: -1.0, sPh: 0.1, sAmp: 1.2, eye: 1.2, t: 0.1 }),
      P({ hy: 40, hx: 25, lean: 0.25, ffx: 34, bfx: 13, fax: 44, fay: 31, fa: -1.2, bax: 15, bay: 33, ba: -2.4, sDir: Math.PI + 0.6, sPh: 0.2, sAmp: 1.6, eye: 1.4, edgeGlow: 1,
        arcs: [{ cx: 44, cy: 31, r: 7, a0: 0.2, a1: -1.2, w: 2 }, { cx: 15, cy: 33, r: 7, a0: -3.6, a1: -2.4, w: 2 }], t: 0.2 }),
      P({ hy: 39, hx: 25, lean: 0.2, ffx: 34, bfx: 13, fax: 45, fay: 31, fa: 0.4, bax: 14, bay: 33, ba: -4.0, sDir: Math.PI + 0.9, sPh: 0.3, sAmp: 1.8, eye: 1.6, edgeGlow: 1,
        arcs: [{ cx: 45, cy: 31, r: 7, a0: -1.2, a1: 0.4, w: 2 }, { cx: 14, cy: 33, r: 7, a0: -2.4, a1: -4.0, w: 2 }], t: 0.3 }),
      P({ hy: 39, hx: 25, lean: 0.2, ffx: 34, bfx: 13, fax: 45, fay: 31, fa: 2.0, bax: 14, bay: 33, ba: -5.6, sDir: Math.PI + 1.1, sPh: 0.42, sAmp: 1.8, eye: 1.8, edgeGlow: 1,
        arcs: [{ cx: 45, cy: 31, r: 7, a0: 0.4, a1: 2.0, w: 2 }, { cx: 14, cy: 33, r: 7, a0: -4.0, a1: -5.6, w: 2 }], t: 0.42 }),
      P({ hy: 40, hx: 25, lean: 0.25, ffx: 34, bfx: 13, fax: 45, fay: 32, fa: 3.6, bax: 14, bay: 34, ba: -7.2, sDir: Math.PI + 0.9, sPh: 0.54, sAmp: 1.6, eye: 1.8, edgeGlow: 1,
        arcs: [{ cx: 45, cy: 32, r: 7, a0: 2.0, a1: 3.6, w: 2 }, { cx: 14, cy: 34, r: 7, a0: -5.6, a1: -7.2, w: 2 }], t: 0.54 }),
      P({ hy: 45, hx: 23, lean: 0.6, fax: 47, fay: 34, fa: -0.35, bax: 12, bay: 37, ba: 3.5, sDir: Math.PI + 0.75, sPh: 0.66, sAmp: 1.5, cFl: 1, eye: 2, edgeGlow: 1, t: 0.66 }),
      P({ hy: 45, hx: 23, lean: 0.6, fax: 47, fay: 34, fa: -0.35, bax: 12, bay: 37, ba: 3.5, sDir: Math.PI + 0.55, sPh: 0.78, sAmp: 1.3, cFl: 0.7, eye: 2, edgeGlow: 0.9, t: 0.78 }),
      P({ hy: 44, hx: 23, lean: 0.56, fax: 45, fay: 35, fa: -0.45, bax: 15, bay: 40, ba: 2.8, sDir: Math.PI + 0.4, sPh: 0.9, sAmp: 1.1, cFl: 0.3, eye: 1.4, edgeGlow: 0.7, t: 0.9 }),
      P({ sPh: 1.0, t: 1.0 }),
    ],
  },

  // Attack: sink low and coil (anticipation) → explode forward → cross-slash smear →
  // IMPACT: both arms extended, daggers crossed at the end of the X → follow-through → hop back.
  attack: {
    fps: 12,
    loop: false,
    poses: [
      P({ t: 0 }),
      P({ hy: 45, hx: 22, lean: 0.72, ffx: 34, bfx: 10, fax: 30, fay: 41, fa: 2.6, bax: 17, bay: 45, ba: 2.6, sDir: Math.PI + 0.15, sPh: 0.1, cLag: 1, eye: 1.3, edgeGlow: 0.7, t: 0.1 }),
      P({ hy: 47, hx: 20, lean: 0.78, ffx: 33, bfx: 9, fax: 25, fay: 44, fa: 2.9, bax: 14, bay: 46, ba: 2.8, sDir: Math.PI + 0.05, sPh: 0.2, sAmp: 0.7, cLag: 2, eye: 1.6, edgeGlow: 0.9, t: 0.2 }),
      // launch: explode forward, both daggers cocked back over the shoulders
      P({ hy: 41, hx: 29, lean: 0.8, ffx: 40, bfx: 15, fax: 37, fay: 31, fa: -2.5, bax: 39, bay: 33, ba: -2.8, sDir: Math.PI - 0.05, sPh: 0.3, sAmp: 0.6, sLen: 1.15, cLag: -2, cFl: 0.5, eye: 1.8, edgeGlow: 1, t: 0.3 }),
      // smear: the cross-slash rips through the air in front
      P({ hy: 43, hx: 32, lean: 0.75, ffx: 43, bfx: 16, fax: 50, fay: 41, fa: 0.8, bax: 49, bay: 42, ba: 0.3, sDir: Math.PI - 0.05, sPh: 0.4, sAmp: 0.6, sLen: 1.2, cLag: -3, cFl: 0.7, eye: 2, edgeGlow: 1,
        slashes: [{ x0: 49, y0: 22, x1: 61, y1: 44, bulge: 3, w: 2.2, k: 1 }, { x0: 47, y0: 26, x1: 62, y1: 40, bulge: 3.5, w: 1.5, k: 0.7 }], t: 0.4 }),
      // IMPACT: arms fully extended, daggers flung apart at the end of the X
      P({ hy: 43, hx: 33, lean: 0.72, ffx: 44, bfx: 17, fax: 53, fay: 35, fa: -0.55, bax: 52, bay: 38, ba: 0.6, sDir: Math.PI + 0.05, sPh: 0.5, sAmp: 0.8, sLen: 1.2, cLag: -3, cFl: 0.8, eye: 2, edgeGlow: 1,
        slashes: [{ x0: 50, y0: 23, x1: 62, y1: 46, bulge: 2.2, w: 2, k: 0.9 }, { x0: 50, y0: 46, x1: 62, y1: 23, bulge: -2.2, w: 2.4, k: 1 }], t: 0.5 }),
      // follow-through: momentum carries on, trails fade, scarf whips over
      P({ hy: 44, hx: 33, lean: 0.78, ffx: 44, bfx: 17, fax: 50, fay: 43, fa: 0.9, bax: 50, bay: 30, ba: -0.9, sDir: Math.PI + 0.55, sPh: 0.6, sAmp: 1.6, sLen: 1.1, cLag: 3, cFl: 0.5, eye: 1.6, edgeGlow: 0.7,
        slashes: [{ x0: 52, y0: 26, x1: 62, y1: 44, bulge: 2, w: 1.2, k: 0.35 }, { x0: 52, y0: 44, x1: 62, y1: 26, bulge: -2, w: 1.4, k: 0.4 }], t: 0.6 }),
      P({ hy: 44, hx: 29, lean: 0.62, ffx: 39, bfx: 14, fax: 45, fay: 38, fa: -0.3, bax: 25, bay: 42, ba: 2.4, sDir: Math.PI + 0.4, sPh: 0.7, sAmp: 1.3, cLag: 2, eye: 1.3, edgeGlow: 0.6, t: 0.7 }),
      P({ hy: 43, hx: 24, lean: 0.51, ffx: 35, bfx: 10, fax: 42, fay: 38, fa: -0.45, bax: 19, bay: 43, ba: 2.4, sPh: 0.8, cLag: 1, t: 0.8 }),
    ],
  },

  // Hit: snapped back off balance, eyes squeezed, arms thrown, scarf flicks forward, recover.
  hit: {
    fps: 10,
    loop: false,
    poses: [
      P({ hx: 21, hy: 42, lean: 0.05, nx: -1, ny: 0, ffx: 32, bfx: 10, fax: 31, fay: 30, fa: -1.9, bax: 14, bay: 36, ba: 3.6, sDir: 4.25, sAmp: 1.1, sPh: 0.15, sLen: 0.8, cLag: 3, cFl: 0.4, eye: 0, edgeGlow: 0.2, t: 0.15 }),
      P({ hx: 21, hy: 43, lean: 0.2, ffx: 32, bfx: 10, fax: 34, fay: 33, fa: -1.4, bax: 16, bay: 40, ba: 3.0, sDir: 3.95, sAmp: 1.2, sPh: 0.3, sLen: 0.85, cLag: 2, eye: 0, edgeGlow: 0.3, t: 0.3 }),
      P({ hx: 22, hy: 44, lean: 0.45, ffx: 32, bfx: 10, fax: 37, fay: 36, fa: -0.8, bax: 17, bay: 43, ba: 2.5, sDir: 3.65, sAmp: 1.1, sPh: 0.45, cLag: 1, eye: 0.6, edgeGlow: 0.4, t: 0.45 }),
      P({ sPh: 0.6, t: 0.6 }),
    ],
  },

  // Guard: low crouch, daggers crossed in an X before the chest, scarf drifting. Calm loop.
  guard: {
    fps: 5,
    loop: true,
    poses: [0, 1, 2, 3].map((f) => {
      const t = f / 4;
      const s = Math.sin(t * TAU);
      return P({
        hy: 46 + (s > 0.5 ? -1 : 0),
        hx: 23,
        lean: 0.45,
        ffx: 32,
        bfx: 10,
        fax: 37,
        fay: 44 + (s > 0.5 ? -1 : 0),
        fa: -0.62,
        bax: 46,
        bay: 44 + (s > 0.5 ? -1 : 0),
        ba: -2.52,
        bFront: 1,
        sDir: Math.PI + 0.1,
        sAmp: 0.6,
        sPh: t,
        cLag: Math.sin((t - 0.25) * TAU) * 0.6,
        eye: 0.9,
        edgeGlow: 0.4 + 0.2 * s,
        t,
      });
    }),
  },
};

// shadow-step afterimages on the lunge: each strike frame trails the poses it came from
{
  const a = ANIMS.attack.poses;
  a[3].ghosts = [{ pose: a[3], k: 0.4, dx: -6 }];
  a[4].ghosts = [
    { pose: a[3], k: 0.3, dx: -9 },
    { pose: a[4], k: 0.7, dx: -4 },
  ];
  a[5].ghosts = [{ pose: a[4], k: 0.45, dx: -5 }];
}

// ---------------------------------------------------------------- hand-pixelled hood

// Hood in profile (facing right), pointed tip trailing back, face lost in shadow, crimson mask.
// Eyes are painted per frame on row 7 (cols 8-9 near eye, col 11 far eye).
const HOOD = [
  'm4............',
  '.s43..........',
  '.2s44433......',
  '.23s4444321...',
  '123s44443321..',
  '1234444333kkk1',
  '12344433kkkkk.',
  '1234433kkkkkk.',
  'RC33332kkkkk..',
  'CPR333CPCRRRR.',
  'RRCr32RCRRRRr.',
  '.rRr22rrrrrr..',
  '..rr111.......',
];
const HOOD_KEY: Record<string, number> = {
  k: PAL.ink,
  '1': PAL.night1,
  '2': PAL.night2,
  '3': PAL.night3,
  '4': PAL.night4,
  s: PAL.steel,
  m: PAL.mist,
  r: PAL.crim1,
  R: PAL.crim2,
  C: PAL.crim3,
  P: PAL.crim4,
};

// ---------------------------------------------------------------- helpers

type Canvas = PixelCanvas;

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

function clip(q: Canvas, fn: (t: Canvas) => void): void {
  const t = new PixelCanvas(q.w, q.h);
  fn(t);
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      if (!q.isOpaque(x, y)) continue;
      const c = t.get(x, y);
      if (c !== null) q.set(x, y, c);
    }
}

function edge(q: Canvas, dx: number, dy: number, c: number): void {
  const src = q.clone();
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) if (src.isOpaque(x, y) && !src.isOpaque(x + dx, y + dy)) q.set(x, y, c);
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

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Waving chain (scarf tail): starts at `o`, heads in `dir`, each link bends with a travelling wave. */
function chain(o: Pt, dir: number, n: number, seg: number, amp: number, ph: number, droop: number): Pt[] {
  const pts: Pt[] = [o];
  let [x, y] = o;
  for (let i = 1; i <= n; i++) {
    const f = i / n;
    const a = dir + Math.sin((ph - f * 0.85) * TAU) * 0.42 * amp * Math.min(1, f * 1.6) - droop * f;
    x += Math.cos(a) * seg;
    y += Math.sin(a) * seg;
    pts.push([x, y]);
  }
  return pts;
}

// ---------------------------------------------------------------- the rig

const THIGH = 13;
const SHIN = 13;
const UPPER = 8.5;
const FORE = 8;
const SPINE = 17;

function drawAssassin(p: Canvas, o: Pose): void {
  const hip: Pt = [o.hx, o.hy];
  const sd: Pt = [Math.sin(o.lean), -Math.cos(o.lean)]; // spine direction (hip → neck)
  const sn: Pt = [-sd[1], sd[0]]; // spine normal: + = belly side, - = back side
  /** Point along the spine (d px from the hip) offset `side` px toward the belly. */
  const along = (d: number, side = 0): Pt => [hip[0] + sd[0] * d + sn[0] * side, hip[1] + sd[1] * d + sn[1] * side - (d > 6 ? o.breath : 0)];
  const neck = along(SPINE);
  const head: Pt = [Math.round(neck[0] + sd[0] * 4 + 1.5 + o.nx), Math.round(neck[1] + sd[1] * 4 + o.ny)];
  const shF = along(12.5, 1.5);
  const shB = along(13, -1);

  // ------------------------------------------------ shadow afterimages (Gölge Adımı)
  for (const g of o.ghosts) {
    const t = new PixelCanvas(p.w, p.h);
    drawAssassin(t, { ...g.pose, ghosts: [], slashes: [], arcs: [], glint: NaN, ghostOnly: 1 });
    // flat violet silhouette with a brighter rim: an anime afterimage, not a second body
    for (let y = 0; y < t.h; y++)
      for (let x = 0; x < t.w; x++) {
        if (!t.isOpaque(x, y) || t.get(x, y) === PAL.ink) continue;
        const X = x + g.dx;
        const rim = !t.isOpaque(x - 1, y) || !t.isOpaque(x + 1, y) || !t.isOpaque(x, y - 1) || !t.isOpaque(x, y + 1) || t.get(x - 1, y) === PAL.ink || t.get(x, y - 1) === PAL.ink;
        p.set(X, y, rim ? (g.k > 0.5 ? PAL.void3 : PAL.void2) : g.k > 0.5 ? PAL.void1 : PAL.void0);
      }
  }

  // ------------------------------------------------ scarf tails (chains that lag behind the body)
  const knot: Pt = [head[0] - 5, head[1] + 3];
  const tail1 = chain(knot, o.sDir, 11, 2.2 * o.sLen, o.sAmp * 1.3, o.sPh, 0.15);
  const tail2 = chain([knot[0] + 0.5, knot[1] + 1.5], o.sDir - 0.4, 8, 2.1 * o.sLen, o.sAmp * 1.5, o.sPh - 0.22, 0.2);
  layer(
    p,
    (q) => {
      q.stroke(tail2, 2.4, 1.4, PAL.crim1);
      edge(q, 0, -1, PAL.crim2);
      edge(q, 0, 1, PAL.crim0);
      const e = tail2[tail2.length - 1];
      q.set(e[0] - 1, e[1] + 1, PAL.crim1);
    },
    null,
  );

  // ------------------------------------------------ limb + dagger painters
  const drawArm = (q: Canvas, sh: Pt, hand: Pt, near: boolean) => {
    const el = ik(sh[0], sh[1], hand[0], hand[1], UPPER, FORE, 1);
    const c0 = near ? PAL.night2 : PAL.night0;
    q.stroke([sh, el], 3.6, 3, c0);
    q.stroke([el, hand], 3, 2.6, c0);
    edge(q, 1, 1, near ? PAL.night1 : PAL.night0);
    edge(q, 0, -1, near ? PAL.night4 : PAL.night1);
    edge(q, -1, 0, near ? PAL.night3 : PAL.night1);
    // violet bracer on the forearm
    clip(q, (t) => t.stroke([[lerp(el[0], hand[0], 0.35), lerp(el[1], hand[1], 0.35)], [lerp(el[0], hand[0], 0.75), lerp(el[1], hand[1], 0.75)]], 3, 3, near ? PAL.void2 : PAL.void1));
    // glove
    q.disc(hand[0], hand[1], 1.6, near ? PAL.night1 : PAL.night0);
    q.set(hand[0] - 1, hand[1] - 1, near ? PAL.night3 : PAL.night2);
  };
  const drawDagger = (q: Canvas, hand: Pt, a: number, near: boolean) => {
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    let nx = -uy;
    let ny = ux;
    if (ny > 0 || (ny === 0 && nx > 0)) {
      nx = -nx;
      ny = -ny;
    } // n = the side facing up (toward the light)
    const L = 9.5;
    const b0: Pt = [hand[0] + ux * 2, hand[1] + uy * 2];
    const tip: Pt = [hand[0] + ux * L, hand[1] + uy * L];
    // grip wrap + pommel behind the fist
    q.set(hand[0] - ux * 2, hand[1] - uy * 2, PAL.crim2);
    q.set(hand[0] - ux * 3, hand[1] - uy * 3, near ? PAL.mist : PAL.steel);
    // blade: a lit steel row and a glowing violet cutting edge row, white point
    q.line(b0[0], b0[1], tip[0] - ux, tip[1] - uy, near ? PAL.mist : PAL.steel);
    q.line(b0[0] - nx, b0[1] - ny, tip[0] - ux * 1.6 - nx, tip[1] - uy * 1.6 - ny, o.edgeGlow > 0.6 ? PAL.void4 : PAL.void3);
    q.set(tip[0], tip[1], o.edgeGlow > 0.6 ? PAL.white : PAL.mist);
    q.set(b0[0] + ux * 2, b0[1] + uy * 2, near ? PAL.white : PAL.mist);
    // crossguard
    q.line(b0[0] + nx * 1.8, b0[1] + ny * 1.8, b0[0] - nx * 1.8, b0[1] - ny * 1.8, near ? PAL.night3 : PAL.night2);
    q.set(b0[0] + nx * 1.8, b0[1] + ny * 1.8, PAL.steel);
  };
  const drawLeg = (q: Canvas, hipP: Pt, foot: Pt, near: boolean) => {
    const ank: Pt = [foot[0], foot[1] - 1.5];
    const knee = ik(hipP[0], hipP[1], ank[0], ank[1], THIGH, SHIN, -1);
    const c0 = PAL.night1;
    q.stroke([hipP, knee], 5, 4, c0);
    q.stroke([knee, ank], 4, 3, c0);
    edge(q, 0, -1, near ? PAL.void2 : PAL.void1);
    edge(q, -1, 0, near ? PAL.void2 : PAL.void1);
    if (near) {
      clip(q, (t) => t.stroke([[lerp(hipP[0], knee[0], 0.15), lerp(hipP[1], knee[1], 0.15) - 1], [lerp(hipP[0], knee[0], 0.8), lerp(hipP[1], knee[1], 0.8) - 1.2]], 1.2, 1, PAL.void3));
    }
    // wrapped shin + boot
    const b1: Pt = [lerp(knee[0], ank[0], 0.4), lerp(knee[1], ank[1], 0.4)];
    clip(q, (t) => {
      t.stroke([b1, ank], 5, 5, near ? PAL.night2 : PAL.night1);
      t.line(b1[0] - 1, b1[1], ank[0] - 1.5, ank[1], near ? PAL.night3 : PAL.night2);
      for (const f of [0.55, 0.78]) {
        const x = lerp(knee[0], ank[0], f);
        const y = lerp(knee[1], ank[1], f);
        t.line(x - 2, y + 0.6, x + 2, y - 0.6, near ? PAL.night1 : PAL.night0);
      }
    });
    // foot (toes forward)
    const toe = foot[0] + (near ? 4 : 3);
    q.poly(
      [
        [ank[0] - 1.8, ank[1] - 0.5],
        [ank[0] + 1.2, ank[1] - 0.8],
        [toe, foot[1] - 0.2],
        [toe, foot[1] + 0.6],
        [ank[0] - 1.8, foot[1] + 0.6],
      ],
      PAL.night1,
    );
    q.set(ank[0] - 1, ank[1] - 1, near ? PAL.night3 : PAL.night1);
    // knee guard
    q.disc(knee[0] + 0.2, knee[1] - 0.2, 1.8, near ? PAL.night2 : PAL.night1);
    q.set(knee[0] - 0.6, knee[1] - 1.2, near ? PAL.steel : PAL.night2);
  };

  // ------------------------------------------------ back dagger, back arm, back leg
  const bHand: Pt = [o.bax, o.bay];
  if (!o.bFront) {
    layer(p, (q) => drawDagger(q, bHand, o.ba, false), PAL.ink);
    layer(p, (q) => drawArm(q, shB, bHand, false), PAL.ink);
  }
  if (!o.ghostOnly) layer(p, (q) => drawLeg(q, along(0, -1.5), [o.bfx, o.bfy], false), PAL.ink);

  // ------------------------------------------------ torso (dark bodysuit + crimson sash)
  layer(
    p,
    (q) => {
      const pts: Pt[] = [along(-1, -3.5), along(5, -4), along(10, -4.2), along(14, -2.5), along(15, 1.5), along(10, 4), along(5, 3.5), along(-1, 3.5)];
      q.poly(pts, PAL.void1);
      edge(q, 1, 0, PAL.void0);
      edge(q, 0, 1, PAL.void0);
      clip(q, (t) => {
        t.poly([along(1, -4.5), along(3.5, -4.5), along(3.5, 4.5), along(1, 4.5)], PAL.crim2);
        t.line(...along(1.2, -4.5), ...along(1.2, 4.5), PAL.crim1);
        t.line(...along(3.3, -4.5), ...along(3.3, 4.5), PAL.crim3);
        t.line(...along(13, 2.5), ...along(5, -3.5), PAL.night2);
      });
    },
    PAL.ink,
  );

  // ------------------------------------------------ cloak: mantle over the back, tattered tails trailing
  layer(
    p,
    (q) => {
      const fl = o.cFl;
      const lag = o.cLag;
      const tails: Pt[] = [];
      const n = 3;
      const bases: Pt[] = [];
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1);
        const base = along(lerp(1.5, 10.5, f), -5.5);
        const len = [14, 12, 9][i] + fl * 4;
        const ang = Math.PI * 0.86 - fl * 0.3 + lag * 0.07 + Math.sin((o.t - f * 0.6) * TAU) * 0.12;
        bases.push(base);
        tails.push([base[0] + Math.cos(ang) * len, base[1] + Math.sin(ang) * len]);
      }
      const notch = (a: number, b: number): Pt => {
        const bx = (bases[a][0] + bases[b][0]) / 2;
        const by = (bases[a][1] + bases[b][1]) / 2;
        const tx = (tails[a][0] + tails[b][0]) / 2;
        const ty = (tails[a][1] + tails[b][1]) / 2;
        return [lerp(bx, tx, 0.5), lerp(by, ty, 0.5)];
      };
      const shape: Pt[] = [
        along(15.5, -1.5),
        along(14, -4.5),
        along(11.5, -6),
        tails[2],
        notch(1, 2),
        tails[1],
        notch(0, 1),
        tails[0],
        along(0, -1),
        along(8, 1.5),
        along(11, 5),
        along(13.5, 5),
        along(15.5, 2.5),
      ];
      q.poly(shape, PAL.night2);
      edge(q, 1, 1, PAL.night1);
      edge(q, 0, 1, PAL.night1);
      edge(q, -1, -1, PAL.night3);
      edge(q, 0, -1, PAL.night4);
      clip(q, (t) => {
        // highlight running down the hunched back, folds toward each tail
        t.stroke([along(14.5, -3.5), along(10, -4.8), along(6, -4.8)], 1.6, 1, PAL.night4);
        // folds running into each notch
        for (const [a, b] of [
          [0, 1],
          [1, 2],
        ] as const) {
          const nn = notch(a, b);
          const st = along(lerp(4, 11, a / 2), -2);
          t.line(st[0], st[1], nn[0], nn[1], PAL.night1);
          t.line(st[0] - 1, st[1], nn[0] - 1, nn[1] - 0.5, PAL.night3);
        }
        t.line(...along(13.5, 2.5), ...along(8, 0.5), PAL.night1);
      });
      // violet lining flashes at the tattered tips
      for (const tp of tails) {
        q.paint(tp[0], tp[1], PAL.void2);
        q.paint(tp[0] + 1, tp[1] - 1, PAL.void1);
      }
    },
    PAL.ink,
  );

  // ------------------------------------------------ front leg
  if (!o.ghostOnly) layer(p, (q) => drawLeg(q, along(0, 1.5), [o.ffx, o.ffy], true), PAL.ink);

  // ------------------------------------------------ scarf main tail
  layer(
    p,
    (q) => {
      q.stroke(tail1, 2.8, 1.6, PAL.crim2);
      edge(q, 0, -1, PAL.crim3);
      edge(q, -1, 0, PAL.crim3);
      edge(q, 0, 1, PAL.crim1);
      for (let i = 2; i < tail1.length - 2; i += 3) q.paint(tail1[i][0], tail1[i][1] - 1, PAL.crim4);
      const e = tail1[tail1.length - 1];
      q.set(e[0] - 1, e[1] + 1, PAL.crim2);
    },
    PAL.ink,
  );

  // ------------------------------------------------ head: hood (hand-pixelled) with glowing eyes + mask
  layer(
    p,
    (q) => {
      const X = head[0] - 7;
      const Y = head[1] - 7;
      q.stamp(HOOD, HOOD_KEY, X, Y);
      const e = o.eye;
      if (e > 0.5) {
        q.set(X + 8, Y + 7, e > 1.2 ? PAL.white : PAL.void3);
        q.set(X + 9, Y + 7, e > 0.9 ? PAL.white : PAL.void4);
        q.set(X + 10, Y + 7, PAL.void2);
        q.set(X + 11, Y + 7, e > 1.2 ? PAL.void4 : PAL.void3);
        if (e > 1.4) q.set(X + 8, Y + 6, PAL.void3).set(X + 9, Y + 6, PAL.void2);
      } else if (e > 0.1) {
        q.set(X + 8, Y + 7, PAL.void2).set(X + 9, Y + 7, PAL.void1);
      } else {
        q.set(X + 8, Y + 8, PAL.void2).set(X + 9, Y + 7, PAL.void2).set(X + 10, Y + 7, PAL.void1);
      }
    },
    PAL.ink,
  );

  // ------------------------------------------------ front arm + front dagger
  const fHand: Pt = [o.fax, o.fay];
  if (o.bFront) {
    layer(p, (q) => drawArm(q, shB, bHand, false), PAL.ink);
    layer(p, (q) => drawDagger(q, bHand, o.ba, true), PAL.ink);
  }
  layer(p, (q) => drawArm(q, shF, fHand, true), PAL.ink);
  layer(p, (q) => drawDagger(q, fHand, o.fa, true), PAL.ink);
  if (!Number.isNaN(o.glint)) {
    // a star glint sliding along the front blade
    const g = 2.5 + o.glint * 6.5;
    const gx = fHand[0] + Math.cos(o.fa) * g;
    const gy = fHand[1] + Math.sin(o.fa) * g;
    p.set(gx, gy, PAL.white);
  }

  // ------------------------------------------------ outline
  p.outline(PAL.ink);

  // ------------------------------------------------ glow pass: slash smears (unoutlined light)
  for (const a of o.arcs) {
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const f = i / steps; // 0 = tail, 1 = head
      const ang = a.a0 + (a.a1 - a.a0) * f;
      const w = Math.max(0.5, a.w * f);
      for (let d = -w; d <= w; d += 0.5) {
        const x = a.cx + Math.cos(ang) * (a.r + d);
        const y = a.cy + Math.sin(ang) * (a.r + d);
        const core = Math.abs(d) < w * 0.45 && f > 0.25;
        if (p.isOpaque(x, y) && !core) continue;
        p.set(x, y, core ? (f > 0.7 ? PAL.white : PAL.void4) : f > 0.45 ? PAL.void3 : PAL.void2);
      }
    }
  }
  for (const sl of o.slashes) {
    const dx = sl.x1 - sl.x0;
    const dy = sl.y1 - sl.y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const steps = Math.ceil(len * 3);
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const env = Math.pow(Math.sin(Math.PI * f), 0.7);
      const cx = sl.x0 + dx * f + nx * sl.bulge * Math.sin(Math.PI * f);
      const cy = sl.y0 + dy * f + ny * sl.bulge * Math.sin(Math.PI * f);
      const w = sl.w * env;
      for (let d = -w; d <= w + 0.01; d += 0.5) {
        const x = cx + nx * d;
        const y = cy + ny * d;
        const core = Math.abs(d) <= w * 0.4;
        const c = sl.k > 0.8 ? (core ? PAL.white : PAL.void4) : sl.k > 0.5 ? (core ? PAL.void4 : PAL.void3) : core ? PAL.void3 : PAL.void2;
        p.set(x, y, c);
      }
    }
  }
  if (o.slashes.length) {
    // the blades ride on top of their own smear
    for (const [hand, a] of [
      [bHand, o.ba],
      [fHand, o.fa],
    ] as const) {
      const t = new PixelCanvas(p.w, p.h);
      drawDagger(t, hand, a, true);
      t.outline(PAL.ink);
      p.blit(t, 0, 0);
    }
  }
  if (o.eye > 1.5) {
    const [X, Y] = head;
    for (let i = 0; i < 3; i++) if (!p.isOpaque(X + 8 + i, Y + 1)) p.set(X + 8 + i, Y + 1, i === 0 ? PAL.void4 : PAL.void3);
  }
}

// ---------------------------------------------------------------- portrait (44×34)

function portrait(p: Canvas): void {
  // night sky with a blood moon behind the hood
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 44; x++) {
      let c: number = y < 14 ? PAL.night1 : PAL.night0;
      if (y >= 10 && y < 18 && PixelCanvas.ditherAt(x, y, 18 - y)) c = PAL.night1;
      const d = Math.hypot(x - 25, y - 12);
      if (d < 12.5) c = PAL.crim0;
      if (Math.hypot(x - 23.5, y - 10.5) < 9.5) c = PAL.crim1;
      p.set(x, y, c);
    }
  const big = new PixelCanvas(W, H);
  drawAssassin(big, P({ eye: 2, edgeGlow: 1, sPh: 0.3, sAmp: 1.3, t: 0.3, fax: 41, fay: 37, fa: -0.6 }));
  const cx = 13;
  const cy = 13;
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 44; x++) {
      const c = big.get(cx + x, cy + y);
      if (c !== null) p.set(x, y, c);
    }
  p.set(4, 3, PAL.mist).set(9, 7, PAL.steel).set(41, 2, PAL.steel).set(38, 6, PAL.mist);
}

// ---------------------------------------------------------------- export

const IMPACT_FRAME = 5;
/** Muzzle: midway between the two dagger tips in the impact frame. */
const IMPACT_TIPS = (() => {
  const o = ANIMS.attack.poses[IMPACT_FRAME];
  const L = 9.5;
  const fx = o.fax + Math.cos(o.fa) * L;
  const fy = o.fay + Math.sin(o.fa) * L;
  const bx = o.bax + Math.cos(o.ba) * L;
  const by = o.bay + Math.sin(o.ba) * L;
  return { x: Math.round((fx + bx) / 2), y: Math.round((fy + by) / 2) };
})();

const art: MonsterArt = {
  id: 'shade_assassin',
  w: W,
  h: H,
  anchorX: 24,
  anchorY: 60,
  hover: 0,
  muzzle: IMPACT_TIPS,
  core: { x: 28, y: 38 },
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
    drawAssassin(p, poses[Math.max(0, Math.min(poses.length - 1, frame))]);
  },
  portrait,
};

export default art;

