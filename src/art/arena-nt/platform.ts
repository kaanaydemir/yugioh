// Neon Tower painter: PLATFORM — owner A1 (docs/v3/ARENA_NEON_TOWER.md §2 / §5 / §6).
// The ONE raised isometric metal battle platform drawn AROUND the existing tiles (layout.ts never changes):
//   - a plain graphite top plate over the fixed 7×5 reference grid (the 5+5 board; 3+3 uses its middle
//     columns, the outer lane cells stay empty graphite) with a rim, a free channel for BoardViewCalm's
//     neon trim pieces (they keep their lit / dead / runner / ignition behaviour), panel seams and bolts;
//   - the two duelist bumps (grid cols PAD_C0..PAD_C1) as part of the same plate;
//   - layered armour side panels (FACE_H px: lip, rail, energy-strip channel, armour panel, ledge, skirt)
//     on every camera-facing edge, panel seams, a few vents, corner pillars and four corner blocks;
//   - the contact shadow under the platform (ink, dithered in three steps: no alpha, no blur);
//   - the neutral dark centre strip (bridge row) with its dashed centre line and tiny split emblem.
// Everything is drawn in screen pixels into ONE texture (BOX), plus a small fx atlas (white masks of the
// strip pieces, vent puffs, corner glints) for the layer's ambient motion. Pure PixelCanvas code
// (no Phaser): runs in Node for tests. Colours only from src/art/palette.ts (through NT_PAL).

import { FACE_H, NT_COLS, NT_OX, NT_OY, NT_ROWS, PAD_C0, PAD_C1, PLATE_G0, PLATE_G1X, PLATE_G1Y, PLATE_OUTLINE, ntIso } from '../../view/board-nt/layout-nt';
import { LANES } from '../../view/layout';
import { type Color, PixelCanvas } from '../pixel';
import { PAL } from '../palette';
import { NT_PAL } from './palette';
import { type Atlas, Surface, packAtlas } from './platform-pack';

/** Texture keys: the platform body (hull, top, shadow) and the fx atlas (frames named inside). */
export const NT_PLATFORM_KEY = 'nt:platform';
export const NT_PLATFORM_FX_KEY = 'nt:platform:fx';

/** Screen rect of the body texture: the plate (104..536 × 52..296) + corner blocks above + the contact shadow around. */
export const PLATFORM_BOX = { x: 88, y: 36, w: 464, h: 284 } as const;

// ---------------------------------------------------------------- tones

const M = NT_PAL.metal;
const N0 = M[0];
const N1 = M[1];
const N2 = M[2];
const N3 = M[3];
const N4 = M[4];
const STEEL = M[5];
const INK = NT_PAL.ink;
const G0 = NT_PAL.graphite[0];
const G1 = NT_PAL.graphite[1];
const G2 = NT_PAL.graphite[2];
const STONE3 = PAL.stone3;
/** energy tones per side: 0 blue (player), 1 crimson (opponent), 2 neutral (the middle panel of the right face) */
export const STRIP_TONES: Record<0 | 1 | 2, readonly [Color, Color, Color, Color, Color]> = {
  0: NT_PAL.blue,
  1: NT_PAL.red,
  2: [N1, N2, N3, N4, STEEL],
};

type Side = 0 | 1 | 2;
const sideOfRow = (r: number): Side => (r > 2.5 ? 0 : r < 1.5 ? 1 : 2);

// ---------------------------------------------------------------- grid helpers

/** The plate as a union of rectangles in grid space (the bumps overlap the plate so their joint is no edge). */
const RECTS: readonly (readonly [number, number, number, number])[] = [
  [PLATE_G0, PLATE_G1X, PLATE_G0, PLATE_G1Y],
  [PAD_C0, PAD_C1, -2, 0.5],
  [PAD_C0, PAD_C1, 4.5, 6],
];

/** Depth (grid units) of a point inside the plate (−1 outside), and which side of its best rectangle is nearest (0 −col, 1 +col, 2 −row, 3 +row). */
let depthSide = 0;
function plateDepth(c: number, r: number): number {
  let best = -1;
  for (let k = 0; k < RECTS.length; k++) {
    const q = RECTS[k];
    const d0 = c - q[0];
    const d1 = q[1] - c;
    const d2 = r - q[2];
    const d3 = q[3] - r;
    let d = d0;
    let side = 0;
    if (d1 < d) {
      d = d1;
      side = 1;
    }
    if (d2 < d) {
      d = d2;
      side = 2;
    }
    if (d3 < d) {
      d = d3;
      side = 3;
    }
    if (d >= 0 && d > best) {
      best = d;
      depthSide = side;
    }
  }
  return best;
}

