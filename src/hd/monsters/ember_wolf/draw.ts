// Kor Kurdu HD — rig + drawing. 128×128 frame, faces right, ground at y = 117.
//
// Anatomy (side profile): a deep chest that drops below the belly line, tucked waist, shoulder
// hump under the mane, heavy haunch; front legs = upper arm → straight forearm → angled pastern,
// hind legs = thigh → gaskin → back-angled hock → near-vertical metatarsus, both IK'd from the
// paw targets. The torso has a front frame and a rear frame (the rear half pitches around the
// waist: coil / stretch). Head: domed skull, long tapering muzzle, a hinged lower jaw, a furnace
// inside the mouth.
//
// Parts back → front: ground fire trail (lunge), tail side tongues, far legs, far paw flames,
// tail stub, tail plume, body (torso + neck + fur fringes + ember seams), near hind leg, near
// front leg, mane (tongues growing out of the neck crest, over the body, under the head), far
// ear, mouth furnace + tongue, lower jaw, head (+ near ear, eye), near paw flames; overlays:
// drifting embers, lunge afterimages (scanline fire wolves), landing puff. Every flame goes
// through fire(), which keeps it inside the frame. The flames light the fur (fire.ts).

import { PAL } from '../../../art/palette';
import type { PixelCanvas } from '../../../art/pixel';
import {
  type DetailCtx,
  type FlameOpts,
  type HDRenderResult,
  type Part,
  type V2,
  DEG,
  HDRenderer,
  add,
  bezier,
  clamp,
  clamp01,
  dist,
  ik2,
  lagChain,
  lerp,
  lerpV,
  madd,
  mul,
  norm,
  norm3,
  perp,
  polar,
  rotV,
  sub,
} from '../../render';
import { type FireLight, fireLight } from './fire';
import { CLAW, EAR_IN, FLAME, FUR, FUR_FAR, FURNACE, HIDE, HIDE_FAR, NOSE, TONGUE, TOOTH } from './materials';
import { GROUND, type WolfPose } from './pose';

export const W = 128;
export const H = 128;
export const ANCHOR: V2 = [56, GROUND];

/** Torso center at rest. */
const C0: V2 = [54, 77];

const UPPER = 16;
const FORE = 19;
const PASTERN = 7;
const THIGH = 17;
const GASKIN = 16.5;
const META = 13;
const NECK = 20;

export interface FrontLeg {
  sh: V2;
  el: V2;
  wr: V2;
  paw: V2;
}
export interface HindLeg {
  hip: V2;
  st: V2;
  hk: V2;
  paw: V2;
}

export interface WolfRig {
  C: V2;
  /** Front / rear torso frames (local x forward, y down → frame px). */
  Bf: (x: number, y: number) => V2;
  Br: (x: number, y: number) => V2;
  fa: number;
  ra: number;
  /** Head frame (u toward the nose, v down; origin = skull center) and jaw frame. */
  Hd: (u: number, v: number) => V2;
  J: (u: number, v: number) => V2;
  ha: number;
  ja: number;
  neck: { a: V2; b: V2 };
  fn: FrontLeg;
  ff: FrontLeg;
  hn: HindLeg;
  hf: HindLeg;
  tail: V2[];
}

const frameAt =
  (C: V2, a: number, k = 1) =>
  (x: number, y: number): V2 => {
    const c = Math.cos(a) * k;
    const s = Math.sin(a) * k;
    return [C[0] + x * c - y * s, C[1] + x * s + y * c];
  };

/** Head scale (head-local units → px). */
const HS = 1.2;

function frontLeg(sh: V2, ground: V2, fpa: number): FrontLeg {
  const paw: V2 = [ground[0], ground[1] - 2.6];
  const wr = add(paw, polar(fpa, PASTERN));
  const k = ik2(sh, wr, UPPER, FORE, 1);
  return { sh, el: k.joint, wr: k.end, paw };
}

function hindLeg(hip: V2, ground: V2, hma: number): HindLeg {
  const paw: V2 = [ground[0], ground[1] - 2.6];
  const hk = add(paw, polar(hma, META));
  const k = ik2(hip, hk, THIGH, GASKIN, -1);
  return { hip, st: k.joint, hk: k.end, paw };
}

export function solve(P: WolfPose): WolfRig {
  const C: V2 = [C0[0] + P.x, C0[1] + P.y];
  const fa = -P.tilt * DEG;
  const ra = fa - P.rear * DEG;
  const Bf = frameAt(C, fa);
  const Br = frameAt(C, ra);
  const neckBase = Bf(16, -7);
  const na = -55 - P.tilt + P.neck;
  const Hc = add(neckBase, polar(na, NECK * P.nl));
  const ha = (10 + P.hp) * DEG;
  const Hd = frameAt(Hc, ha, HS);
  const ja = ha + P.jaw * 40 * DEG;
  const hinge = Hd(-3, 3.6);
  const J = (u: number, v: number): V2 => add(hinge, rotV([(u + 3) * HS, (v - 3.6) * HS], ja));
  const fn = frontLeg(Bf(19, -3), [P.fnx, P.fny], P.fpa);
  const ff = frontLeg(Bf(15, -3), [P.ffx, P.ffy], P.fpa + P.ffpa);
  const hn = hindLeg(Br(-20, -2), [P.hnx, P.hny], P.hma);
  const hf = hindLeg(Br(-23.5, -2), [P.hfx, P.hfy], P.hma + P.hfma);
  // tail: a short furry stub curling up and back; a wave travels root → tip
  const windBend = P.wind * -10;
  const tail = lagChain({
    root: Br(-29, -8),
    count: 5,
    seg: 3.6,
    rootAngle: 228 + P.tail - P.rear * 0.6 + -P.tilt * 0.4 + windBend,
    rest: [0, 10, 12, 12, 10],
    drive: (t) => Math.sin(t * Math.PI * 2) * P.tailAmp,
    t: P.tailPh,
    lag: 0.08,
  });
  return { C, Bf, Br, fa, ra, Hd, J, ha, ja, neck: { a: Bf(12, -4), b: Hd(-4, 2) }, fn, ff, hn, hf, tail };
}

