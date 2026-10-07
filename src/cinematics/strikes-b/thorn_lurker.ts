// Dikenli Pusucu — "Diken Kırbacı" (GAME_DESIGN §7) and its FLIP effect.
//
// Strike (≈0.9 s): the pod shivers, the soil cracks (attack f1) → the whip-vine rears back over
//   the pod (f2) while thorny vines burst out of the soil in front of it and race along the
//   floor to the target → they rear up beside it (f3: the lash) → CRACK on f4: the vines whip the
//   target together with the art's own whip — a leaf-green slash, magenta thorns and leaf bits
//   fly → overshoot (f5) and the vines withdraw into the ground (f6–f8). Blocked: the lash recoils
//   off the guard. Direct: the vines crawl all the way to the duelist.
// FLIP effect: the maw bursts open (roar f2) → a ridge of cracking soil races underground from the
//   lurker (or from its graveyard, if it already fell) to the chosen enemy monster → the ground
//   splits under it, vines erupt, spiral up around it and CRUSH it (hit-stop, thorn sparks) → it
//   shatters (the destroy plays there).
// Death: the plant wilts — the lid clamps, it browns and sags into the soil, leaves and spores
//   drift off, then it shatters into leaves, thorns and clods.

import Phaser from 'phaser';
import { PAL, RAMPS } from '../../art/palette';
import { DEPTH, type XY, unitDepth, zoneXY } from '../../view/layout';
import { shake } from '../../vfx/core';
import { slash, whiteFlash } from '../../vfx/combat';
import { vineBurst } from '../../vfx/setpieces';
import type { GameEvent } from '../../engine/types';
import { fx, registerCardHook, registerStrike } from '../api';
import {
  E,
  Sparks,
  animate,
  cbez,
  clamp,
  facing,
  flavoredDeath,
  groundRing,
  homeSprite,
  layer,
  lerp,
  playFrom,
  pose,
  reseed,
  rr,
  sleep,
  vlen,
  vlerp,
  vnorm,
  vsub,
  type Px,
  type StrikeArgs,
} from './_kit';

/** Vine root in the soil, frame px. */
const ROOT = { x: 36, y: 41 };
const THORN = [PAL.white, PAL.mag4, PAL.mag3, PAL.mag2] as const;
const LEAF = [PAL.leaf4, PAL.leaf3, PAL.leaf2, PAL.leaf1] as const;
const DIRT = [PAL.earth3, PAL.earth2, PAL.earth1] as const;

/** Unit screen vector lying on the iso floor, perpendicular (on the floor) to screen direction d. */
function floorPerp(d: XY): XY {
  const c = (d.x / 32 + d.y / 16) / 2;
  const r = (d.y / 16 - d.x / 32) / 2;
  return vnorm({ x: (-r - c) * 32, y: (-r + c) * 16 });
}

interface VineOpts {
  /** Time the vines take to crawl to the target (ms). */
  grow: number;
  lash?: number;
  hold?: number;
  back?: number;
  count?: number;
  /** Strike point height above its floor point (px). */
  lift?: number;
  blocked?: boolean;
  onLash?: () => void;
  onImpact?: () => void;
}

/**
 * Thorn vines (adapted from vfx/combat.vineWhip): burst from the soil at `from`, crawl along the
 * floor, rear up and whip `to`, then withdraw. Magenta thorns to match the lurker's art.
 */
