// DUEL FLOW — draw (≤ 0.35 s).
//
//   0 ms    the deck's top card lifts off the tile (an iso card rises with a glint in the
//           player's colour; the stack drops by one and bumps)
//   20 ms   the card arcs into the hand (HandView.addCard): the viewer's card flips face-up in
//           flight and the hand re-fans; the other player's card stays face-down and joins the
//           mini-hand. The handler resolves at ≈ 0.35 s, the landing punch is a decorative tail.

import { PAL, PLAYER_RAMP } from '../../art/palette';
import { DEPTH } from '../../view/layout';
import { TEX } from '../../vfx/core';
import { Sparks, run } from '../../vfx/setpieces';
import { registerEvent } from '../api';
import { ADD, bg, cameraAtRest, isoGhost, rr, type Ctx } from './_kit';

registerEvent(
  'draw',
  async (ctx: Ctx<'draw'>) => {
    const { player, uid, cardId } = ctx.ev;
    const v = ctx.views;
    const sc = ctx.scene;
    // hand flights are screen-space: the world camera must be at rest
    if (!cameraAtRest(ctx)) await ctx.unfocus(100);
    const pile = v.field.pile(player, 'deck');
    const top = pile.topXY();
    const R = PLAYER_RAMP[player];
    pile.set(Math.max(0, pile.count - 1), null);
    pile.bump();
    // the lift: the top card rises off the stack with a glint and hands over to the flying card
    const ghost = isoGhost(sc, player, top, DEPTH.CARD_ON_TILE + 3);
    const glint = isoGhost(sc, player, top, DEPTH.CARD_ON_TILE + 3.5).setTintFill(R[4]).setBlendMode(ADD).setAlpha(0.7);
    bg(
      run(sc, 160, (t) => {
        if (!ghost.active) return;
        const y = Math.round(top.y - 11 * (1 - (1 - t) * (1 - t)));
        ghost.y = y;
        glint.y = y;
        glint.setAlpha(0.7 * (1 - t) * (1 - t));
        ghost.setAlpha(t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45);
      }).then(() => {
        ghost.destroy();
        glint.destroy();
      }),
    );
    const sp = new Sparks(sc, DEPTH.CARD_ON_TILE + 4, ADD);
    sp.burst(6, (i) => ({ x: top.x + rr(-10, 10), y: top.y - 2 + rr(-2, 2), vx: rr(-10, 10), vy: rr(-55, -26), life: rr(220, 320), delay: i * 16, ramp: [PAL.white, R[4], R[3]], tex: TEX.px1 }));
    sp.close();
    await ctx.wait(20);
    const fly = v.hand.addCard(uid, cardId, { x: top.x, y: top.y - 11 }, player);
    bg(fly);
    // the viewer's card stands up out of the deck as it lifts (inner scale; the flight owns the outer)
    const card = v.hand.owner === player ? v.hand.sprite(uid) : null;
    if (card) {
      card.inner.scaleY = 0.35;
      bg(ctx.tween({ targets: card.inner, scaleY: 1, duration: 85, ease: 'Quad.Out' }));
    }
    // resolve once the in-flight reveal flip is over (≈ 0.36 s): an instant follow-up action may
    // take this very card out of the hand; only the landing punch is left as a tail
    await Promise.race([fly.catch(() => undefined), ctx.wait(330)]);
  },
  { name: 'flow:draw' },
);
