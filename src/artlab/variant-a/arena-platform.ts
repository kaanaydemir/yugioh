// Art Lab A — the floating stone-and-wood duel platform (static layers, drawn once).
//
//   drawPlatform(p): floor (pavers, bridge flagstones, mats + emblems, divider hedge + medallion,
//                    moss, cracks), slab sides
//                    (stone courses + joist band), rock keel underneath with hanging roots, the
//                    back rim beams, back railing and the flowers along it. → LAB_DEPTH.PLATFORM
//   drawFront(p):    front rim beams, corner posts, the stone lantern pedestal, front posts and
//                    the flower clusters / vines spilling over the front edge.  → PROPS_FRONT
// Both are full-screen 640×360 canvases in screen coordinates.

import type { Color, PixelCanvas } from '../../art/pixel';
import type { XY } from '../types';
import { A_INK, A_RAMPS } from './palette';
import { box, dith, HA, hash, HB, isoAt, MAT, MAT_B, mixc, OX, OY, RH, RW, scr, SLAB, SLOT_A } from './arena-iso';

const S = A_RAMPS.stone;
const W = A_RAMPS.wood;
const L = A_RAMPS.leaf;
const TQ = A_RAMPS.turq;
const CO = A_RAMPS.coral;

// local in-between tones (deliberate, so paver variants stay in clean bands)
const S_23 = mixc(S[2], S[3], 0.5);
const S_34 = mixc(S[3], S[4], 0.5);
const S_12 = mixc(S[1], S[2], 0.5);
/** Shaded (lower-left) face tones lean plum, lit (lower-right) face tones lean warm. */
const PLUM_SH = mixc(S[1], 0x3a1d3e, 0.35);
const PLUM_DK = mixc(S[0], 0x2a1030, 0.3);

// ---------------------------------------------------------------- floor

const PA = 14; // paver length along a
const PB = 11; // paver width along b

interface Paver {
  base: Color;
  hi: Color;
  lo: Color;
}
/** Sunset-tinted stone variants (a warm rose cast and a cool lavender cast), used sparingly. */
const S_WARM = mixc(S[3], CO[4], 0.2);
const S_COOL = mixc(S[3], A_RAMPS.lavender[2], 0.16);
const PAVER_DARK: Paver = { base: S_23, hi: S[3], lo: S[2] };
const PAVER_MID: Paver = { base: S[3], hi: S_34, lo: S_23 };
const PAVER_LIGHT: Paver = { base: S_34, hi: S[4], lo: S[3] };
const PAVER_WARM: Paver = { base: S_WARM, hi: mixc(S_34, CO[4], 0.2), lo: mixc(S_23, CO[3], 0.18) };
const PAVER_COOL: Paver = { base: S_COOL, hi: mixc(S_34, A_RAMPS.lavender[3], 0.14), lo: mixc(S_23, A_RAMPS.lavender[1], 0.16) };

/** Paver variant: biased darker toward the back (far) edges, lighter toward the front. */
function paverVariant(h: number, a: number, b: number, k: number): Paver {
  const front = (b - a) / (HA + HB); // -1 far .. 1 near
  const v = h + front * 0.22;
  if (k < 0.09) return PAVER_WARM;
  if (k < 0.16) return PAVER_COOL;
  if (v < 0.22) return PAVER_DARK;
  if (v > 0.8) return PAVER_LIGHT;
  return PAVER_MID;
}

const BRIDGE = { a0: -52, a1: 52, b0: -20, b1: 20 };

/** Emblems (11×11) painted on the mats; each cell is 2×2 iso units. */
const GLYPH_P1 = [
  '.....X.....',
  '....XXX....',
  '.....X.....',
  '.X...X...X.',
  '..X.XXX.X..',
  'XXXXX.XXXXX',
  '..X.XXX.X..',
  '.X...X...X.',
  '.....X.....',
  '....XXX....',
  '.....X.....',
];
/**
 * Opponent emblem: one thin, broken ring ('o', one step above the cloth) around a small crescent
 * moon ('X') — the wizard side's moon, as on its banners. Deliberately calmer than a bullseye: the
 * warm sun spill lands on these mats, and the wizard stands on the middle one.
 */
const GLYPH_P2 = [
  '...oo.oo...',
  '..o.....o..',
  '.o.......o.',
  'o...XXX...o',
  'o..XX.....o',
  '...X.......',
  'o..XX.....o',
  'o...XXX...o',
  '.o.......o.',
  '..o.....o..',
  '...oo.oo...',
];

interface MatSpec {
  a: number;
  b: number;
  ramp: readonly number[];
  glyph: readonly string[];
}
export const MATS: MatSpec[] = [
  ...MAT_B.map((b) => ({ a: -SLOT_A, b, ramp: TQ, glyph: GLYPH_P1 })),
  ...MAT_B.map((b) => ({ a: SLOT_A, b, ramp: CO, glyph: GLYPH_P2 })),
];

