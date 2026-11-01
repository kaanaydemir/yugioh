// Bulut Yavrusu (cloud_hatchling) — drawing helpers of its cinematics (docs/v3/kart-a/cloud_hatchling.md §5).
// No top-level registration (the cinematics loader imports every file under src/cinematics; this one only
// exports). Everything is drawn on whole pixels, palette tones only, through Px layers:
//   windRing      the hollow ring of wind (the one ring of the strike): a projected circle in the plane at
//                 right angles to its travel, rasterised from two conjugate diameters (vertical + the floor
//                 perpendicular of the travel), cached by (diameter, travel sector)
//   ringShards    the ring snapping into 8 arcs flying out in its own plane
//   grassPatch    the flattened-floor annulus the ring leaves on each stretch of floor it crosses
//   dustDash      2-px dust dashes pushed out from a landing
//   drawCloud     the little raster cloud (3 lobes: white top, mist body, steel belly, a night4 underside)
//   cloudShadow   an ink 2×2-dither ellipse (MonsterUnit's shadow algorithm), redrawn per whole-px size step
//   eggScatter    the float's final break-up: the shown death frame scattered as 2×2 clusters drifting up

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { PixelCanvas } from '../../art/pixel';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { XY } from '../../view/layout';
import { onFrame, type Px } from '../../vfx/combat';
import { layer } from './_kit';

// ================================================================ the wind ring

/** One raster pixel of a ring (offset from its centre): `far` = on the half away from the camera. */
export interface RingPx {
  x: number;
  y: number;
  c: number;
  far: boolean;
}

/** The ring's two conjugate semi-diameters (unit length): vertical, and the floor perpendicular of `travel`. */
export function ringAxes(travel: XY): { v: XY; p: XY } {
  // screen = M·floor with M = [[1, -1], [0.5, 0.5]] (2:1 iso); floor = M⁻¹·screen
  const fx = travel.x / 2 + travel.y;
  const fy = -travel.x / 2 + travel.y;
  // rotate 90° on the floor, back to the screen
  const px = -fy;
  const py = fx;
  let sx = px - py;
  let sy = 0.5 * (px + py);
  const l = Math.hypot(sx, sy) || 1;
  sx /= l;
  sy /= l;
  // the near side of the perpendicular points DOWN the screen
  if (sy < 0) {
    sx = -sx;
    sy = -sy;
  }
  return { v: { x: 0, y: -1 }, p: { x: sx, y: sy } };
}

const ringCache = new Map<string, RingPx[]>();

/** The travel's sector (16 of them): the cache key of a ring's shape. */
function sectorOf(travel: XY): number {
  const a = Math.atan2(travel.y, travel.x);
  return ((Math.round((a / (Math.PI * 2)) * 16) % 16) + 16) % 16;
}

/**
 * The ring of diameter D for a travel direction: a white outer row, a mist row inside it, and on the far
 * half a 1-px steel row inside that (it sits behind a target's depth). Offsets from the centre, cached.
 */
// (crit c3r1 #4) double-thick: TWO white rows outside, then mist, then (far half) steel; `inner` (the contact
// frames) lays a 2-px colour band inside the white (water4: the wind's body as it closes round the target);
// `ghost` draws only the outer row in that one tone (the afterimage ring trailing the flight).
export function windRing(D: number, travel: XY, inner?: number, ghost?: number): RingPx[] {
  const sec = sectorOf(travel);
  const key = `${D}|${sec}|${inner ?? '-'}|${ghost ?? '-'}`;
  const hit = ringCache.get(key);
  if (hit) return hit;
  const a = (sec / 16) * Math.PI * 2;
  const { v, p } = ringAxes({ x: Math.cos(a), y: Math.sin(a) });
  const out = new Map<string, RingPx>();
  const put = (r: number, c: number, farOnly: boolean, rank: number) => {
    const n = Math.max(24, Math.ceil(r * 14));
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const ct = Math.cos(t);
      const st = Math.sin(t);
      const x = Math.round(ct * v.x * r + st * p.x * r);
      const y = Math.round(ct * v.y * r + st * p.y * r);
      const far = st * p.y < 0;
      if (farOnly && !far) continue;
      const k = `${x},${y}`;
      const o = out.get(k);
      // the outer row wins over the inner ones (rank 0 white, 1 mist, 2 steel)
      if (o && (o as RingPx & { rank: number }).rank <= rank) continue;
      out.set(k, { x, y, c, far, rank } as RingPx & { rank: number });
    }
  };
  const r = D / 2;
  if (ghost !== undefined) {
    put(r, ghost, false, 0);
    put(r - 1, ghost, false, 1);
  } else {
    put(r, PAL.white, false, 0);
    put(r - 1, PAL.white, false, 1);
    if (inner !== undefined) {
      put(r - 2, inner, false, 2);
      if (r - 3 >= 1.5) put(r - 3, inner, false, 3);
      // (crit c3r2 #1) a full ring gets a third band row: the closing ring reads as a solid water4 hoop
      if (r - 4 >= 4) put(r - 4, inner, false, 4);
    } else {
      put(r - 2, PAL.mist, false, 2);
      if (r - 3 >= 1.5) put(r - 3, PAL.steel, true, 3);
    }
  }
  const list = [...out.values()].map(({ x, y, c, far }) => ({ x, y, c, far }));
  ringCache.set(key, list);
  return list;
}

