// Hurda Akıncıları (scrap_raiders) — the card's own effect pieces (?look=v3 only; registers nothing: the `_` file is
// loaded by the cinematics glob but has no side effects). Used by ./scrap_raiders.ts.
//
//   raidersPoint(u, which)              a point of the cart / crew on the frame on screen (world px)
//   raidersOffset(which, anim, f, sgn)  the same point of a given frame, relative to the sprite position (travel aiming)
//   Junk                                hand-drawn scrap pieces (bolts, nuts, gears, rust plates, a loose wheel) with
//                                       gravity, floor bounces and pixel-frame tumbling (no sprite rotation)
//   scrapRain(sc, home, depth)          the summon's scrap shower: junk falls from above onto the tile, a growing shadow
//   heapDust(sc, home, k, depth)        floor dust puffs rolling out (the heap landing / a bounce / a collapse)
//   hammerSparks(sc, at, k, depth)      one hammer blow: a white star and a fan of hot sparks
//   stoveBurst(sc, top, home, depth)    the stove's VUF: a fire burst out of the pipe, embers, a black smoke ring
//   tyreSparks(sc, at, back, depth)     the back-pedal: sparks spat backwards off the rear tyre
//   skidMarks(sc, at, back, ms)         scorched tyre marks on the marble (stepped fade)
//   smokePuffs(sc, at, n, depth)        black exhaust clouds out of the pipe
//   ramDebris(sc, at, dir, o)           the ram's contact: bolts, nuts and a gear fly, sparks, a dust kick
//   looseBolt(sc, at, dir, floorY, d)   the loose wheel spits one bolt that tinks away over the floor
//   sweatAndSteam(sc, heads, stove, d)  the tired guard: sweat drops off three heads, steam out of the stove
//   fleeDust(sc, u, ms)                 the death's three-way flight: dust kicked up at the three pairs of running feet
//   goblinRunners(sc, u, depth)         the death's three-way flight: three goblin runner sprites (3-frame run cycle,
//                                       whole-px moves) leave the wreck left / back / right
//   scrapScatter(sc, home, dir, depth)  the death's final material (§5.2 C5): plates slide, gears roll and fall flat,
//                                       a wheel rolls off and settles, the stove's last embers die
//
// Pixel language (REHBER EF-6 / EF-7): 1-px pieces, palette steps instead of alpha where it reads, whole-pixel
// positions, no scaled or rotated sprites (a tumbling piece is a set of pixel frames).

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { AnyMonsterAnim } from '../../art/types';
import { FLEE_START, framePose } from '../../art/monsters-v3/scrap_raiders-anims';
import { RX, GY, H as ART_H, W as ART_W, drawRaiders, pose, skeleton } from '../../art/monsters-v3/scrap_raiders-rig';
import { PixelCanvas } from '../../art/pixel';
import { canvasTexture } from '../../art/textures';
import { isTired } from './_scrap_raiders-tired';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, type XY } from '../../view/layout';
import { lightFlash } from '../../view/light';
import { Raster } from '../../vfx/setpieces';
import { Sparks, animate } from '../../vfx/combat';

export const TAU = Math.PI * 2;
/** Floor marks just above the cards on the tiles. */
export const FLOOR_DEPTH = DEPTH.CARD_ON_TILE + 2;

let seedV = 1;
/** Deterministic random (films repeat). */
export function seedFx(n: number): void {
  seedV = (Math.abs(Math.floor(n)) % 2147483646) + 1;
}
function rnd(): number {
  seedV = (seedV * 16807) % 2147483647;
  return (seedV - 1) / 2147483646;
}
export const RR = (a: number, b: number): number => a + (b - a) * rnd();
const rx = (p: XY): XY => ({ x: Math.round(p.x), y: Math.round(p.y) });

const FIRE = [PAL.white, PAL.fire4, PAL.fire3, PAL.fire2] as const;
const HOT = [PAL.white, PAL.gold4, PAL.fire4, PAL.fire3, PAL.fire2] as const;
/** floor dust: lighter than the slate floor (darker tones read as stains on it) */
const DUST = [PAL.stone4, PAL.stone3, PAL.stone3, PAL.stone2] as const;
const SMOKE = [PAL.stone2, PAL.stone1, PAL.stone0, PAL.ink] as const;
const STEAM = [PAL.white, PAL.mist, PAL.stone4, PAL.stone3] as const;

// ================================================================ points

export type RaidersPt = 'ram' | 'front' | 'rear' | 'pipe' | 'stove' | 'hammer' | 'wHead' | 'pHead' | 'sHead' | 'wFeet' | 'pFeet' | 'sFeet' | 'core';