function matColor(m: MatSpec, a: number, b: number): Color | null {
  const h = MAT / 2;
  const du = a - (m.a - h);
  const dv = b - (m.b - h);
  if (du < 0 || dv < 0 || du >= MAT || dv >= MAT) return null;
  const r = m.ramp;
  const e = Math.min(du, dv, MAT - du, MAT - dv);
  // lower edges (small du = lower-left, large dv = lower-right) carry the cloth's thickness
  if (e < 1) return du < 1 || MAT - dv <= 1 ? r[0] : r[1];
  if (e < 3) return du < 3 && du <= MAT - dv ? r[3] : dv < 3 && dv < du ? r[4] : r[3];
  if (e < 4) return r[1];
  // inner frame line with little corner diamonds
  const cornerU = du < 9 || du >= MAT - 9;
  const cornerV = dv < 9 || dv >= MAT - 9;
  if (e >= 6 && e < 7) return r[3];
  if (cornerU && cornerV && e >= 4 && e < 9) {
    const cu = du < 9 ? 6.5 : MAT - 6.5;
    const cv = dv < 9 ? 6.5 : MAT - 6.5;
    if (Math.abs(du - cu) + Math.abs(dv - cv) < 2.2) return r[4];
  }
  // emblem
  const gi = Math.floor((b - m.b) / 2 + 5.5);
  const gj = Math.floor((m.a - a) / 2 + 5.5);
  if (gi >= 0 && gi < 11 && gj >= 0 && gj < 11) {
    const g = m.glyph[gj][gi];
    if (g === 'X') return r[4];
    if (g === 'o') return r[3];
  }
  // soft inner vignette: one band darker toward the edge frame
  if (e < 10) return r[2];
  return r[2];
}

// ---------------------------------------------------------------- divider hedge

/**
 * The line between the two halves (a = 0) is a low planted hedge strip laid from the back rim to
 * the front rim, broken only where the paved bridge crosses it. Across the strip (screen rows at a
 * fixed x, a grows upward 1 px per row):
 *   a ∈ [5, 6)   grout joint against the pavers
 *   a ∈ [4, 5)   light stone curb (its far wall catches the light), with a joint every 12 units
 *   a ∈ [-3, 4)  moss bed: a dark row under the curb, mid moss, a dark bottom row — leaf clumps
 *                and low 1–2 px flowers are stamped on top in screen space (hedgeLeaves)
 *   a ∈ [-4, -3) dark lip (the bed's shadow on the near pavers)
 * Segment ends at the bridge: the upper-left end of a segment is curb, the lower-right end is lip.
 * On the bridge an engraved groove carries the line through a crisp inlaid medallion (bronze ring,
 * turquoise / coral halves split along the duel line, gold boss).
 */
const DIV_B0 = -HB + RW;
const DIV_B1 = HB - RW;
const HEDGE_LIP = -4;
const HEDGE_A0 = -3;
const HEDGE_A1 = 4;
const HEDGE_CURB = 5;
/** The two hedge segments along b: back rim → bridge, bridge → front rim. */
const HEDGE_SEGS: readonly (readonly [number, number])[] = [
  [DIV_B0, -20],
  [20, DIV_B1],
];
/**
 * Where the wizard's bolt and the dragon's breath cross the strip on screen (b range): only 1-px
 * flowers there, so nothing pokes up into the effect paths.
 */
const ATTACK_PATH_B: readonly [number, number] = [-46, -6];
const MED = 8; // medallion half size (iso units): 32×16 px diamond on screen
const G = A_RAMPS.gold;
const CURB = S[5];
const CURB_JOINT = S[3];
const LIP = S[0];

function hedgeSeg(b: number): number {
  for (let i = 0; i < HEDGE_SEGS.length; i++) if (b >= HEDGE_SEGS[i][0] && b < HEDGE_SEGS[i][1]) return i;
  return -1;
}

/** Inlaid medallion at the centre of the bridge (null = outside). */
function medallion(a: number, b: number): Color | null {
  const m = Math.max(Math.abs(a), Math.abs(b));
  if (m >= MED) return null;
  if (m >= MED - 1) return LIP; // crisp dark outline
  if (m >= MED - 2) {
    // bronze ring: the upper-left edge (b = -m) catches the light, the near edges are shaded
    if (-b >= Math.abs(a)) return G[3];
    if (a >= Math.abs(b)) return G[2];
    return G[1];
  }
  if (m >= MED - 3) return LIP; // inner joint
  // small gold boss in the middle (lit on its upper-left edge)
  if (m < 1.5) return -b >= Math.abs(a) - 0.5 && m >= 0.5 ? G[4] : G[3];
  // the duel line: a 1-px light inlay along a = 0 splitting the two halves
  if (a >= -0.5 && a < 0.5) return S[4];
  const half = a < 0 ? TQ : CO;
  // each half: one lit band along its far wall, then the flat field
  const far = a < 0 ? -b >= -a - 0.5 && m >= MED - 4 : -b >= a - 0.5 && m >= MED - 4;
  return far ? half[3] : half[2];
}

function dividerColor(a: number, b: number, c: Color): Color {
  const med = medallion(a, b);
  if (med !== null) return med;
  if (b < DIV_B0 || b >= DIV_B1) return c;
  if (inBridge(a, b)) {
    // engraved groove across the bridge flagstones (not through the bridge curbs)
    if (Math.min(b - BRIDGE.b0, BRIDGE.b1 - b) < 2) return c;
    if (a >= -1 && a < 0) return S[1];
    if (a >= 0 && a < 1) return S_34;
    return c;
  }
  if (a < HEDGE_LIP || a >= HEDGE_CURB + 1) return c;
  const seg = hedgeSeg(b);
  if (seg < 0) return c;
  // a grout joint between the pavers and the curb, so the light curb reads as its own stone
  if (a >= HEDGE_CURB) return b < HEDGE_SEGS[seg][1] ? S[1] : c;
  // segment ends: the upper-left end wall is lit curb, the lower-right end is the dark lip
  if (b >= HEDGE_SEGS[seg][1] - 1) return LIP;
  if (b < HEDGE_SEGS[seg][0] + 1 && seg > 0) return a < HEDGE_A0 ? LIP : CURB;
  if (a >= HEDGE_A1) return Math.floor(b + 1000) % 12 === 0 ? CURB_JOINT : CURB;
  if (a < HEDGE_A0) return LIP;
  // moss bed base (leaf clumps are stamped over it): dark under the curb and at the bottom
  if (a >= HEDGE_A1 - 1 || a < HEDGE_A0 + 1) return L[1];
  return L[2];
}

