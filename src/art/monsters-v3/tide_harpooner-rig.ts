// Kabuk Zıpkıncı v3 — the "shell carrier" rig: Pose → pixels. A bespoke ace rig (no body plan fits).
//
// An old hermit crab that lives in a giant spiral CONCH and fishes with a rope harpoon. Facing right:
//   - the conch (≈ 55 % of the box) up and back, apex up-left, a rigid stamped map in a few fixed orientations
//     (tide_harpooner-shell.ts), mussels and coral sprigs riding on it as overlays;
//   - the crab's front in the aperture: a small carapace, two independent EYE STALKS (gold eyes, the only gold),
//     the BIG near claw holding the harpoon, the small far claw holding a rope COIL, four visible walking legs
//     (the far pair one value darker: hide-far);
//   - the HARPOON: driftwood shaft (earth1/2), stone head with two 2-px barbs, lashing, a line ring under the head;
//   - the ROPE: a 2-px line (lit earth4 over earth1), NOT outlined, sagging between the coil and the ring.
// Planes: flat bands from each part's own edges toward the ONE key light (top-left; 'right' = the P2 relight
// sheet), seams one step darker, a 1-px ink outline at the end; light (eyes, nacre flash, bubbles, foam, glints,
// the floor ring, vapour) is painted after the outline and never outlined (IŞ-9).
// Frame 120×104; root R = (AX, GY) is the ground point between the walking legs.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ik2, lightOf, type Light } from '../rigkit';
import { bands, Comp, ellPoly, hash2, rope2, sagCurve, taperPoly, tubePoly, type Pt, type Tones } from './tide_harpooner-kit';
import { SHELL_POI, SO, SW, shellMap, shellPt } from './tide_harpooner-shell';

export const W = 120;
export const H = 104;
export const AX = 50;
export const GY = 98;
/** default shell centre (frame px) */
export const SCX = 37;
export const SCY = 64;
/** harpoon planted: butt x (frame px) */
export const HARP_X = 71;
/** full harpoon length (px) */
export const HARP_L = 60;

export const enum Part {
  none = 0,
  legF,
  clawF,
  shell,
  body,
  eyes,
  legN,
  harp,
  clawN,
  rope,
  fx,
}

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const rnd = Math.round;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- pose

export interface Pose {
  /** shell offset from its default centre (whole px), orientation (deg, one of the authored maps), shown */
  sx: number;
  sy: number;
  rot: number;
  shell: number;
  /** the shell is clipped below this many px under the floor line… i.e. rows below GY - sink are cut (burial) */
  sink: number;
  /** crab: extension out of the aperture 0 (inside) … 1 (out); carapace nudge (px) */
  ext: number;
  cx: number;
  cy: number;
  /** eye stalks: length 0…1, angles (deg from straight up, + leans forward) */
  eye: number;
  eL: number;
  eR: number;
  /** eyes glow 0 dark … 1 normal … 2 rigid / bright */
  eyeLit: number;
  /** walking legs out 0…1 (0 = tucked into the aperture), lift of the near-front foot */
  legs: number;
  /** foot set: 0 = idle planted feet, 1 = braced (haul) feet, 2 = summon / death (feet relative to the shell) */
  feet: number;
  /** big (near) claw: hand target relative to R, openness 0…1, shown 0…1 */
  nx: number;
  ny: number;
  nOpen: number;
  nOn: number;
  /** palm turn: 0 fingers point right, else degrees */
  nAng: number;
  /** small (far) claw: hand target relative to R, openness, shown */
  fx: number;
  fy: number;
  fOn: number;
  /** harpoon: butt position relative to R, angle (deg; −90 = straight up), drawn length factor (foreshortening), shown, smear px */
  hx: number;
  hy: number;
  ha: number;
  hl: number;
  hOn: number;
  smear: number;
  /** 1 = the harpoon (and its rope) pass BEHIND the shell (the far side of the twirl) */
  hBack: number;
  /** 1 = the big claw grips the shaft (its hand goes to the grip point; nx / ny ignored) */
  held: number;
  /** grip point along the shaft (0 butt … 1 tip) */
  grip: number;
  /** rope: 0 none, 1 coil → ring, 2 coil → out (rope leaves the frame toward the target), 3 coil → harpoon tail (twirl) */
  rope: number;
  sag: number;
  swing: number;
  /** rope taut: 0 / 1 (one tone brighter) */
  taut: number;
  /** rope out end (relative to R) for rope 2 */
  ox: number;
  oy: number;
  /** wet tail of the rope 0 dry … 1 wet */
  wet: number;
  /** coil: loops 0…1 (1 = full coil), sway px */
  coil: number;
  coilSw: number;
  /** nacre: 0 normal, 1 one step brighter, 2 white flash */
  nacre: number;
  /** mussel: 0 all shut, 1 the lower cluster opens, 2 the spire cluster opens */
  mus: number;
  /** guard: the big claw shuts the aperture like a door (only the chela is drawn, lying over the well) */
  door: number;
  /** guard: the two eyes peeking from the dark gap (0 none, 1 / 2 two peek positions) */
  peek: number;
  /** coral sprig sway (px) */
  coral: number;
  /** fx */
  bub: number; // bubble phase (−1 none; 0…1 rise, ≥1 popped)
  bub2: number;
  ring: number; // floor ring 0 none, 1 / 2 frames
  puff: number; // vapour puff from the apex (0 none, else phase 0…1)
  spray: number; // sand spray at the harpoon foot (0 none, else phase)
  beads: number; // foam beads flung by the twirl (0 none, else phase)
  sand: number; // sand pile at the shell edges (burial, 0…1)
  glint: number; // harpoon-tip glint size 0 / 1 / 2
  tok: number; // a 1-frame tremor (px) of the shell (re-plant, heave)
  diss: number; // generic dissolve of what is left (0…1), last 150 ms of the death
  t: number; // global phase 0…1
}

