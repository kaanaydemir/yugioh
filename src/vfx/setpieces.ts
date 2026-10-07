// Spell / trap set pieces and effect deliveries (GAME_DESIGN §6–§7).
//
//   await stormStrike(scene, x, y, { target, onImpact });       // Yıldırım Hükmü
//   await healingFountain(scene, player, panelCenter);          // Şifa Pınarı
//   await ghostRise(scene, graveXY, tileXY, 'ember_wolf');      // Ruh Çağrısı
//   const aura = await swordForge(scene, sprite);  aura.destroy() // Ejder Kılıcı (+ persistent aura)
//   await setVolcanoAmbience(scene, true);                      // Volkan Arenası overlay (sky/embers/ash/heat)
//   await trapSpring(scene, x, y);                              // common trap opening burst at a tile
//   await mirrorDome(scene, side, attackers, { onHit });        // Ayna Kalkanı
//   await chainsBind(scene, cardXY, attacker, { home });        // Işık Zincirleri
//   await chasm(scene, x, y, sprite);                           // Yer Yarığı
//   await burnFly(scene, from, panel, { kind: 'fireball' });    // effect damage delivery
//   await healFly(scene, from, panel);                          // effect LP gain delivery
//   await tendril(scene, magusXY, cardXY);                      // Uçurum Büyücüsü effect
//   await vineBurst(scene, x, y, sprite);                       // Dikenli Pusucu flip effect
//
// Every function is async, resolves at the end of its MAIN beat (so the caller can chain the
// next step — shatter, LP count, summon pillar), and keeps fading its leftovers on its own.
// Nothing here ever leaves objects behind: everything self-destroys, also on scene shutdown.
//
// Rendering: procedural shapes (bolts, clouds, domes, chains, vines, cracks) are drawn per frame
// into small PixelCanvas-backed textures (`Raster`) in WORLD coordinates — crisp 1:1 pixels,
// palette colors only, dithering instead of smooth alpha. Loose particles are pooled Images
// (`Sparks`) tinted through palette ramps. Clocks follow scene.tweens.timeScale, so setSpeed()
// fast-forwards and hitStop() freezes everything consistently.
//
// The kit section (Raster, Sparks, onFrame, run, spriteBox...) is exported for cutin.ts/banners.ts.

import Phaser from 'phaser';
import type { MonsterId } from '../data/cards';
import type { PlayerId } from '../engine/types';
import { PAL, RAMPS, type Ramp } from '../art/palette';
import { PixelCanvas, mix, mulberry32 } from '../art/pixel';
import { monsterFrame } from '../art/textures';
import { monsterArt } from '../art/monsters';
import { sfx, type SfxName } from '../audio/sfx';
import { DEPTH, GAME_H, GAME_W, type XY, isoToScreen, screenToIso, unitDepth } from '../view/layout';
import { TEX, flash, hitStop, shake, wait } from './core';
import { pixelText } from '../ui/text';

export type Unit = Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;

const TAU = Math.PI * 2;
const ADD = Phaser.BlendModes.ADD;

// =================================================================================== kit: rng

let rng = mulberry32(0x5e7f1);
/** Re-seed the set-piece randomness (dev previews / films use this for determinism). */
export function seedSetFx(seed: number): void {
  rng = mulberry32(seed);
}
export function rnd(): number {
  return rng();
}
export function rr(a: number, b: number): number {
  return a + (b - a) * rng();
}
export function ri(a: number, b: number): number {
  return Math.floor(a + (b - a + 1) * rng());
}
export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

// =================================================================================== kit: sound

let sfxOn = true;
/** Set pieces score their own beats (thunder, chains, mirror...). Turn off if a cinematic does it. */
export function setSetFxSfx(on: boolean): void {
  sfxOn = on;
}
export function snd(name: SfxName, volume = 1, pitch = 1): void {
  if (!sfxOn) return;
  try {
    sfx.play(name, { volume, pitch });
  } catch {
    /* audio never breaks a cinematic */
  }
}

// =================================================================================== kit: math

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Normalized progress of `t` inside [a, b] (clamped). */
export const seg = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));
export const E = {
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inQuad: (t: number) => t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inCubic: (t: number) => t * t * t,
  inOutSine: (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t),
  outExpo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t: number) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outBack: (t: number) => {
    const c1 = 1.70158;
    return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Ordered-dither threshold in (0, 1) for a world pixel. `level` passes when bayer < level. */
export function bayer(x: number, y: number): number {
  return (BAYER4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
}

/** Ramp lookup with clamping; i ≥ len → last, i < 0 → first. */
export function rampAt(ramp: readonly number[], i: number): number {
  return ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(i)))];
}

/** Quadratic Bézier point. */
export function qbez(a: XY, c: XY, b: XY, t: number): XY {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

// =================================================================================== kit: clock

/**
 * Per-frame callback on the scaled scene clock: fn(dt, elapsed). Return false to stop.
 * Called once immediately (dt 0) so the first frame draws on the frame the effect starts.
 * Frozen by hitStop, sped up by setSpeed. Auto-stops on scene shutdown. Returns a canceller.
 */
export function onFrame(scene: Phaser.Scene, fn: (dt: number, el: number) => boolean | void): () => void {
  let el = 0;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    scene.events.off(Phaser.Scenes.Events.UPDATE, h);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, stop);
  };
  const h = (_t: number, delta: number) => {
    const dt = Math.min(50, delta) * scene.tweens.timeScale;
    el += dt;
    if (fn(dt, el) === false) stop();
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, h);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
  if (fn(0, 0) === false) stop();
  return stop;
}

/** Run fn(t 0..1, elapsed, dt) every frame for `ms` of scaled time; resolves after fn(1). */
export function run(scene: Phaser.Scene, ms: number, fn: (t: number, el: number, dt: number) => void): Promise<void> {
  return new Promise((resolve) => {
    onFrame(scene, (dt, el) => {
      const t = ms <= 0 ? 1 : Math.min(1, el / ms);
      fn(t, el, dt);
      if (t >= 1) {
        resolve();
        return false;
      }
      return true;
    });
  });
}

/** Scaled-time sleep (same clock as onFrame/run). */
export function sleep(scene: Phaser.Scene, ms: number): Promise<void> {
  return wait(scene, ms);
}

function alive(scene: Phaser.Scene): boolean {
  return !!scene.sys && scene.sys.isActive() !== false && !!scene.sys.displayList;
}

// =================================================================================== kit: raster

let rasterSeq = 0;

/**
 * A PixelCanvas-backed image for procedural pixel drawing. All drawing methods take WORLD
 * coordinates (the raster knows its own top-left), so effects can draw in screen space.
 * Call draw(fn) every frame: it clears, runs fn, uploads.
 */
export class Raster {
  readonly scene: Phaser.Scene;
  readonly pc: PixelCanvas;
  readonly img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  readonly w: number;
  readonly h: number;
  private readonly key: string;
  private readonly tex: Phaser.Textures.CanvasTexture;
  private readonly imageData: ImageData;
  private dead = false;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, depth: number, blend: number = Phaser.BlendModes.NORMAL) {
    this.scene = scene;
    this.x = Math.round(x);
    this.y = Math.round(y);
    this.pc = new PixelCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
    this.w = this.pc.w;
    this.h = this.pc.h;
    this.key = `fx:set:${++rasterSeq}`;
    this.tex = scene.textures.createCanvas(this.key, this.w, this.h)!;
    this.imageData = new ImageData(this.pc.data as Uint8ClampedArray<ArrayBuffer>, this.w, this.h);
    this.img = scene.add.image(this.x, this.y, this.key).setOrigin(0, 0).setDepth(depth).setBlendMode(blend);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** Raster centered on (cx, cy). */
  static around(scene: Phaser.Scene, cx: number, cy: number, w: number, h: number, depth: number, blend?: number): Raster {
    return new Raster(scene, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h, depth, blend);
  }

  get alive(): boolean {
    return !this.dead;
  }

  moveTo(x: number, y: number): this {
    this.x = Math.round(x);
    this.y = Math.round(y);
    this.img.setPosition(this.x, this.y);
    return this;
  }

  draw(fn: (r: this) => void): void {
    if (this.dead) return;
    this.pc.clear();
    fn(this);
    this.end();
  }

  /** Clear for manual drawing (pair with end()). */
  begin(): void {
    if (!this.dead) this.pc.clear();
  }

  /** Upload what was drawn since begin(). */
  end(): void {
    if (this.dead) return;
    this.tex.context.putImageData(this.imageData, 0, 0);
    this.tex.refresh();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.img.destroy();
    if (this.scene.textures?.exists(this.key)) this.scene.textures.remove(this.key);
  }

  // ---- world-space pixel ops
  px(x: number, y: number, c: number, a = 255): void {
    this.pc.set(Math.floor(x) - this.x, Math.floor(y) - this.y, c, a);
  }
  /** Dithered pixel: drawn when the world bayer threshold < level (0..1). */
  dpx(x: number, y: number, c: number, level: number): void {
    const fx = Math.floor(x);
    const fy = Math.floor(y);
    if (level >= 1 || bayer(fx, fy) < level) this.pc.set(fx - this.x, fy - this.y, c);
  }
  rect(x: number, y: number, w: number, h: number, c: number, level = 1): void {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    for (let yy = y0; yy < y0 + h; yy++) for (let xx = x0; xx < x0 + w; xx++) this.dpx(xx, yy, c, level);
  }
  /** Bresenham line, optional dither level, optional width (stamped squares). */
  line(x0: number, y0: number, x1: number, y1: number, c: number, level = 1, width = 1): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const half = Math.floor((width - 1) / 2);
    for (let guard = 0; guard < 4000; guard++) {
      if (width <= 1) this.dpx(x0, y0, c, level);
      else for (let oy = -half; oy < width - half; oy++) for (let ox = -half; ox < width - half; ox++) this.dpx(x0 + ox, y0 + oy, c, level);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  /** Polyline through points. */
  path(pts: readonly XY[], c: number, level = 1, width = 1): void {
    for (let i = 1; i < pts.length; i++) this.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, c, level, width);
  }
  /** Round-capped thick line (stamped discs). */
  thick(x0: number, y0: number, x1: number, y1: number, r: number, c: number, level = 1): void {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(len));
    for (let i = 0; i <= n; i++) this.disc(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, r, c, level);
  }
  thickPath(pts: readonly XY[], r: number, c: number, level = 1): void {
    for (let i = 1; i < pts.length; i++) this.thick(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, r, c, level);
  }
  /** Filled ellipse sampled at pixel centers; `level` dithers. */
  ell(cx: number, cy: number, rx: number, ry: number, c: number, level = 1): void {
    if (rx <= 0 || ry <= 0) return;
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - cy) / ry;
      const span = 1 - dy * dy;
      if (span < 0) continue;
      const hw = rx * Math.sqrt(span);
      const xa = Math.ceil(cx - hw - 0.5);
      const xb = Math.floor(cx + hw - 0.5);
      for (let x = xa; x <= xb; x++) this.dpx(x, y, c, level);
    }
  }
  disc(cx: number, cy: number, r: number, c: number, level = 1): void {
    if (r < 0.75) {
      this.dpx(cx, cy, c, level);
      return;
    }
    this.ell(cx, cy, r, r, c, level);
  }
  /** 1px ellipse outline; `from..to` (radians) draws an arc; screen angles (0 = right, π/2 = down). */
  ring(cx: number, cy: number, rx: number, ry: number, c: number, level = 1, from = 0, to = TAU): void {
    if (rx < 0.5 || ry < 0.25) return;
    const n = Math.max(12, Math.ceil((rx + ry) * 2.2 * ((to - from) / TAU) * 2));
    let lx = NaN;
    let ly = NaN;
    for (let i = 0; i <= n; i++) {
      const a = from + ((to - from) * i) / n;
      const x = Math.floor(cx + Math.cos(a) * rx);
      const y = Math.floor(cy + Math.sin(a) * ry);
      if (x === lx && y === ly) continue;
      if (!isNaN(lx) && (Math.abs(x - lx) > 1 || Math.abs(y - ly) > 1)) this.line(lx, ly, x, y, c, level);
      else this.dpx(x, y, c, level);
      lx = x;
      ly = y;
    }
  }
  /** Filled polygon (even-odd), world coords. */
  poly(pts: readonly XY[], c: number, level = 1): void {
    if (pts.length < 3) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const sy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if ((a.y <= sy && b.y > sy) || (b.y <= sy && a.y > sy)) xs.push(a.x + ((sy - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) this.dpx(x, y, c, level);
      }
    }
  }
}

// =================================================================================== kit: sparks

export interface SparkOpts {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  /** Acceleration px/s² (gravity = positive ay). */
  ax?: number;
  ay?: number;
  /** Velocity damping per second (0 = none, 3 = strong). */
  drag?: number;
  /** Lifetime in ms. */
  life: number;
  /** Colors over life, first = birth. Defaults to [color]. */
  ramp?: readonly number[];
  color?: number;
  /** Texture key (default TEX.px1). */
  tex?: string;
  scale?: number;
  /** Leave a 1px trail every frame (dimmer ramp tail). */
  trail?: boolean;
  /** Random on/off flicker. */
  flicker?: boolean;
  /** Fraction of life at the end spent fading out in alpha steps (default 0.3). */
  fade?: number;
  /** Horizontal sine wobble amplitude (px/s) and frequency (Hz). */
  wobble?: number;
  wobbleHz?: number;
  /** Delay before the particle appears (ms). */
  delay?: number;
  /** Rotation speed (rad/s) — for textured flakes. */
  spin?: number;
  /** Called when the particle dies (e.g. to chain an impact). */
  onDie?: (x: number, y: number) => void;
  /** Follow a target position each frame (homing): strength 0..1 per frame at full life. */
  home?: { x: number; y: number; k: number };
}

interface SparkP extends SparkOpts {
  img: Phaser.GameObjects.Image | null;
  age: number;
  vx: number;
  vy: number;
  ph: number;
}

/**
 * Pooled pixel particles (Images, tinted through palette ramps, stepped fades).
 * Self-updating; call close() when no more will be added — it destroys itself once empty.
 */
export class Sparks {
  readonly scene: Phaser.Scene;
  private ps: SparkP[] = [];
  private pool: Phaser.GameObjects.Image[] = [];
  private closed = false;
  private dead = false;
  private stop: () => void;
  depth: number;
  blend: number;

  constructor(scene: Phaser.Scene, depth: number, blend: number = Phaser.BlendModes.NORMAL) {
    this.scene = scene;
    this.depth = depth;
    this.blend = blend;
    this.stop = onFrame(scene, (dt) => this.update(dt));
  }

  get count(): number {
    return this.ps.length;
  }

  add(o: SparkOpts): void {
    if (this.dead) return;
    this.ps.push({ ...o, img: null, age: -(o.delay ?? 0), vx: o.vx ?? 0, vy: o.vy ?? 0, ph: rnd() * TAU });
  }

  burst(n: number, fn: (i: number) => SparkOpts): void {
    for (let i = 0; i < n; i++) this.add(fn(i));
  }

  /** Destroy once all particles died. */
  close(): void {
    this.closed = true;
    if (this.ps.length === 0) this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.stop();
    for (const p of this.ps) p.img?.destroy();
    for (const i of this.pool) i.destroy();
    this.ps = [];
    this.pool = [];
  }

  private grab(p: SparkP): Phaser.GameObjects.Image {
    const img = this.pool.pop() ?? this.scene.add.image(0, 0, TEX.px1);
    img.setTexture(p.tex ?? TEX.px1).setVisible(true).setAlpha(1).setRotation(0).setDepth(this.depth).setBlendMode(this.blend).setScale(p.scale ?? 1);
    return img;
  }

  private release(p: SparkP): void {
    if (p.img) {
      p.img.setVisible(false);
      this.pool.push(p.img);
      p.img = null;
    }
  }

  private update(dt: number): boolean {
    if (this.dead) return false;
    const s = dt / 1000;
    const keep: SparkP[] = [];
    const trails: SparkOpts[] = [];
    for (const p of this.ps) {
      p.age += dt;
      if (p.age < 0) {
        keep.push(p);
        continue;
      }
      if (p.age >= p.life) {
        this.release(p);
        p.onDie?.(p.x, p.y);
        continue;
      }
      if (!p.img) p.img = this.grab(p);
      const ox = p.x;
      const oy = p.y;
      if (p.home) {
        const k = 1 - Math.pow(1 - p.home.k * (p.age / p.life), dt / 16.7);
        p.x += (p.home.x - p.x) * k;
        p.y += (p.home.y - p.y) * k;
      }
      p.vx += (p.ax ?? 0) * s;
      p.vy += (p.ay ?? 0) * s;
      if (p.drag) {
        const d = Math.exp(-p.drag * s);
        p.vx *= d;
        p.vy *= d;
      }
      p.x += p.vx * s + (p.wobble ? Math.sin(p.ph + (p.age / 1000) * TAU * (p.wobbleHz ?? 1.5)) * p.wobble * s : 0);
      p.y += p.vy * s;
      const life = p.age / p.life;
      const ramp = p.ramp ?? [p.color ?? PAL.white];
      const col = rampAt(ramp, life * ramp.length);
      const fade = p.fade ?? 0.3;
      let a = 1;
      if (life > 1 - fade) {
        const f = (1 - life) / fade;
        a = f > 0.66 ? 1 : f > 0.33 ? 0.66 : 0.33;
      }
      if (p.flicker && rnd() < 0.3) a *= 0.25;
      p.img.setPosition(Math.round(p.x), Math.round(p.y)).setTint(col).setAlpha(a);
      if (p.spin) p.img.setRotation(Math.round(((p.age / 1000) * p.spin) / (Math.PI / 2)) * (Math.PI / 2));
      if (p.trail && dt > 0 && (Math.abs(p.x - ox) >= 1 || Math.abs(p.y - oy) >= 1)) {
        const tail = ramp.slice(Math.min(ramp.length - 1, Math.floor(life * ramp.length) + 1));
        trails.push({ x: ox, y: oy, life: 140, ramp: tail.length ? tail : [col], fade: 0.6 });
        if (Math.hypot(p.x - ox, p.y - oy) > 2.5) trails.push({ x: (ox + p.x) / 2, y: (oy + p.y) / 2, life: 120, ramp: tail.length ? tail : [col], fade: 0.6 });
      }
      keep.push(p);
    }
    this.ps = keep;
    for (const t of trails) this.add(t);
    if (this.closed && this.ps.length === 0) {
      this.destroy();
      return false;
    }
    return true;
  }
}

// =================================================================================== kit: sprite geometry

interface FrameBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Per-row opaque [min, max] x (frame pixels), for silhouette-hugging effects. */
  rows: Array<[number, number] | null>;
}
const boxCache = new Map<string, FrameBox | null>();
const sourceCache = new Map<string, ImageData | null>();

function sourceData(scene: Phaser.Scene, key: string): ImageData | null {
  if (sourceCache.has(key)) return sourceCache.get(key)!;
  let data: ImageData | null = null;
  try {
    const src = scene.textures.get(key).getSourceImage() as HTMLCanvasElement | HTMLImageElement;
    const w = src.width;
    const h = src.height;
    let ctx: CanvasRenderingContext2D | null = null;
    if (src instanceof HTMLCanvasElement) ctx = src.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      ctx = c.getContext('2d', { willReadFrequently: true });
      ctx?.drawImage(src, 0, 0);
    }
    data = ctx ? ctx.getImageData(0, 0, w, h) : null;
  } catch {
    data = null;
  }
  sourceCache.set(key, data);
  return data;
}

function frameBox(scene: Phaser.Scene, frame: Phaser.Textures.Frame): FrameBox | null {
  const k = `${frame.texture.key}|${frame.name}`;
  if (boxCache.has(k)) return boxCache.get(k)!;
  const data = sourceData(scene, frame.texture.key);
  let box: FrameBox | null = null;
  if (data) {
    const rows: Array<[number, number] | null> = [];
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < frame.cutHeight; y++) {
      let a = -1;
      let b = -1;
      const sy = frame.cutY + y;
      for (let x = 0; x < frame.cutWidth; x++) {
        const i = (sy * data.width + frame.cutX + x) * 4 + 3;
        if (data.data[i] > 0) {
          if (a < 0) a = x;
          b = x;
        }
      }
      rows.push(a < 0 ? null : [a, b]);
      if (a >= 0) {
        x0 = Math.min(x0, a);
        x1 = Math.max(x1, b);
        y0 = Math.min(y0, y);
        y1 = y;
      }
    }
    if (x1 >= 0) box = { x0, y0, x1, y1, rows };
  }
  boxCache.set(k, box);
  return box;
}

export interface WorldBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** Half-width of the silhouette at world y (0 when outside). */
  halfAt(y: number): number;
  /** Silhouette x span at world y, or null. */
  spanAt(y: number): [number, number] | null;
}

