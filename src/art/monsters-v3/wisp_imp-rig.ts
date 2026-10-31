// Tüy Hayalet / Down Wisp (wisp_imp, R3 redesign) — v3 rig: Pose → pixels.
//
// A tear-drop sheet-ghost made of overlapping white-lilac bird feathers: a round hood (the head) that
// flows down into a feathered skirt and ends in a question-mark tail (a single long feather streamer
// that hooks back up under the body); a dark face hollow on the hood's front with two dot eyes; two
// tiny three-feather hands; a two-feather cowlick on the crown. It floats (hover), nothing touches the
// floor.
//
// How a frame is built (every step in whole pixels, one key light from the frame's top-left for P1 /
// top-right for the P2 relight, IŞ-1/IŞ-2):
//   1. ONE signed-distance field holds the whole silhouette: hood ellipse ∪ skirt (a centre line that
//      sweeps back with `drift`, a width profile) ∪ tail (a tapered stroke along a hook-shaped spline),
//      morphed toward a cushion (`pillow`, the signature effect) and inflated by `puff` (the attack's
//      130 %). Feather tips are cut into its lower edge as scallops ≥ 3 px wide (`teeth`): they lift in
//      a wave (`ripple`) and bristle (`fluff`).
//   2. Planes: the field's gradient gives the edge normal, its depth the bulge → n·L → four flat bands
//      white / void4 / void3 / void2 (the hood's big lit plane stays calm, MA-2).
//   3. Texture = shingle creases: rows of downward scallops in the skirt's own coordinates (they ride
//      the drift), one ramp step darker, never ink, kept off the outline and the face (IŞ-5, MA-2).
//   4. Parts: far hand (one value darker, behind) → body → face hollow (void0 with an ink overhang) →
//      crest → near hand (cast shadow on the body under it) → loose feathers (outlined matter).
//   5. Outline (PAL.ink, 4-neighbour, once). Then light, never outlined (IŞ-9): the gold dot eyes,
//      sparks, and the small feather confetti (bursts / swirl / erosion drift).
// Deterministic: no Math.random / Date.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';

export const W = 64;
export const H = 62;
/** floor point (frame px): the ghost floats HOVER px above it, the tail tip never reaches it */
export const AX = 30;
export const GY = 58;
export const HOVER = 6;
/** hood (head) centre at rest and its radii */
export const HX = 31;
export const HY = 23;
const RX0 = 10.5;
const RY0 = 10;
/** skirt length at rest (hood centre → tail root) */
const L0 = 20;

// ------------------------------------------------------------------ pose

/** A tiny three-feather hand. Offsets from its rest root; ang in degrees (0 = forward, 90 = down). */
export interface Hand {
  x: number;
  y: number;
  ang: number;
  /** fan opening between the outer feathers (deg) */
  spread: number;
  /** feather length delta (px) */
  len: number;
}

/** A loose feather (matter: it is outlined). Root relative to the skirt top (HX + bx, HY + by); ang in
 * degrees of the root→tip line (0 = forward, 90 = down). */
export interface Feather {
  x: number;
  y: number;
  ang: number;
  len: number;
  /** bend of the vane (px, + = toward the right of root→tip) */
  bow?: number;
}

/** A spray of small feather confetti (light: never outlined). */
export interface Burst {
  /** frames since the spray left (0 = at the body) */
  t: number;
  n: number;
  /** origin relative to the hood centre */
  ox: number;
  oy: number;
  /** mean direction (rad, 0 = forward, −π/2 = up) and the fan around it (rad) */
  dir: number;
  fan: number;
  spd: number;
  /** downward drift per frame² (feathers settle) */
  grav?: number;
  seed: number;
}

export type Eyes = 'open' | 'blink' | 'shut' | 'happy' | 'wide' | 'squint' | 'squeeze' | 'dizzy' | 'x' | 'peek';

export interface Pose {
  /** whole-body offset (px) */
  bx: number;
  by: number;
  /** hood offset over the body (the head leads / lags the skirt) */
  hx: number;
  hy: number;
  /** squash / stretch of the hood radii (px) */
  sw: number;
  sh: number;
  /** inflation 0..1 (1 = the attack's 130 % puff) */
  puff: number;
  /** skirt bottom offset (px, + = forward) relative to the hood */
  drift: number;
  /** skirt length delta (px) */
  len: number;
  /** 0..1 morph toward the cushion (signature: the feather pillow) */
  pillow: number;
  /** feather-tip bristle 0..2 */
  fluff: number;
  /** edge wave phase 0..1 and its strength 0..1.5 */
  ripple: number;
  rippleAmp: number;
  /** tail: 0 = loose streamer, 1 = tight hook; tip sway (px, + forward); root lift (px) */
  tailCurl: number;
  tailSwing: number;
  tailLift: number;
  /** cowlick tip offset (px) */
  crestX: number;
  crestY: number;
  handN: Hand;
  handF: Hand;
  eyes: Eyes;
  lookX: number;
  lookY: number;
  /** eye light: 0 dots · 1 bright · 2 white-hot (spell) */
  glow: number;
  /** face hollow opening delta (−1 narrow … +3 "bö!") */
  hollow: number;
  /** the idle's detaching feather (null = in its slot on the back edge) */
  loose: Feather | null;
  free: Feather[];
  bursts: Burst[];
  /** summon vortex strength 0..1, its phase (frames) and the height it has climbed (px) */
  swirl: number;
  swirlT: number;
  swirlRise: number;
  /** dissolve 0..1 into feathers; erodeDir: −1 blown back (wind), 0 out from the core, +1 built bottom-up */
  erode: number;
  erodeDir: number;
  /** whole-body value lift (spell flash) 0/1 */
  lit: number;
  /** crackle motes round the body (spell) 0..2 */
  spark: number;
  seed: number;
}

const HAND0: Hand = { x: 0, y: 0, ang: 0, spread: 0, len: 0 };
/** the loose feather in its slot: sticking out of the back of the hood like a little wing */
export const REST_FEATHER: Feather = { x: -8, y: 1, ang: 152, len: 6.5, bow: -1.2 };

