// Mercan Yılanı — "Gelgit Mızrağı" (GAME_DESIGN §7): water splash impact, the piercing jet that
// punches through a defender into the duelist, and the serpent's foam death.
//
// Strike (≈1.1 s): the neck coils back while sea water spirals up from a rippling floor into the
// jaws (frames 1–3), the head snaps forward (f4) and on f5 a high-pressure jet with wavy edges
// fires; the jaws stay open and pulse (f5–7) while it pours, the body shudders with the recoil.
// Impact: hit-stop + a splash crown, droplets that land as puddles, mist. Blocked: the jet fans
// out against the guard. Piercing (vs DEF, with damage): the 'attack' hook owns the battle —
// the jet hits, the defender breaks, the jet drills on into the duelist and the damage lands
// there.
// Death: the serpent recoils and its body turns to sea foam from the coil up, bubbles rise, and
// it bursts into a spray of pixels and droplets.

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import type { GameEvent } from '../../engine/types';
import { DEPTH, type XY } from '../../view/layout';
import { beam, directHit } from '../../vfx/combat';
import { fx, registerCardHook, registerStrike } from '../api';
import type { CinematicContext } from '../_core/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import {
  E,
  FloorMarks,
  RR,
  Sparks,
  TAU,
  animate,
  clamp,
  currentPixels,
  facing,
  flavoredDeath,
  frameOffset,
  frameMs,
  holdFrame,
  layer,
  len,
  lerp,
  lerpXY,
  norm,
  onFrame,
  otherPlayer,
  overlay,
  playFrom,
  playSfx,
  seed,
  shatterPx,
  sleep,
  sub,
  whiteFlash,
  type EvOf,
} from './_kit';

const WATER = [PAL.white, PAL.water4, PAL.water3, PAL.water2] as const;
const MARK_DEPTH = DEPTH.CARD_ON_TILE + 2;

// ================================================================ splash

/** Water impact: a splash crown, droplets that land as puddles, a burst ring and mist. */
export function waterSplash(scene: Phaser.Scene, at: XY, o: { dir: XY; floor: number; power?: number; sheet?: boolean }): void {
  const power = o.power ?? 2;
  const d = norm(o.dir);
  const marks = new FloorMarks(scene, MARK_DEPTH);
  const sp = new Sparks(scene, DEPTH.FX + 2);
  const mist = new Sparks(scene, DEPTH.FX + 1);
  const px = layer(scene, DEPTH.FX + 2);
  playSfx('waterSplash', { volume: 0.8 + 0.1 * power });
  const n = o.sheet ? 26 : 18 + power * 6;
  const back = Math.atan2(-d.y, -d.x);
  const drops: { x: number; y: number; vx: number; vy: number; floor: number; landed: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    let a: number;
    if (o.sheet) a = back + (i % 2 ? 1 : -1) * RR(0.9, 1.7); // fans out along the shield plane
    else a = -Math.PI / 2 + RR(-1.25, 1.25) + (R2() ? d.x * 0.5 : 0);
    const v = RR(70, 150 + power * 20);
    drops.push({ x: at.x + RR(-3, 3), y: at.y + RR(-3, 3), vx: Math.cos(a) * v + d.x * 25, vy: Math.sin(a) * v - RR(10, 60), floor: o.floor + RR(-6, 10), landed: false });
  }
  for (let i = 0; i < 6; i++) mist.add({ x: at.x + RR(-8, 8), y: at.y + RR(-6, 6), vx: RR(-18, 18), vy: RR(-26, -6), drag: 1.4, life: RR(500, 800), colors: [PAL.water3, PAL.water2, PAL.water1], shape: 'puff', size: RR(3, 5), grow: 7, alpha: 0.45 });
  for (let i = 0; i < 5; i++) mist.add({ x: at.x + RR(-6, 6), y: at.y + RR(-6, 4), vx: RR(-8, 8), vy: RR(-30, -14), drag: 0.6, life: RR(500, 900), colors: [PAL.white, PAL.water4], shape: 'ring', size: RR(1, 2), flicker: true });
  mist.release();
  onFrame(
    scene,
    (dt, el) => {
      const s = dt / 1000;
      px.clear();
      if (el < 260) {
        const t = el / 260;
        const r = 4 + (14 + power * 3) * E.outC(t);
        px.ellipseRing(at.x, at.y, r, r * 0.8, t < 0.35 ? 2 : 1, t < 0.25 ? PAL.white : PAL.water4, 1 - t);
        if (t < 0.4) px.disc(at.x, at.y, 5 * (1 - t / 0.4) + 1, PAL.white, 1);
      }
      let alive = el < 260 ? 1 : 0;
      for (const q of drops) {
        if (q.landed) continue;
        alive++;
        q.vy += 520 * s;
        q.vx *= Math.exp(-0.8 * s);
        const px0 = q.x;
        const py0 = q.y;
        q.x += q.vx * s;
        q.y += q.vy * s;
        if (q.y >= q.floor && q.vy > 0) {
          q.landed = true;
          marks.blob(q.x, q.floor, RR(1.5, 3), RR(600, 900), [PAL.water4, PAL.water3, PAL.water2, PAL.water1]);
          continue;
        }
        px.line(px0, py0, q.x, q.y, PAL.water3, 1);
        px.dot(q.x, q.y, PAL.white, 1);
      }
      if (!alive) {
        marks.close();
        return false;
      }
      return true;
    },
    () => px.g.destroy(),
  );
  sp.release();
}

