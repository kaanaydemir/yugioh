// summon-a shared kit — the stage every signature summon entrance of crystal_wyrm, abyss_magus,
// magma_titan, coral_serpent, ember_wolf and tide_golem is built on, plus the tribute pixel
// stream. Registers nothing itself (the per-monster files and tribute.ts do).
//
// An entrance is straight-line async code on a Stage:
//
//   signatureSummon('crystal_wyrm', async (S) => {
//     ...anticipation on the floor...
//     await S.climax();                 // ace tribute summons: the full-screen cut-in plays HERE
//     ...the reveal (hologram, scanlines)...
//     await S.roar({ peak: 3, onPeak: () => S.finale({ ring: 90 }) });   // roar synced to the art
//   });
//
// runSummon() does the card part first (hand → slam onto the tile; or nothing when the tribute
// choreography already slammed it: hints.noCard; or a tile flash for graveyard / ghost arrivals),
// creates the hidden unit, runs the entrance, and always heals the unit (show, hologram off,
// facing, badge) even if the entrance throws. Everything runs on the scaled scene clock.

import Phaser from 'phaser';
import type { MonsterId } from '../../data/cards';
import type { GameEvent, PlayerId } from '../../engine/types';
import { ATTRIBUTE_RAMP, PAL, PLAYER_COLOR, PLAYER_RAMP, type Ramp } from '../../art/palette';
import { mulberry32 } from '../../art/pixel';
import { AK } from '../../art/arena';
import { monsterAnimKey, monsterFrameName } from '../../art/textures';
import type { MonsterAnim } from '../../art/types';
import { DEPTH, GAME_H, GAME_W, type XY, unitDepth } from '../../view/layout';
import { flash, shake, wait } from '../../vfx/core';
import { E, Raster, Sparks, freeze, onFrame, run } from '../../vfx/setpieces';
import { createMagicCircle, shockwave, type MagicCircleCtl } from '../../vfx/summon';
import { Swarm } from '../../vfx/particles';
import { clearHologram, framePixels, getHologram, holoRamp, opaqueBox, pixelToWorld, setHologram, type HologramParams } from '../../vfx/hologram';
import { cutIn } from '../../vfx/cutin';
import { sfx, type SfxName, type SfxOpts } from '../../audio/sfx';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { CardSprite } from '../../view/CardSprite';
import { fx, registerCardHook, type CinematicContext } from '../api';

export type AnyCtx = CinematicContext<GameEvent>;
export type SummonEv = Extract<GameEvent, { type: 'summon' }>;
export type SummonCtx = CinematicContext<SummonEv>;

export const TAU = Math.PI * 2;
export const ADD = Phaser.BlendModes.ADD;
export { E, Raster, Sparks, Swarm, onFrame, run, freeze };

// ================================================================ random / math

let rand = mulberry32(0x5a11);
/** Re-seed (every summon seeds from its uid so films are repeatable). */
export function seed(n: number): void {
  rand = mulberry32((Math.imul(n | 0, 2654435761) ^ 0x51ab) >>> 0);
}
export const R = (): number => rand();
export const RR = (a: number, b: number): number => a + (b - a) * rand();

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const seg = (t: number, a: number, b: number): number => clamp((t - a) / (b - a), 0, 1);

/** Cheap 1D value noise in [0, 1]. */
export function noise1(x: number, s = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n: number) => {
    const v = Math.sin((n + s * 57.13) * 127.1) * 43758.5453;
    return v - Math.floor(v);
  };
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

/** Fire-and-forget that never throws into a cinematic. */
export function bg(p: Promise<unknown>): void {
  p.catch((e) => console.error('[summon-a]', e));
}

export function playSfx(name: SfxName, opts?: SfxOpts): void {
  try {
    sfx.play(name, opts);
  } catch {
    /* audio is optional */
  }
}

// QA: ?sudbg=1 logs beat timestamps (scene time, ms since the batch's first beat) as warnings,
// which tools/shot.mjs prints.
const DBG = typeof location !== 'undefined' && location.search.includes('sudbg');
let dbg0 = -1;
export function beat(scene: Phaser.Scene, label: string): void {
  if (!DBG) return;
  const now = scene.time.now;
  if (dbg0 < 0 || label === 'start') dbg0 = now;
  console.warn(`[su] ${label} @${Math.round(now - dbg0)}`);
}

/** The prism spectrum (red → violet), all from the palette. */
export const RAINBOW: readonly number[] = [PAL.crim3, PAL.fire3, PAL.gold4, PAL.leaf3, PAL.cyan3, PAL.void3];

// ================================================================ sprite helpers

