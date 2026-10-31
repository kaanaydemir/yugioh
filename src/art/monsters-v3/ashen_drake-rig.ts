// Kül Ejderi (ashen_drake) v3 — the rig: AshenPose → skeleton → pixels (docs/v3/kart-a/ashen_drake.md §1.2, §3).
//
// A hunched vulture perch made of compressed ash: hips → spine → the rib cage (bars over a night0
// cavity, the ember heart behind them) → the S-neck (3 segments) → the skull hanging out forward and
// DOWN from under the hood; two tarsi down to fixed gripping talons; a 6-link tail curling up into the
// brazier; and the two cloaks (ashen_drake-cloak.ts) hunched up over the shoulders. Back to front:
// far cloak, tail, far leg, rib cage + spine, near leg, neck + skull, crest, near cloak, spurs.
// Then the single ink outline, the void2 rim (shadow side), and the light pass (ashen_drake-ember.ts:
// heart, rib-gap leaks, hem lip, eyes, throat, brazier, spill) which is never outlined (IŞ-9).
// Frame 120 × 104, anchor (52, 99), 1 art px = 1 game px.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { Workspace, add, cleanCrumbs, composite, fillPoly, lerp, lerpV, mul, n3, norm, polar, rimLight, sub, type Light, type V, type V3 } from '../rigkit';
import { CREASE, GY, H, M, MATS, SEAM, W, darker, hash } from './ashen_drake-gbuf';
import { PLATES, cloakShape, drawCloak, peakEdge, plateCenter, plateRank, spurPts, type CloakDraw, type PlateState, type WingPose } from './ashen_drake-cloak';
import { emberPass, type EmberCtx } from './ashen_drake-ember';

export type { WingPose } from './ashen_drake-cloak';

export interface AshenPose {
  /** whole body offset (hips → head); the talons stay */
  body: [number, number];
  /** px the hood mass rises (chest, cloaks, wrists, spurs): the breath */
  breath: number;
  /** neck segment angle offsets (deg), root → head */
  neck: [number, number, number];
  /** mid neck + skull slide (px, x) and the skull's own extra offset */
  neckSlide: number;
  head: [number, number];
  /** deg, + = the snout further down */
  headPitch: number;
  jaw: number;
  /** 0 shut, 1 lit, 2 blaze */
  eye: number;
  /** crest: 0 rest, + flared up, − streamed back */
  crest: number;
  /** 0 dull … 1 rest … 2 white */
  heat: number;
  /** heart shape: 0 rest, 1 LUB (5×4), 2 DUB (4×3), 3 relax (below rest), 4 skip (one tone down) */
  beat: number;
  ribSpread: number;
  /** 0…1 the bars flex open (the spill) */
  ribFlex: number;
  wingN: WingPose;
  wingF: WingPose;
  /** plates seated, in ASHEN_ORDER (44 = the whole cloak) */
  seated: number;
  /** plates [weld, seated) of the order carry the 1-frame fire2 weld; −1 none */
  weld: number;
  /** torn-plate chips streaming into the ribs: 0 none … 1 (attack f2–f4) */
  chips: number;
  /** lift of the three hem flakes (0 seated … 3 px) */
  flakes: [number, number, number];
  /** three more hem flakes (the far side of the hem) */
  flakes2: [number, number, number];
  /** hem shimmer phase (0…1) */
  shimmer: number;
  /** 0 none, 1 pouring, 2 down the talons, 3 cooled fan (3–4 embers), 3.5 the held, cooler fan (1–2) */
  spill: number;
  /** which spill (each moment pours its own way): 0 attack, 1 roar, 2 summon, 3 victory */
  spillKind: number;
  /** near talon: 0 gripping, 1 stepped back and in */
  talon: number;
  /** [curl, sweep] px of the tail */
  tail: [number, number];
  /** brazier flame phase 0…1 (5 frames a cycle) */
  brazier: number;
  /** nostril smoke 0 none, else its curl phase (0…1] */
  smoke: number;
  /** summon: bones exist only at or below this frame row (0 = all) */
  boneTop: number;
  /** death 0 … 1 (crumble front from the crest down) */
  crumble: number;
  /** death: px the heart has dropped */
  drop: number;
  /** revive: the art's own heap 0 none … 1 the whole heap */
  heap: number;
  /** a smear stretches behind the skull (attack release) */
  smear: number;
  /** the far cloak's breath relative to `breath` (the idle's 1-frame lag) */
  breathLag: number;
  /** the chest's (cage, neck root) lift relative to `breath` (the idle's 2-frame lag) */
  chestLag: number;
  /** the bare hand: 1 the fingers fan out (a stripped bat hand), 0 they lie inside the cloak's outline */
  strutFan: number;
  /** plate order: 0 the accretion order (hem first), 1 reversed (wrist first: the revive) */
  order: number;
}

const WING0: WingPose = { wrist: [0, 0], open: 0, mantle: 0, cocoon: 0, spread: 0, ripple: -1 };

export const NEUTRAL: AshenPose = {
  body: [0, 0],
  breath: 0,
  neck: [0, 0, 0],
  neckSlide: 0,
  head: [0, 0],
  headPitch: 0,
  jaw: 0,
  eye: 1,
  crest: 0,
  heat: 1,
  beat: 0,
  ribSpread: 0,
  ribFlex: 0,
  wingN: { ...WING0, wrist: [0, 0] },
  wingF: { ...WING0, wrist: [0, 0] },
  seated: 44,
  weld: -1,
  chips: 0,
  flakes: [0, 0, 0],
  flakes2: [0, 0, 0],
  shimmer: 0,
  spill: 0,
  spillKind: 0,
  talon: 0,
  tail: [0, 0],
  brazier: 0,
  smoke: 0,
  boneTop: 0,
  crumble: 0,
  drop: 0,
  heap: 0,
  smear: 0,
  order: 0,
  strutFan: 1,
  breathLag: 0,
  chestLag: 0,
};

