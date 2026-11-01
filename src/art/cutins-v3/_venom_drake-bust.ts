// Zehir Ejderi (venom_drake) — the native BUST shared by the v3 cut-in (src/art/cutins-v3/venom_drake.ts,
// 200×144 at S = 4.4 px per unit) and the v3 card art (src/art/cardart-v3/venom_drake.ts, 88×68 big at
// S = 2). One composition, one set of shapes, painted at each picture's own density (never an enlargement
// of the 1× sprite; KART_RESIMLERI §5, the crystal_wyrm card / cut-in pair's method). Not a registry entry
// (the `_` prefix keeps it out of the cut-in glob).
//
// The composition in UNITS (a 44 × 34 frame; the card = units × 2, the cut-in = units × 4.4):
//   - the head enters low from the left on its neck (the neck bleeds off the bottom-left), a long low wedge
//     looking right: a mag1 top plane, a void2 side, a void1 lip band, the gold2 slit eye under a lit brow,
//     two chitin horns swept back (the sprite's), the lower jaw hinged at H0 (it gapes on the hiss, a mag1
//     gum line and a stone lower fang standing up into the dark throat);
//   - the translucent throat sac under the jaw (a mag1 / void1 skin, the venom inside: leaf2 body, leaf3
//     core; gold3 on the hiss);
//   - the TAIL enters from the top-left corner and arches over the head (plated hide segments: mag1 top,
//     void2, void1, a void0 crease and a void3 bead at each joint), the last two segments chitin, the venom
//     BULB hanging in the upper right — the picture's brightest point (a leaf3 body, a leaf2 lower side, the
//     leaf3 / gold3 hot band, ONE gold4 core) — and the hooked stinger dripping in front of the face;
//   - the weep-quills along the nape (hollow chitin, a venom bead each); the holed membrane cape at the left
//     border (void2 panels, a void0 crease, eaten holes ringed leaf3).
// One key light from the top left (P2: `lightFrom: 'right'` flips which edges are lit and which carry the
// rim; the top planes stay lit from above). Flat bands only, 1-px PAL.ink outline, palette only.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';

export type V = readonly [number, number];

export interface BustPose {
  /** jaw gape 0 … 1 */
  jaw: number;
  /** sac inflation 0 … 3 and its hiss flash */
  sac: number;
  sacHot: boolean;
  /** 0 the slit eye · 1 the pupil snapped thin (and the eye one value hotter) */
  eye: number;
  /** bulb: 0 lit · 1 ignited (the hot band) · 2 the flare (the band widest) */
  hot: number;
  /** head offset (units; + = forward / down) */
  hx: number;
  hy: number;
  /** the tail drawn tight: motion lines along the arch (0/1) */
  tight: number;
  /** the stinger bead 0 … 3 */
  bead: number;
  /** a falling drop below the stinger: 0 … 1 along its fall (< 0: none) */
  drop: number;
  /** the drop's landing y (units) */
  dropTo: number;
  /** the hiss's acid glow in the throat (cut-in slam frame) */
  acid?: boolean;
}

export const BUST_REST: BustPose = { jaw: 0.25, sac: 1, sacHot: false, eye: 0, hot: 1, hx: 0, hy: 0, tight: 0, bead: 1, drop: -1, dropTo: 33 };

export interface BustOpts {
  /** px per unit */
  S: number;
  /** canvas size (px) and the unit origin (px of unit (0, 0)) */
  w: number;
  h: number;
  ox: number;
  oy: number;
  lightFrom: 'left' | 'right';
  /** the shadow-side rim colour (cut-in: the sprite's leaf2 under-glow; card: the DARK card light void3) */
  rim: number;
  /** draw the membrane cape at the left border (the card hides it under the neck crop) */
  cape?: boolean;
  /** the hand-card level of detail: no quills, no far horn, no jaw frill (they read as noise at 1×) */
  lite?: boolean;
  /**
   * the cut-in's band separation (critic r5): the hide lifted off the DARK band (no void1 plane on the
   * silhouette: the tail's shadow band and the cape void2, the lower jaw mag1 over a void2 underside), a
   * continuous rim on every silhouette pixel the key light does not touch, the stinger hooked DOWN over the
   * snout (the drop lands on the face it corrodes), one acid-eaten hole in the cape, the 2-px fang pairs.
   */
  cutin?: boolean;
  /** (card, critic r5) the tail's arch lowered by this many units (its two inner control points), closing the dead pocket inside it */
  archDrop?: number;
  /** (hand card) the hide tail's radius multiplier: a thin, inked arch that survives 1× */
  tailR?: number;
  /** (card) the sac's centre below the jaw's underside, in sac radii (default 0.6: the cut-in's hanging sac) */
  sacDrop?: number;
  /** (hand card) the hide tail's own path (units), e.g. rising from behind the head so its curl reads whole */
  tailPath?: readonly [V, V, V, V];
  /** (critic art r1) the head (skull, jaw, horns, sac) scaled about the eye: the cut-in's bigger head */
  headK?: number;
  /** (critic art r1, hand card) an extra vertical scale of the head: room for the lit plane, the side and the jaw at 1× */
  headKy?: number;
  /** (critic art r1) the near horn's length factor (1 = the sprite's) */
  hornK?: number;
  /** (critic art r1, card) the lower jaw lifted off the gape (mag1 over a void2 underside), as the cut-in's */
  liftJaw?: boolean;
  /** (critic art r1, card) the sac's radius factor */
  sacK?: number;
}

export interface BustOut {
  /** matter (outlined) */
  matter: PixelCanvas;
  /** light (venom, the eye): never outlined */
  light: PixelCanvas;
  /** key points (px) */
  eye: V;
  bulb: V;
  core: V;
  sting: V;
  fang: V;
  sac: V;
}

// ---------------------------------------------------------------- the composition (units)

/** jaw hinge (the head's origin) */
export const H0: V = [17, 19.6];
/** the tail's path: from off the top-left corner, over the head, into the chitin collar */
const TAIL_HIDE: readonly [V, V, V, V] = [
  [4.2, 19.5],
  [2.0, 4.6],
  [16, 2.2],
  [27.2, 6.2],
];
/** the chitin segments + the bulb */
const CHIT: readonly [V, V] = [
  [27.2, 6.2],
  [30.8, 7.6],
];
export const BULB_C: V = [34.2, 9.4];
const BULB_R = 3.3;
/** the hooked stinger (from the bulb's front): mid, tip */
const HOOK: readonly [V, V, V] = [
  [37.4, 11.0],
  [39.4, 11.6],
  [39.8, 14.4],
];
/** the cut-in's sickle hook: out from the bulb's front, then down and back over the snout */
const HOOK_DOWN: readonly [V, V, V] = [
  [37.9, 11.6],
  [37.8, 15.2],
  [34.4, 16.2],
];

// head space (x along the snout, y down; origin = H0)
/**
 * (critic art r1) the skull's top contour is broken, never one straight line: a supraorbital BROW STEP over
 * the eye (the contour rises over the eye and drops 1.4 units in front of it) and a NOSTRIL NOTCH with a nose
 * boss just behind the tip — a dragon's head, not a bill.
 */
