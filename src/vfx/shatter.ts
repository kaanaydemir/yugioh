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
//
// v3 material presets (?look=v3 callers only; docs/v3/A0_ENVANTER.md §6.2 item 2): with
// `material` set, shatter() runs shatterMaterial() instead — the same real pixels, but crisp (whole-
// pixel positions, no brick rotation or fractional scale, palette-step tints instead of alpha ramps),
// no hologram glitch (a v3 body is not a hologram: its death pose already broke it), and debris that
// behaves like its matter: crystal (glass shards, clinks, light going out), stone (heavy chunks that
// bounce and settle as rubble), light (motes drifting up), shadow (pulled down into the floor), plant
// (fluttering, withering), fire (embers cooling to ash), water (drops that splash on the floor).
// Frame 0 of the burst shows every brick in place, so the swap from the sprite is seamless.

import Phaser from 'phaser';
import type { Attribute, MonsterId } from '../data/cards';
import { monsterArt } from '../art/monsters';
import { ATTRIBUTE_RAMP, PAL } from '../art/palette';
import { mulberry32 } from '../art/pixel';
import { addStaticCanvas, monsterFrame, monsterP2TextureKey } from '../art/textures';
import type { AnyMonsterAnim, DrawOpts } from '../art/types';
import { MONSTER_ANIMS } from '../art/types';
import { animSpec, isExtraAnim } from '../art/animtime';
import { DEPTH, type XY } from '../view/layout';
import { sfx } from '../audio/sfx';
import { shake } from './core';
import { E, Sparks, framePointToWorld, onFrame, stopTime } from './combat';
import { onDuelStart } from '../duel/seeds';

export interface ShatterOpts {
  monsterId: MonsterId;
  /** Frame to shatter (default: parsed from the sprite's current frame name "<anim>:<i>", else idle 0). */
  anim?: AnyMonsterAnim;
  frame?: number;
  attribute: Attribute;
  /** Glitch duration before the burst (default 150 ms). */
  glitchMs?: number;
  /** Bias the burst direction (e.g. the attack direction). */
  push?: XY;
  /** Short freeze on the burst frame (default 40 ms; 0 = none). */
  stopMs?: number;
  depth?: number;
  // ---- v3 (material mode; the old look never passes these)
  /** v3: break the pixels as this matter (see the header and SHATTER_MATERIALS). */
  material?: ShatterMaterial;
  /** v3: floor line (world y) the debris lands on (default: 20 px under the core). */
  floorY?: number;
  /** v3: called on the burst frame (the sprite has just been swapped for its bricks). */
  onBurst?: (core: XY) => void;
  /** v3: burst velocity multiplier on top of the preset (default 1). */
  speed?: number;
}

let seed = 1;
onDuelStart(() => (seed = 1));

// Slices and bricks are sub-frames of the cached `shatter:<id>:<anim>:<frame>` texture. Their
// rects are random per shatter, so they are added for the effect and removed again once no
// running shatter uses them (refcounted: two monsters of the same kind can break at once).
// Before, every shatter left ~150–230 new Frame objects on the cached texture for good.
const frameUses = new Map<string, number>();

function useFrame(tex: Phaser.Textures.Texture, name: string, x: number, y: number, w: number, h: number, used: string[]): void {
  if (!tex.has(name)) tex.add(name, 0, x, y, w, h);
  const k = `${tex.key}|${name}`;
  frameUses.set(k, (frameUses.get(k) ?? 0) + 1);
  used.push(name);
}

function releaseFrames(tex: Phaser.Textures.Texture, used: string[]): void {
  for (const name of used.splice(0)) {
    const k = `${tex.key}|${name}`;
    const n = (frameUses.get(k) ?? 1) - 1;
    if (n > 0) {
      frameUses.set(k, n);
      continue;
    }
    frameUses.delete(k);
    if (tex.manager && tex.has(name)) tex.remove(name);
  }
}

function currentFrame(sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image): { anim: AnyMonsterAnim; frame: number } {
  const name = String(sprite.frame?.name ?? '');
  const m = /^([a-z]+):(\d+)$/.exec(name);
  if (m && (MONSTER_ANIMS as string[]).includes(m[1])) return { anim: m[1] as AnyMonsterAnim, frame: Number(m[2]) };
  // v3 extra anims ('death:6', 'hitHeavy:2' ...; never on a sheet of the old look)
  const x = /^([A-Za-z]+):(\d+)$/.exec(name);
  if (x && isExtraAnim(x[1])) return { anim: x[1], frame: Number(x[2]) };
  return { anim: 'idle', frame: 0 };
}

