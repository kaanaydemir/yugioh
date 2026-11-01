// Bulut Yavrusu (cloud_hatchling) — "Hıçkırık Halkası" and "Yumurtaya Dönüş" (docs/v3/kart-a/cloud_hatchling.md
// §5.2–§5.5, §5.8). v3 look only (the v1 look has no art for this card: it keeps the generic strike / death).
//
// The strike: the declaration's held cheek-puff (attack f1) goes on into two hops toward the target (grown:
// two forepaw stomps, a 1-px shake each), the long "ha…" (f6), and the CHOO (release f8): a HOLLOW RING OF
// WIND is born at the mouth. It flies along the duel axis as a projected circle in the plane at right angles
// to its travel (a leaning open ellipse, not an upright sliver), growing D 8 → 14 (grown 12 → 24) one step
// per 60 ms, three whistle streaks flickering behind it, a mist floor pool under it; on every stretch of
// floor it crosses it presses a flattened annulus that steps out over ≈ 1 s (the ground remembers the
// sneeze). Contact: one frame round the target's torso (the far half behind its depth, the near half in
// front), the squeeze (two steps smaller), the snap into 8 arcs flying out in the ring's own plane. The
// hatchling plops on its tail and hops home on f11 / f12.
//   blocked   the ring squeezes but cannot close: it stalls, rebounds back along its path shrinking, and
//             bonks the hatchling's face (its `hit`), riding the battle kit's backlash line
//   losing    the ring fizzles into four dots ("pıt"); the kit's backlash answers; our death follows
//   tie       the snap + the backlash; both die
//   direct    the ring flies to the duelist rising on a 10-px arc and snaps there, a gust of dust below
// The death: the art's own pose (curl → the egg re-knits round it → the float frames f10–f12) scored on its
// marks; the card is born on the lift-off frame (f10); the egg rides its cloud up 14 px in a ping-pong of
// the float frames (each frame change carries a whole-px rise), its cloud shadow shrinking on the floor;
// the last 100 ms it breaks up into 2×2 pixel clusters drifting upward. It never calls the shared shatter
// (whose cache keys / P2 test read the baby's id): every pixel read goes through unitFrame (the grown art
// and the P2 relight).
// Everything on whole pixels, palette tones only, no alpha on the drawn pieces, stepped light, no camera.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { unitFrame, variantOf } from '../../duel/unit-variant';
import { DEPTH, LOOK_V3, type XY, zoneXY } from '../../view/layout';
import { lightFlash, lightPool } from '../../view/light';
import { shake } from '../../vfx/core';
import type { GameEvent } from '../../engine/types';
import type { StrikeArgs } from '../_core/types';
import { registerCardHook, registerStrike } from '../api';
import { strikeStartFrame } from '../_v3/clash';
import { behindBodies, cardLeaves } from '../_v3/card';
import { contactFlash } from '../_v3/flash';
import { deathStartFrom, takePlannedEntry } from '../_v3/posematch';
import { planGuardBreak, runGuardBreak, showsGuard } from '../_v3/guardbreak';
import { atFrame, panAt, play, soundsOfUnit, start, takeCharge } from '../_v3/sound';
import { followLight, layer, norm, onFrame, placeFeet, playFrom, seed, sleep, sourceOwnsDestroy, sub, RR, type Ctx } from './_kit';
import { drawCloudShadow, drawDust, drawFizzle, drawGrassPatch, drawRing, drawShards, drawStreaks, eggScatter } from './cloud_hatchling-fx';

const STEP = 1000 / 60;

/** The ring's diameters through its flight, one step per 60 ms (baby / grown, §5.2). */
const RING_D = { baby: [8, 10, 12, 14], grown: [12, 16, 20, 24] } as const;

/** The frame-space point `name` of the frame the unit shows, in world px. */
function framePt(u: MonsterUnit, name: 'muzzle' | 'core'): XY {
  const fi = u.frameInfo();
  const p = u.art.points && fi.anim ? u.art.points(fi.anim, fi.frame)[name] : undefined;
  if (!p) return name === 'muzzle' ? u.muzzle() : u.core();
  const w = u.framePoint(p.x, p.y);
  return { x: Math.round(w.x), y: Math.round(w.y) };
}

