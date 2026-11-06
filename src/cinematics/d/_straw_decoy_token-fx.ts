// Saman Korkuluk (straw_decoy_token) — the token's own effect pieces (?look=v3 only; registers nothing: the `_` file
// is loaded by the cinematics glob but has no side effects). Used by ./straw_decoy_token.ts.
//
//   seedFx(n)                            deterministic randomness (films repeat)
//   strawPoint(u, which, at?)            a point of the scarecrow's skeleton on the frame on screen (world px)
//   fallShadow(sc, home, ms, depth)      the stake drops out of the sky: a falling 1-px streak + its shadow growing on
//                                        the tile until it plants
//   plantBurst(sc, home, dir)            the point bites the floor: dirt clods, straw chaff, one flat dirt ring, a dull
//                                        warm floor flash
//   windWrap(sc, u, home, dir, ms)       straw stalks blow in from upwind on a curling path and wrap the stake
//   eyeGlint(sc, u)                      the button eyes light once: their warm light on the face and the floor
//   crowOff(sc, from, dir, depth)        a crow lifts off a shoulder and flies away up out of the frame, flapping
//   Litter                               straw stalks that fall, lie on the floor, and are blown away by the wind
//   chaffBurst(sc, at, dir, floorY, n)   a straw slap / blow: chaff flies along the blow and settles as litter
//   stakeDust(sc, a, b, floorY)          the toppled stake hits the floor: dust along its length
//
// Pixel language (REHBER EF-6 / EF-7): 1-px lines, palette steps instead of alpha where possible, whole-pixel
// positions, at most one ring per beat, stepped light on the floor, no sprite scale / rotation, camera untouched.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { AnyMonsterAnim } from '../../art/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, type XY } from '../../view/layout';
import { lightFlash } from '../../view/light';
import { Raster } from '../../vfx/setpieces';
import { Sparks, onFrame } from '../../vfx/combat';
import { framePose } from '../../art/monsters-v3/straw_decoy_token-anims';
import { skeleton } from '../../art/monsters-v3/straw_decoy_token-rig';
import { drawCrow } from '../../art/monsters-v3/straw_decoy_token-kit';

export const TAU = Math.PI * 2;
/** Floor marks just above the cards on the tiles. */
export const FLOOR_DEPTH = DEPTH.CARD_ON_TILE + 2;
/** Straw: shade → light. */
export const STRAW = [PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4] as const;
const DIRT = [PAL.earth1, PAL.earth2, PAL.earth3] as const;

let seedV = 1;
export function seedFx(n: number): void {
  seedV = (Math.abs(Math.floor(n)) % 2147483646) + 1;
}
function rnd(): number {
  seedV = (seedV * 16807) % 2147483647;
  return (seedV - 1) / 2147483646;
}
const RR = (a: number, b: number): number => a + (b - a) * rnd();
const R = Math.round;

// ================================================================ points

export type StrawPointName = 'foot' | 'core' | 'head' | 'barL' | 'barR' | 'tipR' | 'cuffR' | 'cuffL';

/** A point of the scarecrow's skeleton on the frame on screen (or `at`), in world px (null: gone / other art). */
export function strawPoint(u: MonsterUnit, which: StrawPointName, at?: { anim: AnyMonsterAnim; frame: number }): XY | null {
  if (!u.sprite.active || u.cardId !== 'straw_decoy_token') return null;
  const fi = at ?? { anim: u.frameInfo().anim ?? 'idle', frame: u.frameInfo().frame };
  const sk = skeleton(framePose(fi.anim, fi.frame));
  const p = sk[which] as readonly [number, number];
  const w = u.framePoint(p[0], p[1]);
  return { x: R(w.x), y: R(w.y) };
}

// ================================================================ summon

/**
 * The stake drops out of the sky onto the tile: a falling 1-px streak (a gold glint at its head) above the tile
 * and its shadow on the floor growing from a dot to the stake's footprint. Resolves when it reaches the floor.
 */