// ------------------------------------------------------------------ helpers

/** Signed angle lerp toward 180° (back): flames stream behind the running wolf. */
function windDir(a: number, wind: number, k = 0.85): number {
  let d = 180 - a;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return a + d * wind * k;
}

/** A flame tongue spine from base along angle `a` (deg), curling by `curl` (deg) toward the tip. */
function tongue(base: V2, a: number, len: number, curl: number): V2[] {
  const m = add(base, polar(a + curl * 0.25, len * 0.5));
  const tip = add(m, polar(a + curl, len * 0.5));
  return bezier(base, add(base, polar(a, len * 0.35)), m, tip, 8);
}

/**
 * Living flame, kept inside the frame: the spine is scaled toward its base until the flame body
 * (with its noise wobble, sway and the licks above the tip) stays ≥ 2 px from the left / right /
 * top edges — light never gets a hard cut.
 */
function fire(p: Part, o: Omit<FlameOpts, 'spine'> & { spine: V2[] }): void {
  p.flame({ ...o, mat: FLAME, spine: fitSpine(o.spine, o.width, o.sway ?? o.width * 0.5) });
}

/** The flame spine scaled toward its base so the flame stays inside the frame (see fire()). */
export function fitSpine(sp: readonly V2[], w: number, sw: number): V2[] {
  const n = sp.length;
  const b = sp[0];
  let L = 0;
  for (let i = 1; i < n; i++) L += dist(sp[i - 1], sp[i]);
  let s = 1;
  for (let it = 0; it < 14; it++) {
    let ok = true;
    for (let i = 0; i < n && ok; i++) {
      const u = i / (n - 1);
      const q = madd(b, sub(sp[i], b), s);
      const pad = w * Math.pow(1 - u, 0.72) * 1.2 + sw * Math.pow(u, 1.4) * 0.8 + 1.5;
      if (q[0] < pad || q[0] > W - 1 - pad || q[1] < pad) ok = false;
    }
    const tip = madd(b, sub(sp[n - 1], b), s);
    const d = norm(sub(sp[n - 1], sp[n - 2]));
    const ext = madd(tip, d, L * s * 0.2);
    const ep = 1.5;
    if (ext[0] < ep || ext[0] > W - 1 - ep || ext[1] < ep) ok = false;
    if (ok) break;
    s *= 0.9;
  }
  return s === 1 ? sp.slice() : sp.map((q) => madd(b, sub(q, b), s));
}

/** Neck crest point (top edge of the neck tube) at fraction t (0 = withers end, 1 = skull). */
function crestAt(R: WolfRig, t: number, inset = 2): V2 {
  const { a, b } = R.neck;
  const d = norm(sub(b, a));
  const up = mul(perp(d), -1);
  const r = lerp(11, 7.5, clamp01(t));
  return madd(lerpV(a, b, t), up, r - inset);
}


// ------------------------------------------------------------------ renderer

// a little more ground bounce than the default: lifts the jaw / belly core shadows off black
const r = new HDRenderer(W, H, { light: { bounce: { dir: norm3([0.3, 1, 0.2]), strength: 0.3 } } });

export interface DrawCtx {
  stages?: boolean;
  /** Fire afterimages of earlier frames (lunge): their colour + emissive canvases and strength 0..1. */
  ghosts?: readonly { color: PixelCanvas; emissive: PixelCanvas; a: number }[];
}

interface Tongue {
  spine: V2[];
  w: number;
  i: number;
  len: number;
}

/** Mane layout: [crest t, length, half-width, angle] — tallest over the shoulders, sweeping back. */
const MANE: readonly (readonly [number, number, number, number, number])[] = [
  // [crest t, length, half-width, angle, curl]
  [0.92, 22, 5.4, -84, -14],
  [0.72, 30, 6.4, -96, -30],
  [0.5, 26, 6.0, -108, -18],
  [0.28, 33, 6.8, -120, -34],
  [0.06, 27, 6.2, -132, -22],
  [-0.16, 22, 5.4, -144, -30],
  [-0.38, 15, 4.4, -156, -20],
];

export function maneTongues(P: WolfPose, R: WolfRig): Tongue[] {
  const fl = P.fl;
  return MANE.map(([t, L, w, a, curl], i) => {
    const base = crestAt(R, t, 3);
    const ang = windDir(a - P.tilt * 0.6, P.wind);
    // each tongue breathes on its own phase (the mane never pulses as one block)
    const len = L * fl * (1 + 0.3 * P.wind) * (0.88 + 0.14 * Math.sin((P.ft * 0.5 + i * 0.37) * Math.PI * 2));
    return { spine: tongue(base, ang, len, curl - 14 * P.wind), w: w * 1.25 * (0.82 + 0.18 * Math.min(1.5, fl)), i, len };
  });
}

