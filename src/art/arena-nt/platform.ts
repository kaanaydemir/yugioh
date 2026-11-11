// Neon Tower painter: PLATFORM — owner A1 (docs/v3/ARENA_NEON_TOWER.md §2 / §5 / §6).
// Readability pass: calm smooth dark slate top plate with subtle texture, warm top-left key light rim along
// the upper-left coping edges, and darkened low-contrast side armour without bright neon strip glare.
// Pure PixelCanvas code (no Phaser): runs in Node for tests. Colours only from src/art/palette.ts.

import { FACE_H, NT_COLS, NT_OX, NT_OY, NT_ROWS, PLATE_C0, PLATE_C1, PLATE_OUTLINE, PLATE_R0, PLATE_R1, PLATE_TABS, PLATE_X0, STAGE_U, STAGE_V, TAB_U, TAB_V, PLATE_X1, PLATE_Y0, PLATE_Y1, ntIso } from '../../view/board-nt/layout-nt';
import { type Color, PixelCanvas } from '../pixel';
import { PAL } from '../palette';
import { NT_PAL } from './palette';
import { type Atlas, Surface, packAtlas } from './platform-pack';
import { BOARD_V4 } from '../../view/layout';
import { RIM_W, floorTone, rimTone } from './stagetop';

/** Texture keys: the platform body (hull, top, shadow) and the fx atlas (frames named inside). */
export const NT_PLATFORM_KEY = 'nt:platform';
export const NT_PLATFORM_FX_KEY = 'nt:platform:fx';

/** Screen rect of the body texture: the plate (104..536 × 52..296) + corner blocks above + the contact shadow around. */
// arena v4 (BOARD_V4): the bigger block (x 116..524, y 36..284 + the 46-px wall) and its shadow
export const PLATFORM_BOX = BOARD_V4 ? ({ x: 84, y: 20, w: 472, h: 330 } as const) : ({ x: 88, y: 36, w: 464, h: 290 } as const);

// ---------------------------------------------------------------- tones

