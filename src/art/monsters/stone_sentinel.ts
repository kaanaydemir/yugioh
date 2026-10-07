// Taş Muhafız (stone_sentinel) — EARTH rock guardian, 64×64.
//
// An ancient, blocky stone knight in 3/4 view facing right: a small great-helm sunk between two
// massive moss-capped pauldrons, a gold protection rune (ᛉ, algiz) glowing in the chest and a
// burning gold eye slit. The left (far, screen-right) arm carries a huge rectangular tower shield
// carved with the same rune — it lights up when the sentinel plants it (guard). The right (near,
// screen-left) arm is free: it tears boulders out of the ground and throws them ("Kaya Fırlatma").
//
// Parametric rig: every frame is a Pose (numbers). The upper body (torso, belt, skirt, pauldrons,
// helm) is painted unsheared into a local canvas and composited with a per-row shear (lean) so
// the planar stone shading stays crisp; legs, the shield and the near arm are painted in frame
// space. Parts are separated by dark seams (layer()), then the outer ink outline, then an
// unoutlined light pass (rune, eye slit, shield rune, swing smear, dust).

import { PAL } from '../palette';
import { PixelCanvas, type Pt } from '../pixel';
import type { MonsterAnim, MonsterArt } from '../types';

const W = 64;
const H = 64;
const TAU = Math.PI * 2;
const GROUND = 60;
/** Pelvis rest position (local upper-body canvas is authored around it). */
const PX = 30;
const PY = 46;

type Canvas = PixelCanvas;

// ---------------------------------------------------------------- pose

interface Puff {
  x: number;
  y: number;
  r: number;
  /** 0 = solid, 1 = gone (dithered away). */
  f?: number;
}
interface Chip {
  x: number;
  y: number;
  /** 1..3 */
  s: number;
  /** dirt clod (earth) instead of stone */
  dirt?: boolean;
}

interface Pose {
  /** Pelvis (frame px). */
  bx: number;
  by: number;
  /** Shear lean of the upper body (px per px of height, + = forward/right). */
  lean: number;
  /** Chest lift 0..1 (breathing). */
  breath: number;
  /** Near shoulder rolled forward 0..1 (throw). */
  twist: number;
  /** Helm offset (local px) and eye-slit state. */
  hdx: number;
  hdy: number;
  eyeMode: 'n' | 'roar' | 'hit' | 'guard';
  /** Near hand (frame px), its state and bend direction. */
  nh: Pt;
  hand: 'fist' | 'open' | 'grip';
  bend: 1 | -1;
  /** Shield center (frame px), skew (px per px, + = top leans right), how deep it is driven into the ground. */
  sh: Pt;
  skew: number;
  /** Feet (frame px, ground contact). */
  nf: Pt;
  ff: Pt;
  /** Glows 0..2: chest rune, eye slit, shield rune. */
  rune: number;
  eye: number;
  srune: number;
  /** Boulder held in the near hand (center, frame px) or null. */
  rock: Pt | null;
  /** Swing smear: previous hand positions (oldest first). */
  smear: Pt[];
  dust: Puff[];
  chips: Chip[];
  /** Rising rune sparks 0..1 (roar). */
  sparks: number;
  /** Eye glint (star flare off the slit). */
  glint: boolean;
  /** Rock spikes bursting out of the ground around the shield base 0..1 (roar slam). */
  spikes: number;
  /** Near arm tucked behind the shield (guard). */
  armBehind: boolean;
  /** Flicker phase. */
  t: number;
}

const N: Pose = {
  bx: PX,
  by: PY,
  lean: 0,
  breath: 0,
  twist: 0,
  hdx: 0,
  hdy: 0,
  eyeMode: 'n',
  nh: [14, 47],
  hand: 'fist',
  bend: 1,
  sh: [47, 43],
  skew: 0,
  nf: [22, GROUND],
  ff: [37, GROUND],
  rune: 1,
  eye: 1,
  srune: 0,
  rock: null,
  smear: [],
  dust: [],
  chips: [],
  sparks: 0,
  glint: false,
  spikes: 0,
  armBehind: false,
  t: 0,
};

const P = (o: Partial<Pose>): Pose => ({ ...N, ...o });

// ---------------------------------------------------------------- animations

function idlePose(f: number, n: number): Pose {
  const t = f / n;
  const s = Math.sin(t * TAU); // + = inhale
  const lag = Math.sin((t - 0.15) * TAU); // arm + shield follow a beat later
  return P({
    breath: s > 0.3 ? 1 : 0,
    by: PY + (s < -0.7 ? 1 : 0),
    nh: [N.nh[0], N.nh[1] + (lag > 0.5 ? -1 : 0)],
    sh: [N.sh[0], N.sh[1] + (lag > 0.5 ? -1 : 0)],
    rune: 1.2 + 0.5 * s,
    eye: f === 5 ? 0.6 : 1,
    srune: 0,
    t,
  });
}

/** Dust billows blown out on both sides of the shield base after the slam (k = 0..1 time). */
function slamDust(cx: number, k: number): Puff[] {
  const out: Puff[] = [];
  for (const [dx, r0, rise] of [
    [-13, 4.4, 3],
    [10, 3.6, 3],
    [-20, 2.4, 1.5],
  ] as const) {
    const sgn = Math.sign(dx);
    out.push({ x: cx + dx + sgn * k * (dx > 0 ? 1.5 : 4), y: GROUND - 2 - k * rise * 2, r: r0 + k * (dx > 0 ? 0.8 : 1.4), f: Math.max(0, k * 1.3 - 0.25) });
  }
  return out;
}

/** Pebbles hopping on the trembling ground (roar hold). */
function tremble(k: number): Chip[] {
  const out: Chip[] = [];
  for (const [x, ph] of [
    [12, 0],
    [20, 0.4],
    [28, 0.75],
    [56, 0.2],
    [59, 0.6],
  ] as const) {
    const u = (k * 2 + ph) % 1;
    out.push({ x, y: GROUND - Math.round(Math.sin(u * Math.PI) * 3), s: 1, dirt: true });
  }
  return out;
}