/** True where (x, y) is inside the moss bed proper (not curb / lip / segment ends). */
function inMoss(x: number, y: number): boolean {
  const q = isoAt(x, y);
  if (q.a < HEDGE_A0 || q.a >= HEDGE_A1) return false;
  const seg = hedgeSeg(q.b);
  if (seg < 0) return false;
  if (q.b >= HEDGE_SEGS[seg][1] - 1) return false;
  if (seg > 0 && q.b < HEDGE_SEGS[seg][0] + 1) return false;
  return true;
}

/** Leaf clumps (lit from the upper left): Y highlight, G lit, g mid, d shade. */
const CLUMPS = [
  ['.GG..', 'GYGg.', 'gGggd', '.dgd.'],
  ['.Gg.', 'GYgg', 'gggd', '.dd.'],
  ['..GG..', '.GYGg.', 'GGgggd', '.dgdd.'],
  ['.G.', 'GYg', 'ggd'],
];

/**
 * Leaves and flowers of the hedge, stamped in screen space and clipped to the moss bed so the curb
 * and lip stay clean 1-px lines. Clumps overlap like a low hedge; flowers are 1–2 px tall (only
 * single-pixel buds in the bolt / breath paths).
 */
function hedgeLeaves(p: PixelCanvas): void {
  const key: Record<string, Color> = { d: L[1], g: L[2], G: L[3], Y: L[4] };
  const put = (x: number, y: number, c: Color) => {
    if (inMoss(x, y)) p.set(x, y, c);
  };
  /** Screen y of the pixel row whose centre has height a at column x. */
  const rowAt = (x: number, a: number) => Math.floor(OY + (x + 0.5 - OX) / 2 - a - 0.5);
  HEDGE_SEGS.forEach(([b0, b1], si) => {
    const x0 = Math.ceil(OX + b0) + 1;
    const x1 = Math.floor(OX + b1) - 2;
    // leaf clumps: overlapping, alternating high / low in the bed. Laid out left → right, then
    // stamped right → left, so every clump's shaded right side stays visible over its neighbour
    // and the bushes read as separate leaf masses (not one green rope)
    const placed: { x: number; t: readonly string[]; hi: boolean }[] = [];
    let k = 0;
    for (let x = x0; x < x1; k++) {
      const t = CLUMPS[Math.floor(hash(k, si, 171) * CLUMPS.length)];
      placed.push({ x, t, hi: k % 2 === 0 });
      x += t[0].length - 1 - Math.floor(hash(k, si, 172) * 2);
    }
    for (let n = placed.length - 1; n >= 0; n--) {
      const { x, t, hi } = placed[n];
      const w = t[0].length;
      const base = rowAt(x + (w >> 1), HEDGE_A0 + (hi ? 2.5 : 1.5)); // bottom row of the stamp
      const top = base - t.length + 1;
      for (let j = 0; j < t.length; j++)
        for (let i = 0; i < w; i++) {
          const c = key[t[j][i]];
          if (c !== undefined) put(x + i, top + j, c);
        }
    }
    // flowers all along the strip
    let f = 0;
    for (let x = x0 + 2; x < x1 - 1; f++) {
      const b = x - OX; // b of the strip centre at this column (a ≈ 0)
      const inPath = b >= ATTACK_PATH_B[0] && b < ATTACK_PATH_B[1];
      const pink = hash(f, si, 173) < 0.38;
      const r = pink ? PP : PW;
      const y = rowAt(x, HEDGE_A0 + 2.5 + Math.floor(hash(f, si, 174) * 3));
      const big = !inPath && hash(f, si, 175) < 0.55;
      if (big) {
        // 3×2: one lit petal on top, petal – gold heart – shaded petal below
        put(x, y - 1, r[2]);
        put(x - 1, y, r[2]);
        put(x, y, G[3]);
        put(x + 1, y, r[1]);
      } else {
        put(x, y, r[2]);
      }
      x += 4 + Math.floor(hash(f, si, 176) * 5);
    }
  });
}

function inBridge(a: number, b: number): boolean {
  return a >= BRIDGE.a0 && a < BRIDGE.a1 && b >= BRIDGE.b0 && b < BRIDGE.b1;
}

function bridgeColor(a: number, b: number): Color {
  // curb lines along the path edges
  const eb = Math.min(b - BRIDGE.b0, BRIDGE.b1 - b);
  if (eb < 1) return S[2];
  if (eb < 2) return b - BRIDGE.b0 < 2 ? S_34 : S_23;
  // long flagstones: 3 rows, staggered
  const row = Math.floor((b - BRIDGE.b0 - 2) / 12);
  const v = (b - BRIDGE.b0 - 2) - row * 12;
  const off = row % 2 === 0 ? 0 : 11;
  const ua = a - BRIDGE.a0 + off;
  const i = Math.floor(ua / 22);
  const u = ua - i * 22;
  if (v < 1 || u < 1) return S[1];
  const h = hash(i, row, 31);
  const base = h < 0.35 ? S_34 : h < 0.8 ? S[3] : S_23;
  if (v < 2) return base === S_34 ? S[4] : S_34;
  if (v >= 11) return base === S_23 ? S[2] : S_23;
  // a few worn dimples
  if (hash(Math.floor(u / 3), Math.floor(v / 2), i * 7 + row) < 0.04) return base === S[3] ? S_23 : S[3];
  return base;
}

