// Tribute choreography (GAME_DESIGN §6 "tribute + kurbanlı çağırma"), for every tribute in the
// game (all Tribute Summons are summon-a's aces; Tribute Sets are handled too).
//
// Face-up Tribute Summon — one continuous sequence, the summon is played from here:
//     0  the summoned card leaves the hand and rises to hover over the destination tile
//   120  each tributed monster flashes white, shivers as a hologram (staggered 110 ms) ...
//   ~260 ... and peels into a ribbon of its own pixels that arcs INTO the hovering card, which
//        glows brighter with every pixel; the old tile cards burn away, their cards arc to the
//        graveyard
//   ~860 the card swallows the last light (white pulse), then slams down onto the tile
//  ~1050 impact → ctx.play(summon, { tribute: true, noCard: true }): the monster's signature
//        entrance follows seamlessly (bigger circle; aces get the cut-in at their climax beat)
// Tribute Set (face-down): the streams pour into the destination tile in the player's colour
// (the set card stays secret) and the set handler's slam overlaps their end.
//
// Consumes the group's tribute + toGraveyard events, plays the tributed monsters' equip
// rule-destroys alongside, and (face-up case) plays the summon event itself — so the board is
// never re-synced half-way through.

import Phaser from 'phaser';
import { CARDS, isMonster, type CardId, type MonsterId } from '../../data/cards';
import type { GameEvent, PlayerId, Uid } from '../../engine/types';
import { ATTRIBUTE_RAMP, PAL, PLAYER_RAMP, type Ramp } from '../../art/palette';
import { DEPTH, type XY, zoneXY } from '../../view/layout';
import { wait } from '../../vfx/core';
import { sparkleBurst } from '../../vfx/summon';
import type { CardSprite } from '../../view/CardSprite';
import { fx, registerEvent } from '../api';
import { E, beat, bg, bodyBox, defuseCard, settleCamera, glowPop, pixelStream, playSfx, run, seed, softGlow, tileStream } from './_kit';

type SummonEv = Extract<GameEvent, { type: 'summon' }>;
type SetEv = Extract<GameEvent, { type: 'setMonster' }>;

interface Trib {
  uid: Uid;
  cardId: CardId;
  owner: PlayerId;
  zone: number;
}

