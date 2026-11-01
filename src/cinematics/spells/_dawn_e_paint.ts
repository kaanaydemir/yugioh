// Şafak Kılıçları (dawn_swords) — lane E's new signature: the GILDED DAWN CAGE. Pure geometry + pixel drawings
// (PixelCanvas only; no Phaser, no randomness — the tests may read them). The scene is ./_dawn_e.ts.
//
// The cage is a long gilded birdcage standing over the target's WHOLE monster row (every lane): an iso box whose
// camera-facing long side is a row of DAWN SWORDS planted tip-down as bars (their crossguards under the top rail,
// their pommels a crown of finials above it), the other sides plain gilded rods, a barrel vault of hoops over the
// top with a ridge rod and a DAWN SUN finial at its crown where the chain hangs. The door is in the middle of the
// sword side (two bar spacings wide, it swings out toward the camera); the PADLOCK with three tongues hangs on it.
// Everything is drawn in whole pixels on the 2:1 iso grid: bar spacing ¼ column, the ends on tile edges, so every
// rail is a clean 2:1 staircase. Light comes from the upper left (the lit pixel of a bar is its left one).

import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import type { PlayerId } from '../../engine/types';
import { LANE_COLS, LANE_MID, TILE_W, isoToScreen, monsterRow, type XY } from '../../view/layout';

const R = Math.round;
/** Board scale (64-px tiles = 1). */
const K = TILE_W / 64;

export interface CageGeo {
  target: PlayerId;
  /** Grid extents: columns c0 … c1 (tile edges of the first / last lane), rows rA (back) … rB (front, camera side). */
  c0: number;
  c1: number;
  rA: number;
  rB: number;
  /** The row through the middle (ridge) and the door's centre column. */
  rm: number;
  cm: number;
  /** Wall height and the vault's rise (px). */
  H: number;
  VR: number;
  /** Bar columns along the long sides (k = 0 … n; k = 0 and n are the corner posts). */
  bars: number[];
  /** Rows of the bars on the short sides (j = 0 … m; the ends are the corner posts). */
  sideRows: number[];
  /** The door: its bar indices (hinge post kh, middle kc, latch post kl) and its width in columns. */
  kh: number;
  kc: number;
  kl: number;
  dw: number;
  /** The canvas every layer is drawn on (world px at rest): top-left and size. */
  ox: number;
  oy: number;
  w: number;
  h: number;
}

/** A point of the cage: grid (col, row) at height h (px) → whole screen pixels. */
export function cp(col: number, row: number, h: number): XY {
  const p = isoToScreen(col, row);
  return { x: R(p.x), y: R(p.y) - R(h) };
}

/** The cage over `target`'s monster row. */
export function cageGeo(target: PlayerId): CageGeo {
  const lanes = LANE_COLS;
  const r = monsterRow(target);
  const c0 = lanes[0] - 0.5;
  const c1 = lanes[lanes.length - 1] + 0.5;
  const rA = r - 0.375;
  const rB = r + 0.375;
  const H = R(48 * K);
  const VR = R(12 * K);
  const n = R((c1 - c0) * 4);
  const bars: number[] = [];
  for (let k = 0; k <= n; k++) bars.push(c0 + k / 4);
  const sideRows: number[] = [];
  for (let j = 0; j <= 3; j++) sideRows.push(rA + j / 4);
  const cm = lanes[LANE_MID];
  const kc = R((cm - c0) * 4);
  const top = Math.min(cp(c0, rA, H + 6).y, cp(c0, r, H + VR + 12).y, cp(c1, rA, H + 6).y);
  const ox = cp(c0, rB, 0).x - 8;
  const oy = top - 6;
  const w = cp(c1, rA, 0).x + 8 - ox;
  const h = cp(c1, rB, 0).y + 8 - oy;
  return { target, c0, c1, rA, rB, rm: r, cm, H, VR, bars, sideRows, kh: kc - 1, kc, kl: kc + 1, dw: 0.5, ox, oy, w, h };
}