function skPt(anim: AnyMonsterAnim, f: number, which: RaidersPt, tired = false): readonly [number, number] {
  const sk = skeleton(framePose(anim, f, tired ? 'tired' : 'rest'));
  switch (which) {
    case 'ram':
      return sk.ram;
    case 'front':
      return sk.front;
    case 'rear':
      return sk.rear;
    case 'pipe':
      return sk.pipeTop;
    case 'stove':
      return sk.stove;
    case 'hammer':
      return sk.Wg.hand;
    case 'wHead':
      return sk.Wg.head;
    case 'pHead':
      return sk.P.head;
    case 'sHead':
      return sk.S.head;
    case 'wFeet':
      return [sk.Wg.hip[0], sk.Wg.hip[1] + 6];
    case 'pFeet':
      return [sk.P.hip[0], sk.P.hip[1] + 6];
    case 'sFeet':
      return [sk.S.hip[0], sk.S.hip[1] + 6];
    default:
      return sk.core;
  }
}

/** A point of the cart's skeleton on the frame on screen, in world px (null: gone / another art). */
export function raidersPoint(u: MonsterUnit, which: RaidersPt): XY | null {
  if (!u.sprite.active || u.cardId !== 'scrap_raiders') return null;
  const fi = u.frameInfo();
  const p = skPt(fi.anim ?? 'idle', fi.frame, which, isTired(u));
  return rx(u.framePoint(Math.floor(p[0]) + 0.5, Math.floor(p[1]) + 0.5));
}

/** A frame's point relative to the art anchor (the sprite position for a walker), mirrored by `sgn`. */
export function raidersOffset(which: RaidersPt, anim: AnyMonsterAnim, f: number, sgn: 1 | -1): XY {
  const p = skPt(anim, f, which);
  return { x: Math.round((p[0] - RX) * sgn), y: Math.round(p[1] - GY) };
}

// ================================================================ junk (hand-drawn scrap pieces)

export type JunkKind = 'bolt' | 'nut' | 'gear' | 'plate' | 'wheel';

export interface JunkPiece {
  kind: JunkKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** the floor line it bounces on */
  floor: number;
  /** energy kept per bounce (default 0.35) */
  bounce?: number;
  /** ms before it appears */
  delay?: number;
  /** tumble speed (pixel frames per second) */
  spin?: number;
  /** gravity px/s² (default 420) */
  g?: number;
  /** the piece slides / rolls on after landing (plates slide, gears and wheels roll), friction per s */
  roll?: number;
  // state
  ph?: number;
  rest?: boolean;
  fall?: number;
  turn?: number;
}

type Cell = [number, number, number];

/** Stamp a small piece with a 1-px ink outline (4-neighbours of its cells that are not part of it). */
function stamp(g: Raster, x: number, y: number, cells: readonly Cell[]): void {
  const own = new Set(cells.map(([dx, dy]) => `${dx},${dy}`));
  const ink = new Set<string>();
  for (const [dx, dy] of cells)
    for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const k = `${dx + ex},${dy + ey}`;
      if (!own.has(k)) ink.add(k);
    }
  for (const k of ink) {
    const [dx, dy] = k.split(',').map(Number);
    g.px(x + dx, y + dy, PAL.ink);
  }
  for (const [dx, dy, c] of cells) g.px(x + dx, y + dy, c);
}

/** Bolt shapes (head 2×3 + a threaded shank of 3), four tumble frames: flat, diagonal, upright, other diagonal. */
const BOLT: readonly (readonly Cell[])[] = (() => {
  const H0 = PAL.white;
  const H1 = PAL.mist;
  const S0 = PAL.steel;
  const S1 = PAL.stone3;
  return [
    [[-2, -1, H0], [-1, -1, H1], [-2, 0, H1], [-1, 0, S0], [-2, 1, S0], [-1, 1, S1], [0, 0, S0], [1, 0, S1], [2, 0, S0]],
    [[-2, -2, H0], [-1, -2, H1], [-2, -1, H1], [-1, -1, S0], [0, 0, S0], [1, 1, S1], [2, 2, S0]],
    [[-1, -2, H0], [0, -2, H1], [1, -2, S0], [-1, -1, H1], [0, -1, S0], [1, -1, S1], [0, 0, S0], [0, 1, S1], [0, 2, S0]],
    [[1, -2, H1], [2, -2, H0], [1, -1, S0], [2, -1, H1], [0, 0, S0], [-1, 1, S1], [-2, 2, S0]],
  ];
})();

/** A tumbling bolt: a hex head and a threaded shank, ink outlined, 4 pixel frames. */
function drawBolt(g: Raster, x: number, y: number, ph: number): void {
  stamp(g, x, y, BOLT[Math.floor(ph) & 3]);
}

