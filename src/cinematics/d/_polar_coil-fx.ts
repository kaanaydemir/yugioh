// Kutup Bobini (polar_coil) — the card's own effect pieces (?look=v3 only; registers nothing: the `_` file is
// loaded by the cinematics glob but has no side effects). Used by ./polar_coil.ts; written so the Kutup
// Hükümdarı (polar_sovereign) can reuse the coil's pieces as its chest (the orbiting spikes, the two-colour core
// spill, the winding track):
//
//   coilPoint(u, which)                   a point of the coil's skeleton on the frame on screen (world px)
//   coreSpill(sc, home, dir)              the two-colour core light on the floor: N orange behind, S blue in front
//   spoolTrack(sc, u, home, depth)        summon: a dashed iso track turns on the floor under the spindle, faster
//                                         and brighter with every turn of the wire; copper glints fly off the
//                                         winding point as it climbs the drum; snap() flashes and clears it
//   whipSparks(sc, u, floorY)             summon 'land': copper sparks crack off the two whip lugs
//   spikeVolley(sc, o)                    "Tel Yörüngesi": three iron-dust spikes leave the coil's front, swing into
//                                         an orbit round the target (back half behind the body), circle it faster,
//                                         then plunge in together; onConverge() is the contact
//   convergeStar(sc, at, ground, o)       the three meet: a three-rayed star in the spikes' colours, one ring, dust
//   splinter(sc, at, ground, o)           blocked: the spikes break on the guard into tumbling iron grains
//   unwindGlints(sc, u, ms)               death f1–f5: copper flicks off the unwinding top of the drum
//   spindleDust(sc, at, floorY)           death: the empty spindle hits the marble — a dust puff and grit
//   emptySpool(sc, home, dir, depth)      death burst: loose copper curls spring out, an empty spool rolls away
//                                         spinning free and settles
//
// Pixel language (REHBER EF-6 / EF-7): 1-px lines, palette steps instead of alpha, whole-pixel positions, at
// most one ring per beat, stepped light on the floor, no sprite scale / rotation.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, type XY } from '../../view/layout';
import { lightFlash, lightPool, type LightHandle } from '../../view/light';
import { Raster } from '../../vfx/setpieces';
import { Sparks, onFrame, sleep } from '../../vfx/combat';
import { framePose } from '../../art/monsters-v3/polar_coil-anims';
import { W, skeleton } from '../../art/monsters-v3/polar_coil-rig';

export const TAU = Math.PI * 2;
/** Floor marks just above the cards on the tiles. */
export const FLOOR_DEPTH = DEPTH.CARD_ON_TILE + 2;
const COPPER = [PAL.skin3, PAL.fire3, PAL.fire2, PAL.fire1] as const;
const DUST = [PAL.mist, PAL.steel, PAL.stone3] as const;
/** The three spikes' tip colours: N pole, S pole, the gold binder. */
const TIPS = [PAL.fire4, PAL.water4, PAL.gold4] as const;
const TIPS_DIM = [PAL.fire3, PAL.water3, PAL.gold3] as const;

let seedV = 1;
/** Deterministic random (films repeat). */
export function seedFx(n: number): void {
  seedV = (Math.abs(Math.floor(n)) % 2147483646) + 1;
}
function rnd(): number {
  seedV = (seedV * 16807) % 2147483647;
  return (seedV - 1) / 2147483646;
}
const RR = (a: number, b: number): number => a + (b - a) * rnd();
const rx = (p: XY): XY => ({ x: Math.round(p.x), y: Math.round(p.y) });
const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

// ================================================================ the coil's points

export type CoilPointName = 'core' | 'front' | 'top' | 'spN' | 'spF' | 'lugN' | 'lugF' | 'star';

