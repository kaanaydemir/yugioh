// Bulut Yavrusu (cloud_hatchling) v3 — the rig: HatchPose → skeleton → pixels, ONE draw for both forms
// (docs/v3/kart-a/cloud_hatchling.md §1, §3.1, §3.2). `age` 0 is the baby (a chubby mint chick-dragon whose
// head is bigger than its pear body, a cloud cowlick, the half eggshell riding its tail tip, stubby wing
// nubs), `age` 1 the grown form (a low, wide, seated four-legged cloud lion-dragon whose cloud mane is its
// main mass, a short round muzzle, ivory ram curls in the mane, wing tips folded into it, the shell band
// on the tail curled round the haunch, the 12-puff cloud ring orbiting the waist). Every in-between is a
// real pose: six sub-ages (seg) grow one part each (§4.10: body, legs, muzzle + chest, horns, wings,
// mane + ring).
//
// Craft (REHBER IŞ-3…IŞ-9): every part is a rigkit Raster primitive lit by the ONE key light
// (P1 top-left, P2 relit from the right), quantized into flat tone bands, laid with 1-px step-down seams
// (composite), one ink silhouette contour, then the light pixels (eye catch-light, hiccup ring, the
// shell glint) after the outline. Whole pixels: every pose offset is rounded before it places a part.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { composite, despeckle, FLAT_N, rimLight, Workspace, type Light, type Raster, type V } from '../rigkit';
import { AX, CLOUD_KEY, COWLICK, COWLICK_UP, CREASE, GY, H, M, MATS, RING, SEAM, SHELL_CAP, SHELL_KEY, W, clamp01, hash, hiccupRing, isHide, ringPuff, ringPuffs, seg, stampAt } from './cloud_hatchling-parts';

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
  /** head pitch: + = chin up / thrown back, − = tucked (≈ 0.1 rad units) */
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
  /** every cloud lobe on end (hitMagic static) 0…1 */
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
  /** the shell knocks the floor: 0 rest · 1 down on the floor · −1 the rebound (px up) */
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
  /** curled into a ball 0…1 */
  ball: number;
  /** the ball's roll (somersault) 0…1 turn */
  tumble: number;
  /** egg: 0 none … 1 closed egg (summon); the plates' rise for the death knit */
  egg: number;
  /** egg tilt (−1 … 1, px at the top) */
  eggTilt: number;
  /** summon crack progress 0…1 */
  crack: number;
  /** the death's knit lines 0…1 (0.25 plates rise, 1 closed seams) */
  knit: number;
  /** the summon's shell pop 0 … 1 (the top shell flies up 6 px, the shards out) */
  burst: number;
  /** death float frame 0 none · 1, 2, 3 (rock −1 / upright / +1) */
  float: number;
  /** the revive's plates lying open 0 (closed round the ball) … 1 (flat on the floor) */
  plates: number;
  /** where the helmet shell rides: 0 tail tip · 1 on the head · 0.5 sliding down the back */
  helmet: number;
  /** glint size on the shell rim's lit corner (0 none · 1 · 2 · 3) */
  glint: number;
  /** loose cloud lobes on the floor (the grown death's peeled mane) 0…1 */
  loose: number;
  /** a 1-px whole-body tremble (hitMagic) −1 / 0 / 1 */
  shake: number;
  /** HA-12 smear on the release frame: the head was here (px offset) */
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