/** Draw a ring at (cx, cy); `half`: only its far / near half (for the depth split round a target). */
export function drawRing(px: Px, cx: number, cy: number, D: number, travel: XY, half: 'all' | 'far' | 'near' = 'all', o: { inner?: number; ghost?: number } = {}): void {
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  for (const q of windRing(D, travel, o.inner, o.ghost)) {
    if (half === 'far' && !q.far) continue;
    if (half === 'near' && q.far) continue;
    px.dot(x0 + q.x, y0 + q.y, q.c);
  }
}

/**
 * Three 1-px whistle streaks trailing 6–10 px behind the ring along its travel (top, bottom and the near
 * side of the ring), flickering on alternate display frames.
 */
export function drawStreaks(px: Px, cx: number, cy: number, D: number, travel: XY, tick: number): void {
  const l = Math.hypot(travel.x, travel.y) || 1;
  const bx = -travel.x / l;
  const by = -travel.y / l;
  const { v, p } = ringAxes(travel);
  const r = D / 2;
  const roots: XY[] = [
    { x: v.x * r, y: v.y * r },
    { x: -v.x * r, y: -v.y * r },
    { x: p.x * r, y: p.y * r },
  ];
  roots.forEach((o, i) => {
    if ((tick + i) % 3 === 0) return; // flicker: one streak blinks each frame
    const len = 4 + ((tick + i * 2) % 3);
    const s0 = 3 + i;
    for (let k = 0; k < len; k++) {
      const d = s0 + k;
      px.dot(Math.round(cx + o.x + bx * d), Math.round(cy + o.y + by * d), k < 2 ? PAL.mist : PAL.steel);
    }
  });
}

/** The ring snapping into 8 arcs flying out in its own plane (t 0 … 1 over ≈ 180 ms; stepped tones). */
export function drawShards(px: Px, cx: number, cy: number, D: number, travel: XY, t: number, n = 8): void {
  if (t >= 1) return;
  const { v, p } = ringAxes(travel);
  const r = D / 2 + 2 + Math.round(t * 10);
  const c = t < 0.34 ? PAL.white : t < 0.67 ? PAL.mist : PAL.steel;
  const half = 0.16 * (1 - t * 0.5);
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2 + 0.2;
    for (let s = -2; s <= 2; s++) {
      const a = a0 + (s / 2) * half;
      px.dot(Math.round(cx + Math.cos(a) * v.x * r + Math.sin(a) * p.x * r), Math.round(cy + Math.cos(a) * v.y * r + Math.sin(a) * p.y * r), c);
    }
  }
}

/**
 * The fizzle (t 0 … 1 over ≈ 200 ms): the ring pops into 4 little 2×2 puffs (white → mist → steel) on its
 * vertical and side axes that drift 2–5 px out, with 4 single sparks between them blinking off at half-time.
 */
// (crit c3r2 #1: four 1-px dots were invisible at 1×)
export function drawFizzle(px: Px, cx: number, cy: number, D: number, t: number): void {
  if (t >= 1) return;
  const r = D / 2 + Math.round(t * 5);
  const c = t < 0.34 ? PAL.white : t < 0.67 ? PAL.mist : PAL.steel;
  const big = t < 0.67;
  for (const [dx, dy] of [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ] as const) {
    const x = Math.round(cx + dx * r);
    const y = Math.round(cy + dy * r * 0.7);
    if (big) px.rect(x - 1, y - 1, 2, 2, c);
    else px.dot(x, y, c);
  }
  if (t < 0.5)
    for (const [dx, dy] of [
      [1, -1],
      [1, 1],
      [-1, 1],
      [-1, -1],
    ] as const)
      px.dot(Math.round(cx + dx * r * 0.62), Math.round(cy + dy * r * 0.45), PAL.mist);
}

