// Uçurum Büyücüsü — "Uçurum Küresi" (GAME_DESIGN §7), the tribute-summon effect (a shadow tendril
// swallows a spell/trap) and the magus's death.
//
// Strike (≈1.4 s): the staff swings back over the shoulder while three runes circle the growing
// orb (tracked frame by frame), a void sigil turns under the magus; on attack frame 5 the staff
// thrusts and the orb flies with a violet trail. At the target the world dims as the vortex sucks
// the light in — the target is squeezed toward the orb — then the void bursts (hit-stop, flash).
// Effect: the staff rises and points, a violet sight-line locks on the card; a shadow tendril
// snakes across the floor, tendrils erupt around the card and flip it face-up, it cracks and is
// swallowed by the void, and its remains arc into the graveyard.
// Death: a void pool opens under the magus, the orb on its staff sputters and pops, the dark
// hologram sinks and bursts into pixels that are sucked back down into the abyss.

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { GameEvent, ZoneRef } from '../../engine/types';
import { DEPTH, LOOK_V3, type XY, zoneXY } from '../../view/layout';
import { Raster } from '../../vfx/setpieces';
import { cardLeaves } from '../_v3/card';
import { strikeStartFrame } from '../_v3/clash';
import { atFrame, atMark, panAt, play as playV3, start as startV3, takeCharge } from '../_v3/sound';
import type { SfxHandle } from '../../audio/sfx';
import type { TileCard } from '../../view/TileCard';
import { lockOn, projectile } from '../../vfx/combat';
import { tendril } from '../../vfx/setpieces';
import { lightBeam, lightFlash, lightPool } from '../../view/light';
import { fx, registerCardHook, registerStrike } from '../api';
import { dimPulse } from '../battle/_kit';
import type { StrikeArgs } from '../_core/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import {
  ADD,
  ARENA_V2,
  E,
  RR,
  Sparks,
  TAU,
  TK,
  animate,
  clamp,
  currentPixels,
  facing,
  clusterPoint,
  followLight,
  qbez,
  flavoredDeath,
  frameMs,
  glow,
  glowPulse,
  holdFrame,
  layer,
  len,
  lerp,
  liveUnit,
  norm,
  onFrame,
  playFrom,
  playSfx,
  screenFlash,
  seed,
  shatterPx,
  sleep,
  stopTime,
  sub,
  travelMs,
  veil,
  whiteFlash,
  type EvOf,
} from './_kit';

/** The staff orb: the densest cluster of orb colours in the upper half of the current frame. */
const ORB_COLORS = [PAL.void3, PAL.void4, PAL.white] as const;
function orbOf(u: MonsterUnit): XY {
  return clusterPoint(u, ORB_COLORS, u.art.muzzle, { y1: Math.round(u.art.anchorY * 0.5), r: 3, tag: 'orb' });
}

const RUNES: readonly (readonly string[])[] = [
  ['.#.#.', '#####', '.#.#.', '.#.#.', '#...#'],
  ['##.##', '#...#', '.###.', '#...#', '##.##'],
  ['..#..', '.#.#.', '#.#.#', '.#.#.', '..#..'],
];

/** Runes circling the staff orb + motes spiralling in + a void sigil under the caster. */
function chargeRunes(scene: Phaser.Scene, u: MonsterUnit, ms: number): Promise<void> {
  const px = layer(scene, u.sprite.depth + 0.4);
  const floor = layer(scene, DEPTH.CARD_ON_TILE + 2, ADD);
  const motes = new Sparks(scene, u.sprite.depth + 0.45);
  const halo = glow(scene, 0, 0, PAL.void3, 0.3, 0, u.sprite.depth + 0.3);
  const home = u.home;
  // arena v2: the growing orb glows violet on the marble, the sigil breathes under the caster
  const orbLight = followLight(scene, () => orbOf(u), { color: PAL.void4, radius: 20, floorY: home.y, air: 0.9, intensity: 0.2, anim: 'breathe' });
  orbLight.setIntensity(1.3, ms * 0.8);
  const sigilLight = lightPool(scene, home.x, home.y, { color: PAL.void3, spill: PAL.void2, radius: 26 * TK, intensity: 0, anim: 'breathe', fadeIn: 0 });
  sigilLight.setIntensity(0.75, ms * 0.5);
  return new Promise((resolve) => {
    onFrame(
      scene,
      (dt, el) => {
        const t = clamp(el / ms, 0, 1);
        px.clear();
        floor.clear();
        if (t >= 1) return false;
        const o = orbOf(u);
        const k = E.outQ(Math.min(1, t * 1.6));
        const fade = t > 0.85 ? 1 - (t - 0.85) / 0.15 : 1;
        halo.setPosition(Math.round(o.x), Math.round(o.y)).setAlpha(0.7 * k * fade).setScale(0.35 + 0.35 * k + (Math.floor(el / 60) % 2) * 0.05);
        for (let i = 0; i < 3; i++) {
          const a = el * 0.011 + (i * TAU) / 3;
          const r = 13 - 3 * t;
          const x = Math.round(o.x + Math.cos(a) * r - 2);
          const y = Math.round(o.y + Math.sin(a) * r * 0.7 - 2);
          px.rect(x - 1, y - 1, 7, 7, PAL.void0, 0.35 * k * fade);
          px.stamp(RUNES[i], x, y, Math.floor(el / 70 + i) % 3 === 0 ? PAL.white : PAL.void4, PAL.void4, PAL.void4, k * fade);
        }
        // void sigil on the floor: two counter-rotating dotted rings
        const rx = 24 * k * TK;
        for (let i = 0; i < 20; i++) {
          const a = el * 0.003 + (i / 20) * TAU;
          floor.dot(home.x + Math.cos(a) * rx, home.y + Math.sin(a) * rx * 0.45, i % 5 === 0 ? PAL.void4 : PAL.void2, 0.9 * fade);
          const b = -el * 0.005 + (i / 20) * TAU;
          if (i % 2 === 0) floor.dot(home.x + Math.cos(b) * rx * 0.62, home.y + Math.sin(b) * rx * 0.28, PAL.void3, 0.8 * fade);
        }
        if (dt > 0 && t < 0.85) {
          const a = RR(0, TAU);
          const r = RR(14, 24);
          motes.add({ x: o.x + Math.cos(a) * r, y: o.y + Math.sin(a) * r, tx: o.x, ty: o.y, curl: RR(-10, 10), life: RR(160, 260), colors: [PAL.void2, PAL.void3, PAL.void4, PAL.white], shape: 'px', fadeAt: 1 });
        }
        return true;
      },
      () => {
        px.g.destroy();
        floor.g.destroy();
        halo.destroy();
        motes.release();
        void orbLight.fadeOut(120);
        void sigilLight.fadeOut(260);
        resolve();
      },
    );
  });
}

/** The vortex at the target: the sprite is squeezed toward the orb while the light is sucked in. */
function vortexPull(scene: Phaser.Scene, s: StrikeArgs, at: XY, ms: number): { release(): void } {
  const t0 = s.target && !s.blocked && s.target.sprite.visible ? s.target.sprite : null;
  const x0 = t0 ? t0.x : 0;
  const y0 = t0 ? t0.y : 0;
  const floor = layer(scene, DEPTH.CARD_ON_TILE + 2);
  const g = s.toGround;
  let done = false;
  const stop = onFrame(scene, (_dt, el) => {
    if (done) return false;
    const t = clamp(el / ms, 0, 1);
    const e = E.inQ(t);
    if (t0 && t0.active) {
      t0.setScale(1 - 0.14 * e, 1 - 0.06 * e);
      t0.setPosition(Math.round(lerp(x0, at.x, 0.06 * e)), Math.round(lerp(y0, y0 - 2, e)));
      t0.setTint(Math.floor(el / 50) % 2 ? PAL.void4 : 0xffffff);
    }
    floor.clear();
    const rr = (26 * (1 - e) + 4) * TK;
    for (let k = 0; k < 3; k++) {
      const a0 = el * 0.018 + (k * TAU) / 3;
      for (let q = 0; q < 10; q++) {
        const a = a0 + q * 0.18;
        const r = rr - q * 0.8;
        floor.dot(g.x + Math.cos(a) * r, g.y + Math.sin(a) * r * 0.45, q < 3 ? PAL.void4 : PAL.void2, 1);
      }
    }
    return true;
  });
  return {
    release() {
      done = true;
      stop();
      floor.g.destroy();
      if (t0 && t0.active) {
        t0.setScale(1).setPosition(x0, y0);
        t0.clearTint();
      }
    },
  };
}

// ================================================================ strike