/** the head's rest centre, both forms */
const HEAD_B: V = [44, 47];
const HEAD_G: V = [53, 35];

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
  body: { c: V; rx: number; ry: number; ang: number };
  chest: { c: V; rx: number; ry: number };
  belly: { c: V; rx: number; ry: number };
  head: { c: V; rx: number; ry: number };
  snout: { c: V; rx: number; ry: number };
  jaw: { c: V; rx: number; ry: number };
  cheek: { c: V; rx: number; ry: number };
  eye: V;
  mouth: V;
  crown: V;
  haunch: { c: V; rx: number; ry: number };
  footN: { c: V; rx: number; ry: number };
  footF: { c: V; rx: number; ry: number };
  armN: V[];
  armF: V[];
  armW: [number, number];
  pawN: { c: V; rx: number; ry: number };
  pawF: { c: V; rx: number; ry: number };
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
  const crouch = P.crouch;
  const o: V = [R(P.hip[0]) + P.shake, R(P.hip[1] - P.lift)];
  const sq = P.squash;
  const lean = R(P.lean);

  // body: the baby's upright pear swells (f6) and settles low on the planted legs (f7)
  let bc: V = LV(LV([39, 66.5], [41, 59], sB), [41, 57], sL);
  let brx = L(7.5, 13, sB);
  let bry = L(6.5, 13.5, sB);
  bc = [bc[0], bc[1] + crouch * L(2, 3, age)];
  bry -= crouch * L(1, 2, age);
  brx += crouch * L(1, 2, age);
  brx *= 1 + 0.12 * sq;
  const bry2 = bry * (1 - 0.12 * sq);
  bc = [bc[0], bc[1] + (bry - bry2)];
  bry = bry2;
  const body = { c: addV(bc, o), rx: brx, ry: bry, ang: lean * 0.05 };
  const chest = { c: addV(addV(LV([41, 60.5], [48, 51], (sB + sM) / 2), o), [R(lean * 0.4), crouch * 2]), rx: L(5.5, 9, sM), ry: L(5, 10, sM) * (1 - 0.1 * sq) };

  const belly = { c: addV(LV([44, 65], [50, 56], (sB + sM) / 2), o), rx: L(3.2, 6.5, sM), ry: L(5.5, 10, (sB + sM) / 2) * (1 - 0.1 * sq) };

  // head: rides the body top; the muzzle broadens on f8
  const ht = 0.35 * sB + 0.35 * sL + 0.3 * sM;
  let hc: V = LV(HEAD_B, HEAD_G, ht);
  hc = [hc[0] + lean + R(P.head[0]), hc[1] + R(P.head[1]) + crouch * L(4, 9, age) + R(sq * 1.5)];
  hc = addV(hc, o);
  const head = { c: hc, rx: L(10.5, 10.5, sM), ry: L(9.5, 9.5, sM) };
  const tl = P.tilt;
  const snout = { c: addV(hc, [L(8.5, 9, sM) - Math.max(0, tl) * 1.2, L(3.5, 6, sM) - tl * 2]), rx: L(4.5, 6.5, sM), ry: L(3.5, 4.5, sM) };
  const jaw = { c: addV(snout.c, [-1 - P.jaw * 0.5, L(2, 3, sM) + P.jaw * L(2, 3, sM)]), rx: L(3.5, 5, sM), ry: L(1.5, 2.5, sM) + P.jaw * 0.6 };
  const cheek = { c: addV(hc, [L(3.5, 5, sM), L(4.5, 7, sM)]), rx: 3 + P.cheeks * 1.5, ry: 2.2 + P.cheeks * 1.1 };
  const eye: V = addV(hc, [L(4.5, 4.5, sM) - Math.max(0, tl) * 0.6, L(-1.5, -1, sM) - tl * 1.0]);
  const mouth: V = [snout.c[0] + snout.rx - 1, snout.c[1] + 1];
  const crown: V = addV(hc, [L(-3, -2, sN), -head.ry + 0.5]);

  // legs: the baby's stubby feet become the haunch + hind paw; the forepaws plant as forelegs (f7)
  const haunch = { c: addV(LV([41, 69], [31, 63.5], sL), [0, crouch * 2]), rx: L(4, 9.5, sL), ry: L(3.5, 9, sL) };
  haunch.c = addV(haunch.c, o);
  const tuck = Math.min(P.lift, 3);
  const footN = { c: addV(LV([43.5, 72.5], [29.5, 72], sL), [o[0], -tuck + Math.min(0, o[1] + tuck)]), rx: L(3.2, 5.5, sL), ry: L(1.8, 2.5, sL) };
  const footF = { c: addV(LV([36.5, 72.6], [37, 72.5], sL), [o[0], -tuck + Math.min(0, o[1] + tuck)]), rx: L(2.5, 3.5, sL), ry: L(1.8, 2, sL) };
  if (P.lift > 0) {
    footN.c = addV(footN.c, [0, -P.lift + tuck + R(P.lift)]);
    footF.c = addV(footF.c, [0, -P.lift + tuck + R(P.lift)]);
  }
  const raise = (k: number, p: V[]): V[] => {
    // baby: a raised forepaw lifts toward the face; grown: the paw lifts off the floor (stomp)
    if (sL < 0.5) return p.map((q, i) => (i === 0 ? q : addV(q, [-k * 1.5 * i, -k * (3 + 2 * i)])));
    return p.map((q, i) => (i === 0 ? q : addV(q, [k * 0.3 * i, -k * (i / (p.length - 1))])));
  };
  const lie = sL >= 0.5 ? crouch : 0;
  const armN = raise(sL < 0.5 ? P.armN : P.armN, [LV([44.5, 60], [50, 55], sL), LV([46.5, 62], [52, 64], sL), LV([47.5, 63], [54 + lie * 5, 71 - lie * 1], sL)]).map((q) => addV(q, o));
  const armF = raise(P.armF, [LV([41.5, 61], [44, 56], sL), LV([43.5, 63], [45, 64], sL), LV([45, 64.5], [47 + lie * 6, 71 - lie * 1], sL)]).map((q) => addV(q, o));
  const pawN = { c: addV(armN[2], [L(0.5, 1, sL), L(0.5, 1, sL)]), rx: L(1.7, 4, sL), ry: L(1.5, 2.2, sL) };
  const pawF = { c: addV(armF[2], [1, 1.2]), rx: L(1.3, 3.5, sL), ry: L(1, 2, sL) };

  // tail: the baby's short curl up behind (shell on the tip); grown: round the haunch along the floor
  const tc = P.tail;
  const tap = P.tailTap;
  const babyTail: V[] = [
    [33.5, 69],
    [30, 71.5],
    [26.5 + tc * 6, 71],
    [24.5 + tc * 10, 68.5 + tap * 1.5 - tc * 2],
    [24 + tc * 14, 65.5 + tap * 3 - tc * 5],
  ];
  const grownTail: V[] = [
    [24, 62],
    [18.5 + tc * 3, 66],
    [19 + tc * 6, 71.5],
    [26 + tc * 10, 73.5 + tap * 0.5],
    [35 + tc * 12, 73 + tap * 0.5],
  ];
  const tail = babyTail.map((q, i) => addV(LV(q, grownTail[i], sL), [o[0], i === 0 ? o[1] : Math.min(o[1], 0) + (o[1] > 0 ? 0 : 0)]));
  const tailW: [number, number] = [L(4.2, 7, sL), L(2.2, 3, sL)];
  const tip = tail[4];
  const prev = tail[3];
  // the cap sits on the tip, its axis along the tail's last segment (baby: up and back; grown: the band)
  const shell = { c: tip, tilt: L(0.35 - tap * 0.25 + tc * 0.2, Math.atan2(tip[1] - prev[1], tip[0] - prev[0]) - Math.PI / 2, sL) };

  // wings: the nubs on the back; grown, the tips folded up into the mane
  const back: V = addV(chest.c, [-chest.rx * L(0.95, 1.1, sW), -chest.ry * L(-0.1, 0.6, sW)]);
  const wo = P.wingOpen;
  const wingN = { base: back, tip: addV(back, [L(-5, -6, sW) - wo * L(2, 4, sW), L(-1.5, -9, sW) - P.wingN - wo * L(2, 5, sW)]) };
  const backF: V = addV(back, [L(3, 6, sW), L(-2, -3, sW)]);
  const wingF = { base: backF, tip: addV(backF, [L(-4, -3, sW) - wo * L(1, 3, sW), L(-2, -9, sW) - P.wingF - wo * L(2, 5, sW)]) };

  const core: V = [R(body.c[0]), R(body.c[1])];
  return {
    age,
    sB,
    sL,
    sM,
    sH,
    sW,
    sN,
    o,
    body,
    chest,
    belly,
    head,
    snout,
    jaw,
    cheek,
    eye,
    mouth,
    crown,
    haunch,
    footN,
    footF,
    armN,
    armF,
    armW: [L(3.2, 7, sL), L(2.6, 6, sL)],
    pawN,
    pawF,
    tail,
    tailW,
    tailFront: sL >= 0.5,
    shell,
    wingN,
    wingF,
    core,
  };
}

