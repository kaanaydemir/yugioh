// Mercan Yılanı — "Gayzer Sarmalı" (signature summon entrance).
//
//   0     the big water circle draws on; the tile FLOODS into a dark pool with ripple rings and a
//         whirlpool spinning faster and faster, bubbles rising, spray drawn inward
//   ~330  climax → ace tribute summons: the cut-in ("MERCAN YILANI!")
//   then  a GEYSER erupts from the pool (white crown, spray); the serpent shoots up inside it
//         (clipped at the waterline, water hologram with scanlines) while a ribbon of water
//         COILS down around its body (two turns, front over / back behind) and splashes into a
//         ring on the floor; the geyser falls as rain, the hologram settles
//   peak  roar f3 — jaws wide: a crown of water columns bursts up around its coils, water shock
//         ring, blue flash, hit-stop, 4 px shake, badge pop; the pool drains away

import { PAL, RAMPS, type Ramp } from '../../art/palette';
import { DEPTH } from '../../view/layout';
import { TEX } from '../../vfx/core';
import { bubbles, bubblesSmall, droplets } from '../../vfx/particles';
import {
  ADD,
  E,
  R,
  RR,
  Raster,
  Sparks,
  TAU,
  bg,
  bodyBox,
  geyser,
  holo,
  isoRing,
  lerp,
  onFrame,
  playSfx,
  run,
  scanBar,
  settleHolo,
  signatureSummon,
  type Stage,
} from './_kit';

const WATER: Ramp = RAMPS.water;

interface Pool {
  open(ms: number): Promise<void>;
  /** Whirl speed multiplier. */
  spin(k: number): void;
  drain(ms: number): Promise<void>;
  destroy(): void;
}

function whirlPool(S: Stage, A: number): Pool {
  const sc = S.scene;
  const { x, y } = S.home;
  const B = A / 2;
  const r = new Raster(sc, x - A - 6, y - B - 6, A * 2 + 12, B * 2 + 12, DEPTH.CARD_ON_TILE + 2);
  const st = { k: 0, t: 0, rot: 0, spin: 1, alive: true };
  const stop = onFrame(sc, (dt) => {
    if (!st.alive) return false;
    st.t += dt;
    st.rot += dt * 0.004 * st.spin;
    const a = A * st.k;
    r.draw((g) => {
      if (a < 1) return;
      const b = a / 2;
      for (let yy = Math.floor(y - b); yy <= Math.ceil(y + b); yy++) {
        for (let xx = Math.floor(x - a); xx <= Math.ceil(x + a); xx++) {
          const u = (xx + 0.5 - x) / a;
          const v = (yy + 0.5 - y) / b;
          const d = Math.hypot(u, v);
          if (d > 1) continue;
          const ang = Math.atan2(v, u);
          // a log spiral sweeping inward + ripple rings travelling out
          const arm = ((ang * 3) / TAU + Math.log(d + 0.04) * 1.7 + st.rot) % 1;
          const ring = (d * 4 - st.t * 0.003) % 1;
          let c: number = d < 0.3 ? PAL.water0 : PAL.water1;
          if (((arm + 1) % 1) < 0.18) c = d > 0.55 ? PAL.water3 : PAL.water2;
          if (((ring + 1) % 1) < 0.08 && d > 0.35) c = PAL.water4;
          if (d > 0.9) c = PAL.water3;
          g.px(xx, yy, c);
        }
      }
      // foam lip
      isoRing(g, x, y, a + 1, PAL.white, 0.8);
      isoRing(g, x, y, a + 3, PAL.water3, 0.4);
    });
    return true;
  });
  return {
    open: (ms) => run(sc, ms, (t) => (st.k = E.outBack(t))),
    spin: (k) => (st.spin = k),
    async drain(ms) {
      await run(sc, ms, (t) => (st.k = 1 - E.inQuad(t)));
      this.destroy();
    },
    destroy() {
      if (!st.alive) return;
      st.alive = false;
      stop();
      r.destroy();
    },
  };
}

