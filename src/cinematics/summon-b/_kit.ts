// summon-b shared kit: the entrance skeleton and small choreography helpers used by the six
// signature summon entrances in this folder (storm_hawk, stone_sentinel, lumen_sprite,
// shade_assassin, volt_lizard, thorn_lurker) and by the set / flip / position handlers.
// Registers nothing — it is loaded by the cinematics glob but only exports helpers.
//
// entrance(ctx, piece) runs the common frame of every summon (GAME_DESIGN §6 `summon`):
//   0 ms     the card leaves the hand and slams onto the tile (≈220 ms, unless hints.noCard),
//            or (special summon / revived ghost) the card lands with a flash, or (flip summon
//            reached as a summon) the tile flips in place
//   ≈220 ms  piece(e) — the monster's own anticipation, reveal and roar; it calls e.finale()
//            at its impact beat (floor shockwave, dust, 2 px shake, ATK/DEF badge pop)
//   end      the unit is settled to its canonical pose; the camera eases back.
// Monster art is read at RUNTIME (unit.art: anchor, hover, core, muzzle, fps, frame counts) —
// the sprites keep being polished, so nothing here hard-codes frame geometry.

import Phaser from 'phaser';
import type { CardId, MonsterId } from '../../data/cards';
import type { GameEvent, PlayerId } from '../../engine/types';
import { ATTRIBUTE_RAMP, PAL, PLAYER_COLOR, type Ramp } from '../../art/palette';
import { monsterAnimKey, monsterFrameName } from '../../art/textures';
import type { MonsterAnim } from '../../art/types';
import type { SfxName } from '../../audio/sfx';
import { DEPTH, type XY, unitDepth } from '../../view/layout';
import { TEX, shake, wait } from '../../vfx/core';
import { Raster, Sparks, onFrame, run } from '../../vfx/setpieces';
import { landingDust, shockwave } from '../../vfx/summon';
import { clearHologram, getHologram, holoRamp, opaqueBox, setHologram, type HologramParams } from '../../vfx/hologram';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { TileCard } from '../../view/TileCard';
import { fx, type CinematicContext, type EventOf } from '../api';

export { Raster, Sparks, onFrame, run };

export type SummonCtx = CinematicContext<EventOf<'summon'>>;
export type AnyCtx = CinematicContext<GameEvent>;

export const TAU = Math.PI * 2;
export const ADD = Phaser.BlendModes.ADD;
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const clamp01 = (v: number): number => clamp(v, 0, 1);
/** Normalised sub-range of t: 0 before a, 1 after b. */
export const seg = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));

