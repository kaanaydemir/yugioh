// The 'serpent' BODY TYPE (docs/v3/A3_MIMARI.md §4.1, §4.3) — a single-member type written to the plan
// interface of src/art/bodyplans/types.ts (BodyPlan, PlanHelpers, PartPainter, planArt) but kept next to
// its first member, Mercan Yılanı. When a second serpent arrives, this file moves to
// src/art/bodyplans/serpent/v1/ (split into build / pose / skeleton / slots / helpers like biped/v1) and
// the first member's sheets stay bit-identical (sheet-hash: the move proof). Nothing here knows coral,
// water or a jet: those are the member's parts and channels.
//
// This helper file has no default export: the v3 registry imports every file of this directory, gets
// nothing from it, and never registers the art (that lives in ./_coral_serpent.ts). It is imported at
// boot by the registry's glob, so nothing heavy runs at module load (the raster pool is lazy).
//
// The skeleton (frame px of the P1 art, facing right: +x forward, +y down):
//   coil    the PLANTED base: an ellipse on the floor plane (centre, rx, ry) sampled from ph0 (where the
//           tail leaves, front-right) through the front (near) arc, the left end, to the back (far) arc
//           and ph1 (back-right, where the neck rises). `split` is where the near arc gives way to the
//           far arc (the near arc's round end shows at the left end). Pose: rx / ry / dx move the ring
//           with its BOTTOM pinned to the floor (the coil is the serpent's feet: in idle and guard only
//           `rise` is used, which lifts the far arc alone); a serpent never walks.
//   neck    rigkit geom.chain from the ring's ph1 point: one segment of `step` (+ pose.reach) px per
//           screen angle (build rest angle + pose.neck[i], degrees). Its end is the head joint.
//   tail    rigkit geom.chain from the ring's first sample (ph0 side) out to the tip, rest angles +
//           pose.tail[i]; the secondary lag (geom ChainLag: pose.lag) trails a body move late (HA-6).
//   head    a rigid assembly carried by the head joint: it sits round(joint − rest joint) + pose.head
//           px off its rest place (whole pixels: hard parts never turn by a fraction, REHBER IŞ-12);
//           the jaw hinges at build.head.hinge (pose.jaw 0 = the rest gape … 1 = wide).
// One continuous tube runs tail tip → coil → neck → head joint, in four sections (tail, near arc, far
// arc, neck) so the depth order is exact: the far arc behind, the neck rising out of it (a flat cut
// across the tube marks the bend), the near arc in front, the tail in front of it. tubeField() renders
// them with rigkit raster.tube (tapered, cylinder normals) into one per-pixel record — section, arc
// length s, signed lateral offset (+ = ventral, the inner side of the coil and the front of the rising
// neck), radius — that a member's body painter turns into its value planes.

import type { MonsterPoints, WeightClass } from '../types';
import type { BodyPlan, PartPainter, PlanHelpers, PlanMonster, PlanPose, PlanFrame } from '../bodyplans/types';
import { chain, lerp, type ChainLag, type V } from '../rigkit/geom';
import { lightOf } from '../rigkit/light';
import type { PoseDelta, RegionId } from '../rigkit/pose';
import { Raster, materialTable, type MaterialTable } from '../rigkit/raster';

// ------------------------------------------------------------------ build

export interface SerpentBuild {
  /** the ground point (= the art's anchor), frame px */
  readonly root: readonly [x: number, y: number];
  readonly coil: {
    /** ellipse centre on the floor plane */
    readonly c: readonly [x: number, y: number];
    readonly rx: number;
    readonly ry: number;
    /** ring parameter (rad: x = c.x + cos·rx, y = c.y + sin·ry) where the tail leaves (front-right) */
    readonly ph0: number;
    /** where the near arc gives way to the far arc (the left end) */
    readonly split: number;
    /** where the neck rises (back-right) */
    readonly ph1: number;
    /** ring samples from ph0 to ph1 (the first one is the tail's root) */
    readonly steps: number;
    /** tube radius at the tail's root, at the split and at the neck's root */
    readonly r: readonly [front: number, split: number, back: number];
  };
  readonly tail: {
    readonly step: number;
    /** rest screen angle of each segment, degrees, root → tip */
    readonly angles: readonly number[];
    /** tube radius at the tip */
    readonly tip: number;
  };
  readonly neck: {
    readonly step: number;
    /** rest screen angle of each segment, degrees, base → head joint */
    readonly angles: readonly number[];
    /** tube radius at the base and at the head joint; `taper` > 1 keeps it thick longer */
    readonly r: readonly [base: number, top: number];
    readonly taper: number;
    /** px along the neck (from its root) before which it gives way to the far arc: the flat cut of the bend */
    readonly cut: number;
    /**
     * the head never rotates (its pixels are whole-px stamps), so the neck's top keeps the head's angle:
     * the last `full` segments take no pose offset and the `ramp` segments below them a fading share
     */
    readonly lock: { readonly full: number; readonly ramp: number };
  };
  /** depth of each section (z of the nearest surface wins; ranges never overlap) */
  readonly depth: { readonly tail: number; readonly front: number; readonly back: number; readonly neck: number };
  /** the ventral plates: px along the neck where they start and over how many px they grow to full width */
  readonly belly: { readonly from: number; readonly ramp: number };
  /** the dorsal fin's base on the neck: px from the neck's root */
  readonly fin: { readonly from: number; readonly to: number };
  /** rest places of the head assembly's points (frame px at rest; the rig adds the head's shift) */
  readonly head: {
    readonly hinge: V;
    /** the upper jaw's front tip (snout) and the lower jaw's front tip at pose.jaw 0 */
    readonly upperTip: V;
    readonly lowerTip: V;
    /** the jaw's shear angle (rad) at pose.jaw = 1 over the rest gape (a column dx px in front of the hinge drops dx · tan) */
    readonly open: number;
    readonly eye: V;
    /** the crown's root (the back of the cranium) */
    readonly crown: V;
  };
}

