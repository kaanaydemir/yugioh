// Taş Muhafız — "Kaya Fırlatma" (GAME_DESIGN §7).
//
// Strike (≈1.3 s): the sprite's own throw is held frame by frame for weight —
//   f1 the free hand digs into the floor (crack, dirt, 1px thud) → f2 the boulder is RIPPED out
//   (clods fly, a crater stays) → f3/f4 hefted overhead and held, trembling, eye glint → f5 the
//   swing → f6 RELEASE: our boulder leaves the fingertips (muzzle) and lobs along a parabola,
//   spinning, shedding dirt, its shadow sliding over the floor → IMPACT on the target's core:
//   the rock bursts into chunks that bounce on the floor, a low dust cloud rolls out, the ground
//   cracks under the target. Blocked: the rock smashes on the guard and the chunks rebound.
//   Direct: the boulder lands on the duelist behind the back row.
// Death: cracks spread over the stone body, the rune and eye gutter out, chips fall, the titan
//   of stone sags — then it shatters with a heavy, downward burst and a dust cloud.

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { PixelCanvas, mulberry32 } from '../../art/pixel';
import { monsterFrame } from '../../art/textures';
import type { MonsterAnim } from '../../art/types';
import { DEPTH, type XY } from '../../view/layout';
import { shake } from '../../vfx/core';
import { whiteFlash } from '../../vfx/combat';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { registerCardHook, registerStrike } from '../api';
import {
  E,
  Sparks,
  animate,
  clamp,
  facing,
  flavoredDeath,
  glint,
  groundRing,
  homeSprite,
  layer,
  lerp,
  playFrom,
  pointAt,
  pose,
  reseed,
  rr,
  sleep,
  vlen,
  vnorm,
  vsub,
  type StrikeArgs,
} from './_kit';

const ROCK_KEY = 'sb:rock';
const ROCK_N = 8;
const ROCK_S = 17;
/** Frame points of the sentinel art (attack): the digging hand and the eye. */
const DIG = { x: 13, y: 57 };
const EYE = { x: 35, y: 20 };
const DIRT = [PAL.earth3, PAL.earth2, PAL.earth1] as const;
const DUST = [PAL.earth4, PAL.earth3, PAL.stone3, PAL.stone2] as const;

/** The thrown boulder: the sprite's own faceted, moss-capped rock, in 8 rotations. */
function ensureRock(scene: Phaser.Scene): string {
  if (scene.textures.exists(ROCK_KEY)) return ROCK_KEY;
  const base = new PixelCanvas(ROCK_S, ROCK_S);
  const cx = 8;
  const cy = 8;
  const R = [6.2, 5.6, 6.4, 5.8, 6.6, 5.9, 6.3, 5.5];
  const pts: [number, number][] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    pts.push([cx + 0.5 + Math.cos(a) * R[i], cy + 0.5 + Math.sin(a) * R[i] * 0.92]);
  }
  base.poly(pts, PAL.earth2);
  base.poly([[cx - 5, cy - 1], [cx - 3, cy - 5], [cx + 2, cy - 6], [cx + 1, cy - 2], [cx - 2, cy + 1]], PAL.earth3);
  base.set(cx - 3, cy - 4, PAL.earth4).set(cx - 2, cy - 5, PAL.earth4).set(cx - 4, cy - 2, PAL.earth4);
  base.poly([[cx + 6, cy], [cx + 4, cy + 4], [cx, cy + 6], [cx - 2, cy + 5], [cx + 2, cy + 2], [cx + 4, cy - 1]], PAL.earth1);
  base.set(cx + 1, cy - 1, PAL.earth1).set(cx + 2, cy, PAL.earth2);
  base.set(cx - 2, cy + 2, PAL.earth1).set(cx - 1, cy + 3, PAL.earth1);
  base.stamp(['.LM.', 'LMmM'], { L: PAL.leaf3, M: PAL.leaf2, m: PAL.leaf1 }, cx - 1, cy - 7);
  const sheet = new PixelCanvas(ROCK_S * ROCK_N, ROCK_S);
  for (let f = 0; f < ROCK_N; f++) {
    const a = (f / ROCK_N) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const q = new PixelCanvas(ROCK_S, ROCK_S);
    for (let y = 0; y < ROCK_S; y++)
      for (let x = 0; x < ROCK_S; x++) {
        // inverse rotation, nearest neighbour
        const dx = x + 0.5 - (cx + 0.5);
        const dy = y + 0.5 - (cy + 0.5);
        const sx = Math.floor(cx + 0.5 + dx * ca + dy * sa);
        const sy = Math.floor(cy + 0.5 - dx * sa + dy * ca);
        const c = base.get(sx, sy);
        if (c !== null) q.set(x, y, c);
      }
    q.outline(PAL.ink);
    sheet.blit(q, f * ROCK_S, 0);
  }
  const tex = scene.textures.addCanvas(ROCK_KEY, sheet.toCanvas())!;
  for (let f = 0; f < ROCK_N; f++) tex.add(f, 0, f * ROCK_S, 0, ROCK_S, ROCK_S);
  return ROCK_KEY;
}

