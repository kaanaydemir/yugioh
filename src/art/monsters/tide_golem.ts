// Gelgit Golemi (tide_golem) — WATER golem, 64×64.
//
// A hulking body of living sea water held together by ancient stone: a carved collar and waist
// ring, rune-carved bracelets on the forearms, and a coral-crusted stone face mask whose eye
// holes glow cyan. Turned 3/4 to the right (big near shoulder, chest/mask/core pushed forward, far
// fist raised in a brawler's guard). The torso rises out of a spinning waterspout that splashes
// into a foam ring on the ground; inside the body 1px currents sweep around a diamond-shaped cyan
// core and bubble rings rise. Water is shaded as a translucent liquid (light rim where the water is
// thin, deep water1 interior, white foam caps breaking on the shoulders and fists). Parametric
// rig: every frame is a Pose (numbers);
// drawGolem() paints back-to-front: far arm → back foam / guard ring → waterspout → torso
// (water, currents, core) → stone rings → head (wave-crest hood, mask, coral) → near arm → front
// foam / guard ring → geysers, slam splash, loose water → outline → swing swoosh. Arms are
// 2-bone IK chains.

import { PAL } from '../palette';
import { PixelCanvas, type Pt } from '../pixel';
import type { MonsterAnim, MonsterArt } from '../types';

const W = 64;
const H = 64;
const TAU = Math.PI * 2;
const GROUND = 60;

// ---------------------------------------------------------------- pose

interface Drop {
  x: number;
  y: number;
  /** 0 = speck, 1 = drop, 2 = big drop */
  s: number;
}

interface Pose {
  /** Torso center (frame px). */
  bx: number;
  by: number;
  /** Lean (rad, + = forward/right) around the waist, width / height scale of the torso. */
  lean: number;
  sx: number;
  sy: number;
  /** Head offset + expression. */
  hdx: number;
  hdy: number;
  face: 'n' | 'roar' | 'hit' | 'guard';
  /** Near (screen-left, in front) and far (screen-right, behind) fists. */
  nf: Pt;
  ff: Pt;
  /** Far arm drawn in front of the torso (guard cross). */
  farFront: boolean;
  /** Elbow bend direction override for the near / far arm (0 = default). */
  nBend: -1 | 0 | 1;
  fBend: -1 | 0 | 1;
  /** Core glow 0..2, flow phase (loops 0..1), vortex spin phase. */
  core: number;
  flow: number;
  /** Ground splash / foam ring intensity 0..2. */
  foam: number;
  /** Guard: spinning water ring around the waist 0..1. */
  wall: number;
  /** Impact splash at the fists 0..1 (attack). */
  slam: number;
  /** Arc smear behind the fists (previous fist positions, near/far). */
  smear: Pt[];
  /** Geysers erupting up out of both fists (roar) 0..1. */
  spout: number;
  /** Foam collar bursting around the fists as the geysers launch (roar) 0..1. */
  collar: number;
  /** Arm length scale (the water limbs stretch on big heaves). */
  reach: number;
  /** Gobs of body water knocked loose (hit): x, y, radius. */
  blobs: [number, number, number][];
  drops: Drop[];
}

const N: Pose = {
  bx: 30,
  by: 33,
  lean: 0.06,
  sx: 1,
  sy: 1,
  hdx: 1,
  hdy: 0,
  face: 'n',
  nf: [9, 48],
  ff: [51, 41],
  farFront: false,
  nBend: 0,
  fBend: -1,
  core: 1,
  flow: 0,
  foam: 1,
  wall: 0,
  slam: 0,
  smear: [],
  spout: 0,
  collar: 0,
  reach: 1,
  blobs: [],
  drops: [],
};

const P = (o: Partial<Pose>): Pose => ({ ...N, ...o });

// ---------------------------------------------------------------- animations

function idlePose(f: number, n: number): Pose {
  const t = f / n;
  const s = Math.sin(t * TAU);
  const lag = Math.sin((t - 0.15) * TAU);
  return P({
    by: N.by + (s > 0.5 ? -1 : s < -0.5 ? 1 : 0),
    sy: 1 + 0.025 * s,
    sx: 1 - 0.02 * s,
    nf: [N.nf[0] - 0.4 * lag, N.nf[1] - 0.9 * lag],
    ff: [N.ff[0] + 0.4 * lag, N.ff[1] - 0.9 * lag],
    core: 1 + 0.45 * s,
    flow: t,
    foam: 1 + 0.2 * Math.sin((t + 0.3) * TAU),
    drops: idleDrips(t),
  });
}

/** Water drips off the fists and falls into the foam. */
function idleDrips(t: number): Drop[] {
  const out: Drop[] = [];
  for (const [ph, x, y0] of [
    [0, 8, 53],
    [0.5, 52, 46],
  ] as const) {
    const k = (t + ph) % 1;
    if (k < 0.25) continue;
    const f = (k - 0.25) / 0.75;
    out.push({ x, y: y0 + f * f * (GROUND - 1 - y0), s: k < 0.4 ? 1 : 2 });
  }
  return out;
}

function sprayUp(k: number, seeds: [number, number, number][]): Drop[] {
  // drops thrown up from points, following a parabola over k (0..1)
  return seeds.map(([x, y, vx], i) => ({ x: x + vx * k * 8, y: y - 14 * k + 16 * k * k + (i % 2), s: k < 0.5 ? 2 : 1 }));
}

const ROAR_SPRAY: [number, number, number][] = [
  [8, 9, -0.6],
  [14, 7, -0.2],
  [54, 8, 0.5],
  [49, 6, 0.2],
  [20, 19, -0.4],
  [42, 18, 0.4],
];