export const NEUTRAL: Pose = {
  sx: 0, sy: 0, rot: 0, shell: 1, sink: 99,
  ext: 1, cx: 0, cy: 0,
  eye: 1, eL: -6, eR: 16, eyeLit: 1,
  legs: 1, feet: 0,
  nx: 16, ny: -30, nOpen: 0, nOn: 1, nAng: 0,
  fx: 14, fy: -44, fOn: 1,
  hx: HARP_X - AX, hy: 0, ha: -90, hl: 1, hOn: 1, hBack: 0, smear: 0, held: 1, grip: 0.3,
  rope: 1, sag: 9, swing: 0, taut: 0, ox: 66, oy: -40, wet: 0, coil: 1, coilSw: 0,
  nacre: 0, mus: 0, door: 0, peek: 0, coral: 0,
  bub: -1, bub2: -1, ring: 0, puff: 0, spray: 0, beads: 0, sand: 0, glint: 0, tok: 0, diss: 0, t: 0,
};
export const pose = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

// ---------------------------------------------------------------- tones

const CRAB: Tones = { L: PAL.earth4, M: PAL.earth3, S: PAL.earth2, D: PAL.earth1 };
const CRAB_FAR: Tones = { L: PAL.earth3, M: PAL.earth2, S: PAL.earth1, D: PAL.earth0 };
const STONE: Tones = { L: PAL.stone4, M: PAL.stone3, S: PAL.stone2, D: PAL.stone1 };

// ---------------------------------------------------------------- skeleton

export interface Skel {
  R: Pt;
  /** shell centre (frame px) */
  S: Pt;
  /** carapace centre, mouth */
  C: Pt;
  eyeL: Pt;
  eyeR: Pt;
  baseL: Pt;
  baseR: Pt;
  /** big claw shoulder, elbow, hand (palm centre), finger direction */
  shN: Pt;
  elN: Pt;
  hN: Pt;
  dirN: Pt;
  /** small claw */
  shF: Pt;
  elF: Pt;
  hF: Pt;
  /** harpoon butt, tip, unit direction, ring point */
  hb: Pt;
  ht: Pt;
  hd: Pt;
  hring: Pt;
  /** legs: hip, knee, ankle, tip, ×4 (0, 1 near; 2, 3 far) */
  legs: { hip: Pt; knee: Pt; ank: Pt; tip: Pt; near: boolean }[];
  apex: Pt;
  vent: Pt;
}

/** idle feet (tip, ankle offset) per leg: near-front, near-back, far-front, far-back */
const FEET: { tip: Pt; ank: Pt; hip: Pt; l1: number; l2: number; near: boolean }[] = [
  { tip: [66, GY], ank: [64, GY - 9], hip: [53, 73], l1: 10, l2: 15, near: true },
  { tip: [55, GY], ank: [55, GY - 9], hip: [50, 75], l1: 8, l2: 12, near: true },
  { tip: [61, GY], ank: [60, GY - 8], hip: [51, 74], l1: 9, l2: 14, near: false },
  { tip: [38, GY], ank: [40, GY - 9], hip: [47, 75], l1: 9, l2: 13, near: false },
];
/** braced (haul) feet: the rear legs dig in further back, the front pair reaches forward */
const FEET_BRACE: Pt[] = [[69, GY], [56, GY], [62, GY], [36, GY]];

