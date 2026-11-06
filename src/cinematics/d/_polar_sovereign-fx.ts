// Kutup Hükümdarı (polar_sovereign, lane D) — the pixel set pieces of its cinematics (side-effect free: the `_`
// file is loaded by the cinematics glob but registers nothing). All drawn into Rasters (1 art px = 1 game px,
// whole-px positions, palette tones only, stepped — no alpha fades, no scaling, EF-6 / EF-7).
//
//   dustRose      the fusion's iron-dust compass rose drawn across the three zones (8 rays, N ray fire, S ray water,
//                 a dial ring through the farthest piece), grains appearing along the rays, shimmering, then shaken off
//   dustShock     the landing's iron-dust shock ring rushing out over the floor (fire behind, water in front)
//   spearShot     the thrown compass spear (the needle kit's own needle, outlined) flying point first
//   targetRose    "Pusula Fırtınası": two-colour field lines closing round the target as a compass rose
//   poleBlast     the contact: a pole blast at the rose's heart and the iron rain falling out of it
//   splitStreaks  the split: three two-colour streaks flung from the body toward the three landing zones
//   flingPieces   the split: the three PIECES themselves (their folded frames) flung apart on two-colour trails,
//                 caught by the field over their landing zones and hanging there, bobbing, until each drops
//   landPuff      a piece lands in its zone: a small iron-dust ring and two pole sparks

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { lightOf } from '../../art/rigkit';
import { needle } from '../../art/monsters-v3/polar_needle-kit';
import { monsterArt } from '../../art/monsters';
import { monsterFrame } from '../../art/textures';
import type { AnyMonsterAnim } from '../../art/types';
import type { MonsterId } from '../../data/cards';
import { DEPTH, type XY } from '../../view/layout';
import { Raster, run } from '../../vfx/setpieces';

const rnd = Math.round;
const TAU = Math.PI * 2;

