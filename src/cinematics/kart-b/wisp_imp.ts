// Tüy Hayalet / Down Wisp (wisp_imp, R3) — the v3 cinematics (lane B; ?look=v3 only, every
// registration is gated on LOOK_V3: the old look keeps the defaults it always had).
// Spec: docs/v3/YENI_KARTLAR.md §8 R3. Sounds: src/audio/v3/wisp_imp.ts (the game's only "pof").
//
//   summon   "a single feather falls": the sprite's own first summon frame (one feather) swings down
//            from high above the tile like a pendulum (whole-pixel sway, its tilt frame flips with
//            the swing, a cool light follows it) → the sprite's summon pose takes over (it touches the
//            tile: ripple rings of down + a tick) → a feather FOUNTAIN whirls up round the ghost while
//            the pose builds it face first (back half of the whirl behind the body, front half in
//            front) → the whirl flings out on 'land' (a soft "fumf", 1-px settle) → "bö!" (eyes
//            flare gold, a little crown of feathers pops off, the badge pops).
//   strike   "Tüy Oku Sağanağı": the attack continues from the declaration's charge pose (the 130 %
//            puff); on 'release' six feather darts leave the face hollow on six fanned arcs and HOME
//            in; the first one IS the contact (60 ms hit-stop, the number) and the others land as
//            micro jabs ("tsk") spread over the body, each sticks where it hit for a beat and then
//            flakes off and flutters down. Blocked: they glance off the guard and tumble away.
//            Direct: they pepper the duelist.
//   death    (no activate event: killed in defense, a tie, an effect) the WIND takes it — the
//            sprite's death pose is stripped front-to-back while gust streaks cross the tile and the
//            feathers stream off with it, the eyes last; no pof, ever.
//   effect   THE FEATHER PILLOW (the monsterEffect event: the prevented battle damage): the ghost
//            hugs itself into a cushion (special pose), bursts into a cloud of feathers that streams
//            to its owner's LP panel and packs into a pillow (it has the ghost's face); the prevented
//            damage number flies in and smacks into it — the pillow squashes, the eyes squeeze — and
//            it reads "0 · KORUNDU" (gold bell); then the pillow goes POF and the down drifts away.
//            The effect hook owns the wisp's death (the battle kit cannot take it on the contact
//            frame: the activate breaks its consequence scan) — ctx.play(destroy, { pillow }).
//
// Pixel language: every effect is drawn on whole-pixel rasters in palette tones (white / void4 /
// void3 / void2 for the feathers, gold for the eyes), fading by stepping DOWN the ramp, never by
// alpha; no glow sprites, no fractional scale. Camera untouched (no focus calls).

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { PixelCanvas, mulberry32 } from '../../art/pixel';
import { monsterFrame } from '../../art/textures';
import type { MonsterId } from '../../data/cards';
import type { GameEvent, PlayerId } from '../../engine/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, GAME_H, GAME_W, LOOK_V3, panelRect, type XY, zoneXY } from '../../view/layout';
import { lightFlash, lightPool } from '../../view/light';
import { shake } from '../../vfx/core';
import { Raster } from '../../vfx/setpieces';
import { pixelText } from '../../ui/text';
import { fx, registerCardHook, registerStrike } from '../api';
import type { StrikeArgs } from '../_core/types';
import { behindBodies, cardLeaves } from '../_v3/card';
import { strikeStartFrame } from '../_v3/clash';
import { contactFlash } from '../_v3/flash';
import { planGuardBreak, runGuardBreak, showsGuard } from '../_v3/guardbreak';
import { deathStartFrom, takePlannedEntry } from '../_v3/posematch';
import { atFrame, panAt, play, start, takeCharge } from '../_v3/sound';
import { runSummon, type Stage } from '../summon-a/_kit';
import { animate, onFrame, sleep, sourceOwnsDestroy, stopTime, type Ctx, type EvOf } from '../strikes-a/_kit';

const ID: MonsterId = 'wisp_imp';
const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const ri = (v: number): number => Math.round(v);
type Rnd = () => number;
const rr = (r: Rnd, a: number, b: number): number => a + (b - a) * r();

/** Cubic bezier. */
function cbez(a: XY, b: XY, c: XY, d: XY, t: number): XY {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}

/** Quadratic bezier. */
function qbez(a: XY, c: XY, b: XY, t: number): XY {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

/** A live, visible unit. */
function live(u: MonsterUnit | null | undefined): u is MonsterUnit {
  return !!u && !u.retired && u.sprite.active && u.sprite.visible;
}

// ================================================================ the feather (shared painter)

/**
 * Feather tones by fade step: [lit vane, shade vane, quill]. Step 0 is the sprite's own feather
 * (white / lilac void4 / void3 quill); each step goes one value down the ramp; past the last it is gone.
 */
const TONES: readonly (readonly [number, number, number])[] = [
  [PAL.white, PAL.void4, PAL.void3],
  [PAL.void4, PAL.void3, PAL.void2],
  [PAL.void3, PAL.void2, PAL.void1],
];

/**
 * One feather on a raster (world coords of that raster): a quill along `ang` with a vane on each
 * side (the side facing up-left is lit), `len` px long; len ≤ 2 is a speck of down.
 */
function feather(r: Raster, x: number, y: number, ang: number, len: number, step = 0): void {
  if (step >= TONES.length) return;
  const [lit, shade, quill] = TONES[step];
  const cx = ri(x);
  const cy = ri(y);
  if (len <= 2) {
    r.px(cx, cy, lit);
    if (len === 2) r.px(cx + 1, cy, shade);
    return;
  }
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  // the normal whose side faces the light (top-left) carries the lit vane
  let nx = -dy;
  let ny = dx;
  if (nx + ny * 1.6 > 0) {
    nx = -nx;
    ny = -ny;
  }
  const half = (len - 1) / 2;
  const wide = len >= 6;
  for (let i = 0; i < len; i++) {
    const k = i - half;
    const px = cx + dx * k;
    const py = cy + dy * k;
    const tip = i === len - 1;
    const root = i === 0;
    if (!root && !tip) {
      r.px(ri(px + nx), ri(py + ny), lit);
      r.px(ri(px - nx), ri(py - ny), shade);
      if (wide && i >= 2 && i <= len - 3) r.px(ri(px + nx * 2), ri(py + ny * 2), i % 2 ? lit : shade);
    }
    r.px(ri(px), ri(py), root ? quill : tip ? lit : i % 3 === 1 ? shade : quill);
  }
}

/** A free feather particle: drifts, tumbles like a pendulum, steps down its ramp to nothing. */
interface Plume {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ang: number;
  len: number;
  /** Pendulum phase / rate / amplitude (rad). */
  ph: number;
  hz: number;
  swing: number;
  /** Gravity px/s², drag per s. */
  grav: number;
  drag: number;
  age: number;
  life: number;
  delay: number;
  /** Lateral flutter amplitude (px/s). */
  flut: number;
}

/** A pool of free feathers drawn on one raster (stepped fades, whole pixels). */
class Plumes {
  readonly r: Raster;
  readonly list: Plume[] = [];
  private stop: () => void;
  private closed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, depth: number) {
    this.r = new Raster(scene, x, y, w, h, depth);
    this.stop = onFrame(scene, (dt) => this.tick(dt));
  }

  add(p: Partial<Plume> & { x: number; y: number }, rnd: Rnd): void {
    this.list.push({
      vx: 0,
      vy: 0,
      ang: rr(rnd, 0, TAU),
      len: 5,
      ph: rr(rnd, 0, TAU),
      hz: rr(rnd, 1.6, 2.6),
      swing: rr(rnd, 0.5, 0.9),
      grav: 60,
      drag: 2.2,
      age: 0,
      life: 700,
      delay: 0,
      flut: rr(rnd, 10, 22),
      ...p,
    });
  }

  /** No more feathers will be added: it removes itself once the last one is gone. */
  close(): void {
    this.closed = true;
  }

  destroy(): void {
    this.stop();
    this.r.destroy();
  }

  private tick(dt: number): boolean {
    if (!this.r.alive) return false;
    const s = dt / 1000;
    this.r.begin();
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.age += dt;
      if (p.age < p.delay) continue;
      const a = p.age - p.delay;
      if (a >= p.life) {
        this.list.splice(i, 1);
        continue;
      }
      const damp = Math.exp(-p.drag * s);
      p.vx *= damp;
      p.vy = p.vy * damp + p.grav * s;
      p.ph += p.hz * TAU * s;
      p.x += (p.vx + Math.cos(p.ph) * p.flut) * s;
      p.y += p.vy * s;
      const step = Math.floor(clamp((a / p.life - 0.55) / 0.45, 0, 0.999) * TONES.length);
      feather(this.r, p.x, p.y, p.ang + Math.sin(p.ph) * p.swing, p.len, step);
    }
    this.r.end();
    if (this.closed && this.list.length === 0) {
      this.r.destroy();
      return false;
    }
    return true;
  }
}