/** A point of the coil's skeleton on the frame on screen, in world px (null: gone / another art). */
export function coilPoint(u: MonsterUnit, which: CoilPointName, at?: { anim: Parameters<typeof framePose>[0]; frame: number }): XY | null {
  if (!u.sprite.active || u.cardId !== 'polar_coil') return null;
  const fi = at ?? { anim: u.frameInfo().anim ?? 'idle', frame: u.frameInfo().frame };
  const o = framePose(fi.anim, fi.frame);
  const sk = skeleton(o);
  let p: readonly [number, number];
  switch (which) {
    case 'core': p = sk.core; break;
    case 'front': p = sk.front; break;
    case 'top': {
      // the winding point: where the wire meets the drum (wind share from the bottom, or from the top)
      const h = sk.yb - sk.f2;
      const y = o.fromTop > 0 ? sk.f2 + h * (1 - o.wind) : sk.yb - h * o.wind;
      p = [sk.cx, y];
      break;
    }
    case 'spN': p = sk.spN; break;
    case 'spF': p = sk.spF; break;
    case 'lugN': p = sk.wN[2]; break;
    case 'lugF': p = sk.wF[2]; break;
    case 'star': p = [W - 12, sk.core[1] - 9]; break;
  }
  return rx(u.framePoint(Math.floor(p[0]) + 0.5, Math.floor(p[1]) + 0.5));
}

/** The drum's half width on the frame on screen (girth grows while winding). */
function drumRx(u: MonsterUnit): number {
  const fi = u.frameInfo();
  return skeleton(framePose(fi.anim ?? 'idle', fi.frame)).rx;
}

// ================================================================ core spill

export interface Spill {
  /** Both pools to `k` (stepped: callers pass whole steps), over `ms`. */
  level(k: number, ms?: number): void;
  fadeOut(ms: number): void;
}

/** The coil's two-colour core light on the floor: N orange spilling behind it, S blue in front. */
export function coreSpill(sc: Phaser.Scene, home: XY, dir: 1 | -1, k0 = 0): Spill {
  const n = lightPool(sc, home.x - dir * 7, home.y, { color: PAL.fire3, spill: PAL.fire2, radius: 18, intensity: k0, fadeIn: 60 });
  const s = lightPool(sc, home.x + dir * 7, home.y, { color: PAL.water3, spill: PAL.water2, radius: 18, intensity: k0, fadeIn: 60 });
  return {
    level(k, ms = 60) {
      n.setIntensity(k, ms);
      s.setIntensity(k, ms);
    },
    fadeOut(ms) {
      void n.fadeOut(ms);
      void s.fadeOut(ms);
    },
  };
}

// ================================================================ summon

export interface Track {
  /** 'land': the track flashes gold and closes in (the finale's ring takes over). */
  snap(): void;
  destroy(): void;
}

/**
 * Summon: a dashed iso track turns on the floor under the spindle — its dash rate and colour follow the
 * winding (the art's summon frame) — and copper glints are flicked off the winding point on the drum.
 */
