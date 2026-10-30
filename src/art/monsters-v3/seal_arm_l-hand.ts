// Sol Kol Mührü v3 — the open hand: geometry (a skeleton of five fingers, each of three plate segments, on a palm slab) and the
// painters of its parts. The hand is the signature of this piece: it is never a sprite that moves as a whole — every finger is
// re-posed per frame (spread, three joint bends, a length factor for foreshortening), the palm slab and the thumb pad follow the
// hand axis, and every plate is shaded afresh from its own edges.
//
// Hand frame: origin at the wrist centre, u along the hand axis (wrist → fingertips), v across it, + v = toward the thumb side
// (clockwise on screen). Finger order: 0 pinky, 1 ring, 2 middle, 3 index, 4 thumb. Joint bends are cumulative from the base:
// + turns a finger clockwise on screen (toward the thumb), a thumb's + turns it clockwise too, so a GRIP is fingers + / thumb −.

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import type { Light } from '../rigkit';
import { BRONZE, MAG, OBS, bands, bar, fill, layer, rot, rnd, type Comp, type Pt } from './seal_arm_l-kit';

export const NF = 5;
export const PINKY = 0;
export const RING = 1;
export const MIDDLE = 2;
export const INDEX = 3;
export const THUMB = 4;

/** Pose of the hand's fingers (all in degrees except `len`). */
export interface HandPose {
  /** spread offsets added to the rest fan */
  sp: readonly number[];
  /** knuckle / middle joint / tip joint bends added to the rest curve */
  b1: readonly number[];
  b2: readonly number[];
  b3: readonly number[];
  /** length factor (foreshortening of a finger bent toward / away from the viewer) */
  len: readonly number[];
}
export const FLAT5: readonly number[] = [0, 0, 0, 0, 0];
export const ONE5: readonly number[] = [1, 1, 1, 1, 1];
export const HAND_REST: HandPose = { sp: FLAT5, b1: FLAT5, b2: FLAT5, b3: FLAT5, len: ONE5 };

/** Rest fan relative to the hand axis (deg) and the gentle curve of the open hand. */
const REST_SP = [-39, -20, -3, 15, 67];
const REST_B1 = [4, 4, 3, 3, -5];
const REST_B2 = [6, 6, 6, 6, -7];
const REST_B3 = [7, 7, 7, 7, -8];
/** Segment lengths and the widths at base / joint 1 / joint 2 / tip. */
const SEG: readonly (readonly number[])[] = [
  [5.4, 4.8, 4.2],
  [6.8, 6.2, 5.2],
  [7.6, 7.0, 5.6],
  [6.8, 6.2, 5.2],
  [6.2, 5.8, 4.8],
];
const WID: readonly (readonly number[])[] = [
  [4.0, 3.8, 3.4, 2.8],
  [4.6, 4.4, 4.0, 3.2],
  [4.8, 4.6, 4.2, 3.2],
  [4.6, 4.4, 4.0, 3.2],
  [5.8, 5.2, 4.5, 3.4],
];
/** Base of each finger in the hand frame (u, v). */
const BASE: readonly Pt[] = [
  [11.6, -5.9],
  [12.2, -2.0],
  [12.4, 1.9],
  [12.0, 5.7],
  [3.4, 8.8],
];
export const PALM_L = 12.8;

/** The hand's screen geometry for one pose. */
export interface HandG {
  /** wrist centre */
  w: Pt;
  /** hand axis angle (deg) */
  a: number;
  /** unit vectors u (along the hand) and v (across, + = thumb side) */
  u: Pt;
  v: Pt;
  /** joints of each finger: [base, j1, j2, tip] */
  f: Pt[][];
  /** palm polygon (screen) */
  palm: Pt[];
  /** palm disc centre (screen) */
  disc: Pt;
  /** knuckle line centre (screen) */
  knuck: Pt;
  /** centre of the five fingertips */
  claw: Pt;
}

export function handGeom(wrist: Pt, ang: number, h: HandPose): HandG {
  const c = Math.cos((ang * Math.PI) / 180);
  const s = Math.sin((ang * Math.PI) / 180);
  const u: Pt = [c, s];
  const v: Pt = [-s, c];
  const at = (a: number, b: number): Pt => [wrist[0] + u[0] * a + v[0] * b, wrist[1] + u[1] * a + v[1] * b];
  const f: Pt[][] = [];
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < NF; i++) {
    const base = at(BASE[i][0], BASE[i][1]);
    let th = ang + REST_SP[i] + h.sp[i] + REST_B1[i] + h.b1[i];
    const pts: Pt[] = [base];
    let p = base;
    const bs = [0, REST_B2[i] + h.b2[i], REST_B3[i] + h.b3[i]];
    for (let j = 0; j < 3; j++) {
      th += bs[j];
      const l = SEG[i][j] * h.len[i];
      p = [p[0] + Math.cos((th * Math.PI) / 180) * l, p[1] + Math.sin((th * Math.PI) / 180) * l];
      pts.push(p);
    }
    f.push(pts);
    cx += p[0];
    cy += p[1];
  }
  const palm: Pt[] = PALM.map(([a, b]) => at(a, b));
  return { w: wrist, a: ang, u, v, f, palm, disc: at(7.4, 0.8), knuck: at(PALM_L, 0), claw: [cx / NF, cy / NF] };
}

