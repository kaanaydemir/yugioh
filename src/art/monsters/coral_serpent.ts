// Mercan Yılanı (coral_serpent) — WATER ace sea serpent, 80×80.
//
// A long serpent rising cobra-like out of a coil on the ground, facing right. Parametric rig:
// every frame is a Pose (numbers). The body is a single spine (tail tip → ground coil → rising
// S-curve → back of the skull) rendered as a z-buffered TUBE: each pixel knows where it sits
// across the tube (u) and along it (s), so the scales get true cylindrical lighting from the
// top-left, the ventral plates sit on the throat side, overlapping coils get ink contours and a
// row of bioluminescent photophores runs down the flank. On top: a rippling magenta dorsal fin,
// a branching coral crown with fin membranes behind the skull, the head (skull + hinged jaw,
// teeth, glowing eye) and dripping water.

import { PAL } from '../palette';
import { PixelCanvas, type Pt } from '../pixel';
import type { MonsterAnim, MonsterArt } from '../types';

const W = 80;
const H = 80;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- pose

interface Drop {
  x: number;
  y: number;
  /** 0 = single pixel, 1 = small drop, 2 = big drop with tail. */
  s: number;
}

interface Pose {
  /** Ground coil: center, radii. */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Rising body: lower bend, upper bend, head joint (back of skull). */
  k1: Pt;
  k2: Pt;
  /** Extra spine knots between k2 and the head (tight S-coil wind-ups). */
  ks: Pt[];
  h: Pt;
  /** Head angle (rad, 0 = facing right, negative = nose up). */
  ha: number;
  /** Jaw open 0..1. */
  jaw: number;
  /** Coral crown spread: 0 folded back, 1 relaxed, 1.6 flared. */
  frill: number;
  /** Fin / frill ripple phase (0..1 loops). */
  rip: number;
  /** Tail swish (-1..1). */
  tail: number;
  eye: 'n' | 'wide' | 'squint';
  /** Photophore / eye glow 0..2. */
  glow: number;
  /** Water orb charging in the mouth 0..1. */
  charge: number;
  drops: Drop[];
  /** Lunge smear: previous head joint positions (oldest first). */
  smear: Pt[];
  /** Water burst at the mouth as the jet leaves (0..1). */
  burst: number;
}

const N: Pose = {
  cx: 31,
  cy: 66,
  rx: 17,
  ry: 6.5,
  k1: [45, 52],
  k2: [38, 39],
  ks: [],
  h: [44, 28],
  ha: 0.12,
  jaw: 0.22,
  frill: 1,
  rip: 0,
  tail: 0,
  eye: 'n',
  glow: 1,
  charge: 0,
  drops: [],
  smear: [],
  burst: 0,
};

const P = (o: Partial<Pose>): Pose => ({ ...N, ...o });
const add = (a: Pt, dx: number, dy: number): Pt => [a[0] + dx, a[1] + dy];

// ---------------------------------------------------------------- animations

function idlePose(f: number, n: number): Pose {
  const t = f / n;
  const w = (lag: number) => Math.sin((t - lag) * TAU);
  // A wave travels up the body: lower bend leads, upper bend and head follow.
  return P({
    k1: add(N.k1, 1.6 * w(0), 0.4 * w(0.25)),
    k2: add(N.k2, -1.6 * w(0.18), 0.5 * w(0.4)),
    h: add(N.h, 1.2 * w(0.36), 0.9 * w(0.6)),
    ha: N.ha + 0.06 * w(0.5),
    rip: t,
    tail: w(0.1),
    glow: 1 + 0.5 * w(0.3),
    frill: 1 + 0.08 * w(0.45),
    drops: idleDrops(t),
  });
}

/** A drop forms under the chin, falls and splashes; a second one lags half a cycle. */
function idleDrops(t: number): Drop[] {
  const out: Drop[] = [];
  for (const [ph, x0, y0, y1] of [
    [0, 58, 34, 74],
    [0.5, 27, 42, 57],
  ] as const) {
    const k = (t + ph) % 1;
    if (k < 0.2) continue; // forming (hidden in the body silhouette)
    const fall = (k - 0.2) / 0.8;
    out.push({ x: x0, y: y0 + fall * fall * (y1 - y0), s: k < 0.35 ? 1 : 2 });
  }
  return out;
}

/** Spray flung off the crown and jaws while roaring (k = 0..1 progress). */
function roarSpray(k: number): Drop[] {
  const seeds: [number, number, number, number][] = [
    [30, 10, -1.2, -0.6],
    [26, 18, -1.4, -0.2],
    [36, 6, -0.6, -1],
    [62, 12, 1, -0.8],
    [64, 22, 1.3, -0.2],
  ];
  return seeds.map(([x, y, vx, vy], i) => ({ x: x + vx * k * 7, y: y + vy * k * 7 + k * k * 9, s: k < 0.45 ? 2 : i % 2 ? 1 : 0 }));
}

