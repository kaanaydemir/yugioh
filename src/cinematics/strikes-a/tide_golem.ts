// Gelgit Golemi — "Dalga Darbesi" (GAME_DESIGN §7): foam-crash impact, the counter-splash
// (−300 to the attacker when it is attacked in defense) and the golem's death.
//
// Strike (≈1.4 s): it crouches (f1), heaves both arms overhead while sea water spirals up into its
// fists and the core goes white-hot (f2–3), swings (f4) and SLAMS the floor on f5 (shake, splash
// ring); a wave swells there, rolls across the tiles and crashes over the target in foam —
// hit-stop, a foam burst, bubbles, a wet patch. Blocked: the wave breaks on the guard and fans
// out sideways. Direct: it rolls off the board into the duelist.
// Counter (effect): the waist ring spins up and flares, a water blob is hurled back at the
// attacker and bursts on it, and the spray streaks on into the attacker's LP panel: −300. A golem
// that died in the battle answers from its puddle with a geyser.
// Death: it reels, loses its form — slumping and spreading into a puddle while water drips —
// and bursts in a splash of pixels.

import Phaser from 'phaser';
import { PAL, RAMPS } from '../../art/palette';
import { DEPTH, type XY } from '../../view/layout';
import { projectile } from '../../vfx/combat';
import { fx, registerCardHook, registerStrike } from '../api';
import type { StrikeArgs } from '../_core/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { waterSplash } from './coral_serpent';
import {
  E,
  FloorMarks,
  frameBounds,
  RR,
  Sparks,
  TAU,
  animate,
  effectDamage,
  flavoredDeath,
  frameMs,
  glow,
  glowPulse,
  holdFrame,
  lastSpot,
  layer,
  lerp,
  liveUnit,
  norm,
  onFrame,
  otherPlayer,
  playSfx,
  seed,
  shatterPx,
  sleep,
  sub,
  whiteFlash,
  type EvOf,
} from './_kit';
import { shake } from '../../vfx/core';

const MARK_DEPTH = DEPTH.CARD_ON_TILE + 2;
const WET = [PAL.water4, PAL.water3, PAL.water2, PAL.water1] as const;

let r2 = 0;
function R2(): boolean {
  return ++r2 % 2 === 0;
}

/** Foam crash: white foam boils up over the target, bubbles, a foam ring and a wet patch. */
function foamCrash(scene: Phaser.Scene, at: XY, ground: XY, power: number): void {
  const marks = new FloorMarks(scene, MARK_DEPTH);
  const foam = new Sparks(scene, DEPTH.FX + 2);
  const px = layer(scene, MARK_DEPTH + 1);
  playSfx('waterSplash', { volume: 1, pitch: 0.85 });
  for (let i = 0; i < 18 + power * 4; i++) {
    const a = -Math.PI / 2 + RR(-1.3, 1.3);
    const v = RR(40, 110);
    foam.add({ x: at.x + RR(-10, 10), y: at.y + RR(-8, 8), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, ay: 260, drag: 1.5, life: RR(400, 700), colors: [PAL.white, PAL.white, PAL.water4, PAL.water3], shape: 'disc', size: RR(1, 2.4), grow: -1.5 });
  }
  for (let i = 0; i < 10; i++) {
    foam.add({ x: at.x + RR(-12, 12), y: at.y + RR(-6, 10), vx: RR(-8, 8), vy: RR(-40, -16), drag: 0.5, life: RR(500, 900), colors: [PAL.white, PAL.water4, PAL.water3], shape: 'ring', size: RR(1, 2.5), flicker: true });
  }
  foam.release();
  for (let i = 0; i < 5; i++) marks.blob(ground.x + RR(-12, 12), ground.y + RR(-3, 4), RR(4, 7), RR(900, 1300), WET);
  marks.close();
  void animate(scene, 420, (t) => {
    px.clear();
    const r = 8 + 26 * E.outC(t);
    px.ellipseRing(ground.x, ground.y, r, r * 0.45, t < 0.3 ? 2 : 1, t < 0.25 ? PAL.white : PAL.water4, 1 - t);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      if ((i + Math.floor(t * 8)) % 3 === 0) px.dot(ground.x + Math.cos(a) * (r - 2), ground.y + Math.sin(a) * (r - 2) * 0.45, PAL.white, 1 - t);
    }
  }).then(() => px.g.destroy());
}

