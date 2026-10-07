// Magma Titanı — "Lav Yarığı" (signature summon entrance).
//
//   0     the big fire circle draws on; the floor SPLITS: white-hot fissures race out under the
//         card, a jagged gash tears open across the tile and fills with churning lava (crust lips,
//         bubbling gold hot spots), embers and smoke rise, the ground rumbles
//   ~340  climax → ace tribute summons: the cut-in ("MAGMA TİTANI!")
//   then  the titan BURSTS up out of the lava (clipped at the floor, overshoots and drops back)
//         coated in molten light, a lava geyser + spray of glowing gobs, 3 px shake
//   +240  it cools from molten to basalt (hologram settle); the roar starts on its hunch
//   peak  roar f4 — vents erupt: a ring of flame tongues bursts around its feet, fire shock
//         ring, ember storm, orange flash, hit-stop, 4 px shake, badge pop; then the chest beats
//         (f5–f7) each thud the camera; the gash crusts over and the fissures cool

import { PAL, RAMPS, type Ramp } from '../../art/palette';
import { mulberry32 } from '../../art/pixel';
import { DEPTH, type XY } from '../../view/layout';
import { TEX, shake } from '../../vfx/core';
import { embers, smokePuffs } from '../../vfx/particles';
import {
  E,
  R,
  RR,
  Raster,
  Sparks,
  TAU,
  bg,
  bodyBox,
  clamp,
  geyser,
  holo,
  lerp,
  noise1,
  onFrame,
  playSfx,
  run,
  scanBar,
  settleHolo,
  signatureSummon,
  untilFrame,
  type Stage,
} from './_kit';

const FIRE: Ramp = RAMPS.fire;
/** Deep molten palette for the hologram (the body stays readable against the bright lava). */
const MOLTEN: Ramp = [PAL.night1, PAL.fire0, PAL.fire1, PAL.fire2, PAL.fire3];
/** Lava, hot → cool. */
const LAVA = [PAL.white, PAL.gold4, PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1] as const;

interface CrackPx {
  x: number;
  y: number;
  s: number;
  main: boolean;
}

/** Radiating fissures in floor space (y compressed 2:1), sorted by distance from the centre. */
function fissures(radius: number, branches: number, seed: number): CrackPx[] {
  const rnd = mulberry32(seed);
  const out: CrackPx[] = [];
  const seen = new Set<number>();
  const plot = (x: number, y: number, s: number, main: boolean) => {
    const k = (x + 512) * 1024 + (y + 512);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ x, y, s, main });
  };
  const walk = (r0: number, a: number, len: number, main: boolean, depth: number) => {
    let px = Math.cos(a) * r0;
    let py = Math.sin(a) * r0;
    let r = r0;
    while (r < r0 + len) {
      a += (rnd() - 0.5) * 0.8;
      const nx = px + Math.cos(a) * 2;
      const ny = py + Math.sin(a) * 2;
      const n = 3;
      for (let i = 0; i <= n; i++) {
        const qx = Math.round(px + ((nx - px) * i) / n);
        const qy = Math.round((py + ((ny - py) * i) / n) * 0.5);
        plot(qx, qy, Math.hypot(qx, qy * 2) / radius, main);
        if (main && r < radius * 0.5) plot(qx, qy + 1, Math.hypot(qx, qy * 2) / radius, main);
      }
      px = nx;
      py = ny;
      r = Math.hypot(px, py);
      if (depth < 1 && rnd() < 0.12) walk(r, a + (rnd() < 0.5 ? -1 : 1) * (0.6 + rnd() * 0.5), (r0 + len - r) * 0.5, false, depth + 1);
    }
  };
  for (let b = 0; b < branches; b++) walk(6, (b / branches) * TAU + (rnd() - 0.5) * 0.5, radius * (0.75 + rnd() * 0.25), true, 0);
  return out.sort((p, q) => p.s - q.s);
}

interface Split {
  grow(ms: number): Promise<void>;
  /** Heat 1 → 0: lava crusts over, fissures dim and vanish. */
  cool(ms: number): Promise<void>;
  /** The gash pushes wider for a moment (the body bursting through). */
  heave(k: number): void;
  destroy(): void;
}

