// Çelik Susturucu v3 — the "siege walker" rig: Pose → pixels.
//
// A NEW body plan (not a humanoid, not a wizard, not a dragon): a compact, WIDE, LOW heavy walker that stands
// on two short hydraulic legs with big flat feet. A barrel chest of riveted copper plates with a steel mid-band
// and a round core port (violet bars) on its front; a flat visor head sunk low and forward with ONE horizontal
// violet eye slit; no neck; two shoulder drums with exhaust stacks (steam alive in idle); a radiator hump on the
// back; two huge piston arms: the NEAR arm ends in a short PILE-DRIVER ram, the FAR arm carries a hexagonal
// SEAL-SHIELD strapped on its forearm. Copper + steel blue-grey + violet light.
//
//   - every hard part is a flat polygon / tube shaded by flat value planes measured from its own edges (a lit
//     band toward the key light, a shade band away from it): no gradients, no dither;
//   - hard parts move by WHOLE pixels and never rotate as sprites; arms are 2-link IK tubes (geometry);
//   - ONE key light from the screen's top-left: `light` = the frame edge it comes from ('left' P1, 'right' the
//     P2 relight sheet, mirrored by flipX it is lit from the top-left again). Planes are chosen per light;
//   - light (eye slit, core bars, seal glyph / ring, steam, sparks, silence ring) is painted after the outline
//     and never outlined (IŞ-9).
// Frame 120×96; 1 art px = 1 game px; the root R is the ground point between the feet.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ik2, lightOf, run, type Light } from '../rigkit';
import { Comp, planes } from './steel_silencer-kit';

export const W = 120;
export const H = 96;
export const RX = 44;
export const GY = 88;

export const enum Part {
  none = 0,
  back,
  stackF,
  legF,
  armF,
  pelvis,
  legN,
  torso,
  port,
  pauldron,
  shield,
  head,
  armN,
  fx,
}

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rnd = Math.round;
const fl = Math.floor;
type Pt = readonly [number, number];

// ---------------------------------------------------------------- pose

export interface Pose {
  /** pelvis sink (px, + down): everything above the legs follows; legs bend more */
  py: number;
  /** chest assembly offset relative to the pelvis (px) */
  tx: number;
  ty: number;
  /** head offset relative to the chest (px) */
  hx: number;
  hy: number;
  /** eye 0 dark … 1 violet … 2 white; lid 0 open / 1 half / 2 slit; scan = px the eye sits off its centre */
  eye: number;
  lid: number;
  scan: number;
  /** near arm: hand (wrist) target relative to R, ram extension (px), elbow side */
  nx: number;
  ny: number;
  ram: number;
  /** far arm: wrist target relative to R, hex centre offset from the wrist, hex squash 0…1 (turned away), seal glow 0…3, ward arcs 0…2 */
  fx: number;
  fy: number;
  hx2: number;
  hy2: number;
  hexs: number;
  seal: number;
  ward: number;
  /** chest core 0 dark … 3 blazing, shutter plates 0…2 open */
  core: number;
  shutter: number;
  /** foot lifts (px) of the near / far foot and their x shifts */
  nfl: number;
  nfx: number;
  ffl: number;
  ffx: number;
  /** back radiator offset (px), stack lean (px) */
  back: number;
  lean: number;
  /** steam: phase 0…1 (−1 none), amplitude 0…2; vent = a burst phase (0 none) */
  puff: number;
  puffK: number;
  vent: number;
  /** silence ring phase 0…1 (0 none) and its centre relative to R */
  ring: number;
  rx: number;
  ry: number;
  /** sparks off the struck plate / chest (0 none, else phase), dust at the feet (0 none, else phase) */
  spark: number;
  dust: number;
  /** the anim's one metal glint: 1 = 1 px, 2 = 3-px cross */
  glint: number;
  /** plate shudder: 0 none, 1 / 2 = plates jump a px alternately; hitMagic static 0…1 */
  shake: number;
  zap: number;
  /** the pile-driver's impact flash at the ram tip 0…1 */
  slam: number;
  /** summon / revive: rise cut 0…1 (body assembled from the feet up); dissolve front 0…1; gather = dissolve run backwards */
  rise: number;
  diss: number;
  gather: boolean;
  /** global phase 0…1 */
  t: number;
}

