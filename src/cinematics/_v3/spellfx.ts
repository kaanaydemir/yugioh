// v3 SPELL / TRAP EFFECT KIT — docs/v3/A5_PLAN.md §4.1 (lane A5-A). The scenes' shared effects that do
// not depend on how a monster is drawn (v3 art and the old art alike):
//
//   fxRng / fxCount / jitter             seeded randomness (never the shared set-piece stream), the
//                                        reduced-motion particle budget (×0.5), the 1-px local tremble
//   motifImage / nearestDir / swordFor   the pre-drawn motif drawings (src/art/spellmotifs-v3.ts) as
//                                        cached textures, and picking the drawing whose angle is closest
//                                        to a direction (instead of a fractional rotation)
//   steppedColumn                        a water / lava column rising and sinking in whole steps
//   dropArcs                             whole-pixel drops on parabolic arcs (water drops, lava gobs)
//   silhouetteOf / rimClimb              the struck sprite's outer contour as a world mask (from its
//                                        CURRENT frame's own pixels) and the 1-px edge light climbing it
//   steamThreads / steamEmitter / embers 1-px steam threads off the top edge, ember pixels that cool
//   shards                               whole-pixel shards (fall to the floor / slide outward) that
//                                        fade by palette steps and blink out — no alpha
//   honeycombPanel                       the mirror panel: built cell by cell, the cell wave, the break
//   chasmPad / frontEdgeMask             a pad split into slabs round an opening hole; the hole's
//                                        front lip as a mask a body sinks behind
//   runCrack                             the sharp crack running across the floor (moloz at its head)
//
// Every effect draws on a Raster (src/vfx/setpieces.ts) or the pixel particle layer (vfx/combat.ts
// Sparks) in whole pixels and PAL tones only; fades are palette steps, never alpha (REHBER EF-7,
// MA-4). They run on the scene clock (speed and hit-stop aware) and clean up on scene shutdown.
// A stepped animation never skips a step at 2× / 3× (one step per rendered frame at most; SÜ-3).
// Nothing here touches the camera (A5 §0 K1). Under REDUCED_MOTION particles are halved and the
// local tremble is off (A5 §3.0).

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { mulberry32 } from '../../art/pixel';
import { frameRGBA } from '../../art/atlas';
import { addStaticCanvas } from '../../art/textures';
import {
  HONEYCOMB_7,
  HONEYCOMB_7_SIZE,
  LAVA_W,
  SPRING_W,
  chasmGeometry,
  crackPath,
  greatSwordMotif,
  hexCenter,
  hexFacePixels,
  hexRing,
  paintChasm,
  paintCrack,
  paintHoneycomb,
  paintLavaColumn,
  paintSpringColumn,
  swordDir,
  swordMotif,
  type GreatSwordOpts,
  type HexCellState,
  type Motif,
  type MotifFacing,
  type SwordAngle,
  type SwordOpts,
} from '../../art/spellmotifs-v3';
import { DEPTH, type XY } from '../../view/layout';
import { REDUCED_MOTION } from '../../view/v3/motion';
import { Raster, onFrame, run } from '../../vfx/setpieces';
import { Sparks as PxSparks } from '../../vfx/combat';

type Unit = Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;

// =================================================================================== basics

/** A seeded random stream for one effect (mulberry32): the shared set-piece stream stays untouched. */
export function fxRng(seed: number): () => number {
  return mulberry32(Math.imul(Math.round(seed) | 0, 0x9e3779b1) >>> 0 || 1);
}

/** A seed from a point (effects at different places differ, the same call repeats exactly). */
function seedAt(p: XY, salt = 0): number {
  return (Math.round(p.x) * 73856093) ^ (Math.round(p.y) * 19349663) ^ (salt * 83492791);
}

/** Particle budget: halved under reduced motion (A5 §3.0), never below 1 when n ≥ 1. */
export function fxCount(n: number, reduced: boolean = REDUCED_MOTION): number {
  if (n <= 0) return 0;
  return reduced ? Math.max(1, Math.ceil(n / 2)) : n;
}

/** The next darker tone of `c` inside `ramp` (dark → light), or null past its dark end (gone). */
export function stepDown(ramp: readonly number[], c: number): number | null {
  const i = ramp.indexOf(c);
  return i <= 0 ? null : ramp[i - 1];
}

/**
 * A local 1-px tremble of an object (a tile, a raster image) for `ms`: ±1 px on whole pixels every
 * other frame, back home at the end. The camera never moves (K1). Off under reduced motion.
 */
export function jitter(scene: Phaser.Scene, obj: { x: number; y: number; setPosition(x: number, y: number): unknown }, ms = 120, reduced: boolean = REDUCED_MOTION): Promise<void> {
  if (reduced || ms <= 0) return Promise.resolve();
  const x0 = Math.round(obj.x);
  const y0 = Math.round(obj.y);
  let n = 0;
  return run(scene, ms, (t, _el, dt) => {
    if (dt > 0) n++;
    const off = t >= 1 ? 0 : [1, 0, -1, 0][n % 4];
    obj.setPosition(x0 + off, y0);
  });
}

/** Run `fn` once per rendered frame while it returns true; resolves when it stops. */
function frames(scene: Phaser.Scene, fn: (dt: number, el: number) => boolean): Promise<void> {
  return new Promise((resolve) => {
    onFrame(scene, (dt, el) => {
      const go = fn(dt, el);
      if (!go) resolve();
      return go;
    });
  });
}

/**
 * A stepped timeline that never skips a step: step i shows from `i·stepMs`, but at most one new
 * step per rendered frame (2× / 3× speed slows the steps to one per frame instead of dropping some).
 */
class Stepper {
  private shown = -1;
  constructor(private readonly stepMs: number) {}
  /** The step to show at elapsed `el` (call once per frame). */
  at(el: number): number {
    const due = Math.floor(el / Math.max(1, this.stepMs));
    if (due > this.shown) this.shown++;
    return this.shown;
  }
}

// =================================================================================== motif drawings

const motifCache = new Map<string, Motif>();

/** A motif drawing, built once per key (pure PixelCanvas; the texture is made per scene). */
function motif(key: string, make: () => Motif): Motif {
  let m = motifCache.get(key);
  if (!m) {
    m = make();
    motifCache.set(key, m);
  }
  return m;
}

/** The scene texture of a motif (`fx:motif:<key>`) and its anchor. */
export function motifTexture(scene: Phaser.Scene, key: string, make: () => Motif): { key: string; ax: number; ay: number; w: number; h: number } {
  const m = motif(key, make);
  const tk = `fx:motif:${key}`;
  if (!scene.textures.exists(tk)) addStaticCanvas(scene, tk, m.px.toCanvas());
  return { key: tk, ax: m.ax, ay: m.ay, w: m.px.w, h: m.px.h };
}

/** An Image showing a motif with its anchor on (x, y) (whole pixels, origin = the anchor). */
export function motifImage(scene: Phaser.Scene, key: string, make: () => Motif, x: number, y: number, depth: number): Phaser.GameObjects.Image {
  const t = motifTexture(scene, key, make);
  return scene.add
    .image(Math.round(x), Math.round(y), t.key)
    .setOrigin(t.ax / t.w, t.ay / t.h)
    .setDepth(depth);
}