function paverColor(a: number, b: number, x: number, y: number): Color {
  const B0 = b + 1000;
  const j = Math.floor(B0 / PB);
  const v = B0 - j * PB;
  const off = (j & 1) * (PA / 2);
  const A0 = a + 1000 + off;
  const i = Math.floor(A0 / PA);
  const u = A0 - i * PA;
  const h = hash(i, j, 3);
  const pv = paverVariant(h, a, b, hash(i, j, 4));
  if (u < 1 || v < 1) return S[1];
  if (v < 2) return pv.hi;
  if (v >= PB - 1) return pv.lo;
  if (u >= PA - 1) return pv.lo;
  // a small deliberate speck cluster on some pavers
  if (hash(i, j, 11) < 0.25) {
    const su = 3 + Math.floor(hash(i, j, 12) * (PA - 7));
    const sv = 3 + Math.floor(hash(i, j, 13) * (PB - 6));
    if (Math.abs(u - su - 0.5) + Math.abs(v - sv - 0.5) < 1.3) return pv.lo;
  }
  void x;
  void y;
  return pv.base;
}

function floorColor(a: number, b: number, x: number, y: number): Color {
  let c: Color | null = null;
  for (const m of MATS) {
    c = matColor(m, a, b);
    if (c !== null) break;
  }
  if (c === null) c = inBridge(a, b) ? bridgeColor(a, b) : paverColor(a, b, x, y);
  c = dividerColor(a, b, c);
  // contact shadow along the inside of the back rim beams (they stand RH px proud)
  const db = b - (-HB + RW);
  const da = HA - RW - a;
  if (db < 3 || da < 3) {
    const deep = db < 1.5 || da < 1.5;
    c = darker(c, deep ? 2 : 1, x, y, deep);
  }
  return c;
}

/** Shade a floor colour 1–2 steps along its own ramp. */
function darker(c: Color, k: number, x: number, y: number, solid: boolean): Color {
  for (const r of [S, TQ, CO, L] as readonly (readonly number[])[]) {
    const i = r.indexOf(c);
    if (i >= 0) return r[Math.max(0, i - k)];
  }
  const local: Record<number, Color> = { [S_23]: S[2], [S_34]: S[3], [S_12]: S[1], [S_WARM]: S_23, [S_COOL]: S_23 };
  if (local[c] !== undefined) return k > 1 && solid ? S_12 : local[c];
  void x;
  void y;
  return c;
}

// ---------------------------------------------------------------- slab sides

/** Side face of the slab: v = depth below the floor (0..SLAB), u along the face. lit = lower-right face. */
function slabFace(u: number, v: number, lit: boolean, seed: number): Color {
  const k = lit ? 0 : -1;
  const st = (i: number) => S[Math.max(0, i + k)];
  if (v < 1) return lit ? W[1] : W[0]; // shadow line under the rim beam
  if (v < 12) {
    // two courses of dressed stone blocks
    const course = v < 6.5 ? 0 : 1;
    const cv = course === 0 ? v - 1 : v - 6.5;
    if (cv < 0.5 && course === 1) return lit ? S[1] : PLUM_SH;
    const len = 13;
    const uu = u + (course ? 6 : 0) + seed;
    const bi = Math.floor(uu / len);
    const bu = uu - bi * len;
    if (bu < 1) return lit ? S[1] : PLUM_SH;
    const h = hash(bi, course, seed + 17);
    const base = h < 0.3 ? st(3) : h < 0.85 ? (lit ? S_23 : st(2)) : st(2);
    if (cv < 1) return lit ? S_34 : st(3);
    if (bu >= len - 1) return lit ? S[2] : st(1);
    if (cv >= 4.5) return lit ? S[2] : st(1);
    return base;
  }
  if (v < 17) {
    // oak joist band
    const jv = v - 12;
    const ji = Math.floor((u + seed * 3) / 34);
    const ju = u + seed * 3 - ji * 34;
    if (ju < 1) return W[0];
    if (jv < 1) return lit ? W[3] : W[2];
    if (jv >= 4) return W[0];
    if (ju > 3 && ju < 5 && jv >= 1.5 && jv < 3) return lit ? W[4] : W[3]; // peg
    if (Math.floor(ju * 0.5 + jv * 3) % 7 === 0) return lit ? W[1] : W[0]; // grain
    return lit ? W[2] : W[1];
  }
  // rough foundation stone
  const rv = v - 17;
  const ri = Math.floor((u + seed * 5) / 9);
  const ru = u + seed * 5 - ri * 9;
  const off = hash(ri, 0, seed + 41) < 0.5 ? 0 : 1;
  if (ru < 1 || rv < 0.5 + off * 0.0) return lit ? PLUM_SH : PLUM_DK;
  if (rv < 1.5) return lit ? S[2] : S[1];
  return lit ? S[1] : PLUM_SH;
}

// ---------------------------------------------------------------- rock keel + roots

/** Screen y of the slab's bottom edge at column x (NaN outside the platform). */
function slabBottom(x: number): number {
  const L = scr(-HA, -HB); // left corner
  const Bt = scr(-HA, HB); // bottom corner
  const R = scr(HA, HB); // right corner
  if (x < L.x || x > R.x) return NaN;
  if (x <= Bt.x) return L.y + (x - L.x) / 2 + SLAB;
  return Bt.y - (x - Bt.x) / 2 + SLAB;
}

