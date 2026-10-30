// The generic battle presentation: every battle runs through here (the attacker's strike comes
// from registerStrike — other agents own those — or the default lunge), and this handler owns
// the OUTCOME around the strike's impact:
//
//   hit lands (attack position)   sparks + white silhouette + 'hit' + hit-stop + shake, damage number
//                                 over the struck monster, LP rolls, the monster shatters
//   hit lands (defense position)  the monster stays in its GUARD pose: white flash, hex-shield
//                                 glint, hit-stop, 2–3 px knock-back → shatters or springs back
//   blocked (DEF > ATK)           hex-shield clang on the guard, the attacker recoils (flash +
//                                 'hit'), recoil damage pops over the attacker for its controller
//   attacker loses (ATK vs ATK)   the target withstands the blow, the counter-hit sparks on the
//                                 attacker, which shatters back on its own tile
//   both destroyed                the target shatters at contact, the attacker takes the mirrored
//                                 blow and shatters a beat later (double shatter)
//   direct                        red vignette, heavy shake, the duelist jolts, number at the hit
// Camera: leans toward the clash (whole-pixel pan), the impact frame shakes + hit-stops, eases back after.
//
// The v3 look (?look=v3) runs battleV3 below instead (A0 §6.2 items 1 + 3):
//   - the blow travels from where the attacker IS at the contact frame (_v3/clash blowFrom): an
//     assassin that rose behind its target throws it forward, away from itself, and the guard's
//     glint lights the face it was struck on;
//   - the hit-reaction kit (_v3/react: hit / hitHeavy / hitMagic by size and kind, knock-back by
//     weight, contact flash ≤ half the body);
//   - every damage number pops ON the contact frame — over the struck monster, or over the
//     attacker when its own player pays (recoil);
//   - when the attacker loses, it is struck on that same frame where it stands (in front of the
//     target, or — ranged — by a backlash running back along its own attack) and its death starts
//     from that reaction; never "flies home and is hit by nothing". A MELEE loser is taken over
//     on the contact frame (MonsterUnit.claim: a legacy strike that would carry it home no longer
//     drives the sprite) and dies right there, DEATH_AFTER_CONTACT_MS later; a ranged one once
//     its strike has let go of the sprite. The stronger attack-position target answers the blow
//     with a short recoil of its own (power 1) — it withstood it;
//   - a direct hit lands as a local impact at the duelist (no full-screen wash);
//   - the tail runs in parallel, not in a row: the camera eases back (and the arena light comes
//     up) as soon as the climax is over — the card of each death is born (its body broke), or,
//     with no death, the number has popped — while the LP roll and the card flights finish; only a
//     battle trigger (counter-splash, howl, discharge) keeps the camera on the clash until it has
//     played.

import type Phaser from 'phaser';
import type { GameEvent } from '../../engine/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { ATTRIBUTE_RAMP, PAL, RAMPS, type Ramp } from '../../art/palette';
import { restoreBattlePlates } from './plates';
import { DEPTH, GAME_W, LOOK_V3, type XY } from '../../view/layout';
import { shake, wait } from '../../vfx/core';
import { blockClang, directHit, impact as combatImpact, whiteFlash } from '../../vfx/combat';
import { lightFlash } from '../../view/light';
import { genericStrike } from '../_defaults/strikes';
import { fx, registerEvent, strikeFor, type StrikeArgs } from '../api';
import { blowKindOf, contactPoint, hitAnimFor, reassertReaction } from '../_v3/react';
import type { AnyMonsterAnim } from '../../art/types';
import { backlash, blowFrom, canHandOver, isMelee } from '../_v3/clash';
import { DEATH_AFTER_CONTACT_MS } from '../_v3/budget';
import { settleBefore, strikeContactIn } from '../_v3/posematch';
import { onFrame } from '../../vfx/setpieces';
import { weightOf } from '../../duel/motion';
import { strikeLight as strikeLightOf, type Ctx, type EvOf, all, arenaDim, duelist, guardReact, impactLight, lerpXY, live, norm, other, sub, takeAttack } from './_kit';
import { panAt, play as playSnd, quietCombat, soundsOf } from '../_v3/sound';
import { v3Recipe } from '../../presentation/registry';

/** v3: the impact number's pop (slam + settle, _v3/number.ts) before the camera may ease out. */
const NUMBER_POP_MS = 200;

