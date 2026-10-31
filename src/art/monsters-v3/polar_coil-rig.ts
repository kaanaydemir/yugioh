// Kutup Bobini v3 — the "living coil" rig: Pose → pixels.
//
// The coil piece of the Kutup family (C14): a magnetite SPINDLE (pin foot, bottom flange, rod, top flange, a small
// helm with a two-colour visor, the spindle's gold-knobbed tip above it) whose rod is wound with thick COPPER WIRE —
// the wound drum IS the body. Between the lower and the upper winding a recessed CORE WINDOW leaks the two pole
// lights (N fire on the left half, S water on the right) and the seams between the turns leak them too. Two small
// SPOOLS sit on the top flange's ends like shoulders; from each a copper WIRE WHIP hangs to a gold terminal lug.
// Two short legs are copper-wound tubes on magnetite boots. Light rings climb the turns; the spools turn; iron dust
// runs along the solenoid's field lines (out of the top, around the sides, into the bottom).
//
//   - flat polygons / per-column cylinder planes measured from the part's own edges (kit), no gradients;
//   - every part moves by WHOLE pixels and never rotates as a sprite: the whips are bezier cables (geometry), the
//     death topple re-draws the bare spindle's parts as rotated polygons (geometry), not a rotated bitmap;
//   - one key light from the top-left; `light` = the frame edge it comes from ('right' = the P2 relight sheet);
//   - light (core window, seam leaks, climbing rings, visor eyes, zaps, pulse ring, spark/dust, flash) is painted
//     after the outline and never outlined (IŞ-9). The iron-dust spikes are matter: their own ink outline.
//   - summon / death / revive change the winding share, the girth and the limbs (the spindle winds / unwinds).
// Frame 88×76; 1 art px = 1 game px; R = (RX, GY) the ground point between the boots.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { lightOf, type Light } from '../rigkit';
import {
  COPPER, COPPER_FAR, Comp, DRUM_ROWS, DRUM_RX, GOLD, MAG, MAG_FAR, POLE_N, POLE_S, RING, ROD_RX, TAU, TURNS, WIN_HI, WIN_LO,
  bands, boxPoly, clamp, hash2, isWound, paintDrum, paintFlange, paintSpool, sagAt, tubePoly, turnOf,
  type DrumSpec, type Pt,
} from './polar_coil-kit';

export const W = 88;
export const H = 76;
export const RX = 49;
export const GY = 70;

export const enum Part {
  none = 0,
  whipF,
  spoolF,
  legF,
  legN,
  flangeB,
  drum,
  flangeT,
  head,
  spoolN,
  whipN,
  wrap,
  wire,
}

const rnd = Math.round;
const fl = Math.floor;

// ---------------------------------------------------------------- pose

export interface Pose {
  /** upper body (spindle + drum + head + spools) offset over the hips: x lean, y sink (+ down) */
  dx: number;
  dy: number;
  /** knees bend: the hips drop by `sink` px (feet stay) */
  sink: number;
  /** legs grown 0 (the bare spindle stands on its pin) … 1 */
  legs: number;
  /** head (helm + spindle tip) offset over the top flange */
  hx: number;
  hy: number;
  /** the spindle tip's lag behind the helm (secondary motion, px) */
  ky: number;
  /** whip ends relative to their spool anchor, bend (perpendicular bulge), grown 0…1 */
  nwx: number;
  nwy: number;
  nlag: number;
  fwx: number;
  fwy: number;
  flag: number;
  whips: number;
  /** spool turn phase (each 0…1 = one turn) */
  spinN: number;
  spinF: number;
  /** spools wound 0 (empty reels) … 1 */
  reel: number;
  /** visor eyes 0 dark … 1 lit … 2 white-hot; lid 0 open, 1 slit, 2 shut */
  eye: number;
  lid: number;
  /** core window light 0 … 3 (3 = white seam), seam leaks share the level */
  core: number;
  /** climbing light rings: phase 0…1 (bottom → top), count 0/1/2, brightness 1…3 */
  climb: number;
  rings: number;
  ringB: number;
  /** winding share 0…1, from the top (1) or the bottom (0); girth 0 (bare rod) … 1 */
  wind: number;
  fromTop: number;
  girth: number;
  /** a loose wire: 0 none … 1; its free end relative to R; loops; phase */
  feed: number;
  fex: number;
  fey: number;
  floops: number;
  /** loose wire heap on the floor 0…1 (death / revive) */
  heap: number;
  /** iron dust on the field lines: phase (−1 none), spread 0…2 */
  dust: number;
  dustK: number;
  /** iron-dust spikes: gather 0…1 (0 none), orbit phase, fly 0…1 toward the front, converge star 0…1 */
  sg: number;
  orb: number;
  fly: number;
  conv: number;
  /** hit rattle (odd turns shift) px, magic zaps 0…1, core flash 0…1, pulse ring 0…1 */
  rattle: number;
  zap: number;
  flash: number;
  pulse: number;
  /** guard: copper wrapped over the front 0…3 bands */
  wrap: number;
  /** death: the bare spindle topples 0 … 1 (≈ 60°), dissolve 0…1 */
  tilt: number;
  diss: number;
  /** global phase 0…1 */
  t: number;
}

