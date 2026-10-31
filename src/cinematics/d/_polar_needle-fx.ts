// Kutup İğnesi (polar_needle) — the card's own effect pieces (?look=v3 only; registers nothing: the `_` file is
// loaded by the cinematics glob but has no side effects). Used by ./polar_needle.ts; written so the Kutup
// Hükümdarı (polar_sovereign) can reuse the needle's pieces for its arms + compass spear (its attack "Pusula
// Fırtınası" locks a compass rose round the target — `compassDial`, `brackets`, `lockBeam` are that language):
//
//   needlePoint(u, 'spear' | 'n' | 's' | 'pivot')  points of the needle's skeleton on the frame on screen
//   dropStreak(sc, home, ms, depth)        summon: the needle falls point-first out of the sky (a two-colour streak)
//   compassDial(sc, u, home, dir, foe)     summon: a compass dial etched in iron dust on the floor; its needle
//                                          shadow follows the spinning spear, the passing tick lights up;
//                                          lock() points it at the opponent, fade() lets the dust go
//   lockBeam(sc, home, foe, depth)         summon lock: a stepped bearing line shoots out along the floor to the foe
//   bearingLine(sc, from, to)              strike aim: dotted bearing steps out over the floor toward the target
//   brackets(sc, o)                        "Kıskaç": the orange "(" and blue ")" field brackets either side of the
//                                          target; appear() → clamp() (the lock) → shatter() | bounce()
//   lungeTrail(sc, from, to, depth)        the lunge's two-colour track (stepped fade)
//   pierceFlash(sc, at, dir, depth)        contact: the needle's line of light through the target, a star, sparks
//   forceGrip(sc, u, home, ms)             death f1: the invisible force — iron dust is sucked up to a point above
//                                          the head and the field lines bend up toward it
//   ripBurst(sc, at, floorY)               death f2: the needle tears out of the shell (steel / gold shards)
//   flyingNeedle(sc, o)                    death: the torn needle spins madly up and off the screen (pixel frames)
//   shellPlates(sc, home, dir, depth)      death burst: magnetite plates drop and clack on the marble
//
// Pixel language (REHBER EF-6 / EF-7): 1-px lines, palette steps instead of alpha, whole-pixel positions, no
// sprite rotation or scale (the flying needle is drawn per angle), stepped light on the floor.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { lightOf } from '../../art/rigkit';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, type XY } from '../../view/layout';
import { lightFlash, lightPool } from '../../view/light';
import { Raster } from '../../vfx/setpieces';
import { Sparks, animate, onFrame, sleep } from '../../vfx/combat';
import { framePose } from '../../art/monsters-v3/polar_needle-anims';
import { TORSO_N, TORSO_S, skeleton } from '../../art/monsters-v3/polar_needle-rig';
import { needle } from '../../art/monsters-v3/polar_needle-kit';

export const TAU = Math.PI * 2;
/** Floor marks just above the cards on the tiles. */
export const FLOOR_DEPTH = DEPTH.CARD_ON_TILE + 2;
const FIRE = [PAL.white, PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1] as const;
const WATER = [PAL.white, PAL.water4, PAL.water3, PAL.water2, PAL.water1] as const;
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

// ================================================================ the needle's points

/** A point of the needle's skeleton on the frame on screen, in world px (null: gone / another art). */
export function needlePoint(u: MonsterUnit, which: 'spear' | 'n' | 's' | 'pivot' | 'head', anim?: Parameters<typeof framePose>[0], frame?: number): XY | null {
  if (!u.sprite.active || u.cardId !== 'polar_needle') return null;
  const fi = u.frameInfo();
  const sk = skeleton(framePose(anim ?? fi.anim ?? 'idle', frame ?? fi.frame));
  const p = which === 'spear' ? sk.spt : which === 'n' ? sk.ntip : which === 's' ? sk.stip : which === 'head' ? sk.head : sk.nc;
  return rx(u.framePoint(Math.floor(p[0]) + 0.5, Math.floor(p[1]) + 0.5));
}