export const E = {
  lin: (t: number) => t,
  inQ: (t: number) => t * t,
  outQ: (t: number) => 1 - (1 - t) * (1 - t),
  inC: (t: number) => t * t * t,
  outC: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutS: (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t),
  inOutQ: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outBack: (t: number, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  /** Damped spring 1 → 0 with one undershoot. */
  spring: (t: number) => Math.cos(t * Math.PI * 2.2) * Math.pow(1 - t, 2.2),
};

// ---------------------------------------------------------------- deterministic random

let seed = 0x5b0b5;
/** Small LCG so films are repeatable (independent of the library random streams). */
export function rnd(): number {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
export const rr = (a: number, b: number): number => a + (b - a) * rnd();
export const ri = (a: number, b: number): number => Math.floor(rr(a, b + 1));
export function reseed(n: number): void {
  seed = (Math.imul(n, 2654435761) >>> 0) || 1;
}

// ---------------------------------------------------------------- vectors

export function qbez(a: XY, c: XY, b: XY, t: number): XY {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

/** Floor point at floor-angle `a`, floor radius `r` around (x, y) (iso 2:1). */
export function onFloor(x: number, y: number, r: number, a: number): XY {
  return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.5 };
}

// ---------------------------------------------------------------- roar sync

/**
 * The frame of each monster's roar that carries the climax (GAME_DESIGN §7 + the art notes):
 * the roar SFX, the shockwave and the badge pop land on it. Clamped to the live frame count.
 */
export const ROAR_PEAK: Partial<Record<MonsterId, number>> = {
  storm_hawk: 3, // wings flung wide, beak open, wind ring
  stone_sentinel: 2, // the shield SLAM
  lumen_sprite: 5, // arms up in a V, big star flash
  shade_assassin: 6, // flourish, eyes flare
  volt_lizard: 3, // reared, jaws wide, crest blazing
  thorn_lurker: 2, // the pod bursts open
  crystal_wyrm: 3,
  abyss_magus: 3,
  magma_titan: 3,
  coral_serpent: 3,
  ember_wolf: 3,
  tide_golem: 3,
};

export function roarPeak(u: MonsterUnit): number {
  const n = u.art.anims.roar.frames;
  return clamp(ROAR_PEAK[u.cardId] ?? Math.round(n * 0.35), 0, n - 1);
}

/** ms from frame `from` to frame `to` of `anim` (live fps). */
export function frameMs(u: MonsterUnit, anim: MonsterAnim, from: number, to: number): number {
  return ((to - from) / u.art.anims[anim].fps) * 1000;
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
export function playFrom(u: MonsterUnit, anim: MonsterAnim, from = 0, o: { hold?: boolean } = {}): Promise<void> {
  const s = u.sprite;
  const key = monsterAnimKey(u.cardId, anim);
  if (!s.active || !u.scene.anims.exists(key)) return Promise.resolve();
  const spec = u.art.anims[anim];
  s.anims.timeScale = 1;
  s.play({ key, repeat: 0, startFrame: clamp(from, 0, spec.frames - 1) });
  return new Promise<void>((resolve) => {
    let done = false;
    const fin = (rest: boolean) => {
      if (done) return;
      done = true;
      s.off(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + key, onDone);
      if (rest && !o.hold && !u.retired && s.active) {
        const cur = u.frameInfo().anim;
        // only return to the loop if nobody started another one-shot meanwhile
        if (cur === anim) u.rest();
      }
      resolve();
    };
    const onDone = () => fin(true);
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + key, onDone);
    const ms = ((spec.frames - from) / spec.fps) * 1000;
    void wait(u.scene, ms * 1.6 + 250).then(() => fin(false));
  });
}

/**
 * Resolve when the sprite's running `anim` reaches `frame` (0-based). Call it right AFTER
 * starting the animation. Resolves at once if already there, and on any change of animation.
 */
export function whenFrame(u: MonsterUnit, anim: MonsterAnim, frame: number): Promise<void> {
  const s = u.sprite;
  const key = monsterAnimKey(u.cardId, anim);
  return new Promise<void>((resolve) => {
    let done = false;
    const fin = () => {
      if (done) return;
      done = true;
      if (s.active) {
        s.off(Phaser.Animations.Events.ANIMATION_UPDATE, onUpd);
        s.off(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + key, fin);
      }
      resolve();
    };
    const onUpd = (a: Phaser.Animations.Animation, f: Phaser.Animations.AnimationFrame) => {
      if (a.key !== key) return fin();
      if (f.index - 1 >= frame) fin();
    };
    if (!s.active) return fin();
    const cur = u.frameInfo();
    if (cur.anim === anim && cur.frame >= frame) return fin();
    s.on(Phaser.Animations.Events.ANIMATION_UPDATE, onUpd);
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + key, fin);
    const spec = u.art.anims[anim];
    void wait(u.scene, ((frame + 1) / spec.fps) * 1000 * 1.6 + 300).then(fin);
  });
}

export interface RoarOpts {
  /** First frame (skip the gather when the entrance already did it). Default 0. */
  from?: number;
  /** Climax frame (default: the ROAR_PEAK table). */
  peak?: number;
  /** Sound on the climax (default roarSmall; null = none). */
  sfx?: SfxName | null;
  volume?: number;
  pitch?: number;
  onPeak?: () => void;
}

/** Play the roar; `peak` resolves on its climax frame (sound + onPeak there), `done` at the end. */
export function roar(ctx: AnyCtx, u: MonsterUnit, o: RoarOpts = {}): { peak: Promise<void>; done: Promise<void> } {
  const pk = o.peak ?? roarPeak(u);
  const done = playFrom(u, 'roar', o.from ?? 0);
  const peak = whenFrame(u, 'roar', pk).then(() => {
    if (o.sfx !== null) ctx.sfx(o.sfx ?? 'roarSmall', { volume: o.volume ?? 0.8, pitch: o.pitch ?? 1 });
    try {
      o.onPeak?.();
    } catch (e) {
      console.error('[summon-b] onPeak', e);
    }
  });
  return { peak, done };
}

// ---------------------------------------------------------------- sprite helpers

/** +1 when the unit faces right (player 1), −1 when mirrored (player 2). */
export function facing(u: MonsterUnit): 1 | -1 {
  return u.player === 1 ? -1 : 1;
}

/** A static copy of the sprite's current frame (afterimage / ghost / glow body). */
export function ghostOf(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite, o: { color?: number; alpha?: number; depth?: number; add?: boolean } = {}): Phaser.GameObjects.Image {
  const img = scene.add.image(s.x, s.y, s.texture.key, s.frame.name);
  img.setOrigin(s.originX, s.originY).setFlipX(s.flipX).setScale(s.scaleX, s.scaleY).setAngle(s.angle);
  img.setDepth(o.depth ?? s.depth - 0.5);
  if (o.color !== undefined) img.setTintFill(o.color);
  img.setAlpha(o.alpha ?? 1);
  if (o.add) img.setBlendMode(ADD);
  return img;
}

/** Fading tinted afterimages dropped every `every` ms while `active()` is true. */
export function afterTrail(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite, o: { colors: readonly number[]; every?: number; life?: number; alpha?: number; active: () => boolean }): Promise<void> {
  const every = o.every ?? 40;
  const life = o.life ?? 180;
  const a0 = o.alpha ?? 0.55;
  const gs: { img: Phaser.GameObjects.Image; age: number }[] = [];
  let acc = every;
  let k = 0;
  return new Promise((resolve) => {
    onFrame(scene, (dt) => {
      const on = o.active() && s.active;
      if (on && s.visible) {
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
          continue;
        }
        // stepped fade (no smooth alpha ramps in pixel art)
        g.img.setAlpha(a0 * (t < 0.34 ? 1 : t < 0.67 ? 0.55 : 0.25));
      }
      if (!on && gs.length === 0) {
        resolve();
        return false;
      }
      return true;
    });
  });
}