const SKULL_TOP: readonly V[] = [
  [-4.0, -1.6], [-2.6, -4.4], [0.6, -6.0], [4.0, -6.7], [7.2, -7.1], [8.8, -6.8], [9.5, -5.4], [11.4, -4.6],
  [14.6, -3.6], [16.2, -3.2], [16.8, -2.6], [17.7, -3.1], [19.0, -2.2], [19.9, -0.6],
];
const SKULL: readonly V[] = [[-3.2, 1.0], ...SKULL_TOP, [19.5, 0.6], [12, 0.9], [4, 1.0]];
/** the lit top plane (mag1): the skull's top contour and the same contour `t` units lower (never below the lip) */
const topPlane = (t: number): V[] => [
  ...SKULL_TOP,
  ...[...SKULL_TOP].reverse().slice(1, -1).map(([x, y]): V => [x, Math.min(-0.9, y + t * (x > 16 ? 0.8 : 1))]),
];
/** the lip band (void1) */
const LIP: readonly V[] = [[-3.2, 1.0], [-3.0, -0.2], [4, -0.2], [12, -0.3], [19.8, -0.3], [19.5, 0.6], [12, 0.9], [4, 1.0]];
/** the cheek plane (void1): behind and below the eye, down to the hinge */
const CHEEK: readonly V[] = [[-3.6, -1.0], [-2.0, -3.0], [2.6, -2.0], [5.0, -0.2], [-3.0, -0.2]];
/** lower jaw (rotates about (0, 0.6)): deep at the hinge, tapering to the chin */
const JAW: readonly V[] = [[-2.8, 0.6], [18.8, 0.9], [19.1, 1.7], [17.0, 2.5], [10, 3.4], [3.6, 4.4], [-0.6, 4.6], [-2.9, 2.9]];
const JAW_UNDER: readonly V[] = [[19.1, 1.7], [17.0, 2.5], [10, 3.4], [3.6, 4.4], [-0.6, 4.6], [-1.4, 3.8], [3.6, 3.4], [10, 2.6], [17, 1.9]];
const EYE_H: V = [6.6, -3.0];
const NOSTRIL_H: V = [17.2, -1.6];
/** the sac hangs under the jaw behind the chin (head space) */
const SAC_H: V = [5.0, 5.2];
/** the neck's centre line (frame units): behind the hinge, down-left off the bottom edge */
const NECK: readonly [V, V, V, V] = [
  [15.6, 18.2],
  [11, 21.8],
  [7, 27.4],
  [6.4, 36],
];
const NECK_R: readonly [number, number] = [4.6, 6.6];

// ---------------------------------------------------------------- small helpers

function bez(a: V, b: V, c: V, d: V, n: number): V[] {
  const out: V[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]);
  }
  return out;
}

const DARKER = new Map<number, number>([
  [PAL.mag1, PAL.void2], [PAL.void3, PAL.void2], [PAL.void2, PAL.void1], [PAL.void1, PAL.void0], [PAL.void0, PAL.ink],
  [PAL.stone4, PAL.stone2], [PAL.stone3, PAL.stone2], [PAL.stone2, PAL.stone1], [PAL.stone1, PAL.stone0], [PAL.stone0, PAL.ink],
  [PAL.mag0, PAL.void0],
]);
const darker = (c: number) => DARKER.get(c) ?? PAL.ink;
const CHITIN_TONES: ReadonlySet<number> = new Set<number>([PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4]);

/**
 * Lay `layer` over `dst`. Where the layer's edge lies over matter already drawn, the surface BEHIND gets a
 * contact line: PAL.ink (`inkLine`, two parts of one value) or one step darker (a crease).
 */
function over(dst: PixelCanvas, layer: PixelCanvas, inkLine: boolean): void {
  const marks: number[] = [];
  for (let y = 0; y < dst.h; y++)
    for (let x = 0; x < dst.w; x++) {
      if (layer.isOpaque(x, y) || !dst.isOpaque(x, y)) continue;
      if (layer.isOpaque(x - 1, y) || layer.isOpaque(x + 1, y) || layer.isOpaque(x, y - 1) || layer.isOpaque(x, y + 1)) marks.push(x, y);
    }
  for (let i = 0; i < marks.length; i += 2) {
    const c = dst.get(marks[i], marks[i + 1])!;
    dst.set(marks[i], marks[i + 1], inkLine ? PAL.ink : darker(c));
  }
  dst.blit(layer, 0, 0);
}

/** A 4-connected 1-px line, only over pixels `only` accepts (if given). */
function line4(p: PixelCanvas, a: V, b: V, c: number, only?: (cur: number | null) => boolean): void {
  let x = Math.floor(a[0]);
  let y = Math.floor(a[1]);
  const x1 = Math.floor(b[0]);
  const y1 = Math.floor(b[1]);
  const dx = Math.abs(x1 - x);
  const dy = -Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let err = dx + dy;
  const put = (px: number, py: number) => {
    if (only && !only(p.get(px, py))) return;
    p.set(px, py, c);
  };
  for (let g = 0; g < 2000; g++) {
    put(x, y);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
      if (e2 <= dx) put(x, y);
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/**
 * A tapered tube along `path` (px), radius r0 → r1, painted in flat bands: `band(s, t)` picks the tone from
 * s = the pixel's offset toward `toward` / radius (−1 … +1) and t = 0 … 1 along the path.
 */
function bandTube(p: PixelCanvas, path: readonly V[], r0: number, r1: number, toward: V, band: (s: number, t: number, d: number) => number | null): void {
  const n = path.length - 1;
  // cumulative length (t by arc length, so segment joints space evenly)
  const cum = [0];
  for (let i = 1; i <= n; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const len = cum[n] || 1;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of path) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const R = Math.max(r0, r1) + 1;
  for (let y = Math.max(0, Math.floor(y0 - R)); y <= Math.min(p.h - 1, Math.ceil(y1 + R)); y++)
    for (let x = Math.max(0, Math.floor(x0 - R)); x <= Math.min(p.w - 1, Math.ceil(x1 + R)); x++) {
      const q: V = [x + 0.5, y + 0.5];
      let best = Infinity;
      let bt = 0;
      let off: V = [0, 0];
      for (let i = 0; i < n; i++) {
        const a = path[i];
        const b = path[i + 1];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const l2 = dx * dx + dy * dy || 1;
        const k = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2));
        const ox = q[0] - (a[0] + k * dx);
        const oy = q[1] - (a[1] + k * dy);
        const d = ox * ox + oy * oy;
        if (d < best) {
          best = d;
          bt = (cum[i] + k * (cum[i + 1] - cum[i])) / len;
          off = [ox, oy];
        }
      }
      const r = r0 + (r1 - r0) * bt;
      const d = Math.sqrt(best);
      if (d > r) continue;
      const s = (off[0] * toward[0] + off[1] * toward[1]) / r;
      const c = band(s, bt, d / r);
      if (c !== null) p.set(x, y, c);
    }
}

