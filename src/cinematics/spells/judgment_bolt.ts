// Yıldırım Hükmü (judgment_bolt) — "Gök kararır, hedefin üstünde fırtına bulutları toplanır,
// kilitlenir. Dev zikzak yıldırım düşer: beyaz flaş, gök gürültüsü, sarsıntı, hedef parçalanır."
//
//   0       common opening (hand: card flies up / set: the tile bursts and the card stands up)
//   +0      release: the card inhales, collapses into a teal orb that ZIPS straight up into the
//           sky above the target — the storm starts gathering there at the same moment
//           (stage darkens, cloud vortex, the camera leans in on the target)
//   +520    the sigil locks: the target flashes teal, static crackles on it
//   +680    STRIKE (stormStrike): giant zig-zag bolt, hit-stop, white flash, thunder, 5 px shake —
//           the target is electrocuted (x-ray flicker, arcs crawling over it) and blows apart
//           into its own pixels ('destroys' hook below), its tile scorches away
//   +~1200  the spent card re-forms and drops into the graveyard; the storm dissipates
//
// The 'destroys' hook owns the victim's death (the monsters' flavoured deaths step aside for a
// source with a 'destroys' hook), so the shatter is always the lightning one.

import Phaser from 'phaser';
import type { GameEvent } from '../../engine/types';
import { PAL } from '../../art/palette';
import { DEPTH, GAME_H, GAME_W, type XY, zoneXY } from '../../view/layout';
import { TEX, wait } from '../../vfx/core';
import { shatter } from '../../vfx/shatter';
import { E, Raster, Sparks, boltPath, rnd, rr, run, seg, spriteBox, stormStrike } from '../../vfx/setpieces';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { fx, registerCardHook, type CinematicContext } from '../api';
import { TEAL_FX, bg, evAt, idxOf, relax, sendResolved, setTileOf, spellOpening } from './_kit';

type DestroyCtx = CinematicContext<Extract<GameEvent, { type: 'destroy' }>>;

const ADD = Phaser.BlendModes.ADD;

/**
 * stormStrike's darkness is exactly the 640×360 screen; a zoomed / shaking world camera would
 * show its edges. Four border strips follow the same curve outside it.
 */
function darkBorder(scene: Phaser.Scene): void {
  const P = 90;
  const rects = [
    scene.add.rectangle(-P, -P, GAME_W + 2 * P, P, PAL.ink, 1),
    scene.add.rectangle(-P, GAME_H, GAME_W + 2 * P, P, PAL.ink, 1),
    scene.add.rectangle(-P, 0, P, GAME_H, PAL.ink, 1),
    scene.add.rectangle(GAME_W, 0, P, GAME_H, PAL.ink, 1),
  ].map((r) => r.setOrigin(0).setDepth(DEPTH.SHADOW - 2).setAlpha(0));
  bg(
    run(scene, 1600, (_t, el) => {
      const k = el < 1050 ? E.outQuad(seg(el, 0, 300)) : 1 - seg(el, 1050, 1450);
      for (const r of rects) r.setAlpha(0.62 * k);
    }).then(() => rects.forEach((r) => r.destroy())),
  );
}

