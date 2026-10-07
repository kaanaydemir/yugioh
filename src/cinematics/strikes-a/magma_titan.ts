// Magma Titanı — "Lav Yumruğu" (GAME_DESIGN §7) + lava-splash impact, the burn-500 effect and
// the titan's death.
//
// Strike (≈1.2 s): it rises and STOMPS (shake, glowing cracks, lava droplets), cocks its fist
// and lumbers forward leaving molten footprints, the fist lands on attack frame 5 — lava
// explosion, magma blobs that splat and cool on the floor, cracks glowing under the target —
// holds, follows through and hops home. Blocked: the fist rebounds off the guard and the titan
// staggers back. Direct: it charges across the field to the duelist.
// Effect: it beats its chest, the molten core blazes white and a fireball arcs into the
// opponent's LP panel: −500.
// Death: the lava veins cool to black rock from the top down with hissing steam, then the body
// crumbles into heavy rubble that bounces on the floor.

import Phaser from 'phaser';
import { PAL, type Ramp } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { DEPTH, type XY } from '../../view/layout';
import { slash } from '../../vfx/combat';
import { burnFly } from '../../vfx/setpieces';
import { fx, registerCardHook, registerStrike } from '../api';
import type { StrikeArgs } from '../_core/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import {
  ADD,
  E,
  FloorMarks,
  RR,
  Sparks,
  TAU,
  animate,
  clamp,
  contactFeet,
  currentPixels,
  effectDamage,
  facing,
  flavoredDeath,
  frameMs,
  glow,
  glowPulse,
  holdFrame,
  homeUnit,
  lastSpot,
  layer,
  lerp,
  lerpXY,
  liveUnit,
  norm,
  onFrame,
  otherPlayer,
  overlay,
  placeFeet,
  playFrom,
  playSfx,
  screenFlash,
  seed,
  shatterPx,
  sleep,
  stopTime,
  sub,
  whiteFlash,
  worldToScreen,
} from './_kit';
import { shake } from '../../vfx/core';

const LAVA: Ramp = [PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4, PAL.gold4];
const LAVA_SET = new Set<number>([PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4, PAL.gold4, PAL.gold3, PAL.white]);
/** Floor marks just above the cards on the tiles (cracks / splats under the units). */
const MARK_DEPTH = DEPTH.CARD_ON_TILE + 2;

// ================================================================ shared bits

/** Glowing cracks radiating from a floor point. */
function groundCracks(marks: FloorMarks, at: XY, n: number, length: number, life: number): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + RR(-0.3, 0.3);
    marks.crack(at.x + Math.cos(a) * 3, at.y + Math.sin(a) * 1.5, a, length * RR(0.7, 1.2), life * RR(0.85, 1.1), [PAL.gold4, PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1]);
  }
}

/** The stomp: shake, dust, cracks around the feet, lava droplets hopping out. */
function stomp(scene: Phaser.Scene, marks: FloorMarks, feet: XY, power = 1): void {
  playSfx('earthQuake', { volume: 0.55 * power, pitch: 1.1 });
  playSfx('impactHeavy', { volume: 0.45, pitch: 0.6 });
  void shake(scene, 180, 2 * power);
  groundCracks(marks, feet, 6, 12 * power, 800);
  const ring = layer(scene, MARK_DEPTH + 1);
  void animate(scene, 280, (t) => {
    ring.clear();
    const r = 6 + 24 * power * E.outC(t);
    ring.ellipseRing(feet.x, feet.y, r, r * 0.45, t < 0.3 ? 2 : 1, t < 0.25 ? PAL.fire4 : PAL.stone3, 1 - t);
  }).then(() => ring.g.destroy());
  const sp = new Sparks(scene, DEPTH.FX - 2);
  for (let i = 0; i < 10; i++) {
    const a = RR(0, TAU);
    sp.add({ x: feet.x + Math.cos(a) * RR(6, 16), y: feet.y + Math.sin(a) * RR(2, 6), vx: Math.cos(a) * RR(10, 30), vy: RR(-30, -8), drag: 2, life: RR(380, 620), colors: [PAL.stone3, PAL.stone2, PAL.stone1], shape: 'puff', size: RR(2, 3.5), grow: 5, alpha: 0.7 });
  }
  for (let i = 0; i < 7; i++) {
    sp.add({ x: feet.x + RR(-12, 12), y: feet.y + RR(-3, 3), vx: RR(-30, 30), vy: RR(-110, -60), ay: 420, life: RR(300, 480), colors: [PAL.gold4, PAL.fire4, PAL.fire3, PAL.fire2], shape: 'sq', size: 2, floor: feet.y + RR(0, 4), bounce: 0.2 });
  }
  sp.release();
}

