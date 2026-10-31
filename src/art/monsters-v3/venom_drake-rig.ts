// Zehir Ejderi (venom_drake) v3 — the Scorpion Wyvern rig: Pose → pixels.
// Blueprint: docs/v3/kart-a/venom_drake.md §1 (identity), §3 (rig), §4 (anims).
//
// A LOW, WIDE wyvern on four points: two thick hind legs and two wing-arms planted on their
// knuckles (pterosaur-like), the membranes folded along the arms and hanging as a ragged, holed cape.
// A tail of 9 segments (7 hide + 2 chitin) rises off the rump in a tall SCORPION ARCH that curls
// FORWARD over the back; its tip is a swollen venom bulb with a hooked stinger poised above the head
// ("a C curled over a bar"). A translucent throat sac under a long low jaw; six hollow weep-quills on
// the spine, each beading venom.
//   - body: plum-violet scales (venomscale: void0 creases, void1 shadow, void2 mid, mag1 lit plane,
//     a void3 1-px lit edge) with a leaf2 toxic under-glow rim on the side away from the light;
//   - chitin (stone ramp): claws, horns, belly plates, the last two tail segments, the bulb cap and
//     the stinger — the only part that survives the death;
//   - venom (light, painted after the outline, never outlined): leaf2 / leaf3 with a leaf3 + gold3
//     hot band and ONE gold4 pixel (the bulb core) — acid chartreuse, never a gold gem;
//   - hard parts move whole pixels, never rotate as sprites; legs / arms are 2-link IK tubes.
// Frame 100×92, 1 art px = 1 game px; ground GY 86, anchor (48, 86).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { lightOf, type Light } from '../rigkit';
import { holeAt, seamAt, webAt } from './venom_drake-holes';
import {
  AX, CHITIN, CHITIN_FAR, Comp, DEG, GY, H, HIDE, HIDE_FAR, MEMB, MEMB_FAR, RIM, VEN, W,
  bands, clamp, hash2, ik, layer, lerp, planes, rnd, tubePoly, type Pt, type Tones,
} from './venom_drake-gbuf';

export { W, H, GY, AX };

export const enum Part {
  none = 0,
  tailF, // reserved
  wingF,
  armF,
  legF,
  barrel,
  plates,
  tail,
  chitin,
  bulb,
  cape,
  thigh,
  legN,
  neck,
  head,
  sac,
  horn,
  armN,
  shield,
  fx,
}

// ---------------------------------------------------------------- pose

export interface Pose {
  /** barrel offset (px; + down = the breath sinks the body; the feet / knuckles stay) */
  bx: number;
  by: number;
  /** the inhale: the back line rises 1 px (the belly, legs and everything else stay) */
  breath: number;
  /** haunch sit 0…2: the hips drop back over the planted hind feet (guard) */
  sit: number;
  /** rear-up 0…1 on the hind legs (special): the shoulders rise and come back */
  rear: number;
  /** head offset (px) relative to its neutral seat on the neck */
  hx: number;
  hy: number;
  /** snout tilt (px the snout tip moves; + down) */
  tilt: number;
  /** jaw open 0…3 */
  jaw: number;
  /** eye 0 open · 1 slit · 2 shut; eyeHot 1 = blazing (hitMagic) */
  eye: number;
  eyeHot: number;
  /** throat sac inflation 0…3; sacHot 1 = the sac flashes gold3 (roar f3, hitMagic) */
  sac: number;
  sacHot: number;
  /** tail: rotation of the whole arch about its root (deg, − = back), curl (1 = the idle arch), lag (deg added toward the tip) */
  tRot: number;
  tCurl: number;
  tLag: number;
  /** explicit tail angles (9, screen deg) — overrides the arch params */
  tail: readonly number[] | null;
  /** shoulder offset y (px) relative to the barrel (the breath reaches the shoulders late) */
  sy: number;
  /** tail root offset y (px) relative to the hips (the breath reaches the tail late) */
  ty: number;
  /** tail tip offset (px) added on the last segments (rattle ticks, drift) */
  tdx: number;
  tdy: number;
  /** bulb swell 0…3, glow 0…3, whip smear 0/1, a venom crown at the stinger 0/1 */
  bulb: number;
  glow: number;
  smear: number;
  crown: number;
  /** near / far knuckle offsets [dx, lift] (the far one stays planted in idle / guard / transitions) */
  nk: Pt;
  fk: Pt;
  /** wing spread 0 folded · 0.5 hood · 1 full (special) */
  wing: number;
  /** guard: 0 … 1 the near wing-arm off the floor, folded forward over the head as a holed shield */
  shield: number;
  /** cape drape lag (px the hem trails) */
  drape: number;
  /** six weep-quills: bead size 0…2 each (front → back) */
  beads: readonly number[];
  /** quills bristle 0/1 (one px taller) */
  bristle: number;
  /** venom-hot body (hitMagic f0): sac / beads gold3, seams leaf3 */
  hot: number;
  /** fang drip: 0 none · 1–3 bead size · 10+n falling (n = px below the fang) · 20 splash · 21/22 etch dot */
  drip: number;
  /** 2 nostril mist puffs (summon exhale) 0/1/2 */
  mist: number;
  /** death / revive passes */
  seam: number; // seam web glow 0…1
  /** where the seam web shows: 0 the whole hide (death / revive) · 1 the struck front half, no nodes (hitMagic) · 2 the tail only (revive f8) */
  seamPart: number;
  holes: number; // 0…3 hole steps eaten into the hide
  /** the lace slumps into the pool 0…1 (death f7); pool size 0…1; the stinger marker sink 0…3 (≥0 shows it) */
  slump: number;
  pool: number;
  marker: number;
  /** revive glob: 0 none · 1 hover · 2 falling · 3 splat */
  glob: number;
  /** whole-body visibility (summon curl uses the normal rig); 0 = nothing of the drake drawn */
  body: number;
  /** curled (summon f0): head tucked, tail wrapped 0…1 */
  curl: number;
  /** a 1-px shudder (hitMagic) 0/1/2 */
  shake: number;
  /** the falling stinger marker (death f7): tilt (deg, + = toward the front) and lift above the pool (px) */
  mtilt: number;
  mlift: number;
  /** global phase 0…1 (deterministic flicker) */
  t: number;
}

export const NEUTRAL: Pose = {
  bx: 0, by: 0, breath: 0, sit: 0, rear: 0,
  hx: 0, hy: 0, tilt: 0, jaw: 0, eye: 0, eyeHot: 0, sac: 0, sacHot: 0,
  tRot: 0, tCurl: 1, tLag: 0, tail: null, ty: 0, sy: 0, tdx: 0, tdy: 0,
  bulb: 0, glow: 1, smear: 0, crown: 0,
  nk: [0, 0], fk: [0, 0], wing: 0, shield: 0, drape: 0,
  beads: [0, 0, 0, 0, 0, 0], bristle: 0, hot: 0, drip: 0, mist: 0,
  seam: 0, seamPart: 0, holes: 0, slump: 0, pool: 0, marker: -1, glob: 0, body: 1, curl: 0, shake: 0, mtilt: 0, mlift: 0, t: 0,
};
export const pose = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

// ---------------------------------------------------------------- skeleton

/** The idle tail arch (screen deg per segment, root → tip). */
const ARCH = [-102, -97, -92, -85, -70, -44, -14, 8, 30] as const;
const T_STEP = 7.6;
/** segment widths: a whip taper from 8 px at the root to 4 px at the chitin */
const T_W = [8.4, 7.8, 7.2, 6.6, 6.1, 5.6, 5.1, 4.7, 4.3, 4] as const;

export interface Skel {
  hip: Pt;
  sh: Pt;
  /** near / far hind leg: hip joint, knee, hock (ankle), toe tip */
  hipN: Pt; kneeN: Pt; hockN: Pt;
  hipF: Pt; kneeF: Pt; hockF: Pt;
  /** near / far wing-arm: shoulder, elbow, wrist (= knuckle), finger tip (the folded wing's high point) */
  shN: Pt; elN: Pt; wrN: Pt; tipN: Pt;
  shF: Pt; elF: Pt; wrF: Pt; tipF: Pt;
  /** the wing membranes (near / far): one continuous part, see wingGeo */
  wgN: WingGeo; wgF: WingGeo;
  neck: Pt;
  head: Pt;
  eye: Pt;
  mouth: Pt;
  fang: Pt;
  sac: Pt;
  tail: Pt[];
  bulb: Pt;
  /** bulb axis (unit, along the last segment) */
  dir: Pt;
  sting: Pt;
  hookM: Pt;
  quills: Pt[];
}

export interface WingHole {
  /** centre (frame px) */
  c: Pt;
  /** inner radii (px) */
  rx: number;
  ry: number;
  /** shape seed (the ragged rim, which rim pixels are broken, the drip) */
  seed: number;
  /** a tear on the trailing edge (opens to the outside) instead of a hole inside the panel */
  tear?: boolean;
}

