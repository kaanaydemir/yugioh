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
  /** Wall height and the vault's rise at the ends (px); the DOME over the middle lane: its half-width (columns) and rise. */
  H: number;
  VR: number;
  DW: number;
  DR: number;
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
  // trimmed (round 2): the neighbouring row's sprites stay clear of the rear rail and the vault
  const H = R(44 * K);
  const VR = R(7 * K);
  // round 3: a real birdcage DOME over the middle lane (the silhouette people remember), the sun finial on it
  const DW = 0.75;
  const DR = R(24 * K);
  const n = R((c1 - c0) * 4);
  const bars: number[] = [];
  for (let k = 0; k <= n; k++) bars.push(c0 + k / 4);
  const sideRows: number[] = [];
  for (let j = 0; j <= 3; j++) sideRows.push(rA + j / 4);
  const cm = lanes[LANE_MID];
  const kc = R((cm - c0) * 4);
  const top = Math.min(cp(c0, rA, H + 8).y, cp(c0, r, H + VR + 12).y, cp(c1, rA, H + 8).y, cp(cm, r, H + VR + DR + 6).y);
  const ox = cp(c0, rB, 0).x - 8;
  const oy = top - 6;
  const w = cp(c1, rA, 0).x + 8 - ox;
  const h = cp(c1, rB, 0).y + 8 - oy;
  // the door: ONE COLUMN wide (four bar spacings), a real set piece in the middle of the sword side
  return { target, c0, c1, rA, rB, rm: r, cm, H, VR, DW, DR, bars, sideRows, kh: kc - 2, kc, kl: kc + 2, dw: 1, ox, oy, w, h };
}

/**
 * The vault's rise over column `col`: the low end hoops step down toward the cage's ends (3 → VR px), and over the
 * middle lane a DOME rises (a hemisphere profile, DR px more at its crown) — a birdcage stretched over the row.
 */
export function vrAt(g: CageGeo, col: number): number {
  const d = Math.abs(col - g.cm);
  if (d < g.DW) {
    const u = d / g.DW;
    return g.VR + g.DR * Math.sqrt(1 - u * u);
  }
  const far = Math.max(g.cm - g.c0, g.c1 - g.cm);
  const v = 1 - Math.min(1, (d - g.DW) / Math.max(0.01, far - g.DW));
  return R(3 + (g.VR - 3) * v);
}

/** True for a bar column under the dome (its hoop is drawn at every bar there). */
function inDome(g: CageGeo, col: number): boolean {
  return Math.abs(col - g.cm) < g.DW - 0.01;
}

/** Where the dawn sun sits (its centre) at rest. */
export function sunAt(g: CageGeo): XY {
  const p = cp(g.cm, g.rm, g.H + R(vrAt(g, g.cm)));
  return { x: p.x, y: p.y - 7 };
}

/** True for a front bar inside the door's opening (the door's own drawing carries its bars). */
export function inDoor(g: CageGeo, k: number): boolean {
  return k >= g.kh && k <= g.kl;
}

/**
 * The front bars that are DAWN SWORDS. Round 4 (readability): the swords stand a quarter column either side of every
 * lane's centre (the odd bar slots), so each caged monster's middle column stays CLEAR of bars; nothing stands on a
 * lane's centre, and there are no plain front rods any more (the camera-side layer is thin: swords, posts, rails).
 */
export function swordKs(g: CageGeo): number[] {
  const out: number[] = [];
  for (let k = 1; k < g.bars.length - 1; k += 2) if (!inDoor(g, k)) out.push(k);
  return out;
}
/** Plain gilded front rods (none since round 4; kept for the API). */
export function rodKs(_g: CageGeo): number[] {
  return [];
}
/** True for a bar slot on a lane's centre (kept clear on the back side too). */
function laneCentre(g: CageGeo, k: number): boolean {
  return LANE_COLS.some((c) => Math.abs(g.bars[k] - c) < 0.01);
}
/** The blade's span on a front sword bar (heights above the floor): tip … guard. */
export function bladeSpan(g: CageGeo): { tip: number; guard: number } {
  return { tip: 1, guard: g.H - 8 };
}