// ---------------------------------------------------------------- public result

export interface StripPiece {
  /** frame name in the fx atlas (white mask of the strip's core row) */
  frame: string;
  /** screen top-left of the mask */
  x: number;
  y: number;
  side: Side;
  /** the face it lies on */
  face: number;
  /** index along its face */
  n: number;
}

export interface PlatformArt {
  /** the body texture at PLATFORM_BOX */
  canvas: PixelCanvas;
  fx: Atlas;
  strips: StripPiece[];
  /** vent centres (screen) and which way the puff drifts (−1 left-down face, +1 right-down face) */
  vents: { x: number; y: number; dir: -1 | 1 }[];
  /** the corner blocks' top vertex (screen), with the side of the board they stand on */
  corners: { x: number; y: number; side: 0 | 1 }[];
  /** the rim lip pixels of each long face, left → right (for the light sweep) */
  rim: { x: number; y: number }[][];
  /** the dashed centre line of the neutral strip: one pixel list per dash, from the P1 end to the P2 end */
  dashes: { x: number; y: number }[][];
  /** build time, ms (total and per step) */
  ms: number;
  laps: Record<string, number>;
}

// ---------------------------------------------------------------- the painter

interface FaceDef {
  a: [number, number];
  b: [number, number];
  /** grid column of a shaded (+col) face's edge (the row follows x); unused on lit faces */
  col: number;
  lit: boolean;
  seams: number[];
  /** panel indices that carry a vent */
  vents: number[];
}

let cached: PlatformArt | null = null;

/** Build (once) every platform layer: body texture, fx atlas and the layer's placement data. */
export function buildPlatformArt(): PlatformArt {
  if (cached) return cached;
  const t0 = performance.now();
  const laps: Record<string, number> = {};
  let tl = t0;
  const lap = (name: string): void => {
    const t = performance.now();
    laps[name] = Math.round((t - tl) * 10) / 10;
    tl = t;
  };
  const S = new Surface(PLATFORM_BOX.x, PLATFORM_BOX.y, PLATFORM_BOX.w, PLATFORM_BOX.h);
  const strips: Omit<StripPiece, 'frame'>[] = [];
  const stripMasks: [string, PixelCanvas][] = [];
  const vents: PlatformArt['vents'] = [];
  const rim: PlatformArt['rim'] = [];
  const x0 = PLATFORM_BOX.x;
  const y0 = PLATFORM_BOX.y;
  const x1 = x0 + PLATFORM_BOX.w;
  const y1 = y0 + PLATFORM_BOX.h;

  // faces first (a nearer top surface covers the part of a farther face behind it), then the top
  const faces = faceDefs();
  const cand: { x: number; y: number; tone: Color }[][] = [];
  faces.forEach((f, i) => paintFace(S, f, i, strips, cand, vents, rim));
  lap('faces');
  const dashes = paintTop(S, x0, y0, x1, y1);
  lap('top');
  for (const k of PILLARS()) paintPillar(S, k);
  // keep only the strip pixels the top did not cover, cut the white masks from them
  const kept: Omit<StripPiece, 'frame'>[] = [];
  strips.forEach((st, i) => {
    const px = cand[i].filter((q) => S.at(q.x, q.y) === q.tone);
    if (px.length < 4) return;
    const mx0 = Math.min(...px.map((q) => q.x));
    const my0 = Math.min(...px.map((q) => q.y));
    const m = new PixelCanvas(Math.max(...px.map((q) => q.x)) - mx0 + 1, Math.max(...px.map((q) => q.y)) - my0 + 1);
    for (const q of px) m.set(q.x - mx0, q.y - my0, 0xffffff);
    stripMasks.push([`strip:${kept.length}`, m]);
    kept.push({ ...st, x: mx0, y: my0 });
  });
  lap('pillars+masks');
  const corners = paintCorners(S);
  lap('corners');
  paintShadow(S);
  lap('shadow');

  const fxList: [string, PixelCanvas][] = [...stripMasks, ...puffFrames(), ...glintFrames()];
  const fx = packAtlas(fxList, 256);
  cached = {
    canvas: S.canvas,
    fx,
    strips: kept.map((s, i) => ({ ...s, frame: `strip:${i}` })),
    vents,
    corners,
    rim,
    dashes,
    ms: Math.round((performance.now() - t0) * 10) / 10,
    laps,
  };
  return cached;
}