/** World point of a frame point of `anim` frame `f` (the art's own points table). */
function artPoint(u: MonsterUnit, anim: 'attack' | 'special', f: number, key: 'muzzle' | 'core' | 'head'): XY {
  const p = u.art.points?.(anim, f)?.[key] ?? (key === 'core' ? u.art.core : u.art.muzzle);
  return u.framePoint(p.x, p.y);
}

/** Centre of the opaque pixels of a frame (the summon's lone feather), in frame coords. */
function frameCentre(u: MonsterUnit, anim: 'summon', f: number): XY {
  const b = monsterFrame(ID, anim, f).bounds();
  if (!b) return { x: u.art.anchorX, y: u.art.anchorY - 20 };
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

// ================================================================ summon: the falling feather, the fountain, "bö!"

/** Floor ripple rings of down where the feather touches (whole-pixel iso ellipses stepping down the ramp). */
function ripple(scene: Phaser.Scene, at: XY, depth: number, maxR = 22, ms = 420): Promise<void> {
  const r = new Raster(scene, at.x - maxR - 2, at.y - maxR / 2 - 2, maxR * 2 + 5, maxR + 5, depth);
  return animate(scene, ms, (t) => {
    r.draw(() => {
      for (let k = 0; k < 2; k++) {
        const tk = clamp(t * 1.25 - k * 0.25, 0, 1);
        if (tk <= 0 || tk >= 1) continue;
        const rad = 3 + (maxR - 3) * (1 - (1 - tk) * (1 - tk));
        const step = Math.min(2, Math.floor(tk * 3));
        r.ring(at.x, at.y, rad, rad * 0.45, TONES[step][k === 0 ? 0 : 1]);
      }
    });
  }).then(() => r.destroy());
}

/** The feather fountain: a whirl of feathers spiralling up round the ghost; `fling()` throws them out. */
function fountain(S: Stage, rnd: Rnd): { fling(): void; end(): void } {
  const sc = S.scene;
  const { home } = S;
  const top = S.coreRest.y - 18;
  const N = 16;
  const W = 80;
  const H = Math.ceil(home.y - top + 34);
  const back = new Raster(sc, home.x - W / 2, top - 20, W, H, S.sprite.depth - 0.5);
  const front = new Raster(sc, home.x - W / 2, top - 20, W, H, S.sprite.depth + 0.5);
  const fs = Array.from({ length: N }, (_, i) => ({ a0: (i / N) * TAU + rr(rnd, -0.2, 0.2), d: rr(rnd, 0, 0.35), len: i % 3 === 0 ? 6 : i % 3 === 1 ? 5 : 3, spd: rr(rnd, 0.9, 1.15) }));
  const loose = new Plumes(sc, home.x - 70, top - 50, 140, H + 70, S.sprite.depth + 0.6);
  let flung = false;
  let el0 = 0;
  const stop = onFrame(sc, (_dt, el) => {
    el0 = el;
    back.begin();
    front.begin();
    if (!flung) {
      for (const f of fs) {
        const t = clamp((el / 460) * f.spd - f.d, 0, 1);
        if (t <= 0) continue;
        const a = f.a0 + el * 0.016;
        const rad = lerp(8, 17, Math.sin(Math.PI * Math.min(1, t * 1.1))) + 2;
        const y = lerp(home.y + 2, top + 6, t * t * (3 - 2 * t));
        const x = home.x + Math.cos(a) * rad;
        const yy = y + Math.sin(a) * rad * 0.35;
        const r = Math.sin(a) > 0 ? front : back;
        // tangent of the whirl, tilted up the spiral
        const ang = a + Math.PI / 2 + (S.dir > 0 ? -0.5 : 0.5);
        feather(r, x, yy, ang, f.len, t > 0.92 ? 1 : 0);
      }
    }
    back.end();
    front.end();
    return true;
  });
  return {
    fling() {
      if (flung) return;
      flung = true;
      // the whirl lets go: every feather flies out along its tangent and flutters down
      for (const f of fs) {
        const t = clamp((el0 / 460) * f.spd - f.d, 0, 1);
        const a = f.a0 + el0 * 0.016;
        const rad = lerp(8, 17, Math.sin(Math.PI * Math.min(1, t * 1.1))) + 2;
        const y = lerp(home.y + 2, top + 6, t * t * (3 - 2 * t));
        const x = home.x + Math.cos(a) * rad;
        loose.add({ x, y: y + Math.sin(a) * rad * 0.35, vx: Math.cos(a) * rr(rnd, 50, 90), vy: rr(rnd, -60, -20) + Math.sin(a) * 12, len: f.len, grav: 70, drag: 3, life: rr(rnd, 520, 820), ang: a + Math.PI / 2 }, rnd);
      }
      loose.close();
    },
    end() {
      stop();
      back.destroy();
      front.destroy();
      loose.close();
    },
  };
}

/** The summon (see the header). */
async function summonV3(S: Stage): Promise<void> {
  const sc = S.scene;
  const u = S.unit;
  const spr = S.sprite;
  const rnd = mulberry32(u.uid * 131 + S.home.x);
  const pan = panAt(S.home.x);
  const rest = { x: spr.x, y: spr.y };
  // ---- the pre-roll: frame 0's lone feather swings down from high above (frames 0 / 1 = its two tilts)
  const c0 = frameCentre(u, 'summon', 0);
  const c1 = frameCentre(u, 'summon', 1);
  const w0 = u.framePoint(c0.x, c0.y);
  const w1 = u.framePoint(c1.x, c1.y);
  const off1 = { x: w0.x - w1.x, y: w0.y - w1.y };
  const FALL = 62;
  const PRE = 500;
  u.pose('summon', 0);
  u.showSprite();
  spr.setPosition(rest.x, rest.y - FALL);
  // a lone feather casts no drop shadow: the unit's shadow stays hidden until the fountain has built a body
  let shadowOn = false;
  const hideShadow = () => {
    if (!shadowOn && u.shadow.active) u.shadow.setVisible(false);
  };
  sc.events.on(Phaser.Scenes.Events.PRE_RENDER, hideShadow);
  S.own({ destroy: () => sc.events.off(Phaser.Scenes.Events.PRE_RENDER, hideShadow) });
  const drift = start('wiDrift', { volume: 0.9, pan });
  const moon = lightPool(sc, w0.x, w0.y - FALL, { color: PAL.void4, spill: PAL.void3, radius: 12, floorY: S.home.y, air: 0.7, intensity: 0.45, anim: 'breathe', fadeIn: 120 });
  S.own({ destroy: () => moon.destroy() });
  let lastF = -1;
  await animate(sc, PRE, (t) => {
    if (!spr.active) return;
    const e = 1 - (1 - t) * (1 - t * 0.6);
    const sway = Math.sin(t * TAU * 1.5) * lerp(9, 3, t);
    const f = sway * S.dir >= 0 ? 0 : 1;
    if (f !== lastF) {
      u.pose('summon', f);
      lastF = f;
    }
    const ox = f === 1 ? off1.x : 0;
    const oy = f === 1 ? off1.y : 0;
    const y = rest.y - FALL * (1 - e);
    spr.setPosition(ri(rest.x + sway + ox), ri(y + oy));
    moon.setPosition(ri(w0.x + sway), ri(w0.y - FALL * (1 - e)), S.home.y);
  });
  spr.setPosition(rest.x, rest.y);
  // ---- the summon pose: it keeps falling to the tile, touches, the fountain builds it
  const tile = S.glow({ color: PAL.void4, spill: PAL.void3, radius: 26, intensity: 0, anim: 'breathe', fadeIn: 0 });
  const done = u.playRange('summon', 0);
  const n = u.frameCount('summon');
  const LAND = u.markFrame('summon', 'land', 9);
  const TOUCH = Math.max(1, Math.min(4, LAND - 5));
  const FOUNT = TOUCH + 1;
  // the moonlight follows the feather down
  const follow = onFrame(sc, () => {
    const fi = u.frameInfo();
    if (fi.anim !== 'summon' || fi.frame > TOUCH) return false;
    const c = frameCentre(u, 'summon', fi.frame);
    const w = u.framePoint(c.x, c.y);
    moon.setPosition(ri(w.x), ri(w.y), S.home.y);
    return true;
  });
  S.own({ destroy: follow });
  let whirl: ReturnType<typeof fountain> | null = null;
  atFrame(u, 'summon', TOUCH, () => {
    drift.stop(90);
    play('wiTouch', { volume: 0.9, pan });
    void moon.fadeOut(160);
    tile.setIntensity(0.9, 80);
    void lightFlash(sc, S.home.x, S.home.y - 4, PAL.void4, 22, 280, { floorY: S.home.y, ring: true, intensity: 0.7 });
    void ripple(sc, { x: S.home.x, y: S.home.y }, DEPTH.CARD_ON_TILE + 4);
  });
  atFrame(u, 'summon', FOUNT, () => {
    play('wiFountain', { volume: 0.9, pan });
    whirl = fountain(S, rnd);
    S.own({ destroy: () => whirl?.end() });
  });
  atFrame(u, 'summon', Math.max(FOUNT + 1, LAND - 2), () => (shadowOn = true));
  atFrame(u, 'summon', LAND, () => {
    play('wiLand', { volume: 0.9, pan });
    whirl?.fling();
    tile.setIntensity(0.6, 200);
    void shake(sc, 110, 1);
    void ripple(sc, { x: S.home.x, y: S.home.y }, DEPTH.CARD_ON_TILE + 4, 26, 360);
  });
  // "bö!": the eyes flare gold, a little crown of feathers pops off the hood, the badge pops
  const BOO = Math.min(n - 1, LAND + 1);
  atFrame(u, 'summon', BOO, () => {
    play('wiBoo', { volume: 0.95, pan });
    const head = u.worldPoint('top');
    void lightFlash(sc, head.x, head.y + 10, PAL.gold3, 18, 300, { floorY: S.home.y, air: 0.8, intensity: 0.8 });
    const crown = new Plumes(sc, head.x - 50, head.y - 50, 100, 100, spr.depth + 0.6);
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.42;
      crown.add({ x: head.x + Math.cos(a) * 6, y: head.y + 8 + Math.sin(a) * 4, vx: Math.cos(a) * 70, vy: Math.sin(a) * 80, len: i % 2 ? 4 : 5, grav: 90, drag: 2.5, life: rr(rnd, 560, 760), ang: a }, rnd);
    }
    crown.close();
    void u.badge.pop();
  });
  await done;
  whirl = whirl as ReturnType<typeof fountain> | null;
  void sleep(sc, 400).then(() => whirl?.end());
  void tile.fadeOut(320);
}

