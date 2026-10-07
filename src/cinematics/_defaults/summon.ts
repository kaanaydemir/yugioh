// Default cinematics: summons, tributes, sets, flips and position changes.
import { CARDS, isMonster, type MonsterId } from '../../data/cards';
import type { GameEvent, PlayerId, Uid } from '../../engine/types';
import { ATTRIBUTE_RAMP, PAL, PLAYER_COLOR } from '../../art/palette';
import { wait } from '../../vfx/core';
import { flipBurst, setPulse, tributeStream } from '../../vfx/summon';
import { materialize } from '../../vfx/hologram';
import { zoneXY } from '../../view/layout';
import { DEFAULT_PRIORITY, registerEvent } from '../_core/registry';
import type { CinematicContext } from '../_core/types';
import { all, attrOf, cardToGraveyard, hexShield, isAce, slamToZone, summonEntrance, takeHandCard } from '../_core/helpers';

const P = { priority: DEFAULT_PRIORITY };

type Ctx<T extends GameEvent['type']> = CinematicContext<Extract<GameEvent, { type: T }>>;

// ================================================================ summon

/**
 * summon (normal / tribute from the hand, special from the graveyard). Flip summons are played
 * by the flip handler (it consumes the paired summon event).
 *   hand:      the card flies from the hand and slams onto the tile (impact at ~250 ms), then the
 *              attribute summon set piece (+ cut-in for aces on tribute summons).
 *   graveyard: (soul_recall) the card materializes on the tile with a flash, then the set piece.
 * hints.noCard = true → skip the card flight (a signature handler placed the tile already).
 */
registerEvent(
  'summon',
  async (ctx) => {
    const ev = ctx.ev;
    const v = ctx.views;
    await v.camera.unfocus(120);
    const field = v.field;
    const atk = ctx.atk(ev.uid, 'next');
    const def = ctx.def(ev.uid, 'next');
    if (ev.from === 'field') {
      // flip summon reached directly (no flip handler ran): reveal in place
      const u = field.addUnit(ev.uid, { hidden: true, atk, def, position: 'attack' });
      const t = field.tileOf(ev.uid);
      if (t && (!t.faceUp || t.orientation !== 'up')) {
        await t.flipUp(320);
        await t.rotateTo('up', 240);
      }
      if (u) await summonEntrance(ctx, u, {});
      return;
    }
    const ace = isAce(ev.cardId);
    if (ev.from === 'hand' && !ctx.hints.noCard) {
      const card = takeHandCard(ctx, ev.player, ev.uid, ev.cardId);
      void v.duelists?.get(ev.player).play('command');
      ctx.sfx('cardSlam', { volume: 0.8 });
      await slamToZone(ctx, card, { player: ev.player, spot: 'monster', index: ev.zone, uid: ev.uid, cardId: ev.cardId, faceUp: true, ms: 340, shake: 2 });
    } else if (!field.tileOf(ev.uid)) {
      const t = field.placeCard(ev.player, 'monster', ev.zone, ev.uid, ev.cardId, true, 'up');
      t.tileFlash(PLAYER_COLOR[ev.player], 320);
      t.ringBurst(PAL.white, 360);
    }
    const unit = field.addUnit(ev.uid, { hidden: true, atk, def, position: ev.position });
    if (!unit) return;
    await summonEntrance(ctx, unit, { big: ev.method === 'tribute' || ace, cutIn: ace && ev.method === 'tribute' });
  },
  P,
);

// ================================================================ tribute

/**
 * tribute: every tribute for the same summon at once — each tributed monster flashes white and
 * streams its own pixels into the destination tile while its card drops into the graveyard.
 * Consumes the tribute events, their toGraveyard events and the equip rule-destroys in between.
 * Resolves near the end of the stream so the summoned card's slam overlaps it.
 */
