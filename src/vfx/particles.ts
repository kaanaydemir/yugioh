// Particle presets + pixel-FX primitives shared by the summon / hologram VFX (and anyone else).
//
// Three layers of tools live here:
//   1. Crisp particle textures (built at boot by src/boot/12-vfx-summon.ts) — feathers, leaves,
//      rocks, smoke puffs, bubbles, droplets, shadow wisps, 7px sparkles.
//   2. Phaser 3.60+ particle presets (embers, smokePuffs, bubbles, droplets, leaves, feathers, dust,
//      sparkles, shadowWisps, motes). Every preset returns the ParticleEmitter and cleans itself up:
//      bursts are destroyed once their last particle dies, continuous emitters stop after `duration`.
//      Colors step through palette ramps (no RGB lerps), sizes step in whole pixels, and the emitter
//      clock follows the scene's tween clock — so hitStop() freezes sparks mid-air and setSpeed()
//      fast-forwards them.
//   3. Pixel-perfect procedural primitives: onTick (scaled per-frame callback), LiveRaster (a
//      PixelCanvas re-uploaded every frame — used for iso rings, cracks, vortices, beams),
//      ringPixels (cached 1px iso ellipse rings), bayer dithering, and Swarm (thousands of
//      individually colored square pixels drawn through one Graphics — pixel streams, converging
//      motes, sparks with trails).

import Phaser from 'phaser';
import { PAL, RAMPS, type Ramp } from '../art/palette';
import { PixelCanvas, mix, mulberry32 } from '../art/pixel';
import { sheetTexture } from '../art/textures';
import { DEPTH } from '../view/layout';
import { TEX } from './core';

// ================================================================ random

let rng = mulberry32(0x5eed);
/** Deterministic VFX random in [0, 1). Re-seed with seedFx() for repeatable previews. */
export function rnd(): number {
  return rng();
}
export function seedFx(seed: number): void {
  rng = mulberry32(seed);
}
export function rrange(a: number, b: number): number {
  return a + (b - a) * rng();
}
export function rint(a: number, b: number): number {
  return Math.floor(a + (b - a + 1) * rng());
}
export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

