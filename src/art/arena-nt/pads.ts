// Neon Tower painter: PADS (the duelists' corner pads) — owner A1 (docs/v3/ARENA_NEON_TOWER.md §2 / §3).
// Readability pass: calmer slate top, softer cyan (P1) / crimson (P2) border with less neon glow.
// Pure PixelCanvas code (no Phaser).

import { DUELIST_PADS, FACE_H, PLATE_OUTLINE, ntIso } from '../../view/board-nt/layout-nt';
import { PAL, RAMPS } from '../palette';
import { type Color, PixelCanvas } from '../pixel';
import { NT_PAL } from './palette';
import { type Atlas, packAtlas } from './platform-pack';

export const NT_PADS_KEY = 'nt:pads';

/**
 * Pad canvas: the rhombus + 1 px outline + its thickness; its rhombus centre is at (CX, CY) = the duelist's feet.
 * hedef-gorunum-3: the pad is the top of a 3-step dais (DAIS below), so the canvas is wider and taller.
 */
// critique round 2: the canvas also carries the stage protrusion / ledge the dais stands on (P1: a block out of the near-left
// wall with its own 46-px wall; P2: a ledge behind the far-right edge), so it is much larger; (cx, cy) is still the feet.
export const PAD_CANVAS = { w: 96, h: 98, cx: 47, cy: 16 } as const;

/**
 * hedef-gorunum-3 (arena pass, podiums): a chunky 2-step stone dais. The top step is the pad diamond (PAD_HALF), RISE px tall;
 * the lower step is STEP_W / STEP_H wider per side and LOW_RISE px tall. Slate stone faces (left riser lit, right shaded), the
 * player colour only as light: the top step's rim glows, the lower step's top edge carries a thin light line.
 */
export const DAIS = { steps: 2, stepW: 12, stepH: 6, rise: 5, lowRise: 4 } as const;

/** Half width / height of the pad rhombus (a 40×20 diamond) and its raised rim thickness (px). */
export const PAD_HALF = { w: 20, h: 10, thick: 5 } as const;

export const padFrame = (player: 0 | 1, level: number): string => `pad:${player}:${level}`;

const S = RAMPS.stone;

/** Distance (px, rows) inside a 2:1 diamond centred at (x, y) with half sizes (hw, hh); < 0 = outside. */
const inset = (i: number, j: number, x: number, y: number, hw: number, hh: number): number =>
  hh - (Math.abs(i + 0.5 - x) * (hh / hw) + Math.abs(j + 0.5 - y));

/**
 * One step: its riser (the lower half of the diamond extruded RISE px down) then its top face. `edge(dv, left, back)` colours the
 * top face's outer rows (null = plain face).
 */
function paintStep(
  p: PixelCanvas,
  y: number,
  hw: number,
  hh: number,
  rise: number,
  face: (i: number, j: number, dv: number) => Color,
  riser: (left: boolean, depth: number) => Color,
): void {
  const { cx } = PAD_CANVAS;
  for (let j = 0; j < p.h; j++)
    for (let i = 0; i < p.w; i++) {
      if (j + 0.5 <= y || inset(i, j, cx, y, hw, hh) >= 0) continue;
      for (let d = 1; d <= rise; d++)
        if (inset(i, j - d, cx, y, hw, hh) >= 0) {
          p.set(i, j, riser(i + 0.5 < cx, d));
          break;
        }
    }
  for (let j = 0; j < p.h; j++)
    for (let i = 0; i < p.w; i++) {
      const dv = inset(i, j, cx, y, hw, hh);
      if (dv >= 0) p.set(i, j, face(i, j, dv));
    }
}

/** Feet of each duelist in screen px (layout.duelistXY via DUELIST_PADS). */
const feetOf = (player: 0 | 1): { x: number; y: number } => ({ x: DUELIST_PADS[player].x + 28, y: DUELIST_PADS[player].y + 14 });

/**
 * The stage edge the dais sits on, as a screen line of slope +1/2 through A (P1: the near-left edge, P2: the far-right edge).
 * `o(x, y)` = rows below that line; `q(x, y)` = x/2 + y, constant along the perpendicular (slope -1/2) direction.
 */
