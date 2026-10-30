// Sağ Bacak Mührü v3 — the rig of the "Stomper": a severed obsidian right leg of the sealed colossus, standing. A tall Z in profile:
// a thigh slab that leans back from a snapped hip stump (a crown of three broken teeth, leaking seal light), a faceted knee
// plate with a bronze rim that points BACK (left), a shin plate that leans forward and carries a recessed column of three
// stacked falling-arrow runes (the seal), a flat foot slab with three toe blocks stepping down to the right, and two bronze
// bands (thigh, ankle) with a broken chain hanging from the ankle. Planted: the foot never leaves the floor in idle / guard.
//
// The leg is a FORWARD-KINEMATIC chain: a Pose gives the joints (hip, knee, ankle) and the foot angle, so the animations are
// authored as key joint positions and the slabs, plates and bands follow. Every plate is shaded afresh from its own edges
// (so P2 is a true relight). Painted back to front: thigh, thigh band, shin, ankle band, foot, toes, chain, knee plate; then
// the 1-px ink outline; then the light layer (runes, hip seam, floor diamond, rings, cracks, dust) which is never outlined.
//
// Frame 88 × 92, anchor (38, 86) on the floor, hover 0.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { lightOf, type Light } from '../rigkit';
import type { DrawOpts } from '../types';
import { BRONZE, Comp, DEG, GLYPH_LEG_R, GOLD_TONES, MAG, OBS, OBS_FOOT, STONE_TONES, bands, crumbs, fill, layer, rnd, rot, stampBits, type Pt } from './seal_leg_r-kit';

export const W = 88;
export const H = 92;
export const AX = 38;
export const AY = 86;
export const HOVER = 0;

/** Rest joints. */
export const HIP0: Pt = [46, 22];
export const KNEE0: Pt = [28, 47];
export const ANKLE0: Pt = [37, 74];
/** The sole is this far below the ankle in the foot's own frame (so the sole sits on y = 86). */
export const SOLE_DY = 12;

export interface Chip {
  x: number;
  y: number;
  /** 0 = 2×2, 1 = 3×2 */
  k: number;
}

export interface Pose {
  /** top centre of the thigh stump, knee centre (thigh end), start of the shin (default = knee), ankle centre */
  hip: Pt;
  knee: Pt;
  knee2: Pt | null;
  ankle: Pt;
  /** the knee plate centre (default = knee) */
  kneeP: Pt | null;
  /** foot angle in deg around the ankle (+ = toes down), toe lift (px, per toe far → near) and toe curl (deg, + = down) */
  fa: number;
  tl: readonly [number, number, number];
  tc: number;
  /** gap (px along the thigh axis) between the two thigh slabs; thigh slab B / shin shear in px (death, revive) */
  gap: number;
  /** rune levels top → bottom 0 dark … 4 blazing; hip seam 0..3; violet spill of the runes on the stone 0..2 */
  runes: readonly [number, number, number];
  seam: number;
  spill: number;
  /** floor diamond 0 none … 3 */
  floor: number;
  /** cracks across the stone (hitHeavy, death) 0..3 */
  crack: number;
  /** floor crack web 0..3 */
  fcrack: number;
  /** floor shock rings: [x radius, tone 1..3] */
  rings: readonly (readonly [number, number])[];
  /** negative-band flash on the plates (hitMagic) 0..2 */
  flash: number;
  /** chain: swing amplitude (deg) and phase (0..1 per loop), links 0..3 */
  sw: number;
  swT: number;
  links: number;
  /** loose chain links in the air ([x, y, face 0 | 1]) */
  loose: readonly (readonly [number, number, number])[];
  /** dust puffs and seal motes ([x, y, tone 1..3]), hot sparks (void4) */
  dust: readonly (readonly [number, number, number])[];
  motes: readonly (readonly [number, number, number])[];
  sparks: readonly Pt[];
  /** stone chips and pebbles in the air */
  chips: readonly Chip[];
  /** drawing offset of the whole leg in px (summon fall) */
  dy: number;
  /** 2-px smear of the shin and foot behind the fall (release frame only) */
  smear: boolean;
  /** toe press: the toe blocks' tops sink this many px (weight on the toes) */
  tp: number;
  /** vertical light lines ([x, y0, y1, tone 1..3]): the seal's light trailing a fall */
  lines: readonly (readonly [number, number, number, number])[];
}

