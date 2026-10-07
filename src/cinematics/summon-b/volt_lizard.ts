// Şimşek Kertenkelesi (volt_lizard) — signature summon: "summoned by a lightning strike".
//
//   0      the card slams onto the tile (kit)
//   +0     the world darkens a touch; static builds on the tile: tiny arcs skitter over the
//          card, sparks rise, a charged ring of dashes contracts around it; distant thunder
//   +280   a thin stepped leader crawls down from the sky
//   +380   STRIKE: a thick white-cyan bolt slams into the tile (50 ms freeze, flash, 3 px
//          shake, thunder) and the lizard is simply THERE inside it — a white silhouette that
//          cools through electric cyan into its true colours while arcs crawl over its body;
//          the floor is left scorched with glowing cracks
//   +500   roar from f0; f3 (reared, crest blazing): arcs leap off the crest — finale (cyan
//          shockwave, ATK/DEF badge pop, roar)
//   resolve ≈ +950 (total ≈ 1.2 s).

import { PAL, RAMPS, type Ramp } from '../../art/palette';
import { DEPTH, GAME_H, GAME_W, type XY } from '../../view/layout';
import { flash, shake } from '../../vfx/core';
import { freeze } from '../../vfx/setpieces';
import { opaquePoints } from '../../vfx/hologram';
import { registerCardHook } from '../api';
import { ADD, E, Raster, Sparks, TAU, bg, bodyBox, burst, entrance, holo, holoSettle, lerp, liveLayer, onFloor, pose, rnd, roar, rr, run, type Entrance } from './_kit';

const CYAN: Ramp = RAMPS.cyan;
const ARC = [PAL.white, PAL.cyan4, PAL.cyan3, PAL.cyan2] as const;

/** Midpoint-displacement zigzag from a to b (own random stream: films stay repeatable). */
function zigzag(a: XY, b: XY, amp: number, levels = 5): XY[] {
  let pts: XY[] = [a, b];
  let k = amp;
  for (let l = 0; l < levels; l++) {
    const next: XY[] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1];
      const q = pts[i];
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      const off = rr(-k, k);
      next.push({ x: (p.x + q.x) / 2 + (-dy / len) * off, y: (p.y + q.y) / 2 + (dx / len) * off });
      next.push(q);
    }
    pts = next;
    k *= 0.55;
  }
  return pts;
}

/** Thick glowing polyline: halo → body → core. */
function drawBolt(r: Raster, pts: readonly XY[], w: number, lv = 1): void {
  if (w >= 2) r.thickPath(pts, w + 1.5, PAL.cyan2, 0.45 * lv);
  r.thickPath(pts, Math.max(0.6, w), PAL.cyan3, lv);
  if (w >= 1.5) r.thickPath(pts, w - 0.8, PAL.cyan4, lv);
  r.path(pts, PAL.white, lv);
}

/** Static on the tile: skittering arcs, rising sparks and a contracting charged ring. */
function staticBuild(e: Entrance): { stop(): void } {
  const { scene: sc, home } = e;
  const sparks = new Sparks(sc, DEPTH.FX - 1, ADD);
  let acc = 0;
  let arcs: XY[][] = [];
  let next = 0;
  const layer = liveLayer(
    sc,
    home.x,
    home.y,
    120,
    70,
    DEPTH.SHADOW + 2,
    (r, el, dt) => {
      const k = Math.min(1, el / 380);
      // charged ring of dashes, contracting (two rows, a bright crawling head)
      const R = lerp(44, 20, E.outQ(k));
      for (let i = 0; i < 48; i++) {
        if ((i + Math.floor(el / 40)) % 4 === 0) continue;
        const a = (i / 48) * TAU - el * 0.006;
        const p = onFloor(home.x, home.y, R, a);
        const head = (i + Math.floor(el / 25)) % 12 === 0;
        r.px(p.x, p.y, head ? PAL.white : PAL.cyan4);
        r.px(p.x, p.y + 1, PAL.cyan3, 170);
      }
      // skittering arcs on and around the card (re-rolled every ~2 frames)
      next -= dt;
      if (next <= 0) {
        next = 34;
        arcs = [];
        const n = 2 + Math.floor(k * 4);
        for (let i = 0; i < n; i++) {
          const a = onFloor(home.x, home.y, rr(0, 22), rnd() * TAU);
          const b = { x: a.x + rr(-9, 9), y: a.y + rr(-5, 3) };
          arcs.push(zigzag(a, b, 3, 3));
        }
      }
      for (const pts of arcs) r.path(pts, rnd() < 0.5 ? PAL.white : PAL.cyan4);
      acc += dt;
      while (acc > 40) {
        acc -= 40;
        const p = onFloor(home.x, home.y, rr(4, 24), rnd() * TAU);
        sparks.add({ x: p.x, y: p.y, vy: rr(-60, -25), vx: rr(-6, 6), life: rr(200, 380), ramp: [...ARC], flicker: true });
      }
    },
    ADD,
  );
  return {
    stop() {
      layer.stop();
      sparks.close();
    },
  };
}