export const NEUTRAL: Pose = {
  py: 0,
  tx: 0,
  ty: 0,
  hx: 0,
  hy: 0,
  eye: 1,
  lid: 0,
  scan: 0,
  nx: 27,
  ny: -18,
  ram: 0,
  fx: 26,
  fy: -37,
  hx2: 8,
  hy2: 2,
  hexs: 1,
  seal: 1,
  ward: 0,
  core: 1,
  shutter: 0,
  nfl: 0,
  nfx: 0,
  ffl: 0,
  ffx: 0,
  back: 0,
  lean: 0,
  puff: -1,
  puffK: 1,
  vent: 0,
  ring: 0,
  rx: 11,
  ry: -40,
  spark: 0,
  dust: 0,
  glint: 0,
  shake: 0,
  zap: 0,
  slam: 0,
  rise: 1,
  diss: 0,
  gather: false,
  t: 0,
};
export const pose = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

// ---------------------------------------------------------------- tones

interface Tones {
  L: number;
  M: number;
  S: number;
  D: number;
}
const COPPER: Tones = { L: PAL.earth3, M: PAL.earth2, S: PAL.earth1, D: PAL.earth0 };
const STEEL: Tones = { L: PAL.steel, M: PAL.night4, S: PAL.night3, D: PAL.night2 };
const DARK: Tones = { L: PAL.night4, M: PAL.night3, S: PAL.night2, D: PAL.night1 };

// ---------------------------------------------------------------- helpers

export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Flat three-band planes (IŞ-3): lit band toward the key light (and the top), shade band away / at the bottom. */
function bands(q: PixelCanvas, t: Tones, light: Light, litW = 2, shW = 2, opt: { top?: number; bottom?: number } = {}): void {
  const ls = light.side;
  const top = opt.top ?? 1;
  const bottom = opt.bottom ?? 1;
  planes(q, (x, y, src) => {
    const toLight = Math.min(run(src, x, y, ls, -1, litW + 1), run(src, x, y, ls, 0, litW + 1) + 1);
    const up = run(src, x, y, 0, -1, top + 1);
    if (up < top || toLight < litW) return t.L;
    const away = Math.min(run(src, x, y, -ls, 1, shW + 1), run(src, x, y, -ls, 0, shW + 1) + 1);
    const dn = run(src, x, y, 0, 1, bottom + 1);
    if (dn < bottom || away < shW) return t.S;
    return t.M;
  });
}

/** A chamfered box polygon (corner cut c). */
function boxPoly(x0: number, y0: number, x1: number, y1: number, c = 1): Pt[] {
  return [[x0 + c, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1 - c], [x1 - c, y1], [x0 + c, y1], [x0, y1 - c], [x0, y0 + c]];
}

/** A tube (thick segment) as a polygon with square ends. */
function tubePoly(a: Pt, b: Pt, w: number, extA = 0, extB = 0): Pt[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const nx = -uy * (w / 2);
  const ny = ux * (w / 2);
  const a2: Pt = [a[0] - ux * extA, a[1] - uy * extA];
  const b2: Pt = [b[0] + ux * extB, b[1] + uy * extB];
  return [[a2[0] + nx, a2[1] + ny], [b2[0] + nx, b2[1] + ny], [b2[0] - nx, b2[1] - ny], [a2[0] - nx, a2[1] - ny]];
}

// ---------------------------------------------------------------- skeleton

export interface Skel {
  base: Pt;
  T: Pt;
  H: Pt;
  sh1: Pt;
  sh2: Pt;
  el1: Pt;
  w1: Pt;
  tip: Pt;
  dir1: Pt;
  el2: Pt;
  w2: Pt;
  hex: Pt;
  hip1: Pt;
  hip2: Pt;
  kn1: Pt;
  kn2: Pt;
  an1: Pt;
  an2: Pt;
  core: Pt;
  stack1: Pt;
  stack2: Pt;
  eye: Pt;
}

export function skeleton(o: Pose): Skel {
  const base: Pt = [RX, GY + o.py];
  const T: Pt = [base[0] + o.tx, base[1] + o.ty];
  const Hh: Pt = [T[0] + o.hx, T[1] + o.hy];
  const sh1: Pt = [T[0] - 7, T[1] - 45];
  const sh2: Pt = [T[0] - 13, T[1] - 48];
  const reach = (a: Pt, b: Pt, len: number): Pt => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = Math.hypot(dx, dy);
    return d <= len ? b : [a[0] + (dx / d) * len, a[1] + (dy / d) * len];
  };
  const w1 = reach(sh1, [RX + o.nx, GY + o.ny], 44);
  const el1 = ik2(sh1, w1, 20, 24, 1) as Pt;
  const dx = w1[0] - el1[0];
  const dy = w1[1] - el1[1];
  const dl = Math.hypot(dx, dy) || 1;
  const dir1: Pt = [dx / dl, dy / dl];
  const tip: Pt = [w1[0] + dir1[0] * (5 + o.ram), w1[1] + dir1[1] * (5 + o.ram)];
  const w2 = reach(sh2, [RX + o.fx, GY + o.fy], 47);
  const el2 = ik2(sh2, w2, 24, 24, 1) as Pt;
  const hex: Pt = [w2[0] + o.hx2, w2[1] + o.hy2];
  const hip1: Pt = [base[0] + 7, base[1] - 22];
  const hip2: Pt = [base[0] - 8, base[1] - 22];
  const an1: Pt = [RX + 5 + o.nfx, GY - 7 - o.nfl];
  const an2: Pt = [RX - 10 + o.ffx, GY - 7 - o.ffl];
  const kn1 = ik2(hip1, an1, 12, 12, -1) as Pt;
  const kn2 = ik2(hip2, an2, 12, 12, -1) as Pt;
  return {
    base, T, H: Hh, sh1, sh2, el1, w1, tip, dir1, el2, w2, hex, hip1, hip2, kn1, kn2, an1, an2,
    core: [T[0] + 11, T[1] - 39],
    stack1: [T[0] - 4 + o.lean, T[1] - 68],
    stack2: [T[0] - 16 + o.lean, T[1] - 67],
    eye: [Hh[0] + 20 + o.scan, Hh[1] - 50],
  };
}