export const POSE0: Pose = {
  hip: HIP0,
  knee: KNEE0,
  knee2: null,
  ankle: ANKLE0,
  kneeP: null,
  fa: 0,
  tl: [0, 0, 0],
  tc: 0,
  gap: 0,
  runes: [1, 1, 1],
  seam: 1,
  spill: 1,
  floor: 1,
  crack: 0,
  fcrack: 0,
  rings: [],
  flash: 0,
  sw: 0,
  swT: 0,
  links: 3,
  loose: [],
  dust: [],
  motes: [],
  sparks: [],
  chips: [],
  dy: 0,
  smear: false,
  tp: 0,
  lines: [],
};

export function pose(o: Partial<Pose>): Pose {
  return { ...POSE0, ...o };
}

const P_THIGH = 1;
const P_BAND = 2;
const P_SHIN = 3;
const P_FOOT = 4;
const P_TOE = 5;
const P_CHAIN = 6;
const P_KNEE = 7;
const P_CHIP = 8;
const P_SMEAR = 9;

// ---------------------------------------------------------------- frames of a segment

/** A segment frame: origin a, unit u (a → b), v = the right-hand side (+ = toward the screen's right / down), length. */
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
const loc = (g: SegG, t: number, s: number): Pt => [g.a[0] + g.u[0] * t + g.v[0] * s, g.a[1] + g.u[1] * t + g.v[1] * s];

/** Quad of a slab between t0 and t1 along the segment with half widths w0 / w1 and a parting-line shear. */
function slab(g: SegG, t0: number, t1: number, w0: number, w1: number, sh0 = 0, sh1 = 0): Pt[] {
  return [loc(g, t0 - sh0, -w0), loc(g, t1 - sh1, -w1), loc(g, t1 + sh1, w1), loc(g, t0 + sh0, w0)];
}

/** Slab between t0 and t1 whose back (left) and front (right) edges are ragged: half widths per station (evenly spaced in t). */
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

// ---------------------------------------------------------------- the foot

/** Toe blocks in the foot's own frame (x forward from the ankle, y down): far, middle, near — stepping down to the right. */
export const TOES: readonly { x: number; w: number; y0: number; y1: number }[] = [
  { x: 8.5, w: 10, y0: 2.6, y1: 9.4 },
  { x: 11.5, w: 10, y0: 4.6, y1: 11.2 },
  { x: 14.5, w: 9.5, y0: 6.6, y1: SOLE_DY },
];
export const FOOT_BODY: readonly Pt[] = [
  [-15, SOLE_DY],
  [-19, SOLE_DY - 1],
  [-17, 8.5],
  [-15.5, 8],
  [-15, 6],
  [-12, 3],
  [-5, 1.6],
  [5, 2.6],
  [10, 4.2],
  [10, SOLE_DY],
];