/** A brass nut: a 3×3 ring with a dark hole, lit top-left; edge-on a 3×1 bar. Ink outlined. */
function drawNut(g: Raster, x: number, y: number, ph: number): void {
  const k = Math.floor(ph) & 3;
  if (k === 1 || k === 3) {
    stamp(g, x, y, [[-1, 0, PAL.gold3], [0, 0, PAL.gold2], [1, 0, PAL.gold1]]);
    return;
  }
  stamp(g, x, y, [
    [-1, -1, PAL.gold4], [0, -1, PAL.gold3], [1, -1, PAL.gold2],
    [-1, 0, PAL.gold3], [0, 0, PAL.night0], [1, 0, PAL.gold1],
    [-1, 1, PAL.gold2], [0, 1, PAL.gold1], [1, 1, PAL.gold0],
  ]);
}

const GEARS = new Map<string, Cell[]>();
/** A cog of radius 2 with 8 square teeth (7×7 with the teeth) (2 tooth phases: it turns), a brass hub, lit top-left. */
function gearCells(k: number): Cell[] {
  const id = `g${k}`;
  let c = GEARS.get(id);
  if (c) return c;
  c = [];
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++) {
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx) / TAU + 0.5 + k / 16;
      const tooth = r > 2.2 && r <= 3.2 && Math.floor(a * 8 * 2) % 2 === 0;
      if (r > 2.2 && !tooth) continue;
      const lit = dx + dy < 0;
      const col = r < 0.5 ? PAL.night0 : r < 1.2 ? PAL.gold2 : tooth ? (lit ? PAL.stone3 : PAL.stone1) : lit ? PAL.stone4 : dx + dy === 0 ? PAL.stone3 : PAL.stone2;
      c.push([dx, dy, col]);
    }
  GEARS.set(id, c);
  return c;
}

/** An iron gear: a toothed cog that turns (2 frames) and tumbles edge-on; flat on the floor an iso ellipse. */
function drawGear(g: Raster, x: number, y: number, ph: number, flat: number): void {
  if (flat >= 1) {
    stamp(g, x, y, [[-3, 0, PAL.stone3], [-2, 0, PAL.stone3], [-1, 0, PAL.stone2], [0, 0, PAL.night0], [1, 0, PAL.stone2], [2, 0, PAL.stone1], [3, 0, PAL.stone1], [-2, -1, PAL.stone4], [-1, -1, PAL.stone3], [0, -1, PAL.stone3], [1, -1, PAL.stone2], [2, -1, PAL.stone2], [-1, 1, PAL.stone1], [1, 1, PAL.stone1]]);
    return;
  }
  const k = Math.floor(ph) & 3;
  if (k === 3) {
    // edge-on: a toothed bar
    stamp(g, x, y, [[-3, 0, PAL.stone3], [-2, 0, PAL.stone4], [-1, 0, PAL.stone3], [0, 0, PAL.gold2], [1, 0, PAL.stone2], [2, 0, PAL.stone2], [3, 0, PAL.stone1], [-2, -1, PAL.stone3], [0, -1, PAL.stone3], [2, -1, PAL.stone2]]);
    return;
  }
  stamp(g, x, y, gearCells(k & 1));
}

/** A rust plate with a rivet: 3 tumble frames (face, tilted, edge). */
function drawPlate(g: Raster, x: number, y: number, ph: number): void {
  const k = Math.floor(ph) % 4;
  if (k === 0) {
    g.rect(x - 2, y - 1, 5, 1, PAL.earth3);
    g.rect(x - 2, y, 5, 1, PAL.earth2);
    g.rect(x - 2, y + 1, 5, 1, PAL.earth1);
    g.px(x - 1, y, PAL.stone4);
  } else if (k === 1 || k === 3) {
    g.px(x - 2, y + 1, PAL.earth3);
    g.px(x - 1, y, PAL.earth3);
    g.px(x, y, PAL.earth2);
    g.px(x + 1, y - 1, PAL.earth2);
    g.px(x - 1, y + 1, PAL.earth1);
    g.px(x, y + 1, PAL.earth1);
    g.px(x + 2, y - 1, PAL.earth1);
  } else {
    g.rect(x - 2, y, 5, 1, PAL.earth2);
    g.px(x - 2, y, PAL.earth3);
  }
}

/** A loose cart wheel (iron tyre, wooden spokes, brass hub), r = 5; flat on the floor an iso ellipse. */
function drawWheel(g: Raster, x: number, y: number, turn: number, flat: number): void {
  if (flat >= 0.5) {
    const ry = flat >= 1 ? 1 : 2;
    g.ell(x, y, 6, ry + 1, PAL.ink);
    g.ell(x, y, 5, ry, PAL.stone2);
    g.px(x - 3, y - ry, PAL.stone3);
    g.px(x, y, PAL.gold3);
    g.line(x - 3, y, x + 3, y, PAL.earth2);
    return;
  }
  const cy = y - 5;
  g.ring(x, cy, 6, 6, PAL.ink);
  g.ring(x, cy, 5, 5, PAL.stone2);
  g.px(x - 3, cy - 4, PAL.stone3);
  g.px(x - 4, cy - 3, PAL.stone3);
  for (let i = 0; i < 3; i++) {
    const a = turn * TAU + (i * TAU) / 6;
    g.line(Math.round(x - Math.cos(a) * 4), Math.round(cy - Math.sin(a) * 4), Math.round(x + Math.cos(a) * 4), Math.round(cy + Math.sin(a) * 4), PAL.earth3);
  }
  g.px(x, cy, PAL.gold3);
  g.px(x - 1, cy - 1, PAL.gold4);
}

