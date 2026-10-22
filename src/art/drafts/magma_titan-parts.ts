// Magma Titanı — DRAFT (A3 Y9, the start of A4.1): build, geometry and part painters on biped v1.
//
// Same character as v1 (src/art/monsters/magma_titan.ts, untouched): the SILHOUETTE geometry of every
// part is v1's — its torso polygon, shoulder boulders, faceted limb chunks (same jitter seeds), fists,
// feet, knee caps and head outline — so the new idle f0 keeps v1's alpha mask (REHBER Sİ-5). The
// INSIDE is repainted from scratch in the still style of the approved Taş Muhafız (src/still/
// sentinel-map.ts): flat value planes under one key light, creases instead of ink, few deliberate
// lines, materials that read apart:
//   basalt  (src/art/materials/defs/basalt.ts) the stone family one value darker and glassy: lit
//           stone2 / mid stone1 / shadow stone0, night0 cuts, a crisp stone3 edge on the light-facing
//           silhouette of the big near blocks. Every rock plane is a G-buffer facet with a real normal
//           (rigkit Raster), so the P2 relight is lit from its own side, not mirrored (IŞ-1, IŞ-2).
//   lava    (defs/lava.ts) LIGHT: seams, the chest core, eyes, mouth, vents and fist heat are drawn
//           after the outline by one 'glow' painter, in part space (only on the pixels the part owns
//           in the frame: an arm in front hides the chest seams under it).
//
// Parts and slots (biped v1 order: far → near; the plan outlines once at 'outline'):
//   armF · shoulderF · legF · legN · torso · head · armN · shoulderN | outline | glow · fx
// Stations used by poses: armF → 'armF.front' (the guard X), head → 'head.front' (the lunge).
//
// Plan deviations worked around in the member (requests: shots/v3/a3/titan-draft/plan-requests.md):
//   - knees: biped v1 bends every knee forward; v1's titan stands on legs whose knees break BACK
//     (its squat, bow-legged mass). The leg painters re-solve the knee with bend +1 from the rig's
//     hip and ankle (the plan's kneeN / kneeF named points are not used; joints() never had knees).
//   - fist direction: BipedArm has no wrist angle; the member's fx channels aimN / aimF (an angle,
//     blended in by the weights aimNw / aimFw) turn the fist away from the forearm line (the cocked
//     fist at the hip, the knuckles leading on contact, the knuckles up in the guard X).

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import { edgePaint } from '../rigkit/edges';
import { fillPoly, ik2, type V, type V3 } from '../rigkit/geom';
import type { Light } from '../rigkit/light';
import type { MatRef, Raster } from '../rigkit/raster';
import type { PartCtx, PlanPose } from '../bodyplans/types';
import { restOf, type BipedBuild, type BipedPart, type BipedPose, type BipedRig } from '../bodyplans/biped/v1';

// ------------------------------------------------------------------ build and channels

/**
 * v1's proportions (idle f0 of src/art/monsters/magma_titan.ts, its neutral pose N): feet 28 / 51 on
 * the ground line 77, hip joints 31 / 45 at y 58, shoulders 21,31 / 50,29 (the chest 2.5 px behind the
 * hips: spine −0.092), head 10 px centred 46,32 (hunch 0.32, sunk forward), arms 14 / 13, legs 10 / 9,
 * the near fist hanging under its shoulder, the far arm at full stretch behind the chest. Checked:
 * restOf() puts every one of these joints on v1's pixel.
 */
export const TITAN_BUILD: BipedBuild = Object.freeze({
  root: [39, 77] as const,
  preset: 'heavy' as const,
  height: 50,
  shoulder: 29,
  hip: 14,
  arm: [14, 13] as const,
  leg: [10, 9] as const,
  stance: 23,
  hunch: 0.32,
  headSink: 0,
  lower: 'legs' as const,
  farArm: 'free' as const,
  pelvis: 19,
  head: 10,
  ankle: 4,
  spine: Math.atan2(-2.5, 27),
  stanceAt: 0.5,
  hipAt: -1.5,
  headAt: [2.5, -1.4] as const,
  farRise: 2,
  hands: { N: [0, 0.7] as const, F: [9.59, 0.62] as const },
});

/** The titan's own channels (A3_MIMARI §3.4 Fx): light, expression and effect state of a frame. */
export interface TitanFx extends Record<string, number> {
  /** chest core glow 0…2.4 (1 = rest; ≥ 2 a white heart) */
  core: number;
  /** seam glow 0…2 (1 = rest) */
  seam: number;
  /** delay (in core-pulse units) with which the seams follow the core: the glow runs outward */
  wave: number;
  /** eye glow 0…2 */
  eye: number;
  /** shoulder vent eruption 0…1.6 */
  flare: number;
  /** near fist heat 0…1 (molten from the knuckles back) */
  heat: number;
  /** magma burst off the knuckles 0…1 */
  burst: number;
  /** head expression: 0 calm, 1 blaze, 2 snarl, 3 roar, 4 struck, 5 guard */
  expr: number;
  /** near / far fist aim: the knuckles point at `aim` (rad) with weight `aimW` 0…1, else along the forearm */
  aimN: number;
  aimNw: number;
  aimF: number;
  aimFw: number;
  /** shoulder boulders riding late (whole px offsets from their shoulder: the follower lag, HA-6) */
  bldNx: number;
  bldNy: number;
  bldFy: number;
  /** lava drip phase 0…1 (−1 = no drip), ember phase 0…1 */
  drip: number;
  ember: number;
  /** flicker phase (any number) */
  t: number;
  /** struck chips 0…1 (0 none), stomp splash 0…1, swing smear 0 / 1 */
  chips: number;
  stomp: number;
  smear: number;
}

export const TITAN_FX: TitanFx = Object.freeze({
  core: 1,
  seam: 1,
  wave: 0,
  eye: 1,
  flare: 0,
  heat: 0,
  burst: 0,
  expr: 0,
  aimN: 0,
  aimNw: 0,
  aimF: 0,
  aimFw: 0,
  bldNx: 0,
  bldNy: 0,
  bldFy: 0,
  drip: -1,
  ember: -1,
  t: 0,
  chips: 0,
  stomp: 0,
  smear: 0,
});

export type TitanPose = PlanPose<BipedPose, TitanFx>;
type Ctx = PartCtx<TitanPose, BipedRig>;
type Part = BipedPart<TitanFx>;

// ------------------------------------------------------------------ small maths

const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k];
const rot = (v: V, a: number): V => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpV = (a: V, b: V, t: number): V => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const unit = (v: V): V => {
  const d = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / d, v[1] / d];
};
const n3 = (x: number, y: number, z: number): V3 => {
  const d = Math.hypot(x, y, z) || 1;
  return [x / d, y / d, z / d];
};
const rotN = (n: V3, a: number): V3 => {
  const [x, y] = rot([n[0], n[1]], a);
  return [x, y, n[2]];
};
const TAU = Math.PI * 2;

