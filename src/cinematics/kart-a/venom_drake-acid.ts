// Zehir Ejderi (venom_drake) — the acid kit of the card (docs/v3/kart-a/venom_drake.md §5.0): the glob, its
// trail and floor shadow, the splat crown, THE acid holes on a struck victim (the same `holeAt` web the drake
// eats itself with in its own death: src/art/monsters-v3/venom_drake-holes.ts), the steam threads, the brief
// etch dots, and the scar store ("Zehirli Toprak": module-level, never ctx.keep — the Director drops kept
// handles at the end of each batch). Used by venom_drake-strike / -summon / -death. v3 look only.
// Whole pixels, palette tones only, no alpha, stepped light, no camera.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { holeAt } from '../../art/monsters-v3/venom_drake-holes';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { onDuelStart } from '../../duel/seeds';
import { DEPTH, TILE_H, TILE_W, type XY } from '../../view/layout';
import { lightFlash } from '../../view/light';
import { play } from '../_v3/sound';
import { Sparks, currentPixels, followLight, layer, onFrame, overlay } from '../strikes-a/_kit';
import type { Px } from '../../vfx/combat';

export const STEP = 1000 / 60;
const r = Math.round;

// ================================================================ the glob (7×6, three hand shapes)

type Cell = [dx: number, dy: number, c: number];
const GLOB_CACHE = new Map<string, Cell[]>();

/**
 * The glob's pixels: shape 0 round, 1 stretched along the velocity, 2 squashed across it; `oct` the velocity
 * octant (0 = right, 2 = down …). No rotation of a sprite: each octant's shape is rasterised by hand rules.
 * Crit r1 #1: an 8×7 body (9×8 stretched) so it reads at 1× — a 1-px ink outline, a leaf3 body, a leaf2
 * lower band (the belly of the drop), a 2×2 gold3 core with ONE gold4 heart pixel, a gold3 highlight on the
 * upper front.
 */
function globCells(shape: 0 | 1 | 2, oct: number, small = false): Cell[] {
  const key = `${shape}:${oct}:${small ? 1 : 0}`;
  let cells = GLOB_CACHE.get(key);
  if (cells) return cells;
  const a = (oct * Math.PI) / 4;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const [A, B] = small ? ([3.0, 2.4] as const) : shape === 0 ? ([3.9, 3.4] as const) : shape === 1 ? ([4.7, 2.9] as const) : ([3.1, 4.0] as const);
  const inside = (x: number, y: number) => {
    const u = (x - 0.5) * ca + (y - 0.5) * sa;
    const v = -(x - 0.5) * sa + (y - 0.5) * ca;
    return (u * u) / (A * A) + (v * v) / (B * B) <= 1;
  };
  const S = new Set<string>();
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) if (inside(x, y)) S.add(`${x},${y}`);
  cells = [];
  let top = 99;
  let bot = -99;
  for (const k of S) {
    const yy = Number(k.split(',')[1]);
    top = Math.min(top, yy);
    bot = Math.max(bot, yy);
  }
  for (let y = -7; y <= 7; y++)
    for (let x = -7; x <= 7; x++) {
      if (S.has(`${x},${y}`)) {
        // the belly: the lowest 2 rows (1 for the small drop) are leaf2, the rest leaf3
        cells.push([x, y, y > bot - (small ? 1 : 2) ? PAL.leaf2 : PAL.leaf3]);
        continue;
      }
      if (S.has(`${x - 1},${y}`) || S.has(`${x + 1},${y}`) || S.has(`${x},${y - 1}`) || S.has(`${x},${y + 1}`)) cells.push([x, y, PAL.ink]);
    }
  // the highlight on the upper front (toward the velocity, or the upper right when it falls straight down)
  const fx = Math.abs(ca) < 0.3 ? 1 : Math.sign(ca);
  const hl = cells.filter((c) => c[2] !== PAL.ink && c[1] === top).sort((p, q) => fx * (q[0] - p[0]))[0];
  if (hl) hl[2] = PAL.gold3;
  if (!small) {
    for (const c of cells) if (c[2] !== PAL.ink && (c[0] === 0 || c[0] === 1) && (c[1] === 0 || c[1] === 1)) c[2] = PAL.gold3;
    const core = cells.find((c) => c[0] === 0 && c[1] === 0);
    if (core) core[2] = PAL.gold4;
  } else {
    // crit r3 #1: the spray drop (6×5 + ink) carries one gold3 heart pixel so it reads as venom at 1×
    const core = cells.find((c) => c[0] === 0 && c[1] === 0 && c[2] !== PAL.ink);
    if (core) core[2] = PAL.gold3;
  }
  GLOB_CACHE.set(key, cells);
  return cells;
}

/** Draw the glob at (x, y) moving with (vx, vy); `tick` alternates the wobble shape every 2 frames. */
export function drawGlob(px: Px, x: number, y: number, vx: number, vy: number, tick: number, small = false): void {
  const sp = Math.hypot(vx, vy);
  const oct = sp < 1 ? 0 : (((Math.round(Math.atan2(vy, vx) / (Math.PI / 4)) % 8) + 8) % 8);
  const shape: 0 | 1 | 2 = sp < 40 ? (Math.floor(tick / 2) % 2 ? 2 : 0) : Math.floor(tick / 2) % 3 === 2 ? 0 : 1;
  for (const [dx, dy, c] of globCells(small ? 0 : shape, oct, small)) px.dot(r(x) + dx, r(y) + dy, c);
}

// ================================================================ etch dots and steam (temporary)

let etchLayer: { sc: Phaser.Scene; px: Px; dots: { x: number; y: number; age: number }[]; steam: { x: number; y: number; age: number }[] } | null = null;

/**
 * A drop lands on the floor: a 1-px leaf1 etch dot (stepping out over 1.2 s: leaf1 → leaf0 → gone) and one
 * stone3 steam pixel that rises 3 px and is gone in 400 ms. Not part of the permanent scar.
 */
