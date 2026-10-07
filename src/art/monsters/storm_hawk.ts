// Fırtına Atmacası (storm_hawk) — WIND winged beast, 48×48, flying (hover 10).
//
// A fierce green-teal hawk hovering like a kestrel: body pitched up, tail fanned for balance,
// head held steady (birds stabilise the head while the body bobs). Parametric rig: every frame is
// a Pose (numbers). The wings are real 3D: each wing is a set of feathers laid out in its own
// span/chord plane, rotated by flap (φ) and sweep angles around the shoulder and projected with
// the bird turned slightly toward the camera — so the beat cycle foreshortens naturally (wings up
// = a wide V, level = a thin edge, down = the top surface sweeping across the breast). Each wing
// has controlled feather separations and transparent slots between the outer primaries so the
// "fingers" read at 1×. The hand section has its own lagging angle so the primaries trail the stroke
// (secondary motion). The head is hand-pixelled (4 stamps) so the face reads at 1×. Wind streaks,
// talon smears and the roar shockwave are light (drawn after the outline).

import { PAL } from '../palette';
import { PixelCanvas, bezier, type Pt } from '../pixel';
import type { MonsterAnim, MonsterArt } from '../types';

const W = 48;
const H = 48;
const TAU = Math.PI * 2;
/** Camera elevation cheat: how much of the wing planform we see when the wing is level. */
const EPS = 0.42;
const CE = Math.cos(EPS);
const SE = Math.sin(EPS);
/** The bird is turned slightly toward the camera: the near wing swings out left, the far wing right. */
const YAW = 0.42;
const CY = Math.cos(YAW);
const SY = Math.sin(YAW);

type V3 = [number, number, number];
type Canvas = PixelCanvas;
type HeadKey = 'level' | 'open' | 'up' | 'down';

// ---------------------------------------------------------------- pose

interface Pose {
  /** Body origin (middle of the torso, frame px) and pitch (rad, + = nose up). */
  x: number;
  y: number;
  pitch: number;
  /** Wing flap φ (rad, + = up) and hand lag (added to φ for the hand: tips trail the stroke). */
  flap: number;
  lag: number;
  /** Arm sweep (rad, + = back, − = forward) and extra hand sweep. */
  sweep: number;
  hsweep: number;
  /** 0 open → 1 folded flat against the body. */
  fold: number;
  /** Far-wing offsets (roar: the wings fling apart). */
  farFlap: number;
  farSweep: number;
  /** Span multiplier. */
  span: number;
  /** Mantle 0..1: wings wrapped forward around the body (guard). */
  wrap: number;
  /** Head stamp, offset, eye 0 shut / 1 open / 2 blazing, crest 0 flat .. 1 erect. */
  head: HeadKey;
  hx: number;
  hy: number;
  eye: number;
  crest: number;
  /** Tail angle below the body axis (rad) and fan 0..1. */
  tail: number;
  fan: number;
  /** Legs 0 tucked .. 1 thrust forward; toes 0 clenched .. 1 spread. */
  leg: number;
  toes: number;
  /** Feather ruffle 0..1 (hit). */
  ruffle: number;
  /** Downdraft curls under the wings, speed lines (dive), talon slash smear, roar shockwave (0..1). */
  draft: number;
  speed: number;
  smear: number;
  burst: number;
  /** Loose feathers drifting off (hit), progress 0..1 (0 = none). */
  loose: number;
  /** Flutter phase. */
  t: number;
}

const N: Pose = {
  x: 24,
  y: 28,
  pitch: 0.45,
  flap: 1.15,
  lag: 0,
  sweep: 0.3,
  hsweep: 0.15,
  fold: 0,
  farFlap: 0,
  farSweep: -0.45,
  span: 1,
  wrap: 0,
  head: 'level',
  hx: 0,
  hy: 0,
  eye: 1,
  crest: 0.4,
  tail: 0.3,
  fan: 0.5,
  leg: 0,
  toes: 0.3,
  ruffle: 0,
  draft: 0,
  speed: 0,
  smear: 0,
  burst: 0,
  loose: 0,
  t: 0,
};

const P = (o: Partial<Pose>): Pose => ({ ...N, ...o });

// ---------------------------------------------------------------- animations

/** Hover beat at phase t (0..1): wings at the top at 0, bottom at 0.5. */
function flapAt(t: number) {
  const c = Math.cos(t * TAU);
  const s = Math.sin(t * TAU);
  return {
    flap: 0.25 + 0.9 * c,
    // tips trail: above the arm on the downstroke, below it on the upstroke
    lag: 0.5 * s,
    // the hand partly folds on the upstroke (less drag)
    hsweep: 0.15 + 0.55 * Math.max(0, -s),
    span: 1 - 0.1 * Math.max(0, -s),
  };
}

function idlePose(f: number, n: number): Pose {
  const t = f / n;
  // the downstroke lifts the body; the head is stabilised (moves half as much)
  const bob = Math.round(1.2 * Math.cos(t * TAU));
  return P({
    ...flapAt(t),
    y: N.y + bob,
    hy: -bob * 0.5,
    tail: N.tail + 0.08 * Math.sin((t - 0.15) * TAU),
    fan: N.fan + 0.12 * Math.cos(t * TAU),
    draft: t > 0.2 && t < 0.75 ? Math.sin(((t - 0.2) / 0.55) * Math.PI) : 0,
    crest: 0.4 + 0.2 * Math.sin((t - 0.25) * TAU),
    eye: f === 6 ? 0.4 : 1,
    t,
  });
}