export function spoolTrack(sc: Phaser.Scene, u: MonsterUnit, home: XY, depth: number): Track {
  const f = Raster.around(sc, home.x, home.y, 90, 44, FLOOR_DEPTH);
  const glints = new Sparks(sc, depth + 0.4);
  let phase = 0;
  let acc = 0;
  let snapAt = -1;
  let snapAsk = false;
  let side = 1;
  const stop = onFrame(
    sc,
    (dt, el) => {
      if (snapAsk && snapAt < 0) snapAt = el;
      const fi = u.frameInfo();
      const fr = fi.anim === 'summon' ? fi.frame : snapAt >= 0 ? 8 : 0;
      const wind = fi.anim === 'summon' ? framePose('summon', fr).wind : 1;
      if (snapAt >= 0) {
        // the snap: three steps — gold full ring, then it closes in, then gone
        const k = Math.floor((el - snapAt) / 45);
        if (k > 2) return false;
        f.draw((g) => {
          const R = [28, 22, 16][k];
          g.ring(home.x, home.y, R, R * 0.5, k === 0 ? PAL.gold4 : k === 1 ? PAL.gold3 : PAL.fire2, k < 2 ? 1 : 0.5, 0, TAU);
        });
        return true;
      }
      // the track turns: dashes run round the ellipse, rate 0.5 → 3.5 turns / s with the winding
      const rate = 0.5 + wind * 3;
      phase += (dt / 1000) * rate;
      const R = 28;
      const col = wind < 0.2 ? [PAL.steel, PAL.stone2] : wind < 0.55 ? [PAL.fire2, PAL.fire1] : wind < 0.9 ? [PAL.fire3, PAL.fire2] : [PAL.gold4, PAL.gold3];
      f.draw((g) => {
        const N = 40;
        for (let i = 0; i < N; i++) {
          const k = (i / N + phase) % 1;
          // 3 dashes of 4 dots: the spool's three spokes on the floor
          const on = Math.floor(((i / N) * 12 + phase * 12)) % 4 !== 3;
          if (!on) continue;
          const a = k * TAU;
          const x = home.x + Math.cos(a) * R;
          const y = home.y + Math.sin(a) * R * 0.5;
          g.px(Math.round(x), Math.round(y), Math.sin(a) > 0 ? col[0] : col[1]);
          // the dashes are 2 px long along the track (a 1-px dot drowns in the tile's own frame lines)
          g.px(Math.round(x) + (Math.sin(a) > 0 ? -1 : 1), Math.round(y), Math.sin(a) > 0 ? col[0] : col[1]);
        }
        // the inner hub: the spindle's pin print
        if (wind > 0.05) g.ring(home.x, home.y, 9, 4.5, wind > 0.6 ? PAL.fire2 : PAL.stone2, 0.5, 0, TAU);
      });
      // copper glints off the winding point, alternately at the drum's two edges (front / back of the turn)
      if (fi.anim === 'summon' && fr >= 1 && fr <= 6) {
        acc += dt;
        const every = 70 - fr * 7;
        while (acc > every) {
          acc -= every;
          const top = coilPoint(u, 'top');
          if (!top) break;
          side = -side;
          const r = drumRx(u);
          const sgn = u.flipX ? -1 : 1;
          glints.add({ x: top.x + side * sgn * Math.round(r), y: top.y + RR(-1, 1), vx: side * sgn * RR(30, 70), vy: RR(-60, -20), ay: 260, drag: 1.4, life: RR(160, 300), colors: [PAL.white, PAL.skin3, PAL.fire3, PAL.fire2], shape: 'px', fadeAt: 1 });
        }
      }
      return true;
    },
    () => {
      f.destroy();
      glints.release();
    },
  );
  return {
    snap() {
      snapAsk = true;
    },
    destroy() {
      stop();
      f.destroy();
      glints.release();
    },
  };
}

/** Summon 'land': the whips snap open — copper sparks crack off the two terminal lugs. */
export function whipSparks(sc: Phaser.Scene, u: MonsterUnit, floorY: number): void {
  const sp = new Sparks(sc, u.sprite.depth + 0.5);
  const sgn = u.flipX ? -1 : 1;
  for (const which of ['lugN', 'lugF'] as const) {
    const at = coilPoint(u, which);
    if (!at) continue;
    const out = which === 'lugN' ? sgn : -sgn;
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + out * RR(0.3, 1.3);
      const v = RR(70, 150);
      sp.add({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 420, drag: 1.2, life: RR(240, 420), colors: i % 3 === 0 ? [PAL.white, PAL.gold4, PAL.gold3] : [PAL.white, PAL.skin3, PAL.fire3, PAL.fire2], shape: i % 2 ? 'streak' : 'px', len: 0.02, floor: floorY + RR(-2, 3), bounce: 0.3, fadeAt: 0.8 });
    }
  }
  sp.release();
}

// ================================================================ the volley "Tel Yörüngesi"

export interface VolleyOpts {
  /** Where the three spikes leave the coil (its front star). */
  from: XY;
  /** The orbit's centre (the target's body) and the floor under it. */
  at: XY;
  ground: XY;
  /** Orbit half width (px): ~22 on a monster, ~30 on a duelist. */
  R: number;
  /** Flight from the coil into the orbit, the orbit, the plunge (scene ms). */
  flyMs: number;
  orbitMs: number;
  plungeMs: number;
  /** Depth of the target's body (back half of the orbit below it, front half above). */
  bodyDepth: number;
  /** Blocked: the spikes stop on the guard (radius `stopR`) instead of meeting in the core. */
  stopR?: number;
  onOrbit?(): void;
  onConverge(dirs: XY[]): void;
}

