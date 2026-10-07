// Işık Perisi — "Işık Kıvılcımı" (GAME_DESIGN §7) and her +500 LP effect.
//
// Strike (≈1.1 s): a PIROUETTE (roar f1 crouch → f2 front → f3 left → f4 back) inside a ring of
//   light that circles her waist (back half behind her, front half in front) → the ring folds
//   into her hands (attack f2/f3, the orb swells) → thrust (f4) → RELEASE on f5: three sparkles
//   leave her hands and curve to the target on three different arcs, staggered, twinkling, with
//   glittering trails → each arrival pops a star and chimes higher; the third is the impact:
//   a radiant burst of light rays and lingering glints. Blocked: the sparkles splinter on the
//   guard and scatter back. Direct: they fly to the duelist.
// Effect (+500): she spins and throws her arms up in a V (roar f5) — a fountain of sparkles
//   shoots up from her hands, hangs twinkling, then rains in curves into her own LP panel;
//   on the first arrival the panel glows and "+500" counts up (the lpGain event plays then).
// Death: her light gutters out — she flickers, sinks toward the floor shedding fading motes,
//   then shatters while tiny glints float up like fireflies.

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { DEPTH, type XY } from '../../view/layout';
import { whiteFlash } from '../../vfx/combat';
import { panelGlow } from '../../vfx/setpieces';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { GameEvent } from '../../engine/types';
import { fx, registerCardHook, registerStrike } from '../api';
import {
  ADD,
  E,
  Sparks,
  animate,
  cbez,
  clamp,
  facing,
  flavoredDeath,
  homeSprite,
  layer,
  lerp,
  playFrom,
  pose,
  reseed,
  rr,
  sleep,
  vlen,
  vnorm,
  vsub,
  type Px,
  type StrikeArgs,
  impactPoint,
} from './_kit';

const GOLD = [PAL.gold2, PAL.gold3, PAL.gold4, PAL.white] as const;

/** A twinkling 4-point star (gold arms, white heart, cyan tips on alternate frames). */
function star(px: Px, x: number, y: number, r: number, frame: number, a = 1, glow?: Px): void {
  const rot = frame % 2 ? Math.PI / 4 : 0;
  if (glow) {
    glow.disc(x + 0.5, y + 0.5, r + 3, PAL.gold2, 0.35 * a);
    glow.disc(x + 0.5, y + 0.5, r + 1, PAL.gold3, 0.35 * a);
  }
  px.star(x + 0.5, y + 0.5, r + 1.6, 1.4, PAL.gold3, 0.75 * a, rot);
  px.star(x + 0.5, y + 0.5, r, 1, frame % 4 < 2 ? PAL.gold4 : PAL.cyan4, a, rot);
  px.rect(x - 1, y - 1, 3, 3, PAL.white, a);
}