/** Darken the world a little (in-world rectangle under the units, so the monster stays bright). */
function gloom(e: Entrance): { lift(ms: number): Promise<void> } {
  const { scene: sc } = e;
  const rect = sc.add.rectangle(-80, -80, GAME_W + 160, GAME_H + 160, PAL.ink, 1).setOrigin(0).setDepth(DEPTH.SHADOW + 1).setAlpha(0);
  bg(run(sc, 220, (t) => rect.setAlpha(0.32 * t)));
  return {
    async lift(ms: number) {
      const a0 = rect.alpha;
      await run(sc, ms, (t) => rect.setAlpha(a0 * (1 - t)));
      rect.destroy();
    },
  };
}

/** Stepped leader, then the main strike with two re-strikes. onStrike fires at the strike. */
function skyStrike(e: Entrance, onStrike: () => void): Promise<void> {
  const { scene: sc, home, ctx } = e;
  const top: XY = { x: home.x + rr(-18, 18), y: -20 };
  const to: XY = { x: home.x, y: home.y - 2 };
  const LEADER = 100;
  const MS = 520;
  let bolt = zigzag(top, to, 26, 6);
  let frame = 0;
  let struck = false;
  const layer = liveLayer(sc, home.x, (home.y - 20) / 2, 140, home.y + 40, DEPTH.FX_TOP + 5, () => undefined, ADD);
  return run(sc, MS, (t, el, dt) => {
    if (dt > 0) frame++;
    layer.r.draw((r) => {
      if (el < LEADER) {
        // the stepped leader: partial, thin, flickering
        const n = Math.max(2, Math.floor(bolt.length * E.inQ(el / LEADER)));
        if (frame % 3 !== 0) r.path(bolt.slice(0, n), PAL.mist, 0.8);
        return;
      }
      if (!struck) {
        struck = true;
        onStrike();
        ctx.sfx('thunder', { volume: 1 });
        ctx.sfx('lightning', { volume: 0.7 });
      }
      const s = (el - LEADER) / (MS - LEADER);
      if (el - LEADER < 120 && frame % 2 === 0) bolt = zigzag(top, to, 26, 6);
      const restrike = (s > 0.42 && s < 0.48) || (s > 0.62 && s < 0.66);
      const on = s < 0.3 || restrike || Math.floor(frame / 2) % 2 === 0;
      if (!on) return;
      const w = s < 0.08 || restrike ? 3 : s < 0.3 ? 2 : 1;
      drawBolt(r, bolt, w, s < 0.3 || restrike ? 1 : 1 - s);
      if (s < 0.25) {
        // impact star on the tile
        const L = Math.round(14 * (1 - s / 0.25)) + 3;
        r.line(to.x - L, to.y, to.x + L, to.y, PAL.white);
        r.line(to.x, to.y - L * 0.6, to.x, to.y + L * 0.3, PAL.white);
      }
    });
  }).then(() => layer.stop());
}

/** The scorch left on the floor: a dark burn with glowing cracks that cool off. */
function scorch(e: Entrance): Promise<void> {
  const { scene: sc, home } = e;
  const cracks: XY[][] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + rr(-0.3, 0.3);
    cracks.push(zigzag(onFloor(home.x, home.y, 5, a), onFloor(home.x, home.y, rr(18, 28), a), 3, 3));
  }
  const layer = liveLayer(sc, home.x, home.y, 80, 44, DEPTH.CARD_ON_TILE + 2, () => undefined);
  return run(sc, 800, (t) => {
    layer.r.draw((r) => {
      const heat = 1 - t;
      r.ell(home.x, home.y, 17, 8.5, PAL.ink, 0.55 * heat + 0.1);
      const c = t < 0.15 ? PAL.white : t < 0.4 ? PAL.cyan4 : t < 0.7 ? PAL.cyan3 : PAL.cyan2;
      for (const pts of cracks) r.path(pts, c, t < 0.7 ? 1 : (1 - t) / 0.3);
    });
  }).then(() => layer.stop());
}