export const NEUTRAL: Pose = {
  dx: 0, dy: 0, sink: 0, legs: 1, hx: 0, hy: 0, ky: 0,
  nwx: 6, nwy: 17, nlag: 3, fwx: -5, fwy: 16, flag: -3, whips: 1,
  spinN: 0, spinF: 0, reel: 1, eye: 1, lid: 0, core: 1.5,
  climb: 0, rings: 2, ringB: 1, wind: 1, fromTop: 0, girth: 1,
  feed: 0, fex: -40, fey: -60, floops: 3, heap: 0,
  dust: 0, dustK: 1, sg: 0, orb: 0, fly: 0, conv: 0,
  rattle: 0, zap: 0, flash: 0, pulse: 0, wrap: 0, tilt: 0, diss: 0, t: 0,
};
export const pose = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

// ---------------------------------------------------------------- skeleton

export interface Skel {
  /** spindle centre column */
  cx: number;
  /** bottom flange: front-arc bottom y (fb), top face centre y (f1); top flange top face centre y (f2) */
  fb: number;
  f1: number;
  f2: number;
  /** drum: lowest row y at the silhouette edge, half-width */
  yb: number;
  rx: number;
  hipN: Pt;
  hipF: Pt;
  ankN: Pt;
  ankF: Pt;
  spN: Pt;
  spF: Pt;
  /** whip anchor, control, end */
  wN: [Pt, Pt, Pt];
  wF: [Pt, Pt, Pt];
  /** helm box origin (top-left), visor row */
  hd: Pt;
  visor: Pt;
  knob: Pt;
  /** core window centre and its front edge (the muzzle) */
  core: Pt;
  front: Pt;
}

export const LEG = 8;
const SP_N_R = 5;
const SP_F_R = 4;

export function skeleton(o: Pose): Skel {
  const legs = clamp(o.legs, 0, 1);
  const cx = RX + o.dx;
  const fb = GY - 3 - rnd(LEG * legs) + o.dy + o.sink;
  const f1 = fb - 6;
  const yb = f1 + 1;
  const f2 = yb - 26;
  const rx = ROD_RX + (DRUM_RX - ROD_RX) * clamp(o.girth, 0, 1);
  const spN: Pt = [cx + 14, f2 + 1];
  const spF: Pt = [cx - 13, f2 - 1];
  const whip = (sp: Pt, r: number, ex: number, ey: number, lag: number, k: number): [Pt, Pt, Pt] => {
    const a: Pt = [sp[0] + (ex > 0 ? 1 : -1), sp[1] + r - 1];
    const e: Pt = [a[0] + ex * k, a[1] + ey * k];
    const mx = (a[0] + e[0]) / 2;
    const my = (a[1] + e[1]) / 2;
    const l = Math.hypot(e[0] - a[0], e[1] - a[1]) || 1;
    const c: Pt = [mx + (-(e[1] - a[1]) / l) * lag * k * -1, my + ((e[0] - a[0]) / l) * lag * k * -1];
    return [a, c, e];
  };
  const hd: Pt = [cx - 6 + o.hx, f2 - 9 + o.hy];
  const coreY = yb + 1 - WIN_LO - 1;
  return {
    cx, fb, f1, f2, yb, rx,
    hipN: [cx + 4, fb],
    hipF: [cx - 5, fb],
    ankN: [RX + 5, GY - 3],
    ankF: [RX - 6, GY - 3],
    spN, spF,
    wN: whip(spN, SP_N_R, o.nwx, o.nwy, o.nlag, clamp(o.whips, 0, 1)),
    wF: whip(spF, SP_F_R, o.fwx, o.fwy, o.flag, clamp(o.whips, 0, 1)),
    hd,
    visor: [hd[0] + 7, hd[1] + 4],
    knob: [cx + o.hx, f2 - 15 + o.hy + o.ky],
    core: [cx, coreY],
    front: [cx + rnd(rx), coreY],
  };
}

// ---------------------------------------------------------------- frame

interface Frame {
  p: PixelCanvas;
  comp: Comp;
  light: Light;
  o: Pose;
  sk: Skel;
}

const layer = () => new PixelCanvas(W, H);

function bez(a: Pt, c: Pt, e: Pt, s: number): Pt {
  const u = 1 - s;
  return [u * u * a[0] + 2 * u * s * c[0] + s * s * e[0], u * u * a[1] + 2 * u * s * c[1] + s * s * e[1]];
}

// ---------------------------------------------------------------- parts