const M = NT_PAL.metal;
const N0 = M[0];
const N1 = M[1];
const N2 = M[2];
const N3 = M[3];
const N4 = M[4];
const INK = NT_PAL.ink;
const G0 = NT_PAL.graphite[0];
const G1 = NT_PAL.graphite[1];
const G2 = NT_PAL.graphite[2];
/** energy tones per side: 0 blue (player), 1 crimson (opponent), 2 neutral (the middle panel of the right face) */
// Readability pass: one tone lower than the original neon (the side armour reads as a dark wall with a faint
// player-coloured seam, not a glowing tube; docs/v3/ref/hedef-gorunum-2.png).
export const STRIP_TONES: Record<0 | 1 | 2, readonly [Color, Color, Color, Color, Color]> = {
  // [-, -, channel line, spill under a window, window light]
  // round 2 (hedef-gorunum-3): the channel is a visible 2-px light run (line + spill), windows one step brighter; the neutral
  // middle panels get the target's small amber windows.
  0: [PAL.night0, PAL.night1, PAL.cyan2, PAL.cyan1, PAL.cyan3],
  1: [PAL.night0, PAL.night1, PAL.crim2, PAL.crim1, PAL.crim3],
  2: [N0, N1, PAL.stone2, PAL.stone1, PAL.gold2],
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
  // arena v5 step 2: the dais tabs (a union: the deeper of the block and a tab wins; side indices as the block's: 0 / 1 the tab's
  // upper-left / lower-right side edges, 2 / 3 its far / near edges)
  for (const t of PLATE_TABS) {
    const td = [(c - t.c0) * 32, (t.c1 - c) * 32, (r - t.r0) * 32, (t.r1 - r) * 32];
    let tb = td[0];
    let ts = 0;
    for (let k = 1; k < 4; k++)
      if (td[k] < tb) {
        tb = td[k];
        ts = k;
      }
    if (tb > best) {
      best = tb;
      side = ts;
    }
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
  /** arena v4 step 3: the walls' small status LEDs (screen px; lit by the view, blinking): side 0 cyan, 1 crimson, 2 amber */
  leds: { x: number; y: number; side: Side }[];
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
  LEDS.length = 0;
  const x0 = PLATFORM_BOX.x;
  const y0 = PLATFORM_BOX.y;
  const x1 = x0 + PLATFORM_BOX.w;
  const y1 = y0 + PLATFORM_BOX.h;

  const faces = faceDefs();
  const cand: { x: number; y: number; tone: Color }[][] = [];
  faces.forEach((f, i) => (BOARD_V4 ? paintFaceV5(S, f, i, vents, rim) : paintFace(S, f, i, strips, cand, vents, rim)));
  lap('faces');
  const dashes = paintTop(S, x0, y0, x1, y1);
  lap('top');
  for (const k of PILLARS()) (BOARD_V4 ? paintPillarV5(S, k) : paintPillar(S, k));
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
    leds: [...LEDS],
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
// hedef-gorunum-3: ONE thin warm bevel line runs round the whole top edge (earth2 where the key light falls, earth1 on the
// shaded near-right edges), a 1-px stone lip inside it, then a dark groove — no coloured perimeter tube.
// Round 2: the far / upper edges (toward the key light) one warm step lighter (earth3, a thin tan-gold line that reads all
// the way round), the near-left / near flat edges earth2, the shaded near-right edge and right cap earth1 (darker, not bright).
// Side index = plateDepth's: 0 upper-left, 1 lower-right, 2 upper-right, 3 lower-left, 4 far flat, 5 near flat, 6 left cap, 7 right cap.
// Round 3: the lit upper edges (upper-left, upper-right, far flat, left cap) one warm step up again: gold2 (a visible warm gold
// rim like the target, still 1 px); the near / shaded edges unchanged.
// Round 4 (critique 3/3 #2): ONE continuous gold rim on every edge (target: a warm gold line all the way round): gold2 on
// the lit and near edges, gold1 on the shaded near-right edge / right cap; the lit edges get a gold3 glint every 6 px and an
// earth1 under-shade row inside (reads as a 2-px bevel, still subtle).
const RIM: readonly Color[] = [PAL.gold2, PAL.gold1, PAL.gold2, PAL.gold2, PAL.gold2, PAL.gold2, PAL.gold2, PAL.gold1];
const RIM_LIT: readonly boolean[] = [true, false, true, false, true, false, true, false];
const RIM2: readonly Color[] = [PAL.earth1, G1, PAL.earth1, G2, PAL.earth1, G2, PAL.earth1, G1];
const RIM3: readonly Color[] = [G0, N0, G0, G0, G0, N0, G0, N0];

/**
 * Readability pass (hedef-gorunum-2.png): the top plate is warm dark stone lit from the top left — flat
 * tone bands (no noise) stepping from warm skin0 near the key light through stone1 to stone0 at the far
 * right / bottom. A low-frequency wave breaks the band edges so they read as stone, not as rings.
 */
function topTone(x: number, y: number): Color {
  // owner decision 2026-11-02 (back to fb7243b): one calm stone tone; only the far bottom-right corner steps down. The
  // texture is the smooth stone-flag overlay (view/board-nt/floor.ts ensurePlateTexture), the warm top-left light the
  // key-light wash of the light layer — no pixel dither on the plate (it read as "dotted").
  const dx = (x - 150) / 470;
  const dy = (y - 110) / 260;
  const wave = 0.03 * Math.sin(x * 0.045 + y * 0.07) + 0.02 * Math.cos(x * 0.021 - y * 0.05);
  // board-top critique round 2 (2026-11-05): the light falloff the target has (lighter upper left, darker lower right) as
  // ONE hard-edged palette band in the atlas — G2 (stone2) on the key-lit back-left side of an iso-diagonal edge
  // (x + 2y = k, the screen direction of the board's columns), G1 (stone1) beyond it; no light-layer wash, no dither.
  if (x + 2 * y + 6 * wave * 100 < KEY_BAND) return G2;
  return Math.hypot(dx, dy) + wave < 0.92 ? G1 : G0;
}
/** board-top critique round 2: where the lit stone2 band ends (screen x + 2y). */
// final arena pass (verifier #2): the lit band pulled back (the +70 widening removed): more of the top is the darker stone1.
const KEY_BAND = 118 + 2 * 62 + 480;

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
      if (BOARD_V4) {
        // (the hidden centre-line dash masks keep their pixels: buildFloorArt packs them)
        if (c >= -0.5 && c < NT_COLS - 0.5 && Math.abs(r - 2) * 32 < 0.5) {
          const k = Math.round(c * 2);
          if ((r - 2) * 32 >= -0.5 && k >= 0 && k <= 12 && k !== 6 && Math.abs(c * 2 - k) <= 0.25) dashPx[k].push({ x, y });
        }
        // arena v5 step 1: worn flagstones, the neutral lane's pavers, the engraved emblem and the carved coping (./stagetop.ts)
        const along = side <= 1 ? 32 * (r - 2) : side <= 3 ? 32 * (c - 3) : side <= 5 ? x : 2 * y;
        const rc = d32 < RIM_W ? rimTone(d32, side, along, x) : null;
        S.put(x, y, rc ?? floorTone(x, y));
        continue;
      }
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
        S.put(x, y, RIM_LIT[side] && x % 6 === 0 ? PAL.gold3 : RIM[side]);
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
    const k = Math.max(1, Math.round(L / 22));
    seams = Array.from({ length: k + 1 }, (_, j) => a[0] + Math.round((L * j) / k));
    vents = k >= 6 ? [2, k - 3] : k >= 3 ? [1] : [];
    void side;
    return { a, b, col, lit, side, seams, vents };
  };
  if (BOARD_V4) {
    // arena v5 step 2: the visible walls, back to front — P2's tab (the sliver of its right face above the far-right edge), the
    // near-left long edge either side of P1's tab, the near flat edge, the near-right long edge, then P1's tab (front + right face)
    const g = (u: number, v: number): [number, number] => [320 + u - v, 160 + (u + v) / 2];
    const p2r = [g(-TAB_U, -TAB_V), g(TAB_U, -TAB_V), g(TAB_U, -STAGE_V)];
    const t1 = [g(-TAB_U, STAGE_V), g(-TAB_U, TAB_V), g(TAB_U, TAB_V), g(TAB_U, STAGE_V)];
    void p2r[0];
    out.push(mk(p2r[2], p2r[1], false, 0, 1));
    out.push(mk(V[0], t1[0], true, PLATE_C0, 0));
    out.push(mk(t1[3], V[7], true, PLATE_C0, 0));
    out.push(mk(V[7], V[6], false, 0, 0));
    out.push(mk(V[6], V[5], false, PLATE_C1, null));
    out.push(mk(t1[1], t1[2], true, PLATE_C0, 0));
    out.push(mk(t1[2], t1[3], false, 0, 0));
    return out;
  }
  out.push(mk(V[0], V[7], true, PLATE_C0, null));
  out.push(mk(V[7], V[6], false, 0, 0));
  out.push(mk(V[6], V[5], false, PLATE_C1, null));
  return out;
}