// ================================================================ floor marks

/**
 * A flattened-floor annulus (14×7 baby, 20×10 grown): a 1-px ring of air-pressed floor catching the light
 * (stone2 fresh, stone1 as it settles; stone0 vanished into the dark arena floor), stepping out by dither.
 */
export function drawGrassPatch(px: Px, cx: number, cy: number, rx: number, step: 0 | 1 | 2): void {
  const ry = rx / 2;
  const n = Math.ceil(rx * 8);
  const seen = new Set<string>();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * rx);
    const y = Math.round(cy + Math.sin(a) * ry);
    const k = `${x},${y}`;
    if (seen.has(k)) continue;
    seen.add(k);
    // step 0: the whole ring; 1: every other pixel; 2: every fourth
    if (step === 1 && (x + y) % 2 !== 0) continue;
    if (step === 2 && (x + 2 * y) % 4 !== 0) continue;
    px.dot(x, y, step === 0 ? PAL.stone2 : PAL.stone1);
  }
}

/** A 2-px dust dash (stone3 → stone2 → stone1 by age t). */
export function drawDust(px: Px, x: number, y: number, t: number): void {
  if (t >= 1) return;
  px.rect(Math.round(x), Math.round(y), 2, 1, t < 0.34 ? PAL.stone3 : t < 0.67 ? PAL.stone2 : PAL.stone1);
}

// ================================================================ the cloud

const cloudCache = new Map<string, { x: number; y: number; c: number }[]>();

/**
 * The little raster cloud, `w`×`h` (22×10 in the summon and the float): three overlapping lobes, white cap
 * toward the key light (top-left), mist body, a steel belly, a 1-px night4 underside line. `sag` presses
 * the lobes down 1 px (the cloud lets go of the egg); `phase` cycles the side lobes ±1 px.
 */
export function cloudPixels(w: number, h: number, sag: 0 | 1, phase: 0 | 1 | 2): { x: number; y: number; c: number }[] {
  const key = `${w}|${h}|${sag}|${phase}`;
  const hit = cloudCache.get(key);
  if (hit) return hit;
  const lobes: [number, number, number, number][] = [
    [-w * 0.27 + (phase === 1 ? -1 : 0), 1 + sag, w * 0.25, h * 0.42],
    [0, -1 + sag, w * 0.3, h * 0.55 - sag * 0.5],
    [w * 0.27 + (phase === 2 ? 1 : 0), 1.5 + sag, w * 0.23, h * 0.4],
  ];
  const inside = (x: number, y: number): number => {
    let best = -1;
    lobes.forEach(([cx, cy, rx, ry], i) => {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) best = best < 0 ? i : best;
    });
    return best;
  };
  const out: { x: number; y: number; c: number }[] = [];
  const W = Math.ceil(w / 2) + 2;
  const H = Math.ceil(h / 2) + 3;
  for (let y = -H; y <= H; y++)
    for (let x = -W; x <= W; x++) {
      const li = inside(x, y);
      if (li < 0) continue;
      const below = inside(x, y + 1) < 0;
      const above = inside(x, y - 1) < 0;
      const [cx, cy, rx, ry] = lobes[li];
      // the lobe's own height (−1 top … 1 bottom) and its lit side (top-left)
      const ny = (y + 0.5 - cy) / ry;
      const nx = (x + 0.5 - cx) / rx;
      let c: number;
      if (below) c = PAL.night4;
      else if (ny > 0.45) c = PAL.steel;
      else if (above && nx < 0.35) c = PAL.white;
      else if (ny < -0.35 && nx < 0.1) c = PAL.white;
      else c = PAL.mist;
      out.push({ x, y, c });
    }
  cloudCache.set(key, out);
  return out;
}

export function drawCloud(px: Px, cx: number, cy: number, w: number, h: number, sag: 0 | 1 = 0, phase: 0 | 1 | 2 = 0): void {
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  for (const q of cloudPixels(w, h, sag, phase)) px.dot(x0 + q.x, y0 + q.y, q.c);
}

/** A cloud puff (≤ 4×3) on its way somewhere: white cap, mist body (stepped `mist` → `white` by t). */
export function drawPuff(px: Px, x: number, y: number, t: number): void {
  const X = Math.round(x);
  const Y = Math.round(y);
  const top = t > 0.5 ? PAL.white : PAL.mist;
  px.run(Y - 1, X, X + 1, top).run(Y, X - 1, X + 2, PAL.mist).run(Y + 1, X, X + 1, PAL.steel);
}