/** v1's deterministic hash (the chunk jitter keeps v1's craggy contour, seed for seed). */
export function hash(a: number, b = 0, c = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ------------------------------------------------------------------ the frame's geometry

/** v1 limb lengths and the knee break (v1: every leg bends +1, knees back). */
const THIGH = 10;
const SHIN = 9;
const ANKLE = 4;
const REST = restOf(TITAN_BUILD);
/** The rig's waist in torso-local (v1) coordinates: the chest leans around it. */
const WAIST_Y = -11.5;
const WAIST_X = -0.25;

export interface TitanGeo {
  /** v1's pelvis centre (the torso-local origin) */
  readonly O: V;
  /** whole-spine lean and chest lean relative to the rest (rad, + forward) */
  readonly a0: number;
  readonly a1: number;
  /** torso-local (v1 coordinates: x forward, y up negative, origin O) → frame px */
  T(x: number, y: number): V;
  /** the lean of a torso-local height (for the normals) */
  angleAt(y: number): number;
  readonly shN: V;
  readonly shF: V;
  readonly hipN: V;
  readonly hipF: V;
  readonly kneeN: V;
  readonly kneeF: V;
  readonly ankN: V;
  readonly ankF: V;
  readonly footN: V;
  readonly footF: V;
  readonly elbN: V;
  readonly wrN: V;
  readonly elbF: V;
  readonly wrF: V;
  /** knuckle directions (rad) */
  readonly dirN: number;
  readonly dirF: number;
  /** head centre (frame px) and its stamp origin (whole px: the head is a rigid map, IŞ-12) */
  readonly head: V;
  readonly headAt: V;
  readonly core: V;
  readonly fx: TitanFx;
  readonly pose: TitanPose;
}

const GEO = new WeakMap<object, TitanGeo>();

/** The frame's geometry (memoised per rig object: every painter of a frame shares it). */
export function geoOf(rig: BipedRig, pose: TitanPose): TitanGeo {
  const hit = GEO.get(rig);
  if (hit) return hit;
  const a0 = rig.spine[0] - REST.spine;
  const a1 = rig.spine[1] - REST.spine;
  const O = add(rig.pelvis, rot([-1, -2], a0));
  const W = add(O, rot([WAIST_X, WAIST_Y], a0));
  const breath = pose.breath;
  const T = (x: number, y: number): V => {
    const lift = y < -8 ? breath * Math.min(1, (-y - 8) / 10) : 0;
    const Y = y - lift;
    if (Y >= WAIST_Y) return add(O, rot([x, Y], a0));
    return add(W, rot([x - WAIST_X, Y - WAIST_Y], a1));
  };
  const leg = (hip: V, foot: V): [V, V] => {
    const ank: V = [foot[0], foot[1] - ANKLE];
    const knee = ik2(hip, ank, THIGH, SHIN, 1);
    // v1: the ankle is where the shin ends (an unreachable target leaves it short)
    const an = add(knee, mul(unit(sub(ank, knee)), SHIN));
    return [knee, an];
  };
  const [kneeN, ankN] = leg(rig.hipN, rig.footN);
  const [kneeF, ankF] = leg(rig.hipF, rig.footF);
  const fx = pose.fx;
  const dirOf = (el: V, wr: V, aim: number, w: number) => {
    const a = Math.atan2(wr[1] - el[1], wr[0] - el[0]);
    let d = aim - a;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    return a + d * clamp(w, 0, 1);
  };
  const g: TitanGeo = {
    O,
    a0,
    a1,
    T,
    angleAt: (y) => (y - (y < -8 ? breath : 0) >= WAIST_Y ? a0 : a1),
    shN: rig.shoulderN,
    shF: rig.shoulderF,
    hipN: rig.hipN,
    hipF: rig.hipF,
    kneeN,
    kneeF,
    ankN,
    ankF,
    footN: rig.footN,
    footF: rig.footF,
    elbN: rig.armN.mid,
    wrN: rig.armN.end,
    elbF: rig.armF.mid,
    wrF: rig.armF.end,
    dirN: dirOf(rig.armN.mid, rig.armN.end, fx.aimN, fx.aimNw),
    dirF: dirOf(rig.armF.mid, rig.armF.end, fx.aimF, fx.aimFw),
    head: rig.head,
    headAt: [Math.round(rig.head[0] - 6), Math.round(rig.head[1] - 4)],
    core: T(2, -15),
    fx,
    pose,
  };
  GEO.set(rig, g);
  return g;
}

// ------------------------------------------------------------------ facet painting (G-buffer)

/** A flat plane: its polygon (local px), its normal (art space, before the part's rotation), a bias. */
interface Facet {
  readonly pts: readonly V[];
  readonly n: V3;
  readonly bias?: number;
}

/** Fill facets in order (later ones win) through a transform; normals turned by `ang`. */
function facets(r: Raster, m: MatRef, list: readonly Facet[], tf: (p: V) => V, ang: number, z0: number) {
  list.forEach((f, i) => {
    const n = rotN(f.n, ang);
    fillPoly(
      f.pts.map((p) => tf(p)),
      (x, y) => r.put(x, y, m, n[0], n[1], n[2], z0 + i * 0.01, f.bias ?? 0),
    );
  });
}

/** One pixel-exact plane map: '.' empty, a letter → its facet normal (rigid parts: the head). */
function facetMap(r: Raster, m: MatRef, rows: readonly string[], at: V, key: Readonly<Record<string, { n: V3; bias?: number }>>, z: number) {
  for (let j = 0; j < rows.length; j++)
    for (let i = 0; i < rows[j].length; i++) {
      const k = key[rows[j][i]];
      if (!k) continue;
      r.put(at[0] + i, at[1] + j, m, k.n[0], k.n[1], k.n[2], z, k.bias ?? 0);
    }
}

/**
 * Plane normals of a limb or block side under the frame's light: the side whose screen direction
 * faces the light is the LIT plane, its opposite the SHADOW plane, the rest the MID plane. Picked per
 * light (P2 relights the other side), not per the side's name — a hanging rock limb lit straight from
 * above would otherwise read as one flat value (the light runs along its bone).
 */
function sidePlanes(side: V, light: Light): { lit: V3; mid: V3; dark: V3; litSign: 1 | -1 } {
  const L = light.v;
  const litSign: 1 | -1 = side[0] * light.v2[0] + side[1] * light.v2[1] >= 0 ? 1 : -1;
  return {
    lit: n3(L[0] + side[0] * litSign * 0.3, L[1] + side[1] * litSign * 0.3, L[2]),
    mid: n3(0, 0.12, 1),
    dark: n3(-L[0] * 0.9, -L[1] * 0.9, 0.35),
    litSign,
  };
}

/**
 * A faceted rock prism along a → b (widths wa → wb): v1's craggy chunk contour (same jitter, same
 * seed) filled with three flat planes parallel to the bone — the lit side, the front, the shadow
 * side (sidePlanes) — so every limb reads lit / mid / shadow in both views.
 */
function chunk(r: Raster, m: MatRef, a: V, b: V, wa: number, wb: number, seed: number, z: number, light: Light, o: { lit?: number; dark?: number } = {}) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const u: V = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  let n: V = [-u[1], u[0]];
  if (n[0] + n[1] > 0) n = [-n[0], -n[1]];
  const K = Math.max(2, Math.round(L / 4));
  const side = (sgn: number): V[] => {
    const out: V[] = [];
    for (let i = 0; i <= K; i++) {
      const f = i / K;
      const w = lerp(wa, wb, f) / 2 + (hash(seed, i, sgn > 0 ? 1 : 2) - 0.5) * 1.6;
      out.push([a[0] + u[0] * L * f + n[0] * w * sgn, a[1] + u[1] * L * f + n[1] * w * sgn]);
    }
    return out;
  };
  const lit = side(1);
  const dark = side(-1);
  const capB: V[] = [add(add(b, mul(u, 1.5)), mul(n, wb * 0.25)), sub(add(b, mul(u, 1.5)), mul(n, wb * 0.25))];
  const capA: V[] = [sub(sub(a, mul(u, 1.5)), mul(n, wa * 0.25)), add(sub(a, mul(u, 1.5)), mul(n, wa * 0.25))];
  const poly = [...lit, ...capB, ...dark.reverse(), ...capA];
  const pl = sidePlanes(n, light);
  const litAt = o.lit ?? 0.3;
  const darkAt = o.dark ?? 0.4;
  fillPoly(poly, (x, y) => {
    const px = x + 0.5 - a[0];
    const py = y + 0.5 - a[1];
    const along = px * u[0] + py * u[1];
    const across = px * n[0] + py * n[1];
    const hw = lerp(wa, wb, clamp(along / L, 0, 1)) / 2;
    const v = (across / hw) * pl.litSign;
    const nn = v > litAt ? pl.lit : v < -darkAt ? pl.dark : pl.mid;
    r.put(x, y, m, nn[0], nn[1], nn[2], z + (1 - Math.min(1, v * v)) * 2);
  });
}

