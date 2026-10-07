// Şimşek Kertenkelesi — "Şimşek Kuyruğu" (GAME_DESIGN §7) and its death discharge (−500).
//
// Strike (≈1.0 s): the art's charge wave climbs the crest from the tail tip to the crown
//   (attack f1–f4) and we make it CRACKLE — arcs jump between the spikes at the wave front,
//   sparks spit off, static ticks on the floor; f4 is held a beat with the mouth blazing →
//   f5: the jaws open and a thick zig-zag bolt cracks from the jaws to the target (instant hit:
//   white flash frame, re-strikes, the screen trembles) → the target is ELECTRIFIED: arcs crawl
//   over its body, a scorch ring and sparks at its feet. Blocked: the bolt splashes on the guard
//   and forks away into the floor. Direct: it strikes the duelist.
// Death: the crest shorts out — arcs crawl over the body, it jitters, sparks spray — and it
//   shatters. If its effect will fire (destroyed in battle), a crackling ball of static stays
//   over the tile; the effect then charges it and a bolt leaps into the opponent's LP panel:
//   "−500" lands on the strike.

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { DEPTH, type XY, zoneXY } from '../../view/layout';
import { flash, shake } from '../../vfx/core';
import { whiteFlash } from '../../vfx/combat';
import { panelGlow } from '../../vfx/setpieces';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { GameEvent, PlayerId, Uid } from '../../engine/types';
import { fx, registerCardHook, registerStrike } from '../api';
import {
  ADD,
  E,
  Sparks,
  animate,
  clamp,
  facing,
  flavoredDeath,
  framePixelsOf,
  glint,
  groundRing,
  homeSprite,
  layer,
  lerp,
  opp,
  playFrom,
  pose,
  reseed,
  ri,
  rr,
  sleep,
  vlen,
  vnorm,
  vsub,
  worldBox,
  type ActCtx,
  type Px,
  type StrikeArgs,
} from './_kit';

const VOLT = [PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white] as const;
const CREST = [PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white];

// ---------------------------------------------------------------- lightning drawing

/** Midpoint-displacement zig-zag a → b. */
export function zig(a: XY, b: XY, rough = 0.3, minLen = 5): XY[] {
  const out: XY[] = [a];
  const rec = (p: XY, q: XY, r: number, depth: number) => {
    const l = vlen(vsub(q, p));
    if (l < minLen || depth > 7) {
      out.push(q);
      return;
    }
    const m = { x: lerp(p.x, q.x, rr(0.4, 0.6)), y: lerp(p.y, q.y, rr(0.4, 0.6)) };
    const n = { x: -(q.y - p.y) / l, y: (q.x - p.x) / l };
    const off = rr(-1, 1) * l * r;
    const mm = { x: m.x + n.x * off, y: m.y + n.y * off };
    rec(p, mm, r * 0.9, depth + 1);
    rec(mm, q, r * 0.9, depth + 1);
  };
  rec(a, b, rough, 0);
  return out;
}

interface Bolt {
  main: XY[];
  forks: XY[][];
}

function makeBolt(a: XY, b: XY, forks: number, rough = 0.3): Bolt {
  const main = zig(a, b, rough, 4);
  const L = vlen(vsub(b, a));
  const d = vnorm(vsub(b, a));
  const fs: XY[][] = [];
  for (let i = 0; i < forks; i++) {
    const k = ri(Math.floor(main.length * 0.25), Math.floor(main.length * 0.85));
    const p = main[Math.min(main.length - 1, k)];
    const ang = Math.atan2(d.y, d.x) + (rr(0, 1) < 0.5 ? -1 : 1) * rr(0.4, 1);
    const bl = L * rr(0.15, 0.32);
    fs.push(zig(p, { x: p.x + Math.cos(ang) * bl, y: p.y + Math.sin(ang) * bl }, 0.35, 3));
  }
  return { main, forks: fs };
}

