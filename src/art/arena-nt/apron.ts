// Neon Tower painter: APRON — the hall floor around and under the platform (docs/v3/ARENA_NEON_TOWER.md §2 / §16, J4 "mass").
// One opaque 640 × 210 texture over the lower part of the hall (y 150 … 360), drawn BELOW the stands (depth just above the
// wall's iso floor, which it continues on the same 64×32 grid):
//   - bevelled floor panels (lit upper edges, shaded lower edges, a dark groove between them), five variants: plain, riveted inset,
//     vent grate, lamp panel — the tone set steps up with the distance from the far hall (3 tiers) and the panels around the
//     platform take the owner's colour in flat bands (blue left / crimson right), seams first, then the panel fill;
//   - the FOOTING: a raised flange ring around the slab base (top face with an owner light line, a 4 px front face);
//   - the contact shadow: flat bands (the floor darkened one / two ladder steps, no dither, no alpha);
//   - two floor RAILS per side (cable channels running out from the platform along the grid axes, with an owner light core) and
//     their lamps; a few props (generator block, tank, bollards, hatches, a cable run) standing on the floor.
// Everything is data: the layer (view/board-nt/floor.ts) places the texture and animates the light strips / lamps.
// Pure PixelCanvas code (no Phaser): runs in Node for tests. Colours only from src/art/palette.ts (through NT_PAL).

import { FACE_H, NT_OX, NT_OY, PLATE_C0, PLATE_C1, PLATE_R0, PLATE_R1, PLATE_X0, PLATE_X1, PLATE_Y0, PLATE_Y1 } from '../../view/board-nt/layout-nt';
import { type Color, PixelCanvas } from '../pixel';
import { NT_PAL } from './palette';
import { type Atlas, Surface, packAtlas } from './platform-pack';

export const NT_APRON_KEY = 'nt:apron';
export const NT_APRON_FX_KEY = 'nt:apron:fx';

/** Screen rect the apron texture covers (the hall floor below the far stands / holograms). */
export const APRON_BOX = { x: 0, y: 150, w: 640, h: 210 } as const;

const M = NT_PAL.metal;
const INK = NT_PAL.ink;
const N0 = M[0];
const N1 = M[1];
const N2 = M[2];
const N3 = M[3];
const N4 = M[4];
const STEEL = M[5];
/** tone ladder, darkest first (the shadow may reach ink) */
const LADDER: readonly Color[] = [INK, N0, N1, N2, N3, N4, STEEL];
function shift(c: Color, d: number): Color {
  const i = LADDER.indexOf(c);
  return i < 0 ? c : LADDER[Math.max(0, Math.min(LADDER.length - 1, i + d))];
}

type Side = 0 | 1 | 2;
/** blue left of the near corner, crimson right, a short neutral stretch between */
const sideAtX = (x: number): Side => (x < 312 ? 0 : x > 328 ? 1 : 2);
const rampOf = (s: Side): readonly Color[] => (s === 0 ? NT_PAL.blue : s === 1 ? NT_PAL.red : [N0, N1, N2, N3, N4]);

function hash01(a: number, b: number, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2246822519) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- the slab's footprint

const S_FAR = (PLATE_Y0 - NT_OY) / 16;
const S_NEAR = (PLATE_Y1 - NT_OY) / 16;
const U_LEFT = (PLATE_X0 - NT_OX) / 32;
const U_RIGHT = (PLATE_X1 - NT_OX) / 32;

/**
 * Outward distance (px) of a ground point from the slab's BOTTOM outline (the top outline lowered by FACE_H): ≤ 0 inside (under the
 * slab), > 0 outside. Slanted and flat edges measure vertically, the end caps horizontally (same convention as platform.ts).
 */
function outsideOf(x: number, y: number): number {
  const ga = (x - NT_OX) / 32;
  const sum = (y - FACE_H - NT_OY) / 16;
  const c = (ga + sum) / 2;
  const r = (sum - ga) / 2;
  const s = c + r;
  const u = c - r;
  const m = Math.min((c - PLATE_C0) * 32, (PLATE_C1 - c) * 32, (r - PLATE_R0) * 32, (PLATE_R1 - r) * 32, (s - S_FAR) * 16, (S_NEAR - s) * 16, (u - U_LEFT) * 32, (U_RIGHT - u) * 32);
  return -m;
}