/** Stop the sprite's animation and show one frame of `anim`. */
export function holdFrame(u: MonsterUnit, anim: MonsterAnim, frame: number): void {
  const s = u.sprite;
  if (!s.active) return;
  const n = u.art.anims[anim].frames;
  s.anims.stop();
  s.setFrame(monsterFrameName(anim, clamp(Math.round(frame), 0, n - 1)));
}

/** Play `anim` from `frame` (one-shot); resolves on completion, then idles (unless hold). */
export function playFrom(u: MonsterUnit, anim: MonsterAnim, frame: number, o: { hold?: boolean } = {}): Promise<void> {
  const s = u.sprite;
  const key = monsterAnimKey(u.cardId, anim);
  if (!s.active || !u.scene.anims.exists(key)) return Promise.resolve();
  const spec = u.art.anims[anim];
  const f0 = clamp(Math.round(frame), 0, spec.frames - 1);
  s.play({ key, repeat: 0, startFrame: f0 });
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
    void wait(u.scene, (((spec.frames - f0) / spec.fps) * 1000) * 1.5 + 200).then(finish);
  });
}

/** Resolve when the sprite's current `anim` reaches `frame` (or after a safety timeout). */
export function untilFrame(u: MonsterUnit, anim: MonsterAnim, frame: number): Promise<void> {
  const s = u.sprite;
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      s.off(Phaser.Animations.Events.ANIMATION_UPDATE, onUpd);
      resolve();
    };
    const onUpd = () => {
      const fi = u.frameInfo();
      if (fi.anim !== anim || fi.frame >= frame) finish();
    };
    const fi = u.frameInfo();
    if (!s.active || fi.anim !== anim || fi.frame >= frame) return finish();
    s.on(Phaser.Animations.Events.ANIMATION_UPDATE, onUpd);
    const spec = u.art.anims[anim];
    void wait(u.scene, ((frame - fi.frame + 1) / spec.fps) * 1000 * 1.5 + 150).then(finish);
  });
}

/** ms per frame of an animation (read from the art at runtime). */
export function frameMs(u: MonsterUnit, anim: MonsterAnim): number {
  return 1000 / u.art.anims[anim].fps;
}

/** Face left/right (keeps the origin on the art anchor). The unit's own facing is u.flipX. */
export function face(u: MonsterUnit, left: boolean): void {
  const a = u.art;
  u.sprite.setFlipX(left);
  u.sprite.setOrigin((left ? a.w - a.anchorX : a.anchorX) / a.w, a.anchorY / a.h);
}

/** A flat-tinted copy of the sprite's current frame that fades out in steps (motion echo). */
export function afterimage(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite, color: number, o: { alpha?: number; ms?: number; depth?: number; add?: boolean } = {}): void {
  if (!s.active || !s.visible) return;
  const img = scene.add
    .image(Math.round(s.x), Math.round(s.y), s.texture.key, s.frame.name)
    .setOrigin(s.originX, s.originY)
    .setFlipX(s.flipX)
    .setScale(s.scaleX, s.scaleY)
    .setTintFill(color)
    .setDepth(o.depth ?? s.depth - 0.2);
  if (o.add !== false) img.setBlendMode(ADD);
  const a0 = o.alpha ?? 0.55;
  img.setAlpha(a0);
  bg(run(scene, o.ms ?? 200, (t) => img.setAlpha(t < 0.34 ? a0 : t < 0.67 ? a0 * 0.55 : a0 * 0.25)).then(() => img.destroy()));
}

/** Opaque world bounds of the unit's sprite (current frame), with a fallback from the art. */
export function bodyBox(u: MonsterUnit): { left: number; right: number; top: number; bottom: number } {
  const b = opaqueBox(u.sprite);
  if (b) return b;
  const s = u.sprite;
  return { left: s.x - u.art.w / 3, right: s.x + u.art.w / 3, top: s.y - u.art.h * 0.8, bottom: s.y };
}

// ================================================================ fx primitives

/** Soft additive glow (arena glow texture). Caller animates / destroys. */
export function softGlow(scene: Phaser.Scene, x: number, y: number, color: number, scale: number, alpha: number, depth: number = DEPTH.FX - 1): Phaser.GameObjects.Image {
  return scene.add.image(Math.round(x), Math.round(y), AK.glow).setBlendMode(ADD).setTint(color).setScale(scale).setAlpha(alpha).setDepth(depth);
}

/** A glow that swells and fades (fire-and-forget). */
export function glowPop(scene: Phaser.Scene, x: number, y: number, color: number, o: { from?: number; to?: number; alpha?: number; ms?: number; depth?: number } = {}): Promise<void> {
  const g = softGlow(scene, x, y, color, o.from ?? 0.4, o.alpha ?? 0.8, o.depth);
  const a0 = o.alpha ?? 0.8;
  return run(scene, o.ms ?? 300, (t) => g.setScale(lerp(o.from ?? 0.4, o.to ?? 2.4, E.outCubic(t))).setAlpha(a0 * (1 - t) * (1 - t))).then(() => g.destroy());
}