export const NEUTRAL: Pose = {
  bx: 0,
  by: 0,
  hx: 0,
  hy: 0,
  sw: 0,
  sh: 0,
  puff: 0,
  drift: 0,
  len: 0,
  pillow: 0,
  fluff: 0,
  ripple: 0,
  rippleAmp: 0,
  tailCurl: 0.6,
  tailSwing: 0,
  tailLift: 0,
  crestX: 0,
  crestY: 0,
  handN: HAND0,
  handF: HAND0,
  eyes: 'open',
  lookX: 0,
  lookY: 0,
  glow: 0,
  hollow: 0,
  loose: REST_FEATHER,
  free: [],
  bursts: [],
  swirl: 0,
  swirlT: 0,
  swirlRise: 0,
  erode: 0,
  erodeDir: 0,
  lit: 0,
  spark: 0,
  seed: 1,
};

export function pose(d: Partial<Pose>): Pose {
  return { ...NEUTRAL, ...d };
}

// ------------------------------------------------------------------ helpers

/** feather ramp, dark → light (2 = the body's mid plane) */
const F = [PAL.void1, PAL.void2, PAL.void3, PAL.void4, PAL.white] as const;
const toneIdx = new Map<number, number>(F.map((c, i) => [c, i]));

function hash(a: number, b: number, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) % 10007) / 10007;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** polynomial smooth minimum (k px of blend) */
function smin(a: number, b: number, k: number): number {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
}

function distSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): [number, number] {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return [Math.hypot(px - (ax + dx * t), py - (ay + dy * t)), t];
}

/** Catmull-Rom through pts, n samples per span. */
function spline(pts: readonly [number, number][], n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// ------------------------------------------------------------------ geometry

export interface Geo {
  /** hood centre and radii */
  hx: number;
  hy: number;
  rx: number;
  ry: number;
  /** skirt top (body centre at the hood's equator) and length */
  sx: number;
  sy: number;
  L: number;
  drift: number;
  puff: number;
  /** tail stroke: points and widths */
  tail: [number, number][];
  tailW: number[];
  /** the tail's bounding box (x0, y0, x1, y1), padded by its width */
  tailBox: [number, number, number, number];
  /** cushion centre / half sizes */
  px: number;
  py: number;
  pa: number;
  pb: number;
}

export function geo(pz: Pose): Geo {
  const puff = pz.puff;
  const sx = HX + pz.bx;
  const sy = HY + pz.by;
  const hx = sx + pz.hx;
  const hy = sy + pz.hy;
  const rx = RX0 + pz.sw + puff * 3;
  const ry = RY0 + pz.sh + puff * 2.5;
  const L = L0 + pz.len + puff * 1.5;
  const g: Geo = { hx, hy, rx, ry, sx, sy, L, drift: pz.drift, puff, tail: [], tailW: [], tailBox: [0, 0, 0, 0], px: sx, py: sy + 7, pa: 14 + puff * 2 + pz.sw * 0.7, pb: 11 + puff * 2 + pz.sh * 0.7 };
  // tail: from the skirt's bottom, down and back, then hooking up and forward (a "?" laid on its side)
  const [bx0, by0] = skirtAt(g, 1);
  const c = pz.tailCurl;
  const sw = pz.tailSwing;
  const lift = pz.tailLift;
  const ctrl: [number, number][] = [
    [bx0 + 1, by0 - 4 - lift * 0.3],
    [bx0, by0 - lift * 0.5],
    [bx0 - 2.5 + sw * 0.25, by0 + 4 - lift * 0.7],
    [bx0 - 7.5 + sw * 0.5, by0 + 6 - c * 0.5 - lift],
    [bx0 - 12 + sw * 0.8, by0 + 4.5 - c * 1.5 - lift],
    [bx0 - 14.5 + sw + c * 0.8, by0 + 0.5 - c * 3 - lift],
  ];
  g.tail = spline(ctrl, 6);
  const n = g.tail.length;
  g.tailBox = [Math.min(...g.tail.map((q) => q[0])) - 5, Math.min(...g.tail.map((q) => q[1])) - 5, Math.max(...g.tail.map((q) => q[0])) + 5, Math.max(...g.tail.map((q) => q[1])) + 5];
  g.tailW = g.tail.map((_, i) => {
    const t = i / (n - 1);
    return 3.6 - 2.5 * Math.pow(t, 0.8) + (t > 0.82 ? 0.5 * Math.sin(((t - 0.82) / 0.18) * Math.PI) : 0);
  });
  return g;
}

/** skirt centre line at s ∈ [0, 1] (hood equator → tail root) */
function skirtAt(g: Geo, s: number): [number, number] {
  return [g.sx - 3 * s + g.drift * s * s, g.sy + g.L * s];
}

/** skirt half-width at s (the smooth sheet under the tiers) */
function skirtW(g: Geo, s: number): number {
  const r = g.rx;
  const P: [number, number][] = [
    [0, r],
    [0.3, r + 0.6 + g.puff],
    [0.6, r - 1.6 + g.puff],
    [0.84, r - 5 + g.puff * 0.5],
    [1, 2.6],
  ];
  for (let i = 0; i < P.length - 1; i++) {
    const [s0, w0] = P[i];
    const [s1, w1] = P[i + 1];
    if (s <= s1) {
      const t = (s - s0) / (s1 - s0);
      const k = 0.5 - 0.5 * Math.cos(Math.PI * clamp(t, 0, 1));
      return w0 + (w1 - w0) * k;
    }
  }
  return 2.6;
}

/**
 * The plumage: big overlapping feathers that hang from under the hood and sweep back and down along
 * the tear-drop, painted back to front. Each is a leaf with its own flat bands (lit edge toward the
 * key light, vane, underside) so every feather reads on its own, even laid over its neighbours; the
 * whole plumage darkens into lilac on the shadow side and toward the tail.
 * Keys are hood-relative (x forward, y down) at rest; `side` −1 = back row, +1 = front row.
 */
const PLUMES: readonly { r: [number, number]; t: [number, number]; w: number; bow: number; row: number }[] = [
  // back row (behind, half hidden): the back plume sweeping out behind like a wing, the breast feather
  { r: [-6, 3], t: [-15, 7.5], w: 7, bow: -1.6, row: 0 },
  { r: [6, 5], t: [8.5, 13.5], w: 6.4, bow: 0.8, row: 0 },
  // middle row
  { r: [-4, 6], t: [-12.5, 15.5], w: 7.6, bow: -1.2, row: 1 },
  { r: [3, 7], t: [1.5, 16.5], w: 7.2, bow: 0.5, row: 1 },
  // front row
  { r: [-1, 9], t: [-7, 19.5], w: 7, bow: -0.8, row: 2 },
];

export interface Plume {
  rx: number;
  ry: number;
  tx: number;
  ty: number;
  w: number;
  bow: number;
  row: number;
}

/** the plumes of a pose (frame px): they ride the body, swing with the drift, splay with puff / fluff */
export function plumesOf(pz: Pose, g: Geo): Plume[] {
  const out: Plume[] = [];
  if (pz.pillow >= 0.55) return out;
  const fold = 1 - pz.pillow / 0.55;
  PLUMES.forEach((P, k) => {
    const rx = g.sx + P.r[0] * (1 + g.puff * 0.25);
    const ry = g.sy + P.r[1] + (g.L - L0) * 0.3;
    let dx = P.t[0] - P.r[0];
    let dy = (P.t[1] - P.r[1]) * (g.L / L0);
    // splay: away from the body's axis
    const away = Math.sign(P.t[0] + 2) || 1;
    const lift = pz.rippleAmp * Math.max(0, Math.sin(Math.PI * 2 * (pz.ripple - k / PLUMES.length)));
    const spl = (pz.fluff * 1.2 + g.puff * 2.2 + lift * 1.6) * away;
    dx += spl + g.drift * (0.4 + 0.25 * P.row);
    dy += -lift * 1.2 + pz.fluff * 0.6 + g.puff * 1.2;
    out.push({ rx, ry, tx: rx + dx * fold, ty: ry + dy * fold, w: (P.w + g.puff * 1.2) * (0.5 + 0.5 * fold), bow: P.bow + pz.fluff * 0.3 * away, row: P.row });
  });
  return out;
}

/** Irregular per-feather length (px): a feather fringe is never a saw. */
const FLEN = [0.5, -0.3, 0.7, 0.1, -0.4, 0.6, -0.1, 0.3, -0.5, 0.2, 0.6, -0.2];

/** surface kinds */
const HOOD = 0;
const PLUME = 1;
const TAIL = 2;
const BASE = 3;
const CUSHION = 4;

interface Field {
  /** kind at each pixel (−1 = empty) */
  kind: Int8Array;
  /** paint depth (higher = in front): base 1, tail 2, plume k 10 + k, hood 100 */
  depth: Int16Array;
  /** a plume pixel's own band (4 lit edge, 3 vane, 2 underside) */
  band: Int8Array;
  /** smooth signed distance of the sheet (cushion morph and its piping) */
  sdf: Float32Array;
}

/** a smooth sheet (hood ∪ skirt) distance, `shrink` px inside the skirt */
function sheetSdf(g: Geo, x: number, y: number, shrink = 0): number {
  const ux = (x - g.hx) / g.rx;
  const uy = (y - g.hy) / g.ry;
  const dHood = (Math.hypot(ux, uy) - 1) * Math.min(g.rx, g.ry);
  const s = (y - g.sy) / g.L;
  let dSkirt = 99;
  if (s >= -0.05) {
    const sc = clamp(s, 0, 1);
    const [cx] = skirtAt(g, sc);
    dSkirt = Math.abs(x - cx) - (skirtW(g, sc) - shrink);
    if (s > 1) dSkirt = Math.max(dSkirt, (s - 1) * g.L);
  }
  return smin(dHood, dSkirt, 4);
}

function tailDist(g: Geo, x: number, y: number): number {
  const b = g.tailBox;
  if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) return 99;
  let dTail = 99;
  for (let i = 0; i < g.tail.length - 1; i++) {
    const [d, t] = distSeg(x, y, g.tail[i][0], g.tail[i][1], g.tail[i + 1][0], g.tail[i + 1][1]);
    const w = g.tailW[i] + (g.tailW[i + 1] - g.tailW[i]) * t;
    dTail = Math.min(dTail, d - w);
  }
  return dTail;
}

