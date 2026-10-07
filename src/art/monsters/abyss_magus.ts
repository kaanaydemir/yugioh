// Uçurum Büyücüsü (abyss_magus) — DARK ace spellcaster, 80×80, floats (hover 6).
//
// A parametric rig: every frame is a Pose (numbers) and draw() paints the parts back-to-front
// from it. Rigid parts (helm + horns, pauldrons) are hand-pixelled stamps; cloth (cape, robe,
// sleeves) and the staff are built from shapes so they can bend. Proportions never change
// between frames — all motion comes from the parameters. The cape, sleeve bell, robe hem and orb
// carry their own lagging parameters (secondary motion).

import { PAL } from '../palette';
import { PixelCanvas, bezier, type Pt } from '../pixel';
import type { MonsterAnim, MonsterArt } from '../types';

const W = 80;
const H = 80;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- pose

interface Pose {
  /** Whole-body offset (frame px). */
  dx: number;
  bob: number;
  /** Torso shear: px the head moves forward relative to the waist (+ = leaning forward). */
  lean: number;
  /** Extra head offset; visor squint (0 = open, 1 = shut). */
  hx: number;
  hy: number;
  squint: number;
  /** Staff grip (frame px, before dx/bob) and staff angle (rad from vertical, + = top forward). */
  gx: number;
  gy: number;
  sa: number;
  /** Orb radius multiplier, glow 0..1, extra vertical drift off the staff head. */
  orb: number;
  glow: number;
  orbLift: number;
  /** Back (far) hand position (frame px, before dx/bob). bFront = that hand is on the staff, in front. */
  bx: number;
  by: number;
  bFront: number;
  /** Cape: hem lag (x/y px), flare 0..1, ripple amplitude, wrap 0..1 (folded around the front). */
  cx: number;
  cy: number;
  flare: number;
  ripple: number;
  wrap: number;
  /** Robe hem sway (px at the hem, + = forward). */
  sway: number;
  /** Eye glow 0..2, rune brightness 0..1, aura ring 0..1 (expansion phase), charge 0..1, muzzle flash. */
  eye: number;
  rune: number;
  aura: number;
  charge: number;
  flash: number;
  /** Guard ward: a faint dotted barrier arc in front of the body (0..1). */
  ward: number;
  /** Smear: staff angle the orb swept from this frame (NaN = none). Drawn as a glowing arc. */
  trail: number;
  /** Time phase for ripples/sparkles. */
  t: number;
}

const NEUTRAL: Pose = {
  dx: 0,
  bob: 0,
  lean: 0,
  hx: 0,
  hy: 0,
  squint: 0,
  gx: 55,
  gy: 44,
  sa: 0.05,
  orb: 1,
  glow: 0.5,
  orbLift: 0,
  bx: 30,
  by: 46,
  bFront: 0,
  cx: 0,
  cy: 0,
  flare: 0,
  ripple: 1,
  wrap: 0,
  sway: 0,
  eye: 1,
  rune: 0.4,
  aura: 0,
  charge: 0,
  flash: 0,
  trail: NaN,
  ward: 0,
  t: 0,
};

const P = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

function idlePose(f: number, n: number): Pose {
  const t = f / n;
  const s = Math.sin(t * TAU);
  const c = Math.cos(t * TAU);
  // smooth 3px hover; the cape hem and robe lag ~2 frames behind the body
  const lag = Math.sin((t - 0.22) * TAU);
  return P({
    bob: Math.round(-0.5 - s * 1.4),
    gy: 44 + Math.round(-s * 0.6),
    sa: 0.05 + 0.035 * Math.sin((t - 0.15) * TAU),
    orbLift: Math.round(-Math.sin((t - 0.12) * TAU) * 1.2),
    cy: Math.round(lag * 1.5),
    cx: Math.round(-c * 0.9),
    sway: lag * 0.9,
    ripple: 1,
    glow: 0.45 + 0.4 * (0.5 - 0.5 * c),
    orb: 1 + 0.08 * (0.5 - 0.5 * c),
    rune: 0.3 + 0.55 * (0.5 - 0.5 * s),
    t,
  });
}

