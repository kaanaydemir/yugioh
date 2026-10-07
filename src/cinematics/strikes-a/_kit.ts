// strikes-a shared kit — local helpers for the signature attacks / impacts / effects / deaths of
// crystal_wyrm, abyss_magus, magma_titan, coral_serpent, ember_wolf and tide_golem.
// (Registers nothing; the per-monster files next to it do.)
//
// Everything runs on the scaled scene clock (vfx/combat onFrame / animate), so it follows the
// global speed, slow motion and hit-stop. Coordinates are world px unless a name says "screen".

import Phaser from 'phaser';
import type { MonsterId } from '../../data/cards';
import type { GameEvent, PlayerId } from '../../engine/types';
import { ATTRIBUTE_RAMP, PAL, type Ramp } from '../../art/palette';
import { PixelCanvas, mulberry32 } from '../../art/pixel';
import { AK } from '../../art/arena';
import { monsterAnimKey, monsterFrame, monsterFrameName } from '../../art/textures';
import type { MonsterAnim } from '../../art/types';
import { MONSTER_ANIMS } from '../../art/types';
import { DEPTH, GAME_H, GAME_W, type XY, unitDepth, zoneXY } from '../../view/layout';
import type { TileCard } from '../../view/TileCard';
import { shake } from '../../vfx/core';
import { E, Px, Sparks, animate, framePointToWorld, onFrame, sleep, stopTime, whiteFlash } from '../../vfx/combat';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { sfx, type SfxName, type SfxOpts } from '../../audio/sfx';
import { listHandlers } from '../_core/registry';
import type { CinematicContext } from '../_core/types';
import { cardToGraveyard } from '../_core/helpers';

export type AnyCtx = CinematicContext<GameEvent>;
export type Ctx<T extends GameEvent['type']> = CinematicContext<Extract<GameEvent, { type: T }>>;
export type EvOf<T extends GameEvent['type']> = Extract<GameEvent, { type: T }>;

export const TAU = Math.PI * 2;
export const ADD = Phaser.BlendModes.ADD;
export { E, Px, Sparks, animate, onFrame, sleep, stopTime, whiteFlash };

// ================================================================ random

let rand = mulberry32(0x5a17a);
/** Re-seed (each strike seeds from its uids, so films are repeatable). */
export function seed(n: number): void {
  rand = mulberry32((n * 2654435761) >>> 0);
}
export const R = (): number => rand();
export const RR = (a: number, b: number): number => a + (b - a) * rand();
export const RI = (a: number, b: number): number => Math.floor(a + (b - a + 1) * rand());
export function pick<T>(a: readonly T[]): T {
  return a[Math.floor(rand() * a.length) % a.length];
}

/** Never let audio break a cinematic. */
export function playSfx(name: SfxName, opts?: SfxOpts): void {
  try {
    sfx.play(name, opts);
  } catch {
    /* audio is optional */
  }
}

// ================================================================ math

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const seg = (t: number, a: number, b: number): number => clamp((t - a) / (b - a), 0, 1);
export function sub(a: XY, b: XY): XY {
  return { x: a.x - b.x, y: a.y - b.y };
}
export function len(a: XY): number {
  return Math.hypot(a.x, a.y);
}
export function norm(a: XY): XY {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
}
export function lerpXY(a: XY, b: XY, t: number): XY {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
export function qbez(a: XY, c: XY, b: XY, t: number): XY {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

// ================================================================ drawing layers

/** A Graphics + Px rasterizer at a depth (destroy with px.g.destroy()). */
export function layer(scene: Phaser.Scene, depth: number, blend?: number): Px {
  const g = scene.add.graphics().setDepth(depth);
  if (blend !== undefined) g.setBlendMode(blend);
  return new Px(g);
}

/** Soft additive glow (arena 48px glow texture) — returns the image; caller animates / destroys. */
export function glow(scene: Phaser.Scene, x: number, y: number, color: number, scale: number, alpha: number, depth: number = DEPTH.FX - 1): Phaser.GameObjects.Image {
  return scene.add.image(Math.round(x), Math.round(y), AK.glow).setBlendMode(ADD).setTint(color).setScale(scale).setAlpha(alpha).setDepth(depth);
}

/** A glow that swells in and fades out (fire-and-forget). */
export function glowPulse(scene: Phaser.Scene, x: number, y: number, color: number, o: { from?: number; to?: number; alpha?: number; ms?: number; depth?: number } = {}): Promise<void> {
  const g = glow(scene, x, y, color, o.from ?? 0.3, o.alpha ?? 0.8, o.depth);
  const ms = o.ms ?? 260;
  const a0 = o.alpha ?? 0.8;
  return animate(scene, ms, (t) => {
    g.setScale(lerp(o.from ?? 0.3, o.to ?? 1.6, E.outQ(t))).setAlpha(a0 * (1 - t) * (1 - t));
  }).then(() => g.destroy());
}

/** Full-screen tinted flash on the overlay band (ADD), stepped fall-off. */
export function screenFlash(scene: Phaser.Scene, color: number, alpha: number, ms: number): Promise<void> {
  const r = scene.add.rectangle(0, 0, GAME_W, GAME_H, color, alpha).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.OVERLAY - 1).setBlendMode(ADD);
  return animate(scene, ms, (t) => r.setAlpha(alpha * Math.pow(1 - t, 2))).then(() => r.destroy());
}

/** Dark veil over the world (below the units' FX, above the board) — focus on one moment. */
export function veil(scene: Phaser.Scene, alpha: number, inMs = 160): { remove(ms?: number): Promise<void> } {
  const r = scene.add.rectangle(-80, -80, GAME_W + 160, GAME_H + 160, PAL.ink, 1).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.SHADOW + 2).setAlpha(0);
  void animate(scene, inMs, (t) => r.active && r.setAlpha(alpha * t));
  return {
    remove: async (ms = 220) => {
      if (!r.active) return;
      const a = r.alpha;
      await animate(scene, ms, (t) => r.active && r.setAlpha(a * (1 - t)));
      r.destroy();
    },
  };
}

