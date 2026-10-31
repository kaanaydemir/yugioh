// Uçurtma Eskrimci (kite_fencer, C9) — the card's own VFX painters for src/cinematics/kartc/kite_fencer.ts.
// Everything is whole pixels in palette tones (no alpha, no ADD tints; palcheck), drawn with the Px rasteriser or
// as textures painted by the card's own rig (drawLooseKite / drawFencer: re-rasterised polygons, never a rotated or
// scaled sprite). Textures are built lazily on first use (nothing runs at import: boot cost, v1 byte-identity).
//
//   kiteTexture    the empty kite as a free object (summon: the falling leaf; death: the cloak flying off screen),
//                  one texture per tilt map, P1 / P2 light
//   poseTexture    a fencer pose that is not a sheet frame (the blade bowing on a blocked lunge)
//   KiteImage      an Image of one of those, origin on the art anchor, mirrored for P2 like a unit
//   needleLine     attack 1's 1-px straight trail at blade height (white → mist → steel → gone)
//   tipTrail       attack 2's 1-px curved trail behind the blade tip (the pendulum's sweep)
//   cutSlit        attack 2's contact: a curved 1-px white slit across the body + linen fibre threads
//   tautString     attack 2's string from the kite's tail to the pin on the home tile (world space, vibrating)
//   snapWhips      the death's snapped string ends whipping back (two curling 1-px lines)
//   threadMote     a tiny drifting thread (the panel going out)

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { canvasTexture } from '../../art/textures';
import { drawLooseKite, drawFencer, AX, GY, W, H, type Pose } from '../../art/monsters-v3/kite_fencer-rig';
import { Px, onFrame } from '../../vfx/combat';
import type { XY } from '../../view/layout';

export type Light = 'left' | 'right';

// ================================================================ textures

/** The loose-kite canvas: 64×80, the spar crossing at (32, 40). */
export const KITE_TW = 64;
export const KITE_TH = 80;
export const KITE_CX = 32;
export const KITE_CY = 40;

/** One tilt map of the loose kite (string 'up': falling, trailing above; 'down': the snapped stub hanging). */
export function kiteTexture(scene: Phaser.Scene, tilt: number, light: Light, string: 'up' | 'down' | 'none', open = 1, billow = 1): string {
  const key = `kfn:kite:${tilt}:${light}:${string}:${open}:${billow}`;
  if (scene.textures.exists(key)) return key;
  const p = new PixelCanvas(KITE_TW, KITE_TH);
  drawLooseKite(p, KITE_CX, KITE_CY, tilt, open, billow, light, string);
  return canvasTexture(scene, key, p);
}

/** A fencer pose drawn by the card's rig (not a sheet frame), 72×64 like the art. */
export function poseTexture(scene: Phaser.Scene, name: string, pose: Pose, light: Light): string {
  const key = `kfn:pose:${name}:${light}`;
  if (scene.textures.exists(key)) return key;
  const p = new PixelCanvas(W, H);
  drawFencer(p, pose, light);
  return canvasTexture(scene, key, p);
}

/** An Image whose origin is the art anchor (flip-aware, like a MonsterUnit sprite). */
export function anchoredImage(scene: Phaser.Scene, key: string, x: number, y: number, flip: boolean, depth: number): Phaser.GameObjects.Image {
  return scene.add
    .image(Math.round(x), Math.round(y), key)
    .setOrigin((flip ? W - AX : AX) / W, GY / H)
    .setFlipX(flip)
    .setDepth(depth);
}

/** An Image of a loose kite whose origin is the spar crossing (flip-aware). */
export function kiteImage(scene: Phaser.Scene, key: string, x: number, y: number, flip: boolean, depth: number): Phaser.GameObjects.Image {
  return scene.add
    .image(Math.round(x), Math.round(y), key)
    .setOrigin((flip ? KITE_TW - KITE_CX : KITE_CX) / KITE_TW, KITE_CY / KITE_TH)
    .setFlipX(flip)
    .setDepth(depth);
}

