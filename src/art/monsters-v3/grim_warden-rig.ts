// Hortlak Muhafız v3 — "Fener Bekçisi", the lantern warden: Pose → skeleton → pixels.
//
// A TALL, THIN, HUNCHED REVENANT in a tattered ash-grey shroud and a deep hood; an iron CAGE-HELM sits inside the hood
// with ONE soul-green eye light behind its bars. The near arm is held straight out with the SOUL LANTERN hanging under
// the bony fist on a short chain (the horizontal of the "L"), the far hand holds a gravedigger's SPADE-HALBERD planted
// at its back (the vertical, with the body). Shroud tatters stream back; the lantern sleeve hangs in ragged teeth.
//
//   - every part is a polygon / map shaded by measured flat planes (lit band toward the key light, shade band away
//     from it): no gradients, no dither; ONE key light from the screen's top-left (`light`: 'left' for P1, 'right' for
//     the P2 relight sheet, flipped by flipX it is lit from the top-left again);
//   - rigid parts (cage helm, lantern) are maps placed on whole pixels (never rotated in idle, IŞ-12);
//   - the iron boots and the halberd's butt are the planted walker feet (HA-9): they never move in idle / guard /
//     the transitions, and the shroud hem stays above the lowest 6 rows there;
//   - light (soul flame, glass, the eye, motes, the burst) is painted after the outline and never outlined (IŞ-9).
// Frame 104×98, 1 art px = 1 game px.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ik2, lightOf, type Light } from '../rigkit';
import { BONE, BONE_FAR, Comp, HAND, IRON, IRON_FAR, SHROUD, SHROUD_FAR, WOOD, bands, layer as kitLayer, lerp, planes, ribbon, spline, type Pt, type Tones } from './grim_warden-kit';
import { clods, driftMotes, dust, eyeLight, shards, soulBurst, soulFlame, whirlTrail } from './grim_warden-fx';

export const W = 104;
export const H = 98;
/** Floor line: the lowest row of the boots and of the halberd's butt. */
export const GY = 94;
/** Anchor x (between the boots). */
export const AX = 46;
/** The planted butt of the halberd (bottom-left pixel of its ferrule). */
export const BUTT: Pt = [26, GY];
/** Halberd: haft length below the far hand / above it to the head's socket. */
export const H_DN = 40;
export const H_UP = 30;

const DEG = Math.PI / 180;
const rnd = Math.round;
const sin = Math.sin;
const cos = Math.cos;

// ---------------------------------------------------------------- pose

export interface Pose {
  /** body drop (px; the boots stay), the upper body's forward lean (px), breath (px, + = down) */
  sink: number;
  lean: number;
  chy: number;
  /** helm offset from the neck (px), helm tilt (deg, − = thrown back; 0 in every walking pose), eye 0…1.5, eye scan (px) */
  hx: number;
  hy: number;
  hr: number;
  eye: number;
  eyeDx: number;
  /** lantern arm: the fist relative to the near shoulder (px) */
  ax: number;
  ay: number;
  /** chain angle from straight down (deg, + = the lantern swings forward / right), chain length (px) */
  la: number;
  cl: number;
  /** soul flame 0…1.5, its shape seed, its lean against the swing (−1…1) */
  fl: number;
  fs: number;
  flLean: number;
  /** halberd: angle (deg, −90 = straight up), planted at BUTT (pin) or held at the far hand (gx, gy from the pelvis) */
  ha: number;
  pin: boolean;
  gx: number;
  gy: number;
  /** far hand slides along the haft (px, + = up toward the head) */
  hs: number;
  /** the halberd and the far arm cross in FRONT of the body (guard, the sweep) */
  hFront: boolean;
  /** offset of a pinned butt from BUTT (px): lifted for a stamp, sliding as it falls in death */
  bx: number;
  by: number;
  /** boot offsets (px; negative y = lifted): near / far */
  f1x: number;
  f1y: number;
  f2x: number;
  f2y: number;
  /** shroud: hem swing (px, + = forward), wave phase 0…1, extra length (px), tatter phase 0…1, hood tip lag (px), wrapped forward 0…1 */
  capeA: number;
  capeT: number;
  capeL: number;
  ragT: number;
  hood: number;
  wrap: number;
  /** whirl trail of the lantern: centre offset from the fist, from / to angle (deg), 0 = none */
  trail: number;
  trA: number;
  trB: number;
  /** soul burst at the lantern 0…1 (age; 0 = none) / its size */
  burst: number;
  burstR: number;
  /** motes rising off the lantern 0…1 (phase; < 0 = none) */
  mote: number;
  /** floor dust 0…1 (age; 0 = none) at x */
  dust: number;
  dustX: number;
  /** rising out of / sinking into the floor (px below the floor line, cut there); earth clods 0…1 */
  oy: number;
  clod: number;
  /** death: the shroud collapses empty 0…1; the helm drops off 0…1 (to the floor, tilting); the lantern falls 0…1 and lies broken (> 0.99) */
  col: number;
  helmOff: number;
  lanDrop: number;
  /** shard spray of the broken lantern 0…1 (age; 0 = none) */
  shard: number;
  /** a magic blow: soul fire flashes through the cage bars 0…1 */
  zap: number;
  /** one-shot phase 0…1 */
  t: number;
}