export function etchDot(sc: Phaser.Scene, x: number, y: number): void {
  if (!etchLayer || etchLayer.sc !== sc || !etchLayer.px.g.active) {
    const L = { sc, px: layer(sc, DEPTH.TILE_FX - 1), dots: [{ x: r(x), y: r(y), age: 0 }], steam: [{ x: r(x), y: r(y), age: 0 }] };
    etchLayer = L;
    onFrame(
      sc,
      (dt) => {
        L.px.clear();
        for (let i = L.dots.length - 1; i >= 0; i--) {
          const d = L.dots[i];
          d.age += dt;
          if (d.age > 1200) {
            L.dots.splice(i, 1);
            continue;
          }
          L.px.dot(d.x, d.y, d.age < 120 ? PAL.leaf3 : d.age < 700 ? PAL.leaf1 : PAL.leaf0);
        }
        for (let i = L.steam.length - 1; i >= 0; i--) {
          const s = L.steam[i];
          s.age += dt;
          if (s.age > 400) {
            L.steam.splice(i, 1);
            continue;
          }
          L.px.dot(s.x, s.y - Math.min(3, Math.floor(s.age / 110)) - 1, s.age < 260 ? PAL.stone3 : PAL.stone2);
        }
        if (!L.dots.length && !L.steam.length) {
          if (etchLayer === L) etchLayer = null;
          return false;
        }
        return true;
      },
      () => L.px.g.destroy(),
    );
    return;
  }
  etchLayer.dots.push({ x: r(x), y: r(y), age: 0 });
  etchLayer.steam.push({ x: r(x), y: r(y), age: 0 });
}

/** Steam threads: 2-px columns stepping stone3 → stone2 → night3, rising 10 px, 300 ms each. */
export function steamThreads(sc: Phaser.Scene, pts: readonly XY[], depth: number, delay = 0): void {
  const sp = new Sparks(sc, depth);
  pts.forEach((p, i) => {
    for (const dx of [0, 1]) sp.add({ x: r(p.x) + dx, y: r(p.y) - 1, vy: -34, life: 300, delay: delay + i * 30 + dx * 20, colors: [PAL.stone3, PAL.stone2, PAL.night3], shape: 'px', fadeAt: 1 });
  });
  sp.release();
}

/** The splat crown: `n` radial drops (leaf3 / gold3, 1–2 px) under gravity, settling on the floor. */
export function splatCrown(sc: Phaser.Scene, at: XY, floorY: number, n: number, depth: number, o: { up?: number; speed?: number; side?: number } = {}): void {
  const sp = new Sparks(sc, depth);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + ((i / Math.max(1, n - 1)) - 0.5) * Math.PI * 1.25 + (o.side ?? 0) * 0.5;
    const v = (o.speed ?? 70) * (0.7 + 0.5 * ((i * 37) % 10) / 10);
    sp.add({ x: r(at.x), y: r(at.y), vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up ?? 20), ay: 520, life: 420 + (i % 3) * 60, colors: i % 3 === 0 ? [PAL.gold3, PAL.leaf3, PAL.leaf2] : [PAL.leaf3, PAL.leaf2], shape: i % 4 === 1 ? 'sq' : 'px', size: i % 4 === 1 ? 2 : 1, fadeAt: 1, floor: floorY + (i % 3), bounce: 0 });
  }
  sp.release();
}

/**
 * The splat itself, drawn IN FRONT of the battle kit's contact star (crit r1 #2: the white star hid the first
 * 3 frames of the splat): 4 frames of 50 ms — a round blob with a closed gold3 ring, a flattened lobed splat
 * with the ring breaking into dashes, a wide smear dropping three drips, a thin leaf2 smear — then the stuck
 * blob of the acid-hole overlay carries on. Whole pixels, ink outline, leaf3 / leaf2 bands, gold3 / gold4 core.
 */
export function splatBurst(sc: Phaser.Scene, at: XY, depth: number, o: { small?: boolean } = {}): void {
  const px = layer(sc, depth);
  const cx = r(at.x);
  const cy = r(at.y);
  const k0 = o.small ? 0.7 : 1;
  const blob = (rx: number, ry: number, lobes: number, core: boolean) => {
    const inside = (x: number, y: number) => {
      const a = Math.atan2(y, x);
      const wob = 1 + 0.18 * Math.cos(a * lobes + 0.6);
      return (x * x) / (rx * rx * wob * wob) + (y * y) / (ry * ry * wob * wob) <= 1;
    };
    const R = Math.ceil(rx * 1.3) + 1;
    const Ry = Math.ceil(ry * 1.3) + 1;
    for (let y = -Ry; y <= Ry; y++)
      for (let x = -R; x <= R; x++) {
        if (inside(x, y)) px.dot(cx + x, cy + y, y > ry * 0.35 ? PAL.leaf2 : PAL.leaf3);
        else if (inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1)) px.dot(cx + x, cy + y, PAL.ink);
      }
    if (core) px.run(cy - 1, cx - 1, cx + 1, PAL.gold3).run(cy, cx - 1, cx + 1, PAL.gold3).dot(cx, cy - 1, PAL.gold4);
  };
  const ring = (rx: number, ry: number, dashes: boolean) => {
    const N = 40;
    for (let i = 0; i < N; i++) {
      if (dashes && i % 7 > 3) continue;
      const a = (i / N) * Math.PI * 2;
      px.dot(r(cx + Math.cos(a) * rx), r(cy + Math.sin(a) * ry), PAL.gold3);
    }
  };
  const drips = (len: number, c: number) => {
    for (const [dx, L] of [[-4, len], [1, len + 1], [5, len - 1]] as const) for (let j = 1; j <= L; j++) px.dot(cx + r(dx * k0), cy + r(3 * k0) + j, j === L ? PAL.ink : c);
  };
  onFrame(
    sc,
    (_dt, el) => {
      px.clear();
      const f = Math.floor(el / 50);
      if (f >= 4) return false;
      if (f === 0) {
        blob(4.6 * k0, 3.8 * k0, 3, true);
        ring(8 * k0, 6 * k0, false);
      } else if (f === 1) {
        blob(6 * k0, 3.4 * k0, 4, true);
        ring(10 * k0, 7 * k0, true);
      } else if (f === 2) {
        blob(7 * k0, 2.6 * k0, 5, false);
        drips(2, PAL.leaf3);
      } else {
        blob(6.5 * k0, 1.8 * k0, 5, false);
        drips(4, PAL.leaf2);
      }
      return true;
    },
    () => px.g.destroy(),
  );
}