export interface FootG {
  /** local → world */
  at(x: number, y: number): Pt;
  body: Pt[];
  toes: Pt[][];
  /** the world point under the toes (the stomp origin), the toe centroid, the heel */
  sole: Pt;
  claw: Pt;
  heel: Pt;
  centre: Pt;
}
export function footGeom(p: Pose): FootG {
  const a: Pt = [p.ankle[0], p.ankle[1] + p.dy];
  const at = (x: number, y: number): Pt => {
    const r = rot(x, y, p.fa);
    return [a[0] + r[0], a[1] + r[1]];
  };
  const body = FOOT_BODY.map(([x, y]) => at(x, y));
  const toes = TOES.map((t, i) => {
    const lift = p.tl[i];
    const pivot: Pt = [t.x, t.y1];
    const y0 = Math.min(t.y0 + p.tp, t.y1 - 3);
    const pts: Pt[] = [
      [t.x, y0 + 1],
      [t.x + 1, y0],
      [t.x + t.w - 2, y0],
      [t.x + t.w, y0 + 2],
      [t.x + t.w, t.y1],
      [t.x, t.y1],
    ];
    return pts.map(([x, y]) => {
      const c = rot(x - pivot[0], y - pivot[1], p.tc);
      return at(pivot[0] + c[0], pivot[1] + c[1] - lift);
    });
  });
  const sole = at(15, SOLE_DY - 0.5);
  const claw = at(19, 9);
  return { at, body, toes, sole, claw, heel: at(-12, SOLE_DY - 1), centre: at(2, 9) };
}

// ---------------------------------------------------------------- stone parts

/** The snapped hip end: a crown of three broken teeth (t < 0 = beyond the stump, s across the thigh). */
const JAG: readonly Pt[] = [
  [-0.6, -9.0],
  [-6.2, -8.2],
  [-2.4, -5.2],
  [-9.0, -2.8],
  [-3.6, 0.0],
  [-9.6, 2.6],
  [-3.2, 4.6],
  [-6.4, 8.6],
  [0.4, 9.0],
];
/** The seam of light 1.8 px inside the break. */
const SEAM: readonly Pt[] = [
  [1.4, -7.0],
  [-1.0, -4.8],
  [-4.4, -2.0],
  [-0.6, 0.6],
  [-4.6, 2.6],
  [-0.8, 4.8],
  [-3.4, 7.0],
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
  if (bleed) q.line(rnd(a[0]) + 1, rnd(a[1]), rnd(b[0]) + 1, rnd(b[1]), PAL.mag1);
}

/** A parting groove along a segment (the front plate's edge): a crease line at offset s, only on pixels already there. */
function groove(q: PixelCanvas, g: SegG, t0: number, t1: number, s: number): void {
  const a = loc(g, t0, s);
  const b = loc(g, t1, s);
  const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
  for (let i = 0; i <= n; i++) {
    const x = rnd(a[0] + ((b[0] - a[0]) * i) / n);
    const y = rnd(a[1] + ((b[1] - a[1]) * i) / n);
    if (q.isOpaque(x, y) && q.isOpaque(x - 1, y) && q.isOpaque(x + 1, y)) q.set(x, y, OBS.D);
  }
}

/** A plate seam across a segment at t (a crease line from side to side, only on pixels already there). */
function across(q: PixelCanvas, g: SegG, t: number, w0: number, w1: number): void {
  const a = loc(g, t, w0);
  const b = loc(g, t, w1);
  const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
  for (let i = 0; i <= n; i++) {
    const x = rnd(a[0] + ((b[0] - a[0]) * i) / n);
    const y = rnd(a[1] + ((b[1] - a[1]) * i) / n);
    if (q.isOpaque(x, y) && q.isOpaque(x, y - 1) && q.isOpaque(x, y + 1)) q.set(x, y, OBS.D);
  }
}

