// Kutup Hükümdarı v3 — the fused sovereign rig: Pose → pixels. Built from the three finished pieces' OWN painters,
// so every piece stays readable inside the body (YENI_KARTLAR §C15 "birleşim okunur kalmalı"):
//
//   - BASE = Kutup Örsü turned upside down: its top block is the plinth on the floor (polished striking face as the
//     sole, the S horn running forward along the floor as a prow-toe, the N heel plate at the back), its waist, and
//     its flared foot block inverted into a wide hip CUP (the gold band low, the old arch a notch at the lip);
//   - CHEST = Kutup Bobini seated in the cup: bottom flange, the wound copper drum with its two-colour core window
//     (N fire / S water), top flange, the shoulder spools, the helm (given the needle's visor point), and the
//     spindle knob that is now the CROWN PIN;
//   - Kutup İğnesi = the arms (two needle limbs from the spools, gold rings) + the giant compass SPEAR (the needle
//     lozenge itself, stretched) + the compass-rose CROWN floating on the pin.
//
// Craft as the pieces: flat polygons / tubes shaded with flat value bands measured from each part's edges (IŞ-3),
// hard parts move by WHOLE px and never rotate as sprites (the anvil's flip is a pixel-frame tumble: a y-squash of
// its own geometry), one key light from the screen's top-left (`light` = 'left' P1 / 'right' the P2 relit sheet),
// 1-px ink outline last, light (poles, core, eyes, field lines, iron dust, seams, sparks) painted after the outline
// and never outlined (IŞ-9). Frame 116×104; the root R = the floor point under the plinth.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ik2, lightOf, type Light } from '../rigkit';
import { BASE_POLY, TOP_POLY } from './polar_anvil-kit';
import {
  COPPER, DRUM_ROWS, DRUM_RX, RING, TURNS, WIN_HI, WIN_LO, isWound, paintDrum, paintFlange, paintSpool, sagAt, turnOf, type DrumSpec,
} from './polar_coil-kit';
import {
  Comp, DEG, GOLD, GOLD_FAR, MAG, MAG_FAR, bands, cleanCrumbs, needle, rose, rosePin, taperPoly, tubePoly, type Pt, type Tones,
} from './polar_needle-kit';
import { GY as N_GY, H as N_H, RX as N_RX, W as N_W, drawNeedle, pose as needlePose } from './polar_needle-rig';

export const W = 116;
export const H = 104;
export const RX = 50;
export const GY = 99;

export const enum Part {
  none = 0,
  roseB,
  armF,
  spoolF,
  plinth,
  waist,
  coil,
  cup,
  head,
  roseF,
  spoolN,
  armN,
  spear,
  fist,
  debris,
}

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rnd = Math.round;
const fl = Math.floor;

/** iron of the base (the anvil's tones with a highlight) */
const IRON: Tones = { H: PAL.mist, L: PAL.steel, M: PAL.stone2, S: PAL.stone1 };
const POLISH: Tones = { H: PAL.white, L: PAL.mist, M: PAL.steel, S: PAL.stone2 };

// ---------------------------------------------------------------- pose

export interface Pose {
  /** whole-body hover above the floor (px, + up): summon float, roar lift, the land drop */
  lift: number;
  /** breath: shoulders, arms, head and spear down this many px (the chest stays seated) */
  br: number;
  /** the chest (coil) offset over the cup; the head offset over the chest */
  cdx: number;
  cdy: number;
  hx: number;
  hy: number;
  /** joint gaps (px): the chest rises g off the cup, the shoulders / head 2g — magnetism holding the pieces apart */
  gap: number;
  /** anvil assembly offset and its flip: 0 = the sovereign's plinth (upside down), 1 = the upright anvil piece */
  adx: number;
  ady: number;
  aflip: number;
  /** chest topple (death): 0 upright … 1 lying on its side toward the back */
  ctilt: number;
  /** arms: present (1) / none (0); the arm group's detached offset (split / dock); hand targets relative to R */
  arms: number;
  ddx: number;
  ddy: number;
  nx: number;
  ny: number;
  fx: number;
  fy: number;
  /** spear: drawn (1), screen angle (deg, 0 = toward the foe, −90 up), compass mode (spin 1, yaw deg on the iso plane) */
  spear: number;
  sa: number;
  spin: number;
  yaw: number;
  /** spear free of the hand: at (spx, spy) relative to R */
  sfree: number;
  spx: number;
  spy: number;
  /** spear shape: 0 = the sovereign's long spear … 1 = the needle's own lozenge (summon split) */
  loz: number;
  /** the closed Kutup İğnesi piece drawn whole (summon f0…): 1 = present at (npx, npy) relative to R */
  npiece: number;
  npx: number;
  npy: number;
  /** crown: spin phase (turns), presence 0…1 (0 = folded on the pin), lift (px) */
  rose: number;
  roseK: number;
  roseY: number;
  /** pole glows (0…3): N heel / spear point, S horn / spear butt; spear tip flare level; poles swapped */
  poleN: number;
  poleS: number;
  tip: number;
  flip: number;
  /** the chest core window (0…3), climbing light rings (count, phase), spool spin phase, drum rattle (px) */
  core: number;
  rings: number;
  climb: number;
  spool: number;
  rattle: number;
  /** eyes: 0 dark … 1 lit … 2 white; lid 0 open, 1 half, 2 shut */
  eye: number;
  lid: number;
  /** field-line loops round the body (0 none … 2 blazing), flow phase; iron dust phase (−1 none) and amount */
  field: number;
  fph: number;
  dust: number;
  dustK: number;
  /** joint seams lit (0…3: gold → white KLAK flash), cracks along the joints (0…1) */
  seam: number;
  crack: number;
  /** attack / fx: release smear (px), tip flare 0…1, sparks phase (0 none), 1-px tremble (1 | 2), static 0…1 */
  smear: number;
  flare: number;
  spark: number;
  shake: number;
  zap: number;
  /** floor ring (iron-dust shockwave) 0…1, descent speed lines 0…1, compass trail span (deg) */
  ring: number;
  streak: number;
  trail: number;
  /** death: the spear's rip streak (0…1), the coil's unwound wire heap (0…1), shards of the base pushed out (px) */
  rip: number;
  wire: number;
  shard: number;
  /** dissolve front 0…1; gather = the dissolve run backwards (revive) */
  diss: number;
  gather: boolean;
  /** the anim's single metal glint (spear collar): 0 none, 1 = 1 px, 2 = cross */
  glint: number;
  /** aim along the iso bearing to the opposing lane (sa / yaw become offsets from it per side) */
  aim: number;
  /** global phase 0…1 */
  t: number;
}