/** A burst of 2-px dust dashes on the floor round a point (fire-and-forget, ≈ 260 ms). */
function dustBurst(u: MonsterUnit, at: XY, n: number, o: { spread?: number; speed?: number; dir?: number } = {}): void {
  const sc = u.scene;
  const px = layer(sc, DEPTH.SHADOW + 1);
  const ds: { x: number; y: number; vx: number; vy: number }[] = [];
  for (let i = 0; i < n; i++) {
    // a crescent pushed out to the sides / back of the landing (dir: −1 behind, +1 ahead, 0 both)
    const side = i % 2 === 0 ? -1 : 1;
    const a = (o.dir ?? 0) === 0 ? side * RR(0.2, 1.3) : o.dir! > 0 ? RR(-0.9, 0.9) : Math.PI + RR(-0.9, 0.9);
    const sp = (o.speed ?? 40) * RR(0.6, 1.1);
    ds.push({ x: at.x + Math.cos(a) * (o.spread ?? 4), y: at.y + Math.sin(a) * 1.5, vx: Math.cos(a) * sp * (o.dir ? 1 : side > 0 ? 1 : 1), vy: Math.sin(a) * sp * 0.25 });
  }
  const life = 260;
  onFrame(
    sc,
    (_dt, el) => {
      px.clear();
      const t = el / life;
      if (t >= 1) return false;
      const s = (el / 1000) * (1 - t * 0.5);
      for (const d of ds) drawDust(px, d.x + d.vx * s, d.y + d.vy * s, t);
      return true;
    },
    () => px.g.destroy(),
  );
}

// ================================================================ the strike

