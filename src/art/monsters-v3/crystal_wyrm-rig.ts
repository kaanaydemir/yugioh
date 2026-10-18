// Kristal Ejder v3 — the restyled rig. Same skeleton, proportions and silhouette as the v1 rig
// (src/art/monsters/crystal_wyrm.ts, copied and kept numerically identical where it defines the
// shape), redrawn with the craft of the approved still (src/still/wyrm-map.ts):
//   head   — white top plane, mist side plane, steel cheek wedge, ONE night3 brow ridge ending in
//            front of the eye, a night2 eye socket with a cyan3 iris and one white glint, a night1
//            mouth line with an up-turned corner, a steel lower jaw with a night3 underside and a lit
//            chin, gold horns in four bands (gold4 top edge … gold1 root);
//   neck   — white lit plane | mist | steel shadow plane | cyan2 bounce rim, one steel throat seam;
//   body   — a big calm white lit plane, the cyan2 keel on the lit/mid break, mist mid plane, steel;
//   legs   — night3 creases where the thigh lies on the belly (1 px over, 2 behind, 3 under);
//   wings  — flat glass cells, ONE fold line, white / cyan4 trailing rims by facing, two-tone bones;
//   crest  — two-value shards in a dark cyan0 channel.
// Every frame is a Pose (numbers) rendered through this rig, so the craft holds in every frame.
// The key light is flipped for the P2 relight sheet (crystal_wyrm-gbuf.ts setLight).

import { PixelCanvas, bezier } from '../pixel';
import { PAL } from '../palette';
import {
  DEG,
  clamp,
  FLAT_N,
  H,
  LIGHT,
  M,
  OX,
  OY,
  W,
  add,
  composite,
  crease,
  fillPoly,
  distPoly,
  distSeg,
  dorsal,
  dot,
  edgeNormal,
  edgePaint,
  flo,
  gEll,
  gFacet,
  gShard,
  gTube,
  ik,
  len,
  lerp,
  lerpV,
  lineOn,
  maskOf,
  mul,
  newCanvas,
  newG,
  norm,
  pathU,
  polar,
  resetPools,
  rimLight,
  rnd,
  rotV,
  samplePath,
  selout,
  sub,
  twinkle,
  type Fold,
  type SeamFn,
  type V,
} from './crystal_wyrm-gbuf';

// ------------------------------------------------------------------ pose

export interface Wing {
  /** humerus angle (deg, screen space) */
  a1: number;
  /** forearm angle */
  a2: number;
  /** first (outer) finger angle */
  a3: number;
  /** finger fan step (deg); sign picks the fan direction */
  fan: number;
  /** bone length multiplier (a spread far wing turns toward the viewer and reads bigger) */
  span: number;
  /** where the inner membrane meets the body, in torso space (undefined = default) */
  at?: V;
  /** depth of the trailing-edge scallops (1 = rest; >1 billows, <1 pulls taut) */
  scal?: number;
  /** vertical lag (px) of the hand of the wing (wrist and finger tips): they follow a body step a
   *  frame late (overlap), the shoulder and elbow move with the body */
  lag?: number;
}

export interface Pose {
  hx: number;
  hy: number;
  /** torso rotation around the hip (rad, negative = rear up) */
  lean: number;
  /** head pivot offset from its neutral spot (relative to the chest) */
  headX: number;
  headY: number;
  /** head angle (rad, + = nose down) */
  ha: number;
  /** 0..1 */
  jaw: number;
  /** neck control points: extra offset of the base-side and head-side handles (S-curve) */
  nk1: V;
  nk2: V;
  nw: Wing;
  fw: Wing;
  /** tail sway phase (0..1) and amplitude (deg) */
  tail: number;
  tailAmp: number;
  /** extra tail curl (deg, + lifts the tip) */
  tailLift: number;
  /** arm raise (deg); the far arm follows with `armF` extra */
  arm: number;
  armF: number;
  /** 0..1 energy in veins / spikes */
  glow: number;
  /** 0..1 light gathered in the mouth */
  mouth: number;
  /** chest pulse 0..1 (light swelling behind the keel during the breath) */
  pulse: number;
  /** 1 open, 0 squeezed shut (hit), 0.5 half-lid (blink) */
  eye: number;
  /** guard: wings wrapped forward (selects the shield wing layout) */
  guard: boolean;
  /** glint sweep position across the wing glass (0..1, <0 = none) */
  glint: number;
  /** crystal twinkles: [anchor index, size 1|2] (anchors: 0/1/3 near-wing glass, 2 far wing, 4 tail) */
  sparkles: [number, number][];
  /** motion smear: the head's path from this pose to the current one is drawn as a light trail */
  smearFrom?: PoseDelta;

  // ---- part 2 (extra anims); the defaults draw exactly the base frames
  /** whole-body lift (px, negative = up): the summon drop; the feet leave the ground with it */
  lift: number;
  /** 0..1 the legs drawn up under the belly (airborne) */
  tuck: number;
  /** near / far foot displacement from its planted spot (a step; y < 0 = that foot is lifted) */
  stepN: V;
  stepF: V;
  /** 0..1 the membrane roots slide toward the guard wrap (in-betweens to / from guard) */
  wrap: number;
  /** 0..1 the wing glass flares one tone brighter (hitMagic) */
  flare: number;
  /** 0..1 crack lines spread from the chest over the body (death; revive closes them) */
  cracks: number;
  /** 0..1 the inner light drains from the extremities into the core and out (revive: refills) */
  drain: number;
  /** 0..1 the cold crystal body splits along the main crack (death's last frames) */
  split: number;
  /** <1: revive — the body is crystal fragments flying in and locking into place (1 = whole) */
  gather: number;
  /** vertical lag (px) of the tail's middle and tip: they follow a body step one and two frames late */
  tailLag: V;
}

export const NEUTRAL: Pose = {
  hx: 0,
  hy: 0,
  lean: 0,
  headX: 0,
  headY: 0,
  ha: 0.1,
  jaw: 0,
  nk1: [0, 0],
  nk2: [0, 0],
  nw: { a1: -108, a2: -138, a3: -118, fan: -40, span: 1 },
  fw: { a1: -84, a2: -110, a3: -92, fan: -28, span: 1 },
  tail: 0,
  tailAmp: 4,
  tailLift: 0,
  arm: 0,
  armF: 0,
  glow: 0.3,
  mouth: 0,
  pulse: 0,
  eye: 1,
  guard: false,
  glint: -1,
  sparkles: [],
  lift: 0,
  tuck: 0,
  stepN: [0, 0],
  stepF: [0, 0],
  wrap: 0,
  flare: 0,
  cracks: 0,
  drain: 0,
  split: 0,
  gather: 1,
  tailLag: [0, 0],
};

export type PoseDelta = Partial<Omit<Pose, 'nw' | 'fw'>> & { nw?: Partial<Wing>; fw?: Partial<Wing> };

export function pose(d: PoseDelta): Pose {
  return { ...NEUTRAL, ...d, nw: { ...NEUTRAL.nw, ...(d.nw ?? {}) }, fw: { ...NEUTRAL.fw, ...(d.fw ?? {}) } };
}

/** Numeric in-between of two poses (smears, generated in-betweens). Discrete fields come from b. */
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const w = (x: Wing, y: Wing): Wing => ({
    a1: lerp(x.a1, y.a1, t),
    a2: lerp(x.a2, y.a2, t),
    a3: lerp(x.a3, y.a3, t),
    fan: lerp(x.fan, y.fan, t),
    span: lerp(x.span, y.span, t),
    at: x.at && y.at ? lerpV(x.at, y.at, t) : y.at ?? x.at,
    scal: lerp(x.scal ?? 1, y.scal ?? 1, t),
    lag: lerp(x.lag ?? 0, y.lag ?? 0, t),
  });
  return {
    ...b,
    hx: lerp(a.hx, b.hx, t),
    hy: lerp(a.hy, b.hy, t),
    lean: lerp(a.lean, b.lean, t),
    headX: lerp(a.headX, b.headX, t),
    headY: lerp(a.headY, b.headY, t),
    ha: lerp(a.ha, b.ha, t),
    jaw: lerp(a.jaw, b.jaw, t),
    nk1: lerpV(a.nk1, b.nk1, t),
    nk2: lerpV(a.nk2, b.nk2, t),
    nw: w(a.nw, b.nw),
    fw: w(a.fw, b.fw),
    tail: lerp(a.tail, b.tail, t),
    tailAmp: lerp(a.tailAmp, b.tailAmp, t),
    tailLift: lerp(a.tailLift, b.tailLift, t),
    arm: lerp(a.arm, b.arm, t),
    armF: lerp(a.armF, b.armF, t),
    glow: lerp(a.glow, b.glow, t),
    mouth: lerp(a.mouth, b.mouth, t),
    pulse: lerp(a.pulse, b.pulse, t),
    eye: lerp(a.eye, b.eye, t),
    lift: lerp(a.lift, b.lift, t),
    tuck: lerp(a.tuck, b.tuck, t),
    stepN: lerpV(a.stepN, b.stepN, t),
    stepF: lerpV(a.stepF, b.stepF, t),
    wrap: lerp(a.wrap, b.wrap, t),
    flare: lerp(a.flare, b.flare, t),
    cracks: lerp(a.cracks, b.cracks, t),
    drain: lerp(a.drain, b.drain, t),
    split: lerp(a.split, b.split, t),
    gather: lerp(a.gather, b.gather, t),
    tailLag: lerpV(a.tailLag, b.tailLag, t),
  };
}