// ================================================================ glob flight

export interface FlightOpts {
  /** Flight time (ms). */
  ms: number;
  /** Apex height above the higher end (px; default 22 + 0.18 × the distance). */
  apex?: number;
  /** The floor line under the flight (the shadow and the trail drops land on it). */
  floorFrom: XY;
  floorTo: XY;
  depth?: number;
  /** A small drop (the direct spray) instead of the 7×6 glob. */
  small?: boolean;
  /** Trail drops (default true). */
  trail?: boolean;
  light?: boolean;
  /** Read every frame: the target end moves (the struck face follows the target's frame). */
  to?: () => XY;
}

/** Fly a glob on a parabola from `from` to `to`; resolves on arrival (the landing frame is the caller's). */
export function flyGlob(sc: Phaser.Scene, from: XY, to: XY, o: FlightOpts): Promise<XY> {
  const px = layer(sc, o.depth ?? DEPTH.FX - 1);
  const fl = layer(sc, DEPTH.TILE_FX - 1);
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const apex = o.apex ?? 22 + 0.18 * dist;
  let pos: XY = { ...from };
  const floorAt = (x: number): number => {
    const dx = o.floorTo.x - o.floorFrom.x;
    const k = Math.abs(dx) < 1 ? 0.5 : Math.max(0, Math.min(1, (x - o.floorFrom.x) / dx));
    return o.floorFrom.y + (o.floorTo.y - o.floorFrom.y) * k;
  };
  const lt = o.light === false ? null : followLight(sc, () => pos, { color: PAL.leaf3, radius: o.small ? 6 : 10, intensity: o.small ? 0.35 : 0.5, floorY: (p) => floorAt(p.x), fadeIn: 0 });
  const drops: { x: number; y: number; vy: number; fy: number }[] = [];
  let acc = 0;
  let tick = 0;
  let last = { ...from };
  const hist: XY[] = [];
  return new Promise<XY>((resolve) => {
    onFrame(
      sc,
      (dt, el) => {
        tick++;
        px.clear();
        fl.clear();
        const t = Math.min(1, el / o.ms);
        const end = o.to ? o.to() : to;
        const top = Math.max(40, Math.min(from.y, end.y) - apex);
        // a parabola through (0, from.y), (½, top), (1, end.y)
        const y0 = from.y;
        const y1 = end.y;
        const b = 4 * top - 3 * y0 - y1;
        const a = y1 - y0 - b;
        const x = from.x + (end.x - from.x) * t;
        const y = y0 + b * t + a * t * t;
        pos = { x: r(x), y: r(y) };
        const vx = (end.x - from.x) / (o.ms / 1000);
        const vy = (b + 2 * a * t) / (o.ms / 1000);
        // the floor shadow: a 5×1 night0 dash sliding under it (3 px for a small drop)
        const fy = r(floorAt(x));
        fl.run(fy, pos.x - (o.small ? 1 : 2), pos.x + (o.small ? 1 : 2), PAL.night0);
        // the trail: one drop every 40 ms, falling to the floor, an etch dot where it lands
        if (o.trail !== false) {
          acc += dt;
          while (acc >= 40) {
            acc -= 40;
            drops.push({ x: last.x, y: last.y + 2, vy: 0, fy: r(floorAt(last.x)) });
          }
        }
        for (let i = drops.length - 1; i >= 0; i--) {
          const d = drops[i];
          d.vy += 520 * (dt / 1000);
          d.y += d.vy * (dt / 1000);
          if (d.y >= d.fy) {
            etchDot(sc, d.x, d.fy);
            drops.splice(i, 1);
            continue;
          }
          // a falling drop: 2 px tall (leaf3 head, leaf2 tail)
          px.dot(r(d.x), r(d.y), PAL.leaf3).dot(r(d.x), r(d.y) - 1, PAL.leaf2);
        }
        last = { ...pos };
        if (t >= 1) {
          resolve(pos);
          return drops.length > 0;
        }
        // the wet streak behind it (crit r1 #1): a stepped drip trail over its last places — a 3-px leaf3 smear,
        // a 2-px leaf2, then leaf1 and leaf0 single pixels (no alpha)
        hist.unshift({ ...pos });
        if (hist.length > 6) hist.length = 6;
        if (o.small) {
          // crit r3 #1: the spray drop trails a short stepped 2-px streak (leaf3 → leaf2 → leaf1 → leaf0)
          const [, h1, h2, h3, h4] = hist;
          const back = Math.sign(vx) || 1;
          if (h4) px.dot(h4.x - back, h4.y, PAL.leaf0);
          if (h3) px.dot(h3.x - back, h3.y, PAL.leaf1).dot(h3.x, h3.y, PAL.leaf1);
          if (h2) px.dot(h2.x - back, h2.y, PAL.leaf2).dot(h2.x, h2.y, PAL.leaf2).dot(h2.x, h2.y + 1, PAL.leaf1);
          if (h1) px.dot(h1.x - back, h1.y, PAL.leaf3).dot(h1.x, h1.y, PAL.leaf3).dot(h1.x, h1.y + 1, PAL.leaf2);
        } else {
          const [, h1, h2, h3, h4, h5] = hist;
          const back = Math.sign(vx) || 1;
          if (h5) px.dot(h5.x - back, h5.y + 1, PAL.leaf0);
          if (h4) px.dot(h4.x - back, h4.y + 1, PAL.leaf1);
          if (h3) px.dot(h3.x - back, h3.y, PAL.leaf1).dot(h3.x - back, h3.y + 1, PAL.leaf2);
          if (h2) px.dot(h2.x - back, h2.y, PAL.leaf2).dot(h2.x - back, h2.y + 1, PAL.leaf2).dot(h2.x, h2.y + 1, PAL.leaf1);
          if (h1) px.dot(h1.x, h1.y, PAL.leaf3).dot(h1.x - back, h1.y, PAL.leaf3).dot(h1.x, h1.y + 1, PAL.leaf2);
          // a 1-frame drip decal hangs off the glob's belly every 4th frame (3 px: leaf3, leaf2, ink)
          if (tick % 4 === 2) {
            const dx = pos.x - back;
            const dy = pos.y + 5;
            px.dot(dx, dy, PAL.leaf3).dot(dx, dy + 1, PAL.leaf2).dot(dx, dy + 2, PAL.ink);
          }
        }
        // crit r2 #1: the launch smear — for the first 3 frames a stepped wet streak ties the glob to the
        // stinger (2 px wide: leaf3 on top, leaf1 under), a gold3 muzzle spark on the first, the streak
        // shortening to the glob's end (full / ½ / ¼) so the eye catches the shot leaving
        if (!o.small && tick <= 3) {
          const L = Math.hypot(pos.x - from.x, pos.y - from.y);
          const keep = tick === 1 ? 1 : tick === 2 ? 0.5 : 0.25;
          for (let i = 0; i <= L; i++) {
            const q = i / Math.max(1, L);
            if (q < 1 - keep) continue;
            const sx = r(from.x + (pos.x - from.x) * q);
            const sy = r(from.y + (pos.y - from.y) * q);
            px.dot(sx, sy, q > 0.6 ? PAL.leaf3 : PAL.leaf2).dot(sx, sy + 1, PAL.leaf1);
          }
          if (tick === 1) px.dot(from.x, from.y, PAL.gold4).dot(from.x - 1, from.y, PAL.gold3).dot(from.x + 1, from.y, PAL.gold3).dot(from.x, from.y - 1, PAL.gold3).dot(from.x, from.y + 1, PAL.gold3);
          else if (tick === 2) px.dot(from.x - 1, from.y - 1, PAL.gold3).dot(from.x + 1, from.y + 1, PAL.gold3);
        }
        drawGlob(px, pos.x, pos.y, vx, vy, tick, o.small);
        return true;
      },
      () => {
        px.g.destroy();
        fl.g.destroy();
        if (lt) void lt.fadeOut(80);
      },
    );
  });
}