registerStrike('abyss_magus', async (s: StrikeArgs) => {
  if (LOOK_V3) return strikeV3(s);
  const u = s.attacker;
  const sc = s.scene;
  seed(u.uid * 71 + (s.target?.uid ?? 5));
  const F = frameMs(u, 'attack'); // 100 ms
  const launchAt = u.impactMs; // frame 5: staff thrust, orb released
  const to: XY = s.blocked ? { x: s.to.x - norm(sub(s.to, u.core())).x * 8, y: s.to.y - norm(sub(s.to, u.core())).y * 8 } : s.to;
  void u.play('attack');
  void s.ctx.focus({ x: lerp(u.core().x, to.x, 0.35), y: lerp(u.core().y, to.y, 0.35) - 8 }, { zoom: 1.06, ms: 300, pan: 0.32 });
  playSfx('darkPulse', { volume: 0.5, pitch: 1.2 });
  void chargeRunes(sc, u, launchAt + 60);
  await sleep(sc, F * 4);
  playSfx('whoosh', { volume: 0.5, pitch: 0.8 }); // the staff swing (frame 4 smear)
  await sleep(sc, launchAt - F * 4);
  const muzzle = orbOf(u);
  // release ring at the staff head
  void glowPulse(sc, muzzle.x, muzzle.y, PAL.void3, { from: 0.3, to: 1.2, alpha: 0.9, ms: 200, depth: DEPTH.FX + 1 });
  // (v2's wide bridge: a long flight may take a little longer)
  const flight = travelMs(len(sub(to, muzzle)), 0, 2.2, 180, 380, 500);
  const IMPLODE = 230;
  // arena v2: the orb carries its violet light along the combat.darkOrb path (same curve and
  // easing), the floor pool sliding under it; the vortex then drinks the stadium's light
  if (ARENA_V2) void (async () => {
    await sleep(sc, 16);
    const mid = { x: (muzzle.x + to.x) / 2, y: (muzzle.y + to.y) / 2 - clamp(len(sub(to, muzzle)) * 0.18, 6, 22) };
    const g0 = u.home;
    const g1 = s.target ? s.target.home : s.toGround;
    const fl = lightPool(sc, muzzle.x, muzzle.y, { color: PAL.void4, spill: PAL.void3, radius: 22, floorY: g0.y, air: 0.9, intensity: 1.2, anim: 'breathe', fadeIn: 40 });
    await animate(sc, flight, (t) => {
      const e = 0.35 * t + 0.65 * t * t;
      const p = qbez(muzzle, mid, to, e);
      fl.setPosition(p.x, p.y, g0.y + (g1.y - g0.y) * e);
    });
    fl.setIntensity(1.8, IMPLODE * 0.8).setRadius(12, 6, IMPLODE);
    await sleep(sc, IMPLODE);
    void fl.fadeOut(120);
  })();
  // the world dims while the vortex drinks the light, then the void bursts
  let pull: { release(): void } | null = null;
  let dimmer: { remove(ms?: number): Promise<void> } | null = null;
  const arrive = sleep(sc, 16 + flight).then(() => {
    pull = vortexPull(sc, s, to, IMPLODE);
    dimmer = veil(sc, 0.35, IMPLODE * 0.8);
    void dimPulse(sc, 0.75, { in: IMPLODE * 0.8, hold: IMPLODE * 0.2, out: 360 });
    void s.ctx.focus({ x: to.x, y: to.y }, { zoom: 1.08, ms: IMPLODE, pan: 0.36 });
    playSfx('darkPulse', { volume: 0.7, pitch: 0.6 });
  });
  await projectile(sc, muzzle, to, 'darkOrb', {
    chargeMs: 16,
    ms: flight,
    onImpact: () => {
      (pull as { release(): void } | null)?.release();
      void (dimmer as { remove(ms?: number): Promise<void> } | null)?.remove(120);
      s.impact(to);
      void lightFlash(sc, to.x, to.y, PAL.void4, s.blocked ? 34 : 52, 420, { floorY: s.target ? s.target.home.y : s.toGround.y, air: 0.7, intensity: 1.1 });
      void screenFlash(sc, PAL.void3, s.blocked ? 0.12 : 0.28, 200);
      voidCracks(sc, to, s.blocked ? 3 : 6);
    },
  });
  await arrive;
  if (u.sprite.active && u.frameInfo().anim !== 'attack') u.rest();
});

/** Violet fissures that crackle out of the burst point (the void tearing the air). */
function voidCracks(scene: Phaser.Scene, at: XY, n: number): void {
  const px = layer(scene, DEPTH.FX + 3, ADD);
  const arms = Array.from({ length: n }, (_, i) => {
    const pts: XY[] = [{ ...at }];
    let a = (i / n) * TAU + RR(-0.3, 0.3);
    let p = { ...at };
    for (let k = 0; k < 6; k++) {
      a += RR(-0.6, 0.6);
      p = { x: p.x + Math.cos(a) * RR(4, 7), y: p.y + Math.sin(a) * RR(3, 6) };
      pts.push(p);
    }
    return pts;
  });
  void animate(scene, 300, (t) => {
    px.clear();
    const n2 = Math.max(1, Math.round(7 * E.outQ(Math.min(1, t * 2.5))));
    for (const pts of arms) {
      for (let k = 1; k < Math.min(n2, pts.length); k++) {
        px.line(pts[k - 1].x, pts[k - 1].y, pts[k].x, pts[k].y, t < 0.3 ? PAL.white : PAL.void4, 1 - t);
      }
    }
  }).then(() => px.g.destroy());
}

// ================================================================ effect: swallow a spell / trap

function zonePoint(ref: ZoneRef): XY {
  return zoneXY(ref.player, ref.zone === 'field' ? 'field' : ref.zone, ref.index);
}

/** Crack lines across a card lying on its tile (iso diamond ~ 26×14). */
function crackCard(scene: Phaser.Scene, at: XY): { destroy(): void; done: Promise<void> } {
  const px = layer(scene, DEPTH.SHADOW + 0.5);
  const lines: XY[][] = [];
  for (let i = 0; i < 5; i++) {
    let a = (i / 5) * TAU + RR(-0.4, 0.4);
    let p = { x: at.x + RR(-2, 2), y: at.y - 2 + RR(-1, 1) };
    const pts = [p];
    for (let k = 0; k < 5; k++) {
      a += RR(-0.7, 0.7);
      p = { x: p.x + Math.cos(a) * 3.2, y: p.y + Math.sin(a) * 1.7 };
      pts.push(p);
    }
    lines.push(pts);
  }
  let alive = true;
  const done = animate(scene, 220, (t) => {
    if (!alive) return;
    px.clear();
    const n = Math.max(1, Math.round(6 * E.outQ(t)));
    for (const pts of lines) for (let k = 1; k < Math.min(n, pts.length); k++) {
      px.line(pts[k - 1].x, pts[k - 1].y, pts[k].x, pts[k].y, PAL.void0, 1);
      px.dot(pts[k].x, pts[k].y - 1, k === n - 1 ? PAL.white : PAL.void4, 1);
    }
  });
  return {
    done,
    destroy() {
      alive = false;
      px.g.destroy();
    },
  };
}

registerCardHook('abyss_magus', 'effect', async (ctx) => {
  if (LOOK_V3) return effectV3(ctx);
  const ev = ctx.ev;
  const sc = ctx.scene;
  const run = fx.resolutionRun(ctx);
  const ti = run.find((i) => ctx.events[i].type === 'target') ?? -1;
  const tEv = ti >= 0 ? (ctx.events[ti] as EvOf<'target'>) : null;
  const ref = tEv?.targets[0];
  if (!ref) {
    await fx.playRun(ctx, run);
    return;
  }
  ctx.consumeAt(ti);
  seed(ev.uid * 19 + 3);
  const u = liveUnit(ctx, ev.uid);
  const cardAt = zonePoint(ref);
  const field = ctx.views.field;
  const tile: TileCard | null = field.tileAt(ref.player, ref.zone === 'field' ? 'field' : ref.zone, ref.index);
  // 1. the staff rises and points: a violet sight-line locks on the card
  void ctx.focus({ x: lerp(u ? u.core().x : cardAt.x, cardAt.x, 0.5), y: lerp(u ? u.core().y : cardAt.y, cardAt.y, 0.5) }, { zoom: 1.05, ms: 320, pan: 0.3 });
  let staffGlow: Phaser.GameObjects.Image | null = null;
  let stopGlow: (() => void) | null = null;
  let staffLight: ReturnType<typeof lightPool> | null = null;
  if (u) {
    // the roar's burst pose (staff raised, orb blazing) is held while the abyss obeys
    void u.play('roar', { hold: true });
    playSfx('darkPulse', { volume: 0.8 });
    await sleep(sc, frameMs(u, 'roar') * 3);
    holdFrame(u, 'roar', 3);
    const o = orbOf(u);
    void glowPulse(sc, o.x, o.y, PAL.void4, { from: 0.4, to: 1.6, alpha: 0.9, ms: 260, depth: DEPTH.FX + 1 });
    sightLine(sc, o, { x: cardAt.x, y: cardAt.y - 4 });
    const g = glow(sc, o.x, o.y, PAL.void3, 0.5, 0.6, u.sprite.depth + 0.3);
    staffGlow = g;
    void lightBeam(sc, o, { x: cardAt.x, y: cardAt.y - 4 }, PAL.void4, 520, { width: 7, intensity: 0.9, shimmer: 0.6 });
    staffLight = lightPool(sc, o.x, o.y, { color: PAL.void4, spill: PAL.void3, radius: 22, floorY: u.home.y, air: 0.9, intensity: 1.1, anim: 'breathe' });
    stopGlow = onFrame(sc, (_dt, el) => {
      if (!g.active) return false;
      g.setScale(0.45 + (Math.floor(el / 70) % 2) * 0.08).setAlpha(0.55 + 0.25 * Math.sin(el * 0.02));
      return true;
    });
  }
  const lock = lockOn(sc, cardAt.x, cardAt.y - 4, { color: PAL.void3, size: 26 });
  playSfx('lockOn', { volume: 0.6, pitch: 0.8 });
  const dIdx = run.find((i) => ctx.events[i].type === 'destroy' && !ctx.isConsumed(i)) ?? -1;
  const dEv = dIdx >= 0 ? (ctx.events[dIdx] as EvOf<'destroy'>) : null;
  // a set card is exposed by the lock-on while the abyss is already on its way
  const flip = (async () => {
    if (tile && tile.active && !tile.faceUp && dEv) {
      await sleep(sc, 90);
      tile.setCard(dEv.cardId);
      playSfx('cardFlip', { volume: 0.6 });
      await tile.flipUp(240);
    }
  })();
  await lock.done;
  // 2. the shadow tendril crosses the floor; tendrils erupt around the card and clench
  const from = u ? u.home : zoneXY(ev.player, 'monster', 1);
  // the card stays visible over the tendril's void pool (under the risers) until it is swallowed
  const pin = tile ? onFrame(sc, () => (tile.active ? void tile.setDepth(DEPTH.SHADOW) : false)) : null;
  // arena v2: the tendril's path glows faintly violet on the floor while it crosses
  const path = lightBeam(sc, from, cardAt, PAL.void3, 0, { air: false, floor: { from, to: cardAt }, floorWidth: 10, intensity: 0.8, shimmer: 0.5 });
  await Promise.all([tendril(sc, from, cardAt), flip]);
  void path.fadeOut(260);
  lock.destroy();
  // the clench: the magus lowers its staff
  stopGlow?.();
  void staffLight?.fadeOut(200);
  if (staffGlow) {
    const g = staffGlow;
    void animate(sc, 160, (t) => g.active && g.setAlpha(0.6 * (1 - t))).then(() => g.destroy());
  }
  if (u && !u.retired) void playFrom(u, 'roar', 6);
  // 3. the card cracks and is swallowed by the void, then its remains go to the graveyard
  if (dEv && dIdx >= 0) {
    ctx.consumeAt(dIdx);
    const gi = ctx.findType('toGraveyard', (e) => e.uid === dEv.uid);
    const gEv = gi >= 0 ? (ctx.events[gi] as EvOf<'toGraveyard'>) : null;
    if (gi >= 0) ctx.consumeAt(gi);
    await swallowCard(ctx as never, dEv, gEv, cardAt);
  }
  pin?.();
  await fx.playRun(ctx, fx.resolutionRun(ctx));
  void ctx.unfocus(300);
});