/** Where the dawn sun sits (its centre) at rest. */
export function sunAt(g: CageGeo): XY {
  const p = cp(g.cm, g.rm, g.H + g.VR);
  return { x: p.x, y: p.y - 7 };
}

/** The padlock's hanging point (the top of its shackle) on the closed door, at rest. */
export function lockAt(g: CageGeo): XY {
  const p = cp(g.bars[g.kl], g.rB, R(g.H * 0.72));
  return { x: p.x - 1, y: p.y + 1 };
}

/** The door's hinge floor point. */
export function hingeAt(g: CageGeo): XY {
  return cp(g.bars[g.kh], g.rB, 0);
}

/** The floor point of front bar k (the sword bars), and of the back bar k. */
export function frontFoot(g: CageGeo, k: number): XY {
  return cp(g.bars[k], g.rB, 0);
}

/** The floor polygon of the cage (A back-left, B back-right, C front-right, D front-left). */
export function footprint(g: CageGeo): XY[] {
  return [cp(g.c0, g.rA, 0), cp(g.c1, g.rA, 0), cp(g.c1, g.rB, 0), cp(g.c0, g.rB, 0)];
}

// ================================================================ drawing helpers (canvas coords = world − origin)

type Pc = PixelCanvas;

function put(p: Pc, g: CageGeo, x: number, y: number, c: number): void {
  p.set(x - g.ox, y - g.oy, c);
}

/** A straight line in world pixels (Bresenham). */
function wline(p: Pc, g: CageGeo, a: XY, b: XY, c: number): void {
  p.line(a.x - g.ox, a.y - g.oy, b.x - g.ox, b.y - g.oy, c);
}

/** A rail between two cage points: 2 px (lit top, shade under) with an ink line above and below. */
function rail(p: Pc, g: CageGeo, a: XY, b: XY, lit: number, shade: number): void {
  wline(p, g, { x: a.x, y: a.y - 1 }, { x: b.x, y: b.y - 1 }, PAL.ink);
  wline(p, g, { x: a.x, y: a.y + 2 }, { x: b.x, y: b.y + 2 }, PAL.ink);
  wline(p, g, a, b, lit);
  wline(p, g, { x: a.x, y: a.y + 1 }, { x: b.x, y: b.y + 1 }, shade);
}

/** A plain gilded rod from floor point f up `h0 … h1` px: 2 px, the left pixel lit. */
function rod(p: Pc, g: CageGeo, f: XY, h0: number, h1: number, lit: number, shade: number): void {
  for (let h = h0; h <= h1; h++) {
    put(p, g, f.x, f.y - h, lit);
    put(p, g, f.x + 1, f.y - h, shade);
  }
}

/** A corner post: 3 px (gold4 | gold3 | gold1) with ink sides, a ball finial on top. */
function post(p: Pc, g: CageGeo, f: XY, top: number, dim = false): void {
  const [a, b, c] = dim ? [PAL.gold3, PAL.gold2, PAL.gold1] : [PAL.gold4, PAL.gold3, PAL.gold1];
  for (let h = 0; h <= top; h++) {
    put(p, g, f.x - 2, f.y - h, PAL.ink);
    put(p, g, f.x - 1, f.y - h, a);
    put(p, g, f.x, f.y - h, b);
    put(p, g, f.x + 1, f.y - h, c);
    put(p, g, f.x + 2, f.y - h, PAL.ink);
  }
  stamp(p, g, BALL, f.x - 2, f.y - top - 4);
}

const KEY: Record<string, number> = { k: PAL.ink, w: PAL.white, a: PAL.gold4, b: PAL.gold3, c: PAL.gold2, d: PAL.gold1, e: PAL.gold0 };

function stamp(p: Pc, g: CageGeo, rows: readonly string[], x: number, y: number, key: Record<string, number> = KEY): void {
  p.stamp(rows, key, x - g.ox, y - g.oy);
}

