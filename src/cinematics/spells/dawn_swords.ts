// Şafak Kılıçları (dawn_swords) — "Rakibin tüm kapalı canavarlarını aç. Bu kart sahadayken rakibin canavarları
// saldıramaz. Rakibin 3. turunun sonunda bu kart yok olur."
//
// A continuous spell: it lies on its zone face-up; a fence of six light blades is planted along the front of the
// opponent's half and a badge of three mini blades floats over the card (the counter). The scene is in
// ./_dawn_v3.ts (the fence kit is shared by both looks; V3_A5_A turns on the rich version: falling light trails,
// floor rings, dust, light pools, idle glints, the reveal sweep, the erosion into motes). Here: the hooks.
//
//   activate   opening → the card lies on its zone → blades fall + the reveal (face-down monsters flip face-up as the
//              light sweeps past; the engine's own flip presentation, no flip effect) → the badge pops in
//   counter    each end of the opponent's turn: the outer pair of blades dissolves, one badge pip goes dark
//   destroyed  expiry (counter 0): the last pair fades, the card leaves for the graveyard;
//              early (Arınma Dalgası …): every blade breaks at once, the lock ends with them
//   observer   rebuilds the fence of a staged / restored board; removes a fence whose card left the field

import type { GameEvent, Uid } from '../../engine/types';
import { other } from '../../engine/types';
import { PAL } from '../../art/palette';
import { ip, bg, fs, idxOf, lightFlash, relax, setTileOf, spellOpening, evAt, GOLD_FX } from './_kit';
import { zoneXY } from '../../view/layout';
import { wait } from '../../vfx/core';
import { floorRing } from '../../vfx/setpieces';
import { V3_A5_A } from '../../view/v3flags';
import { panAt, play as playV3 } from '../_v3/sound';
import { cardLeaves } from '../_v3/card';
import { fx, registerCardHook, registerEvent, registerObserver, type CinematicContext } from '../api';
import { DAWN, DawnFence, allFences, dawnCasting, fenceOf, resolutionParts, revealSweep, sweepReaches } from './_dawn_v3';

type AnyCtx = CinematicContext<GameEvent>;
type ActCtx = CinematicContext<Extract<GameEvent, { type: 'activate' }>>;

const ID = 'dawn_swords';

registerCardHook(ID, 'activate', async (ctx: ActCtx) => {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const rich = V3_A5_A;
  const run0 = fx.resolutionRun(ctx);
  const parts = resolutionParts(ctx, ev.uid, run0);
  const set = setTileOf(ctx);
  const op = await spellOpening(ctx, { uid: ev.uid, cardId: ev.cardId, player: ev.player, from: set ? 'set' : 'hand', zone: ev.zone, hold: rich ? DAWN.openHold : 240 });
  if (ev.zone === null) {
    await op.close();
    relax(ctx);
    await fx.playRun(ctx, run0);
    return;
  }
  const zone = ev.zone;
  const at = zoneXY(ev.player, 'spellTrap', zone);
  let tile;
  if (rich && op.landV3) {
    const land = () => {
      playV3('cardPlace', { volume: 0.8, pan: panAt(at.x) });
      bg(ctx.views.board.flashTile(ev.player, 'spellTrap', zone, PAL.gold3, 150));
      void lightFlash(sc, at.x, at.y, PAL.gold3, fs(20), 220, { floorY: at.y, intensity: 0.55 });
    };
    tile = await op.landV3({ spot: 'spellTrap', index: zone, ms: 110, lieMs: set ? 160 : 120, onLand: land });
  } else tile = await op.land({ spot: 'spellTrap', index: zone });

  dawnCasting.add(ev.uid);
  try {
    const fence = new DawnFence(sc, ev.uid, ev.player, zone, rich);
    fence.tileRef = tile;
    const target = other(ev.player);
    const cev = evAt(ctx, parts.counter, 'counter');
    if (parts.counter >= 0) ctx.consumeAt(parts.counter);
    const planted = fence.plant();
    const jobs: Promise<unknown>[] = [planted];
    if (rich) {
      jobs.push(wait(sc, DAWN.sweepAt).then(() => revealSweep(sc, target)));
      for (const f of parts.flips) jobs.push(wait(sc, DAWN.sweepAt + Math.round(sweepReaches(f.zone) * DAWN.sweepMs)).then(() => ctx.play(f.i)));
    } else {
      ctx.sfx('flipReveal', { volume: 0.5, pitch: 1.2 });
      parts.flips.forEach((f, k) => jobs.push(wait(sc, 200 + k * 110).then(() => ctx.play(f.i))));
    }
    await planted;
    fence.setBadge(cev?.value ?? 3, true);
    if (rich) playV3('cardPlace', { volume: 0.35, pitch: 1.4, pan: panAt(at.x) });
    else ctx.sfx('holyChime', { volume: 0.35, pitch: 1.1 });
    await Promise.all(jobs);
  } finally {
    dawnCasting.delete(ev.uid);
  }
  await fx.playRun(ctx, fx.resolutionRun(ctx));
  relax(ctx, 300);
});

