// Kutup Örsü v3 — the "living anvil" rig: Pose → pixels.
//
// A squat, WIDE piece of the Kutup family: a black-iron (magnetite) ANVIL that is the creature's whole body — a
// flared foot block standing on two feet (the sovereign's base later), a short waist that carries the face (two
// blue eyes under the brow of the top block) and the long top block: square heel (the N pole, an orange glyph
// plate) → polished striking face → the horn pointing at the enemy (the S pole, a blue tip). Two thick HAMMER
// ARMS grow from the top block's shoulders; each forearm ends in a square maul that hangs face-down over the
// anvil (they tap it in idle). Gold binding straps hold the pieces together. Under the base a blue FIELD RING
// turns on the floor; iron dust drifts along the field lines from heel to horn.
//
//   - flat polygons shaded by flat value planes measured from their own edges (kit `bands`), no gradients;
//   - every part moves by WHOLE pixels and never rotates as a sprite; the arms are 2-link IK tubes (geometry),
//     the mauls stay axis-aligned blocks (a hammer always falls face-down);
//   - one key light from the top-left; `light` = the frame edge it comes from ('right' = the P2 relight sheet);
//   - light (eyes, pole glyphs, face sparks, field ring, push waves, arcs, sparks, dust) is painted after the
//     outline and never outlined (IŞ-9);
//   - summon / death / revive move whole PIECES of the composed body (the two half-anvils, the repelled chunks).
// Frame 96×76; 1 art px = 1 game px; R = (RX, GY) the ground point under the base centre.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ik2, lightOf, type Light } from '../rigkit';
import {
  BASE_POLY, Comp, GOLD, GOLD_FAR, HEEL, HORN_TIP, IRON, IRON_FAR, POLE_N, POLE_S, POLISH, TOP_POLY, WAIST_X0, WAIST_X1,
  bands, boxPoly, hash2, shift, tubePoly, type Pt,
} from './polar_anvil-kit';

export const W = 96;
export const H = 76;
export const RX = 38;
export const GY = 66;

export const enum Part {
  none = 0,
  armF,
  maulF,
  base,
  waist,
  top,
  armN,
  maulN,
}

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rnd = Math.round;
const fl = Math.floor;

// ---------------------------------------------------------------- pose

export interface Pose {
  /** whole body offset (base included): x skid, y lift (+ up). 0 in idle / guard (HA-9) */
  bx: number;
  by: number;
  /** top block offset over the base: x, and sink (+ down) */
  tx: number;
  py: number;
  /** near / far wrist targets relative to R (the maul hangs under the wrist) */
  nx: number;
  ny: number;
  fx: number;
  fy: number;
  /** arms shown 0…1 (summon: 0 = tucked into the block, grows out) */
  arms: number;
  /** eyes 0 dark … 1 blue … 2 white-hot; lid 0 open, 1 half, 2 shut */
  eye: number;
  lid: number;
  /** face sparks 0…3 (blue spark lines along the striking face), and their phase */
  face: number;
  /** pole glow 0…3; swap: 0 N heel orange / S horn blue, 1 swapped */
  pole: number;
  swap: number;
  /** field ring 0 off … 1 idle … 3 blazing; ring rotation phase 0…1; double ring (guard) 0/1 */
  ring: number;
  rot: number;
  ring2: number;
  /** strike flashes on the face under the near / far maul 0…1 */
  flashN: number;
  flashF: number;
  /** spark burst phase (0 none) at the face centre; fountain phase (summon weld) */
  spark: number;
  fount: number;
  /** push wave phase 0…1 (0 none): blue field rings rolling out of the horn */
  wave: number;
  /** a field ring bursting outward along the floor 0 none … 1 widest (roar / special / revive) */
  pulse: number;
  /** guard: a standing field wall in front of the horn 0 none … 2 bright */
  ward: number;
  /** summon: the two halves apart by `split` px each, a blue arc in the gap 0…1, the weld seam 0…1 */
  split: number;
  arc: number;
  weld: number;
  /** death / revive: pieces repelled 0…1, crack glow 0…1, erosion 0…1 */
  shards: number;
  crack: number;
  diss: number;
  /** hitMagic zaps 0…1; plate shudder 0/1/2 */
  zap: number;
  shake: number;
  /** iron dust: phase 0…1 (−1 none), spread 0…2 */
  dust: number;
  dustK: number;
  /** global phase 0…1 */
  t: number;
}

export const NEUTRAL: Pose = {
  bx: 0, by: 0, tx: 0, py: 0,
  nx: 12, ny: -38, fx: -8, fy: -39,
  arms: 1, eye: 1, lid: 0, face: 1, pole: 2, swap: 0,
  ring: 1, rot: 0, ring2: 0,
  flashN: 0, flashF: 0, spark: 0, fount: 0, wave: 0, ward: 0, pulse: 0,
  split: 0, arc: 0, weld: 0, shards: 0, crack: 0, diss: 0, zap: 0, shake: 0,
  dust: 0, dustK: 1, t: 0,
};
export const pose = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

// ---------------------------------------------------------------- skeleton

