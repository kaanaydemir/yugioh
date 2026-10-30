// Sol Bacak Mührü v3 — the rig of the "Dragger": the severed obsidian LEFT leg of the sealed colossus, KNEELING. A low, wide
// sprawl in profile: a thigh slab that climbs up-left from the knee to a snapped hip (a slanted fracture with two long teeth and
// a hanging shard, leaking seal light), a big round knee plate (13 px, bronze rim, the bent-knee glyph at its centre) facing
// right and planted on the floor, the shin folded back along the floor to the left, and at its far end the foot turned over —
// sole up and facing left, three tread ridges and three toe nubs — with a bronze ankle shackle whose heavy drag chain runs left
// along the floor to a cast weight block. A wedge of daylight shows between the thigh and the shin (the folded knee).
//
// Hand-made rig. A Pose gives the three joints (hip, knee, ankle) and the plate centre directly (no IK: the leg is hauled, not
// stepped), the foot angle, the chain (links, end point, lift, squiggle) and every light-layer effect. Parts are laid back to front
// (chain, shin, foot, shackle, thigh, knee plate), each shaded from its own edges so P2 is a true relight; then the 1-px ink
// outline; then the light layer (glyph, hip seam, floor diamond, rings, cracks, dust, sparks) which is never outlined.
//
// Frame 112 × 64, anchor (56, 58) on the floor, hover 0.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { lightOf, type Light } from '../rigkit';
import type { DrawOpts } from '../types';
import { BRONZE, Comp, GLYPH_LEG_L, GOLD_TONES, MAG, OBS, STONE_TONES, bands, crumbs, fill, layer, rnd, rot, stampBits, type Pt } from './seal_leg_l-kit';

export const W = 112;
export const H = 64;
export const AX = 56;
export const AY = 58;
export const HOVER = 0;
/** The floor line: the lowest body row. */
export const FLOOR_Y = 57;

/** Rest joints. */
export const HIP0: Pt = [38, 29];
export const KNEE0: Pt = [62, 49];
export const ANKLE0: Pt = [36, 51];
export const PLATE0: Pt = [66, 50];
export const BLOCK0: Pt = [10, 55];

export interface Chip {
  x: number;
  y: number;
  /** 0 = 2×2, 1 = 3×2 */
  k: number;
}

export interface Pose {
  hip: Pt;
  knee: Pt;
  ankle: Pt;
  /** shin bottom clamp (the floor row); null = the shin follows its joints */
  gnd: number | null;
  /** knee plate centre pixel, half width (7 = full disc, smaller = rolling edge-on) and the pad's shift inside the rim */
  kp: Pt;
  pw: number;
  pad: Pt;
  /** foot angle in deg around the ankle (+ = toes toward the floor, clockwise) and toe lifts (px, far → near) */
  fa: number;
  tw: readonly [number, number, number];
  /** gap (px along the thigh) between the two thigh slabs */
  gap: number;
  /** glyph level 0 dark … 4 hot; hip seam 0..3; violet spill on the stone 0..2 */
  lv: number;
  seam: number;
  spill: number;
  /** floor diamond 0 none … 3; stone cracks 0..3; floor crack web 0..3; negative-band flash 0..2 */
  floor: number;
  crack: number;
  fcrack: number;
  flash: number;
  /** floor shock rings: [centre x, x radius, tone 1..3] */
  rings: readonly (readonly [number, number, number])[];
  /** chain: links 0..7, the block's centre (null = no chain), lift of the middle (px), squiggle amplitude (px), phase, hopped link (-1 none) */
  cn: number;
  ce: Pt | null;
  cl: number;
  cs: number;
  cp: number;
  hop: number;
  /** dust, motes ([x, y, tone 1..3]), hot sparks (void4), chips in the air, vertical light lines */
  dust: readonly (readonly [number, number, number])[];
  motes: readonly (readonly [number, number, number])[];
  sparks: readonly Pt[];
  chips: readonly Chip[];
  /** drawing offset of the whole leg (px) and a row below which nothing is drawn (the leg rising out of the floor) */
  dx: number;
  dy: number;
  clip: number | null;
  /** 2-px smear behind the knee plate (the ram's release frame) */
  smear: boolean;
  /** extra loose chain links in the air ([x, y, face 0 | 1]) */
  loose: readonly (readonly [number, number, number])[];
}