const ANIMS: Record<MonsterAnim, { fps: number; loop: boolean; poses: Pose[] }> = {
  idle: { fps: 12, loop: true, poses: Array.from({ length: 8 }, (_, f) => idlePose(f, 8)) },

  // Roar: gather (wings drawn in, head ducked) → fling the wings wide, head thrown back, beak
  // agape in a screech, tail fanned, a ring of wind bursts out → hold with shivering primaries →
  // one great downbeat → settle into the idle beat.
  roar: {
    fps: 12,
    loop: false,
    poses: [
      idlePose(0, 8),
      P({ ...flapAt(0.55), y: 29, x: 23, head: 'down', hy: 1, fold: 0.3, crest: 0.2, tail: 0.45, fan: 0.3, t: 0.1 }),
      P({ flap: 1.3, lag: 0.1, y: 30, x: 23, pitch: 0.35, head: 'down', hy: 1.5, fold: 0.6, crest: 0.1, tail: 0.5, fan: 0.2, eye: 1.5, t: 0.2 }),
      P({ flap: 0.75, lag: 0.4, sweep: 0.55, hsweep: 0.1, farFlap: -0.55, farSweep: -1.0, span: 1.12, y: 26, pitch: 0.7, head: 'up', hy: -1, eye: 2, crest: 1, tail: 0.55, fan: 1, burst: 0.2, t: 0.3 }),
      P({ flap: 0.75, lag: 0.25, sweep: 0.55, hsweep: 0.1, farFlap: -0.55, farSweep: -1.0, span: 1.15, y: 26, pitch: 0.72, head: 'up', hy: -1, eye: 2, crest: 1, tail: 0.58, fan: 1, burst: 0.5, t: 0.4 }),
      P({ flap: 0.75, lag: 0.33, sweep: 0.55, hsweep: 0.1, farFlap: -0.55, farSweep: -1.0, span: 1.15, y: 26, pitch: 0.72, head: 'up', hy: -1, eye: 2, crest: 1, tail: 0.56, fan: 1, burst: 0.75, t: 0.5 }),
      P({ flap: 0.75, lag: 0.22, sweep: 0.55, hsweep: 0.1, farFlap: -0.55, farSweep: -1.0, span: 1.12, y: 26, pitch: 0.7, head: 'up', hy: -1, eye: 2, crest: 0.9, tail: 0.55, fan: 0.95, burst: 1, t: 0.6 }),
      P({ ...flapAt(0.3), y: 27, pitch: 0.55, head: 'open', eye: 1.5, crest: 0.7, fan: 0.8, draft: 1, t: 0.7 }),
      P({ ...flapAt(0.5), y: 26, pitch: 0.5, eye: 1.2, crest: 0.55, fan: 0.6, draft: 0.7, t: 0.8 }),
      P({ ...flapAt(0.8), y: 28, t: 0.9 }),
    ],
  },

  // Attack ("Kasırga Dalışı"): a beat to climb, wings swing up and fold (anticipation) → tucked
  // dive with speed lines → IMPACT: body swings upright, wings flare back to brake, talons thrust
  // forward wide open with a slash smear → clench + downbeat follow-through → climb back home.
  attack: {
    fps: 12,
    loop: false,
    poses: [
      idlePose(0, 8),
      P({ ...flapAt(0.45), y: 26, pitch: 0.6, crest: 0.2, eye: 1.5, draft: 0.8, t: 0.1 }),
      P({ flap: 1.35, lag: -0.1, hsweep: 0.4, fold: 0.45, y: 23, x: 23, pitch: 0.5, head: 'down', crest: 0, eye: 2, tail: 0.4, fan: 0.2, t: 0.2 }),
      P({ fold: 0.92, flap: 1.3, x: 27, y: 25, pitch: -0.45, head: 'down', crest: 0, eye: 2, tail: 0.05, fan: 0, speed: 0.6, t: 0.3 }),
      P({ fold: 0.95, flap: 1.3, x: 28, y: 30, pitch: -0.55, head: 'down', crest: 0, eye: 2, tail: 0, fan: 0, leg: 0.45, toes: 0.6, speed: 1, t: 0.4 }),
      P({ flap: 1.25, lag: 0.45, sweep: 0.55, hsweep: 0.35, fold: 0, x: 30, y: 28, pitch: 0.55, head: 'open', crest: 0.2, eye: 2, tail: 0.7, fan: 1, leg: 1, toes: 1, speed: 0.4, smear: 1, t: 0.5 }),
      P({ ...flapAt(0.45), x: 30, y: 27, pitch: 0.6, head: 'open', crest: 0.3, eye: 2, tail: 0.6, fan: 0.8, leg: 0.7, toes: 0, smear: 0.45, draft: 1, t: 0.6 }),
      P({ ...flapAt(0.8), x: 28, y: 25, pitch: 0.5, crest: 0.4, eye: 1.5, tail: 0.45, fan: 0.6, leg: 0.3, toes: 0.2, t: 0.7 }),
      P({ ...flapAt(0.2), x: 25, y: 26, crest: 0.4, eye: 1.2, draft: 0.5, t: 0.8 }),
      P({ ...flapAt(0.6), x: 24, y: 28, t: 0.9 }),
    ],
  },

  // Hit: knocked back and up, wings flung out of rhythm, feathers ruffled, eyes squeezed shut;
  // loose feathers drift away while it rights itself.
  hit: {
    fps: 10,
    loop: false,
    poses: [
      P({ flap: 1.45, lag: -0.55, hsweep: 0.6, x: 21, y: 26, pitch: 0.85, head: 'open', hx: -0.5, eye: 0, crest: 1, tail: 0.15, fan: 0.9, ruffle: 1, leg: 0.4, toes: 1, loose: 0.15, t: 0.1 }),
      P({ flap: 0.6, lag: 0.4, x: 21, y: 27, pitch: 0.7, head: 'open', eye: 0, crest: 0.8, tail: 0.25, fan: 0.7, ruffle: 0.6, leg: 0.2, toes: 0.7, loose: 0.45, t: 0.2 }),
      P({ ...flapAt(0.55), x: 22, y: 28, pitch: 0.55, eye: 0.6, crest: 0.6, ruffle: 0.25, loose: 0.75, t: 0.3 }),
      P({ ...flapAt(0.85), x: 23, y: 28, eye: 1, loose: 1, t: 0.4 }),
    ],
  },

  // Guard: wings mantled forward around the body like a cloak, head low and peering over the
  // wrap, a slow 1px breathing bob; primary tips stir in the wind.
  guard: {
    fps: 5,
    loop: true,
    poses: [0, 1, 2, 3].map((f) => {
      const t = f / 4;
      const s = Math.sin(t * TAU);
      return P({
        wrap: 1,
        y: 29 + (s > 0.5 ? -1 : 0),
        pitch: 0.95,
        head: 'down',
        hx: -1,
        hy: 1.5,
        crest: 0.15 + 0.1 * s,
        eye: 1.6,
        tail: 0.15,
        fan: 0.15,
        lag: 0.06 * s,
        t,
      });
    }),
  },
};