/** "Tel Yörüngesi" (see header). Resolves after the plunge (the contact). */
export function spikeVolley(sc: Phaser.Scene, o: VolleyOpts): Promise<void> {
  const pad = o.R + 50;
  const x0 = Math.min(o.from.x, o.at.x) - pad;
  const y0 = Math.min(o.from.y, o.at.y) - pad;
  const w = Math.abs(o.from.x - o.at.x) + pad * 2;
  const h = Math.abs(o.from.y - o.at.y) + pad * 2;
  const back = new Raster(sc, x0, y0, w, h, o.bodyDepth - 0.5);
  const front = new Raster(sc, x0, y0, w, h, Math.max(DEPTH.FX - 1, o.bodyDepth + 0.5));
  const floor = Raster.around(sc, o.ground.x, o.ground.y, o.R * 2 + 30, o.R + 24, FLOOR_DEPTH);
  const ry = o.R * 0.45;
  const fry = (o.R + 4) * 0.5;
  const N = 3;
  // the orbit is entered from the coil's side: the first spike at the near side, the rest a third apart
  const near = Math.atan2(0, o.from.x - o.at.x) + Math.PI * 0.12;
  const a0 = [near, near + TAU / 3, near + (2 * TAU) / 3];
  const ctrl = [-16, 18, -2];
  const trail: XY[][] = [[], [], []];
  const T1 = o.flyMs;
  const T2 = T1 + o.orbitMs;
  const T3 = T2 + o.plungeMs;
  const TURNS = 1.35;
  const pool: LightHandle = lightPool(sc, o.ground.x, o.ground.y, { color: PAL.water3, spill: PAL.water2, radius: 14, intensity: 0, fadeIn: 0 });
  // each spike carries its own small light (its pole colour on the air and the marble under it)
  const lights: LightHandle[] = [0, 1, 2].map((i) => lightPool(sc, o.from.x, o.from.y, { color: TIPS_DIM[i], radius: 9, intensity: 0.7, air: 0.8, floorY: o.ground.y, fadeIn: 40 }));
  let orbited = false;
  let lastLap = -1;
  const stopR = o.stopR ?? 0;
  return new Promise<void>((resolve) => {
    onFrame(
      sc,
      (_dt, el) => {
        const t = Math.min(el, T3);
        back.begin();
        front.begin();
        floor.begin();
        const dirs: XY[] = [];
        // the orbit's turn so far (accelerating) and the radius (it tightens a little as it speeds up)
        const ko = clamp((t - T1) / o.orbitMs, 0, 1);
        const turns = TURNS * (0.35 * ko + 0.65 * ko * ko);
        const shrink = 1 - 0.18 * ko;
        for (let i = 0; i < N; i++) {
          let p: XY;
          let d: XY;
          let behind = false;
          let a = a0[i];
          if (t < T1) {
            // flight: a quadratic arc from the coil's front to the spike's orbit entry, each from its own side
            const k = clamp((t - i * 18) / (T1 - 36), 0, 1);
            const e = k * k * (3 - 2 * k);
            const end = { x: o.at.x + Math.cos(a) * o.R, y: o.at.y + Math.sin(a) * ry };
            const c = { x: (o.from.x + end.x) / 2, y: Math.min(o.from.y, end.y) + ctrl[i] };
            const u1 = 1 - e;
            p = { x: u1 * u1 * o.from.x + 2 * u1 * e * c.x + e * e * end.x, y: u1 * u1 * o.from.y + 2 * u1 * e * c.y + e * e * end.y };
            const dx = 2 * u1 * (c.x - o.from.x) + 2 * e * (end.x - c.x);
            const dy = 2 * u1 * (c.y - o.from.y) + 2 * e * (end.y - c.y);
            const l = Math.hypot(dx, dy) || 1;
            d = { x: dx / l, y: dy / l };
            if (k <= 0) continue;
          } else if (t < T2) {
            a = a0[i] + turns * TAU * (o.at.x < o.from.x ? -1 : 1);
            const r = o.R * shrink;
            p = { x: o.at.x + Math.cos(a) * r, y: o.at.y + Math.sin(a) * r * 0.45 };
            const s = o.at.x < o.from.x ? -1 : 1;
            d = { x: -Math.sin(a) * s, y: Math.cos(a) * 0.45 * s };
            const l = Math.hypot(d.x, d.y) || 1;
            d = { x: d.x / l, y: d.y / l };
            behind = Math.sin(a) < -0.1;
          } else {
            // the plunge: from the orbit straight in to the core (or to the guard)
            a = a0[i] + TURNS * TAU * (o.at.x < o.from.x ? -1 : 1);
            const k = clamp((t - T2) / o.plungeMs, 0, 1);
            const e = k * k;
            const r = o.R * 0.82 * (1 - e) + stopR * e;
            p = { x: o.at.x + Math.cos(a) * r, y: o.at.y + Math.sin(a) * r * 0.45 - (i === 2 ? 3 * e : 0) };
            d = { x: -Math.cos(a), y: -Math.sin(a) * 0.45 };
            const l = Math.hypot(d.x, d.y) || 1;
            d = { x: d.x / l, y: d.y / l };
            behind = Math.sin(a) < -0.1 && k < 0.7;
          }
          dirs.push(d);
          lights[i].setPosition(Math.round(p.x), Math.round(p.y), Math.round(t < T1 ? o.from.y + (o.ground.y - o.from.y) * clamp(t / T1, 0, 1) + 26 : o.ground.y + Math.sin(a) * fry));
          // the wake: iron grains strung out behind (last positions)
          const tr = trail[i];
          tr.unshift(rx(p));
          if (tr.length > 11) tr.pop();
          const ras = behind ? back : front;
          for (let g = 3; g < tr.length; g += 1) {
            const c = g < 5 ? TIPS_DIM[i] : g < 7 ? PAL.mist : g < 9 ? PAL.steel : PAL.stone2;
            ras.px(tr[g].x, tr[g].y, c);
            if (g < 7) ras.px(tr[g].x - Math.round(d.x), tr[g].y + 1 - (g & 1), g < 5 ? PAL.mist : PAL.steel);
          }
          drawSpike(ras, p, d, i);
          // the spike's shadow on the floor under the orbit
          if (t >= T1) {
            const sx = Math.round(p.x);
            const sy = Math.round(o.ground.y + Math.sin(a) * fry * shrink);
            floor.px(sx, sy, PAL.night1);
            floor.px(sx + 1, sy, PAL.night1);
          }
        }
        // the floor track: the orbit's ellipse, dashed, the dashes running with the spikes; brighter each lap
        if (t >= T1) {
          if (!orbited) {
            orbited = true;
            o.onOrbit?.();
          }
          const lap = Math.min(2, Math.floor(turns * 2));
          if (lap !== lastLap) {
            lastLap = lap;
            pool.setIntensity([0.35, 0.6, 0.9][lap], 30);
            pool.setColor(lap === 2 ? PAL.gold3 : PAL.water3);
          }
          const R = (o.R + 4) * shrink;
          const n = 30;
          const run = turns * (o.at.x < o.from.x ? -1 : 1);
          for (let s = 0; s < n; s++) {
            if ((s + Math.floor(run * n)) % 5 === 4) continue;
            const aa = (s / n) * TAU;
            floor.dpx(o.ground.x + Math.cos(aa) * R, o.ground.y + Math.sin(aa) * R * 0.5, lap === 2 ? PAL.gold4 : lap === 1 ? PAL.water4 : PAL.water3, 1);
          }
        }
        back.end();
        front.end();
        floor.end();
        if (el >= T3) {
          o.onConverge(dirs);
          return false;
        }
        return true;
      },
      () => {
        back.destroy();
        front.destroy();
        floor.destroy();
        void pool.fadeOut(140);
        for (const l of lights) void l.fadeOut(90);
        resolve();
      },
    );
  });
}

