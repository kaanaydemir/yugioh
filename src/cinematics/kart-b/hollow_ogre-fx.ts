// Kovuk Devi (hollow_ogre) — painters and small effect objects for its v3 cinematics (./hollow_ogre.ts).
// This module only exports painters (the cinematics glob imports it; no registrations, no side effects: KK-9).
// Pixel language: whole pixels, palette tones only, no alpha, stepped (never faded) — REHBER EF-6 / EF-7.
import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { MonsterId } from '../../data/cards';
import { monsterArt } from '../../art/monsters';
import { monsterFrame } from '../../art/textures';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, type XY } from '../../view/layout';
import { framePixels } from '../../vfx/hologram';
import { lightPool } from '../../view/light';
import { Raster, bayer } from '../../vfx/setpieces';
import { Sparks, animate, onFrame } from '../../vfx/combat';
import { buildNumberTextures } from '../../vfx/numbers';

export const TAU = Math.PI * 2;
const rint = (p: XY): XY => ({ x: Math.round(p.x), y: Math.round(p.y) });
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Violet seed ramp (dark → bright) and the knot light's heart. */
export const SEED = [PAL.void1, PAL.void2, PAL.void3, PAL.void4] as const;


// ================================================================ a seeded stream (set by the caller per uid)

export interface Rng {
  (): number;
}
export function rng(seed: number): Rng {
  let s = (Math.imul(seed | 0, 2654435761) ^ 0x0a6e) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ================================================================ frame helpers

/** A frame point of `anim` frame `f` in world space, wherever the sprite stands now. */
export function pointOf(u: MonsterUnit, anim: Parameters<MonsterUnit['frameCount']>[0], f: number, name: 'muzzle' | 'head' | 'core' | 'staff' | 'hand' | 'grip'): XY {
  const p = u.art.points ? u.art.points(anim, f)[name] : undefined;
  const q = p ?? (name === 'core' ? u.art.core : u.art.muzzle);
  return u.framePoint(q.x, q.y);
}

/** The point of the frame the sprite shows now. */
export function livePoint(u: MonsterUnit, name: 'muzzle' | 'head' | 'core' | 'staff' | 'hand' | 'grip'): XY {
  const fi = u.frameInfo();
  return fi.anim ? pointOf(u, fi.anim, fi.frame, name) : name === 'core' ? u.core() : u.muzzle();
}

/** Frame-space point of the frame the sprite shows now (null: no points). */
function liveFramePoint(u: MonsterUnit, name: 'core' | 'staff' | 'grip'): XY | null {
  const fi = u.frameInfo();
  if (!fi.anim || !u.art.points) return null;
  return u.art.points(fi.anim, fi.frame)[name] ?? null;
}

// ================================================================ summon: the falling log

/** Speed streaks trailing above a falling body (bark tones, whole px), and a few leaves torn off. */
export function fallStreaks(sc: Phaser.Scene, top: () => XY, width: number, depth: number): { stop(): void } {
  const r = new Raster(sc, 0, 0, 640, 360, depth);
  const R = rng(7);
  const cols: number[] = [];
  for (let i = 0; i < 6; i++) cols.push(Math.round((i - 2.5) * (width / 6) + (R() - 0.5) * 3));
  const lens = cols.map(() => 10 + Math.floor(R() * 18));
  let alive = true;
  const stop = onFrame(sc, (_dt, el) => {
    if (!alive) return false;
    const p = rint(top());
    r.draw((g) => {
      cols.forEach((dx, i) => {
        const len = lens[i] + (Math.floor(el / 34) % 2) * 3;
        const y0 = p.y - 2 - (i % 2) * 3;
        g.line(p.x + dx, y0, p.x + dx, y0 - len, i % 3 === 0 ? PAL.earth3 : PAL.earth2);
        g.line(p.x + dx, y0 - len - 2, p.x + dx, y0 - len - 4, PAL.earth1);
      });
    });
    return true;
  }, () => r.destroy());
  return {
    stop() {
      alive = false;
      stop();
    },
  };
}

/**
 * The GIANT log: the sealed log sprite only shows its top; this column continues the log BELOW the sprite (its own
 * base rows tiled downward, a ring crack every few rows, an ink end), clipped at the floor line — so a log far taller
 * than the giant falls, and on the stake the column is driven into the tile and "telescopes" away.
 */
export function logColumn(sc: Phaser.Scene, u: MonsterUnit, extra: number, depth: number): { set(floorY: number): void; destroy(): void } {
  const s = u.sprite;
  const fp = s.active ? framePixels(s) : null;
  const r = new Raster(sc, 0, 0, 640, 360, depth);
  if (!fp) return { set() {}, destroy: () => r.destroy() };
  const flip = s.flipX;
  // the lowest opaque row of the frame (the log's base outline) and a band of plain bark above it
  let yb = fp.h - 1;
  const opaque = (x: number, y: number) => fp.data[(y * fp.w + x) * 4 + 3] !== 0;
  for (; yb > 0; yb--) {
    let any = false;
    for (let x = 0; x < fp.w; x++) if (opaque(x, yb)) any = true;
    if (any) break;
  }
  const BAND = 10;
  const band: { x: number; c: number }[][] = [];
  for (let y = yb - BAND; y < yb; y++) {
    const row: { x: number; c: number }[] = [];
    for (let x = 0; x < fp.w; x++) {
      if (!opaque(x, y)) continue;
      const i = (y * fp.w + x) * 4;
      row.push({ x: flip ? fp.w - 1 - x : x, c: (fp.data[i] << 16) | (fp.data[i + 1] << 8) | fp.data[i + 2] });
    }
    band.push(row);
  }
  return {
    set(floorY) {
      if (!s.active) return;
      const o = rint(u.framePoint(flip ? fp.w : 0, 0));
      // from the frame's own base row on (it covers the sprite's bottom outline: one log, no seam)
      const y0 = o.y + yb;
      r.draw((g) => {
        for (let j = 0; j < extra; j++) {
          const y = y0 + j;
          if (y > floorY) break;
          // the base band ping-pongs (no visible seam), with a knot hole now and then on the mid plane
          const m = j % (BAND * 2);
          const row = band[m < BAND ? m : BAND * 2 - 1 - m];
          const end = j === extra - 1;
          const knot = j % 17 === 8;
          const kx = row.length ? row[Math.floor(row.length * (0.45 + ((j * 7) % 5) * 0.06))]?.x ?? -99 : -99;
          for (const p of row) {
            const isKnot = knot && (p.x === kx || p.x === kx + 1) && p.c !== PAL.ink;
            g.px(o.x + p.x, y, end ? PAL.ink : isKnot ? PAL.earth0 : p.c);
          }
          if (knot && kx > -99) {
            g.px(o.x + kx, y + 1, PAL.earth3);
            g.px(o.x + kx + 1, y + 1, PAL.earth3);
          }
        }
      });
    },
    destroy: () => r.destroy(),
  };
}

/** A dust WALL thrown up round a staked log: a ring of big loam puffs climbing 20+ px, chips skittering out. */
export function dustWall(sc: Phaser.Scene, at: XY, rx: number, R: Rng): void {
  const sp = new Sparks(sc, DEPTH.FX - 1);
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * TAU + R() * 0.2;
    const front = Math.sin(a) > 0;
    sp.add({ x: at.x + Math.cos(a) * rx * 0.7, y: at.y + Math.sin(a) * rx * 0.3, vx: Math.cos(a) * (40 + R() * 40), vy: -40 - R() * 70, drag: 3.2, ay: 40, life: 420 + R() * 260, delay: Math.floor(R() * 50), colors: front ? [PAL.earth4, PAL.earth3, PAL.earth2] : [PAL.earth3, PAL.earth3, PAL.earth2], shape: 'puff', size: i % 3 === 0 ? 2.5 : 2, fadeAt: 1 });
  }
  for (let i = 0; i < 14; i++) {
    const a = R() * TAU;
    sp.add({ x: at.x, y: at.y, vx: Math.cos(a) * (90 + R() * 60), vy: Math.sin(a) * 30 - 20, ay: 300, floor: at.y + Math.sin(a) * 6, bounce: 0.3, life: 360 + R() * 160, colors: [PAL.earth4, PAL.earth3, PAL.earth1], shape: 'px', fadeAt: 1 });
  }
  sp.release();
}

