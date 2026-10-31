// Kutup İğnesi v3 — the "compass-needle dancer" rig: Pose → pixels.
//
// A tall, thin, long-legged duelist whose torso IS a vertical compass needle: a two-faceted magnetite lozenge with an
// orange N tip (fire) that carries the head like a pivot pin, a gold pivot gem at the chest and a blue S tip (water)
// that pokes down between the thighs. Small magnetite helm with one gold visor slit; above it a compass-rose crown
// spins on a pin (four points on an iso ring, N fire / S water). In the near hand a short spear made of the SAME
// needle (fire point forward, water butt back); the far arm is held high behind in a fencer's line. Thin legs on
// pointed sabatons, gold rings at every joint. Iron dust runs along the field lines from the N to the S tip.
//
//   - every hard part is a flat polygon / tube shaded by flat value planes (the needle by facet: the facet facing
//     the key light is lit with a 1-px ridge highlight, the other facet carries a shade band — IŞ-3);
//   - hard parts move by WHOLE pixels and never rotate as sprites; limbs are 2-link IK tubes (geometry); the rose
//     and the spinning spear are drawn per phase on an iso ellipse (pixel frames);
//   - ONE key light from the screen's top-left: `light` = the frame edge it comes from ('left' P1, 'right' the P2
//     relight sheet, mirrored by flipX it is lit from the top-left again). Planes are chosen per light;
//   - light (visor, pole tips, pivot, field lines, iron dust, flare, sparks) is painted after the outline and never
//     outlined (IŞ-9).
// Frame 80×84; 1 art px = 1 game px; the root R is the ground point between the feet.
// Reuse (Kutup Hükümdarı): `drawSpear`, `drawNeedleArm` and the kit's `needle` / `rose` are the sovereign's arms +
// compass spear + crown; their sizes here (spear 16 + 12 px, arm 9 + 10 px) are the sovereign's region sizes.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ik2, lightOf, type Light } from '../rigkit';
import {
  Comp, DEG, FIRE, cleanCrumbs, GOLD, GOLD_FAR, MAG, MAG_FAR, WATER, bands, needle, rose, rosePin, taperPoly, tubePoly, type Pt, type Tones,
} from './polar_needle-kit';

export const W = 80;
export const H = 84;
export const RX = 30;
export const GY = 79;

export const enum Part {
  none = 0,
  roseB,
  armF,
  legF,
  legN,
  pelvis,
  torso,
  head,
  roseF,
  pauldron,
  armN,
  spear,
  fx,
}

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rnd = Math.round;
const fl = Math.floor;

// ---------------------------------------------------------------- pose

export interface Pose {
  /** whole-body sink (px, + down); legs bend more */
  py: number;
  /** pelvis x shift (the lunge carries the hips forward) */
  px: number;
  /** torso (needle) offset over the pelvis, and the N tip's lean (px, + toward the opponent) */
  tx: number;
  ty: number;
  lean: number;
  /** head offset over the N tip */
  hx: number;
  hy: number;
  /** visor 0 dark … 1 gold … 2 white; lid 0 open, 1 half, 2 shut */
  eye: number;
  lid: number;
  /** rose crown: spin phase (turns), presence 0…1 (0 = folded on the pin), glow 0…3, extra lift (px) */
  rose: number;
  roseK: number;
  roseG: number;
  roseY: number;
  /** near (spear) hand target and far hand target, relative to R */
  nx: number;
  ny: number;
  fx: number;
  fy: number;
  /** spear: screen angle (deg, 0 = toward the opponent, −90 up); spin = 1: compass mode, yaw (deg) on the iso plane */
  sa: number;
  spin: number;
  yaw: number;
  /** spear dropped: 1 = free at (spx, spy) relative to R, angle sa */
  sfree: number;
  spx: number;
  spy: number;
  /** feet: x shifts and lifts (px); toe 1 = en pointe (both feet on their tips) */
  nfx: number;
  nfl: number;
  ffx: number;
  ffl: number;
  toe: number;
  /** pole glow of the torso tips (0…3), of the spear point (0…3), poles swapped (hitMagic) */
  poleN: number;
  poleS: number;
  tip: number;
  flip: number;
  /** field-line arcs N → S (0 none … 2 blazing), their flow phase 0…1; iron dust phase (−1 none) and amount */
  field: number;
  fph: number;
  dust: number;
  dustK: number;
  /** attack: spear smear (release frame), tip flare 0…1, sparks phase (0 none) */
  smear: number;
  flare: number;
  spark: number;
  /** 1-px plate tremble (alternating), hitMagic static 0…1 */
  shake: number;
  zap: number;
  /** death: the needle ripped out — 0 seated, 1 torn (drawn at rx/ry offset and ra deg tilt), 2 gone (streak only) */
  rip: number;
  rx: number;
  ry: number;
  ra: number;
  /** death / revive: the shell loosens (plate gaps px), head drop (px), pauldrons drop (px) */
  gap: number;
  hdrop: number;
  pdrop: number;
  /** summon: drop streak above (0 none…1), spin trail arc (deg span, 0 none), landing ring 0…1 */
  streak: number;
  trail: number;
  ring: number;
  /** dissolve front 0…1; gather = dissolve run backwards (revive) */
  diss: number;
  gather: boolean;
  /** the anim's one metal glint: 0 none, 1 = 1 px, 2 = 3-px cross (at the spear collar) */
  glint: number;
  /** global phase 0…1 */
  t: number;
}