/** World point → screen point through the main (world) camera (for HUD-band effects). */
export function worldToScreen(scene: Phaser.Scene, p: XY): XY {
  const cam = scene.cameras.main;
  const ox = cam.width * cam.originX;
  const oy = cam.height * cam.originY;
  return { x: (p.x - cam.scrollX - ox) * cam.zoom + ox + cam.x, y: (p.y - cam.scrollY - oy) * cam.zoom + oy + cam.y };
}

// ================================================================ sprite frames

/** Stop the sprite's animation and show one frame of `anim`. */
export function holdFrame(u: MonsterUnit, anim: MonsterAnim, frame: number): void {
  const s = u.sprite;
  if (!s.active) return;
  const n = u.art.anims[anim].frames;
  s.anims.stop();
  s.setFrame(monsterFrameName(anim, Math.max(0, Math.min(n - 1, frame))));
}

/** Play `anim` starting at `frame`; resolves on completion, then idles (unless hold). */
export function playFrom(u: MonsterUnit, anim: MonsterAnim, frame: number, o: { hold?: boolean } = {}): Promise<void> {
  const s = u.sprite;
  const key = monsterAnimKey(u.cardId, anim);
  if (!s.active || !u.scene.anims.exists(key)) return Promise.resolve();
  const spec = u.art.anims[anim];
  s.play({ key, repeat: 0, startFrame: Math.max(0, Math.min(spec.frames - 1, frame)) });
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      s.off(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + key, finish);
      if (!o.hold && !u.retired && s.active && u.frameInfo().anim === anim) u.rest();
      resolve();
    };
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + key, finish);
    const ms = ((spec.frames - frame) / spec.fps) * 1000;
    void sleep(u.scene, ms * 1.5 + 200).then(finish);
  });
}

/** ms per frame of an animation. */
export function frameMs(u: MonsterUnit, anim: MonsterAnim): number {
  return 1000 / u.art.anims[anim].fps;
}

/** Facing sign: +1 faces right (player 1), −1 faces left (player 2). */
export function facing(u: MonsterUnit): 1 | -1 {
  return u.flipX ? -1 : 1;
}

/** Offset of a frame point from the sprite origin (anchor) in world px, facing-aware (scale 1). */
export function frameOffset(u: MonsterUnit, fx: number, fy: number): XY {
  return { x: facing(u) * (fx - u.art.anchorX), y: fy - u.art.anchorY };
}

/** Pixels of the frame the sprite currently shows. */
export function currentPixels(u: MonsterUnit): { anim: MonsterAnim; frame: number; pc: PixelCanvas } {
  const name = String(u.sprite.frame?.name ?? '');
  const m = /^([a-z]+):(\d+)$/.exec(name);
  const anim = m && (MONSTER_ANIMS as string[]).includes(m[1]) ? (m[1] as MonsterAnim) : 'idle';
  const frame = m ? Number(m[2]) : 0;
  return { anim, frame, pc: monsterFrame(u.cardId, anim, frame) };
}

let ovSeq = 0;
/**
 * An image laid exactly over the unit's sprite (same origin / flip / transform), showing a
 * PixelCanvas of the same frame size — for crack overlays, cooling rock, frozen poses...
 * Returns the image and a redraw(pc) that re-uploads its pixels.
 */