export const NEUTRAL: Pose = {
  lift: 0, br: 0, cdx: 0, cdy: 0, hx: 0, hy: 0, gap: 0,
  adx: 0, ady: 0, aflip: 0, ctilt: 0,
  arms: 1, ddx: 0, ddy: 0, nx: 25, ny: -35, fx: -24, fy: -36,
  spear: 1, sa: -84, spin: 0, yaw: 0, sfree: 0, spx: 0, spy: 0, loz: 0,
  npiece: 0, npx: 0, npy: 0,
  rose: 0, roseK: 1, roseY: 0,
  poleN: 1, poleS: 1, tip: 1, flip: 0,
  core: 1.5, rings: 1, climb: 0, spool: 0, rattle: 0,
  eye: 1, lid: 0,
  field: 0, fph: 0, dust: -1, dustK: 1,
  seam: 0, crack: 0,
  smear: 0, flare: 0, spark: 0, shake: 0, zap: 0,
  ring: 0, streak: 0, trail: 0,
  rip: 0, wire: 0, shard: 0,
  diss: 0, gather: false, glint: 0, aim: 0, t: 0,
};
export const pose = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

/** Screen angle (deg) of the iso bearing to the opposing lane (TILE_W : TILE_H = 2 : 1). */
export const AIM_DEG = 27;
/** P1 ('left' light) aims up-right, the P2 relit sheet down-right (flipX → down-left at P1). */
export function resolveAim(o: Pose, lightFrom: 'left' | 'right'): Pose {
  if (o.aim <= 0) return o;
  if (o.spin > 0) return { ...o, aim: 0, yaw: o.yaw + (lightFrom === 'left' ? -50 : 50) };
  return { ...o, aim: 0, sa: o.sa + (lightFrom === 'left' ? -AIM_DEG : AIM_DEG) };
}

// ---------------------------------------------------------------- skeleton

export interface Skel {
  /** the anvil assembly origin (floor point under the plinth, sovereign orientation) */
  A: Pt;
  /** chest: spindle column, bottom flange top face y, drum lowest row y, top flange y */
  cx: number;
  f1: number;
  yb: number;
  f2: number;
  /** helm origin (top-left), visor row start, knob (= crown pin) */
  hd: Pt;
  visor: Pt;
  knob: Pt;
  rose: Pt;
  /** shoulders (spool hubs), elbows, wrists */
  shN: Pt;
  shF: Pt;
  elN: Pt;
  elF: Pt;
  wN: Pt;
  wF: Pt;
  /** spear pivot, axis (unit, toward the N point), lengths, half width, point, butt */
  sc: Pt;
  sd: Pt;
  sN: number;
  sS: number;
  shw: number;
  spt: Pt;
  sbt: Pt;
  /** the chest core window centre and the head (points) */
  core: Pt;
  head: Pt;
}

export const UPPER = 13;
export const FORE = 13;
/** the anvil flips about this local height (the middle of the assembly) */
const PIVOT = -14;
/** the closed needle's offset in the summon's exploded view (relative to R, before lift) — exported for the fusion */
export const NEEDLE_EXPLODED: Pt = [-30, -30];
/** the coil's rise in the exploded view (px above its seat) */
export const COIL_EXPLODED = 14;

const reach = (a: Pt, b: Pt, len: number): Pt => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy);
  return d <= len ? b : [a[0] + (dx / d) * len, a[1] + (dy / d) * len];
};