/** Lava Yumruğu impact: lava explosion, magma blobs that splat and cool, glowing cracks. */
export function lavaBurst(scene: Phaser.Scene, at: XY, o: { dir: XY; floor: XY; power: number; blocked?: boolean }): void {
  const marks = new FloorMarks(scene, MARK_DEPTH);
  const px = layer(scene, DEPTH.FX + 2);
  const sp = new Sparks(scene, DEPTH.FX + 3);
  const smoke = new Sparks(scene, DEPTH.FX + 1);
  const d = norm(o.dir);
  const k = o.blocked ? 0.55 : 1;
  playSfx('fireBurst', { volume: 0.9, pitch: 0.8 });
  // magma blobs: arc out, splat on the floor and cool
  const blobs: { x: number; y: number; vx: number; vy: number; r: number; floor: number; done: boolean }[] = [];
  const nb = Math.round((10 + o.power * 3) * k);
  for (let i = 0; i < nb; i++) {
    const a = Math.atan2(d.y, d.x) + RR(-1.4, 1.4) + (i % 3 === 0 ? Math.PI : 0) * 0.7;
    const v = RR(60, 150);
    blobs.push({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - RR(60, 130), r: RR(1.2, 2.6), floor: o.floor.y + RR(-8, 10), done: false });
  }
  // embers + streaks
  for (let i = 0; i < 18 * k; i++) {
    const a = RR(0, TAU);
    sp.add({ x: at.x, y: at.y, vx: Math.cos(a) * RR(80, 190), vy: Math.sin(a) * RR(60, 150) - 40, ay: 260, drag: 2, life: RR(220, 420), colors: [PAL.white, PAL.gold4, PAL.fire4, PAL.fire3, PAL.fire2], shape: 'streak', len: 0.03 });
  }
  for (let i = 0; i < 12 * k; i++) {
    sp.add({ x: at.x + RR(-8, 8), y: at.y + RR(-8, 8), vx: RR(-20, 20), vy: RR(-60, -20), drag: 1, life: RR(500, 900), colors: [PAL.gold4, PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1], shape: 'sq', size: 1, flicker: true });
  }
  for (let i = 0; i < 8 * k; i++) {
    smoke.add({ x: at.x + RR(-10, 10), y: at.y + RR(-6, 6), vx: RR(-25, 25) + d.x * 20, vy: RR(-35, -10), drag: 1.5, life: RR(500, 800), colors: [PAL.fire1, PAL.stone1, PAL.night2], shape: 'puff', size: RR(3, 5), grow: 7, alpha: 0.6 });
  }
  sp.release();
  smoke.release();
  if (!o.blocked) groundCracks(marks, o.floor, 7, 16, 1000);
  void glowPulse(scene, at.x, at.y, PAL.fire3, { from: 0.5, to: 2.4, alpha: 0.9, ms: 340, depth: DEPTH.FX + 1 });
  onFrame(
    scene,
    (dt, el) => {
      const s = dt / 1000;
      px.clear();
      // fireball core: white → gold → orange disc with a dithered rim, then a ring
      const B = 220;
      if (el < B) {
        const t = el / B;
        const r = (6 + 9 * E.outC(t)) * k;
        const shrink = 1 - E.inQ(t);
        px.disc(at.x, at.y, r * shrink + 1, PAL.fire2, 0.8);
        px.disc(at.x, at.y, r * 0.75 * shrink, t < 0.3 ? PAL.fire4 : PAL.fire3, 1);
        if (t < 0.5) px.disc(at.x, at.y, r * 0.45 * (1 - t * 2), PAL.white, 1);
        px.ring(at.x, at.y, r + 3 + 14 * t, t < 0.3 ? 2 : 1, t < 0.2 ? PAL.white : PAL.fire4, 1 - t);
        // flame tongues along the blow
        for (let i = 0; i < 6; i++) {
          const a = Math.atan2(d.y, d.x) + (i - 2.5) * 0.35;
          const L = (12 + 14 * E.outQ(t) + (i % 2) * 5) * k;
          px.seg(at.x, at.y, at.x + Math.cos(a) * L, at.y + Math.sin(a) * L, 3 * (1 - t) + 1, i % 2 ? PAL.fire3 : PAL.fire4, 1 - t);
        }
      }
      let alive = el < B ? 1 : 0;
      for (const b of blobs) {
        if (b.done) continue;
        alive++;
        b.vy += 480 * s;
        b.x += b.vx * s;
        b.y += b.vy * s;
        if (b.y >= b.floor && b.vy > 0) {
          b.done = true;
          marks.blob(b.x, b.floor, b.r + 1.5, RR(700, 1100), [PAL.gold4, PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1, PAL.stone1]);
          continue;
        }
        px.disc(b.x, b.y, b.r + 0.6, PAL.fire2, 1);
        px.disc(b.x - 0.4, b.y - 0.4, b.r * 0.6, PAL.fire4, 1);
      }
      if (!alive) {
        marks.close();
        return false;
      }
      return true;
    },
    () => px.g.destroy(),
  );
}