// ---------------------------------------------------------------- head stamps
// 'E' marks the bright part of the eye (the placement anchor), 'e' the iris, 'p' the pupil.

const HEAD_KEY: Record<string, number> = {
  k: PAL.ink,
  G: PAL.leaf3,
  g: PAL.leaf2,
  d: PAL.leaf1,
  D: PAL.leaf0,
  M: PAL.white,
  m: PAL.mist,
  s: PAL.steel,
  Y: PAL.gold4,
  y: PAL.gold3,
  o: PAL.gold2,
  O: PAL.gold1,
  E: PAL.gold4,
  e: PAL.gold3,
  p: PAL.ink,
  r: PAL.crim1,
  R: PAL.crim2,
};

const HEADS: Record<HeadKey, { rows: string[]; crest: Pt[] }> = {
  level: {
    rows: [
      '..GGGG......',
      '.GgggGGG....',
      'Gggggggggo..',
      'gggkkkkkkyY.',
      'ddDdEepgoyyY',
      'dDDDmmmmooyy',
      '.DDmmmmm..oy',
      '..DMmmmm...O',
      '...MMmm.....',
    ],
    crest: [
      [-3, -3],
      [-4, -1.5],
    ],
  },
  open: {
    rows: [
      '..GGGG......',
      '.GgggGGG....',
      'Gggggggggo..',
      'gggkkkkkkyY.',
      'ddDdEepgoyyY',
      'dDDDmmmmorRy',
      '.DDmmmmmor.y',
      '..DMmmmmoyO.',
      '...MMmm.....',
    ],
    crest: [
      [-3, -3],
      [-4, -1.5],
    ],
  },
  up: {
    rows: [
      '.........Y..',
      '........yy..',
      '..GGGG.oyO..',
      '.GgggGoyr...',
      'GggkkkyrR...',
      'ddDEepoRRr..',
      'dDDDmmmorRyO',
      '.DDmmmmmoyy.',
      '..DMMmm.....',
    ],
    crest: [
      [-2, -3],
      [-3, -1.5],
    ],
  },
  down: {
    rows: [
      '.GGGG.......',
      'GgggGGGG....',
      'ggggggggGo..',
      'gggkkkkkkyY.',
      'ddDdEepgoyyY',
      'dDDDmmmmooyy',
      '.DDmmmm...oy',
      '..DMmm.....O',
      '...MM.......',
    ],
    crest: [
      [-3, -4],
      [-4, -2.5],
    ],
  },
};

function eyeOf(rows: string[]): Pt {
  for (let y = 0; y < rows.length; y++) {
    const x = rows[y].indexOf('E');
    if (x >= 0) return [x, y];
  }
  return [0, 0];
}

// ---------------------------------------------------------------- helpers

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const scl = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const nrm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

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

/** Ramp steps for the hawk's materials (one up = lighter). */
const UP = new Map<number, number>([
  [PAL.leaf0, PAL.leaf1],
  [PAL.leaf1, PAL.leaf2],
  [PAL.leaf2, PAL.leaf3],
  [PAL.leaf3, PAL.leaf4],
  [PAL.teal1, PAL.teal2],
  [PAL.teal2, PAL.teal3],
  [PAL.teal3, PAL.teal4],
  [PAL.steel, PAL.mist],
  [PAL.mist, PAL.white],
  [PAL.gold1, PAL.gold2],
  [PAL.gold2, PAL.gold3],
  [PAL.gold3, PAL.gold4],
]);
const DN = new Map<number, number>([
  [PAL.leaf1, PAL.leaf0],
  [PAL.leaf2, PAL.leaf1],
  [PAL.leaf3, PAL.leaf2],
  [PAL.leaf4, PAL.leaf3],
  [PAL.teal2, PAL.teal1],
  [PAL.teal3, PAL.teal2],
  [PAL.teal4, PAL.teal3],
  [PAL.mist, PAL.steel],
  [PAL.white, PAL.mist],
  [PAL.gold2, PAL.gold1],
  [PAL.gold3, PAL.gold2],
  [PAL.gold4, PAL.gold3],
]);

/** Light a layer: exposed top (and optionally left) edges one step up, exposed bottoms down. */
function rim(q: Canvas, o: { left?: boolean; down?: number; only?: (c: number) => boolean } = {}): void {
  const src = q.clone();
  const down = o.down ?? 1;
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      const c = src.get(x, y);
      if (c === null) continue;
      if (o.only && !o.only(c)) continue;
      if (!src.isOpaque(x, y - 1) || (o.left && !src.isOpaque(x - 1, y))) {
        const n = UP.get(c);
        if (n !== undefined) q.set(x, y, n);
        continue;
      }
      let d = false;
      for (let k = 1; k <= down && !d; k++) d = !src.isOpaque(x, y + k);
      if (d) {
        const n = DN.get(c);
        if (n !== undefined) q.set(x, y, n);
      }
    }
}

/** Paint a band along a segment between t0..t1 (only on already-opaque pixels). */
function bandPaint(q: Canvas, a: Pt, b: Pt, t0: number, t1: number, w: number, col: number): void {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (t < t0 || t > t1) continue;
    const x = lerp(a[0], b[0], t);
    const y = lerp(a[1], b[1], t);
    for (let yy = Math.floor(y - w); yy <= Math.ceil(y + w); yy++)
      for (let xx = Math.floor(x - w); xx <= Math.ceil(x + w); xx++) if (Math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= w) q.paint(xx, yy, col);
  }
}