// ---------------------------------------------------------------- frame

export interface Frame {
  p: PixelCanvas;
  comp: Comp;
  light: Light;
  o: Pose;
  sk: Skel;
  glints: [number, number, number][];
}

const layer = () => new PixelCanvas(W, H);

function rect(x0: number, y0: number, x1: number, y1: number, c: number): PixelCanvas {
  const q = layer();
  q.poly(boxPoly(x0, y0, x1 + 1, y1 + 1, 1), c);
  return q;
}

// ---------------------------------------------------------------- parts

function drawLeg(f: Frame, near: boolean): void {
  const { sk, o, light } = f;
  const hip = near ? sk.hip1 : sk.hip2;
  const kn = near ? sk.kn1 : sk.kn2;
  const an = near ? sk.an1 : sk.an2;
  const t = near ? STEEL : DARK;
  const q = layer();
  q.poly(tubePoly(hip, kn, 11, 3, 0), t.M);
  q.poly(tubePoly(kn, an, 10, 0, 2), t.M);
  bands(q, t, light, 2, 2);
  f.comp.add(q, near ? Part.legN : Part.legF, { out: PAL.night1 });
  // hydraulic ram on the shin: a bright rod on the shade side
  const rod = layer();
  rod.thickLine(kn[0] - 1, kn[1] + 3, an[0] - 2, an[1] - 3, 2, near ? PAL.mist : PAL.steel);
  f.comp.add(rod, near ? Part.legN : Part.legF, {});
  // knee cap (copper disc) and foot plate
  const k = layer();
  k.disc(kn[0] + 1, kn[1], 6, near ? COPPER.M : COPPER.S);
  bands(k, near ? COPPER : { L: COPPER.M, M: COPPER.S, S: COPPER.S, D: COPPER.D }, light, 2, 2);
  f.comp.add(k, near ? Part.legN : Part.legF, { out: PAL.earth0 });
  const fx = an[0] - 8;
  const fy = GY - 6 - (near ? o.nfl : o.ffl);
  const foot = layer();
  foot.poly([[fx, fy + 6], [fx + 1, fy], [fx + 14, fy], [fx + 18, fy + 3], [fx + 18, fy + 6]], near ? COPPER.M : COPPER.S);
  bands(foot, near ? COPPER : { L: COPPER.M, M: COPPER.S, S: COPPER.S, D: COPPER.D }, light, 2, 2);
  f.comp.add(foot, near ? Part.legN : Part.legF, { out: PAL.earth0 });
}

function drawPelvis(f: Frame): void {
  const { sk, light } = f;
  const [bx, by] = sk.base;
  const q = layer();
  q.poly(boxPoly(bx - 16, by - 31, bx + 17, by - 19, 2), STEEL.M);
  bands(q, STEEL, light, 2, 2);
  // copper belt
  for (let y = by - 31; y <= by - 28; y++) for (let x = bx - 15; x <= bx + 16; x++) if (q.isOpaque(x, y)) q.set(x, y, y === by - 31 ? COPPER.L : y === by - 28 ? COPPER.S : COPPER.M);
  f.comp.add(q, Part.pelvis, { out: PAL.night1 });
}

function drawBack(f: Frame): void {
  const { sk, o, light } = f;
  const [tx, ty] = sk.T;
  const q = layer();
  q.poly(boxPoly(tx - 30 + o.back, ty - 54, tx - 15 + o.back, ty - 28, 2), DARK.M);
  bands(q, DARK, light, 2, 2);
  // radiator slits
  for (let i = 0; i < 4; i++) {
    const y = ty - 49 + i * 5;
    for (let x = tx - 27 + o.back; x <= tx - 19 + o.back; x++) if (q.isOpaque(x, y)) q.set(x, y, PAL.night1);
  }
  f.comp.add(q, Part.back, { out: PAL.night1 });
}

