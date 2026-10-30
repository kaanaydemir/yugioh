// Sol Kol Mührü v3 — the rig of the "reaching palm": a severed obsidian left arm that floats 14 px above the floor, a diagonal
// wedge from a snapped elbow (lower left, leaking seal light) up to an OPEN hand at the upper right. The forearm is three loose
// slabs strung on a dark core bar (so they can drift apart and let the light through), a bronze cuff closes the wrist with a
// broken chain dangling from it, the palm slab carries the 9 × 9 glyph disc (the seal) and five long fingers of three plates
// each fan from it. Painted back to front: core bar, back fingers, forearm slabs, palm, cuff, chain, thumb; then the 1-px ink
// outline; then the light layer (glyph, veins, hot cores, spill, rings, motes) which is never outlined (IŞ-9).
//
// Frame 100 × 80, anchor (38, 70), hover 14. Everything that moves is a Pose field (seal_arm_l-anims.ts keys them): the arm never
// moves as a whole sprite — the stump, the wrist, the hand angle and every finger joint are re-posed, the slabs follow with
// their own lags, and every plate is shaded afresh from its own edges (so P2 is a true relight).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { lightOf, type Light } from '../rigkit';
import type { DrawOpts } from '../types';
import { HAND_REST, INDEX, MIDDLE, NF, PINKY, RING, THUMB, handGeom, paintCuff, paintFinger, paintPalm, paintThenar, tipBead, type HandG, type HandPose } from './seal_arm_l-hand';
import { BRONZE, Comp, DEG, DISC9, GLYPH_ARM_L, MAG, OBS, SOCK7, bands, bar, fill, layer, rnd, stampBits, type Pt } from './seal_arm_l-kit';

export const W = 100;
export const H = 80;
/** Floor point under the arm (the game's shadow sits here); the arm floats HOVER px above it. */
export const AX = 38;
export const AY = 70;
export const HOVER = 14;

/** Rest geometry. */
export const S0: Pt = [17, 53];
export const W0: Pt = [41, 42];
export const HA0 = -38;

export interface Chip {
  x: number;
  y: number;
  /** 0 = 2×2, 1 = 3×2, 2 = 3×3 */
  k: number;
}

export interface Pose {
  /** stump centre (the snapped elbow) */
  sx: number;
  sy: number;
  /** wrist centre */
  wx: number;
  wy: number;
  /** hand axis angle in deg (rest −38) */
  ha: number;
  hand: HandPose;
  /** extra gap (px) between the forearm slabs A|B and B|C, and sideways flutter of the three slabs (px, + = down-right) */
  gap: readonly [number, number];
  flut: readonly [number, number, number];
  /** chain: swing angle of the lowest link (deg from straight down) and phase offset of the wave along it (0..1) */
  sw: number;
  swT: number;
  /** chain length in links (0 hides the chain, 4 = full) */
  links: number;
  /** palm glyph level 0 dark … 4 blazing; veins 0..3; pulse front distance from the disc in px (−1 = no travelling pulse) */
  glow: number;
  veins: number;
  pulse: number;
  /** extra fingertip bead levels (−1 = from the pulse), spill of the glyph light onto the stone 0..2 */
  tips: readonly number[];
  spill: number;
  /** elbow seam 0 dark … 3 blazing and its jag variant */
  seam: number;
  /** floor diamond brightness 0 none … 3 */
  floor: number;
  /** halo rings round the palm: radii (px) with tone 1..3 */
  rings: readonly (readonly [number, number])[];
  /** single hot pixels (void4) and seal motes ([x, y, tone 1..3]) */
  sparks: readonly Pt[];
  motes: readonly (readonly [number, number, number])[];
  /** stone chips in the air */
  chips: readonly Chip[];
  /** summon discs: how many of the five (0..5) and their rotation step (0..4) */
  pent: number;
  pentR: number;
  pentRot: number;
  /** a "fist of light" at the palm (summon / death): 0 none … 3 */
  lightFist: number;
  /** negative-band flash on the plates (hitMagic) 0..2; glint 0..3 (a single stone4 cross pixel over 3 beats) */
  flash: number;
  glint: number;
  /** cracks across the cuff / palm / forearm (hitHeavy, death) 0..3 */
  crack: number;
  /** body build-up 0..1 (summon: parts that are not yet there are skipped), 1 = all */
  build: number;
  /** wipe: forearm rows past this fraction of the axis are hidden (death erosion) 0 none */
  erode: number;
  /** drawing offset of the whole frame in px (death fall / bounce). NOT a sprite move: the rig is redrawn there. */
  dy: number;
}