const ANIMS: Record<MonsterAnim, { fps: number; loop: boolean; poses: Pose[] }> = {
  idle: { fps: 6, loop: true, poses: Array.from({ length: 8 }, (_, f) => idlePose(f, 8)) },

  // Roar: heave the shield high (anticipation) → SLAM it into the ground (rock spikes, dust,
  // chips) → rear up, near fist thrust to the sky, helm back, rune + eye blaze, sparks rise, the
  // ground trembles → hold → settle.
  roar: {
    fps: 10,
    loop: false,
    poses: [
      P({ t: 0 }),
      P({ by: 45, lean: -0.08, sh: [48, 33], skew: -0.06, nh: [20, 40], rune: 1.4, eye: 1.3, hdy: -1, hdx: -1, t: 0.1 }),
      P({ by: 49, lean: 0.14, sh: [47, 48], nh: [17, 47], rune: 1.8, eye: 1.6, eyeMode: 'roar', hdy: 1, spikes: 1,
        dust: slamDust(47, 0), chips: [{ x: 38, y: 50, s: 2 }, { x: 56, y: 49, s: 2 }, { x: 35, y: 55, s: 1 }, { x: 59, y: 54, s: 1 }, { x: 45, y: 31, s: 1 }], t: 0.2 }),
      P({ by: 45, lean: -0.1, hdx: -1, hdy: -2, sh: [47, 48], nh: [15, 10], rune: 2, eye: 2, eyeMode: 'roar', glint: true, sparks: 0.2, spikes: 0.7,
        dust: slamDust(47, 0.3), chips: [{ x: 35, y: 44, s: 2 }, { x: 58, y: 43, s: 2 }, { x: 31, y: 52, s: 1 }, { x: 60, y: 51, s: 1 }, ...tremble(0)], t: 0.3 }),
      P({ by: 45, lean: -0.12, hdx: -1, hdy: -2, sh: [47, 48], nh: [14, 9], rune: 2, eye: 2, eyeMode: 'roar', glint: true, sparks: 0.45, spikes: 0.4,
        dust: slamDust(47, 0.55), chips: [{ x: 33, y: 45, s: 1 }, { x: 59, y: 44, s: 1 }, { x: 30, y: 57, s: 1 }, ...tremble(0.25)], t: 0.4 }),
      P({ bx: 30.6, by: 45, lean: -0.12, hdx: -1, hdy: -2, sh: [47, 48], nh: [15, 9], rune: 1.9, eye: 2, eyeMode: 'roar', sparks: 0.7, spikes: 0.15,
        dust: slamDust(47, 0.8), chips: tremble(0.5), t: 0.5 }),
      P({ by: 45, lean: -0.1, hdx: -1, hdy: -1, sh: [47, 48], nh: [15, 10], rune: 1.8, eye: 1.8, eyeMode: 'roar', sparks: 0.95, chips: tremble(0.75), t: 0.6 }),
      P({ by: 46, lean: -0.04, sh: [47, 46], nh: [17, 28], rune: 1.5, eye: 1.4, t: 0.7 }),
      P({ by: 47, lean: 0.03, sh: [47, 44], nh: [14, 46], rune: 1.2, eye: 1.1, t: 0.8 }),
      P({ t: 0.9 }),
    ],
  },

  // Attack ("Kaya Fırlatma"): crouch and dig the near hand into the ground → tear a boulder out
  // (dirt rains off it) → heft it overhead and lean far back (anticipation, 2 frames) → whip it
  // over (smear) → IMPACT: release, arm flung toward the target, open hand (muzzle) → follow-
  // through, weight onto the front foot, shield pulled back as counterweight → recover.
  attack: {
    fps: 12,
    loop: false,
    poses: [
      P({ t: 0 }),
      P({ by: 49, lean: 0.2, nh: [13, 56], hand: 'grip', sh: [48, 46], rune: 1.2, hdy: 1,
        chips: [{ x: 8, y: 56, s: 1, dirt: true }, { x: 18, y: 57, s: 2, dirt: true }, { x: 11, y: 52, s: 1, dirt: true }],
        dust: [{ x: 11, y: 59, r: 2.2 }, { x: 17, y: 59, r: 1.6 }], t: 0.1 }),
      P({ by: 47, lean: 0.06, nh: [13, 44], hand: 'grip', rock: [13, 38], sh: [48, 44], rune: 1.4,
        chips: [{ x: 10, y: 47, s: 2, dirt: true }, { x: 16, y: 50, s: 1, dirt: true }, { x: 12, y: 54, s: 1, dirt: true }, { x: 9, y: 57, s: 1, dirt: true }],
        dust: [{ x: 10, y: 58, r: 2.8, f: 0.2 }, { x: 16, y: 59, r: 2.2, f: 0.2 }], t: 0.2 }),
      P({ by: 46, lean: -0.18, nh: [14, 18], bend: -1, hand: 'grip', rock: [13, 12], sh: [51, 42], skew: 0.05, rune: 1.7, eye: 1.4, hdx: -1, hdy: -1,
        chips: [{ x: 9, y: 26, s: 1, dirt: true }, { x: 15, y: 34, s: 1, dirt: true }], dust: [{ x: 10, y: 57, r: 3.2, f: 0.6 }], t: 0.3 }),
      P({ by: 45, lean: -0.22, nh: [13, 17], bend: -1, hand: 'grip', rock: [12, 11], sh: [52, 41], skew: 0.06, rune: 2, eye: 2, eyeMode: 'roar', glint: true, hdx: -1, hdy: -1,
        chips: [{ x: 7, y: 33, s: 1, dirt: true }], t: 0.4 }),
      P({ by: 46, lean: 0.06, twist: 0.5, nh: [30, 14], bend: -1, hand: 'grip', rock: [31, 9], sh: [49, 44], rune: 2, eye: 2, eyeMode: 'roar',
        smear: [[12, 11], [15, 6], [20, 4], [26, 4]], t: 0.5 }),
      P({ by: 47, lean: 0.22, twist: 1, nh: [48, 16], hand: 'open', sh: [45, 46], skew: -0.05, rune: 2, eye: 2, eyeMode: 'roar',
        smear: [[31, 5], [38, 6], [43, 9], [46, 13]], chips: [{ x: 56, y: 10, s: 2, dirt: true }, { x: 59, y: 15, s: 1, dirt: true }, { x: 55, y: 6, s: 1, dirt: true }], t: 0.6 }),
      P({ by: 48, lean: 0.3, twist: 1, nh: [50, 33], hand: 'open', sh: [44, 47], skew: -0.06, rune: 1.7, eye: 1.6,
        dust: [{ x: 42, y: 59, r: 2.2 }, { x: 34, y: 59, r: 1.6 }], t: 0.7 }),
      P({ by: 47, lean: 0.12, twist: 0.5, nh: [30, 46], sh: [46, 45], rune: 1.4, eye: 1.2, dust: [{ x: 44, y: 58, r: 2.4, f: 0.5 }], t: 0.8 }),
      P({ rune: 1.1, t: 0.9 }),
    ],
  },

  // Hit: rocked back on the heels, helm jolts, rune gutters, chips burst off the shield face.
  hit: {
    fps: 10,
    loop: false,
    poses: [
      P({ bx: 27, lean: -0.2, hdx: -1, eyeMode: 'hit', nh: [11, 45], sh: [44, 43], skew: -0.08, rune: 0.3, eye: 0.5,
        chips: [{ x: 55, y: 33, s: 3 }, { x: 58, y: 40, s: 2 }, { x: 54, y: 27, s: 2 }, { x: 60, y: 46, s: 1 }],
        dust: [{ x: 55, y: 36, r: 2.6 }, { x: 24, y: 59, r: 1.8 }], t: 0.1 }),
      P({ bx: 28, lean: -0.14, hdx: -1, eyeMode: 'hit', nh: [12, 46], sh: [45, 43], skew: -0.05, rune: 0.5, eye: 0.6,
        chips: [{ x: 59, y: 30, s: 2 }, { x: 60, y: 39, s: 2 }, { x: 57, y: 23, s: 1 }, { x: 61, y: 49, s: 1 }],
        dust: [{ x: 58, y: 33, r: 3.2, f: 0.35 }, { x: 22, y: 58, r: 2.2, f: 0.4 }], t: 0.2 }),
      P({ bx: 29, lean: -0.06, nh: [13, 47], sh: [46, 43], skew: -0.02, rune: 0.8, eye: 0.9,
        chips: [{ x: 62, y: 33, s: 1 }, { x: 61, y: 54, s: 1 }], dust: [{ x: 60, y: 31, r: 3.6, f: 0.75 }], t: 0.3 }),
      P({ rune: 1, t: 0.4 }),
    ],
  },

  // Guard: the tower shield is planted in the ground in front, the sentinel crouches behind it
  // leaning in, near arm braced behind it; only the helm and the burning slit show over the top.
  // The shield's rune wakes up and pulses slowly.
  guard: {
    fps: 4,
    loop: true,
    poses: [0, 1, 2, 3].map((f) => {
      const t = f / 4;
      const s = Math.sin(t * TAU);
      return P({
        by: 50,
        lean: 0.16,
        breath: s > 0.5 ? 1 : 0,
        hdy: 1,
        eyeMode: 'guard',
        nh: [14, 56],
        bend: 1,
        sh: [41, 47],
        nf: [19, GROUND],
        ff: [38, GROUND],
        rune: 0,
        eye: 1,
        srune: 1.3 + 0.5 * s,
        t,
      });
    }),
  },
};

