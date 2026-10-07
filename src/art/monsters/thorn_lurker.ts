// Dikenli Pusucu (thorn_lurker) — EARTH carnivorous plant, 48×48.
//
// A fat flytrap bulb half-buried in a mound of earth, facing right. Its upper half is a hinged
// lid (hinge at the back-left): it lifts to reveal a crimson maw lined with white teeth, a pink
// tongue and a dark throat. A crest of purple-pink thorns runs over the lid, small glowing eye
// spots sit above the lip, a rosette of leaves splays on the ground and two thorny vines rise out
// of the soil — the front one is the whip ("Diken Kırbacı").
//
// Parametric rig: every frame is a Pose (numbers). The lid is rasterized by inverse rotation
// around the hinge so it stays crisp at any angle; vines are integrated curves (base angle +
// curvature + tip curl) drawn as tapered strokes with highlight strokes and thorns. Paint order:
// back vine → back leaves → jaw → maw (cavity, tongue, teeth) → lid → soil mound + roots → front
// leaves → front vine → particles → outline → glow (eyes, maw).

import { PAL } from '../palette';
import { PixelCanvas, type Pt } from '../pixel';
import type { MonsterAnim, MonsterArt } from '../types';

const W = 48;
const H = 48;
const TAU = Math.PI * 2;
const GROUND = 44;
/** Hinge of the lid at rest (frame px) and bulb radii. */
const HX = 10.5;
const HY = 33.5;
const RX = 13;
const RY = 11;

type Canvas = PixelCanvas;

// ---------------------------------------------------------------- pose

interface Vine {
  /** Root (frame px, in the soil). */
  x: number;
  y: number;
  /** Base angle (rad, 0 = right, -π/2 = up), curvature (rad/px), tip curl (rad/px over the last third), length. */
  a: number;
  c: number;
  curl: number;
  len: number;
  /** Where along the vine (0..1) the tip curl starts (default 0.62). */
  k0?: number;
}

interface Bit {
  x: number;
  y: number;
  /** leaf | thorn | spore | drip */
  k: 'leaf' | 'thorn' | 'spore' | 'drip';
  /** rotation-ish variant 0..3 */
  v: number;
}

interface Pose {
  /** Body offset from rest (px). */
  bx: number;
  by: number;
  /** Lid angle (rad, negative = open). */
  lid: number;
  /** Jaw tremble (px, applied to the lid only). */
  jit: number;
  vF: Vine;
  vB: Vine;
  /** Vines wrapped around the bulb in front (guard). */
  wrap: boolean;
  /** Thorn length scale (bristle). */
  thorn: number;
  /** Eye glow 0..2 (0 = shut). */
  eye: number;
  /** Maw glow 0..2 (inner mouth brightness). */
  maw: number;
  /** Leaf flap (-1 droop .. 1 lifted). */
  flap: number;
  /** Whip smear: previous tip positions (oldest first). */
  smear: Pt[];
  /** Whip-crack flash at the vine tip 0..1. */
  crack: number;
  bits: Bit[];
}

const VF0: Vine = { x: 36, y: 41, a: -1.62, c: 0.018, curl: 0.3, len: 24 };
const VB0: Vine = { x: 11, y: 41, a: -1.68, c: -0.025, curl: -0.3, len: 19 };

const N: Pose = {
  bx: 0,
  by: 0,
  lid: -0.06,
  jit: 0,
  vF: VF0,
  vB: VB0,
  wrap: false,
  thorn: 1,
  eye: 1,
  maw: 1,
  flap: 0,
  smear: [],
  crack: 0,
  bits: [],
};

const P = (o: Partial<Pose>): Pose => ({ ...N, ...o });
const vf = (o: Partial<Vine>): Vine => ({ ...VF0, ...o });
const vb = (o: Partial<Vine>): Vine => ({ ...VB0, ...o });

// ---------------------------------------------------------------- animations

function idlePose(f: number, n: number): Pose {
  const t = f / n;
  const s = Math.sin(t * TAU); // pulse: + = swell (lid lifts, maw breathes)
  const lagF = Math.sin((t - 0.12) * TAU);
  const lagB = Math.sin((t - 0.3) * TAU);
  return P({
    by: s > 0.6 ? -1 : 0,
    lid: -0.05 - 0.07 * Math.max(0, s),
    vF: vf({ a: VF0.a + 0.07 * lagF, c: VF0.c - 0.008 * lagF, curl: VF0.curl + 0.06 * lagF }),
    vB: vb({ a: VB0.a - 0.06 * lagB, c: VB0.c + 0.008 * lagB, curl: VB0.curl - 0.06 * lagB }),
    eye: f === 6 ? 0 : 1,
    maw: 1 + 0.5 * s,
    flap: lagB > 0.4 ? 1 : 0,
    bits: idleDrip(t),
  });
}

