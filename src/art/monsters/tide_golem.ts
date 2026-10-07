// Gelgit Golemi (tide_golem) — WATER golem, 64×64.
//
// A hulking body of living sea water held together by ancient stone: a carved collar and waist
// ring, rune-carved bracelets on the forearms, and a coral-crusted stone face mask whose eye
// holes glow cyan. Facing right in 3/4. The torso rises out of a spinning waterspout that
// splashes into a foam ring on the ground; inside the body currents swirl around a glowing cyan
// core and bubbles rise. Water is shaded as a translucent liquid (lit body, deep interior,
// foam caps on every crest, specular glints). Parametric rig: every frame is a Pose (numbers);
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
  /** Gobs of body water knocked loose (hit): x, y, radius. */
  blobs: [number, number, number][];
  drops: Drop[];
}

const N: Pose = {
  bx: 30,
  by: 33,
  lean: 0,
  sx: 1,
  sy: 1,
  hdx: 0,
  hdy: 0,
  face: 'n',
  nf: [10, 48],
  ff: [51, 47],
  farFront: false,
  nBend: 0,
  fBend: 0,
  core: 1,
  flow: 0,
  foam: 1,
  wall: 0,
  slam: 0,
  smear: [],
  spout: 0,
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
    [0.5, 54, 52],
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

  // Roar: sink and gather (anticipation) → surge up, both arms thrown up and out, water erupts
  // off the shoulders and fists, the mask's eyes and mouth blaze → hold → settle.
  roar: {
    fps: 10,
    loop: false,
    poses: [
      P({ flow: 0 }),
      P({ by: 36, sy: 0.92, sx: 1.06, lean: 0.08, nf: [19, 50], ff: [42, 50], core: 0.6, foam: 1.4, hdy: 1, flow: 0.1 }),
      P({ by: 31, sy: 1.06, sx: 0.96, lean: -0.08, nf: [10, 22], ff: [52, 20], core: 1.6, foam: 1.6, face: 'roar', hdx: -1, hdy: -1, flow: 0.2 }),
      P({ by: 31, sy: 1.08, sx: 0.95, lean: -0.12, nf: [9, 17], ff: [53, 15], core: 2, foam: 2, face: 'roar', hdx: -1, hdy: -2, flow: 0.3, spout: 0.6, drops: sprayUp(0.25, ROAR_SPRAY) }),
      P({ by: 31, sy: 1.08, sx: 0.95, lean: -0.13, nf: [9, 16], ff: [53, 14], core: 2, foam: 1.8, face: 'roar', hdx: -1, hdy: -2, flow: 0.4, spout: 1, drops: sprayUp(0.5, ROAR_SPRAY) }),
      P({ by: 31, sy: 1.07, sx: 0.95, lean: -0.12, nf: [10, 17], ff: [52, 15], core: 1.9, foam: 1.6, face: 'roar', hdx: -1, hdy: -2, flow: 0.5, spout: 0.85, drops: sprayUp(0.75, ROAR_SPRAY) }),
      P({ by: 31, sy: 1.06, sx: 0.96, lean: -0.1, nf: [10, 18], ff: [52, 16], core: 1.8, foam: 1.4, face: 'roar', hdx: -1, hdy: -1, flow: 0.6, spout: 0.45, drops: sprayUp(1, ROAR_SPRAY) }),
      P({ by: 32, sy: 1.02, lean: -0.03, nf: [12, 30], ff: [50, 28], core: 1.5, foam: 1.2, flow: 0.7 }),
      P({ by: 34, sy: 0.97, sx: 1.03, nf: [11, 46], ff: [50, 45], core: 1.2, foam: 1.3, flow: 0.8 }),
      P({ flow: 0.9 }),
    ],
  },

  // Attack ("Dalga Darbesi"): both arms heave overhead, the body leans back and the core charges
  // (anticipation) → slam forward and down → IMPACT: fists hit the ground in front, a burst of
  // foam (muzzle = fists, the floor wave starts here) → follow-through → recover.
  attack: {
    fps: 12,
    loop: false,
    poses: [
      P({ flow: 0 }),
      P({ by: 34, sy: 0.95, sx: 1.04, lean: 0.06, nf: [20, 50], ff: [42, 50], core: 1.2, flow: 0.1 }),
      P({ by: 31, sy: 1.07, sx: 0.96, lean: -0.16, nf: [13, 10], ff: [35, 8], nBend: 1, fBend: -1, core: 1.6, flow: 0.2, hdx: -1, hdy: -1 }),
      P({ by: 30, sy: 1.09, sx: 0.95, lean: -0.2, nf: [12, 8], ff: [35, 7], nBend: 1, fBend: -1, core: 2, flow: 0.3, hdx: -1, hdy: -1, face: 'roar' }),
      P({ by: 32, sy: 1.04, lean: 0.14, nf: [44, 17], ff: [50, 15], core: 2, flow: 0.4, face: 'roar', smear: [[20, 11], [27, 6], [35, 5], [41, 9]] }),
      P({ by: 37, sy: 0.92, sx: 1.07, lean: 0.36, nf: [47, 55], ff: [54, 54], core: 1.8, flow: 0.5, face: 'roar', slam: 1, foam: 1.8 }),
      P({ by: 37, sy: 0.93, sx: 1.06, lean: 0.34, nf: [47, 55], ff: [54, 54], core: 1.5, flow: 0.6, slam: 0.6, foam: 1.6,
        drops: [{ x: 57, y: 44, s: 2 }, { x: 60, y: 49, s: 1 }, { x: 44, y: 45, s: 1 }, { x: 59, y: 39, s: 0 }] }),
      P({ by: 35, sy: 0.97, lean: 0.18, nf: [38, 52], ff: [50, 51], core: 1.3, flow: 0.7, foam: 1.3, drops: [{ x: 60, y: 47, s: 1 }, { x: 61, y: 55, s: 0 }] }),
      P({ by: 33, lean: 0.04, nf: [14, 49], ff: [50, 48], core: 1.1, flow: 0.8 }),
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
      P({ bx: 31, lean: 0.05, sx: 0.98, sy: 1.02, nf: [11, 48], ff: [52, 47], core: 0.9, flow: 0.45, drops: [{ x: 58, y: 36, s: 0 }, { x: 58, y: 50, s: 0 }] }),
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
 * Water material with volume: each pixel compares how far it is from the silhouette edge toward
 * the light (top-left) and away from it, giving a lit side (water3), body (water2) and shadow
 * side (water1/water0). Crests along the top edge get foam (water4) with drifting white caps.
 */
function shadeWater(q: Canvas, foamPh: number, dim = false): void {
  const src = q.clone();
  const R = 7;
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      if (!src.isOpaque(x, y)) continue;
      const dl = Math.min(reach(src, x, y, -1, 0, R), reach(src, x, y, 0, -1, R), reach(src, x, y, -1, -1, R) * 1.4);
      const ds = Math.min(reach(src, x, y, 1, 0, R), reach(src, x, y, 0, 1, R), reach(src, x, y, 1, 1, R) * 1.4);
      const t = dl / (dl + ds);
      // translucent liquid: lit body toward the light, deep interior, reflected light on the far rim
      let c: number;
      if (dim) c = t < 0.4 ? PAL.water1 : PAL.water0;
      else c = t < 0.34 ? PAL.water2 : PAL.water1;
      if (ds <= 1) c = dim ? PAL.water1 : PAL.water2;
      if (dl <= 1) c = dim ? PAL.water2 : PAL.water3;
      else if (dl <= 2 && t < 0.3 && !dim) c = PAL.water3;
      if (!src.isOpaque(x, y - 1)) {
        // foam crest along the top: white caps drift with the flow phase
        const k = frac((x + foamPh * 12) / 6);
        c = dim ? PAL.water2 : k < 0.55 ? PAL.water4 : PAL.water3;
        if (!dim && k < 0.2 && !src.isOpaque(x - 1, y - 1)) c = PAL.white;
      }
      q.set(x, y, c);
    }
}

/** A curved specular glint inside the upper-left of a round water form. */
function glint(q: Canvas, cx: number, cy: number, r: number, dim = false): void {
  if (dim) return;
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI * 1.08 + (i / 6) * 0.55 * Math.PI;
    const x = cx + Math.cos(a) * r * 0.62;
    const y = cy + Math.sin(a) * r * 0.62;
    if (q.isOpaque(x, y)) q.set(x, y, i === 3 || i === 4 ? PAL.white : PAL.water4);
  }
}

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
    shF: T(11, -9),
    waist: [wx, wy],
    core: T(1, -3),
    head: T(6 + o.hdx, -14 + o.hdy),
  };
}