// ================================================================ strike

registerStrike('magma_titan', async (s: StrikeArgs) => {
  const u = s.attacker;
  const sc = s.scene;
  const spr = u.sprite;
  seed(u.uid * 53 + (s.target?.uid ?? 9));
  const sgn = facing(u);
  const F = frameMs(u, 'attack'); // 83 ms
  const home = { ...u.home };
  const fist = u.art.muzzle; // the knuckles on frame 5
  const marks = new FloorMarks(sc, MARK_DEPTH);
  // where the feet must be for the fist to land on the side of the target facing us
  const aim: XY = s.direct ? s.to : { x: s.to.x, y: s.to.y + 2 };
  const feet = contactFeet(u, fist.x, fist.y, aim, s.blocked ? 9 : s.direct ? 2 : 5);
  const dist = Math.hypot(feet.x - home.x, feet.y - home.y);
  const dashMs = clamp(170 + dist * 0.9, 210, 420);
  const set = (p: XY, lift = 0, kx = 1, ky = 1) => {
    if (!spr.active) return;
    placeFeet(u, p, lift);
    spr.setScale(kx, ky);
  };
  try {
    // 1. rise + STOMP (attack frame 1: lean back)
    holdFrame(u, 'attack', 1);
    await animate(sc, 150, (t) => set(home, 4 * E.outQ(t), 0.97, 1 + 0.05 * E.outQ(t)));
    await animate(sc, 70, (t) => set(home, 4 * (1 - E.inQ(t)), lerp(0.97, 1.08, t), lerp(1.05, 0.9, t)));
    stomp(sc, marks, home, 1);
    void s.ctx.focus(lerpXY(home, s.to, 0.55), { zoom: 1.06, ms: 300, pan: 0.32 });
    await animate(sc, 90, (t) => set(home, 0, lerp(1.08, 1, t), lerp(0.9, 1, t)));
    // 2. fist cocked, heavy charge forward (frames 2–4)
    holdFrame(u, 'attack', 2);
    await sleep(sc, F);
    holdFrame(u, 'attack', 3);
    playSfx('whoosh', { volume: 0.7, pitch: 0.6 });
    let steps = 0;
    const kick = new Sparks(sc, DEPTH.FX - 3);
    await animate(sc, dashMs, (t) => {
      const e = E.inQ(t);
      const p = lerpXY(home, feet, e);
      // heavy gait: two thudding strides
      const stride = Math.abs(Math.sin(t * Math.PI * 2));
      set(p, stride * 3, 1.04, 0.96);
      if (spr.active) spr.setAngle(sgn * 5 * E.outQ(t));
      if (R2()) kick.add({ x: p.x - sgn * RR(4, 12), y: p.y + RR(-2, 2), vx: -sgn * RR(10, 30), vy: RR(-25, -8), drag: 2, life: RR(260, 420), colors: [PAL.stone3, PAL.stone2, PAL.stone1], shape: 'puff', size: RR(1.5, 3), grow: 5, alpha: 0.6 });
      const k = Math.floor(t * 3);
      if (k > steps && t < 0.95) {
        steps = k;
        marks.blob(p.x - sgn * 4, p.y + 1, 3, 900, [PAL.gold4, PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1, PAL.stone1]);
        void shake(sc, 70, 1);
        playSfx('impactLight', { volume: 0.35, pitch: 0.55 });
      }
      if (t > 0.62 && u.frameInfo().frame < 4) holdFrame(u, 'attack', 4);
    });
    kick.release();
    // 3. CONTACT (frame 5: arm extended, fist white-hot)
    holdFrame(u, 'attack', 5);
    if (spr.active) spr.setAngle(0);
    set(feet, 0, 0.94, 1.06);
    if (s.target) spr.setDepth(Math.max(spr.depth, s.target.sprite.depth + 0.5));
    const hit = u.framePoint(fist.x, fist.y);
    const dir = norm(sub(s.to, home));
    s.impact(hit);
    if (!s.blocked) {
      lavaBurst(sc, hit, { dir, floor: s.direct ? { x: s.to.x, y: s.to.y + 20 } : s.toGround, power: s.power });
      void slash(sc, hit.x, hit.y, { color: PAL.fire3, angle: Math.atan2(dir.y, dir.x), size: 16, flip: sgn < 0, sound: false });
    } else {
      lavaBurst(sc, hit, { dir: { x: -dir.x, y: -dir.y }, floor: s.toGround, power: 1, blocked: true });
    }
    await sleep(sc, 40);
    if (s.blocked) {
      // 4b. rebound: knocked back off the guard, staggers, then trudges home
      holdFrame(u, 'hit', 0);
      const back = lerpXY(feet, home, 0.45);
      await animate(sc, 170, (t) => set(lerpXY(feet, back, E.outQ(t)), Math.sin(Math.PI * t) * 5, 1, 1));
      stomp(sc, marks, back, 0.6);
      void playFrom(u, 'hit', 1);
      await animate(sc, 260, (t) => set(lerpXY(back, home, E.inOutQ(t)), Math.sin(Math.PI * t) * 3, 1, 1));
    } else {
      // 4. hold, follow-through, hop home
      await animate(sc, 110, (t) => set(lerpXY(feet, { x: feet.x + dir.x * 2, y: feet.y + dir.y * 2 }, t), 0, lerp(0.94, 1, t), lerp(1.06, 1, t)));
      holdFrame(u, 'attack', 6);
      await sleep(sc, F);
      holdFrame(u, 'attack', 7);
      await sleep(sc, F * 0.8);
      void playFrom(u, 'attack', 8);
      await animate(sc, 300, (t) => set(lerpXY(feet, home, E.inOutQ(t)), Math.sin(Math.PI * t) * 7, 1, t > 0.85 ? 1.05 - (t - 0.85) : 1));
      stomp(sc, marks, home, 0.45);
    }
  } finally {
    marks.close();
    homeUnit(u);
    if (spr.active && u.frameInfo().anim !== 'attack' && u.frameInfo().anim !== 'hit') u.rest();
    else if (spr.active && !spr.anims.isPlaying) u.rest();
  }
});

