// Sağ Kol Mührü v3 — the rig of the "breaker fist": a basalt-and-obsidian right arm pushing up out of a cracked floor, a
// clenched fist on top, a bronze wrist band with the glyph stud (the seal) between them. Frame 80 × 104, the crack's centre is
// the anchor. Painted back to front: far rubble, the hole and its lip, the forearm's slabs, the hand, the band and stud, near
// rubble; then the 1-px ink outline; then the light layer (stud glow, the seams that crawl over the floor, sparks, dust).
//
// Everything that moves is a Pose field (anims.ts keys them); the arm itself never moves as a whole sprite: the wrist rises or
// sinks (`up`), shifts forward (`fx`), the forearm's slabs follow along the axis from the crack's centre to the wrist, and the
// hand (its own plates, see hand.ts) turns about the wrist.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { lightOf, type Light } from '../rigkit';
import type { DrawOpts } from '../types';
import { HAND0, HH, HOX, HOY, HW, paintHand, turnHand, type HandState } from './seal_arm_r-hand';
import { BRONZE, Comp, GLYPH_ARM_R, OBS, OBS_FAR, bands, chamfer, layer, release, type Pt } from './seal_arm_r-kit';

export const W = 80;
export const H = 104;
/** The crack's centre = the anchor (the arm leaves the floor here). */
export const CX = 38;
export const CY = 90;
/** Wrist top centre at rest. */
export const WX0 = 43;
export const WY0 = 56;

export interface Pebble {
  x: number;
  y: number;
  /** 0 pebble (2×2), 1 chip (3×2), 2 slab (4×3) */
  k: number;
}

export interface Debris {
  x: number;
  y: number;
  w: number;
  h: number;
  /** tone set: 0 obsidian, 1 far, 2 bronze */
  m?: number;
}

export interface Pose {
  /** wrist rise in px (+ up); rest 0, guard about −30 */
  up: number;
  /** wrist forward shift in px */
  fx: number;
  /** extra rise of the arm's chain at the wrist / three creases below it (px): the push wave runs up the forearm */
  rip: readonly [number, number, number, number];
  /** extra turn of the hand about the wrist (deg, + = tipping forward) on top of the arm's lean */
  hand: number;
  /** extra offset of the hand relative to the wrist */
  hdx: number;
  hdy: number;
  h: HandState;
  /** stud glow 0 dim … 5 flare */
  glow: number;
  /** spill of the stud's light onto the stone 0..3 */
  spill: number;
  /** floor seams: brightness 0 off, 1 dim, 2 lit, 3 blazing; phase of the crawling bright pair 0..1 (−1 none) */
  seam: number;
  seamT: number;
  /** extra seam length in px (roar: the roots reach out) */
  seamLen: number;
  /** dy of the eight rubble slabs (0..7), a slab that leaps is lifted */
  rub: readonly number[];
  /** dx of the eight rubble slabs (thrown outward in summon) */
  rubx: readonly number[];
  /** a hopping pebble on the lip: phase 0..5 (−1 none) */
  hop: number;
  /** dust motes: phase 0..1 (−1 none), amount */
  dust: number;
  dustN: number;
  /** void4 sparks (positions are fixed per index): how many (0..4) */
  spark: number;
  /** levitating pebbles (roar): height px, 0 off */
  lev: number;
  /** smear length behind the knuckles (px, release frame only) */
  smear: number;
  /** extra loose debris (falling plates, chips) */
  debris: readonly Debris[];
  /** extra pebbles in the air */
  air: readonly Pebble[];
  /** forearm erosion: rows from the top that are gone (death) */
  erode: number;
  /** crack width factor ×(rx), summon bursts it wider (0 = 19) */
  wide: number;
  /** floor-crack extra dark depth 0/1 */
  deep: number;
  /** show the hand? (death: the hand sinks last) */
  hide: boolean;
  /** lit negative bands (hitMagic: plates flash void) 0..2 */
  flash: number;
  /** a single stone4 glint pixel on the near knuckle */
  glint: number;
  /** the forearm's visible wobble: dx of the whole forearm slabs above the crack (rattle), 0 */
  wob: number;
}

