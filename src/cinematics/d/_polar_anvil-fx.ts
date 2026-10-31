// Kutup Örsü (polar_anvil) — the card's own effect pieces (?look=v3 only; registers nothing: the `_` file is
// loaded by the cinematics glob but has no side effects). Used by ./polar_anvil.ts; written so the Kutup
// Hükümdarı (polar_sovereign) fusion / split can reuse the anvil's pieces as its hips / base:
//
//   poleOf(u, 'heel' | 'horn' | 'face')   the anvil's N pole (heel), S pole (horn tip) and face of the frame on screen
//   fieldLines(sc, u, ms)                  the charge: iron dust streams heel → horn along three field arcs, the
//                                          floor ring under the base draws in step by step
//   faceSparks(sc, at, dir)                the DANG on the face: a fan of white / gold / blue streaks
//   pushWave(sc, o)                        "İtme Dalgası": three field-ring fronts ")" roll from the horn to the
//                                          target, each with its floor arc; resolves when the first one lands
//   waveContact(sc, at, ground, o)         the wave lands: one stepped ring round the struck body + dust thrown along
//   waveRebound(sc, o)                     blocked: the fronts flatten on the guard and two weak echoes ring back
//   fieldSeam(sc, home, dir, depth)        the summon: two half rings (N orange / S blue) slide shut on the floor
//                                          under the halves; weld() turns them into one blue ring that rolls out
//   sparkFountain(sc, at, floorY, depth)   the weld's spark fountain: gold / white sparks up, bouncing on the floor
//   poleStrobe(sc, u, home, ms)            death: the floor light swaps orange / blue on every frame
//   repelBurst(sc, at, home, depth)        death 'dissolve': two half rings (orange back / blue front) shoot apart
//   ironPlates(sc, home, push, depth)      death burst: iron plates skid out over the floor, the last sparks die
//
// Pixel language (REHBER EF-6 / EF-7): 1-px lines, palette steps instead of alpha, whole-pixel positions, at
// most one ring per beat, stepped light on the floor.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, type XY } from '../../view/layout';
import { lightFlash, lightPool } from '../../view/light';
import { Raster } from '../../vfx/setpieces';
import { Sparks, animate, onFrame, sleep } from '../../vfx/combat';
import { framePose } from '../../art/monsters-v3/polar_anvil-anims';
import { skeleton } from '../../art/monsters-v3/polar_anvil-rig';

export const TAU = Math.PI * 2;
/** Floor marks just above the cards on the tiles. */
export const FLOOR_DEPTH = DEPTH.CARD_ON_TILE + 2;
const BLUE = [PAL.white, PAL.water4, PAL.water3, PAL.water2, PAL.water1] as const;
const ORANGE = [PAL.gold4, PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1] as const;
const DUST = [PAL.mist, PAL.steel, PAL.stone3] as const;

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

// ================================================================ the anvil's points

/** A point of the anvil's skeleton on the frame on screen, in world px (null: gone / another art). */
export function poleOf(u: MonsterUnit, which: 'heel' | 'horn' | 'face'): XY | null {
  if (!u.sprite.active || u.cardId !== 'polar_anvil') return null;
  const fi = u.frameInfo();
  const sk = skeleton(framePose(fi.anim ?? 'idle', fi.frame));
  const p = which === 'heel' ? sk.heel : which === 'horn' ? sk.horn : ([sk.T[0] + 6, sk.T[1] - 21] as const);
  return rx(u.framePoint(Math.floor(p[0]) + 0.5, Math.floor(p[1]) + 0.5));
}

// ================================================================ charge: field lines