export interface WingGeo {
  /** the finger root (the folded wing-knuckle; the wrist in the shield / spread) */
  R: Pt;
  /** the three finger tips: F[0] the leading (long) finger */
  F: Pt[];
  /** where the trailing edge meets the body / the arm */
  A: Pt;
  /** scallop depth of the trailing edge (0 = straight, toward R) */
  dep: number;
  /** eaten holes: each a different size and shape, never two on one row (the corrosion, not a pattern) */
  holes: WingHole[];
}

const lerp2 = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const add = (a: Pt, dx: number, dy: number): Pt => [a[0] + dx, a[1] + dy];

/**
 * The wing as one continuous part: four configurations blended by the shield (s) and spread (sp)
 * weights. Folded: a narrow tongued membrane on the UPPER third of the flank, hanging from the finger
 * ridge that runs back from the wing-knuckle over the elbow. Hood (sp 0.6): a SIDEWAYS fan over the
 * shoulders, wider than tall (≈ 26 × 19), three ribs radiating from the lifted wrist. Spread (sp 1):
 * both wings fan up and BACK, the far wing's trailing tip passing behind the tail root (wider than the
 * barrel), the head clear in front. Shield: the near wing lifted over the face, the fingers fanning
 * forward-down into a sloped ≈ 21 × 21 fan in front of the chest and head.
 */
function wingGeo(near: boolean, sh: Pt, el: Pt, wr: Pt, s: number, sp: number, drape: number): WingGeo {
  // folded
  const fR = add(el, near ? 0 : -1, near ? -5 : -9);
  const fF = near
    ? [add(sh, -29, -6), add(sh, -23, 1 + drape), add(sh, -15, 2 + drape)]
    : [add(sh, -22, -7), add(sh, -17, -2), add(sh, -12, -1)];
  const fA = add(el, -1, 2);
  // the hood: a sideways fan over the shoulders (the far one a step higher and forward: two layers)
  const hR = near ? add(sh, 1, -14) : add(sh, -1, -17);
  const hF = near ? [add(sh, -6, -26), add(sh, -18, -23), add(sh, -25, -13)] : [add(sh, -4, -29), add(sh, -14, -27), add(sh, -20, -20)];
  const hA = near ? add(sh, -14, -5) : add(sh, -10, -9);
  // spread: up and back, the far wing the wider one (its trailing tip behind the tail root)
  const pR = near ? add(sh, 0, -18) : add(sh, -1, -21);
  const pF = near
    ? [add(sh, -4, -35), add(sh, -21, -31), add(sh, -33, -19)]
    : [add(sh, -5, -38), add(sh, -26, -35), add(sh, -42, -24)];
  const pA = near ? add(sh, -17, -6) : add(sh, -27, -10);
  // shield (near only): the fingers fan forward-down from the lifted wrist
  const gF = [add(wr, 14, 3), add(wr, 14, 15), add(wr, 6, 21)];
  const gA = add(sh, 9, 6);
  const HOOD = 0.6;
  const path = (f: Pt, h: Pt, p: Pt): Pt => (sp <= HOOD ? lerp2(f, h, sp / HOOD) : lerp2(h, p, (sp - HOOD) / (1 - HOOD)));
  const bl = (f: Pt, h: Pt, p: Pt, g: Pt): Pt => lerp2(path(f, h, p), g, s);
  const R = bl(fR, hR, pR, wr);
  const F = [0, 1, 2].map((i) => bl(fF[i], hF[i], pF[i], gF[i]));
  const A = bl(fA, hA, pA, gA);
  const dep = lerp(sp <= HOOD ? lerp(0.3, 0.26, sp / HOOD) : 0.25, 0.22, s);
  const open = Math.max(s, sp);
  const holes: WingHole[] = [];
  // the trailing-edge scallop between F1 and F2 (where the folded strip is torn)
  const sc12: Pt = [lerp((F[1][0] + F[2][0]) / 2, R[0], dep), lerp((F[1][1] + F[2][1]) / 2, R[1], dep)];
  if (open < 0.3) {
    // folded: ONE ragged tear on the strip's trailing edge (not a ring in mid-flank)
    holes.push({ c: lerp2(sc12, R, 0.08), rx: 2.1, ry: 1.6, seed: near ? 3 : 4, tear: true });
  } else if (s >= 0.5) {
    // the shield: the eye hole (set by drawWing) + a bigger ragged one low beside the last rib
    holes.push({ c: lerp2(lerp2(R, F[2], 0.62), F[1], 0.25), rx: 2.6, ry: 2.1, seed: 7 });
  } else {
    // hood / spread: a 3×3 near the trailing edge, a 5×4 low by the last rib (different rows, sizes)
    holes.push({ c: lerp2(sc12, R, 0.3), rx: 1.6, ry: 1.6, seed: near ? 11 : 12 });
    if (near) holes.push({ c: add(lerp2(R, F[2], 0.5), 0, 2.5), rx: 2.6, ry: 2.1, seed: 13 });
  }
  return { R, F, A, dep, holes };
}

export function tailAngles(o: Pose): number[] {
  if (o.tail) return [...o.tail];
  const a0 = ARCH[0] + o.tRot;
  return ARCH.map((a, i) => a0 + (a - ARCH[0]) * o.tCurl + (o.tLag * i) / 8);
}

export function skeleton(o: Pose): Skel {
  const r = o.rear;
  const bx = o.bx + (o.shake === 1 ? 1 : o.shake === 2 ? -1 : 0);
  const hip: Pt = [30 + bx - o.sit, 64 + o.by + o.sit];
  const sh: Pt = [61 + bx - r * 4, 61 + o.by + o.sy - r * 13 + o.sit * 0.5];
  // hind legs: feet planted at fixed points (HA-9)
  const hipN: Pt = [hip[0] + 2, hip[1] + 3];
  const hockN: Pt = [36, 81];
  const kneeN = ik(hipN, hockN, 11, 9, -1);
  const hipF: Pt = [hip[0] + 7, hip[1] + 4];
  const hockF: Pt = [43, 81];
  const kneeF = ik(hipF, hockF, 10, 8, -1);
  // wing-arms (pterosaur forelimbs): shoulder → an elbow bent BACK → a forward-angled forearm down to
  // the knuckle planted on the floor. The wing is ONE continuous part in every frame (wingGeo): its
  // finger root R, three finger tips and the body attach A blend between three configurations (folded
  // on the upper flank · the guard shield in front of the face · spread above the back), so it peels,
  // lifts and unfolds instead of swapping shapes.
  const shN: Pt = [sh[0] + 1, sh[1] - 6];
  const shF: Pt = [sh[0] + 5, sh[1] - 5];
  const s = clamp(o.shield, 0, 1);
  const sp = clamp(o.wing, 0, 1);
  const wrP: Pt = [lerp(58 + o.nk[0], sh[0] + 6, r), lerp(83 - o.nk[1], sh[1] + 15, r)];
  const wrG: Pt = [sh[0] + 16, sh[1] - 13];
  const wrN = lerp2(wrP, wrG, s);
  const elN = lerp2(ik(shN, wrN, 12, 22, 1), [sh[0] + 5, sh[1] - 4], s);
  const wrF: Pt = [lerp(65 + o.fk[0], sh[0] + 11, r), lerp(83 - o.fk[1], sh[1] + 13, r)];
  const elF = ik(shF, wrF, 11, 19, 1);
  const wgN = wingGeo(true, sh, elN, wrN, s, sp, o.drape);
  const wgF = wingGeo(false, [sh[0] + 5, sh[1] - 2], elF, wrF, 0, sp, 0);
  const tipN = wgN.F[0];
  const tipF = wgF.F[0];
  // neck / head
  const neck: Pt = [sh[0] + 5, sh[1] - 4];
  const head: Pt = [sh[0] + 17 + o.hx, sh[1] - 8 + o.hy];
  const eye: Pt = [head[0] + 5, head[1] - 1];
  const mouth: Pt = [head[0] + 14, head[1] + 5 + o.tilt];
  const fang: Pt = [head[0] + 14, head[1] + 7 + o.tilt];
  const sac: Pt = [head[0] + 4, head[1] + 10];
  // tail
  const ang = tailAngles(o);
  const root: Pt = [hip[0] - 6, hip[1] - 9 + o.ty];
  const tail: Pt[] = [root];
  for (let i = 0; i < ang.length; i++) {
    const p = tail[i];
    tail.push([p[0] + Math.cos(ang[i] * DEG) * T_STEP, p[1] + Math.sin(ang[i] * DEG) * T_STEP]);
  }
  for (let i = 6; i < tail.length; i++) {
    const k = (i - 5) / (tail.length - 6);
    tail[i] = [tail[i][0] + o.tdx * k, tail[i][1] + o.tdy * k];
  }
  const last = ang[ang.length - 1] * DEG;
  const dir: Pt = [Math.cos(last), Math.sin(last)];
  const end = tail[tail.length - 1];
  const bulb: Pt = [end[0] + dir[0] * 2.5, end[1] + dir[1] * 2.5];
  // the stinger hooks forward-down from the bulb's front
  const brx = 4.4 + clamp(o.bulb, 0, 3) * 0.5;
  // the stinger hooks forward then down from the bulb's front (hook mid point, then the tip)
  const hookM: Pt = [bulb[0] + dir[0] * (brx + 3), bulb[1] + dir[1] * (brx + 3)];
  const hookA = last + 1.25;
  const sting: Pt = [hookM[0] + Math.cos(hookA) * 4, hookM[1] + Math.sin(hookA) * 4];
  // quills along the back line, front → back
  void brx;
  const quills: Pt[] = [];
  for (let i = 0; i < 6; i++) {
    const k = i / 5;
    quills.push([lerp(sh[0] - 4, hip[0] - 2, k), lerp(sh[1] - 10, hip[1] - 12, k) - Math.sin(k * Math.PI) * 1.5 - (k > 0.1 && k < 0.95 ? o.breath : 0)]);
  }
  return { hookM, hip, sh, hipN, kneeN, hockN, hipF, kneeF, hockF, shN, elN, wrN, tipN, wgN, shF, elF, wrF, tipF, wgF, neck, head, eye, mouth, fang, sac, tail, bulb, dir, sting, quills };
}

