// Default cinematics: attacks, battle outcomes, damage / LP, destruction and the graveyard.
import { CARDS, isMonster, type CardId } from '../../data/cards';
import type { GameEvent, PlayerId, Uid } from '../../engine/types';
import { other } from '../../engine/types';
import { ATTRIBUTE_RAMP, PAL, PLAYER_COLOR, RAMPS, type Ramp } from '../../art/palette';
import { GAME_W, type XY, zoneXY } from '../../view/layout';
import { tween, wait } from '../../vfx/core';
import { attackArrow, blockClang, directHit, lockOn } from '../../vfx/combat';
import { damageNumber, statPop } from '../../vfx/numbers';
import { healFly, burnFly, setVolcanoAmbience, swordForge } from '../../vfx/setpieces';
import { banner } from '../../vfx/banners';
import { sparkleBurst } from '../../vfx/summon';
import { DEFAULT_PRIORITY, registerEvent, strikeFor } from '../_core/registry';
import type { CinematicContext, StrikeArgs } from '../_core/types';
import {
  all,
  attrRamp,
  playRun,
  resolutionRun,
  spellShowcase,
  trapReveal,
  cardToGraveyard,
  duelistPoint,
  hitReact,
  lpPoint,
  presentDamage,
  presentHeal,
  shatterUnit,
  tileToGraveyard,
} from '../_core/helpers';
import { genericStrike } from './strikes';
import { flameAura, steamAura } from '../../duel/auras';

const P = { priority: DEFAULT_PRIORITY };

type Ctx<T extends GameEvent['type']> = CinematicContext<Extract<GameEvent, { type: T }>>;

/** Events that end the "consequences" run of a battle / effect. */
function isBreak(e: GameEvent): boolean {
  return !(e.type === 'damage' || e.type === 'destroy' || e.type === 'toGraveyard' || e.type === 'statChange' || e.type === 'fieldSpell');
}

// ================================================================ attack declaration