export const POSE0: Pose = {
  hip: HIP0,
  knee: KNEE0,
  ankle: ANKLE0,
  gnd: FLOOR_Y,
  kp: PLATE0,
  pw: 7,
  pad: [0, 0],
  fa: 0,
  tw: [0, 0, 0],
  gap: 0,
  lv: 3,
  seam: 1,
  spill: 1,
  floor: 1,
  crack: 0,
  fcrack: 0,
  flash: 0,
  rings: [],
  cn: 5,
  ce: BLOCK0,
  cl: 0,
  cs: 1,
  cp: 0,
  hop: -1,
  dust: [],
  motes: [],
  sparks: [],
  chips: [],
  dx: 0,
  dy: 0,
  clip: null,
  smear: false,
  loose: [],
};

export function pose(o: Partial<Pose>): Pose {
  return { ...POSE0, ...o };
}

const P_THIGH = 1;
const P_SHIN = 2;
const P_FOOT = 3;
const P_BAND = 4;
const P_CHAIN = 5;
const P_KNEE = 6;
const P_CHIP = 7;
const P_SMEAR = 8;
const P_BLOCK = 9;

// ---------------------------------------------------------------- segment frames

export interface SegG {
  a: Pt;
  b: Pt;
  u: Pt;
  v: Pt;
  len: number;
}
export function segGeom(a: Pt, b: Pt): SegG {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const u: Pt = [dx / len, dy / len];
  return { a, b, u, v: [u[1], -u[0]], len };
}
/** Point at t along the segment, s to its v side (v = up / right of the way down the thigh). */
export const loc = (g: SegG, t: number, s: number): Pt => [g.a[0] + g.u[0] * t + g.v[0] * s, g.a[1] + g.u[1] * t + g.v[1] * s];

/** Slab between t0 and t1 whose two long edges are ragged: half widths per station (evenly spaced in t); lo = -v side, ro = +v side. */
function slabN(g: SegG, t0: number, t1: number, lo: readonly number[], ro: readonly number[]): Pt[] {
  const n = lo.length;
  const L: Pt[] = [];
  const R: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = t0 + ((t1 - t0) * i) / (n - 1);
    L.push(loc(g, t, -lo[i]));
    R.push(loc(g, t, ro[i]));
  }
  return [...L, ...R.reverse()];
}

// ---------------------------------------------------------------- the foot (sole turned up, facing left)

/** Foot outline relative to the ankle: heel at the ankle, the long axis leaning up-left, the sole face on the left. */
export const FOOT_BODY: readonly Pt[] = [
  [-3, 2],
  [-10, 2],
  [-10, -3],
  [-9, -6],
  [-12, -9],
  [-15, -13],
  [-15, -17],
  [-13, -19],
  [-4, -19],
  [-2, -16],
  [-3, -11],
  [-5, -8],
  [-4, -4],
];
/** Tread pads of the sole face (relative to the ankle): the heel pad and the forefoot pad; the arch between them stays plain. */
export const SOLE_PADS: readonly { x0: number; x1: number; y0: number; y1: number }[] = [
  { x0: -9, x1: -4, y0: -2, y1: 1 },
  { x0: -14, x1: -3, y0: -16, y1: -10 },
];
/** Hobnails of the sole (bronze studs): relative to the ankle. */
export const NAILS: readonly Pt[] = [[-12, -15], [-8, -15], [-5, -15], [-10, -12], [-6, -12]];
/** Toe nubs relative to the ankle: far → near along the top (x, top y, width, height); they are the rounded top of the sole, not fingers. */
export const TOES: readonly (readonly [number, number, number, number])[] = [
  [-14, -22, 4, 3],
  [-10, -23, 4, 4],
  [-6, -22, 3, 3],
];

/** The foot lies over at this angle (deg, counter-clockwise = toes toward the far left) when a pose's `fa` is 0. */
export const BASE_FA = 0;