/**
 * The cached `shatter:<id>:<anim>:<frame>` texture (`…:p2` for a P2 'relight' sheet): exactly the
 * pixels of that monster frame. Created on first use; warmShatter() makes it ahead of time.
 */
function shatterTexture(scene: Phaser.Scene, id: MonsterId, anim: AnyMonsterAnim, frame: number, relit = false) {
  const o: DrawOpts | undefined = relit ? { lightFrom: 'right' } : undefined;
  const pc = monsterFrame(id, anim, frame, o);
  const key = `shatter:${id}:${anim}:${frame}${relit ? ':p2' : ''}`;
  if (!scene.textures.exists(key)) addStaticCanvas(scene, key, pc.toCanvas());
  return { key, pc };
}

/**
 * Warm (v3 A1 item 11): create the shatter texture of a frame (clamped to the anim) before the
 * first death needs it; src/duel/warm.ts passes the frame the default death breaks. Returns its key.
 */
export function warmShatter(scene: Phaser.Scene, id: MonsterId, anim: AnyMonsterAnim = 'hit', frame = 1, relit = false): string {
  const f = Math.max(0, Math.min(frame, (animSpec(monsterArt(id), anim)?.frames ?? 1) - 1));
  return shatterTexture(scene, id, anim, f, relit).key;
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
  if (opts.material) return shatterMaterial(scene, sprite, opts, opts.material);
  const cur = currentFrame(sprite);
  const anim = opts.anim ?? cur.anim;
  const fi = opts.frame ?? cur.frame;
  const art = monsterArt(opts.monsterId);
  // a P2 'relight' sheet on screen (v3): shatter its pixels, lit the same way
  const relit = sprite.texture?.key === monsterP2TextureKey(opts.monsterId);
  const ramp = ATTRIBUTE_RAMP[opts.attribute];
  const depth = opts.depth ?? sprite.depth + 0.5;
  const rnd = mulberry32(++seed * 7919);
  const RR = (a: number, b: number) => a + (b - a) * rnd();

  // texture of exactly these pixels, with sub-frames for slices / bricks
  const { key, pc } = shatterTexture(scene, opts.monsterId, anim, fi, relit);
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
  const sliceFrames: string[] = [];
  const brickFrames: string[] = [];
  for (let y = bounds.y; y < bounds.y + bounds.h; ) {
    const h = Math.min(bounds.y + bounds.h - y, 2 + Math.floor(rnd() * 3));
    const name = `gl:${y}:${h}`;
    useFrame(tex, name, 0, y, W, h, sliceFrames);
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
  releaseFrames(tex, sliceFrames);
  // the scene shut down (duel restarted) during the glitch: don't burst into the next duel
  if (!scene.sys.isActive()) return;

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
        useFrame(tex, name, x, y, bw, bh, brickFrames);
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
      releaseFrames(tex, brickFrames);
      resolve();
    });
  });
}

// ==================================================================================== v3 materials

export type ShatterMaterial = 'crystal' | 'stone' | 'light' | 'shadow' | 'plant' | 'fire' | 'water';
export const SHATTER_MATERIALS_LIST: readonly ShatterMaterial[] = ['crystal', 'stone', 'light', 'shadow', 'plant', 'fire', 'water'];