// ---------------------------------------------------------------- parts

const UPPER = 9.5;
const FORE = 10;

function armPts(sh: Pt, fist: Pt, bend: 1 | -1): { el: Pt; wr: Pt } {
  // the fist center sits ~4px past the wrist
  const dx = fist[0] - sh[0];
  const dy = fist[1] - sh[1];
  const d = Math.hypot(dx, dy) || 1;
  const wrT: Pt = [fist[0] - (dx / d) * 3.5, fist[1] - (dy / d) * 3.5];
  const [el, wr] = ik(sh[0], sh[1], wrT[0], wrT[1], UPPER, FORE, bend);
  return { el, wr };
}

function drawArm(p: Canvas, o: Pose, sh: Pt, fist: Pt, near: boolean, bend: 1 | -1): void {
  const { el, wr } = armPts(sh, fist, bend);
  const dim = !near;
  // water limb: slim upper arm, forearm swelling into a heavy fist
  layer(p, (q) => {
    q.stroke([sh, el], near ? 7 : 6, near ? 6 : 5, PAL.water2);
    q.stroke([el, wr], near ? 6 : 5, near ? 7.5 : 6.5, PAL.water2);
    q.disc(fist[0], fist[1], near ? 5.6 : 5, PAL.water2);
    shadeWater(q, o.flow + (near ? 0 : 0.5), dim);
    // a current running down the arm into the fist
    clip(q, (t) => {
      for (let i = 0; i < 2; i++) {
        const k = frac(o.flow * 2 + i * 0.5 + (near ? 0 : 0.25));
        const a: Pt = k < 0.5 ? [lerp(sh[0], el[0], k * 2), lerp(sh[1], el[1], k * 2)] : [lerp(el[0], wr[0], k * 2 - 1), lerp(el[1], wr[1], k * 2 - 1)];
        t.set(a[0] - 1, a[1] - 1, dim ? PAL.water2 : PAL.water4);
        t.set(a[0] - 1, a[1], dim ? PAL.water2 : PAL.water3);
      }
    });
    glint(q, fist[0], fist[1], near ? 5.6 : 5, dim);
  });
  // stone rings: an armband on the upper arm and a heavy bracelet at the wrist
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
  band([lerp(el[0], wr[0], 0.5), lerp(el[1], wr[1], 0.5)], [lerp(el[0], wr[0], 0.72), lerp(el[1], wr[1], 0.72)], near ? 8.5 : 7.5, true);
}