// ------------------------------------------------------------------ the workspace

let WS: Workspace | null = null;
function ws(light: Light): Workspace {
  if (!WS) WS = new Workspace(W, H, light, MATS);
  return WS.begin(light);
}

type Ell = { c: V; rx: number; ry: number };
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
    if (l.r < 0.8) continue;
    const r = w.raster();
    r.ell(l.c, l.r + 0.3, l.r, 0, mat, { flat: 1.15, bias: 0.04 });
    lay(p, w, r);
  }
}

/** The baby's cowlick: three lobes on the crown leaning back (it grows into the mane on f11). */
function cowlickLobes(S: Skel, P: HatchPose): Lobe[] {
  const c = S.crown;
  const sw = R(P.cow);
  const up = P.fluff * 2 + P.tuft * 0;
  const k = 1 + S.sN * 0;
  return [
    { c: [c[0] - 4 + sw * 0.5, c[1] + 0.5 - up * 0.5], r: 2.9 * k },
    { c: [c[0] - 0.5 + sw, c[1] - 2.5 - up], r: 3.3 * k },
    { c: [c[0] + 3.5 + sw, c[1] - 0.5 - up * 0.8], r: 2.6 * k },
  ];
}

/** The grown mane: crown, back cascade over the shoulders, the ruff under the jaw (head-relative). */
const MANE_BACK: readonly [number, number, number][] = [
  [-13, 13, 6.5],
  [-15, 4, 6.5],
  [-13, -4, 6],
  [-7, -9, 6],
  [0, -11, 5],
  [-9, 20, 6],
  [-2, 22, 5],
  [-17, 21, 5],
];
const MANE_FRONT: readonly [number, number, number][] = [
  [-4, 13, 4.5],
  [1, 14, 4],
  [6, -7.5, 3],
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
    return { c: [R(hc[0] + dx + (dx / n) * bris * 1.5), R(hc[1] + dy + bob + (dy / n) * bris * 1.5)] as V, r: r * t * (1 + bris * 0.08) };
  });
}