const BALL = ['.kkk.', 'kabbk', 'kbbdk', '.kkk.'];
const GUARD = ['kkkkkkkk', 'kwaabbck', 'kkdccdkk', '..kddk..'];
const POMMEL = ['.kk.', 'kwbk', 'kbdk', '.kk.'];

/** A rail along a run of points (a polyline). */
function railPath(p: Pc, g: CageGeo, pts: readonly XY[], lit: number, shade: number): void {
  for (let i = 1; i < pts.length; i++) rail(p, g, pts[i - 1], pts[i], lit, shade);
}

/** One hoop of the vault over column `col`: from the front top (φ = 0) over the ridge (π/2) to the back (π). */
function hoop(g: CageGeo, col: number, from: number, to: number): XY[] {
  const pts: XY[] = [];
  const N = 10;
  for (let i = 0; i <= N; i++) {
    const phi = from + ((to - from) * i) / N;
    const row = g.rm + (g.rB - g.rm) * Math.cos(phi);
    pts.push(cp(col, row, g.H + g.VR * Math.sin(phi)));
  }
  return pts;
}

/** A 1-px vault line with its ink above and a shade below. */
function vaultLine(p: Pc, g: CageGeo, pts: readonly XY[], lit: number, shade: number): void {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    wline(p, g, { x: a.x, y: a.y - 1 }, { x: b.x, y: b.y - 1 }, PAL.ink);
  }
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    wline(p, g, { x: a.x, y: a.y + 1 }, { x: b.x, y: b.y + 1 }, shade);
  }
  for (let i = 1; i < pts.length; i++) wline(p, g, pts[i - 1], pts[i], lit);
}

// ================================================================ the layers

/**
 * BEHIND the caged monsters: the back long side and the left short side (plain rods, a shade darker — they stand
 * in the cage's own shadow), their foot and top rails, the back corner post, the back halves of the hoops.
 */
export function paintBack(g: CageGeo): PixelCanvas {
  const p = new PixelCanvas(g.w, g.h);
  const n = g.bars.length - 1;
  // hoops: back halves
  for (let k = 0; k <= n; k += 2) vaultLine(p, g, hoop(g, g.bars[k], Math.PI / 2, Math.PI), PAL.gold2, PAL.gold1);
  // rods of the back side
  for (let k = 1; k < n; k++) rod(p, g, cp(g.bars[k], g.rA, 0), 3, g.H - 2, PAL.gold2, PAL.gold1);
  // rods of the left side
  for (let j = 1; j < g.sideRows.length - 1; j++) rod(p, g, cp(g.c0, g.sideRows[j], 0), 3, g.H - 2, PAL.gold2, PAL.gold1);
  // rails
  for (const h of [0, g.H - 1]) {
    rail(p, g, cp(g.c0, g.rA, h), cp(g.c1, g.rA, h), PAL.gold3, PAL.gold1);
    rail(p, g, cp(g.c0, g.rA, h), cp(g.c0, g.rB, h), PAL.gold3, PAL.gold1);
  }
  post(p, g, cp(g.c0, g.rA, 0), g.H + 1, true);
  return p;
}

/**
 * IN FRONT of the caged monsters: the sword side (minus the door's two bars), the right short side, their rails,
 * the three front corner posts, the door's hinge and latch posts, the front halves of the hoops and the ridge.
 */
