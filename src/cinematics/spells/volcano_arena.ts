// Volkan Arenası (volcano_arena) — "Saha dönüşür: sarsıntı, karo aralarında lav ışığı, kor
// kırmızısı gökyüzü, süzülen kül ve korlar. ATEŞ canavarlara alev aurası (+500, yeşil), SU
// canavarlara buhar (−300, kırmızı). Etki kalıcıdır."
//
//   0       common opening (field spells always come from the hand); a heat shimmer starts in
//           the card's aura
//   [old]   a field spell already in play is struck first: a fire-teal arc leaps from the card
//           to the old field card, which cracks white and burns away into its owner's graveyard
//   +0      the card slams onto the caster's field zone …
//   +~80    … ERUPTION ('field' hook): the field tile blows white-hot, a fire burst, lava cracks
//           race out across the whole platform (BoardView.setTheme), the sky turns ember red,
//           ash and embers drift in (setVolcanoAmbience) — the camera punches in, then pulls
//           back to show the whole arena
//   front   as the lava front reaches each monster: FIRE monsters erupt in flame (fire burst,
//           orange glow, roar, flame aura) with a green +500; WATER monsters hiss into steam
//           (steam burst, grey flash, steam aura) with a red −300; their badges roll
//
// The 'field' hook also plays the reverse when a volcano leaves the field (Uçurum Büyücüsü):
// the arena cools, flames gutter out in smoke, steam stops, the badges roll back.

import Phaser from 'phaser';
import type { GameEvent } from '../../engine/types';
import { PAL, RAMPS } from '../../art/palette';
import { DEPTH, type XY, unitDepth, zoneXY } from '../../view/layout';
import { TEX, flash, wait } from '../../vfx/core';
import { damageNumber } from '../../vfx/numbers';
import { Raster, Sparks, addGlow, boltPath, explosion, floorRing, glowStroke, rr, run, setVolcanoAmbience, spriteBox } from '../../vfx/setpieces';
import { flameAura, steamAura } from '../../duel/auras';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { fx, registerCardHook, type CinematicContext } from '../api';
import { bg, evAt, idxOf, relax, spellOpening } from './_kit';

const ADD = Phaser.BlendModes.ADD;
const FIRE_FX = [PAL.white, PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1] as const;

type AnyCtx = CinematicContext<GameEvent>;
type StatEv = Extract<GameEvent, { type: 'statChange' }>;

/** The contiguous statChange events right after ctx.index (consumed). */
function takeStatChanges(ctx: AnyCtx): StatEv[] {
  const out: StatEv[] = [];
  for (let i = ctx.index + 1; i < ctx.events.length; i++) {
    const e = ctx.events[i];
    if (e.type !== 'statChange') break;
    if (ctx.isConsumed(i)) continue;
    ctx.consumeAt(i);
    out.push(e);
  }
  return out;
}

/** When the lava front (BoardView crack spread, ~0.9 s Sine.Out) reaches a point `d` px away. */
function frontDelay(d: number): number {
  return Math.round(Math.min(760, 110 + d * 2.1));
}

/** A FIRE monster flares up / a WATER monster steams as the volcano takes hold. */
async function heatUp(ctx: AnyCtx, u: MonsterUnit, e: StatEv, delay: number): Promise<void> {
  const sc = ctx.scene;
  await wait(sc, delay);
  if (u.retired || !u.sprite.active) {
    return;
  }
  const up = e.atk > e.prevAtk || (e.atk === e.prevAtk && e.def > e.prevDef);
  const feet = u.home;
  const top = u.worldPoint('top');
  const fire = u.attribute === 'FIRE' || (u.attribute !== 'WATER' && up);
  const jobs: Promise<unknown>[] = [];
  if (fire) {
    ctx.sfx('fireBurst', { volume: 0.6 });
    bg(explosion(sc, feet.x, feet.y - 3, RAMPS.fire, 0.8, unitDepth(feet.y) + 2));
    bg(floorRing(sc, feet.x, feet.y, { r0: 6, r1: 34, ms: 360, ramp: FIRE_FX }));
    jobs.push(addGlow(sc, u.sprite, PAL.fire3, 480, 0.85));
    if (!u.hasAura('volcano')) u.setAura('volcano', flameAura(sc, u));
    if (u.position === 'attack') void u.play('roar');
  } else {
    ctx.sfx('burn', { volume: 0.55, pitch: 1.5 });
    ctx.sfx('waterSplash', { volume: 0.3, pitch: 0.6 });
    const b = spriteBox(sc, u.sprite);
    const puffs = new Sparks(sc, unitDepth(feet.y) + 2);
    puffs.burst(16, (i) => ({
      x: b.cx + rr(-b.w * 0.45, b.w * 0.45),
      y: b.bottom - rr(0, b.h * 0.7),
      vx: rr(-16, 16),
      vy: rr(-46, -20),
      drag: 1.4,
      wobble: 8,
      life: rr(500, 820),
      ramp: [PAL.white, PAL.mist, PAL.steel, PAL.night4],
      tex: i % 3 === 0 ? TEX.dot5 : TEX.px2,
      delay: i * 12,
    }));
    puffs.close();
    jobs.push(addGlow(sc, u.sprite, PAL.mist, 420, 0.7));
    if (!u.hasAura('volcano')) u.setAura('volcano', steamAura(sc, u));
  }
  const delta = Math.abs(e.atk - e.prevAtk) || Math.abs(e.def - e.prevDef);
  if (delta > 0) jobs.push(damageNumber(sc, top.x, top.y - 4, delta, up ? 'buff' : 'debuff'));
  ctx.sfx(up ? 'lpUp' : 'lpDown', { volume: 0.3 });
  jobs.push(u.setStats(e.atk, e.def, true));
  await fx.all(jobs);
}

