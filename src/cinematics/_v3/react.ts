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
//            (motion.ts guardPushPx + 1; a heavy body barely moves, a light one is thrown). A3 §10:
//            the CONTACT frame shows the body where it stands (only the struck region changes: the
//            recoil's f0); the shove starts on the first frame change after it (afterContact: the
//            recoil's f1, a lethal blow's death pose, the next frame of a body that plays no
//            recoil) — one pixel on that frame, the rest over ~70 ms; springs back with the class's
//            return ease, or stays (hold: a death follows). Art with knock: 'pose' draws part of
//            the travel in its recoil poses; the kit adds only the rest (kitKnockPx).
//   time     hit-stop / shake from the SOURCE of the blow (motion.ts contactStopMs / ShakePx).
//   flash    contactFlash: stepped light bands around the contact point (white core, a checkered
//            band in the blow's light tone, a dithered edge), ≤ ~45 % of the silhouette.
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
import { wait } from '../../vfx/core';
import type { CinematicContext } from '../_core/types';
import { contactFlash } from './flash';
import { SKIP_COST, frameDelta, idleDelta, plannedEntry, planDeathEntry, setPlannedEntry, type DeathEntry } from './posematch';
import { planGuardBreak, runGuardBreak } from './guardbreak';
import { hitSoundFor, panAt, play, playHit, quietCombat, soundsOf, sourceCard } from './sound';

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

/** Phaser.Animations.Events.ANIMATION_UPDATE / Phaser.Scenes.Events.PRE_RENDER (no runtime Phaser import here). */
const ANIMATION_UPDATE = 'animationupdate';
const PRE_RENDER = 'prerender';
/** One game frame (ms): the slack of afterContact's deadline for a pose that holds. */
const TICK_MS = 1000 / 60;

interface KnockRec {
  /** Where the sprite stands when it is not shoved (kept across a knock that interrupts another). */
  base: XY;
  token: number;
  tween: Phaser.Tweens.Tween | null;
  /** Drops a shove still waiting for its first frame change (afterContact). */
  cancel: (() => void) | null;
}
const knocks = new WeakMap<Phaser.GameObjects.Sprite, KnockRec>();

/** Whole-pixel knock-back in attack position (px for this target and blow). */
export function knockPx(u: MonsterUnit, power: 1 | 2 | 3, side: BlowSide): number {
  if (side === 'above') return power >= 3 ? 1 : 0;
  const k = guardPushPx(u.art, power) + 1 + (side === 'back' ? 1 : 0);
  return Math.max(0, Math.min(4, k));
}

/**
 * The part of knockPx the kit moves the sprite itself (A3 §10.2): all of it for art without
 * `knock: 'pose'` (the default 'sprite': both slice monsters); with 'pose' the recoil poses draw
 * `poseKnockPx[power]` px of a FRONT blow's travel and the kit adds only the rest. A blow from
 * behind (no recoil pose; a struckBack lean draws no travel) or from above (the shove is down, the
 * recoil poses draw none of it) keeps the whole knockPx.
 */
export function kitKnockPx(u: MonsterUnit, power: 1 | 2 | 3, side: BlowSide): number {
  const k = knockPx(u, power, side);
  if (u.art.knock !== 'pose' || side !== 'front') return k;
  const drawn = Math.max(0, Math.round(u.art.poseKnockPx?.[power - 1] ?? 0));
  return Math.max(0, k - drawn);
}

/**
 * A3 §10.1: run `cb` once, on the first frame after the contact frame on which the sprite shows
 * another frame — whatever anim is on screen: the recoil's f1, a lethal blow's death pose (its
 * posematch entry frame or its first changing frame), the next frame of a body that plays no
 * recoil (a blow from behind) — before that frame is drawn. Call it on the contact (the hit).
 *   - The contact frame is the frame DRAWN next (scene PRE_RENDER), not the one shown at the call:
 *     the caller may still re-pose the sprite before it is drawn (the bolt's jolt frame, posed
 *     right after the reaction handed over to the death pose).
 *   - From then on, the sprite's 'animationupdate', listened to once (its anim stepped to the next
 *     frame), and each update after the animations stepped (scene UPDATE; the unit's shadow
 *     follows in POST_UPDATE) a comparison with the contact frame: a play() of another anim (the
 *     handover into the death pose emits 'animationstart', not 'animationupdate') or a pose()
 *     (setFrame) changes the frame without that event.
 *   - A pose that holds (nothing changes): `holdMs` of show time + one tick after the contact —
 *     show time stands still through the hit-stop, so hit-stop + f0 hold + 1 tick. Default
 *     holdMs: the hold of the contact frame (of the frame shown at the call until it is drawn).
 * `onCancel` runs instead when the unit is gone first (retired / destroyed) or when the returned
 * function is called before `cb` ran.
 */