/** A self-running layer of scrap pieces over a box; resolves when `ms` is over (pieces fade in steps at the end). */
export class Junk {
  private readonly r: Raster;
  readonly done: Promise<void>;
  constructor(sc: Phaser.Scene, readonly pieces: JunkPiece[], box: { cx: number; cy: number; w: number; h: number }, depth: number, ms: number) {
    this.r = Raster.around(sc, box.cx, box.cy, box.w, box.h, depth);
    for (const p of pieces) {
      p.ph = p.ph ?? RR(0, 4);
      p.fall = 0;
      p.turn = 0;
    }
    this.done = animate(sc, ms, (t, el, dt) => {
      const s = dt / 1000;
      const fade = t > 0.8 ? (t - 0.8) / 0.2 : 0;
      this.r.draw((g) => {
        for (const p of this.pieces) {
          if (p.delay && el < p.delay) continue;
          if (!p.rest) {
            p.vy += (p.g ?? 420) * s;
            p.x += p.vx * s;
            p.y += p.vy * s;
            p.ph! += (p.spin ?? 10) * s;
            if (p.y >= p.floor && p.vy > 0) {
              p.y = p.floor;
              if (p.vy < 40) {
                p.vy = 0;
                if (p.roll === undefined) p.rest = true;
              } else p.vy = -p.vy * (p.bounce ?? 0.35);
              p.vx *= p.roll !== undefined ? 0.85 : 0.55;
              p.spin = (p.spin ?? 10) * 0.5;
            }
            if (p.roll !== undefined && p.y >= p.floor - 0.5 && p.vy === 0) {
              p.vx *= Math.exp(-p.roll * s);
              p.turn! += (p.vx * s) / (TAU * 5);
              if (Math.abs(p.vx) < 8) p.fall = Math.min(1, p.fall! + s * 5);
              if (p.fall! >= 1) p.rest = true;
            }
          }
          // stepped fade: every other piece goes first, then the rest (EF-6: no alpha ramps on pixel pieces)
          if (fade > 0.66 || (fade > 0.33 && this.pieces.indexOf(p) % 2)) continue;
          const x = Math.round(p.x);
          const y = Math.round(p.y);
          switch (p.kind) {
            case 'bolt':
              drawBolt(g, x, y, p.rest ? 0 : p.ph!);
              break;
            case 'nut':
              drawNut(g, x, y, p.rest ? 1 : p.ph!);
              break;
            case 'gear':
              drawGear(g, x, y - 2, p.ph!, p.rest ? 1 : p.fall!);
              break;
            case 'plate':
              drawPlate(g, x, y, p.rest ? 2 : p.ph!);
              break;
            case 'wheel':
              drawWheel(g, x, y, p.turn!, p.rest ? 1 : p.fall!);
              break;
          }
        }
      });
    }).then(() => this.r.destroy());
  }
  destroy(): void {
    this.r.destroy();
  }
}

// ================================================================ summon

/**
 * The scrap shower (summon lead): a growing shadow on the tile and a handful of junk falling from above onto it,
 * bouncing once. Resolves when the last piece has landed (≈ `ms`).
 */
export function scrapRain(sc: Phaser.Scene, home: XY, depth: number, ms = 300): Promise<void> {
  const kinds: JunkKind[] = ['plate', 'bolt', 'gear', 'nut', 'plate', 'bolt'];
  const pieces: JunkPiece[] = kinds.map((kind, i) => {
    const delay = Math.round((i / kinds.length) * ms * 0.55);
    const fallMs = ms - delay;
    const h = 70 + RR(0, 20);
    // free fall from h above: v0 = 0, a = 2h / T²
    const T = fallMs / 1000;
    const g = (2 * h) / (T * T);
    return { kind, x: home.x + RR(-14, 14), y: home.y - h + RR(-4, 4), vx: RR(-6, 6), vy: 0, g, floor: home.y + RR(-3, 3), bounce: 0.25, delay, spin: RR(8, 16) };
  });
  const junk = new Junk(sc, pieces, { cx: home.x, cy: home.y - 50, w: 90, h: 120 }, depth, ms + 420);
  // speed lines: the air the pile cuts on its way down (white heads, grey tails)
  const sp = new Sparks(sc, depth - 0.1);
  for (let i = 0; i < 7; i++) {
    sp.add({ x: home.x + RR(-18, 18), y: home.y - RR(70, 95), vy: RR(300, 380), delay: Math.round(RR(0, ms * 0.6)), life: RR(160, 220), colors: [PAL.white, PAL.mist, PAL.stone4], shape: 'streak', len: 0.04, fadeAt: 0.6 });
  }
  sp.release();
  // the shadow of the falling pile: an iso ellipse that grows on the tile (3 steps)
  const shadow = Raster.around(sc, home.x, home.y, 64, 24, FLOOR_DEPTH);
  void animate(sc, ms + 60, (t) => {
    shadow.draw((g) => {
      const k = Math.min(3, Math.floor(t * 4));
      if (k === 0) return;
      const w = [0, 8, 14, 20][k];
      g.ell(home.x, home.y, w, Math.max(1, w >> 2), [PAL.night1, PAL.night1, PAL.night0, PAL.night0][k]);
    });
  }).then(() => shadow.destroy());
  void junk;
  return animate(sc, ms, () => undefined);
}

