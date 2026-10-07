// Monster destruction: the hologram glitches, then the monster's ACTUAL pixels burst apart.
//
//   await shatter(scene, sprite, { monsterId: 'crystal_wyrm', attribute: 'LIGHT', push: { x: 1, y: -0.5 } });
//
// 1. Glitch (~150 ms): the sprite is replaced by horizontal slices of its current frame that jitter
//    sideways, split into cyan/magenta ghosts and drop scanlines; the last frames flash white.
// 2. Burst: the frame is cut into small bricks (2–4 px, real pixels from monsterFrame()) that fly
//    out from the core with gravity, spin and fade — flashing white then attribute-tinted on the
//    first frames — plus attribute-colored glass shards, a ring and rising data motes.
// The sprite is hidden (setVisible(false)), never destroyed. Honors flipX, origin, scale.

import Phaser from 'phaser';
import type { Attribute, MonsterId } from '../data/cards';
import { monsterArt } from '../art/monsters';
import { ATTRIBUTE_RAMP, PAL } from '../art/palette';
import { mulberry32 } from '../art/pixel';
import { monsterFrame } from '../art/textures';
import type { MonsterAnim } from '../art/types';
import { MONSTER_ANIMS } from '../art/types';
import { DEPTH, type XY } from '../view/layout';
import { sfx } from '../audio/sfx';
import { shake } from './core';
import { E, Sparks, framePointToWorld, onFrame, stopTime } from './combat';

export interface ShatterOpts {
  monsterId: MonsterId;
  /** Frame to shatter (default: parsed from the sprite's current frame name "<anim>:<i>", else idle 0). */
  anim?: MonsterAnim;
  frame?: number;
  attribute: Attribute;
  /** Glitch duration before the burst (default 150 ms). */
  glitchMs?: number;
  /** Bias the burst direction (e.g. the attack direction). */
  push?: XY;
  /** Short freeze on the burst frame (default 40 ms; 0 = none). */
  stopMs?: number;
  depth?: number;
}

let seed = 1;

function currentFrame(sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image): { anim: MonsterAnim; frame: number } {
  const name = String(sprite.frame?.name ?? '');
  const m = /^([a-z]+):(\d+)$/.exec(name);
  if (m && (MONSTER_ANIMS as string[]).includes(m[1])) return { anim: m[1] as MonsterAnim, frame: Number(m[2]) };
  return { anim: 'idle', frame: 0 };
}

interface Brick {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  vr: number;
  life: number;
  delay: number;
}