registerEvent(
  'attackDeclare',
  async (ctx) => {
    const ev = ctx.ev;
    const sc = ctx.scene;
    const attacker = ctx.unit(ev.attackerUid);
    const target = ev.targetUid !== null ? ctx.unit(ev.targetUid) : null;
    const tTile = ev.targetUid !== null ? ctx.tile(ev.targetUid) : null;
    const from = attacker ? attacker.core() : zoneXY(ev.player, 'monster', ev.attackerZone);
    const to = target && target.sprite.visible ? target.core() : tTile ? { x: tTile.home.x, y: tTile.home.y - 6 } : duelistPoint(ctx, other(ev.player));
    void ctx.views.duelists?.get(ev.player).play('command');
    ctx.sfx('attackDeclare', { volume: 0.8 });
    const arrow = attackArrow(sc, from, to, ev.player);
    const size = target ? Math.max(24, Math.round(target.art.w * 0.42)) : 30;
    const lock = lockOn(sc, to.x, to.y, { color: PLAYER_COLOR[ev.player], size });
    // wind-up: the attacker leans back and coils
    let lean: Promise<void> = Promise.resolve();
    if (attacker && attacker.sprite.visible) {
      const s = attacker.sprite;
      const back = ev.player === 0 ? -3 : 3;
      attacker.posed = true;
      lean = tween(sc, { targets: s, x: s.x + back, y: s.y - back / 2, scaleY: 0.94, duration: 220, ease: 'Quad.Out' });
    }
    void ctx.focus({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, { zoom: 1.04, ms: 320 });
    ctx.keep('attack', {
      destroy: () => {
        arrow.destroy();
        lock.destroy();
        if (attacker && attacker.sprite.active) {
          const r = attacker.rest0;
          attacker.posed = false;
          sc.tweens.killTweensOf(attacker.sprite);
          attacker.sprite.setPosition(r.x, r.y).setScale(1);
        }
      },
    });
    await all([arrow.done, lean]);
    await wait(sc, 200);
  },
  P,
);

registerEvent(
  'attackNegated',
  async (ctx) => {
    // generic: the arrow shatters, the attacker is shoved back; "SAVAŞ BİTTİ"
    const kept = ctx.take('attack');
    kept?.destroy();
    const u = ctx.unit(ctx.ev.attackerUid);
    if (u) {
      const c = u.core();
      void blockClang(ctx.scene, c.x, c.y);
      void u.play('hit');
    }
    await ctx.unfocus(200);
    await banner(ctx.scene, 'SAVAŞ BİTTİ', { style: 'trap' });
  },
  P,
);

// ================================================================ battle

function battlePower(ev: Extract<GameEvent, { type: 'battle' }>, dmg: number): 1 | 2 | 3 {
  const v = ev.result === 'direct' ? ev.attackerAtk : Math.max(dmg, ev.result === 'noDestroy' ? 0 : 600);
  return v >= 1600 ? 3 : v >= 600 ? 2 : 1;
}

/**
 * battle: the attacker's strike (registerStrike per monster, else a generic lunge), then the
 * outcome: target hit / shattered, attack blocked (clang, attacker bounces, LP damage to the
 * attacker), both destroyed, or a direct hit on the duelist. Plays the following battle damage
 * and battle destroy events at the right beats (they are consumed via ctx.play).
 */
registerEvent(
  'battle',
  async (ctx) => {
    const ev = ctx.ev;
    const sc = ctx.scene;
    const attacker = ctx.unit(ev.attackerUid);
    const target = ev.targetUid !== null ? ctx.unit(ev.targetUid) : null;
    // the consequences that belong to this battle
    const until = (e: GameEvent) => isBreak(e);
    const dmgIdx = ctx.findType('damage', (e) => e.source === 'battle', { until });
    const destroyIdx: number[] = [];
    for (let i = ctx.index + 1; i < ctx.events.length; i++) {
      const e = ctx.events[i];
      if (isBreak(e)) break;
      if (e.type === 'destroy' && e.reason === 'battle') destroyIdx.push(i);
    }
    const dmgEv = dmgIdx >= 0 ? (ctx.events[dmgIdx] as Extract<GameEvent, { type: 'damage' }>) : null;
    const tDestroy = destroyIdx.find((i) => (ctx.events[i] as Extract<GameEvent, { type: 'destroy' }>).uid === ev.targetUid) ?? -1;
    const aDestroy = destroyIdx.find((i) => (ctx.events[i] as Extract<GameEvent, { type: 'destroy' }>).uid === ev.attackerUid) ?? -1;
    // claim them now so nothing else starts them
    const pending: Promise<void>[] = [];
    const direct = ev.result === 'direct';
    const defender = other(ev.player);
    const blocked = ev.result === 'attackerDestroyed' || (ev.result === 'noDestroy' && ev.targetPosition === 'defense' && (ev.targetValue ?? 0) > ev.attackerAtk);
    const power = battlePower(ev, dmgEv?.amount ?? 0);
    const kept = ctx.take('attack');
    const aRamp: Ramp = attacker ? ATTRIBUTE_RAMP[attacker.attribute] : RAMPS.gold;
    const tTile = ev.targetUid !== null ? ctx.tile(ev.targetUid) : null;
    const to: XY = direct ? duelistPoint(ctx, defender) : target ? target.core() : tTile ? { x: tTile.home.x, y: tTile.home.y - 10 } : { x: GAME_W / 2, y: 140 };
    const toGround: XY = direct ? { x: to.x, y: to.y + 18 } : target ? target.home : tTile ? tTile.home : to;
    void ctx.focus(to, { zoom: power >= 3 ? 1.07 : 1.05, ms: 360, pan: 0.3 });

    let impacted = false;
    let resolveImpact!: () => void;
    const impactedP = new Promise<void>((r) => (resolveImpact = r));
    const onImpact = (at?: XY) => {
      if (impacted) return;
      impacted = true;
      resolveImpact();
      const p = at ?? to;
      if (direct) {
        pending.push(directHit(sc, defender, { at: p }));
        void ctx.views.duelists?.get(defender).jolt();
      } else if (blocked) {
        pending.push(blockClang(sc, p.x - (ev.player === 0 ? 6 : -6), p.y, { from: attacker?.core() }));
        if (target) void target.play('guard');
      } else {
        const dir = attacker && target ? { x: target.home.x - attacker.home.x, y: target.home.y - attacker.home.y } : undefined;
        pending.push(hitReact(ctx, target, power, aRamp, p, dir));
      }
      if (dmgIdx >= 0 && dmgEv && dmgEv.player === defender) {
        pending.push(ctx.play(dmgIdx, { at: direct ? { x: p.x, y: p.y - 22 } : duelistPoint(ctx, defender), battle: true }));
      }
      if (tDestroy >= 0) {
        const dir = attacker && target ? { x: target.home.x - attacker.home.x, y: target.home.y - attacker.home.y } : undefined;
        pending.push(wait(sc, 110).then(() => ctx.play(tDestroy, { push: dir, hit: false })));
      }
    };
    if (attacker && attacker.sprite.visible) {
      kept?.destroy();
      const strike = strikeFor(attacker.cardId) ?? genericStrike;
      const args: StrikeArgs = {
        ctx,
        scene: sc,
        attacker,
        target,
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
      await wait(sc, 200);
    }
    onImpact(); // in case the strike never called it
    // the attacker pays: counter damage to its controller, attacker shatters
    if (dmgIdx >= 0 && dmgEv && dmgEv.player === ev.player) {
      if (attacker) void attacker.play('hit');
      pending.push(ctx.play(dmgIdx, { at: duelistPoint(ctx, ev.player), battle: true }));
    }
    if (aDestroy >= 0) {
      const dir = attacker && target ? { x: attacker.home.x - target.home.x, y: attacker.home.y - target.home.y } : undefined;
      if (attacker && ev.result === 'attackerDestroyed') void hitReact(ctx, attacker, 2, target ? ATTRIBUTE_RAMP[target.attribute] : RAMPS.gold);
      pending.push(wait(sc, 120).then(() => ctx.play(aDestroy, { push: dir, hit: ev.result !== 'attackerDestroyed' })));
    }
    // any other battle destroy (should not happen) still plays
    for (const i of destroyIdx) if (i !== tDestroy && i !== aDestroy) pending.push(ctx.play(i));
    await all(pending);
    await ctx.unfocus(260);
  },
  P,
);

// ================================================================ damage / LP

/**
 * damage: the number pops (at hints.at for battle hits, else over the panel), LP rolls down,
 * the panel shakes, the duelist flinches. Effect damage without a delivery gets a fireball from
 * its source card first.
 */
registerEvent(
  'damage',
  async (ctx) => {
    const ev = ctx.ev;
    const at = ctx.hints.at as XY | undefined;
    if (!at && ev.source === 'effect' && !ctx.hints.delivered) {
      const src = ev.sourceUid !== null ? (ctx.unit(ev.sourceUid)?.core() ?? null) : null;
      if (src) await burnFly(ctx.scene, src, lpPoint(ctx, ev.player), { kind: 'fireball' });
    }
    await presentDamage(ctx, ev, { at });
  },
  P,
);

registerEvent(
  'lpGain',
  async (ctx) => {
    const ev = ctx.ev;
    if (!ctx.hints.delivered) {
      const src = ev.sourceUid !== null ? (ctx.unit(ev.sourceUid)?.core() ?? null) : null;
      await healFly(ctx.scene, src ?? { x: lpPoint(ctx, ev.player).x, y: lpPoint(ctx, ev.player).y - 60 }, lpPoint(ctx, ev.player));
    }
    await presentHeal(ctx, ev, { at: ctx.hints.at as XY | undefined });
  },
  P,
);

// ================================================================ destroy / graveyard

/**
 * destroy: monsters shatter into their own pixels (face-down ones flip up first), spells / traps
 * crack and dissolve (rule destroys just fade). Then the card arcs into its owner's graveyard
 * (the following toGraveyard of the same card is consumed).
 * hints: push (XY) burst direction, hit (false = no recoil flash first).
 */
registerEvent(
  'destroy',
  async (ctx) => {
    const ev = ctx.ev;
    const field = ctx.views.field;
    const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid, { until: (e) => e.type !== 'toGraveyard' && e.type !== 'destroy' && e.type !== 'fieldSpell' && e.type !== 'statChange' });
    const gEv = gi >= 0 ? (ctx.events[gi] as Extract<GameEvent, { type: 'toGraveyard' }>) : null;
    if (gi >= 0) ctx.consumeAt(gi);
    const owner = gEv ? gEv.owner : ctx.owner(ev.uid);
    const { tile, unit } = field.release(ev.uid);
    const home = tile ? tile.home : zoneXY(ev.player, ev.location === 'field' ? 'field' : ev.location, ev.zone);
    const from = { x: home.x, y: home.y - 4 };
    const jobs: Promise<void>[] = [];
    if (ev.location === 'monster') {
      if (unit && unit.sprite.visible) {
        if (tile) jobs.push(wait(ctx.scene, 220).then(() => tile.dissolve(520)).then(() => tile.destroy()));
        ctx.sfx('shatter', { volume: 0.9 });
        await shatterUnit(ctx, unit, { push: ctx.hints.push as XY | undefined, hit: ctx.hints.hit !== false });
      } else {
        unit?.retire();
        if (tile) {
          if (!tile.faceUp) {
            tile.setCard(ev.cardId);
            await tile.flipUp(260);
          }
          await tile.dissolve(480);
          tile.destroy();
        }
      }
      field.forget(ev.uid);
    } else if (tile) {
      if (ev.reason === 'rule') {
        await tile.fadeOut(260);
      } else {
        if (!tile.faceUp) {
          tile.setCard(ev.cardId);
          await tile.flipUp(240);
        }
        void tile.pulse(PAL.white, 160);
        ctx.sfx('shatter', { volume: 0.6, pitch: 1.3 });
        await tile.dissolve(520);
      }
      tile.destroy();
    }
    if (gEv) jobs.push(cardToGraveyard(ctx, { owner, cardId: ev.cardId, from }));
    await all(jobs);
  },
  P,
);

registerEvent(
  'toGraveyard',
  async (ctx) => {
    const ev = ctx.ev;
    const field = ctx.views.field;
    if (ev.from === 'monster' || ev.from === 'spellTrap' || ev.from === 'field') {
      if (field.tileOf(ev.uid)) {
        await tileToGraveyard(ctx, ev.uid, ev.owner, ev.cardId);
        field.forget(ev.uid);
        return;
      }
      const spot = ev.from === 'monster' ? 'monster' : ev.from === 'field' ? 'field' : 'spellTrap';
      const p = zoneXY(ev.owner, spot, ev.zone ?? 0);
      await cardToGraveyard(ctx, { owner: ev.owner, cardId: ev.cardId, from: { x: p.x, y: p.y - 4 } });
      return;
    }
    if (ev.from === 'resolved') {
      const p = ev.zone !== null ? zoneXY(ev.owner, 'spellTrap', ev.zone) : { x: GAME_W / 2, y: 150 };
      if (ev.zone !== null && field.tileOf(ev.uid)) {
        await tileToGraveyard(ctx, ev.uid, ev.owner, ev.cardId);
        return;
      }
      await cardToGraveyard(ctx, { owner: ev.owner, cardId: ev.cardId, from: p, scale: 0.6 });
      return;
    }
    // from hand (after a discard that was not animated)
    const at = ctx.views.hand.owner === ev.owner ? (ctx.views.hand.cardXY(ev.uid) ?? ctx.views.hand.nextSlotXY()) : ctx.views.hand.miniXY(ev.owner, 0);
    await cardToGraveyard(ctx, { owner: ev.owner, cardId: ev.cardId, from: at });
  },
  P,
);

registerEvent(
  'discard',
  async (ctx) => {
    const ev = ctx.ev;
    const hand = ctx.views.hand;
    const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid && e.from === 'hand');
    if (gi >= 0) ctx.consumeAt(gi);
    let from: XY;
    if (hand.owner === ev.player && hand.sprite(ev.uid)) {
      from = hand.cardXY(ev.uid) ?? hand.nextSlotXY();
      await hand.removeCard(ev.uid, 'dissolve');
    } else {
      from = hand.miniXY(ev.player, 0);
      const remaining = ctx.state.players[ev.player].hand.filter((u) => u !== ev.uid).map((u) => ({ uid: u, cardId: ctx.state.cards[u].cardId }));
      if (hand.owner !== ev.player) hand.setCards(remaining, ev.player);
    }
    ctx.sfx('burn', { volume: 0.5 });
    await cardToGraveyard(ctx, { owner: ctx.owner(ev.uid), cardId: ev.cardId, from: { x: from.x, y: Math.min(from.y, 300) } });
  },
  P,
);