// ------------------------------------------------------------------ skeleton

const NEAR_FINGERS = [19.5, 22.5, 19];
const FAR_FINGERS = [17.5, 16, 12.5];

interface WingRig {
  S: V;
  E: V;
  Wr: V;
  tips: V[];
  attach: V;
}

function wingRig(S: V, w: Wing, fingers: number[], l1: number, l2: number, attach: V): WingRig {
  const E = add(S, polar(w.a1, l1 * w.span));
  const lag: V = [0, w.lag ?? 0];
  const Wr = add(add(E, polar(w.a2, l2 * w.span)), mul(lag, 0.5));
  const tips = fingers.map((fl, i) => add(add(Wr, polar(w.a3 + w.fan * i, fl * w.span)), mul(lag, 0.5)));
  return { S, E, Wr, tips, attach };
}

// feet are planted: they never move (no foot sliding); the legs reach them by IK
const FOOT_NEAR: V = [52 + OX, 88 + OY];
const ANKLE_NEAR: V = [44.5 + OX, 83 + OY];
const FOOT_FAR: V = [62 + OX, 85 + OY];
const ANKLE_FAR: V = [55 + OX, 80 + OY];

export interface Legs {
  footN: V;
  ankleN: V;
  footF: V;
  ankleF: V;
}

/**
 * Where the feet are: planted (the default: exactly the constants above), displaced by a step
 * (`stepN` / `stepF`), carried up with the body (`lift`), or drawn up under the belly (`tuck`).
 */
export function legs(P: Pose): Legs {
  const lift: V = [0, P.lift];
  const hip = rig(P).hip;
  const t = P.tuck;
  const at = (planted: V, step: V, tucked: V): V => {
    const pl = add(add(planted, lift), step);
    return t > 0 ? lerpV(pl, add(hip, tucked), t) : pl;
  };
  return {
    footN: at(FOOT_NEAR, P.stepN, [7, 16]),
    ankleN: at(ANKLE_NEAR, P.stepN, [0.5, 12]),
    footF: at(FOOT_FAR, P.stepF, [16, 13]),
    ankleF: at(ANKLE_FAR, P.stepF, [10, 9.5]),
  };
}

export interface Rig {
  hip: V;
  chest: V;
  tAng: number;
  neck0: V;
  head: V;
  att: (o: V) => V;
}

export function rig(P: Pose): Rig {
  const hip: V = [42 + OX + P.hx, 66 + OY + P.hy + P.lift];
  const tAng = -0.95 + P.lean;
  const chest = add(hip, [Math.cos(tAng) * 18, Math.sin(tAng) * 18]);
  const att = (o: V): V => add(chest, rotV(o, P.lean));
  return { hip, chest, tAng, att, neck0: att([3, -5]), head: rnd(add(chest, [14 + P.headX, -28 + P.headY])) };
}

function wings(P: Pose) {
  const { hip, chest, att } = rig(P);
  const backAttach = add(lerpV(hip, chest, 0.3), rotV([-8, -5], P.lean));
  const farWing = wingRig(att([1, -8]), P.fw, FAR_FINGERS, 11, 13, att(P.fw.at ?? [-6, -4]));
  const nearWing = wingRig(att([-6, -6]), P.nw, NEAR_FINGERS, 13, 16, P.nw.at ? att(P.nw.at) : backAttach);
  if (P.guard) {
    nearWing.attach = add(hip, [0, 8]);
    farWing.attach = att([12, 10]);
  } else if (P.wrap > 0) {
    nearWing.attach = lerpV(nearWing.attach, add(hip, [0, 8]), P.wrap);
    farWing.attach = lerpV(farWing.attach, att([12, 10]), P.wrap);
  }
  return { farWing, nearWing };
}

export function neckPath(P: Pose): V[] {
  const { neck0, head } = rig(P);
  return bezier(neck0, add(add(neck0, rotV([-3, -12], P.lean * 0.6)), P.nk1), add(add(head, polar(P.ha / DEG + 128, 9)), P.nk2), head, 18);
}

// ------------------------------------------------------------------ neck value planes
//
// The neck's planes are explicit bands across the tube (measured on the approved still), not a
// lighting result: a white lit plane along the contour that faces the key light (square-ended, it
// fades out at the base where the neck runs behind the chest), mist, a steel shadow plane that
// widens toward the base and runs into a night3 / night2 throat wedge, a cyan2 rim on the upper
// neck. The relit (P2) sheet mirrors the same breaks across the neck (the lit band on the other
// contour), so P2 shows exactly P1's planes, never a centred highlight.

const NECK_W0 = 10.5;
const NECK_W1 = 7;
/** the rim starts above this point of the neck (below it the throat wedge meets the outline) */
const NECK_RIM_U = 0.17;
type Tab = readonly (readonly [number, number])[];
/** band widths (px from a contour, across the neck) along the neck (u: 0 base … 1 head); measured on
 *  the still: the lit plane fades out at the base, the shadow plane widens downward into the wedge */