export const POSE0: Pose = {
  up: 0, fx: 0, rip: [0, 0, 0, 0], hand: 0, hdx: 0, hdy: 0, h: HAND0, glow: 1, spill: 1, seam: 1, seamT: -1, seamLen: 0,
  rub: [0, 0, 0, 0, 0, 0, 0, 0], rubx: [0, 0, 0, 0, 0, 0, 0, 0], hop: 0, dust: -1, dustN: 0, spark: 0, lev: 0, smear: 0, debris: [], air: [],
  erode: 0, wide: 0, deep: 0, hide: false, flash: 0, glint: 0, wob: 0,
};

export function pose(o: Partial<Pose>): Pose {
  return { ...POSE0, ...o };
}

// ---------------------------------------------------------------- arm geometry

/** Wrist top centre of a pose. */
export function wrist(p: Pose): { x: number; y: number } {
  return { x: WX0 + p.fx, y: WY0 - p.up - p.rip[0] };
}
/** The arm's axis x at screen row y (a straight line from the crack's centre to the wrist). */
function axisX(p: Pose, y: number): number {
  const w = wrist(p);
  const t = (CY - y) / (CY - w.y);
  return CX + (w.x - CX) * t;
}
/** The arm's lean in degrees (+ = leaning right going up). */
export function leanDeg(p: Pose): number {
  const w = wrist(p);
  return (Math.atan2(w.x - CX, CY - w.y) * 180) / Math.PI;
}

// forearm slabs in arm space (u across, v down from the wrist's top): shared crease polylines + chipped side profiles
const CREASE: readonly (readonly [Pt, Pt])[] = [
  [[-7, 4], [7, 4]],
  [[-8, 12], [8, 17]],
  [[-10, 28], [9, 24]],
  [[-9, 39], [10, 43]],
  [[-10, 55], [9, 52]],
  [[-9, 68], [10, 71]],
];
const LEFT: readonly (readonly Pt[])[] = [
  [[-7, 4], [-7, 8], [-8, 12]],
  [[-8, 12], [-9, 20], [-10, 28]],
  [[-10, 28], [-10, 34], [-9, 39]],
  [[-9, 39], [-10, 47], [-10, 55]],
  [[-10, 55], [-9, 61], [-9, 68]],
];
const RIGHT: readonly (readonly Pt[])[] = [
  [[7, 4], [7, 10], [8, 17]],
  [[8, 17], [9, 21], [9, 24]],
  [[9, 24], [10, 33], [10, 43]],
  [[10, 43], [10, 49], [9, 52]],
  [[9, 52], [10, 60], [10, 71]],
];

/** The chain's extra rise at arm-space depth v (px below the wrist's top): piecewise linear through the control points. */
function ripAt(p: Pose, v: number): number {
  const vs = [0, 14, 26, 41, 56];
  const rs = [p.rip[0], p.rip[1], p.rip[2], p.rip[3], 0];
  if (v <= 0) return rs[0];
  for (let i = 0; i < 4; i++) if (v <= vs[i + 1]) return rs[i] + ((rs[i + 1] - rs[i]) * (v - vs[i])) / (vs[i + 1] - vs[i]);
  return 0;
}

function slabPoly(i: number, p: Pose, yOff: number): Pt[] {
  const w = wrist(p);
  const y0 = w.y + p.rip[0];
  const map = ([u, v]: Pt): Pt => {
    const y = y0 + v - Math.round(ripAt(p, v));
    return [Math.round(axisX(p, y) + u), y + yOff];
  };
  const pts: Pt[] = [];
  const top = CREASE[i];
  const bot = CREASE[i + 1];
  pts.push(map(top[0]));
  for (const q of LEFT[i].slice(1)) pts.push(map(q));
  pts.push(map(bot[0]));
  pts.push(map(bot[1]));
  for (const q of [...RIGHT[i]].reverse().slice(1)) pts.push(map(q));
  pts.push(map(top[1]));
  return pts;
}

// ---------------------------------------------------------------- the hole in the floor

