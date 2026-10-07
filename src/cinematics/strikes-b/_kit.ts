// strikes-b shared kit: small choreography helpers used by the six signature files in this
// folder (storm_hawk, stone_sentinel, lumen_sprite, shade_assassin, volt_lizard, thorn_lurker).
// Registers nothing — it is loaded by the cinematics glob but only exports helpers.
//
// Sprite posing: the strikes drive the monster sprite frame by frame (pose / playFrom) so the
// art's anticipation, impact and recovery frames line up exactly with the motion and the VFX.
// Deaths: flavoredDeath() releases the unit, plays a per-monster flavour, shatters the sprite
// into its own pixels and hands the graveyard flight back to the base destroy handler.

import Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import type { GameEvent, PlayerId } from '../../engine/types';
import { ATTRIBUTE_RAMP, PAL, type Ramp } from '../../art/palette';
import { monsterAnimKey, monsterFrame, monsterFrameName } from '../../art/textures';
import type { MonsterAnim } from '../../art/types';
import { DEPTH, type XY, unitDepth } from '../../view/layout';
import { wait } from '../../vfx/core';
import { E, Px, Sparks, animate, onFrame, sleep } from '../../vfx/combat';
import { shatter } from '../../vfx/shatter';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { TileCard } from '../../view/TileCard';
import { listHandlers, type CinematicContext, type StrikeArgs } from '../api';

export { E, Px, Sparks, animate, onFrame, sleep };
export type { StrikeArgs };

export type DestroyCtx = CinematicContext<Extract<GameEvent, { type: 'destroy' }>>;
export type ActCtx = CinematicContext<Extract<GameEvent, { type: 'activate' }>>;
export type AnyCtx = CinematicContext<GameEvent>;

export const TAU = Math.PI * 2;
export const ADD = Phaser.BlendModes.ADD;
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const clamp01 = (v: number): number => clamp(v, 0, 1);
/** Normalised sub-range of t: 0 before a, 1 after b. */
export const seg = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));

export function vsub(a: XY, b: XY): XY {
  return { x: a.x - b.x, y: a.y - b.y };
}
export function vlen(a: XY): number {
  return Math.hypot(a.x, a.y);
}
export function vnorm(a: XY): XY {
  const l = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / l, y: a.y / l };
}
export function vlerp(a: XY, b: XY, t: number): XY {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
export function qbez(a: XY, c: XY, b: XY, t: number): XY {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}
export function cbez(a: XY, c1: XY, c2: XY, b: XY, t: number): XY {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
  };
}

// ---------------------------------------------------------------- deterministic random

let seed = 0x5b17ab;
/** Small LCG so films are repeatable (independent of the library streams). */
export function rnd(): number {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
export const rr = (a: number, b: number): number => a + (b - a) * rnd();
export const ri = (a: number, b: number): number => Math.floor(rr(a, b + 1));
export function reseed(n: number): void {
  seed = (n * 2654435761) >>> 0 || 1;
}

/** A Graphics + Px raster layer at a depth. Destroy with layer.g.destroy(). */
export function layer(scene: Phaser.Scene, depth: number, blend?: number): Px {
  const g = scene.add.graphics().setDepth(depth);
  if (blend !== undefined) g.setBlendMode(blend);
  return new Px(g);
}

// ---------------------------------------------------------------- sprite posing

/** +1 when the unit faces right (player 1), −1 when mirrored (player 2). */
export function facing(u: MonsterUnit): 1 | -1 {
  return u.sprite.flipX ? -1 : 1;
}

/** Hold one frame of an animation (stops the animation: full manual control). */
export function pose(u: MonsterUnit, anim: MonsterAnim, frame: number): void {
  const s = u.sprite;
  if (!s.active) return;
  const n = u.art.anims[anim].frames;
  s.anims.stop();
  s.setFrame(monsterFrameName(anim, clamp(Math.round(frame), 0, n - 1)));
}

/**
 * Play `anim` from frame `from`. Resolves when it completes (then back to idle/guard unless
 * hold). Safe against hit-stops and supersession (resolves anyway after a generous timeout).
 */
export function playFrom(u: MonsterUnit, anim: MonsterAnim, from: number, o: { hold?: boolean; timeScale?: number } = {}): Promise<void> {
  const s = u.sprite;
  const key = monsterAnimKey(u.cardId, anim);
  if (!s.active || !u.scene.anims.exists(key)) return Promise.resolve();
  const spec = u.art.anims[anim];
  s.anims.timeScale = o.timeScale ?? 1;
  s.play({ key, repeat: 0, startFrame: clamp(from, 0, spec.frames - 1) });
  return new Promise<void>((resolve) => {
    let done = false;
    const fin = (rest: boolean) => {
      if (done) return;
      done = true;
      s.off(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + key, onDone);
      if (s.active) s.anims.timeScale = 1;
      if (rest && !o.hold && !u.retired && s.active) u.rest();
      resolve();
    };
    const onDone = () => fin(true);
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + key, onDone);
    const ms = ((spec.frames - from) / spec.fps) * 1000;
    void wait(u.scene, ms * 1.6 + 250).then(() => fin(false));
  });
}