export function afterContact(u: MonsterUnit, cb: () => void, o: { holdMs?: number; onCancel?: () => void } = {}): () => void {
  const s = u.sprite;
  const sc = u.scene;
  const holdOfShown = () => {
    const fi = u.frameInfo();
    return Math.max(0, o.holdMs ?? (fi.anim ? u.frameMs(fi.anim, fi.frame) : 0));
  };
  let shown = String(s.frame?.name ?? '');
  let hold = holdOfShown();
  let drawn = false;
  let done = false;
  let stopPoll: () => void = () => undefined;
  const end = () => {
    done = true;
    sc.events.off(PRE_RENDER, onDraw);
    s.off(ANIMATION_UPDATE, fire);
    stopPoll();
  };
  function fire(): void {
    if (done) return;
    end();
    if (s.active && !u.retired) cb();
    else o.onCancel?.();
  }
  // the contact frame is about to be drawn: that is the frame (and the hold) a change is measured from
  function onDraw(): void {
    if (done || drawn) return;
    drawn = true;
    shown = String(s.frame?.name ?? '');
    hold = holdOfShown();
    s.once(ANIMATION_UPDATE, fire);
  }
  sc.events.once(PRE_RENDER, onDraw);
  stopPoll = onFrame(sc, (_dt, el) => {
    if (done) return false;
    if (!s.active || u.retired || (drawn && String(s.frame?.name ?? '') !== shown) || el >= hold + TICK_MS) {
      fire();
      return false;
    }
    return true;
  });
  return () => {
    if (done) return;
    end();
    o.onCancel?.();
  };
}

/**
 * Shove the sprite `px` whole pixels along `dir` (y × 0.6: the foreshortened floor). The contact
 * frame shows the body where it stands; the shove starts on the first frame change after it
 * (afterContact; o.holdMs: its deadline for a pose that holds): one pixel on that frame, the rest
 * over ~70 ms, then back to where it stood with the weight class's return ease — or it stays
 * there (hold: a death follows from this spot). Something else moving the sprite before the shove
 * starts (a strike carrying it, settle()) cancels it.
 */
export function knock(u: MonsterUnit, dir: XY, px: number, o: { hold?: boolean; holdMs?: number } = {}): Promise<void> {
  const s = u.sprite;
  if (!s.active || px <= 0) return Promise.resolve();
  const sc = u.scene;
  const prev = knocks.get(s);
  prev?.cancel?.();
  prev?.tween?.stop();
  const base = prev ? prev.base : { x: s.x, y: s.y };
  const token = (prev?.token ?? 0) + 1;
  const rec: KnockRec = { base, token, tween: null, cancel: null };
  knocks.set(s, rec);
  const to = { x: Math.round(base.x + dir.x * px), y: Math.round(base.y + dir.y * px * 0.6) };
  const first = { x: base.x + Math.sign(to.x - base.x), y: base.y + (to.x === base.x ? Math.sign(to.y - base.y) : 0) };
  const prof = motionProfile(u.art);
  // where the sprite stands on the contact frame (a knock that interrupts another: mid-way back)
  const at = { x: s.x, y: s.y };
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (knocks.get(s) === rec) knocks.delete(s);
      resolve();
    };
    const shove = () => {
      rec.cancel = null;
      if (knocks.get(s) !== rec || s.x !== at.x || s.y !== at.y) return finish();
      s.setPosition(first.x, first.y);
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
    };
    rec.cancel = afterContact(u, shove, { holdMs: o.holdMs, onCancel: finish });
  });
}

// ================================================================ the reaction pose (reassertable)

