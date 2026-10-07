// Summon VFX library — magic circles, light pillars, shockwaves, the six attribute summon set
// pieces (GAME_DESIGN §6 `summon` / `tribute` / `flip` / `set`) and the tribute pixel stream.
//
// Layering: floor pieces (circles, cracks, vortex, ripples, shockwaves) are LiveRasters at
// DEPTH.TILE_FX — under cards and units. Beams / tornado backs sit just behind the summoned unit
// (unitDepth(y) - 1), tornado fronts / tendril fronts / orbiting rocks in front swap around it,
// sparks and flares are at DEPTH.FX. Every object destroys itself; every function resolves when
// its main beat ends.
//
// All floor geometry is projected 2:1 (iso): a floor circle of radius r is an ellipse r × r/2.

import Phaser from 'phaser';
import type { Attribute, MonsterId } from '../data/cards';
import type { PlayerId } from '../engine/types';
import { ATTRIBUTE_RAMP, PAL, PLAYER_RAMP, RAMPS, type Ramp } from '../art/palette';
import { PixelCanvas, mix, mulberry32 } from '../art/pixel';
import { monsterAnimKey, monsterFrameName } from '../art/textures';
import { DEPTH, GAME_H, GAME_W, TILE_H, TILE_W, unitDepth } from '../view/layout';
import { flash, hitStop, shake, wait } from './core';
import {
  type HoloTarget,
  clearHologram,
  framePixels,
  holoRamp,
  materialize,
  opaqueBox,
  pixelToWorld,
  setHologram,
  whiteFlash,
} from './hologram';
import {
  LiveRaster,
  PANIM,
  PTEX,
  Swarm,
  animate,
  bayer,
  bubbles,
  bubblesSmall,
  droplets,
  dust,
  embers,
  feathers as featherPreset,
  glints,
  leaves as leafPreset,
  motes,
  onTick,
  rampFrom,
  ringPixels,
  rnd,
  rocks as rockPreset,
  rrange,
  shadowWisps,
  smokePuffs,
  sparkles,
  wrapAngle,
} from './particles';

const TAU = Math.PI * 2;
const ISO = 0.5;

// ================================================================ small raster helpers

/** Extended ramp lookup: indices above 4 go to white, below 0 to ink. */
function rc(ramp: Ramp, i: number): number {
  if (i >= 5) return PAL.white;
  if (i < 0) return PAL.ink;
  return ramp[Math.floor(i)];
}

/** Set a pixel if it passes the dither `fade` (1 = always). */
function dset(p: PixelCanvas, x: number, y: number, c: number, fade = 1): void {
  x = Math.round(x);
  y = Math.round(y);
  if (fade >= 1 || bayer(x, y) < fade) p.set(x, y, c);
}

/** Bresenham line with dither fade; `upto` (0..1) draws only the first part. */
function dline(p: PixelCanvas, x0: number, y0: number, x1: number, y1: number, c: number, fade = 1, upto = 1): void {
  if (upto <= 0) return;
  x1 = x0 + (x1 - x0) * Math.min(1, upto);
  y1 = y0 + (y1 - y0) * Math.min(1, upto);
  let ax = Math.round(x0);
  let ay = Math.round(y0);
  const bx = Math.round(x1);
  const by = Math.round(y1);
  const dx = Math.abs(bx - ax);
  const dy = -Math.abs(by - ay);
  const sx = ax < bx ? 1 : -1;
  const sy = ay < by ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 2000; guard++) {
    dset(p, ax, ay, c, fade);
    if (ax === bx && ay === by) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      ax += sx;
    }
    if (e2 <= dx) {
      err += dx;
      ay += sy;
    }
  }
}

interface RingOpts {
  fade?: number;
  /** Start angle and sweep fraction (0..1) for draw-on arcs. */
  from?: number;
  sweep?: number;
  /** Dashes: count, duty (0..1), phase (rad). */
  dash?: [number, number, number];
  /** Only the near (front) or far (back) half. */
  half?: 'front' | 'back';
  /** Per-pixel color override by floor angle (return null to skip). */
  colorAt?: (ang: number) => number | null;
}

/** 1px iso floor ring of floor-radius r centered at (cx, cy) (pixel corner). */
function isoRing(p: PixelCanvas, cx: number, cy: number, r: number, c: number, o: RingOpts = {}): void {
  if (r < 1) return;
  const rp = ringPixels(r, r * ISO);
  const fade = o.fade ?? 1;
  const sweep = o.sweep ?? 1;
  const from = o.from ?? 0;
  for (let i = 0; i < rp.n; i++) {
    const a = rp.ang[i];
    if (sweep < 1 && wrapAngle(a - from) > sweep * TAU) continue;
    if (o.dash) {
      const [n, duty, ph] = o.dash;
      const seg = (wrapAngle(a - ph) / TAU) * n;
      if (seg - Math.floor(seg) > duty) continue;
    }
    if (o.half === 'front' && Math.sin(a) < 0) continue;
    if (o.half === 'back' && Math.sin(a) >= 0) continue;
    let col: number | null = c;
    if (o.colorAt) col = o.colorAt(a);
    if (col === null) continue;
    dset(p, cx + rp.xs[i], cy + rp.ys[i], col, fade);
  }
}

/** Dithered iso floor disc (density 0..1). */
function isoDisc(p: PixelCanvas, cx: number, cy: number, r: number, c: number, density: number): void {
  if (r < 1 || density <= 0) return;
  const ry = r * ISO;
  for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - r) - 1; x <= Math.ceil(cx + r); x++) {
      const dx = (x + 0.5 - cx) / r;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1 && bayer(x, y) < density) p.set(x, y, c);
    }
  }
}

function projX(cx: number, r: number, a: number): number {
  return cx + Math.cos(a) * r;
}
function projY(cy: number, r: number, a: number): number {
  return cy + Math.sin(a) * r * ISO;
}

/**
 * hitStop that is safe to overlap: core.hitStop saves/restores the time scales, so a second call
 * during an active stop would save 0 and freeze the scene forever. Skip if a stop is running.
 */
function safeHitStop(scene: Phaser.Scene, ms: number): Promise<void> {
  if (scene.tweens.timeScale === 0 || scene.time.timeScale === 0) return Promise.resolve();
  return hitStop(scene, ms);
}

const easeOut3 = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIn2 = (t: number) => t * t;
const easeInOut = (t: number) => t * t * (3 - 2 * t);
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// ================================================================ boot textures

export const STEX = {
  /** Hexagon ring outlines for lens-flare ghosts (white). */
  hex7: 'fx:hex7',
  hex11: 'fx:hex11',
  /** 12×10 sheet, frames '0'..'2': boulders that orbit an EARTH summon. */
  boulder: 'fx:boulder',
} as const;

/** Summon-specific textures (lens flare ghosts, boulders). Called from the boot step. */
export function buildSummonTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(STEX.hex7)) return;
  const hex = (key: string, r: number) => {
    const s = r * 2 + 1;
    const p = new PixelCanvas(s, s);
    const pts: [number, number][] = [];
    for (let k = 0; k < 6; k++) pts.push([r + 0.5 + Math.cos((k * TAU) / 6) * r, r + 0.5 + Math.sin((k * TAU) / 6) * r * 0.9]);
    for (let k = 0; k < 6; k++) dline(p, pts[k][0] - 0.5, pts[k][1] - 0.5, pts[(k + 1) % 6][0] - 0.5, pts[(k + 1) % 6][1] - 0.5, PAL.white);
    scene.textures.addCanvas(key, p.toCanvas());
  };
  hex(STEX.hex7, 3);
  hex(STEX.hex11, 5);

  const shapes: [number, number][][] = [
    [
      [1, 4],
      [4, 1],
      [8, 1],
      [11, 4],
      [10, 8],
      [5, 9],
      [1, 7],
    ],
    [
      [1, 3],
      [5, 1],
      [10, 2],
      [11, 6],
      [7, 9],
      [2, 8],
    ],
    [
      [2, 2],
      [7, 1],
      [10, 4],
      [9, 9],
      [3, 9],
      [1, 6],
    ],
  ];
  const cv = new PixelCanvas(12 * 3, 10);
  shapes.forEach((pts, i) => {
    const p = new PixelCanvas(12, 10);
    p.poly(
      pts.map(([x, y]) => [x, y] as const),
      PAL.earth2,
    );
    p.map((c, x, y) => {
      if (!p.isOpaque(x, y - 1) || !p.isOpaque(x - 1, y)) return PAL.earth3;
      if (!p.isOpaque(x, y + 1) || !p.isOpaque(x + 1, y)) return PAL.earth1;
      if ((x * 7 + y * 3 + i) % 11 === 0) return PAL.earth1;
      return c;
    });
    p.set(pts[1][0], pts[1][1] + 1, PAL.earth4).set(pts[1][0] + 1, pts[1][1] + 1, PAL.earth4);
    p.outline(PAL.ink);
    cv.blit(p, i * 12, 0);
  });
  const tex = scene.textures.addCanvas(STEX.boulder, cv.toCanvas())!;
  for (let i = 0; i < 3; i++) tex.add(String(i), 0, i * 12, 0, 12, 10);
}

// ================================================================ magic circle

export type CircleSize = 'normal' | 'big';

export interface MagicCircleOpts {
  attribute: Attribute;
  player?: PlayerId;
  size?: CircleSize;
  /** Total lifetime for magicCircle() (appear + hold + dissolve). Default 1100 (big 1500). */
  ms?: number;
  /** Draw-on time. Default 260. */
  appearMs?: number;
  depth?: number;
  ramp?: Ramp;
}

export interface MagicCircleCtl {
  /** Resolves when the circle has fully drawn itself. */
  ready: Promise<void>;
  /** Brighten one ramp step for a moment (beat accents). */
  pulse(ms?: number): void;
  /** Spin speed multiplier (1 = idle spin). */
  spin(k: number): void;
  /** Expand slightly and dither-dissolve; resolves when gone. */
  dismiss(ms?: number): Promise<void>;
}

/** 3×3 rune glyphs (iso-friendly: they fit the compressed top/bottom of a floor band). */
const GLYPHS: readonly string[][] = [
  ['x.x', '.x.', 'x.x'],
  ['xxx', '.x.', '.x.'],
  ['x..', 'xxx', '..x'],
  ['.x.', 'x.x', '.x.'],
  ['xx.', 'x.x', '.xx'],
  ['x.x', 'xxx', 'x.x'],
  ['.xx', '.x.', 'xx.'],
  ['xxx', 'x..', 'xxx'],
  ['x.x', 'x.x', '.x.'],
  ['..x', '.x.', 'xxx'],
];

function stampGlyph(p: PixelCanvas, g: readonly string[], x: number, y: number, c: number, fade: number): void {
  const x0 = Math.round(x) - 1;
  const y0 = Math.round(y) - 1;
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) if (g[j][i] === 'x') dset(p, x0 + i, y0 + j, c, fade);
}

/** Translucent iso floor tint (clean light pooling — no dither noise). */
function isoTint(p: PixelCanvas, cx: number, cy: number, r: number, c: number, alpha: number): void {
  if (r < 1 || alpha <= 0) return;
  const a = Math.round(Math.min(1, alpha) * 255);
  const ry = r * ISO;
  for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - r) - 1; x <= Math.ceil(cx + r); x++) {
      const dx = (x + 0.5 - cx) / r;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) p.set(x, y, c, a);
    }
  }
}

function polyLines(p: PixelCanvas, pts: [number, number][], order: number[], c: number, fade: number, upto: number): void {
  const n = order.length;
  for (let k = 0; k < n; k++) {
    const a = pts[order[k]];
    const b = pts[order[(k + 1) % n]];
    const local = Math.max(0, Math.min(1, upto * n - k));
    if (local <= 0) break;
    dline(p, a[0], a[1], b[0], b[1], c, fade, local);
  }
}

