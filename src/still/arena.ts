// Neon Düello still preview — a calm, simplified version of the ORIGINAL v1 arena: the same board
// geometry (5×5 grid of 64×32 tiles from src/view/layout.ts, the same 20 zones + the bridge row, the
// original slab outline with its two notched podium pads, slab thickness and stepped hull + keel —
// see arena-geom.ts) drawn as a dark matte slab: flat navy zone pads with ONE thin player-coloured
// outline each (cyan P1 / bordeaux P2), anthracite border + bridge, darker recessed pile pads, ONE
// neon trim along the platform edge (full strength on the camera-facing edges, one tone down on the
// back edges), a lit top rim, side faces darker than the top (a lit lip on the left faces), and a
// hull that darkens away from the light: one lit tier band over a darker keel spike.
// Background: an ink sky with one violet haze band on the stadium roof, the roof as one ink band, the
// stadium ring as two calm masses (a lighter upper tier over a darker lower tier that runs on into
// the inner wall), and the arena floor far below as one dark disc whose far rim sits under the keel,
// so the hull and the keel's lit facet hang against the ink ground and read as shapes.
//
// Removed from the original: tile icons / nested frames / crosses, the dotted bridge stream, ruler
// ticks, corner jewels, podium hologram rings, face indicator lights + vents + panel seams, the energy
// core + light shaft, crowd lights, seat rows + aisles, LED ribbon, searchlight beams, floodlight
// masts + lamp banks, aurora, nebula + star field, the floor's dashed glow ring, radial floor lines
// and cyan / red floor glows.
// Every colour is a PAL entry; no blending, no dithering — flat tone bands only.

import { PAL } from '../art/palette';
import type { Color, PixelCanvas, Pt } from '../art/pixel';
import { cellKind, isoToScreen, zoneAtCell, zoneXY, type XY } from '../view/layout';
import {
  G0,
  G1,
  HULL,
  KEEL_TIP,
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
  // background: ink sky with one violet haze band on the roof, the roof as one ink band, the stadium
  // as two calm masses (lighter upper tier, darker lower tier that runs on down into the inner wall)
  sky: PAL.ink,
  haze: PAL.void0,
  canopy: PAL.ink,
  stands: PAL.night1,
  standsLow: PAL.night0,
  ground: PAL.ink,
  floorDisc: PAL.night0,
  // hull (under the slab) — kept dark, it reads as a silhouette, and darkens away from the light as in
  // the original: tier 1 is the one lit band, tier 2 + the keel spike sit one step darker
  hullL: PAL.night1, // tier 1, lit side
  hullR: PAL.ink, // the shadow side: it sinks into the ink ground (a lost edge, as the light demands)
  hullRLip: PAL.night0,
  hullEdge: PAL.ink, // 1-px ink bottom edge: keeps the keel's point outlined where it dips into the floor disc
  keelL: PAL.night0, // tier 2 + keel spike, lit facet
  keelR: PAL.ink,
  keelRidge: PAL.night2,
  // slab side faces: the lower-left faces catch the top-left key light (a 1-px lit lip under the rim),
  // the lower-right ones don't; both stay darker than the top so the top reads as the lit plane
  faceLLip: PAL.night2,
  faceL: PAL.night1,
  faceR: PAL.night0,
  faceBottom: PAL.ink,
  // top surface. Rim: the 1-px outer edge; brightest on the camera-facing (front) edges, one step
  // down on the back edges so nothing bright runs behind the monsters' heads.
  rimBackL: PAL.night3, // edge facing the light
  rimBackR: PAL.night2,
  rimFrontL: PAL.night3,
  rimFrontR: PAL.night2,
  border: PAL.stone0,
  join: PAL.night0,
  pad: PAL.night1,
  pile: PAL.night0,
  bridge: PAL.stone0,
  // neon (never brighter than the monsters): full strength on the front edges, one tone down behind
  trim: [PAL.cyan2, PAL.crim2, PAL.night3] as const,
  trimBack: [PAL.cyan1, PAL.crim1, PAL.night2] as const,
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

/** Grid rows of the gutters along the bridge row (between rows 1|2 and 2|3). */
const BRIDGE_SEAMS = [1.5, 2.5];

/** Trim band: between these insets (vertical px from the outer edge). */
const TRIM_IN = insetOutline(OUTLINE, 3 / 32);
const TRIM_OUT = insetOutline(OUTLINE, 4 / 32);

// ---------------------------------------------------------------- top surface

export type TopKind = 'rim' | 'border' | 'trim' | 'join' | 'gap' | 'pad' | 'pile' | 'line' | 'bridge';

/** The platform top at (x, y) before the trim-tip clean-up (see topAt). */
function rawTop(x: number, y: number): { kind: TopKind; color: Color } | null {
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
    const fill = main ? T.pad : T.pile;
    // the 1-px ring between the join and the zone line is pad-coloured but its own kind, so a light
    // pool on the pad stops at the line instead of speckling the ring outside it
    const gap = { kind: 'gap' as const, color: fill };
    if (dv < 2) return gap;
    if (dv < 3) {
      // the zone line's left / right tip ends in a 1-px wide, 2-row point (not a 2×2 block)
      if (Math.abs(y + 0.5 - c.y) === 0.5 && Math.abs(x + 0.5 - c.x) > 26) return gap;
      return { kind: 'line', color: T.line[z.player] };
    }
    return main ? { kind: 'pad', color: fill } : { kind: 'pile', color: fill };
  }
  const { d, nx, ny } = outlineDist(g.col, g.row);
  if (d * 32 < 1) {
    const color = nx < 0 ? T.rimBackL : ny < 0 ? T.rimBackR : ny > 0 ? T.rimFrontL : T.rimFrontR;
    return { kind: 'rim', color };
  }
  // two large panel joins per side: the bridge row's gutters run on across the border to the rim,
  // so the trim changes colour (player / neutral / player) at a physical seam, not mid-line
  if ((g.col < -0.5 || g.col > 4.5) && BRIDGE_SEAMS.some((r) => Math.abs(g.row - r) * 32 < 1)) return { kind: 'join', color: T.join };
  if (insidePoly(TRIM_IN, g.col, g.row) && !insidePoly(TRIM_OUT, g.col, g.row)) {
    const back = nx < 0 || ny < 0; // nearest edge faces away from the camera
    return { kind: 'trim', color: (back ? T.trimBack : T.trim)[rowSide(g.row)] };
  }
  return { kind: 'border', color: T.border };
}