export interface Skel {
  B: Pt;
  T: Pt;
  shN: Pt;
  shF: Pt;
  elN: Pt;
  elF: Pt;
  wN: Pt;
  wF: Pt;
  /** maul head centres */
  cN: Pt;
  cF: Pt;
  /** head stands upright (haft roughly level) or lies flat (haft raised / lowered steeply) */
  tallN: boolean;
  tallF: boolean;
  /** maul bottom centres (striking faces) */
  mN: Pt;
  mF: Pt;
  horn: Pt;
  heel: Pt;
  eye: Pt;
  core: Pt;
}

const MAUL_H = 8;
/** hammer head: long side (along the striking axis) and short side */
const MAUL_L = 12;
const MAUL_S = 8;
const UPPER = 12;
const FORE = 11;

/** the elbow of the two IK solutions that sits higher (a smith's arm: elbow up, forearm down to the maul) */
function elbowUp(sh: Pt, w: Pt): Pt {
  const a = ik2(sh, w, UPPER, FORE, 1) as Pt;
  const b = ik2(sh, w, UPPER, FORE, -1) as Pt;
  return a[1] < b[1] - 0.01 || (Math.abs(a[1] - b[1]) <= 0.01 && a[0] < b[0]) ? a : b;
}

export function skeleton(o: Pose): Skel {
  const B: Pt = [RX + o.bx, GY - o.by];
  const T: Pt = [B[0] + o.tx, B[1] + o.py];
  const k = clamp(o.arms, 0, 1);
  const shN: Pt = [T[0] - 4, T[1] - 29];
  const shF: Pt = [T[0] - 13, T[1] - 30];
  const reach = (a: Pt, b: Pt, len: number): Pt => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = Math.hypot(dx, dy);
    return d <= len ? b : [a[0] + (dx / d) * len, a[1] + (dy / d) * len];
  };
  // tucked arms: the wrist pulled back to the shoulder (arms grow out of the block in the summon)
  const tN: Pt = [RX + o.nx + o.bx, GY + o.ny - o.by];
  const tF: Pt = [RX + o.fx + o.bx, GY + o.fy - o.by];
  const wN = reach(shN, [shN[0] + (tN[0] - shN[0]) * k, shN[1] + (tN[1] - shN[1]) * k], UPPER + FORE - 0.5);
  const wF = reach(shF, [shF[0] + (tF[0] - shF[0]) * k, shF[1] + (tF[1] - shF[1]) * k], UPPER + FORE - 0.5);
  // elbows bend back and up (a smith's arm lifted over the anvil)
  const elN = elbowUp(shN, wN);
  const elF = elbowUp(shF, wF);
  // the hammer head sits across the forearm's end (a real sledge: head perpendicular to the haft)
  const mc = (el: Pt, w: Pt): [Pt, boolean] => {
    const dx = w[0] - el[0];
    const dy = w[1] - el[1];
    const d = Math.hypot(dx, dy) || 1;
    const tall = Math.abs(dx) >= Math.abs(dy) * 0.9;
    return [[w[0] + (dx / d) * 4, w[1] + (dy / d) * 4], tall];
  };
  const [cN, tallN] = mc(elN, wN);
  const [cF, tallF] = mc(elF, wF);
  const half = (tall: boolean) => (tall ? MAUL_L : MAUL_S) / 2;
  return {
    B, T, shN, shF, elN, elF, wN, wF, cN, cF, tallN, tallF,
    mN: [cN[0], cN[1] + half(tallN)],
    mF: [cF[0], cF[1] + half(tallF)],
    horn: [T[0] + HORN_TIP[0], T[1] + HORN_TIP[1]],
    heel: [T[0] + HEEL[0], T[1] + HEEL[1]],
    eye: [B[0] + 6 + rnd(o.tx / 2), B[1] - 16 + rnd(o.py / 2)],
    core: [T[0] + 4, T[1] - 24],
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

// ---------------------------------------------------------------- parts

function drawBase(f: Frame): void {
  const { sk, light } = f;
  const [bx, by] = sk.B;
  const q = layer();
  q.poly(shift(BASE_POLY, bx, by), IRON.M);
  bands(q, IRON, light, 3, 3);
  // gold band across the top (2 rows) with a rivet pair, a dark seam above the feet
  for (let x = bx - 15; x <= bx + 16; x++) {
    if (q.isOpaque(x, by - 10)) q.set(x, by - 10, GOLD.L);
    if (q.isOpaque(x, by - 9)) q.set(x, by - 9, GOLD.S);
  }
  for (const x of [bx - 11, bx + 11]) if (q.isOpaque(x, by - 6)) q.set(x, by - 6, PAL.stone3).set(x + 1, by - 6, PAL.stone3);
  f.comp.add(q, Part.base, { out: PAL.stone0 });
}

function drawWaist(f: Frame): void {
  const { sk, light, o } = f;
  const [bx, by] = sk.B;
  const [tx, ty] = sk.T;
  const top = ty - 18;
  const bot = by - 11;
  const x0 = rnd((bx + tx) / 2) + WAIST_X0;
  const x1 = rnd((bx + tx) / 2) + WAIST_X1;
  const q = layer();
  q.poly(boxPoly(x0, top - 1, x1 + 1, bot + 1, 1), IRON.M);
  bands(q, IRON, light, 3, 3, { top: 0 });
  // the brow shadow under the top block and the face plate (darker well the eyes sit in)
  for (let x = x0; x <= x1; x++) if (q.isOpaque(x, top)) q.set(x, top, IRON.D);
  const [ex, ey] = sk.eye;
  for (let y = ey - 1; y <= ey + 2; y++) for (let x = ex - 2; x <= ex + 7; x++) if (q.isOpaque(x, y)) q.set(x, y, PAL.stone0);
  // gold jaw strap
  for (let x = ex - 3; x <= x1 - 1; x++) if (q.isOpaque(x, ey + 4)) q.set(x, ey + 4, o.shake === 2 ? GOLD.M : GOLD.S);
  f.comp.add(q, Part.waist, { out: PAL.stone0 });
}

function drawTop(f: Frame): void {
  const { sk, light, o } = f;
  const [tx, ty] = sk.T;
  const q = layer();
  q.poly(shift(TOP_POLY, tx, ty), IRON.M);
  bands(q, IRON, light, 4, 3, { top: 0 });
  // the polished striking face (2 rows) from the heel to the horn's root, the horn's top row polished too
  for (let x = tx - 24; x <= tx + 30; x++) {
    if (q.isOpaque(x, ty - 29)) q.set(x, ty - 29, x > tx + 15 ? POLISH.M : POLISH.M);
    if (q.isOpaque(x, ty - 28) && x <= tx + 22) q.set(x, ty - 28, x < tx - 20 ? POLISH.S : POLISH.S);
  }
  // hardy hole and pritchel hole on the face
  q.set(tx - 18, ty - 29, PAL.stone0).set(tx - 17, ty - 29, PAL.stone0).set(tx - 18, ty - 28, PAL.ink).set(tx - 17, ty - 28, PAL.ink);
  q.set(tx - 10, ty - 29, PAL.stone1).set(tx - 10, ty - 28, PAL.stone0);
  // gold strap round the block (behind the shoulder) with a rivet
  const sh = o.shake === 1 ? 1 : 0;
  for (let y = ty - 27; y <= ty - 19; y++)
    for (let x = tx - 5 + sh; x <= tx - 3 + sh; x++)
      if (q.isOpaque(x, y)) q.set(x, y, x === tx - 5 + sh ? GOLD.L : x === tx - 3 + sh ? GOLD.S : GOLD.M);
  // heel pole plate (dark well; its glyph is light) and the waist line under the face
  for (let y = ty - 26; y <= ty - 21; y++) for (let x = tx - 24; x <= tx - 22; x++) if (q.isOpaque(x, y)) q.set(x, y, PAL.stone0);
  for (let x = tx - 20; x <= tx + 16; x++) if (q.isOpaque(x, ty - 19) && (x & 3) === 0) q.set(x, ty - 19, IRON.S);
  f.comp.add(q, Part.top, { out: PAL.stone0 });
}

function drawArm(f: Frame, near: boolean): void {
  const { sk, light } = f;
  const sh = near ? sk.shN : sk.shF;
  const el = near ? sk.elN : sk.elF;
  const w = near ? sk.wN : sk.wF;
  const t = near ? IRON : IRON_FAR;
  const g = near ? GOLD : GOLD_FAR;
  const part = near ? Part.armN : Part.armF;
  const ol = near ? PAL.stone0 : PAL.ink;
  // shoulder pauldron: an iron dome on the block's shoulder
  const pd = layer();
  pd.disc(rnd(sh[0]), rnd(sh[1]), near ? 4 : 3, t.M);
  bands(pd, t, light, 2, 1);
  f.comp.add(pd, part, { out: ol });
  // upper arm and forearm: two thick iron links
  const u = layer();
  u.poly(tubePoly(sh, el, near ? 6 : 5, 0, 1), t.M);
  bands(u, t, light, 2, 1);
  f.comp.add(u, part, { out: ol });
  const fa = layer();
  fa.poly(tubePoly(el, w, near ? 6 : 5, 1, 0), t.M);
  bands(fa, t, light, 2, 1);
  f.comp.add(fa, part, { out: ol });
  // gold rivets at the shoulder and the elbow
  for (const j of [sh, el]) {
    const x = rnd(j[0]);
    const y = rnd(j[1]);
    f.comp.p.set(x, y, g.L).set(x + 1, y, g.M).set(x, y + 1, g.M).set(x + 1, y + 1, g.S);
  }
  // the hammer head: an axis-aligned block across the haft's end, polished striking faces on both long ends
  const c = near ? sk.cN : sk.cF;
  const tall = near ? sk.tallN : sk.tallF;
  const L = MAUL_L - (near ? 0 : 1);
  const S = MAUL_S - (near ? 0 : 1);
  const mw = tall ? S : L;
  const mh = tall ? L : S;
  const x0 = rnd(c[0] - mw / 2);
  const y0 = rnd(c[1] - mh / 2);
  const m = layer();
  m.poly(boxPoly(x0, y0, x0 + mw, y0 + mh, 2), t.M);
  bands(m, t, light, 2, 2, { top: 1 });
  const fc = near ? POLISH.M : POLISH.S;
  const fs = near ? POLISH.S : POLISH.D;
  for (let i = 0; i < (tall ? mw : mh); i++) {
    if (tall) {
      const x = x0 + i;
      if (m.isOpaque(x, y0 + mh - 2)) m.set(x, y0 + mh - 2, fc);
      if (m.isOpaque(x, y0 + mh - 1)) m.set(x, y0 + mh - 1, fs);
      if (m.isOpaque(x, y0)) m.set(x, y0, fc);
      if (m.isOpaque(x, y0 + 2)) m.set(x, y0 + 2, t.S);
      if (m.isOpaque(x, y0 + mh - 4)) m.set(x, y0 + mh - 4, t.S);
    } else {
      const y = y0 + i;
      if (m.isOpaque(x0, y)) m.set(x0, y, fc);
      if (m.isOpaque(x0 + mw - 1, y)) m.set(x0 + mw - 1, y, fs);
      if (m.isOpaque(x0 + 2, y)) m.set(x0 + 2, y, t.S);
      if (m.isOpaque(x0 + mw - 3, y)) m.set(x0 + mw - 3, y, t.S);
    }
  }
  f.comp.add(m, near ? Part.maulN : Part.maulF, { out: ol });
  // gold ferrule where the forearm enters the head
  const fr = layer();
  fr.poly(boxPoly(rnd(w[0]) - 2, rnd(w[1]) - 1, rnd(w[0]) + 3, rnd(w[1]) + 2, 0), g.M);
  bands(fr, g, light, 1, 1);
  f.comp.add(fr, near ? Part.maulN : Part.maulF, { out: g.D });
}

// ---------------------------------------------------------------- pieces (summon halves, death chunks)

/** Moves the composed body by pieces: `piece(x, y, part)` → index into `off`. Later pieces draw over earlier ones. */
function movePieces(f: Frame, piece: (x: number, y: number, part: number) => number, off: readonly Pt[]): void {
  const { p, comp } = f;
  const src = p.clone();
  const ids = comp.id.slice();
  p.clear();
  comp.id.fill(0);
  for (let k = 0; k < off.length; k++) {
    const [dx, dy] = off[k];
    const ix = rnd(dx);
    const iy = rnd(dy);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c = src.get(x, y);
        if (c === null) continue;
        const part = ids[y * W + x];
        if (piece(x, y, part) !== k) continue;
        const X = x + ix;
        const Y = y + iy;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        p.set(X, Y, c);
        comp.id[Y * W + X] = part;
      }
  }
}

