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
//
// The v3 look (?look=v3; docs/v3/A0_ENVANTER.md §6.2 item 9), boltV3 below — scene ms, from the hand:
//   0       the card leaves the hand on whole pixels for its owner's side (spells/_kit v3 opening)
//   ~200    it hovers beside its duelist; the storm starts gathering over the victim (≤ 0.4 s, local)
//   ~275    release: the orb leaves the card's top edge for the cloud's eye (the card stays, spent)
//   ~560    STRIKE: the bolt hits the body's top; full brightness ≈ 100 ms (the strike frame + the
//           80 ms hit-stop; dimmer re-strikes after), its stepped light on the victim's pad and lane
//           only — no screen white, HUD untouched; the bolt itself is a crisp zig-zag (a white 3-px
//           core in a 5-px teal body, 1-px forks that stay above the body; stormStrike v3); the
//           victim's own hitMagic (reaction kit; its jolt frame always shows, joltFirst) + an
//           electric tint (arcs crawling inside it, its edge crackling) — never a full-silhouette fill
//   +190    THE MONSTER'S OWN DEATH: the destroy plays through the monster's own 'destroyed' hook
//           (the death kit: its death pose, its material) — under v3 this card registers NO
//           'destroys' hook, because a registered one makes the monsters' deaths step aside
//           (strikes kits sourceOwnsDestroy) and it would own the death again
//   cards   one after another: the spent spell card (strike + 160), then whatever the run breaks
//           with it (an equip, from the death's start), then the victim's card (born on its tile
//           the frame its body breaks).

import Phaser from 'phaser';
import type { GameEvent } from '../../engine/types';
import { PAL, RAMPS } from '../../art/palette';
import { DEPTH, LOOK_V3, type XY, zoneXY } from '../../view/layout';
import { TEX, wait } from '../../vfx/core';
import { shatter } from '../../vfx/shatter';
import { Raster, Sparks, boltPath, rnd, rr, run, spriteBox, stormStrike } from '../../vfx/setpieces';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { Sparks as PxSparks } from '../../vfx/combat';
import { DEATH_AFTER_CONTACT_MS } from '../_v3/budget';
import { plannedEntry, reactHit } from '../_v3/react';
import { fx, registerCardHook, type CinematicContext } from '../api';
import {
  TEAL_FX,
  bg,
  evAt,
  idxOf,
  relax,
  sendResolved,
  setTileOf,
  spellOpening,
  fs,
  lightBeam,
  lightDim,
  lightFlash,
  lightPool,
  type LightHandle,
} from './_kit';

type DestroyCtx = CinematicContext<Extract<GameEvent, { type: 'destroy' }>>;

const ADD = Phaser.BlendModes.ADD;

