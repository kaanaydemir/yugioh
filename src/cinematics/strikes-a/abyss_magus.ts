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
import { DEPTH, type XY, zoneXY } from '../../view/layout';
import type { TileCard } from '../../view/TileCard';
import { lockOn, projectile } from '../../vfx/combat';
import { tendril } from '../../vfx/setpieces';
import { fx, registerCardHook, registerStrike } from '../api';
import type { StrikeArgs } from '../_core/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import {
  ADD,
  E,
  RR,
  Sparks,
  TAU,
  animate,
  clamp,
  facing,
  clusterPoint,
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
  sub,
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
        const rx = 24 * k;
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
    const rr = 26 * (1 - e) + 4;
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
  const u = s.attacker;
  const sc = s.scene;
  seed(u.uid * 71 + (s.target?.uid ?? 5));
  const F = frameMs(u, 'attack'); // 100 ms
  const launchAt = u.art.attackImpactFrame * F; // frame 5: staff thrust, orb released
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
  const flight = clamp(len(sub(to, muzzle)) * 2.2, 180, 380);
  const IMPLODE = 230;
  // the world dims while the vortex drinks the light, then the void bursts
  let pull: { release(): void } | null = null;
  let dimmer: { remove(ms?: number): Promise<void> } | null = null;
  const arrive = sleep(sc, 16 + flight).then(() => {
    pull = vortexPull(sc, s, to, IMPLODE);
    dimmer = veil(sc, 0.35, IMPLODE * 0.8);
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
  await Promise.all([tendril(sc, from, cardAt), flip]);
  lock.destroy();
  // the clench: the magus lowers its staff
  stopGlow?.();
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
  await animate(sc, 360, (t, el) => {
    const open = E.outBack(Math.min(1, t * 2.2));
    const close = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
    pool.clear();
    const rx = 18 * open * close;
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
      const rx = 26 * poolK * (1 - closing);
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

export type { GameEvent };