/** death / revive piece vectors at shards = 1: base left, base right, far arm, heel chunk, horn chunk, near arm. */
export const SHARD_OFF: readonly Pt[] = [[-4, 0], [5, 0], [-9, -11], [-8, 2], [15, 3], [9, -12]];

function shardOffsets(s: number): Pt[] {
  // pushed out on a short arc: they jump up-and-out first, then settle lower (the arms tumble higher)
  const up = Math.sin(Math.PI * Math.min(1, s * 1.15)) * 5;
  return SHARD_OFF.map(([x, y], i) => (i <= 1 ? [x * s, 0] : [x * s, y < 0 ? y * s : y * s - up]) as Pt);
}

// ---------------------------------------------------------------- light layer

function guarded(f: Frame, parts: readonly number[]): (x: number, y: number, c: number) => void {
  const { p, comp } = f;
  return (x, y, c) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    if (!parts.includes(comp.id[y * W + x])) return;
    if (p.get(x, y) === PAL.ink) return;
    p.set(x, y, c);
  };
}

/** a free light pixel (not over the body outline, inside the frame margin) */
function put(f: Frame, x: number, y: number, c: number, behind = false): void {
  const { p } = f;
  x = rnd(x);
  y = rnd(y);
  if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) return;
  if (behind && p.isOpaque(x, y)) return;
  if (!behind && p.get(x, y) === PAL.ink && f.o.diss <= 0) return;
  p.set(x, y, c);
}