const NECK_LIT: Tab = [[0.04, 0], [0.08, 1], [0.12, 2], [0.15, 3], [0.35, 3], [0.45, 3.5], [0.6, 4], [1, 4]];
const NECK_SHADE: Tab = [[0, 9], [0.05, 8], [0.08, 7], [0.12, 6], [0.15, 6], [0.19, 5], [0.3, 5], [0.4, 2.8], [0.6, 2.5], [1, 2.5]];
const NECK_N3: Tab = [[0, 6], [0.01, 5], [0.05, 4], [0.08, 3], [0.12, 1], [0.14, 0]];
const NECK_N2: Tab = [[0, 3], [0.01, 2], [0.05, 1], [0.07, 0]];
function tab(t: Tab, u: number): number {
  if (u <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (u <= t[i][0]) return lerp(t[i - 1][1], t[i][1], (u - t[i - 1][0]) / (t[i][0] - t[i - 1][0]));
  return t[t.length - 1][1];
}

/** Tone index (HIDE_D: 0 night2 … 4 white) of a neck pixel at (u along, v across: -1 left … 1 right). */
function neckTone(u: number, v: number): number {
  const r = lerp(NECK_W0, NECK_W1, u) / 2;
  const toward = LIGHT.side < 0 ? -v : v;
  const dl = (1 - toward) * r;
  const ds = (1 + toward) * r;
  if (ds < tab(NECK_N2, u)) return 0;
  if (ds < tab(NECK_N3, u)) return 1;
  if (dl < tab(NECK_LIT, u)) return 4;
  if (ds < tab(NECK_SHADE, u)) return 2;
  return 3;
}

const NECK_SEAM_U = 0.37;
/** One steel throat-plate seam across the lit plane (a short square dash from the lit contour). */
function neckSeam(c: PixelCanvas, path: V[]) {
  const s = samplePath(path, NECK_SEAM_U);
  const r = lerp(NECK_W0, NECK_W1, NECK_SEAM_U) / 2;
  const toLit: V = mul([-s.tan[1], s.tan[0]], LIGHT.side < 0 ? -1 : 1);
  lineOn(c, add(s.p, mul(toLit, r + 1)), add(s.p, mul(toLit, r - tab(NECK_LIT, NECK_SEAM_U) + 1.2)), PAL.steel, (cur) => cur === PAL.white);
}

const HIDE_COLS = [PAL.white, PAL.mist, PAL.steel] as const;
const onHide = (cur: number) => (HIDE_COLS as readonly number[]).includes(cur);
const FOLD_LEG: Fold = { top: 1, side: 2, bottom: 3 };
const THIGH_TURN = 0.6;
const TAIL_UNDER = 0.4;
const FAR_LEG_BIAS = -0.15;
const FOLD_NECK: Fold = { top: 1, side: 1, bottom: 2 };

// ------------------------------------------------------------------ the dragon

export function drawDragon(p: PixelCanvas, P: Pose) {
  resetPools();
  KEEP.fill(0);
  const R = rig(P);
  const { hip, chest, tAng, att, head } = R;
  const { farWing, nearWing } = wings(P);
  CORE.v = coreOf(R);

  composite(p, drawWing(farWing, true, P));

  // ---------------- far leg / far arm (one value darker; a night1 line where they meet the body)
  const L = legs(P);
  {
    const g = newG();
    const j = add(hip, [8, 0]);
    const knee = ik(j, L.ankleF, 10.5, 9.5, -1);
    // the far leg sits in the body's shadow: a value lower than its own lighting (night3 / steel)
    gTube(g, [j, knee], 10, 6.5, M.HIDE_FAR, { z: 0, bias: FAR_LEG_BIAS });
    gTube(g, [knee, L.ankleF], 6, 4.2, M.HIDE_FAR, { z: 1, bias: FAR_LEG_BIAS });
    gTube(g, [L.ankleF, add(L.footF, [-1, 0])], 4.2, 3.8, M.HIDE_FAR, { z: 2 });
    gEll(g, L.footF, 3.4, 2, 0, M.HIDE_FAR, { z: 2 });
    const c = g.render();
    // a lit top edge on the foot, a dark sole
    footEdges(c, L.footF, true);
    claws(c, L.footF, true);
    maskOf(c, FAR_MASK);
    composite(p, c);
  }
  {
    const g = newG();
    const s = att([7, 1]);
    const a = P.arm + P.armF;
    const el = add(s, polar(72 - a, 7));
    const wr = add(el, polar(-35 - a * 1.4, 8));
    gTube(g, [s, el, wr], 4.8, 3.4, M.HIDE_FAR);
    gEll(g, add(wr, polar(-35 - a * 1.4, 1)), 2.2, 1.7, (-35 - a * 1.4) * DEG, M.HIDE_FAR, { z: 2 });
    const c = g.render();
    hand(c, wr, -35 - a * 1.4, true);
    composite(p, c);
  }

  // ---------------- tail (+ ridge crystals and the crystal blade)
  {
    const base = [142, 138, 143, 153, 166, 180, 196, 216, 238, 256];
    const pts: V[] = [add(hip, rotV([-7, 3], P.lean * 0.4))];
    for (let i = 0; i < base.length; i++) {
      const k = i / (base.length - 1);
      const a = base[i] - P.tailLift * k * k + Math.sin((P.tail - i * 0.07) * Math.PI * 2) * P.tailAmp * (0.3 + k);
      pts.push(add(pts[i], polar(a, 3.45)));
    }
    // overlap: the middle of the tail follows a body step a frame late, the tip two frames late
    for (let i = 1; i < pts.length; i++) {
      const k = i / (pts.length - 1);
      const dy = k < 0.3 ? 0 : k < 0.65 ? P.tailLag[0] * ((k - 0.3) / 0.35) : lerp(P.tailLag[0], P.tailLag[1], (k - 0.65) / 0.35);
      if (dy) pts[i] = add(pts[i], [0, dy]);
    }
    const gs = newG();
    for (let i = 1; i < pts.length - 2; i += 2) {
      const t = norm(sub(pts[i + 1], pts[i]));
      const dn = dorsal(t);
      const k = i / pts.length;
      const r = lerp(10, 2.6, k) / 2;
      const b = add(pts[i], mul(dn, r));
      gShard(gs, b, add(dn, mul(t, 0.6)), lerp(6, 4, k), lerp(2, 1.4, k), M.CRYS, 0, P.glow);
    }
    composite(p, gs.render(0, false));
    const g = newG();
    // the underside turns under into a steel band (light from above in both sheets)
    gTube(g, pts, 10, 2.6, M.HIDE, { flat: 1.15, biasAt: (_u, _v, _ox, oy) => (oy > 0 ? -TAIL_UNDER * oy : 0) });
    const tip = pts[pts.length - 1];
    const tdir = norm(sub(tip, pts[pts.length - 3]));
    gShard(g, sub(tip, mul(tdir, 1)), tdir, 8, 2.8, M.CRYS, 6, P.glow);
    const c = g.render();
    rimLight(c, p);
    composite(p, c);
  }

  // ---------------- back crystals + torso
  {
    const gs = newG();
    const axis = norm(sub(chest, hip));
    const dn = dorsal(axis);
    const spikes: [number, number, number][] = [
      [1.05, 8, 7],
      [0.74, 9.5, 8.5],
      [0.42, 10, 7],
      [0.1, 9.5, 5],
    ];
    for (const [t, off, l] of spikes) {
      const b = add(lerpV(hip, chest, t), mul(dn, off - 1));
      gShard(gs, b, add(dn, mul(axis, -0.6)), l, l * 0.36, M.CRYS, 0, P.glow);
    }
    composite(p, gs.render(0, false));
  }
  {
    const g = newG();
    // the tube wins wherever it covers: the lit / mid break runs straight along the torso (a plane
    // break, not rings); the two ellipsoids only round off the silhouette
    gEll(g, hip, 11, 9.5, tAng * 0.3, M.HIDE, { flat: 1.45 });
    gEll(g, chest, 8.5, 10, tAng, M.HIDE, { flat: 1.45 });
    gTube(g, [hip, chest, att([3, -5])], 17, 13, M.HIDE, { flat: 1.45, z: 6 });
    const c = g.render();
    keel(c, R, P);
    if (P.cracks > 0) cracksOn(c, P, torsoCracks(R), false);
    rimLight(c, p);
    composite(p, c);
  }

  // ---------------- near hind leg: shin + foot, then the thigh over them (a night3 crease behind
  // the knee) and over the belly (night3 crease 1 px over, 2 behind, 3 under; ONE night1 line
  // against the far leg)
  {
    const j = add(hip, [3, 3]);
    const knee = ik(j, L.ankleN, 11, 9.5, -1);
    const gl = newG();
    gTube(gl, [knee, L.ankleN], 6.5, 4.6, M.HIDE, { z: 1, flat: 1.1 });
    gTube(gl, [L.ankleN, add(L.footN, [-1, 0])], 4.6, 4, M.HIDE, { z: 2 });
    gEll(gl, L.footN, 3.8, 2.2, 0, M.HIDE, { z: 2 });
    const cl = gl.render();
    footEdges(cl, L.footN, false);
    claws(cl, L.footN, false);
    const g = newG();
    // the thigh: the side turned away from the key light (its back) drops into a steel shadow plane
    // (the tube's own lighting would centre the highlight: the light falls almost along the thigh)
    gTube(g, [j, knee], 13, 7.5, M.HIDE, { z: 2, flat: 1.25, biasAt: (_u, _v, ox) => Math.min(0, THIGH_TURN * ox * LIGHT.side) });
    const c = g.render();
    composite(cl, c, crease, { top: 0, side: 1, bottom: 2 });
    if (P.cracks > 0) cracksOn(cl, P, [{ from: 0.3, pts: zig(lerpV(j, knee, 0.05), lerpV(j, knee, 0.85), 3, 1.6) }], false);
    rimLight(cl, p);
    // against the far leg: ONE night1 line, then the far leg's own junction shadow (one value down)
    maskOf(cl, LEG_MASK);
    const on = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && LEG_MASK[y * W + x] === 1;
    composite(p, cl, (x, y, b) => (FAR_MASK[y * W + x] && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) ? PAL.night1 : crease(x, y, b)), FOLD_LEG);
  }

  // ---------------- neck (+ crystal crest in its dark channel)
  const nPath = neckPath(P);
  {
    const gs = newG();
    for (const t of [0.3, 0.45, 0.6, 0.74, 0.87]) {
      const s = samplePath(nPath, t);
      const dn = dorsal(s.tan);
      const r = lerp(10, 7, t) / 2;
      const b = add(s.p, mul(dn, r - 0.5));
      gShard(gs, b, add(dn, mul(s.tan, -0.55)), lerp(8, 5, t), lerp(2.4, 1.7, t), M.CRYS, 0, P.glow);
    }
    const cs = gs.render(0, false);
    // the crest sits in a dark cyan0 channel: the glass behind it folds two values down
    composite(p, cs, (x, y, b) => (b === PAL.cyan1 || b === PAL.cyan2 ? PAL.cyan0 : crease(x, y, b)), { top: 2, side: 2, bottom: 2 });
    const g = newG();
    gTube(g, nPath, NECK_W0, NECK_W1, M.HIDE_D, { biasAt: neckTone });
    const c = g.render();
    neckSeam(c, nPath);
    if (P.cracks > 0) {
      const at = (t: number, k: number) => {
        const sp = samplePath(nPath, t);
        return add(sp.p, mul([-sp.tan[1], sp.tan[0]], k));
      };
      cracksOn(c, P, [{ from: 0.22, pts: [at(0.06, -1), at(0.22, 2), at(0.36, -1.5), at(0.5, 1.5), at(0.62, -0.5)] }], false);
    }
    // the cool rim only along the upper neck (the base runs into the dark throat wedge, unrimmed)
    rimLight(c, p, [PAL.steel], PAL.cyan2, (x, y) => pathU(nPath, [x + 0.5, y + 0.5]) > NECK_RIM_U);
    composite(p, c, crease, FOLD_NECK);
  }

  // ---------------- head
  HEAD_MASK.fill(0);
  drawHead(p, head, P);

  // ---------------- near arm (raised forearm: white top plane, flat steel underside, wrist crease)
  {
    const g = newG();
    const s = att([2, 3]);
    const el = add(s, polar(68 - P.arm, 7.5));
    const wa = -30 - P.arm * 1.4;
    const wr = add(el, polar(wa, 9));
    gEll(g, add(s, [0.5, 1]), 3.6, 3.2, 0, M.HIDE, { z: 1, flat: 1.3 });
    gTube(g, [s, el, wr], 5.8, 4.2, M.HIDE, { flat: 1.2 });
    gEll(g, add(wr, polar(wa, 1)), 2.6, 2, wa * DEG, M.HIDE, { z: 2, bias: 0.3 });
    const c = g.render();
    forearmUnderside(c, el, wr);
    rimLight(c, p);
    hand(c, wr, wa, false);
    castShadow(p, c);
    // the crease on the side facing the key light (and above) is one value (steel); behind and under
    // the arm it is the night3 crease
    composite(p, c, (x, y, b) => (c.isOpaque(x - LIGHT.side, y) || c.isOpaque(x, y + 1) ? selout(x, y, b) : crease(x, y, b)));
  }

  // ---------------- near wing (in front)
  {
    const c = drawWing(nearWing, false, P);
    if (P.cracks > 0) {
      const { E, Wr, tips } = nearWing;
      cracksOn(
        c,
        P,
        [
          { from: 0.36, pts: zig(lerpV(E, Wr, 0.45), lerpV(lerpV(tips[1], tips[2], 0.5), Wr, 0.3), 3, 1.5) },
          { from: 0.5, pts: zig(lerpV(Wr, tips[0], 0.25), lerpV(lerpV(tips[0], tips[1], 0.5), Wr, 0.25), 3, 1.2) },
        ],
        true,
      );
    }
    composite(p, c);
  }

  // ---------------- smear frame (attack release): the head and horns are stretched back along their
  // path by 2 px — matter, attached to the back of the skull and the horn, outlined with the body
  if (P.smearFrom) smearHead(p, pose(P.smearFrom), P);

  // ---------------- one last calm pass: lone 1-px crumbs inside the body take their surroundings
  cleanCrumbs(p);

  // ---------------- crystal twinkles
  if (P.sparkles.length) {
    const anchors: V[] = [
      lerpV(nearWing.Wr, nearWing.tips[0], 0.62),
      lerpV(nearWing.E, nearWing.attach, 0.45),
      lerpV(farWing.Wr, farWing.tips[1], 0.6),
      lerpV(nearWing.Wr, nearWing.tips[1], 0.55),
      add(hip, [-15, 7]),
    ];
    for (const [ai, size] of P.sparkles) twinkle(p, rnd(anchors[ai]), size);
  }

  // ---------------- part 2: the light drains, the crystal splits, the fragments gather
  if (P.drain > 0) drainLight(p, P);
  if (P.split > 0) splitBody(p, R, P);
  if (P.gather < 1) gatherBody(p, P);

  p.outline(PAL.ink);

  // prism light gathering between the jaws while charging (unoutlined: it is light, not matter)
  if (P.mouth > 0.45 && P.jaw < 0.5) {
    const m = rnd(add(mouthPoint(P), [1, 0]));
    const k = P.mouth;
    const put = (dx: number, dy: number, col: number) => p.set(m[0] + dx, m[1] + dy, col);
    if (k > 0.9) {
      for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3]] as const) put(dx, dy, PAL.cyan3);
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const) put(dx, dy, PAL.cyan4);
      put(4, 0, PAL.cyan2);
    } else if (k > 0.7) {
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as const) put(dx, dy, PAL.cyan3);
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(dx, dy, k > 0.7 ? PAL.white : PAL.cyan4);
    put(0, 0, PAL.white);
  }
}