/** World-space opaque box of the sprite's current frame (null when nothing is drawn). */
export function bodyBox(s: Phaser.GameObjects.Sprite): { left: number; right: number; top: number; bottom: number; cx: number; cy: number; w: number; h: number } | null {
  const b = opaqueBox(s);
  if (!b) return null;
  return { ...b, cx: (b.left + b.right) / 2, cy: (b.top + b.bottom) / 2, w: b.right - b.left, h: b.bottom - b.top };
}

/**
 * Attach the hologram with an explicit reveal span measured on the CURRENT frame (so poses that
 * change while revealing do not shift the scan line). Returns the live params.
 */
export function holo(s: Phaser.GameObjects.Sprite, ramp: Ramp, p: Partial<HologramParams> = {}): HologramParams {
  const b = opaqueBox(s);
  const span = b ? { top: b.top - s.y, bottom: b.bottom - s.y } : null;
  return setHologram(s, { reveal: 1, scan: 1, glitch: 0.1, tint: ramp[4], ramp: holoRamp(ramp), tintMix: 1, gain: 1.1, flicker: 0.25, alpha: 1, white: 0, clipY: null, span, ...p });
}

/** Dither the hologram palette back to the true colours, then remove the pipeline. */
export async function holoSettle(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite, ms = 220, flashWhite = true): Promise<void> {
  const pipe = getHologram(s);
  if (!pipe) return;
  const P = pipe.params;
  const tm = P.tintMix;
  const sc = P.scan;
  const fl = P.flicker;
  const gl = P.glitch;
  if (flashWhite) {
    P.white = 0.6;
    await wait(scene, 34);
    P.white = 0;
  }
  await run(scene, ms, (t) => {
    P.tintMix = tm * (1 - t);
    P.scan = sc * (1 - t);
    P.flicker = fl * (1 - t);
    P.glitch = gl * (1 - t);
  });
  if (s.active) clearHologram(s);
}