function stageEdge(player: 0 | 1): { ax: number; ay: number } {
  const V = PLATE_OUTLINE.map(([c, r]) => ntIso(c, r));
  const a = player === 0 ? V[0] : V[3];
  return { ax: Math.round(a.x), ay: Math.round(a.y) };
}

const WALL_LIT = [PAL.stone2, PAL.stone1, PAL.stone2, PAL.stone1, PAL.stone0, PAL.stone2, PAL.stone1, PAL.stone0] as const;
const WALL_SHD = [PAL.stone1, PAL.stone0, PAL.stone1, PAL.stone0, NT_PAL.ink, PAL.stone1, PAL.stone0, NT_PAL.ink] as const;
const STRIP: Record<0 | 1, readonly [Color, Color, Color]> = {
  0: [PAL.cyan2, PAL.cyan1, PAL.cyan3],
  1: [PAL.crim2, PAL.crim1, PAL.crim3],
};
/** Wall rows of the stage (art/arena-nt/platform.ts paintFace, FACE_H = 46): coping, upper band, channel, main band, belt. */
function wallTone(v: number, lit: boolean, player: 0 | 1, lx: number): Color {
  const W = lit ? WALL_LIT : WALL_SHD;
  const T = STRIP[player];
  const INK = NT_PAL.ink;
  if (lx === 0 && v >= 3) return INK;
  if (v < 3) return v === 0 ? W[0] : v === 1 ? W[1] : INK;
  if (v < 14) return v === 3 || (lx === 1 && v < 13) ? W[2] : v < 13 ? W[3] : W[4];
  if (v === 14 || v === 15 || v === 18) return INK;
  if (v === 16) return lx <= 1 ? NT_PAL.metal[0] : T[0];
  if (v === 17) return lx <= 1 ? NT_PAL.metal[0] : T[1];
  if (v < FACE_H - 7) return v === 19 || (lx === 1 && v < FACE_H - 9) ? W[5] : v < FACE_H - 9 ? W[6] : W[7];
  const u = v - (FACE_H - 7);
  return u === 0 ? INK : u === 1 ? W[1] : u === 2 ? W[6] : u < 5 ? NT_PAL.metal[0] : INK;
}

/**
 * critique round 2 (#1 / #2): the stone the dais stands on, so it is attached to the stage and never floats. P1: a block out of the
 * near-left wall (top flush with the stage top, the gold bevel running round its three outer edges, its front face and shaded right
 * face carrying the stage's wall rows, panel seam and two cyan windows, a hard contact line on the floor). P2: a ledge out of the
 * far-right edge (top + the visible sliver of its shaded right face, cut by the stage top in front of it). Both cover the stage's
 * own bevel where they join it, so the stage reads as one block with a bump.
 */