interface Reaction {
  anim: AnyMonsterAnim;
  el: number;
  hold: boolean;
  /**
   * A lethal recoil on a monster with a death pose (posematch.ts): at `switchAt` ms the death pose
   * takes over on its frame `deathFrom` — the recoil frame it replaces looks the same.
   */
  switchAt: number | null;
  deathFrom: number;
  /** A lethal recoil's lead-in (A2 motion review r3 #4): the in-between frame shown first, until `ms`. */
  pre: { anim: AnyMonsterAnim; frame: number; ms: number } | null;
  /** Then the recoil's struck f0 holds until this (ms; 0: the recoil plays from its f0 at once). */
  struckUntil: number;
  stop: () => void;
}
const reactions = new WeakMap<MonsterUnit, Reaction>();

function track(u: MonsterUnit, anim: AnyMonsterAnim, hold: boolean, sw: { at: number; from: number } | null = null, lead: LethalLead | null = null): void {
  reactions.get(u)?.stop();
  const total = sw ? sw.at + u.rangeMs('death', sw.from, u.frameCount('death')) : u.animMs(anim);
  const pre = lead?.pre ?? null;
  const r: Reaction = {
    anim,
    el: 0,
    hold,
    switchAt: sw ? sw.at : null,
    deathFrom: sw ? sw.from : 0,
    pre,
    struckUntil: lead && lead.struckMs > 0 ? (pre ? pre.ms : 0) + lead.struckMs : 0,
    stop: () => undefined,
  };
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

/** Frame of `anim` reached `el` ms after starting it on `from`, and whether it has ended. */
function frameAt(u: MonsterUnit, anim: AnyMonsterAnim, from: number, el: number, last: number): { f: number; over: boolean } {
  let f = from;
  while (f < last && u.rangeMs(anim, from, f + 1) <= el) f++;
  return { f, over: el >= u.rangeMs(anim, from, last + 1) };
}

/**
 * Show the reaction pose again if something else (an attacker's own strike ending, which sends it
 * back to idle) replaced it while it should still be playing: it resumes on the frame it would be
 * on now (a lethal recoil that has handed over: the death pose's frame). Returns true when it did.
 */
export function reassertReaction(u: MonsterUnit | null): boolean {
  if (!u || u.retired || !u.sprite.active) return false;
  const r = reactions.get(u);
  if (!r) return false;
  const cur = u.frameInfo().anim;
  const playing = u.sprite.anims.isPlaying;
  if (r.switchAt !== null && r.el >= r.switchAt) {
    // the death pose has taken over
    if (cur === 'death') return false;
    const nD = u.frameCount('death');
    const at = frameAt(u, 'death', r.deathFrom, r.el - r.switchAt, nD - 1);
    u.asClaimant(() => {
      if (at.over) u.pose('death', nD - 1);
      else void u.playRange('death', at.f, undefined, { hold: true });
    });
    return true;
  }
  // a lethal recoil's lead-in: the in-between frame, then the struck frame's own beat
  const shows = (anim: AnyMonsterAnim, f: number) => cur === anim && u.frameInfo().frame === f && !playing;
  if (r.pre && r.el < r.pre.ms) {
    const p = r.pre;
    if (shows(p.anim, p.frame)) return false;
    u.asClaimant(() => u.pose(p.anim, p.frame));
    return true;
  }
  if (r.el < r.struckUntil) {
    if (shows(r.anim, 0)) return false;
    u.asClaimant(() => u.pose(r.anim, 0));
    return true;
  }
  if (cur === r.anim && playing) return false;
  const n = u.frameCount(r.anim);
  const lead = Math.max(r.struckUntil, r.pre ? r.pre.ms : 0);
  const at = frameAt(u, r.anim, 0, r.el - lead, n - 1);
  u.asClaimant(() => {
    if (at.over) u.pose(r.anim, n - 1);
    else void u.playRange(r.anim, at.f, undefined, { hold: r.hold });
  });
  return true;
}

/** The recoils a lethal blow may answer with: the blow's own first, then the art's other ones. */
function lethalRecoils(u: MonsterUnit, own: AnyMonsterAnim): AnyMonsterAnim[] {
  const out: AnyMonsterAnim[] = [own];
  for (const a of ['hitMagic', 'hitHeavy', 'hit'] as const) if (a !== own && u.has(a)) out.push(a);
  return out;
}

/** Beat after the contact frame within which a lethal recoil hands over to the death pose (ms). */
const LETHAL_HANDOVER_MS = 140;

/** A jump into the recoil's first frame larger than this (idleΔ) gets a lead-in (see lethalLead). */
const INTO_MAX = 3;
/** A step back along the anim shown must make the worst step at least this much smaller (idleΔ). */
const BACK_GAIN = 0.5;
/** Frames a lead-in may step back along the anim shown. */
const BACK_MAX = 2;
/** A recoil f0 this close to the death's start frame (idleΔ) IS that frame: the death shows it. */
const SAME_FRAME = 0.5;
/** Shortest beat of a lead-in frame once time runs (two game frames). */
const BEAT_MS = 34;

interface LethalLead {
  /** An in-between frame shown first: the struck attack's follow-through reversed one frame. */
  pre: { anim: AnyMonsterAnim; frame: number; ms: number } | null;
  /** The recoil's struck f0 holds this long before the death joins (0: the death shows it / no need). */
  struckMs: number;
}

/**
 * A2 motion review r3 #4: a lethal blow that lands while the body shows a pose far from the
 * recoil's first frame (a ranged attacker struck on its staff thrust: attack f6 → struck f0,
 * 6 × idleΔ in one frame, under the counter's flash) is not answered by a one-frame jump:
 *   - the struck attack steps BACK along its own anim first (its follow-through reversed: the thrust
 *     is snapped back by the blow) when that frame makes the worst step clearly smaller;
 *   - the recoil's struck f0 then holds its own beat even when the death would replace it at once
 *     (hold 0) — unless the death's start frame is the same picture (a shared struck f0).
 * Nothing changes when the jump into the recoil is already small (≤ INTO_MAX × idleΔ).
 */
function lethalLead(u: MonsterUnit, plan: DeathEntry, from: string): LethalLead {
  const none: LethalLead = { pre: null, struckMs: 0 };
  const into = plan.into;
  const idle = idleDelta(u);
  if (into === undefined || idle === null || into <= INTO_MAX) return none;
  const entry = plan.cost - SKIP_COST * plan.start;
  const struckMs = plan.hold === 0 && entry > SAME_FRAME ? Math.max(BEAT_MS, u.frameMs(plan.anim, 0)) : 0;
  let pre: LethalLead['pre'] = null;
  const m = /^(attack|special):(\d+)$/.exec(from);
  if (m) {
    const a = m[1] as AnyMonsterAnim;
    const f = Number(m[2]);
    let best = into - BACK_GAIN;
    // one or two frames back along the anim (a frame that just changed may still be the one before)
    for (let k = f - 1; k >= Math.max(0, f - BACK_MAX); k--) {
      const d1 = frameDelta(u, from, `${a}:${k}`);
      const d2 = frameDelta(u, `${a}:${k}`, `${plan.anim}:0`);
      if (d1 === null || d2 === null) continue;
      const w = Math.max(d1, d2) / idle;
      if (w <= best) {
        best = w;
        pre = { anim: a, frame: k, ms: BEAT_MS };
      }
    }
  }
  return { pre, struckMs };
}

/**
 * Play the recoil of a blow. A LETHAL blow on a monster with a death pose: the recoil plays only
 * up to the frame its death pose continues from without a jump (posematch.planDeathEntry, the
 * earliest good match within LETHAL_HANDOVER_MS) and the death pose takes over right there, on
 * its matching frame — the body never holds a still frame waiting for the destroy event; the
 * death kit (death.ts) joins the pose already playing. A big jump from the pose shown into the
 * recoil gets a lead-in first (lethalLead). Every step goes on only while the sprite still shows
 * what the step before posed (a strike that sends it home is answered by reassertReaction).
 */
function playRecoil(u: MonsterUnit, anim: AnyMonsterAnim, o: { dir: XY; power: 1 | 2 | 3; lethal: boolean }): void {
  const from = String(u.sprite.frame?.name ?? '');
  const plan = o.lethal ? planDeathEntry(u, lethalRecoils(u, anim), LETHAL_HANDOVER_MS, from) : null;
  if (plan) {
    const lead = lethalLead(u, plan, from);
    const preMs = lead.pre ? lead.pre.ms : 0;
    const at = preMs + lead.struckMs + u.rangeMs(plan.anim, 0, plan.hold);
    setPlannedEntry(u, { ...plan, leadMs: at });
    const sc = u.scene;
    const alive = () => !u.retired && u.sprite.active;
    const shows = (a: AnyMonsterAnim, f: number) => {
      const fi = u.frameInfo();
      return fi.anim === a && fi.frame === f;
    };
    const toDeath = () => {
      if (!alive()) return;
      const fi = u.frameInfo();
      // only while the recoil still shows (anything that took the sprite over is re-asserted later)
      if (fi.anim !== plan.anim && (plan.hold > 0 || lead.struckMs > 0)) return;
      u.asClaimant(() => void u.playRange('death', plan.start, undefined, { hold: true }));
    };
    const recoil = () => {
      if (!alive()) return;
      if (lead.struckMs > 0) {
        u.asClaimant(() => u.pose(plan.anim, 0));
        void wait(sc, lead.struckMs).then(() => alive() && shows(plan.anim, 0) && toDeath());
      } else if (plan.hold > 0) void u.asClaimant(() => u.playRange(plan.anim, 0, plan.hold)).then(toDeath);
      else toDeath();
    };
    const pre = lead.pre;
    if (pre && u.asClaimant(() => u.pose(pre.anim, pre.frame))) void wait(sc, pre.ms).then(() => alive() && shows(pre.anim, pre.frame) && recoil());
    else recoil();
    track(u, plan.anim, true, { at, from: plan.start }, lead);
    return;
  }
  u.asClaimant(() => void u.play(anim, { dir: o.dir, power: o.power, hold: o.lethal }));
  track(u, anim, o.lethal);
}

/** The lethal recoil's planned death entry of a unit, if one was planned (death.ts consumes it). */
export { plannedEntry };

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
  /**
   * Share of the silhouette the contact flash may light (default by power, FLASH_COVER). A blow
   * that lands while the body changes pose (a ranged attacker's counter-shock on its thrust) uses
   * less: the flash marks the contact, it never hides the body's own motion (plan §4).
   */
  flash?: number;
}

