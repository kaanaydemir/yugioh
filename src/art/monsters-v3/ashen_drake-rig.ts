// Kül Ejderi v3 — the drake's own rig: a low, hunched QUADRUPED (not the wyrm's upright biped).
//
// Body plan (side view, facing right; every height is "px above the ground line GY"):
//   haunch  — a heavy folded hind leg (thigh forward, hock back, flat foot), hip at (38, 27);
//   torso   — a deep barrel that rises to a massive shoulder hump (76, 33) — the front limbs are
//             longer than the hind ones, so the back slopes DOWN to the tail;
//   arms    — thick forelimbs on the KNUCKLES (a fist with three claws on the floor), the near one
//             back under the shoulder, the far one planted ahead: the gait of a gorilla;
//   neck    — short and thick, no S-curve; the horned head hangs LOW in front of the hump;
//   wings   — ragged, half-folded on the back like a cloak: the wrist stands over the shoulder as a
//             bony knuckle, three finger bones sweep back and down over the flank, the membrane is
//             torn (notches, holes with an ember rim) — they only open for the roar / summon;
//   tail    — a long hooked tail that drags low and curls up into a spiked club.
// Ember-red cracks run along the ribs, haunch, spine, finger bones and tear edges; ash drifts
// off the back and out of the nostrils in every frame (Pose.ash is a loop phase).
//
// Craft (same pipeline as the aces, ashen_drake-gbuf.ts): parts are drawn as G-buffer layers
// (spheres / tubes / facets lit by ONE key light that the caller can flip for the P2 relight),
// quantized into clear value planes, despeckled, composited with 1-px seams / creases, then the
// silhouette outline, selective rim lines (the lighter mid-tone band that keeps the charcoal
// readable on the navy floor), ember lines and the ash.

import { PixelCanvas, bezier } from '../pixel';
import { PAL } from '../palette';
import {
  DEG,
  FLAT_N,
  GY,
  H,
  LIGHT,
  M,
  W,
  add,
  clamp,
  composite,
  crease,
  distPoly,
  distSeg,
  edgePaint,
  fillPoly,
  flo,
  gEll as gEll0,
  gFacet,
  gTube as gTube0,
  ik,
  len,
  lerp,
  lerpV,
  lineOn,
  mul,
  newCanvas,
  newG,
  norm,
  polar,
  resetPools,
  rimLight,
  rnd,
  rotV,
  selout,
  sub,
  type G,
  type V,
} from './ashen_drake-gbuf';

// ------------------------------------------------------------------ pose model

/** One wing: the wrist (offset from the wing root, screen px) and three finger bones (angle, length). */
export interface Wing {
  wx: number;
  wy: number;
  /** finger angles in degrees, screen space: 0 = forward, 90 = down, 180 = back, -90 = up */
  a: [number, number, number];
  l: [number, number, number];
  /** depth of the scalloped trailing edge (px) */
  sag: number;
  /** thumb claw length at the wrist (px) */
  thumb: number;
}

export interface Pose {
  /** whole-body offset (px, +y down): the pounce and the crouch */
  bx: number;
  by: number;
  /** extra offsets of the haunch and the shoulder hump (px) */
  hipX: number;
  hipY: number;
  shX: number;
  shY: number;
  /** extra arch of the spine between them (px up) */
  arch: number;
  /** LOCAL shifts (the hump ellipse only / the belly's lower contour only): the cheap, small motions */
  humpX: number;
  humpY: number;
  belly: number;
  /** wrist targets of the near / far forelimb and ankle targets of the near / far hind limb,
   *  as offsets from their planted rest position (px; negative y = lifted) */
  fN: V;
  fF: V;
  lN: V;
  lF: V;
  /** head: offset from its rest place (px), angle (rad, + = nose down), jaw (0..1), eye (0..1), flare (0..1) */
  hd: V;
  ha: number;
  jaw: number;
  eye: number;
  flare: number;
  /** tail: loop phase (0..1), wave amplitude (deg), curl multiplier of the hook, tip lift (px) */
  tph: number;
  tamp: number;
  tcurl: number;
  tlift: number;
  nw: Wing;
  fw: Wing;
  /** ember glow 0..1 (cracks, eye, mouth); ash loop phase 0..1; smoke density 0..1 */
  glow: number;
  ash: number;
  smoke: number;
  /** ember spill from the mouth 0..1 (roar) */
  spill: number;
  /** claws spread 0..1 (front paws) */
  claw: number;
  /** death / revive: body crumbled into ash (0 = whole, 1 = gone) and the embers drained (0 = lit) */
  crumble: number;
  drain: number;
  /** strike flash: the hide on the struck side goes white-hot (hitMagic) 0..1 */
  heat: number;
  /** the near wing is drawn in FRONT of the head and the arm (guard wrap, wing slam): 0 / 1 */
  wfront: number;
  /** ember spill from the mouth: fall phase (loop) */
  spillT: number;
  /** fast flicker step (0, 1, 2…): which hot runs light up on the cracks, how the torn edges flutter */
  flick: number;
}

const WING_NEUTRAL_N: Wing = { wx: 5, wy: -11, a: [148, 118, 90], l: [50, 47, 43], sag: 5, thumb: 4 };
const WING_NEUTRAL_F: Wing = { wx: 6, wy: -15, a: [158, 134, 108], l: [46, 41, 35], sag: 4, thumb: 3 };

export const NEUTRAL: Pose = {
  bx: 0,
  by: 0,
  hipX: 0,
  hipY: 0,
  shX: 0,
  shY: 0,
  arch: 0,
  humpX: 0,
  humpY: 0,
  belly: 0,
  fN: [0, 0],
  fF: [0, 0],
  lN: [0, 0],
  lF: [0, 0],
  hd: [0, 0],
  ha: 0.22,
  jaw: 0,
  eye: 1,
  flare: 0,
  tph: 0,
  tamp: 6,
  tcurl: 1,
  tlift: 0,
  nw: WING_NEUTRAL_N,
  fw: WING_NEUTRAL_F,
  glow: 0.5,
  ash: 0,
  smoke: 1,
  spill: 0,
  claw: 0,
  crumble: 0,
  drain: 0,
  heat: 0,
  wfront: 0,
  spillT: 0,
  flick: 0,
};

export type PoseDelta = Partial<Omit<Pose, 'nw' | 'fw'>> & { nw?: Partial<Wing>; fw?: Partial<Wing> };