function stackAt(f: Frame, x: number, y: number, part: Part, t: Tones): void {
  const q = layer();
  q.poly(boxPoly(x - 3, y, x + 3, y + 12, 1), t.M);
  bands(q, t, f.light, 2, 2);
  for (let xx = x - 3; xx <= x + 2; xx++) q.paint(xx, y + 1, COPPER.L).paint(xx, y + 2, COPPER.S);
  f.comp.add(q, part, { out: PAL.night1 });
}

function drawTorso(f: Frame): void {
  const { sk, o, light } = f;
  const [tx, ty] = sk.T;
  const sh = o.shake;
  const poly: Pt[] = [[-16, -59], [18, -60], [27, -50], [27, -31], [19, -23], [-12, -23], [-21, -33], [-21, -50]].map(([x, y]) => [tx + x, ty + y] as Pt);
  // upper chest plate (copper), mid steel band, belly plate (copper): hinge gaps between them
  const mk = (y0: number, y1: number, t: Tones, dy: number): void => {
    const q = layer();
    q.poly(poly, t.M);
    for (let y = 0; y < H; y++) if (y < ty + y0 + dy || y > ty + y1 + dy) for (let x = 0; x < W; x++) q.erase(x, y);
    bands(q, t, light, 3, 2);
    f.comp.add(q, Part.torso, { out: COPPER.D });
  };
  mk(-62, -42, COPPER, sh === 1 ? -1 : 0);
  mk(-41, -34, STEEL, 0);
  mk(-33, -22, COPPER, sh === 2 ? 1 : 0);
  // plate dashes (rivet pairs) on the copper plates
  const dash = (x: number, y: number) => {
    if (f.p.get(x, y) !== null && f.p.get(x + 1, y) !== null) f.p.set(x, y, PAL.earth4).set(x + 1, y, PAL.earth4);
  };
  dash(tx - 16, ty - 56);
  dash(tx - 16, ty - 28);
  dash(tx + 20, ty - 28);
  void dash;
  // core port: steel ring + dark well (bars are light, after the outline)
  const pr = layer();
  pr.disc(sk.core[0], sk.core[1], 8, STEEL.M);
  bands(pr, STEEL, light, 2, 2);
  pr.disc(sk.core[0], sk.core[1], 6, PAL.night0);
  f.comp.add(pr, Part.port, { out: PAL.night1 });
}

function drawPauldron(f: Frame): void {
  const { sk, light } = f;
  const [tx, ty] = sk.T;
  // far drum + stack behind, near drum in front
  const fq = layer();
  fq.ellipse(tx - 14, ty - 54, 8, 7, DARK.M);
  bands(fq, DARK, light, 2, 2);
  f.comp.add(fq, Part.stackF, { out: PAL.night1 });
  const q = layer();
  q.ellipse(tx - 2, ty - 53, 12, 9, COPPER.M);
  bands(q, COPPER, light, 3, 2);
  // steel cap band across the drum
  for (let y = ty - 53; y <= ty - 52; y++) for (let x = tx - 13; x <= tx + 9; x++) if (q.isOpaque(x, y)) q.set(x, y, y === ty - 53 ? STEEL.L : STEEL.M);
  f.comp.add(q, Part.pauldron, { out: COPPER.D });
}

function drawHead(f: Frame): void {
  const { sk, o, light } = f;
  const [hx, hy] = sk.H;
  // collar plate under the visor
  const c = layer();
  c.poly(boxPoly(hx + 3, hy - 47, hx + 30, hy - 42, 1), STEEL.M);
  bands(c, STEEL, light, 2, 2);
  f.comp.add(c, Part.head, { out: PAL.night1 });
  const q = layer();
  q.poly(boxPoly(hx + 5, hy - 58, hx + 36, hy - 45, 2), STEEL.M);
  bands(q, STEEL, light, 2, 2);
  // copper brow (top 3 rows) and jaw (bottom 2 rows)
  for (let y = hy - 58; y <= hy - 46; y++)
    for (let x = hx + 5; x <= hx + 36; x++) {
      if (!q.isOpaque(x, y)) continue;
      if (y <= hy - 56) q.set(x, y, y === hy - 58 ? COPPER.L : y === hy - 57 ? COPPER.M : COPPER.S);
      else if (y >= hy - 47) q.set(x, y, y === hy - 47 ? COPPER.M : COPPER.S);
    }
  // dark visor well
  for (let y = hy - 54; y <= hy - 50; y++) for (let x = hx + 9; x <= hx + 34; x++) if (q.isOpaque(x, y)) q.set(x, y, PAL.night0);
  f.comp.add(q, Part.head, { out: PAL.ink });
  void o;
}