function weightSrc(by: ReactOpts['by']): WeightSource {
  if (by == null) return null;
  if (typeof by === 'string') return by;
  if ('art' in by && by.art) return by.art as Pick<MonsterArt, 'weight'>;
  return by as WeightSource;
}

/**
 * Does the blow's source score this contact frame with its own impact sound? Only an ATTACKER with
 * a character voice does (its breath / orb lands here): a counter-blow on the attacker itself is
 * the defender's backlash, which plays no impact of its own (_v3/sound.ts).
 */
function strikerScores(ctx: AnyCtx, u: MonsterUnit | null, by: ReactOpts['by']): boolean {
  const ev = (ctx as { ev?: { type?: string; attackerUid?: unknown } }).ev;
  if (u && ev && ev.type === 'battle' && ev.attackerUid === u.uid) return false;
  return !!soundsOf(sourceCard(by));
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
  // the struck body's own material sound (crystal / metal armour / cloth + shadow) on this contact
  // frame, instead of the generic impact (sound.ts; a monster without one keeps the generic sound)
  let hitSnd: ReturnType<typeof hitSoundFor> = null;
  let heavyHit = false;
  if (u && live) {
    if (u.guarding) return reactGuard(ctx, u, { power: o.power, dir, at: o.at, ramp: o.ramp, by: o.by, kind, survive: !o.lethal, noStop: o.noStop });
    const side = blowSide(u, dir);
    const heavy = isHeavyBlow(o.power, !!o.lethal, by);
    heavyHit = heavy;
    hitSnd = hitSoundFor(u, { kind, heavy });
    if (o.pose !== false && side !== 'back') playRecoil(u, hitAnimFor(u, { kind, heavy }), { dir, power: o.power, lethal: !!o.lethal });
    contactFlash(sc, u.sprite, dir, { frames: heavy ? 3 : 2, coverage: Math.min(FLASH_COVER[o.power], o.flash ?? 1), at: p, tint: o.ramp ? o.ramp[4] : undefined });
    // the contact frame shows the body where it stands; the shove starts on the next frame change
    if (o.knock !== false) void knock(u, dir, kitKnockPx(u, o.power, side), { hold: !!o.lethal });
  }
  const boom = () =>
    combatImpact(sc, p.x, p.y, {
      power: Math.min(2, o.power) as 1 | 2,
      ramp: o.ramp,
      dir,
      noStop: o.noStop,
      stopMs: reactStopMs(o.power, by),
      shakePx: reactShakePx(o.power, by),
      jitterPx: 0,
      depth: u && live ? behindBody(u) : undefined,
    });
  if (!hitSnd) {
    // a body without its own material, struck by a monster that scores the contact frame with its
    // own impact (the breath, the orb): the generic body blow stays under that accent instead of
    // stacking on it at full level (sound QA #1 / #10 / #11: impactHeavy 0.9 + the orb burst peaked
    // over −1 dBFS, doubled the 100–250 Hz weight and made the orb's contact 3 dB louder than the
    // breath's; −9.5 dB: through the master chain a 0.5 body blow was still as loud as the orb)
    if (strikerScores(ctx, u, o.by)) {
      const pw = Math.min(2, o.power);
      play(pw >= 2 ? 'impactHeavy' : 'impactLight', { volume: pw >= 2 ? 0.3 : 0.28, pan: panAt(p.x) });
      return quietCombat(boom);
    }
    return boom();
  }
  playHit(sc, hitSnd, { heavy: heavyHit, volume: heavyHit ? 0.95 : 0.85, pan: panAt(p.x) });
  return quietCombat(boom);
}