function pillowSdf(g: Geo, x: number, y: number): number {
  const dx = Math.abs(x - g.px) / g.pa;
  const dy = Math.abs(y - g.py) / g.pb;
  const se = Math.pow(Math.pow(dx, 3.2) + Math.pow(dy, 3.2), 1 / 3.2);
  let d = (se - 1) * Math.min(g.pa, g.pb);
  // four corner tufts (a cushion's corners)
  for (const [cx, cy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const tx = g.px + cx * (g.pa - 0.5);
    const ty = g.py + cy * (g.pb - 0.5);
    const [dd] = distSeg(x, y, tx - cx * 0.6, ty - cy * 0.6, tx + cx * 1.3, ty + cy * 0.9);
    d = Math.min(d, dd - 2);
  }
  return d;
}

/** the hood: its ellipse, its bottom edge a hem of small rounded feather tips over the plumage */
function inHood(pz: Pose, g: Geo, x: number, y: number): boolean {
  const ux = (x - g.hx) / g.rx;
  const uy = (y - g.hy) / g.ry;
  if (ux * ux + uy * uy <= 1) return true;
  if (y < g.hy || Math.abs(ux) > 0.86) return false;
  const bottom = g.hy + g.ry * Math.sqrt(Math.max(0, 1 - ux * ux));
  const n = 4;
  const f = ((ux + 0.86) / 1.72) * n;
  const fr = ((f % 1) + 1) % 1;
  const idx = Math.floor(f);
  const tip = (2 + FLEN[(idx + 3) % FLEN.length] * 0.6 + pz.fluff * 0.7 + g.puff * 0.6) * Math.pow(Math.sin(Math.PI * fr), 0.55);
  return y <= bottom - 0.6 + tip;
}

function buildField(pz: Pose, g: Geo, side: 1 | -1): Field {
  const kind = new Int8Array(W * H).fill(-1);
  const depth = new Int16Array(W * H).fill(-1);
  const band = new Int8Array(W * H).fill(-1);
  const sdf = new Float32Array(W * H).fill(99);
  const P = pz.pillow;
  const put = (i: number, k: number, d: number) => {
    if (d >= depth[i]) {
      kind[i] = k;
      depth[i] = d;
    }
  };
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const px = x + 0.5;
      const py = y + 0.5;
      if (P > 0) {
        const d = sheetSdf(g, px, py) * (1 - P) + pillowSdf(g, px, py) * P;
        sdf[i] = d;
        if (d <= 0 && P >= 0.25) put(i, CUSHION, P >= 0.5 ? 200 : 5);
        if (P >= 0.5) continue;
      }
      if (inHood(pz, g, px, py)) put(i, HOOD, 100);
      else if (sheetSdf(g, px, py, 2.2) <= 0) put(i, BASE, 1);
      if (tailDist(g, px, py) <= 0) put(i, TAIL, 2);
    }
  if (P < 0.55) {
    const tmp = new Int8Array(W * H);
    plumesOf(pz, g).forEach((pl, k) => {
      tmp.fill(-1);
      leaf(tmp, pl.rx, pl.ry, pl.tx, pl.ty, pl.bow, pl.w, side, 0, true);
      for (let i = 0; i < W * H; i++) {
        if (tmp[i] < 0) continue;
        if (depth[i] >= 100) continue; // the hood lies over the plumes' roots
        kind[i] = PLUME;
        depth[i] = 10 + k;
        band[i] = tmp[i];
      }
    });
  }
  return { kind, depth, band, sdf };
}