/**
 * The keel: ONE cyan2 crystal line down the chest (at rest it sits exactly on the break between
 * the white lit plane and the mist mid plane, as on the still). It is fixed in torso space, so it
 * moves rigidly with the chest; the chest pulse lights it during the breath (cyan3 → a white core
 * with a cyan3 edge on its shadow side).
 */
function keel(c: PixelCanvas, R: Rig, P: Pose) {
  const a = R.att([-6.4, 0.6]);
  const b = R.att([-3.4, 9.6]);
  const core = P.pulse > 0.66 ? PAL.white : P.pulse > 0.33 ? PAL.cyan4 : PAL.cyan2;
  const onChest = (cur: number) => cur === PAL.white || cur === PAL.mist || cur === PAL.steel;
  if (P.pulse > 0.66) {
    const s = -LIGHT.side;
    lineOn(c, [a[0] + s, a[1]], [b[0] + s, b[1]], PAL.cyan3, onChest);
  }
  lineOn(c, a, b, core, (cur) => onChest(cur) || cur === PAL.cyan3);
}

/** Deliberate single pixels (eye glint, iris, nostril) that the crumb pass must keep. */
const KEEP = new Uint8Array(W * H);

/**
 * A pixel inside the body (4 opaque, non-ink neighbours) with no neighbour of its own colour in any
 * of the 8 directions is a crumb left where planes, creases and rims meet: it takes the colour its
 * 4-neighbours share most. 1-px lines (8-connected) and the silhouette are never touched.
 */
function cleanCrumbs(p: PixelCanvas) {
  const hits: number[] = [];
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      if (KEEP[y * W + x]) continue;
      const c = p.get(x, y);
      if (c === null || c === PAL.ink || !p.isOpaque(x, y)) continue;
      let same = false;
      for (let dy = -1; dy <= 1 && !same; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && p.isOpaque(x + dx, y + dy) && p.get(x + dx, y + dy) === c) same = true;
      if (same) continue;
      const n4: number[] = [];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const q = p.isOpaque(x + dx, y + dy) ? p.get(x + dx, y + dy) : null;
        if (q === null || q === PAL.ink) break;
        n4.push(q);
      }
      if (n4.length < 4) continue;
      let best = n4[0];
      let bn = 0;
      for (const q of n4) {
        const k = n4.filter((v) => v === q).length;
        if (k > bn) [best, bn] = [q, k];
      }
      hits.push(x, y, best);
    }
  for (let i = 0; i < hits.length; i += 3) p.set(hits[i], hits[i + 1], hits[i + 2]);
}

/** The raised forearm's flat steel underside: the lower 2 px of the forearm (elbow → wrist). */
function forearmUnderside(c: PixelCanvas, el: V, wr: V) {
  const t = norm(sub(wr, el));
  let n: V = [-t[1], t[0]];
  if (n[1] < 0) n = [-n[0], -n[1]];
  const hits: number[] = [];
  for (let y = Math.floor(Math.min(el[1], wr[1]) - 4); y <= Math.ceil(Math.max(el[1], wr[1]) + 4); y++)
    for (let x = Math.floor(Math.min(el[0], wr[0]) - 4); x <= Math.ceil(Math.max(el[0], wr[0]) + 4); x++) {
      const cur = c.get(x, y);
      if (cur !== PAL.white && cur !== PAL.mist) continue;
      const q: V = [x + 0.5, y + 0.5];
      const along = dot(sub(q, el), t);
      if (along < 1 || along > len(sub(wr, el)) + 0.5) continue;
      if (dot(sub(q, el), n) > 0.6) hits.push(x, y);
    }
  for (let i = 0; i < hits.length; i += 2) c.set(hits[i], hits[i + 1], PAL.steel);
}

/** One value down: the shadow a part casts on the hide behind it. */
const SHADOW: Record<number, number> = {
  [PAL.white]: PAL.steel,
  [PAL.mist]: PAL.steel,
  [PAL.steel]: PAL.night3,
  [PAL.cyan2]: PAL.cyan1,
  [PAL.cyan3]: PAL.cyan1,
  [PAL.cyan4]: PAL.cyan2,
};
/**
 * Cast shadow of a layer (the near arm) on the body already drawn: the layer's shape moved away from
 * the key light (down, and to the far side), over the hide only, never under the layer itself.
 */
function castShadow(p: PixelCanvas, layer: PixelCanvas, off: V = [2, 2]) {
  const ox = -LIGHT.side * off[0];
  const oy = off[1];
  const hits: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (layer.isOpaque(x, y) || !p.isOpaque(x, y)) continue;
      if (!layer.isOpaque(x - ox, y - oy)) continue;
      const to = SHADOW[p.get(x, y)!];
      if (to !== undefined) hits.push(x, y, to);
    }
  for (let i = 0; i < hits.length; i += 3) p.set(hits[i], hits[i + 1], hits[i + 2]);
}

/** Foot: a lit top edge and a dark sole (near night3, far night2). */
function footEdges(c: PixelCanvas, foot: V, far: boolean) {
  const x0 = Math.floor(foot[0]);
  const y0 = Math.floor(foot[1]);
  for (let y = y0 - 4; y <= y0 + 3; y++)
    for (let x = x0 - 6; x <= x0 + 5; x++) {
      const cur = c.get(x, y);
      if (cur === null) continue;
      if (!c.isOpaque(x, y + 1) && y >= y0) c.set(x, y, far ? PAL.night2 : PAL.night3);
    }
}

/** The head layer's pixels (skull, jaw, mouth, horns) of the frame being drawn. */
const HEAD_MASK = new Uint8Array(W * H);
function orMask(c: PixelCanvas, into: Uint8Array) {
  for (let i = 0; i < W * H; i++) if (c.data[i * 4 + 3]) into[i] = 1;
}

/**
 * Smear frame of the lunging head: the head (with its horns) is repeated 1 and 2 px back along its
 * motion (from the previous pose's head to this one) on the empty pixels behind it, so the back of
 * the skull and the horn stretch into a short trail that is part of the silhouette (outlined with
 * it), never a loose stroke in the air.
 */