// ------------------------------------------------------------------ the skeleton

export interface Rig {
  readonly hip: V;
  /** neck chain: root … skull joint */
  readonly neck: readonly V[];
  /** skull joint and its axis (unit, snout direction) */
  readonly skull: V;
  readonly axis: V;
  readonly heart: V;
  readonly cage: V;
  readonly mouth: V;
  readonly eye: V;
  readonly tail: readonly V[];
  readonly ankleN: V;
  readonly ankleF: V;
  readonly heelN: V;
  readonly heelF: V;
  readonly ribs: readonly (readonly V[])[];
  readonly keel: readonly V[];
  readonly spine: readonly V[];
  readonly hoodOff: V;
}

/** fixed talons (HA-9): the near foot's ankle and the far one */
const ANKLE_N: V = [55, 92];
const ANKLE_F: V = [47, 91];
const NECK_ROOT: V = [61, 47];
const NECK_A: readonly number[] = [-36, 6, 80];
const NECK_L: readonly number[] = [9, 8, 10];
const PITCH0 = 34;
/** skull scale (skull space → px) */
const SKULL_K = 1.22;
const TAIL_ROOT: V = [41, 80];
const TAIL_A: readonly number[] = [160, 165, 178, 200, 245, 285];
const TAIL_L: readonly number[] = [7, 7, 6, 5, 4, 3];

export function rig(P: AshenPose): Rig {
  const b: V = P.body;
  const lift = P.breath + P.chestLag;
  const hood: V = [b[0], b[1] - lift];
  const root = add(NECK_ROOT, b);
  const neck: V[] = [root];
  for (let i = 0; i < 3; i++) {
    let pt = add(neck[i], polar(NECK_A[i] + P.neck[i], NECK_L[i]));
    if (i === 1) pt = add(pt, [P.neckSlide, 0]);
    neck.push(pt);
  }
  // the breath lifts the neck's root with the chest; the lift fades along the neck (the skull stays)
  for (let i = 0; i < 3; i++) neck[i] = add(neck[i], [0, -lift * (1 - i / 3)]);
  const skull = add(neck[3], P.head);
  const pitch = (PITCH0 + P.headPitch) * (Math.PI / 180);
  const axis: V = [Math.cos(pitch), Math.sin(pitch)];
  const toS = (x: number, y: number): V => add(skull, [(axis[0] * x - axis[1] * y) * SKULL_K, (axis[1] * x + axis[0] * y) * SKULL_K]);
  const mouth = toS(17, 2.5 + P.jaw * 3);
  const eye = toS(6.5, -1.2);
  const cage = add([56, 59], hood);
  const heart = add(add([56, 59], hood), [0, P.drop]);
  // tail: root on the hips, curls up at the end into the brazier
  const tr = add(TAIL_ROOT, mul(b, 0.6));
  const tail: V[] = [tr];
  for (let i = 0; i < TAIL_A.length; i++) {
    const k = i / (TAIL_A.length - 1);
    const a = TAIL_A[i] + P.tail[1] * (0.3 + k) * 4 - P.tail[0] * k * 10;
    tail.push(add(tail[i], polar(a, TAIL_L[i])));
  }
  const heelN = add([51, 80], mul(b, 0.8));
  const heelF = add([44, 79], mul(b, 0.8));
  // the rib cage: spine (back) and keel (front), 5 bars between them
  const sp = P.ribSpread;
  const spine: V[] = [add([51, 46], hood), add([48, 57], hood), add([47, 70], hood)];
  const keel: V[] = [add([62, 47], hood), add([66 + sp * 0.5, 57], hood), add([64 + sp * 0.5, 66], hood), add([59, 72], hood)];
  const ribs: V[][] = [];
  for (let i = 0; i < 5; i++) {
    const t = 0.1 + i * 0.2;
    const s0 = lerpV(spine[0], spine[2], t);
    const k0 = i < 4 ? lerpV(keel[0], keel[2], 0.05 + i * 0.3) : keel[3];
    const bow = add(lerpV(s0, k0, 0.55), [sp * 0.6 + P.ribFlex * (i - 2) * 0.4, 3.2 + i * 0.3 + sp * 0.4]);
    ribs.push([s0, bow, k0]);
  }
  return {
    hip: add([45, 74], b),
    neck,
    skull,
    axis,
    heart,
    cage,
    mouth,
    eye,
    tail,
    ankleN: P.talon ? add(ANKLE_N, [-2 * P.talon, 0]) : ANKLE_N,
    ankleF: ANKLE_F,
    heelN,
    heelF,
    ribs,
    keel,
    spine,
    hoodOff: hood,
  };
}

/**
 * A cloak's posed wing and offset: the body moves the whole cloak; the breath lifts its wrist peak
 * (fading to the hem) rather than the whole cloak, so the hood swells without the plates' texture
 * sliding (the far cloak a frame late: breathLag).
 */
export function cloakPose(P: AshenPose, wing: 'N' | 'F'): { w: WingPose; off: V } {
  const w = wing === 'N' ? P.wingN : P.wingF;
  const b = P.breath + (wing === 'F' ? P.breathLag : 0);
  return { w: { ...w, wrist: [w.wrist[0], w.wrist[1] - b] }, off: P.body };
}