// ------------------------------------------------------------------ painters

/**
 * A feather leaf from (rx, ry) to (tx, ty), bowing `bow` px, widest a third of the way out. Banded by
 * what faces the light (lit edge / vane / underside), `dark` shifts it one value down (far hand).
 * Writes tone indices (into F) into `out` (a tone map), and marks the mask.
 */
function leaf(out: Int8Array, rx: number, ry: number, tx: number, ty: number, bow: number, width: number, side: 1 | -1, dark: number, quill = false): void {
  const mask = new Uint8Array(W * H);
  /** signed offset across the feather (px, + = toward the axis normal) and progress along it */
  const across = new Float32Array(W * H).fill(99);
  const along = new Float32Array(W * H);
  const n = 18;
  const dx = tx - rx;
  const dy = ty - ry;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  let bx0 = W;
  let by0 = H;
  let bx1 = 0;
  let by1 = 0;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const px = rx + dx * f + nx * bow * Math.sin(Math.PI * f);
    const py = ry + dy * f + ny * bow * Math.sin(Math.PI * f);
    const wd = Math.max(0.55, (width / 2) * Math.pow(Math.sin(Math.PI * (0.12 + f * 0.8)), 0.6));
    bx0 = Math.min(bx0, Math.floor(px - wd - 2));
    by0 = Math.min(by0, Math.floor(py - wd - 2));
    bx1 = Math.max(bx1, Math.ceil(px + wd + 2));
    by1 = Math.max(by1, Math.ceil(py + wd + 2));
    const x0 = Math.floor(px - wd - 1);
    const x1 = Math.ceil(px + wd + 1);
    const y0 = Math.floor(py - wd - 1);
    const y1 = Math.ceil(py + wd + 1);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
        const ox = x + 0.5 - px;
        const oy = y + 0.5 - py;
        if (Math.hypot(ox, oy) <= wd + 0.15) {
          const k = y * W + x;
          mask[k] = 1;
          const a = ox * nx + oy * ny;
          if (Math.abs(a) < Math.abs(across[k])) {
            across[k] = a;
            along[k] = f;
          }
        }
      }
  }
  // which half of the vane faces the key light (screen-plane light direction)
  const lx = 0.56 * side;
  const lit = nx * lx + ny * -0.83 > 0 ? 1 : -1;
  const has = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] === 1;
  for (let y = Math.max(1, by0); y < Math.min(H - 1, by1); y++)
    for (let x = Math.max(1, bx0); x < Math.min(W - 1, bx1); x++) {
      if (!has(x, y)) continue;
      const k = y * W + x;
      const toLight = !has(x + side, y) || !has(x, y - 1);
      const away = !has(x - side, y) || !has(x, y + 1);
      let t = 3;
      if (quill) {
        // two half-vanes split by the quill: the light-facing half lit, the other half the vane tone,
        // the quill one step under the vane (1 px seam) along the middle of the feather
        const a = across[k] * lit;
        t = a > 0.5 ? 4 : 3;
        if (Math.abs(across[k]) <= 0.5 && along[k] > 0.12 && along[k] < 0.8) t = 2;
        if (away && !toLight && t > 2) t -= 1;
      } else if (toLight && !away) t = 4;
      else if (away && !toLight) t = 2;
      out[k] = Math.max(1, t - dark);
    }
}

function handRoot(g: Geo, near: boolean): [number, number] {
  const s = 0.42;
  const [cx, cy] = skirtAt(g, s);
  const w = skirtW(g, s);
  return near ? [cx + w - 1.5, cy + 1] : [cx - w + 1.5, cy - 1];
}

function paintHand(out: Int8Array, g: Geo, h: Hand, near: boolean, side: 1 | -1): void {
  const [rx0, ry0] = handRoot(g, near);
  const rx = rx0 + h.x;
  const ry = ry0 + h.y;
  const base = (near ? 30 : 150) + (near ? h.ang : -h.ang);
  const spread = 34 + h.spread;
  const len = (near ? 6 : 5) + h.len;
  const dark = near ? 0 : 1;
  for (let k = -1; k <= 1; k++) {
    const a = ((base + k * spread * 0.5) * Math.PI) / 180;
    const l = len - (k === 0 ? 0 : 0.8);
    leaf(out, rx, ry, rx + Math.cos(a) * l, ry + Math.sin(a) * l, k * 0.6 * (near ? 1 : -1), 3.2, side, dark);
  }
}