// ---------------------------------------------------------------- frame

export interface Frame {
  p: PixelCanvas;
  comp: Comp;
  light: Light;
  o: Pose;
  sk: Skel;
  /** membrane hole pixels: transparent again after the outline where nothing is behind them */
  holes: number[];
  /** acid drips that ran off a hole's rim past the membrane (painted after the outline) */
  drips: number[];
  /** the shield hole the eye glints through (guard) */
  eyeHole?: Pt | null;
}

const OUT = PAL.void0;

/** Tapered stroke mask along a path (a disc per sample). */
function strokeMask(q: PixelCanvas, pts: readonly Pt[], ws: readonly number[], c: number): void {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
    for (let s = 0; s <= n; s++) {
      const t = s / n;
      const w = lerp(ws[i - 1], ws[i], t);
      q.disc(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, w / 2, c);
    }
  }
}

/** The toxic under-glow: a 1-px leaf2 rim on the part's edge pixels facing away from the light and down. */
function rimOn(f: Frame, q: PixelCanvas, yMin = 0, every = 1): void {
  const ls = f.light.side;
  planes(q, (x, y, src) => {
    if (y < yMin) return null;
    const away = !src.isOpaque(x - ls, y);
    const down = !src.isOpaque(x, y + 1);
    if (!(away && down) && !(away && !src.isOpaque(x - ls, y - 1) && src.isOpaque(x, y - 1))) return null;
    if (every > 1 && (x + y) % every) return null;
    return RIM;
  });
}

// ---------------------------------------------------------------- parts

function drawHindLeg(f: Frame, near: boolean): void {
  const { sk, light } = f;
  const t: Tones = near ? HIDE : HIDE_FAR;
  const hip = near ? sk.hipN : sk.hipF;
  const kn = near ? sk.kneeN : sk.kneeF;
  const hk = near ? sk.hockN : sk.hockF;
  const q = layer();
  if (near) q.ellipse(hip[0] + 1, hip[1] + 1, 8, 9, t.M); // the thick thigh over the haunch
  q.poly(tubePoly(hip, kn, near ? 11 : 8, near ? 8 : 6), t.M);
  q.poly(tubePoly(kn, hk, near ? 6 : 5, near ? 5 : 4), t.M);
  bands(q, t, light, { top: 2, lit: 3, sh: 2, bottom: 1, half: near ? 0.7 : 0 });
  if (near) rimOn(f, q, kn[1]);
  f.comp.add(q, near ? Part.legN : Part.legF, { out: OUT });
  // the foot: a broad 3-toed chitin-clawed foot flat on the floor (toes forward)
  const x0 = rnd(hk[0]) - 3;
  const ft = layer();
  ft.poly([[x0, GY - 5], [x0 + 5, GY - 6], [x0 + 9, GY - 3], [x0 + 9, GY], [x0, GY]], t.M);
  bands(ft, t, light, { top: 1, lit: 2, sh: 1, bottom: 1, crease: false });
  f.comp.add(ft, near ? Part.legN : Part.legF, { out: OUT });
  const cl = near ? CHITIN : CHITIN_FAR;
  const c = layer();
  c.poly([[x0 + 9, GY - 3], [x0 + 11, GY - 2], [x0 + 11, GY], [x0 + 9, GY]], cl.M);
  c.set(x0 + 9, GY - 3, cl.L).set(x0 + 10, GY - 2, cl.L);
  if (near) c.set(x0 + 6, GY - 1, cl.M).set(x0 + 7, GY - 1, cl.M).set(x0 + 6, GY, cl.L).set(x0 + 7, GY, cl.M);
  f.comp.add(c, near ? Part.legN : Part.legF, {});
}

function drawBarrel(f: Frame): void {
  const { sk, light } = f;
  const [hx, hy] = sk.hip;
  const [sx, sy] = sk.sh;
  const br = f.o.breath;
  const q = layer();
  const pts: Pt[] = [
    [hx - 9, hy - 9], [hx - 2, hy - 12 - br], [hx + 8, hy - 13 - br], [sx - 12, sy - 11 - br], [sx - 3, sy - 11],
    [sx + 5, sy - 8], [sx + 9, sy - 2], [sx + 9, sy + 5], [sx + 6, sy + 10],
    [sx - 2, sy + 13], [hx + 16, hy + 12], [hx + 5, hy + 11], [hx - 6, hy + 8], [hx - 11, hy + 2], [hx - 11, hy - 4],
  ];
  q.poly(pts, HIDE.M);
  bands(q, HIDE, light, { top: 2, lit: 4, sh: 3, bottom: 1, half: 0.8 });
  // scale rows: 2-px mag1 teeth every ≈5 px hanging off the lit / mid boundary (MA-2: scales, not a smooth plane)
  planes(q, (x, y, src) => {
    if (src.get(x, y) !== HIDE.M || src.get(x, y - 1) !== HIDE.L) return null;
    return (x + 2 * (y & 1)) % 5 < 2 ? HIDE.L : null;
  });
  f.comp.add(q, Part.barrel, { out: OUT });
  // belly plates: a stone2 band along the underside, stone1 seams every 3 px (the 1× read of the lower body)
  const b = layer();
  const y0 = (x: number) => {
    let y = GY;
    while (y > 0 && !q.isOpaque(x, y)) y--;
    return y;
  };
  for (let x = rnd(hx + 6); x <= rnd(sx + 6); x++) {
    const yb = y0(x);
    if (yb < 40) continue;
    for (let k = 0; k < 3; k++) {
      const y = yb - k;
      if (!q.isOpaque(x, y)) continue;
      // lit toward the light (the haunch end), in shadow toward the chest (the plates turn under the body)
      const lit = light.side < 0 ? x < hx + 18 : x > sx - 12;
      b.set(x, y, (x - rnd(hx)) % 3 === 0 ? PAL.stone1 : k === 2 && lit ? PAL.stone3 : lit ? PAL.stone2 : k === 2 ? PAL.stone2 : PAL.stone1);
    }
  }
  f.comp.add(b, Part.plates, {});
}

function drawTail(f: Frame): void {
  const { sk, light } = f;
  const pts = sk.tail;
  // hide segments 0…6: bead-like rings, each a capsule shaded on its own (a lit top per bead), laid
  // root first so every distal segment nests over the one before it (the scorpion's metasoma)
  for (let i = 0; i < 7; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const q = layer();
    const w = T_W[i];
    q.poly(tubePoly(a, b, w, T_W[i + 1]), HIDE.M);
    q.disc(b[0], b[1], T_W[i + 1] / 2, HIDE.M);
    if (i === 0) q.disc(a[0], a[1], w / 2, HIDE.M);
    bands(q, HIDE, light, { top: 2, lit: 2, sh: 2, bottom: 1, half: 0.6, crease: false });
    f.comp.add(q, Part.tail, { out: OUT });
  }
  // the toxic under-glow on the inner side of the rising arch: one run per segment (segments 0…4), a
  // 1-px gap at every joint, none on the top segments (under-glow, not a neon cable)
  const ls = light.side;
  const rim: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (f.comp.owner(x, y) !== Part.tail) continue;
      if (f.p.isOpaque(x - ls, y)) continue;
      // the nearest segment and the position along it
      let best = 1e9;
      let seg = -1;
      let along = 0;
      for (let i = 0; i < 7; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[i + 1];
        const vx = bx - ax;
        const vy = by - ay;
        const l2 = vx * vx + vy * vy || 1;
        const t = clamp(((x + 0.5 - ax) * vx + (y + 0.5 - ay) * vy) / l2, 0, 1);
        const d = Math.hypot(ax + vx * t - x - 0.5, ay + vy * t - y - 0.5);
        if (d < best) {
          best = d;
          seg = i;
          along = t * Math.sqrt(l2);
        }
      }
      if (seg < 0 || seg > 4) continue;
      if (along < 1.2 || along > T_STEP - 1.2) continue;
      rim.push(x, y);
    }
  for (let i = 0; i < rim.length; i += 2) f.p.set(rim[i], rim[i + 1], RIM);
  // chitin segments 7, 8: two bone-grey rings
  for (let i = 7; i < 9; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const c = layer();
    c.poly(tubePoly(a, b, T_W[i], T_W[i + 1]), CHITIN.M);
    c.disc(b[0], b[1], T_W[i + 1] / 2, CHITIN.M);
    bands(c, CHITIN, light, { top: 1, lit: 2, sh: 3, bottom: 1, edge: false });
    f.comp.add(c, Part.chitin, { out: PAL.stone0 });
  }
}