const HOLE_J = [0, 1, 0, -1, 0, 1, 1, 0, -1, 0, 1, 0, 0, -1, 0, 1, 0, 0, -1, 1, 0, -1, 0, 1];
function holePoly(p: Pose): Pt[] {
  const rx = 18 + p.wide * 1;
  const ry = 6 + p.wide * 0.4;
  const pts: Pt[] = [];
  const n = HOLE_J.length;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const j = HOLE_J[k];
    pts.push([Math.round(CX + (rx + j) * Math.cos(a)), Math.round(CY + (ry + j * 0.5) * Math.sin(a))]);
  }
  return pts;
}

function dilate(q: PixelCanvas, r: number): PixelCanvas {
  const out = layer(q.w, q.h);
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      if (!q.isOpaque(x, y)) continue;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > r + (r > 1 ? 1 : 0)) continue;
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < q.w && yy < q.h) out.set(xx, yy, PAL.stone1);
        }
    }
  return out;
}

// ---------------------------------------------------------------- rubble slabs

interface Slab {
  x: number;
  y: number;
  w: number;
  top: number;
  front: number;
  /** 0 far (behind the arm) · 1 near (in front) */
  z: 0 | 1;
  /** top face leans: dx of the top face's far edge */
  lean: number;
}
const SLABS: readonly Slab[] = [
  { x: 22, y: 80, w: 9, top: 3, front: 3, z: 0, lean: 2 },
  { x: 47, y: 79, w: 10, top: 3, front: 4, z: 0, lean: -2 },
  { x: 33, y: 78, w: 5, top: 2, front: 2, z: 0, lean: 1 },
  { x: 17, y: 87, w: 5, top: 3, front: 4, z: 0, lean: 1 },
  { x: 55, y: 86, w: 6, top: 3, front: 4, z: 0, lean: -1 },
  { x: 22, y: 93, w: 8, top: 2, front: 3, z: 1, lean: 2 },
  { x: 33, y: 97, w: 5, top: 2, front: 2, z: 1, lean: 1 },
  { x: 47, y: 94, w: 8, top: 2, front: 3, z: 1, lean: -2 },
];

function paintSlab(c: Comp, s: Slab, dx: number, dy: number, light: Light, id: number): void {
  const ls = light.side;
  const q = layer(W, H);
  const x0 = s.x + dx;
  const y0 = s.y + dy;
  // top face: a parallelogram leaning by `lean`; front face under it
  const l = s.lean;
  q.poly([[x0 + Math.max(0, l), y0], [x0 + s.w + Math.min(0, l), y0], [x0 + s.w, y0 + s.top], [x0, y0 + s.top]], PAL.stone2);
  q.rect(x0, y0 + s.top, s.w, s.front, PAL.stone1);
  // the right (shade) third of the front face is stone0; the top face's lit end gets stone3 (the edge run)
  const sh = Math.max(2, Math.round(s.w / 3));
  if (ls < 0) {
    q.rect(x0 + s.w - sh, y0 + s.top, sh, s.front, PAL.stone0);
    q.hline(x0 + Math.max(0, l), x0 + Math.max(0, l) + 2, y0, PAL.stone3);
  } else {
    q.rect(x0, y0 + s.top, sh, s.front, PAL.stone0);
    q.hline(x0 + s.w + Math.min(0, l) - 3, x0 + s.w + Math.min(0, l) - 1, y0, PAL.stone3);
  }
  q.hline(x0, x0 + s.w - 1, y0 + s.top, PAL.void0);
  q.hline(x0, x0 + s.w - 1, y0 + s.top + s.front - 1, PAL.stone0);
  c.add(q, id, { out: PAL.void0 });
}

// ---------------------------------------------------------------- drawing

/** Which stone-tone each tone becomes inside the violet spill of the glowing stud (lit side void2, shade side void1). */
const SPILL_MAP = new Map<number, number>([
  [PAL.stone3, PAL.void3],
  [PAL.stone2, PAL.void2],
  [PAL.stone1, PAL.void1],
  [PAL.stone0, PAL.void1],
]);