const ANIMS: Record<MonsterAnim, { fps: number; loop: boolean; poses: Pose[] }> = {
  idle: { fps: 8, loop: true, poses: Array.from({ length: 8 }, (_, f) => idlePose(f, 8)) },

  // Roar: gather (sink, staff in, runes ignite) → BURST (staff high, cape flares, aura ring) → hold → settle.
  roar: {
    fps: 10,
    loop: false,
    poses: [
      P({ bob: 1, lean: -1, gy: 45, cy: -1, t: 0.0, rune: 0.6 }),
      P({ bob: 2, lean: 2, hy: 1, gx: 54, gy: 46, sa: 0.02, bx: 36, by: 42, cx: 2, cy: -1, glow: 0.7, eye: 1.2, rune: 0.8, charge: 0.4, sway: 1, t: 0.1 }),
      P({ bob: 3, lean: 3, hy: 2, gx: 53, gy: 45, sa: 0.0, bx: 38, by: 41, cx: 3, cy: -2, glow: 0.9, eye: 1.4, rune: 1, charge: 0.8, sway: 1.5, t: 0.2 }),
      P({ bob: -2, lean: -3, hy: -1, gx: 56, gy: 37, sa: 0.32, bx: 19, by: 31, cx: -3, cy: -3, flare: 0.8, ripple: 1.6, glow: 1, orb: 1.15, eye: 2, rune: 1, aura: 0.2, flash: 1, sway: -2, t: 0.3 }),
      P({ bob: -2, lean: -3, hy: -1, gx: 56, gy: 37, sa: 0.34, bx: 18, by: 30, cx: -3, cy: -5, flare: 1, ripple: 1.8, glow: 1, orb: 1.18, eye: 2, rune: 1, aura: 0.45, sway: -2.5, t: 0.42 }),
      P({ bob: -2, lean: -2, hy: -1, gx: 56, gy: 37, sa: 0.33, bx: 18, by: 31, cx: -3, cy: -6, flare: 1, ripple: 1.6, glow: 1, orb: 1.15, eye: 1.8, rune: 1, aura: 0.7, sway: -2, t: 0.54 }),
      P({ bob: -2, lean: -2, gx: 56, gy: 38, sa: 0.3, bx: 19, by: 32, cx: -3, cy: -5, flare: 0.85, ripple: 1.4, glow: 0.9, orb: 1.15, eye: 1.6, rune: 0.9, aura: 0.95, sway: -1.5, t: 0.66 }),
      P({ bob: -1, lean: -1, gx: 56, gy: 39, sa: 0.18, bx: 24, by: 39, cx: -2, cy: -3, flare: 0.5, ripple: 1.2, glow: 0.8, orb: 1.1, eye: 1.3, rune: 0.7, sway: -0.5, t: 0.78 }),
      P({ bob: -1, lean: 0, gx: 55, gy: 42, sa: 0.08, bx: 28, by: 44, cx: 1, cy: -1, flare: 0.2, glow: 0.6, orb: 1.04, eye: 1.1, rune: 0.5, sway: 0.5, t: 0.9 }),
      P({ bob: 0, gx: 55, gy: 44, cx: 1, t: 1.0 }),
    ],
  },

  // Attack: staff swings back over the shoulder while the orb swells and draws in motes (anticipation)
  // → smear → THRUST (impact: orb at the muzzle, flash) → follow-through (orb spent) → recovery.
  attack: {
    fps: 10,
    loop: false,
    poses: [
      P({ t: 0 }),
      P({ bob: 1, lean: -1, dx: -1, gx: 52, gy: 42, sa: -0.22, bx: 41, by: 38, cx: 1, cy: -1, orb: 1.12, glow: 0.7, eye: 1.2, rune: 0.6, charge: 0.4, sway: 0.5, t: 0.1 }),
      P({ bob: 1, lean: -3, dx: -2, gx: 48, gy: 39, sa: -0.62, bx: 46, by: 36, cx: 2, cy: -2, orb: 1.3, glow: 0.9, eye: 1.5, rune: 0.8, charge: 0.75, sway: 1, t: 0.2 }),
      P({ bob: 2, lean: -4, dx: -2, gx: 46, gy: 38, sa: -0.9, bx: 48, by: 35, cx: 3, cy: -2, orb: 1.45, glow: 1, eye: 1.8, rune: 1, charge: 1, sway: 1.5, t: 0.3 }),
      P({ bob: 0, lean: 1, dx: 0, gx: 51, gy: 40, sa: 0.3, bx: 40, by: 39, cx: -1, cy: -1, flare: 0.3, ripple: 1.4, orb: 1.35, glow: 1, eye: 1.8, rune: 1, sway: -1, trail: -0.75, t: 0.4 }),
      P({ bob: -1, lean: 4, dx: 2, hx: 1, gx: 50, gy: 41, sa: 0.8, bx: 30, by: 41, cx: -5, cy: -3, flare: 0.6, ripple: 1.6, orb: 1.15, glow: 1, eye: 2, rune: 1, flash: 1, sway: -2, trail: 0.35, t: 0.5 }),
      P({ bob: -1, lean: 4, dx: 2, hx: 1, gx: 53, gy: 42, sa: 0.88, bx: 29, by: 43, cx: -6, cy: -4, flare: 0.7, ripple: 1.4, orb: 0.3, glow: 0.3, eye: 1.5, rune: 0.8, sway: -2.5, t: 0.6 }),
      P({ bob: 0, lean: 2, dx: 1, gx: 54, gy: 43, sa: 0.5, bx: 29, by: 45, cx: 1, cy: -2, flare: 0.3, orb: 0.5, glow: 0.35, eye: 1.2, rune: 0.6, sway: -0.5, t: 0.7 }),
      P({ bob: 0, lean: 1, dx: 0, gx: 55, gy: 44, sa: 0.18, cx: 2, cy: -1, orb: 0.72, glow: 0.4, rune: 0.5, sway: 0.8, t: 0.8 }),
      P({ bob: 0, gx: 55, gy: 44, cx: 1, orb: 0.9, glow: 0.45, sway: 0.3, t: 0.9 }),
    ],
  },

  // Hit: violent knock-back, visor squints, orb dims, cape and robe whip forward (they lag), recover.
  hit: {
    fps: 10,
    loop: false,
    poses: [
      P({ dx: -4, bob: -1, lean: -4, hx: -1, squint: 1, gx: 50, gy: 43, sa: 0.32, bx: 26, by: 42, cx: 6, cy: -3, flare: 0.3, ripple: 1.5, orb: 0.85, glow: 0.2, eye: 0.6, rune: 0.1, sway: 3, t: 0.1 }),
      P({ dx: -3, bob: 0, lean: -3, squint: 1, gx: 51, gy: 44, sa: 0.24, bx: 27, by: 44, cx: 4, cy: -2, flare: 0.2, ripple: 1.3, orb: 0.9, glow: 0.3, eye: 0.7, rune: 0.2, sway: 2, t: 0.25 }),
      P({ dx: -1, bob: 0, lean: -1, squint: 0.5, gx: 54, gy: 44, sa: 0.1, cx: 1, cy: -1, ripple: 1.1, orb: 0.95, glow: 0.4, eye: 0.9, rune: 0.3, sway: 0.8, t: 0.4 }),
      P({ dx: 0, bob: 0, gx: 55, gy: 44, cx: -1, sway: -0.3, t: 0.55 }),
    ],
  },

  // Guard: staff held level across the body as a barrier, cape wrapped around the robe. Calm.
  guard: {
    fps: 5,
    loop: true,
    poses: [0, 1, 2, 3].map((f) => {
      const t = f / 4;
      const s = Math.sin(t * TAU);
      return P({
        bob: 1 + Math.round(-s * 0.7),
        lean: 1,
        hy: 1,
        gx: 47,
        gy: 41,
        sa: 1.3,
        bx: 33,
        by: 43,
        bFront: 1,
        ward: 0.6 + 0.4 * (0.5 + 0.5 * s),
        cy: Math.round(Math.sin((t - 0.25) * TAU) * 0.8),
        wrap: 1,
        ripple: 0.4,
        orb: 0.95 + 0.06 * s,
        glow: 0.5 + 0.2 * s,
        eye: 0.9,
        rune: 0.35 + 0.25 * s,
        sway: Math.sin((t - 0.25) * TAU) * 0.5,
        t,
      });
    }),
  },
};

// ---------------------------------------------------------------- hand-pixelled rigid parts

