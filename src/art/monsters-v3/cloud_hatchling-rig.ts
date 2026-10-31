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
import { CLOUD_KEY, COWLICK, COWLICK_UP, CREASE, H, M, MATS, RING, SEAM, SHELL_CAP, SHELL_KEY, TUFT, TUFT_UP, W, clamp01, hiccupRing, ringBand, ringPuff, ringPuffs, seg, stampAt } from './cloud_hatchling-parts';

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
  shell: { c: V; tilt: number };
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
  const o: V = [R(P.hip[0]) + P.shake, R(P.hip[1] - P.lift * L(1, 0.3, sL))];
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
  hc = [hc[0] + lean + R(P.head[0]) + cr * L(1, 4, sL), hc[1] + R(P.head[1]) + cr * L(4, 12, sL) + R(sq * 1.5)];
  hc = addV(hc, o);
  const head: Ell = { c: hc, rx: L(10.5, 8.5, ht), ry: L(9.5, 8, ht) };
  const tl = P.tilt;
  const snout: Ell = { c: addV(hc, [L(8.5, 7, sM) - Math.max(0, tl) * 1.2, L(3.5, 4, sM) - tl * 2]), rx: L(4.5, 5.2, sM), ry: L(3.5, 4.4, sM) };
  const jaw: Ell = { c: addV(snout.c, [L(-1, -1.5, sM) - P.jaw * 0.5, L(2.2, 3.4, sM) + P.jaw * L(2, 3, sM)]), rx: L(3.6, 4.6, sM), ry: L(1.6, 2.2, sM) + P.jaw * 0.6 };
  const cheek: Ell = { c: addV(hc, [L(3.5, 5, sM), L(4, 6, sM)]), rx: 3 + P.cheeks * 1.6, ry: 2.4 + P.cheeks * 1.2 };
  const eye: V = addV(hc, [L(4.5, 3.5, sM) - Math.max(0, tl) * 0.6, L(-1.5, -1.5, sM) - tl * 1.0]);
  const mouth: V = [snout.c[0] + snout.rx - 1, snout.c[1] + 1];
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
  const baseN: V[] = [LV([45.5, 61], [53, 52], sL), LV([47.5, 63.5], [55, 63 - lie * 3], sL), LV([49, 64.5], [56, 72 - lie * 0.5], sL)];
  const baseF: V[] = [LV([42, 61.5], [47, 52], sL), LV([43.5, 64], [48.5, 63 - lie * 3], sL), LV([45, 65], [49, 72 - lie * 0.5], sL)];
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
  const pawN: Ell = { c: addV(armN[2], [L(0.5, 1.5, sL), L(0.3, 0.3, sL)]), rx: L(1.8, 4.2, sL), ry: L(1.5, 2, sL) };
  const pawF: Ell = { c: addV(armF[2], [L(0.5, 1.5, sL), L(0.3, 0.3, sL)]), rx: L(1.4, 3.6, sL), ry: L(1.2, 1.8, sL) };

  // tail: the baby's short curl up behind (shell on the tip); grown: round the haunch along the floor
  const tc = P.tail;
  const tap = P.tailTap;
  // HA-9: the tail's floor part never moves in idle / guard (the curl and the tap swing the raised end only)
  const babyTail: V[] = [
    [34, 69],
    [29.5, 71.5],
    [25.5, 70.5],
    [23.5, 67 + tap * 0.5],
    [24 + tc * 17, 64 + tap * 1 - tc * 4],
  ];
  const grownTail: V[] = [
    [23, 62],
    [17, 67],
    [18.5, 71.8],
    [27, 72.4],
    [36, 72.3],
  ];
  const tail = babyTail.map((q, i) => addV(LV(q, grownTail[i], sL), [o[0], i < 2 ? o[1] : Math.min(o[1], 0) * (sL < 0.5 ? 1 : 0)]));
  const tailW: [number, number] = [L(4.4, 7, sL), L(2.4, 3, sL)];
  const tip = tail[4];
  const prev = tail[3];
  const shell = { c: tip, tilt: L(0.3 - tap * 0.25 + tc * 0.2, Math.atan2(tip[1] - prev[1], tip[0] - prev[0]) - Math.PI / 2, sL) };

  // wings: the nubs on the back; grown, the tips folded up into the mane
  const back: V = addV(LV([35.5, 58], [42, 36], sW), [o[0] + R(lean * 0.3), o[1] + cr * L(2, 10, sL)]);
  const wo = P.wingOpen;
  const wingN = { base: back, tip: addV(back, [L(-5.5, -9, sW) - wo * L(2, 5, sW), L(-3, -13, sW) - P.wingN - wo * L(2, 4, sW)]) };
  const backF: V = addV(back, [L(3, 5, sW), L(-2, -2, sW)]);
  const wingF = { base: backF, tip: addV(backF, [L(-3.5, -4, sW) - wo * L(1, 3, sW), L(-3.5, -14, sW) - P.wingF - wo * L(2, 5, sW)]) };

  const core: V = [R(body.c[0]), R(body.c[1])];
  void sH;
  void sN;
  return { age, sB, sL, sM, sH, sW, sN, o, body, chest, belly, head, snout, jaw, cheek, eye, mouth, crown, haunch, footN, footF, armN, armF, armW: [L(3.4, 7, sL), L(2.8, 5.6, sL)], pawN, pawF, tail, tailW, tailFront: sL >= 0.5, shell, wingN, wingF, core };
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
function cloudLobes(p: PixelCanvas, w: Workspace, lobes: readonly Lobe[], mat: number = M.CLOUD): void {
  for (const l of lobes) {
    if (l.r < 1) continue;
    const r = w.raster();
    r.ell(l.c, l.r + 0.4, l.r, 0, mat, { flat: 1.1, bias: 0.06 });
    lay(p, w, r);
  }
}

