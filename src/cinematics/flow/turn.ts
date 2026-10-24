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
import { ARENA_V2, duelistXY, screenToIso } from '../../view/layout';
import { phaseBanner, turnBanner } from '../../vfx/banners';
import { addGlow } from '../../vfx/setpieces';
import { registerEvent, registerObserver } from '../api';
import { all, bg, cameraAtRest, intensityFor, fs, lightDimFor, lightFlash, type AnyCtx, type Ctx } from './_kit';
import { V3HOOKS } from '../v3small/_hooks';

/** The face-up monsters of `p` on screen. */
function unitsOf(ctx: AnyCtx, p: PlayerId) {
  return ctx.views.field.units().filter((u) => u.player === p && !u.retired && u.sprite.active && u.sprite.visible);
}

// ================================================================ turn start

registerEvent(
  'turnStart',
  async (ctx: Ctx<'turnStart'>) => {
    const h = V3HOOKS.turnStart; if (h) return h(ctx); // v3 lane A6-B (S-8); empty: today's turn start
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
    const col = PLAYER_RAMP[player][3];
    // (v2) the side wakes up under its duelist's light
    void lightFlash(sc, pod.x, pod.y - 16, col, fs(44), 620, { floorY: pod.y, ring: true, intensity: 0.9 });
    for (const u of unitsOf(ctx, player)) {
      const d = Math.hypot(u.home.x - pod.x, u.home.y - pod.y);
      // v2: in step with BoardViewV2.pulseSide's tile wave (110 ms per grid cell from the podium,
      // peaking ≈ 80 ms into each tile's flash); v1 keeps its authored px rate
      const delay = ARENA_V2 ? waveDelayV2(pod, u.home) : 90 + d * 2.2;
      jobs.push(
        ctx.wait(delay).then(() => {
          void lightFlash(sc, u.home.x, u.home.y, col, fs(30), 380, { intensity: 0.6 });
          return addGlow(sc, u.sprite, PLAYER_RAMP[player][4], 300, 0.55);
        }),
      );
    }
    const duelist = v.duelists?.get(player);
    if (duelist) jobs.push(ctx.wait(120).then(() => duelist.play('command')));
    await all(jobs);
  },
  { name: 'flow:turnStart' },
);

/** v2: when BoardViewV2.pulseSide's wave (from the podium, 110 ms per grid cell) peaks on `at`. */
function waveDelayV2(pod: { x: number; y: number }, at: { x: number; y: number }): number {
  const a = screenToIso(pod.x, pod.y);
  const b = screenToIso(at.x, at.y);
  return Math.round(Math.max(0, Math.hypot(b.col - a.col, b.row - a.row) - 1) * 110 + 80);
}

// ================================================================ phase change

registerEvent(
  'phaseChange',
  async (ctx: Ctx<'phaseChange'>) => {
    const h = V3HOOKS.phaseChange; if (h) return h(ctx); // v3 lane A6-B (S-8); empty: today's phase change
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
      // (v2) the arena dims under the crimson band; the floodlights come back as the attackers flare
      void lightDimFor(sc, 0.4, 620, 240, 600);
      const flares = ctx.wait(980).then(() => {
        if (ready.length) ctx.sfx('lockOn', { volume: 0.3, pitch: 0.8 });
        ready.forEach((u, i) =>
          bg(
            ctx.wait(i * 90).then(() => {
              if (u.retired) return undefined;
              void lightFlash(sc, u.home.x, u.home.y, PAL.crim3, fs(32), 460, { ring: true, intensity: 0.8 });
              return addGlow(sc, u.sprite, PAL.crim3, 420, 0.75);
            }),
          ),
        );
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