/** A dome (knee cap, elbow spur): two flat planes split across the light, not a gradient. */
function knob(r: Raster, m: MatRef, c: V, rad: number, z: number, light: Light) {
  const L = light.v;
  const nUp = n3(L[0], L[1], L[2]);
  const nDn = n3(-L[0] * 0.5, -L[1] * 0.5, 0.8);
  const r2 = rad * rad;
  for (let y = Math.floor(c[1] - rad); y <= Math.ceil(c[1] + rad); y++)
    for (let x = Math.floor(c[0] - rad); x <= Math.ceil(c[0] + rad); x++) {
      const dx = x + 0.5 - c[0];
      const dy = y + 0.5 - c[1];
      if (dx * dx + dy * dy > r2) continue;
      const nn = dx * light.v2[0] + dy * light.v2[1] > -0.4 ? nUp : nDn;
      r.put(x, y, m, nn[0], nn[1], nn[2], z);
    }
}

/**
 * v1's fist block (knuckles toward dir, scaled by fs) as planes: the side of the block facing the
 * light (the back of the hand), the knuckle face, the front, the side away from the light.
 */
function fist(r: Raster, m: MatRef, wr: V, dir: number, fs: number, z: number, light: Light): V[] {
  const ux = Math.cos(dir);
  const uy = Math.sin(dir);
  const F = (u: number, v: number): V => [wr[0] + (ux * u - uy * v) * fs, wr[1] + (uy * u + ux * v) * fs];
  const outline = [F(-3, -6.5), F(2, -7.5), F(6, -6.5), F(8.5, -3.5), F(8.5, 3.5), F(6, 6.5), F(2, 7.5), F(-3, 6.5), F(-4.5, 0)];
  const pv: V = [-uy, ux];
  const pl = sidePlanes(pv, light);
  // the knuckle face: lit when it turns to the light, else the shadow plane
  const kFace = ux * light.v2[0] + uy * light.v2[1] > 0.2 ? pl.lit : ux * light.v2[0] + uy * light.v2[1] < -0.35 ? pl.dark : pl.mid;
  fillPoly(outline, (x, y) => {
    const px = x + 0.5 - wr[0];
    const py = y + 0.5 - wr[1];
    const u = (px * ux + py * uy) / fs;
    const v = ((-px * uy + py * ux) / fs) * pl.litSign;
    const nn = u > 5.4 ? kFace : v > 2.2 ? pl.lit : v < -3.2 ? pl.dark : pl.mid;
    r.put(x, y, m, nn[0], nn[1], nn[2], z);
  });
  // knuckle bumps: v1's three discs, lit on their light side
  for (const v of [-4, 0, 4]) {
    const c = F(7.5, v);
    const rad = 1.8 * fs;
    for (let y = Math.floor(c[1] - rad); y <= Math.ceil(c[1] + rad); y++)
      for (let x = Math.floor(c[0] - rad); x <= Math.ceil(c[0] + rad); x++) {
        const dx = x + 0.5 - c[0];
        const dy = y + 0.5 - c[1];
        if (dx * dx + dy * dy > rad * rad) continue;
        const nn = v * pl.litSign > 0 ? pl.lit : kFace;
        r.put(x, y, m, nn[0], nn[1], nn[2], z + 0.5);
      }
  }
  return outline;
}

/** v1's foot slab (toes forward) at the ankle x, sole on the foot's ground y: top plane, toe face, side. */
function foot(r: Raster, m: MatRef, ax: number, fy: number, z: number) {
  const fx = ax;
  facets(
    r,
    m,
    [
      { pts: [[fx - 6, fy - 5], [fx + 3, fy - 6], [fx + 7, fy - 4], [fx + 9, fy - 1], [fx + 9, fy], [fx - 7, fy]], n: n3(0.1, 0.2, 1) },
      // the top plane (v1's lit slab top)
      { pts: [[fx - 6, fy - 5], [fx + 3, fy - 6], [fx + 5, fy - 4], [fx - 6, fy - 3]], n: n3(-0.2, -0.9, 0.45) },
      // the toe face turns toward the foe
      { pts: [[fx + 5, fy - 4.5], [fx + 7, fy - 4], [fx + 9, fy - 1], [fx + 9, fy], [fx + 5, fy]], n: n3(0.7, -0.1, 0.7) },
    ],
    (p) => p,
    0,
    z,
  );
}

// ------------------------------------------------------------------ the torso (v1 outline, new planes)

/** v1's torso outline (torso-local). */
const TORSO: readonly V[] = [
  [-9, 2], [-12, -4], [-16, -11], [-18, -18], [-18, -24], [-14, -29], [-6, -32], [4, -32],
  [12, -30], [17, -26], [21, -19], [20, -11], [15, -4], [10, 2],
];
/** v1's belly band (torso-local). */
const BELT: readonly V[] = [[-12, -1], [12, -2], [14, 4], [9, 7], [-9, 7], [-13, 4]];

/**
 * The torso planes (P1 reading; P2 relights them from the other side):
 *   ridge     the shoulder ridge between the boulders — faces up (lit in both views)
 *   pecN      the near pectoral slab — up / left / forward: the big lit plane of P1
 *   pecF      the far pectoral slab — right / forward: mid in P1, the lit plane of P2
 *   flankN    the near flank under the pec — left: lit in P1
 *   abdomen   the belly plate — front, a little down: mid
 *   flankF    the far flank — right: the shadow side of P1
 *   belt      the rock belt: a lit top lip, a mid face, a shadowed underside
 */
const TORSO_PLANES: readonly Facet[] = [
  { pts: TORSO, n: n3(0, 0.15, 1) },
  { pts: [[-14, -29], [-6, -32], [4, -32], [12, -30], [17, -26], [9, -27], [0, -28], [-9, -27]], n: n3(0, -0.9, 0.45) },
  { pts: [[-18, -24], [-14, -29], [-9, -27], [0, -28], [1, -20], [0, -13], [-7, -11], [-16, -11], [-18, -18]], n: n3(-0.45, -0.3, 0.84) },
  { pts: [[0, -28], [9, -27], [17, -26], [21, -19], [20, -13], [9, -12], [4, -12], [1, -20]], n: n3(0.45, -0.22, 0.86) },
  { pts: [[-16, -11], [-7, -11], [-6, -3], [-12, -4]], n: n3(-0.62, 0.05, 0.78) },
  { pts: [[-7, -11], [0, -13], [9, -12], [11, -4], [-6, -3]], n: n3(0, 0.22, 1) },
  { pts: [[9, -12], [20, -13], [20, -11], [15, -4], [11, -4]], n: n3(0.75, 0.15, 0.64) },
  { pts: BELT, n: n3(0, 0.3, 1) },
  { pts: [[-12, -1], [12, -2], [12.5, 0], [-12.5, 1]], n: n3(0, -0.85, 0.5) },
  { pts: [[-13, 4], [14, 4], [9, 7], [-9, 7]], n: n3(0, 0.9, 0.42) },
];
/** The creases where a plate overhangs the one below (torso-local polylines). */
const TORSO_CREASES: readonly (readonly V[])[] = [
  // under the near pec
  [[-16, -10.5], [-7, -10.5], [0, -12.5]],
  // under the far pec
  [[4, -11.5], [9, -11.5], [20, -12.5]],
  // the belt's top lip
  [[-12, -1.5], [12, -2.5]],
];
/** The core socket in the sternum (torso-local), its radius. */
const CORE_L: V = [2, -15];
const CORE_R = 5.2;

// ------------------------------------------------------------------ boulders (v1 outlines, new planes)

/** v1's near boulder outline (local to the shoulder joint). */
const BOULDER_N: readonly V[] = [
  [-9, 3], [-10, -2], [-8, -7], [-5, -9], [-3, -12], [-1, -9], [2, -9], [4, -12], [6, -8], [9, -5], [10, 0], [8, 5], [3, 7], [-4, 7],
];
/** v1's far boulder outline (scaled 0.82 behind the head). */
const BOULDER_F: readonly V[] = [
  [-8, 3], [-9, -2], [-6, -7], [-3, -11], [-1, -8], [2, -8], [5, -11], [7, -6], [9, -1], [8, 4], [3, 6], [-4, 6],
];
const FAR_K = 0.82;
/** Where a boulder sits: on its shoulder, plus the follower lag of the frame. */
function boulderAt(g: TitanGeo, side: 'N' | 'F'): V {
  return side === 'N' ? [g.shN[0] + g.fx.bldNx, g.shN[1] + g.fx.bldNy] : [g.shF[0], g.shF[1] + g.fx.bldFy];
}
/**
 * A boulder's planes: the back crag (up / left, the big lit face of P1), the front crag's two faces
 * (into the vent notch and toward the foe), the broad face (front, turned a little up), the underside.
 */