export type SectionId = 'tail' | 'front' | 'back' | 'neck';
export const SECTIONS: readonly SectionId[] = Object.freeze(['tail', 'front', 'back', 'neck']);

/** Build problems against a member's frame (empty = it resolves). */
export function checkSerpent(b: SerpentBuild, frame?: PlanFrame): string[] {
  const out: string[] = [];
  const nums: [string, number][] = [
    ['coil.rx', b.coil.rx], ['coil.ry', b.coil.ry], ['coil.ph0', b.coil.ph0], ['coil.split', b.coil.split], ['coil.ph1', b.coil.ph1],
    ['tail.step', b.tail.step], ['neck.step', b.neck.step], ['neck.taper', b.neck.taper], ['neck.cut', b.neck.cut], ['neck.lock.full', b.neck.lock.full], ['neck.lock.ramp', b.neck.lock.ramp],
  ];
  for (const [n, v] of nums) if (!Number.isFinite(v)) out.push(`${n} is not a finite number`);
  if (out.length) return out;
  if (!(b.coil.ph0 < b.coil.split && b.coil.split < b.coil.ph1)) out.push(`coil phases must run ph0 < split < ph1 (${b.coil.ph0}, ${b.coil.split}, ${b.coil.ph1})`);
  if (b.coil.steps < 4) out.push(`coil.steps ${b.coil.steps} < 4`);
  if (!b.neck.angles.length || !b.tail.angles.length) out.push('the neck and the tail need at least one segment');
  if (b.neck.lock.full < 0 || b.neck.lock.ramp < 0 || b.neck.lock.full + b.neck.lock.ramp >= b.neck.angles.length) out.push(`neck.lock (${b.neck.lock.full} + ${b.neck.lock.ramp}) leaves no free segment`);
  for (const r of [...b.coil.r, ...b.neck.r, b.tail.tip]) if (!(r > 0)) out.push(`tube radius ${r} must be > 0`);
  const d = b.depth;
  if (!(d.back < d.neck && d.neck < d.front && d.front < d.tail)) out.push('depth must run back < neck < front < tail');
  if (frame && (frame.anchor[0] !== b.root[0] || frame.anchor[1] !== b.root[1])) out.push(`root (${b.root}) is not the frame anchor (${frame.anchor})`);
  return out;
}

// ------------------------------------------------------------------ pose

/**
 * Every field is an OFFSET from the build's rest (0 = rest), so a pose means the same motion on every
 * serpent build. Angles in degrees (rigkit geom.chain), lengths in px.
 *   coil    rx / ry / dx: the ring's radii and x (its bottom stays on the floor); rise: px the FAR arc
 *           (and the neck's root on it) lifts — the only coil field idle and guard may use (HA-9) with
 *           lean: px the far arc tips back (the neck's root goes back by lean · 0.95; the near arc stays
 *           planted) — the recoil of a blow or of the jet
 *   neck    per-segment angle offsets, base → head (length = build.neck.angles.length); reach: px added
 *           to every neck segment (stretch +, compress −)
 *   tail    per-segment angle offsets, root → tip; lag: the tail's ChainLag (px at the middle / tip along
 *           `dir` degrees) — the secondary follow of a body move
 *   head    px the head assembly sits off the neck's end (whole px are drawn); jaw 0 = the rest gape … 1
 *   tilt    degrees the head assembly (skull, jaw, crown) turns about the head joint, + = snout up (the
 *           neck's locked top turns with it); 0 = the still's own pixels, else the member re-samples them
 *   fin     h: the dorsal fin's height scale (1 rest, 0 flattened, > 1 flared); ph: its ripple phase 0…1
 *   fan     the tail fan's spread (0 rest, + open, − folded); crown: the coral crown's flare (0 rest … 1)
 *   slots   per-frame stations (part → slot); pass: death / revive pass progress (part 2)
 */
export interface SerpentPose {
  coil: { rx: number; ry: number; dx: number; rise: number; lean: number };
  neck: number[];
  reach: number;
  tail: number[];
  lag: { mid: number; tip: number; dir: number };
  head: { x: number; y: number };
  jaw: number;
  tilt: number;
  fin: { h: number; ph: number };
  fan: number;
  crown: number;
  slots: Record<string, string>;
  pass: Record<string, number>;
}

export type SerpentDelta = PoseDelta<SerpentPose>;

export function serpentNeutral(b: SerpentBuild): SerpentPose {
  return {
    coil: { rx: 0, ry: 0, dx: 0, rise: 0, lean: 0 },
    neck: b.neck.angles.map(() => 0),
    reach: 0,
    tail: b.tail.angles.map(() => 0),
    lag: { mid: 0, tip: 0, dir: 90 },
    head: { x: 0, y: 0 },
    jaw: 0,
    tilt: 0,
    fin: { h: 1, ph: 0 },
    fan: 0,
    crown: 0,
    slots: {},
    pass: {},
  };
}

/** Lag groups for mix() / recoil() (exclusive). */
export const SERPENT_GROUPS: Readonly<Record<string, readonly (keyof SerpentPose)[]>> = Object.freeze({
  coil: ['coil'],
  neck: ['neck', 'reach'],
  head: ['head', 'jaw', 'crown', 'tilt'],
  tail: ['tail', 'lag', 'fan'],
  fin: ['fin'],
});