function paintBase(p: PixelCanvas, player: 0 | 1, foot: { x: number; y: number; hw: number; hh: number }): void {
  const { cx, cy } = PAD_CANVAS;
  const f = feetOf(player);
  const ox = f.x - cx;
  const oy = f.y - cy;
  const { ax, ay } = stageEdge(player);
  const oOf = (x: number, y: number): number => y - (ay + (x - ax) / 2);
  const qOf = (x: number, y: number): number => x / 2 + y;
  const fx = foot.x + ox;
  const fy = foot.y + oy;
  const m = 3;
  const qc = qOf(fx, fy);
  const oc = oOf(fx, fy);
  const q0 = Math.floor(qc - foot.hh - m);
  const q1 = Math.ceil(qc + foot.hh + m);
  // P1 grows out (o > 0) and covers the stage rim rows inside (o down to -3); P2 grows back (o < 0) and covers o up to +2
  const oLo = player === 0 ? -3.5 : Math.floor(oc - foot.hh - m);
  const oHi = player === 0 ? Math.ceil(oc + foot.hh + m) : 2.5;
  const inTop = (x: number, y: number): boolean => {
    const o = oOf(x + 0.5, y + 0.5);
    const q = qOf(x + 0.5, y + 0.5);
    return o >= oLo && o < oHi && q >= q0 && q < q1;
  };
  const ybot = new Map<number, number>();
  for (let j = 0; j < p.h; j++)
    for (let i = 0; i < p.w; i++) {
      const x = i + ox;
      const y = j + oy;
      if (!inTop(x, y)) continue;
      ybot.set(i, Math.max(ybot.get(i) ?? -1, j));
      const o = oOf(x + 0.5, y + 0.5);
      const q = qOf(x + 0.5, y + 0.5);
      const dL = q - q0; // the left side edge (upper-left facing, key-lit)
      const dR = q1 - q; // the right side edge (lower-right facing, shaded)
      const dO = player === 0 ? oHi - o : o - oLo; // the outer edge (P1 near-left front, P2 far-right back): lit
      let c: Color = PAL.stone2;
      const lit = (d: number, k: number): Color | null =>
        d < 1 ? (k % 6 === 0 ? PAL.gold3 : PAL.gold2) : d < 2 ? (player === 0 && d === dO ? PAL.stone2 : PAL.earth1) : d < 3 ? PAL.stone0 : null;
      const shd = (d: number): Color | null => (d < 1 ? PAL.gold1 : d < 2 ? PAL.stone1 : d < 3 ? NT_PAL.metal[0] : null);
      const inner = player === 0 ? o >= -0.5 : o < 0;
      if (inner || player === 1) {
        const cands: [number, Color | null][] = [
          [dR, shd(dR)],
          [dO, lit(dO, x)],
          [dL, lit(dL, x)],
        ];
        let best = 3;
        for (const [d, col] of cands)
          if (col !== null && d < best) {
            best = d;
            c = col;
          }
      }
      p.set(i, j, c);
    }
  // walls below the outer edges (P1: front + right face; P2: the right face only, hidden where the stage top is in front)
  const xs = [...ybot.keys()].sort((a, b) => a - b);
  if (xs.length === 0) return;
  // the bottom corner (front face | right face split) = the lowest bottom edge
  let split = xs[0];
  for (const i of xs) if ((ybot.get(i) ?? 0) >= (ybot.get(split) ?? 0)) split = i;
  const winX = player === 0 ? [xs[0] + 9, xs[0] + 14, xs[0] + 26, xs[0] + 31] : [];
  for (const i of xs) {
    const yb = ybot.get(i) ?? 0;
    const front = i < split;
    if (player === 1 && front) continue;
    const lx = front ? (i - xs[0] === 20 ? 0 : i - xs[0] === 21 ? 1 : 9) : i === split ? 0 : i === split + 1 ? 1 : 9;
    for (let v = 0; v < FACE_H; v++) {
      const j = yb + 1 + v;
      if (player === 1 && oOf(i + ox + 0.5, j + oy + 0.5) >= 0) break;
      p.set(i, j, wallTone(v, front, player, lx));
    }
    if (player === 0) {
      p.set(i, yb + 1 + FACE_H, NT_PAL.ink);
      p.set(i, yb + 2 + FACE_H, PAL.stone0);
    }
  }
  // small lit windows in the main band of the front face (3×3, ink frame, axis-aligned like the stage's)
  for (const wx of winX) {
    const y0 = (ybot.get(wx) ?? 0) + 1 + 23;
    for (let dx = -1; dx <= 3; dx++)
      for (let dy = -1; dy <= 3; dy++) {
        const frame = dx === -1 || dx === 3 || dy === -1 || dy === 3;
        p.set(wx + dx, y0 + dy, frame ? NT_PAL.ink : dy === 0 ? STRIP[player][2] : STRIP[player][0]);
      }
    for (let dx = 0; dx < 3; dx++) p.set(wx + dx, y0 + 4, STRIP[player][1]);
  }
}

/**
 * The podium at one glow level (0 dark … 3 pulse peak): the stage stone it stands on (paintBase), a flat player-tinted light band
 * hugging its foot, a hard cast shadow, then the 2-step dais (outlined on its own). Critique round 2 (#3 / #4 / #5): the step tops
 * are tinted toward the player colour (one palette step, flat), the lower step is wider (a clear second step with a bright face),
 * and the pulse swings the face tint and the foot band too, not only the rim.
 */