if (LOOK_V3)
  registerCardHook(
    ID,
    'summon',
    async (ctx) => {
      if (ctx.ev.from !== 'hand') return ctx.base();
      await runSummon(ctx, async () => undefined, summonV3);
    },
    { priority: 20, name: 'kart-b:wisp_imp:summon' },
  );

// ================================================================ strike: Tüy Oku Sağanağı

interface Dart {
  from: XY;
  ctrl1: XY;
  ctrl2: XY;
  to: XY;
  launch: number;
  flight: number;
  len: number;
  hist: XY[];
  state: 'fly' | 'stuck' | 'gone';
  /** Where it stuck, relative to the struck sprite (follows its knock-back). */
  rel: XY | null;
  stuckAt: number;
  ang: number;
}

/** The six homing darts (see the header). Resolves when the last has landed; `onHit(i, at)` per arrival. */
function volley(s: StrikeArgs, from: XY, rnd: Rnd, onHit: (i: number, at: XY) => void): Promise<void> {
  const sc = s.scene;
  const u = s.attacker;
  const tgt = s.target && live(s.target) ? s.target : null;
  const aim = s.to;
  const dirX = Math.sign(aim.x - from.x) || (u.flipX ? -1 : 1);
  const dist = Math.hypot(aim.x - from.x, aim.y - from.y);
  const N = 6;
  // spread of the landing points over the body (direct: the duelist's chest)
  const spread = s.direct ? { x: 5, y: 6 } : { x: 6, y: 9 };
  const darts: Dart[] = Array.from({ length: N }, (_, i) => {
    const side = i % 2 ? 1 : -1;
    const fan = (14 + (i >> 1) * 7) * side;
    const to = { x: ri(aim.x + rr(rnd, -spread.x, spread.x) - dirX * (s.blocked ? 7 : 0)), y: ri(aim.y + rr(rnd, -spread.y, spread.y * 0.8)) };
    const nx = -(to.y - from.y) / Math.max(1, dist);
    const ny = (to.x - from.x) / Math.max(1, dist);
    return {
      from,
      ctrl1: { x: from.x + (to.x - from.x) * 0.15 + nx * fan, y: from.y + (to.y - from.y) * 0.15 + ny * fan - 10 },
      ctrl2: { x: from.x + (to.x - from.x) * 0.7 + nx * fan * 0.35, y: from.y + (to.y - from.y) * 0.7 + ny * fan * 0.35 - 4 },
      to,
      launch: i * 34 + (i > 2 ? 30 : 0),
      flight: clamp(ri(dist * 1.15 + 90), 200, 330),
      len: i === 0 ? 9 : i % 3 === 0 ? 7 : 8,
      hist: [],
      state: 'fly',
      rel: null,
      stuckAt: 0,
      ang: 0,
    };
  });
  const minX = Math.min(from.x, aim.x) - 60;
  const minY = Math.min(from.y, aim.y) - 60;
  const r = new Raster(sc, minX, minY, Math.abs(aim.x - from.x) + 120, Math.abs(aim.y - from.y) + 120, DEPTH.FX + 2);
  const falls = new Plumes(sc, minX - 20, minY - 20, Math.abs(aim.x - from.x) + 160, Math.abs(aim.y - from.y) + 170, DEPTH.FX + 1);
  const glow = lightPool(sc, from.x, from.y, { color: PAL.void4, spill: PAL.void3, radius: 14, floorY: u.home.y, air: 0.8, intensity: 0.55, anim: 'breathe', fadeIn: 40 });
  const g0 = u.home;
  const g1 = tgt ? tgt.home : s.toGround;
  let landed = 0;
  let resolveAll!: () => void;
  const allIn = new Promise<void>((res) => (resolveAll = res));
  const STICK = 320;
  onFrame(sc, (dt, el) => {
    r.begin();
    let flying = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < N; i++) {
      const d = darts[i];
      const lt = el - d.launch;
      if (lt < 0) continue;
      if (d.state === 'fly') {
        const t = clamp(lt / d.flight, 0, 1);
        // homing: it drifts out on its fan, then accelerates into the body
        const e = t < 0.5 ? 0.8 * t : 0.4 + 1.2 * (t - 0.5);
        const p = cbez(d.from, d.ctrl1, d.ctrl2, d.to, clamp(e, 0, 1));
        const q = d.hist[0] ?? d.from;
        if (Math.abs(p.x - q.x) + Math.abs(p.y - q.y) > 0.6) d.ang = Math.atan2(p.y - q.y, p.x - q.x);
        d.hist.unshift({ x: ri(p.x), y: ri(p.y) });
        if (d.hist.length > 6) d.hist.pop();
        // the trail: a few specks of down stepping down the ramp
        for (let k = 2; k < d.hist.length; k += 1) {
          const h = d.hist[k];
          r.px(h.x, h.y, k < 3 ? PAL.void4 : k < 5 ? PAL.void3 : PAL.void2);
        }
        feather(r, p.x, p.y, d.ang, d.len, 0);
        flying++;
        cx += p.x;
        cy += p.y;
        if (t >= 1) {
          landed++;
          onHit(i, d.to);
          if (s.blocked) {
            // it glances off the guard and tumbles away (never sticks)
            d.state = 'gone';
            falls.add({ x: d.to.x, y: d.to.y, vx: -dirX * rr(rnd, 40, 80), vy: rr(rnd, -70, -40), len: d.len - 1, grav: 160, drag: 2, life: rr(rnd, 460, 640), ang: d.ang + Math.PI, swing: 1.1, hz: 3 }, rnd);
          } else {
            d.state = 'stuck';
            d.stuckAt = el;
            const host = tgt && tgt.sprite.active ? tgt.sprite : null;
            d.rel = host ? { x: d.to.x - host.x, y: d.to.y - host.y } : null;
          }
          if (landed === N) resolveAll();
        }
      } else if (d.state === 'stuck') {
        const host = tgt && tgt.sprite.active && tgt.sprite.visible ? tgt.sprite : null;
        const at = host && d.rel ? { x: host.x + d.rel.x, y: host.y + d.rel.y } : d.to;
        // stuck in the body: the quill buried, the vane quivering a pixel
        const q = Math.floor((el - d.stuckAt) / 50) % 2;
        const back = { x: at.x - Math.cos(d.ang) * 2, y: at.y - Math.sin(d.ang) * 2 + (q ? 0 : 0) };
        feather(r, back.x, back.y, d.ang + (q ? 0.18 : -0.18), Math.max(3, d.len - 2), 0);
        if (el - d.stuckAt > STICK + i * 40 || !host) {
          // it flakes off and flutters down
          d.state = 'gone';
          falls.add({ x: back.x, y: back.y, vx: -dirX * rr(rnd, 10, 30), vy: rr(rnd, -20, 5), len: Math.max(3, d.len - 2), grav: 55, drag: 2.4, life: rr(rnd, 560, 760), ang: d.ang }, rnd);
        }
      }
    }
    r.end();
    if (flying > 0) glow.setPosition(ri(cx / flying), ri(cy / flying), lerp(g0.y, g1.y, 0.5));
    if (darts.every((d) => d.state === 'gone')) {
      r.destroy();
      falls.close();
      void glow.fadeOut(120);
      return false;
    }
    return el < 4000;
  });
  return allIn;
}