/** skull space → frame */
export function skullPt(R: Rig, x: number, y: number): V {
  const k = SKULL_K;
  return add(R.skull, [(R.axis[0] * x - R.axis[1] * y) * k, (R.axis[1] * x + R.axis[0] * y) * k]);
}

// ------------------------------------------------------------------ parts

const WS = new Workspace(W, H, { from: 'left', v: [0, 0, 1], v2: [0, -1], side: -1, lift: 0, lx: (d: number) => d } as Light, MATS);

/** biasAt for tubes: a lit top plane, a mid plane and a dark underside (the ash's 3 planes) */
const planes = (top: number, under: number) => (_u: number, _v: number, _ox: number, oy: number) => (oy < -0.45 ? top : oy > 0.5 ? -under : 0);

/** compression strata: 1-px darker lines across a tube every `step` px, on mid / shadow tones only (MA-2) */
function strata(q: PixelCanvas, path: readonly V[], width: number, step: number, phase = 0, mid = true) {
  let acc = phase;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const d = sub(path[i], a);
    const L = Math.hypot(d[0], d[1]);
    const t = norm(d);
    const n: V = [-t[1], t[0]];
    for (let s = 0; s < L; s += 1) {
      acc += 1;
      if (acc % step) continue;
      const c = add(a, mul(t, s));
      for (let k = -width / 2; k <= width / 2; k += 0.5) {
        const x = Math.floor(c[0] + n[0] * k);
        const y = Math.floor(c[1] + n[1] * k);
        const col = q.get(x, y);
        if ((mid && col === PAL.stone2) || col === PAL.stone1) q.set(x, y, darker(col));
      }
    }
  }
}

function tailLayer(P: AshenPose, R: Rig, grow = 1): PixelCanvas {
  const r = WS.raster();
  if (grow <= 0.02) return WS.render(r);
  const path = pathTo(R.tail.slice(0, 7), grow);
  if (path.length >= 2) r.tube(path, 8, 3 + 5 * (1 - grow), M.HIDE, { flat: 1.6, bias: -0.4, biasAt: planes(0.45, 0.4) });
  // the brazier cup at the tip: a little bony bowl (only once the tail is whole)
  const tip = R.tail[R.tail.length - 1];
  if (grow >= 1) r.ell(add(tip, [0, -1]), 2.2, 1.6, 0, M.BONE, { z: 4, flat: 1.5 });
  const q = WS.render(r);
  strata(q, R.tail.slice(0, 5), 7, 4, 1, false);
  return q;
}

function legLayer(P: AshenPose, R: Rig, far: boolean): PixelCanvas {
  const r = WS.raster();
  const mat = far ? M.FAR : M.HIDE;
  const heel = far ? R.heelF : R.heelN;
  const ank = far ? R.ankleF : R.ankleN;
  const mid = add(lerpV(heel, ank, 0.5), [far ? 0.6 : 0.8, 0]);
  r.tube([heel, mid, ank], 6, 4.2, mat, { flat: 1.5, bias: -0.3, biasAt: planes(0.4, 0.4) });
  // the clenched three-toed foot: knuckled toes forward, one back, claw tips gripping the floor
  const a = ank;
  const toes: [V, V, V][] = [
    [add(a, [1, 2]), add(a, [4, 3.4]), add(a, [5.6, 6.8])],
    [add(a, [0, 3]), add(a, [2, 5]), add(a, [2.6, 6.8])],
    [add(a, [-1, 3]), add(a, [-3, 4.6]), add(a, [-3.8, 6.8])],
  ];
  for (const [i, t] of toes.entries()) r.tube(t, i === 2 ? 3 : 3.4, 2.4, mat, { z: 1 + i * 0.1, flat: 1.4, bias: -0.1, biasAt: planes(0.4, 0.3) });
  r.ell(add(a, [0.5, 2.4]), 3.4, 2.4, 0, mat, { z: 2, flat: 1.6, bias: -0.1 });
  const q = WS.render(r);
  // the claws: bone tips curling into the floor
  const claw = far ? PAL.stone2 : PAL.stone3;
  for (const t of toes) {
    const e = t[2];
    const x = Math.round(e[0] - 0.5);
    q.set(x, GY, claw);
    q.set(x + (e[0] > a[0] ? 1 : -1), GY, far ? PAL.stone1 : PAL.stone2);
  }
  strata(q, [heel, mid, ank], 6, 3, far ? 1 : 0, false);
  return q;
}

/** the rib cage: cavity (night0) and the bars, the keel, the spine; returns the cavity mask */
function cageLayer(P: AshenPose, R: Rig, cavity: Uint8Array): PixelCanvas {
  const q = WS.canvas();
  cavity.fill(0);
  // cavity: the region between spine, keel and the first / last rib
  const outline: V[] = [...R.spine, ...[...R.keel].reverse()];
  fillPoly(outline, (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    q.set(x, y, PAL.night0);
    cavity[y * W + x] = 1;
  });
  const r = WS.raster();
  r.tube(R.spine, 3.6, 3.2, M.BONE, { z: 1, flat: 1.3 });
  // the lumbar link down to the pelvis (the tail root): the cage never floats over the legs
  r.tube([R.spine[2], add(R.hip, [-1, 4])], 3.4, 3.6, M.BONE, { z: 0.8, flat: 1.3 });
  r.tube(R.keel, 3.2, 2.4, M.BONE, { z: 3, flat: 1.3, biasAt: planes(0.3, 0.3) });
  for (const [i, rb] of R.ribs.entries()) r.tube(rb, 2.6, 2.1 - i * 0.05, M.BONE, { z: 2, flat: 1.25, biasAt: planes(0.35, 0.3) });
  const c = WS.render(r);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const col = c.get(x, y);
      if (col === null) continue;
      q.set(x, y, col);
      cavity[y * W + x] = 0;
    }
  return q;
}