export const POSE0: Pose = {
  sx: S0[0],
  sy: S0[1],
  wx: W0[0],
  wy: W0[1],
  ha: HA0,
  hand: HAND_REST,
  gap: [0, 0],
  flut: [0, 0, 0],
  sw: 0,
  swT: 0,
  links: 4,
  glow: 2,
  veins: 1,
  pulse: -1,
  tips: [-1, -1, -1, -1, -1],
  spill: 1,
  seam: 1,
  floor: 1,
  rings: [],
  sparks: [],
  motes: [],
  chips: [],
  pent: 0,
  pentR: 0,
  pentRot: 0,
  lightFist: 0,
  flash: 0,
  glint: 0,
  crack: 0,
  build: 1,
  erode: 0,
  dy: 0,
};

export function pose(o: Partial<Pose>): Pose {
  return { ...POSE0, ...o };
}

// part ids (for the rim / light passes)
const P_CORE = 1;
const P_FOREARM = 2;
const P_PALM = 3;
const P_FINGER = 4;
const P_CUFF = 5;
const P_CHAIN = 6;
const P_THUMB = 7;
const P_CHIP = 8;

/** Forearm geometry of a pose: origin S, unit u (S → wrist), v (+ = underside, clockwise on screen), length. */
export interface ForeG {
  s: Pt;
  w: Pt;
  u: Pt;
  v: Pt;
  len: number;
  ang: number;
}
export function foreGeom(p: Pose): ForeG {
  const dx = p.wx - p.sx;
  const dy = p.wy - p.sy;
  const len = Math.hypot(dx, dy) || 1;
  const u: Pt = [dx / len, dy / len];
  return { s: [p.sx, p.sy], w: [p.wx, p.wy], u, v: [-u[1], u[0]], len, ang: Math.atan2(dy, dx) / DEG };
}
const loc = (f: ForeG, a: number, b: number): Pt => [f.s[0] + f.u[0] * a + f.v[0] * b, f.s[1] + f.v[1] * b + f.u[1] * a];

/** Polygon of one forearm slab in the forearm frame (u from `a` to `b`, half widths ha / hb, parting-line shear). */
function slab(f: ForeG, a: number, b: number, ha: number, hb: number, shL: number, shR: number, dv: number): Pt[] {
  return [loc(f, a - shL, -ha + dv), loc(f, b - shR, -hb + dv), loc(f, b + shR, hb + dv), loc(f, a + shL, ha + dv)];
}

/** The snapped end of the first slab: ragged spikes toward the lower left (local forearm frame, u negative = past the stump). */
const JAG: readonly Pt[] = [
  [1.6, -6.4],
  [-0.8, -5.2],
  [0.4, -3.4],
  [-3.8, -2.6],
  [-1.4, -0.7],
  [-5.4, 1.4],
  [-2.2, 3.1],
  [-3.9, 5.0],
  [0.6, 5.7],
  [2.0, 6.7],
];
/** The seam that follows the break 1.7 px inside the plate. */
const SEAM: readonly Pt[] = [
  [2.6, -5.1],
  [1.3, -3.5],
  [-1.7, -2.0],
  [0.4, -0.2],
  [-2.8, 1.3],
  [0.1, 2.7],
  [-1.5, 4.2],
  [2.1, 4.8],
];