function path(px: Px, pts: XY[], w: number, c: number, a = 1): void {
  for (let i = 1; i < pts.length; i++) px.seg(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, w, c, a);
}

/** Bolt with a glow layer (additive) and a crisp core layer. `hot` = the white strike frame. */
function drawBolt(core: Px, glow: Px, b: Bolt, w: number, a: number, hot: boolean): void {
  for (const f of b.forks) {
    path(glow, f, w + 1, PAL.cyan2, 0.5 * a);
    path(core, f, 1, hot ? PAL.white : PAL.cyan4, a);
  }
  path(glow, b.main, w + 4, PAL.cyan1, 0.45 * a);
  path(glow, b.main, w + 2, PAL.cyan2, 0.6 * a);
  path(core, b.main, Math.max(1, w), hot ? PAL.white : PAL.cyan3, a);
  path(core, b.main, 1, PAL.white, a);
}

/** Tiny arcs crawling over a box (electrified body). */
function crawl(scene: Phaser.Scene, box: () => { x: number; y: number; w: number; h: number }, ms: number, depth: number, k = 1): Promise<void> {
  const core = layer(scene, depth + 0.1);
  const glow = layer(scene, depth, ADD);
  let arcs: XY[][] = [];
  let frame = 0;
  return animate(scene, ms, (t, _el, dt) => {
    core.clear();
    glow.clear();
    if (t >= 1) return;
    if (dt > 0) frame++;
    if (frame % 2 === 0 || !arcs.length) {
      const b = box();
      arcs = [];
      const n = Math.round(3 * k);
      for (let i = 0; i < n; i++) {
        const p = { x: b.x + rr(0.15, 0.85) * b.w, y: b.y + rr(0.15, 0.9) * b.h };
        const a = rr(0, Math.PI * 2);
        const l = rr(5, 12);
        arcs.push(zig(p, { x: p.x + Math.cos(a) * l, y: p.y + Math.sin(a) * l }, 0.5, 2));
      }
    }
    const al = t > 0.7 ? (frame % 2 ? 0.4 : 1) : 1;
    for (const a of arcs) {
      path(glow, a, 2, PAL.cyan2, 0.6 * al);
      path(core, a, 1, frame % 3 ? PAL.cyan4 : PAL.white, al);
    }
  }).then(() => {
    core.g.destroy();
    glow.g.destroy();
  });
}

/** Sparks spray (electric). */
function spray(sp: Sparks, at: XY, n: number, dir?: XY, speed = 1): void {
  const base = dir ? Math.atan2(dir.y, dir.x) : 0;
  for (let i = 0; i < n; i++) {
    const a = dir ? base + rr(-1.2, 1.2) : rr(0, Math.PI * 2);
    const v = rr(70, 180) * speed;
    sp.add({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, ay: 320, drag: 2.5, life: rr(160, 340), colors: [PAL.white, PAL.cyan4, PAL.cyan3, PAL.cyan2], shape: 'streak', len: 0.025 });
  }
}

// ---------------------------------------------------------------- strike