/** Ember light spilling from the bark's seam: the jagged seam blazes (white → gold4), short gold rays leak out of a few points. */
export function emberCrack(sc: Phaser.Scene, at: () => XY, depth: number, ms: number): void {
  const r = new Raster(sc, 0, 0, 640, 360, depth);
  void animate(sc, ms, (_k, el) => {
    const p = rint(at());
    const fl = Math.floor(el / 34) % 2;
    r.draw((g) => {
      for (let y = -7; y <= 6; y++) g.px(p.x + ((y >> 1) % 2 ? 1 : 0), p.y + y, y > -3 && y < 2 ? PAL.white : y > -6 && y < 4 ? PAL.gold4 : PAL.gold3);
      for (const [dy, sx, L] of [[-4, -1, 4], [-1, 1, 6], [2, -1, 5], [4, 1, 3]] as const) {
        const len = L + fl;
        for (let i = 2; i <= len; i++) g.dpx(p.x + sx * i, p.y + dy - Math.round(i * 0.4), i < 4 ? PAL.gold3 : PAL.gold2, i < 4 ? 1 : 0.5);
      }
    });
  }).then(() => r.destroy());
}

/**
 * The SLAM's root-crack star: 9 branching root cracks run out across the tile (2 px: an ink core, a pale heartwood
 * lip on the far side, a loam shoulder), each forking once; they grow in steps, hold, then go out from the tips in.
 */
export function rootStar(sc: Phaser.Scene, at: XY, R0: number, seed: number, ms = 760): void {
  const R = rng(seed);
  const r = Raster.around(sc, at.x, at.y, R0 * 2 + 16, R0 + 16, DEPTH.SHADOW + 0.6);
  const arms: XY[][] = [];
  const n = 9;
  const mk = (a: number, L: number, from: XY, segs: number): XY[] => {
    const pts: XY[] = [from];
    let ang = a;
    for (let k = 1; k <= segs; k++) {
      ang += (R() - 0.5) * 0.5;
      const prev = pts[pts.length - 1];
      pts.push(rint({ x: prev.x + Math.cos(ang) * (L / segs), y: prev.y + Math.sin(ang) * (L / segs) * 0.45 }));
    }
    return pts;
  };
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + R() * 0.4;
    const L = R0 * (0.65 + R() * 0.35);
    const main = mk(a, L, at, 5);
    arms.push(main);
    arms.push(mk(a + (R() < 0.5 ? -0.7 : 0.7), L * 0.4, main[2], 3));
  }
  void animate(sc, ms, (_k, el) => {
    const grow = Math.min(1, el / 160);
    const out = el < ms * 0.6 ? 0 : (el - ms * 0.6) / (ms * 0.4);
    r.draw((g) => {
      arms.forEach((pts, ai) => {
        const fork = ai % 2 === 1;
        const g0 = fork ? Math.max(0, grow * 2 - 1) : grow;
        const m = Math.round(g0 * (pts.length - 1));
        const keep = Math.round((1 - out) * (pts.length - 1));
        for (let i = 1; i <= Math.min(m, keep); i++) {
          const a = pts[i - 1];
          const b = pts[i];
          const thin = i > (pts.length - 1) * 0.6 || fork;
          g.line(a.x, a.y - 1, b.x, b.y - 1, i < 3 ? PAL.earth4 : PAL.earth3);
          g.line(a.x, a.y + (thin ? 1 : 2), b.x, b.y + (thin ? 1 : 2), PAL.earth1);
          g.line(a.x, a.y, b.x, b.y, PAL.ink, 1, thin ? 1 : 2);
        }
      });
    });
  }).then(() => r.destroy());
}

/** A ring of moss + sprouts pops up round the impact (staggered), stands, then withers brown and sinks. */
export function sproutRing(sc: Phaser.Scene, at: XY, rx: number, n: number, R: Rng, ms = 900): void {
  const r = Raster.around(sc, at.x, at.y - 4, rx * 2 + 12, rx + 20, DEPTH.SHADOW + 0.8);
  const sp: { x: number; y: number; d: number; h: number; s: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + R() * 0.3;
    sp.push({ x: Math.round(at.x + Math.cos(a) * rx * (0.8 + R() * 0.25)), y: Math.round(at.y + Math.sin(a) * rx * 0.42), d: Math.floor(R() * 90), h: 3 + Math.floor(R() * 3), s: R() < 0.5 ? -1 : 1 });
  }
  void animate(sc, ms, (_k, el) => {
    r.draw((g) => {
      for (const p of sp) {
        const t = el - p.d;
        if (t < 0) continue;
        const up = Math.min(1, t / 120);
        const wither = Math.max(0, (el - ms * 0.55) / (ms * 0.45));
        const h = Math.max(0, Math.round(p.h * up * (1 - wither * 0.7)));
        const dry = wither > 0.4;
        // the moss tuft at its foot
        g.px(p.x - 1, p.y, dry ? PAL.earth1 : PAL.leaf1);
        g.px(p.x + 1, p.y, dry ? PAL.earth1 : PAL.leaf0);
        if (h < 1) continue;
        const droop = wither > 0.2 ? p.s * Math.round(wither * 2) : 0;
        for (let y = 0; y < h; y++) g.px(p.x + Math.round((droop * y) / h), p.y - y, dry ? PAL.earth2 : PAL.leaf2);
        const tx = p.x + droop;
        const ty = p.y - h;
        g.px(tx - 1, ty + (wither > 0.3 ? 1 : 0), dry ? PAL.earth2 : PAL.leaf3);
        g.px(tx + 1, ty + (wither > 0.3 ? 1 : 0), dry ? PAL.earth1 : PAL.leaf2);
        g.px(tx, ty - 1, dry ? PAL.earth1 : PAL.leaf3);
      }
    });
  }).then(() => r.destroy());
}

/** The guard's own beat on a blocked hit: charred bark chips fly off the club, the root feet plant with dust. */
export function guardChips(sc: Phaser.Scene, club: XY, feet: XY, dir: number, R: Rng): void {
  const sp = new Sparks(sc, DEPTH.FX);
  for (let i = 0; i < 22; i++) {
    const a = -Math.PI / 2 + (R() - 0.5) * 1.8 - dir * 0.8;
    const v = 70 + R() * 80;
    const heart = i % 2 === 0;
    sp.add({ x: club.x + (R() - 0.5) * 8, y: club.y + (R() - 0.5) * 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, ay: 400, floor: feet.y + (R() - 0.5) * 6, bounce: 0.35, life: 480 + R() * 260, colors: heart ? [PAL.earth4, PAL.earth4, PAL.earth3, PAL.earth2] : [PAL.earth2, PAL.earth1, PAL.earth0], shape: i % 3 === 2 ? 'px' : 'sq', size: 2, fadeAt: 1, flicker: i % 5 === 0 });
  }
  sp.release();
  for (const dx of [-8, 8]) loam(sc, { x: feet.x + dx, y: feet.y }, 5, 36, R);
}

/** The shadow of something big coming down: an ellipse on the floor that grows and darkens in steps. */
export function fallShadow(sc: Phaser.Scene, at: XY, rx: number, depth: number): { set(k: number): void; destroy(): void } {
  const r = Raster.around(sc, at.x, at.y, rx * 2 + 8, rx + 8, depth);
  return {
    set(k) {
      const step = Math.min(3, Math.floor(k * 4));
      const w = Math.round(rx * (0.35 + 0.65 * k));
      r.draw((g) => {
        if (w < 2) return;
        g.ell(at.x, at.y, w, Math.max(1, Math.round(w * 0.42)), PAL.night0, [0.25, 0.5, 0.75, 1][step]);
        if (step >= 2) g.ell(at.x, at.y, Math.round(w * 0.55), Math.max(1, Math.round(w * 0.22)), PAL.ink, step === 3 ? 1 : 0.5);
      });
    },
    destroy: () => r.destroy(),
  };
}