/**
 * The struck-frame filter (HA-21): the fields a blow on each region may move on the contact frame.
 * head = the head assembly (and the jaw, the crown); chest = the neck; lower = the coil; tail = the
 * tail and its fan; wingN = the dorsal fin (a serpent's "wing"); extra = passes (+ the member's channels).
 */
export const SERPENT_REGIONS: Readonly<Partial<Record<RegionId, readonly (keyof SerpentPose)[]>>> = Object.freeze({
  head: ['head', 'jaw', 'crown', 'tilt'],
  chest: ['neck', 'reach'],
  lower: ['coil'],
  tail: ['tail', 'lag', 'fan'],
  wingN: ['fin'],
  extra: ['pass'],
});

// ------------------------------------------------------------------ skeleton

export interface SerpentRig {
  readonly build: SerpentBuild;
  /** the floor line (never moves) */
  readonly ground: number;
  /** the ring as posed */
  readonly coil: { readonly c: V; readonly rx: number; readonly ry: number; readonly rise: number };
  /** section polylines in TRAVEL order (tail tip → coil → neck → head joint) */
  readonly tail: readonly V[];
  readonly front: readonly V[];
  readonly back: readonly V[];
  readonly neck: readonly V[];
  /** section lengths (px) and the arc length where each starts (0 = the coil's first sample; the tail is negative) */
  readonly len: Readonly<Record<SectionId, number>>;
  readonly s0: Readonly<Record<SectionId, number>>;
  /** tube radius at each section's first and last point (neck: with build.neck.taper) */
  readonly radius: Readonly<Record<SectionId, readonly [number, number]>>;
  /** the head joint (the neck's end) */
  readonly joint: V;
  /** whole px the head assembly sits off its rest place */
  readonly shift: V;
  /** the head assembly's turn (rad, screen: − = snout up) about `pivot` (the rest head joint), before the shift */
  readonly turn: number;
  readonly pivot: V;
  /** the jaw's shear angle over the rest gape (rad, + = open): a column dx px in front of the hinge drops dx · tan(jawA) */
  readonly jawA: number;
  readonly hinge: V;
  readonly upperTip: V;
  readonly lowerTip: V;
  /** the open mouth (between the jaw tips, a pixel inside) */
  readonly mouth: V;
  readonly eye: V;
  readonly crownRoot: V;
  readonly tailTip: V;
  /** the neck's root on the far arc (the body's weight point: joints().hip) */
  readonly neckRoot: V;
}

const ringPt = (c: V, rx: number, ry: number, ph: number): V => [c[0] + Math.cos(ph) * rx, c[1] + Math.sin(ph) * ry];

