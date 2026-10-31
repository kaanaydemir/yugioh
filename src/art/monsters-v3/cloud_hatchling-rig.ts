// Bulut Yavrusu (cloud_hatchling) v3 — the rig: HatchPose → skeleton → pixels, ONE draw for both forms
// (docs/v3/kart-a/cloud_hatchling.md §1, §3.1, §3.2). `age` 0 is the baby (a chubby mint chick-dragon whose
// head is bigger than its pear body, a cloud cowlick, the half eggshell riding its tail tip, stubby wing
// nubs), `age` 1 the grown form (a low, wide, seated four-legged cloud lion-dragon whose cloud mane is its
// main mass, a short round muzzle, ivory ram curls in the mane, wing tips folded into it, the shell band
// on the tail curled round the haunch, the 12-puff cloud ring orbiting the waist). Every in-between is a
// real pose: six sub-ages (seg) grow one part each (§4.10: body, legs, muzzle + chest, horns, wings,
// mane + ring).
//
// Story states drawn by the same rig: the curled ball (death / summon / revive, any age), the egg (summon
// drop, its cracks and its burst; the death's knit wall rising round the ball; the float), the revive's
// shell plates falling open.
//
// Craft (REHBER IŞ-3…IŞ-9): every part is a rigkit Raster primitive lit by the ONE key light
// (P1 top-left, P2 relit from the right), quantized into flat tone bands, laid with 1-px step-down seams
// (composite), one ink silhouette contour, then the light pixels (eye catch-light, hiccup ring, the
// shell glint) after the outline. Whole pixels: every pose offset is rounded before it places a part.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { composite, despeckle, Workspace, type Light, type Raster, type V } from '../rigkit';
import { CLOUD_KEY, COWLICK, GY, LOBE_SEAM, fillPockets, puffLobe, shellCup, COWLICK_UP, CREASE, H, M, MATS, RING, SEAM, SHELL_CAP, SHELL_KEY, TUFT, TUFT_UP, W, clamp01, hiccupRing, ringPuffs, seg, stampAt, type RingPuff } from './cloud_hatchling-parts';

// ------------------------------------------------------------------ the pose (§3.2)

export interface HatchPose {
  /** whole-body offset in pose (px) */
  hip: [number, number];
  /** hop height (px): the body leaves the floor, the feet tucked */
  lift: number;
  /** −1 stretch … 1 squash (drawn in pose, never setScale) */
  squash: number;
  /** weeble lean: the head moves this many px (+ = forward), the hips stay */
  lean: number;
  /** head offset from its rest on the body (a follower) */
  head: [number, number];
  /** head pitch: + = chin up / thrown back, − = tucked */
  tilt: number;
  /** cheek puff 0…1 */
  cheeks: number;
  /** jaw 0 closed … 1 wide */
  jaw: number;
  /** 0 open · 1 squeezed · 2 X · 3 white · 4 swirl · 5 narrow · 6 wide · 7 happy arc */
  eye: number;
  /** lid 0 open … 1 shut */
  blink: number;
  /** pupil look offset (px) */
  look: [number, number];
  /** cowlick sway (px, a follower: + forward) */
  cow: number;
  /** chest tuft bristle 0…1 */
  tuft: number;
  /** every cloud lobe on end (hitMagic static, the growth's bristle) 0…1 */
  fluff: number;
  /** baby forepaw raise 0…1 (1 = over the face); grown: the foreleg lift (px) */
  armN: number;
  armF: number;
  /** wing nub flap (px up) */
  wingN: number;
  wingF: number;
  /** 0 folded … 1 spread (baby nubs out, grown wing tips out of the mane) */
  wingOpen: number;
  /** tail: 0 rest · 1 curled in front (guard) · − stretched back */
  tail: number;
  /** the shell knocks the floor: 1 down on the floor · −1 the rebound */
  tailTap: number;
  /** grown mane bristle 0…1 */
  mane: number;
  /** mane drift phase (lobes bob, a follower of the body) 0…1 */
  drift: number;
  /** cloud ring orbit phase 0…1 (one turn) */
  ring: number;
  /** ring rise (guard: up to the shoulders, px) and outward flare (px) */
  ringY: number;
  ringFlare: number;
  /** guard ring: the puff wall (two rows) 0…1 */
  wall: number;
  /** the hiccup ring's stage (0 none · 1 born · 2, 3 drifting · 4 popped) */
  hic: number;
  /** a breath of air at the lips (sneeze / squeak) 0…1 */
  puff: number;
  /** crouch (baby guard) / lie down (grown sphinx) 0…1 */
  crouch: number;
  /** growth 0…1 (the baby shell draws age = grow) */
  grow: number;
  /** the grown death's shrink back to the baby 0…1 (the grown shell draws age = 1 − unAge) */
  unAge: number;
  /** curled into a ball 0…1 (≥ 0.5 draws the ball; its size shrinks toward 1) */
  ball: number;
  /** the ball's roll (somersault) 0…1 turn */
  tumble: number;
  /** egg: 0 none … 1 closed egg */
  egg: number;
  /** egg tilt (−1 … 1) */
  eggTilt: number;
  /** summon crack progress 0…1 */
  crack: number;
  /** the death's knit wall rising round the ball 0…1 (1 = closed with seams) */
  knit: number;
  /** the summon's shell pop 0 … 1 (the top shell flies up 6 px, the shards out) */
  burst: number;
  /** death float frame 0 none · 1, 2, 3 (rock −1 / upright / +1) */
  float: number;
  /** the revive's plates lying open 0 (round the ball) … 1 (flat on the floor) */
  plates: number;
  /** where the helmet shell rides: 0 tail tip · 1 on the head · 0.5 sliding down the back */
  helmet: number;
  /** glint size on the shell rim's lit corner (0 none · 1 · 2 · 3) */
  glint: number;
  /** loose cloud lobes on the floor (the grown death's peeled mane) 0…1 */
  loose: number;
  /** a 1-px whole-body tremble −1 / 0 / 1 */
  shake: number;
  /** HA-12 smear on the release frame: the head was this many px behind */
  smear: number;
  /** grown: the chest rises on the forelegs (px; roar, victory) */
  rear: number;
  /** the ball value used when the pose is drawn grown (the grown death curls a frame earlier) */
  ballG: number;
}

export const NEUTRAL: HatchPose = {
  hip: [0, 0],
  lift: 0,
  squash: 0,
  lean: 0,
  head: [0, 0],
  tilt: 0,
  cheeks: 0,
  jaw: 0,
  eye: 0,
  blink: 0,
  look: [0, 0],
  cow: 0,
  tuft: 0,
  fluff: 0,
  armN: 0,
  armF: 0,
  wingN: 0,
  wingF: 0,
  wingOpen: 0,
  tail: 0,
  tailTap: 0,
  mane: 0,
  drift: 0,
  ring: 0,
  ringY: 0,
  ringFlare: 0,
  wall: 0,
  hic: 0,
  puff: 0,
  crouch: 0,
  grow: 0,
  unAge: 0,
  ball: 0,
  tumble: 0,
  egg: 0,
  eggTilt: 0,
  crack: 0,
  knit: 0,
  burst: 0,
  float: 0,
  plates: 0,
  helmet: 0,
  glint: 0,
  loose: 0,
  shake: 0,
  smear: 0,
  rear: 0,
  ballG: 0,
};

// ------------------------------------------------------------------ helpers

const L = (a: number, b: number, t: number): number => a + (b - a) * t;
const LV = (a: V, b: V, t: number): V => [L(a[0], b[0], t), L(a[1], b[1], t)];
const R = Math.round;
const addV = (a: V, d: V): V => [a[0] + d[0], a[1] + d[1]];
const rot = (v: V, a: number): V => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];

type Ell = { c: V; rx: number; ry: number };

// ------------------------------------------------------------------ skeleton

export interface Skel {
  age: number;
  sB: number;
  sL: number;
  sM: number;
  sH: number;
  sW: number;
  sN: number;
  o: V;
  body: Ell;
  chest: Ell;
  belly: Ell;
  head: Ell;
  headRest: V;
  snout: Ell;
  jaw: Ell;
  cheek: Ell;
  eye: V;
  mouth: V;
  crown: V;
  haunch: Ell;
  footN: Ell;
  footF: Ell;
  armN: V[];
  armF: V[];
  armW: [number, number];
  pawN: Ell;
  pawF: Ell;
  tail: V[];
  tailW: [number, number];
  tailFront: boolean;
  shell: { c: V; tilt: number; flip: boolean };
  wingN: { base: V; tip: V };
  wingF: { base: V; tip: V };
  core: V;
}