/** Sprite origin position that puts art frame point (fx, fy) on `world` (current flip, scale 1). */
export function placeFor(u: MonsterUnit, fx: number, fy: number, world: XY): XY {
  const d = facing(u);
  return { x: Math.round(world.x - (fx - u.art.anchorX) * d), y: Math.round(world.y - (fy - u.art.anchorY)) };
}

/** World point of art frame point (fx, fy) if the sprite origin were at `at` (current flip). */
export function pointAt(u: MonsterUnit, fx: number, fy: number, at: XY): XY {
  const d = facing(u);
  return { x: at.x + (fx - u.art.anchorX) * d, y: at.y + (fy - u.art.anchorY) };
}

/** Restore the canonical rest look of an attacker after a strike (position, scale, angle, tint). */
export function homeSprite(u: MonsterUnit): void {
  const s = u.sprite;
  if (!s.active || u.retired) return;
  const r = u.rest0;
  u.scene.tweens.killTweensOf(s);
  s.setPosition(r.x, r.y).setScale(1).setAngle(0).setAlpha(1);
  s.setDepth(unitDepth(u.home.y));
  u.lift = 0;
  if (s.anims) s.anims.timeScale = 1;
}

/** Pixels of a given colour set in a frame (for crest sparks, glints...). Frame coords. */
export function framePixelsOf(u: MonsterUnit, anim: MonsterAnim, frame: number, colors: readonly number[]): XY[] {
  const pc = monsterFrame(u.cardId, anim, frame);
  const set = new Set(colors);
  const out: XY[] = [];
  for (let y = 0; y < pc.h; y++)
    for (let x = 0; x < pc.w; x++) {
      const c = pc.get(x, y);
      if (c !== null && set.has(c)) out.push({ x, y });
    }
  return out;
}

