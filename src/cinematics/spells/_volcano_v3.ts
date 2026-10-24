// Volkan Arenası, the v3 look — lane A5-A step A-3 (docs/v3/A5_PLAN.md §3.2, §4.5). The FIELD half:
// the persistent ambience and the lava front's timing. The scene itself is in ./volcano_arena.ts
// (its V3_A5_A branch); the field auras of the monsters are src/duel/auras-v3.ts.
//
//   volcanoAmbienceV3(scene, on, { pad, delayMs })   the ambience on / off (resolves on its level)
//   volcanoAmbienceOnV3(scene)                        it exists (fading in, on or fading out)
//   frontArrivalMs(origin, player, zone)              when the calm arena's lava front reaches a
//                                                     monster zone (ms after setTheme('volcano'))
//
// src/vfx/setpieces.ts setVolcanoAmbience / volcanoAmbienceOn hand over to the first two on their
// first line under V3_A5_A, so every caller (the scene, DuelScene's sync, the default fieldSpell
// handler) gets the v3 ambience; without V3_A5_A nothing here runs (v1 and the plain v3 look are
// untouched).
//
// What the v3 ambience draws — palette tones on whole pixels, no alpha, no full-screen object:
//   seam embers  sparks boil off the lava seams between the zones and rise 8–22 px, cooling by
//                palette steps fire4 → fire3 → fire2 → stone1 (REHBER §2.3 lava); a hot one has a
//                1-px fire2 tail for its first frames; sorted by their seam's screen y, so a monster
//                in front hides them;
//   ash          grey flakes (stone3 / stone2, a few night4) drift down over the arena, swaying on
//                whole pixels and tumbling 1×1 → 2×1 → 1×2;
//   the pad      on the volcano's own field pad: a faint fire light (the stepped light layer,
//                'breathe') and, every 0.6–0.9 s, a pop of 2–3 lava sparks that arc up 8–14 px and
//                fall back on the pad, cooling.
// NOT built (the v1 look's setVolcanoAmbience): the full-screen ADD `wash` rectangle, the six ADD heat
// rasters, the sky / glow / low gradient rasters, and its `fieldChange` sound (the v3 scene scores its
// own beats). REDUCED_MOTION halves the particles.
//
// Leaf module: setpieces.ts imports it, so it must not import setpieces, spellfx or the cinematic
// kits (an import cycle could leave their classes uninitialised at load). It ticks on its own scene
// 'update' listener on setpieces.onFrame's clock (delta capped at 50 ms × tweens.timeScale: speed
// and hit-stop aware). Its random stream is its own (seeded per instance): the shared set-piece
// stream is never drawn from.

import Phaser from 'phaser';
import type { PlayerId } from '../../engine/types';
import { PAL } from '../../art/palette';
import { mulberry32 } from '../../art/pixel';
import { DEPTH, isoToScreen, unitDepth, zoneXY, type XY } from '../../view/layout';
import { REDUCED_MOTION } from '../../view/v3/motion';
import { lightPool, type LightHandle } from '../../view/light';
import { TEX } from '../../vfx/core';

// =================================================================================== the lava front

/**
 * Seam distance (BFS px along the lava cracks, src/art/arena.ts buildCrackField with its default
 * seed) from the volcano's field zone to the seam ring of each monster zone, and the field's
 * `mostDist` (the calm arena spreads the lava to mostDist over 900 ms, Sine.Out, then on to the end in
 * 200 ms — BoardViewCalm.setTheme). Index: [origin player][zone owner][monster index]. A unit test
 * recomputes the table from buildCrackField (tests/cinematics/a5-spells.test.ts).
 */
export const FRONT_DIST: readonly (readonly (readonly number[])[])[] = [
  [
    [0, 30, 62],
    [95, 63, 31],
  ],
  [
    [95, 63, 31],
    [0, 30, 62],
  ],
];
export const FRONT_MOST: readonly number[] = [187, 185];
/** The calm arena's spread to mostDist (BoardViewCalm.setTheme: 900 ms, Sine.Out). */
export const FRONT_SPREAD_MS = 900;

/** When the lava front reaches seam distance `d` (ms after setTheme('volcano', true, origin)). */
export function frontMsAt(d: number, most: number): number {
  if (d <= 0) return 0;
  if (d >= most) return FRONT_SPREAD_MS;
  return Math.round((Math.asin(d / most) * 2 * FRONT_SPREAD_MS) / Math.PI);
}

/** When the front reaches monster zone `zone` of `player`, for a volcano erupting from `origin`'s field. */
export function frontArrivalMs(origin: PlayerId, player: PlayerId, zone: number): number {
  const d = FRONT_DIST[origin]?.[player]?.[zone];
  return d === undefined ? FRONT_SPREAD_MS : frontMsAt(d, FRONT_MOST[origin]);
}

