// Kutup Örsü (polar_anvil) — the card's own effect pieces (?look=v3 only; registers nothing: the `_` file is
// loaded by the cinematics glob but has no side effects). Used by ./polar_anvil.ts; written so the Kutup
// Hükümdarı (polar_sovereign) fusion / split can reuse the anvil's pieces as its hips / base:
//
//   poleOf(u, 'heel' | 'horn' | 'face')   the anvil's N pole (heel), S pole (horn tip) and face of the frame on screen
//   fieldLines(sc, u, ms)                  the charge: iron dust streams heel → horn along three field arcs, the
//                                          floor ring under the base draws in step by step
//   faceSparks(sc, at, dir)                the DANG on the face: a fan of white / gold / blue streaks
//   pushWave(sc, o)                        "İtme Dalgası": three field rings (floor ellipse + standing front ")")
//                                          grow out of the base ring and roll to the target, each with its own light
//   waveContact(sc, at, ground, o)         the wave lands: one stepped ring round the struck body + dust thrown along
//   waveRebound(sc, o)                     blocked: the fronts flatten on the guard and two weak echoes ring back
//   fieldSeam(sc, home, dir, depth)        the summon: two half rings (N orange / S blue) slide shut on the floor
//                                          under the halves; weld() turns them into one blue ring that rolls out
//   fieldSnap(sc, home, depth)             the flip: the field ring snaps on round the card, a weld spark
//   sparkFountain(sc, at, floorY, depth)   the weld's spark fountain: gold / white sparks up, bouncing on the floor
//   poleStrobe(sc, u, home, ms)            death: the floor light swaps orange / blue on every frame
//   repelBurst(sc, at, home, depth)        death 'dissolve': two half rings (orange back / blue front) shoot apart
//   ironPlates(sc, home, push, depth)      death burst: iron plates and gold weld beads skid out and rest on the floor
//   anvilRemains(sc, spr, home, heel, horn) death end: the last frame as remains, poles dying, twitches, 220-ms break
//
// Pixel language (REHBER EF-6 / EF-7): 1-px lines, palette steps instead of alpha, whole-pixel positions, at
// most one ring per beat, stepped light on the floor.

import type Phaser from 'phaser';
import { PAL, RAMPS } from '../../art/palette';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, type XY } from '../../view/layout';
import { lightFlash, lightPool } from '../../view/light';
import { Raster } from '../../vfx/setpieces';
import { Sparks, animate, onFrame, sleep } from '../../vfx/combat';
import { framePose } from '../../art/monsters-v3/polar_anvil-anims';
import { H as RIG_H, SHARD_OFF, W as RIG_W, drawAnvil, skeleton, type Pose } from '../../art/monsters-v3/polar_anvil-rig';
import { PixelCanvas } from '../../art/pixel';

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