/** The padlock's hanging point (the top of its shackle) on the latch, at rest: high on the latch post, under the
 *  lintel, so the lock stays clear of the stat plates below the row (round 3). */
export function lockAt(g: CageGeo): XY {
  // just outside the latch post (the door's far side): clear of the middle lane's stat plate
  const p = cp(g.bars[g.kl], g.rB, g.H - 5);
  return { x: p.x + 5, y: p.y };
}

/** The latch point on the closed door (where the slam strikes). */
export function latchAt(g: CageGeo): XY {
  const p = cp(g.bars[g.kl], g.rB, R(g.H * 0.5));
  return { x: p.x - 2, y: p.y };
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
const GUARD = ['kkkkkkkkk', 'kwaaaabbk', 'kkkdcdkkk'];
const POMMEL = ['.kkk.', 'kwabk', 'kabck', '.kkk.'];
const DULL: Record<string, number> = { ...KEY, w: PAL.gold3, a: PAL.gold2, b: PAL.gold1, c: PAL.gold1, d: PAL.gold0 };

/**
 * A DAWN SWORD planted tip-down at floor point f: a 3-px STEEL blade (round 3: silver, not gold — the swords read
 * as swords among the gilded rods; lit: a white edge, a mist core with a steel fuller, a steel back; dull: mist /
 * steel / night4) tapering to a 1-px tip at `tip`, a 9-px GILDED crossguard at `guard`, a wrapped grip up to `top`
 * and a round pommel above it. `snapped`: only the lower part of the blade is left (the break), its top a jagged white.
 */
export function sword(p: Pc, g: CageGeo, f: XY, o: { tip: number; guard: number; top: number; lit?: boolean; snapped?: boolean }): void {
  const lit = o.lit !== false;
  const edge = lit ? PAL.white : PAL.mist;
  const core = lit ? PAL.mist : PAL.steel;
  const back = lit ? PAL.steel : PAL.night4;
  const fuller = lit ? PAL.steel : PAL.night4;
  const end = o.snapped ? o.tip + R((o.guard - o.tip) * 0.42) : o.guard - 1;
  for (let h = o.tip; h <= end; h++) {
    const d = h - o.tip;
    const xs = d < 2 ? [0] : d < 4 ? [-1, 0] : [-1, 0, 1];
    put(p, g, f.x + xs[0] - 1, f.y - h, PAL.ink);
    put(p, g, f.x + xs[xs.length - 1] + 1, f.y - h, PAL.ink);
    for (const x of xs) {
      let c = x === -1 ? edge : x === 0 ? core : back;
      if (d < 2) c = edge;
      if (x === 0 && h > o.guard - 12 && h < o.guard - 2) c = fuller;
      if (o.snapped && h >= end - 1) c = (h + x) % 2 === 0 ? PAL.white : PAL.mist;
      put(p, g, f.x + x, f.y - h, c);
    }
  }
  put(p, g, f.x, f.y - o.tip + 1, PAL.ink);
  if (o.snapped) {
    for (const x of [-1, 0, 1]) if ((end + x) % 2 === 0) put(p, g, f.x + x, f.y - end - 1, PAL.ink);
    return;
  }
  const key = lit ? KEY : DULL;
  // the grip (wrapped) between the guard and the pommel
  for (let h = o.guard + 2; h < o.top; h++) {
    put(p, g, f.x - 1, f.y - h, PAL.ink);
    put(p, g, f.x, f.y - h, h % 2 ? PAL.gold1 : PAL.gold2);
    put(p, g, f.x + 1, f.y - h, PAL.ink);
  }
  stamp(p, g, GUARD, f.x - 4, f.y - (o.guard + 2), key);
  stamp(p, g, POMMEL, f.x - 2, f.y - (o.top + 3), key);
}

/** A front sword bar's sword (its foot on the foot rail). */
function frontSword(p: Pc, g: CageGeo, f: XY, o: { lit?: boolean; snapped?: boolean }): void {
  const s = bladeSpan(g);
  sword(p, g, f, { tip: s.tip, guard: s.guard, top: g.H + 2, ...o });
}

/** A rail along a run of points (a polyline). */
function railPath(p: Pc, g: CageGeo, pts: readonly XY[], lit: number, shade: number): void {
  for (let i = 1; i < pts.length; i++) rail(p, g, pts[i - 1], pts[i], lit, shade);
}

/** One hoop of the vault over column `col`: from the front top (φ = 0) over the ridge (π/2) to the back (π). */
export function hoop(g: CageGeo, col: number, from: number, to: number): XY[] {
  const pts: XY[] = [];
  const vr = vrAt(g, col);
  const N = vr > 12 ? 16 : 10;
  for (let i = 0; i <= N; i++) {
    const phi = from + ((to - from) * i) / N;
    const row = g.rm + (g.rB - g.rm) * Math.cos(phi);
    pts.push(cp(col, row, g.H + vr * Math.sin(phi)));
  }
  return pts;
}

/** The bar indices that carry a hoop: every fourth bar (the lane edges), every second bar under the dome. */
export function hoopKs(g: CageGeo): number[] {
  const out: number[] = [];
  for (let k = 0; k < g.bars.length; k++) if (k % 4 === 0 || (inDome(g, g.bars[k]) && k % 2 === 0)) out.push(k);
  return out;
}

/** The ridge along the crown (the dome sampled finely), as a polyline. */
export function ridge(g: CageGeo): XY[] {
  const pts: XY[] = [];
  const N = R((g.c1 - g.c0) * 16);
  let last: XY | null = null;
  for (let i = 0; i <= N; i++) {
    const c = g.c0 + ((g.c1 - g.c0) * i) / N;
    const p = cp(c, g.rm, g.H + R(vrAt(g, c)));
    if (!last || last.x !== p.x || last.y !== p.y) pts.push(p);
    last = p;
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
  // round 4: the back plane is one tone darker than the front (gold1 / gold0 rods, gold2 rails): the front reads first
  for (const k of hoopKs(g)) vaultLine(p, g, hoop(g, g.bars[k], Math.PI / 2, Math.PI), PAL.gold1, PAL.gold0);
  // rods of the back side (none behind a lane's centre)
  for (let k = 1; k < n; k++) if (!laneCentre(g, k)) rod(p, g, cp(g.bars[k], g.rA, 0), 3, g.H - 2, PAL.gold1, PAL.gold0);
  // rods of the left side
  for (let j = 1; j < g.sideRows.length - 1; j++) rod(p, g, cp(g.c0, g.sideRows[j], 0), 3, g.H - 2, PAL.gold1, PAL.gold0);
  // rails
  for (const h of [0, g.H - 1]) {
    rail(p, g, cp(g.c0, g.rA, h), cp(g.c1, g.rA, h), PAL.gold2, PAL.gold0);
    rail(p, g, cp(g.c0, g.rA, h), cp(g.c0, g.rB, h), PAL.gold2, PAL.gold0);
  }
  post(p, g, cp(g.c0, g.rA, 0), g.H + 1, true);
  return p;
}

/**
 * IN FRONT of the caged monsters: the sword side (minus the door's two bars), the right short side, their rails,
 * the three front corner posts, the door's hinge and latch posts, the front halves of the hoops and the ridge.
 */
export function paintFront(g: CageGeo, o: { lit?: boolean; snapped?: boolean } = {}): PixelCanvas {
  o = { lit: true, ...o };
  const p = new PixelCanvas(g.w, g.h);
  const n = g.bars.length - 1;
  // the vault: front halves of the hoops, the ridge
  for (const k of hoopKs(g)) vaultLine(p, g, hoop(g, g.bars[k], 0, Math.PI / 2), inDome(g, g.bars[k]) ? PAL.gold3 : PAL.gold2, inDome(g, g.bars[k]) ? PAL.gold1 : PAL.gold0);
  // round 4: the ridge (the "middle diagonal rail") is a thin 1-px line one band darker: three bright parallel rails
  // no longer stack over the caged monsters' heads
  vaultLine(p, g, ridge(g), PAL.gold2, PAL.gold0);

  // right side rods
  for (let j = 1; j < g.sideRows.length - 1; j++) rod(p, g, cp(g.c1, g.sideRows[j], 0), 3, g.H - 2, PAL.gold2, PAL.gold1);
  // rails (the blades pass behind the foot rail, the grips through the top rail)
  for (const h of [0, g.H - 1]) {
    rail(p, g, cp(g.c0, g.rB, h), cp(g.c1, g.rB, h), h === 0 ? PAL.gold3 : PAL.gold4, h === 0 ? PAL.gold1 : PAL.gold2);
    rail(p, g, cp(g.c1, g.rA, h), cp(g.c1, g.rB, h), PAL.gold3, PAL.gold1);
  }
  // the DAWN SWORDS, tip down: a 3-px blade (white edge), a crossguard under the top rail, a grip through it, a pommel
  for (const k of swordKs(g)) frontSword(p, g, cp(g.bars[k], g.rB, 0), { lit: o.lit, snapped: o.snapped });
  // the door's posts
  for (const k of [g.kh, g.kl]) post(p, g, cp(g.bars[k], g.rB, 0), g.H + 1);
  // corner posts
  post(p, g, cp(g.c0, g.rB, 0), g.H + 2);
  post(p, g, cp(g.c1, g.rB, 0), g.H + 2);
  post(p, g, cp(g.c1, g.rA, 0), g.H + 1, true);
  return p;
}

/** The door's angles (degrees) — its drawings: 0 = shut, −8 = the slam's overshoot (into the cage), 100 = hanging
 *  wide open toward the camera, 108 = the wind-up before the slam (round 4: the anticipation). */
export const DOOR_ANGLES = [-8, 0, 15, 30, 45, 60, 75, 90, 100, 108] as const;

/** A heavy door rail: three tones (lit / mid / shade) between ink lines. */
function heavyRail(p: Pc, g: CageGeo, a: XY, b: XY): void {
  wline(p, g, { x: a.x, y: a.y - 2 }, { x: b.x, y: b.y - 2 }, PAL.ink);
  wline(p, g, { x: a.x, y: a.y + 2 }, { x: b.x, y: b.y + 2 }, PAL.ink);
  wline(p, g, { x: a.x, y: a.y - 1 }, { x: b.x, y: b.y - 1 }, PAL.gold4);
  wline(p, g, a, b, PAL.gold3);
  wline(p, g, { x: a.x, y: a.y + 1 }, { x: b.x, y: b.y + 1 }, PAL.gold1);
}

/** A door stile: 3 px (white edge | gold4 | gold2) between ink sides, from h0 to h1 at floor point f. */
function stile(p: Pc, g: CageGeo, f: XY, h0: number, h1: number): void {
  for (let h = h0; h <= h1; h++) {
    put(p, g, f.x - 2, f.y - h, PAL.ink);
    put(p, g, f.x - 1, f.y - h, PAL.white);
    put(p, g, f.x, f.y - h, PAL.gold4);
    put(p, g, f.x + 1, f.y - h, PAL.gold2);
    put(p, g, f.x + 2, f.y - h, PAL.ink);
  }
}

/** The door's sword bars (fractions of its width from the hinge) and their blade span (heights). */
export const DOOR_SWORDS = [0.25, 0.75] as const;
export function doorBlade(g: CageGeo): { tip: number; guard: number } {
  return { tip: 5, guard: g.H - 11 };
}
/** The floor point of the door's sword s (a DOOR_SWORDS fraction) at `deg` degrees open. */
export function doorSwordFoot(g: CageGeo, s: number, deg: number): XY {
  const th = (deg * Math.PI) / 180;
  return cp(g.bars[g.kh] + s * g.dw * Math.cos(th), g.rB + s * g.dw * Math.sin(th), 0);
}

/**
 * The DOOR at `deg` degrees open (it swings out toward the camera round its hinge post): a real set piece one
 * column wide — two heavy stiles (a white edge), three heavy rails, two gilded rods and a steel dawn sword between
 * them, and a big SUN BOSS on its middle rail (foreshortened with the door: round face-on, a sliver edge-on).
 * `white`: the slam's white frame.
 */
export function paintDoor(g: CageGeo, deg: number, white = false, o: { lit?: boolean } = {}): PixelCanvas {
  const p = new PixelCanvas(g.w, g.h);
  const th = (deg * Math.PI) / 180;
  const hc = g.bars[g.kh];
  const at = (s: number, h: number): XY => cp(hc + s * g.dw * Math.cos(th), g.rB + s * g.dw * Math.sin(th), h);
  const lo = 4;
  const hi = g.H - 6;
  const mid = R(g.H * 0.5);
  // round 4: two steel dawn swords a quarter either side of the middle (the row's sword rhythm runs on through the
  // door) and NOTHING on the middle: the caged middle monster's centre column stays clear; no middle rail
  for (const s of DOOR_SWORDS) sword(p, g, at(s, 0), { tip: lo + 1, guard: hi - 5, top: hi + 1, lit: o.lit });
  // the rails (foot and head)
  heavyRail(p, g, at(0.06, lo), at(0.95, lo));
  heavyRail(p, g, at(0.06, hi), at(0.95, hi));
  // the stiles (hinge and latch)
  stile(p, g, at(0.06, 0), 1, hi + 2);
  stile(p, g, at(0.95, 0), 1, hi + 2);
  // the SUN BOSS: an ellipse as wide as the door is face-on (screen x of the door's direction)
  const face = Math.abs(Math.cos(th) - Math.sin(th));
  const rx = Math.max(1, Math.min(5, R(5 * face)));
  void mid;
  const c = at(0.5, hi);
  const ry = 5;
  for (let dy = -ry - 1; dy <= ry + 1; dy++) {
    const hw = Math.round((rx + 0.5) * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.6)) ** 2)));
    for (let dx = -hw - 1; dx <= hw + 1; dx++) put(p, g, c.x + dx, c.y + dy, PAL.ink);
  }
  for (let dy = -ry; dy <= ry; dy++) {
    const hw = Math.round((rx + 0.5) * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.6)) ** 2)) - 0.5);
    for (let dx = -hw; dx <= hw; dx++) {
      let col: number = PAL.gold3;
      if (dx < 0 && dy < 1) col = PAL.gold4;
      if (dx > 0 && dy > 0) col = PAL.gold2;
      if (Math.abs(dy) === ry || Math.abs(dx) === hw) col = dx > 0 || dy > 0 ? PAL.gold1 : PAL.gold3;
      put(p, g, c.x + dx, c.y + dy, col);
    }
  }
  if (rx >= 2) {
    put(p, g, c.x - 1, c.y - 2, PAL.white);
    put(p, g, c.x - 2, c.y - 1, PAL.white);
  }
  // its rays: a pixel above and below, and to both sides when face-on
  put(p, g, c.x, c.y - ry - 2, PAL.gold4);
  put(p, g, c.x, c.y + ry + 2, PAL.gold3);
  if (rx >= 3) {
    put(p, g, c.x - rx - 2, c.y, PAL.gold4);
    put(p, g, c.x + rx + 2, c.y, PAL.gold3);
  }
  if (white) p.map((col) => (col === PAL.ink ? col : PAL.white));
  return p;
}