/** Floor dust rolling out from `at` (k = size 0.5 … 1.5). */
export function heapDust(sc: Phaser.Scene, at: XY, k: number, depth: number): void {
  const sp = new Sparks(sc, depth);
  const n = Math.round(6 + k * 6);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + RR(-0.2, 0.2);
    const sp0 = RR(22, 40) * k;
    sp.add({ x: at.x + Math.cos(a) * 8 * k, y: at.y + Math.sin(a) * 3 * k, vx: Math.cos(a) * sp0, vy: Math.sin(a) * sp0 * 0.4 - RR(2, 8), drag: 3, life: RR(380, 620), colors: DUST, shape: 'puff', size: RR(1.5, 2.5) * Math.min(1.2, k), grow: 3, alpha: 0.5 });
  }
  sp.release();
}

/** One hammer blow: a white star, a fan of hot sparks and a floor-light blink. */
export function hammerSparks(sc: Phaser.Scene, at: XY, k: number, depth: number, floorY: number): void {
  const sp = new Sparks(sc, depth);
  sp.add({ x: at.x, y: at.y, life: 120, colors: [PAL.white, PAL.gold4], shape: 'star', size: 2 + k * 1.5, fadeAt: 0.6 });
  const n = Math.round(4 + k * 4);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + RR(-1.3, 1.3);
    const v = RR(50, 95) * (0.7 + k * 0.3);
    sp.add({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 300, life: RR(180, 320), colors: HOT, shape: 'streak', len: 0.02, fadeAt: 0.6 });
  }
  sp.release();
  void lightFlash(sc, at.x, at.y, PAL.gold4, Math.round(14 + k * 6), 160, { floorY, intensity: 0.55 + k * 0.15 });
}

/** The stove's VUF: a fire burst out of the pipe top, embers rising, a black smoke ring, the fire light. */
export function stoveBurst(sc: Phaser.Scene, top: XY, floorY: number, depth: number, k = 1): void {
  const sp = new Sparks(sc, depth);
  for (let i = 0; i < 7; i++) {
    sp.add({ x: top.x + RR(-2, 2), y: top.y - 2, vx: RR(-14, 14), vy: RR(-70, -40) * k, drag: 2.5, life: RR(220, 360), colors: FIRE, shape: 'puff', size: RR(2, 3.5) * k, grow: 3, alpha: 0.95 });
  }
  for (let i = 0; i < 6; i++) {
    sp.add({ x: top.x + RR(-3, 3), y: top.y - 4, vx: RR(-20, 20), vy: RR(-90, -50), ay: 60, life: RR(400, 700), colors: [PAL.gold4, PAL.fire4, PAL.fire3, PAL.fire2], shape: 'px', flicker: true });
  }
  // the black smoke ring the burst pushes ahead of itself
  sp.add({ x: top.x, y: top.y - 10, vy: -20, life: 520, delay: 90, colors: SMOKE, shape: 'ring', size: 3, grow: 9, alpha: 0.8, fadeAt: 0.5 });
  sp.release();
  void lightFlash(sc, top.x, top.y, PAL.fire4, Math.round(18 * k), 300, { intensity: 0.8, air: 0.7 });
  void floorY;
}

// ================================================================ strike

/** The back-pedal: sparks spat backwards off the rear tyre at floor level. */
export function tyreSparks(sc: Phaser.Scene, at: XY, back: 1 | -1, depth: number, n = 6): void {
  const sp = new Sparks(sc, depth);
  for (let i = 0; i < n; i++) {
    sp.add({ x: at.x + RR(-1, 1), y: at.y - RR(0, 2), vx: back * RR(50, 110), vy: RR(-60, -15), ay: 260, life: RR(150, 280), colors: HOT, shape: 'streak', len: 0.025, floor: at.y + 1, bounce: 0.3 });
  }
  sp.release();
}