/** Opaque bounds of a sprite's CURRENT frame in world space (rotation ignored). */
export function spriteBox(scene: Phaser.Scene, s: Unit): WorldBox {
  const fr = s.frame;
  const W = fr.realWidth;
  const H = fr.realHeight;
  const sx = s.scaleX;
  const sy = s.scaleY;
  const fb = fr ? frameBox(scene, fr) : null;
  const toX = (fx: number) => s.x + ((s.flipX ? W - fx : fx) - s.originX * W) * sx;
  const toY = (fy: number) => s.y + (fy - s.originY * H) * sy;
  if (!fb) {
    const left = s.x - s.displayOriginX * sx;
    const top = s.y - s.displayOriginY * sy;
    const w = s.displayWidth;
    const h = s.displayHeight;
    return {
      left,
      right: left + w,
      top,
      bottom: top + h,
      cx: left + w / 2,
      cy: top + h / 2,
      w,
      h,
      halfAt: (y) => (y >= top && y <= top + h ? w / 2 : 0),
      spanAt: (y) => (y >= top && y <= top + h ? [left, left + w] : null),
    };
  }
  const xa = toX(fb.x0);
  const xb = toX(fb.x1 + 1);
  const left = Math.min(xa, xb);
  const right = Math.max(xa, xb);
  const top = toY(fb.y0);
  const bottom = toY(fb.y1 + 1);
  const spanAt = (y: number): [number, number] | null => {
    const fy = Math.floor((y - s.y) / sy + s.originY * H);
    const r = fb.rows[fy];
    if (!r) return null;
    const a = toX(r[0]);
    const b = toX(r[1] + 1);
    return [Math.min(a, b), Math.max(a, b)];
  };
  return {
    left,
    right,
    top,
    bottom,
    cx: (left + right) / 2,
    cy: (top + bottom) / 2,
    w: right - left,
    h: bottom - top,
    halfAt: (y) => {
      const sp = spanAt(y);
      return sp ? (sp[1] - sp[0]) / 2 : 0;
    },
    spanAt,
  };
}

/** Brief solid-color silhouette flash on a sprite (restores its previous tint). */
export async function tintFlash(scene: Phaser.Scene, s: Unit, color: number = PAL.white, ms = 70): Promise<void> {
  if (!s.active) return;
  const prev = s.isTinted ? { fill: s.tintFill, tl: s.tintTopLeft } : null;
  s.setTintFill(color);
  await wait(scene, ms);
  if (!s.active) return;
  if (prev) {
    if (prev.fill) s.setTintFill(prev.tl);
    else s.setTint(prev.tl);
  } else s.clearTint();
}

/**
 * Additive colored glow over a sprite (a copy of its current frame, ADD blend) that fades out
 * in stepped alpha — "the monster lights up" without shifting its hues like a multiply tint.
 */
export function addGlow(scene: Phaser.Scene, s: Unit, color: number, ms = 400, peak = 0.8): Promise<void> {
  if (!s.active) return Promise.resolve();
  const g = scene.add.image(s.x, s.y, s.texture.key, s.frame.name).setOrigin(s.originX, s.originY).setFlipX(s.flipX).setScale(s.scaleX, s.scaleY).setBlendMode(ADD).setTintFill(color).setDepth(s.depth + 0.5);
  return run(scene, ms, (t) => {
    if (!s.active) return;
    g.setPosition(s.x, s.y).setFrame(s.frame.name).setFlipX(s.flipX).setDepth(s.depth + 0.5).setVisible(s.visible);
    const a = 1 - t;
    g.setAlpha(peak * (a > 0.75 ? 1 : a > 0.5 ? 0.7 : a > 0.25 ? 0.45 : 0.2));
  }).then(() => g.destroy());
}

// =================================================================================== kit: shared shapes

/** Midpoint-displacement lightning path from a to b. */
export function boltPath(a: XY, b: XY, amp: number, levels = 5): XY[] {
  let pts: XY[] = [a, b];
  let k = amp;
  for (let l = 0; l < levels; l++) {
    const next: XY[] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1];
      const q = pts[i];
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      const off = rr(-k, k);
      next.push({ x: (p.x + q.x) / 2 + (-dy / len) * off, y: (p.y + q.y) / 2 + (dx / len) * off });
      next.push(q);
    }
    pts = next;
    k *= 0.55;
  }
  return pts;
}

/** Layered glowing stroke: halo (dithered) → body → core. `w` = core half-width. */
export function glowStroke(r: Raster, pts: readonly XY[], ramp: readonly number[], w: number, intensity = 1): void {
  // ramp: [halo, outer, body, core]
  const [halo, outer, body, core] = ramp;
  if (intensity > 0.25) r.thickPath(pts, w + 3, halo, 0.38 * intensity);
  r.thickPath(pts, w + 1.5, outer, intensity > 0.6 ? 1 : 0.5);
  if (intensity > 0.35) r.thickPath(pts, w + 0.5, body);
  if (intensity > 0.5) {
    if (w >= 1.2) r.thickPath(pts, w - 0.6, core);
    else r.path(pts, core);
  }
}

/** Iso floor ellipse radii for a world circle of radius r (2:1). */
function isoR(r: number): [number, number] {
  return [r, r / 2];
}

/** Floor shockwave ring that expands and dithers out (fire-and-forget). */
export function floorRing(scene: Phaser.Scene, x: number, y: number, opts: { r0?: number; r1?: number; ms?: number; ramp?: readonly number[]; depth?: number; width?: number } = {}): Promise<void> {
  const r0 = opts.r0 ?? 4;
  const r1 = opts.r1 ?? 48;
  const ramp = opts.ramp ?? [PAL.white, PAL.teal4, PAL.teal3, PAL.teal2];
  const ras = Raster.around(scene, x, y, r1 * 2 + 8, r1 + 8, opts.depth ?? DEPTH.TILE_FX + 2);
  return run(scene, opts.ms ?? 420, (t) => {
    const k = E.outCubic(t);
    const r = lerp(r0, r1, k);
    const [rx, ry] = isoR(r);
    ras.draw((g) => {
      const col = rampAt(ramp, t * ramp.length);
      const lv = 1 - t * t;
      g.ring(x, y, rx, ry, col, lv);
      if ((opts.width ?? 2) > 1) g.ring(x, y, rx - 1, ry - 0.5, rampAt(ramp, t * ramp.length + 1), lv * 0.7);
      if (t < 0.5) g.ring(x, y, rx * 0.8, ry * 0.8, rampAt(ramp, t * ramp.length + 1), (0.5 - t) * 1.4);
    });
  }).then(() => ras.destroy());
}

/** Iso tile diamond flash (fill fading through a ramp). */
export function tileFlash(scene: Phaser.Scene, x: number, y: number, ramp: readonly number[], ms = 320, depth: number = DEPTH.TILE_FX + 1): Promise<void> {
  const ras = Raster.around(scene, x, y, 68, 36, depth);
  const pts = [
    { x: x, y: y - 16 },
    { x: x + 32, y: y },
    { x: x, y: y + 16 },
    { x: x - 32, y: y },
  ];
  return run(scene, ms, (t) => {
    ras.draw((g) => {
      const lv = 1 - E.inQuad(t);
      g.poly(pts, rampAt(ramp, t * ramp.length), lv * 0.75);
      g.path([...pts, pts[0]], rampAt(ramp, t * ramp.length * 0.5), lv);
    });
  }).then(() => ras.destroy());
}

// =================================================================================== 1. SPELLS

// ------------------------------------------------------------------ Yıldırım Hükmü — stormStrike

interface Puff {
  ang: number;
  rad: number;
  size: number;
  ph: number;
  layer: number;
}

export interface StormOpts {
  /** The monster being struck: it flashes white / x-rays during the strike. */
  target?: Unit;
  /** Called on the impact frame (before hit-stop) — trigger the shatter here or after the promise. */
  onImpact?: () => void;
  /** Cloud height above the target point (default 118 px, clamped to the screen). */
  height?: number;
}

const BOLT_RAMP = [PAL.teal2, PAL.teal4, PAL.white, PAL.white];

/**
 * Judgment bolt (~1.15 s main beat, ~1.6 s with the dissipating storm). The scene darkens, a
 * storm-cloud vortex gathers above (x, y), a teal sigil locks on, stepped leaders flicker,
 * then a giant zig-zag bolt hits: hit-stop, white flash, thunder shake, ground arcs and sparks.
 * Resolves ~500 ms after the impact (call your shatter after it, or in onImpact).
 */
export async function stormStrike(scene: Phaser.Scene, x: number, y: number, opts: StormOpts = {}): Promise<void> {
  x = Math.round(x);
  y = Math.round(y);
  const cx = x;
  const cy = Math.max(30, y - (opts.height ?? 118));
  const eye = { x: cx, y: cy + 6 };
  const T_LOCK = 520;
  const T_STRIKE = 680;

  // darkness: under the units (holograms keep glowing), over the floor
  const dark = scene.add.rectangle(0, 0, GAME_W, GAME_H, PAL.ink, 1).setOrigin(0).setDepth(DEPTH.SHADOW - 2).setAlpha(0);

  const clouds = Raster.around(scene, cx, cy, 236, 92, DEPTH.FX + 4);
  const sigil = Raster.around(scene, x, y, 120, 64, DEPTH.SHADOW - 1);
  const boltR = new Raster(scene, Math.min(cx, x) - 90, cy - 10, Math.abs(cx - x) + 180, y - cy + 40, DEPTH.FX + 6);
  const ground = Raster.around(scene, x, y, 200, 100, DEPTH.SHADOW - 1);
  const sparks = new Sparks(scene, DEPTH.FX + 8);
  const smoke = new Sparks(scene, DEPTH.FX + 3);

  // cloud puffs: an iso vortex that spirals in
  const puffs: Puff[] = [];
  const NP = 40;
  for (let i = 0; i < NP; i++) {
    const ring = i < 10 ? 0 : i < 25 ? 1 : 2;
    puffs.push({
      ang: ((i * 2.399) % TAU) + rr(-0.2, 0.2),
      rad: [rr(0, 28), rr(32, 58), rr(62, 98)][ring],
      size: [rr(16, 21), rr(13, 17), rr(8, 12)][ring],
      ph: rr(0, TAU),
      layer: ring,
    });
  }
  let cloudFlash = 0; // 0..1 internal lightning
  let flashX = cx;
  let strikeLight = 0; // big flash lighting from below at the strike
  let gather = 0; // 0..1
  let disperse = 0; // 0..1
  let eyeGlow = 0;

  // z-buffer for the billow renderer (puffs merge into one mass with dark creases)
  const CW = clouds.w;
  const CH = clouds.h;
  const zb = new Float32Array(CW * CH);
  const nxb = new Float32Array(CW * CH);
  const nyb = new Float32Array(CW * CH);
  const idb = new Int16Array(CW * CH);
  const drawClouds = (el: number) => {
    clouds.draw((g) => {
      zb.fill(-1e9);
      idb.fill(-1);
      const fade = 1 - disperse;
      puffs.forEach((p, id) => {
        // each puff grows in place while the whole vortex winds up (core first)
        const g0 = clamp01(gather * 1.6 - p.layer * 0.3);
        const spiral = (1 - gather) * 1.2;
        const a = p.ang + spiral + el * 0.0006 * (p.layer === 0 ? 1.8 : p.layer === 1 ? 1.2 : 1);
        const rad = p.rad * (1 + (1 - gather) * 0.45 + disperse * 0.8);
        const qx = cx + Math.cos(a) * rad;
        const qy = cy + Math.sin(a) * rad * 0.28 - (2 - p.layer) * 4 + Math.sin(el * 0.003 + p.ph) * 1.2;
        const s0 = p.size * E.outCubic(g0) * (1 - disperse * 0.4);
        if (s0 < 1.5) return;
        const sy = s0 * (p.layer === 2 ? 0.55 : 0.75); // flattened billows
        const x0 = Math.max(0, Math.floor(qx - s0 - clouds.x));
        const x1 = Math.min(CW - 1, Math.ceil(qx + s0 - clouds.x));
        const y0 = Math.max(0, Math.floor(qy - sy - clouds.y));
        const y1 = Math.min(CH - 1, Math.ceil(qy + sy - clouds.y));
        for (let ly = y0; ly <= y1; ly++) {
          const dy = (ly + clouds.y + 0.5 - qy) / sy;
          for (let lx = x0; lx <= x1; lx++) {
            const dx = (lx + clouds.x + 0.5 - qx) / s0;
            const d2 = dx * dx + dy * dy;
            if (d2 > 1) continue;
            // dither the outer rim of fading puffs
            if (fade < 1 && bayer(lx + clouds.x, ly + clouds.y) > fade * (1.25 - d2 * 0.5)) continue;
            const z = qy * 0.6 + Math.sqrt(1 - d2) * s0;
            const i = ly * CW + lx;
            if (z > zb[i]) {
              zb[i] = z;
              nxb[i] = dx;
              nyb[i] = dy;
              idb[i] = id;
            }
          }
        }
      });
      for (let ly = 0; ly < CH; ly++) {
        for (let lx = 0; lx < CW; lx++) {
          const i = ly * CW + lx;
          const id = idb[i];
          if (id < 0) continue;
          const wx = lx + clouds.x;
          const wy = ly + clouds.y;
          const dx = nxb[i];
          const dy = nyb[i];
          const l = -(dx * 0.4 + dy * 0.9); // moonlight from the upper left
          let c: number;
          if (l > 0.62) c = PAL.night2;
          else if (l > -0.45) c = PAL.night1;
          else c = PAL.night0;
          // crease: a clearly nearer puff right above casts a dark seam
          const up = ly > 0 ? idb[i - CW] : -1;
          if (up >= 0 && up !== id && zb[i - CW] > zb[i] + 1.5) c = PAL.night0;
          // silhouette top rim catches the moon
          if (up < 0) c = l > 0.3 ? PAL.night4 : PAL.night3;
          else if (ly > 1 && idb[i - 2 * CW] < 0 && l > 0.3) c = PAL.night3;
          if (ly + 1 < CH && idb[i + CW] < 0) c = PAL.ink;
          // lighting: internal flashes, the eye, the strike from below
          const near = Math.max(0, 1 - Math.hypot(wx - eye.x, (wy - eye.y) * 2.4) / 64);
          const fl = cloudFlash * Math.max(0, 1 - Math.abs(wx - flashX) / 64) * (0.55 + l * 0.6);
          const under = dy > 0 ? dy : 0;
          const prox = Math.max(0, 1 - Math.hypot(wx - eye.x, (wy - eye.y) * 1.8) / 120);
          const lit = Math.max(fl, strikeLight * (0.15 + under * 0.9) * (0.35 + prox * 0.9), eyeGlow * near * (0.35 + under) * 1.5);
          if (lit > 0.85) c = l > 0.1 ? PAL.white : PAL.teal4;
          else if (lit > 0.62) c = l > 0.1 ? PAL.teal4 : PAL.mist;
          else if (lit > 0.42) c = l > 0.1 ? PAL.mist : PAL.steel;
          else if (lit > 0.24) c = l > 0 ? PAL.steel : PAL.night4;
          else if (lit > 0.12 && c !== PAL.ink) c = PAL.night3;
          g.px(wx, wy, c);
        }
      }
      // the eye: a churning teal-white core
      if (eyeGlow > 0.05) {
        const r = 2 + eyeGlow * 6;
        g.ell(eye.x, eye.y, r * 1.8, r * 0.6, PAL.teal2, 0.55 * eyeGlow);
        g.ell(eye.x, eye.y, r * 1.1, r * 0.4, PAL.teal4, eyeGlow);
        g.ell(eye.x, eye.y, r * 0.55, r * 0.22, PAL.white, eyeGlow);
      }
    });
  };

  // sigil lock-on
  let sigilT = 0;
  let sigilLock = 0;
  let sigilOn = 0;
  const drawSigil = (el: number) => {
    sigil.draw((g) => {
      if (sigilOn <= 0.01) return;
      const k = E.outCubic(sigilT);
      const r = lerp(52, 22, k);
      const col = sigilLock > 0.5 ? PAL.white : PAL.teal3;
      const lv = sigilOn;
      g.ring(x, y, r, r / 2, col, lv);
      g.ring(x, y, r + 3, r / 2 + 1.5, PAL.teal1, lv * 0.7);
      // dashed inner ring rotating the other way
      const n = 10;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TAU - el * 0.004;
        g.ring(x, y, r * 0.62, r * 0.31, sigilLock > 0.5 ? PAL.teal4 : PAL.teal2, lv, a0, a0 + TAU / n / 2);
      }
      // four chevrons pointing in
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + el * 0.0025 + Math.PI / 4;
        const px = x + Math.cos(a) * (r + 7);
        const py = y + Math.sin(a) * (r + 7) * 0.5;
        const ix = -Math.cos(a);
        const iy = -Math.sin(a) * 0.5;
        const nx = -iy;
        const ny = ix;
        g.line(px + nx * 3, py + ny * 3, px + ix * 4, py + iy * 4, col, lv);
        g.line(px - nx * 3, py - ny * 3, px + ix * 4, py + iy * 4, col, lv);
      }
      if (sigilLock > 0) g.ell(x, y, r * 0.5, r * 0.25, PAL.teal4, sigilLock * 0.35);
    });
  };

  // bolt state
  let bolt: XY[] = [];
  let branches: XY[][] = [];
  let boltI = 0;
  let leaders: { pts: XY[]; until: number }[] = [];
  const newBolt = () => {
    bolt = boltPath(eye, { x, y: y - 3 }, 26, 6);
    branches = [];
    const nb = ri(2, 4);
    for (let i = 0; i < nb; i++) {
      const at = Math.floor(rr(0.2, 0.7) * bolt.length);
      const p = bolt[at];
      const side = rnd() < 0.5 ? -1 : 1;
      branches.push(boltPath(p, { x: p.x + side * rr(18, 42), y: p.y + rr(18, 46) }, 9, 4));
    }
  };
  const drawBolt = () => {
    boltR.draw((g) => {
      for (const l of leaders) g.path(l.pts, PAL.teal3, 0.85);
      if (boltI <= 0.02) return;
      for (const b of branches) glowStroke(g, b, BOLT_RAMP, 0.8, boltI * 0.8);
      glowStroke(g, bolt, BOLT_RAMP, 2.2, boltI);
      // contact bloom
      if (boltI > 0.5) {
        g.ell(x, y - 2, 9, 4, PAL.teal4);
        g.ell(x, y - 2, 5, 2.5, PAL.white);
      }
    });
  };

  // ground impact
  let impactT = -1;
  const arcs: XY[][] = [];
  const drawGround = (el: number) => {
    ground.draw((g) => {
      if (impactT < 0) return;
      const t = impactT;
      // scorch
      g.ell(x, y, 22, 10, PAL.ink, Math.max(0, 0.7 - t * 0.5));
      // burst disc
      const k = E.outCubic(seg(t, 0, 0.35));
      if (t < 0.45) {
        g.ring(x, y, 8 + k * 30, 4 + k * 15, PAL.teal4, 1 - seg(t, 0.1, 0.45));
        g.ell(x, y, 5 + k * 14, 2.5 + k * 7, PAL.teal4, 0.5 * (1 - seg(t, 0.05, 0.3)));
        g.ell(x, y, 3 + k * 9, 1.5 + k * 4.5, PAL.white, 1 - seg(t, 0, 0.25));
      }
      // crawling ground arcs (flicker)
      if (t < 0.7) {
        for (const a of arcs) {
          if (rnd() < 0.35) continue;
          const n = Math.max(2, Math.floor(a.length * Math.min(1, t * 4)));
          g.path(a.slice(0, n), rnd() < 0.5 ? PAL.teal4 : PAL.white, 1 - seg(t, 0.4, 0.7));
        }
      }
      // embers on the scorch
      if (t > 0.2) for (let i = 0; i < 6; i++) g.dpx(x + Math.sin(i * 2.3) * 10, y + Math.cos(i * 1.7) * 4, PAL.teal3, 0.6 - t * 0.6);
    });
  };

  const stopDraw = onFrame(scene, (_dt, el) => {
    drawClouds(el);
    drawSigil(el);
    drawBolt();
    drawGround(el);
  });

  // ---------------------------------------------------------------- timeline
  snd('spellActivate', 0.5, 0.8);
  const timeline = run(scene, 1600, (_t, el, dt) => {
    const darkK = el < 1050 ? E.outQuad(seg(el, 0, 300)) : 1 - seg(el, 1050, 1450);
    const flicker = cloudFlash > 0.5 ? 0.5 : 1;
    dark.setAlpha(0.62 * darkK * flicker);
    gather = E.outCubic(seg(el, 0, 560));
    disperse = E.inQuad(seg(el, 1000, 1600));
    sigilOn = el < T_STRIKE ? seg(el, 120, 220) : Math.max(0, 1 - seg(el, T_STRIKE, T_STRIKE + 120));
    sigilT = seg(el, 120, T_LOCK);
    sigilLock = el >= T_LOCK ? 1 : 0;
    eyeGlow = el < T_STRIKE ? E.inQuad(seg(el, 260, T_STRIKE)) : Math.max(0, 1 - seg(el, T_STRIKE, T_STRIKE + 500));
    cloudFlash = Math.max(0, cloudFlash - dt / 130);
    strikeLight = Math.max(0, strikeLight - dt / 650);
    if (impactT >= 0) impactT = Math.min(1, impactT + dt / 720);
  });

  // ambient intra-cloud flickers
  const flick = async (at: number) => {
    await sleep(scene, at);
    cloudFlash = 1;
    flashX = cx + rr(-60, 60);
    snd('thunder', 0.18, 1.5);
  };
  void flick(230);
  void flick(410);

  // stepped leaders
  void (async () => {
    await sleep(scene, 430);
    for (let i = 0; i < 4; i++) {
      const full = boltPath(eye, { x: x + rr(-20, 20), y }, 22, 5);
      leaders = [{ pts: full.slice(0, Math.floor(full.length * rr(0.25, 0.6))), until: 0 }];
      await sleep(scene, 34);
      leaders = [];
      await sleep(scene, 25);
    }
  })();

  // lock + static on the target
  void (async () => {
    await sleep(scene, 120);
    snd('lockOn', 0.6);
    await sleep(scene, T_LOCK - 120);
    snd('lockOn', 0.8, 1.4);
    if (opts.target?.active) void tintFlash(scene, opts.target, PAL.teal4, 50);
    for (let i = 0; i < 10; i++) {
      sparks.add({ x: x + rr(-14, 14), y: y - rr(2, 30), vx: rr(-30, 30), vy: rr(-60, -10), life: rr(120, 220), ramp: [PAL.white, PAL.teal4, PAL.teal3], delay: rr(0, 140) });
    }
  })();

  await sleep(scene, T_STRIKE);
  // ---------------------------------------------------------------- STRIKE
  newBolt();
  boltI = 1;
  strikeLight = 1;
  cloudFlash = 1;
  flashX = cx;
  impactT = 0;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + rr(-0.3, 0.3);
    const len = rr(26, 52);
    arcs.push(boltPath({ x, y }, { x: x + Math.cos(a) * len, y: y + Math.sin(a) * len * 0.5 }, 5, 3));
  }
  drawBolt();
  drawGround(0);
  snd('lightning', 1);
  snd('thunder', 1, 0.8);
  opts.onImpact?.();
  const tgt = opts.target;
  if (tgt?.active) tgt.setTintFill(PAL.white);
  sparks.burst(40, () => {
    const a = rr(Math.PI * 1.05, Math.PI * 1.95);
    const sp = rr(70, 260);
    return {
      x: x + rr(-3, 3),
      y: y - rr(0, 4),
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp * 0.8,
      ay: 520,
      drag: 1.2,
      life: rr(260, 640),
      ramp: [PAL.white, PAL.teal4, PAL.teal3, PAL.teal2, PAL.teal1],
      trail: true,
      tex: rnd() < 0.25 ? TEX.px2 : TEX.px1,
    };
  });
  void flash(scene, 220, PAL.white, 0.78);
  void floorRing(scene, x, y, { r0: 10, r1: 92, ms: 520, ramp: [PAL.white, PAL.teal4, PAL.teal3, PAL.teal2, PAL.teal1], depth: DEPTH.SHADOW - 1 });
  void floorRing(scene, x, y, { r0: 4, r1: 54, ms: 380, ramp: [PAL.teal4, PAL.teal3, PAL.teal2], depth: DEPTH.SHADOW - 1 });
  void shake(scene, 380, 5);
  await hitStop(scene, 85);

  // re-strikes: the bolt flickers and re-forks (anime triple-hit)
  const pattern = [1, 1, 0.4, 1, 1, 0.3, 0.9, 0.6, 0.2, 0.7, 0.3, 0.1, 0];
  void (async () => {
    for (let i = 0; i < pattern.length; i++) {
      if (i === 3 || i === 6 || i === 9) {
        newBolt();
        strikeLight = Math.max(strikeLight, 0.7);
      }
      boltI = pattern[i];
      if (tgt?.active) {
        if (pattern[i] >= 0.9) tgt.setTintFill(PAL.white);
        else if (pattern[i] >= 0.3) tgt.setTintFill(PAL.night1);
        else tgt.clearTint();
      }
      await sleep(scene, 34);
    }
    if (tgt?.active) tgt.clearTint();
    // smoke from the scorch
    smoke.burst(9, (i) => ({
      x: x + rr(-10, 10),
      y: y - rr(0, 6),
      vx: rr(-8, 8),
      vy: rr(-26, -12),
      life: rr(500, 900),
      ramp: [PAL.night4, PAL.night3, PAL.night2],
      tex: TEX.dot5,
      delay: i * 30,
      wobble: 6,
    }));
    smoke.close();
  })();

  await sleep(scene, 480);
  // main beat done — the storm keeps dissipating on its own
  void timeline.then(() => {
    stopDraw();
    for (const o of [clouds, sigil, boltR, ground]) o.destroy();
    dark.destroy();
    sparks.close();
  });
}