export const NEUTRAL: Pose = {
  sink: 0,
  lean: 0,
  chy: 0,
  hx: 0,
  hy: 0,
  hr: 0,
  eye: 1,
  eyeDx: 0,
  ax: 21,
  ay: 1,
  la: 0,
  cl: 9,
  fl: 1,
  fs: 0,
  flLean: 0,
  ha: -84,
  pin: true,
  gx: -15,
  gy: -17,
  hs: 0,
  hFront: false,
  bx: 0,
  by: 0,
  f1x: 0,
  f1y: 0,
  f2x: 0,
  f2y: 0,
  capeA: 0,
  capeT: 0,
  capeL: 0,
  ragT: 0,
  hood: 0,
  wrap: 0,
  trail: 0,
  trA: 0,
  trB: 0,
  burst: 0,
  burstR: 10,
  mote: -1,
  dust: 0,
  dustX: 80,
  oy: 0,
  clod: 0,
  col: 0,
  helmOff: 0,
  lanDrop: 0,
  shard: 0,
  zap: 0,
  t: 0,
};
export const pose = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

// ---------------------------------------------------------------- skeleton

export interface Skel {
  R: Pt;
  C: Pt;
  N: Pt;
  S: Pt;
  Sh1: Pt;
  Sh2: Pt;
  E1: Pt;
  E2: Pt;
  Hn: Pt;
  Hf: Pt;
  A1: Pt;
  A2: Pt;
  /** chain top (under the fist), lantern ring (chain end), lantern box origin (top-left of the 9×14 map) */
  K0: Pt;
  K1: Pt;
  Lo: Pt;
  /** halberd: butt, head socket, unit direction up the haft */
  hb: Pt;
  hh: Pt;
  hd: Pt;
}

function pick(a: Pt, b: Pt, l1: number, l2: number, px: number, py: number): Pt {
  const j1 = ik2(a, b, l1, l2, 1);
  const j2 = ik2(a, b, l1, l2, -1);
  return j1[0] * px + j1[1] * py >= j2[0] * px + j2[1] * py ? j1 : j2;
}

export const LANT_W = 9;
export const LANT_H = 14;

export function skeleton(o: Pose): Skel {
  const col = o.col;
  const R: Pt = [46, 70 + o.sink];
  const C: Pt = [46 + o.lean, 47 + o.sink + o.chy + col * 30];
  const N: Pt = [C[0] + 3 + o.lean * 0.3, C[1] - 9];
  const S: Pt = [rnd(N[0] + 3 + o.hx), rnd(N[1] - 7 + o.hy)];
  const Sh1: Pt = [C[0] + 7, C[1] - 5];
  const Sh2: Pt = [C[0] - 6, C[1] - 4];
  const Hn: Pt = [Sh1[0] + o.ax, Sh1[1] + o.ay];
  const E1 = pick(Sh1, Hn, 12, 12, 0.15, 1);
  const A1: Pt = [53 + o.f1x, GY - 2 + o.f1y];
  const A2: Pt = [40 + o.f2x, GY - 2 + o.f2y];
  // the chain hangs from the bottom of the fist; the lantern hangs from the chain's end (never below the floor line)
  // the lantern's centre sits on the chain's line, so a whirled lantern flies OUTWARD from the fist
  const K0: Pt = [Hn[0] + 1, Hn[1] + 3];
  const ldx = sin(o.la * DEG);
  const ldy = cos(o.la * DEG);
  const K1: Pt = [K0[0] + ldx * o.cl, K0[1] + ldy * o.cl];
  const lc: Pt = [K0[0] + ldx * (o.cl + 7), Math.min(GY - 8, K0[1] + ldy * (o.cl + 7))];
  const Lo: Pt = [rnd(lc[0]) - 4, rnd(lc[1]) - 7];
  // halberd: planted at BUTT (the far hand slides to wherever the haft passes), or swung from the far hand
  const hd: Pt = [cos(o.ha * DEG), sin(o.ha * DEG)];
  let hb: Pt;
  let Hf: Pt;
  if (o.pin) {
    hb = [BUTT[0] + 1 + o.bx, BUTT[1] - 1 + o.by];
    Hf = [hb[0] + hd[0] * (H_DN + o.hs), hb[1] + hd[1] * (H_DN + o.hs)];
  } else {
    Hf = [R[0] + o.gx, R[1] + o.gy];
    hb = [Hf[0] - hd[0] * (H_DN + o.hs), Hf[1] - hd[1] * (H_DN + o.hs)];
  }
  const hh: Pt = [hb[0] + hd[0] * (H_DN + H_UP), hb[1] + hd[1] * (H_DN + H_UP)];
  const E2 = pick(Sh2, Hf, 11, 11, -0.6, 0.8);
  return { R, C, N, S, Sh1, Sh2, E1, E2, Hn, Hf, A1, A2, K0, K1, Lo, hb, hh, hd };
}

// ---------------------------------------------------------------- frame helpers

const enum Part {
  none = 0,
  tatters,
  halberd,
  armF,
  handF,
  legs,
  body,
  belt,
  mantle,
  hood,
  helm,
  brim,
  armN,
  handN,
  chain,
  lantern,
}

interface Frame {
  p: PixelCanvas;
  comp: Comp;
  light: Light;
  o: Pose;
  sk: Skel;
  after: ((p: PixelCanvas) => void)[];
}

const layer = () => kitLayer(W, H);
const HAND_FAR: Tones = { L: PAL.earth2, M: PAL.earth1, S: PAL.earth0, D: PAL.ink };
const P = (v: Pt): Pt => [rnd(v[0]), rnd(v[1])];
const wave = (o: Pose, t: number, ph: number) => sin((o.capeT - t * 0.6 + ph) * Math.PI * 2);

function limb(f: Frame, a: Pt, b: Pt, w0: number, w1: number, t: Tones, part: Part, sep = true): void {
  const q = layer();
  q.poly(ribbon([a, b], (k) => lerp(w0, w1, k)), t.M);
  q.disc(a[0], a[1], w0 / 2, t.M);
  q.disc(b[0], b[1], w1 / 2, t.M);
  bands(q, t, f.light, 1, 1);
  f.comp.add(q, part, { out: sep ? t.D : undefined });
}