export function skeleton(o: Pose): Skel {
  const R: Pt = [AX, GY];
  const S: Pt = [SCX + o.sx, SCY + o.sy];
  const sp = (s: number, t: number): Pt => {
    const [dx, dy] = shellPt(s, t, o.rot);
    return [S[0] + dx, S[1] + dy];
  };
  const mouth = sp(SHELL_POI.mouth[0], SHELL_POI.mouth[1]);
  // the crab leans out of the aperture along the aperture's outward normal (+t)
  const nrm = shellPt(0, 1, o.rot);
  const e = clamp(o.ext, 0, 1);
  const C: Pt = [mouth[0] + nrm[0] * 5 * e + 1 + o.cx, mouth[1] + nrm[1] * 5 * e + 1 + o.cy];
  // eye stalks
  const el = 9 * clamp(o.eye, 0, 1.3);
  const baseL: Pt = [C[0] - 1, C[1] - 3];
  const baseR: Pt = [C[0] + 3, C[1] - 3];
  const eyeL: Pt = [baseL[0] + Math.sin(o.eL * DEG) * el, baseL[1] - Math.cos(o.eL * DEG) * el];
  const eyeR: Pt = [baseR[0] + Math.sin(o.eR * DEG) * (el + 1), baseR[1] - Math.cos(o.eR * DEG) * (el + 1)];
  // harpoon (+ the big claw: when it grips the shaft, the harpoon follows the hand the arm can reach)
  const reach = (a: Pt, b: Pt, len: number): Pt => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = Math.hypot(dx, dy);
    return d <= len ? b : [a[0] + (dx / d) * len, a[1] + (dy / d) * len];
  };
  const shN: Pt = [C[0] + 2, C[1] + 6];
  let hb: Pt = [AX + o.hx, GY + o.hy];
  const hd: Pt = [Math.cos(o.ha * DEG), Math.sin(o.ha * DEG)];
  const L = HARP_L * o.hl;
  let hN: Pt;
  let dirN: Pt;
  if (o.held > 0) {
    const g = L * o.grip;
    const gp: Pt = [hb[0] + hd[0] * g, hb[1] + hd[1] * g];
    // the palm sits on the body side of the shaft, the fingers wrap across it
    const perp: Pt = [-hd[1], hd[0]];
    const side = perp[0] < 0 ? -1 : perp[0] > 0 ? 1 : perp[1] < 0 ? -1 : 1;
    const want: Pt = [gp[0] - perp[0] * side * 5, gp[1] - perp[1] * side * 5];
    hN = reach(shN, want, 18);
    hb = [hb[0] + hN[0] - want[0], hb[1] + hN[1] - want[1]];
    dirN = [perp[0] * side, perp[1] * side];
  } else {
    hN = reach(shN, [AX + o.nx, GY + o.ny], 18);
    dirN = [Math.cos(o.nAng * DEG), Math.sin(o.nAng * DEG)];
  }
  const ht: Pt = [hb[0] + hd[0] * L, hb[1] + hd[1] * L];
  const hring: Pt = [hb[0] + hd[0] * (L - 15 * o.hl), hb[1] + hd[1] * (L - 15 * o.hl)];
  const hN2 = hN;
  const elN = ik2(shN, hN2, 8.5, 9.5, -1) as Pt;
  const shF: Pt = [C[0] - 1, C[1] + 5];
  const hF = reach(shF, [AX + o.fx, GY + o.fy], 16);
  const elF = ik2(shF, hF, 8, 8, -1) as Pt;
  // legs
  const hipShift: Pt = [S[0] - SCX, S[1] - SCY];
  const legs = FEET.map((L0, i) => {
    const hip: Pt = [L0.hip[0] + hipShift[0] + o.cx * 0.5, L0.hip[1] + hipShift[1]];
    let tip: Pt;
    let ank: Pt;
    if (o.feet === 2) {
      // feet carried with the shell (summon / death): legs folded toward the aperture by `legs`
      const k = clamp(o.legs, 0, 1);
      const restT: Pt = [L0.tip[0] + hipShift[0], L0.tip[1] + hipShift[1]];
      tip = [hip[0] + (restT[0] - hip[0]) * k, hip[1] + (restT[1] - hip[1]) * k];
      const ra: Pt = [L0.ank[0] + hipShift[0], L0.ank[1] + hipShift[1]];
      ank = [hip[0] + (ra[0] - hip[0]) * k, hip[1] + (ra[1] - hip[1]) * k];
      // the floor stops them
      if (tip[1] > GY) tip = [tip[0], GY];
      if (ank[1] > GY - 6) ank = [ank[0], GY - 6];
    } else {
      tip = o.feet === 1 ? FEET_BRACE[i] : L0.tip;
      ank = [tip[0] + (L0.ank[0] - L0.tip[0]), tip[1] + (L0.ank[1] - L0.tip[1])];
      if (o.legs < 1) {
        const k = clamp(o.legs, 0, 1);
        tip = [hip[0] + (tip[0] - hip[0]) * k, hip[1] + (tip[1] - hip[1]) * k];
        ank = [hip[0] + (ank[0] - hip[0]) * k, hip[1] + (ank[1] - hip[1]) * k];
      }
    }
    const bend = i === 3 ? -1 : 1;
    const l1 = L0.l1 * Math.max(0.35, clamp(o.legs, 0, 1));
    const l2 = L0.l2 * Math.max(0.35, clamp(o.legs, 0, 1));
    const d = Math.hypot(ank[0] - hip[0], ank[1] - hip[1]);
    const knee = d >= l1 + l2 - 0.01 ? ([(hip[0] + ank[0]) / 2, (hip[1] + ank[1]) / 2] as Pt) : (ik2(hip, ank, l1, l2, bend) as Pt);
    return { hip, knee, ank, tip, near: L0.near };
  });
  return {
    R, S, C, eyeL, eyeR, baseL, baseR, shN, elN, hN: hN2, dirN, shF, elF, hF, hb, ht, hd, hring, legs,
    apex: sp(SHELL_POI.apex[0], SHELL_POI.apex[1]),
    vent: sp(SHELL_POI.vent[0], SHELL_POI.vent[1]),
  };
}

// ---------------------------------------------------------------- frame

interface Frame {
  p: PixelCanvas;
  comp: Comp;
  light: Light;
  ls: -1 | 1;
  o: Pose;
  sk: Skel;
  /** pixels never outlined (the rope), with their colours, restored after the outline */
  bare: Map<number, number>;
}

const layer = () => new PixelCanvas(W, H);

// ---------------------------------------------------------------- parts