/** Attribute motif inside the circle (floor radius rm, rotation a0). */
function drawMotif(p: PixelCanvas, attr: Attribute, cx: number, cy: number, rm: number, a0: number, ramp: Ramp, hi: number, fade: number, upto: number): void {
  const P = (r: number, a: number): [number, number] => [projX(cx, r, a), projY(cy, r, a)];
  const lineC = rc(ramp, 2 + hi);
  const nodeC = rc(ramp, 4 + hi);
  const verts = (n: number, r: number, off: number) => Array.from({ length: n }, (_, k) => P(r, a0 + off + (k * TAU) / n));
  switch (attr) {
    case 'LIGHT': {
      // 8-point star: two interlocked squares + sun rays
      const s1 = verts(4, rm, 0);
      const s2 = verts(4, rm, Math.PI / 4);
      polyLines(p, s1, [0, 1, 2, 3], lineC, fade, upto);
      polyLines(p, s2, [0, 1, 2, 3], lineC, fade, upto);
      for (let k = 0; k < 8; k++) {
        const a = a0 + (k * TAU) / 8 + Math.PI / 8;
        const q0 = P(rm * 0.45, a);
        const q1 = P(rm * 0.7, a);
        dline(p, q0[0], q0[1], q1[0], q1[1], rc(ramp, 2 + hi), fade, upto);
      }
      [...s1, ...s2].forEach(([x, y]) => upto > 0.9 && dset(p, x, y, nodeC, fade));
      break;
    }
    case 'DARK': {
      // pentagram + crescent eye in the middle
      const v = verts(5, rm, -Math.PI / 2);
      polyLines(p, v, [0, 2, 4, 1, 3], lineC, fade, upto);
      v.forEach(([x, y]) => upto > 0.9 && dset(p, x, y, nodeC, fade));
      isoRing(p, cx, cy, Math.max(2, rm * 0.32), rc(ramp, 2 + hi), { fade, from: a0, sweep: 0.62 * upto });
      break;
    }
    case 'FIRE': {
      // hexagram with flame flicks on each vertex
      const t1 = verts(3, rm, -Math.PI / 2);
      const t2 = verts(3, rm, Math.PI / 2);
      polyLines(p, t1, [0, 1, 2], lineC, fade, upto);
      polyLines(p, t2, [0, 1, 2], lineC, fade, upto);
      if (upto > 0.9)
        [...t1, ...t2].forEach(([x, y]) => {
          dset(p, x, y, nodeC, fade);
          dset(p, x, y - 1, rc(ramp, 3 + hi), fade);
          dset(p, x, y - 2, rc(ramp, 2 + hi), fade * 0.6);
        });
      break;
    }
    case 'WATER': {
      // trefoil of three circles around a center drop
      for (let k = 0; k < 3; k++) {
        const a = a0 + (k * TAU) / 3;
        const c = P(rm * 0.48, a);
        isoRing(p, Math.round(c[0]), Math.round(c[1]), rm * 0.5, lineC, { fade, from: a + Math.PI, sweep: upto });
      }
      dset(p, cx, cy - 1, nodeC, fade);
      break;
    }
    case 'EARTH': {
      // square + inner diamond + cross braces (a sturdy seal)
      const sq = verts(4, rm, Math.PI / 4);
      const dm = verts(4, rm * 0.68, 0);
      polyLines(p, sq, [0, 1, 2, 3], lineC, fade, upto);
      polyLines(p, dm, [0, 1, 2, 3], rc(ramp, 2 + hi), fade, upto);
      if (upto > 0.5) {
        dline(p, dm[0][0], dm[0][1], dm[2][0], dm[2][1], rc(ramp, 2 + hi), fade, (upto - 0.5) * 2);
        dline(p, dm[1][0], dm[1][1], dm[3][0], dm[3][1], rc(ramp, 2 + hi), fade, (upto - 0.5) * 2);
      }
      sq.forEach(([x, y]) => upto > 0.9 && dset(p, x, y, nodeC, fade));
      break;
    }
    case 'WIND': {
      // triskelion: three spiral arms
      for (let k = 0; k < 3; k++) {
        let prev: [number, number] | null = null;
        const steps = 18;
        for (let i = 0; i <= steps * upto; i++) {
          const s = i / steps;
          const q = P(rm * (0.15 + s * 0.85), a0 + (k * TAU) / 3 + s * 2.3);
          if (prev) dline(p, prev[0], prev[1], q[0], q[1], i > steps * 0.8 ? nodeC : lineC, fade);
          prev = q;
        }
      }
      break;
    }
  }
}

/**
 * Create a rotating iso rune circle at floor point (x, y). It draws itself on (outer ring sweeping
 * around with a bright spark head, runes lighting up), spins, and stays until dismiss().
 */
export function createMagicCircle(scene: Phaser.Scene, x: number, y: number, o: MagicCircleOpts): MagicCircleCtl {
  const ramp = o.ramp ?? ATTRIBUTE_RAMP[o.attribute];
  const pramp = o.player !== undefined ? PLAYER_RAMP[o.player] : null;
  const big = o.size === 'big';
  const R = big ? 46 : 34;
  const outer = big ? R + 16 : R + 6;
  const W = Math.ceil(outer * 1.2) * 2 + 4;
  const H = Math.ceil(outer * ISO * 1.2) * 2 + 6;
  const cx = W / 2;
  const cy = Math.floor(H / 2);
  const ras = new LiveRaster(scene, W, H, x, y, cx, cy, o.depth ?? DEPTH.TILE_FX);
  const appearMs = o.appearMs ?? 260;
  const st = { grow: 0, draw: 0, rot: rnd() * TAU, fade: 1, hi: 0, scale: 1, spin: 1, t: 0, hiT: 0 };
  const rgR = R - 6;
  // the floor pool under the circle: the ramp's darkest tone pushed toward night (LIGHT's gold1 alone reads mustard)
  const pool = mix(PAL.night0, ramp[0], 0.55);
  const nGlyph = Math.round((TAU * rgR) / 9);
  const glyphOf = Array.from({ length: nGlyph }, (_, i) => GLYPHS[(i * 7 + 3) % GLYPHS.length]);
  const rg2R = R + 7;
  const nGlyph2 = Math.round((TAU * rg2R) / 9);
  const glyphOf2 = Array.from({ length: nGlyph2 }, (_, i) => GLYPHS[(i * 3 + 1) % GLYPHS.length]);
  let dead = false;

  const render = () => {
    const fade = st.fade;
    const k = st.grow * st.scale;
    const r = (v: number) => Math.max(1, Math.round(v * k));
    const hi = st.hi;
    const rot = st.rot;
    const sweep = Math.min(1, st.draw);
    const from = rot * 0.35 - Math.PI / 2;
    const inSweep = (a: number) => sweep >= 1 || wrapAngle(a - from) <= sweep * TAU;
    ras.draw((p) => {
      // light pooling on the floor (translucent, grows with the draw-on)
      // a dark pool first (the circle "owns" the tile and its lines pop), then a warm light core
      isoTint(p, cx, cy, r(R + 2), pool, 0.6 * sweep * fade);
      isoTint(p, cx, cy, r(R - 11), ramp[1], (0.35 + hi * 0.2) * sweep * fade);
      // outer ring: bright line with a dark echo outside it
      isoRing(p, cx, cy, r(R), rc(ramp, 3 + hi), { fade, from, sweep });
      isoRing(p, cx, cy, r(R + 2), rc(ramp, 1 + hi), { fade, from, sweep });
      // rune band
      const rg = r(rgR);
      const chase = Math.floor(st.t / 60);
      for (let i = 0; i < nGlyph; i++) {
        const a = rot + (i * TAU) / nGlyph;
        if (!inSweep(a)) continue;
        const lit = (chase - i) % nGlyph === 0 || (chase + Math.floor(nGlyph / 2) - i) % nGlyph === 0;
        stampGlyph(p, glyphOf[i], projX(cx, rg, a), projY(cy, rg, a), lit ? PAL.white : rc(ramp, 3 + hi), fade);
      }
      // inner ring + inscribed motif (vertices touch the ring)
      const rIn = r(R - 11);
      isoRing(p, cx, cy, rIn, rc(ramp, 2 + hi), { fade, from: from + Math.PI, sweep });
      const motifUp = Math.max(0, Math.min(1, (st.draw - 0.3) / 0.7));
      drawMotif(p, o.attribute, cx, cy, rIn, -rot * 0.8, ramp, hi, fade, motifUp);
      if (motifUp > 0.6) {
        dset(p, cx - 1, cy - 1, rc(ramp, 4 + hi), fade);
        dset(p, cx, cy - 1, PAL.white, fade);
      }
      if (big) {
        // tick ring inside, second rune band outside (counter-rotating), orbs on the cardinals
        const nt = 24;
        for (let j = 0; j < nt; j++) {
          const a = -rot * 0.6 + (j * TAU) / nt;
          if (!inSweep(a)) continue;
          const r1 = r(R - 12);
          const r2 = r(R - (j % 3 === 0 ? 16 : 14));
          dline(p, projX(cx, r1, a), projY(cy, r1, a), projX(cx, r2, a), projY(cy, r2, a), rc(ramp, 2 + hi), fade);
        }
        const r2 = r(R + 12);
        isoRing(p, cx, cy, r2, rc(ramp, 3 + hi), { fade, from: from + Math.PI / 2, sweep });
        const rg2 = r(rg2R);
        for (let i = 0; i < nGlyph2; i++) {
          const a = -rot * 0.7 + (i * TAU) / nGlyph2;
          if (!inSweep(a)) continue;
          stampGlyph(p, glyphOf2[i], projX(cx, rg2, a), projY(cy, rg2, a), rc(ramp, 2 + hi), fade);
        }
        for (let q = 0; q < 4; q++) {
          const a = -rot * 0.7 + (q * TAU) / 4 + Math.PI / 4;
          if (!inSweep(a)) continue;
          const ox = projX(cx, r2, a);
          const oy = projY(cy, r2, a);
          dset(p, ox, oy - 1, PAL.white, fade);
          dset(p, ox - 1, oy, rc(ramp, 4 + hi), fade);
          dset(p, ox + 1, oy, rc(ramp, 4 + hi), fade);
          dset(p, ox, oy + 1, rc(ramp, 3 + hi), fade);
          dset(p, ox, oy, PAL.white, fade);
        }
      }
      // owner accent: short dashes in the player's color, counter-rotating outside everything
      if (pramp) {
        const rp = r(outer);
        isoRing(p, cx, cy, rp, pramp[2], { fade, dash: [12, 0.34, -rot * 0.5], from, sweep });
        isoRing(p, cx, cy, rp, pramp[4], { fade, dash: [12, 0.08, -rot * 0.5], from, sweep });
      }
      // draw-on spark head
      if (sweep > 0 && sweep < 1) {
        const a = from + sweep * TAU;
        const hx = projX(cx, r(R), a);
        const hy = projY(cy, r(R), a);
        dset(p, hx, hy, PAL.white);
        dset(p, hx - 1, hy, rc(ramp, 4));
        dset(p, hx + 1, hy, rc(ramp, 4));
        dset(p, hx, hy - 1, rc(ramp, 4));
        dset(p, hx, hy + 1, rc(ramp, 4));
      }
    });
  };

  const stopTick = onTick(scene, (dt) => {
    if (dead || !ras.alive) return true;
    st.t += dt;
    const spinBase = (big ? 0.0011 : 0.0014) * st.spin;
    st.rot += dt * spinBase * (1 + 3.5 * (1 - Math.min(1, st.draw)));
    if (st.hiT > 0) {
      st.hiT -= dt;
      st.hi = st.hiT > 0 ? 1 : 0;
    }
    render();
    return false;
  });

  const ready = animate(scene, appearMs, (t) => {
    st.draw = easeOut3(t);
    st.grow = 0.55 + 0.45 * easeOutBack(Math.min(1, t * 1.15));
  });

  return {
    ready,
    pulse(ms = 90) {
      st.hiT = ms;
      st.hi = 1;
    },
    spin(k: number) {
      st.spin = k;
    },
    async dismiss(ms = 320) {
      st.draw = Math.max(st.draw, 1);
      await animate(scene, ms, (t) => {
        st.fade = 1 - easeIn2(t);
        st.scale = 1 + 0.14 * easeOut3(t);
        st.spin = 1 + 2 * t;
      });
      dead = true;
      stopTick();
      ras.destroy();
    },
  };
}

/** Rotating iso rune circle that expands in, spins, and fades out within `ms`. */
export async function magicCircle(scene: Phaser.Scene, x: number, y: number, o: MagicCircleOpts): Promise<void> {
  const ms = o.ms ?? (o.size === 'big' ? 1500 : 1100);
  const c = createMagicCircle(scene, x, y, o);
  const out = Math.min(380, ms * 0.3);
  await wait(scene, ms - out);
  await c.dismiss(out);
}

// ================================================================ light pillar

export type PillarStyle = 'beam' | 'flame' | 'water' | 'shadow';

export interface PillarOpts {
  attribute: Attribute;
  ramp?: Ramp;
  height?: number;
  /** Beam width in px (core + body). Default 18. */
  width?: number;
  /** Total lifetime for lightPillar() (rise + hold + collapse). Default 900. */
  ms?: number;
  /** Rise time. Default 150. */
  riseMs?: number;
  style?: PillarStyle;
  depth?: number;
  /** Rising sparks inside the beam (default true). */
  sparks?: boolean;
}

