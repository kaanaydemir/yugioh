// Fırtına Atmacası (storm_hawk) — signature summon: "diving out of the sky in a wind spiral".
//
//   0      the card slams onto the tile (kit)
//   +0     a green wind seal draws itself on the floor; a ring of wind streaks hugs the tile and
//          leaves are sucked into it (anticipation); high above, a glint twinkles
//   +280   the hawk tucks its wings (attack f3/f4) and DIVES from the glint down a tightening
//          wind spiral — hologram scan building, afterimages and a white-teal helix trail
//   +700   it flares to brake right over the tile (roar from f2, squash), a wind burst ring of
//          dashes races out over the floor, leaves scatter, gust lines whip upward
//   +780   roar f3 (wings flung wide, screech): finale shockwave + ATK/DEF badge pop
//   resolve ≈ +1000 (total ≈ 1.25 s); the roar plays out as the tail.

import type { Ramp } from '../../art/palette';
import { PAL } from '../../art/palette';
import { DEPTH, type XY, unitDepth } from '../../view/layout';
import { createMagicCircle } from '../../vfx/summon';
import { leaves } from '../../vfx/particles';
import { registerCardHook } from '../api';
import {
  ADD,
  Raster,
  E,
  Sparks,
  TAU,
  afterTrail,
  bg,
  clamp01,
  entrance,
  holo,
  holoSettle,
  lerp,
  liveLayer,
  pose,
  rnd,
  roar,
  rr,
  run,
  seg,
  star,
  type Entrance,
} from './_kit';

/** Wind colours (art notes: white / teal4 / teal3 / teal2). */
const WIND: Ramp = [PAL.teal1, PAL.teal2, PAL.teal3, PAL.teal4, PAL.white];
const LEAF: Ramp = [PAL.leaf0, PAL.leaf1, PAL.leaf2, PAL.leaf3, PAL.leaf4];

/** Floor wind: streak arcs racing around the tile, contracting while `k` (0..1) charges. */
function floorWind(e: Entrance): { stop(ms: number): Promise<void> } {
  const { scene: sc, home } = e;
  const st = { fade: 1, k: 0, spin: 0 };
  const layer = liveLayer(sc, home.x, home.y, 110, 60, DEPTH.TILE_FX + 3, (r, _el, dt) => {
    st.k = Math.min(1, st.k + dt / 300);
    st.spin += dt * (0.007 + 0.01 * st.k) * e.dir;
    const R = lerp(40, 25, E.outQ(st.k));
    for (let a = 0; a < 3; a++) {
      const a0 = st.spin + (a * TAU) / 3;
      const span = 1.1;
      for (let i = 0; i <= 24; i++) {
        const u = i / 24;
        const ang = a0 - u * span * e.dir;
        const rr0 = R + Math.sin(u * 3 + a) * 1.5;
        const x = home.x + Math.cos(ang) * rr0;
        const y = home.y + Math.sin(ang) * rr0 * 0.5;
        const c = u < 0.12 ? PAL.white : u < 0.4 ? WIND[3] : u < 0.75 ? WIND[2] : WIND[1];
        r.dpx(x, y, c, st.fade * (u < 0.75 ? 1 : 0.5));
      }
    }
  });
  return {
    async stop(ms: number) {
      await run(sc, ms, (t) => (st.fade = 1 - t));
      layer.stop();
    },
  };
}

/** Leaf bits pulled into the spinning ring (anticipation). */
function suckLeaves(e: Entrance, n: number): void {
  const { scene: sc, home } = e;
  const sp = new Sparks(sc, unitDepth(home.y) + 0.6);
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU;
    const r0 = rr(46, 64);
    const x = home.x + Math.cos(a) * r0;
    const y = home.y + Math.sin(a) * r0 * 0.5 - rr(0, 10);
    sp.add({ x, y, life: rr(260, 420), delay: rr(0, 140), ramp: [LEAF[4], LEAF[3], LEAF[2]], tex: undefined, home: { x: home.x, y: home.y - 4, k: 0.12 }, vx: -Math.sin(a) * 60 * e.dir, vy: Math.cos(a) * 30 * e.dir });
  }
  sp.close();
}

/** A twinkling glint in the sky: where the hawk will dive from. */
function skyGlint(e: Entrance, at: XY, ms: number): Promise<void> {
  const { scene: sc } = e;
  const layer = liveLayer(sc, at.x, at.y, 24, 24, DEPTH.FX + 2, () => undefined, ADD);
  return run(sc, ms, (t, el) => {
    layer.r.draw((r) => {
      const grow = E.outBack(seg(t, 0, 0.55));
      const l = Math.round(2 + 5 * grow * (Math.floor(el / 50) % 2 ? 0.8 : 1));
      if (t < 0.95) star(r, at.x, at.y, l, PAL.white, WIND[3]);
    });
  }).then(() => layer.stop());
}