/** How one matter breaks (v3). Colours are palette tones; every tint is a whole palette step. */
export interface MaterialPreset {
  /** Brick edge range (px; real pixels of the frame). */
  brick: readonly [number, number];
  /** Outward burst speed (× the radial base), initial upward kick range (px/s), gravity (px/s²; < 0 rises). */
  speed: number;
  up: readonly [number, number];
  gravity: number;
  /** Velocity damping per second. */
  drag: number;
  /** Brick lifetime range (ms). */
  life: readonly [number, number];
  /** On the floor line: bounce (keep `bounce` of the speed, then lie as rubble), rest at once, splash (die into droplets), or fall through (null). */
  floor: 'bounce' | 'rest' | 'splash' | null;
  bounce: number;
  /** Sideways flutter amplitude (px/s): leaves, feathers, motes. */
  flutter: number;
  /** Pull toward the floor point under the core (px/s²; 0 = none): shadow sinks into its pool. */
  attract: number;
  /** Tint-fill tones of the burst's first frames (after frame 0, which shows the true pixels in place). */
  flash: readonly number[];
  /** Tones the bricks step through late in their life (light going out, ash, void), from `lateAt` (0…1). */
  late: readonly number[];
  lateAt: number;
  /** Life fraction from which a brick blinks out (stepped, never an alpha ramp). */
  blinkAt: number;
  /** Extra particles: shards (glass / drops), motes (dust, embers, wisps, sparkles). */
  shards: number;
  shardColors: readonly number[];
  shardShape: 'shard' | 'px' | 'sq';
  motes: number;
  moteColors: readonly number[];
  /** Mote vertical speed range (px/s, negative = up) and shape. */
  moteVy: readonly [number, number];
  moteShape: 'px' | 'plus' | 'puff';
  /** Burst ring + star at the core. */
  ring: readonly number[] | null;
  shake: number;
  stopMs: number;
  /** Burst sound pitch (the shatter sfx), 0 = silent. */
  pitch: number;
}

export const SHATTER_MATERIALS: Record<ShatterMaterial, MaterialPreset> = {
  // glass: sharp shards fly fast, clink on the floor, the light inside goes out
  crystal: {
    brick: [2, 3], speed: 0.95, up: [20, 70], gravity: 420, drag: 1.3, life: [440, 680], floor: 'bounce', bounce: 0.25, flutter: 0, attract: 0,
    // the light is already out when it breaks: one pale frame (no white burst), cold shards
    flash: [PAL.mist], late: [PAL.cyan1, PAL.night2], lateAt: 0.5, blinkAt: 0.66,
    shards: 14, shardColors: [PAL.white, PAL.cyan4, PAL.cyan3, PAL.cyan2], shardShape: 'shard',
    motes: 6, moteColors: [PAL.white, PAL.cyan4, PAL.cyan3], moteVy: [-50, -15], moteShape: 'plus',
    ring: null, shake: 2, stopMs: 40, pitch: 1.15,
  },
  // rock: heavy chunks drop, bounce once and lie as rubble before they crumble away
  stone: {
    brick: [2, 4], speed: 0.55, up: [5, 35], gravity: 680, drag: 1.6, life: [760, 1150], floor: 'bounce', bounce: 0.22, flutter: 0, attract: 0,
    flash: [PAL.stone4], late: [PAL.stone2, PAL.stone1], lateAt: 0.7, blinkAt: 0.84,
    shards: 0, shardColors: [], shardShape: 'px',
    motes: 12, moteColors: [PAL.stone3, PAL.stone2, PAL.stone1], moteVy: [-26, -8], moteShape: 'puff',
    ring: null, shake: 3, stopMs: 50, pitch: 0.7,
  },
  // light: the body comes apart into motes that drift up and blink out
  light: {
    brick: [1, 2], speed: 0.6, up: [20, 50], gravity: -50, drag: 1.8, life: [520, 900], floor: null, bounce: 0, flutter: 18, attract: 0,
    flash: [PAL.white], late: [PAL.gold4, PAL.white], lateAt: 0.45, blinkAt: 0.6,
    shards: 0, shardColors: [], shardShape: 'px',
    motes: 24, moteColors: [PAL.white, PAL.gold4, PAL.gold3], moteVy: [-60, -20], moteShape: 'plus',
    ring: [PAL.white, PAL.gold4, PAL.gold3], shake: 1, stopMs: 30, pitch: 1.4,
  },
  // shadow: no white — the pieces darken and are dragged down into the floor point
  shadow: {
    brick: [2, 3], speed: 0.5, up: [10, 40], gravity: 120, drag: 2.0, life: [520, 820], floor: null, bounce: 0, flutter: 0, attract: 900,
    flash: [PAL.void4], late: [PAL.void1, PAL.ink], lateAt: 0.42, blinkAt: 0.8,
    shards: 0, shardColors: [], shardShape: 'px',
    motes: 14, moteColors: [PAL.void4, PAL.void3, PAL.void2], moteVy: [-55, -20], moteShape: 'px',
    ring: null, shake: 1, stopMs: 30, pitch: 0.8,
  },
  // plant: leaves and petals flutter down and wither on the floor
  plant: {
    brick: [2, 3], speed: 0.6, up: [20, 50], gravity: 170, drag: 2.2, life: [700, 1100], floor: 'rest', bounce: 0, flutter: 30, attract: 0,
    flash: [PAL.leaf4], late: [PAL.earth1, PAL.earth0], lateAt: 0.62, blinkAt: 0.82,
    shards: 0, shardColors: [], shardShape: 'px',
    motes: 10, moteColors: [PAL.leaf3, PAL.leaf2, PAL.leaf1], moteVy: [-30, -6], moteShape: 'px',
    ring: null, shake: 1, stopMs: 30, pitch: 0.9,
  },
  // fire: embers burst, glow, cool to ash on the floor
  fire: {
    brick: [2, 3], speed: 0.85, up: [30, 80], gravity: 280, drag: 1.2, life: [520, 860], floor: 'rest', bounce: 0, flutter: 8, attract: 0,
    flash: [PAL.fire4, PAL.fire3], late: [PAL.fire1, PAL.stone1], lateAt: 0.4, blinkAt: 0.8,
    shards: 0, shardColors: [], shardShape: 'px',
    motes: 22, moteColors: [PAL.fire4, PAL.fire3, PAL.fire2], moteVy: [-70, -25], moteShape: 'px',
    ring: null, shake: 2, stopMs: 30, pitch: 0.95,
  },
  // water: the body bursts into drops that fall fast and splash on the floor
  water: {
    brick: [1, 3], speed: 0.8, up: [20, 60], gravity: 740, drag: 0.8, life: [420, 700], floor: 'splash', bounce: 0, flutter: 0, attract: 0,
    flash: [PAL.white, PAL.water4], late: [PAL.water2], lateAt: 0.7, blinkAt: 0.86,
    shards: 10, shardColors: [PAL.white, PAL.water4, PAL.water3], shardShape: 'sq',
    motes: 0, moteColors: [], moteVy: [0, 0], moteShape: 'px',
    ring: null, shake: 2, stopMs: 30, pitch: 1.05,
  },
};