/** neck tube (hide with strata) */
function neckLayer(P: AshenPose, R: Rig, grow = 1): PixelCanvas {
  const r = WS.raster();
  const full = [add(R.neck[0], [-2, 3]), ...R.neck.slice(0, 3), lerpV(R.neck[2], R.neck[3], 0.6), R.neck[3]];
  if (grow <= 0.02) return WS.render(r);
  const path = pathTo(full, grow);
  r.tube(path, 10, grow >= 1 ? 6 : 8, M.HIDE, { flat: 1.8, bias: -0.78, biasAt: planes(0.62, 0.3) });
  const q = WS.render(r);
  if (path.length >= 4) strata(q, path.slice(0, 4), 8, 6, 2, false);
  return q;
}

/** the skull: cranium, brow, the hooked snout, the jaw (hand-planed facets in skull space) */
const CRANIUM: V[] = [[-3, 2], [-3.4, -1.5], [-1.5, -4.5], [2, -5.5], [6, -5], [8.6, -3.6], [11, -2.7], [14, -1.7], [16.6, -0.5], [18.4, 1.2], [18.8, 3.4], [18, 5.6], [17, 5.2], [16.6, 3.4], [12, 2.6], [6, 2.7], [0, 3]];
const TOPPLANE: V[] = [[-2.6, -1.6], [-1.2, -4.2], [2, -5.1], [6, -4.6], [8.4, -3.3], [11, -2.5], [14, -1.5], [16.6, -0.3], [18, 1], [15, 0.1], [11, -0.9], [8, -1.6], [4, -2.6], [0, -2.4]];
const JAW: V[] = [[0.6, 2.7], [8, 2.7], [14.6, 2.9], [15, 3.9], [12.6, 5.3], [8, 6.1], [3, 5.9], [0, 4.8]];
const BROW: V[] = [[3.2, -3.9], [9, -3.7], [10, -2.3], [8.2, -1.1], [5, -1.7]];

function skullLayer(P: AshenPose, R: Rig, light: Light): PixelCanvas {
  const r = WS.raster();
  const T = (pts: readonly V[], jaw = 0) => pts.map(([x, y]) => skullPt(R, x - jaw * 0.3, y + (y > 2.5 ? jaw * 3.2 * Math.min(1, (x + 1) / 8) : 0)));
  const ax = R.axis;
  const N = (nx: number, ny: number, nz: number): V3 => n3(ax[0] * nx - ax[1] * ny, ax[1] * nx + ax[0] * ny, nz);
  // jaw first (behind the cranium), then the cranium side, top plane, brow
  r.facet(T(JAW, P.jaw), M.HIDE, N(0.1, 0.75, 0.6), 0, -0.1);
  r.facet(T(CRANIUM), M.HIDE, N(0.05, 0.1, 1), 1, 0);
  r.facet(T(TOPPLANE), M.HIDE, N(-0.15, -0.9, 0.45), 2, 0.12);
  r.facet(T(BROW), M.HIDE, N(-0.1, -0.6, 0.7), 3, 0.1);
  // the occiput dome
  r.ell(skullPt(R, -0.5, -0.6), 3.4 * SKULL_K, 3.4 * SKULL_K, 0, M.HIDE, { z: 1.5, flat: 1.4 });
  const q = WS.render(r);
  // eye socket: a dark pit under the brow
  const e = R.eye;
  const ex = Math.round(e[0] - 0.5);
  const ey = Math.round(e[1] - 0.5);
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [1, 1]] as const) if (q.isOpaque(ex + dx, ey + dy)) q.set(ex + dx, ey + dy, dy === 0 && dx === 0 ? PAL.ink : PAL.stone0);
  // the mouth line (shut) / the gape (open): ink, the nostril pit
  const m0 = skullPt(R, 2, 2.6 + P.jaw * 0.6);
  const m1 = skullPt(R, 15.5, 2.8 + P.jaw * 1.4);
  const steps = Math.ceil(Math.hypot(m1[0] - m0[0], m1[1] - m0[1]));
  for (let i = 0; i <= steps; i++) {
    const pt = lerpV(m0, m1, i / steps);
    const x = Math.floor(pt[0]);
    const y = Math.floor(pt[1]);
    if (q.isOpaque(x, y)) q.set(x, y, PAL.ink);
  }
  if (P.jaw > 0.25) {
    // the open gape: a dark wedge between the jaws
    const gape: V[] = [skullPt(R, 2, 2.6), skullPt(R, 15.5, 2.8), skullPt(R, 13, 2.6 + P.jaw * 3.4), skullPt(R, 3, 2.8 + P.jaw * 1.2)];
    fillPoly(gape, (x, y) => q.isOpaque(x, y) && q.set(x, y, PAL.ink));
  }
  const ns = skullPt(R, 15.2, -0.2);
  if (q.isOpaque(Math.floor(ns[0]), Math.floor(ns[1]))) q.set(Math.floor(ns[0]), Math.floor(ns[1]), PAL.stone0);
  strata(q, [skullPt(R, 1, 0.8), skullPt(R, 13, 1.6)], 3, 4, 1);
  void light;
  return q;
}