function drawVortex(p: Canvas, o: Pose): void {
  const R = rig(o);
  const top = R.waist;
  const cx = lerp(top[0], o.bx, 0.5);
  layer(p, (q) => {
    // spinning waterspout: pinched in the middle, flaring into the ground; the bands wrap around
    // the column (cylindrical phase) and travel with the flow
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
        let c: number = PAL.water2;
        if (band < 0.2) c = u < 0.3 ? PAL.water3 : PAL.water2;
        else if (band > 0.7) c = PAL.water1;
        if (band < 0.07 && u < -0.1 && u > -0.75) c = PAL.water4;
        if (u > 0.7) c = band < 0.2 ? PAL.water2 : PAL.water1;
        if (u < -0.8) c = PAL.water3;
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

/** Torso water mass: barrel chest, humped shoulders, tapering waist (torso-local shapes). */
function drawTorso(p: Canvas, o: Pose): void {
  const R = rig(o);
  const { T } = R;
  layer(p, (q) => {
    const blob = (x: number, y: number, rx: number, ry: number) => {
      const [cx, cy] = T(x, y);
      q.ellipse(cx, cy, rx * o.sx, ry * o.sy, PAL.water2);
    };
    blob(0, -3, 12.5, 8.5);
    blob(0, 5, 7.5, 6);
    blob(-10, -8, 6, 5.5);
    blob(10.5, -9, 5.5, 5);
    blob(1, -11, 8, 4);
    shadeWater(q, o.flow);
    {
      const [gx, gy] = T(-1, -4);
      glint(q, gx, gy, 11);
      const [sx2, sy2] = T(-10, -8);
      glint(q, sx2, sy2, 5.5);
    }
    const base = q.clone();
    // internal currents swirling around the core (bright on the lit side, dark undertow opposite)
    clip(q, (t) => {
      const [cx, cy] = R.core;
      for (let k = 0; k < 2; k++) {
        const rr = 5.5 + k * 3;
        const a0 = o.flow * TAU * (k ? -1 : 1) + k * 2.6;
        const n = 14;
        for (let i = 0; i <= n; i++) {
          const a = a0 + (i / n) * 1.9;
          const x = cx + Math.cos(a) * rr * 1.2;
          const y = cy + Math.sin(a) * rr * 0.8;
          const under = base.get(x, y);
          if (under === PAL.water1 || under === PAL.water0) t.set(x, y, i > n - 3 ? PAL.water3 : PAL.water2);
          else t.set(x, y, i > n - 3 ? PAL.water4 : PAL.water3);
        }
      }
      // rising bubbles
      for (let k = 0; k < 3; k++) {
        const ph = frac(o.flow + k / 3);
        const [x, y] = T(-5 + k * 5, 8 - ph * 18);
        t.set(x, y, PAL.water4);
      }
    });
    // keep silhouette rims crisp on top of the currents
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!base.isOpaque(x, y)) continue;
        if (!base.isOpaque(x, y - 1) || !base.isOpaque(x + 1, y) || !base.isOpaque(x, y + 1) || !base.isOpaque(x - 1, y)) q.set(x, y, base.get(x, y)!);
      }
    // glowing core seen through the water
    const [cx, cy] = R.core;
    const g = o.core;
    clip(q, (t) => {
      for (let y = Math.floor(cy - 7); y <= cy + 7; y++)
        for (let x = Math.floor(cx - 7); x <= cx + 7; x++) {
          const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.1);
          if (d < 0.9 + 0.45 * g) t.set(x, y, g > 1.4 ? PAL.white : PAL.cyan4);
          else if (d < 1.8 + 0.5 * g) t.set(x, y, PAL.cyan4);
          else if (d < 2.6 + 0.6 * g) t.set(x, y, PAL.cyan3);
          else if (d < 3.4 + 0.8 * g && PixelCanvas.ditherAt(x, y, 9)) t.set(x, y, PAL.cyan2);
          else if (d < 4.6 + g && PixelCanvas.ditherAt(x, y, 3)) t.set(x, y, PAL.cyan1);
        }
    });
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
      if (i === 3 || i === 4) {
        if (runes > 0) q.set(xi, yi, o.core > 1.5 ? PAL.cyan4 : PAL.cyan3);
      } else if (q.isOpaque(xi, yi)) q.set(xi, yi, PAL.stone0);
    }
  });
}