/** The strike (see the header). */
async function strikeV3(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const rnd = mulberry32(u.uid * 97 + (s.target?.uid ?? 3) * 13 + 5);
  const f0 = strikeStartFrame(u);
  const REL = u.markFrame('attack', 'release', u.impactFrame);
  const REC = u.markFrame('attack', 'recover', REL + 3);
  const pan = panAt(u.home.x);
  // (the declaration's charge pose started the puff already: the strike takes that voice over)
  const charge = takeCharge(u, 'wiPuff', { volume: 0.85, pan });
  let relDone = false;
  const relSound = () => {
    if (relDone) return;
    relDone = true;
    charge.stop(30);
    play('wiVolley', { volume: 0.9, pan });
  };
  atFrame(u, 'attack', REL, relSound, { late: false });
  atFrame(u, 'attack', REC, () => !s.blocked && play('wiShed', { volume: 0.7, pan }), { late: false });
  const run = u.playRange('attack', f0);
  await sleep(sc, u.rangeMs('attack', f0, REL));
  relSound();
  // ---- release: the darts leave the face hollow of the release frame
  const from = artPoint(u, 'attack', REL, 'muzzle');
  void lightFlash(sc, from.x, from.y, PAL.void4, 14, 160, { floorY: u.home.y, air: 0.8, intensity: 0.6 });
  let first = true;
  const sparks = new Plumes(sc, Math.min(from.x, s.to.x) - 60, Math.min(from.y, s.to.y) - 60, Math.abs(s.to.x - from.x) + 120, Math.abs(s.to.y - from.y) + 120, DEPTH.FX + 3);
  const tsk = new Raster(sc, s.to.x - 40, s.to.y - 40, 80, 80, DEPTH.FX + 4);
  const marks: { x: number; y: number; t: number }[] = [];
  const stopTsk = onFrame(sc, (_dt, el) => {
    tsk.begin();
    for (const m of marks) {
      const a = el - m.t;
      if (a < 0 || a > 70) continue;
      // the "tsk": a tiny white cross + a lilac ring the frame after
      if (a < 35) {
        tsk.px(m.x, m.y, PAL.white);
        tsk.px(m.x - 1, m.y, PAL.white);
        tsk.px(m.x + 1, m.y, PAL.white);
        tsk.px(m.x, m.y - 1, PAL.white);
        tsk.px(m.x, m.y + 1, PAL.white);
      } else tsk.ring(m.x, m.y, 3, 2, PAL.void4);
    }
    tsk.end();
    return el < 3000;
  });
  let clock = 0;
  const clockStop = onFrame(sc, (_dt, el) => {
    clock = el;
    return el < 3000;
  });
  await volley(s, from, rnd, (i, at) => {
    marks.push({ x: at.x, y: at.y, t: clock });
    // a puff of down knocked off where it lands
    for (let k = 0; k < 3; k++) sparks.add({ x: at.x, y: at.y, vx: rr(rnd, -40, 40), vy: rr(rnd, -50, -10), len: k ? 1 : 2, grav: 80, drag: 4, life: rr(rnd, 260, 420) }, rnd);
    if (first) {
      first = false;
      s.impact(at);
      play('wiImpact', { volume: s.blocked ? 0.7 : 0.9, pan: panAt(at.x) });
      void stopTime(sc, 60);
      void lightFlash(sc, at.x, at.y, PAL.white, 20, 240, { floorY: s.target ? s.target.home.y : s.toGround.y, air: 0.7, intensity: 0.7 });
    } else play('wiTsk', { volume: 0.75, pan: panAt(at.x) });
    void i;
  });
  sparks.close();
  void sleep(sc, 200).then(() => {
    stopTsk();
    clockStop();
    tsk.destroy();
  });
  if (!u.sprite.active || u.retired) return;
  if (s.blocked) {
    // the guard holds and throws the volley back: a feather-light recoil
    await sleep(sc, 40);
    if (live(u)) await u.play('hit');
    return;
  }
  await run;
}