export function fallShadow(sc: Phaser.Scene, home: XY, ms: number, depth: number): Promise<void> {
  const r = Raster.around(sc, home.x, home.y - 60, 24, 124, depth);
  const sh = Raster.around(sc, home.x, home.y, 20, 8, FLOOR_DEPTH);
  return new Promise<void>((resolve) => {
    onFrame(
      sc,
      (_dt, el) => {
        const t = Math.min(1, el / ms);
        const e = t * t;
        const topY = home.y - 120 + e * 96; // the stake's head comes down to ≈ 24 px over the floor
        r.draw((q) => {
          // the stake falling: a 2-px pole whose head carries a glint; above it the streak thins out
          const y0 = R(topY);
          for (let y = y0 - 18; y < y0 + 14; y++) {
            const k = (y - (y0 - 18)) / 18;
            if (y < y0) q.dpx(home.x, y, PAL.gold2, Math.max(0, k * 0.8));
            else {
              q.px(home.x - 1, y, PAL.earth2);
              q.px(home.x, y, PAL.earth3);
            }
          }
          q.px(home.x, y0, PAL.gold4);
        });
        sh.draw((q) => {
          // the shadow: a dithered ellipse, wider and darker as the stake comes down
          const rx = 1 + R(e * 6);
          const lvl = 0.25 + 0.6 * e;
          for (let x = -rx; x <= rx; x++) for (let y = -1; y <= 1; y++) if ((x * x) / (rx * rx + 0.5) + y * y * 0.6 <= 1) q.dpx(home.x + x, home.y + y, PAL.night0, lvl);
        });
        return t < 1;
      },
      () => {
        r.destroy();
        sh.destroy();
        resolve();
      },
    );
  });
}

/** The point bites the floor: dirt clods and straw chaff jump, one flat dirt ring opens, a dull warm floor flash. */
export function plantBurst(sc: Phaser.Scene, home: XY, dir: 1 | -1): void {
  const sp = new Sparks(sc, DEPTH.FX - 1);
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1;
    sp.add({ x: home.x + side * RR(0, 3), y: home.y - 1, vx: side * RR(18, 55), vy: RR(-70, -30), ay: 360, drag: 1.2, life: RR(300, 480), colors: DIRT, shape: 'px', floor: home.y + RR(-2, 3), bounce: 0.2, fadeAt: 0.8 });
  }
  for (let i = 0; i < 6; i++) {
    sp.add({ x: home.x + RR(-2, 2), y: home.y - 4, vx: dir * RR(-20, 40), vy: RR(-60, -30), ay: 200, drag: 2, life: RR(400, 600), colors: [PAL.gold4, PAL.gold3, PAL.gold2], shape: 'streak', len: 0.02, fadeAt: 0.7 });
  }
  sp.release();
  // the dirt ring: one flat iso ring that steps outward three times and fades in dither steps
  const ring = Raster.around(sc, home.x, home.y, 40, 14, FLOOR_DEPTH);
  onFrame(
    sc,
    (_dt, el) => {
      const k = Math.min(3, Math.floor(el / 60));
      const rx = 6 + k * 5;
      const lvl = [0.9, 0.7, 0.45, 0.2][k];
      ring.draw((q) => {
        for (let a = 0; a < TAU; a += 0.06) q.dpx(R(home.x + Math.cos(a) * rx), R(home.y + Math.sin(a) * rx * 0.36), k < 2 ? PAL.earth3 : PAL.earth2, lvl);
      });
      return el < 240;
    },
    () => ring.destroy(),
  );
  void lightFlash(sc, home.x, home.y - 2, PAL.gold3, 16, 200, { floorY: home.y, intensity: 0.55 });
}

/**
 * Straw stalks blow in from upwind (the side behind the scarecrow) on curling paths and wrap round the stake,
 * arriving from the foot upward over `ms` (the wrap frames).
 */
export function windWrap(sc: Phaser.Scene, u: MonsterUnit, home: XY, dir: 1 | -1, ms: number): void {
  const sp = new Sparks(sc, u.sprite.depth + 0.4);
  const n = 14;
  for (let i = 0; i < n; i++) {
    const k = i / n;
    const ty = home.y - 8 - k * 26;
    const sx = home.x - dir * RR(16, 30);
    const sy = ty - RR(-8, 12);
    sp.add({
      x: sx,
      y: sy,
      tx: home.x + RR(-2, 2),
      ty,
      curl: dir * RR(5, 10) * (i % 2 ? 1 : -1),
      life: RR(180, 260),
      delay: k * ms * 0.8,
      colors: i % 3 === 0 ? [PAL.gold4, PAL.gold3] : [PAL.gold3, PAL.gold2],
      shape: 'streak',
      len: 0.03,
      fadeAt: 0.92,
    });
  }
  sp.release();
}

