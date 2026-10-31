// Neon Tower painter: crowd (docs/v3/ARENA_NEON_TOWER.md §2 / §5 / §8).
// The spectator ATLAS: 9 looks × (13 shared + 2 × 5 team) frames of 14×22 px, pre-baked in code (pure PixelCanvas,
// no Math.random, no Phaser: runs in Node for tests). One texture, one grid:
//   row = look (0…8), column = frame id (CF_*), cell 14×22; the feet are at the bottom edge and the stand's railing
//   hides the lowest 4 rows (seats.ts RAIL_H), so a SEATED spectator shows head + shoulders (10 px), a STANDING one
//   13 px, arms-up ones reach the cell top.
// Spectators face RIGHT (the left stand looks at the platform that way; the right stand uses the same art mirrored
// with Bob.flipX). They are LIGHTER than the stands behind them (mid-tone clothes, light skin, bright hair accents)
// and carry a 1-px RIM LIGHT on the platform side (right edge of head and torso). The brightest pixels of the whole
// crowd are the glow sticks (team colour: blue on the left stand, crimson on the right).

import { PAL, RAMPS } from '../palette';
import { PixelCanvas, shade as rampShade } from '../pixel';

const PAL_SET = new Set<number>(Object.values(PAL));
/** Palette-safe ramp step: a colour the ramps do not know (or a step off the ramp's end) stays as it is. */
function shade(c: number, steps: number): number {
  const r = rampShade(c, steps);
  return PAL_SET.has(r) ? r : c;
}

/** Texture key of the crowd atlas. */
export const NT_CROWD_KEY = 'nt:crowd';

/** Spectator frame size inside the atlas (the layer places it at feet.y − CROWD_FH). */
export const CROWD_FW = 14;
export const CROWD_FH = 22;
export const CROWD_LOOKS = 9;

// ---- frame ids (columns of the atlas) ------------------------------------------------------------
export const CF_SIT0 = 0; // seated, breathing (head + shoulders 1 px up / down)
export const CF_SIT1 = 1;
export const CF_STAND0 = 2; // standing, small bounce
export const CF_STAND1 = 3;
export const CF_CLAP0 = 4; // clapping: hands together / apart
export const CF_CLAP1 = 5;
export const CF_GASP = 6; // hands to the cheeks, open mouth
export const CF_UP0 = 7; // both arms up, alternating heights, mouth open
export const CF_UP1 = 8;
export const CF_LEAN = 9; // seated, leaning toward the platform
export const CF_TURN = 10; // seated, head turned away (talking to the neighbour)
export const CF_WAVE0 = 11; // seated, one hand waving
export const CF_WAVE1 = 12;
/** Team frames (stick in the raised hand): seated 3 sway frames, standing arms-up 2 frames. */
export const CF_STICK_SIT0 = 13; // …15
export const CF_STICK_UP0 = 16; // …17
export const CROWD_SHARED = 13;
export const CROWD_TEAM = 5;
export const CROWD_COLS = CROWD_SHARED + 2 * CROWD_TEAM; // 23

/** Atlas column of a frame id for a team (0 blue / 1 red); shared ids ignore the team. */
export function crowdCol(id: number, team: 0 | 1): number {
  return id < CROWD_SHARED ? id : CROWD_SHARED + team * CROWD_TEAM + (id - CROWD_SHARED);
}

/** Frame name used in the Phaser texture: `<look>:<column>`. */
export function crowdFrameName(look: number, col: number): string {
  return `${look}:${col}`;
}

// ---- looks ------------------------------------------------------------------------------------------

type Hair = 'short' | 'long' | 'spiky' | 'bald' | 'cap' | 'hood' | 'beanie';
type Detail = 'none' | 'stripe' | 'zip' | 'strings' | 'bands';

interface Look {
  hair: Hair;
  /** hair / cap / hood base + shade */
  h0: number;
  h1: number;
  /** skin base, shade, light */
  s0: number;
  s1: number;
  s2: number;
  /** shirt base, shade, light edge */
  c0: number;
  c1: number;
  c2: number;
  /** accent (cap brim, stripe, beanie roll, strings) */
  trim: number;
  detail: Detail;
}

const N = RAMPS.night;
const V = RAMPS.void;
const E = RAMPS.earth;
const G = RAMPS.gold;
const T = RAMPS.teal;
const K = RAMPS.skin;
const R = RAMPS.crim;
const C = RAMPS.cyan;