function drawLeg(f: Frame, i: number): void {
  const { sk, o, ls } = f;
  const L = sk.legs[i];
  if (o.legs <= 0.05) return;
  const t = L.near ? CRAB : CRAB_FAR;
  const w = L.near ? 4.6 : 3.6;
  const q = layer();
  q.poly(tubePoly(L.hip, L.knee, w + 0.6, 1, 1), t.M);
  q.poly(taperPoly(L.knee, L.ank, w, w - 0.6), t.M);
  // dactyl: a pointed tip (≥ 2 px until the last px)
  q.poly(taperPoly(L.ank, L.tip, w - 1, 1.2), t.M);
  bands(q, t, ls, { lit: 1, top: 1, shade: 1, bottom: 1 });
  // joint bands (fire1/2) at the knee and the ankle
  for (const j of [L.knee, L.ank]) {
    const jx = rnd(j[0]);
    const jy = rnd(j[1]);
    for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 1; dx++) if (q.isOpaque(jx + dx, jy + dy)) q.set(jx + dx, jy + dy, L.near ? (dy < 0 ? PAL.fire2 : PAL.fire1) : PAL.fire1);
  }
  f.comp.add(q, L.near ? Part.legN : Part.legF, { out: L.near ? PAL.earth1 : PAL.earth0 });
}

function drawShell(f: Frame): void {
  const { o, ls, comp } = f;
  if (!o.shell) return;
  const m = shellMap(o.rot, ls);
  const x0 = rnd(SCX + o.sx) - SO;
  const y0 = rnd(SCY + o.sy) - SO;
  const q = layer();
  const floor = GY - (o.sink >= 99 ? -99 : o.sink);
  const lipCol = (c: number) => (o.nacre >= 2 ? (c === PAL.water2 ? PAL.water4 : PAL.white) : o.nacre >= 1 ? (c === PAL.water2 ? PAL.water3 : c === PAL.water3 ? PAL.water4 : PAL.white) : c);
  for (let y = 0; y < SW; y++) {
    const fy = y0 + y;
    if (fy < 0 || fy >= H || fy > floor) continue;
    for (let x = 0; x < SW; x++) {
      const c = m.px.get(x, y);
      if (c === null) continue;
      const fx = x0 + x;
      if (fx < 0 || fx >= W) continue;
      q.set(fx, fy, m.lip[y * SW + x] ? lipCol(c) : c);
    }
  }
  comp.add(q, Part.shell, {});
  // mussel clusters (night2/3, water0 hinge) — two valves each, ≥ 2×2
  const sp = (s: number, t: number): Pt => {
    const [dx, dy] = shellPt(s, t, o.rot);
    return [rnd(SCX + o.sx + dx), rnd(SCY + o.sy + dy)];
  };
  SHELL_POI.mussels.forEach(([s, t], k) => {
    const [mx, my] = sp(s, t);
    if (my > floor - 1) return;
    const mq = layer();
    const open = (k === 0 && o.mus === 1) || (k === 2 && o.mus === 2);
    mq.poly(ellPoly(mx, my, 2.6, 1.7, -0.5, 16), PAL.night2);
    mq.poly(ellPoly(mx + 2, my + 2, 2.2, 1.5, -0.4, 16), PAL.night2);
    // lit upper rim
    for (let y = my - 3; y <= my + 4; y++)
      for (let x = mx - 3; x <= mx + 5; x++) if (mq.isOpaque(x, y) && !mq.isOpaque(x, y - 1)) mq.set(x, y, PAL.night3);
    if (open) {
      // the valves part: a dark gap with a 1-px water4 sliver (the wet inner nacre)
      mq.set(mx - 1, my, PAL.night0).set(mx, my, PAL.water3).set(mx + 1, my, PAL.night0);
    } else mq.set(mx, my + 1, PAL.water0);
    comp.add(mq, Part.shell, { out: PAL.earth1 });
  });
  // coral sprigs on the lip's top end (fire2 / fire3, 2-px branches)
  {
    const [cx, cy] = sp(SHELL_POI.coral[0], SHELL_POI.coral[1]);
    if (cy < floor - 2) {
      const cq = layer();
      const sw = o.coral;
      cq.poly(taperPoly([cx, cy + 1], [cx + 3 + sw, cy - 6], 2.6, 2), PAL.fire2);
      cq.poly(taperPoly([cx + 1.5, cy - 2], [cx - 1 + sw, cy - 6], 2.2, 2), PAL.fire2);
      cq.poly(taperPoly([cx + 2.4, cy - 3.5], [cx + 6 + sw, cy - 4], 2.2, 2), PAL.fire2);
      for (let y = cy - 8; y <= cy + 2; y++) for (let x = cx - 3; x <= cx + 9; x++) if (cq.isOpaque(x, y) && !cq.isOpaque(x + ls, y - 1)) cq.set(x, y, PAL.fire3);
      comp.add(cq, Part.shell, { out: PAL.water1 });
    }
  }
}

function drawBody(f: Frame): void {
  const { sk, o, ls } = f;
  if (o.ext <= 0.05) return;
  const [cx, cy] = sk.C;
  const q = layer();
  // carapace: a rounded shield, the front face toward the viewer; mouthparts under it
  q.poly(ellPoly(cx, cy, 6.4, 4.6, -0.12, 28), CRAB.M);
  // the rostrum (a short point between the eyes) and two short mouthparts
  q.poly([[cx + 2, cy - 4], [cx + 6.5, cy - 3], [cx + 3, cy - 1]], CRAB.M);
  q.poly(taperPoly([cx + 3, cy + 3], [cx + 4.5, cy + 5.5], 2.4, 2), CRAB.M);
  q.poly(taperPoly([cx + 0.5, cy + 3.5], [cx + 1, cy + 5.5], 2.2, 2), CRAB.M);
  bands(q, CRAB, ls, { lit: 2, top: 2, shade: 2, bottom: 1 });
  // a fire band across the carapace front (the crab's red)
  for (let x = rnd(cx) - 4; x <= rnd(cx) + 4; x++) if (q.isOpaque(x, rnd(cy) + 1) && q.get(x, rnd(cy) + 1) !== CRAB.L) q.set(x, rnd(cy) + 1, PAL.fire1);
  f.comp.add(q, Part.body, { out: PAL.earth0 });
}