// ================================================================ the padlock (the counter)

export const LOCK_W = 23;
export const LOCK_H = 27;
/** The padlock's anchor: the top of the shackle, centre. */
export const LOCK_AX = 11;
export const LOCK_AY = 2;
/** The three TONGUE BOLTS on the body's face (round 3: big 3 × 6 plates in dark slots, not teeth under it): left x
 *  of bolt i, their top row and height. */
export const TONGUE_X = [4, 10, 16] as const;
export const TONGUE_Y = 13;
export const TONGUE_H = 6;
/** The drawings of a turning tongue (it turns on its long axis: narrowing → edge-on white frame → its iron back). */
export const TURN_STEPS = 4;

/**
 * The padlock (≈ 19 × 24 + its outline): a heavy shackle, a gilded body with three TONGUE BOLTS set in dark slots on
 * its face — the counter: a lit bolt is gilded (a white edge and top, gold4, gold3), a turned one shows its IRON
 * back (stone3 / stone2 / stone1 — another material at a glance) — and a keyhole under them.
 * `turning` (an index) with `step` 0 … 3: narrowing (2 px bright), EDGE-ON (a 1-px white blade and its slot framed
 * in white), its back coming round (2 px iron), turned. `open`: the shackle sprung up. `white`: a white frame.
 * `pop`: a gold4 halo one pixel outside the ink (the tick's "pop" — the eye goes to the lock).
 */