const KEEL_D = 30;
const LC = scr(-HA, -HB);
const BC = scr(-HA, HB);
const RC = scr(HA, HB);

/** Stalactite teeth along the keel bottom: x, half width, extra length. */
const TEETH = (() => {
  const out: { x: number; w: number; l: number }[] = [];
  let x = LC.x + 22;
  let k = 0;
  while (x < RC.x - 24) {
    out.push({ x, w: 6 + Math.floor(hash(k, 0, 81) * 7), l: 5 + Math.floor(hash(k, 0, 82) * 12) });
    x += 15 + Math.floor(hash(k, 0, 83) * 13);
    k++;
  }
  return out;
})();

function keelDepth(x: number): number {
  let t: number;
  if (x <= BC.x) t = (x - LC.x) / (BC.x - LC.x);
  else t = (RC.x - x) / (RC.x - BC.x);
  if (t <= 0) return 0;
  let d = KEEL_D * Math.pow(t, 0.8);
  for (const k of TEETH) {
    const u = Math.abs(x + 0.5 - k.x) / k.w;
    if (u < 1) d = Math.max(d, KEEL_D * Math.pow(t, 0.8) + k.l * Math.pow(t, 0.5) * (1 - u) ** 1.4);
  }
  return Math.round(d);
}

/** Facet seeds for the chunky rock (a jittered grid in screen space). */
function facet(x: number, y: number): { id: number; edge: boolean; upper: boolean } {
  const G = 11;
  const gx = Math.floor(x / G);
  const gy = Math.floor(y / G);
  let best = Infinity;
  let second = Infinity;
  let id = 0;
  let by = 0;
  let sy2 = 0;
  for (let j = gy - 1; j <= gy + 1; j++)
    for (let i = gx - 1; i <= gx + 1; i++) {
      const sx = i * G + hash(i, j, 85) * G;
      const sy = j * G + hash(i, j, 86) * G;
      // stretch vertically so chunks read as hanging strata
      const d = Math.hypot((x - sx) * 1.0, (y - sy) * 0.6);
      if (d < best) {
        second = best;
        sy2 = by;
        best = d;
        by = sy;
        id = i * 7919 + j;
      } else if (d < second) {
        second = d;
        sy2 = sy;
      }
    }
  // upper: this pixel belongs to the chunk above the seam (its bottom lip)
  return { id, edge: second - best < 1.4, upper: by < sy2 };
}

function drawKeel(p: PixelCanvas): void {
  for (let x = Math.ceil(LC.x); x < Math.floor(RC.x); x++) {
    const top = Math.floor(slabBottom(x));
    const d = keelDepth(x);
    if (d <= 0) continue;
    const lit = x >= BC.x;
    for (let y = top; y < top + d; y++) {
      const v = (y - top) / d;
      let c: Color;
      if (y === top + d - 1) c = A_RAMPS.cloud[2]; // bounce light from the glowing cloud sea
      else if (y === top + d - 2) c = dith(x, y, 0.5) ? A_RAMPS.cloud[1] : lit ? S[1] : PLUM_SH;
      else if (y < top + 2) c = PLUM_DK; // shadow under the slab
      else {
        const f = facet(x, y);
        const h = hash(f.id, 0, 87);
        if (f.edge) c = f.upper ? PLUM_DK : lit ? S[2] : S[1];
        else if (lit) c = h < 0.3 ? S[2] : h < 0.8 ? S[1] : PLUM_SH;
        else c = h < 0.25 ? S[1] : h < 0.8 ? PLUM_SH : PLUM_DK;
        if (v > 0.7 && !f.edge) c = lit ? (c === S[2] ? S[1] : PLUM_SH) : PLUM_DK;
      }
      p.set(x, y, c);
    }
  }
  // hanging roots from some of the teeth
  TEETH.forEach((k, i) => {
    if (hash(i, 0, 88) > 0.55) return;
    const x = Math.round(k.x + (hash(i, 0, 89) - 0.5) * 4);
    const y0 = Math.floor(slabBottom(x)) + keelDepth(x) - 2;
    // keep the whole root (and a tip flower) 3+ px above the screen bottom, so the impact shake
    // (camera scroll ≤ 2 px) never shows it cut off at the edge of the 640×360 layer
    const len = Math.min(8 + Math.floor(hash(i, 0, 90) * 16), 355 - y0);
    if (len > 3) drawRoot(p, x, y0, len, i + 1);
  });
}

function drawRoot(p: PixelCanvas, x0: number, y0: number, len: number, seed: number): void {
  let x = x0;
  for (let i = 0; i < len; i++) {
    const y = y0 + i;
    if (i > 0 && hash(i, seed, 91) < 0.22) x += hash(i, seed, 92) < 0.5 ? -1 : 1;
    const thin = i > len * 0.55;
    p.set(x, y, i < 2 ? W[0] : thin ? W[1] : W[1]);
    if (!thin) p.set(x + 1, y, W[0]);
    // the odd leaf on the lower half
    if (i > 3 && hash(i, seed, 93) < 0.18) {
      const s = hash(i, seed, 94) < 0.5 ? -1 : 2;
      p.set(x + s, y, L[2]);
      p.set(x + s + (s < 0 ? -1 : 1), y - 1, L[3]);
    }
  }
  if (seed % 3 === 0) {
    // a tiny pink flower at the tip of some roots
    const y = y0 + len;
    p.set(x, y, A_RAMPS.petalPink[2]);
    p.set(x - 1, y, A_RAMPS.petalPink[1]);
    p.set(x + 1, y, A_RAMPS.petalPink[1]);
    p.set(x, y + 1, A_RAMPS.petalPink[1]);
    p.set(x, y - 1, A_RAMPS.gold[3]);
  }
}