// ---------------------------------------------------------------- helpers

/** Draw into a fresh layer, then composite it with a seam (darker line) where it overlaps what is below. */
function layer(p: Canvas, fn: (q: Canvas) => void, sep: number | null = PAL.stone0): void {
  const q = new PixelCanvas(p.w, p.h);
  fn(q);
  merge(p, q, sep);
}

function merge(p: Canvas, q: Canvas, sep: number | null): void {
  if (sep !== null) {
    for (let y = 0; y < q.h; y++)
      for (let x = 0; x < q.w; x++) {
        if (q.isOpaque(x, y) || !p.isOpaque(x, y)) continue;
        if (q.isOpaque(x - 1, y) || q.isOpaque(x + 1, y) || q.isOpaque(x, y - 1) || q.isOpaque(x, y + 1)) p.set(x, y, sep);
      }
  }
  p.blit(q, 0, 0);
}

function ik(s: Pt, h: Pt, l1: number, l2: number, bend: 1 | -1): [Pt, Pt] {
  const dx = h[0] - s[0];
  const dy = h[1] - s[1];
  const d = Math.max(0.01, Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01));
  const a = Math.atan2(dy, dx);
  const ca = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const ang = a + bend * Math.acos(Math.max(-1, Math.min(1, ca)));
  const el: Pt = [s[0] + Math.cos(ang) * l1, s[1] + Math.sin(ang) * l1];
  const fa = Math.atan2(h[1] - el[1], h[0] - el[0]);
  return [el, [el[0] + Math.cos(fa) * l2, el[1] + Math.sin(fa) * l2]];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const STONE = [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4] as const;

const MOSS_KEY = { L: PAL.leaf3, M: PAL.leaf2, m: PAL.leaf1, d: PAL.leaf0 };

/**
 * A stone limb segment a→b with planar shading: lit facet on the side toward the top-left light,
 * mid body, shadow facet on the far side.
 */
