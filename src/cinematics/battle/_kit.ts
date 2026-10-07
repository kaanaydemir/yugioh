// Shared helpers of the traps + battle cinematics (src/cinematics/battle, src/cinematics/traps).
// No registrations here — this module is only imported by the handler files.
//
//   AttackHold         the attack declaration kept across events / a trap decision ('attack')
//   guardRemap(u)      a DEFENSE-position unit never snaps into its upright 'hit' pose
//   guardReact(...)    the guard-pose hit: white flash, 2–3 px knock-back, hex-shield glint, hit-stop
//   setCardPulse(...)  the defender's set cards breathing magenta while a trap window is open

import Phaser from 'phaser';
import type { GameEvent, GameEventType, PlayerId } from '../../engine/types';
import { PAL, RAMPS, type Ramp } from '../../art/palette';
import { monsterAnimKey, monsterFrameName } from '../../art/textures';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { Disposable, DuelViews } from '../../duel/types';
import type { TileCard } from '../../view/TileCard';
import { DEPTH, type XY, unitDepth } from '../../view/layout';
import { tween, wait } from '../../vfx/core';
import { impact as combatImpact, stopTime, whiteFlash } from '../../vfx/combat';
import { Raster, Sparks, onFrame, run } from '../../vfx/setpieces';
import type { CinematicContext } from '../api';

export type EvOf<T extends GameEventType> = Extract<GameEvent, { type: T }>;
export type Ctx<T extends GameEventType> = CinematicContext<EvOf<T>>;
export type AnyCtx = CinematicContext<GameEvent>;

export const TAU = Math.PI * 2;
export const ADD = Phaser.BlendModes.ADD;

// ================================================================ tiny math

export const sub = (a: XY, b: XY): XY => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: XY, b: XY): XY => ({ x: a.x + b.x, y: a.y + b.y });
export const mul = (a: XY, k: number): XY => ({ x: a.x * k, y: a.y * k });
export const len = (a: XY): number => Math.hypot(a.x, a.y);
export const norm = (a: XY): XY => {
  const l = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / l, y: a.y / l };
};
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const lerpXY = (a: XY, b: XY, t: number): XY => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
export const rint = (p: XY): XY => ({ x: Math.round(p.x), y: Math.round(p.y) });

let seedState = 0x2545f491;
export function seed(n: number): void {
  seedState = (n * 2654435761) >>> 0 || 1;
}
export function rnd(): number {
  seedState = (seedState * 1664525 + 1013904223) >>> 0;
  return seedState / 4294967296;
}
export const rr = (a: number, b: number): number => a + (b - a) * rnd();

export const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);

/** Wait for every promise, never reject (errors are logged). */
export async function all(ps: Promise<unknown>[]): Promise<void> {
  await Promise.all(ps.map((p) => p.catch((e) => console.error('[traps-battle]', e))));
}

/** A visible, live unit or null. */
export function live(u: MonsterUnit | null | undefined): MonsterUnit | null {
  return u && !u.retired && u.sprite.active && u.sprite.visible ? u : null;
}

/** Stop the sprite's animation and show one frame of an anim (clamped). */
export function holdFrame(u: MonsterUnit, anim: 'idle' | 'attack' | 'roar' | 'hit' | 'guard', frame: number): void {
  const s = u.sprite;
  if (!s.active) return;
  const n = u.art.anims[anim].frames;
  s.anims.stop();
  s.setFrame(monsterFrameName(anim, Math.max(0, Math.min(n - 1, Math.round(frame)))));
}

// ================================================================ the attack declaration hold

/**
 * What attackDeclare keeps under ctx.keep('attack'): the arrow + lock-on + the attacker's coiled
 * wind-up pose. Other handlers (battle, the traps, attackNegated) take it back with
 * ctx.take('attack'); `release(ms)` eases the attacker out of the coil, `shatter()` breaks the
 * arrow and reticle apart (a negated attack), `destroy()` removes everything at once.
 */