/** A loose (outlined) feather into a tone map. */
function paintLoose(out: Int8Array, g: Geo, f: Feather, side: 1 | -1, quill = true): void {
  const a = (f.ang * Math.PI) / 180;
  const x = g.sx + f.x;
  const y = g.sy + f.y;
  leaf(out, x, y, x + Math.cos(a) * f.len, y + Math.sin(a) * f.len, f.bow ?? 0.8, quill ? 3.4 : 4.2, side, 0, quill);
}

// ------------------------------------------------------------------ the face

export function hollowCentre(pz: Pose, g: Geo = geo(pz)): [number, number] {
  const p = pz.pillow;
  return [Math.round(g.hx + 4 * (1 - p) + 1 * p), Math.round(g.hy + 1 + 4 * p)];
}

function inHollow(pz: Pose, g: Geo, x: number, y: number): number {
  const [cx, cy] = hollowCentre(pz, g);
  const rx = 4.3 + pz.hollow * 0.35 + g.puff * 0.6;
  const ry = 4.6 + pz.hollow * 0.9 + g.puff * 0.5;
  const u = (x + 0.5 - (cx + 0.5)) / rx;
  const v = (y + 0.5 - (cy + 0.5)) / ry;
  return u * u + v * v;
}

/** the two dot eyes (light, after the outline) */
function paintEyes(p: PixelCanvas, pz: Pose, g: Geo): void {
  if (pz.erode > 0.93) return;
  const [cx, cy] = hollowCentre(pz, g);
  const lx = clamp(pz.lookX, -1, 1);
  const ly = clamp(pz.lookY, -1, 1);
  const ey = cy - 1 + ly + (pz.hollow >= 2 ? -1 : 0);
  const eyesX = [cx - 3 + lx, cx + 1 + lx];
  const hot = pz.glow >= 2;
  const c4 = hot ? PAL.white : PAL.gold4;
  const c3 = hot ? PAL.gold4 : pz.glow >= 1 ? PAL.gold4 : PAL.gold3;
  const set = (x: number, y: number, c: number) => {
    if (x >= 1 && y >= 1 && x < W - 1 && y < H - 1) p.set(x, y, c);
  };
  eyesX.forEach((ex, i) => {
    const near = i === 1;
    switch (pz.eyes) {
      case 'open':
        set(ex, ey, c4);
        set(ex + 1, ey, c4);
        set(ex, ey + 1, c3);
        set(ex + 1, ey + 1, c4);
        break;
      case 'wide':
        set(ex, ey - 1, c4);
        set(ex + 1, ey - 1, c4);
        set(ex, ey, c4);
        set(ex + 1, ey, c4);
        set(ex, ey + 1, c3);
        set(ex + 1, ey + 1, c3);
        break;
      case 'blink':
        set(ex, ey + 1, c3);
        set(ex + 1, ey + 1, c3);
        break;
      case 'shut':
        set(ex, ey + 1, PAL.gold2);
        set(ex + 1, ey + 1, PAL.gold2);
        break;
      case 'peek':
        set(ex, ey + 1, c4);
        set(ex + 1, ey + 1, c4);
        break;
      case 'happy':
        set(ex, ey + 1, c3);
        set(ex + 1, ey, c4);
        set(ex + 2, ey + 1, c3);
        break;
      case 'squint':
        // narrowed and slanted toward the nose (angry)
        set(ex + (near ? 0 : 1), ey, c3);
        set(ex + (near ? 1 : 0), ey + 1, c4);
        set(ex + (near ? 0 : 1), ey + 1, c4);
        break;
      case 'squeeze': {
        // > <
        const k = near ? -1 : 1;
        const x0 = near ? ex + 1 : ex;
        set(x0, ey - 1, c3);
        set(x0 + k, ey, c4);
        set(x0, ey + 1, c3);
        break;
      }
      case 'x':
        set(ex - 1 + (near ? 1 : 0), ey - 1, c3);
        set(ex + 1 + (near ? 1 : 0), ey - 1, c3);
        set(ex + (near ? 1 : 0), ey, c4);
        set(ex - 1 + (near ? 1 : 0), ey + 1, c3);
        set(ex + 1 + (near ? 1 : 0), ey + 1, c3);
        break;
      case 'dizzy':
        set(ex, ey, c4);
        set(ex + 1, ey, c3);
        set(ex + 1, ey + 1, c4);
        set(ex, ey + 1, c3);
        set(ex - 1, ey + (near ? -1 : 1), c3);
        break;
    }
  });
  if (pz.glow >= 1) {
    // a 1-px halo glow on the hollow's floor under the eyes (light: the hollow catches it)
    for (const ex of eyesX) {
      if (p.get(ex, ey + 2) === PAL.void0) set(ex, ey + 2, PAL.void2);
      if (p.get(ex + 1, ey + 2) === PAL.void0) set(ex + 1, ey + 2, PAL.void2);
    }
  }
}

// ------------------------------------------------------------------ confetti (light)

/** small flying feathers in 4 attitudes; s = quill (darker), t = vane tip */
const CONF: readonly (readonly string[])[] = [
  ['.tt', 'ss.'],
  ['tt.', '.ss'],
  ['t.', 'ts', '.s'],
  ['.t', 'st', 's.'],
];

export function confetti(p: PixelCanvas, x: number, y: number, att: number, far = false, under?: (x: number, y: number) => boolean): void {
  const rows = CONF[((att % 4) + 4) % 4];
  const sh = far ? PAL.void3 : PAL.void4;
  const tp = far ? PAL.void4 : PAL.white;
  for (let r = 0; r < rows.length; r++)
    for (let k = 0; k < rows[r].length; k++) {
      const ch = rows[r][k];
      const xx = x + k;
      const yy = y + r;
      if (xx < 2 || yy < 2 || xx >= W - 2 || yy >= H - 2) continue;
      if (under && under(xx, yy)) continue;
      if (ch === 's') p.set(xx, yy, sh);
      else if (ch === 't') p.set(xx, yy, tp);
    }
}