function paintForearm(c: Comp, p: Pose, f: ForeG, light: Light): void {
  const { w } = c.p;
  const h = c.p.h;
  const len = f.len;
  // slabs hang from the wrist end: C 9.6 long, B 8.6, A the rest (with the jag)
  const cEnd = len - 0.4;
  const cStart = cEnd - 9.2;
  const bEnd = cStart - p.gap[1];
  const bStart = bEnd - 8.4;
  const aEnd = bStart - p.gap[0];
  const aStart = 0;
  // 0 core bar behind: dark violet with a mag line, only seen where the slabs part
  {
    const q = layer(w, h);
    bar(q, loc(f, 2, 0), loc(f, len - 3, 0), 5.2, 4.4, PAL.void0);
    c.add(q, P_CORE);
    if (p.gap[0] + p.gap[1] > 0.4) {
      const a = loc(f, aEnd - 1, 0);
      const b = loc(f, cStart + 1, 0);
      const t = layer(w, h);
      t.line(rnd(a[0]), rnd(a[1]), rnd(b[0]), rnd(b[1]), MAG[2]);
      c.add(t, P_CORE);
    }
  }
  const cracked = (q: PixelCanvas) => {
    if (p.crack > 0) {
      // a split across the slab: a void0 line with a mag1 bleed on its shadow side
      const m = q.bounds();
      if (m) {
        const cx = m.x + (m.w >> 1);
        const cy = m.y + (m.h >> 1);
        q.line(cx - 2, cy - 3, cx + 1, cy + 1, OBS.D);
        if (p.crack > 1) q.line(cx + 1, cy + 1, cx + 3, cy + 4, OBS.D);
      }
    }
  };
  // C (wrist slab), B, A (with the snapped end) — each shaded from its own edges
  const mk = (pts: Pt[], edge: number, crack: boolean) => {
    const q = layer(w, h);
    fill(q, pts, OBS.M);
    bands(q, OBS, light, 3, 2, { top: 2, bottom: 2, edge });
    if (crack) cracked(q);
    c.add(q, P_FOREARM, { out: OBS.D });
  };
  const fl = p.flut;
  mk(slab(f, cStart, cEnd, 5.0, 4.9, 0.8, -0.6, fl[2]), 0, p.crack > 1);
  mk(slab(f, bStart, bEnd, 5.5, 5.1, 1.0, 0.6, fl[1]), 3, p.crack > 2);
  // A: the ragged end replaces its left edge
  {
    const q = layer(w, h);
    const pts: Pt[] = [];
    for (const [a, b] of JAG) pts.push(loc(f, a, b + fl[0]));
    // close along the right (parting) edge of A
    pts.push(loc(f, aEnd + 0.9, 6.6 + fl[0]));
    pts.push(loc(f, aEnd - 0.9, -6.4 + fl[0]));
    fill(q, pts, OBS.M);
    bands(q, OBS, light, 3, 2, { top: 2, bottom: 2, edge: 4 });
    if (p.crack > 0) cracked(q);
    c.add(q, P_FOREARM, { out: OBS.D });
  }
  void aStart;
}

/** The seam of light along the snapped end (light layer, only on the first slab's pixels). */
function paintSeam(c: Comp, p: Pose, f: ForeG): void {
  if (p.seam <= 0) return;
  const tone = [PAL.mag1, PAL.mag1, PAL.mag2, PAL.mag3][Math.min(3, p.seam)];
  const fl = p.flut[0];
  for (let i = 0; i + 1 < SEAM.length; i++) {
    const a = loc(f, SEAM[i][0], SEAM[i][1] + fl);
    const b = loc(f, SEAM[i + 1][0], SEAM[i + 1][1] + fl);
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
    for (let k = 0; k <= n; k++) {
      const x = rnd(a[0] + ((b[0] - a[0]) * k) / n);
      const y = rnd(a[1] + ((b[1] - a[1]) * k) / n);
      if (c.p.isOpaque(x, y) && c.id[y * c.p.w + x] === P_FOREARM) c.p.set(x, y, p.seam >= 3 && (i + k) % 3 === 0 ? PAL.mag4 : tone);
    }
  }
}

// ---------------------------------------------------------------- chain

const LINK_FACE = ['.#.', '#.#', '#.#', '.#.'];
const LINK_EDGE = ['#', '#', '#'];

function paintChain(c: Comp, p: Pose, f: ForeG, light: Light): void {
  if (p.links <= 0) return;
  const q = layer(c.p.w, c.p.h);
  // anchor: the cuff's underside, a hook (two bronze pixels) under it
  const a = loc(f, f.len - 1.0, 5.8);
  let x = a[0];
  let y = a[1] + 1.5;
  const n = Math.min(4, p.links);
  const pitch = 2.7;
  for (let i = 0; i < n; i++) {
    const k = (i + 1) / 4;
    const ang = (p.sw * k + 14 * Math.sin((p.swT - i * 0.16) * Math.PI * 2) * k * (p.sw === 0 ? 0 : 0)) * DEG;
    x += Math.sin(ang) * pitch;
    y += Math.cos(ang) * pitch;
    const face = i % 2 === 0;
    const bits = face ? LINK_FACE : LINK_EDGE;
    const ox = rnd(x) - (face ? 1 : 0);
    const oy = rnd(y) - (face ? 2 : 1);
    stampBits(q, bits, ox, oy, (cx, cy) => {
      // lit top-left pixel, shadow bottom-right
      const top = cy === 0 && face;
      const bot = cy >= bits.length - 1;
      if (top) return BRONZE.L;
      if (bot) return BRONZE.S;
      return (face ? cx === 0 : true) ? BRONZE.M : BRONZE.S;
    });
  }
  c.add(q, P_CHAIN);
  void light;
}