/** crest: 5 smoke spines along the neck top and the skull, tips curling back (stone1 → void1, void2 tips) */
function crestLayer(P: AshenPose, R: Rig): PixelCanvas {
  const q = WS.canvas();
  const spots: { at: V; dir: V; len: number }[] = [];
  const nk = R.neck;
  const along = (t: number): { p: V; tan: V } => {
    const i = Math.min(2, Math.floor(t * 3));
    const k = t * 3 - i;
    const p = lerpV(nk[i], nk[i + 1], k);
    return { p, tan: norm(sub(nk[i + 1], nk[i])) };
  };
  const flare = P.crest;
  for (const [t, L] of [[0.3, 7], [0.55, 8], [0.8, 7]] as const) {
    const { p, tan } = along(t);
    const up: V = norm([tan[1], -tan[0]]);
    const dirn = norm(add(mul(up, 1), mul(tan, -0.55 + flare * 0.4)));
    spots.push({ at: add(p, mul(up, 4 - t * 2)), dir: dirn, len: L + Math.max(0, flare) });
  }
  for (const [x, y, L] of [[-0.8, -4.6, 7], [3.6, -5.6, 6]] as const) {
    const at = skullPt(R, x, y + 0.6);
    const up: V = norm([R.axis[1], -R.axis[0]]);
    spots.push({ at, dir: norm(add(up, mul(R.axis, -0.9 + flare * 0.4))), len: L + Math.max(0, flare) });
  }
  for (const s of spots) {
    // a tapering spine 3 px at the base, curling back at its tip: stone1 root, void1 body, void2 tip
    const n = Math.round(s.len);
    const side: V = [s.dir[1], -s.dir[0]];
    const tipPt = add(add(s.at, mul(s.dir, n)), [-1.6, 0.6]);
    const poly: V[] = [add(s.at, mul(side, 2.8)), add(lerpV(s.at, tipPt, 0.55), mul(side, 1.5)), tipPt, add(lerpV(s.at, tipPt, 0.5), mul(side, -1.2)), add(s.at, mul(side, -2.4))];
    fillPoly(poly, (x, y) => {
      const k = Math.hypot(x + 0.5 - s.at[0], y + 0.5 - s.at[1]) / (n || 1);
      q.set(x, y, k > 0.7 ? PAL.void2 : k > 0.3 ? PAL.void1 : PAL.stone1);
    });
  }
  return q;
}

function spurLayer(s: { base: V; tip: V }, far: boolean, light: Light): PixelCanvas {
  const q = WS.canvas();
  // the wrist knuckle the spur grows from: a bony knob over the peak plates
  const r = WS.raster();
  r.ell(add(s.base, [0.4, 1.6]), 3, 2.4, 0, far ? M.FAR : M.BONE, { flat: 1.3 });
  q.blit(WS.render(r), 0, 0);
  // the claw: 3 px wide at the base, 5–6 px tall, rising straight off the knuckle then hooking back
  // (a bat's thumb claw, not a continuation of the peak); a lit edge on the light side (stone3, stone2
  // on the far wrist), the body, a shadow edge, and only the hooked tip void2 (§1.2)
  const lit = far ? PAL.stone2 : PAL.stone3;
  const body = far ? PAL.stone1 : PAL.stone2;
  const dark = far ? PAL.stone0 : PAL.stone1;
  const ctrl = add(s.base, [0.6, -5]);
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const u = 1 - k;
    const c: V = [u * u * s.base[0] + 2 * u * k * ctrl[0] + k * k * s.tip[0], u * u * s.base[1] + 2 * u * k * ctrl[1] + k * k * s.tip[1]];
    const w = k < 0.45 ? 3 : k < 0.8 ? 2 : 1;
    const x0 = Math.round(c[0] - w / 2);
    const y = Math.floor(c[1]);
    for (let j = 0; j < w; j++) {
      const x = x0 + j;
      const edgeLit = light.side < 0 ? j === 0 : j === w - 1;
      const edgeDark = w > 1 && (light.side < 0 ? j === w - 1 : j === 0);
      q.set(x, y, k > 0.82 ? PAL.void2 : edgeLit ? lit : edgeDark ? dark : body);
    }
  }
  return q;
}

// ------------------------------------------------------------------ the frame

const CAVITY = new Uint8Array(W * H);
const KEEP = new Uint8Array(W * H);

/** plate state by the pose: seated count in the accretion order, the weld range */
function stateOf(P: AshenPose): (id: number) => PlateState {
  const seated = Math.round(P.seated);
  const weld = Math.round(P.weld);
  const rev = P.order >= 0.5;
  return (id: number) => {
    const r = rev ? 43 - plateRank(id) : plateRank(id);
    if (r >= seated) return 'gone';
    if (weld >= 0 && r >= weld) return 'weld';
    return 'seated';
  };
}

export interface DrawInfo {
  readonly rig: Rig;
  readonly near: CloakDraw;
  readonly far: CloakDraw;
}

/**
 * The summon / revive build in CHAIN order (EF-11, HA-13: no part ever floats): talons → legs →
 * pelvis → rib cage (bottom-up) → neck root → neck → skull → crest, the tail from the hips outward.
 * Driven by the bone line (boneTop: the cinematic's band row) mapped to one progress 0…1.
 */
export function buildProgress(bt: number): number {
  return bt <= 0 ? 1 : Math.max(0, Math.min(1, (100 - bt) / 64));
}
const win = (c: number, a: number, b: number) => Math.max(0, Math.min(1, (c - a) / (b - a)));