/** A crack star stamped into the floor (staked log / club smash): lines grow out in steps, then go out in steps. */
export function floorCrack(sc: Phaser.Scene, at: XY, R0: number, seed: number, ms = 520): void {
  const R = rng(seed);
  const r = Raster.around(sc, at.x, at.y, R0 * 2 + 10, R0 + 10, DEPTH.SHADOW + 0.6);
  const arms: XY[][] = [];
  const n = 6 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + R() * 0.5;
    const pts: XY[] = [{ x: at.x, y: at.y }];
    const L = R0 * (0.6 + R() * 0.4);
    for (let k = 1; k <= 3; k++) {
      const t = k / 3;
      const jog = (R() - 0.5) * 0.6;
      pts.push({ x: Math.round(at.x + Math.cos(a + jog) * L * t), y: Math.round(at.y + Math.sin(a + jog) * L * t * 0.45) });
    }
    arms.push(pts);
  }
  void animate(sc, ms, (_k, el) => {
    const grow = Math.min(1, el / 70);
    const out = el < ms * 0.55 ? 0 : (el - ms * 0.55) / (ms * 0.45);
    r.draw((g) => {
      for (const pts of arms) {
        const m = Math.max(1, Math.round(grow * (pts.length - 1)));
        for (let i = 1; i <= m; i++) {
          const lvl = out <= 0 ? 1 : Math.max(0, 1 - out * (1 + (pts.length - i) * 0.3));
          if (lvl <= 0) continue;
          g.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, i === 1 ? PAL.ink : PAL.earth0, lvl);
        }
      }
    });
  }).then(() => r.destroy());
}

/** A stepped shock ring on the floor (bark → loam tones), ≤ 1 ring (EF-7). */
export function floorRing(sc: Phaser.Scene, at: XY, R1: number, ms = 300, tones: readonly number[] = [PAL.earth3, PAL.earth2, PAL.earth1]): void {
  const r = Raster.around(sc, at.x, at.y, R1 * 2 + 6, R1 + 6, DEPTH.SHADOW + 0.7);
  void animate(sc, ms, (k) => {
    const step = Math.min(tones.length - 1, Math.floor(k * tones.length));
    const rx = Math.round(R1 * (0.35 + 0.65 * (1 - (1 - k) * (1 - k))));
    r.draw((g) => g.ring(at.x, at.y, rx, Math.max(1, Math.round(rx * 0.45)), tones[step], step === tones.length - 1 ? 0.5 : 1));
  }).then(() => r.destroy());
}

/** Loam dust kicked out low along the floor. */
export function loam(sc: Phaser.Scene, at: XY, n: number, spread: number, R: Rng): void {
  const sp = new Sparks(sc, DEPTH.FX - 1);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + R() * 0.4;
    sp.add({ x: at.x + Math.cos(a) * 4, y: at.y + Math.sin(a) * 2, vx: Math.cos(a) * spread * (0.6 + R() * 0.5), vy: Math.sin(a) * spread * 0.4 - 10, drag: 5, life: 260 + R() * 120, colors: [PAL.earth3, PAL.earth2, PAL.earth1], shape: 'puff', size: 1.5, fadeAt: 1 });
  }
  sp.release();
}

/** Wood splinters and bark chips thrown up (bounce on the floor, blink out). */
export function splinters(sc: Phaser.Scene, at: XY, floorY: number, n: number, R: Rng, o: { dir?: number; up?: number; depth?: number } = {}): void {
  const sp = new Sparks(sc, o.depth ?? DEPTH.FX);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (R() - 0.5) * 2.4 + (o.dir ?? 0) * 0.5;
    const v = 50 + R() * 80;
    sp.add({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * (o.up ?? 1) - 30, ay: 380, floor: floorY + (R() - 0.5) * 6, bounce: 0.3, life: 380 + R() * 220, colors: i % 3 === 0 ? [PAL.earth4, PAL.earth3, PAL.earth2] : [PAL.earth3, PAL.earth2, PAL.earth1], shape: i % 4 === 0 ? 'sq' : 'px', size: i % 4 === 0 ? 2 : 1, fadeAt: 1, flicker: i % 5 === 0 });
  }
  sp.release();
}

/** Leaves shaken loose: they flutter down swinging side to side (whole px; leaf tones). */
export function leaves(sc: Phaser.Scene, from: XY, floorY: number, n: number, R: Rng, depth: number = DEPTH.FX): void {
  const sp = new Sparks(sc, depth);
  const list: { p: ReturnType<Sparks['add']>; ph: number; w: number }[] = [];
  for (let i = 0; i < n; i++) {
    const p = sp.add({ x: from.x + (R() - 0.5) * 16, y: from.y + (R() - 0.5) * 6, vx: (R() - 0.5) * 50, vy: -30 - R() * 40, ay: 120, drag: 2.2, floor: floorY + (R() - 0.5) * 6, bounce: 0, life: 520 + R() * 320, colors: i % 2 ? [PAL.leaf3, PAL.leaf2, PAL.leaf1] : [PAL.leaf2, PAL.leaf1, PAL.leaf0], shape: i % 3 === 0 ? 'sq' : 'px', size: 1, fadeAt: 1 });
    list.push({ p, ph: R() * TAU, w: 6 + R() * 5 });
  }
  // the sway: a sideways push that swings with each leaf's own phase
  onFrame(sc, (_dt, el) => {
    let any = false;
    for (const l of list) {
      if ((l.p.age ?? 0) >= l.p.life) continue;
      any = true;
      l.p.vx = Math.sin(el * 0.012 + l.ph) * 22 * (l.w / 8);
    }
    return any;
  });
  sp.release();
}

// ================================================================ the effect: the graveyard's monster → a light seed

/**
 * The real graveyard card's monster rises over the pile as a violet silhouette (its own pixels mapped onto the void
 * ramp by luminance), then every pixel is pulled into one point — it shrinks to a light seed. `at` = the floor point
 * the silhouette stands on, `seedAt` = where the seed forms. Resolves when the seed has formed.
 */
export async function shrinkToSeed(sc: Phaser.Scene, cardId: MonsterId, at: XY, flip: boolean, seedAt: XY, depth: number, o: { riseMs?: number; shrinkMs?: number } = {}): Promise<void> {
  const art = monsterArt(cardId);
  const pc = monsterFrame(cardId, 'idle', 0);
  // half size (the spec's "%50 boyda"): every second pixel of the frame, stepped onto the void ramp
  const pts: { x: number; y: number; c: number; d: number }[] = [];
  const ax = art.anchorX;
  const ay = art.anchorY + (art.hover ?? 0);
  let maxD = 1;
  for (let y = 0; y < pc.h; y += 2)
    for (let x = 0; x < pc.w; x += 2) {
      const c = pc.get(x, y);
      if (c === null) continue;
      const lum = ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;
      const tone = c === PAL.ink ? PAL.void0 : lum < 60 ? PAL.void1 : lum < 120 ? PAL.void2 : lum < 190 ? PAL.void3 : PAL.void4;
      const fx = flip ? ax - x : x - ax;
      const px = Math.round(at.x + fx / 2);
      const py = Math.round(at.y + (y - ay) / 2);
      const d = Math.hypot(px - seedAt.x, py - seedAt.y);
      maxD = Math.max(maxD, d);
      pts.push({ x: px, y: py, c: tone, d });
    }
  if (!pts.length) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x, seedAt.x);
    y0 = Math.min(y0, p.y, seedAt.y);
    x1 = Math.max(x1, p.x, seedAt.x);
    y1 = Math.max(y1, p.y, seedAt.y);
  }
  const r = new Raster(sc, x0 - 4, y0 - 4, x1 - x0 + 9, y1 - y0 + 9, depth);
  const top = y0;
  const bot = y1;
  const riseMs = o.riseMs ?? 120;
  const shrinkMs = o.shrinkMs ?? 260;
  // rise: the silhouette is built bottom → top over the pile (a bayer edge), its outline flickering
  await animate(sc, riseMs, (k) => {
    const edge = bot - (bot - top + 2) * k;
    r.draw((g) => {
      for (const p of pts) {
        if (p.y < edge) continue;
        const near = p.y - edge < 2;
        g.px(p.x, p.y - Math.round(2 * k), near ? PAL.void4 : p.c);
      }
    });
  });
  // shrink: every pixel is pulled into the seed, the far ones last; tones step up as they converge
  await animate(sc, shrinkMs, (k) => {
    r.draw((g) => {
      for (const p of pts) {
        const lag = (p.d / maxD) * 0.35;
        const t = Math.max(0, Math.min(1, (k - lag * 0.4) / (1 - lag * 0.4)));
        const e = t * t * (3 - 2 * t);
        const x = Math.round(lerp(p.x, seedAt.x, e));
        const y = Math.round(lerp(p.y - 2, seedAt.y, e));
        const c = e > 0.85 ? PAL.void4 : e > 0.5 ? (p.c === PAL.void0 || p.c === PAL.void1 ? PAL.void2 : PAL.void3) : p.c;
        g.px(x, y, c);
      }
      if (k > 0.6) drawSeed(g, seedAt, k > 0.92 ? 3 : k > 0.78 ? 2 : 1);
    });
  });
  r.destroy();
}

