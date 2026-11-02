// Neon Tower painter: PLATFORM — owner A1 (docs/v3/ARENA_NEON_TOWER.md §2 / §5 / §6).
// Readability pass: calm smooth dark slate top plate with subtle texture, warm top-left key light rim along
// the upper-left coping edges, and darkened low-contrast side armour without bright neon strip glare.
// Pure PixelCanvas code (no Phaser): runs in Node for tests. Colours only from src/art/palette.ts.

import { FACE_H, NT_COLS, NT_OX, NT_OY, NT_ROWS, PLATE_C0, PLATE_C1, PLATE_OUTLINE, PLATE_R0, PLATE_R1, PLATE_X0, PLATE_X1, PLATE_Y0, PLATE_Y1, ntIso } from '../../view/board-nt/layout-nt';
import { type Color, PixelCanvas } from '../pixel';
import { PAL } from '../palette';
import { NT_PAL } from './palette';
import { type Atlas, Surface, packAtlas } from './platform-pack';

/** Texture keys: the platform body (hull, top, shadow) and the fx atlas (frames named inside). */
export const NT_PLATFORM_KEY = 'nt:platform';
export const NT_PLATFORM_FX_KEY = 'nt:platform:fx';

/** Screen rect of the body texture: the plate (104..536 × 52..296) + corner blocks above + the contact shadow around. */
export const PLATFORM_BOX = { x: 88, y: 36, w: 464, h: 290 } as const;

// ---------------------------------------------------------------- tones

const M = NT_PAL.metal;
const N0 = M[0];
const N1 = M[1];
const N2 = M[2];
const N3 = M[3];
const INK = NT_PAL.ink;
const G0 = NT_PAL.graphite[0];
const G1 = NT_PAL.graphite[1];
const G2 = NT_PAL.graphite[2];
/** energy tones per side: 0 blue (player), 1 crimson (opponent), 2 neutral (the middle panel of the right face) */
// Readability pass: one tone lower than the original neon (the side armour reads as a dark wall with a faint
// player-coloured seam, not a glowing tube; docs/v3/ref/hedef-gorunum-2.png).
export const STRIP_TONES: Record<0 | 1 | 2, readonly [Color, Color, Color, Color, Color]> = {
  0: [PAL.night0, PAL.night1, PAL.cyan0, PAL.cyan0, PAL.cyan1],
  1: [PAL.night0, PAL.night1, PAL.crim0, PAL.crim0, PAL.crim1],
  2: [N0, N1, N2, N2, N3],
};

type Side = 0 | 1 | 2;
const sideOfRow = (r: number): Side => (r > 2.5 ? 0 : r < 1.5 ? 1 : 2);

// ---------------------------------------------------------------- grid helpers

const S_FAR = (PLATE_Y0 - NT_OY) / 16;
const S_NEAR = (PLATE_Y1 - NT_OY) / 16;
const U_LEFT = (PLATE_X0 - NT_OX) / 32;
const U_RIGHT = (PLATE_X1 - NT_OX) / 32;

let depthSide = 0;
function plateDepth(c: number, r: number): number {
  const s = c + r;
  const u = c - r;
  const d = [(c - PLATE_C0) * 32, (PLATE_C1 - c) * 32, (r - PLATE_R0) * 32, (PLATE_R1 - r) * 32, (s - S_FAR) * 16, (S_NEAR - s) * 16, (u - U_LEFT) * 32, (U_RIGHT - u) * 32];
  let best = d[0];
  let side = 0;
  for (let k = 1; k < 8; k++)
    if (d[k] < best) {
      best = d[k];
      side = k;
    }
  depthSide = side;
  return best < 0 ? -1 : best / 32;
}

// ---------------------------------------------------------------- public result

export interface StripPiece {
  frame: string;
  x: number;
  y: number;
  side: Side;
  face: number;
  n: number;
}

export interface PlatformArt {
  canvas: PixelCanvas;
  fx: Atlas;
  strips: StripPiece[];
  vents: { x: number; y: number; dir: -1 | 1 }[];
  corners: { x: number; y: number; side: 0 | 1 }[];
  rim: { x: number; y: number }[][];
  dashes: { x: number; y: number }[][];
  ms: number;
  laps: Record<string, number>;
}