function drawBulb(f: Frame): void {
  const { sk, o, light } = f;
  const [bx, by] = sk.bulb;
  const sw = clamp(o.bulb, 0, 3);
  const rx = 4.4 + sw * 0.5;
  const ry = 3.8 + sw * 0.4;
  const [dx, dy] = sk.dir;
  if (o.smear > 0) {
    // the whip smear (HA-12): a 2-px wide venom streak trailing the bulb along its arc, outlined with the body
    const back = sk.tail[sk.tail.length - 4];
    const vx = back[0] - bx;
    const vy = back[1] - by;
    const vl = Math.hypot(vx, vy) || 1;
    const sm = layer();
    strokeMask(sm, [[bx, by], [bx + (vx / vl) * 5 - dy * 3, by + (vy / vl) * 5 + dx * 3], [bx + (vx / vl) * 9 - dy * 5, by + (vy / vl) * 9 + dx * 5]], [5, 3, 1.5], VEN.deep);
    f.comp.add(sm, Part.fx, {});
  }
  // the stinger first (the bulb sits over its root): a hooked chitin spike from the bulb's front
  const s = layer();
  const a: Pt = [bx + dx * (rx - 2), by + dy * (rx - 2)];
  strokeMask(s, [a, sk.hookM, sk.sting], [4.2, 2.8, 1], CHITIN.M);
  bands(s, CHITIN, light, { top: 1, lit: 1, sh: 1, bottom: 1, crease: false });
  f.comp.add(s, Part.bulb, { out: PAL.ink });
  // the bulb: a translucent sac of venom (deep below, body above), a chitin collar where the tail joins
  const q = layer();
  q.ellipse(bx, by, rx, ry, VEN.body);
  planes(q, (x, y, src) => {
    const u = (x + 0.5 - bx) * dx + (y + 0.5 - by) * dy;
    if (u < -rx + 1.6) return CHITIN.M;
    // the chitin casing lip where the stinger joins (stone2, across the bulb's front)
    const v = -(x + 0.5 - bx) * dy + (y + 0.5 - by) * dx;
    if (u > rx - 1.2 && Math.abs(v) < 2.2) return PAL.stone2;
    const dn = !src.isOpaque(x, y + 1) || !src.isOpaque(x, y + 2);
    const up = !src.isOpaque(x, y - 1);
    if (up) return VEN.body;
    if (dn) return VEN.dark;
    return y + 0.5 > by + 0.5 ? VEN.deep : VEN.body;
  });
  f.comp.add(q, Part.bulb, { out: PAL.ink });
}

/** Inside a ragged oval hole: the rim radius wobbles per pixel (seeded), so no two holes share a stamp. */
function holeInside(h: WingHole, cx: number, cy: number, x: number, y: number): boolean {
  const d = Math.hypot((x + 0.5 - cx) / h.rx, (y + 0.5 - cy) / h.ry);
  const ang = Math.atan2(y + 0.5 - cy, x + 0.5 - cx);
  // a low-frequency wobble (a notch / a bulge), not pixel noise
  const wob = 0.22 * Math.sin(ang * 2 + h.seed * 1.7) + 0.14 * Math.sin(ang * 3 + h.seed * 0.9);
  return d <= 1 + wob;
}

/** The pixels of a hole centred at (cx, cy) if it (and, unless a tear, its whole rim) lies on the panel, else null. */
function holeFit(q: PixelCanvas, h: WingHole, cx: number, cy: number): number[] | null {
  const hole: number[] = [];
  for (let y = Math.floor(cy - h.ry - 2); y <= Math.ceil(cy + h.ry + 2); y++)
    for (let x = Math.floor(cx - h.rx - 2); x <= Math.ceil(cx + h.rx + 2); x++) {
      if (!holeInside(h, cx, cy, x, y)) continue;
      if (h.tear) {
        if (q.isOpaque(x, y)) hole.push(x, y);
        continue;
      }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!q.isOpaque(x + dx, y + dy)) return null;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (q.get(x + dx, y + dy) === VEN.body) return null;
      hole.push(x, y);
    }
  return hole.length >= (h.tear ? 5 : 7) ? hole : null;
}

/**
 * Eat one hole into a membrane layer near h.c (the nearest spot within 3 px where it fits): a ragged
 * oval (3–6 px), a leaf3 rim with 1–2 BROKEN pixels, and one leaf2 drip running down from its lowest
 * rim pixel. A tear opens to the trailing edge. Real transparency after the outline where nothing is
 * behind it. Returns the hole's centre pixel.
 */
function holeIn(f: Frame, q: PixelCanvas, h: WingHole, keep?: number[]): Pt | null {
  let hole: number[] | null = null;
  let at: Pt = h.c;
  search: for (let r = 0; r <= 3; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        at = [rnd(h.c[0]) + dx, rnd(h.c[1]) + dy];
        hole = holeFit(q, h, at[0], at[1]);
        if (hole) break search;
      }
  if (!hole) return null;
  const isHole = new Set<number>();
  for (let i = 0; i < hole.length; i += 2) isHole.add(hole[i + 1] * W + hole[i]);
  for (let i = 0; i < hole.length; i += 2) {
    q.erase(hole[i], hole[i + 1]);
    keep?.push(hole[i], hole[i + 1]);
    f.holes.push(hole[i], hole[i + 1]);
  }
  // the rim: 4-neighbours of the hole still on the panel
  const rim: number[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < hole.length; i += 2)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = hole[i] + dx;
      const y = hole[i + 1] + dy;
      const id = y * W + x;
      if (isHole.has(id) || seen.has(id) || !q.isOpaque(x, y)) continue;
      seen.add(id);
      rim.push(x, y);
    }
  // break 1–2 rim pixels (the upper ones: the acid runs down, the top edge is dry)
  const order: number[] = [];
  for (let i = 0; i < rim.length; i += 2) order.push(i);
  order.sort((i, j) => rim[i + 1] - rim[j + 1] || hash2(rim[i], rim[i + 1], h.seed) - hash2(rim[j], rim[j + 1], h.seed));
  const broken = new Set([order[0]]);
  if (rim.length > 12) broken.add(order[2 + (h.seed % 3)]);
  for (let i = 0; i < rim.length; i += 2) {
    keep?.push(rim[i], rim[i + 1]);
    if (!broken.has(i)) q.set(rim[i], rim[i + 1], VEN.body);
  }
  // one drip from the lowest rim pixel (seeded among the lowest row)
  let lo = -1;
  for (let i = 0; i < rim.length; i += 2) if (lo < 0 || rim[i + 1] > rim[lo + 1] || (rim[i + 1] === rim[lo + 1] && hash2(rim[i], 0, h.seed) > 0.5)) lo = i;
  if (lo >= 0) {
    const x = rim[lo];
    const y = rim[lo + 1];
    const n = h.rx * h.ry > 4 ? 2 : 1;
    for (let k = 1; k <= n; k++) {
      if (q.isOpaque(x, y + k)) q.set(x, y + k, VEN.deep);
      else {
        f.drips.push(x, y + k);
        break;
      }
    }
  }
  return at;
}

/** A 1-px line inside a layer (only over its opaque pixels). */
function lineIn(q: PixelCanvas, a: Pt, b: Pt, c: number, from = 0, to = 1): void {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 1.5);
  for (let i = Math.floor(n * from); i <= n * to; i++) {
    const x = rnd(lerp(a[0], b[0], i / n) - 0.5);
    const y = rnd(lerp(a[1], b[1], i / n) - 0.5);
    if (q.isOpaque(x, y)) q.set(x, y, c);
  }
}

/**
 * One wing (near / far), ONE continuous part in every frame (skeleton wingGeo): the wing-knuckle R on
 * the elbow, the leading finger running from it, two more finger ribs, and the membrane between the
 * arm, the fingers and the body attach A with a scalloped (folded: tongued) trailing edge. Membrane
 * tones: a void2 panel, void1 web / ribs, a mag1 leading edge, void0 only in the hem crease. The near
 * one carries the eaten holes (a closed leaf3 ring round a real hole).
 */