/** Tail plume spine (root on the tail, rising up and back). */
export function tailPlume(P: WolfPose, R: WolfRig): { spine: V2[]; ang: number; len: number; w: number; sway: number } {
  const tl = R.tail;
  const tTip = tl[tl.length - 1];
  const tDir = norm(sub(tTip, tl[tl.length - 3]));
  const ang = windDir(((Math.atan2(tDir[1], tDir[0]) / DEG + 360) % 360 - 360) * 0.3 + -90 * 0.7, P.wind, 0.7);
  const len = 32 * P.fl * (1 + 0.25 * P.wind);
  return { spine: tongue(tl[3], ang, len, -16 - 14 * P.wind), ang, len, w: 7.2 * (0.85 + 0.15 * P.fl), sway: 3.4 };
}

export function drawWolf(P: WolfPose, o: DrawCtx = {}): HDRenderResult {
  const R = solve(P);
  const { Bf, Br, Hd, J } = R;
  const fl = P.fl;
  const ft = P.ft;
  r.begin();

  // ---------------------------------------------------------------- flame layout (lights first)
  const lights: FireLight[] = [];
  const mane = maneTongues(P, R);
  for (const m of mane) lights.push({ p: m.spine[2], z: -3, r: 18 + 6 * Math.min(1.5, fl), k: 0.62 * Math.min(1.4, fl) });
  const tl = R.tail;
  const plume = tailPlume(P, R);
  lights.push({ p: tl[tl.length - 1], z: 0, r: 16, k: 0.9 * Math.min(1.4, fl) });
  const paws = [R.hf, R.ff, R.hn, R.fn];
  paws.forEach((L, i) => {
    const k = Math.min(1.3, 0.7 + 0.3 * fl);
    // the paw itself (legs, pasterns) …
    lights.push({ p: add(L.paw, [1, -3]), z: i >= 2 ? 3 : -4, r: i >= 2 ? 22 : 16, k: (i >= 2 ? 1 : 0.7) * k });
    // … and the flame tips licking up: a warm underlight on the belly, brisket and chest
    lights.push({ p: add(L.paw, [1, -12]), z: i >= 2 ? 2 : -3, r: 26, k: (i >= 2 ? 0.55 : 0.4) * k });
  });
  const open = P.jaw > 0.12;
  if (open) lights.push({ p: lerpV(Hd(10, 3.6), J(10, 4.8), 0.5), z: 6, r: 11, k: 0.7 * P.jaw });
  // the furnace always leaks a little light at the corner of the mouth (lights the lips and jaw line)
  lights.push({ p: Hd(4, 4.6), z: 4, r: 7, k: 0.4 });

  const flamePart = (name: string) => r.part(name, { lines: false, shadow: false, outline: false });

  // ---------------------------------------------------------------- ground fire trail (lunge)
  if (P.trail > 0.05) {
    const p = flamePart('trail');
    const x0 = Math.min(R.hn.paw[0], R.hf.paw[0]) - 1;
    const len = Math.min(40 * P.trail, x0 - 4);
    for (let i = 0, x = x0; x > x0 - len; i++, x -= 4.5) {
      const k = 1 - (x0 - x) / Math.max(1, len);
      fire(p, {
        spine: tongue([x, GROUND - 0.5], windDir(-96, 0.55), (4 + 9 * k) * (0.75 + 0.25 * Math.sin(i * 2.1 + ft * 6)), -18),
        width: 1.6 + 2.2 * k,
        t: ft + i * 0.21,
        seed: 70 + (i % 7),
        sway: 1,
        turbulence: 0.45,
        speed: 2.8,
        base: 'round',
        licks: 0.3,
        heatBias: -0.2 + 0.25 * k,
      });
    }
  }

  // ---------------------------------------------------------------- tail side tongues (behind all)
  {
    const p = flamePart('tail-flame-back');
    fire(p, { spine: tongue(tl[3], plume.ang + 36, plume.len * 0.45, -22), width: 3.8, t: ft + 0.3, seed: 8, sway: 1.8, turbulence: 0.4, base: 'flat', heatBias: -0.06, licks: 0.2 });
    fire(p, { spine: tongue(tl[2], plume.ang - 36, plume.len * 0.38, -16), width: 3.2, t: ft + 0.6, seed: 9, sway: 1.6, turbulence: 0.4, base: 'flat', heatBias: -0.1, licks: 0.2 });
  }

  // ---------------------------------------------------------------- legs
  const drawFront = (p: Part, L: FrontLeg, far: boolean) => {
    const fur = far ? FUR_FAR : FUR;
    const hide = far ? HIDE_FAR : HIDE;
    p.tube([L.sh, L.el], [8.2, 5.4], { mat: fur });
    p.sphere(add(L.el, [-1, 0.6]), 4.4, { mat: fur });
    p.tube([L.el, L.wr], [4.8, 3.3], { mat: hide, z: 1 });
    p.sphere(L.wr, 3.3, { mat: hide, z: 1 });
    p.tube([L.wr, add(L.paw, [0.6, -0.8])], [3.3, 3.6], { mat: hide, z: 2 });
    p.ellipsoid(add(L.paw, [1.6, 0.4]), 5.6, 3.1, { mat: hide, z: 3, rz: 4 });
    // feathering down the back of the forearm
    const down = norm(sub(L.wr, L.el));
    const backN = mul(perp(down), 1); // clockwise of "down" = screen left (behind the leg)
    p.furFringe([madd(L.el, backN, 2.5), madd(lerpV(L.el, L.wr, 0.6), backN, 2)], { mat: fur, count: 3, length: 4.5, width: 2.2, side: 1, flow: [-0.5, 1], comb: 0.6, seed: far ? 3 : 4, inset: 1.6, idBase: 200 });
    // toes + claws
    p.detail((d) => {
      for (const dx of [2.2, 4.6]) d.shiftLine(add(L.paw, [dx, -1.6]), add(L.paw, [dx, 1.4]), -1);
    });
    for (const dx of [4, 6.4]) p.shard(add(L.paw, [dx, 1]), add(L.paw, [dx + 2.4, 2.6]), 0.9, { mat: CLAW, z: 6 });
  };
  const drawHind = (p: Part, L: HindLeg, far: boolean) => {
    const fur = far ? FUR_FAR : FUR;
    const hide = far ? HIDE_FAR : HIDE;
    const td = norm(sub(L.st, L.hip));
    p.ellipsoid(lerpV(L.hip, L.st, 0.4), 12, 9.4, { mat: fur, angle: Math.atan2(td[1], td[0]), rz: 9 });
    p.tube([L.st, L.hk], [6, 3.4], { mat: fur, z: 1 });
    // hock: the heel juts back
    const gd = norm(sub(L.hk, L.st));
    p.ellipsoid(madd(L.hk, gd, 0.8), 3.4, 2.8, { mat: hide, z: 1 });
    p.tube([L.hk, add(L.paw, [0.2, -0.8])], [3.1, 3.4], { mat: hide, z: 2 });
    p.ellipsoid(add(L.paw, [1.4, 0.4]), 5.4, 3, { mat: hide, z: 3, rz: 4 });
    // breeches: shaggy fur down the back of the thigh and gaskin
    const backN = mul(perp(gd), 1);
    p.furFringe([madd(lerpV(L.hip, L.st, 0.05), mul(perp(td), 1), 7), madd(lerpV(L.st, L.hk, 0.5), backN, 2.4)], {
      mat: fur,
      count: 5,
      length: (t) => 6 - 2 * t,
      width: 2.8,
      side: 1,
      flow: [-0.45, 1],
      comb: 0.55,
      seed: far ? 5 : 6,
      inset: 2.2,
      idBase: 300,
    });
    p.detail((d) => {
      for (const dx of [2, 4.4]) d.shiftLine(add(L.paw, [dx, -1.4]), add(L.paw, [dx, 1.4]), -1);
    });
    for (const dx of [3.8, 6.2]) p.shard(add(L.paw, [dx, 1]), add(L.paw, [dx + 2.3, 2.6]), 0.9, { mat: CLAW, z: 6 });
  };

  {
    const p = r.part('leg-hf');
    drawHind(p, R.hf, true);
    fireLight(p, lights, 0.9);
  }
  {
    const p = r.part('leg-ff');
    drawFront(p, R.ff, true);
    fireLight(p, lights, 0.9);
  }

  // ---------------------------------------------------------------- far paw flames
  const pawFire = (p: Part, L: { paw: V2 }, near: boolean, seed: number) => {
    const k = (near ? 1 : 0.85) * Math.min(1.35, 0.7 + 0.3 * fl);
    const up = windDir(-96, P.wind, 0.8);
    fire(p, { spine: tongue(add(L.paw, [2.6, 0.6]), up, 12 * k, -20), width: 3.4 * k, t: ft + seed * 0.013, seed, sway: 1.6, turbulence: 0.42, speed: 2.6, base: 'flat', licks: 0.35 });
    fire(p, { spine: tongue(add(L.paw, [-1.6, 0.6]), up - 20, 8 * k, -14), width: 2.6 * k, t: ft + 0.4 + seed * 0.013, seed: seed + 1, sway: 1.2, turbulence: 0.42, speed: 2.6, base: 'flat', licks: 0.25, heatBias: -0.05 });
    fire(p, { spine: tongue(add(L.paw, [6, 1]), up + 16, 7 * k, -10), width: 2.2 * k, t: ft + 0.7 + seed * 0.013, seed: seed + 2, sway: 1, turbulence: 0.4, speed: 2.6, base: 'flat', licks: 0.2, heatBias: -0.08 });
  };
  {
    const p = flamePart('paw-fire-far');
    pawFire(p, R.hf, false, 31);
    pawFire(p, R.ff, false, 37);
  }

  // ---------------------------------------------------------------- tail (charcoal stub)
  {
    const p = r.part('tail');
    p.tube(tl, (t) => 5.6 - 2.4 * t, { mat: FUR });
    p.furFringe(tl.slice(1), { mat: FUR, count: 4, length: 4.5, width: 2.4, side: -1, flow: [-1, 0.5], comb: 0.4, seed: 9, inset: 1.5, idBase: 50 });
    fireLight(p, lights, 1.2);
  }
  {
    // the tail tip IS the flame: the plume rises from the last third of the tail
    const p = flamePart('tail-flame');
    fire(p, { spine: plume.spine, width: plume.w, t: ft, seed: 7, sway: plume.sway, turbulence: 0.42, speed: 2.2, licks: 0.45, base: 'round' });
  }

  // ---------------------------------------------------------------- ears
  const ear = (near: boolean): V2[] => {
    const du = near ? 0 : 5;
    const flat = P.ears;
    const a = Hd(-7.5 + du, -5 + (near ? 0 : 0.6));
    const b = Hd(1.5 + du, -7.8 + (near ? 0 : 0.6));
    const tip = Hd(lerp(-4.5, -18, flat) + du * 0.6, lerp(-21, -10.5, flat) + (near ? 0 : 0.8));
    return [a, tip, b];
  };
  // ---------------------------------------------------------------- body: torso + neck + fur
  {
    const p = r.part('body');
    const ch = P.chest;
    p.ellipsoid(Bf(12, 1.5), 15.5 + ch * 0.6, 15 + ch * 0.6, { mat: FUR, rz: 13, angle: R.fa });
    p.ellipsoid(Bf(7, -7.5), 13, 8.5, { mat: FUR, rz: 11, angle: R.fa - 0.1 });
    p.tube([Bf(3, -1), lerpV(Bf(-6, -2.5), Br(-6, -2.5), 0.5), Br(-15, -3)], [11.5, 9.4, 10.5], { mat: FUR });
    p.ellipsoid(Br(-20.5, -2.5), 12, 11.5, { mat: FUR, rz: 11, angle: R.ra });
    p.tube([R.neck.a, lerpV(R.neck.a, R.neck.b, 0.55), R.neck.b], [11, 9, 7.5], { mat: FUR });
    // chest ruff: long pointed locks hanging from the throat and the brisket
    p.furFringe([Hd(-1, 9), Bf(21, -6), Bf(24, 1), Bf(21, 9), Bf(13, 13.5)], {
      mat: FUR,
      count: 9,
      length: (t) => 8 + 4 * Math.sin(t * Math.PI),
      width: 3.2,
      side: -1,
      flow: [0.1, 1],
      comb: 0.6,
      seed: 21,
      inset: 3.5,
      lean: 0.6,
      idBase: 400,
      bend: -0.8,
    });
    // belly: shaggy tufts hanging down and back
    p.furFringe([Bf(11, 13.5), Bf(2, 11.5), Br(-7, 7.5), Br(-13, 7.5)], {
      mat: FUR,
      count: 7,
      length: (t) => 7 - 3.5 * t,
      width: 2.7,
      side: -1,
      flow: [-0.7, 1],
      comb: 0.55,
      seed: 23,
      inset: 2.5,
      idBase: 500,
    });
    // rump: fur combed down the back of the haunch
    p.furFringe([Br(-26, -10), Br(-31.5, -3), Br(-30, 5)], {
      mat: FUR,
      count: 4,
      length: 5,
      width: 2.8,
      side: 1,
      flow: [-0.5, 1],
      comb: 0.6,
      seed: 24,
      inset: 2.4,
      idBase: 550,
    });
    // withers / neck ruff: clumps combed down and back under the mane
    p.furFringe([crestAt(R, 0.95, 3), crestAt(R, 0.5, 3.5), Bf(6, -14), Bf(-3, -13)], {
      mat: FUR,
      count: 7,
      length: 7.5,
      width: 3.2,
      side: 1,
      flow: [-0.7, 0.9],
      comb: 0.85,
      seed: 27,
      inset: 5,
      idBase: 700,
    });
    // the ruff boundary behind the shoulder: a crescent of tufts lying back over the ribs
    p.furFringe([Bf(1, -11), Bf(-2.5, -3), Bf(0, 6), Bf(4, 11)], {
      mat: FUR,
      count: 6,
      length: (t) => 6.5 - 1.5 * t,
      width: 3,
      side: 1,
      flow: [-1, 0.35],
      comb: 0.7,
      seed: 31,
      inset: 0.5,
      idBase: 750,
      lean: 0.55,
    });
    p.furFringe([lerpV(R.neck.a, R.neck.b, 0.78), lerpV(R.neck.a, R.neck.b, 0.2), Bf(10, -1)], {
      mat: FUR,
      count: 5,
      length: 6.5,
      width: 3,
      side: 1,
      flow: [-0.5, 1],
      comb: 0.85,
      seed: 29,
      inset: 4,
      idBase: 800,
    });
    fireLight(p, lights, 1);
    // ember seams: smouldering cracks along the shoulder blade and the spine
    seam(p, [Bf(1, -12), Bf(4.5, -7.5), Bf(7, -2.5)], fl);
    seam(p, [Br(-5, -11), Br(-10, -10.4), Br(-15, -11.2)], fl * 0.9);
  }

  // ---------------------------------------------------------------- near hind leg
  {
    const p = r.part('leg-hn');
    drawHind(p, R.hn, false);
    fireLight(p, lights, 1);
    const L = R.hn;
    const td = norm(sub(L.st, L.hip));
    const n = perp(td);
    seam(p, [madd(L.hip, n, -6.5), madd(lerpV(L.hip, L.st, 0.35), n, -8), madd(lerpV(L.hip, L.st, 0.75), n, -5.5)], fl);
  }

  // ---------------------------------------------------------------- near front leg
  {
    const p = r.part('leg-fn');
    drawFront(p, R.fn, false);
    fireLight(p, lights, 1);
  }

  // ---------------------------------------------------------------- mane: tongues growing out of the neck crest (over the body, under the head)
  {
    const p = flamePart('mane-back');
    // small licks between the big tongues (drawn first: the big tongues lie over them)
    for (let i = 0; i < 5; i++) {
      const t = 0.82 - i * 0.24;
      const base = crestAt(R, t, 3.5);
      const ang = windDir(-92 - i * 14 - P.tilt * 0.6, P.wind);
      const len = (11 + 4 * ((i * 7) % 3)) * fl * (1 + 0.3 * P.wind) * (0.85 + 0.2 * Math.sin((ft * 0.5 + i * 0.61) * Math.PI * 2));
      fire(p, { spine: tongue(base, ang, len, -28 - 10 * P.wind), width: 3.2 * (0.85 + 0.15 * fl), t: ft + 0.35 + i * 0.29, seed: 60 + i, sway: 1.6, turbulence: 0.4, speed: 2.8, base: 'flat', licks: 0.4, heatBias: -0.02 });
    }
    for (const m of mane)
      fire(p, { spine: m.spine, width: m.w, t: ft + m.i * 0.17, seed: 11 + m.i, sway: m.w * 0.35, turbulence: 0.3, speed: 2.4, licks: 0.3, base: 'flat', heatBias: m.i % 2 ? 0.04 : 0.1 });
  }

  // ---------------------------------------------------------------- far ear (behind the head, over the neck)
  {
    const p = r.part('ear-far');
    const [a, tip, b] = ear(false);
    earShape(p, a, tip, b, FUR_FAR, true);
    fireLight(p, lights, 0.8);
  }

  // ---------------------------------------------------------------- mouth furnace
  if (open) {
    const p = flamePart('mouth');
    const poly: V2[] = [Hd(-2.5, 2.6), Hd(9, 3.1), Hd(17, 3.5), J(16, 4.6), J(8, 4.9), J(-2, 4.4)];
    p.facet(poly, { mat: FURNACE, heat: 0.32 });
    // white-hot deep in the throat → gold → orange → ember red at the lips
    const back = lerpV(Hd(1, 3.4), J(1, 4.4), 0.5);
    const front = lerpV(Hd(16, 3.6), J(15, 4.6), 0.5);
    const ax = front[0] - back[0];
    const ay = front[1] - back[1];
    const al = ax * ax + ay * ay || 1;
    p.biasWhere((x, y) => {
      const t = clamp01(((x + 0.5 - back[0]) * ax + (y + 0.5 - back[1]) * ay) / al);
      return (0.62 * Math.pow(1 - t, 1.5) + 0.1) * clamp01(P.jaw * 1.5);
    });
    // tongue lying on the floor of the jaw, lit from the furnace above
    p.tube([J(0.5, 0.9), J(6, 0.6), J(11.5, 1.1)], [1.9 * HS, 1.6 * HS, 1.2 * HS], { mat: TONGUE, z: 4 });
  }

  // ---------------------------------------------------------------- lower jaw
  {
    const p = r.part('jaw');
    p.tube([J(-1, 5.8), J(8.5, 6), J(16, 5.2)], [4.4 * HS, 3.3 * HS, 2.3 * HS], { mat: HIDE });
    p.ellipsoid(J(1, 7.4), 5 * HS, 3.4 * HS, { mat: FUR, angle: R.ja });
    p.furClump(J(3, 8), J(-1, 12), 2.2 * HS, { mat: FUR, id: 901 });
    // lower canine + small teeth
    if (open || P.snarl > 0.5) {
      p.shard(J(13.8, 4.9), J(14.4, 1.6), 1.1, { mat: TOOTH, z: 8 });
      p.shard(J(10, 5.1), J(10.3, 3.3), 0.7, { mat: TOOTH, z: 8 });
    }
    fireLight(p, lights, 1);
  }

  // ---------------------------------------------------------------- head
  {
    const p = r.part('head');
    // domed skull, brow / stop, long tapering muzzle with a deep upper lip, heavy cheek
    const k = HS;
    p.ellipsoid(Hd(-0.6, -1), 10.4 * k, 9 * k, { mat: FUR, rz: 9 * k, angle: R.ha });
    p.ellipsoid(Hd(5, -3.5), 5.4 * k, 3.9 * k, { mat: HIDE, rz: 5 * k, angle: R.ha, z: 3 });
    p.tube([Hd(5.5, -2.3), Hd(12, -1.1), Hd(18.6, 0.4)], [5.2 * k, 4.1 * k, 3.3 * k], { mat: HIDE, z: 0 });
    p.tube([Hd(6, 2.4), Hd(17.8, 2.9)], [4 * k, 2.8 * k], { mat: HIDE, z: -1 });
    p.ellipsoid(Hd(-1.5, 4), 8 * k, 6.4 * k, { mat: FUR, angle: R.ha, rz: 7 * k });
    // nose
    p.ellipsoid(Hd(19.2, 0.2), 2.6 * k, 2.3 * k, { mat: NOSE, z: 6 });
    // near ear: a ridged fur triangle with an ember-lit inner bowl
    const [ea, etip, eb] = ear(true);
    earShape(p, ea, etip, eb, FUR, false);
    // cheek ruff: shaggy tufts sweeping back behind the jaw
    p.furFringe([Hd(-7.5, -5), Hd(-10, 1), Hd(-7.5, 7.5), Hd(-2, 10.5)], {
      mat: FUR,
      count: 8,
      length: (t) => (6 + 4.5 * Math.sin(t * Math.PI)) * k,
      width: 3.2 * k,
      side: 1,
      flow: rotV([-1, 0.5], R.ha),
      comb: 0.75,
      seed: 33,
      inset: 3,
      idBase: 1000,
      lean: 0.6,
    });
    // upper canine
    if (open || P.snarl > 0.3) p.shard(Hd(15, 3.3), Hd(15.3, 6.8 + P.jaw * 0.5), 1.2, { mat: TOOTH, z: 9 });
    else p.shard(Hd(15, 3.2), Hd(15.2, 5.8), 0.9, { mat: TOOTH, z: 9 });
    fireLight(p, lights, 1);
    p.detail((d) => {
      // mouth line when shut; furnace glow leaking at the corner
      if (!open) {
        d.line(Hd(6.5, 4.5), Hd(14.8, 4.3), PAL.void0);
        d.set(...Hd(5.6, 4.4), PAL.fire3, { emissive: true });
        d.set(...Hd(4.7, 4.4), PAL.fire2, { emissive: true });
      }
      // snarl: wrinkles on the muzzle bridge, lip curled off the teeth
      if (P.snarl > 0.4) {
        for (const u of [9.5, 11.5, 13.5]) d.shiftLine(Hd(u, -2.9), Hd(u + 0.8, -1), -2);
        for (const u of [9.5, 11.5, 13.5]) d.set(...Hd(u, 3.4), PAL.stone4);
      }
      // nostril
      d.set(...Hd(20, 0.9), PAL.ink);
      eye(d, Hd(6.8, -2.4), P.eye);
    });
  }

  // ---------------------------------------------------------------- near paw flames
  {
    const p = flamePart('paw-fire-near');
    pawFire(p, R.hn, true, 41);
    pawFire(p, R.fn, true, 43);
  }

  // ---------------------------------------------------------------- embers drifting off the mane
  r.overlay((ov) => {
    for (let k = 0; k < 4; k++) {
      const ph = (((ft * 0.5 + k / 4) % 1) + 1) % 1;
      const m = mane[2 + (k % 4)];
      const tip = m.spine[m.spine.length - 1];
      const x = Math.round(tip[0] - 2 - ph * (6 + 10 * P.wind) + Math.sin((ph + k) * 5) * 1.5);
      const y = Math.round(tip[1] - 2 - ph * 12 * fl + P.wind * ph * 8);
      if (x < 1 || y < 1 || x > W - 2) continue;
      ov.set(x, y, ph < 0.35 ? PAL.fire4 : ph < 0.7 ? PAL.fire3 : PAL.fire2, { emissive: 255, onlyEmpty: true });
      if (ph < 0.5) ov.set(x, y + 1, PAL.fire2, { emissive: 200, onlyEmpty: true });
    }
  });

  // ---------------------------------------------------------------- lunge afterimages: scanline fire wolves
  // Crisp, opaque, every other row (the game's hologram language) — translucent fills go muddy
  // over the night board. They thin out toward the tail end and burn out with age.
  if (o.ghosts?.length) {
    const gs = o.ghosts;
    r.overlay((ov) => {
      gs.forEach((g, gi) => {
        const c = g.color;
        let bx0 = W;
        let bx1 = 0;
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++)
            if (c.data[(y * W + x) * 4 + 3]) {
              if (x < bx0) bx0 = x;
              if (x > bx1) bx1 = x;
            }
        const bw = Math.max(1, bx1 - bx0);
        const op = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < W && yy < H && c.data[(yy * W + xx) * 4 + 3] > 0;
        for (let y = 0; y < H; y++) {
          if ((y + gi) % 2) continue;
          for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            if (!c.data[i + 3] || ov.has(x, y) || ov.has(x + 1, y) || ov.has(x + 2, y)) continue;
            const edge = !op(x - 1, y) || !op(x + 1, y) || !op(x, y - 1) || !op(x, y + 1);
            const hot = g.emissive.data[i + 3] > 0;
            if (!edge && !hot) continue;
            const keep = g.a * (0.2 + 0.8 * clamp01((x - bx0) / bw));
            if (hash2(x, y, gi) > keep) continue;
            const col = edge ? (g.a > 0.6 ? PAL.fire4 : PAL.fire3) : hot ? PAL.fire3 : g.a > 0.6 ? PAL.fire2 : PAL.fire1;
            ov.set(x, y, col, { emissive: edge ? 230 : 150 });
          }
        }
      });
    });
  }

  // ---------------------------------------------------------------- landing puff: dust kicked sideways, embers popping up
  if (P.puff > 0.05) {
    const k = P.puff;
    r.overlay((ov) => {
      for (const L of [R.fn, R.ff]) {
        const px = L.paw[0];
        const gy = GROUND - 1;
        const d = 4 + 6 * (1 - k) + 2;
        for (const [dx, dy, c] of [
          [-d - 2, 0, PAL.stone1],
          [-d - 1, -1, PAL.stone2],
          [-d, -2, PAL.stone3],
          [-d - 3, -1, PAL.stone1],
          [d + 3, 0, PAL.stone1],
          [d + 4, -1, PAL.stone2],
          [d + 5, -2, PAL.stone3],
          [d + 6, -1, PAL.stone1],
        ] as const)
          ov.set(px + dx, gy + dy - Math.round(2 * (1 - k)), c, { onlyEmpty: true, alpha: 0.4 + 0.6 * k });
        for (let e = 0; e < 4; e++) {
          const ex = px + [-5, -2, 3, 7][e] * (1.4 - 0.4 * k);
          const ey = gy - 3 - [5, 9, 7, 4][e] * (1.2 - k * 0.6);
          ov.set(ex, ey, e % 2 ? PAL.fire4 : PAL.fire3, { onlyEmpty: true, emissive: 255 });
          if (k > 0.5) ov.set(ex, ey + 1, PAL.fire2, { onlyEmpty: true, emissive: 200 });
        }
      }
    });
  }

  return r.finish({ stages: o.stages });
}