const ANIMS: Record<MonsterAnim, { fps: number; loop: boolean; poses: Pose[] }> = {
  idle: { fps: 8, loop: true, poses: Array.from({ length: 8 }, (_, f) => idlePose(f, 8)) },

  // Roar: sink and gather (anticipation) → surge up, both arms thrown up and out, a foam collar
  // bursts round each fist and 13–15px geysers blast up out of them, the mask's eyes and mouth
  // blaze → the geysers break and shed drops → settle.
  roar: {
    fps: 10,
    loop: false,
    poses: [
      P({ flow: 0 }),
      P({ by: 36, sy: 0.92, sx: 1.06, lean: 0.08, nf: [19, 50], ff: [42, 50], core: 0.6, foam: 1.4, hdy: 1, flow: 0.1 }),
      P({ by: 31, sy: 1.06, sx: 0.98, lean: -0.08, nf: [10, 25], ff: [52, 23], nBend: -1, fBend: 1, core: 1.6, foam: 1.6, face: 'roar', hdx: -1, hdy: -1, flow: 0.2, spout: 0.25 }),
      P({ by: 31, sy: 1.08, sx: 0.98, lean: -0.1, nf: [8, 23], ff: [54, 21], nBend: -1, fBend: 1, core: 2, foam: 2, face: 'roar', hdx: -1, hdy: -2, flow: 0.3, spout: 0.65, collar: 1 }),
      P({ by: 31, sy: 1.08, sx: 0.98, lean: -0.11, nf: [8, 23], ff: [54, 21], nBend: -1, fBend: 1, core: 2, foam: 1.8, face: 'roar', hdx: -1, hdy: -2, flow: 0.4, spout: 1, collar: 0.4 }),
      P({ by: 31, sy: 1.07, sx: 0.98, lean: -0.1, nf: [8, 23], ff: [54, 21], nBend: -1, fBend: 1, core: 1.9, foam: 1.6, face: 'roar', hdx: -1, hdy: -2, flow: 0.5, spout: 0.95,
        drops: [{ x: 2, y: 8, s: 2 }, { x: 4, y: 12, s: 1 }, { x: 61, y: 7, s: 2 }, { x: 59, y: 11, s: 1 }, { x: 13, y: 5, s: 0 }, { x: 50, y: 4, s: 0 }] }),
      P({ by: 31, sy: 1.06, sx: 0.98, lean: -0.08, nf: [9, 24], ff: [53, 22], nBend: -1, fBend: 1, core: 1.8, foam: 1.4, face: 'roar', hdx: -1, hdy: -1, flow: 0.6, spout: 0.6,
        drops: [{ x: 2, y: 15, s: 2 }, { x: 4, y: 19, s: 1 }, { x: 61, y: 14, s: 2 }, { x: 59, y: 19, s: 1 }, { x: 14, y: 9, s: 1 }, { x: 49, y: 8, s: 1 }] }),
      P({ by: 32, sy: 1.02, lean: -0.03, nf: [12, 32], ff: [50, 30], core: 1.5, foam: 1.2, flow: 0.7, spout: 0.15,
        drops: [{ x: 2, y: 24, s: 1 }, { x: 62, y: 23, s: 1 }, { x: 15, y: 15, s: 0 }, { x: 48, y: 14, s: 0 }] }),
      P({ by: 34, sy: 0.97, sx: 1.03, nf: [11, 46], ff: [49, 45], core: 1.2, foam: 1.3, flow: 0.8 }),
      P({ flow: 0.9 }),
    ],
  },

  // Attack ("Dalga Darbesi"): crouch and gather → heave both arms up into a wide V, fists high and
  // apart, forearms showing, shoulders still broad, the core charging (anticipation) → the arms swing
  // forward over the head (the mask and blazing eyes stay visible under them) → slam down: IMPACT,
  // fists hit the ground in front, a burst of foam (muzzle = fists, the floor wave starts here) →
  // follow-through → recover.
  attack: {
    fps: 12,
    loop: false,
    poses: [
      P({ flow: 0 }),
      P({ by: 34, sy: 0.95, sx: 1.04, lean: 0.06, nf: [14, 51], ff: [46, 50], fBend: 1, core: 1.2, flow: 0.1 }),
      P({ by: 31, sy: 1.04, lean: -0.08, nf: [11, 13], ff: [49, 12], nBend: -1, fBend: 1, reach: 1.05, core: 1.6, flow: 0.2, hdx: -1, hdy: 0 }),
      P({ by: 32, sy: 1.03, lean: -0.1, nf: [9, 9], ff: [51, 8], nBend: -1, fBend: 1, reach: 1.1, core: 2, flow: 0.3, hdx: -1, hdy: 1, face: 'roar' }),
      P({ by: 32, sy: 1.02, lean: 0.22, nf: [44, 10], ff: [53, 14], nBend: -1, fBend: 1, reach: 1.15, core: 2, flow: 0.4, hdx: 1, hdy: 1, face: 'roar', smear: [[12, 9], [22, 4], [34, 4]] }),
      P({ by: 37, sy: 0.92, sx: 1.07, lean: 0.36, nf: [47, 55], ff: [54, 54], core: 1.8, flow: 0.5, face: 'roar', slam: 1, foam: 1.8 }),
      P({ by: 37, sy: 0.93, sx: 1.06, lean: 0.34, nf: [47, 55], ff: [54, 54], core: 1.5, flow: 0.6, slam: 0.6, foam: 1.6,
        drops: [{ x: 57, y: 44, s: 2 }, { x: 60, y: 49, s: 1 }, { x: 44, y: 45, s: 1 }, { x: 59, y: 39, s: 0 }] }),
      P({ by: 35, sy: 0.97, lean: 0.18, nf: [38, 52], ff: [50, 51], core: 1.3, flow: 0.7, foam: 1.3, drops: [{ x: 60, y: 47, s: 1 }, { x: 61, y: 55, s: 0 }] }),
      P({ by: 33, lean: 0.04, nf: [14, 49], ff: [49, 47], core: 1.1, flow: 0.8 }),
      P({ flow: 0.9 }),
    ],
  },

  // Hit: the water body is knocked back and splashes, mask jolts, the core gutters.
  hit: {
    fps: 10,
    loop: false,
    poses: [
      P({ bx: 27, by: 34, lean: -0.22, sx: 1.08, sy: 0.92, hdx: -2, hdy: 1, face: 'hit', nf: [8, 44], ff: [44, 41], core: 0.4, flow: 0.15, foam: 1.6, blobs: [[46, 23, 2.2], [49, 31, 1.6], [43, 16, 1.3]],
        drops: [{ x: 47, y: 22, s: 2 }, { x: 51, y: 30, s: 2 }, { x: 45, y: 15, s: 1 }, { x: 53, y: 38, s: 1 }, { x: 8, y: 26, s: 1 }] }),
      P({ bx: 28, by: 34, lean: -0.12, sx: 1.04, sy: 0.96, hdx: -1, face: 'hit', nf: [9, 46], ff: [47, 44], core: 0.7, flow: 0.3, foam: 1.3, blobs: [[51, 20, 1.8], [54, 31, 1.3], [47, 12, 1]],
        drops: [{ x: 52, y: 19, s: 1 }, { x: 56, y: 30, s: 1 }, { x: 49, y: 12, s: 0 }, { x: 57, y: 41, s: 1 }, { x: 5, y: 30, s: 0 }] }),
      P({ bx: 31, lean: 0.07, sx: 0.98, sy: 1.02, nf: [10, 48], ff: [51, 44], core: 0.9, flow: 0.45, drops: [{ x: 58, y: 36, s: 0 }, { x: 58, y: 50, s: 0 }] }),
      P({ flow: 0.6 }),
    ],
  },

  // Guard: forearms crossed over the core, the body hunkers and thickens, a ring of water spins
  // around the waist as a barrier (wave crests with foam caps travel around it).
  guard: {
    fps: 5,
    loop: true,
    poses: [0, 1, 2, 3].map((f) => {
      const s = Math.sin((f / 4) * TAU);
      const b = s > 0.5 ? 1 : 0;
      return P({
        by: 35,
        sx: 1.1,
        sy: 0.94,
        lean: 0.06,
        hdy: 1,
        face: 'guard',
        nf: [26, 41 - b],
        ff: [39, 40 - b],
        farFront: true,
        fBend: 1,
        core: 0.8 + 0.3 * s,
        flow: f / 4,
        wall: 1,
        foam: 0.8,
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

/** Recolor opaque pixels whose neighbor (dx, dy) is transparent. */
function edge(q: Canvas, dx: number, dy: number, c: number): void {
  const src = q.clone();
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) if (src.isOpaque(x, y) && !src.isOpaque(x + dx, y + dy)) q.set(x, y, c);
}

/** Draw `fn` only inside the opaque pixels of q. */
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
const frac = (v: number) => v - Math.floor(v);

/** Depth toward a direction until transparency (max n). */
function reach(q: Canvas, x: number, y: number, dx: number, dy: number, n: number): number {
  for (let k = 1; k <= n; k++) if (!q.isOpaque(x + dx * k, y + dy * k)) return k;
  return n + 1;
}

/**
 * Translucent water material. Light passes through the thin edges, so the silhouette carries a
 * light rim (water4 on the lit top crest, water3 around the lit side, water2 on the shadowed
 * bottom-right) over a deep water1 interior; the side toward the light glows water2 inside.
 * `dim` = far/back elements (one step darker everywhere).
 */
function shadeWater(q: Canvas, dim = false): void {
  const src = q.clone();
  const R = 7;
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      if (!src.isOpaque(x, y)) continue;
      const dl = Math.min(reach(src, x, y, -1, 0, R), reach(src, x, y, 0, -1, R));
      const ds = Math.min(reach(src, x, y, 1, 0, R), reach(src, x, y, 0, 1, R));
      const e = Math.min(dl, ds);
      const t = dl / (dl + ds);
      let c: number;
      if (e <= 1) {
        // rim: the water is thin here and lets the light through
        if (!src.isOpaque(x, y - 1)) c = dim ? PAL.water2 : PAL.water4;
        else if (dl <= 1) c = dim ? PAL.water2 : PAL.water3;
        else c = dim ? PAL.water1 : PAL.water2;
      } else if (e === 2 && dl === 2) c = dim ? PAL.water1 : PAL.water3;
      else if (e === 2) c = dim ? PAL.water1 : PAL.water2;
      else c = t < 0.3 ? (dim ? PAL.water1 : PAL.water2) : dim ? PAL.water0 : PAL.water1;
      q.set(x, y, c);
    }
}

/** White foam lumps sitting on a water crest (drawn on top of the shaded water, they extend the silhouette). */
function foamCap(q: Canvas, lumps: readonly (readonly [number, number, number])[], dim = false): void {
  const f = new PixelCanvas(q.w, q.h);
  for (const [x, y, r] of lumps) f.disc(x, y, r, PAL.white);
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      if (!f.isOpaque(x, y)) continue;
      const top = !f.isOpaque(x, y - 1);
      const bottom = !f.isOpaque(x, y + 1);
      let c: number = top ? PAL.white : bottom ? PAL.water3 : PAL.water4;
      if (dim) c = top ? PAL.water4 : PAL.water3;
      q.set(x, y, c);
    }
}

/** Hollow bubble ring (4 px) or a single-pixel bubble. */
function bubble(t: Canvas, x: number, y: number, ring: boolean): void {
  x = Math.round(x);
  y = Math.round(y);
  if (!ring) {
    t.set(x, y, PAL.cyan4);
    return;
  }
  t.set(x, y - 1, PAL.cyan4).set(x - 1, y, PAL.cyan4).set(x + 1, y, PAL.cyan4).set(x, y + 1, PAL.cyan3);
}

/** Interior water (not the light rim) — where currents and bubbles may be painted. */
const DEEP = new Set<number>([PAL.water0, PAL.water1, PAL.water2]);

/** Stone material: stone2 base, lit top-left, dark bottom-right, optional 1px top highlight. */
function shadeStone(q: Canvas, dim = false): void {
  const src = q.clone();
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      if (!src.isOpaque(x, y)) continue;
      let c: number = dim ? PAL.stone1 : PAL.stone2;
      if (!src.isOpaque(x, y + 1) || !src.isOpaque(x + 1, y)) c = dim ? PAL.stone0 : PAL.stone1;
      if (!src.isOpaque(x, y - 1)) c = dim ? PAL.stone2 : PAL.stone4;
      else if (!src.isOpaque(x - 1, y) || !src.isOpaque(x, y - 2)) c = dim ? PAL.stone2 : PAL.stone3;
      q.set(x, y, c);
    }
}

// ---------------------------------------------------------------- rig geometry

interface Rig {
  T: (x: number, y: number) => Pt;
  shN: Pt;
  shF: Pt;
  waist: Pt;
  core: Pt;
  head: Pt;
}

function rig(o: Pose): Rig {
  const c = Math.cos(o.lean);
  const s = Math.sin(o.lean);
  const wx = o.bx;
  const wy = o.by + 10;
  /** Torso-local (origin = torso center, y down) → frame px; leans around the waist. */
  const T = (x: number, y: number): Pt => {
    const X = x * o.sx;
    const Y = (y - 10) * o.sy;
    return [wx + X * c - Y * s, wy + X * s + Y * c];
  };
  return {
    T,
    shN: T(-12, -8),
    shF: T(10, -9.5),
    waist: [wx, wy],
    core: T(3.5, -3.5),
    head: T(8 + o.hdx, -14.5 + o.hdy),
  };
}

// ---------------------------------------------------------------- parts

const UPPER = 9.5;
const FORE = 10;

function armPts(sh: Pt, fist: Pt, bend: 1 | -1, k: number): { el: Pt; wr: Pt } {
  // the fist center sits ~4px past the wrist
  const dx = fist[0] - sh[0];
  const dy = fist[1] - sh[1];
  const d = Math.hypot(dx, dy) || 1;
  const wrT: Pt = [fist[0] - (dx / d) * 3.5, fist[1] - (dy / d) * 3.5];
  const [el, wr] = ik(sh[0], sh[1], wrT[0], wrT[1], UPPER * k, FORE * k, bend);
  return { el, wr };
}

function drawArm(p: Canvas, o: Pose, sh: Pt, fist: Pt, near: boolean, bend: 1 | -1): void {
  const { el, wr } = armPts(sh, fist, bend, o.reach);
  const dim = !near;
  const fr = near ? 5.6 : 5;
  // water limb: slim upper arm, forearm swelling into a heavy fist
  layer(p, (q) => {
    q.stroke([sh, el], near ? 7 : 6, near ? 6 : 5, PAL.water2);
    q.stroke([el, wr], near ? 6 : 5, near ? 7.5 : 6.5, PAL.water2);
    q.disc(fist[0], fist[1], fr, PAL.water2);
    shadeWater(q, dim);
    const base = q.clone();
    // a current running down the arm into the fist (1px dashes travelling with the flow)
    clip(q, (t) => {
      const path: Pt[] = [sh, el, wr, fist];
      const total = Math.hypot(el[0] - sh[0], el[1] - sh[1]) + Math.hypot(wr[0] - el[0], wr[1] - el[1]) + Math.hypot(fist[0] - wr[0], fist[1] - wr[1]);
      let acc = 0;
      for (let i = 0; i + 1 < path.length; i++) {
        const [ax, ay] = path[i];
        const [bx, by] = path[i + 1];
        const L = Math.hypot(bx - ax, by - ay);
        const nx = -(by - ay) / (L || 1);
        const ny = (bx - ax) / (L || 1);
        for (let k = 0; k <= L * 2; k++) {
          const u = k / (L * 2 || 1);
          const sAt = acc + L * u;
          if (frac(sAt / 7 - o.flow * 2 - (near ? 0 : 0.4)) > 0.5) continue;
          const x = Math.floor(lerp(ax, bx, u) - nx * 1.2);
          const y = Math.floor(lerp(ay, by, u) - ny * 1.2);
          if (DEEP.has(base.get(x, y) ?? -1)) t.set(x, y, dim ? PAL.water2 : PAL.water3);
        }
        acc += L;
      }
      void total;
    });
    // foam breaking over the top of the fist
    const up = fist[1] - fr + 0.6;
    foamCap(q, [
      [fist[0] - 1.8, up + 0.6, 1.5],
      [fist[0] + 0.9, up, 1.8],
    ], dim);
  });
  // stone ring: a heavy rune-carved bracelet at the wrist
  const band = (a: Pt, b: Pt, w: number, rune: boolean) =>
    layer(p, (q) => {
      q.stroke([a, b], w, w, PAL.stone2);
      shadeStone(q, dim);
      const m: Pt = [lerp(a[0], b[0], 0.5), lerp(a[1], b[1], 0.5)];
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2;
      for (let k = -4; k <= 4; k++) {
        const x = m[0] + Math.cos(ang) * k;
        const y = m[1] + Math.sin(ang) * k;
        if (q.isOpaque(x, y) && q.get(x, y) === (dim ? PAL.stone1 : PAL.stone2)) q.set(x, y, dim ? PAL.stone0 : PAL.stone1);
      }
      if (rune && near) {
        // glowing glyph carved across the bracelet + a barnacle
        const g = o.core > 1.5 ? PAL.cyan4 : PAL.cyan3;
        q.set(m[0] + Math.cos(ang) * -2, m[1] + Math.sin(ang) * -2 - 1, g);
        q.set(m[0] + Math.cos(ang) * 1, m[1] + Math.sin(ang) * 1 - 1, g);
        q.set(m[0] + Math.cos(ang) * 2.5, m[1] + Math.sin(ang) * 2.5 - 1, PAL.cyan2);
        q.set(m[0] + Math.cos(ang) * -3.4, m[1] + Math.sin(ang) * -3.4 + 1, PAL.stone4);
      }
    });
  band([lerp(el[0], wr[0], 0.5), lerp(el[1], wr[1], 0.5)], [lerp(el[0], wr[0], 0.66), lerp(el[1], wr[1], 0.66)], near ? 7.5 : 6.5, true);
}

function drawVortex(p: Canvas, o: Pose): void {
  const R = rig(o);
  const top = R.waist;
  const cx = lerp(top[0], o.bx, 0.5);
  layer(p, (q) => {
    // spinning waterspout: pinched in the middle, flaring into the ground; thin spiral currents
    // wrap around the column (cylindrical phase) and travel with the flow
    for (let y = Math.floor(top[1] - 2); y <= GROUND - 2; y++) {
      const t = (y - (top[1] - 2)) / (GROUND - 2 - (top[1] - 2));
      const xc = lerp(top[0], cx, t);
      const pinch = Math.sin(Math.min(1, t * 1.5) * Math.PI * 0.5);
      const hw = lerp(8 * o.sx, 5.5, pinch) + Math.pow(t, 2.6) * 8 * (0.8 + 0.2 * o.foam);
      for (let x = Math.floor(xc - hw); x <= Math.ceil(xc + hw); x++) {
        const u = (x + 0.5 - xc) / hw; // -1..1 across
        if (Math.abs(u) > 1) continue;
        const ang = Math.asin(Math.max(-1, Math.min(1, u))) / Math.PI; // -0.5..0.5 around the front
        const band = frac(ang * 1.6 + y / 6 - o.flow * 2);
        let c: number = u < -0.35 ? PAL.water2 : PAL.water1;
        if (band < 0.13) c = u < 0.2 ? PAL.water3 : PAL.water2;
        if (u > 0.8) c = PAL.water2;
        if (u < -0.78) c = PAL.water3;
        q.set(x, y, c);
      }
    }
  });
}

function drawFoamRing(p: Canvas, o: Pose, front: boolean): void {
  const R = rig(o);
  const cx = lerp(R.waist[0], o.bx, 0.5);
  const cy = GROUND - 2;
  const rx = 13 + 2 * o.foam + o.wall * 4;
  const ry = 3.2 + 0.4 * o.foam;
  layer(
    p,
    (q) => {
      for (let y = Math.floor(cy - ry - 3); y <= GROUND; y++)
        for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
          const dx = (x + 0.5 - cx) / rx;
          const dy = (y + 0.5 - cy) / ry;
          const d = dx * dx + dy * dy;
          if (d > 1) continue;
          const isFront = y + 0.5 >= cy;
          if (isFront !== front) continue;
          // splash crest rises on the rim with a moving wave
          const ang = Math.atan2(dy, dx);
          const crest = 0.5 + 0.5 * Math.sin(ang * 5 + o.flow * TAU * 2);
          let c: number = d > 0.55 ? PAL.water3 : PAL.water2;
          if (d > 0.8 && crest > 0.55) c = PAL.water4;
          if (d > 0.88 && crest > 0.8 && y < cy) c = PAL.white;
          if (front && y >= cy + ry - 1.2) c = PAL.water1;
          q.set(x, y, c);
        }
      // rising splash tongues on the back half
      if (!front)
        for (let k = 0; k < 5; k++) {
          const a = Math.PI + (k + 0.5) * (Math.PI / 5);
          const h = (1.5 + 2.5 * frac(o.flow * 2 + k * 0.37)) * o.foam;
          const x = cx + Math.cos(a) * rx * 0.92;
          const y = cy + Math.sin(a) * ry * 0.92;
          q.stroke([[x, y], [x, y - h]], 2, 1, PAL.water3);
          q.set(x, y - h, PAL.water4);
        }
    },
    front ? PAL.ink : null,
  );
}

/** Torso water mass, turned 3/4 to the right: big near shoulder, chest pushed forward, small far shoulder. */
function drawTorso(p: Canvas, o: Pose): void {
  const R = rig(o);
  const { T } = R;
  layer(p, (q) => {
    const blob = (x: number, y: number, rx: number, ry: number) => {
      const [cx, cy] = T(x, y);
      q.ellipse(cx, cy, rx * o.sx, ry * o.sy, PAL.water2);
    };
    blob(0, -3, 12, 8.5);
    blob(5.5, -4, 8, 7);
    blob(1, 5, 7.5, 6);
    blob(-10.5, -8, 6.5, 6);
    blob(10, -9.5, 5, 4.6);
    blob(0, -11, 8, 4);
    shadeWater(q);
    const base = q.clone();
    const deep = (x: number, y: number) => DEEP.has(base.get(x, y) ?? -1);
    clip(q, (t) => {
      // internal currents: 1px lines sweeping down through the body, dashes travel with the flow
      const curves: Pt[][] = [
        [[-14, -5], [-11, 0], [-6, 4], [0, 6], [6, 4.5]],
        [[-7, -9], [-6, -5], [-2, -1], [-4, 3]],
        [[13, -6], [12, -1], [9, 3], [4, 8]],
      ];
      curves.forEach((c, ci) => {
        let acc = 0;
        for (let i = 0; i + 1 < c.length; i++) {
          const a = T(c[i][0], c[i][1]);
          const b = T(c[i + 1][0], c[i + 1][1]);
          const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
          for (let k = 0; k <= L * 2; k++) {
            const u = k / (L * 2 || 1);
            if (frac((acc + L * u) / 11 - o.flow * 2 - ci * 0.33) > 0.72) continue;
            const x = Math.floor(lerp(a[0], b[0], u));
            const y = Math.floor(lerp(a[1], b[1], u));
            if (deep(x, y)) t.set(x, y, PAL.water3);
          }
          acc += L;
        }
      });
      // bubble rings rising from the waist up through the chest, wobbling as they go
      const lanes = [-8, 11, -3.5];
      for (let k = 0; k < 3; k++) {
        const ph = frac(o.flow + k / 3);
        const [x, y] = T(lanes[k] + Math.sin((ph + k * 0.3) * TAU) * 1.2, 6 - ph * 17);
        if (deep(x, y) && deep(x - 1, y) && deep(x + 1, y) && deep(x, y - 1) && deep(x, y + 1)) bubble(t, x, y, k !== 2);
        const [sx, sy] = T(lanes[(k + 1) % 3] + 1.5, 3 - frac(ph + 0.5) * 14);
        if (deep(sx, sy)) bubble(t, sx, sy, false);
      }
    });
    // glowing core seen through the water: a 5px diamond (white/cyan4 heart) inside a cyan2 halo
    const [cx, cy] = R.core.map(Math.round) as unknown as Pt;
    const g = o.core;
    for (let dy = -5; dy <= 5; dy++)
      for (let dx = -5; dx <= 5; dx++) {
        const d = Math.abs(dx) + Math.abs(dy);
        let c: number | null = null;
        if (d === 0) c = PAL.white;
        else if (d === 1) c = g > 1.25 ? PAL.white : PAL.cyan4;
        else if (d === 2) c = g > 0.8 ? PAL.cyan4 : PAL.cyan3;
        else if (d === 3) c = g > 1.6 ? PAL.cyan3 : PAL.cyan2;
        else if (d === 4 && g > 1.6) c = PAL.cyan2;
        if (c !== null && q.isOpaque(cx + dx, cy + dy)) q.set(cx + dx, cy + dy, c);
      }
    // foam breaking over the shoulders
    const [nsx, nsy] = T(-10.5, -14);
    const [fsx, fsy] = T(10, -14.1);
    foamCap(q, [
      [nsx - 3.4, nsy + 2.2, 1.5],
      [nsx - 1, nsy + 0.6, 2],
      [nsx + 1.8, nsy + 0.5, 1.6],
      [fsx - 0.2, fsy + 0.5, 1.7],
      [fsx + 2.2, fsy + 1.5, 1.3],
    ]);
  });
}

/** Carved stone band around the torso (an ellipse seen from slightly above). */
function drawRing(p: Canvas, o: Pose, y: number, rx: number, thick: number, runes: number): void {
  const R = rig(o);
  const { T } = R;
  layer(p, (q) => {
    const n = 40;
    for (let i = 0; i <= n; i++) {
      // front half only (0..π): the back half is hidden by the body
      const a = (i / n) * Math.PI;
      const [x, yy] = T(Math.cos(a) * rx, y + Math.sin(a) * 2.2);
      q.stroke([[x, yy], [x, yy + thick]], 2, 2, PAL.stone2);
    }
    shadeStone(q);
    // carved notches + runes
    for (let i = 1; i < 6; i++) {
      const a = (i / 6) * Math.PI;
      const [x, yy] = T(Math.cos(a) * rx, y + Math.sin(a) * 2.2);
      const xi = Math.floor(x);
      const yi = Math.floor(yy + thick * 0.5);
      if (i === 2 || i === 3) {
        if (runes > 0) q.set(xi, yi, o.core > 1.5 ? PAL.cyan4 : PAL.cyan3);
      } else if (q.isOpaque(xi, yi)) q.set(xi, yi, PAL.stone0);
    }
  });
}

// ---------------------------------------------------------------- head: water dome + stone mask

// Mask (12×11), turned 3/4 to the right: lit side plane on the left, heavy brow and nose jutting
// right, near eye big, far eye squeezed beside the nose ridge, carved mouth.
// Keys: 0–4 stone ramp, e/f/g eye glow, m mouth (glows when roaring), b barnacle.
const MASK = [
  '...2333332..',
  '..234444432.',
  '.23444444443',
  '.32000030011',
  '.320fe03fg1.',
  '.32100034421',
  '.b2233343321',
  '.312m0m0m21.',
  '.312mmmmm21.',
  '..21233321..',
  '...111111...',
];

function drawHead(p: Canvas, o: Pose): void {
  const R = rig(o);
  const [hx, hy] = R.head;
  const x0 = Math.round(hx - 5);
  const y0 = Math.round(hy - 5);
  const sway = Math.sin((o.flow + 0.2) * TAU);
  // water hood behind the mask, swept back into a curling wave crest with a foam lip
  layer(p, (q) => {
    q.ellipse(x0 + 3, y0 + 4, 6, 6, PAL.water2);
    q.stroke(
      [
        [x0 + 4, y0 - 0.5],
        [x0 + 0.5, y0 - 2],
        [x0 - 3 + sway * 0.5, y0 - 1],
        [x0 - 4.5 + sway, y0 + 1.5],
      ],
      5,
      2.5,
      PAL.water2,
    );
    shadeWater(q);
    foamCap(q, [
      [x0 - 2.5 + sway * 0.5, y0 - 2.6, 1.3],
      [x0 + 0.2, y0 - 3.2, 1.2],
    ]);
  });
  const roar = o.face === 'roar';
  const hit = o.face === 'hit';
  const key: Record<string, number> = {
    '0': PAL.stone0,
    '1': PAL.stone1,
    '2': PAL.stone2,
    '3': PAL.stone3,
    '4': PAL.stone4,
    e: hit ? PAL.stone0 : roar ? PAL.white : PAL.cyan4,
    f: hit ? PAL.cyan1 : roar ? PAL.cyan4 : PAL.cyan3,
    g: hit ? PAL.stone0 : roar ? PAL.cyan3 : PAL.cyan2,
    m: roar ? PAL.cyan3 : PAL.stone0,
    b: PAL.stone4,
  };
  layer(p, (q) => {
    q.stamp(MASK, key, x0, y0);
    if (hit) {
      // eyes squeezed into slits
      q.set(x0 + 4, y0 + 4, PAL.stone0).set(x0 + 5, y0 + 4, PAL.stone0).set(x0 + 4, y0 + 5, PAL.cyan2).set(x0 + 5, y0 + 5, PAL.cyan1);
      q.set(x0 + 8, y0 + 4, PAL.stone0).set(x0 + 9, y0 + 4, PAL.stone0).set(x0 + 8, y0 + 5, PAL.cyan1);
    }
    if (roar) q.set(x0 + 5, y0 + 8, PAL.cyan4).set(x0 + 6, y0 + 8, PAL.cyan4).set(x0 + 3, y0 + 4, PAL.cyan3);
    // coral crust growing off the brow: two knobbly branches + barnacles
    const cq = new PixelCanvas(W, H);
    cq.stroke([[x0 + 3, y0 + 1], [x0 + 2, y0 - 2], [x0 + 0.5, y0 - 4.5]], 2.4, 1.2, PAL.mag2);
    cq.stroke([[x0 + 2.2, y0 - 1.5], [x0 + 4, y0 - 4]], 1.6, 1, PAL.mag2);
    cq.stroke([[x0 + 6.5, y0 + 0.5], [x0 + 7.5, y0 - 2.5]], 2, 1, PAL.mag2);
    edge(cq, 1, 0, PAL.mag1);
    edge(cq, -1, 0, PAL.mag3);
    edge(cq, 0, -1, PAL.mag3);
    cq.set(x0, y0 - 5, PAL.mag4).set(x0 + 4, y0 - 4, PAL.mag4).set(x0 + 7, y0 - 3, PAL.mag4).set(x0 + 2, y0 - 1, PAL.crim3);
    q.blit(cq, 0, 0);
    q.set(x0 + 10, y0 + 2, PAL.mag3).set(x0 + 10, y0 + 1, PAL.mag2);
  });
}

// ---------------------------------------------------------------- guard: spinning water barrier

/** A thick ring of water spinning around the lower body (front or back half). */
function drawWall(p: Canvas, o: Pose, front: boolean): void {
  if (o.wall <= 0) return;
  const R = rig(o);
  const cx = R.waist[0] + 1;
  const cy = 46;
  const rx = 19 * o.wall;
  const ry = 5.5 * o.wall;
  layer(p, (q) => {
    const n = 64;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const isFront = Math.sin(a) > 0;
      if (isFront !== front) continue;
      const x = cx + Math.cos(a) * rx;
      const y = cy + Math.sin(a) * ry;
      // tube thickness swells into wave crests that travel around the ring
      const crest = 0.5 + 0.5 * Math.sin(a * 3 - o.flow * TAU);
      const th = 3.2 + 1.6 * crest + (front ? 0.6 : 0);
      q.disc(x, y - crest * 1.5, th / 2, PAL.water2);
    }
    shadeWater(q, !front);
    if (front) {
      // foam caps riding the crests
      for (let k = 0; k < 3; k++) {
        const a = (o.flow * TAU) / 3 + (k / 3) * TAU + Math.PI / 6;
        const ak = a % TAU;
        if (Math.sin(ak) <= 0.15) continue;
        const x = cx + Math.cos(ak) * rx;
        const y = cy + Math.sin(ak) * ry - 3.4;
        for (let d = -1; d <= 1; d++) if (q.isOpaque(x + d, y)) q.set(x + d, y, d === 0 ? PAL.white : PAL.water4);
      }
    }
  });
}