// ---------------------------------------------------------------- public result

export interface ApronStrip {
  /** frame name in the fx atlas (white mask of one light-strip piece) */
  frame: string;
  /** screen top-left of the mask */
  x: number;
  y: number;
  side: 0 | 1;
  /** rail index (0..3) and position along it, 0 = at the platform */
  rail: number;
  n: number;
}

export interface ApronLamp {
  x: number;
  y: number;
  side: 0 | 1;
  /** blink period, ms, and phase */
  period: number;
  phase: number;
  /** a 2×1 lamp (true) or a single pixel */
  wide: boolean;
}

export interface ApronArt {
  canvas: PixelCanvas;
  fx: Atlas;
  strips: ApronStrip[];
  lamps: ApronLamp[];
  ms: number;
}

let cached: ApronArt | null = null;

export function buildApronArt(): ApronArt {
  if (cached) return cached;
  const t0 = performance.now();
  const S = new Surface(APRON_BOX.x, APRON_BOX.y, APRON_BOX.w, APRON_BOX.h);
  const x1 = APRON_BOX.x + APRON_BOX.w;
  const y1 = APRON_BOX.y + APRON_BOX.h;
  for (let y = APRON_BOX.y; y < y1; y++) for (let x = APRON_BOX.x; x < x1; x++) S.put(x, y, floorPixel(x, y));
  const strips: ApronStrip[] = [];
  const masks: [string, PixelCanvas][] = [];
  const lamps: ApronLamp[] = [];
  paintRails(S, strips, masks, lamps);
  paintProps(S, lamps);
  const fx = packAtlas(masks, 256);
  cached = { canvas: S.canvas, fx, strips, lamps, ms: Math.round((performance.now() - t0) * 10) / 10 };
  return cached;
}

/** Skeleton-compatible painter. */
export function paintApron(): PixelCanvas {
  return buildApronArt().canvas;
}

// ---------------------------------------------------------------- floor panels, footing, shadow, glow

/** Footing top ring width (px outward), its front face height and the shadow / glow bands beyond. */
const FOOT = 10;
const FOOT_FACE = 4;
const SHADOW = 12;

/** Which tone table a panel uses: 0 = far (matches the hall floor), 1 = mid, 2 = near (richest). */
function tierOf(ccy: number): 0 | 1 | 2 {
  return ccy < 196 ? 0 : ccy < 232 ? 1 : 2;
}

function floorPixel(x: number, y: number): Color {
  const e = outsideOf(x + 0.5, y + 0.5);
  if (e <= 0) return INK; // under the slab (hidden)
  const side = sideAtX(x);
  const ramp = rampOf(side);
  // ---- the footing flange
  if (e <= FOOT) return footingTop(e, side, ramp);
  // its front face: this pixel is below the top region's lower boundary by 1..FOOT_FACE rows (a shift of d rows changes e by at most d)
  for (let d = 1; d <= FOOT_FACE && e <= FOOT + FOOT_FACE; d++) {
    if (outsideOf(x + 0.5, y + 0.5 - d) <= FOOT) {
      const lit = side === 0;
      return lit ? [N3, N2, N1, INK][d - 1] : [N2, N1, N0, INK][d - 1];
    }
  }
  // distance past the footing's front face (measured on the ground line shifted up by the face height)
  const q = outsideOf(x + 0.5, y + 0.5 - FOOT_FACE) - FOOT;
  return panel(x, y, q, side, ramp);
}

function footingTop(e: number, side: Side, ramp: readonly Color[]): Color {
  if (e <= 1) return INK;
  if (e <= 2) return N0;
  if (e <= 3) return N1;
  if (e <= 4) return ramp[2]; // the owner's light line around the base
  if (e <= 5) return ramp[0];
  if (e <= 6) return N2;
  if (e <= 8) return N3;
  if (e <= 9) return side === 0 ? STEEL : N4;
  return side === 0 ? N4 : N3; // the lit outer lip
}

interface PanelTones {
  fill: Color;
  seam: Color;
  hi: Color;
  lo: Color;
  inset: Color;
}