/** keep only the rows at or below `top` (the part grows upward from its parent) */
function rowsFrom(q: PixelCanvas, top: number): PixelCanvas {
  for (let y = 0; y < Math.min(H, Math.ceil(top)); y++) for (let x = 0; x < W; x++) if (q.isOpaque(x, y)) q.erase(x, y);
  return q;
}

/** a polyline cut at arc fraction k (from its first point) */
function pathTo(path: readonly V[], k: number): V[] {
  if (k >= 1) return [...path];
  let total = 0;
  for (let i = 1; i < path.length; i++) total += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  let left = total * Math.max(0, k);
  const out: V[] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const L = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    if (left >= L) {
      out.push(path[i]);
      left -= L;
      continue;
    }
    out.push(lerpV(path[i - 1], path[i], left / (L || 1)));
    break;
  }
  return out;
}

/** the revive's ash heap at the talons: a soft stepped cone (lit top stone2, mid stone1, base stone0) */
function heapLayer(P: AshenPose, light: Light): PixelCanvas {
  const q = WS.canvas();
  const h = Math.max(2, 15 * P.heap);
  const hw = 6 + 11 * Math.sqrt(P.heap);
  const cx = 53;
  for (let y = Math.floor(GY - h); y <= GY; y++) {
    const k = (GY + 1 - y) / (h + 1);
    const half = hw * Math.sqrt(Math.max(0, 1 - k)) + (hash(y, 41) - 0.5);
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const side = (x - cx) / (half || 1); // −1 … 1 across
      const lit = -side * light.side; // + toward the light
      const top = k > 0.62 || (k > 0.4 && lit > 0.2);
      const col = top ? (lit > -0.3 ? PAL.stone2 : PAL.stone1) : k > 0.22 ? (lit > 0.4 ? PAL.stone2 : PAL.stone1) : lit > 0.5 ? PAL.stone1 : PAL.stone0;
      q.set(x, y, hash(x, y, 43) < 0.07 ? PAL.stone0 : col);
    }
  }
  return q;
}

/** torn plates on their way into the rib gaps: 2×2 / 2×3 chips (attack f2–f4) */
function chipsLayer(P: AshenPose, R: Rig): PixelCanvas {
  const q = WS.canvas();
  const n = Math.round(P.chips);
  if (n <= 0) return q;
  const from = Math.round(P.seated);
  const cN = cloakPose(P, 'N');
  const cF = cloakPose(P, 'F');
  const shapes = { N: cloakShape('N', cN.w, cN.off), F: cloakShape('F', cF.w, cF.off) };
  for (const pl of PLATES) {
    const r = plateRank(pl.id);
    if (r < from || r >= from + n) continue;
    const c = plateCenter(shapes[pl.wing], pl);
    const t = 0.25 + 0.55 * hash(pl.id, 51, from);
    const at = lerpV(c, R.heart, t);
    const x = Math.round(at[0] - 1);
    const y = Math.round(at[1] - 1);
    const tall = hash(pl.id, 52) < 0.5;
    for (let dy = 0; dy < (tall ? 3 : 2); dy++)
      for (let dx = 0; dx < 2; dx++) q.set(x + dx, y + dy, dy === (tall ? 2 : 1) ? PAL.stone1 : t > 0.62 && dx === 1 && dy === 0 ? PAL.fire2 : PAL.stone2);
  }
  return q;
}

/**
 * The top-down crumble (death, §4.8): everything above the front is gone. The front is JAGGED (a
 * ±3 px stepped noise in 2–4 px runs, chips peeling off just under it), and on the middle frames
 * (crumble 0.3…0.6) 2–3 cloak sheets SLIDE down 3–5 px with a stone0 gap above them before they break.
 */
const COL = new Int32Array(H);
function crumble(p: PixelCanvas, P: AshenPose) {
  const c = P.crumble;
  const fy = lerp(4, GY + 3, Math.pow(c, 0.85));
  const k20 = Math.round(c * 20);
  // stepped noise: runs of 2–4 columns share one offset (−3 … +3)
  const front = (x: number) => {
    const run = Math.floor((x + Math.floor(hash(Math.floor(x / 3), 60) * 2)) / 3);
    return Math.round(fy + (hash(run, 61, k20) - 0.5) * 6.4);
  };
  if (c >= 0.9) {
    // the last stubs have fallen into the cinematic's heap: only the heart and the embers remain (light pass)
    p.clear();
    return;
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!p.isOpaque(x, y)) continue;
      const f = front(x);
      if (y < f) p.erase(x, y);
      else if (y < f + 1) p.set(x, y, hash(x, 62) < 0.5 ? PAL.stone2 : PAL.stone1);
    }
  // the sliding sheets: column bands of the cloak drop 3–5 px, a stone0 gap opens over each
  if (c >= 0.3 && c < 0.6) {
    const sheets: [number, number, number][] = [[24, 31, 3], [35, 43, 5], [46, 52, 4]];
    for (const [x0, x1, sl] of sheets) {
      const drop = c < 0.45 ? sl - 1 : sl;
      for (let x = x0; x <= x1; x++) {
        const a = front(x) + 2;
        const L = 16;
        for (let y = 0; y < H; y++) COL[y] = p.isOpaque(x, y) ? (p.get(x, y) as number) : -1;
        for (let y = a + L + drop - 1; y >= a; y--) {
          if (y < 0 || y >= H || y > GY - 3) continue;
          const src = y - drop;
          if (y < a + drop) {
            if (COL[y] >= 0) p.set(x, y, PAL.stone0);
            continue;
          }
          const v = src >= 0 ? COL[src] : -1;
          if (v >= 0) p.set(x, y, v);
        }
      }
    }
  }
  // chips peeling off the front and grains falling into the cinematic's heap
  const n = Math.round(30 * Math.max(0, 1 - c * 1.05));
  for (let k = 0; k < n; k++) {
    const x = Math.round(26 + hash(k, 63, k20) * 52);
    const y = Math.round(front(x) - 1 + hash(k, 64, k20) * Math.max(3, (GY - fy) * 0.85));
    if (y > GY || y < 0) continue;
    if (p.isOpaque(x, y)) continue;
    const big = hash(k, 65) < 0.35;
    const gc = hash(k, 66) < 0.5 ? PAL.stone2 : PAL.stone1;
    p.set(x, y, gc);
    p.set(x + 1, y, gc);
    if (big) {
      p.set(x + 1, y, PAL.stone2);
      p.set(x, y + 1, PAL.stone1);
      p.set(x + 1, y + 1, PAL.stone1);
    }
  }
}