let r2 = 0;
function R2(): boolean {
  return ++r2 % 2 === 0;
}

// ================================================================ the jet

interface JetArgs {
  scene: Phaser.Scene;
  ctx: CinematicContext;
  u: MonsterUnit;
  to: XY;
  /** Pierce: the jet continues to this point. */
  through?: XY;
  blocked: boolean;
  onImpact(at: XY): void;
  onPierce?(at: XY): void;
}

/** Coil + water gathering + jet (jaws held open while it pours). Resolves when the jet is done. */
async function jet(a: JetArgs): Promise<void> {
  const { scene: sc, u } = a;
  const spr = u.sprite;
  const sgn = facing(u);
  const F = frameMs(u, 'attack'); // 83 ms
  const rest = { x: spr.x, y: spr.y };
  const home = u.home;
  void u.play('attack');
  // the floor ripples inward and sea water spirals up into the jaws (frames 1–3)
  const ripple = layer(sc, MARK_DEPTH + 1);
  const drops = new Sparks(sc, spr.depth + 0.4);
  const coilMs = F * 4;
  void animate(sc, coilMs, (t, _el, dt) => {
    ripple.clear();
    for (let k = 0; k < 2; k++) {
      const q = (t + k * 0.5) % 1;
      const r = 28 * (1 - q) + 6;
      ripple.ellipseRing(home.x, home.y, r, r * 0.45, 1, k ? PAL.water3 : PAL.water4, 0.8 * Math.sin(Math.PI * q));
    }
    if (dt > 0) {
      const m = u.framePoint(u.art.muzzle.x - 8, u.art.muzzle.y - 2);
      for (let i = 0; i < 2; i++) {
        const ang = RR(0, TAU);
        drops.add({ x: home.x + Math.cos(ang) * RR(14, 26), y: home.y + Math.sin(ang) * RR(5, 10), tx: m.x, ty: m.y, curl: RR(-16, 16), life: RR(200, 320), colors: [PAL.water2, PAL.water3, PAL.water4, PAL.white], shape: i ? 'px' : 'sq', size: 1, fadeAt: 1 });
      }
    }
  }).then(() => {
    ripple.g.destroy();
    drops.release();
  });
  playSfx('waterSplash', { volume: 0.35, pitch: 1.6 });
  await sleep(sc, F * 4);
  // frame 4: the snap forward — the beam's short charge sits on the opening jaws
  let pouring = true;
  const muzzle = () => u.framePoint(u.art.muzzle.x, u.art.muzzle.y);
  const dist = len(sub(a.to, muzzle()));
  const fireMs = a.through ? 600 : a.blocked ? 340 : 440;
  const pulse = (async () => {
    await sleep(sc, F);
    // frames 5–7 cycle while the jet pours; the body shudders with the recoil
    const cyc = [5, 6, 7, 6];
    let i = 0;
    while (pouring && spr.active) {
      holdFrame(u, 'attack', cyc[i++ % cyc.length]);
      spr.setPosition(Math.round(rest.x - sgn * (1 + (i % 2))), Math.round(rest.y + (i % 2 ? 0 : 1)));
      await sleep(sc, 60);
    }
    if (spr.active) spr.setPosition(rest.x, rest.y);
    void playFrom(u, 'attack', 8);
  })();
  await beam(sc, muzzle, a.to, 'water', {
    chargeMs: F,
    fireMs,
    width: 10,
    through: a.through,
    onFire: () => {
      playSfx('waterSplash', { volume: 0.6, pitch: 0.7 });
      void a.ctx.focus({ x: lerp(muzzle().x, a.to.x, 0.6), y: lerp(muzzle().y, a.to.y, 0.6) }, { zoom: 1.07, ms: 160, pan: 0.34 });
    },
    onImpact: () => a.onImpact(a.to),
    onPierce: a.through ? () => a.onPierce?.(a.through!) : undefined,
  });
  pouring = false;
  await pulse;
  void dist;
}