function paintThigh(c: Comp, p: Pose, th: SegG, light: Light): void {
  const { w, h } = c.p;
  const len = th.len;
  const aEnd = len * 0.52 - p.gap / 2;
  const bStart = len * 0.52 + p.gap / 2;
  // B: the lower slab, reaching under the knee plate
  {
    const q = layer(w, h);
    fill(q, slabN(th, bStart, len + 1, [8.6, 7.4, 8.8, 7.6, 9.0, 8.2], [8.4, 9.0, 8.2, 9.2, 8.6, 9.0]), OBS.M);
    bands(q, OBS, light, 3, 2, { top: 1, bottom: 1, edge: 3 });
    crumbs(q, STONE_TONES);
    groove(q, th, bStart + 1.5, len - 1, 3.6);
    across(q, th, bStart + (len - bStart) * 0.5, -8, 2.4);
    if (p.crack >= 2) crackLine(q, loc(th, bStart + 6, -3), loc(th, bStart + 11, 3), p.crack >= 3);
    stoneFlash(q, p.flash);
    c.add(q, P_THIGH, OBS.D);
  }
  // A: the upper slab with the broken crown
  {
    const q = layer(w, h);
    const pts: Pt[] = [loc(th, aEnd, -8.8), loc(th, aEnd * 0.55, -7.6)];
    for (const [t, s] of JAG) pts.push(loc(th, t, s));
    pts.push(loc(th, aEnd * 0.4, 9.2), loc(th, aEnd, 8.8));
    fill(q, pts, OBS.M);
    bands(q, OBS, light, 3, 2, { top: 1, bottom: 1, edge: 3 });
    crumbs(q, STONE_TONES);
    groove(q, th, 2.5, aEnd - 0.5, 3.6);
    across(q, th, aEnd * 0.62, -8, 2.4);
    if (p.crack >= 1) crackLine(q, loc(th, aEnd - 9, -4), loc(th, aEnd - 3, 2), p.crack >= 2);
    if (p.crack >= 3) crackLine(q, loc(th, aEnd - 3, 2), loc(th, aEnd - 1, 6), true);
    stoneFlash(q, p.flash);
    c.add(q, P_THIGH, OBS.D);
  }
  // thigh band
  {
    const t0 = len * 0.36;
    const q = layer(w, h);
    fill(q, slab(th, t0, t0 + 4.2, 8.9, 9.0), BRONZE.M);
    bands(q, BRONZE, light, 2, 1, { top: 1, bottom: 1, edge: 0 });
    crumbs(q, GOLD_TONES);
    for (const sRiv of [-5.2, 5.2]) {
      const [rx, ry] = loc(th, t0 + 2.1, sRiv);
      q.set(rnd(rx), rnd(ry), BRONZE.D);
    }
    c.add(q, P_BAND, BRONZE.D);
  }
}

function paintShin(c: Comp, p: Pose, sh: SegG, light: Light): void {
  const { w, h } = c.p;
  const len = sh.len;
  // the plate
  {
    const q = layer(w, h);
    fill(q, slab(sh, 1, len + 4, 7.2, 6.2, 0.6, -0.4), OBS.M);
    bands(q, OBS, light, 3, 2, { top: 1, bottom: 1, edge: 2 });
    crumbs(q, STONE_TONES);
    // two plate seams across the shin
    for (const k of [0.36, 0.7]) {
      const a = loc(sh, len * k, -6.6);
      const b = loc(sh, len * k, 6.2);
      q.line(rnd(a[0]), rnd(a[1]), rnd(b[0]), rnd(b[1]), OBS.D);
    }
    // the rune column's socket: a recessed dark bed along the axis
    const a = loc(sh, 4.4, 0);
    const b = loc(sh, len - 4.6, 0);
    const d = segGeom(a, b);
    fill(q, slab(d, 0, d.len, 3.5, 3.5), PAL.void0);
    if (p.crack >= 1) crackLine(q, loc(sh, len * 0.5, 4), loc(sh, len * 0.62, 6.4), p.crack >= 3);
    if (p.crack >= 2) crackLine(q, loc(sh, len * 0.2, -6), loc(sh, len * 0.3, -3.6), false);
    stoneFlash(q, p.flash);
    c.add(q, P_SHIN, OBS.D);
  }
  // ankle band
  {
    const q = layer(w, h);
    fill(q, slab(sh, len - 3.2, len + 1.2, 7.6, 7.0), BRONZE.M);
    bands(q, BRONZE, light, 2, 1, { top: 1, bottom: 1 });
    crumbs(q, GOLD_TONES);
    c.add(q, P_BAND, BRONZE.D);
  }
}

