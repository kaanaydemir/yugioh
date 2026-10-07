// Kristal Ejder — "Prizma Nefesi" (GAME_DESIGN §7) + crystal-shard impact + the ace's death.
//
// Strike (≈1.25 s): the head rears back while white-blue motes stream up from a glowing floor
// ring into the mouth (500 ms, tracked frame by frame with CRYSTAL_WYRM_MOUTH), the jaw snaps
// open on frame 5 and a thick prism beam (white core, cyan edges, rainbow fringe) fires; the body
// kicks back with the recoil. Impact: hit-stop + crystal shards + prism ring + light rays + a
// screen-wide glare. Blocked: the beam splinters off the shield into rainbow ricochets.
// Death: the dragon freezes in its recoil, glowing cracks race through its crystal body, light
// bursts out of them, time slows, and it shatters into glass and pixels.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import * as wyrmArt from '../../art/monsters/crystal_wyrm';
import { PixelCanvas, mulberry32 } from '../../art/pixel';
import { DEPTH, type XY } from '../../view/layout';
import { beam } from '../../vfx/combat';
import { registerCardHook, registerStrike } from '../api';
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
  currentPixels,
  flavoredDeath,
  glow,
  glowPulse,
  holdFrame,
  layer,
  len,
  lerp,
  norm,
  onFrame,
  overlay,
  pick,
  playSfx,
  screenFlash,
  seed,
  shatterPx,
  sleep,
  sub,
  whiteFlash,
} from './_kit';

const MOUTH: { x: number; y: number }[] | undefined = (wyrmArt as unknown as { CRYSTAL_WYRM_MOUTH?: { x: number; y: number }[] }).CRYSTAL_WYRM_MOUTH;
const RAINBOW = [PAL.crim3, PAL.fire3, PAL.gold3, PAL.leaf3, PAL.teal3, PAL.cyan3, PAL.water3, PAL.void3, PAL.mag3] as const;
const GLASS = [PAL.white, PAL.cyan4, PAL.cyan3, PAL.cyan2] as const;
const WYRM_RAMP = [PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white] as const;

/** Live mouth point (per-frame table during 'attack'). */
function mouthOf(u: MonsterUnit): () => XY {
  return () => {
    const fi = u.frameInfo();
    const m = MOUTH && fi.anim === 'attack' && MOUTH[fi.frame] ? MOUTH[fi.frame] : u.art.muzzle;
    return u.framePoint(m.x, m.y);
  };
}

// ================================================================ charge: floor glow + rising motes

function chargeFx(s: StrikeArgs, ms: number, mouth: () => XY): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const home = u.home;
  const floor = layer(sc, DEPTH.TILE_FX + 5, ADD);
  const motes = new Sparks(sc, u.sprite.depth + 0.4);
  const halo = glow(sc, home.x, home.y - 2, PAL.cyan3, 0.2, 0, DEPTH.TILE_FX + 4);
  halo.setScale(0.9, 0.4);
  return new Promise((resolve) => {
    onFrame(
      sc,
      (dt, el) => {
        const t = clamp(el / ms, 0, 1);
        floor.clear();
        if (t >= 1) return false;
        const k = E.outQ(t);
        // a rune ring of prism light on the floor, closing in
        const rx = 30 - 8 * k;
        const ry = rx * 0.45;
        floor.ellipseRing(home.x, home.y, rx, ry, 1, PAL.cyan2, 0.5 + 0.4 * k);
        for (let i = 0; i < 14; i++) {
          const a = el * 0.004 + (i / 14) * TAU;
          floor.dot(home.x + Math.cos(a) * rx, home.y + Math.sin(a) * ry, i % 3 === 0 ? PAL.white : RAINBOW[i % RAINBOW.length], 0.9);
        }
        floor.ellipse(home.x, home.y, rx * 0.55 * k, ry * 0.55 * k, PAL.cyan1, 0.5 * k);
        halo.setAlpha(0.55 * k).setScale(0.9 + 0.5 * k, 0.4 + 0.2 * k);
        // white-blue motes leave the floor and stream into the mouth
        if (dt > 0) {
          const m = mouth();
          const n = (dt / 16.7) * (1 + 2.5 * k);
          for (let i = 0; i < n; i++) {
            const a = RR(0, TAU);
            motes.add({ x: home.x + Math.cos(a) * rx, y: home.y + Math.sin(a) * ry, tx: m.x, ty: m.y, curl: RR(-14, 14), life: RR(220, 380), colors: [PAL.cyan3, PAL.cyan4, PAL.white], shape: R3() ? 'plus' : 'px', size: 1, fadeAt: 1 });
          }
        }
        return true;
      },
      () => {
        floor.g.destroy();
        motes.release();
        void animate(sc, 180, (t) => halo.setAlpha(0.55 * (1 - t))).then(() => halo.destroy());
        resolve();
      },
    );
  });
}