function drawEyes(f: Frame): void {
  const { sk, o, ls } = f;
  if (o.eye <= 0.05 || o.ext <= 0.05) return;
  const q = layer();
  for (const [b, e] of [[sk.baseL, sk.eyeL], [sk.baseR, sk.eyeR]] as const) {
    q.poly(taperPoly(b, e, 2.4, 1.8), CRAB.M);
  }
  bands(q, CRAB, ls, { lit: 1, top: 1, shade: 1, bottom: 0 });
  // eye bulbs: 3×3 dark, the light pixel comes after the outline
  for (const e of [sk.eyeL, sk.eyeR]) {
    const x = rnd(e[0]);
    const y = rnd(e[1]);
    q.rect(x - 1, y - 2, 3, 3, PAL.night1);
    q.set(x - 1, y - 2, PAL.night0).set(x + 1, y, PAL.night0);
  }
  f.comp.add(q, Part.eyes, { out: PAL.earth0 });
}

function drawClawF(f: Frame): void {
  const { sk, o, ls } = f;
  if (o.fOn <= 0.05) return;
  const q = layer();
  q.poly(tubePoly(sk.shF, sk.elF, 3, 1, 1), CRAB_FAR.M);
  q.poly(tubePoly(sk.elF, sk.hF, 3, 1, 0), CRAB_FAR.M);
  const [hx, hy] = sk.hF;
  q.poly(ellPoly(hx + 1, hy, 3.2, 2.4, 0.3, 16), CRAB_FAR.M);
  q.poly(taperPoly([hx + 2, hy - 1], [hx + 6, hy + 1], 2, 1.2), CRAB_FAR.M);
  q.poly(taperPoly([hx + 2, hy + 1.5], [hx + 5, hy + 2.5], 2, 1.2), CRAB_FAR.M);
  bands(q, CRAB_FAR, ls, { lit: 1, top: 1, shade: 1, bottom: 1 });
  const ex = rnd(sk.elF[0]);
  const ey = rnd(sk.elF[1]);
  if (q.isOpaque(ex, ey)) q.set(ex, ey, PAL.fire1).set(ex + 1, ey, PAL.fire1);
  f.comp.add(q, Part.clawF, { out: PAL.earth0 });
}

function drawClawN(f: Frame): void {
  const { sk, o, ls } = f;
  if (o.nOn <= 0.05) return;
  if (!o.door) {
    const q = layer();
    q.poly(tubePoly(sk.shN, sk.elN, 4.6, 1, 1), CRAB.M);
    q.poly(taperPoly(sk.elN, sk.hN, 4.6, 5.4), CRAB.M);
    bands(q, CRAB, ls, { lit: 1, top: 1, shade: 1, bottom: 1 });
    f.comp.add(q, Part.clawN, { out: PAL.earth1 });
  }
  // the chela: a heavy palm + two fingers wrapping across the shaft
  const [hx, hy] = sk.hN;
  const [dx, dy] = sk.dirN;
  const px = -dy;
  const py = dx;
  const gap = 1.2 + 3 * o.nOpen;
  const c = layer();
  const k = o.door ? 1.3 : 1;
  c.poly(ellPoly(hx, hy, 5.6 * k, 4.4 * k, Math.atan2(dy, dx), 28), CRAB.M);
  const tip = (along: number, across: number): Pt => [hx + dx * along * k + px * across * k, hy + dy * along * k + py * across * k];
  // dactyl (upper finger) and pollex (lower, fixed finger), pointed, tips curling toward each other
  c.poly([tip(3, -1.6 - gap / 2), tip(3, -4.4 - gap / 2), tip(9, -3.2 - gap / 2), tip(12.5, -1 - gap / 4), tip(11, -0.6 - gap / 2)], CRAB.M);
  c.poly([tip(3, 1.6 + gap / 2), tip(3, 4.2 + gap / 2), tip(9, 3 + gap / 2), tip(11.5, 1 + gap / 4), tip(10, 0.7 + gap / 2)], CRAB.M);
  bands(c, CRAB, ls, { lit: 2, top: 2, shade: 2, bottom: 1 });
  // finger tips fire2, a fire1 band at the palm's knuckle
  for (const [al, ac] of [[11, -1.2 - gap / 3], [10, 1.2 + gap / 3]] as const) {
    const [tx, ty] = tip(al, ac);
    for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) if (c.isOpaque(rnd(tx) + xx, rnd(ty) + yy)) c.set(rnd(tx) + xx, rnd(ty) + yy, PAL.fire2);
  }
  // granules on the palm's mid plane (2-px teeth, MA-2)
  for (const [al, ac] of [[-1.5, -1.5], [1, 1.5]] as const) {
    const [gx, gy] = tip(al, ac);
    const x = rnd(gx);
    const y = rnd(gy);
    if (c.get(x, y) === CRAB.M && c.get(x + 1, y) === CRAB.M) c.set(x, y, CRAB.S).set(x + 1, y, CRAB.S);
  }
  f.comp.add(c, Part.clawN, { out: PAL.earth1 });
}