/** The six sub-ages of the growth (one part each, §4.10). */
export function subAges(age: number) {
  return { sB: seg(age, 0), sL: seg(age, 1), sM: seg(age, 2), sH: seg(age, 3), sW: seg(age, 4), sN: seg(age, 5) };
}

export function skel(P: HatchPose, age: number): Skel {
  const { sB, sL, sM, sH, sW, sN } = subAges(age);
  const cr = P.crouch;
  const o: V = [R(P.hip[0]) + P.shake, R(P.hip[1] - P.lift * L(1, 0.3, sL) - P.rear * sL)];
  const sq = P.squash;
  const lean = R(P.lean);

  // body: the baby's upright pear swells (f6) and settles low on the planted legs (f7)
  let bc: V = LV(LV([39.5, 64.5], [40, 59], sB), [41, 59.5], sL);
  let brx = L(7.5, 13, sB);
  let bry = L(7.5, 11.5, sB);
  bc = [bc[0] - cr * L(0, 3, sL), bc[1] + cr * L(2, 6, sL)];
  bry -= cr * L(1, 4, sL);
  brx += cr * L(1, 3, sL);
  brx *= 1 + 0.1 * sq;
  const bry2 = bry * (1 - 0.1 * sq);
  bc = [bc[0], bc[1] + (bry - bry2)];
  bry = bry2;
  const body: Ell = { c: addV(bc, o), rx: brx, ry: bry };
  const chest: Ell = { c: addV(addV(LV([42, 62], [49, 55], (sB + sM) / 2), o), [R(lean * 0.3), cr * L(0, 5, sL) + L(6, 13, sM) * 0.1 * sq]), rx: L(5.5, 9, sM), ry: L(6, 13, sM) * (1 - 0.1 * sq) - cr * L(0, 3, sL) };
  const belly: Ell = { c: addV(addV(LV([45.5, 65.5], [54.5, 59], (sB + sM) / 2), o), [0, cr * L(0, 4, sL) + L(5.2, 9, (sB + sM) / 2) * 0.1 * sq]), rx: L(3.8, 4.6, sM), ry: L(5.2, 9, (sB + sM) / 2) * (1 - 0.1 * sq) - cr * L(0, 3, sL) };

  // head: rides the body top; the muzzle broadens on f8
  const ht = 0.35 * sB + 0.35 * sL + 0.3 * sM;
  let hc: V = LV([45, 46.5], [57, 37], ht);
  // during the growth the head stays low and back (no long neck) until the mane frames it (critique r1 #8)
  const low = clamp01(sB * (1 - age) * 1.2);
  hc = [hc[0] - low * 3, hc[1] + low * 6];
  hc = [hc[0] + lean + R(P.head[0]) + cr * L(1, 4, sL), hc[1] + R(P.head[1]) + cr * L(4, 12, sL) + R(sq * 1.5)];
  hc = addV(hc, o);
  // where the head would be without its own follow offsets (the rear mane stays with the body)
  const headRest: V = [hc[0] - lean - R(P.head[0]), hc[1] - R(P.head[1])];
  const head: Ell = { c: hc, rx: L(10.5, 9.5, ht), ry: L(9.5, 8.5, ht) };
  const tl = P.tilt;
  // the face turns about the head centre with the pitch (tilt 2 ≈ the snout 30° up)
  const ta = -tl * 0.25;
  const snout: Ell = { c: addV(hc, rot([L(8.5, 6.5, sM), L(3.5, 3.5, sM)], ta)), rx: L(4.5, 4.6, sM), ry: L(3.5, 4.8, sM) };
  // the jaw drops ≥ 4 px when wide (critique r1 #9)
  const jaw: Ell = { c: addV(snout.c, rot([L(-1, -1.5, sM) + P.jaw * 1.4, L(2.2, 3.4, sM) + P.jaw * L(3.6, 4.6, sM)], ta)), rx: L(3.6, 4.6, sM) + P.jaw * 1.4, ry: L(1.6, 2.2, sM) + P.jaw * 0.6 };
  const cheek: Ell = { c: addV(hc, [L(3.5, 5, sM), L(4, 6, sM)]), rx: 3 + P.cheeks * 3.2, ry: 2.4 + P.cheeks * 2 };
  const eye: V = addV(hc, rot([L(4.5, 3.5, sM), L(-1.5, -1.5, sM)], ta * 0.8));
  const mouth: V = [snout.c[0] + snout.rx - 1, snout.c[1] + 1 + R(P.jaw * 2)];
  const crown: V = addV(hc, [-2.5, -head.ry + 0.5]);

  // legs: the baby's stubby thigh + feet become the haunch + hind paw; the forepaws plant as forelegs (f7)
  const haunch: Ell = { c: addV(addV(LV([38.5, 68.5], [31, 63.5], sL), [-cr * L(0, 1, sL), cr * L(1, 3, sL)]), o), rx: L(4.6, 10, sL) + cr * L(0, 2, sL), ry: L(4.2, 9.5, sL) - cr * L(1, 3, sL) };
  const tuck = Math.min(P.lift, 3);
  const footY = (y: number) => y - tuck + Math.min(0, o[1] + tuck);
  const footN: Ell = { c: [L(43.5, 27, sL) + o[0], footY(L(72.6, 72.5, sL))], rx: L(3.4, 5.5, sL), ry: L(1.9, 2, sL) };
  const footF: Ell = { c: [L(36.5, 36, sL) + o[0], footY(L(72.6, 72.6, sL))], rx: L(2.6, 3, sL), ry: L(1.7, 1.8, sL) };
  // forelegs: baby stubby arms (forepaw raise over the face) → grown planted forelegs (stomp = lift px;
  // the sphinx crouch lays them forward along the floor)
  const lie = sL >= 0.5 ? cr : 0;
  const baseN: V[] = [LV([45.5, 61], [53, 52], sL), LV([47.5, 63.5], [55, 63 - lie * 3], sL), LV([49, 64.5], [56, 70.5 - lie * 0.5], sL)];
  const baseF: V[] = [LV([42, 61.5], [47, 52], sL), LV([43.5, 64], [48.5, 63 - lie * 3], sL), LV([45, 65], [49, 70.5 - lie * 0.5], sL)];
  const raise = (k: number, p: V[]): V[] => {
    if (sL < 0.5) return p.map((q, i) => (i === 0 ? q : addV(q, [k * (i === 1 ? 2 : 4), -k * (i === 1 ? 6 : 10)])));
    const g = k * (1 - lie);
    return p.map((q, i) => (i === 0 ? q : addV(q, [g * 0.6 * i, -g * 2 * i])));
  };
  const armN = raise(P.armN, baseN).map((q) => addV(q, [o[0], o[1] + cr * L(2, 0, sL)]));
  const armF = raise(P.armF, baseF).map((q) => addV(q, [o[0], o[1] + cr * L(2, 0, sL)]));
  // the grown paws stay on the floor while the body hops (a stomp lifts them by armN / armF only)
  if (sL >= 0.5) {
    const fix = (a: V[]) => (a[2] = [a[2][0], a[2][1] - o[1] + Math.min(0, o[1])]);
    fix(armN);
    fix(armF);
  }
  const pawN: Ell = { c: addV(armN[2], [L(0.5, 1.5, sL), L(0.3, 1.1, sL)]), rx: L(1.8, 4.2, sL), ry: L(1.5, 2, sL) };
  const pawF: Ell = { c: addV(armF[2], [L(0.5, 1.5, sL), L(0.3, 1.5, sL)]), rx: L(1.4, 3.6, sL), ry: L(1.2, 1.8, sL) };

  // tail: the baby's short curl up behind (shell on the tip); grown: round the haunch along the floor
  const tc = P.tail;
  const tap = P.tailTap;
  // HA-9: the tail's floor part never moves in idle / guard (the curl and the tap swing the raised end only)
  const babyTail: V[] = [
    [34, 69],
    [29.5, 71.5],
    [25.5, 70.5],
    [23.5, 67 + tap * 0.5],
    [24 + tc * 22, 64 + tap * 1 - tc * 6],
  ];
  const grownTail: V[] = [
    [23, 62],
    [17, 67],
    [18.5, 71.8],
    [27, 72.2],
    [35, 70.4],
  ];
  const tail = babyTail.map((q, i) => addV(LV(q, grownTail[i], sL), [o[0], i < 2 ? o[1] : Math.min(o[1], 0) * (sL < 0.5 ? 1 : 0)]));
  const tailW: [number, number] = [L(4.4, 7, sL), L(2.4, 3, sL)];
  const tip = tail[4];
  const prev = tail[3];
  // the cup rides the tip: baby — dome back (left), the jagged rim facing the body; curled in front
  // (guard) it turns round to face the foe as a shield; grown — a band on the tip in front of the haunch,
  // dome forward (critique r1 #4)
  const shell = {
    c: tip,
    tilt: L(0.3 - tap * 0.25 + tc * 0.2, Math.atan2(tip[1] - prev[1], tip[0] - prev[0]) - Math.PI / 2, sL),
    flip: sL >= 0.5 || tc > 0.5,
  };

  // wings: the nubs on the back; grown, the tips folded up into the mane
  // (grown: the tips lie flat back along the top of the mane, never up like ears; critique r1 #1)
  const back: V = addV(LV([35, 57], [35, 41], sW), [o[0] + R(lean * 0.3), o[1] + cr * L(2, 10, sL)]);
  const wo = P.wingOpen;
  const wingN = { base: back, tip: addV(back, [L(-5.5, -14, sW) - wo * L(2, 1, sW), L(-3, -10, sW) - P.wingN - wo * L(2, 6, sW)]) };
  const backF: V = addV(back, [L(3, 5, sW), L(-2, -4, sW)]);
  const wingF = { base: backF, tip: addV(backF, [L(-3.5, -11, sW) - wo * L(1, 1, sW), L(-3.5, -12, sW) - P.wingF - wo * L(2, 6, sW)]) };

  const core: V = [R(body.c[0]), R(body.c[1])];
  void sH;
  void sN;
  return { age, sB, sL, sM, sH, sW, sN, o, body, chest, belly, head, headRest, snout, jaw, cheek, eye, mouth, crown, haunch, footN, footF, armN, armF, armW: [L(3.4, 7, sL), L(2.8, 5.6, sL)], pawN, pawF, tail, tailW, tailFront: sL >= 0.5 || tc > 0.5, shell, wingN, wingF, core };
}