function smearHead(p: PixelCanvas, from: Pose, to: Pose) {
  const d = norm(sub(rig(to).head, rig(from).head));
  const hits: number[] = [];
  const taken = new Set<number>();
  for (const k of [1, 2]) {
    const o = rnd(mul(d, k));
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!HEAD_MASK[y * W + x]) continue;
        const tx = x - o[0];
        const ty = y - o[1];
        if (tx < 1 || ty < 1 || tx >= W - 1 || ty >= H - 1 || p.isOpaque(tx, ty) || taken.has(ty * W + tx)) continue;
        const c = p.get(x, y);
        if (c === null || c === PAL.ink) continue;
        taken.add(ty * W + tx);
        hits.push(tx, ty, c);
      }
  }
  for (let i = 0; i < hits.length; i += 3) p.set(hits[i], hits[i + 1], hits[i + 2]);
}

function claws(c: PixelCanvas, foot: V, far: boolean) {
  const col = far ? PAL.steel : PAL.white;
  const x = Math.floor(foot[0]);
  const y = Math.floor(foot[1]);
  c.set(x + 4, y + 1, col);
  c.set(x + 3, y + 2, col);
  c.set(x + 2, y + 2, col);
  c.set(x, y + 2, col);
  c.set(x - 1, y + 2, col);
}

/** Forefoot claws: two hooks growing straight out of the front of the palm. */
function hand(c: PixelCanvas, wr: V, ang: number, far: boolean) {
  const col = far ? PAL.steel : PAL.white;
  const tipCol = far ? PAL.night3 : PAL.mist;
  const palm = add(wr, polar(ang, 1));
  for (const [da, long] of [[0, true], [48, false]] as const) {
    let k = 1.5;
    let a = flo(add(palm, polar(ang + da, k)));
    while (c.isOpaque(a[0], a[1]) && k < 6) {
      k += 0.5;
      a = flo(add(palm, polar(ang + da, k)));
    }
    c.set(a[0], a[1], col);
    if (long) {
      const b = flo(add(palm, polar(ang + da + 35, k + 1.2)));
      if (!c.isOpaque(b[0], b[1])) c.set(b[0], b[1], tipCol);
    }
  }
}

// ------------------------------------------------------------------ wing

/**
 * Crystal wing, restyled: every membrane cell is ONE flat glass tone (near: outer cells cyan3,
 * the inner sheet cyan2 with ONE cyan3 fold line from the elbow and cyan1 at the root; far: one
 * value darker), the free trailing edges carry one rim line coloured by their facing (white toward
 * the key light, cyan4 away), the bones are two-tone spars (white edge toward the light).
 */
function drawWing(r: WingRig, far: boolean, P: Pose): PixelCanvas {
  const g = newG();
  const glass = far ? M.GLASS_FAR : M.GLASS;
  const { S, E, Wr, tips, attach } = r;
  const n = tips.length;
  const shield = P.guard && !far;
  const w = far ? P.fw : P.nw;
  const scal = w.scal ?? 1;
  // GLASS: 0 cyan0 1 cyan1 2 cyan2 3 cyan3 4 cyan4 5 white | GLASS_FAR: 0 night1 1 cyan0 2 cyan1 3 cyan2 4 cyan3
  // [lead, trail] facet tone of each cell (outer → inner): the outer cells are flat, the inner
  // sheet keeps its two facets (lit lead facet by the finger, the broad trail sheet one value down)
  const cellTone = (i: number): [number, number] => (shield ? (i < n - 1 ? [3, 2] : [2, 1]) : far ? (i < n - 1 ? [3, 3] : [2, 2]) : i < n - 1 ? [3, 3] : [3, 2]);
  const rootTone = 1;
  const gx = lerp(-20, 170, P.glint);
  const glintAt = (x: number, y: number) => {
    if (P.glint < 0) return 0;
    const d = (LIGHT.side < 0 ? x : W - x) + y - gx;
    return d >= 0 && d < 3 ? 1 : 0;
  };
  const curves: V[][] = [];
  const valleys: V[] = [];
  for (let i = 0; i < n; i++) {
    const a = tips[i];
    const inner = i + 1 >= n;
    const b = inner ? attach : tips[i + 1];
    const hub = inner ? lerpV(Wr, E, 0.5) : Wr;
    // trailing edge: a scallop between two finger tips (its depth breathes with `scal`)
    const curve = bezier(a, lerpV(lerpV(a, b, 0.5), hub, (inner ? 0.42 : 0.62) * scal), b, undefined, 10);
    curves.push(curve);
    valleys.push(curve[5]);
    const [lead, trail] = cellTone(i);
    const root = (x: number, y: number) => inner && !shield && !far && distSeg([x + 0.5, y + 0.5], attach, S) < 4.2;
    // flare: one step lighter; a flat cell opens into its two facets (lit lead, trail one value down)
    const up = P.flare >= 0.5 ? 1 : 0;
    const trailUp = up && lead === trail ? 0 : up;
    gFacet(g, [Wr, ...curve.slice(0, 6)], glass, FLAT_N, 0, (x, y) => (root(x, y) ? rootTone + up : lead + up + glintAt(x, y)));
    gFacet(g, inner ? [Wr, ...curve.slice(5), S, E] : [Wr, ...curve.slice(5)], glass, FLAT_N, 0, (x, y) => (root(x, y) ? rootTone + up : trail + trailUp + glintAt(x, y)));
  }
  const c = g.render(0, false);

  // trailing-edge rims: free glass edges next to a scallop → one line, coloured by its facing
  // hitMagic flare: every facet one ramp step lighter, and the lines that separate them step up with
  // them (the rim facing away and the fold line), so the three planes and their lines survive
  const flared = P.flare >= 0.5;
  const rimHi = far ? PAL.cyan2 : shield ? PAL.cyan3 : PAL.white;
  const rimLo = far ? PAL.cyan2 : shield ? PAL.cyan2 : flared ? PAL.white : PAL.cyan4;
  {
    const hits: number[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!c.isOpaque(x, y)) continue;
        if (c.isOpaque(x - 1, y) && c.isOpaque(x + 1, y) && c.isOpaque(x, y - 1) && c.isOpaque(x, y + 1)) continue;
        const q: V = [x + 0.5, y + 0.5];
        let near = false;
        for (const cv of curves) if (distPoly(q, cv) < 1.6) near = true;
        if (!near) continue;
        let nx = 0;
        let ny = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && !c.isOpaque(x + dx, y + dy)) (nx += dx), (ny += dy);
        const f = dot(norm([nx, ny]), LIGHT.v2);
        hits.push(x, y, f > -0.05 ? rimHi : rimLo);
      }
    for (let i = 0; i < hits.length; i += 3) c.set(hits[i], hits[i + 1], hits[i + 2]);
  }

  // ONE fold line across the inner sheet: from the elbow toward the middle of its trailing edge
  if (!shield) {
    const inner = curves[n - 1];
    const fold = far ? (flared ? PAL.cyan2 : PAL.cyan1) : flared ? PAL.cyan4 : PAL.cyan3;
    const from = lerpV(E, Wr, 0.12);
    const to = inner[5];
    const glassCols = new Set(MATS_GLASS(far));
    lineOn(c, lerpV(from, to, 0.08), lerpV(from, to, 0.93), fold, (cur) => glassCols.has(cur) && cur !== rimHi && cur !== rimLo);
  }

  // bones: arm (humerus + forearm) as a flat mid-tone spar with ONE lit edge and ONE dark underside
  {
    const gb = newG();
    const bone = far ? M.BONE_FAR : M.BONE;
    gTube(gb, [S, E, Wr], 4.8, 3.6, bone, { z: 4, flat: 3 });
    gEll(gb, Wr, 2.5, 2.5, 0, bone, { z: 5, flat: 3 });
    gEll(gb, E, 2.7, 2.7, 0, bone, { z: 5, flat: 3 });
    const b = gb.render(0, false);
    if (far) edgePaint(b, PAL.mist, PAL.night3, { lit: 0.45, dark: -0.2 });
    else {
      // humerus: white edge, mist, steel; forearm: white leading edge, mist, cyan1 underside
      edgePaint(b, PAL.white, null, { lit: 0.12 });
      const hum = (x: number, y: number) => distSeg([x + 0.5, y + 0.5], S, E) < distSeg([x + 0.5, y + 0.5], E, Wr);
      const hits: number[] = [];
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const cur = b.get(x, y);
          if (cur === null || cur === PAL.white) continue;
          if (b.isOpaque(x - 1, y) && b.isOpaque(x + 1, y) && b.isOpaque(x, y - 1) && b.isOpaque(x, y + 1)) continue;
          const nn = norm(edgeNormal(b, x, y));
          if (dot(nn, LIGHT.v2) <= -0.2) hits.push(x, y, hum(x, y) ? PAL.steel : PAL.cyan1);
        }
      for (let i = 0; i < hits.length; i += 3) b.set(hits[i], hits[i + 1], hits[i + 2]);
    }
    // the elbow knuckle stays one calm tone; the wrist knuckle gets a 2-px cyan4 glint
    if (!far) {
      const k = flo(add(Wr, [LIGHT.side < 0 ? -1 : 0, -1]));
      if (b.isOpaque(k[0], k[1])) b.set(k[0], k[1], PAL.cyan4);
      if (b.isOpaque(k[0] + 1, k[1])) b.set(k[0] + 1, k[1], PAL.cyan4);
    }
    composite(c, b, (_x, _y, behind) => behind);
  }

  // finger bones: finger 0 (the spike) a two-tone spar, finger 1 a white top row over mist,
  // finger 2 one mist line (far wing: finger 0 one steel line, finger 1 one steel strut)
  for (let i = 0; i < n; i++) {
    const t = tips[i];
    const a = flo(Wr);
    const e = flo(t);
    if (shield) {
      lineOn(c, lerpV(Wr, t, 0.2), lerpV(Wr, t, 0.86), i === 0 ? PAL.white : PAL.mist);
      continue;
    }
    if (far) {
      // finger 0: the leading edge, one steel line with a lit mist tip; finger 2: the one strut
      // between the two cells (steel, a short mist lit edge toward its tip); finger 1 is hidden
      if (i === 0) {
        c.line(a[0] + 1, a[1], e[0], e[1], PAL.steel);
        const m = flo(lerpV(Wr, t, 0.82));
        c.line(m[0], m[1], e[0], e[1], PAL.mist);
      } else if (i === n - 1) {
        c.line(a[0], a[1], e[0], e[1], PAL.steel);
        const m = flo(lerpV(Wr, t, 0.62));
        lineOn(c, [m[0] + 0.5, m[1] - 0.5], [e[0] + 1.5, e[1] - 0.5], PAL.mist, (cur) => cur !== PAL.steel);
      }
      continue;
    }
    const dir = norm(sub(t, Wr));
    // a two-line spar: line A on the bone, line B one pixel below (flat finger) or to the right
    // (steep finger) — the same pixels for both lights; the line facing the key light is white
    const sd: V = Math.abs(dir[0]) > Math.abs(dir[1]) ? [0, 1] : [1, 0];
    const bLit = dot(sd, LIGHT.v2) > 0;
    const mid = flo(lerpV(Wr, t, 0.55));
    if (i === 2) {
      c.line(a[0], a[1], e[0], e[1], PAL.mist);
      continue;
    }
    c.line(a[0], a[1], mid[0], mid[1], bLit ? PAL.mist : PAL.white);
    c.line(a[0] + sd[0], a[1] + sd[1], mid[0] + sd[0], mid[1] + sd[1], bLit ? PAL.white : PAL.mist);
    c.line(mid[0], mid[1], e[0], e[1], PAL.white);
  }
  return c;
}