/** The light ring around her waist during the pirouette. Two layers: behind and in front of her. */
function waistRing(u: MonsterUnit): { stop(fold?: XY): Promise<void> } {
  const sc = u.scene;
  const spr = u.sprite;
  const back = layer(sc, spr.depth - 0.5, ADD);
  const front = layer(sc, spr.depth + 0.5, ADD);
  let el = 0;
  let fold: XY | null = null;
  let foldT = 0;
  let alive = true;
  const upd = (_t: number, delta: number) => {
    if (!alive) return;
    const dt = Math.min(50, delta) * sc.tweens.timeScale;
    el += dt;
    if (fold) foldT = Math.min(1, foldT + dt / 140);
    back.clear();
    front.clear();
    const c = u.core();
    const grow = E.outBack(clamp(el / 160, 0, 1));
    const R = 13 * grow * (1 - foldT);
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = el * 0.018 + (i / n) * Math.PI * 2;
      const x = c.x + Math.cos(a) * R;
      const y = c.y + 4 + Math.sin(a) * R * 0.38;
      const p = fold ? { x: lerp(x, fold.x, E.inQ(foldT)), y: lerp(y, fold.y, E.inQ(foldT)) } : { x, y };
      const lay = Math.sin(a) >= 0 ? front : back;
      const col = i % 2 === 0 ? PAL.white : PAL.gold4;
      // comet tail along the ring
      for (let k = 1; k <= 4; k++) {
        const a2 = a - k * 0.11;
        const q = { x: c.x + Math.cos(a2) * R, y: c.y + 4 + Math.sin(a2) * R * 0.38 };
        const qq = fold ? { x: lerp(q.x, fold.x, E.inQ(foldT)), y: lerp(q.y, fold.y, E.inQ(foldT)) } : q;
        lay.dot(qq.x, qq.y, k < 2 ? PAL.gold4 : PAL.gold3, (1 - k / 5) * 0.9);
      }
      lay.rect(p.x - 1, p.y - 1, 2, 2, col, 1);
      lay.rect(p.x - 2, p.y, 4, 1, PAL.gold3, 0.6);
    }
  };
  sc.events.on('postupdate', upd);
  return {
    async stop(f?: XY) {
      if (f) {
        fold = f;
        await sleep(sc, 150);
      }
      alive = false;
      sc.events.off('postupdate', upd);
      back.g.destroy();
      front.g.destroy();
    },
  };
}

/** Radiant light burst: thin rays + ring + lingering cross glints. */
function lightBurst(scene: Phaser.Scene, at: XY, k = 1): void {
  const px = layer(scene, DEPTH.FX + 4, ADD);
  const sp = new Sparks(scene, DEPTH.FX + 5);
  const rays = 10;
  const offs = Array.from({ length: rays }, () => rr(-0.15, 0.15));
  void animate(scene, 340, (t) => {
    px.clear();
    if (t >= 1) return;
    const r0 = 4 + 10 * E.outC(t) * k;
    const r1 = 10 + 26 * E.outC(t) * k;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + offs[i];
      const long = i % 2 === 0 ? 1 : 0.6;
      px.line(at.x + Math.cos(a) * r0, at.y + Math.sin(a) * r0 * 0.8, at.x + Math.cos(a) * r1 * long, at.y + Math.sin(a) * r1 * 0.8 * long, t < 0.4 ? PAL.white : PAL.gold4, 1 - t);
    }
    px.ring(at.x, at.y, 3 + 14 * E.outC(t) * k, 1, t < 0.3 ? PAL.white : PAL.gold3, 1 - t);
  }).then(() => px.g.destroy());
  for (let i = 0; i < 7; i++) {
    const a = rr(0, Math.PI * 2);
    const d = rr(6, 18) * k;
    sp.add({ x: at.x + Math.cos(a) * d, y: at.y + Math.sin(a) * d * 0.8, vy: -rr(4, 14), life: rr(300, 520), delay: rr(0, 160), colors: [PAL.white, PAL.gold4, PAL.cyan4, PAL.gold3], shape: 'plus', size: 1, flicker: true, fadeAt: 0.6 });
  }
  sp.release();
}

interface FlightOpts {
  from: XY;
  to: XY;
  n?: number;
  ms?: number;
  stagger?: number;
  /** Bend (px) of the three arcs. */
  bend?: number;
  depth?: number;
  /** Arrival of sparkle i (0-based). */
  onArrive?: (i: number, at: XY) => void;
  stopShort?: number;
}