const TIERS: readonly PanelTones[] = [
  { fill: N0, seam: N1, hi: N1, lo: N0, inset: N0 },
  { fill: N0, seam: INK, hi: N2, lo: N0, inset: N1 },
  { fill: N1, seam: INK, hi: N3, lo: N0, inset: N2 },
];

/** One floor pixel: panel bevel / inset / variant detail, then the contact shadow and the owner glow on top of it. */
function panel(x: number, y: number, q: number, side: Side, ramp: readonly Color[]): Color {
  const ga = (x + 0.5 - NT_OX) / 32;
  const sum = (y + 0.5 - NT_OY) / 16;
  const col = Math.floor((ga + sum) / 2 + 0.5);
  const row = Math.floor((sum - ga) / 2 + 0.5);
  const ccx = NT_OX + (col - row) * 32;
  const ccy = NT_OY + (col + row) * 16;
  const px = x + 0.5 - ccx;
  const py = y + 0.5 - ccy;
  const dv = 16 - (Math.abs(px) / 2 + Math.abs(py));
  const t = TIERS[tierOf(ccy)];
  const near = tierOf(ccy) === 2;
  const variant = tierOf(ccy) === 0 ? 0 : Math.floor(hash01(col, row) * 8);
  const upper = py < 0;
  let c: Color;
  let kind: 'seam' | 'bevel' | 'fill' | 'inset' = 'fill';
  // big plates: 2×2 tiles share one plate; only the plate edges are deep grooves with a bevel, the joints inside are thin lines
  const nc = px < 0 ? (py < 0 ? col - 1 : col) : py < 0 ? col : col + 1;
  const nr = px < 0 ? (py < 0 ? row : row + 1) : py < 0 ? row - 1 : row;
  const plateEdge = Math.floor(nc / 2) !== Math.floor(col / 2) || Math.floor(nr / 2) !== Math.floor(row / 2);
  if (dv < 1) {
    c = plateEdge ? t.seam : shift(t.fill, tierOf(ccy) === 0 ? 1 : -1);
    kind = 'seam';
  } else if (dv < 2 && plateEdge && tierOf(ccy) > 0) {
    // bevel: the upper edges catch the light (the left one more), the lower edges are in shade
    c = upper ? (px < 0 ? t.hi : shift(t.hi, -1)) : px < 0 ? shift(t.lo, 0) : t.lo;
    kind = 'bevel';
  } else if (dv < 3 && plateEdge && near) {
    c = upper ? shift(t.fill, 1) : shift(t.fill, -1);
  } else {
    c = t.fill;
    // inset panels (variants 2..5): a recessed plate with a lit lower lip
    if (variant >= 2 && dv >= 5) {
      if (dv < 6) c = upper ? shift(t.inset, -1) : shift(t.inset, 1);
      else {
        c = t.inset;
        kind = 'inset';
        const ax = Math.abs(px);
        const ay = Math.abs(py);
        if (variant === 3) {
          // vent grate: slats along the iso diagonal
          if (dv >= 8) c = Math.floor(px / 2 + py + 64) % 3 === 0 ? INK : shift(t.inset, 1);
        } else if (variant === 4) {
          // four rivets at the vertices of the inset
          if ((ax > 17 && ax < 20 && ay < 1.2) || (ay > 6.5 && ay < 8.5 && ax < 1.6)) c = near ? STEEL : N3;
        } else if (variant === 5) {
          // a lamp window in the middle: owner colour by the side of the hall
          if (ax < 4 && ay < 2) c = ay < 1 && ax < 3 ? ramp[3] : ramp[1];
        }
      }
    }
  }
  // ---- contact shadow bands (flat, one / two ladder steps), then the owner glow (seams first, then the fill)
  if (q <= SHADOW) {
    const d = q <= 4 ? 3 : q <= 8 ? 2 : 1;
    return shift(c, -d);
  }
  const g = q - SHADOW;
  // the glow fades out toward the neutral middle of the near edge (flat steps, no dither)
  const fade = Math.floor(Math.abs(x - 320) / 12);
  const lv = Math.min(g <= 14 ? 3 : g <= 32 ? 2 : g <= 56 ? 1 : 0, fade);
  if (lv === 0) return c;
  if (kind === 'seam') return lv === 3 ? ramp[2] : lv === 2 ? ramp[1] : ramp[0];
  if (kind === 'bevel') return lv === 3 ? ramp[1] : lv === 2 ? ramp[0] : c;
  if (kind === 'fill') return lv === 3 ? ramp[0] : c;
  return lv === 3 ? ramp[0] : c;
}