// ---------------------------------------------------------------- effects

function drawSlam(p: Canvas, o: Pose): void {
  if (o.slam <= 0) return;
  const cx = (o.nf[0] + o.ff[0]) / 2 + 2;
  const cy = GROUND - 2;
  const k = o.slam;
  layer(p, (q) => {
    // crown splash: tongues thrown up and forward from the impact
    for (const [dx, h, w] of [
      [-7, 7, 2.2],
      [-3, 11, 2.8],
      [1.5, 13, 3],
      [5, 10, 2.6],
      [6.2, 6, 2],
    ] as const) {
      const hh = h * k;
      q.stroke([[cx + dx, cy], [cx + dx * 1.2 + 1, cy - hh]], w, 1, PAL.water3);
    }
    q.ellipse(cx, cy, 6.5 * k + 2.5, 2.6, PAL.water3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (q.isOpaque(x, y) && !q.isOpaque(x, y - 1)) q.set(x, y, PAL.water4);
    q.disc(cx, cy - 2, 2.2 * k, PAL.white);
  });
}

/**
 * Water geysers blasting up out of the raised fists (roar): an aerated water3 column leaning
 * outward, light rim on the lit side, rising water4 streaks, a churning white/water4 foam crest that
 * spills outward. `collar` adds a crown of foam bursting round the top of the fist as it launches.
 */
function drawSpouts(p: Canvas, o: Pose): void {
  if (o.spout <= 0 && o.collar <= 0) return;
  for (const [f, near] of [
    [o.ff, false],
    [o.nf, true],
  ] as const) {
    const dir = near ? -1 : 1;
    const bx = f[0];
    const by = f[1] - (near ? 5 : 4.4);
    layer(p, (q) => {
      if (o.spout > 0) {
        const top = Math.max(3, by - 15 * o.spout);
        const lean = dir * 2 * o.spout;
        const tx = bx + lean;
        const col = new PixelCanvas(W, H);
        col.stroke([[bx, by + 1], [bx + lean * 0.3, lerp(by, top, 0.55)], [tx, top + 1.5]], 3, 4.4, PAL.water3);
        // crest: a mushroom of foam lobes, the outer one spilling over and down
        const r = 1.2 + 1.3 * o.spout;
        col.disc(tx, top + 0.8, r, PAL.water3);
        col.disc(tx + dir * r * 1.1, top + 1.9, r * 0.75, PAL.water3);
        col.disc(tx - dir * r * 0.8, top + 1.5, r * 0.6, PAL.water3);
        const src = col.clone();
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            if (!src.isOpaque(x, y)) continue;
            let c: number = PAL.water3;
            if (!src.isOpaque(x + 1, y)) c = PAL.water2;
            if (!src.isOpaque(x - 1, y)) c = PAL.water4;
            if (y <= top + r + 1) {
              // churning foam head: white caps, water4 body, water3 underside
              c = !src.isOpaque(x, y - 1) || frac((x * 0.6 + y * 0.8 + o.flow * 5) / 3) < 0.4 ? PAL.white : PAL.water4;
              if (!src.isOpaque(x, y + 1)) c = PAL.water3;
            } else {
              // streaks racing up the column
              const cxl = lerp(bx, tx, (by - y) / Math.max(1, by - top));
              if (Math.abs(x + 0.5 - cxl) < 1 && frac((y + o.flow * 12) / 4) < 0.35) c = PAL.white;
            }
            col.set(x, y, c);
          }
        q.blit(col, 0, 0);
      }
      if (o.collar > 0) {
        // crown splash: tongues of foam thrown up and out round the top of the fist
        const k = o.collar;
        const ring = new PixelCanvas(W, H);
        for (const [dx, h] of [
          [-4.2, 2.5],
          [-2.4, 4],
          [2.4, 4],
          [4.2, 2.5],
        ] as const) ring.stroke([[bx + dx * 0.7, by + 1.5], [bx + dx * (1 + 0.25 * k), by + 1.5 - h * k]], 1.8, 1, PAL.water4);
        ring.ellipse(bx, by + 1.5, 3.2 + k, 1.2, PAL.water4);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ring.isOpaque(x, y) && !ring.isOpaque(x, y - 1)) ring.set(x, y, PAL.white);
        q.blit(ring, 0, 0);
      }
    });
  }
}

