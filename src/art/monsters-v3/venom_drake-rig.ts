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
import { holeAt, seamAt } from './venom_drake-holes';
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
  seam: 0, holes: 0, slump: 0, pool: 0, marker: -1, glob: 0, body: 1, curl: 0, shake: 0, t: 0,
};
export const pose = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

// ---------------------------------------------------------------- skeleton

/** The idle tail arch (screen deg per segment, root → tip). */
const ARCH = [-102, -97, -92, -85, -70, -44, -14, 8, 30] as const;
const T_STEP = 7.6;
const T_W = [10, 9.4, 8.8, 8.2, 7.6, 7, 6.4, 5.8, 5.2, 4.8] as const;

export interface Skel {
  hip: Pt;
  sh: Pt;
  /** near / far hind leg: hip joint, knee, hock (ankle), toe tip */
  hipN: Pt; kneeN: Pt; hockN: Pt;
  hipF: Pt; kneeF: Pt; hockF: Pt;
  /** near / far wing-arm: shoulder, elbow, wrist (= knuckle), finger tip (the folded wing's high point) */
  shN: Pt; elN: Pt; wrN: Pt; tipN: Pt;
  shF: Pt; elF: Pt; wrF: Pt; tipF: Pt;
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
  // wing-arms: knuckles planted at x 56–61 (near) and 63–68 (far)
  // wing-arms (pterosaur forelimbs): shoulder → a high elbow just above the back → a long forearm
  // pillar down to the knuckle planted on the floor; the folded wing fingers run from the elbow back
  // along the top of the flank to a claw tip over the hip, the membrane hangs below them as a cape
  const shN: Pt = [sh[0] + 1, sh[1] + 1];
  const shF: Pt = [sh[0] + 5, sh[1] - 1];
  const s = clamp(o.shield, 0, 1);
  const spread = o.wing;
  const wrN0: Pt = [lerp(58 + o.nk[0], sh[0] + 6, r), lerp(83 - o.nk[1], sh[1] + 15, r)];
  const elN0: Pt = [sh[0] - 4 - spread * 2, sh[1] - 17 - spread * 3];
  // guard: the elbow rises over the head, the wrist swings forward in front of the face
  const elNg: Pt = [sh[0] + 2, sh[1] - 16];
  const wrNg: Pt = [sh[0] + 22, sh[1] - 4];
  const elN: Pt = [lerp(elN0[0], elNg[0], s), lerp(elN0[1], elNg[1], s)];
  const wrN: Pt = [lerp(wrN0[0], wrNg[0], s), lerp(wrN0[1], wrNg[1], s)];
  const wrF: Pt = [lerp(65 + o.fk[0], sh[0] + 11, r), lerp(83 - o.fk[1], sh[1] + 13, r)];
  const elF: Pt = [sh[0] + 1 + spread * 3, sh[1] - 20 - spread * 4];
  const fold = (el: Pt, back: number, len: number): Pt => {
    const a = lerp(back, 228, spread) * DEG;
    return [el[0] + Math.cos(a) * len, el[1] + Math.sin(a) * len];
  };
  const tipN0 = fold(elN0, 155 + o.drape, 32 - r * 4);
  const tipNg: Pt = [elNg[0] + 20, elNg[1] - 8];
  const tipN: Pt = [lerp(tipN0[0], tipNg[0], s), lerp(tipN0[1], tipNg[1], s)];
  const tipF = fold(elF, 152, 22);
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
  return { hookM, hip, sh, hipN, kneeN, hockN, hipF, kneeF, hockF, shN, elN, wrN, tipN, shF, elF, wrF, tipF, neck, head, eye, mouth, fang, sac, tail, bulb, dir, sting, quills };
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
  bands(q, t, light, { top: 2, lit: 3, sh: 4, bottom: 2, half: near ? 0.7 : 0 });
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
  bands(q, HIDE, light, { top: 2, lit: 4, sh: 5, bottom: 2, half: 0.8 });
  // scale rows: 2-px void1 teeth every ≈5 px on the mid / shadow boundary (MA-2)
  planes(q, (x, y, src) => {
    if (src.get(x, y) !== HIDE.M) return null;
    const below = src.get(x, y + 1);
    if (below !== HIDE.S && below !== HIDE.D) return null;
    return ((x + 2 * (y & 1)) % 5) < 2 ? HIDE.S : null;
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
    bands(q, HIDE, light, { top: 2, lit: 2, sh: 2, bottom: 1, half: 0.6 });
    f.comp.add(q, Part.tail, { out: OUT });
  }
  // the toxic under-glow on the inner side of the rising arch (one continuous rim, segments 1…5)
  const ls = light.side;
  const rim: number[] = [];
  for (let y = rnd(pts[5][1]); y <= rnd(pts[0][1]) + 2; y++)
    for (let x = 0; x < W; x++) {
      if (f.comp.owner(x, y) !== Part.tail) continue;
      if (f.p.isOpaque(x - ls, y)) continue;
      if (y < rnd(pts[4][1]) && x < pts[4][0]) continue;
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
    const dn = !src.isOpaque(x, y + 1) || !src.isOpaque(x, y + 2);
    const up = !src.isOpaque(x, y - 1);
    if (up) return VEN.body;
    if (dn) return VEN.dark;
    return y + 0.5 > by + 0.5 ? VEN.deep : VEN.body;
  });
  f.comp.add(q, Part.bulb, { out: PAL.ink });
}