/** The world offset of a frame point of `anim` f from the unit's feet (facing aware). */
export function needleOffset(u: MonsterUnit, which: 'spear' | 'pivot', anim: Parameters<typeof framePose>[0], frame: number): XY {
  const sk = skeleton(framePose(anim, frame));
  const p = which === 'spear' ? sk.spt : sk.nc;
  const sgn = u.flipX ? -1 : 1;
  return { x: Math.round(sgn * (p[0] - u.art.anchorX)), y: Math.round(p[1] - u.art.anchorY) };
}

// ================================================================ summon

/** The needle falls point-first out of the sky: a white head with an orange (N, upper) / blue (S) wake. */
export function dropStreak(sc: Phaser.Scene, home: XY, ms: number, depth: number): Promise<void> {
  const top = Math.max(-10, home.y - 150);
  const bot = home.y - 64;
  const r = new Raster(sc, home.x - 6, top - 50, 12, bot - top + 60, depth);
  return animate(sc, ms, (t) => {
    const e = t * t;
    const head = Math.round(top + (bot - top) * e);
    const len = Math.round(18 + 30 * e);
    r.draw((g) => {
      for (let i = 0; i < len; i++) {
        const y = head - i;
        const k = i / len;
        g.px(home.x, y, i < 2 ? PAL.white : k < 0.45 ? PAL.water4 : PAL.water2);
        if (i > 3 && k < 0.85) g.dpx(home.x - 1, y - 3, k < 0.5 ? PAL.fire4 : PAL.fire2, 1 - k);
        if (i > 6 && k < 0.7) g.dpx(home.x + 1, y - 6, PAL.water3, 0.75 - k);
      }
    });
  }).then(() => r.destroy());
}

export interface Dial {
  /** The needle locked: its shadow points at the foe, the foe's tick flashes, the dial ring pulses once. */
  lock(): void;
  /** The dust lets go (stepped fade), then the dial is gone. */
  fade(ms?: number): Promise<void>;
  destroy(): void;
}

/**
 * The summon floor: a compass dial etched in iron dust round the tile (an iso ring with 16 ticks; the
 * opponent's cardinal tick in fire, the own side's in water, the others gold). The dust streams in first; while
 * the needle spins on its tip, a needle-shadow on the floor follows the spear's yaw (fire point, water butt) and
 * the tick under it lights up.
 */
