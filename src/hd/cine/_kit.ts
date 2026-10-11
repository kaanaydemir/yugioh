// HD trial cine — shared kit for the trial sequence (src/hd/cine/sequence.ts).
//
// Everything runs on SCENE time (onTick / tweens / scene.time): the shell's Space key scales it, hit-stop freezes it,
// and tools/shot.mjs --film steps it deterministically. Helpers here:
//   Cine            per-run context: scene, kit, arena, units, rng, abort-aware run()/sleep(), cleanup bag
//   Mood            ambient dimming so the one event light dominates (docs/STYLE_HD.md §5 "tek odak")
//   PixG            a Graphics in a bloom layer that draws crisp 1 px pixels / Bresenham lines / iso rings
//   Sparks          crisp pixel particles (dots, streaks, plus, stars) with colour ramps, gravity, floor bounce
//   soft()          soft additive light sprites (SOFT.glow / core / ring / streak) in a bloom layer
//   RasterFx        a PixelCanvas re-uploaded per frame (dense pixel effects: beam, pillar, circles, flames)

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { PixelCanvas, mulberry32 } from '../../art/pixel';
import type { PlayerId } from '../../engine/types';
import { onTick, ringPixels } from '../../vfx/particles';
import { wait } from '../../vfx/core';
import { sfx, type SfxName } from '../../audio/sfx';
import type { HDSceneContext } from '../app/api';
import { SOFT, type GlowWhere } from '../app/fx';
import type { HDKit } from '../app/kit';
import type { LightHandle } from '../app/lighting';
import type { HDMonsterSprite } from '../app/units';

export const ADD = Phaser.BlendModes.ADD;
export const TAU = Math.PI * 2;

export interface XY {
  x: number;
  y: number;
}

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const inv = (a: number, b: number, v: number) => clamp((v - a) / (b - a));

/** Easing (t in 0..1). */
export const E = {
  inQ: (t: number) => t * t,
  outQ: (t: number) => 1 - (1 - t) * (1 - t),
  inOutQ: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outC: (t: number) => 1 - Math.pow(1 - t, 3),
  inC: (t: number) => t * t * t,
  outExpo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutS: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t: number, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  smooth: (t: number) => t * t * (3 - 2 * t),
};

/** Attack-sustain-release envelope over t (0..1). */
export function env(t: number, a: number, s: number, r: number): number {
  if (t <= 0) return 0;
  if (t < a) return t / a;
  if (t < a + s) return 1;
  if (t < a + s + r) return 1 - (t - a - s) / r;
  return 0;
}

/** Spectral fringe of the prism (red → violet), palette colours only. */
export const RAINBOW = [PAL.crim3, PAL.fire3, PAL.gold3, PAL.leaf3, PAL.teal3, PAL.cyan3, PAL.water3, PAL.void3, PAL.mag3] as const;
export const GOLD = [PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4, PAL.white] as const;
export const FIRE = [PAL.fire0, PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4] as const;
export const ICE = [PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white] as const;

// ================================================================ context

export class Cine {
  readonly scene: Phaser.Scene;
  readonly kit: HDKit;
  readonly ctx: HDSceneContext;
  readonly mood: Mood;
  readonly rnd: () => number;
  private bag: (() => void)[] = [];