const isTrim = (x: number, y: number): boolean => rawTop(x, y)?.kind === 'trim';

/**
 * Where the trim turns at a left / right tip it rasterises as a 2×2 block. The outer column of that
 * block is dropped, so every tip ends in a 1-px wide point that still joins both stairs diagonally.
 */
function trimTipOuter(x: number, y: number): boolean {
  if (!isTrim(x, y - 1) && !isTrim(x, y + 1)) return false;
  const l = isTrim(x - 1, y);
  const r = isTrim(x + 1, y);
  if (r && !l) return !isTrim(x - 1, y - 1) && !isTrim(x - 1, y + 1);
  if (l && !r) return !isTrim(x + 1, y - 1) && !isTrim(x + 1, y + 1);
  return false;
}

/** What the platform top shows at screen pixel (x, y), or null off the top surface. */
export function topAt(x: number, y: number): { kind: TopKind; color: Color } | null {
  const t = rawTop(x, y);
  if (t && t.kind === 'trim' && trimTipOuter(x, y)) return { kind: 'border', color: T.border };
  return t;
}

/** True on the platform's top surface (where floor light / contact shadows may fall). */
export function onPlatformTop(x: number, y: number): boolean {
  return topAt(x, y) !== null;
}

// ---------------------------------------------------------------- background

/** Depth of the violet haze band above the stadium roof (px at the roof's peak). */
const HAZE_H = 36;

/**
 * The arena floor far below, as one ellipse (screen px). Its far rim passes just above the keel's tip:
 * the hull and the keel's lit facet hang against the ink ground (so the night0 facet reads), only the
 * last px of the point reach the disc, where the ink shadow facet reads against it.
 */
const FLOOR = { cx: 320, cy: 353, rx: 310, ry: 51 } as const;

/**
 * A gentle, large-scale undulation (fractional px) for hand-shaped band edges. Sum the terms and
 * round ONCE: rounding each term on its own makes the edge flick up and down by 1 px.
 */
function wave(x: number, amp: number, period: number, phase: number): number {
  return amp * Math.sin((x / period + phase) * Math.PI * 2);
}

function drawBackground(p: PixelCanvas): void {
  for (let x = 0; x < p.w; x++) {
    const top = rimY(x + 0.5);
    const bot = standsBottomY(x + 0.5);
    const yTop = Math.round(top) - 4;
    // the sky is one ink field with a faint violet haze sitting on the stadium roof. The haze is
    // deep enough that its upper edge stays above the monsters' horns (no band edge across a face).
    const hazeTop = Math.round(top - 4 - HAZE_H - wave(x, 3, 210, 0.15) - wave(x, 2, 97, 0.6));
    for (let y = 0; y < p.h; y++) {
      let c: Color;
      if (y < yTop) c = y < hazeTop ? T.sky : T.haze;
      else if (y < top) c = T.canopy; // the roof: one ink band, no lip line
      else if (y < bot + WALL_H) {
        // the stands as two flat masses: a lighter upper tier over a darker lower tier; the inner
        // wall below the stands is part of the lower mass (no shadow line, no seam)
        const t = (y + 0.5 - top) / (bot - top);
        c = t < 0.47 ? T.stands : T.standsLow;
      } else {
        // the arena floor far below: one large, slightly lighter disc (no ring line, no glow)
        const ex = (x + 0.5 - FLOOR.cx) / FLOOR.rx;
        const ey = (y + 0.5 - FLOOR.cy) / FLOOR.ry;
        c = ex * ex + ey * ey <= 1 ? T.floorDisc : T.ground;
      }
      p.set(x, y, c);
    }
  }
}