/** One iron-dust spike: a 10-px magnetite thorn with an ink outline, a lit facet and a hot coloured tip. */
function drawSpike(r: Raster, p: XY, d: XY, i: number): void {
  const nx = -d.y;
  const ny = d.x;
  const tip = { x: p.x + d.x * 5, y: p.y + d.y * 5 };
  const tail = { x: p.x - d.x * 5, y: p.y - d.y * 5 };
  const litUp = ny < 0 ? 1 : -1;
  // ink outline: the shaft offset to both sides (wide at the middle), a pixel past the tip and the tail
  r.line(tail.x + nx * 1.2, tail.y + ny * 1.2, p.x + nx * 1.8, p.y + ny * 1.8, PAL.ink);
  r.line(p.x + nx * 1.8, p.y + ny * 1.8, tip.x + d.x, tip.y + d.y, PAL.ink);
  r.line(tail.x - nx * 1.2, tail.y - ny * 1.2, p.x - nx * 1.8, p.y - ny * 1.8, PAL.ink);
  r.line(p.x - nx * 1.8, p.y - ny * 1.8, tip.x + d.x, tip.y + d.y, PAL.ink);
  r.px(Math.round(tail.x - d.x), Math.round(tail.y - d.y), PAL.ink);
  // body: the dark facet, then the lit facet toward the top-left key light
  r.line(tail.x - nx * 0.7 * litUp, tail.y - ny * 0.7 * litUp, tip.x, tip.y, PAL.stone1);
  r.line(tail.x, tail.y, tip.x, tip.y, PAL.stone2);
  r.line(tail.x + nx * 0.8 * litUp, tail.y + ny * 0.8 * litUp, p.x + nx * 0.9 * litUp, p.y + ny * 0.9 * litUp, PAL.stone4);
  // the hot tip (light: drawn after the outline): 3 px in the spike's pole colour, white point
  r.px(Math.round(tip.x - d.x * 2), Math.round(tip.y - d.y * 2), TIPS_DIM[i]);
  r.px(Math.round(tip.x - d.x), Math.round(tip.y - d.y), TIPS[i]);
  r.px(Math.round(tip.x), Math.round(tip.y), PAL.white);
}

