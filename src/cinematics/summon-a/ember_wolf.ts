// Kor Kurdu — "Ateş Çemberi" (signature summon entrance, normal summon ≤ 1.8 s).
//
//   0     the card slams (≈250 ms); the fire circle draws on and a RING OF FIRE ignites around
//         the tile, the flame running from the far side round both ways to meet at the front
//   ~250  a flame-hologram wolf bursts out of the ring and RUNS three quarters round it (behind
//         the near flames, afterimages streaming, scanlines), turns, and LEAPS into the centre
//   ~630  it lands — paws planted (attack f7), squash, ember dust, a small floor ring; the ring
//         of fire flares inward, the hologram cools to true colours
//   peak  howl (roar f4, muzzle to the sky): the ring erupts into tall flame tongues, ember
//         burst, fire shock ring, 2 px shake, badge pop
// Player 2 runs the mirrored way and leaps facing left.

import { PAL, RAMPS, type Ramp } from '../../art/palette';
import { DEPTH } from '../../view/layout';
import { embers } from '../../vfx/particles';
import { landingDust, shockwave } from '../../vfx/summon';
import { shake } from '../../vfx/core';
import {
  E,
  R,
  Raster,
  TAU,
  afterimage,
  bg,
  clamp,
  face,
  holdFrame,
  holo,
  lerp,
  noise1,
  onFrame,
  playSfx,
  run,
  settleHolo,
  signatureSummon,
  type Stage,
} from './_kit';

const FIRE: Ramp = RAMPS.fire;
/** Darker flame palette for the running hologram (keeps the wolf's silhouette readable). */
const EMBER: Ramp = [PAL.night1, PAL.fire0, PAL.fire1, PAL.fire2, PAL.fire3];

interface Ring {
  ignite(ms: number): Promise<void>;
  /** Flame height multiplier and radius multiplier. */
  set(h: number, r: number): void;
  erupt(ms: number): Promise<void>;
  destroy(): void;
}

/** A ring of flame tongues on the floor around the tile (back half behind the unit, front over it). */
function fireRing(S: Stage, RAD: number): Ring {
  const sc = S.scene;
  const { x, y } = S.home;
  const HMAX = 40;
  const W = RAD * 2 + 16;
  const back = new Raster(sc, x - W / 2, y - RAD / 2 - HMAX - 6, W, RAD + HMAX + 14, S.depth - 0.6);
  const front = new Raster(sc, x - W / 2, y - RAD / 2 - HMAX - 6, W, RAD + HMAX + 14, S.depth + 0.6);
  const n = 30;
  const seed = R() * 30;
  const st = { lit: 0, h: 1, r: 1, t: 0, alive: true };
  const draw = (g: Raster, isFront: boolean) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU - Math.PI / 2;
      if (Math.sin(a) >= 0 !== isFront) continue;
      // ignition runs from the far point (−π/2) round both sides to the front
      const along = Math.abs(((a + Math.PI / 2 + TAU) % TAU) - Math.PI) ;
      const reach = (1 - along / Math.PI) ; // 1 at the far point, 0 at the front
      const on = clamp((st.lit * 1.15 - (1 - reach)) * 6, 0, 1);
      if (on <= 0) continue;
      const bx = x + Math.cos(a) * RAD * st.r;
      const by = y + Math.sin(a) * RAD * 0.5 * st.r;
      const hh = Math.round((4 + noise1(i * 1.9 + st.t * 0.018, seed) * 8) * st.h * on);
      // ember bed under every tongue
      g.px(bx, by, PAL.fire2);
      g.px(bx + 1, by, PAL.fire1);
      for (let k = 0; k < hh; k++) {
        const f = k / Math.max(1, hh);
        const w = Math.max(0, Math.round((1 - f) * 1.6));
        const sway = Math.sin(k * 0.5 + st.t * 0.02 + i) * f * 1.5;
        const c = f < 0.2 ? PAL.gold4 : f < 0.5 ? PAL.fire4 : f < 0.8 ? PAL.fire3 : PAL.fire2;
        for (let dx = -w; dx <= w; dx++) g.px(bx + dx + sway, by - k, Math.abs(dx) === w && w > 0 ? PAL.fire2 : c);
      }
    }
  };
  const stop = onFrame(sc, (dt) => {
    if (!st.alive) return false;
    st.t += dt;
    back.draw((g) => draw(g, false));
    front.draw((g) => draw(g, true));
    return true;
  });
  const ring: Ring = {
    ignite: (ms) => run(sc, ms, (t) => (st.lit = E.outCubic(t))),
    set(h, r) {
      st.h = h;
      st.r = r;
    },
    async erupt(ms) {
      const r0 = st.r;
      await run(sc, ms, (t) => {
        st.h = t < 0.2 ? lerp(1, 3.2, E.outCubic(t / 0.2)) : lerp(3.2, 0, E.inQuad((t - 0.2) / 0.8));
        st.r = r0 + 0.25 * E.outCubic(t);
      });
      ring.destroy();
    },
    destroy() {
      if (!st.alive) return;
      st.alive = false;
      stop();
      back.destroy();
      front.destroy();
    },
  };
  return ring;
}

