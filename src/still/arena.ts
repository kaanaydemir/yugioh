// Neon Düello still preview — a calm, simplified version of the ORIGINAL v1 arena: the same board
// geometry (5×5 grid of 64×32 tiles from src/view/layout.ts, the same 20 zones + the bridge row, the
// original slab outline with its two notched podium pads, slab thickness and stepped hull — see
// arena-geom.ts) drawn as a dark matte slab with thin side-coloured zone outlines, ONE neon trim
// along the platform edge, and a dark low-contrast stadium behind it.
//
// Removed from the original: tile icons / nested frames / crosses, the dotted bridge stream, corner
// jewels, face indicator lights + vents, the energy core + light shaft, crowd lights, LED ribbon,
// searchlight beams, lit lamp banks, aurora, nebula + star field, the floor's dashed glow ring.
// Every colour is a PAL entry; no blending, no dithering — flat tone bands only.

import { PAL } from '../art/palette';
import type { Color, PixelCanvas, Pt } from '../art/pixel';
import { cellKind, isoToScreen, zoneAtCell, zoneXY, type XY } from '../view/layout';
import {
  G0,
  G1,
  HULL,
  KEEL_TIP,
  MASTS,
  OUTLINE,
  SLAB_T,
  WALL_H,
  gp,
  inGrid,
  insideOutline,
  outlineDist,
  pixelGrid,
  rimY,
  rowSide,
  standsBottomY,
  tileDV,
} from './arena-geom';

/** Ground points (zone tile centres) of the two monsters — the original scenario's zones. */
export const SLOTS: { dragon: XY; wizard: XY } = { dragon: zoneXY(0, 'monster', 0), wizard: zoneXY(1, 'monster', 1) };

// ---------------------------------------------------------------- tones (all PAL)

const T = {
  // background
  skyHigh: PAL.ink,
  sky: PAL.night0,
  haze: PAL.void0,
  canopy: PAL.ink,
  canopyLip: PAL.night1,
  stands: PAL.night1,
  tierBreak: PAL.night0,
  aisle: PAL.night0,
  wallShadow: PAL.ink,
  wall: PAL.night0,
  wallLip: PAL.night1,
  ground: PAL.night0,
  groundShadow: PAL.ink,
  ringP1: PAL.cyan0,
  ringP2: PAL.crim0,
  mast: PAL.night1,
  mastLip: PAL.night2,
  // hull (under the slab) — kept dark, it reads as a silhouette
  hullL: PAL.night1,
  hullR: PAL.night0,
  hullEdge: PAL.ink,
  keelL: PAL.night0,
  keelR: PAL.ink,
  keelRidge: PAL.night1,
  // slab side faces: the lower-left faces catch the top-left key light, the lower-right ones don't
  faceLLip: PAL.night3,
  faceL: PAL.night2,
  faceLLow: PAL.night1,
  faceRLip: PAL.night2,
  faceR: PAL.night1,
  faceRLow: PAL.night0,
  faceBottom: PAL.ink,
  // top surface
  rimBackL: PAL.night4, // edge facing the light
  rimBackR: PAL.night3,
  rimFrontL: PAL.night3,
  rimFrontR: PAL.night2,
  border: PAL.stone0,
  join: PAL.night0,
  pad: PAL.night1,
  pile: PAL.night0,
  bridge: PAL.stone0,
  // neon (never brighter than the monsters)
  trim: [PAL.cyan2, PAL.crim2, PAL.night3] as const,
  line: [PAL.cyan1, PAL.crim1] as const,
};

// ---------------------------------------------------------------- polygon helpers (grid space)