async function hatchRingV3(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  seed(u.uid * 173 + (s.target?.uid ?? 11));
  const grown = variantOf(u) === 'grown';
  const C = soundsOfUnit(u);
  const n = u.frameCount('attack');
  const relF = u.markFrame('attack', 'release', 8);
  const held = strikeStartFrame(u);
  const f0 = held > 0 ? Math.min(held + 1, relF) : 0;
  const result = s.ctx.ev.result;
  const loses = result === 'attackerDestroyed';
  const tie = result === 'bothDestroyed';
  const blocked = s.blocked && !loses && !tie;
  const target = s.direct ? null : s.target;
  const home: XY = { ...u.home };
  const ground: XY = target ? target.home : s.toGround;
  const pan = panAt(home.x);
  const tpan = panAt(ground.x);
  const travel = norm(sub(ground, home));
  const hop = grown ? 6 : 8;
  const charge = takeCharge(u, C?.charge ?? 'hatchInhale', { volume: 0.85, pan });
  let alive = true;
  const live = () => alive && u.sprite.active && !u.retired;
  const feetAt = (k: number): XY => ({ x: Math.round(home.x + travel.x * k), y: Math.round(home.y + travel.y * k) });

  // ---- the hops (grown: the stomps): the body moves only on the frame that shows the hop (HA-11)
  const hopTo = (k: number) => {
    if (live()) placeFeet(u, feetAt(k));
  };
  const land = (k: number) => {
    if (!live()) return;
    play(C?.swing ?? 'hatchHop', { volume: grown ? 0.8 : 0.7, pan });
    const f = feetAt(k);
    dustBurst(u, { x: f.x, y: f.y + 1 }, 2, { spread: 5, speed: 34, dir: -1 });
    if (grown) void shake(sc, 90, 1);
  };
  atFrame(u, 'attack', 2, () => hopTo(hop), { maxMs: 3000 });
  atFrame(u, 'attack', 3, () => land(hop), { maxMs: 3000 });
  atFrame(u, 'attack', 4, () => hopTo(hop * 2), { maxMs: 3000 });
  atFrame(u, 'attack', 5, () => land(hop * 2), { maxMs: 3000 });
  // home in two whole-px steps on the recovery frames (a dying attacker is taken home at contact instead)
  let homing = !loses && !tie;
  atFrame(u, 'attack', Math.min(n - 1, 11), () => homing && live() && placeFeet(u, feetAt(hop)), { maxMs: 4000 });
  atFrame(u, 'attack', Math.min(n - 1, 12), () => homing && live() && placeFeet(u, home), { maxMs: 4000 });
  atFrame(u, 'attack', 9, () => {
    if (homing && live()) play(grown ? 'hatchGrownStomp' : 'hatchPlop', { volume: grown ? 0.6 : 0.7, pan });
  }, { maxMs: 4000 });

  const anim = playFrom(u, 'attack', f0);
  try {
    await u.playToFrame('attack', relF);
  } catch {
    /* the sprite left */
  }
  charge.stop(40);
  if (!live()) {
    alive = false;
    placeFeet(u, home);
    return;
  }

  // ---- release: the ring is born at the mouth
  play(C?.release ?? 'hatchSneeze', { volume: 0.9, pan });
  const whistleName = grown ? 'hatchGrownWhistle' : s.direct ? 'hatchRingWhistle' : travel.x >= 0 ? 'hatchRingWhistleR' : 'hatchRingWhistleL';
  const whistle = start(whistleName, { volume: 0.85, pan });
  const mz = framePt(u, 'muzzle');
  void lightFlash(sc, mz.x, mz.y, PAL.mist, 14, 160, { floorY: feetAt(hop * 2).y, intensity: 0.6 });
  const Ds = grown ? RING_D.grown : RING_D.baby;
  const Dmax = Ds[Ds.length - 1];
  const flightMs = s.direct ? 260 : grown ? 260 : 240;
  const aim: XY = target ? { x: Math.round(target.core().x), y: Math.round(target.core().y) } : { x: Math.round(s.to.x), y: Math.round(s.to.y) };
  const from: XY = { ...mz };
  // the floor under the ring (for its pool and the pressed patches): from the hatchling's feet to the target's
  const g0 = feetAt(hop * 2);
  const g1 = ground;
  const air = layer(sc, DEPTH.FX - 1);
  const floor = layer(sc, DEPTH.TILE_FX + 6);
  const patches: { x: number; y: number; age: number }[] = [];
  const patchRx = grown ? 10 : 7;
  let pos: XY = { ...from };
  let D: number = Ds[0];
  const ringLight = followLight(sc, () => (alive ? pos : null), { color: PAL.mist, radius: grown ? 16 : 12, floorY: (p) => Math.round(g0.y + (g1.y - g0.y) * Math.max(0, Math.min(1, (p.x - g0.x) / ((g1.x - g0.x) || 1)))), air: 0.5, intensity: 0.7 });
  let lastPatch = -1;
  let tick = 0;
  // the patches live on after the ring (≈ 1 s, three dither steps), drawn by their own loop
  onFrame(
    sc,
    (dt) => {
      floor.clear();
      for (let i = patches.length - 1; i >= 0; i--) {
        const p = patches[i];
        p.age += dt;
        if (p.age >= 1000) {
          patches.splice(i, 1);
          continue;
        }
        drawGrassPatch(floor, p.x, p.y, patchRx, p.age < 420 ? 0 : p.age < 720 ? 1 : 2);
      }
      return alive || patches.length > 0;
    },
    () => floor.g.destroy(),
  );
  const squeezeAt = flightMs - 50;
  let squeezed = false;
  await new Promise<void>((resolve) => {
    onFrame(sc, (_dt, el) => {
      air.clear();
      if (!u.sprite.active && !target) {
        resolve();
        return false;
      }
      const t = Math.min(1, el / flightMs);
      // Sine.In over the first third, then constant: the ring leaves the mouth slow and sails
      const k = t < 0.33 ? 0.2 * (1 - Math.cos((t / 0.33) * (Math.PI / 2))) : 0.2 + ((t - 0.33) / 0.67) * 0.8;
      const arc = s.direct ? -10 * Math.sin(Math.PI * Math.min(1, k)) : 0;
      pos = { x: Math.round(from.x + (aim.x - from.x) * k), y: Math.round(from.y + (aim.y - from.y) * k + arc) };
      D = Ds[Math.min(Ds.length - 1, Math.floor(el / 60))];
      tick = Math.floor(el / STEP);
      drawStreaks(air, pos.x, pos.y, D, travel, tick);
      drawRing(air, pos.x, pos.y, D, travel);
      // a pressed patch on each stretch of floor the ring crosses (one per 26 px of ground)
      const gx = g0.x + (g1.x - g0.x) * k;
      const gy = g0.y + (g1.y - g0.y) * k;
      const idx = Math.floor((Math.hypot(gx - g0.x, gy - g0.y) + 10) / 26);
      if (idx !== lastPatch && k > 0.1 && k < 0.92) {
        lastPatch = idx;
        patches.push({ x: Math.round(gx), y: Math.round(gy), age: 0 });
      }
      if (!squeezed && el >= squeezeAt && !s.direct) {
        squeezed = true;
        play(loses ? 'hatchRingFizzle' : 'hatchRingSqueeze', { volume: 0.7, pan: tpan });
      }
      if (t >= 1) {
        resolve();
        return false;
      }
      return true;
    });
  });
  air.clear();
  whistle.stop(30);

  // ---- contact
  const hit: XY = { ...aim };
  // a dying attacker is taken home now (the backlash knocks it back onto its tile)
  if ((loses || tie) && live()) {
    homing = false;
    placeFeet(u, home);
  }
  if (loses) {
    // the fizzle: it pops into four dots, no squeeze ("pıt")
    s.impact(hit);
    void ringLight.fadeOut(80);
    await anim4(sc, 160, (t) => {
      air.clear();
      drawFizzle(air, hit.x, hit.y, D, t);
    });
    finish();
    return;
  }

  if (s.direct) {
    play(C?.impact ?? 'hatchRingTing', { volume: 0.95, pan: tpan });
    s.impact(hit);
    dustBurst(u, s.toGround, 8, { spread: 6, speed: 60 });
    void ringLight.fadeOut(120);
    await anim4(sc, 180, (t) => {
      air.clear();
      drawShards(air, hit.x, hit.y, Dmax, travel, t);
    });
    await anim;
    finish();
    return;
  }

  // the ring round the torso: the far half behind the target, the near half in front
  const tDepth = target && target.sprite.active ? target.sprite.depth : DEPTH.FX - 2;
  const back = layer(sc, tDepth - 0.5);
  const front = layer(sc, tDepth + 0.5);
  const ringAt = (d: number) => {
    back.clear();
    front.clear();
    drawRing(back, hit.x, hit.y, d, travel, 'far');
    drawRing(front, hit.x, hit.y, d, travel, 'near');
  };
  ringAt(Dmax);
  play(C?.impact ?? 'hatchRingTing', { volume: blocked ? 0.7 : 0.95, pitch: blocked ? 0.9 : 1, pan: tpan });
  s.impact(hit);
  void lightFlash(sc, ground.x, ground.y, PAL.mist, grown ? 30 : 24, 120, { floorY: ground.y, intensity: 0.9 });
  void ringLight.fadeOut(120);
  if (!blocked) void shake(sc, grown ? 220 : 140, grown ? 3 : s.power >= 3 ? 2 : 1);
  if (s.power >= 3 && !blocked) dustBurst(u, ground, 8, { spread: 8, speed: 50 });

  if (blocked) {
    // it squeezes but cannot close: stalls two frames, then rebounds back along its path, shrinking
    play('hatchRingRebound', { volume: 0.8, pan: tpan });
    await sleep(sc, STEP * 2);
    ringAt(Dmax - 2);
    await sleep(sc, STEP * 2);
    ringAt(Dmax);
    await sleep(sc, STEP);
    back.g.destroy();
    front.g.destroy();
    const face = live() ? framePt(u, 'muzzle') : from;
    const RB = 180;
    await anim4(sc, RB, (t, el) => {
      air.clear();
      const p = { x: Math.round(hit.x + (face.x - hit.x) * t), y: Math.round(hit.y + (face.y - hit.y) * t) };
      const d = Ds[Math.max(0, Ds.length - 1 - Math.floor((el / RB) * Ds.length))];
      drawRing(air, p.x, p.y, d, travel);
    });
    air.clear();
    // the bonk: the hatchling's own small hit, then it sits back on its tail (idle)
    if (live()) {
      homing = false;
      placeFeet(u, home);
      void u.play('hit');
      void lightFlash(sc, face.x, face.y, PAL.mist, 10, 100, { floorY: home.y, intensity: 0.7 });
    }
    await sleep(sc, u.animMs('hit'));
    finish();
    return;
  }

  // the squeeze (the same table run backward, two steps) and the snap into 8 arcs
  await sleep(sc, STEP * 2);
  ringAt(Ds[Ds.length - 2]);
  await sleep(sc, STEP * 2);
  ringAt(Ds[Ds.length - 3]);
  await sleep(sc, STEP * 2);
  back.g.destroy();
  front.g.destroy();
  const shards = anim4(sc, 180, (t) => {
    air.clear();
    drawShards(air, hit.x, hit.y, Ds[Ds.length - 3], travel, t);
  });
  if (tie) {
    await shards;
    finish();
    return;
  }
  await Promise.all([shards, anim]);
  if (live()) placeFeet(u, home);
  finish();

  function finish(): void {
    alive = false;
    air.g.destroy();
    whistle.stop(30);
    void ringLight.fadeOut(80);
    if (u.sprite.active && !u.retired && homing) placeFeet(u, home);
  }
}