// ---------------------------------------------------------------- platform: hull, faces

/** Pixel row of the 2:1 edge A→B at column x (rounded so a run of columns forms clean stairs). */
function rowAt(A: Pt, B: Pt, x: number): number {
  return Math.round(A[1] + ((B[1] - A[1]) * (x + 0.5 - A[0])) / (B[0] - A[0]) - 0.5);
}

/** A vertical band hanging under the edge A→B, filled column by column (row k → colour). */
function band(p: PixelCanvas, A: Pt, B: Pt, h: number, colour: (k: number) => Color, lead = 0): void {
  const [L, R] = A[0] < B[0] ? [A, B] : [B, A];
  for (let x = Math.round(L[0]); x < Math.round(R[0]); x++) {
    const yt = rowAt(L, R, x);
    for (let k = -lead; k < h; k++) p.set(x, yt + k, colour(Math.max(0, k)));
  }
}

const rp = (q: Pt): Pt => [Math.round(q[0]), Math.round(q[1])];

/** The keel ridge ends this many px above the spike's tip. */
const RIDGE_GAP = 12;

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
  // keel spike under the last tier: two dark facets meeting in a lit ridge (no energy core, no beam)
  const last = tiers[tiers.length - 1];
  const spikeTop = last.top + last.t;
  const lft = rp(gp(G0 + last.inset, G1 - last.inset, spikeTop));
  const bot = rp(gp(G1 - last.inset, G1 - last.inset, spikeTop));
  const rgt = rp(gp(G1 - last.inset, G0 + last.inset, spikeTop));
  const apex: Pt = [KEEL_TIP.x, KEEL_TIP.y];
  // (the outer edge row of each facet is ink: the point stays outlined where it dips into the floor disc)
  for (let x = lft[0]; x < bot[0]; x++) {
    const yb = rowAt(lft, apex, x);
    for (let y = rowAt(lft, bot, x) - 2; y <= yb; y++) p.set(x, y, y === yb ? T.hullEdge : T.keelL);
  }
  // the ridge stops RIDGE_GAP px short of the tip: the point itself is where both facets' edges meet
  // in ink, so no lone lit line runs on into the floor
  const ridgeEnd = apex[1] - RIDGE_GAP;
  for (let x = bot[0]; x < rgt[0]; x++) {
    const yb = rowAt(apex, rgt, x);
    for (let y = rowAt(bot, rgt, x) - 2; y <= yb; y++)
      p.set(x, y, y === yb ? T.hullEdge : x === bot[0] && y < ridgeEnd ? T.keelRidge : T.keelR);
  }
  // stepped hull tiers (back one first). Only ONE step shows: tier 1 is the lit band right under the
  // slab; the last tier takes the keel's tones with no edge, so tier 2 + keel read as one darker
  // spike. No ink lines between the bands — the tone change is the step.
  for (let k = tiers.length - 1; k >= 0; k--) {
    const { inset, top, t } = tiers[k];
    const l = rp(gp(G0 + inset, G1 - inset, top));
    const b = rp(gp(G1 - inset, G1 - inset, top));
    const r = rp(gp(G1 - inset, G0 + inset, top));
    const keel = k === tiers.length - 1;
    // `lead` rows reach up under the tier / slab above so rounding never opens a 1px gap
    band(p, l, b, t, () => (keel ? T.keelL : T.hullL), 2);
    band(p, b, r, t, (j) => (keel ? T.keelR : j === 0 ? T.hullRLip : T.hullR), 2);
    if (keel) for (let y = b[1] - 2; y < b[1] + t; y++) p.set(b[0], y, T.keelRidge);
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
    const A = rp(gp(f.a[0], f.a[1]));
    const B = rp(gp(f.b[0], f.b[1]));
    // flat faces, no panel seams: the lit face has a 1-px lip right under the rim, both end in ink
    if (f.lit) band(p, A, B, SLAB_T, (k) => (k === SLAB_T - 1 ? T.faceBottom : k === 0 ? T.faceLLip : T.faceL));
    else band(p, A, B, SLAB_T, (k) => (k === SLAB_T - 1 ? T.faceBottom : T.faceR));
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
  drawHull(p);
  drawFaces(p);
  drawTop(p);
}