function insidePoly(poly: readonly (readonly [number, number])[], c: number, r: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > r !== yj > r && c < ((xj - xi) * (r - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Inset a CCW rectilinear grid polygon by d grid units (mitred corners, as art/arena.ts). */
function insetOutline(poly: readonly (readonly [number, number])[], d: number): [number, number][] {
  const n = poly.length;
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = poly[(i + n - 1) % n];
    const b = poly[i];
    const c = poly[(i + 1) % n];
    const n1 = [-Math.sign(b[1] - a[1]), Math.sign(b[0] - a[0])];
    const n2 = [-Math.sign(c[1] - b[1]), Math.sign(c[0] - b[0])];
    out.push([b[0] + (n1[0] + n2[0]) * d, b[1] + (n1[1] + n2[1]) * d]);
  }
  return out;
}

/** Trim band: between these insets (vertical px from the outer edge). */
const TRIM_IN = insetOutline(OUTLINE, 3 / 32);
const TRIM_OUT = insetOutline(OUTLINE, 4 / 32);

function polyS(p: PixelCanvas, pts: readonly Pt[], c: Color): void {
  p.poly(pts, c);
}

/** Bresenham walk calling fn(x, y, t). */
function walk(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number, t: number) => void): void {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  const n = Math.max(dx, -dy) || 1;
  let err = dx + dy;
  let k = 0;
  for (;;) {
    fn(x0, y0, k / n);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
    k++;
  }
}

// ---------------------------------------------------------------- top surface

export type TopKind = 'rim' | 'border' | 'trim' | 'join' | 'pad' | 'pile' | 'line' | 'bridge';

/** What the platform top shows at screen pixel (x, y), or null off the top surface. */
export function topAt(x: number, y: number): { kind: TopKind; color: Color } | null {
  const g = pixelGrid(x, y);
  if (!insideOutline(g.col, g.row)) return null;
  if (inGrid(g.col, g.row)) {
    const col = Math.floor(g.col + 0.5);
    const row = Math.floor(g.row + 0.5);
    const c = isoToScreen(col, row);
    const dv = tileDV(x - (c.x - 32), y - (c.y - 16));
    const kind = cellKind(col, row);
    if (dv < 1) return { kind: 'join', color: T.join };
    if (kind === 'bridge') return { kind: 'bridge', color: T.bridge };
    const z = zoneAtCell(col, row)!;
    const main = z.spot === 'monster' || z.spot === 'spellTrap';
    if (dv >= 2 && dv < 3) return { kind: 'line', color: T.line[z.player] };
    return main ? { kind: 'pad', color: T.pad } : { kind: 'pile', color: T.pile };
  }
  const { d, nx, ny } = outlineDist(g.col, g.row);
  if (d * 32 < 1) {
    const color = nx < 0 ? T.rimBackL : ny < 0 ? T.rimBackR : ny > 0 ? T.rimFrontL : T.rimFrontR;
    return { kind: 'rim', color };
  }
  if (insidePoly(TRIM_IN, g.col, g.row) && !insidePoly(TRIM_OUT, g.col, g.row))
    return { kind: 'trim', color: T.trim[rowSide(g.row)] };
  return { kind: 'border', color: T.border };
}

/** True on the platform's top surface (where floor light / contact shadows may fall). */
export function onPlatformTop(x: number, y: number): boolean {
  return topAt(x, y) !== null;
}

// ---------------------------------------------------------------- background

/** A gentle, large-scale undulation (integer px) for hand-shaped band edges. */
function wave(x: number, amp: number, period: number, phase: number): number {
  return Math.round(amp * Math.sin((x / period + phase) * Math.PI * 2));
}

function drawBackground(p: PixelCanvas): void {
  for (let x = 0; x < p.w; x++) {
    const top = rimY(x + 0.5);
    const bot = standsBottomY(x + 0.5);
    const yTop = Math.round(top) - 4;
    // sky bands: deepest at the top, a faint violet haze sitting on the stadium roof
    const hazeTop = yTop - 18 - wave(x, 3, 210, 0.15) - wave(x, 2, 97, 0.6);
    const highTop = yTop - 64 - wave(x, 4, 300, 0.4);
    for (let y = 0; y < p.h; y++) {
      let c: Color;
      if (y < yTop) c = y < highTop ? T.skyHigh : y < hazeTop ? T.sky : T.haze;
      else if (y < top) c = y === yTop ? T.canopyLip : T.canopy;
      else if (y < bot) {
        const t = (y + 0.5 - top) / (bot - top);
        const u = (x + 0.5 - 320) / (440 + (380 - 440) * t);
        const aisle = Math.abs(u * 5 - Math.round(u * 5)) < 0.008 + 0.004 * t && Math.abs(u) > 0.1;
        c = Math.abs(t - 0.47) < 0.03 ? T.tierBreak : aisle ? T.aisle : T.stands;
      } else if (y < bot + WALL_H) {
        const k = y - Math.floor(bot);
        c = k <= 1 ? T.wallShadow : k === WALL_H - 1 ? T.wallLip : T.wall;
      } else {
        c = T.ground;
        // the arena floor ring (one thin, dim line; player tints left / right)
        const ex = (x + 0.5 - 320) / 300;
        const ey = (y + 0.5 - 318) / 74;
        const er = Math.sqrt(ex * ex + ey * ey);
        if (Math.abs(er - 1) < 0.0105) c = x < 320 ? T.ringP1 : T.ringP2;
      }
      p.set(x, y, c);
    }
  }
  // two faint unlit floodlight masts on each side (tall shapes only; no lamps, no beams)
  for (const m of MASTS) {
    for (let y = m.lampY + 3; y < m.baseY; y++) {
      p.set(m.x - 1, y, T.mast).set(m.x, y, T.mast);
    }
    p.rect(m.x - 5, m.lampY - 2, 11, 5, T.mast);
    p.hline(m.x - 5, m.x + 5, m.lampY - 3, T.mastLip);
  }
}

// ---------------------------------------------------------------- platform: ground shadow, hull, faces

function drawGroundShadow(p: PixelCanvas): void {
  // the floating platform's shadow on the arena floor, nudged away from the top-left key light
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      if (p.get(x, y) !== T.ground && p.get(x, y) !== T.ringP1 && p.get(x, y) !== T.ringP2) continue;
      const ex = (x + 0.5 - 334) / 168;
      const ey = (y + 0.5 - 300) / 50;
      if (ex * ex + ey * ey <= 1) p.set(x, y, T.groundShadow);
    }
}