export function pose(d: PoseDelta = {}): Pose {
  const { nw, fw, ...rest } = d;
  return { ...NEUTRAL, ...rest, nw: { ...NEUTRAL.nw, ...nw }, fw: { ...NEUTRAL.fw, ...fw } } as Pose;
}

/** Re-base a pose on another (a delta over a full pose). */
export function over(base: Pose, d: PoseDelta): Pose {
  const { nw, fw, ...rest } = d;
  return { ...base, ...rest, nw: { ...base.nw, ...nw }, fw: { ...base.fw, ...fw } } as Pose;
}

function lerpAny<T>(a: T, b: T, t: number): T {
  if (typeof a === 'number' && typeof b === 'number') return (a + (b - a) * t) as unknown as T;
  if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => lerpAny(v, b[i], t)) as unknown as T;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(b as object)) o[k] = lerpAny((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], t);
    return o as T;
  }
  return b;
}
export const lerpPose = (a: Pose, b: Pose, t: number): Pose => lerpAny(a, b, t);

// ------------------------------------------------------------------ skeleton

/** Global scale of the design (a class-80 drake is ~3500 px, not the 5500 the first proportions gave). */
export const S = 0.8;
const CX = 66;
/** Frame shift to the right (room for the tail on the left). */
const X0 = 5;
const q = (x: number, h: number): V => [X0 + CX + (x - CX) * S, GY - h * S];

type TubeOpts = Parameters<typeof gTube0>[5];
const tubeS = (g: G, path: V[], w0: number, w1: number, mat: number, o?: TubeOpts) => gTube0(g, path, w0 * S, w1 * S, mat, o);
const ellS = (g: G, c: V, rx: number, ry: number, ang: number, mat: number, o?: Parameters<typeof gEll0>[6]) => gEll0(g, c, rx * S, ry * S, ang, mat, o);

const HIP0: V = q(38, 27);
const SHO0: V = q(78, 43);
const HAND_N: V = q(86, 8);
const HAND_F: V = q(101, 7);
const ANK_N: V = q(41, 11);
const ANK_F: V = q(61, 11);
const HEAD0: V = q(102, 28);
const WROOT_N: V = q(72, 58);
const WROOT_F: V = q(79, 60);
const TAIL_ROOT: V = q(31, 28);

export interface Rig {
  hip: V;
  sho: V;
  mid: V;
  back: V[];
  elbowN: V;
  wristN: V;
  elbowF: V;
  wristF: V;
  kneeN: V;
  ankN: V;
  kneeF: V;
  ankF: V;
  head: V;
  neck: V[];
  tail: V[];
  rootN: V;
  rootF: V;
}

// the tail's rest shape: a hook that drags low and curls up (relative to the root, +y down)
const TAIL_REST: V[] = [
  [0, 0],
  [-5, 3],
  [-10, 6],
  [-15, 8],
  [-19, 8],
  [-22, 5],
  [-24, 0],
  [-25, -6],
  [-26, -11],
  [-26, -15],
];

export function tailPoints(P: Pose, root: V): V[] {
  const pts: V[] = [root];
  let ang = 0;
  let prevRestAng = 0;
  for (let i = 1; i < TAIL_REST.length; i++) {
    const d = mul(sub(TAIL_REST[i], TAIL_REST[i - 1]), S);
    const restAng = Math.atan2(d[1], d[0]);
    const l = len(d);
    // relative turn of this segment vs the previous one, scaled by the curl, plus the travelling wave
    const turn = i === 1 ? restAng : restAng - prevRestAng;
    prevRestAng = restAng;
    ang += turn * (i === 1 ? 1 : P.tcurl);
    const wave = P.tamp * DEG * Math.sin(2 * Math.PI * P.tph - i * 0.62) * (i / (TAIL_REST.length - 1) + 0.25);
    const lift = (P.tlift * DEG * 2.2 * i) / TAIL_REST.length;
    const a = ang + wave * 0.5 + lift;
    const prev = pts[i - 1];
    pts.push([Math.max(5, prev[0] + Math.cos(a) * l), prev[1] + Math.sin(a) * l]);
  }
  return pts;
}

export function rig(P: Pose): Rig {
  const hip = add(HIP0, [P.bx + P.hipX, P.by + P.hipY]);
  const sho = add(SHO0, [P.bx + P.shX, P.by + P.shY]);
  const mid: V = [(hip[0] + sho[0]) / 2, (hip[1] + sho[1]) / 2 - P.arch];
  const back: V[] = [hip, lerpV(hip, mid, 0.55), mid, lerpV(mid, sho, 0.55), sho];
  const shoulderPt = add(sho, [3 * S, 6 * S]);
  const wristN = add(HAND_N, P.fN);
  const wristF = add(HAND_F, P.fF);
  const elbowN = ik(shoulderPt, wristN, 17 * S, 17 * S, 1);
  const elbowF = ik(add(shoulderPt, [4 * S, 0]), wristF, 17 * S, 17 * S, 1);
  const ankN = add(ANK_N, P.lN);
  const ankF = add(ANK_F, P.lF);
  const hipJ = add(hip, [2 * S, 4 * S]);
  const kneeN = ik(hipJ, ankN, 15 * S, 16 * S, -1);
  const kneeF = ik(add(hipJ, [4 * S, 0]), ankF, 15 * S, 16 * S, -1);
  const head0 = add(HEAD0, [P.bx + P.hd[0], P.by + P.hd[1]]);
  // the head never sinks into the floor (the jaw hangs ~14 px under its centre)
  const head: V = [head0[0], Math.min(head0[1], GY - 17)];
  const nb = add(sho, [8 * S, -3 * S]);
  const neck: V[] = [nb, lerpV(nb, head, 0.5), head];
  return {
    hip,
    sho,
    mid,
    back,
    elbowN,
    wristN,
    elbowF,
    wristF,
    kneeN,
    ankN,
    kneeF,
    ankF,
    head,
    neck,
    tail: tailPoints(P, add(TAIL_ROOT, [P.bx + P.hipX, P.by + P.hipY])),
    rootN: add(WROOT_N, [P.bx + P.shX * 0.8, P.by + P.shY * 0.8]),
    rootF: add(WROOT_F, [P.bx + P.shX * 0.8, P.by + P.shY * 0.8]),
  };
}

// ------------------------------------------------------------------ small helpers

const hash = (a: number, b = 0) => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

const INK = PAL.ink;

