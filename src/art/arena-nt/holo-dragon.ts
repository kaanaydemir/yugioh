// Neon Tower — the left hologram's own creature (owner B2, docs/v3/ARENA_NEON_TOWER.md §9): the KRISTAL EJDER, painted as a faceted
// crystal. No stripes, no dither, no scan rows: every part (neck + torso, head, horns, tail, legs, two wings) is a polygon cut into flat
// facets (src/art/arena-nt/holo-kit.ts); one facet = one tone of the water ramp, lit from the top-left, with a bright wire line on about half
// of the borders and a 1-px rim that is white on the lit edges. The wings are a bright bone frame with radial membrane panels.
// 142 × 120 px (wings spread), the feet on the bottom row. 8 idle frames: the chest breathes, the wings beat a few degrees, the tail
// sways, the head dips, and a diagonal shimmer lifts the facets it crosses by one tone. Pure code, no alpha, deterministic.

import { PixelCanvas } from '../pixel';
import { HOLO_LOOKS } from './holo-bake';
import { type FacetPart, type Pt, Plane, despeckle, h3, inPoly, paintFacets, renderPlane, rot, tube } from './holo-kit';

export const DRAGON_W = 142;
export const DRAGON_H = 120;
/** The feet anchor inside a frame (centre of the hind foot, bottom row). */
export const DRAGON_ANCHOR = { x: 58, y: DRAGON_H - 1 } as const;
export const DRAGON_FRAMES = 8;

const R = HOLO_LOOKS[0].ramp;

type Pose = { ph: number; dy: number; wing: number; head: number; tail: number; shim: number };
function poseOf(k: number, n: number): Pose {
  const ph = (k * Math.PI * 2) / n;
  return { ph, dy: Math.sin(ph) * 1.3, wing: Math.sin(ph + 0.7) * 0.075, head: Math.sin(ph - 0.9) * 0.05, tail: ph, shim: k / n };
}

/** Seeds on a jittered grid inside a polygon (rest pose). */
function grid(poly: readonly Pt[], step: number, salt: number): Pt[] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const q of poly) {
    x0 = Math.min(x0, q[0]);
    y0 = Math.min(y0, q[1]);
    x1 = Math.max(x1, q[0]);
    y1 = Math.max(y1, q[1]);
  }
  const out: Pt[] = [];
  for (let j = 0, y = y0; y <= y1; y += step, j++)
    for (let i = 0, x = x0 + (j % 2) * (step / 2); x <= x1; x += step, i++) {
      const p: Pt = [x + (h3(salt, i, j) - 0.5) * step * 0.7, y + (h3(salt, j, i + 40) - 0.5) * step * 0.7];
      if (inPoly(poly, p[0], p[1])) out.push(p);
    }
  return out;
}

/** The centre line of the tail at pose phase `ph` (the base stays put, the tip swings most). */
function tailLine(ph: number): Pt[] {
  const rest: Pt[] = [
    [38, 100],
    [28, 105],
    [18, 107],
    [10, 103],
    [5, 96],
    [4, 88],
    [7, 81],
  ];
  const root = rest[0];
  return rest.map((p, i) => {
    const s = i / (rest.length - 1);
    return rot(p, root, Math.sin(ph - s * 1.6) * 0.11 * s * s + 0);
  });
}

function wingFrame(side: 'far' | 'near', a: number): { S: Pt; E: Pt; W: Pt; tips: Pt[]; att: Pt } {
  const far = side === 'far';
  const S: Pt = far ? [48, 60] : [72, 60];
  const E0: Pt = far ? [32, 40] : [100, 44];
  const W0: Pt = far ? [14, 11] : [124, 11];
  const tips0: Pt[] = far
    ? [
        [1, 28],
        [2, 48],
        [13, 66],
        [30, 78],
      ]
    : [
        [140, 27],
        [140, 48],
        [130, 66],
        [110, 79],
      ];
  const att: Pt = far ? [42, 86] : [80, 88];
  const ang = far ? -a : a;
  return { S, E: rot(E0, S, ang), W: rot(W0, S, ang * 1.4), tips: tips0.map((t) => rot(t, S, ang * 1.9)), att };
}