export function overlay(u: MonsterUnit, pc: PixelCanvas, o: { depth?: number; blend?: number } = {}): { img: Phaser.GameObjects.Image; redraw(pc: PixelCanvas): void; destroy(): void } {
  const scene = u.scene;
  const key = `sa:ov:${++ovSeq}`;
  const tex = scene.textures.createCanvas(key, pc.w, pc.h)!;
  const put = (p: PixelCanvas) => {
    tex.context.putImageData(new ImageData(new Uint8ClampedArray(p.data), p.w, p.h), 0, 0);
    tex.refresh();
  };
  put(pc);
  const s = u.sprite;
  const img = scene.add.image(s.x, s.y, key).setOrigin(s.originX, s.originY).setFlipX(s.flipX).setScale(s.scaleX, s.scaleY).setDepth(o.depth ?? s.depth + 0.2);
  if (o.blend !== undefined) img.setBlendMode(o.blend);
  let dead = false;
  const follow = () => {
    if (dead || !img.active) return;
    if (s.active) img.setPosition(s.x, s.y).setScale(s.scaleX, s.scaleY);
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, follow);
  const destroy = () => {
    if (dead) return;
    dead = true;
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, follow);
    img.destroy();
    if (scene.textures.exists(key)) scene.textures.remove(key);
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, destroy);
  return { img, redraw: (p) => !dead && put(p), destroy };
}

const clusterCache = new Map<string, { x: number; y: number } | null>();

/**
 * Frame point (art px) of the densest cluster of `colors` in a frame (e.g. the magus's staff orb,
 * the wolf's flame mane), searched in rows [y0, y1). Cached per frame. null when absent.
 * Robust to art revisions, unlike hand-measured tables.
 */
export function clusterIn(id: MonsterId, anim: MonsterAnim, frame: number, colors: readonly number[], o: { y0?: number; y1?: number; x0?: number; x1?: number; r?: number; tag?: string } = {}): { x: number; y: number } | null {
  const key = `${id}|${anim}|${frame}|${o.tag ?? colors.join(',')}|${o.y0 ?? ''}|${o.y1 ?? ''}|${o.x0 ?? ''}|${o.x1 ?? ''}`;
  if (clusterCache.has(key)) return clusterCache.get(key)!;
  const pc = monsterFrame(id, anim, frame);
  const set = new Set(colors);
  const r = o.r ?? 3;
  const y0 = Math.max(0, o.y0 ?? 0);
  const y1 = Math.min(pc.h, o.y1 ?? pc.h);
  const x0 = Math.max(0, o.x0 ?? 0);
  const x1 = Math.min(pc.w, o.x1 ?? pc.w);
  // integral image of matching pixels
  const W = pc.w + 1;
  const sum = new Int32Array(W * (pc.h + 1));
  for (let y = 0; y < pc.h; y++) {
    let row = 0;
    for (let x = 0; x < pc.w; x++) {
      const c = pc.get(x, y);
      if (c !== null && set.has(c) && y >= y0 && y < y1 && x >= x0 && x < x1) row++;
      sum[(y + 1) * W + x + 1] = sum[y * W + x + 1] + row;
    }
  }
  const box = (ax: number, ay: number, bx: number, by: number) => sum[by * W + bx] - sum[ay * W + bx] - sum[by * W + ax] + sum[ay * W + ax];
  let best = { n: 0, x: 0, y: 0 };
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const n = box(Math.max(0, x - r), Math.max(0, y - r), Math.min(pc.w, x + r + 1), Math.min(pc.h, y + r + 1));
      if (n > best.n) best = { n, x, y };
    }
  const out = best.n >= 3 ? { x: best.x, y: best.y } : null;
  clusterCache.set(key, out);
  return out;
}

/** World point of a colour cluster on the frame the unit shows (fallback: a frame point). */
export function clusterPoint(u: MonsterUnit, colors: readonly number[], fallback: { x: number; y: number }, o: { y0?: number; y1?: number; x0?: number; x1?: number; r?: number; tag?: string } = {}): XY {
  const { anim, frame } = currentPixels(u);
  const c = clusterIn(u.cardId, anim, frame, colors, o) ?? fallback;
  return u.framePoint(c.x, c.y);
}

/** Opaque bounds of the frame the unit shows (art px). */
export function frameBounds(u: MonsterUnit): { x: number; y: number; w: number; h: number } {
  const { pc } = currentPixels(u);
  return pc.bounds() ?? { x: 0, y: 0, w: pc.w, h: pc.h };
}