function drawWing(f: Frame, near: boolean): void {
  const { sk, o, light } = f;
  const g = near ? sk.wgN : sk.wgF;
  const el = near ? sk.elN : sk.elF;
  const t = near ? MEMB : MEMB_FAR;
  const { R, F, A, dep } = g;
  const sc = (a: Pt, b: Pt): Pt => [lerp(lerp(a[0], b[0], 0.5), R[0], dep), lerp(lerp(a[1], b[1], 0.5), R[1], dep)];
  const q = layer();
  const keep: number[] = [];
  q.poly([el, R, F[0], sc(F[0], F[1]), F[1], sc(F[1], F[2]), F[2], sc(F[2], A), A], t.M);
  // planes: the leading edge (toward the top / the light) lit, the hem underside a 1-px crease
  planes(q, (x, y, src) => {
    if (!src.isOpaque(x, y + 1) && src.isOpaque(x, y - 1)) return t.D;
    if (!src.isOpaque(x, y - 1) || !src.isOpaque(x + light.side, y)) return t.L;
    return null;
  });
  // the web: a rib along each trailing finger (1 px, the membrane's folds)
  for (const tip of [F[1], F[2]]) {
    lineIn(q, R, tip, t.S, 0.12, 0.95);
    lineIn(q, [R[0], R[1] + 1], [tip[0], tip[1] + 0.5], t.S, 0.12, 0.6);
  }
  if (near && o.shield > 0.6) {
    // the shield: the eye glints through a small hole over it
    f.eyeHole = holeIn(f, q, { c: [sk.eye[0] + 0.5, sk.eye[1] - 0.5], rx: 1.7, ry: 1.5, seed: 21 }, keep);
  }
  for (const h of g.holes) if (near || o.wing > 0.3) holeIn(f, q, h, keep);
  f.comp.add(q, near ? Part.cape : Part.wingF, { out: OUT });
  // the bones: el → R (the wing metacarpal) and the leading finger R → F0 (hide), a chitin claw on R
  const b = layer();
  const bt = near ? HIDE : HIDE_FAR;
  b.poly(tubePoly(el, R, near ? 3.6 : 3, near ? 3.2 : 2.6), bt.M);
  b.disc(R[0], R[1], near ? 1.8 : 1.4, bt.M);
  b.poly(tubePoly(R, F[0], near ? 3 : 2.4, 1.3), bt.M);
  bands(b, bt, light, { top: 1, lit: 1, sh: 0, bottom: 0, crease: false, edge: false });
  for (let i = 0; i < keep.length; i += 2) b.erase(keep[i], keep[i + 1]); // the holes stay open through the bones
  // the bones lie ON the membrane: no separation line over it (only toward the body)
  f.comp.add(b, near ? Part.cape : Part.wingF, { out: OUT, outSkip: [near ? Part.cape : Part.wingF] });
  const c = layer();
  const cl = near ? CHITIN : CHITIN_FAR;
  const ux = R[0] - el[0];
  const uy = R[1] - el[1];
  const ul = Math.hypot(ux, uy) || 1;
  const cx = rnd(R[0] + (ux / ul) * 2 - 0.5);
  const cy = rnd(R[1] + (uy / ul) * 2 - 0.5);
  c.set(cx, cy, cl.M).set(cx + 1, cy - 1, cl.L);
  f.comp.add(c, near ? Part.cape : Part.wingF, { out: PAL.ink });
}

function drawArm(f: Frame, near: boolean): void {
  const { sk, light, o } = f;
  const t = near ? HIDE : HIDE_FAR;
  const sh = near ? sk.shN : sk.shF;
  const el = near ? sk.elN : sk.elF;
  const wr = near ? sk.wrN : sk.wrF;
  // upper arm back-down to the elbow (thick), a forearm angled forward that tapers to the wrist bulge
  const q = layer();
  q.poly(tubePoly(sh, el, near ? 7 : 6, near ? 5 : 4.4), t.M);
  q.disc(el[0], el[1], near ? 2.6 : 2.2, t.M);
  q.poly(tubePoly(el, wr, near ? 4.6 : 4, near ? 2.6 : 2.4), t.M);
  const wb = lerp2(el, wr, 0.82);
  q.disc(wb[0], wb[1], near ? 1.9 : 1.6, t.M);
  bands(q, t, light, { top: 1, lit: 2, sh: 1, bottom: 1 });
  f.comp.add(q, near ? Part.armN : Part.armF, { out: OUT });
  // the wrist knuckle: a chitin claw-hand planted on the floor (or lifted)
  const k = layer();
  const cl = near ? CHITIN : CHITIN_FAR;
  const wx = rnd(wr[0]);
  const wy = rnd(wr[1]);
  const planted = !(near && o.shield > 0.05) && o.rear < 0.3;
  if (planted) {
    k.poly([[wx - 2, wy - 1], [wx + 1, wy - 2], [wx + 4, wy + 1], [wx + 4, wy + 3], [wx - 2, wy + 3]], cl.M);
  } else {
    k.poly([[wx - 2, wy - 2], [wx + 2, wy - 2], [wx + 4, wy], [wx + 2, wy + 2], [wx - 2, wy + 1]], cl.M);
  }
  bands(k, cl, light, { top: 1, lit: 1, sh: 1, bottom: 1, crease: false });
  f.comp.add(k, near ? Part.armN : Part.armF, { out: PAL.ink });
  // the elbow spur: a short chitin hook pointing back
  const e = layer();
  e.set(rnd(el[0]) - 3, rnd(el[1]), cl.L).set(rnd(el[0]) - 2, rnd(el[1]), cl.M);
  f.comp.add(e, near ? Part.armN : Part.armF, { out: PAL.ink });
}

function drawNeckHead(f: Frame): void {
  const { sk, o, light } = f;
  const [nx, ny] = sk.neck;
  const [hx, hy] = sk.head;
  // neck: a thick tube from the chest to the back of the skull, chitin plates under it
  const n = layer();
  n.poly(tubePoly([nx - 2, ny + 2], [hx - 2, hy + 2], 11, 8), HIDE.M);
  bands(n, HIDE, light, { top: 2, lit: 2, sh: 2, bottom: 1, half: 0.7 });
  f.comp.add(n, Part.neck, { out: OUT });
  const nb = layer();
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const x = rnd(lerp(nx + 2, hx - 1, t));
    const yb = rnd(lerp(ny + 7, hy + 6, t));
    for (let k = 0; k < 2; k++) if (f.p.isOpaque(x, yb - k) && f.comp.owner(x, yb - k) === Part.neck) nb.set(x, yb - k, i % 3 === 0 ? PAL.stone1 : k === 1 ? PAL.stone3 : PAL.stone2);
  }
  f.comp.add(nb, Part.neck, {});
  // skull + upper jaw: a long low viper wedge with a brow over the eye and a sharp snout
  const tl = o.tilt;
  const jaw = clamp(o.jaw, 0, 3);
  const h = layer();
  h.poly([
    [hx - 5, hy - 2], [hx - 1, hy - 5], [hx + 5, hy - 5], [hx + 7, hy - 3], [hx + 10, hy - 2 + tl * 0.3], [hx + 15, hy + 1 + tl * 0.7],
    [hx + 17, hy + 3 + tl], [hx + 16, hy + 5 + tl], [hx + 8, hy + 5 + tl * 0.6], [hx + 1, hy + 5], [hx - 4, hy + 4],
  ], HIDE.M);
  bands(h, HIDE, light, { top: 2, lit: 3, sh: 2, bottom: 1, half: 1.1 });
  // the brow ridge: a lit lip over a dark socket in front of the eye
  for (let x = rnd(hx + 1); x <= rnd(hx + 6); x++) if (h.isOpaque(x, rnd(hy - 3))) h.set(x, rnd(hy - 3), HIDE.L);
  for (let x = rnd(hx + 2); x <= rnd(hx + 6); x++) if (h.isOpaque(x, rnd(hy - 2))) h.set(x, rnd(hy - 2), HIDE.D);
  // nostril
  h.set(rnd(hx + 14), rnd(hy + 1 + tl * 0.7), PAL.void0);
  // lower jaw: hinged at the back, drops by `jaw`
  const j = layer();
  const jd = jaw * 1.4;
  j.poly([[hx - 3, hy + 4], [hx + 6, hy + 5 + tl * 0.6 + jd * 0.6], [hx + 14, hy + 6 + tl + jd], [hx + 13, hy + 8 + tl + jd], [hx + 5, hy + 9 + jd * 0.5], [hx - 2, hy + 8]], HIDE.M);
  bands(j, HIDE, light, { top: 1, lit: 2, sh: 1, bottom: 1 });
  rimOn(f, j, 0);
  // the throat sac under the jaw (translucent: drawn later as light inside an outlined skin)
  const sv = clamp(o.sac, 0, 3);
  const sacR = 2.8 + sv * 0.8;
  const sc = layer();
  sc.ellipse(sk.sac[0] + sv * 0.3, sk.sac[1] + sacR * 0.3, sacR + 1, sacR, PAL.void1);
  f.comp.add(sc, Part.sac, { out: OUT });
  f.comp.add(j, Part.head, { out: OUT });
  if (jaw > 0.5) {
    // the open mouth: a dark gap
    const m = layer();
    m.poly([[hx + 2, hy + 5], [hx + 15, hy + 4 + tl], [hx + 14, hy + 6 + tl + jd * 0.8], [hx + 4, hy + 6 + jd * 0.4]], PAL.void0);
    if (jaw >= 2.5) {
      // the hiss: venom strings between the jaws and a leaf2 tongue in the gape
      const tx = rnd(hx + 8);
      const ty = rnd(hy + 6 + tl * 0.6);
      m.set(tx, ty, VEN.deep).set(tx + 1, ty, VEN.deep).set(tx + 2, ty - 1, VEN.deep);
      m.set(rnd(hx + 11), rnd(hy + 5 + tl), VEN.body).set(rnd(hx + 11), rnd(hy + 6 + tl), VEN.body).set(rnd(hx + 6), rnd(hy + 5), VEN.body);
    }
    f.comp.add(m, Part.head, {});
  }
  f.comp.add(h, Part.head, { out: OUT });
  // teeth along the closed jaw line (bone-grey ticks)
  if (jaw <= 0.5) for (const dx of [6, 9, 12]) if (f.comp.owner(rnd(hx + dx), rnd(hy + 5 + tl * 0.6)) === Part.head) f.p.set(rnd(hx + dx), rnd(hy + 5 + tl * 0.6), PAL.stone3);
  // horns: two chitin horns sweeping back from the brow (the long one curving up at its tip)
  const hr = layer();
  strokeMask(hr, [[hx + 1, hy - 4], [hx - 4, hy - 7], [hx - 9, hy - 8], [hx - 12, hy - 11]], [3.6, 2.8, 1.8, 1], CHITIN.M);
  strokeMask(hr, [[hx - 3, hy - 1], [hx - 7, hy - 3], [hx - 10, hy - 3]], [2.6, 1.8, 1], CHITIN.M);
  bands(hr, CHITIN, light, { top: 1, lit: 1, sh: 1, bottom: 1, crease: false });
  f.comp.add(hr, Part.horn, { out: PAL.ink });
  // the fang (chitin, 1×2 below the upper jaw tip)
  const fg = layer();
  fg.set(rnd(sk.fang[0]), rnd(sk.fang[1]) - 1, PAL.stone4).set(rnd(sk.fang[0]), rnd(sk.fang[1]), PAL.stone3);
  f.comp.add(fg, Part.head, {});
}