// ================================================================ effect: burn 500

registerCardHook('magma_titan', 'effect', async (ctx) => {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const run = fx.resolutionRun(ctx);
  const { di, dmg } = effectDamage(ctx, run);
  const victim = dmg ? dmg.player : otherPlayer(ev.player);
  const lp = fx.lpPoint(ctx, victim);
  const u = liveUnit(ctx, ev.uid);
  seed(ev.uid * 17 + 1);
  let hit: Promise<void> = Promise.resolve();
  const deliver = () => {
    if (di >= 0) hit = ctx.play(di, { delivered: true });
  };
  if (!u) {
    const at = lastSpot(ctx, ev.uid) ?? fx.zoneCenter(ev.player, 'monster', 1);
    await burnFly(sc, worldToScreen(sc, { x: at.x, y: at.y - 20 }), lp, { kind: 'fireball', onImpact: deliver });
    await hit;
    await fx.playRun(ctx, fx.resolutionRun(ctx));
    return;
  }
  const core = () => u.framePoint(u.art.core.x, u.art.core.y - 1);
  void ctx.focus({ x: u.core().x, y: u.core().y - 6 }, { zoom: 1.07, ms: 280, pan: 0.4 });
  // the roar: hunch (f1), fists up + vents (f2–4), chest beats (f5–7)
  void u.play('roar');
  const heart = glow(sc, core().x, core().y, PAL.fire3, 0.3, 0.4, u.sprite.depth + 0.3);
  const embers = new Sparks(sc, u.sprite.depth + 0.4);
  const F = frameMs(u, 'roar');
  let beats = 0;
  await animate(sc, F * 7.2, (t, el) => {
    const c = core();
    const f = el / F;
    const k = clamp((f - 1) / 6, 0, 1);
    heart.setPosition(Math.round(c.x), Math.round(c.y)).setScale(0.3 + 0.9 * k + (Math.floor(el / 50) % 2) * 0.08).setAlpha(0.4 + 0.5 * k);
    // embers spiral into the core
    if (R2() && f > 1.5) {
      const a = RR(0, TAU);
      embers.add({ x: c.x + Math.cos(a) * RR(14, 26), y: c.y + Math.sin(a) * RR(10, 20), ox: c.x, oy: c.y, spin: 5, pull: RR(50, 90), life: 360, colors: [PAL.fire2, PAL.fire3, PAL.fire4, PAL.gold4], shape: 'px' });
    }
    if (f >= 4 && beats === 0) {
      beats = 1;
      void shake(sc, 160, 1.5);
      playSfx('fireBurst', { volume: 0.5, pitch: 0.7 });
      playSfx('roarBig', { volume: 0.55, pitch: 0.8 });
    }
    for (const b of [5, 6, 7]) {
      if (f >= b && beats < b - 3) {
        beats = b - 3;
        void shake(sc, 90, 1);
        playSfx('impactLight', { volume: 0.5, pitch: 0.5 + (b - 5) * 0.08 });
        void glowPulse(sc, c.x, c.y, PAL.fire4, { from: 0.4, to: 1.3, alpha: 0.7, ms: 160, depth: u.sprite.depth + 0.35 });
      }
    }
    void t;
  });
  embers.release();
  // the core blazes white — release
  const c = core();
  void whiteFlash(sc, u.sprite, 2, PAL.fire4);
  void glowPulse(sc, c.x, c.y, PAL.white, { from: 0.6, to: 2.2, alpha: 1, ms: 220, depth: u.sprite.depth + 0.4 });
  void screenFlash(sc, PAL.fire3, 0.18, 160);
  void stopTime(sc, 60);
  heart.destroy();
  void ctx.unfocus(240);
  await burnFly(sc, worldToScreen(sc, c), lp, { kind: 'fireball', onImpact: deliver });
  await hit;
  await fx.playRun(ctx, fx.resolutionRun(ctx));
});