function paintBursts(p: PixelCanvas, g: Geo, pz: Pose): void {
  for (const b of pz.bursts) {
    for (let i = 0; i < b.n; i++) {
      const hx = hash(b.seed, i, 1);
      const hy = hash(b.seed, i, 2);
      const ang = b.dir + (hx - 0.5) * b.fan;
      const sp = (1.3 + hy * 2.2) * b.spd;
      const t = b.t;
      const run = sp * (t - t * t * 0.05);
      const fx = g.hx + b.ox + Math.cos(ang) * run + Math.sin(t * 1.3 + i) * 0.8 * Math.min(1, t / 2);
      const fy = g.hy + b.oy + Math.sin(ang) * run + t * t * (b.grav ?? 0.12);
      confetti(p, Math.round(fx), Math.round(fy), Math.floor(hash(b.seed, i, 3) * 4) + (t >> 1), i % 3 === 0);
    }
  }
}

function paintSwirl(p: PixelCanvas, g: Geo, pz: Pose, body: Uint8Array): void {
  if (pz.swirl <= 0) return;
  const n = Math.round(4 + pz.swirl * 8);
  const cx = AX + 1;
  const base = GY - HOVER - 2 - pz.swirlRise;
  for (let i = 0; i < n; i++) {
    const h = hash(pz.seed, i, 11);
    const a = ((pz.swirlT * 0.9 + i / n) % 1) * Math.PI * 2 + h * 0.5;
    const r = (6 + 9 * pz.swirl) * (0.7 + 0.5 * hash(pz.seed, i, 12));
    const hh = (i / n) * (14 + 16 * pz.swirl);
    const x = Math.round(cx + Math.cos(a) * r - 1);
    const y = Math.round(base - hh + Math.sin(a) * r * 0.32);
    const behind = Math.sin(a) < 0;
    confetti(p, x, y, Math.floor(a * 2) + i, behind, behind ? (xx, yy) => body[yy * W + xx] === 1 : undefined);
  }
  void g;
}

function paintSparks(p: PixelCanvas, g: Geo, pz: Pose): void {
  if (pz.spark <= 0) return;
  const n = pz.spark >= 2 ? 6 : 3;
  for (let i = 0; i < n; i++) {
    const a = hash(pz.seed, i, 21) * Math.PI * 2;
    const r = g.rx + 3 + hash(pz.seed, i, 22) * 4;
    const x = Math.round(g.sx + Math.cos(a) * r);
    const y = Math.round(g.sy + 6 + Math.sin(a) * r * 1.1);
    if (x < 3 || y < 3 || x > W - 4 || y > H - 4) continue;
    p.set(x, y, PAL.gold4);
    if (pz.spark >= 2 && i % 2 === 0) {
      p.set(x - 1, y, PAL.gold3);
      p.set(x + 1, y, PAL.gold3);
      p.set(x, y - 1, PAL.gold3);
      p.set(x, y + 1, PAL.gold3);
    }
  }
}

// ------------------------------------------------------------------ the draw

function normalAt(g: Geo, x: number, y: number, kind: number): [number, number, number] {
  let nx: number;
  let ny: number;
  let nz: number;
  if (kind === TAIL) {
    // the tail: a tube round its spline
    let best = 99;
    let bi = 0;
    let bt = 0;
    for (let i = 0; i < g.tail.length - 1; i++) {
      const [d, tt] = distSeg(x, y, g.tail[i][0], g.tail[i][1], g.tail[i + 1][0], g.tail[i + 1][1]);
      if (d < best) [best, bi, bt] = [d, i, tt];
    }
    const a = g.tail[bi];
    const b = g.tail[bi + 1];
    const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const px = -(b[1] - a[1]) / tl;
    const py = (b[0] - a[0]) / tl;
    const cx = a[0] + (b[0] - a[0]) * bt;
    const cy = a[1] + (b[1] - a[1]) * bt;
    const w = g.tailW[bi] + (g.tailW[bi + 1] - g.tailW[bi]) * bt + 0.6;
    const o = clamp(((x - cx) * px + (y - cy) * py) / w, -1, 1);
    nx = px * o;
    ny = py * o + 0.1;
    nz = Math.sqrt(Math.max(0.05, 1 - o * o));
  } else if (kind === HOOD) {
    const ux = (x - g.hx) / g.rx;
    const uy = (y - g.hy) / g.ry;
    const r2 = Math.min(1, ux * ux + uy * uy);
    [nx, ny, nz] = [ux, uy * (uy > 0 ? 0.55 : 0.9), Math.sqrt(1 - r2)];
  } else if (kind === CUSHION) {
    const dx = (x - g.px) / g.pa;
    const dy = (y - g.py) / g.pb;
    const se = Math.pow(Math.pow(Math.abs(dx), 3.2) + Math.pow(Math.abs(dy), 3.2), 1 / 3.2);
    nz = Math.sqrt(Math.max(0.05, 1 - Math.pow(Math.min(1, se), 6)));
    let qx = Math.sign(dx) * Math.pow(Math.abs(dx), 2.2);
    let qy = Math.sign(dy) * Math.pow(Math.abs(dy), 2.2);
    const ql = Math.hypot(qx, qy) || 1;
    const m = Math.sqrt(1 - nz * nz);
    qx = (qx / ql) * m;
    qy = (qy / ql) * m + 0.08;
    nx = qx;
    ny = qy;
  } else {
    // the sheet under the plumes (a cone, tilting down as it narrows)
    const s = clamp((y - g.sy) / g.L, 0, 1);
    const [cx] = skirtAt(g, s);
    const w = Math.max(1.5, skirtW(g, s));
    const u = clamp((x - cx) / w, -1, 1);
    nx = u * 0.95;
    nz = Math.sqrt(Math.max(0.05, 1 - u * u));
    ny = 0.15 + 0.4 * s;
  }
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}

