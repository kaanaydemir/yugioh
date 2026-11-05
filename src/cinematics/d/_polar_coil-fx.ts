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
import { DEATH_IMPACT, framePose } from '../../art/monsters-v3/polar_coil-anims';
import { H as RIG_H, SPOOL_N_LOCAL, W, drawCoil, skeleton, toppleRot, type Pose } from '../../art/monsters-v3/polar_coil-rig';
import { PixelCanvas } from '../../art/pixel';

export const TAU = Math.PI * 2;
/** Floor marks just above the cards on the tiles. */
export const FLOOR_DEPTH = DEPTH.CARD_ON_TILE + 2;
const COPPER = [PAL.skin3, PAL.fire3, PAL.fire2, PAL.fire1] as const;
const DUST = [PAL.mist, PAL.steel, PAL.stone3] as const;
/** The three spikes' tip colours: N pole, S pole, the gold binder. */
const TIPS = [PAL.fire4, PAL.water4, PAL.gold4] as const;
const TIPS_DIM = [PAL.fire3, PAL.water3, PAL.gold3] as const;
/** The spikes' magnetised shafts: dark / mid tone of each pole's ramp. */
const SHAFT_DK = [PAL.fire1, PAL.water1, PAL.gold1] as const;
const SHAFT_MD = [PAL.fire2, PAL.water2, PAL.gold2] as const;

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
  const n = lightPool(sc, home.x - dir * 7, home.y, { color: PAL.fire3, spill: PAL.fire2, radius: 22, intensity: k0, fadeIn: 60 });
  const s = lightPool(sc, home.x + dir * 7, home.y, { color: PAL.water3, spill: PAL.water2, radius: 22, intensity: k0, fadeIn: 60 });
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
  /** `preMs` (scene ms) before the convergence (the plunge's lead-in): e.g. the sound's pre-roll. */
  preMs?: number;
  onPreHit?(): void;
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
  const TURNS = 1.5;
  const pool: LightHandle = lightPool(sc, o.ground.x, o.ground.y, { color: PAL.water3, spill: PAL.water2, radius: o.R + 6, intensity: 0, fadeIn: 0 });
  let orbited = false;
  let lastLap = -1;
  let pre = false;
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
          // the wake: magnetised grains strung out behind (last positions), hot pole colour cooling to iron
          const tr = trail[i];
          tr.unshift(rx(p));
          if (tr.length > 13) tr.pop();
          const ras = behind ? back : front;
          // the wake: a 2-px stepped trail of the pole colour cooling to iron, then two afterimages
          for (let g = 5; g < tr.length; g += 1) {
            const c = g < 7 ? TIPS_DIM[i] : g < 10 ? SHAFT_MD[i] : PAL.steel;
            ras.px(tr[g].x, tr[g].y, c);
            ras.px(tr[g].x, tr[g].y + 1, g < 8 ? SHAFT_MD[i] : SHAFT_DK[i]);
          }
          drawGhosts(ras, tr, d, i);
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
            // stepped and warmer each half lap: cold iron blue → copper → gold
            pool.setIntensity([0.5, 0.75, 1][lap], 30);
            pool.setColor([PAL.water3, PAL.fire3, PAL.gold3][lap]);
          }
          const R = (o.R + 4) * shrink;
          const n = 30;
          const run = turns * (o.at.x < o.from.x ? -1 : 1);
          for (let s = 0; s < n; s++) {
            if ((s + Math.floor(run * n)) % 5 === 4) continue;
            const aa = (s / n) * TAU;
            const fx = o.ground.x + Math.cos(aa) * R;
            const fy = o.ground.y + Math.sin(aa) * R * 0.5;
            // the dust ring: a 2-px band (bright outer grain, dim inner) warming every half lap
            floor.dpx(fx, fy, [PAL.water4, PAL.fire4, PAL.gold4][lap], 1);
            floor.dpx(o.ground.x + Math.cos(aa) * (R - 2), o.ground.y + Math.sin(aa) * (R - 2) * 0.5, [PAL.water2, PAL.fire2, PAL.gold2][lap], 1);
          }
        }
        back.end();
        front.end();
        floor.end();
        if (!pre && el >= T3 - (o.preMs ?? 0)) {
          pre = true;
          o.onPreHit?.();
        }
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
        resolve();
      },
    );
  });
}