/** Draw one frame of the arm onto p (cleared, W × H). */
export function drawArm(p: PixelCanvas, ps: Pose, from: DrawOpts['lightFrom'] = 'left'): void {
  const light = lightOf(from);
  const c = new Comp(p);
  const w = wrist(ps);
  const top = w.y;

  // -- far rubble
  SLABS.forEach((s, i) => {
    if (s.z === 0) paintSlab(c, s, ps.rubx[i] ?? 0, ps.rub[i] ?? 0, light, 10 + i);
  });

  // -- the hole and its lip
  const hp = holePoly(ps);
  const hole = layer(W, H);
  hole.poly(hp, PAL.ink);
  const ring = dilate(hole, 2);
  // the lip ring = dilated − hole
  const lip = layer(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ring.isOpaque(x, y) && !hole.isOpaque(x, y)) lip.set(x, y, PAL.stone1);
  release(ring);
  bands(lip, OBS_FAR, light, 2, 2, { top: 1, bottom: 1 });
  c.add(lip, 1);
  // the far inner wall lit by the seal light from below: two rows under the far lip
  const wall = layer(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (hole.isOpaque(x, y) && y <= CY - 3 + ps.deep) wall.set(x, y, PAL.void0);
  const wallTone = [PAL.void0, PAL.void1, PAL.void2][Math.min(2, ps.seam)];
  c.add(hole, 2);
  // inner wall: an uneven band along the far edge
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!wall.isOpaque(x, y)) continue;
      if (p.get(x, y) !== PAL.ink) continue;
      // two rows below the topmost hole row of this column
      let up = 0;
      while (hole.isOpaque(x, y - 1 - up) || p.get(x, y - 1 - up) === PAL.ink) up++;
      if (up < 2) p.set(x, y, up === 0 ? wallTone : PAL.void0);
    }
  release(wall);

  // -- the forearm: slabs from the wrist down to the hole's inside
  const clipY = CY + 3;
  const slabCount = CREASE.length - 1;
  for (let i = 0; i < slabCount; i++) {
    const poly = slabPoly(i, ps, 0);
    if (poly.every(([, y]) => y > clipY + 8)) continue;
    const q = layer(W, H);
    q.poly(poly, PAL.stone1);
    // clip below the hole's inside
    for (let y = clipY + 1; y < H; y++) for (let x = 0; x < W; x++) q.erase(x, y);
    // erosion (death): the top rows are gone
    if (ps.erode > 0) for (let y = 0; y < top + 4 + ps.erode; y++) for (let x = 0; x < W; x++) q.erase(x, y);
    const deep = i >= 3;
    bands(q, deep ? OBS_FAR : OBS, light, 3, 3, { top: 1, bottom: 1, edge: deep ? 0 : 4 });
    // the hole swallows the last rows: shade them
    for (let y = CY - 1; y <= clipY; y++) for (let x = 0; x < W; x++) if (q.isOpaque(x, y)) q.set(x, y, y >= CY + 1 ? PAL.void0 : PAL.stone0);
    c.add(q, 20 + i, { out: PAL.void0 });
  }
  // -- the hand (behind the band)
  if (!ps.hide) {
    const hs: HandState = { ...ps.h };
    let hl = paintHand(hs, light);
    hl = turnHand(hl, Math.round(leanDeg(ps) + ps.hand));
    const hx = w.x + ps.hdx - HOX;
    const hy = top + ps.hdy - HOY;
    // whatever sinks below the crack's lip is swallowed by the hole (never reaches the frame edge)
    for (let y = Math.max(0, clipY + 1 - hy); y < HH; y++) for (let x = 0; x < HW; x++) hl.erase(x, y);
    if (ps.smear > 0) {
      for (let s = ps.smear; s >= 1; s--) {
        const sm = layer(HW, HH);
        for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) if (hl.isOpaque(x, y)) sm.set(x, y, s === ps.smear ? PAL.stone0 : PAL.void1);
        c.add(sm, 30, {}, hx - s, hy + s);
      }
    }
    c.add(hl, 31, ps.smear > 0 ? { out: PAL.void0 } : {}, hx, hy);
  }

  // -- the bronze wrist band + the stud
  paintBand(c, ps, light);

  // -- near rubble
  SLABS.forEach((s, i) => {
    if (s.z === 1) paintSlab(c, s, ps.rubx[i] ?? 0, ps.rub[i] ?? 0, light, 10 + i);
  });
  // loose debris / air pebbles (stone chips)
  for (const d of ps.debris) {
    const q = layer(W, H);
    q.poly(chamfer(d.x, d.y, d.x + d.w, d.y + d.h, [1, 0, 1, 0]), PAL.stone1);
    bands(q, d.m === 2 ? BRONZE : d.m === 1 ? OBS_FAR : OBS, light, 1, 1, { top: 1, bottom: 1 });
    c.add(q, 40, { out: PAL.void0 });
  }
  for (const a of ps.air) {
    const q = layer(W, H);
    const [pw, ph] = a.k === 0 ? [2, 2] : a.k === 1 ? [3, 2] : [4, 3];
    q.rect(a.x, a.y, pw, ph, PAL.stone1);
    q.hline(a.x, a.x + pw - 1, a.y, PAL.stone2);
    q.set(a.x + (light.side < 0 ? pw - 1 : 0), a.y + ph - 1, PAL.stone0);
    c.add(q, 41);
  }
  paintHop(c, ps, light);

  // -- outline
  p.outline(PAL.ink);

  // -- stud spill on the stone, then the light layer
  // (a stud that has sunk below the lip gives no light of its own)
  const above = studPos(ps).y <= CY + 3;
  if (above) spillStone(p, ps, light);
  paintLight(p, ps, light, above);
}