function segment(q: Canvas, a: Pt, b: Pt, wa: number, wb: number, tone: number): void {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / L;
  const uy = (b[1] - a[1]) / L;
  let nx = -uy;
  let ny = ux;
  if (nx + ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  const side = (k: number, f0 = 0, f1 = 1): Pt[] => [
    [a[0] + ux * L * f0 + nx * (wa / 2) * k, a[1] + uy * L * f0 + ny * (wa / 2) * k],
    [a[0] + ux * L * f1 + nx * (wb / 2) * k, a[1] + uy * L * f1 + ny * (wb / 2) * k],
  ];
  const lit = side(1);
  const dark = side(-1);
  q.poly([lit[0], lit[1], dark[1], dark[0]], STONE[tone]);
  q.poly([lit[0], lit[1], ...side(0.25).reverse()], STONE[Math.min(4, tone + 1)]);
  q.poly([dark[0], dark[1], ...side(-0.45).reverse()], STONE[Math.max(0, tone - 1)]);
}

// ---------------------------------------------------------------- stamps

// Chest rune ᛉ (algiz, the protection rune) — '#' carved groove that glows.
const RUNE = ['#.#.#', '#.#.#', '.###.', '..#..', '..#..'];
// Shield rune: a bigger ᛉ inside a carved diamond.
const SRUNE = [
  '...#...',
  '#..#..#',
  '#..#..#',
  '.#.#.#.',
  '..###..',
  '...#...',
  '...#...',
  '...#...',
];

// Moss tufts (L light, M mid, m dark, d drip shadow).
const MOSS_PAULDRON_N = ['..LLM....', '.LMMMmLM.', 'LMMmmmMMm', 'Mm.m..mm.', '.m.....d.'];
const MOSS_PAULDRON_F = ['.LLM.', 'LMMmM', 'Mm.m.', '.d...'];
const MOSS_HELM = ['.LLM..', 'LMMmM.', 'Mm..m.', 'd.....'];
const MOSS_SHIELD_TOP = ['..LL....LM..', '.LMMM.LLMMm.', 'LMmmMMMmm.m.', 'm..m.m.....', '...d.......'];
const MOSS_SHIELD_FOOT = ['....L.', '.L.LM.', 'LMMMMm', 'MmmMmm'];
const MOSS_FOOT = ['.LM.', 'LMmM', 'm..m'];

// ---------------------------------------------------------------- parts

/** Near pauldron: a huge rounded stone block, two lamé bands, moss on top. Local origin = its top-left. */
function pauldronN(q: Canvas, x: number, y: number): void {
  // silhouette: rounded top, flared bottom band
  q.poly([[x + 1, y + 3], [x + 4, y], [x + 9, y], [x + 12, y + 3], [x + 13, y + 8], [x + 12, y + 10], [x, y + 10], [x - 1, y + 7]], PAL.stone2);
  // top face (lit)
  q.poly([[x + 1, y + 3], [x + 4, y], [x + 9, y], [x + 11, y + 2], [x + 9, y + 4], [x + 2, y + 5]], PAL.stone3);
  q.hline(x + 4, x + 8, y, PAL.stone4);
  q.set(x + 3, y + 1, PAL.stone4).set(x + 2, y + 2, PAL.stone4);
  // shadow side (right)
  q.poly([[x + 11, y + 3], [x + 13, y + 8], [x + 12, y + 10], [x + 10, y + 10], [x + 11, y + 6]], PAL.stone1);
  // lamé groove + lit lip
  q.hline(x, x + 12, y + 7, PAL.stone1);
  q.hline(x, x + 9, y + 8, PAL.stone3);
  q.hline(x - 1, x + 12, y + 10, PAL.stone1);
  // a crack
  q.set(x + 6, y + 5, PAL.stone1).set(x + 7, y + 6, PAL.stone1);
  q.stamp(MOSS_PAULDRON_N, MOSS_KEY, x + 1, y - 2);
}

/** Far pauldron: smaller, one tone darker. */
function pauldronF(q: Canvas, x: number, y: number): void {
  q.poly([[x, y + 3], [x + 2, y], [x + 7, y], [x + 9, y + 3], [x + 10, y + 8], [x - 1, y + 8]], PAL.stone1);
  q.poly([[x, y + 3], [x + 2, y], [x + 7, y], [x + 8, y + 2], [x + 2, y + 4]], PAL.stone2);
  q.hline(x + 2, x + 6, y, PAL.stone3);
  q.hline(x - 1, x + 9, y + 6, PAL.stone0);
  q.stamp(MOSS_PAULDRON_F, MOSS_KEY, x + 1, y - 2);
}

/** Great helm, 12×11, facing right: lit side plane, a nose ridge, darker front plane with the slit. */
function helm(q: Canvas, x: number, y: number): void {
  // dome + bucket
  q.ellipse(x + 6, y + 5, 6, 5.5, PAL.stone2);
  q.rect(x, y + 5, 12, 6, PAL.stone2);
  // lit side plane (left of the ridge)
  q.ellipse(x + 5, y + 5, 4.6, 4.6, PAL.stone3);
  q.rect(x + 1, y + 5, 6, 5, PAL.stone3);
  q.set(x + 3, y + 1, PAL.stone4).set(x + 2, y + 2, PAL.stone4).set(x + 4, y + 1, PAL.stone4).set(x + 1, y + 4, PAL.stone4);
  // front plane (right of the ridge) in shade
  q.rect(x + 8, y + 3, 4, 8, PAL.stone2);
  q.vline(x + 11, y + 4, y + 10, PAL.stone1);
  // ridge
  q.vline(x + 7, y + 1, y + 10, PAL.stone4);
  q.vline(x + 8, y + 2, y + 10, PAL.stone2);
  // brow over the slit + shadow under it
  q.hline(x + 1, x + 11, y + 4, PAL.stone3);
  q.hline(x + 7, x + 11, y + 6, PAL.stone1);
  // breathing holes
  q.set(x + 9, y + 8, PAL.stone0).set(x + 10, y + 8, PAL.stone1).set(x + 9, y + 9, PAL.stone1);
  // neck rim
  q.hline(x, x + 11, y + 10, PAL.stone1);
  q.stamp(MOSS_HELM, MOSS_KEY, x + 1, y - 1);
}

/** Eye slit cells (helm-local): [x, y, weight]. Front cells burn brightest. */
function slitCells(mode: Pose['eyeMode']): [number, number, number][] {
  const out: [number, number, number][] = [];
  const y = 5;
  if (mode === 'hit') {
    for (let x = 8; x <= 11; x++) out.push([x, y, x === 10 ? 1 : 0.6]);
    return out;
  }
  const x0 = mode === 'guard' ? 6 : 3;
  for (let x = x0; x <= 11; x++) out.push([x, y, x >= 9 ? 1.25 : x >= 7 ? 0.85 : 0.45]);
  if (mode === 'roar') for (let x = 8; x <= 11; x++) out.push([x, y - 1, 0.7]);
  return out;
}

function glowCol(g: number): number | null {
  if (g < 0.25) return null;
  if (g < 0.6) return PAL.gold1;
  if (g < 1.0) return PAL.gold2;
  if (g < 1.55) return PAL.gold3;
  return PAL.gold4;
}

/** Upper body painted around the rest pelvis (PX, PY), unsheared. */
function upperBody(q: Canvas, o: Pose): void {
  const b = o.breath;
  const L = (x: number, y: number): Pt => [PX + x, PY + y - (y < -9 ? b : 0)];
  const hl = (x0: number, x1: number, y: number, c: number) => q.hline(PX + x0, PX + x1, PY + y - (y < -9 ? b : 0), c);
  // ---- torso
  layer(q, (t) => {
    const sil: Pt[] = [L(-8, 0), L(-11, -6), L(-14, -12), L(-14, -18), L(-8, -21), L(7, -21), L(13, -18), L(14, -12), L(11, -6), L(8, 0)];
    // abdomen, recessed in the shade of the chest plate
    t.poly(sil, PAL.stone1);
    t.poly([L(-8, 0), L(-11, -6), L(-13, -10), L(-4, -10), L(-4, 0)], PAL.stone2);
    // chest plate (overhangs the abdomen)
    t.poly([L(-14, -10), L(-14, -18), L(-8, -21), L(7, -21), L(13, -18), L(14, -10)], PAL.stone2);
    t.poly([L(-14, -10), L(-14, -18), L(-8, -21), L(-3, -21), L(-4, -10)], PAL.stone3);
    t.poly([L(8, -21), L(13, -18), L(14, -10), L(10, -10), L(10, -16)], PAL.stone1);
  });
  const draw = (fn: (t: Canvas) => void) => fn(q);
  draw((t) => {
    // plate highlight edge (top-left) and cast shadow of the helm on the collar
    t.line(...L(-13, -18), ...L(-9, -20), PAL.stone4);
    hl(-8, -4, -21, PAL.stone4);
    hl(-3, 7, -21, PAL.stone1);
    hl(-2, 5, -20, PAL.stone1);
    // dark seam under the plate
    hl(-13, 13, -10, PAL.stone0);
    hl(-12, -5, -9, PAL.stone1);
    // abdomen bands: lit top rows, dark seams
    for (const yy of [-6, -3]) {
      hl(-3, 9, yy, PAL.stone0);
      hl(-10, -4, yy, PAL.stone1);
      hl(-3, 7, yy + 1, PAL.stone2);
    }
    hl(-3, 7, -9, PAL.stone2);
    // rune recess on the chest front (darker plate, lit lower-right lip)
    const [rx, ry] = L(1, -18);
    t.rect(rx - 1, ry - 1, 7, 7, PAL.stone1);
    t.hline(rx - 1, rx + 5, ry - 1, PAL.stone0);
    t.vline(rx - 1, ry - 1, ry + 5, PAL.stone0);
    t.hline(rx, rx + 6, ry + 6, PAL.stone3);
    t.vline(rx + 6, ry, ry + 6, PAL.stone3);
    t.stamp(RUNE, { '#': PAL.stone0 }, rx, ry);
    // weathering: cracks and chips
    const cr = (x: number, y: number, c: number) => t.set(...L(x, y), c);
    cr(-10, -16, PAL.stone2);
    cr(-9, -15, PAL.stone2);
    cr(-9, -14, PAL.stone2);
    cr(-8, -13, PAL.stone2);
    cr(10, -19, PAL.stone0);
    cr(11, -18, PAL.stone0);
    cr(11, -17, PAL.stone0);
    cr(-9, -4, PAL.stone1);
    cr(-8, -3, PAL.stone1);
  });
  // ---- belt + tassets
  layer(q, (t) => {
    t.rect(PX - 10, PY - 1, 21, 3, PAL.stone1);
    t.hline(PX - 10, PX - 1, PY - 1, PAL.stone2);
    t.hline(PX - 10, PX + 10, PY + 1, PAL.stone0);
    // buckle stone
    t.rect(PX + 1, PY - 2, 5, 5, PAL.stone2);
    t.hline(PX + 1, PX + 4, PY - 2, PAL.stone3);
    t.vline(PX + 1, PY - 1, PY + 1, PAL.stone3);
    t.vline(PX + 5, PY - 1, PY + 2, PAL.stone1);
    t.set(PX + 3, PY, PAL.stone0);
    // moss caught in the belt
    t.stamp(['.LM', 'MMm', 'm..'], MOSS_KEY, PX - 7, PY - 2);
  });
  layer(q, (t) => {
    t.poly([[PX - 11, PY + 2], [PX - 5, PY + 2], [PX - 5, PY + 8], [PX - 12, PY + 7]], PAL.stone3);
    t.hline(PX - 11, PX - 6, PY + 7, PAL.stone2);
    t.hline(PX - 10, PX - 6, PY + 2, PAL.stone2);
    t.poly([[PX - 4, PY + 2], [PX + 4, PY + 2], [PX + 4, PY + 9], [PX - 4, PY + 9]], PAL.stone2);
    t.vline(PX - 4, PY + 3, PY + 8, PAL.stone3);
    t.hline(PX - 3, PX + 3, PY + 2, PAL.stone1);
    t.hline(PX - 3, PX + 3, PY + 8, PAL.stone1);
    t.poly([[PX + 5, PY + 2], [PX + 10, PY + 2], [PX + 11, PY + 7], [PX + 5, PY + 8]], PAL.stone1);
    t.vline(PX + 5, PY + 3, PY + 7, PAL.stone2);
  });
  // ---- far pauldron, helm, near pauldron
  layer(q, (t) => pauldronF(t, PX + 9, PY - 23 - b));
  layer(q, (t) => helm(t, PX - 5 + o.hdx, PY - 31 - b + o.hdy));
  layer(q, (t) => pauldronN(t, PX - 20, PY - 24 - b));
}

/** Shear-composite the local upper body into the frame. */
function shearInto(src: Canvas, o: Pose): Canvas {
  const out = new PixelCanvas(W, H);
  const dx = Math.round(o.bx - PX);
  const dy = Math.round(o.by - PY);
  for (let y = 0; y < H; y++) {
    const off = y < PY ? Math.round(o.lean * (PY - y)) : 0;
    for (let x = 0; x < W; x++) {
      const c = src.get(x, y);
      if (c !== null) out.set(x + off + dx, y + dy, c);
    }
  }
  return out;
}

/** Local upper-body point → frame px (same mapping as shearInto). */
function toFrame(o: Pose, x: number, y: number): Pt {
  const off = y < PY ? Math.round(o.lean * (PY - y)) : 0;
  return [x + off + Math.round(o.bx - PX), y + Math.round(o.by - PY)];
}

function leg(q: Canvas, hip: Pt, foot: Pt, near: boolean): void {
  const tone = near ? 2 : 1;
  const knee: Pt = [lerp(hip[0], foot[0], 0.55) + 1, lerp(hip[1], foot[1] - 4, 0.6)];
  const ank: Pt = [foot[0], foot[1] - 3];
  segment(q, hip, knee, 8, 7, tone);
  segment(q, knee, ank, 7, 7, tone);
  // knee plate
  q.ellipse(knee[0] + 0.5, knee[1], 3.2, 2.6, STONE[tone]);
  q.set(Math.floor(knee[0]) - 1, Math.floor(knee[1]) - 1, STONE[tone + 1]).set(Math.floor(knee[0]), Math.floor(knee[1]) - 2, STONE[tone + 1]);
  // sabaton: heavy slab, toes to the right
  const fx = Math.round(foot[0]);
  const fy = Math.round(foot[1]);
  q.poly([[fx - 5, fy - 4], [fx + 3, fy - 5], [fx + 6, fy - 3], [fx + 7, fy], [fx + 7, fy + 1], [fx - 5, fy + 1]], STONE[tone]);
  q.poly([[fx - 5, fy - 4], [fx + 3, fy - 5], [fx + 5, fy - 3], [fx - 5, fy - 2]], STONE[tone + 1]);
  q.hline(fx - 5, fx + 7, fy, STONE[tone - 1]);
  if (near) q.stamp(MOSS_FOOT, MOSS_KEY, fx + 1, fy - 6);
}

const SW = 14;
const SH = 28;

/** The tower shield (unsheared, SW×SH): lit thickness strip, raised rim, dark recessed field, carved rune. */
function shieldStamp(): Canvas {
  const s = new PixelCanvas(SW, SH);
  // thickness strip (left, lit) + top face
  s.rect(0, 2, 2, SH - 2, PAL.stone3);
  s.vline(0, 2, SH - 1, PAL.stone4);
  s.rect(1, 0, SW - 1, 2, PAL.stone3);
  s.hline(2, SW - 1, 0, PAL.stone4);
  s.vline(1, SH - 6, SH - 1, PAL.stone2);
  // face: raised rim
  s.rect(2, 2, SW - 2, SH - 2, PAL.stone2);
  s.hline(2, SW - 1, 2, PAL.stone3);
  s.vline(2, 2, SH - 1, PAL.stone3);
  s.vline(SW - 1, 3, SH - 1, PAL.stone1);
  s.hline(3, SW - 1, SH - 1, PAL.stone1);
  // recessed field: dark, inner shadow under the top/left rim, lit lip at the bottom/right
  s.rect(4, 4, SW - 7, SH - 7, PAL.stone1);
  s.hline(4, SW - 4, 4, PAL.stone0);
  s.vline(4, 4, SH - 4, PAL.stone0);
  s.hline(5, SW - 3, SH - 3, PAL.stone3);
  s.vline(SW - 3, 5, SH - 3, PAL.stone3);
  // a lighter slab in the field (weathered stone blocks)
  s.rect(5, 18, 6, 1, PAL.stone0);
  // the carved rune (grooves catch light on their lower edge)
  SRUNE.forEach((row, j) => {
    for (let i = 0; i < row.length; i++)
      if (row[i] === '#') {
        s.set(5 + i, 8 + j, PAL.stone0);
        if (row[i + 1] !== '#' && (SRUNE[j + 1]?.[i] ?? '.') !== '#') s.set(5 + i + 1, 8 + j + 1, PAL.stone2);
      }
  });
  // crack from the top right corner + chipped corner
  for (const [x, y] of [[11, 2], [11, 3], [10, 4], [10, 5], [11, 6]] as const) s.set(x, y, PAL.stone1);
  s.set(12, 4, PAL.stone3);
  s.erase(SW - 1, SH - 1).erase(SW - 2, SH - 1).erase(SW - 1, SH - 2);
  // moss on top, spilling down the strip; grass at the foot
  s.stamp(MOSS_SHIELD_TOP, MOSS_KEY, 0, 0);
  s.stamp(MOSS_SHIELD_FOOT, MOSS_KEY, 0, SH - 4);
  return s;
}
const SHIELD = shieldStamp();

/** Shield-local → frame px (skew shears rows around the shield's middle). */
function shieldXY(o: Pose, x: number, y: number): Pt {
  const ox = Math.round(o.sh[0] - SW / 2);
  const oy = Math.round(o.sh[1] - SH / 2);
  return [ox + x + Math.round(o.skew * (SH / 2 - y)), oy + y];
}

/** The tower shield, sheared by `skew`, clipped at the ground when driven in. */
function shield(q: Canvas, o: Pose): void {
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      const c = SHIELD.get(x, y);
      if (c === null) continue;
      const [fx, fy] = shieldXY(o, x, y);
      if (fy > GROUND) continue;
      q.set(fx, fy, c);
    }
}