/** The light seed itself: a violet drop (void3 rim, void4 heart, a gold4 core on size ≥ 2; size 3 = the flying seed). */
export function drawSeed(g: Raster, at: XY, size: 1 | 2 | 3 = 2): void {
  const { x, y } = rint(at);
  if (size === 1) {
    g.px(x, y, PAL.void4);
    g.px(x, y - 1, PAL.void3);
    g.px(x - 1, y, PAL.void3);
    g.px(x + 1, y, PAL.void3);
    g.px(x, y + 1, PAL.void3);
    return;
  }
  if (size === 3) {
    // a 5×6 teardrop: void2 rim, void3 body, void4 heart, gold4 core (the brightest pixel of the moment)
    for (let dy = -3; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const r = Math.abs(dx) + Math.max(0, -dy - 1) + Math.max(0, dy);
        if (r > 2 || (dy === -3 && dx !== 0)) continue;
        g.px(x + dx, y + dy, r === 2 ? PAL.void2 : r === 1 ? PAL.void3 : PAL.void4);
      }
    g.px(x, y - 1, PAL.void4);
    g.px(x, y, PAL.gold4);
    g.px(x - 1, y - 1, PAL.gold3);
    return;
  }
  for (const [dx, dy] of [[0, -2], [-1, -1], [1, -1], [-1, 0], [1, 0], [0, 1]] as const) g.px(x + dx, y + dy, PAL.void3);
  g.px(x, y - 1, PAL.void4);
  g.px(x, y, PAL.gold4);
}

/**
 * The HERO seed (round 1 critic: the 5×6 seed was a dot at 1×): an 9×11 glowing teardrop, tip up — a void2 rim (its
 * top-left edge lit gold4: the key light), a void3 body, a void4 heart and a white core. `st` squashes / stretches it
 * (> 1 taller + narrower: launch / fall; < 1 wider + flatter: the catch), whole rows and columns only.
 */
const HERO_ROWS = [1, 1, 3, 3, 5, 7, 9, 9, 9, 7, 5] as const;
export function drawHeroSeed(g: Raster, at: XY, st = 1, hot = false): void {
  const { x, y } = rint(at);
  const n = HERO_ROWS.length;
  const rows = Math.max(5, Math.round(n * st));
  const wk = Math.min(1.35, Math.max(0.65, 1 / st));
  const by = y + 4; // the seed's centre of mass sits on `at`; rows run up from its belly
  for (let r = 0; r < rows; r++) {
    const src = HERO_ROWS[Math.min(n - 1, Math.floor((r / rows) * n))];
    const w = Math.max(1, Math.round(src * wk) | 1);
    const yy = by - (rows - 1) + r;
    const hw = (w - 1) / 2;
    for (let i = 0; i < w; i++) {
      const dx = i - hw;
      const edge = i === 0 || i === w - 1 || r === 0 || r === rows - 1;
      const inner = Math.abs(dx) <= Math.max(0, hw - 2) && r > 1 && r < rows - 2;
      let c: number = edge ? PAL.void2 : inner ? PAL.void4 : PAL.void3;
      // the key light from the top-left catches the rim
      if (edge && dx < 0 && r < rows * 0.6) c = PAL.gold4;
      g.px(x + dx, yy, c);
    }
  }
  // the white core (2×2 on the belly, toward the light), a gold4 glint up on the tip
  const cy = by - Math.round(rows * 0.35);
  g.px(x - 1, cy, PAL.white);
  g.px(x, cy, PAL.white);
  g.px(x - 1, cy + 1, hot ? PAL.white : PAL.void4);
  g.px(x, cy - 1, hot ? PAL.white : PAL.void4);
  g.px(x, by - rows + 1, PAL.gold4);
}

/**
 * The seed's arc from the graveyard onto the root tip (`to()` is live: the tendril moves): a parabola `lift` px high.
 * The hero seed squashes on launch, a 2-px stepped trail of beads hangs ≈ 150 ms behind it (it lingers after the
 * arrival), sparks shed, and a violet glow pool + a dithered light spot run on the FLOOR under the arc (where it is
 * over the board). Resolves on arrival (the trail fades on its own).
 */
export async function seedFlight(sc: Phaser.Scene, from: XY, to: () => XY, ms: number, lift: number, depth: number, R: Rng, o: { floorFrom?: number; floorTo?: number } = {}): Promise<void> {
  const r = new Raster(sc, 0, 0, 640, 360, depth);
  const sp = new Sparks(sc, depth - 0.1);
  const f0 = o.floorFrom ?? from.y + 14;
  const light = lightPool(sc, from.x, from.y, { color: PAL.void3, spill: PAL.void2, radius: 20, floorY: f0, air: 0.9, intensity: 1.25, anim: 'flicker', fadeIn: 30 });
  const path = (k: number, t: XY): XY => {
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    return { x: lerp(from.x, t.x, e), y: lerp(from.y, t.y, e) - Math.sin(Math.PI * e) * lift };
  };
  const hist: { x: number; y: number; t: number }[] = [];
  const TRAIL = 150;
  let shed = 0;
  let clock = 0;
  const drawTrail = (g: Raster, now: number) => {
    // newest first: every bead is a 2×2 block stepping down the ramp with its age (void4 → void1), then a 1-px tail
    let last: XY | null = null;
    for (let i = hist.length - 1; i >= 0; i--) {
      const h = hist[i];
      const age = (now - h.t) / TRAIL;
      if (age >= 1) break;
      if (last && Math.abs(h.x - last.x) + Math.abs(h.y - last.y) < 2) continue;
      last = h;
      const c = age < 0.25 ? PAL.void4 : age < 0.5 ? PAL.void3 : age < 0.75 ? PAL.void2 : PAL.void1;
      g.px(h.x, h.y, c);
      if (age < 0.6) {
        g.px(h.x + 1, h.y, c);
        g.px(h.x, h.y + 1, age < 0.3 ? PAL.void3 : PAL.void2);
        g.px(h.x + 1, h.y + 1, PAL.void2);
      }
    }
  };
  const floorAt = (k: number, t: XY): number => lerp(f0, o.floorTo ?? t.y + 30, k);
  await animate(sc, ms, (k, el, dt) => {
    clock = el;
    const t = to();
    const p = rint(path(k, t));
    hist.push({ x: p.x, y: p.y, t: el });
    const fy = Math.round(floorAt(k, t));
    light.setPosition(p.x, p.y, fy);
    shed += dt;
    if (shed > 22) {
      shed = 0;
      sp.add({ x: p.x + (R() - 0.5) * 4, y: p.y, vx: (R() - 0.5) * 22, vy: 6 + R() * 16, drag: 2, life: 220 + R() * 160, colors: R() < 0.2 ? [PAL.gold4, PAL.void4, PAL.void3, PAL.void2] : [PAL.void4, PAL.void3, PAL.void2, PAL.void1], shape: R() < 0.25 ? 'plus' : 'px', fadeAt: 1, flicker: R() < 0.5 });
    }
    // launch: stretched up out of the shrink, then round; the last stretch of the fall leans long again
    const st = k < 0.12 ? lerp(1.35, 1, k / 0.12) : k > 0.86 ? lerp(1, 1.2, (k - 0.86) / 0.14) : 1;
    r.draw((g) => {
      // the light spot it throws on the floor beneath (dithered void, stepped by height)
      const hgt = fy - p.y;
      const sr = Math.max(3, Math.round(9 - hgt / 12));
      if (hgt > 4) {
        // a glint ring of reflected light on the floor (sparse: it must read as light, never as a shadow)
        g.ring(p.x, fy, sr, Math.max(1, Math.round(sr * 0.45)), PAL.void3, 0.5);
        g.px(p.x, fy, PAL.void4);
        g.px(p.x - 1, fy, PAL.void3);
        g.px(p.x + 1, fy, PAL.void3);
      }
      drawTrail(g, el);
      // a turning halo of four sparks round the seed
      const a = el * 0.018;
      for (let i = 0; i < 4; i++) {
        const aa = a + (i * Math.PI) / 2;
        g.px(Math.round(p.x + Math.cos(aa) * 8), Math.round(p.y - 1 + Math.sin(aa) * 6), i % 2 ? PAL.void3 : PAL.void4);
      }
      g.ring(p.x, p.y - 1, 7, 6, PAL.void2, 0.35);
      drawHeroSeed(g, p, st);
    });
  });
  void light.fadeOut(140);
  sp.release();
  // the trail lingers ≈ 150 ms after the seed has gone onto the root tip
  void animate(sc, TRAIL, (_k, el) => r.draw((g) => drawTrail(g, clock + el))).then(() => r.destroy());
}

