// DUEL FLOW — discard (end-phase hand limit).
//
//   0 ms     the card lifts out of the hand (a hidden hand's card comes out of the mini-hand and
//            turns face-up: discards are public), shivers and catches fire at its bottom edge
//   ~330 ms  it burns away bottom → top into pixels: embers flare and rise, and the card's own
//            pixels stream in arcs across the board into its owner's graveyard
//   arrival  the graveyard pile takes the card (top card + count), flashes, sparkles
// Consecutive discards of one player play staggered; the paired toGraveyard events are consumed.

import { cardFaceCanvas } from '../../art/cards';
import { PAL, PLAYER_COLOR, PLAYER_RAMP, RAMPS } from '../../art/palette';
import type { PlayerId, Uid } from '../../engine/types';
import { CardSprite, burnAway } from '../../view/CardSprite';
import { DEPTH, type XY } from '../../view/layout';
import { MINI_CARD_W } from '../../view/ui-textures';
import { sparkleBurst } from '../../vfx/summon';
import { run } from '../../vfx/setpieces';
import { registerEvent } from '../api';
import { all, bg, cameraAtRest, emberStream, type AnyCtx, type Ctx, type EvOf } from './_kit';

type DiscardEv = EvOf<'discard'>;

/** Take the discarded card out of the hand view (the hidden hand spawns it at its mini-hand). */
function takeCard(ctx: AnyCtx, ev: DiscardEv, gone: Set<Uid>): CardSprite {
  const hand = ctx.views.hand;
  gone.add(ev.uid);
  if (hand.owner === ev.player) {
    const s = hand.takeCard(ev.uid);
    if (s) return s.setDepth(DEPTH.HAND + 30);
  }
  const at = hand.miniXY(ev.player, 0);
  if (hand.owner !== ev.player) {
    const remaining = ctx.state.players[ev.player].hand.filter((u) => !gone.has(u)).map((u) => ({ uid: u, cardId: ctx.state.cards[u].cardId }));
    hand.setCards(remaining, ev.player);
  }
  return new CardSprite(ctx.scene, at.x, at.y, ev.cardId, { faceUp: false, player: ev.player }).setDepth(DEPTH.HAND + 30).setScale(MINI_CARD_W / 48);
}

async function burnOne(ctx: AnyCtx, ev: DiscardEv, gone: Set<Uid>): Promise<void> {
  const sc = ctx.scene;
  const owner: PlayerId = ctx.owner(ev.uid);
  const pile = ctx.views.field.pile(owner, 'graveyard');
  const card = takeCard(ctx, ev, gone);
  card.setCard(ev.cardId);
  // 1. lift out of the hand (and reveal it if it came face-down)
  const viewerCard = card.scaleX > 0.5;
  const lift: XY = viewerCard ? { x: card.x, y: card.y - 24 } : { x: card.x - (ev.player === 1 ? 60 : -60), y: card.y + (ev.player === 1 ? 46 : -46) };
  ctx.sfx('cardSlide', { volume: 0.5 });
  const flight = card.flyTo(Math.round(lift.x), Math.round(lift.y), { ms: 220, arc: 6, scale: viewerCard ? 1 : 0.7, rotation: 0, anticipate: false, land: false });
  if (!card.faceUp) bg(card.flip(true, 200));
  await flight;
  // 2. it catches fire: shiver + hot flash creeping up
  ctx.sfx('burn', { volume: 0.55 });
  ctx.sfx('fireBurst', { volume: 0.25, pitch: 1.4 });
  bg(card.pulse(PAL.fire3, 260));
  const x0 = card.x;
  await run(sc, 110, (t) => {
    card.x = Math.round(x0 + (t < 1 ? Math.round(Math.sin(t * 40)) : 0));
  });
  card.x = x0;
  // 3. burn away: the card's pixels flare up and stream into the graveyard
  const pc = card.pixels;
  const s = card.scaleX;
  const cx = card.x;
  const cy = card.y;
  const place = (x: number, y: number): XY => ({ x: cx + (x + 0.5 - pc.w / 2) * s, y: cy + (y + 0.5 - pc.h / 2) * s });
  const face = sc.add.image(cx, cy, card.textureKey).setScale(s).setDepth(DEPTH.HAND + 32);
  card.setVisible(false);
  // fire for the burn itself; the card's own colours ride the stream
  const to = pile.topXY();
  const burn = burnAway(sc, face, cardFaceCanvas(ev.cardId), 560, PAL.fire3, { depth: DEPTH.HAND + 33, keep: 0.25, seed: ev.uid * 31 });
  ctx.sfx('whoosh', { volume: 0.35, pitch: 0.8 });
  await emberStream(sc, pc, place, { x: to.x, y: to.y - 4 }, {
    ramp: RAMPS.fire,
    burnMs: 330,
    flyMs: 520,
    every: s > 0.8 ? 3 : 2,
    depth: DEPTH.HAND + 34,
    onArrive: () => {
      pile.set(pile.count + 1, ev.cardId);
      pile.bump();
      bg(pile.flash(PLAYER_COLOR[owner]));
      ctx.sfx('cardPlace', { volume: 0.45, pitch: 0.9 });
      bg(sparkleBurst(sc, to.x, to.y - 4, { ramp: PLAYER_RAMP[owner], count: 10, depth: DEPTH.CARD_ON_TILE + 8 }));
    },
  });
  card.destroy();
  await all([burn.then(() => face.destroy()), ctx.wait(200)]);
}

registerEvent(
  'discard',
  async (ctx: Ctx<'discard'>) => {
    const first = ctx.ev;
    // this discard, the following discards of the same player, and their toGraveyard events
    const group: DiscardEv[] = [first];
    const ownGrave = (uid: Uid) => ctx.findType('toGraveyard', (e) => e.uid === uid && e.from === 'hand');
    const gi0 = ownGrave(first.uid);
    if (gi0 >= 0) ctx.consumeAt(gi0);
    for (let i = ctx.index + 1; i < ctx.events.length; i++) {
      const e = ctx.events[i];
      if (ctx.isConsumed(i)) continue;
      if (e.type === 'discard' && e.player === first.player) {
        group.push(e);
        ctx.consumeAt(i);
        const gi = ownGrave(e.uid);
        if (gi >= 0) ctx.consumeAt(gi);
        continue;
      }
      if (e.type === 'toGraveyard' && e.from === 'hand') continue;
      break;
    }
    if (!cameraAtRest(ctx)) await ctx.unfocus(140);
    const gone = new Set<Uid>();
    await all(group.map((ev, k) => ctx.wait(k * 190).then(() => burnOne(ctx, ev, gone))));
  },
  { name: 'flow:discard' },
);

