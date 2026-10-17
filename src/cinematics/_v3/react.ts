// v3 HIT-REACTION KIT (docs/v3/A0_ENVANTER.md §6.2 item 1; plan §4 "Hasar tepkisi yönü, şiddeti,
// fiziksel / büyüsel oluşu ve savunma pozisyonunu yansıtır"). Used under ?look=v3 by
// fx.hitReact / fx.guardReact (_core/helpers.ts) and the battle handler; the old look never
// reaches it.
//
//   reactHit(ctx, unit, { power, dir, at, by, kind, lethal })   attack position
//   reactGuard(ctx, unit, { power, dir, at, by, survive })       defense position (guard pose)
//
// What it decides
//   pose     hitMagic (spell / beam / magic strike) · hitHeavy (power 3, a lethal blow, or a
//            heavy body's blow) · hit — each falls back to the plain 'hit' when the art lacks it
//            (hitAnimFor). A blow from BEHIND (the shadow assassin) never plays the recoil, which
//            leans back toward the attacker: the body is shoved forward instead.
//   motion   whole-pixel knock-back along the blow, sized by the TARGET's weight class
//            (motion.ts guardPushPx + 1; a heavy body barely moves, a light one is thrown), one
//            pixel on the impact frame itself, the rest after the hit-stop; springs back with the
//            class's return ease, or stays (hold: a death follows).
//   time     hit-stop / shake from the SOURCE of the blow (motion.ts contactStopMs / ShakePx).
//   flash    contactFlash: white only on the side the blow lands on, ≤ ~45 % of the silhouette.
//   sparks   vfx/combat impact (sparks, star, ring) at the contact point on the body's surface
//            (not on its core), power capped at 2 for the visuals: power 3's full-screen black /
//            white frame is a screen wash, which the v3 look does not use.
//
// Direction: `dir` is the direction the blow TRAVELS (attacker → target) in screen space. The
// battle handler computes it from where the attacker IS at the contact frame (its current world
// position), not from its home tile.

import type Phaser from 'phaser';
import type { GameEvent } from '../../engine/types';
import type { Ramp } from '../../art/palette';
import type { AnyMonsterAnim, MonsterArt } from '../../art/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { guardPushPx, motionProfile, reactShakePx, reactStopMs, type WeightSource } from '../../duel/motion';
import type { XY } from '../../view/layout';
import { impact as combatImpact, stopTime } from '../../vfx/combat';
import { onFrame } from '../../vfx/setpieces';
import type { CinematicContext } from '../_core/types';
import { contactFlash } from './flash';

type AnyCtx = CinematicContext<GameEvent>;

// ================================================================ blow classification (pure: ./blow.ts)

export { STRIKE_KIND, blowKindOf, blowSide, hitAnimFor, isHeavyBlow, type BlowKind, type BlowSide } from './blow';
import { blowKindOf, blowSide, hitAnimFor, isHeavyBlow, type BlowKind, type BlowSide } from './blow';

/** Share of the silhouette the contact flash may cover, by power. */
const FLASH_COVER = [0, 0.34, 0.4, 0.45] as const;

/** A unit-length blow direction; default: from the opponent's side into the unit's front. */
export function blowDir(u: MonsterUnit | null, dir?: XY): XY {
  const d = dir ?? (u && u.player === 1 ? { x: 1, y: -0.5 } : { x: -1, y: 0.5 });
  const l = Math.hypot(d.x, d.y) || 1;
  return { x: d.x / l, y: d.y / l };
}

/** A point on the body's surface on the side the blow lands (sparks start there, not on the core). */
export function contactPoint(u: MonsterUnit, dir: XY, at?: XY): XY {
  const c = u.core();
  if (at && Math.hypot(at.x - c.x, at.y - c.y) > 4) return { x: Math.round(at.x), y: Math.round(at.y) };
  const r = Math.max(5, Math.min(12, Math.round(u.art.w * 0.12)));
  return { x: Math.round(c.x - dir.x * r), y: Math.round(c.y - dir.y * r * 0.6) };
}

// ================================================================ knock-back

const knocks = new WeakMap<Phaser.GameObjects.Sprite, { base: XY; token: number; tween: Phaser.Tweens.Tween | null }>();