function drawHarpoon(f: Frame): void {
  const { sk, o, ls } = f;
  if (o.hOn <= 0.05) return;
  const [bx, by] = sk.hb;
  const [dx, dy] = sk.hd;
  const L = HARP_L * o.hl;
  const nx = -dy;
  const ny = dx;
  const at = (a: number, c: number): Pt => [bx + dx * a + nx * c, by + dy * a + ny * c];
  const q = layer();
  // shaft: driftwood, 2 px (3 at the butt)
  q.poly([at(0, -1.4), at(L - 12 * o.hl, -1.1), at(L - 12 * o.hl, 1.1), at(0, 1.4)], PAL.earth2);
  // tone: the lit half earth2, the shade half earth1 — decided per pixel by the side of the axis vs the light
  const lit = layer();
  const sh = q.clone();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!sh.isOpaque(x, y)) continue;
      const side = (x + 0.5 - bx) * nx + (y + 0.5 - by) * ny;
      // light vector in the screen plane: (ls, -1); the half whose normal faces it is lit
      const facing = (nx * ls - ny) * side;
      lit.set(x, y, facing > 0 ? PAL.earth2 : PAL.earth1);
    }
  // knots
  for (const a of [14, 33]) {
    const [kx, ky] = at(a * o.hl, 0);
    if (lit.isOpaque(rnd(kx), rnd(ky))) lit.set(rnd(kx), rnd(ky), PAL.earth0);
  }
  f.comp.add(lit, Part.harp, { out: PAL.earth0 });
  // lashing (rope binding) where the head sits
  const lq = layer();
  lq.poly([at(L - 15 * o.hl, -2), at(L - 11 * o.hl, -2), at(L - 11 * o.hl, 2), at(L - 15 * o.hl, 2)], PAL.earth3);
  bands(lq, { L: PAL.earth4, M: PAL.earth3, S: PAL.earth2, D: PAL.earth1 }, ls, { lit: 1, top: 1, shade: 1, bottom: 1 });
  f.comp.add(lq, Part.harp, { out: PAL.earth1 });
  // stone head: a leaf blade with two 2-px barbs pointing back
  const hq = layer();
  const k = o.hl;
  hq.poly([at(L - 12 * k, -1.6), at(L - 7 * k, -3.2), at(L, 0), at(L - 7 * k, 3.2), at(L - 12 * k, 1.6)], STONE.M);
  hq.poly([at(L - 11 * k, -2.4), at(L - 14.5 * k, -4.6), at(L - 9 * k, -3.4)], STONE.M);
  hq.poly([at(L - 11 * k, 2.4), at(L - 14.5 * k, 4.6), at(L - 9 * k, 3.4)], STONE.M);
  bands(hq, STONE, ls, { lit: 1, top: 1, shade: 1, bottom: 1 });
  // the blade's ridge: lit stone4 down the middle on the lit side
  for (let a = L - 11 * k; a < L - 1; a += 0.5) {
    const [rx, ry] = at(a, -0.4 * ls * Math.sign(nx || 1));
    if (hq.isOpaque(rnd(rx), rnd(ry))) hq.set(rnd(rx), rnd(ry), PAL.stone4);
  }
  f.comp.add(hq, Part.harp, { out: PAL.stone1 });
}

/** release smear: 2 px streaks behind the flying harpoon (HA-12) — matter-coloured, drawn before the outline */
function drawSmear(f: Frame): void {
  const { sk, o } = f;
  if (o.smear <= 0 || o.hOn <= 0.05) return;
  const [bx, by] = sk.hb;
  const [dx, dy] = sk.hd;
  const q = layer();
  for (let i = 1; i <= o.smear; i++) {
    for (let a = -4; a < HARP_L * o.hl - 14; a += 0.5) {
      const x = rnd(bx + dx * (a - i * 4));
      const y = rnd(by + dy * (a - i * 4)) + (i % 2 ? -1 : 1);
      if (!f.p.isOpaque(x, y)) q.set(x, y, i === 1 ? PAL.earth2 : PAL.earth1);
    }
  }
  f.comp.add(q, Part.fx, {});
}

function ropePts(f: Frame): Pt[] {
  const { sk, o } = f;
  const coilTop: Pt = [sk.hF[0] + 3, sk.hF[1] + 2];
  if (o.rope === 1) return sagCurve(coilTop, sk.hring, o.sag, o.swing);
  if (o.rope === 2) {
    // the line runs out of the big claw's grip (it pays out / is hauled through the chela), the coil feeds it
    const from: Pt = o.nOn > 0.05 ? [sk.hN[0] + sk.dirN[0] * 9, sk.hN[1] + sk.dirN[1] * 9] : coilTop;
    return sagCurve(from, [AX + o.ox, GY + o.oy], o.sag, o.swing, 22);
  }
  if (o.rope === 3) {
    // the twirl: the rope from the raised small claw to the spinning harpoon's ring
    return sagCurve(coilTop, sk.hring, o.sag, o.swing, 10);
  }
  return [];
}