function shieldRuneCells(o: Pose): [number, number, boolean][] {
  const out: [number, number, boolean][] = [];
  SRUNE.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] === '#') out.push([...shieldXY(o, 5 + i, 8 + j), i === 3]);
  });
  return out;
}

/** Fist / open hand / grip at h (frame px), knuckles toward `dir` (rad). */
function hand(q: Canvas, h: Pt, mode: Pose['hand'], dir: number): void {
  const x = Math.round(h[0]);
  const y = Math.round(h[1]);
  if (mode === 'open') {
    // palm + splayed stone fingers flung toward dir
    const ux = Math.cos(dir);
    const uy = Math.sin(dir);
    q.disc(x + 0.5, y + 0.5, 3.4, PAL.stone2);
    for (const k of [-1, 0, 1]) {
      const a = dir + k * 0.45;
      q.thickLine(x + ux, y + uy, x + Math.cos(a) * 6, y + Math.sin(a) * 6, 2.2, PAL.stone2);
      q.set(Math.round(x + Math.cos(a) * 5), Math.round(y + Math.sin(a) * 5) - 1, PAL.stone3);
    }
    // thumb up
    q.thickLine(x, y, x + Math.cos(dir - 1.4) * 4.5, y + Math.sin(dir - 1.4) * 4.5, 2, PAL.stone3);
    q.set(x - 1, y - 2, PAL.stone3).set(x - 2, y - 1, PAL.stone3).set(x - 1, y - 1, PAL.stone4);
    return;
  }
  // a heavy stone block fist, lit top-left
  q.rect(x - 3, y - 3, 7, 7, PAL.stone2);
  q.erase(x - 3, y - 3);
  q.erase(x + 3, y + 3);
  q.erase(x - 3, y + 3);
  q.hline(x - 2, x + 2, y - 3, PAL.stone3);
  q.vline(x - 3, y - 2, y + 1, PAL.stone3);
  q.hline(x - 2, x + 2, y - 2, PAL.stone3);
  q.hline(x - 2, x + 2, y + 3, PAL.stone1);
  q.vline(x + 3, y - 2, y + 2, PAL.stone1);
  if (mode === 'fist') {
    // knuckle tops catch the light, a fold line under them
    q.set(x - 2, y - 3, PAL.stone4).set(x, y - 3, PAL.stone4).set(x + 2, y - 3, PAL.stone4);
    q.hline(x - 2, x + 2, y, PAL.stone1);
    q.hline(x - 2, x + 1, y + 1, PAL.stone3);
  } else {
    // gripping: fingers curled over the top
    q.hline(x - 2, x + 2, y - 1, PAL.stone1);
    q.set(x - 1, y - 2, PAL.stone4).set(x + 1, y - 2, PAL.stone4);
  }
}