export function skeleton(o: Pose): Skel {
  const g = o.gap;
  const A: Pt = [RX + o.adx, GY - o.lift + o.ady];
  const cx = RX + 1 + o.cdx;
  // the chest's bottom flange face sits 30 px over the plinth floor point (its lower rim inside the cup)
  const f1 = GY - o.lift - 30 + o.cdy - rnd(g);
  const yb = f1 + 1;
  const f2 = yb - 26;
  const up = o.br - rnd(2 * g);
  // the helm takes the gap but not the breath (it follows the breath by its own hy, a frame late)
  const hu = -rnd(2 * g);
  const hd: Pt = [cx - 6 + o.hx, f2 - 9 + o.hy + hu];
  const knob: Pt = [cx + o.hx, f2 - 15 + o.hy + hu];
  const roseC: Pt = [knob[0], knob[1] - 4 - o.roseY];
  const shN: Pt = [cx + 14 + o.ddx, f2 + 1 + up + o.ddy];
  const shF: Pt = [cx - 13 - o.ddx, f2 - 1 + up + o.ddy];
  const L = UPPER + FORE - 0.5;
  // the hands keep their targets through the breath (the arms flex); they ride the gap and the detach
  const wN = reach(shN, [RX + o.nx + o.ddx, GY - o.lift + o.ny + hu + o.ddy], L);
  const wF = reach(shF, [RX + o.fx - o.ddx, GY - o.lift + o.fy + hu + o.ddy], L);
  // elbows bend down and out (a heavy arm hanging from the spool)
  const elN = ik2(shN, wN, UPPER, FORE, -1) as Pt;
  const elF = ik2(shF, wF, UPPER, FORE, 1) as Pt;
  const k = clamp(o.loz, 0, 1);
  let sN = 30 + (17 - 30) * k;
  let sS = 24 + (20 - 24) * k;
  const shw = 3 + 3 * k;
  let sd: Pt;
  let sc: Pt;
  if (o.spin > 0) {
    const cs = Math.cos(o.yaw * DEG);
    const sy = Math.sin(o.yaw * DEG) * 0.42;
    const m = Math.hypot(cs, sy) || 1;
    sd = [cs / m, sy / m];
    sN *= m;
    sS *= m;
    sc = o.sfree > 0 ? [RX + o.spx, GY + o.spy] : [wN[0], wN[1] + 1];
  } else {
    sd = [Math.cos(o.sa * DEG), Math.sin(o.sa * DEG)];
    sc = o.sfree > 0 ? [RX + o.spx, GY + o.spy] : [wN[0] + sd[0] * 2, wN[1] + sd[1] * 2];
  }
  return {
    A, cx, f1, yb, f2, hd, visor: [hd[0] + 8, hd[1] + 5], knob, rose: roseC, shN, shF, elN, elF, wN, wF,
    sc, sd, sN, sS, shw,
    spt: [sc[0] + sd[0] * sN, sc[1] + sd[1] * sN],
    sbt: [sc[0] - sd[0] * sS, sc[1] - sd[1] * sS],
    core: [cx, yb - WIN_LO - 1],
    head: [hd[0] + 7, hd[1] + 5],
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

// ---------------------------------------------------------------- the base (Kutup Örsü, upside down)

/** local anvil-assembly point (sovereign orientation, origin = floor point) → frame px, through the flip */
function anvilMap(f: Frame): (p: Pt) => Pt {
  const { sk, o } = f;
  const c = Math.cos(Math.PI * clamp(o.aflip, 0, 1));
  return ([x, y]: Pt): Pt => [sk.A[0] + x, sk.A[1] + PIVOT + (y - PIVOT) * c];
}

/** the plinth: the anvil's top block, inverted (face down = the sole, horn forward along the floor) */
const PLINTH: Pt[] = TOP_POLY.map(([x, y]) => [x, -(y + 29) + 0] as Pt);
/** the hip cup: the anvil's flared foot block, inverted (its feet = the wide lip, the arch = a notch at the lip) */
const CUP: Pt[] = BASE_POLY.map(([x, y]) => [x, -16 - (y + 11)] as Pt);

function drawBase(f: Frame): void {
  const { light, o } = f;
  const map = anvilMap(f);
  const c = Math.cos(Math.PI * clamp(o.aflip, 0, 1));
  const thin = Math.abs(c) < 0.2;
  const sh = o.shard;
  const mark = (q: PixelCanvas, x: number, y: number, col: number) => {
    const [X, Y] = map([x, y]);
    const xi = rnd(X - 0.5);
    const yi = rnd(Y - 0.5);
    if (q.isOpaque(xi, yi)) q.set(xi, yi, col);
  };
  // plinth (shards: its two halves push out sideways in the death)
  const halves: [Pt[], number][] = sh > 0
    ? [[PLINTH.map(([x, y]) => [Math.min(x, 6) - sh, y] as Pt).filter((_, i, a) => a.length > 0), -1], [PLINTH.map(([x, y]) => [Math.max(x, 6) + sh, y] as Pt), 1]]
    : [[PLINTH, 0]];
  for (const [poly] of halves) {
    const q = layer();
    q.poly(poly.map(map), IRON.M);
    bands(q, IRON, light, 3, 3, { top: thin ? 0 : 1 });
    if (!thin) {
      // the polished striking face is now the sole (2 rows at the floor); flipped up it is the bright top face
      for (let x = -24; x <= 30; x++) {
        mark(q, x + (x > 6 ? sh : -sh) * (sh > 0 ? 1 : 0), -0.5, c > 0 ? POLISH.S : POLISH.M);
        mark(q, x + (x > 6 ? sh : -sh) * (sh > 0 ? 1 : 0), -1.5, c > 0 ? POLISH.M : POLISH.L);
      }
      // the gold strap round the block, the N heel well, a seam under the old face line
      for (let y = -10; y <= -2; y++) for (let x = -5; x <= -3; x++) mark(q, x - (sh > 0 ? sh : 0), y + 0.5, x === -5 ? GOLD.L : x === -3 ? GOLD.S : GOLD.M);
      for (let y = -8; y <= -3; y++) for (let x = -24; x <= -22; x++) mark(q, x - sh, y + 0.5, PAL.stone0);
      for (let x = -20; x <= 16; x += 4) mark(q, x, -9.5, PAL.stone1);
    }
    f.comp.add(q, Part.plinth, { out: PAL.stone0 });
  }
  // waist
  const w = layer();
  w.poly(([[-10, -11], [13, -11], [13, -17], [-10, -17]] as Pt[]).map(map), IRON.M);
  bands(w, IRON, light, 3, 3, { top: 0 });
  for (let x = -10; x <= 12; x++) mark(w, x + 0.5, -16.5, PAL.stone1);
  f.comp.add(w, Part.waist, { out: PAL.stone0 });
}

function drawCup(f: Frame): void {
  const { light, o } = f;
  const map = anvilMap(f);
  const c = Math.cos(Math.PI * clamp(o.aflip, 0, 1));
  const sh = o.shard;
  const mark = (q: PixelCanvas, x: number, y: number, col: number) => {
    const [X, Y] = map([x, y]);
    const xi = rnd(X - 0.5);
    const yi = rnd(Y - 0.5);
    if (q.isOpaque(xi, yi)) q.set(xi, yi, col);
  };
  const parts: Pt[][] = sh > 0
    ? [CUP.map(([x, y]) => [Math.min(x, 1) - sh * 1.4, y - sh * 0.6] as Pt), CUP.map(([x, y]) => [Math.max(x, 1) + sh * 1.4, y - sh * 0.6] as Pt)]
    : [CUP];
  for (const poly of parts) {
    const q = layer();
    q.poly(poly.map(map), IRON.M);
    bands(q, IRON, light, 3, 3, { top: Math.abs(c) < 0.2 ? 0 : 1 });
    // the gold band (the old band over the feet: now low on the cup) with its rivet pair, a dark lip under the notch
    for (let x = -15; x <= 16; x++) {
      mark(q, x + 0.5, -17.5 + (c < 0 ? 0 : 0), c > 0 ? GOLD.S : GOLD.L);
      mark(q, x + 0.5, -18.5, c > 0 ? GOLD.L : GOLD.S);
    }
    for (const x of [-11, 11]) mark(q, x + 0.5, -22.5, PAL.stone3);
    f.comp.add(q, Part.cup, { out: PAL.stone0 });
  }
}

// ---------------------------------------------------------------- the chest (Kutup Bobini, seated)

function drawChest(f: Frame): void {
  const { sk, o, light } = f;
  if (o.ctilt > 0) {
    drawChestTopple(f);
    return;
  }
  const b = layer();
  paintFlange(b, sk.cx, sk.f1, 14, 3, 3, light);
  f.comp.add(b, Part.coil, { out: PAL.stone0 });
  const d = layer();
  paintDrum(d, { cx: sk.cx, yb: sk.yb, rx: DRUM_RX, wind: 1, fromTop: 0, rattle: o.rattle }, light);
  f.comp.add(d, Part.coil, { out: PAL.fire0 });
  const t = layer();
  paintFlange(t, sk.cx, sk.f2, 14, 3, 3, light);
  f.comp.add(t, Part.coil, { out: PAL.stone0 });
}

function drawChestTopple(f: Frame): void {
  const { o, light } = f;
  const th = clamp(o.ctilt, 0, 1) * 84 * DEG;
  const cs = Math.cos(th);
  const sn = Math.sin(th);
  const sk = f.sk;
  // spindle-local frame: x lateral (−14…14), y up from the bottom flange rim (0 … −56); tips toward −x (back)
  const P: Pt = [sk.cx - 14, sk.f1 + 6];
  // R(−θ): the spindle's up turns toward the back (−x), pivoting on the bottom flange's back rim
  const rot = ([x, y]: Pt): Pt => {
    const lx = x + 14;
    return [P[0] + lx * cs + y * sn, P[1] - lx * sn + y * cs];
  };
  const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => ([[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as Pt[]).map(rot);
  const part = (pts: Pt[], t: Tones, out: number, lw = 2) => {
    const q = layer();
    q.poly(pts, t.M);
    bands(q, t, light, lw, lw, { top: 1 });
    f.comp.add(q, Part.coil, { out });
  };
  const CU: Tones = { H: COPPER.H, L: COPPER.L, M: COPPER.M, S: COPPER.S };
  part(box(-14, -6, 14, 0), MAG, PAL.stone0);
  // the drum: copper turns half unwound (the wire runs out to the heap)
  const r = rnd(11 - 7 * clamp(o.wire, 0, 1));
  part(box(-r, -32, r, -6), CU, PAL.fire0);
  // winding seams across the toppled drum
  const q = layer();
  for (let k = 1; k < 9; k++) {
    const a = rot([-r, -6 - k * 3]);
    const b = rot([r, -6 - k * 3]);
    q.line(rnd(a[0]), rnd(a[1]), rnd(b[0]), rnd(b[1]), k % 3 === 1 ? COPPER.L : PAL.fire0);
  }
  f.comp.add(q, Part.coil, {});
  part(box(-14, -38, 14, -32), MAG, PAL.stone0);
  part(box(-6, -48, 7, -38), MAG, PAL.stone0);
}

function drawHead(f: Frame): void {
  const { sk, light, o } = f;
  if (o.ctilt > 0) return;
  const [hx, hy] = [rnd(sk.hd[0]), rnd(sk.hd[1])];
  // the spindle tip through the helm: rod + gold knob (the crown pin)
  const tip = layer();
  tip.poly(tubePoly([sk.knob[0], sk.knob[1] + 2], [sk.knob[0], hy + 1], 2.4), MAG.M);
  bands(tip, MAG, light, 1, 1, { top: 0 });
  f.comp.add(tip, Part.head, { out: PAL.ink });
  const kb = layer();
  const [kx, ky] = [rnd(sk.knob[0]), rnd(sk.knob[1])];
  kb.poly([[kx - 2, ky - 1], [kx + 2, ky - 1], [kx + 3, ky + 1], [kx + 2, ky + 2], [kx - 2, ky + 2], [kx - 3, ky + 1]], GOLD.M);
  bands(kb, GOLD, light, 1, 1);
  f.comp.add(kb, Part.head, { out: PAL.gold0 });
  // the helm: the coil's magnetite dome given the needle's visor point toward the foe
  const q = layer();
  q.poly([[hx + 2, hy], [hx + 10, hy], [hx + 12, hy + 2], [hx + 13, hy + 4], [hx + 16, hy + 6], [hx + 13, hy + 8], [hx + 13, hy + 11], [hx, hy + 11], [hx, hy + 4], [hx + 1, hy + 1]], MAG.M);
  bands(q, MAG, light, 2, 2, { top: 1, rim: true });
  const [vx, vy] = sk.visor;
  for (let x = vx - 3; x <= vx + 6; x++) for (const y of [vy, vy + 1]) if (q.isOpaque(x, y)) q.set(x, y, PAL.stone0);
  for (let x = hx + 1; x <= hx + 13; x++) if (q.isOpaque(x, vy - 2)) q.set(x, vy - 2, x < vx - 2 ? GOLD.S : GOLD.L);
  // a crown circlet: the gold band across the helm's crown line
  for (let x = hx + 2; x <= hx + 11; x++) if (q.isOpaque(x, hy + 1)) q.set(x, hy + 1, x <= hx + 5 ? GOLD.L : GOLD.M);
  f.comp.add(q, Part.head, { out: PAL.stone0 });
}

function drawRose(f: Frame, front: boolean): void {
  const { sk, o, light } = f;
  if (o.roseK <= 0.05 || o.ctilt > 0) return;
  const q = layer();
  const k = clamp(o.roseK, 0, 1);
  const [cx, cy] = [rnd(sk.rose[0]), rnd(sk.rose[1])];
  rose(q, { cx, cy, phase: o.rose, rx: Math.max(1, rnd(11 * k)), ry: Math.max(1, rnd(4 * k)), arm: k > 0.5 ? 3 : 1, ring: k > 0.3, flip: o.flip > 0 }, front, light);
  if (front) rosePin(q, cx, cy, light);
  f.comp.add(q, front ? Part.roseF : Part.roseB, {});
}

function drawSpool(f: Frame, near: boolean): void {
  const { o, sk, light } = f;
  if (o.ctilt > 0) return;
  const [x, y] = near ? sk.shN : sk.shF;
  const q = layer();
  paintSpool(q, x, y, near ? 5 : 4, near ? o.spool : -o.spool * 1.3, light, 1, !near);
  f.comp.add(q, near ? Part.spoolN : Part.spoolF, { out: near ? PAL.stone0 : PAL.ink });
  // the pauldron: a small compass needle laid across the shoulder (the needle's shell plates guard the shoulders):
  // its outer point is the pole of that half — fire N at the back shoulder, water S at the front one
  const pd = layer();
  const dir: Pt = near ? [0.94, -0.34] : [-0.94, -0.34];
  needle(pd, { c: [x + (near ? 1 : -1), y - 5], d: dir, lenN: near ? 10 : 9, lenS: near ? 6 : 5, hw: near ? 3.6 : 3.2, band: 2.2, collar: true, flip: near !== (o.flip > 0), far: !near, pivot: near ? 1.6 : 0 }, light);
  f.comp.add(pd, near ? Part.spoolN : Part.spoolF, { out: near ? PAL.stone0 : PAL.ink });
}

function drawArm(f: Frame, near: boolean): void {
  const { sk, light, o } = f;
  if (o.arms <= 0) return;
  const sh = near ? sk.shN : sk.shF;
  const el = near ? sk.elN : sk.elF;
  const w = near ? sk.wN : sk.wF;
  const t = near ? MAG : MAG_FAR;
  const g = near ? GOLD : GOLD_FAR;
  const q = layer();
  q.poly(taperPoly(sh, el, near ? 7 : 6, near ? 5.6 : 4.6), t.M);
  q.poly(taperPoly(el, w, near ? 5.6 : 4.6, near ? 4.6 : 3.6), t.M);
  bands(q, t, light, 2, 1, { rim: near });
  // greave-like forearm guard (the needle's shin plate)
  const gd = layer();
  gd.poly(taperPoly([el[0] + (w[0] - el[0]) * 0.15, el[1] + (w[1] - el[1]) * 0.15], [el[0] + (w[0] - el[0]) * 0.65, el[1] + (w[1] - el[1]) * 0.65], near ? 6 : 5, near ? 4.4 : 3.6), t.L);
  bands(gd, { H: t.H, L: t.H, M: t.L, S: t.M }, light, 1, 1);
  q.blit(gd, 0, 0);
  // gold elbow ring
  q.disc(rnd(el[0] - 0.5), rnd(el[1] - 0.5), near ? 2 : 1.6, g.M);
  q.set(rnd(el[0] - 0.5) + (light.side < 0 ? -1 : 1), rnd(el[1] - 0.5) - 1, g.L);
  f.comp.add(q, near ? Part.armN : Part.armF, { out: near ? PAL.stone1 : PAL.ink });
  if (!near || o.spear <= 0 || o.sfree > 0) drawFist(f, near);
}

/** the fist / gauntlet with its gold cuff (drawn over the spear for the near hand: it GRIPS it) */
function drawFist(f: Frame, near: boolean): void {
  const { sk, light, o } = f;
  if (o.arms <= 0) return;
  const w = near ? sk.wN : sk.wF;
  const el = near ? sk.elN : sk.elF;
  const t = near ? MAG : MAG_FAR;
  const g = near ? GOLD : GOLD_FAR;
  const q = layer();
  const [x, y] = [rnd(w[0] - 0.5), rnd(w[1] - 0.5)];
  q.poly([[x - 2, y - 2], [x + 2, y - 2], [x + 3, y], [x + 2, y + 3], [x - 2, y + 3], [x - 3, y]], t.M);
  bands(q, t, light, 1, 1, { top: 1 });
  // the cuff (2 px band across the forearm just above the fist)
  const ux = (w[0] - el[0]) / (Math.hypot(w[0] - el[0], w[1] - el[1]) || 1);
  const uy = (w[1] - el[1]) / (Math.hypot(w[0] - el[0], w[1] - el[1]) || 1);
  q.poly(tubePoly([w[0] - ux * 3.5, w[1] - uy * 3.5], [w[0] - ux * 1.5, w[1] - uy * 1.5], near ? 5.4 : 4.4), g.M);
  q.set(rnd(w[0] - ux * 3), rnd(w[1] - uy * 3) - 1, g.L);
  f.comp.add(q, Part.fist, { out: near ? PAL.stone1 : PAL.ink });
}

function spearLayer(f: Frame, half?: 1 | -1): PixelCanvas {
  const { sk, o, light } = f;
  const q = layer();
  const spec = { c: sk.sc, d: sk.sd, lenN: sk.sN, lenS: sk.sS, hw: sk.shw, band: 3, flip: o.flip > 0, collar: true, half, pivot: o.loz > 0.5 ? 2 : 0 };
  needle(q, spec, light);
  if (o.smear > 0) {
    // HA-12: the release smear — the spear stretched back along its own axis (part of the body, outlined with it)
    const g = layer();
    for (let i = 1; i <= o.smear; i++) needle(g, { ...spec, c: [sk.sc[0] - sk.sd[0] * i, sk.sc[1] - sk.sd[1] * i] }, light);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!q.isOpaque(x, y) && g.isOpaque(x, y)) q.set(x, y, PAL.fire2);
  }
  return q;
}

// ---------------------------------------------------------------- light layer

const inF = (x: number, y: number) => x >= 1 && y >= 1 && x < W - 1 && y < H - 1;

function put(f: Frame, x: number, y: number, c: number, behind = false): void {
  x = rnd(x);
  y = rnd(y);
  if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) return;
  if (behind && f.p.isOpaque(x, y)) return;
  f.p.set(x, y, c);
}

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

/** The base's poles: the N heel plate (fire, back) and the S horn tip (water, forward along the floor). */
function basePoles(f: Frame): void {
  const { o } = f;
  if (o.aflip > 0.3 && o.aflip < 0.7) return;
  const map = anvilMap(f);
  const set = guarded(f, [Part.plinth]);
  const fN = o.flip > 0;
  const nR = fN ? [PAL.water2, PAL.water3, PAL.water4] : [PAL.fire2, PAL.fire3, PAL.fire4];
  const sR = fN ? [PAL.fire2, PAL.fire3, PAL.fire4] : [PAL.water2, PAL.water3, PAL.water4];
  const kN = clamp(fl(o.poleN), 0, 2);
  const kS = clamp(fl(o.poleS), 0, 2);
  // heel glyph: a 2×4 bar in the heel well
  for (let y = -7; y <= -4; y++) for (const x of [-23.5, -22.5]) {
    const [X, Y] = map([x - o.shard, y + 0.5]);
    set(X - 0.5, Y - 0.5, y === -6 || y === -5 ? nR[kN] : nR[Math.max(0, kN - 1)]);
  }
  // horn tip light (the last 3 px of the prow)
  for (const [x, y, d] of [[34.5, -2.5, 0], [33.5, -2.5, 1], [32.5, -3.5, 2]] as const) {
    const [X, Y] = map([x + o.shard, y]);
    set(X - 0.5, Y - 0.5, sR[Math.max(0, kS - d)]);
  }
}

/** The chest core window (N fire left / S water right halves, white seam at full charge) + seam leaks. */
function coreLight(f: Frame): void {
  const { o, sk } = f;
  if (o.core <= 0.05 || o.ctilt > 0) return;
  const set = guarded(f, [Part.coil]);
  const d: DrumSpec = { cx: sk.cx, yb: sk.yb, rx: DRUM_RX, wind: 1, fromTop: 0, rattle: o.rattle };
  const lv = clamp(o.core, 0, 3.9);
  const k = fl(lv);
  const fN = o.flip > 0;
  for (let x = sk.cx - DRUM_RX; x <= sk.cx + DRUM_RX; x++) {
    const s = sagAt(x, sk.cx, DRUM_RX);
    for (let r = WIN_LO; r <= WIN_HI; r++) {
      if (!isWound(r, d)) continue;
      const y = sk.yb + s - r;
      const u = (x + 0.5 - sk.cx) / (DRUM_RX + 0.5);
      const edge = Math.abs(u) > 0.62;
      const mid = r === WIN_LO + 1;
      const north = (x + 0.5 < sk.cx) !== fN;
      if (!mid && (k < 3 || Math.abs(u) > 0.45)) {
        if (k >= 1 && !edge) set(x, y, north ? PAL.fire0 : PAL.water0);
        continue;
      }
      const ramp: number[] = north ? [PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4] : [PAL.water1, PAL.water2, PAL.water3, PAL.water4];
      let c: number = ramp[clamp(k + 1 - (edge ? 2 : mid ? 0 : 1), 0, 3)];
      if (mid && !edge && k >= 2) c = north ? (Math.abs(u) < 0.3 ? PAL.gold4 : PAL.fire4) : Math.abs(u) < 0.3 ? PAL.water4 : PAL.water3;
      if (Math.abs(x + 0.5 - sk.cx) <= 1 && k >= 2) c = k >= 3 ? PAL.white : north ? PAL.gold4 : PAL.water4;
      set(x, y, c);
    }
  }
  if (lv < 1) return;
  // seam leaks: the two seams next to the window flicker (N above, S below)
  for (let x = sk.cx - DRUM_RX + 3; x <= sk.cx + DRUM_RX - 3; x++) {
    const s = sagAt(x, sk.cx, DRUM_RX);
    for (const r of [WIN_LO - 3, WIN_HI + 1]) {
      const on = (x + r + fl(o.t * 20)) % 6 < (lv >= 2.5 ? 3 : 2);
      if (!on) continue;
      const top = r > WIN_HI;
      set(x, sk.yb + s - r, top !== fN ? (lv >= 2.5 ? PAL.gold4 : PAL.fire3) : lv >= 2.5 ? PAL.water4 : PAL.water3);
    }
  }
}

/** Light rings climbing the turns (bottom → top), gold across the drum. */
function climbLight(f: Frame): void {
  const { o, sk, light } = f;
  if (o.rings <= 0 || o.ctilt > 0) return;
  const set = guarded(f, [Part.coil]);
  const n = Math.round(o.rings);
  for (let j = 0; j < n; j++) {
    const h = (o.climb + j / n) % 1;
    const r0 = Math.floor(h * (DRUM_ROWS + 2)) - 1;
    for (let x = sk.cx - DRUM_RX - 1; x <= sk.cx + DRUM_RX + 1; x++) {
      const s = sagAt(x, sk.cx, DRUM_RX);
      for (let r = r0; r <= r0 + 1; r++) {
        if (r < 0 || r >= DRUM_ROWS) continue;
        const [t2, row] = turnOf(r);
        if (t2 < 0) continue;
        const lx = x - (t2 % 2 ? o.rattle : 0);
        const u = (lx + 0.5 - sk.cx) / (DRUM_RX + 0.5);
        if (Math.abs(u) > 1.02) continue;
        const t = u * light.side;
        const lit = t > 0.3 ? 2 : t > -0.45 ? 1 : 0;
        const kk = clamp(lit + (row === 2 ? 1 : row === 1 ? 0 : -1), 0, 4);
        set(x, sk.yb + s - r, [RING.D, RING.S, RING.M, RING.L, RING.H][kk]);
      }
    }
  }
  void TURNS;
}

function eyeLight(f: Frame): void {
  const { o, sk } = f;
  if (o.eye <= 0.05 || o.ctilt > 0 || o.lid >= 2) return;
  const set = guarded(f, [Part.head]);
  const [vx, vy] = sk.visor;
  const hot = o.eye > 1.5;
  const rows = o.lid === 1 ? [vy + 1] : [vy, vy + 1];
  const fN = o.flip > 0;
  const nA = fN ? [PAL.water4, PAL.water3, PAL.water2] : [PAL.fire3, PAL.fire2, PAL.fire1];
  const sA = fN ? [PAL.fire4, PAL.fire3, PAL.fire2] : [PAL.water4, PAL.water3, PAL.water2];
  for (const y of rows) {
    set(vx - 1, y, hot ? PAL.white : o.eye > 0.6 ? nA[0] : nA[2]);
    set(vx, y, hot ? (fN ? PAL.water4 : PAL.fire4) : o.eye > 0.6 ? nA[1] : nA[2]);
    set(vx + 3, y, hot ? PAL.white : o.eye > 0.6 ? sA[0] : sA[2]);
    set(vx + 4, y, hot ? sA[0] : o.eye > 0.6 ? sA[1] : sA[2]);
  }
  if (o.eye > 0.6 && o.lid === 0) set(vx + 5, vy + 1, sA[2]);
}

/** Pole tips of the spear (N point fire, S butt water) and the crown pin bead. */
function spearPoles(f: Frame): void {
  const { o, sk, p } = f;
  if (o.spear <= 0 || o.rip >= 1) return;
  const dot = (x: number, y: number, c: number) => { if (inF(x, y)) p.set(x, y, c); };
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
  const back = o.spin > 0 && Math.cos(o.yaw * DEG) < -0.2;
  if (!back) tipAt(sk.spt, sk.sd, o.tip * (o.poleN >= 1.5 ? 1.2 : 1), fN ? PAL.water4 : PAL.fire4, fN ? PAL.water3 : PAL.gold4);
  tipAt(sk.sbt, [-sk.sd[0], -sk.sd[1]], o.poleS * 0.9, fN ? PAL.fire4 : PAL.water4, fN ? PAL.gold4 : PAL.water3);
}

/** Field lines: two big dotted loops round the body from the N (back, fire) half to the S (front, water) half. */
function fieldLight(f: Frame): void {
  const { o, sk } = f;
  if (o.field <= 0 || o.ctilt > 0) return;
  const cx = sk.cx;
  const top = sk.knob[1] + 2;
  const bot = sk.A[1] - 6;
  const lv = o.field;
  const loops = lv >= 1.5 ? [1, 0.7] : [1];
  for (const k of loops)
    for (const side of [-1, 1]) {
      const R = (24 + 6 * Math.min(lv, 2)) * k;
      const n = 70;
      for (let i = 1; i < n; i++) {
        const u = i / n;
        if (((i + fl(o.fph * 6) * side) % 3 + 3) % 3 === 0) continue;
        const y = top + (bot - top) * u;
        const x = cx + side * Math.sin(Math.PI * u) * R;
        const north = (side < 0) !== o.flip > 0;
        const hot = lv >= 1.5 && i % 2 === 0;
        put(f, x, y, north ? (hot ? PAL.fire4 : PAL.fire3) : hot ? PAL.water4 : PAL.water3, true);
      }
    }
}

/** Iron dust: 2-px grains running the field loops (idle's living detail). */
function dustLight(f: Frame): void {
  const { o, sk } = f;
  if (o.dust < 0 || o.ctilt > 0) return;
  const cx = sk.cx;
  const top = sk.knob[1] + 4;
  const bot = sk.A[1] - 10;
  const n = rnd(6 * o.dustK);
  for (const loop of [0, 1])
    for (const side of [-1, 1])
      for (let i = 0; i < n; i++) {
        // two field loops (inner turns twice as fast); each grain a short 3-px streak along its line
        const u = ((o.dust * (loop ? 2 : 1)) + i / n + (side > 0 ? 0.13 : 0) + loop * 0.07) % 1;
        if (u < 0.1 || u > 0.92) continue;
        const R = (loop ? 16 : 22) + (i % 2) * 4;
        const at = (uu: number): Pt => [cx + side * Math.sin(Math.PI * uu) * R, top + (bot - top) * uu];
        const c = i % 2 ? PAL.stone4 : PAL.steel;
        const [x, y] = at(u);
        const [x2, y2] = at(u - 0.025);
        put(f, x, y, c, true);
        put(f, x2, y2, PAL.stone3, true);
        put(f, x + side, y, c, true);
      }
}

/** The joint seams (waist top, cup lip, shoulders): gold when the magnet holds, white on a KLAK. */
function seamLight(f: Frame): void {
  const { o, sk } = f;
  if (o.seam <= 0.05 && o.crack <= 0) return;
  const lv = o.seam;
  const col = lv >= 2.5 ? PAL.white : lv >= 1.5 ? PAL.gold4 : PAL.gold3;
  const set = guarded(f, [Part.cup, Part.coil, Part.waist, Part.spoolN, Part.spoolF, Part.armN, Part.armF, Part.head, Part.plinth]);
  // the cup lip (where the chest's flange sits)
  const lipY = sk.A[1] - 28;
  if (lv > 0.05) {
    for (let x = sk.cx - 16; x <= sk.cx + 16; x++) {
      if ((x + fl(o.t * 12)) % 3 === 0 && lv < 2.5) continue;
      set(x, lipY, col);
    }
    // the waist joint
    for (let x = sk.A[0] - 9; x <= sk.A[0] + 12; x++) set(x, sk.A[1] - 17, lv >= 2.5 ? PAL.white : PAL.gold3);
    // the shoulder hubs and the neck (helm over the top flange)
    for (const s of [sk.shN, sk.shF]) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]] as const) set(s[0] + dx, s[1] + dy, col);
    for (let x = rnd(sk.hd[0]) + 1; x <= rnd(sk.hd[0]) + 12; x++) set(x, rnd(sk.hd[1]) + 11, lv >= 2.5 ? PAL.white : PAL.gold3);
  }
  if (o.crack > 0) {
    // cracks run from the joints into the parts: straight 1-px lines with a lit lower lip (stone rule, MA)
    const len = rnd(3 + 9 * o.crack);
    const starts: [number, number, number][] = [
      [sk.cx - 10, lipY, -1], [sk.cx + 9, lipY, 1], [sk.cx - 3, sk.yb - 4, -1], [sk.cx + 5, sk.f2 + 4, 1],
      [sk.A[0] - 4, sk.A[1] - 12, -1], [sk.A[0] + 8, sk.A[1] - 6, 1],
    ];
    for (const [x0, y0, s] of starts) {
      let x = x0;
      let y = y0;
      for (let i = 0; i < len; i++) {
        set(x, y, o.crack > 0.6 ? (i < 3 ? PAL.white : PAL.gold4) : PAL.stone0);
        set(x, y + 1, PAL.gold2);
        x += s * (i % 3 === 2 ? 0 : 1);
        y += i % 2 ? 1 : -1;
      }
    }
  }
}

