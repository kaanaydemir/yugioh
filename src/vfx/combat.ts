// Combat VFX library — targeting, beams, projectiles, melee smears, lightning, impacts.
//
// Every effect:
//   • takes SCREEN (world) coordinates (use layout.zoneXY / framePointToWorld for sprite points),
//   • is async and resolves at the end of its MAIN BEAT (the moment a cinematic can move on),
//   • cleans itself up (lingering sparks/smoke finish on their own and destroy their objects),
//   • runs on the scene clock scaled by the tween time scale — so core.setSpeed() fast-forwards it
//     and core.hitStop() freezes it mid-frame (that freeze IS the impact frame).
//
// Rendering: everything is rasterized as whole pixels through `Px` (scanline runs into a Graphics),
// so beams, rings and smears stay crisp at 640×360 and only use palette colors.
//
// Typical choreography (see src/dev/previews/vfx-combat.ts for every monster's signature attack):
//
//   const arrow = attackArrow(scene, atkCore, defCore, 0);  const lock = lockOn(scene, defCore.x, defCore.y);
//   await arrow.done; await wait(scene, 250); arrow.destroy(); lock.destroy();
//   await beam(scene, muzzle, defCore, 'prism', { onImpact: () => void impact(scene, x, y, { power: 3, sprite: def }) });

import Phaser from 'phaser';
import type { PlayerId } from '../engine/types';
import { PAL, PLAYER_RAMP, RAMPS, type Ramp } from '../art/palette';
import { PixelCanvas, mulberry32, shade } from '../art/pixel';
import { DEPTH, GAME_H, GAME_W, duelistXY, unitDepth, type XY } from '../view/layout';
import { sfx, type SfxName } from '../audio/sfx';
import { shake } from './core';

// ==================================================================================== random

let rng = mulberry32(0xc0ffee);
/** Re-seed the combat VFX random stream (previews/films call this for repeatable frames). */
export function seedCombatFx(seed: number): void {
  rng = mulberry32(seed);
}
const R = () => rng();
const RR = (a: number, b: number) => a + (b - a) * rng();
const RI = (a: number, b: number) => Math.floor(a + (b - a + 1) * rng());
const pick = <T>(a: readonly T[]): T => a[Math.floor(rng() * a.length) % a.length];
/** Stable pseudo-random in [0,1) for integer pairs (per-frame jitter that doesn't consume rng). */
function hash2(i: number, j: number): number {
  let h = (i * 374761393 + j * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Easing helpers (t in 0..1). */
export const E = {
  lin: (t: number) => t,
  inQ: (t: number) => t * t,
  outQ: (t: number) => 1 - (1 - t) * (1 - t),
  inC: (t: number) => t * t * t,
  outC: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutQ: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inOutC: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t: number, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  outExpo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t: number) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
};

// ==================================================================================== sound

let sfxOn = true;
/** Combat VFX play their own sound beats (beam charge/fire, slash, impacts...). Turn off if a cinematic scores them itself. */
export function setCombatSfx(enabled: boolean): void {
  sfxOn = enabled;
}
function snd(name: SfxName, volume = 1, pitch = 1): void {
  if (!sfxOn) return;
  try {
    sfx.play(name, { volume, pitch });
  } catch {
    /* audio is never allowed to break a cinematic */
  }
}

// ==================================================================================== clock

/** Delta scale that follows setSpeed() and freezes during hitStop(). */
function timeK(scene: Phaser.Scene): number {
  return scene.tweens.timeScale;
}

/**
 * Per-frame callback on the (scaled) scene clock. `fn(dt, elapsed)` — return false to stop.
 * Called once immediately with dt = 0 so the first frame is drawn on the frame the effect starts.
 * Stops automatically when the scene shuts down. Returns a canceller.
 */
export function onFrame(scene: Phaser.Scene, fn: (dt: number, el: number) => boolean | void, onEnd?: () => void): () => void {
  let el = 0;
  let alive = true;
  const stop = () => {
    if (!alive) return;
    alive = false;
    scene.events.off(Phaser.Scenes.Events.UPDATE, upd);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, stop);
    onEnd?.();
  };
  const upd = (_t: number, delta: number) => {
    if (!alive) return;
    const dt = Math.min(delta, 50) * timeK(scene);
    el += dt;
    let r: boolean | void;
    try {
      r = fn(dt, el);
    } catch (e) {
      console.error('[vfx/combat]', e);
      r = false;
    }
    if (r === false) stop();
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, upd);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
  try {
    if (fn(0, 0) === false) stop();
  } catch (e) {
    console.error('[vfx/combat]', e);
    stop();
  }
  return stop;
}

/** Run `fn(t, el, dt)` every frame for `ms` of scaled time; t goes 0 → 1 (the last call has t = 1). */
export function animate(scene: Phaser.Scene, ms: number, fn: (t: number, el: number, dt: number) => void): Promise<void> {
  return new Promise((resolve) => {
    onFrame(
      scene,
      (dt, el) => {
        const t = ms <= 0 ? 1 : Math.min(1, el / ms);
        fn(t, el, dt);
        return t < 1;
      },
      resolve,
    );
  });
}

/** Wait `ms` of scaled time (frozen by hitStop, sped by setSpeed). */
export function sleep(scene: Phaser.Scene, ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return animate(scene, ms, () => undefined);
}

interface FreezeState {
  remaining: number;
  saved: { tw: number; tm: number; an: number };
  waiters: (() => void)[];
}
const freezes = new WeakMap<Phaser.Scene, FreezeState>();

/**
 * Nesting-safe hit-stop: freezes tweens, timers, animations (and every combat effect) for `ms` of
 * REAL time. Overlapping calls extend one freeze instead of stacking save/restore pairs, so
 * several impacts in the same beat can never leave the scene stuck at timeScale 0.
 */
export function stopTime(scene: Phaser.Scene, ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  const cur = freezes.get(scene);
  if (cur) {
    cur.remaining = Math.max(cur.remaining, ms);
    return new Promise((r) => cur.waiters.push(r));
  }
  const st: FreezeState = {
    remaining: ms,
    saved: { tw: scene.tweens.timeScale, tm: scene.time.timeScale, an: scene.anims.globalTimeScale },
    waiters: [],
  };
  // started inside someone else's freeze: never "restore" to a frozen clock
  if (st.saved.tw === 0) st.saved = { tw: 1, tm: 1, an: 1 };
  freezes.set(scene, st);
  scene.tweens.timeScale = 0;
  scene.time.timeScale = 0;
  scene.anims.globalTimeScale = 0;
  return new Promise((resolve) => {
    st.waiters.push(resolve);
    const end = () => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, upd);
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, end);
      freezes.delete(scene);
      scene.tweens.timeScale = st.saved.tw;
      scene.time.timeScale = st.saved.tm;
      scene.anims.globalTimeScale = st.saved.an;
      for (const w of st.waiters) w();
    };
    const upd = (_t: number, delta: number) => {
      st.remaining -= delta;
      if (st.remaining <= 0) end();
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, upd);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, end);
  });
}

/** Wait `n` rendered frames of REAL time (ignores hitStop) — used for 1–2 frame flashes. */
function realFrames(scene: Phaser.Scene, n: number): Promise<void> {
  return new Promise((resolve) => {
    let k = 0;
    const fn = () => {
      if (++k >= n) {
        scene.events.off(Phaser.Scenes.Events.POST_UPDATE, fn);
        resolve();
      }
    };
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, fn);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, fn);
      resolve();
    });
  });
}

// ==================================================================================== raster

/**
 * Whole-pixel rasterizer drawing into a Graphics as horizontal runs. Shapes are sampled at pixel
 * centers exactly like PixelCanvas, so VFX match the sprite art. Shapes with alpha < 1 never
 * overlap themselves (each pixel is covered once per call).
 */
export class Px {
  readonly g: Phaser.GameObjects.Graphics;
  private c = -1;
  private a = -1;
  constructor(g: Phaser.GameObjects.Graphics) {
    this.g = g;
  }
  clear(): this {
    this.g.clear();
    this.c = -1;
    this.a = -1;
    return this;
  }
  private st(c: number, a: number): void {
    if (c !== this.c || a !== this.a) {
      this.g.fillStyle(c, a);
      this.c = c;
      this.a = a;
    }
  }
  rect(x: number, y: number, w: number, h: number, c: number, a = 1): this {
    if (w <= 0 || h <= 0 || a <= 0.01) return this;
    this.st(c, Math.min(1, a));
    this.g.fillRect(Math.floor(x), Math.floor(y), Math.round(w), Math.round(h));
    return this;
  }
  dot(x: number, y: number, c: number, a = 1): this {
    return this.rect(x, y, 1, 1, c, a);
  }
  run(y: number, x0: number, x1: number, c: number, a = 1): this {
    if (x1 < x0) return this;
    return this.rect(x0, y, x1 - x0 + 1, 1, c, a);
  }
  disc(cx: number, cy: number, r: number, c: number, a = 1): this {
    return this.ellipse(cx, cy, r, r, c, a);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: number, a = 1): this {
    if (rx < 0.5 || ry < 0.5) return rx > 0.2 && ry > 0.2 ? this.dot(cx, cy, c, a) : this;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const dy = (y + 0.5 - cy) / ry;
      const q = 1 - dy * dy;
      if (q < 0) continue;
      const h = rx * Math.sqrt(q);
      this.run(y, Math.ceil(cx - h - 0.5), Math.floor(cx + h - 0.5), c, a);
    }
    return this;
  }
  /** Elliptical annulus: outer radii (rx, ry), thickness th (pixels, both axes). */
  ellipseRing(cx: number, cy: number, rx: number, ry: number, th: number, c: number, a = 1): this {
    if (rx < 0.5 || ry < 0.5) return this;
    const irx = rx - th;
    const iry = ry - th;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const dy = (y + 0.5 - cy) / ry;
      const q = 1 - dy * dy;
      if (q < 0) continue;
      const h = rx * Math.sqrt(q);
      const x0 = Math.ceil(cx - h - 0.5);
      const x1 = Math.floor(cx + h - 0.5);
      let ih = -1;
      if (irx > 0.3 && iry > 0.3) {
        const idy = (y + 0.5 - cy) / iry;
        const iq = 1 - idy * idy;
        if (iq >= 0) ih = irx * Math.sqrt(iq);
      }
      if (ih < 0) {
        this.run(y, x0, x1, c, a);
      } else {
        const i0 = Math.ceil(cx - ih - 0.5);
        const i1 = Math.floor(cx + ih - 0.5);
        this.run(y, x0, i0 - 1, c, a);
        this.run(y, i1 + 1, x1, c, a);
      }
    }
    return this;
  }
  ring(cx: number, cy: number, r: number, th: number, c: number, a = 1): this {
    return this.ellipseRing(cx, cy, r, r, th, c, a);
  }
  /** Filled polygon (even-odd) from a flat [x0, y0, x1, y1, ...] list. */
  poly(pts: readonly number[], c: number, a = 1): this {
    const n = pts.length >> 1;
    if (n < 3) return this;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 1; i < pts.length; i += 2) {
      if (pts[i] < minY) minY = pts[i];
      if (pts[i] > maxY) maxY = pts[i];
    }
    const xs: number[] = [];
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const sy = y + 0.5;
      xs.length = 0;
      for (let i = 0; i < n; i++) {
        const x0 = pts[i * 2];
        const y0 = pts[i * 2 + 1];
        const j = (i + 1) % n;
        const x1 = pts[j * 2];
        const y1 = pts[j * 2 + 1];
        if ((y0 <= sy && y1 > sy) || (y1 <= sy && y0 > sy)) xs.push(x0 + ((sy - y0) / (y1 - y0)) * (x1 - x0));
      }
      if (xs.length < 2) continue;
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) this.run(y, Math.ceil(xs[k] - 0.5), Math.floor(xs[k + 1] - 0.5), c, a);
    }
    return this;
  }
  /** 1px Bresenham line. */
  line(x0: number, y0: number, x1: number, y1: number, c: number, a = 1): this {
    x0 = Math.floor(x0);
    y0 = Math.floor(y0);
    x1 = Math.floor(x1);
    y1 = Math.floor(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 2000; guard++) {
      this.dot(x0, y0, c, a);
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
    return this;
  }
  /** Straight segment of width w (w ≤ 1 → Bresenham). */
  seg(x0: number, y0: number, x1: number, y1: number, w: number, c: number, a = 1): this {
    if (w <= 1.01) return this.line(x0, y0, x1, y1, c, a);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l = Math.hypot(dx, dy) || 1;
    const nx = (-dy / l) * (w / 2);
    const ny = (dx / l) * (w / 2);
    return this.poly([x0 + nx, y0 + ny, x1 + nx, y1 + ny, x1 - nx, y1 - ny, x0 - nx, y0 - ny], c, a);
  }
  /** Opaque tapered stroke (stamped discs) — vines, tails, tentacles. */
  stroke(path: readonly XY[], w0: number, w1: number, c: number): this {
    if (!path.length) return this;
    let total = 0;
    for (let i = 1; i < path.length; i++) total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    let d = 0;
    for (let i = 0; i < path.length; i++) {
      if (i > 0) {
        const a = path[i - 1];
        const b = path[i];
        const seg = Math.hypot(b.x - a.x, b.y - a.y);
        const steps = Math.max(1, Math.ceil(seg));
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          const w = lerp(w0, w1, (d + seg * t) / (total || 1));
          const x = a.x + (b.x - a.x) * t;
          const y = a.y + (b.y - a.y) * t;
          if (w <= 1.2) this.dot(x, y, c);
          else this.disc(x, y, w / 2, c);
        }
        d += seg;
      } else if (w0 > 1.2) this.disc(path[0].x, path[0].y, w0 / 2, c);
    }
    return this;
  }
  /** 4-point star: long rays rl, waist rs, rotated by `rot`. */
  star(cx: number, cy: number, rl: number, rs: number, c: number, a = 1, rot = 0): this {
    if (rl < 1) return this.dot(cx, cy, c, a);
    const pts: number[] = [];
    for (let i = 0; i < 8; i++) {
      const ang = rot + (i * Math.PI) / 4;
      const r = i % 2 === 0 ? rl : rs;
      pts.push(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
    }
    return this.poly(pts, c, a);
  }
  /** Draw an ASCII pattern ('#' → c1, '+' → c2, 'o' → c3). */
  stamp(rows: readonly string[], x: number, y: number, c1: number, c2 = c1, c3 = c2, a = 1, flipX = false): this {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        const col = ch === '#' ? c1 : ch === '+' ? c2 : ch === 'o' ? c3 : -1;
        if (col < 0) continue;
        this.dot(x + (flipX ? row.length - 1 - i : i), y + j, col, a);
      }
    }
    return this;
  }
}

/** A Graphics + Px pair at a depth. */
function layer(scene: Phaser.Scene, depth: number, blend?: number): Px {
  const g = scene.add.graphics().setDepth(depth);
  if (blend !== undefined) g.setBlendMode(blend);
  return new Px(g);
}

// ==================================================================================== color

const RAINBOW = [PAL.crim3, PAL.fire3, PAL.gold3, PAL.leaf3, PAL.teal3, PAL.cyan3, PAL.water3, PAL.void3, PAL.mag3] as const;

/** Ramp (dark→light) that contains `color`; falls back to a mixed ramp around it. */
export function rampOf(color: number): Ramp {
  for (const r of Object.values(RAMPS)) if ((r as readonly number[]).includes(color)) return r as Ramp;
  if (color === PAL.white) return [PAL.night4, PAL.steel, PAL.mist, PAL.white, PAL.white];
  return [shade(color, -2), shade(color, -1), color, shade(color, 1), shade(color, 2)];
}
const RAMP_LIGHT: Ramp = [PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4, PAL.white];
const RAMP_WHITE: Ramp = [PAL.steel, PAL.mist, PAL.cyan4, PAL.white, PAL.white];
const RAMP_METAL: Ramp = [PAL.stone2, PAL.stone3, PAL.stone4, PAL.gold4, PAL.white];

// ==================================================================================== particles

export type PShape = 'px' | 'sq' | 'streak' | 'star' | 'disc' | 'ring' | 'shard' | 'puff' | 'plus';

/** One particle. Colors step through `colors` over its life (no RGB lerp — palette steps). */
export interface Particle {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  ax?: number;
  ay?: number;
  /** Velocity damping per second (v *= e^(-drag·dt)). */
  drag?: number;
  life: number;
  age?: number;
  /** ms before it appears (does not move while waiting). */
  delay?: number;
  size?: number;
  /** Size change per second. */
  grow?: number;
  shape?: PShape;
  colors: readonly number[];
  alpha?: number;
  /** Fraction of life after which alpha fades to 0 (default 0.7). 1 = never fades (pops out). */
  fadeAt?: number;
  /** Streak length in seconds of travel (default 0.035). */
  len?: number;
  rot?: number;
  vrot?: number;
  /** Fly from the spawn point to (tx, ty), arriving exactly at end of life (ease-in); curl bends the path. */
  tx?: number;
  ty?: number;
  curl?: number;
  /** Swirl around (ox, oy) at `spin` rad/s while being pulled in by `pull` px/s. */
  ox?: number;
  oy?: number;
  spin?: number;
  pull?: number;
  /** Bounce on y = floor (keep energy `bounce`). */
  floor?: number;
  bounce?: number;
  /** Blink every other frame. */
  flicker?: boolean;
  // internal
  sx?: number;
  sy?: number;
  px?: number;
  py?: number;
}

/**
 * A self-ticking particle layer (one Graphics). Add particles any time; call release() when the
 * owner will add no more — the layer destroys itself once the last particle dies.
 */
export class Sparks {
  readonly px: Px;
  readonly list: Particle[] = [];
  private released = false;
  private stopFn: () => void;
  private frame = 0;
  dead = false;
  constructor(
    readonly scene: Phaser.Scene,
    depth: number = DEPTH.FX,
    blend?: number,
  ) {
    this.px = layer(scene, depth, blend);
    this.stopFn = onFrame(scene, (dt) => this.tick(dt), () => this.kill());
  }
  add(p: Particle): Particle {
    p.age = p.age ?? 0;
    p.vx = p.vx ?? 0;
    p.vy = p.vy ?? 0;
    p.sx = p.x;
    p.sy = p.y;
    this.list.push(p);
    return p;
  }
  /** Destroy as soon as no particles are left (optionally after at least `ms`). */
  release(): void {
    this.released = true;
  }
  private kill(): void {
    if (this.dead) return;
    this.dead = true;
    this.px.g.destroy();
  }
  destroy(): void {
    this.stopFn();
    this.kill();
  }
  private tick(dt: number): boolean {
    const s = dt / 1000;
    if (dt > 0) this.frame++;
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      if (p.delay && p.delay > 0) {
        p.delay -= dt;
        continue;
      }
      p.age! += dt;
      if (p.age! >= p.life) {
        L.splice(i, 1);
        continue;
      }
      p.px = p.x;
      p.py = p.y;
      const t = p.age! / p.life;
      if (p.tx !== undefined && p.ty !== undefined) {
        const e = t * t;
        const bx = p.sx! + (p.tx - p.sx!) * e;
        const by = p.sy! + (p.ty - p.sy!) * e;
        const c = p.curl ?? 0;
        if (c) {
          const dx = p.tx - p.sx!;
          const dy = p.ty - p.sy!;
          const l = Math.hypot(dx, dy) || 1;
          const k = Math.sin(Math.PI * e) * c;
          p.x = bx + (-dy / l) * k;
          p.y = by + (dx / l) * k;
        } else {
          p.x = bx;
          p.y = by;
        }
        p.vx = (p.x - p.px) / Math.max(s, 1e-4);
        p.vy = (p.y - p.py) / Math.max(s, 1e-4);
      } else if (p.spin !== undefined && p.ox !== undefined && p.oy !== undefined) {
        const dx = p.x - p.ox;
        const dy = p.y - p.oy;
        let r = Math.hypot(dx, dy);
        let ang = Math.atan2(dy, dx);
        ang += p.spin * s * (1 + 14 / Math.max(r, 3));
        r = Math.max(0, r - (p.pull ?? 0) * s);
        p.x = p.ox + Math.cos(ang) * r;
        p.y = p.oy + Math.sin(ang) * r * (p.ay ?? 1);
        p.vx = (p.x - p.px) / Math.max(s, 1e-4);
        p.vy = (p.y - p.py) / Math.max(s, 1e-4);
        if (r < 1) p.age = p.life;
      } else {
        if (p.drag) {
          const k = Math.exp(-p.drag * s);
          p.vx! *= k;
          p.vy! *= k;
        }
        p.vx! += (p.ax ?? 0) * s;
        p.vy! += (p.ay ?? 0) * s;
        p.x += p.vx! * s;
        p.y += p.vy! * s;
        if (p.floor !== undefined && p.y > p.floor && p.vy! > 0) {
          p.y = p.floor;
          p.vy = -p.vy! * (p.bounce ?? 0.35);
          p.vx! *= 0.6;
          p.vrot = (p.vrot ?? 0) * 0.5;
        }
      }
      if (p.grow) p.size = Math.max(0, (p.size ?? 1) + p.grow * s);
      if (p.vrot) p.rot = (p.rot ?? 0) + p.vrot * s;
    }
    this.draw();
    if (this.released && L.length === 0) return false;
    return true;
  }
  private draw(): void {
    const px = this.px.clear();
    for (const p of this.list) {
      if (p.delay && p.delay > 0) continue;
      const t = p.age! / p.life;
      if (p.flicker && (this.frame + (p.sx! | 0)) % 2 === 0) continue;
      const cols = p.colors;
      const c = cols[Math.min(cols.length - 1, Math.floor(t * cols.length))];
      const fa = p.fadeAt ?? 0.7;
      const a = (p.alpha ?? 1) * (t > fa && fa < 1 ? 1 - (t - fa) / (1 - fa) : 1);
      if (a <= 0.02) continue;
      const sz = p.size ?? 1;
      const x = p.x;
      const y = p.y;
      switch (p.shape ?? 'px') {
        case 'px':
          px.dot(x, y, c, a);
          break;
        case 'sq': {
          const s = Math.max(1, Math.round(sz));
          px.rect(Math.round(x - s / 2), Math.round(y - s / 2), s, s, c, a);
          break;
        }
        case 'plus': {
          const s = Math.max(1, Math.round(sz));
          px.rect(x - s, y, s * 2 + 1, 1, c, a);
          px.rect(x, y - s, 1, s, c, a);
          px.rect(x, y + 1, 1, s, c, a);
          break;
        }
        case 'streak': {
          const k = p.len ?? 0.035;
          const vx = p.vx ?? 0;
          const vy = p.vy ?? 0;
          let ex = x - vx * k;
          let ey = y - vy * k;
          const l = Math.hypot(ex - x, ey - y);
          const max = 14;
          if (l > max) {
            ex = x + ((ex - x) / l) * max;
            ey = y + ((ey - y) / l) * max;
          }
          if (sz >= 2) px.seg(x, y, ex, ey, sz, c, a);
          else px.line(x, y, ex, ey, c, a);
          px.dot(x, y, cols[0], a);
          break;
        }
        case 'star':
          if (sz < 1.5) {
            px.dot(x, y, c, a);
          } else if (sz < 2.5) {
            px.rect(x - 1, y, 3, 1, c, a).rect(x, y - 1, 1, 1, c, a).rect(x, y + 1, 1, 1, c, a);
          } else px.star(x + 0.5, y + 0.5, sz, Math.max(1, sz * 0.28), c, a, p.rot ?? 0);
          break;
        case 'disc':
          px.disc(x, y, sz, c, a);
          break;
        case 'ring':
          px.ring(x, y, sz, 1, c, a);
          break;
        case 'shard': {
          const r = p.rot ?? 0;
          const s = Math.max(1.5, sz);
          const pts = [
            x + Math.cos(r) * s,
            y + Math.sin(r) * s,
            x + Math.cos(r + 2.4) * s * 0.55,
            y + Math.sin(r + 2.4) * s * 0.55,
            x + Math.cos(r + 3.6) * s * 0.7,
            y + Math.sin(r + 3.6) * s * 0.7,
          ];
          px.poly(pts, c, a);
          px.dot(x + Math.cos(r) * (s - 1), y + Math.sin(r) * (s - 1), cols[0], a);
          break;
        }
        case 'puff': {
          // dithered smoke ball: dense core, checkerboard rim
          const r = Math.max(1, sz);
          const r2 = r * r;
          const core2 = r2 * 0.4;
          for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy++) {
            for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx++) {
              const dx = xx + 0.5 - x;
              const dy = yy + 0.5 - y;
              const d2 = dx * dx + dy * dy;
              if (d2 > r2) continue;
              if (d2 > core2 && (xx + yy) % 2 !== 0) continue;
              px.dot(xx, yy, c, a);
            }
          }
          break;
        }
      }
    }
  }
}