/** Cross-section value planes of a tube: a lit top band, a flat mid plane, a turned-under band. */
const planes = (top = 0.6, under = 0.55, topAt = -0.42, underAt = 0.5) => (_u: number, _v: number, _ox: number, oy: number) => (oy < topAt ? top : oy > underAt ? -under : 0);
const planesE = (top = 0.6, under = 0.55, topAt = -0.42, underAt = 0.5) => (_x: number, y: number) => (y < topAt ? top : y > underAt ? -under : 0);
const isHide = (c: number) => c === PAL.stone0 || c === PAL.stone1 || c === PAL.stone2 || c === PAL.stone3 || c === PAL.stone4;

/** Part-space shear: points drawn on the torso follow the hip / shoulder offsets. */
function bodyMap(P: Pose): (pt: V) => V {
  const dh: V = [P.bx + P.hipX, P.by + P.hipY];
  const ds: V = [P.bx + P.shX, P.by + P.shY];
  return (pt) => {
    const u = clamp((pt[0] - HIP0[0]) / (SHO0[0] - HIP0[0]), 0, 1);
    const d = lerpV(dh, ds, u);
    return [pt[0] + d[0], pt[1] + d[1] - P.arch * Math.sin(Math.PI * u) * 0.9];
  };
}

/** Ember colour for a glow level (0..1) and a spark roll. */
function emberCol(glow: number, k: number, hot: boolean): number {
  if (glow < 0.3) return hot ? PAL.fire2 : PAL.fire1;
  if (glow < 0.6) return hot ? PAL.fire3 : PAL.fire2;
  return hot && k % 4 === 0 ? PAL.fire4 : hot ? PAL.fire3 : PAL.fire2;
}

/** A jagged ember line over the hide: 4-connected (no lone pixels), in runs of ~4 px with dropouts
 *  between them, dull ends and the odd hot run (deterministic by seed). */
function emberLine(c: PixelCanvas, pts: readonly V[], P: Pose, seed: number, opt: { gap?: number; on?: (cur: number) => boolean; dim?: number; run?: number } = {}) {
  const fk = P.flick;
  const glow = clamp(P.glow * (1 - P.drain) - (opt.dim ?? 0), 0, 1);
  if (glow <= 0.02) return;
  const px: V[] = [];
  const push = (x: number, y: number) => {
    const last = px[px.length - 1];
    if (!last || last[0] !== x || last[1] !== y) px.push([x, y]);
  };
  for (let i = 1; i < pts.length; i++) {
    const a = flo(pts[i - 1]);
    const b = flo(pts[i]);
    let [x0, y0] = a;
    const dx = Math.abs(b[0] - x0);
    const dy = -Math.abs(b[1] - y0);
    const sx = x0 < b[0] ? 1 : -1;
    const sy = y0 < b[1] ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      push(x0, y0);
      if (x0 === b[0] && y0 === b[1]) break;
      const e2 = 2 * err;
      const stepX = e2 >= dy;
      const stepY = e2 <= dx;
      if (stepX) {
        err += dy;
        x0 += sx;
      }
      if (stepY) {
        err += dx;
        if (stepX) push(x0, y0); // 4-connect the diagonal step
        y0 += sy;
      }
    }
  }
  const run = opt.run ?? 3;
  const gap = opt.gap ?? 0.2;
  const n = px.length;
  for (let k = 0; k < n; k++) {
    const seg = (k / run) | 0;
    const segs = ((n - 1) / run) | 0;
    if (seg > 0 && seg < segs && hash(seed, seg) < gap) continue;
    const [x, y] = px[k];
    const cur = c.get(x, y);
    if (cur === null || cur === INK) continue;
    if (opt.on && !opt.on(cur)) continue;
    const edge = seg === 0 || seg === segs;
    const hot = !edge && hash(seed + 7 + fk * 13, seg) > 0.62 - 0.25 * glow;
    c.set(x, y, edge ? (glow > 0.3 ? PAL.fire2 : PAL.fire1) : emberCol(glow, seg, hot));
  }
}

// ------------------------------------------------------------------ the drawing

const KEEP = new Uint8Array(W * H);

/** The whole drake of one pose. */
export function drawDrake(p: PixelCanvas, P: Pose): void {
  resetPools();
  KEEP.fill(0);
  const R = rig(P);
  const map = bodyMap(P);

  tail(p, R, P);
  legHind(p, R, P, true);
  wing(p, R, P, true);
  armFront(p, R, P, true);
  torso(p, R, P, map);
  legHind(p, R, P, false);
  if (!P.wfront) wing(p, R, P, false);
  neckAndHead(p, R, P);
  armFront(p, R, P, false);
  if (P.wfront) wing(p, R, P, false);

  embers(p, R, P, map);
  p.outline(INK);
  rimsAndAsh(p, R, P);
  if (P.crumble > 0) crumble(p, P);
  tidy(p);
}

/**
 * Final calm pass (IŞ-10): a diagonal outline step and a lone mid-tone pixel read as crumbs. The
 * outline gets its missing 4-connecting corner (taken from the body side: the silhouette never
 * grows); a lone body-tone pixel takes the commonest tone around it. Embers and ash are left alone.
 */
function tidy(p: PixelCanvas): void {
  const N4: readonly V[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const fire = new Set<number>([PAL.fire0, PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4, PAL.crim0]);
  const lone = (x: number, y: number, c: number) => {
    let any = false;
    for (const [dx, dy] of N4) {
      const d = p.get(x + dx, y + dy);
      if (d === null) continue;
      any = true;
      if (d === c) return false;
    }
    return any;
  };
  const link: [number, number][] = [];
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      if (p.get(x, y) !== INK || !lone(x, y, INK)) continue;
      for (const sx of [-1, 1])
        for (const sy of [-1, 1]) {
          if (p.get(x + sx, y + sy) !== INK) continue;
          const a = p.get(x + sx, y);
          const b = p.get(x, y + sy);
          const okA = a !== null && a !== INK && !fire.has(a);
          const okB = b !== null && b !== INK && !fire.has(b);
          if (okA || okB) link.push(okA && (!okB || sx > 0 === (sy > 0)) ? [x + sx, y] : [x, y + sy]);
        }
    }
  for (const [x, y] of link) if (p.get(x, y) !== INK) p.set(x, y, INK);
  const fix: [number, number, number][] = [];
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const c = p.get(x, y);
      if (c === null || c === INK || fire.has(c) || !lone(x, y, c)) continue;
      const cnt = new Map<number, number>();
      for (const [dx, dy] of N4) {
        const d = p.get(x + dx, y + dy);
        if (d !== null && d !== INK && !fire.has(d)) cnt.set(d, (cnt.get(d) ?? 0) + 1);
      }
      let best = -1;
      let bn = 0;
      for (const [k, n] of cnt) if (n > bn) (best = k), (bn = n);
      if (best >= 0) fix.push([x, y, best]);
    }
  for (const [x, y, c] of fix) p.set(x, y, c);
}