export interface FootG {
  at(x: number, y: number): Pt;
  body: Pt[];
  claw: Pt;
  tip: Pt;
}
export function footGeom(p: Pose): FootG {
  const a: Pt = [p.ankle[0] + p.dx, p.ankle[1] + p.dy];
  // The foot lies on the floor beside the shackle, sole up, toes pointing left. Foot-local (x across, y along: the heel at y = 0,
  // the toes at y < 0) maps to the floor plane: the length runs left, the width is squashed 2:1 (the iso floor); `fa` swings the toes
  // up about the heel (+ = lift).
  const at = (x: number, y: number): Pt => {
    const r = rot(y * 0.9, (x + 8.5) * 0.6, p.fa);
    return [a[0] + r[0] - 1, a[1] + r[1] - 4];
  };
  return { at, body: FOOT_BODY.map(([x, y]) => at(x, y)), claw: at(-9, -23), tip: at(-14, -20) };
}

// ---------------------------------------------------------------- stone helpers

/** The snapped hip: a slanted fracture, two long teeth and a hanging shard (t < 0 = beyond the stump, s across the thigh). */
export const JAG: readonly Pt[] = [
  [1.5, -7.0],
  [-3.2, -6.4],
  [-1.2, -3.6],
  [-9.6, -2.4],
  [-3.4, 0.2],
  [-6.0, 2.2],
  [-2.6, 4.2],
  [-11.0, 6.0],
  [-2.2, 7.2],
];
export const SEAM: readonly Pt[] = [
  [2.6, -5.0],
  [-0.6, -4.0],
  [-3.4, -1.8],
  [-0.4, 0.6],
  [-3.4, 2.4],
  [-0.8, 4.4],
  [-3.4, 6.2],
];

function stoneFlash(q: PixelCanvas, flash: number): void {
  if (flash <= 0) return;
  const map = new Map<number, number>(
    flash === 1
      ? [[PAL.stone3, PAL.void3], [PAL.stone2, PAL.void2], [PAL.stone1, PAL.void1], [PAL.stone0, PAL.void0]]
      : [[PAL.stone3, PAL.void4], [PAL.stone2, PAL.void3], [PAL.stone1, PAL.void2], [PAL.stone0, PAL.void1]],
  );
  q.map((c) => map.get(c) ?? c);
}

function crackLine(q: PixelCanvas, a: Pt, b: Pt, bleed: boolean): void {
  q.line(rnd(a[0]), rnd(a[1]), rnd(b[0]), rnd(b[1]), OBS.D);
  if (bleed) q.line(rnd(a[0]), rnd(a[1]) + 1, rnd(b[0]), rnd(b[1]) + 1, PAL.mag1);
}

/** A crease along a segment at offset s (only on pixels already there and flanked by stone). */
function groove(q: PixelCanvas, g: SegG, t0: number, t1: number, s: number): void {
  const a = loc(g, t0, s);
  const b = loc(g, t1, s);
  const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
  for (let i = 0; i <= n; i++) {
    const x = rnd(a[0] + ((b[0] - a[0]) * i) / n);
    const y = rnd(a[1] + ((b[1] - a[1]) * i) / n);
    if (q.isOpaque(x, y) && q.isOpaque(x, y - 1) && q.isOpaque(x, y + 1)) q.set(x, y, OBS.D);
  }
}

/** A plate seam across a segment at t. */
function across(q: PixelCanvas, g: SegG, t: number, s0: number, s1: number): void {
  const a = loc(g, t, s0);
  const b = loc(g, t, s1);
  const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
  for (let i = 0; i <= n; i++) {
    const x = rnd(a[0] + ((b[0] - a[0]) * i) / n);
    const y = rnd(a[1] + ((b[1] - a[1]) * i) / n);
    if (q.isOpaque(x, y) && q.isOpaque(x - 1, y) && q.isOpaque(x + 1, y)) q.set(x, y, OBS.D);
  }
}