function paintPad(player: 0 | 1, level: number): PixelCanvas {
  const { w, h, cx, cy } = PAD_CANVAS;
  const p = new PixelCanvas(w, h);
  const d = new PixelCanvas(w, h);
  const ramp = player === 0 ? NT_PAL.blue : NT_PAL.red;
  const rim: Color = ramp[player === 0 ? [2, 3, 4, 4][level] : [2, 3, 3, 4][level]];
  const inner: Color = ramp[player === 0 ? [1, 2, 3, 3][level] : [2, 2, 3, 3][level]];
  const low: Color = ramp[[1, 2, 3, 3][level]];
  const spill: Color = ramp[[0, 1, 2, 2][level]];
  const face: Color = ramp[[0, 1, 1, 1][level]];
  const band: Color = ramp[[0, 1, 1, 2][level]];
  const lowRise = DAIS.lowRise + (player === 1 ? 2 : 0);
  const lowY = cy + DAIS.rise;
  const lowHw = PAD_HALF.w + DAIS.stepW;
  const lowHh = PAD_HALF.h + DAIS.stepH;
  const baseY = lowY + lowRise;
  paintBase(p, player, { x: cx, y: baseY, hw: lowHw + 4, hh: lowHh + 2 });
  // hard cast shadow (two flat bands, no alpha) on the stone below / right of the dais
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const dv = inset(i, j, cx + 4, baseY + 2, lowHw, lowHh);
      if (dv >= 2.5) p.set(i, j, NT_PAL.ink);
      else if (dv >= 0) p.set(i, j, S[0]);
    }
  // the flat light band round the foot (player colour, stepped, no dither): two rows outside the lower step's base
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const dv = inset(i, j, cx, baseY, lowHw, lowHh);
      if (dv < 0 && dv >= -2) p.set(i, j, band);
    }
  // lower step: wide bright slate top, its outer rim glows (front rows brighter), a tinted row inside, a lit / shaded riser
  paintStep(
    d,
    lowY,
    lowHw,
    lowHh,
    lowRise,
    (_i, j, dv) => (dv < 1 ? (j + 0.5 > lowY ? low : spill) : dv < 2 ? (j + 0.5 > lowY ? spill : face) : dv < 3 && j + 0.5 > lowY ? face : S[2]),
    (left, dd) => (dd >= lowRise ? S[0] : dd === 1 ? (left ? S[3] : S[2]) : left ? S[2] : S[1]),
  );
  // top step: glowing two-band rim, a player-tinted top with a hard dark contact patch under the feet, a taller riser
  paintStep(
    d,
    cy,
    PAD_HALF.w,
    PAD_HALF.h,
    DAIS.rise,
    (i, j, dv) => {
      if (dv < 1) return rim;
      if (dv < 2) return inner;
      const dx = (i + 0.5 - cx) / 10;
      const dy = (j + 0.5 - cy - 1) / 4.5;
      const r2 = dx * dx + dy * dy;
      return r2 < 0.3 ? NT_PAL.ink : r2 < 0.6 ? S[0] : dv < 3 ? spill : face;
    },
    (left, dd) => (dd === 1 ? low : dd === DAIS.rise ? S[0] : left ? S[2] : S[1]),
  );
  d.outline(NT_PAL.ink);
  p.blit(d, 0, 0);
  return p;
}

export interface PadsArt {
  atlas: Atlas;
  ms: number;
}

let cached: PadsArt | null = null;

export function buildPadsArt(): PadsArt {
  if (cached) return cached;
  const t0 = performance.now();
  const list: [string, PixelCanvas][] = [];
  for (const player of [0, 1] as const) for (let level = 0; level < 4; level++) list.push([padFrame(player, level), paintPad(player, level)]);
  cached = { atlas: packAtlas(list, 256), ms: Math.round((performance.now() - t0) * 10) / 10 };
  return cached;
}

/** Skeleton-compatible painter: the pads atlas canvas. */
export function paintPads(): PixelCanvas {
  return buildPadsArt().atlas.canvas;
}