const ANIMS: Record<MonsterAnim, { fps: number; loop: boolean; poses: Pose[] }> = {
  idle: { fps: 8, loop: true, poses: Array.from({ length: 8 }, (_, f) => idlePose(f, 8)) },

  // Roar: dip and gather (anticipation) → rear up tall, crown flares wide, jaws gape, eyes blaze →
  // shudder while roaring → settle back down.
  roar: {
    fps: 10,
    loop: false,
    poses: [
      P({}),
      P({ rx: 18.2, ry: 5.5, cy: 67, k1: [44, 53], k2: [36, 42], h: [40, 31], ha: 0.4, frill: 0.55, glow: 0.7, rip: 0.1, jaw: 0.1, tail: -1.8 }),
      P({ rx: 16.4, ry: 7, cy: 65.5, k1: [46, 47], k2: [35, 33], h: [42, 23], ha: -0.22, frill: 1.2, jaw: 0.45, glow: 1.4, rip: 0.2, eye: 'wide', tail: 1.2 }),
      P({ rx: 16, ry: 7.4, cy: 65.1, k1: [47, 46], k2: [34, 30], h: [42, 21], ha: -0.4, frill: 1.65, jaw: 1, glow: 2, rip: 0.3, eye: 'wide', tail: 2.4 }),
      P({ rx: 16.2, ry: 7.2, cy: 65.3, k1: [47, 46], k2: [35, 30], h: [43, 21], ha: -0.43, frill: 1.6, jaw: 1, glow: 2, rip: 0.45, eye: 'wide', tail: -2.4, drops: roarSpray(0.15) }),
      P({ rx: 16, ry: 7.4, cy: 65.1, k1: [47, 46], k2: [34, 30], h: [42, 21], ha: -0.4, frill: 1.68, jaw: 0.95, glow: 1.8, rip: 0.6, eye: 'wide', tail: 2.2, drops: roarSpray(0.45) }),
      P({ rx: 16.2, ry: 7.2, cy: 65.3, k1: [47, 46], k2: [35, 30], h: [43, 22], ha: -0.42, frill: 1.6, jaw: 1, glow: 1.9, rip: 0.75, eye: 'wide', tail: -2, drops: roarSpray(0.75) }),
      P({ rx: 16.6, ry: 6.8, cy: 65.7, k1: [46, 48], k2: [36, 33], h: [43, 22], ha: -0.12, frill: 1.35, jaw: 0.4, glow: 1.5, rip: 0.9, eye: 'wide', tail: 1, drops: roarSpray(1) }),
      P({ rx: 17.4, ry: 6.2, cy: 66.3, k1: [45, 52], k2: [38, 38], h: [44, 27], ha: 0.16, frill: 1.08, jaw: 0.15, glow: 1.2, rip: 0.0, tail: -0.5 }),
      P({ glow: 1.05, rip: 0.1 }),
    ],
  },

  // Attack ("Gelgit Mızrağı"): the ground coil squashes and the neck winds back into a tight S-spring
  // (head drawn back behind the coil, tail fin cocked up) while a water orb charges between the
  // jaws → the spring releases, the coil stretches tall and the head whips forward → IMPACT: jaws
  // wide, the jet leaves the mouth (muzzle) → hold the jet (frames 5–7) → recover.
  attack: {
    fps: 12,
    loop: false,
    poses: [
      P({}),
      P({ rx: 17.8, ry: 6, cy: 66.5, k1: [46, 54], k2: [32, 45], ks: [[31, 37]], h: [38, 31], ha: 0.06, frill: 1.15, jaw: 0.24, glow: 1.3, rip: 0.15, tail: -1.4 }),
      P({ rx: 18.6, ry: 5.4, cy: 67.1, k1: [45, 56], k2: [28, 47], ks: [[25, 38]], h: [34, 32], ha: 0.02, frill: 1.45, jaw: 0.3, glow: 1.7, rip: 0.3, eye: 'wide', charge: 0.55, tail: -2.6 }),
      P({ rx: 19, ry: 5.1, cy: 67.4, k1: [46, 57.5], k2: [26, 48.5], ks: [[23.5, 38.5]], h: [32.5, 32.5], ha: 0.04, frill: 1.55, jaw: 0.34, glow: 2, rip: 0.45, eye: 'wide', charge: 1, tail: -3.2 }),
      P({ rx: 16.2, ry: 7.1, cy: 65.4, k1: [49, 50], k2: [45, 38], h: [48, 27], ha: 0.05, frill: 1.5, jaw: 0.75, glow: 2, rip: 0.6, eye: 'wide', smear: [[32.5, 32.5], [38, 30], [43, 28]], tail: 1.8 }),
      P({ rx: 16, ry: 7.4, cy: 65.1, k1: [50, 51], k2: [49, 39], h: [51, 29], ha: 0.1, frill: 1.55, jaw: 1, glow: 2, rip: 0.7, eye: 'wide', tail: 2.2, burst: 1 }),
      P({ rx: 16.4, ry: 7, cy: 65.5, k1: [50, 51], k2: [48, 39], h: [50, 29], ha: 0.1, frill: 1.45, jaw: 1, glow: 1.8, rip: 0.8, eye: 'wide', tail: 0.8, burst: 0.6 }),
      P({ rx: 16.8, ry: 6.7, cy: 65.8, k1: [49, 51], k2: [46, 38], h: [49, 28], ha: 0.12, frill: 1.35, jaw: 0.9, glow: 1.6, rip: 0.9, eye: 'wide', tail: -0.6 }),
      P({ rx: 17.2, ry: 6.4, cy: 66.1, k1: [47, 52], k2: [41, 39], h: [46, 28], ha: 0.14, frill: 1.15, jaw: 0.4, glow: 1.3, rip: 0.0, tail: 0.3 }),
      P({ glow: 1.1, rip: 0.1 }),
    ],
  },

  // Hit: head snaps back and up, eye squeezed shut, crown pinned back, water bursts off the body.
  hit: {
    fps: 10,
    loop: false,
    poses: [
      P({ k1: [42, 51], k2: [33, 36], h: [35, 23], ha: -0.38, jaw: 0.45, frill: 0.45, eye: 'squint', glow: 0.4, cx: 30, rx: 17.8, ry: 6, cy: 66.5, tail: -1.8,
        drops: [{ x: 60, y: 24, s: 2 }, { x: 64, y: 31, s: 1 }, { x: 57, y: 17, s: 1 }, { x: 62, y: 40, s: 0 }] }),
      P({ k1: [43, 51], k2: [34, 36], h: [37, 23], ha: -0.28, jaw: 0.25, frill: 0.6, eye: 'squint', glow: 0.6, ry: 6.8, cy: 65.7, tail: 1.4,
        drops: [{ x: 65, y: 22, s: 1 }, { x: 69, y: 31, s: 1 }, { x: 61, y: 15, s: 0 }, { x: 66, y: 41, s: 0 }] }),
      P({ k1: [44, 52], k2: [37, 39], h: [42, 27], ha: 0.02, jaw: 0.1, frill: 0.85, glow: 0.9, drops: [{ x: 70, y: 27, s: 0 }, { x: 70, y: 44, s: 0 }] }),
      P({ k1: [45, 52], k2: [38, 39], h: [44, 28], ha: 0.1, glow: 1 }),
    ],
  },

  // Guard: coil pulled tight and high, neck folded low behind the coil, crown folded shut.
  guard: {
    fps: 4,
    loop: true,
    poses: [0, 1, 2, 3].map((f) => {
      const s = Math.sin((f / 4) * TAU);
      return P({
        rx: 15,
        ry: 6.4,
        cx: 32,
        k1: [46, 55],
        k2: [35, 49 - 0.4 * s],
        h: [40, 41 - 0.6 * s],
        ha: 0.3,
        jaw: 0.06,
        frill: 0.08,
        rip: f / 4,
        glow: 0.8 + 0.3 * s,
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

/** Recolor opaque pixels whose neighbor (dx, dy) is transparent. `only` restricts to a source color. */
function edge(q: Canvas, dx: number, dy: number, c: number, only?: number): void {
  const src = q.clone();
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      if (!src.isOpaque(x, y) || src.isOpaque(x + dx, y + dy)) continue;
      if (only !== undefined && src.get(x, y) !== only) continue;
      q.set(x, y, c);
    }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const frac = (v: number) => v - Math.floor(v);

/** Uniform Catmull-Rom through pts (with phantom end points), n samples per span. */
function catmull(pts: Pt[], n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i + 2 < pts.length; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1], pts[i], pts[i + 1], pts[i + 2]];
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 2]);
  return out;
}

// ---------------------------------------------------------------- tube body

interface Node {
  x: number;
  y: number;
  z: number;
  r: number;
  /** Ventral plates weight 0..1. */
  belly: number;
}

interface TubeHit {
  s: number;
  u: number;
  nx: number;
  ny: number;
  r: number;
  z: number;
  belly: number;
}

const LIGHT = (() => {
  const v = [-0.6, -0.72, 0.36];
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l] as const;
})();

const SCALE = [PAL.water0, PAL.water1, PAL.water2, PAL.water3, PAL.water4] as const;
const BELLY = [PAL.night3, PAL.steel, PAL.mist, PAL.water4, PAL.white] as const;

/** Rasterize a tube along nodes into a z-buffer of hits. */
function rasterTube(nodes: Node[]): (TubeHit | null)[] {
  const n = W * H;
  const zb = new Float32Array(n).fill(-1e9);
  const S = new Float32Array(n);
  const U = new Float32Array(n);
  const NX = new Float32Array(n);
  const NY = new Float32Array(n);
  const RR = new Float32Array(n);
  const Z = new Float32Array(n);
  const BL = new Float32Array(n);
  const has = new Uint8Array(n);
  // resample at fine spacing
  let s = 0;
  for (let i = 0; i + 1 < nodes.length; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg < 1e-4) continue;
    const tx = (b.x - a.x) / seg;
    const ty = (b.y - a.y) / seg;
    const nx = -ty;
    const ny = tx;
    const steps = Math.max(1, Math.ceil(seg / 0.35));
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const x = lerp(a.x, b.x, t);
      const y = lerp(a.y, b.y, t);
      const z = lerp(a.z, b.z, t);
      const r = lerp(a.r, b.r, t);
      const r2 = r * r;
      const y0 = Math.max(0, Math.floor(y - r - 1));
      const y1 = Math.min(H - 1, Math.ceil(y + r + 1));
      const x0 = Math.max(0, Math.floor(x - r - 1));
      const x1 = Math.min(W - 1, Math.ceil(x + r + 1));
      for (let py = y0; py <= y1; py++)
        for (let px = x0; px <= x1; px++) {
          const dx = px + 0.5 - x;
          const dy = py + 0.5 - y;
          const d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          const depth = z + Math.sqrt(r2 - d2);
          const idx = py * W + px;
          if (depth <= zb[idx]) continue;
          zb[idx] = depth;
          has[idx] = 1;
          S[idx] = s + seg * t;
          U[idx] = clamp((dx * nx + dy * ny) / r, -1, 1);
          NX[idx] = nx;
          NY[idx] = ny;
          RR[idx] = r;
          Z[idx] = z;
          BL[idx] = lerp(a.belly, b.belly, t);
        }
    }
    s += seg;
  }
  const buf: (TubeHit | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++)
    if (has[i]) buf[i] = { s: S[i], u: U[i], nx: NX[i], ny: NY[i], r: RR[i], z: Z[i], belly: BL[i] };
  return buf;
}