let r2 = 0;
function R2(): boolean {
  return ++r2 % 2 === 0;
}

// ================================================================ death: cooling into rock

/** A copy of the frame with its lava cooled: progress p (0..1) from the top down. */
function cooled(pc: PixelCanvas, p: number, noise: (x: number, y: number) => number, out: PixelCanvas): PixelCanvas {
  out.clear();
  const b = pc.bounds() ?? { x: 0, y: 0, w: pc.w, h: pc.h };
  for (let y = b.y; y < b.y + b.h; y++)
    for (let x = b.x; x < b.x + b.w; x++) {
      const c = pc.get(x, y);
      if (c === null || !LAVA_SET.has(c)) continue;
      const key = ((y - b.y) / b.h) * 0.65 + noise(x, y) * 0.35;
      if (key < p - 0.3) out.set(x, y, c === PAL.fire1 ? PAL.stone0 : PAL.stone1);
      else if (key < p - 0.12) out.set(x, y, PAL.fire1);
      else if (key < p) out.set(x, y, PAL.fire2);
    }
  return out;
}

registerCardHook('magma_titan', 'destroyed', (ctx) =>
  flavoredDeath(ctx, async (d) => {
    const u = d.unit;
    const sc = ctx.scene;
    seed(u.uid * 11 + 2);
    if (d.hit) {
      void u.play('hit', { hold: true });
      await whiteFlash(sc, u.sprite, 2);
    }
    await sleep(sc, 40);
    holdFrame(u, 'hit', 1);
    const { pc } = currentPixels(u);
    const n = (x: number, y: number) => {
      const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return h - Math.floor(h);
    };
    const cool = new PixelCanvas(pc.w, pc.h);
    const ov = overlay(u, cool);
    const steam = new Sparks(sc, u.sprite.depth + 0.5);
    playSfx('burn', { volume: 0.7, pitch: 0.6 });
    const COOL = 460;
    const ox = u.sprite.x;
    await animate(sc, COOL, (t, el) => {
      ov.redraw(cooled(pc, t * 1.35, n, cool));
      if (u.sprite.active) u.sprite.x = ox + (Math.floor(el / 45) % 2 ? 0.5 : -0.5) * (t > 0.3 ? 1 : 0);
      if (R2()) {
        const p = fx.zoneCenter(u.player, 'monster', u.zone);
        const top = u.worldPoint('top');
        const y = lerp(top.y, p.y - 6, Math.min(1, t * 1.2) * RR(0.2, 1));
        steam.add({ x: p.x + RR(-16, 16), y, vx: RR(-8, 8), vy: RR(-40, -20), drag: 1, life: RR(420, 700), colors: [PAL.stone4, PAL.stone3, PAL.stone2], shape: 'puff', size: RR(1.5, 3), grow: 6, alpha: 0.5 });
      }
    });
    steam.release();
    if (u.sprite.active) u.sprite.x = ox;
    // fully cooled: the body cracks and crumbles into heavy rubble
    const rock = pc.clone();
    const full = cooled(pc, 2, n, new PixelCanvas(pc.w, pc.h));
    rock.blit(full, 0, 0);
    ov.destroy();
    d.burst();
    playSfx('groundCrack', { volume: 0.8, pitch: 1.2 });
    playSfx('earthQuake', { volume: 0.5, pitch: 1.4 });
    const dust = new Sparks(sc, u.sprite.depth + 0.6);
    for (let i = 0; i < 12; i++) {
      dust.add({ x: d.home.x + RR(-20, 20), y: d.home.y + RR(-4, 4), vx: RR(-30, 30), vy: RR(-22, -6), drag: 1.5, life: RR(600, 900), delay: RR(80, 260), colors: [PAL.stone3, PAL.stone2, PAL.stone1], shape: 'puff', size: RR(2.5, 4.5), grow: 6, alpha: 0.65 });
    }
    dust.release();
    await shatterPx(sc, u, {
      pc: rock,
      ramp: [PAL.stone0, PAL.stone1, PAL.fire2, PAL.fire3, PAL.fire4],
      push: d.push,
      glitchMs: 50,
      speed: 0.5,
      up: [0, 18],
      gravity: 620,
      floor: d.home.y + 2,
      bounce: 0.28,
      life: [760, 1050],
      shards: 16,
      shardColors: [PAL.stone3, PAL.stone2, PAL.stone1, PAL.stone0],
      motes: false,
      shakePx: 3,
      stopMs: 50,
      // the last heat flares through the splitting rock instead of a white hologram flash
      flashColor: PAL.fire4,
      flashMode: 'tint',
      ring: false,
    });
  }),
);

void ADD;
void Phaser;
export type { MonsterUnit };