async function voltStrike(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const spr = u.sprite;
  reseed(u.uid * 211 + 13);
  u.rest();
  homeSprite(u);
  const target = s.target;
  const hitPt: XY = s.direct || !target ? s.to : target.core();
  const sp = new Sparks(sc, DEPTH.FX + 2);
  const floorSp = new Sparks(sc, DEPTH.TILE_FX + 6);
  // crest pixels per charge frame (frame coords), sorted tail → crown
  const coreY = u.art.core.y;
  const crest: XY[][] = [1, 2, 3, 4].map((f) => framePixelsOf(u, 'attack', f, CREST).filter((p) => p.y < coreY - 1).sort((a, b) => a.x - b.x));
  const arcCore = layer(sc, spr.depth + 0.3);
  const arcGlow = layer(sc, spr.depth + 0.2, ADD);
  let crackle = true;
  let el0 = 0;
  const crackleFn = (_t: number, delta: number) => {
    arcCore.clear();
    arcGlow.clear();
    if (!crackle || !spr.active) return;
    el0 += Math.min(50, delta) * sc.tweens.timeScale;
    const fi = u.frameInfo();
    const f = fi.anim === 'attack' ? clamp(fi.frame, 1, 4) : 4;
    const pts = crest[f - 1];
    if (!pts.length) return;
    const minX = pts[0].x;
    const maxX = pts[pts.length - 1].x;
    const front = lerp(minX, maxX, f / 4);
    const near = pts.filter((p) => Math.abs(p.x - front) < 9 || (f === 4 && p.x > front - 30));
    const step = Math.floor(el0 / 34);
    for (let i = 0; i < 3 && near.length > 1; i++) {
      const a = near[(step * 7 + i * 13) % near.length];
      const b = near[(step * 11 + i * 5 + 3) % near.length];
      if (Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2) continue;
      const wa = u.framePoint(a.x, a.y);
      const wb = u.framePoint(b.x, b.y - 2);
      const z = zig(wa, wb, 0.6, 2);
      path(arcGlow, z, 2, PAL.cyan2, 0.7);
      path(arcCore, z, 1, step % 2 ? PAL.white : PAL.cyan4, 1);
    }
    if (step % 2 === 0 && near.length) {
      const p = near[(step * 3) % near.length];
      const w = u.framePoint(p.x, p.y);
      sp.add({ x: w.x, y: w.y, vx: rr(-40, 40), vy: -rr(40, 100), ay: 260, life: rr(140, 260), colors: [PAL.white, PAL.cyan4, PAL.cyan3], shape: 'px' });
    }
  };
  sc.events.on('postupdate', crackleFn);
  try {
    // ---- charge wave climbs the crest (f1–f4), static on the floor
    s.ctx.sfx('beamCharge', { volume: 0.55, pitch: 1.7 });
    for (let f = 1; f <= 4; f++) {
      pose(u, 'attack', f);
      if (f === 2 || f === 4) s.ctx.sfx('lightning', { volume: 0.18, pitch: 2.2 });
      const g = u.home;
      for (let i = 0; i < 2; i++) floorSp.add({ x: g.x + rr(-16, 16), y: g.y + rr(-3, 4), vy: -rr(10, 40), life: rr(100, 200), colors: [PAL.white, PAL.cyan4, PAL.cyan3], shape: 'px' });
      await sleep(sc, f === 4 ? 150 : 80);
      if (f === 4) {
        const m = u.muzzle();
        void glint(sc, m.x, m.y, { size: 7, ms: 160, color: PAL.cyan4 });
      }
    }
    // ---- f5: the bolt cracks from the jaws
    void playFrom(u, 'attack', 5);
    crackle = false;
    const m = u.muzzle();
    const dir = vnorm(vsub(hitPt, m));
    const end = s.blocked ? { x: hitPt.x - dir.x * 7, y: hitPt.y - dir.y * 5 } : hitPt;
    s.impact(hitPt);
    s.ctx.sfx('lightning', { volume: 1 });
    s.ctx.sfx('thunder', { volume: 0.45, pitch: 1.4 });
    void flash(sc, 90, PAL.cyan4, 0.16, DEPTH.OVERLAY - 2);
    void shake(sc, 260, s.power >= 3 ? 4 : 3);
    const bc = layer(sc, DEPTH.FX + 3);
    const bg = layer(sc, DEPTH.FX + 2.9, ADD);
    let bolt = makeBolt(m, end, 3);
    let frame = 0;
    const forks: XY[][] = [];
    if (s.blocked) {
      // the bolt splashes on the guard and forks away into the floor
      for (let i = 0; i < 3; i++) {
        const a = Math.atan2(dir.y, dir.x) + Math.PI + rr(-1.1, 1.1);
        forks.push(zig(end, { x: end.x + Math.cos(a) * rr(14, 26), y: end.y + Math.abs(Math.sin(a)) * rr(10, 22) }, 0.4, 3));
      }
    }
    // scorch + sparks at the target's feet
    spray(sp, end, 16, s.blocked ? { x: -dir.x, y: -dir.y } : dir);
    if (!s.blocked) {
      void groundRing(sc, s.toGround.x, s.toGround.y, { r0: 6, r1: 34, ms: 380, colors: [PAL.white, PAL.cyan4, PAL.cyan3, PAL.cyan2] });
      if (target && target.sprite.visible) void crawl(sc, () => worldBox(target), 420, target.sprite.depth + 0.5, 1.2);
    }
    await animate(sc, 360, (t, el, dt) => {
      bc.clear();
      bg.clear();
      if (t >= 1) return;
      if (dt > 0) frame++;
      if (el < 140 && frame % 2 === 0) bolt = makeBolt(m, end, 3);
      // re-strikes then flicker out
      const restrike = (t > 0.38 && t < 0.46) || (t > 0.6 && t < 0.66);
      const a = t < 0.3 || restrike ? 1 : frame % 2 ? 0 : 1 - t;
      if (a <= 0) return;
      drawBolt(bc, bg, bolt, el < 34 || restrike ? 3 : 2, a, el < 34);
      for (const f of forks) {
        path(bg, f, 3, PAL.cyan2, 0.5 * a);
        path(bc, f, 1, PAL.cyan4, a);
      }
      const k = 1 - t;
      bc.disc(m.x, m.y, 2 + 2 * k, PAL.cyan4, a).disc(m.x, m.y, 1 + k, PAL.white, a);
      bc.star(end.x + 0.5, end.y + 0.5, 5 + 9 * k, 1.5, PAL.cyan4, a, frame % 4 < 2 ? 0 : Math.PI / 4).disc(end.x, end.y, 2 + 2 * k, PAL.white, a);
    });
    bc.g.destroy();
    bg.g.destroy();
    await sleep(sc, 180);
  } finally {
    crackle = false;
    sc.events.off('postupdate', crackleFn);
    arcCore.g.destroy();
    arcGlow.g.destroy();
    sp.release();
    floorSp.release();
    homeSprite(u);
    if (!u.retired && spr.active && u.frameInfo().anim !== 'attack') u.rest();
  }
}