/** The charge (see header): runs `ms`, then clears itself. */
export function fieldLines(sc: Phaser.Scene, u: MonsterUnit, ms: number): void {
  const home = u.home;
  const air = Raster.around(sc, home.x, home.y - 40, 130, 96, u.sprite.depth + 0.4);
  const floor = Raster.around(sc, home.x, home.y, 80, 40, FLOOR_DEPTH);
  const ARCS = [16, 27, 38];
  onFrame(
    sc,
    (_dt, el) => {
      if (el >= ms || !u.sprite.active) return false;
      const t = el / ms;
      const heel = poleOf(u, 'heel');
      const horn = poleOf(u, 'horn');
      if (heel && horn) {
        const mid = { x: (heel.x + horn.x) / 2, y: (heel.y + horn.y) / 2 };
        const half = Math.abs(horn.x - heel.x) / 2 + 6;
        air.draw((g) => {
          // three field arcs over the block; dots stream N (heel) → S (horn), denser as the charge grows
          const shown = t < 0.15 ? 1 : t < 0.35 ? 2 : 3;
          for (let a = 0; a < shown; a++) {
            const hgt = ARCS[a];
            const n = 12 + a * 3 + Math.floor(t * 8);
            for (let i = 0; i < n; i++) {
              const k = ((i / n + el * (0.0011 + a * 0.0002)) % 1 + 1) % 1;
              const ang = Math.PI * k;
              const sgnX = horn.x >= heel.x ? 1 : -1;
              const x = mid.x - sgnX * Math.cos(ang) * half;
              const y = mid.y - Math.sin(ang) * hgt;
              const c = k < 0.25 ? PAL.fire3 : k > 0.75 ? PAL.water4 : (i + a) % 3 === 0 ? PAL.mist : PAL.steel;
              // a 2-px filing lying along the field line (its tail one step back on the arc)
              const ang2 = Math.PI * Math.max(0, k - 0.045);
              const tx = mid.x - sgnX * Math.cos(ang2) * half;
              const ty = mid.y - Math.sin(ang2) * hgt;
              g.px(Math.round(tx), Math.round(ty), k < 0.5 ? PAL.fire1 : PAL.water1);
              g.px(Math.round(x), Math.round(y), c);
            }
          }
          // the poles light up: a 1-px tick at each end
          g.px(heel.x, heel.y, Math.floor(el / 60) % 2 ? PAL.fire4 : PAL.gold4);
          g.px(horn.x, horn.y, Math.floor(el / 60) % 2 ? PAL.water4 : PAL.white);
        });
      }
      // the floor ring under the base draws in, in steps
      floor.draw((g) => {
        const r = [26, 22, 18, 15][Math.min(3, Math.floor(t * 4))];
        g.ring(home.x, home.y, r, r * 0.5, t > 0.7 ? PAL.water3 : PAL.water2, 1, 0, TAU);
        if (t > 0.45) g.ring(home.x, home.y, r + 5, (r + 5) * 0.5, PAL.water1, 0.5, 0, TAU);
      });
      return true;
    },
    () => {
      air.destroy();
      floor.destroy();
    },
  );
}

// ================================================================ release: sparks off the face

/** The DANG: a fan of streaks off the face where the mauls land (`dir`: the anvil's facing, ±1). */
export function faceSparks(sc: Phaser.Scene, at: XY, dir: number, floorY: number): void {
  const sp = new Sparks(sc, DEPTH.FX + 1);
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + RR(-1.25, 1.25);
    const v = RR(70, 160);
    sp.add({ x: at.x + RR(-4, 4), y: at.y, vx: Math.cos(a) * v + dir * 10, vy: Math.sin(a) * v, ay: 380, drag: 1.5, life: RR(200, 380), colors: i % 3 === 0 ? [PAL.white, PAL.water4, PAL.water3] : [PAL.white, PAL.gold4, PAL.fire3], shape: 'streak', len: 0.025, floor: floorY + RR(-2, 3), bounce: 0.3 });
  }
  sp.release();
  void lightFlash(sc, at.x, at.y, PAL.water4, 30, 300, { floorY, intensity: 1, air: 0.6 });
}

// ================================================================ the push wave

export interface WaveOpts {
  from: XY;
  to: XY;
  /** Floor under `from` / under `to`. */
  g0: XY;
  g1: XY;
  /** Flight of the first front (scene ms). */
  ms: number;
  depth: number;
  /** A big front (a direct attack: the wave crosses the whole field). */
  big?: boolean;
  /** The first front lands (call the impact here). */
  onArrive(): void;
  /** Each later front lands (a smaller pulse). */
  onEcho?(i: number, at: XY): void;
  /** Blocked: fronts stop at the guard (they break there; ./waveRebound draws the echo). */
  blocked?: boolean;
}