export function compassDial(sc: Phaser.Scene, u: MonsterUnit, home: XY, dir: 1 | -1, foe: XY): Dial {
  const R = 26;
  // the dial is turned so its fire cardinal lies on the bearing to the opponent's tile (iso plane angle)
  const aF = Math.atan2((foe.y - home.y) * 2, foe.x - home.x);
  const r = Raster.around(sc, home.x, home.y, 2 * R + 16, R + 16, FLOOR_DEPTH);
  const dust = new Sparks(sc, FLOOR_DEPTH + 0.5);
  const TICKS = 16;
  // the dust gathers onto the ring
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU;
    const tx = home.x + Math.cos(a) * R;
    const ty = home.y + Math.sin(a) * R * 0.5;
    const ra = a + RR(-0.4, 0.4);
    const d = RR(14, 26);
    dust.add({ x: tx + Math.cos(ra) * d, y: ty + Math.sin(ra) * d * 0.5, tx, ty, life: RR(180, 300), delay: RR(0, 120), colors: DUST, shape: 'px', fadeAt: 1 });
  }
  dust.release();
  let lockedAt = -1;
  let fadeK = 0;
  let elNow = 0;
  let dead = false;
  let lastYaw = 0;
  const tickAngle = (i: number): number => aF + (i / TICKS) * TAU;
  const stop = onFrame(
    sc,
    (_dt, el) => {
      elNow = el;
      if (dead) return false;
      const drawn = Math.min(1, el / 260);
      const fi = u.sprite.active ? u.frameInfo() : { anim: null, frame: 0 };
      const P = fi.anim === 'summon' ? framePose('summon', fi.frame) : null;
      const yaw = P && P.spin > 0 ? P.yaw : lockedAt >= 0 ? 720 : lastYaw;
      lastYaw = yaw;
      // screen angle of the spear on the floor: yaw 0 = toward the foe (dir), iso squashed
      const ya = (yaw * Math.PI) / 180;
      const vx = Math.cos(ya) * dir;
      const vy = Math.sin(ya) * 0.5;
      const lv = 1 - fadeK;
      r.draw((g) => {
        if (lv <= 0) return;
        // the ring itself: dotted iron dust, drawn round in the gather order
        const n = Math.round(96 * drawn);
        for (let s = 0; s < n; s++) {
          const a = aF + Math.PI + (s / 96) * TAU;
          g.dpx(home.x + Math.cos(a) * R, home.y + Math.sin(a) * R * 0.5, s % 8 === 0 ? PAL.mist : s % 2 ? PAL.stone3 : PAL.steel, lv);
          if (s % 3 === 0) g.dpx(home.x + Math.cos(a) * (R - 4), home.y + Math.sin(a) * (R - 4) * 0.5, PAL.stone2, lv * 0.7);
        }
        if (drawn < 1) return;
        // the ticks: the cardinal ones 3 px radial, the others a dot; the one under the needle shadow lights
        for (let i = 0; i < TICKS; i++) {
          const a = tickAngle(i);
          const cx = Math.cos(a);
          const cy = Math.sin(a);
          const card = i % 4 === 0;
          // the fire cardinal faces the foe, the water one the own side
          const foe = i === 0;
          const own = i === TICKS / 2;
          const under = vx * cx + vy * 2 * cy > 0.96;
          const flash = lockedAt >= 0 && foe && elNow - lockedAt < 120;
          let c: number = card ? PAL.gold4 : PAL.steel;
          if (foe) c = PAL.fire3;
          if (own) c = PAL.water3;
          if (under) c = foe ? PAL.fire4 : own ? PAL.water4 : PAL.gold4;
          if (flash) c = PAL.white;
          const L = card ? 3 : 1;
          for (let k = 0; k < L; k++) g.dpx(home.x + cx * (R - 1 - k), home.y + cy * (R - 1 - k) * 0.5, c, lv);
          if (card && (under || flash)) g.dpx(home.x + cx * (R + 1), home.y + cy * (R + 1) * 0.5, c, lv);
        }
        // the needle shadow on the floor (fire point toward the yaw, water butt behind), only while it lives
        if (fadeK < 0.5) {
          for (let k = -18; k <= 21; k++) {
            if (Math.abs(k) < 2) continue;
            const x = home.x + vx * k;
            const y = home.y + vy * k;
            g.dpx(x, y, k > 0 ? (k > 14 ? PAL.fire4 : PAL.fire3) : k < -12 ? PAL.water4 : PAL.water3, lv);
            // a 1-px darker under-edge so the shadow reads on the lit marble
            if (Math.abs(k) > 4) g.dpx(x, y + 1, k > 0 ? PAL.fire1 : PAL.water1, lv * 0.75);
          }
          g.px(home.x, home.y, PAL.gold4);
        }
        // the lock: the ring pulses out one step in gold
        if (lockedAt >= 0) {
          const t = elNow - lockedAt;
          if (t < 200) {
            const rr = R + 3 + Math.floor(t / 70) * 3;
            g.ring(home.x, home.y, rr, rr * 0.5, t < 70 ? PAL.gold4 : PAL.gold2, t < 140 ? 1 : 0.5, 0, TAU);
          }
        }
      });
      return true;
    },
    () => r.destroy(),
  );
  return {
    lock() {
      lockedAt = elNow;
    },
    fade(ms = 320) {
      return animate(sc, ms, (t) => {
        fadeK = Math.min(1, Math.floor(t * 4) / 3);
      }).then(() => {
        dead = true;
        stop();
        r.destroy();
      });
    },
    destroy() {
      dead = true;
      stop();
      r.destroy();
    },
  };
}