/** Sprite frame point → world, using any frame index of the same size. */
export function fp(u: MonsterUnit, fx: number, fy: number): XY {
  return framePointToWorld(u.sprite, fx, fy);
}

// ================================================================ motion

/** Move a unit's sprite to a FEET point (origin = anchor; hover is kept), keeping depth sorted. */
export function placeFeet(u: MonsterUnit, feet: XY, lift = 0, depthBias = 0): void {
  const s = u.sprite;
  if (!s.active) return;
  s.setPosition(Math.round(feet.x), Math.round(feet.y - u.hover - lift));
  u.lift = Math.max(0, lift);
  s.setDepth(unitDepth(feet.y) + depthBias);
}

/** Put the sprite back home (position, scale, depth, lift). */
export function homeUnit(u: MonsterUnit): void {
  const s = u.sprite;
  if (!s.active) return;
  const r = u.rest0;
  s.setPosition(r.x, r.y).setScale(1).setAngle(0);
  u.lift = 0;
  s.setDepth(unitDepth(u.home.y));
}

/**
 * Melee contact: the FEET point that puts frame point (fx, fy) (fist / jaws at the impact frame)
 * on the side of `to` facing the attacker, `inset` px short of it.
 */
export function contactFeet(u: MonsterUnit, fx: number, fy: number, to: XY, inset = 6): XY {
  const off = frameOffset(u, fx, fy);
  const dir = norm(sub(to, u.home));
  return { x: to.x - dir.x * inset - off.x, y: to.y - dir.y * inset - off.y };
}

// ================================================================ floor marks

/** Glowing floor marks (lava footprints, fire trail, wet patches) that fade over `life` ms. */
export class FloorMarks {
  readonly px: Px;
  private marks: { x: number; y: number; rx: number; ry: number; age: number; life: number; ramp: readonly number[]; kind: 'blob' | 'flame' | 'crack'; seed: number; ang?: number; len?: number }[] = [];
  private stop: () => void;
  private closed = false;
  constructor(readonly scene: Phaser.Scene, depth: number = DEPTH.TILE_FX + 4) {
    this.px = layer(scene, depth);
    this.stop = onFrame(scene, (dt) => this.tick(dt), () => this.px.g.destroy());
  }
  blob(x: number, y: number, rx: number, life: number, ramp: readonly number[]): void {
    this.marks.push({ x, y, rx, ry: rx * 0.45, age: 0, life, ramp, kind: 'blob', seed: RI(0, 999) });
  }
  flame(x: number, y: number, size: number, life: number, ramp: readonly number[]): void {
    this.marks.push({ x, y, rx: size, ry: size, age: 0, life, ramp, kind: 'flame', seed: RI(0, 999) });
  }
  crack(x: number, y: number, ang: number, length: number, life: number, ramp: readonly number[]): void {
    this.marks.push({ x, y, rx: 0, ry: 0, age: 0, life, ramp, kind: 'crack', seed: RI(0, 9999), ang, len: length });
  }
  close(): void {
    this.closed = true;
  }
  private tick(dt: number): boolean {
    const px = this.px.clear();
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const m = this.marks[i];
      m.age += dt;
      const t = m.age / m.life;
      if (t >= 1) {
        this.marks.splice(i, 1);
        continue;
      }
      const ci = Math.min(m.ramp.length - 1, Math.floor(t * m.ramp.length));
      const c = m.ramp[ci];
      if (m.kind === 'blob') {
        const k = t < 0.15 ? 0.6 + (t / 0.15) * 0.4 : 1 - (t - 0.15) * 0.25;
        px.ellipse(m.x, m.y, m.rx * k, m.ry * k, c, t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1);
        if (t < 0.4) px.ellipse(m.x - 0.5, m.y - 0.5, m.rx * k * 0.45, m.ry * k * 0.45, m.ramp[0], 1);
      } else if (m.kind === 'flame') {
        // a flickering flame tongue standing on the floor, shrinking as it burns out
        const h = m.ry * (1 - t) * (0.8 + 0.4 * Math.sin(m.age * 0.05 + m.seed));
        const w = Math.max(1, m.rx * 0.55 * (1 - t * 0.6));
        if (h >= 1) {
          const sway = Math.sin(m.age * 0.03 + m.seed) * 1.2;
          px.poly([m.x - w, m.y, m.x + w, m.y, m.x + sway, m.y - h], m.ramp[Math.min(m.ramp.length - 1, ci + 1)] ?? c, 1);
          px.poly([m.x - w * 0.5, m.y, m.x + w * 0.5, m.y, m.x + sway * 0.6, m.y - h * 0.6], m.ramp[0], 1);
        }
        px.ellipse(m.x, m.y + 0.5, w + 1, 1.2, PAL.ink, 0.35 * (1 - t));
      } else {
        // a glowing ground crack: jagged polyline from (x, y)
        const r2 = mulberry32(m.seed);
        let x = m.x;
        let y = m.y;
        const steps = Math.max(2, Math.round((m.len ?? 10) / 3));
        const grow = clamp(t / 0.12, 0, 1);
        const n = Math.max(1, Math.round(steps * grow));
        const a = m.ang ?? 0;
        for (let k = 0; k < n; k++) {
          const aa = a + (r2() - 0.5) * 1.1;
          const nx = x + Math.cos(aa) * 3;
          const ny = y + Math.sin(aa) * 1.5;
          px.line(x, y, nx, ny, c, t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1);
          x = nx;
          y = ny;
        }
      }
    }
    return !(this.closed && this.marks.length === 0);
  }
}