// Horned great-helm in profile (facing right). Light from the top-left: side plate lit, face plate
// in shade. Near horn (d/c/b) sweeps back and hooks up; the far horn (a/b) peeks behind it.
// The visor recess (k) gets the eye glow painted per frame on row 13, cols 13..18.
const HEAD = [
  '..........ms......',
  '.......234ms3.....',
  '......234ss443....',
  '.....234s444432...',
  '....234s4444332...',
  '....3s444443333211',
  '....3s444433333221',
  '...34s443333332221',
  '...3444332kkkkkkkk',
  '...344432kkkkkkkkk',
  '...34433k332222221',
  '...3443k3332222211',
  '....343k33222211..',
  '....333k3222111...',
  '.....332k22111....',
  '......3222111.....',
  '.......2211.......',
];
const HEAD_X = 32; // stamp origin at neutral (frame px)
const HEAD_Y = 10;
const EYE_ROW = 9;
const EYE_COL = 11;

const PAULDRON_F = [
  '...ms4.....',
  '.ms44443...',
  'ms4444433..',
  '4s44443332.',
  '44443333222',
  '.000000000.',
  '.s44433322.',
  '..1000000..',
  '...43322...',
];
const PAULDRON_B = [
  '..ms43..',
  '.s44432.',
  '34443322',
  '34433221',
  '.000000.',
  '.443321.',
  '..2211..',
];

const KEY: Record<string, number> = {
  k: PAL.ink,
  '0': PAL.night0,
  '1': PAL.night1,
  '2': PAL.night2,
  '3': PAL.night3,
  '4': PAL.night4,
  s: PAL.steel,
  m: PAL.mist,
  a: PAL.void0,
  b: PAL.void1,
  c: PAL.void2,
  d: PAL.void3,
  e: PAL.void4,
};

// ---------------------------------------------------------------- helpers

type Canvas = PixelCanvas;

/** Paint a part on its own layer, then composite it. `sep` draws a 1px separation line where the
 *  part's silhouette crosses already-painted parts (internal outlines without doubling the outer one). */
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

/** Draw with `fn` but keep only pixels that land on the existing silhouette of `q`. */
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

/** Row-scan shading: u = 0..1 across each row's span, v = 0..1 down the part's bounds. */
function rows(q: Canvas, fn: (u: number, v: number, x: number, y: number) => number | null): void {
  const b = q.bounds();
  if (!b) return;
  const src = q.clone();
  for (let y = b.y; y < b.y + b.h; y++) {
    let xl = -1;
    let xr = -1;
    for (let x = b.x; x < b.x + b.w; x++)
      if (src.isOpaque(x, y)) {
        if (xl < 0) xl = x;
        xr = x;
      }
    if (xl < 0) continue;
    const span = Math.max(1, xr - xl);
    const v = (y - b.y) / Math.max(1, b.h - 1);
    for (let x = xl; x <= xr; x++) {
      if (!src.isOpaque(x, y)) continue;
      const c = fn((x - xl) / span, v, x, y);
      if (c !== null) q.set(x, y, c);
    }
  }
}

/** Recolor the pixels of `q` whose neighbour in direction (dx,dy) is empty. */
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

/** Outline polygon of a bell sleeve along shoulder→elbow→cuff, widening, with a drooping underside. */
function sleevePoly(s: Pt, e: Pt, c: Pt, w0: number, w1: number, w2: number, droop: number, lag: number): Pt[] {
  const pts = [s, e, c];
  const ws = [w0, w1, w2];
  const up: Pt[] = [];
  const dn: Pt[] = [];
  for (let i = 0; i < 3; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(2, i + 1)];
    let ux = b[0] - a[0];
    let uy = b[1] - a[1];
    const l = Math.hypot(ux, uy) || 1;
    ux /= l;
    uy /= l;
    let nx = -uy;
    let ny = ux;
    if (ny < 0 || (ny === 0 && nx < 0)) {
      nx = -nx;
      ny = -ny;
    }
    const h = ws[i] / 2;
    up.push([pts[i][0] - nx * h, pts[i][1] - ny * h]);
    dn.push([pts[i][0] + nx * h, pts[i][1] + ny * h]);
  }
  // the bell hangs below the cuff
  const hang: Pt = [dn[2][0] - 1.5 + lag, dn[2][1] + droop];
  const hang2: Pt = [lerp(dn[1][0], dn[2][0], 0.45) + lag * 0.5, lerp(dn[1][1], dn[2][1], 0.45) + droop * 0.55];
  return [up[0], up[1], up[2], dn[2], hang, hang2, dn[1], dn[0]];
}

// ---------------------------------------------------------------- the rig

const WAIST_Y = 44;
const STAFF_UP = 18;
const STAFF_DOWN = 26;

/** Center of the staff orb for a pose (also used to export the muzzle point). */
function orbCenter(o: Pose): Pt {
  const r = 3.9 * o.orb;
  const d = STAFF_UP + 3.2 + r;
  return [o.gx + o.dx + Math.sin(o.sa) * d, o.gy + o.bob - Math.cos(o.sa) * d + o.orbLift];
}