// ---------------------------------------------------------------- rails

/** True where a floor pixel is clear of the slab, its footing and the footing's front face (props / rails may be painted there). */
const clearOfSlab = (x: number, y: number, pad = 2): boolean => outsideOf(x + 0.5, y + 0.5 - FOOT_FACE) > FOOT + pad;

interface RailDef {
  side: 0 | 1;
  /** start point (screen) at the footing and the slope sign (+0.5: runs down-right, −0.5: runs down-left) */
  x0: number;
  y0: number;
  dir: 1 | -1;
  /** length in px along x */
  len: number;
}

/** Light-strip piece length / gap along a rail, in px of x. */
const PIECE = 14;
const GAP = 2;

/**
 * Four cable channels run out from the slab along the grid axes (two per side): a lit upper lip, a dark groove, a core row in the
 * owner's colour split into pieces by clamps, a shaded lower lip. The core pieces are also cut as white masks for the layer's wave.
 */
function paintRails(S: Surface, strips: ApronStrip[], masks: [string, PixelCanvas][], lamps: ApronLamp[]): void {
  const rails: RailDef[] = [
    { side: 0, x0: 150, y0: 214, dir: -1, len: 150 }, // left face, c = 2
    { side: 0, x0: 214, y0: 246, dir: -1, len: 214 }, // left face, c = 4
    { side: 1, x0: 426, y0: 245, dir: 1, len: 214 }, // right face, r = 3
    { side: 1, x0: 490, y0: 213, dir: 1, len: 150 }, // right face, r = 1
  ];
  let frame = 0;
  rails.forEach((rl, k) => {
    const ramp = rl.side === 0 ? NT_PAL.blue : NT_PAL.red;
    const sl = rl.dir === 1 ? 0.5 : -0.5; // y change per px of x moving outward (x increases for the right rails)
    const sx = rl.dir === 1 ? 1 : -1;
    // piece n covers outward px [n * (PIECE + GAP), n * (PIECE + GAP) + PIECE)
    const piece = new Map<number, { x: number; y: number }[]>();
    for (let i = 0; i < rl.len; i++) {
      const x = rl.x0 + sx * i;
      const yc = Math.round(rl.y0 + i * 0.5);
      if (x < 0 || x >= 640) continue;
      const n = Math.floor(i / (PIECE + GAP));
      const inPiece = i % (PIECE + GAP) < PIECE;
      const clamp = !inPiece;
      for (let dy = -3; dy <= 3; dy++) {
        const y = yc + dy;
        if (y < APRON_BOX.y || y >= APRON_BOX.y + APRON_BOX.h || !clearOfSlab(x, y)) continue;
        let c: Color;
        if (clamp) c = dy === -3 ? N3 : dy === 3 ? N0 : dy === 0 ? N2 : dy < 0 ? N2 : N1;
        else c = dy === -3 ? N3 : dy === -2 ? INK : dy === -1 ? ramp[0] : dy === 0 ? ramp[1] : dy === 1 ? ramp[0] : dy === 2 ? INK : N1;
        S.put(x, y, c);
        if (inPiece && dy === 0) {
          const arr = piece.get(n) ?? [];
          arr.push({ x, y });
          piece.set(n, arr);
        }
      }
    }
    for (const [n, px] of [...piece.entries()].sort((a, b) => a[0] - b[0])) {
      if (px.length < 4) continue;
      const mx = Math.min(...px.map((q) => q.x));
      const my = Math.min(...px.map((q) => q.y));
      const m = new PixelCanvas(Math.max(...px.map((q) => q.x)) - mx + 1, Math.max(...px.map((q) => q.y)) - my + 1);
      for (const q of px) m.set(q.x - mx, q.y - my, 0xffffff);
      const name = `rail:${frame++}`;
      masks.push([name, m]);
      strips.push({ frame: name, x: mx, y: my, side: rl.side, rail: k, n });
    }
    // an end cap lamp at the rail's far end
    const xe = rl.x0 + sx * (rl.len - 4);
    if (xe > 2 && xe < 636) lamps.push({ x: xe, y: Math.round(rl.y0 + (rl.len - 4) * 0.5), side: rl.side, period: 2400 + k * 700, phase: k * 900, wide: true });
  });
}