/** The two pole glyphs (heel N, horn S) on the death's last frame, where the repelled chunks came to rest. */
export function deadPoles(u: MonsterUnit): { heel: XY; horn: XY } | null {
  if (!u.sprite.active || u.cardId !== 'polar_anvil') return null;
  const n = u.frameCount('death');
  const sk = skeleton(framePose('death', n - 1));
  const at = (p: readonly [number, number], o: readonly [number, number]) => rx(u.framePoint(Math.floor(p[0] + o[0]) + 0.5, Math.floor(p[1] + o[1]) + 0.5));
  return { heel: at(sk.heel, SHARD_OFF[3]), horn: at(sk.horn, SHARD_OFF[4]) };
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

/**
 * The declaration's held wind-up frame: the field stirs before the charge — the first (low) field arc only, a few
 * filings drifting heel → horn, the pole ticks blinking slowly. Runs until `stop()` (the strike's own field lines
 * take over on the same arc) or `maxMs`.
 */
export function fieldStir(sc: Phaser.Scene, u: MonsterUnit, maxMs = 900): () => void {
  const home = u.home;
  const air = Raster.around(sc, home.x, home.y - 40, 130, 96, u.sprite.depth + 0.4);
  let stopped = false;
  onFrame(
    sc,
    (_dt, el) => {
      if (stopped || el >= maxMs || !u.sprite.active) return false;
      const heel = poleOf(u, 'heel');
      const horn = poleOf(u, 'horn');
      air.draw((g) => {
        if (!heel || !horn) return;
        const mid = { x: (heel.x + horn.x) / 2, y: (heel.y + horn.y) / 2 };
        const half = Math.abs(horn.x - heel.x) / 2 + 6;
        const sgnX = horn.x >= heel.x ? 1 : -1;
        // the filings appear one by one (fade-in by count, never by alpha)
        const n = Math.min(7, 2 + Math.floor(el / 60));
        for (let i = 0; i < n; i++) {
          const k = ((i / 7 + el * 0.0008) % 1 + 1) % 1;
          const ang = Math.PI * k;
          const x = mid.x - sgnX * Math.cos(ang) * half;
          const y = mid.y - Math.sin(ang) * 16;
          g.px(Math.round(x), Math.round(y), k < 0.25 ? PAL.fire2 : k > 0.75 ? PAL.water3 : PAL.steel);
        }
        g.px(heel.x, heel.y, Math.floor(el / 110) % 2 ? PAL.fire3 : PAL.fire4);
        g.px(horn.x, horn.y, Math.floor(el / 110) % 2 ? PAL.water3 : PAL.water4);
      });
      return true;
    },
    () => air.destroy(),
  );
  return () => {
    stopped = true;
  };
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
  /** Depth just behind the struck body: a front that touches it passes behind it (only its 1-px tips wrap in front). */
  backDepth?: number;
  /** A big front (a direct attack: the wave crosses the whole field). */
  big?: boolean;
  /** The first front lands (call the impact here). */
  onArrive(): void;
  /** Each later front lands (a smaller pulse). */
  onEcho?(i: number, at: XY): void;
  /** Blocked: fronts stop at the guard (they break there; ./waveRebound draws the echo). */
  blocked?: boolean;
}

/**
 * Three field rings roll from the anvil to the target (see header). Each ring is born as the anvil's own base
 * ring (an iso ellipse on the floor under the anvil) that grows as it travels, with a standing front ")" over
 * it: a 2-px bright leading band, a water3 / water2 tail, a stepped floor light of its own. Resolves when the
 * last is gone. The first ring's arrival is the impact (onArrive), the later two are echoes (onEcho).
 */
export function pushWave(sc: Phaser.Scene, o: WaveOpts): Promise<void> {
  const N = 3;
  const GAP = 70;
  const dx = o.to.x - o.from.x;
  const dy = o.to.y - o.from.y;
  const gdx = o.g1.x - o.g0.x;
  const gdy = o.g1.y - o.g0.y;
  const sgn = dx >= 0 ? 1 : -1;
  const pad = 48;
  const x0 = Math.min(o.from.x, o.to.x, o.g0.x, o.g1.x) - pad;
  const y0 = Math.min(o.from.y, o.to.y) - pad;
  const x1 = Math.max(o.from.x, o.to.x, o.g0.x, o.g1.x) + pad;
  const y1 = Math.max(o.from.y, o.to.y) + pad;
  const air = new Raster(sc, x0, y0, x1 - x0, y1 - y0, o.depth);
  // the column of a front that touches the body is drawn behind it, so the struck body reads its hit first
  const back = o.backDepth !== undefined ? new Raster(sc, x0, y0, x1 - x0, y1 - y0, o.backDepth) : null;
  const gy0 = Math.min(o.g0.y, o.g1.y) - 30;
  const gy1 = Math.max(o.g0.y, o.g1.y) + 30;
  const floor = new Raster(sc, x0, gy0, x1 - x0, gy1 - gy0, FLOOR_DEPTH);
  const dust = new Sparks(sc, o.depth - 0.1);
  // one stepped floor light per ring (the first the brightest)
  const pools: (ReturnType<typeof lightPool> | null)[] = [null, null, null];
  const poolOf = (i: number) => (pools[i] ??= lightPool(sc, o.g0.x, o.g0.y, { color: i === 0 ? PAL.water4 : PAL.water3, spill: PAL.water3, radius: [20, 16, 13][i], intensity: [0.9, 0.6, 0.45][i], fadeIn: 0 }));
  const poolOn = [false, false, false];
  const landed = new Array<boolean>(N).fill(false);
  // the standing front's half height and the floor ring's x radius: born at the base ring's size, growing
  const H0 = 8;
  const H1 = o.big ? 30 : 20;
  const R0 = 14;
  // a direct front's floor arc keeps growing with the distance it has crossed
  const R1 = o.big ? Math.max(30, Math.min(46, Math.round(Math.hypot(gdx, gdy) * 0.22))) : 22;
  let acc = 0;
  return new Promise<void>((resolve) => {
    onFrame(
      sc,
      (dt, el) => {
        let alive = 0;
        air.begin();
        back?.begin();
        floor.begin();
        for (let i = 0; i < N; i++) {
          const local = el - i * GAP;
          if (local < 0) {
            alive++;
            continue;
          }
          // a shove, not a float: fast out of the anvil, still pushing on arrival
          const raw = local / o.ms;
          const e = raw >= 1 ? 1 : 0.35 * raw + 0.65 * raw * raw;
          if (raw >= 1 && !landed[i]) {
            landed[i] = true;
            if (i === 0) o.onArrive();
            else o.onEcho?.(i, o.to);
          }
          // after landing a front collapses at once onto its floor ring (two steps), so the shove is seen
          const after = raw - 1;
          if (after > (back ? 0.2 : 0.3)) {
            if (poolOn[i]) {
              poolOn[i] = false;
              void pools[i]?.fadeOut(90);
            }
            continue;
          }
          const lp = poolOf(i);
          alive++;
          poolOn[i] = true;
          const sz = 1 - i * 0.14;
          // grows in steps of whole px (stepped, EF-6)
          const grow = Math.min(1, e * 1.15);
          let h = Math.round((H0 + (H1 - H0) * grow) * sz);
          let bulge = Math.round((2 + 4 * grow) * sz);
          if (after > 0) {
            // landed: the column folds down into a short ring stub on the floor in two steps
            h = back ? (after < 0.07 ? Math.max(3, Math.round(h * 0.4)) : 2) : h + 2;
            bulge = 0;
          }
          // touching the body (the last stretch, or landed): the column goes behind it
          const touch = back !== null && (raw > (i === 0 ? 0.82 : 0.6) || after > 0);
          const col = touch && back ? back : air;
          const p = { x: Math.round(o.from.x + dx * e), y: Math.round(o.from.y + dy * e) };
          const g = { x: Math.round(o.g0.x + gdx * e), y: Math.round(o.g0.y + gdy * e) };
          lp.setPosition(g.x, g.y);
          // tones: the first ring brightest; each later one a step down
          const lead = i === 0 ? (after > 0 || e < 0.15 ? PAL.white : PAL.water4) : i === 1 ? PAL.water4 : PAL.water3;
          const lead2 = i === 0 ? PAL.water4 : i === 1 ? PAL.water3 : PAL.water3;
          const tail = i === 2 ? PAL.water2 : PAL.water3;
          // ---- the floor ring: an iso ellipse travelling with the front, its leading half bright
          const R = Math.round((R0 + (R1 - R0) * grow) * sz);
          const ry = Math.max(4, Math.round(R * 0.5));
          floor.ring(g.x, g.y, R, ry, i === 0 ? PAL.water4 : PAL.water3, 1, -Math.PI / 2, Math.PI / 2);
          floor.ring(g.x, g.y, R, ry, PAL.water2, i === 0 ? 1 : 0.5, Math.PI / 2, (3 * Math.PI) / 2);
          if (i === 0) floor.ring(g.x, g.y, R - 4, ry - 2, PAL.water1, 0.5, 0, TAU);
          // a direct front's floor arc is doubled: a water4 rim over a water2 band
          if (o.big) floor.ring(g.x, g.y, R - 2, ry - 1, i === 0 ? PAL.water4 : PAL.water3, 1, -Math.PI / 2.4, Math.PI / 2.4);
          // the leading lip of the floor ring is 2 px (the field bites the marble)
          floor.ring(g.x + sgn, g.y, R, ry, i === 0 ? PAL.water3 : PAL.water2, 1, -Math.PI / 3, Math.PI / 3);
          // ---- the standing front ")": a 2-px leading band, then the tail (water3 → water2, dithered last)
          for (let yy = -h; yy <= h; yy++) {
            const k = yy / h;
            const ak = Math.abs(k);
            const xx = p.x + sgn * Math.round(bulge * (1 - k * k));
            const edge = ak > 0.82;
            // a direct front is a 2-band arc: a 2-px water4 rim over a 3-px water2 body
            const w = o.big ? 1 : 0;
            col.px(xx, p.y + yy, edge ? lead2 : lead);
            if (w) col.px(xx - sgn, p.y + yy, edge ? lead2 : PAL.water4);
            col.px(xx - (1 + w) * sgn, p.y + yy, edge ? tail : lead2);
            col.px(xx - (2 + w) * sgn, p.y + yy, tail);
            if (ak < 0.85) col.px(xx - (3 + w) * sgn, p.y + yy, PAL.water2);
            if (w && ak < 0.85) col.px(xx - (4 + w) * sgn, p.y + yy, PAL.water2);
            if (ak < 0.6 && ((yy + i) & 1) === 0) col.px(xx - (4 + 2 * w) * sgn, p.y + yy, PAL.water1);
            // in front of the body only the thin 1-px rim of the arc's tips (it wraps round the body)
            if (touch && ak > 0.78) air.px(xx, p.y + yy, lead2);
          }
          // the front's foot meets its floor ring: a short bright tick on the marble
          air.px(p.x + sgn * bulge, p.y + h + 1, lead2);
          // iron dust swept along by the first front
          if (i === 0 && after <= 0) {
            acc += dt;
            while (acc > 24) {
              acc -= 24;
              dust.add({ x: p.x - sgn * RR(1, 5), y: p.y + RR(-h, h), vx: sgn * RR(10, 40) + dx * 0.15, vy: dy * 0.15 + RR(-8, 8), drag: 3, life: RR(160, 280), colors: DUST, shape: 'px', fadeAt: 1 });
            }
          }
        }
        air.end();
        back?.end();
        floor.end();
        return alive > 0;
      },
      () => {
        air.destroy();
        back?.destroy();
        floor.destroy();
        dust.release();
        pools.forEach((lp, i) => {
          if (lp && poolOn[i]) void lp.fadeOut(140);
        });
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
  /** The halves touch (summon f3): forks crackle off the pinched seam, a tight bright ring pulses under it. */
  squeeze(): void;
  destroy(): void;
}

/**
 * The summon floor: two half rings (the N half orange on the anvil's back side, the S half blue on its
 * front) slide toward each other under the sliding half-anvils; filings line up between them.
 */
export function fieldSeam(sc: Phaser.Scene, home: XY, dir: 1 | -1, depth: number): Seam {
  const f = Raster.around(sc, home.x, home.y, 110, 50, FLOOR_DEPTH);
  const air = Raster.around(sc, home.x, home.y - 20, 110, 50, depth - 0.2);
  const front = Raster.around(sc, home.x, home.y - 20, 60, 60, depth + 0.3);
  let welded = -1;
  let elNow = 0;
  let weldAsk = false;
  let squeezeAt = -1;
  let squeezeAsk = false;
  const stop = onFrame(
    sc,
    (_dt, el) => {
      elNow = el;
      if (weldAsk && welded < 0) welded = elNow;
      if (squeezeAsk && squeezeAt < 0) squeezeAt = elNow;
      if (welded < 0 && squeezeAt >= 0) {
        // pinched: forks flick off the seam (re-drawn every 30 ms), the floor ring under it pulses tight
        const k = Math.floor((el - squeezeAt) / 30);
        front.draw((g) => {
          for (let i = 0; i < 5; i++) {
            const side = (i + k) % 2 ? 1 : -1;
            const y = home.y - 4 - (((k * 11 + i * 7) % 9) * 3);
            const len = 2 + ((k + i * 3) % 4);
            let x = home.x + 1 + side * 3;
            let yy = y;
            for (let j = 0; j < len; j++) {
              x += side;
              yy += ((k + i + j) % 3) - 1;
              g.px(x, yy, j === 0 ? PAL.white : j < 2 ? PAL.water4 : PAL.water3);
            }
          }
        });
        f.draw((g) => {
          const R = k % 2 ? 9 : 12;
          g.ring(home.x, home.y, R, R * 0.5, k % 2 ? PAL.white : PAL.water4, 1, 0, TAU);
          g.ring(home.x, home.y, R + 5, (R + 5) * 0.5, PAL.water2, 0.5, 0, TAU);
        });
        return true;
      }
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
            // 2 px thick: a lower water3 copy under the bright core line
            g.line(x, y + 1, nx, ny + 1, PAL.water3);
            g.line(x, y, nx, ny, i === n || i === 1 ? PAL.water3 : (seed0 + i) % 3 ? PAL.water4 : PAL.white);
            x = nx;
            y = ny;
          }
        });
        return true;
      }
      // welded: the halves are one — the seam clears (the summon's finale ring rolls out from here, EF-7: one ring)
      air.draw(() => undefined);
      front.draw(() => undefined);
      f.draw(() => undefined);
      return false;
    },
    () => {
      f.destroy();
      air.destroy();
      front.destroy();
    },
  );
  return {
    weld() {
      weldAsk = true;
    },
    squeeze() {
      squeezeAsk = true;
    },
    destroy() {
      stop();
      f.destroy();
      air.destroy();
      front.destroy();
    },
  };
}

/** The flip: the anvil's blue field ring snaps on round the turning card (closing in, stepped) and a weld spark
 *  pops at the seam — no stone cracks (it is iron), no sound (the voice's KLAK scores the rise once). */
export function fieldSnap(sc: Phaser.Scene, home: XY, depth: number): void {
  const f = Raster.around(sc, home.x, home.y, 90, 46, FLOOR_DEPTH);
  void (async () => {
    const RS = [30, 24, 19, 16, 16];
    for (let s = 0; s < RS.length; s++) {
      if (!f.alive) return;
      const R = RS[s];
      f.draw((g) => {
        g.ring(home.x, home.y, R, R * 0.5, s === 3 ? PAL.white : s < 3 ? PAL.water3 : PAL.water4, 1, 0, TAU);
        if (s >= 2) g.ring(home.x, home.y, R + 5, (R + 5) * 0.5, PAL.water2, 0.5, 0, TAU);
        // the N half lights orange for a beat as the poles find each other
        if (s === 1 || s === 2) g.ring(home.x, home.y, R, R * 0.5, PAL.fire3, 1, Math.PI / 2, (3 * Math.PI) / 2);
      });
      await sleep(sc, s === 3 ? 70 : 45);
    }
    f.destroy();
  })();
  void lightFlash(sc, home.x, home.y - 8, PAL.water4, 26, 260, { floorY: home.y, intensity: 0.7 });
  sparkFountain(sc, { x: home.x + 1, y: home.y - 26 }, home.y, depth, 10);
}

/**
 * Position change: to guard the field ring draws IN round the base (three stepped rings closing, the S half
 * leading, a white tick where it locks onto the art's own ring) — to attack it lets go OUT (the ring steps wide,
 * the N half orange for a beat, gone). Floor only, nothing over the body.
 */
export function guardRing(sc: Phaser.Scene, home: XY, toGuard: boolean): void {
  const f = Raster.around(sc, home.x, home.y, 90, 46, FLOOR_DEPTH);
  void (async () => {
    const RS = toGuard ? [29, 25, 21, 18, 18] : [18, 22, 26, 30];
    for (let s = 0; s < RS.length; s++) {
      if (!f.alive) return;
      const R = RS[s];
      const last = s === RS.length - 1;
      f.draw((g) => {
        if (toGuard) {
          const c = last ? PAL.water4 : s === 3 ? PAL.white : s === 0 ? PAL.water2 : PAL.water3;
          // the S (front) half closes a step ahead of the N half
          g.ring(home.x, home.y, R, R * 0.5, c, 1, -Math.PI / 2, Math.PI / 2);
          g.ring(home.x, home.y, R + (last || s === 3 ? 0 : 2), (R + (last || s === 3 ? 0 : 2)) * 0.5, s === 0 ? PAL.water1 : PAL.water2, 1, Math.PI / 2, (3 * Math.PI) / 2);
          if (s >= 1 && !last) g.ring(home.x, home.y, R + 5, (R + 5) * 0.5, PAL.water1, 0.5, 0, TAU);
        } else {
          const c = [PAL.water4, PAL.water3, PAL.water2, PAL.water1][s];
          g.ring(home.x, home.y, R, R * 0.5, c, 1, -Math.PI / 2, Math.PI / 2);
          g.ring(home.x, home.y, R, R * 0.5, s === 1 ? PAL.fire3 : c, 1, Math.PI / 2, (3 * Math.PI) / 2);
        }
      });
      await sleep(sc, toGuard ? (s === 3 ? 60 : 40) : 45);
    }
    f.destroy();
  })();
  void lightFlash(sc, home.x, home.y - 6, PAL.water3, 22, 220, { floorY: home.y, intensity: toGuard ? 0.55 : 0.4 });
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
  // the field ring under the base flips its poles with the light: the N half and the S half trade colours,
  // tighter and faster each swap (the field losing its hold)
  const f = Raster.around(sc, home.x, home.y, 80, 40, FLOOR_DEPTH);
  let last = -1;
  onFrame(
    sc,
    (_dt, el) => {
      const step = Math.max(35, 60 - Math.floor(el / 40) * 4);
      const k = Math.floor(el / step);
      if (k !== last) {
        last = k;
        pool.setColor(k % 2 ? PAL.water3 : PAL.fire3);
        const a = k % 2 ? PAL.water3 : PAL.fire3;
        const b = k % 2 ? PAL.fire3 : PAL.water3;
        const R = 24 - (k % 3) * 2;
        f.draw((g) => {
          g.ring(home.x, home.y, R, R * 0.5, a, 1, -Math.PI / 2, Math.PI / 2);
          g.ring(home.x, home.y, R, R * 0.5, b, 1, Math.PI / 2, (3 * Math.PI) / 2);
          g.ring(home.x, home.y, R + 4, (R + 4) * 0.5, k % 2 ? PAL.water1 : PAL.fire1, 0.5, 0, TAU);
        });
      }
      return el < ms;
    },
    () => {
      f.destroy();
      void pool.fadeOut(120);
    },
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

/** Death burst: iron plates and gold weld beads skid out over the floor and come to rest there (whole px, stepped). */
export function ironPlates(sc: Phaser.Scene, home: XY, dir: 1 | -1, depth: number): void {
  const sp = new Sparks(sc, depth);
  // dark steel plates: thrown low and flat (the field shoves them), they skid and lie on the marble
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1;
    sp.add({ x: home.x + side * RR(4, 14), y: home.y - RR(2, 8), vx: side * RR(50, 110), vy: RR(-55, -25), ay: 520, drag: 2.6, life: RR(560, 640), colors: i % 3 === 0 ? [PAL.mist, PAL.steel, PAL.steel, PAL.night3] : [PAL.steel, PAL.stone2, PAL.stone2, PAL.night3], shape: 'sq', size: i % 3 === 0 ? 3 : 2, floor: home.y + RR(-4, 5), bounce: 0.15, fadeAt: 1 });
  }
  // gold weld beads: hot white → gold → cooling fire, they hop and settle
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? 1 : -1;
    sp.add({ x: home.x + RR(-8, 8), y: home.y - RR(4, 14), vx: side * RR(30, 80), vy: RR(-80, -40), ay: 560, drag: 1.8, life: RR(520, 620), colors: [PAL.white, PAL.gold4, PAL.gold3, PAL.fire2, PAL.fire1], shape: 'px', floor: home.y + RR(-3, 4), bounce: 0.3, fadeAt: 1 });
  }
  // the last pole sparks: orange off the heel side, blue off the horn side, blinking out
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? 1 : -1;
    sp.add({ x: home.x + side * RR(6, 16), y: home.y - RR(10, 24), vx: side * RR(20, 50), vy: RR(-50, -20), ay: 140, life: RR(240, 420), colors: side * dir > 0 ? [PAL.white, PAL.water4, PAL.water2] : [PAL.gold4, PAL.fire4, PAL.fire2], shape: 'px', fadeAt: 1, flicker: true });
  }
  sp.release();
}