function paintThigh(c: Comp, p: Pose, th: SegG, light: Light): void {
  const { w, h } = c.p;
  const len = th.len;
  const aEnd = len * 0.5 - p.gap / 2;
  const bStart = len * 0.5 + p.gap / 2;
  // B: the lower slab, reaching under the knee plate
  {
    const q = layer(w, h);
    fill(q, slabN(th, bStart, len + 2, [6.8, 7.8, 6.0, 8.2, 7.6], [7.0, 6.2, 7.6, 6.4, 8.0]), OBS.M);
    bands(q, OBS, light, 3, 2, { top: 1, bottom: 1, edge: 3 });
    crumbs(q, STONE_TONES);
    groove(q, th, bStart + 1.5, len - 1, -3.4);
    across(q, th, bStart + (len - bStart) * 0.55, -7, 2.2);
    if (p.crack >= 2) crackLine(q, loc(th, bStart + 4, -2), loc(th, bStart + 9, 4), p.crack >= 3);
    stoneFlash(q, p.flash);
    c.add(q, P_THIGH, OBS.D);
  }
  // A: the upper slab with the snapped hip
  {
    const q = layer(w, h);
    const pts: Pt[] = [loc(th, aEnd, -7.0), loc(th, aEnd * 0.55, -6.2)];
    for (const [t, s] of JAG) pts.push(loc(th, t, s));
    pts.push(loc(th, aEnd * 0.5, 7.4), loc(th, aEnd, 7.0));
    fill(q, pts, OBS.M);
    bands(q, OBS, light, 3, 2, { top: 1, bottom: 1, edge: 3 });
    crumbs(q, STONE_TONES);
    groove(q, th, 3, aEnd - 0.5, -3.4);
    across(q, th, aEnd * 0.66, -7, 2.4);
    if (p.crack >= 1) crackLine(q, loc(th, aEnd - 8, -4), loc(th, aEnd - 2, 2), p.crack >= 2);
    if (p.crack >= 3) crackLine(q, loc(th, aEnd - 2, 2), loc(th, aEnd, 6), true);
    stoneFlash(q, p.flash);
    c.add(q, P_THIGH, OBS.D);
  }
}

function paintShin(c: Comp, p: Pose, knee: Pt, ankle: Pt, light: Light): void {
  const { w, h } = c.p;
  const gnd = p.gnd === null ? knee[1] + 8 : p.gnd + p.dy;
  const gx = p.gnd === null ? ankle[1] + 6 : gnd;
  const q = layer(w, h);
  // top edge: knee end -> ankle end (rises with the heel); bottom edge: the floor (clamped) -> the ankle end
  const pts: Pt[] = [
    [knee[0] + 2, knee[1] - 3.5],
    [knee[0] - 7, knee[1] - 4.5 + (ankle[1] - knee[1] + 2) * 0.12],
    [(knee[0] + ankle[0]) / 2 + 2, (knee[1] + ankle[1]) / 2 - 4.6],
    [ankle[0] + 6, ankle[1] - 5],
    [ankle[0] - 1, ankle[1] - 3.6],
    [ankle[0] - 3, gx - 3],
    [ankle[0] - 2, gx],
    [(knee[0] + ankle[0]) / 2, gnd],
    [knee[0] + 2, gnd],
  ];
  fill(q, pts, OBS.M);
  bands(q, OBS, light, 3, 2, { top: 1, bottom: 2, edge: 4 });
  crumbs(q, STONE_TONES);
  // two plate seams across the shin
  for (const k of [0.34, 0.68]) {
    const x = rnd(ankle[0] + (knee[0] - ankle[0]) * k);
    for (let y = rnd(Math.min(knee[1], ankle[1])) - 8; y < gx; y++) if (q.isOpaque(x, y) && q.isOpaque(x, y - 1) && q.isOpaque(x - 1, y) && q.isOpaque(x + 1, y)) q.set(x, y, OBS.D);
  }
  if (p.crack >= 2) crackLine(q, [knee[0] - 12, knee[1] - 2], [knee[0] - 8, knee[1] + 4], p.crack >= 3);
  stoneFlash(q, p.flash);
  c.add(q, P_SHIN, OBS.D);
}