/** Scorched tyre marks on the marble behind the wheels: two dark strokes that fade in steps. */
export function skidMarks(sc: Phaser.Scene, at: XY, back: 1 | -1, len: number, ms: number): void {
  const r = Raster.around(sc, at.x + (back * len) / 2, at.y, len + 8, 10, FLOOR_DEPTH);
  void animate(sc, ms, (t) => {
    r.draw((g) => {
      const c = t < 0.5 ? PAL.night0 : t < 0.8 ? PAL.night1 : PAL.night2;
      const l = Math.round(len * Math.min(1, t * 4));
      g.line(at.x, at.y, at.x + back * l, at.y, c);
      g.line(at.x + back * 2, at.y + 2, at.x + back * Math.max(2, l - 3), at.y + 2, c);
    });
  }).then(() => r.destroy());
}

/** Black exhaust clouds out of the pipe. */
export function smokePuffs(sc: Phaser.Scene, at: XY, n: number, depth: number, back: 1 | -1 = 1): void {
  const sp = new Sparks(sc, depth);
  for (let i = 0; i < n; i++) {
    sp.add({ x: at.x + RR(-1, 1), y: at.y - 1, vx: back * RR(6, 22), vy: RR(-34, -18), drag: 1.5, delay: i * 60, life: RR(480, 760), colors: SMOKE, shape: 'puff', size: RR(2, 3), grow: 5, alpha: 0.85 });
  }
  sp.release();
}

/** The ram's contact: bolts, nuts and a gear fly forward-up, a fan of sparks, a dust kick. */
export function ramDebris(sc: Phaser.Scene, at: XY, dir: 1 | -1, o: { floorY: number; depth: number; big?: boolean; blocked?: boolean }): void {
  const big = o.big ? 1.3 : 1;
  const back = o.blocked ? -1 : 1;
  const kinds: JunkKind[] = o.blocked ? ['bolt', 'nut', 'bolt', 'plate', 'bolt'] : ['bolt', 'gear', 'nut', 'bolt', 'nut', 'bolt', 'plate', 'gear', 'bolt', 'plate'];
  const pieces: JunkPiece[] = kinds.map((kind, i) => ({
    kind,
    x: at.x + RR(-2, 2),
    y: at.y + RR(-2, 2),
    vx: dir * back * RR(30, 85) * big * (i % 3 === 2 ? -0.6 : 1),
    vy: -RR(90, 150) * big,
    floor: o.floorY + RR(-3, 4),
    bounce: 0.4,
    spin: RR(10, 22),
    roll: kind === 'gear' ? 2.2 : undefined,
  }));
  void new Junk(sc, pieces, { cx: at.x, cy: o.floorY - 30, w: 150, h: 90 }, o.depth, 1100).done;
  const sp = new Sparks(sc, o.depth + 0.1);
  sp.add({ x: at.x, y: at.y, life: 110, colors: [PAL.white, PAL.gold4], shape: 'star', size: 5 * big, fadeAt: 0.5 });
  for (let i = 0; i < 12; i++) {
    const a = (dir * back > 0 ? 0 : Math.PI) + RR(-1.1, 1.1);
    const v = RR(70, 150) * big;
    sp.add({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, ay: 280, life: RR(160, 300), colors: HOT, shape: 'streak', len: 0.022, fadeAt: 0.55 });
  }
  for (let i = 0; i < 5; i++) {
    sp.add({ x: at.x + RR(-6, 6), y: o.floorY + RR(-1, 2), vx: dir * RR(-20, 30), vy: RR(-14, -4), drag: 3, life: RR(400, 600), colors: DUST, shape: 'puff', size: 2, grow: 3, alpha: 0.5 });
  }
  sp.release();
}

/** The follow-through: the loose wheel spits one bolt that tinks away over the floor. */
export function looseBolt(sc: Phaser.Scene, at: XY, dir: 1 | -1, floorY: number, depth: number): void {
  void new Junk(sc, [{ kind: 'bolt', x: at.x, y: at.y, vx: dir * RR(30, 45), vy: -RR(70, 90), floor: floorY + 2, bounce: 0.45, spin: 18 }], { cx: at.x + dir * 20, cy: floorY - 12, w: 70, h: 40 }, depth, 900).done;
  const sp = new Sparks(sc, depth);
  sp.add({ x: at.x, y: at.y, life: 90, colors: [PAL.white, PAL.gold4], shape: 'star', size: 2 });
  sp.release();
}

// ================================================================ the tired guard

/** Sweat drops flicked off the three heads and steam out of the stove (the tired turn). */
export function sweatAndSteam(sc: Phaser.Scene, heads: XY[], stove: XY | null, depth: number, floorY: number): void {
  const sp = new Sparks(sc, depth);
  heads.forEach((h, i) => {
    for (let j = 0; j < 2; j++) {
      const side = j ? 1 : -1;
      sp.add({ x: h.x + side * 3, y: h.y - 3, vx: side * RR(14, 26), vy: -RR(30, 45), ay: 260, delay: i * 70 + j * 40, life: RR(320, 420), colors: [PAL.white, PAL.water4, PAL.water3], shape: 'px', floor: floorY, bounce: 0 });
    }
  });
  if (stove) {
    for (let i = 0; i < 4; i++) sp.add({ x: stove.x + RR(-2, 2), y: stove.y - 4, vx: RR(-8, 8), vy: -RR(18, 30), drag: 1, delay: i * 90, life: RR(500, 700), colors: STEAM, shape: 'puff', size: 2, grow: 4, alpha: 0.6 });
  }
  sp.release();
}