/** Iso floor ring helper (floor radius r → ellipse r × r/2). */
export function isoRing(r: Raster, cx: number, cy: number, rad: number, c: number, level = 1, from = 0, to = TAU): void {
  if (rad < 1) return;
  r.ring(cx, cy, rad, rad / 2, c, level, from, to);
}

/** A full-screen flash on the overlay band with stepped fall-off (additive tint). */
export function screenFlash(scene: Phaser.Scene, color: number, alpha: number, ms: number): Promise<void> {
  const r = scene.add.rectangle(0, 0, GAME_W, GAME_H, color, alpha).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.OVERLAY - 1).setBlendMode(ADD);
  return run(scene, ms, (t) => r.setAlpha(alpha * (t < 0.25 ? 1 : t < 0.5 ? 0.6 : t < 0.75 ? 0.3 : 0.12))).then(() => r.destroy());
}

/** Radial burst of sparks (pixel stars) from a point. */
export function sparkBurst(scene: Phaser.Scene, x: number, y: number, ramp: readonly number[], n: number, o: { speed?: number; up?: number; gravity?: number; depth?: number; life?: number; tex?: string } = {}): void {
  const sp = new Sparks(scene, o.depth ?? DEPTH.FX + 2, ADD);
  for (let i = 0; i < n; i++) {
    const a = RR(0, TAU);
    const v = RR(40, 140) * (o.speed ?? 1);
    sp.add({
      x: x + Math.cos(a) * 2,
      y: y + Math.sin(a) * 2,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v * 0.7 - (o.up ?? 0),
      ay: o.gravity ?? 0,
      drag: 2.2,
      life: RR(220, 420) * (o.life ?? 1),
      ramp,
      tex: o.tex,
    });
  }
  sp.close();
}

// ================================================================ geyser (water / lava column)

export interface Geyser {
  /** Shoot up to full height. */
  rise(ms: number): Promise<void>;
  /** The column falls back into the floor from the top (no light thread — it is matter). */
  fall(ms: number): Promise<void>;
  destroy(): void;
}

/**
 * A column of water or lava erupting from the floor point behind the unit: wobbly edges, bands
 * racing up it, a churning crown (foam spray or flame tongues). Falls back down from the top.
 */
export function geyser(S: { scene: Phaser.Scene; home: XY; depth: number }, o: { height: number; width: number; kind: 'water' | 'lava'; depth?: number }): Geyser {
  const sc = S.scene;
  const { x, y } = S.home;
  const H = Math.round(o.height);
  const W = Math.ceil(o.width) + 30;
  const r = new Raster(sc, x - W / 2, y - H - 16, W, H + 24, o.depth ?? S.depth - 1);
  const st = { top: 0, fall: 0, t: 0, alive: true };
  const seed = R() * 40;
  const water = o.kind === 'water';
  const stop = onFrame(sc, (dt) => {
    if (!st.alive) return false;
    st.t += dt;
    const h = H * st.top * (1 - st.fall);
    r.draw((g) => {
      if (h < 1) return;
      const topY = y - h;
      for (let yy = Math.floor(topY); yy <= y; yy++) {
        const k = (y - yy) / Math.max(1, H);
        const n = noise1(yy * 0.18 - st.t * (water ? 0.02 : 0.03), seed);
        let hw = (o.width / 2) * (0.82 + n * 0.36) * (1 + st.fall * 0.5);
        if (yy > y - 6) hw += (6 - (y - yy)) * 0.8; // flared foot
        const tip = (yy - topY) / Math.max(1, Math.min(14, h)); // 0 at the top → 1 below the crown zone
        if (tip < 1) hw *= 0.55 + 0.45 * tip;
        const sway = Math.sin(k * 6 - st.t * 0.006) * 1.2 * k;
        const band = (((yy + st.t * (water ? 0.18 : 0.12)) % 11) + 11) % 11 < 1.3;
        for (let dx = -Math.ceil(hw) - 1; dx <= Math.ceil(hw) + 1; dx++) {
          const ax = Math.abs(dx + 0.5);
          if (ax > hw + 1) continue;
          let c: number;
          let lv = 1;
          if (ax > hw) {
            c = water ? PAL.water2 : PAL.fire2;
            lv = 0.5;
          } else if (water) c = ax < hw * 0.25 ? PAL.white : band ? PAL.white : ax < hw * 0.6 ? PAL.water4 : PAL.water3;
          else c = ax < hw * 0.3 ? PAL.gold4 : band ? PAL.fire4 : ax < hw * 0.65 ? PAL.fire4 : PAL.fire3;
          g.dpx(x + dx + sway, yy, c, lv);
        }
      }
      // the crown
      const cw = o.width / 2 + 5;
      for (let rr = -6; rr <= 3; rr++) {
        const yy = Math.round(topY) + rr;
        const fw = cw * Math.max(0, 1 - ((rr + 1.5) / 5) ** 2);
        for (let dx = -Math.ceil(fw); dx <= Math.ceil(fw); dx++) {
          const nn = noise1((dx + st.t * 0.04) * 0.55, seed + rr * 2.3);
          if (nn < 0.36 + Math.abs(dx) / Math.max(1, fw) * 0.25) continue;
          const c = water ? (nn > 0.62 ? PAL.white : nn > 0.5 ? PAL.water4 : PAL.water3) : nn > 0.62 ? PAL.gold4 : nn > 0.5 ? PAL.fire4 : PAL.fire3;
          g.px(x + dx, yy, c);
        }
      }
    });
    return true;
  });
  const G: Geyser = {
    rise: (ms) => run(sc, ms, (t) => (st.top = E.outCubic(t))),
    async fall(ms) {
      await run(sc, ms, (t) => (st.fall = E.inQuad(t)));
      G.destroy();
    },
    destroy() {
      if (!st.alive) return;
      st.alive = false;
      stop();
      r.destroy();
    },
  };
  return G;
}