/** Cloth planes for a shroud part: a 1-px lit edge toward the light, a fold band away from it, a deep fold line. */
function clothBands(q: PixelCanvas, t: Tones, light: Light, folds: ((x: number, y: number) => boolean) | null = null, litW = 2): void {
  const ls = light.side;
  planes(q, (x, y, src) => {
    let toL = 0;
    while (toL < litW + 1 && src.isOpaque(x + ls * (toL + 1), y)) toL++;
    let up = 0;
    while (up < 2 && src.isOpaque(x, y - up - 1)) up++;
    if (toL < litW || (up < 1 && toL < litW + 3)) return t.L;
    if (folds && folds(x, y)) return t.S;
    let away = 0;
    while (away < 3 && src.isOpaque(x - ls * (away + 1), y)) away++;
    let dn = 0;
    while (dn < 3 && src.isOpaque(x, y + dn + 1)) dn++;
    if (away < 2 || dn < 1) return t.S;
    return t.M;
  });
}

// ---------------------------------------------------------------- back tatters (behind everything)

function paintTatters(f: Frame): void {
  const { o, sk } = f;
  const col = o.col;
  if (col > 0.85) return;
  const q = layer();
  // three wide strips torn from the back of the shroud, streaming back (left) and down on their own waves
  const roots: Pt[] = [
    [sk.C[0] - 6, sk.C[1] + 2],
    [sk.C[0] - 8, sk.C[1] + 14],
    [sk.R[0] - 10, sk.R[1] + 6],
  ];
  roots.forEach((a, i) => {
    const len = [17, 19, 14][i] * (1 - col * 0.6);
    const w1 = wave(o, 0.35 + i * 0.3, i * 0.29);
    const w2 = wave(o, 0.85 + i * 0.3, i * 0.29 + 0.18);
    const m: Pt = [a[0] - len * 0.5 + o.capeA * 0.4, a[1] + 3 + i + w1 * 1.6];
    const b: Pt = [a[0] - len + o.capeA * 0.8 + w2 * 1.5, Math.min(GY - 8, a[1] + 7 + i * 2 + w2 * 2.6)];
    const path = spline([a, m, b], 5);
    q.poly(ribbon(path, (k) => lerp(7 - i, 3, k)), SHROUD.M);
    // a forked tip: two ≥ 2-px teeth
    const bx = rnd(b[0]);
    const by = rnd(b[1]);
    q.rect(bx - 2, by - 1, 2, 3, SHROUD.M);
    q.rect(bx, by + 1, 2, 2, SHROUD.M);
  });
  // behind the body: the far tone set, but its lit top edge reads against the dark arena
  planes(q, (x, y, src) => (!src.isOpaque(x, y - 1) ? SHROUD.M : src.isOpaque(x, y + 1) && src.isOpaque(x, y + 2) ? SHROUD_FAR.M : SHROUD_FAR.S));
  f.comp.add(q, Part.tatters, { out: SHROUD.D });
}

// ---------------------------------------------------------------- halberd (spade + crescent hook)

function paintHalberd(f: Frame): void {
  const { sk, light, o } = f;
  const [dx, dy] = sk.hd;
  // perpendicular toward the halberd's front (the hook side): right of "up"
  const nx = -dy;
  const ny = dx;
  const loc = (u: number, v: number): Pt => [sk.hb[0] + dx * u + nx * v, sk.hb[1] + dy * u + ny * v];
  const L = H_DN + H_UP;
  // haft
  const hq = layer();
  hq.poly(ribbon([loc(1, 0), loc(L + 1, 0)], () => 3), WOOD.M);
  bands(hq, WOOD, light, 1, 1);
  f.comp.add(hq, Part.halberd, { out: WOOD.D });
  // iron ferrule at the butt (the planted point)
  const fq = layer();
  if (o.pin && o.bx === 0 && o.by === 0) {
    const [bx, by] = BUTT;
    fq.rect(bx, by - 4, 3, 5, IRON.M);
  } else fq.poly(ribbon([loc(-1, 0), loc(4, 0)], () => 3.4), IRON.M);
  bands(fq, IRON_FAR, light, 1, 1);
  f.comp.add(fq, Part.halberd, { out: IRON.D });
  // socket rings
  const sq = layer();
  sq.poly(ribbon([loc(L - 4, 0), loc(L + 1, 0)], () => 4.4), IRON.M);
  bands(sq, IRON, light, 1, 1);
  f.comp.add(sq, Part.halberd, { out: IRON.D });
  // the crescent hook: a curved tooth on the front side, below the spade
  const kq = layer();
  kq.poly([loc(L - 7, 1), loc(L - 5, 4), loc(L - 6, 7.5), loc(L - 9, 9), loc(L - 8, 6.5), loc(L - 9, 3.5), loc(L - 10, 1)], IRON.M);
  bands(kq, IRON, light, 1, 1);
  f.comp.add(kq, Part.halberd, { out: IRON.D });
  // the spade blade: a pointed shovel, rounded shoulders, a darker hollow down its middle
  const bq = layer();
  const blade: Pt[] = [[0, -2.5], [1.5, -4.6], [6, -4.8], [10.5, -3.2], [13.5, -0.8], [14.5, 0], [13.5, 0.8], [10.5, 3.2], [6, 4.8], [1.5, 4.6], [0, 2.5]];
  bq.poly(blade.map(([u, v]) => loc(L + 1 + u, v)), IRON.M);
  const lit = nx * light.v2[0] + ny * light.v2[1] > 0 ? 1 : -1;
  planes(bq, (x, y, s) => {
    const rx = x + 0.5 - sk.hb[0];
    const ry = y + 0.5 - sk.hb[1];
    const u = rx * dx + ry * dy - (L + 1);
    const v = (rx * nx + ry * ny) * lit;
    let edgeOut = 0;
    for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (!s.isOpaque(x + ex, y + ey)) edgeOut++;
    if (edgeOut && v > 0.5) return PAL.stone4;
    if (Math.abs(v) < 1 && u > 2 && u < 11) return IRON.S;
    if (v < -2.2) return IRON.S;
    return v > 1 ? IRON.L : IRON.M;
  });
  f.comp.add(bq, Part.halberd, { out: IRON.D });
}