/**
 * The button eyes light once: the buttons themselves glow on the sprite (rig `eye` 3 → 2, a 1-px warm halo); here
 * only their warm light spills on the floor and the face (no sparks: never a white bar across the face).
 */
export function eyeGlint(sc: Phaser.Scene, u: MonsterUnit): void {
  const h = strawPoint(u, 'head');
  if (!h) return;
  void lightFlash(sc, h.x + (u.flipX ? -2 : 2), h.y - 1, PAL.gold4, 12, 240, { floorY: u.home.y, intensity: 0.5 });
}

/**
 * A crow lifts off (from a shoulder or a stake's head) and flies away up and out of the frame — the far "gak" of
 * the summon's last beat. Flaps every 70 ms, rises along a shallow curve, ends as the small far "v".
 */
export function crowOff(sc: Phaser.Scene, from: XY, dir: 1 | -1, depth: number, ms = 900): Promise<void> {
  const r = new Raster(sc, from.x - 140, from.y - 160, 280, 180, depth);
  return new Promise<void>((resolve) => {
    onFrame(
      sc,
      (_dt, el) => {
        const t = Math.min(1, el / ms);
        const x = from.x + dir * (t * 110 + t * t * 20);
        const y = from.y - (t * 60 + t * t * 80);
        const flap = Math.floor(el / 70) % 3;
        r.draw((q) => {
          const lx = R(x) - q.x;
          const ly = R(y) - q.y;
          if (t < 0.55) drawCrow(q.pc, lx, ly, 'fly', flap, dir, dir);
          else drawCrow(q.pc, lx, ly, 'far', flap % 2, dir, dir);
        });
        return t < 1;
      },
      () => {
        r.destroy();
        resolve();
      },
    );
  });
}

// ================================================================ straw litter

interface Stalk {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** the stalk's direction (dx, dy of its far end) */
  dx: number;
  dy: number;
  c: number;
  floor: number;
  lying: boolean;
  /** ms before it shows */
  delay: number;
  /** blown off: this stalk's own gust delay */
  gust: number;
}

/**
 * Straw stalks (2–4 px strands) that fly, fall, LIE on the floor (a little heap) and are later blown away by the
 * wind in dither steps. One raster round `home`.
 */
export class Litter {
  private readonly r: Raster;
  private readonly list: Stalk[] = [];
  private wind = -1;
  private windDir: 1 | -1 = 1;
  private stop: () => void;
  private done = false;
  private resolveEnd: (() => void) | null = null;

  constructor(
    private readonly sc: Phaser.Scene,
    private readonly home: XY,
    depth: number,
  ) {
    this.r = new Raster(sc, home.x - 90, home.y - 90, 180, 110, depth);
    this.stop = onFrame(sc, (dt) => this.tick(dt), () => this.r.destroy());
  }

  /** Throw `n` stalks from `at` with a velocity around (vx, vy) (spread), landing near floorY. */
  throw(at: XY, n: number, o: { vx: number; vy: number; spread?: number; floorY?: number; delay?: number; floorJitter?: number }): void {
    const sp = o.spread ?? 30;
    for (let i = 0; i < n; i++) {
      const len = 3 + Math.floor(rnd() * 3);
      const a = rnd() * Math.PI;
      this.list.push({
        x: at.x + RR(-3, 3),
        y: at.y + RR(-3, 3),
        vx: o.vx + RR(-sp, sp),
        vy: o.vy + RR(-sp, sp * 0.4),
        dx: Math.cos(a) * len,
        dy: Math.sin(a) * len * 0.5,
        c: STRAW[1 + Math.floor(rnd() * 3)],
        floor: (o.floorY ?? this.home.y) + RR(-(o.floorJitter ?? 5), o.floorJitter ?? 5),
        lying: false,
        delay: (o.delay ?? 0) + RR(0, 60),
        gust: RR(0, 160),
      });
    }
  }

  /** The wind takes them: every stalk lifts and is blown along `dir`, thinning out; resolves when all are gone. */
  get blowing(): boolean {
    return this.wind >= 0;
  }

  blowAway(dir: 1 | -1): Promise<void> {
    this.windDir = dir;
    this.wind = 0;
    return new Promise<void>((r) => (this.resolveEnd = r));
  }