/** Position of the stud's centre. */
export function studPos(ps: Pose): { x: number; y: number } {
  const w = wrist(ps);
  return { x: Math.round(axisX(ps, w.y + 2)) + 1, y: w.y + 2 };
}

function paintBand(c: Comp, ps: Pose, light: Light): void {
  const w = wrist(ps);
  const cx = Math.round(axisX(ps, w.y + 2));
  const q = layer(W, H);
  q.poly(chamfer(cx - 9, w.y, cx + 9, w.y + 4, [1, 1, 1, 1]), PAL.gold2);
  bands(q, BRONZE, light, 3, 4, { top: 1, bottom: 1, edge: 0 });
  // a lower-lit row at the bottom edge (the band's underside shade)
  for (let y = CY + 4; y < H; y++) for (let x = 0; x < W; x++) q.erase(x, y);
  c.add(q, 50, { out: PAL.gold0 });
  // the stud: 7 × 7 rounded square, bronze ring around the 5 × 5 socket
  const s = studPos(ps);
  const sq = layer(W, H);
  const x0 = s.x - 3;
  const y0 = s.y - 3;
  const ls = light.side;
  for (let j = 0; j < 7; j++)
    for (let i = 0; i < 7; i++) {
      if ((i === 0 || i === 6) && (j === 0 || j === 6)) continue;
      const ring = i === 0 || i === 6 || j === 0 || j === 6;
      if (!ring) continue;
      const lit = (ls < 0 ? i <= 1 : i >= 5) || j === 0;
      const dark = (ls < 0 ? i === 6 : i === 0) || j === 6;
      sq.set(x0 + i, y0 + j, lit && !dark ? PAL.gold3 : dark ? PAL.gold1 : PAL.gold2);
    }
  // socket
  for (let j = 1; j <= 5; j++) for (let i = 1; i <= 5; i++) sq.set(x0 + i, y0 + j, PAL.mag0);
  for (let y = CY + 4; y < H; y++) for (let x = 0; x < W; x++) sq.erase(x, y);
  c.add(sq, 51, { out: PAL.gold0 });
}

/** Dim → flare colours of the stud for a glow level: [glyph, hot, socket]. */
function glowTones(g: number): { glyph: number; hot: number; socket: number; shade: number } {
  switch (Math.max(0, Math.min(5, g))) {
    case 0:
      return { glyph: PAL.mag1, hot: PAL.mag1, socket: PAL.mag0, shade: PAL.mag0 };
    case 1:
      return { glyph: PAL.mag2, hot: PAL.mag2, socket: PAL.mag0, shade: PAL.mag1 };
    case 2:
      return { glyph: PAL.mag3, hot: PAL.mag3, socket: PAL.mag0, shade: PAL.mag1 };
    case 3:
      return { glyph: PAL.mag3, hot: PAL.mag4, socket: PAL.mag1, shade: PAL.mag2 };
    case 4:
      return { glyph: PAL.mag4, hot: PAL.mag4, socket: PAL.mag2, shade: PAL.mag3 };
    default:
      return { glyph: PAL.mag4, hot: PAL.white, socket: PAL.mag3, shade: PAL.mag3 };
  }
}