/** Water rising into the raised fists while the core heats up. */
function gather(scene: Phaser.Scene, u: MonsterUnit, ms: number): void {
  const drops = new Sparks(scene, u.sprite.depth + 0.4);
  const core = glow(scene, 0, 0, PAL.cyan3, 0.3, 0, u.sprite.depth + 0.3);
  const home = u.home;
  onFrame(
    scene,
    (dt, el) => {
      const t = Math.min(1, el / ms);
      const c = u.framePoint(u.art.core.x, u.art.core.y);
      core.setPosition(Math.round(c.x), Math.round(c.y)).setAlpha(0.8 * E.inQ(t)).setScale(0.3 + 0.6 * t + (Math.floor(el / 50) % 2) * 0.06);
      if (dt > 0 && t < 1) {
        const b = frameBounds(u);
        const fist = u.framePoint(b.x + b.w * 0.45, b.y + 4);
        const a = RR(0, TAU);
        drops.add({ x: home.x + Math.cos(a) * RR(10, 22), y: home.y + Math.sin(a) * RR(4, 9), tx: fist.x, ty: fist.y, curl: RR(-14, 14), life: RR(200, 300), colors: [PAL.water2, PAL.water3, PAL.water4, PAL.white], shape: 'px', fadeAt: 1 });
      }
      if (t >= 1) {
        drops.release();
        void glowPulse(scene, c.x, c.y, PAL.white, { from: 0.4, to: 1.2, alpha: 0.9, ms: 160, depth: u.sprite.depth + 0.35 });
        core.destroy();
        return false;
      }
      return true;
    },
  );
}

// ================================================================ strike

registerStrike('tide_golem', async (s: StrikeArgs) => {
  const u = s.attacker;
  const sc = s.scene;
  seed(u.uid * 67 + (s.target?.uid ?? 4));
  const F = frameMs(u, 'attack'); // 83 ms
  void u.play('attack');
  void s.ctx.focus({ x: lerp(u.core().x, s.to.x, 0.4), y: lerp(u.core().y, s.to.y, 0.4) }, { zoom: 1.05, ms: 300, pan: 0.3 });
  gather(sc, u, F * 3);
  playSfx('waterSplash', { volume: 0.3, pitch: 1.4 });
  await sleep(sc, F * 4);
  playSfx('whoosh', { volume: 0.6, pitch: 0.7 });
  await sleep(sc, F);
  // frame 5: the fists slam the floor
  const fists = u.muzzle();
  const ground = { x: fists.x, y: Math.max(fists.y, u.home.y - 2) };
  void shake(sc, 160, 2);
  playSfx('impactHeavy', { volume: 0.5, pitch: 0.7 });
  waterSplash(sc, { x: ground.x, y: ground.y - 2 }, { dir: { x: 0, y: -1 }, floor: ground.y + 2, power: 1 });
  const dir = norm(sub(s.toGround, ground));
  // the crash point: the target's tile (or just short of the guard when blocked)
  const crash = s.blocked ? { x: s.toGround.x - dir.x * 10, y: s.toGround.y - dir.y * 10 } : s.toGround;
  await projectile(sc, ground, crash, 'wave', {
    chargeMs: 120,
    onImpact: () => {
      s.impact(s.blocked ? { x: crash.x, y: s.to.y } : s.to);
      if (s.blocked) waterSplash(sc, { x: crash.x, y: crash.y - 12 }, { dir, floor: crash.y + 4, power: 2, sheet: true });
      else foamCrash(sc, s.to, s.toGround, s.power);
    },
  });
  if (u.sprite.active && u.frameInfo().anim !== 'attack') u.rest();
});

// ================================================================ effect: counter-splash −300

/** The battle this trigger answers (the last battle event before it). */
function lastBattle(ctx: Parameters<Parameters<typeof registerCardHook<'effect'>>[2]>[0]): EvOf<'battle'> | null {
  for (let i = ctx.index - 1; i >= 0; i--) {
    const e = ctx.events[i];
    if (e.type === 'battle') return e;
  }
  return null;
}