// ==================================================================================== geometry

function vsub(a: XY, b: XY): XY {
  return { x: a.x - b.x, y: a.y - b.y };
}
function vlen(a: XY): number {
  return Math.hypot(a.x, a.y);
}
function vnorm(a: XY): XY {
  const l = vlen(a) || 1;
  return { x: a.x / l, y: a.y / l };
}
function vlerp(a: XY, b: XY, t: number): XY {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
function qbez(a: XY, c: XY, b: XY, t: number): XY {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}
function cbez(a: XY, c1: XY, c2: XY, b: XY, t: number): XY {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
  };
}

/** Points along a path resampled every `step` px (returns points + cumulative lengths). */
function resample(pts: XY[], step = 1): { p: XY[]; s: number[]; len: number } {
  const out: XY[] = [pts[0]];
  const ss: number[] = [0];
  let acc = 0;
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    let d = step - carry;
    while (d <= l) {
      out.push(vlerp(a, b, d / l));
      ss.push(acc + d);
      d += step;
    }
    carry = l - (d - step);
    acc += l;
  }
  if (out.length < 2 || ss[ss.length - 1] < acc - 0.01) {
    out.push(pts[pts.length - 1]);
    ss.push(acc);
  }
  return { p: out, s: ss, len: acc };
}

// ==================================================================================== sprites

type AnySprite = Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;

/**
 * World position of a frame pixel (fx, fy) of a sprite — honours origin, flipX, scale, rotation
 * and parent containers. Use it for `muzzle` / `core` from MonsterArt:
 *   framePointToWorld(sprite, art.muzzle.x, art.muzzle.y)
 */
export function framePointToWorld(sprite: AnySprite, fx: number, fy: number): XY {
  const w = sprite.frame.realWidth;
  const lx = (sprite.flipX ? w - fx : fx) - sprite.displayOriginX;
  const ly = (sprite.flipY ? sprite.frame.realHeight - fy : fy) - sprite.displayOriginY;
  const m = sprite.getWorldTransformMatrix();
  return { x: m.getX(lx, ly), y: m.getY(lx, ly) };
}

/** Current world transform of a sprite (position/scale/rotation through containers). */
function worldTf(sprite: AnySprite): { x: number; y: number; sx: number; sy: number; rot: number } {
  const m = sprite.getWorldTransformMatrix();
  const d = m.decomposeMatrix();
  return { x: d.translateX, y: d.translateY, sx: d.scaleX, sy: d.scaleY, rot: d.rotation };
}

/** Solid-white silhouette for `frames` real frames (works during hitStop), then restores any tint. */
export async function whiteFlash(scene: Phaser.Scene, sprite: AnySprite | null | undefined, frames = 2, color: number = PAL.white): Promise<void> {
  if (!sprite || !sprite.active) return;
  const s = sprite as Phaser.GameObjects.Sprite;
  const saved = { fill: s.tintFill, tl: s.tintTopLeft, tr: s.tintTopRight, bl: s.tintBottomLeft, br: s.tintBottomRight, tinted: s.isTinted };
  s.setTintFill(color);
  await realFrames(scene, frames);
  if (!s.active) return;
  if (saved.tinted) {
    s.setTint(saved.tl, saved.tr, saved.bl, saved.br);
    s.tintFill = saved.fill;
  } else s.clearTint();
}

/** Ghost copy of a sprite's current frame (same transform), for afterimages / smears. */
function ghostOf(scene: Phaser.Scene, sprite: AnySprite, color: number, alpha: number, depthBias = -0.5): Phaser.GameObjects.Image | null {
  if (!sprite.active || !sprite.texture) return null;
  const tf = worldTf(sprite);
  const img = scene.add.image(tf.x, tf.y, sprite.texture.key, sprite.frame.name);
  img.setOrigin(sprite.originX, sprite.originY);
  img.setFlipX(sprite.flipX).setFlipY(sprite.flipY);
  img.setScale(tf.sx, tf.sy).setRotation(tf.rot);
  img.setDepth(sprite.depth + depthBias + (sprite.parentContainer ? sprite.parentContainer.depth : 0));
  img.setTintFill(color);
  img.setAlpha(alpha);
  return img;
}

// ==================================================================================== targeting

export interface Handle {
  destroy(): void;
  /** Resolves when the intro beat has finished (arrow fully drawn / reticle snapped). */
  done: Promise<void>;
}

/**
 * Attack declaration arrow: an arc that grows from `from` to `to` in the player's color with
 * chevrons flowing toward the target and a pulsing arrowhead. Stays (animated) until destroy().
 */
export function attackArrow(scene: Phaser.Scene, from: XY, to: XY, player: PlayerId, opts: { depth?: number; height?: number } = {}): Handle {
  const ramp = PLAYER_RAMP[player];
  const px = layer(scene, opts.depth ?? DEPTH.FX_TOP);
  const sp = new Sparks(scene, (opts.depth ?? DEPTH.FX_TOP) + 0.1);
  const dist = vlen(vsub(to, from));
  const h = opts.height ?? clamp(dist * 0.32, 14, 46);
  const mid = vlerp(from, to, 0.5);
  const ctrl = { x: mid.x, y: mid.y - h * 2 };
  const raw: XY[] = [];
  for (let i = 0; i <= 48; i++) raw.push(qbez(from, ctrl, to, i / 48));
  const path = resample(raw, 1);
  const N = path.p.length;
  const L = path.len;
  const GROW = 300;
  const HEAD = 11;
  let fade = 1;
  let leaving = false;
  let resolveDone!: () => void;
  const done = new Promise<void>((r) => (resolveDone = r));
  let resolved = false;
  snd('attackDeclare');

  const at = (s: number) => {
    const i = clamp(Math.round(s), 0, N - 1);
    const j = clamp(i + 2, 0, N - 1);
    const k = clamp(i - 2, 0, N - 1);
    const p = path.p[i];
    const d = vnorm(vsub(path.p[j], path.p[k]));
    return { p, d, n: { x: -d.y, y: d.x } };
  };

  const band = (s0: number, s1: number, hw: (s: number) => number, c: number, a: number) => {
    if (s1 - s0 < 1) return;
    const l: number[] = [];
    const r: number[] = [];
    for (let s = s0; ; s = Math.min(s1, s + 2)) {
      const { p, n } = at(s);
      const w = hw(s);
      l.push(p.x + n.x * w, p.y + n.y * w);
      r.push(p.x - n.x * w, p.y - n.y * w);
      if (s >= s1) break;
    }
    const pts = l.slice();
    for (let i = r.length - 2; i >= 0; i -= 2) pts.push(r[i], r[i + 1]);
    px.poly(pts, c, a);
  };

  const stop = onFrame(scene, (dt, el) => {
    const grow = E.outC(clamp(el / GROW, 0, 1));
    if (!resolved && el >= GROW) {
      resolved = true;
      resolveDone();
    }
    if (leaving) {
      fade -= dt / 140;
      if (fade <= 0) return false;
    }
    const tip = Math.max(2, grow * L);
    const bodyEnd = Math.max(0, tip - HEAD);
    px.clear();
    const a = fade;
    const taper = (s: number) => clamp(0.35 + (s / Math.max(12, L * 0.35)) * 0.65, 0.35, 1);
    band(2, bodyEnd, (s) => 1 + 2.6 * taper(s), PAL.ink, 0.85 * a);
    band(2, bodyEnd, (s) => 0.5 + 2 * taper(s), ramp[2], a);
    band(2, bodyEnd, (s) => 0.2 + 1.1 * taper(s), ramp[3], a);
    // flowing light pulses + notch chevrons (move toward the target)
    const GAP = 10;
    const flow = (el * 0.06) % GAP;
    for (let s = 3; s <= bodyEnd; s++) {
      const m = (((s - flow) % GAP) + GAP) % GAP;
      if (m < 3) {
        const { p } = at(s);
        px.dot(p.x, p.y, m < 1.5 ? PAL.white : ramp[4], a);
      }
    }
    for (let s = flow + GAP * 0.5; s < bodyEnd - 2; s += GAP) {
      if (s < 8) continue;
      const { p, d, n } = at(s);
      const w = 0.5 + 2 * taper(s);
      const bx = p.x - d.x * 2.5;
      const by = p.y - d.y * 2.5;
      px.line(p.x, p.y, bx + n.x * w, by + n.y * w, ramp[4], a);
      px.line(p.x, p.y, bx - n.x * w, by - n.y * w, ramp[4], a);
    }
    // arrowhead
    const { p, d, n } = at(tip);
    const pulse = Math.floor(el / 110) % 2;
    const hl = HEAD + pulse;
    const hw = 6.5 + pulse * 0.5;
    const tx = p.x + d.x * 2;
    const ty = p.y + d.y * 2;
    const bx = tx - d.x * hl;
    const by = ty - d.y * hl;
    const nx = bx + d.x * 4;
    const ny = by + d.y * 4;
    const head = [tx, ty, bx + n.x * hw, by + n.y * hw, nx, ny, bx - n.x * hw, by - n.y * hw];
    const outl = [
      tx + d.x * 1.8,
      ty + d.y * 1.8,
      bx + n.x * (hw + 1.6) - d.x * 1.2,
      by + n.y * (hw + 1.6) - d.y * 1.2,
      nx - d.x * 0.6,
      ny - d.y * 0.6,
      bx - n.x * (hw + 1.6) - d.x * 1.2,
      by - n.y * (hw + 1.6) - d.y * 1.2,
    ];
    px.poly(outl, PAL.ink, 0.9 * a);
    px.poly(head, ramp[2], a);
    px.poly([tx, ty, bx + n.x * hw * 0.7, by + n.y * hw * 0.7, nx, ny], ramp[3], a);
    px.line(tx, ty, bx + n.x * hw * 0.85, by + n.y * hw * 0.85, ramp[4], a);
    px.dot(tx - d.x, ty - d.y, PAL.white, a);
    // origin glow
    const og = 2 + (Math.floor(el / 90) % 2);
    px.ring(from.x, from.y, og + 2, 1, ramp[3], 0.6 * a);
    px.disc(from.x, from.y, 1.5, ramp[4], a);
    // shed sparks
    if (!leaving && dt > 0 && R() < 0.5) {
      const s = RR(0, tip);
      const q = at(s);
      sp.add({ x: q.p.x, y: q.p.y, vx: RR(-10, 10), vy: RR(-22, -8), life: RR(220, 420), colors: [PAL.white, ramp[4], ramp[3], ramp[2]], shape: 'px' });
    }
    if (!leaving && el < GROW && dt > 0) {
      sp.add({ x: p.x, y: p.y, vx: RR(-20, 20) - d.x * 30, vy: RR(-20, 20) - d.y * 30, life: RR(160, 300), colors: [PAL.white, ramp[4], ramp[3]], shape: 'px' });
    }
    return true;
  }, () => {
    px.g.destroy();
    sp.release();
    if (!resolved) {
      resolved = true;
      resolveDone();
    }
  });
  return {
    done,
    destroy() {
      if (leaving) return;
      leaving = true;
      void stop;
    },
  };
}

/**
 * Lock-on reticle: four corner brackets spin and snap in around (x, y) with a flash, then breathe
 * with a small rotating inner ring until destroy().
 */
export function lockOn(scene: Phaser.Scene, x: number, y: number, opts: { color?: number; size?: number; depth?: number } = {}): Handle {
  const color = opts.color ?? PAL.crim3;
  const ramp = rampOf(color);
  const size = opts.size ?? 30;
  const px = layer(scene, opts.depth ?? DEPTH.FX_TOP);
  const IN = 230;
  let leaving = false;
  let leaveT = 0;
  let snapped = false;
  let resolveDone!: () => void;
  const done = new Promise<void>((r) => (resolveDone = r));
  x = Math.round(x);
  y = Math.round(y);
  snd('lockOn', 0.8);

  const bracket = (cx: number, cy: number, half: number, rot: number, arm: number, c: number, w: number, a: number) => {
    for (let k = 0; k < 4; k++) {
      const ang = rot + (k * Math.PI) / 2 + Math.PI / 4;
      const cos = Math.cos(rot + (k * Math.PI) / 2);
      const sin = Math.sin(rot + (k * Math.PI) / 2);
      // corner point (diagonal) and the two arms along the box edges
      const r = half * Math.SQRT2;
      const ox = cx + Math.cos(ang) * r;
      const oy = cy + Math.sin(ang) * r;
      // edge directions toward the neighbouring corners
      const e1x = -sin;
      const e1y = cos;
      const e2x = -cos;
      const e2y = -sin;
      px.seg(ox, oy, ox - e1x * arm, oy - e1y * arm, w, c, a);
      px.seg(ox, oy, ox + e2x * arm, oy + e2y * arm, w, c, a);
    }
  };

  onFrame(scene, (dt, el) => {
    let t = clamp(el / IN, 0, 1);
    if (!snapped && t >= 1) {
      snapped = true;
      resolveDone();
      snd('lockOn', 1, 1.3);
    }
    let alpha = clamp(el / 90, 0, 1);
    let scale = 1 + 1.3 * (1 - E.outBack(t, 2.2));
    let rot = (1 - E.outC(t)) * Math.PI * 0.75;
    if (leaving) {
      leaveT += dt;
      const u = clamp(leaveT / 150, 0, 1);
      scale = 1 + 0.5 * E.outQ(u);
      alpha = 1 - u;
      if (u >= 1) return false;
    }
    const breathe = snapped && !leaving ? (Math.floor(el / 140) % 2 === 0 ? 0 : 1) : 0;
    const half = (size / 2) * scale + breathe;
    const arm = Math.max(4, Math.round(size * 0.27));
    px.clear();
    const flashOn = snapped && el - IN < 50;
    bracket(x, y, half, rot, arm + 1, PAL.ink, 4, 0.8 * alpha);
    bracket(x, y, half, rot, arm, flashOn ? PAL.white : ramp[3], 2, alpha);
    bracket(x, y, half, rot, arm - 2, flashOn ? PAL.white : ramp[4], 1, alpha);
    // snap flash ring
    if (snapped && !leaving) {
      const u = clamp((el - IN) / 220, 0, 1);
      if (u < 1) px.ring(x, y, size * (0.35 + 0.55 * E.outQ(u)), 1, u < 0.3 ? PAL.white : ramp[3], 1 - u);
      // rotating inner dashes
      const r = Math.max(5, size * 0.24);
      const spin = el * 0.004;
      for (let k = 0; k < 3; k++) {
        const a0 = spin + (k * Math.PI * 2) / 3;
        for (let q = 0; q < 6; q++) {
          const a1 = a0 + q * 0.12;
          px.dot(x + Math.cos(a1) * r, y + Math.sin(a1) * r, ramp[3], 0.85 * alpha);
        }
      }
      // center pip
      const blink = Math.floor(el / 120) % 2 === 0;
      px.rect(x - 1, y, 3, 1, blink ? PAL.white : ramp[4], alpha).rect(x, y - 1, 1, 3, blink ? PAL.white : ramp[4], alpha);
      // tick marks at the box edges
      const tk = half + 3;
      px.rect(x - 1, y - tk - 2, 3, 1, ramp[2], alpha).rect(x - 1, y + tk + 1, 3, 1, ramp[2], alpha);
      px.rect(x - tk - 2, y - 1, 1, 3, ramp[2], alpha).rect(x + tk + 1, y - 1, 1, 3, ramp[2], alpha);
    }
    return true;
  }, () => {
    px.g.destroy();
    if (!snapped) resolveDone();
  });
  return {
    done,
    destroy() {
      leaving = true;
    },
  };
}

// ==================================================================================== beams

export type BeamStyle = 'prism' | 'water' | 'dark';

export interface BeamOpts {
  /** Charge-up time at the muzzle before firing (default per style: prism 500, water 380, dark 420). */
  chargeMs?: number;
  /** How long the beam stays on after leaving the muzzle (default ~420). */
  fireMs?: number;
  /** Beam thickness in px (default per style). */
  width?: number;
  /** Called when the beam leaves the muzzle (end of charge). */
  onFire?: () => void;
  /** Called once when the beam head reaches `to`. */
  onImpact?: () => void;
  /** Piercing: after hitting `to` the beam punches through and continues to this point. */
  through?: XY;
  onPierce?: () => void;
  depth?: number;
}

interface BeamLook {
  glow: number;
  edge: number;
  mid: number;
  inner: number;
  core: number;
  glowA: number;
  width: number;
  chargeMs: number;
  fireMs: number;
}

const BEAM: Record<BeamStyle, BeamLook> = {
  prism: { glow: PAL.cyan1, edge: PAL.cyan2, mid: PAL.cyan3, inner: PAL.cyan4, core: PAL.white, glowA: 0.5, width: 11, chargeMs: 500, fireMs: 420 },
  water: { glow: PAL.water1, edge: PAL.water2, mid: PAL.water3, inner: PAL.water4, core: PAL.white, glowA: 0.45, width: 9, chargeMs: 380, fireMs: 440 },
  dark: { glow: PAL.void2, edge: PAL.void4, mid: PAL.void3, inner: PAL.void1, core: PAL.ink, glowA: 0.45, width: 10, chargeMs: 420, fireMs: 420 },
};

/** Capsule-ish ribbon along a straight segment with per-sample half widths. */
function ribbon(px: Px, a: XY, d: XY, s0: number, s1: number, hw: (s: number, side: 1 | -1) => number, c: number, alpha: number, capStart: boolean, capEnd: boolean): void {
  if (s1 - s0 < 0.5) return;
  const n = { x: -d.y, y: d.x };
  const L: number[] = [];
  const Rr: number[] = [];
  const step = 2;
  for (let s = s0; ; s = Math.min(s1, s + step)) {
    const wl = Math.max(0, hw(s, 1));
    const wr = Math.max(0, hw(s, -1));
    const x = a.x + d.x * s;
    const y = a.y + d.y * s;
    L.push(x + n.x * wl, y + n.y * wl);
    Rr.push(x - n.x * wr, y - n.y * wr);
    if (s >= s1) break;
  }
  const pts: number[] = [];
  if (capStart) {
    // right side → around the back (−d) → left side
    const w = (hw(s0, 1) + hw(s0, -1)) / 2;
    const cx = a.x + d.x * s0;
    const cy = a.y + d.y * s0;
    for (let k = 1; k < 6; k++) {
      const th = (k / 6) * Math.PI;
      pts.push(cx + (-n.x * Math.cos(th) - d.x * Math.sin(th)) * w, cy + (-n.y * Math.cos(th) - d.y * Math.sin(th)) * w);
    }
  }
  pts.push(...L);
  if (capEnd) {
    const w = (hw(s1, 1) + hw(s1, -1)) / 2;
    const cx = a.x + d.x * s1;
    const cy = a.y + d.y * s1;
    for (let k = 1; k < 6; k++) {
      const th = (k / 6) * Math.PI;
      // from left (+n) through forward (+d) to right (-n)
      pts.push(cx + (n.x * Math.cos(th) + d.x * Math.sin(th)) * w, cy + (n.y * Math.cos(th) + d.y * Math.sin(th)) * w);
    }
  }
  for (let i = Rr.length - 2; i >= 0; i -= 2) pts.push(Rr[i], Rr[i + 1]);
  px.poly(pts, c, alpha);
}