// ------------------------------------------------------------------ the eggshell helmet

/** The half shell on the tail tip (dome away from the tail, zigzag rim toward it). */
function shellLayer(w: Workspace, light: Light, tip: V, tilt: number, size: number): PixelCanvas {
  const r = w.raster();
  const rx = 4 * size;
  const ry = 3.6 * size;
  // the cap's axis: up, tilted (rad, + = leaning back / left)
  const t = Math.max(-0.7, Math.min(0.7, tilt));
  const dn: V = [Math.sin(t), Math.cos(t)];
  const cc: V = [tip[0] - dn[0] * 1.5, tip[1] - dn[1] * 1.5];
  r.ell(cc, rx, ry, -t, M.SHELL, { z: 6, flat: 1.15 });
  const q = w.render(r);
  // the open side faces the tail: cut along a zigzag rim (teeth 2 px wide, 1 px deep)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!q.isOpaque(x, y)) continue;
      const u = (x + 0.5 - cc[0]) * dn[0] + (y + 0.5 - cc[1]) * dn[1];
      const v = -(x + 0.5 - cc[0]) * dn[1] + (y + 0.5 - cc[1]) * dn[0];
      const tooth = Math.floor((v + 40) / 2) % 2;
      if (u > 0.9 * size + tooth) q.erase(x, y);
    }
  // speckles: 2-px earth2 clusters on the shadow plane only (away from the light)
  let n = 0;
  for (let y = 0; y < H && n < 2; y++)
    for (let x = 0; x < W && n < 2; x++) {
      const xx = light.side < 0 ? x : W - 1 - x;
      if (q.get(xx, y) !== PAL.earth3 || q.get(xx, y + 1) !== PAL.earth3) continue;
      if ((xx + y) % 3 !== 0) continue;
      q.set(xx, y, PAL.earth2);
      q.set(xx, y + 1, PAL.earth2);
      n++;
    }
  return q;
}