/** Swoosh arc trailing the fists through the slam (effect pixels, drawn after the outline). */
function drawSmear(p: Canvas, o: Pose): void {
  if (!o.smear.length) return;
  const end: Pt = [(o.nf[0] + o.ff[0]) / 2, (o.nf[1] + o.ff[1]) / 2];
  const pts: Pt[] = [...o.smear, end];
  const n = 24;
  const path: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * (pts.length - 1);
    const k = Math.min(pts.length - 2, Math.floor(t));
    const f = t - k;
    path.push([lerp(pts[k][0], pts[k + 1][0], f), lerp(pts[k][1], pts[k + 1][1], f)]);
  }
  const fx = new PixelCanvas(W, H);
  fx.stroke(path, 1.5, 9, PAL.water2);
  fx.stroke(path.slice(n / 4).map(([x, y]) => [x - 1, y - 1] as Pt), 1, 5, PAL.water3);
  fx.stroke(path.slice((2 * n) / 3).map(([x, y]) => [x - 1, y - 2] as Pt), 0.5, 2, PAL.water4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (fx.isOpaque(x, y) && !p.isOpaque(x, y)) p.set(x, y, fx.get(x, y)!);
}

function drawBlobs(p: Canvas, o: Pose): void {
  if (!o.blobs.length) return;
  layer(p, (q) => {
    for (const [x, y, r] of o.blobs) q.disc(x, y, r, PAL.water2);
    shadeWater(q);
    for (const [x, y, r] of o.blobs) if (r > 1.4) q.set(x - 1, y - 1, PAL.white);
  });
}