function paintFoot(c: Comp, p: Pose, f: FootG, light: Light): void {
  const { w, h } = c.p;
  {
    const q = layer(w, h);
    fill(q, f.body, OBS.M);
    bands(q, OBS, light, 3, 2, { top: 1, bottom: 1, edge: 3 });
    crumbs(q, STONE_TONES);
    // the sole face: two tread pads (heel, forefoot) darker than the stone, crossed by ridges
    for (const { x0, x1, y0, y1 } of SOLE_PADS)
      for (let y = y0; y <= y1; y++) {
        const a = f.at(x0, y);
        const b = f.at(x1, y);
        const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
        const row = (y - y0) % 3;
        for (let i = 0; i <= n; i++) {
          const x = rnd(a[0] + ((b[0] - a[0]) * i) / n);
          const yy = rnd(a[1] + ((b[1] - a[1]) * i) / n);
          if (q.isOpaque(x, yy)) q.set(x, yy, row === 1 ? OBS.D : row === 2 ? OBS.S : OBS.M);
        }
      }
    for (const [nx, ny] of NAILS) {
      const a = f.at(nx, ny);
      if (q.isOpaque(rnd(a[0]), rnd(a[1]))) q.set(rnd(a[0]), rnd(a[1]), PAL.gold1);
    }
    if (p.crack >= 2) crackLine(q, f.at(-8, -17), f.at(-5, -11), p.crack >= 3);
    stoneFlash(q, p.flash);
    c.add(q, P_FOOT, OBS.D);
  }
  for (let i = 0; i < 3; i++) {
    const [tx, ty, tw, th] = TOES[i];
    const q = layer(w, h);
    const lift = p.tw[i];
    const a = f.at(tx + tw / 2, ty + th / 2 - 1);
    const rw = Math.max(2, Math.round(th * 0.9));
    const rh = Math.max(2, Math.round(tw * 0.55));
    q.rect(rnd(a[0] - rw / 2), rnd(a[1] - rh / 2 - lift), rw, rh, OBS.M);
    bands(q, OBS, light, 1, 1, { top: 1, bottom: 1, edge: 2 });
    stoneFlash(q, p.flash);
    c.add(q, P_FOOT, OBS.D);
  }
}

// ---------------------------------------------------------------- shackle + chain

export const LINK_FACE = ['.##.', '#..#', '.##.'];
const LINK_EDGE = ['###'];

function stampLink(q: PixelCanvas, x: number, y: number, face: boolean): void {
  if (face) stampBits(q, LINK_FACE, rnd(x) - 2, rnd(y) - 1, (_cx, cy) => (cy === 0 ? BRONZE.L : cy === 2 ? BRONZE.S : BRONZE.M));
  else {
    stampBits(q, LINK_EDGE, rnd(x) - 1, rnd(y), BRONZE.M);
    q.set(rnd(x) - 1, rnd(y) + 1, BRONZE.S);
    q.set(rnd(x), rnd(y) + 1, BRONZE.S);
    q.set(rnd(x) + 1, rnd(y) + 1, BRONZE.S);
  }
}

/** Root of the chain (the shackle ring). */
export function chainRoot(p: Pose): Pt {
  const gnd = p.gnd === null ? p.ankle[1] + 6 : p.gnd;
  return [p.ankle[0] + p.dx - 2, gnd + p.dy - 1];
}

/** Positions of the chain links, root → block. */
export function chainLinks(p: Pose): Pt[] {
  if (!p.ce || p.cn <= 0) return [];
  const r = chainRoot(p);
  const e: Pt = [p.ce[0] + p.dx * 0, p.ce[1]];
  const out: Pt[] = [];
  for (let i = 1; i <= p.cn; i++) {
    const t = i / (p.cn + 0.5);
    const lift = p.cl * Math.sin(Math.PI * t);
    const wav = p.cs * Math.sin((t * 2.2 + p.cp) * Math.PI) * 0.5;
    const hop = i - 1 === p.hop ? -1 : 0;
    out.push([r[0] + (e[0] - r[0]) * t, r[1] + (e[1] - r[1]) * t - lift + wav + hop]);
  }
  return out;
}

function paintShackle(c: Comp, p: Pose, ankle: Pt, light: Light): void {
  const { w, h } = c.p;
  const gnd = p.gnd === null ? ankle[1] + 6 : p.gnd + p.dy;
  const x0 = rnd(ankle[0]) + 1;
  const top = p.gnd === null ? rnd(ankle[1] - 5) : rnd(ankle[1]) - 5;
  const q = layer(w, h);
  q.rect(x0, top + 1, 4, rnd(gnd) - top, BRONZE.M);
  bands(q, BRONZE, light, 1, 1, { top: 1, bottom: 1 });
  q.set(x0 + 1, top + 3, BRONZE.D);
  q.set(x0 + 1, rnd(gnd) - 2, BRONZE.D);
  c.add(q, P_BAND, BRONZE.D);
}