function polyLen(pts: readonly V[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
}

/** The posed ring: the near arc's bottom stays on the floor whatever rx / ry do; `rise` lifts the far half, `lean` tips it back. */
function ringOf(b: SerpentBuild, p: SerpentPose): { c: V; rx: number; ry: number; rise: number; at(ph: number): V } {
  const rx = b.coil.rx + p.coil.rx;
  const ry = b.coil.ry + p.coil.ry;
  // the bottom of the ring (ph = π/2) is pinned: cy + ry = rest cy + rest ry
  const c: V = [b.coil.c[0] + p.coil.dx, b.coil.c[1] + b.coil.ry - ry];
  const rise = p.coil.rise;
  const lean = p.coil.lean;
  return {
    c,
    rx,
    ry,
    rise,
    at(ph) {
      const q = ringPt(c, rx, ry, ph);
      const back = -Math.sin(ph); // > 0 on the far half
      return back > 0 ? [q[0] - lean * back, q[1] - rise * back] : q;
    },
  };
}

/**
 * The neck's posed segment angles: rest + offsets, the top segments locked to the head (build.neck.lock):
 * they take the head's tilt (degrees, + = snout up) instead of the offsets, the ramp a blend of both.
 */
export function neckAngles(b: SerpentBuild, offs: readonly number[], tilt = 0): number[] {
  const n = b.neck.angles.length;
  const { full, ramp } = b.neck.lock;
  return b.neck.angles.map((a, i) => {
    const fromTop = n - 1 - i; // 0 = the last segment
    const k = fromTop < full ? 0 : fromTop < full + ramp ? (fromTop - full + 1) / (ramp + 1) : 1;
    return a + (offs[i] ?? 0) * k - tilt * (1 - k);
  });
}

/** Rest head joint of a build (the neck chain's end at the neutral pose). */
const restJoints = new WeakMap<SerpentBuild, V>();
function restJoint(b: SerpentBuild): V {
  let j = restJoints.get(b);
  if (!j) {
    const ring = ringOf(b, serpentNeutral(b));
    const pts = chain(ring.at(b.coil.ph1), b.neck.angles, b.neck.step);
    j = pts[pts.length - 1];
    restJoints.set(b, j);
  }
  return j;
}

export function serpentRig(b: SerpentBuild, p: SerpentPose): SerpentRig {
  const ring = ringOf(b, p);
  const { ph0, split, ph1, steps } = b.coil;
  // the coil samples: steps + 1 points from ph0 to ph1; the near arc runs to the split, the far arc on
  const coilPts: V[] = [];
  const phs: number[] = [];
  for (let i = 0; i <= steps; i++) phs.push(lerp(ph0, ph1, i / steps));
  let iSplit = 0;
  for (let i = 0; i <= steps; i++) if (phs[i] <= split) iSplit = i;
  for (const ph of phs) coilPts.push(ring.at(ph));
  // the split itself is a sample (the near arc ends exactly there)
  const splitPt = ring.at(split);
  const front = [...coilPts.slice(0, iSplit + 1), splitPt];
  const back = [splitPt, ...coilPts.slice(iSplit + 1)];
  // the neck: a chain off the far arc's end
  const neck = chain(back[back.length - 1], neckAngles(b, p.neck, p.tilt), b.neck.step + p.reach);
  // the tail: a chain off the near arc's start, with its secondary lag
  const angT = b.tail.angles.map((a, i) => a + (p.tail[i] ?? 0));
  const lagDir: V = [Math.cos((p.lag.dir * Math.PI) / 180), Math.sin((p.lag.dir * Math.PI) / 180)];
  const lag: ChainLag | undefined = p.lag.mid || p.lag.tip ? { mid: p.lag.mid, tip: p.lag.tip, dir: lagDir } : undefined;
  const tailOut = chain(front[0], angT, b.tail.step, lag);
  const tail = [...tailOut].reverse(); // travel order: tip → root
  const len = { tail: polyLen(tail), front: polyLen(front), back: polyLen(back), neck: polyLen(neck) };
  const s0 = { tail: -len.tail, front: 0, back: len.front, neck: len.front + len.back };
  const radius: Record<SectionId, readonly [number, number]> = {
    tail: [b.tail.tip, b.coil.r[0]],
    front: [b.coil.r[0], b.coil.r[1]],
    back: [b.coil.r[1], b.coil.r[2]],
    neck: [b.neck.r[0], b.neck.r[1]],
  };
  const joint = neck[neck.length - 1];
  const rj = restJoint(b);
  const shift: V = [Math.round(joint[0] - rj[0] + p.head.x), Math.round(joint[1] - rj[1] + p.head.y)];
  // the head assembly turns about the rest head joint by the tilt (screen: snout up = counter-clockwise),
  // then sits `shift` whole px off its rest place
  const turn = (-(p.tilt ?? 0) * Math.PI) / 180;
  const ct = Math.cos(turn);
  const st = Math.sin(turn);
  const add = (v: V): V => [rj[0] + (v[0] - rj[0]) * ct - (v[1] - rj[1]) * st + shift[0], rj[1] + (v[0] - rj[0]) * st + (v[1] - rj[1]) * ct + shift[1]];
  // the lower jaw turns down about the hinge by jawA (in head space)
  const jawA = p.jaw * b.head.open;
  const hinge = add(b.head.hinge);
  const upperTip = add(b.head.upperTip);
  const lj = b.head.lowerTip;
  const ja = Math.max(0, jawA);
  const hx = b.head.hinge[0];
  const hy = b.head.hinge[1];
  const lowerTip = add([hx + (lj[0] - hx) * Math.cos(ja) - (lj[1] - hy) * Math.sin(ja), hy + (lj[0] - hx) * Math.sin(ja) + (lj[1] - hy) * Math.cos(ja)]);
  // the mouth: between the two tips, a pixel back inside the gape
  const mid: V = [(upperTip[0] + lowerTip[0]) / 2, (upperTip[1] + lowerTip[1]) / 2];
  const back2hinge: V = [hinge[0] - mid[0], hinge[1] - mid[1]];
  const bl = Math.hypot(back2hinge[0], back2hinge[1]) || 1;
  const mouth: V = [mid[0] + back2hinge[0] / bl, mid[1] + back2hinge[1] / bl];
  return {
    build: b,
    ground: b.root[1],
    coil: { c: ring.c, rx: ring.rx, ry: ring.ry, rise: ring.rise },
    tail,
    front,
    back,
    neck,
    len,
    s0,
    radius,
    joint,
    shift,
    turn,
    pivot: rj,
    jawA,
    hinge,
    upperTip,
    lowerTip,
    mouth,
    eye: add(b.head.eye),
    crownRoot: add(b.head.crown),
    tailTip: tail[0],
    neckRoot: neck[0],
  };
}

/** The rest rig of a build (cached). */
const restRigs = new WeakMap<SerpentBuild, SerpentRig>();
export function serpentRest(b: SerpentBuild): SerpentRig {
  let r = restRigs.get(b);
  if (!r) {
    r = serpentRig(b, serpentNeutral(b));
    restRigs.set(b, r);
  }
  return r;
}

/** Point and unit tangent at arc length `s` (px) along a polyline (clamped). */
export function along(pts: readonly V[], s: number): { p: V; t: V } {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (acc + l >= s || i === pts.length - 1) {
      const k = l > 0 ? Math.max(0, Math.min(1, (s - acc) / l)) : 0;
      return { p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], t: l > 0 ? [(b[0] - a[0]) / l, (b[1] - a[1]) / l] : [1, 0] };
    }
    acc += l;
  }
  return { p: pts[0], t: [1, 0] };
}

// ------------------------------------------------------------------ the tube field

