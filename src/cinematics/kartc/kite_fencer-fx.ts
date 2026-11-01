// Uçurtma Eskrimci (kite_fencer, C9) — the card's own VFX painters for src/cinematics/kartc/kite_fencer.ts.
// Everything is whole pixels in palette tones (no alpha, no ADD tints; palcheck), drawn with the Px rasteriser or
// as textures painted by the card's own rig (drawLooseKite / drawFencer: re-rasterised polygons, never a rotated or
// scaled sprite). Textures are built lazily on first use (nothing runs at import: boot cost, v1 byte-identity).
//
//   kiteTexture    the empty kite as a free object (summon: the falling leaf; death: the cloak flying off screen),
//                  one texture per tilt map, P1 / P2 light
//   poseTexture    a fencer pose that is not a sheet frame (the blade bowing on a blocked lunge)
//   KiteImage      an Image of one of those, origin on the art anchor, mirrored for P2 like a unit
//   needleLine     attack 1's 1-px straight trail at blade height behind the dash (white → mist → steel → gone, real frames)
//   pendulumTrail  attack 2's 1-px curved trail from the analytic swing (one monotonic arc, three age bands)
//   cutSlit        attack 2's contact: a 1-px white crescent lying across the body under the blade + linen fibres
//   scrapFray      the death's ending: the linen scrap twitches toward the wind and frays into drifting threads
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
 * The fleche's needle line: a 1-px straight line at blade height that TRAILS the dash — from where the hand started
 * (`from`) to just behind the dashing body (`tail()`, read every frame while the dash runs). `land()` freezes it and
 * steps it white → mist → steel → gone, one tone per `stepFrames` REAL frames (the hit-stop freezes the scene clock,
 * never this line: it is gone ~150 ms after the contact whatever the stop).
 */
export function needleLine(scene: Phaser.Scene, from: XY, tail: () => XY | null, depth: number, stepFrames = 3): { land(): void; destroy(): void } {
  const px = layer(scene, depth);
  let landedAt = -1;
  let frame = 0;
  let end: XY | null = tail();
  let alive = true;
  const steps = [PAL.white, PAL.mist, PAL.steel];
  const destroy = () => {
    if (!alive) return;
    alive = false;
    stop();
    px.g.destroy();
  };
  const stop = onFrame(scene, () => {
    if (!alive) return false;
    frame++;
    if (landedAt < 0) end = tail();
    const k = landedAt < 0 ? 0 : Math.floor((frame - landedAt) / stepFrames);
    px.clear();
    if (k >= steps.length) {
      destroy();
      return false;
    }
    if (end) px.line(R(from.x), R(from.y), R(end.x), R(end.y), steps[k]);
    return true;
  });
  return {
    land() {
      if (landedAt < 0) landedAt = frame;
    },
    destroy,
  };
}

// ================================================================ attack 2: the blade's curved trail

/**
 * The pendulum's blade trail, drawn from the ANALYTIC swing (never from per-frame sprite points): `at(θ)` gives the
 * blade tip for a swing angle; `push(θ)` records the angle each frame (it only ever grows: one monotonic arc). The
 * arc behind the tip is sampled every ~1.5° and drawn as a 1-px line in three age bands — white (the newest
 * `band` scene ms), mist, steel — and nothing older than `maxSpan` radians of swing (a short crescent hugging the
 * blade). `stop()` lets it go: one band drops every 3 real frames.
 */
export function pendulumTrail(scene: Phaser.Scene, at: (th: number) => XY, depth: number, band = 50, maxSpan = 0.42): { push(th: number): void; stop(): void; destroy(): void } {
  const px = layer(scene, depth);
  const hist: { th: number; el: number }[] = [];
  let now = 0;
  let stoppedAt = -1;
  let frame = 0;
  let alive = true;
  const thAt = (el: number): number => {
    // the angle the swing had at scene time el (linear between the recorded samples)
    if (!hist.length) return 0;
    if (el <= hist[0].el) return hist[0].th;
    for (let i = hist.length - 1; i > 0; i--) {
      const a = hist[i - 1];
      const b = hist[i];
      if (el >= a.el) return b.el === a.el ? b.th : a.th + ((b.th - a.th) * (el - a.el)) / (b.el - a.el);
    }
    return hist[hist.length - 1].th;
  };
  const arc = (th0: number, th1: number, c: number) => {
    if (th1 - th0 < 1e-4) return;
    const n = Math.max(1, Math.ceil((th1 - th0) / 0.026));
    let prev = at(th0);
    for (let i = 1; i <= n; i++) {
      const p = at(th0 + ((th1 - th0) * i) / n);
      px.line(R(prev.x), R(prev.y), R(p.x), R(p.y), c);
      prev = p;
    }
  };
  const halt = onFrame(scene, (_dt, el) => {
    if (!alive) return false;
    now = el;
    frame++;
    px.clear();
    if (hist.length < 1) return true;
    const head = hist[hist.length - 1].th;
    const drop = stoppedAt < 0 ? 0 : Math.floor((frame - stoppedAt) / 3);
    if (drop >= 3) {
      destroy();
      return false;
    }
    const t = stoppedAt < 0 ? now : hist[hist.length - 1].el;
    // never more than maxSpan radians of swing behind the tip (a short crescent hugging the blade, not the whole path)
    const lo = head - maxSpan;
    const b1 = Math.max(lo + (maxSpan * 2) / 3, thAt(t - band));
    const b2 = Math.max(lo + maxSpan / 3, thAt(t - band * 2));
    const b3 = Math.max(lo, thAt(t - band * 3));
    // oldest first, so the newer bands lie over the joints
    if (drop < 1) arc(b3, b2, PAL.steel);
    if (drop < 2) arc(b2, b1, drop === 1 ? PAL.steel : PAL.mist);
    arc(b1, head, drop === 0 ? PAL.white : drop === 1 ? PAL.mist : PAL.steel);
    return true;
  });
  const destroy = () => {
    if (!alive) return;
    alive = false;
    halt();
    px.g.destroy();
  };
  return {
    push(th: number) {
      const last = hist[hist.length - 1];
      if (last && th < last.th) th = last.th;
      if (last && last.el === now) last.th = th;
      else hist.push({ th, el: now });
    },
    stop() {
      if (stoppedAt < 0) stoppedAt = frame;
    },
    destroy,
  };
}