function drawBody(q: Canvas, nodes: Node[]): void {
  const buf = rasterTube(nodes);
  const [lx, ly, lz] = LIGHT;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const hit = buf[y * W + x];
      if (!hit) continue;
      const { u, nx, ny, s, belly } = hit;
      const nz = Math.sqrt(Math.max(0, 1 - u * u));
      const d = nx * u * lx + ny * u * ly + nz * lz;
      const ventral = belly > 0.05 && u > lerp(1.2, 0.2, belly);
      let col: number;
      if (ventral) {
        // ventral scutes: a regular rhythm of 2px pale plates and a 1px shadow seam
        let i = d < -0.1 ? 0 : d < 0.2 ? 1 : d < 0.55 ? 2 : 3;
        if (frac(s / 3) < 0.34) i = Math.max(0, i - 1);
        col = BELLY[i];
      } else {
        const i = d < -0.18 ? 0 : d < 0.16 ? 1 : d < 0.52 ? 2 : d < 0.84 ? 3 : 4;
        col = SCALE[i];
      }
      q.set(x, y, col);
    }
  // contours where one stretch of the body passes over another
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const a = buf[y * W + x];
      if (!a) continue;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const b = x + dx >= 0 && x + dx < W && y + dy >= 0 && y + dy < H ? buf[(y + dy) * W + x + dx] : null;
        if (!b) continue;
        if (Math.abs(a.s - b.s) > (a.r + b.r) * 1.25 && a.z < b.z) {
          q.set(x, y, PAL.ink);
          break;
        }
      }
    }
  despeckle(q);
}