function thornVines(scene: Phaser.Scene, from: XY, to: XY, o: VineOpts): Promise<void> {
  const count = o.count ?? 3;
  const lift = o.lift ?? 18;
  const GROW = o.grow;
  const LASH = o.lash ?? 90;
  const HOLD = o.hold ?? 110;
  const BACK = o.back ?? 230;
  const px = layer(scene, unitDepth(Math.max(from.y, to.y + lift)) + 0.5);
  const sp = new Sparks(scene, DEPTH.FX);
  const d = vnorm(vsub(to, from));
  const e = floorPerp(d);
  const toFloor = { x: to.x, y: to.y + lift };
  let hit = false;
  let lashed = false;
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + rr(-1.1, 1.1);
    sp.add({ x: from.x, y: from.y, vx: Math.cos(a) * rr(30, 80), vy: Math.sin(a) * rr(40, 100), ay: 420, rot: rr(0, 6), vrot: rr(-10, 10), life: rr(300, 500), colors: DIRT, shape: rr(0, 1) < 0.5 ? 'shard' : 'sq', size: 2, floor: from.y + 3, bounce: 0.3 });
  }
  const sample = (i: number, el: number, reveal: number, lashK: number, recoil: number): XY[] => {
    const off = (i - (count - 1) / 2) * 5;
    const P0 = { x: from.x + e.x * off, y: from.y + e.y * off };
    const bow = (i % 2 === 0 ? 1 : -1) * 9;
    const P1 = { x: lerp(from.x, toFloor.x, 0.45) + e.x * (off * 1.6 + bow), y: lerp(from.y, toFloor.y, 0.45) + e.y * (off * 1.6 + bow) + 2 };
    const P2 = { x: toFloor.x - d.x * 12 + e.x * off * 0.5, y: toFloor.y - d.y * 12 - 4 };
    const coil = { x: to.x - d.x * 15, y: to.y - 18 + i * 3 };
    const strike = { x: to.x + d.x * 4 + e.x * off * 0.3, y: to.y + i * 4 - 2 };
    let P3 = vlerp(coil, strike, lashK);
    if (recoil > 0) P3 = vlerp(P3, { x: to.x - d.x * 18, y: to.y - 10 + i * 3 }, recoil);
    const pts: XY[] = [];
    const N = 40;
    for (let k = 0; k <= N * reveal; k++) {
      const t = k / N;
      const b = cbez(P0, P1, P2, P3, t);
      const amp = 3.4 * (1 - 0.5 * lashK) * Math.sin(Math.PI * t);
      const w = Math.sin(t * 9 - el * 0.025 + i * 2) * amp;
      const dd = cbez(P0, P1, P2, P3, Math.min(1, t + 0.02));
      const tv = vnorm(vsub(dd, b));
      pts.push({ x: b.x - tv.y * w, y: b.y + tv.x * w });
    }
    return pts;
  };
  const drawVine = (pts: XY[], el: number, hot: boolean) => {
    if (pts.length < 2) return;
    const n = pts.length;
    px.stroke(pts, 5.2, 2.4, PAL.ink);
    px.stroke(pts, 3.8, 1.3, PAL.leaf1);
    px.stroke(
      pts.map((p) => ({ x: p.x - 0.6, y: p.y - 0.8 })),
      2.4,
      1,
      PAL.leaf2,
    );
    for (let k = 1; k < n; k++) if (k % 2 === 0) px.dot(pts[k].x - 1, pts[k].y - 1.5, PAL.leaf3, 1);
    // magenta thorns
    for (let k = 3; k < n - 1; k += 3) {
      const a = pts[k];
      const b = pts[k + 1];
      const tv = vnorm(vsub(b, a));
      const side = (k / 3) % 2 === 0 ? 1 : -1;
      const nx = -tv.y * side;
      const ny = tv.x * side;
      const w = lerp(2.3, 1, k / n);
      const tip = { x: a.x + nx * (w + 2.5) + tv.x * 1.5, y: a.y + ny * (w + 2.5) + tv.y * 1.5 };
      px.line(a.x + nx * w, a.y + ny * w, tip.x, tip.y, PAL.mag2, 1);
      px.dot(tip.x, tip.y, hot && Math.floor(el / 40) % 2 ? PAL.white : PAL.mag3, 1);
    }
    for (let k = 6; k < n - 2; k += 9) {
      const a = pts[k];
      const sway = Math.sin(el * 0.01 + k) > 0 ? 1 : 0;
      px.ellipse(a.x + 2, a.y - 3 - sway, 2, 1.2, PAL.leaf3, 1).dot(a.x + 1, a.y - 3 - sway, PAL.leaf4, 1);
    }
  };
  return new Promise((resolve) => {
    void animate(scene, GROW + LASH + HOLD + BACK, (_t, el, dt) => {
      px.clear();
      let reveal = 1;
      let lashK = 0;
      let recoil = 0;
      if (el < GROW) reveal = E.outQ(el / GROW);
      else if (el < GROW + LASH) {
        if (!lashed) {
          lashed = true;
          o.onLash?.();
        }
        lashK = E.inC((el - GROW) / LASH);
      } else if (el < GROW + LASH + HOLD) {
        lashK = 1;
        if (o.blocked) recoil = E.outQ((el - GROW - LASH) / HOLD) * 0.8;
      } else {
        lashK = 1;
        recoil = o.blocked ? 0.8 : 0;
        reveal = 1 - E.inQ((el - GROW - LASH - HOLD) / BACK);
      }
      if (!hit && el >= GROW + LASH) {
        hit = true;
        o.onImpact?.();
        void slash(scene, to.x, to.y, { ramp: RAMPS.leaf, angle: Math.atan2(d.y, d.x) + 1.1, size: 14, ms: 170, sound: false });
        const n = o.blocked ? 10 : 18;
        for (let i = 0; i < n; i++) {
          const a = o.blocked ? Math.atan2(-d.y, -d.x) + rr(-1.2, 1.2) : rr(0, Math.PI * 2);
          const v = rr(60, 160);
          sp.add({ x: to.x, y: to.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, ay: 380, rot: rr(0, 6), vrot: rr(-14, 14), life: rr(300, 560), colors: i % 3 === 0 ? THORN : LEAF, shape: 'shard', size: rr(1.6, 2.8) });
        }
      }
      // the hole in the soil
      px.ellipse(from.x, from.y + 1, 7, 2.6, PAL.ink, 0.8 * Math.min(1, reveal * 2));
      px.ellipseRing(from.x, from.y + 1, 8, 3, 1, PAL.earth1, 0.8 * Math.min(1, reveal * 2));
      for (let i = 0; i < count; i++) drawVine(sample(i, el, Math.max(0.02, reveal), lashK, recoil), el, lashK > 0.5);
      // soil kicked up along the crawling front
      if (dt > 0 && el < GROW && rr(0, 1) < 0.7) {
        const f = vlerp(from, toFloor, E.outQ(el / GROW));
        sp.add({ x: f.x + rr(-4, 4), y: f.y + rr(-2, 2), vx: rr(-25, 25), vy: -rr(30, 70), ay: 380, life: rr(200, 360), colors: DIRT, shape: 'px', floor: f.y + 3, bounce: 0.3 });
      }
    }).then(() => {
      px.g.destroy();
      sp.release();
      if (!hit) o.onImpact?.();
      resolve();
    });
  });
}