registerEvent(
  'tribute',
  async (ctx) => {
    const ev = ctx.ev;
    const field = ctx.views.field;
    await ctx.views.camera.unfocus(120);
    // the destination zone: the summon / set of forUid later in the batch
    const destIdx = ctx.find((e) => (e.type === 'summon' || e.type === 'setMonster') && e.uid === ev.forUid, { includeConsumed: true });
    const dest = destIdx >= 0 ? (ctx.events[destIdx] as Extract<GameEvent, { type: 'summon' | 'setMonster' }>) : null;
    const to = dest ? zoneXY(dest.player, 'monster', dest.zone) : zoneXY(ev.player, 'monster', ev.zone);
    const summonedId = ctx.state.cards[ev.forUid]?.cardId;
    const attr = summonedId && isMonster(CARDS[summonedId]) ? attrOf(summonedId) : attrOf(ev.cardId);
    // collect this tribute group
    const group: { uid: Uid; cardId: MonsterId; owner: PlayerId; zone: number }[] = [{ uid: ev.uid, cardId: ev.cardId as MonsterId, owner: ctx.owner(ev.uid), zone: ev.zone }];
    for (let i = ctx.index + 1; i < ctx.events.length; i++) {
      const e = ctx.events[i];
      if (e.type === 'tribute' && e.forUid === ev.forUid) {
        group.push({ uid: e.uid, cardId: e.cardId as MonsterId, owner: ctx.owner(e.uid), zone: e.zone });
        ctx.consumeAt(i);
      } else if (e.type === 'toGraveyard' && group.some((g) => g.uid === e.uid)) ctx.consumeAt(i);
      else if (e.type === 'destroy' && e.reason === 'rule' && group.some((g) => g.uid === e.sourceUid)) {
        // the tributed monster's equip breaks: play it (default fades it to the graveyard)
        void ctx.play(i);
      } else if (e.type === 'toGraveyard') continue;
      else break;
    }
    ctx.sfx('tribute', { volume: 0.9 });
    const streams: Promise<void>[] = [];
    group.forEach((g, i) => {
      const { tile, unit } = field.release(g.uid);
      const from = tile ? tile.home : zoneXY(ev.player, 'monster', g.zone);
      streams.push(
        (async () => {
          await wait(ctx.scene, i * 140);
          if (tile) void tile.dissolve(560).then(() => tile.destroy());
          if (unit && unit.sprite.visible) {
            unit.badge.setVisible(false);
            await tributeStream(ctx.scene, unit.sprite, { x: to.x, y: to.y - 6 }, { attribute: attr });
          } else await wait(ctx.scene, 600);
          unit?.retire();
          field.forget(g.uid);
        })(),
      );
      void cardToGraveyard(ctx, { owner: g.owner, cardId: g.cardId, from: { x: from.x, y: from.y - 4 }, delay: 260 + i * 140 });
    });
    // let the card slam overlap the end of the stream
    await Promise.race([all(streams), wait(ctx.scene, 640 + (group.length - 1) * 140)]);
  },
  P,
);

// ================================================================ set

registerEvent(
  'setMonster',
  async (ctx) => {
    const ev = ctx.ev;
    await ctx.views.camera.unfocus(120);
    const cardId = ctx.state.cards[ev.uid]?.cardId ?? null;
    const card = takeHandCard(ctx, ev.player, ev.uid, null);
    card.setFaceUp(false);
    ctx.sfx('cardSlide', { volume: 0.7 });
    const tile = await slamToZone(ctx, card, { player: ev.player, spot: 'monster', index: ev.zone, uid: ev.uid, cardId: cardId!, faceUp: false, orientation: 'side', ms: 380, impact: false });
    ctx.sfx('cardSet', { volume: 0.9 });
    await all([setPulse(ctx.scene, tile.home.x, tile.home.y, PLAYER_COLOR[ev.player]), tile.pulse(PLAYER_COLOR[ev.player], 380)]);
  },
  P,
);