/** Opaque bounds of the sprite's current frame in world space. */
export function worldBox(u: MonsterUnit): { x: number; y: number; w: number; h: number; cx: number; cy: number } {
  const fi = u.frameInfo();
  const b = monsterFrame(u.cardId, fi.anim ?? 'idle', fi.frame).bounds() ?? { x: 0, y: 0, w: u.art.w, h: u.art.h };
  const a = u.framePoint(b.x, b.y);
  const c = u.framePoint(b.x + b.w, b.y + b.h);
  const x = Math.min(a.x, c.x);
  const y = Math.min(a.y, c.y);
  const w = Math.abs(c.x - a.x);
  const h = Math.abs(c.y - a.y);
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

/** A static copy of the sprite's current frame (afterimage / ghost / dissolve body). */
export function ghostOf(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite, o: { color?: number; alpha?: number; depth?: number; add?: boolean } = {}): Phaser.GameObjects.Image {
  const img = scene.add.image(s.x, s.y, s.texture.key, s.frame.name);
  img.setOrigin(s.originX, s.originY).setFlipX(s.flipX).setScale(s.scaleX, s.scaleY).setAngle(s.angle);
  img.setDepth(o.depth ?? s.depth - 0.5);
  if (o.color !== undefined) img.setTintFill(o.color);
  img.setAlpha(o.alpha ?? 1);
  if (o.add) img.setBlendMode(ADD);
  return img;
}

/** Fading tinted ghosts dropped every `every` ms while `active()` is true. */
export function ghostTrail(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite, o: { colors: readonly number[]; every?: number; life?: number; alpha?: number; active: () => boolean }): Promise<void> {
  const every = o.every ?? 34;
  const life = o.life ?? 200;
  const a0 = o.alpha ?? 0.6;
  const gs: { img: Phaser.GameObjects.Image; age: number }[] = [];
  let acc = every;
  let k = 0;
  return new Promise((resolve) => {
    onFrame(
      scene,
      (dt) => {
        const on = s.active && s.visible && o.active();
        if (on) {
          acc += dt;
          if (acc >= every) {
            acc = 0;
            gs.push({ img: ghostOf(scene, s, { color: o.colors[k++ % o.colors.length], alpha: a0, add: true }), age: 0 });
          }
        }
        for (let i = gs.length - 1; i >= 0; i--) {
          const g = gs[i];
          g.age += dt;
          const t = g.age / life;
          if (t >= 1) {
            g.img.destroy();
            gs.splice(i, 1);
          } else g.img.setAlpha(a0 * (1 - t) * (1 - t));
        }
        return on || gs.length > 0;
      },
      () => {
        for (const g of gs) g.img.destroy();
        resolve();
      },
    );
  });
}

// ---------------------------------------------------------------- small VFX

/**
 * A fast straight cut across a point: a hairline flash, then a tapered blade of light whose head
 * outruns its tail, then a lingering cut line. `ramp` dark→light; angle = travel direction.
 */
export function streakCut(scene: Phaser.Scene, c: XY, angle: number, o: { len?: number; width?: number; ramp: readonly number[]; ms?: number; delay?: number; depth?: number }): Promise<void> {
  const len = o.len ?? 34;
  const W = o.width ?? 3;
  const ms = o.ms ?? 170;
  const R = o.ramp;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const A = { x: c.x - dx * len * 0.5, y: c.y - dy * len * 0.5 };
  return (async () => {
    if (o.delay) await sleep(scene, o.delay);
    const px = layer(scene, o.depth ?? DEPTH.FX + 3);
    const sp = new Sparks(scene, (o.depth ?? DEPTH.FX + 3) + 0.1);
    let sparked = false;
    await animate(scene, ms, (t) => {
      px.clear();
      if (t >= 1) return;
      const head = E.outC(seg(t, 0, 0.45));
      const tail = E.inQ(seg(t, 0.15, 1));
      const h = { x: A.x + dx * len * head, y: A.y + dy * len * head };
      const tl = { x: A.x + dx * len * tail, y: A.y + dy * len * tail };
      if (t < 0.12) {
        px.line(A.x, A.y, A.x + dx * len, A.y + dy * len, PAL.white, 1);
        return;
      }
      const fade = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      const mid = vlerp(tl, h, 0.62);
      const nx = -dy;
      const ny = dx;
      const w = W * (1 - t * 0.5);
      // tapered blade (outer glow, body, white core)
      px.poly([tl.x, tl.y, mid.x + nx * (w + 1), mid.y + ny * (w + 1), h.x, h.y, mid.x - nx * (w + 1), mid.y - ny * (w + 1)], R[1] ?? R[0], 0.55 * fade);
      px.poly([tl.x, tl.y, mid.x + nx * w * 0.7, mid.y + ny * w * 0.7, h.x, h.y, mid.x - nx * w * 0.7, mid.y - ny * w * 0.7], R[3] ?? R[2], fade);
      px.line(tl.x, tl.y, h.x, h.y, t < 0.5 ? PAL.white : (R[4] ?? PAL.white), fade);
      if (!sparked && t > 0.3) {
        sparked = true;
        for (let i = 0; i < 6; i++) {
          const a = angle + rr(-0.5, 0.5);
          sp.add({ x: c.x, y: c.y, vx: Math.cos(a) * rr(80, 160), vy: Math.sin(a) * rr(80, 160), drag: 5, life: rr(140, 260), colors: [PAL.white, R[4] ?? PAL.white, R[3] ?? PAL.white], shape: 'streak', len: 0.03 });
        }
      }
    });
    px.g.destroy();
    sp.release();
  })();
}

/** Iso ground ring expanding from (x, y). */
export function groundRing(scene: Phaser.Scene, x: number, y: number, o: { r0?: number; r1?: number; ms?: number; colors: readonly number[]; depth?: number; th?: number }): Promise<void> {
  const px = layer(scene, o.depth ?? DEPTH.TILE_FX + 4);
  const r0 = o.r0 ?? 4;
  const r1 = o.r1 ?? 30;
  return animate(scene, o.ms ?? 360, (t) => {
    px.clear();
    if (t >= 1) return;
    const r = lerp(r0, r1, E.outC(t));
    const c = o.colors[Math.min(o.colors.length - 1, Math.floor(t * o.colors.length))];
    px.ellipseRing(x, y, r, r * 0.5, o.th ?? (t < 0.4 ? 2 : 1), c, 1 - t * t);
  }).then(() => px.g.destroy());
}

/** Shake-free tiny glint (4-point star that pops and shrinks) — anticipation sparkle on an eye/blade. */
export function glint(scene: Phaser.Scene, x: number, y: number, o: { size?: number; ms?: number; color?: number; depth?: number } = {}): Promise<void> {
  const px = layer(scene, o.depth ?? DEPTH.FX + 6);
  const S = o.size ?? 7;
  return animate(scene, o.ms ?? 220, (t) => {
    px.clear();
    if (t >= 1) return;
    const k = t < 0.3 ? E.outBack(t / 0.3) : 1 - E.inQ((t - 0.3) / 0.7);
    px.star(x + 0.5, y + 0.5, S * k + 1, 1, o.color ?? PAL.gold4, 1, 0);
    px.star(x + 0.5, y + 0.5, S * 0.6 * k, 1, PAL.white, 1, Math.PI / 4);
  }).then(() => px.g.destroy());
}

// ---------------------------------------------------------------- camera

/** Push the camera toward a point (the battle handler unfocuses at the end of the battle). */
export function push(ctx: AnyCtx | StrikeArgs['ctx'], xy: XY, zoom = 1.06, ms = 260, pan = 0.32): void {
  void ctx.focus(xy, { zoom, ms, pan });
}

// ---------------------------------------------------------------- deaths

/**
 * True when the destroy should be animated by the destroying card's own 'destroys' hook (e.g.
 * Yer Yarığı swallows the monster) — the victim's flavoured death then steps aside.
 */
export function sourceOwnsDeath(ctx: DestroyCtx): boolean {
  const src = ctx.ev.sourceUid;
  if (src === null) return false;
  let id: CardId | null = null;
  try {
    id = ctx.cardId(src);
  } catch {
    id = null;
  }
  if (!id) return false;
  try {
    const list = listHandlers().cards[`${id}|destroys`];
    return !!list && list.length > 0;
  } catch {
    return false;
  }
}

export interface DeathOpts {
  /** Flavour before the shatter. Sprite still visible; badge hidden. */
  flavor?: (u: MonsterUnit, info: { push: XY | null; hit: boolean }) => Promise<void>;
  /** Shatter options. */
  glitchMs?: number;
  push?: (u: MonsterUnit, push: XY | null) => XY | undefined;
  /** Runs when the shatter bursts (extra debris). */
  onBurst?: (u: MonsterUnit, at: XY) => void;
  /** Delay of the tile dissolve after the shatter starts (ms). */
  tileDelay?: number;
}

/**
 * A monster's flavoured death: release the unit and tile, flavour, shatter into its pixels,
 * dissolve the tile, then hand over to the base handler for the graveyard flight (it finds
 * nothing left on the field). Falls back to base() when the unit is not on screen or the
 * destroying card animates it itself.
 */
export async function flavoredDeath(ctx: DestroyCtx, o: DeathOpts): Promise<void> {
  const ev = ctx.ev;
  if (ev.location !== 'monster' || sourceOwnsDeath(ctx)) return ctx.base();
  const field = ctx.views.field;
  const unit = field.unit(ev.uid);
  if (!unit || unit.retired || !unit.sprite.active || !unit.sprite.visible) return ctx.base();
  const { tile } = field.release(ev.uid);
  const sc = ctx.scene;
  const push = (ctx.hints.push as XY | undefined) ?? null;
  const hit = ctx.hints.hit !== false;
  unit.badge.setVisible(false);
  unit.posed = true;
  try {
    if (o.flavor) await o.flavor(unit, { push, hit });
  } catch (e) {
    console.error('[strikes-b] death flavour failed', e);
  }
  const tileJob = tile ? dissolveTile(sc, tile, o.tileDelay ?? 200) : Promise.resolve();
  if (unit.sprite.active && unit.sprite.visible) {
    ctx.sfx('shatter', { volume: 0.9 });
    const at = unit.core();
    const sh = shatter(sc, unit.sprite, {
      monsterId: unit.cardId,
      attribute: unit.attribute,
      push: o.push ? o.push(unit, push) : (push ?? undefined),
      glitchMs: o.glitchMs ?? 120,
    });
    if (o.onBurst) void wait(sc, (o.glitchMs ?? 120) + 10).then(() => o.onBurst?.(unit, at));
    // the card can start for the graveyard while the debris is still falling
    await Promise.race([sh, wait(sc, (o.glitchMs ?? 120) + 520)]);
    void sh.then(() => unit.retire(400));
  } else unit.retire(400);
  field.forget(ev.uid);
  await Promise.all([ctx.base(), tileJob]);
}

async function dissolveTile(scene: Phaser.Scene, tile: TileCard, delay: number): Promise<void> {
  if (!tile.active) return;
  await wait(scene, delay);
  if (!tile.active) return;
  await tile.dissolve(460);
  tile.destroy();
}

/** Attribute ramp of a unit. */
export function ramp(u: MonsterUnit): Ramp {
  return ATTRIBUTE_RAMP[u.attribute];
}

/** The opponent of p. */
export function opp(p: PlayerId): PlayerId {
  return p === 0 ? 1 : 0;
}