// ================================================================ dithering

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Ordered-dither threshold in (0, 1) for pixel (x, y). `level > bayer(x, y)` → pixel on. */
export function bayer(x: number, y: number): number {
  return (BAYER4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
}

/** Ramp color by index with clamping (index may be fractional → floored). */
export function rampAt(ramp: Ramp, i: number): number {
  return ramp[Math.max(0, Math.min(4, Math.floor(i)))];
}

/** A 5-step ramp derived from one accent color (for callers that pass a single color). */
export function rampFrom(color: number): Ramp {
  return [mix(PAL.ink, color, 0.3), mix(PAL.ink, color, 0.6), mix(PAL.ink, color, 0.85), color, mix(color, PAL.white, 0.6)];
}

// ================================================================ ticking

export type TickFn = (dt: number, elapsed: number) => boolean | void;

/**
 * Per-frame callback on the scene clock: `dt` is scaled by the tween time scale (so it follows
 * setSpeed and freezes during hitStop). Return true to stop. Returns a disposer.
 */
export function onTick(scene: Phaser.Scene, fn: TickFn): () => void {
  let elapsed = 0;
  let alive = true;
  const handler = (_t: number, delta: number) => {
    if (!alive) return;
    const dt = Math.min(delta, 50) * scene.tweens.timeScale;
    elapsed += dt;
    if (fn(dt, elapsed) === true) stop();
  };
  const stop = () => {
    if (!alive) return;
    alive = false;
    scene.events.off(Phaser.Scenes.Events.UPDATE, handler);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, stop);
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, handler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
  return stop;
}

/** Run `fn(t)` with t going 0→1 over `ms` of scene time (eased by `easeFn`). Resolves at t = 1. */
export function animate(scene: Phaser.Scene, ms: number, fn: (t: number, dt: number) => void, easeFn: (t: number) => number = (t) => t): Promise<void> {
  return new Promise((resolve) => {
    if (ms <= 0) {
      fn(1, 0);
      resolve();
      return;
    }
    fn(0, 0);
    onTick(scene, (dt, el) => {
      const t = Math.min(1, el / ms);
      fn(easeFn(t), dt);
      if (t >= 1) {
        resolve();
        return true;
      }
      return false;
    });
  });
}

// ================================================================ LiveRaster

let rasterSeq = 0;

/**
 * A PixelCanvas shown as an Image and re-uploaded whenever you redraw it. Pixel (ox, oy) of the
 * raster is pinned to world (x, y) (integer-snapped), so iso rings, cracks and beams stay crisp.
 */
export class LiveRaster {
  readonly scene: Phaser.Scene;
  readonly pc: PixelCanvas;
  readonly img: Phaser.GameObjects.Image;
  readonly ox: number;
  readonly oy: number;
  private readonly key: string;
  private readonly tex: Phaser.Textures.CanvasTexture;
  private readonly imageData: ImageData;
  private dead = false;

  constructor(scene: Phaser.Scene, w: number, h: number, x: number, y: number, ox: number, oy: number, depth: number) {
    this.scene = scene;
    this.ox = Math.round(ox);
    this.oy = Math.round(oy);
    this.key = `fx:raster:${++rasterSeq}`;
    this.pc = new PixelCanvas(w, h);
    this.tex = scene.textures.createCanvas(this.key, this.pc.w, this.pc.h)!;
    this.imageData = new ImageData(this.pc.data as Uint8ClampedArray<ArrayBuffer>, this.pc.w, this.pc.h);
    this.img = scene.add.image(0, 0, this.key).setOrigin(0, 0).setDepth(depth);
    this.moveTo(x, y);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  get alive(): boolean {
    return !this.dead;
  }

  moveTo(x: number, y: number): this {
    this.img.setPosition(Math.round(x) - this.ox, Math.round(y) - this.oy);
    return this;
  }

  /** Clear, draw, upload. */
  draw(fn: (p: PixelCanvas) => void): void {
    if (this.dead) return;
    this.pc.clear();
    fn(this.pc);
    this.tex.context.putImageData(this.imageData, 0, 0);
    this.tex.refresh();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.img.destroy();
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
  }
}

// ================================================================ cached iso ellipse rings

export interface RingPx {
  n: number;
  /** Pixel offsets from the ring center (center sits on a pixel corner). */
  xs: Int16Array;
  ys: Int16Array;
  /** Floor-space angle of each pixel (radians, 0 = screen right, +π/2 = toward the viewer). */
  ang: Float32Array;
}

const ringCache = new Map<string, RingPx>();

/**
 * 1px boundary pixels of an ellipse with radii (rx, ry) centered on a pixel corner — the same
 * raster rule as PixelCanvas.ellipseRing. Iso floor circles use ry = rx / 2. Cached.
 */
export function ringPixels(rx: number, ry: number): RingPx {
  rx = Math.max(0.5, Math.round(rx * 2) / 2);
  ry = Math.max(0.5, Math.round(ry * 2) / 2);
  const key = `${rx},${ry}`;
  let r = ringCache.get(key);
  if (r) return r;
  const inside = (x: number, y: number) => {
    const dx = (x + 0.5) / rx;
    const dy = (y + 0.5) / ry;
    return dx * dx + dy * dy <= 1;
  };
  const xs: number[] = [];
  const ys: number[] = [];
  const ang: number[] = [];
  const k = rx / ry;
  for (let y = -Math.ceil(ry) - 1; y <= Math.ceil(ry) + 1; y++) {
    for (let x = -Math.ceil(rx) - 1; x <= Math.ceil(rx) + 1; x++) {
      if (!inside(x, y)) continue;
      if (!inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1)) {
        xs.push(x);
        ys.push(y);
        ang.push(Math.atan2((y + 0.5) * k, x + 0.5));
      }
    }
  }
  r = { n: xs.length, xs: Int16Array.from(xs), ys: Int16Array.from(ys), ang: Float32Array.from(ang) };
  ringCache.set(key, r);
  return r;
}

/** Normalize an angle to [0, 2π). */
export function wrapAngle(a: number): number {
  const t = Math.PI * 2;
  return ((a % t) + t) % t;
}

// ================================================================ Swarm (Graphics pixel particles)

export interface SwarmParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Age in ms (starts negative while delayed). */
  age: number;
  life: number;
  color: number;
  /** Square size in pixels (integer). */
  size: number;
  alpha: number;
  /** Gravity (px/s²) and linear drag (1/s). */
  gy: number;
  drag: number;
  /** Optional custom motion: set x/y yourself from t = age / life. */
  path?: (p: SwarmParticle, t: number) => void;
  /** Optional color/size program over t. */
  paint?: (p: SwarmParticle, t: number) => void;
  /** Draw the particle at its spawn position while it is still delayed (age < 0). */
  showDelayed?: boolean;
  /** Trail length in frames (drawn 1px, darker). */
  trail: number;
  trailColor: number;
  hist?: number[];
  onDeath?: (p: SwarmParticle) => void;
  /** Free slot for callers. */
  data?: Record<string, number>;
  dead?: boolean;
}

/**
 * Many tiny pixel particles drawn through one Graphics object with integer rects. Use for effects
 * where each particle needs its own color/path (pixel streams, convergence, debris).
 * `done()` resolves once the swarm is empty; the swarm destroys itself then (autoDestroy).
 */
export class Swarm {
  readonly scene: Phaser.Scene;
  readonly g: Phaser.GameObjects.Graphics;
  private ps: SwarmParticle[] = [];
  private stopTick: () => void;
  private waiters: (() => void)[] = [];
  private destroyed = false;
  /** Keep alive (and drawing) even when empty until destroy() — for long-running emitters. */
  hold = false;

  constructor(scene: Phaser.Scene, depth: number = DEPTH.FX, blend: Phaser.BlendModes | string = Phaser.BlendModes.NORMAL) {
    this.scene = scene;
    this.g = scene.add.graphics().setDepth(depth).setBlendMode(blend);
    this.stopTick = onTick(scene, (dt) => this.update(dt));
  }