registerCardHook('judgment_bolt', 'activate', async (ctx) => {
  if (LOOK_V3) return boltV3(ctx);
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
  // (v2) the storm's light: the arena darkens under the gathering clouds, the eye flickers,
  // the strike blasts white light over the whole lane
  let eyeLight: LightHandle | null = null;
  const startStorm = () => {
    if (!ground0) return;
    bg(ctx.focus({ x: ground0.x, y: ground0.y - 40 }, { zoom: 1.06, ms: 560, pan: 0.3 }));
    void lightDim(sc, 0.6, 480);
    eyeLight = lightPool(sc, ground0.x, Math.max(30, ground0.y - 118) + 6, { color: PAL.teal3, radius: fs(30), floorY: ground0.y, air: 0.5, airRadius: 26, intensity: 0, anim: 'flicker', fadeIn: 0 });
    eyeLight.setIntensity(0.55, 500);
    storm = stormStrike(sc, ground0.x, ground0.y, {
      onImpact: () => {
        struck = true;
        void lightFlash(sc, ground0.x, ground0.y - 40, PAL.white, fs(96), 700, { floorY: ground0.y, ring: true, intensity: 1.6, air: 0.7 });
        void lightFlash(sc, ground0.x, ground0.y, PAL.teal4, fs(50), 900, { intensity: 0.8 });
        bg(lightBeam(sc, { x: ground0.x, y: Math.max(0, ground0.y - 150) }, { x: ground0.x, y: ground0.y - 6 }, PAL.teal4, 260, { width: 18, intensity: 1.3, shimmer: 0.7, rise: 20 }).done);
        void eyeLight?.fadeOut(300);
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
  await op.release(eye, { path: 'line', ms: 200, size: 2, floorTo: ground0.y });
  // the orb feeds the storm's eye
  bg(spark(sc, eye));
  await storm;
  void lightDim(sc, 0, 650);
  void (eyeLight as LightHandle | null)?.fadeOut(200);
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
  // (v2) the crawling arcs flicker teal light on the floor round the victim
  const zap = lightPool(sc, box.cx, box.cy, { color: PAL.teal4, radius: fs(28), floorY: u.home.y, air: 0.4, intensity: 0.9, anim: 'flicker', fadeIn: 0 });
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
  void zap.fadeOut(160);
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

/**
 * The lightning owns the victim's death: electrocution + shatter, scorched tile, card to the graveyard.
 * v1 / v2 only: under the v3 look the monster dies its own death (see the header).
 */
if (!LOOK_V3) registerCardHook('judgment_bolt', 'destroys', async (ctx) => {
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


// ================================================================ the v3 look (?look=v3)

type ActCtx = CinematicContext<Extract<GameEvent, { type: 'activate' }>>;

/** ms from the storm's start to the strike (the cloud has gathered in ≤ 0.4 s, A0 §6.2 item 9). */
const STRIKE_AT_V3 = 340;
/** The hit-stop on the strike frame (60–100 ms). */
const BOLT_STOP_V3 = 80;
/** The spent card leaves this long after the strike (first of the cards going to the graveyard). */
const SPENT_AFTER_V3 = 160;
/**
 * What breaks with the victim (an equip's rule destroy) starts this long after the strike: its card
 * dissolves on its tile and flies between the spent spell card and the victim's own card.
 */
const REST_AFTER_V3 = 300;

/** The equip aura burnt off a struck body: a ring of gold pixels. */
function goldBurst(sc: Phaser.Scene, at: XY): void {
  const s = new PxSparks(sc, DEPTH.FX + 3);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const v = rr(50, 110);
    s.add({ x: Math.round(at.x), y: Math.round(at.y), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 20, ay: 260, drag: 1.5, life: rr(240, 420), colors: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2], shape: i % 4 === 0 ? 'plus' : 'px', fadeAt: 1 });
  }
  s.release();
}

/**
 * The electric tint over a struck body (v3): short 1-px arcs crawl inside its silhouette, its edge
 * crackles (teal / white rim pixels on alternate rows, flickering) and sparks jump off it — never a
 * flat fill over the body. Follows the sprite; ends on its own (or when the body breaks / hides).
 */
function electricTint(sc: Phaser.Scene, u: MonsterUnit, ms = 460): void {
  const s = u.sprite;
  const pad = 20;
  let box = spriteBox(sc, s);
  const arcs = new Raster(sc, box.left - pad, box.top - pad, Math.ceil(box.w) + pad * 2, Math.ceil(box.h) + pad * 2, s.depth + 0.6);
  const sparks = new PxSparks(sc, s.depth + 0.7);
  const zap = lightPool(sc, u.home.x, u.home.y, { color: PAL.teal4, radius: 24, floorY: u.home.y, intensity: 0.8, anim: 'flicker', fadeIn: 0 });
  let paths: XY[][] = [];
  let next = 0;
  void run(sc, ms, (t, el) => {
    if (!s.active || !s.visible) {
      paths = [];
      return;
    }
    if (el >= next) {
      next = el + 40;
      box = spriteBox(sc, s);
      arcs.moveTo(Math.round(box.left) - pad, Math.round(box.top) - pad);
      paths = [];
      const n = t < 0.5 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const y0 = rr(box.top + 2, box.bottom - 2);
        const sp = box.spanAt(y0);
        if (!sp || sp[1] - sp[0] < 4) continue;
        const a = { x: rr(sp[0] + 1, sp[1] - 1), y: y0 };
        const b = { x: a.x + rr(-10, 10), y: a.y + rr(-9, 9) };
        const sp2 = box.spanAt(b.y);
        if (!sp2) continue;
        b.x = Math.max(sp2[0] + 1, Math.min(sp2[1] - 1, b.x));
        paths.push(boltPath(a, b, 3, 2));
      }
      if (rnd() < 0.7) {
        const y0 = rr(box.top, box.bottom);
        const sp = box.spanAt(y0);
        if (sp) sparks.add({ x: Math.round(rnd() < 0.5 ? sp[0] : sp[1]), y: Math.round(y0), vx: rr(-60, 60), vy: rr(-80, -20), ay: 300, life: rr(140, 240), colors: [PAL.white, PAL.teal4, PAL.teal3], shape: 'px', fadeAt: 1 });
      }
    }
    // the charge crackles along the silhouette's edge: rim pixels on alternate rows, every other step
    const rim = t < 0.65 && Math.floor(el / 40) % 2 === 0;
    const phase = Math.floor(el / 80) % 2;
    arcs.draw((g) => {
      if (rim)
        for (let y = Math.ceil(box.top) + phase; y < box.bottom; y += 2) {
          const sp = box.spanAt(y);
          if (!sp) continue;
          g.px(Math.floor(sp[0]) - 1, y, (y >> 1) % 3 === 0 ? PAL.white : PAL.teal4);
          g.px(Math.ceil(sp[1]), y, (y >> 1) % 3 === 1 ? PAL.white : PAL.teal4);
        }
      for (const p of paths) {
        g.path(p, PAL.teal4, t < 0.7 ? 1 : 0.5);
        if (t < 0.5 && rnd() < 0.5) g.path(p.map((q) => ({ x: q.x, y: q.y - 1 })), PAL.white, 1);
      }
    });
  }).then(() => {
    arcs.destroy();
    sparks.release();
    void zap.fadeOut(140);
  });
}

/** A jolt whose death entry costs at most this (idleΔ) is shown before the death takes over. */
const JOLT_MAX_COST = 2;

/**
 * A2 motion review r2 #3: the bolt's magic jolt always shows. When the lethal recoil's plan
 * (react.ts → posematch.planDeathEntry) lets the death pose REPLACE the hitMagic jolt frame
 * (hold 0: its death f0 continues the jolt closely — the magus' helm-snap, Δ 1.4 × idleΔ), the jolt
 * frame itself (eyes and sigil flare, crackle) holds through the hit-stop and its own hold, then
 * the death pose takes over on the planned frame — a close continuation, never a jump.
 */
function joltFirst(sc: Phaser.Scene, u: MonsterUnit): void {
  const plan = plannedEntry(u);
  if (!plan || plan.anim !== 'hitMagic' || plan.hold !== 0 || plan.cost > JOLT_MAX_COST || !u.has('hitMagic')) return;
  if (!u.asClaimant(() => u.pose('hitMagic', 0))) return;
  void wait(sc, u.frameMs('hitMagic', 0)).then(() => {
    if (u.retired || !u.sprite.active) return;
    const fi = u.frameInfo();
    // only while the jolt still shows (the death kit, or anything else, may have taken it over)
    if (fi.anim !== 'hitMagic' || fi.frame !== 0) return;
    u.asClaimant(() => void u.playRange('death', plan.start, undefined, { hold: true }));
  });
}

/** The cloud's eye taking the card's orb: a small burst of teal-white pixels. */
function eyeSpark(sc: Phaser.Scene, at: XY): void {
  const s = new PxSparks(sc, DEPTH.FX + 9);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const sp = rr(40, 90);
    s.add({ x: at.x, y: at.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, drag: 4, life: rr(180, 300), colors: [PAL.white, PAL.teal4, PAL.teal3, PAL.teal2], shape: i % 3 === 0 ? 'plus' : 'px', fadeAt: 1 });
  }
  s.release();
}

/** Yıldırım Hükmü, the v3 look (see the header). */
async function boltV3(ctx: ActCtx): Promise<void> {
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
  const victim = unit0 && !unit0.retired && unit0.sprite.active && unit0.sprite.visible ? unit0 : null;
  const di = ref ? idxOf(ctx, run0, (e) => e.type === 'destroy' && e.location === 'monster' && e.player === ref.player && e.zone === ref.index) : -1;
  const dEv = evAt(ctx, di, 'destroy');
  // the victim's own trip to the graveyard (its death claims it) and the spell's: not "the rest"
  const vgi = dEv ? idxOf(ctx, run0, (e) => e.type === 'toGraveyard' && e.uid === dEv.uid) : -1;
  const rest = run0.filter((i) => i !== ti && i !== gi && i !== di && i !== vgi);
  let storm: Promise<void> = Promise.resolve();
  let destroyed: Promise<void> = Promise.resolve();
  let spent: Promise<void> = Promise.resolve();
  let others: Promise<void> = Promise.resolve();
  let started = false;
  let leave: ((gi: number, from?: XY) => Promise<void>) | null = null;
  let stormStarted!: () => void;
  const stormGo = new Promise<void>((r) => (stormStarted = r));
  const hitY = victim ? Math.round(victim.worldPoint('top').y) + 2 : ground0 ? ground0.y - 4 : 0;
  const strike = () => {
    if (victim && victim.sprite.active && !victim.retired) {
      // the victim's own magic recoil (hitMagic → hit), held: its death starts from that pose
      void reactHit(ctx, victim, { power: 3, dir: { x: 0, y: 1 }, at: { x: ground0!.x, y: hitY }, ramp: RAMPS.teal, kind: 'magic', lethal: true, noStop: true, by: null });
      joltFirst(sc, victim);
      electricTint(sc, victim, 460);
      // an equip's aura is burnt off by the bolt (gold pixels): the blade's own break then never
      // glows the whole dying body (dragon_blade burstAura skips a unit without the aura)
      if (victim.hasAura('equip')) {
        victim.setAura('equip', null);
        goldBurst(sc, victim.core());
      }
    }
    // the cards leave one after another: the spent spell card first …
    spent = wait(sc, SPENT_AFTER_V3).then(() => (leave ? leave(gi) : sendResolved(ctx, gi, ground0 ?? { x: 320, y: 160 })));
    // … the monster's own death after the hit-stop and a beat of its recoil (its card is born on its
    // tile the frame its body breaks) — and what breaks with it (an equip) from the same moment
    destroyed = wait(sc, victim ? DEATH_AFTER_CONTACT_MS : 0).then(() => (di >= 0 && !ctx.isConsumed(di) ? ctx.play(di, { push: { x: 0, y: -1 }, hit: false, bolt: true }) : undefined));
    others = rest.length ? wait(sc, REST_AFTER_V3).then(() => fx.playRun(ctx, rest)) : Promise.resolve();
  };
  const startStorm = () => {
    if (!ground0 || !ref || started) return;
    started = true;
    bg(ctx.focus({ x: ground0.x, y: ground0.y - 30 }, { ms: 320, pan: 0.25 }));
    const st = zoneXY(ref.player, 'spellTrap', ref.index);
    const lane = { from: st, to: { x: ground0.x * 2 - st.x, y: ground0.y * 2 - st.y } };
    storm = stormStrike(sc, ground0.x, ground0.y, { strikeAt: STRIKE_AT_V3, stopMs: BOLT_STOP_V3, hitY, lane, onImpact: strike });
    stormStarted();
  };
  const op = await spellOpening(ctx, {
    uid: ev.uid,
    cardId: ev.cardId,
    player: ev.player,
    from: set ? 'set' : 'hand',
    zone: ev.zone,
    hold: 150,
    keepCard: true,
    releaseFrom: 'top',
    onHold: () => startStorm(),
  });
  leave = op.leave ?? null;
  if (!ref || ref.zone !== 'monster' || !ground0) {
    await op.close();
    relax(ctx);
    await fx.playRun(ctx, run0);
    return;
  }
  ctx.consumeAt(ti);
  startStorm();
  await stormGo;
  const eye: XY = { x: ground0.x, y: Math.max(34, ground0.y - 96) + 5 };
  // the orb rides up into the storm's eye (it must arrive before the strike)
  await op.release(eye, { path: 'line', ms: 180, size: 2, light: false });
  eyeSpark(sc, eye);
  await storm;
  await destroyed;
  await fx.all([spent, others]);
  if (victim && !victim.retired) {
    victim.posed = false;
    victim.settle();
  }
  relax(ctx, 320);
  await fx.playRun(ctx, fx.resolutionRun(ctx));
}
