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
  /** 0 none, 1 pouring, 2 down the talons, 3 cooled fan */
  spill: number;
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
  /** plate order: 0 the accretion order (hem first), 1 reversed (wrist first: the revive) */
  order: number;
}

const WING0: WingPose = { wrist: [0, 0], open: 0, mantle: 0, cocoon: 0, ripple: -1 };

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
const NECK_ROOT: V = [61, 45];
const NECK_A: readonly number[] = [-48, 4, 66];
const NECK_L: readonly number[] = [10, 10, 10];
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

function tailLayer(P: AshenPose, R: Rig): PixelCanvas {
  const r = WS.raster();
  r.tube(R.tail.slice(0, 7), 8, 3, M.HIDE, { flat: 1.6, bias: -0.4, biasAt: planes(0.45, 0.4) });
  // the brazier cup at the tip: a little bony bowl
  const tip = R.tail[R.tail.length - 1];
  r.ell(add(tip, [0, -1]), 2.2, 1.6, 0, M.BONE, { z: 4, flat: 1.5 });
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
function neckLayer(P: AshenPose, R: Rig): PixelCanvas {
  const r = WS.raster();
  const path = [add(R.neck[0], [-2, 3]), ...R.neck.slice(0, 3), lerpV(R.neck[2], R.neck[3], 0.6), R.neck[3]];
  r.tube(path, 10, 6, M.HIDE, { flat: 1.8, bias: -0.78, biasAt: planes(0.62, 0.3) });
  const q = WS.render(r);
  strata(q, path.slice(0, 4), 8, 6, 2, false);
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
    spots.push({ at: add(p, mul(up, 5 - t * 2)), dir: dirn, len: L - 1 + Math.max(0, flare) });
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
    const poly: V[] = [add(s.at, mul(side, 2.6)), add(lerpV(s.at, tipPt, 0.55), mul(side, 1.2)), tipPt, add(lerpV(s.at, tipPt, 0.5), mul(side, -1)), add(s.at, mul(side, -2.2))];
    fillPoly(poly, (x, y) => {
      const k = Math.hypot(x + 0.5 - s.at[0], y + 0.5 - s.at[1]) / (n || 1);
      q.set(x, y, k > 0.82 ? PAL.void3 : k > 0.42 ? PAL.void2 : PAL.stone1);
    });
  }
  return q;
}