// ------------------------------------------------------------------ Şifa Pınarı — healingFountain

export interface FountainOpts {
  /** Where the spring erupts (default: the player's middle spell/trap zone). */
  at?: XY;
  /** Called when the first droplet reaches the panel (start the LP count-up here). */
  onArrive?: () => void;
}

const WATER_RAMP = [PAL.white, PAL.teal4, PAL.teal3, PAL.teal2, PAL.teal1];

/**
 * Healing spring (~1.45 s): ripples, then a teal geyser erupts on the player's side; a dozen
 * glowing droplets arc into the LP panel with green-gold sparkle trails and pop there.
 * Resolves when the last droplet has landed.
 */
export async function healingFountain(scene: Phaser.Scene, player: PlayerId, toXY: XY, opts: FountainOpts = {}): Promise<void> {
  const base = opts.at ?? isoToScreen(2, player === 0 ? 4 : 0);
  const x = Math.round(base.x);
  const y = Math.round(base.y);
  const H = 74;
  const geyser = new Raster(scene, x - 40, y - H - 20, 80, H + 40, unitDepth(y) + 2);
  const floor = Raster.around(scene, x, y, 120, 60, DEPTH.SHADOW - 1);
  const spray = new Sparks(scene, unitDepth(y) + 3);
  const trail = new Sparks(scene, DEPTH.HUD + 6);
  const orbs = new Sparks(scene, DEPTH.HUD + 7);
  let height = 0;
  let width = 0;
  let collapse = 0;
  let ripple = 0;
  const rings: number[] = [];

  snd('spellActivate', 0.5, 1.1);
  const stopDraw = onFrame(scene, (_dt, el) => {
    floor.draw((g) => {
      // pool + concentric ripples
      if (ripple > 0) {
        g.ell(x, y, 30 * ripple, 15 * ripple, PAL.teal1, 0.45 * ripple);
        g.ell(x, y, 24 * ripple, 12 * ripple, PAL.teal2, 0.35 * ripple);
        g.ring(x, y, 30 * ripple, 15 * ripple, PAL.teal3, ripple);
      }
      for (const born of rings) {
        const t = (el - born) / 700;
        if (t < 0 || t > 1) continue;
        const r = 6 + E.outCubic(t) * 46;
        g.ring(x, y, r, r / 2, t < 0.3 ? PAL.teal4 : t < 0.6 ? PAL.teal3 : PAL.teal2, 1 - t * t);
      }
    });
    geyser.draw((g) => {
      if (height < 1) return;
      const top = y - height * (1 - collapse);
      const reach = 26 * Math.min(1, height / H) * (1 - collapse * 0.5);
      // water curtains: parabolic sheets falling from the crown to a ring on the floor
      const curtain = (ang: number) => {
        const ex = x + Math.cos(ang) * reach;
        const ey = y + Math.sin(ang) * reach * 0.5;
        const n = 26;
        let px0 = NaN;
        let py0 = NaN;
        for (let i = 0; i <= n; i++) {
          const u = i / n;
          const px = lerp(x, ex, Math.sqrt(u));
          const py = lerp(top + 2, ey, u * u) - Math.sin(Math.PI * u) * 6;
          const flow = (u * 6 - el * 0.004 + ang) % 1;
          const c = flow < 0.18 ? PAL.white : flow < 0.6 ? PAL.teal4 : PAL.teal3;
          if (!isNaN(px0)) g.line(px0, py0, px, py, c, u > 0.85 ? 0.6 : 1);
          px0 = px;
          py0 = py;
        }
      };
      const ANG = 9;
      for (let i = 0; i < ANG; i++) {
        const ang = (i / ANG) * TAU + 0.2;
        if (Math.sin(ang) < 0) curtain(ang);
      }
      // the jet: narrow bright core, rushing streaks scroll upward
      for (let yy = Math.floor(top); yy <= y; yy++) {
        const v = (yy - top) / Math.max(1, y - top); // 0 crown → 1 base
        const hw = width * (0.45 + v * 0.35);
        const wob = Math.sin(yy * 0.35 + el * 0.03) * 0.9;
        const l = Math.round(x + wob - hw);
        const r = Math.round(x + wob + hw);
        for (let xx = l; xx <= r; xx++) {
          const u = (xx - l) / Math.max(1, r - l);
          let c: number;
          if (xx === l || xx === r) c = PAL.teal2;
          else if (u < 0.4) c = PAL.white;
          else c = PAL.teal4;
          const streak = (yy + el * 0.26 + Math.floor(u * 4) * 7) % 9;
          if (streak < 2 && xx !== l && xx !== r) c = u < 0.5 ? PAL.teal4 : PAL.teal3;
          g.px(xx, yy, c);
        }
      }
      for (let i = 0; i < ANG; i++) {
        const ang = (i / ANG) * TAU + 0.2;
        if (Math.sin(ang) >= 0) curtain(ang);
      }
      // crown of foam: churning blobs
      if (collapse < 0.7) {
        const k = 1 - collapse / 0.7;
        for (let i = 0; i < 5; i++) {
          const a = el * 0.013 + i * 1.26;
          const rr0 = (2.5 + (i % 2)) * k;
          g.disc(x + Math.cos(a) * 4 * k, top + Math.sin(a) * 1.8 * k, rr0 + 1, PAL.teal3);
        }
        for (let i = 0; i < 5; i++) {
          const a = el * 0.013 + i * 1.26;
          g.disc(x + Math.cos(a) * 4 * k - 0.5, top - 0.5 + Math.sin(a) * 1.8 * k, (2 + (i % 2)) * k, i % 2 ? PAL.white : PAL.teal4);
        }
      }
      // churning foam where the curtains land + at the base
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + el * 0.002;
        const rr0 = reach * (0.9 + 0.15 * Math.sin(el * 0.02 + i * 2.1));
        const fx = x + Math.cos(a) * rr0;
        const fy = y + Math.sin(a) * rr0 * 0.5;
        g.disc(fx, fy - 1, 1.6, Math.sin(el * 0.03 + i) > 0 ? PAL.white : PAL.teal4, Math.sin(a) >= 0 ? 1 : 0.7);
      }
      g.ell(x, y - 1, width * 1.6, width * 0.7, PAL.teal4, 1);
      g.ell(x - 1, y - 2, width * 0.9, width * 0.4, PAL.white, 1);
    });
  });

  // ---- 0–220: the ground trembles, ripples open
  rings.push(0, 120, 240);
  void run(scene, 220, (t) => (ripple = E.outQuad(t)));
  spray.burst(10, (i) => ({ x: x + rr(-8, 8), y: y - 1, vx: rr(-20, 20), vy: rr(-90, -40), ay: 360, life: rr(300, 450), ramp: WATER_RAMP, delay: i * 18 }));
  await sleep(scene, 220);

  // ---- 220: eruption
  snd('waterSplash', 0.9, 1.1);
  void shake(scene, 160, 1);
  rings.push(260, 420);
  void floorRing(scene, x, y, { r0: 6, r1: 56, ms: 420, ramp: [PAL.white, PAL.teal4, PAL.teal3, PAL.teal2], depth: DEPTH.SHADOW - 1 });
  void run(scene, 300, (t) => {
    height = H * E.outBack(t);
    width = 4 + 2 * E.outCubic(t);
  });
  // spray off the crown for the whole column life
  const sprayStop = onFrame(scene, (dt, el) => {
    if (collapse > 0.5) return false;
    const n = dt > 0 ? 3 : 0;
    for (let i = 0; i < n; i++) {
      const top = y - height * (1 - collapse);
      const a = rr(0, TAU);
      const sp = rr(30, 80);
      spray.add({ x: x + rr(-3, 3), y: top + rr(-2, 3), vx: Math.cos(a) * sp, vy: rr(-80, -25) + Math.sin(a) * 10, ay: 380, life: rr(420, 700), ramp: WATER_RAMP, tex: rnd() < 0.35 ? TEX.px2 : TEX.px1, trail: rnd() < 0.4 });
    }
    if (dt > 0 && rnd() < 0.5) {
      const a = rr(0, TAU);
      spray.add({ x: x + Math.cos(a) * 26, y: y + Math.sin(a) * 13, vx: Math.cos(a) * 20, vy: rr(-50, -20), ay: 300, life: rr(200, 360), ramp: WATER_RAMP });
    }
    return el < 2000;
  });
  await sleep(scene, 280);

  // ---- 500: droplets launch toward the LP panel
  const N = 12;
  let landed = 0;
  let first = true;
  const done = new Promise<void>((resolve) => {
    for (let i = 0; i < N; i++) {
      void (async () => {
        await sleep(scene, i * 45);
        const from = { x: x + rr(-5, 5), y: y - height + rr(0, 8) };
        const side = toXY.x < from.x ? -1 : 1;
        const ctrl = { x: lerp(from.x, toXY.x, 0.35) + rr(-30, 30) * side, y: Math.min(from.y, toXY.y) - rr(50, 90) };
        const dest = { x: toXY.x + rr(-14, 14), y: toXY.y + rr(-6, 6) };
        const head = scene.add.image(from.x, from.y, TEX.dot5).setTint(PAL.teal4).setDepth(DEPTH.HUD + 8);
        const core = scene.add.image(from.x, from.y, TEX.px1).setTint(PAL.white).setDepth(DEPTH.HUD + 9);
        const dur = rr(480, 620);
        await run(scene, dur, (t) => {
          const k = E.inOutSine(t);
          const p = qbez(from, ctrl, dest, k);
          head.setPosition(Math.round(p.x), Math.round(p.y));
          core.setPosition(Math.round(p.x) - 1, Math.round(p.y) - 1);
          if (rnd() < 0.7) trail.add({ x: p.x + rr(-2, 2), y: p.y + rr(-2, 2), vy: rr(-12, 4), life: rr(200, 360), ramp: [PAL.white, PAL.gold4, PAL.leaf3, PAL.leaf2], flicker: true });
        });
        head.destroy();
        core.destroy();
        orbs.burst(7, (k) => {
          const a = (k / 7) * TAU;
          return { x: dest.x, y: dest.y, vx: Math.cos(a) * 55, vy: Math.sin(a) * 55, drag: 5, life: 280, ramp: [PAL.white, PAL.leaf4, PAL.leaf3, PAL.gold3], tex: k % 2 ? TEX.plus : TEX.px1 };
        });
        snd('heal', 0.35, 1 + i * 0.05);
        if (first) {
          first = false;
          opts.onArrive?.();
          void panelGlow(scene, player, [PAL.white, PAL.teal4, PAL.leaf3, PAL.teal2]);
        }
        if (++landed === N) resolve();
      })();
    }
  });

  // ---- 700–1150: the column collapses back into the pool
  await sleep(scene, 380);
  await run(scene, 420, (t) => (collapse = E.inQuad(t)));
  height = 0;
  sprayStop();
  void run(scene, 500, (t) => (ripple = 1 - t));
  await done;
  void sleep(scene, 600).then(() => {
    stopDraw();
    geyser.destroy();
    floor.destroy();
    spray.close();
    trail.close();
    orbs.close();
  });
}

/** Glowing frame pulse around a player's LP panel (HUD depth). */
export function panelGlow(scene: Phaser.Scene, player: PlayerId, ramp: readonly number[], ms = 520): Promise<void> {
  const rect = player === 0 ? { x: 4, y: 292, w: 148, h: 64 } : { x: 488, y: 4, w: 148, h: 64 };
  const ras = new Raster(scene, rect.x - 10, rect.y - 10, rect.w + 20, rect.h + 20, DEPTH.HUD + 5);
  return run(scene, ms, (t) => {
    ras.draw((g) => {
      const grow = Math.round(E.outCubic(t) * 7);
      const col = rampAt(ramp, t * ramp.length);
      const lv = 1 - t;
      const x0 = rect.x - grow;
      const y0 = rect.y - grow;
      const w = rect.w + grow * 2;
      const h = rect.h + grow * 2;
      g.rect(x0, y0, w, 1, col, lv);
      g.rect(x0, y0 + h - 1, w, 1, col, lv);
      g.rect(x0, y0, 1, h, col, lv);
      g.rect(x0 + w - 1, y0, 1, h, col, lv);
      if (t < 0.3) g.rect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2, rampAt(ramp, 1), 0.18 * (1 - t / 0.3));
    });
  }).then(() => ras.destroy());
}

// ------------------------------------------------------------------ Ruh Çağrısı — ghostRise

const GHOST_RAMP = [PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white];

/** Spectral recolor of a monster's idle frames (cached texture `set:ghost:<id>`, anim same key). */
export function ghostTexture(scene: Phaser.Scene, id: MonsterId): { key: string; frames: number; fps: number; art: { w: number; h: number; anchorX: number; anchorY: number } } | null {
  const key = `set:ghost:${id}`;
  let art;
  try {
    art = monsterArt(id);
  } catch {
    return null;
  }
  const spec = art.anims.idle;
  if (!scene.textures.exists(key)) {
    try {
      const frames = spec.frames;
      const sheet = new PixelCanvas(art.w * frames, art.h);
      for (let f = 0; f < frames; f++) {
        const src = monsterFrame(id, 'idle', f);
        const b = src.bounds();
        if (!b) continue;
        for (let yy = 0; yy < art.h; yy++) {
          // wispy tail: the lower body dissolves
          const v = (yy - b.y) / Math.max(1, b.h);
          const keep = v < 0.55 ? 1 : 1 - (v - 0.55) / 0.5;
          const shift = Math.round(Math.sin(yy * 0.45 + f * 1.3) * (v > 0.5 ? 1 : 0));
          for (let xx = 0; xx < art.w; xx++) {
            const c = src.get(xx, yy);
            if (c === null) continue;
            if (bayer(xx, yy) > keep) continue;
            const r = (c >> 16) & 255;
            const g = (c >> 8) & 255;
            const bl = c & 255;
            const lum = (r * 0.3 + g * 0.55 + bl * 0.15) / 255;
            const col = c === PAL.ink ? PAL.cyan0 : rampAt(GHOST_RAMP, Math.min(4.99, lum * 5.4));
            sheet.set(f * art.w + xx + shift, yy, col);
          }
        }
      }
      const tex = scene.textures.addCanvas(key, sheet.toCanvas())!;
      for (let f = 0; f < frames; f++) tex.add(`g${f}`, 0, f * art.w, 0, art.w, art.h);
      if (!scene.anims.exists(key)) {
        scene.anims.create({ key, frames: Array.from({ length: frames }, (_, f) => ({ key, frame: `g${f}` })), frameRate: spec.fps, repeat: -1 });
      }
    } catch (e) {
      console.warn('[vfx-set] ghost texture failed', e);
      return null;
    }
  }
  return { key, frames: spec.frames, fps: spec.fps, art: { w: art.w, h: art.h, anchorX: art.anchorX, anchorY: art.anchorY } };
}

export interface GhostOpts {
  /** Owner of the revived monster (facing). Default: inferred from the target tile's side. */
  player?: PlayerId;
}

/**
 * Soul recall (~1.5 s): the graveyard glows, a translucent cyan ghost of the monster rises out
 * of the ground, floats in an arc (afterimages + ectoplasm) to the target tile and hovers there.
 * Resolves on arrival; the ghost then dissolves over ~300 ms (start the summon pillar on resolve).
 */
