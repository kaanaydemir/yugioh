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
// Camera: leans toward the clash, punches in a hair on the impact frame, eases back out after.

import type { GameEvent } from '../../engine/types';
import { ATTRIBUTE_RAMP, PAL, RAMPS, type Ramp } from '../../art/palette';
import { GAME_W, type XY } from '../../view/layout';
import { wait } from '../../vfx/core';
import { blockClang, directHit, whiteFlash } from '../../vfx/combat';
import { genericStrike } from '../_defaults/strikes';
import { fx, registerEvent, strikeFor, type StrikeArgs } from '../api';
import { type EvOf, all, duelist, guardReact, guardRemap, guardRemapAll, lerpXY, live, norm, other, sub, takeAttack } from './_kit';

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
    const ev = ctx.ev;
    const sc = ctx.scene;
    guardRemapAll(ctx.views);
    const attacker = ctx.unit(ev.attackerUid);
    const target = ev.targetUid !== null ? ctx.unit(ev.targetUid) : null;
    if (target) guardRemap(target);
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

    const pending: Promise<unknown>[] = [];
    const playDamageAt = (at: XY, delay = 0) => {
      if (dmgIdx < 0 || ctx.isConsumed(dmgIdx)) return;
      const job = delay > 0 ? wait(sc, delay).then(() => ctx.play(dmgIdx, { at, battle: true })) : ctx.play(dmgIdx, { at, battle: true });
      pending.push(job);
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
      // impact-frame camera punch
      void ctx.focus(focusAt, { zoom: Math.min(1.08, zoom + 0.02), ms: 70, pan: 0.34 }).then(() => ctx.focus(focusAt, { zoom, ms: 260, pan: 0.32 }));
      if (direct) {
        pending.push(directHit(sc, defender, { at: p }));
        void duelist(ctx, defender)?.jolt();
        if (dmgEv && dmgEv.player === defender) playDamageAt({ x: p.x, y: p.y - 22 });
        return;
      }
      const tu = live(target);
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
      }
      pending.push(wait(sc, au2 ? 120 : 0).then(() => ctx.play(aDestroy, { push: dir, hit: false })));
    } else if (au2 && blocked && dmgEv && dmgEv.player === ev.player) {
      void au2.play('hit');
    }
    // any other battle destroy (should not happen) still plays
    for (const i of destroyIdx) if (i !== tDestroy && i !== aDestroy && !ctx.isConsumed(i)) pending.push(ctx.play(i));
    await all(pending);
    await ctx.unfocus(300);
  },
  { name: 'tb:battle' },
);