/** n sparkles curving from → to on different arcs. Resolves when the last has arrived. */
function sparkleFlight(scene: Phaser.Scene, o: FlightOpts): Promise<void> {
  const n = o.n ?? 3;
  const ms = o.ms ?? 420;
  const stagger = o.stagger ?? 80;
  const depth = o.depth ?? DEPTH.FX + 3;
  const px = layer(scene, depth);
  const glow = layer(scene, depth - 0.05, ADD);
  const sp = new Sparks(scene, depth - 0.1);
  const dir = vnorm(vsub(o.to, o.from));
  const nv = { x: -dir.y, y: dir.x };
  const bend = o.bend ?? 30;
  const to = o.stopShort ? { x: o.to.x - dir.x * o.stopShort, y: o.to.y - dir.y * o.stopShort } : o.to;
  const sides = n === 1 ? [0] : n === 2 ? [-1, 1] : [-1, 0, 1];
  const curves = Array.from({ length: n }, (_, i) => {
    const side = sides[i % sides.length] * (1 + Math.floor(i / 3) * 0.4);
    return {
      c1: { x: o.from.x + nv.x * side * bend - dir.x * 6, y: o.from.y + nv.y * side * bend - 22 - (side === 0 ? 14 : 0) },
      c2: { x: to.x + nv.x * side * bend * 0.6 - dir.x * 14, y: to.y + nv.y * side * bend * 0.6 - 16 },
    };
  });
  const hist: XY[][] = curves.map(() => []);
  const arrived = curves.map(() => false);
  let frame = 0;
  return new Promise((resolve) => {
    let finished = false;
    void animate(scene, ms + stagger * (n - 1), (_t, el, dt) => {
      px.clear();
      glow.clear();
      if (dt > 0) frame++;
      for (let i = 0; i < n; i++) {
        const lt = el - i * stagger;
        if (lt < 0) {
          // waiting sparkles hover at the hands
          star(px, o.from.x + Math.cos(el * 0.03 + i * 2) * 3, o.from.y + Math.sin(el * 0.03 + i * 2) * 2, 2.5, frame + i, 1, glow);
          continue;
        }
        const u = clamp(lt / ms, 0, 1);
        if (u >= 1) {
          if (!arrived[i]) {
            arrived[i] = true;
            o.onArrive?.(i, to);
          }
          continue;
        }
        const e = E.inOutQ(u);
        const p = cbez(o.from, curves[i].c1, curves[i].c2, to, e);
        const h = hist[i];
        h.unshift(p);
        if (h.length > 9) h.pop();
        for (let k = h.length - 1; k >= 1; k--) px.dot(h[k].x, h[k].y, k < 3 ? PAL.gold4 : k < 6 ? PAL.gold3 : PAL.gold2, 1 - k / h.length);
        star(px, p.x, p.y, 3.4 + (frame % 2), frame + i, 1, glow);
        if (dt > 0 && rr(0, 1) < 0.55) sp.add({ x: p.x + rr(-1, 1), y: p.y + rr(-1, 1), vx: rr(-8, 8), vy: rr(6, 22), life: rr(220, 380), colors: [PAL.white, PAL.gold4, PAL.cyan4, PAL.gold3], shape: 'px', flicker: true });
      }
    }).then(() => {
      for (let i = 0; i < n; i++) if (!arrived[i]) o.onArrive?.(i, to);
      px.g.destroy();
      glow.g.destroy();
      sp.release();
      if (!finished) {
        finished = true;
        resolve();
      }
    });
  });
}

/** Small pop when a sparkle lands (or splinters on a guard). */
function pop(scene: Phaser.Scene, at: XY, i: number, splinter: boolean, back: XY): void {
  const px = layer(scene, DEPTH.FX + 4, ADD);
  const sp = new Sparks(scene, DEPTH.FX + 5);
  void animate(scene, 180, (t) => {
    px.clear();
    if (t >= 1) return;
    const k = 1 - t;
    px.star(at.x + 0.5, at.y + 0.5, 3 + 8 * E.outQ(t), 1.4, PAL.gold4, k, (Math.PI / 4) * (i % 2));
    px.star(at.x + 0.5, at.y + 0.5, 2 + 4 * k, 1, PAL.white, k);
  }).then(() => px.g.destroy());
  for (let k = 0; k < 8; k++) {
    const a = splinter ? Math.atan2(back.y, back.x) + rr(-1, 1) : (k / 8) * Math.PI * 2;
    const v = splinter ? rr(60, 130) : rr(40, 90);
    sp.add({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (splinter ? 20 : 0), ay: splinter ? 260 : 0, drag: 5, life: rr(200, 320), colors: [PAL.white, PAL.gold4, PAL.gold3], shape: k % 2 ? 'star' : 'px', size: 2 });
  }
  sp.release();
}