/**
 * The lit-side contour (§1.3 1× gate, IŞ-7): the outermost pixel facing the light steps one tone up
 * (stone1 → stone2, stone2 → stone3), so on the grey board the silhouette never relies on the ink
 * alone: lit edge on one side, the void2 rim on the other.
 */
function litContour(p: PixelCanvas, light: Light) {
  const s = light.side; // the lit side: −1 = left (P1)
  const d = p.data;
  const op = (x: number, y: number) => x >= 0 && x < W && d[(y * W + x) * 4 + 3] > 0;
  LC.fill(0);
  const S1 = PAL.stone1;
  const S2 = PAL.stone2;
  for (let y = 1; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (!d[i + 3]) continue;
      const c = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      if (c !== S1 && c !== S2) continue;
      if (op(x + s, y) || !op(x - s, y)) continue;
      LC[y * W + x] = c === S2 ? 2 : 1;
    }
  // only runs of ≥ 2 rows: a lone stepped-up contour pixel is noise at 1× (IŞ-10)
  const at = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H && LC[y * W + x] > 0;
  for (let y = 1; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = LC[y * W + x];
      if (!k) continue;
      if (at(x, y - 1) || at(x, y + 1) || at(x - 1, y - 1) || at(x + 1, y - 1) || at(x - 1, y + 1) || at(x + 1, y + 1)) p.set(x, y, k === 2 ? PAL.stone3 : PAL.stone2);
    }
}
const LC = new Uint8Array(W * H);

/** A lone void2 rim pixel on a staircase edge joins the one under it (a 2-px step, not a dot: IŞ-10). */
function joinRim(p: PixelCanvas) {
  const hits: number[] = [];
  const d = p.data;
  const V2 = PAL.void2;
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = (y * W + x) * 4;
      if (!d[i + 3] || ((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]) !== V2) continue;
      if (p.get(x - 1, y) === PAL.void2 || p.get(x + 1, y) === PAL.void2 || p.get(x, y - 1) === PAL.void2 || p.get(x, y + 1) === PAL.void2) continue;
      const b = p.get(x, y + 1);
      if (b !== null && b !== PAL.night0 && !EMBERS.has(b)) hits.push(x, y + 1);
    }
  for (let i = 0; i < hits.length; i += 2) p.set(hits[i], hits[i + 1], PAL.void2);
}
const EMBERS = new Set<number>([PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4, PAL.gold4, PAL.white]);

