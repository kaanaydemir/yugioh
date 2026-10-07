// Gölge Suikastçı (shade_assassin) — signature summon: "emerging from a shadow puddle".
//
//   0      the card slams onto the tile (kit)
//   +0     a pool of liquid shadow spreads out from under the card and swallows it (ink core,
//          violet rim, specks swirling inside), wisps curl up off its edge; a dark pulse
//   +260   two violet eyes open inside the pool — and blink (the anticipation beat)
//   +380   the assassin RISES out of the pool, clipped at the floor line, daggers crossed,
//          violet afterimages and shadow streaming off the surface as he breaks through
//   +680   the hologram settles; roar from f2: the daggers spin (whisk), f6 flourish with the
//          eyes flaring — finale: the pool SNAPS shut (the card reappears), void shockwave,
//          ATK/DEF badge pop
//   resolve ≈ +1150 (total ≈ 1.4 s).

import { PAL, RAMPS, type Ramp } from '../../art/palette';
import { DEPTH, unitDepth } from '../../view/layout';
import { shadowWisps } from '../../vfx/particles';
import { registerCardHook } from '../api';
import { ADD, E, Sparks, TAU, bg, bodyBox, entrance, holo, holoSettle, lerp, liveLayer, pose, roar, rr, run, whenFrame, type Entrance } from './_kit';

const VOID: Ramp = RAMPS.void;

/** The shadow pool: grows, swirls, can be pulsed and snapped shut. */
function shadowPool(e: Entrance, maxR: number): { open(ms: number): Promise<void>; close(ms: number): Promise<void>; eyes(on: boolean): void } {
  const { scene: sc, home } = e;
  const st = { r: 0, alive: true, eyes: false, eyeT: 0 };
  const layer = liveLayer(sc, home.x, home.y, maxR * 2 + 16, maxR + 20, DEPTH.CARD_ON_TILE + 2, (r, el, dt) => {
    if (st.r < 0.5) return;
    st.eyeT += dt;
    const R = st.r;
    const rot = el * 0.004;
    for (let y = Math.floor(home.y - R / 2) - 2; y <= Math.ceil(home.y + R / 2) + 2; y++) {
      for (let x = Math.floor(home.x - R) - 2; x <= Math.ceil(home.x + R) + 2; x++) {
        const u = x + 0.5 - home.x;
        const v = (y + 0.5 - home.y) * 2;
        const d = Math.hypot(u, v);
        const a = Math.atan2(v, u);
        const edge = R * (1 + 0.09 * Math.sin(a * 5 + el * 0.008) + 0.05 * Math.sin(a * 9 - el * 0.013));
        if (d > edge) continue;
        if (d > edge - 1.5) {
          // rim: lit front lip, dim back
          r.px(x, y, Math.sin(a) > 0.2 ? VOID[3] : VOID[2]);
          continue;
        }
        if (d > edge - 3.5) {
          r.px(x, y, VOID[0]);
          continue;
        }
        // ink core with spiral specks turning inside
        const sp = (a * 3 + d * 0.35 - rot * 3) / TAU;
        const speck = sp - Math.floor(sp) < 0.04 && (x + y) % 2 === 0;
        r.px(x, y, speck ? VOID[2] : PAL.ink);
      }
    }
    if (st.eyes) {
      // two glowing eyes looking up out of the dark (blink at ~120 ms)
      const blink = st.eyeT > 100 && st.eyeT < 150;
      const ex = home.x + 2 * e.dir;
      const ey = home.y - 1;
      for (const off of [-4, 3]) {
        const cx = ex + off;
        if (blink) {
          r.px(cx - 1, ey, VOID[2]);
          r.px(cx, ey, VOID[2]);
          r.px(cx + 1, ey, VOID[2]);
          continue;
        }
        // a slanted glowing slit with a faint halo
        r.px(cx - 1, ey + (e.dir > 0 ? 0 : -1), VOID[3]);
        r.px(cx, ey, PAL.white);
        r.px(cx + 1, ey + (e.dir > 0 ? -1 : 0), VOID[4]);
        for (const [hx, hy] of [[-1, -1], [0, -1], [1, -2], [-2, 0], [2, -1], [0, 1]]) r.px(cx + hx * e.dir, ey + hy, VOID[3], 110);
      }
    }
  });
  return {
    open: (ms) => run(sc, ms, (t) => (st.r = lerp(3, maxR, E.outC(t)))),
    async close(ms) {
      const r0 = st.r;
      st.eyes = false;
      await run(sc, ms, (t) => (st.r = r0 * (1 - E.inQ(t))));
      st.alive = false;
      layer.stop();
    },
    eyes(on) {
      st.eyes = on;
      st.eyeT = 0;
    },
  };
}

async function shadePiece(e: Entrance): Promise<void> {
  const { ctx, scene: sc, unit: u, sprite: s, home, rest } = e;
  // ---- the pool spreads and swallows the card
  const pool = shadowPool(e, 19);
  ctx.sfx('darkPulse', { volume: 0.6, pitch: 0.9 });
  bg(pool.open(220));
  shadowWisps(sc, home.x, home.y, { radius: 16, duration: 700, frequency: 70, count: 1, depth: unitDepth(home.y) + 0.5 });
  await ctx.wait(200);
  // ---- eyes in the dark
  pool.eyes(true);
  await ctx.wait(210);

  // ---- the rise, clipped at the floor line
  pose(u, 'roar', 1);
  s.setPosition(rest.x, rest.y);
  const b = bodyBox(s);
  const H = b ? Math.ceil(b.bottom - b.top) + 2 : 48;
  const P = holo(s, VOID, { clipY: home.y, scan: 0.45, glitch: 0.04, tintMix: 0.65, gain: 1.05, flicker: 0.12 });
  s.y = rest.y + H;
  u.showSprite();
  ctx.sfx('whoosh', { volume: 0.7, pitch: 0.6 });
  ctx.sfx('darkPulse', { volume: 0.5, pitch: 1.2 });
  const streams = new Sparks(sc, DEPTH.FX - 1, ADD);
  await run(sc, 270, (t) => {
    s.y = Math.round(rest.y + H * (1 - E.outC(t)));
    if (t > 0.2) pool.eyes(false);
    // shadow streaming off the surface where the body breaks through
    const bb = bodyBox(s);
    if (bb && t < 0.9)
      for (let i = 0; i < 2; i++) streams.add({ x: rr(bb.left + 2, bb.right - 2), y: home.y - rr(0, 2), vy: rr(-80, -40), vx: rr(-8, 8), drag: 1.5, life: rr(220, 380), ramp: [VOID[4], VOID[3], VOID[2], VOID[1]] });
  });
  streams.close();
  s.y = rest.y;
  P.clipY = null;
  bg(holoSettle(sc, s, 200, false));

  // ---- the dagger flourish → the pool snaps shut
  const r = roar(ctx, u, {
    from: 2,
    sfx: 'roarSmall',
    pitch: 1.15,
    volume: 0.75,
    onPeak: () => {
      bg(pool.close(110));
      e.finale({ ramp: VOID, radius: 50, shake: 2, dust: null, sfx: 'darkPulse', volume: 0.7 });
      shadowWisps(sc, home.x, home.y, { radius: 18, count: 10, depth: DEPTH.FX - 1 });
    },
  });
  await whenFrame(u, 'roar', 3);
  ctx.sfx('slash', { volume: 0.35, pitch: 1.3 });
  await r.peak;
  await ctx.wait(150);
}

registerCardHook('shade_assassin', 'summon', (ctx) => entrance(ctx, shadePiece), { name: 'summon-b:shade_assassin' });