/** Shatter a monster sprite into its own pixels. Resolves when the debris has settled (~1 s). */
export async function shatter(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image, opts: ShatterOpts): Promise<void> {
  if (!sprite || !sprite.active) return;
  const cur = currentFrame(sprite);
  const anim = opts.anim ?? cur.anim;
  const fi = opts.frame ?? cur.frame;
  const art = monsterArt(opts.monsterId);
  const pc = monsterFrame(opts.monsterId, anim, fi);
  const ramp = ATTRIBUTE_RAMP[opts.attribute];
  const depth = opts.depth ?? sprite.depth + 0.5;
  const rnd = mulberry32(++seed * 7919);
  const RR = (a: number, b: number) => a + (b - a) * rnd();

  // texture of exactly these pixels, with sub-frames for slices / bricks
  const key = `shatter:${opts.monsterId}:${anim}:${fi}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, pc.toCanvas());
  const tex = scene.textures.get(key);
  const W = pc.w;
  const H = pc.h;
  // sprite frame may be a different size than the art (defensive): map art px → sprite frame px
  const kx = sprite.frame.realWidth / W;
  const ky = sprite.frame.realHeight / H;
  const toWorld = (fx: number, fy: number) => framePointToWorld(sprite, fx * kx, fy * ky);
  const m = sprite.getWorldTransformMatrix().decomposeMatrix();
  const sx = m.scaleX * kx;
  const sy = m.scaleY * ky;
  const flip = sprite.flipX;
  const core = toWorld(art.core.x, art.core.y);
  const bounds = pc.bounds() ?? { x: 0, y: 0, w: W, h: H };

  // ------------------------------------------------------------ 1. hologram glitch
  const glitchMs = opts.glitchMs ?? 150;
  sprite.setVisible(false);
  const slices: { img: Phaser.GameObjects.Image; ghost: Phaser.GameObjects.Image; y0: number; h: number }[] = [];
  for (let y = bounds.y; y < bounds.y + bounds.h; ) {
    const h = Math.min(bounds.y + bounds.h - y, 2 + Math.floor(rnd() * 3));
    const name = `gl:${y}:${h}`;
    if (!tex.has(name)) tex.add(name, 0, 0, y, W, h);
    const c = toWorld(W / 2, y + h / 2);
    const ghost = scene.add.image(c.x, c.y, key, name).setFlipX(flip).setScale(sx, sy).setDepth(depth - 0.01).setTintFill(PAL.mag3).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    const img = scene.add.image(c.x, c.y, key, name).setFlipX(flip).setScale(sx, sy).setDepth(depth);
    slices.push({ img, ghost, y0: c.y, h });
    y += h;
  }
  try {
    sfx.play('shatter', { volume: 0.5, pitch: 1.4 });
  } catch {
    /* no audio */
  }
  await new Promise<void>((resolve) => {
    let f = 0;
    onFrame(scene, (dt, el) => {
      if (dt > 0) f++;
      const reroll = f % 2 === 0;
      const late = el > glitchMs - 40;
      for (const s of slices) {
        const base = toWorld(W / 2, 0).x;
        if (reroll) {
          const r = rnd();
          const amp = 1 + (el / glitchMs) * 4;
          const off = r < 0.38 ? Math.round(RR(-amp, amp)) : 0;
          s.img.x = Math.round(base + off);
          s.img.setVisible(rnd() > 0.08 + (el / glitchMs) * 0.12);
          const split = rnd() < 0.3;
          s.ghost.setAlpha(split ? 0.7 : 0);
          s.ghost.x = s.img.x + (rnd() < 0.5 ? -2 : 2);
          s.ghost.setTintFill(rnd() < 0.5 ? PAL.mag3 : PAL.cyan3);
          if (late) s.img.setTintFill(PAL.white);
          else if (rnd() < 0.12) s.img.setTintFill(ramp[3]);
          else s.img.clearTint();
        }
      }
      return el < glitchMs;
    }, resolve);
  });
  for (const s of slices) {
    s.img.destroy();
    s.ghost.destroy();
  }

  // ------------------------------------------------------------ 2. burst into bricks
  try {
    sfx.play('shatter');
  } catch {
    /* no audio */
  }
  const push = opts.push ? { x: opts.push.x, y: opts.push.y } : { x: 0, y: 0 };
  const pl = Math.hypot(push.x, push.y) || 1;
  push.x /= pl;
  push.y /= pl;
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
        const img = scene.add.image(c.x, c.y, key, name).setFlipX(flip).setScale(sx, sy).setDepth(depth).setTintFill(PAL.white);
        const dx = c.x - core.x;
        const dy = c.y - core.y;
        const d = Math.hypot(dx, dy) || 1;
        // outer pieces fly faster; the core crumbles
        const sp = RR(25, 75) * (0.45 + Math.min(1.1, d / 34));
        bricks.push({
          img,
          vx: (dx / d) * sp + push.x * RR(15, 50) + RR(-10, 10),
          vy: (dy / d) * sp * 0.7 + push.y * RR(10, 35) - RR(15, 60),
          vr: RR(-9, 9),
          life: RR(520, 820),
          delay: rnd() * 40,
        });
      } else if (n === 1 && rnd() < 0.5) {
        // stray single pixels become holographic data motes
        const c = toWorld(x + bw / 2, y + bh / 2);
        motes.add({ x: c.x, y: c.y, vx: RR(-15, 15), vy: RR(-50, -15), drag: 0.8, life: RR(500, 900), colors: [PAL.white, ramp[4], ramp[3], ramp[2]], shape: 'px', flicker: true });
      }
      x += bw;
    }
    y += bh;
  }
  // attribute shards + ring + motes
  for (let i = 0; i < 22; i++) {
    const a = RR(0, Math.PI * 2);
    const v = RR(60, 150);
    shards.add({ x: core.x + RR(-4, 4), y: core.y + RR(-4, 4), vx: Math.cos(a) * v + push.x * 40, vy: Math.sin(a) * v * 0.7 - 50 + push.y * 30, ay: 380, drag: 1, rot: RR(0, 6), vrot: RR(-16, 16), life: RR(450, 800), colors: [PAL.white, ramp[4], ramp[3], ramp[2]], shape: 'shard', size: RR(2, 4.2), fadeAt: 0.6 });
  }
  for (let i = 0; i < 26; i++) {
    const p = toWorld(bounds.x + rnd() * bounds.w, bounds.y + rnd() * bounds.h);
    motes.add({ x: p.x, y: p.y, vx: RR(-10, 10), vy: RR(-45, -12), drag: 0.6, delay: RR(0, 200), life: RR(500, 1000), colors: [ramp[4], ramp[3], ramp[2]], shape: rnd() < 0.3 ? 'plus' : 'px', size: 1, flicker: true });
  }
  shards.add({ x: core.x, y: core.y, life: 300, size: 6, grow: 110, shape: 'ring', colors: [PAL.white, ramp[4], ramp[3]], alpha: 0.9 });
  shards.add({ x: core.x, y: core.y, life: 180, size: 14, grow: -60, shape: 'star', colors: [PAL.white, ramp[4]], rot: Math.PI / 4, fadeAt: 0.3 });
  motes.release();
  shards.release();
  void shake(scene, 200, 2);
  const stopMs = opts.stopMs ?? 40;
  if (stopMs > 0) void stopTime(scene, stopMs);

  await new Promise<void>((resolve) => {
    let f = 0;
    onFrame(scene, (dt, el) => {
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
        b.vy += 420 * s;
        b.vx *= Math.exp(-1.2 * s);
        b.img.x += b.vx * s;
        b.img.y += b.vy * s;
        b.img.rotation += b.vr * s;
        // flash white → attribute tint → true colors
        if (f <= 2) b.img.setTintFill(PAL.white);
        else if (f <= 4) b.img.setTintFill(ramp[3]);
        else if (f <= 6) b.img.setTint(ramp[4]);
        else if (f === 7) b.img.clearTint();
        const t = age / b.life;
        b.img.setAlpha(t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45);
        // late bricks dissolve into holo-flicker
        if (t > 0.7) b.img.setVisible(Math.floor(age / 50) % 2 === 0);
      }
      void E;
      return alive > 0;
    }, () => {
      for (const b of bricks) if (b.img.active) b.img.destroy();
      resolve();
    });
  });
}