function sparkLight(f: Frame): void {
  const { o, sk } = f;
  if (o.spark <= 0) return;
  const ph = o.spark;
  const at: Pt = o.flare > 0 || o.smear > 0 ? sk.spt : o.sfree > 0 || o.spear <= 0 ? [sk.cx, sk.A[1] - 28] : [sk.sbt[0], sk.sbt[1]];
  for (let i = 0; i < 8; i++) {
    const a = hash2(i, 3, 7) * TAU;
    const d = 2 + ph * (6 + hash2(i, 9, 2) * 9);
    const x = at[0] + Math.cos(a) * d;
    const y = at[1] + Math.sin(a) * d * 0.7 + ph * ph * 6;
    put(f, x, y, ph < 0.4 ? PAL.white : i % 2 ? PAL.fire4 : PAL.water4);
    if (ph < 0.7) put(f, x + (Math.cos(a) > 0 ? 1 : -1), y, i % 2 ? PAL.fire3 : PAL.water3);
  }
}

function flareLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.flare <= 0 || o.spear <= 0) return;
  const x = rnd(sk.spt[0] - 0.5);
  const y = rnd(sk.spt[1] - 0.5);
  if (!inF(x, y)) return;
  p.rect(x - 1, y - 1, 3, 3, PAL.white);
  const L = o.flare > 0.6 ? 5 : 3;
  for (let i = 2; i <= L; i++) {
    const c = i < 4 ? PAL.fire4 : PAL.gold4;
    for (const [dx, dy] of [[i, 0], [-i, 0], [0, -i], [0, i]] as const) put(f, x + dx, y + dy, c);
  }
  if (o.flare > 0.6) for (const [dx, dy, c] of [[2, -2, PAL.fire4], [2, 2, PAL.water4], [-2, -2, PAL.water4], [-2, 2, PAL.fire4]] as const) put(f, x + dx, y + dy, c);
}