/** Three field-ring fronts roll from the horn to the target (see header). Resolves when the last is gone. */
export function pushWave(sc: Phaser.Scene, o: WaveOpts): Promise<void> {
  const N = 3;
  const GAP = 55;
  const dx = o.to.x - o.from.x;
  const dy = o.to.y - o.from.y;
  const sgn = dx >= 0 ? 1 : -1;
  const pad = 40;
  const x0 = Math.min(o.from.x, o.to.x, o.g0.x, o.g1.x) - pad;
  const y0 = Math.min(o.from.y, o.to.y) - pad;
  const x1 = Math.max(o.from.x, o.to.x, o.g0.x, o.g1.x) + pad;
  const y1 = Math.max(o.from.y, o.to.y) + pad;
  const air = new Raster(sc, x0, y0, x1 - x0, y1 - y0, o.depth);
  const gy0 = Math.min(o.g0.y, o.g1.y) - 24;
  const gy1 = Math.max(o.g0.y, o.g1.y) + 24;
  const floor = new Raster(sc, x0, gy0, x1 - x0, gy1 - gy0, FLOOR_DEPTH);
  const dust = new Sparks(sc, o.depth - 0.1);
  const lp = lightPool(sc, o.g0.x, o.g0.y, { color: PAL.water4, spill: PAL.water3, radius: 16, intensity: 0.8, fadeIn: 40 });
  const landed = new Array<boolean>(N).fill(false);
  const hMax = o.big ? 20 : 15;
  let acc = 0;
  return new Promise<void>((resolve) => {
    onFrame(
      sc,
      (dt, el) => {
        let alive = 0;
        air.begin();
        floor.begin();
        for (let i = 0; i < N; i++) {
          const local = el - i * GAP;
          if (local < 0) {
            alive++;
            continue;
          }
          // the fronts accelerate a little out of the horn (a shove, not a float)
          const raw = local / o.ms;
          const e = raw >= 1 ? 1 : 0.25 * raw + 0.75 * raw * raw;
          if (raw >= 1 && !landed[i]) {
            landed[i] = true;
            if (i === 0) o.onArrive();
            else o.onEcho?.(i, o.to);
          }
          // after landing a front lives 2 steps more (flattening on the body), then it is gone
          const after = raw - 1;
          if (after > 0.35) continue;
          alive++;
          const p = { x: o.from.x + dx * e, y: o.from.y + dy * e };
          const g = { x: o.g0.x + (o.g1.x - o.g0.x) * e, y: o.g0.y + (o.g1.y - o.g0.y) * e };
          if (i === 0) lp.setPosition(Math.round(g.x), Math.round(g.y));
          const grow = Math.min(1, e * 1.4);
          let h = Math.round((5 + (hMax - 5) * grow) * (1 - i * 0.12));
          let bulge = 2 + Math.round(2 * grow);
          if (after > 0) {
            // flattened on the body: taller, no bulge, bright
            h += 2;
            bulge = 0;
          }
          const ramp = i === 0 ? [after > 0 || e < 0.2 ? PAL.white : PAL.water4, PAL.water3, PAL.water2] : i === 1 ? [PAL.water3, PAL.water2, PAL.water1] : [PAL.water2, PAL.water1, PAL.night3];
          const px = Math.round(p.x);
          const py = Math.round(p.y);
          for (let yy = -h; yy <= h; yy++) {
            const k = yy / h;
            const xx = px + sgn * Math.round(bulge * (1 - k * k));
            const c = Math.abs(k) < 0.45 ? ramp[0] : Math.abs(k) < 0.8 ? ramp[1] : ramp[2];
            air.px(xx, py + yy, c);
            // the trailing band (2 px deep on the first front, dithered on the rest)
            if (i === 0) {
              air.px(xx - sgn, py + yy, Math.abs(k) < 0.6 ? PAL.water3 : PAL.water2);
              if (Math.abs(k) < 0.7) air.px(xx - 2 * sgn, py + yy, PAL.water1);
            }
            else if ((yy & 1) === 0) air.px(xx - sgn, py + yy, PAL.water1);
          }
          // the floor arc: the front half of an iso field ring, travelling under the front
          const fr = Math.round(h * 0.9);
          for (let s = 0; s < 22; s++) {
            const a = -Math.PI / 2 + (s / 21) * Math.PI;
            const fx = g.x + sgn * Math.cos(a) * fr * 0.55;
            const fy = g.y + Math.sin(a) * fr * 0.45;
            floor.dpx(Math.round(fx), Math.round(fy), i === 0 ? PAL.water3 : PAL.water2, i === 0 ? 1 : 0.5);
          }
          // iron dust swept along by the first front
          if (i === 0 && after <= 0) {
            acc += dt;
            while (acc > 28) {
              acc -= 28;
              dust.add({ x: px - sgn * RR(1, 4), y: py + RR(-h, h), vx: sgn * RR(10, 40) + dx * 0.15, vy: dy * 0.15 + RR(-8, 8), drag: 3, life: RR(160, 280), colors: DUST, shape: 'px', fadeAt: 1 });
            }
          }
        }
        air.end();
        floor.end();
        return alive > 0;
      },
      () => {
        air.destroy();
        floor.destroy();
        dust.release();
        void lp.fadeOut(160);
        resolve();
      },
    );
  });
}