/**
 * Anime energy beam from `from` (muzzle) to `to`: charge particles gather into a growing orb, then
 * a layered beam bursts out (pulsing width, flowing energy lumps, helix strands, style details),
 * with a bright muzzle flare and an impact flare. Resolves when the beam has fully faded.
 */
export function beam(scene: Phaser.Scene, from: XY | (() => XY), to: XY, style: BeamStyle = 'prism', opts: BeamOpts = {}): Promise<void> {
  const look = BEAM[style];
  const W = opts.width ?? look.width;
  const chargeMs = opts.chargeMs ?? look.chargeMs;
  const fireMs = opts.fireMs ?? look.fireMs;
  const depth = opts.depth ?? DEPTH.FX;
  const px = layer(scene, depth);
  const back = new Sparks(scene, depth - 0.1);
  const sp = new Sparks(scene, depth + 0.2);
  const glowSp = new Sparks(scene, depth + 0.3, Phaser.BlendModes.ADD);
  const fromFn = typeof from === 'function' ? from : () => from;
  const snap = (p: XY) => ({ x: Math.round(p.x) + 0.5, y: Math.round(p.y) + 0.5 });
  let A = snap(fromFn());
  const segs: { a: XY; d: XY; len: number; s0: number }[] = [];
  const pts: XY[] = [];
  let tot = 0;
  let L1 = 1;
  let d0: XY = { x: 1, y: 0 };
  let n0: XY = { x: 0, y: 1 };
  let ang = 0;
  const setup = () => {
    pts.length = 0;
    segs.length = 0;
    pts.push(A, snap(to), ...(opts.through ? [snap(opts.through)] : []));
    tot = 0;
    for (let i = 1; i < pts.length; i++) {
      const v = vsub(pts[i], pts[i - 1]);
      const len = vlen(v);
      segs.push({ a: pts[i - 1], d: vnorm(v), len, s0: tot });
      tot += len;
    }
    L1 = segs[0].len;
    d0 = segs[0].d;
    n0 = { x: -d0.y, y: d0.x };
    ang = Math.atan2(d0.y, d0.x);
  };
  setup();
  let EXT = clamp(L1 * 0.9, 55, 110);
  const PIERCE_AT = EXT + 130;
  const PIERCE_MS = 90;
  const END = 150;
  let impacted = false;
  let pierced = false;
  let fired = false;
  let lastRing = -999;
  let frame = 0;
  snd('beamCharge', 0.9);

  const colorsIn = [look.edge, look.mid, look.inner, look.core];
  const sprayColors = style === 'dark' ? [PAL.void4, PAL.void3, PAL.void2, PAL.void1] : [look.core, look.inner, look.mid, look.edge];

  return new Promise((resolve) => {
    onFrame(scene, (dt, el) => {
      px.clear();
      if (dt > 0) frame++;
      const live = dt > 0;
      // ------------------------------------------------------------- charge
      if (el < chargeMs) {
        const t = el / chargeMs;
        const m = snap(fromFn());
        if (m.x !== A.x || m.y !== A.y) {
          // the muzzle moves with the wind-up pose: carry the gathering particles along
          const dx = m.x - A.x;
          const dy = m.y - A.y;
          for (const q of sp.list) if (q.tx !== undefined && q.ty !== undefined) {
            q.tx += dx;
            q.ty += dy;
            q.sx! += dx;
            q.sy! += dy;
          }
          for (const q of back.list) if (q.ox !== undefined && q.oy !== undefined) {
            q.ox += dx;
            q.oy += dy;
            q.x += dx;
            q.y += dy;
          }
          A = m;
        }
        // gathering particles
        if (live) {
          const n = (dt / 1000) * (50 + 220 * t);
          for (let i = 0; i < n || (i === 0 && R() < n); i++) {
            const a = RR(0, Math.PI * 2);
            const r = RR(14, 30) * (1 - 0.3 * t);
            if (style === 'dark') {
              back.add({ x: A.x + Math.cos(a) * r, y: A.y + Math.sin(a) * r, ox: A.x, oy: A.y, spin: 5, pull: RR(60, 110), life: 600, colors: [PAL.void1, PAL.void2, PAL.void3, PAL.void4], shape: R() < 0.3 ? 'sq' : 'px', size: 2 });
            } else if (style === 'water') {
              sp.add({ x: A.x + Math.cos(a) * r, y: A.y + Math.sin(a) * r, tx: A.x, ty: A.y, curl: RR(-10, 10), life: RR(200, 320), colors: [PAL.water2, PAL.water3, PAL.water4, PAL.white], shape: R() < 0.4 ? 'sq' : 'px', size: 2, fadeAt: 1 });
            } else {
              sp.add({ x: A.x + Math.cos(a) * r, y: A.y + Math.sin(a) * r, tx: A.x, ty: A.y, curl: RR(-8, 8), life: RR(170, 300), colors: colorsIn, shape: 'streak', len: 0.018, fadeAt: 1 });
            }
          }
        }
        // orb
        const flick = frame % 3 === 0 ? 0.7 : 0;
        let r = 1.5 + W * 0.42 * E.inQ(t) + flick;
        if (t > 0.86) r *= 1 - ((t - 0.86) / 0.14) * 0.45;
        px.disc(A.x, A.y, r + 3, look.glow, look.glowA * clamp(t * 2, 0, 1));
        px.disc(A.x, A.y, r + 1.2, look.edge, 1);
        px.disc(A.x, A.y, r, look.mid, 1);
        px.disc(A.x, A.y, Math.max(0.6, r - 1.2), style === 'dark' ? PAL.ink : look.inner, 1);
        if (style !== 'dark') px.disc(A.x, A.y, Math.max(0.5, r - 2.4), look.core, 1);
        else px.ring(A.x, A.y, r + 1.2, 1, PAL.void4, 1);
        // swirl ring (water) / contracting ring (dark) / twinkle star (prism)
        if (style === 'water') {
          const rr = 9 - 3 * t;
          for (let k = 0; k < 2; k++) {
            const a0 = el * 0.012 + k * Math.PI;
            for (let q = 0; q < 10; q++) {
              const aa = a0 + q * 0.16;
              px.dot(A.x + Math.cos(aa) * rr, A.y + Math.sin(aa) * rr * 0.75, q < 3 ? PAL.white : PAL.water3, 1);
            }
          }
        } else if (style === 'dark') {
          const rr = 4 + 18 * (1 - E.outQ(t));
          px.ring(A.x, A.y, rr, 1, PAL.void3, 0.4 + 0.6 * t);
        }
        if (t > 0.35 && style !== 'water') {
          const k = (t - 0.35) / 0.65;
          const tw = Math.floor(el / 50) % 2 === 0 ? 0 : Math.PI / 4;
          px.star(A.x, A.y, 3 + W * 0.9 * k, 1.2, style === 'dark' ? PAL.void4 : PAL.white, 0.9, tw);
        }
        return true;
      }
      // ------------------------------------------------------------- fire
      const fel = el - chargeMs;
      if (!fired) {
        fired = true;
        A = snap(fromFn());
        setup();
        EXT = clamp(L1 * 0.9, 55, 110);
        snd('beamFire');
        opts.onFire?.();
        void shake(scene, fireMs, style === 'prism' ? 1.5 : 1);
        // muzzle burst
        for (let i = 0; i < 10; i++) {
          const a = ang + Math.PI + RR(-1.3, 1.3);
          sp.add({ x: A.x, y: A.y, vx: Math.cos(a) * RR(60, 140), vy: Math.sin(a) * RR(60, 140), drag: 5, life: RR(150, 260), colors: sprayColors, shape: 'streak', len: 0.03 });
        }
        if (style === 'prism') {
          const fl = scene.add.rectangle(0, 0, GAME_W, GAME_H, PAL.cyan4, 0.22).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.OVERLAY - 1);
          void animate(scene, 90, (t) => fl.setAlpha(0.22 * (1 - t) * (1 - t))).then(() => fl.destroy());
        }
      }
      if (fel >= fireMs) {
        // residue sparkles along the beam line
        for (let i = 0; i < 14; i++) {
          const s = RR(0, L1);
          const p = { x: A.x + d0.x * s, y: A.y + d0.y * s };
          sp.add({ x: p.x + RR(-2, 2), y: p.y + RR(-2, 2), vx: RR(-8, 8), vy: RR(-18, -4), life: RR(250, 480), colors: style === 'dark' ? [PAL.void4, PAL.void3, PAL.void2] : [PAL.white, look.inner, look.mid], shape: 'px', flicker: R() < 0.5 });
        }
        return false;
      }
      const ext = clamp(fel / EXT, 0, 1);
      let head = L1 * E.outQ(ext);
      if (fel >= EXT && !impacted) {
        impacted = true;
        opts.onImpact?.();
      }
      if (opts.through && fel >= PIERCE_AT) {
        const u = clamp((fel - PIERCE_AT) / PIERCE_MS, 0, 1);
        head = L1 + (tot - L1) * E.outQ(u);
        if (u >= 1 && !pierced) {
          pierced = true;
          opts.onPierce?.();
        }
      }
      // width envelope
      let env = 1;
      if (fel < EXT) env = 1.2;
      else env = 1 + 0.3 * Math.max(0, 1 - (fel - EXT) / 140);
      env *= 1 + 0.08 * Math.sin(fel * 0.045) + 0.05 * Math.sin(fel * 0.13);
      let endK = 1;
      if (fel > fireMs - END) endK = Math.pow(1 - (fel - (fireMs - END)) / END, 1.6);
      const baseW = W * env * endK;
      const jitter = frame % 2 === 0 ? 0.4 : -0.2;
      const half = (s: number, side: 1 | -1) => {
        let w = baseW / 2;
        w *= 1 + 0.26 * Math.pow(Math.max(0, Math.sin((s - fel * 0.24) * 0.3)), 2);
        if (s < 10) w *= lerp(0.6, 1, s / 10);
        if (style === 'water') w += endK * (side > 0 ? 1.5 * Math.sin(s * 0.42 - fel * 0.035) + 0.7 * Math.sin(s * 1.1 + fel * 0.05) : 1.5 * Math.sin(s * 0.42 - fel * 0.035 + 2.1) + 0.7 * Math.sin(s * 0.9 - fel * 0.06));
        else w += jitter * endK;
        return w;
      };
      const layers: [number, number, number, number][] = [
        // [scale, add, color, alpha]
        [1, 3, look.glow, look.glowA],
        [1, 1, look.edge, 1],
        [1, 0, look.mid, 1],
        [0.62, 0, look.inner, 1],
        [0.34, 0, look.core, 1],
      ];
      for (const sg of segs) {
        const s1 = clamp(head - sg.s0, 0, sg.len);
        if (s1 <= 0) continue;
        const capEnd = head < sg.s0 + sg.len + 0.01 || sg === segs[segs.length - 1];
        for (const [k, add, c, al] of layers) {
          const fn = (s: number, side: 1 | -1) => {
            const h = half(s + sg.s0, side);
            let v = h * k + add * endK;
            if (add >= 3) v += (hash2(Math.floor((s + sg.s0) / 3), frame * 2 + (side > 0 ? 1 : 0)) - 0.5) * 2.4 * endK;
            return k < 0.4 ? Math.max(endK > 0.12 ? 0.5 : 0, v) : v;
          };
          ribbon(px, sg.a, sg.d, 0, s1, fn, c, al, sg === segs[0], capEnd);
        }
        // helix strands / dark crackle
        const n = { x: -sg.d.y, y: sg.d.x };
        if (style !== 'dark') {
          for (let k = 0; k < 2; k++) {
            for (let s = 5; s < s1 - 2; s++) {
              const ph = (s + sg.s0) * 0.26 - fel * 0.032 + k * Math.PI;
              if (Math.cos(ph) <= 0.1) continue;
              const off = (baseW / 2 + 1.5) * Math.sin(ph);
              px.dot(sg.a.x + sg.d.x * s + n.x * off, sg.a.y + sg.d.y * s + n.y * off, Math.cos(ph) > 0.7 ? look.core : look.inner, endK > 0.2 ? 1 : endK * 5);
            }
          }
        } else if (frame % 2 === 0) {
          for (let k = 0; k < 3; k++) {
            const s = RR(4, Math.max(5, s1 - 4));
            const side = R() < 0.5 ? 1 : -1;
            let x = sg.a.x + sg.d.x * s + n.x * side * (baseW / 2 + 1);
            let y = sg.a.y + sg.d.y * s + n.y * side * (baseW / 2 + 1);
            for (let q = 0; q < 4; q++) {
              const nx2 = x + sg.d.x * RR(1, 3) + n.x * side * RR(0, 2.5);
              const ny2 = y + sg.d.y * RR(1, 3) + n.y * side * RR(0, 2.5);
              px.line(x, y, nx2, ny2, PAL.void4, endK);
              x = nx2;
              y = ny2;
            }
          }
        }
        // energy flow: dashes racing along the beam inside the bright zones
        if (style !== 'dark' && endK > 0.25) {
          const lanes: [number, number, number][] = [
            [0, look.mid, 0],
            [0.5, look.core, 4],
            [-0.5, look.core, 9],
            [0.86, look.inner, 2],
            [-0.86, look.inner, 7],
          ];
          for (const [lo, c, ph] of lanes) {
            for (let s = 4; s < s1 - 2; s++) {
              const gs = s + sg.s0;
              const m = (((gs - fel * 0.28 + ph * 3) % 13) + 13) % 13;
              if (m > (lo === 0 ? 3 : 5)) continue;
              const off = lo === 0 ? 0 : half(gs, lo > 0 ? 1 : -1) * lo;
              px.dot(sg.a.x + sg.d.x * s + n.x * off, sg.a.y + sg.d.y * s + n.y * off, c, 1);
            }
          }
        }
        // prism: dispersed rainbow rim — warm on one side, cool on the other, scrolling
        if (style === 'prism' && endK > 0.15) {
          const warm = [PAL.crim3, PAL.fire3, PAL.gold3];
          const cool = [PAL.leaf3, PAL.water3, PAL.void3];
          for (let s = 4; s < s1; s++) {
            const gs = s + sg.s0;
            for (const side of [1, -1] as const) {
              if ((Math.floor(gs) + frame * (side > 0 ? 1 : 2)) % 11 === 0) continue;
              const band = side > 0 ? warm : cool;
              const ci = Math.floor((gs - fel * 0.12) / 3);
              const off = (half(gs, side) + 1.6) * side;
              px.dot(sg.a.x + sg.d.x * s + n.x * off, sg.a.y + sg.d.y * s + n.y * off, band[((ci % 3) + 3) % 3], endK);
              if ((Math.floor(gs * 1.7) + frame) % 7 === 0) {
                const off2 = (half(gs, side) + 3) * side;
                px.dot(sg.a.x + sg.d.x * s + n.x * off2, sg.a.y + sg.d.y * s + n.y * off2, band[(((ci + 1) % 3) + 3) % 3], endK);
              }
            }
          }
        }
      }
      // muzzle flare: lens cross (long across the beam, short along it)
      const mf = endK * (1 + (frame % 3 === 0 ? 0.15 : 0));
      if (mf > 0.05) {
        const rr = W * 0.62 * mf;
        // twinkling flare under the bulb (only the ray tips poke out): alternates + / × every 2 frames
        const tw = Math.floor(frame / 2) % 2 === 0 ? ang : ang + Math.PI / 4;
        px.star(A.x, A.y, W * 1.15 * mf, 1.4, style === 'dark' ? PAL.void4 : PAL.white, 0.9, tw);
        px.disc(A.x, A.y, rr + 2.5, look.glow, look.glowA);
        px.disc(A.x, A.y, rr + 1, look.edge, 1);
        px.disc(A.x, A.y, rr, look.mid, 1);
        px.disc(A.x, A.y, rr * 0.7, style === 'dark' ? PAL.ink : look.inner, 1);
        if (style !== 'dark') px.disc(A.x, A.y, rr * 0.4, look.core, 1);
      }
      // impact flare at the target (and at the pierce exit)
      const flareAt = (P: XY, k: number) => {
        const tw = Math.floor(fel / 45) % 2 === 0 ? 0 : Math.PI / 4;
        const rr = (W * 0.7 + (frame % 2) * 1.2) * k;
        px.star(P.x, P.y, rr * 2.3, 1.8, style === 'dark' ? PAL.void4 : PAL.white, 0.95, ang + tw);
        px.disc(P.x, P.y, rr + 3, look.glow, look.glowA);
        px.disc(P.x, P.y, rr + 1, look.edge, 1);
        px.disc(P.x, P.y, rr, look.mid, 1);
        px.disc(P.x, P.y, rr * 0.66, style === 'dark' ? PAL.ink : look.inner, 1);
        if (style !== 'dark') px.disc(P.x, P.y, rr * 0.36, look.core, 1);
        else px.ring(P.x, P.y, rr * 0.66, 1, PAL.void4, 0.8);
      };
      if (impacted) {
        const T = pts[1];
        flareAt(T, endK);
        if (pierced && pts[2]) flareAt(pts[2], endK * 0.8);
        if (live && fel - lastRing > 75 && endK > 0.3) {
          lastRing = fel;
          sp.add({ x: T.x, y: T.y, life: 220, size: W * 0.6, grow: 70, shape: 'ring', colors: [look.core, look.inner, look.mid], alpha: 0.9, fadeAt: 0.3 });
        }
        if (live && endK > 0.2) {
          // back-spray from the impact
          const n = (dt / 16.7) * 3;
          for (let i = 0; i < n; i++) {
            const a = ang + Math.PI + RR(-1.25, 1.25);
            const v = RR(60, 170);
            if (style === 'water') {
              sp.add({ x: T.x, y: T.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 70, ay: 520, life: RR(260, 460), colors: [PAL.white, PAL.water4, PAL.water3, PAL.water2], shape: 'sq', size: R() < 0.35 ? 2 : 1 });
            } else if (style === 'prism') {
              sp.add({ x: T.x, y: T.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, ay: 300, vrot: RR(-14, 14), life: RR(260, 420), colors: [PAL.white, PAL.cyan4, PAL.cyan3, PAL.cyan2], shape: R() < 0.5 ? 'shard' : 'streak', size: RR(1.8, 3.2), len: 0.025 });
            } else {
              sp.add({ x: T.x, y: T.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3, life: RR(200, 360), colors: [PAL.void4, PAL.void3, PAL.void2], shape: 'streak', len: 0.03 });
            }
          }
          if (style === 'water' && R() < 0.35) {
            glowSp.add({ x: T.x + RR(-4, 4), y: T.y + RR(-4, 4), vx: RR(-20, 20) - d0.x * 25, vy: RR(-25, -5), life: RR(350, 600), colors: [PAL.water2, PAL.water1], shape: 'puff', size: RR(3, 5), grow: 9, alpha: 0.5 });
          }
          if (style === 'prism' && R() < 0.5) {
            const ci = pick(RAINBOW);
            sp.add({ x: T.x, y: T.y, vx: RR(-90, 90), vy: RR(-90, 60), drag: 3, life: RR(200, 360), colors: [ci], shape: 'px' });
          }
        }
      }
      // fringe particles peeling off the beam
      if (live && endK > 0.3) {
        const n = (dt / 16.7) * (style === 'prism' ? 4 : 2.5);
        for (let i = 0; i < n; i++) {
          const s = RR(6, Math.min(head, L1));
          const side = R() < 0.5 ? 1 : -1;
          const h = half(s, side) + 1;
          const x = A.x + d0.x * s + n0.x * h * side;
          const y = A.y + d0.y * s + n0.y * h * side;
          const v = RR(15, 45);
          if (style === 'prism') sp.add({ x, y, vx: n0.x * side * v + d0.x * 30, vy: n0.y * side * v + d0.y * 30, drag: 2, life: RR(150, 300), colors: [pick(RAINBOW), pick(RAINBOW)], shape: 'px' });
          else if (style === 'water') sp.add({ x, y, vx: n0.x * side * v + d0.x * 20, vy: n0.y * side * v + d0.y * 20 - 20, ay: 420, life: RR(220, 400), colors: [PAL.water4, PAL.water3, PAL.water2], shape: R() < 0.3 ? 'sq' : 'px', size: 2 });
          else sp.add({ x, y, vx: n0.x * side * v, vy: n0.y * side * v - 10, drag: 2, life: RR(200, 380), colors: [PAL.void4, PAL.void3, PAL.void2, PAL.void1], shape: 'px' });
        }
      }
      return true;
    }, () => {
      px.g.destroy();
      back.release();
      sp.release();
      glowSp.release();
      if (!impacted) opts.onImpact?.();
      resolve();
    });
  });
}

// ==================================================================================== projectiles

export type ProjectileKind = 'darkOrb' | 'fireball' | 'spark' | 'boulder' | 'wave' | 'water';

