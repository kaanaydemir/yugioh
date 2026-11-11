// Neon Tower painter: STAGE TOP v5 — arena v5 step 1 (docs/v3/ref/hedef-gorunum-5.png). BOARD_V4 only.
//
// The flat charcoal slab becomes a floor of large worn flagstones laid in courses along the lane axis (iso 2:1 mortar lines),
// a path of smaller, darker pavers down the neutral lane between the two monster rows, an engraved (not glowing) round emblem
// in the middle of that lane, and a thick carved coping round the top edge with the gold inlay on its outer lip.
//
// Value structure: the stage veil (view/board-nt/glow.ts, MULTIPLY ≈ 0.56) darkens all of this afterwards, so the painter
// keeps the stage's MEAN where it was (mostly stone1 flags, the key-lit back-left a stone2 band) and puts the texture into
// thin edges: stone0 mortar, a lit stone2/3 lip on each flag's key-lit upper-left edge, a stone0/1 shade on its lower-right
// edge, a few dark flags, chips, hairline cracks, moss (leaf0/1) in a couple of them, faint scratches. Low contrast: the units
// stay the brightest things. Colours only from src/art/palette.ts; pure PixelCanvas-side code (no Phaser), deterministic.
//
// Geometry: (u, v) are layout.ts' arena v4 board units about the centre (320, 160): x = 320 + u − v, y = 160 + (u + v) / 2.
// One zone tile = 32 × 32 units. Monster rows v = ±36 (±16), back rows ±72, the neutral lane |v| < 20.

import { PAL } from '../palette';
import type { Color } from '../pixel';

const ST = [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4] as const;

/** Board units of a screen pixel's centre. */
export function uvAt(x: number, y: number): { u: number; v: number } {
  const dx = x + 0.5 - 320;
  const dy = 2 * (y + 0.5 - 160);
  return { u: (dx + dy) / 2, v: (dy - dx) / 2 };
}