function drawWhip(f: Frame, near: boolean): void {
  const { o, light } = f;
  if (o.whips <= 0.05) return;
  const [a, c, e] = near ? f.sk.wN : f.sk.wF;
  const t = near ? COPPER : COPPER_FAR;
  const q = layer();
  const len = Math.hypot(e[0] - a[0], e[1] - a[1]) + 4;
  const n = Math.max(6, Math.ceil(len * 2));
  for (let i = 0; i <= n; i++) {
    const [x, y] = bez(a, c, e, i / n);
    const X = fl(x);
    const Y = fl(y);
    q.set(X, Y, t.M).set(X + 1, Y, t.M).set(X, Y + 1, t.M).set(X + 1, Y + 1, t.M);
  }
  bands(q, t, light, 1, 1, { top: 1, bottom: 0 });
  f.comp.add(q, near ? Part.whipN : Part.whipF, { out: near ? PAL.fire0 : PAL.ink });
  // the terminal lug: a gold block with two contact prongs pointing along the cable
  const g = layer();
  const ex = rnd(e[0]);
  const ey = rnd(e[1]);
  g.poly(boxPoly(ex - 1, ey - 1, ex + 3, ey + 3, 1), GOLD.M);
  bands(g, GOLD, light, 1, 1);
  const [px, py] = bez(a, c, e, 0.92);
  const ux = Math.sign(rnd(e[0] - px)) || 0;
  const uy = Math.sign(rnd(e[1] - py)) || 1;
  g.set(ex + (ux > 0 ? 3 : ux < 0 ? -2 : 0), ey + (uy > 0 ? 3 : uy < 0 ? -2 : 0), MAG.L);
  g.set(ex + (ux > 0 ? 3 : ux < 0 ? -2 : 1) + (ux === 0 ? 1 : 0), ey + (uy > 0 ? 3 : uy < 0 ? -2 : 1) + (uy === 0 ? 1 : 0), MAG.M);
  f.comp.add(g, near ? Part.whipN : Part.whipF, { out: GOLD.D });
}

function drawSpool(f: Frame, near: boolean): void {
  const { o, sk, light } = f;
  const [x, y] = near ? sk.spN : sk.spF;
  const q = layer();
  paintSpool(q, x, y, near ? SP_N_R : SP_F_R, near ? o.spinN : o.spinF, light, o.reel, !near);
  f.comp.add(q, near ? Part.spoolN : Part.spoolF, { out: near ? PAL.stone0 : PAL.ink });
}

function drawLeg(f: Frame, near: boolean): void {
  const { o, light } = f;
  if (o.legs <= 0.12) return;
  const hip = near ? f.sk.hipN : f.sk.hipF;
  const ank = near ? f.sk.ankN : f.sk.ankF;
  const t = near ? COPPER : COPPER_FAR;
  const m = near ? MAG : MAG_FAR;
  // shin straight up from the ankle (3 px, fixed: the feet band never moves), thigh to the hip; knee bends out
  const shinTop: Pt = [ank[0], ank[1] - 3];
  const span = shinTop[1] - hip[1];
  const q = layer();
  if (span > 0) {
    const bow = clamp(LEG - 3 - span, 0, 4) * (near ? 1 : -1) * 0.7;
    const knee: Pt = [(hip[0] + shinTop[0]) / 2 + bow, (hip[1] + shinTop[1]) / 2];
    q.poly(tubePoly(hip, knee, near ? 5 : 4, 1, 0), t.M);
    q.poly(tubePoly(knee, shinTop, near ? 5 : 4, 0, 0), t.M);
  }
  q.poly(tubePoly(shinTop, ank, near ? 5 : 4, 0, 0), t.M);
  bands(q, t, light, 2, 1, { top: 0, bottom: 0 });
  // winding seams every 3 rows (counted from the ground: the feet band stays identical)
  for (let y = 0; y < H; y++) {
    if ((GY - y) % 3 !== 1) continue;
    for (let x = 0; x < W; x++) if (q.isOpaque(x, y)) q.set(x, y, near ? COPPER.S : COPPER_FAR.S);
  }
  f.comp.add(q, near ? Part.legN : Part.legF, { out: near ? PAL.fire0 : PAL.ink });
  // the magnetite boot (toe forward), a gold ankle ring
  if (o.legs > 0.3) {
    const b = layer();
    const x0 = near ? ank[0] - 3 : ank[0] - 4;
    b.poly([[x0, GY - 2], [x0 + 6, GY - 2], [x0 + 8, GY - 1], [x0 + 8, GY], [x0, GY]], m.M);
    bands(b, m, light, 2, 1, { top: 1 });
    f.comp.add(b, near ? Part.legN : Part.legF, { out: PAL.ink });
    const r = layer();
    r.poly(boxPoly(ank[0] - 3, ank[1] - 1, ank[0] + 3, ank[1] + 1, 0), GOLD.M);
    bands(r, GOLD, light, 1, 1, { top: 1 });
    f.comp.add(r, near ? Part.legN : Part.legF, { out: GOLD.D });
  }
}

function drawSpindleBody(f: Frame): void {
  const { o, sk, light } = f;
  // the pin under the bottom flange (seen only while the legs are short)
  const pin = layer();
  pin.poly(boxPoly(sk.cx - 1, sk.fb, sk.cx + 1, sk.fb + 3, 0), MAG.S);
  f.comp.add(pin, Part.flangeB, { out: PAL.ink });
  // bottom flange
  const b = layer();
  paintFlange(b, sk.cx, sk.f1, 14, 3, 3, light);
  f.comp.add(b, Part.flangeB, { out: PAL.stone0 });
  // the wound drum
  const d = layer();
  const spec: DrumSpec = { cx: sk.cx, yb: sk.yb, rx: sk.rx, wind: o.wind, fromTop: o.fromTop, rattle: o.rattle };
  paintDrum(d, spec, light);
  f.comp.add(d, Part.drum, { out: PAL.fire0 });
  // top flange
  const t = layer();
  paintFlange(t, sk.cx, sk.f2, 14, 3, 3, light);
  f.comp.add(t, Part.flangeT, { out: PAL.stone0 });
}