/** on the tail's quill: within half a pixel of its spline, between its root and its tip */
function tailQuill(g: Geo, x: number, y: number): boolean {
  const n = g.tail.length;
  let best = 99;
  let bi = 0;
  for (let i = 0; i < n - 1; i++) {
    const [d] = distSeg(x, y, g.tail[i][0], g.tail[i][1], g.tail[i + 1][0], g.tail[i + 1][1]);
    if (d < best) [best, bi] = [d, i];
  }
  const t = bi / (n - 1);
  return best <= 0.55 && t > 0.3 && t < 0.88;
}

export interface DrawResult {
  geo: Geo;
}

const quant = (dl: number) => (dl >= 0.3 ? 4 : dl >= 0 ? 3 : dl >= -0.36 ? 2 : 1);

export function drawWisp(p: PixelCanvas, pz: Pose, lightFrom: 'left' | 'right' = 'left'): DrawResult {
  const side: 1 | -1 = lightFrom === 'left' ? -1 : 1; // the frame edge the light comes from (x sign)
  const L = [0.5 * side, -0.74, 0.46];
  const ln = Math.hypot(L[0], L[1], L[2]);
  L[0] /= ln;
  L[1] /= ln;
  L[2] /= ln;
  const g = geo(pz);
  const field = buildField(pz, g, side);
  const kind = field.kind;
  const dep = field.depth;
  const tone = new Int8Array(W * H).fill(-1);
  const keep = new Uint8Array(W * H);
  const body = new Uint8Array(W * H);
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && kind[y * W + x] >= 0;

  // far hand behind everything
  const farHand = new Int8Array(W * H).fill(-1);
  paintHand(farHand, g, pz.handF, false, side);
  for (let i = 0; i < W * H; i++) if (farHand[i] >= 0) tone[i] = farHand[i];

  // planes
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const k = kind[i];
      if (k < 0) continue;
      body[i] = 1;
      if (k === PLUME) {
        // a feather's own bands, shifted by where it hangs: the shadow side and the lower plumage go lilac
        const [nx, ny, nz] = normalAt(g, x + 0.5, y + 0.5, BASE);
        const dl = nx * L[0] + ny * L[1] + nz * L[2];
        const shift = dl >= 0.05 ? 0 : dl >= -0.3 ? -1 : -2;
        tone[i] = clamp(field.band[i] + shift, 1, 4);
        continue;
      }
      const [nx, ny, nz] = normalAt(g, x + 0.5, y + 0.5, k);
      let dl = nx * L[0] + ny * L[1] + nz * L[2];
      if (k === BASE) dl -= 0.35;
      if (k === TAIL) dl -= 0.08;
      tone[i] = quant(dl);
      // the tail is one long feather: its quill runs down the middle (1 px, a step under the vane)
      if (k === TAIL && tailQuill(g, x + 0.5, y + 0.5)) tone[i] = Math.max(1, tone[i] - 1);
    }

  // cast shade: whatever lies in front casts one step of shade on the surface right under it
  // (the hood's lip on the plumes, each plume on the plume or sheet behind it; IŞ-5/IŞ-6, never ink)
  {
    const sh: number[] = [];
    for (let y = 2; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (kind[i] < 0 || kind[i] === CUSHION) continue;
        const d = dep[i];
        const up = dep[i - W];
        const lt = dep[i + side]; // toward the light
        if ((kind[i - W] >= 0 && up > d) || (kind[i + side] >= 0 && lt > d && kind[i + side] === PLUME)) sh.push(i);
      }
    for (const i of sh) {
      tone[i] = Math.max(1, tone[i] - 1);
      keep[i] = 1;
    }
    // the cushion's piping: one darker ring two pixels in from its edge
    if (pz.pillow >= 0.5) for (let i = 0; i < W * H; i++) if (kind[i] === CUSHION && field.sdf[i] <= -2 && field.sdf[i] > -3.1) tone[i] = Math.max(1, tone[i] - 1);
  }

  // shadow-side rim light (IŞ-7): one continuous pixel line on the dark edge
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (!body[i] || tone[i] > 1) continue;
      const out = !inside(x - side, y) || !inside(x, y + 1);
      if (out && inside(x + side, y)) tone[i] = 2;
    }

  // face hollow (a hole in the sheet: void0, its top rows in the hood's ink overhang)
  const holl = new Uint8Array(W * H);
  if (pz.erode < 0.97) {
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (!body[i]) continue;
        if (inHollow(pz, g, x, y) <= 1) holl[i] = 1;
      }
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (!holl[i]) continue;
        const top = !holl[i - W] || !holl[i - 2 * W];
        const bot = !holl[i + W];
        tone[i] = top ? -2 : bot ? -4 : -3; // codes: −2 ink, −3 void0, −4 void1
      }
    // the hood's lip over the hollow casts one step of shade on the feathers round its lower rim
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (holl[i] || !body[i]) continue;
        if (holl[i - W] && tone[i] >= 3) tone[i] = tone[i] - 1;
      }
  }

  // crest: one cowlick feather on the crown, curling forward (it echoes the tail's question mark)
  if (pz.erode < 0.6 && pz.pillow < 0.7) {
    const crest = new Int8Array(W * H).fill(-1);
    const r2x = g.hx - 1;
    const r2y = g.hy - g.ry + 2.5;
    leaf(crest, r2x, r2y, r2x + 4.5 + pz.crestX, r2y - 5.5 + pz.crestY, -2.2, 3.4, side, 0, true);
    // a small second barb behind it
    leaf(crest, r2x - 2, r2y + 0.5, r2x - 3.5 + pz.crestX * 0.5, r2y - 3 + pz.crestY * 0.6, -0.6, 2.4, side, 0);
    for (let i = 0; i < W * H; i++) if (crest[i] >= 0 && !body[i]) {
      tone[i] = crest[i];
      body[i] = 1;
    }
  }

  // near hand over the body, with its cast shadow on the feathers under it (IŞ-6)
  const nearHand = new Int8Array(W * H).fill(-1);
  paintHand(nearHand, g, pz.handN, true, side);
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (nearHand[i] >= 0) continue;
      if (tone[i] < 1) continue;
      // body pixel just below / away from the light of a hand pixel
      if (nearHand[i - W] >= 0 || nearHand[i + side] >= 0) tone[i] = Math.max(1, tone[i] - 1);
    }
  for (let i = 0; i < W * H; i++) if (nearHand[i] >= 0) {
    tone[i] = nearHand[i];
    body[i] = 1;
  }

  // loose feathers (matter)
  const loose = new Int8Array(W * H).fill(-1);
  if (pz.loose) paintLoose(loose, g, pz.loose, side);
  for (let i = 0; i < W * H; i++) if (loose[i] >= 0) tone[i] = loose[i];

  // spell flash: everything one value up
  if (pz.lit > 0) for (let i = 0; i < W * H; i++) if (tone[i] >= 0) tone[i] = Math.min(4, tone[i] + pz.lit);

  // to pixels
  const layer = new PixelCanvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const t = tone[y * W + x];
      if (t === -1) continue;
      const c = t >= 0 ? F[t] : t === -2 ? PAL.ink : t === -3 ? PAL.void0 : PAL.void1;
      layer.set(x, y, c);
    }
  for (let i = 0; i < W * H; i++) if (holl[i]) keep[i] = 1;
  despeckleTones(layer, keep);

  // dissolve (death / summon / revive): 2×2 cells leave as feathers, the face last
  const drift: [number, number, number, number][] = [];
  if (pz.erode > 0) erodeCells(layer, pz, g, drift);

  p.blit(layer, 0, 0);
  // free feathers (summon's falling feather, the death's strays) are never eroded with the body
  if (pz.free.length) {
    const fr = new Int8Array(W * H).fill(-1);
    for (const f of pz.free) paintLoose(fr, g, f, side, false);
    for (let i = 0; i < W * H; i++) if (fr[i] >= 0) p.set(i % W, Math.floor(i / W), F[fr[i]]);
  }
  p.outline(PAL.ink);

  // light after the outline
  const bodyNow = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (p.isOpaque(x, y)) bodyNow[y * W + x] = 1;
  paintEyes(p, pz, g);
  for (const [x, y, att, far] of drift) confetti(p, x, y, att, far === 1);
  paintBursts(p, g, pz);
  paintSwirl(p, g, pz, bodyNow);
  paintSparks(p, g, pz);
  return { geo: g };
}