let r3 = 0;
function R3(): boolean {
  return ++r3 % 3 === 0;
}

// ================================================================ impact: crystal explosion

interface Crystal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  l: number;
  w: number;
  age: number;
  life: number;
  floor: number;
  c: number;
}

/** Crystal shards (faceted rhombi), a prism ring, light rays and a screen-wide glare. */
export function crystalBurst(scene: Phaser.Scene, at: XY, o: { dir?: XY; floor: number; power?: number; glare?: boolean; count?: number }): Promise<void> {
  const power = o.power ?? 3;
  const px = layer(scene, DEPTH.FX + 3);
  const rays = layer(scene, DEPTH.FX + 2, ADD);
  const dir = o.dir ? norm(o.dir) : { x: 0, y: -1 };
  const base = Math.atan2(dir.y, dir.x);
  const list: Crystal[] = [];
  const n = o.count ?? 10 + power * 5;
  for (let i = 0; i < n; i++) {
    const a = base + RR(-1.6, 1.6) + (i % 4 === 0 ? Math.PI : 0) * 0.6;
    const v = RR(70, 170 + power * 25);
    list.push({ x: at.x + RR(-3, 3), y: at.y + RR(-3, 3), vx: Math.cos(a) * v, vy: Math.sin(a) * v - RR(40, 110), rot: RR(0, TAU), vr: RR(-14, 14), l: RR(3, 6.5), w: RR(1.4, 2.6), age: 0, life: RR(520, 900), floor: o.floor + RR(-4, 6), c: pick([PAL.cyan2, PAL.cyan3, PAL.cyan3, PAL.mist]) });
  }
  const sparkle = new Sparks(scene, DEPTH.FX + 3.5, ADD);
  for (let i = 0; i < 16; i++) {
    const a = RR(0, TAU);
    sparkle.add({ x: at.x, y: at.y, vx: Math.cos(a) * RR(20, 90), vy: Math.sin(a) * RR(20, 70) - 20, drag: 2.2, life: RR(400, 800), colors: [PAL.white, PAL.cyan4, pick(RAINBOW)], shape: i % 3 === 0 ? 'star' : 'plus', size: i % 3 === 0 ? 2 : 1, flicker: true });
  }
  sparkle.release();
  if (o.glare !== false) {
    void screenFlash(scene, PAL.cyan4, 0.24 + 0.05 * power, 200);
    void glowPulse(scene, at.x, at.y, PAL.white, { from: 0.8, to: 3.2, alpha: 0.9, ms: 320, depth: DEPTH.FX + 1 });
  }
  playSfx('shatter', { volume: 0.55, pitch: 1.9 });
  playSfx('holyChime', { volume: 0.35, pitch: 1.5 });
  const rayAngles = Array.from({ length: 9 }, (_, i) => (i / 9) * TAU + RR(-0.15, 0.15));
  return new Promise((resolve) => {
    onFrame(
      scene,
      (dt, el) => {
        const s = dt / 1000;
        px.clear();
        rays.clear();
        // light rays + prism ring (first 260 ms)
        if (el < 260 && o.glare !== false) {
          const t = el / 260;
          for (let i = 0; i < rayAngles.length; i++) {
            const a = rayAngles[i] + t * 0.25;
            const r0 = 6 + 10 * t;
            const r1 = 30 + 70 * E.outQ(t) * (i % 2 ? 0.7 : 1);
            rays.seg(at.x + Math.cos(a) * r0, at.y + Math.sin(a) * r0 * 0.8, at.x + Math.cos(a) * r1, at.y + Math.sin(a) * r1 * 0.8, i % 2 ? 1 : 2, i % 3 === 0 ? PAL.white : PAL.cyan3, 1 - t);
          }
        }
        if (el < 420) {
          const t = el / 420;
          const rr = 6 + 38 * E.outC(t);
          for (let k = 0; k < 36; k++) {
            const a = (k / 36) * TAU;
            px.dot(at.x + Math.cos(a) * rr, at.y + Math.sin(a) * rr * 0.75, RAINBOW[(k + Math.floor(el / 40)) % RAINBOW.length], 1 - t);
          }
          if (t < 0.4) px.ellipseRing(at.x, at.y, rr * 0.7, rr * 0.52, 1, PAL.white, 1 - t / 0.4);
        }
        let alive = 0;
        for (const c of list) {
          if (c.age >= c.life) continue;
          alive++;
          c.age += dt;
          c.vy += 520 * s;
          c.vx *= Math.exp(-1.1 * s);
          c.x += c.vx * s;
          c.y += c.vy * s;
          c.rot += c.vr * s;
          if (c.y > c.floor && c.vy > 0) {
            c.y = c.floor;
            c.vy *= -0.32;
            c.vx *= 0.55;
            c.vr *= 0.4;
          }
          const t = c.age / c.life;
          const a = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
          if (t > 0.8 && Math.floor(c.age / 45) % 2 === 0) continue;
          const ca = Math.cos(c.rot);
          const sa = Math.sin(c.rot);
          const tip = { x: c.x + ca * c.l, y: c.y + sa * c.l };
          const tail = { x: c.x - ca * c.l * 0.6, y: c.y - sa * c.l * 0.6 };
          const side1 = { x: c.x - sa * c.w, y: c.y + ca * c.w };
          const side2 = { x: c.x + sa * c.w, y: c.y - ca * c.w };
          const fresh = c.age < 70;
          px.poly([tip.x, tip.y, side1.x, side1.y, tail.x, tail.y, side2.x, side2.y], fresh ? PAL.white : c.c, a);
          px.poly([tip.x, tip.y, side1.x, side1.y, c.x, c.y], fresh ? PAL.white : PAL.cyan4, a);
          px.dot(tip.x, tip.y, PAL.white, a);
        }
        return alive > 0 || el < 420;
      },
      () => {
        px.g.destroy();
        rays.g.destroy();
        resolve();
      },
    );
  });
}