  constructor(ctx: HDSceneContext) {
    this.ctx = ctx;
    this.scene = ctx.scene;
    this.kit = ctx.kit;
    this.rnd = mulberry32(0x7d1a1);
    this.mood = new Mood(this);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dispose());
  }

  get aborted(): boolean {
    return this.ctx.signal.aborted || !this.scene.sys.isActive();
  }

  /** Throw (swallowed by the shell) when the scene restarted mid-sequence. */
  check(): void {
    if (this.aborted) throw new Error('aborted');
  }

  R(a = 0, b = 1): number {
    return a + (b - a) * this.rnd();
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.rnd() * arr.length) % arr.length];
  }

  async sleep(ms: number): Promise<void> {
    await wait(this.scene, ms);
    this.check();
  }

  /** fn(t, dt, elapsed) every frame for `ms` of scene time (t eased). Resolves at t = 1. */
  run(ms: number, fn: (t: number, dt: number, el: number) => void, ease: (t: number) => number = (t) => t): Promise<void> {
    return new Promise((resolve) => {
      if (this.aborted) return resolve();
      if (ms <= 0) {
        fn(1, 0, 0);
        return resolve();
      }
      fn(ease(0), 0, 0);
      onTick(this.scene, (dt, el) => {
        if (this.aborted) {
          resolve();
          return true;
        }
        const t = Math.min(1, el / ms);
        fn(ease(t), dt, el);
        if (t >= 1) {
          resolve();
          return true;
        }
        return false;
      });
    });
  }

  /** fn(dt, elapsed) every frame until it returns false (or the scene ends). Returns a stopper. */
  loop(fn: (dt: number, el: number) => boolean | void): () => void {
    return onTick(this.scene, (dt, el) => {
      if (this.aborted) return true;
      return fn(dt, el) === false;
    });
  }

  /** Register cleanup (runs on dispose / scene shutdown). */
  own(fn: () => void): void {
    this.bag.push(fn);
  }

  dispose(): void {
    for (const f of this.bag.splice(0).reverse()) {
      try {
        f();
      } catch {
        /* already gone */
      }
    }
  }

  /** A synthesized sound (silent no-op headless / before the first gesture). */
  sound(name: SfxName, volume = 1, pitch = 1, pan = 0): void {
    try {
      sfx.play(name, { volume, pitch, pan });
    } catch {
      /* no audio */
    }
  }

  /** Point light that is removed with the run. */
  light(x: number, y: number, color: number, radius: number, intensity: number, height = 60): LightHandle {
    const h = this.kit.lighting.addPointLight(x, y, color, radius, intensity, height);
    this.own(() => h.destroy());
    return h;
  }

  /** Soft additive light sprite in a bloom layer. */
  soft(x: number, y: number, tex: keyof typeof SOFT, color: number, w: number, h: number, alpha = 1, where: GlowWhere = 'front'): Phaser.GameObjects.Image {
    const im = this.scene.add.image(x, y, SOFT[tex]).setDisplaySize(w, h).setTint(color).setAlpha(alpha).setBlendMode(ADD);
    this.kit.fx.glow(im, where);
    this.own(() => im.destroy());
    return im;
  }

  unit(p: PlayerId): HDMonsterSprite {
    return p === 0 ? this.ctx.p1 : this.ctx.p2;
  }
}

// ================================================================ mood (ambient)

/**
 * The theme's ambient scaled by `k` and blended toward a tint: events dim the arena so their own light dominates
 * (docs/STYLE_HD.md §5: one dominant light at a time), then the neon mood comes back.
 */