function drawQuills(f: Frame): void {
  const { sk, o } = f;
  const q = layer();
  for (let i = 0; i < 6; i++) {
    const [x, y] = sk.quills[i];
    const h = 4 + o.bristle + (i === 1 || i === 2 ? 1 : 0);
    const bx = rnd(x);
    const by = rnd(y);
    for (let k = 0; k < h; k++) q.set(bx - (k >> 1), by - k, k === h - 1 ? PAL.stone3 : PAL.stone2);
  }
  f.comp.add(q, Part.horn, { out: PAL.ink });
}

// ---------------------------------------------------------------- light layer (after the outline)

function eyeLight(f: Frame): void {
  const { p, o, sk } = f;
  const [ex, ey] = [rnd(sk.eye[0]), rnd(sk.eye[1])];
  // the eye is hidden when a part covers it (the guard shield): it glints through the shield's eye hole
  if (f.comp.owner(ex, ey) !== Part.head) {
    if (f.eyeHole) {
      const [gx, gy] = f.eyeHole;
      p.set(gx, gy, o.eyeHot ? PAL.gold3 : PAL.gold2).set(gx + 1, gy, PAL.ink);
    }
    return;
  }
  if (o.eye >= 2) {
    // shut: a 3-px ink lid line
    p.set(ex - 1, ey, PAL.ink).set(ex, ey, PAL.ink).set(ex + 1, ey, PAL.ink);
    return;
  }
  const c = o.eyeHot ? PAL.gold3 : PAL.gold2;
  if (o.eye >= 1) {
    p.set(ex, ey, c).set(ex + 1, ey, PAL.ink);
    return;
  }
  p.set(ex, ey - 1, c).set(ex, ey, c).set(ex + 1, ey - 1, PAL.ink).set(ex + 1, ey, PAL.ink);
}

function sacLight(f: Frame): void {
  const { p, o, comp, sk } = f;
  const s = clamp(o.sac, 0, 3);
  const r = 2.8 + s * 0.8;
  const cx = sk.sac[0] + s * 0.3;
  const cy = sk.sac[1] + r * 0.3 + 0.6;
  const core = 0.3 + s * 0.13;
  for (let y = rnd(cy - r - 2); y <= rnd(cy + r + 2); y++)
    for (let x = rnd(cx - r - 3); x <= rnd(cx + r + 3); x++) {
      if (comp.owner(x, y) !== Part.sac) continue;
      // inner pixels only (the skin keeps its 1-px void1 edge)
      const inner = comp.owner(x - 1, y) === Part.sac && comp.owner(x + 1, y) === Part.sac && comp.owner(x, y - 1) === Part.sac && comp.owner(x, y + 1) === Part.sac;
      if (!inner) continue;
      const d = Math.hypot((x + 0.5 - cx) / (r + 1), (y + 0.5 - cy) / r);
      // hot (the hiss): only the lit upper half flashes gold3, the lower rim stays leaf3
      if (o.sacHot) p.set(x, y, y + 0.5 < cy + 0.5 && d < core + 0.35 ? PAL.gold3 : VEN.body);
      else p.set(x, y, d < core ? VEN.body : VEN.deep);
    }
}

function bulbLight(f: Frame): void {
  const { p, o, sk, comp } = f;
  const [bx, by] = sk.bulb;
  const g = clamp(o.glow, 0, 3);
  if (g <= 0) return;
  const venom = (x: number, y: number) => {
    if (comp.owner(x, y) !== Part.bulb) return false;
    const c = p.get(x, y);
    return c === VEN.body || c === VEN.deep || c === VEN.dark;
  };
  // the hot band: 2 rows on the bulb's upper-front quarter, leaf3 / gold3 side by side in IRREGULAR runs
  // (never a checker), ONE gold4 core pixel; the lower side keeps its leaf2
  const fx = sk.dir[0] >= 0 ? 1 : -1;
  const cx = rnd(bx - 0.5);
  const cy = rnd(by - 0.5);
  const Y = PAL.gold3;
  const G = VEN.body;
  const runs: number[][] =
    g >= 3
      ? [[G, Y, Y, G, Y, Y], [Y, G, Y, Y, G, G]]
      : g >= 2
        ? [[G, Y, Y, G, Y], [G, G, Y, G]]
        : [[G, Y, G, G], [G, G, Y]];
  runs.forEach((row, r) => {
    const y = cy - 1 + r;
    row.forEach((c, i) => {
      const x = cx + fx * (i - 2 + r);
      if (venom(x, y)) p.set(x, y, c);
    });
  });
  const kx = cx + fx * (g >= 2 ? 1 : 0);
  if (venom(kx, cy - 1) || p.get(kx, cy - 1) === Y) p.set(kx, cy - 1, VEN.core);
}

function beadLight(f: Frame): void {
  const { p, o, sk } = f;
  for (let i = 0; i < 6; i++) {
    const b = o.beads[i] ?? 0;
    if (b <= 0) continue;
    const [x, y] = sk.quills[i];
    const h = 4 + o.bristle + (i === 1 || i === 2 ? 1 : 0);
    const tx = rnd(x) - ((h - 1) >> 1);
    const ty = rnd(y) - h;
    const c = o.hot ? PAL.gold3 : VEN.body;
    // a bead on the quill tip: 1 px swelling → a 2×2 drop (leaf3 with a gold3 top pixel)
    p.set(tx, ty, c);
    if (b >= 2) p.set(tx - 1, ty, c).set(tx - 1, ty - 1, c).set(tx, ty - 1, PAL.gold3);
  }
}