// ================================================================ the stage

export interface RoarOpts {
  /** Roar frame of the climax (rear up / jaws wide). Clamped to the art's frame count. */
  peak: number;
  /** Start frame (default 0). */
  from?: number;
  /** Called at the peak frame. */
  onPeak?: () => void;
  /** Sound + how many ms before the peak it starts (its own swell peaks ~0.3 s / ~0.15 s in). */
  sfx?: SfxName;
  volume?: number;
  lead?: number;
}

export interface FinaleOpts {
  /** Floor shock ring radius (default 54, big 90). */
  ring?: number;
  ramp?: Ramp;
  /** Camera shake px (default 2, big 4). */
  shake?: number;
  /** Ace extras: screen flash color, hit-stop. */
  flashColor?: number;
  flashAlpha?: number;
  freezeMs?: number;
  /** Extra ring in the owner's color (default: big). */
  playerRing?: boolean;
  sfx?: SfxName | null;
}

export interface Stage {
  readonly ctx: SummonCtx;
  readonly scene: Phaser.Scene;
  readonly ev: SummonEv;
  readonly unit: MonsterUnit;
  readonly sprite: Phaser.GameObjects.Sprite;
  /** Floor point (tile centre). */
  readonly home: XY;
  /** Sprite resting position (home lifted by hover). */
  readonly rest: XY;
  readonly player: PlayerId;
  /** +1 the monster faces right (player 1), −1 left (player 2). */
  readonly dir: 1 | -1;
  readonly ace: boolean;
  /** Tribute or ace summon: bigger everything. */
  readonly big: boolean;
  readonly tribute: boolean;
  /** Arrived without a card flight from the hand (graveyard / ghost / tribute slam). */
  readonly special: boolean;
  readonly ghost: boolean;
  /** The cut-in will play at climax(). */
  readonly cutIn: boolean;
  readonly ramp: Ramp;
  readonly depth: number;
  circle: MagicCircleCtl | null;
  /** Open the attribute magic circle under the tile (size by `big`). */
  openCircle(o?: { ramp?: Ramp; appearMs?: number }): MagicCircleCtl;
  /** Climax beat: plays the ace cut-in (once) and the "return to the field" impact. */
  climax(): Promise<void>;
  /** Play the roar from `from`, fire the sound ahead of the peak, resolve at the peak frame. */
  roar(o: RoarOpts): Promise<void>;
  /** Final floor shock wave + shake (+ flash / hit-stop for aces) + the ATK/DEF badge pop. */
  finale(o?: FinaleOpts): void;
  /** Register a disposable so a crash mid-entrance never leaves it on screen. */
  own<T extends { destroy(): void }>(o: T): T;
  wait(ms: number): Promise<void>;
  /** Point above the floor at the unit's core height (resting pose). */
  readonly coreRest: XY;
}

