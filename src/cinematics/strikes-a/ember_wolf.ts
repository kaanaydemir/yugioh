// Kor Kurdu — "Kor Dişi" (GAME_DESIGN §7): flame-burst impact, the howl + flame spirit burn
// (−300) and the wolf's death.
//
// Strike (≈0.95 s): it crouches and snarls (f1), coils (f2) and its flames flare with blazing
// eyes (f3); on f4 it launches in a flaming arc — afterimages, a trail of fire left burning on
// the floor — jaws gape on f5 and SNAP shut on contact (f6): hit-stop, fangs, a fan of flame,
// embers. It lands (f7) and hops home. Blocked: its teeth skid off the guard and it is knocked
// back. Direct: it runs the whole field to the duelist.
// Effect: a howl (roar f3–6) with a flame ring on the floor; on the howl peak a little flame
// spirit tears off the mane and weaves into the opponent's LP panel: −300.
// Death: a yelp, then its flames gutter out from the tips down (embers fall, smoke rises, the
// eyes go dark) and the cold body breaks apart into ash-grey pixels.

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { DEPTH, type XY } from '../../view/layout';
import { afterimages, bite } from '../../vfx/combat';
import { burnFly } from '../../vfx/setpieces';
import { fx, registerCardHook, registerStrike } from '../api';
import type { StrikeArgs } from '../_core/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import {
  E,
  FloorMarks,
  clusterPoint,
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
  seed,
  shatterPx,
  sleep,
  sub,
  whiteFlash,
  worldToScreen,
} from './_kit';

const FIRE_TRAIL = [PAL.gold4, PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1] as const;
const FIRE_SET = new Set<number>([PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4, PAL.gold4]);
const MARK_DEPTH = DEPTH.CARD_ON_TILE + 2;

let r2 = 0;
function R2(): boolean {
  return ++r2 % 2 === 0;
}

/** Kor Dişi impact: a fan of flame along the bite, a fire ring, embers and smoke. */
export function flameBurst(scene: Phaser.Scene, at: XY, dir: XY, power: number, small = false): void {
  const d = norm(dir);
  const base = Math.atan2(d.y, d.x);
  const px = layer(scene, DEPTH.FX + 2);
  const sp = new Sparks(scene, DEPTH.FX + 3);
  const smoke = new Sparks(scene, DEPTH.FX + 1);
  const k = small ? 0.6 : 1;
  playSfx('fireBurst', { volume: 0.7 * k + 0.1 * power, pitch: 1.15 });
  for (let i = 0; i < 16 * k + power * 3; i++) {
    const a = base + RR(-1.0, 1.0);
    sp.add({ x: at.x, y: at.y, vx: Math.cos(a) * RR(80, 190), vy: Math.sin(a) * RR(60, 160) - 30, ay: 180, drag: 2.5, life: RR(220, 420), colors: [PAL.white, PAL.gold4, PAL.fire4, PAL.fire3, PAL.fire2], shape: i % 3 ? 'streak' : 'sq', size: i % 3 ? 1 : 2, len: 0.03 });
  }
  for (let i = 0; i < 10 * k; i++) {
    sp.add({ x: at.x + RR(-6, 6), y: at.y + RR(-6, 6), vx: RR(-20, 20), vy: RR(-70, -25), drag: 1, life: RR(500, 900), colors: [PAL.gold4, PAL.fire4, PAL.fire3, PAL.fire2], shape: 'px', flicker: true });
  }
  for (let i = 0; i < 5 * k; i++) smoke.add({ x: at.x + RR(-6, 6), y: at.y + RR(-4, 4), vx: RR(-15, 15), vy: RR(-30, -10), drag: 1.2, life: RR(500, 800), colors: [PAL.fire1, PAL.stone1, PAL.night2], shape: 'puff', size: RR(2.5, 4), grow: 6, alpha: 0.55 });
  sp.release();
  smoke.release();
  void glowPulse(scene, at.x, at.y, PAL.fire3, { from: 0.4, to: 1.8 * k + 0.4, alpha: 0.85, ms: 260, depth: DEPTH.FX + 1 });
  // flame tongues licking forward + a ring
  onFrame(
    scene,
    (_dt, el) => {
      const t = el / 280;
      px.clear();
      if (t >= 1) return false;
      for (let i = 0; i < 7; i++) {
        const a = base + (i - 3) * 0.32;
        const L = (10 + 16 * E.outQ(t) + (i % 2) * 5) * k;
        const w = Math.max(1, (4 - 3 * t) * k);
        const tip = { x: at.x + Math.cos(a) * L, y: at.y + Math.sin(a) * L - 4 * t };
        px.seg(at.x, at.y, tip.x, tip.y, w + 1, PAL.fire2, 1 - t);
        px.seg(at.x, at.y, lerp(at.x, tip.x, 0.7), lerp(at.y, tip.y, 0.7), w, i % 2 ? PAL.fire3 : PAL.fire4, 1 - t);
      }
      const r = 4 + 16 * k * E.outC(t);
      px.ellipseRing(at.x, at.y, r, r * 0.75, t < 0.3 ? 2 : 1, t < 0.2 ? PAL.white : PAL.fire4, 1 - t);
      if (t < 0.3) px.disc(at.x, at.y, 5 * k * (1 - t / 0.3) + 1, PAL.white, 1);
      return true;
    },
    () => px.g.destroy(),
  );
}