/** The remains' frames: the death's last pose with the poles swapping as they die and the field's last kicks. */
const REMAINS: readonly { swap: number; pole: number; kick: number; zap: number; ms: number }[] = [
  { swap: 1, pole: 2, kick: 0, zap: 0.3, ms: 60 },
  { swap: 0, pole: 2, kick: 1, zap: 0, ms: 60 },
  { swap: 1, pole: 1.5, kick: 1, zap: 0.2, ms: 70 },
  { swap: 0, pole: 1.5, kick: 0, zap: 0, ms: 70 },
  { swap: 1, pole: 1.5, kick: 0, zap: 0, ms: 80 },
  { swap: 0, pole: 1, kick: 2, zap: 0.15, ms: 60 },
  { swap: 1, pole: 1, kick: 1, zap: 0, ms: 90 },
  { swap: 0, pole: 1, kick: 1, zap: 0, ms: 100 },
  { swap: 1, pole: 0.5, kick: 1, zap: 0, ms: 110 },
  { swap: 0, pole: 0.5, kick: 1, zap: 0, ms: 120 },
  { swap: 0, pole: 0, kick: 1, zap: 0, ms: 9999 },
];

function remainsKey(sc: Phaser.Scene, i: number, right: boolean): string {
  const key = `pa:remains:${right ? 'r' : 'l'}:${i}`;
  if (sc.textures.exists(key)) return key;
  const base = framePose('death', 8);
  const r = REMAINS[i];
  const p = new PixelCanvas(RIG_W, RIG_H);
  const o: Pose = { ...base, swap: r.swap, pole: r.pole, zap: r.zap, shards: 1 + r.kick * 0.1, t: (base.t + i * 0.13) % 1 };
  drawAnvil(p, o, right ? 'right' : 'left');
  sc.textures.addCanvas(key, p.toCanvas());
  return key;
}