/** Cut a round hole (radius r) into a membrane layer and ring it with leaf3. */
function holeIn(f: Frame, q: PixelCanvas, cx: number, cy: number, r: number): void {
  const x0 = Math.floor(cx - r - 2);
  const y0 = Math.floor(cy - r - 2);
  const x1 = Math.ceil(cx + r + 2);
  const y1 = Math.ceil(cy + r + 2);
  const hole: number[] = [];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r && q.isOpaque(x, y)) hole.push(x, y);
  if (hole.length < 6) return;
  for (let i = 0; i < hole.length; i += 2) q.erase(hole[i], hole[i + 1]);
  // the acid-lit lip: leaf3 on the lower half of the ring, leaf2 on the upper half (an eaten edge, not a glyph)
  for (let i = 0; i < hole.length; i += 2) {
    const x = hole[i];
    const y = hole[i + 1];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (q.isOpaque(x + dx, y + dy)) q.set(x + dx, y + dy, y + dy + 0.5 >= cy ? VEN.body : VEN.deep);
    f.holes.push(x, y);
  }
}

/**
 * The folded wing of one wing-arm: the finger bones run from the elbow back along the top of the
 * flank to a hooked claw tip; the membrane hangs below them as a ragged cape (tongued hem) with eaten
 * holes ringed in leaf3 (real holes: the body or the floor shows through). Spread (roar, special)
 * swings the fingers up and back and the membrane opens as a panel. Guard: the near one spreads
 * forward over the head as a sloping, holed shield.
 */