/** The stud's glyph and socket, drawn after the outline (light layer, never outlined). */
function paintStudGlow(p: PixelCanvas, ps: Pose, light: Light): void {
  const s = studPos(ps);
  const x0 = s.x - 2;
  const y0 = s.y - 2;
  const g = glowTones(ps.glow);
  const ls = light.side;
  for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) p.set(x0 + i, y0 + j, g.socket);
  for (let j = 0; j < 5; j++)
    for (let i = 0; i < 5; i++) {
      if (GLYPH_ARM_R[j][i] !== '#') continue;
      // the shadow side of a stroke (away from the key light) steps one tone down
      const away = GLYPH_ARM_R[j][i - ls * -1 * -1 + 0] === undefined ? false : false;
      void away;
      const nx = i - ls * -1; // neighbour on the shade side? (ls < 0: light left, shade right => i+1)
      const shadeNb = GLYPH_ARM_R[j][ls < 0 ? i + 1 : i - 1];
      const onShade = shadeNb !== '#';
      void nx;
      let col = onShade && ps.glow < 4 ? g.shade : g.glyph;
      // the hot core: the arrow's spine
      if (i === 2 && (j === 0 || j === 3 || j === 4)) col = g.hot;
      p.set(x0 + i, y0 + j, col);
    }
}

function spillStone(p: PixelCanvas, ps: Pose, light: Light): void {
  if (ps.spill <= 0 && ps.glow < 2) return;
  const s = studPos(ps);
  const r = ps.glow >= 3 ? 5 : ps.glow >= 2 ? 4 : 0;
  if (!r) return;
  const rr = ps.spill >= 2 || ps.glow >= 4 ? r : r - 1;
  for (let y = s.y - rr; y <= s.y + rr; y++)
    for (let x = s.x - rr - 1; x <= s.x + rr + 1; x++) {
      const dx = Math.abs(x - s.x);
      const dy = Math.abs(y - s.y);
      if (Math.max(dx, dy) < 4) continue; // the stud and its ring
      if (dx + dy > rr + 2) continue;
      const c = p.get(x, y);
      if (c === null) continue;
      const m = SPILL_MAP.get(c);
      if (m !== undefined) p.set(x, y, m);
    }
  void light;
}

// ---------------------------------------------------------------- the light layer

// the four floor seams (screen offsets from the hole's centre along the 2:1 diagonals) — each a run of (dx, dy) steps
const SEAMS: readonly (readonly Pt[])[] = [
  [[19, 2], [21, 3], [23, 3], [25, 4], [27, 4], [29, 5], [31, 6]],
  [[18, -3], [20, -4], [22, -5], [24, -5], [26, -6]],
  [[-19, 3], [-21, 4], [-23, 4], [-25, 5], [-27, 6], [-29, 6]],
  [[-18, -3], [-20, -4], [-22, -4], [-24, -5], [-26, -6]],
];

function paintSeams(p: PixelCanvas, ps: Pose): void {
  if (ps.seam <= 0) return;
  const base = [PAL.mag0, PAL.mag1, PAL.mag1, PAL.mag2][Math.min(3, ps.seam)];
  const lit = [PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag3][Math.min(3, ps.seam)];
  SEAMS.forEach((run, si) => {
    const total = Math.min(run.length, Math.round(run.length * (0.75 + ps.seam * 0.1)) + Math.floor(ps.seamLen / 3));
    let px = -999;
    let py = -999;
    for (let k = 0; k < total; k++) {
      const [dx, dy] = run[k];
      const x = CX + dx;
      const y = CY + dy + 1;
      let col: number = k >= total - 2 ? PAL.mag0 : base;
      if (ps.seamT >= 0) {
        const pos = ((ps.seamT * (run.length + 6) + si * 3) % (run.length + 6)) - 3;
        if (Math.abs(k - pos) < 1.6) col = lit;
      }
      if (x >= 1 && y >= 1 && x < W - 1 && y < H - 1) {
        // join the previous step with a line so the seam is one unbroken crack
        if (px > -900) {
          const mx = Math.round((px + x) / 2);
          const my = py;
          if (p.get(mx, my) === null) p.set(mx, my, col);
        }
        if (p.get(x, y) === null) p.set(x, y, col);
      }
      px = x;
      py = y;
    }
  });
}