// ---------------------------------------------------------------- head: water dome + stone mask

// Mask (11×11), facing right in 3/4: heavy brow, deep sockets, nose ridge, a carved mouth with
// teeth grooves. Keys: 0–4 stone ramp, e/f/g eye glow, m mouth (glows when roaring), b barnacle.
const MASK = [
  '..2333332..',
  '.234444432.',
  '.2344444321',
  '.0000300001',
  '.0fe030fg01',
  '.1000300011',
  '.b233433221',
  '.12m0m0m21.',
  '.12mmmmm21.',
  '..1233321..',
  '...11111...',
];

function drawHead(p: Canvas, o: Pose): void {
  const R = rig(o);
  const [hx, hy] = R.head;
  const x0 = Math.round(hx - 5);
  const y0 = Math.round(hy - 5);
  const sway = Math.sin((o.flow + 0.2) * TAU);
  // water hood behind the mask, swept back into a curling wave crest
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
    shadeWater(q, o.flow + 0.3);
    q.set(x0 - 3 + sway, y0 - 2, PAL.white).set(x0 - 2 + sway, y0 - 2, PAL.water4);
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
      q.set(x0 + 2, y0 + 4, PAL.stone0).set(x0 + 3, y0 + 4, PAL.stone0).set(x0 + 2, y0 + 5, PAL.cyan2).set(x0 + 3, y0 + 5, PAL.cyan1);
      q.set(x0 + 7, y0 + 4, PAL.stone0).set(x0 + 8, y0 + 4, PAL.stone0).set(x0 + 7, y0 + 5, PAL.cyan1);
    }
    if (roar) q.set(x0 + 4, y0 + 8, PAL.cyan4).set(x0 + 5, y0 + 8, PAL.cyan4);
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
    q.set(x0 + 9, y0 + 2, PAL.mag3).set(x0 + 9, y0 + 1, PAL.mag2);
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
    shadeWater(q, o.flow * 2, !front);
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