function eyeLight(f: Frame): void {
  const { o, sk } = f;
  if (o.eye <= 0.05 || o.shards > 0.35) return;
  const set = guarded(f, [Part.waist]);
  const [ex, ey] = sk.eye;
  const hot = o.eye > 1.4;
  const col = hot ? PAL.white : o.eye > 0.6 ? PAL.water4 : PAL.water2;
  const rim = o.eye > 0.6 ? PAL.water3 : PAL.water1;
  const rows = o.lid >= 2 ? [1] : o.lid === 1 ? [1] : [0, 1];
  // the eyes' glow spills on the dark face well under them
  if (o.lid < 2) for (let x = -1; x <= 7; x++) if (x !== 3) set(ex + x, ey + 2, x === -1 || x === 7 ? PAL.night2 : PAL.water1);
  for (const ox of [0, 4]) {
    for (const r of rows) for (let x = 0; x < 3; x++) set(ex + ox + x, ey + r, x === 2 && !hot ? rim : col);
    if (o.lid >= 2) for (let x = 0; x < 3; x++) set(ex + ox + x, ey + 1, rim);
  }
}

function poleLight(f: Frame): void {
  const { o, sk } = f;
  const set = guarded(f, [Part.top]);
  const g = clamp(o.pole, 0, 3);
  const nRamp = o.swap ? POLE_S : POLE_N;
  const sRamp = o.swap ? POLE_N : POLE_S;
  const lv = (r: readonly number[], k: number) => r[clamp(rnd(k), 0, 3)];
  // heel glyph: a 3×4 "N" block of pole light in the heel well
  const [hx, hy] = sk.heel;
  const glyph = [[0, 0], [0, 1], [0, 2], [0, 3], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2], [2, 3]] as const;
  for (const [x, y] of glyph) set(hx + 1 + x, hy - 2 + y, lv(nRamp, g >= 2 && (x === 1 || y === 0) ? 3 : g));
  // horn tip: the last 4 px of the horn glow the S pole (brighter toward the point)
  const [tx, ty] = sk.horn;
  for (let i = 0; i < 6; i++)
    for (let y = -1; y <= 1; y++) set(tx - i, ty + y, lv(sRamp, g - (i > 3 ? 2 : i > 1 ? 1 : 0) + (y === -1 ? 0.5 : 0)));
}