/** Ear: two flat facets split along a ridge (outer back facet catches the key light), ember-lit inner bowl. */
function earShape(p: Part, a: V2, tip: V2, b: V2, mat: typeof FUR, far: boolean): void {
  const ridge = lerpV(lerpV(a, b, 0.42), tip, 0.18);
  p.facet3([[a[0], a[1], 0], [tip[0], tip[1], 1], [ridge[0], ridge[1], 4]], { mat, z: 8 });
  p.facet3([[ridge[0], ridge[1], 4], [tip[0], tip[1], 1], [b[0], b[1], 0]], { mat, z: 8 });
  if (!far) p.paint([lerpV(ridge, b, 0.15), lerpV(lerpV(ridge, b, 0.45), tip, 0.78), lerpV(ridge, b, 0.88)], { mat: EAR_IN, bias: 0.35 });
}

/** Almond eye with a dark brow line: shut → slit → open → blazing (white-hot core). */
function eye(d: DetailCtx, E: V2, e: number): void {
  const ex = Math.floor(E[0]);
  const ey = Math.floor(E[1]);
  // brow ridge: a dark line over the eye, the fur above it catches the light
  for (const [dx, dy] of [
    [-3, -1],
    [-2, -2],
    [-1, -2],
    [0, -2],
    [1, -2],
    [2, -1],
  ] as const)
    d.set(ex + dx, ey + dy, PAL.ink);
  d.shiftLine([ex - 3, ey - 3], [ex + 2, ey - 3], 1);
  if (e < 0.3) {
    d.line([ex - 3, ey], [ex + 2, ey], PAL.void0);
    d.set(ex - 1, ey, PAL.fire1, { emissive: true });
    d.set(ex, ey, PAL.fire2, { emissive: true });
    return;
  }
  if (e < 0.85) {
    for (const [dx, c] of [
      [-2, PAL.fire2],
      [-1, PAL.fire3],
      [0, PAL.gold3],
      [1, PAL.fire3],
    ] as const)
      d.set(ex + dx, ey, c, { emissive: true });
    d.line([ex - 3, ey - 1], [ex + 2, ey - 1], PAL.ink);
    d.line([ex - 2, ey + 1], [ex + 1, ey + 1], PAL.void0);
    return;
  }
  const hot = e > 1.5;
  for (const [dx, dy, c] of [
    [-2, -1, PAL.fire3],
    [-1, -1, PAL.gold3],
    [0, -1, hot ? PAL.gold4 : PAL.gold3],
    [-3, 0, PAL.fire2],
    [-2, 0, PAL.fire3],
    [-1, 0, PAL.gold3],
    [0, 0, hot ? PAL.white : PAL.gold4],
    [1, 0, PAL.gold3],
    [2, 0, PAL.fire3],
    [-1, 1, PAL.fire2],
    [0, 1, PAL.fire3],
    [1, 1, PAL.fire2],
  ] as const)
    d.set(ex + dx, ey + dy, c, { emissive: true });
  d.set(ex + 1, ey - 1, PAL.ink);
  d.set(ex - 2, ey + 1, PAL.void0);
  d.set(ex + 2, ey + 1, PAL.void0);
}