/** The lock: a stepped bearing line shoots out over the floor from the tile toward the foe, then fades in steps. */
export function lockBeam(sc: Phaser.Scene, home: XY, foe: XY, depth = FLOOR_DEPTH): Promise<void> {
  const fd = { x: foe.x - home.x, y: foe.y - home.y };
  const fl = Math.hypot(fd.x, fd.y) || 1;
  const ux = fd.x / fl;
  const uy = fd.y / fl;
  const L = Math.round(Math.min(fl * 0.62, 90));
  const r = Raster.around(sc, home.x, home.y, 2 * L + 24, 2 * L + 24, depth);
  return animate(sc, 520, (t, el) => {
    const reach = Math.min(L, Math.round((el / 110) * L));
    const lv = el < 260 ? 1 : el < 360 ? 0.66 : el < 450 ? 0.33 : 0.15;
    r.draw((g) => {
      for (let k = 30; k <= reach; k++) {
        if (k % 3 === 2) continue;
        const near = reach - k < 6;
        g.dpx(home.x + ux * k, home.y + uy * k, near && el < 200 ? PAL.white : k % 3 === 0 ? PAL.fire4 : PAL.fire2, lv);
      }
      // the arrowhead chevron at the front (two 3-px barbs back along the bearing)
      if (reach >= 32) {
        const x = home.x + ux * reach;
        const y = home.y + uy * reach;
        for (let i = 1; i <= 3; i++) {
          g.dpx(x - ux * i - uy * i * 1.4, y - uy * i + ux * i * 0.7, PAL.fire3, lv);
          g.dpx(x - ux * i + uy * i * 1.4, y - uy * i - ux * i * 0.7, PAL.fire3, lv);
        }
      }
    });
    void t;
  }).then(() => r.destroy());
}

// ================================================================ strike

export interface Handle {
  stop(): void;
}

/** The aim: dotted bearing steps out over the floor from the attacker toward the target (orange, stepped). */
export function bearingLine(sc: Phaser.Scene, from: XY, to: XY): Handle {
  const pad = 6;
  const r = new Raster(sc, Math.min(from.x, to.x) - pad, Math.min(from.y, to.y) - pad, Math.abs(to.x - from.x) + 2 * pad, Math.abs(to.y - from.y) + 2 * pad, FLOOR_DEPTH);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const stop = onFrame(
    sc,
    (_dt, el) => {
      const reach = Math.min(len - 14, 18 + (el / 520) * (len - 32));
      const march = Math.floor(el / 60) % 4;
      r.draw((g) => {
        for (let s = 18; s <= reach; s += 2) {
          const k = Math.round(s / 2);
          if ((k + march) % 4 === 0) continue;
          const x = from.x + (dx * s) / len;
          const y = from.y + (dy * s) / len;
          const c = (k + march) % 4 === 1 ? PAL.fire4 : PAL.fire2;
          g.px(x, y, c);
          g.px(x + 1, y, (k + march) % 4 === 1 ? PAL.gold4 : PAL.fire3);
        }
      });
      return true;
    },
    () => r.destroy(),
  );
  return { stop: () => stop() };
}

export interface BracketOpts {
  /** The target's centre (its core, or the duelist's aim point). */
  at: XY;
  /** Half the body's width and height (px). */
  half: number;
  h: number;
  /** +1: the attacker stands left of the target (its near side is left). */
  side: 1 | -1;
  depth: number;
}

export interface Brackets {
  /** Wide and dim → in: the two brackets appear either side. */
  appear(): void;
  /** Slam shut onto the body (the lock): a white frame, then a 1-px quiver; field dots flow ( → ). */
  clamp(): void;
  /** Contact: both break into shards that fly out and fall. */
  shatter(floorY: number): void;
  /** Blocked: both spring back out and flicker away. */
  bounce(): void;
  destroy(): void;
}

/**
 * "Kıskaç": an orange "(" on the attacker's near side and a blue ")" on the far side of the target (mirrored when
 * the attacker comes from the right: the near one is still orange). They appear wide, slide in by whole-pixel
 * steps, slam shut on the lock and quiver; while locked, iron dust flows between them along three field arcs.
 */