/** A thin violet sight-line from the staff to the card (grows, flickers, fades). */
function sightLine(scene: Phaser.Scene, a: XY, b: XY): void {
  const px = layer(scene, DEPTH.FX + 2, ADD);
  void animate(scene, 520, (t) => {
    px.clear();
    const g = E.outQ(Math.min(1, t * 3));
    const fade = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
    const e = { x: lerp(a.x, b.x, g), y: lerp(a.y, b.y, g) };
    const n = Math.max(2, Math.round(len(sub(e, a)) / 3));
    for (let i = 0; i <= n; i++) {
      if ((i + Math.floor(t * 20)) % 3 === 0) continue;
      const p = { x: lerp(a.x, e.x, i / n), y: lerp(a.y, e.y, i / n) };
      px.dot(p.x, p.y, i % 4 === 0 ? PAL.white : PAL.void4, fade);
    }
    px.star(e.x + 0.5, e.y + 0.5, 4, 1, PAL.void4, fade);
  }).then(() => px.g.destroy());
}

async function swallowCard(ctx: fx_Ctx, dEv: EvOf<'destroy'>, gEv: EvOf<'toGraveyard'> | null, at: XY): Promise<void> {
  const sc = ctx.scene;
  const field = ctx.views.field;
  const { tile } = field.release(dEv.uid);
  const crack = crackCard(sc, at);
  playSfx('shatter', { volume: 0.55, pitch: 1.6 });
  if (tile && tile.active) {
    const x0 = tile.x;
    await animate(sc, 220, (t, el) => {
      if (tile.active) tile.x = x0 + (Math.floor(el / 35) % 2 ? 1 : -1) * (1 - t);
    });
    if (tile.active) tile.x = x0;
  } else await crack.done;
  // the void opens under the card and drinks it
  const pool = layer(sc, DEPTH.SHADOW - 0.5);
  const motes = new Sparks(sc, DEPTH.FX + 1);
  playSfx('darkPulse', { volume: 0.9, pitch: 0.55 });
  const y0 = tile ? tile.y : at.y;
  // arena v2: the void's rim glows violet as it opens and drinks the card
  const rimLight = lightPool(sc, at.x, at.y, { color: PAL.void4, spill: PAL.void2, radius: 22 * TK, intensity: 0, anim: 'breathe', fadeIn: 0 });
  rimLight.setIntensity(1.2, 160);
  void sleep(sc, 270).then(() => rimLight.fadeOut(140));
  await animate(sc, 360, (t, el) => {
    const open = E.outBack(Math.min(1, t * 2.2));
    const close = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
    pool.clear();
    const rx = 18 * open * close * TK;
    pool.ellipse(at.x, at.y + 1, rx + 2, (rx + 2) * 0.45, PAL.void2, 0.5);
    pool.ellipse(at.x, at.y + 1, rx, rx * 0.45, PAL.void0, 1);
    pool.ellipse(at.x, at.y + 1.5, rx * 0.6, rx * 0.27, PAL.ink, 1);
    pool.ellipseRing(at.x, at.y + 1, rx, rx * 0.45, 1, PAL.void4, 1);
    if (tile && tile.active) {
      const e = E.inQ(Math.min(1, t / 0.75));
      tintTile(tile, t < 0.25 ? PAL.void4 : t < 0.5 ? PAL.void3 : PAL.void2);
      tile.y = y0 + 9 * e;
      tile.setScale(1 - 0.5 * e, 1 - 0.8 * e);
      tile.setAlpha(1 - e);
    }
    if (el > 40 && Math.floor(el / 30) % 2 === 0) {
      const a = RR(0, TAU);
      motes.add({ x: at.x + Math.cos(a) * 20, y: at.y + Math.sin(a) * 9, tx: at.x, ty: at.y, curl: 8, life: 200, colors: [PAL.void3, PAL.void4, PAL.white], shape: 'px', fadeAt: 1 });
    }
  });
  pool.g.destroy();
  crack.destroy();
  motes.release();
  if (tile && tile.active) tile.destroy();
  void glowPulse(sc, at.x, at.y - 2, PAL.void3, { from: 0.3, to: 1.4, alpha: 0.8, ms: 220, depth: DEPTH.FX });
  field.forget(dEv.uid);
  if (gEv) await fx.cardToGraveyard(ctx, { owner: gEv.owner, cardId: dEv.cardId, from: { x: at.x, y: at.y - 6 } });
}

type fx_Ctx = Parameters<typeof fx.cardToGraveyard>[0];

/** Tint every image inside a TileCard container (the void soaking into the card). */
function tintTile(tile: TileCard, color: number): void {
  for (const c of tile.list as Phaser.GameObjects.GameObject[]) {
    const t = c as unknown as { setTint?: (c: number) => void; list?: Phaser.GameObjects.GameObject[] };
    if (typeof t.setTint === 'function') t.setTint(color);
    if (t.list) for (const cc of t.list) (cc as unknown as { setTint?: (c: number) => void }).setTint?.(color);
  }
}

// ================================================================ death: swallowed by the abyss