function faceLight(f: Frame): void {
  const { o, sk } = f;
  if (o.face <= 0) return;
  const set = guarded(f, [Part.top]);
  const [tx, ty] = sk.T;
  // blue spark lines: 3 dashes of 3 px run along the face, travelling from heel to horn with the phase
  const n = 3;
  const len = 46;
  for (let i = 0; i < n; i++) {
    const u = (o.t + i / n) % 1;
    const x0 = tx - 23 + fl(u * len);
    const c0 = o.face >= 2.5 ? PAL.white : o.face >= 1.5 ? PAL.water4 : PAL.water3;
    for (let k = 0; k < 4; k++) set(x0 + k, ty - 28, k === 3 ? c0 : k === 0 ? PAL.water2 : PAL.water3);
    if (o.face >= 1.5) for (let k = 0; k < 4; k++) set(x0 + k, ty - 29, k >= 2 ? c0 : PAL.water3);
  }
  if (o.face >= 2) for (let x = tx - 22; x <= tx + 20; x++) if ((x + fl(o.t * 8)) % 5 === 0) set(x, ty - 29, PAL.water4);
}

function flashLight(f: Frame): void {
  const { o, sk } = f;
  for (const [k, m] of [[o.flashN, sk.mN], [o.flashF, sk.mF]] as const) {
    if (k <= 0) continue;
    const x = rnd(m[0]);
    const y = rnd(m[1]);
    const r = k > 0.6 ? 10 : 6;
    // a flat white slash along the face where the maul lands, blue at its ends
    for (let dx = -r; dx <= r; dx++) {
      const a = Math.abs(dx);
      put(f, x + dx, y, a < r - 3 ? PAL.white : a < r - 1 ? PAL.water4 : PAL.water3);
      if (a < r - 5) put(f, x + dx, y + 1, PAL.water4);
    }
    if (k > 0.6) {
      // the DANG star: short rays up and out of the strike
      for (const s of [-1, 1])
        for (let i = 0; i < 4; i++) {
          put(f, x + s * (r - 2 + i * 2), y - 1 - i, i < 2 ? PAL.white : PAL.water4);
          put(f, x + s * (r - 1 + i * 2), y - 1 - i, i < 2 ? PAL.water4 : PAL.water3);
        }
    }
  }
}

function sparkLight(f: Frame): void {
  const { o, sk } = f;
  const burst = (cx: number, cy: number, ph: number, n: number, seed: number, spread: number) => {
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (1.08 + hash2(i, seed, 5) * 0.84);
      const v = 0.6 + hash2(i, seed, 9) * 0.7;
      const d = ph * spread * v;
      const x = cx + Math.cos(a) * d * 1.3;
      const y = cy + Math.sin(a) * d + ph * ph * spread * 0.9;
      const c = ph < 0.3 ? PAL.white : ph < 0.6 ? (i % 2 ? PAL.gold4 : PAL.water4) : i % 2 ? PAL.gold3 : PAL.water3;
      put(f, x, y, c);
      put(f, x + (Math.cos(a) > 0 ? -1 : 1), y, ph < 0.55 ? c : i % 2 ? PAL.gold2 : PAL.water2);
    }
  };
  if (o.spark > 0) burst((sk.mN[0] + sk.mF[0]) / 2, sk.T[1] - 30, o.spark, 12, 3, 16);
  if (o.fount > 0) {
    // the weld fountain: sparks shoot UP out of the seam and rain down to both sides
    const cx = sk.B[0] + 1;
    const cy = sk.T[1] - 30;
    for (let i = 0; i < 28; i++) {
      const side = i % 2 ? 1 : -1;
      const v = 0.45 + hash2(i, 7, 1) * 0.9;
      const ph = clamp(o.fount * 1.15 - hash2(i, 2, 4) * 0.3, 0, 1);
      if (ph <= 0) continue;
      const x = cx + side * ph * (4 + 22 * v * hash2(i, 5, 3));
      const y = cy - Math.sin(Math.min(1, ph * 1.4) * Math.PI * 0.6) * (16 + 12 * v) + ph * ph * 22;
      const c = ph < 0.25 ? PAL.white : ph < 0.5 ? PAL.gold4 : ph < 0.75 ? PAL.gold3 : PAL.fire3;
      const tail = ph < 0.5 ? PAL.gold3 : ph < 0.75 ? PAL.fire3 : PAL.fire2;
      put(f, x, y, c);
      put(f, x + 1, y, c);
      // a short streak back along the flight (up while rising, falling after the top)
      const dy = ph < 0.45 ? 1 : -1;
      put(f, x - side, y + dy, tail);
      if (ph < 0.6) put(f, x - side * 2, y + dy * 2, tail);
    }
  }
}

