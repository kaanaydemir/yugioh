// Neon Tower painter: APRON — the hall floor around and under the platform.
// Readability pass: darker, lower contrast, desaturated floor and props around the platform so the duel board stands out.

import { FACE_H, NT_OX, NT_OY, PLATE_C0, PLATE_C1, PLATE_R0, PLATE_R1, PLATE_TABS, PLATE_X0, PLATE_X1, PLATE_Y0, PLATE_Y1 } from '../../view/board-nt/layout-nt';
import { type Color, PixelCanvas } from '../pixel';
import { PAL } from '../palette';
import { NT_PAL } from './palette';
import { type Atlas, Surface, packAtlas } from './platform-pack';
import { hallFloorPixel, warmPixel } from './hallfloor';

// arena v3 pass "floor and braziers" (2026-11-06): the hall floor pattern (flags, plates, grates, pipes, brazier pools)
// comes from ./hallfloor.ts in final colours; the old rails / blocks / bollards are no longer painted into the floor
// (their strip + lamp descriptors are still built for the floor layer, which keeps them hidden).
const V3_HALL_FLOOR = true;

export const NT_APRON_KEY = 'nt:apron';
export const NT_APRON_FX_KEY = 'nt:apron:fx';

export const APRON_BOX = { x: 0, y: 150, w: 640, h: 210 } as const;

const M = NT_PAL.metal;
const INK = NT_PAL.ink;
const N0 = M[0];
const N1 = M[1];
const N2 = M[2];

const LADDER: readonly Color[] = [INK, N0, N1, N2];
function shift(c: Color, d: number): Color {
  const i = LADDER.indexOf(c);
  return i < 0 ? c : LADDER[Math.max(0, Math.min(LADDER.length - 1, i + d))];
}

const S_FAR = (PLATE_Y0 - NT_OY) / 16;
const S_NEAR = (PLATE_Y1 - NT_OY) / 16;
const U_LEFT = (PLATE_X0 - NT_OX) / 32;
const U_RIGHT = (PLATE_X1 - NT_OX) / 32;

function outsideOf(x: number, y: number): number {
  const ga = (x - NT_OX) / 32;
  const sum = (y - FACE_H - NT_OY) / 16;
  const c = (ga + sum) / 2;
  const r = (sum - ga) / 2;
  const s = c + r;
  const u = c - r;
  let m = Math.min((c - PLATE_C0) * 32, (PLATE_C1 - c) * 32, (r - PLATE_R0) * 32, (PLATE_R1 - r) * 32, (s - S_FAR) * 16, (S_NEAR - s) * 16, (u - U_LEFT) * 32, (U_RIGHT - u) * 32);
  // arena v5 step 2: the dais tabs are part of the stage's footprint
  for (const t of PLATE_TABS) m = Math.max(m, Math.min((c - t.c0) * 32, (t.c1 - c) * 32, (r - t.r0) * 32, (t.r1 - r) * 32));
  return -m;
}

export interface ApronStrip {
  frame: string;
  x: number;
  y: number;
  side: 0 | 1;
  rail: number;
  n: number;
}

export interface ApronLamp {
  x: number;
  y: number;
  side: 0 | 1;
  period: number;
  phase: number;
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
  // the brazier pools also light the stage's cast shadow (painted after the floor)
  if (V3_HALL_FLOOR) S.canvas.map((c, x, y) => warmPixel(c, x + APRON_BOX.x, y + APRON_BOX.y));
  const fx = packAtlas(masks, 256);
  cached = { canvas: S.canvas, fx, strips, lamps, ms: Math.round((performance.now() - t0) * 10) / 10 };
  return cached;
}

export function paintApron(): PixelCanvas {
  return buildApronArt().canvas;
}

const FOOT = 10;
const FOOT_FACE = 4;
// hedef-gorunum-3: a wider, darker cast shadow of the raised stage on the hall floor
const SHADOW = 30;
const SHADE: Color = PAL.stone0;
const SHADOW_DX = 8;
const SHADOW_DY = 4;
const STAGE_FOOT_SHADOW = true;