function drawDrops(p: Canvas, drops: Drop[]): void {
  for (const d of drops) {
    const x = Math.round(d.x);
    const y = Math.round(d.y);
    if (d.s === 0) p.set(x, y, PAL.water4);
    else if (d.s === 1) p.set(x, y, PAL.white).set(x, y + 1, PAL.water3);
    else p.set(x, y - 1, PAL.water4).set(x, y, PAL.white).set(x - 1, y + 1, PAL.water3).set(x, y + 1, PAL.water4).set(x + 1, y + 1, PAL.water2).set(x, y + 2, PAL.water2);
  }
}

// ---------------------------------------------------------------- the golem

function drawGolem(p: Canvas, o: Pose): void {
  const R = rig(o);
  const nb: 1 | -1 = o.nBend !== 0 ? o.nBend : o.farFront ? 1 : -1;
  const fb: 1 | -1 = o.fBend !== 0 ? o.fBend : o.farFront ? 1 : -1;
  if (!o.farFront) drawArm(p, o, R.shF, o.ff, false, fb);
  drawFoamRing(p, o, false);
  drawWall(p, o, false);
  drawVortex(p, o);
  drawTorso(p, o);
  drawRing(p, o, -12.5, 7.5, 2, 0);
  drawRing(p, o, 7, 8, 3, 1);
  drawHead(p, o);
  if (o.farFront) drawArm(p, o, R.shF, o.ff, false, fb);
  drawArm(p, o, R.shN, o.nf, true, nb);
  drawFoamRing(p, o, true);
  drawWall(p, o, true);
  drawSpouts(p, o);
  drawSlam(p, o);
  drawBlobs(p, o);
  drawDrops(p, o.drops);
  p.outline(PAL.ink);
  drawSmear(p, o);
}