  destroy(): void {
    if (this.done) return;
    this.done = true;
    this.stop();
    this.r.destroy();
    this.resolveEnd?.();
  }

  private tick(dt: number): boolean {
    const s = dt / 1000;
    if (this.wind >= 0) this.wind += dt;
    let alive = 0;
    this.r.begin();
    for (const p of this.list) {
      if (p.delay > 0) {
        p.delay -= dt;
        alive++;
        continue;
      }
      let lvl = 1;
      if (this.wind >= 0) {
        const w = this.wind - p.gust;
        if (w > 0) {
          // lifted and carried: a gust along the floor that also rolls the stalk
          p.lying = false;
          p.vx += this.windDir * 260 * s;
          p.vy = Math.min(p.vy, -6) - 10 * s;
          p.vx *= Math.exp(-0.6 * s);
          lvl = Math.max(0, 1 - w / 420);
          if (Math.floor(w / 50) % 2) {
            const t = p.dx;
            p.dx = -p.dy * 2;
            p.dy = t * 0.5;
          }
        }
      }
      if (!p.lying) {
        p.vy += (this.wind >= 0 ? 0 : 340) * s;
        p.vx *= Math.exp(-1.6 * s);
        p.x += p.vx * s;
        p.y += p.vy * s;
        if (this.wind < 0 && p.y >= p.floor && p.vy > 0) {
          p.y = p.floor;
          if (p.vy > 60) p.vy = -p.vy * 0.2;
          else {
            p.lying = true;
            p.vx = 0;
            p.vy = 0;
            // lying flat: the stalk turns to the floor's plane
            p.dy = Math.sign(p.dy || 1) * Math.min(1, Math.abs(p.dy));
          }
        }
      }
      if (lvl <= 0) continue;
      alive++;
      const x0 = R(p.x);
      const y0 = R(p.y);
      this.r.line(x0, y0, R(p.x + p.dx), R(p.y + p.dy), p.c, lvl);
      if (p.lying) this.r.dpx(x0, y0 + 1, PAL.gold1, lvl * 0.6);
    }
    this.r.end();
    if (this.wind >= 0 && alive === 0) {
      this.resolveEnd?.();
      this.resolveEnd = null;
      this.done = true;
      return false;
    }
    return !this.done;
  }
}

/** A straw blow: chaff flies along `dir` from `at` (streaks) and a few stalks settle on the floor as litter. */
export function chaffBurst(sc: Phaser.Scene, at: XY, dir: XY, floorY: number, n: number, depth: number = DEPTH.FX): void {
  const sp = new Sparks(sc, depth);
  for (let i = 0; i < n; i++) {
    const sv = RR(40, 120);
    sp.add({
      x: at.x + RR(-2, 2),
      y: at.y + RR(-3, 3),
      vx: dir.x * sv + RR(-40, 40),
      vy: dir.y * sv + RR(-70, -10),
      ay: 260,
      drag: 2.2,
      life: RR(380, 640),
      colors: [PAL.gold4, PAL.gold3, PAL.gold2],
      shape: i % 4 === 0 ? 'px' : 'streak',
      len: 0.025,
      floor: floorY + RR(-3, 3),
      bounce: 0.15,
      fadeAt: 0.75,
    });
  }
  sp.release();
}

/** The toppled stake hits the floor: a line of dust puffs along its length and some grit. */
export function stakeDust(sc: Phaser.Scene, a: XY, b: XY, floorY: number): void {
  const sp = new Sparks(sc, DEPTH.FX - 1);
  for (let i = 0; i < 12; i++) {
    const k = i / 11;
    const x = a.x + (b.x - a.x) * k;
    const side = i % 2 ? 1 : -1;
    sp.add({ x: x + RR(-2, 2), y: floorY - RR(0, 2), vx: side * RR(8, 30), vy: RR(-26, -8), drag: 3, life: RR(280, 480), colors: i % 3 ? [PAL.earth3, PAL.earth2] : [PAL.mist, PAL.stone3], shape: 'px', fadeAt: 0.6 });
  }
  sp.release();
  void lightFlash(sc, R((a.x + b.x) / 2), floorY - 1, PAL.gold2, 18, 160, { floorY, intensity: 0.35 });
}