// ================================================================ stats / equip / field

/** statChange: the badge rolls (green up / red down) with a floating ▲/▼ number. A run of
 * consecutive statChanges (field spells) plays together. Adds / removes volcano auras. */
registerEvent(
  'statChange',
  async (ctx) => {
    const group: Extract<GameEvent, { type: 'statChange' }>[] = [ctx.ev];
    for (let i = ctx.index + 1; i < ctx.events.length; i++) {
      const e = ctx.events[i];
      if (e.type !== 'statChange') break;
      group.push(e);
      ctx.consumeAt(i);
    }
    const volcano = ctx.after.players.some((p) => p.fieldSpell && CARDS[ctx.after.cards[p.fieldSpell.uid].cardId].id === 'volcano_arena');
    const single = group.length === 1;
    const jobs = group.map(async (e, k) => {
      await wait(ctx.scene, k * 180);
      const u = ctx.unit(e.uid);
      if (!u) return;
      const top = u.worldPoint('top');
      const up = e.atk > e.prevAtk || (e.atk === e.prevAtk && e.def > e.prevDef);
      ctx.sfx(up ? 'lpUp' : 'lpDown', { volume: 0.35 });
      if (volcano && (u.attribute === 'FIRE' || u.attribute === 'WATER') && !u.hasAura('volcano'))
        u.setAura('volcano', u.attribute === 'FIRE' ? flameAura(ctx.scene, u) : steamAura(ctx.scene, u));
      const atkSide = e.atk !== e.prevAtk;
      const from = atkSide ? e.prevAtk : e.prevDef;
      const to = atkSide ? e.atk : e.def;
      // one change: the full stat pop (rolling value + arrows); several at once (field spells):
      // just the delta over each monster so the numbers never pile up
      const pop = single
        ? statPop(ctx.scene, top.x, top.y - 6, from, to)
        : damageNumber(ctx.scene, top.x, top.y - 4, Math.abs(to - from), to >= from ? 'buff' : 'debuff');
      await all([u.setStats(e.atk, e.def, true), pop]);
    });
    await all(jobs);
  },
  P,
);