function boulderPlanes(outline: readonly V[]): Facet[] {
  return [
    // the broad face: front, mid in both views
    { pts: outline, n: n3(0.05, 0.05, 1) },
    // the back crag: its up / back face takes the P1 light (the glassy edge runs along it)
    { pts: [[-10, -2], [-8, -7], [-5, -9], [-3, -12], [-1.5, -9], [-3, -5], [-6, -2], [-9.5, 0]], n: n3(-0.6, -0.65, 0.45) },
    // the crag tops: facing up, lit in both views
    { pts: [[-5, -9], [-3, -12], [-1.5, -9], [-3.5, -8]], n: n3(0, -0.95, 0.3) },
    { pts: [[2, -9], [4, -12], [6, -8], [4, -7.5]], n: n3(0.1, -0.95, 0.3) },
    // the front crag's face toward the foe (lit in P2)
    { pts: [[4.5, -8], [6, -8], [9, -5], [10, 0], [7, -1]], n: n3(0.75, -0.35, 0.55) },
    // the underside
    { pts: [[-9, 3], [-4, 2.5], [3, 3], [9, 1.5], [8, 5], [3, 7], [-4, 7]], n: n3(0, 0.85, 0.5) },
  ];
}

// ------------------------------------------------------------------ the head (a rigid plane map)

/**
 * The head, 14×10 on v1's head outline (HEAD_N, cell for cell), facing right. Planes:
 *   a crag faces turned up / back (the P1 light) · t crag tops (up: lit in both views) · r crag faces
 *   turned forward (the P2 light) · s the side of the skull toward the viewer (mid) · w the brow slab's
 *   top · W the brow's tip, jutting forward · f the face, forward (in shadow in P1: the eyes burn out of
 *   the dark) · j the jaw · u its underside · o cuts: the sockets under the brow and the mouth (the
 *   glow fills the eye slits and the jaw seam).
 * Expressions swap the rows from the sockets down (v1 had six head maps): the roar drops the jaw two
 * rows (the only frames where the head outline grows).
 */
const HEAD_TOP: readonly string[] = [
  '.attr.attrr...',
  'aattrrattrrrr.',
  'ssawwwwwwwwww.',
  'sswwwwwwwwwwWW',
];
const HEAD_LOW: Readonly<Record<'calm' | 'snarl' | 'roar', readonly string[]>> = {
  calm: [
    'ssssoooooooooW',
    'ssssooooffooo.',
    'ssssffffffff..',
    'ssssoooooooojj',
    '.sjjjjjjjjjjj.',
    '..uuuuuuuuuu..',
  ],
  snarl: [
    'ssssoooooooooW',
    'ssssooooffooo.',
    'ssssffffffff..',
    'ssssToooooooTj',
    '.sjjoooooooojj',
    '..uuuuuuuuuu..',
  ],
  roar: [
    'ssssoooooooooW',
    'ssssooooffooo.',
    'ssssffffffff..',
    'ssssToooooooTj',
    '.sssoooooooo..',
    '.ssjoooooooj..',
    '..jjjjjjjjj...',
    '..uuuuuuuu....',
  ],
};
const HEAD_KEY: Readonly<Record<string, { n: V3; bias?: number }>> = {
  a: { n: n3(-0.55, -0.75, 0.4) },
  t: { n: n3(0, -0.95, 0.3) },
  r: { n: n3(0.6, -0.6, 0.5) },
  s: { n: n3(-0.15, 0.2, 1) },
  w: { n: n3(0.15, -0.8, 0.6) },
  W: { n: n3(0.75, -0.15, 0.65) },
  f: { n: n3(0.8, 0.1, 0.6) },
  j: { n: n3(0.55, 0.45, 0.7) },
  u: { n: n3(0, 0.95, 0.3) },
  o: { n: n3(0, 0, 1), bias: -2 },
  // a fang (snarl / roar): a lit stone tooth at each corner of the open jaw
  T: { n: n3(-0.4, -0.6, 0.7) },
};
type Expr = 'calm' | 'blaze' | 'snarl' | 'roar' | 'struck' | 'guard';
const EXPRS: readonly Expr[] = ['calm', 'blaze', 'snarl', 'roar', 'struck', 'guard'];
const exprOf = (fx: TitanFx): Expr => EXPRS[clamp(Math.round(fx.expr), 0, EXPRS.length - 1)];
function headRows(e: Expr): readonly string[] {
  return [...HEAD_TOP, ...HEAD_LOW[e === 'snarl' ? 'snarl' : e === 'roar' ? 'roar' : 'calm']];
}
/** Eye slits in head-map coordinates (outer, inner pixel: the inner one burns hotter). */
const HEAD_EYES: readonly (readonly [V, V])[] = [
  [[5, 5], [6, 5]],
  [[10, 5], [11, 5]],
];
/** The jaw seam (calm) / the open mouth (snarl, roar) in head-map coordinates. */
const MOUTH_X: readonly number[] = [4, 5, 6, 7, 8, 9, 10, 11];

// ------------------------------------------------------------------ shading helpers

const ROCK_DOWN: Readonly<Record<number, number>> = {
  [PAL.stone3]: PAL.stone2,
  [PAL.stone2]: PAL.stone1,
  [PAL.stone1]: PAL.stone0,
  [PAL.stone0]: PAL.night0,
  [PAL.night0]: PAL.night0,
};
/** The far side: every rock tone one value down (basalt far bands). */
function farShade(c: PixelCanvas) {
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      const k = c.get(x, y);
      if (k === null) continue;
      const d = ROCK_DOWN[k];
      if (d !== undefined && d !== k) c.set(x, y, d);
    }
}

/** The glassy edge: 1-px stone3 on the light-facing silhouette of a lit plane (IŞ-8). */
function glassEdge(c: PixelCanvas, light: Light) {
  edgePaint(c, light, PAL.stone3, null, { lit: 0.5, only: (k) => k === PAL.stone2 });
}

/** A crease line inside a part: each pixel two steps down from the plane it falls on (IŞ-5). */
const CREASE: Readonly<Record<number, number>> = {
  [PAL.stone3]: PAL.stone1,
  [PAL.stone2]: PAL.stone0,
  [PAL.stone1]: PAL.stone0,
  [PAL.stone0]: PAL.night0,
  [PAL.night0]: PAL.night0,
};
function creaseLine(c: PixelCanvas, pts: readonly V[]) {
  for (let i = 0; i + 1 < pts.length; i++)
    line4(pts[i], pts[i + 1], (x, y) => {
      const k = c.get(x, y);
      if (k === null) return;
      const d = CREASE[k];
      if (d !== undefined) c.set(x, y, d);
    });
}

/** A 4-connected line a → b (every step moves x or y, never both: no diagonal-only pixels). */
export function line4(a: V, b: V, at: (x: number, y: number) => void) {
  let x = Math.floor(a[0]);
  let y = Math.floor(a[1]);
  const x1 = Math.floor(b[0]);
  const y1 = Math.floor(b[1]);
  const dx = Math.abs(x1 - x);
  const dy = Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let err = dx - dy;
  at(x, y);
  while (x !== x1 || y !== y1) {
    const e2 = 2 * err;
    const stepX = e2 > -dy;
    const stepY = e2 < dx;
    // a diagonal Bresenham step becomes two 4-steps (x first): a staircase, never a lone corner
    if (stepX) {
      err -= dy;
      x += sx;
      at(x, y);
    }
    if (stepY) {
      err += dx;
      y += sy;
      at(x, y);
    }
  }
}

// ------------------------------------------------------------------ rock painters