/** The grown mane, head-relative [dx, dy, r]: back cascade (behind the head) and the front ruff. */
const MANE_BACK: readonly [number, number, number][] = [
  [-6, 2, 8],
  [-14, 12, 6.5],
  [-16, 3, 6.5],
  [-14, -4, 6],
  [-7, -8, 5.5],
  [0, -9, 4.5],
  [-6, 15, 6],
];
const MANE_FRONT: readonly [number, number, number][] = [
  [-3, 13, 4],
  [2, 12, 4.5],
  [1, -7, 3],
];

function maneLobes(S: Skel, P: HatchPose, front: boolean): Lobe[] {
  const t = S.sN;
  if (t <= 0) return [];
  const hc = S.head.c;
  const list = front ? MANE_FRONT : MANE_BACK;
  const bris = P.mane + P.fluff;
  return list.map(([dx, dy, r], i) => {
    // drift: each lobe bobs 1 px on its own phase; bristle pushes it out from the head centre
    const ph = (P.drift + i / list.length) % 1;
    const bob = ph < 0.5 ? 0 : -1;
    const n = Math.hypot(dx, dy) || 1;
    const k = L(0.35, 1, t);
    return { c: [R(hc[0] + dx * k + (dx / n) * bris * 1.5), R(hc[1] + dy * k + bob + (dy / n) * bris * 1.5)] as V, r: r * t * (1 + bris * 0.1) };
  });
}

// ------------------------------------------------------------------ the eggshell

/** The half shell on the grown tail tip: a band with a zigzag rim (dome away from the tail). */
function shellLayer(w: Workspace, light: Light, tip: V, tilt: number, size: number): PixelCanvas {
  const r = w.raster();
  const t = Math.max(-1.2, Math.min(1.2, tilt));
  const dn: V = [Math.sin(t), Math.cos(t)];
  const cc: V = [tip[0] - dn[0] * 1, tip[1] - dn[1] * 1];
  r.ell(cc, 3.6 * size, 3.3 * size, -t, M.SHELL, { z: 6, flat: 1.15 });
  const q = w.render(r);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!q.isOpaque(x, y)) continue;
      const u = (x + 0.5 - cc[0]) * dn[0] + (y + 0.5 - cc[1]) * dn[1];
      const v = -(x + 0.5 - cc[0]) * dn[1] + (y + 0.5 - cc[1]) * dn[0];
      const tooth = Math.floor((v + 40) / 2) % 2;
      if (u > 0.6 * size + tooth) q.erase(x, y);
    }
  speckle(q, light, 2);
  return q;
}

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
  const rows = wide ? ['.kk.', 'kkkk', 'kkkk', 'kkkk', 'kggk', '.gg.'] : ['.kk.', 'kkkk', 'kkkk', 'kggk', '.gg.'];
  const oy = wide ? -1 : 0;
  for (let yy = 0; yy < rows.length; yy++)
    for (let xx = 0; xx < 4; xx++) {
      const ch = rows[yy][xx];
      if (ch === '.') continue;
      if ((half || narrow) && yy < 2) continue;
      put(xx, yy + oy, ch === 'g' ? PAL.gold3 : k);
    }
  if (half || narrow) put(0, 2, k), put(1, 2, k), put(2, 2, k), put(3, 2, k);
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
  if (P.eye === 2 || P.eye === 4) {
    put(0, 0, k), put(2, 0, k), put(1, 1, k), put(0, 2, k), put(2, 2, k);
    return;
  }
  // gold eye with a night0 slit under the heavy brow
  put(0, 0, PAL.gold3), put(1, 0, PAL.gold3), put(2, 0, PAL.gold3);
  put(0, 1, PAL.gold2), put(1, 1, k), put(2, 1, PAL.gold3), put(3, 1, PAL.gold2);
  if (P.eye !== 5 && P.blink < 0.35) put(1, 2, k), put(2, 2, PAL.gold2);
  if (P.eye === 6) put(1, -1, PAL.gold3);
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

