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
    if (u.guarding) return reactGuard(ctx, u, { power: o.power, dir, at: o.at, ramp: o.ramp, by: o.by, kind, survive: !o.lethal, noStop: o.noStop });
    const side = blowSide(u, dir);
    const heavy = isHeavyBlow(o.power, !!o.lethal, by);
    if (o.pose !== false && side !== 'back') playRecoil(u, hitAnimFor(u, { kind, heavy }), { dir, power: o.power, lethal: !!o.lethal });
    contactFlash(sc, u.sprite, dir, { frames: heavy ? 3 : 2, coverage: Math.min(FLASH_COVER[o.power], o.flash ?? 1), at: p, tint: o.ramp ? o.ramp[4] : undefined });
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
    depth: u && live ? behindBody(u) : undefined,
  });
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
  void combatImpact(sc, p.x, p.y, { power: Math.min(2, o.power) as 1 | 2, ramp: o.ramp, dir, noStop: true, shakePx: reactShakePx(o.power, by), jitterPx: 0, depth: behindBody(u) });
  // a lethal blow breaks the guard open into the blow's own recoil and the death pose
  // (./guardbreak.ts): the flash, the glint and the knock-back stay the guard's, the pose is the break's
  const recoil = hitAnimFor(u, { kind: o.kind ?? blowKindOf(o.by ?? null), heavy: true });
  const brk = !o.survive ? planGuardBreak(u, { recoil }) : null;
  const react = u.guardHit({ dir, power: o.power, hold: !o.survive, pose: !brk });
  if (brk) runGuardBreak(u, brk);
  if (!o.noStop) await stopTime(sc, reactStopMs(o.power, by));
  await react;
}