// ---------------------------------------------------------------- torso

function torso(p: PixelCanvas, R: Rig, P: Pose, map: (pt: V) => V) {
  const g = newG();
  const [h0, h1, h2, h3, h4] = R.back;
  tubeS(g, [h0, h1, h2, h3, h4], 17, 28, M.HIDE, { flat: 2.4, biasAt: planes(0.5, 0.7, -0.45, 0.45) });
  // the haunch mass and the shoulder hump
  ellS(g, add(R.hip, [0, 1 * S]), 12, 12, 0.1, M.HIDE, { z: 1, flat: 2.4, biasEll: planesE(0.5, 0.7) });
  ellS(g, add(R.sho, [1 * S + P.humpX, -2 * S + P.humpY]), 14, 16, -0.35, M.HIDE, { z: 1, flat: 2.4, biasEll: planesE(0.55, 0.7, -0.4, 0.5) });
  // the belly's lower contour breathes (a local bulge)
  ellS(g, add(R.mid, [-1 * S, 5 / S * S]), 16, 4.2 / S + P.belly / S, 0, M.HIDE, { z: -1, flat: 2.4, biasEll: planesE(0.5, 0.7) });
  const c = g.render();
  composite(p, c, selout, { top: 1, side: 1, bottom: 1 });
  // dorsal plates along the spine: two-tone spikes standing on the back line
  const sp = newG();
  const spine = bezier(add(R.hip, [-8 * S, -9 * S]), add(R.hip, [10 * S, -12 * S]), add(R.sho, [-14 * S, -17 * S]), add(R.sho, [-2 * S, -17 * S]), 14);
  for (let i = 1; i < spine.length - 1; i++) {
    if (i % 2 === 0) continue;
    const t = norm(sub(spine[i + 1], spine[i - 1]));
    const up: V = [t[1], -t[0]];
    const upv: V = up[1] < 0 ? up : mul(up, -1);
    const L = (3.5 + 1.5 * Math.sin((i / spine.length) * Math.PI)) * S;
    const base = spine[i];
    tubeS(sp, [base, add(base, mul(norm(add(upv, mul(t, -0.5))), L))], 4.2, 1, M.PLATE, { z: 2, biasAt: (_u, _v, ox) => (ox < 0 ? 2 : 1) });
  }
  composite(p, sp.render(0, false), selout, { top: 0, side: 1, bottom: 0 });
}

// ---------------------------------------------------------------- hind leg

function legHind(p: PixelCanvas, R: Rig, P: Pose, far: boolean) {
  const hip = far ? add(R.hip, [5 * S, 2 * S]) : add(R.hip, [1 * S, 3 * S]);
  const knee = far ? R.kneeF : R.kneeN;
  const ank = far ? R.ankF : R.ankN;
  const mat = far ? M.HIDE_FAR : M.HIDE;
  const g = newG();
  tubeS(g, [hip, knee], 19, 11, mat, { flat: 2.2, biasAt: planes() });
  ellS(g, hip, far ? 9 : 10, far ? 9 : 10, 0, mat, { flat: 2.2, biasEll: planesE() });
  tubeS(g, [knee, ank], 11, 7, mat, { flat: 2.2, z: 0.5, biasAt: planes() });
  ellS(g, knee, 6, 6, 0, mat, { z: 1, flat: 2.2, biasEll: planesE() });
  // flat foot with three toes
    tubeS(g, [add(ank, [-2 * S, 0]), add(ank, [4 * S, 3 * S]), [ank[0] + 11 * S, GY - 3 * S]], 9, 6, mat, { flat: 1.3 });
  const c = g.render();
  composite(p, c, far ? selout : crease, far ? { top: 1, side: 1, bottom: 1 } : { top: 1, side: 2, bottom: 2 });
  // claws
  const fx = ank[0] + 11 * S;
  const fy = GY - 3 * S;
  const cl = newG();
  for (let i = 0; i < 3; i++) tubeS(cl, [[fx - 1 * S + i * 0.5, fy - 2 * S + i * 1.4 * S], [fx + (4 + i) * S, fy + 1 * S + i * 0.7 * S]], 3, 1, far ? M.BONE_FAR : M.HORN, { z: 2 });
  composite(p, cl.render(0, false), selout, { top: 0, side: 1, bottom: 0 });
}

// ---------------------------------------------------------------- forelimb

function armFront(p: PixelCanvas, R: Rig, P: Pose, far: boolean) {
  const sh = far ? add(R.sho, [7 * S, 6 * S]) : add(R.sho, [2 * S, 7 * S]);
  const el = far ? R.elbowF : R.elbowN;
  const wr = far ? R.wristF : R.wristN;
  const mat = far ? M.HIDE_FAR : M.HIDE;
  const g = newG();
  tubeS(g, [sh, el], far ? 13 : 16, far ? 9 : 11, mat, { flat: 2.2, biasAt: planes() });
  ellS(g, el, far ? 6 : 7, far ? 6 : 7, 0, mat, { z: 1, flat: 2.2, biasEll: planesE() });
  tubeS(g, [el, wr], far ? 10 : 12, far ? 7 : 9, mat, { flat: 2.2, z: 0.5, biasAt: planes() });
  // the fist: a knuckle ball on the floor
  const fist = add(wr, [2 * S, 1 * S]);
  ellS(g, fist, far ? 6 : 7, far ? 5 : 6, 0, mat, { z: 1.5, flat: 2.2, biasEll: planesE() });
  const c = g.render();
  composite(p, c, far ? selout : crease, far ? { top: 1, side: 1, bottom: 1 } : { top: 1, side: 2, bottom: 2 });
  // three claws
  const spread = P.claw;
  const cl = newG();
  const base = add(fist, [4 * S, -1 * S]);
  for (let i = 0; i < 3; i++) {
    const a0: V = [base[0] + i * 0.2, base[1] - 1.5 * S + i * 2 * S];
    const tip: V = [base[0] + (6 + spread * 3 + i * 0.4) * S, base[1] + (3 + i * 1.7 + spread * (i - 1) * 2) * S];
    tubeS(cl, [a0, [lerp(a0[0], tip[0], 0.5), lerp(a0[1], tip[1], 0.5) - 0.5], tip], 3.4, 1, far ? M.BONE_FAR : M.HORN, { z: 2 });
  }
  composite(p, cl.render(0, false), selout, { top: 0, side: 1, bottom: 0 });
}