async function lumenStrike(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const spr = u.sprite;
  const d = facing(u);
  reseed(u.uid * 53 + 5);
  u.rest();
  homeSprite(u);
  const home = { x: spr.x, y: spr.y };
  const target = s.target;
  const hitPt: XY = s.direct || !target ? s.to : target.core();
  try {
    // ---- pirouette inside a ring of light (anticipation)
    s.ctx.sfx('holyChime', { volume: 0.45, pitch: 0.9 });
    const ring = waistRing(u);
    const spin: [number, number][] = [
      [1, 70],
      [2, 60],
      [3, 60],
      [4, 60],
    ];
    let lift = 0;
    for (const [f, ms] of spin) {
      pose(u, 'roar', f);
      await animate(sc, ms, (t) => {
        lift = Math.min(4, lift + t);
        spr.y = Math.round(home.y - (f === 1 ? -1 : lift));
      });
    }
    // the ring folds into her hands, the orb swells
    pose(u, 'attack', 2);
    const hands = u.muzzle();
    void ring.stop({ x: hands.x - 4 * d, y: hands.y + 4 });
    s.ctx.sfx('summonCharge', { volume: 0.4, pitch: 1.6 });
    await sleep(sc, 70);
    pose(u, 'attack', 3);
    await animate(sc, 90, (t) => {
      spr.y = Math.round(home.y - 4 + t);
    });
    // ---- thrust + release
    pose(u, 'attack', 4);
    await sleep(sc, 70);
    void playFrom(u, 'attack', 5);
    s.ctx.sfx('holyChime', { volume: 0.7, pitch: 1.1 });
    const from = u.muzzle();
    const back = vnorm(vsub(from, hitPt));
    const ms = clamp(vlen(vsub(hitPt, from)) * 3, 300, 420);
    let impacted = false;
    await sparkleFlight(sc, {
      from,
      to: hitPt,
      ms,
      stagger: 70,
      bend: s.direct ? 36 : 28,
      stopShort: s.blocked ? 7 : 0,
      onArrive: (i, at) => {
        s.ctx.sfx('holyChime', { volume: 0.55, pitch: 1.25 + i * 0.18 });
        pop(sc, at, i, s.blocked, back);
        if (i === 2 && !impacted) {
          impacted = true;
          s.impact(impactPoint(s, hitPt));
          if (!s.blocked) lightBurst(sc, hitPt, s.direct ? 1.3 : 1);
        }
      },
    });
    if (!impacted) s.impact(impactPoint(s, hitPt));
    // settle back down
    const y0 = spr.y;
    await animate(sc, 160, (t) => {
      spr.y = Math.round(lerp(y0, home.y, E.outQ(t)));
    });
  } finally {
    homeSprite(u);
    if (!u.retired && spr.active && u.frameInfo().anim !== 'attack') u.rest();
  }
}

registerStrike('lumen_sprite', lumenStrike);

// ---------------------------------------------------------------- effect: +500 LP