export interface ProjectileOpts {
  /** Called when the projectile lands (the burst frame). */
  onImpact?: () => void;
  /** Called when it leaves the launcher (end of charge / rise). */
  onLaunch?: () => void;
  /** Flight time in ms (default depends on kind and distance). */
  ms?: number;
  /** Wind-up before launch: darkOrb orb growth 380, boulder rise 320, fireball ignition 140, spark 160. */
  chargeMs?: number;
  /** Arc height in px for lobbed shots. */
  arc?: number;
  depth?: number;
}

/**
 * Projectile from `from` to `to`. `from` may be a function (tracks a moving muzzle while charging).
 *  - darkOrb  (Uçurum Büyücüsü): orb grows with 3 orbiting runes, flies with a violet trail, the
 *             impact first IMPLODES (vortex pulls in) then bursts.
 *  - fireball (Magma Titanı / Kor Kurdu effects): lobbed flame ball with ember + smoke trail, flame burst.
 *  - spark    (Işık Perisi): three twinkling sparkles curve in staggered; onImpact on the last.
 *  - boulder  (Taş Muhafız): a rock tears out of the ground under `from`, spins along a parabola,
 *             shatters into chips and a dust cloud. Pass the throw point (hands) as `from`.
 *  - wave     (Gelgit Golemi): `from`/`to` are GROUND points; a foaming wave rolls along the floor
 *             and crashes over the target.
 *  - water    (Gelgit Golemi counter): a lobbed water blob that splashes.
 * Resolves at the end of the impact beat.
 */
export function projectile(scene: Phaser.Scene, from: XY | (() => XY), to: XY, kind: ProjectileKind, opts: ProjectileOpts = {}): Promise<void> {
  const fromFn = typeof from === 'function' ? from : () => from;
  switch (kind) {
    case 'darkOrb':
      return darkOrb(scene, fromFn, to, opts);
    case 'fireball':
      return lobbed(scene, fromFn, to, opts, 'fire');
    case 'water':
      return lobbed(scene, fromFn, to, opts, 'water');
    case 'spark':
      return sparkles3(scene, fromFn, to, opts);
    case 'boulder':
      return boulder(scene, fromFn, to, opts);
    case 'wave':
      return wave(scene, fromFn(), to, opts);
  }
}

const RUNES: readonly (readonly string[])[] = [
  ['.#.#.', '#####', '.#.#.', '.#.#.', '#...#'],
  ['##.##', '#...#', '.###.', '#...#', '##.##'],
  ['..#..', '.#.#.', '#.#.#', '.#.#.', '..#..'],
  ['#..##', '#.#..', '###..', '..#.#', '##..#'],
];

function drawRune(px: Px, k: number, x: number, y: number, a = 1, hot = false): void {
  const r = RUNES[k % RUNES.length];
  // dark halo under the glyph so it reads over anything
  px.rect(x - 3, y - 3, 7, 7, PAL.void0, 0.35 * a);
  px.stamp(r, Math.round(x - 2), Math.round(y - 2), hot ? PAL.white : PAL.void4, PAL.void4, PAL.void4, a);
}

function darkOrb(scene: Phaser.Scene, fromFn: () => XY, to: XY, opts: ProjectileOpts): Promise<void> {
  const depth = opts.depth ?? DEPTH.FX;
  const chargeMs = opts.chargeMs ?? 380;
  const px = layer(scene, depth);
  const sp = new Sparks(scene, depth + 0.2);
  const back = new Sparks(scene, depth - 0.1);
  let from = fromFn();
  const dist = vlen(vsub(to, from));
  const ms = opts.ms ?? clamp(dist * 3.4, 280, 480);
  const IMPL = 230;
  const BURST = 360;
  const trail: XY[] = [];
  let launched = false;
  let burst = false;
  let ctrl: XY = from;
  snd('darkPulse', 0.8);
  const orb = (x: number, y: number, r: number, el: number) => {
    px.disc(x, y, r + 2.5, PAL.void2, 0.5);
    px.disc(x, y, r + 1, PAL.void4, 1);
    px.disc(x, y, r, PAL.void3, 1);
    px.disc(x - 0.4, y - 0.4, Math.max(0.6, r - 1.3), PAL.void1, 1);
    px.disc(x + 0.3, y + 0.3, Math.max(0.5, r - 2.4), PAL.ink, 1);
    // specular glint (top-left) that twinkles
    if (r > 2.5) px.dot(x - r * 0.45, y - r * 0.55, Math.floor(el / 80) % 2 ? PAL.white : PAL.void4, 1);
  };
  return new Promise((resolve) => {
    onFrame(scene, (dt, el) => {
      px.clear();
      const live = dt > 0;
      if (el < chargeMs) {
        from = fromFn();
        const t = el / chargeMs;
        const r = 1.5 + 5.5 * E.outQ(t);
        orb(from.x, from.y, r, el);
        for (let k = 0; k < 3; k++) {
          const a = el * 0.009 + (k * Math.PI * 2) / 3;
          const rr = 15 - 3 * t;
          drawRune(px, k, from.x + Math.cos(a) * rr, from.y + Math.sin(a) * rr * 0.7, clamp(t * 3, 0, 1));
        }
        if (live && R() < 0.8) {
          const a = RR(0, Math.PI * 2);
          const rr = RR(12, 22);
          back.add({ x: from.x + Math.cos(a) * rr, y: from.y + Math.sin(a) * rr, ox: from.x, oy: from.y, spin: -4, pull: RR(50, 90), life: 500, colors: [PAL.void1, PAL.void2, PAL.void3, PAL.void4], shape: 'px' });
        }
        return true;
      }
      const fel = el - chargeMs;
      if (!launched) {
        launched = true;
        from = fromFn();
        const mid = vlerp(from, to, 0.5);
        ctrl = { x: mid.x, y: mid.y - clamp(dist * 0.18, 6, 22) };
        opts.onLaunch?.();
        snd('whoosh', 0.7);
      }
      if (fel < ms) {
        const u = fel / ms;
        const e = 0.35 * u + 0.65 * u * u;
        const p = qbez(from, ctrl, to, e);
        trail.unshift(p);
        if (trail.length > 9) trail.pop();
        // trail: shrinking violet blobs
        for (let i = trail.length - 1; i >= 1; i--) {
          const k = 1 - i / trail.length;
          const q = trail[i];
          px.disc(q.x, q.y, 1 + 4.8 * k, i > 5 ? PAL.void1 : i > 2 ? PAL.void2 : PAL.void3, 0.55 + 0.45 * k);
        }
        orb(p.x, p.y, 7, el);
        for (let k = 0; k < 3; k++) {
          const a = el * 0.016 + (k * Math.PI * 2) / 3;
          const q = trail[Math.min(trail.length - 1, 1 + k)] ?? p;
          drawRune(px, k, q.x + Math.cos(a) * 12, q.y + Math.sin(a) * 8, 1 - k * 0.2);
        }
        if (live) {
          for (let i = 0; i < 2; i++)
            sp.add({ x: p.x + RR(-3, 3), y: p.y + RR(-3, 3), vx: RR(-15, 15), vy: RR(-25, 0), drag: 2, life: RR(240, 420), colors: [PAL.void4, PAL.void3, PAL.void2, PAL.void1], shape: R() < 0.3 ? 'sq' : 'px', size: 2 });
        }
        return true;
      }
      const iel = fel - ms;
      if (iel < IMPL) {
        // IMPLODE: the world gets sucked into the orb
        const v = iel / IMPL;
        const ringR = 3 + 30 * Math.pow(1 - v, 1.3);
        px.ellipseRing(to.x, to.y, ringR, ringR * 0.8, 1, PAL.void3, 0.4 + 0.6 * v);
        if (ringR > 8) px.ellipseRing(to.x, to.y, ringR - 5, (ringR - 5) * 0.8, 1, PAL.void2, 0.6);
        // swirl arcs
        for (let k = 0; k < 4; k++) {
          const a0 = iel * 0.02 + (k * Math.PI) / 2;
          const rr = ringR * 0.75;
          for (let q = 0; q < 7; q++) {
            const a1 = a0 + q * 0.13;
            const r1 = rr - q * 0.9;
            px.dot(to.x + Math.cos(a1) * r1, to.y + Math.sin(a1) * r1 * 0.8, q < 2 ? PAL.void4 : PAL.void3, 1);
          }
        }
        orb(to.x, to.y, 7 * (1 - 0.75 * E.inQ(v)), el);
        if (live) {
          for (let i = 0; i < 3; i++) {
            const a = RR(0, Math.PI * 2);
            const rr = RR(18, 30);
            sp.add({ x: to.x + Math.cos(a) * rr, y: to.y + Math.sin(a) * rr, tx: to.x, ty: to.y, curl: 9, life: RR(140, 220), colors: [PAL.void2, PAL.void3, PAL.void4, PAL.white], shape: 'streak', len: 0.02, fadeAt: 1 });
          }
        }
        return true;
      }
      const bel = iel - IMPL;
      if (!burst) {
        burst = true;
        snd('darkPulse', 1, 0.8);
        opts.onImpact?.();
        const fl = scene.add.rectangle(0, 0, GAME_W, GAME_H, PAL.void2, 0.3).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.OVERLAY - 1).setBlendMode(Phaser.BlendModes.ADD);
        void animate(scene, 160, (t) => fl.setAlpha(0.3 * (1 - t))).then(() => fl.destroy());
        for (let i = 0; i < 26; i++) {
          const a = (i / 26) * Math.PI * 2 + RR(-0.1, 0.1);
          const v = RR(90, 200);
          sp.add({ x: to.x, y: to.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.8, drag: 4, life: RR(220, 420), colors: [PAL.white, PAL.void4, PAL.void3, PAL.void2], shape: 'streak', len: 0.03, size: i % 4 === 0 ? 2 : 1 });
        }
        for (let i = 0; i < 10; i++) {
          const a = RR(0, Math.PI * 2);
          back.add({ x: to.x, y: to.y, vx: Math.cos(a) * RR(20, 60), vy: Math.sin(a) * RR(20, 50) - 15, drag: 2, life: RR(400, 700), colors: [PAL.void2, PAL.void1, PAL.void0], shape: 'puff', size: RR(2, 4), grow: 7, alpha: 0.75 });
        }
        for (let k = 0; k < 4; k++) {
          const a = RR(0, Math.PI * 2);
          sp.add({ x: to.x, y: to.y, vx: Math.cos(a) * RR(40, 80), vy: Math.sin(a) * RR(40, 80) - 30, drag: 2.5, life: RR(360, 520), colors: [PAL.void4, PAL.void3], shape: 'plus', size: 2 });
        }
      }
      if (bel >= BURST) return false;
      const w = bel / BURST;
      // inverted flash core (black hole with a white rim) → expanding void rings
      const coreR = 12 * (1 - E.outQ(Math.min(1, w * 2.5)));
      if (coreR > 0.5) {
        px.disc(to.x, to.y, coreR + 2, PAL.white, 1);
        px.disc(to.x, to.y, coreR, PAL.ink, 1);
      }
      const r1 = 4 + 40 * E.outC(w);
      px.ellipseRing(to.x, to.y, r1, r1 * 0.8, w < 0.3 ? 4 : 2, w < 0.2 ? PAL.void4 : PAL.void3, 1 - w);
      const r2 = 2 + 26 * E.outC(Math.max(0, w - 0.12) / 0.88);
      if (w > 0.12) px.ellipseRing(to.x, to.y, r2, r2 * 0.8, 1, PAL.void2, 1 - w);
      if (bel < 110) {
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI) / 4 + Math.PI / 8;
          px.seg(to.x + Math.cos(a) * r1 * 0.5, to.y + Math.sin(a) * r1 * 0.4, to.x + Math.cos(a) * (r1 + 6), to.y + Math.sin(a) * (r1 + 6) * 0.8, 1, PAL.void4, 1 - bel / 110);
        }
      }
      return true;
    }, () => {
      px.g.destroy();
      sp.release();
      back.release();
      if (!burst) opts.onImpact?.();
      resolve();
    });
  });
}

/** Lobbed elemental ball: fire (flame + embers + smoke) or water (blob + droplets + splash). */
function lobbed(scene: Phaser.Scene, fromFn: () => XY, to: XY, opts: ProjectileOpts, el_: 'fire' | 'water'): Promise<void> {
  const fire = el_ === 'fire';
  const depth = opts.depth ?? DEPTH.FX;
  const chargeMs = opts.chargeMs ?? 140;
  const px = layer(scene, depth);
  const sp = new Sparks(scene, depth + 0.2);
  const smoke = new Sparks(scene, depth - 0.1);
  let from = fromFn();
  const dist = vlen(vsub(to, from));
  const ms = opts.ms ?? clamp(dist * 2.6, 300, 620);
  const arc = opts.arc ?? clamp(dist * 0.28, 12, 70);
  const BURST = 320;
  const C = fire ? RAMPS.fire : RAMPS.water;
  const hist: XY[] = [];
  let launched = false;
  let burst = false;
  snd(fire ? 'fireBurst' : 'waterSplash', 0.6);
  const ball = (x: number, y: number, r: number, vx: number, vy: number, el: number) => {
    const l = Math.hypot(vx, vy) || 1;
    const fx2 = vx / l;
    const fy2 = vy / l;
    const fl = Math.floor(el / 50) % 2;
    px.disc(x, y, r + 1 + fl * 0.5, C[1], 1);
    px.disc(x, y, r, C[2], 1);
    px.disc(x + fx2 * 0.8, y + fy2 * 0.8, r * 0.72, C[3], 1);
    px.disc(x + fx2 * 1.2 - 0.3, y + fy2 * 1.2 - 0.3, r * 0.42, C[4], 1);
    px.dot(x + fx2 * 1.5 - 0.8, y + fy2 * 1.5 - 0.8, PAL.white, 1);
  };
  return new Promise((resolve) => {
    onFrame(scene, (dt, el) => {
      px.clear();
      const live = dt > 0;
      if (el < chargeMs) {
        from = fromFn();
        const t = el / chargeMs;
        ball(from.x, from.y, 1 + 3 * E.outBack(t), 0, -1, el);
        if (live && R() < 0.7)
          sp.add({ x: from.x + RR(-3, 3), y: from.y + RR(-2, 2), vx: RR(-20, 20), vy: RR(-50, -20), drag: 2, life: RR(150, 300), colors: [C[4], C[3], C[2]], shape: 'px' });
        return true;
      }
      const fel = el - chargeMs;
      if (!launched) {
        launched = true;
        from = fromFn();
        opts.onLaunch?.();
        snd('whoosh', 0.6);
      }
      if (fel < ms) {
        const u = fel / ms;
        const base = vlerp(from, to, u);
        const p = { x: base.x, y: base.y - arc * 4 * u * (1 - u) };
        const vx = (to.x - from.x) / ms;
        const vy = (to.y - from.y) / ms - (arc * 4 * (1 - 2 * u)) / ms;
        hist.unshift(p);
        if (hist.length > 7) hist.pop();
        // flame tongues / water tail: chain of shrinking blobs with flicker
        for (let i = hist.length - 1; i >= 1; i--) {
          const k = 1 - i / hist.length;
          const q = hist[i];
          const j = fire && (i + Math.floor(el / 40)) % 2 === 0 ? 0.6 : 0;
          px.disc(q.x + j, q.y - j, 1 + 3.2 * k, i > 4 ? C[1] : i > 2 ? C[2] : C[3], fire ? 1 : 0.8);
        }
        ball(p.x, p.y, 4, vx, vy, el);
        if (live) {
          if (fire) {
            for (let i = 0; i < 2; i++)
              sp.add({ x: p.x + RR(-2, 2), y: p.y + RR(-2, 2), vx: -vx * 120 + RR(-25, 25), vy: -vy * 120 + RR(-35, 5), ay: -50, drag: 2, life: RR(260, 560), colors: [PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1, PAL.stone1], shape: R() < 0.25 ? 'sq' : 'px', size: 2 });
            if (R() < 0.35) smoke.add({ x: p.x, y: p.y, vx: RR(-8, 8), vy: RR(-18, -6), life: RR(380, 600), colors: [PAL.stone2, PAL.stone1, PAL.night2], shape: 'puff', size: 2, grow: 8, alpha: 0.55 });
          } else {
            sp.add({ x: p.x + RR(-2, 2), y: p.y + RR(-2, 2), vx: -vx * 80 + RR(-20, 20), vy: RR(-20, 10), ay: 420, life: RR(240, 420), colors: [PAL.white, PAL.water4, PAL.water3, PAL.water2], shape: R() < 0.3 ? 'sq' : 'px', size: 2 });
          }
        }
        return true;
      }
      const bel = fel - ms;
      if (!burst) {
        burst = true;
        snd(fire ? 'fireBurst' : 'waterSplash');
        opts.onImpact?.();
        if (fire) {
          for (let i = 0; i < 22; i++) {
            const a = RR(0, Math.PI * 2);
            const v = RR(50, 150);
            sp.add({ x: to.x, y: to.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.75 - 50, ay: -60, drag: 3.5, life: RR(260, 520), colors: [PAL.white, PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1], shape: R() < 0.4 ? 'sq' : 'streak', size: 2, len: 0.025 });
          }
          for (let i = 0; i < 8; i++) {
            const a = RR(0, Math.PI * 2);
            smoke.add({ x: to.x + Math.cos(a) * 4, y: to.y + Math.sin(a) * 3, vx: Math.cos(a) * RR(15, 35), vy: RR(-30, -10), drag: 1.5, delay: RR(60, 160), life: RR(500, 800), colors: [PAL.stone2, PAL.stone1, PAL.night2], shape: 'puff', size: RR(3, 5), grow: 7, alpha: 0.6 });
          }
        } else {
          for (let i = 0; i < 28; i++) {
            const a = -Math.PI / 2 + RR(-1.3, 1.3);
            const v = RR(60, 170);
            sp.add({ x: to.x, y: to.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 520, life: RR(320, 560), colors: [PAL.white, PAL.water4, PAL.water3, PAL.water2], shape: R() < 0.35 ? 'sq' : 'px', size: 2, floor: to.y + 10, bounce: 0.2 });
          }
          for (let i = 0; i < 5; i++)
            smoke.add({ x: to.x + RR(-5, 5), y: to.y + RR(-4, 4), vx: RR(-20, 20), vy: RR(-20, -5), life: RR(400, 650), colors: [PAL.water3, PAL.water2, PAL.water1], shape: 'puff', size: RR(2, 4), grow: 8, alpha: 0.5 });
        }
      }
      if (bel >= BURST) return false;
      const w = bel / BURST;
      if (fire) {
        // fireball blooms: white core → yellow → orange → red shell, then breaks up
        const R0 = 3 + 13 * E.outC(Math.min(1, w * 2));
        const fade = w < 0.45 ? 1 : 1 - (w - 0.45) / 0.55;
        px.disc(to.x, to.y, R0 + 1.5, PAL.fire1, fade);
        px.disc(to.x, to.y, R0, PAL.fire2, fade);
        px.disc(to.x, to.y - 1, R0 * 0.75, PAL.fire3, fade);
        px.disc(to.x, to.y - 1.5, R0 * 0.48 * (1 - w), PAL.fire4, 1);
        if (w < 0.2) px.disc(to.x, to.y - 1.5, R0 * 0.3, PAL.white, 1);
        // licking flame tongues around the rim
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI * 2) / 8 + bel * 0.004;
          const rr = R0 + 2 + ((k + Math.floor(bel / 45)) % 3);
          px.disc(to.x + Math.cos(a) * rr, to.y + Math.sin(a) * rr * 0.85, 1.8 * fade, k % 2 ? PAL.fire3 : PAL.fire2, fade);
        }
      } else {
        const r1 = 3 + 18 * E.outC(w);
        px.ellipseRing(to.x, to.y + 6, r1, r1 * 0.4, 1, w < 0.3 ? PAL.white : PAL.water4, 1 - w);
        const R0 = 5 * (1 - E.outQ(Math.min(1, w * 3)));
        if (R0 > 0.5) px.disc(to.x, to.y, R0, PAL.water4, 1).disc(to.x, to.y, R0 * 0.6, PAL.white, 1);
      }
      return true;
    }, () => {
      px.g.destroy();
      sp.release();
      smoke.release();
      if (!burst) opts.onImpact?.();
      resolve();
    });
  });
}