// ================================================================ shatter (adapted from vfx/shatter.ts)

export interface ShatterPxOpts {
  /** Pixels to break (default: the frame the sprite shows). Same size as the frame. */
  pc?: PixelCanvas;
  ramp?: Ramp;
  glitchMs?: number;
  push?: XY;
  /** Burst velocity multiplier (1 = shatter.ts). */
  speed?: number;
  /** Upward kick range (px/s), default [15, 60]. */
  up?: [number, number];
  gravity?: number;
  /** Floor y for bouncing rubble (null = none). */
  floor?: number | null;
  bounce?: number;
  /** Brick lifetime range. */
  life?: [number, number];
  /** Glass shards count (default 22) and their colours (default white + ramp). */
  shards?: number;
  shardColors?: readonly number[];
  motes?: boolean;
  /** Flash the bricks white → ramp → true colours (default true). */
  flash?: boolean;
  stopMs?: number;
  shakePx?: number;
  depth?: number;
  sound?: boolean;
  /** Colour of the glitch / burst flash frames (default white). */
  flashColor?: number;
  /** After `after` ms the bricks are sucked toward (x, y) and vanish there (void implosion). */
  attract?: { x: number; y: number; after: number; k?: number };
}

let shSeq = 0;

/**
 * Break a monster sprite into its own pixels (2–4 px bricks). Same look as vfx/shatter but
 * takes the pixels to break (a cooled / cracked / burnt-out version of the frame) and physics
 * knobs (crumble vs burst). Hides the sprite; resolves when the debris is gone.
 */