const MOTES: readonly (readonly [number, number, number])[] = [[-14, 6, 0.0], [-3, 9, 0.34], [9, 5, 0.67], [17, 8, 0.15], [2, 7, 0.82]];
const SPARKS: readonly Pt[] = [[-5, -4], [6, -6], [-8, 2], [8, 3]];

// fissures in the forearm's slabs (arm space u, v): the broken stone leaks seal light along them
const FISSURES: readonly (readonly Pt[])[] = [
  [[3, 14], [2, 17], [4, 20], [3, 23]],
  [[-5, 29], [-4, 32], [-6, 35], [-5, 38]],
  [[4, 44], [3, 47], [5, 50]],
];
const STONE_TONES = new Set<number>([PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3, PAL.void0, PAL.void1, PAL.void2]);
function paintFissures(p: PixelCanvas, ps: Pose, light: Light): void {
  const y0 = wrist(ps).y + ps.rip[0];
  const col = ps.glow >= 4 ? PAL.mag3 : ps.glow >= 2 ? PAL.mag2 : PAL.mag1;
  for (const f of FISSURES)
    for (let i = 0; i + 1 < f.length; i++) {
      const [u0, v0] = f[i];
      const [u1, v1] = f[i + 1];
      const n = Math.max(Math.abs(v1 - v0), 1);
      for (let k = 0; k <= n; k++) {
        const v = v0 + Math.round(((v1 - v0) * k) / n);
        const u = Math.round(u0 + ((u1 - u0) * k) / n) * (light.side < 0 ? 1 : 1);
        const y = y0 + v - Math.round(ripAt(ps, v));
        const x = Math.round(axisX(ps, y)) + u;
        const c = p.get(x, y);
        if (c !== null && STONE_TONES.has(c) && y < CY - 1) p.set(x, y, col);
      }
    }
}

function paintLight(p: PixelCanvas, ps: Pose, light: Light, studUp: boolean): void {
  paintFissures(p, ps, light);
  paintSeams(p, ps);
  if (studUp) paintStudGlow(p, ps, light);
  const s = studPos(ps);
  // sparks (void4)
  for (let i = 0; i < (studUp ? Math.min(4, ps.spark) : 0); i++) {
    const [dx, dy] = SPARKS[i];
    const x = s.x + dx;
    const y = s.y + dy;
    p.set(x, y, PAL.void4);
  }
  // dust motes at the rim: stone2 / stone3 single pixels climbing 6 px
  if (ps.dust >= 0 && ps.dustN > 0)
    for (let i = 0; i < Math.min(MOTES.length, ps.dustN); i++) {
      const [mx, my, ph] = MOTES[i];
      const t = (ps.dust + ph) % 1;
      const y = CY - 1 - Math.round(my * t * 0.8) - 3;
      const x = CX + mx + (t > 0.5 ? 1 : 0);
      if (p.get(x, y) === null && t < 0.9) p.set(x, y, t < 0.5 ? PAL.stone3 : PAL.stone2);
    }
  // glint on the near knuckle
  if (ps.glint > 0) {
    const w = wrist(ps);
    const gx = w.x + ps.hdx + (light.side < 0 ? -7 : 7) + 1;
    const gy = w.y + ps.hdy - 19;
    p.set(gx, gy, PAL.stone4);
  }
}

function paintHop(c: Comp, ps: Pose, light: Light): void {
  if (ps.hop < 0) return;
  const hs = [0, 2, 4, 5, 3, 1][Math.min(5, Math.floor(ps.hop))];
  const q = layer(W, H);
  const x = CX + 14;
  const y = CY + 5 - hs;
  q.rect(x, y, 2, 2, PAL.stone1);
  q.set(x + (light.side < 0 ? 0 : 1), y, PAL.stone2);
  c.add(q, 60, { out: PAL.void0 });
}

