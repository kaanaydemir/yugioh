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
//     from that reaction once its strike has let go of the sprite; never "flies home and is hit
//     by nothing";
//   - a direct hit lands as a local impact at the duelist (no full-screen wash).

import type Phaser from 'phaser';
import type { GameEvent } from '../../engine/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { ATTRIBUTE_RAMP, PAL, RAMPS, type Ramp } from '../../art/palette';
import { GAME_W, LOOK_V3, type XY } from '../../view/layout';
import { shake, wait } from '../../vfx/core';
import { blockClang, directHit, impact as combatImpact, whiteFlash } from '../../vfx/combat';
import { lightFlash } from '../../view/light';
import { genericStrike } from '../_defaults/strikes';
import { fx, registerEvent, strikeFor, type StrikeArgs } from '../api';
import { contactFlash } from '../_v3/flash';
import { blowKindOf, contactPoint, reassertReaction } from '../_v3/react';
import { backlash, blowFrom, canHandOver, isMelee } from '../_v3/clash';
import { DEATH_AFTER_CONTACT_MS } from '../_v3/budget';
import { STRIKE_LIGHT, type Ctx, type EvOf, all, arenaDim, duelist, guardReact, impactLight, lerpXY, live, norm, other, sub, takeAttack } from './_kit';

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
    if (LOOK_V3) return battleV3(ctx);
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
    const strikeLight = attacker ? STRIKE_LIGHT[attacker.cardId] ?? aRamp[3] : aRamp[3];

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
      const strike = strikeFor(au.cardId) ?? genericStrike;
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
  const aRamp: Ramp = attacker ? ATTRIBUTE_RAMP[attacker.attribute] : RAMPS.gold;
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
  const strikeLight = attacker ? STRIKE_LIGHT[attacker.cardId] ?? aRamp[3] : aRamp[3];

  const pending: Promise<unknown>[] = [];
  /** The damage number + LP roll: the triggers below need not wait for the counter to settle. */
  const rolls: Promise<unknown>[] = [];
  let dmgQueued = false;
  /** The number pops NOW (the contact frame): no delay, no waiting for the hit-stop. */
  const playDamageAt = (at: XY) => {
    if (dmgIdx < 0 || dmgQueued || ctx.isConsumed(dmgIdx)) return;
    dmgQueued = true;
    rolls.push(ctx.play(dmgIdx, { at: { x: Math.round(at.x), y: Math.round(at.y) }, battle: true }));
  };
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
    const p = at ?? to;
    const au = live(attacker);
    // the blow travels from where the attacker stands NOW (not from its home tile)
    const blow = direct ? homeBlow : blowFrom(au, toGround, homeBlow);
    const back = { x: -blow.x, y: -blow.y };
    const aNow = au ? au.core() : aCore0;
    if (direct) {
      // a local impact at the duelist: sparks, shake, hit-stop — no full-screen wash
      const hit = fx.directImpact(ctx, p, to);
      pending.push(combatImpact(sc, hit.world.x, hit.world.y, { power: 2, ramp: aRamp, dir: blow, stopMs: 110, shakePx: power >= 3 ? 4 : 3 }));
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
        // the guard holds: hex-shield clang on the face it was struck on, the blow glances off
        pending.push(fx.guardReact(ctx, tu, { power: 1, dir: blow, at: p, ramp: RAMPS.water, survive: true, noStop: true }));
        pending.push(blockClang(sc, Math.round(p.x + back.x * 6), Math.round(p.y + back.y * 6), { from: aNow, color: PAL.water3 }));
      } else {
        // an attack-position target outclasses the attacker: it takes the blow standing
        pending.push(blockClang(sc, Math.round(p.x + back.x * 5), Math.round(p.y + back.y * 5), { from: aNow, color: tRamp[3] }));
        if (tu) contactFlash(sc, tu.sprite, blow, { frames: 1, coverage: 0.3 });
      }
    } else if (tu) {
      if (defense) pending.push(fx.guardReact(ctx, tu, { power, dir: blow, at: p, ramp: aRamp, survive: tDestroy < 0 }));
      else pending.push(fx.hitReact(ctx, tu, power, aRamp, p, blow, undefined, { lethal: tDestroy >= 0 }));
    }
    // ---- the attacker answers for it on this same frame, where it stands
    if (au && (blocked || ev.result === 'bothDestroyed')) {
      const dies = aDestroy >= 0;
      const melee = isMelee(au, p);
      const cdir = norm(sub(au.core(), p)); // the counter travels from the clash into the attacker
      const hitAt = contactPoint(au, cdir);
      // ranged: the shock runs back along the attack's own line and lands now
      if (!melee) void backlash(sc, p, hitAt, tRamp);
      pending.push(
        fx.hitReact(ctx, au, dies ? 2 : 1, tRamp, hitAt, cdir, target ? target.art : null, {
          kind: melee ? blowKindOf(target) : 'magic',
          lethal: dies,
          // the strike still drives the sprite: no knock-back; it owns the rebound pose unless
          // the attacker dies here (then the reaction pose is ours, and re-asserted below)
          knock: false,
          pose: dies,
          noStop: !dies,
        }),
      );
      contactLight(sc, hitAt, au.home.y, tRamp[3], dies ? 2 : 1);
    }
    // ---- the number: on the contact frame, over whoever pays
    if (dmgEv) {
      if (dmgEv.player === defender) playDamageAt(overHead(tu ?? target));
      else playDamageAt(au ? overHead(au) : overDuelist(ev.player));
    }
    // ---- deaths start from the reactions
    if (tDestroy >= 0) {
      // guard: the knock-back lands first; attack position: right after the hit-stop
      const delay = defense ? 130 + power * 20 : DEATH_AFTER_CONTACT_MS;
      pending.push(wait(sc, delay).then(() => ctx.play(tDestroy, { push: blow, hit: false })));
    }
    if (aDestroy >= 0) {
      const push = au ? norm(sub(au.core(), p)) : back;
      // from the counter's reaction, once the strike has let go of the sprite
      pending.push(Promise.all([strikeDone, wait(sc, au ? DEATH_AFTER_CONTACT_MS : 0)]).then(() => ctx.play(aDestroy, { push, hit: false })));
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
    const strike = strikeFor(au.cardId) ?? genericStrike;
    const args: StrikeArgs = { ctx, scene: sc, attacker: au, target: live(target), to, toGround, direct, blocked, power, impact: onImpact, impacted: impactedP };
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
  // the strike let go of the sprite: a dying attacker keeps its counter-hit pose (a strike that
  // ends by sending it back to idle would cut it), then its death starts
  if (aDestroy >= 0) reassertReaction(live(attacker));
  strikeOver();
  onImpact(); // in case the strike never called it
  if (dmgEv && !ctx.isConsumed(dmgIdx)) playDamageAt(dmgEv.player === defender ? overHead(live(target)) : live(attacker) ? overHead(live(attacker)) : overDuelist(ev.player));
  // any other battle destroy (should not happen) still plays
  for (const i of destroyIdx) if (i !== tDestroy && i !== aDestroy && !ctx.isConsumed(i)) pending.push(ctx.play(i));
  await all(pending);
  await all([...rolls, fx.playBattleTriggers(ctx, [ev.attackerUid, ev.targetUid], { skip: dmgIdx >= 0 ? [dmgIdx] : [] })]);
  void arenaDim(sc, 0, 420);
  await ctx.unfocus(300);
}