export async function ghostRise(scene: Phaser.Scene, fromXY: XY, toXY: XY, monsterId: MonsterId, opts: GhostOpts = {}): Promise<void> {
  const player: PlayerId = opts.player ?? (screenToIso(toXY.x, toXY.y).row > 2 ? 0 : 1);
  const flip = player === 1;
  const gx = Math.round(fromXY.x);
  const gy = Math.round(fromXY.y);
  const tex = ghostTexture(scene, monsterId);
  const mist = new Sparks(scene, DEPTH.FX + 1);
  const back = new Sparks(scene, unitDepth(gy) - 1);
  const grave = Raster.around(scene, gx, gy, 100, 120, DEPTH.SHADOW - 1);
  const pillar = new Raster(scene, gx - 14, gy - 90, 28, 94, unitDepth(gy) - 2, ADD);
  const dest = Raster.around(scene, toXY.x, toXY.y, 90, 50, DEPTH.SHADOW - 1);
  let graveOn = 0;
  let destOn = 0;
  let pillarOn = 0;

  const stopDraw = onFrame(scene, (_dt, el) => {
    grave.draw((g) => {
      if (graveOn <= 0.01) return;
      const r = 20 + Math.sin(el * 0.01) * 1.5;
      g.ell(gx, gy, r, r / 2, PAL.cyan1, 0.5 * graveOn);
      g.ring(gx, gy, r, r / 2, PAL.cyan3, graveOn);
      g.ring(gx, gy, r * 0.6, r * 0.3, PAL.cyan4, graveOn * 0.8);
      for (let i = 0; i < 6; i++) {
        const a = el * 0.003 + (i / 6) * TAU;
        g.disc(gx + Math.cos(a) * r * 0.8, gy + Math.sin(a) * r * 0.4, 1, PAL.white, graveOn);
      }
    });
    pillar.draw((g) => {
      if (pillarOn <= 0.01) return;
      for (let yy = gy - 88; yy < gy; yy++) {
        const v = (gy - yy) / 88;
        const hw = 7 * (1 - v * 0.6) * pillarOn;
        g.rect(gx - hw, yy, hw * 2, 1, PAL.cyan1, (1 - v) * pillarOn);
        g.rect(gx - hw * 0.45, yy, hw * 0.9, 1, PAL.cyan3, (1 - v) * pillarOn * 0.8);
      }
    });
    dest.draw((g) => {
      if (destOn <= 0.01) return;
      const r = 24 - destOn * 4 + Math.sin(el * 0.012) * 1;
      g.ring(toXY.x, toXY.y, r, r / 2, PAL.cyan3, destOn);
      g.ring(toXY.x, toXY.y, r + 4, r / 2 + 2, PAL.cyan1, destOn * 0.6);
      g.ell(toXY.x, toXY.y, r * 0.7, r * 0.35, PAL.cyan1, destOn * 0.35);
    });
  });

  snd('revive', 0.8);
  // ---- 0–250: the grave lights up, spirit flames lick upward
  void run(scene, 250, (t) => {
    graveOn = E.outQuad(t);
    pillarOn = E.outQuad(t) * 0.8;
  });
  const flames = onFrame(scene, (dt, el) => {
    if (dt > 0 && rnd() < 0.6)
      back.add({ x: gx + rr(-14, 14), y: gy + rr(-3, 3), vy: rr(-40, -20), wobble: 10, life: rr(400, 700), ramp: [PAL.cyan4, PAL.cyan3, PAL.cyan2, PAL.cyan1], tex: rnd() < 0.3 ? TEX.px2 : TEX.px1 });
    return el < 1200;
  });
  await sleep(scene, 200);

  // ---- 200–650: the ghost rises out of the ground
  let ghost: Phaser.GameObjects.Sprite | null = null;
  let glow: Phaser.GameObjects.Sprite | null = null;
  const fh = tex?.art.h ?? 48;
  if (tex) {
    const ox = (flip ? tex.art.w - tex.art.anchorX : tex.art.anchorX) / tex.art.w;
    const oy = tex.art.anchorY / tex.art.h;
    ghost = scene.add.sprite(gx, gy + fh, tex.key, 'g0').setOrigin(ox, oy).setFlipX(flip).setAlpha(0.8).setDepth(DEPTH.FX);
    glow = scene.add.sprite(gx, gy + fh, tex.key, 'g0').setOrigin(ox, oy).setFlipX(flip).setAlpha(0.22).setDepth(DEPTH.FX + 0.5).setBlendMode(ADD);
    ghost.play(tex.key);
    glow.play(tex.key);
  }
  const place = (x: number, y: number, ground: number | null) => {
    for (const s of [ghost, glow]) {
      if (!s) continue;
      s.setPosition(Math.round(x), Math.round(y));
      if (ground !== null) {
        const visible = fh - Math.max(0, y - ground);
        s.setCrop(0, 0, tex!.art.w, Math.max(0, Math.round(tex!.art.anchorY - (y - ground))));
        if (visible <= 0) s.setVisible(false);
        else s.setVisible(true);
      } else s.setCrop();
    }
  };
  const lift = 26;
  await run(scene, 450, (t, el) => {
    const k = E.outCubic(t);
    const yy = gy + (1 - k) * (fh * 0.9) - k * lift;
    place(gx + Math.sin(el * 0.012) * 1.5, yy, gy);
    if (rnd() < 0.5) mist.add({ x: gx + rr(-10, 10), y: gy - rr(0, 4), vy: rr(-30, -10), life: rr(300, 500), ramp: [PAL.white, PAL.cyan4, PAL.cyan3], flicker: true });
  });
  place(gx, gy - lift, null);
  void run(scene, 300, (t) => (pillarOn = 0.8 * (1 - t)));

  // ---- 650–1300: float in an arc to the target tile, afterimages trailing
  const start = { x: gx, y: gy - lift };
  const end = { x: toXY.x, y: toXY.y - 18 };
  const ctrl = { x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) - 60 };
  void run(scene, 300, (t) => (destOn = E.outQuad(t)));
  let lastEcho = -999;
  snd('whoosh', 0.4, 0.7);
  await run(scene, 640, (t, el) => {
    const k = E.inOutSine(t);
    const p = qbez(start, ctrl, end, k);
    const bob = Math.sin(el * 0.02) * 1.5;
    place(p.x, p.y + bob, null);
    if (ghost && el - lastEcho > 55) {
      lastEcho = el;
      const echo = scene.add.image(ghost.x, ghost.y, ghost.texture.key, ghost.frame.name).setOrigin(ghost.originX, ghost.originY).setFlipX(flip).setAlpha(0.4).setTint(PAL.cyan2).setDepth(DEPTH.FX - 1).setBlendMode(ADD);
      void run(scene, 260, (u) => echo.setAlpha(0.4 * (1 - u) > 0.2 ? 0.4 * (1 - u) : u < 0.85 ? 0.12 : 0)).then(() => echo.destroy());
    }
    mist.add({ x: p.x + rr(-8, 8), y: p.y - rr(0, fh * 0.5), vx: rr(-10, 10), vy: rr(-12, 6), life: rr(300, 520), ramp: [PAL.cyan4, PAL.cyan3, PAL.cyan2], flicker: true });
  });
  graveOn = 0;
  flames();

  // ---- arrival: a soft settle and a cyan flare on the tile
  await run(scene, 160, (t) => place(end.x, end.y + E.outBack(t) * 6 - 6 + 6 * t, null));
  void floorRing(scene, toXY.x, toXY.y, { r0: 8, r1: 44, ms: 380, ramp: [PAL.white, PAL.cyan4, PAL.cyan3, PAL.cyan2], depth: DEPTH.SHADOW - 1 });
  mist.burst(14, (i) => {
    const a = (i / 14) * TAU;
    return { x: toXY.x + Math.cos(a) * 6, y: toXY.y - 10 + Math.sin(a) * 3, vx: Math.cos(a) * 60, vy: Math.sin(a) * 25 - 20, drag: 3, life: 380, ramp: [PAL.white, PAL.cyan4, PAL.cyan3], tex: TEX.plus };
  });

  // main beat done: the ghost dissolves upward while the caller materializes the monster
  void (async () => {
    await run(scene, 320, (t) => {
      const a = t < 0.33 ? 0.85 : t < 0.66 ? 0.5 : 0.2;
      ghost?.setAlpha(a).setY(Math.round(end.y - t * 10));
      glow?.setAlpha(a * 0.4).setY(Math.round(end.y - t * 10));
      destOn = 1 - t;
    });
    ghost?.destroy();
    glow?.destroy();
    stopDraw();
    grave.destroy();
    pillar.destroy();
    dest.destroy();
    mist.close();
    back.close();
  })();
}

// ------------------------------------------------------------------ Ejder Kılıcı — swordForge

export interface AuraHandle {
  /** Fade the aura out (~300 ms) and clean up. Safe to call more than once. */
  destroy(): void;
}

/**
 * Persistent golden equip aura around a monster: rising gold motes hugging its silhouette and a
 * pulsing ring at its feet. Follows the sprite; dies with it. Returned by swordForge.
 */
export function goldAura(scene: Phaser.Scene, target: Unit): AuraHandle {
  const front = new Sparks(scene, unitDepth(target.y) + 1);
  const behind = new Sparks(scene, unitDepth(target.y) - 1);
  const ring = Raster.around(scene, target.x, target.y, 80, 40, DEPTH.SHADOW - 1);
  let level = 0;
  let dying = false;
  let acc = 0;
  const stop = onFrame(scene, (dt, el) => {
    if (!target.active || !alive(scene)) {
      kill();
      return false;
    }
    level = dying ? Math.max(0, level - dt / 300) : Math.min(1, level + dt / 400);
    const vis = target.visible && target.alpha > 0.3;
    front.depth = unitDepth(target.y) + 1;
    behind.depth = unitDepth(target.y) - 1;
    ring.moveTo(Math.round(target.x - 40), Math.round(target.y - 20));
    const b = spriteBox(scene, target);
    ring.draw((g) => {
      if (!vis || level <= 0.02) return;
      const pulse = 0.5 + 0.5 * Math.sin(el * 0.005);
      const r = Math.max(14, b.w * 0.45) + pulse * 2;
      g.ring(target.x, target.y, r, r / 2, PAL.gold3, level * (0.55 + pulse * 0.45));
      g.ring(target.x, target.y, r + 3, r / 2 + 1.5, PAL.gold1, level * 0.5);
    });
    acc += dt;
    while (vis && !dying && acc > 55) {
      acc -= 55;
      const yy = lerp(b.bottom - 2, b.top + b.h * 0.25, rnd());
      const sp = b.spanAt(yy);
      if (!sp) continue;
      const sideRight = rnd() < 0.5;
      const xx = sideRight ? sp[1] + rr(-1, 2) : sp[0] - rr(-1, 2);
      const sys = rnd() < 0.55 ? front : behind;
      sys.add({ x: xx, y: yy, vx: (sideRight ? 1 : -1) * rr(2, 8), vy: rr(-34, -18), wobble: 6, life: rr(500, 900), ramp: [PAL.gold4, PAL.gold3, PAL.gold3, PAL.gold2, PAL.gold1], tex: rnd() < 0.18 ? TEX.plus : TEX.px1, flicker: rnd() < 0.3 });
    }
    if (dying && level <= 0) {
      kill();
      return false;
    }
    return true;
  });
  let killed = false;
  const kill = () => {
    if (killed) return;
    killed = true;
    stop();
    ring.destroy();
    front.close();
    behind.close();
  };
  return {
    destroy() {
      dying = true;
    },
  };
}

/**
 * Dragon blade (~1.5 s): gold runes orbit above the monster, converge into a blade that draws
 * itself, spins twice, hangs (anticipation) and plunges into the monster — hit-stop, gold flash,
 * ring burst. Resolves with the persistent aura handle (call destroy() when the equip leaves).
 */
export async function swordForge(scene: Phaser.Scene, target: Unit): Promise<AuraHandle> {
  const b0 = spriteBox(scene, target);
  const ax = Math.round(b0.cx);
  const SW = 15;
  const SH = 46;
  const hoverY = Math.round(b0.top - 34); // sword center while forging
  const circleY = hoverY - 4;
  const runes: Phaser.GameObjects.Image[] = [];
  const sparks = new Sparks(scene, DEPTH.FX + 3);
  const halo = Raster.around(scene, ax, circleY, 110, 60, DEPTH.FX + 1);
  const sword = scene.add.image(ax, hoverY, 'set:sword').setDepth(DEPTH.FX + 2).setVisible(false);
  const glint = Raster.around(scene, ax, hoverY, 40, 70, DEPTH.FX + 3);
  let circleOn = 0;
  let spin = 0;
  let glintT = -1;
  const stopDraw = onFrame(scene, (_dt, el) => {
    halo.draw((g) => {
      if (circleOn <= 0.01) return;
      const r = 30 + (1 - circleOn) * 10;
      g.ring(ax, circleY, r, r * 0.32, PAL.gold3, circleOn);
      g.ring(ax, circleY, r - 4, r * 0.32 - 1.3, PAL.gold1, circleOn * 0.8);
      for (let i = 0; i < 12; i++) {
        const a = el * 0.002 + (i / 12) * TAU;
        g.px(ax + Math.cos(a) * (r + 3), circleY + Math.sin(a) * (r * 0.32 + 1), PAL.gold4, circleOn);
      }
    });
    glint.moveTo(sword.x - 20, sword.y - 35);
    glint.draw((g) => {
      if (glintT < 0 || glintT > 1 || !sword.visible) return;
      // diagonal shine sweeping down the blade
      const yy = sword.y - SH / 2 + glintT * (SH + 8);
      for (let i = -3; i <= 3; i++) g.px(sword.x + i, yy + i * 0.5 - 2, i === 0 ? PAL.white : PAL.gold4, i === 0 ? 1 : 0.6);
    });
  });

  snd('equip', 0.6, 0.8);
  // ---- 0–380: rune circle, runes pop in one by one
  void run(scene, 260, (t) => (circleOn = E.outCubic(t)));
  const NR = 8;
  for (let i = 0; i < NR; i++) {
    const img = scene.add.image(ax, circleY, 'set:rune', `r${i}`).setDepth(DEPTH.FX + 2).setVisible(false);
    runes.push(img);
  }
  const runePos = (i: number, el: number, r = 30): XY => {
    const a = el * 0.0028 + (i / NR) * TAU;
    return { x: ax + Math.cos(a) * r, y: circleY + Math.sin(a) * r * 0.32 - 3 };
  };
  let el0 = 0;
  const orbit = onFrame(scene, (_dt, el) => {
    el0 = el;
    runes.forEach((r, i) => {
      if (r.getData('free')) return;
      const p = runePos(i, el);
      r.setPosition(Math.round(p.x), Math.round(p.y));
      r.setDepth(Math.sin(el * 0.0028 + (i / NR) * TAU) > 0 ? DEPTH.FX + 2 : DEPTH.FX);
    });
  });
  for (let i = 0; i < NR; i++) {
    void (async () => {
      await sleep(scene, 40 + i * 36);
      const r = runes[i];
      r.setVisible(true).setTintFill(PAL.white);
      sparks.add({ x: r.x, y: r.y, life: 120, ramp: [PAL.white, PAL.gold4, PAL.gold3], tex: TEX.spark });
      snd('holyChime', 0.2, 1 + i * 0.07);
      await sleep(scene, 50);
      r.clearTint();
    })();
  }
  await sleep(scene, 400);

  // ---- 400–640: runes converge into a vertical line — the blade's spine
  orbit();
  const spine = (i: number): XY => ({ x: ax, y: hoverY - SH / 2 + 4 + (i / (NR - 1)) * (SH - 10) });
  const starts = runes.map((r) => ({ x: r.x, y: r.y }));
  runes.forEach((r) => r.setData('free', true));
  await run(scene, 220, (t) => {
    const k = E.inCubic(t);
    runes.forEach((r, i) => {
      const p = spine(i);
      r.setPosition(Math.round(lerp(starts[i].x, p.x, k)), Math.round(lerp(starts[i].y, p.y, k)));
    });
  });
  runes.forEach((r) => r.destroy());
  snd('summonBurst', 0.4, 1.3);
  // ---- 640: the blade draws itself top → bottom (white), then cools to gold
  sword.setVisible(true).setTintFill(PAL.white);
  await run(scene, 90, (t) => sword.setCrop(0, 0, SW, Math.ceil(SH * t)));
  sword.setCrop();
  sparks.burst(16, (i) => {
    const yy = hoverY - SH / 2 + rnd() * SH;
    return { x: ax + rr(-3, 3), y: yy, vx: rr(-70, 70), vy: rr(-40, 20), drag: 4, life: rr(240, 420), ramp: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2], tex: i % 4 === 0 ? TEX.plus : TEX.px1 };
  });
  sword.setTintFill(PAL.gold4);
  await sleep(scene, 34);
  sword.clearTint();
  glintT = 0;
  void run(scene, 220, (t) => (glintT = t)).then(() => (glintT = -1));

  // ---- 760–1120: spin twice while rising
  snd('whoosh', 0.35, 1.4);
  await run(scene, 380, (t) => {
    spin = E.outCubic(t) * TAU * 2;
    const c = Math.cos(spin);
    sword.setScale(Math.max(0.14, Math.abs(c)), 1).setFlipX(c < 0);
    if (Math.abs(c) < 0.3) sword.setTintFill(PAL.gold4);
    else sword.clearTint();
    sword.setY(Math.round(hoverY - E.outQuad(t) * 8));
    if (rnd() < 0.5) sparks.add({ x: ax + rr(-6, 6), y: sword.y + rr(-20, 20), vy: rr(10, 30), life: 300, ramp: [PAL.gold4, PAL.gold3, PAL.gold2], flicker: true });
  });
  sword.setScale(1).setFlipX(false).clearTint();
  void run(scene, 200, (t) => (circleOn = 1 - t));

  // ---- anticipation: hang, tip glint
  const topY = sword.y;
  await run(scene, 120, (t) => sword.setY(Math.round(topY - E.outQuad(t) * 5)));
  sparks.add({ x: ax, y: sword.y + SH / 2 - 1, life: 140, ramp: [PAL.white, PAL.gold4], tex: TEX.spark, scale: 2 });

  // ---- plunge
  const b = spriteBox(scene, target);
  const stabY = Math.round(b.top + b.h * 0.45 - SH / 2 + 6);
  const fromY = sword.y;
  snd('whoosh', 0.6, 1.8);
  await run(scene, 100, (t) => sword.setY(Math.round(lerp(fromY, stabY, E.inQuad(t)))));
  // impact
  snd('equip', 1);
  snd('impactLight', 0.6, 1.2);
  if (target.active) target.setTintFill(PAL.white);
  void floorRing(scene, target.x, target.y, { r0: 8, r1: 60, ms: 460, ramp: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2, PAL.gold1], depth: DEPTH.SHADOW - 1 });
  sparks.burst(26, () => {
    const a = rr(0, TAU);
    const sp = rr(60, 170);
    return { x: ax, y: stabY + SH / 2 - 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 40, ay: 260, drag: 1.5, life: rr(300, 600), ramp: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2, PAL.gold1], trail: true };
  });
  void shake(scene, 160, 2);
  await hitStop(scene, 60);
  // the monster drinks the gold: white frame → gold silhouette → additive gold glow fading out
  void (async () => {
    await sleep(scene, 34);
    if (target.active) target.setTintFill(PAL.gold4);
    await sleep(scene, 34);
    if (target.active) target.clearTint();
    await addGlow(scene, target, PAL.gold3, 520, 0.9);
  })();
  // the blade sinks into the body and vanishes in a column of light
  const column = Raster.around(scene, ax, b.top + b.h / 2 - 20, 30, b.h + 60, DEPTH.FX + 1, ADD);
  await run(scene, 260, (t) => {
    sword.setY(Math.round(stabY + t * 10));
    sword.setAlpha(t < 0.4 ? 1 : t < 0.7 ? 0.6 : 0.25);
    column.draw((g) => {
      const hw = 5 * (1 - t);
      g.rect(ax - hw, column.y, hw * 2, column.h, PAL.gold2, 1 - t);
      g.rect(ax - hw / 3, column.y, (hw * 2) / 3, column.h, PAL.gold4, 1 - t);
    });
  });
  column.destroy();
  sword.destroy();
  stopDraw();
  halo.destroy();
  glint.destroy();
  sparks.close();
  return goldAura(scene, target);
}

// ------------------------------------------------------------------ Volkan Arenası — ambience

interface Volcano {
  level: number;
  target: number;
  stop: () => void;
  objs: Array<{ destroy(): void }>;
  waiters: Array<() => void>;
}
const volcanoes = new WeakMap<Phaser.Scene, Volcano>();

interface Mote {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ph: number;
  kind: 'ember' | 'emberFar' | 'rise' | 'ash';
  life: number;
  age: number;
}

/**
 * Volcano field overlay: blood-red sky glow, lava light from below, falling embers (two depth
 * layers), rising sparks, tumbling ash and rising heat lines. Fades in/out over ~1.2 s and
 * persists in between (one per scene). setVolcanoAmbience(scene, false) fades it away.
 * The lava floor itself belongs to the board view (BoardView.setTheme('volcano')).
 */
export function setVolcanoAmbience(scene: Phaser.Scene, on: boolean): Promise<void> {
  let v = volcanoes.get(scene);
  if (!v) {
    if (!on) return Promise.resolve();
    v = buildVolcano(scene);
    volcanoes.set(scene, v);
  }
  const vv = v;
  vv.target = on ? 1 : 0;
  snd("fieldChange", on ? 0.6 : 0.3, on ? 0.8 : 1.2);
  return new Promise<void>((resolve) => vv.waiters.push(resolve));
}

/** True while a volcano ambience exists in the scene (fading in, on, or fading out). */
export function volcanoAmbienceOn(scene: Phaser.Scene): boolean {
  return volcanoes.has(scene);
}