/** The blue field ring on the floor around the base (dashes turning with `rot`), a second ring in guard. */
function ringLight(f: Frame): void {
  const { o, p, sk } = f;
  if (o.ring <= 0) return;
  const cx = sk.B[0] + 1;
  const cy = GY + 1;
  const draw = (rx: number, ry: number, dashes: number, dir: number, bright: number) => {
    const n = 160;
    let px = -999;
    let py = -999;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const x = rnd(cx + Math.cos(a) * rx);
      const y = rnd(cy + Math.sin(a) * ry);
      if (x === px && y === py) continue;
      px = x;
      py = y;
      const front = Math.sin(a) > -0.05;
      const ph = ((a / TAU) * dashes + o.rot * dir) % 1;
      const on = (ph + 1) % 1 < 0.62;
      // the two pole studs at the ring's ends are always lit (the ring's extents never change: HA-9)
      const stud = Math.abs(Math.cos(a)) > 0.985;
      if (!front && p.isOpaque(x, y)) continue;
      let c: number;
      if (stud) c = bright >= 2 ? PAL.water4 : PAL.water3;
      else if (!on) c = front ? PAL.water1 : PAL.night2;
      else if (front) c = bright >= 3 ? PAL.white : bright >= 2 ? PAL.water4 : PAL.water3;
      else c = bright >= 2 ? PAL.water3 : PAL.water2;
      if (y >= H - 2) continue;
      p.set(x, y, c);
      // the near (front) arc is two rows thick: the ring lies ON the floor, its lit lip toward the viewer
      if (front && Math.sin(a) > 0.35 && y + 1 < H - 2) p.set(x, y + 1, on ? (bright >= 2 ? PAL.water3 : PAL.water2) : PAL.night2);
    }
  };
  draw(27, 5, 6, 1, o.ring);
  if (o.pulse > 0) {
    // the burst: one thin bright ring rolling out over the floor (clipped to the frame margin)
    const rx = 28 + o.pulse * 18;
    const ry = 5 + o.pulse * 3;
    const hot = o.pulse < 0.5;
    for (let i = 0; i < 220; i++) {
      const a = (i / 220) * TAU;
      const front = Math.sin(a) > -0.05;
      const x = cx + Math.cos(a) * rx;
      const y = cy + Math.sin(a) * ry;
      if (!front && p.isOpaque(rnd(x), rnd(y))) continue;
      put(f, x, y, hot ? (front ? PAL.white : PAL.water4) : front ? PAL.water4 : PAL.water2);
    }
  }
  if (o.ring2 > 0) draw(21, 4, 5, -1, Math.max(1, o.ring - 1));
}

/** Iron dust on the field lines: arcs from the heel (N) over the top to the horn (S). */
function dustLight(f: Frame): void {
  const { o, sk } = f;
  if (o.dust < 0) return;
  const [hx, hy] = sk.heel;
  const [tx, ty] = sk.horn;
  const cx = (hx + tx) / 2;
  const cy = (hy + ty) / 2;
  const rx = (tx - hx) / 2;
  const lines = [10 + 4 * o.dustK, 16 + 6 * o.dustK];
  lines.forEach((ry, li) => {
    for (let i = 0; i < 6; i++) {
      const u = (o.dust + i / 6 + li * 0.083) % 1;
      const a = Math.PI * (1 + u);
      const x = cx + Math.cos(a) * (rx + 3 + li * 4);
      const y = cy + Math.sin(a) * ry;
      const c = (i + li) % 2 ? PAL.steel : PAL.mist;
      put(f, x, y, c, true);
      put(f, x + 1, y, c === PAL.mist ? PAL.steel : PAL.stone3, true);
    }
  });
}

/** The push wave: three ")" field rings rolling out of the horn. */
function waveLight(f: Frame): void {
  const { o, sk } = f;
  if (o.wave <= 0) return;
  const [hx, hy] = sk.horn;
  for (let i = 0; i < 3; i++) {
    const u = o.wave - i * 0.22;
    if (u <= 0 || u > 1) continue;
    const cx = hx - 1 + u * 30;
    const ry = 4 + u * 15;
    const rx = 2 + u * 6;
    const hot = u < 0.35;
    const lead = hot ? PAL.white : u < 0.7 ? PAL.water4 : PAL.water3;
    for (let j = -24; j <= 24; j++) {
      const a = (j / 24) * (Math.PI * 0.47);
      for (const [d, c] of [[0, lead], [-1, u < 0.7 ? PAL.water3 : PAL.water2], [-2, PAL.water2], [-3, PAL.water1]] as const) {
        if (d <= -2 && u > 0.65) continue;
        const x = cx + d + Math.cos(a) * rx;
        const y = hy + Math.sin(a) * ry;
        if (x > W - 3) continue;
        put(f, x, y, c);
      }
    }
  }
}