/** The dart outline of a spike at `p` heading `d` (world px): tip, shoulders, a narrow tail. */
function dartPts(p: XY, d: XY, len: number, half: number): XY[] {
  const nx = -d.y;
  const ny = d.x;
  const tip = { x: p.x + d.x * len * 0.55, y: p.y + d.y * len * 0.55 };
  const sh = { x: p.x + d.x * len * 0.05, y: p.y + d.y * len * 0.05 };
  const tail = { x: p.x - d.x * len * 0.45, y: p.y - d.y * len * 0.45 };
  return [tip, { x: sh.x + nx * half, y: sh.y + ny * half }, { x: tail.x + nx * half * 0.45, y: tail.y + ny * half * 0.45 }, { x: tail.x - nx * half * 0.45, y: tail.y - ny * half * 0.45 }, { x: sh.x - nx * half, y: sh.y - ny * half }];
}

/** Two stepped afterimages of a spike along its last positions: a dim pole-coloured dart, then a dark one. */
function drawGhosts(r: Raster, tr: readonly XY[], d: XY, i: number): void {
  const G: [number, number, number][] = [[2, SHAFT_MD[i], 1], [4, SHAFT_DK[i], 0.5]];
  for (const [g, c, lv] of G) {
    if (tr.length <= g) continue;
    r.poly(dartPts(tr[g], d, 11, 1.6), c, lv);
  }
}

/**
 * One iron-dust spike: a solid 14-px dart, 4–5 px thick at the shoulder — an ink outline all round, a dark iron
 * facet away from the key light, the shaft in its pole's colour (N orange / S blue / gold binder), a lit facet and
 * a 3-px hot head with a white point — so the three read apart at 1× on any target, the duelist portrait included.
 */