// ---------------------------------------------------------------- the glyph disc

function discRing(c: PixelCanvas, cx: number, cy: number, light: Light): void {
  const x0 = cx - 4;
  const y0 = cy - 4;
  for (let j = 0; j < 9; j++)
    for (let i = 0; i < 9; i++) {
      if (DISC9[j][i] !== '#') continue;
      const inSock = i >= 1 && i <= 7 && j >= 1 && j <= 7 && SOCK7[j - 1][i - 1] === '#';
      if (inSock) {
        c.set(x0 + i, y0 + j, PAL.mag0);
        continue;
      }
      const dx = i - 4;
      const dy = j - 4;
      const toward = (dx * light.side > 0 ? 1 : 0) + (dy < 0 ? 1 : 0);
      c.set(x0 + i, y0 + j, toward === 2 ? BRONZE.E : toward === 1 ? BRONZE.M : BRONZE.S);
    }
}

/** Glyph strokes, socket glow, the inner cool ring, hot cores — the light layer of the disc. */
function discLight(p: PixelCanvas, cx: number, cy: number, level: number, light: Light): void {
  const lv = Math.max(0, Math.min(4, level));
  const x0 = cx - 3;
  const y0 = cy - 3;
  // socket bed: dark, a violet cool ring on the shadow side when lit
  for (let j = 0; j < 7; j++)
    for (let i = 0; i < 7; i++) {
      if (SOCK7[j][i] !== '#') continue;
      const dx = i - 3;
      const dy = j - 3;
      const away = (dx * light.side < 0 ? 1 : 0) + (dy > 0 ? 1 : 0);
      const edge = Math.abs(dx) + Math.abs(dy) >= 4 || i === 0 || i === 6 || j === 0 || j === 6;
      p.set(x0 + i, y0 + j, lv >= 2 && edge && away >= 1 ? PAL.void2 : lv >= 3 ? PAL.mag1 : PAL.mag0);
    }
  const stroke = [PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag3, PAL.mag4][lv];
  stampBits(p, GLYPH_ARM_L, x0 + 1, y0 + 1, (gx, gy) => {
    // the shadow-side column of a stroke is one step dimmer
    const dim = lv >= 1 && lv <= 3 && gy >= 2 && (gx === 0 || gx === 4) ? 1 : 0;
    return dim ? MAG[Math.max(1, lv)] : stroke;
  });
  if (lv >= 3) {
    // hot core: the middle of the palm of the glyph
    p.set(x0 + 3, y0 + 3, PAL.mag4);
    if (lv >= 4) {
      p.set(x0 + 2, y0 + 3, PAL.mag4);
      p.set(x0 + 4, y0 + 3, PAL.mag4);
      p.set(x0 + 3, y0 + 4, PAL.mag4);
    }
  }
}

// ---------------------------------------------------------------- the frame