// ---------------------------------------------------------------- arena v5 step 2: the stone-and-metal walls
// hedef-gorunum-5: a tall chunky wall under the carved coping — two courses of stacked, carved stone blocks (staggered joints, a lit
// top edge per block, chips), a metal ledge, then a band of riveted metal panels: every other panel a slatted vent glowing softly
// in the owner's colour (dim spill rows, a brighter core in the middle of the slats), the others plain plates with a small status
// LED (blinking, the view's) and a recessed name plate; panel seams with a lit edge; a darker plinth at the foot where the wall
// meets the hall floor. Lit = the near-left faces (key light from the top left); the rest one step down. Low contrast: the stage
// veil (view/board-nt/glow.ts) darkens it all; only the vent cores (cyan2 / crim2) and the LEDs stay emissive.
const W5_COURSES = [3, 9] as const; // first row of each stone course (6 rows each, the last a mortar row)
const W5_LEDGE = 15; // ink, lit ledge, shadow
const W5_M0 = 18; // metal band rows 18 .. 39
const W5_M1 = 40;
const W5_PLINTH = 40; // ink, lit lip, body ×3, ink foot

function paintFaceV5(S: Surface, f: FaceDef, id: number, vents: PlatformArt['vents'], rim: PlatformArt['rim']): void {
  const [A, B] = [f.a, f.b];
  const lit = f.lit;
  const slope = (B[1] - A[1]) / (B[0] - A[0]);
  const yTop = (x: number): number => edgeTop(A[1], slope, A[0], x);
  const sideAt = (x: number): 0 | 1 => stripSide(f.side !== null ? f.side : sideOfRow(f.col - (x - NT_OX) / 32), x);
  const L = B[0] - A[0];
  // metal panels ~24 px (at least one), stone joints ~11..19 px per course, staggered
  const np = Math.max(1, Math.round(L / 24));
  const seams = Array.from({ length: np + 1 }, (_, j) => A[0] + Math.round((L * j) / np));
  const joints = W5_COURSES.map((_, ci) => {
    const out: number[] = [];
    let x = A[0] - Math.floor(hash(id * 17 + ci * 5) * 14);
    let k = 0;
    while (x < B[0]) {
      out.push(x);
      x += 11 + Math.floor(hash(id * 131 + ci * 977 + k++ * 13) * 9);
    }
    out.push(x);
    return out;
  });
  const ST = lit ? ([PAL.stone3, PAL.stone2, PAL.stone1, PAL.stone0] as const) : ([PAL.stone2, PAL.stone1, PAL.stone0, INK] as const);
  const MT = lit ? ([N4, N3, N2, N0] as const) : ([N3, N2, N1, INK] as const);
  const lipPts: { x: number; y: number }[] = [];
  for (let x = A[0]; x < B[0]; x++) {
    const yt = yTop(x);
    let pi = 0;
    while (pi + 1 < np && x >= seams[pi + 1]) pi++;
    const sx0 = seams[pi];
    const sx1 = seams[pi + 1];
    const lx = x - sx0;
    const rx = sx1 - 1 - x;
    const mid = (sx0 + sx1) >> 1;
    const vent = (pi + id) % 2 === 0 && sx1 - sx0 >= 14;
    const T = STRIP_TONES[sideAt(x)];
    for (let v = 0; v < FACE_H; v++) {
      let c: Color;
      if (v < 3) c = v === 0 ? ST[0] : v === 1 ? ST[1] : INK;
      else if (v < W5_LEDGE) {
        // stone courses: per block tone, a lit top row, the mortar row, a lit joint lip, the odd chip
        const ci = v < W5_COURSES[1] ? 0 : 1;
        const u = v - W5_COURSES[ci];
        const js = joints[ci];
        let bi = 0;
        while (bi + 1 < js.length - 1 && x >= js[bi + 1]) bi++;
        const jx = x - js[bi];
        const jr = js[bi + 1] - 1 - x;
        const bt = hash(bi * 7 + ci * 31 + id * 211);
        const body = bt < 0.3 ? ST[2] : ST[1];
        if (u === 5) c = INK;
        else if (jx === 0) c = INK;
        else if (u === 0) c = jx === 1 ? ST[1] : ST[0];
        else if (jx === 1) c = ST[0];
        else if (jr === 0 || u === 4) c = ST[2];
        else c = body;
        // a knocked-off block corner (dark pit, lit lower lip) and moss in an odd joint
        if (bt > 0.8 && jr <= 2 && u <= 2 && jr + u <= 2) c = u === 2 || jr === 2 ? ST[0] : ST[3];
        if (bt < 0.06 && jx <= 2 && u >= 3 && u <= 4) c = PAL.leaf0;
      } else if (v < W5_M0) {
        const u = v - W5_LEDGE;
        c = u === 0 ? INK : u === 1 ? MT[0] : MT[3];
      } else if (v < W5_M1) {
        const u = v - W5_M0;
        const H = W5_M1 - W5_M0;
        // panel: lit top row, body, a darker foot row; seam (ink + lit edge)
        c = u === 0 ? MT[0] : u >= H - 2 ? MT[2] : MT[1];
        if (lx === 0 && pi > 0) c = INK;
        else if (lx === 1 && pi > 0) c = MT[0];
        else if (rx === 0 && pi < np - 1) c = MT[2];
        // rivets at the four corners (a bright head, its shadow below)
        const rv = (lx === 3 || rx === 2) && (u === 2 || u === H - 4);
        const rvs = (lx === 3 || rx === 2) && (u === 3 || u === H - 3);
        if (rv) c = lit ? M[5] : N4;
        else if (rvs) c = INK;
        else if (vent) {
          // the slatted vent: an ink frame, slats (dark) over a soft glow (spill rows; the middle of every other glow row hotter)
          const vx = Math.abs(x - mid + 0.5);
          const hw = Math.min(9, (sx1 - sx0) / 2 - 5);
          if (u >= 5 && u <= H - 6 && vx < hw + 1) {
            if (u === 5 || u === H - 6 || vx >= hw) c = INK;
            else if (u % 2 === 0) c = INK;
            else c = vx < 2 && u % 4 === 1 ? T[4] : vx < hw - 3 ? T[2] : T[3];
          }
        } else {
          // a recessed name plate (ink top / left, lit bottom / right) and a status LED (blinks, the view's)
          const px0 = 5;
          const pw = Math.min(10, sx1 - sx0 - 12);
          if (pw >= 4 && lx >= px0 && lx < px0 + pw && u >= 9 && u <= 12) c = u === 9 || lx === px0 ? INK : u === 12 || lx === px0 + pw - 1 ? MT[0] : MT[2];
          if (rx === 4 && u === 6) c = N0;
          if (rx === 4 && u === 7) c = MT[3];
        }
        // wear: a scuff along the foot of some panels
        if (u === H - 3 && hash(x * 3 + id) < 0.12) c = MT[3];
      } else {
        const u = v - W5_PLINTH;
        c = u === 0 ? INK : u === 1 ? ST[1] : u === FACE_H - W5_PLINTH - 1 ? INK : u === 2 ? ST[2] : ST[3];
        if (u === 1 && hash(x * 7 + id * 3) < 0.1) c = ST[2]; // a worn chip in the plinth's lip
      }
      S.put(x, yt + v, c);
    }
    if (!vent && rx === 4) LEDS.push({ x, y: yt + W5_M0 + 6, side: f.side === null ? sideOfRow(f.col - (x - NT_OX) / 32) : f.side });
    lipPts.push({ x, y: yt - 1 });
  }
  for (let pi = 0; pi < np; pi++)
    if ((pi + id) % 2 === 0) {
      const vx = (seams[pi] + seams[pi + 1]) >> 1;
      vents.push({ x: vx, y: yTop(vx) + W5_M0 + 8, dir: lit ? -1 : 1 });
    }
  if (L > 60) rim.push(lipPts);
}