function buildVolcano(scene: Phaser.Scene): Volcano {
  // static dithered gradients (built once, alpha-faded)
  const sky = new Raster(scene, 0, 0, GAME_W, 190, DEPTH.STADIUM + 4, ADD);
  sky.draw((g) => {
    for (let yy = 0; yy < 190; yy++) {
      const t = yy / 190;
      const band = t < 0.35 ? PAL.crim1 : t < 0.7 ? PAL.fire1 : PAL.fire0;
      const lv = 1 - t * 0.85;
      for (let xx = 0; xx < GAME_W; xx++) {
        const wave = Math.sin(xx * 0.02) * 0.08 + Math.sin(xx * 0.051 + 1) * 0.05;
        g.dpx(xx, yy, band, lv * (0.85 + wave));
      }
    }
  });
  const low = new Raster(scene, 0, 200, GAME_W, 160, DEPTH.PLATFORM - 1, ADD);
  low.draw((g) => {
    for (let yy = 200; yy < 360; yy++) {
      const t = (yy - 200) / 160;
      for (let xx = 0; xx < GAME_W; xx++) {
        const d = Math.abs(xx - 320) / 320;
        g.dpx(xx, yy, t > 0.5 ? PAL.fire1 : PAL.crim0, (0.25 + t * 0.6) * (1 - d * 0.6));
      }
    }
  });
  // a faint warm wash over the whole field (under units) so the scene reads hot
  const wash = scene.add.rectangle(0, 0, GAME_W, GAME_H, PAL.fire1, 1).setOrigin(0).setDepth(DEPTH.SHADOW - 3).setBlendMode(ADD).setAlpha(0);
  sky.img.setAlpha(0);
  low.img.setAlpha(0);

  const motes: Mote[] = [];
  const heat: Raster[] = [];
  const heatState: { x: number; y: number; age: number; life: number; w: number; ph: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const r = new Raster(scene, 0, 0, 72, 7, DEPTH.SHADOW - 2, ADD);
    heat.push(r);
    heatState.push({ x: rr(120, 520), y: rr(150, 300), age: rr(0, 1800), life: rr(1500, 2200), w: rr(40, 70), ph: rr(0, TAU) });
  }
  const spawn = (kind: Mote['kind'], init: boolean): Mote => {
    const far = kind === 'emberFar';
    const img = scene.add.image(0, 0, kind === 'ash' ? (rnd() < 0.5 ? TEX.px2 : TEX.px1) : TEX.px1).setDepth(far ? DEPTH.STADIUM + 6 : kind === 'ash' ? DEPTH.FX - 2 : DEPTH.FX - 1);
    const m: Mote = {
      img,
      kind,
      x: rr(-20, GAME_W + 40),
      y: kind === 'rise' ? GAME_H + rr(0, 20) : rr(-30, -4),
      vx: kind === 'ash' ? rr(-14, -4) : far ? rr(-18, -8) : rr(-34, -14),
      vy: kind === 'rise' ? rr(-60, -28) : kind === 'ash' ? rr(9, 18) : far ? rr(16, 26) : rr(30, 52),
      ph: rr(0, TAU),
      life: rr(5000, 9000),
      age: 0,
    };
    if (init) m.y = rr(0, GAME_H);
    if (kind === 'ash') img.setTint(rnd() < 0.5 ? PAL.stone2 : PAL.stone3);
    return m;
  };
  const counts: Record<Mote['kind'], number> = { ember: 26, emberFar: 22, rise: 10, ash: 30 };
  const v: Volcano = {
    level: 0,
    target: 1,
    waiters: [],
    objs: [sky, low, wash, ...heat],
    stop: () => undefined,
  };
  let reported = -1;
  v.stop = onFrame(scene, (dt, el) => {
    const s = dt / 1000;
    if (v.level < v.target) v.level = Math.min(v.target, v.level + dt / 1200);
    else if (v.level > v.target) v.level = Math.max(v.target, v.level - dt / 1200);
    const L = v.level;
    sky.img.setAlpha(L * 0.95);
    low.img.setAlpha(L * 0.8);
    wash.setAlpha(L * (0.06 + 0.02 * Math.sin(el * 0.004)));
    // keep the particle population proportional to the level
    for (const kind of Object.keys(counts) as Mote['kind'][]) {
      const want = Math.round(counts[kind] * L);
      const have = motes.filter((m) => m.kind === kind).length;
      if (have < want && v.target > 0) motes.push(spawn(kind, el < 50));
    }
    for (let i = motes.length - 1; i >= 0; i--) {
      const m = motes[i];
      m.age += dt;
      const sway = Math.sin(m.ph + el * (m.kind === 'ash' ? 0.003 : 0.005)) * (m.kind === 'ash' ? 10 : 6);
      m.x += (m.vx + sway) * s;
      m.y += m.vy * s;
      const out = m.y > GAME_H + 30 || m.y < -40 || m.x < -40;
      if (out || (v.target === 0 && rnd() < dt / 900)) {
        m.img.destroy();
        motes.splice(i, 1);
        continue;
      }
      let c: number;
      let a = 1;
      if (m.kind === 'ash') {
        c = m.img.tintTopLeft;
        a = 0.85;
        if (dt > 0 && rnd() < 0.04) m.img.setTexture(m.img.texture.key === TEX.px2 ? TEX.px1 : TEX.px2);
      } else {
        const f = Math.sin(m.ph * 3 + el * 0.02) * 0.5 + 0.5;
        if (m.kind === 'emberFar') {
          c = f > 0.6 ? PAL.fire3 : PAL.fire2;
          a = 0.7;
        } else c = f > 0.8 ? PAL.fire4 : f > 0.3 ? PAL.fire3 : PAL.fire2;
      }
      m.img.setPosition(Math.round(m.x), Math.round(m.y)).setTint(c).setAlpha(a * Math.min(1, L * 1.5));
    }
    // heat lines: faint sine strokes rising off the hot floor
    heat.forEach((r, i) => {
      const h = heatState[i];
      h.age += dt;
      if (h.age > h.life) Object.assign(h, { x: rr(120, 520), y: rr(160, 300), age: 0, life: rr(1500, 2200), w: rr(40, 70), ph: rr(0, TAU) });
      const t = h.age / h.life;
      const yy = h.y - t * 30;
      r.moveTo(h.x - 36, yy - 3);
      r.draw((g) => {
        const lv = Math.sin(t * Math.PI) * L * 0.55;
        if (lv < 0.05) return;
        for (let k = 0; k < h.w; k++) {
          const xx = h.x - h.w / 2 + k;
          const edge = Math.min(1, Math.min(k, h.w - k) / 10);
          g.dpx(xx, yy + Math.sin(h.ph + k * 0.25 + el * 0.006) * 1.6, PAL.fire2, lv * edge);
        }
      });
    });
    // settle notifications
    if (v.level === v.target && reported !== v.target) {
      reported = v.target;
      const ws = v.waiters.splice(0);
      ws.forEach((w) => w());
      if (v.target === 0) {
        for (const m of motes) m.img.destroy();
        motes.length = 0;
        v.objs.forEach((o) => o.destroy());
        volcanoes.delete(scene);
        return false;
      }
    }
    if (v.level !== v.target) reported = -1;
    return true;
  });
  return v;
}

// =================================================================================== 3. EFFECT DELIVERIES

/** The palette ramp (dark → light) that contains `color`, or a synthetic one around it. */
export function rampOf(color: number): Ramp {
  for (const r of Object.values(RAMPS)) if ((r as readonly number[]).includes(color)) return r as Ramp;
  return [mix(color, PAL.ink, 0.6), mix(color, PAL.ink, 0.3), color, mix(color, PAL.white, 0.45), PAL.white];
}

export type BurnKind = 'fireball' | 'wisp' | 'bolt';

export interface BurnOpts {
  kind?: BurnKind;
  /** Accent color (default per kind: fire orange / gold lightning). Snaps to its palette ramp. */
  color?: number;
  /** Called on impact (same moment the promise resolves). */
  onImpact?: () => void;
}

/** Which LP panel (if any) a screen point sits on. */
function panelAt(p: XY): PlayerId | null {
  if (p.x <= 156 && p.y >= 286) return 0;
  if (p.x >= 484 && p.y <= 72) return 1;
  return null;
}

/**
 * Effect damage delivery: a projectile from `fromXY` to `toXY` (usually the opponent's LP panel).
 *  - fireball: charge, then a roaring fireball arcs over the field (flame tongues trail
 *    against its velocity) and explodes on the panel (Magma Titanı).
 *  - wisp: a little flame spirit with eyes weaves its way there (Kor Kurdu).
 *  - bolt: a crackling lightning leader zig-zags across and the full bolt snaps on (Şimşek Kertenkelesi).
 * Resolves on impact (show the damage number / start the LP count then).
 */
export async function burnFly(scene: Phaser.Scene, fromXY: XY, toXY: XY, opts: BurnOpts = {}): Promise<void> {
  const kind = opts.kind ?? 'fireball';
  if (kind === 'bolt') return boltFly(scene, fromXY, toXY, opts);
  const ramp = rampOf(opts.color ?? PAL.fire3);
  const hot = [PAL.white, ramp[4], ramp[3], ramp[2], ramp[1], ramp[0]];
  const depth = DEPTH.HUD + 6;
  const R = new Raster(scene, 0, 0, 72, 72, depth);
  const trail = new Sparks(scene, depth - 1);
  const smoke = new Sparks(scene, depth - 2);
  const isWisp = kind === 'wisp';
  let pos = { x: fromXY.x, y: fromXY.y };
  let vel = { x: 0, y: -1 };
  let size = 0;
  let el0 = 0;
  const drawHead = () => {
    R.moveTo(Math.round(pos.x) - 36, Math.round(pos.y) - 36);
    R.draw((g) => {
      if (size <= 0.05) return;
      const sp = Math.hypot(vel.x, vel.y) || 1;
      const bx = -vel.x / sp;
      const by = -vel.y / sp;
      const px = -by;
      const py = bx;
      const fl = el0 * 0.03;
      if (isWisp) {
        // teardrop flame body with a flickering tip streaming backward
        const L = 12 * size;
        for (let i = 10; i >= 0; i--) {
          const t = i / 10;
          const wob = Math.sin(fl * 2 + t * 6) * 1.8 * t;
          const r = (1 - t) * 4.2 * size + 0.6;
          const cx = pos.x + bx * L * t + px * wob;
          const cy = pos.y + by * L * t + py * wob;
          g.disc(cx, cy, r + 1, t > 0.6 ? ramp[1] : ramp[2]);
        }
        for (let i = 10; i >= 0; i--) {
          const t = i / 10;
          const wob = Math.sin(fl * 2 + t * 6) * 1.8 * t;
          const r = (1 - t) * 4.2 * size;
          g.disc(pos.x + bx * L * t + px * wob, pos.y + by * L * t + py * wob, r, t > 0.45 ? ramp[3] : ramp[4]);
        }
        g.disc(pos.x - bx, pos.y - by, 2.2 * size, PAL.white);
        // eyes look where it flies
        const ex = pos.x - bx * 1.5;
        const ey = pos.y - by * 1.5 - 1;
        g.px(ex + px * 1.6, ey + py * 1.6, PAL.ink);
        g.px(ex - px * 1.6, ey - py * 1.6, PAL.ink);
        return;
      }
      // fireball: tongues trailing against velocity
      const tongues = 7;
      for (let k = 0; k < tongues; k++) {
        const sway = Math.sin(fl * 1.7 + k * 1.9) * 2.4;
        const len = (10 + (k % 3) * 4 + Math.sin(fl * 2.3 + k) * 2) * size;
        for (let i = 6; i >= 1; i--) {
          const t = i / 6;
          const r = (1 - t) * 4 * size + 0.5;
          const off = (k - (tongues - 1) / 2) * 1.1 * (1 - t * 0.5);
          g.disc(pos.x + bx * len * t + px * (off + sway * t), pos.y + by * len * t + py * (off + sway * t), r, t > 0.66 ? ramp[1] : t > 0.33 ? ramp[2] : ramp[3]);
        }
      }
      g.disc(pos.x, pos.y, 6 * size, ramp[2]);
      g.disc(pos.x - bx * 0.5, pos.y - by * 0.5, 4.6 * size, ramp[3]);
      g.disc(pos.x - bx * 1.2, pos.y - by * 1.2, 3 * size, ramp[4]);
      g.disc(pos.x - bx * 1.6 - 0.5, pos.y - by * 1.6 - 0.5, 1.6 * size, PAL.white);
    });
  };
  const stopDraw = onFrame(scene, (_dt, el) => {
    el0 = el;
    drawHead();
  });

  // ---- charge
  snd(isWisp ? 'roarSmall' : 'fireBurst', 0.5, isWisp ? 1.6 : 0.8);
  await run(scene, isWisp ? 200 : 220, (t) => {
    size = E.outBack(t) * (isWisp ? 1 : 1);
    pos = { x: fromXY.x, y: fromXY.y - t * (isWisp ? 10 : 4) };
    if (rnd() < 0.8) {
      const a = rr(0, TAU);
      const r = rr(12, 22);
      trail.add({ x: pos.x + Math.cos(a) * r, y: pos.y + Math.sin(a) * r, home: { x: pos.x, y: pos.y, k: 0.35 }, life: 180, ramp: hot.slice(1, 4), tex: TEX.px1 });
    }
  });

  // ---- flight
  const start = { ...pos };
  const dist = Math.hypot(toXY.x - start.x, toXY.y - start.y);
  const dur = Math.max(380, Math.min(isWisp ? 820 : 640, dist * (isWisp ? 1.9 : 1.35)));
  const ctrl = { x: (start.x + toXY.x) / 2, y: Math.min(start.y, toXY.y) - Math.min(110, 40 + dist * 0.25) };
  snd('whoosh', 0.6, isWisp ? 1.4 : 0.9);
  let prev = { ...start };
  await run(scene, dur, (t, el) => {
    const k = isWisp ? E.inOutSine(t) : t * t * 0.35 + t * 0.65;
    let p = qbez(start, ctrl, toXY, k);
    if (isWisp) {
      // weave: perpendicular sine
      const tx = toXY.x - start.x;
      const ty = toXY.y - start.y;
      const l = Math.hypot(tx, ty) || 1;
      const w = Math.sin(t * TAU * 1.5) * 16 * Math.sin(t * Math.PI);
      p = { x: p.x - (ty / l) * w, y: p.y + (tx / l) * w };
    }
    vel = { x: p.x - prev.x || vel.x, y: p.y - prev.y || vel.y };
    prev = p;
    pos = p;
    if (rnd() < 0.9)
      trail.add({ x: p.x + rr(-2, 2), y: p.y + rr(-2, 2), vx: rr(-15, 15), vy: rr(-25, 5), life: rr(220, 420), ramp: hot.slice(1), tex: rnd() < 0.3 ? TEX.px2 : TEX.px1, flicker: true });
    if (!isWisp && el % 3 < 1.5 && rnd() < 0.35) smoke.add({ x: p.x, y: p.y, vy: rr(-14, -4), life: rr(300, 500), ramp: [PAL.stone2, PAL.stone1, PAL.night2], tex: TEX.dot5, wobble: 4 });
  });

  // ---- impact
  stopDraw();
  R.destroy();
  opts.onImpact?.();
  snd(isWisp ? 'burn' : 'fireBurst', 1);
  snd('lpDown', 0.4);
  void explosion(scene, toXY.x, toXY.y, ramp, isWisp ? 0.75 : 1, depth);
  const panel = panelAt(toXY);
  if (panel !== null) void panelGlow(scene, panel, [PAL.white, ramp[4], ramp[3], ramp[2]], 420);
  void shake(scene, 180, isWisp ? 1 : 2);
  void sleep(scene, 700).then(() => {
    trail.close();
    smoke.close();
  });
}

/** Small fiery/energetic explosion (rings, sparks, puffs) — fire-and-forget. */
export function explosion(scene: Phaser.Scene, x: number, y: number, ramp: Ramp, scale = 1, depth: number = DEPTH.FX + 4): Promise<void> {
  const R = Raster.around(scene, x, y, 80 * scale + 10, 80 * scale + 10, depth);
  const sp = new Sparks(scene, depth + 1);
  const puffs = new Sparks(scene, depth - 1);
  sp.burst(Math.round(22 * scale), () => {
    const a = rr(0, TAU);
    const v = rr(60, 200) * scale;
    return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, ay: 260, drag: 2, life: rr(260, 520), ramp: [PAL.white, ramp[4], ramp[3], ramp[2], ramp[1]], trail: true, tex: rnd() < 0.3 ? TEX.px2 : TEX.px1 };
  });
  puffs.burst(Math.round(8 * scale), (i) => {
    const a = (i / 8) * TAU;
    return { x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 4, vx: Math.cos(a) * 30, vy: Math.sin(a) * 20 - 18, drag: 3, life: rr(380, 620), ramp: [ramp[2], ramp[1], PAL.stone1, PAL.night2], tex: TEX.dot5 };
  });
  return run(scene, 340, (t) => {
    R.draw((g) => {
      const k = E.outCubic(t);
      const r = (6 + k * 26) * scale;
      if (t < 0.5) g.disc(x, y, r * 0.75 * (1 - t), PAL.white);
      if (t < 0.7) g.disc(x, y, r * 0.95 * (1 - t * 0.6), ramp[3], 1 - seg(t, 0.2, 0.7));
      g.ring(x, y, r, r, t < 0.3 ? PAL.white : ramp[4], 1 - t);
      g.ring(x, y, r + 3 * scale, r + 3 * scale, ramp[2], (1 - t) * 0.7);
    });
  }).then(() => {
    R.destroy();
    sp.close();
    puffs.close();
  });
}

async function boltFly(scene: Phaser.Scene, fromXY: XY, toXY: XY, opts: BurnOpts): Promise<void> {
  const ramp = rampOf(opts.color ?? PAL.gold3);
  const BR = [ramp[2], ramp[4], PAL.white, PAL.white];
  const x0 = Math.min(fromXY.x, toXY.x) - 30;
  const y0 = Math.min(fromXY.y, toXY.y) - 30;
  const R = new Raster(scene, x0, y0, Math.abs(fromXY.x - toXY.x) + 60, Math.abs(fromXY.y - toXY.y) + 60, DEPTH.HUD + 6);
  const sp = new Sparks(scene, DEPTH.HUD + 7);
  // ---- crackle at the source
  snd('beamCharge', 0.5, 1.8);
  await run(scene, 150, () => {
    R.draw((g) => {
      for (let i = 0; i < 3; i++) {
        const a = rr(0, TAU);
        const r = rr(6, 14);
        g.path(boltPath(fromXY, { x: fromXY.x + Math.cos(a) * r, y: fromXY.y + Math.sin(a) * r }, 3, 2), rnd() < 0.5 ? PAL.white : ramp[4]);
      }
    });
  });
  // ---- the leader steps across
  snd('lightning', 0.7, 1.4);
  const full = boltPath(fromXY, toXY, Math.min(40, Math.hypot(toXY.x - fromXY.x, toXY.y - fromXY.y) * 0.12), 6);
  await run(scene, 150, (t) => {
    const n = Math.max(2, Math.floor(full.length * t));
    R.draw((g) => {
      glowStroke(g, full.slice(0, n), BR, 0.8, 0.8);
      const h = full[n - 1];
      g.disc(h.x, h.y, 2.5, PAL.white);
    });
  });
  // ---- full bolt snaps on, flickers
  opts.onImpact?.();
  snd('thunder', 0.5, 1.6);
  snd('lpDown', 0.4);
  const panel = panelAt(toXY);
  if (panel !== null) void panelGlow(scene, panel, [PAL.white, ramp[4], ramp[3], ramp[2]], 420);
  void explosion(scene, toXY.x, toXY.y, ramp, 0.8, DEPTH.HUD + 6);
  void shake(scene, 160, 2);
  void flash(scene, 90, PAL.white, 0.3);
  sp.burst(14, () => ({ x: toXY.x, y: toXY.y, vx: rr(-120, 120), vy: rr(-120, 60), ay: 300, drag: 2, life: rr(200, 380), ramp: [PAL.white, ramp[4], ramp[3]], trail: true }));
  void (async () => {
    const pattern = [1, 1, 0.4, 1, 0.7, 0.3, 0.6, 0.2, 0];
    for (const v of pattern) {
      const pts = boltPath(fromXY, toXY, 26, 6);
      R.draw((g) => {
        if (v > 0) glowStroke(g, pts, BR, 1.4 * v + 0.4, v);
      });
      await sleep(scene, 34);
    }
    R.destroy();
    sp.close();
  })();
}

/**
 * Effect LP-gain delivery (Işık Perisi): a little fountain of star sparkles rises from `fromXY`,
 * hangs a beat, then streams in curves into the LP panel at `toXY` with green-gold trails.
 * Resolves when the last sparkle lands (start the count-up / "+500" then).
 */
export async function healFly(scene: Phaser.Scene, fromXY: XY, toXY: XY, opts: { onArrive?: () => void } = {}): Promise<void> {
  const N = 6;
  const trail = new Sparks(scene, DEPTH.HUD + 6);
  const pops = new Sparks(scene, DEPTH.HUD + 7);
  snd('holyChime', 0.6, 1.2);
  let first = true;
  const panel = panelAt(toXY);
  const jobs: Promise<void>[] = [];
  for (let i = 0; i < N; i++) {
    jobs.push(
      (async () => {
        await sleep(scene, i * 60);
        const star = scene.add.image(fromXY.x, fromXY.y, TEX.spark).setDepth(DEPTH.HUD + 8).setTint(PAL.gold4);
        const a = -Math.PI / 2 + (i - (N - 1) / 2) * 0.32;
        const peak = { x: fromXY.x + Math.cos(a) * rr(22, 34), y: fromXY.y + Math.sin(a) * rr(26, 40) };
        // rise
        await run(scene, 260, (t, el) => {
          const k = E.outCubic(t);
          star.setPosition(Math.round(lerp(fromXY.x, peak.x, k)), Math.round(lerp(fromXY.y, peak.y, k)));
          star.setTint(Math.floor(el / 60) % 2 ? PAL.white : PAL.gold4);
          if (rnd() < 0.6) trail.add({ x: star.x + rr(-1, 1), y: star.y + rr(-1, 1), vy: rr(5, 20), life: 260, ramp: [PAL.gold4, PAL.leaf4, PAL.leaf3], flicker: true });
        });
        // hang + twinkle
        await sleep(scene, 80 + (N - i) * 25);
        // stream into the panel
        const from = { x: star.x, y: star.y };
        const ctrl = { x: lerp(from.x, toXY.x, 0.2) + rr(-30, 30), y: Math.min(from.y, toXY.y) - rr(20, 60) };
        const dest = { x: toXY.x + rr(-12, 12), y: toXY.y + rr(-5, 5) };
        await run(scene, rr(420, 520), (t, el) => {
          const p = qbez(from, ctrl, dest, E.inQuad(t) * 0.6 + t * 0.4);
          star.setPosition(Math.round(p.x), Math.round(p.y));
          star.setTint(Math.floor(el / 50) % 2 ? PAL.white : PAL.gold4);
          trail.add({ x: p.x + rr(-1.5, 1.5), y: p.y + rr(-1.5, 1.5), vy: rr(-8, 8), life: rr(220, 380), ramp: [PAL.white, PAL.gold4, PAL.leaf3, PAL.leaf2], flicker: true });
        });
        star.destroy();
        pops.burst(8, (k) => {
          const an = (k / 8) * TAU;
          return { x: dest.x, y: dest.y, vx: Math.cos(an) * 60, vy: Math.sin(an) * 60, drag: 5, life: 260, ramp: [PAL.white, PAL.leaf4, PAL.leaf3, PAL.gold3], tex: k % 2 ? TEX.plus : TEX.px1 };
        });
        snd('heal', 0.35, 1.1 + i * 0.06);
        if (first) {
          first = false;
          opts.onArrive?.();
          if (panel !== null) void panelGlow(scene, panel, [PAL.white, PAL.gold4, PAL.leaf3, PAL.leaf2]);
        }
      })(),
    );
  }
  await Promise.all(jobs);
  void sleep(scene, 500).then(() => {
    trail.close();
    pops.close();
  });
}