  get count(): number {
    return this.ps.length;
  }

  add(p: Partial<SwarmParticle> & { x: number; y: number }): SwarmParticle {
    const q: SwarmParticle = {
      vx: 0,
      vy: 0,
      age: 0,
      life: 500,
      color: PAL.white,
      size: 1,
      alpha: 1,
      gy: 0,
      drag: 0,
      trail: 0,
      trailColor: PAL.night3,
      ...p,
    };
    if (q.trail > 0) q.hist = [];
    this.ps.push(q);
    return q;
  }

  done(): Promise<void> {
    if (this.destroyed || (this.ps.length === 0 && !this.hold)) return Promise.resolve();
    return new Promise((r) => this.waiters.push(r));
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopTick();
    this.g.destroy();
    this.ps = [];
    for (const w of this.waiters.splice(0)) w();
  }

  private update(dt: number): boolean {
    if (this.destroyed) return true;
    const g = this.g;
    g.clear();
    const s = dt / 1000;
    const keep: SwarmParticle[] = [];
    for (const p of this.ps) {
      p.age += dt;
      if (p.age < 0) {
        keep.push(p);
        if (p.showDelayed) {
          const sz = Math.max(1, Math.round(p.size));
          g.fillStyle(p.color, p.alpha);
          g.fillRect(Math.round(p.x - (sz - 1) / 2), Math.round(p.y - (sz - 1) / 2), sz, sz);
        }
        continue;
      }
      const t = Math.min(1, p.age / p.life);
      if (p.hist) {
        p.hist.push(p.x, p.y);
        if (p.hist.length > p.trail * 2) p.hist.splice(0, p.hist.length - p.trail * 2);
      }
      if (p.path) p.path(p, t);
      else {
        p.vy += p.gy * s;
        if (p.drag > 0) {
          const k = Math.max(0, 1 - p.drag * s);
          p.vx *= k;
          p.vy *= k;
        }
        p.x += p.vx * s;
        p.y += p.vy * s;
      }
      if (p.paint) p.paint(p, t);
      if (t >= 1 || p.dead) {
        p.onDeath?.(p);
        continue;
      }
      keep.push(p);
      if (p.alpha <= 0 || p.size <= 0) continue;
      if (p.hist && p.hist.length >= 4) {
        g.fillStyle(p.trailColor, p.alpha);
        for (let i = 0; i < p.hist.length - 2; i += 2) g.fillRect(Math.round(p.hist[i]), Math.round(p.hist[i + 1]), 1, 1);
      }
      const sz = Math.max(1, Math.round(p.size));
      g.fillStyle(p.color, p.alpha);
      g.fillRect(Math.round(p.x - (sz - 1) / 2), Math.round(p.y - (sz - 1) / 2), sz, sz);
    }
    this.ps = keep;
    if (keep.length === 0 && !this.hold) {
      this.destroy();
      return true;
    }
    return false;
  }
}

// ================================================================ particle textures

export const PTEX = {
  /** 11×11 sheet, frames '0'..'3': rocking poses of a falling feather. Pre-colored white/gold. */
  feather: 'fx:feather',
  /** 7×7 sheet, frames '0'..'3': spinning leaf. Pre-colored leaf ramp. */
  leaf: 'fx:leaf',
  /** 7×7 sheet, frames '0'..'3': rock chunks of different shapes. Pre-colored earth ramp. */
  rock: 'fx:rock',
  /** 7×7 sheet, frames '0'..'3': gray stone chips. */
  chip: 'fx:chip',
  /** 13×13 sheet, frames '0'..'3': dithered puffs r=2..5 (white — tint them). */
  smoke: 'fx:smoke',
  /** 5×5 bubble (water ramp). */
  bubble: 'fx:bubble',
  /** 3×3 bubble (water ramp). */
  bubbleS: 'fx:bubble3',
  /** 2×3 droplet (water ramp). */
  drop: 'fx:drop',
  /** 5×7 sheet, frames '0'..'2': curling shadow wisp (void ramp). */
  wisp: 'fx:wisp',
  /** 7×7 four-point sparkle (white). */
  star7: 'fx:star7',
  /** 5×5 hollow diamond (white). */
  rhomb: 'fx:rhomb',
} as const;

export const PANIM = {
  feather: 'fx:feather:flutter',
  leaf: 'fx:leaf:spin',
  wisp: 'fx:wisp:curl',
  smoke: 'fx:smoke:grow',
} as const;

function drawFeather(p: PixelCanvas, ang: number): void {
  // 11×11 cell: exposed quill, white upper vane, pale-gold lower vane, shaft on top
  const cx = 5.5;
  const cy = 5.5;
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const L = 9;
  const at = (t: number, s: number): [number, number] => [Math.floor(cx + dx * (t - 0.5) * L - dy * s), Math.floor(cy + dy * (t - 0.5) * L + dx * s)];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    if (t < 0.2) continue;
    const u = (t - 0.2) / 0.8;
    const w = Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.05)), 0.7) * 1.9;
    for (let s = 0.5; s <= w; s += 0.5) {
      const [ux, uy] = at(t, -s);
      p.set(ux, uy, PAL.white);
      const [lx, ly] = at(t, s);
      p.set(lx, ly, u > 0.75 ? PAL.gold3 : PAL.gold4);
    }
  }
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    if (t > 0.88) break;
    const [sx, sy] = at(t, 0);
    p.set(sx, sy, t < 0.2 ? PAL.gold2 : PAL.gold3);
  }
}