export const NEUTRAL: Pose = {
  py: 0, px: 0, tx: 0, ty: 0, lean: 0, hx: 0, hy: 0,
  eye: 1, lid: 0,
  rose: 0, roseK: 1, roseG: 1, roseY: 0,
  nx: 15, ny: -38, fx: -15, fy: -60,
  sa: -8, spin: 0, yaw: 0, sfree: 0, spx: 0, spy: 0,
  nfx: 0, nfl: 0, ffx: 0, ffl: 0, toe: 0,
  poleN: 1, poleS: 1, tip: 1, flip: 0,
  field: 0, fph: 0, dust: -1, dustK: 1,
  smear: 0, flare: 0, spark: 0, shake: 0, zap: 0,
  rip: 0, rx: 0, ry: 0, ra: 0, gap: 0, hdrop: 0, pdrop: 0,
  streak: 0, trail: 0, ring: 0,
  diss: 0, gather: false, glint: 0, t: 0,
};
export const pose = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

// ---------------------------------------------------------------- skeleton

export interface Skel {
  base: Pt;
  pel: Pt;
  /** torso pivot (seated) and the drawn needle's pivot / axis (ripped in death) */
  C: Pt;
  nc: Pt;
  nd: Pt;
  ntip: Pt;
  stip: Pt;
  head: Pt;
  rose: Pt;
  sh1: Pt;
  sh2: Pt;
  el1: Pt;
  w1: Pt;
  el2: Pt;
  w2: Pt;
  hip1: Pt;
  hip2: Pt;
  kn1: Pt;
  kn2: Pt;
  an1: Pt;
  an2: Pt;
  /** spear pivot, axis (unit, toward the point), lengths (foreshortened in compass mode), point */
  sc: Pt;
  sd: Pt;
  sN: number;
  sS: number;
  spt: Pt;
  eye: Pt;
}

export const TORSO_N = 17;
export const TORSO_S = 20;
export const SPEAR_N = 16;
export const SPEAR_S = 12;

const reach = (a: Pt, b: Pt, len: number): Pt => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy);
  return d <= len ? b : [a[0] + (dx / d) * len, a[1] + (dy / d) * len];
};

export function skeleton(o: Pose): Skel {
  const base: Pt = [RX, GY + o.py];
  const pel: Pt = [RX + o.px, base[1] - 25];
  const C: Pt = [pel[0] + o.tx, pel[1] - 15 + o.ty];
  const dl = Math.hypot(o.lean, TORSO_N);
  const d0: Pt = [o.lean / dl, -TORSO_N / dl];
  const ntip0: Pt = [C[0] + d0[0] * TORSO_N, C[1] + d0[1] * TORSO_N];
  let nc = C;
  let nd = d0;
  if (o.rip > 0) {
    nc = [C[0] + o.rx, C[1] + o.ry];
    nd = [Math.sin(o.ra * DEG), -Math.cos(o.ra * DEG)];
  }
  const ntip: Pt = [nc[0] + nd[0] * TORSO_N, nc[1] + nd[1] * TORSO_N];
  const stip: Pt = [nc[0] - nd[0] * TORSO_S, nc[1] - nd[1] * TORSO_S];
  const head: Pt = [ntip0[0] + 1 + o.hx, ntip0[1] - 5 + o.hy + o.hdrop];
  const roseC: Pt = [head[0], head[1] - 9 - o.roseY];
  // the shoulders hang on the needle's upper collar: they take only the lean beyond a px and half the breath
  const sl = Math.trunc(o.lean * 0.6);
  const sb = Math.trunc(o.ty * 0.5);
  const sh1: Pt = [C[0] + 2 + sl, C[1] - o.ty + sb - 13 + o.pdrop];
  const sh2: Pt = [C[0] - 3 + sl, C[1] - o.ty + sb - 14 + o.pdrop];
  const w1 = reach(sh1, [RX + o.nx, GY + o.ny], 18.6);
  const el1 = ik2(sh1, w1, 9, 10, 1) as Pt;
  const w2 = reach(sh2, [RX + o.fx, GY + o.fy], 18.6);
  const el2 = ik2(sh2, w2, 9, 10, -1) as Pt;
  const hip1: Pt = [pel[0] + 3, pel[1]];
  const hip2: Pt = [pel[0] - 3, pel[1] - 1];
  const lift = o.toe > 0 ? 3 : 0;
  const an1: Pt = [RX + 6 + o.nfx, GY - 3 - lift - o.nfl];
  const an2: Pt = [RX - 7 + o.ffx, GY - 3 - lift - o.ffl];
  const kn1 = ik2(hip1, an1, 12, 12, -1) as Pt;
  const kn2 = ik2(hip2, an2, 12, 12, -1) as Pt;
  // spear
  let sc: Pt;
  let sd: Pt;
  let sN = SPEAR_N;
  let sS = SPEAR_S;
  if (o.spin > 0) {
    const cx = Math.cos(o.yaw * DEG);
    const sy = Math.sin(o.yaw * DEG) * 0.42;
    const m = Math.hypot(cx, sy) || 1;
    sd = [cx / m, sy / m];
    sN = SPEAR_N * m;
    sS = SPEAR_S * m;
    sc = w1;
  } else {
    sd = [Math.cos(o.sa * DEG), Math.sin(o.sa * DEG)];
    sc = o.sfree > 0 ? [RX + o.spx, GY + o.spy] : [w1[0] + sd[0] * 2, w1[1] + sd[1] * 2];
  }
  const spt: Pt = [sc[0] + sd[0] * sN, sc[1] + sd[1] * sN];
  return {
    base, pel, C, nc, nd, ntip, stip, head, rose: roseC, sh1, sh2, el1, w1, el2, w2, hip1, hip2, kn1, kn2, an1, an2,
    sc, sd, sN, sS, spt,
    eye: [head[0] + 2, head[1] - 1],
  };
}