// ---------------------------------------------------------------- rig

interface Rig {
  /** Body-local (u forward, v down) → frame px. */
  B: (u: number, v: number) => Pt;
  /** Wing-frame 3D vector (x forward, y up, z toward camera) → screen delta. */
  VW: (v: V3) => Pt;
  /** Frame px → body-local. */
  inv: (x: number, y: number) => Pt;
  /** Where the eye ('E' pixel) lands. */
  eye: Pt;
}

function rigOf(o: Pose): Rig {
  const cp = Math.cos(o.pitch);
  const sp = Math.sin(o.pitch);
  const fx = cp;
  const fy = -sp;
  const dx = sp;
  const dy = cp;
  const B = (u: number, v: number): Pt => [o.x + u * fx + v * dx, o.y + u * fy + v * dy];
  const inv = (x: number, y: number): Pt => {
    const rx = x + 0.5 - o.x;
    const ry = y + 0.5 - o.y;
    return [rx * fx + ry * fy, rx * dx + ry * dy];
  };
  // The beat plane mostly ignores the body pitch (a hovering bird beats level) but follows it
  // once the wing folds against the body.
  const wp = lerp(o.pitch * 0.2, o.pitch, Math.max(o.fold, o.wrap));
  const wc = Math.cos(wp);
  const ws = Math.sin(wp);
  const VW = (v: V3): Pt => {
    const x1 = v[0] * wc - v[1] * ws;
    const y1 = v[0] * ws + v[1] * wc;
    const x2 = x1 * CY - v[2] * SY;
    const z2 = x1 * SY + v[2] * CY;
    return [x2, -y1 * CE + z2 * SE];
  };
  const hc = B(6.8 * BK, -3.5 * BK);
  const eye: Pt = [Math.round(hc[0] + 0.5 + o.hx), Math.round(hc[1] - 0.5 + o.hy)];
  return { B, VW, inv, eye };
}

interface Feather {
  root: Pt;
  tip: Pt;
  w0: number;
  w1: number;
  pri: boolean;
}

interface WingGeo {
  S: Pt;
  Wr: Pt;
  T: Pt;
  coverts: Pt[];
  feathers: Feather[];
}

/** Build one wing (side 1 = near, −1 = far) in screen space. */
function wingGeo(o: Pose, r: Rig, side: 1 | -1): WingGeo {
  const { B, VW } = r;
  const far = side < 0;
  let phi = o.flap + (far ? o.farFlap : 0);
  let sw = o.sweep + (far ? o.farSweep : 0);
  let phiH = phi + o.lag;
  let swH = sw + o.hsweep;
  const fold = o.fold;
  phi = lerp(phi, 1.45, fold);
  sw = lerp(sw, 1.3, fold);
  phiH = lerp(phiH, 1.5, fold);
  swH = lerp(swH, 1.48, fold);
  // mantle: the arm swings forward around the chest, the hand curls down in front
  // mantle (guard): a folded wing pulled forward over the breast like a cloak — the arm swings
  // forward and the hand hangs down across the front of the body
  if (o.wrap > 0) {
    phi = lerp(phi, 1.5, o.wrap);
    sw = lerp(sw, far ? 0.9 : 0.55, o.wrap);
    phiH = lerp(phiH, 1.55, o.wrap) + o.lag;
    swH = lerp(swH, far ? 1.9 : 2.25, o.wrap);
  }
  const span = (ph: number, s: number): V3 => [-Math.sin(s), Math.cos(s) * Math.sin(ph), side * Math.cos(s) * Math.cos(ph)];
  const chord = (ph: number, s: number): V3 => [-Math.cos(s), -Math.sin(s) * Math.sin(ph), -side * Math.sin(s) * Math.cos(ph)];
  const sA = span(phi, sw);
  const cA = chord(phi, sw);
  const sH = span(phiH, swH);
  const cH = chord(phiH, swH);
  const sp = o.span * BK;
  const La = 5.4 * sp * (1 - 0.45 * fold);
  const Lh = 4.8 * sp * (1 - 0.3 * fold);
  const sh3: V3 = [0, 0, side * 1.8];
  const S0 = B((far ? 2.6 : 1.6) * BK, (far ? -2.6 : -2.1) * BK);
  const to = (v: V3): Pt => {
    const d = VW(add(sh3, v));
    return [S0[0] + d[0], S0[1] + d[1]];
  };
  const S3: V3 = [0, 0, 0];
  const Wr3 = scl(sA, La);
  const T3 = add(Wr3, sH, Lh);
  const feathers: Feather[] = [];
  // secondaries along the arm (inner first)
  [0.12, 0.38, 0.64, 0.9].forEach((t) => {
    const root = add(add(S3, sA, La * t), cA, 0.6);
    const dir = nrm(add(cA, sA, 0.1 + 0.2 * t + 0.4 * fold));
    const len = (5.8 + 0.8 * t) * lerp(1, 1.1, fold) * (0.6 + 0.4 * sp);
    feathers.push({ root: to(root), tip: to(add(root, dir, len)), w0: 3.4, w1: 2.8, pri: false });
  });
  // primaries along the hand: inner ones trail back, outer ones are the spread "fingers"
  const fw = [0.1, 0.3, 0.5, 0.68, 0.84];
  const fl = [6.8, 7.6, 8.2, 8, 7.2];
  fw.forEach((w0, k) => {
    const root = add(add(Wr3, sH, (Lh * k) / 4), cH, 0.4);
    const w = lerp(w0, 0.92, fold);
    const dir = nrm(add(scl(cH, 1 - w), sH, w));
    const len = fl[k] * sp * lerp(1, 0.95, fold);
    feathers.push({ root: to(root), tip: to(add(root, dir, len)), w0: 2.6, w1: 1.1, pri: true });
  });
  const coverts: Pt[] = [to(S3), to(Wr3), to(T3), to(add(T3, cH, 2.2)), to(add(Wr3, cA, 3.6)), to(add(S3, cA, 4.2))];
  return { S: to(S3), Wr: to(Wr3), T: to(T3), coverts, feathers };
}