// ---------------------------------------------------------------- props

/** An isometric machine block: base diamond (2·hw × 2·hh) centred (cx, cy), `h` px tall, ink outline; the left face lit, the right shaded. */
function block(S: Surface, cx: number, cy: number, hw: number, hh: number, h: number, side: 0 | 1, kind: 'vent' | 'lamp' | 'panel'): void {
  const p = new PixelCanvas(2 * hw + 4, 2 * hh + h + 4);
  const ox = cx - hw - 2;
  const oy = cy - hh - h - 2;
  const lx = (x: number): number => x - ox;
  const ly = (y: number): number => y - oy;
  const top = cy - h;
  const ramp = side === 0 ? NT_PAL.blue : NT_PAL.red;
  p.poly([[lx(cx - hw), ly(cy)], [lx(cx), ly(cy + hh)], [lx(cx), ly(cy + hh - h)], [lx(cx - hw), ly(top)]], N3);
  p.poly([[lx(cx), ly(cy + hh)], [lx(cx + hw), ly(cy)], [lx(cx + hw), ly(top)], [lx(cx), ly(cy + hh - h)]], N2);
  p.poly([[lx(cx - hw), ly(top)], [lx(cx), ly(top - hh)], [lx(cx + hw), ly(top)], [lx(cx), ly(top + hh)]], N4);
  // face shading bands: the lower third of each face one tone down, a base plinth
  for (let i = 1; i < hw; i++) {
    const yl = cy + Math.floor(i / 2) - 1;
    p.vline(lx(cx - i), ly(yl - 2), ly(yl), N2);
    p.vline(lx(cx + i), ly(yl - 2 - 0), ly(yl), N1);
  }
  // top: an inset plate and a rim
  p.poly([[lx(cx - hw + 5), ly(top)], [lx(cx), ly(top - hh + 2)], [lx(cx + hw - 5), ly(top)], [lx(cx), ly(top + hh - 2)]], N3);
  p.line(lx(cx - hw), ly(top), lx(cx), ly(top - hh), STEEL);
  p.line(lx(cx), ly(top - hh), lx(cx + hw), ly(top), N4);
  p.vline(lx(cx), ly(cy + hh - h), ly(cy + hh), N4);
  // fixtures on the left face: vent slats, a lamp window or two panel lines
  const fx0 = lx(cx - hw + 3);
  const fx1 = lx(cx - 4);
  for (let x = fx0; x <= fx1; x++) {
    const yy = ly(cy - h / 2 + 2 + Math.floor((x - fx0) / 2));
    if (kind === 'vent') {
      for (const d of [-3, -1, 1, 3]) p.set(x, yy + d, INK);
      for (const d of [-2, 0, 2]) p.set(x, yy + d, N4);
    } else if (kind === 'lamp') {
      p.set(x, yy - 1, ramp[1]);
      p.set(x, yy, ramp[3]);
      p.set(x, yy + 1, ramp[1]);
    } else {
      p.set(x, yy - 2, INK);
      p.set(x, yy + 2, INK);
      p.set(x, yy - 1, N4);
    }
  }
  // the right face: a dim owner line near the top and rivets
  for (let x = lx(cx + 3); x <= lx(cx + hw - 3); x++) p.set(x, ly(cy - h + 4 + Math.floor((cx + hw - lx(x) - ox) / 2) * 0 - Math.floor((x - lx(cx)) / 2) + hh), ramp[0]);
  p.outline(INK);
  for (let j = 0; j < p.h; j++)
    for (let i = 0; i < p.w; i++) {
      const c = p.get(i, j);
      if (c !== null && clearOfSlab(ox + i, oy + j, 0)) S.put(ox + i, oy + j, c);
    }
}