registerEvent(
  'setSpellTrap',
  async (ctx) => {
    const ev = ctx.ev;
    await ctx.views.camera.unfocus(120);
    const cardId = ctx.state.cards[ev.uid]?.cardId ?? null;
    const card = takeHandCard(ctx, ev.player, ev.uid, null);
    card.setFaceUp(false);
    ctx.sfx('cardSlide', { volume: 0.7 });
    const tile = await slamToZone(ctx, card, { player: ev.player, spot: 'spellTrap', index: ev.zone, uid: ev.uid, cardId: cardId!, faceUp: false, orientation: 'up', ms: 380, impact: false });
    ctx.sfx('cardSet', { volume: 0.9 });
    await all([setPulse(ctx.scene, tile.home.x, tile.home.y, PLAYER_COLOR[ev.player]), tile.pulse(PLAYER_COLOR[ev.player], 380)]);
  },
  P,
);

// ================================================================ flip

/**
 * flip: the face-down card hops and turns face-up, an attribute burst, the monster springs out.
 *   flipSummon: also plays the paired summon (consumed): the card turns to attack, roar.
 *   attacked:   stays in defense (guard pose), quick — the battle continues right after.
 */
registerEvent(
  'flip',
  async (ctx) => {
    const ev = ctx.ev;
    const v = ctx.views;
    const field = v.field;
    const flipSummon = ev.cause === 'flipSummon';
    if (flipSummon) {
      const si = ctx.findType('summon', (e) => e.uid === ev.uid && e.method === 'flip');
      if (si >= 0) ctx.consumeAt(si);
      void v.duelists?.get(ev.player).play('command');
    }
    let tile = field.tileOf(ev.uid);
    if (!tile) tile = field.placeCard(ev.player, 'monster', ev.zone, ev.uid, ev.cardId, false, 'side');
    tile.setCard(ev.cardId);
    const attr = attrOf(ev.cardId);
    const home = tile.home;
    ctx.sfx('flipReveal', { volume: 0.9 });
    await tile.flipUp(flipSummon ? 380 : 300);
    const atk = ctx.atk(ev.uid, flipSummon ? 'after' : 'next');
    const def = ctx.def(ev.uid, flipSummon ? 'after' : 'next');
    const unit = field.addUnit(ev.uid, { hidden: true, atk, def, position: flipSummon ? 'attack' : 'defense' });
    const turn = flipSummon && tile.orientation !== 'up' ? tile.rotateTo('up', 260) : Promise.resolve();
    await flipBurst(ctx.scene, home.x, home.y, attr);
    if (!unit) return;
    unit.position = flipSummon ? 'attack' : 'defense';
    unit.badge.setPosition(unit.position);
    unit.sprite.setPosition(home.x, home.y - unit.hover);
    unit.rest();
    const mat = materialize(ctx.scene, unit.sprite, { attribute: attr, ms: flipSummon ? 460 : 380 });
    unit.showSprite();
    await mat;
    await turn;
    void unit.badge.pop();
    if (flipSummon) {
      ctx.sfx('roarSmall', { volume: 0.8 });
      await unit.play('roar');
    } else await wait(ctx.scene, 160);
    void ATTRIBUTE_RAMP;
  },
  P,
);

// ================================================================ position change

registerEvent(
  'positionChange',
  async (ctx) => {
    const ev = ctx.ev;
    const unit = ctx.unit(ev.uid);
    const tile = ctx.tile(ev.uid);
    if (!unit) {
      if (tile) await tile.rotateTo(ev.position === 'defense' ? 'side' : 'up');
      return;
    }
    ctx.sfx('cardSlide', { volume: 0.6 });
    if (ev.position === 'defense') {
      const c = unit.core();
      await all([unit.setPosition('defense', true), wait(ctx.scene, 140).then(() => hexShield(ctx.scene, c.x, c.y, PAL.water3))]);
      ctx.sfx('shieldBlock', { volume: 0.4 });
    } else {
      ctx.sfx('roarSmall', { volume: 0.6 });
      await unit.setPosition('attack', true);
    }
  },
  P,
);