// ---------------------------------------------------------------- cracks

/** Hairline cracks drawn in screen space: a short jagged run of grout colour with a lit lip below. */
function cracks(p: PixelCanvas): void {
  for (let j = 0; j < 400; j++) {
    const b = j * PB - 1000 + PB / 2;
    if (b < -HB + RW + 4 || b > HB - RW - 4) continue;
    for (let i = 0; i < 400; i++) {
      const a = i * PA - 1000 - (j & 1) * (PA / 2) + PA / 2;
      if (a < -HA + RW + 4 || a > HA - RW - 4) continue;
      if (inBridge(a, b) || MATS.some((m) => Math.abs(a - m.a) < MAT / 2 + 2 && Math.abs(b - m.b) < MAT / 2 + 2)) continue;
      if (Math.abs(a) < 12) continue; // the divider strip
      if (hash(i, j, 21) > 0.09) continue;
      const c = scr(a, b);
      let x = Math.round(c.x) - 4 + Math.floor(hash(i, j, 22) * 3);
      let y = Math.round(c.y) - 1;
      const len = 5 + Math.floor(hash(i, j, 23) * 5);
      const dir = hash(i, j, 24) < 0.5 ? 1 : -1;
      for (let k = 0; k < len; k++) {
        p.set(x, y, S[1]);
        if (hash(k, i * 31 + j, 25) < 0.6) p.set(x, y + 1, S_34);
        x++;
        if (hash(k, i * 17 + j, 26) < 0.35) y += dir;
      }
    }
  }
}

// ---------------------------------------------------------------- moss

const TUFTS = [
  ['.G.G.', 'gYgGg', '.ddd.'],
  ['..Y..', '.gGg.', 'gGgGd'],
  ['G.Y', 'gGg', 'dd.'],
];

function mossTufts(p: PixelCanvas): void {
  const key: Record<string, Color> = { d: L[1], g: L[2], G: L[3], Y: L[4] };
  for (let j = 0; j < 400; j++) {
    const b = j * PB - 1000;
    if (b < -HB + RW + 3 || b > HB - RW - 3) continue;
    for (let i = 0; i < 400; i++) {
      const a = i * PA - 1000 - (j & 1) * (PA / 2);
      if (a < -HA + RW + 3 || a > HA - RW - 3) continue;
      if (inBridge(a, b)) continue;
      if (Math.abs(a) < 9) continue; // the divider strip has its own moss
      if (MATS.some((m) => Math.abs(a - m.a) < MAT / 2 + 3 && Math.abs(b - m.b) < MAT / 2 + 3)) continue;
      const edge = Math.min(a + HA, HA - a, b + HB, HB - b);
      if (hash(i, j, 9) > (edge < 22 ? 0.3 : 0.06)) continue;
      const s = scr(a, b);
      const t = TUFTS[Math.floor(hash(i, j, 10) * TUFTS.length)];
      p.stamp(t, key, Math.round(s.x) - Math.floor(t[0].length / 2), Math.round(s.y) - t.length + 1);
    }
  }
}

// ---------------------------------------------------------------- wood

/** Top of a rim beam: u along the beam, v across (0..RW). */
function beamTop(u: number, v: number, outerAtHighV: boolean): Color {
  const plank = Math.floor((u + 7) / 38);
  const pu = u + 7 - plank * 38;
  if (pu < 1) return W[1];
  if (pu >= 2 && pu < 3 && (v > 1.5 && v < 2.5)) return W[1]; // nail
  const outer = outerAtHighV ? v >= RW - 1 : v < 1;
  const inner = outerAtHighV ? v < 1 : v >= RW - 1;
  if (outer) return W[4];
  if (inner) return W[2];
  if (Math.floor(pu * 0.7 + v * 5 + plank) % 9 === 0) return W[2]; // grain flecks
  return W[3];
}

/** Vertical face of a beam: u along the beam, v = depth from its top (0..RH). */
function beamFace(u: number, v: number, lit: boolean): Color {
  const plank = Math.floor((u + 7) / 38);
  const pu = u + 7 - plank * 38;
  if (pu < 1) return W[0];
  if (v < 1) return lit ? W[4] : W[3];
  if (v >= RH - 1) return lit ? W[1] : W[0];
  return lit ? W[3] : W[2];
}

function post(p: PixelCanvas, a: number, b: number, h: number, size = 4, cap = true): void {
  const a0 = a - size / 2;
  const b0 = b - size / 2;
  box(p, a0, a0 + size, b0, b0 + size, 0, h, {
    top: (u, v) => (u < 1 || v >= size - 1 ? W[3] : W[4]),
    left: (u, v) => (u < 1 ? W[1] : v < 1 && cap ? W[3] : v > h - 2 ? W[0] : (Math.floor(v) % 9 === 4 ? W[1] : W[2])),
    right: (u, v) => (u >= size - 1 ? W[4] : v < 1 && cap ? W[4] : v > h - 2 ? W[1] : (Math.floor(v) % 9 === 4 ? W[2] : W[3])),
  });
}

/** Rail along a (b fixed) between a0..a1 at height z. */
function railA(p: PixelCanvas, a0: number, a1: number, b: number, z: number): void {
  box(p, a0, a1, b - 1, b + 1, z, z + 3, {
    top: (u, v) => (v >= 1 ? W[4] : W[3]),
    left: () => W[1],
    right: (u, v) => (v < 1 ? W[3] : v >= 2 ? W[1] : W[2]),
  });
}