function drawLeaf(p: PixelCanvas, ang: number, squash: number): void {
  const cx = 3.5;
  const cy = 3.5;
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const L = 6;
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const px = cx + dx * (t - 0.5) * L;
    const py = cy + dy * (t - 0.5) * L;
    const w = Math.sin(Math.PI * t) * 1.6 * squash;
    for (let s = -w; s <= w; s += 0.5) {
      p.set(Math.floor(px - dy * s), Math.floor(py + dx * s), s < -0.4 ? PAL.leaf4 : s > 0.6 ? PAL.leaf2 : PAL.leaf3);
    }
  }
  for (let i = 1; i <= 10; i++) {
    const t = i / 12;
    p.set(Math.floor(cx + dx * (t - 0.5) * L), Math.floor(cy + dy * (t - 0.5) * L), PAL.leaf1);
  }
}

/** Build the particle textures + particle animations. Idempotent. */
export function buildParticleTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(PTEX.feather)) return;

  // feathers: tilt-left, flat, tilt-right, flat
  const feathers: [string, PixelCanvas][] = [-0.55, 0.1, 0.6, -0.1].map((a, i) => {
    const p = new PixelCanvas(11, 11);
    drawFeather(p, a);
    return [String(i), p];
  });
  sheetTexture(scene, PTEX.feather, 11, 11, feathers);

  // leaves: spin through 4 orientations, one foreshortened
  const leaves: [string, PixelCanvas][] = [
    [0, 1],
    [Math.PI / 4, 0.6],
    [Math.PI / 2, 1],
    [(3 * Math.PI) / 4, 0.45],
  ].map(([a, s], i) => {
    const p = new PixelCanvas(7, 7);
    drawLeaf(p, a, s);
    return [String(i), p];
  });
  sheetTexture(scene, PTEX.leaf, 7, 7, leaves);

  // rocks (earth) and chips (stone)
  const rockShapes: [number, number][][] = [
    [
      [1, 2],
      [3, 1],
      [5, 2],
      [5, 4],
      [3, 5],
      [1, 4],
    ],
    [
      [1, 1],
      [4, 1],
      [5, 3],
      [3, 5],
      [1, 4],
    ],
    [
      [2, 1],
      [5, 2],
      [4, 5],
      [1, 4],
    ],
    [
      [2, 2],
      [4, 2],
      [4, 4],
      [2, 4],
    ],
  ];
  const mkRocks = (ramp: Ramp) =>
    rockShapes.map((pts, i) => {
      const p = new PixelCanvas(7, 7);
      p.poly(
        pts.map(([x, y]) => [x, y] as const),
        ramp[2],
      );
      // light from the top-left, shadow bottom-right
      p.map((c, x, y) => {
        const left = p.isOpaque(x - 1, y);
        const up = p.isOpaque(x, y - 1);
        const right = p.isOpaque(x + 1, y);
        const down = p.isOpaque(x, y + 1);
        if (!up || !left) return ramp[3];
        if (!down || !right) return ramp[1];
        return c;
      });
      p.outline(ramp[0]);
      if (i < 2) p.set(pts[0][0] + 1, pts[0][1], ramp[4]);
      return [String(i), p] as [string, PixelCanvas];
    });
  sheetTexture(scene, PTEX.rock, 7, 7, mkRocks(RAMPS.earth));
  sheetTexture(scene, PTEX.chip, 7, 7, mkRocks(RAMPS.stone));

  // smoke puffs (white, dithered rim)
  const puffs: [string, PixelCanvas][] = [2, 3, 4, 5].map((r, i) => {
    const p = new PixelCanvas(13, 13);
    for (let y = 0; y < 13; y++)
      for (let x = 0; x < 13; x++) {
        const d = Math.hypot(x + 0.5 - 6.5, (y + 0.5 - 6.5) * 1.15);
        if (d <= r - 1.2) p.set(x, y, PAL.white);
        else if (d <= r && bayer(x, y) < 0.55) p.set(x, y, PAL.white);
      }
    return [String(i), p];
  });
  sheetTexture(scene, PTEX.smoke, 13, 13, puffs);

  const mk = (key: string, w: number, h: number, draw: (p: PixelCanvas) => void) => {
    const p = new PixelCanvas(w, h);
    draw(p);
    scene.textures.addCanvas(key, p.toCanvas());
  };
  mk(PTEX.bubble, 5, 5, (p) => {
    p.ring(2.5, 2.5, 2.5, PAL.water3);
    p.set(1, 1, PAL.white).set(2, 1, PAL.water4).set(1, 2, PAL.water4);
  });
  mk(PTEX.bubbleS, 3, 3, (p) => {
    p.rect(1, 0, 1, 1, PAL.water3).rect(0, 1, 1, 1, PAL.water4).rect(2, 1, 1, 1, PAL.water3).rect(1, 2, 1, 1, PAL.water3);
  });
  mk(PTEX.drop, 2, 3, (p) => {
    p.set(0, 0, PAL.white).set(1, 0, PAL.water4).set(0, 1, PAL.water4).set(1, 1, PAL.water3).set(0, 2, PAL.water3).set(1, 2, PAL.water2);
  });
  mk(PTEX.star7, 7, 7, (p) => {
    p.rect(3, 0, 1, 7, PAL.white).rect(0, 3, 7, 1, PAL.white).rect(2, 2, 3, 3, PAL.white);
  });
  mk(PTEX.rhomb, 5, 5, (p) => {
    p.set(2, 0, PAL.white).set(1, 1, PAL.white).set(3, 1, PAL.white).set(0, 2, PAL.white).set(4, 2, PAL.white);
    p.set(1, 3, PAL.white).set(3, 3, PAL.white).set(2, 4, PAL.white);
  });

  // shadow wisps: a curling flame-like tongue in three phases
  const wisps: [string, PixelCanvas][] = [0, 1, 2].map((f) => {
    const p = new PixelCanvas(5, 7);
    for (let y = 0; y < 7; y++) {
      const t = y / 6;
      const cx = 2 + Math.sin(t * 3.2 + f * 2.1) * 1.2 * t;
      const w = (1 - t) * 1.6 + 0.4;
      for (let x = 0; x < 5; x++) {
        const d = Math.abs(x + 0.5 - (cx + 0.5));
        if (d <= w) p.set(x, 6 - y, d > w - 0.8 ? PAL.void3 : y < 2 ? PAL.void1 : PAL.void2);
      }
    }
    p.set(Math.round(2 + Math.sin(3.2 + f * 2.1) * 1.2), 0, PAL.void4);
    return [String(f), p];
  });
  sheetTexture(scene, PTEX.wisp, 5, 7, wisps);

  const anim = (key: string, tex: string, frames: number[], fps: number, repeat = -1) => {
    if (scene.anims.exists(key)) scene.anims.remove(key);
    scene.anims.create({ key, frames: frames.map((f) => ({ key: tex, frame: String(f) })), frameRate: fps, repeat });
  };
  anim(PANIM.feather, PTEX.feather, [0, 1, 2, 3], 5);
  anim(PANIM.leaf, PTEX.leaf, [0, 1, 2, 3], 10);
  anim(PANIM.wisp, PTEX.wisp, [0, 1, 2], 8);
  anim(PANIM.smoke, PTEX.smoke, [0, 1, 2, 3], 6, 0);
}