/** Paint one wing: radial membrane panels (facets), then the bright bone frame. */
function paintWing(pl: Plane, side: 'far' | 'near', a: number, idBase: number, shim: (s: Pt) => number): void {
  const w = wingFrame(side, a);
  const far = side === 'far';
  const base = far ? 0.5 : 0.9;
  const W = w.W;
  const edge: Pt[] = [w.tips[0]];
  // trailing edge: the finger tips with a scallop (pulled in towards the wrist) between each pair, then a last scallop to the body
  const scal = (p: Pt, q: Pt, k: number): Pt => {
    const m: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    return [m[0] + (W[0] - m[0]) * k, m[1] + (W[1] - m[1]) * k];
  };
  const chain: Pt[] = [w.tips[0]];
  for (let i = 1; i < w.tips.length; i++) chain.push(scal(w.tips[i - 1], w.tips[i], 0.3), w.tips[i]);
  chain.push(scal(w.tips[w.tips.length - 1], w.att, 0.16), w.att);
  void edge;
  // one panel per gap between neighbouring fingers (plus the last one to the body): wrist → edge points
  const panels: Pt[][] = [];
  for (let i = 0; i < w.tips.length; i++) {
    const p0 = chain[i * 2];
    const pm = chain[i * 2 + 1];
    const p1 = chain[i * 2 + 2];
    panels.push([W, p0, pm, p1]);
  }
  panels.forEach((poly, i) => {
    const seeds: Pt[] = [];
    for (const r of [0.34, 0.66, 0.92])
      for (const f of [0.22, 0.78]) {
        const a0 = poly[1];
        const a1 = poly[3];
        const ex: Pt = [a0[0] + (a1[0] - a0[0]) * f, a0[1] + (a1[1] - a0[1]) * f];
        seeds.push([W[0] + (ex[0] - W[0]) * r, W[1] + (ex[1] - W[1]) * r]);
      }
    paintFacets(pl, { poly, seeds, base: base + (i % 2 ? 0.5 : -0.1), light: [-0.5, -0.85], gain: 1.1, salt: 70 + i + (far ? 0 : 20), jitter: 0.6, lo: 0, hi: 2, wires: 0.7, idBase: idBase + i * 8, boost: shim });
  });
  // the arm panel: shoulder, elbow, wrist, then down the last finger to the body
  const arm: Pt[] = [w.S, w.E, W, w.tips[0], chain[1], w.tips[1], chain[3], w.tips[2], chain[5], w.tips[3], chain[7], w.att];
  const armPoly: Pt[] = [w.S, w.E, W, chain[2], chain[4], chain[6], chain[8], w.att];
  void arm;
  paintFacets(pl, { poly: armPoly, seeds: grid(armPoly, 8, 90 + (far ? 0 : 3)), base: base + 0.5, light: [-0.4, -0.9], gain: 1.2, salt: 95 + (far ? 0 : 5), jitter: 0.7, lo: 0, hi: 2, wires: 0.6, idBase: idBase + 40, boost: shim });
  // bone frame: the arm (shoulder → elbow → wrist) thick, the fingers thin and bright
  const bone = (pts: Pt[], w0: number, w1: number, tone: number, salt: number): void => {
    const poly = tube(pts, w0, w1);
    paintFacets(pl, { poly, seeds: [pts[0], pts[pts.length - 1]], base: tone, gain: 0, jitter: 0, lo: 0, hi: 5, wires: 0, salt, idBase: idBase + 60 + salt });
  };
  bone([w.S, w.E, W], 6, 4, 3, 1);
  for (let i = 0; i < w.tips.length; i++) bone([W, w.tips[i]], 3.2, 1.2, i % 2 ? 4 : 5, 2 + i);
  // a lit edge on the bone's top-left side
  const lit = (a: Pt, b: Pt): void => {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(a[0] + ((b[0] - a[0]) * i) / n - 1);
      const y = Math.round(a[1] + ((b[1] - a[1]) * i) / n - 1);
      if (pl.has(x, y)) pl.put(x, y, 4, idBase + 99);
    }
  };
  lit(w.S, w.E);
  lit(w.E, W);
  for (let i = 0; i < w.tips.length; i += 2) lit(W, w.tips[i]);
  // the claw at the wrist: a bright 2-px hook
  const cl = rot([W[0] + (far ? -3 : 3), W[1] - 5], W, 0);
  pl.put(Math.round(cl[0]), Math.round(cl[1]), 5, idBase + 98);
  pl.put(Math.round(W[0]), Math.round(W[1]) - 1, 5, idBase + 98);
}

