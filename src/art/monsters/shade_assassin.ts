// Gölge Suikastçı (shade_assassin) — DARK warrior, 64×64, crouched ninja stance.
//
// A parametric rig: every frame is a Pose (numbers) and draw() paints the parts back-to-front.
// Legs and arms are 2-bone IK chains (3-4px limbs with a visible knee/elbow break), the torso
// leans around the hip, the hood is a hand-pixelled stamp, and the crimson scarf / sash / cloak
// tails are waving chains whose phase lags behind the body (secondary motion).
//
// Readability on the night-blue arena: cloth is lit in night3/night4/steel (key light from the
// top-left) and every silhouette edge facing away from the light gets a void3 rim light, so the
// figure separates from the tiles at 1×. Proportions never change between frames.

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
  /** Feet: (x, ground line y) under the ankle, and foot tilt (rad, + = toes rotate down / heel up).
   *  A tilted foot keeps its lowest point on its ground line. Front = near leg (drawn in front). */
  ffx: number;
  ffy: number;
  fft: number;
  bfx: number;
  bfy: number;
  bft: number;
  /** Hands (frame px) and dagger angles (rad, 0 = pointing right, + = clockwise/down). */
  fax: number;
  fay: number;
  fa: number;
  bax: number;
  bay: number;
  ba: number;
  /** Far arm layering: 0 = sleeve tucked behind the torso, glove + reverse dagger held in front of
   *  the belly; 1 = whole arm outside the cloak (spread / drawn back); 2 = whole arm in front of the
   *  head; 3 = sleeve behind the torso, glove + dagger in front of the head (guard). */
  bLayer: number;
  /** Scarf: base direction (rad), wave amplitude, wave phase, length multiplier. */
  sDir: number;
  sAmp: number;
  sPh: number;
  sLen: number;
  /** Guard huddle 0..1: scarf wrapped forward over the shoulder, cloak pulled around the front. */
  wrap: number;
  /** Cloak tail flare 0..1 and lag (px). */
  cFl: number;
  cLag: number;
  /** Eye glow 0..2 (0 = shut), dagger edge glow 0..1. */
  eye: number;
  edgeGlow: number;
  /** Glint travelling along the front blade, 0..1 (NaN = none). */
  glint: number;
  /** Shadow afterimages: earlier poses drawn as flat violet silhouettes behind the body. */
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
  /** Light only on empty pixels: the slash reads as BEHIND the body, arms and blades. */
  behind?: boolean;
}

