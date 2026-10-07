// Dikenli Pusucu (thorn_lurker) — signature summon: "bursting out of the ground in vines".
//
//   0      the card slams onto the tile (kit)
//   +0     the floor bulges: short earth fissures, clods hop, little green shoots poke up in a
//          ring around the tile; a low rumble
//   +170   five thorny vines ERUPT from the ring (back ones behind, front ones in front of the
//          spot), swaying, and arch inward over the tile into a closed bud
//   +380   the pod pushes up out of the soil inside the vine cage (clipped at the floor, leaf
//          hologram), clenched (roar f1)
//   +640   roar f2 — the pod BURSTS open: the vines whip outward and snap back into the ground,
//          thorn shards and leaves scatter — finale (leaf shockwave, ATK/DEF badge pop)
//   +1140  roar f7: the maw SNAPS shut (chomp) — tail
//   resolve ≈ +900 (total ≈ 1.15 s).
//
// vineCage() is shared with the flip handler (Dikenli Pusucu: "önce sarmaşıklar fışkırır").

import { PAL, RAMPS, type Ramp } from '../../art/palette';
import { DEPTH, type XY, unitDepth } from '../../view/layout';
import { shake } from '../../vfx/core';
import { leaves } from '../../vfx/particles';
import { registerCardHook } from '../api';
import { E, TAU, bg, bodyBox, burst, clamp01, entrance, holo, holoSettle, lerp, liveLayer, onFloor, pose, roar, rr, run, whenFrame, type Entrance } from './_kit';
import type { Raster } from './_kit';
import type Phaser from 'phaser';

const LEAF: Ramp = RAMPS.leaf;
const EARTH: Ramp = RAMPS.earth;

interface Vine {
  a: number;
  base: XY;
  h: number;
  ph: number;
  front: boolean;
}

export interface VineCage {
  /** Grow out of the floor (0 → 1). */
  grow(ms: number): Promise<void>;
  /** Curl the tips in over the tile (0 = upright, 1 = closed bud). */
  curl(to: number, ms: number): Promise<void>;
  /** Whip outward, then sink back into the ground; resolves when gone. */
  burst(ms: number): Promise<void>;
  /** Just pull back into the ground. */
  retract(ms: number): Promise<void>;
}