// ------------------------------------------------------------------ eyes

function babyEye(p: PixelCanvas, P: HatchPose, e: V, light: Light): void {
  const x = R(e[0]) - 1;
  const y = R(e[1]) - 2;
  const lk = [R(P.look[0]), R(P.look[1])];
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
      put(1, 0, k), put(2, 0, k), put(3, 1, k), put(3, 2, k), put(2, 3, k), put(1, 3, k), put(0, 2, k), put(1, 1, k), put(2, 1, PAL.gold3), put(1, 2, PAL.gold3);
      return;
    case 7: // happy arc ^
      put(0, 2, k), put(1, 1, k), put(2, 1, k), put(3, 2, k);
      return;
  }
  if (shut) {
    put(0, 2, k), put(1, 3, k), put(2, 3, k), put(3, 2, k);
    return;
  }
  const wide = P.eye === 6;
  const narrow = P.eye === 5;
  // the round eye: night0 pupil, gold3 iris crescent below, the white catch-light (the brightest pixel)
  const rows = wide ? ['.kk.', 'kkkk', 'kkkk', 'kggk', '.gg.'] : ['.kk.', 'kkkk', 'kkkk', 'kggk', '.gg.'];
  for (let yy = 0; yy < 5; yy++)
    for (let xx = 0; xx < 4; xx++) {
      const ch = rows[yy][xx];
      if (ch === '.') continue;
      if ((half || narrow) && yy < 2) continue;
      put(xx + (yy >= 1 && yy <= 3 ? lk[0] * 0 : 0), yy, ch === 'g' ? PAL.gold3 : k);
    }
  if (half || narrow) {
    put(0, 2, k), put(1, 2, k), put(2, 2, k), put(3, 2, k);
  }
  // pupil look: the catch-light rides with it
  const cx = 1 + Math.max(-1, Math.min(1, lk[0]));
  const cy = (half || narrow ? 2 : 1) + Math.max(0, Math.min(1, lk[1]));
  put(cx, cy, PAL.white);
  if (wide) put(cx + 1, cy + 2, PAL.mist);
  void light;
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
    put(0, 0, PAL.white), put(1, 0, PAL.white), put(2, 0, PAL.white), put(0, 1, PAL.white), put(1, 1, PAL.white), put(2, 1, PAL.mist), put(3, 1, PAL.mist);
    return;
  }
  if (P.eye === 2) {
    put(0, -1, k), put(2, 1, k), put(1, 0, k), put(0, 1, k), put(2, -1, k);
    return;
  }
  // gold eye with a night0 slit under the heavy brow
  put(0, 0, PAL.gold4), put(1, 0, PAL.gold3), put(2, 0, PAL.gold3);
  put(0, 1, PAL.gold3), put(1, 1, k), put(2, 1, PAL.gold3), put(3, 1, PAL.gold2);
  if (P.eye !== 5 && P.blink < 0.35) put(1, 2, k), put(0, 2, PAL.gold2), put(2, 2, PAL.gold2);
}

// ------------------------------------------------------------------ the draw

export interface DrawHatchOpts {
  /** the form to draw (undefined = from the pose: grow / unAge) */
  readonly age?: number;
}