registerEvent(
  'tribute',
  async (ctx) => {
    const ev = ctx.ev;
    const sc = ctx.scene;
    const v = ctx.views;
    const field = v.field;
    seed(ev.uid * 17 + ev.forUid);
    beat(sc, 'start');
    await settleCamera(ctx);

    // ---- this tribute group (+ its graveyard moves, + equip rule-destroys played alongside)
    const group: Trib[] = [{ uid: ev.uid, cardId: ev.cardId, owner: ctx.owner(ev.uid), zone: ev.zone }];
    const side: Promise<void>[] = [];
    for (let i = ctx.index + 1; i < ctx.events.length; i++) {
      if (ctx.isConsumed(i)) continue;
      const e = ctx.events[i];
      if (e.type === 'tribute' && e.forUid === ev.forUid) {
        group.push({ uid: e.uid, cardId: e.cardId, owner: ctx.owner(e.uid), zone: e.zone });
        ctx.consumeAt(i);
      } else if (e.type === 'toGraveyard' && group.some((g) => g.uid === e.uid)) ctx.consumeAt(i);
      else if (e.type === 'destroy' && e.reason === 'rule' && group.some((g) => g.uid === e.sourceUid)) side.push(ctx.play(i));
      else if (e.type === 'toGraveyard') continue;
      else break;
    }

    // ---- where it goes
    const di = ctx.find((e) => (e.type === 'summon' || e.type === 'setMonster') && e.uid === ev.forUid);
    const dEv = di >= 0 ? (ctx.events[di] as SummonEv | SetEv) : null;
    const faceUp = !!dEv && dEv.type === 'summon' && dEv.from === 'hand';
    const destP: PlayerId = dEv ? dEv.player : ev.player;
    const to = dEv ? zoneXY(dEv.player, 'monster', dEv.zone) : zoneXY(ev.player, 'monster', ev.zone);
    const summonedId = ctx.state.cards[ev.forUid]?.cardId;
    // a set monster stays secret: neutral player colours instead of its attribute
    const ramp: Ramp = faceUp && summonedId && isMonster(CARDS[summonedId]) ? ATTRIBUTE_RAMP[CARDS[summonedId].attribute] : PLAYER_RAMP[destP];

    // release every tributed monster now (the destination may be one of their zones)
    const rel = group.map((g) => ({ g, ...field.release(g.uid) }));

    // ---- the summoned card rises over the tile (face-up summons only) — above the head of a
    // tribute standing on that very tile, so its white flash stays in view
    let card: CardSprite | null = null;
    let hoverY = to.y - 48;
    for (const { g, unit } of rel) {
      if (!dEv || g.owner !== dEv.player || g.zone !== dEv.zone || !unit || !unit.sprite.visible) continue;
      hoverY = Math.min(hoverY, Math.round(bodyBox(unit).top) - 26);
    }
    const hover: XY = { x: to.x, y: Math.max(52, hoverY) };
    let glow: Phaser.GameObjects.Image | null = null;
    let fill = 0;
    const hold: { bob: Phaser.Tweens.Tween | null } = { bob: null };
    const target = (): XY => (card && card.active ? { x: card.x, y: card.y } : { x: to.x, y: to.y - 6 });
    let lift: Promise<void> = Promise.resolve();
    if (faceUp && dEv) {
      card = fx.takeHandCard(ctx, dEv.player, dEv.uid, dEv.cardId);
      defuseCard(sc, card);
      void v.duelists?.get(dEv.player).play('command');
      ctx.sfx('cardSlide', { volume: 0.8 });
      const c = card;
      lift = (async () => {
        await c.flyTo(hover.x, hover.y, { ms: 300, arc: 44, scale: 0.8, reveal: !c.faceUp, rotation: 0, land: false, anticipate: false, ease: 'Cubic.Out' });
        if (!c.active) return;
        c.setDepth(DEPTH.FX + 4);
        c.setHighlight(ramp[3]);
        glow = softGlow(sc, hover.x, hover.y, ramp[3], 0.9, 0.5, DEPTH.FX + 3);
        hold.bob = sc.tweens.add({ targets: c, y: hover.y - 2, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        c.playSweep(true);
      })();
    }

    // ---- the tributes pour into it
    playSfx('tribute', { volume: 0.9 });
    const streams: Promise<void>[] = [];
    rel.forEach(({ g, tile, unit }, i) => {
      const from = tile ? tile.home : zoneXY(g.owner, 'monster', g.zone);
      streams.push(
        (async () => {
          await wait(sc, 80 + i * 90);
          if (tile) bg(tile.dissolve(480).then(() => tile.destroy()));
          const onArrive = (k: number) => {
            fill = Math.max(fill, (i + k) / rel.length);
            if (glow && glow.active) glow.setScale(0.9 + fill * 1.6).setAlpha(0.5 + fill * 0.5);
          };
          if (unit && unit.sprite.active && unit.sprite.visible) {
            unit.badge.setVisible(false);
            await pixelStream(sc, unit.sprite, { ramp, target, bend: i % 2 === 0 ? 1 : -1, ms: 440, onArrive });
          } else await tileStream(sc, { x: from.x, y: from.y - 4 }, { ramp, target, ms: 440, onArrive });
          unit?.retire();
          field.forget(g.uid);
        })(),
      );
      bg(fx.cardToGraveyard(ctx, { owner: g.owner, cardId: g.cardId as MonsterId, from: { x: from.x, y: from.y - 4 }, delay: 240 + i * 90 }));
    });

    if (!faceUp || !dEv || !card) {
      // tribute set / no destination: streams into the tile, the set slam overlaps the end
      await Promise.race([fx.all(streams), wait(sc, 420 + (group.length - 1) * 90)]);
      bg(fx.all(side));
      return;
    }

    // ---- face-up: the card swallows the light, then slams down
    const c = card;
    try {
      await lift;
      beat(sc, 'hover');
      await fx.all(streams);
      beat(sc, 'streams done');
      hold.bob?.stop();
      if (c.active) {
        playSfx('summonCharge', { volume: 0.7 });
        void c.pulse(PAL.white, 220);
        bg(glowPop(sc, c.x, c.y, ramp[4], { from: 0.8, to: 3.2, alpha: 0.9, ms: 260, depth: DEPTH.FX + 3 }));
        bg(sparkleBurst(sc, c.x, c.y, { ramp, count: 14, speed: 0.8 }));
        // a short rise before the drop (anticipation)
        const y0 = c.y;
        await run(sc, 80, (t) => c.setY(Math.round(y0 - 6 * E.outCubic(t))));
      }
      const g0 = glow as Phaser.GameObjects.Image | null;
      if (g0 && g0.active) bg(run(sc, 160, (t) => g0.setAlpha(0.8 * (1 - t))).then(() => g0.destroy()));
      const from = c.active ? { x: c.x, y: c.y } : hover;
      const scale = c.active ? c.scaleX : 0.8;
      // (no setHighlight(null) here: its 120 ms fade-out tween touches the card after destroy)
      defuseCard(sc, c);
      c.destroy();
      card = null;
      ctx.sfx('cardSlam', { volume: 1 });
      const tile = field.placeCard(dEv.player, 'monster', dEv.zone, dEv.uid, dEv.cardId, true, 'up');
      await tile.slamIn(from, 220, { fromScale: scale, arc: 4, shake: 3 });
      beat(sc, 'slammed');
      tile.tileFlash(ramp[3], 380);
      bg(fx.all(side));
    } finally {
      if (card && (card as CardSprite).active) {
        defuseCard(sc, card);
        (card as CardSprite).destroy();
      }
      const g1 = glow as Phaser.GameObjects.Image | null;
      if (g1 && g1.active) g1.destroy();
    }
    await ctx.play(di, { tribute: true, noCard: true });
  },
  { name: 'summon-a:tribute' },
);