/** Point-in-polygon (px). */
function inPoly(q: readonly V[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++)
    if (q[i][1] > y !== q[j][1] > y && x < ((q[j][0] - q[i][0]) * (y - q[i][1])) / (q[j][1] - q[i][1]) + q[i][0]) c = !c;
  return c;
}

// ---------------------------------------------------------------- the painter

export function paintVenomBust(P: BustPose, o: BustOpts): BustOut {
  const { S, w, h, ox, oy } = o;
  const ls = o.lightFrom === 'left' ? -1 : 1; // the side the key light comes from
  /** toward the light (unit), for band tubes */
  const LV: V = [ls * 0.55, -0.83];
  const U = (x: number, y: number): V => [ox + x * S, oy + y * S];
  const head0: V = [H0[0] + P.hx, H0[1] + P.hy];
  const hk = o.headK ?? 1;
  const hky = hk * (o.headKy ?? 1);
  const Hd = (x: number, y: number): V => U(head0[0] + EYE_H[0] + (x - EYE_H[0]) * hk, head0[1] + EYE_H[1] + (y - EYE_H[1]) * hky);
  /** where the scaled head moved its hinge (units): the neck follows it */
  const hingeD: V = [EYE_H[0] - EYE_H[0] * hk, EYE_H[1] - EYE_H[1] * hky];
  const ja = P.jaw * 0.36; // jaw angle (rad)
  const Jw = (x: number, y: number): V => {
    const dx = x;
    const dy = y - 0.6;
    return Hd(dx * Math.cos(ja) - dy * Math.sin(ja), 0.6 + dx * Math.sin(ja) + dy * Math.cos(ja));
  };
  const lineW = Math.max(1, Math.round(S * 0.5)); // a "thin" detail's width at this density
  const big = S >= 3;
  const lift = o.cutin === true;
  const HK = lift ? HOOK_DOWN : HOOK;

  const matter = new PixelCanvas(w, h);
  const light = new PixelCanvas(w, h);

  // ---------------------------------------------------------- 1. the tail (behind everything)
  const tail = new PixelCanvas(w, h);
  const ad = o.archDrop ?? 0;
  const tailPath = bez(...((o.tailPath ?? TAIL_HIDE).map(([x, y], i) => U(x, y + (i === 1 || i === 2 ? ad : 0))) as [V, V, V, V]), 28);
  const SEG = 7; // hide segments in view
  const tr = o.tailR ?? 1;
  bandTube(tail, tailPath, 3.0 * S * tr, 1.75 * S * Math.max(tr, 0.7), LV, (s, t, d) => {
    // the plate joints: a crease across the tube at each segment's end, the plate's front edge one value lighter
    const seg = t * SEG;
    const fr = seg - Math.floor(seg);
    // each plate bulges (a scalloped silhouette: the scorpion's segmented tail, never a hose)
    if (d > 0.8 + 0.2 * Math.sin(Math.PI * Math.min(1, fr * 1.08))) return null;
    const joint = fr > 1 - 0.55 / (S * 0.5 + 1);
    if (joint) return PAL.void0;
    if (s > (lift ? 0.0 : 0.42)) return fr < 0.18 && d > 0.5 ? PAL.void3 : PAL.mag1;
    if (s > -0.35) return PAL.void2;
    return lift ? PAL.void2 : PAL.void1;
  });
  // the chitin segments
  const chit = new PixelCanvas(w, h);
  const cp = [U(...CHIT[0]), U(...CHIT[1]), U(BULB_C[0] - 1.6, BULB_C[1] - 1.1)];
  const cr = Math.max(tr, 0.6);
  bandTube(chit, cp, 1.8 * S * cr, 1.5 * S * cr, LV, (s, t, d) => {
    const fr = (t * 2) % 1;
    if (d > 0.82 + 0.18 * Math.sin(Math.PI * Math.min(1, fr * 1.1))) return null;
    if (fr > 0.86) return PAL.stone1;
    if (s > 0.5) return d > 0.7 && fr < 0.6 ? PAL.stone4 : PAL.stone3;
    if (s > -0.3) return PAL.stone2;
    return PAL.stone1;
  });
  over(tail, chit, true);
  // the stinger hook: a tapering chitin claw, lit edge on its upper side
  const hook = new PixelCanvas(w, h);
  const hp = bez(U(BULB_C[0] + 1.6, BULB_C[1] + (lift ? 1.4 : 1.0)), U(...HK[0]), U(...HK[1]), U(...HK[2]), 12);
  bandTube(hook, hp, 1.2 * S, 0.35 * S, LV, (s) => (s > 0.35 ? PAL.stone4 : s > -0.4 ? PAL.stone3 : PAL.stone1));
  // the bulb body: matter is only its casing ring (the venom is light)
  const bulbM = new PixelCanvas(w, h);
  const bc = U(...BULB_C);
  bulbM.ellipse(bc[0], bc[1], BULB_R * S, BULB_R * S * 0.92, PAL.leaf2);
  over(tail, bulbM, true);
  // (critic art r1) the hand card draws its own 4-px hook after the outline (below): the tube read as a beak
  if (!o.lite) over(tail, hook, true);
  // motion lines along the tight arch (slam): short void3 dashes above the arch
  if (P.tight > 0 && !lift) {
    for (let k = 0; k < 3; k++) {
      const i = 6 + k * 6;
      const a = tailPath[i];
      const b = tailPath[i + 3];
      const nx = b[1] - a[1];
      const ny = -(b[0] - a[0]);
      const l = Math.hypot(nx, ny) || 1;
      const off = 3.0 * S + 2 + k;
      const pa: V = [a[0] + (nx / l) * off * (ny < 0 ? 1 : -1), a[1] + (ny / l) * off * (ny < 0 ? 1 : -1)];
      const pb: V = [b[0] + (nx / l) * off * (ny < 0 ? 1 : -1), b[1] + (ny / l) * off * (ny < 0 ? 1 : -1)];
      line4(light, pa, pb, k === 1 ? PAL.void3 : PAL.void2);
    }
  }
  matter.blit(tail, 0, 0);

  // ---------------------------------------------------------- 2. the membrane cape at the left border
  if (o.cape !== false) {
    const cape = new PixelCanvas(w, h);
    const C: V[] = [U(2.4, 16.4), U(4.4, 14.0), U(7.0, 17.6), U(5.8, 20.8), U(8.0, 24.2), U(6.4, 27.6), U(8.4, 31.0), U(7.4, 36), U(1.6, 36), U(2.6, 33), U(1.2, 29), U(2.2, 25), U(0.9, 21)];
    cape.poly(C, PAL.void2);
    // a void1 web panel (the lower half) and ONE void0 fold line
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) if (!lift && cape.get(x, y) === PAL.void2 && y > U(0, 26)[1] + (x - U(0, 0)[0]) * 0.3) cape.set(x, y, PAL.void1);
    line4(cape, U(4.4, 14.4), U(3.6, 36), PAL.void0, (c) => c !== null);
    // the wing bone along the front edge (chitin)
    line4(cape, U(4.4, 14.0), U(7.0, 17.6), PAL.stone3, (c) => c !== null);
    if (lift) {
      // ONE acid-eaten hole (critic r5: never an "o" glyph): an irregular cut-out showing the void0 dark
      // behind the membrane, its LOWER inner lip lit leaf2 (the acid-eaten edge), an ink contact line round it
      const HOLE: V[] = [[-1.1, -1.2], [-0.2, -1.7], [0.3, -0.8], [1.2, -0.6], [0.8, 0.5], [1.0, 1.2], [-0.1, 1.0], [-0.6, 1.6], [-0.9, 0.4], [-1.4, 0.1]];
      const hp = HOLE.map(([x, y]) => U(3.5 + x, 21.2 + y));
      const hm = new PixelCanvas(w, h);
      hm.poly(hp, PAL.void0);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          if (!hm.isOpaque(x, y) || !cape.isOpaque(x, y)) continue;
          // the lower lip: a hole pixel whose lower neighbour is membrane
          const lip = !hm.isOpaque(x, y + 1) && cape.isOpaque(x, y + 1);
          cape.set(x, y, lip ? PAL.leaf2 : PAL.void0);
        }
      // the ink contact line round the hole (on the membrane side, never on the lip's lower edge)
      const ring: [number, number][] = [];
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          if (hm.isOpaque(x, y) || !cape.isOpaque(x, y)) continue;
          if (hm.isOpaque(x, y - 1) || hm.isOpaque(x - 1, y) || hm.isOpaque(x + 1, y)) ring.push([x, y]);
        }
      for (const [x, y] of ring) if (!hm.isOpaque(x, y - 1) || cape.get(x, y - 1) !== PAL.leaf2) cape.set(x, y, PAL.ink);
      over(matter, cape, true);
    } else {
    // eaten holes ringed leaf3 (light)
    const holes: [number, number, number][] = [
      [3.4, 21.0, 1.1],
      [3.0, 29.0, 0.85],
    ];
    for (const [hx, hy, r] of holes) {
      const c = U(hx, hy);
      const R = Math.max(1.6, r * S);
      for (let y = Math.floor(c[1] - R - 2); y <= c[1] + R + 2; y++)
        for (let x = Math.floor(c[0] - R - 2); x <= c[0] + R + 2; x++) {
          const d = Math.hypot((x + 0.5 - c[0]) / 1.15, y + 0.5 - c[1]);
          if (d <= R) cape.erase(x, y);
        }
    }
    over(matter, cape, true);
    // hole rims: matter pixels next to a hole → leaf3 light
    for (const [hx, hy, r] of holes) {
      const c = U(hx, hy);
      const R = Math.max(1.6, r * S) + 1.2;
      for (let y = Math.floor(c[1] - R - 1); y <= c[1] + R + 1; y++)
        for (let x = Math.floor(c[0] - R - 1); x <= c[0] + R + 1; x++) {
          if (!cape.isOpaque(x, y)) continue;
          const d = Math.hypot((x + 0.5 - c[0]) / 1.15, y + 0.5 - c[1]);
          if (d <= R) light.set(x, y, PAL.leaf3);
        }
    }
    }
  }

  // ---------------------------------------------------------- 3. the neck (nape plates, throat belly plates)
  const neck = new PixelCanvas(w, h);
  const np = bez(...(NECK.map(([x, y], i) => U(x + P.hx * 0.5 + (i < 2 ? hingeD[0] : 0), y + P.hy * 0.5 + (i < 2 ? hingeD[1] : 0))) as [V, V, V, V]), 20);
  // (critic art r1, cut-in) the neck's arc length in px: the scale teeth are spaced in px along it
  let neckLen = 0;
  for (let i = 1; i < np.length; i++) neckLen += Math.hypot(np[i][0] - np[i - 1][0], np[i][1] - np[i - 1][1]);
  // bands across the neck by side (the nape faces up-left = the light; the throat down-right)
  const nside: V = [-0.62, -0.78];
  bandTube(neck, np, NECK_R[0] * S, NECK_R[1] * S, nside, (s, t) => {
    if (s > 0.38) return PAL.mag1;
    if (big) {
      // (critic art r1) three value planes (mag1 · void2 · the stone belly), no void1 stripe: the scale
      // teeth (MA-2) — 2-px void1 triangles every ≈ 5 px biting up from the belly into the void2 mid
      const r = (NECK_R[0] + (NECK_R[1] - NECK_R[0]) * t) * S;
      const ph = (t * neckLen) % 5.5;
      const toothH = ph < 3 ? (2.4 * (1.5 - Math.abs(ph - 1.5))) / 1.5 : 0;
      if (s > -0.45 + toothH / r) return PAL.void2;
      if (s > -0.45) return PAL.void1;
    } else {
      if (s > -0.3) return PAL.void2;
      if (s > -0.45) return PAL.void1;
    }
    // the throat's belly plates: stone2 with stone1 seams
    return (Math.floor(t * 9) % 1 === 0 && (t * 9) % 1 < 0.14) ? PAL.stone1 : PAL.stone2;
  });
  // the plate seams across the throat band
  for (let k = 1; k < 7; k++) {
    const i = Math.round((k / 7) * 20);
    const a = np[i];
    const b = np[Math.min(20, i + 1)];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    const nx = ty / l;
    const ny = -tx / l; // points right-down?
    const sgn = nx * -nside[0] + ny * -nside[1] > 0 ? 1 : -1;
    const r = (NECK_R[0] + ((NECK_R[1] - NECK_R[0]) * i) / 20) * S;
    line4(neck, [a[0] + nx * sgn * r * 0.62, a[1] + ny * sgn * r * 0.62], [a[0] + nx * sgn * r * 1.1, a[1] + ny * sgn * r * 1.1 - 1], PAL.stone1, (c) => c === PAL.stone2);
    // scale teeth on the mid/shadow boundary (the card; the cut-in's are cut in the band tube above)
    if (false) line4(neck, [a[0] + nx * sgn * r * 0.15, a[1] + ny * sgn * r * 0.15], [a[0] + nx * sgn * r * 0.35 - S * 0.6, a[1] + ny * sgn * r * 0.35], PAL.void1, (c) => c === PAL.void2);
  }
  over(matter, neck, true);
  // the weep-quills along the nape: hollow chitin spikes pointing back-up, a venom bead at each tip
  const quill = new PixelCanvas(w, h);
  const quills: [V, V][] = [
    [[12.4, 17.9], [9.4, 14.5]],
    [[9.4, 21.2], [5.8, 18.4]],
    [[7.0, 25.4], [3.0, 23.6]],
  ];
  const beads: V[] = [];
  for (const [a0, b0] of big ? quills : quills.slice(0, 2)) {
    const a = U(a0[0] + P.hx * 0.5, a0[1] + P.hy * 0.5);
    // (critic art r1) half length: weep-quills, not nails
    const b = U(a0[0] + (b0[0] - a0[0]) * 0.55 + P.hx * 0.5, a0[1] + (b0[1] - a0[1]) * 0.55 + P.hy * 0.5);
    const hw = Math.max(1, 0.55 * S);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    quill.poly([[a[0] + nx * hw, a[1] + ny * hw], b, [a[0] - nx * hw, a[1] - ny * hw]], PAL.stone2);
    // the lit facet (toward the light)
    const litSide = nx * LV[0] + ny * LV[1] > 0 ? 1 : -1;
    quill.poly([[a[0] + nx * hw * litSide, a[1] + ny * hw * litSide], b, [a[0] + nx * hw * 0.1 * litSide, a[1] + ny * hw * 0.1 * litSide]], PAL.stone3);
    beads.push(b);
  }
  if (!o.lite) over(matter, quill, true);
  // (critic r5) no venom beads on the card's quills: stray leaf points off the one-rim picture
  if (o.lite || !big) beads.length = 0;

  // ---------------------------------------------------------- 4. the head
  const headL = new PixelCanvas(w, h);
  // far horn (one value darker), peeks above the skull
  // (critic art r1) three flat bands — stone1 underside, stone2, stone3 top — and stone4 only at the tip; no
  // dark base cap (it read as a cone's end, a pipe joint)
  const horn = (p: PixelCanvas, a: V, c1: V, c2: V, b: V, r0: number, far: boolean, k = 1) => {
    const L = (q: V): V => [a[0] + (q[0] - a[0]) * k, a[1] + (q[1] - a[1]) * k];
    bandTube(p, bez(Hd(...a), Hd(...L(c1)), Hd(...L(c2)), Hd(...L(b)), 14), r0 * S * Math.sqrt(k) * hk, 0.3 * S, LV, (s, t) => {
      if (far) return s > 0.3 ? PAL.stone2 : PAL.stone1;
      if (s > 0.3) return t > 0.82 ? PAL.stone4 : PAL.stone3;
      return s > -0.35 ? PAL.stone2 : PAL.stone1;
    });
  };
  const farHorn = new PixelCanvas(w, h);
  horn(farHorn, [3.4, -4.2], [1.0, -6.6], [-2.6, -8.2], [-6.6, -10.4], 1.25, true);
  if (!o.lite && !lift) headL.blit(farHorn, 0, 0);
  // ---------------------------------------------------------- 5. the sac (skin; the venom inside is light)
  const sacL = new PixelCanvas(w, h);
  // (critic r5) the sac hangs from the lower jaw: its centre follows the jaw's underside at its column (the
  // gaping jaw never swallows it), its top 40 % tucked under the jaw so the two outlines join
  const sr = (2.0 + P.sac * 0.32) * S * hk * (o.sacK ?? 1);
  const sacX = SAC_H[0] + P.sac * 0.15;
  const jawUnder = 4.4 - Math.max(0, Math.min(1, (sacX - 3.6) / 6.4)) * 1.0;
  const jawAt = Jw(sacX, jawUnder);
  const scx: V = [jawAt[0], jawAt[1] + sr * (o.sacDrop ?? 0.6)];
  sacL.ellipse(scx[0], scx[1], sr * 1.08, sr, PAL.void1);
  // the throat (and the head over it) cast a void0 crescent on the sac's top; the skin's lit rim on the light side
  over(headL, sacL, true);
  // lower jaw
  const jaw = new PixelCanvas(w, h);
  const jawLift = lift || o.liftJaw === true;
  jaw.poly(JAW.map(([x, y]) => Jw(x, y)), jawLift ? PAL.mag1 : PAL.void1);
  jaw.poly(JAW_UNDER.map(([x, y]) => Jw(x, y)), jawLift ? PAL.void2 : PAL.void0);
  // the gum line (mag1; void3 on the cut-in's lifted mag1 jaw) on the jaw's top edge when it gapes
  if (P.jaw > 0.15) {
    line4(jaw, Jw(0.0, 0.85), Jw(18.0, 1.15), jawLift ? PAL.void3 : PAL.mag1, (c) => c !== null);
  }
  // the dark throat between the jaws
  const gape = new PixelCanvas(w, h);
  if (P.jaw > 0.12) {
    const g: V[] = [Hd(-1.4, 0.7), Hd(17.4, 0.9), Jw(16.8, 1.0), Jw(-0.4, 0.8)];
    gape.poly(g, PAL.void0);
    // the throat's dark back (ink) and a mag0 tongue lying on the lower jaw
    gape.poly([Hd(-1.4, 0.7), Hd(3.4, 0.9), Jw(3.0, 0.8), Jw(-0.4, 0.8)], PAL.ink);
    // the hiss (cut-in slam): the acid glows in the throat behind the fangs — two stepped tones, leaf2 deep
    // in the throat, leaf1 around it, only on the gape's dark
    if (P.acid) {
      const ga: V = Hd(9.6, 0.9);
      const gb: V = Jw(9.6, 0.8);
      const gc: V = [(ga[0] + gb[0]) / 2, (ga[1] + gb[1]) / 2];
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          if (!gape.isOpaque(x, y)) continue;
          const d = Math.hypot((x + 0.5 - gc[0]) / 1.6, y + 0.5 - gc[1]) / S;
          if (d < 1.5) gape.set(x, y, PAL.leaf2);
          else if (d < 3.0) gape.set(x, y, PAL.leaf1);
        }
    }
    if (P.jaw > 0.4) gape.poly([Jw(1.6, 0.6), Jw(8.8, 0.1), Jw(11.0, 0.5), Jw(9.4, 0.85), Jw(2.0, 0.9)], PAL.mag0);
    // the card's mouth (critic r5): a 1-px leaf2 acid line along the throat's floor
    // (critic art r1) dropped: the green lip line read as a bill's edge
    if (false) {
      const m = (x: number): V => {
        const a = Hd(x, 0.8);
        const b = Jw(x, 0.85);
        return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.5];
      };
      line4(gape, m(1.5), m(14.0), PAL.leaf2, (c) => c === PAL.void0 || c === PAL.mag0);
    }
  }
  headL.blit(gape, 0, 0);
  over(headL, jaw, true);
  // the lower fang standing up into the gape near the tip, and the small lower teeth
  const tooth = (p: PixelCanvas, base: V, tip: V, hw: number, lit: number, shade: number) => {
    const n = Math.max(1, Math.round(hw * S));
    p.poly([[base[0] - n, base[1]], [base[0] + n, base[1]], tip], shade);
    line4(p, [base[0] - n + (ls < 0 ? 0 : n), base[1]], tip, lit);
  };
  if (P.jaw > 0.12 && big) {
    tooth(headL, Jw(14.6, 1.1), Jw(14.9, -0.9 - P.jaw * 0.6), 0.45, PAL.stone4, PAL.stone2);
    if (big) tooth(headL, Jw(11.2, 1.1), Jw(11.4, -0.2 - P.jaw * 0.4), lift ? 0.42 : 0.3, PAL.stone3, PAL.stone2);
  }
  // upper head: void2 side, void1 lip band, the mag1 top plane
  const up = new PixelCanvas(w, h);
  up.poly(SKULL.map(([x, y]) => Hd(x, y)), PAL.void2);
  up.poly(LIP.map(([x, y]) => Hd(x, y)), PAL.void1);
  // (critic art r1) the lit top plane is the head's largest plane: ≥ 2 px of mag1 under the 1-px lit edge at
  // every density (the hand card's 1.5 px per unit needs 2.4 units)
  const topT = Math.max(1.7, 3.6 / (S * hky));
  up.poly(topPlane(topT).map(([x, y]) => Hd(x, y)), PAL.mag1);
  up.poly(CHEEK.map(([x, y]) => Hd(x, y)), PAL.void1);
  // the brow: a void0 shadow under the plane's lower edge over the eye (the brow step casts it)
  line4(up, Hd(3.0, -7.0 + topT + 0.45), Hd(9.4, -6.9 + topT + 0.45), PAL.void0, (c) => c === PAL.void2);
  // scale rows on the side plane (void1 teeth, cut-in density only)
  if (big)
    for (const [a, b] of [[[10.4, -1.6], [11.6, -1.2]], [[12.8, -1.8], [14.0, -1.4]], [[15.2, -1.6], [16.2, -1.2]], [[8.6, -1.0], [9.8, -0.6]]] as const)
      line4(up, Hd(a[0], a[1]), Hd(b[0], b[1]), PAL.void1, (c) => c === PAL.void2);
  // the nostril
  const nq = Hd(...NOSTRIL_H);
  up.set(Math.floor(nq[0]), Math.floor(nq[1]), PAL.void0).set(Math.floor(nq[0]) + 1, Math.floor(nq[1]), PAL.void0);
  if (big) up.set(Math.floor(nq[0]), Math.floor(nq[1]) - 1, PAL.void0);
  // scale studs along the snout's top plane: 1-px void2 nicks (big density only)
  if (big) for (const sx of [10.6, 12.8, 14.8]) {
    const q = Hd(sx, -2.6 + (sx - 10) * 0.18);
    up.set(Math.floor(q[0]), Math.floor(q[1]), PAL.void2).set(Math.floor(q[0]) + 1, Math.floor(q[1]), PAL.void2);
  }
  // the eye socket (void0) — the iris is light
  const ec = Hd(...EYE_H);
  // (critic r5) the card's eye is a 3-px slit eye (gold2 · ink · gold2, a gold3 lid pixel): never a pair
  const ew = big ? Math.max(2, Math.round(1.4 * S * hk)) : 1;
  const eh = big ? Math.max(1, Math.round(0.55 * S * hk)) : 1;
  if (big)
    for (let dy = -eh; dy <= eh; dy++)
      for (let dx = -ew - 1; dx <= ew + 1; dx++) {
        if (Math.abs(dx) / (ew + 1.2) + Math.abs(dy) / (eh + 0.8) > 1.05) continue;
        up.set(Math.floor(ec[0]) + dx, Math.floor(ec[1]) + dy, PAL.void0);
      }
  else {
    // (critic art r1) the card's socket: a void0 almond round the iris (big card 5×4, hand card 3×4)
    const ex = Math.floor(ec[0]);
    const ey = Math.floor(ec[1]);
    const rows: readonly (readonly [number, number])[] = o.lite ? [[0, 1], [-1, 1], [-1, 1], [0, 1]] : [[-1, 1], [-2, 2], [-2, 2], [-1, 1]];
    rows.forEach(([a, b], i) => {
      for (let dx = a; dx <= b; dx++) up.set(ex + dx, ey - 1 + i, PAL.void0);
    });
  }
  over(headL, up, true);
  // the upper fang (chitin) hanging at the lip near the tip
  const fangBase = Hd(15.4, 0.8);
  const fangTip = Hd(15.6, 0.8 + (big ? 1.7 : 1.4) + P.jaw * 0.2);
  if (big) {
    tooth(headL, fangBase, fangTip, 0.42, PAL.stone4, PAL.stone3);
    tooth(headL, Hd(12.2, 0.85), Hd(12.3, 0.85 + 1.4 + P.jaw * 0.15), 0.36, PAL.stone4, PAL.stone3);
  } else {
    // (critic r5) the card's fang PAIR: 2-px pixel triangles hanging from the upper jaw (stone4 lit column,
    // stone3 shade), each 2 · 2 · 1 px tall — never a 1-px stroke
    const fang = (hx: number, len: number) => {
      const q = Hd(hx, 0.8);
      const x = Math.round(q[0]);
      const y = Math.round(q[1]);
      const lit = ls < 0 ? x - 1 : x;
      const sh = ls < 0 ? x : x - 1;
      for (let k = 0; k < len; k++) {
        if (k < len - 1) headL.set(lit, y + k, PAL.stone4).set(sh, y + k, PAL.stone3);
        else headL.set(ls < 0 ? x - 1 : x, y + k, PAL.stone4);
      }
    };
    fang(15.4, o.lite ? 2 : 3);
    if (!o.lite) fang(12.0, 3);
  }
  // near horn on top (over the skull)
  const nearHorn = new PixelCanvas(w, h);
  horn(nearHorn, [0.6, -3.6], [-2.2, -5.4], [-5.8, -6.4], [-9.4, -8.2], 1.45, false, o.hornK ?? 1);
  // (critic art r1) the hand card has no horn: at the left edge it read as a pipe joint
  if (!o.lite) over(headL, nearHorn, true);
  // the jaw's frill spike behind the hinge (chitin), pointing back-down
  const frill = new PixelCanvas(w, h);
  {
    const a = Hd(-1.6, 1.8);
    const b = Hd(-5.0, 3.4);
    const hw = 0.7 * S;
    frill.poly([[a[0], a[1] - hw], b, [a[0], a[1] + hw]], PAL.stone2);
    line4(frill, [a[0], a[1] - hw], b, PAL.stone3);
  }
  if (!o.lite && !lift) over(headL, frill, true);

  // merge head + neck
  over(matter, headL, true);

  // ---------------------------------------------------------- 6. outline, lit edges, rim
  matter.outline(PAL.ink);
  // 1-px lit edge on silhouette pixels facing the light; the rim on those facing away and down
  const clear = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && matter.get(x, y) === null;
  // open air: a transparent pixel, or the OUTER ink outline (an ink pixel touching transparency) — inner ink
  // contact lines are not air (no rim / lit edge along them)
  const open = (x: number, y: number) => {
    const c = matter.get(x, y);
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    if (c === null) return true;
    return c === PAL.ink && (clear(x - 1, y) || clear(x + 1, y) || clear(x, y - 1) || clear(x, y + 1));
  };
  const LIT = new Map<number, number>([[PAL.mag1, PAL.void3], [PAL.void2, lift ? PAL.void3 : PAL.mag1], [PAL.void1, PAL.void2], [PAL.stone2, PAL.stone3]]);
  const edits: [number, number, number][] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = matter.get(x, y);
      if (c === null || c === PAL.ink) continue;
      // lit: the silhouette facing up or toward the light (the top-left key light grazes every upper contour)
      const toLight = open(x, y - 1) || (open(x + ls, y) && !open(x, y + 1));
      const away = (open(x - ls, y) || open(x, y + 1)) && !open(x + ls, y) && !open(x, y - 1);
      if (toLight) {
        const n = LIT.get(c);
        if (n !== undefined) edits.push([x, y, n]);
      } else if ((away || (lift && (open(x - 1, y) || open(x + 1, y) || open(x, y + 1)))) && c !== PAL.leaf2 && !CHITIN_TONES.has(c)) {
        // the rim: only on hide (never on chitin, which keeps its own value); the cut-in runs it round every
        // silhouette pixel the key light misses (critic r5: a continuous line between the hide and the band)
        edits.push([x, y, o.rim]);
      }
    }
  for (const [x, y, c] of edits) matter.set(x, y, c);
  // (critic art r1, hand card) the stinger: a 1-px chitin hook off the bulb's lower right, pointing down and
  // forward at the enemy — 4 px, stepped (never a 1-px diagonal), its own ink outline, the bulb's casing ink
  // the seam between them; the bead hangs at its tip
  let liteTip: V | null = null;
  if (o.lite) {
    const R = BULB_R * S;
    const x0 = Math.round(bc[0] + R * 0.78 + 0.5);
    const y0 = Math.round(bc[1] + R * 0.62 + 0.5);
    const hookPx: readonly [number, number, number][] = [
      [x0, y0, PAL.stone2],
      [x0 + 1, y0, PAL.stone3],
      [x0 + 1, y0 + 1, PAL.stone3],
      [x0 + 2, y0 + 2, PAL.stone3],
    ];
    for (const [x, y] of hookPx)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (!matter.isOpaque(x + dx, y + dy)) matter.set(x + dx, y + dy, PAL.ink);
    for (const [x, y, c] of hookPx) matter.set(x, y, c);
    liteTip = [x0 + 2, y0 + 2];
  }
  // (critic art r1, cut-in) the hide must hold against the DARK band's void wedges at 1×: the tail arch's
  // lit edge is 2 px (void3) on its outer contour, and the leaf2 rim 2 px on the arch's inner curve and on
  // the jaw's underside (the two contours that sit on the band's rays)
  if (lift) {
    const two: [number, number, number][] = [];
    for (const [x, y, c] of edits) {
      const isTail = tail.isOpaque(x, y) && !headL.isOpaque(x, y) && !neck.isOpaque(x, y) && !chit.isOpaque(x, y) && !bulbM.isOpaque(x, y) && !hook.isOpaque(x, y);
      const isJaw = jaw.isOpaque(x, y);
      if (c === PAL.void3 && isTail) {
        const q = matter.get(x, y + 1);
        if (q === PAL.mag1) two.push([x, y + 1, PAL.void3]);
      } else if (c === o.rim && (isTail || isJaw)) {
        const q = matter.get(x, y - 1);
        if (q !== null && q !== PAL.ink && q !== o.rim && !CHITIN_TONES.has(q) && (isTail ? tail.isOpaque(x, y - 1) : jaw.isOpaque(x, y - 1))) two.push([x, y - 1, o.rim]);
      }
    }
    for (const [x, y, c] of two) matter.set(x, y, c);
  }
  // the rim runs only where the edge borders the open air (not the canvas edge) — trim it inside the sac / bulb
  // (their skin carries its own light below)

  // ---------------------------------------------------------- 7. light: the venom, the eye
  // the sac's venom (only where the sac shows: never over the jaw, the gape or the head in front of it)
  const sacHidden = (x: number, y: number) => jaw.isOpaque(x, y) || gape.isOpaque(x, y) || up.isOpaque(x, y) || (!o.lite && nearHorn.isOpaque(x, y)) || !sacL.isOpaque(x, y);
  {
    const ir = sr - Math.max(1, Math.round(S * 0.35));
    for (let y = Math.floor(scx[1] - sr - 1); y <= scx[1] + sr + 1; y++)
      for (let x = Math.floor(scx[0] - sr * 1.1 - 1); x <= scx[0] + sr * 1.1 + 1; x++) {
        const dx = (x + 0.5 - scx[0]) / 1.08;
        const dy = y + 0.5 - scx[1];
        const d = Math.hypot(dx, dy);
        if (d > ir) continue;
        if (matter.get(x, y) === PAL.ink || sacHidden(x, y)) continue;
        // (critic art r1) the sac is the throat's own skin: no dark crescent between it and the jaw, the venom
        // (leaf2) fills it up to the jaw; a small leaf3 core (2–3 px on the card), on the hiss a wider leaf3
        // core with two gold3 pixels — never a gold disc (the bulb stays the one hot point)
        const cr = big ? (P.sacHot ? 0.55 : 0.42) : 0.26;
        const core = Math.hypot(dx + ls * ir * 0.25, dy + ir * 0.12) < Math.max(1.1, ir * cr);
        light.set(x, y, core ? PAL.leaf3 : PAL.leaf2);
      }
    if (P.sacHot) {
      const hx0 = Math.floor(scx[0] + ls * ir * 0.25 * 1.08);
      const hy0 = Math.floor(scx[1] - ir * 0.12);
      light.set(hx0, hy0, PAL.gold3).set(hx0 - ls, hy0, PAL.gold3);
    }
    // the seam to the jaw: the ink contact line the jaw laid on the sac (inner, never on the free contour)
    // becomes the leaf2 rim — the sac joins the throat; the ink stays only on its free lower contour
    const seam: [number, number][] = [];
    for (let y = Math.floor(scx[1] - sr - 1); y <= scx[1]; y++)
      for (let x = Math.floor(scx[0] - sr * 1.1 - 1); x <= scx[0] + sr * 1.1 + 1; x++) {
        if (matter.get(x, y) !== PAL.ink || !sacL.isOpaque(x, y)) continue;
        if (!matter.isOpaque(x - 1, y) || !matter.isOpaque(x + 1, y) || !matter.isOpaque(x, y - 1) || !matter.isOpaque(x, y + 1)) continue;
        if (Math.hypot((x + 0.5 - scx[0]) / 1.08, y + 0.5 - scx[1]) > sr - 0.5) continue;
        seam.push([x, y]);
      }
    for (const [x, y] of seam) light.set(x, y, PAL.leaf2);
    // the skin's lit rim pixel row on the light side (mag1)
    for (let y = Math.floor(scx[1] - sr); y <= scx[1] + sr; y++)
      for (let x = Math.floor(scx[0] - sr * 1.1); x <= scx[0] + sr * 1.1; x++) {
        if (matter.get(x, y) !== PAL.void1 || light.isOpaque(x, y)) continue;
        if ((x + 0.5 - scx[0]) * ls > 0 && y + 0.5 < scx[1] + sr * 0.3) matter.set(x, y, PAL.mag1);
      }
  }
  // the bulb's venom
  let core: V = [Math.round(bc[0]), Math.round(bc[1])];
  {
    const rx = BULB_R * S;
    const ry = BULB_R * S * 0.92;
    // the hot point sits up-left of centre (toward the light) on P1, up-right on P2
    const hc: V = [bc[0] + ls * rx * 0.28, bc[1] - ry * 0.22];
    core = [Math.floor(hc[0]), Math.floor(hc[1])];
    for (let y = Math.floor(bc[1] - ry - 1); y <= bc[1] + ry + 1; y++)
      for (let x = Math.floor(bc[0] - rx - 1); x <= bc[0] + rx + 1; x++) {
        if (matter.get(x, y) !== PAL.leaf2 && matter.get(x, y) !== o.rim) continue;
        const dx = (x + 0.5 - bc[0]) / rx;
        const dy = (y + 0.5 - bc[1]) / ry;
        if (dx * dx + dy * dy > 1.02) continue;
        // lower side leaf2, body leaf3
        let c: number = dy > 0.42 - dx * ls * 0.15 ? PAL.leaf2 : PAL.leaf3;
        // (cut-in) the venom darkens to leaf2 where it meets the ink casing: an orb lit from inside, and no
        // leaf3 pixel on the outline can out-shine the core for the lens glint
        if (lift && c === PAL.leaf3 && (matter.get(x - 1, y) === PAL.ink || matter.get(x + 1, y) === PAL.ink || matter.get(x, y - 1) === PAL.ink || matter.get(x, y + 1) === PAL.ink)) c = PAL.leaf2;
        light.set(x, y, c);
      }
    // (critic art r1) the hot band is a thin gold3 CRESCENT offset toward the light, beside the gold4 core —
    // leaf3 and gold3 side by side read chartreuse; a gold3 disc round the core read as a gold gem / an egg
    // yolk (blueprint §1). The leaf3 body touches the core on its shadow sides. Card ≤ 4 px, cut-in ≤ 6 px.
    if (P.hot >= 1) {
      const cres: readonly V[] = big
        ? P.hot >= 2
          ? [[ls, 0], [ls, -1], [0, -1], [2 * ls, -1], [ls, -2], [2 * ls, 0]]
          : [[ls, 0], [ls, -1], [0, -1], [2 * ls, -1]]
        : P.hot >= 2
          ? [[ls, 0], [ls, -1], [0, -1], [2 * ls, 0]]
          : [[ls, 0], [0, -1], [ls, -1]];
      // (the hand card re-cuts its bulb by hand: cardart-v3/venom_drake.ts SMALL patch)
      if (!o.lite) for (const [dx, dy] of cres) if (light.isOpaque(core[0] + dx, core[1] + dy)) light.set(core[0] + dx, core[1] + dy, PAL.gold3);
      for (const [dx, dy] of [[-ls, 0], [0, 1], [-ls, 1]] as const) if (light.isOpaque(core[0] + dx, core[1] + dy)) light.set(core[0] + dx, core[1] + dy, PAL.leaf3);
      light.set(core[0], core[1], PAL.gold4);
    } else light.set(core[0], core[1], PAL.leaf3);
    // the bulb's casing outline stays ink (matter); clear the matter's placeholder fill under the light
    for (let y = Math.floor(bc[1] - ry - 1); y <= bc[1] + ry + 1; y++)
      for (let x = Math.floor(bc[0] - rx - 1); x <= bc[0] + rx + 1; x++) if (light.isOpaque(x, y) && (matter.get(x, y) === PAL.leaf2 || matter.get(x, y) === o.rim)) matter.set(x, y, PAL.leaf2);
  }
  // the quill beads
  for (const b of beads) {
    const x = Math.round(b[0]);
    const y = Math.round(b[1]);
    light.set(x, y, PAL.leaf3);
    if (big) light.set(x - 1, y, PAL.leaf2).set(x, y - 1, PAL.leaf2);
  }
  // the eye: gold2 almond with an ink slit; snapped: the slit 1 px and the iris one value hotter
  {
    const ex = Math.floor(ec[0]);
    const ey = Math.floor(ec[1]);
    // (critic art r1) gold2 only — never the hot venom tone, never a lid pixel (the ▲ glyph): the card's eye
    // is a gold2 almond cut by a 1-px ink vertical slit with a void3 brow pixel over its back corner; the hand
    // card's a gold2 1×2 with the ink pupil beside it
    if (!big && o.lite) light.set(ex, ey, PAL.gold2).set(ex, ey + 1, PAL.gold2).set(ex + 1, ey, PAL.ink);
    else if (!big) {
      for (const dy of [0, 1]) light.set(ex - 1, ey + dy, PAL.gold2).set(ex, ey + dy, PAL.ink).set(ex + 1, ey + dy, PAL.gold2);
      light.set(ex + ls, ey - 2, PAL.void3);
    } else for (let dy = -eh + 1; dy <= eh - 1 + (eh === 1 ? 1 : 0); dy++)
      for (let dx = -ew; dx <= ew; dx++) {
        if (Math.abs(dx) / (ew + 0.6) + Math.abs(dy) / (eh + 0.4) > 1) continue;
        light.set(ex + dx, ey + dy, PAL.gold2);
      }
    // the slit
    const sw = P.eye >= 1 ? 0 : big ? 1 : 0;
    if (big) for (let dy = -eh; dy <= eh; dy++) for (let dx = 0; dx <= sw; dx++) if (light.isOpaque(ex + dx, ey + dy)) light.set(ex + dx, ey + dy, PAL.ink);
  }
  // the stinger bead and the falling drop
  const st = liteTip ?? U(...HK[2]);
  const sx = Math.round(st[0]);
  const sy = Math.round(st[1]);
  if (P.bead >= 1) {
    // a forming bead (1) is leaf2: never a bright point at the stinger's tip
    light.set(sx, sy + 1, P.bead >= 2 ? PAL.leaf3 : PAL.leaf2);
    if (P.bead >= 2) light.set(sx, sy + 2, PAL.leaf2);
    if (P.bead >= 3) {
      light.set(sx - 1, sy + 2, PAL.leaf3).set(sx, sy + 3, PAL.leaf3);
      if (big) light.set(sx + 1, sy + 2, PAL.leaf2).set(sx, sy + 2, PAL.leaf3).set(sx - 1, sy + 3, PAL.leaf2).set(sx + 1, sy + 3, PAL.leaf2).set(sx, sy + 4, PAL.leaf2);
    }
  }
  if (P.drop >= 0) {
    const y0 = sy + 3;
    const y1 = oy + P.dropTo * S;
    const y = Math.round(y0 + (y1 - y0) * P.drop);
    const r = big ? 2 : 1;
    // the drop and its 2-px stepped trail above it
    for (let k = 0; k <= r; k++) light.set(sx, y - k, k === 0 ? PAL.leaf3 : PAL.leaf2);
    if (big) light.set(sx - 1, y, PAL.leaf2).set(sx + 1, y, PAL.leaf2).set(sx, y + 1, PAL.leaf2).set(sx, y - 3, PAL.leaf1).set(sx, y - 4, PAL.leaf1);
    else light.set(sx, y - 2, PAL.leaf1);
  }
  void lineW;
  void inPoly;
  return {
    matter,
    light,
    eye: [Math.floor(ec[0]), Math.floor(ec[1])],
    bulb: [Math.round(bc[0]), Math.round(bc[1])],
    core,
    sting: [sx, sy],
    fang: [Math.round(fangTip[0]), Math.round(fangTip[1])],
    sac: [Math.round(scx[0]), Math.round(scx[1])],
  };
}