// ================================================================ the spray puddle (direct)

/**
 * Crit r3 #1: a spray drop lands — a bright floor puddle instead of a dark smudge. Stepped, no alpha:
 * 50 ms a 5×3 leaf3 splash, 50 ms a 9×5 puddle, then the peak (11×5: leaf1 pool, leaf2 rim, a leaf3 front-top
 * lip, a gold3 glint with a gold4 heart that steps along the lip) held ~260 ms, then it soaks in
 * (leaf1 rim / leaf0 pool → leaf0 dot) by ~760 ms. A night0 row under the front edge seats it on the tile.
 */
export function sprayPuddle(sc: Phaser.Scene, at: XY, depth: number = DEPTH.TILE_FX + 5, delay = 0): void {
  const px = layer(sc, depth);
  const cx = r(at.x);
  const cy = r(at.y);
  const pool = (rx: number, ry: number, fill: number, rim: number, lip: number | null): void => {
    ell(px, cx, cy, rx + 1, ry, rim);
    ell(px, cx, cy, rx, Math.max(0, ry - 1), fill);
    // the shadow row seats it on the tile
    px.run(cy + ry + 1, cx - rx + 1, cx + rx - 1, PAL.night0);
    if (lip !== null) px.run(cy - ry, cx - rx + 1, cx + rx - 2, lip);
  };
  let el = -delay;
  onFrame(
    sc,
    (dt) => {
      el += dt;
      px.clear();
      if (el < 0) return true;
      if (el < 50) {
        pool(2, 1, PAL.leaf3, PAL.leaf2, null);
        px.dot(cx, cy - 2, PAL.gold3);
      } else if (el < 100) {
        pool(4, 2, PAL.leaf1, PAL.leaf3, PAL.leaf3);
        px.dot(cx - 2, cy - 2, PAL.gold3);
      } else if (el < 360) {
        pool(5, 2, PAL.leaf1, PAL.leaf2, PAL.leaf3);
        // the glint steps along the lip, 1 px per 65 ms
        const gx = cx - 3 + Math.min(4, Math.floor((el - 100) / 65));
        px.dot(gx, cy - 2, PAL.gold4).dot(gx - 1, cy - 2, PAL.gold3).dot(gx + 1, cy - 1, PAL.gold3);
        // one acid bubble on the pool
        if (el > 180 && el < 300) px.dot(cx + 2, cy, PAL.leaf3);
      } else if (el < 520) {
        pool(5, 2, PAL.leaf0, PAL.leaf1, PAL.leaf2);
        px.dot(cx + 1, cy - 2, PAL.gold3);
      } else if (el < 760) {
        pool(3, 1, PAL.leaf0, PAL.leaf0, null);
      } else return false;
      return true;
    },
    () => px.g.destroy(),
  );
}

// ================================================================ the victim's frame space

/** A world point in the frame space of the frame `u` shows (sprite inverse transform, flip aware). */
export function worldToFrame(u: MonsterUnit, p: XY): XY {
  const spr = u.sprite;
  const m = spr.getWorldTransformMatrix();
  const q = m.applyInverse(p.x, p.y);
  const lx = q.x + spr.displayOriginX;
  const w = spr.frame.realWidth;
  return { x: Math.floor(spr.flipX ? w - lx : lx), y: Math.floor(q.y + spr.displayOriginY) };
}

/**
 * Where a line from the core toward `from` leaves the unit's silhouette (the struck face) on the frame it
 * shows now (crystal_wyrm's reading); null when it cannot be read.
 */
