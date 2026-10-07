// DUEL FLOW — deck out and game over.
//
// deckOut (~2 s)
//   the camera leans toward the empty deck tile; the duelist reaches for a card that is not
//   there: a hologram card tries to form above the tile, flickers red with static and breaks
//   apart, the tile flashes red three times with a blinking "0", the duelist recoils, then
//   "DESTE BİTTİ!" slams in crimson.
// gameOver (~4 s, then the game-over prompt)
//   (the killing blow already played in slow motion — see turn.ts' observer)
//   the loser's side goes dark and their holograms short out and collapse one by one, the loser
//   kneels ('defeat'); the camera turns to the winner: a gold beam strikes their podium, they
//   raise a fist ('victory') and their monsters roar; the victory fanfare starts and
//   "KAZANAN: OYUNCU n" punches in with gold fireworks (banners.victory); then the screen hands
//   over to the game-over prompt.

import { PAL, RAMPS } from '../../art/palette';
import type { PlayerId } from '../../engine/types';
import { pixelText } from '../../ui/text';
import { DEPTH, zoneXY } from '../../view/layout';
import { shake } from '../../vfx/core';
import { banner, clearBanners, victory } from '../../vfx/banners';
import { dematerialize, glitch } from '../../vfx/hologram';
import { shockwave, sparkleBurst } from '../../vfx/summon';
import { Sparks, run } from '../../vfx/setpieces';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { registerEvent } from '../api';
import { ADD, all, beamDrop, bg, other, rnd, rr, type AnyCtx, type Ctx } from './_kit';
import { CARD_BACK } from '../../art/cards';

// ================================================================ deck out

registerEvent(
  'deckOut',
  async (ctx: Ctx<'deckOut'>) => {
    const p = ctx.ev.player;
    const sc = ctx.scene;
    const v = ctx.views;
    const at = zoneXY(p, 'deck');
    bg(ctx.focus({ x: at.x, y: at.y - 10 }, { zoom: 1.07, ms: 320, pan: 0.45 }));
    const duelist = v.duelists?.get(p);
    if (duelist) bg(duelist.play('command'));
    await ctx.wait(200);
    // a card tries to form over the empty deck and fails: a torn red hologram of a card back
    const ghost = sc.add.image(at.x, at.y - 18, CARD_BACK).setScale(0.5).setDepth(DEPTH.CARD_ON_TILE + 6).setAlpha(0);
    const zero = pixelText(sc, at.x, at.y + 12, '0', { size: 'md', color: PAL.crim3, originX: 0.5, originY: 0.5 }).setDepth(DEPTH.FX + 10);
    ctx.sfx('uiError', { volume: 0.6 });
    ctx.sfx('darkPulse', { volume: 0.3, pitch: 1.4 });
    const flashes = [0, 170, 340].map((d) => ctx.wait(d).then(() => v.board.flashTile(p, 'deck', 0, PAL.crim3, 260)));
    const H = ghost.height;
    await run(sc, 560, (t, el) => {
      if (!ghost.active) return;
      // static: flicker, red tint, horizontal tearing, a failed rise
      const on = rnd() < 0.75 - t * 0.35;
      ghost.setAlpha(on ? 0.5 + 0.45 * rnd() : 0.12);
      if (rnd() < 0.5) ghost.setTintFill(rnd() < 0.6 ? PAL.crim3 : PAL.crim1);
      else ghost.setTint(PAL.crim4);
      ghost.x = Math.round(at.x + (rnd() < 0.4 ? rr(-3, 3) : 0));
      ghost.y = Math.round(at.y - 18 - 7 * Math.sin(Math.min(1, el / 380) * Math.PI * 0.5));
      if (rnd() < 0.45) {
        const y0 = Math.floor(rr(0, H * 0.7));
        ghost.setCrop(0, y0, ghost.width, Math.floor(rr(H * 0.2, H - y0)));
      } else ghost.setCrop();
      zero.setVisible(Math.floor(el / 90) % 2 === 0);
    });
    // it breaks apart
    const sp = new Sparks(sc, DEPTH.CARD_ON_TILE + 9, ADD);
    sp.burst(22, () => ({ x: ghost.x + rr(-11, 11), y: ghost.y + rr(-15, 15), vx: rr(-60, 60), vy: rr(-70, -10), ay: 140, drag: 1.2, life: rr(260, 460), ramp: [PAL.white, PAL.crim4, PAL.crim3, PAL.crim1] }));
    sp.close();
    ghost.destroy();
    ctx.sfx('shatter', { volume: 0.4, pitch: 1.5 });
    bg(shake(sc, 200, 2));
    if (duelist) bg(duelist.play('hurt'));
    await all(flashes);
    zero.setVisible(true);
    const ban = banner(sc, 'DESTE BİTTİ!', { style: 'big', color: PAL.crim3 });
    ctx.sfx('defeat', { volume: 0.5 });
    await ctx.wait(500);
    bg(ctx.unfocus(500));
    await ban;
    zero.destroy();
  },
  { name: 'flow:deckOut' },
);