/** Rail along b (a fixed) between b0..b1 at height z. */
function railB(p: PixelCanvas, a: number, b0: number, b1: number, z: number): void {
  box(p, a - 1, a + 1, b0, b1, z, z + 3, {
    top: (u) => (u < 1 ? W[3] : W[4]),
    left: (u, v) => (v < 1 ? W[3] : v >= 2 ? W[0] : W[2]),
    right: () => W[2],
  });
}

// ---------------------------------------------------------------- flowers

const PW = A_RAMPS.petalWhite;
const PP = A_RAMPS.petalPink;

/** A small leafy clump with flowers, anchored at screen (x, y) = its base centre. */
export function flowerClump(p: PixelCanvas, x: number, y: number, w: number, seed: number, pink = 0.35): void {
  // leaves: a low mound of clusters
  for (let i = -w; i <= w; i++) {
    const hgt = Math.round((1 - (i / (w + 1)) ** 2) * (3 + hash(i, seed, 1) * 3));
    for (let k = 0; k < hgt; k++) {
      const yy = y - k;
      const c = k === hgt - 1 ? L[3] : k === 0 ? L[1] : hash(i, k, seed) < 0.3 ? L[3] : L[2];
      p.set(x + i, yy, c);
    }
  }
  // flowers on top: a few big blossoms, small ones around them
  const n = Math.max(2, Math.round(w * 0.9));
  for (let f = 0; f < n; f++) {
    const fx = x - w + 1 + Math.floor(hash(f, seed, 2) * (2 * w - 1));
    const fy = y - 3 - Math.floor(hash(f, seed, 3) * 4);
    if (f === 0 && w >= 3) bigFlower(p, fx, fy - 1, hash(f, seed, 4) < pink);
    else flower(p, fx, fy, hash(f, seed, 4) < pink);
  }
}

/** 5×5 blossom: lit upper-left petals, shaded lower-right, gold heart. */
export function bigFlower(p: PixelCanvas, x: number, y: number, pink: boolean): void {
  const r = pink ? PP : PW;
  const rows = ['..a..', '.aab.', 'aaCbb', '.bbc.', '..c..'];
  const key: Record<string, Color> = { a: r[2], b: r[1], c: pink ? PP[0] : PW[0], C: A_RAMPS.gold[3] };
  p.stamp(rows, key, x - 2, y - 2);
  if (pink) p.set(x - 1, y - 1, PP[3]);
}

export function flower(p: PixelCanvas, x: number, y: number, pink: boolean): void {
  const r = pink ? PP : PW;
  const lit = pink ? PP[2] : PW[2];
  const mid = pink ? PP[1] : PW[1];
  p.set(x, y - 1, lit);
  p.set(x - 1, y, lit);
  p.set(x + 1, y, mid);
  p.set(x, y + 1, mid);
  p.set(x, y, A_RAMPS.gold[3]);
  void r;
}

/** Vine strand hanging down from (x, y). */
function vine(p: PixelCanvas, x: number, y: number, len: number, seed: number): void {
  let xx = x;
  for (let i = 0; i < len; i++) {
    if (i > 0 && hash(i, seed, 51) < 0.25) xx += hash(i, seed, 52) < 0.5 ? -1 : 1;
    p.set(xx, y + i, L[1]);
    if (hash(i, seed, 53) < 0.4) {
      const s = i % 2 ? -1 : 1;
      p.set(xx + s, y + i, L[2]);
      if (hash(i, seed, 54) < 0.5) p.set(xx + s * 2, y + i - 1, L[3]);
    }
    if (i > 2 && hash(i, seed, 55) < 0.1) flower(p, xx + (i % 2 ? 2 : -2), y + i, hash(i, seed, 56) < 0.5);
  }
}

// ---------------------------------------------------------------- layers

/** Where the back railing posts stand (iso), so props can avoid / reuse them. */
const BACK_LEFT_POSTS = [-84, 54, 96];
const BACK_RIGHT_POSTS = [4, 44];

export function drawPlatform(p: PixelCanvas): void {
  // the slab: floor on top, stone/wood sides
  box(p, -HA, HA, -HB, HB, -SLAB, 0, {
    top: (u, v, x, y) => floorColor(u - HA, v - HB, x, y),
    left: (u, v) => slabFace(u, v, false, 3),
    right: (u, v) => slabFace(u, v, true, 0),
  });
  drawKeel(p);
  cracks(p);
  mossTufts(p);
  hedgeLeaves(p);

  // back rim beams (their inner faces look at the viewer)
  box(p, -HA, HA, -HB, -HB + RW, 0, RH, {
    top: (u, v) => beamTop(u, v, false),
    left: (u, v) => beamFace(u, v, false),
    right: (u, v) => beamFace(u, v, false),
  });
  box(p, HA - RW, HA, -HB, HB, 0, RH, {
    top: (u, v) => beamTop(v, u, true),
    left: (u, v) => beamFace(u, v, false),
    right: (u, v) => beamFace(u, v, true),
  });

  // back railing: low posts + one rail, kept short so it never competes with the monsters.
  // Directly behind both slots (dragon: a -60..54 on the back-left edge, wizard: the top corner
  // and b -88..4 on the back-right edge) there is only the low rim beam, so their silhouettes
  // stay clean against the clouds.
  const bl = -HB + 2.5;
  const br = HA - 2.5;
  railA(p, -HA + 3, -60, bl, 9);
  railA(p, BACK_LEFT_POSTS[1], BACK_LEFT_POSTS[2], bl, 9);
  railB(p, br, BACK_RIGHT_POSTS[0], HB - 3, 9);
  for (const a of BACK_LEFT_POSTS) post(p, a, bl, 13);
  post(p, -60, bl, 11);
  for (const b of BACK_RIGHT_POSTS) post(p, br, b, 13);
  flowerAlongA(p, -112, -94, -HB + RW + 1, 11);
  flowerAlongA(p, 66, 84, -HB + RW + 1, 12);
  flowerAlongB(p, HA - RW - 1, 56, 74, 13);
}