function drawNearArm(f: Frame): void {
  const { sk, light, o } = f;
  // upper arm (copper-steel piston link)
  const u = layer();
  u.poly(tubePoly(sk.sh1, sk.el1, 13, 4, 0), STEEL.M);
  bands(u, STEEL, light, 2, 2);
  f.comp.add(u, Part.armN, { out: PAL.night1 });
  // shoulder joint + elbow joint (copper discs)
  for (const j of [sk.sh1, sk.el1]) {
    const d = layer();
    d.disc(j[0], j[1], 7, COPPER.M);
    bands(d, COPPER, light, 2, 2);
    f.comp.add(d, Part.armN, { out: COPPER.D });
  }
  // forearm: a huge cylinder
  const q = layer();
  q.poly(tubePoly(sk.el1, sk.w1, 14, 3, 2), COPPER.M);
  bands(q, COPPER, light, 3, 3);
  f.comp.add(q, Part.armN, { out: COPPER.D });
  // steel hoops round the cylinder (hinge gaps between the copper staves)
  for (const k of [0.34, 0.72]) {
    const cx = sk.el1[0] + (sk.w1[0] - sk.el1[0]) * k;
    const cy = sk.el1[1] + (sk.w1[1] - sk.el1[1]) * k;
    const hp = layer();
    hp.poly(tubePoly([cx - sk.dir1[0] * 1.5, cy - sk.dir1[1] * 1.5], [cx + sk.dir1[0] * 1.5, cy + sk.dir1[1] * 1.5], 15), STEEL.M);
    bands(hp, STEEL, light, 1, 1, { top: 1, bottom: 1 });
    f.comp.add(hp, Part.armN, { out: COPPER.D });
  }
  // steel collar at the wrist and the ram
  const [wx, wy] = sk.w1;
  const col = layer();
  col.poly(tubePoly([wx - sk.dir1[0] * 3, wy - sk.dir1[1] * 3], [wx + sk.dir1[0] * 3, wy + sk.dir1[1] * 3], 17), STEEL.M);
  bands(col, STEEL, light, 2, 2);
  f.comp.add(col, Part.armN, { out: PAL.night1 });
  const r = layer();
  const rl = 4 + o.ram;
  r.poly(tubePoly([wx + sk.dir1[0] * 2, wy + sk.dir1[1] * 2], [wx + sk.dir1[0] * rl, wy + sk.dir1[1] * rl], 8), PAL.mist);
  bands(r, { L: PAL.mist, M: PAL.steel, S: PAL.night4, D: PAL.night3 }, light, 2, 2);
  // pile point
  const px = wx + sk.dir1[0] * (rl + 1);
  const py = wy + sk.dir1[1] * (rl + 1);
  r.poly([[px - sk.dir1[1] * 3, py + sk.dir1[0] * 3], [px + sk.dir1[1] * 3, py - sk.dir1[0] * 3], [px + sk.dir1[0] * 6, py + sk.dir1[1] * 6]], PAL.night4);
  f.comp.add(r, Part.armN, { out: PAL.ink });
}

const HEX = (cx: number, cy: number, r: number, sx: number): Pt[] => {
  const pts: Pt[] = [];
  for (let i = 0; i < 6; i++) pts.push([cx + Math.cos((i * 60 + 30) * (Math.PI / 180)) * r * sx, cy + Math.sin((i * 60 + 30) * (Math.PI / 180)) * r]);
  return pts;
};

function drawFarArm(f: Frame): void {
  const { sk, light } = f;
  const u = layer();
  u.poly(tubePoly(sk.sh2, sk.el2, 12, 4, 0), DARK.M);
  bands(u, DARK, light, 2, 2);
  f.comp.add(u, Part.armF, { out: PAL.night1 });
  const q = layer();
  q.poly(tubePoly(sk.el2, sk.w2, 13, 3, 4), DARK.M);
  bands(q, DARK, light, 2, 2);
  f.comp.add(q, Part.armF, { out: PAL.night1 });
  const d = layer();
  d.disc(sk.el2[0], sk.el2[1], 6, COPPER.S);
  bands(d, { L: COPPER.M, M: COPPER.S, S: COPPER.S, D: COPPER.D }, light, 2, 2);
  f.comp.add(d, Part.armF, { out: COPPER.D });
}