registerCardHook('lumen_sprite', 'effect', async (ctx) => {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const run = fx.resolutionRun(ctx);
  const li = run.find((i) => {
    const e = ctx.events[i];
    return e.type === 'lpGain' && e.sourceUid === ev.uid;
  });
  const lEv = li !== undefined ? (ctx.events[li] as Extract<GameEvent, { type: 'lpGain' }>) : null;
  const u = ctx.unit(ev.uid);
  const player = lEv ? lEv.player : ev.player;
  const panel = fx.lpPoint(ctx, player);
  if (ctx.views.camera.isFocused) await ctx.unfocus(160);
  let healed: Promise<void> = Promise.resolve();
  const deliver = () => {
    if (li !== undefined && !ctx.isConsumed(li)) healed = ctx.play(li, { delivered: true });
  };
  if (!u || !u.sprite.visible) {
    // she is not on screen: just a sparkle stream from her zone
    const from = ev.zone !== null ? fx.zoneCenter(ev.player, 'monster', ev.zone) : { x: panel.x, y: panel.y - 60 };
    await rainToPanel(sc, { x: from.x, y: from.y - 20 }, panel, player, deliver);
    await healed;
    await fx.playRun(ctx, fx.resolutionRun(ctx));
    return;
  }
  reseed(u.uid * 17 + 3);
  const spr = u.sprite;
  // spin, then arms up in a V (roar f5: big star flash)
  ctx.sfx('holyChime', { volume: 0.5, pitch: 0.85 });
  const ring = waistRing(u);
  void u.play('roar');
  await u.playToFrame('roar', 5);
  void ring.stop();
  ctx.sfx('holyChime', { volume: 0.8, pitch: 1.2 });
  const hands = u.framePoint(24, 8);
  const c = u.core();
  // light column + fountain
  const col = layer(sc, spr.depth - 0.4, ADD);
  void animate(sc, 520, (t) => {
    col.clear();
    if (t >= 1) return;
    const w = 10 * (1 - E.inQ(t));
    const top = c.y - 70 * E.outC(Math.min(1, t * 3));
    col.rect(c.x - w / 2, top, w, u.home.y - top, PAL.gold3, 0.25 * (1 - t));
    col.rect(c.x - w / 4, top, w / 2, u.home.y - top, PAL.gold4, 0.35 * (1 - t));
  }).then(() => col.g.destroy());
  lightBurst(sc, hands, 0.8);
  await rainToPanel(sc, hands, panel, player, deliver);
  await healed;
  await fx.playRun(ctx, fx.resolutionRun(ctx));
});

/**
 * A fountain of sparkles shoots up from `from`, hangs twinkling, then rains in curves into the
 * LP panel at `to` (HUD layer). `onFirst` fires on the first arrival.
 */
async function rainToPanel(scene: Phaser.Scene, from: XY, to: XY, player: 0 | 1, onFirst: () => void): Promise<void> {
  const N = 9;
  const depth = DEPTH.HUD + 6;
  const px = layer(scene, depth);
  const trail = new Sparks(scene, depth - 0.5);
  const pops = new Sparks(scene, depth + 0.5);
  const peaks = Array.from({ length: N }, (_, i) => {
    const a = -Math.PI / 2 + (i - (N - 1) / 2) * 0.26 + rr(-0.06, 0.06);
    const r = rr(30, 48);
    return { x: from.x + Math.cos(a) * r * 0.8, y: from.y + Math.sin(a) * r };
  });
  const RISE = 240;
  const HANG = 120;
  const FLY = 420;
  const STAG = 40;
  const ctrls = peaks.map((p) => ({ x: lerp(p.x, to.x, 0.45) + rr(-22, 22), y: lerp(p.y, to.y, 0.2) - rr(10, 30) }));
  const dests = peaks.map(() => ({ x: to.x + rr(-14, 14), y: to.y + rr(-4, 4) }));
  const hist: XY[][] = peaks.map(() => []);
  const landed = peaks.map(() => false);
  let first = true;
  let frame = 0;
  const total = RISE + HANG + FLY + STAG * (N - 1);
  await animate(scene, total, (_t, el, dt) => {
    px.clear();
    if (dt > 0) frame++;
    for (let i = 0; i < N; i++) {
      const lt = el - i * (STAG * 0.4);
      let p: XY;
      if (lt < RISE) {
        const k = E.outC(clamp(lt / RISE, 0, 1));
        p = { x: lerp(from.x, peaks[i].x, k), y: lerp(from.y, peaks[i].y, k) };
      } else if (lt < RISE + HANG + i * STAG * 0.6) {
        const w = lt - RISE;
        p = { x: peaks[i].x + Math.sin(w * 0.02 + i) * 1.2, y: peaks[i].y + Math.sin(w * 0.015 + i) * 1.5 };
      } else {
        const ft = clamp((lt - RISE - HANG - i * STAG * 0.6) / FLY, 0, 1);
        if (ft >= 1) {
          if (!landed[i]) {
            landed[i] = true;
            for (let k = 0; k < 6; k++) {
              const a = (k / 6) * Math.PI * 2;
              pops.add({ x: dests[i].x, y: dests[i].y, vx: Math.cos(a) * 55, vy: Math.sin(a) * 55, drag: 5, life: 240, colors: [PAL.white, PAL.leaf4, PAL.gold4, PAL.leaf3], shape: k % 2 ? 'plus' : 'px', size: 1 });
            }
            if (first) {
              first = false;
              onFirst();
              void panelGlow(scene, player, [PAL.white, PAL.gold4, PAL.leaf3, PAL.leaf2]);
            }
          }
          continue;
        }
        const e = E.inQ(ft) * 0.6 + ft * 0.4;
        p = cbezQ(peaks[i], ctrls[i], dests[i], e);
      }
      const h = hist[i];
      h.unshift(p);
      if (h.length > 7) h.pop();
      for (let k = h.length - 1; k >= 1; k--) px.dot(h[k].x, h[k].y, k < 3 ? PAL.gold4 : PAL.leaf3, 1 - k / h.length);
      star(px, p.x, p.y, 2 + ((frame + i) % 2), frame + i);
      if (dt > 0 && rr(0, 1) < 0.35) trail.add({ x: p.x, y: p.y, vy: rr(-6, 10), life: rr(220, 380), colors: [PAL.white, PAL.gold4, PAL.leaf4, PAL.leaf3], shape: 'px', flicker: true });
    }
  });
  if (first) onFirst();
  px.g.destroy();
  trail.release();
  pops.release();
}