// ---------------------------------------------------------------- the painter

interface FaceDef {
  a: [number, number];
  b: [number, number];
  col: number;
  lit: boolean;
  side: Side | null;
  seams: number[];
  vents: number[];
}

let cached: PlatformArt | null = null;

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

  const faces = faceDefs();
  const cand: { x: number; y: number; tone: Color }[][] = [];
  faces.forEach((f, i) => paintFace(S, f, i, strips, cand, vents, rim));
  lap('faces');
  const dashes = paintTop(S, x0, y0, x1, y1);
  lap('top');
  for (const k of PILLARS()) paintPillar(S, k);
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

export function paintPlatform(): PixelCanvas {
  return buildPlatformArt().canvas;
}

// ---------------------------------------------------------------- top surface

/**
 * Edge-side rim tone (coping highlight): warm key light from top-left illuminates the upper-left edge (0: -col),
 * far flat edge (4), left cap (6), and upper-right edge (2: -row), while lower edges stay cool dark slate.
 */
const RIM: readonly Color[] = [PAL.earth2, N2, PAL.stone2, N2, PAL.earth2, N2, PAL.earth2, N1];
const RIM2: readonly Color[] = [PAL.earth1, N1, PAL.stone1, N1, PAL.earth1, N1, PAL.earth1, N0];
const RIM3: readonly Color[] = [G2, N0, G1, N0, G2, N0, G2, N0];

/**
 * Readability pass (hedef-gorunum-2.png): the top plate is warm dark stone lit from the top left — flat
 * tone bands (no noise) stepping from warm skin0 near the key light through stone1 to stone0 at the far
 * right / bottom. A low-frequency wave breaks the band edges so they read as stone, not as rings.
 */
function topTone(x: number, y: number): Color {
  // one calm stone tone; only the far bottom-right corner steps down. The warm top-left light is the soft
  // key-light wash of the light layer (src/view/light/LightLayer.ts ensureKeyLightTex), not baked bands.
  const dx = (x - 150) / 470;
  const dy = (y - 110) / 260;
  const wave = 0.03 * Math.sin(x * 0.045 + y * 0.07) + 0.02 * Math.cos(x * 0.021 - y * 0.05);
  return Math.hypot(dx, dy) + wave < 0.92 ? G1 : G0;
}

function paintTop(S: Surface, x0: number, y0: number, x1: number, y1: number): PlatformArt['dashes'] {
  const dashPx: { x: number; y: number }[][] = Array.from({ length: 13 }, () => []);
  for (let y = Math.max(y0, PLATE_Y0); y < Math.min(y1, PLATE_Y1); y++) {
    const sum = (y + 0.5 - NT_OY) / 16;
    for (let x = Math.max(x0, PLATE_X0); x < Math.min(x1, PLATE_X1); x++) {
      const ga = (x + 0.5 - NT_OX) / 32;
      const c = (ga + sum) / 2;
      const r = (sum - ga) / 2;
      const d = plateDepth(c, r);
      if (d < 0) continue;
      const side = depthSide;
      const d32 = d * 32;
      if (c >= -0.5 && c < NT_COLS - 0.5 && r >= -0.5 && r < NT_ROWS - 0.5) {
        const row = Math.floor(r + 0.5);
        if (row === 2) {
          const k = Math.round(c * 2);
          if ((r - 2) * 32 >= -0.5 && (r - 2) * 32 < 0.5 && k >= 0 && k <= 12 && k !== 6 && Math.abs(c * 2 - k) <= 0.25) {
            dashPx[k].push({ x, y });
          }
        }
        // warm stone board surface lit from the top left (tile lines are drawn solely by nt:floor play zones)
        S.put(x, y, topTone(x, y));
        continue;
      }
      if (d32 < 1) {
        S.put(x, y, RIM[side]);
        continue;
      }
      if (d32 < 2) {
        S.put(x, y, RIM2[side]);
        continue;
      }
      if (d32 < 3) {
        S.put(x, y, RIM3[side]);
        continue;
      }
      if (d32 < 4) {
        // Subtle calm groove instead of bright neon perimeter tube
        const ramp = r > 2.5 ? NT_PAL.blue : r < 1.5 ? NT_PAL.red : NT_PAL.metal;
        S.put(x, y, ramp === NT_PAL.metal ? N1 : ramp[0]);
        continue;
      }
      if (d32 < 5) {
        S.put(x, y, N0);
        continue;
      }
      if (d32 < 6) {
        S.put(x, y, G0);
        continue;
      }
      // the border band between the coping and the zones: the same lit stone
      S.put(x, y, topTone(x, y));
    }
  }
  return dashPx.filter((_, k) => k !== 6);
}