/** A scene-clock animation over `ms` (t 0 … 1), resolved at its end. */
function anim4(sc: Phaser.Scene, ms: number, fn: (t: number, el: number) => void): Promise<void> {
  return new Promise<void>((resolve) => {
    onFrame(
      sc,
      (_dt, el) => {
        const t = Math.min(1, el / ms);
        fn(t, el);
        return t < 1;
      },
      () => resolve(),
    );
  });
}

// ================================================================ the death: Yumurtaya Dönüş

type ToGraveyardEv = Extract<GameEvent, { type: 'toGraveyard' }>;

/** The float's ping-pong (death frames, 50 ms each) and the whole-px rise each frame change carries (14 px). */
const FLOAT_SEQ = [10, 11, 12, 11, 10, 11] as const;
const FLOAT_RISE = [0, 3, 2, 3, 3, 3] as const;
const FLOAT_MS = 50;

async function hatchDeathV3(ctx: Ctx<'destroy'>): Promise<void> {
  const ev = ctx.ev;
  if (ev.location !== 'monster' || sourceOwnsDestroy(ctx)) return ctx.base();
  const field = ctx.views.field;
  const u = field.unit(ev.uid);
  if (!u || u.retired || !u.sprite.active || !u.sprite.visible || !u.has('death')) return ctx.base();
  const sc = ctx.scene;
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid, {
    until: (e) => e.type !== 'toGraveyard' && e.type !== 'destroy' && e.type !== 'fieldSpell' && e.type !== 'statChange',
  });
  const gEv = gi >= 0 ? (ctx.events[gi] as ToGraveyardEv) : null;
  if (gi >= 0) ctx.consumeAt(gi);
  const owner = gEv ? gEv.owner : ctx.owner(ev.uid);
  const { tile } = field.release(ev.uid);
  const home: XY = tile ? { x: tile.home.x, y: tile.home.y } : zoneXY(ev.player, 'monster', ev.zone);
  const grown = variantOf(u) === 'grown';
  u.badge.setVisible(false);
  u.posed = true;
  const pan = panAt(home.x);
  let leave: Promise<void> | null = null;
  const onBorn = typeof ctx.hints.onBorn === 'function' ? (ctx.hints.onBorn as () => void) : null;
  const burst = () => {
    if (leave) return;
    try {
      onBorn?.();
    } catch (e) {
      console.error('[hatchling death] onBorn', e);
    }
    if (gEv) leave = cardLeaves(ctx, { owner, cardId: ev.cardId, from: home, tile, depthAt: behindBodies(ctx, u) }).catch((e) => console.error('[hatchling death] card', e));
    else if (tile && tile.active)
      leave = tile
        .dissolve(420)
        .then(() => {
          if (tile.active) tile.destroy();
        })
        .catch(() => undefined);
    else leave = Promise.resolve();
  };
  sc.events.emit('v3:dying', u);
  let pool: ReturnType<typeof lightPool> | null = null;
  try {
    await eggDeath(ctx, u, home, grown, pan, burst, (p) => (pool = p));
  } catch (e) {
    console.error('[hatchling death] failed', e);
  } finally {
    burst();
    (pool as ReturnType<typeof lightPool> | null)?.fadeOut(200);
    u.posed = false;
    if (!u.retired) u.retire(0);
    field.forget(ev.uid);
    sc.events.emit('v3:dead', u);
  }
  await leave;
}