export function surfaceOf(t: MonsterUnit | null | undefined, from: XY): XY | null {
  if (!t || t.retired || !t.sprite.active || !t.sprite.visible) return null;
  const core = t.core();
  const pc = currentPixels(t).pc;
  const dx = from.x - core.x;
  const dy = from.y - core.y;
  const L = Math.max(1, Math.hypot(dx, dy));
  let last: XY | null = null;
  let gap = 0;
  for (let i = 0; i < 52; i++) {
    const p = { x: core.x + (dx / L) * i, y: core.y + (dy / L) * i };
    const f = worldToFrame(t, p);
    if (pc.isOpaque(f.x, f.y)) {
      last = p;
      gap = 0;
    } else if (last && ++gap > 2) break;
  }
  return last ? { x: r(last.x), y: r(last.y) } : null;
}

// ================================================================ the acid holes (THE signature)

/** Is (x, y) at least `k` px inside the silhouette (every pixel within k on the 4 axes opaque)? */
function deepIn(pc: PixelCanvas, x: number, y: number, k: number): boolean {
  for (let i = 0; i <= k; i++) if (!pc.isOpaque(x + i, y) || !pc.isOpaque(x - i, y) || !pc.isOpaque(x, y + i) || !pc.isOpaque(x, y - i)) return false;
  return true;
}

/** The nearest pixel to `p` that lies 3 px inside the body (else `p`). */
function anchorIn(pc: PixelCanvas, p: XY): XY {
  if (deepIn(pc, p.x, p.y, 3)) return p;
  for (let rr = 1; rr <= 14; rr++)
    for (let j = -rr; j <= rr; j++)
      for (const i of [-rr, rr]) {
        if (deepIn(pc, p.x + i, p.y + j, 3)) return { x: p.x + i, y: p.y + j };
        if (deepIn(pc, p.x + j, p.y + i, 3)) return { x: p.x + j, y: p.y + i };
      }
  return p;
}

/** Coverage cap of the silhouette per strike power (§5.0: ≤ 6 / 10 / 12 %). */
const COVER = [0, 0.06, 0.1, 0.12] as const;
/** The hole steps (holeAt step values) and their local reach round the contact (frame px). */
const STEPS = [0, 1, 1.6, 2.25] as const;
const REACH = [0, 10, 14, 17] as const;

export interface AcidHoles {
  /** Show step 0…3 (0: closed). */
  step(n: number): void;
  /** The holes close in 3 steps over 300 ms (a survivor), then the overlay goes. */
  close(ms?: number): Promise<void>;
  /** Frame-space hole centres of the newest step, in world px (steam threads rise from them). */
  mouths(n: number): XY[];
  /** Remove now. */
  destroy(): void;
}

/**
 * The acid holes on a struck unit: an overlay (strikes-a/_kit overlay) that eats the target's own opaque
 * pixels from the contact point outward, step by step, from the shared `holeAt` web. Each hole is an
 * emissive crater (an overlay cannot cut a real hole in another card's sprite): a 1-px ink core, a leaf2
 * interior, a closed leaf3 rim on the remaining body round it, one gold3 pixel on the lower lip. A stuck
 * splat blob sits on the contact point for the first frames. The overlay follows the frame the target
 * shows (its recoil, its death) until its sprite is hidden (the kit's burst frame).
 */