/** Point an existing motif Image at another drawing (same anchor rules). */
export function setMotif(img: Phaser.GameObjects.Image, key: string, make: () => Motif): void {
  const t = motifTexture(img.scene, key, make);
  if (img.texture.key !== t.key) img.setTexture(t.key);
  img.setOrigin(t.ax / t.w, t.ay / t.h);
}

/** The sword drawing as a motif key / maker pair (swordMotif options → a cache key). */
export function swordKey(o: SwordOpts): [string, () => Motif] {
  const k = `sword:${o.angle ?? 'up'}:${o.facing ?? 1}:${o.len ?? 11}:${o.stage ?? 3}:${o.rim ?? 'ink'}:${o.crack ? 1 : 0}:${o.glint ?? '-'}:${o.glintCross ? 1 : 0}`;
  return [k, () => swordMotif(o)];
}

/** Ejder Kılıcı's signature great sword (spellmotifs-v3 greatSwordMotif) as a motif key / maker pair. */
export function greatSwordKey(o: GreatSwordOpts): [string, () => Motif] {
  const k = `gsword:${o.angle ?? 'up'}:${o.facing ?? 1}:${o.stage ?? 3}:${o.rim ?? 'ink'}:${o.crack ? 1 : 0}:${o.glint ?? '-'}:${o.glintCross ? 1 : 0}:${o.runesLit ? 1 : 0}`;
  return [k, () => greatSwordMotif(o)];
}

/** Index of the direction in `dirs` closest to (dx, dy) (largest cosine); 0 for a zero vector. */
export function nearestDir(dx: number, dy: number, dirs: readonly XY[]): number {
  const l = Math.hypot(dx, dy);
  if (l < 1e-6) return 0;
  let best = 0;
  let bestDot = -Infinity;
  dirs.forEach((d, i) => {
    const dl = Math.hypot(d.x, d.y) || 1;
    const dot = (dx * d.x + dy * d.y) / (l * dl);
    if (dot > bestDot) {
      bestDot = dot;
      best = i;
    }
  });
  return best;
}

const SWORD_DRAWINGS: readonly { angle: SwordAngle; facing: MotifFacing }[] = [
  { angle: 'up', facing: 1 },
  { angle: 'diag', facing: 1 },
  { angle: 'flat', facing: 1 },
  { angle: 'diag', facing: -1 },
  { angle: 'flat', facing: -1 },
];

/** The pre-drawn sword (A5 §3.1: up, 45°, flat × 2 facings) closest to travel direction (dx, dy). */
export function swordFor(dx: number, dy: number): { angle: SwordAngle; facing: MotifFacing } {
  return SWORD_DRAWINGS[nearestDir(dx, dy, SWORD_DRAWINGS.map((s) => swordDir(s.angle, s.facing)))];
}

// =================================================================================== stepped column

export interface ColumnHandle {
  /** Resolves when the column has risen to its last height. */
  readonly risen: Promise<void>;
  /** Sink through `heights` (default: the rise reversed down to 0) one step per `stepMs`, then go. */
  collapse(heights?: readonly number[], stepMs?: number): Promise<void>;
  /** Remove at once. */
  destroy(): void;
}

/**
 * A water (A5 §3.5: 5 px, 0 → 14 → 26 → 34) or lava (§3.2: 8 px, 3 steps up to 24) column standing
 * on `at` (its base pixel). It rises through `rise` one step per `stepMs` (default one frame) and keeps
 * flowing (notches / blobs climb, the crown changes) until collapse(). No outline: it is light.
 */