/** equip: the dragon-blade forge over the monster; the gold aura stays (unit aura slot 'equip'). */
registerEvent(
  'equip',
  async (ctx) => {
    const ev = ctx.ev;
    const u = ctx.unit(ev.targetUid);
    if (!u || !u.sprite.visible) return;
    ctx.sfx('equip', { volume: 0.9 });
    const aura = await swordForge(ctx.scene, u.sprite);
    u.setAura('equip', aura);
  },
  P,
);

/** fieldSpell: the arena transforms (volcano) or cools back to normal. */
registerEvent(
  'fieldSpell',
  async (ctx) => {
    const ev = ctx.ev;
    const volcano = ev.cardId === 'volcano_arena';
    if (!volcano) return;
    if (ev.active) {
      ctx.sfx('fieldChange', { volume: 0.9 });
      await all([ctx.views.board.setTheme('volcano', true, ev.player), setVolcanoAmbience(ctx.scene, true).then(() => undefined), wait(ctx.scene, 1100)]);
    } else {
      // only cool down if no other volcano took its place in this batch
      const stillHot = ctx.after.players.some((p) => p.fieldSpell && ctx.after.cards[p.fieldSpell.uid].cardId === 'volcano_arena');
      if (stillHot) return;
      await all([ctx.views.board.setTheme('normal', true), setVolcanoAmbience(ctx.scene, false).then(() => undefined)]);
    }
  },
  P,
);