/** Three curving homing sparkles (Işık Perisi "Işık Kıvılcımı"). */
function sparkles3(scene: Phaser.Scene, fromFn: () => XY, to: XY, opts: ProjectileOpts): Promise<void> {
  const depth = opts.depth ?? DEPTH.FX;
  const chargeMs = opts.chargeMs ?? 160;
  const px = layer(scene, depth);
  const sp = new Sparks(scene, depth + 0.2);
  const glow = new Sparks(scene, depth + 0.3, Phaser.BlendModes.ADD);
  let from = fromFn();
  const dist = vlen(vsub(to, from));
  const ms = opts.ms ?? clamp(dist * 4, 340, 520);
  const STAG = 85;
  const BURST = 200;
  const n = 3;
  const hits = [false, false, false];
  const hist: XY[][] = [[], [], []];
  let curves: { c1: XY; c2: XY }[] = [];
  let launched = false;
  snd('holyChime', 0.7);
  const star = (x: number, y: number, r: number, rot: number, a = 1) => {
    px.star(x + 0.5, y + 0.5, r + 1.5, 1.4, PAL.gold3, 0.8 * a, rot);
    px.star(x + 0.5, y + 0.5, r, 1, PAL.gold4, a, rot);
    px.rect(x - 1, y - 1, 3, 3, PAL.white, a);
  };
  const total = chargeMs + ms + STAG * (n - 1) + BURST;
  return new Promise((resolve) => {
    onFrame(scene, (dt, el) => {
      px.clear();
      const live = dt > 0;
      if (el < chargeMs) {
        from = fromFn();
        const t = el / chargeMs;
        for (let i = 0; i < n; i++) {
          const a = el * 0.02 + (i * Math.PI * 2) / n;
          star(from.x + Math.cos(a) * 6 * t, from.y + Math.sin(a) * 4 * t, 1 + 2.5 * E.outBack(t), (Math.floor(el / 60) % 2) * (Math.PI / 4));
        }
        return true;
      }
      const fel = el - chargeMs;
      if (!launched) {
        launched = true;
        from = fromFn();
        opts.onLaunch?.();
        const dv = vnorm(vsub(to, from));
        const nv = { x: -dv.y, y: dv.x };
        curves = [-1, 0, 1].map((side) => ({
          c1: { x: from.x + nv.x * side * 34 - dv.x * 10, y: from.y + nv.y * side * 34 - 30 + (side === 0 ? -14 : 0) },
          c2: { x: to.x + nv.x * side * 22 - dv.x * 18, y: to.y + nv.y * side * 22 - 22 },
        }));
      }
      for (let i = 0; i < n; i++) {
        const lt = fel - i * STAG;
        if (lt < 0) {
          // waiting sparkle keeps orbiting the launcher
          const a = el * 0.02 + (i * Math.PI * 2) / n;
          star(from.x + Math.cos(a) * 6, from.y + Math.sin(a) * 4, 3.5, (Math.floor(el / 60) % 2) * (Math.PI / 4));
          continue;
        }
        const u = lt / ms;
        if (u < 1) {
          const e = E.inOutQ(u);
          const p = cbez(from, curves[i].c1, curves[i].c2, to, e);
          hist[i].unshift(p);
          if (hist[i].length > 10) hist[i].pop();
          const h = hist[i];
          for (let k = h.length - 1; k >= 1; k--) px.dot(h[k].x, h[k].y, k < 3 ? PAL.gold4 : k < 6 ? PAL.gold3 : PAL.gold2, 1 - k / h.length);
          star(p.x, p.y, 3.5 + (Math.floor(el / 40) % 2), (Math.floor(el / 60) % 2) * (Math.PI / 4));
          if (live && R() < 0.6)
            sp.add({ x: p.x + RR(-1, 1), y: p.y + RR(-1, 1), vx: RR(-10, 10), vy: RR(5, 25), life: RR(250, 420), colors: [PAL.white, PAL.gold4, PAL.gold3], shape: 'px', flicker: true });
        } else {
          if (!hits[i]) {
            hits[i] = true;
            snd('holyChime', 0.6, 1.2 + i * 0.15);
            for (let k = 0; k < 8; k++) {
              const a = (k / 8) * Math.PI * 2;
              sp.add({ x: to.x, y: to.y, vx: Math.cos(a) * RR(50, 90), vy: Math.sin(a) * RR(50, 90), drag: 5, life: RR(200, 320), colors: [PAL.white, PAL.gold4, PAL.gold3], shape: k % 2 ? 'star' : 'px', size: 2 });
            }
            glow.add({ x: to.x, y: to.y, life: 220, size: 3, grow: 50, shape: 'ring', colors: [PAL.gold4, PAL.gold3], alpha: 0.8 });
            if (i === n - 1) opts.onImpact?.();
          }
          const b = (lt - ms) / BURST;
          if (b < 1) {
            const k = 1 - b;
            px.star(to.x + 0.5, to.y + 0.5, 3 + 8 * k, 1.4, PAL.gold4, k, Math.PI / 4 * (i % 2));
            px.star(to.x + 0.5, to.y + 0.5, 2 + 5 * k, 1, PAL.white, k);
          }
        }
      }
      return el < total;
    }, () => {
      px.g.destroy();
      sp.release();
      glow.release();
      if (!hits[n - 1]) opts.onImpact?.();
      resolve();
    });
  });
}

// ---------------------------------------------------------------- boulder

const ROCK_FRAMES = 8;
const ROCK_SIZE = 26;
function ensureRock(scene: Phaser.Scene): string {
  const key = 'fx:boulder';
  if (scene.textures.exists(key)) return key;
  const S = ROCK_SIZE;
  const sheet = new PixelCanvas(S * ROCK_FRAMES, S);
  const rnd = mulberry32(91);
  const verts: { a: number; r: number }[] = [];
  for (let i = 0; i < 10; i++) verts.push({ a: (i / 10) * Math.PI * 2 + (rnd() - 0.5) * 0.4, r: 8.6 + rnd() * 2.2 });
  const facets: { x: number; y: number; k: number }[] = [];
  for (let i = 0; i < 9; i++) facets.push({ x: (rnd() - 0.5) * 14, y: (rnd() - 0.5) * 14, k: rnd() * 0.5 - 0.25 });
  const L = { x: -0.55, y: -0.65, z: 0.52 };
  for (let f = 0; f < ROCK_FRAMES; f++) {
    const rot = (f / ROCK_FRAMES) * Math.PI * 2;
    const p = new PixelCanvas(S, S);
    const c = S / 2;
    const pts = verts.map((v) => [c + Math.cos(v.a + rot) * v.r, c + Math.sin(v.a + rot) * v.r] as const);
    p.poly(pts, PAL.earth2);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        if (!p.isOpaque(x, y)) continue;
        // facet normal: nearest rotated facet seed tilts a sphere normal
        const lx = x + 0.5 - c;
        const ly = y + 0.5 - c;
        let best = 1e9;
        let fk = 0;
        for (const s of facets) {
          const sx = s.x * Math.cos(rot) - s.y * Math.sin(rot);
          const sy = s.x * Math.sin(rot) + s.y * Math.cos(rot);
          const d = (lx - sx) ** 2 + (ly - sy) ** 2;
          if (d < best) {
            best = d;
            fk = s.k;
          }
        }
        const r = 10;
        const nx = lx / r;
        const ny = ly / r;
        const nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny));
        const li = nx * L.x + ny * L.y + nz * L.z + fk;
        const col = li > 0.75 ? PAL.earth4 : li > 0.45 ? PAL.earth3 : li > 0.1 ? PAL.earth2 : li > -0.2 ? PAL.earth1 : PAL.stone1;
        p.set(x, y, col);
      }
    // cracks that rotate with the rock
    const crack = (a0: number, r0: number, a1: number, r1: number) => p.line(c + Math.cos(a0 + rot) * r0, c + Math.sin(a0 + rot) * r0, c + Math.cos(a1 + rot) * r1, c + Math.sin(a1 + rot) * r1, PAL.earth1);
    crack(0.3, 1, 1.0, 7);
    crack(2.6, 2, 3.4, 8);
    crack(4.6, 3, 5.2, 7.5);
    p.outline(PAL.ink);
    sheet.blit(p, f * S, 0);
  }
  const tex = scene.textures.addCanvas(key, sheet.toCanvas())!;
  for (let f = 0; f < ROCK_FRAMES; f++) tex.add(f, 0, f * S, 0, S, S);
  return key;
}

function boulder(scene: Phaser.Scene, fromFn: () => XY, to: XY, opts: ProjectileOpts): Promise<void> {
  const depth = opts.depth ?? DEPTH.FX;
  const key = ensureRock(scene);
  const riseMs = opts.chargeMs ?? 320;
  const px = layer(scene, depth - 0.05);
  const sp = new Sparks(scene, depth + 0.2);
  const dust = new Sparks(scene, depth + 0.1);
  let from = fromFn();
  const RISE = 22;
  const ground = { x: from.x, y: from.y + RISE };
  const dist = vlen(vsub(to, from));
  const ms = opts.ms ?? clamp(dist * 4.2, 380, 620);
  const arc = opts.arc ?? clamp(dist * 0.5, 26, 72);
  const rock = scene.add.image(ground.x, ground.y, key, 0).setDepth(depth).setVisible(false);
  let launched = false;
  let hit = false;
  let frame = 0;
  snd('earthQuake', 0.5);
  // ground tears open
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + RR(-1.2, 1.2);
    sp.add({ x: ground.x + RR(-4, 4), y: ground.y, vx: Math.cos(a) * RR(30, 80), vy: Math.sin(a) * RR(40, 110), ay: 420, life: RR(300, 520), rot: RR(0, 6), vrot: RR(-12, 12), colors: [PAL.earth3, PAL.earth2, PAL.earth1], shape: 'shard', size: RR(1.5, 2.5), floor: ground.y + 2, bounce: 0.3 });
  }
  for (let i = 0; i < 5; i++)
    dust.add({ x: ground.x + RR(-7, 7), y: ground.y + RR(-1, 2), vx: RR(-20, 20), vy: RR(-14, -4), life: RR(450, 700), colors: [PAL.earth4, PAL.earth3, PAL.stone2], shape: 'puff', size: RR(2, 3.5), grow: 6, alpha: 0.6 });
  return new Promise((resolve) => {
    onFrame(scene, (dt, el) => {
      px.clear();
      if (dt > 0) frame++;
      if (el < riseMs) {
        from = fromFn();
        const t = el / riseMs;
        const e = E.outBack(t, 1.4);
        const y = lerp(ground.y + 6, from.y, e);
        rock.setVisible(true).setPosition(Math.round(from.x + (frame % 4 < 2 ? 0 : 1) * (1 - t)), Math.round(y));
        rock.setFrame(t < 0.5 ? 0 : 1);
        // crumbling dirt from the bottom while it tears free
        if (dt > 0 && R() < 0.6)
          sp.add({ x: from.x + RR(-6, 6), y: y + 6, vx: RR(-10, 10), vy: RR(0, 20), ay: 400, life: RR(200, 400), colors: [PAL.earth2, PAL.earth1], shape: 'px', floor: ground.y + 2 });
        // crater ring
        px.ellipse(ground.x, ground.y + 1, 9, 3.5, PAL.ink, 0.55 * (1 - t * 0.5));
        px.ellipseRing(ground.x, ground.y + 1, 10, 4, 1, PAL.earth2, 0.8);
        return true;
      }
      const fel = el - riseMs;
      if (!launched) {
        launched = true;
        from = fromFn();
        opts.onLaunch?.();
        snd('whoosh', 0.8, 0.8);
      }
      if (fel < ms) {
        const u = fel / ms;
        const base = vlerp(from, to, u);
        const p = { x: base.x, y: base.y - arc * 4 * u * (1 - u) };
        rock.setPosition(Math.round(p.x), Math.round(p.y));
        rock.setFrame(Math.floor(fel / 45) % ROCK_FRAMES);
        if (dt > 0 && R() < 0.5) sp.add({ x: p.x + RR(-4, 4), y: p.y + RR(-4, 4), vx: RR(-6, 6), vy: RR(0, 12), ay: 200, life: RR(220, 380), colors: [PAL.earth3, PAL.earth2], shape: 'px' });
        const t2 = clamp(1 - el / (riseMs + 400), 0, 1);
        if (t2 > 0) px.ellipse(ground.x, ground.y + 1, 9, 3.5, PAL.ink, 0.5 * t2);
        return true;
      }
      if (!hit) {
        hit = true;
        rock.destroy();
        opts.onImpact?.();
        snd('earthQuake', 0.9);
        void shake(scene, 180, 2);
        for (let i = 0; i < 14; i++) {
          const a = RR(0, Math.PI * 2);
          const v = RR(60, 160);
          sp.add({ x: to.x + RR(-3, 3), y: to.y + RR(-3, 3), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 - 80, ay: 560, rot: RR(0, 6), vrot: RR(-16, 16), life: RR(420, 700), colors: [PAL.earth3, PAL.earth2, PAL.earth2, PAL.earth1], shape: 'shard', size: RR(1.6, 3.4), floor: to.y + 22, bounce: 0.35 });
        }
        for (let i = 0; i < 10; i++) {
          const a = RR(0, Math.PI * 2);
          dust.add({ x: to.x + Math.cos(a) * 4, y: to.y + Math.sin(a) * 3, vx: Math.cos(a) * RR(15, 45), vy: Math.sin(a) * RR(8, 25) - 12, drag: 2, life: RR(500, 850), colors: [PAL.earth4, PAL.earth3, PAL.stone3, PAL.stone2], shape: 'puff', size: RR(2.5, 4.5), grow: 8, alpha: 0.7 });
        }
        for (let i = 0; i < 8; i++) {
          const a = RR(0, Math.PI * 2);
          sp.add({ x: to.x, y: to.y, vx: Math.cos(a) * RR(80, 150), vy: Math.sin(a) * RR(80, 150), drag: 5, life: RR(150, 260), colors: [PAL.white, PAL.earth4, PAL.earth3], shape: 'streak', len: 0.03 });
        }
      }
      const bel = fel - ms;
      const w = bel / 260;
      if (w >= 1) return false;
      const r1 = 4 + 18 * E.outC(w);
      px.ring(to.x, to.y, r1, 1, w < 0.3 ? PAL.earth4 : PAL.earth3, 1 - w);
      if (w < 0.25) px.star(to.x + 0.5, to.y + 0.5, 12 * (1 - w * 3), 2, PAL.earth4, 1, Math.PI / 4).disc(to.x, to.y, 3 * (1 - w * 4), PAL.white, 1);
      return true;
    }, () => {
      px.g.destroy();
      if (rock.active) rock.destroy();
      sp.release();
      dust.release();
      if (!hit) opts.onImpact?.();
      resolve();
    });
  });
}

// ---------------------------------------------------------------- floor wave

/** Unit screen vector lying on the iso floor, perpendicular (on the floor) to screen direction d. */
function floorPerp(d: XY): XY {
  // screen → grid: c = (x/32 + y/16)/2, r = (y/16 − x/32)/2; rotate 90° in the grid; back to screen
  const c = (d.x / 32 + d.y / 16) / 2;
  const r = (d.y / 16 - d.x / 32) / 2;
  const pc = -r;
  const pr = c;
  return vnorm({ x: (pc - pr) * 32, y: (pc + pr) * 16 });
}

function wave(scene: Phaser.Scene, from: XY, to: XY, opts: ProjectileOpts): Promise<void> {
  const d = vnorm(vsub(to, from));
  let e = floorPerp(d);
  if (e.x < 0) e = { x: -e.x, y: -e.y };
  const towardCam = d.y > 0;
  const px = layer(scene, DEPTH.UNIT);
  const wet = layer(scene, DEPTH.TILE_FX + 1);
  const sp = new Sparks(scene, DEPTH.FX);
  const mist = new Sparks(scene, DEPTH.FX - 0.1);
  const start = { x: from.x + d.x * 10, y: from.y + d.y * 10 };
  const end = { x: to.x - d.x * 9, y: to.y - d.y * 9 };
  const dist = vlen(vsub(end, start));
  const ms = opts.ms ?? clamp(dist * 6.5, 380, 720);
  const RISE = opts.chargeMs ?? 180;
  const CRASH = 300;
  const HW = 16;
  const marks: { x: number; y: number; t: number }[] = [];
  let lastMark: XY | null = null;
  let hit = false;
  let launched = false;
  snd('waterSplash', 0.7, 0.8);

  const drawWave = (C: XY, H: number, lean: number, el: number, collapse: number) => {
    const crest: XY[] = [];
    const baseB: XY[] = [];
    const baseF: XY[] = [];
    for (let i = -HW; i <= HW + 0.01; i += 1.5) {
      const q = Math.abs(i) / HW;
      const k = Math.pow(Math.max(0, 1 - q * q), 0.6);
      const F = { x: C.x + e.x * i, y: C.y + e.y * i };
      const h = H * k * (1 + 0.14 * Math.sin(i * 0.7 + el * 0.02));
      const lf = (2 + h * 0.3) * lean;
      crest.push({ x: F.x + d.x * lf, y: F.y + d.y * lf - h });
      const bk = 7 + 7 * k;
      baseB.push({ x: F.x - d.x * bk, y: F.y - d.y * bk });
      baseF.push({ x: F.x + d.x * (1 + k), y: F.y + d.y * (1 + k) });
    }
    const polyOf = (a: XY[], b: XY[]) => {
      const pts: number[] = [];
      for (const q of a) pts.push(q.x, q.y);
      for (let i = b.length - 1; i >= 0; i--) pts.push(b[i].x, b[i].y);
      return pts;
    };
    const body = polyOf(baseB, crest);
    const face = polyOf(baseF, crest);
    const al = 1 - collapse;
    if (towardCam) {
      px.poly(body, PAL.water1, al);
      px.poly(face, PAL.water2, al);
    } else {
      px.poly(face, PAL.water1, al);
      px.poly(body, PAL.water2, al);
    }
    // inner light bands that scroll with the roll
    for (let j = 0; j < crest.length; j++) {
      const c = crest[j];
      const b = towardCam ? baseF[j] : baseB[j];
      for (const f of [0.35, 0.62]) {
        const x = lerp(c.x, b.x, f);
        const y = lerp(c.y, b.y, f) + Math.sin(j * 0.9 + el * 0.03 + f * 6) * 0.8;
        if ((j + Math.floor(el / 60)) % 3 !== 0) px.dot(x, y, f < 0.5 ? PAL.water3 : PAL.water2, al);
      }
    }
    // lit band just under the lip and a dark base line give the body volume
    for (let j = 0; j < crest.length; j++) {
      const c = crest[j];
      const b = towardCam ? baseF[j] : baseB[j];
      for (let q = 2; q <= 3; q++) px.dot(lerp(c.x, b.x, q / 14), lerp(c.y, b.y, q / 14) + 0.5, PAL.water3, al);
      px.dot(b.x, b.y - 1, PAL.water1, al);
    }
    // crest: bright lip + foam that boils
    for (let j = 0; j < crest.length; j++) {
      const c = crest[j];
      px.dot(c.x, c.y + 1, PAL.water4, al);
      px.dot(c.x, c.y, PAL.white, al);
      if ((j * 7 + Math.floor(el / 50)) % 4 === 0) px.dot(c.x, c.y - 1, PAL.white, al);
      if ((j * 5 + Math.floor(el / 70)) % 6 === 0) px.dot(c.x + d.x * 2, c.y + d.y * 2 - 1, PAL.water4, al);
    }
    // foam skirt along the floor contact
    const skirt = towardCam ? baseF : baseB;
    for (let j = 0; j < skirt.length; j++) if ((j + Math.floor(el / 40)) % 2 === 0) px.dot(skirt[j].x, skirt[j].y, PAL.water4, 0.85 * al);
    return crest;
  };

  return new Promise((resolve) => {
    onFrame(scene, (dt, el) => {
      px.clear();
      wet.clear();
      const live = dt > 0;
      // wet sheen left on the floor
      for (let i = marks.length - 1; i >= 0; i--) {
        const m = marks[i];
        const age = (el - m.t) / 700;
        if (age >= 1) {
          marks.splice(i, 1);
          continue;
        }
        wet.ellipse(m.x, m.y, 11 * (1 - age * 0.3), 4.5 * (1 - age * 0.3), PAL.water1, 0.45 * (1 - age));
      }
      if (el < RISE) {
        // the sea swells up in front of the caster
        const t = el / RISE;
        px.g.setDepth(unitDepth(start.y) + 0.5);
        drawWave(start, 2 + 5 * E.outQ(t), 0.2, el, 0);
        if (live && R() < 0.6) sp.add({ x: start.x + e.x * RR(-HW, HW), y: start.y + e.y * RR(-HW, HW) - 3, vx: RR(-10, 10), vy: RR(-60, -20), ay: 300, life: RR(250, 400), colors: [PAL.white, PAL.water4, PAL.water3], shape: 'px' });
        return true;
      }
      const fel = el - RISE;
      if (!launched) {
        launched = true;
        opts.onLaunch?.();
      }
      if (fel < ms) {
        const u = fel / ms;
        const k = 0.3 * u + 0.7 * u * u;
        const C = vlerp(start, end, k);
        px.g.setDepth(unitDepth(C.y) + 0.5);
        if (!lastMark || vlen(vsub(C, lastMark)) > 4) {
          marks.push({ x: C.x - d.x * 6, y: C.y - d.y * 6, t: el });
          lastMark = C;
        }
        const crest = drawWave(C, 7 + 7 * u, 0.6 + 0.4 * u, el, 0);
        if (live) {
          for (let i = 0; i < 2; i++) {
            const c = crest[RI(0, crest.length - 1)];
            sp.add({ x: c.x, y: c.y - 1, vx: d.x * RR(30, 70) + RR(-10, 10), vy: d.y * RR(30, 70) - RR(30, 70), ay: 420, life: RR(220, 380), colors: [PAL.white, PAL.water4, PAL.water3], shape: R() < 0.3 ? 'sq' : 'px', size: 2 });
          }
        }
        return true;
      }
      const cel = fel - ms;
      if (cel >= CRASH + 120) return false;
      const w = clamp(cel / CRASH, 0, 1);
      px.g.setDepth(unitDepth(end.y) + 0.5);
      // rear up and curl over the target, then collapse into spray
      const up = w < 0.35 ? E.outBack(w / 0.35) : 1;
      const col = w < 0.4 ? 0 : E.inQ((w - 0.4) / 0.6);
      const H = (14 + 12 * up) * (1 - col * 0.9);
      drawWave(end, H, 1 + 0.8 * up, el, col);
      if (!hit && w >= 0.33) {
        hit = true;
        opts.onImpact?.();
        snd('waterSplash', 1);
        void shake(scene, 160, 2);
        for (let i = 0; i < 34; i++) {
          const a = -Math.PI / 2 + RR(-1.2, 1.2);
          const v = RR(70, 190);
          sp.add({ x: end.x + e.x * RR(-HW, HW) + d.x * 6, y: end.y + e.y * RR(-HW, HW) - RR(6, 20), vx: Math.cos(a) * v + d.x * 50, vy: Math.sin(a) * v + d.y * 30, ay: 520, life: RR(380, 640), colors: [PAL.white, PAL.water4, PAL.water3, PAL.water2], shape: R() < 0.35 ? 'sq' : 'px', size: 2, floor: to.y + 8, bounce: 0.15 });
        }
        for (let i = 0; i < 7; i++)
          mist.add({ x: to.x + RR(-12, 12), y: to.y - RR(4, 18), vx: RR(-20, 20) + d.x * 20, vy: RR(-25, -5), life: RR(500, 800), colors: [PAL.water3, PAL.water2, PAL.water1], shape: 'puff', size: RR(3, 5), grow: 8, alpha: 0.45 });
      }
      if (hit) {
        const fr = clamp((cel - CRASH * 0.33) / 380, 0, 1);
        if (fr < 1) wet.ellipseRing(to.x, to.y + 2, 6 + 22 * E.outC(fr), 3 + 9 * E.outC(fr), 1, fr < 0.3 ? PAL.white : PAL.water4, 1 - fr);
      }
      return true;
    }, () => {
      px.g.destroy();
      wet.g.destroy();
      sp.release();
      mist.release();
      if (!hit) opts.onImpact?.();
      resolve();
    });
  });
}