registerCardHook('abyss_magus', 'destroyed', (ctx) =>
  flavoredDeath(ctx, async (d) => {
    const u = d.unit;
    const sc = ctx.scene;
    seed(u.uid * 23 + 7);
    if (d.hit) {
      void u.play('hit', { hold: true });
      await whiteFlash(sc, u.sprite, 2);
    }
    holdFrame(u, 'hit', 0);
    const home = d.home;
    const pool = layer(sc, DEPTH.CARD_ON_TILE + 3);
    const wisps = new Sparks(sc, u.sprite.depth + 0.5);
    let poolK = 0;
    let closing = 0;
    const stopPool = onFrame(sc, (dt, el) => {
      pool.clear();
      const rx = 26 * poolK * (1 - closing) * TK;
      if (rx < 0.5) return !(closing >= 1);
      pool.ellipse(home.x, home.y, rx + 4, (rx + 4) * 0.45, PAL.void2, 0.55);
      pool.ellipse(home.x, home.y, rx, rx * 0.45, PAL.void0, 1);
      pool.ellipse(home.x, home.y + 0.5, rx * 0.6, rx * 0.26, PAL.ink, 1);
      pool.ellipseRing(home.x, home.y, rx, rx * 0.45, 1, PAL.void3, 1);
      for (let i = 0; i < 3; i++) {
        const a = el * 0.008 + (i / 3) * TAU;
        for (let q = 0; q < 6; q++) pool.dot(home.x + Math.cos(a + q * 0.12) * rx, home.y + Math.sin(a + q * 0.12) * rx * 0.45, PAL.void4, 1);
      }
      if (dt > 0 && closing === 0 && Math.floor(el / 40) % 2 === 0) {
        wisps.add({ x: home.x + RR(-rx, rx), y: home.y + RR(-2, 2), vx: RR(-6, 6), vy: RR(-60, -30), drag: 1, life: RR(300, 520), colors: [PAL.void4, PAL.void3, PAL.void2, PAL.void1], shape: 'px', flicker: true });
      }
      return true;
    });
    playSfx('darkPulse', { volume: 0.8, pitch: 0.7 });
    // the pool opens; the orb sputters (3 flickers) and pops
    const orb = orbOf(u);
    const spark = glow(sc, orb.x, orb.y, PAL.void4, 0.4, 0.9, u.sprite.depth + 0.4);
    // arena v2: the abyss glows violet under it; the orb's light sputters and pops
    const abyssLight = lightPool(sc, home.x, home.y, { color: PAL.void3, spill: PAL.void2, radius: 28 * TK, intensity: 0, anim: 'breathe', fadeIn: 0 });
    abyssLight.setIntensity(1, 300);
    const orbLight = lightPool(sc, orb.x, orb.y, { color: PAL.void4, radius: 18, floorY: home.y, air: 0.8, intensity: 1, anim: 'flicker', fadeIn: 0 });
    void sleep(sc, 300).then(() => orbLight.fadeOut(90));
    void sleep(sc, 900).then(() => abyssLight.fadeOut(260));
    await animate(sc, 300, (t, el) => {
      poolK = E.outBack(Math.min(1, t * 1.6));
      spark.setAlpha(Math.floor(el / 55) % 2 ? 0.9 : 0.1).setScale(0.3 + 0.3 * t);
    });
    spark.destroy();
    void glowPulse(sc, orb.x, orb.y, PAL.white, { from: 0.3, to: 1.1, alpha: 1, ms: 160, depth: u.sprite.depth + 0.5 });
    playSfx('shatter', { volume: 0.4, pitch: 1.7 });
    // the hologram darkens and sinks into its own abyss
    const spr = u.sprite;
    const y0 = spr.y;
    await animate(sc, 240, (t) => {
      if (!spr.active) return;
      const e = E.inQ(t);
      spr.y = y0 + 5 * e;
      spr.setScale(1 + 0.06 * e, 1 - 0.1 * e);
      spr.setTint(t > 0.5 ? PAL.void2 : PAL.void4);
    });
    if (spr.active) {
      spr.clearTint();
      spr.setScale(1);
    }
    d.burst();
    void screenFlash(sc, PAL.void2, 0.25, 220);
    void sleep(sc, 650).then(() => (closing = 0.001)).then(() => animate(sc, 220, (t) => (closing = Math.max(0.001, t)))).then(() => {
      stopPool();
      pool.g.destroy();
      wisps.release();
    });
    await shatterPx(sc, u, { push: d.push ? { x: d.push.x * 0.3, y: d.push.y * 0.3 } : undefined, glitchMs: 90, speed: 0.75, up: [30, 70], flashColor: PAL.void4, attract: { x: home.x, y: home.y, after: 140, k: 7 }, shards: 6, motes: false, shardColors: [PAL.white, PAL.void4, PAL.void3, PAL.void2] });
    void facing;
  }),
);

// ================================================================ v3 look (?look=v3)
//
// The same three beats on the v3 art's own poses (docs/v3/A0_ENVANTER.md §6.2 item 8), with crisp
// pixel effects only (whole-pixel rasters in palette tones: no soft glow sprites, no fractional
// scale on any sprite, no screen washes; the light layer is the v3 stepped one):
//   strike  the attack continues from the declaration's charge pose; void motes spiral in to the
//           orb at the LIVE staff point while it rises over the helm; on the thrust frame the orb leaves
//           the staff tip and the staff keeps pointing (the thrust's follow-through frame is held)
//           until the orb lands; the orb's arrival IS the contact (the number pops there), then
//           the void implodes on the spot (behind the victim) and the magus recovers. When the attacker loses it
//           resolves at the contact and leaves the body to the battle kit's counter-hit.
//   effect  the special pose: it notices the card (a target mark steps in on the card's tile),
//           gathers, swings the staff over and levels it; on the release frame the tendril leaves
//           the staff tip (points().staff) and the aim is held until the tendril has gripped the
//           card; the card cracks on its tile and flies to its owner's graveyard (card
//           continuity, _v3/card cardLeaves; behind the magus where its path passes behind it);
//           a destroyed field spell's arena starts cooling back to the calm theme as the mark
//           locks on its card (the abyss drinks its heat) and finishes while the card flies.
//           No target: no pose, nothing plays.
//   death   the death kit (flavoredDeath → _v3/death deathV3) on the art's death pose.

type EffectCtx = Parameters<Parameters<typeof registerCardHook<'effect'>>[2]>[0];

/** Live staff point: the orb's centre on the frame the magus shows now (points().staff). */
function staffPoint(u: MonsterUnit): XY {
  const fi = u.frameInfo();
  const p = fi.anim && u.art.points ? u.art.points(fi.anim, fi.frame).staff : undefined;
  return p ? u.framePoint(p.x, p.y) : orbOf(u);
}

/** The staff point of attack frame `f` (the release frame), wherever the sprite is now. */
function releasePoint(u: MonsterUnit, f: number): XY {
  const p = u.art.points ? u.art.points('attack', f).staff : undefined;
  return p ? u.framePoint(p.x, p.y) : staffPoint(u);
}

/** The staff's direction on the frame shown (fist → orb), world space, unit length. */
function staffDir(u: MonsterUnit): XY {
  const fi = u.frameInfo();
  const pts = fi.anim && u.art.points ? u.art.points(fi.anim, fi.frame) : undefined;
  if (pts?.staff && pts.hand) {
    const a = u.framePoint(pts.hand.x, pts.hand.y);
    const b = u.framePoint(pts.staff.x, pts.staff.y);
    if (Math.hypot(b.x - a.x, b.y - a.y) > 2) return norm(sub(b, a));
  }
  return { x: facing(u), y: 0 };
}

const rnd2 = (p: XY): XY => ({ x: Math.round(p.x), y: Math.round(p.y) });

/** 2:1 iso step line of `n` px from (x, y) toward (dx, dy) = (±1, ±1). */
function isoSeg(g: Raster, x: number, y: number, dx: number, dy: number, n: number, c: number): void {
  for (let i = 0; i < n; i++) g.px(x + dx * i, y + dy * Math.floor(i / 2), c);
}

/**
 * A target mark on a card lying on its tile: four iso corner brackets (the card's own diamond)
 * step in over three frames, flash white on the lock, then hold with a 1-px breath.
 */
function cardMark(scene: Phaser.Scene, at: XY): { lock: Promise<void>; destroy(): void } {
  const cx = Math.round(at.x);
  const cy = Math.round(at.y) - 1;
  const r = Raster.around(scene, cx, cy, 90, 50, DEPTH.FX_TOP - 2);
  const STEPS = [34, 29, 25];
  let k = 0;
  let snapped = false;
  let snapEl = 0;
  let lockNow!: () => void;
  const lock = new Promise<void>((res) => (lockNow = res));
  const stop = onFrame(scene, (_dt, el) => {
    if (!r.alive) return false;
    const step = Math.min(STEPS.length - 1, Math.floor(el / 45));
    if (step !== k) k = step;
    if (!snapped && el >= 45 * STEPS.length) {
      snapped = true;
      snapEl = el;
      lockNow();
    }
    const breath = snapped && Math.floor((el - snapEl) / 140) % 2 === 1 ? 1 : 0;
    const hw = STEPS[k] - (snapped ? 0 : 0) + breath;
    const hh = Math.round(hw / 2);
    const hot = snapped && el - snapEl < 50;
    const main = hot ? PAL.white : PAL.void4;
    const arm = 7;
    r.draw((g) => {
      const corners: [number, number, [number, number][]][] = [
        [cx - hw, cy, [[1, -1], [1, 1]]],
        [cx + hw, cy, [[-1, -1], [-1, 1]]],
        [cx, cy - hh, [[-1, 1], [1, 1]]],
        [cx, cy + hh, [[-1, -1], [1, -1]]],
      ];
      // a dark under-line first (reads over the lit floor), then the bracket
      for (const [x, y, arms] of corners) for (const [dx, dy] of arms) isoSeg(g, x, y + 1, dx, dy, arm * 2, PAL.ink);
      for (const [x, y, arms] of corners) for (const [dx, dy] of arms) isoSeg(g, x, y, dx, dy, arm * 2, main);
      for (const [x, y] of corners) g.px(x, y, hot ? PAL.white : PAL.void3);
    });
    return true;
  });
  return {
    lock,
    destroy() {
      stop();
      r.destroy();
      lockNow();
    },
  };
}

/** Motes spiralling into the live staff point for `ms` (the abyss gathers in the orb). */
function gatherMotes(scene: Phaser.Scene, u: MonsterUnit, ms: number, depth: number): Promise<void> {
  const sp = new Sparks(scene, depth);
  let acc = 0;
  return new Promise((resolve) => {
    onFrame(
      scene,
      (dt, el) => {
        if (el >= ms || !u.sprite.active) return false;
        acc += dt;
        while (acc >= 28) {
          acc -= 28;
          const o = staffPoint(u);
          const a = RR(0, TAU);
          const d = RR(13, 22);
          sp.add({ x: Math.round(o.x + Math.cos(a) * d), y: Math.round(o.y + Math.sin(a) * d * 0.8), tx: o.x, ty: o.y, curl: RR(-7, 7), life: RR(150, 230), colors: [PAL.void2, PAL.void3, PAL.void4, PAL.white], shape: 'px', fadeAt: 1 });
        }
        return true;
      },
      () => {
        sp.release();
        resolve();
      },
    );
  });
}