export function acidHoles(t: MonsterUnit, at: XY, power: 1 | 2 | 3): AcidHoles {
  const sc = t.scene;
  const seed = (t.uid * 7919 + 13) % 997;
  const cp0 = worldToFrame(t, at);
  const pc0 = currentPixels(t).pc;
  const ov = overlay(t, new PixelCanvas(pc0.w, pc0.h));
  let step = 0;
  let blob = 3; // the stuck splat blob: 3 frames full, then eaten by the holes
  let lastKey = '';
  let mouthsAt: XY[] = [];
  let dead = false;
  let closing = false;
  let lastOut: PixelCanvas | null = null;
  const paint = () => {
    const { anim, frame, pc } = currentPixels(t);
    const key = `${String(t.sprite.frame?.name ?? anim + frame)}|${step}|${blob}`;
    if (key === lastKey) return;
    lastKey = key;
    const out = new PixelCanvas(pc.w, pc.h);
    // the struck spot follows the body: a recoil / death frame that moved it off the contact point takes the
    // nearest body pixel 3 px inside the silhouette (the holes ride the flesh, never the air)
    const cp = anchorIn(pc, cp0);
    if (step > 0) {
      const R = REACH[step];
      const st = STEPS[step];
      const cov = power === 1 ? 0.55 : power === 2 ? 0.8 : 1;
      const eaten: [number, number, number][] = [];
      let opaque = 0;
      for (let y = 0; y < pc.h; y++) for (let x = 0; x < pc.w; x++) if (pc.isOpaque(x, y)) opaque++;
      for (let y = cp.y - R; y <= cp.y + R; y++)
        for (let x = cp.x - R; x <= cp.x + R; x++) {
          const d = Math.hypot(x - cp.x, (y - cp.y) * 1.15);
          if (d > R || !pc.isOpaque(x, y)) continue;
          // keep the silhouette's outer edge: a hole never eats the body's own outline row
          if (!pc.isOpaque(x - 1, y) || !pc.isOpaque(x + 1, y) || !pc.isOpaque(x, y - 1) || !pc.isOpaque(x, y + 1)) continue;
          if (holeAt(x, y, st, seed, cov)) eaten.push([x, y, d]);
        }
      // the cap: never more than the power's share of the silhouette (the farthest pixels go first)
      const cap = Math.floor(opaque * COVER[power]);
      if (eaten.length > cap) eaten.sort((p, q) => p[2] - q[2]).length = cap;
      const H = new Set(eaten.map(([x, y]) => y * 4096 + x));
      const isH = (x: number, y: number) => H.has(y * 4096 + x);
      // the rim: every body pixel 4-touching a hole is leaf3 (a closed acid ring)
      for (const [x, y] of eaten)
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) if (!isH(nx, ny) && pc.isOpaque(nx, ny)) out.set(nx, ny, PAL.leaf3);
      // the crater: the lower inner wall catches the acid's glow (leaf2), the upper wall a leaf1 step, the
      // rest of the hole is the ink depth (so it reads as a HOLE, not as a green patch)
      for (const [x, y] of eaten) {
        const lower = !isH(x, y + 1);
        const upper = !isH(x, y - 1);
        out.set(x, y, lower ? PAL.leaf2 : upper ? PAL.leaf1 : PAL.ink);
      }
      // per hole (4-connected component): a 1-px ink core if none is deep, one gold3 pixel on its lower lip
      const seen = new Set<number>();
      mouthsAt = [];
      for (const [x0, y0] of eaten) {
        const k0 = y0 * 4096 + x0;
        if (seen.has(k0)) continue;
        const comp: [number, number][] = [];
        const q: [number, number][] = [[x0, y0]];
        seen.add(k0);
        while (q.length) {
          const [x, y] = q.pop()!;
          comp.push([x, y]);
          for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) {
            const k = ny * 4096 + nx;
            if (isH(nx, ny) && !seen.has(k)) {
              seen.add(k);
              q.push([nx, ny]);
            }
          }
        }
        let sx = 0;
        let sy = 0;
        let bot = -1;
        for (const [x, y] of comp) {
          sx += x;
          sy += y;
          bot = Math.max(bot, y);
        }
        const mx = Math.round(sx / comp.length);
        const my = Math.round(sy / comp.length);
        if (comp.length >= 3 && isH(mx, my) && out.get(mx, my) !== PAL.ink) out.set(mx, my, PAL.ink);
        const lip = comp.filter(([, y]) => y === bot).sort((p, q2) => Math.abs(p[0] - mx) - Math.abs(q2[0] - mx))[0];
        if (lip && pc.isOpaque(lip[0], bot + 1) && !isH(lip[0], bot + 1)) out.set(lip[0], bot + 1, PAL.gold3);
        if (comp.length >= 3) mouthsAt.push(t.framePoint(mx, my));
      }
    }
    // the stuck splat blob (the glob's own body flattened on the face), eaten as the holes open
    if (blob > 0) {
      const R = blob >= 3 ? 3 : 2;
      for (let y = -R - 1; y <= R + 1; y++)
        for (let x = -R - 2; x <= R + 2; x++) {
          const fx = cp.x + x;
          const fy = cp.y + y;
          if (!pc.isOpaque(fx, fy)) continue;
          const e = (x * x) / ((R + 1) * (R + 1)) + (y * y) / (R * R);
          if (e <= 1) out.set(fx, fy, y < 0 ? PAL.leaf3 : PAL.leaf2);
          else if (e <= 1.7) out.set(fx, fy, PAL.ink);
        }
      out.set(cp.x, cp.y - 1, PAL.gold3);
      // two runs drip down the face
      for (const [dx, len] of [[-1, 3], [2, 2]] as const) for (let j = 1; j <= len; j++) if (pc.isOpaque(cp.x + dx, cp.y + R + j)) out.set(cp.x + dx, cp.y + R + j, j === len ? PAL.leaf3 : PAL.leaf2);
    }
    ov.redraw(out);
    lastOut = out;
  };
  const destroy = () => {
    if (dead) return;
    dead = true;
    ov.destroy();
  };
  let frames = 0;
  onFrame(sc, () => {
    if (dead) return false;
    if (!t.sprite.active || !t.sprite.visible || t.retired) {
      // crit r1 #8: a body that breaks (the kit's burst hides it) leaves its holes behind for a moment: the
      // acid rims hang in the air and drip to the tile, outlasting the break
      if (step > 0 && !closing && lastOut && t.sprite.active) residue(t, lastOut);
      destroy();
      return false;
    }
    frames++;
    if (blob > 0 && frames > 3 && step >= 1) blob = frames > 6 || step >= 2 ? 0 : 1;
    paint();
    return true;
  });
  paint();
  return {
    step(n) {
      step = Math.max(0, Math.min(3, n));
      paint();
    },
    async close(ms = 300) {
      blob = 0;
      closing = true;
      for (let s = step - 1; s >= 0 && !dead; s--) {
        await new Promise<void>((res) => sc.time.delayedCall(ms / 3, res));
        step = s;
        if (!dead) paint();
      }
      destroy();
    },
    mouths(n) {
      return mouthsAt.slice(0, n).map((p) => ({ x: r(p.x), y: r(p.y) }));
    },
    destroy,
  };
}

/**
 * The holes outlive the body's break: their acid pixels (world copies of the last overlay) hold 2 frames,
 * the ink depths go, then every rim / wall pixel drips to the tile with gravity (leaf3 → leaf2 → leaf1 as it
 * falls), every 4th landing etches a dot. Drawn over the break (DEPTH.FX + 0.5).
 */
function residue(t: MonsterUnit, out: PixelCanvas): void {
  const sc = t.scene;
  const floor = r(t.home.y);
  const ps: { x: number; y: number; c: number; vy: number; delay: number; done: boolean }[] = [];
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++) {
      const c = out.get(x, y);
      if (c === null || c === undefined) continue;
      const w = t.framePoint(x, y);
      ps.push({ x: r(w.x), y: r(w.y), c, vy: 0, delay: 40 + ((x * 37 + y * 11) % 7) * 30, done: false });
    }
  if (!ps.length) return;
  const px = layer(sc, DEPTH.FX + 0.5);
  let n = 0;
  onFrame(
    sc,
    (dt, el) => {
      px.clear();
      if (el > 1100) return false;
      let alive = 0;
      for (const p of ps) {
        if (p.done) continue;
        if (el > p.delay) {
          if (p.c === PAL.ink) {
            p.done = true;
            continue;
          }
          p.vy += 420 * (dt / 1000);
          p.y += p.vy * (dt / 1000);
          if (p.y >= floor) {
            p.done = true;
            if (n++ % 4 === 0) etchDot(sc, p.x, floor + (n % 3));
            continue;
          }
        }
        alive++;
        const fall = Math.max(0, el - p.delay);
        const c = p.c === PAL.ink ? PAL.ink : fall < 80 ? (p.c === PAL.gold3 ? PAL.gold3 : PAL.leaf3) : fall < 220 ? PAL.leaf2 : PAL.leaf1;
        px.dot(p.x, r(p.y), c);
      }
      return alive > 0;
    },
    () => px.g.destroy(),
  );
}