export function paintFront(g: CageGeo): PixelCanvas {
  const p = new PixelCanvas(g.w, g.h);
  const n = g.bars.length - 1;
  // the vault: front halves of the hoops, the ridge
  for (let k = 0; k <= n; k += 2) vaultLine(p, g, hoop(g, g.bars[k], 0, Math.PI / 2), PAL.gold3, PAL.gold1);
  railPath(p, g, [cp(g.c0, g.rm, g.H + g.VR), cp(g.c1, g.rm, g.H + g.VR)], PAL.gold4, PAL.gold2);
  // right side rods
  for (let j = 1; j < g.sideRows.length - 1; j++) rod(p, g, cp(g.c1, g.sideRows[j], 0), 3, g.H - 2, PAL.gold3, PAL.gold1);
  // the sword bars (not the door's middle bar, nor the latch / hinge posts)
  const swordAt: XY[] = [];
  for (let k = 1; k < n; k++) {
    if (k === g.kc || k === g.kh || k === g.kl) continue;
    swordAt.push(cp(g.bars[k], g.rB, 0));
  }
  for (const f of swordAt) {
    for (let h = 2; h < g.H - 9; h++) {
      put(p, g, f.x, f.y - h, h > g.H - 13 ? PAL.gold4 : PAL.white);
      put(p, g, f.x + 1, f.y - h, PAL.gold3);
    }
    for (let h = g.H - 6; h <= g.H - 2; h++) {
      put(p, g, f.x, f.y - h, h % 2 ? PAL.gold1 : PAL.gold2);
      put(p, g, f.x + 1, f.y - h, PAL.gold0);
    }
  }
  // rails (over the blades' ends)
  for (const h of [0, g.H - 1]) {
    rail(p, g, cp(g.c0, g.rB, h), cp(g.c1, g.rB, h), h === 0 ? PAL.gold3 : PAL.gold4, h === 0 ? PAL.gold1 : PAL.gold2);
    rail(p, g, cp(g.c1, g.rA, h), cp(g.c1, g.rB, h), PAL.gold3, PAL.gold1);
  }
  // guards and pommels over the rails (the crown of finials)
  for (const f of swordAt) {
    stamp(p, g, GUARD, f.x - 3, f.y - (g.H - 9) - 1);
    stamp(p, g, POMMEL, f.x - 1, f.y - (g.H + 2) - 3);
  }
  // the door's posts
  for (const k of [g.kh, g.kl]) post(p, g, cp(g.bars[k], g.rB, 0), g.H + 1);
  // corner posts
  post(p, g, cp(g.c0, g.rB, 0), g.H + 2);
  post(p, g, cp(g.c1, g.rB, 0), g.H + 2);
  post(p, g, cp(g.c1, g.rA, 0), g.H + 1, true);
  return p;
}

/** The door's angles (degrees) — its drawings: 0 = shut. */
export const DOOR_ANGLES = [0, 14, 28, 42, 56, 70] as const;

/**
 * The door at `deg` degrees open (it swings out toward the camera round its hinge post): two rails, a dawn sword in
 * the middle, the latch stile with its plate. `white`: the slam's white frame.
 */
export function paintDoor(g: CageGeo, deg: number, white = false): PixelCanvas {
  const p = new PixelCanvas(g.w, g.h);
  const th = (deg * Math.PI) / 180;
  const hc = g.bars[g.kh];
  const at = (s: number, h: number): XY => cp(hc + s * g.dw * Math.cos(th), g.rB + s * g.dw * Math.sin(th), h);
  const lo = 4;
  const hi = g.H - 7;
  // the middle sword (between the door rails)
  const f = at(0.5, 0);
  for (let h = lo + 2; h < hi - 6; h++) {
    put(p, g, f.x, f.y - h, h > hi - 10 ? PAL.gold4 : PAL.white);
    put(p, g, f.x + 1, f.y - h, PAL.gold3);
  }
  for (let h = hi - 3; h < hi; h++) {
    put(p, g, f.x, f.y - h, h % 2 ? PAL.gold1 : PAL.gold2);
    put(p, g, f.x + 1, f.y - h, PAL.gold0);
  }
  // the latch stile
  const s1 = at(0.92, 0);
  for (let h = 2; h <= g.H - 4; h++) {
    put(p, g, s1.x - 1, s1.y - h, PAL.ink);
    put(p, g, s1.x, s1.y - h, PAL.gold4);
    put(p, g, s1.x + 1, s1.y - h, PAL.gold2);
    put(p, g, s1.x + 2, s1.y - h, PAL.ink);
  }
  rail(p, g, at(0.06, lo), at(0.96, lo), PAL.gold3, PAL.gold1);
  rail(p, g, at(0.06, hi), at(0.96, hi), PAL.gold4, PAL.gold2);
  stamp(p, g, GUARD, f.x - 3, f.y - (hi - 6) - 1);
  // a small sun boss on the door's middle (the latch plate)
  const lp = at(0.92, R(g.H * 0.72));
  stamp(p, g, ['kkkk', 'kabk', 'kbdk', 'kkkk'], lp.x - 1, lp.y - 2);
  if (white) p.map((c) => (c === PAL.ink ? c : PAL.white));
  return p;
}