/** a pose drawn as a story state (the ball / the egg) instead of the standing body */
export const isStory = (P: HatchPose): boolean => P.ball >= 0.5 || P.egg > 0 || P.knit > 0;

export function drawHatch(p: PixelCanvas, P: HatchPose, light: Light, shellAge?: number): void {
  const age = ageOf(P, shellAge);
  const w = ws(light);
  const eggC: V = [EGG_C[0] + R(P.hip[0]) + P.shake, EGG_C[1] + R(P.hip[1] - P.lift)];
  if (isStory(P)) drawStory(p, w, P, light, age, shellAge !== undefined);
  else drawBody(p, w, P, light, age);
  if (P.plates > 0) drawPlates(p, w, P, light, eggC, isStory(P));
  despeckle(p, 1);
  p.outline(PAL.ink);
  lightPixels(p, P, light, age);
}

// ------------------------------------------------------------------ the standing body (both forms)

function drawBody(p: PixelCanvas, w: Workspace, P: HatchPose, light: Light, age: number): void {
  const S = skel(P, age);
  const puffs = posePuffs(P, age);

  // ---- 0: the back half of the waist ring (behind the body)
  const rg = ringGeo(P);
  if (puffs.length) ringBand(p, rg.cx, rg.cy, rg.rx, rg.ry, 'back');
  for (const q of puffs) if (q.back) ringPuff(p, q.x, q.y, light);
  if (P.wall > 0) for (const q of puffs) if (q.back) ringPuff(p, q.x, q.y - 4, light);

  // ---- 1: far parts (far foot, far arm / foreleg, far wing)
  {
    const r = w.raster();
    ell(r, S.footF, M.FAR, -4, 0, 1.3);
    r.tube(S.armF, S.armW[0] * 0.9, S.armW[1] * 0.9, M.FAR, { z: -4, flat: 1.3 });
    ell(r, S.pawF, M.FAR, -3, 0, 1.3);
    if (S.sW < 0.5) r.tube([S.wingF.base, S.wingF.tip], 4, 2.4, M.FAR, { z: -5, flat: 1.3 });
    lay(p, w, r);
  }
  if (S.sW >= 0.5) {
    const r = w.raster();
    r.facet(wingTip(S.wingF.base, S.wingF.tip, 3.4, P.wingOpen), M.TIP, [-0.2, -0.3, 1], -5, -0.3);
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
    if (P.helmet < 0.25) {
      if (S.sL < 0.5) {
        const q = w.canvas();
        stampAt(q, SHELL_CAP, R(S.shell.c[0]), R(S.shell.c[1]) - 1, light, SHELL_KEY);
        composite(p, q, SEAM);
      } else composite(p, shellLayer(w, light, S.shell.c, S.shell.tilt, 0.95), SEAM);
    }
  };
  if (!S.tailFront) drawTail();

  // ---- 3: grown near wing tip (it pokes up out of the back mane)
  if (S.sW >= 0.5) {
    const r = w.raster();
    r.facet(wingTip(S.wingN.base, S.wingN.tip, 4, P.wingOpen), M.TIP, [-0.5, -0.4, 1], 0, 0.2);
    lay(p, w, r);
  }

  // ---- 4: the body (body, chest, belly plate), then the haunch + hind foot
  {
    const r = w.raster();
    r.ell(S.body.c, S.body.rx, S.body.ry, 0, M.HIDE, { flat: 1.3 });
    ell(r, S.chest, M.HIDE, 1, 0, 1.3);
    if (S.sM < 0.5) ell(r, S.belly, M.BELLY, 3 + S.body.rx * 0.4, 0, 1.3, 0.05);
    lay(p, w, r);
    const th = w.raster();
    ell(th, S.haunch, M.HIDE, 4, 0, 1.4);
    ell(th, S.footN, M.HIDE, 6, 0, 1.25);
    lay(p, w, th, S.sL >= 0.5 ? CREASE : SEAM);
  }
  if (S.tailFront) drawTail();

  // ---- 5: the near wing nub (baby) / the back mane (grown)
  if (S.sW < 0.5) {
    const r = w.raster();
    r.tube([S.wingN.base, S.wingN.tip], 5.4, 3, M.HIDE, { z: 6, flat: 1.25, bias: 0.05 });
    lay(p, w, r);
  }
  cloudLobes(p, w, maneLobes(S, P, false));

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
    for (let k = 1; k <= smear; k++) r.ell([S.head.c[0] - k, S.head.c[1] + k * 0.3], S.head.rx * 0.9, S.head.ry * 0.85, 0, M.FAR, { z: 9, flat: 2.5, bias: -0.1 });
    lay(p, w, r);
  }
  {
    const r = w.raster();
    const ang = -P.tilt * 0.08;
    r.ell(S.head.c, S.head.rx, S.head.ry, ang, M.HIDE, { z: 10, flat: 1.35 });
    r.ell(S.snout.c, S.snout.rx, S.snout.ry, ang, M.HIDE, { z: 12, flat: 1.2, bias: 0.04 });
    if (P.cheeks > 0.05) ell(r, S.cheek, M.HIDE, 13, 0, 1.3, 0.08);
    if (S.sM >= 0.5 || P.jaw > 0.2) ell(r, S.jaw, S.sM >= 0.5 ? M.BELLY : M.HIDE, 11, 0, 1.3);
    lay(p, w, r, CREASE);
  }
  // horns (grown, f9): small ivory ram curls half buried in the mane
  if (S.sH > 0) drawHorn(p, w, S);
  // the front mane (ruff under the jaw, the brow) and the cowlick
  cloudLobes(p, w, maneLobes(S, P, true));
  if (S.sN < 1) {
    const q = w.canvas();
    stampAt(q, P.fluff > 0.5 || P.tuft > 0.7 ? COWLICK_UP : COWLICK, R(S.crown[0] + P.cow), R(S.crown[1] + 1 - P.fluff), light, CLOUD_KEY);
    composite(p, q, SEAM);
  }
  // chest tuft (baby): a small cloud puff at the throat
  if (S.sN < 1 && S.sM < 0.5) {
    const hc = S.head.c;
    const t = P.tuft + P.fluff;
    const q = w.canvas();
    stampAt(q, t > 0.5 ? TUFT_UP : TUFT, R(hc[0] - 1), R(hc[1] + S.head.ry), light, CLOUD_KEY);
    composite(p, q, SEAM);
  }
  // the helmet riding the head / sliding down the back (summon f10–f11)
  if (P.helmet >= 0.25) {
    const at: V = P.helmet >= 0.75 ? [S.crown[0] + 1, S.crown[1] + 2] : [S.body.c[0] - S.body.rx + 1, S.body.c[1] - 3];
    composite(p, capLayer(w, light, at, P.helmet >= 0.75 ? 1 : -1), SEAM);
  }

  // ---- 8: the front half of the ring
  if (puffs.length) {
    const q = w.canvas();
    ringBand(q, rg.cx, rg.cy, rg.rx, rg.ry, 'front');
    for (const pf of puffs) if (!pf.back) ringPuff(q, pf.x, pf.y, light);
    if (P.wall > 0) for (const pf of puffs) if (!pf.back) ringPuff(q, pf.x, pf.y - 4, light);
    composite(p, q, SEAM);
  }

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