// ---------------------------------------------------------------- frame

export interface Frame {
  p: PixelCanvas;
  comp: Comp;
  light: Light;
  o: Pose;
  sk: Skel;
}

const layer = () => new PixelCanvas(W, H);

// ---------------------------------------------------------------- reusable parts (exported for the sovereign)

/** The compass spear (a short needle: fire point, water butt, gold collar at the grip) as its own layer. */
export function drawSpear(c: Pt, d: Pt, lenN: number, lenS: number, light: Light, o: { flip?: boolean; far?: boolean; smear?: number; half?: 1 | -1; w?: number; h?: number } = {}): PixelCanvas {
  const q = new PixelCanvas(o.w ?? W, o.h ?? H);
  const spec = { c, d, lenN, lenS, hw: 2.2, band: 1.5, flip: o.flip, far: o.far, collar: true, half: o.half };
  needle(q, spec, light);
  if (o.smear && o.smear > 0) {
    // HA-12: the release smear — the needle stretched 2 px back along its own axis (part of the body, outlined with it)
    const g = new PixelCanvas(q.w, q.h);
    needle(g, { ...spec, c: [c[0] - d[0] * 2, c[1] - d[1] * 2] }, light);
    for (let y = 0; y < q.h; y++) for (let x = 0; x < q.w; x++) if (!q.isOpaque(x, y) && g.isOpaque(x, y)) q.set(x, y, (o.flip ? WATER : FIRE).M);
  }
  return q;
}

/** A thin needle arm (shoulder → elbow → wrist), gold elbow ring and cuff, as its own layer. */
export function drawNeedleArm(sh: Pt, el: Pt, w: Pt, light: Light, far: boolean, size: { w?: number; h?: number } = {}): PixelCanvas {
  const t: Tones = far ? MAG_FAR : MAG;
  const g = far ? GOLD_FAR : GOLD;
  const q = new PixelCanvas(size.w ?? W, size.h ?? H);
  q.poly(taperPoly(sh, el, 5, 4), t.M);
  q.poly(taperPoly(el, w, 4, 3), t.M);
  bands(q, t, light, 2, 1, { rim: !far });
  // elbow ring and cuff (gold)
  q.disc(rnd(el[0] - 0.5), rnd(el[1] - 0.5), 1.6, g.M);
  q.set(rnd(el[0] - 0.5) + (light.side < 0 ? -1 : 0), rnd(el[1] - 0.5) - 1, g.L);
  const cx = el[0] + (w[0] - el[0]) * 0.8;
  const cy = el[1] + (w[1] - el[1]) * 0.8;
  q.poly(tubePoly([cx - (w[0] - el[0]) * 0.08, cy - (w[1] - el[1]) * 0.08], [cx + (w[0] - el[0]) * 0.08, cy + (w[1] - el[1]) * 0.08], 4.4), g.M);
  return q;
}

// ---------------------------------------------------------------- body parts