/** One pixel record per frame pixel: which section of the tube is nearest there and where on it. */
export interface TubeField {
  readonly w: number;
  readonly h: number;
  /** section index (SECTIONS order) or −1 */
  readonly sec: Int8Array;
  /** arc length (px; 0 at the coil's first sample, negative along the tail) */
  readonly s: Float32Array;
  /** signed lateral offset from the spine (px; + = ventral) */
  readonly v: Float32Array;
  /** the tube's radius there (px) */
  readonly r: Float32Array;
  /** the surface normal there (raster.tube's cylinder normal, unit): x, y in the picture plane, z toward the viewer */
  readonly nx: Float32Array;
  readonly ny: Float32Array;
  readonly nz: Float32Array;
  /** bounding box of the covered pixels */
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

// raster.tube writes its bias channel per pixel; the field encodes (u along the call's path, v across)
// in it as one exact float32 integer: round((u + 0.5)·4096)·1024 + round((v + 1)·511), u in −0.5…1.5 —
// past a section's end (its round cap) u goes on by the offset along the axis, so the cap's pixels keep
// distinct places along the tube
const U_Q = 4096;
const V_Q = 511;
const encUV = (u: number, v: number) => Math.round((Math.max(-0.5, Math.min(1.5, u)) + 0.5) * U_Q) * 1024 + Math.round((Math.max(-1, Math.min(1, v)) + 1) * V_Q);
const decU = (b: number) => Math.floor(b / 1024) / U_Q - 0.5;
const decV = (b: number) => (b - Math.floor(b / 1024) * 1024) / V_Q - 1;
/** u extended past an end of the path: the offset's component along the axis, in path-length units. */
function uExt(u: number, v: number, ox: number, oy: number, rad: number, len: number): number {
  if (u > 1e-6 && u < 1 - 1e-6) return u;
  const along = Math.sqrt(Math.max(0, ox * ox + oy * oy - v * v)) * Math.max(rad, 0.5);
  return u + (u <= 1e-6 ? -along : along) / Math.max(1e-6, len);
}

interface Pool {
  rasters: Raster[];
  field: { sec: Int8Array; s: Float32Array; v: Float32Array; r: Float32Array; nx: Float32Array; ny: Float32Array; nz: Float32Array };
}
const TUBE_MATS: MaterialTable = materialTable([{ ramp: [0, 1], th: [0] }]);
const pools = new Map<string, Pool>();
function poolOf(w: number, h: number): Pool {
  const k = `${w}x${h}`;
  let p = pools.get(k);
  if (!p) {
    const n = w * h;
    p = {
      rasters: SECTIONS.map(() => new Raster(w, h, lightOf('left'), TUBE_MATS)),
      field: { sec: new Int8Array(n), s: new Float32Array(n), v: new Float32Array(n), r: new Float32Array(n), nx: new Float32Array(n), ny: new Float32Array(n), nz: new Float32Array(n) },
    };
    pools.set(k, p);
  }
  return p;
}

export interface TubeOpts {
  /** extra px of radius per section (a squeeze < 0 / swell > 0 of the whole section) */
  readonly grow?: Partial<Record<SectionId, number>>;
  /** a local swell of the neck: px of radius added around arc length `at` (px along the neck), over ± `half` px */
  readonly swell?: { readonly at: number; readonly half: number; readonly px: number };
}

/**
 * Render the four sections with rigkit raster.tube (tapered tubes, cylinder normals, nearest surface
 * wins) and merge them into one per-pixel record. The neck's first `build.neck.cut` px give way to the
 * far arc wherever that covers them (the flat cut of the bend). The record is pooled per frame size: it
 * is valid until the next call (one frame is drawn at a time).
 */
export function tubeField(rig: SerpentRig, w: number, h: number, o: TubeOpts = {}): TubeField {
  const pool = poolOf(w, h);
  const b = rig.build;
  const paths: Record<SectionId, readonly V[]> = { tail: rig.tail, front: rig.front, back: rig.back, neck: rig.neck };
  SECTIONS.forEach((id, k) => {
    const r = pool.rasters[k].reset();
    const [r0, r1] = rig.radius[id];
    const g = o.grow?.[id] ?? 0;
    const path = paths[id];
    if (id === 'neck') {
      // the neck tapers on a curve (taper > 1 keeps it thick longer): drawn as short tapered pieces
      const n = path.length - 1;
      const L = rig.len.neck || 1;
      let acc = 0;
      for (let i = 0; i < n; i++) {
        const a = path[i];
        const c = path[i + 1];
        const l = Math.hypot(c[0] - a[0], c[1] - a[1]);
        const ra = lerp(r0, r1, Math.pow(acc / L, b.neck.taper)) + g + swellAt(o, acc);
        const rb = lerp(r0, r1, Math.pow((acc + l) / L, b.neck.taper)) + g + swellAt(o, acc + l);
        const u0 = acc / L;
        const du = l / L;
        const first = i === 0;
        const last = i === n - 1;
        r.tube([a, c], 2 * ra, 2 * rb, 0, {
          z: b.depth.neck,
          // only the neck's true ends extend past themselves (a piece's own caps are inside the tube)
          biasAt: (u, v, ox, oy) => encUV(u0 + ((first && u <= 1e-6) || (last && u >= 1 - 1e-6) ? uExt(u, v, ox, oy, lerp(ra, rb, u), l) : u) * du, v),
        });
        acc += l;
      }
    } else {
      const L = rig.len[id] || 1;
      r.tube(path, 2 * (r0 + g), 2 * (r1 + g), 0, { z: b.depth[id], biasAt: (u, v, ox, oy) => encUV(uExt(u, v, ox, oy, lerp(r0, r1, Math.max(0, Math.min(1, u))) + g, L), v) });
    }
  });
  const f = pool.field;
  f.sec.fill(-1);
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  const backK = SECTIONS.indexOf('back');
  const neckK = SECTIONS.indexOf('neck');
  // the joints' caps: every section end but the tail's tip is a joint with the next section, so its round
  // cap must shade as the tube going on (the cylinder normal of the end's lateral offset), not as a dome
  // whose normals turn along the axis — under the P2 light those turned the joints into notches
  const ends = SECTIONS.map((id) => {
    const p = paths[id];
    const a = p[0];
    const b = p[1] ?? a;
    const c = p[p.length - 2] ?? a;
    const d = p[p.length - 1];
    const ta = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const tb = Math.hypot(d[0] - c[0], d[1] - c[1]) || 1;
    return { start: [(b[0] - a[0]) / ta, (b[1] - a[1]) / ta] as V, end: [(d[0] - c[0]) / tb, (d[1] - c[1]) / tb] as V, tip: id === 'tail' };
  });
  for (let i = 0; i < w * h; i++) {
    let best = -1;
    let bz = -Infinity;
    for (let k = 0; k < SECTIONS.length; k++) {
      const r = pool.rasters[k];
      if (r.mat[i] < 0) continue;
      if (k === neckK && pool.rasters[backK].mat[i] >= 0 && decU(r.bias[i]) * rig.len.neck < b.neck.cut) continue;
      if (r.z[i] > bz) {
        bz = r.z[i];
        best = k;
      }
    }
    if (best < 0) continue;
    const id = SECTIONS[best];
    const bias = pool.rasters[best].bias[i];
    const u = decU(bias);
    const vv = decV(bias);
    const [r0, r1] = rig.radius[id];
    const sl = u * rig.len[id];
    const uc = Math.max(0, Math.min(1, u));
    const rad = id === 'neck' ? lerp(r0, r1, Math.pow(uc, b.neck.taper)) + (o.grow?.neck ?? 0) + swellAt(o, sl) : lerp(r0, r1, uc) + (o.grow?.[id] ?? 0);
    const win = pool.rasters[best];
    f.sec[i] = best;
    f.s[i] = rig.s0[id] + sl;
    f.v[i] = vv * rad;
    f.r[i] = rad;
    const e = ends[best];
    if ((u < 0 && !e.tip) || u > 1) {
      const t = u < 0 ? e.start : e.end;
      const vn = Math.max(-1, Math.min(1, vv));
      f.nx[i] = -t[1] * vn;
      f.ny[i] = t[0] * vn;
      f.nz[i] = Math.sqrt(1 - vn * vn);
    } else {
      f.nx[i] = win.nx[i];
      f.ny[i] = win.ny[i];
      f.nz[i] = win.nz[i];
    }
    const x = i % w;
    const y = (i - x) / w;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { w, h, sec: f.sec, s: f.s, v: f.v, r: f.r, nx: f.nx, ny: f.ny, nz: f.nz, x0, y0, x1, y1 };
}

function swellAt(o: TubeOpts, s: number): number {
  const sw = o.swell;
  if (!sw || !sw.px) return 0;
  const d = Math.abs(s - sw.at) / Math.max(0.5, sw.half);
  return d >= 1 ? 0 : sw.px * 0.5 * (1 + Math.cos(Math.PI * d));
}

/** The section polyline and its start arc length, for a section index of a TubeField. */
export function sectionPath(rig: SerpentRig, k: number): { id: SectionId; pts: readonly V[]; s0: number } {
  const id = SECTIONS[k];
  const pts = id === 'tail' ? rig.tail : id === 'front' ? rig.front : id === 'back' ? rig.back : rig.neck;
  return { id, pts, s0: rig.s0[id] };
}

// ------------------------------------------------------------------ slots

/** The pseudo-slot that outlines the frame (PAL.ink); later slots are light. */
export const OUTLINE = 'outline';

/**
 * Far → near. 'back' is the coil's far arc (the body painter splits the tube there); the dorsal fin rides
 * the neck in front of the far arc and behind the neck, the tail fan behind the tail; the crown's webs
 * and spines sit behind the skull; the jaw hangs under the skull's lip; 'front' takes matter in front of
 * everything (spray, a falling drop); after the outline: 'glow' (the eye, light in the mouth) and 'fx'.
 */
export const SERPENT_ORDER: readonly string[] = Object.freeze(['back', 'fin', 'fan', 'body', 'crown', 'jaw', 'head', 'front', OUTLINE, 'glow', 'fx']);

export function serpentSlotOf(pose: { readonly slots?: Readonly<Record<string, string>> }, part: string, layer: string): string {
  return pose.slots?.[part] ?? layer;
}

// ------------------------------------------------------------------ points, joints

/** Default anatomy points (HA-25): head = the eye, muzzle = the open mouth, core = the coil's top, feet. */
export function serpentPoints(_b: SerpentBuild, rig: SerpentRig, _p: SerpentPose): MonsterPoints {
  const pt = (v: V) => ({ x: v[0], y: v[1] });
  return {
    head: pt(rig.eye),
    muzzle: pt(rig.mouth),
    core: pt([rig.neckRoot[0], rig.neckRoot[1] - 6]),
    feet: { x: rig.build.root[0], y: rig.ground },
  };
}

/** The sameness tracks (§9.1 MOT): head (the eye), hip (the neck's root on the coil), tail (its tip), neck (its middle), jaw (the lower tip). */
export function serpentJoints(_b: SerpentBuild, rig: SerpentRig, _p: SerpentPose): Readonly<Record<string, V>> {
  return {
    head: rig.eye,
    hip: rig.neckRoot,
    tail: rig.tailTip,
    neck: along(rig.neck, rig.len.neck / 2).p,
    jaw: rig.lowerTip,
  };
}

/** More named rig points a member's `points` strings may name. */
export function serpentNamed(_b: SerpentBuild, rig: SerpentRig, _p: SerpentPose): Readonly<Record<string, V>> {
  return {
    joint: rig.joint,
    mouth: rig.mouth,
    eye: rig.eye,
    hinge: rig.hinge,
    snout: rig.upperTip,
    chin: rig.lowerTip,
    crown: rig.crownRoot,
    tailTip: rig.tailTip,
    neckRoot: rig.neckRoot,
    coil: rig.coil.c,
    root: [rig.build.root[0], rig.ground],
  };
}

/**
 * Whole px of body travel the recoil words draw (helpers.recoilPush: the neck's root on the far arc
 * leans back by f2 while the near arc stays on the floor), power 1 / 2 / 3. The kit's front knock-back of
 * a class is guardPushPx + 1 (medium 3 / 3 / 4): a serpent draws all but the last pixel of it itself, so
 * the coil it stands on slides at most a pixel.
 */
export function serpentPoseKnockPx(_b: SerpentBuild, weight: WeightClass): readonly [number, number, number] {
  switch (weight) {
    case 'heavy':
    case 'mediumHeavy':
      return [1, 1, 2];
    case 'medium':
      return [2, 2, 3];
    default:
      return [2, 3, 3];
  }
}

// ------------------------------------------------------------------ vocabulary

type Power = 1 | 2 | 3;
const TAU = Math.PI * 2;

function need(word: string, o: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(o)) if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`serpent.${word}: '${k}' is required (a finite number; got ${String(v)}) — loop words carry no default`);
}
function needPower(word: string, p: number): asserts p is Power {
  if (p !== 1 && p !== 2 && p !== 3) throw new Error(`serpent.${word}: power must be 1, 2 or 3 (got ${p})`);
}