signatureSummon('ember_wolf', async (S) => {
  const sc = S.scene;
  const { unit, sprite, home, rest } = S;
  const circle = S.openCircle();
  const RAD = S.big ? 42 : 38;
  const ring = S.own(fireRing(S, RAD));
  playSfx('fireBurst', { volume: 0.6, pitch: 1.2 });
  embers(sc, home.x, home.y, { radius: RAD * 0.8, duration: 600, frequency: 40, count: 1, speed: 0.7, depth: DEPTH.FX - 1 });
  await ring.ignite(230);
  circle.pulse(90);

  // ---- the flame wolf runs round the ring (3/4 turn, through the back), then leaps in
  const p2 = S.dir < 0;
  // P1: front (π/2) → right → back → left point (−π), leap rightward into the centre; P2 mirrored
  const a0 = Math.PI / 2;
  const a1 = p2 ? 2 * Math.PI : -Math.PI;
  const P = holo(unit, EMBER, { reveal: 0, gain: 0.8, glitch: 0.12 });
  unit.showSprite();
  playSfx('whoosh', { volume: 0.5, pitch: 1.3 });
  let lastEcho = -99;
  let lastX = home.x;
  const RUN = 290;
  await run(sc, RUN, (t, el) => {
    const a = lerp(a0, a1, E.inOutSine(t));
    const fx = home.x + Math.cos(a) * RAD * 0.95;
    const fy = home.y + Math.sin(a) * RAD * 0.5 * 0.95;
    sprite.setPosition(Math.round(fx), Math.round(fy));
    sprite.setDepth(unitDepthAt(fy));
    if (Math.abs(fx - lastX) > 0.3) face(unit, fx < lastX);
    lastX = fx;
    holdFrame(unit, 'attack', Math.floor(el / 70) % 2 === 0 ? 4 : 5);
    P.reveal = clamp(t / 0.35, 0, 1);
    if (el - lastEcho > 55) {
      lastEcho = el;
      afterimage(sc, sprite, PAL.fire2, { alpha: 0.4, ms: 170 });
    }
  });
  // turn to face the centre and leap
  face(unit, p2);
  const from = { x: sprite.x, y: sprite.y };
  holdFrame(unit, 'attack', 4);
  playSfx('whoosh', { volume: 0.6 });
  await run(sc, 140, (t, el) => {
    const e = E.outQuad(t);
    const hop = Math.sin(Math.PI * t) * 12;
    sprite.setPosition(Math.round(lerp(from.x, rest.x, e)), Math.round(lerp(from.y, rest.y, e) - hop));
    sprite.setDepth(S.depth);
    unit.lift = hop;
    if (t > 0.25) holdFrame(unit, 'attack', 5);
    if (el - lastEcho > 40) {
      lastEcho = el;
      afterimage(sc, sprite, PAL.fire2, { alpha: 0.4, ms: 150 });
    }
  });
  sprite.setPosition(rest.x, rest.y);
  unit.lift = 0;
  face(unit, unit.flipX);

  // ---- landing
  holdFrame(unit, 'attack', 7);
  playSfx('impactLight', { volume: 0.6 });
  bg(shake(sc, 110, 2));
  bg(landingDust(sc, home.x, home.y, PAL.fire2, { count: 8 }));
  bg(shockwave(sc, home.x, home.y, { ramp: FIRE, radius: 30, ms: 260, thickness: 3 }));
  embers(sc, home.x, home.y - 4, { count: 14, speed: 1.2, depth: DEPTH.FX - 1 });
  bg(run(sc, 140, (t) => sprite.setScale(1 + 0.1 * (1 - t) * Math.cos(t * 8), 1 - 0.12 * (1 - t) * Math.cos(t * 8))).then(() => sprite.setScale(1)));
  ring.set(1.6, 0.8);
  bg(settleHolo(sc, unit, 200));
  await S.wait(70);
  ring.set(1.2, 0.85);

  // ---- the howl
  await S.roar({
    from: 1,
    peak: 4,
    sfx: 'roarSmall',
    lead: 120,
    onPeak: () => {
      bg(ring.erupt(460));
      embers(sc, home.x, home.y - 8, { count: S.big ? 34 : 22, speed: 1.8, depth: DEPTH.FX - 1, life: 1 });
      S.finale({ ring: S.big ? 80 : 56, ramp: FIRE, sfx: 'fireBurst' });
      bg(circle.dismiss(360));
    },
  });
  await S.wait(100);
});

function unitDepthAt(y: number): number {
  return DEPTH.UNIT + y;
}