function drawWing(f: Frame, near: boolean): void {
  const { sk, o, light } = f;
  const t = near ? MEMB : MEMB_FAR;
  const el = near ? sk.elN : sk.elF;
  const wr = near ? sk.wrN : sk.wrF;
  const tip = near ? sk.tipN : sk.tipF;
  const s = near ? clamp(o.shield, 0, 1) : 0;
  const sp = clamp(o.wing, 0, 1);
  const q = layer();
  let ribs: [Pt, Pt][] = [];
  let shieldFan: Pt[] = [];
  if (s > 0.05) {
    // the shield: the fingers fan from the wrist (up / forward / down) and the membrane spans them,
    // scalloped between the finger tips, back to the raised elbow: a sloping, ribbed, holed shield
    const fan: Pt[] = [tip, [wr[0] + 8, wr[1] - 10], [wr[0] + 9, wr[1] + 2], [wr[0] + 4, wr[1] + 12]].map(
      (q2) => [lerp(wr[0], q2[0], s), lerp(wr[1], q2[1], s)] as Pt,
    );
    const poly: Pt[] = [el, fan[0]];
    for (let i = 1; i < fan.length; i++) {
      const a2 = fan[i - 1];
      const b2 = fan[i];
      const mx = lerp(a2[0], b2[0], 0.5);
      const my = lerp(a2[1], b2[1], 0.5);
      poly.push([lerp(mx, wr[0], 0.3), lerp(my, wr[1], 0.3)], b2);
    }
    poly.push([el[0] + 3, el[1] + 16 * s]);
    q.poly(poly, t.L);
    shieldFan = fan;
  } else {
    // hem: tongues hanging from the finger line toward the floor (folded), lifting as it spreads
    const N = 6;
    const hem: Pt[] = [];
    for (let i = N; i >= 0; i--) {
      const k = i / N;
      const fx = lerp(el[0], tip[0], k);
      const fy = lerp(el[1], tip[1], k);
      const tongue = i % 2 === 0;
      const hang = near ? (tongue ? 25 : 19) - k * 14 : (tongue ? 14 : 10) - k * 6;
      const drop = Math.min(GY - 6 - fy, hang) * (1 - sp * 0.62) + (near ? o.drape * (1 - k) : 0);
      hem.push([fx + (near ? 1 : 0), fy + drop]);
    }
    const front: Pt = near ? [lerp(el[0], wr[0], 0.75) - 1, lerp(el[1], wr[1], 0.75)] : [el[0] - 1, el[1] + 8];
    q.poly([el, tip, ...[...hem].reverse(), front], t.M);
    ribs = hem.filter((_, i) => i % 2 === 0).map((h, i) => [[lerp(el[0], tip[0], (i * 2) / N), lerp(el[1], tip[1], (i * 2) / N)] as Pt, h] as [Pt, Pt]);
  }
  // one fold line: the lit strip along the top (the finger side) and toward the light
  planes(q, (x, y, src) => {
    if (!src.isOpaque(x, y - 1)) return t.L;
    if (!src.isOpaque(x + light.side, y) && src.isOpaque(x, y - 1) && y < el[1] + 8) return t.L;
    return null;
  });
  // the finger ribs: a lit line from the finger line down to each tongue tip (one rib per tongue)
  for (const [a, b] of ribs) {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
    for (let i = 2; i < n - 1; i++) {
      const x = rnd(lerp(a[0], b[0], i / n) - 0.5);
      const y = rnd(lerp(a[1], b[1], i / n) - 0.5);
      if (q.isOpaque(x, y)) q.set(x, y, t.L);
    }
  }
  // eaten holes (≥ 3 px) with a 1-px leaf3 ring; they stay transparent after the outline (f.holes)
  if (near) {
    if (s > 0.05) {
      holeIn(f, q, wr[0] + 4 * s, wr[1] - 5 * s, 1.6);
      holeIn(f, q, wr[0] + 4 * s, wr[1] + 5 * s, 1.5);
    } else {
      // one in the panel above the back (the floor shows through), one low in the cape over the flank
      holeIn(f, q, lerp(el[0], tip[0], 0.28) - 0.5, lerp(el[1], tip[1], 0.28) + 3, 1.6);
      holeIn(f, q, lerp(el[0], tip[0], 0.55), lerp(el[1], tip[1], 0.55) + 9 * (1 - sp * 0.5), 1.5);
    }
  } else if (sp > 0.3) holeIn(f, q, lerp(el[0], tip[0], 0.6), lerp(el[1], tip[1], 0.6) + 4, 1.4);
  f.comp.add(q, near ? Part.cape : Part.wingF, { out: OUT });
  if (shieldFan.length) {
    // the shield's finger bones: thin hide rods fanning from the wrist to each scallop point
    const fb = layer();
    for (const q2 of shieldFan.slice(1)) fb.poly(tubePoly(wr, q2, 2.2, 1.2), HIDE.M);
    bands(fb, HIDE, light, { top: 1, lit: 1, sh: 1, bottom: 1, crease: false });
    f.comp.add(fb, Part.cape, { out: OUT });
  }
  // the finger bones (hide ridge) with a hooked claw tip
  const b = layer();
  const bt = near ? HIDE : HIDE_FAR;
  b.poly(tubePoly(el, tip, near ? 3.4 : 2.8, 1.6), bt.M);
  bands(b, bt, light, { top: 1, lit: 1, sh: 1, bottom: 1, crease: false });
  f.comp.add(b, near ? Part.cape : Part.wingF, { out: OUT });
  const c = layer();
  const cl = near ? CHITIN : CHITIN_FAR;
  const ux = tip[0] - el[0];
  const uy = tip[1] - el[1];
  const ul = Math.hypot(ux, uy) || 1;
  const cx = tip[0] + (ux / ul) * 1.5;
  const cy = tip[1] + (uy / ul) * 1.5;
  c.set(rnd(cx - 0.5), rnd(cy - 0.5), cl.L).set(rnd(cx - 0.5 + ux / ul), rnd(cy - 0.5 + uy / ul) - 1, cl.M);
  f.comp.add(c, near ? Part.cape : Part.wingF, { out: PAL.ink });
}