registerStrike('volt_lizard', voltStrike);

// ---------------------------------------------------------------- remains (static ball)

interface Remains {
  at: XY;
  /** 0..1 charge (swells and crackles harder). */
  charge: number;
  dispose(fizzle: boolean): void;
}

const remains = new Map<Uid, Remains>();

/** A crackling ball of static floating over the tile where the lizard died. */
function leaveRemains(scene: Phaser.Scene, uid: Uid, at: XY, lifeMs = 5000): Remains {
  remains.get(uid)?.dispose(false);
  const core = layer(scene, DEPTH.FX + 1);
  const glow = layer(scene, DEPTH.FX + 0.9, ADD);
  const sp = new Sparks(scene, DEPTH.FX + 1.2);
  let el = 0;
  let alive = true;
  let fizzle = -1;
  const r: Remains = {
    at,
    charge: 0,
    dispose(fz: boolean) {
      if (!alive) return;
      if (fz) {
        fizzle = 0;
        return;
      }
      kill();
    },
  };
  const kill = () => {
    if (!alive) return;
    alive = false;
    scene.events.off('postupdate', upd);
    core.g.destroy();
    glow.g.destroy();
    sp.release();
    if (remains.get(uid) === r) remains.delete(uid);
  };
  const upd = (_t: number, delta: number) => {
    const dt = Math.min(50, delta) * scene.tweens.timeScale;
    el += dt;
    core.clear();
    glow.clear();
    let k = 1;
    if (fizzle >= 0) {
      fizzle += dt;
      k = 1 - fizzle / 300;
      if (k <= 0) return kill();
    }
    if (el > lifeMs && fizzle < 0) fizzle = 0;
    const grow = E.outBack(clamp(el / 200, 0, 1));
    const R = (4 + 3 * r.charge) * grow * k;
    const y = at.y + Math.sin(el * 0.006) * 1.5;
    glow.disc(at.x, y, R + 5, PAL.cyan1, 0.35);
    glow.disc(at.x, y, R + 2, PAL.cyan2, 0.5);
    core.disc(at.x, y, R, PAL.cyan3, 1);
    core.disc(at.x - 0.5, y - 0.5, R * 0.55, PAL.white, 1);
    const step = Math.floor(el / 40);
    const n = 2 + Math.round(3 * r.charge);
    for (let i = 0; i < n; i++) {
      const a = (step * 2.3 + i * 2.1) % (Math.PI * 2);
      const l = R + 4 + ((step + i) % 3) * 3 + r.charge * 6;
      const z = zig({ x: at.x, y }, { x: at.x + Math.cos(a) * l, y: y + Math.sin(a) * l * 0.8 }, 0.5, 2);
      path(glow, z, 2, PAL.cyan2, 0.6 * k);
      path(core, z, 1, (step + i) % 2 ? PAL.white : PAL.cyan4, k);
    }
    if (dt > 0 && rr(0, 1) < 0.25 + r.charge * 0.5) sp.add({ x: at.x + rr(-4, 4), y: y + rr(-4, 4), vx: rr(-60, 60), vy: rr(-80, 10), ay: 260, life: rr(120, 240), colors: [PAL.white, PAL.cyan4, PAL.cyan3], shape: 'px' });
  };
  scene.events.on('postupdate', upd);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, kill);
  remains.set(uid, r);
  return r;
}