export interface PillarCtl {
  ready: Promise<void>;
  /** Pinch to a white thread, then burst into sparkles. Resolves when gone. */
  collapse(ms?: number): Promise<void>;
  /** Momentary flare (wider + brighter). */
  pulse(ms?: number): void;
}

function defaultPillarStyle(attr: Attribute): PillarStyle {
  return attr === 'FIRE' ? 'flame' : attr === 'WATER' ? 'water' : attr === 'DARK' ? 'shadow' : 'beam';
}

/** Cheap 1D value noise. */
function noise1(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n: number) => {
    const s = Math.sin((n + seed * 57.13) * 127.1) * 43758.5453;
    return s - Math.floor(s);
  };
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

/** A vertical beam rising from floor point (x, y). Stays until collapse(). */
export function createPillar(scene: Phaser.Scene, x: number, y: number, o: PillarOpts): PillarCtl {
  const ramp = o.ramp ?? ATTRIBUTE_RAMP[o.attribute];
  const style = o.style ?? defaultPillarStyle(o.attribute);
  const height = Math.round(o.height ?? 140);
  const width = o.width ?? 18;
  const W = Math.ceil(width * 1.6) + 26;
  const H = height + 14;
  const ox = Math.floor(W / 2);
  const oy = height + 6;
  const ras = new LiveRaster(scene, W, H, x, y, ox, oy, o.depth ?? unitDepth(y) - 1);
  const st = { rise: 0, wk: 0, collapse: 0, t: 0, pulse: 0, jit: 0, alive: true, thread: 0 };
  const seed = rnd() * 100;

  // ramps whose top step is already white (LIGHT) shift down one so the body keeps some color
  const lift = ramp[4] === PAL.white ? -1 : 0;
  const colorsFor = (ax: number, hw: number, hrow: number, k: number): number | null => {
    // ax = |x offset|, hw = half width, k = height fraction
    const flare = st.pulse > 0 ? 1 : 0;
    if (style === 'shadow') {
      if (ax <= hw * 0.42) return rc(ramp, 0 + flare);
      if (ax <= hw * 0.72) return rc(ramp, 1 + flare);
      if (ax <= hw) return rc(ramp, 3 + flare);
      return rc(ramp, 2);
    }
    if (style === 'flame') {
      if (ax <= Math.max(0.6, hw * 0.28)) return rc(ramp, 4 + flare);
      if (ax <= hw * 0.65) return rc(ramp, 3 + flare);
      if (ax <= hw) return rc(ramp, 2 + flare);
      return rc(ramp, 1);
    }
    if (ax <= Math.max(0.6, hw * 0.3)) return rc(ramp, 5);
    if (ax <= hw * 0.62) return rc(ramp, 4 + lift + flare);
    if (ax <= hw) return rc(ramp, 3 + lift + flare);
    return rc(ramp, 2 + lift);
  };

  const render = () => {
    const top = Math.round(height * st.rise);
    const hw0 = (width / 2) * st.wk * (1 + (st.pulse > 0 ? 0.25 : 0));
    ras.draw((p) => {
      if (top <= 0) return;
      // floor base: light pool + rings
      const baseR = Math.max(3, hw0 * 1.4 + 5);
      isoTint(p, ox, oy, baseR + 2, ramp[1], 0.55 * st.wk);
      isoRing(p, ox, oy, baseR, ramp[3], { fade: st.wk > 0.3 ? 1 : 0 });
      isoRing(p, ox, oy, Math.max(2, baseR - 3), ramp[2], { fade: st.wk > 0.3 ? 1 : 0 });
      const taper = Math.max(14, top * 0.32);
      for (let h = 0; h <= top; h++) {
        const yy = oy - h;
        const k = h / Math.max(1, height);
        const tk = style === 'water' ? 1 : h > top - taper ? (top - h) / taper : 1; // 1 → 0 toward the tip
        let hw = hw0 * (1 - 0.15 * k) * Math.sqrt(Math.max(0, tk));
        if (h < 6) hw += ((6 - h) / 6) * 3 * st.wk; // flared foot
        let cxo = 0;
        let hot = 0; // +1 = one ramp step brighter for this row
        switch (style) {
          case 'beam':
            if (tk > 0.5) hw += st.jit;
            break;
          case 'flame': {
            const n = noise1(h * 0.16 - st.t * 0.014, seed);
            const n2 = noise1(h * 0.09 - st.t * 0.02, seed + 7);
            hw = hw * (0.8 + (n - 0.5) * 0.7);
            // tongues: the upper part breaks into licks that come and go
            if (k > 0.4) hw *= Math.max(0, Math.min(1, tk * 1.4 + (n2 - 0.55) * 1.6));
            cxo = (noise1(h * 0.05 - st.t * 0.006, seed + 3) - 0.5) * 7 * k * st.wk;
            hot = n2 > 0.6 ? 1 : 0;
            break;
          }
          case 'water':
            hw += (Math.sin(h * 0.33 - st.t * 0.025) * 1.3 + Math.sin(h * 0.11 + st.t * 0.011)) * st.wk * Math.min(1, tk * 2);
            cxo = Math.sin(h * 0.05 + st.t * 0.004) * 1.2 * k;
            break;
          case 'shadow':
            hw += (noise1(h * 0.3 - st.t * 0.02, seed) - 0.5) * 2.4 * st.wk * tk;
            break;
        }
        if (hw < 0.5 && st.thread <= 0) continue;
        // energy bands rising through the column
        const band = style === 'flame' ? false : style === 'water' ? (h + st.t * 0.16) % 9 < 1 : (h + st.t * 0.12) % 23 < 1.2;
        const halo = style === 'shadow' ? 1 : 2;
        const span = Math.ceil(hw + halo);
        for (let dx = -span; dx <= span; dx++) {
          const ax = Math.abs(dx + 0.5 - cxo);
          if (ax > hw + halo) continue;
          let c = colorsFor(ax, hw, h, k);
          if (c === null) continue;
          let fade = 1;
          if (ax > hw) fade = 0.5; // the halo is the only dithered part
          if (ax <= hw) {
            if (band) {
              if (style !== 'shadow') c = rc(ramp, 5);
              else if (ax > hw * 0.45) c = rc(ramp, 2);
            }
            else if (hot && ax > hw * 0.3 && noise1(h * 0.31 - st.t * 0.03 + dx * 0.53, seed + 11) > 0.62) c = rc(ramp, 4);
            else if (tk < 0.25 && style !== 'shadow') c = rc(ramp, 5);
            else if (style === 'beam' && hw > 5 && Math.abs(ax - hw * 0.62) < 0.5 && (h + Math.floor(st.t * 0.09)) % 6 < 4)
              c = rc(ramp, 2 + lift); // tube striations scrolling upward
          }
          dset(p, ox + dx, yy, c, fade);
        }
      }
      // water crown: a churning foam dome capping the geyser, spilling down its sides
      if (style === 'water' && st.wk > 0.2) {
        const fw0 = hw0 * 1.5 + 4;
        for (let r = -6; r <= 9; r++) {
          const yy = oy - top + r;
          const u = (r - 1) / 8; // dome profile
          const fw = fw0 * Math.max(0, 1 - u * u) + (r > 3 ? 2 : 0);
          for (let dx = -Math.ceil(fw); dx <= Math.ceil(fw); dx++) {
            const n = (noise1((dx + st.t * 0.03) * 0.5, seed + r * 1.7) + noise1(dx * 0.9 - st.t * 0.02, seed + r * 3.1)) / 2;
            const edge = Math.abs(dx) / Math.max(1, fw);
            if (n < 0.3 + edge * 0.35) continue;
            const c = r < -2 || n > 0.66 ? PAL.white : n > 0.5 ? ramp[4] : ramp[3];
            p.set(ox + dx, yy, c);
          }
        }
      }
      // collapse thread: a white filament that snaps down into the floor
      if (st.thread > 0) {
        const tt = Math.round(top * st.thread);
        for (let h = 0; h <= tt; h++) dset(p, ox, oy - h, h > tt - 3 ? rc(ramp, 4) : PAL.white);
      }
    });
  };

  const stopTick = onTick(scene, (dt) => {
    if (!st.alive) return true;
    st.t += dt;
    if (st.pulse > 0) st.pulse -= dt;
    if (Math.floor(st.t / 50) % 2 === 0) st.jit = 0;
    else st.jit = rnd() < 0.5 ? 1 : 0;
    render();
    return false;
  });

  // rising sparks inside the beam
  let sparkSw: Swarm | null = null;
  let stopSparks: (() => void) | null = null;
  if (o.sparks !== false) {
    sparkSw = new Swarm(scene, unitDepth(y) + 0.4, Phaser.BlendModes.ADD);
    sparkSw.hold = true;
    let acc = 0;
    stopSparks = onTick(scene, (dt) => {
      if (!st.alive || !sparkSw) return true;
      acc += dt * st.wk;
      while (acc > 22) {
        acc -= 22;
        const top = height * st.rise;
        const sx = x + rrange(-width * 0.55, width * 0.55);
        sparkSw.add({
          x: sx,
          y: y - rrange(0, top * 0.5),
          vy: -rrange(90, 200),
          life: rrange(250, 500),
          color: style === 'shadow' ? ramp[3] : rnd() < 0.4 ? PAL.white : ramp[4],
          size: rnd() < 0.2 ? 2 : 1,
          trail: 3,
          trailColor: ramp[2],
          paint: (pp, t) => {
            pp.alpha = t > 0.75 ? 0.5 : 1;
          },
        });
      }
      return false;
    });
  }

  const riseMs = o.riseMs ?? 150;
  const ready = animate(scene, riseMs, (t) => {
    st.rise = easeOut3(t);
    st.wk = Math.min(1, 0.35 + t * 0.9);
  });

  return {
    ready,
    pulse(ms = 90) {
      st.pulse = ms;
    },
    async collapse(ms = 170) {
      stopSparks?.();
      await animate(scene, ms, (t) => {
        st.wk = 1 - easeIn2(t);
        if (t > 0.6) st.thread = 1;
      });
      st.wk = 0;
      st.thread = 1;
      // the thread snaps into sparkles that drift up and out
      const top = height * st.rise;
      const sw = new Swarm(scene, DEPTH.FX, Phaser.BlendModes.ADD);
      const n = Math.round(top / 4);
      for (let i = 0; i < n; i++) {
        const hy = y - rrange(0, top);
        sw.add({
          x: x + rrange(-1, 1),
          y: hy,
          vx: rrange(-70, 70),
          vy: rrange(-60, 10),
          drag: 3.2,
          life: rrange(260, 520),
          color: style === 'shadow' ? ramp[4] : rnd() < 0.4 ? PAL.white : ramp[4],
          size: rnd() < 0.15 ? 2 : 1,
          paint: (pp, t) => {
            pp.color = t > 0.6 ? ramp[3] : pp.color;
            pp.alpha = Math.floor(t * 12 + i) % 3 === 0 ? 0.4 : t > 0.8 ? 0.5 : 1;
          },
        });
      }
      await animate(scene, 70, (t) => (st.thread = 1 - easeIn2(t)));
      st.alive = false;
      stopTick();
      ras.destroy();
      if (sparkSw) {
        sparkSw.hold = false;
        void sparkSw.done();
      }
    },
  };
}

/** Light pillar: rises, flickers with rising sparks, collapses into sparkles, all within `ms`. */
export async function lightPillar(scene: Phaser.Scene, x: number, y: number, o: PillarOpts): Promise<void> {
  const ms = o.ms ?? 900;
  const pl = createPillar(scene, x, y, o);
  const col = Math.min(200, ms * 0.25);
  await wait(scene, ms - col);
  await pl.collapse(col);
}

// ================================================================ shockwave / pulses / bursts

export interface ShockwaveOpts {
  color?: number;
  ramp?: Ramp;
  /** Final floor radius (screen ellipse radius × radius/2). Default 48. */
  radius?: number;
  /** Start radius. Default 6. */
  from?: number;
  ms?: number;
  /** Band thickness in floor px at the start. Default 6. */
  thickness?: number;
  depth?: number;
}