function cbezQ(a: XY, c: XY, b: XY, t: number): XY {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

// ---------------------------------------------------------------- death

registerCardHook('lumen_sprite', 'destroyed', (ctx) =>
  flavoredDeath(ctx, {
    async flavor(u, info) {
      const sc = ctx.scene;
      const spr = u.sprite;
      const sp = new Sparks(sc, DEPTH.FX + 1);
      pose(u, 'hit', 0);
      if (info.hit) await whiteFlash(sc, spr, 2);
      ctx.sfx('holyChime', { volume: 0.4, pitch: 0.6 });
      const y0 = spr.y;
      // her light gutters: flicker, sink toward the floor, motes fall away
      await animate(sc, 360, (t, el) => {
        spr.y = Math.round(y0 + u.hover * 0.6 * E.inQ(t));
        u.lift = 0;
        const on = Math.floor(el / 45) % 2 === 0 || t < 0.2;
        spr.setAlpha(on ? 1 : 0.45);
        if (t > 0.45) pose(u, 'hit', 1);
        if (rr(0, 1) < 0.5) {
          const c = u.core();
          sp.add({ x: c.x + rr(-8, 8), y: c.y + rr(-8, 8), vx: rr(-6, 6), vy: rr(10, 30), life: rr(300, 500), colors: [PAL.gold4, PAL.gold3, PAL.gold2], shape: 'px', flicker: true });
        }
      });
      spr.setAlpha(1);
      sp.release();
    },
    glitchMs: 110,
    onBurst(_u, at) {
      // tiny glints float up like fireflies
      const sp = new Sparks(ctx.scene, DEPTH.FX + 2);
      for (let i = 0; i < 14; i++) {
        sp.add({ x: at.x + rr(-10, 10), y: at.y + rr(-8, 8), vx: rr(-10, 10), vy: -rr(14, 36), drag: 0.6, life: rr(700, 1200), delay: rr(0, 300), colors: [PAL.white, PAL.gold4, PAL.cyan4, PAL.gold3], shape: i % 3 ? 'px' : 'plus', size: 1, flicker: true, fadeAt: 0.5 });
      }
      sp.release();
      ctx.sfx('holyChime', { volume: 0.35, pitch: 1.8 });
    },
  }),
);