function makeStage(ctx: SummonCtx, unit: MonsterUnit, o: { tribute: boolean; special: boolean; ghost: boolean; cutIn: boolean }): Stage & { dispose(): void } {
  const scene = ctx.scene;
  const ev = ctx.ev;
  const ace = fx.isAce(ev.cardId);
  const big = ace || o.tribute;
  const home = unit.home;
  const rest = unit.rest0;
  const owned: { destroy(): void }[] = [];
  let climaxed = false;
  const core = unit.art.core;
  const S: Stage & { dispose(): void } = {
    ctx,
    scene,
    ev,
    unit,
    sprite: unit.sprite,
    home,
    rest,
    player: ev.player,
    dir: unit.flipX ? -1 : 1,
    ace,
    big,
    tribute: o.tribute,
    special: o.special,
    ghost: o.ghost,
    cutIn: o.cutIn,
    ramp: ATTRIBUTE_RAMP[unit.attribute],
    depth: unitDepth(home.y),
    circle: null,
    coreRest: { x: home.x + (unit.flipX ? -1 : 1) * (core.x - unit.art.anchorX), y: rest.y + (core.y - unit.art.anchorY) },
    openCircle(co = {}) {
      const c = createMagicCircle(scene, home.x, home.y, { attribute: unit.attribute, player: ev.player, size: big ? 'big' : 'normal', appearMs: co.appearMs ?? (big ? 300 : 240), ramp: co.ramp });
      S.circle = c;
      owned.push({ destroy: () => void c.dismiss(120) });
      return c;
    },
    async climax() {
      if (climaxed || !o.cutIn) return;
      climaxed = true;
      let p: Promise<void>;
      try {
        p = cutIn(scene, { monsterId: unit.cardId, name: unit.card.name, attribute: unit.attribute, player: ev.player }).catch((e) => {
          console.warn('[summon-a] cut-in failed', e);
        });
      } catch (e) {
        console.warn('[summon-a] cut-in failed', e);
        p = Promise.resolve();
      }
      // the cut-in's white flash-out peaks at ≈1.44 s and the reveal starts right under it
      // (cutIn itself resolves ≈1.55 s); never wait on a broken one forever
      beat(scene, 'cut-in');
      await Promise.race([p, wait(scene, 1480)]);
      beat(scene, 'cut-in done');
    },
    async roar(r) {
      const spec = unit.art.anims.roar;
      const fms = 1000 / spec.fps;
      const from = clamp(r.from ?? 0, 0, spec.frames - 1);
      const peak = clamp(r.peak, from, spec.frames - 1);
      const toPeak = (peak - from) * fms;
      const name = r.sfx ?? (big ? 'roarBig' : 'roarSmall');
      const lead = r.lead ?? (name === 'roarBig' ? 280 : 150);
      const vol = r.volume ?? (big ? 1 : 0.85);
      if (toPeak - lead <= 0) playSfx(name, { volume: vol });
      else bg(wait(scene, toPeak - lead).then(() => playSfx(name, { volume: vol })));
      bg(playFrom(unit, 'roar', from));
      await untilFrame(unit, 'roar', peak);
      beat(scene, 'roar peak');
      try {
        r.onPeak?.();
      } catch (e) {
        console.error('[summon-a] onPeak', e);
      }
    },
    finale(f = {}) {
      const ring = f.ring ?? (big ? 90 : 54);
      const ramp = f.ramp ?? S.ramp;
      bg(shockwave(scene, home.x, home.y, { ramp, radius: ring, ms: big ? 560 : 440, thickness: big ? 8 : 6 }));
      if (f.playerRing ?? big) bg(shockwave(scene, home.x, home.y, { ramp: PLAYER_RAMP[ev.player], radius: Math.round(ring * 0.72), ms: 600, thickness: 3, from: 2 }));
      bg(shake(scene, big ? 280 : 170, f.shake ?? (big ? 4 : 2)));
      if (f.flashColor !== undefined) bg(screenFlash(scene, f.flashColor, f.flashAlpha ?? 0.3, 180));
      if (f.freezeMs) bg(freeze(scene, f.freezeMs));
      if (f.sfx !== null) playSfx(f.sfx ?? 'impactHeavy', { volume: big ? 0.75 : 0.4 });
      bg(unit.badge.pop());
    },
    own(x) {
      owned.push(x);
      return x;
    },
    wait: (ms) => wait(scene, ms),
    dispose() {
      // safety net: anything still alive a while after the entrance (normally all gone by then)
      const list = owned.splice(0);
      bg(
        wait(scene, 2600).then(() => {
          for (const d of list) {
            try {
              d.destroy();
            } catch {
              /* already gone */
            }
          }
        }),
      );
    },
  };
  return S;
}

/**
 * Make a CardSprite safe to destroy right now: CardSprite.setHighlight(null) starts a 120 ms fade
 * whose onComplete calls glowRun.stop() without an active guard, so destroying the card inside
 * that window throws in the tween manager (the hand clears its playable highlights on dispatch).
 */