// ---------------------------------------------------------------- the tendril (effect)

interface Tendril {
  /** The head travels from the staff tip to the card. */
  grow(ms: number): Promise<void>;
  /** The end coils round the card (an iso loop). */
  grip(ms: number): Promise<void>;
  /** The loop tightens (2 steps). */
  clench(): void;
  /** Pulled back into the staff. */
  retract(ms: number): Promise<void>;
  destroy(): void;
}

/**
 * A void tendril from the LIVE staff tip (re-read every frame: it leaves the orb of the frame the
 * magus shows) to a card on its tile: it leaves along the staff's own line (continuing the first
 * span the art draws on the release frames), arcs over and comes down onto the card. A 3 → 2 → 1 px
 * cord in flat void tones — the edge facing the key light (top) lit, a dark underside, a pulse of
 * light running along it toward the card, white-hot where it leaves the orb — with a dithered
 * shadow on the floor under it. Whole pixels only.
 */
function voidTendril(scene: Phaser.Scene, u: MonsterUnit, to: XY): Tendril {
  const src0 = staffPoint(u);
  const pad = 46;
  const x0 = Math.floor(Math.min(src0.x, to.x) - pad);
  const y0 = Math.floor(Math.min(src0.y, to.y) - pad);
  const W = Math.ceil(Math.abs(src0.x - to.x) + pad * 2);
  const H = Math.ceil(Math.abs(src0.y - to.y) + pad * 2);
  const air = new Raster(scene, x0, y0, W, H, DEPTH.FX + 1);
  const floor = new Raster(scene, x0, y0, W, H, DEPTH.CARD_ON_TILE + 3);
  const mask = new Uint8Array(W * H);
  const sAt = new Float32Array(W * H);
  const floorY0 = u.home.y;
  const st = { grow: 0, grip: 0, clench: 0, retract: 0, amp: 1.7, alive: true };
  const target = { x: Math.round(to.x), y: Math.round(to.y) - 2 };
  // the loop round the card (iso ellipse), entered from the side the tendril arrives on
  const loop = (k: number): XY => {
    const rx = 17 - 2 * st.clench;
    const ry = rx / 2;
    const a0 = Math.atan2(-1, (src0.x < to.x ? -1 : 1) * 2);
    const a = a0 + k * TAU * 1.05 * (src0.x < to.x ? 1 : -1);
    return { x: target.x + Math.cos(a) * rx, y: target.y + Math.sin(a) * ry };
  };
  // the geometry is frozen while it is pulled back (the staff swings home meanwhile)
  let frozen: { P0: XY; d0: XY } | null = null;
  const draw = (el: number) => {
    mask.fill(0);
    const P0 = frozen ? frozen.P0 : staffPoint(u);
    const d0 = frozen ? frozen.d0 : staffDir(u);
    const L = Math.hypot(target.x - P0.x, target.y - P0.y);
    // it leaves along the staff's own line, then swoops onto the card from a little above it; a
    // steep drop (a card far below the staff) bulges out along the staff's line instead of hanging
    const steep = Math.abs(target.y - P0.y) / Math.max(1, L);
    const reach = L * 0.38 + 22 * steep;
    const P1 = { x: P0.x + d0.x * reach, y: P0.y + d0.y * reach - L * 0.05 };
    const P2 = { x: target.x + (P0.x - target.x) * 0.3 * (1 - steep) + d0.x * 18 * steep, y: target.y + (P0.y - target.y) * 0.3 - clamp(L * 0.22, 10, 22) };
    const bez = (t: number): XY => {
      const v = 1 - t;
      return {
        x: v * v * v * P0.x + 3 * v * v * t * P1.x + 3 * v * t * t * P2.x + t * t * t * target.x,
        y: v * v * v * P0.y + 3 * v * v * t * P1.y + 3 * v * t * t * P2.y + t * t * t * target.y,
      };
    };
    // arc-length samples
    const N = Math.max(24, Math.ceil(L * 1.6));
    const pts: XY[] = [];
    const sl: number[] = [];
    let acc = 0;
    for (let i = 0; i <= N; i++) {
      const p = bez(i / N);
      if (i > 0) acc += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
      pts.push(p);
      sl.push(acc);
    }
    const total = acc || 1;
    const head = total * st.grow;
    const tail = total * st.retract;
    const fy = (k: number) => floorY0 + (to.y - floorY0) * k;
    const stamp = (x: number, y: number, r: number, s: number) => {
      const R = Math.ceil(r);
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++) {
          if (dx * dx + dy * dy > r * r + 0.3) continue;
          const X = Math.round(x) + dx - x0;
          const Y = Math.round(y) + dy - y0;
          if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const i = Y * W + X;
          if (!mask[i]) sAt[i] = s;
          mask[i] = 1;
        }
    };
    const shadowPts: XY[] = [];
    for (let i = 0; i <= N; i++) {
      const s = sl[i];
      if (s > head || s < tail) continue;
      const k = s / total;
      // a travelling whip wave, pinned at both ends
      const env = Math.sin(Math.PI * Math.min(1, k * 1.15));
      const wv = st.amp * env * Math.sin(s * 0.17 - el * 0.02);
      const a = i < N ? pts[i + 1] : pts[i];
      const b = i < N ? pts[i] : pts[i - 1];
      const tl = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const nx = -(a.y - b.y) / tl;
      const ny = (a.x - b.x) / tl;
      const x = pts[i].x + nx * wv;
      const y = pts[i].y + ny * wv;
      const r = k < 0.42 ? 1.45 : k < 0.8 ? 1 : 0.5;
      stamp(x, y, r, s);
      if (i % 2 === 0) shadowPts.push({ x, y: fy(k) + 1 });
    }
    // the loop round the card
    if (st.grip > 0) {
      const n = Math.ceil(70 * st.grip);
      for (let i = 0; i <= n; i++) {
        const p = loop((i / 70) * st.grip * (70 / Math.max(1, n)) * (n / 70));
        stamp(p.x, p.y, 0.5 + (i < n * 0.6 ? 0.5 : 0), total + i);
      }
    }
    // the head knot while it travels
    const growing = st.grow < 1 && st.grow > 0;
    let hp: XY | null = null;
    if (growing) {
      let j = 0;
      while (j < N && sl[j] < head) j++;
      hp = rnd2(pts[j]);
    }
    const pulse = (el * 0.16) % (total + 30);
    air.draw((g) => {
      for (let Y = 0; Y < H; Y++)
        for (let X = 0; X < W; X++) {
          const i = Y * W + X;
          if (!mask[i]) {
            // a 1-px dark underline under the cord (reads over the board)
            if (Y > 0 && mask[i - W] && (Y < 2 || mask[i - 2 * W])) g.px(X + x0, Y + y0, PAL.ink);
            continue;
          }
          const s = sAt[i];
          const top = Y === 0 || !mask[i - W];
          const bot = Y === H - 1 || !mask[i + W];
          let c: number = top ? PAL.void4 : bot ? PAL.void1 : PAL.void2;
          if (s < 3.5) c = top || !bot ? PAL.white : PAL.void4;
          else if (Math.abs(s - pulse) < 2.5 && !bot) c = top ? PAL.white : PAL.void3;
          g.px(X + x0, Y + y0, c);
        }
      if (hp) {
        // the head: a small void knot (a plus, white heart), dark under it
        for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) g.px(hp.x + dx, hp.y + dy, PAL.void4);
        g.px(hp.x, hp.y, PAL.white);
        g.px(hp.x, hp.y + 2, PAL.ink);
        g.px(hp.x - 1, hp.y + 1, PAL.ink);
        g.px(hp.x + 1, hp.y + 1, PAL.ink);
      }
    });
    // the floor shadow under the cord (checker-dithered ink, inset under the card)
    floor.draw((g) => {
      for (const p of shadowPts) {
        const X = Math.round(p.x);
        const Y = Math.round(p.y);
        if ((X + Y) % 2 === 0) g.px(X, Y, PAL.ink);
        if ((X + 1 + Y) % 2 === 0) g.px(X + 1, Y, PAL.ink);
      }
    });
  };
  const stop = onFrame(scene, (_dt, el) => {
    if (!st.alive) return false;
    if (!u.sprite.active) return true;
    draw(el);
    return true;
  });
  const T: Tendril = {
    grow: (ms) => animate(scene, ms, (t) => (st.grow = E.outQ(t))).then(() => void (st.grow = 1)),
    grip: (ms) =>
      animate(scene, ms, (t) => {
        st.grip = t;
        st.amp = 1.7 * (1 - t) + 0.6 * t;
      }).then(() => void (st.grip = 1)),
    clench() {
      st.clench = 1;
      void sleep(scene, 50).then(() => (st.clench = 2));
    },
    retract: (ms) => {
      frozen = { P0: staffPoint(u), d0: staffDir(u) };
      return animate(scene, ms, (t) => {
        st.grip = 0;
        st.retract = 0;
        st.grow = 1 - E.inQ(t);
      });
    },
    destroy() {
      if (!st.alive) return;
      st.alive = false;
      stop();
      air.destroy();
      floor.destroy();
    },
  };
  return T;
}