export class Mood {
  private k = 1;
  private tint = 0xffffff;
  private tk = 0;
  constructor(private c: Cine) {
    c.own(() => this.apply(1, 0));
  }
  private apply(k: number, tk: number): void {
    const th = this.c.ctx.theme.lighting;
    const a = th.ambient;
    const ar = (a >> 16) & 255;
    const ag = (a >> 8) & 255;
    const ab = a & 255;
    const r = lerp(ar, (this.tint >> 16) & 255, tk);
    const g = lerp(ag, (this.tint >> 8) & 255, tk);
    const b = lerp(ab, this.tint & 255, tk);
    const col = (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
    this.c.kit.lighting.ambient(col, th.ambientIntensity * k);
  }
  /** Tween to ambient × k (1 = the theme's mood), optionally tinted. */
  to(k: number, ms: number, tint?: number, tintAmount = 0): Promise<void> {
    const k0 = this.k;
    const t0 = this.tk;
    if (tint !== undefined) this.tint = tint;
    return this.c.run(
      ms,
      (t) => {
        this.k = lerp(k0, k, t);
        this.tk = lerp(t0, tintAmount, t);
        this.apply(this.k, this.tk);
      },
      E.inOutS,
    );
  }
}

// ================================================================ crisp pixel graphics

/** A Graphics that paints crisp single pixels (integer rects). Lives in a bloom layer (additive) or at a depth. */
export class PixG {
  readonly g: Phaser.GameObjects.Graphics;
  constructor(c: Cine, where: GlowWhere | number, blend: Phaser.BlendModes = ADD) {
    this.g = c.scene.add.graphics().setBlendMode(blend);
    if (typeof where === 'number') this.g.setDepth(where);
    else c.kit.fx.glow(this.g, where);
    c.own(() => this.g.destroy());
  }
  clear(): this {
    this.g.clear();
    return this;
  }
  px(x: number, y: number, c: number, a = 1, s = 1): this {
    if (a <= 0.003) return this;
    this.g.fillStyle(c, Math.min(1, a));
    this.g.fillRect(Math.round(x - (s - 1) / 2), Math.round(y - (s - 1) / 2), s, s);
    return this;
  }
  rect(x: number, y: number, w: number, h: number, c: number, a = 1): this {
    if (a <= 0.003) return this;
    this.g.fillStyle(c, Math.min(1, a));
    this.g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    return this;
  }
  /** Bresenham line (1 px), optional colour fade from `c0` at the start to `c1` at the end. */
  line(x0: number, y0: number, x1: number, y1: number, c: number, a = 1, c1?: number, a1?: number): this {
    let ax = Math.round(x0);
    let ay = Math.round(y0);
    const bx = Math.round(x1);
    const by = Math.round(y1);
    const dx = Math.abs(bx - ax);
    const dy = -Math.abs(by - ay);
    const sx = ax < bx ? 1 : -1;
    const sy = ay < by ? 1 : -1;
    let err = dx + dy;
    const n = Math.max(dx, -dy) || 1;
    let i = 0;
    for (;;) {
      const t = i / n;
      const col = c1 !== undefined && t > 0.5 ? c1 : c;
      const al = a1 !== undefined ? lerp(a, a1, t) : a;
      this.px(ax, ay, col, al);
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
      if (++i > 4000) break;
    }
    return this;
  }
  /** 1 px iso ellipse ring (ry = rx/2 for floor circles); optional arc [a0, a1] in floor angle. */
  ring(cx: number, cy: number, rx: number, ry: number, c: number, a = 1, arc?: (ang: number) => number): this {
    const r = ringPixels(rx, ry);
    const x0 = Math.round(cx);
    const y0 = Math.round(cy);
    for (let i = 0; i < r.n; i++) {
      const k = arc ? arc(r.ang[i]) : 1;
      if (k <= 0) continue;
      this.px(x0 + r.xs[i], y0 + r.ys[i], c, a * k);
    }
    return this;
  }
}

// ================================================================ particles

export interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Gravity px/s². */
  ay: number;
  /** Exponential drag (1/s). */
  drag: number;
  age: number;
  life: number;
  /** Colours over life (first = newborn). */
  ramp: readonly number[];
  size: number;
  /** Streak length in seconds of velocity (0 = a dot). */
  streak: number;
  shape: 'dot' | 'plus' | 'star' | 'diamond';
  alpha: number;
  /** Floor y to bounce on (with `bounce` restitution), null = none. */
  floor: number | null;
  bounce: number;
  flicker: boolean;
  /** Fade starts at this fraction of life. */
  fadeAt: number;
  /** Homing target (re-read every frame) with a curl, for converging motes. */
  home?: () => XY;
  curl: number;
  sx: number;
  sy: number;
}