function lavaSplit(S: Stage): Split {
  const sc = S.scene;
  const { x, y } = S.home;
  const RAD = S.big ? 76 : 56;
  const A = S.big ? 26 : 20;
  const B = S.big ? 8 : 6;
  const cracks = fissures(RAD, S.big ? 9 : 7, Math.floor(R() * 1e6));
  const floor = new Raster(sc, x - RAD - 4, y - RAD / 2 - 4, RAD * 2 + 8, RAD + 8, DEPTH.TILE_FX + 1);
  const gash = new Raster(sc, x - A - 10, y - B - 10, A * 2 + 20, B * 2 + 20, DEPTH.CARD_ON_TILE + 2);
  const st = { g: 0, heat: 1, t: 0, heave: 0, alive: true };
  const seed = R() * 40;
  const stop = onFrame(sc, (dt) => {
    if (!st.alive) return false;
    st.t += dt;
    const heat = st.heat;
    floor.draw((g) => {
      if (heat <= 0) return;
      const lvl = heat > 0.66 ? 0 : heat > 0.33 ? 1 : 2;
      for (const c of cracks) {
        if (c.s > st.g) break;
        const fresh = st.g - c.s < 0.1;
        const flick = (Math.floor(st.t / 70) + c.x * 3 + c.y) % 9 === 0 ? 1 : 0;
        const col = fresh ? PAL.white : LAVA[clamp((c.main ? 2 : 3) + lvl - flick, 0, 5)];
        g.dpx(x + c.x, y + c.y, col, heat > 0.2 ? 1 : heat / 0.2);
        if (lvl < 2 && c.main) g.dpx(x + c.x, y + c.y - 1, PAL.fire1, 0.5 * heat);
      }
    });
    gash.draw((g) => {
      const k = st.g < 0.25 ? 0 : E.outBack(clamp((st.g - 0.25) / 0.75, 0, 1));
      const a = A * k * (1 + st.heave * 0.25);
      const b = B * k * (1 + st.heave * 0.4) * Math.max(0.15, heat);
      if (a < 1 || heat <= 0) return;
      const by = Math.max(1, Math.round(b));
      for (let yy = -by; yy <= by; yy++) {
        const v = yy / Math.max(1, b);
        const jag = 1 + (noise1(yy * 1.3 + 3, seed) - 0.5) * 0.4;
        const hw = a * Math.sqrt(Math.max(0, 1 - v * v)) * jag;
        if (hw < 0.5) continue;
        const x0 = Math.round(x - hw);
        const x1 = Math.round(x + hw);
        for (let xx = x0; xx <= x1; xx++) {
          // churning lava: two noise fields scrolling against each other
          const n = (noise1(xx * 0.35 + st.t * 0.006, seed + yy) + noise1(xx * 0.18 - st.t * 0.004, seed + 9 + yy * 0.5)) / 2;
          let c: number;
          if (heat < 0.35) c = n > 0.62 ? PAL.fire2 : n > 0.45 ? PAL.stone1 : PAL.stone0;
          else c = n > 0.72 ? PAL.gold4 : n > 0.58 ? PAL.fire4 : n > 0.4 ? PAL.fire3 : PAL.fire2;
          if (xx === x0 || xx === x1) c = PAL.stone0;
          else if (xx === x0 + 1 || xx === x1 - 1) c = heat > 0.35 ? PAL.fire1 : PAL.stone1;
          g.px(xx, y + yy, c);
        }
      }
      // crust lips: a lit top lip, a dark broken bottom lip
      for (let xx = Math.round(x - a); xx <= Math.round(x + a); xx++) {
        const u = (xx - x) / a;
        const ry = Math.round(b * Math.sqrt(Math.max(0, 1 - u * u)));
        g.px(xx, y - ry - 1, heat > 0.5 ? PAL.fire4 : PAL.stone2);
        g.px(xx, y - ry - 2, PAL.stone0);
        g.px(xx, y + ry + 1, PAL.stone0);
      }
    });
    return true;
  });
  return {
    grow: (ms) => run(sc, ms, (t) => (st.g = t)),
    cool: async (ms) => {
      await run(sc, ms, (t) => (st.heat = 1 - t));
      st.heat = 0;
    },
    heave: (k) => (st.heave = k),
    destroy() {
      if (!st.alive) return;
      st.alive = false;
      stop();
      floor.destroy();
      gash.destroy();
    },
  };
}