function drawSpike(r: Raster, p: XY, d: XY, i: number): void {
  const LEN = 14;
  const pts = dartPts(p, d, LEN, 2.4);
  // ink: the dart stamped one pixel out in the four directions (a 1-px outline), then a pixel past the tip
  for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) r.poly(pts.map((q) => ({ x: q.x + ox, y: q.y + oy })), PAL.ink);
  r.px(Math.round(pts[0].x + d.x), Math.round(pts[0].y + d.y), PAL.ink);
  r.poly(pts, SHAFT_MD[i]);
  // the dark facet: the half away from the top-left key light
  const nx = -d.y;
  const ny = d.x;
  const darkSide = ny > 0 || (ny === 0 && nx < 0) ? 1 : -1;
  r.poly([pts[0], darkSide > 0 ? pts[1] : pts[4], darkSide > 0 ? pts[2] : pts[3], p], SHAFT_DK[i]);
  // the lit facet: a sliver along the spine toward the light
  r.line(p.x - nx * darkSide * 0.8 - d.x * 4, p.y - ny * darkSide * 0.8 - d.y * 4, pts[0].x - d.x * 2, pts[0].y - d.y * 2, TIPS_DIM[i]);
  // the hot head (light: after the outline): pole colour, white point
  r.px(Math.round(pts[0].x - d.x * 3), Math.round(pts[0].y - d.y * 3), TIPS[i]);
  r.px(Math.round(pts[0].x - d.x * 2), Math.round(pts[0].y - d.y * 2), TIPS[i]);
  r.px(Math.round(pts[0].x - d.x), Math.round(pts[0].y - d.y), PAL.white);
  r.px(Math.round(pts[0].x), Math.round(pts[0].y), PAL.white);
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
    const hx = at.x - d.x * 9;
    const hy = at.y - d.y * 6;
    // the spike breaks in two: its hot head and its shaft tumble back off the guard as 2-px shards in its own pole
    // colour (N fire / S water / gold), then its iron dust rains down IN FRONT of the guard and lies a beat
    const back = Math.atan2(-d.y, -d.x);
    for (let k = 0; k < 2; k++) {
      const a = back + RR(-0.5, 0.5);
      const v = RR(60, 110);
      sp.add({ x: hx, y: hy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 70, ay: 420, drag: 0.8, life: RR(620, 820), colors: k === 0 ? [PAL.white, TIPS[i], TIPS_DIM[i], SHAFT_MD[i]] : [TIPS_DIM[i], SHAFT_MD[i], SHAFT_DK[i]], shape: 'streak', size: 2, len: 0.025, floor: ground.y + RR(3, 9), bounce: 0.35, fadeAt: 0.85 });
    }
    for (let k = 0; k < 7; k++) {
      const a = back + RR(-0.9, 0.9);
      const v = RR(35, 95);
      const tint = k % 3 === 0;
      sp.add({ x: hx + RR(-2, 2), y: hy + RR(-2, 2), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 45, ay: 400, drag: 1, life: RR(560, 900), colors: tint ? [TIPS_DIM[i], SHAFT_MD[i], SHAFT_DK[i]] : [PAL.mist, PAL.stone3, PAL.stone2], shape: 'sq', size: 2, floor: ground.y + RR(2, 10), bounce: 0.25, fadeAt: 0.8 });
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

// ---------------------------------------------------------------- the remains (death end, §5.2 "tel çözülür, makara boş döner")

/** The remains' pictures: the fallen spindle with its spool (0), without it (1), breaking (2, 3: the last 150 ms). */
const REMAINS = [
  { spoolOff: 0, diss: 0 },
  { spoolOff: 1, diss: 0 },
  { spoolOff: 1, diss: 0.4 },
  { spoolOff: 1, diss: 0.8 },
] as const;

function remainsKey(sc: Phaser.Scene, i: number, right: boolean): string {
  const key = `pc:remains:${right ? 'r' : 'l'}:${i}`;
  if (sc.textures.exists(key)) return key;
  const base = framePose('death', DEATH_IMPACT);
  const p = new PixelCanvas(W, RIG_H);
  const o: Pose = { ...base, spoolOff: REMAINS[i].spoolOff, diss: REMAINS[i].diss };
  drawCoil(p, o, right ? 'right' : 'left');
  sc.textures.addCanvas(key, p.toCanvas());
  return key;
}

export interface Remains {
  /** World centre of the near shoulder spool on the fallen spindle. */
  spoolAt: XY;
  /** The burst: the spool leaves the spindle (the picture without it) — the remains live `ms` more, the last 150 ms break. */
  burst(ms: number): void;
  destroy(): void;
}

/**
 * The death's last frame (the bare spindle lying clean on its own tile) taken over as remains: the sprite is hidden
 * by the caller, so no generic material break follows. On burst() the empty spool comes off it (emptySpool), the
 * spindle lies a beat, and only its last 150 ms break up — in two dissolve steps of its own grit (copper / iron).
 */
export function coilRemains(sc: Phaser.Scene, u: MonsterUnit): Remains {
  const spr = u.sprite;
  const right = spr.texture.key.includes(':p2');
  const img = sc.add.image(spr.x, spr.y, remainsKey(sc, 0, right)).setOrigin(spr.originX, spr.originY).setFlipX(spr.flipX).setDepth(spr.depth);
  const lp = toppleRot(framePose('death', DEATH_IMPACT))(SPOOL_N_LOCAL);
  const spoolAt = rx(u.framePoint(Math.floor(lp[0]) + 0.5, Math.floor(lp[1]) + 0.5));
  let stop: (() => void) | null = null;
  const destroy = () => {
    stop?.();
    if (img.active) img.destroy();
  };
  return {
    spoolAt,
    burst(ms) {
      if (!img.active) return;
      img.setTexture(remainsKey(sc, 1, right));
      const BREAK = SPOOL_BREAK;
      let shown = 1;
      stop = onFrame(
        sc,
        (_dt, el) => {
          if (!img.active) return false;
          const k = el < ms - BREAK ? 1 : el < ms - BREAK / 2 ? 2 : 3;
          if (k !== shown) {
            shown = k;
            img.setTexture(remainsKey(sc, k, right));
            if (k === 2) {
              // the grit of the break: copper flecks and iron grains dropping off the spindle
              const sp = new Sparks(sc, img.depth + 0.2);
              const home = u.home;
              const dir = u.flipX ? -1 : 1;
              // copper curls spring up off the spindle (the last of the wire), steel grit drops
              for (let i = 0; i < 16; i++)
                sp.add({ x: home.x - dir * RR(-14, 30), y: home.y - RR(2, 10), vx: RR(-35, 35), vy: i % 3 === 0 ? RR(-95, -55) : RR(-50, -15), ay: 340, drag: 1, life: RR(220, 380), colors: i % 3 === 2 ? [PAL.stone3, PAL.stone2, PAL.stone1] : [PAL.skin3, PAL.fire3, PAL.fire2], shape: i % 3 === 0 ? 'ring' : 'px', size: 2, floor: home.y + RR(-2, 3), bounce: 0.25, fadeAt: 0.7 });
              sp.release();
            }
          }
          return el < ms;
        },
        () => {
          if (img.active) img.destroy();
        },
      );
    },
    destroy,
  };
}

// ---------------------------------------------------------------- the empty spool (death end)

/** The shoulder spool's radius on the rig (polar_coil-rig SP_N_R): the spool leaves the spindle at this size. */
const SPOOL_R = 5;
type SpoolPx = readonly (readonly [number, number, number])[];
const spoolCache = new Map<string, SpoolPx>();

/**
 * The empty spool's pixels (relative to its centre) — the rig's shoulder spool exactly (paintSpool, reel 0:
 * magnetite flange rim lit top-left, the dark empty well, the gold-ringed hub), seen with its face squashed to
 * `k` of its width (1 = face on, as on the shoulder; < 1 = turning side-on: the back flange and the bare barrel
 * show beside it), with three spokes turned to `step` (of 9 per third of a turn). Ink outline (the rig's stone0).
 */
function spoolPixels(k: number, step: number, side: 1 | -1): SpoolPx {
  const id = `${k.toFixed(2)}:${step % 9}:${side}`;
  const hit = spoolCache.get(id);
  if (hit) return hit;
  const S = 17;
  const C = 8;
  const q = new PixelCanvas(S, S);
  const r = SPOOL_R;
  const rx = Math.max(1.2, r * k);
  // the back flange and the barrel (only while it turns side-on): offset away from the light side
  const depth = Math.round((1 - k) * 4);
  const face = (cx: number, back: boolean) => {
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - C) / r;
        const n = Math.hypot(dx, dy);
        if (n > 1 + 0.35 / r) continue;
        const d = n * r;
        if (back) {
          q.set(x, y, d > r - 1.6 ? PAL.stone1 : PAL.stone0);
          continue;
        }
        // facing toward the key light (top-left on screen)
        const f = (-dx * rx - (y + 0.5 - C) * 0.9) / Math.max(1, d);
        let c: number;
        if (d > r - 1.6) c = f > 0.35 ? PAL.stone3 : f < -0.45 ? PAL.stone1 : PAL.stone2;
        else if (d < 1.6) c = f > 0 ? PAL.gold3 : PAL.gold2;
        else c = d < 2.6 ? PAL.gold1 : PAL.stone0;
        q.set(x, y, c);
      }
  };
  if (depth > 0) {
    face(C + side * depth, true);
    // the bare barrel between the flanges: an iron band with one copper-stained row (the wire is gone)
    for (let i = 1; i < depth; i++) for (let y = C - 2; y <= C + 1; y++) q.set(Math.floor(C + side * i), y, y === C - 2 ? PAL.fire1 : PAL.stone1);
  }
  face(C, false);
  // three spokes from the hub to the rim (lit magnetite on the dark well), turned in 13⅓° steps; the rim notch
  const a0 = (step / 9) * (TAU / 3);
  for (let i = 0; i < 3; i++) {
    const b = a0 + (i * TAU) / 3;
    for (let t = 1.6; t <= r - 1.2; t += 0.5) {
      const x = Math.floor(C + Math.cos(b) * t * k);
      const y = Math.floor(C + Math.sin(b) * t);
      if (q.isOpaque(x, y)) q.set(x, y, i === 0 ? PAL.stone4 : PAL.stone3);
    }
    const nx = Math.floor(C + Math.cos(b) * (r - 0.8) * k);
    const ny = Math.floor(C + Math.sin(b) * (r - 0.8));
    if (q.isOpaque(nx, ny)) q.set(nx, ny, PAL.ink);
  }
  q.set(C, C, PAL.ink);
  q.outline(PAL.stone0);
  const out: [number, number, number][] = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const c = q.get(x, y);
    if (c !== null) out.push([x - C, y - C, c]);
  }
  spoolCache.set(id, out);
  return out;
}