export async function shatterPx(scene: Phaser.Scene, u: MonsterUnit, o: ShatterPxOpts = {}): Promise<void> {
  const sprite = u.sprite;
  if (!sprite || !sprite.active) return;
  const pc = o.pc ?? currentPixels(u).pc;
  const ramp = o.ramp ?? ATTRIBUTE_RAMP[u.attribute];
  const depth = o.depth ?? sprite.depth + 0.5;
  const rnd = mulberry32(++shSeq * 7919 + u.uid * 31);
  const rr = (a: number, b: number) => a + (b - a) * rnd();
  const key = `sa:sh:${u.cardId}:${shSeq}`;
  scene.textures.addCanvas(key, pc.toCanvas());
  const tex = scene.textures.get(key);
  const W = pc.w;
  const H = pc.h;
  const kx = sprite.frame.realWidth / W;
  const ky = sprite.frame.realHeight / H;
  const toWorld = (fx: number, fy: number) => framePointToWorld(sprite, fx * kx, fy * ky);
  const m = sprite.getWorldTransformMatrix().decomposeMatrix();
  const sx = m.scaleX * kx;
  const sy = m.scaleY * ky;
  const flip = sprite.flipX;
  const core = toWorld(u.art.core.x, u.art.core.y);
  const bounds = pc.bounds() ?? { x: 0, y: 0, w: W, h: H };
  // ---- glitch
  const glitchMs = o.glitchMs ?? 120;
  sprite.setVisible(false);
  if (glitchMs > 0) {
    const slices: { img: Phaser.GameObjects.Image; ghost: Phaser.GameObjects.Image }[] = [];
    for (let y = bounds.y; y < bounds.y + bounds.h; ) {
      const h = Math.min(bounds.y + bounds.h - y, 2 + Math.floor(rnd() * 3));
      const name = `gl:${y}:${h}`;
      if (!tex.has(name)) tex.add(name, 0, 0, y, W, h);
      const c = toWorld(W / 2, y + h / 2);
      const ghost = scene.add.image(c.x, c.y, key, name).setFlipX(flip).setScale(sx, sy).setDepth(depth - 0.01).setTintFill(PAL.mag3).setAlpha(0).setBlendMode(ADD);
      const img = scene.add.image(c.x, c.y, key, name).setFlipX(flip).setScale(sx, sy).setDepth(depth);
      slices.push({ img, ghost });
      y += h;
    }
    await new Promise<void>((resolve) => {
      let f = 0;
      const base = toWorld(W / 2, 0).x;
      onFrame(
        scene,
        (dt, el) => {
          if (dt > 0) f++;
          if (f % 2 === 0) {
            for (const s of slices) {
              const amp = 1 + (el / glitchMs) * 4;
              s.img.x = Math.round(base + (rnd() < 0.38 ? Math.round(rr(-amp, amp)) : 0));
              s.img.setVisible(rnd() > 0.08 + (el / glitchMs) * 0.12);
              const split = rnd() < 0.3;
              s.ghost.setAlpha(split ? 0.7 : 0);
              s.ghost.x = s.img.x + (rnd() < 0.5 ? -2 : 2);
              s.ghost.setTintFill(rnd() < 0.5 ? PAL.mag3 : PAL.cyan3);
              if (el > glitchMs - 40) s.img.setTintFill(o.flashColor ?? PAL.white);
              else if (rnd() < 0.12) s.img.setTintFill(ramp[3]);
              else s.img.clearTint();
            }
          }
          return el < glitchMs;
        },
        resolve,
      );
    });
    for (const s of slices) {
      s.img.destroy();
      s.ghost.destroy();
    }
  }
  // ---- bricks
  if (o.sound !== false) playSfx('shatter', { volume: 0.9 });
  const push = o.push ? norm(o.push) : { x: 0, y: 0 };
  const spd = o.speed ?? 1;
  const up = o.up ?? [15, 60];
  const grav = o.gravity ?? 420;
  const floor = o.floor ?? null;
  const bounce = o.bounce ?? 0.3;
  const life = o.life ?? [520, 820];
  const doFlash = o.flash !== false;
  const attract = o.attract ?? null;
  interface Brick {
    img: Phaser.GameObjects.Image;
    vx: number;
    vy: number;
    vr: number;
    life: number;
    delay: number;
    rest: boolean;
  }
  const bricks: Brick[] = [];
  const motes = new Sparks(scene, DEPTH.FX);
  const shards = new Sparks(scene, DEPTH.FX + 0.5);
  for (let y = bounds.y; y < bounds.y + bounds.h; ) {
    const bh = Math.min(bounds.y + bounds.h - y, 2 + Math.floor(rnd() * 2));
    for (let x = bounds.x; x < bounds.x + bounds.w; ) {
      const bw = Math.min(bounds.x + bounds.w - x, 2 + Math.floor(rnd() * 3));
      let n = 0;
      for (let yy = y; yy < y + bh; yy++) for (let xx = x; xx < x + bw; xx++) if (pc.isOpaque(xx, yy)) n++;
      if (n >= 2) {
        const name = `br:${x}:${y}:${bw}:${bh}`;
        if (!tex.has(name)) tex.add(name, 0, x, y, bw, bh);
        const c = toWorld(x + bw / 2, y + bh / 2);
        const img = scene.add.image(c.x, c.y, key, name).setFlipX(flip).setScale(sx, sy).setDepth(depth);
        if (doFlash) img.setTintFill(o.flashColor ?? PAL.white);
        const dx = c.x - core.x;
        const dy = c.y - core.y;
        const d = Math.hypot(dx, dy) || 1;
        const sp = rr(25, 75) * (0.45 + Math.min(1.1, d / 34)) * spd;
        bricks.push({
          img,
          vx: (dx / d) * sp + push.x * rr(15, 50) * spd + rr(-10, 10),
          vy: (dy / d) * sp * 0.7 + push.y * rr(10, 35) * spd - rr(up[0], up[1]),
          vr: rr(-9, 9) * Math.min(1, spd),
          life: rr(life[0], life[1]),
          delay: rnd() * 40,
          rest: false,
        });
      } else if (n === 1 && rnd() < 0.5 && o.motes !== false) {
        const c = toWorld(x + bw / 2, y + bh / 2);
        motes.add({ x: c.x, y: c.y, vx: rr(-15, 15), vy: rr(-50, -15), drag: 0.8, life: rr(500, 900), colors: [PAL.white, ramp[4], ramp[3], ramp[2]], shape: 'px', flicker: true });
      }
      x += bw;
    }
    y += bh;
  }
  const nShards = o.shards ?? 22;
  const shardCols = o.shardColors ?? [PAL.white, ramp[4], ramp[3], ramp[2]];
  for (let i = 0; i < nShards; i++) {
    const a = rr(0, TAU);
    const v = rr(60, 150) * spd;
    shards.add({ x: core.x + rr(-4, 4), y: core.y + rr(-4, 4), vx: Math.cos(a) * v + push.x * 40, vy: Math.sin(a) * v * 0.7 - 50 + push.y * 30, ay: 380, drag: 1, rot: rr(0, 6), vrot: rr(-16, 16), life: rr(450, 800), colors: shardCols, shape: 'shard', size: rr(2, 4.2), fadeAt: 0.6 });
  }
  if (o.motes !== false) {
    for (let i = 0; i < 20; i++) {
      const p = toWorld(bounds.x + rnd() * bounds.w, bounds.y + rnd() * bounds.h);
      motes.add({ x: p.x, y: p.y, vx: rr(-10, 10), vy: rr(-45, -12), drag: 0.6, delay: rr(0, 200), life: rr(500, 1000), colors: [ramp[4], ramp[3], ramp[2]], shape: rnd() < 0.3 ? 'plus' : 'px', size: 1, flicker: true });
    }
  }
  shards.add({ x: core.x, y: core.y, life: 300, size: 6, grow: 110, shape: 'ring', colors: [PAL.white, ramp[4], ramp[3]], alpha: 0.9 });
  shards.add({ x: core.x, y: core.y, life: 180, size: 14, grow: -60, shape: 'star', colors: [PAL.white, ramp[4]], rot: Math.PI / 4, fadeAt: 0.3 });
  motes.release();
  shards.release();
  void shake(scene, 200, o.shakePx ?? 2);
  const stopMs = o.stopMs ?? 40;
  if (stopMs > 0) void stopTime(scene, stopMs);
  await new Promise<void>((resolve) => {
    let f = 0;
    onFrame(
      scene,
      (dt, el) => {
        if (dt > 0) f++;
        const s = dt / 1000;
        let alive = 0;
        for (const b of bricks) {
          if (!b.img.active) continue;
          if (el < b.delay) {
            alive++;
            continue;
          }
          const age = el - b.delay;
          if (age >= b.life) {
            b.img.destroy();
            continue;
          }
          alive++;
          if (attract && age > attract.after) {
            const dx = attract.x - b.img.x;
            const dy = attract.y - b.img.y;
            const dd = Math.hypot(dx, dy);
            if (dd < 3) {
              b.img.destroy();
              continue;
            }
            const pull = (attract.k ?? 9) * Math.min(1, (age - attract.after) / 200);
            b.vx += (dx / dd) * pull * 60 * s * 10 - b.vx * 3 * s;
            b.vy += (dy / dd) * pull * 60 * s * 10 - b.vy * 3 * s;
            b.img.x += b.vx * s;
            b.img.y += b.vy * s;
            b.img.rotation += b.vr * s;
            b.img.setScale(sx * Math.min(1, dd / 18 + 0.3), sy * Math.min(1, dd / 18 + 0.3));
          } else if (!b.rest) {
            b.vy += grav * s;
            b.vx *= Math.exp(-1.2 * s);
            b.img.x += b.vx * s;
            b.img.y += b.vy * s;
            b.img.rotation += b.vr * s;
            if (floor !== null && b.img.y > floor + rr(-3, 3) && b.vy > 0) {
              b.vy = -b.vy * bounce;
              b.vx *= 0.5;
              b.vr *= 0.4;
              if (Math.abs(b.vy) < 25) b.rest = true;
            }
          }
          if (doFlash) {
            if (f <= 2) b.img.setTintFill(o.flashColor ?? PAL.white);
            else if (f <= 4) b.img.setTintFill(ramp[3]);
            else if (f <= 6) b.img.setTint(ramp[4]);
            else if (f === 7) b.img.clearTint();
          }
          const t = age / b.life;
          b.img.setAlpha(t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45);
          if (t > 0.7) b.img.setVisible(Math.floor(age / 50) % 2 === 0);
        }
        return alive > 0;
      },
      () => {
        for (const b of bricks) if (b.img.active) b.img.destroy();
        if (scene.textures.exists(key)) scene.textures.remove(key);
        resolve();
      },
    );
  });
}