/** A bead of nectar swells on the lip and drops into the soil. */
function idleDrip(t: number): Bit[] {
  if (t < 0.375) return [];
  const k = (t - 0.375) / 0.625;
  return [{ x: 33, y: 36 + Math.round(k * k * 7), k: 'drip', v: k < 0.25 ? 0 : 1 }];
}

const LEAF_BURST = (k: number): Bit[] =>
  [
    [38, 30, 1.2, -1.6, 0],
    [8, 30, -1.3, -1.3, 1],
    [42, 38, 1.5, -0.6, 2],
    [4, 37, -1.4, -0.5, 3],
  ].map(([x, y, vx, vy, v]) => ({ x: x + vx * k * 6, y: y + vy * k * 8 + k * k * 6, k: 'leaf' as const, v }));

const SPORES = (k: number): Bit[] =>
  [
    [30, 22, 0.6, -1],
    [27, 18, 0.2, -1.2],
    [34, 21, 1, -0.6],
    [24, 20, -0.3, -1.1],
    [32, 16, 0.5, -1.3],
  ].map(([x, y, vx, vy], i) => ({ x: x + vx * k * 9, y: y + vy * k * 9, k: 'spore' as const, v: i % 2 }));

const ANIMS: Record<MonsterAnim, { fps: number; loop: boolean; poses: Pose[] }> = {
  idle: { fps: 8, loop: true, poses: Array.from({ length: 8 }, (_, f) => idlePose(f, 8)) },

  // Roar: clench and sink (anticipation, vines curled in) → the pod bursts open, vines fling out
  // wide, thorns bristle, spores spray → maw held wide, trembling → snap shut → settle.
  roar: {
    fps: 10,
    loop: false,
    poses: [
      P({}),
      P({ by: 1, lid: 0.04, vF: vf({ a: -1.5, c: -0.01, curl: 0.42, len: 18 }), vB: vb({ a: -1.7, c: 0.01, curl: -0.42, len: 15 }), thorn: 0.6, flap: -1, eye: 1.4 }),
      P({ by: -1, lid: -0.62, vF: vf({ a: -1.08, c: 0.0, curl: 0.08, len: 20 }), vB: vb({ a: -2.05, c: 0.0, curl: -0.08, len: 17 }), thorn: 1.5, flap: 1, eye: 2, maw: 1.8, bits: SPORES(0.1) }),
      P({ by: -1, lid: -0.86, jit: -1, vF: vf({ a: -1.02, c: -0.004, curl: 0.0, len: 18 }), vB: vb({ a: -2.1, c: 0.004, curl: 0.0, len: 17 }), thorn: 1.6, flap: 1, eye: 2, maw: 2, bits: SPORES(0.35) }),
      P({ by: -1, lid: -0.82, jit: 0, vF: vf({ a: -1.04, c: 0.004, curl: 0.05, len: 18 }), vB: vb({ a: -2.08, c: -0.004, curl: -0.05, len: 17 }), thorn: 1.6, flap: 1, eye: 2, maw: 2, bits: SPORES(0.6) }),
      P({ by: -1, lid: -0.86, jit: -1, vF: vf({ a: -1.02, c: -0.004, curl: 0.0, len: 18 }), vB: vb({ a: -2.1, c: 0.004, curl: 0.0, len: 17 }), thorn: 1.6, flap: 1, eye: 2, maw: 2, bits: SPORES(0.85) }),
      P({ lid: -0.45, vF: vf({ a: -1.25, c: 0.01, curl: 0.15, len: 21 }), vB: vb({ a: -1.9, c: -0.01, curl: -0.15, len: 18 }), thorn: 1.3, eye: 1.6, maw: 1.5 }),
      P({ by: 1, lid: 0.04, vF: vf({ curl: 0.36 }), vB: vb({ curl: -0.36 }), thorn: 1.1, flap: -1, eye: 1.3, bits: LEAF_BURST(0.2).slice(0, 2) }),
      P({}),
    ],
  },

  // Attack ("Diken Kırbacı"): the whip vine rears up and arches back over the pod (anticipation,
  // 2 frames, the maw snarls) → it lashes forward (smear) → IMPACT: vine extended toward the
  // target, tip at the muzzle, thorns flung → overshoot down → retract → settle.
  attack: {
    fps: 12,
    loop: false,
    poses: [
      P({}),
      P({ bx: -1, lid: -0.18, vF: vf({ a: -1.62, c: -0.004, curl: -0.08, len: 25, k0: 0.4 }), vB: vb({ a: -1.85 }), thorn: 1.2, eye: 1.4, maw: 1.3 }),
      P({ bx: -1, by: 1, lid: -0.28, vF: vf({ a: -1.62, c: -0.005, curl: -0.1, len: 27, k0: 0.35 }), vB: vb({ a: -1.95, curl: -0.36 }), thorn: 1.4, eye: 1.8, maw: 1.5 }),
      P({ bx: 0, lid: -0.36, vF: vf({ a: -1.6, c: 0.035, curl: 0.0, len: 24 }), thorn: 1.4, eye: 2, maw: 1.6,
        smear: [[21, 18], [26, 13], [33, 11]] }),
      P({ bx: 1, lid: -0.5, vF: vf({ a: -1.0, c: -0.01, curl: -0.02, len: 19 }), vB: vb({ a: -1.85, curl: -0.15 }), thorn: 1.5, eye: 2, maw: 2, crack: 1,
        smear: [[33, 12], [39, 13], [43, 18]],
        bits: [{ x: 45, y: 21, k: 'thorn', v: 0 }, { x: 46, y: 31, k: 'thorn', v: 1 }, { x: 41, y: 19, k: 'thorn', v: 2 }] }),
      P({ bx: 1, lid: -0.3, vF: vf({ a: -0.62, c: 0.03, curl: 0.1, len: 12 }), thorn: 1.3, eye: 1.6, maw: 1.5, crack: 0.5,
        bits: [{ x: 46, y: 18, k: 'thorn', v: 0 }, { x: 46, y: 28, k: 'thorn', v: 1 }, { x: 43, y: 14, k: 'thorn', v: 2 }, { x: 45, y: 40, k: 'leaf', v: 1 }] }),
      P({ bx: 0, lid: -0.15, vF: vf({ a: -1.2, c: 0.02, curl: 0.2, len: 18 }), eye: 1.3, maw: 1.2, bits: [{ x: 46, y: 42, k: 'leaf', v: 2 }] }),
      P({ lid: -0.08, vF: vf({ a: -1.5, c: 0.02, curl: 0.32, len: 22 }) }),
      P({}),
    ],
  },

  // Hit: knocked back and squashed into the soil, lid clamps shut, eyes squeezed, vines flail
  // back, torn leaves fly.
  hit: {
    fps: 10,
    loop: false,
    poses: [
      P({ bx: -3, by: 1, lid: 0.05, eye: 0, maw: 0.4, thorn: 0.8, vF: vf({ a: -1.8, c: -0.05, curl: -0.15, len: 22 }), vB: vb({ a: -2.05, c: -0.03, curl: -0.3 }), flap: -1,
        bits: [{ x: 38, y: 24, k: 'leaf', v: 0 }, { x: 41, y: 31, k: 'leaf', v: 2 }, { x: 35, y: 19, k: 'leaf', v: 1 }, { x: 42, y: 22, k: 'thorn', v: 0 }] }),
      P({ bx: -2, lid: 0.02, eye: 0, maw: 0.6, thorn: 0.9, vF: vf({ a: -1.8, c: -0.01, curl: 0.0, len: 23 }), vB: vb({ a: -2.15, c: -0.03, curl: -0.3 }),
        bits: [{ x: 40, y: 20, k: 'leaf', v: 1 }, { x: 43, y: 28, k: 'leaf', v: 3 }, { x: 36, y: 14, k: 'leaf', v: 2 }, { x: 44, y: 18, k: 'thorn', v: 1 }] }),
      P({ bx: -1, lid: -0.03, eye: 0.8, vF: vf({ a: -1.55, c: 0.03, curl: 0.2 }), bits: [{ x: 42, y: 18, k: 'leaf', v: 3 }, { x: 43, y: 30, k: 'leaf', v: 0 }, { x: 38, y: 11, k: 'leaf', v: 1 }] }),
      P({ bits: [{ x: 43, y: 23, k: 'leaf', v: 2 }, { x: 41, y: 13, k: 'leaf', v: 0 }] }),
    ],
  },

  // Guard: the pod is clamped shut and sunk lower into the soil; both vines wrap around it in
  // front like a thorny cage, eyes half-lit; a slow, tight pulse.
  guard: {
    fps: 4,
    loop: true,
    poses: [0, 1, 2, 3].map((f) => {
      const s = Math.sin((f / 4) * TAU);
      const k = s > 0.5 ? 1 : 0;
      return P({
        by: 2,
        lid: 0.03,
        wrap: true,
        thorn: 1.2 + 0.2 * s,
        eye: 0.7 + 0.3 * s,
        maw: 0.3,
        flap: -1,
        vF: { x: 37, y: 43, a: -2.42 - 0.03 * k, c: 0.0, curl: -0.34, len: 24, k0: 0.55 },
        vB: { x: 10, y: 43, a: -0.72 + 0.03 * k, c: 0.0, curl: 0.34, len: 24, k0: 0.55 },
      });
    }),
  },
};