/** A spike (crest / claw): a small triangle with one tone. */
function spike(pl: Plane, a: Pt, tip: Pt, wd: number, tone: number, id: number): void {
  const dx = tip[0] - a[0];
  const dy = tip[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const nx = (-dy / l) * (wd / 2);
  const ny = (dx / l) * (wd / 2);
  paintFacets(pl, { poly: [[a[0] + nx, a[1] + ny], tip, [a[0] - nx, a[1] - ny]], seeds: [a], base: tone, gain: 0, jitter: 0, lo: 0, hi: 5, wires: 0, salt: id, idBase: id });
}

/** The body of one idle frame as a tone plane. */
function paintPlane(k: number, n: number): Plane {
  const P = poseOf(k, n);
  const pl = new Plane(DRAGON_W, DRAGON_H);
  // the shimmer: a diagonal band crossing the creature once per loop lifts the facets under it by one tone
  const sweep = -30 + P.shim * (DRAGON_W + DRAGON_H + 60);
  const shim = (s: Pt): number => {
    const d = (s[0] + s[1] * 0.9) * 0.78 - sweep * 0.78;
    return Math.abs(d) < 7 ? 1 : 0;
  };
  /** The chest and above rise with the breath (a smooth shear from the hips). */
  const up = (p: Pt): Pt => [p[0], p[1] + P.dy * Math.max(0, Math.min(1, (104 - p[1]) / 56))];
  const upHead = (p: Pt): Pt => {
    const q = rot(p, [66, 54], P.head);
    return up(q);
  };

  // ---- the far wing and the near wing (behind everything)
  paintWing(pl, 'far', P.wing * 0.9, 1000, shim);
  paintWing(pl, 'near', P.wing, 2000, shim);

  // ---- the tail, then the far hind leg
  const tl = tailLine(P.tail);
  const tailPoly = tube(tl, 15, 2);
  const tailSeeds: Pt[] = [];
  for (let i = 0; i < tl.length; i++) {
    tailSeeds.push([tl[i][0] + (i % 2 ? 2 : -2), tl[i][1] + (i % 2 ? -2 : 2)]);
    if (i % 2 === 0 && i > 0 && i < tl.length - 2) tailSeeds.push([(tl[i][0] + tl[i + 1][0]) / 2, (tl[i][1] + tl[i + 1][1]) / 2 + (i % 4 ? 3 : -3)]);
  }
  paintFacets(pl, { poly: tailPoly, seeds: tailSeeds, base: 1.7, light: [-0.3, -1], gain: 1.1, salt: 31, jitter: 0.8, lo: 0, hi: 3, wires: 0.55, idBase: 3000, boost: shim });
  // tail crest
  for (let i = 1; i < tl.length - 1; i += 2) spike(pl, [tl[i][0], tl[i][1] - (7 - i * 0.8)], [tl[i][0] - 2, tl[i][1] - (12 - i * 1.1)], 4, 4, 3100 + i * 3);

  const leg = (pts: Pt[], w0: number, w1: number, base: number, salt: number, id: number): void => {
    const poly = tube(pts, w0, w1);
    const seeds: Pt[] = [];
    for (let i = 0; i < pts.length; i++) seeds.push([pts[i][0] + (i % 2 ? 2.5 : -2.5), pts[i][1]]);
    paintFacets(pl, { poly, seeds, base, light: [-0.7, -0.7], gain: 1.2, salt, jitter: 0.7, lo: 0, hi: 4, wires: 0.6, idBase: id, boost: shim });
  };
  const toes = (f: Pt, id: number, tone: number): void => {
    for (let i = 0; i < 3; i++) spike(pl, [f[0] + i * 3 - 1, f[1] - 1], [f[0] + i * 3 + 3, f[1] + 2 + (i === 1 ? 1 : 0)], 3, tone, id + i * 3);
  };
  // far hind leg (behind the body, a little to the right)
  leg([[58, 90], [62, 102], [70, 109], [76, 116]], 12, 6, 1.2, 41, 3200);
  toes([73, 117], 3260, 2);

  // ---- neck + torso (a single S-curve silhouette), then the belly strip
  const BACK: Pt[] = [[38, 102], [42, 90], [46, 76], [52, 62], [58, 50], [60, 38], [64, 28], [70, 21]];
  const FRONT: Pt[] = [[80, 30], [78, 40], [76, 50], [76, 58], [78, 68], [76, 82], [70, 96], [62, 105]];
  const torso = BACK.concat(FRONT).map(up);
  const rest0 = BACK.concat(FRONT);
  const seeds = grid(rest0, 9, 51).map(up);
  paintFacets(pl, { poly: torso, seeds, base: 2.2, light: [-0.55, -0.8], gain: 1.9, salt: 52, jitter: 0.85, lo: 0, hi: 4, wires: 0.5, idBase: 4000, boost: shim });
  // belly strip: a lighter band of shard facets down the front of the chest
  const belly = tube(FRONT.slice(1, 7).map((p) => [p[0] - 4, p[1] + 1] as Pt).map(up), 6, 8);
  const bseeds: Pt[] = FRONT.slice(1, 7).map((p, i) => up([p[0] - 4 + (i % 2 ? 1.5 : -1.5), p[1] + 2]));
  paintFacets(pl, { poly: belly, seeds: bseeds, base: 3.1, light: [-0.4, -0.9], gain: 0.7, salt: 55, jitter: 0.6, lo: 2, hi: 4, wires: 0.8, idBase: 4300, boost: shim });
  // the back crest: spikes down the neck and spine
  for (let i = 1; i < 8; i++) {
    const a = up(BACK[i]);
    spike(pl, [a[0] + 2, a[1] + 1], [a[0] - 6 - (i % 2), a[1] - 2 - (i % 3)], 5, 4, 4400 + i * 3);
  }
  // near hind leg: thigh, shin, foot (over the body)
  leg([[50, 88], [48, 100], [56, 108], [60, 117]], 15, 7, 2.3, 61, 4600);
  toes([57, 118], 4660, 4);
  // front arm (reaching forward-down)
  leg([[76, 66], [84, 74], [92, 78], [98, 83]].map(up), 8, 4, 2.7, 63, 4700);
  for (let i = 0; i < 3; i++) spike(pl, up([97 + i * 2, 82 + i * 0.5]), up([103 + i * 2, 86 + i * 2]), 3, 4, 4760 + i * 3);

  // ---- horns, head (over everything)
  const horn = (pts: Pt[], w0: number, id: number): void => {
    const hp = pts.map(upHead);
    paintFacets(pl, { poly: tube(hp, w0, 1), seeds: [hp[0], hp[1], hp[2]], base: 3.3, gain: 0.6, light: [-0.7, -0.7], salt: id, jitter: 0.4, lo: 2, hi: 5, wires: 0, idBase: id });
  };
  horn([[72, 20], [64, 11], [54, 7], [50, 11]], 5, 5000);
  horn([[78, 16], [72, 7], [66, 2], [63, 5]], 4, 5010);
  const HEAD: Pt[] = [[66, 20], [76, 14], [88, 15], [99, 21], [110, 28], [110, 33], [102, 34], [96, 39], [88, 41], [79, 37], [70, 30]].map(upHead);
  const hseeds: Pt[] = [[72, 22], [82, 20], [92, 22], [102, 28], [106, 31], [84, 28], [92, 32], [98, 35], [78, 33], [88, 37]].map(upHead);
  paintFacets(pl, { poly: HEAD, seeds: hseeds, base: 3, light: [-0.5, -0.85], gain: 1.6, salt: 53, jitter: 0.6, lo: 1, hi: 4, wires: 0.7, idBase: 5100, boost: shim });
  // brow ridge + the eye + a lit jaw line
  const eye = upHead([90, 22]);
  pl.put(Math.round(eye[0]), Math.round(eye[1]), 5, 5200);
  pl.put(Math.round(eye[0]) + 1, Math.round(eye[1]), 5, 5200);
  pl.put(Math.round(eye[0]) - 1, Math.round(eye[1]) - 1, 1, 5201);
  pl.put(Math.round(eye[0]), Math.round(eye[1]) - 1, 1, 5201);
  const jaw0 = upHead([96, 37]);
  const jaw1 = upHead([109, 33]);
  for (let i = 0; i <= 8; i++) {
    const x = Math.round(jaw0[0] + ((jaw1[0] - jaw0[0]) * i) / 8);
    const y = Math.round(jaw0[1] + ((jaw1[1] - jaw0[1]) * i) / 8);
    if (pl.has(x, y)) pl.put(x, y, 4, 5202);
  }
  despeckle(pl);
  return pl;
}

/** Paint one idle frame (k of n). */
export function paintDragonFrame(k: number, n: number = DRAGON_FRAMES): PixelCanvas {
  const pl = paintPlane(k, n);
  const out = new PixelCanvas(DRAGON_W, DRAGON_H);
  renderPlane(pl, R, out);
  return out;
}