// ---------------------------------------------------------------- arms, hands

function paintSleeve(f: Frame, far: boolean): void {
  const { sk, o } = f;
  if (o.col > (far ? 0.5 : 0.7)) return;
  const t = far ? SHROUD_FAR : SHROUD;
  const Sh = far ? sk.Sh2 : sk.Sh1;
  const E = far ? sk.E2 : sk.E1;
  const Hd = far ? sk.Hf : sk.Hn;
  const part = far ? Part.armF : Part.armN;
  const q = layer();
  // upper arm and forearm: thin tubes of shroud cloth (the bone inside is never seen)
  q.poly(ribbon([Sh, E], (k) => lerp(6, 5, k)), t.M);
  q.disc(E[0], E[1], 2.5, t.M);
  const wr: Pt = [lerp(E[0], Hd[0], 0.8), lerp(E[1], Hd[1], 0.8)];
  q.poly(ribbon([E, wr], (k) => lerp(5, 7, k)), t.M);
  // the bell of the sleeve hangs from the forearm's underside in ragged teeth, lagging the arm
  const sway = o.capeA * 0.25 + wave(o, 0.3, far ? 0.5 : 0.1) * 1.3;
  const droop = (far ? 6 : 8) + o.col * 3;
  const fx = wr[0] - E[0];
  const fy = wr[1] - E[1];
  const fl = Math.hypot(fx, fy) || 1;
  // underside normal (pointing down)
  let ux = -fy / fl;
  let uy = fx / fl;
  if (uy < 0) {
    ux = -ux;
    uy = -uy;
  }
  const at = (k: number, d: number): Pt => [E[0] + fx * k + ux * d - sway * (d / droop), E[1] + fy * k + uy * d];
  q.poly([at(0.1, 1), at(1.05, 1), at(1.05, droop - 1), at(0.85, droop + 1), at(0.7, droop - 2), at(0.5, droop), at(0.35, droop - 3), at(0.15, 2)], t.M);
  clothBands(q, t, f.light, null, 1);
  f.comp.add(q, part, { out: t.D });
}

/** A bony fist (near) gripping the chain, or the far hand wrapped on the haft. */
function paintHand(f: Frame, far: boolean): void {
  const { sk, o } = f;
  if (o.col > (far ? 0.5 : 0.7)) return;
  const t = far ? HAND_FAR : HAND;
  const q = layer();
  const [x, y] = P(far ? sk.Hf : sk.Hn);
  if (far) {
    q.rect(x - 2, y - 2, 4, 5, t.M);
    q.rect(x + 2, y - 1, 1, 3, t.M);
  } else {
    // knuckles forward, the thumb on top, the chain leaving between the fingers below
    q.rect(x - 2, y - 2, 5, 4, t.M);
    q.rect(x + 3, y - 1, 1, 3, t.M);
    q.rect(x - 1, y + 2, 3, 1, t.M);
  }
  bands(q, t, f.light, 1, 1);
  if (!far) {
    q.set(x + 1, y, t.D);
    q.set(x + 1, y + 1, t.D);
  } else q.set(x, y, t.D);
  f.comp.add(q, far ? Part.handF : Part.handN, { out: t.D });
}

// ---------------------------------------------------------------- boots + shins

function paintLegs(f: Frame): void {
  const { sk, o } = f;
  if (o.col > 0.6) return;
  for (const [A, far] of [[sk.A2, true], [sk.A1, false]] as const) {
    const it = far ? IRON_FAR : IRON;
    const bt = far ? BONE_FAR : BONE;
    // a bony shin wrapped in rags (barely seen under the hem)
    const top: Pt = [A[0] - 1, A[1] - 10];
    limb(f, top, [A[0], A[1] - 2], 3, 3, bt, Part.legs);
    // the iron-shod boot: a heavy toe-cap pointing right, a cuff
    const q = layer();
    const [x, y] = P(A);
    q.poly([[x - 4, y - 3], [x + 2, y - 3], [x + 6, y], [x + 6, y + 2], [x - 4, y + 2]], it.M);
    q.rect(x - 4, y - 5, 6, 2, it.M);
    bands(q, it, f.light, 1, 1);
    f.comp.add(q, Part.legs, { out: it.D });
  }
}

// ---------------------------------------------------------------- shroud body + mantle + belt

function hemY(o: Pose): number {
  return GY - 13 + o.capeL;
}