function drawArm(f: Frame, near: boolean): void {
  const { sk, light, o } = f;
  const t = near ? HIDE : HIDE_FAR;
  const sh = near ? sk.shN : sk.shF;
  const el = near ? sk.elN : sk.elF;
  const wr = near ? sk.wrN : sk.wrF;
  const q = layer();
  q.poly(tubePoly(sh, el, near ? 7 : 6, near ? 4.5 : 4), t.M);
  q.poly(tubePoly(el, wr, near ? 4.6 : 4, near ? 3.6 : 3.2), t.M);
  q.disc(el[0], el[1], near ? 2.4 : 2, t.M);
  bands(q, t, light, { top: 1, lit: 2, sh: 1, bottom: 1 });
  f.comp.add(q, near ? Part.armN : Part.armF, { out: OUT });
  // the wrist knuckle: a chitin claw-hand planted on the floor (or lifted)
  const k = layer();
  const cl = near ? CHITIN : CHITIN_FAR;
  const wx = rnd(wr[0]);
  const wy = rnd(wr[1]);
  const planted = !(near && o.shield > 0.05);
  if (planted) {
    k.poly([[wx - 2, wy - 1], [wx + 1, wy - 2], [wx + 4, wy + 1], [wx + 4, wy + 3], [wx - 2, wy + 3]], cl.M);
    bands(k, cl, light, { top: 1, lit: 1, sh: 1, bottom: 1, crease: false });
  } else {
    k.poly([[wx - 2, wy - 2], [wx + 2, wy - 2], [wx + 4, wy], [wx + 2, wy + 2], [wx - 2, wy + 1]], cl.M);
    bands(k, cl, light, { top: 1, lit: 1, sh: 1, bottom: 1, crease: false });
  }
  f.comp.add(k, near ? Part.armN : Part.armF, { out: PAL.ink });
  // the elbow spur: a short chitin hook where the wing folds
  const e = layer();
  e.set(rnd(el[0]) - 1, rnd(el[1]) - 3, cl.L).set(rnd(el[0]), rnd(el[1]) - 2, cl.M);
  f.comp.add(e, near ? Part.armN : Part.armF, { out: PAL.ink });
}

function drawNeckHead(f: Frame): void {
  const { sk, o, light } = f;
  const [nx, ny] = sk.neck;
  const [hx, hy] = sk.head;
  // neck: a thick tube from the chest to the back of the skull, chitin plates under it
  const n = layer();
  n.poly(tubePoly([nx - 2, ny + 2], [hx - 2, hy + 2], 11, 8), HIDE.M);
  bands(n, HIDE, light, { top: 2, lit: 2, sh: 3, bottom: 2, half: 0.7 });
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
    const h = 3 + o.bristle + (i === 1 || i === 2 ? 1 : 0);
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
  if (o.eye >= 2) {
    p.set(ex, ey, PAL.void0).set(ex + 1, ey, PAL.void0);
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
      if (o.sacHot) p.set(x, y, d < core + 0.1 ? PAL.gold3 : VEN.body);
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
  // the hot band: leaf3 / gold3 side by side across the bulb's heart, ONE gold4 core pixel
  const cx = rnd(bx - 0.5);
  const cy = rnd(by - 0.5);
  const rows: [number, number][] = g >= 3 ? [[0, 3], [-1, 2], [1, 2], [-2, 1]] : g >= 2 ? [[0, 2], [-1, 2], [1, 1]] : [[0, 1], [-1, 1]];
  for (const [dy, n] of rows)
    for (let i = -n; i <= n; i++) {
      const x = cx + i;
      const y = cy + dy;
      if (!venom(x, y)) continue;
      p.set(x, y, (x + y) & 1 ? PAL.gold3 : VEN.body);
    }
  if (venom(cx, cy) || p.get(cx, cy) === PAL.gold3) p.set(cx, cy, VEN.core);
}

function beadLight(f: Frame): void {
  const { p, o, sk } = f;
  for (let i = 0; i < 6; i++) {
    const b = o.beads[i] ?? 0;
    if (b <= 0) continue;
    const [x, y] = sk.quills[i];
    const h = 3 + o.bristle + (i === 1 || i === 2 ? 1 : 0);
    const tx = rnd(x) - ((h - 1) >> 1);
    const ty = rnd(y) - h;
    const c = o.hot ? PAL.gold3 : VEN.body;
    p.set(tx, ty, c);
    if (b >= 2) p.set(tx - 1, ty, VEN.deep).set(tx, ty - 1, c);
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
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!EATEN.has(comp.owner(x, y))) continue;
      const c = p.get(x, y);
      if (c === null || c === PAL.ink) continue;
      const [u, v] = partXY(f, x, y);
      const s = seamAt(u, v, 5);
      if (!s) continue;
      if (k < 0.5 && s === 1 && (x + y) & 1) continue; // a faint web: every other seam pixel
      const [u2, v2] = [u >> 2, v >> 2];
      const hotNode = s === 2 && k >= 0.5 && hash2(u2, v2, 11) < 0.3;
      p.set(x, y, hotNode ? PAL.gold3 : s === 2 && k >= 0.5 ? VEN.body : VEN.deep);
    }
}

