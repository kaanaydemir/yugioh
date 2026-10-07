// DUEL FLOW — turn start (≤ 1.2 s), phase changes, and the duel music's intensity.
//
// turnStart
//   hot-seat: the pass-device curtain comes first (nothing private shows before it is passed);
//   then the side wakes up: the trim lights (setActivePlayer), a wave rolls out from the
//   duelist's podium (pulseSide) and lights each of their monsters as it passes, the duelist
//   raises the duel disk ('command') and "OYUNCU n · TUR t" sweeps in from their side in their
//   colour.
// phaseChange
//   the phase bar's marker slides. Battle: "SAVAŞ AŞAMASI" on a crimson band with a red edge
//   pulse, the music jumps up (drum fill), the duelist commands and every monster in attack
//   position flares red, one after another. End: the music settles back.
// music
//   calm in the main phase, up in battle, and kept up while either player is under 1000 LP.
//   The killing blow (damage to 0 LP) drops into slow motion and the music cuts out.

import type { PlayerId } from '../../engine/types';
import { PAL, PLAYER_RAMP } from '../../art/palette';
import { duelistXY } from '../../view/layout';
import { phaseBanner, turnBanner } from '../../vfx/banners';
import { addGlow } from '../../vfx/setpieces';
import { registerEvent, registerObserver } from '../api';
import { all, bg, cameraAtRest, intensityFor, type AnyCtx, type Ctx } from './_kit';

/** The face-up monsters of `p` on screen. */
function unitsOf(ctx: AnyCtx, p: PlayerId) {
  return ctx.views.field.units().filter((u) => u.player === p && !u.retired && u.sprite.active && u.sprite.visible);
}

// ================================================================ turn start

registerEvent(
  'turnStart',
  async (ctx: Ctx<'turnStart'>) => {
    const { player, turn } = ctx.ev;
    const v = ctx.views;
    const sc = ctx.scene;
    if (!cameraAtRest(ctx)) await v.camera.unfocus(120);
    // hot-seat: pass the device (curtain) before anything of the new turn shows; without a
    // curtain the hand swaps while the banner already sweeps in
    const target = v.info.viewerFor(player);
    const curtain = v.info.mode === 'hotseat' && v.info.curtain && !v.info.auto && v.info.isHuman(target) && (target !== v.hand.owner || v.hand.isFaceDown);
    const handover = v.info.ensureViewer(player);
    if (curtain) await handover;
    v.board.setActivePlayer(player, true);
    v.hud.setActive(player, true);
    v.hud.setTurn(turn, true);
    ctx.music.setIntensity(intensityFor(ctx.stateNext, 'main'));
    const jobs: Promise<unknown>[] = [turnBanner(sc, player, turn), v.board.pulseSide(player), handover];
    // the wave from the podium lights each of their monsters as it passes
    const pod = duelistXY(player);
    for (const u of unitsOf(ctx, player)) {
      const d = Math.hypot(u.home.x - pod.x, u.home.y - pod.y);
      jobs.push(ctx.wait(90 + d * 2.2).then(() => addGlow(sc, u.sprite, PLAYER_RAMP[player][4], 300, 0.55)));
    }
    const duelist = v.duelists?.get(player);
    if (duelist) jobs.push(ctx.wait(120).then(() => duelist.play('command')));
    await all(jobs);
  },
  { name: 'flow:turnStart' },
);

// ================================================================ phase change

registerEvent(
  'phaseChange',
  async (ctx: Ctx<'phaseChange'>) => {
    const { phase, player } = ctx.ev;
    const v = ctx.views;
    const sc = ctx.scene;
    if (phase === 'battle') {
      ctx.music.setIntensity(intensityFor(ctx.stateNext, 'battle'));
      const jobs: Promise<unknown>[] = [v.hud.setPhase('battle', player, true), phaseBanner(sc, 'battle')];
      const duelist = v.duelists?.get(player);
      if (duelist) jobs.push(ctx.wait(100).then(() => duelist.play('command')));
      // as the band wipes off, every attacker-to-be flares red, one after another (a tail: the
      // handler resolves with the banner)
      const ready = unitsOf(ctx, player)
        .filter((u) => u.position === 'attack')
        .sort((a, b) => (player === 0 ? a.home.x - b.home.x : b.home.x - a.home.x));
      const flares = ctx.wait(980).then(() => {
        if (ready.length) ctx.sfx('lockOn', { volume: 0.3, pitch: 0.8 });
        ready.forEach((u, i) => bg(ctx.wait(i * 90).then(() => (u.retired ? undefined : addGlow(sc, u.sprite, PAL.crim3, 420, 0.75)))));
      });
      bg(flares);
      await all(jobs);
      return;
    }
    bg(v.hud.setPhase(phase, player, true));
    if (phase === 'end' || phase === 'main') ctx.music.setIntensity(intensityFor(ctx.stateNext, phase));
    await ctx.wait(phase === 'main' ? 180 : 140);
  },
  { name: 'flow:phaseChange' },
);

// ================================================================ music + the killing blow

registerObserver((ev, ctx) => {
  if (ev.type !== 'damage' && ev.type !== 'lpGain') return;
  if (ev.type === 'damage' && ev.lpAfter <= 0) {
    // the final blow: slow motion while the number pops and the LP rolls to zero; silence
    ctx.views.speed.slowMo(0.35, 1000);
    ctx.music.stop(1100);
    return;
  }
  // LP crossed the low-LP line (either way): retune the duel track
  if (ctx.stateNext.winner === null) ctx.music.setIntensity(intensityFor(ctx.stateNext));
});