/** A boulder torn from the ground: faceted earth rock with a moss cap and dirt clods. */
function boulder(q: Canvas, c: Pt): void {
  const [cx, cy] = [Math.round(c[0]), Math.round(c[1])];
  const pts: Pt[] = [];
  const R = [6.2, 5.6, 6.4, 5.8, 6.6, 5.9, 6.3, 5.5];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    pts.push([cx + 0.5 + Math.cos(a) * R[i], cy + 0.5 + Math.sin(a) * R[i] * 0.92]);
  }
  q.poly(pts, PAL.earth2);
  // lit facet top-left
  q.poly([[cx - 5, cy - 1], [cx - 3, cy - 5], [cx + 2, cy - 6], [cx + 1, cy - 2], [cx - 2, cy + 1]], PAL.earth3);
  q.set(cx - 3, cy - 4, PAL.earth4).set(cx - 2, cy - 5, PAL.earth4).set(cx - 4, cy - 2, PAL.earth4);
  // shadow facet bottom-right
  q.poly([[cx + 6, cy], [cx + 4, cy + 4], [cx, cy + 6], [cx - 2, cy + 5], [cx + 2, cy + 2], [cx + 4, cy - 1]], PAL.earth1);
  // facet edge + crack
  q.set(cx + 1, cy - 1, PAL.earth1).set(cx + 2, cy, PAL.earth2);
  q.set(cx - 2, cy + 2, PAL.earth1).set(cx - 1, cy + 3, PAL.earth1);
  q.stamp(['.LM.', 'LMmM'], MOSS_KEY, cx - 1, cy - 7);
}