function drawShield(f: Frame): void {
  const { sk, o, light } = f;
  const [cx, cy] = sk.hex;
  const sx = clamp(o.hexs, 0.35, 1);
  const R = 12;
  const q = layer();
  q.poly(HEX(cx, cy, R, sx), COPPER.M);
  bands(q, COPPER, light, 2, 2);
  f.comp.add(q, Part.shield, { out: COPPER.D });
  const face = layer();
  face.poly(HEX(cx, cy, R - 3, sx), STEEL.M);
  bands(face, STEEL, light, 2, 2);
  f.comp.add(face, Part.shield, { out: PAL.night1 });
  const well = layer();
  well.poly(HEX(cx, cy, R - 7, sx), PAL.night0);
  f.comp.add(well, Part.shield, {});
}

// ---------------------------------------------------------------- light layer

/** A canvas view that only paints where `part` owns the pixel (a light never shows through a part in front of it). */
function guard(f: Frame, part: Part): { set(x: number, y: number, c: number): unknown; line(x0: number, y0: number, x1: number, y1: number, c: number): unknown } {
  const { p, comp } = f;
  const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && comp.id[y * W + x] === part;
  return {
    set: (x, y, c) => { if (ok(x, y)) p.set(x, y, c); },
    line: (x0, y0, x1, y1, c) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++) { const x = Math.round(x0 + ((x1 - x0) * i) / n); const y = Math.round(y0 + ((y1 - y0) * i) / n); if (ok(x, y)) p.set(x, y, c); }
    },
  };
}

function eyeLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.eye <= 0.05) return;
  const [ex, ey] = sk.eye;
  const half = o.lid >= 2 ? 3 : o.lid === 1 ? 6 : 8;
  const hot = o.eye > 1.4;
  const col = hot ? PAL.white : o.eye > 0.6 ? PAL.void4 : PAL.void3;
  const edge = o.eye > 0.6 ? PAL.void3 : PAL.void2;
  const tall = o.lid >= 2 ? 1 : 2;
  for (let x = ex - half; x <= ex + half; x++) {
    const rim = x === ex - half || x === ex + half;
    for (let y = 0; y < tall; y++) p.set(x, ey + y + (o.lid >= 2 ? 1 : 0), rim ? edge : col);
  }
  if (hot && o.lid < 2) for (let x = ex - half + 1; x <= ex + half - 1; x++) p.set(x, ey - 1, PAL.void3);
}

function coreLight(f: Frame): void {
  const { o, sk } = f;
  const p = guard(f, Part.port);
  const [cx, cy] = sk.core;
  const g = o.core;
  const lit = g <= 0.05 ? PAL.void1 : g < 1.4 ? PAL.void3 : g < 2.4 ? PAL.void4 : PAL.white;
  const dim = g <= 0.05 ? PAL.night1 : g < 1.4 ? PAL.void2 : g < 2.4 ? PAL.void3 : PAL.void4;
  // shutters: two plates slide up / down off the well
  const open = o.shutter;
  for (let i = -3; i <= 3; i += 2) {
    const hh = 5 - Math.max(0, 2 - open * 2);
    for (let y = -hh; y <= hh; y++) p.set(cx + i, cy + y, y === -hh || y === hh ? dim : lit);
    if (g > 1.4) p.set(cx + i + 1, cy, dim);
  }
  if (g >= 2.4) for (const [dx, dy] of [[-1, -7], [0, -7], [-1, 7], [0, 7]] as const) p.set(cx + dx, cy + dy, PAL.void3);
}

function sealLight(f: Frame): void {
  const { o, sk } = f;
  const p = guard(f, Part.shield);
  const pw = f.p;
  const [cx, cy] = sk.hex;
  const sx = clamp(o.hexs, 0.35, 1);
  const g = o.seal;
  const lit = g < 1.4 ? PAL.void3 : g < 2.4 ? PAL.void4 : PAL.white;
  const dim = g < 1.4 ? PAL.void2 : PAL.void3;
  // glyph: a small hexagon ring with a dot
  const hx = HEX(cx, cy, 4.2, sx);
  for (let i = 0; i < 6; i++) {
    const a = hx[i];
    const b = hx[(i + 1) % 6];
    p.line(rnd(a[0]), rnd(a[1]), rnd(b[0]), rnd(b[1]), g >= 1 ? lit : dim);
  }
  p.set(rnd(cx), rnd(cy), PAL.white);
  if (o.ward > 0) {
    // ward ring: a hex ring around the shield, in broken arcs
    const ring = HEX(cx, cy, 15 + (o.ward > 1 ? 3 : 0), sx);
    for (let i = 0; i < 6; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % 6];
      if ((i + (fl(o.t * 12) & 1)) % 3 === 2) continue;
      pw.line(rnd(a[0]), rnd(a[1]), rnd(b[0]), rnd(b[1]), o.ward > 1 ? PAL.void4 : PAL.void3);
    }
  }
}