// ---------------------------------------------------------------- neck + head

function neckAndHead(p: PixelCanvas, R: Rig, P: Pose) {
  const g = newG();
  tubeS(g, R.neck, 21, 17, M.HIDE, { flat: 2.4, biasAt: planes(0.5, 0.7) });
  composite(p, g.render(), crease, { top: 1, side: 2, bottom: 2 });
  head(p, R.head, P);
}

type P2 = [number, number];
const SKULL: P2[] = [[-5, 0], [-5.5, -4], [-2, -8], [3, -10], [8, -9.5], [12, -7.5], [17, -6], [21, -5], [24, -3.4], [25.5, -1], [25, 1.8], [23, 3], [14, 3.2], [3, 3.6], [-2, 3]];
const JAW: P2[] = [[-3.5, 3], [22.5, 3], [23.5, 3.4], [22, 5.5], [17, 7.6], [9, 8.8], [0, 8.4], [-4.5, 6.4]];
const TOP: P2[] = [[-6, -11], [24, -11], [26, -5.2], [20, -4.6], [14, -5], [9, -6], [4, -6.2], [-1, -4.6]];
const CHEEK: P2[] = [[-6, -0.5], [4, -1], [9, 1.2], [3, 3.8], [-6, 3.8]];
const BROW: P2[] = [[2, -6.3], [10, -6.8], [14, -5.2]];
const HINGE: V = [-2, 3];

const HS = 1.22 * S;

function head(p: PixelCanvas, hp: V, P: Pose) {
  const T = (x: number, y: number): V => add(hp, rotV([x * HS, y * HS], P.ha));
  const jawA = P.jaw * 0.62;
  const J = (x: number, y: number): V => {
    const qv = add(HINGE, rotV(sub([x, y], HINGE), jawA));
    return T(qv[0], qv[1]);
  };
  const Ts = (pts: P2[]) => pts.map(([x, y]) => T(x, y));
  const Js = (pts: P2[]) => pts.map(([x, y]) => J(x, y));
  const open = P.jaw > 0.08;

  // horns first (behind the head): the far horn darker and higher, the near horn long and swept back
  {
    const far = newG();
    tubeS(far, bezier(T(0, -8), T(-5, -13), T(-11, -14.5), T(-17, -12.5), 10), 4.5, 1, M.HIDE_FAR, { flat: 1.2 });
    composite(p, far.render(0, false), selout, { top: 1, side: 1, bottom: 1 });
  }

  // mouth cavity
  const mouth = newG();
  if (open) {
    gFacet(mouth, [T(-2, 3), T(23, 3), J(23, 3), J(-2, 3)], M.MOUTH, FLAT_N, 0);
    const c = mouth.render(0, false);
    const m = lerpV(T(14, 3), J(14, 3), 0.5);
    const back = T(-1, 3);
    const front = T(23, 3);
    const axis = sub(front, back);
    const al = len(axis) || 1;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!c.isOpaque(x, y)) continue;
        const along = (((x + 0.5 - back[0]) * axis[0] + (y + 0.5 - back[1]) * axis[1]) / (al * al));
        const dm = len(sub([x + 0.5, y + 0.5], m));
        let col: number = along < 0.4 ? PAL.ink : PAL.night0;
        const g2 = P.glow * (1 - P.drain) + P.spill;
        if (g2 > 0.55) {
          if (dm < 2.2 && P.spill > 0.3) col = PAL.fire4;
          else if (dm < 3.6) col = PAL.fire3;
          else if (along > 0.35) col = PAL.fire2;
          else col = PAL.fire1;
        } else if (along > 0.45) col = PAL.fire0;
        c.set(x, y, col);
      }
    composite(p, c, () => INK, { top: 0, side: 0, bottom: 0 });
  }

  // lower jaw
  {
    const g = newG();
    gFacet(g, Js(JAW), M.HIDE_D, FLAT_N, 0, 2);
    // lit chin
    gFacet(g, Js([[17, 3.6], [23.2, 3.6], [22.4, 5.6], [17.5, 7.2]]), M.HIDE_D, FLAT_N, 1, 3);
    const c = g.render(0, false);
    const dn = rotV([0, 1], P.ha + jawA);
    const hits: number[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!c.isOpaque(x, y) || c.get(x, y) !== PAL.stone2) continue;
        if (!c.isOpaque(x + Math.round(dn[0]), y + Math.round(dn[1]))) hits.push(x, y);
      }
    for (let i = 0; i < hits.length; i += 2) c.set(hits[i], hits[i + 1], PAL.stone1);
    composite(p, c, (_x, _y, b) => (open ? INK : b === PAL.stone2 || b === PAL.stone3 ? PAL.stone0 : selout(_x, _y, b)), { top: 1, side: 1, bottom: 1 });
  }

  // upper head: stone2 side plane, stone3 top plane, stone1 cheek wedge
  const g = newG();
  gFacet(g, Ts(SKULL), M.HIDE_D, FLAT_N, 0, 2);
  const sk = g.render(0, false);
  const inSkull = (x: number, y: number) => sk.isOpaque(x, y);
  fillPoly(Ts(TOP), (x, y) => inSkull(x, y) && g.put(x, y, M.HIDE_D, 0, 0, 1, 1, 3));
  fillPoly(Ts(CHEEK), (x, y) => inSkull(x, y) && g.put(x, y, M.HIDE_D, 0, 0, 1, 2, 1));
  const c = g.render(0, false);
  for (let i = 1; i < BROW.length; i++) lineOn(c, T(...BROW[i - 1]), T(...BROW[i]), PAL.stone0);
  // nostril
  const nos = flo(T(22.5, -1.6));
  c.paint(nos[0], nos[1], PAL.stone0);
  // the lip line under the snout when closed
  if (!open) lineOn(c, T(2, 2.6), T(23, 2.8), PAL.stone0, (cur) => cur === PAL.stone2 || cur === PAL.stone1);
  composite(p, c, selout, { top: 1, side: 1, bottom: 1 });

  // near horn: bone-ash bands, swept back and up with a hooked tip
  {
    const band = (_u: number, _v: number, _ox: number, oy: number) => (oy < -0.4 ? 3 : oy > 0.3 ? 1 : 2);
    const hg = newG();
    tubeS(hg, bezier(T(1.5, -8.2), T(-4, -12), T(-11, -13), T(-18, -9), 10), 5, 1, M.HORN_D, { biasAt: band });
    composite(p, hg.render(0, false), selout, { top: 1, side: 1, bottom: 1 });
    // brow spike
    const bs = newG();
    tubeS(bs, [T(9, -9), T(12, -13.5), T(15.5, -15)], 3.4, 1, M.HORN_D, { biasAt: band });
    composite(p, bs.render(0, false), selout, { top: 1, side: 1, bottom: 1 });
    // jaw spur
    const js = newG();
    tubeS(js, [J(2, 7.4), J(-1.5, 11.5), J(-4.5, 13)], 3.6, 1, M.HORN_D, { biasAt: band });
    composite(p, js.render(0, false), selout, { top: 1, side: 1, bottom: 1 });
  }

  // eye: an ember slit under the brow
  {
    const e = flo(T(8.5, -4.6));
    const glow = P.glow * (1 - P.drain);
    const lit = glow > 0.6 || P.flare > 0.5;
    const rows =
      P.eye > 0.75 ? (P.flare > 0.5 ? ['0eee0', '3eww3', '03330'] : ['0333', '2e3.', '.22.']) : P.eye > 0.25 ? ['0333', '.22.'] : ['0000', '.00.'];
    const keyc: Record<string, number> = { '0': PAL.stone0, '2': PAL.fire2, '3': lit ? PAL.fire3 : PAL.fire2, e: PAL.fire4, w: PAL.white, '.': -1 };
    for (let j = 0; j < rows.length; j++)
      for (let i = 0; i < rows[j].length; i++) {
        const col = keyc[rows[j][i]];
        if (col === undefined || col < 0) continue;
        const x = e[0] + i;
        const y = e[1] + j;
        if (p.isOpaque(x, y) && p.get(x, y) !== INK) {
          p.set(x, y, col);
          KEEP[y * W + x] = 1;
        }
      }
  }

  // teeth
  if (open) {
    const dn = rotV([0, 1], P.ha);
    const up = rotV([0, -1], P.ha + jawA);
    for (const tx of [8, 12, 16, 20]) {
      const a = flo(T(tx, 3.4));
      for (let k = 0; k < 3; k++) {
        const x = Math.round(a[0] + dn[0] * k);
        const y = Math.round(a[1] + dn[1] * k);
        const cur = p.get(x, y);
        if (cur !== null && cur !== INK && !isHide(cur)) p.set(x, y, k === 2 ? PAL.stone3 : PAL.stone4);
      }
    }
    for (const tx of [11, 17]) {
      const a = flo(J(tx, 2.6));
      for (let k = 0; k < 2; k++) {
        const x = Math.round(a[0] + up[0] * k);
        const y = Math.round(a[1] + up[1] * k);
        const cur = p.get(x, y);
        if (cur !== null && cur !== INK && !isHide(cur)) p.set(x, y, PAL.stone4);
      }
    }
  }
}