// ================================================================ destroy bookkeeping

/** True when the card that caused this destroy has its own 'destroys' choreography (e.g. chasm). */
export function sourceOwnsDestroy(ctx: Ctx<'destroy'>): boolean {
  const src = ctx.ev.sourceUid;
  if (src === null || src === undefined) return false;
  let id: string;
  try {
    id = ctx.cardId(src);
  } catch {
    return false;
  }
  const cards = listHandlers().cards;
  return !!cards[`${id}|destroys`]?.length;
}

export interface DeathArgs {
  ctx: Ctx<'destroy'>;
  unit: MonsterUnit;
  /** Burst direction hint (the blow's direction), if any. */
  push: XY | undefined;
  /** Play the recoil flash first (false when the impact already flashed it). */
  hit: boolean;
  home: XY;
  /** Call when the monster bursts (the card under it starts dissolving). */
  burst(): void;
}

/**
 * A flavoured monster destruction with the default destroy handler's bookkeeping: claims the
 * following toGraveyard of the card, releases the field entry, runs `flavor` (which must end in
 * a shatter that hides the sprite), retires the unit, dissolves the tile and arcs the card into
 * the owner's graveyard. Falls back to the chain (ctx.base) for spell/trap destroys, face-down
 * monsters, and destroys owned by the source card's own choreography.
 */