// ---------------------------------------------------------------- card slam (crash-safe)

/**
 * The hand card flies to a zone and slams onto it as a TileCard (field-registered, created
 * synchronously so the unit can be added at once). Unlike fx.slamToZone the CardSprite is NOT
 * destroyed at once: HandView.takeCard just ran setHighlight(null), whose 120 ms fade tween
 * calls glowRun.stop() in onComplete — on a destroyed sprite that throws inside the game loop
 * and kills the RAF loop. The sprite is hidden now and destroyed 260 ms later instead.
 * Returns the tile and the slam promise (impact at 74 % of `ms`).
 */
export function slamCard(
  ctx: AnyCtx,
  o: { player: PlayerId; spot: 'monster' | 'spellTrap'; index: number; uid: number; cardId: CardId; faceUp: boolean; orientation: 'up' | 'side'; ms: number; shake?: number; impact?: boolean; faceDownFlight?: boolean },
): { tile: TileCard; done: Promise<void> } {
  const card = fx.takeHandCard(ctx, o.player, o.uid, o.faceDownFlight ? null : o.cardId);
  if (o.faceDownFlight) card.setFaceUp(false);
  const from = { x: card.x, y: card.y };
  const scale = card.scaleX;
  card.setVisible(false);
  void wait(ctx.scene, 260).then(() => {
    if (card.active) card.destroy();
  });
  const tile = ctx.views.field.placeCard(o.player, o.spot, o.index, o.uid, o.cardId, o.faceUp, o.orientation);
  const done = tile.slamIn(from, o.ms, { fromScale: scale, shake: o.shake ?? 0, impact: o.impact ?? true }).catch((e) => console.error('[summon-b] slam', e));
  return { tile, done };
}

// ---------------------------------------------------------------- the entrance skeleton

export interface Entrance {
  ctx: SummonCtx;
  scene: Phaser.Scene;
  unit: MonsterUnit;
  sprite: Phaser.GameObjects.Sprite;
  /** Tile centre (floor point). */
  home: XY;
  /** Resting sprite position (origin on the art anchor, lifted by hover). */
  rest: XY;
  /** +1 facing right (P1), −1 mirrored (P2). */
  dir: 1 | -1;
  player: PlayerId;
  ramp: Ramp;
  tile: TileCard | null;
  /** Tribute / special summon: a little more weight. */
  big: boolean;
  /** Special summon (revived from a graveyard). */
  revived: boolean;
  /** The card slam already happened (false for noCard / revived / from field). */
  slammed: boolean;
  /** Impact beat: floor shockwave + dust + shake + ATK/DEF badge pop. Runs once. */
  finale(o?: FinaleOpts): void;
  readonly finaled: boolean;
}

export interface FinaleOpts {
  ramp?: Ramp;
  radius?: number;
  shake?: number;
  dust?: number | null;
  sfx?: SfxName | null;
  volume?: number;
}

/**
 * Run a signature summon: the card arrival (slam / flash / flip), a hidden unit, then `piece`
 * (which reveals the monster and calls e.finale() on its impact beat), then a clean settle.
 */