// ------------------------------------------------------------------ the workspace

let WS: Workspace | null = null;
function ws(light: Light): Workspace {
  if (!WS) WS = new Workspace(W, H, light, MATS);
  return WS.begin(light);
}

const ell = (r: Raster, e: Ell, mat: number, z = 0, ang = 0, flat = 1.6, bias = 0) => r.ell(e.c, e.rx, e.ry, ang, mat, { z, flat, bias });

/** lay one rendered raster layer onto the frame with a seam (default) or a crease */
function lay(p: PixelCanvas, w: Workspace, r: Raster, seam = SEAM): PixelCanvas {
  const c = w.render(r);
  composite(p, c, seam);
  return c;
}

// ------------------------------------------------------------------ cloud lobes

interface Lobe {
  c: V;
  r: number;
}

/** A group of cloud lobes, each its own dome (calm flat planes), laid back to front with seams. */
function cloudLobes(p: PixelCanvas, w: Workspace, lobes: readonly Lobe[], light: Light, spike = 0): void {
  for (const l of lobes) {
    if (l.r < 1) continue;
    const q = w.canvas();
    puffLobe(q, l.c[0], l.c[1], l.r, light, l.r >= 3 ? spike : 0);
    composite(p, q, LOBE_SEAM);
  }
}

/**
 * The grown mane, head-relative [dx, dy, r, t0] (grown head at (57, 37)): ONE continuous lobed dome
 * from the crown over the nape and the shoulders down the back to the haunch (critique r1 #1). t0 is the
 * age the lobe starts at: the mane grows OUT of the cowlick during the growth (f7 crown, f8 nape, f9
 * shoulders, f10 back + ruff, f11 the last back lobes; critique r1 #8).
 */
const MANE_BACK: readonly (readonly [number, number, number, number])[] = [
  [-33, 13, 5, 4 / 6],
  [-30, 5, 5.5, 4 / 6],
  [-24, 11, 6.5, 4 / 6],
  [-24, -2, 6, 3 / 6],
  [-17, -7, 6, 2 / 6],
  [-14, 14, 6, 4 / 6],
  [-16, 5, 7.5, 3 / 6],
  [-10, -10, 5.5, 1 / 6],
  [-9, -1, 7, 2 / 6],
  [-3, -9, 5, 1 / 6],
  [-6, 9, 6.5, 3 / 6],
];
const MANE_FRONT: readonly (readonly [number, number, number, number])[] = [
  [-2, 12, 4.5, 4 / 6],
  [4, 11, 4, 4 / 6],
  [1, -7, 3, 3 / 6],
];

/** how far a lobe that starts at age t0 has grown (one growth frame = 1/6) */
const lobeAt = (age: number, t0: number): number => clamp01((age - t0) * 6);

function maneLobes(S: Skel, P: HatchPose, front: boolean): Lobe[] {
  const hc = S.head.c;
  const list = front ? MANE_FRONT : MANE_BACK;
  const bris = P.mane + P.fluff;
  const out: Lobe[] = [];
  list.forEach(([dx, dy, r, t0], i) => {
    const t = lobeAt(S.age, t0);
    if (t <= 0) return;
    // drift: each lobe bobs 1 px on its own phase; bristle pushes it out from the head centre
    // (only every third lobe bobs: a resting target is struck in any idle frame, HA-21 phase)
    const ph = (P.drift + i / list.length) % 1;
    const bob = i % 4 === 0 && ph >= 0.5 ? -1 : 0;
    const n = Math.hypot(dx, dy) || 1;
    const k = L(0.55, 1, t);
    // lobes near the head follow it, the rear ones stay with the body
    const fw = clamp01(1.25 - n / 16);
    const hb: V = [S.headRest[0] + (hc[0] - S.headRest[0]) * fw, S.headRest[1] + (hc[1] - S.headRest[1]) * fw];
    out.push({ c: [R(hb[0] + dx * k + (dx / n) * bris * 2), R(hb[1] + dy * k + bob + (dy / n) * bris * 2)] as V, r: r * L(0.55, 1, t) * (1 + bris * 0.12) });
  });
  return out;
}

// ------------------------------------------------------------------ the eggshell

/** 2-px earth2 speckle clusters on the shell's shadow plane (earth3), at most n. */
function speckle(q: PixelCanvas, light: Light, n: number): void {
  let k = 0;
  for (let y = 0; y < H && k < n; y++)
    for (let i = 0; i < W && k < n; i++) {
      const x = light.side < 0 ? W - 1 - i : i;
      if (q.get(x, y) !== PAL.earth3 || q.get(x, y + 1) !== PAL.earth3) continue;
      if ((x * 3 + y * 5) % 7 !== 0) continue;
      q.set(x, y, PAL.earth2);
      q.set(x, y + 1, PAL.earth2);
      k++;
    }
}

/** The egg's outline test (frame px, egg centre c, tilt in rad). */
const EGG_RX = 5.6;
const EGG_RY = 7.2;
function eggAt(c: V, tilt: number, x: number, y: number): { u: number; v: number; d: number } {
  const dx = x + 0.5 - c[0];
  const dy = y + 0.5 - c[1];
  const u = dx * Math.cos(tilt) + dy * Math.sin(tilt);
  const v = -dx * Math.sin(tilt) + dy * Math.cos(tilt);
  // egg: narrower toward the top (v < 0)
  const rx = EGG_RX * (v < 0 ? 1 - (-v / EGG_RY) * 0.12 : 1);
  return { u, v, d: (u * u) / (rx * rx) + (v * v) / (EGG_RY * EGG_RY) };
}

interface EggOpts {
  c: V;
  tilt: number;
  /** knit wall 0…1 (draws the shell from the floor up to this height; seams while < full egg) */
  wall: number;
  seams: boolean;
  crack: number;
  burst: number;
  /** squash 0…1 (the landing) */
  squash: number;
}