/**
 * Cracks spreading across a card lying on its tile (its iso diamond, half 22 × 11): five jagged
 * branches from the grip point, growing in three steps — a dark split with a violet lit lip (the
 * void showing through) and a white leading tip. Pure pixels at the tile's own depth.
 */
function crackOnTile(scene: Phaser.Scene, at: XY, depth: number): { destroy(): void; done: Promise<void> } {
  const cx = Math.round(at.x);
  const cy = Math.round(at.y) - 1;
  const r = Raster.around(scene, cx, cy, 56, 34, depth);
  const branches: XY[][] = [];
  for (let i = 0; i < 5; i++) {
    let a = (i / 5) * TAU + RR(-0.35, 0.35);
    let p = { x: cx + RR(-2, 2), y: cy + RR(-1, 1) };
    const pts = [rnd2(p)];
    for (let k = 0; k < 6; k++) {
      a += RR(-0.6, 0.6);
      const q = { x: p.x + Math.cos(a) * 3.4, y: p.y + Math.sin(a) * 1.8 };
      // stay on the card
      if (Math.abs(q.x - cx) / 21 + Math.abs(q.y - cy) / 10.5 > 0.92) break;
      p = q;
      pts.push(rnd2(p));
    }
    branches.push(pts);
  }
  let n = 0;
  const paint = (lead: boolean) =>
    r.draw((g) => {
      for (const pts of branches)
        for (let k = 1; k < Math.min(n + 1, pts.length); k++) {
          const a = pts[k - 1];
          const b = pts[k];
          g.line(a.x, a.y - 1, b.x, b.y - 1, PAL.void4);
          g.line(a.x, a.y, b.x, b.y, PAL.ink);
          if (lead && k === Math.min(n, pts.length - 1)) g.px(b.x, b.y - 1, PAL.white);
        }
    });
  const done = (async () => {
    for (let s = 1; s <= 3; s++) {
      n = s * 2;
      if (!r.alive) return;
      paint(true);
      await sleep(scene, 30);
    }
    if (r.alive) paint(false);
  })();
  return {
    done,
    destroy: () => r.destroy(),
  };
}

/** The effect (see the v3 header): special pose → tendril from the staff tip → crack → the card flies. */
async function effectV3(ctx: EffectCtx): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const run = fx.resolutionRun(ctx);
  const ti = run.find((i) => ctx.events[i].type === 'target') ?? -1;
  const tEv = ti >= 0 ? (ctx.events[ti] as EvOf<'target'>) : null;
  const ref = tEv?.targets[0];
  // nothing to destroy: the effect never opens (no pose is played for nothing)
  if (!ref) {
    await fx.playRun(ctx, run);
    return;
  }
  ctx.consumeAt(ti);
  seed(ev.uid * 19 + 3);
  const field = ctx.views.field;
  const spot = ref.zone === 'field' ? 'field' : ref.zone;
  const tile: TileCard | null = field.tileAt(ref.player, spot, ref.index);
  const cardAt = tile && tile.active ? { x: tile.home.x, y: tile.home.y } : zonePoint(ref);
  const dIdx = run.find((i) => ctx.events[i].type === 'destroy' && !ctx.isConsumed(i)) ?? -1;
  const dEv = dIdx >= 0 ? (ctx.events[dIdx] as EvOf<'destroy'>) : null;
  const gi = dEv ? ctx.findType('toGraveyard', (e) => e.uid === dEv.uid) : -1;
  const gEv = gi >= 0 ? (ctx.events[gi] as EvOf<'toGraveyard'>) : null;
  // a destroyed field spell: its "inactive" event (the arena cools back) runs while the card flies
  const fIdx = dEv && dEv.location === 'field' ? (run.find((i) => { const e = ctx.events[i]; return e.type === 'fieldSpell' && !e.active && e.uid === dEv.uid && !ctx.isConsumed(i); }) ?? -1) : -1;
  const u = liveUnit(ctx, ev.uid);
  const posed = !!u && u.has('special');
  const mid = u ? { x: lerp(u.core().x, cardAt.x, 0.5), y: lerp(u.core().y, cardAt.y, 0.5) } : cardAt;
  void ctx.focus(mid, { ms: 320, pan: 0.3 });

  // ---- 1. it notices the card: the mark steps in; it gathers (staff drawn back, motes into the orb)
  let aimHeld: Promise<void> = Promise.resolve();
  let relMs = 0;
  const AIM_F = 8;
  if (posed) {
    relMs = u.markMs('special', 'release', 6);
    aimHeld = u.playRange('special', 0, AIM_F);
  }
  // sound (v3): the staff gathers from the special's charge frame (its 'charge' mark — sound QA
  // S4: it started on frame 0, 5 frames early) to its release frame
  const effPan = u ? panAt(u.home.x) : 0;
  let effCharge: SfxHandle | null = null;
  let tendrilSounded = false;
  if (posed)
    atMark(u, 'special', 'charge', () => {
      if (!tendrilSounded) effCharge = startV3('magusCharge', { volume: 0.8, pan: effPan });
    }, { fallback: 1 });
  const tendrilSound = () => {
    if (tendrilSounded) return;
    tendrilSounded = true;
    (effCharge as SfxHandle | null)?.stop(30);
    playV3('magusOrbRelease', { volume: 0.55, pan: effPan });
    playV3('magusTendril', { volume: 0.9, pan: effPan });
  };
  if (posed) atFrame(u, 'special', u.markFrame('special', 'release', 6), tendrilSound, { late: false });
  const chargeMs = posed ? u.markMs('special', 'charge', 1) : 0;
  await sleep(sc, chargeMs);
  const mark = cardMark(sc, cardAt);
  playSfx('lockOn', { volume: 0.6, pitch: 0.8 });
  // a destroyed field spell: the abyss starts drinking the arena's heat the moment the mark locks
  // on its card (A2 fix r1: started at the crack, the 1.3 s cooling ran the effect to 2.2 s); its
  // last lava cools while the cracked card flies
  const fieldJob: Promise<unknown> | null = fIdx >= 0 ? mark.lock.then(() => ctx.play(fIdx)) : null;
  let orbLight: ReturnType<typeof lightPool> | null = null;
  if (posed) {
    void gatherMotes(sc, u, Math.max(0, relMs - chargeMs - 60), u.sprite.depth + 0.4);
    orbLight = followLight(sc, () => (u.sprite.active ? staffPoint(u) : null), { color: PAL.void4, radius: 16, floorY: u.home.y, air: 0.9, intensity: 0.3, anim: 'breathe', fadeIn: 60 });
    orbLight.setIntensity(1.1, Math.max(60, relMs - chargeMs));
  }
  // a set card is exposed while the abyss gathers (it is about to go to the graveyard face-up)
  const flip = (async () => {
    if (tile && tile.active && !tile.faceUp && dEv) {
      await sleep(sc, 60);
      if (!tile.active) return;
      tile.setCard(dEv.cardId);
      playSfx('cardFlip', { volume: 0.6 });
      await tile.flipUp(220);
    }
  })();
  await sleep(sc, Math.max(0, relMs - chargeMs));

  // ---- 2. release: the tendril leaves the staff tip; the aim holds until it has the card
  let ten: Tendril | null = null;
  if (posed && u.sprite.active) {
    tendrilSound(); // (normally already played by the release frame itself)
    const o = staffPoint(u);
    void lightFlash(sc, o.x, o.y, PAL.void4, 20, 220, { floorY: u.home.y, air: 0.9, intensity: 0.9 });
    ten = voidTendril(sc, u, cardAt);
    const dist = Math.hypot(cardAt.x - o.x, cardAt.y - o.y);
    await ten.grow(clamp(dist * 1.6, 170, 250));
  }
  if (!tendrilSounded) (effCharge as SfxHandle | null)?.stop(80);
  await flip;
  mark.destroy();
  // the aim is held while the tendril has the card: f7 ↔ f8 (both levelled), a slow strain
  await aimHeld;
  let straining = posed;
  if (posed) {
    const AIM_A = AIM_F - 1;
    onFrame(sc, (_dt, el) => {
      if (!straining || !u.sprite.active) return false;
      const f = Math.floor(el / 120) % 2 ? AIM_A : AIM_F;
      if (u.frameInfo().frame !== f || u.frameInfo().anim !== 'special') u.pose('special', f);
      return true;
    });
  }
  // ---- 3. the grip: the tendril coils round the card and clenches; the card cracks on its tile
  if (ten) {
    playSfx('darkPulse', { volume: 0.9, pitch: 0.6 });
    await ten.grip(90);
    ten.clench();
  }
  orbLight?.fadeOut(200);
  const jobs: Promise<unknown>[] = [];
  if (fieldJob) jobs.push(fieldJob);
  const tileDepth = tile && tile.active ? tile.depth : DEPTH.CARD_ON_TILE;
  // (no destroy in the run: nothing cracks, the tendril simply lets go)
  const crack = dEv ? crackOnTile(sc, cardAt, tileDepth + 0.5) : null;
  if (crack) playSfx('shatter', { volume: 0.55, pitch: 1.5 });
  const grip = lightPool(sc, cardAt.x, cardAt.y, { color: PAL.void4, spill: PAL.void2, radius: 22, intensity: 1.1, anim: 'flicker', fadeIn: 0 });
  if (crack) void stopTime(sc, 50);
  if (crack && tile && tile.active) {
    const hx = tile.x;
    void (async () => {
      for (const d of [1, -1, 1, 0]) {
        if (!tile.active) return;
        tile.x = hx + d;
        await sleep(sc, 30);
      }
    })();
  }
  // a few void chips spray off the card
  const chips = new Sparks(sc, DEPTH.FX + 2);
  for (let i = 0; i < (crack ? 9 : 0); i++) {
    const a = Math.PI + (i / 8) * Math.PI;
    const v = RR(30, 70);
    chips.add({ x: Math.round(cardAt.x + RR(-10, 10)), y: Math.round(cardAt.y - 2), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, ay: 220, life: RR(200, 340), colors: [PAL.white, PAL.void4, PAL.void3, PAL.void2], shape: 'px', fadeAt: 1 });
  }
  chips.release();
  if (crack) await crack.done;
  await sleep(sc, 20);
  // ---- 4. let go: the tendril is pulled back into the staff, then the magus recovers; the
  //         cracked card is born into its flight to the graveyard
  if (ten) {
    const t = ten;
    void t.retract(120).then(() => t.destroy());
  }
  if (posed) {
    void sleep(sc, ten ? 100 : 0).then(() => {
      straining = false;
      if (u.sprite.active && !u.retired) void u.playRange('special', AIM_F + 1);
    });
  }
  void grip.fadeOut(220);
  if (dEv && dIdx >= 0) {
    ctx.consumeAt(dIdx);
    if (gi >= 0) ctx.consumeAt(gi);
    const { tile: t } = field.release(dEv.uid);
    const owner = gEv ? gEv.owner : ctx.owner(dEv.uid);
    // the card flies BEHIND the magus where its path passes behind it (A2 fix r1: a pile behind
    // the caster had the card cross its head and land over its horns)
    const body = posed ? u : null;
    const depthAt = body
      ? (floor: XY): number => (body.sprite.active && floor.y < body.home.y - 2 && Math.abs(floor.x - body.home.x) < 44 ? body.sprite.depth - 0.05 : DEPTH.FX + 5)
      : undefined;
    if (gEv) jobs.push(cardLeaves(ctx as never, { owner, cardId: dEv.cardId, from: cardAt, tile: t, depthAt }).catch((e) => console.error('[magus-v3] card', e)));
    else if (t && t.active) jobs.push(t.dissolve(300).then(() => t.active && t.destroy()));
    field.forget(dEv.uid);
  }
  crack?.destroy();
  await Promise.all(jobs);
  await fx.playRun(ctx, fx.resolutionRun(ctx));
  void ctx.unfocus(300);
}