/** hitMagic: static arcs crawl over the body (fire / water alternating: the poles fighting). */
function zapLight(f: Frame): void {
  const { o, sk } = f;
  if (o.zap <= 0) return;
  const set = guarded(f, [Part.coil, Part.cup, Part.head, Part.armN, Part.armF, Part.spear, Part.plinth]);
  const ph = fl(o.t * 17);
  const starts: Pt[] = [[sk.cx - 6, sk.yb - 4], [sk.cx + 6, sk.yb - 18], [sk.hd[0] + 5, sk.hd[1] + 3], [sk.elN[0], sk.elN[1]], [sk.A[0] + 10, sk.A[1] - 22], [sk.sc[0], sk.sc[1] - 12]];
  starts.forEach(([x0, y0], k) => {
    const len = rnd(4 + 7 * o.zap);
    let x = rnd(x0);
    let y = rnd(y0);
    for (let i = 0; i < len; i++) {
      const j = hash2(i, ph, k * 13 + 5);
      const a = (j - 0.5) * 2.4 + (k % 2 ? Math.PI : 0) + Math.PI / 2;
      x += rnd(Math.cos(a) * 1.5);
      y += rnd(Math.sin(a) * 1.5);
      set(x, y, i === 0 ? PAL.white : (i + k) % 2 ? PAL.fire4 : PAL.water4);
    }
  });
}