const hash = (n: number): number => {
  let h = (n * 374761393 + 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const hash2 = (a: number, b: number): number => hash(a * 7919 + b * 104729 + 17);

// ---------------------------------------------------------------- layout of the stones

/** Half width of the neutral lane (v), its kerb band inside it, the emblem radii. */
export const LANE_V = 20;
const KERB_V = 15.5;
export const EMBLEM_R = 30;

interface Course {
  v0: number;
  v1: number;
  /** cut positions along u (sorted), the stones are [cuts[i], cuts[i+1]) */
  cuts: number[];
  lane: boolean;
}

function makeCourses(): Course[] {
  const out: Course[] = [];
  const cutsFor = (seed: number, minL: number, maxL: number): number[] => {
    const cuts: number[] = [];
    let u = -220 + hash(seed) * maxL;
    let k = 0;
    while (u < 220) {
      cuts.push(u);
      u += minL + Math.floor(hash2(seed, k++) * (maxL - minL + 1));
    }
    cuts.push(u);
    return cuts;
  };
  // the main field: courses of 12..20 units outward from the lane, mirrored seeds differ so the halves are not copies
  for (const sgn of [1, -1]) {
    let v = LANE_V;
    let k = 0;
    while (v < 150) {
      const w = [18, 12, 22, 14, 16, 20, 11, 17, 24, 13][(k + (sgn > 0 ? 0 : 4)) % 10];
      const a = v;
      const b = v + w;
      out.push({ v0: sgn > 0 ? a : -b, v1: sgn > 0 ? b : -a, cuts: cutsFor(1000 + k * 31 + (sgn > 0 ? 0 : 517), 14, 44), lane: false });
      v = b;
      k++;
    }
  }
  // the lane: a long kerb course on each side, three courses of small pavers between
  out.push({ v0: KERB_V, v1: LANE_V, cuts: cutsFor(77, 26, 40), lane: true });
  out.push({ v0: -LANE_V, v1: -KERB_V, cuts: cutsFor(78, 26, 40), lane: true });
  // three courses of unequal width (9 / 13 / 9), pavers 8..17 long: cobble-like, not a tile grid
  const edges = [-KERB_V, -KERB_V + 9, KERB_V - 9, KERB_V];
  for (let i = 0; i < 3; i++) out.push({ v0: edges[i], v1: edges[i + 1], cuts: cutsFor(300 + i * 13, 8, 17), lane: true });
  return out;
}

let COURSES: Course[] | null = null;

interface StoneHit {
  id: number;
  /** distances (units) to the stone's four edges: u0 (upper-left), v0 (upper-right), u1 (lower-right), v1 (lower-left) */
  du0: number;
  dv0: number;
  du1: number;
  dv1: number;
  lane: boolean;
  kerb: boolean;
  /** the stone's base tone index into the stone ramp */
  base: number;
  seed: number;
}

/** -1: the emblem disc. */
function stoneAt(u: number, v: number): StoneHit {
  if (u * u + v * v < EMBLEM_R * EMBLEM_R) return { id: -1, du0: 9, dv0: 9, du1: 9, dv1: 9, lane: true, kerb: false, base: 1, seed: 0 };
  const cs = (COURSES ??= makeCourses());
  let ci = 0;
  while (ci < cs.length - 1 && !(v >= cs[ci].v0 && v < cs[ci].v1)) ci++;
  const c = cs[ci];
  let si = 0;
  while (si < c.cuts.length - 2 && u >= c.cuts[si + 1]) si++;
  let u0 = c.cuts[si];
  let u1 = c.cuts[si + 1];
  let v0 = c.v0;
  let v1 = c.v1;
  let id = ci * 1000 + si;
  let seed = hash2(ci + 11, si + 3);
  // some big flags are split across the course into two smaller stones, the upper one of those split again along u on some
  // (breaks the regular course rhythm into the target's irregular paving)
  if (!c.lane && seed < 0.32 && v1 - v0 >= 14) {
    const mid = v0 + Math.round((v1 - v0) * (0.4 + 0.2 * hash(id + 3)));
    if (v >= mid) {
      v0 = mid;
      id += 500;
    } else {
      v1 = mid;
      if (hash(id + 6) < 0.6) {
        const cut = Math.round(u0 + (u1 - u0) * (0.35 + 0.3 * hash(id + 4)));
        if (u >= cut) {
          u0 = cut;
          id += 250;
        } else u1 = cut;
      }
    }
    seed = hash(id * 3 + 1);
  }
  const kerb = c.lane && Math.abs(c.v0 + c.v1) > 2 * KERB_V;
  // tone bands: the lane is the darker inlay (stone1, one paver in six a stone0 inset), the kerb a long lighter stone; the main
  // field mixes stone1 / stone2 flags, the key-lit back-left mostly stone2 (the light falloff the target has: lighter upper
  // left), the lower right mostly stone1, a few dark stone0 flags and a few violet-grey ones (base 5: void1)
  let base: number;
  if (kerb) base = 2;
  else if (c.lane) base = seed < 0.3 ? 0 : seed > 0.9 ? 2 : 1;
  else {
    const cu = (u0 + u1) / 2;
    const cv = (v0 + v1) / 2;
    // screen x + 2y of the stone's centre (the old KEY_BAND line, x + 2y < 722): the back-left half of the stage is key-lit
    const k = 320 + cu - cv + 2 * (160 + (cu + cv) / 2);
    const lit = k + (seed - 0.5) * 160 < 722;
    base = seed < 0.09 ? 0 : seed > 0.93 ? 5 : lit ? (seed > 0.8 ? 1 : 2) : seed > 0.74 ? 2 : 1;
  }
  return { id, du0: u - u0, dv0: v - v0, du1: u1 - u, dv1: v1 - v, lane: c.lane, kerb, base, seed };
}

// ---------------------------------------------------------------- the emblem (engraved, original: a compass rose in two rings)

/**
 * Emblem regions at a point: 0 outside, 1 a notch (groove) in the outer band, 2 the raised outer band, 3 / 7 the raised eight-point
 * star's lit / shaded facet, 4 the sunken inner field, 5 the sunken ring between band and inner ring line, 6 the centre boss, 8 the
 * inner ring line (a groove).
 */
function emblemRegion(u: number, v: number): number {
  const r = Math.hypot(u, v);
  const a = Math.atan2(v, u);
  if (r >= EMBLEM_R) return 0;
  // the outer band 25..30 with 16 carved notches
  if (r >= 25) return ((a / (Math.PI * 2)) * 16 + 16.25) % 1 < 0.14 ? 1 : 2;
  if (r >= 21.5) return 5;
  if (r >= 20.5) return 8;
  if (r < 3.6) return 6;
  // an eight-point star: the long points on the board axes (±u, ±v), the short ones on the diagonals; each point split along its
  // ray into a lit facet (the side toward the key light, −u −v) and a shaded one
  const step = Math.PI / 4;
  const k = Math.round(a / step);
  const off = a - k * step; // angle from the nearest ray
  const axis = ((k % 2) + 2) % 2 === 0;
  const reach = axis ? 19.5 : 13.5;
  const halfW = (axis ? 0.52 : 0.46) * (1 - r / reach);
  if (r < reach && Math.abs(off) < halfW + 0.07) {
    const ray = k * step;
    // the facet whose outward normal points toward the light (from −u −v, i.e. angle −135°) is lit
    const normal = ray + (off > 0 ? Math.PI / 2 : -Math.PI / 2);
    return Math.cos(normal + Math.PI * 0.75) > 0 ? 3 : 7;
  }
  return 4;
}

// ---------------------------------------------------------------- per pixel

/** A deterministic hairline crack set: polylines in board units (generated once). */
interface Crack {
  pts: { u: number; v: number }[];
  moss: boolean;
}
let CRACKS: Crack[] | null = null;
function cracks(): Crack[] {
  if (CRACKS) return CRACKS;
  const out: Crack[] = [];
  for (let i = 0; i < 56; i++) {
    let u = -140 + hash2(i, 1) * 280;
    let v = -128 + hash2(i, 2) * 256;
    if (Math.abs(v) < LANE_V + 2 && Math.abs(u) < EMBLEM_R + 6) v += v < 0 ? -40 : 40;
    let dir = hash2(i, 3) * Math.PI * 2;
    const n = 4 + Math.floor(hash2(i, 4) * 6);
    const pts = [{ u, v }];
    for (let k = 0; k < n; k++) {
      dir += (hash2(i, 10 + k) - 0.5) * 1.3;
      const step = 2.5 + hash2(i, 30 + k) * 3;
      u += Math.cos(dir) * step;
      v += Math.sin(dir) * step;
      pts.push({ u, v });
    }
    out.push({ pts, moss: i % 9 === 4 || i % 13 === 7 });
  }
  return (CRACKS = out);
}

/** Distance (units) from a point to the nearest crack, and whether that crack is mossy. */
function crackDist(u: number, v: number): { d: number; moss: boolean } {
  let best = 99;
  let moss = false;
  for (const c of cracks()) {
    const p0 = c.pts[0];
    if (Math.abs(u - p0.u) > 30 || Math.abs(v - p0.v) > 30) continue;
    for (let k = 0; k + 1 < c.pts.length; k++) {
      const a = c.pts[k];
      const b = c.pts[k + 1];
      const ex = b.u - a.u;
      const ey = b.v - a.v;
      const t = Math.max(0, Math.min(1, ((u - a.u) * ex + (v - a.v) * ey) / (ex * ex + ey * ey)));
      const d = Math.hypot(u - a.u - ex * t, v - a.v - ey * t);
      if (d < best) {
        best = d;
        moss = c.moss;
      }
    }
  }
  return { d: best, moss };
}

const VIO = [PAL.void0, PAL.void1, PAL.stone2] as const;
/** Stone ramp tone `i` (0..3); 4..6 = the violet-grey flag's tones (void0 shade, void1 face, stone2 lit lip). */
const tone = (i: number): Color => (i >= 4 && i <= 6 ? VIO[i - 4] : ST[Math.max(0, Math.min(3, i))]);

/**
 * The stage-top colour of screen pixel (x, y) that is `d32` units inside the plate edge on edge `side` (plateDepth's side index:
 * 0 upper-left, 1 lower-right, 2 upper-right, 3 lower-left, 4 far flat, 5 near flat, 6 left cap, 7 right cap), and the stone's
 * id (for the mortar test against the pixel below). Rim pixels are painted by `rimTone`.
 */
export function floorTone(x: number, y: number): Color {
  const { u, v } = uvAt(x, y);
  const s = stoneAt(u, v);
  const below = uvAt(x, y + 1);
  const sb = stoneAt(below.u, below.v);
  const above = uvAt(x, y - 1);
  const sa = stoneAt(above.u, above.v);
  // ---- the emblem disc
  if (s.id === -1) return emblemTone(x, y, u, v, sb.id !== -1, sa.id !== -1);
  // ---- mortar: the last pixel row of a stone in its column (1 px, clean 2:1 stairs for both line families)
  if (sb.id !== s.id) {
    // moss creeps out of a few joints (low, green-grey)
    const m = hash2(Math.floor(u / 5), Math.floor(v / 5) + 400);
    if (!s.lane && m < 0.025) return PAL.leaf1;
    if (!s.lane && m < 0.05) return PAL.leaf0;
    return sb.id === -1 || !s.lane ? PAL.ink : PAL.stone0;
  }
  let t = s.base;
  // worn per-stone mottling: one or two large blotches per flag, a tone darker on the lighter flags and a tone lighter on some
  // of the darker ones (hard pixel edges, large shapes, never single-pixel noise)
  const bu = s.du0 + s.du1;
  const bv = s.dv0 + s.dv1;
  if (!s.kerb) {
    for (let b = 0; b < (s.lane ? 1 : 2); b++) {
      const h = hash(s.id * 5 + b * 97 + 13);
      if (h < (s.lane ? 0.6 : 0.25)) continue;
      const cx = (0.2 + 0.6 * hash(s.id + 5 + b * 31)) * bu;
      const cy = (0.2 + 0.6 * hash(s.id + 9 + b * 37)) * bv;
      const rx = bu * (0.16 + 0.18 * hash(s.id + 41 + b));
      const ry = bv * (0.2 + 0.18 * hash(s.id + 43 + b));
      // a lumpy outline: the radius wobbles with the angle
      const ang = Math.atan2(s.dv0 - cy, s.du0 - cx);
      const wob = 1 + 0.22 * Math.sin(ang * 3 + h * 9) + 0.12 * Math.sin(ang * 5 + h * 4);
      const e = ((s.du0 - cx) / rx) ** 2 + ((s.dv0 - cy) / ry) ** 2;
      if (e < wob * wob) {
        if (s.base === 2 || s.base === 5) t -= 1;
        else if (s.base === 1) t += h > 0.72 ? 1 : -1;
        else if (s.base === 0 && h > 0.7) t += 1;
        break;
      }
    }
  }
  // ---- edges: the top row of a stone (pixel above is another stone) — its key-lit upper-left edge a lit lip in worn stretches;
  // the row above the mortar on the lower-right edge in shade
  const top = sa.id !== s.id;
  if (top) {
    const leftEdge = s.du0 <= s.dv0;
    const along = leftEdge ? s.dv0 : s.du0;
    const worn = s.kerb || hash2(s.id, Math.floor(along / 6)) < (leftEdge ? 0.55 : 0.18);
    if (worn) return tone(s.base + 1);
    return tone(t);
  }
  const b2 = uvAt(x, y + 2);
  if (stoneAt(b2.u, b2.v).id !== s.id && s.du1 < s.dv1 && !s.kerb) t -= 1;
  // ---- chips: a corner of a few flags knocked off (dark pit with a lit lower edge)
  if (!s.lane && s.seed > 0.7) {
    const cu = hash(s.id + 21) < 0.5 ? s.du0 : s.du1;
    const cv = hash(s.id + 23) < 0.5 ? s.dv0 : s.dv1;
    const r = cu + cv;
    if (r < 3.2) return PAL.stone0;
    if (r < 4.2 && cu > cv) return tone(s.base + 1);
  }
  // ---- hairline cracks (+ moss in a couple of them) and faint scratches
  if (!s.kerb) {
    const c = crackDist(u, v);
    if (c.d < 0.62) return c.moss && hash2(Math.floor(u), Math.floor(v)) < 0.55 ? PAL.leaf1 : s.base >= 4 ? PAL.void0 : tone(Math.min(t, s.base) - 1);
    // the crack's lower lip catches the light (carved, not drawn)
    const cb = crackDist(above.u, above.v);
    if (cb.d < 0.62 && !c.moss) return tone(s.base + 1);
    if (c.moss && c.d < 1.4 && hash2(Math.floor(u * 1.5), Math.floor(v * 1.5)) < 0.45) return PAL.leaf0;
  }
  if (!s.lane && hash(s.id + 77) < 0.3) {
    // one short scratch per scratched flag: a 1-px line along u, a tone lighter
    const su = (0.2 + 0.5 * hash(s.id + 78)) * bu;
    const sv = (0.3 + 0.4 * hash(s.id + 79)) * bv;
    if (Math.abs(s.dv0 - sv - (s.du0 - su) * 0.25) < 0.45 && s.du0 > su && s.du0 < su + 7) return tone(s.base + 1);
  }
  return tone(t);
}

function emblemTone(x: number, y: number, u: number, v: number, lastRow: boolean, firstRow: boolean): Color {
  // the disc is a carved roundel set into the lane: a raised outer band with notches, a sunken ring, a groove, a sunken inner field
  // with a raised faceted eight-point star and a centre boss. Grooves (1 px, ink / stone0) where the carving steps down, a lit lip
  // where a raised part's upper edge catches the key light. Faint: no tone above stone3, which the veil darkens.
  if (lastRow) return PAL.ink;
  if (firstRow) return PAL.stone2;
  const reg = emblemRegion(u, v);
  const raised = (q: number): boolean => q === 2 || q === 3 || q === 7 || q === 6;
  const same = (p: number, q: number): boolean => p === q || ((p === 3 || p === 7) && (q === 3 || q === 7));
  const at = (dy: number): number => {
    const q = uvAt(x, y + dy);
    return emblemRegion(q.u, q.v);
  };
  const down = at(1);
  const up = at(-1);
  if (reg === 1 || reg === 8) return PAL.stone0;
  // the step down from a raised part (its lower edge) is a groove; a raised part's top edge a lit lip
  if (raised(reg) && !same(down, reg) && !raised(down)) return PAL.stone0;
  if (raised(reg) && !same(up, reg) && !raised(up)) return PAL.stone3;
  if (!raised(reg) && raised(up) && !same(up, reg)) return PAL.ink; // the shadow a raised part throws on the sunken field
  switch (reg) {
    case 2:
      return PAL.stone2;
    case 3:
      return PAL.stone2;
    case 7:
      return PAL.stone0;
    case 6:
      return Math.hypot(u, v) < 1.2 ? PAL.stone0 : PAL.stone2;
    case 5:
      return PAL.stone1;
    default:
      return PAL.stone1;
  }
}

// ---------------------------------------------------------------- the carved coping (rim)

/** Width of the coping band (units from the plate edge). */
export const RIM_W = 11;

/**
 * The coping round the top edge at `d` units inside edge `side` (see floorTone), `along` the edge's running coordinate (units),
 * `lit` the key-lit edges (upper-left, upper-right, far flat, left cap). Outer lip gold inlay (the old gold top edge), a coping
 * course of long blocks (joints every ~22 units, per block tone, a lit inner bevel on the lit edges), then the step down to the
 * floor: on the FAR edges the coping's inner face shows (a 2-px shaded face), on the NEAR edges a lit inner lip.
 */
export function rimTone(d: number, side: number, along: number, x: number): Color | null {
  const lit = side === 0 || side === 2 || side === 4 || side === 6;
  const far = side === 0 || side === 2 || side === 4 || side === 6 || side === 7;
  if (d < 1) return lit && x % 6 === 0 ? PAL.gold3 : lit || side === 3 || side === 5 ? PAL.gold2 : PAL.gold1;
  if (d < 2) return lit ? PAL.gold1 : PAL.earth1;
  const blk = Math.floor((along + 400) / 22);
  const ja = (((along + 400) % 22) + 22) % 22;
  const bt = hash(blk * 13 + side * 101);
  const face = lit ? (bt < 0.22 ? 1 : 2) : bt < 0.3 ? 2 : 1;
  if (d < RIM_W - 2) {
    // block joints (ink) with a lit lip on the joint's left side
    if (ja < 1) return PAL.ink;
    if (ja < 2) return tone(face + 1);
    // the block's FAR top edge catches the light: the outer bevel on the far edges, the inner one on the near edges
    if (far ? d < 3 : d >= RIM_W - 3) return tone(face + 1);
    if (far ? d >= RIM_W - 3 : d < 3) return tone(face - 1);
    // a worn chip here and there on the block, moss in an odd joint
    if (bt > 0.72 && Math.abs(ja - 11 - (bt - 0.72) * 30) < 2.2 && d < 5.5) return d < 4 ? PAL.stone0 : tone(face - 1);
    if (bt < 0.08 && ja < 3.5 && d > 4) return PAL.leaf0;
    return tone(face);
  }
  // the step down to the floor: far edges show the coping's shaded inner face, near edges a lit lip and the drop
  if (far) return d < RIM_W - 1 ? PAL.stone0 : PAL.ink;
  return d < RIM_W - 1 ? PAL.stone3 : PAL.ink;
}