function drawLeg(f: Frame, near: boolean): void {
  const { sk, o, light } = f;
  const hip = near ? sk.hip1 : sk.hip2;
  const kn = near ? sk.kn1 : sk.kn2;
  const an = near ? sk.an1 : sk.an2;
  const t = near ? MAG : MAG_FAR;
  const g = near ? GOLD : GOLD_FAR;
  const q = layer();
  q.poly(taperPoly(hip, kn, 6, 4.4), t.M);
  q.poly(taperPoly(kn, an, 4.4, 3), t.M);
  bands(q, t, light, 2, 1, { rim: near });
  // greave plate: a steel-edged shin guard on the light side
  const sg = layer();
  sg.poly(taperPoly([kn[0] + (an[0] - kn[0]) * 0.2, kn[1] + (an[1] - kn[1]) * 0.2], [kn[0] + (an[0] - kn[0]) * 0.7, kn[1] + (an[1] - kn[1]) * 0.7], 5, 3.6), t.L);
  bands(sg, { H: t.H, L: t.H, M: t.L, S: t.M }, light, 1, 1);
  q.blit(sg, 0, 0);
  // sabaton: a pointed dancer's foot (flat: toe forward; en pointe: the point under the ankle)
  const fy = GY - (near ? o.nfl : o.ffl);
  const ax = an[0];
  const ay = an[1];
  if (o.toe > 0) q.poly([[ax - 2, ay - 1], [ax + 2, ay - 1], [ax + 1, fy], [ax, fy]], t.L);
  else q.poly([[ax - 2, ay - 1], [ax + 2, ay - 1], [ax + 7, fy], [ax - 2, fy]], t.M);
  bands(q, t, light, 2, 1);
  f.comp.add(q, near ? Part.legN : Part.legF, { out: PAL.stone1 });
  // gold knee ring and ankle ring
  const k = layer();
  k.disc(rnd(kn[0] - 0.5), rnd(kn[1] - 0.5), 2, g.M);
  k.set(rnd(kn[0] - 0.5) + (light.side < 0 ? -1 : 1), rnd(kn[1] - 0.5) - 1, g.L);
  k.rect(rnd(ax) - 2, rnd(ay) - 2, 4, 1, g.M);
  f.comp.add(k, near ? Part.legN : Part.legF, { out: g.S });
}

function drawPelvis(f: Frame): void {
  const { sk, light } = f;
  const [px, py] = sk.pel;
  const q = layer();
  // a gold ring round the needle's S shank and two magnetite hip discs
  q.poly([[px - 5, py - 3], [px + 5, py - 3], [px + 6, py + 1], [px - 6, py + 1]], MAG.M);
  bands(q, MAG, light, 2, 1);
  for (let x = px - 5; x <= px + 5; x++) q.set(x, py - 3, GOLD.L).set(x, py - 2, GOLD.M);
  f.comp.add(q, Part.pelvis, { out: PAL.stone1 });
}

function drawTorso(f: Frame): void {
  const { sk, o, light } = f;
  if (o.rip >= 2) return;
  const q = layer();
  needle(q, { c: sk.nc, d: sk.nd, lenN: TORSO_N, lenS: TORSO_S, hw: 6, band: 3, flip: o.flip > 0, collar: true, pivot: 2 }, light);
  // plate shudder: a hinge seam across the waist opens a px (gap) in death
  if (o.gap > 0 && o.rip === 0) {
    const [cx, cy] = sk.nc;
    for (let x = rnd(cx) - 7; x <= rnd(cx) + 7; x++) if (q.isOpaque(x, rnd(cy) + 5)) q.set(x, rnd(cy) + 5, PAL.stone1);
  }
  f.comp.add(q, Part.torso, { out: PAL.stone1 });
}

function drawHead(f: Frame): void {
  const { sk, o, light } = f;
  const [hx, hy] = [rnd(sk.head[0]), rnd(sk.head[1])];
  const q = layer();
  // a close helm whose visor comes to a needle point toward the foe
  q.poly([[hx - 3, hy - 5], [hx + 2, hy - 5], [hx + 4, hy - 3], [hx + 5, hy - 1], [hx + 7, hy], [hx + 4, hy + 2], [hx + 1, hy + 4], [hx - 3, hy + 4], [hx - 4, hy + 2], [hx - 4, hy - 3]], MAG.M);
  bands(q, MAG, light, 2, 2, { rim: true });
  // visor well (the slit the eye light sits in) + a gold brow line
  for (let x = hx; x <= hx + 5; x++) if (q.isOpaque(x, hy - 1)) q.set(x, hy - 1, PAL.stone1);
  for (let x = hx - 2; x <= hx + 3; x++) if (q.isOpaque(x, hy - 3)) q.set(x, hy - 3, x <= hx ? GOLD.L : GOLD.M);
  void o;
  f.comp.add(q, Part.head, { out: PAL.stone1 });
}