function rock(ctx: Ctx, far: boolean, fill: (r: Raster, m: MatRef, g: TitanGeo) => void, post?: (c: PixelCanvas, g: TitanGeo) => void): PixelCanvas {
  const g = geoOf(ctx.rig, ctx.pose);
  const r = ctx.raster();
  fill(r, ctx.ref('body'), g);
  const c = r.render(ctx.canvas());
  post?.(c, g);
  if (far) farShade(c);
  return c;
}

const armPart = (side: 'N' | 'F'): Part => ({
  layer: side === 'N' ? 'armN' : 'armF',
  seam: 'crease',
  fold: { top: 1, side: 1, bottom: 2 },
  role: 'body',
  paint: (ctx) =>
    rock(
      ctx,
      side === 'F',
      (r, m, g) => {
        const sh = side === 'N' ? g.shN : g.shF;
        const el = side === 'N' ? g.elbN : g.elbF;
        const wr = side === 'N' ? g.wrN : g.wrF;
        const seed = side === 'N' ? 30 : 40;
        chunk(r, m, sh, el, 12, 10, seed, 0, ctx.light);
        chunk(r, m, el, wr, 10, 13, seed + 1, 4, ctx.light);
        knob(r, m, el, 3.4, 6, ctx.light);
        const fs = side === 'N' ? 1 + Math.max(0, g.fx.heat - 0.7) * 0.7 : 1;
        // HA-12: on the release frame the fist is smeared 2 px back along its path (matter: outlined
        // with the body), from where the previous frame left it
        if (side === 'N' && ctx.smearFrom && ctx.smearRig) {
          const prev = geoOf(ctx.smearRig, ctx.smearFrom);
          const mv = unit(sub(wr, prev.wrN));
          for (const k of [2, 1]) fist(r, m, sub(wr, mul(mv, k)), g.dirN, fs, 9 - k * 0.1, ctx.light);
        }
        fist(r, m, wr, side === 'N' ? g.dirN : g.dirF, fs, 10, ctx.light);
      },
      (c, _g) => {
        if (side === 'N') glassEdge(c, ctx.light);
      },
    ),
});

const legPart = (side: 'N' | 'F'): Part => ({
  layer: side === 'N' ? 'legN' : 'legF',
  seam: 'crease',
  fold: { top: 1, side: 1, bottom: 2 },
  role: 'body',
  paint: (ctx) =>
    rock(
      ctx,
      side === 'F',
      (r, m, g) => {
        const hip = side === 'N' ? g.hipN : g.hipF;
        const knee = side === 'N' ? g.kneeN : g.kneeF;
        const an = side === 'N' ? g.ankN : g.ankF;
        const ft = side === 'N' ? g.footN : g.footF;
        const seed = side === 'N' ? 10 : 20;
        chunk(r, m, hip, knee, 13, 11, seed, 0, ctx.light);
        chunk(r, m, knee, an, 11, 10, seed + 1, 3, ctx.light);
        foot(r, m, an[0], ft[1], 6);
        knob(r, m, [knee[0] + 1, knee[1]], 3.6, 8, ctx.light);
      },
      (c) => {
        if (side === 'N') glassEdge(c, ctx.light);
      },
    ),
});

const boulderPart = (side: 'N' | 'F'): Part => ({
  layer: side === 'N' ? 'shoulderN' : 'shoulderF',
  seam: 'crease',
  fold: { top: 1, side: 1, bottom: 2 },
  role: 'body',
  paint: (ctx) =>
    rock(
      ctx,
      side === 'F',
      (r, m, g) => {
        const sh = boulderAt(g, side);
        const k = side === 'N' ? 1 : FAR_K;
        // a rigid block: placed by whole pixels (IŞ-12)
        const at: V = [Math.round(sh[0]), Math.round(sh[1])];
        const off: V = [sh[0] - at[0], sh[1] - at[1]];
        facets(r, m, boulderPlanes(side === 'N' ? BOULDER_N : BOULDER_F), (p) => add(at, add(off, mul(p, k))), 0, 0);
      },
      (c) => glassEdge(c, ctx.light),
    ),
});

const torsoPart: Part = {
  layer: 'torso',
  seam: 'crease',
  fold: { top: 1, side: 1, bottom: 2 },
  role: 'body',
  paint: (ctx) =>
    rock(
      ctx,
      false,
      (r, m, g) => {
        TORSO_PLANES.forEach((f, i) => {
          const ang = g.angleAt(f.pts.reduce((s, p) => s + p[1], 0) / f.pts.length);
          facets(r, m, [f], (p) => g.T(p[0], p[1]), ang, i * 0.01);
        });
      },
      (c, g) => {
        for (const cr of TORSO_CREASES) creaseLine(c, cr.map((p) => g.T(p[0], p[1])));
        // the pecs overhang the belly: their crease is two rows deep (IŞ-5 bottom band)
        for (const cr of TORSO_CREASES.slice(0, 2)) creaseLine(c, cr.map((p) => g.T(p[0], p[1] + 1)));
        // the core socket: a night0 cut ring around the magma (the glow fills the inside)
        const [cx, cy] = g.core;
        for (let y = Math.floor(cy - CORE_R - 1); y <= Math.ceil(cy + CORE_R + 1); y++)
          for (let x = Math.floor(cx - CORE_R - 1); x <= Math.ceil(cx + CORE_R + 1); x++) {
            const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
            if (d <= CORE_R && c.isOpaque(x, y)) c.set(x, y, PAL.night0);
          }
      },
    ),
};

const headPart: Part = {
  layer: 'head',
  seam: 'crease',
  fold: { top: 1, side: 2, bottom: 2 },
  role: 'body',
  paint: (ctx) =>
    rock(
      ctx,
      false,
      (r, m, g) => facetMap(r, m, headRows(exprOf(g.fx)), g.headAt, HEAD_KEY, 20),
      (c) => glassEdge(c, ctx.light),
    ),
};

// ------------------------------------------------------------------ light: the lava (after the outline)

/** Lava tone of a glow level (0…~2.4). */
function lavaTone(gl: number): number | null {
  if (gl < 0.25) return null;
  if (gl < 0.6) return PAL.fire1;
  if (gl < 1.0) return PAL.fire2;
  if (gl < 1.55) return PAL.fire3;
  if (gl < 2.05) return PAL.fire4;
  return PAL.gold4;
}

const PART_INDEX: Readonly<Record<string, number>> = {};