function spurLayer(s: { base: V; tip: V }, far: boolean): PixelCanvas {
  const q = WS.canvas();
  // the wrist knuckle the spur grows from: a bony knob over the peak plates
  const r = WS.raster();
  r.ell(add(s.base, [0.4, 1.4]), 2.6, 2.2, 0, far ? M.FAR : M.BONE, { flat: 1.3 });
  q.blit(WS.render(r), 0, 0);
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const c = lerpV(s.base, s.tip, k);
    const bend = mul([1, 0], k * k * -1.2);
    const p = add(c, bend);
    const x = Math.floor(p[0]);
    const y = Math.floor(p[1]);
    const w = k < 0.4 ? 2 : k < 0.8 ? 1 : 0;
    const body = far ? PAL.stone1 : PAL.stone2;
    q.set(x, y, k > 0.85 ? PAL.void2 : body);
    if (w >= 1) q.set(x + 1, y, far ? PAL.stone0 : PAL.stone1);
    if (w >= 2) q.set(x - 1, y, far ? PAL.stone2 : PAL.stone3);
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

/** erase a layer's rows above the summon's bone line */
function boneMask(q: PixelCanvas, top: number): PixelCanvas {
  if (top <= 0) return q;
  for (let y = 0; y < Math.min(H, Math.ceil(top)); y++) for (let x = 0; x < W; x++) if (q.isOpaque(x, y)) q.erase(x, y);
  return q;
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

/** the top-down crumble (death): everything above the front is gone; a lip and falling grains at it */
function crumble(p: PixelCanvas, P: AshenPose) {
  const c = P.crumble;
  const fy = lerp(4, GY + 3, Math.pow(c, 0.85));
  const front = (x: number) => fy + Math.round((hash(x, 61) - 0.5) * 4);
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
      else if (y < f + 1.5) p.set(x, y, Math.floor(x / 3) % 2 ? PAL.stone2 : PAL.stone1);
    }
  // grains and sliding plate sheets just under the front (they fall into the cinematic's heap)
  const n = Math.round(26 * Math.max(0, 1 - c * 1.05));
  for (let k = 0; k < n; k++) {
    const x = Math.round(30 + hash(k, 63, Math.round(c * 20)) * 46);
    const y = Math.round(front(x) + 2 + hash(k, 64, Math.round(c * 20)) * Math.max(2, (GY - fy) * 0.8));
    if (y > GY || y < 0) continue;
    if (p.isOpaque(x, y)) continue;
    const big = hash(k, 65) < 0.3;
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

/** The whole drake of one pose, lit by `light`. */
export function drawAshen(p: PixelCanvas, P: AshenPose, light: Light): DrawInfo {
  WS.begin(light);
  const R = rig(P);
  const st = stateOf(P);
  const bare = P.seated < 44;
  const hood = R.hoodOff;
  const bt = P.boneTop;

  if (P.heap > 0) composite(p, heapLayer(P, light), SEAM);
  const cF = cloakPose(P, 'F');
  const far = drawCloak(WS, light, 'F', cF.w, cF.off, st, { far: true, struts: bare });
  if (bt > 0) maskStruts(far, bt);
  peakEdge(far.layer, far.shape, 'F', light, true);
  composite(p, far.layer, SEAM);

  composite(p, boneMask(tailLayer(P, R), bt), SEAM);
  composite(p, boneMask(legLayer(P, R, true), bt), SEAM);
  composite(p, boneMask(cageLayer(P, R, CAVITY), bt), SEAM);
  if (bt > 0) for (let i = 0; i < Math.min(H, Math.ceil(bt)) * W; i++) CAVITY[i] = 0;
  composite(p, boneMask(legLayer(P, R, false), bt), SEAM);
  // the cocoon tucks the head under the hood's edge, over the wrapped cloak
  const tucked = P.wingN.cocoon > 0.5 || P.wingN.mantle > 0.5;
  const headParts = () => {
    composite(p, boneMask(neckLayer(P, R), bt), SEAM);
  if (P.smear > 0) {
    // the release smear: the skull's mask trails 1–2 px up and back, one tone down (HA-12)
    const sk = skullLayer(P, R, light);
    const tr = WS.canvas();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!sk.isOpaque(x, y)) continue;
        for (const [dx, dy, col] of [[-2, -2, PAL.stone0], [-1, -1, PAL.stone1]] as const) if (!sk.isOpaque(x + dx, y + dy)) tr.set(x + dx, y + dy, col);
      }
    composite(p, boneMask(tr, bt), SEAM, { top: 0, side: 0, bottom: 0 });
  }
  composite(p, boneMask(skullLayer(P, R, light), bt), CREASE);
  composite(p, boneMask(crestLayer(P, R), bt), SEAM, { top: 0, side: 0, bottom: 0 });
  };
  if (!tucked) headParts();

  const cN = cloakPose(P, 'N');
  const near = drawCloak(WS, light, 'N', cN.w, cN.off, st, { far: false, struts: bare });
  if (bt > 0) maskStruts(near, bt);
  peakEdge(near.layer, near.shape, 'N', light, false);
  composite(p, near.layer, CREASE);
  if (tucked) headParts();
  if (bt <= 0 || bt < 20) {
    if (st(PLATES[0].id) !== 'gone' || bare) composite(p, spurLayer(spurPts(far.shape, 'F', 0), true), SEAM, { top: 0, side: 0, bottom: 0 });
    composite(p, spurLayer(spurPts(near.shape, 'N', 0), false), SEAM, { top: 0, side: 0, bottom: 0 });
  }
  if (P.chips > 0) composite(p, chipsLayer(P, R), SEAM, { top: 0, side: 0, bottom: 0 });
  if (P.crumble > 0) {
    crumble(p, P);
    for (let i = 0; i < W * H; i++) if (!p.data[i * 4 + 3]) CAVITY[i] = 0;
  }

  // the silhouette: rim on the shadow side, then the single ink outline
  const empty = WS.canvas();
  rimLight(p, empty, light, { cols: [PAL.stone0, PAL.stone1, PAL.stone2], rim: PAL.void2 });
  p.outline(PAL.ink);
  KEEP.fill(0);
  const ctx: EmberCtx = { P, R, light, cavity: CAVITY, near, far, keep: KEEP };
  emberPass(p, ctx);
  cleanCrumbs(p, KEEP);
  return { rig: R, near, far };
}

/** the summon: the bare struts above the bone line are not built yet (seated plates stay: accretion) */
function maskStruts(c: CloakDraw, top: number) {
  for (let y = 0; y < Math.min(H, Math.ceil(top)); y++)
    for (let x = 0; x < W; x++) if (c.own[y * W + x] < 0 && c.layer.isOpaque(x, y)) c.layer.erase(x, y);
}