/**
 * The serpent's own words (beyond the PlanHelpers interface), each a delta:
 *   wave({periodMs, phase, amp, lag})  a travelling wave up the neck: segment i bends amp·sin(2π(t/P +
 *                                      phase) − i·lag) degrees (lag = phase lag per segment, rad) — the
 *                                      S-breath; required arguments, no default (§9 loop signature)
 *   reach(target, o?)                  the neck offsets (degrees) that put the head joint at `target`
 *                                      (frame px), bending the lower / middle / upper neck the least;
 *                                      o.curl adds that many degrees of S (+ tighter); o.from keeps the
 *                                      given offsets as the starting shape; o.coil / o.stretch: the coil
 *                                      and pose.reach of the pose it is for; o.keep: a third the solver
 *                                      leaves as the start shape has it (a bulge the head does not undo)
 *   bend(lower, middle, upper)         a smooth S-bend: degrees spread over the three thirds of the neck
 * The plan interface's words mean, on a serpent:
 *   breathe     the coil's far arc rising and settling (px), the neck's root riding it
 *   weightShift the head swaying fore and aft over the planted coil (px)
 *   plant       the coil back on its rest ring; step: the whole coil slides (dx px; never in idle / guard)
 *   struck      frame 0 of a reaction on a region; struckBack / struckAbove; recoilPush f0 / f1 / f2
 *   guardTuck   the coil rises, the neck folds down behind it by dropPx (lead: ignored — no arms)
 *   throwArc    the head's strike arc: a cock back and up (liftPx) and a thrust forward
 */