/** Blocked beam: the prism splinters off the shield into rainbow ricochets. */
function prismScatter(scene: Phaser.Scene, at: XY, from: XY): void {
  const px = layer(scene, DEPTH.FX + 2, ADD);
  const back = norm(sub(from, at));
  const rays = Array.from({ length: 5 }, (_, i) => {
    const a = Math.atan2(back.y, back.x) + (i - 2) * 0.55 + RR(-0.15, 0.15) + (i % 2 ? Math.PI * 0.5 : -Math.PI * 0.5) * 0.6;
    return { a, l: RR(28, 52), c: RAINBOW[(i * 2) % RAINBOW.length] };
  });
  void animate(scene, 260, (t) => {
    px.clear();
    for (const r of rays) {
      const head = r.l * E.outQ(Math.min(1, t * 1.8));
      const tail = r.l * E.inQ(Math.max(0, (t - 0.3) / 0.7));
      const x0 = at.x + Math.cos(r.a) * tail;
      const y0 = at.y + Math.sin(r.a) * tail;
      const x1 = at.x + Math.cos(r.a) * head;
      const y1 = at.y + Math.sin(r.a) * head;
      px.seg(x0, y0, x1, y1, 2, r.c, 1 - t * 0.5);
      px.line(x0, y0, x1, y1, PAL.white, 1 - t);
    }
  }).then(() => px.g.destroy());
}

// ================================================================ strike