// ================================================================ emitter management

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;
type EmitterConfig = Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;

interface Managed {
  e: Emitter;
  t: number;
  stopAt: number;
  hardEnd: number;
}

const managed = new WeakMap<Phaser.Scene, Managed[]>();

function manage(scene: Phaser.Scene, e: Emitter, stopAt: number, maxLife: number): void {
  let list = managed.get(scene);
  if (!list) {
    const l: Managed[] = [];
    list = l;
    managed.set(scene, l);
    onTick(scene, (dt) => {
      const ts = scene.tweens.timeScale;
      for (let i = l.length - 1; i >= 0; i--) {
        const m = l[i];
        if (!m.e.scene) {
          l.splice(i, 1);
          continue;
        }
        m.e.timeScale = ts;
        m.t += dt;
        if (m.t >= m.stopAt && m.e.emitting) m.e.stop();
        if ((m.t >= m.stopAt && !m.e.emitting && m.e.getAliveParticleCount() === 0) || m.t >= m.hardEnd) {
          m.e.destroy();
          l.splice(i, 1);
        }
      }
      if (!scene.sys.isActive() && !scene.sys.isPaused()) {
        managed.delete(scene);
        return true;
      }
      return false;
    });
  }
  e.timeScale = scene.tweens.timeScale;
  list.push({ e, t: 0, stopAt, hardEnd: stopAt + maxLife + 400 });
}

export interface FxOpts {
  depth?: number;
  /** Burst size (one-shot) or particles per emission (continuous). */
  count?: number;
  /** Continuous emission for this long (ms). Omit for a one-shot burst. */
  duration?: number;
  /** ms between emissions when continuous. */
  frequency?: number;
  ramp?: Ramp;
  /** Spawn rectangle (centered on x, y). */
  w?: number;
  h?: number;
  /** Spawn iso ellipse (floor radius; screen ry = radius / 2). Overrides w/h. */
  radius?: number;
  /** Speed multiplier. */
  speed?: number;
  /** Lifespan multiplier. */
  life?: number;
  /** Additive blending. */
  add?: boolean;
  /** Starting frames for multi-frame presets (smoke/dust puffs: '0'..'3' = r2..r5). */
  frames?: string[];
}