/** The wave lands: one stepped ring round the struck body, the floor ring under it, dust thrown along the blow. */
export function waveContact(sc: Phaser.Scene, at: XY, ground: XY, o: { dir: XY; depth: number; small?: boolean }): void {
  const r = Raster.around(sc, at.x, at.y, 90, 90, o.depth);
  const f = Raster.around(sc, ground.x, ground.y, 100, 50, FLOOR_DEPTH);
  const RXS = o.small ? [7, 11, 15] : [8, 13, 18, 23];
  void (async () => {
    for (let s = 0; s < RXS.length; s++) {
      if (!r.alive) return;
      const rr = RXS[s];
      const c = s === 0 ? PAL.white : s === 1 ? PAL.water4 : s === 2 ? PAL.water3 : PAL.water2;
      r.draw((g) => g.ring(at.x, at.y, Math.round(rr * 0.75), rr, c, s < 2 ? 1 : 0.6, 0, TAU));
      f.draw((g) => g.ring(ground.x, ground.y, rr + 6, (rr + 6) * 0.5, s < 2 ? PAL.water3 : PAL.water2, s < 3 ? 1 : 0.5, 0, TAU));
      await sleep(sc, 40);
    }
    r.destroy();
    f.destroy();
  })();
  const sp = new Sparks(sc, DEPTH.FX + 2);
  const n = o.small ? 6 : 12;
  for (let i = 0; i < n; i++) {
    const a = Math.atan2(o.dir.y, o.dir.x) + RR(-0.9, 0.9);
    const v = RR(60, 130);
    sp.add({ x: at.x, y: at.y + RR(-8, 8), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, drag: 3, life: RR(220, 380), colors: i % 2 ? [PAL.water4, PAL.water3, PAL.water2] : DUST, shape: 'px', fadeAt: 1 });
  }
  sp.release();
  void lightFlash(sc, at.x, at.y, PAL.water4, o.small ? 22 : 32, 320, { floorY: ground.y, intensity: o.small ? 0.7 : 1, ring: !o.small });
}

/** Blocked: two weak echoes ring back from the guard toward the anvil (half the way) and die. */
export function waveRebound(sc: Phaser.Scene, o: { from: XY; to: XY; depth: number }): Promise<void> {
  const back = { x: o.to.x + (o.from.x - o.to.x) * 0.5, y: o.to.y + (o.from.y - o.to.y) * 0.5 };
  const sgn = o.from.x >= o.to.x ? 1 : -1;
  const r = new Raster(sc, Math.min(o.to.x, back.x) - 30, Math.min(o.to.y, back.y) - 30, Math.abs(back.x - o.to.x) + 60, Math.abs(back.y - o.to.y) + 60, o.depth);
  return animate(sc, 220, (t, el) => {
    r.begin();
    for (let i = 0; i < 2; i++) {
      const k = Math.max(0, Math.min(1, (el - i * 60) / 160));
      if (k <= 0 || k >= 1) continue;
      const p = { x: Math.round(o.to.x + (back.x - o.to.x) * k), y: Math.round(o.to.y + (back.y - o.to.y) * k) };
      const h = Math.round(12 - 6 * k);
      for (let yy = -h; yy <= h; yy++) {
        const kk = yy / h;
        if (i === 1 && (yy & 1)) continue;
        r.px(p.x + sgn * Math.round(2 * (1 - kk * kk)), p.y + yy, k < 0.4 ? PAL.water3 : PAL.water2);
      }
    }
    r.end();
    void t;
  }).then(() => r.destroy());
}

// ================================================================ summon

export interface Seam {
  /** The halves weld: the half rings and the arc clear (the finale's ring takes over). */
  weld(): void;
  destroy(): void;
}