// ================================================================ px helpers

const R = Math.round;

/** A graphics layer drawing whole pixels. */
export function layer(scene: Phaser.Scene, depth: number): Px {
  return new Px(scene.add.graphics().setDepth(depth));
}

/** A 1-px polyline (Bresenham per segment). */
function poly(px: Px, pts: readonly XY[], c: number): void {
  for (let i = 1; i < pts.length; i++) px.line(R(pts[i - 1].x), R(pts[i - 1].y), R(pts[i].x), R(pts[i].y), c);
}

// ================================================================ attack 1: the needle line

/**
 * The fleche's needle line: a 1-px straight line at blade height from where the tip started to where it is.
 * `tip()` is read every frame while the dash runs; `land()` freezes it and steps it white → mist → steel → gone
 * (one tone per `stepMs`).
 */
export function needleLine(scene: Phaser.Scene, from: XY, tip: () => XY, depth: number, stepMs = 50): { land(): void; destroy(): void } {
  const px = layer(scene, depth);
  let now = 0;
  let landedAt = -1;
  let end: XY = tip();
  let alive = true;
  const steps = [PAL.white, PAL.mist, PAL.steel];
  const destroy = () => {
    if (!alive) return;
    alive = false;
    stop();
    px.g.destroy();
  };
  const stop = onFrame(scene, (_dt, el) => {
    if (!alive) return false;
    now = el;
    if (landedAt < 0) end = tip();
    const k = landedAt < 0 ? 0 : Math.floor((el - landedAt) / stepMs);
    px.clear();
    if (k >= steps.length) {
      destroy();
      return false;
    }
    px.line(R(from.x), R(from.y), R(end.x), R(end.y), steps[k]);
    return true;
  });
  return {
    land() {
      if (landedAt < 0) landedAt = now;
    },
    destroy,
  };
}

// ================================================================ attack 2: the blade's curved trail

/** The pendulum's 1-px trail behind the blade tip: the last `keepMs` of tip positions, newest white. */
export function tipTrail(scene: Phaser.Scene, tip: () => XY | null, depth: number, keepMs = 150): { stop(): void; destroy(): void } {
  const px = layer(scene, depth);
  const pts: { p: XY; at: number }[] = [];
  let recording = true;
  let alive = true;
  let now = 0;
  const halt = onFrame(scene, (_dt, el) => {
    if (!alive) return false;
    now = el;
    if (recording) {
      const p = tip();
      if (p) {
        const last = pts[pts.length - 1];
        if (!last || R(last.p.x) !== R(p.x) || R(last.p.y) !== R(p.y)) pts.push({ p: { x: R(p.x), y: R(p.y) }, at: el });
      }
    }
    while (pts.length && now - pts[0].at > keepMs) pts.shift();
    px.clear();
    if (!recording && pts.length < 2) {
      destroy();
      return false;
    }
    for (let i = 1; i < pts.length; i++) {
      const age = now - pts[i].at;
      const c = age < keepMs * 0.34 ? PAL.white : age < keepMs * 0.67 ? PAL.mist : PAL.steel;
      px.line(pts[i - 1].p.x, pts[i - 1].p.y, pts[i].p.x, pts[i].p.y, c);
    }
    return true;
  });
  const destroy = () => {
    if (!alive) return;
    alive = false;
    halt();
    px.g.destroy();
  };
  return {
    stop() {
      recording = false;
    },
    destroy,
  };
}

/**
 * The lateral cut on the target: a curved 1-px slit across the body at `at` (a shallow "smile", `dir` = the
 * swing's screen direction, ±1), stepping white → mist → steel → gone; with `fibres`, linen threads (earth4 /
 * earth3, 2–3 px) drift down from it. Whole pixels, palette only.
 */