export function drawArm(p: PixelCanvas, pose0: Pose, from: DrawOpts['lightFrom'] = 'left'): void {
  const light = lightOf(from);
  const o = pose0;
  const dy = o.dy;
  const pz: Pose = dy === 0 ? o : { ...o, sy: o.sy + dy, wy: o.wy + dy };
  const f = foreGeom(pz);
  const g: HandG = handGeom([pz.wx, pz.wy], pz.ha, pz.hand);
  const c = new Comp(p);

  // chips in the air (far side), then the core bar and the back fingers
  const chips = (list: readonly Chip[]) => {
    for (const ch of list) {
      const q = layer(p.w, p.h);
      const [w, h] = ch.k === 0 ? [2, 2] : ch.k === 1 ? [3, 2] : [3, 3];
      q.rect(rnd(ch.x), rnd(ch.y + dy), w, h, OBS.M);
      bands(q, OBS, light, 1, 1);
      c.add(q, P_CHIP, { out: OBS.D });
    }
  };
  chips(o.chips);

  paintForearm(c, pz, f, light);
  for (const i of [PINKY, RING, MIDDLE, INDEX]) paintFinger(c, i, g, light, P_FINGER);
  paintPalm(c, g, light, P_PALM);
  paintCuff(c, g.w, (f.ang + g.a) / 2, light, P_CUFF);
  paintChain(c, pz, f, light);
  paintThenar(c, g, light, P_PALM);
  paintFinger(c, THUMB, g, light, P_THUMB);

  // inlay that must sit inside the silhouette: the disc ring + socket, the fingertip beads
  const dcx = rnd(g.disc[0]);
  const dcy = rnd(g.disc[1]);
  discRing(p, dcx, dcy, light);

  // pulse → bead levels
  const beadLevels: number[] = [];
  for (let i = 0; i < NF; i++) {
    const forced = o.tips[i];
    if (forced >= 0) {
      beadLevels.push(forced);
      continue;
    }
    if (o.pulse < 0) {
      beadLevels.push(0);
      continue;
    }
    const d = Math.hypot(g.f[i][3][0] - g.disc[0], g.f[i][3][1] - g.disc[1]);
    const dd = o.pulse - d;
    beadLevels.push(dd < -6 ? 0 : dd < -2 ? 1 : dd < 2 ? 3 : dd < 6 ? 2 : 1);
  }
  for (let i = 0; i < NF; i++) tipBead(p, i, g, Math.min(3, beadLevels[i]));

  // ink outline round the whole stone
  p.outline(PAL.ink);

  // ---- light layer (after the outline, never outlined)
  spillRing(c, dcx, dcy, o.spill, light);
  veins(c, g, o);
  discLight(p, dcx, dcy, o.glow, light);
  paintSeam(c, pz, f);
  for (let i = 0; i < NF; i++) if (beadLevels[i] >= 3) hotTip(p, i, g);
  for (const s of o.sparks) p.set(rnd(s[0]), rnd(s[1] + dy), PAL.void4);
  for (const m of o.motes) p.set(rnd(m[0]), rnd(m[1] + dy), MAG[m[2]]);
  void BRONZE;
  void P_CHAIN;
}

/** Violet spill of the lit glyph onto the palm stone round the disc: lit side void2, shadow side void1 (flat bands, IŞ-3). */
function spillRing(c: Comp, cx: number, cy: number, level: number, light: Light): void {
  if (level <= 0) return;
  const mx = cx + 0.5;
  const my = cy + 0.5;
  const r1 = level >= 2 ? 7.4 : 6.2;
  for (let y = cy - 8; y <= cy + 8; y++)
    for (let x = cx - 8; x <= cx + 8; x++) {
      if (!c.p.isOpaque(x, y) || c.id[y * c.p.w + x] !== P_PALM) continue;
      const d = Math.hypot(x + 0.5 - mx, y + 0.5 - my);
      if (d < 4.7 || d > r1) continue;
      const toward = (x + 0.5 - mx) * light.side * -1 + -(y + 0.5 - my) * 0.8 < 0;
      c.p.set(x, y, d <= 5.9 ? (toward ? PAL.void2 : PAL.void1) : PAL.void1);
    }
}

/** Seal veins: 1-px lines from the disc to each finger base over the palm slab, lit by the travelling pulse. */
function veins(c: Comp, g: HandG, o: Pose): void {
  if (o.veins <= 0) return;
  const [dx, dy] = g.disc;
  for (let i = 0; i < NF; i++) {
    const b = g.f[i][0];
    const len = Math.hypot(b[0] - dx, b[1] - dy) || 1;
    const n = Math.ceil(len);
    for (let k = 0; k <= n; k++) {
      const s = (k / n) * len;
      if (s < 5.2) continue;
      const x = rnd(dx + ((b[0] - dx) * k) / n);
      const y = rnd(dy + ((b[1] - dy) * k) / n);
      if (!c.p.isOpaque(x, y) || c.id[y * c.p.w + x] !== P_PALM) continue;
      let t = o.veins >= 2 ? 2 : 1;
      if (o.pulse >= 0) {
        const dd = o.pulse - s;
        t = dd < -3 ? 1 : dd < -1 ? 2 : dd <= 1 ? 3 : dd <= 4 ? 2 : 1;
      }
      c.p.set(x, y, MAG[t]);
    }
  }
}

function hotTip(p: PixelCanvas, i: number, g: HandG): void {
  const b = g.f[i][3];
  p.set(rnd(b[0] - (b[0] - g.f[i][2][0]) * 0.25), rnd(b[1] - (b[1] - g.f[i][2][1]) * 0.25), PAL.mag4);
}