/**
 * The summon floor: two half rings (the N half orange on the anvil's back side, the S half blue on its
 * front) slide toward each other under the sliding half-anvils; filings line up between them.
 */
export function fieldSeam(sc: Phaser.Scene, home: XY, dir: 1 | -1, depth: number): Seam {
  const f = Raster.around(sc, home.x, home.y, 110, 50, FLOOR_DEPTH);
  const air = Raster.around(sc, home.x, home.y - 20, 110, 50, depth - 0.2);
  let welded = -1;
  let elNow = 0;
  let weldAsk = false;
  const stop = onFrame(
    sc,
    (_dt, el) => {
      elNow = el;
      if (weldAsk && welded < 0) welded = elNow;
      if (welded < 0) {
        const t = Math.min(1, el / 560);
        const off = Math.round(14 * (1 - t));
        const R = 22;
        f.draw((g) => {
          // back half (N, orange) and front half (S, blue), each drawn as a C shape opening to the centre
          g.ring(home.x - dir * off, home.y, R, R * 0.5, PAL.fire2, 1, Math.PI / 2, (3 * Math.PI) / 2);
          g.ring(home.x + dir * off, home.y, R, R * 0.5, PAL.water2, 1, -Math.PI / 2, Math.PI / 2);
          if (t > 0.3) {
            g.ring(home.x - dir * off, home.y, R - 4, (R - 4) * 0.5, PAL.fire1, 0.5, Math.PI / 2, (3 * Math.PI) / 2);
            g.ring(home.x + dir * off, home.y, R - 4, (R - 4) * 0.5, PAL.water1, 0.5, -Math.PI / 2, Math.PI / 2);
          }
          // the filings: short dashes lined up along the field between the halves
          for (let i = -3; i <= 3; i++) {
            const x = home.x + i * 5;
            const y = home.y + ((i * 7) % 3) - 1;
            if (Math.abs(i) * 5 > R + 4 - off) continue;
            g.px(x, y, (i + Math.floor(el / 70)) % 2 ? PAL.steel : PAL.mist);
            g.px(x + 1, y, PAL.stone3);
          }
        });
        // the arc between the halves (above the floor): a jagged 1-px line that re-draws every 50 ms
        air.draw((g) => {
          if (t < 0.15) return;
          const seed0 = Math.floor(el / 50);
          let x = home.x - dir * (off + 6);
          let y = home.y - 14;
          const x2 = home.x + dir * (off + 6);
          const n = 6;
          for (let i = 1; i <= n; i++) {
            const nx = x + (x2 - (home.x - dir * (off + 6))) / n;
            const ny = home.y - 14 + (((seed0 * 7 + i * 13) % 7) - 3);
            g.line(x, y, nx, ny, i === n || i === 1 ? PAL.water3 : (seed0 + i) % 3 ? PAL.water4 : PAL.white);
            x = nx;
            y = ny;
          }
        });
        return true;
      }
      // welded: the halves are one — the seam clears (the summon's finale ring rolls out from here, EF-7: one ring)
      air.draw(() => undefined);
      f.draw(() => undefined);
      return false;
    },
    () => {
      f.destroy();
      air.destroy();
    },
  );
  return {
    weld() {
      weldAsk = true;
    },
    destroy() {
      stop();
      f.destroy();
      air.destroy();
    },
  };
}

/** The weld's spark fountain: gold / white sparks thrown up out of the seam, falling and bouncing on the floor. */
export function sparkFountain(sc: Phaser.Scene, at: XY, floorY: number, depth: number, n = 26): void {
  const sp = new Sparks(sc, depth);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + RR(-0.5, 0.5);
    const v = RR(110, 210);
    sp.add({ x: at.x + RR(-2, 2), y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 520, drag: 0.6, life: RR(520, 820), delay: RR(0, 140), colors: i % 4 === 0 ? [PAL.white, PAL.water4, PAL.water3, PAL.water2] : [PAL.white, PAL.gold4, PAL.fire4, PAL.fire3, PAL.fire2], shape: i % 3 === 0 ? 'streak' : 'px', len: 0.02, floor: floorY + RR(-3, 4), bounce: 0.35, fadeAt: 0.7 });
  }
  sp.release();
  void lightFlash(sc, at.x, at.y - 10, PAL.gold4, 34, 520, { floorY, intensity: 0.9, air: 0.5 });
}

