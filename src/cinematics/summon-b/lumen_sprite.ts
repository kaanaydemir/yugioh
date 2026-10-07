// Işık Perisi (lumen_sprite) — signature summon: "the fairy spiralling down in sparkles".
//
//   0      the card slams onto the tile (kit)
//   +0     a golden seal draws itself on the floor; a soft shaft of light falls onto the tile
//          from above with motes drifting down it (anticipation, a soft chime)
//   +120   a tiny star appears high in the shaft and spirals down around it (two turns,
//          tightening), shedding a twinkling trail of gold / white / cyan sparkles
//   +640   BLOOM at the fairy's heart: white star flash + sparkle burst; the fairy materializes
//          out of it in gold light while her roar spins her round (front → left → back)
//   +970   roar f5 — arms up in a V, the big star flash: finale (gold shockwave, a ring of
//          little stars blooming on the floor, lens streak, chime, ATK/DEF badge pop)
//   resolve ≈ +1170 (total ≈ 1.4 s). The +500 LP effect follows as its own event.

import { ATTRIBUTE_RAMP, PAL, type Ramp } from '../../art/palette';
import { TEX } from '../../vfx/core';
import { DEPTH, type XY, unitDepth } from '../../view/layout';
import { createMagicCircle, sparkleBurst } from '../../vfx/summon';
import { materialize } from '../../vfx/hologram';
import { registerCardHook } from '../api';
import { ADD, E, Sparks, TAU, bg, entrance, lerp, liveLayer, onFloor, pose, rnd, roar, rr, run, seg, star, type Entrance } from './_kit';

const LIGHT: Ramp = ATTRIBUTE_RAMP.LIGHT;
/** Materialize palette: one step darker than LIGHT so the body reads gold, not blown-out white. */
const GOLDR: Ramp = [PAL.gold0, PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4];
const TRAIL = [PAL.white, PAL.gold4, PAL.cyan4, PAL.gold3] as const;

/** A soft vertical shaft of light onto the tile; returns a fader. */
function lightShaft(e: Entrance, topY: number): { fade(ms: number): Promise<void> } {
  const { scene: sc, home } = e;
  const H = home.y - topY;
  const st = { k: 0, fade: 1 };
  const motes = new Sparks(sc, DEPTH.FX - 3, ADD);
  let acc = 0;
  const layer = liveLayer(
    sc,
    home.x,
    (topY + home.y) / 2,
    40,
    H + 10,
    unitDepth(home.y) - 1,
    (r, el, dt) => {
      st.k = Math.min(1, st.k + dt / 200);
      const lv = st.k * st.fade;
      if (lv <= 0.01) return;
      for (let y = topY; y <= home.y - 2; y++) {
        const v = (y - topY) / H; // 0 top → 1 floor
        if (E.outQ(st.k) < 1 - v && st.k < 1) continue; // unrolls downward
        const w = lerp(2, 5, v);
        const band = (y + Math.floor(el * 0.06)) % 13 === 0;
        const fall = 0.45 + 0.55 * v;
        for (let dx = -Math.ceil(w); dx <= Math.ceil(w); dx++) {
          const a = Math.abs(dx) / w;
          if (a > 1) continue;
          const c = band && a < 0.5 ? PAL.white : a < 0.34 ? PAL.gold4 : a < 0.7 ? LIGHT[2] : LIGHT[1];
          const al = (a < 0.34 ? 150 : a < 0.7 ? 90 : 50) * lv * fall;
          r.px(home.x + dx, y, c, Math.round(al));
        }
      }
      // light pooling on the floor
      r.ell(home.x, home.y, 14, 7, LIGHT[1], 0.3 * lv);
      r.ring(home.x, home.y, 14, 7, LIGHT[3], 0.6 * lv);
      acc += dt;
      while (acc > 45 && st.fade > 0.5) {
        acc -= 45;
        motes.add({ x: home.x + rr(-5, 5), y: topY + rr(0, H * 0.7), vy: rr(30, 60), life: rr(300, 520), ramp: [PAL.white, PAL.gold4, PAL.gold3], flicker: true });
      }
    },
    ADD,
  );
  return {
    async fade(ms: number) {
      await run(sc, ms, (t) => (st.fade = 1 - t));
      motes.close();
      layer.stop();
    },
  };
}

/** The falling star: spirals down around the shaft axis to `to`, shedding sparkles. */
async function starSpiral(e: Entrance, from: XY, to: XY, ms: number): Promise<void> {
  const { scene: sc, dir } = e;
  const trail = new Sparks(sc, DEPTH.FX + 1, ADD);
  const head = liveLayer(sc, to.x, (from.y + to.y) / 2, 80, to.y - from.y + 40, DEPTH.FX + 2, () => undefined, ADD);
  let last = 0;
  ctx_chime(e, 1.5);
  await run(sc, ms, (t, el) => {
    const k = E.inOutS(t);
    const R = lerp(16, 0, Math.pow(t, 1.3));
    const th = -Math.PI / 2 + k * 2 * TAU;
    const x = to.x + Math.cos(th) * R * dir;
    const y = lerp(from.y, to.y, k) + Math.sin(th) * R * 0.3;
    head.r.draw((r) => {
      const tw = Math.floor(el / 40) % 3;
      star(r, x, y, tw === 0 ? 5 : 4, PAL.white, PAL.gold3);
      r.px(x, y, PAL.white);
    });
    if (el - last > 16) {
      last = el;
      for (let i = 0; i < 2; i++)
        trail.add({ x: x + rr(-2, 2), y: y + rr(-2, 2), vx: rr(-10, 10), vy: rr(6, 22), drag: 1.5, life: rr(300, 520), color: TRAIL[Math.floor(rnd() * TRAIL.length)], tex: rnd() < 0.3 ? TEX.plus : TEX.px1, flicker: rnd() < 0.5 });
    }
    if (t > 0.45 && Math.floor(el / 130) !== Math.floor((el - 17) / 130)) ctx_chime(e, 1.6 + t * 0.6);
  });
  head.stop();
  trail.close();
}