// ---------------------------------------------------------------- strike

async function thornStrike(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const spr = u.sprite;
  reseed(u.uid * 89 + 21);
  u.rest();
  homeSprite(u);
  const home = { x: spr.x, y: spr.y };
  const target = s.target;
  const hitPt: XY = s.direct || !target ? s.to : target.core();
  const floor = s.direct ? s.toGround : target ? target.home : s.toGround;
  const lift = Math.max(6, floor.y - hitPt.y);
  const root = u.framePoint(ROOT.x, ROOT.y);
  const sp = new Sparks(sc, DEPTH.FX + 1);
  try {
    // ---- the pod shivers, the soil cracks
    pose(u, 'attack', 1);
    s.ctx.sfx('cardSlide', { volume: 0.5, pitch: 0.5 });
    s.ctx.sfx('groundCrack', { volume: 0.35, pitch: 1.4 });
    void shake(sc, 100, 1);
    await animate(sc, 140, (t, el) => {
      spr.x = Math.round(home.x + (Math.floor(el / 30) % 2 ? 1 : 0));
      if (rr(0, 1) < 0.3) sp.add({ x: root.x + rr(-6, 6), y: root.y + rr(-1, 2), vx: rr(-20, 20), vy: -rr(20, 60), ay: 380, life: rr(180, 300), colors: DIRT, shape: 'px' });
      void t;
    });
    spr.x = home.x;
    // ---- rear back while the vines crawl out to the target
    pose(u, 'attack', 2);
    const dist = vlen(vsub(floor, root));
    const grow = clamp(dist * 2.6, 280, 440);
    s.ctx.sfx('whoosh', { volume: 0.45, pitch: 0.6 });
    let impactP: Promise<void> | null = null;
    impactP = thornVines(sc, root, hitPt, {
      grow,
      lift,
      count: s.direct ? 3 : 3,
      blocked: s.blocked,
      onLash: () => {
        pose(u, 'attack', 3);
        s.ctx.sfx('whoosh', { volume: 0.6, pitch: 1.5 });
      },
      onImpact: () => {
        pose(u, 'attack', 4);
        s.impact(hitPt);
        s.ctx.sfx('slash', { volume: 0.8, pitch: 0.85 });
        void wait2(sc, 60).then(() => playFrom(u, 'attack', 5));
        if (!s.blocked) void groundRing(sc, floor.x, floor.y, { r0: 6, r1: 32, ms: 380, colors: [PAL.leaf4, PAL.leaf3, PAL.leaf2] });
      },
    });
    await impactP;
  } finally {
    sp.release();
    homeSprite(u);
    if (!u.retired && spr.active && u.frameInfo().anim !== 'attack') u.rest();
  }
}

function wait2(scene: Phaser.Scene, ms: number): Promise<void> {
  return sleep(scene, ms);
}