/** Palm slab outline (hand frame): heel at the wrist, the thumb-side bulge, a flat knuckle edge. */
const PALM: readonly Pt[] = [
  [0, -5.0],
  [2.2, -6.6],
  [7, -7.6],
  [11, -7.8],
  [13.1, -6.4],
  [13.3, 6.4],
  [11.2, 8.2],
  [8.4, 9.6],
  [4.6, 10.2],
  [1.4, 7.8],
  [0, 5.0],
];

// ---------------------------------------------------------------- painters

/** One finger segment as a shaded plate (a tapered bar), laid with a crease ring over what is behind. */
function segment(comp: Comp, id: number, a: Pt, b: Pt, wa: number, wb: number, light: Light, crease = true): void {
  const q = layer(comp.p.w, comp.p.h);
  // start a little behind the joint so a bent finger has no wedge gap on the outside of the bend
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const a2: Pt = [a[0] - (dx / l) * 0.9, a[1] - (dy / l) * 0.9];
  bar(q, a2, b, wa, wb, OBS.M);
  bands(q, OBS, light, 1, 1);
  comp.add(q, id, crease ? { out: OBS.D } : {});
}

/** Paint a finger (three plates). `tip` is the bead level 0..4 (seal light on the fingertip). */
export function paintFinger(comp: Comp, i: number, g: HandG, light: Light, partId: number): void {
  const pts = g.f[i];
  for (let j = 0; j < 3; j++) segment(comp, partId, pts[j], pts[j + 1], WID[i][j], WID[i][j + 1], light, true);
}

/** The glowing bead on a fingertip (inside the silhouette, drawn before the outline). */
export function tipBead(q: PixelCanvas, i: number, g: HandG, level: number): void {
  const pts = g.f[i];
  const a = pts[2];
  const b = pts[3];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  // one pixel just inside the tip, one a step behind it when lit
  const px = rnd(b[0] - (dx / l) * 1.0);
  const py = rnd(b[1] - (dy / l) * 1.0);
  q.set(px, py, MAG[Math.max(0, Math.min(3, level))]);
}

/** Palm slab with its knuckle blocks; returns nothing, lays itself on the comp. */
export function paintPalm(comp: Comp, g: HandG, light: Light, partId: number): void {
  const q = layer(comp.p.w, comp.p.h);
  fill(q, g.palm, OBS.M);
  bands(q, OBS, light, 3, 2, { top: 2, bottom: 2, edge: 4 });
  comp.add(q, partId, { out: OBS.D });
}

/** The thumb's pad (thenar block) over the palm's thumb-side bulge. */
export function paintThenar(comp: Comp, g: HandG, light: Light, partId: number): void {
  const q = layer(comp.p.w, comp.p.h);
  const at = (a: number, b: number): Pt => [g.w[0] + g.u[0] * a + g.v[0] * b, g.w[1] + g.u[1] * a + g.v[1] * b];
  fill(q, [at(1.2, 4.6), at(5.4, 4.4), at(7.6, 7.6), at(6.4, 10.4), at(2.4, 10.8), at(0.8, 8.0)], OBS.M);
  bands(q, OBS, light, 1, 1);
  comp.add(q, partId, { out: OBS.D });
}

/** The wrist cuff: a bronze band across the wrist (perpendicular to `axisDeg`). */
export function paintCuff(comp: Comp, w: Pt, axisDeg: number, light: Light, partId: number, wide = 6.4): void {
  const q = layer(comp.p.w, comp.p.h);
  const [cx, cy] = rot(1, 0, axisDeg);
  const [vx, vy] = rot(0, 1, axisDeg);
  const pt = (a: number, b: number): Pt => [w[0] + cx * a + vx * b, w[1] + cy * a + vy * b];
  fill(q, [pt(-3.0, -wide), pt(1.8, -wide + 0.6), pt(1.8, wide - 0.4), pt(-3.0, wide)], BRONZE.M);
  bands(q, BRONZE, light, 1, 1, { top: 1, bottom: 1 });
  comp.add(q, partId, { out: PAL.gold0 });
}