export function cutSlit(scene: Phaser.Scene, at: XY, dir: 1 | -1, depth: number, o: { fibres?: boolean; width?: number; stepMs?: number; rnd?: () => number } = {}): Promise<void> {
  const px = layer(scene, depth);
  const w = o.width ?? 18;
  const stepMs = o.stepMs ?? 55;
  const rnd = o.rnd ?? Math.random;
  const steps = [PAL.white, PAL.white, PAL.mist, PAL.steel];
  const fibres = o.fibres === false ? [] : Array.from({ length: 5 }, (_, i) => ({ x: at.x + dir * (-w / 2 + 3 + i * (w - 6) / 4) + (rnd() * 2 - 1), y: at.y + 1 + rnd() * 2, vy: 9 + rnd() * 10, vx: dir * (2 + rnd() * 4), len: 2 + Math.floor(rnd() * 2), c: i % 2 ? PAL.earth3 : PAL.earth4, tilt: rnd() < 0.5 ? 1 : 0 }));
  return new Promise((resolve) => {
    onFrame(scene, (dt, el) => {
      px.clear();
      const k = Math.floor(el / stepMs);
      if (k < steps.length) {
        // the slit grows across in the first step (the cut runs through), then stays and fades
        const grow = Math.min(1, el / (stepMs * 0.8));
        const n = Math.max(2, Math.round(w * grow));
        const pts: XY[] = [];
        for (let i = 0; i <= n; i++) {
          const u = i / w;
          const x = at.x + dir * (-w / 2 + i);
          const y = at.y - 2 + Math.round(Math.sin(u * Math.PI) * 3);
          pts.push({ x, y });
        }
        poly(px, pts, steps[k]);
        // the thick middle of the cut on its first frames (2 px)
        if (k < 2) for (let i = Math.round(w * 0.3); i <= Math.min(n, Math.round(w * 0.7)); i++) px.dot(R(at.x + dir * (-w / 2 + i)), R(at.y - 1 + Math.sin((i / w) * Math.PI) * 3), steps[k]);
      }
      for (const f of fibres) {
        f.y += (f.vy * dt) / 1000;
        f.x += (f.vx * dt) / 1000;
        if (el > stepMs) for (let j = 0; j < f.len; j++) px.dot(R(f.x + j * f.tilt), R(f.y + j), f.c);
      }
      if (el > 520 || (k >= steps.length && !fibres.length)) {
        px.g.destroy();
        resolve();
        return false;
      }
      return true;
    });
  });
}

/** Sparks of a glancing cut on a guard (no fibres): 4 short steel streaks off the slit. */
export function glanceSparks(scene: Phaser.Scene, at: XY, dir: 1 | -1, depth: number): Promise<void> {
  const px = layer(scene, depth);
  const d = [
    { x: dir * 1, y: -0.6 },
    { x: dir * 1, y: -1.3 },
    { x: dir * 0.7, y: 0.4 },
    { x: -dir * 0.4, y: -1 },
  ];
  return new Promise((resolve) => {
    onFrame(scene, (_dt, el) => {
      px.clear();
      const k = Math.floor(el / 45);
      if (k > 3) {
        px.g.destroy();
        resolve();
        return false;
      }
      const c = [PAL.white, PAL.mist, PAL.steel, PAL.steel][k];
      for (const v of d) {
        const r0 = 3 + k * 3;
        px.line(R(at.x + v.x * r0), R(at.y + v.y * r0), R(at.x + v.x * (r0 + 3)), R(at.y + v.y * (r0 + 3)), c);
      }
      return true;
    });
  });
}

// ================================================================ the string

/**
 * The kite string in world space: a 1-px earth4 line from `tail()` to the pin, taut (straight, a 1-px vibration
 * at the middle on alternate frames) or slack (a sag of `sag()` px). The pin is a 2-px earth2 peg on the floor.
 */