export function defuseCard(scene: Phaser.Scene, card: CardSprite | null): void {
  if (!card || !card.active) return;
  for (const o of card.inner.list) scene.tweens.killTweensOf(o);
  scene.tweens.killTweensOf(card.inner);
}

/** Unfocus only when the camera is actually zoomed / panned (an idle unfocus still costs time). */
export async function settleCamera(ctx: AnyCtx, ms = 100): Promise<void> {
  const cam = ctx.scene.cameras.main;
  if (Math.abs(cam.zoom - 1) < 0.001 && Math.abs(cam.scrollX) < 0.5 && Math.abs(cam.scrollY) < 0.5) return;
  await ctx.views.camera.unfocus(ms);
}

/** Back to the canonical look (never leaves a hidden / tinted / clipped / mirrored unit). */
function heal(unit: MonsterUnit): void {
  if (unit.retired || !unit.sprite.active) return;
  if (getHologram(unit.sprite)) clearHologram(unit.sprite);
  unit.lift = 0;
  // settle() also shows the sprite and (only if hidden) the badge — never unit.show() here: it
  // would reset the badge mid-pop (StatBadge.setVisible kills the pop tween)
  unit.settle();
}

/**
 * The whole summon: card part (unless the tribute choreography / a spell already placed it),
 * the hidden unit, the signature entrance, then heal. Hints: { tribute, noCard, ghost, cutIn }.
 */
export async function runSummon(ctx: SummonCtx, entrance: (S: Stage) => Promise<void>): Promise<void> {
  const ev = ctx.ev;
  const v = ctx.views;
  const field = v.field;
  seed(ev.uid * 31 + ev.zone * 7 + ev.player);
  beat(ctx.scene, ctx.hints.tribute ? 'summon' : 'start');
  await settleCamera(ctx);
  const hints = ctx.hints as { tribute?: boolean; noCard?: boolean; ghost?: boolean; cutIn?: boolean };
  const atk = ctx.atk(ev.uid, 'next');
  const def = ctx.def(ev.uid, 'next');
  const tribute = ev.method === 'tribute' || !!hints.tribute;
  const fromHand = ev.from === 'hand' && !hints.noCard;
  if (fromHand) {
    const card = fx.takeHandCard(ctx, ev.player, ev.uid, ev.cardId);
    defuseCard(ctx.scene, card);
    void v.duelists?.get(ev.player).play('command');
    ctx.sfx('cardSlam', { volume: 0.8 });
    await fx.slamToZone(ctx, card, { player: ev.player, spot: 'monster', index: ev.zone, uid: ev.uid, cardId: ev.cardId, faceUp: true, ms: 340, shake: 2 });
  } else if (!field.tileOf(ev.uid)) {
    const t = field.placeCard(ev.player, 'monster', ev.zone, ev.uid, ev.cardId, true, 'up');
    t.tileFlash(hints.ghost ? PAL.cyan3 : PLAYER_COLOR[ev.player], 320);
    t.ringBurst(hints.ghost ? PAL.cyan4 : PAL.white, 360);
  }
  const unit = field.addUnit(ev.uid, { hidden: true, atk, def, position: ev.position });
  if (!unit) return;
  unit.badge.setVisible(false);
  unit.sprite.setPosition(unit.rest0.x, unit.rest0.y);
  const ace = fx.isAce(ev.cardId);
  const S = makeStage(ctx, unit, {
    tribute,
    special: !fromHand,
    ghost: !!hints.ghost,
    cutIn: ace && (hints.cutIn ?? tribute),
  });
  try {
    beat(ctx.scene, 'entrance');
    await entrance(S);
    beat(ctx.scene, 'end');
  } finally {
    heal(unit);
    if (!unit.badge.visible) unit.badge.setVisible(true);
    S.dispose();
    if (S.big) void ctx.unfocus(380);
  }
}

/** Register a monster's signature summon (flip summons fall through to the flip handler / defaults). */
export function signatureSummon(id: MonsterId, entrance: (S: Stage) => Promise<void>): void {
  registerCardHook(
    id,
    'summon',
    async (ctx) => {
      if (ctx.ev.from === 'field') return ctx.base();
      await runSummon(ctx, entrance);
    },
    { name: `summon-a:${id}` },
  );
}

// ================================================================ hologram helpers

/** Attach the hologram in an attribute palette, fully revealed (scanlines on). Returns live params. */
export function holo(u: MonsterUnit, ramp: Ramp, o: Partial<HologramParams> = {}): HologramParams {
  const b = opaqueBox(u.sprite);
  const span = b ? { top: b.top - u.sprite.y, bottom: b.bottom - u.sprite.y } : null;
  return setHologram(u.sprite, { reveal: 1, scan: 1, glitch: 0.1, tint: ramp[4], ramp: holoRamp(ramp), tintMix: 1, gain: 0.9, flicker: 0.2, alpha: 1, white: 0, clipY: null, span, ...o });
}