/** Placeholder-compatible painter (the skeleton's signature): the body texture. */
export function paintPlatform(): PixelCanvas {
  return buildPlatformArt().canvas;
}

// ---------------------------------------------------------------- top surface

/** Edge-side rim tone (coping highlight): the camera-facing lower-left edge is the lit one. −col, +col, −row, +row. */
const RIM: readonly Color[] = [N3, N3, N2, N4];
/** The coping's second row (one tone down). */
const RIM2: readonly Color[] = [N2, N2, N1, N3];

/** A tiny deterministic hash (0..1) of a screen pixel: sparse plate noise that never moves. */
function hash01(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function paintTop(S: Surface, x0: number, y0: number, x1: number, y1: number): PlatformArt['dashes'] {
  const dashPx: { x: number; y: number }[][] = Array.from({ length: 13 }, () => []);
  // 3+3: the calm arena's neon trim follows ITS (smaller) outline, so it stays off and the plate carries its own dim edge line
  const ownTrim = LANES < 5;
  for (let y = y0; y < y1; y++) {
    // the screen span of the plate on this row: the union of its three rectangles (c + r is fixed along a row)
    const sum = (y + 0.5 - NT_OY) / 16;
    let xa = Infinity;
    let xb = -Infinity;
    for (const q of RECTS) {
      const cmin = Math.max(q[0], sum - q[3]);
      const cmax = Math.min(q[1], sum - q[2]);
      if (cmax < cmin) continue;
      xa = Math.min(xa, NT_OX + (2 * cmin - sum) * 32);
      xb = Math.max(xb, NT_OX + (2 * cmax - sum) * 32);
    }
    if (xa > xb) continue;
    for (let x = Math.max(x0, Math.floor(xa) - 1); x < Math.min(x1, Math.ceil(xb) + 1); x++) {
      const ga = (x + 0.5 - NT_OX) / 32;
      const c = (ga + sum) / 2;
      const r = (sum - ga) / 2;
      const d = plateDepth(c, r);
      if (d < 0) continue;
      const side = depthSide;
      const d32 = d * 32;
      // the 7×5 tile grid (cells are 1 grid unit around their centre): PLAIN flat graphite, a cell reads by its 1-px border
      if (c >= -0.5 && c < NT_COLS - 0.5 && r >= -0.5 && r < NT_ROWS - 0.5) {
        const col = Math.floor(c + 0.5);
        const row = Math.floor(r + 0.5);
        if (row === 2) {
          // the neutral strip: one continuous band, joints only along its two long edges
          const dr = (0.5 - Math.abs(r - 2)) * 32;
          if (dr < 1) S.put(x, y, N0);
          else {
            let tone: Color = G1;
            // the dashed centre line (one row, 8 px long dashes every 16 px, the emblem's place empty)
            const k = Math.round(c * 2);
            if ((r - 2) * 32 >= -0.5 && (r - 2) * 32 < 0.5 && k >= 0 && k <= 12 && k !== 6 && Math.abs(c * 2 - k) <= 0.25) {
              tone = N2;
              dashPx[k].push({ x, y });
            }
            S.put(x, y, tone);
          }
          continue;
        }
        const ccx = NT_OX + (col - row) * 32;
        const ccy = NT_OY + (col + row) * 16;
        const dv = 16 - (Math.abs(x + 0.5 - ccx) / 2 + Math.abs(y + 0.5 - ccy));
        S.put(x, y, dv < 1 ? N0 : G1);
        continue;
      }
      // the border band between the rim and the grid (and the bumps): layered coping, a groove, the trim channel, a groove, the plate
      if (d32 < 1) {
        S.put(x, y, RIM[side]);
        continue;
      }
      if (d32 < 2) {
        S.put(x, y, RIM2[side]);
        continue;
      }
      if (d32 < 3) {
        S.put(x, y, N0);
        continue;
      }
      if (d32 < 4) {
        // BoardViewCalm's neon pieces lie exactly here (5+5); 3+3 paints the line itself, blue near / crimson far
        if (ownTrim) {
          const ramp = r > 2.5 ? NT_PAL.blue : r < 1.5 ? NT_PAL.red : NT_PAL.metal;
          S.put(x, y, ramp === NT_PAL.metal ? N3 : ramp[2]);
        } else S.put(x, y, N1);
        continue;
      }
      if (d32 < 5) {
        S.put(x, y, N0);
        continue;
      }
      let tone: Color = G1;
      // a panel seam every tile along the edge, a bolt where it meets the band's middle
      const sAlong = side < 2 ? r : c;
      const t = sAlong + 0.5 - Math.floor(sAlong + 0.5);
      if (t < 1 / 32) tone = d32 >= 8 && d32 < 10 ? STONE3 : N0;
      else if (t >= 1 / 32 && t < 2 / 32 && d32 >= 5.5) tone = G2;
      // very sparse noise: a few lighter flecks, never a pattern
      else if (hash01(x, y) < 0.006) tone = G2;
      S.put(x, y, tone);
    }
  }
  // the emblem: a tiny split diamond (blue toward the player, crimson toward the opponent) with short wings
  paintEmblem(S, 0);
  return dashPx.filter((_, k) => k !== 6);
}

/**
 * The centre emblem at ring levels (blue half, red half) 0..3, drawn at the board centre (320, 160): 16×8, a tiny
 * split diamond (the player's half toward the near side, the opponent's toward the far side) with short wings.
 */
export function emblemCanvas(blueLevel: number, redLevel = blueLevel): PixelCanvas {
  const p = new PixelCanvas(16, 8);
  const lb = Math.max(0, Math.min(3, blueLevel));
  const lr = Math.max(0, Math.min(3, redLevel));
  const blue = [NT_PAL.blue[1], NT_PAL.blue[2], NT_PAL.blue[3], NT_PAL.blue[4]][lb];
  const red = [NT_PAL.red[1], NT_PAL.red[2], NT_PAL.red[3], NT_PAL.red[4]][lr];
  for (let j = 0; j < 8; j++) {
    for (let i = 0; i < 16; i++) {
      // the diamond (width 12, wings add 2 px each side at the middle rows)
      const dv = 3.5 - (Math.abs(i + 0.5 - 8) / 2 - 0.5 + Math.abs(j + 0.5 - 4));
      const wing = (j === 3 || j === 4) && (i < 2 || i >= 14);
      if (dv < 0 && !wing) continue;
      // below the dividing line (slope 1/2 through the centre) = the player's half
      const s = j + 0.5 - 4 - (i + 0.5 - 8) / 2;
      const ring = dv < 1 || wing;
      if (Math.abs(s) < 0.5) p.set(i, j, STEEL);
      else if (ring) p.set(i, j, s > 0 ? blue : red);
      else p.set(i, j, s > 0 ? N1 : N0);
    }
  }
  return p;
}

function paintEmblem(S: Surface, level: number): void {
  const e = emblemCanvas(level);
  for (let j = 0; j < e.h; j++) for (let i = 0; i < e.w; i++) {
    const c = e.get(i, j);
    if (c !== null) S.put(312 + i, 156 + j, c);
  }
}

// ---------------------------------------------------------------- faces

const rp = (q: { x: number; y: number }): [number, number] => [Math.round(q.x), Math.round(q.y)];

function faceDefs(): FaceDef[] {
  const out: FaceDef[] = [];
  const n = PLATE_OUTLINE.length;
  for (let i = 0; i < n; i++) {
    const a = PLATE_OUTLINE[i];
    const b = PLATE_OUTLINE[(i + 1) % n];
    const nx = Math.sign(b[1] - a[1]);
    const ny = -Math.sign(b[0] - a[0]);
    if (!(nx > 0 || ny > 0)) continue;
    let A = rp(ntIso(a[0], a[1]));
    let B = rp(ntIso(b[0], b[1]));
    if (A[0] > B[0]) [A, B] = [B, A];
    const L = B[0] - A[0];
    let seams: number[];
    let vents: number[];
    if (A[0] === 352 && B[0] === 536) {
      // the right face: seams where the strip changes owner (rows 2.5 / 1.5 = x 428 / 460)
      seams = [352, 390, 428, 460, 498, 536];
      vents = [1, 3];
    } else {
      const k = Math.max(1, Math.round(L / 33));
      seams = Array.from({ length: k + 1 }, (_, j) => A[0] + Math.round((L * j) / k));
      vents = k >= 3 ? [1] : [];
    }
    out.push({ a: A, b: B, col: a[0], lit: ny > 0, seams, vents });
  }
  // far → near so a nearer face paints over a farther one where they meet
  out.sort((f, g) => f.a[0] + f.a[1] + f.b[0] + f.b[1] - (g.a[0] + g.a[1] + g.b[0] + g.b[1]));
  return out;
}

/**
 * v → tone of a face column (lit = the camera-facing left faces, shade = the right faces); 'S' = strip core, 'L' = the
 * strip's glow row. Top → bottom (FACE_H 28): coping (v0–2) and a groove, the UPPER armour plate (v4–10: bevel, body ×4, shade),
 * a groove, the recessed light channel (v12–14), a groove, the LOWER armour plate (v16–23), a ledge (v24), the skirt (v25–26)
 * and the bottom outline.
 */
const LIT_ROWS: (Color | 'S' | 'L')[] = [N4, N3, N2, INK, N3, N2, N2, N2, N2, N1, N1, INK, N0, 'S', 'L', INK, N3, N2, N2, N2, N1, N1, N1, N0, N4, N2, N0, INK];
const SHD_ROWS: (Color | 'S' | 'L')[] = [N3, N2, N1, INK, N2, N1, N1, N1, N1, N0, N0, INK, N0, 'S', 'L', INK, N2, N1, N1, N1, N0, N0, N0, N0, N3, N1, N0, INK];
const V_STRIP = 13;

function paintFace(S: Surface, f: FaceDef, id: number, strips: Omit<StripPiece, 'frame'>[], cand: { x: number; y: number; tone: Color }[][], vents: PlatformArt['vents'], rim: PlatformArt['rim']): void {
  const [A, B] = [f.a, f.b];
  const rows = f.lit ? LIT_ROWS : SHD_ROWS;
  const slope = (B[1] - A[1]) / (B[0] - A[0]);
  const yTop = (x: number): number => edgeTop(A[1], slope, A[0], x);
  // which side's energy lies at x: the left faces are the player's; on a +col face the row follows x
  const sideAt = (x: number): Side => (f.lit ? 0 : sideOfRow(f.col - (x - NT_OX) / 32));
  const lipPts: { x: number; y: number }[] = [];
  const panelOf = (x: number): number => {
    let i = 0;
    while (i + 1 < f.seams.length - 1 && x >= f.seams[i + 1]) i++;
    return i;
  };
  const hi = f.lit ? N4 : N3;
  const lo = f.lit ? N1 : N0;
  const runs = new Map<number, { x: number; y: number; tone: Color }[]>();
  for (let x = A[0]; x < B[0]; x++) {
    const yt = yTop(x);
    const pi = panelOf(x);
    const sx0 = f.seams[pi];
    const sx1 = f.seams[pi + 1];
    const plen = sx1 - sx0;
    const lx = x - sx0;
    const isSeam0 = x === sx0 && pi > 0;
    const isSeam1 = x === sx0 - 1 && pi > 0;
    const seam = isSeam0 || isSeam1;
    const tones = STRIP_TONES[sideAt(x)];
    const nearSeam = Math.min(x - sx0, sx1 - 1 - x) <= 1;
    // the lower plate's own joints sit at the middle of each panel (staggered brickwork); a vent replaces one
    const mid = (sx0 + sx1) >> 1;
    const hasVent = f.vents.includes(pi);
    const inVent = hasVent && x >= mid - 4 && x < mid + 5;
    const lowSeam = x === mid || x === mid - 1;
    // every third panel carries a recessed inset in the upper plate, every other one a lamp in the lower plate
    const inset = !hasVent && pi % 3 === 1 && lx >= 5 && lx < plen - 6;
    const lamp = !hasVent && pi % 2 === 0 && (x === mid + 5 || x === mid + 6);
    for (let v = 0; v < FACE_H; v++) {
      const t = rows[v];
      let c: Color = t === 'S' ? tones[2] : t === 'L' ? tones[1] : t;
      // panel joints: a dark groove and a lit edge through both armour plates (not through the coping or the skirt)
      if (v >= 4 && v <= 26 && seam) c = isSeam1 ? INK : hi;
      else if (v >= 4 && v <= 10) {
        // upper plate: chamfered top corners, a lit left bevel / shaded right edge, rivets, an inset or a vent grille
        if (v === 4 && nearSeam) c = rows[5] as Color;
        else if (lx === 1 && v >= 5) c = hi;
        else if (lx === plen - 3 && v >= 5) c = lo;
        else if (v === 5 && (lx === 3 || lx === plen - 5)) c = f.lit ? STEEL : N4;
        else if (inVent && v >= 6 && v <= 8) c = v === 7 ? N0 : INK;
        else if (inset && v >= 6 && v <= 9) c = v === 6 ? lo : v === 9 ? hi : f.lit ? N1 : N0;
        else if (pi % 2 === 1 && v >= 5 && v <= 8) c = f.lit ? (v === 5 ? N2 : N1) : (v === 5 ? N1 : N0);
      } else if (v >= 16 && v <= 23) {
        // lower plate: staggered joints, an alternate deeper tone, rivets low, a lamp and the vent slots
        if (lowSeam && !seam) c = x === mid ? (f.lit ? N4 : N3) : INK;
        else if (inVent && (v === 18 || v === 20 || v === 22)) c = INK;
        else if (inVent && (v === 19 || v === 21)) c = N0;
        else if (lamp && v === 19) c = tones[2];
        else if (lamp && v === 20) c = tones[0];
        else if (v === 17 && (lx === 3 || lx === plen - 4)) c = f.lit ? STEEL : N4;
        else if (pi % 2 === 0 && v >= 17 && v <= 21 && !lowSeam) c = f.lit ? (v < 20 ? N2 : N1) : (v < 20 ? N1 : N0);
      }
      S.put(x, yt + v, c);
      if (v === V_STRIP && !seam) {
        const arr = runs.get(pi) ?? [];
        arr.push({ x, y: yt + v, tone: tones[2] });
        runs.set(pi, arr);
      }
    }
    lipPts.push({ x, y: yt - 1 });
  }
  for (const pi of f.vents) {
    const vx = (f.seams[pi] + f.seams[pi + 1]) >> 1;
    vents.push({ x: vx, y: yTop(vx) + 8, dir: f.lit ? -1 : 1 });
  }
  let n = 0;
  for (const px of [...runs.entries()].sort((p, q) => p[0] - q[0]).map((e) => e[1])) {
    if (px.length < 4) continue;
    cand.push(px);
    strips.push({ x: 0, y: 0, side: sideAt(px[px.length >> 1].x), face: id, n: n++ });
  }
  if (B[0] - A[0] > 60) rim.push(lipPts);
}

/** First row of a face band at column x under a top edge line through (kx, ky) with `slope`: the top's last row + 1. */
function edgeTop(ky: number, slope: number, kx: number, x: number): number {
  return Math.floor(ky + slope * (x + 0.5 - kx) - 0.5) + 1;
}

interface Pillar {
  /** the corner vertex (screen) */
  k: [number, number];
  /** which face lines the pillar follows: left face only / right face only / both (a convex or a concave corner) */
  mode: 'L' | 'R' | 'LR';
  /** pillar centre column */
  cx: number;
  /** 0 blue / 1 crimson / 2 neutral: the tone of the slit */
  side: Side;
}

function PILLARS(): Pillar[] {
  const v = (c: number, r: number): [number, number] => rp(ntIso(c, r));
  const left = v(PLATE_G0, PLATE_G1Y);
  const bottom = v(PLATE_G1X, PLATE_G1Y);
  const right = v(PLATE_G1X, PLATE_G0);
  const b1 = v(PAD_C0, 6);
  const b2 = v(PAD_C1, 6);
  const p2 = v(PAD_C1, -2);
  const inner = v(PAD_C1, PLATE_G1Y); // the concave joint of the near bump's right face and the long lower-right face
  return [
    { k: left, mode: 'L', cx: left[0] + 2, side: 0 },
    { k: bottom, mode: 'LR', cx: bottom[0], side: 0 },
    { k: right, mode: 'R', cx: right[0] - 2, side: 1 },
    { k: b1, mode: 'L', cx: b1[0] + 2, side: 0 },
    { k: b2, mode: 'LR', cx: b2[0], side: 0 },
    { k: p2, mode: 'R', cx: p2[0] - 2, side: 1 },
    { k: inner, mode: 'LR', cx: inner[0], side: 0 },
  ];
}

/** A corner pillar (9 px wide) down the faces at a corner: lit left half, shaded right half, caps, bolts, grooves and a lit slit. */
function paintPillar(S: Surface, p: Pillar): void {
  const ramp = p.side === 0 ? NT_PAL.blue : p.side === 1 ? NT_PAL.red : NT_PAL.metal;
  for (let x = p.cx - 4; x <= p.cx + 4; x++) {
    const useLeft = p.mode === 'L' || (p.mode === 'LR' && x <= p.k[0]);
    const yt = edgeTop(p.k[1], useLeft ? 0.5 : -0.5, p.k[0], x);
    const k = x - p.cx;
    for (let v = 0; v < FACE_H; v++) {
      let c: Color;
      if (k === -4 || k === 4) c = INK;
      else if (k === -3) c = N4;
      else if (k === -2) c = N4;
      else if (k === -1) c = N3;
      else if (k === 0) c = N3;
      else if (k === 1) c = N2;
      else if (k === 2) c = N2;
      else c = N1;
      if (v === 0) c = k <= 0 ? STEEL : N4;
      else if (v === 1) c = k <= 0 ? N4 : N3;
      if (v === 3 || v === 11 || v === 15) c = INK;
      // bolts on the plates, a lit slit in the channel
      if ((v === 6 || v === 19) && (k === -2 || k === 2)) c = k < 0 ? STEEL : N4;
      if (v === V_STRIP && k >= -2 && k <= 2) c = k === 0 ? ramp[3] : ramp[2];
      if (v === V_STRIP + 1 && k >= -2 && k <= 2) c = ramp[0];
      if (v === 24) c = k <= 0 ? N4 : N3;
      if (v === 27) c = INK;
      S.put(x, yt + v, c);
    }
  }
}

// ---------------------------------------------------------------- corner blocks

function paintCorners(S: Surface): PlatformArt['corners'] {
  const out: PlatformArt['corners'] = [];
  const HW = 14;
  const HH = 7;
  const H = 10;
  // each block's base diamond sits exactly in its plate corner (the wedge's sides run at slope ±1/2)
  const spots: { cx: number; cy: number; side: 0 | 1 }[] = [
    { cx: 104 + HW, cy: 144, side: 0 }, // left tip (player)
    { cx: 352, cy: 268 - HH, side: 0 }, // near corner (player)
    { cx: 536 - HW, cy: 176, side: 1 }, // right tip (opponent)
    { cx: 288, cy: 52 + HH, side: 1 }, // far corner (opponent)
  ];
  for (const s of spots) {
    paintCube(S, s.cx, s.cy, HW, HH, H, s.side);
    out.push({ x: s.cx, y: s.cy - H - HH, side: s.side });
  }
  return out;
}

/** An isometric armour block: base diamond (2·hw × 2·hh) centred (cx, cy), `h` px tall; top lit, left face mid, right face dark. */
function paintCube(S: Surface, cx: number, cy: number, hw: number, hh: number, h: number, side: 0 | 1): void {
  const p = new PixelCanvas(2 * hw + 4, 2 * hh + h + 4);
  const ox = cx - hw - 2;
  const oy = cy - hh - h - 2;
  const lx = (x: number) => x - ox;
  const ly = (y: number) => y - oy;
  const top = cy - h;
  p.poly([[lx(cx - hw), ly(cy)], [lx(cx), ly(cy + hh)], [lx(cx), ly(cy + hh - h)], [lx(cx - hw), ly(top)]], N3);
  p.poly([[lx(cx), ly(cy + hh)], [lx(cx + hw), ly(cy)], [lx(cx + hw), ly(top)], [lx(cx), ly(cy + hh - h)]], N2);
  p.poly([[lx(cx - hw), ly(top)], [lx(cx), ly(top - hh)], [lx(cx + hw), ly(top)], [lx(cx), ly(top + hh)]], N4);
  // the top: an inset darker plate with a small owner-coloured lamp, a lit rim along the far edges
  p.poly([[lx(cx - hw + 5), ly(top)], [lx(cx), ly(top - hh + 2)], [lx(cx + hw - 5), ly(top)], [lx(cx), ly(top + hh - 2)]], N3);
  p.line(lx(cx - hw), ly(top), lx(cx), ly(top - hh), STEEL);
  p.line(lx(cx), ly(top - hh), lx(cx + hw), ly(top), N4);
  const ramp = side === 0 ? NT_PAL.blue : NT_PAL.red;
  p.hline(lx(cx - 2), lx(cx + 1), ly(top), ramp[3]);
  p.set(lx(cx - 1), ly(top - 1), ramp[4]);
  // the shaft: a lit vertical edge, two ledge grooves, the owner's energy slit on the left face
  p.vline(lx(cx), ly(cy + hh - h), ly(cy + hh), N4);
  for (const dy of [3, h - 3]) {
    p.line(lx(cx - hw + 1), ly(top + dy), lx(cx - 1), ly(top + dy + hh - 1), N2);
    p.line(lx(cx + 1), ly(top + dy + hh - 1), lx(cx + hw - 1), ly(top + dy), N1);
  }
  const sy = cy - 4;
  p.hline(lx(cx - hw + 3), lx(cx - 4), ly(sy), ramp[2]);
  p.hline(lx(cx - hw + 3), lx(cx - 4), ly(sy + 1), ramp[1]);
  p.outline(INK);
  for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) {
    const c = p.get(i, j);
    if (c !== null) S.put(ox + i, oy + j, c);
  }
}

