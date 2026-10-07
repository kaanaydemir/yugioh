// Taş Muhafız (stone_sentinel) — signature summon: "assembling from orbiting rocks and slamming
// its shield".
//
//   0      the card slams onto the tile (kit)
//   +0     the floor splits in a star of fissures lit from below by rune-gold light; rumble;
//          dust curls up along the tile edges
//   +60    rocks tear out of the floor one by one and start to orbit the tile (iso orbit, they
//          pass behind and in front of the empty spot), speeding up
//   +470   ASSEMBLY: the body builds bottom → top in an earth hologram while each rock flies
//          into it exactly where the scan line passes (clack, chips, a white pixel spark)
//   +900   the hologram settles; roar: f1 the shield heaves up, f2 SLAM — finale (earth
//          shockwave, 3 px shake, rock debris off the shield foot, ATK/DEF badge pop)
//   +1200  f3 the fist rises, the eye and rune blaze: roar SFX, gold sparks off the chest
//   resolve ≈ +1350 (total ≈ 1.6 s); the roar settles as the tail.

import Phaser from 'phaser';
import { PAL, RAMPS, type Ramp } from '../../art/palette';
import { DEPTH, type XY, unitDepth } from '../../view/layout';
import { shake } from '../../vfx/core';
import { freeze } from '../../vfx/setpieces';
import { STEX } from '../../vfx/summon';
import { PTEX, dust as dustFx } from '../../vfx/particles';
import { opaquePoints } from '../../vfx/hologram';
import { registerCardHook } from '../api';
import {
  E,
  Sparks,
  TAU,
  bg,
  bodyBox,
  burst,
  clamp01,
  entrance,
  holo,
  holoSettle,
  lerp,
  liveLayer,
  onFrame,
  pose,
  rnd,
  roar,
  rr,
  run,
  whenFrame,
  type Entrance,
} from './_kit';

const EARTH: Ramp = RAMPS.earth;
const STONE: Ramp = RAMPS.stone;
const GOLD: Ramp = RAMPS.gold;

interface Crack {
  pts: XY[];
  /** Cumulative length at each point (floor px). */
  len: number[];
}

/** Radial fissures around (x, y), floor-projected. */
function makeCracks(x: number, y: number, n: number, r0: number, r1: number): Crack[] {
  const out: Crack[] = [];
  for (let b = 0; b < n; b++) {
    let a = (b / n) * TAU + rr(-0.25, 0.25);
    let r = r0;
    const pts: XY[] = [{ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.5 }];
    const len = [0];
    const L = rr(r1 * 0.7, r1);
    let d = 0;
    while (r < L) {
      a += rr(-0.45, 0.45);
      const step = rr(3, 5);
      r += step;
      d += step;
      pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.5 });
      len.push(d);
    }
    out.push({ pts, len });
  }
  return out;
}

/** The floor splits: fissures grow out from the tile, gold rune-light seeping from them. */
function earthCracks(e: Entrance): { flare(): void; cool(ms: number): Promise<void> } {
  const { scene: sc, home } = e;
  const cracks = makeCracks(home.x, home.y, 8, 6, 44);
  const st = { g: 0, heat: 1, flare: 0 };
  const layer = liveLayer(sc, home.x, home.y, 110, 60, DEPTH.TILE_FX + 2, (r, _el, dt) => {
    st.flare = Math.max(0, st.flare - dt / 220);
    const reach = st.g * 46;
    for (const c of cracks) {
      for (let i = 1; i < c.pts.length; i++) {
        if (c.len[i] > reach) break;
        const a = c.pts[i - 1];
        const b = c.pts[i];
        const fresh = reach - c.len[i] < 6;
        const glow = st.flare > 0 ? GOLD[4] : fresh ? GOLD[3] : GOLD[2];
        const lv = st.heat;
        // dark fissure, lit lower lip (light from inside), a faint gold glow above it
        r.line(a.x, a.y, b.x, b.y, PAL.ink, lv);
        r.line(a.x, a.y + 1, b.x, b.y + 1, glow, lv * (c.len[i] < 24 ? 1 : 0.6));
        if (c.len[i] < 16) r.line(a.x, a.y - 1, b.x, b.y - 1, EARTH[1], lv * 0.7);
      }
    }
  });
  bg(run(sc, 300, (t) => (st.g = E.outC(t))));
  return {
    flare() {
      st.flare = 1;
    },
    async cool(ms: number) {
      await run(sc, ms, (t) => (st.heat = 1 - t));
      layer.stop();
    },
  };
}