/** Cracks radiating on the floor (fading). */
function floorCracks(scene: Phaser.Scene, x: number, y: number, o: { n?: number; len?: number; ms?: number; seed?: number } = {}): Promise<void> {
  const rnd = mulberry32(o.seed ?? 7);
  const n = o.n ?? 6;
  const paths: XY[][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.6;
    const L = (o.len ?? 16) * (0.6 + rnd() * 0.6);
    const pts: XY[] = [{ x, y }];
    let px = x;
    let py = y;
    const steps = 4;
    for (let k = 1; k <= steps; k++) {
      const aa = a + (rnd() - 0.5) * 0.9;
      px += (Math.cos(aa) * L) / steps;
      py += (Math.sin(aa) * L * 0.5) / steps;
      pts.push({ x: px, y: py });
    }
    paths.push(pts);
  }
  const px = layer(scene, DEPTH.TILE_FX + 5);
  const ms = o.ms ?? 700;
  return animate(scene, ms, (t) => {
    px.clear();
    if (t >= 1) return;
    const grow = E.outC(clamp(t / 0.15, 0, 1));
    const a = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    for (const p of paths) {
      const n2 = Math.max(2, Math.ceil(p.length * grow));
      for (let i = 1; i < n2; i++) {
        px.line(p[i - 1].x, p[i - 1].y + 1, p[i].x, p[i].y + 1, PAL.earth3, 0.6 * a);
        px.line(p[i - 1].x, p[i - 1].y, p[i].x, p[i].y, PAL.ink, a);
      }
    }
    px.ellipse(x, y, 5, 2.5, PAL.ink, 0.6 * a);
  }).then(() => px.g.destroy());
}

/** Rock bursts at `at`: chunks with gravity bouncing on `floor`, pebbles, a low dust cloud. */
function rockBurst(scene: Phaser.Scene, at: XY, floor: number, dir: XY, o: { big?: number; rebound?: boolean } = {}): void {
  const k = o.big ?? 1;
  const sp = new Sparks(scene, DEPTH.FX + 2);
  const dust = new Sparks(scene, DEPTH.FX + 1);
  const base = Math.atan2(dir.y, dir.x) + (o.rebound ? Math.PI : 0);
  // big chunks (lit facet first so they read on the dark floor)
  for (let i = 0; i < 9 * k; i++) {
    const a = base + rr(-1.4, 1.4);
    const v = rr(60, 150);
    sp.add({ x: at.x + rr(-3, 3), y: at.y + rr(-3, 3), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - rr(60, 130), ay: 520, rot: rr(0, 6), vrot: rr(-14, 14), life: rr(520, 820), colors: [PAL.white, PAL.earth4, PAL.earth3, PAL.earth3, PAL.earth2], shape: 'shard', size: rr(3, 4.6), floor: floor + rr(-2, 3), bounce: 0.35, fadeAt: 0.8 });
  }
  for (let i = 0; i < 2; i++) {
    const a = base + rr(-1, 1);
    sp.add({ x: at.x, y: at.y - 2, vx: Math.cos(a) * rr(40, 90), vy: -rr(80, 140), ay: 520, rot: rr(0, 6), vrot: rr(-10, 10), life: rr(600, 800), colors: [PAL.leaf4, PAL.leaf3, PAL.leaf2], shape: 'shard', size: 2.5, floor: floor + 2, bounce: 0.3 });
  }
  for (let i = 0; i < 16 * k; i++) {
    const a = rr(0, Math.PI * 2);
    const v = rr(60, 170);
    sp.add({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 - 70, ay: 600, life: rr(300, 560), colors: [PAL.earth4, PAL.earth3, PAL.earth2], shape: i % 3 ? 'px' : 'sq', size: 2, floor: floor + rr(-2, 4), bounce: 0.25 });
  }
  // the dust cloud rolls out low along the floor, then lifts
  for (let i = 0; i < 8 * k; i++) {
    const a = rr(0, Math.PI * 2);
    const r = rr(3, 9);
    dust.add({ x: at.x + Math.cos(a) * r, y: floor - 2 + Math.sin(a) * r * 0.4, vx: Math.cos(a) * rr(30, 60), vy: Math.sin(a) * rr(6, 14) - rr(4, 12), drag: 2.4, life: rr(550, 800), colors: DUST, shape: 'puff', size: rr(2.2, 3.6), grow: 6, alpha: 0.55, delay: rr(20, 90) });
  }
  sp.release();
  dust.release();
}