export async function entrance(ctx: SummonCtx, piece: (e: Entrance) => Promise<void>, opts: { seed?: number } = {}): Promise<void> {
  const ev = ctx.ev;
  const v = ctx.views;
  const field = v.field;
  const sc = ctx.scene;
  reseed(opts.seed ?? ev.uid * 31 + ev.zone);
  void v.camera.unfocus(120);
  const atk = ctx.atk(ev.uid, 'next');
  const def = ctx.def(ev.uid, 'next');
  let slam: Promise<unknown> = Promise.resolve();
  let slammed = false;
  if (ev.from === 'field') {
    // a flip summon that reached the summon handler directly: turn the card over in place
    let t = field.tileOf(ev.uid);
    if (!t) t = field.placeCard(ev.player, 'monster', ev.zone, ev.uid, ev.cardId, false, 'side');
    t.setCard(ev.cardId);
    if (!t.faceUp) {
      ctx.sfx('flipReveal', { volume: 0.8 });
      await t.flipUp(320);
    }
    if (t.orientation !== 'up') await t.rotateTo('up', 240);
  } else if (ev.from === 'hand' && !ctx.hints.noCard) {
    void v.duelists?.get(ev.player).play('command');
    ctx.sfx('cardSlam', { volume: 0.8 });
    const MS = 300;
    slam = slamCard(ctx, { player: ev.player, spot: 'monster', index: ev.zone, uid: ev.uid, cardId: ev.cardId, faceUp: true, orientation: 'up', ms: MS, shake: 2 }).done;
    // the slam lands at 74 % of the flight: the floor anticipation starts on the impact
    await ctx.wait(Math.round(MS * 0.74));
    slammed = true;
  } else {
    let t = field.tileOf(ev.uid);
    const col = ctx.hints.ghost || ev.from === 'graveyard' ? PAL.cyan3 : PLAYER_COLOR[ev.player];
    if (!t) {
      t = field.placeCard(ev.player, 'monster', ev.zone, ev.uid, ev.cardId, true, 'up');
      t.tileFlash(col, 320);
      t.ringBurst(PAL.white, 360);
    } else {
      t.setCard(ev.cardId);
      if (!t.faceUp) await t.flipUp(300);
      if (t.orientation !== 'up') await t.rotateTo('up', 220);
    }
  }
  const unit = field.addUnit(ev.uid, { hidden: true, atk, def, position: ev.position });
  if (!unit) {
    await slam;
    return;
  }
  const s = unit.sprite;
  const rest = unit.rest0;
  unit.hide();
  unit.posed = true;
  s.setPosition(rest.x, rest.y);
  let finaled = false;
  const home = unit.home;
  const ramp = ATTRIBUTE_RAMP[unit.attribute];
  const e: Entrance = {
    ctx,
    scene: sc,
    unit,
    sprite: s,
    home,
    rest,
    dir: facing(unit),
    player: ev.player,
    ramp,
    tile: field.tileOf(ev.uid),
    big: ev.method === 'tribute',
    revived: ev.from === 'graveyard',
    slammed,
    get finaled() {
      return finaled;
    },
    finale(o: FinaleOpts = {}) {
      if (finaled) return;
      finaled = true;
      const r = o.ramp ?? ramp;
      void shockwave(sc, home.x, home.y, { ramp: r, radius: o.radius ?? 54, ms: 420, thickness: 6 });
      if (o.dust !== null) void landingDust(sc, home.x, home.y, o.dust ?? PAL.stone3, { count: 7 });
      const k = o.shake ?? 2;
      if (k > 0) void shake(sc, 160, k);
      if (o.sfx !== null) ctx.sfx(o.sfx ?? 'impactHeavy', { volume: o.volume ?? 0.35 });
      unit.badge.setVisible(true);
      void unit.badge.pop();
    },
  };
  // the camera leans in a touch toward the tile while the monster arrives (bible: 1.0 → 1.08)
  void ctx.focus({ x: home.x, y: home.y - 28 }, { zoom: e.big ? 1.06 : 1.04, ms: 420, pan: 0.22 });
  try {
    await piece(e);
  } finally {
    e.finale({ sfx: null, shake: 0, dust: null });
    unit.posed = false;
    unit.lift = 0;
    if (s.active && !unit.retired) {
      if (getHologram(s)) clearHologram(s);
      const roaring = s.anims.isPlaying && unit.frameInfo().anim === 'roar';
      s.setPosition(rest.x, rest.y).setScale(1).setAngle(0).setAlpha(1).setVisible(true);
      s.setCrop();
      if (s.isTinted) s.clearTint();
      s.setDepth(unitDepth(home.y));
      unit.show();
      if (!roaring && !s.anims.isPlaying) unit.rest();
    }
  }
  await slam;
  void v.camera.unfocus(320);
}