// ================================================================ the padlock (the counter)

export const LOCK_W = 15;
export const LOCK_H = 20;
/** The padlock's anchor: the top of the shackle, centre. */
export const LOCK_AX = 7;
export const LOCK_AY = 1;

/**
 * The padlock: a gilded body with three TONGUES (the counter) and its shackle. `lit` tongues are lit (white tip,
 * gold4 bar, upright); `turning` (an index) draws that tongue half turned; the others are turned flat and dark.
 * `open`: the shackle sprung up out of the body. `white`: a white frame (an event's first frame).
 */
export function paintLock(lit: number, o: { turning?: number; open?: boolean; white?: boolean } = {}): PixelCanvas {
  const p = new PixelCanvas(LOCK_W, LOCK_H);
  const up = o.open ? 3 : 0;
  // the shackle: an arch 9 wide, 2 px thick (lit outer, shade inner)
  const sx = 3;
  const sy = 1 - up;
  const arch = ['..aaaaa..', '.abccccb.', 'ab.....ba', 'ab.....ba', 'ab.....ba', 'ab.....ba', 'ab.....ba'];
  p.stamp(arch, { a: PAL.gold4, b: PAL.gold2, c: PAL.gold3 }, sx, Math.max(0, sy + 1));
  if (o.open) {
    // the free leg out of the body: shorten the right leg's bottom
    for (let y = 5; y < 8; y++) {
      p.erase(sx + 7, y + sy);
      p.erase(sx + 8, y + sy);
    }
  }
  // the body (13 × 11)
  const bx = 1;
  const by = 8;
  p.rect(bx, by, 13, 11, PAL.gold3);
  p.hline(bx, bx + 12, by, PAL.gold4);
  p.vline(bx, by, by + 10, PAL.gold4);
  p.hline(bx, bx + 12, by + 10, PAL.gold1);
  p.vline(bx + 12, by + 1, by + 10, PAL.gold2);
  p.set(bx + 1, by + 1, PAL.white);
  // the tongue slots: three dark wells 3 wide × 7 tall
  for (let i = 0; i < 3; i++) {
    const x = bx + 2 + i * 4;
    p.rect(x, by + 2, 3, 7, PAL.gold0);
    const isLit = i < lit;
    if (o.turning === i) {
      // half turned: a diagonal
      p.set(x + 2, by + 3, PAL.gold3).set(x + 1, by + 4, PAL.gold3).set(x + 1, by + 5, PAL.gold2).set(x, by + 6, PAL.gold2);
      p.set(x + 2, by + 2, PAL.white);
    } else if (isLit) {
      p.vline(x + 1, by + 3, by + 7, PAL.gold4);
      p.set(x + 1, by + 2, PAL.white);
      p.set(x + 2, by + 7, PAL.gold2);
    } else {
      p.hline(x, x + 2, by + 5, PAL.gold1);
    }
  }
  p.outline(PAL.ink, { corners: false });
  if (o.white) p.map((c) => (c === PAL.ink ? c : PAL.white));
  return p;
}

export const BADGE_W = 13;
export const BADGE_H = 14;