export function paintLock(lit: number, o: { turning?: number; step?: number; open?: boolean; white?: boolean; pop?: boolean; bounce?: boolean } = {}): PixelCanvas {
  const p = new PixelCanvas(LOCK_W, LOCK_H);
  const up = o.open ? 3 : 0;
  // the shackle: an arch 11 wide, legs 2 px (lit outer, shade inner)
  const arch = ['...aaaaa...', '.aabcccbaa.', 'ab.......ba', 'ab.......ba', 'ab.......ba', 'ab.......ba', 'ab.......ba', 'ab.......ba', 'ab.......ba'];
  p.stamp(arch, { a: PAL.gold4, b: PAL.gold2, c: PAL.gold3 }, 6, Math.max(0, 2 - up));
  if (o.open) {
    // the free leg out of the body
    for (let y = 7; y < 11; y++) {
      p.erase(15, y);
      p.erase(16, y);
    }
  }
  // the body (19 × 15)
  const bx = 2;
  const by = 10;
  p.rect(bx, by, 19, 15, PAL.gold3);
  p.hline(bx, bx + 18, by, PAL.gold4);
  p.vline(bx, by, by + 14, PAL.gold4);
  p.hline(bx, bx + 18, by + 14, PAL.gold1);
  p.vline(bx + 18, by + 1, by + 14, PAL.gold2);
  p.hline(bx + 1, bx + 17, by + 13, PAL.gold2);
  p.set(bx + 1, by + 1, PAL.white).set(bx + 2, by + 1, PAL.white).set(bx + 1, by + 2, PAL.white);
  // the keyhole under the bolts
  p.set(11, 21, PAL.gold0).set(10, 22, PAL.gold0).set(11, 22, PAL.gold0).set(12, 22, PAL.gold0).set(11, 23, PAL.gold0);
  p.set(9, 21, PAL.gold4).set(13, 21, PAL.gold4);
  // the tongue bolts in their slots
  for (let i = 0; i < 3; i++) {
    const x = TONGUE_X[i];
    const y = TONGUE_Y;
    const H = TONGUE_H;
    // round 4 (legibility at 1×): a lit bolt sits in a gold0 slot, a turned one in a full INK slot — the count reads
    // as "bright plates vs dark holes" at a glance
    const turned = o.turning !== i && i >= lit;
    p.rect(x - 1, y - 1, 5, H + 2, turned ? PAL.ink : PAL.gold0);
    const litBolt = () => {
      // `bounce`: the remaining lit bolts hop one pixel (one frame after a turn — "still 2 left")
      const yb = o.bounce ? y - 1 : y;
      p.vline(x, yb, yb + H - 1, PAL.white);
      p.vline(x + 1, yb, yb + H - 1, PAL.gold4);
      p.vline(x + 2, yb, yb + H - 1, PAL.gold3);
      p.hline(x, x + 2, yb, PAL.white);
      p.set(x + 1, yb + H - 1, PAL.gold3).set(x + 2, yb + H - 1, PAL.gold2);
    };
    const ironBolt = () => {
      // the iron back in NIGHT tones, narrower (2 px) in its ink slot: a dark hole, not a grey plate
      p.vline(x, y + 1, y + H - 2, PAL.night3);
      p.vline(x + 1, y + 1, y + H - 2, PAL.night2);
      p.set(x, y + 1, PAL.night4);
    };
    if (o.turning === i) {
      const st = Math.max(0, Math.min(TURN_STEPS - 1, o.step ?? 1));
      if (st === 0) {
        p.vline(x + 1, y, y + H - 1, PAL.white).vline(x + 2, y, y + H - 1, PAL.gold4);
      } else if (st === 1) {
        // edge-on: a white blade, its slot framed in white
        p.rect(x - 1, y - 1, 5, H + 2, PAL.white);
        p.rect(x, y, 3, H, PAL.gold0);
        p.vline(x + 1, y - 1, y + H, PAL.white);
      } else if (st === 2) {
        p.rect(x - 1, y - 1, 5, H + 2, PAL.ink);
        p.vline(x + 1, y, y + H - 1, PAL.night4).vline(x + 2, y, y + H - 1, PAL.night2);
      } else {
        p.rect(x - 1, y - 1, 5, H + 2, PAL.ink);
        ironBolt();
      }
    } else if (i < lit) litBolt();
    else ironBolt();
  }
  p.outline(PAL.ink, { corners: false });
  if (o.white) p.map((c) => (c === PAL.ink ? c : PAL.white));
  if (o.pop) p.outline(PAL.gold4, { corners: false });
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
  // round 4: 2-px pips — lit = white top + gold4, turned = an ink hole (readable on the card at 1×)
  for (let i = 0; i < 3; i++) {
    const x = 2 + i * 3;
    if (o.turning === i) {
      p.rect(x, 7, 2, 4, PAL.white);
    } else if (i < lit) {
      p.rect(x, 7, 2, 4, PAL.gold4);
      p.hline(x, x + 1, 7, PAL.white);
      p.set(x + 1, 10, PAL.gold3);
    } else p.rect(x, 7, 2, 4, PAL.ink);
  }
  p.outline(PAL.ink, { corners: false });
  if (o.white) p.map((c) => (c === PAL.ink ? c : PAL.white));
  return p;
}