/** Nine distinct looks (hair style / colour / skin / clothes). Mid tones: lighter than the stands, darker than the platform edge. */
const LOOKS: readonly Look[] = [
  // 0 brown short hair, slate-blue jacket with a zip
  { hair: 'short', h0: E[2], h1: E[1], s0: K[2], s1: K[1], s2: K[3], c0: N[4], c1: N[3], c2: PAL.steel, trim: N[2], detail: 'zip' },
  // 1 blonde long hair, dull crimson top
  { hair: 'long', h0: G[2], h1: G[1], s0: K[3], s1: K[2], s2: K[4], c0: R[1], c1: R[0], c2: R[2], trim: R[3], detail: 'none' },
  // 2 violet spiky hair, dark jacket with a gold stripe
  { hair: 'spiky', h0: V[3], h1: V[2], s0: K[2], s1: K[1], s2: K[3], c0: N[2], c1: N[1], c2: N[3], trim: G[2], detail: 'stripe' },
  // 3 black hair (rimmed), teal hoodie strings
  { hair: 'short', h0: N[2], h1: N[1], s0: K[1], s1: K[0], s2: K[2], c0: T[1], c1: T[0], c2: T[2], trim: T[3], detail: 'strings' },
  // 4 red cap, mustard-brown shirt
  { hair: 'cap', h0: R[2], h1: R[1], s0: K[3], s1: K[2], s2: K[4], c0: G[1], c1: G[0], c2: G[2], trim: R[0], detail: 'none' },
  // 5 shaved head, violet top with bands
  { hair: 'bald', h0: K[1], h1: K[0], s0: K[1], s1: K[0], s2: K[2], c0: V[1], c1: V[0], c2: V[2], trim: V[3], detail: 'bands' },
  // 6 grey hair, cyan coat
  { hair: 'short', h0: PAL.mist, h1: PAL.steel, s0: K[3], s1: K[2], s2: K[4], c0: C[1], c1: C[0], c2: C[2], trim: C[3], detail: 'zip' },
  // 7 teal long hair, slate top with a stripe
  { hair: 'long', h0: T[2], h1: T[1], s0: K[2], s1: K[1], s2: K[3], c0: N[3], c1: N[2], c2: N[4], trim: T[3], detail: 'stripe' },
  // 8 hooded, earth jacket
  { hair: 'hood', h0: E[2], h1: E[1], s0: K[2], s1: K[1], s2: K[3], c0: E[1], c1: E[0], c2: E[2], trim: E[3], detail: 'strings' },
];
// (a ninth hair style 'beanie' is drawn by look 4's alternate in drawHead when requested; kept for future looks)

/** Glow stick colours per team: [body, tip, halo]. Brightest pixels of the whole crowd. */
const STICK: readonly [number, number, number][] = [
  [C[3], PAL.white, C[1]],
  [R[3], PAL.white, R[1]],
];

// ---- heads ---------------------------------------------------------------------------------------------

interface HeadMap {
  /** one row above the head box (spikes, pompom), x 0…5 */
  above?: string;
  /** six rows, x 0…5 (facing right: the back of the head is on the left) */
  rows: readonly string[];
}
const HEADS: Record<Hair, HeadMap> = {
  short: { rows: ['.hhgg.', 'hhhggh', 'Hhsssl', 'HsssEl', '.sssSl', '..SSS.'] },
  long: { rows: ['.hhgg.', 'hhhghh', 'hhsssl', 'hhssEl', 'hHsssS', 'hH.SS.'] },
  spiky: { above: '.h.hgh', rows: ['hhhhgh', 'hHhHgh', 'Hhsssl', 'HsssEl', '.sssSl', '..SSS.'] },
  bald: { rows: ['.slll.', 'sslsll', 'Ssssll', 'SsssEl', '.sssSl', '..SSS.'] },
  cap: { rows: ['.hhgg.', 'hhhhgh', 'Hhsssl', 'HsssEl', '.sssSl', '..SSS.'] },
  hood: { rows: ['.hhgg.', 'hhhghh', 'hhsssh', 'hHssEh', '.hsSsh', '..hhh.'] },
  beanie: { above: '...b..', rows: ['.bbbb.', 'BBBBBB', 'hsssss', 'hsssEs', '.ssSs.', '..SS..'] },
};