export interface SerpentHelpers extends PlanHelpers<SerpentBuild, SerpentPose> {
  wave(o: { periodMs: number; phase: number; amp: number; lag: number }): (tMs: number) => SerpentDelta;
  reach(target: V, o?: { curl?: number; from?: readonly number[]; coil?: Partial<SerpentPose['coil']>; stretch?: number; keep?: 'lower' | 'middle' | 'upper'; tilt?: number }): number[];
  bend(lower: number, middle: number, upper: number): number[];
}

/** Smooth weights of segment i over the three thirds of a neck of n segments. */
function thirds(n: number, i: number): [number, number, number] {
  const t = n <= 1 ? 0.5 : i / (n - 1);
  const bump = (c: number) => Math.max(0, 1 - Math.abs(t - c) / 0.42);
  return [bump(0.12), bump(0.5), bump(0.88)];
}

export function serpentHelpers(b: SerpentBuild): SerpentHelpers {
  const n = b.neck.angles.length;
  const bend = (lower: number, middle: number, upper: number): number[] =>
    b.neck.angles.map((_, i) => {
      const [w0, w1, w2] = thirds(n, i);
      return lower * w0 + middle * w1 + upper * w2;
    });
  const endOf = (offs: readonly number[], p: SerpentPose): V => {
    const ring = ringOf(b, p);
    const pts = chain(ring.at(b.coil.ph1), neckAngles(b, offs, p.tilt), b.neck.step + p.reach);
    return pts[pts.length - 1];
  };
  const struck = (region: RegionId, power: Power): SerpentDelta => {
    needPower('struck', power);
    switch (region) {
      case 'head':
        return { head: { x: -power, y: -(power === 3 ? 2 : 1) }, jaw: 0.15 * power };
      case 'chest':
        return { neck: bend(0, -2 * power, -3 * power) };
      case 'tail':
        return { tail: b.tail.angles.map((_, i) => -6 * power * (i + 1) / b.tail.angles.length) };
      case 'lower':
        return { coil: { rise: -1 } };
      case 'wingN':
        return { fin: { h: 1 - 0.2 * power } };
      default:
        return {};
    }
  };
  return {
    breathe(o) {
      need('breathe', { periodMs: o?.periodMs, phase: o?.phase, amp: o?.amp });
      if (!(o.periodMs > 0)) throw new Error(`serpent.breathe: periodMs must be > 0 (got ${o.periodMs})`);
      return (t) => ({ coil: { rise: o.amp * 0.5 * (1 - Math.cos(TAU * (t / o.periodMs + o.phase))) } });
    },
    weightShift(o) {
      need('weightShift', { periodMs: o?.periodMs, phase: o?.phase, px: o?.px });
      if (!(o.periodMs > 0)) throw new Error(`serpent.weightShift: periodMs must be > 0 (got ${o.periodMs})`);
      return (t) => ({ head: { x: o.px * Math.sin(TAU * (t / o.periodMs + o.phase)) } });
    },
    plant() {
      return { coil: { rx: 0, ry: 0, dx: 0, rise: 0, lean: 0 } };
    },
    step(_foot, dx) {
      need('step', { dx });
      return { coil: { dx } };
    },
    struck,
    struckBack(power) {
      needPower('struckBack', power);
      return { neck: bend(0, 2 * power, 4 * power), head: { x: power } };
    },
    struckAbove(power) {
      needPower('struckAbove', power);
      return { coil: { rise: -power }, head: { y: power }, reach: -0.3 * power };
    },
    recoilPush(weight, power) {
      needPower('recoilPush', power);
      const k = serpentPoseKnockPx(b, weight)[power - 1];
      const f0 = struck('head', power);
      const f1: SerpentDelta = { coil: { rise: -1 }, neck: bend(-2 * Math.ceil(k / 2), -2 * power, -3 * power), head: { x: -power } };
      const f2: SerpentDelta = { coil: { rise: -1 }, neck: bend(-2 * k, -power, -power), head: { x: -Math.ceil(power / 2) } };
      return [f0, f1, f2];
    },
    guardTuck(o) {
      need('guardTuck', { dropPx: o?.dropPx });
      return { coil: { rise: 2 }, reach: -o.dropPx / Math.max(1, n), neck: bend(-6, -10, 8) };
    },
    throwArc(o) {
      need('throwArc', { liftPx: o?.liftPx });
      return [{ neck: bend(-8, -12, 6), head: { y: -o.liftPx } }, { neck: bend(6, 10, -4), head: { x: o.liftPx } }];
    },
    wave(o) {
      need('wave', { periodMs: o?.periodMs, phase: o?.phase, amp: o?.amp, lag: o?.lag });
      if (!(o.periodMs > 0)) throw new Error(`serpent.wave: periodMs must be > 0 (got ${o.periodMs})`);
      return (t) => ({ neck: b.neck.angles.map((_, i) => o.amp * Math.sin(TAU * (t / o.periodMs + o.phase) - i * o.lag)) });
    },
    bend,
    reach(target, o = {}) {
      // Gauss–Newton over the three bend weights (+ the curl), least change from the start shape; the
      // neck's root rides the posed coil (o.coil) and its segments the posed stretch (o.stretch = pose.reach)
      const base = o.from ? [...o.from] : b.neck.angles.map(() => 0);
      const curl = o.curl ? bend(-o.curl, o.curl, -o.curl * 0.5) : base.map(() => 0);
      const n0 = serpentNeutral(b);
      const neutral: SerpentPose = { ...n0, coil: { ...n0.coil, ...o.coil }, reach: o.stretch ?? 0, tilt: o.tilt ?? 0 };
      let c = [0, 0, 0];
      const offs = (cc: readonly number[]) => base.map((v, i) => {
        const [w0, w1, w2] = thirds(n, i);
        return v + curl[i] + cc[0] * w0 + cc[1] * w1 + cc[2] * w2;
      });
      for (let it = 0; it < 24; it++) {
        const e0 = endOf(offs(c), neutral);
        const r: V = [target[0] - e0[0], target[1] - e0[1]];
        if (Math.hypot(r[0], r[1]) < 0.02) break;
        // numeric Jacobian (2 × 3)
        const J: number[][] = [[], []];
        const kept = o.keep === 'lower' ? 0 : o.keep === 'middle' ? 1 : o.keep === 'upper' ? 2 : -1;
        for (let k = 0; k < 3; k++) {
          if (k === kept) {
            J[0][k] = 0;
            J[1][k] = 0;
            continue;
          }
          const d = [...c];
          d[k] += 0.5;
          const e = endOf(offs(d), neutral);
          J[0][k] = (e[0] - e0[0]) / 0.5;
          J[1][k] = (e[1] - e0[1]) / 0.5;
        }
        // minimum-norm step: dc = Jᵀ (J Jᵀ + λI)⁻¹ r
        const a = J[0][0] * J[0][0] + J[0][1] * J[0][1] + J[0][2] * J[0][2] + 1e-3;
        const bb = J[0][0] * J[1][0] + J[0][1] * J[1][1] + J[0][2] * J[1][2];
        const d2 = J[1][0] * J[1][0] + J[1][1] * J[1][1] + J[1][2] * J[1][2] + 1e-3;
        const det = a * d2 - bb * bb || 1e-9;
        const y0 = (d2 * r[0] - bb * r[1]) / det;
        const y1 = (-bb * r[0] + a * r[1]) / det;
        c = c.map((v, k) => v + J[0][k] * y0 + J[1][k] * y1);
      }
      return offs(c).map((v) => Math.round(v * 100) / 100);
    },
  };
}