/** The volcano goes out for a monster: flames gutter into smoke / the steam stops; badge rolls back. */
async function coolDown(ctx: AnyCtx, u: MonsterUnit, e: StatEv, delay: number): Promise<void> {
  const sc = ctx.scene;
  await wait(sc, delay);
  if (u.retired || !u.sprite.active) return;
  const up = e.atk > e.prevAtk || (e.atk === e.prevAtk && e.def > e.prevDef);
  const top = u.worldPoint('top');
  const b = spriteBox(sc, u.sprite);
  const smoke = new Sparks(sc, unitDepth(u.home.y) + 2);
  smoke.burst(10, (i) => ({
    x: b.cx + rr(-b.w * 0.4, b.w * 0.4),
    y: b.top + rr(0, b.h * 0.5),
    vx: rr(-10, 10),
    vy: rr(-30, -14),
    wobble: 6,
    life: rr(500, 800),
    ramp: [PAL.stone3, PAL.stone2, PAL.night3, PAL.night2],
    tex: i % 2 ? TEX.dot5 : TEX.px2,
    delay: i * 15,
  }));
  smoke.close();
  ctx.sfx('burn', { volume: 0.35, pitch: 0.8 });
  u.setAura('volcano', null);
  const jobs: Promise<unknown>[] = [u.setStats(e.atk, e.def, true)];
  const delta = Math.abs(e.atk - e.prevAtk) || Math.abs(e.def - e.prevDef);
  if (delta > 0) jobs.push(damageNumber(sc, top.x, top.y - 4, delta, up ? 'buff' : 'debuff'));
  await fx.all(jobs);
}

/** The old field spell is struck by the new card and burns away (destroy + toGraveyard events). */
async function breakOldField(ctx: AnyCtx, from: XY, di: number): Promise<void> {
  const sc = ctx.scene;
  const d = evAt(ctx, di, 'destroy');
  if (!d) return;
  ctx.consumeAt(di);
  const gi = ctx.findType('toGraveyard', (e) => e.uid === d.uid, { until: (e) => e.type !== 'toGraveyard' && e.type !== 'destroy' });
  const g = evAt(ctx, gi, 'toGraveyard');
  if (gi >= 0) ctx.consumeAt(gi);
  const field = ctx.views.field;
  const { tile } = field.release(d.uid);
  const at = tile ? tile.home : zoneXY(d.player, 'field', 0);
  const hit = { x: at.x, y: at.y - 4 };
  // a fire-teal arc leaps from the hovering card to the old field card
  const ras = new Raster(sc, Math.min(from.x, hit.x) - 30, Math.min(from.y, hit.y) - 30, Math.abs(from.x - hit.x) + 60, Math.abs(from.y - hit.y) + 60, DEPTH.FX_TOP + 6, ADD);
  ctx.sfx('lightning', { volume: 0.6, pitch: 1.3 });
  await run(sc, 110, (t) => {
    const pts = boltPath(from, hit, 18, 5);
    ras.draw((gr) => glowStroke(gr, pts.slice(0, Math.max(2, Math.ceil(pts.length * Math.min(1, t * 1.6)))), [PAL.fire1, PAL.fire3, PAL.teal4, PAL.white], 1, 1));
  });
  // crack: white flash, sparks, burn away
  ctx.sfx('shatter', { volume: 0.8, pitch: 1.1 });
  ctx.sfx('groundCrack', { volume: 0.5 });
  bg(explosion(sc, hit.x, hit.y, RAMPS.fire, 0.7, DEPTH.FX + 4));
  bg(
    (async () => {
      const pattern = [1, 0.4, 0.9, 0.2, 0];
      for (const v of pattern) {
        const pts = boltPath(from, hit, 16, 5);
        ras.draw((gr) => {
          if (v > 0) glowStroke(gr, pts, [PAL.fire1, PAL.fire3, PAL.teal4, PAL.white], 1, v);
        });
        await wait(sc, 34);
      }
      ras.destroy();
    })(),
  );
  if (tile && tile.active) {
    bg(tile.pulse(PAL.white, 160));
    await wait(sc, 60);
    // the new card starts down while the old one is still burning
    bg(tile.dissolve(380).then(() => tile.destroy()));
    await wait(sc, 200);
  } else await wait(sc, 220);
  field.forget(d.uid);
  if (g) bg(fx.cardToGraveyard(ctx, { owner: g.owner, cardId: d.cardId, from: { x: at.x, y: at.y - 4 } }));
}

