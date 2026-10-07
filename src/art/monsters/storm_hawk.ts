// Fırtına Atmacası (storm_hawk) — WIND winged beast, 48×48, flying (hover 10).
//
// A fierce green storm hawk hovering like a kestrel: body pitched up, tail fanned for balance, head
// held level and steady. Raptor features carry the read at 1×: a flat skull under a heavy dark brow,
// a fierce gold eye with a white glint, a dark malar "moustache" stripe, a short hooked beak (gold
// cere fading to a steel/ink hook), a pale breast with dark horizontal bars, and a fanned tail of four
// separate feathers with teal tips.
//
// Parametric rig: every frame is a Pose (numbers). Each wing is a 2D rig in screen space — an arm
// and a hand angle around the shoulder, a chord direction the flight feathers hang along, and a fan
// spread for the primaries — so the silhouette is controlled in every frame: wings up = a wide V
// that fills the frame, downstroke = the near wing spread below the body with its primaries fanned
// down past the talons, upstroke = the hand folded and trailing. Feathers are clean strips (leaf1
// base, leaf2 vane, teal tips) separated by dark-green seams, never ink. Wind wisps, the talon slash
// crescents and the roar shockwave are light (drawn after the outline).

import { PAL } from '../palette';
import { PixelCanvas, bezier, type Pt } from '../pixel';
import type { MonsterAnim, MonsterArt } from '../types';

const W = 48;
const H = 48;
const TAU = Math.PI * 2;

type Canvas = PixelCanvas;
type HeadKey = 'level' | 'open' | 'up' | 'down' | 'squeeze';

// ---------------------------------------------------------------- pose

interface WingP {
  /** Arm direction (screen rad), hand direction (screen rad). */
  a: number;
  h: number;
  /** Arm length scale and hand+primary length scale (foreshortening / folding). */
  ext: number;
  hext: number;
  /** Primary spread 0 (folded along the hand) .. 1 (fingers fanned). */
  fan: number;
  /** Direction the flight feathers hang from the arm (screen rad). */
  c: number;
}