function drawRose(f: Frame, front: boolean): void {
  const { sk, o, light } = f;
  if (o.roseK <= 0) return;
  const q = layer();
  const k = clamp(o.roseK, 0, 1);
  const [cx, cy] = [rnd(sk.rose[0]), rnd(sk.rose[1])];
  if (!front) {
    // the pin from the helm to the rose
    for (let y = cy + 1; y <= rnd(sk.head[1]) - 6; y++) q.set(cx, y, GOLD.S);
  }
  rose(q, { cx, cy, phase: o.rose, rx: Math.max(1, rnd(6 * k)), ry: Math.max(1, rnd(2.6 * k)), arm: k > 0.5 ? 2 : 1, ring: true, flip: o.flip > 0 }, front, light);
  if (front) rosePin(q, cx, cy, light);
  f.comp.add(q, front ? Part.roseF : Part.roseB, {});
}

function drawPauldron(f: Frame, near: boolean): void {
  const { sk, light } = f;
  const [sx, sy] = near ? sk.sh1 : sk.sh2;
  const t = near ? MAG : MAG_FAR;
  const g = near ? GOLD : GOLD_FAR;
  const q = layer();
  q.ellipse(rnd(sx), rnd(sy) - 1, near ? 3 : 2, 2, t.M);
  bands(q, t, light, 2, 1, { rim: near });
  for (let x = rnd(sx) - 3; x <= rnd(sx) + 3; x++) if (q.isOpaque(x, rnd(sy) + 1)) q.set(x, rnd(sy) + 1, g.M);
  f.comp.add(q, Part.pauldron, { out: PAL.stone1 });
}

function drawArm(f: Frame, near: boolean): void {
  const { sk, light } = f;
  const q = near ? drawNeedleArm(sk.sh1, sk.el1, sk.w1, light, false) : drawNeedleArm(sk.sh2, sk.el2, sk.w2, light, true);
  f.comp.add(q, near ? Part.armN : Part.armF, { out: PAL.stone1 });
}

function spearLayer(f: Frame, half?: 1 | -1): PixelCanvas {
  const { sk, o, light } = f;
  return drawSpear(sk.sc, sk.sd, sk.sN, sk.sS, light, { flip: o.flip > 0, smear: o.smear, half });
}

// ---------------------------------------------------------------- light layer

function poleLight(f: Frame): void {
  const { p, o, sk } = f;
  const dot = (x: number, y: number, c: number) => { if (x >= 0 && y >= 0 && x < W && y < H) p.set(x, y, c); };
  const tipAt = (pt: Pt, d: Pt, g: number, hot: number, cool: number) => {
    if (g <= 0.05) return;
    const x = rnd(pt[0] - 0.5 - d[0] * 0.8);
    const y = rnd(pt[1] - 0.5 - d[1] * 0.8);
    dot(x, y, g >= 2 ? PAL.white : hot);
    if (g >= 1.5) dot(rnd(x - d[0]), rnd(y - d[1]), hot);
    if (g >= 2.4) {
      dot(rnd(x + d[0] * 2), rnd(y + d[1] * 2), cool);
      dot(rnd(x - d[1] * 2), rnd(y + d[0] * 2), cool);
      dot(rnd(x + d[1] * 2), rnd(y - d[0] * 2), cool);
    }
  };
  const fN = o.flip > 0;
  if (o.rip < 2) {
    tipAt(sk.ntip, sk.nd, o.poleN, fN ? PAL.water4 : PAL.fire4, fN ? PAL.water3 : PAL.gold4);
    tipAt(sk.stip, [-sk.nd[0], -sk.nd[1]], o.poleS, fN ? PAL.fire4 : PAL.water4, fN ? PAL.gold4 : PAL.water3);
    // the pivot gem
    if (o.diss < 0.6) {
      const [cx, cy] = [rnd(sk.nc[0] - 0.5), rnd(sk.nc[1] - 0.5)];
      dot(cx, cy, o.poleN >= 2 ? PAL.white : PAL.gold4);
    }
  }
  if (o.spin === 0 || Math.cos(o.yaw * DEG) > -0.2) tipAt(sk.spt, sk.sd, o.tip, fN ? PAL.water4 : PAL.fire4, fN ? PAL.water3 : PAL.gold4);
}

function eyeLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.eye <= 0.05 || o.lid >= 2) return;
  if (o.spin > 0 && Math.cos(o.yaw * DEG) < -0.35) return;
  const [ex, ey] = [rnd(sk.eye[0]), rnd(sk.eye[1])];
  const off = o.spin > 0 ? rnd(Math.cos(o.yaw * DEG) * 2) - 2 : 0;
  const col = o.eye >= 1.8 ? PAL.white : o.eye >= 1.2 ? PAL.gold4 : PAL.gold3;
  const n = o.lid === 1 ? 2 : 3;
  for (let i = 0; i < n; i++) p.set(ex + off + i - (o.lid === 1 ? 0 : 1) + 1, ey, i === n - 1 ? col : o.eye >= 1.8 ? PAL.gold4 : PAL.gold3);
}