export function brackets(sc: Phaser.Scene, o: BracketOpts): Brackets {
  const W = o.half + 40;
  const r = Raster.around(sc, o.at.x, o.at.y, 2 * W, 2 * o.h + 24, o.depth);
  let state: 'off' | 'appear' | 'clamp' | 'bounce' | 'gone' = 'off';
  let t0 = 0;
  let el = 0;
  const near = { ramp: FIRE };
  const far = { ramp: WATER };
  /** One bracket at x offset `off` from the centre on `sx` side (−1 left), its glyph opening to the centre. */
  const glyph = (g: Raster, sx: number, off: number, ramp: readonly number[], lv: number, white: boolean): void => {
    const h = o.h;
    const b = Math.max(3, Math.round(h * 0.28));
    for (let yy = -h; yy <= h; yy++) {
      const k = yy / h;
      const x = o.at.x + sx * (off - Math.round(b * k * k));
      const y = o.at.y + yy;
      const mid = Math.abs(k) < 0.35;
      g.dpx(x, y, white ? PAL.white : mid ? ramp[1] : Math.abs(k) < 0.8 ? ramp[2] : ramp[3], lv);
      // the 2-px stroke: the outer edge one tone down
      g.dpx(x + sx, y, white ? ramp[1] : Math.abs(k) < 0.8 ? ramp[3] : ramp[4], lv);
    }
    // the serifs at both ends, pointing in
    for (const yy of [-o.h, o.h]) g.dpx(o.at.x + sx * (off - b - 1), o.at.y + yy, ramp[2], lv);
  };
  const stopFn = onFrame(
    sc,
    (_dt, e) => {
      el = e;
      if (state === 'gone') return false;
      const t = el - t0;
      const ns = -o.side; // the near side's x sign (attacker on the left: −1)
      r.draw((g) => {
        if (state === 'off') return;
        let off: number;
        let lv = 1;
        let white = false;
        if (state === 'appear') {
          // in by whole steps: wide and dim → mid
          const step = Math.min(3, Math.floor(t / 70));
          off = o.half + 26 - step * 4;
          lv = [0.33, 0.66, 1, 1][step];
        } else if (state === 'clamp') {
          // slam: two steps, a white frame, then a 1-px quiver
          const step = Math.min(2, Math.floor(t / 35));
          off = [o.half + 10, o.half + 5, o.half + 3][step];
          white = t >= 35 && t < 90;
          if (t > 140) off += Math.floor(t / 50) % 2;
          // the field: dust flows near → far along three arcs over / through / under the body
          if (t > 40) {
            for (let a = 0; a < 3; a++) {
              const hy = [-0.55, 0, 0.55][a] * o.h;
              const bow = [-5, 0, 5][a];
              const n = 6;
              for (let i = 0; i < n; i++) {
                const k = ((i / n + t * 0.0016 * (1 + a * 0.2)) % 1 + 1) % 1;
                const x = o.at.x + ns * off * (1 - 2 * k);
                const y = o.at.y + hy + bow * Math.sin(Math.PI * k);
                g.px(x, y, k < 0.3 ? PAL.fire3 : k > 0.7 ? PAL.water3 : (i + a) % 2 ? PAL.mist : PAL.steel);
              }
            }
          }
        } else {
          // bounce: they spring out and flicker away
          const step = Math.min(3, Math.floor(t / 50));
          off = o.half + 3 + [4, 9, 13, 16][step];
          lv = [1, 0.66, 0.33, 0][step];
          if (lv <= 0) return;
        }
        glyph(g, ns, off, near.ramp, lv, white);
        glyph(g, -ns, off, far.ramp, lv, white);
      });
      return true;
    },
    () => r.destroy(),
  );
  const go = (s: typeof state) => {
    state = s;
    t0 = el;
  };
  return {
    appear: () => go('appear'),
    clamp: () => go('clamp'),
    shatter(floorY: number) {
      const ns = -o.side;
      const off = o.half + 3;
      state = 'gone';
      stopFn();
      r.destroy();
      const sp = new Sparks(sc, o.depth + 0.1);
      for (const [sx, ramp] of [
        [ns, FIRE],
        [-ns, WATER],
      ] as const) {
        for (let i = 0; i < 12; i++) {
          const k = RR(-1, 1);
          const y = o.at.y + k * o.h;
          const x = o.at.x + sx * (off - Math.round(o.h * 0.28 * k * k));
          sp.add({ x, y, vx: sx * RR(30, 110), vy: RR(-90, -10) + k * 30, ay: 420, drag: 1.2, life: RR(280, 460), colors: [PAL.white, ramp[1], ramp[2], ramp[3]], shape: i % 3 === 0 ? 'sq' : 'px', size: 2, floor: floorY + RR(-3, 4), bounce: 0.3, fadeAt: 0.8 });
        }
      }
      sp.release();
    },
    bounce: () => go('bounce'),
    destroy() {
      state = 'gone';
      stopFn();
      r.destroy();
    },
  };
}