registerCardHook('volcano_arena', 'activate', async (ctx) => {
  const ev = ctx.ev;
  const run0 = fx.resolutionRun(ctx);
  const oldDi = idxOf(ctx, run0, (e) => e.type === 'destroy' && e.location === 'field');
  const oldFi = idxOf(ctx, run0, (e) => e.type === 'fieldSpell' && !e.active && e.uid !== ev.uid);
  const fi = idxOf(ctx, run0, (e) => e.type === 'fieldSpell' && e.active && e.uid === ev.uid);
  const op = await spellOpening(ctx, { uid: ev.uid, cardId: ev.cardId, player: ev.player, from: 'hand', zone: null, hold: 420 });
  if (oldDi >= 0) {
    await breakOldField(ctx, op.center, oldDi);
    // the arena stays hot (a volcano replaces a volcano): its cooling is skipped; anything else
    // plays through the normal chain
    const oldF = evAt(ctx, oldFi, 'fieldSpell');
    if (oldF && oldF.cardId === 'volcano_arena') ctx.consumeAt(oldFi);
    else if (oldFi >= 0) await ctx.play(oldFi);
  }
  await op.land({ spot: 'field', index: 0 });
  if (fi >= 0) await ctx.play(fi);
  await fx.playRun(ctx, fx.resolutionRun(ctx));
  relax(ctx, 400);
});

/** The arena transforms (active) or cools back (inactive). Owns the statChanges that follow. */
registerCardHook('volcano_arena', 'field', async (ctx) => {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const board = ctx.views.board;
  if (!ev.active) {
    // only cool down if no other volcano took its place in this batch
    const stillHot = ctx.after.players.some((p) => p.fieldSpell && ctx.after.cards[p.fieldSpell.uid].cardId === 'volcano_arena');
    if (stillHot) return;
    const stats = takeStatChanges(ctx);
    ctx.sfx('fieldChange', { volume: 0.5, pitch: 1.2 });
    const origin = zoneXY(ev.player, 'field', 0);
    const jobs: Promise<unknown>[] = [board.setTheme('normal', true), setVolcanoAmbience(sc, false), wait(sc, 600)];
    for (const e of stats) {
      const u = ctx.unit(e.uid);
      if (!u) continue;
      jobs.push(coolDown(ctx, u, e, 120 + Math.round(Math.hypot(u.home.x - origin.x, u.home.y - origin.y) * 1.2)));
    }
    await fx.all(jobs);
    return;
  }
  const origin = zoneXY(ev.player, 'field', 0);
  const stats = takeStatChanges(ctx);
  // ERUPTION at the field tile
  ctx.sfx('fieldChange', { volume: 0.95 });
  ctx.sfx('earthQuake', { volume: 0.55 });
  ctx.sfx('fireBurst', { volume: 0.8, pitch: 0.8 });
  const tile = ctx.views.field.tileAt(ev.player, 'field', 0);
  if (tile) bg(tile.pulse(PAL.fire4, 420));
  bg(explosion(sc, origin.x, origin.y - 4, RAMPS.fire, 1.3, unitDepth(origin.y) + 2));
  bg(flash(sc, 110, PAL.fire4, 0.28));
  bg(ctx.focus(origin, { zoom: 1.05, ms: 140, pan: 0.2 }).then(() => wait(sc, 120)).then(() => ctx.unfocus(700)));
  const theme = board.setTheme('volcano', true, ev.player);
  bg(setVolcanoAmbience(sc, true));
  // the lava front reaches each monster in turn
  const flares: Promise<unknown>[] = [];
  for (const e of stats) {
    const u = ctx.unit(e.uid);
    if (!u) continue;
    const d = Math.hypot(u.home.x - origin.x, u.home.y - origin.y);
    flares.push(heatUp(ctx, u, e, frontDelay(d)));
  }
  await fx.all([theme, ...flares, wait(sc, 900)]);
});