/** The lava of one frame, in part space. */
const glowPart: Part = {
  layer: 'glow',
  seam: 'none',
  paint: (ctx) => {
    const g = geoOf(ctx.rig, ctx.pose);
    const p = ctx.dst;
    const own = (name: string) => PART_INDEX[name];
    const owns = (x: number, y: number, id: number) => ctx.comp.owner(x, y) === id;
    const put = (x: number, y: number, id: number, c: number | null) => {
      if (c !== null && owns(x, y, id)) p.set(x, y, c);
    };
    const fx = g.fx;
    // ---- the core: magma in its socket (v1's nested discs, the hot spot up toward the light);
    //      the heart is fire4 at rest, gold4 when charged, white only at full heat
    const torso = own('torso');
    {
      const [cx, cy] = g.core;
      const k = fx.core;
      const lx = Math.sign(ctx.light.v2[0]);
      const rings: [number, number, number][] = [
        [CORE_R - 0.8, 0, 0.45 + k * 0.3],
        [3.4, 0.3, 0.8 + k * 0.4],
        [2.2, 0.5, 1.2 + k * 0.5],
        [1.2, 0.8, 1.3 + k * 0.6],
      ];
      // the magma churns: the hot heart circles its socket (2 turns per idle loop)
      const ca = TAU * 2 * fx.t;
      for (const [rad, off, gl] of rings) {
        const ox = cx + off * lx + (off > 0.4 ? 0.7 * Math.cos(ca) : 0);
        const oy = cy - off + (off > 0.4 ? 0.7 * Math.sin(ca) : 0);
        for (let y = Math.floor(oy - rad); y <= Math.ceil(oy + rad); y++)
          for (let x = Math.floor(ox - rad); x <= Math.ceil(ox + rad); x++)
            if (Math.hypot(x + 0.5 - ox, y + 0.5 - oy) <= rad) put(x, y, torso, lavaTone(gl));
      }
      if (k >= 2) put(Math.floor(cx - 1), Math.floor(cy - 1), torso, PAL.white);
    }
    // ---- torso seams: the glow runs outward from the core
    const seams: { pts: V[]; heat: number; ph: number }[] = [
      { pts: [[-2, -17], [-7, -19.5], [-12, -21], [-17, -22]], heat: 1.1, ph: 0 },
      { pts: [[5.5, -18.5], [8.5, -23], [12, -27]], heat: 1.0, ph: 0.3 },
      { pts: [[-1, -11.5], [-5, -7.5], [-9, -3.5], [-11, -1]], heat: 1.0, ph: 0.2 },
      { pts: [[2.5, -10.5], [2.5, -5.5], [1.5, -1]], heat: 0.95, ph: 0.55 },
      { pts: [[6.5, -13.5], [12, -15.5], [19, -14.5]], heat: 0.95, ph: 0.75 },
      { pts: [[-10, 2.5], [-3, 2], [5, 3], [12, 2]], heat: 0.7, ph: 0.4 },
    ];
    for (const s of seams) {
      const pts = s.pts.map(([x, y]) => g.T(x, y));
      seam(pts, (d, len) => fx.seam * s.heat * (1.15 - 0.45 * d) * (0.92 + 0.1 * Math.sin((fx.t * 2 + s.ph - fx.wave * d) * TAU)) + bead(fx.t, s.ph, d, len), (x, y, gl, w) => {
        put(x, y, torso, lavaTone(gl));
        if (w > 1) put(x, y + 1, torso, lavaTone(gl - 0.45));
      });
    }
    // ---- eyes and mouth (by expression)
    const head = own('head');
    const e = exprOf(fx);
    const hx = g.headAt[0];
    const hy = g.headAt[1];
    const hot = fx.eye > 1.5 || fx.core > 1.3;
    for (const [outer, inner] of HEAD_EYES) {
      if (e === 'struck') {
        // squeezed shut: one dim pixel
        put(hx + inner[0], hy + inner[1], head, PAL.fire2);
        continue;
      }
      if (e === 'guard') {
        // narrowed: the inner pixel only, watchful
        put(hx + inner[0], hy + inner[1], head, PAL.fire4);
        continue;
      }
      const dim = fx.eye < 0.5;
      put(hx + outer[0], hy + outer[1], head, dim ? PAL.fire1 : hot ? PAL.fire4 : PAL.fire3);
      put(hx + inner[0], hy + inner[1], head, dim ? PAL.fire2 : hot ? PAL.gold4 : PAL.fire4);
      // blazing: the glow spills onto the cheek under the slit
      if ((e === 'blaze' || e === 'snarl' || e === 'roar') && fx.eye > 1.2) put(hx + inner[0], hy + inner[1] + 1, head, PAL.fire2);
    }
    const mouthHot = Math.max(fx.core, fx.seam);
    if (e === 'roar' || e === 'snarl') {
      // the open mouth: a lip of fire2, the throat burning (gold4 at full heat)
      const rows = e === 'roar' ? [7, 8, 9] : [7, 8];
      rows.forEach((j, k) =>
        MOUTH_X.forEach((i) => {
          if (i < 5 || i > 10) return;
          const core = k > 0 && k < rows.length - 1 ? 1 : k === rows.length - 1 && rows.length === 2 ? 0.6 : 0.4;
          put(hx + i, hy + j, head, lavaTone(0.7 + core * mouthHot * 0.75 + bead(fx.t, 0.65, Math.abs(i - 7.5) / 3, 4) * 0.5));
        }),
      );
    } else {
      // the jaw seam: lava like the rest, flowing from the middle out to the corners
      MOUTH_X.forEach((i) => {
        const d = Math.abs(i - 7.5) / 3.5;
        put(hx + i, hy + 7, head, lavaTone((e === 'struck' || e === 'guard' ? 0.75 : 1) * mouthHot * (1.35 - 0.5 * d) + bead(fx.t, 0.65, d, 4)));
      });
    }
    // ---- boulder vents and face splits
    for (const side of ['N', 'F'] as const) {
      const id = own(side === 'N' ? 'shoulderN' : 'shoulderF');
      const sh = boulderAt(g, side);
      const k = side === 'N' ? 1 : FAR_K;
      const at: V = [Math.round(sh[0]), Math.round(sh[1])];
      const off: V = [sh[0] - at[0], sh[1] - at[1]];
      const tf = (q: V): V => add(at, add(off, mul(q, k)));
      const vent = 1.25 + 0.35 * fx.flare;
      seam([tf([-1.5, -8.5]), tf([2.5, -8.5])], (d, len) => vent * fx.seam + bead(fx.t, 0.2, d, len) * 0.6, (x, y, gl) => put(x, y, id, lavaTone(gl)));
      seam([tf([1, -6]), tf([3, -2]), tf([2, 2]), tf([5, 4])], (d, len) => (side === 'N' ? 0.95 : 0.7) * fx.seam * (1.1 - 0.4 * d) + bead(fx.t, side === 'N' ? 0.5 : 0.8, d, len), (x, y, gl) => put(x, y, id, lavaTone(gl)));
    }
    // ---- limb seams along the bones
    const limb = (name: string, a: V, b: V, heat: number, ph: number) => {
      const id = own(name);
      const d = unit(sub(b, a));
      const n: V = [-d[1], d[0]];
      const p0 = add(add(a, mul(d, 3)), mul(n, 1.5));
      const p2 = sub(sub(b, mul(d, 2)), mul(n, 1));
      seam([p0, lerpV(p0, p2, 0.5), p2], (q, len) => heat * fx.seam * (1.05 - 0.35 * q) + bead(fx.t, ph, q, len) * 0.8, (x, y, gl) => put(x, y, id, lavaTone(gl)));
    };
    // the heat of a charge runs down the near arm into the fist
    const armHeat = Math.min(1.2, fx.heat * 0.9);
    limb('armN', g.shN, g.elbN, 0.95 + armHeat, 0.1);
    limb('armN', g.elbN, g.wrN, 0.9 + armHeat, 0.35);
    limb('legN', g.hipN, g.kneeN, 0.8, 0.6);
    limb('legN', g.kneeN, g.ankN, 0.7, 0.85);
    limb('armF', g.shF, g.elbF, 0.6, 0.45);
    limb('armF', g.elbF, g.wrF, 0.55, 0.15);
    limb('legF', g.hipF, g.kneeF, 0.55, 0.2);
    limb('legF', g.kneeF, g.ankF, 0.5, 0.7);
    // the toe joints of both feet (v1's toe cracks): a short flowing seam over the slab
    for (const [name, an, ft, h] of [['legN', g.ankN, g.footN, 0.8], ['legF', g.ankF, g.footF, 0.6]] as const) {
      const fy = Math.round(ft[1]);
      seam([[an[0] + 1, fy - 4.5], [an[0] + 4, fy - 2.5], [an[0] + 7, fy - 2]], (d, len) => h * fx.seam * (1.1 - 0.3 * d) + bead(fx.t, 0.3, d, len) * 0.8, (x, y, gl) => put(x, y, own(name), lavaTone(gl)));
    }
    // ---- the core's light leaking around what covers it (the guard X): the dark creases between the
    //      forearms and the chest glow, the forearms' edges facing it catch a warm rim
    {
      const [cx, cy] = g.core;
      for (const name of ['armN', 'armF']) {
        const id = own(name);
        for (let y = Math.floor(cy - 10); y <= Math.ceil(cy + 10); y++)
          for (let x = Math.floor(cx - 10); x <= Math.ceil(cx + 10); x++) {
            if (!owns(x, y, id)) continue;
            const gl = fx.core * (1.05 - Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.15) / 10);
            if (gl < 0.3) continue;
            const cur = p.get(x, y);
            const gap = cur === PAL.night0 || cur === PAL.stone0;
            const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !owns(x + dx, y + dy, id));
            if (gap) p.set(x, y, gl > 1.0 ? PAL.fire3 : gl > 0.6 ? PAL.fire2 : PAL.fire1);
            else if (edge && gl > 0.55) p.set(x, y, gl > 1.0 ? PAL.fire2 : PAL.fire1);
          }
      }
    }
    // ---- the near fist's heat: the knuckles go molten first and the heat creeps back into the
    //      hand as cracks — the fist keeps its rock form (the back of the hand stays basalt)
    if (fx.heat > 0.15) {
      const id = own('armN');
      const ux = Math.cos(g.dirN);
      const uy = Math.sin(g.dirN);
      const fs = 1 + Math.max(0, fx.heat - 0.7) * 0.7;
      const kx = g.wrN[0] + ux * 7.5 * fs;
      const ky = g.wrN[1] + uy * 7.5 * fs;
      const R = (3.5 + 3 * fx.heat) * fs;
      for (let y = Math.floor(ky - R); y <= Math.ceil(ky + R); y++)
        for (let x = Math.floor(kx - R); x <= Math.ceil(kx + R); x++) {
          if (!owns(x, y, id)) continue;
          const u = ((x + 0.5 - g.wrN[0]) * ux + (y + 0.5 - g.wrN[1]) * uy) / fs;
          if (u < 3) continue;
          const h = fx.heat * (1.25 - (Math.hypot(x + 0.5 - kx, y + 0.5 - ky) / R) * 1.05);
          const c = h > 1.0 ? (fx.heat > 0.95 ? PAL.gold4 : PAL.fire4) : h > 0.72 ? PAL.fire4 : h > 0.5 ? PAL.fire3 : null;
          if (c !== null) p.set(x, y, c);
        }
      // the finger joints: two hot grooves along the fist (v1's finger gaps)
      for (const v of [-2, 2]) {
        const a: V = [g.wrN[0] + (ux * 3.5 - uy * v) * fs, g.wrN[1] + (uy * 3.5 + ux * v) * fs];
        const b: V = [g.wrN[0] + (ux * 8.5 - uy * v) * fs, g.wrN[1] + (uy * 8.5 + ux * v) * fs];
        line4(a, b, (x, y) => put(x, y, id, lavaTone(0.7 + fx.heat * 0.9)));
      }
    }
    return null;
  },
};