/** arena v5 step 2: a corner post where two wall faces meet — a carved stone quoin column (lit left, shaded right, course lines). */
function paintPillarV5(S: Surface, p: Pillar): void {
  for (let x = p.cx - PIL_HW; x < p.cx + PIL_HW; x++) {
    const yt = edgeTop(p.k[1], x <= p.k[0] ? p.sl : p.sr, p.k[0], x);
    const k = x - p.cx;
    for (let v = 3; v < W5_PLINTH; v++) {
      let c: Color = k === -2 ? PAL.stone3 : k === -1 ? PAL.stone2 : k === 0 ? PAL.stone1 : INK;
      if ((v - 3) % 6 === 5 || v === W5_LEDGE) c = k === -2 ? PAL.stone2 : INK;
      S.put(x, yt + v, c);
    }
  }
}

// hedef-gorunum-3 (arena pass 2026-11-05): a THICK stage wall of grey-navy armour panels. Rows (FACE_H = 46):
// coping 3 (lit lip under the warm top bevel), upper panel band UP_N, ink seam, light channel 3 (one player-coloured
// line), ink seam, the main panel band (small lit windows / vent grilles / plain insets), ink seam, belt 3, footing 2.
// Vertical panel seams every ~22 px. Lit = the near-left face (key light from the top left), the others one tone darker.
const COP_N = 3;
const UP0 = COP_N;
const UP_N = 11; // round 4: wall trimmed 58 -> 46, the upper band takes the cut (main window band keeps its height)
const CH0 = UP0 + UP_N + 1;
const CH_N = 3;
const MAIN0 = CH0 + CH_N + 1;
const MAIN_N = FACE_H - MAIN0 - 7;
const BELT0 = MAIN0 + MAIN_N + 1;
const STRIP_ROWS = [CH0 + 1, CH0 + 1] as const;
/** Base wall tones per face: [coping lip, coping, upper hi, upper body, upper low, main hi, main body, main low]. */
// Round 2: grey-slate armour (hedef-gorunum-3's walls are grey-blue panels with lighter faces, not navy): stone ramp, the lit
// face one step up on its highlights, seams stay ink.
// Round 3: one stone step darker (calm dark wall; the lit top and the board read first). Lit face body stone1 with stone2
// highlights; shaded faces body stone0 with stone1 highlights; seams ink.
const WALL_LIT = [PAL.stone2, PAL.stone1, PAL.stone2, PAL.stone1, PAL.stone0, PAL.stone2, PAL.stone1, PAL.stone0] as const;
const WALL_SHD = [PAL.stone1, PAL.stone0, PAL.stone1, PAL.stone0, INK, PAL.stone1, PAL.stone0, INK] as const;
/** arena v4 step 3: the LED spots collected while painting the faces (buildPlatformArt copies them out). */
const LEDS: PlatformArt['leds'] = [];
/** arena v4 step 3: the owner colour of the coping light strip at x on a face (the neutral middle splits at the right face's middle). */
const stripSide = (s: Side, x: number): 0 | 1 => (s === 2 ? (x < 448 ? 0 : 1) : s);
const hash = (n: number): number => {
  let h = (n * 374761393) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

function paintFace(S: Surface, f: FaceDef, id: number, strips: Omit<StripPiece, 'frame'>[], cand: { x: number; y: number; tone: Color }[][], vents: PlatformArt['vents'], rim: PlatformArt['rim']): void {
  const [A, B] = [f.a, f.b];
  const W = f.lit ? WALL_LIT : WALL_SHD;
  const slope = (B[1] - A[1]) / (B[0] - A[0]);
  const yTop = (x: number): number => edgeTop(A[1], slope, A[0], x);
  const sideAt = (x: number): Side => (f.side !== null ? f.side : f.lit ? 0 : sideOfRow(f.col - (x - NT_OX) / 32));
  const lipPts: { x: number; y: number }[] = [];
  const panelOf = (x: number): number => {
    let i = 0;
    while (i + 1 < f.seams.length - 1 && x >= f.seams[i + 1]) i++;
    return i;
  };
  const kindOf = (pi: number): number => {
    if (f.vents.includes(pi)) return 3; // vent grille
    // Round 3: calm wall, roughly one lit panel per 3 (0 a pair of lit windows); the rest plain insets (1) or rib pairs (2)
    if (pi % 3 === 1) return 0;
    // round 4 (critique 3/3 #4): the right (P2 / neutral) face is mostly hidden by the P2 dais and the hint plate, so it
    // gets a lit pair on every other panel — the crimson windows read in the open spans between them
    if (!f.lit && f.side === null && pi % 2 === 1) return 0;
    // the P1 face's open span left of the P1 dais holds panels 0..2 only: light panel 0 too, so two cyan groups read there
    if (f.lit && pi === 0) return 0;
    if (pi % 3 === 2 && f.vents.includes(pi - 1)) return 0; // a vent took the lit panel: the window moves one panel on
    return hash(pi * 7 + id * 131) < 0.6 ? 1 : 2;
  };
  const runs = new Map<number, { x: number; y: number; tone: Color }[]>();
  const wins: { x: number; v: number; side: Side; tall: boolean }[] = [];
  for (let x = A[0]; x < B[0]; x++) {
    const yt = yTop(x);
    const pi = panelOf(x);
    const sx0 = f.seams[pi];
    const sx1 = f.seams[pi + 1];
    const plen = sx1 - sx0;
    const lx = x - sx0;
    const rx = sx1 - 1 - x;
    const seamInk = lx === 0 && pi > 0;
    const seamLit = lx === 1 && pi > 0;
    const side = sideAt(x);
    const tones = STRIP_TONES[side];
    const kind = kindOf(pi);
    const mid = (sx0 + sx1) >> 1;
    for (let v = 0; v < FACE_H; v++) {
      let c: Color;
      const top = STRIP_TONES[stripSide(side, x)];
      if (v < COP_N) {
        c = v === 0 ? W[0] : v === 1 ? W[1] : INK;
        // arena v4 step 3: a light strip in the owner's colour right under the chamfered top edge (a bright 1-px line over a
        // dim spill row), broken at every panel seam by a dark clip; a brighter bead in each panel's middle
        if (BOARD_V4 && v === 1) c = seamInk || seamLit ? INK : Math.abs(x - mid) < 2 ? top[4] : top[2];
        if (BOARD_V4 && v === 2) c = seamInk || seamLit ? INK : top[3];
      } else if (v < UP0 + UP_N) {
        const u = v - UP0;
        c = u === 0 ? W[2] : u < UP_N - 1 ? W[3] : W[4];
        if (u >= 1 && u < UP_N - 1 && lx === 2 && pi >= 0) c = W[2];
        if (u >= 1 && rx === 0) c = W[4];
        // round 4 (#5): every second panel carries a 1-px top highlight (slight panel relief, not a flat wall)
        if (u === 1 && pi % 2 === 0 && lx >= 2 && rx >= 1) c = W[2];
        // a tiny status pip in the upper right of every other panel (player colour, 1 px)
        if (u === 3 && rx === 4 && (pi + id) % 2 === 0) c = BOARD_V4 ? N0 : tones[4];
        if (BOARD_V4) {
          // step 3: a small slatted grille in the upper band of every other panel (dark slots, a lit lower lip each)
          const gx = x - (sx0 + 4);
          if ((pi + id) % 2 === 1 && gx >= 0 && gx < Math.min(10, plen - 9) && u >= 3 && u <= 8) c = u % 2 === 1 ? INK : W[4];
          // rivets at the panel's upper corners
          if (u === 1 && (lx === 3 || rx === 2)) c = W[0];
        }
      } else if (v === CH0 - 1 || v === MAIN0 - 1 || v === BELT0 - 1) c = INK;
      else if (v < CH0 + CH_N) {
        const u = v - CH0;
        c = u === 0 ? INK : u === 1 ? (lx <= 1 || rx <= 1 ? N0 : tones[2]) : tones[3];
        if (u === 2 && (lx <= 1 || rx <= 1)) c = N0;
      } else if (v < MAIN0 + MAIN_N) {
        const u = v - MAIN0;
        c = u === 0 ? W[5] : u < MAIN_N - 2 ? W[6] : W[7];
        if (lx === 2 && u >= 1 && u < MAIN_N - 2) c = W[5];
        if (rx === 0 && u >= 1) c = W[7];
        const cx = x - mid;
        if (kind === 3 && Math.abs(cx + 0.5) < 6 && u >= 5 && u <= MAIN_N - 6) c = u % 2 === 1 ? INK : W[7]; // vent grille
        else if (kind === 2 && (cx === -3 || cx === 3) && u >= 3 && u <= MAIN_N - 4) c = INK; // recessed rib pair
        else if (kind === 2 && (cx === -2 || cx === 4) && u >= 3 && u <= MAIN_N - 4) c = W[5];
        else if (kind === 1 && lx >= 5 && rx >= 4 && (u === 4 || u === MAIN_N - 5) ) c = u === 4 ? W[7] : W[5]; // plain inset edge
      } else {
        const u = v - BELT0;
        c = u === 0 ? W[1] : u === 1 ? W[6] : u === 2 ? N0 : u === 3 ? N0 : INK;
        if (u === 1 && (x === mid || x === mid - 1) && kind !== 3) c = tones[2]; // belt marker light
      }
      if (seamInk && v >= COP_N) c = INK;
      else if (seamLit && v >= COP_N && v < FACE_H - 2) c = v === CH0 + 1 ? N0 : W[f.lit ? 2 : 5];
      S.put(x, yt + v, c);
      if (v === STRIP_ROWS[0] && !seamInk && !seamLit && c === tones[2]) {
        const arr = runs.get(pi) ?? [];
        arr.push({ x, y: yt + v, tone: tones[2] });
        runs.set(pi, arr);
      }
    }
    if (BOARD_V4 && rx === 4 && (pi + id) % 2 === 0) LEDS.push({ x, y: yt + UP0 + 3, side });
    if (BOARD_V4 && x === mid && kind !== 0 && kind !== 3 && pi % 2 === 1) LEDS.push({ x, y: yt + BELT0 + 1, side: 2 });
    if (x === mid - 4 && kind === 0) wins.push({ x, v: MAIN0 + 4, side, tall: true });
    if (x === mid + 1 && kind === 0) wins.push({ x, v: MAIN0 + 4, side, tall: true });
    lipPts.push({ x, y: yt - 1 });
  }
  // small lit windows: axis-aligned 3×2 (pair panels) / 3×2 (single) lights (no shear), an ink frame, a dim spill line under
  // them; the top row is the bright window tone, the lower one step down (reads as a lit pane, not a dot)
  for (const w of wins) {
    const T = STRIP_TONES[w.side];
    const y0 = yTop(w.x) + w.v;
    const h = w.tall ? 3 : 2;
    const ww = 3;
    for (let dx = -1; dx <= ww; dx++)
      for (let dy = -1; dy <= h; dy++) {
        const frame = dx === -1 || dx === ww || dy === -1 || dy === h;
        S.put(w.x + dx, y0 + dy, frame ? INK : dy === 0 ? T[4] : T[2]);
      }
    for (let dx = 0; dx < ww; dx++) S.put(w.x + dx, y0 + h + 1, T[3]);
  }
  for (const pi of f.vents) {
    const vx = (f.seams[pi] + f.seams[pi + 1]) >> 1;
    vents.push({ x: vx, y: yTop(vx) + MAIN0 + 6, dir: f.lit ? -1 : 1 });
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
  if (BOARD_V4) {
    // arena v5 step 2: the octagon's visible corners + P1's tab (its left silhouette corner, its front-right corner)
    const tl: [number, number] = [320 - TAB_U - TAB_V, 160 + (TAB_V - TAB_U) / 2];
    const tr: [number, number] = [320 + TAB_U - TAB_V, 160 + (TAB_V + TAB_U) / 2];
    return [
      { k: v(0), sl: 0.5, sr: 0.5, cx: v(0)[0] + 2, side: 0 },
      { k: v(7), sl: 0.5, sr: 0, cx: v(7)[0], side: 0 },
      { k: v(6), sl: 0, sr: -0.5, cx: v(6)[0], side: 0 },
      { k: v(5), sl: -0.5, sr: -0.5, cx: v(5)[0] - 2, side: 1 },
      { k: tl, sl: 0.5, sr: 0.5, cx: tl[0] + 2, side: 0 },
      { k: tr, sl: 0.5, sr: -0.5, cx: tr[0], side: 0 },
    ];
  }
  const left = v(0);
  const bl = v(7);
  const br = v(6);
  const right = v(5);
  return [
    { k: left, sl: 0.5, sr: 0.5, cx: left[0] + 2, side: 0 },
    { k: bl, sl: 0.5, sr: 0, cx: bl[0], side: 0 },
    { k: br, sl: 0, sr: -0.5, cx: br[0], side: 0 },
    { k: right, sl: -0.5, sr: -0.5, cx: right[0] - 2, side: 1 },
  ];
}

const PIL_HW = 2;

/** A flush corner post where two wall faces meet: a lit left column, a dark right one, a player-coloured pip in the channel. */
function paintPillar(S: Surface, p: Pillar): void {
  const ramp = p.side === 0 ? NT_PAL.blue : p.side === 1 ? NT_PAL.red : NT_PAL.metal;
  for (let x = p.cx - PIL_HW; x < p.cx + PIL_HW; x++) {
    const yt = edgeTop(p.k[1], x <= p.k[0] ? p.sl : p.sr, p.k[0], x);
    const k = x - p.cx;
    for (let v = COP_N; v < FACE_H - 1; v++) {
      let c: Color = k === -2 ? PAL.stone3 : k === -1 ? PAL.stone2 : k === 0 ? PAL.stone1 : INK;
      if (v === CH0 + 1 && (k === -1 || k === 0)) c = ramp[1];
      else if (v === CH0 - 1 || v === MAIN0 - 1 || v === BELT0 - 1) c = k === -2 ? PAL.stone2 : INK;
      S.put(x, yt + v, c);
    }
  }
}

// ---------------------------------------------------------------- corner blocks

function paintCorners(S: Surface): PlatformArt['corners'] {
  // hedef-gorunum-3: the tight stage has no corner cubes (they would stand on the tiles' margin); kept for a later return
  if (S) return [];
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