function MATS_GLASS(far: boolean): number[] {
  return far ? [PAL.night1, PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4] : [PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white];
}

// ------------------------------------------------------------------ head

/** head scale */
const HS = 1.2;
const HINGE: V = [-1.5, 1.4];
const JAW_OPEN = 0.62; // ~35° at jaw = 1

interface HeadFrame {
  T: (x: number, y: number) => V;
  J: (x: number, y: number) => V;
  jawA: number;
}

export function headFrame(hp: V, P: Pose): HeadFrame {
  const ha = P.ha;
  const T = (x: number, y: number): V => add(hp, rotV([x * HS, y * HS], ha));
  const jawA = P.jaw * JAW_OPEN;
  const J = (x: number, y: number): V => {
    const q = add(HINGE, rotV(sub([x, y], HINGE), jawA));
    return T(q[0], q[1]);
  };
  return { T, J, jawA };
}

/** Head-space coordinates of a frame pixel (inverse of headFrame's T). */
function headSpace(hp: V, ha: number, x: number, y: number): V {
  const d = rotV([x + 0.5 - hp[0], y + 0.5 - hp[1]], -ha);
  return [d[0] / HS, d[1] / HS];
}

/** Centre of the open mouth (beam origin). */
export function mouthPoint(P: Pose): V {
  const { T, J } = headFrame(rig(P).head, P);
  return lerpV(T(16, 1.4), J(15.5, 1.4), 0.5);
}

/** Eye (head point) of a pose. */
export function eyePoint(P: Pose): V {
  const { T } = headFrame(rig(P).head, P);
  return T(2.4, -3.6);
}

// Head planes in head space (x forward along the snout, y down; scaled by HS, rotated by ha).
type P2 = [number, number];
// the whole upper head (v1 silhouette): side plane, mist
const SKULL: P2[] = [[-5, 1.4], [-6.4, -2], [-4.8, -5.4], [-0.8, -7.3], [4.4, -7.4], [7.8, -6.2], [9.8, -4.7], [14.8, -3.8], [17.4, -3.4], [18.8, -2.2], [19.1, -0.3], [18.3, 1.4], [10, 1.4], [3, 1.4]];
// lower jaw (rotates about HINGE; v1 silhouette): steel side plane, night3 underside, lit chin
const JAW: P2[] = [[-4.4, 1.4], [18, 1.4], [18.2, 2.9], [15.2, 4.2], [9, 5.0], [2, 5.8], [-2.6, 5.6], [-4.8, 3.6]];
const CHIN: P2[] = [[15.4, 1.6], [18.4, 1.6], [18.4, 3.2], [15.6, 3.4]];

// Interior planes and lines measured on the approved still at the rest pose (still pixel
// coordinates, v1 frame) and carried into head space once, so the rest pose reproduces the still
// and every other pose moves them rigidly with the head.
const REST_HP: V = [66, 22];
const REST_HA = 0.1;
const hs = (x: number, y: number): P2 => {
  const d = rotV([x - REST_HP[0], y - REST_HP[1]], -REST_HA);
  return [d[0] / HS, d[1] / HS];
};
// lit top plane (white): crown, brow and snout bridge (clipped to the skull)
const TOP: P2[] = [hs(61, 6), hs(97, 6), hs(97, 23.1), hs(89, 22.4), hs(75, 20.05), hs(75, 17), hs(66.9, 17), hs(66.9, 12)];
// steel cheek wedge under the cheekbone
const CHEEK: P2[] = [hs(63, 21), hs(72, 21), hs(70.2, 22.4), hs(64, 24.1), hs(62.6, 24.1)];
// the brow ridge (night3): one long line from the horn root over the eye, dropping in front of it
const BROW: P2[] = [hs(65.5, 17.5), hs(74.5, 17.5), hs(74.5, 18.5), hs(73.5, 18.5)];
// the up-turned corner of the mouth line (night1; the line itself is the seam over the jaw)
const MOUTH_HOOK: P2[] = [hs(64.5, 23.5), hs(68.5, 23.5)];
const NOSTRIL: P2 = hs(86.5, 22.5);
const EYE_AT: P2 = hs(67.5, 18.5);
// eye stamps (top-left at EYE_AT): night2 socket, cyan3 iris, one white glint under the brow
const EYE_OPEN = ['22wddd', '22ddd2', '.22222'];
const EYE_HALF = ['223333', '22ddd2', '.22222'];
const EYE_SHUT = ['223333', '.2222.'];
const EYE_KEY: Record<string, number> = { '2': PAL.night2, '3': PAL.night3, d: PAL.cyan3, w: PAL.white, e: PAL.cyan4 };

const MOUTH_MASK = new Uint8Array(W * H);
const FAR_MASK = new Uint8Array(W * H);
const LEG_MASK = new Uint8Array(W * H);
const JAW_MASK = new Uint8Array(W * H);
const SKULL_MASK = new Uint8Array(W * H);