interface Pose {
  /** Body origin (middle of the torso, frame px) and pitch (rad, + = nose up). */
  x: number;
  y: number;
  pitch: number;
  near: WingP;
  far: WingP;
  /** Head stamp and offset; eye 0 shut / 1 open / 2 blazing. */
  head: HeadKey;
  hx: number;
  hy: number;
  eye: number;
  /** Tail angle below the body axis (rad) and fan 0..1. */
  tail: number;
  fan: number;
  /** Legs 0 tucked .. 1 thrust forward; toes 0 clenched .. 1 spread. */
  leg: number;
  toes: number;
  /** Feather ruffle 0..1 (hit). */
  ruffle: number;
  /** Downdraft curls (downstroke), speed lines (dive), talon slash (impact), roar shockwave (0..1). */
  draft: number;
  speed: number;
  smear: number;
  burst: number;
  /** Loose feathers drifting off (hit), progress 0..1 (0 = none). */
  loose: number;
  /** Flutter / wisp phase. */
  t: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Hover beat at phase t (0..1): wings at the top of the stroke at 0, bottom at 0.5. */
function beat(t: number): { near: WingP; far: WingP; bob: number; draft: number } {
  const s = 0.5 - 0.5 * Math.cos(t * TAU);
  const sn = Math.sin(t * TAU);
  const up = Math.max(0, -sn); // upstroke amount
  const a = lerp(-2.5, -4.36, s);
  const near: WingP = {
    a,
    h: a + lerp(0.42, -0.38, s) + 0.32 * sn,
    // mid-stroke the wing swings toward the camera: foreshortened
    ext: 1 - 0.05 * up - 0.14 * Math.sin(Math.PI * s),
    hext: 1 - 0.14 * up - 0.12 * Math.sin(Math.PI * s),
    fan: 1 - 0.4 * up,
    c: lerp(2.7, 3.3, s) - 0.25 * up,
  };
  const tf = t - 0.1;
  const sf = 0.5 - 0.5 * Math.cos(tf * TAU);
  const upf = Math.max(0, -Math.sin(tf * TAU));
  const af = lerp(-0.7, -2.5, sf);
  const far: WingP = {
    a: af,
    h: af + lerp(0.2, -0.3, sf) + 0.2 * Math.sin(tf * TAU),
    ext: lerp(1, 0.6, sf),
    hext: lerp(1, 0.5, sf) - 0.12 * upf,
    fan: 1 - 0.6 * upf,
    c: lerp(2.85, 2.2, sf),
  };
  return {
    near,
    far,
    bob: Math.round(Math.sin((t - 0.15) * TAU)),
    draft: t > 0.25 && t < 0.8 ? Math.sin(((t - 0.25) / 0.55) * Math.PI) : 0,
  };
}

const N: Pose = {
  x: 23,
  y: 26,
  pitch: 0.22,
  ...beat(0),
  head: 'level',
  hx: 0,
  hy: 0,
  eye: 1,
  tail: 0.2,
  fan: 0.6,
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

function idlePose(f: number, n: number): Pose {
  const t = f / n;
  const b = beat(t);
  return P({
    near: b.near,
    far: b.far,
    // the downstroke lifts the body; the head is stabilised (moves half as much)
    y: N.y - b.bob,
    hy: b.bob * 0.5,
    tail: N.tail + 0.06 * Math.sin((t - 0.2) * TAU),
    fan: N.fan + 0.15 * Math.cos(t * TAU),
    draft: b.draft,
    eye: f === 6 ? 0.4 : 1,
    t,
  });
}

/** Beat pose at phase t merged with overrides. */
const B8 = (t: number, o: Partial<Pose>): Pose => {
  const b = beat(t);
  return P({ near: b.near, far: b.far, ...o });
};

const ANIMS: Record<MonsterAnim, { fps: number; loop: boolean; poses: Pose[] }> = {
  idle: { fps: 12, loop: true, poses: Array.from({ length: 8 }, (_, f) => idlePose(f, 8)) },

  // Roar: gather (wings drawn in, head ducked) → fling the wings wide, head thrown back, beak agape
  // in a screech, tail fanned, a ring of wind dashes bursts out → hold → one great downbeat → settle.
  roar: {
    fps: 12,
    loop: false,
    poses: [
      idlePose(0, 8),
      P({ y: 28, pitch: 0.36, near: { a: -2.75, h: -3.1, ext: 0.85, hext: 0.75, fan: 0.2, c: 2.2 }, far: { a: -2.2, h: -2.6, ext: 0.7, hext: 0.6, fan: 0.2, c: 2.6 }, head: 'down', hy: 1, tail: 0.45, fan: 0.3, t: 0.1 }),
      P({ y: 29, x: 20, pitch: 0.3, near: { a: -2.9, h: -3.25, ext: 0.8, hext: 0.7, fan: 0.1, c: 2.1 }, far: { a: -2.4, h: -2.75, ext: 0.65, hext: 0.55, fan: 0.1, c: 2.6 }, head: 'down', hy: 1.5, eye: 1.5, tail: 0.5, fan: 0.2, t: 0.2 }),
      P({ x: 25, y: 29, pitch: 0.5, near: { a: -2.45, h: -2.62, ext: 0.98, hext: 1.0, fan: 1, c: 2.15 }, far: { a: -1.38, h: -1.12, ext: 1.0, hext: 1.06, fan: 1, c: 2.75 }, head: 'up', hy: -1, eye: 2, tail: 0.55, fan: 1, burst: 0.15, t: 0.3 }),
      P({ x: 25, y: 29, pitch: 0.52, near: { a: -2.48, h: -2.66, ext: 1.0, hext: 1.02, fan: 1, c: 2.15 }, far: { a: -1.38, h: -1.12, ext: 1.0, hext: 1.06, fan: 1, c: 2.75 }, head: 'up', hy: -1, eye: 2, tail: 0.58, fan: 1, burst: 0.42, t: 0.4 }),
      P({ x: 25, y: 29, pitch: 0.52, near: { a: -2.48, h: -2.64, ext: 1.0, hext: 1.02, fan: 1, c: 2.2 }, far: { a: -1.38, h: -1.12, ext: 1.0, hext: 1.06, fan: 1, c: 2.75 }, head: 'up', hy: -1, eye: 2, tail: 0.56, fan: 1, burst: 0.7, t: 0.5 }),
      P({ x: 25, y: 29, pitch: 0.5, near: { a: -2.46, h: -2.64, ext: 0.98, hext: 1.0, fan: 1, c: 2.2 }, far: { a: -1.38, h: -1.12, ext: 1.0, hext: 1.06, fan: 1, c: 2.75 }, head: 'open', eye: 2, tail: 0.55, fan: 0.95, burst: 1, t: 0.6 }),
      B8(0.42, { y: 26, pitch: 0.5, head: 'open', eye: 1.5, fan: 0.8, draft: 1, t: 0.7 }),
      B8(0.62, { y: 26, pitch: 0.45, eye: 1.2, fan: 0.65, draft: 0.7, t: 0.8 }),
      B8(0.85, { y: 27, t: 0.9 }),
    ],
  },

  // Attack ("Kasırga Dalışı"): a downbeat to climb, wings swing up and fold (anticipation) → tucked
  // dive, nose down, talons lowering, speed lines → IMPACT: body swings upright, wings flare up and
  // back to brake, talons thrust forward wide open with three bold slash crescents → clench +
  // downbeat follow-through → climb back home.
  attack: {
    fps: 12,
    loop: false,
    poses: [
      idlePose(0, 8),
      B8(0.5, { y: 25, pitch: 0.55, eye: 1.5, draft: 0.8, t: 0.1 }),
      P({ x: 21, y: 26, pitch: 0.5, near: { a: -1.95, h: -1.65, ext: 0.9, hext: 0.75, fan: 0.35, c: 2.6 }, far: { a: -1.2, h: -1.0, ext: 0.9, hext: 0.8, fan: 0.3, c: 2.8 }, head: 'down', eye: 2, tail: 0.4, fan: 0.25, t: 0.2 }),
      P({ x: 24, y: 24, pitch: -0.42, near: { a: -2.75, h: -2.95, ext: 0.8, hext: 0.85, fan: 0, c: -2.3 }, far: { a: -2.5, h: -2.75, ext: 0.7, hext: 0.75, fan: 0, c: -2.2 }, head: 'down', eye: 2, tail: 0.05, fan: 0, leg: 0.4, toes: 0.5, speed: 0.6, t: 0.3 }),
      P({ x: 25, y: 28, pitch: -0.52, near: { a: -2.78, h: -2.98, ext: 0.8, hext: 0.85, fan: 0, c: -2.35 }, far: { a: -2.55, h: -2.8, ext: 0.7, hext: 0.75, fan: 0, c: -2.25 }, head: 'down', eye: 2, tail: 0, fan: 0, leg: 0.65, toes: 0.8, speed: 1, t: 0.4 }),
      P({ x: 25, y: 29, pitch: 0.55, near: { a: -2.45, h: -2.1, ext: 1.02, hext: 1.05, fan: 1, c: 2.75 }, far: { a: -1.4, h: -1.15, ext: 1, hext: 1, fan: 1, c: 2.75 }, head: 'open', eye: 2, tail: 0.7, fan: 1, leg: 1, toes: 1, speed: 0.4, smear: 1, t: 0.5 }),
      B8(0.45, { x: 25, y: 26, pitch: 0.6, head: 'open', eye: 2, tail: 0.6, fan: 0.85, leg: 0.75, toes: 0, smear: 0.5, draft: 1, t: 0.6 }),
      B8(0.75, { x: 24, y: 24, pitch: 0.5, eye: 1.5, tail: 0.45, fan: 0.6, leg: 0.3, toes: 0.2, t: 0.7 }),
      B8(0.1, { x: 23, y: 27, eye: 1.2, draft: 0.4, t: 0.8 }),
      B8(0.55, { x: 23, y: 26, t: 0.9 }),
    ],
  },

  // Hit: knocked back with the body pitched up and back, beak open, eye squeezed, wings thrown up
  // and forward out of rhythm, talons tucked, feathers torn loose → a backward tumble with the wings
  // crossed → it rights itself.
  hit: {
    fps: 10,
    loop: false,
    poses: [
      P({ x: 21, y: 28, pitch: 0.82, near: { a: -1.42, h: -0.95, ext: 1, hext: 1, fan: 0.85, c: 2.5 }, far: { a: -0.55, h: -0.2, ext: 0.95, hext: 0.95, fan: 0.8, c: 2.7 }, head: 'squeeze', hx: -1, eye: 0, tail: 0.1, fan: 0.9, ruffle: 1, leg: 0, toes: 0, loose: 0.18, t: 0.1 }),
      P({ x: 22, y: 28, pitch: 1.08, near: { a: -0.95, h: -0.5, ext: 0.95, hext: 0.95, fan: 0.6, c: 2.6 }, far: { a: -2.15, h: -2.4, ext: 0.8, hext: 0.8, fan: 0.6, c: 2.6 }, head: 'squeeze', hx: -1, eye: 0, tail: -0.05, fan: 0.8, ruffle: 0.6, leg: 0, toes: 0, loose: 0.45, t: 0.2 }),
      B8(0.6, { x: 22, y: 27, pitch: 0.45, eye: 0.6, ruffle: 0.25, loose: 0.72, t: 0.3 }),
      B8(0.9, { x: 23, y: 26, eye: 1, loose: 1, t: 0.4 }),
    ],
  },

  // Guard: wings mantled forward around the body like a cloak, head low and peering over the wrap,
  // a slow 1px breathing bob; the primary tips stir in the wind.
  guard: {
    fps: 5,
    loop: true,
    poses: [0, 1, 2, 3].map((f) => {
      const t = f / 4;
      const s = Math.sin(t * TAU);
      return P({
        x: 22,
        y: 28 + (s > 0.5 ? -1 : 0),
        pitch: 0.9,
        near: { a: 0.95, h: 1.75 + 0.05 * s, ext: 0.85, hext: 0.95, fan: 0.25, c: 2.75 },
        far: { a: -2.2, h: -2.55, ext: 0.75, hext: 0.8, fan: 0.15, c: 2.5 },
        head: 'down',
        hx: 0,
        hy: 2,
        eye: 1.6,
        tail: 0.12,
        fan: 0.2,
        t,
      });
    }),
  },
};

// ---------------------------------------------------------------- head stamps
// 'p' marks the pupil (or 'q' the squeezed eye) — the placement anchor is the neck point 'n'
// (drawn as the back-of-head colour).

const HEAD_KEY: Record<string, number> = {
  k: PAL.ink,
  G: PAL.leaf3,
  g: PAL.leaf2,
  d: PAL.leaf1,
  n: PAL.leaf1,
  D: PAL.leaf0,
  m: PAL.mist,
  M: PAL.white,
  o: PAL.gold2,
  y: PAL.gold3,
  Y: PAL.gold4,
  O: PAL.gold1,
  e: PAL.gold3,
  E: PAL.white,
  p: PAL.ink,
  q: PAL.ink,
  t: PAL.stone2,
  T: PAL.stone1,
  r: PAL.crim1,
  R: PAL.crim2,
};

const HEADS: Record<HeadKey, string[]> = {
  level: [
    '.GGGGGGG....',
    'Gggggggggg..',
    'gggggggggGy.',
    'ggdkkkkkkoyt',
    'ddDEpkddoytt',
    'dDDeeDdmOtTT',
    'nDmmDmmmmO.k',
    '.DmmDmmmm...',
    '..mmmMMm....',
  ],
  open: [
    '.GGGGGGG....',
    'Gggggggggg..',
    'gggggggggGy.',
    'ggdkkkkkkoyt',
    'ddDEpkddoytt',
    'dDDeeDdmOrRT',
    'nDmmDmmmOrrk',
    '.DmmDmmmmot.',
    '..mmmMMm....',
  ],
  up: [
    '.........tT.',
    '..GGGG..ytk.',
    '.GgggGGoyRk.',
    'GgdkkkkoRr..',
    'gdDEpkDorRt.',
    'dDDeeDdmOott',
    'nDmmDmmmmOk.',
    '.DmmDmmmm...',
    '..mmmMMm....',
  ],
  down: [
    'GGGGGG......',
    'ggggggGGGG..',
    'gggggggggGy.',
    'ggdkkkkkkoyt',
    'ddDEpkddoytt',
    'dDDeeDdmOtTT',
    'nDmmDmmm.O.k',
    '.DmmDmm.....',
    '..mmM.......',
  ],
  squeeze: [
    '.GGGGGGG....',
    'Gggggggggg..',
    'gggggggggGy.',
    'ggdkkkkkkoyt',
    'ddDkqkddoytt',
    'dDDDDDdmOrRT',
    'nDmmDmmmOrrk',
    '.DmmDmmmmot.',
    '..mmmMMm....',
  ],
};

function charAt(rows: string[], ch: string): Pt | null {
  for (let y = 0; y < rows.length; y++) {
    const x = rows[y].indexOf(ch);
    if (x >= 0) return [x, y];
  }
  return null;
}

// ---------------------------------------------------------------- helpers

const dir = (a: number): Pt => [Math.cos(a), Math.sin(a)];
const addv = (p: Pt, d: Pt, k: number): Pt => [p[0] + d[0] * k, p[1] + d[1] * k];
/** Shortest-path angle interpolation. */
function alerp(a: number, b: number, t: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

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
  /** Frame px → body-local. */
  inv: (x: number, y: number) => Pt;
  /** Head stamp top-left. */
  headAt: Pt;
}

/** Where the neck point 'n' of the head stamp lands (body-local). */
const NECK: Pt = [6.4, -4.6];

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
  // the head is held level whatever the body does: the neck point follows the body, the stamp does not rotate
  const nk = B(NECK[0], NECK[1]);
  const n = charAt(HEADS[o.head], 'n') ?? [0, 6];
  const headAt: Pt = [Math.round(nk[0] - n[0] + o.hx), Math.round(nk[1] - n[1] + o.hy)];
  return { B, inv, headAt };
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
  feathers: Feather[];
  coverts: Pt[];
}

const LA = 7.8;
const LH = 6.6;
const LS = 7.2;
const LP = [8.4, 9.4, 10.2, 10.6, 10];

function wingGeo(S: Pt, w: WingP): WingGeo {
  const Wr = addv(S, dir(w.a), LA * w.ext);
  const T = addv(Wr, dir(w.h), LH * w.hext);
  const feathers: Feather[] = [];
  // secondaries hang from the arm along the chord; the outer ones swing a little toward the hand
  [0.18, 0.44, 0.7, 0.96].forEach((t) => {
    const root: Pt = [lerp(S[0], Wr[0], t), lerp(S[1], Wr[1], t)];
    const d = alerp(w.c, w.h, 0.12 + 0.18 * t);
    feathers.push({ root, tip: addv(root, dir(d), LS * (0.92 + 0.12 * t) * lerp(0.8, 1, w.ext)), w0: 3.2, w1: 2.4, pri: false });
  });
  // primaries along the hand: the inner ones near the chord, the outer ones along the span ("fingers")
  const inner = alerp(w.h, w.c, lerp(0.12, 0.62, w.fan));
  LP.forEach((L, k) => {
    const f = k / (LP.length - 1);
    const root: Pt = [lerp(Wr[0], T[0], f * 0.92), lerp(Wr[1], T[1], f * 0.92)];
    const d = alerp(inner, w.h, Math.pow(f, 0.85));
    feathers.push({ root, tip: addv(root, dir(d), L * w.hext), w0: 2.7, w1: 1.5, pri: true });
  });
  const cMid = alerp(w.c, w.h, 0.5);
  const coverts: Pt[] = [S, Wr, T, addv(T, dir(alerp(w.h, w.c, 0.5)), 2.2), addv(Wr, dir(cMid), 3.4), addv(S, dir(w.c), 3.8)];
  return { S, Wr, T, feathers, coverts };
}

interface WingPal {
  base: number;
  vane: number;
  seam: number;
  tipA: number;
  tipB: number;
  cov: number;
  edge: number;
}

const WING_NEAR: WingPal = { base: PAL.leaf1, vane: PAL.leaf2, seam: PAL.leaf0, tipA: PAL.teal2, tipB: PAL.teal3, cov: PAL.leaf2, edge: PAL.leaf3 };
const WING_FAR: WingPal = { base: PAL.leaf1, vane: PAL.leaf1, seam: PAL.leaf0, tipA: PAL.teal1, tipB: PAL.teal2, cov: PAL.leaf1, edge: PAL.leaf2 };

function drawWing(p: Canvas, S: Pt, w: WingP, far: boolean): void {
  const g = wingGeo(S, w);
  const pal = far ? WING_FAR : WING_NEAR;
  layer(
    p,
    (q) => {
      // flight feathers: outermost primary first so each inner feather overlaps the next with a seam
      const order = [...g.feathers.filter((f) => f.pri).reverse(), ...g.feathers.filter((f) => !f.pri).reverse()];
      for (const f of order) {
        layer(
          q,
          (fq) => {
            const mid: Pt = [lerp(f.root[0], f.tip[0], 0.55), lerp(f.root[1], f.tip[1], 0.55)];
            fq.stroke([f.root, mid, f.tip], f.w0, f.w1, pal.base);
            // a lighter vane stripe down the middle, teal tip
            const n = Math.ceil(Math.hypot(f.tip[0] - f.root[0], f.tip[1] - f.root[1]) * 2);
            for (let i = 0; i <= n; i++) {
              const t = i / n;
              if (t < 0.2 || t > 0.62) continue;
              fq.paint(lerp(f.root[0], f.tip[0], t), lerp(f.root[1], f.tip[1], t), pal.vane);
            }
            bandPaint(fq, f.root, f.tip, f.pri ? 0.66 : 0.76, 1, f.pri ? 1.5 : 1.9, pal.tipA);
            bandPaint(fq, f.root, f.tip, f.pri ? 0.84 : 0.9, 1, f.pri ? 1.3 : 1.7, pal.tipB);
          },
          pal.seam,
        );
      }
      // coverts: a lit leading edge over the feather roots
      layer(
        q,
        (cq) => {
          cq.poly(g.coverts, pal.cov);
          cq.stroke([g.S, g.Wr, g.T], 2.6, 1.8, pal.cov);
          const src = cq.clone();
          const [lx, ly] = dir(w.c);
          for (let y = 0; y < cq.h; y++)
            for (let x = 0; x < cq.w; x++) {
              if (!src.isOpaque(x, y)) continue;
              // the edge facing away from the chord is the leading edge (lit)
              const bx = Math.round(x - lx * 1.2);
              const by = Math.round(y - ly * 1.2);
              if (!src.isOpaque(bx, by)) cq.set(x, y, pal.edge);
            }
        },
        pal.seam,
      );
    },
    PAL.ink,
  );
}

const TORSO: Pt[] = [
  ...bezier([7, -0.6], [6.4, -3.8], [2, -5.2], [-2.5, -4.4], 8),
  ...bezier([-2.5, -4.4], [-6, -3.6], [-8.6, -2], [-9, 0.2], 6).slice(1),
  ...bezier([-9, 0.2], [-7.6, 2.6], [-3, 4.6], [1.6, 4.4], 8).slice(1),
  ...bezier([1.6, 4.4], [5, 4.0], [7.4, 2.4], [7, -0.6], 8).slice(1),
];

function drawHawk(p: Canvas, o: Pose): void {
  const r = rigOf(o);
  const { B, inv } = r;

  // ------------------------------------------------ far wing (behind everything)
  drawWing(p, B(-0.6, -4.4), o.far, true);

  // ------------------------------------------------ tail fan: four separate feathers
  const tailRoot = B(-8, 0.4);
  const back = Math.atan2(Math.sin(o.pitch), -Math.cos(o.pitch));
  const tailA = back - o.tail;
  layer(p, (q) => {
    const nF = 4;
    const spread = lerp(0.12, 0.62, o.fan);
    for (let k = 0; k < nF; k++) {
      // outer feathers first, the central pair on top
      const idx = [0, 3, 1, 2][k];
      const f = idx / (nF - 1) - 0.5;
      const a = tailA + f * spread;
      const L = 10.6 - Math.abs(f) * 1.6;
      const root: Pt = [tailRoot[0] + Math.cos(a + Math.PI / 2) * f * 1.6, tailRoot[1] + Math.sin(a + Math.PI / 2) * f * 1.6];
      const tip = addv(root, dir(a), L);
      layer(
        q,
        (fq) => {
          fq.stroke([root, tip], 2.6, 2.8, PAL.leaf1);
          bandPaint(fq, root, tip, 0.15, 0.55, 0.6, PAL.leaf2);
          bandPaint(fq, root, tip, 0.62, 0.74, 1.6, PAL.leaf0);
          bandPaint(fq, root, tip, 0.8, 1, 1.6, PAL.teal2);
          bandPaint(fq, root, tip, 0.92, 1, 1.6, PAL.teal3);
        },
        PAL.leaf0,
      );
    }
  });

  // ------------------------------------------------ legs
  const hip = B(1.2, 2.6);
  const legA = lerp(1.45, 0.42, o.leg) - (o.pitch - N.pitch) * 0.8 * (1 - o.leg);
  const legL = lerp(3.2, 9.4, o.leg);
  const footOf = (near: boolean): Pt => {
    const a = legA + (near ? 0.08 : -0.06);
    const s = near ? 1 : -1;
    return [hip[0] + Math.cos(a) * legL + s * 1.1, hip[1] + Math.sin(a) * legL - s * 0.5];
  };
  const drawLeg = (q: Canvas, near: boolean) => {
    const ft = footOf(near);
    const h0: Pt = [hip[0] + (near ? 0.8 : -0.6), hip[1] - (near ? 0 : 0.6)];
    const knee: Pt = [lerp(h0[0], ft[0], 0.42), lerp(h0[1], ft[1], 0.42)];
    if (o.leg > 0.2) {
      // feathered "trousers" and a scaled gold tarsus
      q.stroke([h0, knee], 4, 2.8, near ? PAL.leaf1 : PAL.leaf0);
      q.stroke([knee, ft], 1.8, 1.5, near ? PAL.gold2 : PAL.gold1);
    }
    // toes: three forward, one back (hallux); spread or clenched; white-tipped talons
    const fa = Math.atan2(ft[1] - h0[1], ft[0] - h0[0]);
    const spread = lerp(0.2, 0.8, o.toes);
    const tl = lerp(1.6, 3.4, o.toes) * lerp(0.85, 1, o.leg);
    const curl = lerp(1.1, 0, o.toes);
    const toe = (a: number, l: number, claw: boolean) => {
      const e: Pt = [ft[0] + Math.cos(a) * l, ft[1] + Math.sin(a) * l];
      q.line(ft[0], ft[1], e[0], e[1], near ? PAL.gold3 : PAL.gold2);
      if (claw) {
        const c2: Pt = [e[0] + Math.cos(a + 1.2) * 1.2, e[1] + Math.sin(a + 1.2) * 1.2];
        q.set(c2[0], c2[1], near ? PAL.white : PAL.stone3);
      }
    };
    toe(fa - spread + curl * 0.5, tl, o.toes > 0.45);
    toe(fa + curl * 0.7, tl, o.toes > 0.45);
    toe(fa + spread + curl * 0.9, tl * 0.85, o.toes > 0.45);
    if (o.leg > 0.3) toe(fa + Math.PI - 0.5 - spread * 0.4, tl * 0.7, false);
    q.set(ft[0], ft[1], near ? PAL.gold3 : PAL.gold2);
  };
  layer(p, (q) => drawLeg(q, false));

  // ------------------------------------------------ torso + neck + head
  const rows = HEADS[o.head];
  const [hx0, hy0] = r.headAt;
  layer(p, (q) => {
    q.poly(
      TORSO.map(([u, v]) => B(u, v)),
      PAL.leaf1,
    );
    // neck: from the shoulders into the back of the head
    const n0 = B(4.2, -2.2);
    const nPt = charAt(rows, 'n') ?? [0, 6];
    const n1: Pt = [hx0 + nPt[0] + 2.5, hy0 + nPt[1] - 1.5];
    q.stroke([n0, [lerp(n0[0], n1[0], 0.5), lerp(n0[1], n1[1], 0.5)], n1], 6.4, 5.6, PAL.leaf1);
    // pale breast: where the body faces forward (scalloped boundary); the throat too
    for (let y = 0; y < q.h; y++)
      for (let x = 0; x < q.w; x++) {
        if (q.get(x, y) !== PAL.leaf1) continue;
        const [u, v] = inv(x, y);
        const scal = (Math.floor(u * 1.1) & 1) === 0 ? 0.4 : -0.2;
        const breast = v > 0.6 - 0.45 * u + scal && u > -4.5;
        const throat = u > 4.2 && v > -1.6;
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
        const b0 = B(u * 0.9, v * 0.9);
        const tip: Pt = [b0[0] + Math.cos(a) * (L + 1.2), b0[1] + Math.sin(a) * (L + 1.2)];
        const pa = a + Math.PI / 2;
        const col = q.get(b0[0], b0[1]) ?? PAL.leaf1;
        q.tri(b0[0] + Math.cos(pa) * 1.1, b0[1] + Math.sin(pa) * 1.1, b0[0] - Math.cos(pa) * 1.1, b0[1] - Math.sin(pa) * 1.1, tip[0], tip[1], col);
      }
    }
    // volume: lit back edge, cool underside
    const src = q.clone();
    for (let y = 0; y < q.h; y++)
      for (let x = 0; x < q.w; x++) {
        const c = src.get(x, y);
        if (c === null) continue;
        const topOpen = !src.isOpaque(x, y - 1) || !src.isOpaque(x - 1, y);
        const botOpen = !src.isOpaque(x, y + 1) || !src.isOpaque(x + 1, y);
        if (topOpen) q.set(x, y, c === PAL.leaf1 ? PAL.leaf2 : c === PAL.mist ? PAL.white : c);
        else if (botOpen) q.set(x, y, c === PAL.leaf1 ? PAL.leaf0 : c === PAL.mist ? PAL.steel : c);
      }
    // breast barring: short horizontal steel bars in staggered rows
    for (let v = -0.4; v <= 4.2; v += 1.6) {
      for (let u = -4; u <= 7; u += 2.2) {
        const [x, y] = B(u + (Math.round(v / 1.6) % 2) * 1.1, v);
        const xr = Math.round(x);
        const yr = Math.round(y);
        if (q.get(xr, yr) === PAL.mist && q.get(xr + 1, yr) === PAL.mist) {
          q.set(xr, yr, PAL.steel);
          q.set(xr + 1, yr, PAL.steel);
        }
      }
    }
    // back: covert scallops
    for (const [u, v] of [
      [-1, -3.2],
      [-4.2, -2.4],
      [1.8, -3.8],
      [-6.6, -1.2],
    ] as const) {
      const c = B(u, v);
      if (q.get(c[0], c[1]) === PAL.leaf1) q.set(c[0], c[1], PAL.leaf0);
      if (q.get(c[0] + 1, c[1]) === PAL.leaf1) q.set(c[0] + 1, c[1], PAL.leaf2);
    }
    // the head itself (hand-pixelled, held level)
    q.stamp(rows, HEAD_KEY, hx0, hy0);
    // eye state (blazing / dim); 'squeeze' stamps its own shut eye
    const pp = charAt(rows, 'p');
    if (pp) {
      const ex = hx0 + pp[0];
      const ey = hy0 + pp[1];
      if (o.eye < 0.3) q.set(ex - 1, ey, PAL.leaf0).set(ex, ey, PAL.ink).set(ex - 1, ey + 1, PAL.leaf0).set(ex, ey + 1, PAL.leaf0);
      else if (o.eye < 0.8) q.set(ex - 1, ey, PAL.leaf0);
      else if (o.eye >= 1.5) q.set(ex - 1, ey, PAL.white).set(ex, ey + 1, PAL.gold4).set(ex - 1, ey + 1, PAL.gold4);
    }
  });