function paintBody(f: Frame): void {
  const { o, sk, light } = f;
  const col = o.col;
  const q = layer();
  const top = sk.C[1] - 7;
  const hem = Math.max(top + 8, hemY(o) + col * 7);
  const cx = sk.C[0];
  const spread = col * 14;
  const left = (t: number) => lerp(cx - 7, sk.R[0] - 14 - spread, Math.pow(t, 1.25)) + o.capeA * Math.pow(t, 1.4) * 0.8 + wave(o, t, 0) * 1.6 * t;
  const right = (t: number) => lerp(cx + 7, sk.R[0] + 12 + spread * 0.8, Math.pow(t, 1.5)) + o.capeA * Math.pow(t, 1.4) * 0.5 + wave(o, t, 0.25) * 0.9 * t + o.wrap * 3 * t;
  const pts: Pt[] = [];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([left(t), lerp(top, hem, t)]);
  }
  // torn hem: ≥ 2-px teeth whose depth breathes with the tatter phase
  const x0 = left(1);
  const x1 = right(1);
  const nt = 7;
  for (let i = 0; i < nt; i++) {
    const a = lerp(x0, x1, i / nt);
    const b = lerp(x0, x1, (i + 1) / nt);
    const d = 2.5 + 1.5 * (1 + sin((o.ragT + i * 0.23) * Math.PI * 2)) + (i % 2) * 2;
    pts.push([a + 0.5, hem]);
    pts.push([(a + b) / 2, Math.min(GY - 7 + (col > 0 ? 5 : 0), hem + d)]);
  }
  pts.push([x1, hem]);
  for (let i = n; i >= 0; i--) {
    const t = i / n;
    pts.push([right(t), lerp(top, hem, t)]);
  }
  q.poly(pts, SHROUD.M);
  // folds: two long valleys falling from the belt, waving with the cloth
  const foldX = (t: number, k: number) => lerp(left(t), right(t), k) + 1.2 * sin((o.capeT - t * 0.7 + k) * Math.PI * 2);
  clothBands(q, SHROUD, light, (x, y) => {
    const t = (y - top) / Math.max(1, hem - top);
    if (t < 0.42) return false;
    return Math.abs(x - foldX(t, 0.38)) < 0.8 || Math.abs(x - foldX(t, 0.68)) < 0.8;
  });
  // the shroud is torn into strips near the hem: the deepest fold opens into a dark slit
  planes(q, (x, y) => {
    const t = (y - top) / Math.max(1, hem - top);
    return t > 0.8 && Math.abs(x - foldX(t, 0.68)) < 0.6 ? SHROUD.D : null;
  });
  f.comp.add(q, Part.body);
  // rope belt with the warden's key ring hanging at the front
  if (col < 0.5) {
    const by = rnd(sk.C[1] + 13);
    const b = layer();
    b.rect(rnd(left(0.45)) + 1, by, rnd(right(0.45) - left(0.45)) - 1, 2, WOOD.M);
    bands(b, WOOD, light, 1, 1);
    f.comp.add(b, Part.belt, { out: WOOD.D });
    const k = layer();
    const kx = rnd(right(0.45)) - 4 + rnd(o.capeA * 0.3);
    k.rect(kx, by + 2, 1, 2, IRON.S);
    k.rect(kx - 1, by + 4, 3, 3, IRON.M);
    k.set(kx, by + 5, PAL.stone0);
    k.rect(kx + 1, by + 6, 2, 1, IRON.M);
    k.rect(kx + 2, by + 7, 1, 2, IRON.M);
    bands(k, IRON, light, 1, 1);
    f.comp.add(k, Part.belt, { out: IRON.D });
  }
}

/** The mantle: the hood's cape over the hunched shoulders, ending in ragged teeth over the chest. */
function paintMantle(f: Frame): void {
  const { o, sk, light } = f;
  const q = layer();
  const [cx, cy] = sk.C;
  const lw = wave(o, 0.2, 0.15);
  const pts: Pt[] = [
    [cx - 9, cy - 3],
    [cx - 6, cy - 9],
    [cx + 2, cy - 11],
    [cx + 9, cy - 8],
    [cx + 11, cy - 3],
    [cx + 10, cy + 3],
    [cx + 7, cy + 7 + lw],
    [cx + 5, cy + 4],
    [cx + 2, cy + 8 - lw],
    [cx - 1, cy + 4],
    [cx - 4, cy + 7 + lw],
    [cx - 7, cy + 3],
    [cx - 10, cy + 4],
  ];
  q.poly(pts, SHROUD.M);
  clothBands(q, SHROUD, light, null, 2);
  // the collapsed shroud is EMPTY: the hood's dark opening gapes on top of the heap, its lip lit
  if (o.col > 0.6) {
    const hx = rnd(cx + 4);
    const hy = rnd(cy - 6);
    planes(q, (x, y) => {
      const dx = (x - hx) / 3.6;
      const dy = (y - hy) / 2;
      const d = dx * dx + dy * dy;
      if (d <= 1) return PAL.void0;
      if (d <= 2 && y <= hy) return SHROUD.L;
      return null;
    });
  }
  f.comp.add(q, Part.mantle, { out: SHROUD.D });
}

// ---------------------------------------------------------------- hood + cage helm

/**
 * The cage helm (15×13, facing right), built as a map: iron meridian bars (b) and bands (I: the top ring, brow, jaw
 * and chin bands) closing over a skull (s) seen between them; the dark socket (o) where the one eye burns, a nostril
 * (n), teeth (t / g gaps) behind the jaw band, a back plate over the nape (P), the knob on top (k).
 */