function paintChain(c: Comp, p: Pose, light: Light): void {
  const { w, h } = c.p;
  if (!p.ce || p.cn <= 0) {
    for (const [x, y, f] of p.loose) {
      const q = layer(w, h);
      stampLink(q, x, y + p.dy, f === 0);
      c.add(q, P_CHAIN);
    }
    return;
  }
  const ring = chainRoot(p);
  const links = chainLinks(p);
  // the cast weight block at the end
  {
    const e = links.length ? links[links.length - 1] : ring;
    const ex = rnd(p.ce[0]);
    const ey = rnd(p.ce[1] + (e[1] - p.ce[1]) * 0) - 1;
    const q = layer(w, h);
    // a cast iron weight: a squat block with chamfered shoulders and a bronze ring on top where the last link hooks in
    const iron = { E: PAL.stone2, L: PAL.stone2, M: PAL.stone1, S: PAL.stone0, D: PAL.void0 };
    fill(q, [[ex - 4.5, ey - 3.5], [ex + 3.5, ey - 3.5], [ex + 5.5, ey - 1.5], [ex + 5.5, ey + 3.5], [ex - 5.5, ey + 3.5], [ex - 5.5, ey - 1.5]], iron.M);
    bands(q, iron, light, 2, 2, { top: 1, bottom: 1 });
    q.hline(ex - 3, ex + 2, ey + 0, PAL.void0);
    q.set(ex + 1, ey + 1, PAL.void0);
    q.set(ex - 3, ey + 2, PAL.void0);
    q.set(ex + 3, ey + 2, PAL.void0);
    c.add(q, P_BLOCK, OBS.D);
    const r = layer(w, h);
    stampBits(r, ['.##.', '#..#', '#..#'], ex - 2, ey - 7, (_cx, cy) => (cy === 0 ? BRONZE.L : cy === 2 ? BRONZE.S : BRONZE.M));
    c.add(r, P_BLOCK, OBS.D);
  }
  const q = layer(w, h);
  // the ring on the shackle, then the links (alternating face-on / edge-on) back to the block
  stampLink(q, ring[0], ring[1], true);
  links.slice(0, -1).forEach(([x, y], i) => stampLink(q, x, y, i % 2 === 1));
  for (const [x, y, f] of p.loose) stampLink(q, x, y + p.dy, f === 0);
  c.add(q, P_CHAIN);
}

// ---------------------------------------------------------------- knee plate

export const RIM: readonly Pt[] = [[-6.5, -2.2], [-4.6, -4.6], [-2.2, -6.5], [2.2, -6.5], [4.6, -4.6], [6.5, -2.2], [6.5, 2.2], [4.6, 4.6], [2.2, 6.5], [-2.2, 6.5], [-4.6, 4.6], [-6.5, 2.2]];
export const PAD: readonly Pt[] = [[-4.5, -1.6], [-3.2, -3.2], [-1.6, -4.5], [1.6, -4.5], [3.2, -3.2], [4.5, -1.6], [4.5, 1.6], [3.2, 3.2], [1.6, 4.5], [-1.6, 4.5], [-3.2, 3.2], [-4.5, 1.6]];