function zoneFor(o: FxOpts): EmitterConfig['emitZone'] | undefined {
  if (o.radius) {
    const r = o.radius;
    return {
      type: 'random',
      source: {
        getRandomPoint: (pt: Phaser.Types.Math.Vector2Like) => {
          const a = rnd() * Math.PI * 2;
          const d = Math.sqrt(rnd()) * r;
          pt.x = Math.cos(a) * d;
          pt.y = Math.sin(a) * d * 0.5;
          return pt;
        },
      },
    } as EmitterConfig['emitZone'];
  }
  if (o.w || o.h) {
    return { type: 'random', source: new Phaser.Geom.Rectangle(-(o.w ?? 0) / 2, -(o.h ?? 0) / 2, o.w ?? 1, o.h ?? 1) } as EmitterConfig['emitZone'];
  }
  return undefined;
}

/** Stepped ramp tint over life: from ramp index `a` down/up to `b` (no RGB interpolation). */
export function rampTint(ramp: Ramp, a: number, b: number): Phaser.Types.GameObjects.Particles.EmitterOpCustomUpdateConfig {
  const n = Math.abs(b - a) + 1;
  const dir = Math.sign(b - a);
  return {
    onEmit: () => rampAt(ramp, a),
    onUpdate: (_p, _k, t) => rampAt(ramp, a + dir * Math.min(n - 1, Math.floor(t * n))),
  };
}

/** Alpha that holds at 1 then steps down to 0 over the last `tail` fraction of life. */
export function steppedFade(tail = 0.35, steps = 3): Phaser.Types.GameObjects.Particles.EmitterOpCustomUpdateConfig {
  return {
    onEmit: () => 1,
    onUpdate: (_p, _k, t) => {
      if (t < 1 - tail) return 1;
      const k = (t - (1 - tail)) / tail;
      return 1 - Math.ceil(k * steps) / (steps + 0.5);
    },
  };
}

/** Integer scale stepping from s0 to s1 over life. */
export function steppedScale(s0: number, s1: number): Phaser.Types.GameObjects.Particles.EmitterOpCustomUpdateConfig {
  return {
    onEmit: () => s0,
    onUpdate: (_p, _k, t) => Math.max(1, Math.round(s0 + (s1 - s0) * t)),
  };
}

/** Per-particle stable random phase (for sway/twinkle programs). */
const phaseOf = new WeakMap<object, number>();
function phase(p: object): number {
  let v = phaseOf.get(p);
  if (v === undefined) {
    v = rnd() * 1000;
    phaseOf.set(p, v);
  }
  return v;
}

/** Twinkle alpha (pixel sparkle blink) with an end fade. */
function twinkle(rate = 18): Phaser.Types.GameObjects.Particles.EmitterOpCustomUpdateConfig {
  return {
    onEmit: () => 1,
    onUpdate: (p, _k, t) => {
      const ph = phase(p);
      const on = Math.floor(t * rate + ph) % 4 !== 0;
      const fade = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      return (on ? 1 : 0.35) * (fade > 0.66 ? 1 : fade > 0.33 ? 0.6 : 0.3);
    },
  };
}

/** Create + manage an emitter. Continuous when o.duration is set, else a one-shot burst. */
export function emit(scene: Phaser.Scene, x: number, y: number, texture: string, config: EmitterConfig, o: FxOpts, defCount: number, maxLife: number): Emitter {
  const zone = zoneFor(o);
  const cont = o.duration !== undefined && o.duration > 0;
  const e = scene.add.particles(Math.round(x), Math.round(y), texture, {
    ...config,
    ...(zone ? { emitZone: zone } : {}),
    emitting: cont,
    frequency: cont ? (o.frequency ?? 40) : -1,
    quantity: cont ? (o.count ?? 1) : 1,
    blendMode: o.add ? Phaser.BlendModes.ADD : (config.blendMode ?? Phaser.BlendModes.NORMAL),
  });
  e.setDepth(o.depth ?? DEPTH.FX);
  if (!cont) e.explode(o.count ?? defCount);
  manage(scene, e, cont ? o.duration! : 0, maxLife);
  return e;
}

// ================================================================ presets

/** Embers: hot pixels that rise, wobble and cool down through the fire ramp. */
export function embers(scene: Phaser.Scene, x: number, y: number, o: FxOpts = {}): Emitter {
  const ramp = o.ramp ?? RAMPS.fire;
  const sp = o.speed ?? 1;
  const lf = o.life ?? 1;
  return emit(
    scene,
    x,
    y,
    TEX.px1,
    {
      lifespan: { min: 500 * lf, max: 1100 * lf },
      speed: { min: 40 * sp, max: 140 * sp },
      angle: { min: 235, max: 305 },
      gravityY: -40,
      accelerationX: { onEmit: () => 0, onUpdate: (p, _k, t) => Math.sin(t * 9 + phase(p)) * 90 },
      scale: { onEmit: () => (rnd() < 0.5 ? 2 : 1), onUpdate: (p, _k, t) => (t > 0.45 ? 1 : p.scaleX) },
      tint: rampTint(ramp, 4, 1),
      alpha: steppedFade(0.3),
    },
    { add: true, ...o },
    14,
    1100 * lf,
  );
}