// ================================================================ death

/** The three-way flight: dust kicked up at the running feet of the three goblins (pose frames 3 … 6). */
export function fleeDust(sc: Phaser.Scene, u: MonsterUnit, floorY: number, depth: number): void {
  const sp = new Sparks(sc, depth);
  const who: ('pFeet' | 'wFeet' | 'sFeet')[] = ['pFeet', 'wFeet'];
  for (const f of [3, 4, 5, 6]) {
    for (const w of who) {
      const off = skPt('death', f, w);
      const p = u.framePoint(off[0], off[1]);
      sp.add({ x: Math.round(p.x), y: floorY - RR(0, 1), vx: RR(-6, 6), vy: -RR(4, 10), drag: 2, delay: (f - 3) * 75, life: RR(300, 460), colors: DUST, shape: 'puff', size: 2, grow: 3, alpha: 0.5 });
    }
  }
  sp.release();
}

/**
 * The death's final material (§5.2 C5 "araba çöker, goblinler kaçar"): rust plates slide out, gears and nuts
 * roll and fall flat, one wheel rolls off forward and settles, the stove's last embers rise and die.
 */
export function scrapScatter(sc: Phaser.Scene, home: XY, dir: 1 | -1, depth: number): void {
  const pieces: JunkPiece[] = [
    { kind: 'wheel', x: home.x + dir * 10, y: home.y, vx: dir * RR(40, 50), vy: -30, floor: home.y + 2, roll: 1.6, bounce: 0.2, spin: 0 },
    { kind: 'plate', x: home.x - dir * 6, y: home.y - 10, vx: -dir * RR(30, 50), vy: -RR(50, 70), floor: home.y + 3, bounce: 0.2, spin: 12 },
    { kind: 'plate', x: home.x + dir * 2, y: home.y - 12, vx: dir * RR(15, 30), vy: -RR(60, 80), floor: home.y + 5, bounce: 0.2, spin: 10 },
    { kind: 'gear', x: home.x, y: home.y - 8, vx: -dir * RR(30, 45), vy: -RR(40, 60), floor: home.y + 1, roll: 2.4, spin: 12 },
    { kind: 'gear', x: home.x + dir * 4, y: home.y - 6, vx: dir * RR(20, 30), vy: -RR(50, 70), floor: home.y + 4, roll: 2.8, spin: 12 },
    { kind: 'nut', x: home.x - dir * 2, y: home.y - 14, vx: RR(-30, 30), vy: -RR(70, 90), floor: home.y + 2, bounce: 0.4, spin: 16 },
    { kind: 'bolt', x: home.x + dir * 6, y: home.y - 12, vx: dir * RR(35, 55), vy: -RR(60, 90), floor: home.y - 1, bounce: 0.4, spin: 18 },
    { kind: 'bolt', x: home.x - dir * 8, y: home.y - 10, vx: -dir * RR(25, 45), vy: -RR(60, 80), floor: home.y + 4, bounce: 0.4, spin: 18 },
  ];
  void new Junk(sc, pieces, { cx: home.x, cy: home.y - 12, w: 140, h: 60 }, depth, 1250).done;
  const sp = new Sparks(sc, depth + 0.1);
  for (let i = 0; i < 6; i++) sp.add({ x: home.x - dir * 14 + RR(-3, 3), y: home.y - 6, vx: RR(-10, 10), vy: -RR(20, 40), delay: i * 70, life: RR(500, 800), colors: [PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1], shape: 'px', flicker: true });
  sp.release();
  heapDust(sc, home, 0.9, depth - 0.1);
}

// ================================================================ the three runners (death f3)