// ================================================================ the dawn sun and the chain

export const SUN_W = 37;
export const SUN_H = 30;
/** The sun's centre in its drawing (the rays fan UP: a rising sun). */
export const SUN_C = 18;
export const SUN_CY = 18;
/** The ray fan's growth drawings (the ignite): 1 … SUN_RISE. */
export const SUN_RISE = 3;

/**
 * The DAWN SUN at the cage's crown: a disc (r 6) and a fan of nine rays rising over its upper half (a sun coming
 * up), three short stubs under it. `lit` 0 = cold (a dull disc, ray stubs); 1 … SUN_RISE = the rays growing (the
 * ignite), SUN_RISE = full. `phase` 0 / 1 swaps the long and the short rays (the idle twinkle); `white` = a flare.
 */
export function paintSun(lit: number, phase: number, white = false): PixelCanvas {
  const p = new PixelCanvas(SUN_W, SUN_H);
  const cx = SUN_C;
  const cy = SUN_CY;
  const on = lit > 0;
  const grow = Math.min(SUN_RISE, Math.max(0, lit)) / SUN_RISE;
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI + (Math.PI * i) / 8;
    const long = (i + phase) % 2 === 0;
    const len = on ? R((long ? 17 : 12) * grow) : 8;
    const x1 = R(cx + Math.cos(a) * len);
    const y1 = R(cy + Math.sin(a) * len);
    const x0 = R(cx + Math.cos(a) * 8);
    const y0 = R(cy + Math.sin(a) * 8);
    if (len <= 8) {
      if (!on) p.set(x0, y0, PAL.gold1);
      continue;
    }
    p.line(x0, y0, x1, y1, on ? PAL.gold3 : PAL.gold1);
    if (on) {
      const mx = R(cx + Math.cos(a) * (len - 3));
      const my = R(cy + Math.sin(a) * (len - 3));
      p.line(mx, my, x1, y1, PAL.gold4);
      p.set(x1, y1, PAL.white);
    }
  }
  // the stubs below
  for (const dx of [-1, 0, 1]) {
    const a = Math.PI / 2 + dx * 0.55;
    p.set(R(cx + Math.cos(a) * 8), R(cy + Math.sin(a) * 8), on ? PAL.gold3 : PAL.gold1);
  }
  p.disc(cx, cy, 6, on ? PAL.gold3 : PAL.gold1);
  p.disc(cx - 1, cy - 1, 4, on ? PAL.gold4 : PAL.gold2);
  if (on) {
    p.disc(cx - 2, cy - 2, 1, PAL.white);
    p.set(cx - 3, cy - 1, PAL.white);
  }
  // the shade on the lower right
  for (const [dx, dy] of [[4, 3], [3, 4], [5, 2], [2, 5]] as const) p.set(cx + dx, cy + dy, on ? PAL.gold2 : PAL.gold0);
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