/** A ribbon of water spiralling down around the body (front half over it, back half behind). */
function waterCoil(S: Stage, cx: number, yTop: number, yBot: number, rx: number, ms: number): Promise<void> {
  const sc = S.scene;
  const H = Math.ceil(yBot - yTop) + 16;
  const W = Math.ceil(rx * 2) + 20;
  const back = new Raster(sc, cx - W / 2, yTop - 8, W, H, S.depth - 0.5);
  const front = new Raster(sc, cx - W / 2, yTop - 8, W, H, S.depth + 0.5);
  const turns = 2;
  const len = 0.55;
  const drops = new Sparks(sc, DEPTH.FX - 1);
  let lastDrop = 0;
  return run(sc, ms, (t, el) => {
    const head = E.inOutSine(t) * (1 + len);
    const s0 = Math.max(0, head - len);
    const s1 = Math.min(1, head);
    const draw = (g: Raster, isFront: boolean) => {
      if (s1 <= s0) return;
      const N = 140;
      for (let i = 0; i <= N; i++) {
        const s = s0 + ((s1 - s0) * i) / N;
        const ang = s * turns * TAU + el * 0.004;
        const fr = Math.sin(ang) >= 0;
        if (fr !== isFront) continue;
        // the coil tightens toward the floor
        const rr = rx * (0.8 + 0.35 * s);
        const px = cx + Math.cos(ang) * rr;
        const py = lerp(yTop, yBot, s) + Math.sin(ang) * rr * 0.4;
        const k = (s - s0) / Math.max(0.001, s1 - s0); // 0 tail → 1 head
        const w = k > 0.85 ? 2 : k > 0.3 ? 1.5 : 1;
        const col = isFront ? (k > 0.9 ? PAL.white : k > 0.5 ? PAL.water4 : PAL.water3) : k > 0.5 ? PAL.water3 : PAL.water2;
        g.disc(px, py, w, col);
        if (isFront && k > 0.4) g.px(px, py - 1, PAL.white);
      }
    };
    back.draw((g) => draw(g, false));
    front.draw((g) => draw(g, true));
    // the tail sheds drops
    if (el - lastDrop > 40 && s1 > s0) {
      lastDrop = el;
      const ang = s0 * turns * TAU + el * 0.004;
      const rr = rx * (0.8 + 0.35 * s0);
      drops.add({ x: cx + Math.cos(ang) * rr, y: lerp(yTop, yBot, s0) + Math.sin(ang) * rr * 0.4, vx: Math.cos(ang) * 30, vy: -RR(10, 40), ay: 380, life: RR(260, 420), ramp: [PAL.white, PAL.water4, PAL.water3], tex: TEX.px1 });
    }
  }).then(() => {
    back.destroy();
    front.destroy();
    drops.close();
  });
}

/** Columns of water bursting up in a ring around the base. */
function splashCrown(S: Stage, rad: number, n: number): void {
  const sp = new Sparks(S.scene, DEPTH.FX - 1);
  const { x, y } = S.home;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + RR(-0.1, 0.1);
    const bx = x + Math.cos(a) * rad;
    const by = y + Math.sin(a) * rad * 0.5;
    for (let j = 0; j < 4; j++) {
      sp.add({ x: bx + RR(-1, 1), y: by, vx: Math.cos(a) * RR(10, 40), vy: -RR(120, 230) * (1 - j * 0.15), ay: 620, life: RR(380, 560), ramp: [PAL.white, PAL.water4, PAL.water3, PAL.water2], tex: j === 0 ? TEX.px2 : TEX.px1, trail: j === 0 });
    }
  }
  sp.close();
}