/** Events that end the "consequences" run of a battle. */
function isBreak(e: GameEvent): boolean {
  return !(e.type === 'damage' || e.type === 'destroy' || e.type === 'toGraveyard' || e.type === 'statChange' || e.type === 'fieldSpell');
}

function battlePower(ev: EvOf<'battle'>, dmg: number): 1 | 2 | 3 {
  const v = ev.result === 'direct' ? ev.attackerAtk : Math.max(dmg, ev.result === 'noDestroy' ? 0 : 600);
  return v >= 1600 ? 3 : v >= 600 ? 2 : 1;
}

registerEvent(
  'battle',
  async (ctx) => {
    if (LOOK_V3) {
      try {
        return await battleV3(ctx);
      } finally {
        restoreBattlePlates(ctx.stateNext);
      }
    }
    const ev = ctx.ev;
    const sc = ctx.scene;
    const attacker = ctx.unit(ev.attackerUid);
    const target = ev.targetUid !== null ? ctx.unit(ev.targetUid) : null;
    // ---- the consequences that belong to this battle
    const dmgIdx = ctx.findType('damage', (e) => e.source === 'battle', { until: isBreak });
    const destroyIdx: number[] = [];
    for (let i = ctx.index + 1; i < ctx.events.length; i++) {
      const e = ctx.events[i];
      if (isBreak(e)) break;
      if (e.type === 'destroy' && e.reason === 'battle' && !ctx.isConsumed(i)) destroyIdx.push(i);
    }
    const dmgEv = dmgIdx >= 0 ? (ctx.events[dmgIdx] as EvOf<'damage'>) : null;
    const tDestroy = destroyIdx.find((i) => (ctx.events[i] as EvOf<'destroy'>).uid === ev.targetUid) ?? -1;
    const aDestroy = destroyIdx.find((i) => (ctx.events[i] as EvOf<'destroy'>).uid === ev.attackerUid) ?? -1;
    const direct = ev.result === 'direct';
    const defender = other(ev.player);
    const defense = ev.targetPosition === 'defense';
    const blocked = ev.result === 'attackerDestroyed' || (ev.result === 'noDestroy' && defense && (ev.targetValue ?? 0) > ev.attackerAtk);
    const power = battlePower(ev, dmgEv?.amount ?? 0);
    const { hold, other: kept } = takeAttack(ctx);
    const aRamp: Ramp = attacker ? ATTRIBUTE_RAMP[attacker.attribute] : RAMPS.gold;
    const tRamp: Ramp = target ? ATTRIBUTE_RAMP[target.attribute] : RAMPS.gold;
    const tTile = ev.targetUid !== null ? ctx.tile(ev.targetUid) : null;
    const to: XY = direct ? fx.duelistPoint(ctx, defender) : live(target) ? target!.core() : tTile ? { x: tTile.home.x, y: tTile.home.y - 10 } : { x: GAME_W / 2, y: 140 };
    const toGround: XY = direct ? { x: to.x, y: to.y + 18 } : target ? target.home : tTile ? tTile.home : to;
    const aCore = attacker ? attacker.core() : to;
    const blow = attacker ? norm(sub(toGround, attacker.home)) : { x: ev.player === 0 ? 1 : -1, y: ev.player === 0 ? -0.5 : 0.5 };
    const back = { x: -blow.x, y: -blow.y };

    // ---- camera: lean toward the clash
    const zoom = power >= 3 ? 1.065 : 1.05;
    const focusAt = lerpXY(aCore, to, 0.62);
    void ctx.focus(focusAt, { zoom, ms: 360, pan: 0.32 });
    // arena v2 light: the stadium dims around the clash (restored when the battle is over)
    void arenaDim(sc, power >= 3 ? 0.42 : 0.28, 320);
    const strikeLight = attacker ? strikeLightOf(attacker.cardId) ?? aRamp[3] : aRamp[3];

    const pending: Promise<unknown>[] = [];
    /** The damage number + LP roll: the triggers below need not wait for the counter to settle. */
    const rolls: Promise<unknown>[] = [];
    let dmgQueued = false;
    const playDamageAt = (at: XY, delay = 0) => {
      if (dmgIdx < 0 || dmgQueued || ctx.isConsumed(dmgIdx)) return;
      dmgQueued = true;
      const job = delay > 0 ? wait(sc, delay).then(() => ctx.play(dmgIdx, { at, battle: true })) : ctx.play(dmgIdx, { at, battle: true });
      rolls.push(job);
    };
    /** Where a number over a unit goes (just above its head). */
    const overHead = (u: typeof attacker): XY => {
      if (!u || !u.sprite.active) return { x: to.x, y: to.y - 22 };
      const t = u.worldPoint('top');
      return { x: Math.round(t.x), y: Math.round(t.y - 8) };
    };

    /** Over a duelist's head (recoil damage), or behind their back row without duelist art. */
    const overDuelist = (p: typeof ev.player): XY => {
      const c = fx.duelistPoint(ctx, p);
      return { x: Math.round(c.x), y: Math.round(c.y - 14) };
    };

    let impacted = false;
    let resolveImpact!: () => void;
    const impactedP = new Promise<void>((r) => (resolveImpact = r));
    const onImpact = (at?: XY) => {
      if (impacted) return;
      impacted = true;
      resolveImpact();
      const p = at ?? to;
      if (direct) {
        // the burst lives on the un-zoomed UI camera: project the world hit point once, as the
        // camera stands on the impact frame
        const hit = fx.directImpact(ctx, p, to);
        impactLight(sc, hit.world, toGround.y, strikeLight, power, { k: 1.15 });
        // the impact frame: directHit's heavy shake + hit-stop (no zoom punch: integer camera)
        pending.push(directHit(sc, defender, { at: hit.screen }));
        void duelist(ctx, defender)?.jolt();
        if (dmgEv && dmgEv.player === defender) playDamageAt({ x: hit.world.x, y: hit.world.y - 22 });
        return;
      }
      // the impact frame is sold by shake + hit-stop, not a zoom punch (integer camera, v3 A1.2):
      // every reaction below shakes the world camera and freezes time — combat impact (hitReact /
      // guardReact) or blockClang. Only a strike into an empty tile has none: a plain shake then.
      const tu = live(target);
      if (!blocked && !tu) void shake(sc, 100 + power * 30, power);
      // the impact lights the floor under the struck point (a guard that holds flashes shield-blue)
      if (blocked) impactLight(sc, p, toGround.y, defense ? PAL.water3 : tRamp[3], 1, { k: 0.85 });
      else impactLight(sc, p, toGround.y, strikeLight, power);
      if (blocked) {
        if (tu && defense) {
          // the guard holds: hex-shield clang, the blow glances off
          pending.push(guardReact(ctx, tu, { power: 1, dir: blow, at: p, ramp: RAMPS.water, survive: true, noStop: true }));
          pending.push(blockClang(sc, Math.round(p.x + back.x * 6), Math.round(p.y + back.y * 6), { from: aCore, color: PAL.water3 }));
        } else {
          // an attack-position target simply outclasses the attacker: it takes the blow standing
          pending.push(blockClang(sc, Math.round(p.x + back.x * 5), Math.round(p.y + back.y * 5), { from: aCore, color: tRamp[3] }));
          if (tu) void whiteFlash(sc, tu.sprite, 1);
        }
        // the attacker recoils: flash as the shock travels back up its arm
        const au = live(attacker);
        if (au) void wait(sc, 70).then(() => whiteFlash(sc, au.sprite, 2));
        // the recoil hits the attacking player: the number pops over their duelist as they flinch
        if (dmgEv && dmgEv.player === ev.player) playDamageAt(overDuelist(ev.player), 150);
      } else if (tu) {
        if (defense) pending.push(guardReact(ctx, tu, { power, dir: blow, at: p, ramp: aRamp, survive: tDestroy < 0 }));
        else pending.push(fx.hitReact(ctx, tu, power, aRamp, p, blow));
        if (ev.result === 'bothDestroyed') {
          const au = live(attacker);
          if (au) void whiteFlash(sc, au.sprite, 2);
        }
      }
      // damage to the defender: over the struck monster
      if (dmgEv && dmgEv.player === defender) playDamageAt(overHead(target), 40);
      if (tDestroy >= 0) {
        // guard: the knock-back lands first; attack position: right after the hit-stop
        const delay = defense ? 130 + power * 20 : 110;
        pending.push(wait(sc, delay).then(() => ctx.play(tDestroy, { push: blow, hit: false })));
      }
    };

    // ---- the strike
    const au = live(attacker);
    if (au) {
      kept?.destroy();
      if (hold) {
        hold.dropMarks();
        await hold.release(70);
      }
      const strike = strikeFor(au.cardId, genericStrike);
      const args: StrikeArgs = {
        ctx,
        scene: sc,
        attacker: au,
        target: live(target),
        to,
        toGround,
        direct,
        blocked,
        power,
        impact: onImpact,
        impacted: impactedP,
      };
      try {
        await Promise.race([strike(args), wait(sc, 6000)]);
      } catch (e) {
        console.error('[battle] strike failed', e);
      }
    } else {
      kept?.destroy();
      hold?.destroy();
      await wait(sc, 200);
    }
    onImpact(); // in case the strike never called it

    // ---- after the strike: the attacker pays
    const au2 = live(attacker);
    if (dmgEv && dmgEv.player === ev.player && !ctx.isConsumed(dmgIdx)) playDamageAt(overDuelist(ev.player));
    if (aDestroy >= 0) {
      const dir = attacker && target ? norm(sub(attacker.home, target.home)) : back;
      if (au2) {
        // the counter blow (attacker lost) / the mirrored blow (both destroyed)
        const hitAt = au2.core();
        pending.push(fx.hitReact(ctx, au2, 2, tRamp, { x: hitAt.x - dir.x * 4, y: hitAt.y - dir.y * 4 }, dir));
        impactLight(sc, hitAt, au2.home.y, tRamp[3], 2, { k: 0.8 });
      }
      pending.push(wait(sc, au2 ? 120 : 0).then(() => ctx.play(aDestroy, { push: dir, hit: false })));
    } else if (au2 && blocked && dmgEv && dmgEv.player === ev.player) {
      void au2.play('hit');
    }
    // any other battle destroy (should not happen) still plays
    for (const i of destroyIdx) if (i !== tDestroy && i !== aDestroy && !ctx.isConsumed(i)) pending.push(ctx.play(i));
    await all(pending);
    // the triggers this battle sets off (counter-splash, howl, discharge) play while the camera
    // is still on the clash — no dead beat between the blow and the answer (the LP roll of the
    // battle damage finishes alongside)
    await all([...rolls, fx.playBattleTriggers(ctx, [ev.attackerUid, ev.targetUid], { skip: dmgIdx >= 0 ? [dmgIdx] : [] })]);
    void arenaDim(sc, 0, 420);
    await ctx.unfocus(300);
  },
  { name: 'tb:battle' },
);