async function sentinelStrike(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const spr = u.sprite;
  const d = facing(u);
  reseed(u.uid * 131 + 11);
  u.rest();
  homeSprite(u);
  const key = ensureRock(sc);
  const home = { x: spr.x, y: spr.y };
  const sp = new Sparks(sc, DEPTH.FX + 1);
  const floorSp = new Sparks(sc, DEPTH.TILE_FX + 6);
  const target = s.target;
  const hitPt: XY = s.direct || !target ? s.to : target.core();
  try {
    // ---- f1: the hand digs into the floor
    pose(u, 'attack', 1);
    const dig = pointAt(u, DIG.x, DIG.y, home);
    s.ctx.sfx('groundCrack', { volume: 0.45, pitch: 1.3 });
    void shake(sc, 90, 1);
    void floorCracks(sc, dig.x, dig.y + 1, { n: 5, len: 10, ms: 900, seed: u.uid });
    for (let i = 0; i < 8; i++) floorSp.add({ x: dig.x + rr(-3, 3), y: dig.y, vx: rr(-40, 40), vy: -rr(30, 80), ay: 420, life: rr(260, 420), colors: DIRT, shape: i % 3 ? 'px' : 'sq', size: 1, floor: dig.y + 2, bounce: 0.3 });
    await sleep(sc, 110);
    // ---- f2: RIP the boulder out
    pose(u, 'attack', 2);
    s.ctx.sfx('earthQuake', { volume: 0.5, pitch: 1.2 });
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + rr(-1.1, 1.1);
      sp.add({ x: dig.x + rr(-3, 3), y: dig.y - 4, vx: Math.cos(a) * rr(30, 90), vy: Math.sin(a) * rr(60, 130), ay: 520, rot: rr(0, 6), vrot: rr(-12, 12), life: rr(360, 560), colors: DIRT, shape: i % 2 ? 'shard' : 'sq', size: rr(1.5, 2.5), floor: dig.y + 2, bounce: 0.3 });
    }
    for (let i = 0; i < 4; i++) floorSp.add({ x: dig.x + rr(-5, 5), y: dig.y, vx: rr(-16, 16), vy: -rr(4, 12), drag: 2, life: rr(400, 600), colors: DUST, shape: 'puff', size: rr(2, 3), grow: 5, alpha: 0.6 });
    await sleep(sc, 110);
    // ---- f3/f4: hefted overhead — hold, tremble, eye glint (anticipation)
    pose(u, 'attack', 3);
    await sleep(sc, 90);
    pose(u, 'attack', 4);
    const eye = u.framePoint(EYE.x, EYE.y);
    void glint(sc, eye.x, eye.y, { size: 6, ms: 240, color: PAL.gold4 });
    s.ctx.sfx('summonCharge', { volume: 0.35, pitch: 0.7 });
    await animate(sc, 150, (t, el) => {
      spr.x = home.x + (Math.floor(el / 34) % 2 ? 1 : 0);
      spr.setScale(1 + 0.03 * Math.sin(Math.PI * t), 1 - 0.03 * Math.sin(Math.PI * t));
    });
    spr.setPosition(home.x, home.y).setScale(1);
    // ---- f5: the swing
    pose(u, 'attack', 5);
    s.ctx.sfx('whoosh', { volume: 0.8, pitch: 0.7 });
    await sleep(sc, 80);
    // ---- f6: RELEASE
    void playFrom(u, 'attack', 6);
    const release = u.muzzle();
    const from = { x: release.x + 3 * d, y: release.y - 1 };
    const dir = vnorm(vsub(hitPt, from));
    const stopAt = s.blocked ? { x: hitPt.x - dir.x * 6, y: hitPt.y - dir.y * 6 } : hitPt;
    const dist = vlen(vsub(stopAt, from));
    const ms = clamp(dist * 4, 380, 560);
    const arc = clamp(dist * 0.42, 26, 56);
    // shadow from the thrower's front to the target's floor
    const g0 = { x: u.home.x + 10 * d, y: u.home.y };
    const g1 = s.direct ? s.toGround : target ? { x: target.home.x - dir.x * 6, y: target.home.y } : s.toGround;
    for (let i = 0; i < 6; i++) sp.add({ x: from.x, y: from.y, vx: d * rr(30, 80), vy: -rr(10, 60), ay: 400, life: rr(260, 420), colors: DIRT, shape: 'sq', size: 1 });
    const rock = sc.add.image(from.x, from.y, key, 0).setDepth(DEPTH.FX - 4);
    const shadow = layer(sc, DEPTH.SHADOW + 0.5);
    s.ctx.sfx('whoosh', { volume: 0.6, pitch: 0.55 });
    await animate(sc, ms, (t, el, dt) => {
      const p = { x: lerp(from.x, stopAt.x, t), y: lerp(from.y, stopAt.y, t) - arc * 4 * t * (1 - t) };
      rock.setPosition(Math.round(p.x), Math.round(p.y));
      const f = Math.floor(el / 55) % ROCK_N;
      rock.setFrame(d > 0 ? f : (ROCK_N - f) % ROCK_N);
      const gp = { x: lerp(g0.x, g1.x, t), y: lerp(g0.y, g1.y, t) };
      const h = Math.max(0, gp.y - p.y);
      const r = clamp(7 - h / 10, 3, 7);
      shadow.clear();
      shadow.ellipse(gp.x, gp.y, r, r * 0.45, PAL.ink, clamp(0.55 - h / 160, 0.2, 0.55));
      if (dt > 0 && rr(0, 1) < 0.6) sp.add({ x: p.x + rr(-4, 4), y: p.y + rr(-3, 4), vx: rr(-10, 10), vy: rr(0, 20), ay: 300, life: rr(220, 380), colors: DIRT, shape: 'px' });
    });
    rock.destroy();
    shadow.g.destroy();
    // ---- IMPACT
    s.impact(hitPt);
    s.ctx.sfx('earthQuake', { volume: 0.9 });
    const floorY = s.direct ? s.toGround.y : target ? target.home.y : s.toGround.y;
    rockBurst(sc, stopAt, floorY + 2, dir, { big: s.direct ? 1.2 : 1, rebound: s.blocked });
    if (!s.blocked) {
      void floorCracks(sc, s.toGround.x, s.toGround.y + 1, { n: 7, len: 20, ms: 900, seed: u.uid + 3 });
      void groundRing(sc, s.toGround.x, s.toGround.y, { r0: 8, r1: 38, ms: 420, colors: [PAL.earth4, PAL.earth3, PAL.earth2] });
    }
    // follow-through (f7–f9 play on), a settle
    await sleep(sc, 320);
  } finally {
    sp.release();
    floorSp.release();
    homeSprite(u);
    if (!u.retired && spr.active && u.frameInfo().anim !== 'attack') u.rest();
  }
}