/** Smoke puffs that rise slowly, grow (frame steps) and thin out. Tinted by ramp (default stone). */
export function smokePuffs(scene: Phaser.Scene, x: number, y: number, o: FxOpts = {}): Emitter {
  const ramp = o.ramp ?? RAMPS.stone;
  const sp = o.speed ?? 1;
  const lf = o.life ?? 1;
  return emit(
    scene,
    x,
    y,
    PTEX.smoke,
    {
      frame: o.frames ?? ['0', '1'],
      anim: o.frames ? undefined : PANIM.smoke,
      lifespan: { min: 700 * lf, max: 1100 * lf },
      speed: { min: 6 * sp, max: 22 * sp },
      angle: { min: 240, max: 300 },
      gravityY: -18,
      tint: rampTint(ramp, 3, 1),
      alpha: { onEmit: () => 0.85, onUpdate: (_p, _k, t) => (t < 0.45 ? 0.85 : t < 0.75 ? 0.55 : 0.3) },
    },
    o,
    6,
    1100 * lf,
  );
}

/** Bubbles that wobble upward and pop. */
export function bubbles(scene: Phaser.Scene, x: number, y: number, o: FxOpts = {}): Emitter {
  const sp = o.speed ?? 1;
  const lf = o.life ?? 1;
  return emit(
    scene,
    x,
    y,
    PTEX.bubble,
    {
      lifespan: { min: 500 * lf, max: 1000 * lf },
      speedY: { min: -40 * sp, max: -80 * sp },
      speedX: { min: -6, max: 6 },
      accelerationX: { onEmit: () => 0, onUpdate: (p, _k, t) => Math.sin(t * 14 + phase(p)) * 120 },
      alpha: steppedFade(0.2, 2),
    },
    o,
    8,
    1000 * lf,
  );
}

/** Small bubbles (3px) — mix with bubbles() for depth. */
export function bubblesSmall(scene: Phaser.Scene, x: number, y: number, o: FxOpts = {}): Emitter {
  const sp = o.speed ?? 1;
  const lf = o.life ?? 1;
  return emit(
    scene,
    x,
    y,
    PTEX.bubbleS,
    {
      lifespan: { min: 400 * lf, max: 800 * lf },
      speedY: { min: -50 * sp, max: -100 * sp },
      accelerationX: { onEmit: () => 0, onUpdate: (p, _k, t) => Math.sin(t * 16 + phase(p)) * 140 },
      alpha: steppedFade(0.2, 2),
    },
    o,
    10,
    800 * lf,
  );
}

/** Water droplets thrown upward that fall under gravity. */
export function droplets(scene: Phaser.Scene, x: number, y: number, o: FxOpts = {}): Emitter {
  const sp = o.speed ?? 1;
  const lf = o.life ?? 1;
  return emit(
    scene,
    x,
    y,
    PTEX.drop,
    {
      lifespan: { min: 500 * lf, max: 900 * lf },
      speed: { min: 60 * sp, max: 150 * sp },
      angle: { min: 225, max: 315 },
      gravityY: 380,
      alpha: steppedFade(0.15, 2),
    },
    o,
    16,
    900 * lf,
  );
}

/** Leaves that spin (frame anim) and swirl. */
export function leaves(scene: Phaser.Scene, x: number, y: number, o: FxOpts = {}): Emitter {
  const sp = o.speed ?? 1;
  const lf = o.life ?? 1;
  return emit(
    scene,
    x,
    y,
    PTEX.leaf,
    {
      anim: PANIM.leaf,
      lifespan: { min: 700 * lf, max: 1300 * lf },
      speed: { min: 40 * sp, max: 120 * sp },
      angle: { min: 0, max: 360 },
      gravityY: 30,
      accelerationX: { onEmit: () => 0, onUpdate: (p, _k, t) => Math.sin(t * 8 + phase(p)) * 160 },
      alpha: steppedFade(0.25, 2),
    },
    o,
    10,
    1300 * lf,
  );
}

/** Feathers that drift down rocking side to side. */
export function feathers(scene: Phaser.Scene, x: number, y: number, o: FxOpts = {}): Emitter {
  const lf = o.life ?? 1;
  return emit(
    scene,
    x,
    y,
    PTEX.feather,
    {
      anim: PANIM.feather,
      lifespan: { min: 1100 * lf, max: 1700 * lf },
      speedY: { min: 14, max: 30 },
      speedX: { min: -8, max: 8 },
      accelerationX: { onEmit: () => 0, onUpdate: (p, _k, t) => Math.sin(t * 7 + phase(p)) * 70 },
      alpha: steppedFade(0.25, 3),
    },
    o,
    8,
    1700 * lf,
  );
}