function paintFoot(c: Comp, p: Pose, f: FootG, light: Light): void {
  const { w, h } = c.p;
  if (p.smear) {
    const q = layer(w, h);
    fill(q, f.body.map(([x, y]): Pt => [x, y - 2]), OBS.S);
    c.add(q, P_SMEAR);
  }
  {
    const q = layer(w, h);
    fill(q, f.body, OBS_FOOT.M);
    bands(q, OBS_FOOT, light, 3, 2, { top: 1, bottom: 2, edge: 4 });
    crumbs(q, STONE_TONES);
    // two plate seams across the foot (heel plate, instep plate) and a chipped heel corner
    for (const lx of [-8, 3.5]) {
      const a = f.at(lx, 6.5);
      const b = f.at(lx, 10.5);
      q.line(rnd(a[0]), rnd(a[1]), rnd(b[0]), rnd(b[1]), OBS.D);
    }
    stoneFlash(q, p.flash);
    c.add(q, P_FOOT, OBS.D);
  }
  for (let i = 0; i < 3; i++) {
    const q = layer(w, h);
    fill(q, f.toes[i], OBS.M);
    bands(q, OBS, light, 2, 2, { top: 1, bottom: 1, edge: 3 });
    stoneFlash(q, p.flash);
    c.add(q, P_TOE, OBS.D);
  }
}

// ---------------------------------------------------------------- chain

const LINK_FACE = ['.#.', '#.#', '#.#', '.#.'];
const LINK_EDGE = ['#', '#', '#'];

function stampLink(q: PixelCanvas, x: number, y: number, face: boolean): void {
  const bits = face ? LINK_FACE : LINK_EDGE;
  stampBits(q, bits, rnd(x) - (face ? 1 : 0), rnd(y) - (face ? 2 : 1), (_cx, cy) => (cy < (bits.length >> 1) ? BRONZE.M : BRONZE.S));
}

function paintChain(c: Comp, p: Pose, sh: SegG): void {
  const q = layer(c.p.w, c.p.h);
  if (p.links > 0) {
    // hangs from the back of the ankle band; a wave runs down it
    const a = loc(sh, sh.len - 1.5, -7.2);
    let x = a[0] - 0.5;
    let y = a[1] + 1.5;
    const pitch = 2.7;
    for (let i = 0; i < Math.min(3, p.links); i++) {
      const k = (i + 1) / 3;
      const ang = p.sw * Math.sin((p.swT - i * 0.14) * Math.PI * 2) * (0.5 + k * 0.5) * DEG;
      x += Math.sin(ang) * pitch;
      y += Math.cos(ang) * pitch;
      stampLink(q, x, y, i % 2 === 0);
    }
  }
  for (const [x, y, f] of p.loose) stampLink(q, x, y + p.dy, f === 0);
  c.add(q, P_CHAIN);
}

// ---------------------------------------------------------------- knee plate

const KNEE_RIM: readonly Pt[] = [[-11, 0], [-6, -7.8], [3, -9.2], [8.4, -4], [8.4, 5], [3, 9.2], [-6, 8]];
const KNEE_PAD: readonly Pt[] = [[-8, 0], [-4, -5.6], [2.6, -6.8], [5.8, -3], [5.8, 3.6], [2.2, 6.8], [-4, 6]];