interface WingPal {
  feather: number;
  sep: number;
  tipA: number;
  tipB: number;
  cov: number;
  covSep: number;
  edge: number;
  bar: number;
}

const WING_TOP: WingPal = { feather: PAL.leaf1, sep: PAL.leaf0, tipA: PAL.teal2, tipB: PAL.teal3, cov: PAL.leaf2, covSep: PAL.leaf0, edge: PAL.leaf3, bar: PAL.teal2 };
const WING_FAR: WingPal = { feather: PAL.leaf0, sep: PAL.ink, tipA: PAL.teal1, tipB: PAL.teal2, cov: PAL.leaf1, covSep: PAL.ink, edge: PAL.leaf2, bar: PAL.teal1 };

function drawWing(p: Canvas, o: Pose, r: Rig, side: 1 | -1): void {
  const g = wingGeo(o, r, side);
  const far = side < 0;
  const pal = far ? WING_FAR : WING_TOP;
  // trailing-edge order: outermost primary → innermost secondary
  const fe = [...g.feathers.filter((f) => f.pri).reverse(), ...g.feathers.filter((f) => !f.pri).reverse()];
  layer(
    p,
    (q) => {
      // 1) silhouette: every feather + the coverts, one flat flight-feather colour
      for (const f of fe) {
        const mid: Pt = [lerp(f.root[0], f.tip[0], 0.5), lerp(f.root[1], f.tip[1], 0.5)];
        q.stroke([f.root, mid, f.tip], f.w0, f.w1, pal.feather);
      }
      q.poly(g.coverts, pal.feather);
      q.stroke([g.S, g.Wr, g.T], 2.4, 1.6, pal.feather);
      // 2) teal tips on the outer quarter of each feather
      for (const f of fe) {
        bandPaint(q, f.root, f.tip, f.pri ? 0.66 : 0.8, 1, f.pri ? 1.4 : 1.8, pal.tipA);
        if (f.pri) bandPaint(q, f.root, f.tip, 0.9, 1, 1.2, pal.tipB);
      }
      // 3) feather separations: a line in from each notch between neighbouring tips; slots
      //    (transparent gaps) between the outer primaries so the "fingers" read
      for (let i = 0; i + 1 < fe.length; i++) {
        const a = fe[i];
        const b = fe[i + 1];
        const nt: Pt = [(a.tip[0] + b.tip[0]) / 2, (a.tip[1] + b.tip[1]) / 2];
        const nr: Pt = [(a.root[0] + b.root[0]) / 2, (a.root[1] + b.root[1]) / 2];
        const slot = a.pri && b.pri && i < 3;
        const from: Pt = [lerp(nr[0], nt[0], 0.42), lerp(nr[1], nt[1], 0.42)];
        const n = Math.ceil(Math.hypot(nt[0] - from[0], nt[1] - from[1]) * 1.5);
        for (let j = 0; j <= n; j++) {
          const t = j / n;
          const x = lerp(from[0], nt[0], t);
          const y = lerp(from[1], nt[1], t);
          if (slot && t > 0.72) q.erase(x, y);
          else q.paint(x, y, pal.sep);
        }
      }
      // 4) coverts: lighter zone along the leading edge, teal bar on its trailing edge,
      //    a lit leading edge
      const cv = new PixelCanvas(q.w, q.h);
      cv.poly(g.coverts, pal.cov);
      cv.stroke([g.S, g.Wr, g.T], 2.4, 1.6, pal.cov);
      const src = cv.clone();
      for (let y = 0; y < cv.h; y++)
        for (let x = 0; x < cv.w; x++) {
          if (!src.isOpaque(x, y) || !q.isOpaque(x, y)) continue;
          let col = pal.cov;
          const inner = src.isOpaque(x, y + 1) && src.isOpaque(x + 1, y) && src.isOpaque(x - 1, y) && src.isOpaque(x, y - 1);
          if (!inner) {
            // which side is open? top/left = leading edge light, otherwise the trailing bar
            const lead = !src.isOpaque(x, y - 1) || (!far && !src.isOpaque(x - 1, y) && src.isOpaque(x + 1, y));
            col = lead ? pal.edge : pal.bar;
          }
          q.set(x, y, col);
        }
    },
    PAL.ink,
  );
}

/** Global body scale (the hawk is drawn a touch larger than its base proportions). */
const BK = 1.2;

const TORSO: Pt[] = [
  ...bezier([5.2, -0.8], [4.4, -3.4], [0.5, -3.6], [-3.5, -2.5], 8),
  ...bezier([-3.5, -2.5], [-5.8, -1.8], [-7.4, -0.6], [-7.6, 0.4], 6).slice(1),
  ...bezier([-7.6, 0.4], [-6.4, 2.2], [-1.6, 3.6], [2.4, 3.2], 8).slice(1),
  ...bezier([2.4, 3.2], [5.0, 2.8], [6.2, 1.2], [5.2, -0.8], 8).slice(1),
];