// ---------------------------------------------------------------- contact shadow

function paintShadow(S: Surface): void {
  const x0 = S.ox;
  const w = S.w;
  const bottom = new Int32Array(w).fill(-1);
  for (let i = 0; i < w; i++) {
    for (let y = S.oy + S.h - 1; y >= S.oy; y--)
      if (S.has(x0 + i, y)) {
        bottom[i] = y;
        break;
      }
  }
  const R = 12;
  const REACH = 16;
  for (let i = 0; i < w; i++) {
    // only the rows from just under the nearest silhouette bottom down to REACH px below the farthest one can be shadow
    let lo = Infinity;
    let hi = -1;
    for (let dx = -R; dx <= R; dx++) {
      const k = i + dx;
      if (k < 0 || k >= w || bottom[k] < 0) continue;
      lo = Math.min(lo, bottom[k]);
      hi = Math.max(hi, bottom[k]);
    }
    if (hi < 0) continue;
    for (let y = lo + 1; y <= Math.min(S.oy + S.h - 1, hi + REACH + R); y++) {
      if (S.has(x0 + i, y)) continue;
      let dmin = 99;
      for (let dx = -R; dx <= R; dx++) {
        const k = i + dx;
        if (k < 0 || k >= w || bottom[k] < 0 || bottom[k] >= y) continue;
        const d = y - bottom[k] + Math.abs(dx);
        if (d < dmin) dmin = d;
      }
      if (dmin > REACH) continue;
      const x = x0 + i;
      // solid under the hull, then a 2×2 stipple, a sparser one, the last specks: a soft ink skirt without alpha
      const on = dmin <= 4 ? true : dmin <= 8 ? (x + y) % 2 === 0 : dmin <= 12 ? x % 2 === 0 && y % 2 === 0 : x % 4 === 0 && y % 4 === 0 && (x + y) % 8 === 0;
      if (on) S.put(x, y, INK);
    }
  }
}

