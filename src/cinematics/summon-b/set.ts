// Set (GAME_DESIGN §6 setMonster / setSpellTrap): the card flies FACE-DOWN from the hand and
// slams onto its zone — sideways (defense) for a monster, upright for a spell/trap — with a
// soft "set" thunk, a puff of dust, a player-coloured seal that snaps shut around the card
// (a diamond closing in on the tile edge) followed by the outward set pulse, and a sheen
// sweep across the card back. ≈0.75 s. The card identity stays hidden (no card hook).

import type { GameEvent } from '../../engine/types';
import { PAL, PLAYER_COLOR, PLAYER_RAMP } from '../../art/palette';
import { DEPTH, TILE_H, TILE_W } from '../../view/layout';
import { setPulse } from '../../vfx/summon';
import { registerEvent, type CinematicContext } from '../api';
import { E, bg, capped, diamond, liveLayer, loop, run, slamCard } from './_kit';

type SetCtx = CinematicContext<Extract<GameEvent, { type: 'setMonster' | 'setSpellTrap' }>>;

/** A player-coloured diamond seal closing in on the tile (lands as the card does). */
function sealClose(ctx: SetCtx, x: number, y: number, ms: number): Promise<void> {
  const ramp = PLAYER_RAMP[ctx.ev.player];
  const layer = liveLayer(ctx.scene, x, y, TILE_W + 40, TILE_H + 24, DEPTH.TILE_FX + 2, () => undefined);
  return run(ctx.scene, ms, (t) => {
    layer.r.draw((r) => {
      const k = E.inQ(t);
      const hw = TILE_W / 2 + 14 * (1 - k);
      const hh = TILE_H / 2 + 7 * (1 - k);
      const lv = t < 0.85 ? 0.35 + 0.65 * t : 1;
      loop(r, diamond(x, y, hw, hh), t > 0.85 ? PAL.white : ramp[3], lv);
      // corner ticks
      for (const p of diamond(x, y, hw + 2, hh + 1)) r.px(p.x, p.y, ramp[4]);
    });
  }).then(() => layer.stop());
}

async function setCard(ctx: SetCtx, spot: 'monster' | 'spellTrap'): Promise<void> {
  const ev = ctx.ev;
  void ctx.views.camera.unfocus(120);
  const cardId = ctx.state.cards[ev.uid]?.cardId;
  if (!cardId) return;
  const MS = 340;
  ctx.sfx('cardSlide', { volume: 0.7 });
  const { tile, done } = slamCard(ctx, {
    player: ev.player,
    spot,
    index: ev.zone,
    uid: ev.uid,
    cardId,
    faceUp: false,
    orientation: spot === 'monster' ? 'side' : 'up',
    ms: MS,
    impact: false,
    faceDownFlight: true,
  });
  const home = tile.home;
  bg(ctx.wait(MS * 0.3).then(() => sealClose(ctx, home.x, home.y, MS * 0.44)));
  await ctx.wait(Math.round(MS * 0.74));
  // the soft landing: thunk, a little dust, the player's pulse
  ctx.sfx('cardSet', { volume: 0.9 });
  tile.dust(10, 0.6);
  const col = PLAYER_COLOR[ev.player];
  await capped(ctx.scene, Promise.all([setPulse(ctx.scene, home.x, home.y, col, { count: 2, ms: 380 }), tile.pulse(col, 360), done]), 700);
  if (tile.active) tile.playSheen();
}

registerEvent('setMonster', (ctx) => setCard(ctx, 'monster'), { name: 'summon-b:setMonster' });
registerEvent('setSpellTrap', (ctx) => setCard(ctx, 'spellTrap'), { name: 'summon-b:setSpellTrap' });