/**
 * The seed held by the planting tendril from the catch until it is in the hollow: the hero seed rides `at()` (the
 * frame's tendril tip), squashed on the catch, its halo pulsing. stop() ends it (the knot beat takes over).
 */
export function heldSeed(sc: Phaser.Scene, at: () => XY | null, depth: number): { stop(): void } {
  const r = new Raster(sc, 0, 0, 640, 360, depth);
  let alive = true;
  const stop = onFrame(sc, (_dt, el) => {
    if (!alive) return false;
    const p = at();
    r.draw((g) => {
      if (!p) return;
      const q = rint(p);
      const st = el < 50 ? 0.72 : el < 100 ? 1.12 : 1;
      if (Math.floor(el / 70) % 2 === 0) g.ring(q.x, q.y - 1, 7, 6, PAL.void3, 0.5);
      drawHeroSeed(g, q, st, el < 60);
    });
    return true;
  }, () => r.destroy());
  return {
    stop() {
      alive = false;
      stop();
    },
  };
}

/**
 * A root that reaches out of the giant toward the graveyard while the seed forms (fills the beat between the shrink
 * and the flight, and points the eye along the arc): it grows from the tendril tip along the seed's arc to `reach`
 * of the way (wriggling, 2 px, earth tones on an ink edge, a forked violet-lit tip) and retracts as the seed comes in.
 */
export function reachRoot(sc: Phaser.Scene, tip: () => XY, toward: XY, lift: number, depth: number, reach = 0.42): { retract(ms: number): Promise<void>; destroy(): void } {
  const r = new Raster(sc, 0, 0, 640, 360, depth);
  let grown = 0;
  let k0 = -1;
  let ret = 0;
  let retMs = 1;
  let alive = true;
  const pts = (t0: XY, len: number, el: number): XY[] => {
    const out: XY[] = [];
    const N = 22;
    for (let i = 0; i <= N; i++) {
      const u = (i / N) * len;
      // the seed's arc run backward (from the tip toward the grave), a wriggle that travels down it
      const e = 1 - u;
      const x = lerp(toward.x, t0.x, e);
      const y = lerp(toward.y, t0.y, e) - Math.sin(Math.PI * e) * lift * 0.9;
      const w = Math.sin(u * 18 - el * 0.02) * 1.6 * (u / Math.max(0.01, len));
      out.push(rint({ x: x + w * 0.5, y: y + w }));
    }
    return out;
  };
  const stop = onFrame(sc, (_dt, el) => {
    if (!alive) return false;
    if (k0 < 0) k0 = el;
    grown = Math.min(1, (el - k0) / 220);
    const len = reach * (grown < 1 ? 1 - (1 - grown) * (1 - grown) : 1) * (1 - ret);
    const t0 = tip();
    r.draw((g) => {
      if (len < 0.02) return;
      const P = pts(t0, len, el);
      for (const q of P) for (const [dx, dy] of [[-1, 0], [2, 0], [0, -1], [1, -1], [0, 2], [1, 2]] as const) g.px(q.x + dx, q.y + dy, PAL.ink);
      P.forEach((q, i) => {
        const thin = i > P.length * 0.7;
        g.px(q.x, q.y, PAL.earth3);
        if (!thin) g.px(q.x + 1, q.y, PAL.earth2);
        g.px(q.x, q.y + 1, PAL.earth1);
        if (!thin) g.px(q.x + 1, q.y + 1, PAL.earth1);
      });
      const e = P[P.length - 1];
      const pv = P[P.length - 3];
      const dx = Math.sign(e.x - pv.x) || 1;
      g.px(e.x + dx, e.y - 1, PAL.earth2);
      g.px(e.x + dx, e.y + 2, PAL.earth2);
      g.px(e.x + dx * 2, e.y - 2, PAL.void4);
      g.px(e.x + dx * 2, e.y + 3, PAL.void3);
    });
    return true;
  }, () => r.destroy());
  return {
    retract(ms) {
      retMs = Math.max(1, ms);
      return animate(sc, retMs, (k) => (ret = k * k)).then(() => undefined);
    },
    destroy() {
      alive = false;
      stop();
    },
  };
}

/**
 * The knot beat: a hollow-wide violet BLOOM — a 16-px star flare (white heart → void4 → void3 → void2 rays, stepped)
 * and one ring that expands out of the chest (≤ 1 ring), motes spat out.
 */
export function knotBloom(sc: Phaser.Scene, at: XY, depth: number, R: Rng): void {
  const r = Raster.around(sc, at.x, at.y, 72, 60, depth);
  void animate(sc, 300, (_k, el) => {
    const step = Math.min(5, Math.floor(el / 50));
    r.draw((g) => {
      const L = [6, 12, 16, 16, 13, 9][step];
      const rayC = step === 0 ? PAL.white : step < 2 ? PAL.void4 : step < 4 ? PAL.void3 : PAL.void2;
      for (let i = 0; i < 8; i++) {
        const long = i % 2 === 0;
        if (step > 3 && !long) continue;
        // rays tilted off the axes (a burst, never a cross-hair) and starting clear of the heart
        const a = (i / 8) * TAU + Math.PI / 8;
        const Li = long ? L : Math.round(L * 0.6);
        const r0 = Math.max(3, Math.round(Li * 0.45));
        g.line(at.x + Math.cos(a) * r0, at.y + Math.sin(a) * r0 * 0.8, at.x + Math.cos(a) * Li, at.y + Math.sin(a) * Li * 0.8, rayC);
        if (long && step < 3) g.px(Math.round(at.x + Math.cos(a) * (Li + 2)), Math.round(at.y + Math.sin(a) * (Li + 2) * 0.8), PAL.void4);
      }
      if (step < 3) {
        g.disc(at.x, at.y, [4, 3, 2][step], step === 0 ? PAL.void4 : PAL.void3);
        g.disc(at.x, at.y, [2, 1, 1][step], PAL.white);
      }
      // the ring out of the chest
      const rr = [5, 10, 15, 19, 22, 24][step];
      g.ring(at.x, at.y, rr, Math.round(rr * 0.7), step < 2 ? PAL.void4 : step < 4 ? PAL.void3 : PAL.void2, step < 4 ? 1 : 0.5);
    });
  }).then(() => r.destroy());
  const sp = new Sparks(sc, depth + 0.1);
  for (let i = 0; i < 14; i++) {
    const a = R() * TAU;
    sp.add({ x: at.x, y: at.y, vx: Math.cos(a) * (40 + R() * 40), vy: Math.sin(a) * 26 - 28, drag: 2.4, life: 300 + R() * 200, colors: i % 4 === 0 ? [PAL.white, PAL.void4, PAL.void3] : [PAL.void4, PAL.void3, PAL.void2], shape: i % 3 ? 'px' : 'plus', fadeAt: 1, flicker: i % 2 === 0 });
  }
  sp.release();
}

/**
 * The +400 of one seed, short-lived and pinned to the club sprout it fed (the shared impactNumber floats 1.5 s and was
 * still over the next attack's declaration): the same digit sheet (fx:num:heal), a one-size-up slam for two frames,
 * a 6-px jump, ~0.8 s, then it blinks out in steps. `at()` is live (the club moves).
 */