const HELM_PROFILE: readonly (readonly [number, number])[] = [
  [6, 7], [4, 10], [2, 12], [1, 13], [1, 14], [0, 14], [0, 14], [0, 14], [1, 14], [1, 13], [2, 13], [3, 12], [4, 11],
];
const HELM_BANDS = new Set([1, 5, 9, 12]);
const HELM_BARS = new Set([4, 7, 10, 13]);
const HELM: readonly string[] = HELM_PROFILE.map(([l, r], v) => {
  let row = '';
  for (let u = 0; u < 15; u++) {
    let ch = '.';
    if (u >= l && u <= r) {
      if (v === 0) ch = 'k';
      else if (HELM_BANDS.has(v)) ch = 'I';
      else if (u <= 2) ch = 'P';
      else if (HELM_BARS.has(u)) ch = 'b';
      else if (v >= 6 && v <= 7 && (u === 8 || u === 9)) ch = 'o';
      else if (v === 7 && u === 11) ch = 'n';
      else if (v >= 10) ch = u % 2 ? 'g' : 't';
      else ch = 's';
    }
    row += ch;
  }
  return row;
});
const HELM_CX = 7;
const HELM_CY = 6;
/** The socket the eye burns in (map coords of its top-left cell; 2×2). */
const SOCK_U = 8;
const SOCK_V = 6;

/** Helm origin (map top-left) in frame px, and its tilt; a dropped helm leaves the hood. */
function helmPlace(o: Pose, sk: Skel): { x: number; y: number; rot: number } {
  let x = sk.S[0] - HELM_CX;
  let y = sk.S[1] - HELM_CY;
  let rot = o.hr;
  if (o.helmOff > 0) {
    const k = o.helmOff;
    const fx = sk.S[0] + 12;
    const fy = GY - 8;
    x = rnd(lerp(x, fx - HELM_CX, k));
    y = rnd(lerp(y, fy - HELM_CY, k * k));
    rot = lerp(o.hr, 80, Math.min(1, k * 1.2));
  }
  return { x, y, rot };
}

function helmCell(u: number, v: number): string {
  const r = HELM[v];
  if (!r) return '.';
  return r[u] ?? '.';
}

function paintHelm(f: Frame): void {
  const { o, sk, light } = f;
  const hp = helmPlace(o, sk);
  const q = layer();
  const cells = new Map<number, string>();
  const rot = hp.rot * DEG;
  const c = cos(rot);
  const s = sin(rot);
  const ox = hp.x + HELM_CX;
  const oy = hp.y + HELM_CY;
  const uv = (x: number, y: number): [number, number] => {
    const dx = x - ox;
    const dy = y - oy;
    return [rnd(dx * c + dy * s) + HELM_CX, rnd(-dx * s + dy * c) + HELM_CY];
  };
  for (let y = oy - 11; y <= oy + 11; y++)
    for (let x = ox - 11; x <= ox + 11; x++) {
      const [u, v] = uv(x, y);
      const ch = helmCell(u, v);
      if (ch === '.') continue;
      cells.set(y * W + x, ch);
      q.set(x, y, IRON.M);
    }
  // bars: the bar on the lit side pale, the rest mid / shade; bands: lit top row, shade under; the skull inside: one
  // value dimmer than the teeth, its cranium lit toward the light; the nape plate shaded away from the light
  planes(q, (x, y) => {
    const ch = cells.get(y * W + x)!;
    const [u, v] = uv(x, y);
    const toward = light.side < 0 ? 14 - u : u; // 0 at the lit edge
    void toward;
    const litU = light.side < 0 ? u <= 6 : u >= 8;
    switch (ch) {
      case 'o':
      case 'g':
        return PAL.void0;
      case 'n':
        return PAL.earth0;
      case 't':
        return v === 10 ? BONE.L : BONE.M;
      case 's':
        if (v <= 4) return litU ? BONE.M : BONE_FAR.M;
        return v === 8 ? BONE_FAR.S : litU ? BONE_FAR.M : BONE_FAR.S;
      case 'b':
        return litU ? (v <= 4 ? IRON.L : IRON.M) : IRON.S;
      case 'P':
        return litU ? IRON.M : IRON.S;
      case 'k':
        return IRON.L;
      default: {
        // a band: lit on the light's half, shaded on the far half; the chin band in shade
        if (v === 12) return IRON.S;
        return litU ? IRON.L : IRON.M;
      }
    }
  });
  f.comp.add(q, Part.helm, { out: IRON.D });
  // a magic blow: the soul fire flashes through the bars (light, after the outline)
  if (o.zap > 0) {
    const bars: Pt[] = [];
    for (const [k, ch] of cells) if (ch === 'b' || (ch === 'I' && o.zap > 0.6)) bars.push([k % W, Math.floor(k / W)]);
    const col = o.zap > 0.6 ? PAL.leaf4 : PAL.leaf3;
    f.after.push((p) => {
      for (const [x, y] of bars) if (f.comp.id[y * W + x] === Part.helm) p.set(x, y, col);
    });
  }
  // the one eye: it burns in the socket and scans (0 / +1 px, a glance down on +2)
  if (o.helmOff < 0.5 && o.eye > 0.08) {
    const du = Math.min(1, Math.max(0, rnd(o.eyeDx)));
    const dv = rnd(o.eyeDx) >= 2 ? 1 : 0;
    const eu = SOCK_U + du;
    const ev = SOCK_V + dv;
    const ex = ox + rnd((eu - HELM_CX) * c - (ev - HELM_CY) * s);
    const ey = oy + rnd((eu - HELM_CX) * s + (ev - HELM_CY) * c);
    f.after.push((p) => eyeLight(p, ex, ey, o.eye, du === 0 ? 2 : 1));
  }
}