registerCardHook('tide_golem', 'effect', async (ctx) => {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const run = fx.resolutionRun(ctx);
  const { di, dmg } = effectDamage(ctx, run);
  const victim = dmg ? dmg.player : otherPlayer(ev.player);
  const lp = fx.lpPoint(ctx, victim);
  seed(ev.uid * 7 + 11);
  const battle = lastBattle(ctx);
  const attacker = battle ? liveUnit(ctx, battle.attackerUid) : null;
  const atkSpot = battle ? (attacker ? attacker.core() : (() => {
    const z = lastSpot(ctx, battle.attackerUid) ?? fx.zoneCenter(victim, 'monster', battle.attackerZone);
    return { x: z.x, y: z.y - 18 };
  })()) : null;
  const u = liveUnit(ctx, ev.uid);
  let from: XY;
  if (u) {
    // the waist ring spins up and flares
    void ctx.focus({ x: u.core().x, y: u.core().y }, { zoom: 1.06, ms: 240, pan: 0.36 });
    const cx = u.art.core.x;
    const cy = u.art.core.y;
    from = u.framePoint(cx + 13, cy + 18);
    const ring = layer(sc, u.sprite.depth + 0.3);
    const c = u.framePoint(cx, cy + 16);
    const heart = glow(sc, u.core().x, u.core().y, PAL.cyan3, 0.3, 0, u.sprite.depth + 0.25);
    playSfx('waterSplash', { volume: 0.5, pitch: 1.3 });
    // the waist ring spins up into a whirling torrent; the core glows (anticipation)
    await animate(sc, 340, (t, el) => {
      ring.clear();
      const k = E.inQ(t);
      const rx = 19 + 6 * E.outQ(t);
      const n = 22;
      for (let i = 0; i < n; i++) {
        const a = el * (0.02 + 0.05 * k) + (i / n) * TAU;
        const front = Math.sin(a) > 0;
        const x = c.x + Math.cos(a) * rx;
        const y = c.y + Math.sin(a) * rx * 0.3;
        ring.seg(x, y, x - Math.sin(a) * 3, y + Math.cos(a) * 0.9, 1, i % 4 === 0 ? PAL.white : front ? PAL.water4 : PAL.water3, front ? 1 : 0.6);
        if (k > 0.4 && i % 3 === 0) ring.dot(x, y - 2 - 3 * k, PAL.water4, k);
      }
      heart.setAlpha(0.8 * k).setScale(0.3 + 0.5 * k + (Math.floor(el / 50) % 2) * 0.06);
    });
    ring.g.destroy();
    heart.destroy();
    void shake(sc, 100, 1);
    void glowPulse(sc, from.x, from.y, PAL.water4, { from: 0.4, to: 1.6, alpha: 1, ms: 200, depth: DEPTH.FX });
  } else {
    // answered from the puddle it left: a geyser
    const z = lastSpot(ctx, ev.uid) ?? fx.zoneCenter(ev.player, 'monster', 1);
    void ctx.focus({ x: z.x, y: z.y - 20 }, { zoom: 1.05, ms: 240, pan: 0.3 });
    from = { x: z.x, y: z.y - 30 };
    await geyser(sc, z, 30);
  }
  // the blob flies back at the attacker and bursts on it
  const hitAt = atkSpot ?? fx.duelistPoint(ctx, victim);
  await projectile(sc, from, hitAt, 'water', {
    onImpact: () => {
      if (attacker) {
        void attacker.play('hit');
        // drenched for an instant (never leave the tint behind, whatever overlapped it)
        void whiteFlash(sc, attacker.sprite, 2, PAL.water4).then(() => sleep(sc, 120)).then(() => {
          if (attacker.sprite.active && !attacker.retired) attacker.sprite.clearTint();
        });
      }
      waterSplash(sc, hitAt, { dir: norm(sub(hitAt, from)), floor: attacker ? attacker.home.y : hitAt.y + 18, power: 1 });
    },
  });
  // the spray streaks on into the attacker's LP panel
  void ctx.unfocus(200);
  await sleep(sc, 60);
  let hit: Promise<void> = Promise.resolve();
  await fx.energyBolt(sc, hitAt, lp, RAMPS.water, 300);
  if (di >= 0) hit = ctx.play(di, { delivered: true });
  playSfx('waterSplash', { volume: 0.6, pitch: 1.5 });
  await hit;
  await fx.playRun(ctx, fx.resolutionRun(ctx));
});