// ---------------------------------------------------------------- tail

function tail(p: PixelCanvas, R: Rig, P: Pose) {
  const pts = R.tail;
  const g = newG();
  tubeS(g, pts, 12, 4, M.HIDE, { flat: 2.4, bias: -0.12, biasAt: planes(0.5, 0.6) });
  composite(p, g.render(), selout, { top: 1, side: 1, bottom: 1 });
  // dorsal spikes along the upper edge
  const sp = newG();
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1];
    const b = pts[i + 1];
    const t = norm(sub(b, a));
    const up: V = [-t[1], t[0]]; // the side that faces up while the tail runs left
    const w = (lerp(12, 4, i / (pts.length - 1)) / 2) * S;
    const base = add(pts[i], mul(up, w - 1));
    const L = lerp(7, 3.5, i / (pts.length - 1)) * S;
    tubeS(sp, [base, add(base, mul(norm(add(up, mul(t, -0.45))), L))], 4, 1, M.HORN, { z: 2, bias: -0.2 });
  }
  composite(p, sp.render(0, false), selout, { top: 0, side: 1, bottom: 0 });
  // the club: a knot of bone with four spikes
  const tip = pts[pts.length - 1];
  const tb = norm(sub(tip, pts[pts.length - 3]));
  const cg = newG();
  ellS(cg, add(tip, mul(tb, 3 * S)), 5.5, 5, 0, M.HIDE, { z: 2, flat: 1.1 });
  for (let k = 0; k < 4; k++) {
    const a = Math.atan2(tb[1], tb[0]) + (k - 1.5) * 0.95;
    const d: V = [Math.cos(a), Math.sin(a)];
    const base = add(add(tip, mul(tb, 3 * S)), mul(d, 3.5 * S));
    tubeS(cg, [base, add(base, mul(d, 6 * S))], 4, 1, M.HORN, { z: 3 });
  }
  composite(p, cg.render(0, false), selout, { top: 1, side: 1, bottom: 1 });
}

// ---------------------------------------------------------------- wings

function wingGeom(w: Wing, root: V) {
  const wrist = add(root, [w.wx * S, w.wy * S]);
  const tips: V[] = w.a.map((a, i) => add(wrist, polar(a, w.l[i] * S)));
  return { root, wrist, tips };
}

/** Torn-hole shapes of the membrane, in (panel, along, across) coordinates (0..1) so they follow the wing. */
const HOLES: { panel: 0 | 1; at: number; across: number; r: number }[] = [
  { panel: 1, at: 0.62, across: 0.45, r: 3.2 },
  { panel: 0, at: 0.78, across: 0.35, r: 2.4 },
  { panel: 1, at: 0.36, across: 0.62, r: 2.2 },
];