if (LOOK_V3) registerStrike(ID, (s) => strikeV3(s), { name: 'kart-b:wisp_imp:strike' });

// ================================================================ death bookkeeping (no material shatter)

interface Leave {
  unit: MonsterUnit;
  home: XY;
  /** The card is born on the tile now and leaves for the graveyard. */
  born(): void;
  /** Await the card's landing (after born()). */
  landed(): Promise<void>;
  /** The unit is gone: retire it, forget the entry. */
  finish(): void;
}

/** deathV3's bookkeeping (claims toGraveyard, releases the field entry), without the shatter. */
function takeDeath(ctx: Ctx<'destroy'>): Leave | null {
  const ev = ctx.ev;
  const field = ctx.views.field;
  const unit = field.unit(ev.uid);
  if (!live(unit)) return null;
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid, {
    until: (e) => e.type !== 'toGraveyard' && e.type !== 'destroy' && e.type !== 'fieldSpell' && e.type !== 'statChange',
  });
  const gEv = gi >= 0 ? (ctx.events[gi] as EvOf<'toGraveyard'>) : null;
  if (gi >= 0) ctx.consumeAt(gi);
  const owner = gEv ? gEv.owner : ctx.owner(ev.uid);
  const { tile } = field.release(ev.uid);
  const home = tile ? { x: tile.home.x, y: tile.home.y } : zoneXY(ev.player, 'monster', ev.zone);
  unit.badge.setVisible(false);
  unit.posed = true;
  ctx.scene.events.emit('v3:dying', unit);
  const onBorn = typeof ctx.hints.onBorn === 'function' ? (ctx.hints.onBorn as () => void) : null;
  let leave: Promise<void> | null = null;
  return {
    unit,
    home,
    born() {
      if (leave) return;
      try {
        onBorn?.();
      } catch (e) {
        console.error('[wisp_imp] onBorn', e);
      }
      if (gEv) leave = cardLeaves(ctx, { owner, cardId: ev.cardId, from: home, tile, depthAt: behindBodies(ctx, unit) }).catch((e) => console.error('[wisp_imp] card', e));
      else if (tile && tile.active)
        leave = tile
          .dissolve(420)
          .then(() => {
            if (tile.active) tile.destroy();
          })
          .catch(() => undefined);
      else leave = Promise.resolve();
    },
    landed() {
      return leave ?? Promise.resolve();
    },
    finish() {
      this.born();
      unit.posed = false;
      if (!unit.retired) unit.retire();
      field.forget(ev.uid);
      ctx.scene.events.emit('v3:dead', unit);
    },
  };
}

// ================================================================ death: the wind takes it

/** Gust streaks across the tile + the feathers peeling off downwind (`dir` ±1), for `ms`. */
function gust(scene: Phaser.Scene, u: MonsterUnit, dir: number, ms: number, rnd: Rnd): { peel(n: number): void; end(): void } {
  const c = u.core();
  const W = 200;
  const r = new Raster(scene, c.x - W / 2, c.y - 50, W, 90, u.sprite.depth + 0.4);
  const plumes = new Plumes(scene, c.x - W / 2 - 40, c.y - 90, W + 80, 150, u.sprite.depth + 0.5);
  const lines = Array.from({ length: 9 }, (_, i) => ({ y: ri(c.y - 28 + i * 6 + rr(rnd, -2, 2)), x0: rr(rnd, -60, 20), len: ri(rr(rnd, 7, 15)), spd: rr(rnd, 240, 330), delay: rr(rnd, 0, ms * 0.5) }));
  const stop = onFrame(scene, (_dt, el) => {
    r.begin();
    for (const l of lines) {
      const a = el - l.delay;
      if (a < 0) continue;
      const x = c.x - dir * 50 + dir * (l.x0 + (a / 1000) * l.spd);
      if (Math.abs(x - c.x) > W / 2 - l.len) continue;
      // a whole-pixel streak, brighter at its head (downwind)
      for (let k = 0; k < l.len; k++) r.px(ri(x - dir * k), l.y, k < 3 ? PAL.void4 : k < 8 ? PAL.void3 : PAL.void2);
    }
    r.end();
    return el < ms;
  });
  return {
    peel(n) {
      if (!u.sprite.active) return;
      const b = u.core();
      for (let i = 0; i < n; i++) {
        plumes.add({ x: b.x + rr(rnd, -9, 9), y: b.y + rr(rnd, -14, 8), vx: dir * rr(rnd, 70, 130), vy: rr(rnd, -45, -10), len: i % 3 === 0 ? 6 : i % 3 === 1 ? 5 : 3, grav: -6, drag: 1.1, life: rr(rnd, 600, 900), flut: rr(rnd, 6, 14), ang: dir > 0 ? 0 : Math.PI, swing: 0.9 }, rnd);
      }
    },
    end() {
      stop();
      r.destroy();
      plumes.close();
    },
  };
}