function drawHull(p: PixelCanvas): void {
  let depth = SLAB_T;
  let prevInset = 0;
  const tiers: { inset: number; top: number; t: number }[] = [];
  for (const h of HULL) {
    const top = depth + 32 * (h.inset - prevInset);
    tiers.push({ inset: h.inset, top, t: h.t });
    depth = top + h.t;
    prevInset = h.inset;
  }
  const last = tiers[tiers.length - 1];
  const a0 = G0 + last.inset;
  const a1 = G1 - last.inset;
  const spikeTop = last.top + last.t;
  const apex: Pt = [KEEL_TIP.x, KEEL_TIP.y];
  {
    const lft = gp(a0, a1, spikeTop);
    const bot = gp(a1, a1, spikeTop);
    const rgt = gp(a1, a0, spikeTop);
    polyS(p, [lft, bot, apex], T.keelL);
    polyS(p, [bot, rgt, apex], T.keelR);
    walk(bot[0], bot[1], apex[0], apex[1], (x, y) => p.set(x, y, T.keelRidge));
  }
  for (let k = tiers.length - 1; k >= 0; k--) {
    const { inset, top, t } = tiers[k];
    const lft = gp(G0 + inset, G1 - inset, top);
    const bot = gp(G1 - inset, G1 - inset, top);
    const rgt = gp(G1 - inset, G0 + inset, top);
    polyS(p, [lft, bot, [bot[0], bot[1] + t], [lft[0], lft[1] + t]], T.hullL);
    polyS(p, [bot, rgt, [rgt[0], rgt[1] + t], [bot[0], bot[1] + t]], T.hullR);
    walk(lft[0], lft[1] + t - 1, bot[0], bot[1] + t - 1, (x, y) => p.set(x, y, T.hullEdge));
    walk(bot[0], bot[1] + t - 1, rgt[0], rgt[1] + t - 1, (x, y) => p.set(x, y, T.hullEdge));
  }
}

function drawFaces(p: PixelCanvas): void {
  const n = OUTLINE.length;
  const faces: { a: [number, number]; b: [number, number]; lit: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const a = OUTLINE[i];
    const b = OUTLINE[(i + 1) % n];
    const nx = Math.sign(b[1] - a[1]);
    const ny = -Math.sign(b[0] - a[0]);
    if (nx > 0 || ny > 0) faces.push({ a: [a[0], a[1]], b: [b[0], b[1]], lit: ny > 0 });
  }
  faces.sort((f, g) => f.a[0] + f.a[1] + f.b[0] + f.b[1] - (g.a[0] + g.a[1] + g.b[0] + g.b[1]));
  for (const f of faces) {
    const A = gp(f.a[0], f.a[1]);
    const B = gp(f.b[0], f.b[1]);
    polyS(p, [A, B, [B[0], B[1] + SLAB_T], [A[0], A[1] + SLAB_T]], f.lit ? T.faceL : T.faceR);
    const x0 = Math.min(A[0], B[0]);
    const x1 = Math.max(A[0], B[0]);
    const yAt = (x: number) => A[1] + ((B[1] - A[1]) * (x - A[0])) / (B[0] - A[0]);
    for (let x = Math.ceil(x0); x < Math.floor(x1); x++) {
      const yt = Math.round(yAt(x + 0.5) - 0.5);
      p.set(x, yt, f.lit ? T.faceLLip : T.faceRLip);
      p.set(x, yt + SLAB_T - 2, f.lit ? T.faceLLow : T.faceRLow);
      p.set(x, yt + SLAB_T - 1, T.faceBottom);
    }
  }
}

function drawTop(p: PixelCanvas): void {
  const corners = OUTLINE.map(([c, r]) => gp(c, r));
  const minX = Math.floor(Math.min(...corners.map((q) => q[0])));
  const maxX = Math.ceil(Math.max(...corners.map((q) => q[0])));
  const minY = Math.floor(Math.min(...corners.map((q) => q[1])));
  const maxY = Math.ceil(Math.max(...corners.map((q) => q[1])));
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const t = topAt(x, y);
      if (t) p.set(x, y, t.color);
    }
}

/** Draw background + board onto the 640×360 scene canvas. */
export function drawArena(p: PixelCanvas): void {
  drawBackground(p);
  drawGroundShadow(p);
  drawHull(p);
  drawFaces(p);
  drawTop(p);
}