/** Fold isolated single pixels (no same-colour 8-neighbour) into their most common neighbour colour. */
function despeckle(q: Canvas): void {
  const src = q.clone();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = src.get(x, y);
      if (c === null || c === PAL.ink) continue;
      const votes = new Map<number, number>();
      let same = false;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const n = src.get(x + dx, y + dy);
          if (n === null || n === PAL.ink) continue;
          if (n === c) same = true;
          votes.set(n, (votes.get(n) ?? 0) + 1);
        }
      if (same || !votes.size) continue;
      let best = c;
      let bv = 0;
      for (const [k, v] of votes) if (v > bv) [best, bv] = [k, v];
      q.set(x, y, best);
    }
}

// ---------------------------------------------------------------- head (local: x forward, y down)

const SKULL: Pt[] = [
  [-4, -1],
  [-3, -4.5],
  [0, -7],
  [4, -8.2],
  [8, -8.1],
  [10.6, -8.8],
  [12.8, -8.1],
  [13.6, -5.9],
  [16.5, -4.9],
  [20.5, -3.7],
  [23.5, -2.3],
  [25.4, -0.7],
  [25.3, 1.4],
  [23.9, 0.9],
  [19, 1],
  [14, 1.2],
  [8, 1.5],
  [4.5, 0.7],
  [1.5, 2.6],
  [-3, 2.6],
];
/** Lit top plane of the skull (crest → brow → snout ridge). */
const SKULL_TOP: Pt[] = [
  [-2.8, -4.2],
  [0, -6.7],
  [4, -7.9],
  [8, -7.8],
  [10.6, -8.5],
  [12.6, -7.8],
  [13.4, -5.6],
  [16.5, -4.6],
  [20.5, -3.4],
  [23.5, -2],
  [24.6, -1],
  [22.5, -1.4],
  [18, -2.6],
  [13.2, -3.8],
  [11.5, -6.4],
  [8.5, -6.4],
  [4, -6.3],
  [0, -5.3],
  [-2.4, -3],
];
/** Deep brow socket the eye glows out of (slanted: the brow bears down on the eye). */
const SOCKET: Pt[] = [
  [6.4, -5.2],
  [12.4, -4.4],
  [11.8, -2.1],
  [7.4, -2.6],
];
const JAW_HINGE: Pt = [3.5, 1];
const JAW: Pt[] = [
  [2.5, 0.9],
  [8, 1.6],
  [14, 1.5],
  [19, 1.3],
  [22.6, 1.2],
  [22.9, 2.5],
  [19, 3.5],
  [14, 4.4],
  [9, 5.2],
  [4, 6],
  [0, 5.4],
  [-2.5, 3.6],
];
/** Pale underside of the jaw (continues the ventral plates). */
const JAW_UNDER: Pt[] = [
  [-1, 4.6],
  [4, 4.9],
  [10, 4.1],
  [16, 3.3],
  [22.8, 2.4],
  [19, 3.5],
  [14, 4.4],
  [9, 5.2],
  [4, 6],
  [0, 5.4],
  [-2.5, 3.6],
];

function headXf(o: Pose): (x: number, y: number) => Pt {
  const c = Math.cos(o.ha);
  const s = Math.sin(o.ha);
  return (x, y) => [o.h[0] + x * c - y * s, o.h[1] + x * s + y * c];
}

function jawXf(o: Pose): (x: number, y: number) => Pt {
  const T = headXf(o);
  const a = o.jaw * 0.72;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return (x, y) => {
    const dx = x - JAW_HINGE[0];
    const dy = y - JAW_HINGE[1];
    return T(JAW_HINGE[0] + dx * c - dy * s, JAW_HINGE[1] + dx * s + dy * c);
  };
}

/** Draw a local-space line into q, only over opaque pixels (optionally only over color `only`). */
function inLine(q: Canvas, a: Pt, b: Pt, c: number, only?: number): void {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
  for (let k = 0; k <= n; k++) {
    const x = lerp(a[0], b[0], k / n);
    const y = lerp(a[1], b[1], k / n);
    if (!q.isOpaque(x, y)) continue;
    if (only !== undefined && q.get(x, y) !== only) continue;
    q.set(x, y, c);
  }
}

/** Mouth gap (px) between the jaws at local x, for the current jaw opening. */
const gapAt = (o: Pose, x: number) => (x - JAW_HINGE[0]) * Math.sin(o.jaw * 0.72);