// ================================================================ the v3 look (?look=v3)

/** A small local floor light at a contact (the v3 stepped light layer; never a screen wash). */
function contactLight(sc: Phaser.Scene, at: XY, floorY: number, color: number, power: 1 | 2 | 3): void {
  void lightFlash(sc, at.x, at.y, color, 24 + power * 6, 200 + power * 50, { floorY, ring: power >= 2, intensity: 0.6 + power * 0.12, air: 0.35 });
}

/**
 * A2 motion review r2 #9: an old monster's strike bursts its whole explosion over the struck body
 * (the Titan's fireball + rings + glow covered the magus's first death frames for ~250 ms). For a
 * v3 victim, everything that strike adds to the FX band right after the contact call (the same
 * synchronous step: its burst) is drawn just BEHIND the victim's body instead — the burst still
 * blooms around it and on the floor, the reaction / guard / death pose stays readable.
 */
function burstBehind(sc: Phaser.Scene, victim: MonsterUnit): void {
  const before = new Set(sc.children.list);
  queueMicrotask(() => {
    if (!victim.sprite.active || victim.retired) return;
    const d = victim.sprite.depth - 0.05;
    for (const o of sc.children.list) {
      if (before.has(o)) continue;
      const g = o as Phaser.GameObjects.GameObject & { depth?: number; setDepth?: (v: number) => unknown };
      if (typeof g.depth === 'number' && g.depth >= DEPTH.FX && g.depth < DEPTH.FX + 4.5 && g.setDepth) g.setDepth(d);
    }
  });
}