/** A rock spike jutting out of the ground (roar slam). */
function spike(q: Canvas, x: number, h: number, tilt: number): void {
  if (h < 1) return;
  const top: Pt = [x + 0.5 + tilt, GROUND + 0.5 - h];
  q.poly([[x - 2, GROUND + 1], top, [x + 3, GROUND + 1]], PAL.stone2);
  q.poly([[x - 2, GROUND + 1], top, [x + 0.5, GROUND + 1]], PAL.stone3);
  q.set(Math.floor(top[0]), Math.floor(top[1]), PAL.stone4);
}

/**
 * Dust: each puff is a three-lobed billow; each lobe is a ball with a shadow crescent at the
 * bottom right, a body and a lit cap at the top left. Lobes overlap left → right, so the shadow
 * crescents separate them (cauliflower). Fading puffs (f → 1) shrink and lose their lit caps.
 */
function dustCloud(p: Canvas, puffs: Puff[]): void {
  const lobes: [number, number, number, number][] = [];
  for (const d of puffs) {
    const f = d.f ?? 0;
    const r = d.r * (1 - 0.6 * f);
    if (r < 0.7) continue;
    lobes.push([d.x - r * 0.75, d.y + r * 0.15, r * 0.7, f]);
    lobes.push([d.x, d.y - r * 0.25, r, f]);
    lobes.push([d.x + r * 0.8, d.y + r * 0.2, r * 0.65, f]);
  }
  const clip = new PixelCanvas(W, H);
  for (const [x, y, r, f] of lobes) {
    clip.disc(x + 0.5, y + 0.6, r, PAL.earth2);
    clip.disc(x, y, r * 0.92, PAL.earth3);
    if (r > 1.4) clip.disc(x - r * 0.35, y - r * 0.4, r * (f > 0.5 ? 0.62 : 0.5), PAL.earth4);
  }
  for (let y = 0; y <= GROUND; y++)
    for (let x = 0; x < W; x++) {
      const c = clip.get(x, y);
      if (c !== null) p.set(x, y, c);
    }
}

// ---------------------------------------------------------------- the rig