function floorPixel(x: number, y: number): Color {
  const e = outsideOf(x + 0.5, y + 0.5);
  if (e <= 0) return INK;
  // hedef-gorunum-3: the dark cast shadow starts right at the wall's base (no lit footing ring between them)
  if (STAGE_FOOT_SHADOW && e <= FOOT + FOOT_FACE) return SHADE;
  if (!STAGE_FOOT_SHADOW) {
    if (e <= FOOT) return footingTop(e);
    for (let d = 1; d <= FOOT_FACE && e <= FOOT + FOOT_FACE; d++) {
      if (outsideOf(x + 0.5, y + 0.5 - d) <= FOOT) {
        return [N1, N0, INK, INK][d - 1];
      }
    }
  }
  // round 2: the cast shadow is offset toward the lower right (away from the top-left key light): measured from the slab's
  // base shifted by (SHADOW_DX, SHADOW_DY), so it is widest right of the right wall / below the near corner
  const q = outsideOf(x + 0.5 - SHADOW_DX, y + 0.5 - FOOT_FACE - SHADOW_DY) - FOOT;
  return panel(x, y, q);
}

function footingTop(e: number): Color {
  if (e <= 2) return INK;
  if (e <= 5) return N0;
  if (e <= 8) return N1;
  return N0;
}

function panel(x: number, y: number, q: number): Color {
  const ga = (x + 0.5 - NT_OX) / 32;
  const sum = (y + 0.5 - NT_OY) / 16;
  const col = Math.floor((ga + sum) / 2 + 0.5);
  const row = Math.floor((sum - ga) / 2 + 0.5);
  const ccx = NT_OX + (col - row) * 32;
  const ccy = NT_OY + (col + row) * 16;
  const px = x + 0.5 - ccx;
  const py = y + 0.5 - ccy;
  const dv = 16 - (Math.abs(px) / 2 + Math.abs(py));
  const nc = px < 0 ? (py < 0 ? col - 1 : col) : py < 0 ? col : col + 1;
  const nr = px < 0 ? (py < 0 ? row : row + 1) : py < 0 ? row - 1 : row;
  const plateEdge = Math.floor(nc / 2) !== Math.floor(col / 2) || Math.floor(nr / 2) !== Math.floor(row / 2);
  let c: Color = N0;
  if (dv < 1) {
    c = plateEdge ? INK : N0;
  } else if (dv < 2 && plateEdge && py < 0) {
    c = N1;
  }
  if (V3_HALL_FLOOR) c = hallFloorPixel(x, y);
  if (q <= SHADOW) {
    // stepped falloff (no blur): solid shade near the stage, then a checker, then a sparse 1-in-4 dither. The shade is
    // stone0 — off the night ladder, so the apron's lift remap (view/board-nt/calm-remap.ts) keeps it dark (ink / night
    // tones would be lifted three steps and the shadow vanished).
    // round 2: a wide SOLID band (12 px past the footing), then only a 2-step fringe (checker 2 px, sparse 2 px) — no wide
    // screen-door band next to the stage
    if (q <= 12) return SHADE;
    if (q <= 14) return (x + y) % 2 === 0 ? SHADE : c;
    if (q <= 16) return x % 2 === 0 && y % 2 === 0 ? SHADE : c;
    // round 4: the round-3 1-px lighter floor rim outside the fringe was removed (invisible under the light layer; a
    // pointless pixel row — critique 3/3 #6)
    return c;
  }
  return c;
}

const clearOfSlab = (x: number, y: number, pad = 2): boolean => outsideOf(x + 0.5, y + 0.5 - FOOT_FACE) > FOOT + pad;

interface RailDef {
  side: 0 | 1;
  x0: number;
  y0: number;
  dir: 1 | -1;
  len: number;
}

const PIECE = 14;
const GAP = 2;