/** Share of the attacker's silhouette a counter-blow's contact flash may light (≤ the kit's 0.45). */
const COUNTER_FLASH = 0.24;

/**
 * A3 pilot fix (v3 look only, recipe-built strikes only — the slice's own strikes never get here): a
 * card whose strike is the recipe layer's physical 'throw' (Taş Muhafız's boulder). Such a throw is
 * never a melee clash however close the two stand (it flew: P1 = P2), and a guard answers it with the
 * rock itself — the pieces rebound onto the thrower (recipe/strike.ts materialBurst) — not with the
 * ranged spell's backlash bolt (A2's magus-orb rule).
 */
function physicalThrow(id: string | null | undefined): boolean {
  const r = v3Recipe(id);
  return !!r && !r.custom?.strike && r.attack.type === 'throw' && r.attack.blow === 'physical';
}
/**
 * A thrown rock's sparks and flash (its blows on the struck body and the rebound on the thrower): stone greys
 * up to white — not the attribute ramp (EARTH: earth tones, whose ring and floor ellipse fade through earth2 to
 * brown smudges on the night floor) and never a spell's hue.
 */
const THROWN_RAMP: Ramp = [PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4, PAL.white];
/** A number this close (px) to the contact would cover it: it moves to the payer's far side by this much. */
const NUMBER_CLEAR_PX = 28;
const NUMBER_SIDE_PX = 46;