/** Deterministic hash → 0..1 (afterimage thinning). */
function hash2(x: number, y: number, k: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(k | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A smouldering ember seam: 1 px hot core with darker lips at its wider middle (emissive). */
function seam(p: Part, pts: V2[], fl: number): void {
  const hot = fl > 1.3 ? PAL.fire4 : PAL.fire3;
  const lip = fl < 0.75 ? PAL.fire1 : PAL.fire2;
  p.detail((d) => {
    const all: V2[] = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const n = Math.max(1, Math.ceil(dist(pts[i], pts[i + 1]) * 1.5));
      for (let k = 0; k < n; k++) all.push(lerpV(pts[i], pts[i + 1], k / n));
    }
    all.push(pts[pts.length - 1]);
    all.forEach((q, i) => {
      const f = i / (all.length - 1);
      if (!d.has(q[0], q[1])) return;
      const mid = f > 0.3 && f < 0.7;
      if (mid && d.has(q[0] - 1, q[1])) d.set(q[0] - 1, q[1], lip, { emissive: true });
      d.set(q[0], q[1], f < 0.12 || f > 0.88 ? lip : hot, { emissive: true });
    });
  });
}

// ------------------------------------------------------------------ named points

export function mouthPoint(P: WolfPose): V2 {
  const R = solve(P);
  return lerpV(R.Hd(15, 4), R.J(14, 4.8), 0.5);
}

export function eyePoint(P: WolfPose): V2 {
  return solve(P).Hd(6.8, -2.4);
}