signatureSummon('coral_serpent', async (S) => {
  const sc = S.scene;
  const { unit, sprite, home, rest } = S;
  if (S.big) bg(S.ctx.focus({ x: home.x, y: home.y - 34 }, { zoom: 1.05, ms: 520, pan: 0.3 }));
  const circle = S.openCircle();
  const pool = S.own(whirlPool(S, S.big ? 26 : 20));
  playSfx('waterSplash', { volume: 0.5, pitch: 0.8 });
  playSfx('summonCharge', { volume: 0.6 });
  bubblesSmall(sc, home.x, home.y, { radius: 16, duration: 340, frequency: 50, count: 1, depth: DEPTH.FX - 1 });
  // spray drawn inward toward the whirl
  const pull = new Sparks(sc, DEPTH.FX - 1, ADD);
  for (let i = 0; i < (S.big ? 22 : 14); i++) {
    const a = R() * TAU;
    const d = RR(44, 66);
    pull.add({ x: home.x + Math.cos(a) * d, y: home.y + Math.sin(a) * d * 0.5 - RR(0, 16), home: { x: home.x, y: home.y, k: 0.4 }, delay: RR(0, 140), life: RR(240, 340), ramp: [PAL.water3, PAL.water4, PAL.white], tex: TEX.px1 });
  }
  pull.close();
  await pool.open(200);
  pool.spin(3);
  circle.pulse(100);
  circle.spin(2.2);
  await S.wait(120);

  await S.climax();

  // ---- the geyser erupts and the serpent shoots up inside it
  playSfx('waterSplash', { volume: 1 });
  playSfx('summonBurst', { volume: 0.6, pitch: 1.2 });
  const spout = S.own(geyser(S, { height: S.big ? 150 : 112, width: S.big ? 20 : 16, kind: 'water' }));
  bg(spout.rise(80));
  let fell = false;
  droplets(sc, home.x, home.y - 40, { count: S.big ? 34 : 22, speed: 1.3, depth: DEPTH.FX - 1 });
  const box0 = bodyBox(unit);
  const dist = Math.ceil(box0.bottom - box0.top) + 4;
  sprite.setPosition(rest.x, rest.y + dist);
  const P = holo(unit, WATER, { clipY: home.y + 1, glitch: 0.1 });
  unit.showSprite();
  const bar = S.own(scanBar(sc, WATER, S.depth + 0.6));
  const cx = Math.round((box0.left + box0.right) / 2);
  const coil = waterCoil(S, cx, box0.top + 10, home.y, Math.max(12, (box0.right - box0.left) * 0.42), 380);
  await run(sc, 260, (t) => {
    sprite.setY(Math.round(rest.y + dist * (1 - E.outCubic(t))));
    if (t < 0.9) bar.at(home.y, box0.left - 2, box0.right + 2);
    else bar.hide();
    // the water falls back once the head is out, so the serpent reads in front of it
    if (!fell && t > 0.55) {
      fell = true;
      bg(spout.fall(300));
    }
  });
  bar.destroy();
  sprite.setY(rest.y);
  P.clipY = null;
  droplets(sc, home.x, home.y - 70, { w: 40, h: 30, count: S.big ? 26 : 16, speed: 0.55, depth: DEPTH.FX - 1 });
  bubbles(sc, home.x, home.y - 10, { w: 18, h: 24, count: 6, depth: S.depth + 0.5 });
  bg(settleHolo(sc, unit, 260));
  await S.wait(60);

  // ---- roar: jaws wide on the peak, the water crown bursts
  await S.roar({
    from: 1,
    peak: 3,
    onPeak: () => {
      splashCrown(S, S.big ? 22 : 16, S.big ? 12 : 8);
      droplets(sc, home.x, home.y - 6, { radius: 18, count: S.big ? 24 : 14, speed: 1, depth: DEPTH.FX - 1 });
      S.finale({ ring: S.big ? 94 : 58, ramp: WATER, flashColor: S.big ? PAL.water4 : undefined, flashAlpha: 0.28, freezeMs: S.big ? 60 : 0, sfx: 'summonBurst' });
      playSfx('waterSplash', { volume: 0.8, pitch: 1.2 });
      bg(pool.drain(420));
      bg(circle.dismiss(420));
    },
  });
  bg(coil);
  await S.wait(S.big ? 130 : 110);
});