/** Small arcs crawling over the body (random opaque points, re-rolled). */
function bodyArcs(e: Entrance, ms: number): Promise<void> {
  const { scene: sc, sprite: s } = e;
  const box = bodyBox(s);
  if (!box) return Promise.resolve();
  const layer = liveLayer(sc, box.cx, box.cy, box.w + 30, box.h + 30, s.depth + 0.6, () => undefined, ADD);
  let arcs: XY[][] = [];
  let next = 0;
  return run(sc, ms, (t, _el, dt) => {
    next -= dt;
    if (next <= 0) {
      next = 50;
      const pts = opaquePoints(s, 8);
      arcs = [];
      for (let i = 0; i + 1 < pts.length && arcs.length < (t < 0.5 ? 3 : 1); i += 2) {
        const a = pts[i];
        const b = pts[i + 1];
        if (Math.hypot(a.x - b.x, a.y - b.y) > 22) continue;
        arcs.push(zigzag(a, b, 3, 3));
      }
    }
    layer.r.draw((r) => {
      for (const pts of arcs) r.path(pts, rnd() < 0.6 ? PAL.white : PAL.cyan4);
    });
  }).then(() => layer.stop());
}

/** Arcs leaping off the crest (top of the body) when the roar blazes. */
function crestDischarge(e: Entrance): Promise<void> {
  const { scene: sc, sprite: s } = e;
  const box = bodyBox(s);
  if (!box) return Promise.resolve();
  const tops = opaquePoints(s, 30)
    .filter((p) => p.y < box.top + box.h * 0.35)
    .slice(0, 4);
  const bolts = tops.map((p) => zigzag({ x: p.x, y: p.y }, { x: p.x + rr(-12, 12), y: p.y - rr(12, 22) }, 4, 3));
  const layer = liveLayer(sc, box.cx, box.top, box.w + 50, 60, DEPTH.FX + 2, () => undefined, ADD);
  return run(sc, 260, (t, _el) => {
    layer.r.draw((r) => {
      if (Math.floor(t * 12) % 3 === 2) return;
      for (const pts of bolts) drawBolt(r, pts, t < 0.3 ? 1.6 : 1, 1 - t * 0.6);
    });
  }).then(() => layer.stop());
}

async function voltPiece(e: Entrance): Promise<void> {
  const { ctx, scene: sc, unit: u, sprite: s, home } = e;
  // ---- anticipation: gloom + static
  const dark = gloom(e);
  const charge = staticBuild(e);
  ctx.sfx('thunder', { volume: 0.35, pitch: 0.6 });
  ctx.sfx('summonCharge', { volume: 0.45, pitch: 1.3 });
  await ctx.wait(280);

  // ---- the strike: the lizard is simply there in the flash
  let P: ReturnType<typeof holo> | null = null;
  const strike = skyStrike(e, () => {
    charge.stop();
    pose(u, 'roar', 0);
    P = holo(s, CYAN, { white: 1, tintMix: 1, scan: 0.5, glitch: 0.2, flicker: 0.3, gain: 1.1 });
    u.showSprite();
    bg(freeze(sc, 50));
    bg(flash(sc, 120, PAL.cyan4, 0.4));
    bg(shake(sc, 220, 3));
    bg(dark.lift(260));
    bg(scorch(e));
    burst(sc, home.x, home.y - 2, 22, { ramp: [...ARC], speed: [70, 190], up: 50, gravity: 360, life: [220, 460], spread: [Math.PI, TAU], depth: DEPTH.FX });
  });
  await ctx.wait(100 + 40);
  const p0 = P as ReturnType<typeof holo> | null;
  if (p0) p0.white = 0;
  bg(bodyArcs(e, 520));
  bg(holoSettle(sc, s, 300, false));

  // ---- roar: the crest blazes → discharge + finale
  const r = roar(ctx, u, {
    from: 0,
    sfx: 'roarSmall',
    volume: 0.85,
    onPeak: () => {
      e.finale({ ramp: CYAN, radius: 56, shake: 2, dust: null, sfx: 'lightning', volume: 0.5 });
      bg(crestDischarge(e));
    },
  });
  await r.peak;
  await strike;
  await ctx.wait(120);
}

registerCardHook('volt_lizard', 'summon', (ctx) => entrance(ctx, voltPiece), { name: 'summon-b:volt_lizard' });