function drawHead(f: Frame): void {
  const { sk, light } = f;
  const [hx, hy] = sk.hd;
  // the spindle tip through the helm: rod + gold knob
  const tip = layer();
  tip.poly(boxPoly(sk.knob[0] - 1, sk.knob[1] + 2, sk.knob[0] + 1, hy + 1, 0), MAG.M);
  bands(tip, MAG, light, 1, 1, { top: 0 });
  f.comp.add(tip, Part.head, { out: PAL.ink });
  const kb = layer();
  kb.poly(boxPoly(sk.knob[0] - 2, sk.knob[1] - 1, sk.knob[0] + 2, sk.knob[1] + 2, 1), GOLD.M);
  bands(kb, GOLD, light, 1, 1);
  f.comp.add(kb, Part.head, { out: GOLD.D });
  // helm: a magnetite dome, the visor slit toward the enemy, a gold brow band
  const q = layer();
  q.poly([[hx + 2, hy], [hx + 10, hy], [hx + 12, hy + 2], [hx + 13, hy + 5], [hx + 13, hy + 10], [hx, hy + 10], [hx, hy + 4], [hx + 1, hy + 1]], MAG.M);
  bands(q, MAG, light, 2, 2, { top: 1 });
  const [vx, vy] = sk.visor;
  for (let x = vx - 2; x <= vx + 6; x++) for (const y of [vy, vy + 1]) if (q.isOpaque(x, y)) q.set(x, y, PAL.stone0);
  for (let x = hx + 1; x <= hx + 12; x++) if (q.isOpaque(x, vy - 2)) q.set(x, vy - 2, x < vx - 2 ? GOLD.S : GOLD.M);
  f.comp.add(q, Part.head, { out: PAL.stone0 });
}

/** Guard: copper turns wrapped over the drum's front, slanting (the whips wound in as an outer layer). */
function drawWrap(f: Frame): void {
  const { o, sk, light } = f;
  const n = Math.round(clamp(o.wrap, 0, 3));
  if (n <= 0) return;
  const q = layer();
  const ys = [sk.yb - 4, sk.yb - 19, sk.yb - 9];
  for (let i = 0; i < n; i++) {
    const y = ys[i];
    const a: Pt = [sk.cx - sk.rx - 1, y + 1];
    const b: Pt = [sk.cx + sk.rx + 2, y - 3];
    q.poly(tubePoly(a, b, 3, 0, 0), COPPER.M);
  }
  bands(q, COPPER, light, 1, 1, { top: 1, bottom: 1 });
  f.comp.add(q, Part.wrap, { out: PAL.fire0 });
}

/** A loose wire: from the drum edge at the winding front to the free end, curling in loops (1 px cable). */
function drawFeed(f: Frame): void {
  const { o, sk } = f;
  if (o.feed <= 0) return;
  // attach at the turn being wound / unwound
  const r = clamp(o.fromTop ? DRUM_ROWS * (1 - o.wind) : DRUM_ROWS * o.wind, 0, DRUM_ROWS - 1);
  const a: Pt = [sk.cx - sk.rx, sk.yb - r];
  const e: Pt = [RX + o.fex, GY + o.fey];
  const q = layer();
  const dx = e[0] - a[0];
  const dy = e[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l;
  const ny = dx / l;
  const n = Math.ceil(l * 2.5);
  const k = clamp(o.feed, 0, 1);
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    if (s > k) break;
    const amp = 2 + 5 * s;
    const ph = s * o.floops * TAU + o.t * TAU * 2;
    const x = a[0] + dx * s + nx * Math.sin(ph) * amp + Math.cos(ph) * amp * 0.6 * (dx / l);
    const y = a[1] + dy * s + ny * Math.sin(ph) * amp + Math.cos(ph) * amp * 0.6 * (dy / l);
    const X = rnd(x);
    const Y = rnd(y);
    if (X < 3 || Y < 3 || X >= W - 3 || Y >= H - 3) continue;
    q.set(X, Y, Math.cos(ph) > 0.2 ? COPPER.L : COPPER.M);
  }
  f.comp.add(q, Part.wire, { out: PAL.fire0 });
}

/** The unwound wire lying on the floor behind the spindle: a tangle of loops. */
function drawHeap(f: Frame): void {
  const { o } = f;
  if (o.heap <= 0) return;
  const q = layer();
  const cx = RX - 17;
  const k = clamp(o.heap, 0, 1);
  const loops = 1 + Math.round(3 * k);
  for (let j = 0; j < loops; j++) {
    const rx = 4 + j * 2.4;
    const ry = 1.5 + j * 0.7;
    const ox = (hash2(j, 3, 1) - 0.5) * 6 + j * 1.5;
    const oy = -1 - j * 0.8;
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * TAU;
      const x = rnd(cx + ox + Math.cos(a) * rx);
      const y = rnd(GY + oy + Math.sin(a) * ry);
      if (y > GY || y < 2) continue;
      q.set(x, y, Math.sin(a) < 0 ? COPPER.L : COPPER.M);
    }
  }
  f.comp.add(q, Part.wire, { out: PAL.fire0 });
}

// ---------------------------------------------------------------- the topple (death end): bare spindle parts as rotated polygons