/** Field lines: two dotted loops from the N tip round to the S tip, flowing N → S; fire on the N half, water on the S. */
function fieldLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.field <= 0 || o.rip >= 2) return;
  const [nx, ny] = sk.ntip;
  const [sx, sy] = sk.stip;
  const lv = o.field;
  const loops = lv >= 1.5 ? [1, 0.62] : [1];
  for (const k of loops)
    for (const side of [-1, 1]) {
      const R = (9 + 5 * Math.min(lv, 2)) * k;
      const n = 46;
      for (let i = 1; i < n; i++) {
        const u = i / n;
        if (((i + fl(o.fph * 6) * side) % 3 + 3) % 3 === 0) continue;
        const bx = nx + (sx - nx) * u;
        const by = ny + (sy - ny) * u;
        const x = rnd(bx + side * Math.sin(Math.PI * u) * R);
        const y = rnd(by);
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || p.isOpaque(x, y)) continue;
        const flipC = o.flip > 0;
        const hot = lv >= 1.5 && i % 2 === 0;
        const c = u < 0.5 !== flipC ? (hot ? PAL.fire4 : PAL.fire3) : hot ? PAL.water4 : PAL.water3;
        p.set(x, y, c);
      }
    }
}

/** Iron dust: short 2-px grains running along the field loops (idle: the family's living detail). */
function dustLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.dust < 0 || o.rip >= 2) return;
  const [nx, ny] = sk.ntip;
  const [sx, sy] = sk.stip;
  const n = rnd(3 * o.dustK);
  for (const side of [-1, 1])
    for (let i = 0; i < n; i++) {
      const u = (o.dust + i / n + (side > 0 ? 0.17 : 0)) % 1;
      if (u < 0.12 || u > 0.9) continue;
      const R = 11 + (i % 2) * 3;
      const bx = nx + (sx - nx) * u;
      const by = ny + (sy - ny) * u;
      const x = rnd(bx + side * Math.sin(Math.PI * u) * R);
      const y = rnd(by);
      const c = i % 2 ? PAL.stone4 : PAL.steel;
      for (const dx of [0, side]) if (!p.isOpaque(x + dx, y)) p.set(x + dx, y, c);
    }
}

function flareLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.flare <= 0) return;
  const x = rnd(sk.spt[0] - 0.5);
  const y = rnd(sk.spt[1] - 0.5);
  const k = o.flare;
  p.rect(x - 1, y - 1, 3, 3, PAL.white);
  const L = k > 0.6 ? 4 : 2;
  for (let i = 2; i <= L; i++) {
    const c = i < 3 ? PAL.fire4 : PAL.gold4;
    p.set(x + i, y, c).set(x - i, y, c).set(x, y - i, c).set(x, y + i, c);
  }
  if (k > 0.6) p.set(x + 2, y - 2, PAL.fire4).set(x + 2, y + 2, PAL.water4).set(x - 2, y - 2, PAL.water4).set(x - 2, y + 2, PAL.fire4);
}

export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function sparkLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.spark <= 0) return;
  const ph = o.spark;
  const cx = o.flare > 0 || o.smear > 0 ? sk.spt[0] : sk.nc[0];
  const cy = o.flare > 0 || o.smear > 0 ? sk.spt[1] : sk.nc[1] - 6;
  for (let i = 0; i < 6; i++) {
    const a = hash2(i, 3, 7) * TAU;
    const d = 2 + ph * (5 + hash2(i, 9, 2) * 7);
    const x = rnd(cx + Math.cos(a) * d);
    const y = rnd(cy + Math.sin(a) * d * 0.8 + ph * ph * 5);
    if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
    p.set(x, y, ph < 0.4 ? PAL.white : i % 2 ? PAL.fire4 : PAL.water4);
    if (ph < 0.7) p.set(x + (Math.cos(a) > 0 ? 1 : -1), y, i % 2 ? PAL.fire3 : PAL.water3);
  }
}

/** hitMagic: short static arcs crawl over the needle (fire / water alternating: the poles fighting). */
function zapLight(f: Frame): void {
  const { p, comp, o, sk } = f;
  if (o.zap <= 0) return;
  const ph = fl(o.t * 16);
  const starts: [number, number, number][] = [
    [sk.nc[0], sk.nc[1] - 10, 0],
    [sk.nc[0], sk.nc[1] + 8, 1],
    [sk.head[0], sk.head[1], 2],
    [sk.el1[0], sk.el1[1], 3],
  ];
  for (const [x0, y0, k] of starts) {
    const len = rnd(3 + 5 * o.zap);
    let x = rnd(x0);
    let y = rnd(y0);
    for (let i = 0; i < len; i++) {
      const j = hash2(i, ph, k * 13 + 5);
      const a = (j - 0.5) * 2.4 + (k % 2 ? Math.PI : 0) + Math.PI / 2;
      x += rnd(Math.cos(a) * 1.5);
      y += rnd(Math.sin(a) * 1.5);
      if (x < 0 || y < 0 || x >= W || y >= H || !p.isOpaque(x, y) || comp.id[y * W + x] === Part.none) continue;
      p.set(x, y, i === 0 ? PAL.white : (i + k) % 2 ? PAL.fire4 : PAL.water4);
    }
  }
}