// ---------------------------------------------------------------- floor pieces

/** A world-space raster layer redrawn every frame by `draw` until stop() (fade handled by caller). */
export function liveLayer(scene: Phaser.Scene, cx: number, cy: number, w: number, h: number, depth: number, draw: (r: Raster, el: number, dt: number) => void, blend?: number): { r: Raster; stop(): void } {
  const r = Raster.around(scene, cx, cy, w, h, depth, blend);
  let alive = true;
  const stopTick = onFrame(scene, (dt, el) => {
    if (!alive || !r.alive) return false;
    r.draw((rr0) => draw(rr0, el, dt));
    return true;
  });
  return {
    r,
    stop() {
      alive = false;
      stopTick();
      r.destroy();
    },
  };
}

/** A crisp iso diamond around a tile, in world coords (for set pulses / glyph frames). */
export function diamond(cx: number, cy: number, hw: number, hh: number): XY[] {
  return [
    { x: cx, y: cy - hh },
    { x: cx + hw, y: cy },
    { x: cx, y: cy + hh },
    { x: cx - hw, y: cy },
  ];
}

/** Draw a closed polyline. */
export function loop(r: Raster, pts: readonly XY[], c: number, level = 1): void {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    r.line(a.x, a.y, b.x, b.y, c, level);
  }
}

/** Hexagon (pointy top) of half-width w / half-height h. */
export function hexPts(cx: number, cy: number, w: number, h: number): XY[] {
  const out: XY[] = [];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * TAU) / 6;
    out.push({ x: cx + Math.cos(a) * w, y: cy + Math.sin(a) * h });
  }
  return out;
}

/** 4-point star sparkle (pixel-crisp): arm length l. */
export function star(r: Raster, x: number, y: number, l: number, core: number, arm: number, level = 1): void {
  const X = Math.round(x);
  const Y = Math.round(y);
  for (let i = 1; i <= l; i++) {
    const c = i <= Math.ceil(l / 3) ? core : arm;
    r.dpx(X + i, Y, c, level);
    r.dpx(X - i, Y, c, level);
    r.dpx(X, Y + i, c, level);
    r.dpx(X, Y - i, c, level);
  }
  r.dpx(X, Y, PAL.white, level);
  if (l >= 3) {
    r.dpx(X + 1, Y + 1, arm, level * 0.6);
    r.dpx(X - 1, Y - 1, arm, level * 0.6);
    r.dpx(X + 1, Y - 1, arm, level * 0.6);
    r.dpx(X - 1, Y + 1, arm, level * 0.6);
  }
}

/** Small spark burst helper (setpieces Sparks), closed at once. */
export function burst(scene: Phaser.Scene, x: number, y: number, n: number, o: { ramp: readonly number[]; speed?: [number, number]; up?: number; gravity?: number; life?: [number, number]; depth?: number; spread?: [number, number]; tex?: string; drag?: number; blend?: number }): void {
  const sp = new Sparks(scene, o.depth ?? DEPTH.FX, o.blend);
  const [s0, s1] = o.speed ?? [40, 110];
  const [l0, l1] = o.life ?? [220, 420];
  const [a0, a1] = o.spread ?? [0, TAU];
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * rnd();
    const v = rr(s0, s1);
    sp.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 - (o.up ?? 0), ay: o.gravity ?? 0, drag: o.drag ?? 2, life: rr(l0, l1), ramp: o.ramp, tex: o.tex ?? (rnd() < 0.3 ? TEX.px2 : TEX.px1) });
  }
  sp.close();
}

/** Wait for a promise but never longer than `ms` (scene time). */
export function capped(scene: Phaser.Scene, p: Promise<unknown>, ms: number): Promise<void> {
  return Promise.race([p.then(() => undefined, () => undefined), wait(scene, ms)]);
}

/** Fire-and-forget with error logging. */
export function bg(p: Promise<unknown>): void {
  p.catch((e) => console.error('[summon-b]', e));
}