registerStrike('stone_sentinel', sentinelStrike);

// ---------------------------------------------------------------- death

/** Cracks spreading over the unit's own pixels (only drawn where the sprite is opaque). */
function bodyCracks(u: MonsterUnit, ms: number): { stop(): void } {
  const sc = u.scene;
  const spr = u.sprite;
  const d = facing(u);
  const rnd = mulberry32(u.uid * 7 + 1);
  const [anim, f] = String(spr.frame.name).split(':');
  const pc = monsterFrame(u.cardId, (anim as MonsterAnim) || 'idle', Number(f) || 0);
  const art = u.art;
  const paths: XY[][] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rnd() * 0.8;
    const pts: XY[] = [{ x: art.core.x + (rnd() - 0.5) * 6, y: art.core.y + (rnd() - 0.5) * 8 }];
    for (let k = 0; k < 6; k++) {
      const last = pts[pts.length - 1];
      const aa = a + (rnd() - 0.5) * 1.2;
      pts.push({ x: last.x + Math.cos(aa) * 4, y: last.y + Math.sin(aa) * 4 });
    }
    paths.push(pts);
  }
  const px = layer(sc, spr.depth + 0.2);
  let alive = true;
  let el = 0;
  const upd = (_t: number, delta: number) => {
    if (!alive || !spr.active) return;
    el += Math.min(50, delta) * sc.tweens.timeScale;
    const t = clamp(el / ms, 0, 1);
    px.clear();
    px.g.setDepth(spr.depth + 0.2);
    for (const p of paths) {
      const n = Math.max(1, Math.floor((p.length - 1) * E.outQ(t)));
      for (let i = 1; i <= n; i++) {
        const a = p[i - 1];
        const b = p[i];
        const steps = Math.ceil(vlen(vsub(b, a)));
        for (let s2 = 0; s2 <= steps; s2++) {
          const fx = Math.round(lerp(a.x, b.x, s2 / steps));
          const fy = Math.round(lerp(a.y, b.y, s2 / steps));
          if (!pc.isOpaque(fx, fy)) continue;
          const wx = spr.x + (fx - art.anchorX) * d;
          const wy = spr.y + (fy - art.anchorY);
          px.dot(wx, wy, PAL.ink, 1);
          if (pc.isOpaque(fx, fy - 1)) px.dot(wx, wy - 1, t > 0.7 && Math.floor(el / 60) % 2 ? PAL.gold3 : PAL.stone4, 0.8);
        }
      }
    }
  };
  sc.events.on('postupdate', upd);
  return {
    stop() {
      alive = false;
      sc.events.off('postupdate', upd);
      px.g.destroy();
    },
  };
}