function paintRails(S: Surface, strips: ApronStrip[], masks: [string, PixelCanvas][], lamps: ApronLamp[]): void {
  const rails: RailDef[] = [
    { side: 0, x0: 150, y0: 214, dir: -1, len: 150 },
    { side: 0, x0: 214, y0: 246, dir: -1, len: 214 },
    { side: 1, x0: 426, y0: 245, dir: 1, len: 214 },
    { side: 1, x0: 490, y0: 213, dir: 1, len: 150 },
  ];
  let frame = 0;
  rails.forEach((rl, k) => {
    const sx = rl.dir === 1 ? 1 : -1;
    const piece = new Map<number, { x: number; y: number }[]>();
    for (let i = 0; i < rl.len; i++) {
      const x = rl.x0 + sx * i;
      const yc = Math.round(rl.y0 + i * 0.5);
      if (x < 0 || x >= 640) continue;
      const n = Math.floor(i / (PIECE + GAP));
      const inPiece = i % (PIECE + GAP) < PIECE;
      const clamp = !inPiece;
      for (let dy = -2; dy <= 2; dy++) {
        const y = yc + dy;
        if (y < APRON_BOX.y || y >= APRON_BOX.y + APRON_BOX.h || !clearOfSlab(x, y)) continue;
        const c: Color = clamp ? N0 : dy === 0 ? N1 : INK;
        if (!V3_HALL_FLOOR) S.put(x, y, c);
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
    const xe = rl.x0 + sx * (rl.len - 4);
    if (xe > 2 && xe < 636) lamps.push({ x: xe, y: Math.round(rl.y0 + (rl.len - 4) * 0.5), side: rl.side, period: 2400 + k * 700, phase: k * 900, wide: true });
  });
}

function block(S: Surface, cx: number, cy: number, hw: number, hh: number, h: number): void {
  const p = new PixelCanvas(2 * hw + 4, 2 * hh + h + 4);
  const ox = cx - hw - 2;
  const oy = cy - hh - h - 2;
  const lx = (x: number): number => x - ox;
  const ly = (y: number): number => y - oy;
  const top = cy - h;
  p.poly([[lx(cx - hw), ly(cy)], [lx(cx), ly(cy + hh)], [lx(cx), ly(cy + hh - h)], [lx(cx - hw), ly(top)]], N1);
  p.poly([[lx(cx), ly(cy + hh)], [lx(cx + hw), ly(cy)], [lx(cx + hw), ly(top)], [lx(cx), ly(cy + hh - h)]], N0);
  p.poly([[lx(cx - hw), ly(top)], [lx(cx), ly(top - hh)], [lx(cx + hw), ly(top)], [lx(cx), ly(top + hh)]], N1);
  p.line(lx(cx - hw), ly(top), lx(cx), ly(top - hh), N2);
  p.outline(INK);
  for (let j = 0; j < p.h; j++)
    for (let i = 0; i < p.w; i++) {
      const c = p.get(i, j);
      if (c !== null && clearOfSlab(ox + i, oy + j, 0)) S.put(ox + i, oy + j, c);
    }
}

function bollard(S: Surface, x: number, y: number, side: 0 | 1, lamps: ApronLamp[], phase: number): void {
  for (let j = 0; j < 8; j++) {
    S.put(x - 1, y - j, N1);
    S.put(x, y - j, N0);
    S.put(x + 1, y - j, INK);
  }
  lamps.push({ x: x - 1, y: y - 9, side, period: 2600 + phase * 330, phase: phase * 410, wide: true });
}

function paintProps(S: Surface, lamps: ApronLamp[]): void {
  if (V3_HALL_FLOOR) {
    // the floor's own props live in ./hallfloor.ts; the bollard lamp descriptors stay (hidden by the floor layer)
    const none = new Surface(0, 0, 1, 1);
    for (const [x, y, k] of [[125, 268, 0], [181, 296, 1], [442, 304, 2], [506, 271, 3]] as const) bollard(none, x, y, k < 2 ? 0 : 1, lamps, k);
    return;
  }
  block(S, 66, 304, 22, 11, 18);
  block(S, 604, 292, 22, 11, 18);
  block(S, 100, 346, 14, 7, 10);
  block(S, 540, 340, 14, 7, 10);
  bollard(S, 125, 268, 0, lamps, 0);
  bollard(S, 181, 296, 0, lamps, 1);
  bollard(S, 442, 304, 1, lamps, 2);
  bollard(S, 506, 271, 1, lamps, 3);
}