function drawMagus(p: Canvas, o: Pose): void {
  const k = o.lean / 26; // shear per px of height above the waist
  /** Upper body transform. */
  const T = (x: number, y: number): Pt => [x + o.dx + (WAIST_Y - y) * k, y + o.bob];
  /** Lower robe transform (hem sways and lags behind the torso). */
  const L = (x: number, y: number): Pt => [x + o.dx + ((y - WAIST_Y) / 26) * (o.sway - o.lean * 0.3), y + o.bob];
  const headO = T(HEAD_X, HEAD_Y + 14);
  const HX = Math.round(headO[0] + o.hx);
  const HY = Math.round(HEAD_Y + o.bob + o.hy);

  // staff geometry
  const grip: Pt = [o.gx + o.dx, o.gy + o.bob];
  const dir: Pt = [Math.sin(o.sa), -Math.cos(o.sa)];
  const nrm: Pt = [-dir[1], dir[0]]; // perpendicular (points right when the staff is vertical)
  const top: Pt = [grip[0] + dir[0] * STAFF_UP, grip[1] + dir[1] * STAFF_UP];
  const bot: Pt = [grip[0] - dir[0] * STAFF_DOWN, grip[1] - dir[1] * STAFF_DOWN];
  const orbR = 3.9 * o.orb;
  const orbOff = 3.2 + orbR;
  const orbC = orbCenter(o);
  const SU = (u: number, v: number): Pt => [top[0] + dir[0] * u + nrm[0] * v, top[1] + dir[1] * u + nrm[1] * v];

  // ------------------------------------------------ cape (back layer)
  {
    const fl = o.flare;
    const rip = o.ripple;
    const A = T(31, 27);
    const spread = 18 + fl * 2;
    const tip: Pt = [A[0] - spread - 2 + o.cx, 71 + o.bob + o.cy - fl * 8];
    const curve = bezier(A, [A[0] - 2, A[1] + 11 - fl * 4], [A[0] - spread * 0.75, A[1] + 26 - fl * 8], tip, 16);
    const edgePts: Pt[] = curve.map(([x, y], i) => {
      const s = i / 16;
      return [x + Math.sin((s * 1.5 - o.t) * TAU) * rip * 1.3 * s, y + Math.cos((s * 1.5 - o.t) * TAU) * rip * 0.5 * s];
    });
    const R: Pt = [42 + o.dx + o.cx * 0.3, 68 + o.bob + o.cy * 0.4];
    const hem: Pt[] = [];
    const M = 7;
    for (let i = 1; i < M; i++) {
      const s = i / M;
      const x = lerp(tip[0], R[0], s);
      const y = lerp(tip[1], R[1], s);
      const notch = i % 2 === 1 ? -4 - Math.sin((o.t * 1.3 + s) * TAU) * rip : 0.5;
      hem.push([x + (i % 2 === 1 ? 0.5 : 0), y + notch]);
    }
    const shape: Pt[] = [T(37, 26), ...edgePts, ...hem, R, T(42, 40), T(42, 28)];
    // lining (inside of the cape) peeks out under the hem
    layer(
      p,
      (q) => {
        // underside at the hem
        q.poly(
          shape.map(([x, y]) => [x + 2 + fl * 1.5, y + 1.5 + fl * 2] as Pt),
          PAL.void1,
        );
        // the outer edge curls over in the wind, showing a violet band of lining
        const curl = 1.6 + fl * 0.5;
        q.poly(
          shape.map(([x, y]) => [x - curl, y + curl * 0.6] as Pt),
          PAL.void2,
        );
        edge(q, -1, 0, PAL.void3);
        edge(q, 0, 1, PAL.void1);
      },
      null,
    );
    layer(
      p,
      (q) => {
        q.poly(shape, PAL.night2);
        rows(q, (u) => (u < 0.05 ? PAL.night4 : u < 0.2 ? PAL.night3 : u < 0.68 ? PAL.night2 : PAL.night1));
        // folds: from under the shoulder down to each hem notch
        clip(q, (t) => {
          for (let i = 0; i < hem.length; i += 2) {
            const [nx, ny] = hem[i];
            const from = T(32 - i * 0.5, 34);
            const mid: Pt = [lerp(from[0], nx, 0.5) - 2 - fl * 2, lerp(from[1], ny, 0.5)];
            const path = bezier(from, mid, [nx, ny - 2], undefined, 12);
            t.polyline(path, PAL.night1);
            t.polyline(
              path.map(([x, y]) => [x - 1, y] as Pt),
              i === 0 ? PAL.night4 : PAL.night3,
            );
          }
        });
        // rim light along the outer edge
        for (let i = 0; i < 9; i++) q.paint(edgePts[i][0] + 0.5, edgePts[i][1], i < 5 ? PAL.steel : PAL.night4);
      },
      null,
    );
  }

  // ------------------------------------------------ back arm (far sleeve)
  const bShoulder = T(32, 31);
  const bHand: Pt = [o.bx + o.dx, o.by + o.bob];
  const drawBackArm = (sep: number | null) =>
    layer(
      p,
      (q) => {
        const el = ik(bShoulder[0], bShoulder[1], bHand[0], bHand[1], 8, 8, -1);
        const cd: Pt = [bHand[0] - el[0], bHand[1] - el[1]];
        const cl = Math.hypot(cd[0], cd[1]) || 1;
        const ux = cd[0] / cl;
        const uy = cd[1] / cl;
        const cuff: Pt = [bHand[0] - ux * 2, bHand[1] - uy * 2];
        q.poly(sleevePoly(bShoulder, el, cuff, 4.5, 5, 7, 3, 0), PAL.void1);
        rows(q, (u) => (u < 0.25 ? PAL.void2 : u < 0.8 ? PAL.void1 : PAL.void0));
        q.disc(cuff[0] + ux * 0.5, cuff[1] + uy * 0.5, 1.6, PAL.void0); // sleeve mouth
        // gauntlet (open claw)
        const hx = bHand[0];
        const hy = bHand[1];
        q.disc(hx, hy, 1.8, PAL.night2);
        q.set(hx - 1, hy - 1, PAL.night3);
        q.set(hx + ux * 2.2, hy + uy * 2.2, PAL.night2);
        q.set(hx + ux * 2 - uy * 1.6, hy + uy * 2 + ux * 1.6, PAL.night2);
        q.set(hx + ux * 2 + uy * 1.6, hy + uy * 2 - ux * 1.6, PAL.night3);
      },
      sep,
    );
  if (!o.bFront) drawBackArm(PAL.void0);

  // ------------------------------------------------ robe skirt
  const hemPts: Pt[] = [];
  {
    const tips = [25.5, 29, 32.5, 36, 39.5, 43, 46.5, 50, 54];
    for (let i = tips.length - 1; i >= 0; i--) {
      const tip = i % 2 === 0;
      const ph = Math.sin((o.t + i * 0.14) * TAU);
      const y = tip ? 71.5 - Math.abs(i - 4) * 0.7 : 66.5 - Math.abs(i - 4) * 0.4;
      hemPts.push(L(tips[i] + (tip ? ph * 0.8 : 0), y + (tip ? ph * 0.7 : 0)));
    }
  }
  layer(
    p,
    (q) => {
      const skirt: Pt[] = [T(34, 42.5), T(45, 42.5), L(48.5, 51), L(52.5, 60), L(54.5, 65.5), ...hemPts, L(25, 65.5), L(27, 59), L(30.5, 50.5)];
      q.poly(skirt, PAL.void2);
      rows(q, (u, v) => {
        const pleat = Math.sin(u * Math.PI * 7 + 0.9);
        let i = u < 0.05 ? 3 : u < 0.4 ? 3 : u < 0.8 ? 2 : 1;
        if (v > 0.15 && i > 1 && i < 4) {
          if (pleat > 0.8) i += 1;
          else if (pleat < -0.8) i -= 1;
        }
        if (i === 4 && v > 0.55) i = 3;
        return [PAL.void0, PAL.void1, PAL.void2, PAL.void3, PAL.void4][Math.max(0, Math.min(4, i))];
      });
      // rune band above the hem: a dark embroidered strip; small runes glow in a travelling wave
      clip(q, (t) => {
        for (let x = 20; x < 60; x++) {
          const [bx, by] = L(x, 61);
          t.set(bx, by - 1, PAL.void0);
          t.set(bx, by, PAL.void1);
          t.set(bx, by + 1, PAL.void1);
          t.set(bx, by + 2, PAL.void1);
          t.set(bx, by + 3, PAL.void0);
        }
        const glyphs = [
          ['x.', 'xx', 'x.'],
          ['.x', 'xx', '.x'],
          ['xx', '.x', 'x.'],
          ['x.', 'x.', 'xx'],
        ];
        for (let i = 0; i < 9; i++) {
          const [gx, gy] = L(25.5 + i * 3.4, 61);
          const lit = (Math.sin((o.t - i * 0.11) * TAU) * 0.5 + 0.5) * o.rune;
          const c = lit > 0.62 ? PAL.void4 : lit > 0.3 ? PAL.void3 : PAL.void2;
          const g = glyphs[(i * 3) % glyphs.length];
          for (let j = 0; j < 3; j++) for (let ii = 0; ii < 2; ii++) if (g[j][ii] === 'x') t.set(Math.floor(gx) + ii, Math.floor(gy) + j, c);
        }
      });
      edge(q, 0, 1, PAL.void1);
    },
    PAL.void0,
  );

  // ------------------------------------------------ tabard (front panel) with sigil
  layer(
    p,
    (q) => {
      const tb: Pt[] = [T(36.5, 42.5), T(42.5, 42.5), L(43.5, 56), L(43, 64), L(40, 70.5), L(37, 64), L(36, 56)];
      q.poly(tb, PAL.night2);
      rows(q, (u) => (u < 0.22 ? PAL.night3 : u < 0.72 ? PAL.night2 : PAL.night1));
      const lit = o.rune;
      const c1 = lit > 0.7 ? PAL.void4 : PAL.void3;
      // the abyssal eye sigil, and a drip of runes below it
      const [sx, sy] = L(37.5, 49);
      q.stamp(['.aaa.', 'a.b.a', '.aaa.', '..a..', '.....', '..c..', '.....', '..c..'], { a: c1, b: lit > 0.55 ? PAL.white : PAL.mag3, c: lit > 0.45 ? PAL.void3 : PAL.void2 }, Math.floor(sx), Math.floor(sy));
    },
    PAL.void0,
  );

  // ------------------------------------------------ wrapped cape front panel (guard)
  if (o.wrap > 0) {
    layer(
      p,
      (q) => {
        // the cape is pulled around the body: its edge runs diagonally from the far shoulder
        // down across the robe to the front hip, tatters at the hem
        const e0 = T(29, 35);
        const e1 = L(52, 50);
        const shape: Pt[] = [e0, [lerp(e0[0], e1[0], 0.5), lerp(e0[1], e1[1], 0.5) + 1.5], e1, L(54.5, 58), L(55, 64), L(51.5, 71), L(48, 67), L(44, 72), L(40, 67.5), L(36, 72), L(32, 67), L(28, 71), L(25, 66), L(26, 55), L(27.5, 46)];
        q.poly(shape, PAL.night2);
        rows(q, (u) => (u < 0.07 ? PAL.night3 : u < 0.35 ? PAL.night2 : u < 0.8 ? PAL.night1 : PAL.night0));
        clip(q, (t) => {
          // folds fan out from where the cloth is gathered at the front hip toward the hem
          const g = L(51, 51);
          for (const [hx, hy, lit] of [
            [29, 69, true],
            [37, 70, false],
            [45, 69, false],
          ] as const) {
            const b = L(hx, hy);
            const m: Pt = [lerp(g[0], b[0], 0.5) + 2, lerp(g[1], b[1], 0.5) - 1];
            const path = bezier(g, m, b, undefined, 16);
            t.polyline(path, PAL.night0);
            t.polyline(
              path.map(([x, y]) => [x - 1, y] as Pt),
              lit ? PAL.night3 : PAL.night2,
            );
          }
          // turned-over edge shows the violet lining
          t.line(e0[0], e0[1], e1[0], e1[1], PAL.void2);
          t.line(e0[0], e0[1] + 1, e1[0], e1[1] + 1, PAL.void1);
        });
        edge(q, 0, 1, PAL.void1);
        edge(q, -1, 0, PAL.night3);
      },
      PAL.ink,
    );
  }

  // ------------------------------------------------ torso: breastplate + belt
  layer(
    p,
    (q) => {
      const plate: Pt[] = [T(32, 29.5), T(36, 27.5), T(44, 27.5), T(48, 29.5), T(47.5, 35), T(45, 42.5), T(35, 42.5), T(32.5, 36)];
      q.poly(plate, PAL.night2);
      rows(q, (u, v) => (u < 0.14 ? PAL.steel : u < 0.3 ? PAL.night4 : u < 0.55 ? (v < 0.55 ? PAL.night3 : PAL.night2) : u < 0.86 ? PAL.night2 : PAL.night1));
      clip(q, (t) => {
        // sternum ridge, pectoral line, ab plate
        t.line(...T(40, 29), ...T(40, 39), PAL.night1);
        t.line(...T(39, 30), ...T(39, 38), PAL.night3);
        t.line(...T(34, 35), ...T(46, 35), PAL.night1);
        t.line(...T(34, 38.5), ...T(46, 38.5), PAL.night1);
        // belt
        t.poly([T(33, 40.5), T(47, 40.5), T(46, 43.5), T(34, 43.5)], PAL.void0);
        const [bkx, bky] = T(39, 40.5);
        t.stamp(['ab', 'bc'], { a: PAL.void4, b: PAL.void3, c: PAL.void2 }, Math.floor(bkx), Math.floor(bky));
      });
      const [s1x, s1y] = T(34, 30);
      q.paint(s1x, s1y, PAL.mist).paint(s1x + 1, s1y, PAL.steel).paint(s1x, s1y + 1, PAL.steel);
    },
    PAL.void0,
  );

  // ------------------------------------------------ mantle: violet cowl draped around the neck
  layer(
    p,
    (q) => {
      const m: Pt[] = [T(31, 29), T(34, 25), T(39, 24), T(45, 25.5), T(48.5, 29), T(44, 31.5), T(40, 33.5), T(36, 31.5)];
      q.poly(m, PAL.void2);
      rows(q, (u, v) => (v > 0.72 ? PAL.void1 : u < 0.3 ? PAL.void3 : u < 0.7 ? PAL.void2 : PAL.void1));
      // abyss gem clasp at the throat
      const [gx, gy] = T(39, 29.5);
      const gc = o.glow > 0.75 ? PAL.white : PAL.mag4;
      q.stamp(['.aa.', 'abac', '.cc.'], { a: PAL.mag3, b: gc, c: PAL.mag1 }, Math.floor(gx) - 1, Math.floor(gy));
    },
    PAL.void0,
  );

  // ------------------------------------------------ back pauldron
  layer(
    p,
    (q) => {
      const [x, y] = T(26.5, 27.5);
      q.stamp(PAULDRON_B, KEY, Math.round(x), Math.round(y));
    },
    PAL.night0,
  );

  // ------------------------------------------------ head: horned helm (hand-pixelled, rigid) + horns
  const hornStroke = (q: Canvas, pts: Pt[], w0: number, dark: number, base: number, lit: number, tipC: number) => {
    const t = new PixelCanvas(q.w, q.h);
    t.stroke(pts, w0, 1, base);
    edge(t, 1, 1, dark);
    edge(t, 0, 1, dark);
    edge(t, -1, -1, lit);
    edge(t, 0, -1, lit);
    const n = pts.length - 1;
    t.paint(pts[n][0], pts[n][1], tipC);
    t.paint(pts[n - 1][0], pts[n - 1][1], tipC);
    q.blit(t, 0, 0);
  };
  // far horn: behind the helm, darker
  layer(
    p,
    (q) => {
      const fh = bezier([HX + 9, HY + 3], [HX + 5, HY + 0.5], [HX + 0.5, HY + 0.5], [HX - 1.5, HY - 4.5], 14);
      hornStroke(q, fh, 4, PAL.void0, PAL.void1, PAL.void2, PAL.void2);
    },
    PAL.ink,
  );
  layer(
    p,
    (q) => {
      q.stamp(HEAD, KEY, HX, HY);
      const sq = o.squint;
      const e = o.eye;
      const ey = HY + EYE_ROW;
      const ex = HX + EYE_COL;
      if (sq >= 1) {
        q.hline(ex + 1, ex + 5, ey - 1, PAL.mag1);
      } else {
        q.set(ex + 1, ey, e > 1.2 ? PAL.mag3 : PAL.mag2);
        q.set(ex + 2, ey, PAL.mag4);
        q.set(ex + 3, ey, PAL.white);
        q.set(ex + 4, ey, e > 0.8 ? PAL.mag4 : PAL.mag3);
        q.set(ex + 5, ey, PAL.mag3);
        if (sq < 0.5) {
          q.set(ex + 3, ey - 1, e > 1.3 ? PAL.mag4 : PAL.mag2);
          if (e > 1.3) q.set(ex + 2, ey - 1, PAL.mag2).set(ex + 4, ey - 1, PAL.mag3);
        }
      }
    },
    PAL.night0,
  );
  // near horn: roots at the helm's upper back, sweeps back, then hooks upward
  layer(
    p,
    (q) => {
      const nh = bezier([HX + 7, HY + 5], [HX + 1, HY + 3.5], [HX - 6, HY + 3.5], [HX - 8.5, HY - 4], 18);
      hornStroke(q, nh, 6, PAL.void1, PAL.void2, PAL.void3, PAL.void4);
      // ridges on the underside
      for (const i of [5, 8, 11]) q.paint(nh[i][0] + 1, nh[i][1] + 1.2, PAL.void0);
      // metal collar where the horn meets the helm
      q.paint(HX + 5, HY + 3, PAL.night3).paint(HX + 5, HY + 4, PAL.night2).paint(HX + 5, HY + 5, PAL.night2).paint(HX + 5, HY + 6, PAL.night1);
      q.paint(HX + 4, HY + 3, PAL.steel);
    },
    PAL.ink,
  );

  // ------------------------------------------------ front pauldron
  layer(
    p,
    (q) => {
      const [x, y] = T(43, 26.5);
      q.stamp(PAULDRON_F, KEY, Math.round(x), Math.round(y));
    },
    PAL.night0,
  );

  // ------------------------------------------------ staff shaft
  layer(
    p,
    (q) => {
      q.line(bot[0], bot[1], top[0], top[1], PAL.void1);
      q.line(bot[0] + nrm[0], bot[1] + nrm[1], top[0] + nrm[0], top[1] + nrm[1], PAL.void0);
      // glowing wraps along the shaft (u < 0 runs down from the head toward the grip and beyond)
      for (const u of [-3, -6, -29, -33]) {
        const [x, y] = SU(u, 0);
        q.set(x, y, PAL.void3);
        q.set(x + nrm[0], y + nrm[1], PAL.void2);
      }
      const f1: Pt = [bot[0] - dir[0] * 3, bot[1] - dir[1] * 3];
      q.line(bot[0], bot[1], f1[0], f1[1], PAL.night3);
      q.set(f1[0], f1[1], PAL.steel);
    },
    PAL.ink,
  );

  // ------------------------------------------------ front arm: bell sleeve + gauntlet
  const fShoulder = T(47.5, 31.5);
  layer(
    p,
    (q) => {
      const hand = grip;
      const el = ik(fShoulder[0], fShoulder[1], hand[0], hand[1], 7.5, 8, 1);
      const cd: Pt = [hand[0] - el[0], hand[1] - el[1]];
      const cl = Math.hypot(cd[0], cd[1]) || 1;
      const ux = cd[0] / cl;
      const uy = cd[1] / cl;
      const cuff: Pt = [hand[0] - ux * 2.2, hand[1] - uy * 2.2];
      const lag = o.sway * 0.5 - o.lean * 0.3 + (o.cx > 0 ? o.cx * 0.2 : 0);
      q.poly(sleevePoly(fShoulder, el, cuff, 5, 5.5, 8, 4, lag), PAL.void2);
      rows(q, (u) => (u < 0.2 ? PAL.void3 : u < 0.62 ? PAL.void2 : u < 0.88 ? PAL.void1 : PAL.void0));
      edge(q, 0, 1, PAL.void0);
      edge(q, 0, -1, PAL.void3);
      // embroidered cuff band, then the dark sleeve mouth
      clip(q, (t) => t.stroke([[cuff[0] - ux * 2.2 - uy * 4, cuff[1] - uy * 2.2 + ux * 4], [cuff[0] - ux * 2.2 + uy * 4, cuff[1] - uy * 2.2 - ux * 4]], 1.2, 1.2, o.rune > 0.6 ? PAL.void4 : PAL.void3));
      q.disc(cuff[0] + ux * 0.6, cuff[1] + uy * 0.6, 1.8, PAL.void0);
      // gauntlet gripping the staff
      q.disc(hand[0], hand[1], 2.3, PAL.night2);
      q.set(hand[0] - 1, hand[1] - 1, PAL.night4);
      q.set(hand[0] - 2, hand[1] - 1, PAL.night3);
      q.set(hand[0] - 1, hand[1] - 2, PAL.steel);
      q.set(hand[0] + 1, hand[1] + 1, PAL.night0);
      q.set(hand[0] + 1, hand[1], PAL.night1);
      q.set(hand[0], hand[1] + 1, PAL.night1);
    },
    PAL.void0,
  );

  // back hand on the staff (guard)
  if (o.bFront) drawBackArm(PAL.void0);

  // ------------------------------------------------ staff head (crescent claw) + orb
  layer(
    p,
    (q) => {
      const r = orbR;
      // crescent cupping the orb from below; tips curl up past its equator
      const R = Math.max(3.2, r + 1.4);
      const arcL: Pt[] = [];
      const arcR: Pt[] = [];
      for (let i = 0; i <= 10; i++) {
        const th = (i / 10) * 2.05;
        const u = orbOff - Math.cos(th) * R;
        arcL.push(SU(u, -Math.sin(th) * R));
        arcR.push(SU(u, Math.sin(th) * R));
      }
      q.stroke(arcR, 2.6, 1, PAL.night2);
      q.stroke(arcL, 2.6, 1, PAL.night3);
      q.stroke([SU(0, 0), SU(orbOff - R, 0)], 2.4, 2.4, PAL.night2);
      for (let i = 1; i < arcL.length - 1; i++) q.paint(arcL[i][0] - 0.6, arcL[i][1] - 0.6, i > 4 ? PAL.night4 : PAL.night3);
      q.paint(arcL[arcL.length - 1][0], arcL[arcL.length - 1][1], PAL.steel);
      q.paint(arcR[arcR.length - 1][0], arcR[arcR.length - 1][1], PAL.night4);
      const [cx, cy] = SU(0.8, 0);
      q.disc(cx, cy, 1.8, PAL.night2);
      q.set(cx - 1, cy - 1, PAL.night4);
      q.set(cx, cy - 1, PAL.steel);
    },
    PAL.ink,
  );
  if (orbR > 0.9) {
    layer(
      p,
      (q) => {
        const r = orbR;
        const [ox, oy] = orbC;
        q.disc(ox, oy, r, PAL.void2);
        q.disc(ox - 0.5, oy - 0.5, Math.max(0.6, r - 1), PAL.void3);
        q.disc(ox - r * 0.3, oy - r * 0.3, Math.max(0.5, r * 0.52), o.glow > 0.55 ? PAL.void4 : PAL.void3);
        if (r > 2.6) {
          // the abyss swirling inside
          const a = o.t * TAU * 1.5;
          for (let s = 0; s < 3; s++) {
            const aa = a + s * 0.5;
            const rr = r * (0.55 - s * 0.12);
            q.set(ox + Math.cos(aa) * rr, oy + Math.sin(aa) * rr, s === 0 ? PAL.void1 : PAL.void2);
          }
          edge(q, 1, 1, PAL.void1);
        }
        q.set(ox - r * 0.45, oy - r * 0.5, PAL.white);
        if (o.glow > 0.8) q.set(ox - r * 0.45 + 1, oy - r * 0.5, PAL.white).set(ox - r * 0.45, oy - r * 0.5 + 1, PAL.void4);
      },
      PAL.ink,
    );
  } else {
    p.set(orbC[0], orbC[1], PAL.void3);
  }

  // ------------------------------------------------ outline
  p.outline(PAL.ink);

  // ------------------------------------------------ glow pass (unoutlined light)
  // aura ring + burst lines (light only on empty pixels: reads as behind the body, unoutlined)
  const put = (x: number, y: number, c: number) => {
    if (!p.isOpaque(x, y)) p.set(x, y, c);
  };
  if (o.aura > 0) {
    // shock ring of abyssal energy: bright leading edge, dimmer trailing band, fading as it grows
    const [ax, ay] = T(40, 44);
    const r = 10 + o.aura * 19;
    const fade = 1 - o.aura;
    for (let a = 0; a < 160; a++) {
      const ang = (a / 160) * TAU;
      const wob = Math.sin(ang * 7 + o.t * 13) * 1.2;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang) * 0.62;
      const lead = r + wob;
      put(ax + ca * lead, ay + sa * lead, fade > 0.55 ? PAL.void4 : fade > 0.25 ? PAL.void3 : PAL.void2);
      if (fade > 0.2) put(ax + ca * (lead - 1.2), ay + sa * (lead - 1.2), fade > 0.55 ? PAL.void3 : PAL.void2);
      if (fade > 0.45 && a % 2 === 0) put(ax + ca * (lead - 2.4), ay + sa * (lead - 2.4), PAL.void1);
    }
    if (o.aura < 0.35) {
      // burst: speed lines shooting outward
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * TAU + 0.2;
        const r0 = r + 2 + (i % 3) * 2;
        const r1 = r0 + 5 + (i % 2) * 4;
        for (let d = r0; d <= r1; d += 0.5) put(ax + Math.cos(ang) * d, ay + Math.sin(ang) * d * 0.62, d > r1 - 2 ? PAL.void2 : PAL.void3);
      }
    }
  }

  const [ox, oy] = orbC;
  const r = orbR;
  const nS = o.glow > 0.8 ? 4 : 2;
  for (let i = 0; i < nS; i++) {
    const a = o.t * TAU + (i / nS) * TAU;
    const rr = r + 3.2 + Math.sin(o.t * TAU * 2 + i) * 0.5;
    const x = ox + Math.cos(a) * rr;
    const y = oy + Math.sin(a) * rr * 0.75;
    if (!p.isOpaque(x, y)) p.set(x, y, i % 2 ? PAL.void3 : PAL.void4);
  }
  if (o.charge > 0) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + o.t * 4;
      const rr = r + 3 + (1 - o.charge) * 8 + (i % 3) * 2.2;
      const x = ox + Math.cos(a) * rr;
      const y = oy + Math.sin(a) * rr;
      if (!p.isOpaque(x, y)) p.set(x, y, i % 3 === 0 ? PAL.mag3 : PAL.void4);
      const x2 = ox + Math.cos(a - 0.25) * (rr + 1.4);
      const y2 = oy + Math.sin(a - 0.25) * (rr + 1.4);
      if (!p.isOpaque(x2, y2)) p.set(x2, y2, PAL.void2);
    }
  }
  if (!Number.isNaN(o.trail)) {
    // smear arc: the orb's path from `trail` to the current angle, thick at the head, tapering
    const dist = STAFF_UP + orbOff;
    const a0 = o.trail;
    const a1 = o.sa;
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const f = i / steps; // 0 = tail, 1 = head
      const a = a0 + (a1 - a0) * f;
      const cx = grip[0] + Math.sin(a) * dist;
      const cy = grip[1] - Math.cos(a) * dist;
      const w = r * (0.2 + 0.65 * f);
      for (let yy = Math.floor(cy - w); yy <= cy + w; yy++)
        for (let xx = Math.floor(cx - w); xx <= cx + w; xx++) {
          const d = Math.hypot(xx + 0.5 - cx, yy + 0.5 - cy);
          if (d > w) continue;
          // the thin tail passes behind the helm; only the leading head of the smear covers the body
          if (f < 0.6 && p.isOpaque(xx, yy)) continue;
          if (Math.hypot(xx + 0.5 - ox, yy + 0.5 - oy) < r + 1) continue; // the orb stays on top of its own smear
          const core = d < w * 0.45 && f > 0.35;
          p.set(xx, yy, core ? (f > 0.7 ? PAL.void4 : PAL.void3) : f > 0.5 ? PAL.void2 : PAL.void1);
        }
    }
  }
  if (o.flash > 0) {
    // release flash: a tight bright ring hugging the orb plus a star of rays
    for (let a = 0; a < 48; a++) {
      const ang = (a / 48) * TAU;
      const x = ox + Math.cos(ang) * (r + 1.6);
      const y = oy + Math.sin(ang) * (r + 1.6);
      if (!p.isOpaque(x, y)) p.set(x, y, a % 3 === 0 ? PAL.white : PAL.void4);
    }
    const R0 = r + 2.5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      const len = i % 2 ? R0 + 1 : R0 + 2.5;
      for (let d = R0; d <= len; d++) {
        const x = ox + Math.cos(a) * d;
        const y = oy + Math.sin(a) * d;
        if (!p.isOpaque(x, y)) p.set(x, y, d > len - 1 ? PAL.void3 : d < R0 + 1 ? PAL.white : PAL.void4);
      }
    }
  }
  if (o.ward > 0) {
    // ward: a shell of abyssal light in front of the body, a bright crest sliding along it
    const [cx, cy] = T(40, 44);
    for (let i = 0; i <= 60; i++) {
      const f = i / 60;
      const a = -1.05 + f * 2.1;
      const x = cx + Math.cos(a) * 27;
      const y = cy + Math.sin(a) * 30;
      const crest = Math.abs(f - ((o.t * 1.0) % 1)) < 0.09;
      if (!crest && (i % 2 === 1 || o.ward < 0.5)) continue;
      put(x, y, crest ? (o.ward > 0.8 ? PAL.void4 : PAL.void3) : PAL.void2);
    }
  }
  if (o.eye > 1.5 && o.squint < 0.5) {
    const ey = HY + EYE_ROW;
    for (let i = 0; i < 4; i++) {
      const x = HX + 18 + i;
      if (!p.isOpaque(x, ey)) p.set(x, ey, i === 0 ? PAL.mag4 : i < 3 ? PAL.mag3 : PAL.mag2);
    }
  }

}