/** The egg layer (shell plates, speckles, cracks / seams), returned for compositing. */
function eggLayer(w: Workspace, light: Light, e: EggOpts): PixelCanvas {
  const r = w.raster();
  const c = e.c;
  const sx = 1 + e.squash * 0.12;
  const sy = 1 - e.squash * 0.1;
  const cc: V = [c[0], c[1] + EGG_RY * (1 - sy)];
  r.ell(cc, EGG_RX * sx, EGG_RY * sy, e.tilt, M.SHELL, { z: 20, flat: 1.2, bias: 0.02 });
  const q = w.render(r);
  // the narrower top
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (q.isOpaque(x, y) && eggAt(cc, e.tilt, x, y).d > 1.08 * sx) q.erase(x, y);
  const bottom = cc[1] + EGG_RY * sy;
  const topY = bottom - EGG_RY * 2 * sy * e.wall;
  // the knit wall: everything above the rising zigzag edge is still missing
  if (e.wall < 1)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!q.isOpaque(x, y)) continue;
        const tooth = (Math.floor((x + 40) / 2) % 2) * 1;
        if (y < topY + tooth) q.erase(x, y);
      }
  // the burst: the top shell has popped off (the lower cup stays, its zigzag rim at the waist)
  if (e.burst > 0)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!q.isOpaque(x, y)) continue;
        const tooth = (Math.floor((x + 40) / 2) % 2) * 2;
        if (y < cc[1] - 1 + tooth) q.erase(x, y);
      }
  speckle(q, light, 3);
  // seams: the knit stitches (mist, 1 px) between the plates while the egg re-knits
  if (e.seams) {
    const mid = R(cc[0]);
    for (let y = R(topY); y < R(bottom); y++) if (q.isOpaque(mid, y) && q.isOpaque(mid, y - 1)) q.set(mid + ((y >> 1) & 1), y, PAL.mist);
    const ym = R(cc[1] + 1);
    for (let x = R(cc[0] - EGG_RX); x <= R(cc[0] + EGG_RX); x++) if (q.isOpaque(x, ym) && q.isOpaque(x, ym - 1) && q.isOpaque(x, ym + 1)) q.set(x, ym + ((x >> 1) & 1) - 0, PAL.mist);
  }
  // the crack: a zigzag line from the top down (dark earth2 with a lit skin4 lip toward the light)
  if (e.crack > 0) {
    const len = R(e.crack * 11);
    let x = R(cc[0] + 1);
    let y = R(cc[1] - EGG_RY * sy + 2);
    for (let i = 0; i < len; i++) {
      if (!q.isOpaque(x, y)) break;
      q.set(x, y, PAL.earth1);
      const lx = x + (light.side < 0 ? -1 : 1);
      if (q.isOpaque(lx, y) && q.get(lx, y) !== PAL.earth1) q.set(lx, y, PAL.skin4);
      y += 1;
      x += i % 3 === 0 ? 1 : i % 3 === 1 ? -1 : 0;
      if (i === 5) x -= 2;
    }
  }
  return q;
}

/** The popped top shell of the summon burst (flies up, tipped), or the cap riding the head. */
function capLayer(w: Workspace, light: Light, at: V, tilt: number): PixelCanvas {
  const q = w.canvas();
  stampAt(q, SHELL_CAP, R(at[0]), R(at[1]), light, SHELL_KEY, tilt < 0);
  return q;
}

// ------------------------------------------------------------------ eyes

function babyEye(p: PixelCanvas, P: HatchPose, e: V): void {
  const x = R(e[0]) - 1;
  const y = R(e[1]) - 2;
  const k = PAL.night0;
  const shut = P.blink >= 0.75;
  const half = P.blink >= 0.35 && !shut;
  const put = (dx: number, dy: number, c: number) => p.set(x + dx, y + dy, c);
  switch (P.eye) {
    case 1: // squeezed shut: a ">" pointing forward
      put(0, 1, k), put(1, 2, k), put(2, 2, k), put(0, 3, k), put(3, 2, k);
      return;
    case 2: // X
      put(0, 0, k), put(3, 0, k), put(1, 1, k), put(2, 1, k), put(1, 2, k), put(2, 2, k), put(0, 3, k), put(3, 3, k);
      return;
    case 3: // white-hot (hitMagic)
      for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 4; xx++) if (!((yy === 0 || yy === 4) && (xx === 0 || xx === 3))) put(xx, yy, yy >= 3 ? PAL.mist : PAL.white);
      return;
    case 4: // swirl (dazed)
      put(1, 0, k), put(2, 0, k), put(3, 1, k), put(3, 2, k), put(2, 3, k), put(1, 3, k), put(0, 2, k), put(0, 1, k), put(2, 2, PAL.gold3), put(1, 1, PAL.gold3);
      return;
    case 7: // happy arc ^
      put(0, 2, k), put(1, 1, k), put(2, 1, k), put(3, 2, k);
      return;
  }
  if (shut) {
    put(0, 2, k), put(1, 3, k), put(2, 3, k), put(3, 2, k);
    return;
  }
  const narrow = P.eye === 5;
  const wide = P.eye === 6;
  // the round eye: night0 pupil, gold3 iris crescent below, the white catch-light (the brightest pixel)
  // 4×5: night0 pupil, the gold3 iris ring on the lower and outer (front) side (critique r1 #5)
  const rows = wide ? ['.kk.', 'kkkk', 'kkkk', 'kkkg', 'kkgg', '.gg.'] : ['.kk.', 'kkkk', 'kkkg', 'kkgg', '.gg.'];
  const oy = wide ? -1 : 0;
  for (let yy = 0; yy < rows.length; yy++)
    for (let xx = 0; xx < 4; xx++) {
      const ch = rows[yy][xx];
      if (ch === '.') continue;
      if ((half || narrow) && yy < 2) continue;
      put(xx, yy + oy, ch === 'g' ? PAL.gold3 : k);
    }
  if (half || narrow) put(0, 2, k), put(1, 2, k), put(2, 2, k), put(3, 2, k);
  // the lid: a 1-px crease line over the eye
  if (!half && !narrow) for (let xx = 0; xx < 4; xx++) if (p.isOpaque(x + xx, y + oy - 1)) put(xx, oy - 1, PAL.leaf1);
  const lk = P.look;
  const cx = 1 + Math.max(-1, Math.min(1, R(lk[0])));
  const cy = (half || narrow ? 2 : 1) + oy + Math.max(-1, Math.min(1, R(lk[1])));
  put(cx, cy, PAL.white);
}

function grownEye(p: PixelCanvas, P: HatchPose, e: V): void {
  const x = R(e[0]) - 1;
  const y = R(e[1]) - 1;
  const k = PAL.night0;
  const put = (dx: number, dy: number, c: number) => p.set(x + dx, y + dy, c);
  if (P.eye === 1 || P.blink >= 0.75 || P.eye === 7) {
    put(0, 1, k), put(1, 1, k), put(2, 1, k), put(3, 0, k);
    return;
  }
  if (P.eye === 3) {
    put(0, 0, PAL.white), put(1, 0, PAL.white), put(2, 0, PAL.white), put(3, 0, PAL.white), put(0, 1, PAL.white), put(1, 1, PAL.white), put(2, 1, PAL.mist), put(3, 1, PAL.mist);
    return;
  }
  // X eyes belong to the death only (critique r1 #10); the grown "dazed" (4) is a narrowed glare
  if (P.eye === 2) {
    put(0, 0, k), put(2, 0, k), put(1, 1, k), put(0, 2, k), put(2, 2, k);
    return;
  }
  // gold eye (4×3) with a night0 slit under the heavy brow line
  for (let xx = -1; xx < 4; xx++) put(xx, -1, PAL.leaf1);
  put(0, 0, PAL.gold3), put(1, 0, PAL.gold3), put(2, 0, k), put(3, 0, PAL.gold3);
  put(0, 1, PAL.gold3), put(1, 1, PAL.gold3), put(2, 1, k), put(3, 1, PAL.gold3);
  if (P.eye !== 5 && P.eye !== 4 && P.blink < 0.35) put(1, 2, PAL.gold3), put(2, 2, k), put(3, 2, PAL.gold3);
  if (P.eye === 6) put(0, -1, PAL.gold3), put(1, -1, PAL.gold3), put(2, -1, k), put(3, -1, PAL.gold3);
}