/**
 * Settle a hologram to true colors: one bright frame, then the palette dithers back while the
 * scanlines fade (the "materialize" settle). Removes the pipeline.
 */
export async function settleHolo(scene: Phaser.Scene, u: MonsterUnit, ms = 220): Promise<void> {
  const s = u.sprite;
  if (!s.active) return;
  const P = setHologram(s, {});
  P.white = 0.55;
  await wait(scene, 34);
  P.white = 0;
  const m0 = P.tintMix;
  const s0 = P.scan;
  const g0 = P.glitch;
  const f0 = P.flicker;
  await run(scene, ms, (t) => {
    P.tintMix = m0 * (1 - t);
    P.scan = s0 * (1 - t);
    P.glitch = g0 * (1 - t);
    P.flicker = f0 * (1 - t);
  });
  if (s.active) clearHologram(s);
}

/**
 * A scan bar riding a world y (crisp 1px light line across the body with white edge ticks) —
 * pair it with a clip / reveal edge. Returns a setter and a destroy.
 */
export function scanBar(scene: Phaser.Scene, ramp: Ramp, depth: number): { at(y: number, x0: number, x1: number): void; hide(): void; destroy(): void } {
  const g = scene.add.graphics().setDepth(depth).setBlendMode(ADD);
  return {
    at(y, x0, x1) {
      g.clear();
      const ly = Math.floor(y);
      const a = Math.round(x0) - 5;
      const b = Math.round(x1) + 5;
      g.fillStyle(ramp[4], 0.95).fillRect(a, ly, b - a, 1);
      g.fillStyle(ramp[2], 0.7).fillRect(a + 3, ly + 1, b - a - 6, 1);
      g.fillStyle(PAL.white, 1).fillRect(a - 2, ly, 2, 1).fillRect(b, ly, 2, 1);
    },
    hide() {
      g.clear();
    },
    destroy() {
      g.destroy();
    },
  };
}

// ================================================================ tribute pixel stream

export interface StreamOpts {
  ramp: Ramp;
  /** Live target (the hovering card); read every frame. */
  target: () => XY;
  /** Stream time once the body breaks apart (default 520). */
  ms?: number;
  /** Bend direction of the arc (+1 / −1) so two streams do not overlap. */
  bend?: number;
  /** Called once when the first pixels arrive, and with progress 0..1 as they land. */
  onArrive?: (k: number) => void;
}

/**
 * Tribute: the monster flashes white, shivers as a hologram, then peels into a ribbon of its own
 * pixels (top first) that arcs into the target, cooling into the summon's colours on the way.
 * Hides the sprite (does not destroy it). Resolves when the last pixel lands.
 */