/** The three meet in the body: a three-rayed star (N / S / gold), one stepped ring round the body, dust. */
export function convergeStar(sc: Phaser.Scene, at: XY, ground: XY, o: { dirs: XY[]; depth: number; big?: boolean }): void {
  const r = Raster.around(sc, at.x, at.y, 90, 70, o.depth);
  const f = Raster.around(sc, ground.x, ground.y, 100, 50, FLOOR_DEPTH);
  const rays = o.dirs.length === 3 ? o.dirs.map((d) => ({ x: -d.x, y: -d.y })) : [{ x: -1, y: 0 }, { x: 0.5, y: -0.85 }, { x: 0.5, y: 0.85 }];
  const L = o.big ? [5, 11, 15, 12] : [4, 9, 12, 9];
  void (async () => {
    for (let s = 0; s < L.length; s++) {
      if (!r.alive) return;
      r.draw((g) => {
        // the rays go OUT along where each spike came in from
        for (let i = 0; i < 3; i++) {
          const d = rays[i];
          const len = L[s];
          for (let k = 1; k <= len; k++) {
            const c = k < 3 ? PAL.white : s >= 2 && k > len - 3 ? TIPS_DIM[i] : TIPS[i];
            if (s === 3 && k < len - 4) continue; // the rays leave the core: they fly off outward
            g.px(Math.round(at.x + d.x * k), Math.round(at.y + d.y * k * 0.8), c);
          }
        }
        if (s < 2) g.disc(at.x, at.y, s === 0 ? 2 : 3, PAL.white);
        else if (s === 2) g.ring(at.x, at.y, 7, 5, PAL.gold4, 1, 0, TAU);
      });
      f.draw((g) => {
        const R = [12, 18, 24, 28][s];
        g.ring(ground.x, ground.y, R, R * 0.5, s < 2 ? PAL.gold3 : PAL.water2, s < 3 ? 1 : 0.5, 0, TAU);
      });
      await sleep(sc, 40);
    }
    r.destroy();
    f.destroy();
  })();
  const sp = new Sparks(sc, DEPTH.FX + 2);
  for (let i = 0; i < (o.big ? 21 : 15); i++) {
    const d = rays[i % 3];
    const a = Math.atan2(d.y, d.x) + RR(-0.45, 0.45);
    const v = RR(60, 150);
    sp.add({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, ay: 140, drag: 2.4, life: RR(220, 420), colors: i % 3 === 2 ? [TIPS[i % 3], TIPS_DIM[i % 3]] : DUST, shape: 'px', fadeAt: 1 });
  }
  sp.release();
  void lightFlash(sc, at.x, at.y, PAL.gold4, o.big ? 40 : 32, 340, { floorY: ground.y, intensity: 1, air: 0.6 });
}