// ================================================================ strike

registerStrike('ember_wolf', async (s: StrikeArgs) => {
  const u = s.attacker;
  const sc = s.scene;
  const spr = u.sprite;
  seed(u.uid * 61 + (s.target?.uid ?? 2));
  const F = frameMs(u, 'attack'); // 83 ms
  const sgn = facing(u);
  const home = { ...u.home };
  const jaws = u.art.muzzle;
  const feet = contactFeet(u, jaws.x, jaws.y, s.to, s.blocked ? 9 : s.direct ? 0 : 3);
  const dist = Math.hypot(feet.x - home.x, feet.y - home.y);
  const dashMs = clamp(100 + dist * 0.55, 120, 260);
  const marks = new FloorMarks(sc, MARK_DEPTH);
  const set = (p: XY, lift = 0, kx = 1, ky = 1) => {
    if (!spr.active) return;
    placeFeet(u, p, lift);
    spr.setScale(kx, ky);
  };
  try {
    // 1. crouch + snarl (f1), coil (f2), flames flare + eyes blaze (f3)
    holdFrame(u, 'attack', 1);
    playSfx('roarSmall', { volume: 0.45, pitch: 1.5 });
    void s.ctx.focus(lerpXY(home, s.to, 0.5), { zoom: 1.06, ms: 260, pan: 0.32 });
    const back = { x: home.x - sgn * 3, y: home.y + 1 };
    await animate(sc, F * 1.5, (t) => set(lerpXY(home, back, E.outQ(t)), 0, 1 + 0.07 * E.outQ(t), 1 - 0.09 * E.outQ(t)));
    holdFrame(u, 'attack', 2);
    await sleep(sc, F);
    holdFrame(u, 'attack', 3);
    const mane = maneOf(u);
    void glowPulse(sc, mane.x, mane.y, PAL.fire3, { from: 0.4, to: 1.3, alpha: 0.8, ms: 200, depth: spr.depth + 0.3 });
    const eye = clusterPoint(u, [PAL.gold4, PAL.white, PAL.gold3], { x: u.art.muzzle.x - 8, y: u.art.muzzle.y - 5 }, { x0: u.art.core.x + 8, y1: u.art.core.y, r: 1, tag: 'eye' });
    eyeGlint(sc, eye, spr.depth + 0.5);
    await sleep(sc, F);
    // 2. launch (f4): a flaming arc toward the target, fire trail on the floor
    holdFrame(u, 'attack', 4);
    playSfx('whoosh', { volume: 0.8, pitch: 1.2 });
    // flame-tinted ghosts (sparse + dim: additive ghosts stacking up would bleach the wolf white)
    void afterimages(sc, spr, dashMs + 30, PAL.fire2, { every: 40, alpha: 0.38, life: 150 });
    void bite(sc, s.to.x - sgn * 1, s.to.y + 1, PAL.fire3, { snapAt: dashMs + 10, size: 12 });
    let lastMark = { ...back };
    await animate(sc, dashMs, (t) => {
      const e = E.inQ(t);
      const p = lerpXY(back, feet, e);
      set(p, Math.sin(Math.PI * t) * 7, 1.12, 0.9);
      if (t > 0.55 && u.frameInfo().frame < 5) holdFrame(u, 'attack', 5); // airborne, jaws wide open
      if (Math.hypot(p.x - lastMark.x, p.y - lastMark.y) > 5) {
        marks.flame(p.x - sgn * 2, p.y + 1, RR(3, 5), RR(380, 560), FIRE_TRAIL);
        marks.blob(p.x, p.y + 1, 2.2, 700, [PAL.fire3, PAL.fire2, PAL.fire1, PAL.stone1, PAL.night1]);
        lastMark = p;
      }
    });
    // 3. SNAP (f6): contact
    holdFrame(u, 'attack', 6);
    set(feet, 2, 0.94, 1.06);
    if (s.target) spr.setDepth(Math.max(spr.depth, s.target.sprite.depth + 0.5));
    const at = u.framePoint(jaws.x, jaws.y);
    const dir = norm(sub(s.to, home));
    s.impact(s.blocked ? at : s.to);
    if (!s.blocked) flameBurst(sc, s.to, dir, s.power);
    else flameBurst(sc, at, { x: -dir.x, y: -dir.y }, 1, true);
    await sleep(sc, 60);
    if (s.blocked) {
      // 4b. knocked back off the guard: a yelping tumble, then trot home
      holdFrame(u, 'hit', 0);
      const kb = lerpXY(feet, home, 0.5);
      await animate(sc, 180, (t) => {
        set(lerpXY(feet, kb, E.outQ(t)), Math.sin(Math.PI * t) * 9, 1, 1);
        if (spr.active) spr.setAngle(-sgn * 14 * Math.sin(Math.PI * t));
      });
      if (spr.active) spr.setAngle(0);
      void playFrom(u, 'hit', 1);
      await animate(sc, 240, (t) => set(lerpXY(kb, home, E.inOutQ(t)), Math.sin(Math.PI * t) * 4, 1, 1));
    } else {
      // 4. hold the bite, land (f7), hop home (f8–9)
      await animate(sc, 90, (t) => set(feet, 2 * (1 - t), lerp(0.94, 1, t), lerp(1.06, 1, t)));
      holdFrame(u, 'attack', 7);
      await sleep(sc, F);
      void playFrom(u, 'attack', 8);
      await animate(sc, 280, (t) => set(lerpXY(feet, home, E.inOutQ(t)), Math.sin(Math.PI * t) * 7, 1, t > 0.85 ? 1.05 - (t - 0.85) : 1));
    }
  } finally {
    marks.close();
    homeUnit(u);
    if (spr.active && !spr.anims.isPlaying) u.rest();
  }
});