// ================================================================ the scar ("Zehirli Toprak")

/** The owner's §10.1 switch: every scar lasts the duel (dev: `&venomScars=duel`). */
const VENOM_SCARS_PERSIST: boolean = (() => {
  try {
    return import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).get('venomScars') === 'duel';
  } catch {
    return false;
  }
})();
/** Brief scars hold 2.4 s (scene) after they appear, then step out in 3 frames of 100 ms. */
const BRIEF_MS = 2400;
const MAX_SCARS = 8;

interface Scar {
  at: XY;
  level: number;
  life: 'duel' | 'brief';
  born: number;
  /** The "scar remembers" flash start (scene ms), −1 none. */
  lit: number;
  /** level-3 bubble clock */
  nextPop: number;
  popAt: number;
  seed: number;
}

const SCARS = new Map<string, Scar>();
let scarScene: Phaser.Scene | null = null;
let scarPx: Px | null = null;
/** brief scars lie OVER the card on the tile and the unit shadows (they cover the slot interior), under every body */
let briefPx: Px | null = null;
let stopTicker: (() => void) | null = null;
let clock = 0;

function clearScars(): void {
  SCARS.clear();
  stopTicker?.();
  stopTicker = null;
  if (scarPx && scarPx.g.active) scarPx.g.destroy();
  if (briefPx && briefPx.g.active) briefPx.g.destroy();
  scarPx = null;
  briefPx = null;
  scarScene = null;
}
onDuelStart(clearScars);

function hashN(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Scale a design px (64×32 slot) to the arena's tile. */
const SX = (v: number) => Math.round((v * TILE_W) / 64);
const SY = (v: number) => Math.round((v * TILE_H) / 32);

/** An iso ellipse ring helper: fill ellipse `rx×ry` at (cx, cy) with `c`. */
function ell(px: Px, cx: number, cy: number, rx: number, ry: number, c: number): void {
  for (let y = -ry; y <= ry; y++) {
    const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / ((ry + 0.35) * (ry + 0.35)))));
    if (w >= 0) px.run(cy + y, cx - w, cx + w, c);
  }
}

function drawScar(px: Px, s: Scar, lvlShown: number, now: number): void {
  const { x, y } = s.at;
  // the front half of the slot interior, inset from the owner's border: the centre is under the card
  const fy = y + SY(6);
  const lit = s.lit >= 0 && now - s.lit < 150 ? Math.floor((now - s.lit) / 50) : -1;
  const rim = lit === 1 ? PAL.gold3 : lit >= 0 ? PAL.leaf3 : PAL.leaf1;
  if (lvlShown >= 3) {
    // the death mark: an iso ellipse 26×10, stone0 core, night0 cracks, the leaf1 rim and leaf0 outer step,
    // the chitin hook tip standing in it (stone2, one stone3 lit pixel, no green)
    const rx = SX(13);
    const ry = 5;
    // crit r1 #7: the death ring sits one value step up (leaf2 rim, leaf1 outer step) so it reads at 1×
    ell(px, x, fy, rx + 1, ry + 1, PAL.leaf1);
    ell(px, x, fy, rx, ry, rim === PAL.leaf1 ? PAL.leaf2 : rim);
    ell(px, x, fy, rx - 1, ry - 1, PAL.stone0);
    // the cracks: three night0 forks from the hook outward
    for (const [dx, dy, len] of [[-1, 0, 7], [1, 0, 6], [-1, 1, 3]] as const) for (let i = 1; i <= len; i++) px.dot(x + dx * (i + 1), fy + (i % 3 === 2 ? dy : 0) + (dx < 0 && i > 4 ? -1 : 0), PAL.night0);
    px.dot(x - 4, fy + 2, PAL.night0).dot(x + 5, fy - 2, PAL.night0).dot(x + 6, fy - 2, PAL.night0);
    // the hook tip (crit r1 #7: 4 px tall, 2 px wide at its foot, curled toward the owner's front, ONE gold4
    // pixel on its point — the last of the venom's heart)
    const hx = x + 2;
    px.dot(hx - 1, fy + 1, PAL.ink).dot(hx + 2, fy + 1, PAL.ink).dot(hx + 2, fy, PAL.ink).dot(hx - 1, fy, PAL.ink).dot(hx - 1, fy - 1, PAL.ink).dot(hx + 2, fy - 1, PAL.ink).dot(hx + 1, fy - 3, PAL.ink).dot(hx + 2, fy - 3, PAL.ink).dot(hx + 3, fy - 2, PAL.ink).dot(hx, fy - 2, PAL.ink);
    px.dot(hx, fy + 1, PAL.stone1).dot(hx + 1, fy + 1, PAL.stone1).dot(hx, fy, PAL.stone2).dot(hx + 1, fy, PAL.stone2).dot(hx, fy - 1, PAL.stone2).dot(hx + 1, fy - 1, PAL.stone3).dot(hx + 1, fy - 2, PAL.stone3).dot(hx + 2, fy - 2, PAL.gold4);
    // the bubble at the hook's base: 1 px → a 3-px plus → gone (leaf2, the leaf3 centre only in the middle)
    if (s.popAt >= 0) {
      const k = Math.floor((now - s.popAt) / 70);
      const bx = hx - 2;
      const by = fy + 1;
      if (k === 0) px.dot(bx, by, PAL.leaf2);
      else if (k === 1) px.dot(bx, by, PAL.leaf3).dot(bx - 1, by, PAL.leaf2).dot(bx + 1, by, PAL.leaf2).dot(bx, by - 1, PAL.leaf2).dot(bx, by + 1, PAL.leaf2);
      else if (k === 2) px.dot(bx - 1, by, PAL.leaf1).dot(bx + 1, by, PAL.leaf1);
    }
    return;
  }
  if (lvlShown >= 2) {
    // the dead blot: an iso ellipse 16×6, stone0 with the leaf1 rim and a leaf0 outer step
    const bx = x - SX(2);
    const by = fy + 1;
    ell(px, bx, by, SX(8) + 1, 4, PAL.leaf0);
    ell(px, bx, by, SX(8), 3, rim);
    ell(px, bx, by, SX(8) - 1, 2, PAL.stone0);
    px.dot(bx - 2, by, PAL.night0).dot(bx + 3, by + 1, PAL.night0);
  }
  if (lvlShown >= 1) {
    // three etched pits along the front of the interior, clear of the stat badge under the body's feet
    // (two on the left front edge, one on the right)
    for (let i = 0; i < 3; i++) {
      const pxx = x + [-SX(19), -SX(13), SX(15)][i];
      const pyy = fy + [-3, 0, -1][i];
      if (lvlShown >= 2 && Math.abs(pxx - (x - SX(2))) < SX(8)) continue; // inside the blot
      px.run(pyy - 1, pxx - 1, pxx + 2, PAL.leaf0);
      px.run(pyy, pxx - 1, pxx + 2, rim);
      px.run(pyy, pxx, pxx + 1, PAL.stone0);
      px.run(pyy + 1, pxx, pxx + 1, rim);
    }
    if (lvlShown >= 2) {
      const pxx = x + SX(10);
      const pyy = fy + 2;
      px.run(pyy, pxx - 1, pxx + 2, rim).run(pyy, pxx, pxx + 1, PAL.stone0).run(pyy + 1, pxx, pxx + 1, rim);
    }
  }
}