// ================================================================ death

/** Death f1–f3: the floor light under the anvil swaps orange / blue every frame change (`ms` long). */
export function poleStrobe(sc: Phaser.Scene, home: XY, ms: number): void {
  const pool = lightPool(sc, home.x, home.y, { color: PAL.fire3, radius: 26, intensity: 1, fadeIn: 0 });
  let last = -1;
  onFrame(
    sc,
    (_dt, el) => {
      const k = Math.floor(el / 55);
      if (k !== last) {
        last = k;
        pool.setColor(k % 2 ? PAL.water3 : PAL.fire3);
      }
      return el < ms;
    },
    () => void pool.fadeOut(120),
  );
}

/** Death 'dissolve': the repulsion — an orange half ring flies back, a blue one forward, iron dust bursts out. */
export function repelBurst(sc: Phaser.Scene, at: XY, home: XY, dir: 1 | -1, depth: number): void {
  const r = Raster.around(sc, at.x, at.y, 140, 90, depth);
  const f = Raster.around(sc, home.x, home.y, 140, 50, FLOOR_DEPTH);
  void (async () => {
    for (let s = 0; s < 5; s++) {
      if (!r.alive) return;
      const off = [3, 9, 16, 24, 32][s];
      const h = [10, 13, 15, 16, 16][s];
      const lv = s < 3 ? 1 : 0.5;
      r.draw((g) => {
        for (let yy = -h; yy <= h; yy++) {
          const k = yy / h;
          const b = Math.round(3 * (1 - k * k));
          g.dpx(at.x + dir * (off + b), at.y + yy, s < 1 ? PAL.white : Math.abs(k) < 0.5 ? PAL.water4 : PAL.water3, lv);
          g.dpx(at.x - dir * (off + b), at.y + yy, s < 1 ? PAL.white : Math.abs(k) < 0.5 ? PAL.fire4 : PAL.fire3, lv);
        }
      });
      f.draw((g) => {
        const R = 16 + off;
        g.ring(home.x, home.y, R, R * 0.5, PAL.water2, lv, -Math.PI / 2, Math.PI / 2);
        g.ring(home.x, home.y, R, R * 0.5, PAL.fire2, lv, Math.PI / 2, (3 * Math.PI) / 2);
      });
      await sleep(sc, 40);
    }
    r.destroy();
    f.destroy();
  })();
  const sp = new Sparks(sc, depth + 0.1);
  for (let i = 0; i < 18; i++) {
    const side = i % 2 ? 1 : -1;
    const a = (side * dir > 0 ? 0 : Math.PI) + RR(-0.7, 0.7);
    const v = RR(60, 150);
    sp.add({ x: at.x, y: at.y + RR(-8, 8), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 20, ay: 200, drag: 2, life: RR(260, 460), colors: side * dir > 0 ? [PAL.water4, PAL.water3, PAL.steel] : [PAL.fire4, PAL.fire3, PAL.steel], shape: 'px', fadeAt: 1 });
  }
  sp.release();
  void lightFlash(sc, at.x, at.y, PAL.water4, 36, 360, { floorY: home.y, intensity: 1, ring: true });
}

/** Death burst: iron plates skid out over the floor (whole px, stepped out), the last pole sparks die. */
export function ironPlates(sc: Phaser.Scene, home: XY, dir: 1 | -1, depth: number): void {
  const sp = new Sparks(sc, depth);
  for (let i = 0; i < 9; i++) {
    const side = i % 2 ? 1 : -1;
    sp.add({ x: home.x + side * RR(4, 14), y: home.y - RR(2, 10), vx: side * RR(40, 90), vy: RR(-70, -30), ay: 420, drag: 1.6, life: RR(620, 900), colors: [PAL.steel, PAL.stone2, PAL.stone1], shape: 'sq', size: i % 3 === 0 ? 3 : 2, floor: home.y + RR(-4, 5), bounce: 0.2, fadeAt: 0.85 });
  }
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1;
    sp.add({ x: home.x + RR(-10, 10), y: home.y - RR(6, 22), vx: side * RR(20, 60), vy: RR(-60, -20), ay: 160, life: RR(260, 520), colors: side * dir > 0 ? [PAL.water4, PAL.water2] : [PAL.fire4, PAL.fire2], shape: 'px', fadeAt: 1, flicker: true });
  }
  sp.release();
}