const NEUTRAL: Pose = {
  hx: 23,
  hy: 43,
  lean: 0.5,
  breath: 0,
  nx: 0,
  ny: 0,
  ffx: 33,
  ffy: 60,
  fft: 0,
  bfx: 10,
  bfy: 60,
  bft: 0.35,
  fax: 42,
  fay: 38,
  fa: -0.45,
  bax: 35,
  bay: 42,
  ba: 2.75,
  bLayer: 0,
  sDir: Math.PI + 0.3,
  sAmp: 1,
  sPh: 0,
  sLen: 1,
  wrap: 0,
  cFl: 0,
  cLag: 0,
  eye: 1,
  edgeGlow: 0.5,
  glint: NaN,
  ghosts: [],
  ghostOnly: 0,
  arcs: [],
  slashes: [],
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

/** Impact X-slash: center (also the exported muzzle) and half-size. */
const X_C: Pt = [57, 34];
const X_R = 5.5;
const xSlash = (k: number, w: number, bulge: number): Slash[] => [
  { x0: X_C[0] - X_R, y0: X_C[1] - X_R - 0.5, x1: X_C[0] + X_R, y1: X_C[1] + X_R + 0.5, bulge, w, k, behind: true },
  { x0: X_C[0] - X_R, y0: X_C[1] + X_R + 0.5, x1: X_C[0] + X_R, y1: X_C[1] - X_R - 0.5, bulge: -bulge, w: w * 1.1, k, behind: true },
];

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
      P({ bLayer: 1, hy: 40, hx: 25, lean: 0.25, ffx: 34, bfx: 13, bft: 0.2, fax: 44, fay: 31, fa: -1.2, bax: 15, bay: 33, ba: -2.4, sDir: Math.PI + 0.6, sPh: 0.2, sAmp: 1.6, eye: 1.4, edgeGlow: 1,
        arcs: [{ cx: 44, cy: 31, r: 7, a0: 0.2, a1: -1.2, w: 2 }, { cx: 15, cy: 33, r: 7, a0: -3.6, a1: -2.4, w: 2 }], t: 0.2 }),
      P({ bLayer: 1, hy: 39, hx: 25, lean: 0.2, ffx: 34, bfx: 13, bft: 0.2, fax: 45, fay: 31, fa: 0.4, bax: 14, bay: 33, ba: -4.0, sDir: Math.PI + 0.9, sPh: 0.3, sAmp: 1.8, eye: 1.6, edgeGlow: 1,
        arcs: [{ cx: 45, cy: 31, r: 7, a0: -1.2, a1: 0.4, w: 2 }, { cx: 14, cy: 33, r: 7, a0: -2.4, a1: -4.0, w: 2 }], t: 0.3 }),
      P({ bLayer: 1, hy: 39, hx: 25, lean: 0.2, ffx: 34, bfx: 13, bft: 0.2, fax: 45, fay: 31, fa: 2.0, bax: 14, bay: 33, ba: -5.6, sDir: Math.PI + 1.1, sPh: 0.42, sAmp: 1.8, eye: 1.8, edgeGlow: 1,
        arcs: [{ cx: 45, cy: 31, r: 7, a0: 0.4, a1: 2.0, w: 2 }, { cx: 14, cy: 33, r: 7, a0: -4.0, a1: -5.6, w: 2 }], t: 0.42 }),
      P({ bLayer: 1, hy: 40, hx: 25, lean: 0.25, ffx: 34, bfx: 13, bft: 0.2, fax: 45, fay: 32, fa: 3.6, bax: 14, bay: 34, ba: -7.2, sDir: Math.PI + 0.9, sPh: 0.54, sAmp: 1.6, eye: 1.8, edgeGlow: 1,
        arcs: [{ cx: 45, cy: 32, r: 7, a0: 2.0, a1: 3.6, w: 2 }, { cx: 14, cy: 34, r: 7, a0: -5.6, a1: -7.2, w: 2 }], t: 0.54 }),
      P({ bLayer: 1, hy: 45, hx: 23, lean: 0.6, fax: 47, fay: 34, fa: -0.35, bax: 12, bay: 38, ba: 3.5, sDir: Math.PI + 0.75, sPh: 0.66, sAmp: 1.5, cFl: 1, eye: 2, edgeGlow: 1, t: 0.66 }),
      P({ bLayer: 1, hy: 45, hx: 23, lean: 0.6, fax: 47, fay: 34, fa: -0.35, bax: 12, bay: 38, ba: 3.5, sDir: Math.PI + 0.55, sPh: 0.78, sAmp: 1.3, cFl: 0.7, eye: 2, edgeGlow: 0.9, t: 0.78 }),
      P({ hy: 44, hx: 23, lean: 0.56, fax: 45, fay: 35, fa: -0.45, bax: 31, bay: 43, ba: 2.7, sDir: Math.PI + 0.4, sPh: 0.9, sAmp: 1.1, cFl: 0.3, eye: 1.4, edgeGlow: 0.7, t: 0.9 }),
      P({ sPh: 1.0, t: 1.0 }),
    ],
  },

  // Attack (Gölge Adımı lunge): sink and coil, rear heel up (anticipation) → the rear leg drives
  // off fully extended, front knee punches forward → airborne, cross-slash rips through the air →
  // IMPACT: front foot planted 8px ahead, rear leg trailing straight, both arms extended, the X
  // glowing just past the blade tips → land deep on the bent front knee → hop back to the crouch.
  attack: {
    fps: 12,
    loop: false,
    poses: [
      P({ t: 0 }),
      P({ bLayer: 1, hy: 45, hx: 22, lean: 0.68, ffx: 35, bfx: 10, bft: 0.45, fax: 33, fay: 41, fa: 2.75, bax: 17, bay: 46, ba: 2.5, sDir: Math.PI + 0.15, sPh: 0.1, cLag: 1, eye: 1.3, edgeGlow: 0.7, t: 0.1 }),
      // deep coil: hips 2px lower, rear heel up, both blades drawn back low
      P({ bLayer: 1, hy: 49, hx: 20, lean: 0.86, ffx: 34, bfx: 10, bft: 0.95, fax: 27, fay: 46, fa: 2.95, bax: 15, bay: 48, ba: 2.7, sDir: Math.PI + 0.05, sPh: 0.2, sAmp: 0.7, cLag: 2, eye: 1.6, edgeGlow: 0.9, t: 0.2 }),
      // launch: rear leg fully extended, toe pointed and leaving the ground; front knee drives forward
      P({ hy: 42, hx: 27, lean: 0.78, ffx: 37, ffy: 53, fft: 0.35, bfx: 7, bfy: 57, bft: 2.25, fax: 34, fay: 30, fa: -2.55, bax: 31, bay: 33, ba: -2.85, sDir: Math.PI - 0.05, sPh: 0.3, sAmp: 0.6, sLen: 1.15, cLag: 2, cFl: 0.5, eye: 1.8, edgeGlow: 1, t: 0.3 }),
      // airborne: both feet off the ground, rear leg trailing straight back, the cross-slash smear in front
      P({ hy: 43, hx: 30, lean: 0.55, ffx: 41, ffy: 57, fft: 0.25, bfx: 7, bfy: 54, bft: 2.3, fax: 47, fay: 40, fa: 0.75, bax: 46, bay: 36, ba: 0.15, sDir: Math.PI - 0.05, sPh: 0.4, sAmp: 0.6, sLen: 1.2, cLag: 3, cFl: 0.7, eye: 2, edgeGlow: 1,
        slashes: [{ x0: 49, y0: 22, x1: 61, y1: 45, bulge: 3.5, w: 2.2, k: 1 }, { x0: 48, y0: 27, x1: 62, y1: 40, bulge: 3.5, w: 1.5, k: 0.7, behind: true }], t: 0.4 }),
      // IMPACT: front foot planted 8px ahead, rear leg straight behind, arms fully extended, X behind the blades
      P({ hy: 46, hx: 31, lean: 0.36, ffx: 43, ffy: 60, fft: 0, bfx: 7, bfy: 59, bft: 2.0, fax: 48, fay: 30, fa: -0.8, bax: 47, bay: 39, ba: 0.8, sDir: Math.PI + 0.05, sPh: 0.5, sAmp: 0.8, sLen: 1.2, cLag: 0.5, cFl: 0.45, eye: 2, edgeGlow: 1,
        slashes: xSlash(1, 2.1, 1), t: 0.5 }),
      // land: weight drops onto the bent front knee (same foot spot), rear knee sinks, blades follow through
      P({ hy: 48, hx: 31, lean: 0.5, ffx: 43, ffy: 60, fft: 0, bfx: 9, bfy: 60, bft: 0.95, fax: 47, fay: 42, fa: 0.95, bax: 48, bay: 30, ba: -0.95, sDir: Math.PI + 0.55, sPh: 0.6, sAmp: 1.6, sLen: 1.1, cLag: -2, cFl: 0.3, eye: 1.6, edgeGlow: 0.7,
        slashes: xSlash(0.45, 1.4, 0.8), t: 0.6 }),
      // hop back toward the crouch (both feet just off the ground)
      P({ hy: 42, hx: 27, lean: 0.55, ffx: 39, ffy: 58, fft: 0.2, bfx: 11, bfy: 58, bft: 0.6, fax: 45, fay: 37, fa: -0.3, bax: 38, bay: 40, ba: 2.6, sDir: Math.PI + 0.4, sPh: 0.7, sAmp: 1.3, cLag: 2, eye: 1.3, edgeGlow: 0.6, t: 0.7 }),
      P({ hy: 44, hx: 24, lean: 0.52, ffx: 35, bfx: 10, fax: 42, fay: 38, fa: -0.45, bax: 35, bay: 42, ba: 2.75, sPh: 0.8, cLag: 1, t: 0.8 }),
    ],
  },

  // Hit: snapped back off balance, eyes squeezed, arms thrown, scarf flicks forward, recover.
  hit: {
    fps: 10,
    loop: false,
    poses: [
      P({ bLayer: 1, hx: 21, hy: 42, lean: 0.05, nx: -1, ny: 0, ffx: 32, bfx: 10, bft: 0.1, fax: 31, fay: 30, fa: -1.9, bax: 14, bay: 36, ba: 3.6, sDir: 4.25, sAmp: 1.1, sPh: 0.15, sLen: 0.8, cLag: 3, cFl: 0.4, eye: 0, edgeGlow: 0.2, t: 0.15 }),
      P({ bLayer: 1, hx: 21, hy: 43, lean: 0.2, ffx: 32, bfx: 10, bft: 0.2, fax: 34, fay: 33, fa: -1.4, bax: 16, bay: 40, ba: 3.0, sDir: 3.95, sAmp: 1.2, sPh: 0.3, sLen: 0.85, cLag: 2, eye: 0, edgeGlow: 0.3, t: 0.3 }),
      P({ hx: 22, hy: 44, lean: 0.45, ffx: 33, bfx: 10, fax: 37, fay: 36, fa: -0.8, bax: 31, bay: 43, ba: 2.65, sDir: 3.65, sAmp: 1.1, sPh: 0.45, cLag: 1, eye: 0.6, edgeGlow: 0.4, t: 0.45 }),
      P({ sPh: 0.6, t: 0.6 }),
    ],
  },

  // Guard: hips 3px lower, hood pushed forward, elbows tucked, the daggers crossed in a big X in
  // front of the mask (eyes glaring through the V), scarf wrapped over the shoulder, cloak pulled
  // around the front. Calm loop; the glint pulses on the crossed blades.
  guard: {
    fps: 5,
    loop: true,
    poses: [0, 1, 2, 3].map((f) => {
      const t = f / 4;
      const s = Math.sin(t * TAU);
      const up = s > 0.5 ? -1 : 0;
      return P({
        hy: 46 + up,
        hx: 23,
        lean: 0.62,
        nx: 0,
        ffx: 31,
        bfx: 9,
        bft: 0.6,
        fax: 36,
        fay: 37 + up,
        fa: -0.86,
        bax: 44,
        bay: 37 + up,
        ba: -2.28,
        bLayer: 3,
        wrap: 1,
        sDir: Math.PI + 0.1,
        sAmp: 0.6,
        sPh: t,
        cLag: Math.sin((t - 0.25) * TAU) * 0.6,
        eye: 0.9,
        edgeGlow: 0.45 + 0.45 * Math.max(0, s),
        glint: f === 1 ? 0.55 : f === 2 ? 0.85 : NaN,
        t,
      });
    }),
  },
};