/** Blocked: the spikes break on the guard — each into tumbling iron grains with its tip spark. */
export function splinter(sc: Phaser.Scene, at: XY, ground: XY, o: { dirs: XY[]; depth: number }): void {
  const sp = new Sparks(sc, o.depth + 0.1);
  const r = Raster.around(sc, at.x, at.y, 60, 50, o.depth);
  void (async () => {
    for (let s = 0; s < 2; s++) {
      if (!r.alive) return;
      r.draw((g) => g.ring(at.x, at.y, [8, 12][s], [6, 9][s], s === 0 ? PAL.mist : PAL.steel, s === 0 ? 1 : 0.5, 0, TAU));
      await sleep(sc, 45);
    }
    r.destroy();
  })();
  for (let i = 0; i < 3; i++) {
    const d = o.dirs[i] ?? { x: 1, y: 0 };
    // the grains bounce back out along where the spike came from
    for (let k = 0; k < 5; k++) {
      const a = Math.atan2(-d.y, -d.x) + RR(-0.7, 0.7);
      const v = RR(50, 120);
      sp.add({ x: at.x - d.x * 8, y: at.y - d.y * 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, ay: 380, drag: 1, life: RR(320, 560), colors: k === 0 ? [PAL.white, TIPS[i], TIPS_DIM[i]] : [PAL.stone3, PAL.stone2, PAL.stone1], shape: k === 0 ? 'px' : 'sq', size: 1, floor: ground.y + RR(-3, 4), bounce: 0.3, fadeAt: 0.8 });
    }
  }
  sp.release();
  void lightFlash(sc, at.x, at.y, PAL.steel, 22, 220, { floorY: ground.y, intensity: 0.6 });
}

// ================================================================ death

/** Death f1–f5: copper flicks off the unwinding top of the drum and trail away to the back. */
export function unwindGlints(sc: Phaser.Scene, u: MonsterUnit, ms: number): void {
  const sp = new Sparks(sc, u.sprite.depth + 0.4);
  const sgn = u.flipX ? -1 : 1;
  let acc = 0;
  onFrame(
    sc,
    (dt, el) => {
      if (el >= ms || !u.sprite.active) return false;
      acc += dt;
      while (acc > 45) {
        acc -= 45;
        const top = coilPoint(u, 'top');
        if (!top) break;
        const r = Math.max(2, drumRx(u));
        const side = rnd() < 0.5 ? -1 : 1;
        sp.add({ x: top.x + side * sgn * Math.round(r), y: top.y, vx: -sgn * RR(40, 90), vy: RR(-70, -25), ay: 300, drag: 1.2, life: RR(220, 380), colors: [PAL.skin3, PAL.fire3, PAL.fire2, PAL.fire1], shape: rnd() < 0.4 ? 'streak' : 'px', len: 0.02, floor: u.home.y + RR(-2, 4), bounce: 0.25, fadeAt: 0.8 });
      }
      return true;
    },
    () => sp.release(),
  );
}