export function emblemCanvas(blueLevel: number, redLevel = blueLevel): PixelCanvas {
  const p = new PixelCanvas(16, 8);
  const lb = Math.max(0, Math.min(3, blueLevel));
  const lr = Math.max(0, Math.min(3, redLevel));
  const blue = [NT_PAL.blue[0], NT_PAL.blue[1], NT_PAL.blue[1], NT_PAL.blue[2]][lb];
  const red = [NT_PAL.red[0], NT_PAL.red[1], NT_PAL.red[1], NT_PAL.red[2]][lr];
  for (let j = 0; j < 8; j++) {
    for (let i = 0; i < 16; i++) {
      const dv = 3.5 - (Math.abs(i + 0.5 - 8) / 2 - 0.5 + Math.abs(j + 0.5 - 4));
      const wing = (j === 3 || j === 4) && (i < 2 || i >= 14);
      if (dv < 0 && !wing) continue;
      const s = j + 0.5 - 4 - (i + 0.5 - 8) / 2;
      const ring = dv < 1 || wing;
      if (Math.abs(s) < 0.5) p.set(i, j, N2);
      else if (ring) p.set(i, j, s > 0 ? blue : red);
      else p.set(i, j, s > 0 ? N1 : N0);
    }
  }
  return p;
}

// ---------------------------------------------------------------- faces

const rp = (q: { x: number; y: number }): [number, number] => [Math.round(q.x), Math.round(q.y)];

function faceDefs(): FaceDef[] {
  const V = PLATE_OUTLINE.map(([c, r]) => rp(ntIso(c, r)));
  const out: FaceDef[] = [];
  const mk = (a: [number, number], b: [number, number], lit: boolean, col: number, side: Side | null): FaceDef => {
    const L = b[0] - a[0];
    let seams: number[];
    let vents: number[];
    if (side === null && !lit) {
      seams = [a[0], 396, 428, 460, 493, b[0]];
      vents = [1, 3];
    } else {
      const k = Math.max(1, Math.round(L / 33));
      seams = Array.from({ length: k + 1 }, (_, j) => a[0] + Math.round((L * j) / k));
      vents = k >= 3 ? [1] : [];
    }
    return { a, b, col, lit, side, seams, vents };
  };
  out.push(mk(V[0], V[7], true, PLATE_C0, null));
  out.push(mk(V[7], V[6], false, 0, 0));
  out.push(mk(V[6], V[5], false, PLATE_C1, null));
  return out;
}

type RowTone = Color | 'S' | 'L' | 'l';
const rowsOf = (...segs: RowTone[][]): RowTone[] => segs.flat();

// hedef-gorunum-3: a THICK stage wall. The rows are generated for FACE_H: coping 4 (row 0 = the warm lit bevel),
// upper armour plate 16, ink seam, light channel 6, ink seam, the main panel (FACE_H − 36 rows), ink seam, belt 5
// (with a small lamp per panel), footing 2.
const UP0 = 4;
const UP_N = 16;
const CH0 = UP0 + UP_N + 1;
const MAIN0 = CH0 + 6 + 1;
const MAIN_N = FACE_H - 36;
const BELT0 = MAIN0 + MAIN_N + 1;
function faceRows(lit: boolean): RowTone[] {
  const main: RowTone[] = [];
  for (let i = 0; i < MAIN_N - 1; i++) {
    const k = i / (MAIN_N - 1);
    main.push(lit ? (k < 0.09 ? N2 : k < 0.18 ? N1 : k < 0.45 ? G1 : k < 0.7 ? G0 : N0) : k < 0.06 ? N2 : k < 0.18 ? N1 : k < 0.36 ? G1 : k < 0.6 ? G0 : N0);
  }
  main.push(INK);
  return rowsOf(
    lit ? [PAL.earth2, N2, N1, INK] : [PAL.earth1, N1, G1, INK],
    lit ? [N2, N2, N1, N1, G1, G1, G1, G1, G0, G0, G0, G0, N0, N0, N0, N0] : [N2, N1, N1, G1, G1, G1, G0, G0, G0, G0, N0, N0, N0, N0, N0, N0],
    [INK],
    [N0, 'L', 'S', 'S', 'l', N0],
    [INK],
    main,
    [INK],
    lit ? [N1, G1, 'l', N0, N0] : [N1, G0, 'l', N0, INK],
    [N0, INK],
  );
}
const LIT_ROWS: RowTone[] = faceRows(true);
const SHD_ROWS: RowTone[] = faceRows(false);
const STRIP_ROWS = [CH0 + 2, CH0 + 3] as const;
const LADDER: readonly Color[] = [INK, N0, G0, G1, N1, N2, N3];
const shiftTone = (c: Color, d: number): Color => {
  const i = LADDER.indexOf(c);
  return i < 0 ? c : LADDER[Math.max(1, Math.min(LADDER.length - 1, i + d))];
};