/** Floor ring: the iron-dust shockwave snapping out round the plinth (fire behind, water in front). */
function ringLight(f: Frame): void {
  const { o, sk } = f;
  if (o.ring <= 0) return;
  const rx = 18 + o.ring * 34;
  const ry = rx * 0.36;
  const n = rnd(rx * 6);
  const cy = GY - 1;
  for (let i = 0; i < n; i++) {
    if (i % 6 === 5) continue;
    const a = (i / n) * TAU;
    const x = sk.A[0] + 6 + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    if (y > H - 3) continue;
    const back = Math.cos(a) < 0;
    const c = o.ring < 0.5 ? (Math.sin(a) > 0 ? PAL.white : back ? PAL.fire4 : PAL.water4) : back ? PAL.fire2 : PAL.water2;
    put(f, x, y, c, Math.sin(a) < 0);
    // grains thrown inside the ring (iron dust)
    if (i % 9 === 0 && o.ring < 0.8) put(f, sk.A[0] + 6 + Math.cos(a) * rx * 0.7, cy + Math.sin(a) * ry * 0.7 - 2, PAL.stone4, true);
  }
}

/** The summon descent: speed lines up both flanks (fire behind, water in front). */
function streakLight(f: Frame): void {
  const { o, sk } = f;
  if (o.streak <= 0) return;
  const top = Math.max(3, rnd(sk.knob[1]) - 16);
  const bot = rnd(sk.A[1]) - 4;
  for (const [dx, c0, c1, y0] of [[-24, PAL.fire3, PAL.fire2, top + 10], [28, PAL.water3, PAL.water2, top + 6], [-30, PAL.mist, PAL.steel, top + 18], [34, PAL.mist, PAL.steel, top + 14]] as const) {
    const x = sk.cx + dx;
    const y1 = y0 + rnd((bot - y0) * clamp(o.streak, 0, 1));
    for (let y = y0; y <= y1; y++) put(f, x, y, y < y0 + (y1 - y0) * 0.5 ? c1 : c0, true);
  }
}