/** Plate geometry: x scale (rolling edge-on) and the centre. */
function paintKnee(c: Comp, p: Pose, light: Light): void {
  const { w, h } = c.p;
  const kx = p.kp[0] + p.dx + 0.5;
  const ky = p.kp[1] + p.dy + 0.5;
  const sx = Math.max(0.15, p.pw / 7);
  if (p.smear) {
    const q = layer(w, h);
    fill(q, RIM.map(([x, y]): Pt => [kx - 3 + x * sx, ky + y]), OBS.S);
    c.add(q, P_SMEAR);
  }
  {
    const q = layer(w, h);
    fill(q, RIM.map(([x, y]): Pt => [kx + x * sx, ky + y]), BRONZE.M);
    bands(q, BRONZE, light, 2, 2, { top: 1, bottom: 1, edge: 3 });
    crumbs(q, GOLD_TONES);
    c.add(q, P_KNEE, OBS.D);
  }
  if (sx > 0.55) {
    const q = layer(w, h);
    fill(q, PAD.map(([x, y]): Pt => [kx + p.pad[0] + x * sx, ky + p.pad[1] + y]), OBS.M);
    bands(q, OBS, light, 2, 2, { top: 1, bottom: 1, edge: 2 });
    crumbs(q, STONE_TONES);
    if (p.crack >= 2) crackLine(q, [kx - 3, ky - 3], [kx + 2, ky + 3], p.crack >= 3);
    stoneFlash(q, p.flash);
    c.add(q, P_KNEE, BRONZE.D);
  }
}

// ---------------------------------------------------------------- light layer

function lineTo(a: Pt, b: Pt, put: (x: number, y: number) => void): void {
  const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
  for (let i = 0; i <= n; i++) put(rnd(a[0] + ((b[0] - a[0]) * i) / n), rnd(a[1] + ((b[1] - a[1]) * i) / n));
}

/** The bent-knee glyph on the plate centre, level 0 dark … 3 lit … 4 hot; a violet spill band on the pad around a lit glyph. */
function paintGlyph(c: Comp, p: Pose, light: Light): void {
  if (p.pw < 6) return;
  const x0 = p.kp[0] + p.dx - 2 + p.pad[0];
  const y0 = p.kp[1] + p.dy - 2 + p.pad[1];
  const lv = Math.max(0, Math.min(4, p.lv));
  const stroke = [PAL.mag0, PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag3][lv];
  const shade = [PAL.mag0, PAL.mag0, PAL.mag1, PAL.mag2, PAL.mag2][lv];
  if (lv >= 2 && p.spill > 0)
    for (let j = -4; j <= 4; j++)
      for (let i = -4; i <= 4; i++) {
        if (Math.max(Math.abs(i), Math.abs(j)) < 3) continue;
        const x = x0 + 2 + i;
        const y = y0 + 2 + j;
        if (!c.p.isOpaque(x, y) || c.id[y * c.p.w + x] !== P_KNEE) continue;
        const cur = c.p.get(x, y);
        if (cur !== OBS.M && cur !== OBS.S && cur !== OBS.L) continue;
        const away = i * light.side < 0 || j > 0;
        c.p.set(x, y, away ? PAL.void1 : PAL.void2);
      }
  stampBits(c.p, GLYPH_LEG_L, x0, y0, (gx, gy) => (gx * light.side > 0 && gy >= 1 && lv >= 1 && lv <= 3 ? shade : stroke));
  if (lv >= 4) c.p.set(x0 + 2, y0 + 2, PAL.mag4);
}

function paintSeam(c: Comp, p: Pose, th: SegG): void {
  if (p.seam <= 0) return;
  const tone = [PAL.mag1, PAL.mag1, PAL.mag2, PAL.mag3][Math.min(3, p.seam)];
  let hot = 0;
  for (let i = 0; i + 1 < SEAM.length; i++) {
    const a = loc(th, SEAM[i][0], SEAM[i][1]);
    const b = loc(th, SEAM[i + 1][0], SEAM[i + 1][1]);
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
    for (let k = 0; k <= n; k++) {
      const x = rnd(a[0] + ((b[0] - a[0]) * k) / n);
      const y = rnd(a[1] + ((b[1] - a[1]) * k) / n);
      if (c.p.isOpaque(x, y) && c.id[y * c.p.w + x] === P_THIGH) {
        const hh = p.seam >= 3 && hot < 2 && (i + k) % 4 === 0;
        if (hh) hot++;
        c.p.set(x, y, hh ? PAL.mag4 : tone);
      }
    }
  }
}

const FX_CX = 44;
const FX_CY = 55;
/** floor crack web: polylines (offsets from the knee front), 2:1 flattened */
const WEB: readonly (readonly Pt[])[] = [
  [[0, 0], [7, 2], [12, 1], [19, 4], [26, 3]],
  [[-2, 2], [-9, 4], [-16, 3], [-22, 5]],
  [[2, 3], [6, 5], [11, 6], [15, 8]],
  [[-4, 4], [-9, 6], [-15, 7]],
];