/** Holes eaten into the drake's own hide (real transparency), acid rims on the strands' lower edges. */
function eatHoles(f: Frame): void {
  const { p, comp, o } = f;
  if (o.holes <= 0) return;
  const gone = new Uint8Array(W * H);
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
      if (holeAt(u, v, step, 5)) gone[y * W + x] = 1;
    }
  for (let i = 0; i < W * H; i++) if (gone[i]) p.erase(i % W, (i / W) | 0);
  // rims: an acid lip under each hole (the venom runs down), one pixel
  for (let y = 1; y < H - 1; y++)
    for (let x = 0; x < W; x++) {
      if (!p.isOpaque(x, y) || !gone[(y - 1) * W + x] || !p.isOpaque(x, y + 1)) continue;
      if (!EATEN.has(comp.owner(x, y))) continue;
      p.set(x, y, VEN.body);
    }
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
    return d < 0.45 ? PAL.void0 : PAL.leaf2;
  });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (y > GY) q.erase(x, y);
  const ph = Math.floor(o.t * 10 + o.marker * 3);
  const bub: Pt[] = [[cx - 6 + (ph % 3), cy - 1], [cx + 5 - (ph % 2), cy]];
  for (const [bx2, by2] of bub) if (q.isOpaque(rnd(bx2), rnd(by2))) q.set(rnd(bx2), rnd(by2), VEN.body);
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
  const base = GY - 2 + sink;
  const q = layer();
  // two chitin segments, the bulb casing, the hook on top pointing up and forward
  q.ellipse(x0, base - 2.5, 2.6, 2.6, CHITIN.M);
  q.ellipse(x0, base - 6.5, 2.3, 2.4, CHITIN.M);
  q.ellipse(x0, base - 11, 3.2, 3.2, CHITIN.M);
  strokeMask(q, [[x0, base - 13], [x0 + 1, base - 16], [x0 + 3, base - 17]], [2.4, 1.6, 1], CHITIN.M);
  bands(q, CHITIN, light, { top: 1, lit: 1, sh: 1, bottom: 1, crease: false });
  // the casing's empty heart (the venom is spent: a dark well with one leaf2 pixel)
  q.set(x0, base - 11, PAL.stone0).set(x0 - 1, base - 11, PAL.stone0).set(x0, base - 10, o.glow > 0 ? VEN.deep : PAL.stone0);
  for (let y = GY - 1; y < H; y++) for (let x = 0; x < W; x++) q.erase(x, y); // below the pool surface
  const tmp = layer();
  tmp.blit(q, 0, 0);
  tmp.outline(PAL.ink);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = tmp.get(x, y);
      if (c === null || y >= GY - 1) continue;
      p.set(x, y, c);
    }
  // one bead of venom on the hook (until it falls, sink ≥ 1.5)
  if (o.marker < 1.5 && o.glow > 0) p.set(x0 + 4, base - 17, VEN.body).set(x0 + 4, base - 16, VEN.deep);
  else if (o.marker >= 1.5 && o.marker < 2) p.set(x0 + 4, GY - 3, VEN.body);
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
  const f: Frame = { p, comp, light, o, sk, holes: [] };
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