interface MBrick {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  delay: number;
  floor: number;
  phase: number;
  /** 0 flying, 1 lying on the floor */
  rest: boolean;
  dead: boolean;
  tone: number;
}

/**
 * v3: break a monster frame as `material` (see SHATTER_MATERIALS). Crisp: bricks sit on whole
 * pixels, never rotate or scale. Resolves when the debris is gone (~0.8–1.2 s); opts.onBurst
 * fires on the burst frame.
 */
export async function shatterMaterial(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image, opts: ShatterOpts, material: ShatterMaterial): Promise<void> {
  if (!sprite || !sprite.active) return;
  const M = SHATTER_MATERIALS[material];
  const cur = currentFrame(sprite);
  const anim = opts.anim ?? cur.anim;
  const fi = opts.frame ?? cur.frame;
  const art = monsterArt(opts.monsterId);
  const relit = sprite.texture?.key === monsterP2TextureKey(opts.monsterId);
  const depth = opts.depth ?? sprite.depth + 0.5;
  const rnd = mulberry32(++seed * 7919 + 17);
  const RR = (a: number, b: number) => a + (b - a) * rnd();
  const { key, pc } = shatterTexture(scene, opts.monsterId, anim, fi, relit);
  const tex = scene.textures.get(key);
  const W = pc.w;
  const H = pc.h;
  const kx = sprite.frame.realWidth / W;
  const ky = sprite.frame.realHeight / H;
  const toWorld = (fx: number, fy: number) => framePointToWorld(sprite, fx * kx, fy * ky);
  const m = sprite.getWorldTransformMatrix().decomposeMatrix();
  // whole-number scale only (a v3 sprite is drawn at 1×; never shrink / stretch the debris)
  const sx = Math.max(1, Math.round(Math.abs(m.scaleX * kx)));
  const sy = Math.max(1, Math.round(Math.abs(m.scaleY * ky)));
  const flip = sprite.flipX;
  const core = toWorld(art.core.x, art.core.y);
  const floorY = Math.round(opts.floorY ?? core.y + 20);
  const sink = { x: Math.round(core.x), y: floorY };
  const bounds = pc.bounds() ?? { x: 0, y: 0, w: W, h: H };
  const push = opts.push ? { x: opts.push.x, y: opts.push.y } : { x: 0, y: 0 };
  const pl = Math.hypot(push.x, push.y) || 1;
  push.x /= pl;
  push.y /= pl;
  const spd = M.speed * (opts.speed ?? 1);
  const brickFrames: string[] = [];
  const bricks: MBrick[] = [];
  const motes = new Sparks(scene, depth + 0.1);
  const shards = new Sparks(scene, depth + 0.2);
  const [b0, b1] = M.brick;
  for (let y = bounds.y; y < bounds.y + bounds.h; ) {
    const bh = Math.min(bounds.y + bounds.h - y, b0 + Math.floor(rnd() * (b1 - b0 + 1)));
    for (let x = bounds.x; x < bounds.x + bounds.w; ) {
      const bw = Math.min(bounds.x + bounds.w - x, b0 + Math.floor(rnd() * (b1 - b0 + 1)));
      let n = 0;
      for (let yy = y; yy < y + bh; yy++) for (let xx = x; xx < x + bw; xx++) if (pc.isOpaque(xx, yy)) n++;
      if (n >= 1) {
        const name = `mb:${x}:${y}:${bw}:${bh}`;
        useFrame(tex, name, x, y, bw, bh, brickFrames);
        // the brick's top-left corner in world space (flip-aware), so frame 0 lands pixel-exact
        const c = toWorld(flip ? x + bw : x, y);
        const img = scene.add.image(Math.round(c.x), Math.round(c.y), key, name).setOrigin(0, 0).setFlipX(flip).setScale(sx, sy).setDepth(depth).setVisible(false);
        const cx = c.x + (bw * sx) / 2;
        const cy = c.y + (bh * sy) / 2;
        const dx = cx - core.x;
        const dy = cy - core.y;
        const d = Math.hypot(dx, dy) || 1;
        const sp = RR(25, 75) * (0.45 + Math.min(1.1, d / 34)) * spd;
        bricks.push({
          img,
          x: Math.round(c.x),
          y: Math.round(c.y),
          vx: (dx / d) * sp + push.x * RR(15, 50) * spd + RR(-10, 10),
          vy: (dy / d) * sp * 0.7 + push.y * RR(10, 35) * spd - RR(M.up[0], M.up[1]),
          life: RR(M.life[0], M.life[1]),
          delay: rnd() * 40,
          floor: floorY + Math.round(RR(-3, 3)),
          phase: rnd() * Math.PI * 2,
          rest: false,
          dead: false,
          tone: -1,
        });
      }
      x += bw;
    }
    y += bh;
  }
  // ---- burst: the sprite is swapped for its bricks (frame 0: all in place, true colours)
  sprite.setVisible(false);
  for (const b of bricks) b.img.setVisible(true);
  try {
    opts.onBurst?.({ x: Math.round(core.x), y: Math.round(core.y) });
  } catch (e) {
    console.error('[shatter] onBurst', e);
  }
  if (M.pitch > 0) {
    try {
      sfx.play('shatter', { volume: 0.85, pitch: M.pitch });
    } catch {
      /* no audio */
    }
  }
  for (let i = 0; i < M.shards; i++) {
    const a = RR(0, Math.PI * 2);
    const v = RR(60, 150) * spd;
    shards.add({ x: core.x + RR(-4, 4), y: core.y + RR(-4, 4), vx: Math.cos(a) * v + push.x * 40, vy: Math.sin(a) * v * 0.7 - 50 + push.y * 30, ay: 400, drag: 1, rot: RR(0, 6), vrot: 0, life: RR(420, 760), colors: M.shardColors, shape: M.shardShape, size: M.shardShape === 'shard' ? RR(2, 3.6) : 1, fadeAt: 1, floor: M.floor ? floorY : undefined, bounce: 0.25 });
  }
  for (let i = 0; i < M.motes; i++) {
    const p = toWorld(bounds.x + rnd() * bounds.w, bounds.y + rnd() * bounds.h);
    motes.add({ x: Math.round(p.x), y: Math.round(p.y), vx: RR(-12, 12), vy: RR(M.moteVy[0], M.moteVy[1]), drag: 0.6, delay: RR(0, 220), life: RR(420, 900), colors: M.moteColors, shape: M.moteShape, size: M.moteShape === 'puff' ? RR(1.5, 3) : 1, flicker: M.moteShape !== 'puff', fadeAt: 1 });
  }
  if (M.ring) {
    shards.add({ x: core.x, y: core.y, life: 260, size: 6, grow: 110, shape: 'ring', colors: M.ring, fadeAt: 1 });
    shards.add({ x: core.x, y: core.y, life: 160, size: 12, grow: -60, shape: 'star', colors: M.ring.slice(0, 2), rot: Math.PI / 4, fadeAt: 1 });
  }
  motes.release();
  shards.release();
  if (M.shake > 0) void shake(scene, 180, M.shake);
  const stopMs = opts.stopMs ?? M.stopMs;
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
          if (b.dead || !b.img.active) continue;
          if (f <= 1 || el < b.delay) {
            alive++;
            continue;
          }
          const age = el - b.delay;
          if (age >= b.life) {
            b.dead = true;
            b.img.destroy();
            continue;
          }
          alive++;
          if (!b.rest) {
            if (M.attract > 0) {
              const dx = sink.x - b.x;
              const dy = sink.y - b.y;
              const dd = Math.hypot(dx, dy);
              if (dd < 3 && age > 80) {
                b.dead = true;
                b.img.destroy();
                continue;
              }
              const k = Math.min(1, age / 220);
              b.vx += (dx / (dd || 1)) * M.attract * k * s;
              b.vy += (dy / (dd || 1)) * M.attract * k * s;
            }
            b.vy += M.gravity * s;
            const damp = Math.exp(-M.drag * s);
            b.vx *= damp;
            if (M.gravity < 0 || M.attract > 0) b.vy *= damp;
            const sway = M.flutter ? Math.sin(age * 0.012 + b.phase) * M.flutter : 0;
            b.x += (b.vx + sway) * s;
            b.y += b.vy * s;
            if (M.floor && b.vy > 0 && b.y >= b.floor) {
              b.y = b.floor;
              if (M.floor === 'splash') {
                shards.add({ x: b.x, y: b.floor - 1, vx: RR(-40, -10), vy: RR(-50, -20), ay: 400, life: RR(120, 220), colors: [PAL.white, PAL.water4], shape: 'px', fadeAt: 1 });
                shards.add({ x: b.x, y: b.floor - 1, vx: RR(10, 40), vy: RR(-50, -20), ay: 400, life: RR(120, 220), colors: [PAL.white, PAL.water4], shape: 'px', fadeAt: 1 });
                b.dead = true;
                b.img.destroy();
                continue;
              }
              if (M.floor === 'bounce' && Math.abs(b.vy) > 45) {
                b.vy = -b.vy * M.bounce;
                b.vx *= 0.5;
              } else {
                b.rest = true;
                b.vx = 0;
                b.vy = 0;
              }
            }
          }
          b.img.setPosition(Math.round(b.x), Math.round(b.y));
          // tones: frame 0 true colours (in place), the flash steps, true colours, the late steps.
          // The flash lights about half of the bricks (by their phase): the burst glints through the
          // breaking body, never as one flat filled silhouette on its first frames
          const t = age / b.life;
          let tone = -1;
          if (f >= 2 && f < 2 + M.flash.length && b.phase < Math.PI) tone = M.flash[f - 2];
          else if (M.late.length && t >= M.lateAt) tone = M.late[Math.min(M.late.length - 1, Math.floor(((t - M.lateAt) / Math.max(0.01, 1 - M.lateAt)) * M.late.length))];
          if (tone !== b.tone) {
            b.tone = tone;
            if (tone < 0) b.img.clearTint();
            else b.img.setTintFill(tone);
          }
          b.img.setVisible(t < M.blinkAt || Math.floor(age / 50) % 2 === 0);
        }
        return alive > 0;
      },
      () => {
        for (const b of bricks) if (b.img.active) b.img.destroy();
        releaseFrames(tex, brickFrames);
        resolve();
      },
    );
  });
}