function fxLayer(p: PixelCanvas, o: Pose): void {
  const free = (x: number, y: number) => x >= 2 && y >= 2 && x <= p.w - 3 && y <= p.h - 3 && !p.isOpaque(x, y);
  const put = (x: number, y: number, c: number) => {
    if (free(x, y)) p.set(x, y, c);
  };
  const ox = o.dx;
  if (o.floor > 0) {
    const hw = 33;
    const hh = 6;
    for (let i = 0; i <= hw; i++) {
      const dy = rnd(((hw - i) * hh) / hw);
      for (const sx of [-1, 1])
        for (const sy of [-1, 1]) put(FX_CX + ox + sx * i, FX_CY + sy * dy, o.floor >= 3 || (o.floor >= 2 && (i === hw || i === 0)) ? PAL.mag2 : PAL.mag1);
    }
  }
  if (o.fcrack > 0) {
    const tone = o.fcrack >= 3 ? PAL.mag2 : PAL.mag1;
    const bx = 70 + ox;
    const by = 57;
    WEB.forEach((pl, wi) => {
      const keep = Math.min(pl.length, Math.round((pl.length * Math.min(o.fcrack, 3)) / 3 + (wi < 2 ? 1 : 0)));
      for (let i = 0; i + 1 < keep; i++) lineTo([bx + pl[i][0], by + pl[i][1]], [bx + pl[i + 1][0], by + pl[i + 1][1]], (x, y) => put(x, y, tone));
    });
  }
  for (const [cx, r, tone] of o.rings) {
    const ry = r / 3;
    const cy = 56;
    const inside = (x: number, y: number) => ((x + 0.5 - cx) / r) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
    for (let y = cy - Math.ceil(ry) - 1; y <= cy + Math.ceil(ry) + 1; y++)
      for (let x = rnd(cx) - r - 1; x <= rnd(cx) + r + 1; x++)
        if (inside(x, y) && (!inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1))) put(x, y, MAG[tone]);
  }
  for (const [x, y, t] of o.dust) put(rnd(x), rnd(y), t >= 3 ? PAL.void3 : t === 2 ? PAL.void2 : PAL.void1);
  for (const s of o.sparks) put(rnd(s[0]), rnd(s[1]), PAL.void4);
  for (const m of o.motes) put(rnd(m[0]), rnd(m[1]), MAG[m[2]]);
}

// ---------------------------------------------------------------- the frame

export function drawLeg(p: PixelCanvas, o: Pose, from: DrawOpts['lightFrom'] = 'left'): void {
  const light = lightOf(from);
  const sh = (q: Pt): Pt => [q[0] + o.dx, q[1] + o.dy];
  const hip = sh(o.hip);
  const knee = sh(o.knee);
  const ankle = sh(o.ankle);
  const th = segGeom(hip, knee);
  const foot = footGeom(o);
  const c = new Comp(p);

  for (const ch of o.chips) {
    const q = layer(p.w, p.h);
    const [cw, chh] = ch.k === 0 ? [2, 2] : [3, 2];
    q.rect(rnd(ch.x), rnd(ch.y), cw, chh, OBS.M);
    bands(q, OBS, light, 1, 1);
    c.add(q, P_CHIP, OBS.D);
  }
  paintChain(c, o, light);
  paintShin(c, o, knee, ankle, light);
  paintFoot(c, o, foot, light);
  paintShackle(c, o, ankle, light);
  paintThigh(c, o, th, light);
  paintKnee(c, o, light);

  if (o.clip !== null) for (let y = o.clip + 1; y < p.h; y++) for (let x = 0; x < p.w; x++) p.data[(y * p.w + x) * 4 + 3] = 0;
  p.outline(PAL.ink);

  paintGlyph(c, o, light);
  paintSeam(c, o, th);
  // the leg rising out of the floor: the seal light is cut by the same row (the outline row below it stays)
  if (o.clip !== null) for (let y = o.clip + 2; y < p.h; y++) for (let x = 0; x < p.w; x++) p.data[(y * p.w + x) * 4 + 3] = 0;
  fxLayer(p, o);
}