/** Helix point: spiral around the vertical axis through `rest.x`, tightening toward the tile. */
function helix(e: Entrance, from: XY, t: number, turns: number, r0: number): XY {
  const { rest, dir } = e;
  const k = 1 - t;
  const R = r0 * Math.pow(k, 1.1);
  const th = Math.PI + t * turns * TAU;
  const yb = lerp(from.y, rest.y, t);
  return { x: rest.x + Math.cos(th) * R * dir, y: yb + Math.sin(th) * R * 0.35 };
}

/**
 * The wind spiral: a funnel of rotating wind streaks from the sky down to the tile (wide at the
 * top, tight at the floor). It unrolls top → down (anticipation), spins while the hawk dives
 * through it, then bursts outward and fades. Back half behind the hawk, front half in front.
 */
function windFunnel(e: Entrance, topY: number): { burst(ms: number): Promise<void> } {
  const { scene: sc, home, rest, dir } = e;
  const bottom = home.y - 6;
  const H = bottom - topY;
  const W = 120;
  const cy = (topY + bottom) / 2;
  const st = { t: 0, grow: 0, spread: 1, fade: 1, alive: true };
  const draw = (r: Raster, half: 'front' | 'back') => {
    const gap = 4;
    const n = Math.floor(H / gap);
    for (let i = 0; i <= n; i++) {
      const h = i * gap; // height above the floor end
      const k = h / H;
      // unroll from the TOP down: level visible once grow passes its depth from the top
      const vis = clamp01((st.grow - (1 - k)) * 4);
      if (vis <= 0) continue;
      const R = (6 + 22 * Math.pow(k, 0.85)) * st.spread;
      const y = bottom - h;
      const x = rest.x + Math.sin(st.t * 0.004 + k * 3) * 2 * k;
      for (let sgi = 0; sgi < 2; sgi++) {
        const ph = st.t * 0.016 * dir + k * 4.4 + sgi * Math.PI;
        const span = 1.5;
        const steps = 22;
        for (let j = 0; j <= steps; j++) {
          const u = j / steps;
          const a = ph - u * span * dir;
          const sn = Math.sin(a);
          if ((half === 'front') !== sn >= 0) continue;
          const px = x + Math.cos(a) * R;
          const py = y + sn * R * 0.32;
          if (half === 'back') {
            r.dpx(px, py, u < 0.3 ? WIND[2] : WIND[1], st.fade * vis * (u < 0.6 ? 0.9 : 0.4));
            continue;
          }
          const c = u < 0.1 ? PAL.white : u < 0.4 ? WIND[3] : WIND[2];
          const lv = st.fade * vis * (u < 0.65 ? 1 : 0.45);
          r.dpx(px, py, c, lv);
          if (u < 0.35) r.dpx(px, py + 1, WIND[2], lv * 0.8);
        }
      }
    }
  };
  const back = liveLayer(sc, rest.x, cy, W, H + 30, unitDepth(home.y) - 1, (r) => draw(r, 'back'), ADD);
  const front = liveLayer(sc, rest.x, cy, W, H + 30, DEPTH.FX - 3, (r, _el, dt) => {
    st.t += dt;
    draw(r, 'front');
  }, ADD);
  bg(run(sc, 260, (t) => (st.grow = E.outQ(t))));
  return {
    async burst(ms: number) {
      await run(sc, ms, (t) => {
        st.spread = 1 + 1.2 * E.outC(t);
        st.fade = 1 - t;
      });
      back.stop();
      front.stop();
    },
  };
}