/** The age a pose is drawn at (the baby shell: grow; the grown shell: 1 − unAge). */
export function ageOf(P: HatchPose, shellAge: number | undefined): number {
  return shellAge === undefined ? clamp01(P.grow) : clamp01(shellAge - P.unAge);
}

export function drawHatch(p: PixelCanvas, P: HatchPose, light: Light, shellAge?: number): void {
  const age = ageOf(P, shellAge);
  const S = skel(P, age);
  const w = ws(light);
  const ringOn = S.sN >= 1 && P.ball < 0.5;
  const ringCy = RING.cy + R(P.hip[1] - P.lift) - R(P.ringY);
  const ringRx = RING.rx + R(P.ringFlare);
  const ringRy = RING.ry + R(P.ringFlare * 0.4) + R(P.wall * 2);
  const puffs = ringOn ? ringPuffs(P.ring, { cy: ringCy, rx: ringRx, ry: ringRy }).map((q) => ({ ...q, x: q.x + R(P.hip[0]) })) : [];

  // ---- 0: the back half of the waist ring (behind the body)
  if (puffs.length) {
    for (const q of puffs) if (q.back) ringPuff(p, q.x, q.y, light);
    if (P.wall > 0) for (const q of puffs) if (q.back) ringPuff(p, q.x, q.y - 4, light);
  }

  // ---- 1: far parts (far foot, far arm / foreleg, far wing)
  {
    const r = w.raster();
    ell(r, S.footF, M.FAR, -4, 0, 1.3);
    r.tube(S.armF, S.armW[0] * 0.9, S.armW[1] * 0.9, M.FAR, { z: -4, flat: 1.3 });
    ell(r, S.pawF, M.FAR, -3, 0, 1.3);
    if (S.sW < 0.5) r.tube([S.wingF.base, S.wingF.tip], 4, 2.6, M.FAR, { z: -5, flat: 1.3 });
    else r.facet(wingTip(S.wingF.base, S.wingF.tip, 3.2), M.TIP, [-0.2, -0.3, 1], -5, -0.25);
    lay(p, w, r);
  }

  // ---- 2: the tail (behind the body for the baby, curled in front for the grown) + its shell
  const drawTail = () => {
    const r = w.raster();
    r.tube(S.tail, S.tailW[0], S.tailW[1], M.HIDE, { z: 2, flat: 1.3 });
    lay(p, w, r);
    if (P.helmet < 0.5) {
      if (S.sL < 0.5) {
        const q = w.canvas();
        stampAt(q, SHELL_CAP, R(S.shell.c[0]), R(S.shell.c[1]), light, SHELL_KEY);
        composite(p, q, SEAM);
      } else composite(p, shellLayer(w, light, S.shell.c, S.shell.tilt, L(1, 0.85, S.sL)), SEAM);
    }
  };
  if (!S.tailFront) drawTail();

  // ---- 3: grown near wing tip (it pokes up out of the back mane)
  if (S.sW >= 0.5) {
    const r = w.raster();
    r.facet(wingTip(S.wingN.base, S.wingN.tip, 3.8), M.TIP, [-0.5, -0.4, 1], 0, 0.15);
    lay(p, w, r);
  }

  // ---- 4: the body: one raster (body, belly plate, haunch, near foot) for the baby — calm planes, no
  //         inner seams; the grown haunch is its own mass, laid with a crease
  {
    const r = w.raster();
    r.ell(S.body.c, S.body.rx, S.body.ry, S.body.ang, M.HIDE, { flat: 1.3 });
    ell(r, S.chest, M.HIDE, 1, 0, 1.3);
    ell(r, S.belly, M.BELLY, S.body.rx * 0.5, 0, 1.3, 0.05);
    if (S.sL < 0.5) {
      lay(p, w, r);
      const th = w.raster();
      ell(th, S.haunch, M.HIDE, 3, 0, 1.3);
      ell(th, S.footN, M.HIDE, 4, 0, 1.2);
      lay(p, w, th);
    } else {
      lay(p, w, r);
      const hn = w.raster();
      ell(hn, S.haunch, M.HIDE, 4, 0, 1.4);
      ell(hn, S.footN, M.HIDE, 6, 0, 1.3);
      lay(p, w, hn, CREASE);
    }
  }
  if (S.tailFront) drawTail();

  // ---- 5: the near wing nub (baby) / the back mane (grown)
  if (S.sW < 0.5) {
    const r = w.raster();
    r.tube([S.wingN.base, S.wingN.tip], 5, 3.2, M.HIDE, { z: 6, flat: 1.3, bias: 0.05 });
    lay(p, w, r);
  }
  cloudLobes(p, w, maneLobes(S, P, false));

  // ---- 6: near arm / foreleg
  {
    const r = w.raster();
    r.tube(S.armN, S.armW[0], S.armW[1], M.HIDE, { z: 8, flat: 1.3 });
    ell(r, S.pawN, M.HIDE, 9, 0, 1.3);
    lay(p, w, r);
  }

  // ---- 7: the head: one raster (skull, snout, cheek), laid on the body with a crease
  {
    const r = w.raster();
    const ang = -P.tilt * 0.08;
    r.ell(S.head.c, S.head.rx, S.head.ry, ang, M.HIDE, { z: 10, flat: 1.35 });
    r.ell(S.snout.c, S.snout.rx, S.snout.ry, ang, M.HIDE, { z: 12, flat: 1.2, bias: 0.04 });
    if (P.cheeks > 0.05) ell(r, S.cheek, M.HIDE, 13, 0, 1.3, 0.05);
    if (S.sM >= 0.5 || P.jaw > 0.2) ell(r, S.jaw, S.sM >= 0.5 ? M.BELLY : M.HIDE, 11, 0, 1.3);
    lay(p, w, r, CREASE);
  }
  // horns (grown, f9): ivory ram curls half buried in the mane
  if (S.sH > 0) {
    const r = w.raster();
    const hc = S.head.c;
    const base: V = [hc[0] - 3, hc[1] - S.head.ry + 3];
    const pts: V[] = [];
    const turns = 1.1 * S.sH;
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const a = -Math.PI * 0.4 - t * turns * Math.PI * 2;
      const rr = 3.6 * (1 - t * 0.55) * S.sH;
      pts.push([base[0] - 2 + Math.cos(a) * rr - t * 1.5, base[1] + 1 + Math.sin(a) * rr]);
    }
    r.tube(pts, 3.2 * S.sH + 0.4, 1.4, M.IVORY, { z: 14, flat: 1.3 });
    lay(p, w, r);
  }
  // the front mane (ruff under the jaw, the brow) and the cowlick
  cloudLobes(p, w, maneLobes(S, P, true));
  if (S.sN < 1) {
    const q = w.canvas();
    stampAt(q, P.fluff > 0.5 ? COWLICK_UP : COWLICK, R(S.crown[0] + P.cow), R(S.crown[1] + 1), light, CLOUD_KEY);
    composite(p, q, SEAM);
  }
  // chest tuft (baby): a small cloud puff at the throat
  if (S.sN < 1) {
    const hc = S.head.c;
    const t = P.tuft + P.fluff;
    cloudLobes(p, w, [{ c: [R(hc[0] - 1 + t * 0.5), R(hc[1] + S.head.ry - 0.5)], r: 2 + t * 0.6 }]);
  }

  // ---- 8: the front half of the ring
  if (puffs.length) {
    const q = new PixelCanvas(W, H);
    for (const pf of puffs) if (!pf.back) ringPuff(q, pf.x, pf.y, light);
    if (P.wall > 0) for (const pf of puffs) if (!pf.back) ringPuff(q, pf.x, pf.y - 4, light);
    composite(p, q, SEAM);
  }

  // ---- 9: the rim of sky light, crumbs, the ink contour
  despeckle(p, 1);
  p.outline(PAL.ink);

  // ---- 10: details: mouth, nostril, belly seams, claws, eyes; then the light pixels
  details(p, P, S, light);
}