function wing(p: PixelCanvas, R: Rig, P: Pose, far: boolean) {
  const w = far ? P.fw : P.nw;
  const root = far ? R.rootF : R.rootN;
  const { wrist, tips } = wingGeom(w, root);
  const matM = far ? M.MEMB_FAR : M.MEMB;
  const matB = far ? M.BONE_FAR : M.BONE;
  const fl = (((P.flick + (far ? 1 : 0)) % 3) - 1) * 0.6;
  // membrane outline: wrist → tip 1 → torn scallop → tip 2 → torn scallop → tip 3 → body
  const edge: V[] = [wrist, tips[0]];
  const rag = (k: number, i: number) => hash(k * 31 + i, far ? 5 : 9);
  for (let i = 0; i < 2; i++) {
    const a = tips[i];
    const b = tips[i + 1];
    const m = lerpV(a, b, 0.5);
    const inward = norm(sub(wrist, m));
    const dep = w.sag * S;
    const spike = (t: number, d: number): V => add(lerpV(a, b, t), mul(inward, d));
    edge.push(spike(0.16, dep * (0.7 + rag(i, 1) * 0.5)));
    edge.push(spike(0.28, dep * 0.15));
    edge.push(spike(0.4, dep * (1.5 + rag(i, 2) + fl * 0.4)));
    edge.push(spike(0.52, dep * 0.25));
    edge.push(spike(0.64, dep * (0.9 + rag(i, 3) * 0.6)));
    edge.push(spike(0.78, dep * 0.1));
    edge.push(spike(0.9, dep * (0.6 + fl * 0.3)));
    edge.push(b);
  }
  edge.push(add(lerpV(tips[2], root, 0.35), [0, 1]));
  edge.push(root);

  const g = newG();
  const mask = newG();
  gFacet(mask, edge, matM, FLAT_N, 0);
  const full = mask.render(0, false);
  fillPoly(edge, (x, y) => {
    if (!full.isOpaque(x, y)) return;
    const pt: V = [x + 0.5, y + 0.5];
    const sideOf = (a: V, b: V) => (b[0] - a[0]) * (pt[1] - a[1]) - (b[1] - a[1]) * (pt[0] - a[0]);
    // panel 0: between finger 1 and 2; panel 1: between finger 2 and 3; panel 2: root side of finger 3
    const s01 = sideOf(wrist, tips[1]);
    const s12 = sideOf(wrist, tips[2]);
    const k = s01 < 0 ? 0 : s12 < 0 ? 1 : 2;
    const nz: [number, number, number] = k === 0 ? [-0.2, -0.4, 0.9] : k === 1 ? [0.05, 0.05, 1] : [0.2, 0.25, 0.9];
    // a darker 2-px band along every finger bone, so the skin folds under the bone
    const d = Math.min(distSeg(pt, wrist, tips[0]), distSeg(pt, wrist, tips[1]), distSeg(pt, wrist, tips[2]));
    g.put(x, y, matM, nz[0], nz[1], nz[2], 0, d < 3.2 ? -0.45 : 0);
  });
  const memb = g.render(0, false);
  // torn holes: the flank shows through, a glowing rim stays
  const holes: V[][] = HOLES.map((h) => {
    const a0 = tips[h.panel];
    const a1 = tips[h.panel + 1];
    const edgeP = lerpV(a0, a1, h.across);
    const c: V = lerpV(wrist, edgeP, h.at);
    const r = h.r * S;
    return [add(c, [-r, 0]), add(c, [-r * 0.3, -r * 0.9]), add(c, [r * 0.8, -r * 0.4]), add(c, [r, r * 0.5]), add(c, [0, r * 0.9]), add(c, [-r * 0.8, r * 0.5])];
  });
  const holeMask = new Set<number>();
  for (const hp of holes) fillPoly(hp, (x, y) => holeMask.add(y * W + x));
  for (const k of holeMask) {
    const x = k % W;
    const y = (k / W) | 0;
    memb.erase(x, y);
  }
  const glowRim = P.glow * (1 - P.drain);
  for (const k of holeMask) {
    const x = k % W;
    const y = (k / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (holeMask.has(ny * W + nx) || !memb.isOpaque(nx, ny)) continue;
      memb.set(nx, ny, glowRim > 0.55 ? PAL.fire3 : glowRim > 0.25 ? PAL.fire2 : PAL.fire1);
    }
  }
  composite(p, memb, far ? selout : crease, { top: 1, side: 1, bottom: 1 });

  // ember veins inside the membrane: a dotted line a few px off each finger bone
  for (let i = 0; i < 3; i++) {
    const a = lerpV(wrist, tips[i], 0.18);
    const b = lerpV(wrist, tips[i], 0.9);
    const off: V = i === 0 ? [0, 3] : [-2, 2.5];
    emberLine(p, [add(a, off), add(b, off)], P, 71 + i + (far ? 20 : 0), { on: (cur) => cur === PAL.fire0 || cur === PAL.crim0 || cur === PAL.fire1, gap: 0.45, dim: far ? 0.2 : 0 });
  }

  // bones: upper arm to the wrist, three fingers, thumb claw
  const bg = newG();
  tubeS(bg, [root, wrist], 4, 3.4, matB, { flat: 2.2, z: 3 });
  ellS(bg, wrist, 3, 3, 0, matB, { z: 4, flat: 2.2 });
  for (let i = 0; i < 3; i++) tubeS(bg, [wrist, tips[i]], 2.6 - i * 0.2, 1, matB, { flat: 2.2, z: 3 });
  const th = polar(-60, w.thumb * S);
  tubeS(bg, [add(wrist, [1, -1]), add(wrist, th)], 3, 1, far ? M.BONE_FAR : M.HORN, { z: 5 });
  composite(p, bg.render(0, false), selout, { top: 1, side: 1, bottom: 1 });
}

// ---------------------------------------------------------------- embers, rims, ash