/**
 * Abyss magus effect (~0.9 s main beat): a shadow pool opens under the caster, a thorny shadow
 * tendril snakes along the floor to `toXY`, a void opens under the target card and three
 * tendrils burst up around it and clench. Resolves at the clench (crack / swallow the card then);
 * the tendrils retract and the pools close on their own (~500 ms).
 */
export async function tendril(scene: Phaser.Scene, fromXY: XY, toXY: XY): Promise<void> {
  const x0 = Math.min(fromXY.x, toXY.x) - 40;
  const y0 = Math.min(fromXY.y, toXY.y) - 70;
  const W = Math.abs(fromXY.x - toXY.x) + 80;
  const H = Math.abs(fromXY.y - toXY.y) + 110;
  const floorR = new Raster(scene, x0, y0, W, H, DEPTH.TILE_FX + 3);
  const upR = Raster.around(scene, toXY.x, toXY.y - 20, 90, 90, DEPTH.FX + 1);
  const sp = new Sparks(scene, DEPTH.FX + 2);
  // floor path: gentle S-curve
  const dx = toXY.x - fromXY.x;
  const dy = toXY.y - fromXY.y;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;
  const path = (t: number, el: number): XY => {
    const base = { x: fromXY.x + dx * t, y: fromXY.y + dy * t };
    const s1 = Math.sin(t * Math.PI * 2) * 12 * Math.sin(t * Math.PI);
    const wig = Math.sin(t * 22 - el * 0.02) * 2 * Math.sin(t * Math.PI);
    return { x: base.x + nx * (s1 + wig), y: base.y + ny * (s1 + wig) * 0.5 };
  };
  let grow = 0;
  let poolA = 0;
  let poolB = 0;
  let rise = 0;
  let clench = 0;
  let retract = 0;
  const pool = (g: Raster, p: XY, k: number, el: number) => {
    if (k <= 0.02) return;
    g.ell(p.x, p.y, 16 * k, 8 * k, PAL.void1);
    g.ell(p.x, p.y, 12 * k, 6 * k, PAL.void0);
    g.ell(p.x, p.y, 7 * k, 3.5 * k, PAL.ink);
    for (let i = 0; i < 3; i++) {
      const a = el * 0.006 + (i / 3) * TAU;
      g.ring(p.x, p.y, 12 * k, 6 * k, PAL.void3, 1, a, a + 0.9);
    }
  };
  const stop = onFrame(scene, (_dt, el) => {
    floorR.draw((g) => {
      pool(g, fromXY, poolA, el);
      pool(g, toXY, poolB, el);
      if (grow <= 0) return;
      const t0 = retract;
      const n = 60;
      const pts: XY[] = [];
      for (let i = 0; i <= n; i++) {
        const t = (i / n) * grow;
        if (t < t0 * grow) continue;
        pts.push(path(t, el));
      }
      // shadow on the floor, body, highlight
      for (let i = 1; i < pts.length; i++) {
        const t = i / pts.length;
        const w = 3.2 - t * 1.8;
        g.thick(pts[i - 1].x, pts[i - 1].y + 1, pts[i].x, pts[i].y + 1, w + 0.8, PAL.ink, 0.6);
      }
      for (let i = 1; i < pts.length; i++) {
        const t = i / pts.length;
        const w = 2.8 - t * 1.6;
        g.thick(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, w, PAL.void1);
      }
      for (let i = 1; i < pts.length; i++) {
        const t = i / pts.length;
        g.px(pts[i].x, pts[i].y - Math.max(1, 2 - t * 1.5), i % 5 === 0 ? PAL.void4 : PAL.void3);
        if (i % 6 === 3) {
          // thorn
          const a = pts[i];
          const b = pts[i - 1];
          const tx = a.x - b.x;
          const ty = a.y - b.y;
          const l = Math.hypot(tx, ty) || 1;
          const side = i % 12 === 3 ? 1 : -1;
          g.line(a.x, a.y, a.x - (ty / l) * 3 * side - (tx / l) * 2, a.y + (tx / l) * 3 * side - (ty / l) * 2, PAL.void2);
        }
      }
      if (pts.length) {
        const h = pts[pts.length - 1];
        g.disc(h.x, h.y, 1.5, PAL.void3);
        g.px(h.x, h.y, PAL.void4);
      }
    });
    upR.draw((g) => {
      if (rise <= 0) return;
      for (let k = 0; k < 3; k++) {
        const base = { x: toXY.x + [-14, 0, 14][k], y: toXY.y + [2, 6, 2][k] };
        const hgt = (26 + k * 4) * rise * (1 - retract);
        const lean = [-1, 0, 1][k];
        const pts: XY[] = [];
        for (let i = 0; i <= 14; i++) {
          const t = i / 14;
          const curl = clench * t * t * 10;
          const wav = Math.sin(t * 6 + el * 0.02 + k) * 2.5 * t;
          pts.push({ x: base.x + lean * (t * 8 - curl) + wav, y: base.y - hgt * t + curl * 0.3 });
        }
        for (let i = 1; i < pts.length; i++) {
          const t = i / pts.length;
          g.thick(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, 2.6 - t * 1.8, PAL.void1);
        }
        for (let i = 1; i < pts.length; i++) g.px(pts[i].x - 1, pts[i].y, i % 4 === 0 ? PAL.void4 : PAL.void3);
        const tip = pts[pts.length - 1];
        g.px(tip.x, tip.y, PAL.void4);
      }
    });
  });
  // ---- caster's shadow pool
  snd('darkPulse', 0.8);
  await run(scene, 160, (t) => (poolA = E.outBack(t)));
  // ---- the tendril snakes along the floor
  snd('whoosh', 0.5, 0.6);
  await run(scene, 420, (t) => {
    grow = E.inOutSine(t);
    if (rnd() < 0.6) {
      const p = path(grow, 0);
      sp.add({ x: p.x, y: p.y, vy: rr(-30, -10), vx: rr(-10, 10), life: rr(240, 400), ramp: [PAL.void3, PAL.void2, PAL.void1], tex: TEX.px1 });
    }
  });
  // ---- void under the target, tendrils erupt and clench
  snd('darkPulse', 1, 0.7);
  void run(scene, 160, (t) => (poolB = E.outBack(t)));
  await run(scene, 180, (t) => (rise = E.outBack(t)));
  sp.burst(16, () => ({ x: toXY.x + rr(-14, 14), y: toXY.y + rr(-2, 4), vy: rr(-90, -40), vx: rr(-30, 30), ay: 120, life: rr(260, 460), ramp: [PAL.void4, PAL.void3, PAL.void2, PAL.void1], trail: true }));
  await run(scene, 140, (t) => (clench = E.inQuad(t)));
  snd('impactHeavy', 0.5, 0.6);
  void shake(scene, 120, 1);
  // main beat — retract in the background
  void (async () => {
    await sleep(scene, 280);
    await run(scene, 360, (t) => {
      retract = E.inQuad(t);
      poolA = 1 - t;
      poolB = 1 - E.inQuad(t);
    });
    stop();
    floorR.destroy();
    upR.destroy();
    sp.close();
  })();
}

/**
 * Thorn lurker flip effect (~0.9 s main beat): the ground splits under the target, four thorny
 * vines erupt and spiral up around it (back strands behind the sprite, front strands in front),
 * then crush: squash, hit-stop, thorn sparks. Resolves at the crush (shatter it then); the vines
 * wither away on their own. The sprite's scale/tint are restored before resolving.
 */
export async function vineBurst(scene: Phaser.Scene, x: number, y: number, target: Unit): Promise<void> {
  x = Math.round(x);
  y = Math.round(y);
  const box = spriteBox(scene, target);
  const back = Raster.around(scene, x, y - box.h / 2, 140, box.h + 60, unitDepth(y) - 1);
  const front = Raster.around(scene, x, y - box.h / 2, 140, box.h + 60, unitDepth(y) + 1);
  const floorR = Raster.around(scene, x, y, 110, 56, DEPTH.SHADOW - 1);
  const sp = new Sparks(scene, DEPTH.FX + 2);
  const NV = 4;
  const vines = Array.from({ length: NV }, (_, i) => ({ a0: (i / NV) * TAU + rr(-0.3, 0.3), dir: i % 2 ? 1 : -1, delay: i * 40, turns: rr(1.1, 1.5) }));
  const H = box.h * 0.92;
  let grow = 0;
  let squeeze = 0;
  let wither = 0;
  let crackT = 0;
  const cracks = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * TAU + rr(-0.2, 0.2);
    const l = rr(18, 30);
    return boltPath({ x, y }, { x: x + Math.cos(a) * l, y: y + Math.sin(a) * l * 0.5 }, 4, 3);
  });
  const vinePts = (v: (typeof vines)[number], g0: number) => {
    const pts: { p: XY; front: boolean; t: number }[] = [];
    const n = 44;
    for (let i = 0; i <= n * g0; i++) {
      const t = i / n;
      const hy = y - t * H;
      const half = Math.max(box.halfAt(hy), 6);
      const r = (half + 4) * (1 - squeeze * 0.28) + (1 - t) * 6;
      const an = v.a0 + v.dir * t * TAU * v.turns;
      pts.push({ p: { x: x + Math.cos(an) * r, y: hy + Math.sin(an) * r * 0.32 }, front: Math.sin(an) >= 0, t });
    }
    return pts;
  };
  const drawVines = (g: Raster, isFront: boolean, el: number) => {
    for (const v of vines) {
      const local = clamp01(grow * 1.25 - v.delay / 400);
      const keep = 1 - wither;
      if (local <= 0 || keep <= 0) continue;
      const pts = vinePts(v, local);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        if (b.front !== isFront) continue;
        if (b.t > keep) continue;
        const w = 2.6 - b.t * 1.6;
        g.thick(a.p.x, a.p.y + 0.5, b.p.x, b.p.y + 0.5, w + 0.7, PAL.leaf0);
        g.thick(a.p.x, a.p.y, b.p.x, b.p.y, w, PAL.leaf2);
        g.px(b.p.x, b.p.y - Math.round(w * 0.6), PAL.leaf3);
        if (i % 5 === 0) {
          // thorn pointing outward
          const ox = b.p.x - x;
          const oy = (b.p.y - (y - b.t * H)) * 3;
          const l = Math.hypot(ox, oy) || 1;
          const tx = b.p.x + (ox / l) * 3;
          const ty = b.p.y + (oy / l) * 1.2 - 1;
          g.line(b.p.x, b.p.y, tx, ty, squeeze > 0.6 && Math.floor(el / 40) % 2 ? PAL.white : PAL.earth4);
        }
        if (i % 11 === 7) {
          // leaf
          g.disc(b.p.x + 2, b.p.y - 2, 1.5, PAL.leaf3);
          g.px(b.p.x + 2, b.p.y - 3, PAL.leaf4);
        }
      }
    }
  };
  const stop = onFrame(scene, (_dt, el) => {
    back.draw((g) => drawVines(g, false, el));
    front.draw((g) => drawVines(g, true, el));
    floorR.draw((g) => {
      if (crackT <= 0) return;
      for (const c of cracks) {
        const n = Math.max(2, Math.floor(c.length * Math.min(1, crackT)));
        g.path(c.slice(0, n), PAL.earth0, 1 - wither, 2);
        g.path(c.slice(0, n), PAL.leaf1, 1 - wither);
      }
      g.ell(x, y, 14, 7, PAL.earth0, 0.6 * (1 - wither));
    });
  });
  const sx = target.scaleX;
  const sy = target.scaleY;
  // ---- the ground splits
  snd('groundCrack', 0.6, 1.3);
  void shake(scene, 200, 1);
  await run(scene, 180, (t) => {
    crackT = E.outCubic(t);
    if (rnd() < 0.6) sp.add({ x: x + rr(-14, 14), y: y + rr(-4, 4), vy: rr(-70, -30), vx: rr(-20, 20), ay: 300, life: rr(220, 380), ramp: [PAL.earth3, PAL.earth2, PAL.earth1], tex: TEX.px1 });
  });
  // ---- vines erupt and spiral up
  snd('whoosh', 0.6, 1.2);
  sp.burst(12, () => ({ x: x + rr(-12, 12), y: y + rr(-3, 3), vx: rr(-60, 60), vy: rr(-120, -50), ay: 380, life: rr(300, 520), ramp: [PAL.leaf4, PAL.leaf3, PAL.leaf2], tex: rnd() < 0.5 ? TEX.px2 : TEX.px1 }));
  await run(scene, 340, (t) => (grow = E.outCubic(t)));
  grow = 1.4;
  // ---- crush
  snd('bite', 0.9, 0.8);
  await run(scene, 160, (t) => {
    squeeze = E.inCubic(t);
    if (target.active) target.setScale(sx * (1 - 0.14 * squeeze), sy * (1 + 0.06 * squeeze));
  });
  snd('impactHeavy', 0.8, 1.1);
  if (target.active) target.setTintFill(PAL.white);
  sp.burst(24, () => {
    const a = rr(0, TAU);
    const v = rr(60, 170);
    return { x: x + rr(-8, 8), y: y - rr(4, H * 0.8), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 - 30, ay: 320, drag: 2, life: rr(260, 520), ramp: [PAL.white, PAL.leaf4, PAL.leaf3, PAL.earth3], trail: true, tex: rnd() < 0.3 ? TEX.plus : TEX.px1 };
  });
  void shake(scene, 180, 2);
  await hitStop(scene, 70);
  if (target.active) {
    target.clearTint();
    target.setScale(sx, sy);
  }
  await sleep(scene, 60);
  // vines wither in the background
  void (async () => {
    await sleep(scene, 240);
    await run(scene, 420, (t) => {
      wither = E.inQuad(t);
      squeeze = 1 - t;
    });
    stop();
    back.destroy();
    front.destroy();
    floorR.destroy();
    sp.close();
  })();
}

// ------------------------------------------------------------------ boot textures

const RUNES = [
  ['#.#.#', '.###.', '..#..', '.#.#.', '#...#'],
  ['###..', '#..#.', '###..', '#.#..', '#..##'],
  ['..#..', '.#.#.', '#####', '.#.#.', '..#..'],
  ['#...#', '.#.#.', '..#..', '..#..', '#####'],
  ['.###.', '#...#', '#.#.#', '#...#', '.###.'],
  ['#.#..', '##.#.', '#.#.#', '.#.##', '..#.#'],
  ['#####', '..#..', '.###.', '..#..', '#.#.#'],
  ['#..#.', '#.#..', '##...', '#.#..', '#..#.'],
];

function drawSword(p: PixelCanvas): void {
  const c = 7;
  // pommel gem
  p.disc(c + 0.5, 4.5, 2.6, PAL.gold2);
  p.disc(c + 0.5, 4.5, 1.6, PAL.crim3);
  p.set(c - 1, 3, PAL.crim4).set(c, 3, PAL.crim4);
  p.set(c - 2, 3, PAL.gold4).set(c - 2, 4, PAL.gold3);
  // grip with wraps
  for (let y = 7; y <= 12; y++) {
    p.set(c - 1, y, y % 2 ? PAL.gold2 : PAL.gold1).set(c, y, y % 2 ? PAL.gold1 : PAL.gold2).set(c + 1, y, PAL.gold0);
  }
  // crossguard: swept dragon wings
  for (let x = 1; x <= 13; x++) p.set(x, 14, PAL.gold3);
  for (let x = 2; x <= 12; x++) p.set(x, 13, PAL.gold4);
  for (let x = 2; x <= 12; x++) p.set(x, 15, PAL.gold2);
  for (let x = 4; x <= 10; x++) p.set(x, 16, PAL.gold1);
  p.set(1, 13, PAL.gold4).set(1, 12, PAL.gold4).set(0, 11, PAL.gold3).set(13, 13, PAL.gold3).set(13, 12, PAL.gold3).set(14, 11, PAL.gold2);
  p.set(1, 15, PAL.gold2).set(13, 15, PAL.gold1);
  p.set(c, 14, PAL.crim3).set(c, 13, PAL.crim4).set(c - 1, 14, PAL.crim2).set(c + 1, 14, PAL.crim1);
  // blade (point down): lit left bevel, white ridge, shaded right
  for (let y = 17; y <= 43; y++) {
    const t = (y - 17) / 26;
    const hw = t < 0.74 ? 2 : t < 0.9 ? 1 : 0;
    for (let x = c - hw; x <= c + hw; x++) {
      let col: number = PAL.gold3;
      if (x < c) col = x === c - hw && hw === 2 ? PAL.white : PAL.gold4;
      else if (x === c) col = y % 6 === 0 ? PAL.white : PAL.gold4;
      else col = x === c + hw && hw === 2 ? PAL.gold1 : PAL.gold2;
      p.set(x, y, col);
    }
  }
  p.set(c, 44, PAL.gold4);
  // fuller rune notches
  for (const y of [21, 26, 31]) p.set(c, y, PAL.crim3);
  p.outline(PAL.ink);
}

/** Boot step (src/boot/14-vfx-set.ts): sword, runes, rocks. Idempotent. */
export function buildSetTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('set:sword')) {
    const p = new PixelCanvas(15, 46);
    drawSword(p);
    scene.textures.addCanvas('set:sword', p.toCanvas());
  }
  if (!scene.textures.exists('set:rune')) {
    const sheet = new PixelCanvas(7 * RUNES.length, 7);
    RUNES.forEach((rows, i) => {
      const g = new PixelCanvas(7, 7);
      rows.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && g.set(x + 1, y + 1, PAL.gold4)));
      g.outline(PAL.gold1, { corners: true });
      sheet.blit(g, i * 7, 0);
    });
    const tex = scene.textures.addCanvas('set:rune', sheet.toCanvas())!;
    RUNES.forEach((_, i) => tex.add(`r${i}`, 0, i * 7, 0, 7, 7));
  }
  if (!scene.textures.exists('set:rock')) {
    const R = [
      [7, 6],
      [6, 5],
      [5, 5],
      [4, 4],
    ];
    const sheet = new PixelCanvas(8 * R.length, 8);
    const rnd2 = mulberry32(77);
    R.forEach(([w, h], i) => {
      const g = new PixelCanvas(8, 8);
      const cx = 4;
      const cy = 4;
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const dx = (x + 0.5 - cx) / (w / 2);
          const dy = (y + 0.5 - cy) / (h / 2);
          if (Math.abs(dx) + Math.abs(dy) * 0.8 + rnd2() * 0.25 < 1.05) {
            const l = -(dx + dy);
            g.set(x, y, l > 0.5 ? PAL.earth3 : l > -0.4 ? PAL.earth2 : PAL.earth1);
          }
        }
      g.outline(PAL.ink);
      sheet.blit(g, i * 8, 0);
    });
    const tex = scene.textures.addCanvas('set:rock', sheet.toCanvas())!;
    R.forEach((_, i) => tex.add(`k${i}`, 0, i * 8, 0, 8, 8));
  }
}

// =================================================================================== 2. TRAPS

const TRAP_RAMP = [PAL.white, PAL.mag4, PAL.mag3, PAL.mag2, PAL.mag1];

// ------------------------------------------------------------------ common trap opening

/**
 * Trap springs at a tile (~650 ms): magenta tile flash, anime impact lines bursting from the
 * card, a cross glint, floor rings, a thin energy column and "TUZAK" rising off the tile.
 * Animate the card itself (standing up / flipping) in parallel.
 */