function drawRope(f: Frame): void {
  const { sk, o, p } = f;
  if (o.rope <= 0) return;
  const mark = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < W && y < H) {
      f.bare.set(y * W + x, 1);
      f.comp.id[y * W + x] = Part.rope;
    }
  };
  const top = o.taut ? PAL.earth4 : PAL.earth3;
  const under = o.taut ? PAL.earth2 : PAL.earth1;
  const pts = ropePts(f);
  if (pts.length) rope2(p, pts, top, under, mark, o.wet > 0 ? { len: rnd(12 * o.wet), top: PAL.earth2, under: PAL.earth1 } : undefined);
  // the coil: a hanging loop of rope under the small claw
  if (o.coil > 0.05 && o.fOn > 0.05) {
    const [hx, hy] = sk.hF;
    const r = 3 + 1.5 * o.coil;
    const sw = o.coilSw;
    const loop: Pt[] = [];
    // three hanging loops, each a little longer and swung a little further (the coil, not a ring)
    const loops = o.coil > 0.6 ? 3 : o.coil > 0.3 ? 2 : 1;
    for (let j = loops - 1; j >= 0; j--) {
      const loop: Pt[] = [];
      const rr = r + j * 0.8;
      for (let i = 0; i <= 16; i++) {
        const a = -Math.PI / 2 + (i / 16) * TAU;
        const yy = hy + 2 + rr + Math.sin(a) * rr * 1.25;
        const k = (yy - hy) / (2 * rr + 2);
        loop.push([hx + 2 + (j - 1) * 1.2 + Math.cos(a) * rr * 0.55 + sw * k * (1 + j * 0.3), yy]);
      }
      rope2(p, loop, j === 0 ? top : PAL.earth3, under, mark);
    }
  }
}

// ---------------------------------------------------------------- light layer

function eyeLight(f: Frame): void {
  const { p, sk, o } = f;
  if (o.eye <= 0.05 || o.ext <= 0.05 || o.eyeLit <= 0) return;
  for (const e of [sk.eyeL, sk.eyeR]) {
    const x = rnd(e[0]);
    const y = rnd(e[1]);
    p.set(x, y - 1, o.eyeLit >= 2 ? PAL.white : PAL.gold4);
    if (o.eyeLit >= 2) p.set(x + 1, y - 1, PAL.gold3).set(x, y - 2, PAL.gold3);
  }
}

function peekLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.peek <= 0) return;
  // two gold eyes in the dark gap between the shut claw and the lip
  const x = rnd(sk.C[0]) - 2 + (o.peek === 2 ? 1 : 0);
  const y = rnd(sk.C[1]) - 6;
  for (const [dx, dy] of [[0, 0], [3, 1]] as const) {
    const c = p.get(x + dx, y + dy);
    if (c === PAL.night0 || c === PAL.water0 || c === PAL.night1) p.set(x + dx, y + dy, PAL.gold4);
  }
}

function bubbleLight(f: Frame, ph: number, seed: number): void {
  const { p, sk } = f;
  if (ph < 0 || ph >= 1.6) return;
  const [vx, vy] = sk.vent;
  if (ph < 1) {
    const x = rnd(vx + 1 + Math.sin((ph + seed) * TAU) * 1.2);
    const y = rnd(vy - 2 - ph * 8);
    const big = ph > 0.3;
    // a bubble: ring of water4 with a white glint, 2–3 px
    if (big) {
      p.set(x, y, PAL.water4).set(x + 1, y, PAL.water4).set(x, y + 1, PAL.water4).set(x + 1, y + 1, PAL.water3);
      p.set(x, y, PAL.white);
    } else p.set(x, y, PAL.water4).set(x + 1, y, PAL.water4);
  } else {
    // pop: four 1-px droplets flying out
    const x = rnd(vx + 1);
    const y = rnd(vy - 10);
    const k = rnd((ph - 1) * 6) + 1;
    for (const [ax, ay] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) p.set(x + ax * k, y + ay * k, PAL.water4);
  }
}

function ringLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.ring <= 0) return;
  // a stepped 1-px ring of light on the floor under the aperture (≤ 7 px wide), 2 frames
  const cx = rnd(sk.C[0]) + 1;
  const r = o.ring >= 2 ? 3 : 2;
  const col = o.ring >= 2 ? PAL.water3 : PAL.water4;
  // an iso ellipse ring 3 rows tall whose lowest row is the floor row (it never drops under the feet band)
  for (let x = -r; x <= r; x++) {
    const ends = Math.abs(x) === r;
    const ys = ends ? [GY - 1] : [GY - 2, GY];
    for (const y of ys) if (!p.isOpaque(cx + x, y)) p.set(cx + x, y, col);
  }
}

function puffLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.puff <= 0) return;
  // the conch "sounds": a vapour plume vents from the apex — 2-px clusters, white near the vent, water4 as it thins
  const ph = o.puff;
  const [ax, ay] = sk.apex;
  for (let i = 0; i < 9; i++) {
    const u = clamp(ph * 1.25 - i * 0.07, 0, 1);
    if (u <= 0) continue;
    const wob = Math.sin(i * 2.3 + u * 4) * (1 + u * 3);
    const x = rnd(ax - 1 - u * 9 + wob);
    const y = rnd(ay - 3 - u * 20 - (i % 3));
    const size = u < 0.35 ? 4 : u < 0.7 ? 3 : 2;
    const c = u < 0.5 ? PAL.white : PAL.water4;
    p.rect(x, y, size, size - 1, c);
    if (size > 2) p.set(x + 1, y - 1, c).set(x + size - 2, y - 1, c);
  }
}

function sprayLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.spray <= 0) return;
  const ph = o.spray;
  const bx = rnd(sk.hb[0]);
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    const a = 0.25 + hash2(i, 3, 7) * 0.5;
    const d = 2 + ph * (6 + i);
    const x = rnd(bx + side * Math.cos(a) * d);
    const y = rnd(GY - 2 - Math.sin(a) * d * 1.4 + ph * ph * 10);
    if (y > GY) continue;
    p.rect(x, y, 2, 2, ph < 0.5 ? PAL.earth4 : PAL.earth3);
  }
}

function beadsLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.beads <= 0) return;
  const ph = o.beads;
  const [tx, ty] = sk.ht;
  for (let i = 0; i < 4; i++) {
    const x = rnd(tx - 4 + i * 3 + ph * (4 + i * 3));
    const y = rnd(ty + 2 + ph * (6 + i * 4) + ph * ph * 8);
    if (y >= GY) p.set(x, GY, PAL.water4);
    else p.rect(x, y, 2, 2, ph < 0.5 ? PAL.white : PAL.water4);
  }
}

function sandLight(f: Frame): void {
  const { p, o } = f;
  if (o.sand <= 0) return;
  // sand piling over the shell's edges at the floor line: flat earth3 / earth2 heaps (2 px rows)
  const cx = rnd(SCX + o.sx);
  const half = rnd(10 + 12 * o.sand);
  const hgt = rnd(1 + 3 * o.sand);
  for (let x = -half; x <= half; x++) {
    const k = 1 - Math.abs(x) / (half + 1);
    const hh = Math.max(1, rnd(hgt * Math.sqrt(k) + (hash2(x, 1, 3) > 0.7 ? 1 : 0)));
    for (let y = 0; y < hh; y++) p.set(cx + x, GY - y, y === hh - 1 ? PAL.earth3 : PAL.earth2);
  }
}

function glintLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.glint <= 0 || o.hOn <= 0.05) return;
  const x = rnd(sk.ht[0] - sk.hd[0] * 2);
  const y = rnd(sk.ht[1] - sk.hd[1] * 2);
  const put = (dx: number, dy: number) => {
    const c = p.get(x + dx, y + dy);
    if (c !== null && c !== PAL.ink) p.set(x + dx, y + dy, PAL.white);
  };
  put(0, 0);
  if (o.glint >= 2) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(dx, dy);
}

/** the generic dissolve of what is left in the last 150 ms: 2×2 clusters drop out, a few fall as earth / water */
function dissolvePass(f: Frame): void {
  const { p, o } = f;
  if (o.diss <= 0) return;
  const gone: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!p.isOpaque(x, y)) continue;
      const h = hash2(x >> 1, y >> 1, 23);
      if (h < o.diss) gone.push(x, y);
    }
  for (let i = 0; i < gone.length; i += 2) {
    const x = gone[i];
    const y = gone[i + 1];
    p.erase(x, y);
    if (((x | y) & 1) === 0 && hash2(x >> 1, y >> 1, 29) < 0.18) {
      const fall = 2 + rnd(o.diss * 6);
      const yy = Math.min(GY, y + fall);
      if (!p.isOpaque(x, yy)) p.rect(x, yy, 2, 1, hash2(x, y, 31) < 0.5 ? PAL.earth3 : PAL.water3);
    }
  }
}

// ---------------------------------------------------------------- draw

export function drawHarpooner(p: PixelCanvas, o: Pose, lightFrom: 'left' | 'right'): void {
  const light = lightOf(lightFrom);
  const sk = skeleton(o);
  const comp = new Comp(p);
  const f: Frame = { p, comp, light, ls: light.side, o, sk, bare: new Map() };
  const ropeBehind = o.rope === 1 || o.rope === 3;

  drawLeg(f, 3);
  drawLeg(f, 2);
  if (o.hBack) {
    drawRope(f);
    drawHarpoon(f);
  }
  drawClawF(f);
  drawShell(f);
  drawBody(f);
  drawEyes(f);
  drawLeg(f, 1);
  drawLeg(f, 0);
  if (!o.hBack) {
    if (ropeBehind) drawRope(f);
    drawHarpoon(f);
    drawSmear(f);
  }
  drawClawN(f);
  if (!ropeBehind && !o.hBack) drawRope(f);

  // the shell / body below the floor line is cut (burial, the summon's half-buried start)
  if (o.sink < 99) {
    const floor = GY - o.sink;
    for (let y = floor + 1; y < H; y++)
      for (let x = 0; x < W; x++) if (comp.id[y * W + x] === Part.shell) p.erase(x, y);
  }

  // rope pixels are not outlined: lift them out, outline, put them back (only the visible ones)
  const bare: [number, number][] = [];
  for (const [i] of f.bare) {
    const c = p.get(i % W, (i / W) | 0);
    if (c !== null && comp.id[i] === Part.rope) bare.push([i, c]);
  }
  for (const [i] of bare) p.erase(i % W, (i / W) | 0);
  p.outline(PAL.ink);
  for (const [i, c] of bare) p.set(i % W, (i / W) | 0, c);

  dissolvePass(f);

  // light layer
  sandLight(f);
  if (o.diss < 0.5) eyeLight(f);
  peekLight(f);
  bubbleLight(f, o.bub, 0.2);
  bubbleLight(f, o.bub2, 0.7);
  ringLight(f);
  puffLight(f);
  sprayLight(f);
  beadsLight(f);
  glintLight(f);
}