// ================================================================ game over

/** A hologram shorts out: glitch spike, collapse into rising bits; stays hidden through syncs. */
async function collapse(ctx: AnyCtx, u: MonsterUnit): Promise<void> {
  const sc = ctx.scene;
  if (!u.sprite.active || !u.sprite.visible || u.retired) return;
  u.posed = true;
  u.badge.setVisible(false);
  for (const k of ['equip', 'volcano']) if (u.hasAura(k)) u.setAura(k, null);
  ctx.sfx('darkPulse', { volume: 0.3, pitch: 1.6 });
  await glitch(sc, u.sprite, 280, 1, { attribute: u.attribute });
  ctx.sfx('shatter', { volume: 0.35, pitch: 0.7 });
  await dematerialize(sc, u.sprite, 520, { attribute: u.attribute });
  u.sprite.setVisible(false);
  u.shadow.setVisible(false);
}

registerEvent(
  'gameOver',
  async (ctx: Ctx<'gameOver'>) => {
    const sc = ctx.scene;
    const v = ctx.views;
    const winner: PlayerId = ctx.ev.winner;
    const loser = other(winner);
    ctx.music.stop(500);
    bg(v.camera.unfocus(260));
    v.speed.slowMo(0.7, 500);
    try {
      // 1. the loser's holograms short out one by one; the loser kneels
      v.board.setActivePlayer(winner, true);
      const losers = v.field
        .units()
        .filter((u) => u.player === loser && !u.retired && u.sprite.active && u.sprite.visible)
        .sort((a, b) => a.home.x - b.home.x);
      const falls = losers.map((u, i) => ctx.wait(60 + i * 140).then(() => collapse(ctx, u)));
      const ld = v.duelists?.get(loser);
      if (ld) {
        bg(ctx.wait(120).then(() => ld.play('defeat')));
        bg(shockwave(sc, ld.home.x, ld.home.y, { ramp: [PAL.ink, PAL.night1, PAL.night2, PAL.night3, PAL.steel], radius: 30, ms: 520, thickness: 4 }));
      }
      ctx.sfx('defeat', { volume: 0.6 });
      await ctx.wait(losers.length ? 620 : 420);

      // 2. the winner: gold beam, fist up, monsters roar (while the last holograms fall)
      const wd = v.duelists?.get(winner);
      if (wd) {
        const c = wd.chest();
        bg(ctx.focus({ x: c.x, y: c.y }, { zoom: 1.07, ms: 520, pan: 0.35 }));
        bg(
          beamDrop(sc, wd.home.x, wd.home.y, RAMPS.gold, {
            dropMs: 110,
            holdMs: 360,
            outMs: 260,
            width: 12,
            depth: wd.sprite.depth - 1,
            onHit: () => {
              ctx.sfx('holyChime', { volume: 0.6 });
              bg(wd.play('victory'));
              bg(shockwave(sc, wd.home.x, wd.home.y, { ramp: RAMPS.gold, radius: 34, ms: 460, thickness: 5 }));
              bg(sparkleBurst(sc, c.x, c.y, { ramp: RAMPS.gold, count: 18, depth: wd.sprite.depth + 2 }));
            },
          }),
        );
      }
      const winners = v.field.units().filter((u) => u.player === winner && !u.retired && u.sprite.active && u.sprite.visible && u.position === 'attack');
      winners.forEach((u, i) => bg(ctx.wait(200 + i * 110).then(() => u.play('roar'))));
      if (winners.length) bg(ctx.wait(200).then(() => ctx.sfx('roarBig', { volume: 0.5 })));
      await ctx.wait(380);

      // 3. the fanfare and the title (the screen stays up until we clear it)
      if (ctx.settings.music) ctx.music.play('victory');
      await all([victory(sc, winner, { hold: 1300 }), ...falls]);
    } finally {
      // a slow fade: the game-over prompt's own dim comes up under it (no bare-board flash)
      clearBanners(sc, 1100);
      bg(ctx.unfocus(700));
    }
  },
  { name: 'flow:gameOver' },
);

