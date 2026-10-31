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
      if (k > 0.6) drawSeed(g, seedAt, k > 0.85 ? 2 : 1);
    });
  });
  r.destroy();
}

/** The light seed itself: a violet drop (void3 rim, void4 heart, a gold4 core on size 2). */
export function drawSeed(g: Raster, at: XY, size: 1 | 2 = 2): void {
  const { x, y } = rint(at);
  if (size === 1) {
    g.px(x, y, PAL.void4);
    g.px(x, y - 1, PAL.void3);
    g.px(x - 1, y, PAL.void3);
    g.px(x + 1, y, PAL.void3);
    g.px(x, y + 1, PAL.void3);
    return;
  }
  for (const [dx, dy] of [[0, -2], [-1, -1], [1, -1], [-1, 0], [1, 0], [0, 1]] as const) g.px(x + dx, y + dy, PAL.void3);
  g.px(x, y - 1, PAL.void4);
  g.px(x, y, PAL.gold4);
}

/**
 * The seed's arc from the graveyard onto the root tip (`to()` is live: the tendril moves): a parabola `lift` px high,
 * a stepped trail and a few sparks shed along the way. Resolves on arrival.
 */
export async function seedFlight(sc: Phaser.Scene, from: XY, to: () => XY, ms: number, lift: number, depth: number, R: Rng): Promise<void> {
  const r = new Raster(sc, 0, 0, 640, 360, depth);
  const sp = new Sparks(sc, depth - 0.1);
  const light = lightPool(sc, from.x, from.y, { color: PAL.void3, spill: PAL.void2, radius: 10, floorY: from.y + 14, air: 0.9, intensity: 0.8, anim: 'flicker', fadeIn: 40 });
  const path = (k: number, t: XY): XY => {
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    return { x: lerp(from.x, t.x, e), y: lerp(from.y, t.y, e) - Math.sin(Math.PI * e) * lift };
  };
  let shed = 0;
  await animate(sc, ms, (k, el, dt) => {
    const t = to();
    const p = rint(path(k, t));
    light.setPosition(p.x, p.y, lerp(from.y + 14, t.y + 30, k));
    shed += dt;
    if (shed > 30) {
      shed = 0;
      sp.add({ x: p.x, y: p.y, vx: (R() - 0.5) * 16, vy: 8 + R() * 12, drag: 2, life: 200 + R() * 140, colors: [PAL.void4, PAL.void3, PAL.void2, PAL.void1], shape: 'px', fadeAt: 1, flicker: R() < 0.5 });
    }
    r.draw((g) => {
      // the trail: beads back along the arc (every ≈ 4 px of path), dimmer as they age — never a straight streak
      let prev = p;
      for (let j = 1; j <= 7; j++) {
        const q = rint(path(Math.max(0, k - j * 0.035), t));
        if (Math.abs(q.x - prev.x) + Math.abs(q.y - prev.y) < 3 && j > 1) continue;
        g.px(q.x, q.y, j < 3 ? PAL.void4 : j < 5 ? PAL.void3 : PAL.void2);
        if (j < 3) g.px(q.x, q.y + 1, PAL.void2);
        prev = q;
      }
      // the halo (a dithered void2 ring that turns), the seed, one turning glint
      g.ring(p.x, p.y - 1, 4, 4, PAL.void2, 0.5);
      drawSeed(g, p, 2);
      const a = el * 0.02;
      g.px(Math.round(p.x + Math.cos(a) * 3), Math.round(p.y - 1 + Math.sin(a) * 3), PAL.void4);
    });
  });
  void light.fadeOut(120);
  r.destroy();
  sp.release();
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

/** Knot spots in frame space relative to the hollow (the rig's knotLight: 2×2 each). */
const KNOT_SPOTS: readonly (readonly [number, number])[] = [[-2, 2], [1, 3]];

/**
 * The boosted state on the unit until the turn ends: `n` knot lights in the hollow (breathing between void4 and
 * void3, a 1-px ring) and `n` glowing sprouts on the club (stems in leaf tones, violet buds that blink), drawn on the
 * frame the sprite shows (P1 / P2: frame points). Hidden while the unit is dying / not visible.
 */
export interface Boost {
  n: number;
  /** A pulse on the buds (contact: they flare white-violet for 2 frames). */
  flare(): void;
  /** Hide (the death owns the body now). */
  hidden: boolean;
  destroy(): void;
}

export function boostAura(sc: Phaser.Scene, u: MonsterUnit, n0: number): Boost {
  const r = new Raster(sc, 0, 0, 640, 360, u.sprite.depth + 0.2);
  let flareT = -1;
  let alive = true;
  const b: Boost = {
    n: n0,
    hidden: false,
    flare() {
      flareT = 0;
    },
    destroy() {
      alive = false;
    },
  };
  onFrame(sc, (dt, el) => {
    if (!alive || u.retired || !u.sprite.active) return false;
    r.img.setDepth(u.sprite.depth + 0.2);
    if (flareT >= 0) flareT += dt;
    if (flareT > 120) flareT = -1;
    const fi = u.frameInfo();
    const show = !b.hidden && u.sprite.visible && fi.anim !== 'death' && fi.anim !== 'summon';
    r.draw((g) => {
      if (!show) return;
      const c = liveFramePoint(u, 'core');
      const grip = liveFramePoint(u, 'grip');
      const head = liveFramePoint(u, 'staff');
      const n = Math.min(2, b.n);
      // knot lights (the sprite paints them itself on special frames: drawing over is the same pixels)
      if (c) {
        const beat = Math.floor(el / 260) % 2;
        for (let i = 0; i < n; i++) {
          const [ox, oy] = KNOT_SPOTS[i];
          for (let dy = 0; dy < 2; dy++)
            for (let dx = 0; dx < 2; dx++) {
              const w = u.framePoint(c.x + ox + dx, c.y + oy + dy);
              g.px(w.x, w.y, (beat + i) % 2 === 0 && dx === 0 && dy === 0 ? PAL.void4 : dx + dy === 2 ? PAL.void3 : PAL.void4);
            }
        }
      }
      // sprouts on the club: along grip → head, stems up (screen), violet buds
      if (grip && head) {
        for (let i = 0; i < n; i++) {
          const t = 0.5 + i * 0.2;
          const fp = { x: Math.round(lerp(grip.x, head.x, t)), y: Math.round(lerp(grip.y, head.y, t)) };
          const base = u.framePoint(fp.x, fp.y - 2);
          const bx = Math.round(base.x);
          const by = Math.round(base.y);
          const h = 3 + i;
          const sway = Math.round(Math.sin(el * 0.008 + i * 1.7));
          g.line(bx, by, bx + sway, by - h, PAL.leaf2);
          g.px(bx + sway - 1, by - h + 1, PAL.leaf3);
          g.px(bx + sway + 1, by - h + 2, PAL.leaf1);
          const hot = flareT >= 0;
          const blink = Math.floor(el / 200 + i) % 3 === 0;
          g.px(bx + sway, by - h - 1, hot ? PAL.white : blink ? PAL.void4 : PAL.void3);
          if (hot || blink) {
            g.px(bx + sway - 1, by - h - 1, PAL.void2);
            g.px(bx + sway + 1, by - h - 1, PAL.void2);
            g.px(bx + sway, by - h - 2, PAL.void2);
          }
        }
      }
    });
    return true;
  }, () => r.destroy());
  return b;
}

/** Violet pollen burst off the club's sprouts on contact (floats up, drifts, blinks out). */
export function pollen(sc: Phaser.Scene, at: XY, n: number, R: Rng, depth: number): void {
  const sp = new Sparks(sc, depth);
  for (let i = 0; i < n; i++) {
    const a = R() * TAU;
    const v = 30 + R() * 60;
    sp.add({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 30, drag: 3.2, ay: -18, life: 420 + R() * 300, delay: Math.floor(R() * 40), colors: i % 4 === 0 ? [PAL.gold4, PAL.void4, PAL.void3, PAL.void2] : [PAL.void4, PAL.void3, PAL.void2, PAL.void1], shape: i % 5 === 0 ? 'plus' : 'px', fadeAt: 1, flicker: i % 3 === 0 });
  }
  sp.release();
  // the burst's ring: one stepped violet ring (≤ 1 ring)
  const r = Raster.around(sc, at.x, at.y, 50, 40, depth + 0.1);
  void animate(sc, 160, (_k, el) => {
    const step = Math.min(2, Math.floor(el / 55));
    const rad = [5, 9, 12][step];
    r.draw((g) => g.ring(at.x, at.y, rad, Math.round(rad * 0.75), [PAL.void4, PAL.void3, PAL.void2][step], step === 2 ? 0.5 : 1));
  }).then(() => r.destroy());
}

// ================================================================ the direct attack: the ground rupture

/** A rupture running along the floor from `from` to `to` (a crack line with loam spurting up behind its head). */
export async function rupture(sc: Phaser.Scene, from: XY, to: XY, ms: number, R: Rng): Promise<void> {
  const r = new Raster(sc, 0, 0, 640, 360, DEPTH.SHADOW + 0.6);
  const sp = new Sparks(sc, DEPTH.FX);
  const pts: XY[] = [];
  const n = Math.max(4, Math.round(Math.hypot(to.x - from.x, to.y - from.y) / 6));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const j = i === 0 || i === n ? 0 : (R() - 0.5) * 5;
    pts.push(rint({ x: lerp(from.x, to.x, t) + j * 0.4, y: lerp(from.y, to.y, t) + j * 0.5 }));
  }
  let lastI = 0;
  await animate(sc, ms, (k) => {
    const head = Math.min(n, Math.round(k * k * n));
    for (let i = lastI + 1; i <= head; i++) {
      const p = pts[i];
      for (let q = 0; q < 2; q++) sp.add({ x: p.x, y: p.y, vx: (R() - 0.5) * 40, vy: -60 - R() * 50, ay: 360, floor: p.y + 1, bounce: 0.2, life: 260 + R() * 160, colors: q ? [PAL.earth3, PAL.earth2, PAL.earth1] : [PAL.leaf2, PAL.leaf1, PAL.earth1], shape: 'px', fadeAt: 1 });
    }
    lastI = head;
    r.draw((g) => {
      for (let i = 1; i <= head; i++) {
        g.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, PAL.ink);
        g.px(pts[i].x, pts[i].y - 1, PAL.earth1);
      }
    });
  });
  sp.release();
  void animate(sc, 240, (k) => r.draw((g) => {
    for (let i = 1; i < pts.length; i++) g.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, i / pts.length < k ? PAL.earth0 : PAL.ink, 1 - k * 0.8);
  })).then(() => r.destroy());
}