/** The flame mane: the biggest flame cluster on the frame the wolf shows. */
function maneOf(u: MonsterUnit): XY {
  return clusterPoint(u, [PAL.fire3, PAL.fire4, PAL.gold4], { x: u.art.core.x + 2, y: u.art.core.y - 14 }, { y1: u.art.core.y, r: 4, tag: 'mane' });
}

/** A 4-point star twinkle on the eye. */
function eyeGlint(scene: Phaser.Scene, at: XY, depth: number): void {
  const px = layer(scene, depth, Phaser.BlendModes.ADD);
  void animate(scene, 180, (t) => {
    px.clear();
    const k = Math.sin(Math.PI * t);
    px.star(at.x + 0.5, at.y + 0.5, 2 + 5 * k, 1, PAL.gold4, k);
    px.dot(at.x, at.y, PAL.white, 1);
  }).then(() => px.g.destroy());
}

// ================================================================ effect: howl + flame spirit −300

registerCardHook('ember_wolf', 'effect', async (ctx) => {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const run = fx.resolutionRun(ctx);
  const { di, dmg } = effectDamage(ctx, run);
  const victim = dmg ? dmg.player : otherPlayer(ev.player);
  const lp = fx.lpPoint(ctx, victim);
  seed(ev.uid * 13 + 9);
  let hit: Promise<void> = Promise.resolve();
  const deliver = () => {
    if (di >= 0) hit = ctx.play(di, { delivered: true });
  };
  const u = liveUnit(ctx, ev.uid);
  if (!u) {
    const at = lastSpot(ctx, ev.uid) ?? fx.zoneCenter(ev.player, 'monster', 1);
    await burnFly(sc, worldToScreen(sc, { x: at.x, y: at.y - 16 }), lp, { kind: 'wisp', onImpact: deliver });
    await hit;
    await fx.playRun(ctx, fx.resolutionRun(ctx));
    return;
  }
  const F = frameMs(u, 'roar'); // 100 ms
  void ctx.focus({ x: u.core().x, y: u.core().y - 8 }, { zoom: 1.07, ms: 260, pan: 0.4 });
  void u.play('roar');
  await sleep(sc, F * 3);
  // the howl: a flame ring rolls out over the floor, the mane flares, embers spiral up
  playSfx('roarSmall', { volume: 0.9, pitch: 0.75 });
  playSfx('fireBurst', { volume: 0.4, pitch: 1.4 });
  const home = u.home;
  const ring = layer(sc, MARK_DEPTH + 1);
  void animate(sc, 420, (t) => {
    ring.clear();
    const r = 6 + 34 * E.outC(t);
    ring.ellipseRing(home.x, home.y, r, r * 0.45, t < 0.3 ? 2 : 1, t < 0.25 ? PAL.gold4 : PAL.fire3, 1 - t);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + t;
      const fx0 = home.x + Math.cos(a) * r;
      const fy0 = home.y + Math.sin(a) * r * 0.45;
      const h = 5 * (1 - t) * (i % 2 ? 1 : 0.6);
      if (h >= 1) ring.seg(fx0, fy0, fx0, fy0 - h, 1, PAL.fire4, 1 - t);
    }
  }).then(() => ring.g.destroy());
  const mane = () => maneOf(u);
  const embers = new Sparks(sc, u.sprite.depth + 0.4);
  const m0 = mane();
  for (let i = 0; i < 14; i++) embers.add({ x: m0.x + RR(-8, 8), y: m0.y + RR(-4, 6), vx: RR(-20, 20), vy: RR(-90, -40), drag: 1.2, life: RR(400, 800), colors: [PAL.gold4, PAL.fire4, PAL.fire3, PAL.fire2], shape: 'px', flicker: true });
  embers.release();
  void glowPulse(sc, m0.x, m0.y, PAL.fire3, { from: 0.5, to: 1.8, alpha: 0.85, ms: 300, depth: u.sprite.depth + 0.3 });
  await sleep(sc, F * 1.5);
  // the spirit tears off the mane at the howl's peak and weaves to the panel
  const from = worldToScreen(sc, mane());
  void ctx.unfocus(300);
  await burnFly(sc, from, lp, { kind: 'wisp', onImpact: deliver });
  await hit;
  await fx.playRun(ctx, fx.resolutionRun(ctx));
});