export function steppedColumn(scene: Phaser.Scene, o: { kind: 'water' | 'lava'; at: XY; rise: readonly number[]; stepMs?: number; flowMs?: number; depth?: number }): ColumnHandle {
  const at = { x: Math.round(o.at.x), y: Math.round(o.at.y) };
  const maxH = Math.max(1, ...o.rise);
  const halfW = (o.kind === 'water' ? SPRING_W : LAVA_W) / 2 + 4;
  const ras = new Raster(scene, at.x - Math.ceil(halfW), at.y - maxH - 8, Math.ceil(halfW) * 2 + 1, maxH + 10, o.depth ?? DEPTH.FX + 2);
  const flowMs = o.flowMs ?? 34;
  let heights: readonly number[] = o.rise;
  let step = new Stepper(o.stepMs ?? 17);
  let t0 = 0;
  let dead = false;
  let onDone: (() => void) | null = null;
  let h = 0;
  const draw = (el: number) => {
    ras.begin();
    const phase = Math.floor(el / flowMs);
    const px = at.x - ras.x;
    const py = at.y - ras.y;
    if (h > 0) {
      if (o.kind === 'water') paintSpringColumn(ras.pc, px, py, h, { phase });
      else paintLavaColumn(ras.pc, px, py, h, { phase });
    }
    ras.end();
  };
  let resolveRisen: () => void = () => undefined;
  const risen = new Promise<void>((r) => (resolveRisen = r));
  let rising = true;
  let lastEl = 0;
  const kill = () => {
    if (dead) return;
    dead = true;
    stop();
    ras.destroy();
    resolveRisen();
  };
  const stop = onFrame(scene, (_dt, el) => {
    if (dead) return false;
    lastEl = el;
    const i = step.at(el - t0);
    h = heights[Math.min(heights.length - 1, Math.max(0, i))] ?? 0;
    if (rising && i >= heights.length - 1) {
      rising = false;
      resolveRisen();
    }
    draw(el);
    if (!rising && onDone && i >= heights.length - 1) {
      const fin = onDone;
      onDone = null;
      kill();
      fin();
      return false;
    }
    return true;
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, kill);
  return {
    risen,
    collapse(down, stepMs) {
      if (dead) return Promise.resolve();
      const from = h;
      heights = down ?? [...o.rise].reverse().filter((v) => v < from).concat(0);
      if (heights[heights.length - 1] !== 0) heights = [...heights, 0];
      step = new Stepper(stepMs ?? o.stepMs ?? 17);
      t0 = lastEl;
      rising = false;
      return new Promise<void>((resolve) => (onDone = resolve));
    },
    destroy: kill,
  };
}

// =================================================================================== drop arcs

export interface DropArcOpts {
  from: XY;
  /** One target, or one per drop (cycled). */
  to: XY | readonly XY[];
  n: number;
  kind: 'water' | 'lava';
  /** Height of the arc's top above the higher end (default 14). */
  apex?: number;
  /** Flight time of one drop (default 160 ms). */
  ms?: number;
  /** Launch interval (default 50 ms). */
  gap?: number;
  /** Random spread of the landing points (± px, default 0). */
  spread?: number;
  depth?: number;
  seed?: number;
  /** Each drop's landing (its index and point): the beat for a sound or a sparkle. */
  onLand?: (i: number, at: XY) => void;
  /**
   * Water only: the trail's length in pixels (default 1, as before). Longer trails step down
   * teal4 → teal3 → teal2 behind the drop (Şifa Pınarı's drops read as a stream at 1×, A-6).
   */
  trail?: number;
  /**
   * Water only: 'square' (default, as before: 2×2, white core + water4) or 'gem' (a 5-px plus lit
   * from the top left — white top / left / centre, water4 right / bottom: a drop that reads at 1×).
   */
  drop?: 'square' | 'gem';
}

/**
 * Drops on parabolic arcs, on whole pixels (A5 §3.5 damlalar, §3.2 lav damlaları). Water: 2×2
 * (white core + water4) with a 1-px teal trail; lava: a fire4 / fire3 gob with a fire2 trail that
 * lands as a cooling ember (fire4 → fire2 → stone1). Resolves when the last drop has landed.
 */
export function dropArcs(scene: Phaser.Scene, o: DropArcOpts): Promise<void> {
  const n = Math.max(0, Math.round(o.n));
  if (n === 0) return Promise.resolve();
  const rnd = fxRng(o.seed ?? seedAt(o.from, n));
  const targets = Array.isArray(o.to) ? (o.to as readonly XY[]) : [o.to as XY];
  const ms = o.ms ?? 160;
  const gap = o.gap ?? 50;
  const apex = o.apex ?? 14;
  const spread = o.spread ?? 0;
  const drops = Array.from({ length: n }, (_, i) => {
    const t = targets[i % targets.length];
    const to = { x: Math.round(t.x + (rnd() * 2 - 1) * spread), y: Math.round(t.y + (rnd() * 2 - 1) * spread * 0.5) };
    return { i, to, start: i * gap, landed: false, prev: null as XY | null, ember: -1, tail: [] as XY[] };
  });
  const trailN = Math.max(1, Math.round(o.trail ?? 1));
  const TAIL = [PAL.teal4, PAL.teal3, PAL.teal2, PAL.teal1] as const;
  // the raster covers every arc (+ margins)
  const xs = [o.from.x, ...drops.map((d) => d.to.x)];
  const ys = [o.from.y, ...drops.map((d) => d.to.y)];
  const x0 = Math.floor(Math.min(...xs)) - 4;
  const x1 = Math.ceil(Math.max(...xs)) + 4;
  const top = Math.floor(Math.min(...ys)) - apex - 4;
  const y1 = Math.ceil(Math.max(...ys)) + 4;
  const ras = new Raster(scene, x0, top, x1 - x0 + 1, y1 - top + 1, o.depth ?? DEPTH.FX + 3);
  const water = o.kind === 'water';
  const EMBER = [PAL.fire4, PAL.fire3, PAL.fire2, PAL.stone1];
  return frames(scene, (_dt, el) => {
    ras.begin();
    let live = false;
    for (const d of drops) {
      const t = (el - d.start) / ms;
      if (t < 0) {
        live = true;
        continue;
      }
      if (t >= 1) {
        if (!d.landed) {
          d.landed = true;
          d.ember = el;
          try {
            o.onLand?.(d.i, d.to);
          } catch (e) {
            console.error('[spellfx] onLand', e);
          }
        }
        // lava lands as an ember that cools in palette steps (90 ms each), water splashes for 2 frames
        const age = el - d.ember;
        if (!water && age < EMBER.length * 90) {
          ras.px(d.to.x, d.to.y, EMBER[Math.floor(age / 90)]);
          live = true;
        } else if (water && age < 34) {
          ras.px(d.to.x - 1, d.to.y, PAL.teal4);
          ras.px(d.to.x + 1, d.to.y, PAL.teal4);
          ras.px(d.to.x, d.to.y - 1, PAL.white);
          live = true;
        }
        continue;
      }
      live = true;
      const hi = Math.min(o.from.y, d.to.y) - apex;
      // parabola through from (t 0), the apex and to (t 1): x linear, y by a quadratic Bézier
      const cy = 2 * hi - (o.from.y + d.to.y) / 2;
      const x = Math.round(o.from.x + (d.to.x - o.from.x) * t);
      const y = Math.round((1 - t) * (1 - t) * o.from.y + 2 * (1 - t) * t * cy + t * t * d.to.y);
      if (water && trailN > 1) {
        // a longer trail: a streak back along the drop's last positions, `trail` px long, stepping
        // down the teal ramp every third pixel (a drop that moves several px a frame still reads)
        if (d.prev && (d.prev.x !== x || d.prev.y !== y)) {
          d.tail.unshift(d.prev);
          if (d.tail.length > 4) d.tail.length = 4;
        }
        let px0 = x;
        let py0 = y;
        let len = 0;
        for (const q of d.tail) {
          const n = Math.max(Math.abs(q.x - px0), Math.abs(q.y - py0));
          for (let k = 1; k <= n && len < trailN; k++) {
            len++;
            ras.px(Math.round(px0 + ((q.x - px0) * k) / n), Math.round(py0 + ((q.y - py0) * k) / n), TAIL[Math.min(TAIL.length - 1, Math.floor((len - 1) / 3))]);
          }
          px0 = q.x;
          py0 = q.y;
          if (len >= trailN) break;
        }
      } else if (d.prev && (d.prev.x !== x || d.prev.y !== y)) ras.px(d.prev.x, d.prev.y, water ? PAL.teal3 : PAL.fire2);
      if (water && o.drop === 'gem') {
        ras.px(x, y - 1, PAL.white);
        ras.px(x - 1, y, PAL.white);
        ras.px(x, y, PAL.white);
        ras.px(x + 1, y, PAL.water4);
        ras.px(x, y + 1, PAL.water4);
      } else if (water) {
        ras.px(x, y, PAL.white);
        ras.px(x + 1, y, PAL.water4);
        ras.px(x, y + 1, PAL.water4);
        ras.px(x + 1, y + 1, PAL.water4);
      } else {
        ras.px(x, y, PAL.fire4);
        ras.px(x + 1, y, PAL.fire3);
      }
      d.prev = { x, y };
    }
    ras.end();
    if (!live) {
      ras.destroy();
      return false;
    }
    return true;
  });
}

// =================================================================================== silhouette

/** A sprite's silhouette on the frame it shows now, in world pixels. */
export interface Silhouette {
  /** World bounds of the opaque pixels (inclusive left / top, exclusive right / bottom). */
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** Is world pixel (x, y) opaque? */
  has(x: number, y: number): boolean;
  /** Transparent pixels touching the body (4-neighbour): the 1-px edge just OUTSIDE it (EF-3). */
  outside(): readonly XY[];
  /** The outermost opaque pixels (the body's own contour). */
  contour(): readonly XY[];
  /** The top edge: per world column, the highest opaque pixel (null for empty columns). */
  topAt(x: number): number | null;
}

const silCache = new Map<string, Silhouette>();

/**
 * The silhouette of `s` on its CURRENT frame (its own texture pixels, so the v3 art, the old art and
 * the relit P2 sheets all work), mapped to world pixels with its position, origin, scale and flipX.
 * Cached per frame and placement; null while the sprite is hidden or has no readable pixels.
 */
export function silhouetteOf(s: Unit): Silhouette | null {
  if (!s.active || !s.visible) return null;
  const fr = s.frame;
  if (!fr) return null;
  const W = fr.realWidth;
  const H = fr.realHeight;
  const key = `${fr.texture.key}|${fr.name}|${Math.round(s.x)}|${Math.round(s.y)}|${s.flipX ? 1 : 0}|${s.scaleX}|${s.scaleY}|${s.originX}|${s.originY}`;
  const hit = silCache.get(key);
  if (hit) return hit;
  let data: Uint8ClampedArray | null = null;
  try {
    data = frameRGBA(fr);
  } catch {
    data = null;
  }
  if (!data) return null;
  const sx = s.scaleX || 1;
  const sy = s.scaleY || 1;
  const ox = s.x - s.originX * W * sx;
  const oy = s.y - s.originY * H * sy;
  // world bounds of the frame rect
  const L = Math.floor(Math.min(ox, ox + W * sx));
  const T = Math.floor(Math.min(oy, oy + H * sy));
  const R = Math.ceil(Math.max(ox, ox + W * sx));
  const B = Math.ceil(Math.max(oy, oy + H * sy));
  const w = R - L;
  const h = B - T;
  const mask = new Uint8Array(w * h);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      // the frame pixel under world pixel centre (L + x + .5, T + y + .5)
      let fx = Math.floor((L + x + 0.5 - ox) / sx);
      const fy = Math.floor((T + y + 0.5 - oy) / sy);
      if (s.flipX) fx = W - 1 - fx;
      if (fx < 0 || fy < 0 || fx >= W || fy >= H) continue;
      if (data[(fy * W + fx) * 4 + 3] === 0) continue;
      mask[y * w + x] = 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  if (maxX < 0) return null;
  const has = (x: number, y: number): boolean => {
    const ix = Math.floor(x) - L;
    const iy = Math.floor(y) - T;
    return ix >= 0 && iy >= 0 && ix < w && iy < h && mask[iy * w + ix] === 1;
  };
  let outsideList: XY[] | null = null;
  let contourList: XY[] | null = null;
  const sil: Silhouette = {
    left: L + minX,
    top: T + minY,
    right: L + maxX + 1,
    bottom: T + maxY + 1,
    has,
    outside() {
      if (!outsideList) {
        outsideList = [];
        for (let y = minY - 1; y <= maxY + 1; y++)
          for (let x = minX - 1; x <= maxX + 1; x++) {
            const wx = L + x;
            const wy = T + y;
            if (has(wx, wy)) continue;
            if (has(wx - 1, wy) || has(wx + 1, wy) || has(wx, wy - 1) || has(wx, wy + 1)) outsideList.push({ x: wx, y: wy });
          }
      }
      return outsideList;
    },
    contour() {
      if (!contourList) {
        contourList = [];
        for (let y = minY; y <= maxY; y++)
          for (let x = minX; x <= maxX; x++) {
            const wx = L + x;
            const wy = T + y;
            if (!has(wx, wy)) continue;
            if (!has(wx - 1, wy) || !has(wx + 1, wy) || !has(wx, wy - 1) || !has(wx, wy + 1)) contourList.push({ x: wx, y: wy });
          }
      }
      return contourList;
    },
    topAt(x) {
      const ix = Math.floor(x) - L;
      if (ix < 0 || ix >= w) return null;
      for (let y = 0; y < h; y++) if (mask[y * w + ix]) return T + y;
      return null;
    },
  };
  if (silCache.size > 64) silCache.clear();
  silCache.set(key, sil);
  return sil;
}

// =================================================================================== rim light

export interface RimOpts {
  /** One colour per climb step, darkest first (default fire2 → fire3 → fire4: the ATEŞ edge). */
  ramp?: readonly number[];
  /** Time per climb step (default 50 ms; 3 steps from the feet to the head). */
  stepMs?: number;
  /** Hold at the top (default 120 ms). */
  holdMs?: number;
  /** Step back down the ramp to nothing (default 120 ms). */
  fadeMs?: number;
  /** 'outside' (default): the 1-px edge just outside the body (EF-3); 'contour': its own outer pixels. */
  where?: 'outside' | 'contour';
  depth?: number;
  /** The top step's first frame: the beat for the single number (EF-9). */
  onPeak?: () => void;
  /**
   * Where the light starts: 'feet' (default — it climbs to the head: a stat raised, the ATEŞ edge) or
   * 'head' (it runs down to the feet: a stat lowered, the light draining off the body; A5 A-3b).
   */
  from?: 'feet' | 'head';
}

/**
 * A 1-px edge light that climbs a sprite's outline from its feet to its head in whole steps, holds,
 * and steps back down its ramp (A5 §3.2 ATEŞ: fire2 → fire3 → fire4). Only edge pixels of the
 * silhouette are painted — the body is never tinted, scaled or moved (A5 §3.0, risk 6). It follows
 * the sprite's animation (the mask is the frame on screen). Works for the old art too.
 */
export function rimClimb(scene: Phaser.Scene, s: Unit, o: RimOpts = {}): Promise<void> {
  const ramp = o.ramp ?? [PAL.fire2, PAL.fire3, PAL.fire4];
  const steps = ramp.length;
  const stepMs = o.stepMs ?? 50;
  const holdMs = o.holdMs ?? 120;
  const fadeMs = o.fadeMs ?? 120;
  const climb = new Stepper(stepMs);
  let ras: Raster | null = null;
  let peaked = false;
  const total = steps * stepMs + holdMs + fadeMs;
  return frames(scene, (_dt, el) => {
    const sil = silhouetteOf(s);
    if (!sil || el >= total) {
      ras?.destroy();
      return !!sil && el < total;
    }
    const W = sil.right - sil.left + 4;
    const H = sil.bottom - sil.top + 4;
    if (!ras || ras.w < W || ras.h < H) {
      ras?.destroy();
      ras = new Raster(scene, sil.left - 2, sil.top - 2, W + 8, H + 8, o.depth ?? s.depth + 0.5);
    }
    ras.moveTo(sil.left - 2, sil.top - 2);
    const k = Math.min(steps, climb.at(el) + 1);
    if (k >= steps && !peaked) {
      peaked = true;
      try {
        o.onPeak?.();
      } catch (e) {
        console.error('[spellfx] onPeak', e);
      }
    }
    // the lit part: feet up to this step's line; the colour: this step's tone, then down the ramp
    const fadeK = el > steps * stepMs + holdMs ? Math.floor(((el - steps * stepMs - holdMs) / fadeMs) * steps) : 0;
    const tone = ramp[Math.max(0, Math.min(steps - 1, k - 1 - fadeK))];
    const reach = Math.ceil(((sil.bottom - sil.top + 1) * k) / steps);
    const down = o.from === 'head';
    // feet → head: lit at or below the line; head → feet: lit at or above it
    const line = down ? sil.top - 1 + reach : sil.bottom - reach;
    ras.begin();
    if (k - 1 - fadeK >= 0) {
      const pts = o.where === 'contour' ? sil.contour() : sil.outside();
      for (const q of pts) if (down ? q.y <= line : q.y >= line) ras.px(q.x, q.y, tone);
    }
    ras.end();
    return true;
  });
}

/**
 * A struck body's 1-px edge flash (A5 §3.0: the old art is never tinted — the blow is carried by an
 * edge light): the pixels just outside the silhouette light in ramp[0] for `hold` rendered frames,
 * then step through the rest of the ramp one frame each and are gone. Follows the sprite (the mask is
 * the frame on screen). Resolves when gone. A3b / A-4 (Ayna Kalkanı's beam contact).
 */
export function rimFlash(scene: Phaser.Scene, s: Unit, o: { ramp?: readonly number[]; hold?: number; depth?: number } = {}): Promise<void> {
  const ramp = o.ramp ?? [PAL.white, PAL.mag4, PAL.mag3, PAL.mag2];
  const hold = Math.max(1, o.hold ?? 2);
  let ras: Raster | null = null;
  let f = 0;
  return frames(scene, (dt) => {
    if (dt > 0) f++;
    const k = f < hold ? 0 : f - hold + 1;
    const sil = silhouetteOf(s);
    if (!sil || k >= ramp.length) {
      ras?.destroy();
      return false;
    }
    const W = sil.right - sil.left + 4;
    const H = sil.bottom - sil.top + 4;
    if (!ras || ras.w < W || ras.h < H) {
      ras?.destroy();
      ras = new Raster(scene, sil.left - 2, sil.top - 2, W + 8, H + 8, o.depth ?? s.depth + 0.6);
    }
    ras.moveTo(sil.left - 2, sil.top - 2);
    ras.begin();
    for (const q of sil.outside()) ras.px(q.x, q.y, ramp[k]);
    ras.end();
    return true;
  });
}

// =================================================================================== steam, embers

const STEAM = [PAL.white, PAL.mist, PAL.steel] as const;

/**
 * The world columns whose top edge lies in the upper `frac` of the silhouette's height — the body's
 * "top" (head, shoulders, back), not a hand, a tail tip or a foot that happens to be a column's
 * highest pixel. Never empty for a non-empty silhouette (falls back to the single highest column).
 */
function upperColumns(sil: Silhouette, frac = 0.34): number[] {
  const lim = sil.top + Math.max(2, Math.round((sil.bottom - sil.top) * frac));
  const out: number[] = [];
  let best = sil.left;
  let bestY = Infinity;
  for (let x = sil.left; x < sil.right; x++) {
    const t = sil.topAt(x);
    if (t === null) continue;
    if (t <= lim) out.push(x);
    if (t < bestY) {
      bestY = t;
      best = x;
    }
  }
  return out.length ? out : [best];
}

/** One steam thread: a 1-px column 3–5 px long rising from (x, y) on whole-pixel steps, fading by steps. */
function steamThread(ras: Raster, x: number, y: number, len: number, age: number, life: number, wob: number): void {
  const k = age / life;
  const rise = Math.floor(age / 40); // 1 px per 40 ms
  // the tone of the whole thread steps down white → mist → steel over its life
  const ti = Math.min(STEAM.length - 1, Math.floor(k * STEAM.length));
  for (let j = 0; j < len; j++) {
    const yy = y - rise - j;
    const xx = x + (Math.floor((rise + j + wob) / 3) % 2 === 0 ? 0 : 1);
    // head (top) brightest, tail one step dimmer
    const c = STEAM[Math.min(STEAM.length - 1, ti + (j === 0 ? 1 : 0))];
    ras.px(xx, yy, c);
  }
}

/**
 * 3–4 steam threads rising off the top edge of a sprite (A5 §3.2 SU: 1 px wide, 3–5 px tall,
 * steel / mist / white steps, whole-pixel steps). Resolves when the last thread is gone.
 */
export function steamThreads(scene: Phaser.Scene, s: Unit, o: { n?: number; life?: number; depth?: number; seed?: number } = {}): Promise<void> {
  const sil = silhouetteOf(s);
  if (!sil) return Promise.resolve();
  const rnd = fxRng(o.seed ?? seedAt({ x: sil.left, y: sil.top }, 7));
  const n = fxCount(o.n ?? 4);
  const life = o.life ?? 420;
  const cols = upperColumns(sil);
  const threads = Array.from({ length: n }, (_, i) => {
    const x = cols[Math.min(cols.length - 1, Math.max(0, Math.floor(((i + 0.5 + (rnd() - 0.5) * 0.6) / n) * cols.length)))];
    const y = (sil.topAt(x) ?? sil.top) - 1;
    return { x, y, len: 3 + Math.floor(rnd() * 3), delay: Math.floor(rnd() * 90), wob: Math.floor(rnd() * 3) };
  });
  const ras = new Raster(scene, sil.left - 3, sil.top - 24, sil.right - sil.left + 7, sil.bottom - sil.top + 26, o.depth ?? DEPTH.FX + 1);
  return frames(scene, (_dt, el) => {
    ras.begin();
    let live = false;
    for (const t of threads) {
      const age = el - t.delay;
      if (age < 0) {
        live = true;
        continue;
      }
      if (age >= life) continue;
      live = true;
      steamThread(ras, t.x, t.y, t.len, age, life, t.wob);
    }
    ras.end();
    if (!live) ras.destroy();
    return live;
  });
}

/**
 * A persistent steam aura: one thread every `everyMs` (≈ 600) off the sprite's top edge (A5 §3.2).
 * stop() removes it at once; stop(true) only stops new threads — the ones in the air finish, then it
 * goes. The threads stay where they were born (steam does not follow a lunge); the raster follows
 * the body, and nothing is drawn while the sprite is hidden.
 */
export function steamEmitter(scene: Phaser.Scene, s: Unit, o: { everyMs?: number; life?: number; depth?: number; seed?: number } = {}): { stop(graceful?: boolean): void } {
  const every = o.everyMs ?? 600;
  const life = o.life ?? 480;
  const rnd = fxRng(o.seed ?? 11);
  const live: { x: number; y: number; len: number; born: number; wob: number }[] = [];
  let next = 0;
  let dead = false;
  let ending = false;
  let ras: Raster | null = null;
  const kill = () => {
    if (dead) return;
    dead = true;
    stop();
    ras?.destroy();
  };
  const stop = onFrame(scene, (_dt, el) => {
    if (dead) return false;
    const sil = s.active && s.visible ? silhouetteOf(s) : null;
    if (sil && !ending && el >= next) {
      next = el + every;
      // off the body's top (head / shoulders / back), never off a hand or a tail tip
      const cols = upperColumns(sil);
      const x = cols[Math.floor(rnd() * cols.length)];
      live.push({ x, y: (sil.topAt(x) ?? sil.top) - 1, len: 3 + Math.floor(rnd() * 3), born: el, wob: Math.floor(rnd() * 3) });
    }
    for (let i = live.length - 1; i >= 0; i--) if (el - live[i].born >= life) live.splice(i, 1);
    if (ending && live.length === 0) {
      kill();
      return false;
    }
    if (!ras && sil) ras = new Raster(scene, sil.left - 3, sil.top - 24, sil.right - sil.left + 7, 32, o.depth ?? DEPTH.FX + 1);
    if (ras) {
      // keep the threads inside the raster: it spans the live threads (and the body when none)
      if (live.length) {
        const x0 = Math.min(...live.map((t) => t.x)) - 3;
        const y0 = Math.min(...live.map((t) => t.y)) - 24;
        if (x0 < ras.x || y0 < ras.y || x0 + 3 > ras.x + ras.w - 4 || y0 + 24 > ras.y + ras.h - 2) ras.moveTo(x0, y0);
      } else if (sil) ras.moveTo(sil.left - 3, sil.top - 24);
      ras.begin();
      for (const t of live) steamThread(ras, t.x, t.y, t.len, el - t.born, life, t.wob);
      ras.end();
    }
    if (!s.active) {
      kill();
      return false;
    }
    return true;
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, kill);
  return {
    stop(graceful = false) {
      if (graceful && !dead) ending = true;
      else kill();
    },
  };
}

/**
 * Ember pixels shooting up from `at` (or from each point) that cool in palette steps fire4 → fire3 →
 * fire2 → stone1 (REHBER §2.3 lava) — whole pixels, no alpha. Fire and forget.
 */
export function embers(scene: Phaser.Scene, at: XY | readonly XY[], o: { n?: number; up?: number; spread?: number; depth?: number; seed?: number } = {}): void {
  const pts = Array.isArray(at) ? (at as readonly XY[]) : [at as XY];
  if (!pts.length) return;
  const rnd = fxRng(o.seed ?? seedAt(pts[0], 3));
  const n = fxCount(o.n ?? 5);
  const sp = new PxSparks(scene, o.depth ?? DEPTH.FX + 2);
  const up = o.up ?? 70;
  const spread = o.spread ?? 24;
  for (let i = 0; i < n; i++) {
    const p = pts[i % pts.length];
    sp.add({
      x: Math.round(p.x),
      y: Math.round(p.y),
      vx: (rnd() * 2 - 1) * spread,
      vy: -up * (0.6 + rnd() * 0.6),
      ay: 90,
      drag: 1.5,
      life: 320 + Math.floor(rnd() * 200),
      colors: [PAL.fire4, PAL.fire3, PAL.fire2, PAL.stone1],
      shape: 'px',
      fadeAt: 1,
    });
  }
  sp.release();
}

// =================================================================================== shards

export interface ShardOpts {
  /** Source pixels (their colour and place), or a centre to spawn `n` shards of ramp[top] at. */
  from: XY | readonly { x: number; y: number; c: number }[];
  /** How many shards when `from` is a point (default 7). Halved under reduced motion. */
  n?: number;
  /** The tones they fade through, dark → light (the shard starts at its own / the top tone). */
  ramp: readonly number[];
  /** 'fall': thrown up and out, they drop to `floor` and lie there; 'slide': they slide `dist` px outward. */
  mode?: 'fall' | 'slide';
  /** The floor (world y) a falling shard stops on (default: from.y + 12). */
  floor?: number;
  /** Slide distance range (default 8…14 px, A5 §3.3). */
  dist?: readonly [number, number];
  /** Centre the shards fly away from (default: their mean). */
  centre?: XY;
  /** Time on the floor / at rest before fading (default 120 ms); each fade step 60 ms. */
  restMs?: number;
  depth?: number;
  seed?: number;
  /** 'fall': the throw's speed, a multiplier on the outward and upward launch (default 1; A-2's blade burst flings them wider). */
  speed?: number;
}

/** 'fall': a shard still in the air at this age lies down where it is (none hangs in mid-air for ever). */
const FALL_CAP_MS = 1500;

/**
 * Whole-pixel shards (A5 §3.1 sword, §3.3 mirror cells, §3.2 old field card): 1–3-pixel pieces that
 * fly on whole pixels, land or stop, then fade by palette steps down `ramp` and blink out — no alpha
 * (EF-7). Resolves when the last shard is gone.
 */
export function shards(scene: Phaser.Scene, o: ShardOpts): Promise<void> {
  const rnd = fxRng(o.seed ?? 5);
  const src: { x: number; y: number; c: number }[] = Array.isArray(o.from)
    ? (o.from as { x: number; y: number; c: number }[]).filter((_, i, a) => fxCount(a.length) === a.length || i % 2 === 0)
    : Array.from({ length: fxCount(o.n ?? 7) }, () => ({ x: (o.from as XY).x, y: (o.from as XY).y, c: o.ramp[o.ramp.length - 1] }));
  if (!src.length) return Promise.resolve();
  const mode = o.mode ?? 'fall';
  const c0 = o.centre ?? { x: src.reduce((s, q) => s + q.x, 0) / src.length, y: src.reduce((s, q) => s + q.y, 0) / src.length };
  const [d0, d1] = o.dist ?? [8, 14];
  const restMs = o.restMs ?? 120;
  const sp = o.speed ?? 1;
  const SHAPES: readonly (readonly [number, number][])[] = [[[0, 0]], [[0, 0], [1, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0], [0, 1]]];
  const parts = src.map((q) => {
    let dx = q.x - c0.x;
    let dy = q.y - c0.y;
    const l = Math.hypot(dx, dy);
    if (l < 0.5) {
      const a = rnd() * Math.PI * 2;
      dx = Math.cos(a);
      dy = Math.sin(a);
    } else {
      dx /= l;
      dy /= l;
    }
    return {
      x0: q.x,
      y0: q.y,
      c: q.c,
      shape: SHAPES[Math.floor(rnd() * SHAPES.length)],
      // fall: an outward throw with gravity; slide: a straight ease-out run
      vx: dx * (20 + rnd() * 30) * sp,
      vy: (-30 - rnd() * 50) * sp,
      dist: d0 + rnd() * (d1 - d0),
      dx,
      dy,
      floor: o.floor ?? q.y + 12,
      endAt: -1,
    };
  });
  const flyMs = mode === 'fall' ? 420 : 160;
  // the raster reaches as far as the furthest throw (the old 40-px margin at the least)
  const landS = (p: (typeof parts)[number]): number => {
    const disc = p.vy * p.vy + 840 * (p.floor - p.y0);
    return disc < 0 ? Infinity : (-p.vy + Math.sqrt(disc)) / 420;
  };
  const reach = mode === 'fall' ? Math.max(...parts.map((p) => Math.max(Math.abs(p.vx) * Math.min(Math.max(flyMs / 1000, landS(p)), FALL_CAP_MS / 1000), p.vy < 0 ? (p.vy * p.vy) / 840 : 0))) : d1;
  const span = Math.max(40, Math.ceil(reach) + 4);
  const xs = parts.map((p) => p.x0);
  const ys = parts.map((p) => p.y0);
  const ras = new Raster(scene, Math.min(...xs) - span, Math.min(...ys) - span, Math.max(...xs) - Math.min(...xs) + span * 2, Math.max(...ys, ...parts.map((p) => p.floor)) - Math.min(...ys) + span * 2, o.depth ?? DEPTH.FX + 4);
  return frames(scene, (_dt, el) => {
    ras.begin();
    let live = false;
    for (const p of parts) {
      let x: number;
      let y: number;
      let still = false;
      if (mode === 'slide') {
        const t = Math.min(1, el / flyMs);
        const e = 1 - (1 - t) * (1 - t);
        x = p.x0 + p.dx * p.dist * e;
        y = p.y0 + p.dy * p.dist * e;
        still = t >= 1;
        if (still && p.endAt < 0) p.endAt = el;
      } else {
        // landed within flyMs it slides on along the floor to flyMs (as it always did); one still in the
        // air at flyMs flies on until it lands, then lies where it landed (FALL_CAP_MS at most)
        const tFly = p.endAt > flyMs ? p.endAt : p.endAt >= 0 || el <= flyMs ? Math.min(el, flyMs) : Math.min(el, FALL_CAP_MS);
        const s = tFly / 1000;
        x = p.x0 + p.vx * s;
        y = p.y0 + p.vy * s + 0.5 * 420 * s * s;
        if (y >= p.floor || tFly >= FALL_CAP_MS) {
          y = Math.min(y, p.floor);
          still = true;
          if (p.endAt < 0) p.endAt = el;
        }
      }
      // fade: after resting, one palette step every 60 ms, then gone (blink out)
      let c: number | null = p.c;
      if (still && p.endAt >= 0) {
        const steps = Math.floor(Math.max(0, el - p.endAt - restMs) / 60);
        for (let k = 0; k < steps && c !== null; k++) c = stepDown(o.ramp, c) ?? null;
        if (steps >= o.ramp.length) c = null;
      }
      if (c === null) continue;
      live = true;
      for (const [ox, oy] of p.shape) ras.px(Math.round(x) + ox, Math.round(y) + oy, c);
    }
    ras.end();
    if (!live) ras.destroy();
    return live;
  });
}

// =================================================================================== mirror panel

export interface HoneyPanel {
  /** Where the panel's centre cell centre is (world). */
  readonly at: XY;
  /** World centre of cell i (HONEYCOMB_7 order; 3 = the centre cell). */
  cellPoint(i: number): XY;
  /** Build: the centre cell, then the ring in 3 steps (4 steps, `gapMs` apart; frame first, face next frame). */
  build(gapMs?: number): Promise<void>;
  /** The cell wave (A5 §3.3 YAKALAMA): cell i white 2 frames, the rings step ±1 tone over 3 frames. */
  wave(i: number): void;
  /** Break: every cell into 2–3 whole-pixel shards sliding 8–14 px outward, fading by steps. */
  break(): Promise<void>;
  destroy(): void;
}

/** Build order of the 7 cells (A5 §3.3: from the middle out, 4 steps). */
const BUILD_STEPS: readonly (readonly number[])[] = [[3], [2, 4], [0, 6], [1, 5]];

/**
 * Ayna Kalkanı's upright honeycomb mirror panel (A5 §3.3), 25×24 px, centred on `at` (the centre
 * cell's centre). Cells: 1-px mag2 frame, mag3 face, mist on the upper-left edges, a 2×1 white glint
 * that moves from cell to cell; ink outline round the panel.
 */
export function honeycombPanel(scene: Phaser.Scene, o: { at: XY; depth?: number; seed?: number }): HoneyPanel {
  const centre = hexCenter(HONEYCOMB_7[3]);
  const ox = Math.round(o.at.x) - centre.x;
  const oy = Math.round(o.at.y) - centre.y;
  const ras = new Raster(scene, ox - 2, oy - 2, HONEYCOMB_7_SIZE.w + 4, HONEYCOMB_7_SIZE.h + 4, o.depth ?? DEPTH.FX + 5);
  const states: HexCellState[] = HONEYCOMB_7.map(() => ({ hidden: true }));
  let waveAt = -1;
  let waveCell = -1;
  let dead = false;
  let broken = false;
  let frame = 0;
  const draw = () => {
    ras.begin();
    if (!broken) {
      const sts = states.map((st, i) => {
        if (st.hidden || st.frameOnly || waveAt < 0) return { ...st, glint: !st.hidden && !st.frameOnly && i === Math.floor(frame / 18) % 7 };
        const t = frame - waveAt;
        if (i === waveCell) return t < 2 ? { white: true } : {};
        const r = Math.round(hexRing(HONEYCOMB_7[waveCell], HONEYCOMB_7[i]));
        // the ring steps one tone up as the wave reaches it, one down the frame after, then rests
        const tone = t === r ? 1 : t === r + 1 ? -1 : 0;
        return { tone };
      });
      paintHoneycomb(ras.pc, ox - ras.x, oy - ras.y, sts);
    }
    ras.end();
  };
  const stop = onFrame(scene, (dt) => {
    if (dead) return false;
    if (dt > 0) frame++;
    if (waveAt >= 0 && frame - waveAt > 6) waveAt = -1;
    draw();
    return true;
  });
  const kill = () => {
    if (dead) return;
    dead = true;
    stop();
    ras.destroy();
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, kill);
  const cellPoint = (i: number): XY => {
    const c = hexCenter(HONEYCOMB_7[i]);
    return { x: ox + c.x, y: oy + c.y };
  };
  return {
    at: cellPoint(3),
    cellPoint,
    async build(gapMs = 50) {
      const step = new Stepper(gapMs);
      let shown = -1;
      await frames(scene, (_dt, el) => {
        if (dead) return false;
        const k = Math.min(BUILD_STEPS.length - 1, step.at(el));
        // the previous step's cells fill their faces; this step's appear as frames
        if (k > shown) {
          for (let j = 0; j <= k; j++) for (const i of BUILD_STEPS[j]) states[i] = j === k ? { frameOnly: true } : {};
          shown = k;
          return true;
        }
        for (const i of BUILD_STEPS[k]) states[i] = {};
        return k < BUILD_STEPS.length - 1;
      });
    },
    wave(i) {
      waveCell = Math.max(0, Math.min(6, i));
      waveAt = frame;
    },
    async break() {
      if (dead || broken) return;
      broken = true;
      // 2–3 shard pixels per cell, taken from its face (its own tones), sliding away from the centre
      const rnd = fxRng(o.seed ?? 9);
      const face = hexFacePixels();
      const src: { x: number; y: number; c: number }[] = [];
      HONEYCOMB_7.forEach((cell) => {
        const k = 2 + Math.floor(rnd() * 2);
        for (let j = 0; j < k; j++) {
          const q = face[Math.floor(rnd() * face.length)];
          src.push({ x: ox + cell.x + q.x, y: oy + cell.y + q.y, c: j === 0 ? PAL.mag4 : PAL.mag3 });
        }
      });
      draw();
      await shards(scene, { from: src, ramp: [PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag4], mode: 'slide', centre: cellPoint(3), restMs: 40, seed: o.seed ?? 9, depth: (o.depth ?? DEPTH.FX + 5) + 0.1 });
      kill();
    },
    destroy: kill,
  };
}

// =================================================================================== chasm

export interface ChasmPad {
  /** The current opening step (0 closed … 2 open). */
  readonly step: 0 | 1 | 2;
  /** Set the opening step (the slabs tilt in whole steps). */
  open(step: 0 | 1 | 2): void;
  /** The cracks growing in from the centre (0…1) while still closed. */
  crack(k: number): void;
  /** The hole's front lip now (world, left → right): feed it to frontEdgeMask. */
  lip(): XY[];
  destroy(): void;
}

/**
 * The victim's pad cracked into three slabs round an opening hole (A5 §3.4), drawn over the pad at
 * (cx, cy) with half sizes hw × hh (the calm pad interior is 26 × 13). Depth: above the floor, below
 * the units, so a body standing on it is drawn over the hole and sinks behind its front lip.
 */
export function chasmPad(scene: Phaser.Scene, o: { at: XY; hw?: number; hh?: number; depth?: number }): ChasmPad {
  const hw = o.hw ?? 26;
  const hh = o.hh ?? 13;
  const cx = Math.round(o.at.x);
  const cy = Math.round(o.at.y);
  const ras = new Raster(scene, cx - hw - 2, cy - hh - 2, hw * 2 + 5, hh * 2 + 5, o.depth ?? DEPTH.TILE_FX + 2);
  let step: 0 | 1 | 2 = 0;
  let k = 0;
  const draw = () => {
    ras.begin();
    paintChasm(ras.pc, cx - ras.x, cy - ras.y, hw, hh, { step, crack: k });
    ras.end();
  };
  draw();
  return {
    get step() {
      return step;
    },
    open(s) {
      step = s;
      draw();
    },
    crack(v) {
      k = Math.max(0, Math.min(1, v));
      draw();
    },
    lip() {
      return chasmGeometry(cx, cy, hw, hh, step).lip;
    },
    destroy() {
      ras.destroy();
    },
  };
}

export interface EdgeMask {
  /** Clip `obj`: only its part above the lip shows (it sinks behind the hole's front edge). */
  apply(obj: Phaser.GameObjects.Components.Mask & Phaser.GameObjects.GameObject): void;
  /** Remove the clip from `obj`. */
  clear(obj: Phaser.GameObjects.Components.Mask & Phaser.GameObjects.GameObject): void;
  /** Move the lip (the hole opening / closing). */
  update(lip: readonly XY[]): void;
  destroy(): void;
}

/**
 * The hole's front edge as a geometry mask (A5 §3.4 DÜŞÜŞ: "ön kenar maskesiyle deliğe girerek
 * kaybolur; solma yok"): everything above the lip polyline is visible, everything below it hidden.
 * A falling body steps down on whole pixels and disappears behind the edge — no fade.
 */
export function frontEdgeMask(scene: Phaser.Scene, lip: readonly XY[]): EdgeMask {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const draw = (pts: readonly XY[]) => {
    g.clear();
    g.fillStyle(0xffffff, 1);
    if (pts.length < 2) return;
    const poly = [{ x: pts[0].x, y: -400 }, ...pts.map((q) => ({ x: Math.round(q.x), y: Math.round(q.y) })), { x: pts[pts.length - 1].x, y: -400 }];
    g.fillPoints(poly.map((q) => new Phaser.Math.Vector2(q.x, q.y)), true);
  };
  draw(lip);
  const mask = g.createGeometryMask();
  const users = new Set<Phaser.GameObjects.Components.Mask & Phaser.GameObjects.GameObject>();
  return {
    apply(obj) {
      users.add(obj);
      obj.setMask(mask);
    },
    clear(obj) {
      users.delete(obj);
      if (obj.active) obj.clearMask();
    },
    update(pts) {
      draw(pts);
    },
    destroy() {
      for (const u of users) if (u.active) u.clearMask();
      users.clear();
      mask.destroy();
      g.destroy();
    },
  };
}

// =================================================================================== running crack

/**
 * The crack that runs across the floor from `from` to `to` (A5 §3.4 YARIK: ≤ 250 ms, a 1-px ink core
 * with 1-px mag3 light pixels on its lips, a sharp broken path on whole pixels) with small debris
 * pixels kicked up at its head. Resolves when it has arrived; fade() steps it out afterwards.
 */
export function runCrack(scene: Phaser.Scene, from: XY, to: XY, o: { ms?: number; seed?: number; depth?: number; light?: number } = {}): { done: Promise<void>; fade(ms?: number): Promise<void>; destroy(): void } {
  const seed = o.seed ?? seedAt(from, 13);
  const path = crackPath(from, to, seed, 3);
  const xs = path.map((q) => q.x);
  const ys = path.map((q) => q.y);
  const ras = new Raster(scene, Math.min(...xs) - 3, Math.min(...ys) - 3, Math.max(...xs) - Math.min(...xs) + 7, Math.max(...ys) - Math.min(...ys) + 7, o.depth ?? DEPTH.TILE_FX + 3);
  const ms = o.ms ?? 220;
  const rnd = fxRng(seed);
  const debris = new PxSparks(scene, (o.depth ?? DEPTH.TILE_FX + 3) + 0.1);
  let shown = 0;
  let dead = false;
  let fadeLevel = 0;
  const light = o.light ?? PAL.mag3;
  const draw = () => {
    ras.begin();
    if (fadeLevel === 0) paintCrack(ras.pc, path.map((q) => ({ x: q.x - ras.x, y: q.y - ras.y })), shown, { light });
    else if (fadeLevel === 1) paintCrack(ras.pc, path.map((q) => ({ x: q.x - ras.x, y: q.y - ras.y })), shown, { light: PAL.mag1, head: PAL.mag1 });
    else if (fadeLevel === 2) for (const q of path.slice(0, shown)) ras.px(q.x, q.y, PAL.ink);
    ras.end();
  };
  const step = new Stepper(ms / Math.max(1, path.length));
  const done = frames(scene, (dt, el) => {
    if (dead) return false;
    const before = shown;
    shown = Math.min(path.length, Math.max(shown, Math.floor((el / ms) * path.length), step.at(el)));
    if (shown > before && dt > 0 && rnd() < 0.5) {
      const h = path[Math.max(0, shown - 1)];
      debris.add({ x: h.x, y: h.y, vx: (rnd() * 2 - 1) * 30, vy: -40 - rnd() * 40, ay: 260, life: 220, colors: [PAL.stone3, PAL.stone2, PAL.stone1], shape: 'px', fadeAt: 1 });
    }
    draw();
    return shown < path.length;
  });
  const kill = () => {
    if (dead) return;
    dead = true;
    ras.destroy();
    debris.release();
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, kill);
  return {
    done,
    async fade(fms = 160) {
      // light → dim lips → bare ink → gone, in palette steps
      await run(scene, fms, (t) => {
        const lv = Math.min(3, Math.floor(t * 3) + 1);
        if (lv !== fadeLevel) {
          fadeLevel = lv;
          if (lv < 3) draw();
        }
      });
      kill();
    },
    destroy: kill,
  };
}