/** The recoil anims (a claimed survivor is handed back once none of them plays any more). */
const RECOILS = ['hit', 'hitHeavy', 'hitMagic'];

/**
 * A blocked melee attacker that survives (claimed without a pin on the contact frame): its contact
 * pose holds through the hit-stop (the blow is seen landing), its recoil starts on the first frame
 * time runs again; once the recoil has played (or after a safety beat) the claim ends and the unit
 * rests — the strike, still carrying it home, drives it again.
 */
function recoilAfterStop(u: MonsterUnit, anim: AnyMonsterAnim): void {
  let started = false;
  let seen = false;
  onFrame(u.scene, (dt, el) => {
    if (u.retired || !u.sprite.active) return false;
    if (!started) {
      if (dt <= 0 && el < 400) return true; // the hit-stop
      started = true;
      u.asClaimant(() => void u.play(anim));
      return true;
    }
    const fi = u.frameInfo();
    const recoiling = fi.anim !== null && RECOILS.includes(fi.anim) && u.sprite.anims.isPlaying;
    if (recoiling) seen = true;
    if ((seen && !recoiling) || el > 1400) {
      const held = fi.anim !== null && RECOILS.includes(fi.anim) && !u.sprite.anims.isPlaying;
      u.unclaim();
      if (held || !seen) u.rest();
      return false;
    }
    return true;
  });
}

/**
 * The battle outcome in the v3 look (see the header): same consequences, same strike API, but the
 * blow direction, the reactions, the numbers and the counter-blow are staged on the CONTACT frame.
 */