/** Hood: the deep cowl behind the helm (its dark opening frames the cage), and its brim over the helm's brow. */
function paintHood(f: Frame, front: boolean): void {
  const { o, sk, light } = f;
  if (o.helmOff > 0.15 && front) return;
  const [sx, sy] = sk.S;
  const sw = o.hood + wave(o, 0.1, 0.35) * 0.8;
  if (!front) {
    if (o.col > 0.9) return;
    const q = layer();
    // the cowl: a pointed hood, its tip falling back over the shoulders and lagging the head
    q.poly([[sx - 10, sy + 10], [sx - 12, sy + 1], [sx - 11 + sw * 0.5, sy - 6], [sx - 16 + sw, sy - 9], [sx - 13 + sw, sy - 12], [sx - 4, sy - 13], [sx + 3, sy - 12], [sx + 9, sy - 8], [sx + 10, sy - 2], [sx + 7, sy + 6], [sx + 1, sy + 10]], SHROUD.M);
    clothBands(q, SHROUD, light, null, 2);
    f.comp.add(q, Part.hood, { out: SHROUD.D });
    // the dark opening the helm sits deep in
    const d = layer();
    d.poly([[sx - 7, sy + 7], [sx - 8, sy - 3], [sx - 4, sy - 9], [sx + 3, sy - 9], [sx + 8, sy - 5], [sx + 9, sy + 2], [sx + 6, sy + 8]], PAL.void0);
    f.comp.add(d, Part.hood);
  } else {
    // the brim: a heavy fold of cloth across the top of the cage, its lip lit
    const q = layer();
    q.poly([[sx - 8, sy - 10], [sx - 2, sy - 12], [sx + 4, sy - 11], [sx + 10, sy - 6], [sx + 10, sy - 3], [sx + 6, sy - 6], [sx - 1, sy - 7], [sx - 7, sy - 5]], SHROUD.M);
    clothBands(q, SHROUD, light, null, 1);
    f.comp.add(q, Part.brim, { out: SHROUD.D });
  }
}

// ---------------------------------------------------------------- chain + lantern

/** Lantern map (9×14): I iron, g glass, . empty. */
const LANTERN: readonly string[] = [
  '...III...',
  '...I.I...',
  '..IIIII..',
  '.IIIIIII.',
  'IIIIIIIII',
  '.IgggggI.',
  '.IgggggI.',
  '.IgggggI.',
  '.IgggggI.',
  '.IgggggI.',
  '.IgggggI.',
  'IIIIIIIII',
  '.IIIIIII.',
  '...III...',
];
/** The broken lantern lying on the floor (roof knocked aside, glass gone). */
const LANTERN_BROKEN: readonly string[] = [
  '.....III....',
  '..IIIIII....',
  'IIIIIIIIgg..',
  '.IIIIIIIggI.',
];

function lanternOrigin(o: Pose, sk: Skel): Pt {
  if (o.lanDrop <= 0) return sk.Lo;
  const k = Math.min(1, o.lanDrop);
  const fy = GY - LANT_H;
  return [rnd(lerp(sk.Lo[0], sk.Lo[0] + 4, k)), rnd(lerp(sk.Lo[1], fy, k * k))];
}

function paintChain(f: Frame): void {
  const { o, sk } = f;
  if (o.lanDrop > 0.05) {
    // a short end of chain dangles from the fist
    const q = layer();
    for (let i = 0; i < 3; i++) q.rect(rnd(sk.K0[0]) - (i % 2), rnd(sk.K0[1]) + i * 2, 1 + (i % 2), 2, IRON.S);
    f.comp.add(q, Part.chain);
    return;
  }
  const lo = lanternOrigin(o, sk);
  const a = sk.K0;
  // the chain meets the lantern's ring on the side facing the fist
  const lcx = lo[0] + 4;
  const lcy = lo[1] + 7;
  const dl = Math.hypot(a[0] - lcx, a[1] - lcy) || 1;
  const b: Pt = [lcx + ((a[0] - lcx) / dl) * 7, lcy + ((a[1] - lcy) / dl) * 7];
  const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
  const q = layer();
  // links: alternating 2×1 / 1×2 iron bits along the chain (oriented link pairs read as a chain at 1×)
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = rnd(lerp(a[0], b[0], t));
    const y = rnd(lerp(a[1], b[1], t));
    if (i % 2) q.rect(x, y, 1, 2, IRON.M);
    else q.rect(x - 1, y, 2, 1, IRON.S);
  }
  f.comp.add(q, Part.chain);
}

function paintLantern(f: Frame): void {
  const { o, sk, light } = f;
  const q = layer();
  if (o.lanDrop > 0.99) {
    const x0 = sk.Lo[0] + 2;
    const y0 = GY - 3;
    LANTERN_BROKEN.forEach((r, v) => {
      for (let u = 0; u < r.length; u++) if (r[u] !== '.') q.set(x0 + u, y0 + v, r[u] === 'g' ? PAL.leaf1 : IRON.M);
    });
    bands(q, IRON, light, 1, 1);
    f.comp.add(q, Part.lantern, { out: IRON.D });
    return;
  }
  const [x0, y0] = lanternOrigin(o, sk);
  LANTERN.forEach((r, v) => {
    for (let u = 0; u < r.length; u++) if (r[u] !== '.') q.set(x0 + u, y0 + v, r[u] === 'g' ? PAL.leaf1 : IRON.M);
  });
  planes(q, (x, y, src) => {
    const u = x - x0;
    const v = y - y0;
    const ch = LANTERN[v]?.[u];
    if (ch === 'g') return PAL.leaf1;
    if (v <= 1) return IRON.M;
    // roof: lit slope toward the light, shade on the far slope; posts: lit post / shade post
    const lsU = light.side < 0 ? 0 : 8;
    if (v <= 4) return Math.abs(u - lsU) < 4 ? IRON.L : u === 4 ? IRON.M : IRON.S;
    if (v <= 10) return (light.side < 0 ? u <= 1 : u >= 7) ? IRON.L : IRON.S;
    void src;
    return v === 11 ? IRON.M : IRON.S;
  });
  f.comp.add(q, Part.lantern, { out: IRON.D });
  const fl = o.lanDrop > 0 ? o.fl * (1 - o.lanDrop * 0.4) : o.fl;
  const comp = f.comp;
  f.after.push((p) => soulFlame(p, x0 + 2, y0 + 5, x0 + 6, y0 + 10, fl, o.fs, o.flLean, (x, y) => comp.id[y * W + x] === Part.lantern));
}