/** The compass spin trail: the iso arc the spear's two ends just swept. */
function trailLight(f: Frame): void {
  const { o, sk } = f;
  if (o.trail === 0 || o.spin <= 0) return;
  const [cx, cy] = sk.sc;
  const steps = Math.max(8, rnd(Math.abs(o.trail) / 6));
  for (let i = 1; i <= steps; i++) {
    const a = (o.yaw - (o.trail * i) / steps) * DEG;
    for (const [len, hot, cool, sgn] of [[sk.sN / Math.max(0.3, Math.hypot(Math.cos(o.yaw * DEG), Math.sin(o.yaw * DEG) * 0.42)) - 2, PAL.fire3, PAL.fire2, 1], [24 - 2, PAL.water3, PAL.water2, -1]] as const) {
      const L = Math.min(len, 30);
      put(f, cx + sgn * Math.cos(a) * L, cy + sgn * Math.sin(a) * L * 0.42, i <= steps / 2 ? hot : cool, true);
    }
  }
}

/** death: the needle-spear ripped away — its two-colour wake toward the top-left; the coil's wire heap. */
function deathLight(f: Frame): void {
  const { o, sk } = f;
  if (o.rip > 0) {
    const x0 = rnd(sk.sc[0]);
    const y0 = rnd(sk.sc[1]);
    const n = rnd(26 * o.rip);
    for (let i = 0; i < n; i++) {
      const x = x0 - i;
      const y = y0 - rnd(i * 0.7);
      put(f, x, y, i < n / 2 ? PAL.fire4 : PAL.fire2, true);
      put(f, x + 1, y + 2, i < n / 2 ? PAL.water4 : PAL.water2, true);
    }
  }
}