// ================================================================ death: the flames gutter out

registerCardHook('ember_wolf', 'destroyed', (ctx) =>
  flavoredDeath(ctx, async (d) => {
    const u = d.unit;
    const sc = ctx.scene;
    seed(u.uid * 37 + 6);
    if (d.hit) {
      void u.play('hit', { hold: true });
      await whiteFlash(sc, u.sprite, 2);
    }
    holdFrame(u, 'hit', 0);
    playSfx('roarSmall', { volume: 0.4, pitch: 1.9 }); // the yelp
    await sleep(sc, 90);
    holdFrame(u, 'hit', 1);
    const { pc } = currentPixels(u);
    const b = pc.bounds() ?? { x: 0, y: 0, w: pc.w, h: pc.h };
    const noise = (x: number, y: number) => {
      const h = Math.sin(x * 27.1 + y * 61.7) * 4183.9;
      return h - Math.floor(h);
    };
    const live = new PixelCanvas(pc.w, pc.h);
    const ov = overlay(u, live, { depth: u.sprite.depth + 0.05 });
    u.sprite.setVisible(false);
    const smoke = new Sparks(sc, u.sprite.depth + 0.5);
    const ash = new Sparks(sc, u.sprite.depth + 0.4);
    playSfx('burn', { volume: 0.6, pitch: 0.8 });
    const GUTTER = 460;
    await animate(sc, GUTTER, (t, _el, dt) => {
      live.clear();
      for (let y = b.y; y < b.y + b.h; y++)
        for (let x = b.x; x < b.x + b.w; x++) {
          const c = pc.get(x, y);
          if (c === null) continue;
          if (!FIRE_SET.has(c)) {
            // the fur cools and darkens a little
            live.set(x, y, t > 0.6 && (c === PAL.stone3 || c === PAL.stone2) ? PAL.stone1 : c);
            continue;
          }
          const key = (1 - (y - b.y) / b.h) * 0.6 + noise(x, y) * 0.4;
          const p = t * 1.25;
          if (key < p - 0.18) continue; // burnt out
          if (key < p) live.set(x, y, key < p - 0.08 ? PAL.stone1 : PAL.fire1);
          else live.set(x, y, c);
        }
      ov.redraw(live);
      if (dt > 0 && R2()) {
        const q = u.framePoint(b.x + RR(0, b.w), b.y + RR(0, b.h * 0.6));
        smoke.add({ x: q.x, y: q.y, vx: RR(-6, 6), vy: RR(-34, -16), drag: 0.8, life: RR(420, 700), colors: [PAL.stone2, PAL.stone1, PAL.night2], shape: 'puff', size: RR(1.5, 3), grow: 5, alpha: 0.55 });
        ash.add({ x: q.x, y: q.y, vx: RR(-10, 10), vy: RR(-10, 10), ay: 160, life: RR(300, 500), colors: [PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1], shape: 'px', flicker: true, floor: d.home.y + RR(-2, 3), bounce: 0.2 });
      }
    });
    smoke.release();
    ash.release();
    const cold = live.clone();
    ov.destroy();
    u.sprite.setVisible(true);
    d.burst();
    await shatterPx(sc, u, {
      pc: cold,
      ramp: [PAL.night1, PAL.stone1, PAL.stone2, PAL.fire2, PAL.fire3],
      push: d.push,
      glitchMs: 70,
      speed: 0.8,
      up: [20, 55],
      flashColor: PAL.fire4, // a last ember glow through the ash, not a hologram flash: the fire is out
      flashMode: 'tint',
      ring: false,
      shards: 12,
      shardColors: [PAL.stone3, PAL.stone2, PAL.stone1, PAL.night2],
    });
  }),
);