/**
 * The lava flowing outward in a seam: brighter / darker bands ~6 px long that travel from the root
 * toward the tip, 6 waves per fx.t unit (the idle's t runs 0 → 1 over the loop: seamless), so a seam
 * is never static and never flickers pixel by pixel (adjacent fire tones only).
 */
function bead(t: number, ph: number, d: number, len: number): number {
  return 0.38 * Math.sin(TAU * ((len * d) / 6 - 6 * t + ph));
}

/**
 * Walk a seam polyline as a 4-connected line; `glow(d, n)` gives the level at the normalised
 * distance d from the root; `at` paints (w = 2 on the first third: the root is two pixels wide).
 */
function seam(pts: readonly V[], glow: (d: number, n: number) => number, at: (x: number, y: number, gl: number, w: number) => void) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1] || 1;
  const seen = new Set<number>();
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const seg = cum[i + 1] - cum[i] || 1;
    line4(a, b, (x, y) => {
      const key = y * 4096 + x;
      if (seen.has(key)) return;
      seen.add(key);
      const t = clamp(((x + 0.5 - a[0]) * (b[0] - a[0]) + (y + 0.5 - a[1]) * (b[1] - a[1])) / (seg * seg), 0, 1);
      const d = (cum[i] + t * seg) / total;
      at(x, y, glow(d, total), d < 0.3 ? 2 : 1);
    });
  }
}

// ------------------------------------------------------------------ light: effects (after the glow)

/** Heat rank of a light tone (a cooler flame never covers a hotter one). */
function rank(c: number | null): number {
  switch (c) {
    case PAL.fire1:
      return 1;
    case PAL.fire2:
      return 2;
    case PAL.fire3:
      return 3;
    case PAL.fire4:
      return 4;
    case PAL.gold4:
      return 5;
    case PAL.white:
      return 6;
    default:
      return 0;
  }
}

/**
 * A flame tongue (light, REHBER §2.3 lava): a curved teardrop, broad root → 1-px tip, three flat
 * nested tones (fire2 rim, fire3 body, fire4 core; gold4 when very hot); no lone pixels. `ph`
 * sways it, so successive frames give different silhouettes. Painted through `put`.
 */
function flame(tmp: PixelCanvas, put: (x: number, y: number, c: number) => void, base: V, dir: number, len: number, wid: number, curl: number, ph: number, heat: number) {
  if (len < 2) return;
  const n = Math.max(4, Math.ceil(len / 1.4));
  const C: V[] = [];
  let a = dir + Math.sin(ph * TAU) * 0.14;
  let [x, y] = base;
  for (let i = 0; i <= n; i++) {
    C.push([x, y]);
    a += curl / n + Math.sin((ph - i / n) * TAU) * 0.06;
    x += (Math.cos(a) * len) / n;
    y += (Math.sin(a) * len) / n;
  }
  const shape = (k: number, wk: number): V[] => {
    const m = Math.max(2, Math.round(n * k));
    const left: V[] = [];
    const right: V[] = [];
    for (let i = 0; i <= m; i++) {
      const f = i / m;
      const p0 = C[Math.max(0, i - 1)];
      const p1 = C[Math.min(m, i + 1)];
      const d = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
      const nx = -(p1[1] - p0[1]) / d;
      const ny = (p1[0] - p0[0]) / d;
      const w = ((wid * wk) / 2) * (f < 0.3 ? 0.85 + f * 0.5 : Math.pow((1 - f) / 0.7, 0.8));
      left.push([C[i][0] + nx * w, C[i][1] + ny * w]);
      right.push([C[i][0] - nx * w, C[i][1] - ny * w]);
    }
    return [...left, ...right.reverse()];
  };
  tmp.clear();
  tmp.poly(shape(1, 1), heat > 0.35 ? PAL.fire2 : PAL.fire1);
  if (len > 3) tmp.poly(shape(0.72, 0.6), heat > 0.35 ? PAL.fire3 : PAL.fire2);
  if (len > 5 && heat > 0.55) tmp.poly(shape(0.42, 0.34), heat > 1.3 ? PAL.gold4 : PAL.fire4);
  for (let j = 0; j < tmp.h; j++)
    for (let i = 0; i < tmp.w; i++) {
      const c = tmp.get(i, j);
      if (c === null) continue;
      if (!tmp.isOpaque(i - 1, j) && !tmp.isOpaque(i + 1, j) && !tmp.isOpaque(i, j - 1) && !tmp.isOpaque(i, j + 1)) continue;
      put(i, j, c);
    }
}