/** Iso ellipse ring that races out along the floor with a white leading edge and dithered wake. */
export async function shockwave(scene: Phaser.Scene, x: number, y: number, o: ShockwaveOpts = {}): Promise<void> {
  const ramp = o.ramp ?? (o.color !== undefined ? rampFrom(o.color) : RAMPS.cyan);
  const R = o.radius ?? 48;
  const r0 = o.from ?? 6;
  const ms = o.ms ?? 420;
  const th = o.thickness ?? 6;
  const W = R * 2 + 8;
  const H = Math.ceil(R * ISO) * 2 + 8;
  const ras = new LiveRaster(scene, W, H, x, y, W / 2, Math.floor(H / 2), o.depth ?? DEPTH.TILE_FX + 2);
  const cx = W / 2;
  const cy = Math.floor(H / 2);
  await animate(scene, ms, (t) => {
    const r = r0 + (R - r0) * easeOut3(t);
    const fade = t < 0.45 ? 1 : 1 - (t - 0.45) / 0.55;
    const thick = Math.max(2, Math.round(th * (1 - t * 0.6)));
    ras.draw((p) => {
      for (let i = thick; i >= 0; i--) {
        const rr = r - i;
        if (rr < 1) continue;
        const c = i === 0 ? PAL.white : i === 1 ? ramp[4] : i <= 3 ? ramp[3] : ramp[2];
        const f = i <= 1 ? fade : fade * (1 - (i - 1) / (thick + 1));
        isoRing(p, cx, cy, rr, c, { fade: f });
      }
    });
  });
  ras.destroy();
}

/** Iso diamond outline pulses around a tile (set card / tile acknowledgement). Default 2 pulses, ≈0.55 s. */
export async function setPulse(scene: Phaser.Scene, x: number, y: number, color: number = PAL.cyan3, opts: { ms?: number; count?: number; grow?: number } = {}): Promise<void> {
  const ramp = rampFrom(color);
  const ms = opts.ms ?? 420;
  const count = opts.count ?? 2;
  const grow = opts.grow ?? 12;
  const W = TILE_W + grow * 2 + 8;
  const H = TILE_H + grow + 8;
  const cx = Math.floor(W / 2);
  const cy = Math.floor(H / 2);
  const ras = new LiveRaster(scene, W, H, x, y, cx, cy, DEPTH.TILE_FX + 1);
  const gap = 120;
  const total = ms + (count - 1) * gap;
  await animate(scene, total, (t) => {
    const now = t * total;
    ras.draw((p) => {
      for (let i = 0; i < count; i++) {
        const lt = (now - i * gap) / ms;
        if (lt < 0 || lt > 1) continue;
        const e = Math.round(grow * easeOut3(lt));
        const hw = TILE_W / 2 + e;
        const hh = TILE_H / 2 + e / 2;
        const c = lt < 0.2 ? PAL.white : lt < 0.45 ? ramp[4] : ramp[3];
        const f = 1 - easeIn2(lt);
        // 2:1 staircase edges, drawn from the vertices inward so the corners stay sharp
        dline(p, cx, cy - hh, cx + hw, cy, c, f);
        dline(p, cx + hw, cy, cx, cy + hh, c, f);
        dline(p, cx, cy + hh, cx - hw, cy, c, f);
        dline(p, cx - hw, cy, cx, cy - hh, c, f);
        if (lt < 0.5) {
          // inner echo one step darker
          dline(p, cx, cy - hh + 2, cx + hw - 4, cy, ramp[2], f * 0.6);
          dline(p, cx - hw + 4, cy, cx, cy - hh + 2, ramp[2], f * 0.6);
        }
      }
    });
  });
  ras.destroy();
}

/** Radial sparkle burst (four-point stars + glints) with a 2-frame center flash. */
export async function sparkleBurst(scene: Phaser.Scene, x: number, y: number, o: { ramp?: Ramp; count?: number; depth?: number; speed?: number } = {}): Promise<void> {
  const ramp = o.ramp ?? RAMPS.gold;
  const n = o.count ?? 14;
  sparkles(scene, x, y, { ramp, count: Math.ceil(n * 0.6), depth: o.depth, speed: o.speed });
  glints(scene, x, y, { ramp, count: n, depth: o.depth, speed: o.speed });
  const g = scene.add.graphics().setDepth((o.depth ?? DEPTH.FX) + 1).setBlendMode(Phaser.BlendModes.ADD);
  const X = Math.round(x);
  const Y = Math.round(y);
  g.fillStyle(PAL.white, 1).fillRect(X - 3, Y, 7, 1).fillRect(X, Y - 3, 1, 7).fillRect(X - 1, Y - 1, 3, 3);
  await wait(scene, 34);
  g.clear().fillStyle(ramp[4], 1).fillRect(X - 1, Y, 3, 1).fillRect(X, Y - 1, 1, 3);
  await wait(scene, 34);
  g.destroy();
  await wait(scene, 300);
}

/** Dust puffs rolling out along the floor from a landing point. */
export async function landingDust(scene: Phaser.Scene, x: number, y: number, color?: number, o: { count?: number; radius?: number; big?: boolean } = {}): Promise<void> {
  const ramp = color !== undefined ? rampFrom(color) : RAMPS.stone;
  dust(scene, x, y, { ramp, count: o.count ?? (o.big ? 16 : 10), radius: o.radius ?? 12, depth: unitDepth(y) + 0.5, speed: o.big ? 1.4 : 1, frames: o.big ? ['2', '3'] : ['1', '2'] });
  // pebbles hop out
  const sw = new Swarm(scene, unitDepth(y) + 0.6);
  for (let i = 0; i < (o.big ? 10 : 6); i++) {
    const a = rnd() * TAU;
    const gy = y + Math.sin(a) * 4;
    sw.add({
      x: x + Math.cos(a) * 6,
      y: gy,
      vx: Math.cos(a) * rrange(30, 70),
      vy: -rrange(40, 90),
      gy: 420,
      life: 420,
      color: rnd() < 0.5 ? ramp[2] : ramp[3],
      paint: (p) => {
        if (p.y > gy + 2) p.dead = true;
      },
    });
  }
  await wait(scene, 320);
}

/** The pillar's birth: a white star pop at the base, a fast floor ring and a radial spray. */
function eruptionPop(scene: Phaser.Scene, x: number, y: number, ramp: Ramp, big: boolean): void {
  void shockwave(scene, x, y, { ramp, radius: big ? 46 : 34, ms: 260, thickness: 3, from: 4 });
  const g = scene.add.graphics().setDepth(unitDepth(y) + 0.8);
  const X = Math.round(x);
  const Y = Math.round(y) - 2;
  const L = big ? 16 : 11;
  void animate(scene, 120, (t) => {
    const l = Math.round(L * (1 - t));
    g.clear();
    if (l <= 0) return;
    g.fillStyle(ramp[4], 1).fillRect(X - l, Y, l * 2 + 1, 1).fillRect(X, Y - Math.round(l * 0.6), 1, Math.round(l * 1.2) + 1);
    g.fillStyle(PAL.white, 1).fillRect(X - Math.round(l / 2), Y, l + 1, 1).fillRect(X - 1, Y - 1, 3, 3);
  }).then(() => g.destroy());
  const sw = new Swarm(scene, DEPTH.FX - 1);
  const n = big ? 26 : 16;
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1)) * Math.PI + rrange(-0.1, 0.1); // upper half fan
    const sp = rrange(90, 200) * (big ? 1.25 : 1);
    sw.add({
      x: X,
      y: Y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp * 0.75,
      gy: 260,
      drag: 1.6,
      life: rrange(280, 460),
      size: rnd() < 0.4 ? 2 : 1,
      color: ramp[4],
      trail: 3,
      trailColor: ramp[2],
      paint: (p, t) => {
        p.color = t < 0.3 ? PAL.white : t < 0.65 ? ramp[4] : ramp[3];
        if (t > 0.5) p.size = 1;
      },
    });
  }
}

// ================================================================ attribute floor & air pieces

interface Piece {
  /** Beat 2: the pillar moment (eruption / geyser / tornado / tendrils / rocks / feathers). */
  erupt(): void;
  /** Beat 4: the pillar collapses (release orbiting things, start cooling). */
  release(): void;
  /** Beat 5: impact — finish and fade out everything. */
  end(): void;
}

interface PieceCtx {
  scene: Phaser.Scene;
  x: number;
  y: number;
  ramp: Ramp;
  big: boolean;
  K: number;
  sprite: HoloTarget;
}

// ---------------------------------------------------------------- cracks (FIRE / EARTH)

interface CrackPx {
  x: number;
  y: number;
  s: number;
  main: boolean;
}