function drawHead(p: PixelCanvas, hp: V, P: Pose) {
  const { T, J, jawA } = headFrame(hp, P);
  const Ts = (pts: P2[]) => pts.map(([x, y]) => T(x, y));
  const Js = (pts: P2[]) => pts.map(([x, y]) => J(x, y));
  const open = P.jaw > 0.1;
  MOUTH_MASK.fill(0);
  JAW_MASK.fill(0);

  // mouth cavity: dark throat at the back, glowing prism light at the front when charged
  if (open) {
    const g = newG();
    gFacet(g, [T(-2.6, 1.4), T(18.3, 1.4), J(18, 1.4), J(-2.6, 1.4)], M.MOUTH, FLAT_N, 0);
    const c = g.render(0, false);
    const back = T(-1, 1.4);
    const front = T(18.3, 1.4);
    const m = lerpV(T(16, 1.4), J(15.5, 1.4), 0.5);
    const glowM = P.mouth;
    const axis = sub(front, back);
    const al = len(axis) || 1;
    const jawLine = [J(-2, 1.4), J(18, 1.4)];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!c.isOpaque(x, y)) continue;
        const q: V = [x + 0.5, y + 0.5];
        const along = ((q[0] - back[0]) * axis[0] + (q[1] - back[1]) * axis[1]) / (al * al);
        const dm = len(sub(q, m));
        let col: number = along < 0.42 ? PAL.night0 : PAL.night1;
        if (glowM > 0.5) {
          if (dm < 1.9) col = PAL.white;
          else if (dm < 3.1) col = PAL.cyan4;
          else if (dm < 4.3) col = PAL.cyan3;
          else if (along > 0.5) col = PAL.cyan1;
        } else if (along > 0.3 && along < 0.85 && distSeg(q, jawLine[0], jawLine[1]) < 1.6) col = PAL.crim1; // tongue
        c.set(x, y, col);
      }
    maskOf(c, MOUTH_MASK);
    orMask(c, HEAD_MASK);
    composite(p, c);
  }

  // lower jaw: steel side plane, night3 underside line, lit chin
  {
    const g = newG();
    gFacet(g, Js(JAW), M.HIDE_D, FLAT_N, 0, 2);
    gFacet(g, Js(CHIN), M.HIDE_D, FLAT_N, 1, 3);
    const c = g.render(0, false);
    const down = rotV([0, 1], P.ha + jawA);
    const hits: number[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!c.isOpaque(x, y) || c.get(x, y) !== PAL.steel) continue;
        if (!c.isOpaque(x + Math.round(down[0]), y + Math.round(down[1])) || !c.isOpaque(x, y + 1)) hits.push(x, y);
      }
    for (let i = 0; i < hits.length; i += 2) c.set(hits[i], hits[i + 1], PAL.night3);
    maskOf(c, JAW_MASK);
    orMask(c, HEAD_MASK);
    composite(p, c, (x, y, b) => (MOUTH_MASK[y * W + x] ? PAL.ink : selout(x, y, b)));
  }

  // upper head: mist side plane, white top plane, steel cheek wedge
  const g = newG();
  gFacet(g, Ts(SKULL), M.HIDE_D, FLAT_N, 0, 3);
  {
    const c0 = g.render(0, false);
    maskOf(c0, SKULL_MASK);
  }
  const inSkull = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && SKULL_MASK[y * W + x] === 1;
  fillPoly2(Ts(TOP), (x, y) => inSkull(x, y) && g.put(x, y, M.HIDE_D, 0, 0, 1, 1, 4));
  fillPoly2(Ts(CHEEK), (x, y) => inSkull(x, y) && g.put(x, y, M.HIDE_D, 0, 0, 1, 2, 2));
  const c = g.render(0, false);
  // brow ridge, mouth line, nostril
  const L = (pts: P2[], col: number) => {
    for (let i = 1; i < pts.length; i++) lineOn(c, T(...pts[i - 1]), T(...pts[i]), col);
  };
  L(BROW, PAL.night3);
  L(MOUTH_HOOK, PAL.night1);
  {
    const n0 = flo(T(...NOSTRIL));
    c.paint(n0[0], n0[1], PAL.night2);
    if (n0[0] >= 0 && n0[1] >= 0 && n0[0] < W && n0[1] < H) KEEP[n0[1] * W + n0[0]] = 1;
  }
  // charged lips: a thread of light leaks between the closed jaws
  if (!open && P.mouth > 0.2) lineOn(c, T(6, 1.0), T(18.5, 0.8), P.mouth > 0.6 ? PAL.cyan4 : PAL.cyan3);
  orMask(c, HEAD_MASK);
  composite(p, c, (x, y, b) => {
    const i = y * W + x;
    if (MOUTH_MASK[i]) return PAL.ink;
    // closed: the jaw's top row under the lip is the night1 mouth line, from the corner forward
    if (JAW_MASK[i]) return open ? PAL.ink : headSpace(hp, P.ha, x, y)[0] > -0.6 ? PAL.night1 : b;
    return selout(x, y, b);
  });
  // eye
  {
    const e = flo(T(...EYE_AT));
    const rows = P.eye > 0.75 ? EYE_OPEN : P.eye > 0.25 ? EYE_HALF : EYE_SHUT;
    for (let j = 0; j < rows.length; j++)
      for (let i = 0; i < rows[j].length; i++) {
        let col = EYE_KEY[rows[j][i]];
        if (col === undefined) continue;
        // charged: the iris burns brighter
        if (rows[j][i] === 'd' && P.glow > 0.85) col = PAL.cyan4;
        const x = e[0] + i;
        const y = e[1] + j;
        if (p.isOpaque(x, y) && p.get(x, y) !== PAL.ink) {
          p.set(x, y, col);
          KEEP[y * W + x] = 1;
        }
      }
  }

  // fangs: white teeth hang just inside the ink gape line
  if (open) {
    const down = rotV([0, 1], P.ha);
    const up = rotV([0, -1], P.ha + jawA);
    const tooth = (from: V, dir: V, long: boolean) => {
      let seenInk = false;
      let last = '';
      for (let k = 0; k < 9; k += 0.5) {
        const q = flo(add(from, mul(dir, k)));
        const key = q[0] + ',' + q[1];
        if (key === last) continue;
        last = key;
        if (q[0] < 0 || q[1] < 0 || q[0] >= W || q[1] >= H) return;
        const i = q[1] * W + q[0];
        const cur = p.get(q[0], q[1]);
        if (!MOUTH_MASK[i]) {
          if (seenInk) return;
          continue;
        }
        if (cur === PAL.ink) {
          seenInk = true;
          continue;
        }
        p.set(q[0], q[1], PAL.white);
        if (long) {
          const q2 = flo(add(from, mul(dir, k + 1)));
          if (MOUTH_MASK[q2[1] * W + q2[0]] && p.get(q2[0], q2[1]) !== PAL.ink) p.set(q2[0], q2[1], PAL.mist);
        }
        return;
      }
    };
    for (const [tx, long] of [[6.5, false], [10, true], [13.5, true], [17, true]] as const) tooth(T(tx, 0.4), down, long);
    for (const tx of [12, 16.2]) tooth(J(tx, 2.6), up, false);
  }

  // horns (gold, four bands): the main sweep off the crown and a cheek horn
  {
    // four bands by the horn's own geometry (the same for both lights, so P2 never zig-zags):
    // gold4 along the upper edge, gold3 body, gold2 underside, gold1 at the root
    const band = (root: number) => (u: number, _v: number, _ox: number, oy: number) => (u < root ? 0 : oy < -0.42 ? 3 : oy > 0.3 ? 1 : 2);
    const g2 = newG();
    gTube(g2, bezier(T(-1.6, -6.2), T(-6.8, -8.4), T(-11.8, -8.8), T(-16.2, -12), 12), 3.8, 1, M.GOLD_D, { biasAt: band(0.035) });
    const hornC = g2.render(0, false);
    orMask(hornC, HEAD_MASK);
    composite(p, hornC, selout, { top: 1, side: 1, bottom: 1 });
    const g3 = newG();
    gTube(g3, bezier(T(-3.6, -0.4), T(-7, -0.2), T(-9.4, 0.8), T(-11.6, 3), 8), 2.6, 1, M.GOLD_D, { z: 1, biasAt: band(-1) });
    composite(p, g3.render(0, false), () => PAL.night2, { top: 1, side: 1, bottom: 1 });
  }
}

/** fillPoly with a callback that may return anything (lets callers filter with &&). */
function fillPoly2(pts: readonly V[], cb: (x: number, y: number) => unknown) {
  fillPoly(pts, (x, y) => void cb(x, y));
}

// ------------------------------------------------------------------ part 2: death / revive passes
//
// Crack lines live in the space of the part they are on (torso, neck, head, thigh, wing, tail), so
// they move rigidly with it and never swim. Each grows from its first point once `cracks` passes
// its `from`. While the inner light is still in the body a crack glows (cyan3 on the hide, white on
// the glass); where the light has drained (the same front as drainLight) it is a dark groove.

/** The point the inner light drains into (the keel, where the first crack opens). */
const CORE = { v: [0, 0] as V };
function coreOf(R: Rig): V {
  return R.att([-5, 5]);
}

/** Radius of the drain front: pixels farther from the core than this have lost their light. */
function drainFront(P: Pose): number {
  return P.drain <= 0 ? Infinity : (1 - P.drain) * 80 - 4;
}
function drainedAt(P: Pose, x: number, y: number): boolean {
  return Math.hypot(x + 0.5 - CORE.v[0], y + 0.5 - CORE.v[1]) > drainFront(P);
}

/** A zig-zag polyline from a to b (n segments, alternating perpendicular offsets of `amp` px). */
function zig(a: V, b: V, n: number, amp: number): V[] {
  const d = sub(b, a);
  const nn = norm([-d[1], d[0]]);
  const out: V[] = [a];
  for (let i = 1; i < n; i++) out.push(add(lerpV(a, b, i / n), mul(nn, i % 2 ? amp : -amp)));
  out.push(b);
  return out;
}

interface Crack {
  from: number;
  pts: V[];
}

/** The torso's crack network in torso space: the main crack up from the keel to the neck root and
 *  down to the belly, then two branches. */
function torsoCracks(R: Rig): Crack[] {
  const a = (pts: [number, number][]) => pts.map((o) => R.att(o));
  return [
    { from: 0, pts: a([[-5, 5], [-3, 2], [-4.5, -1], [-1.5, -4], [0, -7.5]]) },
    { from: 0.06, pts: a([[-5, 5], [-7.5, 8], [-6, 11], [-9.5, 13], [-10, 17]]) },
    { from: 0.3, pts: a([[-7.5, 8], [-11.5, 7], [-14, 10.5]]) },
  ];
}

const HIDE_PX = new Set<number>([PAL.white, PAL.mist, PAL.steel, PAL.night3, PAL.night2, PAL.cyan2]);
const GLASS_PX = new Set<number>([PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white, PAL.mist, PAL.steel]);