/** A short post with a beacon lamp on top (the lamp is registered for the layer's blink). */
function bollard(S: Surface, x: number, y: number, side: 0 | 1, lamps: ApronLamp[], phase: number): void {
  const ramp = side === 0 ? NT_PAL.blue : NT_PAL.red;
  // base ellipse shadow, post (3 wide, 9 tall), cap
  for (let i = -3; i <= 3; i++) S.put(x + i, y + 1, i === -3 || i === 3 ? INK : N0);
  for (let i = -2; i <= 2; i++) S.put(x + i, y + 2, INK);
  for (let j = 0; j < 9; j++) {
    S.put(x - 2, y - j, INK);
    S.put(x - 1, y - j, j % 4 === 3 ? N2 : N4);
    S.put(x, y - j, j % 4 === 3 ? N1 : N3);
    S.put(x + 1, y - j, j % 4 === 3 ? N0 : N2);
    S.put(x + 2, y - j, INK);
  }
  for (let i = -2; i <= 2; i++) S.put(x + i, y - 9, INK);
  S.put(x - 1, y - 10, INK);
  S.put(x, y - 10, ramp[2]);
  S.put(x + 1, y - 10, INK);
  S.put(x, y - 11, INK);
  lamps.push({ x: x - 1, y: y - 10, side, period: 2600 + phase * 330, phase: phase * 410, wide: true });
}

/** A flush floor hatch (a flat diamond with a lit lip, a handle bar and two lamps). */
function hatch(S: Surface, cx: number, cy: number, hw: number, hh: number, side: 0 | 1): void {
  const ramp = side === 0 ? NT_PAL.blue : NT_PAL.red;
  for (let y = cy - hh - 1; y <= cy + hh + 1; y++)
    for (let x = cx - hw - 2; x <= cx + hw + 2; x++) {
      if (!clearOfSlab(x, y, 0)) continue;
      const dv = hh - (Math.abs(x + 0.5 - cx) * (hh / hw) + Math.abs(y + 0.5 - cy));
      if (dv < -1) continue;
      let c: Color;
      if (dv < 0) c = INK;
      else if (dv < 1) c = y < cy ? N4 : N0;
      else if (dv < 2) c = y < cy ? N3 : N1;
      else c = N2;
      if (dv >= 2 && Math.abs(y + 0.5 - cy) < 0.6 && Math.abs(x + 0.5 - cx) < hw * 0.5) c = STEEL;
      if (dv >= 2 && Math.abs(y + 0.5 - cy) < 1.6 && Math.abs(Math.abs(x + 0.5 - cx) - hw * 0.62) < 1.2) c = ramp[2];
      S.put(x, y, c);
    }
}

/** A cable run: a ground-hugging bundle (ink outline, two tones, a lit top line) along a polyline. */
function cable(S: Surface, pts: readonly [number, number][]): void {
  const p = new PixelCanvas(640, 360);
  for (let i = 0; i + 1 < pts.length; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    p.line(a[0], a[1] + 1, b[0], b[1] + 1, INK);
    p.line(a[0], a[1] - 1, b[0], b[1] - 1, INK);
  }
  for (let i = 0; i + 1 < pts.length; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    p.line(a[0], a[1], b[0], b[1], N1);
    p.line(a[0], a[1] - 1, b[0], b[1] - 1 + 0, N3);
  }
  for (let j = 0; j < 360; j++)
    for (let i = 0; i < 640; i++) {
      const c = p.get(i, j);
      if (c !== null && j >= APRON_BOX.y && clearOfSlab(i, j, 0)) S.put(i, j, c);
    }
}

function paintProps(S: Surface, lamps: ApronLamp[]): void {
  // hatches and cable runs first (flat), then the standing things back to front
  hatch(S, 168, 322, 18, 9, 0);
  hatch(S, 470, 330, 18, 9, 1);
  cable(S, [[132, 292], [146, 299], [160, 298], [176, 306], [188, 305]]);
  cable(S, [[452, 294], [466, 301], [480, 300], [494, 307]]);
  block(S, 66, 304, 22, 11, 20, 0, 'vent');
  block(S, 604, 292, 22, 11, 22, 1, 'lamp');
  block(S, 100, 346, 14, 7, 12, 0, 'panel');
  block(S, 540, 340, 14, 7, 12, 1, 'vent');
  bollard(S, 125, 268, 0, lamps, 0);
  bollard(S, 181, 296, 0, lamps, 1);
  bollard(S, 442, 304, 1, lamps, 2);
  bollard(S, 506, 271, 1, lamps, 3);
}