// ================================================================ strike (all but piercing)

registerStrike('coral_serpent', async (s) => {
  const u = s.attacker;
  seed(u.uid * 41 + (s.target?.uid ?? 1));
  const dir = norm(sub(s.to, u.core()));
  const to: XY = s.blocked ? { x: s.to.x - dir.x * 8, y: s.to.y - dir.y * 8 } : s.to;
  void s.ctx.focus({ x: lerp(u.core().x, to.x, 0.4), y: lerp(u.core().y, to.y, 0.4) }, { zoom: 1.05, ms: 300, pan: 0.3 });
  await jet({
    scene: s.scene,
    ctx: s.ctx as unknown as CinematicContext,
    u,
    to,
    blocked: s.blocked,
    onImpact: (at) => {
      s.impact(at);
      waterSplash(s.scene, at, { dir, floor: s.target ? s.target.home.y : s.toGround.y, power: s.power, sheet: s.blocked });
    },
  });
  if (u.sprite.active && u.frameInfo().anim !== 'attack') u.rest();
});

// ================================================================ piercing: the jet drills on into the duelist

type BattleCtx = CinematicContext<EvOf<'battle'>>;

function isBreak(e: GameEvent): boolean {
  return !(e.type === 'damage' || e.type === 'destroy' || e.type === 'toGraveyard' || e.type === 'statChange' || e.type === 'fieldSpell');
}

registerCardHook('coral_serpent', 'attack', async (ctx: BattleCtx) => {
  const ev = ctx.ev;
  if (ev.result !== 'targetDestroyed' || ev.targetPosition !== 'defense' || ev.targetUid === null) return ctx.base();
  const defender = otherPlayer(ev.player);
  const dmgIdx = ctx.findType('damage', (e) => e.source === 'battle' && e.player === defender, { until: isBreak });
  const u = ctx.unit(ev.attackerUid);
  if (dmgIdx < 0 || !u || !u.sprite.visible) return ctx.base();
  const sc = ctx.scene;
  seed(u.uid * 43 + 7);
  const target = ctx.unit(ev.targetUid);
  const tTile = ctx.tile(ev.targetUid);
  const destroyIdx: number[] = [];
  for (let i = ctx.index + 1; i < ctx.events.length; i++) {
    const e = ctx.events[i];
    if (isBreak(e)) break;
    if (e.type === 'destroy' && e.reason === 'battle') destroyIdx.push(i);
  }
  const tDestroy = destroyIdx.find((i) => (ctx.events[i] as EvOf<'destroy'>).uid === ev.targetUid) ?? -1;
  ctx.take('attack')?.destroy();
  const to: XY = target && target.sprite.visible ? target.core() : tTile ? { x: tTile.home.x, y: tTile.home.y - 10 } : fx.zoneCenter(defender, 'monster', ev.targetZone ?? 1);
  const duelist = fx.duelistPoint(ctx, defender);
  // the jet punches on along its own line (a pierce, not a ricochet), bending only slightly
  // toward the duelist so it still lands on them
  const mOff = frameOffset(u, u.art.muzzle.x, u.art.muzzle.y);
  const mouth0 = { x: u.rest0.x + mOff.x, y: u.rest0.y + mOff.y };
  const line = norm(sub(to, mouth0));
  const reach = len(sub(duelist, to));
  const straight = { x: to.x + line.x * reach, y: to.y + line.y * reach };
  const through = lerpXY(straight, duelist, 0.45);
  const dir = norm(sub(through, to));
  void ctx.focus({ x: lerp(u.core().x, duelist.x, 0.45), y: lerp(u.core().y, duelist.y, 0.45) }, { zoom: 1.05, ms: 320, pan: 0.3 });
  const pending: Promise<unknown>[] = [];
  const jdir = norm(sub(to, u.core()));
  await jet({
    scene: sc,
    ctx: ctx as unknown as CinematicContext,
    u,
    to,
    through,
    blocked: false,
    onImpact: (at) => {
      pending.push(fx.hitReact(ctx, target, 2, [PAL.water1, PAL.water2, PAL.water3, PAL.water4, PAL.white], at, jdir));
      waterSplash(sc, at, { dir: jdir, floor: target ? target.home.y : at.y + 20, power: 2 });
      if (tDestroy >= 0) pending.push(sleep(sc, 90).then(() => ctx.play(tDestroy, { push: jdir, hit: false })));
    },
    onPierce: (at) => {
      // "DELİCİ": the jet bursts out of the defender into the duelist
      playSfx('impactHeavy', { volume: 0.7, pitch: 0.9 });
      pending.push(directHit(sc, defender, { at }));
      waterSplash(sc, at, { dir, floor: at.y + 24, power: 3 });
      void ctx.views.duelists?.get(defender).jolt();
      pending.push(ctx.play(dmgIdx, { at: { x: at.x, y: at.y - 22 }, battle: true }));
    },
  });
  for (const i of destroyIdx) if (i !== tDestroy) pending.push(ctx.play(i));
  if (tDestroy >= 0 && !ctx.isConsumed(tDestroy)) pending.push(ctx.play(tDestroy, { push: jdir, hit: false }));
  if (!ctx.isConsumed(dmgIdx)) pending.push(ctx.play(dmgIdx, { at: duelist, battle: true }));
  await Promise.all(pending.map((p) => p.catch((e) => console.error('[strikes-a] pierce', e))));
  if (u.sprite.active && u.frameInfo().anim !== 'attack') u.rest();
  await ctx.unfocus(260);
});