registerStrike('thorn_lurker', thornStrike);

// ---------------------------------------------------------------- FLIP effect

/** A ridge of cracking soil racing underground from → to. */
function burrow(scene: Phaser.Scene, from: XY, to: XY, ms: number): Promise<void> {
  const px = layer(scene, DEPTH.TILE_FX + 5);
  const sp = new Sparks(scene, DEPTH.FX);
  const marks: { p: XY; t: number }[] = [];
  return animate(scene, ms, (t, el, dt) => {
    const e = 0.4 * t + 0.6 * t * t;
    const p = vlerp(from, to, e);
    if (!marks.length || vlen(vsub(p, marks[marks.length - 1].p)) > 3) marks.push({ p, t: el });
    px.clear();
    for (let i = 1; i < marks.length; i++) {
      const age = clamp((el - marks[i].t) / 500, 0, 1);
      const a = marks[i - 1].p;
      const b = marks[i].p;
      px.seg(a.x, a.y + 1, b.x, b.y + 1, 3, PAL.earth2, 0.7 * (1 - age));
      px.line(a.x, a.y, b.x, b.y, PAL.ink, 1 - age);
      if (i % 3 === 0) px.dot(b.x + 1, b.y - 1, PAL.leaf3, 1 - age);
    }
    // the bulge of the travelling front: heaving soil with vine tips poking through
    px.ellipse(p.x, p.y + 1, 8, 3.4, PAL.ink, 0.7);
    px.ellipse(p.x, p.y, 7, 3, PAL.earth1, 1);
    px.ellipse(p.x - 1, p.y - 1, 5, 2, PAL.earth2, 1);
    px.ellipse(p.x - 2, p.y - 1.5, 2.5, 1, PAL.earth3, 1);
    const wig = Math.floor(el / 50) % 2;
    px.line(p.x - 3, p.y - 1, p.x - 4 - wig, p.y - 5, PAL.leaf2, 1).dot(p.x - 4 - wig, p.y - 6, PAL.mag3, 1);
    px.line(p.x + 2, p.y - 1, p.x + 3 + wig, p.y - 4, PAL.leaf3, 1).dot(p.x + 3 + wig, p.y - 5, PAL.mag3, 1);
    if (dt > 0)
      for (let i = 0; i < 2; i++) sp.add({ x: p.x + rr(-3, 3), y: p.y, vx: rr(-30, 30), vy: -rr(40, 90), ay: 420, rot: rr(0, 6), vrot: rr(-10, 10), life: rr(220, 380), colors: i ? DIRT : LEAF, shape: i ? 'px' : 'shard', size: 2, floor: p.y + 3, bounce: 0.3 });
  }).then(() => {
    void animate(scene, 300, (t) => {
      px.clear();
      for (let i = 1; i < marks.length; i++) px.line(marks[i - 1].p.x, marks[i - 1].p.y, marks[i].p.x, marks[i].p.y, PAL.ink, 0.6 * (1 - t));
    }).then(() => px.g.destroy());
    sp.release();
  });
}