  // ------------------------------------------------ near leg
  layer(p, (q) => drawLeg(q, true));

  // ------------------------------------------------ near wing
  drawWing(p, B(1.6, -3.0), o.near, false);

  // ------------------------------------------------ outline
  p.outline(PAL.ink);

  // ------------------------------------------------ light effects (no outline)
  fx(p, o, r, footOf(true));
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

function fx(p: Canvas, o: Pose, r: Rig, foot: Pt): void {
  const { B } = r;
  // storm wisps: two little wind crescents orbiting the hawk (its WIND aura)
  if (o.ruffle === 0 && o.speed === 0 && o.burst === 0) {
    const c = B(0, 1);
    for (let k = 0; k < 2; k++) {
      // half a turn per loop: the two wisps swap places, so the cycle is seamless
      const ph = (o.t * 0.5 + k * 0.5) % 1;
      const a0 = ph * TAU + 0.6;
      const R = 16;
      const pts: Pt[] = [];
      for (let j = 0; j < 6; j++) {
        const a = a0 - j * 0.12;
        pts.push([c[0] + Math.cos(a) * R, c[1] + Math.sin(a) * R * 0.5 + 3]);
      }
      const front = Math.sin(a0) > -0.2;
      streak(p, pts, front ? [PAL.white, PAL.teal4, PAL.teal3, PAL.teal2] : [PAL.teal2, PAL.teal1]);
    }
  }
  // downdraft: short curls pushed down and back under the near wing
  if (o.draft > 0.05) {
    const g = wingGeo(B(1.6, -3.0), o.near);
    for (let k = 0; k < 2; k++) {
      const tip = g.feathers[g.feathers.length - 2 + k].tip;
      const d = o.draft;
      const x0 = tip[0] + 1 - k * 3;
      const y0 = tip[1] + 2 + 2 * d;
      const pts: Pt[] = [];
      const len = Math.round(3 + 3 * d);
      for (let i = 0; i < len; i++) pts.push([x0 - i * 0.9, y0 + i * 0.45 + Math.sin(i * 0.9 + k) * 0.6]);
      streak(p, pts, d > 0.6 ? WIND : WIND.slice(1));
    }
  }
  // speed lines streaming back from a dive
  if (o.speed > 0.05) {
    const lines: [number, number, number][] = [
      [-2, -4, 1],
      [0, 0.5, 0.8],
      [-1, 4, 0.9],
      [2, -7, 0.6],
    ];
    lines.forEach(([du, dv, k], i) => {
      const s = B(-4 + du, dv);
      const L = Math.round(o.speed * k * 16);
      const pts: Pt[] = [];
      for (let j = 0; j < L; j++) pts.push([s[0] - j * 0.86, s[1] - j * 0.5 - (i % 2) * 0.5]);
      streak(p, pts, WIND);
    });
  }
  // talon slash: three bold crescents (2px: white core, teal4 edge) raking down in front of the feet
  if (o.smear > 0.05) {
    const strong = o.smear > 0.7;
    for (let k = 0; k < 3; k++) {
      const cx = foot[0] - 3 + k * 3.4;
      const cy = foot[1] - 2;
      const R = 7.5;
      const a0 = -1.15 + (1 - o.smear) * 1.2;
      const a1 = 1.0;
      const n = Math.ceil(R * (a1 - a0) * 1.6);
      for (let j = 0; j <= n; j++) {
        const t = j / n;
        const a = lerp(a0, a1, t);
        const x = Math.round(cx + Math.cos(a) * R * 0.55);
        const y = Math.round(cy + Math.sin(a) * R);
        if (x < 1 || x > W - 2 || y < 1 || y > H - 2) continue;
        // thick in the middle of the arc, thin at the ends
        const mid = t > 0.18 && t < 0.85;
        const core = strong ? PAL.white : PAL.teal4;
        const edge = strong ? PAL.teal4 : PAL.teal3;
        if (!p.isOpaque(x, y) || p.get(x, y) === PAL.teal4 || p.get(x, y) === PAL.teal3) p.set(x, y, mid ? core : edge);
        if (mid && x + 1 <= W - 2 && (!p.isOpaque(x + 1, y) || p.get(x + 1, y) === PAL.teal3)) p.set(x + 1, y, edge);
      }
    }
  }
  // roar shockwave: dash segments on a clear expanding ellipse, oriented along the ring
  if (o.burst > 0) {
    const c = B(1, -1);
    const R = 10 + o.burst * 10;
    const n = 12;
    const cols = o.burst < 0.55 ? [PAL.white, PAL.teal4, PAL.teal4] : o.burst < 0.85 ? [PAL.teal4, PAL.teal3, PAL.teal3] : [PAL.teal3, PAL.teal2, PAL.teal2];
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU + 0.15;
      const L = o.burst < 0.85 ? 3 : 2;
      for (let j = 0; j < L; j++) {
        const a = a0 + (j / R) * 1.2;
        const x = Math.round(c[0] + Math.cos(a) * R);
        const y = Math.round(c[1] + Math.sin(a) * R * 0.8);
        if (x < 1 || x > W - 2 || y < 1 || y > H - 2 || p.isOpaque(x, y)) continue;
        p.set(x, y, cols[j]);
      }
    }
  }
  // loose feathers drifting away (hit): little 4px quills tumbling up and back
  if (o.loose > 0) {
    for (let k = 0; k < 4; k++) {
      const s0 = B(-1 + k * 2.2, -2 + k * 0.8);
      const t = o.loose;
      if (t >= 0.95 && k > 0) continue;
      const x = s0[0] - (4 + 5 * k) * t - 2;
      const y = s0[1] - (6 + 2.5 * k) * t + t * t * 9 + Math.sin(t * 6 + k);
      const ang = t * 7 + k * 2;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang) * 0.6;
      const cols = k % 2 === 1 ? [PAL.teal4, PAL.teal3, PAL.teal2, PAL.teal1] : [PAL.leaf4, PAL.leaf3, PAL.leaf2, PAL.leaf1];
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
  const pose = ANIMS.roar.poses[4];
  const r = rigOf(pose);
  const pp = charAt(HEADS[pose.head], 'p') ?? [4, 4];
  const eye: Pt = [r.headAt[0] + pp[0], r.headAt[1] + pp[1]];
  const ex = 27;
  const ey = 11;
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
  drawHawk(big, { ...pose, burst: 0 });
  p.blit(big, ex - eye[0], ey - eye[1]);
}

// ---------------------------------------------------------------- export

const IMPACT_FRAME = 5;

/** Muzzle = the spread near talons in the impact frame. */
const MUZZLE = (() => {
  const o = ANIMS.attack.poses[IMPACT_FRAME];
  const r = rigOf(o);
  const hip = r.B(1.2, 2.6);
  const a = lerp(1.45, 0.42, o.leg) + 0.08;
  const L = lerp(3.2, 9.4, o.leg);
  return { x: Math.round(hip[0] + Math.cos(a) * L + 1.1 + 2), y: Math.round(hip[1] + Math.sin(a) * L - 0.5) };
})();

const art: MonsterArt = {
  id: 'storm_hawk',
  w: W,
  h: H,
  anchorX: 23,
  anchorY: 37,
  hover: 10,
  muzzle: MUZZLE,
  core: { x: 23, y: 26 },
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