// ------------------------------------------------------------------ the draw

/** The age a pose is drawn at (the baby shell: grow; the grown shell: 1 − unAge). */
export function ageOf(P: HatchPose, shellAge: number | undefined): number {
  return shellAge === undefined ? clamp01(P.grow) : clamp01(shellAge - P.unAge);
}

/** The ring's puffs of a pose (frame px) — the cinematic's hour-puffs land on exactly these. */
export function ringGeo(P: HatchPose): { cx: number; cy: number; rx: number; ry: number } {
  return { cx: RING.cx + R(P.hip[0]) + P.shake, cy: RING.cy + R(P.hip[1] - P.lift) - R(P.ringY) + R(P.crouch * 3), rx: RING.rx + R(P.ringFlare), ry: RING.ry + R(P.ringFlare * 0.4) + R(P.wall * 2) };
}
export function posePuffs(P: HatchPose, age: number) {
  const S = subAges(age);
  if (S.sN < 1 || P.ball >= 0.5) return [];
  const g = ringGeo(P);
  return ringPuffs(P.ring, { cy: g.cy, rx: g.rx, ry: g.ry }).map((q) => ({ ...q, x: q.x + g.cx - RING.cx }));
}

/** the pose as one form draws it (the grown form curls into its ball one frame earlier: ballG) */
export function formPose(P: HatchPose, age: number): HatchPose {
  return age >= 0.5 && P.ballG > P.ball ? { ...P, ball: P.ballG } : P;
}

/** a pose drawn as a story state (the ball / the egg) instead of the standing body */
export const isStory = (P: HatchPose): boolean => P.ball >= 0.5 || P.egg > 0 || P.knit > 0;

export function drawHatch(p: PixelCanvas, P0: HatchPose, light: Light, shellAge?: number): void {
  const age = ageOf(P0, shellAge);
  const P = formPose(P0, age);
  const w = ws(light);
  const eggC: V = [EGG_C[0] + R(P.hip[0]) + P.shake, EGG_C[1] + R(P.hip[1] - P.lift)];
  // parts with 1-px craft (the shell cup's rim) are laid after the despeckle pass
  const late: (() => void)[] = [];
  if (isStory(P)) drawStory(p, w, P, light, age, shellAge !== undefined);
  else drawBody(p, w, P, light, age, late);
  if (P.plates > 0) drawPlates(p, w, P, light, eggC, isStory(P));
  despeckle(p, 1);
  hideRim(p, light);
  for (const f of late) f();
  fillPockets(p, GY - 2);
  p.outline(PAL.ink);
  lightPixels(p, P, light, age);
}

/**
 * IŞ-7: the sky's reflection, a 1-px `water4` line on the hide's shadow-side silhouette (right and
 * underside for P1; never on the floor contact rows).
 */
function hideRim(p: PixelCanvas, light: Light): void {
  const s = -light.side;
  const hits: number[] = [];
  for (let y = 1; y < GY - 3; y++)
    for (let x = 1; x < W - 1; x++) {
      const c = p.get(x, y);
      if (c !== PAL.leaf3 && c !== PAL.leaf2) continue;
      if (p.isOpaque(x + s, y) && p.isOpaque(x, y + 1)) continue;
      if (!p.isOpaque(x - s, y) || !p.isOpaque(x, y - 1)) continue;
      if (!p.isOpaque(x + s, y) || (!p.isOpaque(x, y + 1) && !p.isOpaque(x + s, y + 1))) hits.push(x, y);
    }
  for (let i = 0; i < hits.length; i += 2) p.set(hits[i], hits[i + 1], PAL.water4);
}

// ------------------------------------------------------------------ the standing body (both forms)

function drawBody(p: PixelCanvas, w: Workspace, P: HatchPose, light: Light, age: number, late: (() => void)[]): void {
  const S = skel(P, age);
  const puffs = posePuffs(P, age);

  // ---- 0: the back half of the waist ring (behind the body)
  const wallRows = puffs.length && P.wall > 0 ? wallPuffs(P) : null;
  if (wallRows) for (const row of wallRows) ringHalf(p, w, row, true, light, 3.1 + P.wall * 0.9);
  else ringHalf(p, w, puffs, true, light);

  // ---- 1: far parts (far foot, far arm / foreleg, far wing)
  {
    const r = w.raster();
    ell(r, S.footF, M.FAR, -4, 0, 1.3);
    r.tube(S.armF, S.armW[0] * 0.9, S.armW[1] * 0.9, M.FAR, { z: -4, flat: 1.3 });
    ell(r, S.pawF, M.FAR, -3, 0, 1.3);
    if (S.sW < 0.5) r.ell(LV(S.wingF.base, S.wingF.tip, 0.6), 2.6, 2.1, -0.6, M.FAR, { z: -5, flat: 1.2 });
    lay(p, w, r);
  }

  // ---- 2: the tail (behind the body for the baby, curled in front for the grown) + its shell
  const drawTail = () => {
    const r = w.raster();
    // two tubes so the floor part's width never depends on where the raised end swings (HA-9)
    const wm = (S.tailW[0] + S.tailW[1]) / 2;
    r.tube(S.tail.slice(0, 3), S.tailW[0], wm, M.HIDE, { z: 2, flat: 1.3 });
    r.tube(S.tail.slice(2), wm, S.tailW[1], M.HIDE, { z: 2, flat: 1.3 });
    lay(p, w, r, S.sL >= 0.5 ? CREASE : SEAM);
    if (P.helmet < 0.25)
      late.push(() => {
        const q = new PixelCanvas(W, H);
        shellCup(q, R(S.shell.c[0]), R(S.shell.c[1]) - (S.sL < 0.5 && !S.shell.flip ? 2 : 0), light, S.shell.flip);
        composite(p, q, SEAM);
      });
  };
  if (!S.tailFront) drawTail();

  // ---- 4: the body (body, chest, belly plate), then the haunch + hind foot
  {
    const r = w.raster();
    r.ell(S.body.c, S.body.rx, S.body.ry, 0, M.HIDE, { flat: 1.3 });
    // the baby's short neck under the big head (the head sits ON the pear, no gap)
    if (S.sB < 1) r.ell(LV(S.body.c, S.head.c, 0.5), L(6, 3, S.sB), L(4.5, 2, S.sB), 0, M.HIDE, { z: -1, flat: 1.3 });
    ell(r, S.chest, M.HIDE, 1, 0, 1.3);
    if (S.sM < 0.5) ell(r, S.belly, M.BELLY, 3 + S.body.rx * 0.4, 0, 1.3, 0.05);
    lay(p, w, r);
    const th = w.raster();
    ell(th, S.haunch, M.HIDE, 4, 0, 1.4);
    ell(th, S.footN, M.HIDE, 6, 0, 1.25);
    lay(p, w, th, S.sL >= 0.5 ? CREASE : SEAM);
  }
  if (S.tailFront) drawTail();

  // ---- 5: the near wing nub (baby: a 6×5 leaf3 lobe, inked off the back) / the back mane + the folded
  // wing tips lying back along it (grown)
  if (S.sW < 0.5) {
    const r = w.raster();
    r.ell(LV(S.wingN.base, S.wingN.tip, 0.55), 3.3, 2.6, -0.55 - P.wingOpen * 0.4, M.TIP, { z: 6, flat: 1.15, bias: 0.12 });
    lay(p, w, r, INK_SEAM);
  }
  if (S.sW >= 0.5) {
    // the folded wing tips: their roots under the back mane, the points sticking out behind it
    const rf = w.raster();
    rf.facet(wingTip(S.wingF.base, S.wingF.tip, 2.6, P.wingOpen), M.TIP, [-0.2, -0.3, 1], -5, -0.3);
    lay(p, w, rf);
    const r = w.raster();
    r.facet(wingTip(S.wingN.base, S.wingN.tip, 3, P.wingOpen), M.TIP, [-0.5, -0.6, 1], 0, 0.25);
    lay(p, w, r);
  }
  cloudLobes(p, w, maneLobes(S, P, false), light, P.fluff >= 0.9 ? 2 : P.fluff > 0.5 ? 1 : 0);

  // ---- 6: near arm / foreleg
  {
    const r = w.raster();
    r.tube(S.armN, S.armW[0], S.armW[1], M.HIDE, { z: 8, flat: 1.3 });
    ell(r, S.pawN, M.HIDE, 9, 0, 1.3);
    lay(p, w, r, S.sL >= 0.5 ? CREASE : SEAM);
  }

  // ---- 7: the head: one raster (skull, snout, cheek, jaw), laid on the body with a crease
  const smear = R(P.smear);
  if (smear) {
    // HA-12: the release smear — the head's silhouette stretched back along its path (hide, flat)
    const r = w.raster();
    for (let k = 1; k <= smear; k++) r.ell([S.head.c[0] - k * 1.5, S.head.c[1] + k * 0.4], S.head.rx * 0.9, S.head.ry * 0.85, 0, M.FAR, { z: 9, flat: 2.5, bias: -0.1 });
    lay(p, w, r);
  }
  {
    const r = w.raster();
    const ang = -P.tilt * 0.12;
    r.ell(S.head.c, S.head.rx, S.head.ry, ang, M.HIDE, { z: 10, flat: 1.35 });
    r.ell(S.snout.c, S.snout.rx, S.snout.ry, ang, M.HIDE, { z: 12, flat: 1.2, bias: 0.04 });
    if (P.cheeks > 0.05) ell(r, S.cheek, M.HIDE, 13, 0, 1.3, 0.08);
    if (S.sM >= 0.5 || P.jaw > 0.2) ell(r, S.jaw, S.sM >= 0.5 ? M.BELLY : M.HIDE, 11, 0, 1.3);
    // the open mouth's cavity between the snout and the dropped jaw (painted skin1 / skin3 in surface())
    if (P.jaw > 0.2) r.ell(LV(S.snout.c, S.jaw.c, 0.55), S.snout.rx * 0.8, Math.max(1.5, (S.jaw.c[1] - S.snout.c[1]) * 0.55), ang, M.HIDE, { z: 10.5, flat: 1.3 });
    lay(p, w, r, CREASE);
  }
  // horns (grown, f9): small ivory ram curls half buried in the mane
  if (S.sH > 0) drawHorn(p, w, S, light);
  // the front mane (ruff under the jaw, the brow) and the cowlick (until the crown lobes replace it)
  cloudLobes(p, w, maneLobes(S, P, true), light, P.fluff >= 0.9 ? 2 : P.fluff > 0.5 ? 1 : 0);
  if (lobeAt(S.age, 1 / 6) < 0.5) {
    const q = w.canvas();
    const cx = R(S.crown[0] + P.cow);
    const cy = R(S.crown[1] + 1 - P.fluff * 2);
    stampAt(q, P.fluff > 0.5 || P.tuft > 0.7 ? COWLICK_UP : COWLICK, cx, cy, light, CLOUD_KEY);
    // static: the cowlick stands on end, three spikes 3 px up (critique r1 #11)
    if (P.fluff > 0.5)
      for (const [dx, hgt] of [[-3, 2], [0, 3], [3, 2]] as const)
        for (let k = 1; k <= hgt; k++) q.set(cx + dx, cy - 6 - k, k === hgt ? PAL.white : PAL.mist);
    composite(p, q, SEAM);
  }
  // chest tuft (baby): a small cloud puff at the throat
  if (S.sN < 1 && S.sM < 0.5) {
    const hc = S.head.c;
    const t = P.tuft + P.fluff;
    const q = w.canvas();
    stampAt(q, t > 0.5 ? TUFT_UP : TUFT, R(hc[0] - 1), R(hc[1] + S.head.ry + 1), light, CLOUD_KEY);
    composite(p, q, SEAM);
  }
  // the helmet riding the head / sliding down the back (summon f10–f11)
  if (P.helmet >= 0.25) {
    const at: V = P.helmet >= 0.75 ? [S.crown[0] + 1, S.crown[1] + 2] : [S.body.c[0] - S.body.rx + 1, S.body.c[1] - 3];
    composite(p, capLayer(w, light, at, P.helmet >= 0.75 ? 1 : -1), SEAM);
  }

  // ---- 8: the front half of the ring
  if (wallRows) for (const row of wallRows) ringHalf(p, w, row, false, light, 3.1 + P.wall * 0.9);
  else ringHalf(p, w, puffs, false, light);

  // ---- 9: the details on the surface (before the outline: they are inside the silhouette)
  surface(p, P, S);
}