export async function pixelStream(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, o: StreamOpts): Promise<void> {
  const ramp = o.ramp;
  const ms = o.ms ?? 440;
  if (!sprite.active || !sprite.visible) return;
  let allIn: () => void = () => undefined;
  const arrived = new Promise<void>((r) => (allIn = r));
  // anticipation: white silhouette (2 frames), then a hologram shiver lifting off the floor
  const P = setHologram(sprite, { white: 1 });
  await wait(scene, 50);
  Object.assign(P, { white: 0, tint: ramp[4], ramp: holoRamp(ramp), tintMix: 0.45, scan: 1, glitch: 0.5, flicker: 0.3 });
  const y0 = sprite.y;
  await run(scene, 110, (t) => {
    sprite.y = Math.round(y0 - 3 * E.outCubic(t));
    P.tintMix = 0.45 + 0.55 * t;
    P.glitch = 0.5 + 0.4 * t;
  });
  const fp = framePixels(sprite);
  const sw = new Swarm(scene, DEPTH.FX + 6);
  let total = 0;
  let landed = 0;
  if (fp && fp.box) {
    const { x0, y0: fy0, x1, y1 } = fp.box;
    const step = (x1 - x0) * (y1 - fy0) > 2400 ? 2 : 1;
    const hgt = Math.max(1, y1 - fy0);
    const core = pixelToWorld(sprite, (x0 + x1) / 2, (fy0 + y1) / 2);
    const t0 = o.target();
    const bend = o.bend ?? 1;
    // one shared arc so the pixels read as a ribbon, not a cloud
    const dx = t0.x - core.x;
    const dy = t0.y - core.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / d;
    const ny = dx / d;
    const k = Math.min(34, d * 0.35) * bend;
    const ctrl = { x: (core.x + t0.x) / 2 + nx * k, y: Math.min(core.y, t0.y) - 26 + ny * k * 0.5 };
    let i = 0;
    for (let fy = fy0; fy < y1; fy += step) {
      for (let fx = x0; fx < x1; fx += step) {
        const idx = (fy * fp.w + fx) * 4;
        if (fp.data[idx + 3] === 0) continue;
        // keep the hologram look while the pixels wait to peel off: the body's own shading
        // remapped into the summon's ramp (a true-colour flash-back would read as a glitch)
        const lum = (fp.data[idx] * 0.3 + fp.data[idx + 1] * 0.55 + fp.data[idx + 2] * 0.15) / 255;
        const col = lum > 0.62 ? PAL.white : lum > 0.42 ? ramp[4] : lum > 0.24 ? ramp[3] : ramp[2];
        const w = pixelToWorld(sprite, fx + (step - 1) / 2, fy + (step - 1) / 2);
        const order = (fy - fy0) / hgt;
        const delay = order * ms * 0.42 + R() * 40;
        const life = ms * RR(0.46, 0.58);
        const sx = w.x;
        const sy = w.y;
        const jx = RR(-4, 4);
        const jy = RR(-6, 0);
        const mx = ctrl.x + RR(-4, 4);
        const my = ctrl.y + RR(-4, 4);
        const ox = RR(-3, 3);
        const oy = RR(-3, 3);
        const spark = i++ % 6 === 0;
        total++;
        sw.add({
          x: sx,
          y: sy,
          age: -delay,
          life,
          size: step,
          color: col,
          showDelayed: true,
          trail: 3,
          trailColor: ramp[2],
          path: (p, t) => {
            const lift = Math.min(1, t / 0.15);
            const u = Math.max(0, (t - 0.1) / 0.9);
            const e = u * u * (3 - 2 * u);
            const bx = sx + jx * lift;
            const by = sy + jy * lift;
            const tg = o.target();
            const ex = tg.x + ox * (1 - e);
            const ey = tg.y + oy * (1 - e);
            const q = 1 - e;
            p.x = q * q * bx + 2 * q * e * mx + e * e * ex;
            p.y = q * q * by + 2 * q * e * my + e * e * ey;
          },
          paint: (p, t) => {
            p.color = t < 0.3 ? col : t < 0.85 ? ramp[4] : PAL.white;
            if (t > 0.4) p.size = 1;
          },
          onDeath: () => {
            landed++;
            o.onArrive?.(landed / Math.max(1, total));
            if (landed >= total) allIn();
            if (spark) {
              const tg = o.target();
              sw.add({ x: tg.x + RR(-6, 6), y: tg.y + RR(-8, 4), vx: RR(-30, 30), vy: -RR(20, 60), life: 160, color: PAL.white, paint: (q, tt) => (q.color = tt > 0.5 ? ramp[3] : PAL.white) });
            }
          },
        });
      }
    }
  }
  sprite.setVisible(false);
  sprite.y = y0;
  clearHologram(sprite);
  if (total === 0) allIn();
  // resolve when the last pixel lands (the arrival sparkles fade on their own)
  await Promise.race([arrived, wait(scene, ms * 1.5)]);
}

/** Small burst of the player's pixels from a face-down tile (a tributed set monster has no sprite). */
export async function tileStream(scene: Phaser.Scene, from: XY, o: StreamOpts & { n?: number }): Promise<void> {
  const sw = new Swarm(scene, DEPTH.FX + 6);
  const n = o.n ?? 46;
  const ms = o.ms ?? 520;
  const t0 = o.target();
  const ctrl = { x: (from.x + t0.x) / 2, y: Math.min(from.y, t0.y) - 34 };
  let landed = 0;
  for (let i = 0; i < n; i++) {
    const sx = from.x + RR(-16, 16);
    const sy = from.y + RR(-6, 4);
    const delay = (i / n) * ms * 0.4;
    sw.add({
      x: sx,
      y: sy,
      age: -delay,
      life: ms * RR(0.45, 0.58),
      color: o.ramp[3],
      trail: 3,
      trailColor: o.ramp[1],
      path: (p, t) => {
        const e = t * t * (3 - 2 * t);
        const tg = o.target();
        const q = 1 - e;
        p.x = q * q * sx + 2 * q * e * ctrl.x + e * e * tg.x;
        p.y = q * q * sy + 2 * q * e * ctrl.y + e * e * tg.y;
      },
      paint: (p, t) => (p.color = t < 0.6 ? o.ramp[3] : t < 0.85 ? o.ramp[4] : PAL.white),
      onDeath: () => {
        landed++;
        o.onArrive?.(landed / n);
      },
    });
  }
  await Promise.race([sw.done(), wait(scene, ms * 1.5)]);
}