/** The no-event death (see the header): the wind strips the death pose; no pof. */
async function windDeath(ctx: Ctx<'destroy'>, L: Leave): Promise<void> {
  const u = L.unit;
  const sc = ctx.scene;
  const rnd = mulberry32(u.uid * 61 + 17);
  const pan = panAt(L.home.x);
  const n = u.frameCount('death');
  const DIS = u.markFrame('death', 'dissolve', 4);
  const push = ctx.hints.push as XY | undefined;
  if (ctx.hints.hit !== false) contactFlash(sc, u.sprite, push ?? { x: u.player === 0 ? -1 : 1, y: 0 }, { frames: 2, coverage: 0.4 });
  const inDeath = () => u.frameInfo().anim === 'death';
  // join a lethal recoil's planned entry (react.ts), or break a guard open into the pose
  let planned = takePlannedEntry(u);
  if (!planned && !inDeath() && u.sprite.active && showsGuard(u)) {
    const g = planGuardBreak(u);
    if (g) {
      runGuardBreak(u, g);
      planned = takePlannedEntry(u);
    }
  }
  if (planned && !inDeath()) {
    const lead = Math.min(700, (planned.leadMs ?? u.rangeMs(planned.anim, 0, planned.hold)) + 40);
    await new Promise<void>((res) => onFrame(sc, (_dt, el) => (inDeath() || el >= lead ? (res(), false) : true)));
  }
  if (!inDeath() && u.sprite.active) {
    const from = Math.max(0, Math.min(n - 2, planned ? planned.start : deathStartFrom(u)));
    u.asClaimant(() => void u.playRange('death', from, undefined, { hold: true }));
  }
  // the wind blows backward (away from the side it faces), like the pose's own streaming feathers
  const dir = u.flipX ? 1 : -1;
  const wind = gust(sc, u, dir, 1100, rnd);
  atFrame(u, 'death', Math.max(1, DIS - 1), () => wind.peel(4), { late: false });
  atFrame(
    u,
    'death',
    DIS,
    () => {
      play('wiGust', { volume: 0.9, pan });
      wind.peel(7);
    },
    { late: false },
  );
  atFrame(u, 'death', Math.min(n - 1, DIS + 2), () => wind.peel(6), { late: false });
  // the card is born once the body is mostly gone
  atFrame(u, 'death', Math.min(n - 1, DIS + 3), () => L.born(), { late: false });
  atFrame(u, 'death', n - 1, () => play('wiAway', { volume: 0.8, pan }), { late: false });
  await new Promise<void>((res) =>
    onFrame(sc, (_dt, el) => {
      const fi = u.frameInfo();
      if (!u.sprite.active || (fi.anim === 'death' && fi.frame >= n - 1) || el > 1500) {
        res();
        return false;
      }
      return true;
    }),
  );
  if (u.sprite.active) await sleep(sc, u.frameMs('death', n - 1));
  wind.peel(3);
  L.born();
  void sleep(sc, 500).then(() => wind.end());
}

// ================================================================ effect: the feather pillow

/** The pillow's face states. */
type Face = 'happy' | 'squeeze' | 'open';

/**
 * The pillow (the ghost's face on a cushion with four tufted corners and a piped seam), drawn into
 * `pc` centred at (cx, cy) with half-size a × b; outlined in ink. Light from the top-left.
 */
function paintPillow(pc: PixelCanvas, cx: number, cy: number, a: number, b: number, face: Face): void {
  pc.clear();
  const inside = (x: number, y: number): boolean => {
    const u = (x + 0.5 - cx) / a;
    const v = (y + 0.5 - cy) / b;
    return Math.pow(Math.abs(u), 3.2) + Math.pow(Math.abs(v), 3.2) <= 1;
  };
  for (let y = Math.floor(cy - b - 1); y <= cy + b + 1; y++) {
    for (let x = Math.floor(cx - a - 1); x <= cx + a + 1; x++) {
      if (!inside(x, y)) continue;
      const u = (x + 0.5 - cx) / a;
      const v = (y + 0.5 - cy) / b;
      // light: the top-left of the dome is lit; flat bands
      const l = -u * 0.45 - v + (1 - u * u) * 0.2;
      const c = l > 0.45 ? PAL.white : l > -0.15 ? PAL.void4 : l > -0.7 ? PAL.void3 : PAL.void2;
      pc.set(x, y, c);
    }
  }
  // the piped seam: one step down, 2 px inside the edge (only on the lit part, where it reads)
  for (let y = Math.floor(cy - b); y <= cy + b; y++) {
    for (let x = Math.floor(cx - a); x <= cx + a; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 2, y) || !inside(x + 2, y) || !inside(x, y - 2) || !inside(x, y + 2);
      const deep = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      if (edge && !deep && (x + y) % 2 === 0 && pc.get(x, y) === PAL.white) pc.set(x, y, PAL.void4);
    }
  }
  // four tufts at the corners (little feather spikes)
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const x0 = ri(cx + sx * (a - 1.5));
    const y0 = ri(cy + sy * (b - 1.5));
    for (let k = 1; k <= 3; k++) pc.set(x0 + sx * k, y0 + sy * k, k === 3 ? PAL.void3 : sy < 0 ? PAL.white : PAL.void4);
    pc.set(x0 + sx * 2, y0 + sy * 1, sy < 0 ? PAL.void4 : PAL.void3);
  }
  pc.outline(PAL.ink);
  // the ghost's face hollow and its gold eyes (lights: drawn after the outline)
  const fx0 = ri(cx + 1);
  const fy0 = ri(cy);
  for (let y = -2; y <= 2; y++) for (let x = -4; x <= 4; x++) if ((x * x) / 20 + (y * y) / 5.5 <= 1) pc.set(fx0 + x, fy0 + y, PAL.void0);
  for (let x = -3; x <= 3; x++) pc.set(fx0 + x, fy0 - 3, PAL.ink);
  const eye = (ex: number): void => {
    if (face === 'squeeze') {
      // > <
      pc.set(ex - 1, fy0 - 1, PAL.gold3);
      pc.set(ex, fy0, PAL.gold4);
      pc.set(ex - 1, fy0 + 1, PAL.gold3);
    } else if (face === 'happy') {
      pc.set(ex - 1, fy0, PAL.gold3);
      pc.set(ex, fy0 - 1, PAL.gold4);
      pc.set(ex + 1, fy0, PAL.gold3);
    } else {
      pc.set(ex, fy0 - 1, PAL.gold4);
      pc.set(ex, fy0, PAL.gold3);
    }
  };
  eye(fx0 - 2);
  if (face === 'squeeze') {
    pc.set(fx0 + 3, fy0 - 1, PAL.gold3);
    pc.set(fx0 + 2, fy0, PAL.gold4);
    pc.set(fx0 + 3, fy0 + 1, PAL.gold3);
  } else eye(fx0 + 2);
}