/** Guard: the field wall — a standing ")" of the S pole in front of the horn, its dashes crawling. */
function wardLight(f: Frame): void {
  const { o, sk } = f;
  if (o.ward <= 0) return;
  const [hx, hy] = sk.horn;
  const cx = hx + 1;
  const cy = hy + 4;
  const ry = 15;
  const rx = 4;
  const ph = fl(o.t * 16);
  for (let j = -30; j <= 30; j++) {
    const a = (j / 30) * (Math.PI * 0.46);
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    const on = ((j + 40 + ph * 3) % 8) < 5;
    if (!on) {
      put(f, x - 1, y, PAL.water1);
      continue;
    }
    put(f, x, y, o.ward >= 2 && ((j + ph * 3 + 40) % 8) === 2 ? PAL.white : PAL.water4);
    put(f, x - 1, y, PAL.water3);
    if (o.ward >= 1.5) put(f, x - 2, y, PAL.water2);
  }
}

/** The summon's blue arc jumping between the two half-anvils. */
function arcLight(f: Frame): void {
  const { o, sk } = f;
  if (o.arc <= 0 || o.split <= 0) return;
  const gx = sk.B[0] + 1;
  const ph = fl(o.t * 23);
  for (const [y0, y1, seed] of [[sk.T[1] - 27, sk.T[1] - 19, 1], [sk.B[1] - 9, sk.B[1] - 3, 2]] as const) {
    let x = gx - o.split;
    let y = y0 + rnd(hash2(ph, seed, 3) * (y1 - y0));
    const x1 = gx + o.split;
    let k = 0;
    while (x < x1) {
      const step = 2;
      for (let s = 0; s < step && x < x1; s++, x++) put(f, x, y, k % 3 === 0 && o.arc > 0.6 ? PAL.white : PAL.water4);
      put(f, x - 1, y + 1, PAL.water2);
      y = clamp(y + (hash2(k, ph, seed) < 0.5 ? -1 : 1), y0, y1);
      k++;
    }
  }
}

/** The weld seam: a white-hot vertical line where the halves met, cooling orange → blue. */
function weldLight(f: Frame): void {
  const { o, sk } = f;
  if (o.weld <= 0) return;
  const x = sk.B[0] + 1;
  const set = guarded(f, [Part.top, Part.waist, Part.base]);
  const c = o.weld > 0.75 ? PAL.white : o.weld > 0.5 ? PAL.gold4 : o.weld > 0.25 ? PAL.fire3 : PAL.water3;
  const c2 = o.weld > 0.75 ? PAL.gold4 : o.weld > 0.5 ? PAL.fire3 : o.weld > 0.25 ? PAL.fire2 : PAL.water2;
  for (let y = sk.T[1] - 29; y <= sk.B[1]; y++) {
    if (o.weld < 0.5 && (y & 1)) continue;
    set(x, y, c);
    if (o.weld >= 0.5) set(x - 1, y, c2);
    if (o.weld > 0.75) set(x + 1, y, c2);
  }
  if (o.weld > 0.75) {
    // KLAK: a white slash along the face and a star at the seam's top
    const y = sk.T[1] - 30;
    for (let dx = -12; dx <= 12; dx++) put(f, x + dx, y, Math.abs(dx) < 8 ? PAL.white : PAL.gold4);
    for (let i = 1; i <= 5; i++) {
      put(f, x, y - i, i < 3 ? PAL.white : PAL.gold4);
      put(f, x - i - 1, y - i, i < 3 ? PAL.gold4 : PAL.gold3);
      put(f, x + i + 1, y - i, i < 3 ? PAL.gold4 : PAL.gold3);
    }
  }
}

/** Death cracks: the joins between the pieces glow, the poles flicker. */
function crackLight(f: Frame): void {
  const { o, sk } = f;
  if (o.crack <= 0) return;
  const set = guarded(f, [Part.top, Part.waist, Part.base]);
  const hot = o.swap ? POLE_S : POLE_N;
  const x0 = sk.T[0] + 2;
  for (let y = sk.T[1] - 29; y <= sk.T[1] - 18; y++) {
    const x = x0 + (y & 1 ? 0 : 1) - (y % 4 === 0 ? 1 : 0);
    set(x, y, o.crack > 0.6 ? PAL.white : hot[3]);
    set(x + 1, y, hot[2]);
  }
  for (let x = sk.B[0] - 13; x <= sk.B[0] + 14; x++) if ((x & 7) !== 3) set(x, sk.B[1] - 11, x & 1 ? hot[2] : hot[3]);
  // the poles run wild: the heel half's face burns one pole, the horn half's the other (swapping every frame)
  const nR = o.swap ? POLE_S : POLE_N;
  const sR = o.swap ? POLE_N : POLE_S;
  for (let x = sk.T[0] - 24; x <= sk.T[0] + 30; x++) {
    const r = x < x0 ? nR : sR;
    set(x, sk.T[1] - 29, r[3]);
    set(x, sk.T[1] - 28, r[2]);
  }
}