registerCardHook('thorn_lurker', 'effect', async (ctx) => {
  const ev = ctx.ev;
  const sc = ctx.scene;
  reseed(ev.uid * 23 + 7);
  const run = fx.resolutionRun(ctx);
  const ti = run.find((i) => ctx.events[i].type === 'target');
  const tEv = ti !== undefined ? (ctx.events[ti] as Extract<GameEvent, { type: 'target' }>) : null;
  const ref = tEv?.targets[0];
  if (!ref || ti === undefined) {
    await fx.playRun(ctx, run);
    return;
  }
  ctx.consumeAt(ti);
  const victim = ctx.views.field.unitAt(ref.player, ref.index);
  const at = zoneXY(ref.player, 'monster', ref.index);
  const u = ctx.unit(ev.uid);
  let from: XY;
  if (u && u.sprite.visible) {
    // the maw bursts open, vines fling out
    void ctx.focus({ x: (u.home.x + at.x) / 2, y: (u.home.y + at.y) / 2 - 10 }, { zoom: 1.05, ms: 300, pan: 0.3 });
    void u.play('roar');
    ctx.sfx('roarSmall', { volume: 0.8, pitch: 1.2 });
    await u.playToFrame('roar', 2);
    from = u.framePoint(ROOT.x, ROOT.y);
  } else {
    // it already fell: the vines come out of its grave
    const pile = ctx.views.field.pile(ctx.owner(ev.uid), 'graveyard');
    const p = pile.topXY();
    void pile.flash(PAL.leaf3);
    from = { x: p.x, y: p.y + 4 };
    void ctx.focus({ x: (from.x + at.x) / 2, y: (from.y + at.y) / 2 - 10 }, { zoom: 1.04, ms: 300, pan: 0.3 });
    await sleep(sc, 160);
  }
  // lock: a green ring tightens on the victim's floor
  void groundRing(sc, at.x, at.y, { r0: 34, r1: 10, ms: 300, colors: [PAL.leaf2, PAL.leaf3, PAL.leaf4, PAL.white] });
  ctx.sfx('groundCrack', { volume: 0.7, pitch: 1.1 });
  await burrow(sc, from, at, clamp(vlen(vsub(at, from)) * 2.4, 260, 420));
  // erupt, wrap, crush — then it shatters
  const di = fx.resolutionRun(ctx).find((i) => {
    const e = ctx.events[i];
    return e.type === 'destroy' && e.location === 'monster' && e.zone === ref.index && e.player === ref.player;
  });
  if (victim && victim.sprite.visible) {
    await vineBurst(sc, at.x, at.y, victim.sprite);
    // magenta thorn shards at the crush
    const sp = new Sparks(sc, DEPTH.FX + 2);
    const c = victim.core();
    for (let i = 0; i < 14; i++) {
      const a = rr(0, Math.PI * 2);
      const v = rr(60, 150);
      sp.add({ x: c.x + rr(-6, 6), y: c.y + rr(-8, 8), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, ay: 300, rot: rr(0, 6), vrot: rr(-12, 12), life: rr(300, 520), colors: THORN, shape: 'shard', size: rr(1.6, 2.6) });
    }
    sp.release();
  } else {
    void shake(sc, 160, 1);
    await sleep(sc, 200);
  }
  if (di !== undefined) await ctx.play(di, { hit: false, push: { x: 0, y: -1 } });
  await fx.playRun(ctx, fx.resolutionRun(ctx));
  await ctx.unfocus(260);
});

// ---------------------------------------------------------------- death

registerCardHook('thorn_lurker', 'destroyed', (ctx) =>
  flavoredDeath(ctx, {
    async flavor(u, info) {
      const sc = ctx.scene;
      const spr = u.sprite;
      const d = facing(u);
      const sp = new Sparks(sc, DEPTH.FX + 1);
      pose(u, 'hit', 0);
      if (info.hit) await whiteFlash(sc, spr, 2);
      ctx.sfx('cardSlide', { volume: 0.5, pitch: 0.4 });
      // wilt: browns, sags into the soil, leans; leaves and spores drift off
      await animate(sc, 380, (t, el) => {
        const k = Math.floor(t * 4) / 4;
        spr.setTint(k < 0.25 ? 0xffffff : k < 0.5 ? PAL.leaf4 : k < 0.75 ? PAL.earth4 : PAL.earth3);
        spr.setScale(1 + 0.08 * E.inQ(t), 1 - 0.18 * E.inQ(t));
        spr.setAngle(-d * 7 * E.inQ(t));
        if (t > 0.3) pose(u, 'guard', 0);
        if (Math.floor(el / 50) !== Math.floor((el - 17) / 50)) {
          const c = u.core();
          sp.add({ x: c.x + rr(-8, 8), y: c.y + rr(-6, 4), vx: rr(-20, 20), vy: -rr(10, 30), ay: 40, drag: 1.5, rot: rr(0, 6), vrot: rr(-6, 6), life: rr(500, 800), colors: rr(0, 1) < 0.5 ? [PAL.leaf3, PAL.earth3, PAL.earth2] : [PAL.leaf4, PAL.gold4, PAL.leaf3], shape: rr(0, 1) < 0.5 ? 'shard' : 'px', size: 2 });
        }
      });
      sp.release();
    },
    glitchMs: 80,
    push: () => ({ x: 0, y: 1 }),
    onBurst(u, at) {
      const sp = new Sparks(ctx.scene, DEPTH.FX + 2);
      for (let i = 0; i < 16; i++) {
        const a = rr(0, Math.PI * 2);
        const v = rr(40, 130);
        sp.add({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 50, ay: 260, drag: 1, rot: rr(0, 6), vrot: rr(-10, 10), life: rr(400, 800), colors: i % 4 === 0 ? THORN : i % 4 === 1 ? DIRT : LEAF, shape: 'shard', size: rr(1.6, 2.8), floor: u.home.y + 3, bounce: 0.3 });
      }
      sp.release();
    },
  }),
);