/** a folded wing tip: a pointed leaf facet from its base to its tip */
function wingTip(base: V, tip: V, hw: number, open: number): V[] {
  const d: V = [tip[0] - base[0], tip[1] - base[1]];
  const n = Math.hypot(d[0], d[1]) || 1;
  const px: V = [-d[1] / n, d[0] / n];
  const k = hw * (1 + open * 0.6);
  return [
    [base[0] + px[0] * k, base[1] + px[1] * k],
    [base[0] + d[0] * 0.65 + px[0] * k * 0.8, base[1] + d[1] * 0.65 + px[1] * k * 0.8],
    tip,
    [base[0] + d[0] * 0.5 - px[0] * k * 0.4, base[1] + d[1] * 0.5 - px[1] * k * 0.4],
    [base[0] - px[0] * k * 0.6, base[1] - px[1] * k * 0.6],
  ];
}

/**
 * The grown horn: a SOLID ivory ram curl (critique r1 #1) tucked behind and above the eye: a filled
 * disc lit skin4 / earth4 / earth3 by the key light, an earth2 spiral groove, the curl's tip rolling
 * forward under it. No hide shows through.
 */
function drawHorn(p: PixelCanvas, w: Workspace, S: Skel, light: Light): void {
  const k = S.sH;
  const hc = S.head.c;
  const c: V = [R(hc[0] - 3) + 0.5, R(hc[1] - 4.5) + 0.5];
  const r = 1.4 + 2.2 * k;
  const q = w.canvas();
  const lv = light.v2;
  const tip: V = [c[0] + r * 0.55, c[1] + r * 0.85];
  for (let y = Math.floor(c[1] - r - 1); y <= Math.ceil(c[1] + r + 2); y++)
    for (let x = Math.floor(c[0] - r - 1); x <= Math.ceil(c[0] + r + 2); x++) {
      const dx = x + 0.5 - c[0];
      const dy = y + 0.5 - c[1];
      const inDisc = dx * dx + dy * dy <= r * r;
      const tx = x + 0.5 - tip[0];
      const ty = y + 0.5 - tip[1];
      const inTip = k > 0.5 && tx * tx * 1.6 + ty * ty <= 2.2;
      if (!inDisc && !inTip) continue;
      const s = inDisc ? (dx * lv[0] + dy * lv[1]) / r : -0.5;
      q.set(x, y, s > -0.1 ? PAL.skin4 : s > -0.55 ? PAL.earth4 : PAL.earth3);
    }
  if (k >= 0.6)
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const a = -Math.PI * 0.6 + t * Math.PI * 2.2;
      const rr = 0.4 + t * (r - 1.3);
      const x = Math.floor(c[0] + Math.cos(a) * rr);
      const y = Math.floor(c[1] + Math.sin(a) * rr);
      if (q.isOpaque(x, y)) q.set(x, y, PAL.earth2);
    }
  composite(p, q, SEAM);
}

/** one half of the waist ring: separate round puffs (≥ 6×5, no band), lower puffs over upper ones */
function ringHalf(p: PixelCanvas, w: Workspace, puffs: readonly RingPuff[], back: boolean, light: Light, r = 3.1): void {
  const sel = puffs.filter((q) => q.back === back).sort((a, b) => a.y - b.y);
  for (const pf of sel) {
    const q = w.canvas();
    puffLobe(q, pf.x + 0.5, pf.y + 0.5, r, light);
    composite(p, q, LOBE_SEAM);
  }
}

/**
 * The guard's puff wall (critique r1 #3): the ring sunk round the lying body as TWO rows of touching
 * puffs (no band, no links): the lower row on the ring, the upper row half a spacing on and 5 px up,
 * so its top meets the resting muzzle. Upper row first (behind), the lower row over it.
 */
function wallPuffs(P: HatchPose): RingPuff[][] {
  const g = ringGeo(P);
  const k = clamp01(P.wall);
  const lower = ringPuffs(P.ring, { cy: g.cy, rx: g.rx - 2, ry: g.ry }).map((q) => ({ ...q, x: q.x + g.cx - RING.cx }));
  const upper = ringPuffs(P.ring + 1 / 24, { cy: g.cy - R(5 * k), rx: g.rx - 3, ry: g.ry - 1 }).map((q) => ({ ...q, x: q.x + g.cx - RING.cx }));
  return [upper, lower];
}