/** The small padlock badge over the spell card: a shackle, a body with three pips (`lit` of them gold). */
export function paintBadge(lit: number, o: { white?: boolean; turning?: number } = {}): PixelCanvas {
  const p = new PixelCanvas(BADGE_W, BADGE_H);
  p.stamp(['.aaaaa.', 'ab...ba', 'ab...ba', 'ab...ba'], { a: PAL.gold4, b: PAL.gold2 }, 3, 1);
  p.rect(1, 5, 11, 8, PAL.gold2);
  p.hline(1, 11, 5, PAL.gold3);
  p.hline(1, 11, 12, PAL.gold1);
  for (let i = 0; i < 3; i++) {
    const x = 3 + i * 3;
    p.rect(x, 7, 1, 4, PAL.gold0);
    if (o.turning === i) p.set(x, 8, PAL.white).set(x, 9, PAL.gold3);
    else if (i < lit) p.vline(x, 7, 10, PAL.gold4).set(x, 7, PAL.white);
    else p.set(x, 9, PAL.gold1);
  }
  p.outline(PAL.ink, { corners: false });
  if (o.white) p.map((c) => (c === PAL.ink ? c : PAL.white));
  return p;
}

// ================================================================ the dawn sun and the chain

export const SUN_W = 23;
export const SUN_H = 23;
/** The sun's centre in its drawing. */
export const SUN_C = 11;

/**
 * The dawn sun at the cage's crown: a disc (r 4) with eight rays. `lit` 0 = cold (gold1 disc, stubs of rays), 1 = lit;
 * `phase` 0 / 1 swaps the long rays between the cross and the diagonals (the idle twinkle); `white` = the ignite frame.
 */
export function paintSun(lit: number, phase: number, white = false): PixelCanvas {
  const p = new PixelCanvas(SUN_W, SUN_H);
  const c = SUN_C;
  const cross = phase % 2 === 0 ? 9 : 7;
  const diag = phase % 2 === 0 ? 5 : 7;
  const ray = (dx: number, dy: number, len: number) => {
    for (let i = 5; i <= len; i++) p.set(c + dx * i, c + dy * i, i === len ? PAL.white : i > len - 2 ? PAL.gold4 : PAL.gold3);
  };
  if (lit > 0) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) ray(dx, dy, cross);
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) ray(dx, dy, diag);
  } else {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) p.set(c + dx * 5, c + dy * 5, PAL.gold1);
  }
  p.disc(c, c, 4, lit > 0 ? PAL.gold3 : PAL.gold1);
  p.disc(c - 1, c - 1, 2, lit > 0 ? PAL.gold4 : PAL.gold2);
  if (lit > 0) p.set(c - 2, c - 2, PAL.white).set(c - 1, c - 2, PAL.white);
  p.set(c + 3, c + 2, lit > 0 ? PAL.gold2 : PAL.gold0).set(c + 2, c + 3, lit > 0 ? PAL.gold2 : PAL.gold0);
  p.outline(PAL.ink, { corners: false });
  if (white) p.map((col) => (col === PAL.ink ? col : PAL.white));
  return p;
}

export const CHAIN_W = 7;

/**
 * The hanging chain, `len` px tall, anchored at its BOTTOM (the ring over the sun): alternate face-on (5 × 6 oval)
 * and edge-on (1-px) heavy gilded links, 5 px per link.
 */
export function paintChain(len: number): PixelCanvas {
  const p = new PixelCanvas(CHAIN_W, len);
  const face = ['.aab.', 'a...c', 'a...c', 'b...c', '.ccd.'];
  for (let y = len - 6, i = 0; y > -6; y -= 5, i++) {
    if (i % 2 === 0) p.stamp(face, { a: PAL.gold4, b: PAL.gold3, c: PAL.gold2, d: PAL.gold1 }, 1, y);
    else {
      for (let k = 0; k < 6; k++) p.set(3, y + k - 1, k < 2 ? PAL.gold4 : k < 4 ? PAL.gold3 : PAL.gold2);
    }
  }
  // the ring that carries the cage
  p.stamp(['.aa.', 'a..c', '.cc.'], { a: PAL.gold4, c: PAL.gold2 }, 2, len - 3);
  p.outline(PAL.ink, { corners: false });
  return p;
}