/** A pillow sprite on the HUD layer: a raster you re-paint with a size and a face. */
function pillowView(scene: Phaser.Scene, at: XY): { set(a: number, b: number, face: Face, dy?: number): void; hide(): void; destroy(): void } {
  const W = 64;
  const H = 40;
  const r = new Raster(scene, at.x - W / 2, at.y - H / 2, W, H, DEPTH.HUD + 8);
  const pc = new PixelCanvas(W, H);
  return {
    set(a, b, face, dy = 0) {
      paintPillow(pc, W / 2, H / 2 + dy, a, b, face);
      r.begin();
      r.pc.blit(pc, 0, 0);
      r.end();
    },
    hide() {
      r.begin();
      r.end();
    },
    destroy() {
      r.destroy();
    },
  };
}

/** The flock: feathers stream from `from` to `to` (HUD space), packing in; resolves on arrival. */
function flock(scene: Phaser.Scene, from: XY, to: XY, rnd: Rnd, ms: number): Promise<void> {
  const N = 42;
  const r = new Raster(scene, 0, 0, GAME_W, GAME_H, DEPTH.HUD + 7);
  const up = to.y < from.y ? -1 : 1;
  const fs = Array.from({ length: N }, (_, i) => {
    const a = rr(rnd, 0, TAU);
    const burst = rr(rnd, 6, 20);
    const p0 = { x: from.x + Math.cos(a) * burst, y: from.y + Math.sin(a) * burst * 0.8 };
    const side = rr(rnd, -1, 1);
    return {
      a,
      p0,
      c1: { x: lerp(p0.x, to.x, 0.25) + side * 40, y: lerp(p0.y, to.y, 0.2) - 30 * (up < 0 ? 0.6 : 1.2) + rr(rnd, -10, 10) },
      c2: { x: lerp(p0.x, to.x, 0.7) + side * 18, y: lerp(p0.y, to.y, 0.75) - 16 * (up < 0 ? -0.4 : 1) },
      d: { x: to.x + rr(rnd, -12, 12), y: to.y + rr(rnd, -5, 5) },
      delay: (i / N) * ms * 0.32 + rr(rnd, 0, 30),
      len: i % 4 === 0 ? 7 : i % 4 === 1 ? 5 : i % 4 === 2 ? 4 : 2,
      ph: rr(rnd, 0, TAU),
      prev: p0,
    };
  });
  const BURST = 90;
  return animate(scene, ms, (_t, el) => {
    r.begin();
    for (const f of fs) {
      let p: XY;
      if (el < BURST) {
        // the ghost bursts: the cloud blooms outward first
        const k = el / BURST;
        p = { x: lerp(from.x, f.p0.x, 1 - (1 - k) * (1 - k)), y: lerp(from.y, f.p0.y, 1 - (1 - k) * (1 - k)) };
      } else {
        const lt = clamp((el - BURST - f.delay) / Math.max(1, ms - BURST - f.delay), 0, 1);
        const e = lt * lt * (3 - 2 * lt);
        p = cbez(f.p0, f.c1, f.c2, f.d, e);
        const wob = Math.sin(f.ph + el * 0.03) * 2 * (1 - lt);
        p = { x: p.x + wob, y: p.y };
        if (lt >= 1) continue;
      }
      const ang = Math.atan2(p.y - f.prev.y, p.x - f.prev.x) + Math.sin(f.ph + el * 0.02) * 0.6;
      f.prev = p;
      feather(r, p.x, p.y, ang, f.len, 0);
    }
    r.end();
  }).then(() => r.destroy());
}

/** The pof: a round puff of down bursting off the pillow, specks drifting down (HUD space). */
function pof(scene: Phaser.Scene, at: XY, rnd: Rnd): void {
  const r = new Raster(scene, at.x - 50, at.y - 34, 100, 68, DEPTH.HUD + 9);
  void animate(scene, 260, (t) => {
    r.draw(() => {
      const k = Math.floor(t * 5);
      if (k === 0) {
        r.ell(at.x, at.y, 20, 11, PAL.white);
        r.ell(at.x + 3, at.y + 3, 14, 6, PAL.void4);
      } else if (k === 1) {
        r.ell(at.x, at.y, 26, 14, PAL.void4);
        r.ell(at.x - 1, at.y - 1, 20, 10, PAL.white);
        r.ell(at.x + 2, at.y + 3, 13, 5, PAL.void4);
      } else if (k === 2) {
        // the cloud tears open: a lumpy ring of puffs
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * TAU;
          r.ell(at.x + Math.cos(a) * 24, at.y + Math.sin(a) * 13, 6, 4, i % 3 === 0 ? PAL.void3 : PAL.void4);
          r.ell(at.x + Math.cos(a) * 23 - 1, at.y + Math.sin(a) * 12 - 1, 4, 2, PAL.white);
        }
      } else if (k === 3) {
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * TAU + 0.2;
          r.ell(at.x + Math.cos(a) * 30, at.y + Math.sin(a) * 16, 4, 2, PAL.void3);
        }
      } else r.ring(at.x, at.y, 34, 18, PAL.void2);
    });
  }).then(() => r.destroy());
  const down = new Plumes(scene, at.x - 110, at.y - 80, 220, 170, DEPTH.HUD + 9);
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * TAU + rr(rnd, -0.15, 0.15);
    const v = rr(rnd, 80, 170);
    down.add({ x: at.x + Math.cos(a) * 12, y: at.y + Math.sin(a) * 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 25, len: i % 3 === 0 ? 6 : i % 3 === 1 ? 4 : 2, grav: 45, drag: 2.8, life: rr(rnd, 900, 1300), ang: a }, rnd);
  }
  down.close();
}