/** Dust puffs that roll outward along the floor (iso-flattened) and settle. */
export function dust(scene: Phaser.Scene, x: number, y: number, o: FxOpts = {}): Emitter {
  const ramp = o.ramp ?? RAMPS.stone;
  const sp = o.speed ?? 1;
  const lf = o.life ?? 1;
  return emit(
    scene,
    x,
    y,
    PTEX.smoke,
    {
      frame: o.frames ?? ['0', '1'],
      anim: o.frames ? undefined : PANIM.smoke,
      lifespan: { min: 450 * lf, max: 750 * lf },
      speed: { min: 30 * sp, max: 70 * sp },
      angle: { min: 0, max: 360 },
      // squash vertical motion so puffs roll along the iso floor
      emitCallback: (p: Phaser.GameObjects.Particles.Particle) => {
        p.velocityY = p.velocityY * 0.5 - 8;
      },
      accelerationX: { onEmit: () => 0, onUpdate: (p) => -p.velocityX * 3.2 },
      accelerationY: { onEmit: () => 0, onUpdate: (p) => -p.velocityY * 3.2 - 6 },
      tint: rampTint(ramp, 4, 2),
      alpha: { onEmit: () => 1, onUpdate: (_p, _k, t) => (t < 0.5 ? 1 : t < 0.8 ? 0.7 : 0.4) },
    },
    o,
    10,
    750 * lf,
  );
}

/** Four-point sparkles bursting out with ease-out and twinkling (ramp-stepped). */
export function sparkles(scene: Phaser.Scene, x: number, y: number, o: FxOpts = {}): Emitter {
  const ramp = o.ramp ?? RAMPS.gold;
  const sp = o.speed ?? 1;
  const lf = o.life ?? 1;
  return emit(
    scene,
    x,
    y,
    TEX.spark,
    {
      lifespan: { min: 350 * lf, max: 700 * lf },
      speed: { min: 50 * sp, max: 160 * sp },
      angle: { min: 0, max: 360 },
      accelerationX: { onEmit: () => 0, onUpdate: (p) => -p.velocityX * 5 },
      accelerationY: { onEmit: () => 0, onUpdate: (p) => -p.velocityY * 5 + 20 },
      tint: rampTint(ramp, 4, 2),
      alpha: twinkle(),
    },
    { add: true, ...o },
    12,
    700 * lf,
  );
}

/** Tiny single-pixel glints (sparkle dust). */
export function glints(scene: Phaser.Scene, x: number, y: number, o: FxOpts = {}): Emitter {
  const ramp = o.ramp ?? RAMPS.gold;
  const sp = o.speed ?? 1;
  const lf = o.life ?? 1;
  return emit(
    scene,
    x,
    y,
    TEX.plus,
    {
      lifespan: { min: 300 * lf, max: 650 * lf },
      speed: { min: 30 * sp, max: 120 * sp },
      angle: { min: 0, max: 360 },
      accelerationX: { onEmit: () => 0, onUpdate: (p) => -p.velocityX * 4 },
      accelerationY: { onEmit: () => 0, onUpdate: (p) => -p.velocityY * 4 + 30 },
      tint: rampTint(ramp, 4, 2),
      alpha: twinkle(22),
    },
    { add: true, ...o },
    16,
    650 * lf,
  );
}

/** Shadow wisps curling upward (void ramp). */
export function shadowWisps(scene: Phaser.Scene, x: number, y: number, o: FxOpts = {}): Emitter {
  const sp = o.speed ?? 1;
  const lf = o.life ?? 1;
  return emit(
    scene,
    x,
    y,
    PTEX.wisp,
    {
      anim: PANIM.wisp,
      lifespan: { min: 500 * lf, max: 900 * lf },
      speedY: { min: -30 * sp, max: -70 * sp },
      speedX: { min: -10, max: 10 },
      accelerationX: { onEmit: () => 0, onUpdate: (p, _k, t) => Math.sin(t * 10 + phase(p)) * 80 },
      alpha: steppedFade(0.35, 3),
    },
    o,
    8,
    900 * lf,
  );
}

/** Floating motes: slow rising single pixels / plus signs that twinkle (ambient energy). */
export function motes(scene: Phaser.Scene, x: number, y: number, o: FxOpts = {}): Emitter {
  const ramp = o.ramp ?? RAMPS.cyan;
  const sp = o.speed ?? 1;
  const lf = o.life ?? 1;
  return emit(
    scene,
    x,
    y,
    TEX.px1,
    {
      lifespan: { min: 600 * lf, max: 1200 * lf },
      speedY: { min: -20 * sp, max: -70 * sp },
      speedX: { min: -6, max: 6 },
      scale: { onEmit: () => (rnd() < 0.25 ? 2 : 1) },
      tint: rampTint(ramp, 4, 2),
      alpha: twinkle(14),
    },
    { add: true, ...o },
    10,
    1200 * lf,
  );
}

/** Rock chunks thrown out that fall and bounce once (earth ramp; `chips: true` for stone). */
export function rocks(scene: Phaser.Scene, x: number, y: number, o: FxOpts & { chips?: boolean } = {}): Emitter {
  const sp = o.speed ?? 1;
  const lf = o.life ?? 1;
  return emit(
    scene,
    x,
    y,
    o.chips ? PTEX.chip : PTEX.rock,
    {
      frame: ['0', '1', '2', '3'],
      lifespan: { min: 500 * lf, max: 800 * lf },
      speed: { min: 50 * sp, max: 130 * sp },
      angle: { min: 210, max: 330 },
      gravityY: 420,
      alpha: steppedFade(0.15, 2),
    },
    o,
    8,
    800 * lf,
  );
}