async function battleV3(ctx: Ctx<'battle'>): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const attacker = ctx.unit(ev.attackerUid);
  const target = ev.targetUid !== null ? ctx.unit(ev.targetUid) : null;
  // ---- the consequences that belong to this battle
  const dmgIdx = ctx.findType('damage', (e) => e.source === 'battle', { until: isBreak });
  const destroyIdx: number[] = [];
  for (let i = ctx.index + 1; i < ctx.events.length; i++) {
    const e = ctx.events[i];
    if (isBreak(e)) break;
    if (e.type === 'destroy' && e.reason === 'battle' && !ctx.isConsumed(i)) destroyIdx.push(i);
  }
  const dmgEv = dmgIdx >= 0 ? (ctx.events[dmgIdx] as EvOf<'damage'>) : null;
  const tDestroy = destroyIdx.find((i) => (ctx.events[i] as EvOf<'destroy'>).uid === ev.targetUid) ?? -1;
  const aDestroy = destroyIdx.find((i) => (ctx.events[i] as EvOf<'destroy'>).uid === ev.attackerUid) ?? -1;
  const direct = ev.result === 'direct';
  const defender = other(ev.player);
  const defense = ev.targetPosition === 'defense';
  const blocked = ev.result === 'attackerDestroyed' || (ev.result === 'noDestroy' && defense && (ev.targetValue ?? 0) > ev.attackerAtk);
  const power = battlePower(ev, dmgEv?.amount ?? 0);
  const { hold, other: kept } = takeAttack(ctx);
  const aRamp: Ramp = attacker ? (physicalThrow(attacker.cardId) ? THROWN_RAMP : ATTRIBUTE_RAMP[attacker.attribute]) : RAMPS.gold;
  const tRamp: Ramp = target ? ATTRIBUTE_RAMP[target.attribute] : RAMPS.gold;
  const tTile = ev.targetUid !== null ? ctx.tile(ev.targetUid) : null;
  const to: XY = direct ? fx.duelistPoint(ctx, defender) : live(target) ? target!.core() : tTile ? { x: tTile.home.x, y: tTile.home.y - 10 } : { x: GAME_W / 2, y: 140 };
  const toGround: XY = direct ? { x: to.x, y: to.y + 18 } : target ? target.home : tTile ? tTile.home : to;
  const aCore0 = attacker ? attacker.core() : to;
  // the aim before the strike (home → target); the blow itself is measured at contact
  const homeBlow = attacker ? norm(sub(toGround, attacker.home)) : { x: ev.player === 0 ? 1 : -1, y: ev.player === 0 ? -0.5 : 0.5 };

  // ---- camera: lean toward the clash (whole-pixel pan in the v3 look)
  void ctx.focus(lerpXY(aCore0, to, 0.62), { zoom: power >= 3 ? 1.065 : 1.05, ms: 360, pan: 0.32 });
  void arenaDim(sc, power >= 3 ? 0.42 : 0.28, 320);
  const strikeLight = attacker ? strikeLightOf(attacker.cardId) ?? aRamp[3] : aRamp[3];
  // a battle trigger (counter-splash, howl, discharge) plays inside the focus: the camera waits for it
  const hasTriggers = fx.battleTriggerEnd(ctx, [ev.attackerUid, ev.targetUid]) >= 0;

  const pending: Promise<unknown>[] = [];
  /** The damage number + LP roll: the triggers below need not wait for the counter to settle. */
  const rolls: Promise<unknown>[] = [];
  /** The climax beats (a death's card born, the number popped): the camera eases out after them. */
  const climax: Promise<unknown>[] = [];
  let eased: Promise<void> | null = null;
  const easeOut = (): Promise<void> => {
    if (!eased) {
      void arenaDim(sc, 0, 420);
      eased = ctx.unfocus(300);
    }
    return eased;
  };
  let dmgQueued = false;
  /** The number pops NOW (the contact frame): no delay, no waiting for the hit-stop. */
  const playDamageAt = (at: XY) => {
    if (dmgIdx < 0 || dmgQueued || ctx.isConsumed(dmgIdx)) return;
    dmgQueued = true;
    rolls.push(ctx.play(dmgIdx, { at: { x: Math.round(at.x), y: Math.round(at.y) }, battle: true }));
    climax.push(wait(sc, NUMBER_POP_MS));
  };
  /** A death after `after`; its climax is the frame its card is born (its body broke). */
  const death = (i: number, push: XY, after: Promise<unknown>) => {
    let bornNow!: () => void;
    const born = new Promise<void>((r) => (bornNow = r));
    const job = after.then(() => ctx.play(i, { push, hit: false, onBorn: () => bornNow() }));
    climax.push(Promise.race([born, job]));
    pending.push(job);
  };
  /** The melee loser taken over on the contact frame (its strike no longer drives it). */
  let cutAttacker = false;
  /** Just above a unit's head, where it stands now. */
  const overHead = (u: MonsterUnit | null): XY => {
    if (!u || !u.sprite.active) return { x: to.x, y: to.y - 22 };
    const t = u.worldPoint('top');
    return { x: Math.round(t.x), y: Math.round(t.y - 8) };
  };
  const overDuelist = (p: typeof ev.player): XY => {
    const c = fx.duelistPoint(ctx, p);
    return { x: Math.round(c.x), y: Math.round(c.y - 14) };
  };

  let strikeOver!: () => void;
  const strikeDone = new Promise<void>((r) => (strikeOver = r));
  let impacted = false;
  let resolveImpact!: () => void;
  const impactedP = new Promise<void>((r) => (resolveImpact = r));
  const onImpact = (at?: XY) => {
    if (impacted) return;
    impacted = true;
    resolveImpact();
    // the contact frame, for the timing tools (tools/measure.mjs: a legacy strike may sound earlier)
    sc.events.emit('v3:contact', ev.attackerUid);
    stageImpact(at);
    // a legacy strike's burst (made right after this call) never covers a v3 body's reaction
    const tv = live(target);
    const av = live(attacker);
    if (tv && av && tv.has('death') && !av.has('death')) burstBehind(sc, tv);
    // the camera eases out once the climax is over (unless a trigger still has to play)
    if (!hasTriggers) void Promise.all(climax.length ? climax : [...pending]).then(() => easeOut());
  };
  /** The contact frame: reactions, the counter, the number, the deaths. */
  const stageImpact = (at?: XY) => {
    const p = at ?? to;
    const au = live(attacker);
    // the blow travels from where the attacker stands NOW (not from its home tile)
    const blow = direct ? homeBlow : blowFrom(au, toGround, homeBlow);
    const back = { x: -blow.x, y: -blow.y };
    const aNow = au ? au.core() : aCore0;
    if (direct) {
      // a local impact at the duelist: sparks, shake, hit-stop — no full-screen wash
      const hit = fx.directImpact(ctx, p, to);
      const boom = () => combatImpact(sc, hit.world.x, hit.world.y, { power: 2, ramp: aRamp, dir: blow, stopMs: 110, shakePx: power >= 3 ? 4 : 3 });
      // an attacker with its own impact sound scores this frame itself (_v3/sound.ts): the duelist's
      // body blow stays under it, 6 dB quieter than before, so the two transients do not stack
      // (sound QA #1: 0.55 still pushed the direct breath's true peak to −0.18 dBTP)
      if (soundsOf(au?.cardId)) {
        pending.push(quietCombat(boom));
        playSnd('impactHeavy', { volume: 0.28, pan: panAt(hit.world.x) });
      } else pending.push(boom());
      contactLight(sc, hit.world, toGround.y, strikeLight, power);
      void duelist(ctx, defender)?.jolt();
      if (dmgEv && dmgEv.player === defender) playDamageAt({ x: hit.world.x, y: hit.world.y - 22 });
      return;
    }
    const tu = live(target);
    if (!blocked && !tu) void shake(sc, 100 + power * 30, power);
    contactLight(sc, p, toGround.y, blocked ? (defense ? PAL.water3 : tRamp[3]) : strikeLight, blocked ? 1 : power);
    // ---- the struck side
    if (blocked) {
      if (tu && defense) {
        // the guard holds: hex-shield clang on the face it was struck on, the blow glances off; the
        // ward gives one frame (two under a heavy body's blow: MonsterUnit brace) and closes again
        const heavyBody = !!au && (weightOf(au.art) === 'heavy' || weightOf(au.art) === 'mediumHeavy');
        pending.push(fx.guardReact(ctx, tu, { power: heavyBody ? 2 : 1, dir: blow, at: p, ramp: RAMPS.water, survive: true, noStop: true }));
        pending.push(blockClang(sc, Math.round(p.x + back.x * 6), Math.round(p.y + back.y * 6), { from: aNow, color: PAL.water3 }));
      } else {
        // an attack-position target outclasses the attacker: it takes the blow standing — a short
        // recoil of its own (power 1, a 1–2 px give) that it shrugs off
        pending.push(blockClang(sc, Math.round(p.x + back.x * 5), Math.round(p.y + back.y * 5), { from: aNow, color: tRamp[3] }));
        if (tu) pending.push(fx.hitReact(ctx, tu, 1, aRamp, p, blow, attacker ? attacker.art : null, { noStop: true }));
      }
    } else if (tu) {
      if (defense) pending.push(fx.guardReact(ctx, tu, { power, dir: blow, at: p, ramp: aRamp, survive: tDestroy < 0 }));
      else pending.push(fx.hitReact(ctx, tu, power, aRamp, p, blow, undefined, { lethal: tDestroy >= 0 }));
    }
    // ---- the attacker answers for it on this same frame, where it stands
    if (au && (blocked || ev.result === 'bothDestroyed')) {
      const dies = aDestroy >= 0;
      const thrown = physicalThrow(au.cardId);
      const melee = !thrown && isMelee(au, p);
      // a melee loser dies where it was struck: take it over from its strike now
      if (dies && melee) cutAttacker = au.claim();
      // a melee attacker that survives the block recoils ON this frame: its animation is taken
      // over (not its position — the strike still carries it back off the guard and home) and
      // handed back once the recoil has played (A2 motion review r2 #5)
      const recoilClaim = !dies && melee && au.claim({ pin: false });
      const cdir = norm(sub(au.core(), p)); // the counter travels from the clash into the attacker
      const hitAt = contactPoint(au, cdir);
      // ranged: the shock runs back along the attack's own line and lands now (a thrown rock: its own
      // pieces rebound onto the thrower instead — a physical blow, in the stone's tones)
      if (!melee && !thrown) void backlash(sc, p, hitAt, tRamp);
      pending.push(
        fx.hitReact(ctx, au, dies ? 2 : 1, thrown ? THROWN_RAMP : tRamp, hitAt, cdir, target ? target.art : null, {
          kind: thrown ? 'physical' : melee ? blowKindOf(target) : 'magic',
          lethal: dies,
          // the strike still drives the sprite: no knock-back; it owns the rebound pose unless
          // the attacker dies here (then the reaction pose is ours, and re-asserted below) or a
          // melee survivor's recoil was claimed above
          knock: false,
          pose: dies,
          noStop: !dies,
          // the counter lands on the body as it changes pose (the thrust snapped back, the struck
          // frame): the flash marks the contact, it never covers the motion (A2 motion review r3 #4)
          flash: COUNTER_FLASH,
        }),
      );
      if (recoilClaim) recoilAfterStop(au, hitAnimFor(au, { kind: melee ? blowKindOf(target) : 'magic', heavy: false }));
      contactLight(sc, hitAt, au.home.y, thrown ? PAL.white : tRamp[3], dies ? 2 : 1);
    }
    // ---- the number: on the contact frame, over whoever pays
    if (dmgEv) {
      if (dmgEv.player === defender) playDamageAt(overHead(tu ?? target));
      else if (au && physicalThrow(au.cardId)) {
        // a thrower struck at point-blank range: its head is under the guard it hit — a number over it
        // would cover the rock breaking on the shield; it goes to the thrower's far side instead
        const o = overHead(au);
        playDamageAt(Math.hypot(o.x - p.x, o.y - p.y) > NUMBER_CLEAR_PX ? o : { x: Math.round(o.x - Math.sign(blow.x || 1) * NUMBER_SIDE_PX), y: o.y });
      } else playDamageAt(au ? overHead(au) : overDuelist(ev.player));
    }
    // ---- deaths start from the reactions
    if (tDestroy >= 0) {
      // right after the hit-stop — a guard has already started to break open on the contact frame
      // (_v3/guardbreak.ts), its death joins that ≤ 150 ms after the contact
      death(tDestroy, blow, wait(sc, DEATH_AFTER_CONTACT_MS));
    }
    if (aDestroy >= 0) {
      const push = au ? norm(sub(au.core(), p)) : back;
      // from the counter's reaction: a claimed melee loser right away, else once the strike has
      // let go of the sprite
      death(aDestroy, push, Promise.all([cutAttacker ? null : strikeDone, wait(sc, au ? DEATH_AFTER_CONTACT_MS : 0)]));
    }
  };

  // ---- the strike
  const au = live(attacker);
  if (au) {
    kept?.destroy();
    if (hold) {
      hold.dropMarks();
      // the attacker goes to its strike straight from the declaration's charge pose
      if (canHandOver(hold)) hold.handOver();
      else await hold.release(70);
    }
    const strike = strikeFor(au.cardId, genericStrike);
    const args: StrikeArgs = { ctx, scene: sc, attacker: au, target: live(target), to, toGround, direct, blocked, power, impact: onImpact, impacted: impactedP };
    try {
      const run = strike(args);
      // A3 Y1b: the strike's first frame is on — its 'contact' mark says when the blow lands; a
      // resting target's idle arrives there on a frame its struck pose continues (_v3/posematch.ts)
      if (!direct) {
        const ms = strikeContactIn(au);
        if (ms !== null) settleBefore(live(target), ms);
      }
      await Promise.race([run, wait(sc, 6000)]);
    } catch (e) {
      console.error('[battle] strike failed', e);
    }
  } else {
    kept?.destroy();
    hold?.destroy();
    await wait(sc, 200);
  }
  // the strike let go of the sprite: a dying attacker keeps its counter-hit pose (a strike that
  // ends by sending it back to idle would cut it), then its death starts (a claimed one never lost it)
  if (aDestroy >= 0 && !cutAttacker) reassertReaction(live(attacker));
  strikeOver();
  onImpact(); // in case the strike never called it
  if (dmgEv && !ctx.isConsumed(dmgIdx)) playDamageAt(dmgEv.player === defender ? overHead(live(target)) : live(attacker) ? overHead(live(attacker)) : overDuelist(ev.player));
  // any other battle destroy (should not happen) still plays
  for (const i of destroyIdx) if (i !== tDestroy && i !== aDestroy && !ctx.isConsumed(i)) pending.push(ctx.play(i));
  await all(pending);
  // a claimed loser is normally retired by its death; never leave one pinned
  if (cutAttacker && attacker && !attacker.retired) attacker.unclaim();
  await all([...rolls, fx.playBattleTriggers(ctx, [ev.attackerUid, ev.targetUid], { skip: dmgIdx >= 0 ? [dmgIdx] : [] })]);
  await easeOut();
}