// ---------------------------------------------------------------- death

registerCardHook('volt_lizard', 'destroyed', (ctx) => {
  // will its discharge fire in this batch? (destroyed in battle → activate from the graveyard)
  const willFire = ctx.find((e) => e.type === 'activate' && e.kind === 'monsterEffect' && e.uid === ctx.ev.uid) >= 0;
  return flavoredDeath(ctx, {
    async flavor(u, info) {
      const sc = ctx.scene;
      const spr = u.sprite;
      const sp = new Sparks(sc, DEPTH.FX + 2);
      pose(u, 'hit', 0);
      if (info.hit) await whiteFlash(sc, spr, 2);
      ctx.sfx('lightning', { volume: 0.5, pitch: 1.6 });
      // the crest shorts out: arcs crawl over the body, it jitters, sparks spray
      const x0 = spr.x;
      const box = worldBox(u);
      void crawl(sc, () => box, 360, spr.depth + 0.5, 1.5);
      await animate(sc, 360, (t, el) => {
        pose(u, 'hit', Math.min(2, Math.floor(t * 3)));
        spr.x = Math.round(x0 + (Math.floor(el / 34) % 2 ? 1 : -1));
        if (Math.floor(el / 60) !== Math.floor((el - 17) / 60)) {
          const c = u.framePoint(u.art.core.x + rr(-8, 8), u.art.core.y - rr(4, 14));
          spray(sp, c, 4, { x: 0, y: -1 }, 0.7);
        }
      });
      spr.x = x0;
      sp.release();
    },
    glitchMs: 80,
    onBurst(u, at) {
      const sp = new Sparks(ctx.scene, DEPTH.FX + 2);
      spray(sp, at, 22);
      sp.release();
      ctx.sfx('lightning', { volume: 0.6, pitch: 1.3 });
      if (willFire) leaveRemains(ctx.scene, u.uid, { x: u.home.x, y: u.home.y - 14 });
    },
  });
});

// ---------------------------------------------------------------- effect: discharge −500

function lastZoneXY(ctx: ActCtx): XY | null {
  for (let i = ctx.index - 1; i >= 0; i--) {
    const e = ctx.events[i];
    if (e.type === 'destroy' && e.uid === ctx.ev.uid) return zoneXY(e.player, 'monster', e.zone);
  }
  return null;
}