// ================================================================ the dawn burst (round 4)

export const BURST_W = 65;
export const BURST_C = 32;
/** The burst's drawings (the dawn ignites): 0 = the flash, 1 = the rays at full reach, 2 = the rays breaking up. */
export const BURST_STEPS = 3;

/**
 * THE DAWN BURST over the sun finial (round 4: "the dawn must read at 1×"): twelve rays in three drawings — 0: a white
 * disc (r 8) with short white rays (14 px); 1: the rays at full reach, long 30 / short 22 px, 2 px wide (a white core
 * with a gold4 side), the disc white-gold; 2: the rays broken off the disc (a gap at 9 … 13 px), gold4 with gold3
 * tips, shorter (26 / 18). Light, so no ink outline; whole pixels; the fan is fuller upward (a sunrise).
 */
export function paintSunBurst(step: number): PixelCanvas {
  const p = new PixelCanvas(BURST_W, BURST_W);
  const c = BURST_C;
  const st = Math.max(0, Math.min(BURST_STEPS - 1, step));
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI * 2 * i) / 12 - Math.PI / 2;
    const up = Math.sin(a) <= 0.01;
    const long = i % 2 === 0;
    const reach = st === 0 ? 14 : st === 1 ? (long ? 30 : 22) : long ? 26 : 18;
    const len = up ? reach : R(reach * 0.6);
    const r0 = st === 2 ? 13 : 7;
    const x0 = R(c + Math.cos(a) * r0);
    const y0 = R(c + Math.sin(a) * r0);
    const x1 = R(c + Math.cos(a) * len);
    const y1 = R(c + Math.sin(a) * len);
    if (st === 0) {
      p.line(x0, y0, x1, y1, PAL.white);
      continue;
    }
    if (st === 1) {
      // the 2-px ray: a gold4 side line one pixel off (across the ray's minor axis), the white core on top
      const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
      p.line(x0 + (steep ? 1 : 0), y0 + (steep ? 0 : 1), x1 + (steep ? 1 : 0), y1 + (steep ? 0 : 1), PAL.gold4);
      p.line(x0, y0, x1, y1, PAL.white);
      continue;
    }
    const xm = R(c + Math.cos(a) * (len - 4));
    const ym = R(c + Math.sin(a) * (len - 4));
    p.line(x0, y0, xm, ym, PAL.gold4);
    p.line(xm, ym, x1, y1, PAL.gold3);
  }
  if (st === 0) p.disc(c, c, 8, PAL.white);
  else if (st === 1) {
    p.disc(c, c, 8, PAL.gold4);
    p.disc(c - 1, c - 1, 6, PAL.white);
  }
  return p;
}