// ---------------------------------------------------------------- the strike

/**
 * The charge (A2 fix r1: no glyphs — at 1× 5×5 runes beside the eyes read as HUD letters): six
 * void motes on a closing spiral round the LIVE staff point, converging on the orb in four
 * whole-pixel steps (radius 19 → 9), each a lit head and a two-pixel tail in darker violets
 * (void3 → void2 → void1; void4 only on the last step, as they reach the orb's cage), a few
 * motes drawn in from further out, and the void sigil under the caster.
 */
function chargeRunesV3(scene: Phaser.Scene, u: MonsterUnit, ms: number): void {
  const home = u.home;
  const air = Raster.around(scene, home.x, home.y - 50, 120, 120, u.sprite.depth + 0.4);
  const floor = Raster.around(scene, home.x, home.y, 80, 44, DEPTH.CARD_ON_TILE + 2);
  const sp = new Sparks(scene, u.sprite.depth + 0.45);
  const RR4 = [19, 15, 12, 9];
  const N = 5;
  let acc = 0;
  onFrame(
    scene,
    (dt, el) => {
      if (el >= ms || !u.sprite.active) return false;
      const t = el / ms;
      const o = rnd2(staffPoint(u));
      const step = Math.min(3, Math.floor(t * 4));
      const rr = RR4[step];
      air.draw((g) => {
        for (let i = 0; i < N; i++) {
          // staggered births: the spiral fills in over the first third of the charge
          if (t < (i / N) * 0.35) continue;
          const a = el * 0.009 + (i * TAU) / N;
          const at = (k: number): XY => ({ x: o.x + Math.round(Math.cos(a - k * 0.16) * (rr + k)), y: o.y + Math.round(Math.sin(a - k * 0.16) * (rr + k) * 0.75) });
          // a 3-px comet: the tail curls out behind it (it spirals in), lit head
          const [h, t1, t2] = [at(0), at(1), at(2)];
          g.px(t2.x, t2.y, PAL.void1);
          g.px(t1.x, t1.y, PAL.void2);
          g.px(h.x, h.y, step === 3 ? PAL.void4 : PAL.void3);
        }
      });
      // the sigil: two counter-rotating dotted iso rings, stepped open
      floor.draw((g) => {
        const rx = [10, 16, 21][Math.min(2, Math.floor(t * 6))];
        for (let i = 0; i < 20; i++) {
          const a = el * 0.003 + (i / 20) * TAU;
          g.px(Math.round(home.x + Math.cos(a) * rx), Math.round(home.y + Math.sin(a) * rx * 0.5), i % 5 === 0 ? PAL.void4 : PAL.void2);
          const b = -el * 0.005 + (i / 20) * TAU;
          if (i % 2 === 0) g.px(Math.round(home.x + Math.cos(b) * rx * 0.62), Math.round(home.y + Math.sin(b) * rx * 0.31), PAL.void3);
        }
      });
      acc += dt;
      while (acc >= 45 && t < 0.85) {
        acc -= 45;
        const a = RR(0, TAU);
        const d = RR(16, 24);
        sp.add({ x: Math.round(o.x + Math.cos(a) * d), y: Math.round(o.y + Math.sin(a) * d * 0.75), tx: o.x, ty: o.y, curl: RR(-8, 8), life: RR(170, 240), colors: [PAL.void1, PAL.void2, PAL.void3], shape: 'px', fadeAt: 1 });
      }
      return true;
    },
    () => {
      air.destroy();
      floor.destroy();
      sp.release();
    },
  );
}

/** The orb in flight: a 7-px void sphere (ink rim, lit top-left, dark core) with a stepped trail. */
function drawOrb(g: Raster, x: number, y: number, el: number): void {
  const X = Math.round(x);
  const Y = Math.round(y);
  for (let dy = -4; dy <= 4; dy++)
    for (let dx = -4; dx <= 4; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 > 13) continue;
      let c: number;
      if (d2 > 9) c = PAL.ink;
      else if (dx + dy <= -3) c = PAL.void4;
      else if (dx + dy <= 0) c = PAL.void3;
      else if (d2 <= 2) c = PAL.void0;
      else c = PAL.void2;
      g.px(X + dx, Y + dy, c);
    }
  g.px(X - 1, Y - 2, Math.floor(el / 60) % 2 ? PAL.white : PAL.void4);
}

/**
 * The void implodes where the orb landed: rings drawn in to a pinch, violet fissures, then a few
 * chips out. Drawn at `depth` — BEHIND the victim when there is one (A2 fix r1: the rings and the
 * white pinch in front hid the wolf for ~100 ms): its rim shows round the silhouette while the
 * body itself stays readable (the battle kit's contact flash is the only light on it).
 */
function implodeV3(scene: Phaser.Scene, at: XY, small: boolean, depth: number): void {
  const r = Raster.around(scene, at.x, at.y, 80, 64, depth);
  const RX = small ? [16, 10, 5, 2] : [24, 16, 9, 3];
  const cracks: XY[][] = [];
  const n = small ? 4 : 6;
  for (let i = 0; i < n; i++) {
    let a = (i / n) * TAU + RR(-0.3, 0.3);
    let p = { ...at };
    const pts = [rnd2(p)];
    for (let k = 0; k < 5; k++) {
      a += RR(-0.6, 0.6);
      p = { x: p.x + Math.cos(a) * RR(4, 6), y: p.y + Math.sin(a) * RR(3, 5) };
      pts.push(rnd2(p));
    }
    cracks.push(pts);
  }
  void (async () => {
    for (let s = 0; s < RX.length + 3; s++) {
      if (!r.alive) return;
      r.draw((g) => {
        if (s < RX.length) {
          const rx = RX[s];
          g.ring(at.x, at.y, rx, rx * 0.8, s === RX.length - 1 ? PAL.white : PAL.void4);
          if (rx > 8) g.ring(at.x, at.y, rx - 4, (rx - 4) * 0.8, PAL.void2);
        }
        // the torn air: violet fissures out of the burst point, then gone
        const m = s < 2 ? s + 2 : Math.max(0, 6 - s);
        for (const pts of cracks)
          for (let k = 1; k < Math.min(m + 1, pts.length); k++) g.line(pts[k - 1].x, pts[k - 1].y, pts[k].x, pts[k].y, s < 2 ? PAL.void4 : PAL.void3);
      });
      await sleep(scene, 40);
    }
    r.destroy();
  })();
  const sp = new Sparks(scene, DEPTH.FX + 2);
  for (let i = 0; i < (small ? 8 : 12); i++) {
    const a = (i / (small ? 8 : 12)) * TAU;
    const v = RR(70, 140);
    sp.add({ x: Math.round(at.x), y: Math.round(at.y), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7, drag: 4, life: RR(200, 320), delay: 120, colors: [PAL.void4, PAL.void3, PAL.void2], shape: 'px', fadeAt: 1 });
  }
  sp.release();
}