registerCardHook('stone_sentinel', 'destroyed', (ctx) =>
  flavoredDeath(ctx, {
    async flavor(u, info) {
      const sc = ctx.scene;
      const spr = u.sprite;
      const sp = new Sparks(sc, DEPTH.FX + 1);
      if (info.hit) {
        pose(u, 'hit', 0);
        await whiteFlash(sc, spr, 2);
      } else pose(u, u.position === 'defense' ? 'guard' : 'idle', 0);
      ctx.sfx('groundCrack', { volume: 0.8, pitch: 0.8 });
      const cr = bodyCracks(u, 330);
      // the rune / eye gutter out: the stone darkens in steps
      const y0 = spr.y;
      await animate(sc, 420, (t, el) => {
        const k = Math.floor(t * 4) / 4;
        const c = Math.round(255 - 70 * k);
        spr.setTint((c << 16) | (c << 8) | Math.min(255, c + 10));
        spr.y = Math.round(y0 + 2 * E.inQ(t));
        spr.x = Math.round(u.rest0.x + (t > 0.5 && Math.floor(el / 40) % 2 ? 1 : 0));
        if (rr(0, 1) < 0.25) {
          const b = u.core();
          sp.add({ x: b.x + rr(-10, 10), y: b.y + rr(-14, 10), vx: rr(-15, 15), vy: rr(-10, 10), ay: 420, rot: rr(0, 6), vrot: rr(-8, 8), life: rr(300, 500), colors: [PAL.stone3, PAL.stone2, PAL.stone1], shape: 'shard', size: rr(1.5, 2.5), floor: u.home.y + 2, bounce: 0.3 });
        }
      });
      cr.stop();
      sp.release();
      void shake(sc, 160, 1.5);
    },
    glitchMs: 80,
    push: () => ({ x: 0, y: 1.4 }),
    onBurst(u, at) {
      ctx.sfx('earthQuake', { volume: 0.7, pitch: 0.8 });
      rockBurst(ctx.scene, { x: at.x, y: at.y + 6 }, u.home.y + 2, { x: 0, y: 1 }, { big: 0.8 });
      void floorCracks(ctx.scene, u.home.x, u.home.y + 1, { n: 6, len: 18, ms: 900, seed: u.uid });
    },
  }),
);