export async function flavoredDeath(ctx: Ctx<'destroy'>, flavor: (d: DeathArgs) => Promise<void>): Promise<void> {
  const ev = ctx.ev;
  if (ev.location !== 'monster') return ctx.base();
  if (sourceOwnsDestroy(ctx)) return ctx.base();
  const unit = ctx.unit(ev.uid);
  if (!unit || unit.retired || !unit.sprite.active || !unit.sprite.visible) return ctx.base();
  const field = ctx.views.field;
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid, {
    until: (e) => e.type !== 'toGraveyard' && e.type !== 'destroy' && e.type !== 'fieldSpell' && e.type !== 'statChange',
  });
  const gEv = gi >= 0 ? (ctx.events[gi] as EvOf<'toGraveyard'>) : null;
  if (gi >= 0) ctx.consumeAt(gi);
  const owner = gEv ? gEv.owner : ctx.owner(ev.uid);
  const { tile } = field.release(ev.uid);
  const home = tile ? { ...tile.home } : zoneXY(ev.player, 'monster', ev.zone);
  unit.badge.setVisible(false);
  unit.posed = true;
  let tileJob: Promise<void> | null = null;
  const burst = () => {
    if (tileJob || !tile) return;
    tileJob = dissolveTile(ctx, tile);
  };
  try {
    await flavor({ ctx, unit, push: ctx.hints.push as XY | undefined, hit: ctx.hints.hit !== false, home, burst });
  } catch (e) {
    console.error('[strikes-a] death flavour failed', e);
  } finally {
    burst();
    unit.posed = false;
    if (!unit.retired) unit.retire();
    field.forget(ev.uid);
  }
  const jobs: Promise<unknown>[] = [];
  if (tileJob) jobs.push(tileJob);
  if (gEv) jobs.push(cardToGraveyard(ctx as unknown as AnyCtx, { owner, cardId: ev.cardId, from: { x: home.x, y: home.y - 4 } }));
  await Promise.all(jobs.map((p) => p.catch((e) => console.error('[strikes-a]', e))));
}

async function dissolveTile(ctx: AnyCtx | Ctx<'destroy'>, tile: TileCard): Promise<void> {
  if (!tile.active) return;
  await sleep(ctx.scene, 120);
  if (!tile.active) return;
  await tile.dissolve(480);
  if (tile.active) tile.destroy();
}

// ================================================================ effect runs

/** Index (in the activation's resolution run) of the damage this monster effect deals, or -1. */
export function effectDamage(ctx: Ctx<'activate'>, run: readonly number[]): { di: number; dmg: EvOf<'damage'> | null } {
  const di = run.find((i) => {
    const e = ctx.events[i];
    return e.type === 'damage' && e.sourceUid === ctx.ev.uid;
  });
  return di === undefined ? { di: -1, dmg: null } : { di, dmg: ctx.events[di] as EvOf<'damage'> };
}

/** Where a monster that already left the field stood (its last destroy in this batch). */
export function lastSpot(ctx: AnyCtx, uid: number): XY | null {
  for (let i = ctx.index - 1; i >= 0; i--) {
    const e = ctx.events[i];
    if (e.type === 'destroy' && e.uid === uid && e.location === 'monster') return zoneXY(e.player, 'monster', e.zone);
  }
  const loc = ctx.locate(uid, 'before');
  return loc && loc.zone === 'monster' ? zoneXY(loc.player, 'monster', loc.index) : null;
}

/** Live unit if it stands visible on the field. */
export function liveUnit(ctx: AnyCtx, uid: number): MonsterUnit | null {
  const u = ctx.unit(uid);
  return u && !u.retired && u.sprite.active && u.sprite.visible ? u : null;
}

export function otherPlayer(p: PlayerId): PlayerId {
  return p === 0 ? 1 : 0;
}

export type { MonsterId };