function embers(p: PixelCanvas, R: Rig, P: Pose, map: (pt: V) => V) {
  // ribs under the cloak: four arcs on the near flank
  for (let i = 0; i < 4; i++) {
    const x = 52 + i * 6.5;
    const pts = bezier(map(q(x, 34)), map(q(x + 4, 28)), map(q(x + 6, 21)), map(q(x + 3, 15)), 8);
    emberLine(p, pts, P, 11 + i, { on: isHide, gap: 0.3 });
  }
  // haunch cracks
  emberLine(p, [map(q(30, 33)), map(q(34, 28)), map(q(32, 22)), map(q(37, 17))], P, 31, { on: isHide });
  emberLine(p, [map(q(40, 35)), map(q(44, 30)), map(q(43, 25))], P, 37, { on: isHide, gap: 0.25 });
  // shoulder crack
  emberLine(p, [map(q(72, 26)), map(q(76, 21)), map(q(73, 16))], P, 41, { on: isHide, gap: 0.25 });
  // spine seam, neck, tail root, far haunch, forearm
  emberLine(p, [map(q(44, 44)), map(q(52, 46)), map(q(60, 49)), map(q(68, 53))], P, 51, { on: isHide, gap: 0.3 });
  emberLine(p, [add(R.sho, [10 * S, -2 * S]), add(R.sho, [15 * S, 1 * S]), add(R.head, [-6 * S, -2 * S])], P, 52, { on: isHide, gap: 0.2 });
  emberLine(p, [add(R.hip, [-10 * S, -3 * S]), add(R.hip, [-14 * S, 2 * S]), add(R.hip, [-18 * S, 3 * S])], P, 53, { on: isHide, gap: 0.2 });
  emberLine(p, [add(R.elbowN, [-1, 2]), add(R.elbowN, [3, 6]), add(R.wristN, [-2, -2])], P, 54, { on: isHide, gap: 0.25 });
  emberLine(p, [add(R.kneeN, [-2, 0]), add(R.kneeN, [-4, 5]), add(R.ankN, [0, -3])], P, 55, { on: isHide, gap: 0.25 });
}

function rimsAndAsh(p: PixelCanvas, R: Rig, P: Pose) {
  // the lighter mid-tone band: a lit edge line on the key-light side of the hide
  edgePaint(p, PAL.stone3, null, { only: (c) => c === PAL.stone2 || c === PAL.stone1, lit: 0.5 });
  // ash drifting off the back: 1–2 px flakes in three greys, rising and sliding back
  ash(p, R, P);
  spill(p, P);
}

/** The roar's ember spill: sparks fall out of the open jaws in an arc, splash on the floor and pool there. */
function spill(p: PixelCanvas, P: Pose) {
  if (P.spill <= 0.05) return;
  const m = mouthPoint(P);
  const n = Math.max(2, Math.round(8 * P.spill));
  const put = (x: number, y: number, c: number) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H || p.isOpaque(x, y)) return;
    p.set(x, y, c);
  };
  for (let k = 0; k < n; k++) {
    const t = (P.spillT + k / n) % 1;
    const reach = 5 + (k % 3) * 3;
    const x = m[0] + 1 + t * reach;
    const y = m[1] + 2 + t * t * (GY - 2 - m[1]);
    const c = t < 0.2 ? PAL.fire4 : t < 0.5 ? PAL.fire3 : t < 0.8 ? PAL.fire2 : PAL.fire1;
    put(x, y, c);
    if (t < 0.6) put(x, y - 1, c);
    if (t > 0.85) {
      put(x - 1, GY - 1, PAL.fire2);
      put(x + 1, GY - 1, PAL.fire3);
    }
  }
  // the pool on the floor under the jaws
  if (P.spill > 0.5) for (let i = 0; i < 9; i++) put(m[0] - 2 + i, GY - 1, i % 3 === 1 ? PAL.fire3 : PAL.fire2);
}

function ash(p: PixelCanvas, R: Rig, P: Pose) {
  if (P.smoke <= 0) return;
  const emit: V[] = [add(R.mid, [-6 * S, -17 * S]), add(R.sho, [-2 * S, -20 * S]), add(R.hip, [-4 * S, -15 * S])];
  const n = 4;
  const nos = mouthPoint(P);
  emit.push(add(nos, [2, -7]));
  for (let e = 0; e < emit.length; e++)
    for (let k = 0; k < n; k++) {
      const t = (P.ash + k / n + e * 0.21) % 1;
      const x = emit[e][0] - t * 16 + Math.sin(t * 9 + e * 2 + k) * 2.2;
      const y = emit[e][1] - t * 20;
      const col = t < 0.3 ? PAL.stone3 : t < 0.65 ? PAL.stone2 : PAL.stone1;
      const xi = Math.round(x);
      const yi = Math.round(y);
      if (t > 0.92) continue;
      if (p.isOpaque(xi, yi)) continue;
      p.set(xi, yi, col);
      if (t < 0.5) p.set(xi + 1, yi, col);
    }
}

/** Death / revive: the body crumbles into ash from the top down; the flakes fall and settle as a low heap. */
function crumble(p: PixelCanvas, P: Pose) {
  const c = P.crumble;
  let y0 = H;
  let y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (p.isOpaque(x, y)) (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
  if (y1 <= y0) return;
  const gone: number[] = [];
  for (let y = y0; y <= y1; y++)
    for (let x = 0; x < W; x++) {
      if (!p.isOpaque(x, y)) continue;
      const u = (y - y0) / (y1 - y0 || 1);
      const key = hash(x >> 1, (y >> 1) + 977);
      if (y >= GY - 3) continue;
      if (key < c * 1.35 - u * 0.55) gone.push(x, y, (key * 1000) | 0);
    }
  const col: number[] = [];
  for (let i = 0; i < gone.length; i += 3) col.push(p.get(gone[i], gone[i + 1]) as number);
  for (let i = 0; i < gone.length; i += 3) p.erase(gone[i], gone[i + 1]);
  // the flakes: some still falling, most already settled on the floor
  for (let i = 0; i < gone.length; i += 3) {
    const x = gone[i];
    const y = gone[i + 1];
    const k = gone[i + 2] / 1000;
    const warm = col[i / 3] === PAL.fire3 || col[i / 3] === PAL.fire2 || col[i / 3] === PAL.fire4;
    if (k < 0.55) continue; // a share of the chunks just vanishes
    const fall = Math.min(GY - 2 - y, Math.round((0.25 + k) * c * 34));
    const nx = x + Math.round((k - 0.75) * 10 * c);
    const ny = y + fall;
    if (p.isOpaque(nx, ny)) continue;
    const settled = ny >= GY - 3;
    p.set(nx, ny, warm && P.drain < 0.8 ? PAL.fire1 : settled ? (k > 0.85 ? PAL.stone2 : PAL.stone1) : k > 0.8 ? PAL.stone2 : PAL.stone1);
  }
}

// ------------------------------------------------------------------ points

export function mouthPoint(P: Pose): V {
  const R = rig(P);
  const T = (x: number, y: number): V => add(R.head, rotV([x * HS, y * HS], P.ha));
  const jawA = P.jaw * 0.62;
  const Jp = (x: number, y: number): V => {
    const qv = add(HINGE, rotV(sub([x, y], HINGE), jawA));
    return T(qv[0], qv[1]);
  };
  return lerpV(T(21, 3), Jp(21, 3), 0.5);
}

export { distPoly, rnd };