/** The lunge's track: a two-colour line along the path (fire at the head, water at the tail), fading in steps. */
export function lungeTrail(sc: Phaser.Scene, from: XY, to: () => XY, depth: number, ms: number): Promise<void> {
  const pad = 30;
  const end0 = to();
  const r = new Raster(sc, Math.min(from.x, end0.x) - pad, Math.min(from.y, end0.y) - pad, Math.abs(end0.x - from.x) + 2 * pad, Math.abs(end0.y - from.y) + 2 * pad, depth);
  return animate(sc, ms + 220, (_t, el) => {
    const head = el < ms ? to() : end0;
    const lv = el < ms ? 1 : el < ms + 80 ? 0.66 : el < ms + 160 ? 0.33 : 0.12;
    r.draw((g) => {
      const dx = head.x - from.x;
      const dy = head.y - from.y;
      const L = Math.hypot(dx, dy) || 1;
      for (let s = 0; s <= L; s++) {
        const k = s / L;
        const x = from.x + dx * k;
        const y = from.y + dy * k;
        g.dpx(x, y, k > 0.8 ? PAL.fire4 : k > 0.45 ? PAL.fire2 : PAL.water2, lv * (0.4 + 0.6 * k));
        if (k > 0.6) g.dpx(x, y + 2, PAL.water3, lv * (k - 0.5));
      }
    });
  }).then(() => r.destroy());
}

/** Contact: the needle's line of light runs through the target along `dir`, a 4-point star, two-colour sparks. */
export function pierceFlash(sc: Phaser.Scene, at: XY, dir: XY, depth: number, floorY: number, big = false): void {
  const L = big ? 40 : 30;
  const r = Raster.around(sc, at.x, at.y, 2 * L + 20, 2 * L + 20, depth);
  void (async () => {
    for (let s = 0; s < 4; s++) {
      if (!r.alive) return;
      r.draw((g) => {
        const len = [L, L, Math.round(L * 0.6), Math.round(L * 0.3)][s];
        // the line through: behind the point (entry) to beyond the body (exit)
        for (let k = -len; k <= len; k++) {
          const x = at.x + dir.x * k;
          const y = at.y + dir.y * k;
          g.px(x, y, s === 0 ? PAL.white : k > 0 ? (s === 1 ? PAL.fire4 : PAL.fire2) : s === 1 ? PAL.water4 : PAL.water2);
        }
        // the star at the point
        const st = [6, 4, 2, 0][s];
        for (let k = 1; k <= st; k++) {
          const c = k <= 1 ? PAL.white : PAL.gold4;
          g.px(at.x + k, at.y, c);
          g.px(at.x - k, at.y, c);
          g.px(at.x, at.y + k, c);
          g.px(at.x, at.y - k, c);
        }
        if (s < 2) g.px(at.x, at.y, PAL.white);
      });
      await sleep(sc, 45);
    }
    r.destroy();
  })();
  const sp = new Sparks(sc, depth + 0.1);
  for (let i = 0; i < 12; i++) {
    const a = Math.atan2(dir.y, dir.x) + RR(-0.6, 0.6);
    const v = RR(60, 150);
    sp.add({ x: at.x + dir.x * 4, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, ay: 260, drag: 2, life: RR(200, 360), colors: i % 2 ? [PAL.white, PAL.fire4, PAL.fire3] : [PAL.white, PAL.water4, PAL.water3], shape: i % 4 === 0 ? 'streak' : 'px', len: 0.02, fadeAt: 1 });
  }
  for (let i = 0; i < 6; i++) sp.add({ x: at.x, y: at.y + RR(-4, 4), vx: RR(-30, 30), vy: RR(-60, -20), ay: 300, life: RR(300, 500), colors: DUST, shape: 'px', floor: floorY, bounce: 0.2, fadeAt: 0.8 });
  sp.release();
  void lightFlash(sc, at.x, at.y, PAL.fire4, big ? 38 : 28, 320, { floorY, intensity: 1 });
}

// ================================================================ death

/**
 * Death f1: the invisible force seizes the needle — iron dust is pulled off the floor and the body up to a point
 * above the head, and two field lines bend up toward it (flickering, stepped). Runs `ms`.
 */