function paintFace(S: Surface, f: FaceDef, id: number, strips: Omit<StripPiece, 'frame'>[], cand: { x: number; y: number; tone: Color }[][], vents: PlatformArt['vents'], rim: PlatformArt['rim']): void {
  const [A, B] = [f.a, f.b];
  const rows = f.lit ? LIT_ROWS : SHD_ROWS;
  const slope = (B[1] - A[1]) / (B[0] - A[0]);
  const yTop = (x: number): number => edgeTop(A[1], slope, A[0], x);
  const sideAt = (x: number): Side => (f.side !== null ? f.side : f.lit ? 0 : sideOfRow(f.col - (x - NT_OX) / 32));
  const lipPts: { x: number; y: number }[] = [];
  const panelOf = (x: number): number => {
    let i = 0;
    while (i + 1 < f.seams.length - 1 && x >= f.seams[i + 1]) i++;
    return i;
  };
  const hi = f.lit ? N2 : N1;
  const lo = N0;
  const inner = (u: number): Color => (f.lit ? (u < 6 ? G1 : u < 11 ? G0 : N0) : u < 8 ? G0 : N0);
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
    const mid = (sx0 + sx1) >> 1;
    const hasVent = f.vents.includes(pi);
    const variant = hasVent ? 0 : (pi + (f.lit ? 0 : 1)) % 3;
    const inInset = lx >= 3 && lx <= plen - 5;
    const inVent = hasVent && x >= mid - 6 && x < mid + 7;
    for (let v = 0; v < FACE_H; v++) {
      const t = rows[v];
      let c: Color = t === 'S' ? tones[2] : t === 'L' ? tones[1] : t === 'l' ? tones[0] : t;
      if (v >= UP0 && v <= FACE_H - 6 && seam) {
        c = isSeam1 ? INK : hi;
      } else if (v >= UP0 && v < UP0 + UP_N) {
        const u = v - UP0;
        if (u === 0 && nearSeam) c = rows[5] as Color;
        else if (lx === 1 && u >= 1) c = hi;
        else if (lx === plen - 3 && u >= 1) c = lo;
        else if (inVent && u >= 3 && u <= UP_N - 4) c = u === 3 ? lo : u === UP_N - 4 ? hi : u % 2 === 0 ? INK : lo;
        // rivets in the upper plate's corners
        else if ((lx === 3 || lx === plen - 5) && (u === 2 || u === UP_N - 3)) c = f.lit ? N3 : N2;
      } else if (v >= MAIN0 && v < MAIN0 + MAIN_N) {
        const u = v - MAIN0;
        if (inInset && u >= 2 && u <= MAIN_N - 3) {
          const edge = u === 2 ? hi : u === MAIN_N - 3 ? INK : lx === 3 ? hi : lx === plen - 5 ? lo : null;
          if (edge !== null) c = edge;
          else {
            c = inner(u);
            const lw = plen - 8;
            const cx = lx - 4;
            const lu = (MAIN_N >> 1) - 3;
            if (variant === 0) {
              if (cx >= 3 && cx <= lw - 4 && u >= 5 && u <= MAIN_N - 6) c = u % 2 === 1 ? INK : f.lit ? N1 : G0;
            } else if (variant === 1) {
              if (Math.abs(cx - (lw >> 1)) <= 4 && u >= lu && u <= lu + 5) {
                const wx = Math.abs(cx - (lw >> 1));
                if (u === lu || u === lu + 5 || wx === 4) c = INK;
                else c = u === lu + 1 ? tones[2] : tones[1];
              }
            } else {
              // a recessed vertical rib pair (panel seams that read at a glance on the tall wall)
              const rx = lw >> 1;
              if ((cx === rx - 3 || cx === rx + 3) && u >= 4 && u <= MAIN_N - 6) c = INK;
              else if ((cx === rx - 2 || cx === rx + 4) && u >= 4 && u <= MAIN_N - 6) c = f.lit ? N2 : N1;
            }
          }
        } else if (u >= MAIN_N - 2 && inInset) c = N0;
      } else if (v === BELT0 + 2 && !seam) {
        // a small lamp at the middle of every panel on the belt (player colour, 2 px + a dim pixel each side)
        if (x === mid || x === mid - 1) c = tones[4];
        else if (x === mid + 1 || x === mid - 2) c = tones[2];
      }
      S.put(x, yt + v, c);
      if ((v === STRIP_ROWS[0] || v === STRIP_ROWS[1]) && !seam) {
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

function edgeTop(ky: number, slope: number, kx: number, x: number): number {
  return Math.floor(ky + slope * (x + 0.5 - kx) - 0.5) + 1;
}

interface Pillar {
  k: [number, number];
  sl: number;
  sr: number;
  cx: number;
  side: Side;
}

function PILLARS(): Pillar[] {
  const v = (i: number): [number, number] => rp(ntIso(PLATE_OUTLINE[i][0], PLATE_OUTLINE[i][1]));
  const left = v(0);
  const bl = v(7);
  const br = v(6);
  const right = v(5);
  return [
    { k: left, sl: 0.5, sr: 0.5, cx: left[0] + 6, side: 0 },
    { k: bl, sl: 0.5, sr: 0, cx: bl[0], side: 0 },
    { k: br, sl: 0, sr: -0.5, cx: br[0], side: 0 },
    { k: right, sl: -0.5, sr: -0.5, cx: right[0] - 7, side: 1 },
  ];
}

const PIL_HW = 6;
const CAP_H = 7;

function paintPillar(S: Surface, p: Pillar): void {
  const ramp = p.side === 0 ? NT_PAL.blue : p.side === 1 ? NT_PAL.red : NT_PAL.metal;
  for (let x = p.cx - PIL_HW; x <= p.cx + PIL_HW; x++) {
    const yt = edgeTop(p.k[1], x <= p.k[0] ? p.sl : p.sr, p.k[0], x);
    const k = x - p.cx;
    const ak = Math.abs(k);
    for (let v = 0; v < FACE_H; v++) {
      const t = LIT_ROWS[v];
      let c: Color;
      if (ak === PIL_HW) c = INK;
      else {
        const base: Color = t === 'S' || t === 'L' || t === 'l' ? N1 : t;
        const d = k < -3 ? 1 : k < 0 ? 1 : k === 0 || k === 1 ? 1 : k < 4 ? -1 : -1;
        c = base === INK ? INK : shiftTone(base, d);
      }
      if (v === STRIP_ROWS[0] || v === STRIP_ROWS[1]) {
        // readability pass: the pillar's accent one tone lower (dim seam, no neon dot)
        if (ak <= 3) c = ak === 3 ? N0 : ramp[0];
        else if (ak < PIL_HW) c = N0;
      }
      S.put(x, yt + v, c);
    }
    const top = ak <= 3 ? -CAP_H : ak <= 5 ? -CAP_H + 1 : -CAP_H + 2;
    for (let v = top; v < 0; v++) {
      let c: Color;
      if (ak === PIL_HW || v === top) c = INK;
      else if (v === top + 1) c = k <= 0 ? N2 : N1;
      else if (v === -1) c = N0;
      else c = k < -1 ? N2 : k < 1 ? N1 : G0;
      if ((v === top + 3 || v === top + 4) && ak <= 1) c = ramp[0];
      S.put(x, yt + v, c);
    }
  }
}

// ---------------------------------------------------------------- corner blocks

function paintCorners(S: Surface): PlatformArt['corners'] {
  const out: PlatformArt['corners'] = [];
  const HW = 18;
  const HH = 9;
  const H = 16;
  const spots: { cx: number; cy: number; side: 0 | 1 }[] = [
    { cx: PLATE_X0 + HW, cy: 175, side: 0 },
    { cx: PLATE_X1 - HW, cy: 145, side: 1 },
  ];
  for (const s of spots) {
    paintCube(S, s.cx, s.cy, HW, HH, H, s.side);
    out.push({ x: s.cx, y: s.cy - H - HH, side: s.side });
  }
  return out;
}

function paintCube(S: Surface, cx: number, cy: number, hw: number, hh: number, h: number, side: 0 | 1): void {
  const p = new PixelCanvas(2 * hw + 4, 2 * hh + h + 4);
  const ox = cx - hw - 2;
  const oy = cy - hh - h - 2;
  const lx = (x: number) => x - ox;
  const ly = (y: number) => y - oy;
  const top = cy - h;
  p.poly([[lx(cx - hw), ly(cy)], [lx(cx), ly(cy + hh)], [lx(cx), ly(cy + hh - h)], [lx(cx - hw), ly(top)]], N1);
  p.poly([[lx(cx), ly(cy + hh)], [lx(cx + hw), ly(cy)], [lx(cx + hw), ly(top)], [lx(cx), ly(cy + hh - h)]], N0);
  p.poly([[lx(cx - hw), ly(top)], [lx(cx), ly(top - hh)], [lx(cx + hw), ly(top)], [lx(cx), ly(top + hh)]], N2);
  p.poly([[lx(cx - hw + 5), ly(top)], [lx(cx), ly(top - hh + 2)], [lx(cx + hw - 5), ly(top)], [lx(cx), ly(top + hh - 2)]], N1);
  p.line(lx(cx - hw), ly(top), lx(cx), ly(top - hh), side === 0 ? PAL.earth2 : N3);
  p.line(lx(cx), ly(top - hh), lx(cx + hw), ly(top), N2);
  const ramp = side === 0 ? NT_PAL.blue : NT_PAL.red;
  p.hline(lx(cx - 2), lx(cx + 1), ly(top), ramp[1]);
  p.vline(lx(cx), ly(cy + hh - h), ly(cy + hh), N2);
  const sy = cy - 4;
  p.hline(lx(cx - hw + 3), lx(cx - 4), ly(sy), ramp[1]);
  p.outline(INK);
  for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) {
    const c = p.get(i, j);
    if (c !== null) S.put(ox + i, oy + j, c);
  }
}

// ---------------------------------------------------------------- fx frames

function puffFrames(): [string, PixelCanvas][] {
  const spec: string[][] = [
    ['........', '........', '........', '...3....', '..33....', '...3....', '........', '........'],
    ['........', '........', '...3....', '..43....', '.343....', '..43....', '...3....', '........'],
    ['........', '..3.....', '.343....', '.4343...', '..343...', '...43...', '....3...', '........'],
    ['.3......', '..3..3..', '.3.3....', '...3.3..', '.3......', '..3..3..', '....3...', '.....3..'],
  ];
  const key: Record<string, Color> = { '3': N1, '4': N2 };
  return spec.map((rows, i) => {
    const p = new PixelCanvas(8, 8);
    p.stamp(rows, key, 0, 0);
    return [`puff:${i}`, p] as [string, PixelCanvas];
  });
}

function glintFrames(): [string, PixelCanvas][] {
  const spec: string[][] = [
    ['.......', '.......', '.......', '...w...', '.......', '.......', '.......'],
    ['.......', '.......', '...s...', '..sws..', '...s...', '.......', '.......'],
    ['.......', '...m...', '...s...', '.mswsm.', '...s...', '...m...', '.......'],
  ];
  const key: Record<string, Color> = { w: N3, s: N2, m: N1 };
  return spec.map((rows, i) => {
    const p = new PixelCanvas(7, 7);
    p.stamp(rows, key, 0, 0);
    return [`glint:${i}`, p] as [string, PixelCanvas];
  });
}