function drawHawk(p: Canvas, o: Pose): void {
  const r = rigOf(o);
  const { B, inv } = r;
  const flut = (i: number) => Math.sin((o.t * 2 + i * 0.37) * TAU);
  const headDef = HEADS[o.head];
  const eAt = eyeOf(headDef.rows);
  const headX = r.eye[0] - eAt[0];
  const headY = r.eye[1] - eAt[1];

  // ------------------------------------------------ far wing (behind everything)
  drawWing(p, o, r, -1);

  // ------------------------------------------------ tail fan
  const tailRoot = B(-6.6 * BK, 0.6);
  const back = Math.atan2(Math.sin(o.pitch), -Math.cos(o.pitch));
  const tailA = back - o.tail;
  layer(p, (q) => {
    // one flared fan: narrow at the rump, broad notched tip; radial feather separations, a dark
    // subterminal band and teal tips
    const L = 10.5;
    const Wd = 2.6 + 5 * o.fan;
    const ca = Math.cos(tailA);
    const sa = Math.sin(tailA);
    const at = (d: number, w: number): Pt => [tailRoot[0] + ca * d - sa * w, tailRoot[1] + sa * d + ca * w];
    q.poly([at(-1, -1.4), at(L, -Wd / 2), at(L + 0.9, -Wd / 4), at(L + 1.2, 0), at(L + 0.9, Wd / 4), at(L, Wd / 2), at(-1, 1.4)], PAL.leaf1);
    for (let y = 0; y < q.h; y++)
      for (let x = 0; x < q.w; x++) {
        if (!q.isOpaque(x, y)) continue;
        const rx = x + 0.5 - tailRoot[0];
        const ry = y + 0.5 - tailRoot[1];
        const d = rx * ca + ry * sa;
        const w = -rx * sa + ry * ca;
        let col: number = PAL.leaf1;
        if (w < -Wd * 0.12 * (d / L)) col = PAL.leaf2; // upper half catches the light
        if (d > L * 0.5 && d < L * 0.5 + 1.2) col = PAL.leaf0;
        if (d > L - 3.2) col = PAL.leaf0;
        if (d > L - 1.6) col = PAL.teal2;
        if (d > L - 0.4) col = PAL.teal3;
        q.set(x, y, col);
      }
    const nF = o.fan > 0.6 ? 4 : 3;
    for (let k = 1; k < nF; k++) {
      const w0 = lerp(-0.7, 0.7, k / nF);
      const w1 = lerp(-Wd / 2, Wd / 2, k / nF);
      const a = at(L * 0.4, w0);
      const b2 = at(L - 2.2, lerp(w0, w1, 0.85));
      q.line(a[0], a[1], b2[0], b2[1], PAL.leaf0);
      const tip = at(L + 0.6, w1 * 0.9);
      q.erase(tip[0], tip[1]);
    }
  });

  // ------------------------------------------------ legs (tucked under the breast in flight)
  const hip = B(1.4 * BK, 2.2 * BK);
  const legA = lerp(1.5, 0.45, o.leg) - (o.pitch - N.pitch) * 0.8 * (1 - o.leg);
  const legL = lerp(3.4, 8.8, o.leg);
  const footOf = (near: boolean): Pt => {
    const a = legA + (near ? 0.1 : -0.05);
    const s = near ? 1 : -1;
    return [hip[0] + Math.cos(a) * legL + s * 1.1, hip[1] + Math.sin(a) * legL - s * 0.6];
  };
  const drawLeg = (q: Canvas, near: boolean) => {
    const ft = footOf(near);
    const h0: Pt = [hip[0] + (near ? 0.8 : -0.6), hip[1] - (near ? 0 : 0.6)];
    const knee: Pt = [lerp(h0[0], ft[0], 0.4), lerp(h0[1], ft[1], 0.4)];
    // feathered thigh and scaled tarsus (only when the leg is lowered)
    if (o.leg > 0.2) {
      q.stroke([h0, knee], 3.6, 2.6, near ? PAL.leaf1 : PAL.leaf0);
      q.stroke([knee, ft], 1.6, 1.4, near ? PAL.gold2 : PAL.gold1);
    }
    // toes: three forward, one back (hallux); spread or clenched
    const fa = Math.atan2(ft[1] - h0[1], ft[0] - h0[0]);
    const spread = lerp(0.15, 0.75, o.toes);
    const tl = lerp(1.6, 3.2, o.toes) * lerp(0.8, 1, o.leg);
    const curl = lerp(1.1, 0, o.toes);
    const toe = (a: number, l: number, claw: boolean) => {
      const e: Pt = [ft[0] + Math.cos(a) * l, ft[1] + Math.sin(a) * l];
      q.line(ft[0], ft[1], e[0], e[1], near ? PAL.gold3 : PAL.gold2);
      if (claw) {
        const c2: Pt = [e[0] + Math.cos(a + 1.3) * 1.2, e[1] + Math.sin(a + 1.3) * 1.2];
        q.set(c2[0], c2[1], near ? PAL.white : PAL.gold3);
      }
    };
    toe(fa - spread + curl * 0.5, tl, o.toes > 0.5);
    toe(fa + curl * 0.7, tl, o.toes > 0.5);
    toe(fa + spread + curl * 0.9, tl * 0.85, false);
    if (o.leg > 0.3) toe(fa + Math.PI - 0.5 - spread * 0.4, tl * 0.7, false);
    q.set(ft[0], ft[1], near ? PAL.gold3 : PAL.gold2);
  };
  layer(p, (q) => drawLeg(q, false));

  // ------------------------------------------------ torso + neck + crest + head
  layer(p, (q) => {
    q.poly(
      TORSO.map(([u, v]) => B(u * BK, v * BK)),
      PAL.leaf1,
    );
    // neck: from the shoulders into the back of the head
    const n0 = B(3.8, -1.4);
    const n1: Pt = [headX + 3, headY + 5.5];
    q.stroke([n0, [lerp(n0[0], n1[0], 0.5) + 0.3, lerp(n0[1], n1[1], 0.5)], n1], 6.2, 5.6, PAL.leaf1);
    // throat/breast: pale where the body faces forward (scalloped boundary), neck front pale too
    const nd: Pt = [n1[0] - n0[0], n1[1] - n0[1]];
    for (let y = 0; y < q.h; y++)
      for (let x = 0; x < q.w; x++) {
        if (q.get(x, y) !== PAL.leaf1) continue;
        const [u0, v0] = inv(x, y);
        const u = u0 / BK;
        const v = v0 / BK;
        const scal = (Math.floor(u * 1.3) & 1) === 0 ? 0.35 : -0.15;
        const breast = v > 0.2 - 0.4 * u + scal && u > -3.4;
        // right of the neck line (cross product sign) = throat
        const cx = (x + 0.5 - n0[0]) * nd[1] - (y + 0.5 - n0[1]) * nd[0];
        const throat = u > 3 && cx < -2.2;
        if (breast || throat) q.set(x, y, PAL.mist);
      }
    // ruffled feathers: spikes poking out of the outline all round the body
    if (o.ruffle > 0) {
      const n = Math.round(6 + 8 * o.ruffle);
      for (let i = 0; i < n; i++) {
        const k = Math.floor((i / n) * TORSO.length + hash(i, 3) * 3) % TORSO.length;
        const [u, v] = TORSO[k];
        const a = Math.atan2(v, u) - o.pitch + (hash(i, 9) - 0.5) * 0.6 - 0.4;
        const L = 1.8 + 2.6 * o.ruffle * (0.5 + hash(i, 5) * 0.5);
        const b0 = B(u * BK * 0.9, v * BK * 0.9);
        const tip: Pt = [b0[0] + Math.cos(a) * (L + 1.2), b0[1] + Math.sin(a) * (L + 1.2)];
        const pa = a + Math.PI / 2;
        const col = q.get(b0[0], b0[1]) ?? PAL.leaf1;
        q.tri(b0[0] + Math.cos(pa) * 1.1, b0[1] + Math.sin(pa) * 1.1, b0[0] - Math.cos(pa) * 1.1, b0[1] - Math.sin(pa) * 1.1, tip[0], tip[1], col);
      }
    }
    // volume: lit top edge, cool underside
    rim(q, { down: 1 });
    // breast barring: rows of small dark chevrons (the raptor's barred front)
    for (const [u, v] of [
      [4.6, 0.4],
      [3.2, 1.6],
      [1.4, 2.4],
      [5.4, 1.8],
      [-0.6, 2.8],
      [2.6, 3.2],
    ] as const) {
      const c = B(u * BK, v * BK);
      const x = Math.round(c[0]);
      const y = Math.round(c[1]);
      if (q.get(x, y) !== PAL.mist && q.get(x, y) !== PAL.white) continue;
      q.set(x, y, PAL.night4);
      if (q.get(x - 1, y - 1) === PAL.mist) q.set(x - 1, y - 1, PAL.steel);
      if (q.get(x + 1, y - 1) === PAL.mist) q.set(x + 1, y - 1, PAL.steel);
    }
    // back: a few darker covert scallops
    for (const [u, v] of [
      [-1, -2.2],
      [-3.8, -1.2],
      [1.6, -2.6],
    ] as const) {
      const c = B(u, v);
      if (q.get(c[0], c[1]) === PAL.leaf1) q.set(c[0], c[1], PAL.leaf0);
    }
    // crest: two swept feathers off the back of the head (under the head stamp)
    headDef.crest.forEach(([cx, cy], i) => {
      const a = Math.PI + lerp(0.35, 1.05, o.crest) - i * 0.45 + 0.08 * flut(i + 7);
      const root: Pt = [r.eye[0] + cx + 0.5, r.eye[1] + cy + 0.5];
      const L = 3.2 - i * 1 + o.crest * 1.4;
      const tip: Pt = [root[0] + Math.cos(a) * L, root[1] + Math.sin(a) * L];
      q.stroke([root, tip], 2.2, 1, PAL.leaf1);
      q.set(Math.floor(tip[0]), Math.floor(tip[1]), PAL.teal3);
      const m: Pt = [lerp(root[0], tip[0], 0.6), lerp(root[1], tip[1], 0.6)];
      q.paint(m[0], m[1] - 1, PAL.leaf2);
    });
    // the head itself (hand-pixelled)
    q.stamp(headDef.rows, HEAD_KEY, headX, headY);
    // eye state
    const [ex, ey] = r.eye;
    if (o.eye < 0.3) {
      q.set(ex, ey, PAL.ink).set(ex + 1, ey, PAL.ink).set(ex + 2, ey, PAL.leaf1);
    } else if (o.eye < 0.8) {
      q.set(ex, ey, PAL.gold3).set(ex + 1, ey, PAL.gold2);
    } else if (o.eye >= 1.5) {
      q.set(ex, ey, PAL.white).set(ex + 1, ey, PAL.gold4);
    }
  });

  // ------------------------------------------------ near leg
  layer(p, (q) => drawLeg(q, true));

  // ------------------------------------------------ near wing
  drawWing(p, o, r, 1);

  // ------------------------------------------------ outline
  p.outline(PAL.ink);

  // ------------------------------------------------ light effects (no outline)
  fx(p, o, r);
}