function paintKnee(c: Comp, p: Pose, centre: Pt, light: Light): void {
  const { w, h } = c.p;
  const [kx, ky] = centre;
  {
    const q = layer(w, h);
    fill(q, KNEE_RIM.map(([x, y]): Pt => [kx + x, ky + y]), BRONZE.M);
    bands(q, BRONZE, light, 2, 2, { top: 1, bottom: 1, edge: 3 });
    crumbs(q, GOLD_TONES);
    c.add(q, P_KNEE, OBS.D);
  }
  {
    const q = layer(w, h);
    fill(q, KNEE_PAD.map(([x, y]): Pt => [kx + x, ky + y]), OBS.M);
    bands(q, OBS, light, 3, 2, { top: 1, bottom: 1, edge: 2 });
    crumbs(q, STONE_TONES);
    if (p.crack >= 2) crackLine(q, [kx - 4, ky - 3], [kx + 1, ky + 3], p.crack >= 3);
    stoneFlash(q, p.flash);
    c.add(q, P_KNEE, BRONZE.D);
  }
}

// ---------------------------------------------------------------- light layer

function lineTo(a: Pt, b: Pt, put: (x: number, y: number) => void): void {
  const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
  for (let i = 0; i <= n; i++) put(rnd(a[0] + ((b[0] - a[0]) * i) / n), rnd(a[1] + ((b[1] - a[1]) * i) / n));
}

/** The rune column: three stacked falling arrows, level 0 dark … 4 blazing, a violet cool ring on the shadow side when lit. */
function paintRunes(c: Comp, p: Pose, sh: SegG, light: Light): void {
  const len = sh.len;
  const span = len - 4.6 - 4.4;
  for (let j = 0; j < 3; j++) {
    const t = 4.4 + span * (0.5 / 3 + j / 3) + 0.2;
    const [cx, cy] = loc(sh, t, 0);
    const x0 = rnd(cx) - 2;
    const y0 = rnd(cy) - 2;
    const lv = Math.max(0, Math.min(4, p.runes[j]));
    const stroke = [PAL.mag0, PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag3][lv];
    const shade = [PAL.mag0, PAL.mag0, PAL.mag1, PAL.mag2, PAL.mag2][lv];
    // cool violet halo ring of the lit glyph on its shadow side
    if (lv >= 3)
      for (let i = -3; i <= 3; i++)
        for (let k = -3; k <= 3; k++) {
          if (Math.abs(i) < 3 && Math.abs(k) < 3) continue;
          const x = x0 + 2 + i;
          const y = y0 + 2 + k;
          const away = (i * light.side < 0 ? 1 : 0) + (k > 0 ? 1 : 0);
          if (away >= 1 && c.p.isOpaque(x, y) && c.id[y * c.p.w + x] === P_SHIN && c.p.get(x, y) === PAL.void0) c.p.set(x, y, PAL.void2);
        }
    stampBits(c.p, GLYPH_LEG_R, x0, y0, (gx, gy) => (gx * light.side > 0 && gy >= 1 && lv >= 1 && lv <= 3 ? shade : stroke));
    if (lv >= 4) c.p.set(x0 + 2, y0 + 2, PAL.mag4);
  }
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
        const h = p.seam >= 3 && hot < 2 && (i + k) % 4 === 0;
        if (h) hot++;
        c.p.set(x, y, h ? PAL.mag4 : tone);
      }
    }
  }
}

const FX_CX = 40;
const FX_CY = 81;
/** floor crack polylines (offsets from the diamond centre, 2:1 flattened), a web around the foot */
const WEB: readonly (readonly Pt[])[] = [
  [[8, 3], [15, 5], [19, 4], [25, 7], [30, 6]],
  [[-9, 4], [-16, 5], [-22, 4], [-27, 7]],
  [[4, 6], [8, 8], [14, 8], [19, 10]],
  [[-4, 6], [-8, 8], [-15, 9]],
  [[15, 5], [19, 8], [22, 9]],
];

