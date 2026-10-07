// Gelgit Golemi — "Su Hortumu" (signature summon entrance, normal summon ≤ 1.8 s).
//
//   0     the card slams (≈250 ms); the water circle draws on; ripple rings travel INWARD and
//         streams of water spiral in from all around the tile — the sea gathers
//   ~260  a twisting WATER SPOUT shoots up out of the card (helical foam bands climbing it,
//         a churning crown on top)
//   ~420  the golem FORMS out of it: built bottom → top as a water hologram with scanlines while
//         the spout drains upward into its body (the spout's foot rides the scan edge), then
//         the spout's crown collapses into a splash
//   peak  roar f4 — arms up, geysers from its fists: a crown of water bursts round its base,
//         water shock ring, 2 px shake, badge pop

import { PAL, RAMPS, type Ramp } from '../../art/palette';
import { DEPTH } from '../../view/layout';
import { TEX } from '../../vfx/core';
import { droplets, bubblesSmall } from '../../vfx/particles';
import { materialize } from '../../vfx/hologram';
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
  clamp,
  isoRing,
  lerp,
  noise1,
  onFrame,
  playSfx,
  run,
  signatureSummon,
  type Stage,
} from './_kit';

const WATER: Ramp = RAMPS.water;

interface Spout {
  rise(ms: number): Promise<void>;
  /** Foot of the column (world y) — it drains upward as the body forms. */
  foot(y: number): void;
  collapse(ms: number): Promise<void>;
  destroy(): void;
}