// ------------------------------------------------------------------ the plan

export type SerpentPlan = BodyPlan<SerpentBuild, SerpentPose, SerpentRig> & { helpers(b: SerpentBuild): SerpentHelpers };
/** A serpent member (its PlanMonster). */
export type SerpentMember<Fx extends Record<string, number> = {}> = PlanMonster<SerpentBuild, SerpentPose, SerpentRig, Fx>;
/** One part painter of a serpent member. */
export type SerpentPart<Fx extends Record<string, number> = {}> = PartPainter<PlanPose<SerpentPose, Fx>, SerpentRig>;

/**
 * The 'serpent' type, version 1. A single-member type has no version directory yet (A3_MIMARI §4.3), so
 * its version is written here; when the type moves to src/art/bodyplans/serpent/v1/, its index stamps
 * the same number from the directory (versionDir) and this literal goes away.
 */
export const serpent: SerpentPlan = Object.freeze({
  id: 'serpent',
  version: 1,
  neutral: serpentNeutral,
  groups: SERPENT_GROUPS,
  regions: SERPENT_REGIONS,
  rig: serpentRig,
  order: SERPENT_ORDER,
  points: serpentPoints,
  joints: serpentJoints,
  poseKnockPx: serpentPoseKnockPx,
  helpers: serpentHelpers,
  check: checkSerpent,
  slotOf: serpentSlotOf,
  named: serpentNamed,
});