/** Whole-pixel knock-back in attack position (px for this target and blow). */
export function knockPx(u: MonsterUnit, power: 1 | 2 | 3, side: BlowSide): number {
  if (side === 'above') return power >= 3 ? 1 : 0;
  const k = guardPushPx(u.art, power) + 1 + (side === 'back' ? 1 : 0);
  return Math.max(0, Math.min(4, k));
}

/**
 * Shove the sprite `px` whole pixels along `dir`: one pixel at once (the impact frame shows it,
 * hit-stop or not), the rest over ~70 ms once time runs again, then back to where it stood with
 * the weight class's return ease — or stay there (hold: a death follows from this spot).
 */
export function knock(u: MonsterUnit, dir: XY, px: number, o: { hold?: boolean } = {}): Promise<void> {
  const s = u.sprite;
  if (!s.active || px <= 0) return Promise.resolve();
  const sc = u.scene;
  const prev = knocks.get(s);
  prev?.tween?.stop();
  const base = prev ? prev.base : { x: s.x, y: s.y };
  const token = (prev?.token ?? 0) + 1;
  const rec = { base, token, tween: null as Phaser.Tweens.Tween | null };
  knocks.set(s, rec);
  const to = { x: Math.round(base.x + dir.x * px), y: Math.round(base.y + dir.y * px * 0.6) };
  const first = { x: base.x + Math.sign(to.x - base.x), y: base.y + (to.x === base.x ? Math.sign(to.y - base.y) : 0) };
  s.setPosition(first.x, first.y);
  const prof = motionProfile(u.art);
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (knocks.get(s) === rec) knocks.delete(s);
      resolve();
    };
    rec.tween = sc.tweens.add({
      targets: s,
      x: to.x,
      y: to.y,
      duration: 70,
      ease: 'Quad.Out',
      onUpdate: () => s.setPosition(Math.round(s.x), Math.round(s.y)),
      onStop: finish,
      onComplete: () => {
        if (o.hold || !s.active || knocks.get(s) !== rec) return finish();
        rec.tween = sc.tweens.add({
          targets: s,
          x: base.x,
          y: base.y,
          duration: Math.round(prof.recoveryMs * 0.6),
          ease: prof.guardReturnEase,
          onUpdate: () => s.setPosition(Math.round(s.x), Math.round(s.y)),
          onComplete: finish,
          onStop: finish,
        });
      },
    });
    // settle() / killTweensOf may drop the tweens without an event
    void new Promise<void>((r) => sc.time.delayedCall(o.hold ? 260 : 700, r)).then(finish);
  });
}

// ================================================================ the reaction pose (reassertable)

interface Reaction {
  anim: AnyMonsterAnim;
  el: number;
  hold: boolean;
  stop: () => void;
}
const reactions = new WeakMap<MonsterUnit, Reaction>();

function track(u: MonsterUnit, anim: AnyMonsterAnim, hold: boolean): void {
  reactions.get(u)?.stop();
  const total = u.animMs(anim);
  const r: Reaction = { anim, el: 0, hold, stop: () => undefined };
  r.stop = onFrame(u.scene, (dt) => {
    r.el += dt;
    // a held reaction (a death follows) stays re-assertable on its last frame for a while
    if (r.el >= total + (hold ? 1500 : 0) || u.retired) {
      if (reactions.get(u) === r) reactions.delete(u);
      return false;
    }
    return true;
  });
  reactions.set(u, r);
}

/**
 * Show the reaction pose again if something else (an attacker's own strike ending, which sends it
 * back to idle) replaced it while it should still be playing: it resumes on the frame it would be
 * on now. Returns true when it did.
 */
export function reassertReaction(u: MonsterUnit | null): boolean {
  if (!u || u.retired || !u.sprite.active) return false;
  const r = reactions.get(u);
  if (!r) return false;
  if (u.frameInfo().anim === r.anim && u.sprite.anims.isPlaying) return false;
  let f = 0;
  const n = u.frameCount(r.anim);
  while (f < n - 1 && u.rangeMs(r.anim, 0, f + 1) <= r.el) f++;
  if (r.el >= u.animMs(r.anim)) u.pose(r.anim, n - 1);
  else void u.playRange(r.anim, f, undefined, { hold: r.hold });
  return true;
}

// ================================================================ attack position