export function seedNumber(sc: Phaser.Scene, at: () => XY, amount: number, life = 620): { destroy(): void } {
  buildNumberTextures(sc);
  const text = '+' + String(Math.abs(Math.round(amount)));
  const c = sc.add.container(0, 0).setDepth(DEPTH.FX_TOP + 50);
  const widths = [...text].map((ch) => Math.max(1, sc.textures.getFrame('fx:num:heal', ch)?.width ?? 8) - 3);
  const total = widths.reduce((a, w) => a + w + 1, 0) - 1;
  let gx = -Math.floor(total / 2);
  [...text].forEach((ch, i) => {
    const w = widths[i];
    c.add(sc.add.image(Math.round(gx + (w + 3) / 2 - 1), 0, 'fx:num:heal', ch).setOrigin(0.5, 0.5));
    gx += w + 1;
  });
  const put = (el: number) => {
    const p = at();
    const jump = Math.round(Math.min(1, el / 120) * 6) + Math.round(Math.min(1, el / life) * 4);
    c.setPosition(Math.round(p.x), Math.round(p.y - jump));
    c.setScale(el < 34 ? 2 : 1);
    // the last 160 ms: blink out in steps (no alpha fade)
    c.setVisible(el < life - 160 || Math.floor((el - (life - 160)) / 40) % 2 === 1);
  };
  put(0);
  const stop = onFrame(sc, (_dt, el) => {
    if (!c.active) return false;
    put(el);
    return el < life;
  }, () => c.destroy());
  return { destroy: stop };
}

/** The graveyard pile answers the reach: a violet ring breathing over it (stepped), motes drifting up. */
export function pileStir(sc: Phaser.Scene, at: XY, depth: number, R: Rng): { destroy(): void } {
  const r = Raster.around(sc, at.x, at.y, 48, 30, depth);
  const sp = new Sparks(sc, depth + 0.1);
  let acc = 0;
  let alive = true;
  const stop = onFrame(sc, (dt, el) => {
    if (!alive) return false;
    const step = Math.floor(el / 90) % 4;
    const rx = 13 + [0, 1, 2, 1][step];
    r.draw((g) => {
      g.ring(at.x, at.y, rx, Math.round(rx * 0.5), step === 2 ? PAL.void3 : PAL.void2);
      for (let i = 0; i < 6; i++) {
        const a = el * 0.004 + (i / 6) * TAU;
        g.px(Math.round(at.x + Math.cos(a) * rx), Math.round(at.y + Math.sin(a) * rx * 0.5), PAL.void4);
      }
    });
    acc += dt;
    if (acc > 70) {
      acc = 0;
      sp.add({ x: at.x + (R() - 0.5) * 20, y: at.y - 2 + (R() - 0.5) * 6, vx: 0, vy: -22 - R() * 18, drag: 0.8, life: 360 + R() * 160, colors: [PAL.void4, PAL.void3, PAL.void2, PAL.void1], shape: 'px', fadeAt: 1, flicker: R() < 0.4 });
    }
    return true;
  }, () => {
    r.destroy();
    sp.release();
  });
  return {
    destroy() {
      alive = false;
      stop();
    },
  };
}

/** A knot catching light in the hollow: a stepped violet burst (rays) at `at`, and motes spat out of the hollow. */
export function knotFlare(sc: Phaser.Scene, at: XY, depth: number, R: Rng): void {
  const r = Raster.around(sc, at.x, at.y, 40, 40, depth);
  void animate(sc, 200, (_k, el) => {
    const step = Math.min(3, Math.floor(el / 50));
    r.draw((g) => {
      const L = [3, 6, 8, 9][step];
      for (let i = 0; i < 8; i++) {
        if (step > 1 && i % 2 === 1) continue;
        const a = (i / 8) * TAU;
        const x0 = at.x + Math.cos(a) * (L - 3);
        const y0 = at.y + Math.sin(a) * (L - 3);
        g.line(x0, y0, at.x + Math.cos(a) * L, at.y + Math.sin(a) * L, step === 0 ? PAL.void4 : step < 3 ? PAL.void3 : PAL.void2);
      }
      if (step < 2) g.disc(at.x, at.y, 2, step === 0 ? PAL.void4 : PAL.void3);
    });
  }).then(() => r.destroy());
  const sp = new Sparks(sc, depth + 0.1);
  for (let i = 0; i < 8; i++) {
    const a = R() * TAU;
    sp.add({ x: at.x, y: at.y, vx: Math.cos(a) * (30 + R() * 30), vy: Math.sin(a) * 20 - 25, drag: 2.5, life: 260 + R() * 140, colors: [PAL.void4, PAL.void3, PAL.void2], shape: i % 3 ? 'px' : 'plus', fadeAt: 1 });
  }
  sp.release();
}

// ================================================================ persistent status: knot lights + club sprouts

/** Knot spots in frame space relative to the hollow: burning knots in the bark BELOW the hollow (the rig's knotLight). */
const KNOT_SPOTS: readonly (readonly [number, number])[] = [[-5, 11], [2, 14]];

/**
 * The boosted state on the unit until the turn ends: `n` burning knots in the bark under the hollow (2×2 void4 with a
 * charred / void2 ring, breathing) and `n` glowing sprouts on the club (6–9 px stems with leaf pairs, a 3×3 violet bud
 * with a dithered halo, pulsing; pulse() kicks them, e.g. on each step), drawn on the frame the sprite shows (P1 / P2:
 * frame points). On the attack's release / contact frames the club head flares violet. Hidden while dying.
 */
export interface Boost {
  n: number;
  /** A pulse on the buds (contact: they flare white-violet for 2 frames). */
  flare(): void;
  /** A softer beat (each heavy step). */
  pulse(): void;
  /** Hide (the death owns the body now). */
  hidden: boolean;
  /** The world point of sprout i's bud (null when not drawn this frame). */
  bud(i: number): XY | null;
  destroy(): void;
}