/** Every ramp tone → one band darker (EF-7: the plates cool down their own ramp; below a ramp's floor → night). */
const COOLER = (() => {
  const m = new Map<number, number>();
  for (const r of Object.values(RAMPS)) for (let i = r.length - 1; i >= 0; i--) if (!m.has(r[i])) m.set(r[i], i > 0 ? r[i - 1] : PAL.night1);
  m.set(PAL.night1, PAL.night0);
  m.set(PAL.night0, PAL.ink);
  return m;
})();
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

/**
 * One step of a plate's break: remains frame `i` cooled `step` bands down its ramps, with a quarter of its
 * pixels per step dropped in Bayer order (iron flaking off, never a flat silhouette fill).
 */
function breakKey(sc: Phaser.Scene, i: number, right: boolean, step: number): string {
  const key = `pa:remains:${right ? 'r' : 'l'}:${i}:brk${step}`;
  if (sc.textures.exists(key)) return key;
  const base = framePose('death', 8);
  const r = REMAINS[i];
  const p = new PixelCanvas(RIG_W, RIG_H);
  const o: Pose = { ...base, swap: r.swap, pole: r.pole, zap: r.zap, shards: 1 + r.kick * 0.1, t: (base.t + i * 0.13) % 1 };
  drawAnvil(p, o, right ? 'right' : 'left');
  p.map((c, x, y) => {
    if (BAYER4[(y & 3) * 4 + (x & 3)] < step * 4) return null;
    let k = c;
    for (let n = 0; n < step; n++) k = COOLER.get(k) ?? k;
    return k;
  });
  sc.textures.addCanvas(key, p.toCanvas());
  return key;
}