interface Rock {
  img: Phaser.GameObjects.Image;
  a: number;
  r: number;
  h: number;
  hT: number;
  w: number;
  bob: number;
  delay: number;
  age: number;
  /** Assembly flight (null while orbiting). */
  fly: { from: XY; to: XY; t0: number; ms: number } | null;
  done: boolean;
}

/** Rocks tear out of the floor and orbit the tile; later each flies into the body. */
function orbitRocks(e: Entrance, n: number): { rocks: Rock[]; speed(k: number): void; stop(): void } {
  const { scene: sc, home } = e;
  const rocks: Rock[] = [];
  for (let i = 0; i < n; i++) {
    const big = i % 2 === 0;
    const img = sc.add
      .image(0, 0, big ? STEX.boulder : PTEX.rock, String(i % (big ? 3 : 4)))
      .setVisible(false)
      .setFlipX(rnd() < 0.5);
    rocks.push({ img, a: (i / n) * TAU + rr(-0.15, 0.15), r: rr(25, 30), h: 0, hT: rr(14, 24), w: rr(2.6, 3.2) * e.dir, bob: rnd() * TAU, delay: 40 + i * 34, age: 0, fly: null, done: false });
  }
  let speedK = 1;
  let el = 0;
  const stop = onFrame(sc, (dt) => {
    el += dt;
    for (const rk of rocks) {
      if (rk.done || !rk.img.active) continue;
      rk.age += dt;
      if (rk.age < rk.delay) continue;
      if (rk.fly) {
        const t = clamp01((el - rk.fly.t0) / rk.fly.ms);
        const k = E.inQ(t);
        const mid = { x: (rk.fly.from.x + rk.fly.to.x) / 2, y: Math.min(rk.fly.from.y, rk.fly.to.y) - 10 };
        const u = 1 - k;
        rk.img.setPosition(Math.round(u * u * rk.fly.from.x + 2 * u * k * mid.x + k * k * rk.fly.to.x), Math.round(u * u * rk.fly.from.y + 2 * u * k * mid.y + k * k * rk.fly.to.y));
        rk.img.setDepth(DEPTH.FX - 1);
        continue;
      }
      const s = (rk.age - rk.delay) / 1000;
      if (!rk.img.visible) {
        // torn out of the floor: a puff of dust and chips where it breaks free
        const p = { x: home.x + Math.cos(rk.a) * rk.r, y: home.y + Math.sin(rk.a) * rk.r * 0.5 };
        burst(sc, p.x, p.y, 5, { ramp: [EARTH[4], EARTH[3], EARTH[2]], speed: [30, 70], up: 30, gravity: 300, life: [200, 340], depth: unitDepth(home.y) + 0.5, spread: [Math.PI, TAU] });
      }
      const up = Math.min(1, s / 0.22);
      rk.h = rk.hT * E.outBack(up, 2) + Math.sin(s * 6 + rk.bob) * 1.5;
      rk.a += rk.w * speedK * (dt / 1000) * (0.4 + up);
      const px = home.x + Math.cos(rk.a) * rk.r;
      const py = home.y + Math.sin(rk.a) * rk.r * 0.5;
      rk.img.setVisible(true).setPosition(Math.round(px), Math.round(py - rk.h));
      rk.img.setDepth(Math.sin(rk.a) >= 0 ? unitDepth(home.y) + 0.7 : unitDepth(home.y) - 0.7);
    }
    return true;
  });
  return {
    rocks,
    speed(k: number) {
      speedK = k;
    },
    stop() {
      stop();
      for (const rk of rocks) if (rk.img.active) rk.img.destroy();
    },
  };
}