/** Draw a head box at (hx, hy). `away` mirrors it (looking back, away from the platform). */
function drawHead(p: PixelCanvas, L: Look, hx: number, hy: number, away: boolean, mouth: boolean): void {
  const map = HEADS[L.hair];
  const key: Record<string, number> = { h: L.h0, H: L.h1, g: shade(L.h0, 1), s: L.s0, S: L.s1, l: L.s2, E: PAL.ink, b: L.trim, B: L.trim };
  if (L.hair === 'cap') {
    key.h = L.h0;
    key.H = K[0] === L.s1 ? L.s1 : L.h1;
  }
  const flip = away;
  if (map.above) p.stamp([map.above], key, hx, hy - 1, { flipX: flip });
  p.stamp(map.rows, key, hx, hy, { flipX: flip });
  if (L.hair === 'cap') {
    // brim toward the platform (the cap's lower edge, row 1)
    const bx = flip ? hx - 2 : hx + 6;
    p.set(bx, hy + 1, L.trim);
    p.set(bx + 1, hy + 1, L.trim);
    p.set(flip ? hx - 1 : hx + 5, hy + 2, L.s1);
  }
  if (mouth) {
    const mx = flip ? hx + 2 : hx + 3;
    p.set(mx, hy + 4, PAL.ink);
    p.set(mx + 1, hy + 4, PAL.ink);
  }
  if (L.hair === 'long') {
    // hair falls behind the shoulder
    const bx = flip ? hx + 4 : hx;
    p.rect(bx, hy + 6, 2, 2, L.h0);
    p.set(bx + (flip ? 1 : 0), hy + 7, L.h1);
  }
}

// ---- poses ---------------------------------------------------------------------------------------------

type Arms = 'down' | 'clap0' | 'clap1' | 'up0' | 'up1' | 'gasp' | 'wave0' | 'wave1' | 'stickSit' | 'stickUp';

interface Pose {
  /** head top-left y; the head box is 6 px wide */
  hy: number;
  /** shoulder row */
  ty: number;
  /** torso / head shift toward the platform (leaning) */
  lean?: number;
  arms: Arms;
  /** looking away */
  away?: boolean;
  /** open mouth */
  mouth?: boolean;
  /** stick lean: 0 vertical, 1 toward the platform, 2 away */
  stick?: 0 | 1 | 2;
}

function drawTorso(p: PixelCanvas, L: Look, ty: number, tx: number): void {
  const x0 = 3 + tx;
  const h = CROWD_FH - ty;
  p.rect(x0 + 1, ty, 6, 1, L.c0); // shoulders
  p.rect(x0, ty + 1, 8, h - 1, L.c0);
  p.vline(x0, ty + 1, CROWD_FH - 1, L.c1); // far sleeve shade
  p.vline(x0 + 1, ty + 3, CROWD_FH - 1, shade(L.c0, 0)); // keep the arm line readable
  p.vline(x0 + 6, ty + 2, CROWD_FH - 1, L.c1); // near sleeve seam
  p.vline(x0 + 7, ty + 1, CROWD_FH - 1, L.c2); // rim light on the platform side
  p.set(x0 + 6, ty, L.c2);
  p.set(x0 + 5, ty, L.c2);
  p.set(x0 + 1, ty, L.c1);
  // neck shadow under the chin + collar
  p.set(x0 + 3, ty, L.s1);
  p.set(x0 + 4, ty, L.s1);
  p.set(x0 + 2, ty + 1, L.c1);
  p.set(x0 + 5, ty + 1, L.c1);
  // a soft fold across the chest
  p.hline(x0 + 2, x0 + 5, ty + 4, L.c1);
  p.set(x0 + 2, ty + 3, L.c2);
  switch (L.detail) {
    case 'zip':
      p.vline(x0 + 3, ty + 1, CROWD_FH - 1, L.c1);
      p.set(x0 + 3, ty + 1, L.c2);
      break;
    case 'stripe':
      p.hline(x0 + 1, x0 + 5, ty + 2, L.trim);
      break;
    case 'strings':
      p.vline(x0 + 3, ty + 1, ty + 3, L.trim);
      p.vline(x0 + 4, ty + 1, ty + 2, L.trim);
      break;
    case 'bands':
      p.hline(x0 + 1, x0 + 5, ty + 1, L.c1);
      p.hline(x0 + 1, x0 + 5, ty + 3, L.c1);
      break;
    default:
      break;
  }
}