function ensureTicker(sc: Phaser.Scene): void {
  if (scarScene === sc && scarPx && scarPx.g.active && stopTicker) return;
  clearScars();
  scarScene = sc;
  // above the NT slot art and the stepped light, under every tile highlight (TILE_FX)
  scarPx = layer(sc, DEPTH.TILE_FX - 1);
  briefPx = layer(sc, DEPTH.UNIT - 1);
  sc.events.once('shutdown', clearScars);
  clock = 0;
  stopTicker = onFrame(sc, (dt) => {
    clock += dt;
    const px = scarPx;
    if (!px || !px.g.active || !briefPx || !briefPx.g.active) return false;
    px.clear();
    briefPx.clear();
    // the 2 most recent duel scars bubble; older ones stay still
    const live = [...SCARS.entries()].sort((a, b) => b[1].born - a[1].born);
    let bubbling = 0;
    for (const [key, s] of live) {
      let shown = s.level;
      if (s.life === 'brief') {
        const age = clock - s.born;
        if (age > BRIEF_MS) {
          const k = Math.floor((age - BRIEF_MS) / 100);
          shown = Math.max(0, s.level - 1 - k);
          if (k >= 3 || shown <= 0) {
            SCARS.delete(key);
            continue;
          }
          shown = Math.min(shown, 3 - k);
        }
      } else if (s.level >= 3 && bubbling < 2) {
        bubbling++;
        if (s.popAt >= 0 && clock - s.popAt > 210) s.popAt = -1;
        if (clock >= s.nextPop) {
          s.popAt = clock;
          s.seed++;
          s.nextPop = clock + 2400 + hashN(s.seed) * 1200;
        }
      }
      drawScar(s.life === 'brief' ? briefPx : px, s, shown, clock);
    }
    return true;
  });
}

/** The scar key of a monster zone. */
export const zoneKey = (player: number, zone: number): string => `${player}:${zone}`;
export const podiumKey = (player: number): string => `podium:${player}`;

/** The level a tile's scar shows now (0: none). */
export function scarLevel(sc: Phaser.Scene, key: string): number {
  if (scarScene !== sc) return 0;
  return SCARS.get(key)?.level ?? 0;
}

/**
 * Scar a tile (`at` its floor point): its level rises to `level` (or +1 with `add`), max 3. `life` 'duel' lasts
 * the duel (the death); 'brief' holds 2.4 s and steps out (every scar is 'duel' under the owner's switch).
 */
export function scarTile(sc: Phaser.Scene, key: string, at: XY, o: { level?: number; add?: boolean; life: 'duel' | 'brief' }): void {
  ensureTicker(sc);
  const old = SCARS.get(key);
  const level = Math.min(3, Math.max(old?.level ?? 0, o.add ? (old?.level ?? 0) + 1 : (o.level ?? 1)));
  const life: 'duel' | 'brief' = VENOM_SCARS_PERSIST || o.life === 'duel' || old?.life === 'duel' ? 'duel' : 'brief';
  SCARS.delete(key);
  SCARS.set(key, { at: { x: r(at.x), y: r(at.y) }, level, life, born: clock, lit: -1, nextPop: clock + 600, popAt: -1, seed: (at.x * 31 + at.y) | 0 });
  // the global cap: the oldest brief scar goes first
  while (SCARS.size > MAX_SCARS) {
    const brief = [...SCARS.entries()].filter(([, s]) => s.life === 'brief').sort((a, b) => a[1].born - b[1].born)[0];
    const drop = brief ?? [...SCARS.entries()].sort((a, b) => a[1].born - b[1].born)[0];
    SCARS.delete(drop[0]);
  }
}

/**
 * "The scar remembers": venom's acid lands on a tile that carries its scar — the old pits light up
 * (leaf3 → gold3 → leaf3, 3 frames of 50 ms) with the drip ladder. Returns whether there was a scar.
 */
export function scarRemembers(sc: Phaser.Scene, key: string, pan = 0): boolean {
  if (scarScene !== sc) return false;
  const s = SCARS.get(key);
  if (!s) return false;
  s.lit = clock;
  if (s.life === 'brief') s.born = clock; // a lit brief scar holds again
  [1, 1.12, 1.26].forEach((pitch, i) => sc.time.delayedCall(i * 50, () => play('venomDrip', { volume: 0.25, pitch, pan })));
  void lightFlash(sc, s.at.x, s.at.y + SY(6), PAL.leaf3, 14, 160, { intensity: 0.6 });
  return true;
}