function waterSpout(S: Stage, H: number, w0: number, w1: number): Spout {
  const sc = S.scene;
  const { x, y } = S.home;
  const W = Math.ceil(w1 * 2) + 24;
  const r = new Raster(sc, x - W / 2, y - H - 14, W, H + 20, S.depth + 0.5);
  const st = { top: 0, foot: y, t: 0, fall: 0, alive: true };
  const seed = R() * 20;
  const stop = onFrame(sc, (dt) => {
    if (!st.alive) return false;
    st.t += dt;
    const top = y - H * st.top + st.fall * H * 0.6;
    r.draw((g) => {
      if (st.top <= 0.01) return;
      for (let yy = Math.round(top); yy <= Math.round(st.foot); yy++) {
        const k = clamp((y - yy) / H, 0, 1);
        const sway = Math.sin(k * 5 - st.t * 0.01) * 1.5 * k;
        const hw = lerp(w0, w1, k) * (1 + (noise1(yy * 0.2 - st.t * 0.02, seed) - 0.5) * 0.25);
        for (let dx = -Math.ceil(hw); dx <= Math.ceil(hw); dx++) {
          const u = clamp((dx + 0.5) / hw, -1, 1);
          if (Math.abs(dx + 0.5) > hw) continue;
          // helical foam bands climbing the column (front face only)
          const ph = Math.asin(u) / TAU;
          const band = (((yy * 0.09 + ph * 1.2 + st.t * 0.0035) % 1) + 1) % 1;
          let c: number;
          let lv = 0.6;
          if (Math.abs(u) > 0.86) {
            c = PAL.water4;
            lv = 1;
          } else if (band < 0.12) {
            c = PAL.white;
            lv = 1;
          } else if (band < 0.24) {
            c = PAL.water4;
            lv = 0.9;
          } else c = Math.abs(u) > 0.5 ? PAL.water3 : PAL.water2;
          g.dpx(x + dx + sway, yy, c, lv);
        }
      }
      // churning crown
      const cw = w1 + 4;
      for (let rr = -5; rr <= 3; rr++) {
        const yy = Math.round(top) + rr;
        const fw = cw * Math.max(0, 1 - ((rr + 1) / 5) ** 2);
        for (let dx = -Math.ceil(fw); dx <= Math.ceil(fw); dx++) {
          const n = noise1((dx + st.t * 0.03) * 0.5, seed + rr * 2.1);
          if (n < 0.38) continue;
          g.px(x + dx, yy, n > 0.66 ? PAL.white : n > 0.5 ? PAL.water4 : PAL.water3);
        }
      }
      // foam ring where it meets the floor / the body
      isoRing(g, x, Math.round(st.foot), w0 + 3, PAL.white, 0.8);
    });
    return true;
  });
  return {
    rise: (ms) => run(sc, ms, (t) => (st.top = E.outCubic(t))),
    foot: (fy) => (st.foot = fy),
    async collapse(ms) {
      await run(sc, ms, (t) => (st.fall = E.inQuad(t)));
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

/** Ripple rings travelling INWARD (the water gathering toward the tile). */
function gatherRipples(S: Stage, R0: number, ms: number): Promise<void> {
  const sc = S.scene;
  const { x, y } = S.home;
  const ras = new Raster(sc, x - R0 - 4, y - R0 / 2 - 4, R0 * 2 + 8, R0 + 8, DEPTH.TILE_FX + 2);
  return run(sc, ms, (t, el) => {
    ras.draw((g) => {
      for (let i = 0; i < 3; i++) {
        const k = ((el / 360 + i / 3) % 1 + 1) % 1;
        const rad = lerp(R0, 6, E.inQuad(k));
        const lv = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) * 0.6;
        isoRing(g, x, y, rad, k > 0.7 ? PAL.white : PAL.water4, lv * (t < 0.85 ? 1 : (1 - t) / 0.15));
        isoRing(g, x, y, rad + 2, PAL.water2, lv * 0.6);
      }
    });
  }).then(() => ras.destroy());
}

/** Streams of water spiralling in from around the tile. */
function inflow(S: Stage, n: number, ms: number): void {
  const sp = new Sparks(S.scene, DEPTH.FX - 1, ADD);
  const { x, y } = S.home;
  for (let i = 0; i < n; i++) {
    const a = R() * TAU;
    const d = RR(46, 70);
    sp.add({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.5 - RR(0, 10), vx: -Math.sin(a) * 40, vy: Math.cos(a) * 20, home: { x, y: y - 4, k: 0.3 }, delay: RR(0, ms * 0.4), life: RR(ms * 0.45, ms * 0.6), ramp: [PAL.water3, PAL.water4, PAL.white], tex: TEX.px1, trail: true });
  }
  sp.close();
}

/** Water columns bursting up round the base. */
function splashRing(S: Stage, rad: number, n: number): void {
  const sp = new Sparks(S.scene, DEPTH.FX - 1);
  const { x, y } = S.home;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + RR(-0.12, 0.12);
    for (let j = 0; j < 3; j++) {
      sp.add({ x: x + Math.cos(a) * rad, y: y + Math.sin(a) * rad * 0.5, vx: Math.cos(a) * RR(20, 50), vy: -RR(90, 180) * (1 - j * 0.2), ay: 600, life: RR(320, 480), ramp: [PAL.white, PAL.water4, PAL.water3, PAL.water2], tex: j === 0 ? TEX.px2 : TEX.px1 });
    }
  }
  sp.close();
}

signatureSummon('tide_golem', async (S) => {
  const sc = S.scene;
  const { unit, sprite, home } = S;
  const circle = S.openCircle();
  playSfx('waterSplash', { volume: 0.45, pitch: 0.7 });
  bg(gatherRipples(S, S.big ? 60 : 50, 420));
  inflow(S, S.big ? 30 : 22, 300);
  bubblesSmall(sc, home.x, home.y, { radius: 14, duration: 300, frequency: 60, count: 1, depth: DEPTH.FX - 1 });
  await S.wait(200);
  circle.pulse(100);

  // ---- the spout shoots up
  const box = bodyBox(unit);
  const Hs = Math.ceil(home.y - box.top) + 10;
  const halfW = Math.max(10, (box.right - box.left) / 2);
  const spout = S.own(waterSpout(S, Hs, halfW * 0.42, halfW * 1.0));
  playSfx('waterSplash', { volume: 0.8 });
  droplets(sc, home.x, home.y - 10, { count: 12, speed: 1, depth: DEPTH.FX - 1 });
  await spout.rise(130);
  await S.wait(20);

  // ---- the golem forms out of it: the spout drains up into the body as the scan climbs
  playSfx('materialize', { volume: 0.7 });
  const MAT = 420;
  const reveal = MAT * 0.72;
  const span = { top: box.top, bottom: home.y };
  // (the settle half of materialize keeps running under the roar)
  bg(materialize(sc, sprite, { ramp: WATER, ms: MAT }));
  unit.showSprite();
  await run(sc, reveal, (t) => {
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    spout.foot(lerp(span.bottom, span.top, e));
  });
  bg(spout.collapse(160));
  droplets(sc, home.x, box.top + 6, { w: 30, h: 10, count: 18, speed: 0.8, depth: DEPTH.FX - 1 });
  await S.wait(50);

  // ---- roar: the fists throw geysers; the crown of water bursts round the base
  await S.roar({
    from: 1,
    peak: 4,
    sfx: 'roarSmall',
    lead: 130,
    onPeak: () => {
      splashRing(S, S.big ? 26 : 20, S.big ? 12 : 9);
      droplets(sc, home.x, home.y - 6, { radius: 16, count: 12, speed: 0.9, depth: DEPTH.FX - 1 });
      S.finale({ ring: S.big ? 80 : 56, ramp: WATER, sfx: 'waterSplash' });
      bg(circle.dismiss(380));
    },
  });
  await S.wait(100);
});