export interface AttackHold extends Disposable {
  readonly kind: 'attackHold';
  readonly attackerUid: number;
  readonly targetUid: number | null;
  readonly player: PlayerId;
  /** Arrow start (attacker core) and end (target core / duelist). */
  readonly from: XY;
  readonly to: XY;
  /** Fade the arrow + reticle out (keeps the attacker coiled). */
  dropMarks(): void;
  /** The arrow + reticle shatter into sparks (the attack is negated). */
  shatterMarks(): void;
  /** Ease the attacker back to rest over `ms` (then the hold is done). */
  release(ms?: number): Promise<void>;
}

export function isHold(h: Disposable | null): h is AttackHold {
  return !!h && (h as Partial<AttackHold>).kind === 'attackHold';
}

/** Take the kept attack declaration (an AttackHold from battle/declare.ts, or the default's handle). */
export function takeAttack(ctx: AnyCtx | CinematicContext<never>): { hold: AttackHold | null; other: Disposable | null } {
  const h = (ctx as AnyCtx).take('attack');
  if (!h) return { hold: null, other: null };
  return isHold(h) ? { hold: h, other: null } : { hold: null, other: h };
}

// ================================================================ guard pose: never snap into 'hit'

const PATCHED = new WeakSet<object>();
type PlayFn = (key: string | Phaser.Types.Animations.PlayAnimationConfig, ignoreIfPlaying?: boolean) => Phaser.GameObjects.Sprite;
type SetFrameFn = (frame: string | number | Phaser.Textures.Frame, updateSize?: boolean, updateOrigin?: boolean) => Phaser.GameObjects.Sprite;

/**
 * Art-review rule: a DEFENSE-position monster that takes a hit never snaps from its guard pose
 * into the upright 'hit' recoil. Patches this unit's sprite (once): while the unit is in defense
 * position, playing its 'hit' anim keeps the guard pose (completion is still reported on time so
 * awaiting code moves on), and showing a 'hit:N' frame shows the current guard frame instead.
 * Attack-position units are untouched; the check is made at call time.
 */
export function guardRemap(u: MonsterUnit): void {
  const s = u.sprite;
  if (!s.active || PATCHED.has(s)) return;
  PATCHED.add(s);
  const hitKey = monsterAnimKey(u.cardId, 'hit');
  const guardKey = monsterAnimKey(u.cardId, 'guard');
  const origPlay = s.play as unknown as PlayFn;
  const origSetFrame = s.setFrame as unknown as SetFrameFn;
  const guarding = () => u.position === 'defense' && !u.retired && u.scene.anims.exists(guardKey);
  const guardFrame = () => {
    const f = String(s.frame?.name ?? '');
    return f.startsWith('guard:') ? f : monsterFrameName('guard', 0);
  };
  const patched = s as unknown as { play: PlayFn; setFrame: SetFrameFn };
  patched.setFrame = function (this: Phaser.GameObjects.Sprite, frame, updateSize, updateOrigin) {
    if (guarding()) {
      const name = typeof frame === 'string' ? frame : frame instanceof Phaser.Textures.Frame ? String(frame.name) : null;
      if (name && name.startsWith('hit:')) frame = guardFrame();
    }
    return origSetFrame.call(this, frame, updateSize, updateOrigin);
  };
  patched.play = function (this: Phaser.GameObjects.Sprite, key, ignoreIfPlaying) {
    const k = typeof key === 'string' ? key : key?.key;
    if (k === hitKey && guarding()) {
      // stay in guard; keep its loop breathing if nothing else holds a frame
      if (!this.anims.isPlaying || String(this.frame?.name ?? '').indexOf('guard:') !== 0) origPlay.call(this, { key: guardKey, repeat: -1 });
      const spec = u.art.anims.hit;
      const ms = (spec.frames / Math.max(1, spec.fps)) * 1000;
      const anim = u.scene.anims.get(hitKey);
      u.scene.time.delayedCall(ms, () => {
        if (this.active) this.emit(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + hitKey, anim, anim?.frames[anim.frames.length - 1], this, '');
      });
      return this;
    }
    return origPlay.call(this, key, ignoreIfPlaying);
  };
}