/** A soft high chime (sparkle twinkle). */
function ctx_chime(e: Entrance, pitch: number): void {
  e.ctx.sfx('holyChime', { volume: 0.18, pitch });
}

/** Little stars blooming in a ring on the floor around the tile. */
function starRing(e: Entrance): Promise<void> {
  const { scene: sc, home } = e;
  const n = 8;
  const layer = liveLayer(sc, home.x, home.y, 110, 60, DEPTH.TILE_FX + 3, () => undefined, ADD);
  return run(sc, 520, (t) => {
    layer.r.draw((r) => {
      for (let i = 0; i < n; i++) {
        const tt = seg(t, i * 0.035, 0.6 + i * 0.035);
        if (tt <= 0 || tt >= 1) continue;
        const p = onFloor(home.x, home.y, lerp(14, 38, E.outC(tt)), (i / n) * TAU + 0.2);
        const l = Math.round(3 * Math.sin(Math.PI * tt)) + 1;
        star(r, p.x, p.y, l, PAL.white, i % 2 ? PAL.gold4 : PAL.cyan4, tt < 0.8 ? 1 : 0.5);
      }
    });
  }).then(() => layer.stop());
}

/** Horizontal lens streak (anime glint) at a point. */
function lensStreak(e: Entrance, at: XY, ms: number): Promise<void> {
  const { scene: sc } = e;
  const layer = liveLayer(sc, at.x, at.y, 110, 20, DEPTH.FX + 4, () => undefined, ADD);
  return run(sc, ms, (t) => {
    layer.r.draw((r) => {
      const env = t < 0.15 ? t / 0.15 : 1 - E.inQ((t - 0.15) / 0.85);
      const L = Math.round(46 * env);
      if (L <= 0) return;
      r.line(at.x - L, at.y, at.x + L, at.y, LIGHT[3]);
      r.line(at.x - L * 0.6, at.y, at.x + L * 0.6, at.y, PAL.gold4);
      r.line(at.x - L * 0.3, at.y, at.x + L * 0.3, at.y, PAL.white);
      if (env > 0.5) {
        r.line(at.x - L * 0.25, at.y - 1, at.x + L * 0.25, at.y - 1, PAL.gold4, 0.7);
        r.line(at.x - L * 0.25, at.y + 1, at.x + L * 0.25, at.y + 1, PAL.gold4, 0.7);
      }
      const V = Math.round(10 * env);
      r.line(at.x, at.y - V, at.x, at.y + V, PAL.white);
    });
  }).then(() => layer.stop());
}

async function lumenPiece(e: Entrance): Promise<void> {
  const { ctx, scene: sc, unit: u, sprite: s, home, rest } = e;
  // ---- anticipation: seal + shaft of light
  const circle = createMagicCircle(sc, home.x, home.y, { attribute: 'LIGHT', player: e.player, appearMs: 220 });
  const shaft = lightShaft(e, rest.y - 120);
  ctx.sfx('holyChime', { volume: 0.4, pitch: 1.2 });
  await ctx.wait(120);

  // ---- the star spirals down to the fairy's heart
  const heart = { x: rest.x + (u.art.core.x - u.art.anchorX) * e.dir, y: rest.y + (u.art.core.y - u.art.anchorY) };
  await starSpiral(e, { x: home.x, y: rest.y - 104 }, heart, 470);

  // ---- bloom: she materializes out of the star while her roar spins her round
  void sparkleBurst(sc, heart.x, heart.y, { ramp: LIGHT, count: 16, depth: DEPTH.FX + 2 });
  ctx.sfx('materialize', { volume: 0.7, pitch: 1.2 });
  const bloom = liveLayer(sc, heart.x, heart.y, 40, 40, DEPTH.FX + 3, () => undefined, ADD);
  bg(run(sc, 140, (t) => bloom.r.draw((r) => star(r, heart.x, heart.y, Math.round(lerp(10, 2, E.outQ(t))), PAL.white, PAL.gold4, t < 0.6 ? 1 : 0.5))).then(() => bloom.stop()));
  pose(u, 'roar', 1);
  const mat = materialize(sc, s, { ramp: GOLDR, ms: 330 });
  u.showSprite();
  const r = roar(ctx, u, {
    from: 1,
    sfx: 'roarSmall',
    pitch: 1.7,
    volume: 0.4,
    onPeak: () => {
      e.finale({ ramp: LIGHT, radius: 50, shake: 1, dust: null, sfx: 'holyChime', volume: 0.7 });
      bg(starRing(e));
      bg(lensStreak(e, { x: heart.x, y: heart.y - 6 }, 260));
      void sparkleBurst(sc, heart.x, heart.y - 6, { ramp: LIGHT, count: 12, depth: DEPTH.FX + 2 });
      bg(circle.dismiss(320));
    },
  });
  bg(ctx.wait(120).then(() => shaft.fade(320)));
  await r.peak;
  await mat;
  await ctx.wait(160);
}

registerCardHook('lumen_sprite', 'summon', (ctx) => entrance(ctx, lumenPiece), { name: 'summon-b:lumen_sprite' });