function drawSentinel(p: Canvas, o: Pose): void {
  const twist = o.twist;
  // joints in frame space
  const shN = toFrame(o, PX - 13 + twist * 8, PY - 17 - o.breath - twist);
  const shF = toFrame(o, PX + 12, PY - 17 - o.breath);
  const hipN: Pt = [o.bx - 5, o.by + 3];
  const hipF: Pt = [o.bx + 6, o.by + 3];
  const [el, wr] = ik(shN, o.nh, 10, 10, o.bend);
  const nearArm = (q: Canvas) => {
    // articulated stone pieces, each separated by a dark seam
    const L = Math.hypot(wr[0] - el[0], wr[1] - el[1]) || 1;
    const ux = (wr[0] - el[0]) / L;
    const uy = (wr[1] - el[1]) / L;
    layer(q, (t) => segment(t, shN, el, 7, 6, 2));
    layer(q, (t) => segment(t, el, wr, 6, 7, 2));
    layer(q, (t) => {
      // elbow knob
      t.disc(el[0], el[1], 2.7, PAL.stone2);
      t.set(Math.floor(el[0]) - 1, Math.floor(el[1]) - 1, PAL.stone3).set(Math.floor(el[0]), Math.floor(el[1]) - 2, PAL.stone4);
    });
    layer(q, (t) => {
      // bracer: a wide stone cuff around the forearm
      const a: Pt = [el[0] + ux * L * 0.35, el[1] + uy * L * 0.35];
      const b: Pt = [el[0] + ux * L * 0.8, el[1] + uy * L * 0.8];
      segment(t, a, b, 9, 10, 2);
    });
    layer(q, (t) => hand(t, wr, o.hand, Math.atan2(uy, ux)));
  };

  // far arm (behind everything): shoulder → shield grip
  layer(p, (q) => segment(q, shF, [o.sh[0] - 1, o.sh[1] - 2], 6, 6, 1), null);
  // legs
  layer(p, (q) => leg(q, hipF, o.ff, false));
  layer(p, (q) => leg(q, hipN, o.nf, true));
  // upper body (sheared)
  const ub = new PixelCanvas(W, H);
  upperBody(ub, o);
  merge(p, shearInto(ub, o), PAL.stone0);
  if (o.armBehind) layer(p, nearArm, PAL.ink);
  // shield
  layer(p, (q) => shield(q, o), PAL.ink);
  // rock spikes from the slam (composited over the dust at the end)
  const spikes = new PixelCanvas(W, H);
  if (o.spikes > 0) {
    const cx = Math.round(o.sh[0]);
    spike(spikes, cx - 10, 9 * o.spikes, -2);
    spike(spikes, cx - 14, 5 * o.spikes, -2);
    spike(spikes, cx + 9, 11 * o.spikes, 2);
    spike(spikes, cx + 12, 6 * o.spikes, 1);
    spikes.outline(PAL.ink);
  }
  // near arm + held boulder (in front)
  if (!o.armBehind) layer(p, nearArm, PAL.ink);
  if (o.rock) layer(p, (q) => boulder(q, o.rock!), PAL.ink);

  // chips & dirt (outlined)
  for (const c of o.chips) {
    const col = c.dirt ? PAL.earth2 : PAL.stone2;
    const hi = c.dirt ? PAL.earth3 : PAL.stone3;
    const x = Math.round(c.x);
    const y = Math.round(c.y);
    if (c.s >= 3) {
      p.rect(x - 1, y - 1, 3, 2, col).set(x, y + 1, col).set(x - 1, y - 1, hi).set(x, y - 1, hi);
    } else if (c.s === 2) {
      p.rect(x, y, 2, 2, col).set(x, y, hi);
    } else p.set(x, y, hi);
  }

  p.outline(PAL.ink);

  // ---------------- light pass (unoutlined)
  // chest rune
  const runeCol = glowCol(o.rune);
  if (runeCol !== null) {
    const [rx, ry] = [PX + 1, PY - 18 - o.breath];
    RUNE.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        if (row[i] !== '#') continue;
        const [fx, fy] = toFrame(o, rx + i, ry + j);
        // the stem burns one step hotter
        const hot = i === 2 ? glowCol(o.rune + 0.5) : runeCol;
        if (p.isOpaque(fx, fy)) p.set(fx, fy, hot ?? runeCol);
      }
    });
  }
  // eye slit
  const hx = PX - 5 + o.hdx;
  const hy = PY - 31 - o.breath + o.hdy;
  for (const [cx, cy, w] of slitCells(o.eyeMode)) {
    const col = glowCol(o.eye * w);
    const [fx, fy] = toFrame(o, hx + cx, hy + cy);
    if (!p.isOpaque(fx, fy)) continue;
    p.set(fx, fy, col ?? PAL.stone0);
  }
  // eye glint on a blazing roar frame
  if (o.glint) {
    const [gx, gy] = toFrame(o, hx + 10, hy + 5);
    p.set(gx + 2, gy, PAL.gold3).set(gx + 3, gy, PAL.gold4).set(gx + 4, gy, PAL.gold3);
    p.set(gx + 3, gy - 1, PAL.gold3).set(gx + 3, gy + 1, PAL.gold3);
  }
  // shield rune
  const sCol = glowCol(o.srune);
  if (sCol !== null) {
    for (const [x, y, stem] of shieldRuneCells(o)) if (p.isOpaque(x, y)) p.set(x, y, stem ? glowCol(o.srune + 0.5) ?? sCol : sCol);
  }
  // rune sparks rising off the chest (roar)
  if (o.sparks > 0) {
    const [rx, ry] = toFrame(o, PX + 3, PY - 17);
    for (let i = 0; i < 4; i++) {
      const k = (o.sparks + i * 0.27) % 1;
      const x = Math.round(rx + Math.sin((k + i) * 5) * 4 + (i - 1.5) * 3);
      const y = Math.round(ry - k * 22);
      p.set(x, y, k < 0.5 ? PAL.gold4 : PAL.gold3);
      if (k < 0.3) p.set(x, y + 1, PAL.gold2);
    }
  }
  // swing smear
  if (o.smear.length > 1) {
    const pts = o.smear;
    for (let i = 0; i + 1 < pts.length; i++) {
      const w = 1 + (i / (pts.length - 1)) * 2.4;
      const col = i >= pts.length - 2 ? PAL.stone4 : PAL.stone3;
      p.thickLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, col);
    }
  }
  // dust (soft, no outline), then the spikes punch through it
  dustCloud(p, o.dust);
  p.blit(spikes, 0, 0);
}

// ---------------------------------------------------------------- portrait (44×34)

function portrait(p: Canvas): void {
  // dusk over the thousand-year fortress: warm haze, a halo behind the helm, crenellated walls
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 44; x++) {
      const d = Math.hypot((x - 22) * 0.8, y - 10);
      let col: number = PAL.earth0;
      if (d < 18) col = PAL.earth1;
      if (d < 10) col = PAL.earth2;
      p.set(x, y, col);
    }
  // fortress wall silhouette with crenellations and a tower on each side
  for (let x = 0; x < 44; x++) {
    let top = 20;
    if (x < 8 || x > 36) top = 12;
    if ((x < 8 || x > 36) && x % 4 < 2) top -= 2;
    else if (x >= 8 && x <= 36 && x % 4 < 2) top -= 2;
    for (let y = top; y < 34; y++) p.set(x, y, PAL.stone0);
    if (top < 34) p.set(x, top, PAL.stone1);
  }
  // a lit window in each tower
  p.rect(3, 16, 2, 3, PAL.gold2).rect(39, 16, 2, 3, PAL.gold2);
  const big = new PixelCanvas(W, H);
  drawSentinel(big, P({ rune: 2, eye: 2, eyeMode: 'roar', glint: true, srune: 1.4, nh: [15, 46], sparks: 0.3 }));
  const ox = 9;
  const oy = 12;
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 44; x++) {
      const col = big.get(ox + x, oy + y);
      if (col !== null) p.set(x, y, col);
    }
}

// ---------------------------------------------------------------- export

const art: MonsterArt = {
  id: 'stone_sentinel',
  w: W,
  h: H,
  anchorX: 30,
  anchorY: GROUND,
  hover: 0,
  muzzle: { x: 52, y: 13 },
  core: { x: 31, y: 36 },
  anims: {
    idle: { frames: ANIMS.idle.poses.length, fps: ANIMS.idle.fps, loop: true },
    roar: { frames: ANIMS.roar.poses.length, fps: ANIMS.roar.fps, loop: false },
    attack: { frames: ANIMS.attack.poses.length, fps: ANIMS.attack.fps, loop: false },
    hit: { frames: ANIMS.hit.poses.length, fps: ANIMS.hit.fps, loop: false },
    guard: { frames: ANIMS.guard.poses.length, fps: ANIMS.guard.fps, loop: true },
  },
  attackImpactFrame: 6,
  draw(p: Canvas, anim: MonsterAnim, frame: number) {
    const poses = ANIMS[anim].poses;
    drawSentinel(p, poses[Math.max(0, Math.min(poses.length - 1, frame))]);
  },
  portrait,
};

export default art;