// ==================================================================================== melee

export interface LungeOpts {
  /** Stop this many px short of `to` (default 14). */
  distance?: number;
  /** Dash duration in ms (default 120). */
  ms?: number;
  /** Wind-up duration in ms (default 180). */
  anticipation?: number;
  /** Wind-up pull-back in px (default 7). */
  pullback?: number;
  /** Hold at the target after contact (default 170). */
  hold?: number;
  /** Return duration (default 280). */
  returnMs?: number;
  /** Hop height on the way back (default 5). */
  hop?: number;
  /** Afterimage tint during the dash (default white; null = no afterimages). */
  trail?: number | null;
  /** Called on contact (do impact()/slash() here — hit-stop freezes the lunge too). */
  onImpact?: () => void;
  /** Called when the dash starts (e.g. bite(..., { snapAt: ms }) so the jaws shut on contact). */
  onDash?: () => void;
}

/**
 * Melee rush: anticipation (pull back + squash) → dash with stretch and afterimages → contact
 * (onImpact, 3px overshoot) → hold/recoil → hop back home. `to` is the screen point the sprite's
 * origin (feet) heads for. Resolves after the return; position and scale are restored exactly.
 */
export async function lunge(scene: Phaser.Scene, sprite: AnySprite, to: XY, opts: LungeOpts = {}): Promise<void> {
  const x0 = sprite.x;
  const y0 = sprite.y;
  const sx0 = sprite.scaleX;
  const sy0 = sprite.scaleY;
  const w0 = worldTf(sprite);
  // world → local offset (containers without scaling)
  const ox = x0 - w0.x;
  const oy = y0 - w0.y;
  const dist = opts.distance ?? 14;
  const dir = vnorm(vsub(to, w0));
  const stop = { x: to.x - dir.x * dist + ox, y: to.y - dir.y * dist + oy };
  const pull = opts.pullback ?? 7;
  const pb = { x: x0 - dir.x * pull, y: y0 - dir.y * pull };
  const set = (x: number, y: number, kx = 1, ky = 1) => {
    if (!sprite.active) return;
    sprite.setPosition(Math.round(x), Math.round(y));
    sprite.setScale(sx0 * kx, sy0 * ky);
  };
  // 1. anticipation
  await animate(scene, opts.anticipation ?? 180, (t) => {
    const e = E.outQ(t);
    set(lerp(x0, pb.x, e), lerp(y0, pb.y, e), 1 + 0.1 * e, 1 - 0.08 * e);
  });
  // 2. dash
  snd('whoosh');
  opts.onDash?.();
  const trailColor = opts.trail === undefined ? PAL.white : opts.trail;
  const dashMs = opts.ms ?? 120;
  const sp = new Sparks(scene, DEPTH.FX - 1);
  const ai = trailColor !== null ? afterimages(scene, sprite, dashMs + 20, trailColor) : Promise.resolve();
  await animate(scene, dashMs, (t, _el, dt) => {
    const e = E.inQ(t);
    set(lerp(pb.x, stop.x, e), lerp(pb.y, stop.y, e), 1.14, 0.9);
    if (dt > 0) {
      for (let i = 0; i < 2; i++) {
        const c = framePointToWorld(sprite, sprite.frame.realWidth * RR(0.2, 0.8), sprite.frame.realHeight * RR(0.3, 0.9));
        sp.add({ x: c.x, y: c.y, vx: -dir.x * RR(120, 220), vy: -dir.y * RR(120, 220), drag: 6, life: RR(120, 220), colors: [PAL.white, PAL.mist, PAL.steel], shape: 'streak', len: 0.04 });
      }
    }
  });
  sp.release();
  // 3. contact: overshoot a few px, fire the hit
  set(stop.x + dir.x * 3, stop.y + dir.y * 3, 0.92, 1.08);
  opts.onImpact?.();
  await sleep(scene, 16);
  // 4. hold + recoil
  await animate(scene, opts.hold ?? 170, (t) => {
    const e = E.outQ(t);
    set(stop.x + dir.x * 3 * (1 - e) - dir.x * 2 * e, stop.y + dir.y * 3 * (1 - e) - dir.y * 2 * e, lerp(0.92, 1, e), lerp(1.08, 1, e));
  });
  // 5. return with a hop
  const from = { x: stop.x - dir.x * 2, y: stop.y - dir.y * 2 };
  const hop = opts.hop ?? 5;
  await animate(scene, opts.returnMs ?? 280, (t) => {
    const e = E.inOutQ(t);
    set(lerp(from.x, x0, e), lerp(from.y, y0, e) - Math.sin(Math.PI * t) * hop, 1, t > 0.85 ? 1.05 - (t - 0.85) : 1);
  });
  set(x0, y0);
  if (sprite.active) sprite.setPosition(x0, y0);
  await ai;
}

/** Afterimages: tinted ghost copies of the sprite's current frame every 2 frames for `ms`, each fading in ~180 ms. */
export function afterimages(scene: Phaser.Scene, sprite: AnySprite, ms: number, color: number = PAL.white, opts: { every?: number; alpha?: number; life?: number } = {}): Promise<void> {
  const every = opts.every ?? 32;
  const life = opts.life ?? 180;
  const a0 = opts.alpha ?? 0.7;
  const ghosts: { img: Phaser.GameObjects.Image; age: number }[] = [];
  let acc = every;
  return new Promise((resolve) => {
    onFrame(scene, (dt, el) => {
      if (el < ms && sprite.active) {
        acc += dt;
        if (acc >= every) {
          acc = 0;
          const g = ghostOf(scene, sprite, ghosts.length % 2 === 0 ? color : shade(color, 1), a0);
          if (g) {
            g.setBlendMode(Phaser.BlendModes.ADD);
            ghosts.push({ img: g, age: 0 });
          }
        }
      }
      for (let i = ghosts.length - 1; i >= 0; i--) {
        const g = ghosts[i];
        g.age += dt;
        const t = g.age / life;
        if (t >= 1) {
          g.img.destroy();
          ghosts.splice(i, 1);
        } else g.img.setAlpha(a0 * (1 - t) * (1 - t));
      }
      return el < ms || ghosts.length > 0;
    }, () => {
      for (const g of ghosts) g.img.destroy();
      resolve();
    });
  });
}

export interface SlashOpts {
  /** Accent color (its palette ramp is used). Default white. */
  color?: number;
  ramp?: Ramp;
  /** Direction the blade travels, radians (0 = right, +π/2 = down). Default −0.5 (rising cut to the right). */
  angle?: number;
  /** Arc radius in px (default 18). */
  size?: number;
  /** Bow the arc the other way. */
  flip?: boolean;
  /** Duration ms (default 210). */
  ms?: number;
  depth?: number;
  /** Play the slash sound (default true). */
  sound?: boolean;
}

/**
 * Crescent slash smear: a 1-frame flash line, then a thick crescent whose head sweeps fast and
 * whose tail chases it (smear frames), a straight cut-line flash at the peak, and pixels peeling
 * off the tail. (x, y) is the middle of the cut.
 */
export function slash(scene: Phaser.Scene, x: number, y: number, opts: SlashOpts = {}): Promise<void> {
  const ramp = opts.ramp ?? (opts.color !== undefined ? rampOf(opts.color) : RAMP_WHITE);
  const ang = opts.angle ?? -0.5;
  const R0 = opts.size ?? 20;
  const ms = opts.ms ?? 210;
  const sgn = opts.flip ? -1 : 1;
  const SW = 2.2; // sweep (radians)
  const TH = Math.max(4, R0 * 0.4);
  const thMid = ang - (sgn * Math.PI) / 2;
  const O = { x: x - Math.cos(thMid) * R0, y: y - Math.sin(thMid) * R0 };
  const th0 = thMid - (sgn * SW) / 2;
  const px = layer(scene, opts.depth ?? DEPTH.FX + 1);
  const sp = new Sparks(scene, (opts.depth ?? DEPTH.FX + 1) + 0.1);
  if (opts.sound !== false) snd('slash');
  let sparked = false;
  const P = (th: number, r: number) => ({ x: O.x + Math.cos(th) * r, y: O.y + Math.sin(th) * r });
  const crescent = (a0: number, a1: number, thick: number, inset: number, c: number, al: number) => {
    const n = 18;
    const out: number[] = [];
    const inn: number[] = [];
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const th = lerp(a0, a1, f);
      const w = thick * Math.sin(Math.PI * Math.pow(f, 1.5));
      const p1 = P(th, R0 + 1 - inset);
      const p2 = P(th, R0 + 1 - inset - w);
      out.push(p1.x, p1.y);
      inn.push(p2.x, p2.y);
    }
    const pts = out.slice();
    for (let i = inn.length - 2; i >= 0; i -= 2) pts.push(inn[i], inn[i + 1]);
    px.poly(pts, c, al);
  };
  return new Promise((resolve) => {
    onFrame(scene, (dt, el) => {
      const t = el / ms;
      px.clear();
      if (t >= 1) return false;
      const head = E.outC(clamp(t / 0.42, 0, 1));
      const tail = E.inQ(clamp((t - 0.12) / 0.88, 0, 1));
      const a1 = th0 + sgn * SW * head;
      const a0 = th0 + sgn * SW * tail;
      if (el < 34) {
        // flash frame: hairline across the whole arc
        for (let i = 0; i <= 30; i++) {
          const q = P(th0 + (sgn * SW * i) / 30, R0);
          px.dot(q.x, q.y, PAL.white, 1);
        }
      } else if (Math.abs(a1 - a0) > 0.02) {
        const fade = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
        crescent(a0, a1, TH + 3, -1.5, ramp[0], 0.55 * fade);
        crescent(a0, a1, TH, 0, ramp[2], fade);
        crescent(a0, a1, TH * 0.68, 0, ramp[3], fade);
        crescent(a0, a1, TH * 0.36, 0, t < 0.5 ? PAL.white : ramp[4], fade);
        // dissolve: pixels peel off the tail
        if (dt > 0) {
          for (let i = 0; i < 3; i++) {
            const th = lerp(a0, a1, RR(0, 0.35));
            const q = P(th, R0 - RR(0, TH * 0.6));
            const tang = th + (sgn * Math.PI) / 2;
            sp.add({ x: q.x, y: q.y, vx: Math.cos(tang) * RR(10, 40) + Math.cos(th) * RR(5, 25), vy: Math.sin(tang) * RR(10, 40) + Math.sin(th) * RR(5, 25), drag: 3, life: RR(160, 300), colors: [ramp[4], ramp[3], ramp[2]], shape: 'px' });
          }
        }
      }
      // straight cut line at the peak
      if (t > 0.28 && t < 0.5) {
        const k = 1 - Math.abs(t - 0.39) / 0.11;
        const L = R0 * (1.1 + 0.4 * k);
        px.seg(x - Math.cos(ang) * L, y - Math.sin(ang) * L, x + Math.cos(ang) * L, y + Math.sin(ang) * L, 1, PAL.white, k);
      }
      if (!sparked && t > 0.35) {
        sparked = true;
        for (let i = 0; i < 7; i++) {
          const a = ang + RR(-0.5, 0.5);
          const v = RR(90, 170);
          sp.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 5, life: RR(150, 280), colors: [PAL.white, ramp[4], ramp[3]], shape: 'streak', len: 0.03 });
        }
      }
      return true;
    }, () => {
      px.g.destroy();
      sp.release();
      resolve();
    });
  });
}

/** Two crossing slashes (an X), the second 90 ms later, then a crossed flash and a burst. */
export async function xSlash(scene: Phaser.Scene, x: number, y: number, opts: SlashOpts & { gap?: number } = {}): Promise<void> {
  const ramp = opts.ramp ?? (opts.color !== undefined ? rampOf(opts.color) : RAMPS.void);
  const size = opts.size ?? 22;
  const ms = opts.ms ?? 200;
  const a1 = 0.75;
  const a2 = Math.PI - 0.75;
  const first = slash(scene, x, y, { ...opts, ramp, size, ms, angle: a1, flip: false });
  await sleep(scene, opts.gap ?? 90);
  const second = slash(scene, x, y, { ...opts, ramp, size, ms, angle: a2, flip: true });
  await sleep(scene, ms * 0.4);
  // crossed flash
  const px = layer(scene, (opts.depth ?? DEPTH.FX + 1) + 0.2);
  const sp = new Sparks(scene, (opts.depth ?? DEPTH.FX + 1) + 0.3);
  for (let i = 0; i < 16; i++) {
    const a = RR(0, Math.PI * 2);
    const v = RR(70, 170);
    sp.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 5, life: RR(180, 340), colors: [PAL.white, ramp[4], ramp[3], ramp[2]], shape: i % 3 ? 'streak' : 'sq', size: 1, len: 0.03 });
  }
  sp.release();
  await Promise.all([
    first,
    second,
    animate(scene, 220, (t) => {
      px.clear();
      if (t >= 1) return;
      const L = size * (1.2 + 0.6 * E.outQ(t));
      const k = 1 - t;
      for (const a of [a1, a2]) {
        px.seg(x - Math.cos(a) * L, y - Math.sin(a) * L, x + Math.cos(a) * L, y + Math.sin(a) * L, t < 0.3 ? 3 : 2, ramp[3], k);
        px.seg(x - Math.cos(a) * L, y - Math.sin(a) * L, x + Math.cos(a) * L, y + Math.sin(a) * L, 1, PAL.white, k);
      }
      px.star(x + 0.5, y + 0.5, 6 * k + 2, 2, PAL.white, k, Math.PI / 4);
    }).then(() => px.g.destroy()),
  ]);
}

/**
 * Snapping jaws: two rows of big fangs (glowing in `color`) gape open, SNAP shut on (x, y) with a
 * white flash and a crunch of sparks, hold, then dissolve. `snapAt` = ms from call to the snap
 * (default 135) so a lunge can open them during its dash (onDash) and close them on contact.
 */
export function bite(scene: Phaser.Scene, x: number, y: number, color: number = PAL.fire3, opts: { size?: number; depth?: number; snapAt?: number; onSnap?: () => void } = {}): Promise<void> {
  const ramp = rampOf(color);
  const S = opts.size ?? 13;
  const px = layer(scene, opts.depth ?? DEPTH.FX + 1);
  const sp = new Sparks(scene, (opts.depth ?? DEPTH.FX + 1) + 0.1);
  const snapAt = opts.snapAt ?? 135;
  const SNAP = Math.min(60, snapAt * 0.45);
  const OPEN = snapAt - SNAP;
  const HOLD = 100;
  const OUT = 130;
  let snapped = false;
  x = Math.round(x);
  y = Math.round(y);
  // fang layout across the jaw (fraction of S, length)
  const UPPER: [number, number][] = [
    [-0.95, 6],
    [-0.5, 8],
    [0, 5],
    [0.5, 8],
    [0.95, 6],
  ];
  const LOWER: [number, number][] = [
    [-0.72, 6],
    [-0.25, 5],
    [0.25, 5],
    [0.72, 6],
  ];
  const jaw = (cy: number, up: boolean, spread: number, hot: boolean, al: number) => {
    const sg = up ? -1 : 1; // upper jaw: gum above, fangs point down
    const fangs = up ? UPPER : LOWER;
    const gum: XY[] = [];
    for (let i = 0; i <= 12; i++) {
      const f = i / 12;
      const gx = x + (f * 2 - 1) * S * 1.12 * spread;
      const curve = (1 - Math.pow(f * 2 - 1, 2)) * 3;
      gum.push({ x: gx, y: cy + sg * (curve - 1) });
    }
    for (let i = 1; i < gum.length; i++) px.seg(gum[i - 1].x, gum[i - 1].y + sg, gum[i].x, gum[i].y + sg, 3, PAL.ink, 0.8 * al);
    for (let i = 1; i < gum.length; i++) px.seg(gum[i - 1].x, gum[i - 1].y, gum[i].x, gum[i].y, 2, hot ? PAL.white : ramp[3], al);
    for (const [fx, len] of fangs) {
      const bx = x + fx * S * spread;
      const by = cy + sg * (1 - Math.pow(fx, 2)) * 3 - sg;
      const tip = by - sg * len;
      px.poly([bx - 2.6, by + sg * 0.5, bx + 2.6, by + sg * 0.5, bx, tip - sg * 1.4], PAL.ink, 0.85 * al);
      px.poly([bx - 1.9, by, bx + 1.9, by, bx, tip], hot ? PAL.white : ramp[4], al);
      px.poly([bx - 0.9, by, bx + 1.4, by, bx + 0.3, tip + sg * 1.5], hot ? PAL.white : PAL.white, al);
      px.dot(bx - 1, by - sg * 0, hot ? PAL.white : ramp[2], al);
    }
  };
  return new Promise((resolve) => {
    onFrame(scene, (_dt, el) => {
      px.clear();
      const total = snapAt + HOLD + OUT;
      if (el >= total) return false;
      let gap: number;
      let spread = 1;
      let al = 1;
      let hot = false;
      if (el < OPEN) {
        const t = el / OPEN;
        gap = 12 + 4 * (1 - E.outQ(t));
        spread = 1.2 - 0.2 * E.outQ(t);
        al = clamp(t * 3, 0, 1);
      } else if (el < snapAt) {
        const t = (el - OPEN) / SNAP;
        gap = lerp(12, 3, E.inC(t));
      } else {
        if (!snapped) {
          snapped = true;
          snd('bite');
          opts.onSnap?.();
          for (let i = 0; i < 16; i++) {
            const a = (i % 2 ? 0 : Math.PI) + RR(-0.8, 0.8);
            const v = RR(70, 170);
            sp.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 25, ay: 220, drag: 3, life: RR(180, 360), colors: [PAL.white, ramp[4], ramp[3], ramp[2]], shape: i % 3 ? 'streak' : 'sq', size: 2, len: 0.03 });
          }
        }
        const st = el - snapAt;
        gap = st < 40 ? 2 : 3;
        hot = st < 50;
        al = st < HOLD ? 1 : 1 - (st - HOLD) / OUT;
        spread = 1 + 0.12 * (st / (HOLD + OUT));
      }
      jaw(y - gap - 1, true, spread, hot, al);
      jaw(y + gap + 1, false, spread, hot, al);
      if (hot) {
        const k = 1 - (el - snapAt) / 50;
        px.star(x + 0.5, y + 0.5, S * (1.2 + 0.6 * k), 2, PAL.white, 1, 0).star(x + 0.5, y + 0.5, S * 0.8, 1.5, ramp[4], 1, Math.PI / 4);
      }
      return true;
    }, () => {
      px.g.destroy();
      sp.release();
      if (!snapped) opts.onSnap?.();
      resolve();
    });
  });
}

// ---------------------------------------------------------------- shadow step (Gölge Suikastçı)

export interface Puddle {
  readonly x: number;
  readonly y: number;
  setPosition(x: number, y: number): void;
  /** Resolves when fully open. */
  opened: Promise<void>;
  /** Shrink away (with a wisp puff) and destroy. */
  close(ms?: number): Promise<void>;
  destroy(): void;
}