// ---------------------------------------------------------------- portrait (44×34)

function portrait(p: Canvas): void {
  // shallow sea: sunlit water above, caustic ripple bands, darker depths below
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 44; x++) {
      let col: number = y < 10 ? PAL.water2 : y < 12 && PixelCanvas.ditherAt(x, y, 8) ? PAL.water2 : PAL.water1;
      const cau = Math.sin(x * 0.5 + Math.sin(y * 0.5) * 1.6) + Math.sin(y * 0.8 - x * 0.25);
      if (cau > 1.45 && y < 10) col = PAL.water3;
      else if (cau > 1.55 && y < 22) col = PAL.water2;
      if (y > 26) col = y > 29 || PixelCanvas.ditherAt(x, y, 8) ? PAL.water0 : col;
      p.set(x, y, col);
    }
  const big = new PixelCanvas(W, H);
  drawGolem(big, P({ core: 1.7, nf: [13, 40], ff: [47, 38], face: 'roar', flow: 0.35 }));
  const ox = 10;
  const oy = 9;
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 44; x++) {
      const col = big.get(ox + x, oy + y);
      if (col !== null) p.set(x, y, col);
    }
  p.set(4, 14, PAL.water4).set(6, 9, PAL.water3).set(39, 12, PAL.water4).set(41, 7, PAL.water3);
}