export function forceGrip(sc: Phaser.Scene, u: MonsterUnit, home: XY, ms: number, dir: 1 | -1): void {
  const top = { x: home.x - dir * 6, y: home.y - 96 };
  const sp = new Sparks(sc, u.sprite.depth + 0.4);
  for (let i = 0; i < 22; i++) {
    const sx = home.x + RR(-18, 18);
    const sy = home.y - RR(0, 60);
    sp.add({ x: sx, y: sy, tx: top.x + RR(-3, 3), ty: top.y + RR(-2, 4), curl: RR(-0.4, 0.4), life: RR(220, 380), delay: RR(0, ms * 0.6), colors: i % 3 === 0 ? [PAL.fire3, PAL.fire4, PAL.white] : i % 3 === 1 ? [PAL.water3, PAL.water4, PAL.white] : DUST, shape: 'px', fadeAt: 1 });
  }
  sp.release();
  const r = Raster.around(sc, home.x, home.y - 56, 90, 100, u.sprite.depth + 0.3);
  const pool = lightPool(sc, home.x, home.y, { color: PAL.gold3, radius: 22, intensity: 0.7, fadeIn: 0 });
  onFrame(
    sc,
    (_dt, el) => {
      if (el >= ms + 120) return false;
      const step = Math.floor(el / 45);
      const n = needlePoint(u, 'pivot');
      r.draw((g) => {
        if (!n || step % 3 === 2) return;
        // two field lines from the shoulders bending up to the pull point (quadratic arcs, dotted)
        for (const sx of [-1, 1]) {
          const a = { x: n.x + sx * 9, y: n.y - 6 };
          const c = { x: n.x + sx * 16, y: n.y - 34 };
          for (let i = 0; i <= 20; i++) {
            const k = i / 20;
            const x = (1 - k) * (1 - k) * a.x + 2 * (1 - k) * k * c.x + k * k * top.x;
            const y = (1 - k) * (1 - k) * a.y + 2 * (1 - k) * k * c.y + k * k * top.y;
            if ((i + step) % 3 === 0) continue;
            g.px(x, y, sx < 0 ? (k > 0.7 ? PAL.fire4 : PAL.fire2) : k > 0.7 ? PAL.water4 : PAL.water2);
          }
        }
        // the grip point: a small white pinch
        g.px(top.x, top.y, PAL.white);
        if (step % 2) {
          g.px(top.x - 1, top.y, PAL.gold4);
          g.px(top.x + 1, top.y, PAL.gold4);
        }
      });
      return true;
    },
    () => {
      r.destroy();
      void pool.fadeOut(160);
    },
  );
}

/** Death f2: the needle tears out of the shell — steel and gold shards burst from the chest. */
export function ripBurst(sc: Phaser.Scene, at: XY, floorY: number, depth: number): void {
  const sp = new Sparks(sc, depth);
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + RR(-1.3, 1.3);
    const v = RR(60, 150);
    sp.add({ x: at.x + RR(-3, 3), y: at.y + RR(-4, 4), vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 420, drag: 1, life: RR(300, 520), colors: i % 3 === 0 ? [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2] : [PAL.mist, PAL.steel, PAL.stone3, PAL.stone2], shape: i % 4 === 0 ? 'sq' : 'px', size: 2, floor: floorY + RR(-3, 4), bounce: 0.3, fadeAt: 0.8 });
  }
  sp.release();
  void lightFlash(sc, at.x, at.y, PAL.gold4, 30, 300, { floorY, intensity: 0.9 });
}

const SPIN_KEY = 'pn:needle-spin';
const SPIN_N = 16;
const SPIN_S = 48;