// shadow-step afterimages on the lunge: each strike frame trails the poses it came from
{
  const a = ANIMS.attack.poses;
  a[4].ghosts = [
    { pose: a[3], k: 0.3, dx: -5 },
    { pose: a[3], k: 0.7, dx: 0 },
  ];
  a[5].ghosts = [{ pose: a[4], k: 0.45, dx: -4 }];
}

// ---------------------------------------------------------------- hand-pixelled hood

// Hood in profile (facing right), pointed tip trailing back, face lost in shadow, crimson mask.
// Lit from the top-left (night4/steel dome), void3 rim down the back edge. Eyes are painted per
// frame on row 7 (cols 8-9 near eye, col 11 far eye).
const HOOD = [
  'ms............',
  '.s44..........',
  '.ds44444......',
  '.d4s44444s3...',
  'd44s4444433d..',
  'd444444333kkk3',
  'd4444333kkkkk.',
  'd444333kkkkkk.',
  'RC44332kkkkk..',
  'CPR433CPCRRRR.',
  'RRCr43RCRRRRr.',
  '.rRr33RrRRrr..',
  '..rr222.......',
];
const HOOD_KEY: Record<string, number> = {
  k: PAL.ink,
  '1': PAL.night1,
  '2': PAL.night2,
  '3': PAL.night3,
  '4': PAL.night4,
  s: PAL.steel,
  m: PAL.mist,
  d: PAL.void3,
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
const lerpP = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

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

/** Foot polygon + ankle. (fx, fy) = ground point under the ankle; a tilted foot is lifted so its
 *  lowest point stays on the ground line (heel up / toe pointed). */
const GROUND_SOLE = 0.6;
function footGeom(fx: number, fy: number, tilt: number, near: boolean): { A: Pt; poly: Pt[] } {
  const toe = near ? 4.6 : 3.8;
  const local: Pt[] = [
    [-1.7, -0.8],
    [1.0, -1.2],
    [toe - 0.6, 0.6],
    [toe, 1.4],
    [toe - 0.3, 2.0],
    [-1.9, 2.0],
  ];
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  let A: Pt = [fx, fy - 1.4];
  let poly: Pt[] = local.map(([u, v]) => [A[0] + u * c - v * s, A[1] + u * s + v * c] as Pt);
  const maxY = Math.max(...poly.map((q) => q[1]));
  const lim = fy + GROUND_SOLE;
  if (maxY > lim) {
    const d = maxY - lim;
    A = [A[0], A[1] - d];
    poly = poly.map(([x, y]) => [x, y - d] as Pt);
  }
  return { A, poly };
}

/** Colors that count as "cloth/body" for the rim-light pass. */
const BODY = new Set<number>([PAL.night0, PAL.night1, PAL.night2, PAL.night3, PAL.night4, PAL.void0, PAL.void1, PAL.void2]);

// ---------------------------------------------------------------- the rig

const THIGH = 13;
const SHIN = 13;
const UPPER = 8.5;
const FORE = 8;
const SPINE = 17;
const BLADE = 10.5;

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

  // ------------------------------------------------ shadow afterimages (Gölge Adımı): collected here,
  // composited after the outline pass behind the body as unoutlined violet light
  const ghostLayer = new PixelCanvas(p.w, p.h);
  for (const g of o.ghosts) {
    const t = new PixelCanvas(p.w, p.h);
    drawAssassin(t, { ...g.pose, ghosts: [], slashes: [], arcs: [], glint: NaN, ghostOnly: 1 });
    // flat violet silhouette with a brighter rim: an anime afterimage, not a second body
    // (the outline ring is dropped; internal ink seams are filled so the shape stays flat)
    const solid = (x: number, y: number) => t.isOpaque(x, y) && !(t.get(x, y) === PAL.ink && (!t.isOpaque(x - 1, y) || !t.isOpaque(x + 1, y) || !t.isOpaque(x, y - 1) || !t.isOpaque(x, y + 1)));
    for (let y = 0; y < t.h; y++)
      for (let x = 0; x < t.w; x++) {
        if (!solid(x, y)) continue;
        const X = x + g.dx;
        if (ghostLayer.isOpaque(X, y)) continue;
        const rim = !solid(x - 1, y) || !solid(x, y - 1);
        // strong afterimages are solid; fading ones keep their rim and a sparse dither (never a dark slab)
        if (!rim && g.k <= 0.5 && !PixelCanvas.ditherAt(X, y, 6)) continue;
        ghostLayer.set(X, y, rim ? (g.k > 0.5 ? PAL.void3 : PAL.void2) : PAL.void1);
      }
  }

  // ------------------------------------------------ scarf tails (chains that lag behind the body)
  const knot: Pt = [head[0] - 5, head[1] + 3];
  const tail1 = chain(knot, o.sDir, 11, 2.2 * o.sLen * (1 - o.wrap * 0.45), o.sAmp * 1.3, o.sPh, 0.15);
  const tail2 = chain([knot[0] + 0.5, knot[1] + 1.5], o.sDir - 0.4, 8, 2.1 * o.sLen, o.sAmp * 1.5, o.sPh - 0.22, 0.2);
  layer(
    p,
    (q) => {
      q.stroke(tail2, 2.4, 1.4, PAL.crim2);
      edge(q, 0, -1, PAL.crim3);
      edge(q, 0, 1, PAL.crim1);
      const e = tail2[tail2.length - 1];
      q.set(e[0] - 1, e[1] + 1, PAL.crim1);
    },
    null,
  );

  // ------------------------------------------------ limb + dagger painters
  const drawArm = (q: Canvas, sh: Pt, hand: Pt, near: boolean, bend: 1 | -1 = 1, part: 'all' | 'sleeve' | 'glove' = 'all') => {
    if (part === 'glove') {
      q.disc(hand[0], hand[1], 1.7, PAL.night4);
      q.set(hand[0] - 1, hand[1] - 1, PAL.steel);
      q.set(hand[0] + 1, hand[1] + 1, PAL.night3);
      return;
    }
    const el = ik(sh[0], sh[1], hand[0], hand[1], UPPER, FORE, bend);
    const base = near ? PAL.night3 : PAL.night2;
    q.stroke([sh, el], 3.8, 3.2, base);
    q.stroke([el, hand], 3.2, 2.6, base);
    edge(q, 1, 1, near ? PAL.night2 : PAL.night1);
    edge(q, 0, -1, PAL.night4);
    edge(q, -1, 0, near ? PAL.night4 : PAL.night3);
    // elbow point catches the light
    q.paint(el[0], el[1] - 1, near ? PAL.steel : PAL.night4);
    // violet bracer on the forearm
    const b0 = lerpP(el, hand, 0.38);
    const b1 = lerpP(el, hand, 0.78);
    clip(q, (t) => {
      t.stroke([b0, b1], 3.6, 3.6, near ? PAL.void2 : PAL.void1);
      t.line(b0[0], b0[1] - 1, b1[0], b1[1] - 1, near ? PAL.void3 : PAL.void2);
    });
    // glove (night4, steel knuckle)
    q.disc(hand[0], hand[1], 1.7, PAL.night4);
    q.set(hand[0] - 1, hand[1] - 1, near ? PAL.steel : PAL.night4);
    q.set(hand[0] + 1, hand[1] + 1, PAL.night3);
  };
  const drawDagger = (q: Canvas, hand: Pt, a: number, near: boolean, edgeOn = false) => {
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    let nx = -uy;
    let ny = ux;
    if (ny > 0 || (ny === 0 && nx > 0)) {
      nx = -nx;
      ny = -ny;
    } // n = the side facing up (toward the light): the white cutting edge
    // grip wrap + pommel behind the fist
    q.set(hand[0] - ux * 2, hand[1] - uy * 2, PAL.crim2);
    q.set(hand[0] - ux * 3, hand[1] - uy * 3, near ? PAL.mist : PAL.steel);
    // blade raster: 2px steel body with a white edge, tapering to a white point
    const x0 = Math.floor(Math.min(hand[0], hand[0] + ux * BLADE)) - 2;
    const x1 = Math.ceil(Math.max(hand[0], hand[0] + ux * BLADE)) + 2;
    const y0 = Math.floor(Math.min(hand[1], hand[1] + uy * BLADE)) - 2;
    const y1 = Math.ceil(Math.max(hand[1], hand[1] + uy * BLADE)) + 2;
    const glow = o.edgeGlow > 0.6;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const rx = x + 0.5 - hand[0];
        const ry = y + 0.5 - hand[1];
        const s = rx * ux + ry * uy; // along the blade
        const d = rx * nx + ry * ny; // toward the edge
        if (s < 2.2 || s > BLADE + 0.3) continue;
        const f = (s - 2.2) / (BLADE - 2.2);
        // edge-on (guard: blades turned toward the viewer) the blade is a 1px white line
        const hw = edgeOn ? 0.5 : f > 0.82 ? 0.55 : 1.05;
        if (d < -hw + 0.05 || d > hw + 0.05) continue;
        if (edgeOn) {
          q.set(x, y, f > 0.3 && f < 0.75 && glow ? PAL.void4 : PAL.white);
          continue;
        }
        let c: number = d > 0.05 ? (near ? PAL.white : PAL.mist) : near ? PAL.steel : PAL.night4;
        if (f > 0.82) c = glow || near ? PAL.white : PAL.mist;
        else if (d <= 0.05 && glow && f > 0.25 && f < 0.7) c = PAL.void3; // violet glow along the spine
        q.set(x, y, c);
      }
    // crossguard
    const g: Pt = [hand[0] + ux * 1.6, hand[1] + uy * 1.6];
    q.line(g[0] + nx * 1.3, g[1] + ny * 1.3, g[0] - nx * 1.3, g[1] - ny * 1.3, near ? PAL.night4 : PAL.night3);
    q.set(g[0] + nx * 1.3, g[1] + ny * 1.3, PAL.steel);
  };
  const drawLeg = (q: Canvas, hipP: Pt, fx: number, fy: number, tilt: number, near: boolean) => {
    const { A, poly } = footGeom(fx, fy, tilt, near);
    const knee = ik(hipP[0], hipP[1], A[0], A[1], THIGH, SHIN, -1);
    const base = near ? PAL.night3 : PAL.night2;
    const lit = PAL.night4;
    // thigh tapering into the knee, shin tapering into the boot
    q.stroke([hipP, knee], 4.8, 3.8, base);
    q.stroke([knee, A], 3.6, 2.6, base);
    q.poly(poly, base);
    edge(q, 1, 1, near ? PAL.night2 : PAL.night1);
    edge(q, 0, -1, lit);
    edge(q, -1, 0, lit);
    // boot (darker leather) with a lit instep; shin wraps above it
    clip(q, (t) => {
      t.poly(poly, near ? PAL.night2 : PAL.night1);
      const top = poly[1];
      const toe = poly[2];
      t.line(top[0], top[1], toe[0], toe[1], lit);
      const w0 = lerpP(knee, A, 0.52);
      const w1 = lerpP(knee, A, 0.78);
      const sx = A[0] - knee[0];
      const sy = A[1] - knee[1];
      const sl = Math.hypot(sx, sy) || 1;
      const px = (-sy / sl) * 2.2;
      const py = (sx / sl) * 2.2;
      for (const w of [w0, w1]) t.line(w[0] - px, w[1] - py, w[0] + px, w[1] + py, near ? PAL.void2 : PAL.void1);
    });
    // knee guard
    q.disc(knee[0], knee[1], 1.6, lit);
    q.set(knee[0] - 1, knee[1] - 1, near ? PAL.steel : PAL.night4);
  };

  // ------------------------------------------------ back leg (behind everything)
  if (!o.ghostOnly) layer(p, (q) => drawLeg(q, along(0, -1.5), o.bfx, o.bfy, o.bft, false), PAL.ink);

  // far arm sleeve tucked behind the torso (its glove + dagger are drawn later, in front of the belly)
  const bHand: Pt = [o.bax, o.bay];
  if (o.bLayer === 0 || o.bLayer === 3) layer(p, (q) => drawArm(q, shB, bHand, false, 1, 'sleeve'), PAL.ink);

  // ------------------------------------------------ torso (bodysuit)
  layer(
    p,
    (q) => {
      const pts: Pt[] = [along(-1, -3.5), along(5, -4), along(10, -4.2), along(14, -2.5), along(15, 1.5), along(10, 4), along(5, 3.5), along(-1, 3.5)];
      q.poly(pts, PAL.night3);
      edge(q, 1, 1, PAL.night2);
      edge(q, 0, -1, PAL.night4);
      edge(q, -1, 0, PAL.night4);
      clip(q, (t) => {
        // chest seam
        t.line(...along(13, 2.5), ...along(6, -1.5), PAL.night2);
        t.line(...along(13, 1.5), ...along(6.5, -2.5), PAL.night4);
        // crimson sash wrapped round the waist (same cloth as the scarf)
        t.poly([along(0.5, -4.5), along(3.8, -4.5), along(3.8, 4.5), along(0.5, 4.5)], PAL.crim2);
        t.line(...along(3.6, -4.5), ...along(3.6, 4.5), PAL.crim3);
        t.line(...along(0.7, -4.5), ...along(0.7, 4.5), PAL.crim1);
      });
    },
    PAL.ink,
  );

  // ------------------------------------------------ cloak: mantle over the back, tattered tails trailing
  let cloakMask = null as Canvas | null;
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
        // flare / lag stream the tails back toward horizontal (a dash leaves the cloak flying behind)
        const ang = Math.PI * 0.86 + fl * 0.35 + lag * 0.07 + Math.sin((o.t - f * 0.6) * TAU) * 0.12;
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
      const w = o.wrap;
      const shape: Pt[] = [
        along(15.5, -1.5),
        along(14, -4.5),
        along(11.5, -6),
        tails[2],
        notch(1, 2),
        tails[1],
        notch(0, 1),
        tails[0],
        along(0, lerp(-1, 4.5, w)),
        along(lerp(8, 4, w), lerp(1.5, 5.5, w)),
        along(11, 5 + w),
        along(13.5, 5 + w * 0.5),
        along(15.5, 2.5),
      ];
      q.poly(shape, PAL.night3);
      edge(q, 1, 1, PAL.night2);
      edge(q, 0, 1, PAL.night2);
      edge(q, -1, 0, PAL.night4);
      edge(q, 0, -1, PAL.steel);
      clip(q, (t) => {
        // lit plane running down the hunched back
        t.stroke([along(14.5, -3.5), along(10, -4.8), along(5, -4.8)], 2.4, 1.6, PAL.night4);
        t.line(...along(14.5, -4.2), ...along(9, -5.4), PAL.steel);
        // folds running into each notch: a shadow crease with a lit ridge beside it
        for (const [a, b] of [
          [0, 1],
          [1, 2],
        ] as const) {
          const nn = notch(a, b);
          const st = along(lerp(4, 11, a / 2), -2);
          t.line(st[0], st[1], nn[0], nn[1], PAL.night2);
          t.line(st[0] - 1, st[1], nn[0] - 1, nn[1] - 0.5, PAL.night4);
        }
        if (w > 0) {
          // wrapped front edge: a lit hem with a violet lining fold
          const e0 = along(13.5, 5 + w * 0.5);
          const e1 = along(0, 4.5 * w);
          t.line(e0[0], e0[1], e1[0], e1[1], PAL.void2);
          t.line(e0[0] - 1, e0[1], e1[0] - 1, e1[1], PAL.night4);
        } else t.line(...along(13.5, 2.5), ...along(8, 0.5), PAL.night2);
      });
      // violet lining flashes at the tattered tips
      for (const tp of tails) {
        q.paint(tp[0], tp[1], PAL.void3);
        q.paint(tp[0] + 1, tp[1] - 1, PAL.void2);
      }
      cloakMask = q.clone();
    },
    PAL.ink,
  );

  // ------------------------------------------------ sash knot at the back + its fluttering tails
  layer(
    p,
    (q) => {
      const k = along(2.2, -4.6);
      const ph = o.sPh * TAU;
      const tA = chain(k, Math.PI * 0.82 + o.cLag * 0.05, 4, 1.7, 0.6, o.sPh - 0.1, -0.2);
      const tB = chain([k[0] + 0.5, k[1] + 1], Math.PI * 0.68 + o.cLag * 0.05, 3, 1.7, 0.7, o.sPh - 0.3, -0.25);
      q.stroke(tB, 2, 1.2, PAL.crim1);
      q.stroke(tA, 2.2, 1.3, PAL.crim2);
      edge(q, 0, -1, PAL.crim3);
      q.disc(k[0], k[1], 1.5, PAL.crim2);
      q.set(k[0] - 1, k[1] - 1, PAL.crim3);
      q.set(k[0], k[1] - 1, Math.sin(ph) > 0 ? PAL.crim4 : PAL.crim3);
    },
    PAL.ink,
  );

  // ------------------------------------------------ far arm spread / drawn back (outside the cloak)
  if (o.bLayer === 1) {
    layer(p, (q) => drawDagger(q, bHand, o.ba, false), PAL.ink);
    layer(p, (q) => drawArm(q, shB, bHand, false, 1), PAL.ink);
  }

  // ------------------------------------------------ front leg
  if (!o.ghostOnly) layer(p, (q) => drawLeg(q, along(0, 1.5), o.ffx, o.ffy, o.fft, true), PAL.ink);

  // ------------------------------------------------ far glove + reverse-held dagger in front of the belly
  if (o.bLayer === 0) {
    layer(p, (q) => drawDagger(q, bHand, o.ba, false), PAL.ink);
    layer(p, (q) => drawArm(q, shB, bHand, false, 1, 'glove'), PAL.ink);
  }

  // ------------------------------------------------ scarf main tail (behind the head unless wrapped)
  const drawTail1 = () =>
    layer(
      p,
      (q) => {
        let path = tail1;
        if (o.wrap > 0) {
          // wrapped forward: over the near shoulder, hanging down the chest, tip fluttering
          const sway = Math.sin(o.sPh * TAU) * 1.2;
          const a: Pt = [head[0] - 3, head[1] + 5];
          const b: Pt = [shF[0] + 0.5, shF[1] - 2.5];
          const c: Pt = [shF[0] + 2 + sway * 0.3, shF[1] + 4];
          const d: Pt = [shF[0] + 1 + sway, shF[1] + 10];
          path = [a, lerpP(a, b, 0.5), b, lerpP(b, c, 0.5), c, lerpP(c, d, 0.5), d];
        }
        q.stroke(path, 2.8, 1.6, PAL.crim2);
        edge(q, 0, -1, PAL.crim3);
        edge(q, -1, 0, PAL.crim3);
        edge(q, 0, 1, PAL.crim1);
        for (let i = 2; i < path.length - 2; i += 3) q.paint(path[i][0], path[i][1] - 1, PAL.crim4);
        const e = path[path.length - 1];
        q.set(e[0] - 1, e[1] + 1, PAL.crim2);
      },
      PAL.ink,
    );
  if (o.wrap <= 0) drawTail1();

  // ------------------------------------------------ head: hood (hand-pixelled) with glowing eyes + mask
  layer(
    p,
    (q) => {
      const X = head[0] - 7;
      const Y = head[1] - 7;
      q.stamp(HOOD, HOOD_KEY, X, Y);
      const e = o.eye;
      if (e > 0.5) {
        // e < 0.95: narrowed, violet-only glare (guard: keeps the eyes apart from the white blades)
        q.set(X + 8, Y + 7, e > 1.2 ? PAL.white : PAL.void4);
        q.set(X + 9, Y + 7, e >= 0.95 ? PAL.white : PAL.void4);
        q.set(X + 10, Y + 7, PAL.void2);
        q.set(X + 11, Y + 7, e > 1.2 ? PAL.white : e >= 0.95 ? PAL.void4 : PAL.void3);
        if (e > 1.4) q.set(X + 8, Y + 6, PAL.void3).set(X + 9, Y + 6, PAL.void3);
      } else if (e > 0.1) {
        q.set(X + 8, Y + 7, PAL.void3).set(X + 9, Y + 7, PAL.void2);
      } else {
        q.set(X + 8, Y + 8, PAL.void3).set(X + 9, Y + 7, PAL.void3).set(X + 10, Y + 7, PAL.void2);
      }
    },
    PAL.ink,
  );
  if (o.wrap > 0 && o.bLayer !== 3) drawTail1();

  // ------------------------------------------------ front arm + front dagger (guard: back arm crosses first)
  const fHand: Pt = [o.fax, o.fay];
  if (o.bLayer === 3) {
    // guard: both fists tucked at the chin, the blades crossing in one clean X (no seams on the blades)
    layer(p, (q) => drawArm(q, shB, bHand, false, 1, 'glove'), PAL.ink);
    layer(p, (q) => drawArm(q, shF, fHand, true), PAL.ink);
    if (o.wrap > 0) drawTail1(); // scarf pulled forward over the tucked arm
    layer(p, (q) => drawDagger(q, bHand, o.ba, true, true), null);
    layer(p, (q) => drawDagger(q, fHand, o.fa, true, true), null);
  } else {
    if (o.bLayer === 2) {
      layer(p, (q) => drawArm(q, shB, bHand, false, 1), PAL.ink);
      layer(p, (q) => drawDagger(q, bHand, o.ba, true), PAL.ink);
    }
    layer(p, (q) => drawArm(q, shF, fHand, true), PAL.ink);
    layer(p, (q) => drawDagger(q, fHand, o.fa, true), PAL.ink);
  }
  if (!Number.isNaN(o.glint)) {
    // a star glint sliding along the front blade
    const g = 3 + o.glint * (BLADE - 3.5);
    const gx = fHand[0] + Math.cos(o.fa) * g;
    const gy = fHand[1] + Math.sin(o.fa) * g;
    p.set(gx, gy, PAL.white);
    if (o.bLayer >= 2) {
      // guard: the glint rides the crossing point of both blades, a tiny 4-point star
      p.set(gx + 1, gy, PAL.void4).set(gx - 1, gy, PAL.void4).set(gx, gy - 1, PAL.void4).set(gx, gy + 1, PAL.void4);
    }
  }

  // ------------------------------------------------ rim light: every silhouette edge facing away from
  // the key light gets a void3 rim (void4 on the sharpest corners) so the figure pops off the tiles
  if (!o.ghostOnly) {
    // candidates: right-facing silhouette edges (plus the cloak's trailing hem); 1px strands are
    // skipped and only connected runs of 2+ are kept, so the rim never leaves stray dots
    const src = p.clone();
    const rim = new Uint8Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c = src.get(x, y);
        if (c === null || !BODY.has(c)) continue;
        const r = !src.isOpaque(x + 1, y) && src.isOpaque(x - 1, y);
        const b = !src.isOpaque(x, y + 1) && src.isOpaque(x, y - 1) && cloakMask !== null && cloakMask.get(x, y) === c;
        if (r || b) rim[y * W + x] = 1;
      }
    const at = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H && rim[y * W + x] === 1;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!at(x, y)) continue;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && at(x + dx, y + dy)) n++;
        if (!n) continue;
        // void4 glints where the rim turns a sharp top corner (upper body only)
        const glint = y < 36 && !src.isOpaque(x, y - 1) && !src.isOpaque(x + 1, y - 1) && at(x, y + 1);
        p.set(x, y, glint ? PAL.void4 : PAL.void3);
      }
  }

  // ------------------------------------------------ outline
  p.outline(PAL.ink);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = ghostLayer.get(x, y);
      if (c !== null && !p.isOpaque(x, y)) p.set(x, y, c);
    }

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
  const front = o.slashes.filter((s) => !s.behind);
  const back = o.slashes.filter((s) => s.behind);
  const solid = p.clone();
  for (const sl of [...back, ...front]) {
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
        if (sl.behind && solid.isOpaque(x, y)) continue;
        const ad = Math.abs(d) / Math.max(0.01, w);
        let c: number;
        if (sl.behind) {
          // violet cut: void3 body, void4 inner band, white-hot core in the middle third only
          c = sl.k > 0.8 ? (ad <= 0.3 ? (f > 0.3 && f < 0.7 ? PAL.white : PAL.void4) : ad <= 0.62 ? PAL.void4 : PAL.void3) : ad <= 0.4 ? PAL.void3 : PAL.void2;
        } else {
          const core = ad <= 0.4;
          c = sl.k > 0.8 ? (core ? PAL.white : PAL.void4) : sl.k > 0.5 ? (core ? PAL.void4 : PAL.void3) : core ? PAL.void3 : PAL.void2;
        }
        p.set(x, y, c);
      }
    }
  }
  if (front.length) {
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

const art: MonsterArt = {
  id: 'shade_assassin',
  w: W,
  h: H,
  anchorX: 24,
  anchorY: 60,
  hover: 0,
  /** Muzzle = the intersection of the impact X-slash (VFX X-slashes should center here). */
  muzzle: { x: X_C[0], y: X_C[1] },
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