/**
 * The lateral cut on the target: a 1-px white CRESCENT lying across the body (mostly level, `len` px, sagging 2–3 px in
 * the middle like the bottom of the swing that made it), 4 px under the blade's tip and 2 px on past it — so it never
 * sits on the blade (which runs up and back from the tip). It opens across in 2 real frames (the hit-stop freezes the
 * scene clock, not the opening), its middle gapes 1 px on the first steps (a slit, not a scratch), and it HOLDS white
 * until `holdMs` of scene time after the stop has let go (so it outlives the shared contact flash by several frames),
 * then steps mist → steel → gone. With `fibres`, 2–3 linen threads (earth4, one earth3) peel off its lower edge and
 * drift 4–6 px forward and down. `dir` = the swing's screen direction ±1. Whole pixels, palette only.
 */
export function cutSlit(scene: Phaser.Scene, at: XY, dir: 1 | -1, depth: number, o: { fibres?: boolean; len?: number; holdMs?: number; stepMs?: number; rnd?: () => number } = {}): Promise<void> {
  const px = layer(scene, depth);
  const L = o.len ?? 11;
  const holdMs = o.holdMs ?? 150;
  const stepMs = o.stepMs ?? 50;
  const rnd = o.rnd ?? Math.random;
  const c0 = { x: at.x + dir * 2, y: at.y + 4 };
  const sag = 2.5;
  /** u 0 → 1 runs along the swing (back → front); the middle sags `sag` px. */
  const pt = (u: number): XY => ({ x: c0.x + dir * (u - 0.5) * L, y: c0.y + Math.sin(u * Math.PI) * sag - (u - 0.5) * 1.2 });
  // the threads leave from the lower edge between 30 % and 75 % of the cut
  const fibres =
    o.fibres === false
      ? []
      : Array.from({ length: 3 }, (_, i) => {
          const p = pt(0.3 + i * 0.22 + rnd() * 0.05);
          const dist = 4 + rnd() * 2;
          return { x0: p.x, y0: p.y + 1, dx: dir * dist * (0.5 + rnd() * 0.3), dy: dist * 0.85, len: i === 1 ? 1 : 2, c: i === 2 ? PAL.earth3 : PAL.earth4, lean: i === 0 ? 0 : 1 };
        });
  let frame = 0;
  let open = -1; // the scene time the hit-stop let go (the hold counts from there)
  return new Promise((resolve) => {
    onFrame(scene, (_dt, el) => {
      frame++;
      px.clear();
      if (open < 0 && el > 0) open = el;
      const after = open < 0 ? 0 : el - open;
      const k = after < holdMs ? 0 : 1 + Math.floor((after - holdMs) / stepMs);
      const col = [PAL.white, PAL.mist, PAL.steel][k];
      if (col !== undefined) {
        const reach = Math.min(1, frame / 2);
        const n = Math.max(2, Math.round(L * reach));
        let prev = pt(0);
        for (let i = 1; i <= n; i++) {
          const q = pt(i / L);
          px.line(R(prev.x), R(prev.y), R(q.x), R(q.y), col);
          prev = q;
        }
        // the gaping middle (1 px under the 3 middle pixels) while it is fresh
        if (k === 0 && reach >= 1)
          for (let i = Math.round(L * 0.38); i <= Math.round(L * 0.62); i++) {
            const q = pt(i / L);
            px.dot(R(q.x), R(q.y) + 1, PAL.mist);
          }
      }
      // the threads: they appear as the cut has opened and drift for 360 ms (eased), then go
      const ft = clamp01((after - 10) / 360);
      if (frame > 2 && ft < 1)
        for (const f of fibres) {
          const e = 1 - (1 - ft) * (1 - ft);
          const x = f.x0 + f.dx * e;
          const y = f.y0 + f.dy * e;
          for (let j = 0; j < f.len; j++) px.dot(R(x + j * f.lean * dir), R(y + j), ft > 0.8 && f.c === PAL.earth4 ? PAL.earth3 : f.c);
        }
      if (k >= 3 && ft >= 1) {
        px.g.destroy();
        resolve();
        return false;
      }
      return true;
    });
  });
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

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
export function tautString(
  scene: Phaser.Scene,
  tail: () => XY | null,
  pin: XY,
  depth: number,
  sag: () => number = () => 0,
  o: { color?: number; flashFrames?: number; flash?: number; ink?: boolean } = {},
): { destroy(): void } {
  const px = layer(scene, depth);
  let alive = true;
  let tick = 0;
  let frames = 0;
  const halt = onFrame(scene, (dt) => {
    if (!alive) return false;
    if (dt > 0) tick++;
    frames++;
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
    // (an ink shadow 1 px under it: the line reads over a burning / flashing attacker)
    if (o.ink) poly(px, pts.map((q) => ({ x: q.x, y: q.y + 1 })), PAL.ink);
    // (the first flashFrames real frames in the flash tone: a line twanging bright as it pulls tight)
    poly(px, pts, frames <= (o.flashFrames ?? 0) ? (o.flash ?? PAL.white) : (o.color ?? PAL.earth4));
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
      if (k === 0) px.dot(R(at.x), R(at.y), PAL.white).dot(R(at.x) - 1, R(at.y), PAL.white).dot(R(at.x) + 1, R(at.y), PAL.white).dot(R(at.x), R(at.y) - 1, PAL.white).dot(R(at.x), R(at.y) + 1, PAL.white);
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

/**
 * The death's own ending (no shared burst): the linen scrap (its twitch toward the wind is the sheet's last death frame)
 * FRAYS into four 1-px threads (earth4 / earth3) that tear off up and after the cloak (`dir` ±1) and blink out in
 * palette steps (earth4 → earth3 → earth2 → gone). Each thread carries a 1-px ink shadow under it, so it reads over the
 * lit card face that the body uncovers. The first two frames keep a shrinking stub of the scrap (inked) where the
 * threads leave it. `onLast` fires on the last thread frame (the card is born there). Scene-time steps (no alpha).
 */
export function scrapFray(scene: Phaser.Scene, at: XY, dir: 1 | -1, depth: number, rnd: () => number, onLast: () => void): Promise<void> {
  const px = layer(scene, depth);
  const threads = [0, 1, 2, 3].map((i) => ({
    x: at.x + dir * (-2 + i * 1.5),
    y: at.y - 1 - (i % 2),
    vx: dir * (70 + rnd() * 22 + i * 12),
    vy: -(52 + rnd() * 16 + (3 - i) * 7),
    len: 3 + (i % 2),
    ph: rnd() * 6,
    c: i % 2 ? PAL.earth3 : PAL.earth4,
  }));
  const FRAY = 260;
  let fired = false;
  const fire = () => {
    if (fired) return;
    fired = true;
    onLast();
  };
  return new Promise((resolve) => {
    onFrame(scene, (dt, el) => {
      px.clear();
      const t = el / FRAY;
      if (t >= 1) {
        fire();
        px.g.destroy();
        resolve();
        return false;
      }
      // the stub of the scrap the threads tear out of (inked, shrinking toward the wind)
      if (t < 0.22) {
        const w = t < 0.11 ? 4 : 2;
        const x0 = R(at.x + (dir > 0 ? 4 - w : -4));
        px.run(R(at.y) + 1, x0 - 1, x0 + w, PAL.ink);
        px.run(R(at.y), x0 - 1, x0 + w, PAL.ink);
        px.run(R(at.y), x0, x0 + w - 1, PAL.earth3);
        px.run(R(at.y) - 1, x0, x0 + w - 1, PAL.ink);
      }
      const step = t < 0.45 ? 0 : t < 0.75 ? 1 : 2;
      for (const th of threads) {
        th.x += (th.vx * dt) / 1000;
        th.y += (th.vy * dt) / 1000;
        th.vy += (90 * dt) / 1000; // the gust lets go of them: they slow and start to settle
        th.vx *= 1 - (2.2 * dt) / 1000;
        const c = step === 0 ? th.c : step === 1 ? PAL.earth3 : PAL.earth2;
        const w = Math.round(Math.sin(el * 0.035 + th.ph));
        const pts: [number, number][] = [];
        for (let j = 0; j < th.len; j++) pts.push([R(th.x - dir * j), R(th.y + (j === th.len - 1 ? w : 0))]);
        for (const [x, y] of pts) px.dot(x, y + 1, PAL.ink);
        for (const [x, y] of pts) px.dot(x, y, c);
      }
      if (t >= 0.9) fire();
      return true;
    });
  });
}