// ---------------------------------------------------------------- helpers

function layer(p: Canvas, fn: (q: Canvas) => void, sep: number | null = PAL.leaf0): void {
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

/** Integrated vine path: points every ~1px plus the tangent angle at each. */
function vinePath(v: Vine, dx: number, dy: number): { pts: Pt[]; ang: number[] } {
  const pts: Pt[] = [[v.x + dx, v.y + dy]];
  const ang: number[] = [v.a];
  let a = v.a;
  let x = v.x + dx;
  let y = v.y + dy;
  const n = Math.max(2, Math.round(v.len));
  for (let i = 1; i <= n; i++) {
    const f = i / n;
    const k0 = v.k0 ?? 0.62;
    a += v.c + (f > k0 ? v.curl * ((f - k0) / (1 - k0)) * 1.6 : 0);
    x += Math.cos(a);
    y += Math.sin(a);
    pts.push([x, y]);
    ang.push(a);
  }
  return { pts, ang };
}

/** Thorn: small triangle at `b` pointing along `dir`, base width ~2. */
function thorn(q: Canvas, b: Pt, dir: number, len: number): void {
  if (len < 0.8) return;
  const ux = Math.cos(dir);
  const uy = Math.sin(dir);
  const tip: Pt = [b[0] + ux * len, b[1] + uy * len];
  q.poly([[b[0] - uy * 1.1, b[1] + ux * 1.1], tip, [b[0] + uy * 1.1, b[1] - ux * 1.1]], PAL.mag2);
  q.set(Math.floor(tip[0] - ux * 0.5), Math.floor(tip[1] - uy * 0.5), PAL.mag3);
}

function drawVine(q: Canvas, v: Vine, dx: number, dy: number, thornK: number, w0 = 3.4): Pt {
  const { pts, ang } = vinePath(v, dx, dy);
  const n = pts.length - 1;
  // thorns first (behind the stem), alternating sides, slanted toward the tip
  for (let i = 3; i < n - 1; i += 3) {
    const side = (i / 3) % 2 === 0 ? 1 : -1;
    const a = ang[i] + side * (Math.PI / 2 - 0.55);
    const f = i / n;
    thorn(q, pts[i], a, (2.6 - f * 1.4) * thornK);
  }
  q.stroke(pts, w0, 1, PAL.leaf1);
  // lit ridge: the side facing the top-left light
  const lit: Pt[] = pts.slice(0, Math.max(2, Math.round(n * 0.8))).map(([x, y], i) => {
    const a = ang[i];
    let nx = -Math.sin(a);
    let ny = Math.cos(a);
    if (nx + ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    return [x + nx * 0.7, y + ny * 0.7];
  });
  q.stroke(lit, Math.max(1, w0 - 1.6), 1, PAL.leaf2);
  q.stroke(lit.slice(0, Math.max(2, Math.round(lit.length * 0.55))), 1, 1, PAL.leaf3);
  return pts[n];
}

/** A leaf blade from `b` toward angle `a`, length `l`, half-width `w`. */
function leaf(q: Canvas, b: Pt, a: number, l: number, w: number, dark: boolean): void {
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const nx = -uy;
  const ny = ux;
  const pts: Pt[] = [];
  const K = 8;
  for (let i = 0; i <= K; i++) {
    const f = i / K;
    const ww = Math.sin(f * Math.PI) * w * (1 - f * 0.25);
    pts.push([b[0] + ux * l * f + nx * ww, b[1] + uy * l * f + ny * ww]);
  }
  for (let i = K; i >= 0; i--) {
    const f = i / K;
    const ww = Math.sin(f * Math.PI) * w * (1 - f * 0.25);
    pts.push([b[0] + ux * l * f - nx * ww, b[1] + uy * l * f - ny * ww]);
  }
  q.poly(pts, dark ? PAL.leaf1 : PAL.leaf2);
  // the half facing up gets the light
  const up = ny < 0 ? 1 : -1;
  const half: Pt[] = [];
  for (let i = 0; i <= K; i++) {
    const f = i / K;
    const ww = Math.sin(f * Math.PI) * w * (1 - f * 0.25) * up;
    half.push([b[0] + ux * l * f + nx * ww, b[1] + uy * l * f + ny * ww]);
  }
  for (let i = K; i >= 0; i--) half.push([b[0] + ux * l * (i / K), b[1] + uy * l * (i / K)]);
  q.poly(half, dark ? PAL.leaf2 : PAL.leaf3);
  // midrib
  q.line(b[0] + ux, b[1] + uy, b[0] + ux * l * 0.8, b[1] + uy * l * 0.8, dark ? PAL.leaf1 : PAL.leaf2);
}

// ---------------------------------------------------------------- the pod

/** Is lid-local (u, v) inside the lid dome? (v ≤ 0 is above the seam) */
const inDome = (u: number, v: number, grow = 0) => ((u - RX + 0.5) / (RX + grow)) ** 2 + (v / (RY + grow)) ** 2 <= 1;

function drawPod(p: Canvas, o: Pose): void {
  const hx = HX + o.bx;
  const hy = HY + o.by;
  const c = Math.cos(o.lid);
  const s = Math.sin(o.lid);
  /** lid-local → frame */
  const L = (u: number, v: number): Pt => [hx + u * c - v * s, hy + u * s + v * c + o.jit * (u / RX) * 0.5];
  /** frame → lid-local */
  const IL = (x: number, y: number): Pt => {
    const dx = x - hx;
    const dy = y - hy - o.jit * 0.25;
    return [dx * c + dy * s, -dx * s + dy * c];
  };
  const open = Math.max(0, -o.lid);
  const frontJ: Pt = [hx + 2 * RX - 1, hy];
  const frontL = L(2 * RX - 1, 0);

  // ---- jaw (lower half of the bulb, sitting in the soil)
  layer(p, (q) => {
    for (let y = Math.floor(hy); y <= GROUND; y++)
      for (let x = Math.floor(hx - 1); x <= Math.ceil(hx + 2 * RX + 1); x++) {
        const u = x + 0.5 - hx;
        const v = y + 0.5 - hy;
        if (v < 0 || !inDome(u, v)) continue;
        // lip band along the seam, darker belly toward the bottom right
        let col: number = PAL.leaf2;
        if (v < 1.6 && u > 3) col = PAL.crim2;
        else if (u + v * 1.4 > 2 * RX + 2) col = PAL.leaf1;
        else if (u < 7 && v < 4) col = PAL.leaf3;
        q.set(x, y, col);
      }
    // veins
    for (const [u0, u1] of [
      [8, 6],
      [14, 13],
      [19, 21],
    ] as const)
      q.line(hx + u0, hy + 3, hx + u1, hy + 8, PAL.leaf1);
    // side thorns on the jaw
    thorn(q, [hx + 2 * RX - 1.5, hy + 4], 0.3, 2.6 * o.thorn);
    thorn(q, [hx + 0.5, hy + 4], Math.PI - 0.4, 2.2 * o.thorn);
  });

  // ---- maw (only when the lid is open)
  if (open > 0.03) {
    layer(
      p,
      (q) => {
        const hinge: Pt = [hx + 1.5, hy];
        q.poly([hinge, frontJ, frontL], PAL.crim1);
        // inner surfaces of lid and jaw, deep throat
        q.poly([hinge, [frontJ[0] - 1, frontJ[1] - 1.2], L(RX * 1.4, 1.2)], PAL.crim2);
        q.poly([hinge, L(RX * 1.3, 1.6), [hx + RX * 1.1, hy - 1.5]], PAL.crim0);
        // tongue
        const tl: Pt[] = [];
        for (let i = 0; i <= 8; i++) {
          const f = i / 8;
          tl.push([hx + 4 + f * (RX * 1.25), hy - 1.2 - Math.sin(f * Math.PI) * (1 + open * 3)]);
        }
        q.stroke(tl, 2.6, 1.6, PAL.mag2);
        q.stroke(tl.slice(2, 7).map(([x, y]) => [x, y - 0.6] as Pt), 1, 1, PAL.mag3);
      },
      null,
    );
  }

  // ---- teeth (lower row)
  const teeth = (q: Canvas, upper: boolean) => {
    for (let i = 0; i < 6; i++) {
      const u = 5 + i * 3 + (upper ? 1.5 : 0);
      if (u > 2 * RX - 2) continue;
      const len = 1.8 + (i % 2) * 0.5 + Math.min(1, open * 3) * 1.2;
      if (upper) {
        const b = L(u, -0.2);
        const t = L(u + 0.6, len);
        q.poly([L(u - 1, -0.2), t, L(u + 1, -0.2)], PAL.white);
        q.set(Math.floor(b[0] + 0.5), Math.floor(b[1]), PAL.mist);
      } else {
        const t: Pt = [hx + u + 0.6, hy + 0.2 - len];
        q.poly([[hx + u - 1, hy + 0.2], t, [hx + u + 1, hy + 0.2]], PAL.white);
        q.set(Math.floor(hx + u + 0.5), Math.floor(hy), PAL.mist);
      }
    }
  };

  // ---- lid
  layer(p, (q) => {
    const x0 = Math.floor(hx - RX - 4);
    const x1 = Math.ceil(hx + 2 * RX + 4);
    const y0 = Math.floor(hy - 2 * RX - 4);
    const y1 = Math.ceil(hy + RX);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const [u, v] = IL(x + 0.5, y + 0.5);
        if (v > 0.2 || !inDome(u, v)) continue;
        let col: number = PAL.leaf2;
        // sphere shading in screen space: light from the top-left
        const [cxs, cys] = L(RX - 0.5, -RY * 0.25);
        const nx = (x + 0.5 - cxs) / RX;
        const ny = (y + 0.5 - cys) / (RY * 0.95);
        const lit = -0.62 * nx - 0.78 * ny;
        if (lit > 0.42) col = PAL.leaf3;
        else if (lit < -0.42) col = PAL.leaf1;
        if (v > -1.6 && u > 3) col = PAL.crim2; // red lip
        else if (v > -2.8 && u > 2) col = PAL.leaf1; // shade above the lip
        q.set(x, y, col);
      }
    // big highlight patch + specular
    for (const [u, v, col] of [
      [6, -7, PAL.leaf3],
      [7, -7, PAL.leaf3],
      [5, -6, PAL.leaf3],
      [6, -6, PAL.leaf4],
      [8, -8, PAL.leaf3],
      [7, -8, PAL.leaf4],
      [9, -8, PAL.leaf3],
    ] as const) {
      const [x, y] = L(u, v);
      if (q.isOpaque(x, y)) q.set(x, y, col);
    }
    // spots (carnivorous pattern)
    for (const [u, v] of [
      [10, -7],
      [15, -7.5],
      [6, -4],
      [19, -5.5],
    ] as const) {
      const [x, y] = L(u, v);
      for (const [dx, dy] of [[0, 0], [1, 0]] as const) {
        const cc = q.get(x + dx, y + dy);
        if (cc === PAL.leaf2 || cc === PAL.leaf3) q.set(x + dx, y + dy, cc === PAL.leaf3 ? PAL.leaf2 : PAL.leaf1);
      }
    }
    // eye sockets (glow pass lights them)
    for (const [u, v, r] of EYES) {
      const [x, y] = L(u, v);
      q.set(x, y, PAL.leaf0);
      if (r > 1) q.set(x + 1, y, PAL.leaf0);
    }
    // crest thorns along the top of the lid
    for (const a of [3.75, 4.15, 4.55, 4.95, 5.35, 5.75]) {
      const u = RX - 0.5 + Math.cos(a) * (RX - 0.6);
      const v = Math.sin(a) * (RY - 0.6);
      const nrm = Math.atan2(Math.sin(a) / RY, Math.cos(a) / RX) + o.lid;
      const len = (a > 4.3 && a < 5.3 ? 3.4 : 2.6) * o.thorn;
      thorn(q, L(u, v), nrm, len);
    }
  });
  layer(p, (q) => teeth(q, false), null);
  layer(p, (q) => teeth(q, true), null);
}

/** Eye spots in lid-local coords: [u, v, size]. */
const EYES: [number, number, number][] = [
  [17, -4, 2],
  [13.5, -5, 2],
  [20, -2.5, 1],
];

// ---------------------------------------------------------------- the rig

function drawLurker(p: Canvas, o: Pose): void {
  const bx = o.bx;
  const by = o.by;

  // back vine
  if (!o.wrap) layer(p, (q) => drawVine(q, o.vB, bx, by, o.thorn, 3.2));
  // back leaves (rosette)
  layer(p, (q) => {
    leaf(q, [14 + bx, 41], Math.PI + 0.38 - o.flap * 0.12, 13, 3.2, true);
    leaf(q, [33 + bx, 41], -0.32 + o.flap * 0.12, 13, 3.2, true);
  });
  drawPod(p, o);
  // soil mound heaped against the bulb + roots + pebbles
  layer(
    p,
    (q) => {
      const cx = 23.5 + bx * 0.5;
      for (let x = 5; x <= 42; x++) {
        const d = Math.abs(x + 0.5 - cx) / 18.5;
        if (d > 1) continue;
        const lump = 0.8 * Math.sin(x * 1.3) + 0.6 * Math.sin(x * 0.55 + 1);
        const top = Math.round(GROUND + 1 - (1 - d * d) * 4.2 - lump * (1 - d));
        for (let y = top; y <= GROUND + 1; y++) {
          let col: number = PAL.earth2;
          if (y === top) col = x < cx + 4 ? PAL.earth3 : PAL.earth2;
          else if (y >= GROUND) col = PAL.earth1;
          q.set(x, y, col);
        }
      }
      // clods
      for (const [x, y] of [[14, GROUND - 2], [29, GROUND - 1], [20, GROUND - 1]] as const) q.set(x, y, PAL.earth1);
      q.set(17, GROUND - 3, PAL.earth4);
      // roots crawling out of the mound
      q.stroke([[8, GROUND], [5, GROUND], [3, GROUND + 1]], 2, 1, PAL.earth2);
      q.stroke([[39, GROUND], [42, GROUND - 1], [44, GROUND + 1]], 2, 1, PAL.earth2);
      q.set(42, GROUND - 2, PAL.earth3);
      // pebbles
      q.set(32, GROUND, PAL.stone3).set(33, GROUND, PAL.stone2);
      q.set(11, GROUND, PAL.stone3);
    },
    PAL.earth0,
  );
  // front leaves
  layer(p, (q) => {
    leaf(q, [19 + bx, GROUND - 1], Math.PI - 0.12 - o.flap * 0.08, 10, 2.6, false);
    leaf(q, [29 + bx, GROUND - 1], 0.05 + o.flap * 0.08, 9, 2.4, false);
  });
  // front vine (or both vines wrapped around the pod)
  let tip: Pt = [0, 0];
  if (o.wrap) {
    layer(p, (q) => drawVine(q, o.vB, bx, by, o.thorn, 3), PAL.ink);
    layer(p, (q) => drawVine(q, o.vF, bx, by, o.thorn, 3.2), PAL.ink);
  } else layer(p, (q) => (tip = drawVine(q, o.vF, bx, by, o.thorn, 3.6)), PAL.ink);

  // flying bits that get outlined
  for (const b of o.bits) {
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    if (b.k === 'leaf') {
      const shapes = [
        ['.33', '322', '2.'],
        ['3.', '322', '.22'],
        ['.3', '32', '22', '2.'],
        ['33.', '.22'],
      ];
      p.stamp(shapes[b.v % 4], { '3': PAL.leaf3, '2': PAL.leaf2 }, x, y);
    } else if (b.k === 'thorn') {
      const shapes = [['m3'], ['m', '3'], ['3.', '.m']];
      p.stamp(shapes[b.v % 3], { m: PAL.mag2, '3': PAL.mag3 }, x, y);
    }
  }

  p.outline(PAL.ink);

  // ---------------- light pass
  const hx = HX + bx;
  const hy = HY + by;
  const cl = Math.cos(o.lid);
  const sl = Math.sin(o.lid);
  const L = (u: number, v: number): Pt => [hx + u * cl - v * sl, hy + u * sl + v * cl + o.jit * (u / RX) * 0.5];
  if (o.eye > 0.2) {
    for (const [u, v, r] of EYES) {
      const [x, y] = L(u, v);
      const hot = o.eye >= 1.5 ? PAL.white : o.eye >= 0.8 ? PAL.gold4 : PAL.gold2;
      const rim = o.eye >= 0.8 ? PAL.gold3 : PAL.gold1;
      p.set(x, y, r > 1 ? rim : hot);
      if (r > 1) p.set(x + 1, y, hot);
      if (o.eye >= 1.5 && r > 1) p.set(x + 1, y - 1, PAL.gold3);
    }
  }
  // drip / spores (unoutlined)
  for (const b of o.bits) {
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    if (b.k === 'drip') {
      p.set(x, y, PAL.mag3);
      if (b.v === 1) p.set(x, y - 1, PAL.mag2);
    } else if (b.k === 'spore') {
      p.set(x, y, b.v ? PAL.leaf4 : PAL.gold4);
      if (b.v === 0) p.set(x + 1, y, PAL.leaf3);
    }
  }
  // whip crack at the tip
  if (o.crack > 0) {
    const x = Math.round(tip[0]);
    const y = Math.round(tip[1]);
    const r = o.crack >= 1 ? 3 : 2;
    for (let i = 1; i <= r; i++) {
      const col = i === 1 ? PAL.white : i === 2 ? PAL.leaf4 : PAL.leaf3;
      p.set(x + i, y, col).set(x - i, y, col).set(x, y - i, col).set(x, y + i, col);
    }
    p.set(x, y, PAL.white);
    if (o.crack >= 1) p.set(x + 2, y - 2, PAL.leaf4).set(x - 2, y + 2, PAL.leaf4).set(x + 2, y + 2, PAL.leaf3).set(x - 2, y - 2, PAL.leaf3);
  }
  // whip smear
  if (o.smear.length > 1) {
    for (let i = 0; i + 1 < o.smear.length; i++) {
      const w = 1 + (i / (o.smear.length - 1)) * 1.6;
      p.thickLine(o.smear[i][0], o.smear[i][1], o.smear[i + 1][0], o.smear[i + 1][1], w, i >= o.smear.length - 2 ? PAL.leaf4 : PAL.leaf3);
    }
  }
}

// ---------------------------------------------------------------- portrait (44×34)

function portrait(p: Canvas): void {
  // dark loam with a warm earthy halo behind the pod; jungle leaves hang in from the corners
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 44; x++) {
      const d = Math.hypot((x - 23) * 0.8, y - 19);
      let col: number = PAL.earth0;
      if (d < 16) col = PAL.earth1;
      if (d < 16 && d >= 15 && (x + y) % 2 === 0) col = PAL.earth0;
      p.set(x, y, col);
    }
  const bg = new PixelCanvas(44, 34);
  leaf(bg, [-2, 2], 0.5, 14, 3, true);
  leaf(bg, [46, 0], Math.PI - 0.6, 15, 3.2, true);
  leaf(bg, [44, 9], Math.PI - 0.15, 9, 2.4, true);
  leaf(bg, [0, 12], 0.15, 8, 2.2, true);
  bg.map((c) => (c === PAL.leaf2 ? PAL.leaf1 : PAL.leaf0));
  p.blit(bg, 0, 0);
  const big = new PixelCanvas(W, H);
  drawLurker(big, ANIMS.roar.poses[4]);
  const ox = 2;
  const oy = 8;
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 44; x++) {
      const col = big.get(ox + x, oy + y);
      if (col !== null) p.set(x, y, col);
    }
}

// ---------------------------------------------------------------- export

const art: MonsterArt = {
  id: 'thorn_lurker',
  w: W,
  h: H,
  anchorX: 23,
  anchorY: GROUND,
  hover: 0,
  muzzle: { x: 44, y: 24 },
  core: { x: 23, y: 33 },
  anims: {
    idle: { frames: ANIMS.idle.poses.length, fps: ANIMS.idle.fps, loop: true },
    roar: { frames: ANIMS.roar.poses.length, fps: ANIMS.roar.fps, loop: false },
    attack: { frames: ANIMS.attack.poses.length, fps: ANIMS.attack.fps, loop: false },
    hit: { frames: ANIMS.hit.poses.length, fps: ANIMS.hit.fps, loop: false },
    guard: { frames: ANIMS.guard.poses.length, fps: ANIMS.guard.fps, loop: true },
  },
  attackImpactFrame: 4,
  draw(p: Canvas, anim: MonsterAnim, frame: number) {
    const poses = ANIMS[anim].poses;
    drawLurker(p, poses[Math.max(0, Math.min(poses.length - 1, frame))]);
  },
  portrait,
};

export default art;