/** Lighten the right-most opaque pixel of every row y0…y1 (the 1-px rim light of the platform side). */
function rimLight(p: PixelCanvas, y0: number, y1: number): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = CROWD_FW - 1; x >= 0; x--) {
      if (!p.isOpaque(x, y)) continue;
      const c = p.get(x, y);
      if (c !== null && c !== PAL.ink) p.set(x, y, shade(c, 1));
      break;
    }
  }
}

/** A 2-px wide arm from (x, y0) down to the shoulder y1, hand (2×2 skin) on top. */
function arm(p: PixelCanvas, L: Look, x: number, top: number, y1: number, near: boolean): void {
  p.rect(x, top + 2, 2, y1 - top - 1, L.c0);
  p.vline(near ? x + 1 : x, top + 2, y1, near ? L.c2 : L.c1);
  p.rect(x, top, 2, 2, L.s0);
  p.set(x + (near ? 1 : 0), top, L.s2);
}

function drawStick(p: PixelCanvas, team: 0 | 1, bx: number, by: number, len: number, lean: 0 | 1 | 2): void {
  const [body, tip, halo] = STICK[team];
  // base at (bx, by) going up; lean 1 steps right every 2 px, lean 2 steps left. Two px thick: lit column + dim column.
  const dx = lean === 1 ? 1 : lean === 2 ? -1 : 0;
  let x = bx;
  for (let i = 0; i < len; i++) {
    const y = by - i;
    if (dx !== 0 && i === 2) x += dx;
    if (dx !== 0 && i === 4) x += dx;
    const hot = i >= len - 3;
    p.set(x, y, hot ? tip : body);
    if (i < len - 1) p.set(x + 1, y, hot ? body : halo);
  }
  const ty = by - len + 1;
  // bloom around the tip
  p.set(x - 1, ty, halo);
  p.set(x + 2, ty, halo);
  p.set(x, ty - 1, tip);
  p.set(x + 1, ty - 1, body);
  p.set(x, ty - 2, halo);
  p.set(x + 1, ty - 2, halo);
  p.set(x - 1, ty - 1, halo);
  p.set(x + 2, ty - 1, halo);
}

/** A dark 1-px outline around the sprite (left, right and top; never the bottom edge the railing hides). */
function outlineSprite(p: PixelCanvas): void {
  const add: number[] = [];
  for (let y = 0; y < p.h - 1; y++)
    for (let x = 0; x < p.w; x++) {
      if (p.isOpaque(x, y)) continue;
      if (p.isOpaque(x - 1, y) || p.isOpaque(x + 1, y) || p.isOpaque(x, y + 1)) add.push(x, y);
    }
  for (let i = 0; i < add.length; i += 2) p.set(add[i], add[i + 1], N[0]);
}

/** One spectator frame in a fresh 14×22 canvas. */
function drawSpectator(L: Look, pose: Pose, team: 0 | 1): PixelCanvas {
  const p = new PixelCanvas(CROWD_FW, CROWD_FH);
  const { hy, ty, arms } = pose;
  const tx = pose.lean ?? 0;
  drawTorso(p, L, ty, tx);
  drawHead(p, L, 4 + tx, hy, !!pose.away, !!pose.mouth);
  rimLight(p, hy - 1, hy + 5);
  const x0 = 3 + tx;
  let stick: (() => void) | null = null;
  switch (arms) {
    case 'down':
      break;
    case 'clap0': {
      p.line(x0 + 1, ty + 1, 6, ty + 3, L.c2);
      p.line(x0 + 6, ty + 1, 7, ty + 3, L.c2);
      p.rect(6, ty + 2, 2, 2, L.s0);
      p.set(6, ty + 2, L.s2);
      break;
    }
    case 'clap1': {
      p.vline(x0, ty + 1, ty + 3, L.c2);
      p.vline(x0 + 7, ty + 1, ty + 3, L.c2);
      p.rect(x0 - 1, ty + 3, 2, 2, L.s0);
      p.rect(x0 + 7, ty + 3, 2, 2, L.s0);
      p.set(x0 + 8, ty + 3, L.s2);
      break;
    }
    case 'up0':
      arm(p, L, 1, ty - 9, ty, false);
      arm(p, L, 11, ty - 6, ty, true);
      break;
    case 'up1':
      arm(p, L, 1, ty - 6, ty, false);
      arm(p, L, 11, ty - 9, ty, true);
      break;
    case 'gasp': {
      p.vline(x0, ty, ty + 3, L.c2);
      p.vline(x0 + 7, ty, ty + 3, L.c2);
      p.rect(x0, hy + 3, 2, 3, L.s0);
      p.rect(x0 + 6, hy + 3, 2, 3, L.s0);
      p.set(x0 + 7, hy + 3, L.s2);
      break;
    }
    case 'wave0':
      arm(p, L, 11, ty - 6, ty, true);
      break;
    case 'wave1':
      p.line(11, ty, 12, ty - 4, L.c2);
      p.rect(12, ty - 7, 2, 3, L.c0);
      p.rect(12, ty - 8, 2, 2, L.s0);
      p.set(13, ty - 8, L.s2);
      break;
    case 'stickSit': {
      arm(p, L, 11, ty - 5, ty, true);
      stick = () => drawStick(p, team, 12, ty - 6, 7, pose.stick ?? 0);
      break;
    }
    case 'stickUp': {
      arm(p, L, 1, ty - 7, ty, false);
      arm(p, L, 11, ty - 6, ty, true);
      stick = () => drawStick(p, team, 12, ty - 7, 6, pose.stick ?? 0);
      break;
    }
  }
  outlineSprite(p);
  stick?.();
  return p;
}