/** death: like poles facing each other in every gap — two bracket arcs ")(" pushing the pieces apart. */
function repelLight(f: Frame): void {
  const { o, sk } = f;
  if (o.shards <= 0 || o.shards > 0.85) return;
  const off = shardOffsets(o.shards);
  const cut = sk.T[0] + 2;
  const gaps: [number, number, number, number][] = [
    // x of the gap centre, y centre, half height, half width
    [cut + (off[3][0] + off[4][0]) / 2, sk.T[1] - 24 + (off[3][1] + off[4][1]) / 2, 5, (off[4][0] - off[3][0]) / 2],
    [sk.B[0] + 1 + (off[0][0] + off[1][0]) / 2, sk.B[1] - 5, 4, (off[1][0] - off[0][0]) / 2],
  ];
  const hot = o.shards < 0.4;
  gaps.forEach(([gx, gy, hh, hw], i) => {
    if (hw < 1.5) return;
    const a = (i + o.swap) % 2 ? POLE_S : POLE_N;
    for (let y = -hh; y <= hh; y++) {
      const bow = Math.round((1 - (y * y) / (hh * hh)) * Math.min(2, hw - 1));
      put(f, gx - hw + 1 + bow, gy + y, hot ? PAL.white : a[3]);
      put(f, gx + hw - 1 - bow, gy + y, hot ? PAL.white : a[3]);
      put(f, gx - hw + 2 + bow, gy + y, a[2]);
      put(f, gx + hw - 2 - bow, gy + y, a[2]);
    }
  });
}

function zapLight(f: Frame): void {
  const { o, sk, p, comp } = f;
  if (o.zap <= 0) return;
  const ph = fl(o.t * 19);
  const starts: [number, number, number, number][] = [
    [sk.heel[0] + 2, sk.heel[1], -0.3, 0],
    [sk.horn[0] - 3, sk.horn[1], 0.4, 1],
    [sk.T[0] - 6, sk.T[1] - 28, 1.6, 2],
    [sk.B[0] - 10, sk.B[1] - 6, 3.6, 3],
    [sk.mN[0], sk.mN[1] - 4, 2.4, 4],
  ];
  for (const [x0, y0, a0, k] of starts) {
    const len = rnd(3 + 7 * o.zap);
    let x = x0;
    let y = y0;
    const pole = (k + ph) % 2 ? POLE_N : POLE_S;
    for (let i = 0; i < len; i++) {
      const j = hash2(i, ph, k * 13 + 5);
      const a = a0 + (j - 0.5) * 1.7;
      x += rnd(Math.cos(a) * 1.5);
      y += rnd(Math.sin(a) * 1.5);
      if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) break;
      if (p.get(x, y) === PAL.ink && comp.id[y * W + x] !== Part.none) continue;
      p.set(x, y, i === 0 ? PAL.white : pole[i % 2 ? 3 : 2]);
      if (i % 2 === 0) put(f, x + 1, y, pole[2]);
    }
  }
}

/** the last ~150 ms: the body breaks to iron grit by 2×2 cells (revive: the cells gather, lit blue). */
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
      const thr = hash2(cx, cy, 7) * 0.8 + clamp((GY - y) / 60, 0, 1) * 0.2;
      if (thr < o.diss - 0.12) gone.push(x, y);
      else if (thr < o.diss) mark.push(x, y);
    }
  for (let i = 0; i < gone.length; i += 2) {
    p.erase(gone[i], gone[i + 1]);
    comp.id[gone[i + 1] * W + gone[i]] = Part.none;
  }
  for (let i = 0; i < mark.length; i += 2) p.set(mark[i], mark[i + 1], (fl((mark[i] - RX) / 2) + fl((mark[i + 1] - GY) / 2)) & 1 ? PAL.stone3 : PAL.steel);
}

// ---------------------------------------------------------------- draw

export interface DrawAnvilOpts {
  /** draw only the body (no light layer: ring, dust, sparks, eyes stay) — the sovereign's base piece */
  bodyOnly?: boolean;
}

export function drawAnvil(p: PixelCanvas, o: Pose, lightFrom: 'left' | 'right', opts: DrawAnvilOpts = {}): void {
  const light = lightOf(lightFrom);
  const sk = skeleton(o);
  const comp = new Comp(p);
  const f: Frame = { p, comp, light, o, sk };

  if (o.arms > 0) drawArm(f, false);
  drawBase(f);
  drawWaist(f);
  drawTop(f);
  if (o.arms > 0) drawArm(f, true);

  if (o.split > 0) {
    const gx = sk.B[0] + 1;
    movePieces(f, (x) => (x < gx ? 0 : 1), [[-o.split, 0], [o.split, 0]]);
  }
  if (o.shards > 0) {
    const cut = sk.T[0] + 2;
    const cutY = sk.B[1] - 11;
    const mid = sk.B[0] + 1;
    const piece = (x: number, y: number, part: number): number => {
      if (part === Part.armF || part === Part.maulF) return 2;
      if (part === Part.armN || part === Part.maulN) return 5;
      if (part === Part.base || (part === Part.waist && y > cutY - 3)) return x < mid ? 0 : 1;
      return x < cut ? 3 : 4;
    };
    movePieces(f, piece, shardOffsets(o.shards));
  }

  p.outline(PAL.ink);
  if (opts.bodyOnly) return;
  dissolvePass(f);

  ringLight(f);
  dustLight(f);
  if (o.diss < 0.6) {
    eyeLight(f);
    poleLight(f);
    faceLight(f);
  }
  weldLight(f);
  crackLight(f);
  flashLight(f);
  arcLight(f);
  waveLight(f);
  wardLight(f);
  sparkLight(f);
  repelLight(f);
  zapLight(f);
}