export async function trapSpring(scene: Phaser.Scene, x: number, y: number): Promise<void> {
  x = Math.round(x);
  y = Math.round(y);
  const cy = y - 12;
  snd('trapActivate', 1);
  void tileFlash(scene, x, y, [PAL.white, PAL.mag4, PAL.mag3, PAL.mag2, PAL.mag1], 420);
  void floorRing(scene, x, y, { r0: 8, r1: 70, ms: 460, ramp: TRAP_RAMP, depth: DEPTH.SHADOW - 1 });
  void floorRing(scene, x, y, { r0: 4, r1: 40, ms: 320, ramp: [PAL.mag4, PAL.mag3, PAL.mag2], depth: DEPTH.SHADOW - 1 });
  const burst = Raster.around(scene, x, cy, 200, 150, DEPTH.FX + 6);
  const column = new Raster(scene, x - 8, cy - 110, 16, 116, DEPTH.FX + 5, ADD);
  const sparks = new Sparks(scene, DEPTH.FX + 7);
  const lines = Array.from({ length: 18 }, (_, i) => ({ a: (i / 18) * TAU + rr(-0.12, 0.12), len: rr(0.6, 1), w: rnd() < 0.3 ? 2 : 1 }));
  sparks.burst(22, () => {
    const a = rr(0, TAU);
    const sp = rr(50, 150);
    return { x, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 30, drag: 3, ay: -20, life: rr(320, 560), ramp: TRAP_RAMP, tex: rnd() < 0.35 ? TEX.plus : TEX.px1, trail: rnd() < 0.4 };
  });
  // rising "TUZAK" energy
  const word = pixelTextSafe(scene, x, cy - 6, 'TUZAK', PAL.mag3);
  const fx = run(scene, 650, (t, el) => {
    burst.draw((g) => {
      // impact lines: shoot out fast, then retract outward
      const k = E.outExpo(seg(t, 0, 0.35));
      const k2 = E.inQuad(seg(t, 0.18, 0.7));
      for (const l of lines) {
        const r0 = 8 + k2 * 70 * l.len;
        const r1 = 14 + k * 78 * l.len;
        if (r1 <= r0) continue;
        const ca = Math.cos(l.a);
        const sa = Math.sin(l.a) * 0.62;
        const col = t < 0.15 ? PAL.white : t < 0.4 ? PAL.mag4 : PAL.mag3;
        g.line(x + ca * r0, cy + sa * r0, x + ca * r1, cy + sa * r1, col, 1, l.w);
      }
      // cross glint
      if (t < 0.45) {
        const q = 1 - t / 0.45;
        const hw = Math.round(46 * E.outCubic(seg(t, 0, 0.12)) * q + 2);
        const hh = Math.round(22 * E.outCubic(seg(t, 0, 0.12)) * q + 1);
        g.rect(x - hw, cy, hw * 2 + 1, 1, PAL.white);
        g.rect(x - Math.round(hw * 0.6), cy - 1, Math.round(hw * 1.2) + 1, 3, PAL.mag4, 0.6);
        g.rect(x, cy - hh, 1, hh * 2 + 1, PAL.white);
        g.disc(x + 0.5, cy + 0.5, 4 * q + 1, PAL.white);
        g.ring(x + 0.5, cy + 0.5, 6 + 22 * (1 - q), 4 + 14 * (1 - q), PAL.mag3, q);
      }
    });
    column.draw((g) => {
      const q = 1 - seg(t, 0.2, 0.8);
      const h = 110 * E.outExpo(seg(t, 0, 0.25));
      const hw = 3 * q;
      if (hw < 0.3) return;
      g.rect(x - hw, cy - h, hw * 2 + 1, h, PAL.mag2, 0.8);
      g.rect(x - hw / 3, cy - h, (hw * 2) / 3 + 1, h, PAL.mag4, 1);
    });
    if (word) {
      const rise = E.outCubic(seg(t, 0.05, 1)) * 34;
      word.setY(Math.round(cy - 18 - rise));
      const fl = Math.floor(el / 50) % 2 === 0;
      word.setTint(t < 0.2 ? PAL.white : fl ? PAL.mag3 : PAL.mag4);
      const a = 1 - seg(t, 0.55, 1);
      word.setAlpha(a > 0.66 ? 1 : a > 0.33 ? 0.66 : a > 0 ? 0.33 : 0);
      word.setScale(t < 0.1 ? 2 : 1);
    }
    if (t > 0.15 && t < 0.8 && rnd() < 0.6) sparks.add({ x: x + rr(-14, 14), y: cy + rr(-4, 6), vy: rr(-90, -50), life: rr(200, 380), ramp: [PAL.mag4, PAL.mag3, PAL.mag2], tex: TEX.px1, trail: true });
  });
  void shake(scene, 140, 2);
  await fx;
  burst.destroy();
  column.destroy();
  word?.destroy();
  sparks.close();
}