/** the grown horn: a small ivory ram curl (a tube spiral) behind the eye, half in the mane */
function drawHorn(p: PixelCanvas, w: Workspace, S: Skel): void {
  const r = w.raster();
  const hc = S.head.c;
  const k = S.sH;
  // the curl's centre sits behind the eye; the horn leaves the crown backward and rolls down and forward
  const cc: V = [hc[0] - 4.5, hc[1] - 1.5];
  const pts: V[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const a = -Math.PI * 0.35 - t * Math.PI * 1.45 * k;
    const rr = (4.2 - t * 2.4) * k;
    pts.push([cc[0] + Math.cos(a) * rr, cc[1] + Math.sin(a) * rr]);
  }
  r.tube(pts, 3 * k + 0.6, 1.4, M.IVORY, { z: 14, flat: 1.3 });
  const q = lay(p, w, r);
  // the spiral grooves: earth2 dashes across the band
  if (k >= 0.9)
    for (let i = 2; i <= 8; i += 3) {
      const [x, y] = pts[i];
      const xx = R(x);
      const yy = R(y);
      if (q.isOpaque(xx, yy) && q.get(xx, yy) !== PAL.skin4) p.set(xx, yy, PAL.earth2);
    }
}

/** mouth, nostril, belly seams, claws, cheek crease (inside the silhouette, before the outline) */
function surface(p: PixelCanvas, P: HatchPose, S: Skel): void {
  const grownFace = S.sM >= 0.5;
  const sn = S.snout;
  const mx = R(sn.c[0] - sn.rx * 0.3);
  const my = R(sn.c[1] + sn.ry * 0.5);
  const inside = (x: number, y: number) => p.isOpaque(x, y) && p.isOpaque(x, y + 1) && p.isOpaque(x + 1, y);
  if (P.jaw > 0.2) {
    // the open mouth: skin1 cavity, skin2 tongue at the bottom
    const open = Math.max(2, R(L(1, 4, P.jaw) * (grownFace ? 1.3 : 1)));
    const len = R(sn.rx * 1.2) + 1;
    for (let k = 0; k < len; k++)
      for (let j = 0; j < open; j++) {
        const x = mx + k;
        const y = my + j - (k > len - 3 ? 0 : 0);
        if (!inside(x, y)) continue;
        if (k === len - 1 && j === 0) continue;
        p.set(x, y, j >= open - 1 && k < len - 2 && k > 0 ? PAL.skin2 : PAL.skin1);
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
  const rB = L(7.6, 5.6, curl);
  const rG = L(15, 13, curl);
  const r = L(rB, rG, age);
  return { c: [40 + R(P.hip[0]) + P.shake, 74 - r - 0.5 + R(P.hip[1] - P.lift)], r };
}

function drawStory(p: PixelCanvas, w: Workspace, P: HatchPose, light: Light, age: number, grownShell: boolean): void {
  const eggC: V = [EGG_C[0] + R(P.hip[0]) + P.shake, EGG_C[1] + R(P.hip[1] - P.lift)];
  const tilt = P.eggTilt * 0.14 + (P.float === 1 ? -0.12 : P.float === 3 ? 0.12 : 0);
  // the cloud lip under the floating egg (death f9 on) and the loose mane lobes on the floor
  if (P.loose > 0 && grownShell) looseLobes(p, w, P, age);
  if (P.float > 0) floatCloud(p, w, eggC, P.float, grownShell);

  const showBall = P.ball >= 0.5 && (P.egg <= 0 || P.burst > 0);
  if (showBall) drawBall(p, w, P, light, age);

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
    cloudLobes(p, w, lobes);
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
    const gx = eggC[0] + (light.side < 0 ? -3 : 3) + (P.float === 2 ? (light.side < 0 ? 1 : -1) : 0);
    const gy = eggC[1] - (P.float === 2 ? 6 : 4);
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

function floatCloud(p: PixelCanvas, w: Workspace, eggC: V, phase: number, grownShell: boolean): void {
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
  cloudLobes(p, w, lobes);
}

function looseLobes(p: PixelCanvas, w: Workspace, P: HatchPose, age: number): void {
  const k = clamp01(P.loose);
  const lobes: Lobe[] = [];
  const spread = L(16, 11, k);
  for (let i = 0; i < 6; i++) {
    const x = 40 + (i - 2.5) * (spread / 2.5);
    const r = L(4.5, 3, k) * (0.8 + age * 0.2);
    const y = L(52 + (i % 2) * 6, 72.5 - r - (i % 2), k);
    lobes.push({ c: [R(x), R(y)], r });
  }
  cloudLobes(p, w, lobes);
}