/** Draw the visible part of each crack over a part's layer (only over its own surface pixels). */
function cracksOn(c: PixelCanvas, P: Pose, list: Crack[], glass: boolean) {
  const surf = glass ? GLASS_PX : HIDE_PX;
  for (const k of list) {
    const grow = clamp((P.cracks - k.from) / 0.42, 0, 1);
    if (grow <= 0) continue;
    // the visible prefix of the polyline
    const lens = [0];
    for (let i = 1; i < k.pts.length; i++) lens.push(lens[i - 1] + len(sub(k.pts[i], k.pts[i - 1])));
    const want = grow * lens[lens.length - 1];
    for (let i = 1; i < k.pts.length && lens[i - 1] < want; i++) {
      const t = clamp((want - lens[i - 1]) / (lens[i] - lens[i - 1] || 1), 0, 1);
      const a = k.pts[i - 1];
      const b = lerpV(a, k.pts[i], t);
      lineOn2(c, a, b, (x, y, cur) => {
        if (!surf.has(cur)) return null;
        const dark = drainedAt(P, x, y);
        return glass ? (dark ? PAL.cyan0 : PAL.white) : dark ? PAL.night2 : PAL.cyan3;
      });
    }
  }
}

/** Bresenham line whose colour is chosen per pixel (null = leave the pixel). */
function lineOn2(c: PixelCanvas, a: V, b: V, col: (x: number, y: number, cur: number) => number | null) {
  let [x0, y0] = flo(a);
  const [x1, y1] = flo(b);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    const cur = c.get(x0, y0);
    if (cur !== null) {
      const k = col(x0, y0, cur);
      if (k !== null) c.set(x0, y0, k);
    }
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/** One value down every ramp: what is left of the crystal once its light has gone out. */
const DRAIN: Record<number, number> = {
  [PAL.white]: PAL.mist,
  [PAL.mist]: PAL.steel,
  [PAL.steel]: PAL.night3,
  [PAL.night4]: PAL.night3,
  [PAL.night3]: PAL.night2,
  [PAL.night2]: PAL.night1,
  [PAL.night1]: PAL.night0,
  [PAL.cyan4]: PAL.cyan3,
  [PAL.cyan3]: PAL.cyan2,
  [PAL.cyan2]: PAL.cyan1,
  [PAL.cyan1]: PAL.cyan0,
  [PAL.cyan0]: PAL.night1,
  [PAL.gold4]: PAL.gold3,
  [PAL.gold3]: PAL.gold2,
  [PAL.gold2]: PAL.gold1,
  [PAL.gold1]: PAL.gold0,
  [PAL.crim1]: PAL.night1,
};

/** The inner light retreats from the extremities into the core (drain → 1), or refills from it
 *  (revive: drain → 0): beyond the front every tone is one value down. */
function drainLight(p: PixelCanvas, P: Pose) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const cur = p.get(x, y);
      if (cur === null || !drainedAt(P, x, y)) continue;
      const to = DRAIN[cur];
      if (to !== undefined) p.set(x, y, to);
    }
}

/** The main crack, extended through the whole body: the line the cold crystal splits along. */
function splitLine(R: Rig): V[] {
  const a = R.att([0, -7.5]);
  const b = R.att([-10, 17]);
  const m = R.att([-5, 5]);
  const up = norm(sub(a, m));
  const dn = norm(sub(b, m));
  return [add(a, mul(up, 80)), a, R.att([-1.5, -4]), R.att([-4.5, -1]), R.att([-3, 2]), m, R.att([-7.5, 8]), R.att([-6, 11]), R.att([-9.5, 13]), b, add(b, mul(dn, 80))];
}

/** The body splits along the main crack: the front piece (head, neck, chest) parts from the back
 *  piece by 1 px (split ≥ 0.5) or 2 px (split ≥ 1); the outline fills the gap with ink. */
function splitBody(p: PixelCanvas, R: Rig, P: Pose) {
  const k = P.split >= 1 ? 2 : P.split >= 0.5 ? 1 : 0;
  if (!k) return;
  const line = splitLine(R);
  const src = newCanvas();
  src.data.set(p.data);
  p.clear();
  const side = (q: V) => {
    let best = Infinity;
    let s = 0;
    for (let i = 1; i < line.length; i++) {
      const d = distSeg(q, line[i - 1], line[i]);
      if (d < best) {
        best = d;
        const ab = sub(line[i], line[i - 1]);
        const aq = sub(q, line[i - 1]);
        s = ab[0] * aq[1] - ab[1] * aq[0];
      }
    }
    return s;
  };
  // the front piece moves forward and down a little (it falls away), the back piece stays
  const mv: V = k === 2 ? [2, 1] : [1, 1];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const cur = src.get(x, y);
      if (cur === null) continue;
      const front = side([x + 0.5, y + 0.5]) < 0;
      if (!front) p.set(x, y, cur);
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const cur = src.get(x, y);
      if (cur === null) continue;
      if (side([x + 0.5, y + 0.5]) < 0) {
        const tx = x + mv[0];
        const ty = y + mv[1];
        if (tx < W - 1 && ty < H - 1) p.set(tx, ty, cur);
      }
    }
}

// Revive: the body is cut into crystal fragments (a fixed jittered-grid Voronoi partition of the
// frame, 7 px cells); each flies in from outside along a gentle spiral and locks into place, the
// inner fragments first. While flying a fragment is all glass (its tones mapped onto the crystal
// ramp); once locked it shows the body.
const CELL = 7;
const GX = Math.ceil(W / CELL) + 1;
const GY = Math.ceil(H / CELL) + 1;
let CELL_MAP: Int16Array | null = null;
let SEEDS: V[] = [];
const hash = (i: number, k: number) => {
  let h = (i * 374761393 + k * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function cellMap(): Int16Array {
  if (CELL_MAP) return CELL_MAP;
  SEEDS = [];
  for (let gy = 0; gy < GY; gy++)
    for (let gx = 0; gx < GX; gx++) {
      const i = gy * GX + gx;
      SEEDS.push([gx * CELL + 0.5 + hash(i, 1) * 6, gy * CELL + 0.5 + hash(i, 2) * 6]);
    }
  const m = new Int16Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const gx = Math.floor(x / CELL);
      const gy = Math.floor(y / CELL);
      let best = Infinity;
      let bi = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const cx = gx + dx;
          const cy = gy + dy;
          if (cx < 0 || cy < 0 || cx >= GX || cy >= GY) continue;
          const i = cy * GX + cx;
          const d = (SEEDS[i][0] - x - 0.5) ** 2 + (SEEDS[i][1] - y - 0.5) ** 2;
          if (d < best) [best, bi] = [d, i];
        }
      m[y * W + x] = bi;
    }
  CELL_MAP = m;
  return m;
}

const SHARD: Record<number, number> = {
  [PAL.white]: PAL.white,
  [PAL.mist]: PAL.cyan4,
  [PAL.steel]: PAL.cyan3,
  [PAL.night4]: PAL.cyan2,
  [PAL.night3]: PAL.cyan2,
  [PAL.night2]: PAL.cyan1,
  [PAL.night1]: PAL.cyan1,
  [PAL.night0]: PAL.cyan0,
  [PAL.cyan0]: PAL.cyan1,
  [PAL.cyan1]: PAL.cyan2,
  [PAL.cyan2]: PAL.cyan3,
  [PAL.cyan3]: PAL.cyan4,
  [PAL.cyan4]: PAL.white,
};

/** Arrival (0..1) and offset of a fragment at this gather progress. */
export function fragment(i: number, seed: V, gather: number): { a: number; off: V } {
  const c = CORE.v;
  const d = len(sub(seed, c));
  const delay = 0.5 * clamp(d / 52, 0, 1) + 0.1 * hash(i, 3);
  const a = clamp((gather - delay) / 0.4, 0, 1);
  let dir = norm(sub(seed, c));
  // fragments come in from the sides and from above, never from under the floor
  if (dir[1] > -0.1) dir = norm([dir[0] || (hash(i, 4) < 0.5 ? -1 : 1), -0.1]);
  const k = 1 - a;
  // the spiral turns upward on both sides: they arc in from above
  const swirl = k * 40 * DEG * (dir[0] > 0 ? -1 : 1);
  const dist = (8 + 10 * hash(i, 5)) * k * k;
  return { a, off: mul(rotV(dir, swirl), dist) };
}

function gatherBody(p: PixelCanvas, P: Pose) {
  const map = cellMap();
  const src = newCanvas();
  src.data.set(p.data);
  p.clear();
  const N = SEEDS.length;
  const frag = new Array<{ a: number; off: V }>(N);
  for (let i = 0; i < N; i++) frag[i] = fragment(i, SEEDS[i], P.gather);
  // locked fragments first, the flying ones over them
  for (const flying of [false, true])
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const cur = src.get(x, y);
        if (cur === null) continue;
        const f = frag[map[y * W + x]];
        if (f.a <= 0 || f.a >= 1 === flying) continue;
        const o = rnd(f.off);
        const tx = x + o[0];
        const ty = y + o[1];
        if (tx < 2 || ty < 2 || tx >= W - 2 || ty >= H - 2) continue;
        p.set(tx, ty, flying ? SHARD[cur] ?? cur : cur);
      }
}