async function hawkPiece(e: Entrance): Promise<void> {
  const { ctx, scene: sc, unit: u, sprite: s, home, rest, dir } = e;
  // ---- anticipation on the floor + the wind spiral unrolling down from the sky
  const circle = createMagicCircle(sc, home.x, home.y, { attribute: 'WIND', player: e.player, appearMs: 220 });
  const wind = floorWind(e);
  suckLeaves(e, 14);
  ctx.sfx('windGust', { volume: 0.5, pitch: 1.3 });
  const from: XY = { x: rest.x - 24 * dir, y: rest.y - 104 };
  bg(skyGlint(e, { x: from.x, y: from.y - 8 }, 300));
  await ctx.wait(90);
  const funnel = windFunnel(e, from.y - 6);
  await ctx.wait(190);

  // ---- the dive
  const DIVE = 400;
  const TURNS = 1.25;
  pose(u, 'attack', 3);
  s.setPosition(from.x, from.y).setAngle(28 * dir);
  const P = holo(s, WIND, { reveal: 0, glitch: 0.04, gain: 1, flicker: 0.08, scan: 0.35, tintMix: 0.5 });
  u.showSprite();
  s.setDepth(DEPTH.FX - 2);
  ctx.sfx('whoosh', { volume: 0.8, pitch: 1.25 });
  let diving = true;
  bg(afterTrail(sc, s, { colors: [WIND[3], WIND[2], PAL.leaf3], every: 45, life: 150, alpha: 0.32, active: () => diving }));
  // a short white-teal streak behind the bird
  const trail: XY[] = [];
  const tr = liveLayer(sc, rest.x, (from.y + rest.y) / 2, 120, rest.y - from.y + 70, DEPTH.FX - 3, () => undefined, ADD);
  const drawTrail = (fade: number) =>
    tr.r.draw((r) => {
      const n = trail.length;
      for (let i = 1; i < n; i++) {
        const a = trail[i - 1];
        const b = trail[i];
        const age = (n - i) / Math.max(1, n);
        const c = age < 0.25 ? PAL.white : age < 0.6 ? WIND[3] : WIND[2];
        r.line(a.x, a.y, b.x, b.y, c, fade * (age < 0.7 ? 1 : 0.5));
        if (age < 0.4) r.line(a.x + 1, a.y, b.x + 1, b.y, WIND[3], fade * 0.6);
      }
    });
  await run(sc, DIVE, (t) => {
    const k = 0.55 * E.inQ(t) + 0.45 * t; // accelerating dive
    const p = helix(e, from, k, TURNS, 24);
    s.setPosition(Math.round(p.x), Math.round(p.y));
    u.lift = Math.max(0, rest.y - s.y);
    P.reveal = E.outQ(seg(t, 0, 0.3));
    if (t > 0.5) pose(u, 'attack', 4);
    const th = Math.PI + k * TURNS * TAU;
    s.setAngle(Math.round(dir * (22 + 12 * Math.sin(th)) * (1 - seg(t, 0.75, 1))));
    trail.push({ x: p.x, y: p.y - 12 });
    if (trail.length > 9) trail.shift();
    drawTrail(1);
  });
  diving = false;
  // ---- flare: brake right over the tile
  s.setAngle(0).setPosition(rest.x, rest.y + 4);
  u.lift = 0;
  s.setDepth(unitDepth(home.y));
  P.reveal = 1;
  bg(
    run(sc, 180, (t) => {
      const k = E.spring(t);
      s.setScale(1 + 0.12 * k, 1 - 0.14 * k);
      s.y = Math.round(rest.y + 4 * (1 - E.outBack(t, 2.2)));
    }).then(() => s.setScale(1).setPosition(rest.x, rest.y)),
  );
  bg(holoSettle(sc, s, 200));
  bg(run(sc, 140, (t) => drawTrail(1 - t)).then(() => tr.stop()));
  ctx.sfx('windGust', { volume: 0.9, pitch: 0.9 });
  bg(funnel.burst(320));
  bg(windBurst(e));
  leaves(sc, home.x, home.y - 12, { count: 12, speed: 1.4, depth: DEPTH.FX - 1 });
  bg(wind.stop(220));
  const r = roar(ctx, u, {
    from: 2,
    sfx: 'roarSmall',
    pitch: 1.3,
    volume: 0.85,
    onPeak: () => {
      e.finale({ ramp: LEAF, radius: 52, shake: 1, dust: null });
      bg(circle.dismiss(300));
    },
  });
  await r.peak;
  await ctx.wait(220);
}

/** Wind burst: a dashed ring of wind racing out on the floor + gust lines whipping upward. */
function windBurst(e: Entrance): Promise<void> {
  const { scene: sc, home } = e;
  const layer = liveLayer(sc, home.x, home.y - 30, 150, 120, DEPTH.FX - 1, () => undefined, ADD);
  const gusts = Array.from({ length: 5 }, (_, i) => ({ x: home.x + (i - 2) * 9 + rr(-3, 3), h: rr(26, 44), d: rr(0, 0.25), w: rr(-4, 4) }));
  return run(sc, 420, (t) => {
    layer.r.draw((r) => {
      const k = E.outC(t);
      const R = lerp(8, 60, k);
      const lv = 1 - seg(t, 0.45, 1);
      // dashed floor ring
      for (let i = 0; i < 40; i++) {
        if (i % 3 === 2) continue;
        const a = (i / 40) * TAU + t * 1.2;
        const x = home.x + Math.cos(a) * R;
        const y = home.y + Math.sin(a) * R * 0.5;
        r.dpx(x, y, t < 0.2 ? PAL.white : WIND[3], lv);
        r.dpx(x + Math.cos(a), y + Math.sin(a) * 0.5, WIND[2], lv * 0.6);
      }
      // gust lines rising past the hawk
      for (const g of gusts) {
        const tt = clamp01((t - g.d) / 0.6);
        if (tt <= 0 || tt >= 1) continue;
        const y0 = home.y - 4 - tt * 40;
        const len = g.h * (1 - tt) * 0.6 + 4;
        r.line(g.x + g.w * tt, y0, g.x + g.w * tt * 1.4, y0 - len, tt < 0.3 ? PAL.white : WIND[3], 1 - tt);
      }
    });
  }).then(() => layer.stop());
}

registerCardHook('storm_hawk', 'summon', (ctx) => entrance(ctx, hawkPiece), { name: 'summon-b:storm_hawk' });