type Who = 'P' | 'W' | 'S';
/** Runner frames drawn by the cart's own rig (only that goblin, legs running): cropped canvases + their hip spot. */
const RUNNERS = new Map<string, { key: string; hx: number; hy: number }>();
function runnerTex(sc: Phaser.Scene, who: Who, k: number, light: 'left' | 'right'): { key: string; hx: number; hy: number } {
  const id = `raiders:runner:${who}:${k}:${light}`;
  const had = RUNNERS.get(id);
  if (had && sc.textures.exists(had.key)) return had;
  const hip = FLEE_START[who];
  const dx = hip[0] - RX;
  const dy = hip[1] - GY;
  const lp = k / 3;
  const o = pose({
    aTub: 0, aWh: 0, aRam: 0, aTop: 0, heap: 0, smk: 0, door: 0, pVis: 0, wVis: 0, sVis: 0,
    ...(who === 'P' ? { pVis: 1, pLeg: 2, pX: dx, pY: dy, pLp: lp, pArm: 1, pM: 2, pE: 3, pHy: k === 1 ? -1 : 0 } : {}),
    ...(who === 'W' ? { wVis: 1, wLeg: 2, wX: dx, wY: dy, wLp: lp, wM: 2, wE: 3, wAng: -2.2, wAy: -9, wHy: k === 1 ? -1 : 0 } : {}),
    ...(who === 'S' ? { sVis: 1, sLeg: 2, sX: dx, sY: dy, sLp: lp, sM: 2, sE: 3, sAy: -8, sHy: k === 1 ? -1 : 0 } : {}),
  });
  const pc = new PixelCanvas(ART_W, ART_H);
  drawRaiders(pc, o, light);
  const b = pc.bounds() ?? { x: 0, y: 0, w: 1, h: 1 };
  const crop = pc.crop(b.x, b.y, b.w, b.h);
  const rec = { key: canvasTexture(sc, id, crop), hx: hip[0] - b.x, hy: hip[1] - b.y };
  RUNNERS.set(id, rec);
  return rec;
}

/**
 * The death's three-way flight (§5.2 C5 "goblinler kaçar"): the goblins leave the wreck as three runner sprites
 * where the art hides them (death f3) — the pedaller runs out the back, the wrench goblin out the front, the
 * slinger jumps down and runs off up the field (away from the duelist). 3-frame run cycle, whole-px steps, a dust
 * kick at every footfall; each runner fades in steps off the tile.
 */
export function goblinRunners(sc: Phaser.Scene, u: MonsterUnit, floorY: number, depth: number): Promise<void> {
  const dir: 1 | -1 = u.flipX ? -1 : 1;
  const plan: { who: Who; vx: number; vy: number; hop: number; delay: number }[] = [
    { who: 'P', vx: -dir * 74, vy: 6, hop: 0, delay: 0 },
    { who: 'W', vx: dir * 82, vy: 4, hop: 0, delay: 30 },
    { who: 'S', vx: -dir * 22, vy: -34, hop: 1, delay: 60 },
  ];
  const ms = 720;
  const jobs = plan.map((r) => {
    const start = u.framePoint(FLEE_START[r.who][0] + 0.5, FLEE_START[r.who][1] + 0.5);
    // a runner faces where it runs on screen (the rig draws facing right; a flipped one is drawn relit so the
    // key light stays on the screen's left, as the relit P2 sheets do)
    const flip = r.vx < 0;
    const light: 'left' | 'right' = flip ? 'right' : 'left';
    const t0 = runnerTex(sc, r.who, 0, light);
    const img = sc.add.image(Math.round(start.x), Math.round(start.y), t0.key).setDepth(depth);
    img.setFlipX(flip);
    const place = (key: { key: string; hx: number; hy: number }, x: number, y: number) => {
      img.setTexture(key.key);
      const w = img.width;
      const ox = flip ? w - key.hx : key.hx;
      img.setOrigin(ox / w, key.hy / img.height);
      img.setPosition(Math.round(x), Math.round(y));
    };
    place(t0, start.x, start.y);
    img.setVisible(r.delay === 0);
    let lastStep = -1;
    const sp = new Sparks(sc, depth - 0.1);
    // the slinger's drop from the deck to the floor, then on foot
    const dropY = floorY - 6;
    return animate(sc, ms, (t, el) => {
      if (el < r.delay) return;
      img.setVisible(true);
      const s = (el - r.delay) / 1000;
      let x = start.x + r.vx * s * (1 + s * 0.8);
      let y = start.y + r.vy * s;
      if (r.hop) {
        // falls off the deck in the first ~180 ms (a small arc), then runs up the field
        const k = Math.min(1, s / 0.18);
        y = start.y + (dropY - start.y) * k * k - Math.sin(k * Math.PI) * 4 + (s > 0.18 ? r.vy * (s - 0.18) : 0);
        x = start.x + r.vx * s;
      }
      const step = Math.floor(el / 70) % 3;
      place(runnerTex(sc, r.who, step, light), x, y);
      if (step !== lastStep) {
        lastStep = step;
        if (step === 0 && (!r.hop || s > 0.18)) sp.add({ x: Math.round(x), y: Math.round(r.hop ? y + 6 : floorY), vx: -Math.sign(r.vx) * RR(4, 10), vy: -RR(4, 9), drag: 2, life: RR(280, 400), colors: DUST, shape: 'puff', size: 2, grow: 3, alpha: 0.5 });
      }
      // off the tile: stepped fade (EF-6)
      img.setAlpha(t > 0.85 ? 0.35 : t > 0.72 ? 0.7 : 1);
    }).then(() => {
      sp.release();
      img.destroy();
    });
  });
  return Promise.all(jobs).then(() => undefined);
}