// ---------------------------------------------------------------- portrait (44×34)

function portrait(p: Canvas): void {
  // background: deep abyss with a violet bloom behind the orb and helm, a few motes
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 44; x++) {
      const d = Math.hypot((x - 30) / 1.2, y - 10);
      let c: number = PAL.night0;
      if (d < 26) c = PixelCanvas.ditherAt(x, y, Math.round(((26 - d) / 6) * 8)) ? PAL.void0 : PAL.night0;
      if (d < 20) c = PAL.void0;
      if (d < 14) c = PixelCanvas.ditherAt(x, y, Math.round(((14 - d) / 5) * 9)) ? PAL.void1 : PAL.void0;
      p.set(x, y, c);
    }
  const big = new PixelCanvas(W, H);
  drawMagus(big, P({ orb: 1.12, glow: 1, eye: 1.7, rune: 0.8, t: 0.15, gx: 54, gy: 41, sa: 0.1, cx: -2, flare: 0.3 }));
  const cx = 19;
  const cy = 3;
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 44; x++) {
      const c = big.get(cx + x, cy + y);
      if (c !== null) p.set(x, y, c);
    }
  p.set(3, 4, PAL.void3).set(6, 9, PAL.void2).set(40, 29, PAL.void2).set(2, 22, PAL.void2);
}

// ---------------------------------------------------------------- export

const IMPACT_FRAME = 5;
const IMPACT_ORB = orbCenter(ANIMS.attack.poses[IMPACT_FRAME]);

const art: MonsterArt = {
  id: 'abyss_magus',
  w: W,
  h: H,
  anchorX: 39,
  anchorY: 77,
  hover: 6,
  muzzle: { x: Math.round(IMPACT_ORB[0]), y: Math.round(IMPACT_ORB[1]) },
  core: { x: 40, y: 40 },
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
    drawMagus(p, poses[Math.max(0, Math.min(poses.length - 1, frame))]);
  },
  portrait,
};

export default art;