async function sentinelPiece(e: Entrance): Promise<void> {
  const { ctx, scene: sc, unit: u, sprite: s, home } = e;
  // ---- anticipation: the floor splits, rocks tear free and orbit
  const cracks = earthCracks(e);
  ctx.sfx('earthQuake', { volume: 0.55, pitch: 1.15 });
  ctx.sfx('groundCrack', { volume: 0.4 });
  bg(shake(sc, 380, 1));
  dustFx(sc, home.x, home.y, { ramp: EARTH, radius: 26, count: 10, speed: 0.7, depth: unitDepth(home.y) + 0.5 });
  const orbit = orbitRocks(e, 8);
  bg(run(sc, 380, (t) => orbit.speed(1 + 1.8 * t)));
  await ctx.wait(400);

  // ---- assembly: hologram builds bottom → top, rocks fly in where the scan passes
  pose(u, 'idle', 0);
  const P = holo(s, STONE, { reveal: 0, scan: 0.7, glitch: 0.08, flicker: 0.15, tintMix: 1, gain: 1.05, tint: GOLD[3] });
  u.showSprite();
  const box = bodyBox(s);
  const REV = 340;
  const n = orbit.rocks.length;
  const pts = opaquePoints(s, 24).sort((a, b) => b.y - a.y);
  const t0 = { el: 0 };
  let el = 0;
  const stopClock = onFrame(sc, (dt) => {
    el += dt;
    t0.el = el;
    return el < REV + 400;
  });
  orbit.rocks.forEach((rk, i) => {
    const target = pts.length ? pts[Math.min(pts.length - 1, Math.floor(((i + 0.5) / n) * pts.length))] : { x: home.x, y: home.y - 20 };
    const k = box ? clamp01((box.bottom - target.y) / Math.max(1, box.h)) : i / n;
    const arrive = k * REV * 0.95;
    const fms = 150;
    void (async () => {
      await ctx.wait(Math.max(0, arrive - fms));
      if (!rk.img.active) return;
      rk.fly = { from: { x: rk.img.x, y: rk.img.y }, to: { x: target.x, y: target.y }, t0: el, ms: fms };
      await ctx.wait(fms);
      rk.done = true;
      if (rk.img.active) rk.img.destroy();
      // clack: chips + a white spark where it locks in
      burst(sc, target.x, target.y, 6, { ramp: [PAL.white, STONE[4], STONE[3], STONE[2]], speed: [30, 80], gravity: 260, life: [160, 300], depth: DEPTH.FX });
      ctx.sfx('impactLight', { volume: 0.22, pitch: rr(0.8, 1.3) });
    })();
  });
  await run(sc, REV, (t) => {
    P.reveal = lerp(0, 1, t);
  });
  P.reveal = 1;
  stopClock();
  bg(holoSettle(sc, s, 180, false));
  ctx.sfx('impactLight', { volume: 0.35, pitch: 0.7 });
  bg(ctx.wait(160).then(() => orbit.stop()));

  // ---- the shield slam (roar f2) → finale; f3 fist up + eye blaze → roar SFX
  const front = (): XY => {
    const b = bodyBox(s);
    return b ? { x: e.dir > 0 ? b.right - 7 : b.left + 7, y: home.y } : { x: home.x + 14 * e.dir, y: home.y };
  };
  const r = roar(ctx, u, {
    from: 0,
    sfx: null,
    onPeak: () => {
      // the slam is an impact frame: a short hit-stop under the shake
      bg(freeze(sc, 60));
      e.finale({ ramp: EARTH, radius: 62, shake: 3, dust: PAL.earth3, sfx: 'impactHeavy', volume: 0.6 });
      ctx.sfx('earthQuake', { volume: 0.7 });
      cracks.flare();
      const f = front();
      burst(sc, f.x, f.y - 2, 14, { ramp: [EARTH[4], EARTH[3], STONE[3], STONE[2]], speed: [50, 130], up: 60, gravity: 420, life: [260, 460], spread: [Math.PI * 1.05, Math.PI * 1.95], depth: DEPTH.FX });
      dustFx(sc, f.x, f.y, { ramp: EARTH, radius: 10, count: 8, speed: 1.3, depth: unitDepth(home.y) + 0.5 });
    },
  });
  await r.peak;
  await whenFrame(u, 'roar', 3);
  ctx.sfx('roarSmall', { volume: 0.8, pitch: 0.75 });
  // the rune and eye blaze: gold sparks rise off the chest
  const c = u.core();
  const sp = new Sparks(sc, DEPTH.FX + 1, Phaser.BlendModes.ADD);
  for (let i = 0; i < 12; i++) sp.add({ x: c.x + rr(-6, 6), y: c.y + rr(-8, 2), vx: rr(-14, 14), vy: rr(-70, -30), drag: 1.2, life: rr(320, 560), delay: i * 18, ramp: [PAL.white, GOLD[4], GOLD[3], GOLD[2]] });
  sp.close();
  bg(cracks.cool(520));
  await ctx.wait(140);
}

registerCardHook('stone_sentinel', 'summon', (ctx) => entrance(ctx, sentinelPiece), { name: 'summon-b:stone_sentinel' });