/** Patch every unit on the field (cheap; idempotent). */
export function guardRemapAll(views: DuelViews): void {
  try {
    for (const e of views.field.tiles()) if (e.unit) guardRemap(e.unit);
  } catch {
    /* never break an event over cosmetics */
  }
}

/**
 * A defense-position monster takes a blow WITHOUT leaving its guard pose: impact sparks + shake,
 * a 1–2 frame white silhouette, a hex-shield glint on the side the blow came from, a hit-stop,
 * then a 2–3 px knock-back along the blow. `survive` springs it back home; otherwise it stays
 * pushed (the shatter follows). Resolves after the knock-back beat (~0.2–0.35 s).
 */
export async function guardReact(
  ctx: AnyCtx | CinematicContext<never>,
  u: MonsterUnit,
  o: { power: 1 | 2 | 3; dir?: XY; at?: XY; ramp?: Ramp; survive: boolean; noStop?: boolean },
): Promise<void> {
  const sc = (ctx as AnyCtx).scene;
  if (!live(u)) return;
  guardRemap(u);
  const s = u.sprite;
  const dir = norm(o.dir ?? { x: u.player === 0 ? -1 : 1, y: u.player === 0 ? 0.5 : -0.5 });
  const core = u.core();
  const at = o.at ?? core;
  // the guard frame stays; make sure it is the guard loop that shows (never 'hit')
  const cur = String(s.frame?.name ?? '');
  if (!cur.startsWith('guard:')) void u.play('guard');
  // sparks / star / ring + camera shake (our own hit-stop below)
  void combatImpact(sc, at.x, at.y, { power: o.power, ramp: o.ramp, dir, noStop: true });
  void whiteFlash(sc, s, o.power >= 3 ? 3 : 2);
  // hex-shield glint on the face the blow came from
  const glint = { x: core.x - dir.x * 7, y: core.y - dir.y * 7 - 2 };
  void hexGlint(sc, glint.x, glint.y, -dir.x, o.survive ? PAL.water3 : PAL.water2);
  if (!o.noStop) await stopTime(sc, [0, 60, 80, 100][o.power]);
  if (!s.active) return;
  // knock-back 2–3 px (integer), along the blow
  const k = o.power >= 2 ? 3 : 2;
  const r0 = u.rest0;
  const kb = { x: Math.round(r0.x + dir.x * k), y: Math.round(r0.y + dir.y * k * 0.6) };
  u.posed = true;
  sc.tweens.killTweensOf(s);
  await tween(sc, { targets: s, x: kb.x, y: kb.y, duration: 60, ease: 'Quad.Out' });
  if (o.survive) {
    await tween(sc, { targets: s, x: r0.x, y: r0.y, duration: 240, ease: 'Back.Out' });
    if (s.active) s.setPosition(r0.x, r0.y);
    u.posed = false;
  }
}

/**
 * Hexagonal shield glint (pixel raster, ~360 ms): a flattened hexagon facing `face` (−1 left /
 * +1 right) flashes white, its rim ripples blue, a light streak runs across it, then it breaks up.
 */