function flowerAlongA(p: PixelCanvas, a0: number, a1: number, b: number, seed: number): void {
  for (let a = a0; a <= a1; a += 6) {
    const s = scr(a, b);
    flowerClump(p, Math.round(s.x), Math.round(s.y), 3, seed * 31 + a, 0.4);
  }
}

function flowerAlongB(p: PixelCanvas, a: number, b0: number, b1: number, seed: number): void {
  for (let b = b0; b <= b1; b += 6) {
    const s = scr(a, b);
    flowerClump(p, Math.round(s.x), Math.round(s.y), 3, seed * 31 + b, 0.4);
  }
}

/** Corner + front prop anchors (iso), shared with the lantern sprites. */
export const CORNER_POST_H = 26;
export const PEDESTAL_H = 9;
export const ANCHORS = {
  leftCorner: { a: -HA + 2.5, b: -HB + 2.5 },
  rightCorner: { a: HA - 2.5, b: HB - 2.5 },
  bottomCorner: { a: -HA + 5, b: HB - 5 },
};

export function drawFront(p: PixelCanvas): void {
  // front rim beams (outer faces continue the slab sides upward)
  box(p, -HA, -HA + RW, -HB, HB, 0, RH, {
    top: (u, v) => beamTop(v, u, false),
    left: (u, v) => beamFace(u, v, false),
    right: (u, v) => beamFace(u, v, true),
  });
  box(p, -HA, HA, HB - RW, HB, 0, RH, {
    top: (u, v) => beamTop(u, v, true),
    left: (u, v) => beamFace(u, v, false),
    right: (u, v) => beamFace(u, v, true),
  });

  // short front posts (bunting hangs between them)
  for (const a of FRONT_POSTS) post(p, a, HB - 2.5, 8);
  // tall corner posts carrying lanterns
  post(p, ANCHORS.leftCorner.a, ANCHORS.leftCorner.b, CORNER_POST_H, 5);
  post(p, ANCHORS.rightCorner.a, ANCHORS.rightCorner.b, CORNER_POST_H, 5);
  // stone pedestal of the big front lantern
  pedestal(p, ANCHORS.bottomCorner.a, ANCHORS.bottomCorner.b);

  // flowers and vines spilling over the front edge
  for (const c of FRONT_FLOWERS) {
    const s = scr(c.a, HB - 2, RH);
    const x = Math.round(s.x);
    const y = Math.round(s.y);
    for (let i = -c.w; i <= c.w; i += 2) {
      const vs = scr(c.a + i, HB, 0);
      if (hash(i, c.seed, 61) < 0.6) vine(p, Math.round(vs.x), Math.round(vs.y) + 1, 5 + Math.floor(hash(i, c.seed, 62) * 9), c.seed * 7 + i);
    }
    for (let i = -c.w; i <= c.w; i += 4) {
      const fs = scr(c.a + i, HB - 2, RH);
      flowerClump(p, Math.round(fs.x), Math.round(fs.y), 3, c.seed * 13 + i, c.pink);
    }
    void x;
    void y;
  }
  // left (shaded) edge gets one clump too
  {
    const s = scr(-HA + 2, 44, RH);
    flowerClump(p, Math.round(s.x), Math.round(s.y), 3, 777, 0.2);
    for (let i = -6; i <= 6; i += 3) {
      const vs = scr(-HA, 44 + i, 0);
      vine(p, Math.round(vs.x), Math.round(vs.y) + 1, 6 + Math.floor(hash(i, 5, 63) * 8), 900 + i);
    }
  }
}

export const FRONT_POSTS = [-40, 44];
const FRONT_FLOWERS = [
  { a: -92, w: 8, seed: 1, pink: 0.25 },
  { a: 2, w: 10, seed: 2, pink: 0.5 },
  { a: 92, w: 7, seed: 3, pink: 0.6 },
];

function pedestal(p: PixelCanvas, a: number, b: number): void {
  const s = 10;
  box(p, a - s / 2, a + s / 2, b - s / 2, b + s / 2, 0, PEDESTAL_H, {
    top: (u, v) => (u < 1 || v >= s - 1 ? S[3] : S[4]),
    left: (u, v) => (v < 1 ? S[3] : u < 1 ? PLUM_SH : Math.floor(v) === 4 ? PLUM_SH : S[1]),
    right: (u, v) => (v < 1 ? S[4] : u >= s - 1 ? S[3] : Math.floor(v) === 4 ? S[1] : S[2]),
  });
}

/** Screen points other modules need. */
export function anchorScreen(name: keyof typeof ANCHORS, z = 0): XY {
  const q = ANCHORS[name];
  return scr(q.a, q.b, z);
}

/** Outline helper: dark warm 1-px line above every opaque pixel whose upper neighbour is empty. */
export function topOutline(p: PixelCanvas, c: Color = A_INK.warm): void {
  const add: number[] = [];
  for (let y = 1; y < p.h; y++)
    for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y) && !p.isOpaque(x, y - 1)) add.push(x, y - 1);
  for (let i = 0; i < add.length; i += 2) p.set(add[i], add[i + 1], c);
}

export { isoAt, OX, OY };