/** A 1px light streak along a polyline: bright head → fading tail. Never paints over the body. */
function streak(p: Canvas, pts: Pt[], cols: number[]): void {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i];
    if (p.isOpaque(x, y) || x < 1 || x > W - 2 || y < 1 || y > H - 2) continue;
    p.set(x, y, cols[Math.min(cols.length - 1, Math.floor((i / n) * cols.length))]);
  }
}

const WIND = [PAL.white, PAL.teal4, PAL.teal3, PAL.teal2];

function fx(p: Canvas, o: Pose, r: Rig): void {
  const { B } = r;
  // storm wisps: two little wind crescents orbiting the hawk (its WIND aura)
  if (o.ruffle === 0 && o.speed === 0) {
    const c = B(0, 0);
    for (let k = 0; k < 2; k++) {
      // half a turn per loop: the two wisps swap places, so the cycle is seamless
      const ph = (o.t * 0.5 + k * 0.5) % 1;
      const a0 = ph * TAU + 0.6;
      const R = 15;
      const pts: Pt[] = [];
      for (let j = 0; j < 6; j++) {
        const a = a0 - j * 0.12;
        pts.push([c[0] + Math.cos(a) * R, c[1] + Math.sin(a) * R * 0.55 + 2]);
      }
      // fade on the far side of the orbit (behind the bird)
      const front = Math.sin(a0) > -0.2;
      streak(p, pts, front ? [PAL.white, PAL.teal4, PAL.teal3, PAL.teal2] : [PAL.teal2, PAL.teal1]);
    }
  }
  // downdraft: short curls pushed down and back under the wings
  if (o.draft > 0.05) {
    const g = wingGeo(o, r, 1);
    for (let k = 0; k < 2; k++) {
      const tip = g.feathers[g.feathers.length - 2 + k].tip;
      const d = o.draft;
      const x0 = tip[0] - 1 - k * 3;
      const y0 = tip[1] + 2 + 3 * d;
      const pts: Pt[] = [];
      const len = Math.round(3 + 3 * d);
      for (let i = 0; i < len; i++) pts.push([x0 - i * 0.9, y0 + i * 0.45 + Math.sin(i * 0.9 + k) * 0.6]);
      streak(p, pts, d > 0.6 ? WIND : WIND.slice(1));
    }
  }
  // speed lines streaming back from a dive
  if (o.speed > 0.05) {
    const lines: [number, number, number][] = [
      [-2, -3, 1],
      [0, 0.5, 0.8],
      [-1, 3, 0.9],
      [1, -5.5, 0.6],
    ];
    lines.forEach(([du, dv, k], i) => {
      const s = B(-3 + du, dv);
      const L = Math.round(o.speed * k * 16);
      const pts: Pt[] = [];
      for (let j = 0; j < L; j++) pts.push([s[0] - j * 0.86, s[1] - j * 0.5 - (i % 2) * 0.5]);
      streak(p, pts, WIND);
    });
  }
  // talon slash smear: three bright claw arcs sweeping down in front of the feet
  if (o.smear > 0.05) {
    const c = B(6, 4);
    for (let k = 0; k < 3; k++) {
      const pts: Pt[] = [];
      const R = 6 + k * 1.7;
      const a0 = -1.0 + (1 - o.smear) * 0.9;
      const a1 = 1.15;
      const n = Math.ceil(R * (a1 - a0) * 1.4);
      for (let j = 0; j <= n; j++) {
        const a = lerp(a1, a0, j / n);
        pts.push([c[0] + Math.cos(a) * R, c[1] + Math.sin(a) * R]);
      }
      streak(p, pts, o.smear > 0.7 ? [PAL.white, PAL.white, PAL.teal4, PAL.teal3] : [PAL.teal4, PAL.teal3, PAL.teal2]);
    }
  }
  // roar shockwave: a ring of wind dashes bursting outward
  if (o.burst > 0) {
    const c = B(2, -1);
    const R = 6 + o.burst * 15;
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + 0.2;
      const pts: Pt[] = [];
      const L = Math.max(1, Math.round((1 - o.burst) * 4 + 2));
      for (let j = 0; j < L; j++) {
        const rr = R - j;
        pts.push([c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr * 0.75]);
      }
      streak(p, pts, o.burst < 0.6 ? [PAL.white, PAL.teal4, PAL.teal3] : [PAL.teal3, PAL.teal2, PAL.teal1]);
    }
  }
  // loose feathers drifting away (hit): little 4px quills tumbling up and back
  if (o.loose > 0) {
    for (let k = 0; k < 3; k++) {
      const s0 = B(-1 + k * 2.5, -2 + k);
      const t = o.loose;
      if (t >= 0.95 && k > 0) continue;
      const x = s0[0] - (5 + 6 * k) * t - 2;
      const y = s0[1] - (6 + 3 * k) * t + t * t * 9 + Math.sin(t * 6 + k);
      const ang = t * 7 + k * 2;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang) * 0.6;
      const cols = k === 1 ? [PAL.teal4, PAL.teal3, PAL.teal2, PAL.teal1] : [PAL.leaf4, PAL.leaf3, PAL.leaf2, PAL.leaf1];
      for (let j = 0; j < 4; j++) {
        const px = Math.round(x + dx * (j - 1.5));
        const py = Math.round(y + dy * (j - 1.5));
        if (!p.isOpaque(px, py)) p.set(px, py, cols[j]);
      }
    }
  }
}