/** Molten gobs thrown out of the gash (gravity, cooling ramp). */
function lavaSpray(S: Stage, n: number, power = 1): void {
  const sp = new Sparks(S.scene, DEPTH.FX - 1);
  const { x, y } = S.home;
  for (let i = 0; i < n; i++) {
    const a = RR(-Math.PI * 0.92, -Math.PI * 0.08);
    const v = RR(90, 210) * power;
    sp.add({ x: x + RR(-12, 12), y: y - RR(0, 4), vx: Math.cos(a) * v * 0.8, vy: Math.sin(a) * v, ay: 520, drag: 0.4, life: RR(420, 700), ramp: [PAL.gold4, PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1], tex: i % 3 === 0 ? TEX.px2 : TEX.px1, trail: i % 2 === 0 });
  }
  sp.close();
}

/** A ring of flame tongues licking up around the feet (the roar's vent eruption). */
function flameRing(S: Stage, rad: number, ms: number): void {
  const sc = S.scene;
  const { x, y } = S.home;
  const H = 34;
  const W = rad * 2 + 12;
  const back = new Raster(sc, x - W / 2, y - rad / 2 - H - 4, W, rad + H + 10, S.depth - 0.6);
  const front = new Raster(sc, x - W / 2, y - rad / 2 - H - 4, W, rad + H + 10, S.depth + 0.6);
  const n = 22;
  const seed = R() * 30;
  bg(
    run(sc, ms, (t, el) => {
      const env = t < 0.2 ? E.outCubic(t / 0.2) : 1 - E.inQuad((t - 0.2) / 0.8);
      const draw = (g: Raster, isFront: boolean) => {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU;
          if (Math.sin(a) >= 0 !== isFront) continue;
          const bx = x + Math.cos(a) * rad * (0.9 + 0.2 * t);
          const by = y + Math.sin(a) * rad * 0.5 * (0.9 + 0.2 * t);
          const h = Math.round((10 + noise1(i * 1.7 + el * 0.02, seed) * 22) * env);
          for (let k = 0; k < h; k++) {
            const f = k / Math.max(1, h);
            const w = Math.max(0, Math.round((1 - f) * 2.2));
            const sway = Math.sin(k * 0.4 + el * 0.03 + i) * f * 2;
            const c = f < 0.25 ? PAL.gold4 : f < 0.55 ? PAL.fire4 : f < 0.8 ? PAL.fire3 : PAL.fire2;
            for (let dx = -w; dx <= w; dx++) g.px(bx + dx + sway, by - k, Math.abs(dx) === w && w > 0 ? PAL.fire2 : c);
          }
        }
      };
      back.draw((g) => draw(g, false));
      front.draw((g) => draw(g, true));
    }).then(() => {
      back.destroy();
      front.destroy();
    }),
  );
}