// ---------------------------------------------------------------- export

const IMPACT_FRAME = 5;
const IMPACT = ANIMS.attack.poses[IMPACT_FRAME];

const art: MonsterArt = {
  id: 'tide_golem',
  w: W,
  h: H,
  anchorX: 30,
  anchorY: GROUND,
  hover: 0,
  muzzle: { x: Math.round((IMPACT.nf[0] + IMPACT.ff[0]) / 2 + 2), y: GROUND - 3 },
  core: (() => {
    const c = rig(N).core;
    return { x: Math.round(c[0]), y: Math.round(c[1]) };
  })(),
  anims: {
    idle: { frames: ANIMS.idle.poses.length, fps: ANIMS.idle.fps, loop: true },
    roar: { frames: ANIMS.roar.poses.length, fps: ANIMS.roar.fps, loop: false },
    attack: { frames: ANIMS.attack.poses.length, fps: ANIMS.attack.fps, loop: false },
    hit: { frames: ANIMS.hit.poses.length, fps: ANIMS.hit.fps, loop: false },
    guard: { frames: ANIMS.guard.poses.length, fps: ANIMS.guard.fps, loop: true },
  },
  attackImpactFrame: IMPACT_FRAME,
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number) {
    const poses = ANIMS[anim].poses;
    drawGolem(p, poses[Math.max(0, Math.min(poses.length - 1, frame))]);
  },
  portrait,
};

export default art;