registerCardHook('judgment_bolt', 'activate', async (ctx) => {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const field = ctx.views.field;
  const run0 = fx.resolutionRun(ctx);
  const ti = idxOf(ctx, run0, (e) => e.type === 'target');
  const ref = evAt(ctx, ti, 'target')?.targets[0] ?? null;
  const gi = idxOf(ctx, run0, (e) => e.type === 'toGraveyard' && e.from === 'resolved' && e.uid === ev.uid);
  const set = setTileOf(ctx);
  const ground0 = ref && ref.zone === 'monster' ? zoneXY(ref.player, 'monster', ref.index) : null;
  const unit0 = ref && ref.zone === 'monster' ? field.unitAt(ref.player, ref.index) : null;
  const victim = unit0 && unit0.sprite.visible ? unit0 : null;
  const di = ref ? idxOf(ctx, run0, (e) => e.type === 'destroy' && e.location === 'monster' && e.player === ref.player && e.zone === ref.index) : -1;
  // the storm starts gathering in the last beat of the hover (anticipation), so the card's energy
  // reaches the cloud eye right before the strike
  const PRE = 200;
  let destroyed: Promise<void> = Promise.resolve();
  let struck = false;
  let storm: Promise<void> = Promise.resolve();
  let stormStarted!: () => void;
  const stormGo = new Promise<void>((r) => (stormStarted = r));
  const startStorm = () => {
    if (!ground0) return;
    darkBorder(sc);
    bg(ctx.focus({ x: ground0.x, y: ground0.y - 40 }, { zoom: 1.06, ms: 560, pan: 0.3 }));
    storm = stormStrike(sc, ground0.x, ground0.y, {
      onImpact: () => {
        struck = true;
        if (di >= 0) destroyed = ctx.play(di, { hit: false, bolt: true, push: { x: 0, y: -1 } });
      },
    });
    // the target braces under the lock-on: teal flash + a nervous shiver (stormStrike locks at +520)
    if (victim) bg(brace(sc, victim, () => struck));
    stormStarted();
  };
  const op = await spellOpening(ctx, {
    uid: ev.uid,
    cardId: ev.cardId,
    player: ev.player,
    from: set ? 'set' : 'hand',
    zone: ev.zone,
    onHold: (h) => bg(wait(sc, Math.max(0, h - PRE)).then(startStorm)),
  });
  if (!ref || ref.zone !== 'monster' || !ground0) {
    await op.close();
    relax(ctx);
    await fx.playRun(ctx, run0);
    return;
  }
  ctx.consumeAt(ti);
  const eye: XY = { x: ground0.x, y: Math.max(30, ground0.y - 118) + 6 };
  await stormGo;
  await op.release(eye, { path: 'line', ms: 200, size: 2 });
  // the orb feeds the storm's eye
  bg(spark(sc, eye));
  await storm;
  // ---- the spent card drops out of the storm's eye into the graveyard while the victim's
  // debris is still falling and the rest of the run plays (e.g. an equip breaking)
  const send = sendResolved(ctx, gi, { x: eye.x, y: eye.y + 12 });
  await destroyed;
  if (victim && !victim.retired) {
    victim.posed = false;
    victim.settle();
  }
  relax(ctx, 380);
  await fx.playRun(ctx, fx.resolutionRun(ctx));
  await send;
});

/** The target under the lock-on (+520 into the storm): a teal flash, then a nervous shiver until the strike. */
async function brace(scene: Phaser.Scene, u: MonsterUnit, struck: () => boolean): Promise<void> {
  await wait(scene, 520);
  if (struck() || !u.sprite.active || !u.sprite.visible) return;
  u.sprite.setTintFill(PAL.teal4);
  await wait(scene, 50);
  if (!struck() && u.sprite.active) u.sprite.clearTint();
  u.posed = true;
  const x0 = u.sprite.x;
  await run(scene, 140, (_t, el) => {
    if (struck() || !u.sprite.active) return;
    u.sprite.x = x0 + (Math.floor(el / 34) % 2 ? 1 : 0);
  });
  if (u.sprite.active && !struck()) u.sprite.x = x0;
}

/** A small teal-white burst (the orb hitting the cloud eye). */
async function spark(scene: Phaser.Scene, at: XY): Promise<void> {
  const s = new Sparks(scene, DEPTH.FX + 9, ADD);
  s.burst(14, (i) => {
    const a = (i / 14) * Math.PI * 2;
    const sp = rr(50, 110);
    return { x: at.x, y: at.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, drag: 4, life: rr(220, 360), ramp: TEAL_FX, tex: i % 3 === 0 ? TEX.plus : TEX.px1 };
  });
  s.close();
}

// ================================================================ the electrocuted death