/** Summon: the vertical drop streak above the needle and the spin trail of the compass spear. */
function motionLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.streak > 0 && o.rip >= 2) {
    // death: the torn needle is gone off the top-left — its two-colour wake still hangs in the air
    const x0 = rnd(sk.C[0] + o.rx);
    const y0 = rnd(sk.C[1] + o.ry);
    const n = rnd(16 * o.streak);
    for (let i = 0; i < n; i++) {
      const x = x0 - i;
      const y = y0 - rnd(i * 0.55);
      if (x < 2 || y < 2) break;
      if (!p.isOpaque(x, y)) p.set(x, y, i < n / 2 ? PAL.fire4 : PAL.fire2);
      if (!p.isOpaque(x + 1, y + 2)) p.set(x + 1, y + 2, i < n / 2 ? PAL.water4 : PAL.water2);
    }
  } else if (o.streak > 0) {
    // the vertical drop: speed lines down both flanks (fire on the N side, water on the S side) and one over the crown
    const top = Math.max(2, rnd(sk.head[1]) - 12);
    const bot = rnd(sk.nc[1]) + rnd(14 * o.streak);
    for (const [dx, c0, c1, y0] of [[-7, PAL.fire3, PAL.fire2, top + 6], [8, PAL.water3, PAL.water2, top + 2], [-10, PAL.mist, PAL.steel, top + 14], [11, PAL.mist, PAL.steel, top + 10]] as const) {
      const x = rnd(sk.nc[0]) + dx;
      for (let y = y0; y <= bot - Math.abs(dx); y++) if (!p.isOpaque(x, y)) p.set(x, y, y < y0 + (bot - y0) * 0.45 ? c1 : c0);
    }
    const x = rnd(sk.head[0]);
    for (let y = 2; y < rnd(sk.head[1]) - 6; y++) if (!p.isOpaque(x, y)) p.set(x, y, y > 5 ? PAL.white : PAL.mist);
  }
  if (o.trail !== 0 && o.spin > 0) {
    // the iso arc the spear's two ends just swept (only where nothing is drawn: it reads behind the body)
    const [cx, cy] = sk.w1;
    const steps = Math.max(6, rnd(Math.abs(o.trail) / 6));
    for (let i = 1; i <= steps; i++) {
      const a = (o.yaw - (o.trail * i) / steps) * DEG;
      for (const [len, hot, cool, sgn] of [[SPEAR_N - 1, PAL.fire3, PAL.fire2, 1], [SPEAR_S - 1, PAL.water3, PAL.water2, -1]] as const) {
        const x = rnd(cx + sgn * Math.cos(a) * len);
        const y = rnd(cy + sgn * Math.sin(a) * len * 0.42);
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || p.isOpaque(x, y)) continue;
        p.set(x, y, i <= steps / 2 ? hot : cool);
      }
    }
  }
  if (o.ring > 0) {
    // landing: an iron-dust ring snaps out on the floor round the tip
    const rx = 4 + o.ring * 18;
    const ry = rx * 0.42;
    const n = rnd(rx * 5);
    for (let i = 0; i < n; i++) {
      if (i % 5 === 4) continue;
      const a = (i / n) * TAU;
      const x = rnd(RX + Math.cos(a) * rx);
      const y = rnd(GY - 1 + Math.sin(a) * ry);
      if (y >= H - 2 || y < 1 || x < 1 || x >= W - 1 || p.isOpaque(x, y)) continue;
      p.set(x, y, o.ring < 0.5 ? (Math.cos(a) < 0 ? PAL.fire4 : PAL.water4) : Math.cos(a) < 0 ? PAL.fire2 : PAL.water2);
    }
  }
}

function glintLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.glint <= 0) return;
  // the spear collar: the one metal glint of the anim (IŞ-8)
  const x = rnd(sk.sc[0] - 0.5 + sk.sd[0] * 3);
  const y = rnd(sk.sc[1] - 0.5 + sk.sd[1] * 3) - 2;
  p.set(x, y, PAL.white);
  if (o.glint >= 2) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) p.set(x + dx, y + dy, PAL.gold4);
}

// ---------------------------------------------------------------- dissolve / gather (2×2 clusters, top first: plates fall)