// ================================================================ death: the roots snake back into the tile

/**
 * Root strands slithering from the body's base into the tile: each strand runs out along the floor in a wavy line and
 * digs into a dark hole at its end, then it is pulled in from the body side (shortening toward the hole) — a slow
 * reverse of a root growing. `k` 0..1 drives it (0 out, 0.4 dug in, 1 gone).
 */
export function rootsIntoTile(sc: Phaser.Scene, at: XY, n: number, R: Rng, depth: number): { set(k: number): void; destroy(): void } {
  const r = Raster.around(sc, at.x, at.y, 110, 50, depth);
  const strands: { a: number; L: number; ph: number }[] = [];
  for (let i = 0; i < n; i++) strands.push({ a: (i / n) * TAU + R() * 0.6, L: 14 + R() * 12, ph: R() * TAU });
  return {
    set(k) {
      r.draw((g) => {
        for (const s of strands) {
          const out = Math.min(1, k / 0.35);
          const pull = k <= 0.45 ? 0 : (k - 0.45) / 0.55;
          const end = { x: at.x + Math.cos(s.a) * s.L, y: at.y + Math.sin(s.a) * s.L * 0.42 };
          const N = 10;
          const pts: XY[] = [];
          for (let i = 0; i <= N; i++) {
            const t = (i / N) * out;
            const w = Math.sin(t * 7 + s.ph + k * 9) * 1.6 * (1 - t);
            const nx = -Math.sin(s.a);
            const ny = Math.cos(s.a) * 0.42;
            pts.push(rint({ x: lerp(at.x, end.x, t) + nx * w, y: lerp(at.y - 3, end.y, t) + ny * w }));
          }
          // the hole at the strand's end (dark loam), growing then closing
          const hole = k < 0.9 ? 1 : 0;
          if (out > 0.6 && hole) {
            g.px(end.x, end.y, PAL.ink);
            g.px(end.x + 1, end.y, PAL.earth0);
          }
          const from = Math.floor(pull * N);
          for (let i = Math.max(1, from + 1); i < pts.length; i++) {
            const c = i % 3 === 0 ? PAL.earth1 : PAL.earth2;
            g.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, c);
            g.px(pts[i].x, pts[i].y + 1, PAL.earth0);
          }
        }
      });
    },
    destroy: () => r.destroy(),
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