/** The whole drake of one pose, lit by `light`. */
export function drawAshen(p: PixelCanvas, P: AshenPose, light: Light): DrawInfo {
  WS.begin(light);
  const R = rig(P);
  const st = stateOf(P);
  const bare = P.seated < 44;
  const hood = R.hoodOff;
  const bt = P.boneTop;

  const cF = cloakPose(P, 'F');
  // the summon build (bone line still rising, the hood < 70 % seated): no bare hand over the half-built hood
  const stubs = P.strutFan < 0.5 && P.seated < 31 && P.boneTop > 0;
  const spF = P.wingF.spread ?? 0;
  const spN = P.wingN.spread ?? 0;
  const far = drawCloak(WS, light, 'F', cF.w, cF.off, st, { far: true, struts: bare && !stubs, fan: P.strutFan, stubs, shoulder: add(R.spine[0], [-2, 2]), spars: spF > 0.3 ? Math.min(1, (spF - 0.3) / 0.55) : 0 });
  // the hand only once the cage (its parent through the shoulder) is whole: never a floating finger
  if (buildProgress(bt) < (P.strutFan > 0.5 ? 0.55 : 0.9)) maskStruts(far, H);
  peakEdge(far.layer, far.shape, 'F', light, true);
  composite(p, far.layer, SEAM);

  // the chain build (summon / revive): each part only once its parent is whole
  const c = buildProgress(bt);
  const legTop = GY + 1 - (GY + 1 - (R.heelF[1] - 4)) * win(c, 0, 0.24);
  const cageTop = 80 - 36 * win(c, 0.3, 0.56) + R.hoodOff[1];
  const gNeck = win(c, 0.5, 0.8);
  const gSkull = win(c, 0.8, 0.95);
  const gCrest = win(c, 0.95, 1);
  composite(p, tailLayer(P, R, win(c, 0.26, 0.6)), SEAM);
  composite(p, rowsFrom(legLayer(P, R, true), legTop), SEAM);
  // stripped bare (no plate left), the near hand's struts go BEHIND the rib cage: the ribs read on top
  const cN = cloakPose(P, 'N');
  const near = drawCloak(WS, light, 'N', cN.w, cN.off, st, { far: false, struts: bare && !stubs, fan: P.strutFan, stubs, shoulder: add(R.spine[0], [3, 3]), spars: spN > 0.3 ? Math.min(1, (spN - 0.3) / 0.55) : 0 });
  if (buildProgress(bt) < (P.strutFan > 0.5 ? 0.55 : 0.9)) maskStruts(near, H);
  peakEdge(near.layer, near.shape, 'N', light, false);
  // also while the hood swings between the perch and the canopy: the cage (and its heart) stay in front
  const mid = P.wingN.mantle > 0.2 && P.wingN.mantle < 0.8;
  const nearBehind = (Math.round(P.seated) <= 0 && bt <= 0) || mid;
  if (nearBehind) composite(p, near.layer, CREASE);
  composite(p, c >= 1 ? cageLayer(P, R, CAVITY) : rowsFrom(cageLayer(P, R, CAVITY), c < 0.3 ? H : cageTop), SEAM);
  if (c < 1) for (let i = 0; i < Math.min(H, Math.ceil(c < 0.3 ? H : cageTop)) * W; i++) CAVITY[i] = 0;
  composite(p, rowsFrom(legLayer(P, R, false), legTop), SEAM);
  // the revive's heap lies IN FRONT of the lower bones: they stand up out of it
  if (P.heap > 0) composite(p, heapLayer(P, light), SEAM);
  // the cocoon tucks the head under the hood's edge, over the wrapped cloak
  const tucked = P.wingN.cocoon > 0.5 || P.wingN.mantle > 0.5;
  const headParts = () => {
    if (gNeck > 0) composite(p, neckLayer(P, R, gNeck), SEAM);
  if (P.smear > 0) {
    // the release smear: the skull's mask trails 1–2 px up and back, one tone down (HA-12)
    const sk = skullLayer(P, R, light);
    const tr = WS.canvas();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!sk.isOpaque(x, y)) continue;
        for (const [dx, dy, col] of [[-3, -3, PAL.void1], [-2, -2, PAL.stone1], [-1, -1, PAL.stone1], [-2, -1, PAL.stone1]] as const) if (!sk.isOpaque(x + dx, y + dy)) tr.set(x + dx, y + dy, col);
      }
    composite(p, skullFrom(tr, R, gSkull), SEAM, { top: 0, side: 0, bottom: 0 });
  }
  if (gSkull > 0) composite(p, skullFrom(skullLayer(P, R, light), R, gSkull), CREASE);
  if (gCrest > 0) composite(p, gCrest >= 1 ? crestLayer(P, R) : rowsFrom(crestLayer(P, R), R.skull[1] - 14 * gCrest), SEAM, { top: 0, side: 0, bottom: 0 });
  };
  if (!tucked) headParts();

  if (!nearBehind) {
    composite(p, near.layer, CREASE);
    // the heart never shows through a cloak drawn in front of the cage
    for (let i = 0; i < W * H; i++) if (CAVITY[i] && near.layer.data[i * 4 + 3]) CAVITY[i] = 0;
  }
  if (tucked) headParts();
  if (bt <= 0 || bt < 20) {
    if (st(PLATES[0].id) !== 'gone' || bare) composite(p, spurLayer(spurPts(far.shape, 'F', 0), true, light), SEAM, { top: 0, side: 0, bottom: 0 });
    composite(p, spurLayer(spurPts(near.shape, 'N', 0), false, light), SEAM, { top: 0, side: 0, bottom: 0 });
  }
  if (P.chips > 0) composite(p, chipsLayer(P, R), SEAM, { top: 0, side: 0, bottom: 0 });
  if (P.crumble > 0) {
    crumble(p, P);
    for (let i = 0; i < W * H; i++) if (!p.data[i * 4 + 3]) CAVITY[i] = 0;
  }

  // the silhouette: rim on the shadow side, then the single ink outline
  const empty = WS.canvas();
  rimLight(p, empty, light, { cols: [PAL.stone0, PAL.stone1, PAL.stone2], rim: PAL.void2 });
  litContour(p, light);
  joinRim(p);
  p.outline(PAL.ink);
  KEEP.fill(0);
  const ctx: EmberCtx = { P, R, light, cavity: CAVITY, near, far, keep: KEEP };
  emberPass(p, ctx);
  cleanCrumbs(p, KEEP);
  return { rig: R, near, far };
}

/** the skull grows from the occiput (on its neck) toward the snout: keep skull-space x ≤ lim */
function skullFrom(q: PixelCanvas, R: Rig, k: number): PixelCanvas {
  if (k >= 1) return q;
  const lim = -5 + 25 * k;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!q.isOpaque(x, y)) continue;
      const d = sub([x + 0.5, y + 0.5], R.skull);
      if ((d[0] * R.axis[0] + d[1] * R.axis[1]) / SKULL_K > lim) q.erase(x, y);
    }
  return q;
}

/** the summon: the bare struts above the bone line are not built yet (seated plates stay: accretion) */
function maskStruts(c: CloakDraw, top: number) {
  for (let y = 0; y < Math.min(H, Math.ceil(top)); y++)
    for (let x = 0; x < W; x++) if (c.own[y * W + x] < 0 && c.layer.isOpaque(x, y)) c.layer.erase(x, y);
}
