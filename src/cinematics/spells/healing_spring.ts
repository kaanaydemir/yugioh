// Şifa Pınarı (healing_spring) — "Oyuncunun tarafında turkuaz bir pınar fışkırır. Damlalar yay
// çizerek LP paneline akar, yeşil parıltılar çıkar, "+1000"."
//
//   0       common opening (hand / set tile)
//   +0      release: the card's energy arcs down onto the caster's side and sinks into the floor
//           (its own tile when it was set, else the middle spell/trap zone) — ripples open
//   +220    the teal spring ERUPTS (healingFountain): geyser, spray, floor rings, tiny shake
//   +500    glowing droplets arc into the caster's LP panel with green-gold sparkle trails
//   first   droplet lands → the panel glows, "+1000" pops and the LP rolls up (lpGain event)
//   then    the spent card drops into the graveyard; the geyser collapses on its own

import { PAL } from '../../art/palette';
import type { XY } from '../../view/layout';
import { zoneXY } from '../../view/layout';
import { wait } from '../../vfx/core';
import { floorRing } from '../../vfx/setpieces';
import { quickFountain } from './_fountain';
import { fx, registerCardHook } from '../api';
import { TEAL_FX, bg, idxOf, relax, sendResolved, setTileOf, spellOpening } from './_kit';

registerCardHook('healing_spring', 'activate', async (ctx) => {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const run0 = fx.resolutionRun(ctx);
  const li = idxOf(ctx, run0, (e) => e.type === 'lpGain');
  const gi = idxOf(ctx, run0, (e) => e.type === 'toGraveyard' && e.from === 'resolved' && e.uid === ev.uid);
  const set = setTileOf(ctx);
  const spring: XY = set ? { ...set.home } : zoneXY(ev.player, 'spellTrap', 1);
  const op = await spellOpening(ctx, { uid: ev.uid, cardId: ev.cardId, player: ev.player, from: set ? 'set' : 'hand', zone: ev.zone, hold: 380 });
  // the droplets fly on the (un-zoomed) HUD camera: the world camera must be at rest before they launch
  relax(ctx, 300);
  let healed: Promise<void> = Promise.resolve();
  let arrived!: () => void;
  const first = new Promise<void>((r) => (arrived = r));
  // the spring's ripples start under the falling orb, so the eruption (fountain +150 ms) lands
  // exactly when the orb hits the floor
  const STREAK = 260;
  // (boxed: resolving a promise with a promise would adopt it)
  let fountainStarted!: (f: { p: Promise<void> }) => void;
  const fountainP = new Promise<{ p: Promise<void> }>((r) => (fountainStarted = r));
  const startFountain = () =>
    fountainStarted({
      p: quickFountain(sc, ev.player, fx.lpPoint(ctx, ev.player), {
        at: spring,
        onArrive: () => {
          if (li >= 0) healed = ctx.play(li, { delivered: true });
          arrived();
        },
      }),
    });
  await op.release({ x: spring.x, y: spring.y - 2 }, { path: 'arc', lift: 46, ms: STREAK, size: 2, onLaunch: () => bg(wait(sc, STREAK - 150).then(startFountain)) });
  ctx.sfx('waterSplash', { volume: 0.45, pitch: 1.3 });
  bg(floorRing(sc, spring.x, spring.y, { r0: 4, r1: 30, ms: 260, ramp: TEAL_FX }));
  const fountain = (await fountainP).p;
  // the duelist feels the spring: a small cheer when the first drop lands
  bg(
    first.then(async () => {
      const d = ctx.views.duelists?.get(ev.player);
      if (!d) return;
      await d.play('victory');
      // victory holds its last frame (fist up): ease back to the idle loop
      await wait(sc, 260);
      await d.play('idle');
    }),
  );
  await Promise.race([first, fountain]);
  // the spent card leaves while the drops still rain into the panel and the LP rolls
  const send = sendResolved(ctx, gi, { x: spring.x, y: spring.y - 24 });
  await healed;
  await fx.playRun(ctx, fx.resolutionRun(ctx));
  await send;
  void PAL;
});