function dissolvePass(f: Frame): void {
  const { p, comp, o } = f;
  if (o.diss <= 0) return;
  const front = 0.1;
  const gone: number[] = [];
  const mark: number[] = [];
  const debris: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!p.isOpaque(x, y)) continue;
      const rx = x - RX;
      const ry = y - GY;
      const cx = fl(rx / 2);
      const cy = fl(ry / 2);
      const u = clamp((ry + 64) / 66, 0, 1);
      const thr = 0.8 * u + 0.2 * hash2(cx, cy, 7);
      if (thr < o.diss - front) {
        gone.push(x, y);
        if (!o.gather && (rx & 1) === 0 && (ry & 1) === 0 && hash2(cx, cy, 11) < 0.22) {
          const fall = 2 + (o.diss - front - thr) * 70;
          if (fall < 24) {
            const yy = Math.min(GY - 1, y + rnd(fall));
            const h = hash2(cx, cy, 19);
            debris.push(x + rnd(Math.sin(cy * 1.7 + fall * 0.2) * 2), yy, h < 0.6 ? (fall < 9 ? PAL.stone3 : PAL.stone2) : h < 0.8 ? PAL.gold2 : PAL.stone1);
          }
        }
      } else if (thr < o.diss) mark.push(x, y);
    }
  for (let i = 0; i < gone.length; i += 2) {
    p.erase(gone[i], gone[i + 1]);
    comp.id[gone[i + 1] * W + gone[i]] = Part.none;
  }
  for (let i = 0; i < mark.length; i += 2) {
    if (p.get(mark[i], mark[i + 1]) === PAL.ink) continue;
    p.set(mark[i], mark[i + 1], o.gather ? ((fl((mark[i] - RX) / 2) + fl((mark[i + 1] - GY) / 2)) & 1 ? PAL.fire4 : PAL.water4) : PAL.steel);
  }
  for (let i = 0; i < debris.length; i += 3) if (!p.isOpaque(debris[i], debris[i + 1])) p.rect(debris[i], debris[i + 1], 2, 2, debris[i + 2]);
}

// ---------------------------------------------------------------- draw

export function drawNeedle(p: PixelCanvas, o: Pose, lightFrom: 'left' | 'right'): void {
  if (o.spin > 0 && Math.cos(o.yaw * DEG) < -0.15) {
    // pirouette: while the compass turns its back on the foe, the dancer faces the other way — the same rig drawn
    // with the opposite light and mirrored about the root (pixel-exact; the key light stays at the top-left)
    const q = new PixelCanvas(W, H);
    drawNeedle(q, { ...o, yaw: 180 - o.yaw, trail: -o.trail }, lightFrom === 'left' ? 'right' : 'left');
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c = q.get(x, y);
        const mx = 2 * RX - x;
        if (c !== null && mx >= 0 && mx < W) p.set(mx, y, c);
      }
    return;
  }
  const light = lightOf(lightFrom);
  const sk = skeleton(o);
  const comp = new Comp(p);
  const f: Frame = { p, comp, light, o, sk };
  // compass mode: each half of the spear sits in front of / behind the body by its yaw
  const nFront = o.spin > 0 ? Math.sin(o.yaw * DEG) > 0 : true;

  drawRose(f, false);
  drawArm(f, false);
  drawPauldron(f, false);
  drawLeg(f, false);
  if (o.sfree > 0) comp.add(spearLayer(f), Part.spear, { out: PAL.stone1 });
  if (o.spin > 0) comp.add(spearLayer(f, nFront ? -1 : 1), Part.spear, { out: PAL.stone1 });
  drawLeg(f, true);
  drawPelvis(f);
  drawTorso(f);
  drawHead(f);
  drawRose(f, true);
  drawPauldron(f, true);
  drawArm(f, true);
  if (o.spin > 0) comp.add(spearLayer(f, nFront ? 1 : -1), Part.spear, { out: PAL.stone1 });
  if (o.spin === 0 && o.sfree === 0) comp.add(spearLayer(f), Part.spear, { out: PAL.stone1 });
  if (o.shake > 0) {
    // 1-px plate tremble: the helm and pauldron rows jump alternately (whole px, restored geometry)
    const dy = o.shake === 1 ? -1 : 1;
    const src = p.clone();
    for (let y = 1; y < H - 1; y++)
      for (let x = 0; x < W; x++) {
        const id = comp.id[y * W + x];
        if (id === Part.head || id === Part.pauldron) p.erase(x, y);
      }
    for (let y = 1; y < H - 1; y++)
      for (let x = 0; x < W; x++) {
        const id = comp.id[y * W + x];
        if (id === Part.head || id === Part.pauldron) { const c = src.get(x, y); if (c !== null) p.set(x, y + dy, c); }
      }
  }

  cleanCrumbs(p);
  p.outline(PAL.ink);
  dissolvePass(f);

  // light layer
  if (o.diss < 0.7 || o.gather) {
    poleLight(f);
    eyeLight(f);
  }
  fieldLight(f);
  dustLight(f);
  motionLight(f);
  flareLight(f);
  sparkLight(f);
  zapLight(f);
  glintLight(f);
}