// ---------------------------------------------------------------- floor effects

function paintPit(p: PixelCanvas, o: Pose): void {
  if (o.oy <= 0) return;
  // the open grave the warden climbs out of: a dark slot with a lit soul-green lip, earth rim
  const rx = 18;
  const ry = 2;
  p.ellipse(AX, GY - 1, rx + 2, ry + 1, PAL.earth1);
  p.ellipse(AX, GY - 1, rx, ry, PAL.ink);
  p.ellipse(AX, GY - 1, rx - 3, ry - 1, PAL.void0);
  p.ellipseRing(AX, GY - 1, rx, ry, o.oy > 30 ? PAL.leaf1 : PAL.leaf2);
}

// ---------------------------------------------------------------- soul light on the body

/**
 * The lantern's green spills on what is near it: the 1-px edge of cloth / bone / iron that faces the lantern (its
 * outline neighbour lies toward the glass) takes one stepped green tone, the nearest a brighter one. Flat palette
 * steps, no gradient (IŞ-7 kin: a second, coloured rim on the lantern's side only); strength follows the flame.
 */
function soulBounce(f: Frame): void {
  const { p, o, sk, comp } = f;
  if (o.fl < 0.5 || o.lanDrop > 0.3) return;
  const lo = lanternOrigin(o, sk);
  const lx = lo[0] + 4;
  const ly = lo[1] + 8;
  const R = 9 + o.fl * 9;
  const x0 = Math.max(1, Math.floor(lx - R));
  const x1 = Math.min(W - 2, Math.ceil(lx + R));
  const y0 = Math.max(1, Math.floor(ly - R));
  const y1 = Math.min(H - 2, Math.ceil(ly + R));
  const hits: [number, number, number][] = [];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const id = comp.id[y * W + x];
      if (!id || id === Part.lantern || id === Part.chain) continue;
      const c = p.get(x, y);
      if (c === null || c === PAL.ink || c === PAL.void0) continue;
      const dx = lx - x;
      const dy = ly - y;
      const d = Math.hypot(dx, dy);
      if (d > R || d < 1) continue;
      const sx = Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0;
      const sy = sx === 0 ? Math.sign(dy) : 0;
      if (p.get(x + sx, y + sy) !== PAL.ink) continue;
      hits.push([x, y, d < R * 0.3 ? PAL.leaf2 : PAL.leaf1]);
    }
  for (const [x, y, c] of hits) p.set(x, y, c);
}

// ---------------------------------------------------------------- the frame

function drawBody(p: PixelCanvas, o: Pose, lightFrom: 'left' | 'right'): void {
  const light = lightOf(lightFrom);
  const sk = skeleton(o);
  const f: Frame = { p, comp: new Comp(p), light, o, sk, after: [] };
  const farSide = () => {
    paintHalberd(f);
    paintSleeve(f, true);
    paintHand(f, true);
  };
  // a lantern whirled behind the head passes BEHIND the body
  const lBack = o.la <= -40 && o.la >= -170 && o.lanDrop <= 0;
  paintTatters(f);
  if (lBack) {
    paintChain(f);
    paintLantern(f);
  }
  if (!o.hFront) farSide();
  paintLegs(f);
  paintBody(f);
  paintMantle(f);
  if (o.helmOff <= 0) paintHood(f, false);
  paintHelm(f);
  paintHood(f, true);
  if (o.hFront) farSide();
  paintSleeve(f, false);
  if (!lBack) paintChain(f);
  paintHand(f, false);
  if (!lBack) paintLantern(f);
  p.outline(PAL.ink);
  soulBounce(f);
  for (const fn of f.after) fn(p);
  // effects (never outlined)
  const lo = lanternOrigin(o, sk);
  const lc: Pt = [lo[0] + 4, lo[1] + 8];
  if (o.trail > 0) whirlTrail(p, sk.K0[0], sk.K0[1], o.cl + 7, o.cl + 6, o.trA * DEG, o.trB * DEG);
  if (o.mote >= 0) driftMotes(p, lc[0], lo[1] + 2, o.mote, 7, 2, 5);
  if (o.burst > 0) soulBurst(p, lc[0], lc[1], o.burst, o.burstR, 5 + rnd(o.burst * 10));
  if (o.shard > 0) shards(p, lc[0], GY - 4, GY, o.shard, 9);
}

export function drawWarden(p: PixelCanvas, o: Pose, lightFrom: 'left' | 'right' = 'left'): void {
  paintPit(p, o);
  if (o.oy === 0) drawBody(p, o, lightFrom);
  else {
    const q = new PixelCanvas(W, H);
    drawBody(q, o, lightFrom);
    // the body rises out of / sinks into the floor: shifted down by oy, cut at the floor line
    for (let y = 0; y <= GY; y++) {
      const sy = y - o.oy;
      if (sy < 0) continue;
      for (let x = 0; x < W; x++) {
        const c = q.get(x, sy);
        if (c !== null) p.set(x, y, c);
      }
    }
  }
  if (o.clod > 0) clods(p, AX, GY - 1, o.clod, 3);
  if (o.dust > 0) dust(p, o.dustX, GY - 1, o.dust, 4, 1);
  // the floor swallows effects that fall below it (Sİ-2 bottom margin); the sides are kept honest by the gates
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (y > GY + 1 && p.isOpaque(x, y)) p.erase(x, y);
}