/**
 * The death's last beat (§5.2 C13 "kutup titreşimi, parçalar dışa iter"): the body's final frame — the two
 * half-anvils apart with the arms lying by them — is taken over as remains on the floor; the poles keep
 * swapping orange / blue as they die, the halves twitch apart twice (the field's last kicks) and creep 1 px
 * apart, and the last 220 ms break the two plates up one after the other (slide out, cool down their ramps, flake off in a dither, gone). Call with the sprite still showing its last frame; the
 * caller hides the sprite right after. `heel` / `horn`: world points of the two pole glyphs on that frame.
 */
export function anvilRemains(sc: Phaser.Scene, spr: Phaser.GameObjects.Sprite, home: XY, heel: XY, horn: XY, ms = 560): void {
  const right = spr.texture.key.includes(':p2');
  // two plates, cut at the seam between the poles: each creeps, slides and steps out on its own
  const img = sc.add.image(spr.x, spr.y, spr.texture.key, spr.frame.name).setOrigin(spr.originX, spr.originY).setFlipX(spr.flipX).setDepth(spr.depth);
  const img2 = sc.add.image(spr.x, spr.y, spr.texture.key, spr.frame.name).setOrigin(spr.originX, spr.originY).setFlipX(spr.flipX).setDepth(spr.depth);
  const fw = img.frame.width;
  const left = spr.x - spr.originX * fw;
  const mx = (heel.x + horn.x) / 2;
  const seamTex = Math.max(1, Math.min(fw - 1, Math.round(spr.flipX ? left + fw - mx : mx - left)));
  const cropAll = () => {
    img.setCrop(0, 0, seamTex, img.frame.height);
    img2.setCrop(seamTex, 0, fw - seamTex, img2.frame.height);
  };
  cropAll();
  // world side of each plate: the texture's left part lies left of the seam unless flipped
  const sideA = spr.flipX ? 1 : -1;
  const plates = [
    { im: img, side: sideA, x0: spr.x },
    { im: img2, side: -sideA, x0: spr.x },
  ];
  /** One plate's break: 4 steps of BREAK_STEP ms (slide 1; then cooled 1 / 2 / 3 bands, 25 / 50 / 75 % flaked off), gone. */
  const BREAK_STEP = 35;
  const plateStep = [-1, -1];
  const glow = Raster.around(sc, home.x, home.y - 20, 120, 70, spr.depth + 0.2);
  const floor = Raster.around(sc, home.x, home.y, 100, 40, FLOOR_DEPTH);
  const pool = lightPool(sc, home.x, home.y, { color: PAL.water3, radius: 22, intensity: 0.7, fadeIn: 0 });
  const BREAK = 220;
  let shown = -1;
  let last = -1;
  onFrame(
    sc,
    (_dt, el) => {
      if (!img.active) return false;
      // the remains' frame for this moment
      let acc = 0;
      let fi = REMAINS.length - 1;
      for (let i = 0; i < REMAINS.length; i++) {
        acc += REMAINS[i].ms;
        if (el < acc) {
          fi = i;
          break;
        }
      }
      if (fi !== shown) {
        shown = fi;
        for (let pi = 0; pi < plates.length; pi++) {
          const st = plateStep[pi];
          plates[pi].im.setTexture(st >= 1 ? breakKey(sc, fi, right, st) : remainsKey(sc, fi, right)).setOrigin(spr.originX, spr.originY);
        }
        cropAll();
        const r = REMAINS[fi];
        const lv = r.pole >= 2 ? 0 : r.pole >= 1 ? 1 : 2;
        const O = [PAL.fire4, PAL.fire3, PAL.fire1][lv];
        const B = [PAL.water4, PAL.water3, PAL.water1][lv];
        const a = r.swap ? B : O;
        const b = r.swap ? O : B;
        pool.setColor(r.swap ? PAL.water3 : PAL.fire3);
        pool.setIntensity(r.pole > 0 ? 0.25 + r.pole * 0.25 : 0.12, 0);
        // a field crackle jumping the gap between the halves on a kick: two bracket ticks ")(" (like poles)
        glow.draw((g) => {
          if (!r.kick || lv === 2) return;
          const mx = Math.round((heel.x + horn.x) / 2);
          const my = home.y - 8;
          for (let yy = -4; yy <= 4; yy++) {
            const bow = Math.abs(yy) > 2 ? 0 : 1;
            g.px(mx - 3 - bow, my + yy, a);
            g.px(mx + 3 + bow, my + yy, b);
          }
        });
        floor.draw((g) => {
          if (lv === 2) return;
          // the field ring under the pieces: two half arcs swapping poles, shrinking as it dies
          const R = 26 - lv * 4 - (fi % 2);
          g.ring(home.x, home.y, R, R * 0.5, a, lv === 0 ? 1 : 0.5, -Math.PI / 2, Math.PI / 2);
          g.ring(home.x, home.y, R, R * 0.5, b, lv === 0 ? 1 : 0.5, Math.PI / 2, (3 * Math.PI) / 2);
        });
      }
      // the hold: the halves creep apart 1 px per 150 ms (the dying field still repels them; at most 2 px)
      const hold = ms - BREAK;
      const creep = Math.min(2, Math.floor(Math.max(0, el - 120) / 150));
      // the last 220 ms break the remains up plate by plate (the far plate 2 steps late): each slides 1 → 2 px
      // further out while it cools down its own ramp and flakes off in a Bayer dither, then is gone
      for (let pi = 0; pi < plates.length; pi++) {
        const pl = plates[pi];
        const k = el >= hold ? Math.floor((el - hold) / BREAK_STEP) - pi * 2 : -1;
        const slide = k < 0 ? 0 : Math.min(2, k + 1);
        pl.im.setX(pl.x0 + pl.side * (creep + slide));
        if (k >= 4) {
          pl.im.setVisible(false);
          continue;
        }
        const st = Math.max(0, k);
        if (st !== plateStep[pi] && st >= 1) {
          plateStep[pi] = st;
          pl.im.setTexture(breakKey(sc, shown, right, st)).setOrigin(spr.originX, spr.originY);
          cropAll();
        }
      }
      if (el >= hold) {
        const k = Math.floor((el - hold) / 50);
        if (k !== last) {
          last = k;
          if (k >= 1) {
            glow.draw(() => undefined);
            floor.draw(() => undefined);
          }
        }
      }
      return el < ms;
    },
    () => {
      if (img.active) img.destroy();
      if (img2.active) img2.destroy();
      glow.destroy();
      floor.destroy();
      void pool.fadeOut(80);
    },
  );
}