signatureSummon('magma_titan', async (S) => {
  const sc = S.scene;
  const { unit, sprite, home, rest } = S;
  if (S.big) bg(S.ctx.focus({ x: home.x, y: home.y - 32 }, { zoom: 1.05, ms: 520, pan: 0.3 }));
  const circle = S.openCircle();
  const split = S.own(lavaSplit(S));
  playSfx('groundCrack', { volume: 0.8 });
  playSfx('summonCharge', { volume: 0.6, pitch: 0.7 });
  bg(shake(sc, 320, 1));
  embers(sc, home.x, home.y, { radius: 22, duration: 340, frequency: 40, count: 1, speed: 0.6, depth: DEPTH.FX - 1 });
  smokePuffs(sc, home.x, home.y - 2, { radius: 26, duration: 300, frequency: 90, count: 1, depth: S.depth + 0.5, ramp: RAMPS.stone });
  await split.grow(260);
  circle.pulse(100);
  circle.spin(2.2);
  await S.wait(90);

  await S.climax();

  // ---- the burst out of the lava
  playSfx('fireBurst', { volume: 0.9 });
  playSfx('impactHeavy', { volume: 0.5, pitch: 0.8 });
  const box0 = bodyBox(unit);
  const dist = Math.ceil(box0.bottom - box0.top) + 4;
  sprite.setPosition(rest.x, rest.y + dist);
  const P = holo(unit, MOLTEN, { clipY: home.y + 1, glitch: 0.08, flicker: 0.1, gain: 0.8 });
  unit.showSprite();
  split.heave(1);
  const lava = S.own(geyser(S, { height: S.big ? 112 : 86, width: S.big ? 22 : 18, kind: 'lava' }));
  bg(lava.rise(70));
  let fell = false;
  lavaSpray(S, S.big ? 30 : 18);
  bg(shake(sc, 180, 3));
  const bar = S.own(scanBar(sc, FIRE, S.depth + 0.6));
  const OVER = 7;
  await run(sc, 230, (t) => {
    // fast up with an overshoot above the rest point, then drop back onto it
    const yy = t < 0.7 ? lerp(rest.y + dist, rest.y - OVER, E.outCubic(t / 0.7)) : lerp(rest.y - OVER, rest.y, E.inQuad((t - 0.7) / 0.3));
    sprite.setY(Math.round(yy));
    unit.lift = Math.max(0, rest.y - yy);
    if (t < 0.6) bar.at(home.y, box0.left - 2, box0.right + 2);
    else bar.hide();
    if (t > 0.5) P.clipY = null;
    // the lava column falls back as soon as the body is out, so the silhouette reads
    if (!fell && t > 0.45) {
      fell = true;
      bg(lava.fall(220));
    }
  });
  bar.destroy();
  sprite.setY(rest.y);
  unit.lift = 0;
  P.clipY = null;
  split.heave(0);
  // landing thud
  bg(run(sc, 150, (t) => sprite.setScale(1 + 0.07 * (1 - t) * Math.cos(t * 7), 1 - 0.09 * (1 - t) * Math.cos(t * 7))).then(() => sprite.setScale(1)));
  bg(settleHolo(sc, unit, 300));

  // ---- the roar: vents erupt on the peak, then the chest beats
  await S.roar({
    from: 1,
    peak: 4,
    onPeak: () => {
      flameRing(S, S.big ? 30 : 24, 520);
      lavaSpray(S, S.big ? 22 : 14, 0.8);
      embers(sc, home.x, home.y - 10, { count: S.big ? 46 : 28, speed: 2, depth: DEPTH.FX - 1, life: 1.1 });
      smokePuffs(sc, home.x, home.y - 6, { radius: 24, count: S.big ? 10 : 6, depth: S.depth + 0.5, ramp: RAMPS.stone });
      S.finale({ ring: S.big ? 94 : 58, ramp: FIRE, flashColor: S.big ? PAL.fire4 : undefined, flashAlpha: 0.28, freezeMs: S.big ? 60 : 0, sfx: 'summonBurst' });
      playSfx('fireBurst', { volume: 0.8, pitch: 0.8 });
      bg(split.cool(700).then(() => split.destroy()));
      bg(circle.dismiss(420));
      // the chest beats that follow (f5–f7): a thud and an ember puff each
      bg(
        (async () => {
          for (const f of [5, 6, 7]) {
            if (f >= unit.art.anims.roar.frames) break;
            await untilFrame(unit, 'roar', f);
            if (unit.frameInfo().anim !== 'roar') break;
            bg(shake(sc, 70, 1));
            playSfx('impactLight', { volume: 0.35, pitch: 0.7 });
            const c: XY = unit.core();
            embers(sc, c.x, c.y, { count: 6, speed: 0.8, depth: DEPTH.FX - 1 });
          }
        })(),
      );
    },
  });
  await S.wait(S.big ? 130 : 110);
});