/** a folded wing tip: a pointed leaf facet from its base to its tip */
function wingTip(base: V, tip: V, hw: number): V[] {
  const d: V = [tip[0] - base[0], tip[1] - base[1]];
  const n = Math.hypot(d[0], d[1]) || 1;
  const px: V = [-d[1] / n, d[0] / n];
  return [
    [base[0] + px[0] * hw, base[1] + px[1] * hw],
    [base[0] + d[0] * 0.6 + px[0] * hw * 0.9, base[1] + d[1] * 0.6 + px[1] * hw * 0.9],
    tip,
    [base[0] + d[0] * 0.55 - px[0] * hw * 0.5, base[1] + d[1] * 0.55 - px[1] * hw * 0.5],
    [base[0] - px[0] * hw, base[1] - px[1] * hw],
  ];
}

function details(p: PixelCanvas, P: HatchPose, S: Skel, light: Light): void {
  const grownFace = S.sM >= 0.5;
  // mouth line / open mouth
  const sn = S.snout;
  const mx = R(sn.c[0] + sn.rx * 0.2);
  const my = R(sn.c[1] + sn.ry * 0.55);
  if (P.jaw > 0.2) {
    const open = R(L(1, 4, P.jaw) * (grownFace ? 1.3 : 1));
    const len = R(sn.rx * 0.9) + 1;
    for (let k = 0; k < len; k++)
      for (let j = 0; j < open; j++) {
        const x = mx + k - 1;
        const y = my + j - (grownFace ? 0 : 0);
        if (!p.isOpaque(x, y)) continue;
        p.set(x, y, j === 0 ? PAL.skin1 : j === open - 1 && k < len - 1 ? PAL.skin2 : PAL.skin1);
      }
  } else {
    // a small smile, tucked under the snout
    const len = grownFace ? 5 : 3;
    for (let k = 0; k < len; k++) if (p.isOpaque(mx + k, my) && p.get(mx + k, my) !== PAL.ink) p.set(mx + k, my - (k === len - 1 ? 1 : 0), PAL.leaf1);
  }
  // nostril
  const nx = R(sn.c[0] + sn.rx * 0.6);
  const ny = R(sn.c[1] - sn.ry * 0.35);
  if (p.get(nx, ny) !== PAL.ink) p.set(nx, ny, PAL.leaf1);
  // belly scute seams (the shadow plane only: the lower half of the belly)
  const b = S.belly;
  for (const fy of [0.25, 0.6]) {
    const y = R(b.c[1] + b.ry * fy);
    for (let x = R(b.c[0] - b.rx * 0.4); x <= R(b.c[0] + b.rx * 0.5); x++) {
      const c = p.get(x, y);
      if (c === PAL.earth3) p.set(x, y, PAL.earth2);
    }
  }
  // claws: two skin3 pixels on the near foot's front, the near paw's
  const fn = S.footN;
  for (const dx of [0, 2]) {
    const x = R(fn.c[0] + fn.rx) - 1 - dx;
    const y = R(fn.c[1] + fn.ry) - 1;
    if (p.isOpaque(x, y) && p.get(x, y) !== PAL.ink) p.set(x, y, PAL.skin3);
  }
  if (S.sL > 0.5) {
    const pw = S.pawN;
    for (const dx of [0, 2]) {
      const x = R(pw.c[0] + pw.rx) - 1 - dx;
      const y = R(pw.c[1] + pw.ry) - 1;
      if (p.isOpaque(x, y) && p.get(x, y) !== PAL.ink) p.set(x, y, PAL.skin3);
    }
  }
  // eyes (light pixels drawn after the outline)
  if (grownFace) grownEye(p, P, S.eye);
  else babyEye(p, P, S.eye, light);
  // the hiccup ring and the breath of air at the lips
  if (P.hic > 0) hiccupRing(p, R(S.mouth[0]) + 1, R(S.mouth[1]) - 1, R(P.hic), S.sM >= 0.5);
  void hash;
  void FLAT_N;
  void AX;
}