export function tautString(scene: Phaser.Scene, tail: () => XY | null, pin: XY, depth: number, sag: () => number = () => 0): { destroy(): void } {
  const px = layer(scene, depth);
  let alive = true;
  let tick = 0;
  const halt = onFrame(scene, (dt) => {
    if (!alive) return false;
    if (dt > 0) tick++;
    px.clear();
    const t = tail();
    if (!t) return true;
    const s = sag();
    const mid = { x: (t.x + pin.x) / 2, y: (t.y + pin.y) / 2 };
    const len = Math.hypot(t.x - pin.x, t.y - pin.y) || 1;
    const nx = -(t.y - pin.y) / len;
    const ny = (t.x - pin.x) / len;
    const vib = s > 0.5 ? 0 : (tick >> 1) % 2 ? 1 : -1;
    const m = { x: mid.x + nx * vib, y: mid.y + ny * vib + s };
    const n = Math.max(4, Math.round(len / 6));
    const pts: XY[] = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      // quadratic through the (vibrated / sagged) middle
      const a = (1 - u) * (1 - u);
      const b = 2 * u * (1 - u);
      const c = u * u;
      const cx = 2 * m.x - (t.x + pin.x) / 2;
      const cy = 2 * m.y - (t.y + pin.y) / 2;
      pts.push({ x: a * t.x + b * cx + c * pin.x, y: a * t.y + b * cy + c * pin.y });
    }
    poly(px, pts, PAL.earth4);
    // a tail bow on the string, a third of the way down (the kite's ribbon ties)
    const bq = pts[Math.max(1, Math.round(n / 3))];
    px.dot(R(bq.x) - 1, R(bq.y), PAL.fire2).dot(R(bq.x) + 1, R(bq.y), PAL.gold2);
    // the pin on the home tile
    px.rect(R(pin.x) - 1, R(pin.y) - 1, 2, 2, PAL.earth2);
    px.dot(R(pin.x) - 1, R(pin.y) - 2, PAL.earth3);
    return true;
  });
  return {
    destroy() {
      if (!alive) return;
      alive = false;
      halt();
      px.g.destroy();
    },
  };
}

/** The death's snap: the two string ends whip back as curling 1-px lines (3 steps, then gone). */
export function snapWhips(scene: Phaser.Scene, at: XY, up: XY, down: XY, depth: number): Promise<void> {
  const px = layer(scene, depth);
  return new Promise((resolve) => {
    onFrame(scene, (_dt, el) => {
      px.clear();
      const k = Math.floor(el / 55);
      if (k > 3) {
        px.g.destroy();
        resolve();
        return false;
      }
      const c = k === 0 ? PAL.white : k === 1 ? PAL.earth4 : PAL.earth3;
      for (const [dir, curl] of [
        [up, 1],
        [down, -1],
      ] as const) {
        const L = 5 + k * 3;
        const pts: XY[] = [];
        for (let i = 0; i <= L; i++) {
          const u = i / L;
          const ang = Math.atan2(dir.y, dir.x) + curl * u * u * (1.2 + k * 0.5);
          const r = i * (1 - k * 0.12);
          pts.push({ x: at.x + Math.cos(ang) * r, y: at.y + Math.sin(ang) * r });
        }
        poly(px, pts, c);
      }
      if (k === 0) px.dot(R(at.x), R(at.y), PAL.gold4);
      return true;
    });
  });
}

/** A tiny thread drifting off (2 px, gold3 then earth3), rising and sliding back over `ms`. */
export function threadMote(scene: Phaser.Scene, at: XY, back: number, depth: number, ms = 420): Promise<void> {
  const px = layer(scene, depth);
  return new Promise((resolve) => {
    onFrame(scene, (_dt, el) => {
      px.clear();
      const t = el / ms;
      if (t >= 1) {
        px.g.destroy();
        resolve();
        return false;
      }
      const x = at.x + back * 10 * t + Math.sin(t * 9) * 1.2;
      const y = at.y - 9 * t;
      const c = t < 0.4 ? PAL.gold3 : PAL.earth3;
      px.dot(R(x), R(y), c).dot(R(x) + (Math.floor(el / 90) % 2 ? 1 : 0), R(y) + 1, c);
      return true;
    });
  });
}