// ================================================================ death: dissolving into sea foam

const FOAM = [PAL.water2, PAL.water3, PAL.water4, PAL.mist, PAL.white] as const;
const lum = (c: number): number => (((c >> 16) & 255) * 0.299 + ((c >> 8) & 255) * 0.587 + (c & 255) * 0.114) / 255;

registerCardHook('coral_serpent', 'destroyed', (ctx) =>
  flavoredDeath(ctx, async (d) => {
    const u = d.unit;
    const sc = ctx.scene;
    seed(u.uid * 29 + 4);
    if (d.hit) {
      void u.play('hit', { hold: true });
      await whiteFlash(sc, u.sprite, 2);
    }
    holdFrame(u, 'hit', 0);
    const { pc } = currentPixels(u);
    const foam = new PixelCanvas(pc.w, pc.h);
    const ov = overlay(u, foam);
    const b = pc.bounds() ?? { x: 0, y: 0, w: pc.w, h: pc.h };
    const noise = (x: number, y: number) => {
      const h = Math.sin(x * 91.7 + y * 47.3) * 9631.17;
      return h - Math.floor(h);
    };
    const bubbles = new Sparks(sc, u.sprite.depth + 0.5);
    playSfx('waterSplash', { volume: 0.45, pitch: 1.5 });
    const spr = u.sprite;
    const y0 = spr.y;
    // the body rears up (stretch) while foam climbs from the coil to the crown
    await animate(sc, 420, (t, el, dt) => {
      if (spr.active) {
        spr.setScale(1 - 0.04 * E.outQ(t), 1 + 0.07 * E.outQ(t));
        spr.y = y0 - Math.round(2 * E.outQ(t));
      }
      foam.clear();
      const level = b.y + b.h - (b.h + 8) * E.inOutQ(t);
      const step = Math.floor(el / 60); // the foam boils (re-rolls its bubbles) every 60 ms
      for (let y = b.y; y < b.y + b.h; y++)
        for (let x = b.x; x < b.x + b.w; x++) {
          const c = pc.get(x, y);
          if (c === null) continue;
          const k = y + noise(x, y) * 8;
          if (k > level + 4) {
            // keep the body's shading: dark → deep water, lit → white foam
            const l = lum(c);
            let i = l < 0.1 ? 0 : Math.min(4, Math.floor(l * 4.5) + 1);
            const h = noise(x + step * 13, y - step * 7);
            if (h < 0.07) i = Math.max(0, i - 2); // a bubble pops
            else if (h > 0.94) i = 4; // a glint
            foam.set(x, y, FOAM[i]);
          } else if (k > level) foam.set(x, y, k > level + 2 ? PAL.white : PAL.water4, 220); // the wet crest
        }
      ov.redraw(foam);
      if (dt > 0 && R2()) {
        const p = u.framePoint(b.x + RR(0, b.w), clamp(level + RR(0, 10), b.y, b.y + b.h));
        bubbles.add({ x: p.x, y: p.y, vx: RR(-6, 6), vy: RR(-40, -18), drag: 0.5, life: RR(400, 700), colors: [PAL.white, PAL.water4, PAL.water3], shape: 'ring', size: RR(1, 2), flicker: true });
      }
    });
    bubbles.release();
    const foamed = pc.clone();
    foamed.blit(foam, 0, 0);
    ov.destroy();
    if (spr.active) spr.setScale(1).setY(y0);
    d.burst();
    waterSplash(sc, { x: d.home.x, y: d.home.y - 10 }, { dir: d.push ?? { x: 0, y: -1 }, floor: d.home.y, power: 2 });
    await shatterPx(sc, u, {
      pc: foamed,
      ramp: [PAL.water1, PAL.water2, PAL.water3, PAL.water4, PAL.white],
      push: d.push,
      glitchMs: 70,
      speed: 0.95,
      up: [30, 80],
      shards: 16,
      shardColors: WATER,
    });
  }),
);