function steamLight(f: Frame): void {
  const { p, o, sk } = f;
  const ph = o.puff;
  const mk = (x: number, y: number, k: number, seed: number) => {
    // a puff = a 2×2 / 3×2 blob drifting up and back, shrinking to a lone 2×2 then gone
    for (let i = 0; i < 3; i++) {
      const u = (k + i / 3) % 1;
      const rise = 2 + u * 15 * o.puffK;
      const drift = -u * 4 + Math.sin((u + seed) * TAU) * 1.5;
      const bx = rnd(x + drift);
      const by = rnd(y - rise);
      const big = u < 0.6;
      const c = u < 0.35 ? PAL.white : u < 0.7 ? PAL.mist : PAL.steel;
      p.rect(bx, by, big ? 3 : 2, 2, c);
      if (big) p.set(bx + 1, by - 1, c);
    }
  };
  if (ph >= 0) {
    mk(sk.stack1[0] - 1, sk.stack1[1], ph, 0.1);
    mk(sk.stack2[0] - 1, sk.stack2[1] + 1, (ph + 0.5) % 1, 0.6);
  }
  if (o.vent > 0) {
    // a hard burst: two jets
    const v = o.vent;
    for (let i = 0; i < 4; i++) {
      p.rect(rnd(sk.stack1[0] - 2 - i * 2 * v), rnd(sk.stack1[1] - 3 - i * 4 * v), 3, 2, i < 2 ? PAL.white : PAL.mist);
      p.rect(rnd(sk.stack2[0] - 2 - i * 3 * v), rnd(sk.stack2[1] - 2 - i * 4 * v), 3, 2, i < 2 ? PAL.white : PAL.mist);
    }
  }
}

function ringLight(f: Frame): void {
  const { p, o } = f;
  if (o.ring <= 0) return;
  const cx = RX + o.rx;
  const cy = GY + o.ry;
  const r = 7 + o.ring * 34;
  const n = Math.max(40, Math.round(r * 7));
  const hot = o.ring < 0.45;
  for (let i = 0; i < n; i++) {
    if (i % 12 >= 11) continue;
    const a = (i / n) * TAU;
    for (const [d, c] of [[0, hot ? PAL.white : PAL.void4], [-1, hot ? PAL.void4 : PAL.void3], [-2, hot ? PAL.void3 : PAL.void2]] as const) {
      if (!hot && d === -2 && o.ring > 0.8) continue;
      const x = rnd(cx + Math.cos(a) * (r + d));
      const y = rnd(cy + Math.sin(a) * (r + d));
      if (p.isOpaque(x, y) && p.get(x, y) === PAL.ink) continue;
      p.set(x, y, c);
    }
  }
}

function sparkLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.spark <= 0) return;
  const ph = o.spark;
  const cx = o.slam > 0 ? sk.tip[0] : sk.core[0] - 3;
  const cy = o.slam > 0 ? sk.tip[1] : sk.core[1] - 4;
  for (let i = 0; i < 7; i++) {
    const a = hash2(i, 3, 5) * TAU;
    const d = 2 + ph * (6 + hash2(i, 9, 2) * 8);
    const x = rnd(cx + Math.cos(a) * d);
    const y = rnd(cy + Math.sin(a) * d * 0.8 + ph * ph * 6);
    p.set(x, y, ph < 0.4 ? PAL.white : i % 2 ? PAL.gold3 : PAL.earth4);
    if (ph < 0.7) p.set(x + (Math.cos(a) > 0 ? 1 : -1), y, PAL.gold2);
  }
}

function dustLight(f: Frame): void {
  const { p, o } = f;
  if (o.dust <= 0) return;
  const ph = o.dust;
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    const x = rnd(RX + 8 + side * (14 + ph * 16 + i * 2));
    const y = GY - 1 - rnd(ph * 5 + (i % 3));
    p.rect(x, y, 3, 2, ph < 0.5 ? PAL.steel : PAL.night4);
  }
}

function slamLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.slam <= 0) return;
  const [x, y] = [rnd(sk.tip[0]), rnd(sk.tip[1])];
  const k = o.slam;
  p.rect(x - 1, y - 1, 3, 3, PAL.white);
  for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [0, 4]] as const) if (k > 0.5) p.rect(x + dx - (dx ? 0 : 0), y + dy, dx ? 2 : 1, dy ? 2 : 1, PAL.void4);
}