function drawTopple(f: Frame): void {
  const { o, light } = f;
  const th = (clamp(o.tilt, 0, 1) * 60 * Math.PI) / 180;
  const cs = Math.cos(th);
  const sn = Math.sin(th);
  const P: Pt = [RX, GY];
  // it tips on the pin, then rolls onto the flange rim: lift the whole spindle so its lowest corner stays on the floor
  const lowest = Math.max(...([[-14, -7], [14, -7], [-14, -3], [14, -3], [-1, 0], [1, 0]] as Pt[]).map(([x, y]) => -x * sn + y * cs));
  const lift = Math.max(0, lowest);
  const rot = ([x, y]: Pt): Pt => [P[0] + x * cs + y * sn, P[1] - x * sn + y * cs - lift];
  const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => ([[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as Pt[]).map(rot);
  const part = (pts: Pt[], t: typeof MAG, id: Part, out: number, lw = 2) => {
    const q = layer();
    q.poly(pts, t.M);
    bands(q, t, light, lw, lw, { top: 1 });
    f.comp.add(q, id, { out });
  };
  // the spools tumble with the top flange (empty reels still turning)
  const sF = rot([-13, -36]);
  const sp = layer();
  paintSpool(sp, rnd(sF[0]), rnd(sF[1]), SP_F_R, o.spinF, light, 0, true);
  f.comp.add(sp, Part.spoolF, { out: PAL.ink });
  part(box(-1, -3, 1, 0), MAG, Part.flangeB, PAL.ink, 1);
  part(box(-14, -7, 14, -3), MAG, Part.flangeB, PAL.stone0);
  part(box(-2, -31, 2, -7), MAG, Part.drum, PAL.stone0, 1);
  part(box(-14, -35, 14, -31), MAG, Part.flangeT, PAL.stone0);
  part(box(-1, -49, 1, -44), MAG, Part.head, PAL.ink, 1);
  part(box(-2, -51, 2, -48), GOLD, Part.head, GOLD.D, 1);
  part(box(-6, -44, 7, -35), MAG, Part.head, PAL.stone0);
  const sN = rot([14, -34]);
  const sq = layer();
  paintSpool(sq, rnd(sN[0]), rnd(sN[1]), SP_N_R, o.spinN, light, 0, false);
  f.comp.add(sq, Part.spoolN, { out: PAL.stone0 });
}

// ---------------------------------------------------------------- light layer

function guarded(f: Frame, parts: readonly number[]): (x: number, y: number, c: number) => void {
  const { p, comp } = f;
  return (x, y, c) => {
    x = rnd(x);
    y = rnd(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    if (!parts.includes(comp.id[y * W + x])) return;
    if (p.get(x, y) === PAL.ink) return;
    p.set(x, y, c);
  };
}

/** a free light pixel (inside the frame margin; `behind` = only on empty pixels) */
function put(f: Frame, x: number, y: number, c: number, behind = false): void {
  const { p } = f;
  x = rnd(x);
  y = rnd(y);
  if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) return;
  if (behind && p.isOpaque(x, y)) return;
  p.set(x, y, c);
}

function drumSpec(f: Frame): DrumSpec {
  const { o, sk } = f;
  return { cx: sk.cx, yb: sk.yb, rx: sk.rx, wind: o.wind, fromTop: o.fromTop, rattle: o.rattle };
}

/** The core window (N fire left half / S water right half, a white seam at full charge) and the seam leaks. */
function coreLight(f: Frame): void {
  const { o, sk, light } = f;
  if (o.core <= 0.05 || o.tilt > 0) return;
  const set = guarded(f, [Part.drum]);
  const d = drumSpec(f);
  const lv = clamp(o.core + o.flash * 2, 0, 3.9);
  const k = fl(lv);
  const rxi = rnd(sk.rx);
  // the window
  for (let x = sk.cx - rxi; x <= sk.cx + rxi; x++) {
    const s = sagAt(x, sk.cx, sk.rx);
    for (let r = WIN_LO; r <= WIN_HI; r++) {
      if (!isWound(r, d)) continue;
      const y = sk.yb + s - r;
      const u = (x + 0.5 - sk.cx) / (sk.rx + 0.5);
      const edge = Math.abs(u) > 0.62;
      // a single lit slit between two dark rows (the overhang shadows); the glow spills into them when charged
      const mid = r === WIN_LO + 1;
      if (!mid && (k < 3 || Math.abs(u) > 0.45) && o.flash < 0.5) continue;
      const seam = Math.abs(x + 0.5 - sk.cx) <= 1;
      const ramp = x + 0.5 < sk.cx ? POLE_N : POLE_S;
      let c: number = ramp[clamp(k + 1 - (edge ? 2 : mid ? 0 : 1), 0, 3)];
      if (seam && k >= 2) c = k >= 3 || o.flash > 0.5 ? PAL.white : PAL.gold4;
      if (o.flash > 0.6 && !edge) c = PAL.white;
      set(x, y, c);
    }
  }
  // seam leaks: in the front third, the underside seam rows glow (upper section N, lower section S), flickering
  if (lv < 1) return;
  for (let x = sk.cx - rxi + 2; x <= sk.cx + rxi - 2; x++) {
    const u = (x + 0.5 - sk.cx) / (sk.rx + 0.5);
    if (Math.abs(u) > 0.5) continue;
    const s = sagAt(x, sk.cx, sk.rx);
    for (let r = 0; r < DRUM_ROWS; r++) {
      const [turn, row] = turnOf(r);
      if (turn < 0 || row !== 0 || r === 0 || !isWound(r, d)) continue;
      // only the two seams next to the window leak in idle; a charged core leaks through every seam
      const near = r === WIN_LO - 3 || r === WIN_HI + 1;
      if (!near && lv < 2.5) continue;
      const on = (x + turn * 3 + fl(o.t * 16)) % 6 < (lv >= 2.5 ? 3 : 2);
      if (!on) continue;
      const ramp = r > WIN_HI ? POLE_N : POLE_S;
      set(x, sk.yb + s - r, ramp[clamp(k + (r > WIN_HI ? 1 : 0) - (near ? 0 : 1), 0, 3)]);
    }
  }
}

/** Light rings climbing the turns (bottom → top): a turn's lip and body rows lit gold across the drum. */
function climbLight(f: Frame): void {
  const { o, sk, light } = f;
  if (o.rings <= 0 || o.tilt > 0) return;
  const set = guarded(f, [Part.drum]);
  const d = drumSpec(f);
  const rxi = rnd(sk.rx);
  const n = Math.round(o.rings);
  const b = clamp(o.ringB, 1, 3);
  for (let j = 0; j < n; j++) {
    // a 2-row band of light sliding up the drum row by row (it crosses the turns: lip / body / seam each take it)
    const h = (o.climb + j / n) % 1;
    const r0 = Math.floor(h * (DRUM_ROWS + 2)) - 1;
    for (let x = sk.cx - rxi - 1; x <= sk.cx + rxi + 1; x++) {
      const s = sagAt(x, sk.cx, sk.rx);
      for (let r = r0; r <= r0 + 1; r++) {
        if (r < 0 || r >= DRUM_ROWS) continue;
        const [t2, row] = turnOf(r);
        if (t2 < 0 || !isWound(r, d)) continue;
        const lx = x - (t2 % 2 ? o.rattle : 0);
        const u = (lx + 0.5 - sk.cx) / (sk.rx + 0.5);
        if (Math.abs(u) > 1.02) continue;
        const t = u * light.side;
        const lit = t > 0.3 ? 2 : t > -0.45 ? 1 : 0;
        // RING ramp index by facing and the row inside the turn (seams stay one step down)
        const k = clamp(lit + (row === 2 ? 1 : row === 1 ? 0 : -1) + (b >= 2.5 ? 1 : b < 1.5 ? -1 : 0), 0, 4);
        set(x, sk.yb + s - r, [RING.D, RING.S, RING.M, RING.L, RING.H][k]);
      }
    }
  }
}

function eyeLight(f: Frame): void {
  const { o, sk } = f;
  if (o.eye <= 0.05 || o.tilt > 0) return;
  const set = guarded(f, [Part.head]);
  const [vx, vy] = sk.visor;
  const hot = o.eye > 1.5;
  const rows = o.lid >= 2 ? [] : o.lid === 1 ? [vy + 1] : [vy, vy + 1];
  // two eyes: the N eye (fire) behind, the S eye (water) forward
  for (const y of rows) {
    set(vx - 1, y, hot ? PAL.white : o.eye > 0.6 ? PAL.fire3 : PAL.fire1);
    set(vx, y, hot ? PAL.fire4 : o.eye > 0.6 ? PAL.fire2 : PAL.fire1);
    set(vx + 3, y, hot ? PAL.white : o.eye > 0.6 ? PAL.water4 : PAL.water2);
    set(vx + 4, y, hot ? PAL.water4 : o.eye > 0.6 ? PAL.water3 : PAL.water1);
  }
  if (o.lid >= 2) for (let x = vx - 1; x <= vx + 4; x++) if (x !== vx + 1 && x !== vx + 2) set(x, vy + 1, PAL.stone2);
  // the glow spills along the slit
  if (o.lid < 2 && o.eye > 0.6) {
    set(vx + 5, vy + 1, PAL.water2);
    set(vx + 1, vy + 1, PAL.night2);
    set(vx + 2, vy + 1, PAL.night2);
  }
}

/** Iron dust running along the solenoid's field lines: out of the top, down the outside, into the bottom. */
function dustLight(f: Frame): void {
  const { o, sk } = f;
  if (o.dust < 0 || o.tilt > 0) return;
  const midY = (sk.f2 + sk.f1) / 2;
  const half = (sk.f1 - sk.f2) / 2 + 3;
  for (const side of [-1, 1]) {
    for (let li = 0; li < 3; li++) {
      const rx = sk.rx + 5 + li * 4 * o.dustK;
      for (let i = 0; i < 4; i++) {
        const u = (o.dust * (li === 1 ? 2 : 1) + i / 4 + li * 0.125) % 1;
        // u 0 → 1 along the outer half of the loop: top → side → bottom
        const a = -Math.PI / 2 + u * Math.PI;
        const x = sk.cx + side * (Math.cos(a) * (rx - sk.rx * 0.4) + sk.rx * 0.4);
        const y = midY + Math.sin(a) * (half + li * 2);
        const c = (i + li) % 2 ? PAL.steel : PAL.mist;
        put(f, x, y, c, true);
        put(f, x + side, y, c === PAL.mist ? PAL.steel : PAL.stone3, true);
      }
    }
  }
}

/** The spool notch glint and the whip-lug sparks (charged attack / roar). */
function lugLight(f: Frame): void {
  const { o, sk } = f;
  if (o.core < 2.5 || o.whips < 0.5 || o.tilt > 0) return;
  for (const [, , e] of [sk.wN, sk.wF]) {
    const ph = fl(o.t * 13);
    for (let i = 0; i < 3; i++) {
      const a = hash2(i, ph, 7) * TAU;
      put(f, e[0] + 1 + Math.cos(a) * 3, e[1] + 1 + Math.sin(a) * 3, i % 2 ? PAL.gold4 : PAL.white);
    }
  }
}

/** The magnetic pulse: a flat ring at the core's height spreading out (N half fire, S half water). */
function pulseLight(f: Frame): void {
  const { o, sk, p } = f;
  if (o.pulse <= 0) return;
  const rx = sk.rx + 4 + o.pulse * 26;
  const ry = 2 + o.pulse * 5;
  const hot = o.pulse < 0.45;
  for (let i = 0; i < 240; i++) {
    const a = (i / 240) * TAU;
    const x = sk.core[0] + Math.cos(a) * rx;
    const y = sk.core[1] + Math.sin(a) * ry;
    const front = Math.sin(a) > 0;
    if (!front && p.isOpaque(rnd(x), rnd(y))) continue;
    const ramp = Math.cos(a) < 0 ? POLE_N : POLE_S;
    put(f, x, y, hot ? (front ? PAL.white : ramp[3]) : front ? ramp[3] : ramp[1]);
    if (front && o.pulse < 0.7) put(f, x, y + 1, ramp[2]);
  }
}

/** hitMagic: little arcs jumping across the turns on the drum's front. */
function zapLight(f: Frame): void {
  const { o, sk } = f;
  if (o.zap <= 0) return;
  const set = guarded(f, [Part.drum, Part.flangeT, Part.flangeB, Part.head]);
  const ph = fl(o.t * 19);
  const n = 1 + rnd(o.zap * 3);
  for (let k = 0; k < n; k++) {
    let x = sk.cx - 7 + rnd(hash2(k, ph, 3) * 14);
    let y = sk.yb - 2 - rnd(hash2(k, ph, 9) * 6);
    const len = 4 + rnd(o.zap * 8);
    const ramp = (k + ph) % 2 ? POLE_N : POLE_S;
    for (let i = 0; i < len; i++) {
      set(x, y, i === 0 || i === len - 1 ? PAL.white : ramp[3]);
      y -= 2;
      x += hash2(i, k, ph) < 0.5 ? -1 : 1;
      set(x, y + 1, ramp[2]);
    }
  }
}

/** The iron-dust spikes: gathered from dust, orbiting the coil, then flung forward and converging. */
function spikes(f: Frame): void {
  const { o, sk, p } = f;
  if (o.sg <= 0) return;
  const O: Pt = [sk.cx, sk.core[1] - 1];
  const T: Pt = [W - 12, sk.core[1] - 9];
  for (let i = 0; i < 3; i++) {
    const a = (o.orb + i / 3) * TAU;
    const orbit: Pt = [O[0] + Math.cos(a) * (sk.rx + 15), O[1] + Math.sin(a) * 7 - 2];
    // flight: an arc out of the orbit to T (each spike comes from its own side)
    const fly = clamp(o.fly, 0, 1);
    const e = fly * fly * (3 - 2 * fly);
    const lift = Math.sin(fly * Math.PI) * (i - 1) * 9;
    const pos: Pt = [orbit[0] + (T[0] - orbit[0]) * e, orbit[1] + (T[1] - orbit[1]) * e + lift];
    // direction: along the orbit's tangent while orbiting, toward T in flight
    const tan: Pt = [-Math.sin(a), Math.cos(a) * 0.35];
    const toT: Pt = [T[0] - pos[0], T[1] - pos[1]];
    const tl = Math.hypot(toT[0], toT[1]) || 1;
    let dir: Pt = fly > 0.05 ? [toT[0] / tl, toT[1] / tl] : tan;
    const dl = Math.hypot(dir[0], dir[1]) || 1;
    dir = [dir[0] / dl, dir[1] / dl];
    const behind = fly < 0.05 && Math.sin(a) < -0.15;
    if (o.sg < 0.55) {
      // still dust: grains drawn in toward the spike's place
      const sp = (1 - o.sg / 0.55) * 7 + 1;
      for (let g = 0; g < 6; g++) {
        const b = (g / 6) * TAU + i;
        put(f, pos[0] + Math.cos(b) * sp, pos[1] + Math.sin(b) * sp * 0.6, g % 2 ? PAL.steel : PAL.mist, true);
      }
      continue;
    }
    if (fly >= 0.98 && o.conv > 0) continue;
    // the orbit's wake: iron grains strung out behind each spike along the ellipse
    if (fly < 0.05)
      for (let g = 1; g <= 4; g++) {
        const b = a - g * 0.16;
        const gx = O[0] + Math.cos(b) * (sk.rx + 15);
        const gy = O[1] + Math.sin(b) * 7 - 2;
        put(f, gx, gy, g < 3 ? PAL.mist : PAL.steel, Math.sin(b) < -0.15);
      }
    const len = o.sg < 0.8 ? 4 : 6;
    const q = new PixelCanvas(W, H);
    const tip: Pt = [pos[0] + dir[0] * len, pos[1] + dir[1] * len];
    const back: Pt = [pos[0] - dir[0] * len, pos[1] - dir[1] * len];
    const nrm: Pt = [-dir[1] * 1.4, dir[0] * 1.4];
    q.poly([tip, [pos[0] + nrm[0], pos[1] + nrm[1]], back, [pos[0] - nrm[0], pos[1] - nrm[1]]], MAG.L);
    // the lit facet (toward the top-left) and the dark facet
    const lit = nrm[1] < 0 ? 1 : -1;
    q.poly([tip, [pos[0] - nrm[0] * lit, pos[1] - nrm[1] * lit], back], MAG.S);
    q.set(rnd(tip[0]), rnd(tip[1]), PAL.white);
    q.outline(PAL.ink);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c = q.get(x, y);
        if (c === null || x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
        if (behind && p.isOpaque(x, y)) continue;
        p.set(x, y, c);
      }
    // a short streak behind a flying spike
    if (fly > 0.05 && fly < 0.98) for (let s = 2; s <= 5; s++) put(f, back[0] - dir[0] * s, back[1] - dir[1] * s, s < 4 ? PAL.mist : PAL.steel);
  }
  if (o.conv > 0) {
    // the three meet: a white star with three rays (N / S / gold)
    const [x, y] = T;
    const r = o.conv > 0.6 ? 7 : 4;
    for (let i = -r; i <= r; i++) {
      put(f, x + i, y, Math.abs(i) < 3 ? PAL.white : PAL.gold4);
      put(f, x, y + i, Math.abs(i) < 3 ? PAL.white : i < 0 ? POLE_N[3] : POLE_S[3]);
    }
    for (let i = 1; i <= r - 2; i++) {
      put(f, x - i, y - i, POLE_N[2]);
      put(f, x + i, y + i, POLE_S[2]);
      put(f, x + i, y - i, PAL.gold3);
      put(f, x - i, y + i, PAL.gold3);
    }
  }
}

/** The summon / revive wire glints: speed streaks along the incoming loose wire. */
function feedLight(f: Frame): void {
  const { o, sk } = f;
  if (o.feed <= 0 || o.diss > 0) return;
  const r = clamp(o.fromTop ? DRUM_ROWS * (1 - o.wind) : DRUM_ROWS * o.wind, 0, DRUM_ROWS - 1);
  // where the wire meets the drum: a hot contact point (white → gold)
  const x = sk.cx - rnd(sk.rx);
  const y = sk.yb - rnd(r);
  put(f, x, y, PAL.white);
  put(f, x - 1, y, PAL.gold4);
  put(f, x, y - 1, PAL.gold4);
  put(f, x + 1, y + 1, PAL.gold3);
}

/** the last ~150 ms: the body breaks to iron and copper grit by 2×2 cells */
function dissolvePass(f: Frame): void {
  const { p, comp, o } = f;
  if (o.diss <= 0) return;
  const gone: number[] = [];
  const mark: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!p.isOpaque(x, y) || comp.id[y * W + x] === Part.none) continue;
      const cx = fl((x - RX) / 2);
      const cy = fl((y - GY) / 2);
      const thr = hash2(cx, cy, 11) * 0.8 + clamp((GY - y) / 60, 0, 1) * 0.2;
      if (thr < o.diss - 0.12) gone.push(x, y);
      else if (thr < o.diss) mark.push(x, y);
    }
  for (let i = 0; i < gone.length; i += 2) {
    p.erase(gone[i], gone[i + 1]);
    comp.id[gone[i + 1] * W + gone[i]] = Part.none;
  }
  for (let i = 0; i < mark.length; i += 2) p.set(mark[i], mark[i + 1], (fl((mark[i] - RX) / 2) + fl((mark[i + 1] - GY) / 2)) & 1 ? PAL.skin2 : PAL.steel);
}

// ---------------------------------------------------------------- draw

export interface DrawCoilOpts {
  /** draw only the body (no light layer) — the sovereign's chest piece */
  bodyOnly?: boolean;
}

export function drawCoil(p: PixelCanvas, o: Pose, lightFrom: 'left' | 'right', opts: DrawCoilOpts = {}): void {
  const light = lightOf(lightFrom);
  const sk = skeleton(o);
  const comp = new Comp(p);
  const f: Frame = { p, comp, light, o, sk };

  drawHeap(f);
  if (o.tilt > 0) {
    drawTopple(f);
  } else {
    drawWhip(f, false);
    drawSpool(f, false);
    drawLeg(f, false);
    drawLeg(f, true);
    drawSpindleBody(f);
    drawWrap(f);
    drawHead(f);
    drawSpool(f, true);
    drawWhip(f, true);
  }
  drawFeed(f);

  p.outline(PAL.ink);
  if (opts.bodyOnly) return;
  dissolvePass(f);

  dustLight(f);
  if (o.diss < 0.5) {
    coreLight(f);
    climbLight(f);
    eyeLight(f);
  }
  zapLight(f);
  pulseLight(f);
  lugLight(f);
  feedLight(f);
  spikes(f);
}