/** a lone pixel of a feather tone inside the body takes its neighbours' tone (IŞ-4) */
function despeckleTones(c: PixelCanvas, keep: Uint8Array): void {
  for (let pass = 0; pass < 2; pass++) {
    const upd: [number, number, number][] = [];
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        if (keep[y * W + x]) continue;
        const col = c.get(x, y);
        if (col === null || !toneIdx.has(col)) continue;
        const nb = [c.get(x - 1, y), c.get(x + 1, y), c.get(x, y - 1), c.get(x, y + 1)];
        if (nb.some((n) => n === null)) continue;
        if (nb.some((n) => n === col)) continue;
        const cnt = new Map<number, number>();
        for (const n of nb) if (n !== null && toneIdx.has(n)) cnt.set(n, (cnt.get(n) ?? 0) + 1);
        let best = col;
        let bc = 0;
        for (const [k, n] of cnt) if (n > bc) [best, bc] = [k, n];
        if (best !== col) upd.push([x, y, best]);
      }
    for (const [x, y, col] of upd) c.set(x, y, col);
  }
}

function erodeCells(c: PixelCanvas, pz: Pose, g: Geo, drift: [number, number, number, number][]): void {
  const e = pz.erode;
  const [fx, fy] = hollowCentre(pz, g);
  const bb = c.bounds();
  if (!bb) return;
  const dir = pz.erodeDir;
  for (let cy = Math.floor(bb.y / 2); cy <= Math.floor((bb.y + bb.h) / 2); cy++)
    for (let cx = Math.floor(bb.x / 2); cx <= Math.floor((bb.x + bb.w) / 2); cx++) {
      const mx = cx * 2 + 1;
      const my = cy * 2 + 1;
      const r = hash(cx, cy, pz.seed);
      let order: number;
      const dFace = Math.hypot(mx - fx, my - fy);
      if (dir < 0) {
        // the wind takes it from the front edge (the attacker's side) backward, in ragged streaks
        const u = clamp((mx - (g.sx - 16)) / 34, 0, 1);
        order = (1 - u) * 0.6 + r * 0.4;
      } else if (dir > 0) {
        // built bottom-up (summon / revive): the lowest cells are the first in place
        const v = clamp((my - (g.hy - 14)) / 42, 0, 1);
        order = v * 0.65 + r * 0.35;
      } else {
        order = r * 0.7 + clamp(1 - Math.hypot(mx - g.sx, my - g.sy - 6) / 22, 0, 1) * 0.3;
      }
      if (dFace < 5) order = Math.max(order, 0.9 + r * 0.08);
      if (order >= e) continue;
      let had = false;
      for (let y = cy * 2; y < cy * 2 + 2; y++)
        for (let x = cx * 2; x < cx * 2 + 2; x++) if (c.isOpaque(x, y)) {
          had = true;
          c.erase(x, y);
        }
      const age = clamp((e - order) * 12, 0, 99);
      if (had && age < 7 && e < 0.97 && hash(cx, cy, 7 + pz.seed) < 0.22) {
        const wdx = dir < 0 ? -age * 2.2 : dir > 0 ? Math.sin(mx + my) * age * 0.8 : (mx - g.sx) * age * 0.12;
        const wdy = dir < 0 ? -age * 0.6 + age * age * 0.05 : dir > 0 ? age * 1.4 : -age * 0.9 + age * age * 0.06;
        drift.push([Math.round(mx + wdx), Math.round(my + wdy), Math.floor(hash(cx, cy, 9) * 4) + Math.floor(age), (mx + my) % 3 === 0 ? 1 : 0]);
      }
    }
}

// ------------------------------------------------------------------ points

/** the near hand's root (frame px) */
export function handPoint(pz: Pose): [number, number] {
  const g = geo(pz);
  const [x, y] = handRoot(g, true);
  return [x + pz.handN.x + 3, y + pz.handN.y + 1];
}