/** Death: the empty spindle hits the marble — a low dust puff and a few grits. */
export function spindleDust(sc: Phaser.Scene, at: XY, floorY: number): void {
  const sp = new Sparks(sc, DEPTH.FX - 1);
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1;
    sp.add({ x: at.x + RR(-6, 6), y: floorY - RR(0, 2), vx: side * RR(20, 60), vy: RR(-30, -8), drag: 3, life: RR(260, 460), colors: i % 3 ? [PAL.stone3, PAL.stone2] : [PAL.mist, PAL.steel], shape: 'px', fadeAt: 0.6 });
  }
  sp.release();
}

/**
 * Death burst: loose copper curls spring out of the wire heap, and an empty spool rolls away over the marble,
 * spinning free (its spoke turns in whole steps), slowing, rocking and fading in dither steps.
 */
export function emptySpool(sc: Phaser.Scene, home: XY, dir: 1 | -1, depth: number): void {
  const sp = new Sparks(sc, depth);
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1;
    sp.add({ x: home.x + RR(-8, 8), y: home.y - RR(2, 8), vx: side * RR(30, 80), vy: RR(-90, -40), ay: 420, drag: 1.4, life: RR(520, 820), colors: COPPER, shape: i % 3 === 0 ? 'ring' : 'streak', size: 2, len: 0.03, floor: home.y + RR(-4, 5), bounce: 0.35, fadeAt: 0.75 });
  }
  sp.release();
  // the spool: thrown off the falling spindle, it rolls on the way the spindle fell (to the coil's back)
  dir = (-dir) as 1 | -1;
  const r = Raster.around(sc, home.x + dir * 20, home.y, 80, 30, depth);
  const MS = 900;
  const start = { x: home.x + dir * 10, y: home.y + 3 };
  const dist = 26;
  onFrame(
    sc,
    (_dt, el) => {
      if (el >= MS) return false;
      const t = el / MS;
      // decelerating roll, a little hop at the start
      const e = 1 - (1 - Math.min(1, t / 0.75)) ** 2;
      const x = Math.round(start.x + dir * dist * e);
      const y = Math.round(start.y - (t < 0.18 ? Math.sin((t / 0.18) * Math.PI) * 5 : 0));
      const spin = Math.floor(e * 9) + (t > 0.75 ? Math.round(Math.sin((t - 0.75) * 30) * 0.6) : 0);
      const lv = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      r.draw((g) => {
        // side view of the reel: two gold flange discs (ellipses), the bare copper-stained hub between
        g.ell(x - 2, y - 3, 1.6, 3.4, PAL.ink, lv);
        g.ell(x + 2, y - 3, 1.6, 3.4, PAL.ink, lv);
        g.rect(x - 2, y - 5, 4, 4, PAL.ink, lv);
        g.rect(x - 1, y - 4, 3, 2, PAL.fire1, lv);
        g.ell(x + 2, y - 3, 1.1, 2.6, PAL.gold3, lv);
        g.ell(x - 2, y - 3, 1.1, 2.6, PAL.gold2, lv);
        // the spoke on the near flange (side view): its bright end runs round the rim in whole steps
        const s = ((spin % 8) + 8) % 8;
        const sy = [-2, -1, 0, 1, 2, 1, 0, -1][s];
        const sx = s > 0 && s < 4 ? 1 : s > 4 ? -1 : 0;
        g.dpx(x + 2 + (sx > 0 ? 0 : sx), y - 3 + sy, PAL.gold4, lv);
        g.dpx(x + 2, y - 3 - sy, PAL.gold1, lv);
        g.dpx(x + 2, y - 3, PAL.white, lv);
        // its floor shadow
        g.dpx(x - 1, y + 1, PAL.night1, lv);
        g.dpx(x, y + 1, PAL.night1, lv);
        g.dpx(x + 1, y + 1, PAL.night1, lv);
      });
      return true;
    },
    () => r.destroy(),
  );
}