/**
 * (crit c3r2 #2) The death's rising cloud puff, 6×4 with a 1-px steel edge (a 4×3 puff vanished at 1×):
 *   . s W W s .
 *   s W M M M s
 *   s M M M M s
 *   . s s s s .
 * Late in its life (t ≥ 0.7) it thins to the 4×3 puff.
 */
export function drawCloudPuff(px: Px, x: number, y: number, t: number): void {
  if (t >= 0.7) {
    drawPuff(px, x, y, t);
    return;
  }
  const X = Math.round(x) - 3;
  const Y = Math.round(y) - 2;
  const S = PAL.steel;
  px.dot(X + 1, Y, S).run(Y, X + 2, X + 3, PAL.white).dot(X + 4, Y, S);
  px.dot(X, Y + 1, S).dot(X + 1, Y + 1, PAL.white).run(Y + 1, X + 2, X + 4, PAL.mist).dot(X + 5, Y + 1, S);
  px.dot(X, Y + 2, S).run(Y + 2, X + 1, X + 4, PAL.mist).dot(X + 5, Y + 2, S);
  px.run(Y + 3, X + 1, X + 4, S);
}

/** An ink 2×2-dither ellipse on the floor (the drop-shadow algorithm of MonsterUnit, at its 0.5 alpha). */
export function drawCloudShadow(px: Px, cx: number, cy: number, rx: number): void {
  const RX = Math.max(1, Math.round(rx));
  const ry = Math.max(1, Math.round(RX * 0.32));
  const X = Math.round(cx);
  const Y = Math.round(cy);
  for (let y = -ry; y <= ry; y++)
    for (let x = -RX; x <= RX; x++) {
      const dx = x / (RX + 0.5);
      const dy = y / (ry + 0.5);
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      const gx = X + x;
      const gy = Y + y;
      if (d < 0.45 || (d < 0.75 && (gx + gy) % 2 === 0) || (gx % 2 === 0 && gy % 2 === 0)) px.dot(gx, gy, PAL.ink, 0.5);
    }
}

// ================================================================ the egg's break-up

/**
 * The float's final break-up (YENI §5 "piksel dağılması"): the frame on screen (`pc`, read with unitFrame by
 * the caller) is hidden and scattered as whole-px 2×2 clusters drifting up with the cloud, each cluster
 * blinking out on a stepped schedule (top rows first; no alpha fades). Fire-and-forget; `ms` its length.
 */
export function eggScatter(scene: Phaser.Scene, u: MonsterUnit, pc: PixelCanvas, depth: number, ms = 260): Promise<void> {
  const px = layer(scene, depth);
  interface Cl {
    x: number;
    y: number;
    c: number;
    vx: number;
    vy: number;
    off: number;
  }
  const cls: Cl[] = [];
  const b = pc.bounds();
  if (!b) {
    px.g.destroy();
    return Promise.resolve();
  }
  let seed = (u.uid * 2654435761) >>> 0 || 7;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let y = b.y; y < b.y + b.h; y += 2)
    for (let x = b.x; x < b.x + b.w; x += 2) {
      let c: number | null = null;
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ] as const) {
        const q = pc.get(x + dx, y + dy);
        if (q !== null) {
          c = q;
          break;
        }
      }
      if (c === null) continue;
      const w = u.framePoint(x, y);
      const k = (y - b.y) / Math.max(1, b.h);
      cls.push({ x: w.x, y: w.y, c, vx: (rnd() - 0.5) * 30, vy: -(30 + rnd() * 50), off: ms * (0.25 + 0.7 * k) * (0.8 + rnd() * 0.4) });
    }
  return new Promise<void>((resolve) => {
    onFrame(
      scene,
      (dt, el) => {
        px.clear();
        let alive = 0;
        for (const q of cls) {
          if (el >= q.off) continue;
          alive++;
          const s = el / 1000;
          const X = Math.round(q.x + q.vx * s);
          const Y = Math.round(q.y + q.vy * s - 40 * s * s);
          // the last third of its life a cluster shrinks to one pixel (a stepped blink, no alpha)
          if (el > q.off * 0.66) px.dot(X, Y, q.c);
          else px.rect(X, Y, 2, 2, q.c);
        }
        void dt;
        return alive > 0 && el < ms * 1.3;
      },
      () => {
        px.g.destroy();
        resolve();
      },
    );
  });
}