/** Below this release → contact distance (px) the orb's flight is a snap (see strikeV3). */
const SNAP_DIST = 30;
/** The flying orb's radius (drawOrb: ink rim at r ≈ 3.6). */
const ORB_R = 4;

/**
 * Where the orb meets the struck body: its surface toward the release point — the last opaque
 * pixel of the frame it shows now on the line from its core toward `from` (on the wyrm that is its
 * raised claw, in front of the core) — backed off by the orb's radius so the orb splashes against
 * it instead of sinking into it. null when it cannot be read (gone / hidden / no pixel).
 */
function surfacePoint(t: MonsterUnit | null, core: XY, from: XY): XY | null {
  if (!t || t.retired || !t.sprite.active || !t.sprite.visible) return null;
  const spr = t.sprite;
  const pc = currentPixels(t).pc;
  const m = spr.getWorldTransformMatrix();
  const w = spr.frame.realWidth;
  const d = norm(sub(from, core));
  const reach = len(sub(from, core));
  let last = -1;
  let gap = 0;
  for (let i = 0; i < reach; i++) {
    const q = m.applyInverse(core.x + d.x * i, core.y + d.y * i);
    const lx = q.x + spr.displayOriginX;
    const fx = Math.floor(spr.flipX ? w - lx : lx);
    const fy = Math.floor(q.y + spr.displayOriginY);
    if (pc.isOpaque(fx, fy)) {
      last = i;
      gap = 0;
    } else if (last >= 0 && ++gap > 2) break;
  }
  if (last < 0) return null;
  // never behind the release point: at least a few px of flight stay visible
  const k = Math.max(0, Math.min(last + ORB_R, reach - 6));
  return rnd2({ x: core.x + d.x * k, y: core.y + d.y * k });
}

/** The strike (see the v3 header). */
async function strikeV3(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  seed(u.uid * 71 + (s.target?.uid ?? 5));
  const res = (s.ctx.ev as EvOf<'battle'>).result;
  const loses = res === 'attackerDestroyed' || res === 'bothDestroyed';
  const f0 = strikeStartFrame(u);
  const REL = u.impactFrame; // the thrust: the orb leaves the staff tip
  const FOLLOW = Math.min(u.frameCount('attack') - 1, REL + 1); // staff still levelled, orb spent
  const toRel = u.rangeMs('attack', f0, REL);
  let to: XY = s.blocked ? { x: s.to.x - norm(sub(s.to, u.core())).x * 8, y: s.to.y - norm(sub(s.to, u.core())).y * 8 } : s.to;
  // the staff keeps pointing at the target until the orb arrives: play to the follow-through frame and hold it
  void u.playRange('attack', f0, FOLLOW);
  void s.ctx.focus({ x: lerp(u.core().x, to.x, 0.35), y: lerp(u.core().y, to.y, 0.35) - 8 }, { ms: 300, pan: 0.32 });
  // sound (v3, _v3/sound.ts): the staff's rising dark pulse gathers until the release frame; the
  // swing's smear frame whooshes; the release frame pops the orb off the staff
  const pan = panAt(u.home.x);
  // (the declaration's charge pose started it already: the strike takes that voice over — S3)
  const chargeSnd = takeCharge(u, 'magusCharge', { volume: 0.85, pan });
  let relSounded = false;
  const relSound = () => {
    if (relSounded) return;
    relSounded = true;
    chargeSnd.stop(30);
    playV3('magusOrbRelease', { volume: 0.85, pan });
  };
  // (only when the smear frame is really shown: at 3× it can pass inside the release's own tick)
  if (REL - 1 > f0) atFrame(u, 'attack', REL - 1, () => u.frameInfo().frame === REL - 1 && playV3('magusSwing', { volume: 0.75, pan }), { late: false });
  atFrame(u, 'attack', REL, relSound, { late: false });
  chargeRunesV3(sc, u, toRel + 40);
  const orbLight = followLight(sc, () => (u.sprite.active ? staffPoint(u) : null), { color: PAL.void4, radius: 18, floorY: u.home.y, air: 0.9, intensity: 0.3, anim: 'breathe', fadeIn: 60 });
  orbLight.setIntensity(1.2, Math.max(60, toRel - 60));
  await sleep(sc, toRel);
  relSound(); // (normally already played by the release frame itself)
  // ---- release: the orb leaves the staff tip of the thrust frame — that frame's own point (A2 fix
  // r2: read off the frame shown, the release tick still saw the whip-over, so the orb set off
  // from above the helm while the thrust showed it in the cradle)
  const from = rnd2(releasePoint(u, REL));
  void orbLight.fadeOut(120);
  void lightFlash(sc, from.x, from.y, PAL.void4, 20, 200, { floorY: u.home.y, air: 0.9, intensity: 0.9 });
  // the orb lands ON the body's face toward the magus (A2 fix r2: aimed at / 8 px short of the
  // core, it slid over the wyrm's raised claw or the wolf's head for its last ~15 px before
  // bursting); blocked, it is stopped there — the guard / the bigger body throws it back
  if (s.target) to = surfacePoint(s.target, s.to, from) ?? to;
  const dist = len(sub(to, from));
  // a short shot (the two stand close) is a snap that accelerates into the body (≈80–100 ms), not
  // the 160-ms float of a long one, which crept over a gap that small
  const snap = dist < SNAP_DIST;
  const flight = snap ? clamp(Math.round(70 + dist), 80, 100) : clamp(Math.round(dist * 1.2), 160, 300);
  const arcUp = snap ? clamp(Math.round(dist * 0.1), 1, 3) : clamp(dist * 0.16, 6, 20);
  const ctrl = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - arcUp };
  const r = new Raster(sc, Math.floor(Math.min(from.x, to.x) - 30), Math.floor(Math.min(from.y, to.y) - 40), Math.ceil(Math.abs(to.x - from.x) + 60), Math.ceil(Math.abs(to.y - from.y) + 70), DEPTH.FX);
  const trail: XY[] = [];
  const g0 = u.home;
  const g1 = s.target ? s.target.home : s.toGround;
  const fl = lightPool(sc, from.x, from.y, { color: PAL.void4, spill: PAL.void3, radius: 18, floorY: g0.y, air: 0.9, intensity: 1, anim: 'breathe', fadeIn: 0 });
  const motes = new Sparks(sc, DEPTH.FX - 1);
  await animate(sc, flight, (t, el, dt) => {
    const e = snap ? t * t : 0.4 * t + 0.6 * t * t;
    const p = rnd2(qbez(from, ctrl, to, e));
    fl.setPosition(p.x, p.y, g0.y + (g1.y - g0.y) * e);
    if (!trail.length || trail[0].x !== p.x || trail[0].y !== p.y) {
      trail.unshift(p);
      if (trail.length > 7) trail.pop();
    }
    r.draw((g) => {
      // a continuous stepped streak behind the orb: 5 → 3 → 1 px, void3 → void1, oldest first
      for (let i = trail.length - 1; i >= 1; i--) {
        const a = trail[i];
        const b = trail[i - 1];
        const w = i < 3 ? 5 : i < 5 ? 3 : 1;
        const c = i < 2 ? PAL.void3 : i < 4 ? PAL.void2 : PAL.void1;
        g.line(a.x, a.y, b.x, b.y, c, 1, w);
        if (i < 4) g.line(a.x, a.y - Math.floor(w / 2), b.x, b.y - Math.floor(w / 2), PAL.void4, 1, 1);
      }
      drawOrb(g, p.x, p.y, el);
    });
    if (dt > 0 && t < 0.9) motes.add({ x: p.x + Math.round(RR(-2, 2)), y: p.y + Math.round(RR(-2, 2)), vx: RR(-12, 12), vy: RR(-22, 0), drag: 2, life: RR(180, 300), colors: [PAL.void4, PAL.void3, PAL.void2, PAL.void1], shape: 'px', fadeAt: 1 });
  });
  r.destroy();
  motes.release();
  void fl.fadeOut(160);
  // ---- contact: the orb's arrival (the battle kit pops the number on this frame)
  s.impact(to);
  // (0.7: the orb lands out of a quiet flight with nothing compressing it — at 1 it was 3 dB over
  // the wyrm's breath contact, the slice's biggest blow: sound QA #11)
  playV3('magusOrbBurst', { volume: 0.7, pan: panAt(to.x) });
  void lightFlash(sc, to.x, to.y, PAL.void4, s.blocked ? 24 : 30, 340, { floorY: s.target ? s.target.home.y : s.toGround.y, air: 0.7, intensity: 0.85 });
  const victim = s.target && s.target.sprite.active && s.target.sprite.visible ? s.target.sprite : null;
  implodeV3(sc, to, s.blocked, victim ? victim.depth - 0.5 : DEPTH.FX + 3);
  // the attacker loses: the battle kit answers on this frame and owns the body from here
  if (loses) return;
  await sleep(sc, 60);
  if (!u.sprite.active || u.retired) return;
  if (s.blocked) {
    // the guard holds and the backlash runs up the attack's line: the magus is jolted (magic)
    await u.play(u.has('hitMagic') ? 'hitMagic' : 'hit');
    return;
  }
  // recovery: the staff comes home, the robe settles after the body
  await u.playRange('attack', FOLLOW + 1);
}

export type { GameEvent };