let SEED = 1;
export function seedFx(n: number): void {
  SEED = (n | 0) || 1;
}
function rand(): number {
  SEED = (Math.imul(SEED ^ (SEED >>> 15), 2246822507) + 0x9e3779b9) | 0;
  return ((SEED >>> 0) % 100000) / 100000;
}
const hash = (a: number, b: number): number => {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ================================================================ the fusion's iron-dust rose

export interface DustRose {
  /** draw-in progress 0…1 (grains appear ray by ray from the centre out) */
  draw(ms: number): Promise<void>;
  /** the grains lean toward the centre (they are being pulled in) — 0…1 */
  pull(k: number): void;
  /** shake the grains off (they scatter and vanish, ms) */
  dismiss(ms: number): Promise<void>;
  destroy(): void;
}

/** The compass rose of iron dust on the floor round `c` (floor point), reaching `reach` px (iso: y × 0.5). */
export function dustRose(scene: Phaser.Scene, c: XY, reach: number): DustRose {
  const W = rnd(reach * 2 + 24);
  const H = rnd(reach + 24);
  const r = Raster.around(scene, c.x, c.y, W, H, DEPTH.TILE_FX + 2);
  interface Grain { x: number; y: number; u: number; col: number; k: number }
  const grains: Grain[] = [];
  // eight rays (N up-left on the iso floor = the back; the rays alternate long / short), a dial ring, tick marks
  for (let k = 0; k < 8; k++) {
    const a = -Math.PI / 2 + (k * TAU) / 8;
    const len = k % 2 ? reach * 0.62 : reach;
    const n = rnd(len / 2);
    for (let i = 3; i < n; i++) {
      const d = (i / n) * len;
      const w = Math.max(0, rnd((1 - i / n) * 3));
      for (let j = -w; j <= w; j++) {
        const x = c.x + Math.cos(a) * d - Math.sin(a) * j;
        const y = c.y + (Math.sin(a) * d + Math.cos(a) * j) * 0.5;
        // the N ray (k 0: up = toward the back of the board) fire, the S ray (k 4) water, the rest iron
        const pole = k === 0 ? 1 : k === 4 ? 2 : 0;
        const tipHot = i > n * 0.7;
        const col = pole === 1 ? (tipHot ? PAL.fire4 : PAL.fire2) : pole === 2 ? (tipHot ? PAL.water4 : PAL.water2) : hash(i, k * 7 + j) < 0.3 ? PAL.mist : hash(i, k + j * 3) < 0.6 ? PAL.steel : PAL.stone3;
        grains.push({ x: rnd(x), y: rnd(y), u: i / n, col, k });
      }
    }
  }
  for (const R of [reach * 0.94, reach * 0.48]) {
    const n = rnd(R * 3);
    for (let i = 0; i < n; i++) {
      if (i % 4 === 3) continue;
      const a = (i / n) * TAU;
      grains.push({ x: rnd(c.x + Math.cos(a) * R), y: rnd(c.y + Math.sin(a) * R * 0.5), u: 0.5 + (R / reach) * 0.5, col: i % 9 === 0 ? PAL.gold4 : Math.sin(a) > 0 ? PAL.steel : PAL.stone3, k: -1 });
    }
  }
  let shown = 0;
  let pullK = 0;
  let gone = 0;
  let tick = 0;
  const paint = () =>
    r.draw((rr) => {
      for (let i = 0; i < grains.length; i++) {
        const g = grains[i];
        if (g.u > shown) continue;
        if (gone > 0 && hash(i, 91) < gone) continue;
        // pulled: grains slide toward the centre by whole px
        const dx = rnd((c.x - g.x) * pullK * 0.25);
        const dy = rnd((c.y - g.y) * pullK * 0.25);
        // shimmer: a few grains flash bright on the beat
        const flash = (i + tick) % 23 === 0;
        rr.px(g.x + dx, g.y + dy, flash ? PAL.white : g.col);
        // a grain is 2 px wide (reads at 1×)
        if (g.k >= 0) rr.px(g.x + dx + 1, g.y + dy, g.col === PAL.mist ? PAL.steel : g.col);
      }
    });
  let alive = true;
  return {
    async draw(ms) {
      await run(scene, ms, (t) => {
        shown = t;
        tick = Math.floor(t * 12);
        paint();
      });
      shown = 1;
      paint();
    },
    pull(k) {
      pullK = k;
      tick++;
      if (alive) paint();
    },
    async dismiss(ms) {
      await run(scene, ms, (t) => {
        gone = t;
        if (alive) paint();
      });
      this.destroy();
    },
    destroy() {
      alive = false;
      r.destroy();
    },
  };
}

// ================================================================ landing shock ring

/** An iron-dust shock ring rushing out over the floor from `c` (ms), grains thrown inside it. */
export function dustShock(scene: Phaser.Scene, c: XY, reach: number, ms: number): Promise<void> {
  const r = Raster.around(scene, c.x, c.y, rnd(reach * 2 + 16), rnd(reach + 16), DEPTH.TILE_FX + 3);
  return run(scene, ms, (t) => {
    const e = 1 - (1 - t) * (1 - t);
    r.draw((rr) => {
      const R = 8 + e * reach;
      const n = rnd(R * 4);
      for (let i = 0; i < n; i++) {
        if (i % 5 === 4) continue;
        const a = (i / n) * TAU;
        const back = Math.cos(a) < 0;
        const front = Math.sin(a) > 0;
        const col = t < 0.35 ? (front ? PAL.white : back ? PAL.fire4 : PAL.water4) : t < 0.7 ? (back ? PAL.fire3 : PAL.water3) : back ? PAL.fire1 : PAL.water1;
        rr.px(c.x + Math.cos(a) * R, c.y + Math.sin(a) * R * 0.45, col);
        if (t < 0.6 && i % 7 === 0) rr.px(c.x + Math.cos(a) * R * 0.78, c.y + Math.sin(a) * R * 0.45 * 0.78 - 1, PAL.stone4);
      }
    });
  }).then(() => r.destroy());
}

// ================================================================ the thrown spear

/** The compass spear as a pixel sprite pointing along `d` (unit), its centre at the canvas centre. */
export function spearCanvas(d: XY, flipLight: boolean): PixelCanvas {
  const q = new PixelCanvas(72, 48);
  needle(q, { c: [36, 24], d: [d.x, d.y], lenN: 30, lenS: 24, hw: 3, band: 3, collar: true }, lightOf(flipLight ? 'right' : 'left'));
  q.outline(PAL.ink);
  // the hot N point (light, never outlined)
  const tx = rnd(36 + d.x * 28);
  const ty = rnd(24 + d.y * 28);
  q.set(tx, ty, PAL.white);
  return q;
}

/** Fly the spear from `a` to `b` (its centre), point first, with a two-colour wake; resolves on arrival. */
export function spearShot(scene: Phaser.Scene, a: XY, b: XY, ms: number, depth: number, o: { back?: boolean } = {}): Promise<void> {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  // flying home (the recall), the spear comes back butt first: it keeps pointing at the foe
  const dir: XY = o.back ? { x: -dx / l, y: -dy / l } : { x: dx / l, y: dy / l };
  const sp = spearCanvas(dir, dir.x < 0);
  const r = new Raster(scene, a.x - 36, a.y - 24, 72, 48, depth);
  r.draw((rr) => rr.pc.blit(sp, 0, 0));
  const wake = Raster.around(scene, (a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(dx) + 80, Math.abs(dy) + 60, depth - 0.2);
  return run(scene, ms, (t) => {
    const e = o.back ? t * t : t < 1 ? 1 - Math.pow(1 - t, 1.6) : 1;
    const x = rnd(a.x + dx * e);
    const y = rnd(a.y + dy * e);
    r.moveTo(x - 36, y - 24);
    wake.draw((rr) => {
      const n = 16;
      for (let i = 1; i <= n; i++) {
        const k = e - (i / n) * 0.35;
        if (k <= 0) break;
        const wx = a.x + dx * k;
        const wy = a.y + dy * k;
        const nx = -dir.y * 2;
        const ny = dir.x * 2;
        rr.px(wx + nx, wy + ny, i < n / 2 ? PAL.fire4 : PAL.fire2);
        rr.px(wx - nx, wy - ny, i < n / 2 ? PAL.water4 : PAL.water2);
      }
    });
  }).then(() => {
    r.destroy();
    wake.destroy();
  });
}

/** The spear stuck in the target after the pierce (point buried: drawn 5 px short of `at` along its flight),
 *  quivering 1 px across its line for the first beats, until the returned stop() (the recall pulls it out). */
export function spearStuck(scene: Phaser.Scene, from: XY, at: XY, depth: number): { stop(): void } {
  const dx = at.x - from.x;
  const dy = at.y - from.y;
  const l = Math.hypot(dx, dy) || 1;
  const dir: XY = { x: dx / l, y: dy / l };
  const sp = spearCanvas(dir, dir.x < 0);
  const bx = rnd(at.x - dir.x * 5);
  const by = rnd(at.y - dir.y * 5);
  const r = new Raster(scene, bx - 36, by - 24, 72, 48, depth);
  r.draw((rr) => rr.pc.blit(sp, 0, 0));
  let alive = true;
  void run(scene, 1200, (_t, el) => {
    if (!alive) return;
    const q = el < 360 ? (Math.floor(el / 45) % 2 ? 1 : -1) : 0;
    r.moveTo(bx - 36 + rnd(-dir.y * q), by - 24 + rnd(dir.x * q));
  });
  return {
    stop() {
      if (!alive) return;
      alive = false;
      r.destroy();
    },
  };
}

// ================================================================ the rose closing round the target

/** "Pusula Fırtınası": a compass rose of two-colour field lines closes round `c` (the target's core) over ms. */
export function targetRose(scene: Phaser.Scene, c: XY, ms: number, depth: number): { done: Promise<void>; destroy(): void } {
  const R0 = 46;
  const r = Raster.around(scene, c.x, c.y, R0 * 2 + 20, R0 * 2 + 20, depth);
  let alive = true;
  const done = run(scene, ms, (t) => {
    if (!alive) return;
    const e = t * t * (3 - 2 * t);
    r.draw((rr) => {
      // the dial: two half rings (fire left / water right) shrinking onto the target, dashed and turning
      const R = R0 - e * 30;
      const n = rnd(R * 6);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + t * 2.4;
        if (((i >> 1) + Math.floor(t * 10)) % 4 === 3) continue;
        const left = Math.cos(a) < 0;
        rr.px(c.x + Math.cos(a) * R, c.y + Math.sin(a) * R * 0.62, left ? (t > 0.6 ? PAL.fire4 : PAL.fire3) : t > 0.6 ? PAL.water4 : PAL.water3);
      }
      // eight rays drawn inward (N ray fire from the top, S ray water from the bottom)
      for (let k = 0; k < 8; k++) {
        const a = -Math.PI / 2 + (k * TAU) / 8;
        const L = (k % 2 ? 0.6 : 1) * (R + 10);
        const reach = Math.min(1, t * 1.6);
        for (let d = L; d > L * (1 - reach) + 6; d -= 1.5) {
          const col = k === 0 ? PAL.fire4 : k === 4 ? PAL.water4 : k < 4 ? PAL.water2 : PAL.fire2;
          rr.px(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d * 0.62, col);
        }
      }
    });
  });
  return {
    done,
    destroy() {
      alive = false;
      r.destroy();
    },
  };
}

/** The contact: a pole blast at the rose's heart (a white core, fire / water petals) and the iron rain falling. */
export function poleBlast(scene: Phaser.Scene, c: XY, floorY: number, depth: number): Promise<void> {
  const r = Raster.around(scene, c.x, (c.y + floorY) / 2, 110, Math.max(90, floorY - c.y + 60), depth);
  const drops = Array.from({ length: 34 }, () => ({ a: rand() * TAU, v: 0.4 + rand() * 0.9, d: rand() * 0.25 }));
  return run(scene, 760, (t) => {
    r.draw((rr) => {
      if (t < 0.32) {
        const k = t / 0.32;
        const R = 4 + k * 22;
        rr.rect(c.x - 2, c.y - 2, 5, 5, PAL.white);
        for (let p = 0; p < 8; p++) {
          const a = (p * TAU) / 8 + 0.2;
          const col = p % 2 ? PAL.water4 : PAL.fire4;
          for (let d = 3; d < R * (p % 2 ? 0.7 : 1); d++) rr.px(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d * 0.8, d > R * 0.6 ? (p % 2 ? PAL.water2 : PAL.fire2) : col);
        }
      }
      // iron rain: grains flung out then falling to the floor line
      for (const g of drops) {
        const tt = Math.max(0, t - g.d);
        if (tt <= 0) continue;
        const x = c.x + Math.cos(g.a) * 30 * g.v * Math.min(1, tt * 2);
        const y = Math.min(floorY, c.y + Math.sin(g.a) * 16 * g.v + tt * tt * 160);
        rr.px(x, y, y >= floorY ? PAL.stone2 : tt < 0.3 ? PAL.mist : PAL.steel);
        if (y < floorY) rr.px(x, y - 1, PAL.stone3);
      }
    });
  }).then(() => r.destroy());
}

// ================================================================ the split

/** Three two-colour streaks flung from `from` toward the three landing points `to` (arcing up, over ms). */
export function splitStreaks(scene: Phaser.Scene, from: XY, to: readonly XY[], ms: number): Promise<void> {
  const xs = [from.x, ...to.map((p) => p.x)];
  const x0 = Math.min(...xs) - 30;
  const x1 = Math.max(...xs) + 30;
  const y0 = Math.min(from.y, ...to.map((p) => p.y)) - 110;
  const y1 = Math.max(from.y, ...to.map((p) => p.y)) + 10;
  const r = new Raster(scene, x0, Math.max(0, y0), x1 - x0, y1 - Math.max(0, y0), DEPTH.FX + 2);
  return run(scene, ms, (t) => {
    r.draw((rr) => {
      to.forEach((b, i) => {
        // an arc high over the board: up out of the body, over, and down into the zone's sky
        const peak = 70 + i * 10;
        for (let s = 0; s <= 40; s++) {
          const u = s / 40;
          if (u > t || u < t - 0.35) continue;
          const x = from.x + (b.x - from.x) * u;
          const y = from.y + (b.y - 60 - from.y) * u - Math.sin(Math.PI * u) * peak;
          const hot = u > t - 0.08;
          // a 2-px fire edge over a 2-px water edge (the two poles of the field it rides)
          rr.rect(x, y - 1, 2, 2, hot ? PAL.white : PAL.fire3);
          rr.rect(x, y + 1, 2, 1, hot ? PAL.mist : PAL.water3);
          if (!hot) rr.px(x, y + 2, i === 1 ? PAL.gold2 : PAL.water1);
        }
      });
    });
  }).then(() => r.destroy());
}

/** A piece lands in its zone: a small iron-dust ring and two pole sparks. */
export function landPuff(scene: Phaser.Scene, c: XY): Promise<void> {
  return dustShock(scene, c, 30, 360);
}

/** Three piece-sparks hanging in the sky over the landing zones (where the streaks ended) until each piece drops. */
export function hoverSparks(scene: Phaser.Scene, at: readonly XY[]): { release(i: number): void; destroy(): void } {
  const xs = at.map((p) => p.x);
  const ys = at.map((p) => p.y);
  const x0 = Math.min(...xs) - 14;
  const y0 = Math.max(0, Math.min(...ys) - 14);
  const r = new Raster(scene, x0, y0, Math.max(...xs) - x0 + 16, Math.max(...ys) - y0 + 16, DEPTH.FX + 2);
  const live = at.map(() => true);
  let alive = true;
  let el = 0;
  const stop = run(scene, 6000, (_t, e) => {
    if (!alive) return;
    el = e;
    const ph = Math.floor(el / 70);
    r.draw((rr) => {
      at.forEach((p, i) => {
        if (!live[i]) return;
        const bob = (ph + i) % 4 < 2 ? 0 : 1;
        const cx = p.x;
        const cy = p.y + bob;
        rr.rect(cx - 1, cy - 1, 3, 3, PAL.white);
        rr.rect(cx - 3, cy, 2, 1, PAL.fire4);
        rr.rect(cx + 2, cy, 2, 1, PAL.water4);
        rr.px(cx, cy - 3, (ph + i) % 2 ? PAL.fire3 : PAL.gold4);
        rr.px(cx, cy + 3, (ph + i) % 2 ? PAL.water3 : PAL.gold4);
        // a field loop flickering round it
        for (let k = 0; k < 10; k++) {
          if ((k + ph) % 3 === 0) continue;
          const a = (k / 10) * TAU + ph * 0.3;
          rr.px(cx + Math.cos(a) * 6, cy + Math.sin(a) * 3, Math.cos(a) < 0 ? PAL.fire2 : PAL.water2);
        }
      });
    });
  });
  void stop.then(() => r.destroy());
  return {
    release(i) {
      live[i] = false;
      if (live.every((v) => !v)) this.destroy();
    },
    destroy() {
      alive = false;
      r.destroy();
    },
  };
}

// ================================================================ the split: the pieces flung apart

export interface FlungPiece {
  id: MonsterId;
  /** the piece's anchor (floor point) where it sits in the sovereign's body */
  from: XY;
  /** the anchor's hang point over its landing zone */
  to: XY;
  /** the frame it flies in (the folded shape it has inside the sovereign) */
  anim: AnyMonsterAnim;
  frame: number;
  flip: boolean;
  /** its pole colour (the trail's hot core) */
  pole: number;
}

/** The split's fling: each piece's own sprite frame flies from its seat in the body to the sky of its zone on an
 *  easing-out arc (flung hard, braked by the field), trailing a fire / water streak; then it hangs there, bobbing
 *  1 px inside a flickering field loop, until release(i) (its real unit takes over) or destroy(). */
export function flingPieces(scene: Phaser.Scene, ps: readonly FlungPiece[], ms: number): { done: Promise<void>; release(i: number): void; destroy(): void } {
  const imgs = ps.map((p) => {
    const art = monsterArt(p.id);
    const key = `ps:fling:${p.id}:${p.anim}:${p.frame}`;
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, monsterFrame(p.id, p.anim, p.frame).toCanvas());
    return scene.add
      .image(rnd(p.from.x), rnd(p.from.y), key)
      .setOrigin((p.flip ? art.w - art.anchorX : art.anchorX) / art.w, art.anchorY / art.h)
      .setFlipX(p.flip)
      .setDepth(DEPTH.FX + 1);
  });
  const xs = ps.flatMap((p) => [p.from.x, p.to.x]);
  const ys = ps.flatMap((p) => [p.from.y, p.to.y]);
  const x0 = Math.min(...xs) - 30;
  const y0 = Math.max(0, Math.min(...ys) - 110);
  const r = new Raster(scene, x0, y0, Math.max(...xs) + 30 - x0, Math.max(...ys) + 16 - y0, DEPTH.FX);
  const live = ps.map(() => true);
  let alive = true;
  const peak = (i: number) => 26 + i * 8;
  const at = (p: FlungPiece, i: number, e: number): XY => ({
    x: p.from.x + (p.to.x - p.from.x) * e,
    y: p.from.y + (p.to.y - p.from.y) * e - Math.sin(Math.PI * e) * peak(i),
  });
  // the trail runs through the piece's middle, not its feet
  const mid = (i: number) => rnd(-(imgs[i].height * 0.4));
  const done = run(scene, ms, (t) => {
    if (!alive) return;
    const u = Math.min(1, t);
    const e = 1 - (1 - u) * (1 - u) * (1 - u);
    r.draw((rr) => {
      ps.forEach((p, i) => {
        if (!live[i]) return;
        for (let k = 1; k <= 14; k++) {
          const ek = e - k * 0.028;
          if (ek <= 0) break;
          const q = at(p, i, ek);
          const y = q.y + mid(i);
          const hot = k <= 3;
          rr.rect(q.x - 1, y - 1, 2, 2, hot ? PAL.white : k <= 7 ? p.pole : PAL.fire3);
          if (k <= 10) rr.rect(q.x - 1, y + 1, 2, 1, hot ? PAL.mist : PAL.water3);
        }
      });
    });
    ps.forEach((p, i) => {
      const q = at(p, i, e);
      imgs[i].setPosition(rnd(q.x), rnd(q.y));
    });
  }).then(() => {
    if (!alive) return;
    // the hang: the field holds each piece over its zone (1-px bob, a two-colour loop under it)
    void run(scene, 6000, (_t, el) => {
      if (!alive) return;
      const ph = Math.floor(el / 90);
      r.draw((rr) => {
        ps.forEach((p, i) => {
          if (!live[i]) return;
          const cy = rnd(p.to.y + 3);
          for (let k = 0; k < 14; k++) {
            if ((k + ph) % 4 === 0) continue;
            const a = (k / 14) * TAU + ph * 0.35 + i;
            rr.px(rnd(p.to.x + Math.cos(a) * 10), rnd(cy + Math.sin(a) * 4), Math.cos(a) < 0 ? PAL.fire3 : PAL.water3);
          }
        });
      });
      ps.forEach((p, i) => {
        if (live[i]) imgs[i].setPosition(rnd(p.to.x), rnd(p.to.y) + ((ph + i) % 4 < 2 ? 0 : -1));
      });
    });
  });
  return {
    done,
    release(i) {
      if (!live[i]) return;
      live[i] = false;
      imgs[i].destroy();
      if (live.every((v) => !v)) this.destroy();
    },
    destroy() {
      if (!alive) return;
      alive = false;
      imgs.forEach((m) => m.active && m.destroy());
      r.destroy();
    },
  };
}