// ---------------------------------------------------------------- portrait (44×34)

function portrait(p: Canvas): void {
  // WIND sky: a bright teal halo behind the head, wind bands sweeping across, deep green edges
  const pose = P({ flap: 0.78, lag: 0.3, sweep: 0.55, hsweep: 0.1, farFlap: -0.55, farSweep: -1.0, span: 1.12, pitch: 0.62, head: 'up', eye: 2, crest: 1, fan: 1, tail: 0.5, t: 0.3 });
  const eye = rigOf(pose).eye;
  const ex = 29;
  const ey = 13;
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 44; x++) {
      const d = Math.hypot(x - ex + 2, (y - ey) * 1.1);
      let col: number = PAL.leaf0;
      if (d < 24) col = PAL.teal0;
      if (d < 16) col = PAL.teal1;
      if (d < 9) col = PAL.teal2;
      p.set(x, y, col);
    }
  for (let i = 0; i < 5; i++) {
    const y0 = 3 + i * 7;
    for (let x = 0; x < 44; x++) {
      const y = Math.round(y0 + Math.sin(x * 0.2 + i * 1.7) * 1.5);
      if ((x + i * 11) % 23 < 10) p.set(x, y, i % 2 ? PAL.teal3 : PAL.leaf2);
    }
  }
  const big = new PixelCanvas(W, H);
  drawHawk(big, pose);
  p.blit(big, ex - eye[0], ey - eye[1]);
}

// ---------------------------------------------------------------- export

const IMPACT_FRAME = 5;

/** Muzzle = the spread talons in the impact frame. */
const MUZZLE = (() => {
  const o = ANIMS.attack.poses[IMPACT_FRAME];
  const r = rigOf(o);
  const hip = r.B(1.4, 2.2);
  const a = lerp(1.5, 0.45, o.leg) + 0.1;
  const L = lerp(3.4, 8.8, o.leg);
  return { x: Math.round(hip[0] + Math.cos(a) * L + 2.5), y: Math.round(hip[1] + Math.sin(a) * L) };
})();

const art: MonsterArt = {
  id: 'storm_hawk',
  w: W,
  h: H,
  anchorX: 24,
  anchorY: 37,
  hover: 10,
  muzzle: MUZZLE,
  core: { x: 25, y: 26 },
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
    drawHawk(p, poses[Math.max(0, Math.min(poses.length - 1, frame))]);
  },
  portrait,
};

export default art;