/** The idle drip: a bead swells on the stinger hook, falls, splashes on the floor and leaves an etch dot. */
function dripLight(f: Frame): void {
  const { p, o, sk } = f;
  const d = o.drip;
  if (d <= 0) return;
  // the drop falls straight down from the hook tip; x stays inside the feet band (34…68, KK-5)
  const fx = clamp(rnd(sk.sting[0] - 0.5), 35, 67);
  const fy = rnd(sk.sting[1] - 0.5) + 1;
  if (d <= 3) {
    p.set(fx, fy, VEN.body);
    if (d >= 2) p.set(fx, fy + 1, VEN.deep);
    if (d >= 3) p.set(fx + 1, fy, VEN.deep).set(fx, fy + 2, VEN.body);
  } else if (d < 20) {
    const k = (d - 10) / 3.2;
    const y = rnd(lerp(fy + 3, GY - 2, k));
    // a falling drop with a 2-px streak above it
    p.set(fx, y, VEN.body).set(fx, y - 1, VEN.deep).set(fx, y - 2, VEN.dark);
  } else if (d === 20) {
    // the splash: a 3-px crown on the floor
    p.set(fx, GY, VEN.body).set(fx - 1, GY - 1, VEN.body).set(fx + 1, GY - 1, VEN.deep).set(fx - 2, GY - 2, VEN.deep).set(fx + 2, GY - 2, VEN.body).set(fx, GY - 1, PAL.gold3);
  } else {
    // the etch dot steps out (leaf1 → leaf0) with one steam pixel rising
    p.set(fx, GY, d === 21 ? VEN.dark : VEN.etch);
    if (d === 21) p.set(fx, GY - 3, PAL.stone3);
    else p.set(fx + 1, GY - 5, PAL.stone2);
  }
}

/** The venom crown at the stinger on the release frame (light, never outlined). */
function crownLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.crown <= 0) return;
  const x = rnd(sk.sting[0] - 0.5);
  const y = rnd(sk.sting[1] - 0.5);
  p.set(x + 1, y, PAL.gold3).set(x + 2, y - 1, VEN.body).set(x + 2, y + 1, VEN.body).set(x + 3, y, VEN.deep).set(x + 1, y + 2, VEN.deep).set(x + 1, y - 2, VEN.body);
}

/** Two thin mist puffs from the nostril (summon exhale): stone puffs, never white. */
function mistLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.mist <= 0) return;
  const nx = rnd(sk.head[0] + 14);
  const ny = rnd(sk.head[1] + o.tilt);
  const k = o.mist;
  const c = k >= 2 ? PAL.stone2 : PAL.stone3;
  // two thin puffs rising off the nostril (they never pass x 95: the frame margin)
  p.set(nx + k, ny - 2 * k, c).set(nx + k + 1, ny - 2 * k, c).set(nx + k + 1, ny - 2 * k - 1, PAL.stone2);
  p.set(nx + 2 + k, ny - k, c).set(nx + 3 + k, ny - k - 1, PAL.stone2);
}

// ---------------------------------------------------------------- death / revive passes

/** Hide parts the venom eats (everything but the chitin tail tip, the bulb and the stinger). */
const EATEN = new Set<number>([Part.wingF, Part.armF, Part.legF, Part.barrel, Part.plates, Part.tail, Part.cape, Part.thigh, Part.legN, Part.neck, Part.head, Part.sac, Part.horn, Part.armN, Part.fx]);

/** Part space: the corrosion web rides on the body (coordinates relative to the hip). */
function partXY(f: Frame, x: number, y: number): [number, number] {
  return [x - rnd(f.sk.hip[0]) + 40, y - rnd(f.sk.hip[1]) + 40];
}

/** The venom breaks out of every scale seam: a leaf3 web with gold3 nodes over the hide (self-lit). */
function seamWeb(f: Frame): void {
  const { p, comp, o } = f;
  if (o.seam <= 0.05) return;
  const k = o.seam;
  const front = f.sk.sh[0] - 12;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const own = comp.owner(x, y);
      if (!EATEN.has(own)) continue;
      if (o.seamPart === 1 && x < front) continue; // hitMagic: only the struck front half
      if (o.seamPart === 2 && own !== Part.tail) continue; // revive f8: the last seams on the tail
      const c = p.get(x, y);
      if (c === null || c === PAL.ink) continue;
      const [u, v] = partXY(f, x, y);
      const s = seamAt(u, v, 5);
      if (!s) continue;
      if (k < 0.5 && s === 1 && (x + y) & 1) continue; // a faint web: every other seam pixel
      const [u2, v2] = [u >> 2, v >> 2];
      // the gold3 nodes belong to the dying web only (a survived magic hit shows plain seams)
      const hotNode = o.seamPart === 0 && s === 2 && k >= 0.5 && hash2(u2, v2, 11) < 0.3;
      p.set(x, y, hotNode ? PAL.gold3 : s === 2 && k >= 0.5 ? VEN.body : o.seamPart === 1 ? VEN.body : VEN.deep);
    }
}

/** Holes eaten into the drake's own hide (real transparency), acid rims on the strands' lower edges. */
function eatHoles(f: Frame): void {
  const { p, comp, o } = f;
  if (o.holes <= 0) return;
  const gone = new Uint8Array(W * H);
  // step 1 (and still at 2): 6–8 ROUND holes (r 1.8 → 3–4 px) open at the seam NODES, the cape first
  const nodes: Pt[] = [];
  if (o.holes < 2.5) {
    const cand: [number, number, number][] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const own = comp.owner(x, y);
        if (!EATEN.has(own) || own === Part.horn || own === Part.fx) continue;
        const [u, v] = partXY(f, x, y);
        const w = webNode(u, v);
        if (w) cand.push([x, y, own === Part.cape || own === Part.wingF ? 0 : 1]);
      }
    cand.sort((a, b) => a[2] - b[2] || hash2(a[0], a[1], 3) - hash2(b[0], b[1], 3));
    for (const [x, y] of cand) {
      if (nodes.length >= 8) break;
      if (nodes.every(([nx, ny]) => Math.hypot(nx - x, ny - y) >= 9)) nodes.push([x, y]);
    }
  }
  const rN = o.holes < 1.5 ? 1.8 : 2.6;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!p.isOpaque(x, y)) continue;
      const own = comp.owner(x, y);
      // the outline belongs to whatever it wraps: test the hide under it
      const hide = EATEN.has(own) || (own === Part.none && p.get(x, y) === PAL.ink && !nearChitin(comp, x, y));
      if (!hide) continue;
      const [u, v] = partXY(f, x, y);
      // the membrane cape is eaten a step ahead (it falls away first)
      const step = own === Part.cape || own === Part.wingF ? Math.min(3, o.holes + 0.6) : o.holes;
      if ((o.holes >= 1.5 && holeAt(u, v, step, 5)) || nodes.some(([nx, ny]) => Math.hypot(nx - x, ny - y) <= rN)) gone[y * W + x] = 1;
    }
  for (let i = 0; i < W * H; i++) if (gone[i]) p.erase(i % W, (i / W) | 0);
  // rims: an acid lip under each hole (the venom runs down), one pixel
  for (let y = 1; y < H - 1; y++)
    for (let x = 0; x < W; x++) {
      if (!p.isOpaque(x, y) || !gone[(y - 1) * W + x] || !p.isOpaque(x, y + 1)) continue;
      if (!EATEN.has(comp.owner(x, y))) continue;
      p.set(x, y, VEN.body);
    }
  // the round node holes get a closed acid ring (they read as "it is being eaten" at 1×)
  if (nodes.length)
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        if (!p.isOpaque(x, y) || !EATEN.has(comp.owner(x, y))) continue;
        if (!nodes.some(([nx, ny]) => Math.abs(Math.hypot(nx - x, ny - y) - rN - 0.7) < 0.75)) continue;
        p.set(x, y, VEN.body);
      }
}

/** A seam node of the shared web (the centre pixel of a junction of three scales). */
function webNode(u: number, v: number): boolean {
  if (seamAt(u, v, 5) !== 2) return false;
  // the local best: no neighbour is a "tighter" node
  const n0 = webAt(u, v, 5).node;
  for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (seamAt(u + du, v + dv, 5) === 2 && webAt(u + du, v + dv, 5).node < n0) return false;
  return true;
}

function nearChitin(comp: Comp, x: number, y: number): boolean {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const o = comp.owner(x + dx, y + dy);
    if (o === Part.chitin || o === Part.bulb) return true;
  }
  return false;
}

/** Death f7: the lace slumps straight down into the pool (rows squashed toward the floor). */
function slumpPass(f: Frame): void {
  const { p, comp, o } = f;
  if (o.slump <= 0) return;
  const src = p.clone();
  const k = 1 - 0.62 * clamp(o.slump, 0, 1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (EATEN.has(comp.owner(x, y)) || (src.get(x, y) === PAL.ink && !nearChitin(comp, x, y))) p.erase(x, y);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = src.get(x, y);
      if (c === null) continue;
      if (!(EATEN.has(comp.owner(x, y)) || (c === PAL.ink && !nearChitin(comp, x, y)))) continue;
      const ny = rnd(GY - (GY - y) * k);
      if (ny >= 0 && ny < H && !p.isOpaque(x, ny)) p.set(x, ny, c);
    }
  // the chitin arch falls with it (its outline too): the stinger is redrawn upright by the marker
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const own = comp.owner(x, y);
      if (own === Part.chitin || own === Part.bulb || (own === Part.none && src.get(x, y) === PAL.ink && nearChitin(comp, x, y) && y < GY - 12)) p.erase(x, y);
    }
}