/** a seam that inks the contact edge (the baby's wing nub stands off its back) */
const INK_SEAM = (): number => PAL.ink;

/** mouth, nostril, belly seams, claws, cheek crease (inside the silhouette, before the outline) */
function surface(p: PixelCanvas, P: HatchPose, S: Skel): void {
  const grownFace = S.sM >= 0.5;
  const sn = S.snout;
  const mx = R(sn.c[0] - sn.rx * 0.3);
  const my = R(sn.c[1] + sn.ry * 0.5);
  const inside = (x: number, y: number) => p.isOpaque(x, y) && p.isOpaque(x, y + 1) && p.isOpaque(x + 1, y);
  if (P.jaw > 0.2) {
    // the open mouth: a wedge from the corner to the lips, `jaw` × 5–6 px wide at the front, skin1
    // cavity with the skin3 tongue along its floor (≤ 20 colours); it follows the head's pitch (critique r1 #9)
    const ta = -P.tilt * 0.25;
    const open = P.jaw * (grownFace ? 6 : 5);
    const len = R(sn.rx * 1.5) + 1;
    const c0: V = [sn.c[0] - sn.rx * 0.45, sn.c[1] + sn.ry * 0.45];
    const done = new Set<number>();
    for (let k = 0; k <= len * 2; k++)
      for (let j = -4; j <= 14; j++) {
        const kk = k / 2;
        const jj = j / 2;
        const h = (open * kk) / len;
        if (jj < -h * 0.2 || jj > h * 0.8) continue;
        const q = addV(c0, rot([kk, jj], ta));
        const x = Math.floor(q[0]);
        const y = Math.floor(q[1]);
        if (done.has(y * W + x)) continue;
        done.add(y * W + x);
        p.set(x, y, jj > h * 0.8 - 1.2 && kk < len - 1 ? PAL.skin3 : PAL.skin1);
      }
  } else {
    // the closed smile, tucked under the snout (a 1-px crease that turns up at the corner)
    const len = grownFace ? 6 : 4;
    for (let k = 0; k < len; k++) {
      const x = mx + k;
      const y = my - (k === 0 ? 1 : 0);
      if (inside(x, y)) p.set(x, y, PAL.leaf1);
    }
  }
  // nostril
  const nx = R(sn.c[0] + sn.rx * 0.55);
  const ny = R(sn.c[1] - sn.ry * 0.35);
  if (inside(nx, ny)) p.set(nx, ny, PAL.leaf1);
  // belly scute seams: short earth2 dashes on the shadow plane (earth3) only (MA-2)
  const b = S.belly;
  for (const fy of [0.3, 0.65]) {
    const y = R(b.c[1] + b.ry * fy);
    for (let x = R(b.c[0] - b.rx); x <= R(b.c[0] + b.rx); x++) if (p.get(x, y) === PAL.earth3) p.set(x, y, PAL.earth2);
  }
  // claws: two skin3 pixels on the near foot's front, and the grown near forepaw's
  const claws = (e: Ell, n: number) => {
    for (let i = 0; i < n; i++) {
      const x = R(e.c[0] + e.rx) - 1 - i * 2;
      const y = R(e.c[1] + e.ry) - 1;
      if (p.isOpaque(x, y) && p.isOpaque(x, y + 1) === false) p.set(x, y, PAL.skin3);
      else if (p.isOpaque(x, y)) p.set(x, y, PAL.skin3);
    }
  };
  if (S.sL < 0.5) claws(S.footN, 2);
  else {
    claws(S.pawN, 3);
    claws(S.pawF, 2);
    claws(S.footN, 2);
  }
}

/** the light pixels (after the outline): eyes, the hiccup ring, the breath of air, the shell glint */
function lightPixels(p: PixelCanvas, P: HatchPose, light: Light, age: number): void {
  if (isStory(P)) {
    storyLights(p, P, light, age);
    return;
  }
  const S = skel(P, age);
  if (S.sM >= 0.5) grownEye(p, P, S.eye);
  else babyEye(p, P, S.eye);
  // the light effects stay inside the frame (Sİ-2: margin ≥ 2): the grown mouth sits near the right edge
  const big = S.sM >= 0.5;
  if (P.hic > 0) hiccupRing(p, Math.min(R(S.mouth[0]) + 1, W - 3 - (big ? 14 : 10)), R(S.mouth[1]) - 1, R(P.hic), big);
  if (P.puff > 0) airPuff(p, Math.min(R(S.mouth[0]) + 2, W - 3 - (big ? 14 : 7)), R(S.mouth[1]), P.puff, big);
  if (P.glint > 0 && P.helmet < 0.25) shellGlint(p, S.shell.c, P.glint, light, S.sL >= 0.5);
}

/** a breath of air at the lips: three mist / white dots fanning forward (a sneeze, a squeak) */
function airPuff(p: PixelCanvas, x: number, y: number, k: number, big: boolean): void {
  const s = big ? 2 : 1;
  const n = R(k * 3);
  const dots: V[] = [
    [1, -2],
    [3, 0],
    [1, 2],
    [5, -3],
    [6, 1],
    [4, 3],
  ];
  for (let i = 0; i < Math.min(dots.length, n * 2); i++) {
    const [dx, dy] = dots[i];
    for (let a = 0; a < s; a++) p.set(x + dx * s + a, y + dy * s, i < 3 ? PAL.white : PAL.mist);
  }
}

/** the anim's one glint (IŞ-8): a white 1 → 3 px sparkle on the shell rim's lit corner */
function shellGlint(p: PixelCanvas, c: V, size: number, light: Light, grown: boolean): void {
  const x = R(c[0]) + (light.side < 0 ? -2 : 2);
  const y = R(c[1]) - (grown ? 2 : 4);
  p.set(x, y, PAL.white);
  if (size >= 2) {
    p.set(x - 1, y, PAL.white);
    p.set(x + 1, y, PAL.white);
    p.set(x, y - 1, PAL.white);
    p.set(x, y + 1, PAL.white);
  }
  if (size >= 3) {
    p.set(x - 2, y, PAL.mist);
    p.set(x + 2, y, PAL.mist);
    p.set(x, y - 2, PAL.mist);
    p.set(x, y + 2, PAL.mist);
  }
}

// ------------------------------------------------------------------ the story states: ball, egg, plates

/** the egg's resting centre on the floor (frame px) */
export const EGG_C: V = [40, 74 - EGG_RY - 0.5];

/** The ball's geometry at a pose (centre, radius) — any age. */
export function ballGeoOf(P: HatchPose, age: number): { c: V; r: number } {
  const curl = clamp01((P.ball - 0.5) * 2);
  const rB = L(10.5, 5.6, curl);
  const rG = L(15, 13, curl);
  const r = L(rB, rG, age);
  return { c: [40 + R(P.hip[0]) + P.shake, 74 - r - 0.5 + R(P.hip[1] - P.lift)], r };
}

function drawStory(p: PixelCanvas, w: Workspace, P: HatchPose, light: Light, age: number, grownShell: boolean): void {
  const eggC: V = [EGG_C[0] + R(P.hip[0]) + P.shake, EGG_C[1] + R(P.hip[1] - P.lift)];
  const tilt = P.eggTilt * 0.14 + (P.float === 1 ? -0.12 : P.float === 3 ? 0.12 : 0);
  // the cloud lip under the floating egg (death f9 on) and the loose mane lobes on the floor
  if (P.float > 0) floatCloud(p, w, light, eggC, P.float, grownShell);

  const showBall = P.ball >= 0.5 && (P.egg <= 0 || P.burst > 0);
  if (showBall) drawBall(p, w, P, light, age);
  // the peeled mane lobes sinking to the floor round the shrinking ball (in front: they must read)
  if (P.loose > 0 && grownShell) looseLobes(p, w, light, P, age);

  // the summon burst: the cup and the popped top + shards
  if (P.burst > 0) {
    composite(p, eggLayer(w, light, { c: eggC, tilt: 0, wall: 1, seams: false, crack: 0, burst: P.burst, squash: 0 }), SEAM);
    const top: V = [eggC[0] - 1, eggC[1] - 4 - R(6 * P.burst)];
    composite(p, capLayer(w, light, top, 1), SEAM);
    const r = w.raster();
    const shards: [V, V][] = [
      [[-6, -2], [-1, -0.4]],
      [[6, -3], [1, -0.6]],
      [[4, -9], [0.4, -1]],
    ];
    for (const [d, dir] of shards) r.shard(addV(eggC, [d[0] * (0.6 + P.burst * 0.6), d[1] * (0.6 + P.burst * 0.6)]), dir, 3, 1.4, M.SHELL, 22);
    lay(p, w, r);
    return;
  }
  // the egg: closed (summon / death float) or the knit wall rising round the ball
  if (P.egg > 0 || P.knit > 0) {
    const wall = P.egg > 0 ? 1 : clamp01(P.knit);
    composite(p, eggLayer(w, light, { c: eggC, tilt, wall, seams: P.egg <= 0 && P.knit > 0, crack: P.crack, burst: 0, squash: P.squash }), SEAM);
  }
}