function qb(a: XY, c: XY, b: XY, t: number): XY {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

/** Thorny vines erupting from a ring around (x, y) on the floor. */
export function vineCage(scene: Phaser.Scene, x: number, y: number, o: { n?: number; radius?: number; height?: number; seed?: number } = {}): VineCage {
  const n = o.n ?? 5;
  const R = o.radius ?? 22;
  const H = o.height ?? 34;
  const vines: Vine[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + 0.35 + rr(-0.2, 0.2);
    vines.push({ a, base: onFloor(x, y, R + rr(-2, 2), a), h: H * rr(0.8, 1.1), ph: rr(0, TAU), front: Math.sin(a) >= 0 });
  }
  const st = { g: 0, curl: 0, out: 0, sink: 0, t: 0 };
  const drawVine = (r: Raster, v: Vine) => {
    const g = clamp01(st.g) * (1 - st.sink);
    if (g <= 0.02) return;
    const dx = v.base.x - x;
    const dy = v.base.y - y;
    const sway = Math.sin(st.t * 0.006 + v.ph) * 2;
    // upright tip → curled over the centre → flung outward
    const up = { x: v.base.x + dx * 0.15 + sway, y: v.base.y - v.h };
    const inn = { x: x + dx * 0.15, y: y - v.h * 0.95 + dy * 0.3 };
    const out = { x: v.base.x + dx * 1.3, y: v.base.y - v.h * 0.35 + dy * 0.6 };
    const tipA = { x: lerp(up.x, inn.x, st.curl), y: lerp(up.y, inn.y, st.curl) };
    const tip = { x: lerp(tipA.x, out.x, st.out), y: lerp(tipA.y, out.y, st.out) };
    const c = { x: v.base.x + dx * (0.25 + 0.35 * st.out) + sway * 0.5, y: v.base.y - v.h * (0.75 - 0.25 * st.out) };
    const N = 28;
    const top = Math.max(2, Math.round(N * g));
    let prev: XY | null = null;
    for (let i = 0; i <= top; i++) {
      const u = i / N;
      const p = qb(v.base, c, tip, u);
      const w = lerp(4.2, 1, u / Math.max(0.05, g));
      r.disc(p.x, p.y, Math.max(0.6, w / 2 + 0.4), LEAF[0]);
      if (w > 1.6) r.disc(p.x, p.y, w / 2 - 0.3, LEAF[2]);
      // lit edge (light from the upper left)
      r.px(p.x - Math.max(0, w / 2 - 1), p.y - 1, LEAF[3]);
      if (prev && i % 5 === 3) {
        // thorns on alternating sides, pointing along the normal
        const tx = p.x - prev.x;
        const ty = p.y - prev.y;
        const l = Math.hypot(tx, ty) || 1;
        const side = (i / 5) % 2 < 1 ? 1 : -1;
        const nx = (-ty / l) * side;
        const ny = (tx / l) * side;
        const k = w / 2 + 1;
        r.px(p.x + nx * k, p.y + ny * k, PAL.mag2);
        r.px(p.x + nx * (k + 1), p.y + ny * (k + 1) - 1, PAL.mag3);
      }
      prev = p;
    }
    // bud tip
    const tp = qb(v.base, c, tip, top / N);
    r.px(tp.x, tp.y, LEAF[4]);
    r.px(tp.x, tp.y - 1, PAL.mag3);
  };
  const back = liveLayer(scene, x, y - H / 2, R * 2 + 70, H + 50, unitDepth(y) - 0.5, (r, _el, dt) => {
    st.t += dt;
    for (const v of vines) if (!v.front) drawVine(r, v);
  });
  const front = liveLayer(scene, x, y - H / 2, R * 2 + 70, H + 50, unitDepth(y) + 0.5, (r) => {
    for (const v of vines) if (v.front) drawVine(r, v);
  });
  const end = () => {
    back.stop();
    front.stop();
  };
  return {
    grow: (ms) => run(scene, ms, (t) => (st.g = E.outBack(t, 1.6))),
    curl: (to, ms) => {
      const c0 = st.curl;
      return run(scene, ms, (t) => (st.curl = lerp(c0, to, E.inOutS(t))));
    },
    async burst(ms) {
      await run(scene, ms * 0.45, (t) => (st.out = E.outC(t)));
      await run(scene, ms * 0.55, (t) => (st.sink = E.inQ(t)));
      end();
    },
    async retract(ms) {
      await run(scene, ms, (t) => (st.sink = E.inQ(t)));
      end();
    },
  };
}

/** Soil: short fissures, clods hopping, shoots poking up around the tile. */
function soilStir(e: Entrance): { stop(ms: number): Promise<void> } {
  const { scene: sc, home } = e;
  const cracks: XY[][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + rr(-0.3, 0.3);
    const pts: XY[] = [];
    let rr0 = 6;
    let aa = a;
    while (rr0 < 26) {
      pts.push(onFloor(home.x, home.y, rr0, aa));
      rr0 += rr(3, 5);
      aa += rr(-0.4, 0.4);
    }
    cracks.push(pts);
  }
  const shoots = Array.from({ length: 9 }, (_, i) => ({ p: onFloor(home.x, home.y, rr(18, 28), (i / 9) * TAU + 0.2), d: i * 16, h: rr(3, 6) }));
  const st = { el: 0, fade: 1 };
  const layer = liveLayer(sc, home.x, home.y - 4, 90, 50, DEPTH.SHADOW + 2, (r, el) => {
    st.el = el;
    const g = clamp01(el / 220);
    for (const pts of cracks) {
      const nn = Math.max(1, Math.floor(pts.length * g));
      for (let i = 1; i < nn; i++) {
        r.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, PAL.ink, st.fade);
        r.line(pts[i - 1].x, pts[i - 1].y - 1, pts[i].x, pts[i].y - 1, EARTH[3], st.fade * 0.8);
      }
    }
    for (const s of shoots) {
      const k = clamp01((el - s.d) / 120);
      if (k <= 0) continue;
      const h = Math.round(s.h * E.outBack(k, 2));
      const al = Math.round(255 * st.fade);
      r.px(s.p.x, s.p.y + 1, EARTH[1], al);
      r.px(s.p.x - 1, s.p.y + 1, EARTH[2], al);
      r.px(s.p.x + 1, s.p.y + 1, EARTH[2], al);
      for (let j = 0; j < h; j++) r.px(s.p.x, s.p.y - j, j === h - 1 ? LEAF[4] : LEAF[2], al);
      if (h >= 3) {
        r.px(s.p.x + 1, s.p.y - h + 2, LEAF[3], al);
        r.px(s.p.x - 1, s.p.y - h + 3, LEAF[3], al);
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

async function thornPiece(e: Entrance): Promise<void> {
  const { ctx, scene: sc, unit: u, sprite: s, home, rest } = e;
  // ---- the soil stirs
  const soil = soilStir(e);
  ctx.sfx('groundCrack', { volume: 0.5, pitch: 1.2 });
  bg(shake(sc, 260, 1));
  burst(sc, home.x, home.y, 14, { ramp: [EARTH[4], EARTH[3], EARTH[2], EARTH[1]], speed: [25, 60], up: 60, gravity: 320, life: [240, 380], spread: [Math.PI, TAU], depth: unitDepth(home.y) + 0.5 });
  await ctx.wait(170);

  // ---- vines erupt and arch over the tile
  const cage = vineCage(sc, home.x, home.y);
  ctx.sfx('whoosh', { volume: 0.6, pitch: 0.55 });
  bg(ctx.wait(70).then(() => ctx.sfx('whoosh', { volume: 0.5, pitch: 0.7 })));
  leaves(sc, home.x, home.y - 6, { count: 6, speed: 0.8, depth: DEPTH.FX - 1 });
  bg(cage.grow(220));
  bg(ctx.wait(120).then(() => cage.curl(0.85, 260)));
  await ctx.wait(210);

  // ---- the pod pushes up inside the cage
  pose(u, 'roar', 1);
  s.setPosition(rest.x, rest.y);
  const b = bodyBox(s);
  const H = b ? Math.ceil(b.bottom - b.top) + 2 : 36;
  const P = holo(s, LEAF, { clipY: home.y, scan: 0.45, glitch: 0.05, tintMix: 0.7, gain: 1.05, flicker: 0.12 });
  s.y = rest.y + H;
  u.showSprite();
  ctx.sfx('groundCrack', { volume: 0.45, pitch: 0.8 });
  await run(sc, 240, (t) => {
    s.y = Math.round(rest.y + H * (1 - E.outC(t)));
  });
  s.y = rest.y;
  P.clipY = null;
  bg(holoSettle(sc, s, 180, false));
  bg(soil.stop(300));

  // ---- the pod bursts: vines whip out and sink — finale; the maw snaps (tail)
  const r = roar(ctx, u, {
    from: 1,
    sfx: 'roarSmall',
    pitch: 0.9,
    volume: 0.8,
    onPeak: () => {
      bg(cage.burst(380));
      e.finale({ ramp: LEAF, radius: 52, shake: 2, dust: PAL.earth3 });
      leaves(sc, home.x, home.y - 14, { count: 12, speed: 1.4, depth: DEPTH.FX - 1 });
      burst(sc, home.x, home.y - 14, 12, { ramp: [PAL.mag4, PAL.mag3, PAL.mag2], speed: [60, 140], up: 30, gravity: 240, life: [240, 420], depth: DEPTH.FX });
    },
  });
  bg(whenFrame(u, 'roar', 7).then(() => {
    if (u.frameInfo().anim === 'roar') ctx.sfx('bite', { volume: 0.6, pitch: 0.9 });
  }));
  await r.peak;
  await ctx.wait(240);
}

registerCardHook('thorn_lurker', 'summon', (ctx) => entrance(ctx, thornPiece), { name: 'summon-b:thorn_lurker' });