function buildCracks(radius: number, branches: number, seed: number): CrackPx[] {
  const R = mulberry32(seed);
  const out: CrackPx[] = [];
  const seen = new Set<string>();
  const plot = (x: number, y: number, s: number, main: boolean) => {
    const k = `${x},${y}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ x, y, s, main });
  };
  const walk = (r0: number, a: number, len: number, s0: number, main: boolean, depth: number) => {
    let r = r0;
    let px = Math.cos(a) * r;
    let py = Math.sin(a) * r;
    let dist = s0;
    const step = 2.2;
    while (r < r0 + len) {
      a += (R() - 0.5) * 0.7;
      const nx = px + Math.cos(a) * step;
      const ny = py + Math.sin(a) * step;
      // rasterize segment in screen space
      const x0 = Math.round(px);
      const y0 = Math.round(py * ISO);
      const x1 = Math.round(nx);
      const y1 = Math.round(ny * ISO);
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++) {
        const qx = Math.round(x0 + ((x1 - x0) * i) / n);
        const qy = Math.round(y0 + ((y1 - y0) * i) / n);
        const sv = (dist + (step * i) / n) / radius;
        plot(qx, qy, sv, main);
        // main fissures are 2px wide near the center, thinning outward
        if (main && sv < 0.6) plot(qx + (Math.abs(x1 - x0) >= Math.abs(y1 - y0) ? 0 : 1), qy + (Math.abs(x1 - x0) >= Math.abs(y1 - y0) ? 1 : 0), sv, main);
      }
      px = nx;
      py = ny;
      dist += step;
      r = Math.hypot(px, py);
      if (depth < 2 && R() < 0.16) walk(r, a + (R() < 0.5 ? -1 : 1) * rrangeR(R, 0.6, 1.1), (r0 + len - r) * rrangeR(R, 0.35, 0.6), dist, false, depth + 1);
    }
  };
  for (let b = 0; b < branches; b++) {
    const a = (b / branches) * TAU + (R() - 0.5) * 0.6;
    walk(3, a, radius * rrangeR(R, 0.8, 1), 3, true, 0);
  }
  return out;
}

function rrangeR(R: () => number, a: number, b: number): number {
  return a + (b - a) * R();
}

interface CrackCtl {
  grow(ms: number): Promise<void>;
  /** Heat 1 → 0 (colors step down the ramp and dissolve). */
  cool(ms: number): Promise<void>;
  destroy(): void;
}

function floorCracks(scene: Phaser.Scene, x: number, y: number, ramp: Ramp, style: 'fire' | 'earth', radius: number, big: boolean): CrackCtl {
  const cr = buildCracks(radius, big ? 9 : 7, Math.floor(rnd() * 1e6));
  const W = radius * 2 + 12;
  const H = Math.ceil(radius * ISO) * 2 + 12;
  const cx = Math.floor(W / 2);
  const cy = Math.floor(H / 2);
  // under the magic circle: the floor itself breaks, the circle's light sits on top
  // emissive fissures glow through the magic circle (drawn above its dark pool)
  const ras = new LiveRaster(scene, W, H, x, y, cx, cy, DEPTH.TILE_FX + 1);
  const st = { g: 0, heat: 1, t: 0 };
  const render = () => {
    ras.draw((p) => {
      const heat = st.heat;
      if (heat <= 0) return;
      // under-glow (fire: molten light seeping up; earth: faint warm dust)
      if (style === 'fire') {
        isoDisc(p, cx, cy, radius * 0.5 * Math.min(1, st.g * 1.5), ramp[1], 0.35 * heat);
        isoDisc(p, cx, cy, radius * 0.25 * Math.min(1, st.g * 1.5), ramp[2], 0.3 * heat);
      }
      for (const c of cr) {
        if (c.s > st.g) continue;
        const fresh = st.g - c.s < 0.12;
        const X = cx + c.x;
        const Y = cy + c.y;
        if (style === 'fire') {
          const lvl = heat > 0.66 ? 0 : heat > 0.33 ? 1 : 2;
          const f = heat > 0.15 ? 1 : heat / 0.15;
          const flick = (Math.floor(st.t / 60) + c.x * 3 + c.y) % 7 === 0 ? 1 : 0;
          const core = fresh ? PAL.white : rc(ramp, (c.main ? 4 : 3) - lvl + flick);
          dset(p, X, Y, core, f);
          // glow halo around the line
          if (lvl < 2) {
            dset(p, X, Y - 1, rc(ramp, 2 - lvl), 0.5 * f);
            dset(p, X, Y + 1, rc(ramp, 1 - lvl), 0.5 * f);
          }
        } else {
          const f = heat > 0.2 ? 1 : heat / 0.2;
          // dark fissure with a lit upper lip; fresh tips glow
          dset(p, X, Y, fresh ? ramp[4] : c.main ? PAL.ink : ramp[0], f);
          dset(p, X, Y - 1, fresh ? ramp[4] : ramp[3], 0.75 * f);
          if (c.main) dset(p, X, Y + 1, ramp[1], 0.6 * f);
        }
      }
    });
  };
  const stop = onTick(scene, (dt) => {
    if (!ras.alive) return true;
    st.t += dt;
    render();
    return false;
  });
  return {
    grow: (ms) => animate(scene, ms, (t) => (st.g = 1.05 * t), easeOut3),
    cool: (ms) => animate(scene, ms, (t) => (st.heat = 1 - t)),
    destroy: () => {
      stop();
      ras.destroy();
    },
  };
}

// ---------------------------------------------------------------- charge-in motes (anticipation)

function chargeIn(scene: Phaser.Scene, x: number, y: number, ramp: Ramp, ms: number, count: number, radius: number, fall = false): Swarm {
  const sw = new Swarm(scene, DEPTH.FX - 1, Phaser.BlendModes.ADD);
  const dir = rnd() < 0.5 ? 1 : -1;
  for (let i = 0; i < count; i++) {
    const a0 = rnd() * TAU;
    const r0 = radius * rrange(0.75, 1.25);
    const h0 = fall ? rrange(50, 110) : rrange(0, 30);
    const delay = rrange(0, ms * 0.45);
    const life = ms - delay;
    const spin = dir * rrange(1.4, 2.4);
    sw.add({
      x: x + Math.cos(a0) * r0,
      y: y + Math.sin(a0) * r0 * ISO - h0,
      age: -delay,
      life,
      size: rnd() < 0.25 ? 2 : 1,
      color: ramp[3],
      trail: 3,
      trailColor: ramp[2],
      path: (p, t) => {
        const e = easeIn2(t);
        const r = r0 * (1 - e);
        const a = a0 + spin * e;
        p.x = x + Math.cos(a) * r;
        p.y = y + Math.sin(a) * r * ISO - h0 * (1 - e);
      },
      paint: (p, t) => {
        p.color = t > 0.8 ? PAL.white : t > 0.4 ? ramp[4] : ramp[3];
        if (t > 0.9) p.size = 1;
      },
    });
  }
  return sw;
}

// ---------------------------------------------------------------- LIGHT

function lensFlare(scene: Phaser.Scene, x: number, y: number, ramp: Ramp, ms: number, size: number): Promise<void> {
  const g = scene.add.graphics().setDepth(DEPTH.FX + 5);
  const ghosts = [
    { k: 0.55, tex: STEX.hex11, c: ramp[3] },
    { k: 0.95, tex: STEX.hex7, c: ramp[4] },
    { k: 1.35, tex: STEX.hex11, c: ramp[2] },
    { k: 1.6, tex: STEX.hex7, c: ramp[3] },
  ].map((gh) => ({ ...gh, img: scene.add.image(0, 0, gh.tex).setDepth(DEPTH.FX + 4).setBlendMode(Phaser.BlendModes.ADD).setTint(gh.c).setVisible(false) }));
  const X = Math.round(x);
  const Y = Math.round(y);
  const vx = GAME_W / 2 - X;
  const vy = GAME_H / 2 - Y;
  // horizontal streak tapers: white core → light → mid → dashed tips
  const seg = (L: number, f: number, c: number, row: number) => {
    const l = Math.round(L * f);
    if (l > 0) g.fillStyle(c, 1).fillRect(X - l, Y + row, l * 2 + 1, 1);
  };
  return animate(scene, ms, (t) => {
    const env = t < 0.12 ? easeOut3(t / 0.12) : t < 0.35 ? 1 : 1 - easeIn2((t - 0.35) / 0.65);
    const L = Math.round(size * env * (Math.floor(t * 30) % 3 === 0 ? 0.92 : 1));
    const thick = env > 0.45;
    g.clear();
    if (env > 0.02 && L > 0) {
      seg(L, 1, ramp[2], 0);
      seg(L, 0.72 * env, ramp[3], 0);
      seg(L, 0.45 * env, PAL.white, 0);
      if (thick) {
        seg(L, 0.32, ramp[4], -1);
        seg(L, 0.32, ramp[4], 1);
        seg(L, 0.12, ramp[3], -2);
        seg(L, 0.12, ramp[3], 2);
      }
      // dashed tips
      for (let i = 0; i < 3; i++) {
        const d = Math.round(L * (1.06 + i * 0.07));
        g.fillStyle(ramp[2], 1).fillRect(X + d, Y, 2, 1).fillRect(X - d - 1, Y, 2, 1);
      }
      const V = Math.round(L * 0.28 * env);
      g.fillStyle(PAL.white, 1).fillRect(X, Y - V, 1, V * 2 + 1);
      if (thick) g.fillStyle(PAL.white, 1).fillRect(X - 1, Y - 1, 3, 3);
      const D = Math.round(L * 0.1 * env);
      for (let i = 1; i <= D; i++) g.fillStyle(ramp[4], 1).fillRect(X + i, Y - i, 1, 1).fillRect(X - i, Y + i, 1, 1).fillRect(X + i, Y + i, 1, 1).fillRect(X - i, Y - i, 1, 1);
    }
    for (const gh of ghosts) {
      gh.img.setVisible(env > 0.25 && Math.floor(t * 24 + gh.k * 10) % 5 !== 0);
      gh.img.setPosition(Math.round(X + vx * gh.k), Math.round(Y + vy * gh.k));
    }
  }).then(() => {
    g.destroy();
    ghosts.forEach((gh) => gh.img.destroy());
  });
}

function fallingFeathers(scene: Phaser.Scene, x: number, y: number, count: number, spread: number): void {
  for (let i = 0; i < count; i++) {
    const front = rnd() < 0.55;
    const img = scene.add.sprite(0, 0, PTEX.feather, String(i % 4)).setDepth(front ? DEPTH.FX - 2 : unitDepth(y) - 2);
    img.play({ key: PANIM.feather, startFrame: i % 4 });
    const x0 = x + rrange(-spread, spread);
    const y0 = y - rrange(70, 150);
    const floorY = y + rrange(-8, 10);
    const vy = rrange(26, 44);
    const amp = rrange(5, 11);
    const w = rrange(4, 6.5);
    const ph = rnd() * TAU;
    const delay = rrange(0, 380);
    let age = -delay;
    img.setVisible(false);
    onTick(scene, (dt) => {
      if (!img.scene) return true;
      age += dt;
      if (age < 0) return false;
      const s = age / 1000;
      const yy = y0 + vy * s + Math.sin(s * 2 + ph) * 2;
      img.setVisible(true);
      img.setPosition(Math.round(x0 + Math.sin(s * w + ph) * amp), Math.round(yy));
      if (yy >= floorY) {
        glints(scene, img.x, img.y, { ramp: ATTRIBUTE_RAMP.LIGHT, count: 3, speed: 0.4, depth: img.depth });
        img.destroy();
        return true;
      }
      if (age > 4000) {
        img.destroy();
        return true;
      }
      return false;
    });
  }
}

function lightPiece(c: PieceCtx): Piece {
  const { scene, x, y, ramp, big } = c;
  chargeIn(scene, x, y, ramp, 300 * c.K, big ? 36 : 22, big ? 70 : 52, true);
  return {
    erupt() {
      fallingFeathers(scene, x, y, big ? 18 : 11, big ? 46 : 32);
      motes(scene, x, y, { ramp, duration: 600 * c.K, frequency: 50, count: 1, w: 30, h: 4, depth: DEPTH.FX - 1 });
    },
    release() {
      const core = c.sprite.visible ? opaqueBox(c.sprite) : null;
      const fy = core ? Math.round(core.top + (core.bottom - core.top) * 0.35) : y - 40;
      void lensFlare(scene, x, fy, ramp, big ? 280 : 220, big ? 62 : 44);
    },
    end() {
      sparkleBurst(scene, x, y - 8, { ramp, count: big ? 22 : 14 });
    },
  };
}

// ---------------------------------------------------------------- DARK

interface VortexCtl {
  puddle(target: number, ms: number): Promise<void>;
  end(ms: number): Promise<void>;
}

function shadowVortex(scene: Phaser.Scene, x: number, y: number, ramp: Ramp, R: number, maxPuddle: number): VortexCtl {
  const W = R * 2 + 6;
  const H = Math.ceil(R * ISO) * 2 + 6;
  const cx = W / 2;
  const cy = Math.floor(H / 2);
  const ras = new LiveRaster(scene, W, H, x, y, cx, cy, DEPTH.TILE_FX + 1);
  // per-pixel floor polar coords
  const N = W * H;
  const D = new Float32Array(N);
  const A = new Float32Array(N);
  for (let yy = 0; yy < H; yy++)
    for (let xx = 0; xx < W; xx++) {
      const u = xx + 0.5 - cx;
      const v = (yy + 0.5 - cy) / ISO;
      D[yy * W + xx] = Math.hypot(u, v);
      A[yy * W + xx] = Math.atan2(v, u);
    }
  const st = { t: 0, grow: 0, puddle: 0, fade: 1, speed: 1 };
  const stop = onTick(scene, (dt) => {
    if (!ras.alive) return true;
    st.t += dt * st.speed;
    const rot = st.t * 0.006;
    const Rv = R * st.grow;
    ras.draw((p) => {
      for (let yy = 0; yy < H; yy++)
        for (let xx = 0; xx < W; xx++) {
          const i = yy * W + xx;
          const d = D[i];
          if (d > Rv) continue;
          const a = A[i];
          const pr = st.puddle * (1 + Math.sin(a * 5 + st.t * 0.01) * 0.08);
          if (d < pr) {
            // the shadow puddle: ink core, void rim, a few swirling specks
            if (d > pr - 1.6) dset(p, xx, yy, ramp[2], st.fade);
            else if (d > pr - 3.5) dset(p, xx, yy, ramp[0], st.fade);
            else {
              const sp = (a * 3 + d * 0.3 - rot * 2.4) / TAU;
              const speck = sp - Math.floor(sp) < 0.05 && bayer(xx, yy) < 0.5;
              dset(p, xx, yy, speck ? ramp[2] : PAL.ink, st.fade);
            }
            continue;
          }
          // spiral arms (log spiral sweeping inward)
          const arms = 4;
          const v = (a * arms) / TAU + Math.log(d + 1) * 1.9 + rot;
          const fr = v - Math.floor(v);
          const k = d / Math.max(1, Rv);
          if (fr < 0.22) {
            const col = k > 0.75 ? ramp[2] : k > 0.45 ? ramp[3] : ramp[3];
            dset(p, xx, yy, fr < 0.08 && k < 0.7 ? ramp[4] : col, st.fade * (1 - k * 0.4));
          } else if (fr < 0.32) {
            dset(p, xx, yy, ramp[1], st.fade * 0.45 * (1 - k));
          }
        }
    });
    return false;
  });
  void animate(scene, 260, (t) => (st.grow = easeOut3(t)));
  return {
    puddle: (target, ms) => {
      const from = st.puddle;
      return animate(scene, ms, (t) => (st.puddle = from + (target * maxPuddle - from) * t), easeOut3);
    },
    end: async (ms) => {
      st.speed = 2.2;
      await animate(scene, ms, (t) => {
        st.fade = 1 - t;
        st.puddle = maxPuddle * (1 - easeIn2(t)) * 0.6;
      });
      stop();
      ras.destroy();
    },
  };
}

interface Tendril {
  phi: number;
  len: number;
  ph: number;
  amp: number;
  delay: number;
}

function shadowTendrils(scene: Phaser.Scene, x: number, y: number, ramp: Ramp, count: number, height: number, baseR: number): { retract(ms: number): Promise<void> } {
  const W = baseR * 2 + 40;
  const H = height + 16;
  const ox = Math.floor(W / 2);
  const oy = height + 8;
  const back = new LiveRaster(scene, W, H, x, y, ox, oy, unitDepth(y) - 0.5);
  const front = new LiveRaster(scene, W, H, x, y, ox, oy, unitDepth(y) + 0.5);
  // back tendrils anywhere behind; front ones flank the monster (never straight in front of it)
  const flank = [0.2, 0.8, 0.3, 0.7].map((f) => f * Math.PI);
  let fi = 0;
  const ts: Tendril[] = Array.from({ length: count }, (_, i) => ({
    phi: i % 2 === 0 ? flank[fi++ % flank.length] + rrange(-0.12, 0.12) : Math.PI + (((i - 1) / 2 + 0.5) / Math.ceil(count / 2)) * Math.PI + rrange(-0.2, 0.2),
    len: height * rrange(0.6, 1),
    ph: rnd() * TAU,
    amp: rrange(3, 7),
    delay: rrange(0, 120),
  }));
  const st = { t: 0, ext: 0, alive: true };
  const draw = (p: PixelCanvas, which: 'front' | 'back') => {
    for (const td of ts) {
      const isFront = Math.sin(td.phi) >= 0;
      if ((which === 'front') !== isFront) continue;
      const e = Math.max(0, Math.min(1, st.ext - td.delay / 400));
      if (e <= 0) continue;
      const bx = ox + Math.cos(td.phi) * baseR;
      const by = oy + Math.sin(td.phi) * baseR * ISO;
      const L = td.len * e;
      const steps = Math.ceil(L);
      for (let s = 0; s <= steps; s++) {
        const k = s / Math.max(1, td.len);
        const sway = Math.sin(k * 4 + st.t * 0.008 + td.ph) * td.amp * k;
        const lean = Math.cos(td.phi) * k * 8;
        const curl = s > steps - 6 ? Math.sin((s - steps) * 0.5 + td.ph) * 2 : 0;
        const X = bx + sway + lean + curl;
        const Y = by - s;
        const th = Math.max(1, (1 - k) * 6.5);
        const x0 = Math.round(X - th / 2);
        const x1 = Math.round(X + th / 2);
        for (let xx = x0; xx <= x1; xx++) {
          // lit left rim, dark right edge, a brighter vein down the middle
          const col = xx === x0 ? ramp[3] : xx === x1 && x1 > x0 + 1 ? PAL.ink : xx === Math.round(X) && th > 3 ? ramp[1] : ramp[0];
          p.set(xx, Y, col);
        }
        if (s === steps) {
          p.set(Math.round(X), Y - 1, ramp[4]);
          p.set(Math.round(X), Y - 2, ramp[3]);
        }
      }
    }
  };
  const stop = onTick(scene, (dt) => {
    if (!st.alive) return true;
    st.t += dt;
    back.draw((p) => draw(p, 'back'));
    front.draw((p) => draw(p, 'front'));
    return false;
  });
  void animate(scene, 360, (t) => (st.ext = easeOut3(t) * 1.4));
  return {
    retract: async (ms) => {
      const from = st.ext;
      await animate(scene, ms, (t) => (st.ext = from * (1 - easeIn2(t))));
      st.alive = false;
      stop();
      back.destroy();
      front.destroy();
    },
  };
}

function darkPiece(c: PieceCtx): Piece {
  const { scene, x, y, ramp, big } = c;
  const vortex = shadowVortex(scene, x, y, ramp, big ? 52 : 38, big ? 26 : 19);
  void vortex.puddle(0.55, 300 * c.K);
  chargeIn(scene, x, y, ramp, 300 * c.K, big ? 30 : 18, big ? 64 : 48);
  let tendrils: { retract(ms: number): Promise<void> } | null = null;
  return {
    erupt() {
      void vortex.puddle(1, 200 * c.K);
      tendrils = shadowTendrils(scene, x, y, ramp, big ? 8 : 6, big ? 60 : 40, big ? 22 : 16);
      shadowWisps(scene, x, y, { radius: big ? 24 : 16, duration: 600 * c.K, frequency: 60, count: 1, depth: unitDepth(y) + 0.5 });
    },
    release() {
      void tendrils?.retract(220 * c.K);
    },
    end() {
      void vortex.end(380 * c.K);
      shadowWisps(scene, x, y, { radius: big ? 26 : 18, count: big ? 14 : 8, depth: DEPTH.FX - 1 });
    },
  };
}

// ---------------------------------------------------------------- FIRE

function firePiece(c: PieceCtx): Piece {
  const { scene, x, y, ramp, big } = c;
  const cracks = floorCracks(scene, x, y, ramp, 'fire', big ? 80 : 58, big);
  void cracks.grow(300 * c.K);
  chargeIn(scene, x, y, ramp, 300 * c.K, big ? 26 : 16, big ? 60 : 46);
  embers(scene, x, y, { radius: 22, duration: 300 * c.K, frequency: 45, count: 1, speed: 0.5, depth: DEPTH.FX - 1 });
  return {
    erupt() {
      embers(scene, x, y - 4, { count: big ? 50 : 30, speed: big ? 2.2 : 1.7, depth: DEPTH.FX - 1, life: 1.1 });
      embers(scene, x, y, { radius: 18, duration: 700 * c.K, frequency: 30, count: 1, depth: DEPTH.FX - 1 });
      smokePuffs(scene, x, y - 4, { radius: 30, duration: 600 * c.K, frequency: 70, count: 1, depth: unitDepth(y) + 0.5, ramp: RAMPS.stone });
    },
    release() {
      smokePuffs(scene, x, y - 6, { radius: 20, count: big ? 10 : 6, depth: unitDepth(y) + 0.5, ramp: RAMPS.stone });
    },
    end() {
      embers(scene, x, y, { radius: 26, count: big ? 26 : 16, speed: 1.2, depth: DEPTH.FX - 1 });
      void cracks.cool(700 * c.K).then(() => cracks.destroy());
    },
  };
}

// ---------------------------------------------------------------- WATER

function ripples(scene: Phaser.Scene, x: number, y: number, ramp: Ramp, R: number, interval: number): { stop(): void; done: Promise<void> } {
  const W = R * 2 + 8;
  const H = Math.ceil(R * ISO) * 2 + 8;
  const cx = W / 2;
  const cy = Math.floor(H / 2);
  const ras = new LiveRaster(scene, W, H, x, y, cx, cy, DEPTH.TILE_FX + 1);
  const rings: number[] = [];
  let since = interval;
  let spawning = true;
  let resolveDone: () => void = () => undefined;
  const done = new Promise<void>((r) => (resolveDone = r));
  const life = 700;
  onTick(scene, (dt) => {
    if (!ras.alive) return true;
    since += dt;
    if (spawning && since >= interval) {
      since = 0;
      rings.push(0);
    }
    for (let i = 0; i < rings.length; i++) rings[i] += dt;
    while (rings.length && rings[0] > life) rings.shift();
    ras.draw((p) => {
      if (spawning) isoDisc(p, cx, cy, R * 0.45, ramp[1], 0.3);
      for (const age of rings) {
        const t = age / life;
        const r = 4 + (R - 4) * easeOut3(t);
        const fade = 1 - t;
        isoRing(p, cx, cy, r, t < 0.2 ? PAL.white : t < 0.45 ? ramp[4] : ramp[3], { fade });
        if (r > 6) isoRing(p, cx, cy, r - 2, ramp[2], { fade: fade * 0.6 });
      }
    });
    if (!spawning && rings.length === 0) {
      ras.destroy();
      resolveDone();
      return true;
    }
    return false;
  });
  return {
    stop: () => {
      spawning = false;
    },
    done,
  };
}

function waterPiece(c: PieceCtx): Piece {
  const { scene, x, y, ramp, big } = c;
  const rip = ripples(scene, x, y, ramp, big ? 56 : 42, 140);
  chargeIn(scene, x, y, ramp, 300 * c.K, big ? 26 : 16, big ? 60 : 46);
  bubblesSmall(scene, x, y, { radius: 22, duration: 300 * c.K, frequency: 60, count: 1, depth: DEPTH.FX - 1 });
  return {
    erupt() {
      droplets(scene, x, y - 50, { count: big ? 40 : 24, speed: big ? 1.4 : 1.1, depth: DEPTH.FX - 1 });
      droplets(scene, x, y - (big ? 150 : 110), { count: big ? 20 : 12, speed: 0.8, depth: DEPTH.FX - 1 });
      droplets(scene, x, y - (big ? 200 : 140), { w: 16, h: 6, duration: 560 * c.K, frequency: 35, count: 1, speed: 0.6, depth: DEPTH.FX - 1 });
      bubbles(scene, x, y - 10, { w: 18, h: 20, duration: 650 * c.K, frequency: 70, count: 1, depth: unitDepth(y) + 0.5 });
      bubblesSmall(scene, x, y - 20, { w: 20, h: 40, duration: 650 * c.K, frequency: 45, count: 1, depth: unitDepth(y) + 0.5 });
    },
    release() {
      // the column falls: a rain of droplets around the tile
      droplets(scene, x, y - 60, { w: 40, h: 30, count: big ? 34 : 20, speed: 0.55, depth: DEPTH.FX - 1 });
    },
    end() {
      rip.stop();
      droplets(scene, x, y, { radius: 20, count: big ? 22 : 14, speed: 0.8, depth: DEPTH.FX - 1 });
      void shockwave(scene, x, y, { ramp, radius: big ? 40 : 30, ms: 360, thickness: 3 });
    },
  };
}

// ---------------------------------------------------------------- EARTH

interface OrbitRock {
  img: Phaser.GameObjects.Image;
  a: number;
  r: number;
  h: number;
  hT: number;
  w: number;
  bob: number;
  delay: number;
  age: number;
  free: boolean;
  vx: number;
  vy: number;
  gy: number;
  floorY: number;
}

function orbitingRocks(scene: Phaser.Scene, x: number, y: number, count: number, radius: number, big: boolean): { release(): void } {
  const rocksArr: OrbitRock[] = [];
  for (let i = 0; i < count; i++) {
    const big2 = i % 2 === 0;
    const img = scene.add
      .image(0, 0, big2 ? STEX.boulder : PTEX.rock, String(i % (big2 ? 3 : 4)))
      .setVisible(false)
      .setFlipX(rnd() < 0.5);
    const a = (i / count) * TAU + rrange(-0.2, 0.2);
    rocksArr.push({
      img,
      a,
      r: radius * rrange(0.8, 1.15),
      h: 0,
      hT: rrange(18, big ? 52 : 38),
      w: rrange(1.6, 2.4) * (big ? 0.8 : 1),
      bob: rnd() * TAU,
      delay: i * 30,
      age: 0,
      free: false,
      vx: 0,
      vy: 0,
      gy: 0,
      floorY: 0,
    });
  }
  let released = false;
  onTick(scene, (dt) => {
    let alive = 0;
    for (const rk of rocksArr) {
      if (!rk.img.scene) continue;
      alive++;
      rk.age += dt;
      if (rk.age < rk.delay) continue;
      const s = (rk.age - rk.delay) / 1000;
      if (!rk.free) {
        // pop out of the ground, then float in an iso orbit
        const up = Math.min(1, s / 0.28);
        rk.h = rk.hT * easeOutBack(up) + Math.sin(s * 5 + rk.bob) * 2;
        rk.a += rk.w * (dt / 1000) * (0.4 + up);
        const px = x + Math.cos(rk.a) * rk.r;
        const py = y + Math.sin(rk.a) * rk.r * ISO;
        rk.img.setVisible(true).setPosition(Math.round(px), Math.round(py - rk.h));
        rk.img.setDepth(Math.sin(rk.a) >= 0 ? unitDepth(y) + 0.7 : unitDepth(y) - 0.7);
        if (released) {
          rk.free = true;
          rk.vx = Math.cos(rk.a) * rrange(70, 120) - Math.sin(rk.a) * 40;
          rk.vy = -rrange(60, 120);
          rk.gy = 520;
          rk.floorY = py + Math.sin(rk.a) * 8 + 6;
          rk.img.setDepth(DEPTH.FX - 1);
        }
      } else {
        rk.vy += rk.gy * (dt / 1000);
        rk.img.x += rk.vx * (dt / 1000);
        rk.img.y += rk.vy * (dt / 1000);
        if (rk.img.y >= rk.floorY && rk.vy > 0) {
          rockPreset(scene, rk.img.x, rk.img.y, { count: 5, speed: 0.6, depth: DEPTH.FX - 1 });
          dust(scene, rk.img.x, rk.img.y, { ramp: RAMPS.earth, count: 3, speed: 0.5, depth: DEPTH.FX - 1 });
          rk.img.destroy();
        }
      }
    }
    return alive === 0;
  });
  return {
    release: () => {
      released = true;
    },
  };
}

function earthPiece(c: PieceCtx): Piece {
  const { scene, x, y, ramp, big } = c;
  const cracks = floorCracks(scene, x, y, ramp, 'earth', big ? 80 : 58, big);
  void cracks.grow(320 * c.K);
  chargeIn(scene, x, y, ramp, 300 * c.K, big ? 24 : 14, big ? 60 : 46);
  void shake(scene, 300 * c.K, 1);
  let orbit: { release(): void } | null = null;
  return {
    erupt() {
      orbit = orbitingRocks(scene, x, y, big ? 9 : 6, big ? 34 : 26, big);
      dust(scene, x, y, { ramp: RAMPS.earth, radius: 22, count: big ? 16 : 10, speed: 1.2, depth: unitDepth(y) + 0.5 });
    },
    release() {
      orbit?.release();
    },
    end() {
      dust(scene, x, y, { ramp: RAMPS.earth, radius: 26, count: big ? 18 : 12, speed: 1.6, depth: unitDepth(y) + 0.5 });
      void cracks.cool(600 * c.K).then(() => cracks.destroy());
    },
  };
}

// ---------------------------------------------------------------- WIND

interface TornadoCtl {
  burst(ms: number): Promise<void>;
}

function tornado(scene: Phaser.Scene, x: number, y: number, ramp: Ramp, height: number, rBase: number, rTop: number): TornadoCtl {
  const W = Math.ceil(rTop * 1.7) * 2 + 10;
  const H = height + Math.ceil(rTop) + 12;
  const ox = Math.floor(W / 2);
  const oy = H - Math.ceil(rTop * ISO * 1.7) - 4;
  const back = new LiveRaster(scene, W, H, x, y, ox, oy, unitDepth(y) - 0.6);
  const front = new LiveRaster(scene, W, H, x, y, ox, oy, unitDepth(y) + 0.6);
  front.img.setBlendMode(Phaser.BlendModes.ADD);
  const st = { t: 0, rise: 0, spread: 1, fade: 1, alive: true };
  const gap = 4;
  const levels = Math.floor(height / gap);
  const render = () => {
    const top = height * st.rise;
    const fb = (p: PixelCanvas, half: 'front' | 'back') => {
      for (let i = 0; i <= levels; i++) {
        const h = i * gap;
        if (h > top) break;
        const k = h / Math.max(1, height);
        // gusts: some levels blink out for a moment so the funnel never reads as a coil
        if (noise1(i * 0.7 + st.t * 0.006, 41) < 0.28) continue;
        const wob = 1 + 0.14 * Math.sin(i * 2.3 + st.t * 0.005) + 0.08 * (noise1(i * 1.3, 5) - 0.5);
        const r = (rBase + (rTop - rBase) * Math.pow(k, 1.25)) * st.spread * wob;
        const cy = oy - h - Math.sin(st.t * 0.004 + k * 3) * 1.5;
        const cx = ox + Math.sin(st.t * 0.003 + k * 2.4) * 3 * k;
        const ph = -st.t * 0.012 * (1 + 0.35 * Math.sin(i * 1.9)) + noise1(i * 3.7, 9) * TAU * 2;
        const segs = 2;
        const span = 0.22 + 0.22 * noise1(i * 0.9 + st.t * 0.002, 13);
        const fadeTop = h > top - 12 ? (top - h) / 12 : 1;
        const fade = st.fade * fadeTop;
        const colorAt = (a: number) => {
          for (let sgi = 0; sgi < segs; sgi++) {
            const rel = wrapAngle(a - ph - (sgi * TAU) / segs) / TAU;
            if (rel < span) {
              const head = rel / span; // streak head is bright, tail dark
              if (half === 'back') return head > 0.6 ? ramp[2] : ramp[1];
              return head > 0.88 ? PAL.white : head > 0.6 ? ramp[4] : head > 0.3 ? ramp[3] : ramp[2];
            }
          }
          return null;
        };
        // 2px streaks: the ring and its inner neighbour
        isoRing(p, Math.round(cx), Math.round(cy), r, 0, { fade, half, colorAt });
        if (r > 3) isoRing(p, Math.round(cx), Math.round(cy), r - 1, 0, { fade, half, colorAt });
      }
    };
    back.draw((p) => fb(p, 'back'));
    front.draw((p) => fb(p, 'front'));
  };
  onTick(scene, (dt) => {
    if (!st.alive) return true;
    st.t += dt;
    render();
    return false;
  });
  void animate(scene, 240, (t) => (st.rise = t), easeOut3);
  return {
    burst: async (ms) => {
      await animate(scene, ms, (t) => {
        st.spread = 1 + 0.9 * easeOut3(t);
        st.fade = 1 - t;
      });
      st.alive = false;
      back.destroy();
      front.destroy();
    },
  };
}

function swirlLeaves(scene: Phaser.Scene, x: number, y: number, count: number, height: number, radius: number): { scatter(): void } {
  const ls = Array.from({ length: count }, (_, i) => {
    const img = scene.add.sprite(0, 0, PTEX.leaf, String(i % 4)).setVisible(false);
    img.play({ key: PANIM.leaf, startFrame: i % 4 });
    return { img, a: rnd() * TAU, h: rrange(0, height * 0.3), vh: rrange(60, 120), w: rrange(5, 8), delay: i * 25, age: 0, free: false, vx: 0, vy: 0 };
  });
  let scatter = false;
  onTick(scene, (dt) => {
    let alive = 0;
    for (const l of ls) {
      if (!l.img.scene) continue;
      alive++;
      l.age += dt;
      if (l.age < l.delay) continue;
      const s = dt / 1000;
      if (!l.free) {
        l.a += l.w * s;
        l.h = Math.min(height, l.h + l.vh * s);
        if (l.h >= height) l.h = rrange(0, 10);
        const k = l.h / height;
        const r = radius * (0.5 + k * 0.9);
        const px = x + Math.cos(l.a) * r;
        const py = y + Math.sin(l.a) * r * ISO - l.h;
        l.img.setVisible(true).setPosition(Math.round(px), Math.round(py));
        l.img.setDepth(Math.sin(l.a) >= 0 ? unitDepth(y) + 0.7 : unitDepth(y) - 0.7);
        if (scatter) {
          l.free = true;
          l.vx = -Math.sin(l.a) * l.w * r * 1.2 + Math.cos(l.a) * 60;
          l.vy = -rrange(20, 70);
          l.img.setDepth(DEPTH.FX - 1);
        }
      } else {
        l.vy += 60 * s;
        l.vx *= 1 - 1.5 * s;
        l.img.x += l.vx * s;
        l.img.y += l.vy * s;
        if (l.age > 2600 || l.img.y > y + 30) l.img.destroy();
        else if (l.age > 2000) l.img.setVisible(Math.floor(l.age / 60) % 2 === 0);
      }
    }
    return alive === 0;
  });
  return {
    scatter: () => {
      scatter = true;
      for (const l of ls) l.age = Math.max(l.age, 1400);
    },
  };
}

function windPiece(c: PieceCtx): Piece {
  const { scene, x, y, ramp, big } = c;
  chargeIn(scene, x, y, ramp, 300 * c.K, big ? 26 : 16, big ? 64 : 48);
  let tor: TornadoCtl | null = null;
  let lv: { scatter(): void } | null = null;
  // floor wind: a fast ring of streaks hugging the circle
  const floorTor = tornado(scene, x, y, ramp, 4, big ? 40 : 30, big ? 40 : 30);
  return {
    erupt() {
      const H = big ? 150 : 110;
      tor = tornado(scene, x, y, ramp, H, big ? 14 : 10, big ? 48 : 36);
      lv = swirlLeaves(scene, x, y, big ? 22 : 14, H * 0.9, big ? 30 : 22);
    },
    release() {
      void tor?.burst(300 * c.K);
      void floorTor.burst(300 * c.K);
      lv?.scatter();
    },
    end() {
      leafPreset(scene, x, y - 10, { count: big ? 14 : 8, speed: 1.3, depth: DEPTH.FX - 1 });
    },
  };
}

// ================================================================ monster entrance helpers

function playRoar(sprite: HoloTarget, monsterId?: MonsterId): void {
  if (!monsterId || !(sprite instanceof Phaser.GameObjects.Sprite)) return;
  const rk = monsterAnimKey(monsterId, 'roar');
  const ik = monsterAnimKey(monsterId, 'idle');
  if (!sprite.scene.anims.exists(rk)) return;
  sprite.play(rk);
  if (sprite.scene.anims.exists(ik)) sprite.chain(ik);
}

/**
 * The floor surface the monster breaks through: an iso ring hugging the body at the ground line,
 * bright front arc in front of the sprite, dim back arc behind it, wobbling while active.
 */
function emergenceRing(scene: Phaser.Scene, sprite: HoloTarget, ramp: Ramp, halfW: number): { stop(ms: number): Promise<void> } {
  const R = Math.max(8, Math.round(halfW + 4));
  const W = R * 2 + 8;
  const H = R + 10;
  const x = sprite.x;
  const y = sprite.y;
  const cx = W / 2;
  const cy = Math.floor(H / 2);
  const back = new LiveRaster(scene, W, H, x, y, cx, cy, unitDepth(y) - 0.4);
  const front = new LiveRaster(scene, W, H, x, y, cx, cy, unitDepth(y) + 0.6);
  const st = { t: 0, fade: 1, alive: true };
  onTick(scene, (dt) => {
    if (!st.alive) return true;
    st.t += dt;
    const wob = (a: number) => Math.sin(a * 3 + st.t * 0.02) * 1.2;
    const draw = (p: PixelCanvas, half: 'front' | 'back') => {
      const r = R + Math.round(Math.sin(st.t * 0.03));
      isoRing(p, cx, cy, r, 0, {
        half,
        fade: st.fade,
        colorAt: (a) => {
          const k = (Math.sin(a * 5 - st.t * 0.015) + 1) / 2 + wob(a) * 0.1;
          if (half === 'back') return k > 0.5 ? ramp[2] : ramp[1];
          return k > 0.75 ? PAL.white : k > 0.35 ? ramp[4] : ramp[3];
        },
      });
      if (half === 'front') isoRing(p, cx, cy, r + 3, ramp[2], { half, fade: st.fade * 0.5 });
    };
    back.draw((p) => draw(p, 'back'));
    front.draw((p) => draw(p, 'front'));
    return false;
  });
  return {
    stop: async (ms) => {
      await animate(scene, ms, (t) => (st.fade = 1 - t));
      st.alive = false;
      back.destroy();
      front.destroy();
    },
  };
}

/** Rise out of the floor (clip at the ground line) in hologram palette, then settle to true colors. */
async function riseFromGround(scene: Phaser.Scene, sprite: HoloTarget, ramp: Ramp, ms: number, easeName: string, onUp: () => void): Promise<void> {
  const homeY = sprite.y;
  const box = opaqueBox(sprite);
  const ring = emergenceRing(scene, sprite, ramp, box ? (box.right - box.left) / 2 : 12);
  const span = box ? { top: box.top - homeY, bottom: box.bottom - homeY } : null;
  const dist = box ? Math.ceil(box.bottom - box.top) + 2 : sprite.displayHeight;
  const P = setHologram(sprite, { reveal: 1, scan: 1, glitch: 0.12, tint: ramp[4], ramp: holoRamp(ramp), tintMix: 1, gain: 0.55, flicker: 0.2, alpha: 1, white: 0, clipY: homeY, span });
  sprite.y = homeY + dist;
  sprite.setVisible(true);
  const ease = Phaser.Tweens.Builders.GetEaseFunction(easeName) as (t: number) => number;
  let fired = false;
  await animate(scene, ms, (t) => {
    sprite.y = Math.round(homeY + dist * (1 - ease(t)));
    if (!fired && t > 0.72) {
      fired = true;
      onUp();
    }
  });
  sprite.y = homeY;
  P.clipY = null;
  void ring.stop(160);
  P.white = 0.5;
  await wait(scene, 34);
  P.white = 0;
  await animate(scene, ms * 0.4, (t) => {
    P.tintMix = 1 - t;
    P.scan = 1 - t;
    P.glitch = 0.12 * (1 - t);
    P.flicker = 0.2 * (1 - t);
  });
  clearHologram(sprite);
}

/** Descend from above while the hologram builds, landing with dust. */
async function descendFromAbove(scene: Phaser.Scene, sprite: HoloTarget, ramp: Ramp, ms: number, drop: number, big: boolean, onLand: () => void): Promise<void> {
  const homeY = sprite.y;
  const box = opaqueBox(sprite);
  sprite.y = homeY - drop;
  sprite.setVisible(true);
  const mat = materialize(scene, sprite, { ramp, ms: ms * 1.05, converge: true });
  // the reveal span was measured at the start position — keep it relative to the sprite
  await animate(
    scene,
    ms,
    (t) => {
      sprite.y = Math.round(homeY - drop * (1 - t));
    },
    (t) => 1 - Math.pow(1 - t, 2.4),
  );
  sprite.y = homeY;
  onLand();
  // a landing on air: pale gust puffs, not attribute-colored dust
  void landingDust(scene, sprite.x, homeY, PAL.mist, { big, count: big ? 10 : 6 });
  void box;
  await mat;
}

// ================================================================ the set piece

export type SummonBeat = 'circle' | 'pillar' | 'reveal' | 'roar' | 'impact' | 'end';

export interface SummonOpts {
  /** Floor point (tile center) where the monster stands. */
  x: number;
  y: number;
  attribute: Attribute;
  player: PlayerId;
  /** The monster sprite, already placed at (x, y) with its origin on the art anchor. Hidden until its beat. */
  sprite: HoloTarget;
  monsterId?: MonsterId;
  /** Tribute / ace summon: bigger circle, taller pillar, heavier impact (≈1.8 s instead of ≈1.2 s). */
  big?: boolean;
  /** Beat callback (sound, ATK/DEF badge, camera). */
  onBeat?: (beat: SummonBeat) => void;
}

/**
 * The full per-attribute summon set piece (GAME_DESIGN §6 summon, after the card has landed):
 *   0 ms circle draws on + charge-in → ~260 pillar / eruption → ~380 monster appears (materialize,
 *   rise or descend per attribute) → roar → ~860 pillar collapses → ~980 impact shockwave + shake.
 * Resolves at ≈1.2 s (big ≈1.8 s); leftovers (embers, feathers, dust) fade on their own.
 */
export async function attributeSummon(scene: Phaser.Scene, o: SummonOpts): Promise<void> {
  const { x, y, attribute, player, sprite, monsterId } = o;
  const big = !!o.big;
  const ramp = ATTRIBUTE_RAMP[attribute];
  const K = big ? 1.45 : 1;
  const T = (ms: number) => Math.round(ms * K);
  const beat = (b: SummonBeat) => {
    try {
      o.onBeat?.(b);
    } catch (e) {
      console.error('[summon] onBeat', e);
    }
  };
  if (monsterId && sprite instanceof Phaser.GameObjects.Sprite && scene.anims.exists(monsterAnimKey(monsterId, 'idle'))) {
    sprite.play(monsterAnimKey(monsterId, 'idle'));
    sprite.anims.pause();
    sprite.setFrame(monsterFrameName('idle', 0));
  }
  sprite.setVisible(false);
  const homeY = sprite.y;

  // ---- beat 1: circle + anticipation
  beat('circle');
  const circle = createMagicCircle(scene, x, y, { attribute, player, size: big ? 'big' : 'normal', appearMs: T(260) });
  const ctx: PieceCtx = { scene, x, y, ramp, big, K, sprite };
  const piece =
    attribute === 'LIGHT'
      ? lightPiece(ctx)
      : attribute === 'DARK'
        ? darkPiece(ctx)
        : attribute === 'FIRE'
          ? firePiece(ctx)
          : attribute === 'WATER'
            ? waterPiece(ctx)
            : attribute === 'EARTH'
              ? earthPiece(ctx)
              : windPiece(ctx);
  if (big) void shake(scene, T(240), 1);
  await wait(scene, T(260));

  // ---- beat 2: pillar
  beat('pillar');
  circle.pulse(80);
  circle.spin(2.2);
  const pillarH = big ? 210 : 150;
  const pillar = createPillar(scene, x, y, {
    attribute,
    height: attribute === 'WIND' ? pillarH * 0.7 : pillarH,
    width: attribute === 'WIND' ? (big ? 8 : 6) : attribute === 'DARK' ? (big ? 20 : 15) : attribute === 'FIRE' || attribute === 'WATER' ? (big ? 30 : 22) : big ? 26 : 18,
    riseMs: T(140),
  });
  piece.erupt();
  eruptionPop(scene, x, y, ramp, big);
  void shake(scene, 120, big ? 2 : 1);
  await wait(scene, T(120));

  // ---- beat 3: the monster appears
  beat('reveal');
  let roared = false;
  const roar = () => {
    if (roared) return;
    roared = true;
    beat('roar');
    playRoar(sprite, monsterId);
  };
  let entrance: Promise<void>;
  if (attribute === 'DARK') entrance = riseFromGround(scene, sprite, ramp, T(470), 'Sine.Out', roar);
  else if (attribute === 'EARTH') {
    // heavy: a slow grind up through the floor with rumble and dust boiling at the ground line
    entrance = riseFromGround(scene, sprite, ramp, T(520), 'Sine.Out', roar);
    void shake(scene, T(420), 1);
    dust(scene, x, y, { ramp: RAMPS.earth, radius: 14, duration: T(420), frequency: 40, count: 1, speed: 0.9, depth: unitDepth(y) + 0.5 });
    rockPreset(scene, x, y - 2, { radius: 10, duration: T(380), frequency: 70, count: 1, speed: 0.6, depth: unitDepth(y) + 0.5 });
  }
  else if (attribute === 'WIND') entrance = descendFromAbove(scene, sprite, ramp, T(440), big ? 110 : 80, big, roar);
  else entrance = materialize(scene, sprite, { ramp, ms: T(560), onRevealed: roar });
  await wait(scene, T(480));
  roar();

  // ---- beat 4: pillar collapses
  circle.pulse(120);
  piece.release();
  void pillar.collapse(T(100));
  await wait(scene, T(120));

  // ---- beat 5: impact
  beat('impact');
  piece.end();
  void shockwave(scene, x, y, { ramp, radius: big ? 84 : 54, ms: T(440), thickness: big ? 8 : 6 });
  if (big) {
    void shockwave(scene, x, y, { ramp: PLAYER_RAMP[player], radius: big ? 64 : 40, ms: T(520), thickness: 3, from: 2 });
    void flash(scene, 120, ramp[4], 0.28);
    void safeHitStop(scene, 60);
  }
  void shake(scene, big ? 260 : 160, big ? 4 : 2);
  if (attribute !== 'WIND') void landingDust(scene, x, y, attribute === 'EARTH' ? PAL.earth3 : PAL.stone3, { big, count: big ? 12 : 7 });
  void circle.dismiss(T(340));
  await wait(scene, T(220));
  await entrance;
  sprite.y = homeY;
  beat('end');
}

// ================================================================ tribute stream

export interface TributeOpts {
  attribute: Attribute;
  /** ms for the stream once the sprite breaks apart. Default 650. */
  ms?: number;
}

/**
 * Tribute: the monster flashes white, glitches, then breaks into a stream of its own pixels that
 * arcs into the target tile (staggered top → bottom, cooling into the attribute ramp mid-flight).
 * Hides `fromSprite`. Resolves when the last pixel lands (≈1 s).
 */
export async function tributeStream(scene: Phaser.Scene, fromSprite: HoloTarget, toXY: { x: number; y: number }, o: TributeOpts): Promise<void> {
  const ramp = ATTRIBUTE_RAMP[o.attribute];
  const ms = o.ms ?? 650;
  // anticipation: white flash, hologram shiver, a slight lift
  await whiteFlash(scene, fromSprite, 70);
  const P = setHologram(fromSprite, { tint: ramp[4], ramp: holoRamp(ramp), tintMix: 0.5, scan: 1, glitch: 0.5, flicker: 0.3 });
  const y0 = fromSprite.y;
  await animate(scene, 180, (t) => {
    fromSprite.y = Math.round(y0 - 3 * easeOut3(t));
    P.tintMix = 0.5 + 0.5 * t;
    P.glitch = 0.5 + 0.4 * t;
  });

  const fp = framePixels(fromSprite);
  const sw = new Swarm(scene, DEPTH.FX);
  const pending: Promise<void>[] = [];
  if (fp && fp.box) {
    const { x0, y0: fy0, x1, y1 } = fp.box;
    const step = (x1 - x0) * (y1 - fy0) > 2600 ? 2 : 1;
    const hgt = Math.max(1, y1 - fy0);
    const tx = toXY.x;
    const ty = toXY.y;
    const core = pixelToWorld(fromSprite, (x0 + x1) / 2, (fy0 + y1) / 2);
    // one shared arc so the pixels form a ribbon, not a cloud
    const cxp = (core.x + tx) / 2;
    const cyp = Math.min(core.y, ty) - 56;
    let k = 0;
    for (let fy = fy0; fy < y1; fy += step) {
      for (let fx = x0; fx < x1; fx += step) {
        const i = (fy * fp.w + fx) * 4;
        if (fp.data[i + 3] === 0) continue;
        const col = (fp.data[i] << 16) | (fp.data[i + 1] << 8) | fp.data[i + 2];
        const w = pixelToWorld(fromSprite, fx + (step - 1) / 2, fy + (step - 1) / 2);
        const order = (fy - fy0) / hgt; // the top peels away first
        const delay = order * ms * 0.5 + rnd() * 50;
        const life = ms * rrange(0.45, 0.55);
        const sx = w.x;
        const sy = w.y;
        const ex = tx + rrange(-9, 9);
        const ey = ty + rrange(-4, 3);
        const mx = cxp + rrange(-3, 3);
        const my = cyp + rrange(-3, 3);
        const jx = rrange(-4, 4);
        const jy = rrange(-6, 0);
        const spark = k++ % 5 === 0;
        sw.add({
          x: sx,
          y: sy,
          age: -delay,
          life,
          size: step,
          color: col,
          showDelayed: true,
          trail: 3,
          trailColor: ramp[2],
          path: (p, t) => {
            // a little hop off the body, then the shared arc into the tile
            const lift = Math.min(1, t / 0.15);
            const u = Math.max(0, (t - 0.1) / 0.9);
            const e = u * u * (3 - 2 * u);
            const bx = sx + jx * lift;
            const by = sy + jy * lift;
            const q = 1 - e;
            p.x = q * q * bx + 2 * q * e * mx + e * e * ex;
            p.y = q * q * by + 2 * q * e * my + e * e * ey;
          },
          paint: (p, t) => {
            p.color = t < 0.12 ? col : t < 0.3 ? (bayer(Math.round(p.x), Math.round(p.y)) < 0.5 ? col : ramp[4]) : t < 0.85 ? ramp[4] : PAL.white;
            if (t > 0.4) p.size = 1;
          },
          onDeath: spark
            ? (p) =>
                sw.add({ x: p.x, y: p.y - 1, vy: -rrange(20, 50), life: 160, color: PAL.white, paint: (q, tt) => (q.color = tt > 0.5 ? ramp[3] : PAL.white) })
            : undefined,
        });
      }
    }
  }
  // the original sprite is replaced by its pixels (drawn in place until they peel off)
  fromSprite.setVisible(false);
  fromSprite.y = y0;
  clearHologram(fromSprite);
  pending.push(
    (async () => {
      await wait(scene, ms * 0.55);
      void shockwave(scene, toXY.x, toXY.y, { ramp, radius: 26, ms: 360, thickness: 3 });
      await wait(scene, ms * 0.5);
      void sparkleBurst(scene, toXY.x, toXY.y - 4, { ramp, count: 10, speed: 0.7 });
    })(),
  );
  await Promise.race([sw.done(), wait(scene, ms * 1.4)]);
  await Promise.all(pending);
}

// ================================================================ flip burst

/**
 * Flip summon accent (GAME_DESIGN §6 flip, step 2): an attribute burst on the tile — quick flash
 * column, radial sparks, a floor ring and the attribute's own debris. Resolves at the burst peak
 * (≈0.2 s) so the monster can spring out with it (e.g. materialize(…, { ms: 420 })); the column
 * collapses and debris settles on its own over the next ≈0.4 s.
 */
export async function flipBurst(scene: Phaser.Scene, x: number, y: number, attribute: Attribute): Promise<void> {
  const ramp = ATTRIBUTE_RAMP[attribute];
  const pl = createPillar(scene, x, y, { attribute, height: 80, width: 12, riseMs: 70, sparks: false });
  void shockwave(scene, x, y, { ramp, radius: 40, ms: 360, thickness: 4 });
  void sparkleBurst(scene, x, y - 14, { ramp, count: 16, speed: 1.1 });
  switch (attribute) {
    case 'FIRE':
      embers(scene, x, y - 6, { count: 22, speed: 1.6 });
      break;
    case 'WATER':
      droplets(scene, x, y - 10, { count: 18, speed: 1.1 });
      break;
    case 'EARTH':
      rockPreset(scene, x, y - 4, { count: 8, speed: 0.9 });
      dust(scene, x, y, { ramp: RAMPS.earth, radius: 14, count: 8 });
      break;
    case 'WIND':
      leafPreset(scene, x, y - 10, { count: 10, speed: 1.2 });
      break;
    case 'DARK':
      shadowWisps(scene, x, y, { radius: 14, count: 10 });
      break;
    case 'LIGHT':
      featherPreset(scene, x, y - 40, { w: 40, h: 20, count: 6 });
      break;
  }
  void shake(scene, 100, 1);
  // resolve at the burst peak so the monster can spring out with it; the column dies behind
  void wait(scene, 160).then(() => pl.collapse(140));
  await wait(scene, 200);
}