/** The torn needle drawn at 16 angles (pixel frames, no sprite rotation): frame i = i/16 of a turn. */
function spinSheet(sc: Phaser.Scene): string {
  if (sc.textures.exists(SPIN_KEY)) return SPIN_KEY;
  const sheet = new PixelCanvas(SPIN_S * SPIN_N, SPIN_S);
  const light = lightOf('left');
  for (let f = 0; f < SPIN_N; f++) {
    const a = (f / SPIN_N) * TAU;
    const q = new PixelCanvas(SPIN_S, SPIN_S);
    needle(q, { c: [SPIN_S / 2, SPIN_S / 2], d: [Math.sin(a), -Math.cos(a)], lenN: TORSO_N, lenS: TORSO_S, hw: 6, band: 3, collar: true, pivot: 2 }, light);
    q.outline(PAL.ink);
    sheet.blit(q, f * SPIN_S, 0);
  }
  const tex = sc.textures.addCanvas(SPIN_KEY, sheet.toCanvas())!;
  for (let f = 0; f < SPIN_N; f++) tex.add(f, 0, f * SPIN_S, 0, SPIN_S, SPIN_S);
  return SPIN_KEY;
}

/**
 * The torn needle spins madly up and off the top of the screen (`back`: the side it flies to, ±1). Starts at
 * `from` with angle `deg` (the death pose's ra) and a two-colour spiral wake behind it.
 */
export function flyingNeedle(sc: Phaser.Scene, o: { from: XY; deg: number; back: 1 | -1; depth: number; flip: boolean }): Promise<void> {
  const key = spinSheet(sc);
  let fr = Math.round(((((o.deg % 360) + 360) % 360) / 360) * SPIN_N) % SPIN_N;
  const img = sc.add.image(Math.round(o.from.x), Math.round(o.from.y), key, fr).setDepth(o.depth).setFlipX(o.flip);
  const wake = new Sparks(sc, o.depth - 0.1);
  const vx = o.back * 150;
  const vy = -360;
  let acc = 0;
  let spinAcc = 0;
  return new Promise<void>((resolve) => {
    onFrame(
      sc,
      (dt, el) => {
        const t = el / 1000;
        // it accelerates up and away, wobbling sideways
        const x = o.from.x + vx * t + Math.sin(el * 0.02) * 3;
        const y = o.from.y + vy * t - 260 * t * t;
        if (!img.active) return false;
        img.setPosition(Math.round(x), Math.round(y));
        spinAcc += dt;
        while (spinAcc > 28) {
          spinAcc -= 28;
          fr = (fr + (o.flip ? SPIN_N - 1 : 1)) % SPIN_N;
          img.setFrame(fr);
        }
        acc += dt;
        while (acc > 22) {
          acc -= 22;
          const k = Math.floor(el / 22) % 2;
          wake.add({ x: Math.round(x) + RR(-2, 2), y: Math.round(y) + RR(-2, 2), vx: RR(-10, 10), vy: RR(-6, 10), life: RR(160, 260), colors: k ? [PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1] : [PAL.water4, PAL.water3, PAL.water2, PAL.water1], shape: 'px', fadeAt: 1 });
        }
        return y > -40 && el < 1400;
      },
      () => {
        img.destroy();
        wake.release();
        resolve();
      },
    );
  });
}

/** Death burst: the magnetite plates drop off the shell and clack down onto the marble (whole px, gold rings). */
export function shellPlates(sc: Phaser.Scene, home: XY, dir: 1 | -1, depth: number): void {
  const sp = new Sparks(sc, depth);
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1;
    sp.add({ x: home.x + side * RR(2, 12), y: home.y - RR(8, 30), vx: side * RR(8, 40), vy: RR(-40, 10), ay: 640, drag: 1.2, life: RR(620, 900), colors: [PAL.stone3, PAL.stone2, PAL.stone1], shape: 'sq', size: i % 3 === 0 ? 3 : 2, floor: home.y + RR(-3, 4), bounce: 0.25, fadeAt: 0.85 });
  }
  for (let i = 0; i < 6; i++) {
    sp.add({ x: home.x + RR(-8, 8), y: home.y - RR(10, 26), vx: RR(-30, 30) - dir * 10, vy: RR(-50, -10), ay: 520, life: RR(420, 640), colors: [PAL.gold4, PAL.gold3, PAL.gold2], shape: 'px', floor: home.y + RR(-2, 3), bounce: 0.35, fadeAt: 0.8 });
  }
  for (let i = 0; i < 10; i++) {
    sp.add({ x: home.x + RR(-14, 14), y: home.y - RR(0, 4), vx: RR(-20, 20), vy: RR(-14, -4), life: RR(400, 700), colors: DUST, shape: 'px', fadeAt: 0.6 });
  }
  sp.release();
}