/** target: lock-on reticles on every targeted zone. */
registerEvent(
  'target',
  async (ctx) => {
    const ev = ctx.ev;
    const color = PLAYER_COLOR[ev.player];
    const handles = ev.targets.map((r) => {
      const u = r.zone === 'monster' ? ctx.views.field.unitAt(r.player, r.index) : null;
      const t = ctx.views.field.tileAt(r.player, r.zone, r.index);
      const p = u && u.sprite.visible ? u.core() : t ? { x: t.home.x, y: t.home.y - 6 } : zoneXY(r.player, r.zone, r.index);
      return lockOn(ctx.scene, p.x, p.y, { color, size: u ? Math.max(24, Math.round(u.art.w * 0.4)) : 26 });
    });
    ctx.sfx('lockOn', { volume: 0.7 });
    await all(handles.map((h) => h.done));
    await wait(ctx.scene, 260);
    for (const h of handles) h.destroy();
  },
  P,
);

// ================================================================ generic activation

/**
 * activate (fallback for spells / traps / monster effects without a card hook):
 *   spell: showcase at the centre, then energy flies to the first target;
 *   trap:  the set card stands up, magenta burst, "TUZAK!";
 *   monster effect: the monster roars / glows.
 * The resolution events that follow play on their own.
 */
registerEvent(
  'activate',
  async (ctx) => {
    const ev = ctx.ev;
    if (ev.kind === 'monsterEffect') {
      const u = ctx.unit(ev.uid);
      if (u && u.sprite.visible) {
        ctx.sfx('summonCharge', { volume: 0.5 });
        const c = u.core();
        await all([u.play('roar'), sparkleBurst(ctx.scene, c.x, c.y, { ramp: ATTRIBUTE_RAMP[u.attribute], count: 16 })]);
      }
      return;
    }
    const run = resolutionRun(ctx);
    if (ev.kind === 'trap') {
      await trapReveal(ctx, ev.zone !== null ? ctx.views.field.tileAt(ev.player, 'spellTrap', ev.zone) : null);
      await playRun(ctx, run);
      return;
    }
    const tile = ev.from === 'spellTrap' && ev.zone !== null ? ctx.views.field.tileAt(ev.player, 'spellTrap', ev.zone) : null;
    const show = await spellShowcase(ctx, { uid: ev.uid, cardId: ev.cardId, player: ev.player, from: tile ?? 'hand' });
    const ti = run.find((i) => ctx.events[i].type === 'target');
    const tEv = ti !== undefined ? (ctx.events[ti] as Extract<GameEvent, { type: 'target' }>) : null;
    const r = tEv?.targets[0];
    const p = r ? zoneXY(r.player, r.zone, r.index) : lpPoint(ctx, ev.player);
    await show.release({ x: p.x, y: p.y - 10 });
    await playRun(ctx, run);
  },
  P,
);

// keep types referenced
export type _Unused = Uid | CardId | PlayerId | typeof isMonster | typeof attrRamp;