export interface ReactOpts {
  power: 1 | 2 | 3;
  /** Spark colours. */
  ramp?: Ramp;
  /** Where the blow lands (default: the body's surface on the contact side). */
  at?: XY;
  /** Direction the blow travels (attacker → target). */
  dir?: XY;
  /** Source of the blow (weight profile of its hit-stop / shake; its kind). null: legacy power table. */
  by?: WeightSource | MonsterUnit | null;
  /** physical / magic (default: from `by`; no source → magic). */
  kind?: BlowKind;
  /** The blow destroys the unit (a death follows): heavy pose, and the knock-back stays. */
  lethal?: boolean;
  /** Move the sprite (default true). false while a strike still drives it (an attacker). */
  knock?: boolean;
  /** Play the recoil pose (default true). false: flash + sparks only (the caller owns the pose). */
  pose?: boolean;
  /** Skip the hit-stop (several impacts in the same beat). */
  noStop?: boolean;
}

function weightSrc(by: ReactOpts['by']): WeightSource {
  if (by == null) return null;
  if (typeof by === 'string') return by;
  if ('art' in by && by.art) return by.art as Pick<MonsterArt, 'weight'>;
  return by as WeightSource;
}

/**
 * The v3 attack-position hit reaction (see the header). Resolves like the old one: after the
 * hit-stop and the first burst (~0.2–0.3 s).
 */
export function reactHit(ctx: AnyCtx, u: MonsterUnit | null, o: ReactOpts): Promise<void> {
  const sc = ctx.scene;
  const dir = blowDir(u, o.dir);
  const by = weightSrc(o.by);
  const kind = o.kind ?? blowKindOf(o.by ?? null);
  const live = !!u && u.sprite.active && u.sprite.visible && !u.retired;
  const p = u ? contactPoint(u, dir, o.at) : (o.at ?? { x: 320, y: 180 });
  if (u && live) {
    if (u.guarding) return reactGuard(ctx, u, { power: o.power, dir, at: o.at, ramp: o.ramp, by: o.by, survive: !o.lethal, noStop: o.noStop });
    const side = blowSide(u, dir);
    const heavy = isHeavyBlow(o.power, !!o.lethal, by);
    if (o.pose !== false && side !== 'back') {
      const anim = hitAnimFor(u, { kind, heavy });
      void u.play(anim, { dir, power: o.power, hold: !!o.lethal });
      track(u, anim, !!o.lethal);
    }
    contactFlash(sc, u.sprite, dir, { frames: heavy ? 3 : 2, coverage: FLASH_COVER[o.power] });
    if (o.knock !== false) void knock(u, dir, knockPx(u, o.power, side), { hold: !!o.lethal });
  }
  return combatImpact(sc, p.x, p.y, {
    power: Math.min(2, o.power) as 1 | 2,
    ramp: o.ramp,
    dir,
    noStop: o.noStop,
    stopMs: reactStopMs(o.power, by),
    shakePx: reactShakePx(o.power, by),
    jitterPx: 0,
  });
}

// ================================================================ defense position

export interface GuardReactOpts {
  power: 1 | 2 | 3;
  dir?: XY;
  at?: XY;
  ramp?: Ramp;
  by?: WeightSource | MonsterUnit | null;
  /** The guard holds (springs back); false: it stays pushed — a death follows. */
  survive: boolean;
  /** Skip our own hit-stop (another impact of the same beat freezes time). */
  noStop?: boolean;
}

/**
 * The v3 guard-pose reaction: sparks at the guard's contact face, then MonsterUnit.guardHit —
 * the guard frames stay, the contact flash (v3) and the hex glint light the face the blow came
 * from, the knock-back follows the guard's weight class — under the blow source's hit-stop.
 */
export async function reactGuard(ctx: AnyCtx | CinematicContext<never>, u: MonsterUnit, o: GuardReactOpts): Promise<void> {
  const sc = (ctx as AnyCtx).scene as Phaser.Scene;
  if (!u.sprite.active || !u.sprite.visible || u.retired) return;
  const dir = blowDir(u, o.dir);
  const by = weightSrc(o.by);
  const p = contactPoint(u, dir, o.at);
  void combatImpact(sc, p.x, p.y, { power: Math.min(2, o.power) as 1 | 2, ramp: o.ramp, dir, noStop: true, shakePx: reactShakePx(o.power, by), jitterPx: 0 });
  const react = u.guardHit({ dir, power: o.power, hold: !o.survive });
  if (!o.noStop) await stopTime(sc, reactStopMs(o.power, by));
  await react;
}