/** Crisp pixel particles in a bloom layer. */
export class Sparks {
  private ps: Spark[] = [];
  private pg: PixG;
  private stop: () => void;
  constructor(
    private c: Cine,
    where: GlowWhere | number = 'front',
    blend: Phaser.BlendModes = ADD,
  ) {
    this.pg = new PixG(c, where, blend);
    this.stop = c.loop((dt) => {
      this.update(dt);
      return true;
    });
    c.own(() => this.stop());
  }
  get count(): number {
    return this.ps.length;
  }
  add(p: Partial<Spark> & { x: number; y: number }): Spark {
    const s: Spark = {
      vx: 0,
      vy: 0,
      ay: 0,
      drag: 0,
      age: 0,
      life: 500,
      ramp: [PAL.white],
      size: 1,
      streak: 0,
      shape: 'dot',
      alpha: 1,
      floor: null,
      bounce: 0.35,
      flicker: false,
      fadeAt: 0.6,
      curl: 0,
      sx: p.x,
      sy: p.y,
      ...p,
    };
    this.ps.push(s);
    return s;
  }
  /** Radial burst. */
  burst(x: number, y: number, n: number, o: Partial<Spark> & { speed: [number, number]; dir?: number; spread?: number; squash?: number; up?: number; lifeR?: [number, number] }): void {
    const c = this.c;
    for (let i = 0; i < n; i++) {
      const a = (o.dir ?? 0) + (o.spread !== undefined ? c.R(-o.spread, o.spread) : c.R(0, TAU));
      const v = c.R(o.speed[0], o.speed[1]);
      const life = o.lifeR ? c.R(o.lifeR[0], o.lifeR[1]) : (o.life ?? 500);
      this.add({ ...o, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * (o.squash ?? 1) - (o.up ?? 0), life });
    }
  }
  clear(): void {
    this.ps.length = 0;
    this.pg.clear();
  }
  private update(dt: number): void {
    const g = this.pg;
    g.clear();
    const s = dt / 1000;
    const keep: Spark[] = [];
    for (const p of this.ps) {
      p.age += dt;
      if (p.age < 0) {
        keep.push(p);
        continue;
      }
      const t = p.age / p.life;
      if (t >= 1) continue;
      keep.push(p);
      if (p.home) {
        // steer onto the target: ease the position toward it with a sideways curl that dies out
        const h = p.home();
        const k = E.inQ(t);
        const px = lerp(p.sx, h.x, k);
        const py = lerp(p.sy, h.y, k);
        const nx = -(h.y - p.sy);
        const ny = h.x - p.sx;
        const nl = Math.hypot(nx, ny) || 1;
        const cu = Math.sin(t * Math.PI) * p.curl;
        p.vx = (px + (nx / nl) * cu - p.x) / Math.max(s, 1e-4);
        p.vy = (py + (ny / nl) * cu - p.y) / Math.max(s, 1e-4);
        p.x = px + (nx / nl) * cu;
        p.y = py + (ny / nl) * cu;
      } else {
        p.vy += p.ay * s;
        if (p.drag > 0) {
          const k = Math.exp(-p.drag * s);
          p.vx *= k;
          p.vy *= k;
        }
        p.x += p.vx * s;
        p.y += p.vy * s;
        if (p.floor !== null && p.y > p.floor && p.vy > 0) {
          p.y = p.floor;
          p.vy *= -p.bounce;
          p.vx *= 0.6;
        }
      }
      if (p.flicker && Math.floor(p.age / 40) % 3 === 2) continue;
      const col = p.ramp[Math.min(p.ramp.length - 1, Math.floor(t * p.ramp.length))];
      const a = p.alpha * (t < p.fadeAt ? 1 : 1 - (t - p.fadeAt) / (1 - p.fadeAt));
      if (p.streak > 0 && !p.home) {
        const tail = p.ramp[Math.min(p.ramp.length - 1, Math.floor(t * p.ramp.length) + 1)];
        const len = Math.min(26, Math.hypot(p.vx, p.vy) * p.streak);
        const sp = Math.hypot(p.vx, p.vy) || 1;
        g.line(p.x - (p.vx / sp) * len, p.y - (p.vy / sp) * len, p.x, p.y, tail, a * 0.55, col, a);
      } else if (p.streak > 0 && p.home) {
        const sp = Math.hypot(p.vx, p.vy) || 1;
        const len = Math.min(10, sp * p.streak);
        g.line(p.x - (p.vx / sp) * len, p.y - (p.vy / sp) * len, p.x, p.y, p.ramp[p.ramp.length - 1], a * 0.4, col, a);
      }
      const sz = Math.max(1, Math.round(p.size));
      if (p.shape === 'dot') g.px(p.x, p.y, col, a, sz);
      else if (p.shape === 'plus') {
        g.px(p.x, p.y, PAL.white, a);
        g.px(p.x - 1, p.y, col, a).px(p.x + 1, p.y, col, a).px(p.x, p.y - 1, col, a).px(p.x, p.y + 1, col, a);
      } else if (p.shape === 'star') {
        const r = sz + 1;
        g.px(p.x, p.y, PAL.white, a);
        for (let i = 1; i <= r; i++) {
          const aa = a * (1 - i / (r + 1));
          g.px(p.x - i, p.y, col, aa).px(p.x + i, p.y, col, aa).px(p.x, p.y - i, col, aa).px(p.x, p.y + i, col, aa);
        }
      } else {
        g.px(p.x, p.y - 1, col, a).px(p.x - 1, p.y, col, a).px(p.x + 1, p.y, col, a).px(p.x, p.y + 1, col, a);
      }
    }
    this.ps = keep;
  }
}