export function boostAura(sc: Phaser.Scene, u: MonsterUnit, n0: number): Boost {
  const r = new Raster(sc, 0, 0, 640, 360, u.sprite.depth + 0.2);
  let flareT = -1;
  let pulseT = -1;
  let alive = true;
  const buds: (XY | null)[] = [null, null];
  const b: Boost = {
    n: n0,
    hidden: false,
    flare() {
      flareT = 0;
    },
    pulse() {
      pulseT = 0;
    },
    bud: (i) => buds[i] ?? null,
    destroy() {
      alive = false;
    },
  };
  onFrame(sc, (dt, el) => {
    if (!alive || u.retired || !u.sprite.active) return false;
    r.img.setDepth(u.sprite.depth + 0.2);
    if (flareT >= 0) flareT += dt;
    if (flareT > 140) flareT = -1;
    if (pulseT >= 0) pulseT += dt;
    if (pulseT > 160) pulseT = -1;
    const fi = u.frameInfo();
    const show = !b.hidden && u.sprite.visible && fi.anim !== 'death' && fi.anim !== 'summon';
    buds[0] = buds[1] = null;
    r.draw((g) => {
      if (!show) return;
      const c = liveFramePoint(u, 'core');
      const grip = liveFramePoint(u, 'grip');
      const head = liveFramePoint(u, 'staff');
      const n = Math.min(2, b.n);
      const hot = flareT >= 0;
      const beat = pulseT >= 0;
      // burning knots in the bark under the hollow
      if (c) {
        const br = Math.floor(el / 260) % 2;
        for (let i = 0; i < n; i++) {
          const [ox, oy] = KNOT_SPOTS[i];
          const w0 = rint(u.framePoint(c.x + ox, c.y + oy));
          const sx = u.flipX ? -1 : 1;
          for (const [dx, dy] of [[-1, 0], [2, 0], [0, -1], [1, -1], [-1, 1], [2, 1], [0, 2], [1, 2]] as const) g.px(w0.x + dx * sx, w0.y + dy, hot || beat ? PAL.void3 : (dx + dy) % 2 === 0 ? PAL.void2 : PAL.earth0);
          for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) g.px(w0.x + dx * sx, w0.y + dy, hot && dx + dy === 0 ? PAL.white : (br + i) % 2 === 0 && dx + dy === 2 ? PAL.void3 : PAL.void4);
        }
      }
      // sprouts on the club: along grip → head, stems up (screen), leaf pairs, a glowing violet bud each
      if (grip && head) {
        for (let i = 0; i < n; i++) {
          const t = 0.48 + i * 0.24;
          const fp = { x: Math.round(lerp(grip.x, head.x, t)), y: Math.round(lerp(grip.y, head.y, t)) };
          const base = rint(u.framePoint(fp.x, fp.y - 3));
          const h = 6 + i * 2;
          const sway = Math.round(Math.sin(el * 0.008 + i * 1.7) * 1.2);
          const top = { x: base.x + sway, y: base.y - h };
          // the stem (ink-edged 1 px leaf2 line, so it reads on the bark), two leaf pairs
          g.line(base.x + 1, base.y, top.x + 1, top.y + 1, PAL.ink);
          g.line(base.x, base.y, top.x, top.y + 1, PAL.leaf2);
          for (const [yy, len] of [[Math.round(h * 0.45), 2], [Math.round(h * 0.75), 3]] as const) {
            const ly = base.y - yy;
            const lx = base.x + Math.round(sway * (yy / h));
            g.rect(lx - len, ly, len, 1, PAL.leaf3);
            g.rect(lx - len, ly + 1, len, 1, PAL.leaf1);
            g.rect(lx + 1, ly - 1, len, 1, PAL.leaf2);
            g.rect(lx + 1, ly, len, 1, PAL.leaf1);
          }
          // the bud: a 3×3 violet diamond, white heart on the flare, a dithered halo that swells on a pulse
          const pulsing = Math.floor(el / 220 + i) % 3 === 0;
          const halo = hot ? 6 : beat ? 5 : pulsing ? 4 : 3;
          g.ring(top.x, top.y - 1, halo, halo, hot ? PAL.void4 : PAL.void2, hot ? 1 : 0.5);
          for (const [dx, dy] of [[0, -2], [-1, -1], [1, -1], [-1, 0], [1, 0], [0, 1]] as const) g.px(top.x + dx, top.y + dy - 1 + 1, PAL.void3);
          g.px(top.x, top.y - 1, hot ? PAL.white : PAL.void4);
          g.px(top.x, top.y, hot || beat ? PAL.white : pulsing ? PAL.void4 : PAL.void3);
          g.px(top.x - 1, top.y - 2, PAL.gold4);
          buds[i] = { x: top.x, y: top.y - 1 };
        }
      }
      // the club head flares violet on the attack's release / contact frames (a stepped ring + sparks round it)
      if (head && n > 0 && fi.anim === 'attack') {
        const rel = u.markFrame('attack', 'release', 5);
        const con = u.markFrame('attack', 'contact', rel + 1);
        if (fi.frame >= rel && fi.frame <= con + 1) {
          const hp = rint(u.framePoint(head.x, head.y));
          const k = Math.floor(el / 40) % 2;
          g.ring(hp.x, hp.y, 8 + k, 6 + k, PAL.void3);
          g.ring(hp.x, hp.y, 10 + k, 8 + k, PAL.void2, 0.5);
          for (let i = 0; i < 6; i++) {
            const a = el * 0.02 + (i / 6) * TAU;
            g.px(Math.round(hp.x + Math.cos(a) * (9 + k)), Math.round(hp.y + Math.sin(a) * (7 + k)), i % 2 ? PAL.void4 : PAL.white);
          }
        }
      }
    });
    return true;
  }, () => r.destroy());
  return b;
}

/**
 * The violet POLLEN burst off the club's sprouts on contact: 64 motes in two sizes thrown out and drifting UP, a slow
 * cloud of puffs that hangs ≈ 0.6 s over the hit, one stepped ring, and a violet light pool under it.
 */
export function pollen(sc: Phaser.Scene, at: XY, n: number, R: Rng, depth: number, floorY?: number): void {
  const sp = new Sparks(sc, depth);
  for (let i = 0; i < n; i++) {
    const a = R() * TAU;
    const v = 40 + R() * 80;
    const big = i % 3 === 0;
    sp.add({ x: at.x + (R() - 0.5) * 6, y: at.y + (R() - 0.5) * 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 40, drag: 3, ay: -26, life: 520 + R() * 420, delay: Math.floor(R() * 60), colors: i % 5 === 0 ? [PAL.white, PAL.gold4, PAL.void4, PAL.void3, PAL.void2] : [PAL.void4, PAL.void3, PAL.void2, PAL.void1], shape: big ? 'sq' : i % 4 === 0 ? 'plus' : 'px', size: big ? 2 : 1, fadeAt: 1, flicker: i % 3 === 1 });
  }
  // the hanging cloud: puffs drift up slowly after the hit-stop
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU + R() * 0.4;
    sp.add({ x: at.x + Math.cos(a) * 9, y: at.y + Math.sin(a) * 4 - 2, vx: Math.cos(a) * 16, vy: -10 - R() * 12, drag: 1.1, ay: -8, life: 820 + R() * 380, delay: 40 + Math.floor(R() * 120), colors: [PAL.void4, PAL.void3, PAL.void3, PAL.void2], shape: 'puff', size: i % 2 ? 2 : 1.5, fadeAt: 1, flicker: i % 2 === 0 });
  }
  sp.release();
  // the burst's ring: one stepped violet ring (≤ 1 ring)
  const r = Raster.around(sc, at.x, at.y, 70, 50, depth + 0.1);
  void animate(sc, 220, (_k, el) => {
    const step = Math.min(3, Math.floor(el / 55));
    const rad = [6, 12, 17, 20][step];
    r.draw((g) => g.ring(at.x, at.y, rad, Math.round(rad * 0.7), [PAL.white, PAL.void4, PAL.void3, PAL.void2][step], step === 3 ? 0.5 : 1));
  }).then(() => r.destroy());
  const lp = lightPool(sc, at.x, at.y, { color: PAL.void3, spill: PAL.void2, radius: 26, floorY: floorY ?? at.y + 6, air: 0.9, intensity: 1.2, anim: 'breathe', fadeIn: 0 });
  void animate(sc, 600, () => undefined).then(() => lp.fadeOut(240));
}

// ================================================================ the direct attack: the ground rupture

/**
 * A rupture running along the floor from `from` to `to`: a 2-px ink crack with pale heartwood lips, loam and leaf
 * spurts every few px behind its head; at the end three roots ERUPT out of the floor under the duelist.
 */
export async function rupture(sc: Phaser.Scene, from: XY, to: XY, ms: number, R: Rng): Promise<void> {
  const r = new Raster(sc, 0, 0, 640, 360, DEPTH.SHADOW + 0.6);
  const sp = new Sparks(sc, DEPTH.FX);
  const pts: XY[] = [];
  const n = Math.max(6, Math.round(Math.hypot(to.x - from.x, to.y - from.y) / 4));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const j = i === 0 || i === n ? 0 : (R() - 0.5) * 6;
    pts.push(rint({ x: lerp(from.x, to.x, t) + j * 0.3, y: lerp(from.y, to.y, t) + j * 0.5 }));
  }
  const crack = (g: Raster, upto: number, fade = 0) => {
    for (let i = 1; i <= upto; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (fade > 0 && i / pts.length < fade) {
        g.line(a.x, a.y, b.x, b.y, PAL.earth0);
        continue;
      }
      g.line(a.x, a.y - 1, b.x, b.y - 1, PAL.earth4);
      g.line(a.x, a.y + 2, b.x, b.y + 2, PAL.earth2);
      g.line(a.x, a.y, b.x, b.y, PAL.ink, 1, 2);
    }
  };
  let lastI = 0;
  await animate(sc, ms, (k) => {
    const head = Math.min(n, Math.round(k * k * n));
    for (let i = lastI + 1; i <= head; i++) {
      const p = pts[i];
      if (i % 2) continue;
      for (let q = 0; q < 3; q++) sp.add({ x: p.x, y: p.y, vx: (R() - 0.5) * 46, vy: -70 - R() * 60, ay: 380, floor: p.y + 1, bounce: 0.2, life: 280 + R() * 180, colors: q === 2 ? [PAL.leaf2, PAL.leaf1, PAL.earth1] : q ? [PAL.earth4, PAL.earth3, PAL.earth2] : [PAL.earth3, PAL.earth2, PAL.earth1], shape: q === 1 ? 'sq' : 'px', size: q === 1 ? 2 : 1, fadeAt: 1 });
    }
    lastI = head;
    r.draw((g) => crack(g, head));
  });
  sp.release();
  // the roots erupt under the duelist
  const roots = [-9, -2, 6].map((dx, i) => ({ x: to.x + dx, h: [15, 21, 12][i], lean: dx * 0.3 }));
  void animate(sc, 420, (k, el) => {
    const up = k < 0.35 ? k / 0.35 : k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    r.draw((g) => {
      crack(g, n, k);
      for (const ro of roots) {
        const h = Math.round(ro.h * up);
        if (h < 1) continue;
        for (let y = 0; y < h; y++) {
          const t = y / ro.h;
          const x = Math.round(ro.x + ro.lean * t * 6 + Math.sin(t * 5 + el * 0.02) * 1);
          const yy = to.y - y;
          g.px(x - 1, yy, PAL.ink);
          g.px(x + 2, yy, PAL.ink);
          g.px(x, yy, t > 0.8 ? PAL.earth4 : PAL.earth3);
          g.px(x + 1, yy, PAL.earth1);
        }
        const tx = Math.round(ro.x + ro.lean * (h / ro.h) * 6);
        g.px(tx, to.y - h, PAL.ink);
        g.px(tx + 1, to.y - h, PAL.ink);
      }
    });
  }).then(() => r.destroy());
}