// ---------------------------------------------------------------- fx frames

/** Vent puff: 4 frames 8×8 (a thin steam wisp that grows, drifts and thins out): metal tones only. */
function puffFrames(): [string, PixelCanvas][] {
  const spec: string[][] = [
    ['........', '........', '........', '...3....', '..33....', '...3....', '........', '........'],
    ['........', '........', '...3....', '..43....', '.343....', '..43....', '...3....', '........'],
    ['........', '..3.....', '.343....', '.4343...', '..343...', '...43...', '....3...', '........'],
    ['.3......', '..3..3..', '.3.3....', '...3.3..', '.3......', '..3..3..', '....3...', '.....3..'],
  ];
  const key: Record<string, Color> = { '3': N3, '4': N4 };
  return spec.map((rows, i) => {
    const p = new PixelCanvas(8, 8);
    p.stamp(rows, key, 0, 0);
    return [`puff:${i}`, p] as [string, PixelCanvas];
  });
}

/** Corner glint: 3 frames 7×7 (a small cross that blooms and dies): one white pixel at the heart, the rest steel / mist. */
function glintFrames(): [string, PixelCanvas][] {
  const spec: string[][] = [
    ['.......', '.......', '.......', '...w...', '.......', '.......', '.......'],
    ['.......', '.......', '...s...', '..sws..', '...s...', '.......', '.......'],
    ['.......', '...m...', '...s...', '.mswsm.', '...s...', '...m...', '.......'],
  ];
  const key: Record<string, Color> = { w: NT_PAL.white, s: STEEL, m: NT_PAL.glint };
  return spec.map((rows, i) => {
    const p = new PixelCanvas(7, 7);
    p.stamp(rows, key, 0, 0);
    return [`glint:${i}`, p] as [string, PixelCanvas];
  });
}