registerCardHook('volt_lizard', 'effect', async (ctx) => {
  const ev = ctx.ev;
  const sc = ctx.scene;
  reseed(ev.uid * 41 + 1);
  const run = fx.resolutionRun(ctx);
  const di = run.find((i) => {
    const e = ctx.events[i];
    return e.type === 'damage' && e.sourceUid === ev.uid;
  });
  const dEv = di !== undefined ? (ctx.events[di] as Extract<GameEvent, { type: 'damage' }>) : null;
  const victim: PlayerId = dEv ? dEv.player : opp(ev.player);
  if (ctx.views.camera.isFocused) await ctx.unfocus(160);
  // the static ball left by the death (or a new one over its old tile)
  let r = remains.get(ev.uid) ?? null;
  if (!r) {
    const z = lastZoneXY(ctx) ?? ctx.views.field.pile(ctx.owner(ev.uid), 'graveyard').topXY();
    r = leaveRemains(sc, ev.uid, { x: z.x, y: z.y - 14 });
    await sleep(sc, 160);
  }
  const ball = r;
  // ---- charge: it swells, arcs lash the floor
  ctx.sfx('beamCharge', { volume: 0.7, pitch: 1.5 });
  await animate(sc, 300, (t) => {
    ball.charge = E.inQ(t);
  });
  // ---- the bolt leaps into the opponent's LP panel
  const to = fx.lpPoint(ctx, victim);
  const from = { ...ball.at };
  const bc = layer(sc, DEPTH.HUD + 6);
  const bg = layer(sc, DEPTH.HUD + 5.9, ADD);
  const sp = new Sparks(sc, DEPTH.HUD + 7);
  ctx.sfx('lightning', { volume: 1 });
  ctx.sfx('thunder', { volume: 0.6, pitch: 1.2 });
  let hit: Promise<void> = Promise.resolve();
  let struck = false;
  let bolt = makeBolt(from, to, 4, 0.22);
  let frame = 0;
  await animate(sc, 520, (t, el, dt) => {
    bc.clear();
    bg.clear();
    if (dt > 0) frame++;
    if (el < 110) {
      // stepped leader racing across
      const n = Math.max(2, Math.floor(bolt.main.length * E.inQ(el / 110)));
      const part = bolt.main.slice(0, n);
      path(bg, part, 3, PAL.cyan2, 0.6);
      path(bc, part, 1, PAL.cyan4, 1);
      const h = part[part.length - 1];
      bc.disc(h.x, h.y, 2.5, PAL.white, 1);
      return;
    }
    if (!struck) {
      struck = true;
      ball.dispose(false);
      void flash(sc, 110, PAL.white, 0.35, DEPTH.OVERLAY - 2);
      void shake(sc, 200, 2);
      void panelGlow(sc, victim, [PAL.white, PAL.cyan4, PAL.cyan3, PAL.cyan2], 460);
      spray(sp, to, 20);
      if (di !== undefined && !ctx.isConsumed(di)) hit = ctx.play(di, { delivered: true });
    }
    if (el < 220 && frame % 2 === 0) bolt = makeBolt(from, to, 4, 0.22);
    const restrike = (t > 0.45 && t < 0.52) || (t > 0.66 && t < 0.7);
    const a = t < 0.4 || restrike ? 1 : frame % 2 ? 0 : 1 - t;
    if (a > 0) drawBolt(bc, bg, bolt, el < 150 || restrike ? 3 : 2, a, el < 150);
    const k = 1 - t;
    bc.star(to.x + 0.5, to.y + 0.5, 6 + 12 * k, 2, PAL.cyan4, a, frame % 4 < 2 ? 0 : Math.PI / 4).disc(to.x, to.y, 3 + 2 * k, PAL.white, a);
  });
  bc.g.destroy();
  bg.g.destroy();
  sp.release();
  if (!struck && di !== undefined && !ctx.isConsumed(di)) hit = ctx.play(di, { delivered: true });
  ball.dispose(false);
  await hit;
  await fx.playRun(ctx, fx.resolutionRun(ctx));
});