/** The spool's timeline (scene ms): pop + side-on wobble, the roll, the run-down wobble, the break. */
export const SPOOL_POP = 90;
export const SPOOL_ROLL = 220;
export const SPOOL_RUNDOWN = 60;
export const SPOOL_BREAK = 110;
export const SPOOL_MS = SPOOL_POP + SPOOL_ROLL + SPOOL_RUNDOWN + SPOOL_BREAK;

/**
 * Death end (§5.2 "tel çözülür, makara boş döner"): the EMPTY SPOOL comes off the fallen spindle at the very size it
 * had on the shoulder (from = its centre there), turns side-on as it drops to its rim (2 wobble frames: the back
 * flange and the bare barrel show), rolls ~18 px down the tile's 2:1 diagonal toward the front with its three spokes
 * turning faster than it travels (an empty reel spinning free), runs down with a coin-like wobble, and in the last
 * SPOOL_BREAK ms breaks with the remains: copper curls spring off it and it goes in two dither steps. Loose copper
 * curls spring out of the wire heap as it leaves. Resolves when it is gone.
 */
export function emptySpool(sc: Phaser.Scene, home: XY, dir: 1 | -1, depth: number, from?: XY, onBreak?: () => void): Promise<void> {
  const sp = new Sparks(sc, depth);
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1;
    sp.add({ x: home.x - dir * RR(6, 20), y: home.y - RR(1, 5), vx: side * RR(25, 70), vy: RR(-80, -35), ay: 420, drag: 1.4, life: RR(380, 560), colors: COPPER, shape: i % 3 === 0 ? 'ring' : 'streak', size: 2, len: 0.03, floor: home.y + RR(-4, 5), bounce: 0.35, fadeAt: 0.75 });
  }
  sp.release();
  const start = from ?? { x: home.x - dir * 14, y: home.y - 6 };
  const restY = home.y + 1 - SPOOL_R;
  // it leaves the fallen spindle's head end and rolls AWAY from the body (−dir: past the head, toward the front of
  // the tile down the 2:1 diagonal), so the spool reads clear of the remains
  const land = { x: start.x - dir * 5, y: restY };
  const roll = { x: -dir * 18, y: 9 };
  const r = Raster.around(sc, home.x, home.y - 10, 140, 90, depth);
  const T1 = SPOOL_POP;
  const T2 = T1 + SPOOL_ROLL;
  const T3 = T2 + SPOOL_RUNDOWN;
  return new Promise<void>((resolve) => {
    let broke = false;
    onFrame(
      sc,
      (_dt, el) => {
        if (el >= SPOOL_MS || !r.alive) return false;
        let x: number;
        let y: number;
        let k: number;
        let step: number;
        if (el < T1) {
          // off the shoulder in a short hop; it turns side-on as it drops onto its rim
          const t = el / T1;
          x = start.x + (land.x - start.x) * t;
          y = start.y + (land.y - start.y) * t * t - Math.sin(t * Math.PI) * 4;
          k = el < T1 * 0.4 ? 1 : el < T1 * 0.75 ? 0.6 : 0.4;
          step = Math.floor(el / 40);
        } else if (el < T2) {
          const t = (el - T1) / SPOOL_ROLL;
          const e = 1 - (1 - t) ** 2;
          x = land.x + roll.x * e;
          y = land.y + roll.y * e;
          // on its rim, the face a little turned; a wobble every other beat (an empty reel is light)
          k = Math.floor((el - T1) / 65) % 2 ? 0.7 : 0.82;
          // the spokes turn faster than the reel travels (spinning free), slowing with the roll
          step = 3 + Math.floor(e * 16);
        } else {
          x = land.x + roll.x;
          y = land.y + roll.y;
          const t = el - T2;
          // the run-down: a coin's settling wobble, then it rests leaning
          k = t < SPOOL_RUNDOWN ? [0.5, 0.86, 0.45][Math.min(2, Math.floor(t / (SPOOL_RUNDOWN / 3)))] : 0.55;
          step = 19;
        }
        const lv = el < T3 ? 1 : el < T3 + SPOOL_BREAK / 2 ? 0.6 : 0.3;
        if (el >= T3 && !broke) {
          broke = true;
          onBreak?.();
          // the break: copper curls spring off the reel, steel grit drops
          const b = new Sparks(sc, depth + 0.1);
          for (let i = 0; i < 9; i++) {
            const a = -Math.PI / 2 + RR(-1.3, 1.3);
            const v = RR(30, 75);
            b.add({ x: x + RR(-3, 3), y: y + RR(-3, 3), vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 380, drag: 1.2, life: RR(240, 380), colors: i % 3 === 2 ? [PAL.stone3, PAL.stone2, PAL.stone1] : COPPER, shape: i % 3 === 0 ? 'ring' : 'px', size: 2, floor: home.y + RR(-1, 6), bounce: 0.3, fadeAt: 0.7 });
          }
          b.release();
        }
        const X = Math.round(x);
        const Y = Math.round(y);
        r.draw((g) => {
          // the floor contact shadow under the rim
          g.ell(X + dir, Math.round(restY + (y - land.y > 0 ? y - land.y : 0)) + SPOOL_R + 1, Math.max(2, Math.round(SPOOL_R * k)), 1, PAL.night1, lv);
          for (const [dx, dy, c] of spoolPixels(k, step, dir === 1 ? -1 : 1)) g.dpx(X + dx, Y + dy, c, lv);
        });
        return true;
      },
      () => {
        r.destroy();
        resolve();
      },
    );
  });
}