/** The counter: gained (restore / late build), or ticked down at the end of the opponent's turn. */
registerEvent('counter', async (ctx) => {
  const ev = ctx.ev;
  if (ev.cardId !== ID) return ctx.base();
  const sc = ctx.scene;
  let f = fenceOf(sc, ev.uid);
  const tile = ctx.views.field.tileAt(ev.player, 'spellTrap', ev.zone);
  if (ev.value > ev.prev) {
    if (!f) {
      f = new DawnFence(sc, ev.uid, ev.player, ev.zone, V3_A5_A);
      f.tileRef = tile;
      f.restore(ev.value);
    } else f.setBadge(ev.value, true);
    return;
  }
  if (!f) {
    f = new DawnFence(sc, ev.uid, ev.player, ev.zone, V3_A5_A);
    f.tileRef = tile;
    f.restore(ev.prev);
  }
  if (tile) f.tileRef = tile;
  await f.tick(ev.prev);
});

/** The card leaves the field: expiry (the fence already faded on counter 0) or early destruction. */
registerCardHook(ID, 'destroyed', async (ctx) => {
  const ev = ctx.ev;
  if (ev.location !== 'spellTrap') return ctx.base();
  const sc = ctx.scene;
  const field = ctx.views.field;
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid, { until: (e) => e.type !== 'toGraveyard' && e.type !== 'destroy' });
  const g = evAt(ctx, gi, 'toGraveyard');
  if (gi >= 0) ctx.consumeAt(gi);
  const slot = ctx.state.players[ev.player].spellTraps[ev.zone];
  const expired = (slot?.counter ?? 1) <= 0;
  const fence = fenceOf(sc, ev.uid);
  const jobs: Promise<unknown>[] = [];
  if (fence && !expired) jobs.push(fence.shatter());
  const { tile } = field.release(ev.uid);
  const home = tile ? ip(tile.home) : zoneXY(ev.player, 'spellTrap', ev.zone);
  if (tile && tile.active) {
    if (!tile.faceUp) {
      tile.setCard(ev.cardId);
      await tile.flipUp(160);
    }
    bg(tile.pulse(PAL.gold4, 200));
    void lightFlash(sc, home.x, home.y, PAL.gold3, fs(26), 360, { intensity: 0.6 });
    if (V3_A5_A) {
      if (expired) playV3('dawnFade', { volume: 0.35, pitch: 0.9, pan: panAt(home.x) });
    } else ctx.sfx('shatter', { volume: 0.4, pitch: 1.5 });
    bg(floorRing(sc, home.x, home.y, { r0: 4, r1: fs(24), ms: 300, ramp: GOLD_FX }));
    await wait(sc, expired ? 120 : 60);
  }
  if (g) {
    if (V3_A5_A) jobs.push(cardLeaves(ctx, { owner: g.owner, cardId: ev.cardId, from: home, tile }));
    else {
      if (tile && tile.active) bg(tile.dissolve(380).then(() => tile.destroy()));
      jobs.push(fx.cardToGraveyard(ctx, { owner: g.owner, cardId: ev.cardId, from: { x: home.x, y: home.y - 4 } }));
    }
  } else if (tile && tile.active) jobs.push(tile.dissolve(300).then(() => tile.active && tile.destroy()));
  field.forget(ev.uid);
  await fx.all(jobs);
  // whatever is left of the fence goes with the card
  fenceOf(sc, ev.uid)?.destroy();
  void idxOf;
});

/** A staged / restored board shows its fence; a fence whose card is gone is removed. */
registerObserver((_ev, ctx: AnyCtx) => {
  const sc = ctx.scene;
  const present = new Set<Uid>();
  ctx.state.players.forEach((p, pi) => {
    p.spellTraps.forEach((st, zi) => {
      if (!st || !st.faceUp) return;
      if (ctx.state.cards[st.uid]?.cardId !== ID) return;
      present.add(st.uid);
      const n = st.counter ?? 0;
      if (n <= 0 || dawnCasting.has(st.uid) || fenceOf(sc, st.uid)) return;
      const f = new DawnFence(sc, st.uid, pi as 0 | 1, zi, V3_A5_A);
      f.tileRef = ctx.views.field.tileAt(pi as 0 | 1, 'spellTrap', zi);
      f.restore(n);
    });
  });
  for (const f of allFences(sc)) if (!present.has(f.uid) && !f.busy && !dawnCasting.has(f.uid)) f.destroy();
});