function drawBall(p: PixelCanvas, w: Workspace, P: HatchPose, light: Light, age: number): void {
  const { c, r } = ballGeoOf(P, age);
  const th = P.tumble * Math.PI * 2;
  const S = subAges(age);
  // back mane lobes of a grown ball (the mane wrapping it)
  // the mane wraps a grown ball; it peels off as the dragon un-ages (gone by the baby's size)
  const mane = clamp01((age - 0.2) * 1.6);
  void S;
  if (mane > 0) {
    const lobes: Lobe[] = [];
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 0.95 + i * 0.42 + th;
      lobes.push({ c: [R(c[0] + Math.cos(a) * r * 1.02), R(c[1] + Math.sin(a) * r * 0.95)], r: 4.5 * mane });
    }
    cloudLobes(p, w, lobes, light);
  }
  // the tail wrapping round the front bottom
  const tail: V[] = [];
  for (let i = 0; i <= 5; i++) {
    const a = Math.PI * 0.95 - i * 0.32 + th;
    tail.push([c[0] + Math.cos(a) * r * 0.92, c[1] + Math.sin(a) * r * 0.8]);
  }
  {
    const rb = w.raster();
    rb.ell(c, r, r * 0.9, 0, M.HIDE, { flat: 1.3 });
    lay(p, w, rb);
  }
  // the wing nub on the back
  {
    const a = -Math.PI * 0.7 + th;
    const base: V = [c[0] + Math.cos(a) * r * 0.6, c[1] + Math.sin(a) * r * 0.55];
    const rw = w.raster();
    rw.tube([base, addV(base, rot([-3, -2], th))], 4 * L(1, 1.6, age), 2.4, M.HIDE, { z: 6, flat: 1.3 });
    lay(p, w, rw);
  }
  // the tucked head (eye shut), the cowlick on top
  const hd: V = addV(c, rot([r * 0.35, -r * 0.2], th));
  {
    const rh = w.raster();
    rh.ell(hd, r * 0.62, r * 0.55, 0, M.HIDE, { z: 10, flat: 1.3 });
    lay(p, w, rh, CREASE);
  }
  {
    const rt = w.raster();
    rt.tube(tail, L(4, 7, age), L(2.4, 3, age), M.HIDE, { z: 12, flat: 1.3 });
    lay(p, w, rt, CREASE);
  }
  if (mane < 0.5) {
    const q = w.canvas();
    const cw = addV(hd, rot([-1, -r * 0.55 - 1], th));
    stampAt(q, COWLICK, R(cw[0]), R(cw[1]), light, CLOUD_KEY);
    composite(p, q, SEAM);
  }
  // the shell helmet on the tail tip (unless the egg wall hides it)
  if (P.knit <= 0 && P.plates <= 0 && P.burst <= 0 && P.helmet < 0.25) {
    const tip = tail[tail.length - 1];
    const q = w.canvas();
    stampAt(q, SHELL_CAP, R(tip[0]), R(tip[1]) + 1, light, SHELL_KEY);
    composite(p, q, SEAM);
  }
}

/** the closed eye of the tucked head (a light-pixel pass after the outline) */
function storyLights(p: PixelCanvas, P: HatchPose, light: Light, age: number): void {
  const eggC: V = [EGG_C[0] + R(P.hip[0]) + P.shake, EGG_C[1] + R(P.hip[1] - P.lift)];
  const ballVisible = P.ball >= 0.5 && P.egg <= 0 && (P.knit < 0.8 || P.knit <= 0);
  if (ballVisible || P.burst > 0) {
    const { c, r } = ballGeoOf(P, age);
    const th = P.tumble * Math.PI * 2;
    const hd = addV(c, rot([r * 0.35, -r * 0.2], th));
    const e = addV(hd, rot([r * 0.25, -r * 0.05], th));
    const x = R(e[0]);
    const y = R(e[1]);
    if (p.isOpaque(x - 1, y) && p.get(x, y) !== PAL.ink) {
      p.set(x - 1, y, PAL.night0);
      p.set(x, y + 1, PAL.night0);
      p.set(x + 1, y, PAL.night0);
    }
  }
  if (P.glint > 0) {
    const slide = P.float > 0 ? (P.float - 2) * 2 : 0;
    const gx = eggC[0] + (light.side < 0 ? -3 : 3) + slide;
    const gy = eggC[1] - 4 - (P.float === 2 ? 2 : 0);
    shellGlint(p, [gx + (light.side < 0 ? 2 : -2), gy + 4], P.glint, light, false);
  }
}

function drawPlates(p: PixelCanvas, w: Workspace, P: HatchPose, light: Light, eggC: V, behind: boolean): void {
  const t = clamp01(P.plates);
  const bottom = eggC[1] + EGG_RY;
  const r = w.raster();
  const h = 10;
  // left / right plates hinge outward on their floor edge; the front plate folds toward the viewer
  for (const s of [-1, 1]) {
    const pivot: V = [eggC[0] + s * 5.5, bottom];
    const a = s * t * Math.PI * 0.5;
    const shape: V[] = [
      [0, 0],
      [-s * 3.5, 0],
      [-s * 3, -h * 0.8],
      [-s * 1, -h],
      [0, -h * 0.75],
    ];
    const pts: V[] = shape.map((q) => addV(pivot, rot(q, a)));
    r.facet(pts, M.SHELL, [s * -0.3 * (1 - t), -0.4 - t * 0.5, 1], 4, 0);
  }
  const fh = R(L(h * 0.7, 2, t));
  r.facet(
    [
      [eggC[0] - 3, bottom],
      [eggC[0] + 3, bottom],
      [eggC[0] + 2.5, bottom - fh],
      [eggC[0] - 2.5, bottom - fh],
    ],
    M.SHELL,
    [0, -0.6 - t * 0.4, 1],
    30,
    0.1,
  );
  const q = w.render(r);
  speckle(q, light, 2);
  composite(p, q, SEAM);
  void behind;
}

function floatCloud(p: PixelCanvas, w: Workspace, light: Light, eggC: V, phase: number, grownShell: boolean): void {
  const y = eggC[1] + EGG_RY + 1;
  void y;
  const sh = (phase - 1) % 3;
  const lobes: Lobe[] = [];
  const big = grownShell ? 1.3 : 1;
  for (let i = 0; i < 4; i++) {
    const bob = (i + sh) % 3 === 0 ? -1 : 0;
    const r = (i === 1 || i === 2 ? 3 : 2.4) * big;
    lobes.push({ c: [R(eggC[0] - 7 * big + i * 4.6 * big), R(73 - r + bob)], r });
  }
  cloudLobes(p, w, lobes, light);
}

function looseLobes(p: PixelCanvas, w: Workspace, light: Light, P: HatchPose, age: number): void {
  const k = clamp01(P.loose);
  const lobes: Lobe[] = [];
  const spread = L(16, 11, k);
  for (let i = 0; i < 6; i++) {
    const x = 40 + (i - 2.5) * (spread / 2.5);
    const r = L(4.5, 3, k) * (0.8 + age * 0.2);
    const y = L(52 + (i % 2) * 6, 72.5 - r - (i % 2), k);
    lobes.push({ c: [R(x), R(y)], r });
  }
  cloudLobes(p, w, lobes, light);
}
