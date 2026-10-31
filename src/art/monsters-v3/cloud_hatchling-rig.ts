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
import { isCloud as isCloudPx, CLOUD_KEY, COWLICK, GY, LOBE_SEAM, fillPockets, puffLobe, shellCup, COWLICK_UP, CREASE, H, M, MATS, RING, SEAM, SHELL_CAP, SHELL_KEY, TUFT, TUFT_UP, W, clamp01, hiccupRing, ringPuffs, seg, stampAt, type RingPuff } from './cloud_hatchling-parts';

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
  /** grown: the chest + head + front mane thrown forward (+x) / sunk back (px; weighted by the legs' age) */
  lunge: [number, number];
  /** grown: the mane's overlap (px x): the front masses lag behind (−) or overshoot (+) the chest */
  lag: number;
  /** grown: the near foreleg lifted off the floor (px; the stomp) */
  stomp: number;
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
  lunge: [0, 0],
  lag: 0,
  stomp: 0,
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
  mouthGeo: { c0: V; len: number; open: number; ta: number };
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
  /** the grown lunge actually applied (px) */
  lu: V;
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
  // grown: the chest + head + front mane thrown forward / sunk back (the baby never uses it)
  // (rear: the chest rises on the planted forelegs, the haunch stays seated)
  const lu: V = [R(P.lunge[0] * sL), R((P.lunge[1] - P.rear) * sL)];

  // body: the baby's upright pear swells (f6) and settles low on the planted legs (f7)
  // (critique r3 #4: f6 is a real sixth — the body swells REARWARD past the big baby head, +≈ 20 %)
  let bc: V = LV(LV([39.5, 64.5], [37, 60], sB), [41, 59.5], sL);
  let brx = L(7.5, 13, sB);
  let bry = L(7.5, 11.5, sB);
  bc = [bc[0] - cr * L(0, 3, sL), bc[1] + cr * L(2, 6, sL)];
  bry -= cr * L(1, 4, sL);
  brx += cr * L(1, 3, sL);
  brx *= 1 + 0.1 * sq;
  const bry2 = bry * (1 - 0.1 * sq);
  bc = [bc[0], bc[1] + (bry - bry2)];
  bry = bry2;
  const body: Ell = { c: addV(bc, [o[0] + R(lu[0] * 0.4), o[1] + R(lu[1] * 0.5)]), rx: brx, ry: bry };
  // grown: a broad breast that ends above the forelegs (critique r3 #1: the legs read as their own tubes)
  const chest: Ell = { c: addV(addV(LV([42, 62], [50, 53], (sB + sM) / 2), addV(o, lu)), [R(lean * 0.3), cr * L(0, 5, sL) + L(6, 10, sM) * 0.1 * sq]), rx: L(5.5, 8.5, sM), ry: L(6, 10, sM) * (1 - 0.1 * sq) - cr * L(0, 3, sL) };
  const belly: Ell = { c: addV(addV(LV([45.5, 65.5], [54.5, 59], (sB + sM) / 2), o), [0, cr * L(0, 4, sL) + L(5.2, 9, (sB + sM) / 2) * 0.1 * sq]), rx: L(3.8, 4.6, sM), ry: L(5.2, 9, (sB + sM) / 2) * (1 - 0.1 * sq) - cr * L(0, 3, sL) };

  // head: rides the body top; the muzzle broadens on f8
  const ht = 0.35 * sB + 0.35 * sL + 0.3 * sM;
  let hc: V = LV([45, 46.5], [56, 37.5], ht);
  // during the growth the head stays low and back (no long neck) until the mane frames it (critique r1 #8)
  const low = clamp01(sB * (1 - age) * 2);
  hc = [hc[0] - low * 3, hc[1] + low * 6];
  hc = [hc[0] + lean + R(P.head[0]) + cr * L(1, 4, sL), hc[1] + R(P.head[1]) + cr * L(4, 12, sL) + R(sq * 1.5)];
  hc = addV(hc, o);
  // where the head would be without its own follow offsets (the rear mane stays with the body)
  const headRest: V = [hc[0] - lean - R(P.head[0]), hc[1] - R(P.head[1])];
  hc = addV(hc, lu);
  const head: Ell = { c: hc, rx: L(10.5, 11, ht), ry: L(9.5, 10.5, ht) };
  const tl = P.tilt;
  // the face turns about the head centre with the pitch (tilt 2 ≈ the snout 30° up)
  const ta = -tl * 0.25;
  // grown: a short, broad, convex lion muzzle dome standing 3 px proud of the skull (critique r3 #2)
  const snout: Ell = { c: addV(hc, rot([L(8.5, 10.5, sM), L(3.5, 5.2, sM)], ta)), rx: L(4.5, 5.4, sM), ry: L(3.5, 4.6, sM) };
  // the open mouth (critique r2 #3, #8): a wedge hinged at the mouth corner, the lower jaw its own lobe
  // hanging `open` px under the upper lip (never a stick past the lips)
  const open = P.jaw * L(5.5, 7.5, sM);
  const mc0: V = addV(snout.c, rot([-snout.rx * 0.5, snout.ry * 0.35], ta));
  const mlen = snout.rx * 1.45;
  const jry = L(1.8, 2.4, sM) + P.jaw * 0.4;
  const jaw: Ell = { c: addV(mc0, rot([mlen * 0.5, open * 0.7 + jry * 0.75], ta)), rx: mlen * 0.58, ry: jry + P.jaw * 0.4 };
  const mouthGeo = { c0: mc0, len: mlen, open, ta };
  const cheek: Ell = { c: addV(hc, [L(3.5, 5, sM), L(4, 6, sM)]), rx: 3 + P.cheeks * 3.2, ry: 2.4 + P.cheeks * 2 };
  const eye: V = addV(hc, rot([L(4.5, 4.5, sM), L(-1.5, -2, sM)], ta * 0.8));
  const mouth: V = addV(mc0, rot([mlen, open * 0.5], ta));
  const crown: V = addV(hc, [-2.5, -head.ry + 0.5]);

  // legs: the baby's stubby thigh + feet become the haunch + hind paw; the forepaws plant as forelegs (f7)
  // (f6 the haunch already swells and settles lower-back; f7 only the legs; critique r3 #4)
  const haunch: Ell = { c: addV(addV(LV(LV([38.5, 68.5], [33.5, 67], sB), [31, 63.5], sL), [-cr * L(0, 1, sL), cr * L(1, 3, sL)]), o), rx: L(L(4.6, 7.2, sB), 10, sL) + cr * L(0, 2, sL), ry: (L(L(4.2, 6.2, sB), 9.5, sL) - cr * L(1, 3, sL)) * (1 - 0.12 * sq * sL) };
  // the haunch squashes on its floor contact (the grown anticipation)
  haunch.rx *= 1 + 0.12 * sq * sL;
  haunch.c = [haunch.c[0], haunch.c[1] + L(4.2, 9.5, sL) * 0.12 * sq * sL];
  const tuck = Math.min(P.lift, 3);
  const footY = (y: number) => y - tuck + Math.min(0, o[1] + tuck);
  const footN: Ell = { c: [L(43.5, 27, sL) + o[0], footY(L(72.6, 72.5, sL))], rx: L(3.4, 5.5, sL), ry: L(1.9, 2, sL) };
  const footF: Ell = { c: [L(36.5, 36, sL) + o[0], footY(L(72.6, 72.6, sL))], rx: L(2.6, 3, sL), ry: L(1.7, 1.8, sL) };
  // forelegs: baby stubby arms (forepaw raise over the face) → grown planted forelegs (stomp = lift px;
  // the sphinx crouch lays them forward along the floor)
  const lie = sL >= 0.5 ? cr : 0;
  // grown: two straight, separate forelegs (critique r3 #1), the far one 8 px behind the near one
  const baseN: V[] = [LV([45.5, 61], [54.5, 53], sL), LV([47.5, 63.5], [55.5, 62 - lie * 3], sL), LV([49, 64.5], [55.5, 70.5 - lie * 0.5], sL)];
  const baseF: V[] = [LV([42, 61.5], [46.5, 54], sL), LV([43.5, 64], [47, 62 - lie * 3], sL), LV([45, 65], [47, 70.5 - lie * 0.5], sL)];
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
    // the lunge carries the shoulders (the paws stay planted); the stomp lifts the near paw
    for (const a of [armN, armF]) {
      a[0] = addV(a[0], lu);
      a[1] = addV(a[1], [lu[0] * 0.5, lu[1] * 0.5]);
    }
    const st = P.stomp * sL;
    armN[2] = addV(armN[2], [st * 0.4, -st]);
    armN[1] = addV(armN[1], [st * 0.3, -st * 0.5]);
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
  // grown: round the haunch's back and bottom, then UP in front of it like a cat's (critique r3 #8)
  const grownTail: V[] = [
    [23, 61],
    [17.5, 66.5],
    [21, 70.5],
    [31, 69.5],
    [36.5, 61],
  ];
  // f6: the baby tail already slides rearward with the swelling body (its shell still on the tip)
  const tail = babyTail.map((q, i) => addV(LV(addV(q, [-3 * sB, i < 2 ? -0.5 * sB : 0]), grownTail[i], sL), [o[0], i < 2 ? o[1] : Math.min(o[1], 0) * (sL < 0.5 ? 1 : 0)]));
  const tailW: [number, number] = [L(4.4, 6, sL), L(2.4, 3.6, sL)];
  const tip = tail[4];
  const prev = tail[3];
  // the cup rides the tip: baby — dome back (left), the jagged rim facing the body; curled in front
  // (guard) it turns round to face the foe as a shield; grown — a band on the tip in front of the haunch,
  // dome forward (critique r1 #4)
  // grown: the band sits back on the tail, the tail tip runs 2–3 px on beyond it (critique r2 #11)
  const shell = {
    c: tip,
    tilt: L(0.3 - tap * 0.25 + tc * 0.2, Math.atan2(tip[1] - prev[1], tip[0] - prev[0]) - Math.PI / 2, sL),
    flip: sL >= 0.5 || tc > 0.5,
  };

  // wings: the nubs on the back; grown, the tips folded up into the mane
  // (grown: the tips lie flat back along the top of the mane, never up like ears; critique r1 #1)
  const back: V = addV(LV([35, 57], [35, 41], sW), [o[0] + R(lean * 0.3), o[1] + cr * L(2, 10, sL)]);
  const wo = P.wingOpen;
  // (grown: the tips reach ≈ 6 px out of the back mane, critique r3 #9)
  const wingN = { base: back, tip: addV(back, [L(-5.5, -15.5, sW) - wo * L(2, 1, sW), L(-3, -13, sW) - P.wingN - wo * L(2, 6, sW)]) };
  const backF: V = addV(back, [L(3, 5, sW), L(-2, -4, sW)]);
  const wingF = { base: backF, tip: addV(backF, [L(-3.5, -11, sW) - wo * L(1, 1, sW), L(-3.5, -12, sW) - P.wingF - wo * L(2, 6, sW)]) };

  const core: V = [R(body.c[0]), R(body.c[1])];
  void sH;
  void sN;
  return { age, sB, sL, sM, sH, sW, sN, o, body, chest, belly, head, headRest, snout, jaw, mouthGeo, cheek, eye, mouth, crown, haunch, footN, footF, armN, armF, armW: [L(3.4, 7, sL), L(2.8, 5.6, sL)], pawN, pawF, tail, tailW, tailFront: sL >= 0.5 || tc > 0.5, shell, wingN, wingF, core, lu };
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
 * The grown mane (critique r2 #1): FOUR big masses (haunch, back, nape ruff, crown), head-relative
 * [dx, dy] at the grown head (56, 37.5), each one calm cloud dome with ONE cap and ONE shadow crescent;
 * small scallop lobes only along the outer silhouette (`arc`, screen degrees, 270 = up), laid behind
 * every mass so only their outer halves show. The front lobes (laid over the head) bring the ruff round
 * the jaw and under the chin and the brow fringe over the horn's back half: the face sits INSIDE the
 * mane like a lion's. t0 = the age a mass starts growing at (the mane grows out of the cowlick: f7
 * crown, f8 nape, f9 back, f10 haunch + ruff, f11 the chin lobe; critique r1 #8).
 */
interface Mass {
  d: V;
  r: number;
  t0: number;
  arc?: readonly [number, number];
}
const MANE_BACK: readonly Mass[] = [
  { d: [-33, 10], r: 8, t0: 4 / 6, arc: [135, 290] },
  { d: [-21, -1], r: 9.5, t0: 3 / 6, arc: [190, 300] },
  { d: [-11, 6], r: 9, t0: 2 / 6 },
  { d: [-5, -8], r: 9, t0: 1 / 6, arc: [195, 340] },
];
const MANE_FRONT: readonly Mass[] = [
  { d: [-8, 7], r: 5, t0: 4 / 6 },
  { d: [-2, 12], r: 4, t0: 4 / 6 },
  { d: [4, 13], r: 3.5, t0: 5 / 6 },
  // the fringe over the horn's back half (critique r3 #2: the curl is half buried)
  { d: [-9, -5.5], r: 4.5, t0: 3 / 6 },
];
const SCALLOP_R = 2.6;

/** how far a lobe that starts at age t0 has grown (one growth frame = 1/6) */
// (critique r3 #4: each mass grows over two frames, so f7 starts the crown as a small cluster and f8
// the nape as a few lobes on the shoulders — never a full poof on a bare neck)
const lobeAt = (age: number, t0: number): number => clamp01((age - t0) / Math.max(1 / 6, Math.min(2 / 6, 1 - t0)));

/** the mane's lobes in draw order: the silhouette scallops first, then the masses back to front */
function maneLobes(S: Skel, P: HatchPose, front: boolean): Lobe[] {
  const hc = S.head.c;
  const list = front ? MANE_FRONT : MANE_BACK;
  const bris = P.mane + P.fluff;
  const masses: Lobe[] = [];
  const scallops: Lobe[] = [];
  const headNoLunge: V = [hc[0] - S.lu[0], hc[1] - S.lu[1]];
  list.forEach((m, i) => {
    const t = lobeAt(S.age, m.t0);
    if (t <= 0) return;
    const [dx, dy] = m.d;
    // drift: every other mass bobs 1 px on its own phase (a follower); bristle pushes it out from the head
    const ph = (P.drift + i / list.length) % 1;
    const bob = i % 2 === 0 && ph >= 0.5 ? -1 : 0;
    const n = Math.hypot(dx, dy) || 1;
    const k = L(0.55, 1, t);
    // the masses near the head follow it, the rear ones stay with the body; the lunge carries the front
    // masses (the lag lets them trail / overshoot a frame: overlap)
    const fw = clamp01(1.25 - n / 16);
    const fl = clamp01((dx + 30) / 24);
    const hb: V = [S.headRest[0] + (headNoLunge[0] - S.headRest[0]) * fw + (S.lu[0] + P.lag * S.sL) * fl, S.headRest[1] + (headNoLunge[1] - S.headRest[1]) * fw + S.lu[1] * fl];
    const c: V = [R(hb[0] + dx * k + (dx / n) * bris * 2), R(hb[1] + dy * k + bob + (dy / n) * bris * 2)];
    const r = m.r * L(0.55, 1, t) * (1 + bris * 0.08);
    masses.push({ c, r });
    if (m.arc) {
      const [a0, a1] = m.arc;
      const len = (((a1 - a0) * Math.PI) / 180) * r;
      const cnt = Math.max(2, Math.round(len / 4.6));
      for (let j = 0; j <= cnt; j++) {
        const a = ((a0 + ((a1 - a0) * j) / cnt) * Math.PI) / 180;
        scallops.push({ c: [R(c[0] + Math.cos(a) * r * 0.98), R(c[1] + Math.sin(a) * r * 0.9)], r: SCALLOP_R * L(0.6, 1, t) });
      }
    }
  });
  return [...scallops, ...masses];
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
  // the crack (critique r2 #5): a zigzag on the LIT face growing 5 px a frame (earth2, a white lip on
  // its lit edge), a side branch from its middle; crack > 1 = the peck: a chip pops out at its top
  if (e.crack > 0) {
    const lit = light.side < 0 ? -1 : 1;
    const ZIG = [0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1];
    const len = R(Math.min(1, e.crack) * ZIG.length);
    const x0 = R(cc[0] + lit * 1.5);
    const y0 = R(cc[1] - EGG_RY * sy + 1.5);
    const cut = (x: number, y: number) => {
      if (!q.isOpaque(x, y)) return;
      q.set(x, y, PAL.earth2);
      if (q.isOpaque(x + lit, y) && q.get(x + lit, y) !== PAL.earth2) q.set(x + lit, y, PAL.white);
    };
    for (let i = 0; i < len; i++) cut(x0 + ZIG[i] * lit, y0 + i);
    if (len >= 10) for (let i = 1; i <= 3; i++) cut(x0 - lit * (i + 1), y0 + 6 + (i >> 1));
    if (e.crack > 1) {
      // the peck: the shell at the crack's top pushed out 1 px, a dark chip hole under it
      const tx = x0 + lit;
      const ty = R(cc[1] - EGG_RY * sy);
      q.set(tx, ty - 1, PAL.skin4);
      q.set(tx + lit, ty - 1, PAL.earth4);
      if (q.isOpaque(tx, ty + 1)) q.set(tx, ty + 1, PAL.earth1);
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
  // a round gold eye (5×3) with a night0 pupil, under the heavy cloud brow (critique r3 #2)
  const narrow = P.eye === 5 || P.eye === 4 || P.blink >= 0.35;
  if (P.eye === 6) put(0, -1, PAL.gold3), put(1, -1, PAL.gold3), put(2, -1, PAL.gold3), put(3, -1, PAL.gold2);
  put(0, 0, PAL.gold3), put(1, 0, PAL.gold3), put(2, 0, PAL.gold3), put(3, 0, PAL.gold3);
  put(-1, 1, PAL.gold2), put(0, 1, PAL.gold3), put(1, 1, PAL.gold3), put(2, 1, k), put(3, 1, PAL.gold3);
  if (!narrow) {
    put(-1, 2, PAL.gold2), put(0, 2, PAL.gold3), put(1, 2, PAL.gold3), put(2, 2, k), put(3, 2, PAL.gold2);
    put(0, 3, PAL.gold2), put(1, 3, PAL.gold2), put(2, 3, PAL.gold2);
  } else for (let xx = -1; xx < 4; xx++) put(xx, 2, PAL.gold2);
}

/**
 * The heavy cloud brow (critique r3 #2): a small cloud lobe laid AFTER the eye so its steel underside
 * overlaps the eye's top row (the lion's glare). Hand-placed, the cap toward the key light.
 */
const BROW: readonly string[] = ['..WWW..', 'WWWWMMS', '.SSSSS.'];
function grownBrow(p: PixelCanvas, P: HatchPose, e: V, light: Light): void {
  if (P.eye === 3) return;
  const x0 = R(e[0]) - 3;
  // its steel underside lies over the eye's top row (narrowed: two rows)
  const y0 = R(e[1]) - 1 - 2 - (P.eye === 6 ? 1 : 0) + (P.eye === 5 || P.eye === 4 || P.blink >= 0.35 ? 1 : 0);
  const lit = light.side < 0;
  for (let r = 0; r < BROW.length; r++)
    for (let c = 0; c < BROW[r].length; c++) {
      const ch = BROW[r][c];
      if (ch === '.') continue;
      // the cap sits toward the light: mirror the tone row for the P2 relight, never the shape
      const cc = lit ? c : BROW[r].length - 1 - c;
      const t = BROW[r][cc];
      const col = t === 'W' ? PAL.white : t === 'M' ? PAL.mist : t === 'S' ? PAL.steel : ch === 'S' ? PAL.steel : PAL.mist;
      p.set(x0 + c, y0 + r, col);
    }
}

// ------------------------------------------------------------------ the draw

/** The age a pose is drawn at (the baby shell: grow; the grown shell: 1 − unAge). */
export function ageOf(P: HatchPose, shellAge: number | undefined): number {
  return shellAge === undefined ? clamp01(P.grow) : clamp01(shellAge - P.unAge);
}

/** The ring's puffs of a pose (frame px) — the cinematic's hour-puffs land on exactly these. */
export function ringGeo(P: HatchPose): { cx: number; cy: number; rx: number; ry: number } {
  return { cx: RING.cx + R(P.hip[0]) + P.shake, cy: RING.cy + R(P.hip[1] - P.lift) - R(P.ringY) + R(P.crouch * 3) - R(P.wall * 3), rx: RING.rx + R(P.ringFlare), ry: RING.ry + R(P.ringFlare * 0.4) + R(P.wall * 1) };
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
  if (wallRows) for (const row of wallRows) ringHalf(p, w, row, true, light, 3);
  else ringHalf(p, w, puffs, true, light);

  // ---- 1: far parts (far foot, far arm / foreleg, far wing)
  {
    const r = w.raster();
    ell(r, S.footF, M.FAR, -4, 0, 1.3);
    if (S.sL < 0.5) {
      r.tube(S.armF, S.armW[0] * 0.9, S.armW[1] * 0.9, M.FAR, { z: -4, flat: 1.3 });
      ell(r, S.pawF, M.FAR, -3, 0, 1.3);
    }
    if (S.sW < 0.5) r.ell(LV(S.wingF.base, S.wingF.tip, 0.6), 2.6, 2.1, -0.6, M.FAR, { z: -5, flat: 1.2 });
    lay(p, w, r);
  }

  // ---- 2: the tail (behind the body for the baby, curled in front for the grown) + its shell
  const drawTail = () => {
    const r = w.raster();
    // two tubes so the floor part's width never depends on where the raised end swings (HA-9)
    const wm = (S.tailW[0] + S.tailW[1]) / 2;
    // grown: a leaf3 tube (one tone under the haunch's leaf4 plane) so it reads in front of it
    const tb = S.sL >= 0.5 ? -0.32 : 0;
    r.tube(S.tail.slice(0, 3), S.tailW[0], wm, M.HIDE, { z: 2, flat: 1.3, bias: tb });
    r.tube(S.tail.slice(2), wm, S.tailW[1], M.HIDE, { z: 2, flat: 1.3, bias: tb });
    lay(p, w, r, S.sL >= 0.5 ? INK_SEAM : SEAM);
    if (P.helmet < 0.25)
      late.push(() => {
        const q = new PixelCanvas(W, H);
        // grown: the baby's shell as a small cap on the tail tip, its zigzag rim kept (critique r3 #8)
        if (S.sL >= 0.5) stampAt(q, TIP_BAND, R(S.shell.c[0]), R(S.shell.c[1]) + 1, light, BAND_KEY);
        else shellCup(q, R(S.shell.c[0]), R(S.shell.c[1]) - (!S.shell.flip ? 2 : 0), light, S.shell.flip);
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
    // the baby's belly plate: a scute strip tapering up into the chest (critique r2 #12: no held bag)
    if (S.sM < 0.5) {
      const b = S.belly;
      const top: V = [b.c[0] - 1, b.c[1] - b.ry - 3.5];
      r.tube([[b.c[0] + 0.5, b.c[1] + b.ry * 0.75], [b.c[0], b.c[1] - 0.5], top], b.rx * 0.95, 1.8, M.BELLY, { z: 3 + S.body.rx * 0.4, flat: 1.3 });
    }
    lay(p, w, r);
    const th = w.raster();
    ell(th, S.haunch, M.HIDE, 4, 0, 1.4);
    ell(th, S.footN, M.HIDE, 6, 0, 1.25);
    lay(p, w, th, S.sL >= 0.5 ? CREASE : SEAM);
  }
  if (S.tailFront) drawTail();
  // grown: the far foreleg stands in front of the belly as its own inked tube (critique r3 #1)
  if (S.sL >= 0.5) {
    const r = w.raster();
    r.tube(S.armF, S.armW[0] * 0.85, S.armW[1] * 0.85, M.FAR, { z: 7, flat: 1.25, bias: 0.3 });
    ell(r, S.pawF, M.FAR, 7.5, 0, 1.3, 0.3);
    lay(p, w, r, INK_SEAM);
  }

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
    const wf = wingTip(S.wingF.base, S.wingF.tip, 3, P.wingOpen);
    rf.facet(wf.slice(0, 4), M.TIP, [-0.2, -0.3, 1], -5, -0.15);
    rf.facet(wf.slice(3), M.TIP, [0.4, 0.5, 0.7], -5, -0.35);
    lay(p, w, rf);
    const r = w.raster();
    // two planes (critique r3 #9): the leading half leaf3 toward the light, the trailing half leaf2
    const wn = wingTip(S.wingN.base, S.wingN.tip, 3.6, P.wingOpen);
    r.facet(wn.slice(0, 4), M.TIP, [-0.5, -0.6, 1], 0, 0.25);
    r.facet(wn.slice(3), M.TIP, [0.5, 0.5, 0.6], 0, -0.1);
    lay(p, w, r);
  }
  cloudLobes(p, w, maneLobes(S, P, false), light, P.fluff >= 0.9 ? 2 : P.fluff > 0.5 ? 1 : 0);

  // ---- 6: near arm / foreleg
  {
    const r = w.raster();
    r.tube(S.armN, S.armW[0], S.armW[1], M.HIDE, { z: 8, flat: 1.25 });
    ell(r, S.pawN, M.HIDE, 9, 0, 1.3);
    lay(p, w, r, S.sL >= 0.5 ? INK_SEAM : SEAM);
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
    const gf = S.sM >= 0.5;
    r.ell(S.head.c, S.head.rx, S.head.ry, ang, M.HIDE, { z: 10, flat: gf ? 1.8 : 1.35, bias: gf ? 0.06 : 0 });
    if (!gf) r.ell(S.snout.c, S.snout.rx, S.snout.ry, ang, M.HIDE, { z: 12, flat: 1.2, bias: 0.04 });
    if (P.cheeks > 0.05) ell(r, S.cheek, M.HIDE, 13, 0, 1.3, 0.08);
    // the lower jaw: its own lobe under the upper lip (hide; the grown chin is no tan lump: critique r2 #3)
    // (grown: a leaf3 underjaw band under the muzzle dome, critique r3 #2)
    if (S.sM >= 0.5 || P.jaw > 0.2) r.ell(S.jaw.c, S.jaw.rx, S.jaw.ry, S.mouthGeo.ta, M.HIDE, { z: 11, flat: 1.6, bias: gf ? -0.05 : 0 });
    // the open mouth's cavity: the wedge between the lips (painted dark in surface())
    if (P.jaw > 0.2) r.facet(mouthWedge(S, 0.6), M.HIDE, [0, 0, 1], 10.5, 0);
    lay(p, w, r, CREASE);
    if (gf) {
      // the grown muzzle: a convex leaf4 dome laid over the skull with a seam (its own round form)
      const rs = w.raster();
      rs.ell(S.snout.c, S.snout.rx, S.snout.ry, ang, M.HIDE, { z: 12, flat: 2.2, bias: 0.12 });
      if (P.jaw > 0.2) rs.facet(mouthWedge(S, 0.6), M.HIDE, [0, 0, 1], 12.5, 0);
      lay(p, w, rs, SEAM);
    }
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
  if (wallRows) {
    // the wall's lobes are smaller than the mane masses (r 3), and a 1-px steel gap runs over its top
    // row wherever a mane lobe sits on it (critique r2 #13: the wall never merges into the mane)
    const wr = 3;
    for (const row of wallRows) ringHalf(p, w, row, false, light, wr);
    const tops = new Map<number, number>();
    for (const row of wallRows)
      for (const pf of row) {
        if (pf.back) continue;
        for (let x = pf.x - 2; x <= pf.x + 3; x++) {
          const y = pf.y - Math.ceil(wr * 0.9);
          tops.set(x, Math.min(tops.get(x) ?? 99, y));
        }
      }
    for (const [x, y] of tops) if (isCloudPx(p.get(x, y - 1))) p.set(x, y - 1, PAL.steel);
  } else ringHalf(p, w, puffs, false, light);

  // ---- 9: the details on the surface (before the outline: they are inside the silhouette)
  surface(p, P, S);
}

/** a folded wing tip: a pointed leaf facet from its base to its tip */
function wingTip(base: V, tip: V, hw: number, open: number): V[] {
  const d: V = [tip[0] - base[0], tip[1] - base[1]];
  const n = Math.hypot(d[0], d[1]) || 1;
  const px: V = [-d[1] / n, d[0] / n];
  const k = hw * (1 + open * 0.6);
  // [0..3] the leading half (base side, mid, tip, base), [3..6] the trailing half (base, tip, mid, side)
  return [
    [base[0] + px[0] * k, base[1] + px[1] * k],
    [base[0] + d[0] * 0.65 + px[0] * k * 0.8, base[1] + d[1] * 0.65 + px[1] * k * 0.8],
    tip,
    base,
    tip,
    [base[0] + d[0] * 0.5 - px[0] * k * 0.4, base[1] + d[1] * 0.5 - px[1] * k * 0.4],
    [base[0] - px[0] * k * 0.6, base[1] - px[1] * k * 0.6],
  ];
}

/**
 * The grown horn (critique r3 #2): a C-shaped ivory ram curl (≈ 6×5) behind the brow fringe, opening
 * forward-down, its tip curling in; no disc, no outline of its own (it lies inside the mane). The
 * tones come from the curl's own centre and the key light (skin4 lit, earth4 turn, earth3 shadow, an
 * earth2 tip), so the P2 relight keeps the same shape.
 */
const HORN: readonly string[] = ['.####.', '###.hh', '##...h', '##..th', '.##...'];
function drawHorn(p: PixelCanvas, w: Workspace, S: Skel, light: Light): void {
  const k = S.sH;
  const hc = S.head.c;
  const x0 = R(hc[0] - 5);
  const y0 = R(hc[1] - 6.5);
  const q = w.canvas();
  const lv = light.v2;
  const cx = 2.6;
  const cy = 2.4;
  // grows from its root (bottom-left) a column / row at a time
  const nCol = Math.max(2, R(6 * k));
  for (let r = 0; r < HORN.length; r++)
    for (let c = 0; c < HORN[r].length; c++) {
      const ch = HORN[r][c];
      if (ch === '.' || c >= nCol) continue;
      const dx = c + 0.5 - cx;
      const dy = r + 0.5 - cy;
      const s = (dx * lv[0] + dy * lv[1]) / Math.max(1, Math.hypot(dx, dy));
      let col: number = s > 0.4 ? PAL.skin4 : s > -0.3 ? PAL.earth4 : PAL.earth3;
      if (ch === 't') col = PAL.earth2;
      if (ch === 'h' && col === PAL.skin4 && r > 0) col = PAL.earth4;
      q.set(x0 + c, y0 + r, col);
    }
  composite(p, q, SEAM);
}

/** one half of the waist ring: separate round puffs (≥ 6×5, no band), lower puffs over upper ones */
function ringHalf(p: PixelCanvas, w: Workspace, puffs: readonly RingPuff[], back: boolean, light: Light, r = 3.1): void {
  const sel = puffs.filter((q) => q.back === back).sort((a, b) => a.y - b.y);
  for (const pf of sel) {
    const q = w.canvas();
    puffLobe(q, pf.x + 0.5, pf.y + 0.5, r, light, 0, back);
    composite(p, q, LOBE_SEAM);
    // a front puff casts a 1-px steel dot on the body under it (critique r2 #10: it floats IN FRONT)
    if (!back) {
      const sy = pf.y + Math.ceil(r * 0.9) + 1;
      if (p.isOpaque(pf.x, sy) && !isCloudPx(p.get(pf.x, sy))) p.set(pf.x, sy, PAL.steel);
      if (p.isOpaque(pf.x + 1, sy) && !isCloudPx(p.get(pf.x + 1, sy))) p.set(pf.x + 1, sy, PAL.steel);
    }
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

/** the open mouth's wedge polygon (frame px), grown by `pad` px */
function mouthWedge(S: Skel, pad: number): V[] {
  const g = S.mouthGeo;
  const at = (k: number, j: number) => addV(g.c0, rot([k, j], g.ta));
  return [at(-pad, -pad), at(g.len + pad, -pad), at(g.len + pad, g.open + pad), at(-pad, g.open * 0.25 + pad)];
}

/** the grown tail-tip shell: a 5×5 cap, dome up, the baby's zigzag rim (3 skin4 teeth) at its foot */
const TIP_BAND = { rows: ['.LLM.', 'LLMMS', 'LMMdS', 'LMMSS', 'r.r.r'], ax: 2, ay: 4 } as const;
const BAND_KEY: Readonly<Record<string, number>> = Object.freeze({ L: PAL.skin4, M: PAL.earth4, S: PAL.earth3, d: PAL.earth2, r: PAL.skin4 });

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
    // the open mouth (critique r2 #3, #8): a night0 wedge between the upper lip and the dropped lower
    // jaw, a 2×2 skin3 tongue on its floor (never past the lips); grown: one white fang at the front
    const g = S.mouthGeo;
    const wedge = (x: number, y: number) => {
      const d = rot([x + 0.5 - g.c0[0], y + 0.5 - g.c0[1]], -g.ta);
      return d[0] >= 0 && d[0] <= g.len && d[1] >= -0.3 && d[1] <= g.open * (0.25 + (0.75 * d[0]) / g.len) ? d[0] : -1;
    };
    const R0 = Math.ceil(g.len + g.open + 2);
    // (critique r3 #3) a wedge-shaped HOLE, not a block: night0 only in the 2–3 px throat core at the
    // hinge, a deep red (fire1) mouth toward the lips, a warm red tongue (fire2) on its floor, a leaf3
    // lip rim along both jaws (grown), the upper fang and a lower fang (grown)
    const cells: [number, number, number, number][] = [];
    for (let y = Math.floor(g.c0[1] - R0); y <= Math.ceil(g.c0[1] + R0); y++)
      for (let x = Math.floor(g.c0[0] - R0); x <= Math.ceil(g.c0[0] + R0); x++) if (p.isOpaque(x, y)) {
          const k = wedge(x, y);
          if (k < 0) continue;
          const d = rot([x + 0.5 - g.c0[0], y + 0.5 - g.c0[1]], -g.ta);
          cells.push([x, y, k, d[1] / Math.max(0.5, g.open * (0.25 + (0.75 * d[0]) / g.len))]);
        }
    const inW = new Set(cells.map(([x, y]) => x * 128 + y));
    for (const [x, y, k, v] of cells) {
      const core = k < Math.min(3, g.len * 0.4) && v > 0.2 && v < 0.85;
      p.set(x, y, core ? PAL.night0 : PAL.fire1);
      void v;
    }
    if (g.open >= 2.5) {
      // the tongue: a 3×2 warm red pad on the wedge floor, its tip toward the lips
      const t = addV(g.c0, rot([g.len * 0.55, g.open * (0.25 + 0.75 * 0.55) - 1.2], g.ta));
      const tx = Math.floor(t[0]) - 1;
      const ty = Math.floor(t[1]);
      for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]] as const) if (inW.has((tx + dx) * 128 + ty + dy)) p.set(tx + dx, ty + dy, PAL.fire2);
    }
    if (grownFace) {
      // the lip rim: the hide pixel right above / below the hole, one tone lighter than the shadow
      for (const [x, y] of cells)
        for (const dy of [-1, 1]) {
          const c = p.get(x, y + dy);
          if (!inW.has(x * 128 + y + dy) && (c === PAL.leaf2 || c === PAL.leaf1 || c === PAL.leaf4)) p.set(x, y + dy, PAL.leaf3);
        }
      if (g.open >= 2.5) {
        const f = addV(g.c0, rot([g.len - 1.5, 0.6], g.ta));
        const fx = Math.floor(f[0]);
        const fy = Math.floor(f[1]);
        if (inW.has(fx * 128 + fy)) p.set(fx, fy, PAL.white);
        if (inW.has(fx * 128 + fy + 1) && g.open >= 4) p.set(fx, fy + 1, PAL.white);
        // the lower fang standing up from the lower lip, 2 px behind the upper one
        const lf = addV(g.c0, rot([g.len - 3, g.open * (0.25 + (0.75 * (g.len - 3)) / g.len) - 0.6], g.ta));
        const lx = Math.floor(lf[0]);
        const ly = Math.floor(lf[1]);
        if (inW.has(lx * 128 + ly)) p.set(lx, ly, PAL.white);
        if (g.open >= 4 && inW.has(lx * 128 + ly - 1)) p.set(lx, ly - 1, PAL.white);
      }
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
  // belly scute seams: three short earth2 bars across the strip's interior (MA-2)
  if (S.sM < 0.5) {
    const b = S.belly;
    const isB = (c: number | null) => c === PAL.earth3 || c === PAL.earth4;
    for (const fy of [-0.75, -0.05, 0.6]) {
      const y = R(b.c[1] + b.ry * fy);
      for (let x = R(b.c[0] - b.rx - 2); x <= R(b.c[0] + b.rx + 1); x++) if (isB(p.get(x, y)) && isB(p.get(x - 1, y)) && isB(p.get(x + 1, y))) p.set(x, y, PAL.earth2);
    }
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
  if (S.sM >= 0.5) {
    grownEye(p, P, S.eye);
    if (S.sH >= 0.5) grownBrow(p, P, S.eye, light);
  } else babyEye(p, P, S.eye);
  // the light effects stay inside the frame (Sİ-2: margin ≥ 2): the grown mouth sits near the right edge
  const big = S.sM >= 0.5;
  if (P.hic > 0) hiccupRing(p, Math.min(R(S.mouth[0]) + 1, W - 3 - (big ? 14 : 10)), R(S.mouth[1]) - 1, R(P.hic), big);
  if (P.puff > 0 && big && P.puff >= 0.9 && P.jaw >= 0.9) grownBlast(p, R(S.mouth[0]), R(S.mouth[1]));
  else if (P.puff > 0) airPuff(p, R(S.mouth[0]) + 1, R(S.mouth[1]), P.puff, big, S.mouthGeo.ta);
  if (P.glint > 0 && P.helmet < 0.25) shellGlint(p, S.shell.c, P.glint, light, S.sL >= 0.5);
}

/**
 * A breath of air at the lips (a sneeze, a squeak; critique r2 #8): a cone of 3–4 short wind arcs
 * (5–7 px, white / mist, 1 px) fanning out of the mouth along the face's pitch — the sneeze reads in
 * the sprite before the cinematic's ring.
 */
function airPuff(p: PixelCanvas, x: number, y: number, k: number, big: boolean, ta: number): void {
  const n = Math.min(4, Math.max(1, R(k * 4)));
  const radii = big ? [3, 5.5, 8, 10.5] : [3, 5.5, 8, 10.5];
  const dir = ta;
  for (let i = 0; i < n; i++) {
    const rr = radii[i];
    const half = (2.6 + i * 0.5) / rr;
    const col = i % 2 === 0 ? PAL.white : PAL.mist;
    const steps = Math.ceil(rr * half * 2 * 2) + 2;
    for (let s = 0; s <= steps; s++) {
      const a = dir - half + (2 * half * s) / steps;
      const px = Math.round(x + Math.cos(a) * rr);
      const py = Math.round(y + Math.sin(a) * rr);
      if (px < 2 || px > W - 3 || py < 2) continue;
      if (p.isOpaque(px, py)) continue;
      p.set(px, py, col);
    }
  }
}

/**
 * The grown sneeze's payoff (critique r3 #11): the FAT ring born at the lips (≈ 6×10, a 2-px band:
 * hiccupRing big, stage 1) — bigger than the baby's fan — with three wind arcs lagging behind it above
 * and below the muzzle (white / mist, never over the sprite).
 */
function grownBlast(p: PixelCanvas, x: number, y: number): void {
  const cx = Math.min(x + 1, W - 6);
  hiccupRing(p, cx - 3, y, 1, true);
  for (const s of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const rr = 7 + i * 2.5;
      const col = i === 1 ? PAL.mist : PAL.white;
      // a short arc behind the ring: from straight up / down toward the back
      for (let a = 0; a <= 5; a++) {
        const ang = (s < 0 ? -Math.PI / 2 : Math.PI / 2) + s * (0.25 + a * 0.11) * (1 - i * 0.1);
        const px = Math.round(cx - i * 2 + Math.cos(ang) * rr * 0.55);
        const py = Math.round(y + Math.sin(ang) * rr * 0.75);
        if (px < 2 || px > W - 3 || py < 2 || py > H - 3) continue;
        if (p.isOpaque(px, py)) continue;
        p.set(px, py, col);
      }
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
  // baby: the tuck starts at the old body's mass and shrinks only while the plates rise (critique r2 #6)
  const rB = L(16.5, 5.6, curl);
  const rG = L(18.5, 13, curl);
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
  const lit = light.side < 0 ? -1 : 1;
  // the mane wraps a grown ball as its big masses (critique r2 #7); they shrink and peel off as the
  // dragon un-ages (gone by the baby's size)
  const mane = clamp01((age - 0.2) * 1.6);
  // back masses (behind the ball) and the wrap (two masses laid OVER its upper back)
  let wrap: Lobe[] = [];
  if (mane > 0) {
    const lobes: Lobe[] = [];
    const ang = [182, 220, 262, 300, 336];
    const masses: Lobe[] = ang.map((d, i) => {
      const a = (d * Math.PI) / 180 + th;
      const rr = (i === 2 ? 9.5 : 8.5) * mane;
      return { c: [R(c[0] + Math.cos(a) * r * 0.95), R(c[1] + Math.sin(a) * r * 0.9)] as V, r: rr };
    });
    for (const m of masses)
      for (const d of [-40, 0, 40]) {
        const a = Math.atan2(m.c[1] - c[1], m.c[0] - c[0]) + (d * Math.PI) / 180;
        lobes.push({ c: [R(m.c[0] + Math.cos(a) * m.r * 0.95), R(m.c[1] + Math.sin(a) * m.r * 0.88)], r: SCALLOP_R * mane });
      }
    cloudLobes(p, w, [...lobes, ...masses], light);
    wrap = [200, 245].map((d) => {
      const a = (d * Math.PI) / 180 + th;
      return { c: [R(c[0] + Math.cos(a) * r * 0.55), R(c[1] + Math.sin(a) * r * 0.5)] as V, r: 8 * mane };
    });
  }
  // the ball: three clean concentric light bands round a highlight toward the key light (critique r2 #6)
  {
    const q = w.canvas();
    const ry = r * 0.95;
    const h: V = [c[0] + lit * r * 0.32, c[1] - ry * 0.38];
    for (let y = Math.floor(c[1] - ry - 1); y <= Math.ceil(c[1] + ry + 1); y++)
      for (let x = Math.floor(c[0] - r - 1); x <= Math.ceil(c[0] + r + 1); x++) {
        const u = (x + 0.5 - c[0]) / r;
        const v = (y + 0.5 - c[1]) / ry;
        if (u * u + v * v > 1) continue;
        const d = Math.hypot(x + 0.5 - h[0], (y + 0.5 - h[1]) * 1.05) / (r * 1.3);
        q.set(x, y, d < 0.4 ? PAL.leaf4 : d < 0.82 ? PAL.leaf3 : PAL.leaf2);
      }
    composite(p, q, SEAM);
  }
  if (wrap.length) cloudLobes(p, w, wrap, light);
  // ONE tail curl wrapping round the front bottom
  const tail: V[] = [];
  for (let i = 0; i <= 5; i++) {
    const a = Math.PI * 0.95 - i * 0.32 + th;
    tail.push([c[0] + Math.cos(a) * r * 0.9, c[1] + Math.sin(a) * r * 0.82]);
  }
  {
    const rt = w.raster();
    rt.tube(tail, L(4, 7, age) * L(0.8, 1, clamp01(r / 12)), L(2.4, 3, age), M.HIDE, { z: 12, flat: 1.3 });
    lay(p, w, rt, CREASE);
  }
  // the cowlick on top
  const hd: V = addV(c, rot([r * 0.35, -r * 0.2], th));
  if (mane < 0.5) {
    const q = w.canvas();
    const cw = addV(c, rot([r * 0.15, -r * 0.95 + 1], th));
    stampAt(q, COWLICK, R(cw[0]), R(cw[1]), light, CLOUD_KEY);
    composite(p, q, SEAM);
  }
  void hd;
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