registerStrike('crystal_wyrm', async (s) => {
  const u = s.attacker;
  const sc = s.scene;
  seed(u.uid * 97 + (s.target?.uid ?? 3));
  const mouth = mouthOf(u);
  const charge = u.impactMs; // 500 ms: frames 0–4, the jaw opens on frame 5
  const spr = u.sprite;
  const sgn = u.flipX ? -1 : 1;
  const rest = { x: spr.x, y: spr.y };
  const from = mouth();
  const aimDir = norm(sub(s.to, from));
  // blocked: the beam stops on the shield plane in front of the target
  const to: XY = s.blocked ? { x: s.to.x - aimDir.x * 9, y: s.to.y - aimDir.y * 9 } : s.to;
  void u.play('attack');
  // camera: hold on the dragon's head while it gathers light
  const head = from;
  void s.ctx.focus({ x: lerp(head.x, to.x, 0.3), y: lerp(head.y, to.y, 0.3) - 6 }, { zoom: 1.06, ms: 320, pan: 0.32 });
  void chargeFx(s, charge, mouth);
  // rear back (stretch) during the charge
  void animate(sc, charge, (t) => {
    if (!spr.active) return;
    const k = E.outQ(t);
    spr.setPosition(Math.round(rest.x - sgn * 2 * k), Math.round(rest.y - 1 * k));
    spr.setScale(1 - 0.02 * k, 1 + 0.04 * k);
  });
  await beam(sc, mouth, to, 'prism', {
    chargeMs: charge,
    width: 13,
    fireMs: s.blocked ? 320 : 460,
    onFire: () => {
      playSfx('roarBig', { volume: 0.35, pitch: 1.3 });
      // recoil: the whole body kicks back, squashes
      void animate(sc, 360, (t) => {
        if (!spr.active) return;
        const k = t < 0.15 ? t / 0.15 : 1 - E.inOutQ((t - 0.15) / 0.85);
        spr.setPosition(Math.round(rest.x - sgn * (2 + 3 * k)), Math.round(rest.y - 1 + k));
        spr.setScale(1 + 0.05 * k, 1 - 0.04 * k + 0.04 * (1 - k));
      });
      void s.ctx.focus({ x: lerp(head.x, to.x, 0.6), y: lerp(head.y, to.y, 0.6) }, { zoom: 1.08, ms: 140, pan: 0.36 });
    },
    onImpact: () => {
      s.impact(to);
      const floorY = s.target ? s.target.home.y : s.toGround.y;
      if (s.blocked) {
        prismScatter(sc, to, from);
        void crystalBurst(sc, to, { dir: { x: -aimDir.x, y: -aimDir.y }, floor: floorY, power: 1, glare: false, count: 6 });
      } else {
        void crystalBurst(sc, to, { dir: aimDir, floor: floorY, power: s.power });
      }
    },
  });
  if (spr.active) {
    spr.setPosition(rest.x, rest.y).setScale(1);
    if (u.frameInfo().anim !== 'attack') u.rest();
  }
});

// ================================================================ death: the crystals crack

/** Crack paths through the opaque pixels of a frame, branching out from `start`. */
function crackPaths(pc: PixelCanvas, start: XY, n: number, rnd: () => number): XY[][] {
  const paths: XY[][] = [];
  const queue: { p: XY; a: number; life: number }[] = [];
  for (let k = 0; k < n; k++) queue.push({ p: { ...start }, a: (k / n) * TAU + (rnd() - 0.5) * 0.6, life: 30 + rnd() * 22 });
  let guard = 0;
  while (queue.length && guard++ < 40) {
    const q = queue.shift()!;
    const path: XY[] = [];
    let { x, y } = q.p;
    let a = q.a;
    for (let i = 0; i < q.life; i++) {
      a += (rnd() - 0.5) * 0.9;
      x += Math.cos(a) * 1.1;
      y += Math.sin(a) * 1.1;
      const rx = Math.round(x);
      const ry = Math.round(y);
      if (!pc.isOpaque(rx, ry)) break;
      const last = path[path.length - 1];
      if (!last || last.x !== rx || last.y !== ry) path.push({ x: rx, y: ry });
      if (i > 4 && rnd() < 0.07 && queue.length < 20) queue.push({ p: { x: rx, y: ry }, a: a + (rnd() < 0.5 ? 0.9 : -0.9), life: q.life * 0.5 });
    }
    if (path.length > 2) paths.push(path);
  }
  return paths;
}