function poseOf(id: number): Pose {
  switch (id) {
    case CF_SIT0:
      return { hy: 8, ty: 14, arms: 'down' };
    case CF_SIT1:
      return { hy: 7, ty: 13, arms: 'down' };
    case CF_STAND0:
      return { hy: 5, ty: 11, arms: 'down' };
    case CF_STAND1:
      return { hy: 6, ty: 12, arms: 'down' };
    case CF_CLAP0:
      return { hy: 6, ty: 12, arms: 'clap0' };
    case CF_CLAP1:
      return { hy: 5, ty: 11, arms: 'clap1', mouth: true };
    case CF_GASP:
      return { hy: 6, ty: 12, arms: 'gasp', mouth: true };
    case CF_UP0:
      return { hy: 6, ty: 12, arms: 'up0', mouth: true };
    case CF_UP1:
      return { hy: 5, ty: 11, arms: 'up1', mouth: true };
    case CF_LEAN:
      return { hy: 9, ty: 14, lean: 1, arms: 'down' };
    case CF_TURN:
      return { hy: 8, ty: 14, arms: 'down', away: true };
    case CF_WAVE0:
      return { hy: 8, ty: 14, arms: 'wave0' };
    case CF_WAVE1:
      return { hy: 7, ty: 13, arms: 'wave1' };
    default: {
      const k = (id - CROWD_SHARED) % CROWD_TEAM;
      if (k < 3) return { hy: 8, ty: 14, arms: 'stickSit', stick: ([0, 1, 2] as const)[k] };
      return { hy: k === 3 ? 6 : 5, ty: k === 3 ? 12 : 11, arms: 'stickUp', stick: ([0, 1] as const)[k - 3], mouth: true };
    }
  }
}

export interface CrowdAtlas {
  canvas: PixelCanvas;
  /** frame name → rect (cells of the grid) */
  frames: Record<string, { x: number; y: number; w: number; h: number }>;
}

/** The whole atlas: CROWD_COLS × CROWD_LOOKS cells. */
export function paintCrowdAtlas(): CrowdAtlas {
  const canvas = new PixelCanvas(CROWD_COLS * CROWD_FW, CROWD_LOOKS * CROWD_FH);
  const frames: CrowdAtlas['frames'] = {};
  for (let look = 0; look < CROWD_LOOKS; look++) {
    for (let col = 0; col < CROWD_COLS; col++) {
      const id = col < CROWD_SHARED ? col : CROWD_SHARED + ((col - CROWD_SHARED) % CROWD_TEAM);
      const team = (col < CROWD_SHARED ? 0 : Math.floor((col - CROWD_SHARED) / CROWD_TEAM)) as 0 | 1;
      canvas.blit(drawSpectator(LOOKS[look], poseOf(id), team), col * CROWD_FW, look * CROWD_FH);
      frames[crowdFrameName(look, col)] = { x: col * CROWD_FW, y: look * CROWD_FH, w: CROWD_FW, h: CROWD_FH };
    }
  }
  return { canvas, frames };
}

let cached: CrowdAtlas | null = null;
/** The atlas, painted once. */
export function crowdAtlas(): CrowdAtlas {
  return (cached ??= paintCrowdAtlas());
}

/** Painter used by the boot step and the layer's fallback (texture = the atlas canvas). */
export function paintCrowd(): PixelCanvas {
  return crowdAtlas().canvas;
}