/** The boiling pool around the feet (death f7–f10, revive f2–f4): leaf1 rim, leaf2 surface, void0 depths, leaf3 bubbles. */
function poolPass(f: Frame): void {
  const { p, o } = f;
  if (o.pool <= 0) return;
  const k = clamp(o.pool, 0, 1);
  const cx = AX + 2;
  const cy = GY - 1.5;
  const rx = 15 * k + 1;
  const ry = 3.6 * k + 0.6;
  const q = layer();
  q.ellipse(cx, cy, rx, ry, PAL.leaf2);
  planes(q, (x, y, src) => {
    const dn = !src.isOpaque(x, y + 1);
    const up = !src.isOpaque(x, y - 1);
    if (up) return PAL.leaf1;
    if (dn) return PAL.void0;
    const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    return d < 0.62 ? PAL.void0 : d < 0.78 && (x + y) % 3 === 0 ? PAL.leaf1 : PAL.leaf2;
  });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (y > GY) q.erase(x, y);
  const ph = Math.floor(o.t * 10 + o.marker * 3);
  const bub: Pt[] = [[cx - 6 + (ph % 3), cy - 1], [cx + 5 - (ph % 2), cy]];
  // two distinct bubbles: a leaf3 cap over a leaf2 rim (2 px each)
  for (const [bx2, by2] of bub) {
    const x = rnd(bx2);
    const y = rnd(by2);
    if (!q.isOpaque(x, y) || !q.isOpaque(x + 1, y)) continue;
    q.set(x, y, VEN.body).set(x + 1, y, VEN.body);
    if (q.isOpaque(x, y - 1)) q.set(x, y - 1, VEN.body);
  }
  const tmp = layer();
  tmp.blit(q, 0, 0);
  tmp.outline(PAL.ink);
  for (let y = 0; y <= GY; y++)
    for (let x = 0; x < W; x++) {
      const c = tmp.get(x, y);
      if (c === null) continue;
      if (c === PAL.ink && p.isOpaque(x, y)) continue;
      p.set(x, y, c);
    }
}

/** The chitin stinger standing upright in the pool like a grave marker (sink 0 … 3). */
function markerPass(f: Frame): void {
  const { p, o, light } = f;
  if (o.marker < 0) return;
  const x0 = AX + 2;
  const sink = rnd(clamp(o.marker, 0, 3) * 4.5);
  const base = GY - 2 + sink - o.mlift;
  // the shape is laid out upright and turned by mtilt about its foot (death f7: it falls and rights itself)
  const ca = Math.cos(o.mtilt * DEG);
  const sa = Math.sin(o.mtilt * DEG);
  const T = (dx: number, dy: number): Pt => [x0 + dx * ca - dy * sa, base + dx * sa + dy * ca];
  const q = layer();
  // two chitin segments, the bulb casing, the hook on top pointing up and forward
  const e = (dx: number, dy: number, r: number) => {
    const [cx, cy] = T(dx, dy);
    q.ellipse(cx, cy, r, r, CHITIN.M);
  };
  e(0, -2.5, 2.6);
  e(0, -6.5, 2.35);
  e(0, -11, 3.2);
  strokeMask(q, [T(0, -13), T(1, -16), T(3, -17)], [2.4, 1.6, 1], CHITIN.M);
  bands(q, CHITIN, light, { top: 1, lit: 1, sh: 1, bottom: 1, crease: false });
  // the casing's empty heart (the venom is spent: a dark well with one leaf2 pixel)
  const [hx, hy] = T(0, -11);
  q.set(rnd(hx - 0.5), rnd(hy - 0.5), PAL.stone0).set(rnd(hx - 1.5), rnd(hy - 0.5), PAL.stone0).set(rnd(hx - 0.5), rnd(hy + 0.5), o.glow > 0 ? VEN.deep : PAL.stone0);
  for (let y = GY - 1; y < H; y++) for (let x = 0; x < W; x++) q.erase(x, y); // below the pool surface
  const tmp = layer();
  tmp.blit(q, 0, 0);
  tmp.outline(PAL.ink);
  if (o.mtilt !== 0) {
    // the fall smear (HA-12): two stone streaks trailing the casing back along its arc
    const a2 = T(-2, -13);
    for (let i = 0; i < 4; i++) {
      tmp.set(rnd(a2[0] - 0.5) - i, rnd(a2[1] - 0.5) - 2 - (i >> 1), i < 2 ? PAL.stone2 : PAL.stone1);
      tmp.set(rnd(a2[0] - 0.5) - i + 1, rnd(a2[1] - 0.5) - 4 - (i >> 1), PAL.stone1);
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = tmp.get(x, y);
      if (c === null || y >= GY - 1) continue;
      p.set(x, y, c);
    }
  // one bead of venom hanging on the hook (leaf3 under a gold3 glint), then it falls into the pool
  const [tx, ty] = T(3, -17);
  const bx = rnd(tx + 0.5);
  const by = rnd(ty + 0.5);
  if (o.mtilt === 0 && o.marker < 1.5 && o.glow > 0) p.set(bx, by, PAL.gold3).set(bx, by + 1, VEN.body).set(bx + 1, by + 1, VEN.body);
  else if (o.marker >= 1.5 && o.marker < 2) p.set(x0 + 4, GY - 5, VEN.deep).set(x0 + 4, GY - 4, VEN.body).set(x0 + 4, GY - 3, VEN.body);
}

/** The revive glob: hovering (1), falling with a smear (2), splatted with a crown (3). */
function globPass(f: Frame): void {
  const { p, o } = f;
  if (o.glob <= 0) return;
  const cx = AX + 2;
  const q = layer();
  if (o.glob === 1) {
    q.ellipse(cx, 64, 4.6, 4.1, VEN.deep);
    planes(q, (x, y, src) => (!src.isOpaque(x, y - 2) ? VEN.body : !src.isOpaque(x, y + 1) ? VEN.dark : null));
    q.set(cx - 2, 61, PAL.gold3).set(cx - 1, 63, VEN.core);
  } else if (o.glob === 2) {
    q.ellipse(cx, 76, 3.6, 5.1, VEN.deep);
    planes(q, (x, y, src) => (!src.isOpaque(x, y - 2) ? VEN.body : !src.isOpaque(x, y + 1) ? VEN.dark : null));
    q.set(cx - 1, 74, VEN.core);
    q.set(cx, 69, VEN.deep).set(cx, 68, VEN.dark).set(cx - 1, 70, VEN.dark); // the smear above (HA-12)
  } else {
    // the splat: drops thrown out of the pool (inside x 34…68 below y 81: the feet band)
    const drops: Pt[] = [[cx - 13, GY - 5], [cx - 9, GY - 9], [cx - 4, GY - 11], [cx + 1, GY - 12], [cx + 6, GY - 10], [cx + 10, GY - 8], [cx + 14, GY - 4], [cx - 16, GY - 3]];
    drops.forEach(([x, y], i) => q.set(x, y, i % 3 === 0 ? PAL.gold3 : VEN.body).set(x, y + 1, VEN.deep));
  }
  const tmp = layer();
  tmp.blit(q, 0, 0);
  if (o.glob < 3) tmp.outline(PAL.ink);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = tmp.get(x, y);
      if (c !== null) p.set(x, y, c);
    }
  if (o.glob === 1) {
    p.set(cx, 69, VEN.body); // the drip hanging under it
    for (let x = cx - 2; x <= cx + 2; x++) p.set(x, GY, PAL.void0); // its shadow dash on the floor
  }
}

// ---------------------------------------------------------------- draw

export function drawWyvern(p: PixelCanvas, o: Pose, lightFrom: 'left' | 'right'): void {
  const light = lightOf(lightFrom);
  const sk = skeleton(o);
  const comp = new Comp(p);
  const f: Frame = { p, comp, light, o, sk, holes: [], drips: [] };
  if (o.body > 0) {
    // back to front
    drawHindLeg(f, false);
    drawArm(f, false);
    drawWing(f, false);
    drawTail(f);
    drawBarrel(f);
    drawQuills(f);
    drawNeckHead(f);
    drawWing(f, true);
    drawHindLeg(f, true);
    drawArm(f, true);
    drawBulb(f);
  }
  p.outline(PAL.ink);
  for (let i = 0; i < f.holes.length; i += 2) {
    const x = f.holes[i];
    const y = f.holes[i + 1];
    if (comp.owner(x, y) === Part.none) p.erase(x, y);
  }
  if (o.body > 0) {
    for (let i = 0; i < f.drips.length; i += 2) if (!p.isOpaque(f.drips[i], f.drips[i + 1]) || comp.owner(f.drips[i], f.drips[i + 1]) === Part.none) p.set(f.drips[i], f.drips[i + 1], VEN.deep);
    sacLight(f);
    bulbLight(f);
    beadLight(f);
    eyeLight(f);
    seamWeb(f);
    eatHoles(f);
    slumpPass(f);
    if (o.slump <= 0) {
      dripLight(f);
      crownLight(f);
      mistLight(f);
    }
  }
  poolPass(f);
  markerPass(f);
  globPass(f);
  void hash2;
}