function drawHead(q: Canvas, o: Pose): void {
  const T = headXf(o);
  const J = jawXf(o);
  const m = (pts: Pt[], f: (x: number, y: number) => Pt) => pts.map(([x, y]) => f(x, y));

  // ---- mouth interior (visible when the jaw drops) + the water orb charging inside it
  const mq = new PixelCanvas(W, H);
  if (o.jaw > 0.05) {
    mq.poly([T(0.5, 0.8), T(24.4, 1), J(22.6, 1.4), J(11, 1.6), J(1.5, 1.4)], PAL.crim1);
    mq.poly([T(0.5, 0.8), T(8, 1), J(8, 1.6), J(1.5, 1.4)], PAL.crim0);
    if (o.jaw > 0.35) mq.stroke([J(3, 2), J(9, 2), J(14, 1.6)], 2, 1, PAL.crim2);
  }
  if (o.charge > 0) {
    // the orb sits between the jaws: only the gap shows it, the lips are lit cyan from inside
    const ox = 16.5;
    const [cx, cy] = T(ox, 1.2 + gapAt(o, ox) * 0.5);
    const r = 1.4 + o.charge * 1.4;
    mq.disc(cx, cy, r + 1, PAL.cyan2);
    mq.disc(cx, cy, r, PAL.cyan3);
    mq.disc(cx - 0.3, cy - 0.3, r * 0.55, PAL.cyan4);
    mq.set(cx - 1, cy - 1, PAL.white).set(cx, cy - 1, PAL.white);
  }

  // ---- lower jaw: blue flank, pale underside, lower fangs
  const jq = new PixelCanvas(W, H);
  jq.poly(m(JAW, J), PAL.water1);
  jq.poly(m(JAW_UNDER, J), PAL.mist);
  edge(jq, 0, 1, PAL.steel, PAL.mist);
  edge(jq, 0, -1, PAL.water2, PAL.water1);
  {
    // lower canine always bared
    const [x, y] = J(18, 0.6);
    jq.set(x, y, PAL.white);
    const [x2, y2] = J(18, -0.3);
    jq.set(x2, y2, PAL.white);
  }
  if (o.jaw > 0.42) {
    for (const tx of [8, 11.8, 15]) {
      const [x, y] = J(tx, 0.6);
      jq.set(x, y, PAL.white);
    }
    const [x, y] = J(22, 0.5);
    jq.set(x, y, PAL.white);
  }
  if (o.charge > 0) {
    // cyan underglow on the lower lip
    for (const tx of [12, 14, 17, 19]) {
      const [x, y] = J(tx, 1.6);
      if (jq.isOpaque(x, y)) jq.set(x, y, PAL.cyan2);
    }
  }

  // ---- skull: side plane, lit top plane, shadowed cheek, deep socket
  const sq = new PixelCanvas(W, H);
  sq.poly(m(SKULL, T), PAL.water2);
  const top = new PixelCanvas(W, H);
  top.poly(m(SKULL_TOP, T), PAL.water3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (top.isOpaque(x, y) && sq.isOpaque(x, y)) sq.set(x, y, PAL.water3);
  edge(sq, 1, 0, PAL.water1);
  edge(sq, 0, 1, PAL.water1);
  edge(sq, 0, -1, PAL.water4, PAL.water3);
  // cheek shadow along the lip
  inLine(sq, T(5, 0.2), T(22, 0.2), PAL.water1, PAL.water2);
  inLine(sq, T(4.6, 0.8), T(8, 1.1), PAL.water0);
  inLine(sq, T(8, 1.1), T(24, 0.6), PAL.water0);
  // nostril slit on the hooked snout
  inLine(sq, T(21.6, -1.6), T(22.8, -1.2), PAL.water0);
  // socket + glowing eye
  const sock = new PixelCanvas(W, H);
  sock.poly(m(SOCKET, T), PAL.water0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (sock.isOpaque(x, y) && sq.isOpaque(x, y)) sq.set(x, y, PAL.water0);
  // heavy brow ridge bearing down on the eye (angry slant toward the snout)
  inLine(sq, T(5.5, -6.6), T(13, -4.6), PAL.water1);
  inLine(sq, T(5.5, -7.3), T(12.4, -5.6), PAL.water4, PAL.water3);
  // cheekbone ridge
  inLine(sq, T(3.5, -1.6), T(12.5, -1.4), PAL.water3, PAL.water2);
  const [ex, ey] = T(10.2, -3.2);
  const exi = Math.floor(ex);
  const eyi = Math.floor(ey);
  // dark ring of the socket around the eye so the glow reads at 1×
  for (let dy = -1; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (sq.isOpaque(exi + dx, eyi + dy)) sq.set(exi + dx, eyi + dy, PAL.water0);
  if (o.eye === 'squint') {
    sq.set(exi - 1, eyi + 1, PAL.cyan2).set(exi, eyi + 1, PAL.cyan3).set(exi + 1, eyi + 1, PAL.cyan2);
  } else {
    // glowing eye: hot core toward the snout, lid cut flat by the brow
    sq.set(exi - 1, eyi + 1, PAL.cyan2).set(exi, eyi + 1, PAL.cyan4).set(exi + 1, eyi + 1, PAL.white);
    sq.set(exi + 1, eyi, PAL.cyan3);
    if (o.eye === 'wide' || o.glow > 1.6) sq.set(exi, eyi, PAL.cyan3).set(exi + 1, eyi, PAL.cyan4).set(exi - 1, eyi + 1, PAL.cyan3);
  }
  // upper fangs: the big canine always hangs over the lip, the rest show when the jaw opens
  {
    const [x, y] = T(21, 1.7);
    sq.set(x, y, PAL.white);
    const [x2, y2] = T(21, 2.7);
    sq.set(x2, y2, o.jaw > 0.08 ? PAL.white : PAL.mist);
  }
  if (o.jaw > 0.42) {
    for (const tx of [7, 10.5, 14, 17.5]) {
      const [x, y] = T(tx, 1.7);
      sq.set(x, y, PAL.white);
    }
  }

  // ---- coral horn sweeping back off the brow
  const hq = new PixelCanvas(W, H);
  const horn = [T(11.6, -7.6), T(7, -10.4), T(1.5, -12), T(-4.5, -11.6)];
  hq.stroke(horn, 3.4, 1, PAL.mag3);
  edge(hq, 1, 0, PAL.mag2);
  edge(hq, 0, 1, PAL.mag2);
  edge(hq, 0, -1, PAL.mag4);
  {
    const [x, y] = horn[horn.length - 1];
    hq.set(x, y, PAL.mag4);
  }

  layer(q, (t) => t.blit(mq, 0, 0), null);
  layer(q, (t) => t.blit(jq, 0, 0));
  layer(q, (t) => t.blit(sq, 0, 0));
  layer(q, (t) => t.blit(hq, 0, 0));

  // glow streak trailing from a blazing eye (anime eye-trail)
  if (o.eye === 'wide') {
    const a = T(6.5, -3);
    const b = T(3, -3.8);
    q.set(a[0], a[1], PAL.cyan3).set(b[0], b[1], PAL.cyan2);
  }
}

// ---------------------------------------------------------------- coral crown (local head space)

interface Spine {
  root: Pt;
  /** angle relative to the head (rad, local), relaxed / flared */
  a: number;
  af: number;
  len: number;
  /** side branch: where (0..1) and which way (+/-) */
  fk: number;
  fd: number;
}

const CROWN: Spine[] = [
  { root: [4.5, -7.6], a: -1.55, af: -1.5, len: 10.5, fk: 0.72, fd: 0.6 },
  { root: [1.5, -7], a: -2.08, af: -2.1, len: 14.5, fk: 0.72, fd: -0.55 },
  { root: [-1.5, -5.2], a: -2.62, af: -2.7, len: 15, fk: 0.72, fd: 0.55 },
  { root: [-3.6, -2.5], a: -3.12, af: -3.32, len: 10.5, fk: 0.72, fd: -0.6 },
];
const CLOSED = -2.98;

/** A spine's centerline in frame space. */
function spinePath(o: Pose, sp: Spine, i: number, T: (x: number, y: number) => Pt, upto = 1): Pt[] {
  const f = o.frill;
  const ang = f <= 1 ? lerp(CLOSED + (i - 1.5) * 0.06, sp.a, f) : lerp(sp.a, sp.af, Math.min(1, (f - 1) / 0.6));
  const len = sp.len * (f <= 1 ? lerp(0.7, 1, f) : lerp(1, 1.08, Math.min(1, (f - 1) / 0.6)));
  const wob = 0.07 * Math.sin((o.rip - i * 0.17) * TAU) * Math.min(1, f + 0.2);
  const out: Pt[] = [];
  const n = 6;
  for (let k = 0; k <= n; k++) {
    const t = (k / n) * upto;
    // whip-like ripple: the tip lags the root
    const a = ang + wob * t * 2 - t * t * 0.18;
    out.push(T(sp.root[0] + Math.cos(a) * t * len, sp.root[1] + Math.sin(a) * t * len));
  }
  return out;
}

function drawCrown(q: Canvas, o: Pose): void {
  const T = headXf(o);
  const FORK = 4; // index (of 6) where each coral spine splits into two tines
  const paths = CROWN.map((sp, i) => spinePath(o, sp, i, T));
  // fin membranes between neighbouring spines, up to just past the forks, scalloped edge
  const mem = new PixelCanvas(W, H);
  for (let i = 0; i + 1 < CROWN.length; i++) {
    const a = spinePath(o, CROWN[i], i, T, 0.84);
    const b = spinePath(o, CROWN[i + 1], i + 1, T, 0.84);
    const ta = a[a.length - 1];
    const tb = b[b.length - 1];
    const root: Pt = [lerp(a[0][0], b[0][0], 0.5), lerp(a[0][1], b[0][1], 0.5)];
    const mid: Pt = [lerp(ta[0], tb[0], 0.5), lerp(ta[1], tb[1], 0.5)];
    const sag: Pt = [lerp(mid[0], root[0], 0.24), lerp(mid[1], root[1], 0.24)];
    mem.poly([...a, sag, ...b.slice().reverse()], PAL.mag1);
  }
  edge(mem, 0, -1, PAL.mag2);
  edge(mem, -1, 0, PAL.mag2);
  edge(mem, 1, 0, PAL.mag0);
  edge(mem, 0, 1, PAL.mag0);
  layer(q, (t) => t.blit(mem, 0, 0));

  // coral spines: a stem that forks into two tines (staghorn coral)
  const cr = new PixelCanvas(W, H);
  const tips: Pt[] = [];
  const forks: Pt[] = [];
  CROWN.forEach((sp, i) => {
    const path = paths[i];
    cr.stroke(path.slice(0, FORK + 1), 2.4, 1.6, PAL.mag2);
    cr.stroke(path.slice(FORK), 1.6, 1, PAL.mag2);
    const fp = path[FORK];
    const prev = path[FORK - 1];
    const dir = Math.atan2(fp[1] - prev[1], fp[0] - prev[0]) + sp.fd * Math.max(0.7, Math.min(1.3, o.frill));
    const fl = sp.len * 0.24;
    const t2: Pt = [fp[0] + Math.cos(dir) * fl, fp[1] + Math.sin(dir) * fl];
    cr.stroke([fp, t2], 1.4, 1, PAL.mag2);
    tips.push(path[path.length - 1], t2);
    forks.push(fp);
  });
  edge(cr, 1, 0, PAL.mag1);
  edge(cr, 0, 1, PAL.mag1);
  edge(cr, 0, -1, PAL.mag3);
  edge(cr, -1, 0, PAL.mag3);
  for (const t of tips) cr.set(t[0], t[1], PAL.mag4);
  for (const f of forks) if (cr.isOpaque(f[0], f[1])) cr.set(f[0], f[1], PAL.crim3);
  layer(q, (t) => t.blit(cr, 0, 0));
}

// ---------------------------------------------------------------- dorsal + tail fins

function drawFin(q: Canvas, spine: Pt[], from: number, to: number, o: Pose, radius: (i: number) => number): void {
  const fin = new PixelCanvas(W, H);
  const base: Pt[] = [];
  const rim: Pt[] = [];
  const rays: [Pt, Pt][] = [];
  const RAY = 3;
  for (let i = from; i <= to; i++) {
    const a = spine[Math.max(0, i - 1)];
    const b = spine[Math.min(spine.length - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = (b[1] - a[1]) / len; // dorsal side (left of travel when climbing)
    const ny = -(b[0] - a[0]) / len;
    const t = (i - from) / Math.max(1, to - from);
    const r = radius(i);
    const env = Math.sin(Math.PI * Math.pow(t, 0.75));
    const wave = 1 + 0.25 * Math.sin((o.rip * 2 - t * 2.4) * TAU);
    const onRay = (i - from) % RAY === 1;
    const hgt = (1.5 + 5.2 * env) * wave + (onRay ? 1.2 : -0.4);
    base.push([spine[i][0] + nx * (r - 1.5), spine[i][1] + ny * (r - 1.5)]);
    const tip: Pt = [spine[i][0] + nx * (r + hgt), spine[i][1] + ny * (r + hgt)];
    rim.push(tip);
    if (onRay) rays.push([[spine[i][0] + nx * r, spine[i][1] + ny * r], tip]);
  }
  fin.poly([...base, ...rim.slice().reverse()], PAL.mag1);
  edge(fin, -1, 0, PAL.mag2);
  edge(fin, 0, -1, PAL.mag2);
  for (const [a, b] of rays) {
    inLine(fin, a, b, PAL.mag3);
    if (fin.isOpaque(b[0], b[1])) fin.set(b[0], b[1], PAL.mag4);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (fin.isOpaque(x, y) && !q.isOpaque(x, y)) q.set(x, y, fin.get(x, y)!);
}

// ---------------------------------------------------------------- the serpent

function spineOf(o: Pose): { nodes: Node[]; rise0: number; pts: Pt[] } {
  const nodes: Node[] = [];
  // tail: curls out of the front-right of the coil
  const ring = (ph: number): Pt => [o.cx + Math.cos(ph) * o.rx, o.cy + Math.sin(ph) * o.ry];
  const ph0 = 0.18 * Math.PI;
  const r0 = ring(ph0);
  const sw = o.tail * 1.5;
  const tail = catmull(
    [
      [r0[0] + 16, r0[1] - 9 + sw],
      [r0[0] + 12, r0[1] - 5 + sw],
      [r0[0] + 7, r0[1] - 0.5 + sw * 0.5],
      r0,
      ring(ph0 + 0.25),
    ],
    4,
  );
  tail.forEach(([x, y], i) => {
    const t = i / (tail.length - 1);
    nodes.push({ x, y, z: 9, r: lerp(1, 4.2, t), belly: 0 });
  });
  // ground coil: front arc (in front, z+) → left → back arc (z−)
  const ph1 = 1.6 * Math.PI;
  const steps = 26;
  for (let i = 1; i <= steps; i++) {
    const ph = lerp(ph0, ph1, i / steps);
    const [x, y] = ring(ph);
    nodes.push({ x, y, z: Math.sin(ph) * 9, r: lerp(4.3, 5.2, i / steps), belly: 0 });
  }
  const rise0 = nodes.length - 1;
  // rising body (Catmull-Rom through the bends to the back of the skull)
  const base = ring(ph1);
  const tan: Pt = [-Math.sin(ph1) * o.rx, Math.cos(ph1) * o.ry];
  const tl = Math.hypot(tan[0], tan[1]);
  const pre: Pt = [base[0] - (tan[0] / tl) * 6, base[1] - (tan[1] / tl) * 6];
  const na = o.ha - 1.15;
  const post: Pt = [o.h[0] + Math.cos(na) * 6, o.h[1] + Math.sin(na) * 6];
  const rise = catmull([pre, base, o.k1, o.k2, ...o.ks, o.h, post], 8);
  const zBack = Math.sin(ph1) * 9;
  rise.forEach(([x, y], i) => {
    if (i === 0) return;
    const t = i / (rise.length - 1);
    nodes.push({ x, y, z: lerp(zBack, -2, Math.min(1, t * 3)), r: lerp(5.2, 3.6, Math.pow(t, 1.15)), belly: Math.min(1, t * 4.5) });
  });
  return { nodes, rise0, pts: nodes.map((n) => [n.x, n.y] as Pt) };
}

/** Pressurised water bursting from the mouth at the impact frame (the jet VFX starts here). */
function drawBurst(p: Canvas, o: Pose): void {
  const T = headXf(o);
  const [mx, my] = T(24.5, 1.8 + o.jaw * 1.6);
  const a = o.ha + o.jaw * 0.3;
  const k = o.burst;
  const bq = new PixelCanvas(W, H);
  for (const [da, len, w] of [
    [0, 6.5, 3],
    [-0.6, 5, 2],
    [0.62, 5, 2],
    [-1.25, 3.5, 1.5],
    [1.3, 3.5, 1.5],
  ] as const) {
    const L = len * k;
    const tip: Pt = [mx + Math.cos(a + da) * L, my + Math.sin(a + da) * L];
    bq.stroke([[mx, my], tip], w, 1, PAL.water3);
  }
  edge(bq, 0, -1, PAL.water4);
  inLine(bq, [mx, my], [mx + Math.cos(a) * 6 * k, my + Math.sin(a) * 6 * k], PAL.water4);
  bq.disc(mx, my, 0.6 + k * 1.2, PAL.water4);
  bq.disc(mx, my, 0.5 + k * 0.6, PAL.white);
  p.blit(bq, 0, 0);
}

function drawDrops(p: Canvas, drops: Drop[]): void {
  for (const d of drops) {
    const x = Math.round(d.x);
    const y = Math.round(d.y);
    if (d.s === 0) p.set(x, y, PAL.water4);
    else if (d.s === 1) p.set(x, y, PAL.white).set(x, y + 1, PAL.water3);
    else p.set(x, y - 1, PAL.water3).set(x, y, PAL.white).set(x, y + 1, PAL.water4).set(x - 1, y + 1, PAL.water3).set(x + 1, y + 1, PAL.water2).set(x, y + 2, PAL.water2);
  }
}

/** Global horizontal offset of the rig inside the frame (keeps the lunge + burst inside 80px). */
const OX = -2;

function shifted(o: Pose): Pose {
  const sh = (q: Pt): Pt => [q[0] + OX, q[1]];
  return { ...o, cx: o.cx + OX, k1: sh(o.k1), k2: sh(o.k2), ks: o.ks.map(sh), h: sh(o.h), smear: o.smear.map(sh), drops: o.drops.map((d) => ({ ...d, x: d.x + OX })) };
}

function drawSerpent(p: Canvas, pose: Pose): void {
  const o = shifted(pose);
  const { nodes, rise0, pts } = spineOf(o);

  // dorsal fin (behind the body) along the rising neck
  const finFrom = rise0 + 6;
  const finTo = nodes.length - 5;
  drawFin(p, pts, finFrom, finTo, o, (i) => nodes[i].r);

  // tail fan
  {
    const tip = nodes[0];
    const nb = nodes[2];
    const a = Math.atan2(tip.y - nb.y, tip.x - nb.x);
    const fan = new PixelCanvas(W, H);
    const sp = 0.75 + 0.15 * o.tail;
    fan.poly(
      [
        [nb.x, nb.y],
        [tip.x + Math.cos(a - sp) * 6, tip.y + Math.sin(a - sp) * 6],
        [tip.x + Math.cos(a) * 3.5, tip.y + Math.sin(a) * 3.5],
        [tip.x + Math.cos(a + sp) * 6, tip.y + Math.sin(a + sp) * 6],
      ],
      PAL.mag2,
    );
    edge(fan, 1, 0, PAL.mag1);
    edge(fan, 0, 1, PAL.mag1);
    edge(fan, 0, -1, PAL.mag3);
    fan.line(nb.x, nb.y, tip.x + Math.cos(a - sp) * 5, tip.y + Math.sin(a - sp) * 5, PAL.mag3);
    p.blit(fan, 0, 0);
  }

  // coral crown + membranes behind the skull
  drawCrown(p, o);

  // afterimages of the head along the lunge path (behind the body)
  if (o.smear.length) {
    o.smear.slice(-1).forEach((q) => {
      const ghost: Pose = { ...o, h: q, jaw: o.jaw * 0.6 };
      const T = headXf(ghost);
      const J = jawXf(ghost);
      const g = new PixelCanvas(W, H);
      g.poly(SKULL.map(([x, y]) => T(x, y)), PAL.water2);
      g.poly(JAW.map(([x, y]) => J(x, y)), PAL.water2);
      edge(g, 0, -1, PAL.water3);
      edge(g, -1, 0, PAL.water3);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g.isOpaque(x, y) && !p.isOpaque(x, y)) p.set(x, y, g.get(x, y)!);
    });
  }

  // body
  layer(p, (q) => drawBody(q, nodes));

  // head + gill fronds
  drawHead(p, o);
  if (o.burst > 0) drawBurst(p, o);

  drawDrops(p, o.drops);
  p.outline(PAL.ink);

  // lunge speed lines (un-outlined effect pixels trailing the head, only over empty space)
  if (o.smear.length) {
    const from = o.smear[0];
    const mx = o.h[0] - from[0];
    const my = o.h[1] - from[1];
    const ml = Math.hypot(mx, my) || 1;
    const ux = mx / ml;
    const uy = my / ml;
    const T = headXf(o);
    for (const [lx, ly, len] of [
      [10, 8, 16],
      [4, 10, 10],
      [14, -9, 12],
    ] as const) {
      const [x0, y0] = T(lx, ly);
      for (let k = 1; k < len; k++) {
        const x = Math.round(x0 - ux * k);
        const y = Math.round(y0 - uy * k);
        if (!p.isOpaque(x, y)) p.set(x, y, k < len * 0.35 ? PAL.water4 : k < len * 0.7 ? PAL.water3 : PAL.water2);
      }
    }
  }
}

// ---------------------------------------------------------------- portrait (44×34)

function portrait(p: Canvas): void {
  // deep-sea backdrop: lighter water above, clean light shafts from the top-left, abyss below
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 44; x++) {
      let col: number = y < 7 ? PAL.water1 : y < 9 && PixelCanvas.ditherAt(x, y, 8) ? PAL.water1 : PAL.water0;
      const shaft = (x + y * 0.6) % 17;
      if (shaft < 3.2 && y < 24) col = PAL.water1;
      if (y > 27) col = y > 30 || PixelCanvas.ditherAt(x, y, 8) ? PAL.night0 : col;
      p.set(x, y, col);
    }
  const big = new PixelCanvas(W, H);
  drawSerpent(big, P({ jaw: 0.6, frill: 1.5, eye: 'wide', glow: 1.8, ha: -0.08, h: [44, 26], k2: [37, 39], rip: 0.3 }));
  const ox = 22;
  const oy = 6;
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 44; x++) {
      const col = big.get(ox + x, oy + y);
      if (col !== null) p.set(x, y, col);
    }
  // bubbles rising past the snout
  p.set(41, 20, PAL.water3).set(42, 15, PAL.water4).set(40, 9, PAL.water3).set(2, 30, PAL.water3).set(3, 26, PAL.water4);
}

// ---------------------------------------------------------------- export

const IMPACT_FRAME = 5;
const IMPACT = ANIMS.attack.poses[IMPACT_FRAME];
const MUZZLE = (() => {
  const T = headXf(shifted(IMPACT));
  const [x, y] = T(24.5, 1.8 + IMPACT.jaw * 1.6);
  return { x: Math.round(x), y: Math.round(y) };
})();

const art: MonsterArt = {
  id: 'coral_serpent',
  w: W,
  h: H,
  anchorX: 30,
  anchorY: 76,
  hover: 0,
  muzzle: MUZZLE,
  core: { x: 38, y: 46 },
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
    drawSerpent(p, poses[Math.max(0, Math.min(poses.length - 1, frame))]);
  },
  portrait,
};

export default art;