/** The pillow death (see the header): `amount` = the prevented battle damage. */
async function pillowDeath(ctx: Ctx<'destroy'>, L: Leave | null, amount: number, owner: PlayerId): Promise<void> {
  const sc = ctx.scene;
  const u = L?.unit ?? null;
  const rnd = mulberry32((u?.uid ?? 7) * 41 + amount);
  const home = L?.home ?? zoneXY(ctx.ev.player, 'monster', ctx.ev.zone);
  const pan = panAt(home.x);
  let burstAt: XY = { x: home.x, y: home.y - 18 };
  if (u && live(u)) {
    // it hugs itself into a cushion (special 0 … release: hug, round, squeeze)
    const REL = u.markFrame('special', 'release', 5);
    atFrame(u, 'special', 2, () => play('wiStuff', { volume: 0.6, pan }), { late: false });
    await u.asClaimant(() => u.playRange('special', 0, REL, { timeScale: 1.3 }));
    burstAt = artPoint(u, 'special', REL, 'core');
    // its poof frame shows one beat (the sprite's own ring of down), then the body IS the cloud
    await sleep(sc, 50);
  }
  play('wiCloud', { volume: 0.9, pan });
  void lightFlash(sc, burstAt.x, burstAt.y, PAL.white, 22, 260, { floorY: home.y, air: 0.8, intensity: 0.7 });
  L?.finish();
  // a few feathers too heavy for the stream float down where it stood
  const left = new Plumes(sc, burstAt.x - 60, burstAt.y - 50, 120, 110, DEPTH.FX + 2);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + rr(rnd, -0.2, 0.2);
    left.add({ x: burstAt.x + Math.cos(a) * 5, y: burstAt.y + Math.sin(a) * 4, vx: Math.cos(a) * rr(rnd, 40, 80), vy: Math.sin(a) * 50 - 30, len: i % 2 ? 3 : 5, grav: 40, drag: 2.6, life: rr(rnd, 700, 1000), ang: a }, rnd);
  }
  left.close();
  // ---- the cloud streams to the owner's LP panel (HUD space)
  const from = fx.screenPoint(ctx, burstAt);
  const lp = fx.lpPoint(ctx, owner);
  const top = lp.y < GAME_H / 2;
  const at = { x: ri(lp.x), y: ri(lp.y) };
  const flight = start('wiFlock', { volume: 0.85, pan: panAt(at.x) });
  const FLY = 420;
  await flock(sc, from, at, rnd, FLY);
  flight.stop(80);
  // ---- it packs into a pillow (the ghost's face on it)
  play('wiStuff', { volume: 0.9, pan: panAt(at.x) });
  const P = pillowView(sc, at);
  const sizes: [number, number][] = [
    [11, 6],
    [21, 12],
    [19, 10],
  ];
  for (const [a, b] of sizes) {
    P.set(a, b, 'open');
    await sleep(sc, 40);
  }
  // ---- the prevented damage flies in and smacks into it
  const num = pixelText(sc, 0, 0, `-${amount}`, { size: 'md', color: PAL.crim3, originX: 0.5, originY: 0.5 }).setDepth(DEPTH.HUD + 10);
  // it comes in from the field side of the panel (where the blow came from) and drops onto the pillow
  const hitY = at.y + (top ? 6 : -6);
  const n0 = { x: at.x + (at.x < GAME_W / 2 ? 46 : -46), y: at.y + (top ? 46 : -44) };
  num.setPosition(ri(n0.x), ri(n0.y));
  const ctrl = { x: lerp(n0.x, at.x, 0.35), y: Math.min(n0.y, hitY) - 22 };
  await animate(sc, 200, (t) => {
    const p = qbez(n0, ctrl, { x: at.x, y: hitY }, t * t);
    num.setPosition(ri(p.x), ri(p.y));
  });
  play('wiCatch', { volume: 0.95, pan: panAt(at.x) });
  // squash: wide and flat, the eyes squeeze; the number sinks into it
  P.set(23, 6, 'squeeze', top ? -1 : 1);
  num.setPosition(at.x, hitY + (top ? -2 : 2));
  await sleep(sc, 60);
  P.set(17, 12, 'squeeze');
  await sleep(sc, 50);
  P.set(19, 10, 'happy');
  num.destroy();
  // "0 · KORUNDU"
  play('wiSafe', { volume: 0.85, pan: panAt(at.x) });
  const pr = panelRect(owner);
  const label = pixelText(sc, at.x, top ? pr.y + pr.h + 7 : pr.y - 7, '0 · KORUNDU', { size: 'sm', color: PAL.gold4, originX: 0.5, originY: 0.5 }).setDepth(DEPTH.HUD + 10);
  void panelFlash(sc, at);
  await sleep(sc, 260);
  // ---- POF
  play('wiPof', { volume: 1, pan: panAt(at.x) });
  P.destroy();
  pof(sc, at, rnd);
  // the label stays a beat, then blinks out (whole frames, no alpha)
  void (async () => {
    await sleep(sc, 380);
    for (let i = 0; i < 3 && label.active; i++) {
      label.setVisible(false);
      await sleep(sc, 50);
      label.setVisible(true);
      await sleep(sc, 50);
    }
    label.destroy();
  })();
  await (L?.landed() ?? Promise.resolve());
}

/** A gold ring of light round the pillow on the panel (one stepped ring). */
function panelFlash(scene: Phaser.Scene, at: XY): Promise<void> {
  const r = new Raster(scene, at.x - 30, at.y - 18, 60, 36, DEPTH.HUD + 7);
  return animate(scene, 220, (t) => {
    r.draw(() => {
      const rad = 18 + t * 8;
      r.ring(at.x, at.y, rad, rad * 0.55, t < 0.4 ? PAL.gold4 : t < 0.75 ? PAL.gold3 : PAL.gold2);
    });
  }).then(() => r.destroy());
}

if (LOOK_V3)
  registerCardHook(
    ID,
    'destroyed',
    async (ctx) => {
      const ev = ctx.ev;
      if (ev.location !== 'monster' || sourceOwnsDestroy(ctx)) return ctx.base();
      const pillow = ctx.hints.pillow as { amount: number; owner: PlayerId } | undefined;
      const L = takeDeath(ctx);
      if (pillow) {
        await pillowDeath(ctx, L, pillow.amount, pillow.owner);
        return;
      }
      if (!L) return ctx.base();
      try {
        await windDeath(ctx, L);
      } catch (e) {
        console.error('[wisp_imp] wind death', e);
      } finally {
        L.finish();
      }
      await L.landed();
    },
    { priority: 20, name: 'kart-b:wisp_imp:death' },
  );

if (LOOK_V3)
  registerCardHook(
    ID,
    'effect',
    async (ctx) => {
      const ev = ctx.ev;
      const di = ctx.findType('destroy', (e) => e.uid === ev.uid);
      if (di < 0) return ctx.base();
      // the prevented amount: the battle just before the activation (the engine emits no damage)
      let amount = 0;
      for (let i = ctx.index - 1; i >= 0; i--) {
        const e = ctx.events[i];
        if (e.type === 'battle') {
          amount = Math.abs(e.attackerAtk - (e.targetValue ?? 0));
          break;
        }
      }
      await ctx.play(di, { pillow: { amount, owner: ev.player }, hit: false });
    },
    { priority: 20, name: 'kart-b:wisp_imp:effect' },
  );

export type { GameEvent };