/**
 * The beat times of a list of arrivals (ms, any order): each beat at its own arrival, never closer
 * than `gap` to the previous one (A5 §3.2: by distance, ≥ 150 ms apart; the front itself is never
 * changed). Returns the times in the input order.
 */
export function beatTimes(arrivals: readonly number[], gap = 150): number[] {
  const order = arrivals.map((t, i) => ({ t, i })).sort((a, b) => a.t - b.t || a.i - b.i);
  const out = new Array<number>(arrivals.length);
  let last = -Infinity;
  for (const o of order) {
    const t = Math.max(o.t, last + gap);
    out[o.i] = t;
    last = t;
  }
  return out;
}

// =================================================================================== the ambience

/** Particle counts at full level (REDUCED_MOTION: halved). */
export const AMBIENCE_COUNTS = { embers: 24, ash: 18 } as const;

const EMBER = [PAL.fire4, PAL.fire3, PAL.fire2, PAL.stone1] as const;
const ASH = [PAL.stone3, PAL.stone2, PAL.night4] as const;
/** Level ramps (ms of scene time from 0 to 1 and back). */
const RAMP_IN = 600;
const RAMP_OUT = 420;

interface Ember {
  head: Phaser.GameObjects.Image;
  tail: Phaser.GameObjects.Image;
  x: number;
  y: number;
  floor: number;
  vx: number;
  vy: number;
  sway: number;
  ph: number;
  age: number;
  life: number;
  /** a pad pop: thrown up, falls back with gravity onto `floor` */
  pop: boolean;
}

interface Flake {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ph: number;
  tone: number;
  shape: number;
  turnAt: number;
  /** stepping in from the dark (ms since birth; −1 = done) */
  born: number;
  /** cooling out (target 0): palette steps down to nothing */
  dying: number;
}

interface Amb {
  alive: boolean;
  level: number;
  target: 0 | 1;
  /** scene time before the level starts to rise (the lava is still spreading) */
  delay: number;
  waiters: (() => void)[];
  rnd: () => number;
  embers: Ember[];
  ash: Flake[];
  pad: XY | null;
  padLight: LightHandle | null;
  padNext: number;
  el: number;
  reported: number;
  stop: () => void;
}

const ambs = new WeakMap<Phaser.Scene, Amb>();

export interface AmbienceOpts {
  /** The volcano's field pad: its owner (default: found on the field view — the tile holding Volkan Arenası). */
  pad?: PlayerId | null;
  /** Hold the level at 0 this long first (ms of scene time; the scene waits for the lava's spread). */
  delayMs?: number;
}

/** The player whose field zone holds a face-up Volkan Arenası tile (duck-typed scene.views.field), or null. */
function findPad(scene: Phaser.Scene): PlayerId | null {
  try {
    const field = (scene as unknown as { views?: { field?: { tileAt(p: PlayerId, s: 'field', i: number): { cardId: string | null; active?: boolean } | null } } }).views?.field;
    if (!field) return null;
    for (const p of [0, 1] as PlayerId[]) {
      const t = field.tileAt(p, 'field', 0);
      if (t && t.active !== false && t.cardId === 'volcano_arena') return p;
    }
  } catch {
    /* no field view (previews) */
  }
  return null;
}