/** A living pool of shadow on the floor at (x, y): opens with overshoot, swirls, ripples and breathes wisps. */
export function shadowPuddle(scene: Phaser.Scene, x: number, y: number, opts: { rx?: number; ry?: number; openMs?: number; depth?: number } = {}): Puddle {
  const rx0 = opts.rx ?? 15;
  const ry0 = opts.ry ?? 6;
  const openMs = opts.openMs ?? 200;
  const px = layer(scene, opts.depth ?? DEPTH.TILE_FX + 3);
  const wisps = new Sparks(scene, DEPTH.FX - 2);
  let cx = x;
  let cy = y;
  let scale = 0;
  let stretch = 1;
  let closing = false;
  let closeT = 0;
  let closeMs = 160;
  let dead = false;
  let resolveOpen!: () => void;
  const opened = new Promise<void>((r) => (resolveOpen = r));
  let resolveClose: (() => void) | null = null;
  snd('darkPulse', 0.5, 1.2);
  const stop = onFrame(scene, (dt, el) => {
    px.clear();
    if (!closing) {
      const t = clamp(el / openMs, 0, 1);
      scale = E.outBack(t, 2);
      if (t >= 1) resolveOpen();
    } else {
      closeT += dt;
      const t = clamp(closeT / closeMs, 0, 1);
      scale = 1 - E.inQ(t);
      if (t >= 1) return false;
    }
    const rx = Math.max(0.5, rx0 * scale * stretch);
    const ry = Math.max(0.5, ry0 * scale);
    const breathe = Math.floor(el / 160) % 2;
    px.ellipse(cx, cy, rx + 1, ry + 1, PAL.void1, 0.85);
    px.ellipse(cx, cy, rx, ry, PAL.ink, 1);
    // far rim catches light, near rim stays dark
    for (let i = 0; i <= 20; i++) {
      const a = Math.PI + (i / 20) * Math.PI;
      px.dot(cx + Math.cos(a) * (rx + 0.5), cy + Math.sin(a) * (ry + 0.5), i % 4 === breathe ? PAL.void4 : PAL.void3, 1);
    }
    // swirl inside
    for (let k = 0; k < 3; k++) {
      const a0 = el * 0.006 + (k * Math.PI * 2) / 3;
      for (let q = 0; q < 6; q++) {
        const a = a0 + q * 0.22;
        const r = 0.35 + q * 0.07;
        px.dot(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r, q < 2 ? PAL.void3 : PAL.void2, 1);
      }
    }
    // ripple
    const rp = (el % 520) / 520;
    if (scale > 0.6) px.ellipseRing(cx, cy, rx * (1 + rp * 0.45), ry * (1 + rp * 0.45), 1, PAL.void2, 0.7 * (1 - rp));
    // wisps
    if (dt > 0 && R() < 0.55 * scale) {
      wisps.add({ x: cx + RR(-rx * 0.8, rx * 0.8), y: cy + RR(-ry * 0.5, ry * 0.5), vx: RR(-6, 6), vy: RR(-30, -14), drag: 0.6, life: RR(400, 700), colors: [PAL.void3, PAL.void2, PAL.void1], shape: R() < 0.3 ? 'sq' : 'px', size: 2 });
    }
    return true;
  }, () => {
    dead = true;
    px.g.destroy();
    wisps.release();
    resolveOpen();
    resolveClose?.();
  });
  const handle: Puddle = {
    get x() {
      return cx;
    },
    get y() {
      return cy;
    },
    setPosition(nx: number, ny: number) {
      cx = nx;
      cy = ny;
    },
    opened,
    close(ms = 160) {
      if (dead) return Promise.resolve();
      closing = true;
      closeMs = ms;
      for (let i = 0; i < 10; i++)
        wisps.add({ x: cx + RR(-rx0 * 0.7, rx0 * 0.7), y: cy + RR(-2, 2), vx: RR(-20, 20), vy: RR(-60, -25), drag: 1.5, life: RR(300, 520), colors: [PAL.void4, PAL.void3, PAL.void2], shape: 'px' });
      return new Promise((r) => (resolveClose = r));
    },
    destroy() {
      stop();
    },
  };
  (handle as unknown as { _stretch: (k: number) => void })._stretch = (k: number) => (stretch = k);
  return handle;
}

/**
 * The shadow pool glides along the floor from `from` to `to` (stretching with speed, leaving a
 * fading dark trail). Reuses `opts.puddle` or opens a new one. Resolves with the (still open) puddle.
 */
export async function puddleTravel(scene: Phaser.Scene, from: XY, to: XY, opts: { ms?: number; puddle?: Puddle } = {}): Promise<Puddle> {
  const pud = opts.puddle ?? shadowPuddle(scene, from.x, from.y);
  await pud.opened;
  const ms = opts.ms ?? 360;
  const trail = layer(scene, DEPTH.TILE_FX + 2);
  const marks: { x: number; y: number; t: number }[] = [];
  const stretchFn = (pud as unknown as { _stretch?: (k: number) => void })._stretch;
  snd('whoosh', 0.6, 0.7);
  await animate(scene, ms, (t, el) => {
    const e = E.inOutC(t);
    const p = vlerp(from, to, e);
    pud.setPosition(Math.round(p.x), Math.round(p.y));
    stretchFn?.(1 + 0.45 * Math.sin(Math.PI * t));
    if (marks.length === 0 || vlen(vsub(p, marks[marks.length - 1])) > 3) marks.push({ x: p.x, y: p.y, t: el });
    trail.clear();
    for (const m of marks) {
      const age = clamp((el - m.t) / 380, 0, 1);
      if (age < 1) trail.ellipse(m.x, m.y, 9 * (1 - age * 0.6), 3.5 * (1 - age * 0.6), PAL.void1, 0.75 * (1 - age));
    }
  });
  stretchFn?.(1);
  void animate(scene, 300, (t) => {
    trail.clear();
    for (const m of marks) trail.ellipse(m.x, m.y, 9 * 0.4, 3.5 * 0.4, PAL.void1, 0.5 * (1 - t));
  }).then(() => trail.g.destroy());
  return pud;
}

/**
 * Sink a sprite into the floor (crop below the ground line while it slides down), or emerge
 * with `reverse`. Tints it shadow-violet while submerged. The sprite stays hidden after sinking.
 */
export async function sinkInto(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, opts: { ms?: number; reverse?: boolean; tint?: number } = {}): Promise<void> {
  const ms = opts.ms ?? 220;
  const fh = sprite.frame.realHeight;
  const fw = sprite.frame.realWidth;
  const oy = sprite.displayOriginY;
  const depth = oy + 2;
  const baseY = sprite.y;
  const tint = opts.tint ?? PAL.void3;
  // the sprite's y is its ground spot (when emerging, place it there first)
  const y0 = baseY;
  sprite.setVisible(true);
  await animate(scene, ms, (t) => {
    if (!sprite.active) return;
    const k = opts.reverse ? 1 - E.outBack(t, 1.2) : E.inQ(t);
    const off = clamp(k, -0.2, 1) * depth;
    sprite.y = Math.round(y0 + off * sprite.scaleY);
    const keep = Math.max(0, Math.min(fh, oy - Math.max(0, off)));
    sprite.setCrop(0, 0, fw, keep);
    if (k > 0.05) sprite.setTint(tint);
    else sprite.clearTint();
  });
  if (!sprite.active) return;
  if (opts.reverse) {
    sprite.y = y0;
    sprite.setCrop();
    sprite.clearTint();
  } else {
    sprite.setVisible(false);
    sprite.y = y0;
    sprite.setCrop();
    sprite.clearTint();
  }
}

// ---------------------------------------------------------------- dive (Fırtına Atmacası)

/**
 * Point on a "rise then spiral dive" path at t ∈ [0, 1]: climbs `rise` px above `from`, then
 * corkscrews down onto `to` with a shrinking (iso-flattened) radius.
 */
export function diveSpiral(from: XY, to: XY, t: number, opts: { rise?: number; radius?: number; turns?: number } = {}): XY {
  const rise = opts.rise ?? 58;
  const R0 = opts.radius ?? 22;
  const turns = opts.turns ?? 1.25;
  const back = vnorm(vsub(from, to));
  // climb above the HIGHER of the two points so the dive always comes down steeply
  const apex = { x: from.x + back.x * 12, y: Math.min(from.y, to.y) - rise };
  const T1 = 0.3;
  if (t <= T1) {
    const u = E.outQ(t / T1);
    return { x: lerp(from.x, apex.x, u), y: lerp(from.y, apex.y, u) - Math.sin(Math.PI * u) * 6 };
  }
  const v = (t - T1) / (1 - T1);
  const c = vlerp(apex, to, E.inQ(v));
  const r = R0 * Math.pow(1 - v, 0.8);
  const a = v * turns * Math.PI * 2 + Math.PI;
  // offset is 0 at the apex (sin envelope) and closes onto the target
  const env = Math.sin(Math.PI * Math.min(1, v * 1.1));
  return { x: c.x + Math.cos(a) * r * env, y: c.y + Math.sin(a) * r * 0.55 * env };
}

/** Sampled diveSpiral path (n + 1 points). */
export function diveSpiralPath(from: XY, to: XY, n = 40, opts?: { rise?: number; radius?: number; turns?: number }): XY[] {
  const out: XY[] = [];
  for (let i = 0; i <= n; i++) out.push(diveSpiral(from, to, i / n, opts));
  return out;
}

/**
 * Full spiral dive attack: the sprite climbs, corkscrews onto `to` leaving white-green wind
 * streaks, two wind slashes cut the target (onImpact), then it arcs back home.
 */
export async function dive(scene: Phaser.Scene, sprite: AnySprite, to: XY, opts: { ms?: number; returnMs?: number; onImpact?: () => void; ramp?: Ramp; rise?: number } = {}): Promise<void> {
  const x0 = sprite.x;
  const y0 = sprite.y;
  const ramp = opts.ramp ?? RAMPS.leaf;
  const ms = opts.ms ?? 640;
  const from = { x: x0, y: y0 };
  const trail = layer(scene, DEPTH.FX - 1);
  const hist: XY[] = [];
  const lift = Math.round(sprite.displayOriginY * Math.abs(sprite.scaleY) * 0.45);
  snd('windGust');
  const drawTrail = () => {
    trail.clear();
    for (let i = 1; i < hist.length; i++) {
      const k = 1 - i / hist.length;
      const a = hist[i - 1];
      const b = hist[i];
      const d = vnorm(vsub(a, b));
      const n = { x: -d.y, y: d.x };
      for (const side of [-1, 1]) {
        const o = side * (2 + 3 * k);
        trail.line(a.x + n.x * o, a.y + n.y * o - lift, b.x + n.x * o, b.y + n.y * o - lift, i < 4 ? PAL.white : i < 9 ? ramp[4] : ramp[3], k);
      }
    }
  };
  let last = from;
  await animate(scene, ms, (t) => {
    const e = t < 0.3 ? t : 0.3 + E.inQ((t - 0.3) / 0.7) * 0.7;
    const p = diveSpiral(from, to, e, { rise: opts.rise });
    if (sprite.active) {
      sprite.setPosition(Math.round(p.x), Math.round(p.y));
      const vx = p.x - last.x;
      sprite.setAngle(clamp(vx * 3, -25, 25) * (sprite.flipX ? -1 : 1) + (t > 0.3 ? 10 : -10));
    }
    hist.unshift(p);
    if (hist.length > 14) hist.pop();
    last = p;
    drawTrail();
  });
  opts.onImpact?.();
  const cut = { x: to.x, y: to.y - lift - 4 };
  void slash(scene, cut.x, cut.y, { ramp, angle: 0.5, size: 16, ms: 180 });
  await sleep(scene, 70);
  void slash(scene, cut.x, cut.y, { ramp: RAMP_WHITE, angle: Math.PI - 0.5, flip: true, size: 15, ms: 180, sound: false });
  await sleep(scene, 90);
  const start = { x: sprite.x, y: sprite.y };
  const mid = { x: (start.x + x0) / 2, y: Math.min(start.y, y0) - 44 };
  await animate(scene, opts.returnMs ?? 380, (t) => {
    const e = E.inOutQ(t);
    const p = qbez(start, mid, { x: x0, y: y0 }, e);
    if (sprite.active) {
      sprite.setPosition(Math.round(p.x), Math.round(p.y));
      sprite.setAngle(lerp(-15, 0, t) * (sprite.flipX ? -1 : 1));
    }
    hist.unshift(p);
    if (hist.length > 10) hist.pop();
    drawTrail();
  });
  if (sprite.active) sprite.setPosition(x0, y0).setAngle(0);
  trail.g.destroy();
}

// ---------------------------------------------------------------- vines (Dikenli Pusucu)

/**
 * Thorn vines burst from the ground at `from`, crawl along the floor, rear up and whip `to`
 * (onImpact on the crack), scatter thorns, then retract into the ground.
 */
export function vineWhip(scene: Phaser.Scene, from: XY, to: XY, opts: { onImpact?: () => void; count?: number; lift?: number; depth?: number } = {}): Promise<void> {
  const count = opts.count ?? 2;
  const lift = opts.lift ?? 18;
  const px = layer(scene, opts.depth ?? DEPTH.FX - 2);
  const sp = new Sparks(scene, DEPTH.FX);
  const d = vnorm(vsub(to, from));
  let e = floorPerp(d);
  const toFloor = { x: to.x, y: to.y + lift };
  const GROW = 260;
  const LASH = 90;
  const HOLD = 110;
  const BACK = 220;
  let hit = false;
  snd('cardSlide', 0.6, 0.6);
  // ground bursts open
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + RR(-1.1, 1.1);
    sp.add({ x: from.x, y: from.y, vx: Math.cos(a) * RR(30, 80), vy: Math.sin(a) * RR(40, 100), ay: 420, rot: RR(0, 6), vrot: RR(-10, 10), life: RR(300, 500), colors: [PAL.earth3, PAL.earth2, PAL.earth1], shape: R() < 0.5 ? 'shard' : 'sq', size: 2, floor: from.y + 3, bounce: 0.3 });
  }
  const sample = (i: number, el: number, reveal: number, lashK: number): XY[] => {
    const o = (i - (count - 1) / 2) * 6;
    const P0 = { x: from.x + e.x * o, y: from.y + e.y * o };
    const bow = (i % 2 === 0 ? 1 : -1) * 9;
    const P1 = { x: lerp(from.x, toFloor.x, 0.45) + e.x * (o * 1.6 + bow), y: lerp(from.y, toFloor.y, 0.45) + e.y * (o * 1.6 + bow) + 2 };
    const P2 = { x: toFloor.x - d.x * 12 + e.x * o * 0.5, y: toFloor.y - d.y * 12 - 4 };
    // coiled (raised & pulled back) → strike
    const coil = { x: to.x - d.x * 14, y: to.y - 18 + i * 3 };
    const strike = { x: to.x + d.x * 4 + e.x * o * 0.3, y: to.y + 2 + i * 4 - 2 };
    const P3 = vlerp(coil, strike, lashK);
    const pts: XY[] = [];
    const N = 36;
    for (let k = 0; k <= N * reveal; k++) {
      const t = k / N;
      const b = cbez(P0, P1, P2, P3, t);
      // travelling wave, damped toward the tip once it strikes
      const amp = 3.6 * (1 - 0.5 * lashK) * Math.sin(Math.PI * t);
      const w = Math.sin(t * 9 - el * 0.025 + i * 2) * amp;
      const dd = cbez(P0, P1, P2, P3, Math.min(1, t + 0.02));
      const tv = vnorm(vsub(dd, b));
      pts.push({ x: b.x - tv.y * w, y: b.y + tv.x * w });
    }
    return pts;
  };
  const drawVine = (pts: XY[], el: number) => {
    if (pts.length < 2) return;
    const n = pts.length;
    px.stroke(pts, 5.4, 2.6, PAL.ink);
    px.stroke(pts, 4, 1.4, PAL.leaf1);
    px.stroke(
      pts.map((p) => ({ x: p.x - 0.6, y: p.y - 0.8 })),
      2.6,
      1,
      PAL.leaf2,
    );
    for (let k = 1; k < n; k += 1) if (k % 2 === 0) px.dot(pts[k].x - 1, pts[k].y - 1.5, PAL.leaf3, 1);
    // thorns
    for (let k = 3; k < n - 1; k += 3) {
      const a = pts[k];
      const b = pts[k + 1];
      const tv = vnorm(vsub(b, a));
      const side = (k / 3) % 2 === 0 ? 1 : -1;
      const nx = -tv.y * side;
      const ny = tv.x * side;
      const w = lerp(2.4, 1, k / n);
      px.line(a.x + nx * w, a.y + ny * w, a.x + nx * (w + 2.5) + tv.x * 1.5, a.y + ny * (w + 2.5) + tv.y * 1.5, PAL.earth4, 1);
      px.dot(a.x + nx * (w + 2.5) + tv.x * 1.5, a.y + ny * (w + 2.5) + tv.y * 1.5, PAL.white, 1);
    }
    // a leaf now and then
    for (let k = 6; k < n - 2; k += 9) {
      const a = pts[k];
      const sway = Math.sin(el * 0.01 + k) > 0 ? 1 : 0;
      px.ellipse(a.x + 2, a.y - 3 - sway, 2, 1.2, PAL.leaf3, 1).dot(a.x + 1, a.y - 3 - sway, PAL.leaf4, 1);
    }
  };
  return new Promise((resolve) => {
    onFrame(scene, (dt, el) => {
      px.clear();
      const total = GROW + LASH + HOLD + BACK;
      if (el >= total) return false;
      let reveal = 1;
      let lashK = 0;
      if (el < GROW) reveal = E.outQ(el / GROW);
      else if (el < GROW + LASH) lashK = E.inC((el - GROW) / LASH);
      else if (el < GROW + LASH + HOLD) lashK = 1;
      else {
        lashK = 1;
        reveal = 1 - E.inQ((el - GROW - LASH - HOLD) / BACK);
      }
      if (!hit && el >= GROW + LASH) {
        hit = true;
        snd('slash', 0.8, 0.8);
        opts.onImpact?.();
        void slash(scene, to.x, to.y, { ramp: RAMPS.leaf, angle: Math.atan2(d.y, d.x) + 1.1, size: 13, ms: 170, sound: false });
        for (let i = 0; i < 14; i++) {
          const a = RR(0, Math.PI * 2);
          const v = RR(60, 150);
          sp.add({ x: to.x, y: to.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, ay: 380, rot: RR(0, 6), vrot: RR(-14, 14), life: RR(300, 520), colors: i % 3 === 0 ? [PAL.earth4, PAL.earth3] : [PAL.leaf3, PAL.leaf2, PAL.leaf1], shape: 'shard', size: RR(1.5, 2.6) });
        }
      }
      // hole in the ground
      px.ellipse(from.x, from.y + 1, 7, 2.6, PAL.ink, 0.8 * Math.min(1, reveal * 2));
      for (let i = 0; i < count; i++) drawVine(sample(i, el, Math.max(0.02, reveal), lashK), el);
      void dt;
      return true;
    }, () => {
      px.g.destroy();
      sp.release();
      if (!hit) opts.onImpact?.();
      resolve();
    });
  });
}

// ==================================================================================== lightning

/** Midpoint-displacement zigzag between a and b. */
function zigzag(a: XY, b: XY, rough: number, minLen = 5): XY[] {
  const out: XY[] = [a];
  const rec = (p: XY, q: XY, r: number, depth: number) => {
    const l = vlen(vsub(q, p));
    if (l < minLen || depth > 7) {
      out.push(q);
      return;
    }
    const m = vlerp(p, q, RR(0.4, 0.6));
    const n = { x: -(q.y - p.y) / l, y: (q.x - p.x) / l };
    const off = RR(-1, 1) * l * r;
    const mm = { x: m.x + n.x * off, y: m.y + n.y * off };
    rec(p, mm, r * 0.92, depth + 1);
    rec(mm, q, r * 0.92, depth + 1);
  };
  rec(a, b, rough, 0);
  return out;
}

/** Pixels within radius r of a polyline, as row runs (each pixel exactly once — safe with alpha). */
function thickPoly(px: Px, pts: XY[], r: number, c: number, a: number): void {
  const set = new Set<number>();
  const W = 4096;
  const ri = Math.ceil(r);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const q = pts[i];
    const l = Math.max(1, Math.ceil(vlen(vsub(q, p))));
    for (let s = 0; s <= l; s++) {
      const x = p.x + ((q.x - p.x) * s) / l;
      const y = p.y + ((q.y - p.y) * s) / l;
      if (r <= 0.6) {
        set.add((Math.floor(y) + 1024) * W + Math.floor(x) + 1024);
        continue;
      }
      for (let yy = Math.floor(y - ri); yy <= Math.ceil(y + ri); yy++)
        for (let xx = Math.floor(x - ri); xx <= Math.ceil(x + ri); xx++) {
          const dx = xx + 0.5 - x;
          const dy = yy + 0.5 - y;
          if (dx * dx + dy * dy <= r * r) set.add((yy + 1024) * W + xx + 1024);
        }
    }
  }
  const keys = Array.from(set).sort((m, n) => m - n);
  let i = 0;
  while (i < keys.length) {
    const k = keys[i];
    const y = Math.floor(k / W) - 1024;
    const x0 = (k % W) - 1024;
    let x1 = x0;
    let j = i + 1;
    while (j < keys.length && keys[j] === keys[j - 1] + 1 && Math.floor(keys[j] / W) - 1024 === y) {
      x1++;
      j++;
    }
    px.run(y, x0, x1, c, a);
    i = j;
  }
}

interface Bolt {
  main: XY[];
  branches: XY[][];
}

function makeBolt(from: XY, to: XY, branches: number, rough = 0.28): Bolt {
  const main = zigzag(from, to, rough, 4);
  const bs: XY[][] = [];
  const L = vlen(vsub(to, from));
  const d = vnorm(vsub(to, from));
  for (let i = 0; i < branches; i++) {
    const k = RI(Math.floor(main.length * 0.2), Math.floor(main.length * 0.8));
    const p = main[Math.min(main.length - 1, k)];
    const ang = Math.atan2(d.y, d.x) + (R() < 0.5 ? -1 : 1) * RR(0.35, 0.9);
    const bl = L * RR(0.18, 0.38);
    bs.push(zigzag(p, { x: p.x + Math.cos(ang) * bl, y: p.y + Math.sin(ang) * bl }, 0.35, 3));
  }
  return { main, branches: bs };
}

function drawBolt(px: Px, b: Bolt, ramp: Ramp, width: number, a: number, white: boolean): void {
  for (const br of b.branches) {
    thickPoly(px, br, width * 0.5 + 0.6, ramp[2], 0.6 * a);
    thickPoly(px, br, 0.5, white ? PAL.white : ramp[4], a);
  }
  thickPoly(px, b.main, width + 2, ramp[1], 0.4 * a);
  thickPoly(px, b.main, width * 0.5 + 0.9, white ? PAL.white : ramp[3], a);
  thickPoly(px, b.main, Math.max(0.5, width * 0.5 - 0.3), PAL.white, a);
}