// ================================================================ per-frame rasters

let rasterSeq = 0;

/**
 * A PixelCanvas shown as an Image, redrawn and re-uploaded on demand. Pixel (0,0) sits at world (x, y) (integers).
 * Put it in a bloom layer (additive light) or at a plain depth.
 */
export class RasterFx {
  readonly pc: PixelCanvas;
  readonly img: Phaser.GameObjects.Image;
  private readonly key: string;
  private readonly tex: Phaser.Textures.CanvasTexture;
  private readonly id: ImageData;
  constructor(
    private c: Cine,
    readonly x: number,
    readonly y: number,
    w: number,
    h: number,
    where: GlowWhere | number,
    blend: Phaser.BlendModes = ADD,
  ) {
    this.key = `hd:cine:raster:${++rasterSeq}`;
    this.pc = new PixelCanvas(w, h);
    this.tex = c.scene.textures.addCanvas(this.key, this.pc.toCanvas())!;
    this.id = new ImageData(this.pc.data as Uint8ClampedArray<ArrayBuffer>, this.pc.w, this.pc.h);
    this.img = c.scene.add.image(Math.round(x), Math.round(y), this.key).setOrigin(0, 0).setBlendMode(blend);
    if (typeof where === 'number') this.img.setDepth(where);
    else c.kit.fx.glow(this.img, where);
    c.own(() => this.destroy());
  }
  draw(fn: (p: PixelCanvas, ox: number, oy: number) => void): void {
    if (!this.img.active) return;
    this.pc.clear();
    fn(this.pc, Math.round(this.x), Math.round(this.y));
    this.tex.context.putImageData(this.id, 0, 0);
    this.tex.refresh();
  }
  destroy(): void {
    if (this.img.active) this.img.destroy();
    if (this.c.scene.textures.exists(this.key)) this.c.scene.textures.remove(this.key);
  }
}

/** Additive pixel write into a PixelCanvas (colour × a added, clamped): light stacking in rasters. */
export function addPx(p: PixelCanvas, x: number, y: number, c: number, a = 1): void {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= p.w || y >= p.h || a <= 0) return;
  const i = (y * p.w + x) * 4;
  const d = p.data;
  d[i] = Math.min(255, d[i] + ((c >> 16) & 255) * a);
  d[i + 1] = Math.min(255, d[i + 1] + ((c >> 8) & 255) * a);
  d[i + 2] = Math.min(255, d[i + 2] + (c & 255) * a);
  d[i + 3] = 255;
}

/** Bresenham into a PixelCanvas (local coords), additive. */
export function addLine(p: PixelCanvas, x0: number, y0: number, x1: number, y1: number, c: number, a = 1): void {
  let ax = Math.round(x0);
  let ay = Math.round(y0);
  const bx = Math.round(x1);
  const by = Math.round(y1);
  const dx = Math.abs(bx - ax);
  const dy = -Math.abs(by - ay);
  const sx = ax < bx ? 1 : -1;
  const sy = ay < by ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 4000; i++) {
    addPx(p, ax, ay, c, a);
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

/** Value noise 1D (deterministic). */
export function noise1(x: number, seed = 0): number {
  const h = (n: number) => {
    const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u);
}

/** Bayer 4×4 threshold in (0,1). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function bayer(x: number, y: number): number {
  return (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
}