function heapLayer(f: Frame): void {
  const { o, sk } = f;
  if (o.wire <= 0) return;
  const q = layer();
  const cx = sk.cx - 30;
  const k = clamp(o.wire, 0, 1);
  const loops = 1 + rnd(3 * k);
  for (let j = 0; j < loops; j++) {
    const rx = 4 + j * 2.6;
    const ry = 1.5 + j * 0.7;
    const ox = (hash2(j, 3, 1) - 0.5) * 6 + j * 1.5;
    const oy = -1 - j * 0.8;
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * TAU;
      const x = rnd(cx + ox + Math.cos(a) * rx);
      const y = rnd(GY + oy + Math.sin(a) * ry);
      if (y > GY || y < 2 || x < 2) continue;
      q.set(x, y, Math.sin(a) < 0 ? COPPER.L : COPPER.M);
    }
  }
  f.comp.add(q, Part.debris, { out: PAL.fire0 });
}

function glintLight(f: Frame): void {
  const { o, sk } = f;
  if (o.glint <= 0 || o.spear <= 0) return;
  const x = rnd(sk.sc[0] - 0.5 + sk.sd[0] * 5);
  const y = rnd(sk.sc[1] - 0.5 + sk.sd[1] * 5);
  put(f, x, y, PAL.white);
  if (o.glint >= 2) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) put(f, x + dx, y + dy, PAL.gold4);
}

export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
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
      const u = clamp((ry + 80) / 82, 0, 1);
      const thr = 0.8 * u + 0.2 * hash2(cx, cy, 7);
      if (thr < o.diss - front) {
        gone.push(x, y);
        if (!o.gather && (rx & 1) === 0 && (ry & 1) === 0 && hash2(cx, cy, 11) < 0.2) {
          const fall = 2 + (o.diss - front - thr) * 80;
          if (fall < 26) {
            const yy = Math.min(GY - 1, y + rnd(fall));
            const h = hash2(cx, cy, 19);
            debris.push(x + rnd(Math.sin(cy * 1.7 + fall * 0.2) * 2), yy, h < 0.55 ? (fall < 9 ? PAL.stone3 : PAL.stone2) : h < 0.75 ? PAL.gold2 : h < 0.88 ? PAL.fire2 : PAL.stone1);
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

// ---------------------------------------------------------------- the closed needle piece (summon's exploded view)

const NEEDLE_CACHE = new Map<string, PixelCanvas>();
/** The Kutup İğnesi piece drawn by its OWN rig (closed: limbs folded into the lozenge, spear as the compass card). */
function needlePiece(lightFrom: 'left' | 'right', open: number, phase: number): PixelCanvas {
  const key = `${lightFrom}:${open}:${phase}`;
  let q = NEEDLE_CACHE.get(key);
  if (!q) {
    q = new PixelCanvas(N_W, N_H);
    drawNeedle(q, needlePose({ closed: 1 - open, spin: 1, yaw: 30 + phase * 360, rose: phase, poleN: 2, poleS: 2, tip: 2, eye: 1.6 }), lightFrom);
    NEEDLE_CACHE.set(key, q);
  }
  return q;
}

// ---------------------------------------------------------------- draw

export interface DrawOpts {
  /** skip the light layer (card art masks) */
  noLight?: boolean;
}

export function drawSovereign(p: PixelCanvas, o: Pose, lightFrom: 'left' | 'right', opts: DrawOpts = {}): void {
  if (o.aim > 0) o = resolveAim(o, lightFrom);
  const light = lightOf(lightFrom);
  const sk = skeleton(o);
  const comp = new Comp(p);
  const f: Frame = { p, comp, light, o, sk };
  // compass mode: each half of the spear sits in front of / behind the body by its yaw
  const nFront = o.spin > 0 ? Math.sin(o.yaw * DEG) > 0 : true;

  heapLayer(f);
  drawRose(f, false);
  if (o.spin > 0 && o.spear > 0) comp.add(spearLayer(f, nFront ? -1 : 1), Part.spear, { out: PAL.stone1 });
  drawArm(f, false);
  drawSpool(f, false);
  drawBase(f);
  drawChest(f);
  drawCup(f);
  drawHead(f);
  drawRose(f, true);
  drawSpool(f, true);
  drawArm(f, true);
  if (o.spear > 0) {
    if (o.spin > 0) comp.add(spearLayer(f, nFront ? 1 : -1), Part.spear, { out: PAL.stone1 });
    else comp.add(spearLayer(f), Part.spear, { out: PAL.stone1 });
    if (o.sfree <= 0 && o.arms > 0) drawFist(f, true);
  }
  if (o.shake > 0) {
    // 1-px tremble: the helm, pauldrons and spool plates jump alternately (whole px)
    const dy = o.shake === 1 ? -1 : 1;
    const src = p.clone();
    const moving = (id: number) => id === Part.head || id === Part.spoolN || id === Part.spoolF || id === Part.roseF || id === Part.roseB;
    for (let y = 1; y < H - 1; y++) for (let x = 0; x < W; x++) if (moving(comp.id[y * W + x])) p.erase(x, y);
    for (let y = 1; y < H - 1; y++)
      for (let x = 0; x < W; x++)
        if (moving(comp.id[y * W + x])) { const c = src.get(x, y); if (c !== null) p.set(x, y + dy, c); }
  }

  cleanCrumbs(p);
  p.outline(PAL.ink);
  dissolvePass(f);

  // the closed needle piece (already outlined by its own rig) floats beside the exploded chest
  if (o.npiece > 0) {
    const q = needlePiece(lightFrom, clamp(Math.round((o.npiece - 1) * 4) / 4, 0, 1), Math.round(o.t * 8) / 8);
    const ox = rnd(RX + o.npx - N_RX);
    const oy = rnd(GY - o.lift + o.npy - N_GY);
    for (let y = 0; y < N_H; y++)
      for (let x = 0; x < N_W; x++) {
        const c = q.get(x, y);
        const X = x + ox;
        const Y = y + oy;
        if (c === null || X < 0 || Y < 0 || X >= W || Y >= H || p.isOpaque(X, Y)) continue;
        p.set(X, Y, c);
      }
  }
  if (opts.noLight) return;

  // light layer
  if (o.diss < 0.7 || o.gather) {
    basePoles(f);
    coreLight(f);
    climbLight(f);
    eyeLight(f);
    spearPoles(f);
  }
  seamLight(f);
  fieldLight(f);
  dustLight(f);
  streakLight(f);
  trailLight(f);
  ringLight(f);
  deathLight(f);
  flareLight(f);
  sparkLight(f);
  zapLight(f);
  glintLight(f);
}