/**
 * The impact burst (star, rings, sparks) of a blow on a body is drawn just BEHIND that body (A2
 * motion review r2 #9: "efekt ana karakterin silüetini kapatmaz"): it blooms around the struck
 * edge; on the body itself only the contact flash (≤ 45 % of the silhouette) lights it.
 */
function behindBody(u: MonsterUnit): number {
  return u.sprite.depth - 0.4;
}

// ================================================================ defense position

export interface GuardReactOpts {
  power: 1 | 2 | 3;
  dir?: XY;
  at?: XY;
  ramp?: Ramp;
  by?: WeightSource | MonsterUnit | null;
  /** physical / magic (default: from `by`; no source → magic): the recoil a lethal blow breaks the guard into. */
  kind?: BlowKind;
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
  // the body behind the ward takes it as its material: a light blow while the guard holds, a heavy
  // one when it breaks (sound.ts; a monster without a material keeps the generic impact)
  const gSnd = hitSoundFor(u, { kind: o.kind ?? blowKindOf(o.by ?? null), heavy: !o.survive });
  const boom = () => void combatImpact(sc, p.x, p.y, { power: Math.min(2, o.power) as 1 | 2, ramp: o.ramp, dir, noStop: true, shakePx: reactShakePx(o.power, by), jitterPx: 0, depth: behindBody(u) });
  if (gSnd) {
    playHit(sc, gSnd, { heavy: !o.survive, volume: o.survive ? 0.9 : 1, pan: panAt(p.x) });
    quietCombat(boom);
  } else if (strikerScores(ctx as AnyCtx, u, o.by)) {
    // (as reactHit: the generic blow stays under the source monster's own contact accent)
    const pw = Math.min(2, o.power);
    play(pw >= 2 ? 'impactHeavy' : 'impactLight', { volume: pw >= 2 ? 0.3 : 0.28, pan: panAt(p.x) });
    quietCombat(boom);
  } else boom();
  // a lethal blow breaks the guard open into the blow's own recoil and the death pose
  // (./guardbreak.ts): the flash, the glint and the knock-back stay the guard's, the pose is the break's
  const recoil = hitAnimFor(u, { kind: o.kind ?? blowKindOf(o.by ?? null), heavy: true });
  const brk = !o.survive ? planGuardBreak(u, { recoil }) : null;
  const react = u.guardHit({ dir, power: o.power, hold: !o.survive, pose: !brk });
  if (brk) runGuardBreak(u, brk);
  if (!o.noStop) await stopTime(sc, reactStopMs(o.power, by));
  await react;
}