/** Water geysers shooting up from the raised fists: a widening column capped by a foam head. */
function drawSpouts(p: Canvas, o: Pose): void {
  if (o.spout <= 0) return;
  for (const [f, near] of [
    [o.nf, true],
    [o.ff, false],
  ] as const) {
    layer(p, (q) => {
      const h = 10 * o.spout;
      const top = Math.max(6, f[1] - 4 - h);
      const sway = Math.sin((o.flow + (near ? 0 : 0.5)) * TAU) * 1;
      const tx = f[0] + sway;
      q.stroke([[f[0], f[1] - 2], [lerp(f[0], tx, 0.5), lerp(f[1] - 2, top, 0.5)], [tx, top + 1]], 3, 5, PAL.water2);
      // frothy head: a cluster of foam lobes that churns with the flow
      const ph = o.flow * TAU * 2;
      const r = 1.6 + 1.1 * o.spout;
      q.disc(tx, top, r + 0.4, PAL.water2);
      q.disc(tx - r * 0.9, top + 0.6 + Math.sin(ph) * 0.5, r * 0.75, PAL.water2);
      q.disc(tx + r * 0.9, top + 0.6 + Math.cos(ph) * 0.5, r * 0.75, PAL.water2);
      shadeWater(q, o.flow);
      // churning foam on the head, streaks rising in the column
      for (let y = Math.floor(top - r - 1); y <= top + 1; y++)
        for (let x = Math.floor(tx - r * 2); x <= tx + r * 2; x++)
          if (q.isOpaque(x, y) && !q.isOpaque(x, y - 1)) q.set(x, y, frac((x + y + o.flow * 6) / 3) < 0.5 ? PAL.white : PAL.water4);
      clip(q, (t) => {
        const k = Math.floor(o.flow * 9) % 3;
        for (let y = Math.floor(top) + 3 + k; y < f[1] - 4; y += 3) t.set(Math.round(lerp(tx, f[0], (y - top) / (f[1] - top))) - 1, y, PAL.water4);
      });
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
    shadeWater(q, o.flow);
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
  core: { x: 31, y: 30 },
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