/** A water column bursting out of the floor (height in px); resolves at its peak. */
async function geyser(scene: Phaser.Scene, at: XY, height: number): Promise<void> {
  const px = layer(scene, DEPTH.UNIT + at.y + 0.5);
  const sp = new Sparks(scene, DEPTH.FX);
  playSfx('waterSplash', { volume: 0.8, pitch: 0.9 });
  let peak!: () => void;
  const p = new Promise<void>((r) => (peak = r));
  let peaked = false;
  void animate(scene, 520, (t, el, dt) => {
    px.clear();
    const up = t < 0.45 ? E.outBack(t / 0.45) : 1 - E.inQ((t - 0.45) / 0.55);
    const h = height * up;
    const w = 5 + Math.sin(el * 0.05) * 1;
    if (h > 1) {
      // a churning column: each row wobbles, flares at the base and the crown, a lit core streams up
      for (let y = 0; y < h; y++) {
        const q = y / h;
        const ww = w * (1 + 0.5 * (1 - q) * (1 - q)) + Math.sin(y * 0.7 - el * 0.04) * 1.1;
        const cx = at.x + Math.sin(y * 0.35 + el * 0.02) * 0.8;
        px.rect(cx - ww, at.y - y - 1, ww * 2, 1, PAL.water2, 0.95);
        px.rect(cx - ww + 1.5, at.y - y - 1, ww * 2 - 3, 1, PAL.water3, 1);
        if (((y + Math.floor(el / 30)) % 5) < 3) px.rect(cx - 1, at.y - y - 1, 2, 1, PAL.water4, 1);
        if (((y * 7 + Math.floor(el / 40)) % 11) === 0) px.dot(cx + (y % 2 ? ww - 1 : -ww), at.y - y - 1, PAL.white, 1);
      }
      px.ellipse(at.x, at.y - h, w + 3, 3, PAL.water4, 1);
      px.ellipse(at.x, at.y - h - 1, w + 1, 2, PAL.white, 1);
    }
    px.ellipse(at.x, at.y, 12, 5, PAL.water2, 0.6 * (1 - t));
    if (dt > 0 && h > 4) sp.add({ x: at.x + RR(-w, w), y: at.y - h, vx: RR(-40, 40), vy: RR(-60, -10), ay: 420, life: RR(300, 500), colors: [PAL.white, PAL.water4, PAL.water3], shape: 'px', floor: at.y + RR(-2, 3), bounce: 0.2 });
    if (!peaked && t >= 0.45) {
      peaked = true;
      peak();
    }
  }).then(() => {
    px.g.destroy();
    sp.release();
  });
  return p;
}

// ================================================================ death: melting into a puddle

registerCardHook('tide_golem', 'destroyed', (ctx) =>
  flavoredDeath(ctx, async (d) => {
    const u = d.unit;
    const sc = ctx.scene;
    seed(u.uid * 47 + 8);
    if (d.hit) {
      void u.play('hit', { hold: true });
      await whiteFlash(sc, u.sprite, 2);
    }
    holdFrame(u, 'hit', 0);
    const spr = u.sprite;
    const marks = new FloorMarks(sc, MARK_DEPTH);
    const drips = new Sparks(sc, spr.depth + 0.4);
    playSfx('waterSplash', { volume: 0.5, pitch: 0.6 });
    const home = d.home;
    let puddle = 0;
    const pool = layer(sc, MARK_DEPTH + 0.5);
    const stopPool = onFrame(sc, () => {
      pool.clear();
      if (puddle <= 0.01) return true;
      const rx = 24 * puddle;
      pool.ellipse(home.x, home.y, rx, rx * 0.42, PAL.water1, 0.85);
      pool.ellipse(home.x - 2, home.y - 1, rx * 0.65, rx * 0.25, PAL.water2, 0.9);
      pool.ellipseRing(home.x, home.y, rx, rx * 0.42, 1, PAL.water4, 0.9);
      return true;
    });
    // the water body loses its form: slump, wobble, spread
    await animate(sc, 420, (t, el, dt) => {
      if (!spr.active) return;
      const e = E.inQ(t);
      const wob = Math.sin(el * 0.06) * 0.04 * (1 - t);
      spr.setScale(1 + 0.22 * e + wob, 1 - 0.38 * e - wob);
      spr.setTint(t > 0.5 ? PAL.water4 : 0xffffff);
      puddle = E.outQ(t);
      if (dt > 0 && R2()) {
        const fb = frameBounds(u);
        const p = u.framePoint(fb.x + RR(0, fb.w), fb.y + RR(fb.h * 0.3, fb.h * 0.9));
        drips.add({ x: p.x, y: p.y, vx: RR(-10, 10), vy: RR(0, 20), ay: 500, life: RR(300, 500), colors: [PAL.water4, PAL.water3], shape: 'px', floor: home.y + RR(-2, 3), bounce: 0.1 });
      }
    });
    if (spr.active) spr.clearTint();
    drips.release();
    d.burst();
    waterSplash(sc, { x: home.x, y: home.y - 8 }, { dir: d.push ?? { x: 0, y: -1 }, floor: home.y, power: 2 });
    marks.blob(home.x, home.y, 10, 1200, WET);
    marks.close();
    void sleep(sc, 500).then(() => animate(sc, 500, (t) => (puddle = 1 - t))).then(() => {
      stopPool();
      pool.g.destroy();
    });
    await shatterPx(sc, u, {
      ramp: [PAL.water1, PAL.water2, PAL.water3, PAL.water4, PAL.white],
      push: d.push,
      glitchMs: 60,
      speed: 0.7,
      up: [10, 40],
      gravity: 560,
      floor: home.y + 1,
      bounce: 0.15,
      shards: 12,
      shardColors: [PAL.white, PAL.water4, PAL.water3, PAL.water2],
    });
  }),
);

export type { MonsterUnit };