/** X-ray flicker + crawling arcs over a unit, then it blows apart into its own pixels. */
async function electrocute(ctx: DestroyCtx, u: MonsterUnit): Promise<void> {
  const sc = ctx.scene;
  const spr = u.sprite;
  u.badge.setVisible(false);
  u.posed = true;
  void u.play('hit', { hold: true });
  const box = spriteBox(sc, spr);
  const arcs = Raster.around(sc, box.cx, box.cy, Math.ceil(box.w) + 30, Math.ceil(box.h) + 30, spr.depth + 0.6, ADD);
  const sparks = new Sparks(sc, spr.depth + 0.7, ADD);
  const x0 = spr.x;
  ctx.sfx('lightning', { volume: 0.4, pitch: 1.5 });
  let paths: XY[][] = [];
  let next = 0;
  await run(sc, 230, (t, el) => {
    if (!spr.active) return;
    // white ↔ x-ray (dark silhouette) every other frame, bright at the start
    const ph = Math.floor(el / 34);
    if (t < 0.85) spr.setTintFill(ph % 2 === 0 ? PAL.white : ph % 4 === 1 ? PAL.night0 : PAL.teal1);
    else spr.setTintFill(PAL.white);
    spr.x = x0 + (ph % 2 ? 1 : -1) * (t < 0.8 ? 1 : 0);
    if (el >= next) {
      next = el + 40;
      paths = [];
      for (let i = 0; i < 4; i++) {
        const y0 = rr(box.top + 2, box.bottom - 2);
        const sp = box.spanAt(y0);
        if (!sp) continue;
        const a = { x: rr(sp[0], sp[1]), y: y0 };
        const b = { x: a.x + rr(-14, 14), y: a.y + rr(-12, 12) };
        paths.push(boltPath(a, b, 4, 3));
      }
      for (let i = 0; i < 3; i++) {
        const y0 = rr(box.top, box.bottom);
        const sp = box.spanAt(y0);
        if (sp) sparks.add({ x: rnd() < 0.5 ? sp[0] : sp[1], y: y0, vx: rr(-60, 60), vy: rr(-80, -10), ay: 300, life: rr(160, 280), ramp: TEAL_FX, trail: true });
      }
    }
    arcs.draw((g) => {
      for (const p of paths) {
        g.path(p, PAL.teal4, 1);
        if (rnd() < 0.5) g.path(p.map((q) => ({ x: q.x, y: q.y - 1 })), PAL.white, 0.8);
      }
    });
  });
  arcs.destroy();
  if (!spr.active) {
    sparks.close();
    return;
  }
  spr.x = x0;
  spr.clearTint();
  ctx.sfx('shatter', { volume: 0.9 });
  ctx.sfx('impactHeavy', { volume: 0.4, pitch: 1.3 });
  sparks.burst(22, () => {
    const a = rr(Math.PI * 1.05, Math.PI * 1.95);
    const sp = rr(80, 200);
    return { x: box.cx + rr(-4, 4), y: box.cy + rr(-4, 4), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: 420, drag: 1, life: rr(300, 560), ramp: TEAL_FX, trail: true };
  });
  sparks.close();
  const sh = shatter(sc, spr, { monsterId: u.cardId, attribute: u.attribute, push: { x: 0, y: -1 }, glitchMs: 50, stopMs: 50 });
  // the card can start for the graveyard while the debris is still flying
  await Promise.race([sh, wait(sc, 280)]);
  void sh.then(() => u.retire(300));
}

/** The lightning owns the victim's death: electrocution + shatter, scorched tile, card to the graveyard. */
registerCardHook('judgment_bolt', 'destroys', async (ctx) => {
  const ev = ctx.ev;
  if (ev.location !== 'monster') return ctx.base();
  const sc = ctx.scene;
  const field = ctx.views.field;
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid, { until: (e) => e.type !== 'toGraveyard' && e.type !== 'destroy' });
  const gEv = evAt(ctx, gi, 'toGraveyard');
  if (gi >= 0) ctx.consumeAt(gi);
  const { tile, unit } = field.release(ev.uid);
  const home = tile ? tile.home : zoneXY(ev.player, 'monster', ev.zone);
  const jobs: Promise<unknown>[] = [];
  if (unit && !unit.retired && unit.sprite.active && unit.sprite.visible) {
    if (tile) jobs.push(wait(sc, 160).then(() => tile.dissolve(460)).then(() => tile.destroy()));
    await electrocute(ctx, unit);
  } else {
    unit?.retire(0);
    if (tile) {
      // a face-down card is torn open by the bolt and burns away
      if (!tile.faceUp) {
        tile.setCard(ev.cardId);
        await tile.flipUp(200);
      }
      void tile.pulse(PAL.white, 160);
      ctx.sfx('shatter', { volume: 0.7, pitch: 1.2 });
      await tile.dissolve(460);
      tile.destroy();
    }
  }
  field.forget(ev.uid);
  if (gEv) jobs.push(fx.cardToGraveyard(ctx, { owner: gEv.owner, cardId: ev.cardId, from: { x: home.x, y: home.y - 4 } }));
  await fx.all(jobs);
});