/** A random point on the lava seams (the lines between the zones of the 5×5 grid and round it). */
function seamPoint(rnd: () => number): XY {
  const k = Math.floor(rnd() * 6) - 0.5;
  const t = -0.5 + rnd() * 5;
  const p = rnd() < 0.5 ? isoToScreen(k, t) : isoToScreen(t, k);
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

function px(scene: Phaser.Scene): Phaser.GameObjects.Image {
  return scene.add.image(0, 0, TEX.px1).setOrigin(0, 0);
}

function build(scene: Phaser.Scene): Amb {
  const a: Amb = {
    alive: true,
    level: 0,
    target: 1,
    delay: 0,
    waiters: [],
    rnd: mulberry32(0x0a5e3b1),
    embers: [],
    ash: [],
    pad: null,
    padLight: null,
    padNext: 400,
    el: 0,
    reported: -1,
    stop: () => undefined,
  };
  const nEmbers = REDUCED_MOTION ? Math.ceil(AMBIENCE_COUNTS.embers / 2) : AMBIENCE_COUNTS.embers;
  const nAsh = REDUCED_MOTION ? Math.ceil(AMBIENCE_COUNTS.ash / 2) : AMBIENCE_COUNTS.ash;
  const rr = (lo: number, hi: number) => lo + a.rnd() * (hi - lo);

  const spawnEmber = (pop: boolean): void => {
    const at = pop && a.pad ? { x: a.pad.x + Math.round(rr(-6, 6)), y: a.pad.y + Math.round(rr(-3, 3)) } : seamPoint(a.rnd);
    const head = px(scene);
    const tail = px(scene);
    const d = unitDepth(at.y) + 0.4;
    head.setDepth(d);
    tail.setDepth(d - 0.01);
    a.embers.push({
      head,
      tail,
      x: at.x,
      y: at.y,
      floor: at.y,
      vx: pop ? rr(-22, 22) : rr(-3, 3),
      vy: pop ? rr(-62, -44) : rr(-38, -18),
      sway: pop ? 0 : rr(1, 2.5),
      ph: rr(0, Math.PI * 2),
      age: 0,
      life: pop ? 900 : rr(620, 1000),
      pop,
    });
  };
  const spawnFlake = (anywhere: boolean): void => {
    const img = px(scene).setDepth(DEPTH.FX - 2);
    const r = a.rnd();
    const tone = r < 0.45 ? 0 : r < 0.85 ? 1 : 2;
    a.ash.push({
      img,
      x: rr(96, 560),
      y: anywhere ? rr(30, 280) : rr(16, 36),
      vx: rr(-10, -4),
      vy: rr(14, 24),
      ph: rr(0, Math.PI * 2),
      tone,
      shape: Math.floor(a.rnd() * 3),
      turnAt: rr(160, 320),
      // a flake born in mid-air steps in from the dark (night4 → its tone), never pops in bright
      born: anywhere ? 0 : -1,
      dying: -1,
    });
  };

  const teardown = (): void => {
    if (!a.alive) return;
    a.alive = false;
    a.stop();
    for (const e of a.embers) {
      e.head.destroy();
      e.tail.destroy();
    }
    a.embers.length = 0;
    for (const f of a.ash) f.img.destroy();
    a.ash.length = 0;
    const l = a.padLight;
    a.padLight = null;
    if (l && l.alive) void l.fadeOut(200);
    if (ambs.get(scene) === a) ambs.delete(scene);
    a.waiters.splice(0).forEach((w) => w());
  };

  const tick = (dt: number): boolean => {
    a.el += dt;
    const s = dt / 1000;
    // ---- level
    if (a.delay > 0) a.delay = Math.max(0, a.delay - dt);
    else if (a.level < a.target) a.level = Math.min(a.target, a.level + dt / RAMP_IN);
    else if (a.level > a.target) a.level = Math.max(a.target, a.level - dt / RAMP_OUT);
    const L = a.level;
    // ---- the pad light: lit as soon as the field is on (also during delayMs: it takes over from the
    // eruption's flash on the pad with no dark gap; faint — the pad keeps a little of that fire)
    if (a.pad && a.target === 1 && !a.padLight) {
      a.padLight = lightPool(scene, a.pad.x, a.pad.y, { color: PAL.fire3, spill: PAL.fire1, radius: 18, floorY: a.pad.y, intensity: 0.55, anim: 'breathe', fadeIn: 360 });
    }
    if (a.target === 0 && a.padLight) {
      const l = a.padLight;
      a.padLight = null;
      if (l.alive) void l.fadeOut(300);
    }
    // ---- spawn while on
    if (a.target === 1 && L > 0 && dt > 0) {
      const live = a.embers.filter((e) => !e.pop).length;
      if (live < Math.round(nEmbers * L) && a.rnd() < dt / 40) spawnEmber(false);
      const flakes = a.ash.filter((f) => f.dying < 0).length;
      // while the level rises the flakes appear all over the arena (stepping in from the dark);
      // at full level a lost flake is replaced at the top
      if (flakes < Math.round(nAsh * L)) spawnFlake(L < 1);
      if (a.pad && a.el >= a.padNext) {
        a.padNext = a.el + rr(600, 900);
        const n = REDUCED_MOTION ? 1 : 2 + Math.floor(a.rnd() * 2);
        for (let i = 0; i < n; i++) spawnEmber(true);
      }
    }
    // ---- embers
    for (let i = a.embers.length - 1; i >= 0; i--) {
      const e = a.embers[i];
      e.age += dt;
      if (e.pop) {
        e.vy += 260 * s;
        e.x += e.vx * s;
        e.y += e.vy * s;
        if (e.y >= e.floor && e.vy > 0) {
          e.y = e.floor;
          e.vx = 0;
          e.vy = 0;
        }
      } else {
        e.x += (e.vx + Math.sin(e.ph + e.age * 0.012) * e.sway * 6) * s;
        e.y += e.vy * s;
        e.vy *= Math.exp(-0.9 * s);
      }
      const k = e.age / e.life;
      if (k >= 1 || (a.target === 0 && k > 0.5)) {
        e.head.destroy();
        e.tail.destroy();
        a.embers.splice(i, 1);
        continue;
      }
      // cooling by palette steps (fire4 → fire3 → fire2 → stone1); no alpha
      const tone = EMBER[Math.min(EMBER.length - 1, Math.floor(k * EMBER.length))];
      const x = Math.round(e.x);
      const y = Math.round(e.y);
      e.head.setPosition(x, y).setTint(tone);
      // the 1-px tail under a hot ember while it climbs fast
      const tailOn = k < 0.3 && e.vy < -12;
      e.tail.setVisible(tailOn);
      if (tailOn) e.tail.setPosition(x, y + 1).setTint(PAL.fire2);
    }
    // ---- ash
    for (let i = a.ash.length - 1; i >= 0; i--) {
      const f = a.ash[i];
      if (a.target === 0 && f.dying < 0) f.dying = a.rnd() * 160;
      f.x += (f.vx + Math.sin(f.ph + a.el * 0.003) * 5) * s;
      f.y += f.vy * s;
      f.turnAt -= dt;
      if (f.turnAt <= 0) {
        f.shape = (f.shape + 1) % 3;
        f.turnAt = 160 + a.rnd() * 160;
      }
      let tone = f.tone;
      if (f.born >= 0) {
        f.born += dt;
        tone = Math.max(f.tone, ASH.length - 1 - Math.floor(f.born / 90));
        if (f.born >= 90 * ASH.length) f.born = -1;
      }
      if (f.dying >= 0) {
        f.dying += dt;
        tone = f.tone + Math.floor(f.dying / 90);
      }
      if (tone >= ASH.length || f.y > 300 || f.x < 80) {
        f.img.destroy();
        a.ash.splice(i, 1);
        continue;
      }
      // 1×1 → 2×1 → 1×2 (whole-pixel scales): the flake tumbles
      f.img
        .setPosition(Math.round(f.x), Math.round(f.y))
        .setScale(f.shape === 1 ? 2 : 1, f.shape === 2 ? 2 : 1)
        .setTint(ASH[tone]);
    }
    // ---- settle notifications
    if (a.level === a.target && a.delay <= 0 && a.reported !== a.target) {
      a.reported = a.target;
      a.waiters.splice(0).forEach((w) => w());
    }
    if (a.level !== a.target) a.reported = -1;
    if (a.target === 0 && a.level === 0 && a.embers.length === 0 && a.ash.length === 0) {
      teardown();
      return false;
    }
    return true;
  };

  let stopped = false;
  const onUpdate = (_t: number, delta: number) => {
    if (stopped) return;
    const dt = Math.min(50, delta) * scene.tweens.timeScale;
    if (!tick(dt)) a.stop();
  };
  a.stop = () => {
    if (stopped) return;
    stopped = true;
    scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, teardown);
  return a;
}

/** Point the pad at `player`'s field zone (null: none); moves the pad light if it changed. */
function setPad(a: Amb, player: PlayerId | null): void {
  const next = player === null ? null : zoneXY(player, 'field', 0);
  const same = (a.pad && next && a.pad.x === next.x && a.pad.y === next.y) || (!a.pad && !next);
  if (same) return;
  a.pad = next ? { x: Math.round(next.x), y: Math.round(next.y) } : null;
  const l = a.padLight;
  a.padLight = null;
  if (l && l.alive) void l.fadeOut(200);
}

/**
 * The v3 volcano ambience on / off (see the header). Resolves when its level reaches the target
 * (on: after `delayMs` + 600 ms; off: 420 ms — the last embers and flakes cool out on their own).
 */
export function volcanoAmbienceV3(scene: Phaser.Scene, on: boolean, o: AmbienceOpts = {}): Promise<void> {
  let a = ambs.get(scene);
  if (a && !a.alive) {
    ambs.delete(scene);
    a = undefined;
  }
  if (!a) {
    if (!on) return Promise.resolve();
    a = build(scene);
    ambs.set(scene, a);
  }
  const amb = a;
  if (on) setPad(amb, o.pad !== undefined ? o.pad : findPad(scene));
  const target = on ? 1 : 0;
  if (on && o.delayMs && amb.level === 0) amb.delay = Math.max(amb.delay, o.delayMs);
  if (amb.target === target && amb.level === target && amb.delay <= 0) return Promise.resolve();
  amb.target = target;
  amb.reported = -1;
  return new Promise<void>((resolve) => amb.waiters.push(resolve));
}

/** True while a v3 volcano ambience exists in the scene (fading in, on, or fading out). */
export function volcanoAmbienceOnV3(scene: Phaser.Scene): boolean {
  const a = ambs.get(scene);
  return !!a && a.alive;
}

/** Test / preview probe: the ambience's live objects (embers count head + tail). */
export function volcanoAmbienceProbe(scene: Phaser.Scene): { level: number; embers: number; ash: number; pad: XY | null } | null {
  const a = ambs.get(scene);
  return a && a.alive ? { level: a.level, embers: a.embers.length, ash: a.ash.length, pad: a.pad } : null;
}