function zapLight(f: Frame): void {
  const { p, comp, o, sk } = f;
  if (o.zap <= 0) return;
  const starts: [number, number, number, number][] = [
    [sk.T[0] + 6, sk.T[1] - 52, 0.5 * Math.PI, 0],
    [sk.T[0] - 12, sk.T[1] - 30, 0.8 * Math.PI, 1],
    [sk.w1[0] - 3, sk.w1[1] - 8, 0.2 * Math.PI, 2],
    [sk.H[0] + 10, sk.H[1] - 50, 0.3 * Math.PI, 3],
  ];
  const ph = fl(o.t * 16);
  for (const [x0, y0, a0, k] of starts) {
    const len = rnd(3 + 6 * o.zap);
    let x = x0;
    let y = y0;
    for (let i = 0; i < len; i++) {
      const j = hash2(i, ph, k * 13 + 5);
      const a = a0 + (j - 0.5) * 1.8;
      x += rnd(Math.cos(a) * 1.5);
      y += rnd(Math.sin(a) * 1.5);
      if (!p.isOpaque(x, y) || comp.id[y * W + x] === Part.head) continue;
      p.set(x, y, i === 0 || (i === len - 1 && o.zap > 0.6) ? PAL.white : i % 2 ? PAL.void4 : PAL.mag3);
    }
  }
}

/** hitMagic: scan rows tear across the body (a few rows shifted by a px, restored from the frame). */

// ---------------------------------------------------------------- dissolve / gather (2×2 clusters of root space)

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
      const u = clamp((ry + 70) / 72, 0, 1);
      const thr = 0.82 * u + 0.18 * hash2(cx, cy, 7);
      if (thr < o.diss - front) {
        gone.push(x, y);
        if (!o.gather && (rx & 1) === 0 && (ry & 1) === 0 && hash2(cx, cy, 11) < 0.2) {
          const fall = 2 + (o.diss - front - thr) * 60;
          if (fall < 20) debris.push(x + rnd(Math.sin(cy * 1.9 + fall * 0.2) * 2), Math.min(GY, y + rnd(fall)), hash2(cx, cy, 19) < 0.5 ? (fall < 8 ? PAL.earth3 : PAL.earth2) : fall < 8 ? PAL.steel : PAL.night3);
        }
      } else if (thr < o.diss) mark.push(x, y);
    }
  for (let i = 0; i < gone.length; i += 2) {
    p.erase(gone[i], gone[i + 1]);
    comp.id[gone[i + 1] * W + gone[i]] = Part.none;
  }
  for (let i = 0; i < mark.length; i += 2) {
    if (p.get(mark[i], mark[i + 1]) === PAL.ink) continue;
    p.set(mark[i], mark[i + 1], o.gather ? ((fl((mark[i] - RX) / 2) + fl((mark[i + 1] - GY) / 2)) & 1 ? PAL.white : PAL.void4) : PAL.void3);
  }
  for (let i = 0; i < debris.length; i += 3) if (!p.isOpaque(debris[i], debris[i + 1])) p.rect(debris[i], debris[i + 1], 2, 2, debris[i + 2]);
}

// ---------------------------------------------------------------- draw

export function drawSilencer(p: PixelCanvas, o: Pose, lightFrom: 'left' | 'right'): void {
  const light = lightOf(lightFrom);
  const sk = skeleton(o);
  const comp = new Comp(p);
  const f: Frame = { p, comp, light, o, sk, glints: [] };

  // behind the body
  drawBack(f);
  stackAt(f, sk.stack2[0], sk.stack2[1], Part.stackF, DARK);
  drawLeg(f, false);
  drawFarArm(f);
  drawPelvis(f);
  drawLeg(f, true);
  stackAt(f, sk.stack1[0], sk.stack1[1], Part.stackF, STEEL);
  drawTorso(f);
  drawPauldron(f);
  drawShield(f);
  drawHead(f);
  drawNearArm(f);

  // the body assembled from the feet up (a violet scan line rides the cut)
  let cut = -1;
  if (o.rise < 1) {
    cut = GY - 3 - rnd(70 * clamp(o.rise, 0, 1));
    for (let y = 0; y < cut; y++) for (let x = 0; x < W; x++) p.erase(x, y);
  }

  p.outline(PAL.ink);
  dissolvePass(f);

  // light layer
  ringLight(f);
  if (o.diss < 0.7 || o.gather) {
    eyeLight(f);
    coreLight(f);
    sealLight(f);
  }
  if (cut >= 0 && o.rise > 0) {
    for (let x = 0; x < W; x++) if (p.isOpaque(x, cut) && p.get(x, cut) !== PAL.ink) p.set(x, cut, o.rise < 0.7 ? PAL.void4 : PAL.void3);
    for (let x = 0; x < W; x += 2) if (p.isOpaque(x, cut + 1) && p.get(x, cut + 1) !== PAL.ink) p.set(x, cut + 1, PAL.white);
  }
  steamLight(f);
  sparkLight(f);
  slamLight(f);
  dustLight(f);
  zapLight(f);
  for (const [x, y, c] of f.glints) if (!p.isOpaque(x, y) || p.get(x, y) !== PAL.ink) p.set(x, y, c);
}