async function eggDeath(ctx: Ctx<'destroy'>, u: MonsterUnit, home: XY, grown: boolean, pan: number, burst: () => void, setPool: (p: ReturnType<typeof lightPool>) => void): Promise<void> {
  const sc = ctx.scene;
  const n = u.frameCount('death');
  const push = ctx.hints.push as XY | undefined;
  if (ctx.hints.hit !== false) contactFlash(sc, u.sprite, push ?? { x: u.player === 0 ? -1 : 1, y: 0 }, { frames: 2, coverage: 0.4 });
  const inDeath = () => u.frameInfo().anim === 'death';
  // a lethal recoil hands over to the pose by itself (react.ts): join it where it is; a guard breaks open
  let planned = takePlannedEntry(u);
  if (!planned && !inDeath() && u.sprite.active && showsGuard(u)) {
    const g = planGuardBreak(u);
    if (g) {
      runGuardBreak(u, g);
      planned = takePlannedEntry(u);
    }
  }
  if (planned && !inDeath()) {
    const lead = Math.min(700, (planned.leadMs ?? u.rangeMs(planned.anim, 0, planned.hold)) + 40);
    await new Promise<void>((resolve) => {
      onFrame(sc, (_dt, el) => {
        if (inDeath() || el >= lead) {
          resolve();
          return false;
        }
        return true;
      });
    });
  }
  if (!inDeath() && u.sprite.active) {
    const startF = Math.max(0, Math.min(n - 2, planned ? planned.start : deathStartFrom(u)));
    u.asClaimant(() => void u.playRange('death', startF, undefined, { hold: true }));
  }
  const untilFrame = (f: number): Promise<void> => {
    const fi = u.frameInfo();
    if (!u.sprite.active || fi.anim !== 'death' || fi.frame >= f) return Promise.resolve();
    if (!u.sprite.anims.isPlaying) return Promise.resolve();
    return u.asClaimant(() => u.playToFrame('death', f));
  };
  // ---- the death's own beats on their frames (its voice through soundsOfUnit: the grown curl is its own)
  const C = soundsOfUnit(u);
  const dissolveF = u.markFrame('death', 'dissolve', 4);
  if (C) {
    if (C.deathStart) atFrame(u, 'death', 1, () => play(C.deathStart!, { pan }), { late: false });
    if (grown) atFrame(u, 'death', 3, () => play('hatchUnAge', { volume: 0.8, pan }), { late: false });
    atFrame(u, 'death', dissolveF, () => play(C.dissolve, { volume: 0.8, pan }), { late: false });
    for (const [off, name, volume] of C.afterDissolve ?? []) atFrame(u, 'death', Math.min(n - 1, dissolveF + off), () => play(name, { volume, pan }), { late: false });
  }
  // the knit's warm light: a stepped skin4 pool that grows with the knit (dissolve → f7) and steps down at lift-off
  atFrame(u, 'death', dissolveF, () => {
    const p = lightPool(sc, home.x, home.y, { color: PAL.skin4, radius: 16, intensity: 0.2, fadeIn: 0 });
    p.setIntensity(0.7, Math.max(60, u.rangeMs('death', dissolveF, Math.min(n - 1, dissolveF + 3))));
    setPool(p);
  }, { late: false });
  const liftF = Math.min(n - 1, FLOAT_SEQ[0]);
  await untilFrame(liftF);
  if (!u.sprite.active || !u.sprite.visible) return;
  // ---- lift-off = the burst frame: the card is born, the egg rides its cloud up
  burst();
  if (C) play(C.burst, { pan });
  u.shadow.setVisible(false);
  // a battle loser is claimed (its position pinned every frame): the death owns it now, the egg rises
  if (u.claimed) u.unclaim();
  const shadow = layer(sc, DEPTH.SHADOW + 0.5);
  let lift = 0;
  let shadowRx = 13;
  let floating = true;
  onFrame(
    sc,
    () => {
      shadow.clear();
      if (!floating) return false;
      drawCloudShadow(shadow, home.x, home.y + 1, shadowRx);
      return true;
    },
    () => shadow.g.destroy(),
  );
  const seq = FLOAT_SEQ.map((f) => Math.min(n - 1, f));
  const scatterAt = seq.length - 2; // the last 100 ms
  let scatter: Promise<void> | null = null;
  for (let i = 0; i < seq.length; i++) {
    if (!u.sprite.active) break;
    lift += FLOAT_RISE[i];
    u.asClaimant(() => u.pose('death', seq[i]));
    placeFeet(u, home, lift);
    shadowRx = Math.max(7, 13 - Math.round(lift / 2.4));
    if (i === scatterAt && !scatter) {
      const fi = u.frameInfo();
      const pc = unitFrame(u, 'death', fi.frame, u.sheetKey.endsWith(':p2') ? { lightFrom: 'right' } : undefined);
      scatter = eggScatter(sc, u, pc, u.sprite.depth + 0.1, 260);
      u.sprite.setVisible(false);
      floating = false;
    }
    await sleep(sc, FLOAT_MS);
  }
  floating = false;
  u.sprite.setVisible(false);
  // the clusters drift on by themselves (≈ 160 ms more); the card is already in flight
  void scatter;
}

if (LOOK_V3) {
  registerStrike('cloud_hatchling', hatchRingV3, { name: 'strikes-a:cloud_hatchling' });
  registerCardHook('cloud_hatchling', 'destroyed', hatchDeathV3, { name: 'strikes-a:cloud_hatchling:death' });
}