registerCardHook('crystal_wyrm', 'destroyed', (ctx) =>
  flavoredDeath(ctx, async (d) => {
    const u = d.unit;
    const sc = ctx.scene;
    seed(u.uid * 31 + 5);
    if (d.hit) {
      void u.play('hit', { hold: true });
      await whiteFlash(sc, u.sprite, 2);
    }
    await sleep(sc, 50);
    holdFrame(u, 'hit', 1);
    const { pc } = currentPixels(u);
    const crackPc = new PixelCanvas(pc.w, pc.h);
    const rnd = mulberry32(u.uid * 7 + 11);
    const core = u.art.core;
    // fissures start at the chest, the neck and the wing root and run through the whole body
    const paths = [
      ...crackPaths(pc, { x: core.x, y: core.y - 4 }, 6, rnd),
      ...crackPaths(pc, { x: core.x + 14, y: core.y - 22 }, 4, rnd),
      ...crackPaths(pc, { x: core.x - 16, y: core.y - 26 }, 4, rnd),
    ];
    const ov = overlay(u, crackPc);
    const glowPc = new PixelCanvas(pc.w, pc.h);
    const ovGlow = overlay(u, glowPc, { blend: ADD, depth: u.sprite.depth + 0.25 });
    const leak = glow(sc, u.core().x, u.core().y, PAL.cyan3, 0.6, 0, u.sprite.depth + 0.3);
    // cracks race out from the chest (≈300 ms): dark fissures with a cyan glow, each step a
    // glassy tick and a 1 px jolt
    const CRACK = 300;
    let ticks = 0;
    const drawCracks = (g: number, hotAll: boolean) => {
      crackPc.clear();
      glowPc.clear();
      for (const p of paths) {
        const n = Math.max(1, Math.round(p.length * g));
        for (let i = 0; i < n; i++) {
          const q = p[i];
          const tip = i > n - 3;
          crackPc.set(q.x, q.y, hotAll || tip ? PAL.white : PAL.night1);
          if (!hotAll && pc.isOpaque(q.x, q.y + 1) && (i & 1) === 0) crackPc.set(q.x, q.y + 1, PAL.cyan2);
          if ((i & 1) === 1) glowPc.set(q.x, q.y - 1, PAL.cyan1);
        }
      }
      ov.redraw(crackPc);
      ovGlow.redraw(glowPc);
    };
    await animate(sc, CRACK, (t, el) => {
      drawCracks(E.outQ(t), false);
      leak.setAlpha(0.25 + 0.5 * t + (Math.floor(el / 60) % 2) * 0.12).setScale(0.6 + 0.9 * t);
      const k = Math.floor(t * 4);
      if (k > ticks) {
        ticks = k;
        playSfx('shatter', { volume: 0.25, pitch: 1.3 + k * 0.12 });
        if (u.sprite.active) u.sprite.x += k % 2 ? 1 : -1;
      }
    });
    drawCracks(1, true);
    // light bursts out through the cracks — the ace's last moment in slow motion
    ctx.views.speed.slowMo(0.55, 380);
    const rays = layer(sc, u.sprite.depth + 0.35, ADD);
    const c = u.core();
    const rayA = Array.from({ length: 10 }, (_, i) => (i / 10) * TAU + RR(-0.2, 0.2));
    await animate(sc, 90, (t) => {
      rays.clear();
      for (let i = 0; i < rayA.length; i++) {
        const L = (22 + (i % 3) * 10) * E.outQ(t) + 6;
        rays.seg(c.x, c.y, c.x + Math.cos(rayA[i]) * L, c.y + Math.sin(rayA[i]) * L * 0.85, i % 2 ? 1 : 2, i % 3 ? PAL.cyan4 : PAL.white, 1);
      }
    });
    rays.g.destroy();
    void whiteFlash(sc, u.sprite, 2);
    ov.destroy();
    ovGlow.destroy();
    leak.destroy();
    d.burst();
    void screenFlash(sc, PAL.cyan4, 0.3, 240);
    void crystalBurst(sc, c, { dir: d.push, floor: d.home.y, power: 2, glare: false, count: 14 });
    // keep the cracks in the broken pieces
    const broken = pc.clone();
    for (const p of paths) for (const q of p) broken.set(q.x, q.y, PAL.cyan3);
    await shatterPx(sc, u, { pc: broken, ramp: WYRM_RAMP, push: d.push, glitchMs: 60, speed: 1.15, shards: 34, shardColors: GLASS, stopMs: 60, shakePx: 3 });
    void len;
  }),
);