function fxLayer(p: PixelCanvas, o: Pose): void {
  const free = (x: number, y: number) => x >= 2 && y >= 2 && x <= p.w - 3 && y <= p.h - 3 && !p.isOpaque(x, y);
  const put = (x: number, y: number, c: number) => {
    if (free(x, y)) p.set(x, y, c);
  };
  // floor diamond (2:1) round the foot
  if (o.floor > 0) {
    const hw = 17;
    const hh = 8;
    for (let i = 0; i <= hw; i++) {
      const dy = rnd(((hw - i) * hh) / hw);
      for (const sx of [-1, 1])
        for (const sy of [-1, 1]) put(FX_CX + sx * i, FX_CY + sy * dy, o.floor >= 3 || (o.floor >= 2 && (i === hw || i === 0)) ? PAL.mag2 : PAL.mag1);
    }
  }
  // the floor crack web (persists a few frames after the slam)
  if (o.fcrack > 0) {
    const tone = o.fcrack >= 3 ? PAL.mag2 : PAL.mag1;
    WEB.forEach((pl, wi) => {
      const keep = Math.min(pl.length, Math.round((pl.length * Math.min(o.fcrack, 3)) / 3 + (wi < 2 ? 1 : 0)));
      for (let i = 0; i + 1 < keep; i++) lineTo([FX_CX + pl[i][0], FX_CY + pl[i][1]], [FX_CX + pl[i + 1][0], FX_CY + pl[i + 1][1]], (x, y) => put(x, y, tone));
    });
  }
  // the shock rings: stepped 2:1 ellipses on the floor
  for (const [r, tone] of o.rings) {
    const ry = r / 2;
    const inside = (x: number, y: number) => ((x + 0.5 - FX_CX) / r) ** 2 + ((y + 0.5 - (FX_CY + 1)) / ry) ** 2 <= 1;
    for (let y = FX_CY + 1 - Math.ceil(ry) - 1; y <= FX_CY + 1 + Math.ceil(ry) + 1; y++)
      for (let x = FX_CX - r - 1; x <= FX_CX + r + 1; x++)
        if (inside(x, y) && (!inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1))) put(x, y, MAG[tone]);
  }
  for (const [x, y0, y1, t] of o.lines) for (let y = y0; y <= y1; y++) put(x, y, t >= 3 ? PAL.void3 : t === 2 ? PAL.void2 : PAL.mag1);
  for (const [x, y, t] of o.dust) {
    put(rnd(x), rnd(y), t >= 3 ? PAL.void3 : t === 2 ? PAL.void2 : PAL.void1);
  }
  for (const s of o.sparks) put(rnd(s[0]), rnd(s[1]), PAL.void4);
  for (const m of o.motes) put(rnd(m[0]), rnd(m[1]), MAG[m[2]]);
}

// ---------------------------------------------------------------- the frame

export function drawLeg(p: PixelCanvas, o: Pose, from: DrawOpts['lightFrom'] = 'left'): void {
  const light = lightOf(from);
  const dy = o.dy;
  const sh = (q: Pt): Pt => [q[0], q[1] + dy];
  const hip = sh(o.hip);
  const knee = sh(o.knee);
  const knee2 = sh(o.knee2 ?? o.knee);
  const ankle = sh(o.ankle);
  const kneeP = sh(o.kneeP ?? [rnd(o.knee[0]), rnd(o.knee[1])]);
  const th = segGeom(hip, knee);
  const sg = segGeom(knee2, ankle);
  const foot = footGeom(o);
  const c = new Comp(p);

  // chips in the air (far side)
  for (const ch of o.chips) {
    const q = layer(p.w, p.h);
    const [cw, chh] = ch.k === 0 ? [2, 2] : [3, 2];
    q.rect(rnd(ch.x), rnd(ch.y + dy), cw, chh, OBS.M);
    bands(q, OBS, light, 1, 1);
    c.add(q, P_CHIP, OBS.D);
  }
  paintThigh(c, o, th, light);
  paintShin(c, o, sg, light);
  paintFoot(c, o, foot, light);
  paintChain(c, o, sg);
  paintKnee(c, o, kneeP, light);

  p.outline(PAL.ink);

  // ---- light layer (after the outline, never outlined)
  paintRunes(c, o, sg, light);
  paintSeam(c, o, th);
  fxLayer(p, o);
}