export function hexGlint(scene: Phaser.Scene, x: number, y: number, face: number, color: number = PAL.water3, ms = 360): Promise<void> {
  x = Math.round(x);
  y = Math.round(y);
  const ras = Raster.around(scene, x, y, 56, 64, DEPTH.FX + 2, ADD);
  const R = 15;
  const sq = 0.55;
  const hexPts = (r: number): XY[] => {
    const pts: XY[] = [];
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6;
      pts.push({ x: x + Math.cos(a) * r * sq, y: y + Math.sin(a) * r });
    }
    return pts;
  };
  return run(scene, ms, (t) => {
    ras.draw((g) => {
      const grow = t < 0.2 ? 0.7 + (t / 0.2) * 0.35 : 1.05 - (t - 0.2) * 0.08;
      const lv = t < 0.15 ? 1 : 1 - (t - 0.15) / 0.85;
      const r = R * grow;
      const outer = hexPts(r);
      if (t < 0.1) g.poly(outer, PAL.white, 0.5);
      g.path(outer, t < 0.15 ? PAL.white : color, lv);
      g.path(hexPts(r - 3), t < 0.25 ? PAL.water4 : RAMPS.water[2], lv * 0.7);
      // inner honeycomb seams
      if (t < 0.5) {
        const inner = hexPts(r * 0.45);
        for (let i = 0; i < 6; i++) g.line(inner[i].x, inner[i].y, outer[i].x, outer[i].y, color, lv * 0.45);
      }
      // a light streak sweeping across the plate
      const sx = x + lerp(-r * sq, r * sq, clamp01(t * 2.2)) * (face >= 0 ? 1 : -1);
      if (t < 0.45) g.line(sx - 2, y - r * 0.7, sx + 2, y + r * 0.7, PAL.white, 1 - t * 2);
    });
  }).then(() => ras.destroy());
}

// ================================================================ trap window: set cards breathe

/**
 * While a trap response is pending: every face-down spell/trap card of `player` breathes magenta
 * (repeated pulses + rising motes). All set cards pulse, not only the eligible traps, so the
 * opponent learns nothing about which card is which. destroy() stops it (pulses end gracefully).
 */
export function setCardPulse(ctx: AnyCtx | CinematicContext<never>, player: PlayerId): Disposable & { tiles: TileCard[]; settle(color?: number): void } {
  const c = ctx as AnyCtx;
  const sc = c.scene;
  const tiles = c.views.field
    .tiles()
    .filter((e) => e.player === player && e.spot === 'spellTrap' && !e.tile.faceUp && e.tile.active)
    .map((e) => e.tile);
  let alive = true;
  const motes = new Sparks(sc, DEPTH.FX - 2, ADD);
  const stopMotes = onFrame(sc, (dt) => {
    if (!alive) return false;
    for (const t of tiles) {
      if (!t.active || t.standing) continue;
      if (rnd() < dt / 140) motes.add({ x: t.home.x + rr(-14, 14), y: t.home.y + rr(-4, 6), vy: rr(-26, -12), life: rr(380, 620), ramp: [PAL.mag4, PAL.mag3, PAL.mag2, PAL.mag1], tex: rnd() < 0.2 ? 'fx:plus' : 'fx:px1' });
    }
    return true;
  });
  void (async () => {
    let k = 0;
    while (alive && sc.sys.isActive()) {
      for (const t of tiles) if (t.active && !t.standing && t.visible) void t.pulse(k % 2 ? PAL.mag2 : PAL.mag3, 560);
      k++;
      await wait(sc, 700);
    }
  })();
  return {
    tiles,
    destroy() {
      if (!alive) return;
      alive = false;
      stopMotes();
      motes.close();
    },
    /** Stop and give every card one last cooling pulse (the window closed). */
    settle(color: number = PAL.night4) {
      this.destroy();
      for (const t of tiles) if (t.active && !t.standing && t.visible) void t.pulse(color, 300);
    },
  };
}

export type SetPulse = ReturnType<typeof setCardPulse>;

export function isSetPulse(h: Disposable | null): h is SetPulse {
  return !!h && Array.isArray((h as Partial<SetPulse>).tiles) && typeof (h as Partial<SetPulse>).settle === 'function';
}

// ================================================================ misc

/** The unit's depth band (for effects drawn behind / in front of a sprite). */
export function depthOf(u: MonsterUnit, d = 0): number {
  return unitDepth(u.home.y) + d;
}

/** Duelist avatar of a player (or null when the art is missing). */
export function duelist(ctx: AnyCtx | CinematicContext<never>, p: PlayerId) {
  try {
    return (ctx as AnyCtx).views.duelists?.get(p) ?? null;
  } catch {
    return null;
  }
}