const fxPart: Part = {
  layer: 'fx',
  seam: 'none',
  paint: (ctx) => {
    const g = geoOf(ctx.rig, ctx.pose);
    const p = ctx.dst;
    const fx = g.fx;
    const W = ctx.w;
    const H = ctx.h;
    const inFrame = (x: number, y: number) => x >= 2 && y >= 2 && x < W - 2 && y < H - 2;
    /** light in the air (or over the outline): never over matter */
    const air = (x: number, y: number, c: number) => {
      if (!inFrame(x, y)) return;
      const cur = p.get(x, y);
      if (cur === null || cur === PAL.ink || (rank(cur) > 0 && rank(cur) < rank(c))) p.set(x, y, c);
    };
    const tmp = ctx.canvas();
    // ---- vent flames: the boulders erupt (roar, the charge); light over the air and the own boulder
    if (fx.flare > 0.05)
      for (const side of ['F', 'N'] as const) {
        const id = PART_INDEX[side === 'N' ? 'shoulderN' : 'shoulderF'];
        const sh = boulderAt(g, side);
        const k = side === 'N' ? 1 : FAR_K;
        const vx = Math.round(sh[0]) + 0.5 * k;
        const vy = Math.round(sh[1]) - 9 * k;
        const put = (x: number, y: number, c: number) => {
          if (!inFrame(x, y)) return;
          const cur = p.get(x, y);
          if (cur === null || cur === PAL.ink || ctx.comp.owner(x, y) === id || (rank(cur) > 0 && rank(cur) < rank(c))) p.set(x, y, c);
        };
        for (let i = 0; i < 3; i++) {
          const L = Math.min(vy - 3, fx.flare * (5.5 + 3 * hash(i, Math.floor(fx.t * 10), side === 'N' ? 1 : 0)) * (i === 1 ? 1.35 : 0.85) * k);
          const lean = (i - 1) * 0.38;
          flame(tmp, put, [vx + (i - 1) * 2.4 * k, vy + (i === 1 ? 0 : 1)], -Math.PI / 2 + lean, L, (i === 1 ? 4.2 : 3.2) * k, -lean * 0.6 + Math.sin((fx.t * 3 + i * 0.3) * TAU) * 0.35, fx.t * 3 + i * 0.33, fx.flare + 0.3);
        }
      }
    // ---- vent embers: one rising from each vent, cooling fire4 → fire3 → fire2
    if (fx.ember >= 0)
      for (const [side, ph0] of [['N', 0], ['F', 0.5], ['N', 0.62], ['F', 0.12]] as const) {
        const sh = boulderAt(g, side);
        const k = side === 'N' ? 1 : FAR_K;
        const ph = (fx.ember + ph0) % 1;
        const x = Math.round(sh[0] + 0.5 * k + Math.sin(ph * TAU) * 1.2 + (ph0 > 0.55 || ph0 === 0.12 ? -2 : 1));
        const y = Math.round(sh[1] - 10 * k - 2 - ph * 9);
        air(x, y, ph < 0.4 ? PAL.fire4 : ph < 0.75 ? PAL.fire3 : PAL.fire2);
      }
    // ---- lava drips from the hanging fists: form, stretch, fall
    const drip = (wr: V, dir: number, ph: number, inset = 0) => {
      if (dir < 0.8 || dir > 2.4) return;
      const sx = Math.round(wr[0] + Math.cos(dir) * 8.5 - inset);
      const sy = Math.round(wr[1] + Math.sin(dir) * 8.5 + 1);
      const t = ((ph % 1) + 1) % 1;
      if (t < 0.55) {
        const L = Math.floor(t * 5);
        for (let i = 0; i <= L; i++) air(sx, sy + i, i === L ? PAL.fire4 : PAL.fire3);
      } else {
        const fy = sy + 3 + Math.floor((t - 0.55) * 26);
        if (fy < ctx.rig.ground - 1) {
          air(sx, fy, PAL.fire3);
          air(sx, fy + 1, PAL.fire4);
        } else {
          // landed: a 2-px splash on the floor line that cools (fire3 → fire2 → fire1)
          const age = fy - (ctx.rig.ground - 1);
          const c = age < 3 ? PAL.fire3 : age < 7 ? PAL.fire2 : PAL.fire1;
          air(sx, ctx.rig.ground - 1, c);
          air(sx + 1, ctx.rig.ground - 1, c);
        }
      }
    };
    if (fx.drip >= 0) {
      if (fx.aimNw < 0.5 && fx.heat < 0.2) drip(g.wrN, g.dirN, fx.drip);
      // the far fist drips from its inner knuckle: the drop lands on the far foot's slab (behind
      // it, hidden), never on the floor beside the foot (HA-9 reads the floor band as the feet)
      if (fx.aimFw < 0.5 && !ctx.pose.slots.armF) drip(g.wrF, g.dirF, fx.drip + 0.45, 3);
    }
    // ---- the knuckle burst: magma tongues fanning off the fist (contact)
    if (fx.burst > 0) {
      const ux = Math.cos(g.dirN);
      const uy = Math.sin(g.dirN);
      const fs = 1 + Math.max(0, fx.heat - 0.7) * 0.7;
      const kx = g.wrN[0] + ux * 9.5 * fs;
      const ky = g.wrN[1] + uy * 9.5 * fs;
      for (let i = 0; i < 5; i++) {
        const a = g.dirN + (i - 2) * 0.6;
        const bx = kx - ux * 2;
        const by = ky - uy * 2;
        const room = Math.cos(a) > 0.1 ? (W - 4 - bx) / Math.cos(a) : 99;
        flame(tmp, air, [bx, by], a, Math.min(room, fx.burst * (5 + 3 * hash(i, 5)) * (i === 2 ? 1.25 : 1)), 3.8, (i - 2) * 0.3, i * 0.17 + fx.t, 1.5);
      }
      if (fx.burst > 0.8) air(Math.floor(kx), Math.floor(ky), PAL.white);
    }
    // ---- the stomp: the planted front foot spits lava and grit sideways along the ground
    if (fx.stomp > 0) {
      const [fxp, fyp] = g.footF;
      const fy = Math.round(fyp) - 1;
      const k = fx.stomp;
      for (let i = 0; i < 6; i++) {
        const sgn = i % 2 ? 1 : -1;
        const d = 7 + (i >> 1) * 3 * k;
        const x = Math.round(fxp + 1 + sgn * d);
        const y = Math.round(fy - (i >> 1) * 1.5 * k - (k > 0.8 ? 1 : 0));
        air(x, y, i < 2 ? PAL.fire4 : i < 4 ? PAL.fire3 : PAL.stone2);
      }
      for (let x = -8; x <= 10; x++) if (k > 0.5) air(Math.round(fxp) + x, fy + 1, Math.abs(x - 1) < 5 ? PAL.fire3 : PAL.fire2);
    }
    // ---- hot embers knocked off by a blow (the chips are matter: chipsPart)
    if (fx.chips > 0 && fx.chips < 1) {
      for (const [i, ox, oy] of [[0, 4, -6], [1, 7, 2]] as const) {
        const t = fx.chips;
        const o = g.T(17, -18);
        const x = Math.round(o[0] + ox * t * 2.2 + 2);
        const y = Math.round(o[1] + oy * t * 1.5 - 4 * t + 8 * t * t);
        air(x, y, PAL.fire4);
        air(x - 1, y + 1, PAL.fire3);
        if (i === 0) air(x - 2, y + 2, PAL.fire2);
      }
    }
    return null;
  },
};

/** Rock chips knocked off the chest by a blow: MATTER (outlined with the body), each a lit facet over a mid one. */
const chipsPart: Part = {
  layer: 'front',
  seam: 'none',
  role: 'body',
  paint: (ctx) => {
    const g = geoOf(ctx.rig, ctx.pose);
    const t = g.fx.chips;
    if (t <= 0 || t >= 1) return null;
    const c = ctx.canvas();
    const o = g.T(17, -18);
    const chips: [number, number, number][] = [
      [6, -7, 3],
      [10, -2, 2],
      [3, -11, 2],
    ];
    for (const [vx, vy, sz] of chips) {
      const x = Math.round(o[0] + vx * t * 1.6 + 1);
      const y = Math.round(o[1] + vy * t * 1.4 + 10 * t * t);
      for (let j = 0; j < sz; j++)
        for (let i = 0; i < sz + 1 - j; i++) {
          const lit = i + j < sz - 1 ? (ctx.light.from === 'left' ? i <= j : i >= j) : false;
          c.set(x + i, y + j, lit || j === 0 ? PAL.stone2 : PAL.stone1);
        }
    }
    return c;
  },
};

// ------------------------------------------------------------------ the parts table

/** Part painters in draw order within a slot (the 'parts' order is the part-id order of PartComp). */
export const TITAN_PARTS: Readonly<Record<string, Part>> = {
  armF: armPart('F'),
  shoulderF: boulderPart('F'),
  legF: legPart('F'),
  legN: legPart('N'),
  torso: torsoPart,
  head: headPart,
  armN: armPart('N'),
  shoulderN: boulderPart('N'),
  chips: chipsPart,
  glow: glowPart,
  fx: fxPart,
};
Object.keys(TITAN_PARTS).forEach((k, i) => ((PART_INDEX as Record<string, number>)[k] = i + 1));