// ================================================================ death: the roots snake back into the tile

/**
 * Root strands slithering from the body's base into the tile: each strand runs out along the floor in a wavy line and
 * digs into a dark hole at its end, then it is pulled in from the body side (shortening toward the hole) — a slow
 * reverse of a root growing. `k` 0..1 drives it (0 out, 0.4 dug in, 1 gone).
 */
export function rootsIntoTile(sc: Phaser.Scene, at: XY, n: number, R: Rng, depth: number): { set(k: number): void; destroy(): void } {
  const r = Raster.around(sc, at.x, at.y, 120, 56, depth);
  const strands: { a: number; L: number; ph: number; dug: boolean }[] = [];
  for (let i = 0; i < n; i++) strands.push({ a: (i / n) * TAU + R() * 0.5, L: 22 + R() * 12, ph: R() * TAU, dug: false });
  const dust = new Sparks(sc, DEPTH.FX - 1);
  return {
    set(k) {
      r.draw((g) => {
        for (const s of strands) {
          const out = Math.min(1, k / 0.4);
          const pull = k <= 0.5 ? 0 : (k - 0.5) / 0.5;
          const end = { x: at.x + Math.cos(s.a) * s.L, y: at.y + Math.sin(s.a) * s.L * 0.42 };
          const N = 14;
          const pts: XY[] = [];
          for (let i = 0; i <= N; i++) {
            const t = (i / N) * out;
            const w = Math.sin(t * 8 + s.ph + k * 10) * 2 * (1 - t * 0.6);
            const nx = -Math.sin(s.a);
            const ny = Math.cos(s.a) * 0.42;
            pts.push(rint({ x: lerp(at.x, end.x, t) + nx * w, y: lerp(at.y - 2, end.y, t) + ny * w }));
          }
          // it digs in: a dust puff at the end the first time it gets there
          if (out >= 1 && !s.dug) {
            s.dug = true;
            for (let q = 0; q < 3; q++) dust.add({ x: end.x, y: end.y, vx: (R() - 0.5) * 30, vy: -12 - R() * 14, drag: 4, life: 260 + R() * 120, colors: [PAL.earth3, PAL.earth2, PAL.earth1], shape: 'puff', size: 1.5, fadeAt: 1 });
          }
          // the hole at the strand's end (dark loam), open while the root is in it
          if (out > 0.6 && k < 0.95) {
            g.px(end.x - 1, end.y, PAL.ink);
            g.px(end.x, end.y, PAL.ink);
            g.px(end.x + 1, end.y, PAL.earth0);
            g.px(end.x, end.y + 1, PAL.earth1);
          }
          // the strand is pulled in toward the hole: its body end shortens first
          const from = Math.floor(pull * N);
          const seg = pts.slice(Math.max(0, from));
          for (const q of seg) {
            g.px(q.x, q.y - 1, PAL.ink);
            g.px(q.x + 1, q.y - 1, PAL.ink);
            g.px(q.x, q.y + 2, PAL.ink);
            g.px(q.x + 1, q.y + 2, PAL.ink);
          }
          seg.forEach((q, i) => {
            g.px(q.x, q.y, i % 4 === 0 ? PAL.earth2 : PAL.earth3);
            g.px(q.x + 1, q.y, PAL.earth2);
            g.px(q.x, q.y + 1, PAL.earth1);
            g.px(q.x + 1, q.y + 1, PAL.earth1);
          });
        }
      });
    },
    destroy: () => {
      dust.release();
      r.destroy();
    },
  };
}

/** Dust drawn INWARD (the trunk caving in): puffs start round the body and are pulled to its centre. */
export function caveIn(sc: Phaser.Scene, at: XY, R: Rng): void {
  const sp = new Sparks(sc, DEPTH.FX - 1);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    sp.add({ x: at.x + Math.cos(a) * 18, y: at.y + Math.sin(a) * 8, tx: at.x + (R() - 0.5) * 3, ty: at.y - 2, life: 240 + R() * 80, colors: [PAL.earth2, PAL.earth1, PAL.earth0], shape: 'puff', size: 1.5, fadeAt: 1 });
  }
  sp.release();
}

/** The last 150 ms: the body (the wilted sprout) goes out in `steps` bayer steps, a few violet/leaf flecks lifting off. */
export function knockOut(sc: Phaser.Scene, u: MonsterUnit, ms = 150, steps = 4): Promise<void> {
  const s = u.sprite;
  const fp = s.active ? framePixels(s) : null;
  if (!fp) return Promise.resolve();
  const w = s.frame.realWidth;
  const h = s.frame.realHeight;
  const flip = s.flipX;
  const o = u.framePoint(flip ? w : 0, 0);
  const r = new Raster(sc, Math.round(o.x), Math.round(o.y), fp.w, fp.h, s.depth);
  s.setVisible(false);
  return new Promise<void>((resolve) => {
    let k = -1;
    onFrame(sc, (_dt, el) => {
      const step = Math.min(steps, Math.floor((el / ms) * steps));
      if (step === k) return el < ms;
      k = step;
      const lvl = step / steps;
      const prev = (step - 1) / steps;
      r.draw((g) => {
        for (let y = 0; y < fp.h; y++)
          for (let x = 0; x < fp.w; x++) {
            const i = (y * fp.w + x) * 4;
            if (fp.data[i + 3] === 0) continue;
            const lx = flip ? fp.w - 1 - x : x;
            const b = bayer(lx, y) * 0.85 + (1 - y / fp.h) * 0.15;
            if (b < lvl) {
              if (b >= prev && (lx + y) % 4 === 0) g.pc.set(lx, y - 1, PAL.leaf1);
              continue;
            }
            g.pc.set(lx, y, (fp.data[i] << 16) | (fp.data[i + 1] << 8) | fp.data[i + 2]);
          }
      });
      return el < ms;
    }, () => {
      r.destroy();
      resolve();
    });
  });
}

/** One leaf detaching from the wilted sprout and drifting down, rocking (≈ 520 ms, runs on its own). */
export function lastLeaf(sc: Phaser.Scene, at: XY, floorY: number, dir: 1 | -1): void {
  const r = Raster.around(sc, at.x, at.y + 6, 40, 30, DEPTH.FX);
  void animate(sc, 520, (k, el) => {
    const x = Math.round(at.x + dir * k * 7 + Math.sin(el * 0.02) * 2);
    const y = Math.round(Math.min(floorY, at.y + k * (floorY - at.y)));
    const tilt = Math.floor(el / 90) % 2;
    r.draw((g) => {
      g.px(x, y, k < 0.6 ? PAL.leaf2 : PAL.leaf1);
      g.px(x + (tilt ? 1 : -1), y + (tilt ? 0 : 1), k < 0.6 ? PAL.leaf1 : PAL.earth2);
    });
  }).then(() => r.destroy());
}