/** pixelText with a graceful fallback if the font module is unavailable. */
function pixelTextSafe(scene: Phaser.Scene, x: number, y: number, text: string, color: number, size: 'md' | 'lg' = 'lg'): Phaser.GameObjects.BitmapText | null {
  try {
    return pixelText(scene, x, y, text, { size, color: PAL.white, originX: 0.5, originY: 0.5 }).setTint(color).setDepth(DEPTH.FX + 8);
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ Ayna Kalkanı — mirrorDome

export interface MirrorOpts {
  /** Called when the reflected beam reaches attacker i (shatter it here). */
  onHit?: (i: number) => void;
  /** Called when the incoming attack strikes the dome. */
  onBlock?: () => void;
}

/**
 * Mirror barrier (~1.6 s main beat): a magenta-white hexagonal shell materializes cell by cell
 * in front of `side`'s monster row, the incoming attack slams into it (hit-stop, hex ripple),
 * the dome charges and fires one reflected beam per attacker (onHit(i) on contact), then the
 * dome shatters into hex shards. `attackers` are aim points (monster cores) in screen space.
 */
export async function mirrorDome(scene: Phaser.Scene, side: PlayerId, attackers: XY[], opts: MirrorOpts = {}): Promise<void> {
  const a0 = 2;
  const b0 = side === 0 ? 3 : 1;
  const ra = 1.78;
  const rb = 1.02;
  const rz = 98;
  const fs = side === 0 ? -1 : 1; // forward sign along rows (toward the attacker)
  const k = 1 / 32;
  const cScr = isoToScreen(a0, b0);
  const x0 = Math.floor(cScr.x - (ra + rb) * 32) - 3;
  const x1 = Math.ceil(cScr.x + (ra + rb) * 32) + 3;
  const y0 = Math.floor(cScr.y - (ra + rb) * 16 - rz) - 3;
  const y1 = Math.ceil(cScr.y + (ra + rb) * 16) + 3;
  // far shell behind the row's units, near shell as glass in front of them
  const rowTop = cScr.y - 16;
  const far = new Raster(scene, x0, y0, x1 - x0, y1 - y0, DEPTH.UNIT + rowTop - 1);
  const nearR = new Raster(scene, x0, y0, x1 - x0, y1 - y0, DEPTH.FX - 10);
  const base = new Raster(scene, x0, y0, x1 - x0, y1 - y0, DEPTH.SHADOW - 1);
  const sparks = new Sparks(scene, DEPTH.FX + 6);

  const HEX = 0.13;
  const SQ3 = Math.sqrt(3);
  // hex cell of a (u, v) point → center + edge distance + id
  const hexAt = (u: number, v: number) => {
    const q = ((SQ3 / 3) * u - (1 / 3) * v) / HEX;
    const r = ((2 / 3) * v) / HEX;
    let rx = Math.round(q);
    let rz2 = Math.round(r);
    const ry = Math.round(-q - r);
    const dx = Math.abs(rx - q);
    const dy = Math.abs(ry - (-q - r));
    const dz = Math.abs(rz2 - r);
    if (dx > dy && dx > dz) rx = -ry - rz2;
    else if (dy <= dz) rz2 = -rx - ry;
    const cu = HEX * SQ3 * (rx + rz2 / 2);
    const cv = HEX * 1.5 * rz2;
    const lx = u - cu;
    const ly = v - cv;
    const d = Math.max(Math.abs(lx), Math.abs(lx / 2 + (ly * SQ3) / 2), Math.abs(-lx / 2 + (ly * SQ3) / 2));
    return { cu, cv, edge: (HEX * SQ3) / 2 - d, id: rx * 131 + rz2 * 17 };
  };
  const hash = (n: number) => {
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  // hex pattern lives on the sphere seen from above-front: (u, v) = (side axis, height) mixed
  // with the row axis so both shells get a full lattice
  const uvOf = (u: number, _w: number, v: number) => ({ hu: u, hv: v });

  // impact point on the shell facing a point, high on the dome
  const toward = (p: XY, el = 0.72) => {
    const g = screenToIso(p.x, p.y + 20);
    let du = (g.col - a0) / ra;
    let dw = (g.row - b0) / rb;
    const l = Math.hypot(du, dw) || 1;
    du /= l;
    dw /= l;
    const u = du * Math.cos(el);
    const w = dw * Math.cos(el);
    const v = Math.sin(el);
    const scr = isoToScreen(a0 + u * ra, b0 + w * rb);
    const h = uvOf(u, w, v);
    return { u: h.hu, v: h.hv, x: scr.x, y: scr.y - v * rz };
  };
  const mean = attackers.length ? { x: attackers.reduce((s2, p) => s2 + p.x, 0) / attackers.length, y: attackers.reduce((s2, p) => s2 + p.y, 0) / attackers.length } : { x: cScr.x - fs * -60, y: cScr.y + fs * 40 };
  const hit = toward(mean);

  let build = 0; // 0..1 materialize wave
  let rippleT = -1; // 0..1 after the block
  let charge = 0; // 0..1 before firing
  let shatter = 0; // 0..1 dissolve
  let flashAll = 0;

  const drawDome = (el: number) => {
    far.begin();
    nearR.begin();
    const qa = (k * k) / (ra * ra) + (k * k) / (rb * rb) + 1 / (rz * rz);
    for (let sy = y0; sy < y1; sy++) {
      const q0 = (sy - 96) / 16;
      for (let sx = x0; sx < x1; sx++) {
        const P = (sx + 0.5 - 320) / 32;
        const A0 = (P + q0) / 2 - a0;
        const B0 = (q0 - P) / 2 - b0;
        const qb = 2 * k * (A0 / (ra * ra) + B0 / (rb * rb));
        const qc = (A0 * A0) / (ra * ra) + (B0 * B0) / (rb * rb) - 1;
        const disc = qb * qb - 4 * qa * qc;
        if (disc < 0) continue;
        const sq = Math.sqrt(disc);
        const thick = sq / (2 * qa) / rz; // ~0 at the silhouette
        for (let pass = 1; pass >= 0; pass--) {
          const z = pass === 0 ? (-qb + sq) / (2 * qa) : (-qb - sq) / (2 * qa);
          if (z < 0) continue;
          const near = pass === 0;
          const g = near ? nearR : far;
          const u = (A0 + z * k) / ra;
          const w = (B0 + z * k) / rb;
          const v = z / rz;
          const { hu, hv } = uvOf(u, w, v);
          const h = hexAt(hu, hv);
          // materialize: from the floor ring upward, spreading sideways
          const born = v * 0.8 + hash(h.id) * 0.2;
          const age = build * 1.25 - born;
          if (age < 0) continue;
          if (shatter > 0 && hash(h.id + 7) * 0.7 + Math.hypot(h.cu - hit.u, h.cv - hit.v) * 0.3 < shatter) continue;
          const fresh = age < 0.1;
          const edge = h.edge < (near ? 0.013 : 0.016);
          const rimK = thick < 0.045 || v < 0.03;
          let rip = 0;
          if (rippleT >= 0) {
            const d = Math.hypot(h.cu - hit.u, h.cv - hit.v);
            rip = Math.max(0, 1 - Math.abs(d - rippleT * 2.2) / 0.25) * (1 - rippleT);
          }
          const hot = Math.max(rip, charge * (0.55 + 0.45 * Math.sin(el * 0.03 + h.cu * 9 + h.cv * 5)), flashAll);
          let c: number;
          let lv: number;
          if (rimK && near) {
            c = hot > 0.4 || fresh ? PAL.white : PAL.mag4;
            lv = 1;
          } else if (edge) {
            c = fresh || hot > 0.75 ? PAL.white : hot > 0.35 ? PAL.mag4 : near ? PAL.mag3 : PAL.mag2;
            lv = near ? 1 : 0.4;
          } else {
            const fres = 1 - Math.min(1, thick * 2.2);
            if (fresh) {
              c = PAL.mag3;
              lv = 0.5;
            } else if (hot > 0.45) {
              c = near ? PAL.mag3 : PAL.mag2;
              lv = 0.15 + hot * 0.35;
            } else {
              c = near ? PAL.mag2 : PAL.mag1;
              lv = near ? 0.04 + fres * 0.3 : 0.05 + fres * 0.12;
            }
          }
          // specular streaks on the near glass (light from the upper left)
          if (near && !fresh && w > 0) {
            const sa = Math.abs(u + 0.44 - (v - 0.62) * 0.35);
            if (sa < 0.025 && v > 0.42 && v < 0.86) {
              c = PAL.white;
              lv = 1;
            } else if (Math.abs(u + 0.36 - (v - 0.62) * 0.35) < 0.012 && v > 0.55 && v < 0.75) {
              c = PAL.mag4;
              lv = 1;
            }
          }
          g.dpx(sx, sy, c, lv);
        }
      }
    }
    far.end();
    nearR.end();
    base.draw((g) => {
      const kk = Math.min(1, build * 2) * (1 - shatter);
      if (kk <= 0) return;
      const n = 120;
      for (let i = 0; i <= n; i++) {
        const t = (i / n) * TAU;
        const p = isoToScreen(a0 + Math.cos(t) * ra, b0 + Math.sin(t) * rb);
        g.dpx(p.x, p.y, PAL.mag3, kk);
        g.dpx(p.x, p.y + 1, PAL.mag1, kk * 0.7);
        const q = isoToScreen(a0 + Math.cos(t) * ra * 0.93, b0 + Math.sin(t) * rb * 0.93);
        g.dpx(q.x, q.y, PAL.mag1, kk * 0.5);
      }
    });
  };
  const stopDraw = onFrame(scene, (_dt, el) => drawDome(el));

  // ---- 0–450 materialize
  snd('mirror', 0.9);
  await run(scene, 450, (t) => {
    build = E.outQuad(t);
    if (rnd() < 0.5) {
      const a = rr(-1.2, 1.2);
      const p = toward({ x: cScr.x + Math.sin(a) * 80, y: cScr.y - fs * 40 });
      sparks.add({ x: p.x, y: p.y, vx: rr(-20, 20), vy: rr(-30, -10), life: 260, ramp: TRAP_RAMP, tex: TEX.px1 });
    }
  });
  build = 1;

  // ---- 450–640 the incoming attack streaks into the shell
  const src = attackers[0] ?? { x: cScr.x - fs * 60, y: cScr.y + fs * 60 };
  const streak = new Raster(scene, Math.min(src.x, hit.x) - 12, Math.min(src.y, hit.y) - 12, Math.abs(src.x - hit.x) + 24, Math.abs(src.y - hit.y) + 24, DEPTH.FX + 4);
  snd('beamFire', 0.6, 1.2);
  await run(scene, 170, (t) => {
    const kk = E.inQuad(t);
    const hx = lerp(src.x, hit.x, kk);
    const hy = lerp(src.y, hit.y, kk);
    const tx = lerp(src.x, hit.x, Math.max(0, kk - 0.35));
    const ty = lerp(src.y, hit.y, Math.max(0, kk - 0.35));
    streak.draw((g) => {
      glowStroke(g, [{ x: tx, y: ty }, { x: hx, y: hy }], [PAL.crim1, PAL.crim3, PAL.crim4, PAL.white], 1.6);
      g.disc(hx, hy, 3.5, PAL.white);
    });
  });
  streak.destroy();
  // ---- block: hit-stop, hex ripple, sparks
  opts.onBlock?.();
  snd('shieldBlock', 1);
  snd('impactHeavy', 0.6, 1.3);
  rippleT = 0;
  flashAll = 0.6;
  sparks.burst(30, () => {
    const a = rr(0, TAU);
    const sp = rr(60, 200);
    return { x: hit.x, y: hit.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, drag: 3.5, life: rr(240, 480), ramp: TRAP_RAMP, tex: rnd() < 0.3 ? TEX.plus : TEX.px1, trail: true };
  });
  const star = scene.add.image(hit.x, hit.y, TEX.spark).setScale(5).setTint(PAL.white).setDepth(DEPTH.FX + 7);
  void shake(scene, 220, 3);
  await hitStop(scene, 80);
  void run(scene, 160, (t) => star.setScale(Math.max(1, Math.round(5 * (1 - t))))).then(() => star.destroy());
  void run(scene, 140, (t) => (flashAll = 0.6 * (1 - t)));
  await run(scene, 300, (t) => (rippleT = t));
  rippleT = -1;

  // ---- charge: the shell glows hotter, light gathers at the impact point
  snd('beamCharge', 0.7, 1.4);
  await run(scene, 220, (t) => {
    charge = E.inQuad(t);
    if (rnd() < 0.8) {
      const a = rr(0, TAU);
      const r = rr(20, 40);
      sparks.add({ x: hit.x + Math.cos(a) * r, y: hit.y + Math.sin(a) * r * 0.6, home: { x: hit.x, y: hit.y, k: 0.4 }, life: 200, ramp: [PAL.mag4, PAL.white], tex: TEX.px1 });
    }
  });

  // ---- reflect: one beam per attacker
  snd('mirror', 1, 1.3);
  snd('beamFire', 1, 1.1);
  flashAll = 1;
  void flash(scene, 120, PAL.mag4, 0.35);
  const beams = attackers.map((p, i) => {
    const from = toward(p);
    const r = new Raster(scene, Math.min(from.x, p.x) - 14, Math.min(from.y, p.y) - 14, Math.abs(from.x - p.x) + 28, Math.abs(from.y - p.y) + 28, DEPTH.FX + 5);
    return { from, to: p, r, i, hitDone: false };
  });
  void shake(scene, 300, 4);
  await run(scene, 420, (t, el) => {
    charge = Math.max(0, 1 - t * 2);
    flashAll = Math.max(0, 1 - t * 3);
    for (const b of beams) {
      const lt = clamp01((el - b.i * 45) / 110); // head travel
      const fade = seg(t, 0.55, 1);
      b.r.draw((g) => {
        if (lt <= 0) return;
        const hx = lerp(b.from.x, b.to.x, E.outQuad(lt));
        const hy = lerp(b.from.y, b.to.y, E.outQuad(lt));
        const wob = Math.sin(el * 0.08 + b.i) * 0.4;
        glowStroke(g, [b.from, { x: hx, y: hy }], [PAL.mag1, PAL.mag3, PAL.mag4, PAL.white], Math.max(0.6, 2.4 * (1 - fade) + wob), 1 - fade * 0.8);
        // thinner companion rays fanning from neighbouring hexes
        for (const o of [-1, 1]) {
          const lt2 = clamp01(lt * 1.15 - 0.1);
          if (lt2 <= 0 || fade > 0.7) continue;
          const fx = b.from.x + o * 9;
          const fy = b.from.y + o * 5 + 4;
          const ex = lerp(fx, b.to.x + o * 3, E.outQuad(lt2));
          const ey = lerp(fy, b.to.y - o * 2, E.outQuad(lt2));
          g.line(fx, fy, ex, ey, PAL.mag3, 1 - fade);
          g.line(fx, fy - 1, ex, ey - 1, Math.floor(el / 34) % 2 ? PAL.white : PAL.mag4, 1 - fade);
        }
        if (lt >= 1 && fade < 0.6) {
          g.disc(b.to.x, b.to.y, 7 * (1 - fade), PAL.mag4, 0.8);
          g.disc(b.to.x, b.to.y, 4 * (1 - fade), PAL.white);
        }
      });
      if (lt >= 1 && !b.hitDone) {
        b.hitDone = true;
        opts.onHit?.(b.i);
        snd('impactHeavy', 0.8);
        sparks.burst(22, () => {
          const a = rr(0, TAU);
          const sp = rr(60, 190);
          return { x: b.to.x, y: b.to.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - 30, ay: 300, drag: 2, life: rr(260, 520), ramp: TRAP_RAMP, trail: true, tex: rnd() < 0.3 ? TEX.px2 : TEX.px1 };
        });
      }
    }
  });
  beams.forEach((b) => b.r.destroy());

  // ---- the dome shatters into hex shards (background)
  void (async () => {
    snd('shatter', 0.7, 1.4);
    sparks.burst(40, () => {
      const p = toward({ x: cScr.x + rr(-90, 90), y: cScr.y - fs * rr(20, 60) });
      return { x: p.x + rr(-10, 10), y: p.y + rr(-30, 10), vx: rr(-40, 40), vy: rr(-40, 10), ay: 260, life: rr(380, 700), ramp: [PAL.white, PAL.mag4, PAL.mag3, PAL.mag2], tex: rnd() < 0.4 ? TEX.px2 : TEX.plus };
    });
    await run(scene, 340, (t) => (shatter = E.outQuad(t) * 1.15));
    stopDraw();
    far.destroy();
    nearR.destroy();
    base.destroy();
    sparks.close();
  })();
}

// ------------------------------------------------------------------ Işık Zincirleri — chainsBind

export interface ChainOpts {
  /** The target's home position: the chains drag it back there. Default: it only jolts in place. */
  home?: XY;
}

/** Draw a run of chain links along a polyline, up to `len` px. Returns the end point. */
function drawChain(g: Raster, pts: readonly XY[], len: number, glow: number, phase = 0): XY {
  let acc = 0;
  let next = 0;
  let idx = 0;
  let end = pts[0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const sl = Math.hypot(b.x - a.x, b.y - a.y);
    if (sl < 0.01) continue;
    const ux = (b.x - a.x) / sl;
    const uy = (b.y - a.y) / sl;
    while (next <= acc + sl && next <= len) {
      const t = (next - acc) / sl;
      const cx = a.x + (b.x - a.x) * t;
      const cy = a.y + (b.y - a.y) * t;
      const hot = (idx + phase) % 7 === 0;
      if (glow > 0 && idx % 2 === 0) g.disc(cx, cy, 3.4, PAL.mag1, 0.3 * glow);
      if (idx % 2 === 0) {
        // face-on oval link
        for (let s = 0; s < 16; s++) {
          const an = (s / 16) * TAU;
          const px = cx + ux * Math.cos(an) * 2.6 - uy * Math.sin(an) * 1.7;
          const py = cy + uy * Math.cos(an) * 2.6 + ux * Math.sin(an) * 1.7;
          g.px(px, py, hot ? PAL.white : Math.sin(an) < 0 ? PAL.gold4 : PAL.gold3);
        }
      } else {
        // edge-on link
        g.line(cx - ux * 2.5, cy - uy * 2.5, cx + ux * 2.5, cy + uy * 2.5, hot ? PAL.white : PAL.gold4);
        g.px(cx - uy, cy + ux, PAL.gold2);
      }
      end = { x: cx, y: cy };
      idx++;
      next += 4;
    }
    acc += sl;
    if (next > len) break;
  }
  return end;
}

function pathLength(pts: readonly XY[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return l;
}

/**
 * Chains of light (~1.3 s main beat): three glowing gold chains with magenta halos shoot from
 * the trap card (fromXY), coil around the target (back half behind it, front half in front),
 * lock with a clank (hit-stop, white flash, padlock sigils) and drag it back to `home`.
 * The chains then dissolve into light on their own.
 */
export async function chainsBind(scene: Phaser.Scene, fromXY: XY, target: Unit, opts: ChainOpts = {}): Promise<void> {
  const origin = { x: Math.round(fromXY.x), y: Math.round(fromXY.y - 8) };
  const fly = new Raster(scene, 0, 0, GAME_W, GAME_H, DEPTH.FX + 3);
  const backR = Raster.around(scene, target.x, target.y, 160, 160, unitDepth(target.y) - 1);
  const frontR = Raster.around(scene, target.x, target.y, 160, 160, unitDepth(target.y) + 1);
  const sparks = new Sparks(scene, DEPTH.FX + 5);
  const box0 = spriteBox(scene, target);
  // binding heights relative to the target's feet
  const rel = [0.32, 0.55, 0.78].map((f) => ({ dy: box0.bottom - target.y - box0.h * (1 - f) - (box0.bottom - target.y), hw: Math.max(8, box0.halfAt(box0.top + box0.h * f) + 3) }));
  const bend = [-0.6, 0.15, 0.6];
  let shoot = [0, 0, 0];
  let wrap = [0, 0, 0];
  let locked = 0;
  let dissolve = 0;
  let glow = 1;
  let phase = 0;

  const anchorOf = (i: number): XY => ({ x: target.x - (target.flipX ? -1 : 1) * rel[i].hw, y: target.y + rel[i].dy });
  const pathTo = (i: number, straight: number): XY[] => {
    const end = anchorOf(i);
    const mid = { x: (origin.x + end.x) / 2, y: (origin.y + end.y) / 2 };
    const dx = end.x - origin.x;
    const dy = end.y - origin.y;
    const l = Math.hypot(dx, dy) || 1;
    const off = (1 - straight) * 34 * bend[i];
    const ctrl = { x: mid.x - (dy / l) * off, y: mid.y + (dx / l) * off - (1 - straight) * 26 };
    const pts: XY[] = [];
    for (let s = 0; s <= 24; s++) pts.push(qbez(origin, ctrl, end, s / 24));
    return pts;
  };
  let straighten = 0;
  const draw = () => {
    fly.draw((g) => {
      for (let i = 0; i < 3; i++) {
        if (shoot[i] <= 0) continue;
        const pts = pathTo(i, straighten);
        const L = pathLength(pts);
        const shown = L * shoot[i];
        const start = L * dissolve;
        if (start >= shown) continue;
        // skip the dissolved part by trimming the polyline
        let acc = 0;
        const tail: XY[] = [];
        for (let k2 = 0; k2 < pts.length; k2++) {
          if (k2 > 0) acc += Math.hypot(pts[k2].x - pts[k2 - 1].x, pts[k2].y - pts[k2 - 1].y);
          if (acc >= start) tail.push(pts[k2]);
        }
        const head = drawChain(g, tail, shown - start, glow, phase + i * 3);
        if (shoot[i] < 1) {
          // spear head
          g.disc(head.x, head.y, 2.5, PAL.mag4);
          g.disc(head.x, head.y, 1.5, PAL.white);
        }
      }
    });
    const ringPts = (i: number, front: boolean): XY[] => {
      const out: XY[] = [];
      const a = anchorOf(i);
      const c = { x: target.x, y: a.y };
      const rx = rel[i].hw;
      const ry = 3.5;
      const start = Math.atan2((a.y - c.y) / ry, (a.x - c.x) / rx);
      const n = 28;
      for (let s = 0; s <= n * wrap[i]; s++) {
        const an = start + (s / n) * TAU;
        const p = { x: c.x + Math.cos(an) * rx, y: c.y + Math.sin(an) * ry };
        if (Math.sin(an) >= 0 === front) out.push(p);
        else if (out.length) {
          if (front) break;
        }
      }
      return out;
    };
    for (const [r, front] of [
      [backR, false],
      [frontR, true],
    ] as const) {
      r.moveTo(Math.round(target.x - 80), Math.round(target.y - 80));
      r.img.setDepth(unitDepth(target.y) + (front ? 1 : -1));
      r.draw((g) => {
        if (dissolve >= 1) return;
        for (let i = 0; i < 3; i++) {
          if (wrap[i] <= 0) continue;
          const a = anchorOf(i);
          const c = { x: target.x, y: a.y };
          const rx = rel[i].hw;
          const ry = 3.5;
          const st = Math.atan2((a.y - c.y) / ry, (a.x - c.x) / rx);
          const n = 30;
          let prev: XY | null = null;
          const seg2: XY[] = [];
          const flush = () => {
            if (seg2.length > 1) drawChain(g, seg2, 999, glow * (front ? 1 : 0.5), phase + i);
            seg2.length = 0;
          };
          for (let s = 0; s <= Math.ceil(n * wrap[i]); s++) {
            const an = st + (Math.min(s, n * wrap[i]) / n) * TAU;
            const p = { x: c.x + Math.cos(an) * rx, y: c.y + Math.sin(an) * ry };
            const isFront = Math.sin(an) >= 0;
            if (isFront === front) seg2.push(p);
            else flush();
            prev = p;
          }
          flush();
          void prev;
          // padlock sigil on the front of the coil
          if (front && locked > 0) {
            const lx = c.x;
            const ly = c.y + ry + 1;
            const pop = locked > 0.7 ? 1 : 0;
            g.rect(lx - 2, ly - 1, 5, 4, PAL.mag3);
            g.rect(lx - 1, ly, 3, 2, pop ? PAL.white : PAL.mag4);
            g.ring(lx + 0.5, ly - 1.5, 1.8, 1.8, PAL.mag4, 1, Math.PI, TAU);
          }
        }
      });
    }
  };
  // hide unused helper warnings
  void (null as unknown as typeof draw);
  const stopDraw = onFrame(scene, (_dt, el) => {
    phase = Math.floor(el / 60);
    draw();
  });

  // ---- 0–330 shoot
  snd('chains', 0.9);
  await run(scene, 330, (t, el) => {
    shoot = [0, 1, 2].map((i) => E.outCubic(clamp01((el - i * 45) / 230)));
    if (rnd() < 0.6) sparks.add({ x: origin.x + rr(-4, 4), y: origin.y + rr(-3, 3), vx: rr(-30, 30), vy: rr(-50, -10), life: 240, ramp: TRAP_RAMP });
  });
  shoot = [1, 1, 1];
  // ---- 330–530 wrap
  await run(scene, 200, (t, el) => {
    wrap = [0, 1, 2].map((i) => E.outCubic(clamp01((el - i * 25) / 170)));
    straighten = E.outQuad(t) * 0.6;
  });
  wrap = [1, 1, 1];
  // ---- lock: clank
  locked = 1;
  snd('chains', 1, 0.7);
  snd('shieldBlock', 0.6, 0.6);
  if (target.active) target.setTintFill(PAL.white);
  for (let i = 0; i < 3; i++) {
    const a = anchorOf(i);
    sparks.burst(8, () => ({ x: target.x, y: a.y + 4, vx: rr(-90, 90), vy: rr(-80, 10), ay: 300, drag: 2, life: rr(200, 380), ramp: [PAL.white, PAL.gold4, PAL.mag3], trail: true }));
  }
  void shake(scene, 160, 2);
  await hitStop(scene, 60);
  if (target.active) target.clearTint();
  void addGlow(scene, target, PAL.mag3, 300, 0.6);
  // ---- drag back home
  const fromPos = { x: target.x, y: target.y };
  const home = opts.home ?? { x: target.x, y: target.y };
  snd('whoosh', 0.5, 0.7);
  await run(scene, 360, (t) => {
    locked = t < 0.5 ? 1 : 0.6;
    straighten = 0.6 + 0.4 * E.outQuad(t);
    if (!target.active) return;
    if (opts.home) {
      const k2 = E.outBack(t);
      target.setPosition(Math.round(lerp(fromPos.x, home.x, k2)), Math.round(lerp(fromPos.y, home.y, k2)));
    } else {
      const j = Math.sin(t * Math.PI * 3) * (1 - t) * 3;
      target.setPosition(Math.round(fromPos.x + j), fromPos.y);
    }
  });
  if (target.active) target.setPosition(Math.round(home.x), Math.round(home.y));
  target.setDepth?.(unitDepth(target.y));
  void floorRing(scene, home.x, home.y, { r0: 10, r1: 44, ms: 360, ramp: [PAL.mag4, PAL.mag3, PAL.mag2], depth: DEPTH.SHADOW - 1 });
  snd('chains', 0.7, 1.2);
  await sleep(scene, 160);
  // main beat done — chains glow, then dissolve into light
  void (async () => {
    await sleep(scene, 250);
    await run(scene, 380, (t) => {
      dissolve = E.inQuad(t);
      glow = 1 - t;
      if (rnd() < 0.9) {
        const i = Math.floor(rnd() * 3);
        const pts = pathTo(i, 1);
        const p = pts[Math.floor(dissolve * (pts.length - 1))];
        sparks.add({ x: p.x + rr(-2, 2), y: p.y + rr(-2, 2), vy: rr(-40, -15), life: rr(240, 400), ramp: [PAL.white, PAL.gold4, PAL.mag3], tex: TEX.px1 });
      }
    });
    wrap = [0, 0, 0];
    stopDraw();
    fly.destroy();
    backR.destroy();
    frontR.destroy();
    sparks.close();
  })();
}

// ------------------------------------------------------------------ Yer Yarığı — chasm

/**
 * Chasm trap (~1.3 s main beat): glowing cracks race out from under the monster, the ground
 * splits into a magenta-lit abyss, the monster drops into it (geometry mask at the hole's front
 * lip), rocks tumble in, and the crack slams shut with dust and a shake. When the promise
 * resolves the sprite is HIDDEN (visible=false), unmasked and back at its original position.
 */
export async function chasm(scene: Phaser.Scene, x: number, y: number, sprite: Unit): Promise<void> {
  x = Math.round(x);
  y = Math.round(y);
  const box = spriteBox(scene, sprite);
  const RX = Math.max(30, Math.round(box.w * 0.55));
  const RY = Math.round(RX / 2);
  const floor = Raster.around(scene, x, y, RX * 2 + 90, RX + 60, DEPTH.SHADOW - 1);
  const sparks = new Sparks(scene, DEPTH.FX + 3);
  const dust = new Sparks(scene, unitDepth(y) + 2);
  // jagged rim profile
  const NJ = 40;
  const jag = Array.from({ length: NJ }, (_, i) => 0.86 + rnd() * 0.22 + (i % 3 === 0 ? 0.08 : 0));
  const cracks = Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * TAU + rr(-0.25, 0.25);
    const len = rr(RX * 0.9, RX * 1.5);
    return boltPath({ x, y }, { x: x + Math.cos(a) * len, y: y + Math.sin(a) * len * 0.5 }, 5, 3);
  });
  let crackT = 0;
  let open = 0;
  let glowK = 0;
  let closing = false;
  const rim = (an: number, r: number): XY => {
    const i = ((Math.round((an / TAU) * NJ) % NJ) + NJ) % NJ;
    const j = jag[i];
    return { x: x + Math.cos(an) * RX * r * j, y: y + Math.sin(an) * RY * r * j };
  };
  const drawFloor = (el: number) => {
    floor.draw((g) => {
      // glowing cracks
      for (const c of cracks) {
        const n = Math.max(2, Math.floor(c.length * crackT));
        const pts = c.slice(0, n);
        g.path(pts, PAL.mag1, 1, 3);
        g.path(pts, closing ? PAL.mag3 : PAL.mag3, glowK > 0.2 ? 1 : 0.6);
        if (crackT > 0.3) g.path(pts.slice(0, Math.floor(n * 0.6)), PAL.mag4, 1);
      }
      if (open <= 0.01) return;
      // the hole
      const poly: XY[] = [];
      for (let i = 0; i < NJ; i++) poly.push(rim((i / NJ) * TAU, open));
      g.poly(poly, PAL.ink);
      // far inner wall: strata bands under the back rim
      for (let i = 0; i < NJ; i++) {
        const an = (i / NJ) * TAU;
        if (Math.sin(an) > -0.05) continue; // back half only
        const wallH = Math.round(13 * open * Math.pow(-Math.sin(an), 0.8));
        const p = rim(an, open);
        const q = rim(((i + 1) / NJ) * TAU, open);
        const steps = Math.max(1, Math.ceil(Math.abs(q.x - p.x)));
        for (let s = 0; s <= steps; s++) {
          const xx = lerp(p.x, q.x, s / steps);
          const yy = lerp(p.y, q.y, s / steps);
          for (let d = 0; d < wallH; d++) {
            const f = d / Math.max(1, wallH);
            let c: number = d < 1 ? PAL.earth2 : f < 0.3 ? PAL.earth1 : f < 0.55 ? PAL.earth0 : PAL.void0;
            if ((d + Math.floor(xx * 0.3)) % 4 === 0 && d > 1 && f < 0.55) c = PAL.earth0;
            // the abyss glow climbs the lower wall
            if (f > 0.55 && bayer(Math.round(xx), Math.round(yy + d)) < (f - 0.55) * 1.6 * glowK) c = f > 0.85 ? PAL.mag2 : PAL.mag1;
            g.px(xx, yy + d, c);
          }
        }
      }
      // abyss glow deep inside
      const pulse = 0.7 + 0.3 * Math.sin(el * 0.012);
      g.ell(x, y + RY * 0.25 * open, RX * 0.55 * open, RY * 0.4 * open, PAL.mag1, 0.7 * pulse * glowK);
      g.ell(x, y + RY * 0.3 * open, RX * 0.3 * open, RY * 0.22 * open, PAL.mag2, 0.6 * pulse * glowK);
      // rim: lit lip
      for (let i = 0; i < NJ; i++) {
        const p = rim((i / NJ) * TAU, open);
        const q = rim(((i + 1) / NJ) * TAU, open);
        const front = Math.sin((i / NJ) * TAU) > 0;
        g.line(p.x, p.y, q.x, q.y, front ? PAL.mag3 : PAL.earth3);
        if (front) g.line(p.x, p.y + 1, q.x, q.y + 1, PAL.mag1);
      }
    });
  };
  const stopDraw = onFrame(scene, (_dt, el) => drawFloor(el));

  // ---- 0–300 the ground cracks
  snd('groundCrack', 1);
  snd('trapActivate', 0.5, 0.8);
  void shake(scene, 420, 1);
  await run(scene, 300, (t) => {
    crackT = E.outCubic(t);
    glowK = t;
    if (rnd() < 0.5) dust.add({ x: x + rr(-RX, RX), y: y + rr(-RY, RY) * 0.8, vy: rr(-40, -15), ay: 160, life: rr(200, 380), ramp: [PAL.earth3, PAL.earth2, PAL.earth1], tex: TEX.px1 });
  });

  // mask: everything above the hole's front lip (and above the floor line outside the hole)
  const maskG = scene.make.graphics({ x: 0, y: 0 }, false);
  const updateMask = () => {
    maskG.clear();
    maskG.fillStyle(0xffffff, 1);
    const pts: XY[] = [
      { x: -50, y: -400 },
      { x: GAME_W + 50, y: -400 },
      { x: GAME_W + 50, y },
    ];
    for (let i = 0; i <= 20; i++) {
      const an = (i / 20) * Math.PI; // 0 → π along the front lip (right → left)
      const p = rim(an, open);
      pts.push({ x: p.x, y: Math.max(y, p.y) });
    }
    pts.push({ x: -50, y });
    maskG.fillPoints(pts.map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);
  };
  updateMask();
  const mask = maskG.createGeometryMask();
  const sx0 = sprite.x;
  const sy0 = sprite.y;
  sprite.setMask(mask);
  const rocks: Phaser.GameObjects.Image[] = [];

  // ---- 300–480 the abyss opens
  snd('earthQuake', 0.8);
  void shake(scene, 260, 2);
  await run(scene, 180, (t) => {
    open = E.outBack(t);
    glowK = 1;
    updateMask();
    if (sprite.active) sprite.setPosition(Math.round(sx0 + Math.sin(t * 40) * 1), sy0 + Math.round(t * 3));
  });
  sparks.burst(18, () => {
    const p = rim(rr(0, TAU), 1);
    return { x: p.x, y: p.y, vx: rr(-30, 30), vy: rr(-90, -40), ay: 300, life: rr(300, 500), ramp: [PAL.mag4, PAL.mag3, PAL.earth3, PAL.earth2], trail: true };
  });

  // ---- 480–960 the monster drops in, rocks tumble after it
  snd('whoosh', 0.6, 0.6);
  const fall = box.h + 40;
  const fallP = run(scene, 480, (t) => {
    if (!sprite.active) return;
    const k2 = E.inQuad(t);
    sprite.setPosition(Math.round(sx0 + Math.sin(t * 30) * (1 - t) * 1.5), Math.round(sy0 + 3 + k2 * fall));
    const d = Math.round(255 - k2 * 150);
    sprite.setTint((d << 16) | (d << 8) | Math.min(255, d + 20));
  });
  for (let i = 0; i < 7; i++) {
    void (async () => {
      await sleep(scene, 60 + i * 55);
      const an = rr(Math.PI * 1.05, Math.PI * 1.95); // from the back rim
      const p = rim(an, 1);
      const img = scene.add.image(p.x, p.y - 2, 'set:rock', `k${i % 4}`).setDepth(unitDepth(y) + 1);
      img.setMask(mask);
      rocks.push(img);
      const vx = (x - p.x) * rr(0.8, 1.6);
      let vy = rr(-50, -10);
      let px = p.x;
      let py = p.y - 2;
      await run(scene, 520, (_t, _el, dt) => {
        const s2 = dt / 1000;
        vy += 520 * s2;
        px += vx * s2;
        py += vy * s2;
        img.setPosition(Math.round(px), Math.round(py));
        if (dt > 0 && rnd() < 0.15) img.setFlipX(!img.flipX);
      });
      img.setVisible(false);
    })();
  }
  await fallP;
  if (sprite.active) sprite.setVisible(false);

  // ---- 960–1250 it slams shut
  closing = true;
  snd('earthQuake', 1, 0.8);
  await run(scene, 200, (t) => {
    open = 1 - E.inCubic(t);
    updateMask();
  });
  open = 0;
  snd('impactHeavy', 0.9, 0.7);
  void shake(scene, 260, 3);
  void floorRing(scene, x, y, { r0: 6, r1: RX + 30, ms: 420, ramp: [PAL.mag4, PAL.mag3, PAL.earth3, PAL.earth2], depth: DEPTH.SHADOW - 1 });
  dust.burst(22, (i) => {
    const a = (i / 22) * TAU;
    return { x: x + Math.cos(a) * RX * 0.5, y: y + Math.sin(a) * RY * 0.5 - 2, vx: Math.cos(a) * rr(30, 70), vy: Math.sin(a) * 18 - rr(10, 30), drag: 2.5, life: rr(400, 700), ramp: [PAL.earth3, PAL.earth2, PAL.stone2, PAL.stone1], tex: TEX.dot5 };
  });
  sparks.burst(14, () => ({ x: x + rr(-RX, RX) * 0.6, y: y + rr(-3, 3), vy: rr(-120, -50), vx: rr(-30, 30), ay: 200, life: rr(240, 420), ramp: TRAP_RAMP, tex: TEX.px1 }));
  // restore the sprite (hidden) so the caller can sync/destroy it
  if (sprite.active) {
    sprite.clearMask();
    sprite.clearTint();
    sprite.setPosition(sx0, sy0);
  }
  await sleep(scene, 90);
  // cracks cool down in the background
  void (async () => {
    await run(scene, 600, (t) => {
      glowK = 1 - t;
      crackT = 1 - E.inQuad(t);
    });
    stopDraw();
    floor.destroy();
    rocks.forEach((r) => r.destroy());
    mask.destroy();
    maskG.destroy();
    sparks.close();
    dust.close();
  })();
}