export interface LightningOpts {
  /** Accent color (its ramp is used). Default gold (Işık). */
  color?: number;
  ramp?: Ramp;
  /** Side branches (default 3). */
  branches?: number;
  /** Total duration (default 380). */
  ms?: number;
  /** Bolt thickness (default 2). */
  width?: number;
  /** Full-screen flash alpha (default 0.3; 0 = none). */
  flash?: number;
  onImpact?: () => void;
  depth?: number;
}

/**
 * Zigzag lightning bolt from → to with branches. The shape re-rolls every 2 frames for the first
 * ~130 ms (crackle), holds, then flickers out. First frame is pure white; a screen flash and a
 * spark burst land at `to`.
 */
export function lightning(scene: Phaser.Scene, from: XY, to: XY, opts: LightningOpts = {}): Promise<void> {
  const ramp = opts.ramp ?? (opts.color !== undefined ? rampOf(opts.color) : RAMP_LIGHT);
  const ms = opts.ms ?? 380;
  const width = opts.width ?? 3;
  const branches = opts.branches ?? 3;
  const depth = opts.depth ?? DEPTH.FX + 2;
  const px = layer(scene, depth);
  const sp = new Sparks(scene, depth + 0.1);
  let bolt = makeBolt(from, to, branches);
  let frame = 0;
  snd('lightning');
  opts.onImpact?.();
  const fa = opts.flash ?? 0.3;
  if (fa > 0) {
    const fl = scene.add.rectangle(0, 0, GAME_W, GAME_H, ramp[4], fa).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.OVERLAY - 1);
    void animate(scene, 130, (t) => fl.setAlpha(fa * (1 - t) * (1 - t))).then(() => fl.destroy());
  }
  for (let i = 0; i < 14; i++) {
    const a = RR(0, Math.PI * 2);
    const v = RR(70, 170);
    sp.add({ x: to.x, y: to.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, ay: 300, drag: 3, life: RR(180, 360), colors: [PAL.white, ramp[4], ramp[3], ramp[2]], shape: 'streak', len: 0.025 });
  }
  sp.release();
  return new Promise((resolve) => {
    onFrame(scene, (dt, el) => {
      px.clear();
      const t = el / ms;
      if (t >= 1) return false;
      if (dt > 0) frame++;
      if (el < 130 && dt > 0 && frame % 2 === 0) bolt = makeBolt(from, to, branches);
      let a = 1;
      if (t > 0.55) {
        if (Math.floor(frame / 2) % 2 === 1) return true; // flicker off
        a = 1 - (t - 0.55) / 0.45;
      }
      drawBolt(px, bolt, ramp, el < 34 ? width + 1 : width, a, el < 34);
      // hot spots at both ends
      const k = 1 - t;
      px.disc(from.x, from.y, 2 + 2 * k, ramp[3], a).disc(from.x, from.y, 1 + k, PAL.white, a);
      px.star(to.x + 0.5, to.y + 0.5, 4 + 8 * k, 1.5, ramp[4], a, (frame % 4 < 2 ? 0 : Math.PI / 4)).disc(to.x, to.y, 2 + 2 * k, PAL.white, a);
      return true;
    }, () => {
      px.g.destroy();
      resolve();
    });
  });
}

/**
 * Bolt from the sky onto (x, y): a stepped leader crawls down, then the main strike (thick bolt,
 * white screen flash, shake, ground burst, light pillar) and two re-strikes as it fades.
 */
export function skyBolt(scene: Phaser.Scene, x: number, y: number, opts: { color?: number; ramp?: Ramp; ms?: number; width?: number; onImpact?: () => void; depth?: number } = {}): Promise<void> {
  const ramp = opts.ramp ?? (opts.color !== undefined ? rampOf(opts.color) : RAMP_LIGHT);
  const ms = opts.ms ?? 560;
  const width = opts.width ?? 3;
  const depth = opts.depth ?? DEPTH.FX + 2;
  const LEADER = 110;
  const px = layer(scene, depth);
  const ground = layer(scene, DEPTH.TILE_FX + 4);
  const sp = new Sparks(scene, depth + 0.1);
  const top = { x: x + RR(-26, 26), y: -14 };
  let bolt = makeBolt(top, { x, y }, 4, 0.22);
  let frame = 0;
  let struck = false;
  snd('thunder', 0.6);
  return new Promise((resolve) => {
    onFrame(scene, (dt, el) => {
      px.clear();
      ground.clear();
      if (dt > 0) frame++;
      if (el >= ms) return false;
      if (el < LEADER) {
        // stepped leader: partial, thin, flickering
        const f = E.inQ(el / LEADER);
        const n = Math.max(2, Math.floor(bolt.main.length * f));
        if (frame % 3 !== 0) thickPoly(px, bolt.main.slice(0, n), 0.5, PAL.mist, 0.8);
        return true;
      }
      if (!struck) {
        struck = true;
        snd('thunder', 1);
        opts.onImpact?.();
        void shake(scene, 260, 4);
        const fl = scene.add.rectangle(0, 0, GAME_W, GAME_H, PAL.white, 0.7).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.OVERLAY - 1);
        void animate(scene, 180, (t) => fl.setAlpha(0.7 * (1 - t) * (1 - t))).then(() => fl.destroy());
        for (let i = 0; i < 26; i++) {
          const a = -Math.PI / 2 + RR(-1.5, 1.5);
          const v = RR(80, 220);
          sp.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7, ay: 380, drag: 2, life: RR(240, 520), colors: [PAL.white, ramp[4], ramp[3], ramp[2]], shape: i % 3 ? 'streak' : 'sq', size: 2, len: 0.025, floor: y + 6, bounce: 0.3 });
        }
        sp.release();
      }
      const sel = el - LEADER;
      const t = sel / (ms - LEADER);
      if (sel < 100 && frame % 2 === 0) bolt = makeBolt(top, { x, y }, 4, 0.22);
      // re-strikes at ~45% and ~65%, otherwise fading flicker
      const restrike = (t > 0.42 && t < 0.48) || (t > 0.62 && t < 0.66);
      let a = t < 0.3 ? 1 : restrike ? 1 : Math.floor(frame / 2) % 2 ? 0 : 1 - t;
      if (a > 0) drawBolt(px, bolt, ramp, sel < 34 || restrike ? width + 1 : width, a, sel < 34);
      // light pillar
      const pw = Math.max(0, 8 * (1 - E.outQ(Math.min(1, t * 2.2))));
      if (pw > 0.5) px.rect(x - pw / 2, 0, pw, y, ramp[4], 0.35 * (1 - t));
      // ground burst rings + scorch
      const u = E.outC(Math.min(1, t * 1.6));
      ground.ellipse(x, y + 2, 10 + 6 * u, 4 + 2.5 * u, PAL.ink, 0.45 * (1 - t));
      ground.ellipseRing(x, y + 2, 6 + 30 * u, 3 + 12 * u, 1, t < 0.25 ? PAL.white : ramp[3], 1 - t);
      ground.ellipseRing(x, y + 2, 4 + 18 * u, 2 + 7 * u, 1, ramp[4], (1 - t) * 0.8);
      if (t < 0.3) px.star(x + 0.5, y + 0.5, 16 * (1 - t / 0.3) + 4, 2, PAL.white, 1, 0);
      a = Math.max(a, 0);
      return true;
    }, () => {
      px.g.destroy();
      ground.g.destroy();
      if (!struck) opts.onImpact?.();
      resolve();
    });
  });
}

// ==================================================================================== impact

export interface ImpactOpts {
  power?: 1 | 2 | 3;
  /** Spark colors (dark → light). Default white-gold. */
  ramp?: Ramp;
  /** Target sprite: white silhouette flash + jitter during the hit-stop. */
  sprite?: AnySprite | null;
  /** Direction the blow travels (for directional sparks). Default: none (radial). */
  dir?: XY;
  /** Skip the hit-stop (when several impacts land in the same beat). */
  noStop?: boolean;
  depth?: number;
}

/**
 * THE impact frame: hit-stop, white silhouette flash, impact star, spark burst, ring and a camera
 * shake scaled by power. Resolves right after the freeze + the first burst (~0.18–0.3 s).
 */
export async function impact(scene: Phaser.Scene, x: number, y: number, opts: ImpactOpts = {}): Promise<void> {
  const power = opts.power ?? 2;
  const ramp = opts.ramp ?? RAMP_LIGHT;
  const depth = opts.depth ?? DEPTH.FX;
  const stopMs = [0, 60, 80, 100][power];
  const shakePx = [0, 1.5, 3, 5][power];
  const shakeMs = [0, 140, 220, 320][power];
  x = Math.round(x);
  y = Math.round(y);
  snd(power >= 2 ? 'impactHeavy' : 'impactLight', 0.7 + power * 0.1);

  const sp = new Sparks(scene, depth + 0.2);
  const sp2 = new Sparks(scene, depth + 0.3, Phaser.BlendModes.ADD);
  const px = layer(scene, depth + 0.1);
  const dir = opts.dir ? vnorm(opts.dir) : null;
  const base = dir ? Math.atan2(dir.y, dir.x) : 0;

  // sparks: streaks + chunky bits, spawned before the freeze so the frozen frame shows a starburst
  const n = 6 + power * 6;
  for (let i = 0; i < n; i++) {
    const a = dir ? base + RR(-1.1, 1.1) : (i / n) * Math.PI * 2 + RR(-0.2, 0.2);
    const v = RR(90, 150 + power * 45);
    const off = RR(2, 5);
    sp.add({
      x: x + Math.cos(a) * off,
      y: y + Math.sin(a) * off,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 20,
      ay: 160,
      drag: 4,
      life: RR(180, 300 + power * 60),
      colors: [PAL.white, ramp[4], ramp[3], ramp[2]],
      shape: 'streak',
      len: 0.03,
      size: power >= 3 && i % 3 === 0 ? 2 : 1,
    });
  }
  for (let i = 0; i < 3 + power * 3; i++) {
    const a = dir ? base + RR(-1.4, 1.4) : RR(0, Math.PI * 2);
    const v = RR(40, 110);
    sp.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, ay: 260, drag: 1.5, life: RR(300, 560), colors: [ramp[4], ramp[3], ramp[2], ramp[1]], shape: 'sq', size: RI(1, 2) });
  }
  // glow motes (additive)
  for (let i = 0; i < 2 + power * 2; i++) {
    const a = RR(0, Math.PI * 2);
    sp2.add({ x, y, vx: Math.cos(a) * RR(15, 45), vy: Math.sin(a) * RR(15, 45) - 10, drag: 3, life: RR(250, 450), colors: [ramp[3], ramp[2], ramp[1]], shape: 'disc', size: RR(1, 2.2), grow: -3, alpha: 0.6 });
  }
  sp.release();
  sp2.release();

  // impact star + ring + (power 3) flash, drawn per frame
  const R0 = 6 + power * 5;
  const LIFE = 260 + power * 60;
  const tilt = dir ? base : Math.PI / 4;
  onFrame(scene, (_dt, el) => {
    const t = clamp(el / LIFE, 0, 1);
    px.clear();
    if (t >= 1) return false;
    // core burst: big star on the impact frame, shrinking fast after the freeze
    const k = el < 30 ? 1 : 1 - E.outQ(clamp((el - 30) / 120, 0, 1));
    if (k > 0.02) {
      const rl = R0 * (0.6 + 0.5 * k);
      px.star(x + 0.5, y + 0.5, rl + 2, Math.max(1.5, rl * 0.22 + 1), ramp[2], 0.9 * k, tilt);
      px.star(x + 0.5, y + 0.5, rl, Math.max(1, rl * 0.2), ramp[4], k, tilt);
      px.star(x + 0.5, y + 0.5, rl * 0.7, Math.max(1, rl * 0.14), PAL.white, k, tilt + Math.PI / 4);
      px.disc(x + 0.5, y + 0.5, 2 + power * k * 1.5, PAL.white, k);
    }
    // shock ring(s)
    const u = E.outC(t);
    const rr = 3 + u * (10 + power * 7);
    px.ring(x + 0.5, y + 0.5, rr, t < 0.4 ? 2 : 1, t < 0.25 ? PAL.white : ramp[3], 1 - t);
    if (power >= 2) {
      const t2 = clamp((el - 60) / LIFE, 0, 1);
      if (t2 > 0 && t2 < 1) px.ellipseRing(x + 0.5, y + 4.5, 4 + E.outC(t2) * (16 + power * 8), 2 + E.outC(t2) * (6 + power * 3), 1, ramp[2], 0.8 * (1 - t2));
    }
    return true;
  }, () => px.g.destroy());

  if (power >= 3) {
    // anime impact frame: the stage drops to black behind the white silhouette for 3 frames,
    // then one white flash that falls off as time resumes
    const dark = scene.add.rectangle(0, 0, GAME_W, GAME_H, PAL.ink, 0.62).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.SHADOW + 1);
    const fl = scene.add.rectangle(0, 0, GAME_W, GAME_H, PAL.white, 0).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.OVERLAY - 1);
    void realFrames(scene, 3)
      .then(() => {
        dark.destroy();
        fl.setAlpha(0.4);
        return realFrames(scene, 1);
      })
      .then(() => animate(scene, 100, (t) => fl.setAlpha(0.25 * (1 - t))))
      .then(() => fl.destroy());
  }

  // target: white silhouette + jitter while frozen
  const spr = opts.sprite;
  let jitterStop: (() => void) | null = null;
  if (spr && spr.active) {
    void whiteFlash(scene, spr, power >= 3 ? 3 : 2);
    const ox = spr.x;
    let f = 0;
    const jit = () => {
      f++;
      if (!spr.active) return;
      spr.x = ox + (f % 2 === 0 ? 1 : -1) * (power >= 2 ? 1 : 0.5);
    };
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, jit);
    jitterStop = () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, jit);
      if (spr.active) spr.x = ox;
    };
  }
  void shake(scene, shakeMs, shakePx);
  if (!opts.noStop) await stopTime(scene, stopMs);
  jitterStop?.();
  await sleep(scene, 90 + power * 25);
}

/** Attack bouncing off a defender: hex shield flash, clang star, deflected metal sparks. */
export async function blockClang(scene: Phaser.Scene, x: number, y: number, opts: { from?: XY; color?: number; depth?: number } = {}): Promise<void> {
  const depth = opts.depth ?? DEPTH.FX;
  const ramp = opts.color !== undefined ? rampOf(opts.color) : RAMPS.cyan;
  x = Math.round(x);
  y = Math.round(y);
  const back = opts.from ? vnorm(vsub(opts.from, { x, y })) : { x: -1, y: 0 };
  const ang = Math.atan2(back.y, back.x);
  snd('shieldBlock');
  const px = layer(scene, depth + 0.1);
  const sp = new Sparks(scene, depth + 0.2);
  for (let i = 0; i < 12; i++) {
    const a = ang + RR(-0.9, 0.9);
    const v = RR(90, 190);
    sp.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, ay: 380, drag: 2, life: RR(220, 420), colors: [PAL.white, PAL.gold4, PAL.gold3, PAL.fire3], shape: 'streak', len: 0.025 });
  }
  for (let i = 0; i < 5; i++) {
    const a = ang + RR(-1.2, 1.2);
    sp.add({ x, y, vx: Math.cos(a) * RR(40, 90), vy: Math.sin(a) * RR(40, 90) - 50, ay: 420, life: RR(300, 500), colors: RAMP_METAL.slice().reverse(), shape: 'sq', size: 1, floor: y + 18, bounce: 0.4 });
  }
  sp.release();
  // hexagon facing the attacker (flattened along the attack axis)
  const hexR = 13;
  const hex = (r: number, sq: number) => {
    const pts: number[] = [];
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3 + Math.PI / 6;
      // local hex then squash along `back` so it reads as a plane facing the attacker
      let hx = Math.cos(a) * r;
      const hy = Math.sin(a) * r;
      hx *= sq;
      pts.push(x + hx * Math.cos(0) + back.x * 2, y + hy);
    }
    return pts;
  };
  onFrame(scene, (_dt, el) => {
    const t = clamp(el / 320, 0, 1);
    px.clear();
    if (t >= 1) return false;
    const grow = E.outBack(clamp(el / 90, 0, 1));
    const r = hexR * (0.5 + 0.5 * grow);
    const a = 1 - E.inQ(t);
    if (el < 50) px.poly(hex(r, 0.55), PAL.white, 0.55);
    else px.poly(hex(r, 0.55), ramp[2], 0.25 * a);
    // outline (two passes for a 2px rim)
    const h1 = hex(r, 0.55);
    for (let k = 0; k < 6; k++) {
      const j = (k + 1) % 6;
      px.line(h1[k * 2], h1[k * 2 + 1], h1[j * 2], h1[j * 2 + 1], el < 60 ? PAL.white : ramp[4], a);
    }
    const h2 = hex(r - 2, 0.55);
    for (let k = 0; k < 6; k++) {
      const j = (k + 1) % 6;
      px.line(h2[k * 2], h2[k * 2 + 1], h2[j * 2], h2[j * 2 + 1], ramp[3], a * 0.8);
    }
    // inner hex lattice shimmer
    if (Math.floor(el / 50) % 2 === 0) px.line(x - r * 0.5, y, x + r * 0.5, y, ramp[4], a * 0.6);
    // clang star
    const k = 1 - clamp(el / 140, 0, 1);
    if (k > 0) {
      px.star(x + back.x * 3 + 0.5, y + back.y * 3 + 0.5, 4 + 7 * k, 1.5, PAL.gold4, k, Math.PI / 4);
      px.star(x + back.x * 3 + 0.5, y + back.y * 3 + 0.5, 3 + 5 * k, 1, PAL.white, k);
    }
    return true;
  }, () => px.g.destroy());
  void shake(scene, 120, 1.5);
  await stopTime(scene, 50);
  await sleep(scene, 160);
}

// ==================================================================================== direct hit

let vignetteKey = '';
function ensureVignette(scene: Phaser.Scene): string {
  const key = 'fx:vignette-red';
  if (scene.textures.exists(key)) return (vignetteKey = key);
  const W = GAME_W / 2;
  const H = GAME_H / 2;
  const p = new PixelCanvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - W / 2) / (W / 2);
      const dy = (y + 0.5 - H / 2) / (H / 2);
      const d = Math.sqrt(dx * dx * 0.8 + dy * dy * 1.1);
      const lvl = clamp((d - 0.62) / 0.5, 0, 1);
      if (lvl <= 0) continue;
      if (PixelCanvas.ditherAt(x, y, Math.round(lvl * 16))) p.set(x, y, lvl > 0.75 ? PAL.crim1 : lvl > 0.45 ? PAL.crim2 : PAL.crim3);
    }
  scene.textures.addCanvas(key, p.toCanvas());
  return (vignetteKey = key);
}

/**
 * An attack lands on a DUELIST (`player` is the one being hit): impact at their avatar, hit-stop,
 * radial speed lines, red flash + pulsing red vignette and a heavy shake.
 */
export async function directHit(scene: Phaser.Scene, player: PlayerId, opts: { at?: XY } = {}): Promise<void> {
  const p = opts.at ?? duelistXY(player);
  const key = ensureVignette(scene);
  snd('directHit');
  const vig = scene.add.image(0, 0, key).setOrigin(0).setScale(2).setScrollFactor(0).setDepth(DEPTH.OVERLAY - 2).setAlpha(0);
  const red = scene.add.rectangle(0, 0, GAME_W, GAME_H, PAL.crim2, 0).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.OVERLAY - 3);
  const white = scene.add.rectangle(0, 0, GAME_W, GAME_H, PAL.white, 0.7).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.OVERLAY - 1);
  const lines = layer(scene, DEPTH.OVERLAY - 4);
  lines.g.setScrollFactor(0);
  // speed lines converging on the hit point
  const rays: { a: number; r0: number; w: number }[] = [];
  for (let i = 0; i < 28; i++) rays.push({ a: RR(0, Math.PI * 2), r0: RR(70, 150), w: R() < 0.3 ? 2 : 1 });
  onFrame(scene, (_dt, el) => {
    const t = clamp(el / 260, 0, 1);
    lines.clear();
    if (t >= 1) return false;
    for (const r of rays) {
      const r0 = r.r0 * (1 - 0.35 * E.outQ(t));
      const r1 = 420;
      const c = Math.cos(r.a);
      const s = Math.sin(r.a);
      lines.seg(p.x + c * r0, p.y + s * r0, p.x + c * r1, p.y + s * r1, r.w, t < 0.3 ? PAL.white : PAL.crim4, 0.8 * (1 - t));
    }
    return true;
  }, () => lines.g.destroy());
  void realFrames(scene, 2).then(() => {
    white.destroy();
    red.setAlpha(0.42);
  });
  void impact(scene, p.x, p.y, { power: 3, ramp: RAMPS.crim, noStop: true, depth: DEPTH.OVERLAY - 5 });
  void shake(scene, 420, 6);
  await stopTime(scene, 110);
  // vignette double pulse
  await animate(scene, 520, (t) => {
    red.setAlpha(0.42 * (1 - E.outQ(clamp(t * 2.2, 0, 1))));
    const pulse = t < 0.45 ? Math.sin((t / 0.45) * Math.PI) : 0.55 * Math.sin(((t - 0.45) / 0.55) * Math.PI);
    vig.setAlpha(Math.max(0, pulse));
  });
  vig.destroy();
  red.destroy();
}

void vignetteKey;

/** Boot-time textures for the combat VFX (boulder frames, red vignette). Idempotent; also built lazily. */
export function buildCombatTextures(scene: Phaser.Scene): void {
  ensureRock(scene);
  ensureVignette(scene);
}
