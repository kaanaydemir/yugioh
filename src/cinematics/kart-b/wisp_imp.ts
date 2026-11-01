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
//            Between the blow and the activation "the clutch" observer holds the body in the
//            pillow's trembling hug (special f1/f2) instead of letting it spring back to idle.
//   (FIX r1: bigger 3-tilt pre-roll feather + brighter ring, 6–8 px fountain feathers, dart trails /
//    glints / finisher / quivering stuck darts, gust ribbons + whole peeled feathers synced to the
//    sprite's peel frames, the clutch, a pillow with the ghost's face / cowlick / "?" tail and a
//    popping, shining "0 · KORUNDU" that blinks out with the pof.)
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
import { fx, registerCardHook, registerObserver, registerStrike } from '../api';
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

/**
 * (FIX r2) The feather STAMP: a whole quilled feather, 5–9 px, with a 1-px ink outline (it is matter,
 * like the sprite's own peeled feathers), a lit vane on the light side, a lilac vane on the other, a
 * quill one step down and a broad rounded tip — the card's motif, readable at 1×. `flip` 0..1 is
 * how open it is to the eye: under 0.3 it is seen edge-on (a quill line only: the falling-leaf
 * turn-over frame). `step` fades it down the ramp (the last step drops the ink rim).
 */
function stamp(r: Raster, x: number, y: number, ang: number, len: number, step = 0, flip = 1): void {
  if (step >= TONES.length) return;
  const [lit, shade, quill] = TONES[step];
  const cx = ri(x);
  const cy = ri(y);
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  let nx = -dy;
  let ny = dx;
  if (nx + ny * 1.6 > 0) {
    nx = -nx;
    ny = -ny;
  }
  const px = new Map<number, number>();
  const put = (X: number, Y: number, c: number) => px.set(Y * 4096 + X, c);
  const half = (len - 1) / 2;
  const edgeOn = flip < 0.3;
  // vane half-width along the feather: narrow at the root, broadest two-thirds out, a round tip
  const vw = (f: number) => (edgeOn ? 0 : (f < 0.15 ? 0 : f < 0.7 ? 1 + (len >= 7 && f > 0.35 ? 1 : 0) : f < 0.93 ? 1 : 0) * (flip < 0.6 ? 0.5 : 1));
  for (let i = 0; i < len; i++) {
    const f = i / Math.max(1, len - 1);
    const k = i - half;
    const qx = cx + dx * k;
    const qy = cy + dy * k;
    const w = vw(f);
    for (let j = 1; j <= Math.ceil(w); j++) {
      put(ri(qx + nx * j), ri(qy + ny * j), lit);
      put(ri(qx - nx * j), ri(qy - ny * j), j === 2 ? quill : shade);
    }
    put(ri(qx), ri(qy), f > 0.9 ? lit : quill);
  }
  if (step < TONES.length - 1) {
    const ink = step === 0 ? PAL.ink : PAL.void0;
    for (const key of px.keys()) {
      const X = key % 4096;
      const Y = Math.floor(key / 4096);
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const kk = (Y + oy) * 4096 + X + ox;
        if (!px.has(kk)) r.px(X + ox, Y + oy, ink);
      }
    }
  }
  for (const [key, c] of px) r.px(key % 4096, Math.floor(key / 4096), c);
}

/**
 * A lumpy CUMULUS of down (the burst cloud, the pof): overlapping puffs, each a little dome lit from
 * the top-left in flat bands (white / void4 / void3 / void2), the lower puffs first so every upper
 * puff laps over the one under it with a 1-px lilac crease, one ink rim round the whole mass.
 * `puffs` = [dx, dy, r] round (cx, cy) in the raster's world coords; `rim` false = no ink (a fading cloud).
 */
function cumulus(r: Raster, cx: number, cy: number, puffs: readonly (readonly [number, number, number])[], rim = true, dim = 0): void {
  const pc = r.pc;
  const ox = r.x;
  const oy = r.y;
  const RAMP = [PAL.white, PAL.void4, PAL.void3, PAL.void2, PAL.void1];
  const order = [...puffs].sort((a, b) => b[1] - a[1]);
  const owner = new Map<number, number>();
  order.forEach(([dx, dy, rad], idx) => {
    const x0 = cx + dx;
    const y0 = cy + dy;
    for (let y = Math.floor(y0 - rad - 1); y <= y0 + rad + 1; y++)
      for (let x = Math.floor(x0 - rad - 1); x <= x0 + rad + 1; x++) {
        const u = (x + 0.5 - x0) / rad;
        const v = (y + 0.5 - y0) / (rad * 0.86);
        const d2 = u * u + v * v;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2);
        const l = -u * 0.55 - v * 0.75 + nz * 0.45;
        let b = l > 0.22 ? 0 : l > -0.2 ? 1 : l > -0.55 ? 2 : 3;
        // where it laps over an earlier (lower) puff, its lower rim is a crease
        const key = (y - oy) * 4096 + (x - ox);
        if (owner.has(key) && d2 > 0.72 && v > 0) b = Math.max(b, 2);
        b = Math.min(4, b + dim);
        owner.set(key, idx);
        pc.set(x - ox, y - oy, RAMP[b]);
      }
  });
  if (rim) {
    const ink = dim >= 1 ? PAL.void0 : PAL.ink;
    for (const key of owner.keys()) {
      const X = key % 4096;
      const Y = Math.floor(key / 4096);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!owner.has((Y + dy) * 4096 + X + dx)) pc.set(X + dx, Y + dy, ink);
    }
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
  /** A whole inked feather stamp (falling-leaf: rocks and turns over edge-on) instead of a plain feather. */
  ink?: boolean;
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
      if (p.ink && p.len >= 5) stamp(this.r, p.x, p.y, p.ang + Math.sin(p.ph) * p.swing, p.len, step, Math.abs(Math.cos(p.ph * 0.5)));
      else feather(this.r, p.x, p.y, p.ang + Math.sin(p.ph) * p.swing, p.len, step);
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
  const fs = Array.from({ length: N }, (_, i) => ({ a0: (i / N) * TAU + rr(rnd, -0.2, 0.2), d: rr(rnd, 0, 0.35), len: i % 3 === 0 ? 8 : i % 3 === 1 ? 7 : 6, spd: rr(rnd, 0.9, 1.15) }));
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
        // every other one a whole inked feather stamp (it turns over as it whirls), the rest plain
        if (f.len >= 7) stamp(r, x, yy, ang, f.len + 1, t > 0.92 ? 1 : 0, Math.abs(Math.cos(a)));
        else feather(r, x, yy, ang, f.len, t > 0.92 ? 1 : 0);
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
        loose.add({ x, y: y + Math.sin(a) * rad * 0.35, vx: Math.cos(a) * rr(rnd, 50, 90), vy: rr(rnd, -60, -20) + Math.sin(a) * 12, len: f.len >= 7 ? f.len + 1 : f.len, grav: 70, drag: 3, life: rr(rnd, 520, 820), ang: a + Math.PI / 2, ink: f.len >= 7 }, rnd);
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

/**
 * The falling feather's thread of down (specks shed every ~45 ms that drift and step down the ramp,
 * a gold glint now and then) and its shadow on the tile (an iso dot that widens and darkens as it
 * comes down). `at()` = the feather's world point (null: not falling any more).
 */
function fallTrail(S: Stage, rnd: Rnd, at: () => XY | null): { touch(): void; end(): void } {
  const sc = S.scene;
  const { home } = S;
  const r = new Raster(sc, home.x - 50, home.y - 150, 100, 160, S.sprite.depth + 0.2);
  const shadow = new Raster(sc, home.x - 16, home.y - 9, 33, 19, DEPTH.CARD_ON_TILE + 3);
  const specks: { x: number; y: number; vx: number; t: number; gold: boolean }[] = [];
  let lastShed = -999;
  let touched = false;
  let el0 = 0;
  const stop = onFrame(sc, (_dt, el) => {
    el0 = el;
    const p = touched ? null : at();
    if (p && el - lastShed > 30) {
      lastShed = el;
      specks.push({ x: p.x + rr(rnd, -2, 2), y: p.y + 1, vx: rr(rnd, -7, 7), t: el, gold: specks.length % 4 === 2 });
    }
    r.begin();
    for (const k of specks) {
      const a = (el - k.t) / 1000;
      if (a > 0.66) continue;
      const step = a < 0.22 ? 0 : a < 0.44 ? 1 : 2;
      const x = ri(k.x + k.vx * a + Math.sin(a * 9 + k.x) * 1.2);
      const y = ri(k.y + a * 10);
      if (k.gold && a < 0.18) {
        r.px(x, y, PAL.gold4);
        if (a < 0.06) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) r.px(x + dx, y + dy, PAL.gold3);
      } else {
        r.px(x, y, TONES[step][step === 0 ? 0 : 1]);
        if (step === 0) r.px(x + 1, y, TONES[0][1]);
      }
    }
    r.end();
    shadow.begin();
    if (p) {
      // 0 when high, 1 at the tile
      // a ring of down-light on the tile that TIGHTENS onto the landing spot as it comes down
      // (the touch's ripple then answers it by opening back out)
      const k = clamp(1 - (home.y - 6 - p.y) / 90, 0, 1);
      const rx = Math.round(lerp(15, 4, k));
      const c = k < 0.3 ? PAL.void4 : PAL.white;
      shadow.ring(home.x, home.y, rx, Math.max(2, rx * 0.45), c);
      // a second, lilac ring just outside it (the down-light reads at 1×)
      if (rx + 2 <= 16) shadow.ring(home.x, home.y, rx + 2, Math.max(3, (rx + 2) * 0.45), k < 0.5 ? PAL.void3 : PAL.void4);
      if (k > 0.6) shadow.px(home.x, home.y, PAL.white);
    }
    shadow.end();
    return true;
  });
  return {
    touch() {
      touched = true;
    },
    end() {
      void el0;
      stop();
      r.destroy();
      shadow.destroy();
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
  // frames 0 / 1 / 2 are the feather's three drawn tilts (level, tipped back, tipped forward): the
  // sprite is offset so the feather's centre never jumps when the tilt changes
  const w0 = u.framePoint(frameCentre(u, 'summon', 0).x, frameCentre(u, 'summon', 0).y);
  const offs = [0, 1, 2].map((f) => {
    const c = frameCentre(u, 'summon', f);
    const w = u.framePoint(c.x, c.y);
    return { x: w0.x - w.x, y: w0.y - w.y };
  });
  const FALL = 44;
  const PRE = 320;
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
  // the falling feather leaves a glinting thread of down behind it, and its little shadow on the
  // tile grows as it comes down (the eye knows where it will land before it does)
  const trail = fallTrail(S, rnd, () => {
    const fi = u.frameInfo();
    if (fi.anim !== 'summon') return null;
    const c = frameCentre(u, 'summon', fi.frame);
    return u.framePoint(c.x, c.y);
  });
  S.own({ destroy: () => trail.end() });
  let lastF = -1;
  await animate(sc, PRE, (t) => {
    if (!spr.active) return;
    const e = 1 - (1 - t) * (1 - t * 0.6);
    // a wide pendulum (±10 px), the feather rising a little at each end of its swing like a leaf
    const ph = Math.sin(t * TAU * 1.5);
    const sway = ph * lerp(11, 6, t);
    const rise = -Math.abs(ph) * 3;
    const f = Math.abs(ph) < 0.45 ? 0 : ph * S.dir > 0 ? 2 : 1;
    if (f !== lastF) {
      u.pose('summon', f);
      lastF = f;
    }
    const ox = offs[f].x;
    const oy = offs[f].y + rise;
    const y = rest.y - FALL * (1 - e);
    spr.setPosition(ri(rest.x + sway + ox), ri(y + oy));
    moon.setPosition(ri(w0.x + sway), ri(w0.y - FALL * (1 - e)), S.home.y);
  });
  spr.setPosition(rest.x, rest.y);
  // ---- the summon pose: it keeps falling to the tile, touches, the fountain builds it
  const tile = S.glow({ color: PAL.void4, spill: PAL.void3, radius: 26, intensity: 0, anim: 'breathe', fadeIn: 0 });
  const n = u.frameCount('summon');
  const LAND = u.markFrame('summon', 'land', 9);
  const TOUCH = Math.max(1, Math.min(4, LAND - 5));
  // the last stretch of the fall goes a little quicker than the sheet (it hung too long at 1×),
  // the build from the touch on plays at the sheet's own beat
  const done = (async () => {
    await u.playRange('summon', 0, TOUCH, { timeScale: 1.45 });
    if (spr.active) await u.playRange('summon', TOUCH);
  })();
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
    trail.touch();
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
      crown.add({ x: head.x + Math.cos(a) * 6, y: head.y + 8 + Math.sin(a) * 4, vx: Math.cos(a) * 70, vy: Math.sin(a) * 80, len: i % 2 ? 6 : 7, grav: 90, drag: 2.5, life: rr(rnd, 560, 760), ang: a, ink: true }, rnd);
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
      launch: i * 34 + (i > 2 ? 30 : 0) + (i === N - 1 ? 40 : 0),
      flight: clamp(ri(dist * 1.15 + 90), 200, 330),
      // the first is the contact; the last is the big finisher feather
      len: i === N - 1 ? 11 : i === 0 ? 9 : i % 3 === 0 ? 7 : 8,
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
  const sparksAt: (XY & { t: number })[] = [];
  onFrame(sc, (dt, el) => {
    r.begin();
    for (const k of sparksAt) {
      const a = el - k.t;
      if (a > 90) continue;
      // the tink: a white 4-point spark that flares and shrinks off the guard
      const n = a < 30 ? 3 : a < 60 ? 2 : 1;
      r.px(k.x, k.y, PAL.white);
      for (let j = 1; j <= n; j++) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) r.px(k.x + ox * j, k.y + oy * j, j === n ? PAL.void4 : PAL.white);
    }
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
        // the trail: an unbroken thread of down behind the feather, stepping down the ramp
        const cA = Math.cos(d.ang);
        const sA = Math.sin(d.ang);
        const tail0 = (d.len - 1) / 2 + 1;
        const TR = d.len >= 10 ? 6 : 4;
        for (let k = 0; k < TR; k++) r.px(ri(p.x - cA * (tail0 + k)), ri(p.y - sA * (tail0 + k)), k < 1 ? PAL.white : k < 2 ? PAL.void4 : k < TR - 1 ? PAL.void3 : PAL.void2);
        for (let k = 2; k < d.hist.length; k += 2) r.px(d.hist[k].x, d.hist[k].y, k < 4 ? PAL.void3 : PAL.void2);
        feather(r, p.x, p.y, d.ang, d.len, 0);
        // the white leading glint: a cross on the launch frames, then one bright point ahead of the tip
        const hx = ri(p.x + cA * (tail0 + 0.5));
        const hy = ri(p.y + sA * (tail0 + 0.5));
        r.px(hx, hy, PAL.white);
        if (lt < 50 || (i === N - 1 && t > 0.85)) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) r.px(hx + ox, hy + oy, PAL.white);
        flying++;
        cx += p.x;
        cy += p.y;
        if (t >= 1) {
          landed++;
          onHit(i, d.to);
          if (s.blocked) {
            // (FIX r2) it glances off the guard: a white "tink" spark, then it ricochets back up on a
            // high arc, spinning end over end, and tumbles to the floor (never sticks)
            d.state = 'gone';
            sparksAt.push({ x: d.to.x, y: d.to.y, t: el });
            falls.add({ x: d.to.x - dirX * 2, y: d.to.y, vx: -dirX * rr(rnd, 110, 170), vy: rr(rnd, -150, -100), len: Math.max(6, d.len - 1), grav: 420, drag: 0.8, life: rr(rnd, 420, 560), ang: d.ang + Math.PI, swing: 2.4, hz: rr(rnd, 4, 6), flut: 4, ink: true }, rnd);
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
        // stuck in the body: the quill buried, the whole feather quivering ±1 px, its end a white tip
        const q = Math.floor((el - d.stuckAt) / 45) % 3;
        const wob = q === 0 ? -1 : q === 1 ? 1 : 0;
        const nx = -Math.sin(d.ang);
        const ny = Math.cos(d.ang);
        const sl = Math.max(5, d.len - 1);
        const back = { x: at.x - Math.cos(d.ang) * 2 + nx * wob, y: at.y - Math.sin(d.ang) * 2 + ny * wob };
        feather(r, back.x, back.y, d.ang + wob * 0.12, sl, 0);
        const end = (sl - 1) / 2 + 1;
        r.px(ri(back.x - Math.cos(d.ang) * end), ri(back.y - Math.sin(d.ang) * end), PAL.white);
        if (el - d.stuckAt > STICK + i * 40 || !host) {
          // it flakes off and flutters down
          d.state = 'gone';
          falls.add({ x: back.x, y: back.y, vx: -dirX * rr(rnd, 10, 30), vy: rr(rnd, -20, 5), len: Math.max(5, d.len - 2), grav: 55, drag: 2.4, life: rr(rnd, 560, 760), ang: d.ang, ink: true }, rnd);
        }
      }
    }
    r.end();
    if (flying > 0) glow.setPosition(ri(cx / flying), ri(cy / flying), lerp(g0.y, g1.y, 0.5));
    if (darts.every((d) => d.state === 'gone') && sparksAt.every((k) => el - k.t > 90)) {
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

/**
 * The gust: three big curved ribbons of wind (white head with a rolling curl, lilac body) cross the
 * tile from the front first, thin streaks follow; `peel(n)` hands on the sprite's peeled feathers —
 * whole quilled feathers that leave its back edge and tumble downwind (`dir` ±1) on pendulum paths.
 */
function gust(scene: Phaser.Scene, u: MonsterUnit, dir: number, ms: number, rnd: Rnd): { peel(n: number): void; end(): void } {
  const c = u.core();
  const W = 220;
  const r = new Raster(scene, c.x - W / 2, c.y - 50, W, 90, u.sprite.depth + 0.4);
  const plumes = new Plumes(scene, c.x - W / 2 - 40, c.y - 90, W + 80, 150, u.sprite.depth + 0.5);
  const ribbons = [
    { y: c.y - 22, len: 34, amp: 2.2, spd: 420, delay: 0 },
    { y: c.y - 6, len: 28, amp: 1.8, spd: 470, delay: 60 },
    { y: c.y + 9, len: 24, amp: 1.6, spd: 400, delay: 150 },
  ];
  const lines = Array.from({ length: 7 }, (_, i) => ({ y: ri(c.y - 26 + i * 7 + rr(rnd, -2, 2)), x0: rr(rnd, -60, 0), len: ri(rr(rnd, 8, 14)), spd: rr(rnd, 260, 340), delay: rr(rnd, 120, ms * 0.55) }));
  const stop = onFrame(scene, (_dt, el) => {
    r.begin();
    for (const g of ribbons) {
      const a = el - g.delay;
      if (a < 0) continue;
      const head = c.x - dir * (W / 2 - 6) + dir * (a / 1000) * g.spd;
      for (let k = 0; k < g.len; k++) {
        const x = ri(head - dir * k);
        if (Math.abs(x - c.x) > W / 2 - 2) continue;
        const y = ri(g.y + Math.sin((x - c.x) / 7 + g.delay) * g.amp);
        r.px(x, y, k < 4 ? PAL.white : k < g.len * 0.6 ? PAL.void4 : PAL.void3);
        if (k > 2 && k < g.len * 0.4 && k % 3 === 0) r.px(x, y + 1, PAL.void3);
      }
      // the rolling curl at its head
      const hx = ri(head);
      if (Math.abs(hx - c.x) < W / 2 - 4) {
        const hy = ri(g.y + Math.sin((hx - c.x) / 7 + g.delay) * g.amp);
        r.px(hx + dir, hy - 1, PAL.white);
        r.px(hx + dir, hy - 2, PAL.white);
        r.px(hx, hy - 3, PAL.white);
        r.px(hx - dir, hy - 3, PAL.void4);
        r.px(hx - 2 * dir, hy - 2, PAL.void4);
      }
    }
    for (const l of lines) {
      const a = el - l.delay;
      if (a < 0) continue;
      const x = c.x - dir * 50 + dir * (l.x0 + (a / 1000) * l.spd);
      if (Math.abs(x - c.x) > W / 2 - l.len) continue;
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
        // they leave from the back edge of the body, where the sprite's own peeled feathers exit
        plumes.add({ x: b.x + dir * rr(rnd, 12, 18), y: b.y + rr(rnd, -18, 10), vx: dir * rr(rnd, 90, 150), vy: rr(rnd, -55, -15), len: i % 3 === 0 ? 9 : 7, grav: -4, drag: 1, life: rr(rnd, 700, 1000), flut: rr(rnd, 8, 16), hz: rr(rnd, 1.6, 2.4), ang: dir > 0 ? 0.3 : Math.PI - 0.3, swing: 1.1, ink: true }, rnd);
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
  // the sprite peels the cowlick (f2), two plumes (f3), two more (f4: dissolve), the wing and the
  // hands (f5), the tail (f6): each part it lets go of flies on here as a whole feather
  atFrame(u, 'death', Math.max(1, DIS - 1), () => wind.peel(2), { late: false });
  atFrame(
    u,
    'death',
    DIS,
    () => {
      play('wiGust', { volume: 0.9, pan });
      wind.peel(3);
    },
    { late: false },
  );
  atFrame(u, 'death', Math.min(n - 1, DIS + 1), () => wind.peel(3), { late: false });
  atFrame(u, 'death', Math.min(n - 1, DIS + 2), () => wind.peel(2), { late: false });
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
  L.born();
  void sleep(sc, 600).then(() => wind.end());
}

// ================================================================ effect: the feather pillow

/** The pillow's face states. */
type Face = 'happy' | 'squeeze' | 'open' | 'wide';

/**
 * The pillow = the ghost turned cushion: a puffy square with four tufted feather corners and a
 * piped seam, the ghost's cowlick curling up off its top and its "?" tail feather hooking off the
 * back corner; on its front the ghost's own dark face hollow (11×7) with 2-px gold eyes that change
 * expression ("> <" squeezed, wide, "^ ^"). Drawn into `pc` centred at (cx, cy), half-size a × b,
 * `back` = −1 / +1 the side the tail hangs off (away from the field). Light from the top-left.
 */
function paintPillow(pc: PixelCanvas, cx: number, cy: number, a: number, b: number, face: Face, back = -1): void {
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
  // four tufted corners: a little fan of three feather tips each
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const x0 = ri(cx + sx * (a - 2));
    const y0 = ri(cy + sy * (b - 1.5));
    const lit = sy < 0 ? PAL.white : PAL.void4;
    const dim = sy < 0 ? PAL.void4 : PAL.void3;
    // a solid wedge of feather tips fanning out of the corner (three points: the middle one longest)
    for (let i = 0; i <= 5; i++)
      for (let j = 0; j <= 5; j++) {
        const d = i + j;
        if (d > 5 || Math.abs(i - j) > 2 || (d === 5 && i !== j + 1 && j !== i + 1 && i !== j)) continue;
        if (d >= 4 && Math.abs(i - j) === 2) continue;
        pc.set(x0 + sx * i, y0 + sy * j, d >= 4 ? dim : lit);
      }
  }
  // the cowlick curling up off the top, leaning forward (it is the ghost's)
  const tx = ri(cx - back * 3);
  const ty = ri(cy - b);
  const curl: [number, number, number][] = [];
  // a 3-px-wide feather rising 6 px and curling forward over the top (lit side white, back lilac)
  for (let k = 0; k <= 5; k++) {
    const dx = k < 3 ? 0 : -back * (k - 2);
    curl.push([dx, -k, PAL.white], [dx + back, -k, PAL.void4]);
    if (k < 4) curl.push([dx - back, -k, PAL.white]);
  }
  curl.push([-back * 4, -5, PAL.white], [-back * 4, -4, PAL.void4], [-back * 5, -4, PAL.void4]);
  for (const [dx, dy, c] of curl) pc.set(tx + dx, ty + dy, c);
  // the "?" tail feather hooking off the back side: out, down and back up in a 2-px stroke
  const qx = ri(cx + back * (a - 1));
  const qy = ri(cy + 1);
  const hook: [number, number][] = [
    [1, 0], [2, 0], [3, 1], [4, 2], [4, 3], [3, 4], [2, 4], [1, 3], [5, 1], [5, 2],
  ];
  for (const [dx, dy] of hook) {
    pc.set(qx + back * dx, qy + dy, dy <= 1 ? PAL.void4 : PAL.void3);
    pc.set(qx + back * dx, qy + dy - 1, dy <= 1 ? PAL.white : PAL.void4);
  }
  pc.outline(PAL.ink);
  // the ghost's face hollow (11×7) and its gold eyes (lights: drawn after the outline)
  const fx0 = ri(cx - back * 1);
  const fy0 = ri(cy);
  const hw = face === 'wide' ? 7.2 : 6.6;
  const hh = face === 'wide' ? 4.8 : 4.3;
  for (let y = -5; y <= 5; y++) for (let x = -8; x <= 8; x++) if ((x * x) / (hw * hw) + (y * y) / (hh * hh) <= 1) pc.set(fx0 + x, fy0 + y, PAL.void0);
  // its brow: the cushion's lip overhangs the hollow (ink), the lower lip catches a little light
  for (let x = -5; x <= 5; x++) pc.set(fx0 + x, fy0 - 5, PAL.ink);
  for (let x = -4; x <= 4; x++) if (pc.get(fx0 + x, fy0 + 5) !== null) pc.set(fx0 + x, fy0 + 5, PAL.void1);
  const G4 = PAL.gold4;
  const G3 = PAL.gold3;
  const eye = (ex: number, near: boolean): void => {
    const s = near ? 1 : -1;
    if (face === 'squeeze') {
      // > <  (3 px tall chevrons pointing at each other)
      pc.set(ex - s, fy0 - 1, G3);
      pc.set(ex, fy0, G4);
      pc.set(ex - s, fy0 + 1, G3);
      pc.set(ex + s, fy0, G3);
    } else if (face === 'happy') {
      // ^ ^
      pc.set(ex - 1, fy0 + 1, G3);
      pc.set(ex, fy0, G4);
      pc.set(ex + 1, fy0, G4);
      pc.set(ex + 2, fy0 + 1, G3);
    } else if (face === 'wide') {
      // big round 2×3 eyes
      pc.set(ex, fy0 - 2, G4);
      pc.set(ex + 1, fy0 - 2, G4);
      pc.set(ex, fy0 - 1, G4);
      pc.set(ex + 1, fy0 - 1, G4);
      pc.set(ex, fy0, G3);
      pc.set(ex + 1, fy0, G3);
    } else {
      // 2×3 dots (they read at 1×)
      pc.set(ex, fy0 - 2, G4);
      pc.set(ex + 1, fy0 - 2, G4);
      pc.set(ex, fy0 - 1, G4);
      pc.set(ex + 1, fy0 - 1, G4);
      pc.set(ex, fy0, G3);
      pc.set(ex + 1, fy0, G4);
    }
  };
  if (face === 'squeeze') {
    eye(fx0 - 3, false);
    eye(fx0 + 3, true);
  } else {
    eye(fx0 - 4, false);
    eye(fx0 + 3, true);
  }
}

/** A pillow sprite on the HUD layer: a raster you re-paint with a size and a face. */
function pillowView(scene: Phaser.Scene, at: XY, back: number): { set(a: number, b: number, face: Face, dy?: number): void; hide(): void; destroy(): void } {
  const W = 104;
  const H = 56;
  const r = new Raster(scene, at.x - W / 2, at.y - H / 2, W, H, DEPTH.HUD + 8);
  const pc = new PixelCanvas(W, H);
  return {
    set(a, b, face, dy = 0) {
      paintPillow(pc, W / 2, H / 2 + dy, a, b, face, back);
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

/**
 * The flock: feathers stream from the burst cloud (`from`, its rim radius `rim`) to `to` (HUD
 * space), packing in; a third of them are whole inked feather stamps rocking on the way (the rest
 * down specks as filler). Resolves on arrival.
 */
function flock(scene: Phaser.Scene, from: XY, to: XY, rnd: Rnd, ms: number, rim = 14): Promise<void> {
  const N = 36;
  const r = new Raster(scene, 0, 0, GAME_W, GAME_H, DEPTH.HUD + 7);
  const up = to.y < from.y ? -1 : 1;
  const fs = Array.from({ length: N }, (_, i) => {
    // they leave from all round the cloud, the upper rim first (the cloud lifts off)
    const a = -Math.PI / 2 + (i % 2 ? 1 : -1) * rr(rnd, 0, Math.PI * 0.95);
    const p0 = { x: from.x + Math.cos(a) * rim, y: from.y + Math.sin(a) * rim * 0.8 };
    const side = rr(rnd, -1, 1);
    const heavy = i % 3 === 0;
    return {
      p0,
      c1: { x: lerp(p0.x, to.x, 0.2) + side * 34 + Math.cos(a) * 16, y: lerp(p0.y, to.y, 0.15) - 34 * (up < 0 ? 0.6 : 1.2) + rr(rnd, -10, 10) },
      c2: { x: lerp(p0.x, to.x, 0.7) + side * 16, y: lerp(p0.y, to.y, 0.75) - 16 * (up < 0 ? -0.4 : 1) },
      d: { x: to.x + rr(rnd, -14, 14), y: to.y + rr(rnd, -5, 5) },
      delay: (Math.abs(a + Math.PI / 2) / Math.PI) * ms * 0.3 + rr(rnd, 0, 40),
      len: heavy ? (i % 2 ? 8 : 7) : i % 3 === 1 ? 4 : 2,
      heavy,
      ph: rr(rnd, 0, TAU),
      prev: p0,
    };
  });
  return animate(scene, ms, (_t, el) => {
    r.begin();
    for (const f of fs) {
      const lt = clamp((el - f.delay) / Math.max(1, ms - f.delay), 0, 1);
      if (lt <= 0 || lt >= 1) continue;
      const e = lt * lt * (3 - 2 * lt);
      let p = cbez(f.p0, f.c1, f.c2, f.d, e);
      const wob = Math.sin(f.ph + el * 0.03) * 2.5 * (1 - lt);
      p = { x: p.x + wob, y: p.y };
      const ang = Math.atan2(p.y - f.prev.y, p.x - f.prev.x) + Math.sin(f.ph + el * 0.02) * 0.7;
      f.prev = p;
      if (f.heavy) stamp(r, p.x, p.y, ang + Math.PI, f.len, 0, Math.abs(Math.cos(f.ph + el * 0.012)));
      else feather(r, p.x, p.y, ang, f.len, 0);
    }
    r.end();
  }).then(() => r.destroy());
}

/**
 * The BURST (FIX r2): the swollen ghost goes off like a pillow split open — one white flash frame at
 * body size (ink rim), then a lumpy outlined cloud of down blooms UP and OUT to ~1.5× the body over
 * four beats, tears into lobes and thins while whole inked feathers tumble out of its edge; it
 * rises the whole time (it never lies on the floor). `onLift` fires when the cloud lifts off (the
 * flock leaves). World space, on the field.
 */
function burstCloud(scene: Phaser.Scene, at: XY, depth: number, rnd: Rnd, onLift: (rim: number, c: XY) => void): Promise<void> {
  const r = new Raster(scene, at.x - 60, at.y - 80, 120, 120, depth);
  const tumble = new Plumes(scene, at.x - 90, at.y - 110, 180, 170, depth + 0.1);
  // the body's own shape: hood, chest, skirt toward the tail
  const BODY: [number, number, number][] = [[1, -7, 10], [-1, 3, 9], [-4, 10, 6], [5, 2, 6]];
  const LOBES = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * TAU + rr(rnd, -0.2, 0.2);
    return { a, r: rr(rnd, 5.5, 8), out: rr(rnd, 0.85, 1.15) };
  });
  let lifted = false;
  let thrown = false;
  const BEAT = 52;
  return animate(scene, BEAT * 6, (_t, el) => {
    const k = Math.floor(el / BEAT);
    r.begin();
    if (k === 0) {
      // the flash: the body shape, all white, inked
      cumulus(r, at.x, at.y, BODY);
      for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
        const c = r.pc.get(x, y);
        if (c !== null && c !== PAL.ink) r.pc.set(x, y, PAL.white);
      }
    } else {
      const j = Math.min(5, k) - 1; // 0..4
      const grow = [1.0, 1.3, 1.5, 1.55, 1.5][j];
      const rise = [-3, -8, -13, -18, -23][j];
      const shrink = [1, 1, 0.95, 0.75, 0.5][j];
      const c = { x: at.x, y: at.y + rise };
      const puffs: [number, number, number][] = [[0, -2, (9 + j * 1.5) * shrink], [-4, -6, 6 * shrink], [5, -5, 6 * shrink]];
      for (const L of LOBES) puffs.push([Math.cos(L.a) * 9 * grow * L.out, Math.sin(L.a) * 7 * grow * L.out - 2, L.r * shrink * (j === 0 ? 1.15 : 1)]);
      cumulus(r, c.x, c.y, j >= 3 ? puffs.filter((_, i) => i % 2 === 0) : puffs, j < 3, j >= 3 ? j - 2 : 0);
      if (j === 0 && !thrown) {
        thrown = true;
        // whole feathers tumble out of its edge
        for (let i = 0; i < 8; i++) {
          // out of its upper rim mostly: the cloud is lifting
          const a = -Math.PI / 2 + ((i / 7) - 0.5) * Math.PI * 1.5 + rr(rnd, -0.15, 0.15);
          tumble.add({ x: c.x + Math.cos(a) * 12, y: c.y + Math.sin(a) * 9, vx: Math.cos(a) * rr(rnd, 35, 60), vy: Math.sin(a) * rr(rnd, 30, 50) - 25, len: i % 3 === 0 ? 9 : i % 3 === 1 ? 8 : 7, grav: -6, drag: 2.2, life: rr(rnd, 420, 600), ang: a, ink: true, hz: rr(rnd, 1.6, 2.4), swing: 1 }, rnd);
        }
        tumble.close();
      }
      if (j === 2 && !lifted) {
        lifted = true;
        onLift(15, c);
      }
    }
    r.end();
  }).then(() => r.destroy());
}

/**
 * The pof (FIX r2): a lumpy CUMULUS of down pops off the pillow — a tight pop (k0), a wide puff
 * (k1), both inked, top-left lit — then the torn ring of lobes (k2) and its last wisps; whole inked
 * feathers fly off it and rock down, specks of down as filler (HUD space).
 */
function pof(scene: Phaser.Scene, at: XY, rnd: Rnd): void {
  const r = new Raster(scene, at.x - 60, at.y - 42, 120, 84, DEPTH.HUD + 9);
  const L = Array.from({ length: 8 }, (_, i) => ({ a: (i / 8) * TAU + rr(rnd, -0.2, 0.2), r: rr(rnd, 5, 7.5) }));
  void animate(scene, 300, (t) => {
    r.draw(() => {
      const k = Math.floor(t * 5);
      if (k === 0) {
        // the pop: tight, tall (stretched), bright
        const puffs: [number, number, number][] = [[0, -1, 9]];
        for (const l of L) puffs.push([Math.cos(l.a) * 9, Math.sin(l.a) * 7 - 1, l.r * 0.85]);
        cumulus(r, at.x, at.y - 2, puffs);
      } else if (k === 1) {
        // the puff: wide and squat
        const puffs: [number, number, number][] = [[0, 0, 10], [-6, -3, 7], [6, -3, 7]];
        for (const l of L) puffs.push([Math.cos(l.a) * 19, Math.sin(l.a) * 10, l.r * 1.1]);
        cumulus(r, at.x, at.y - 1, puffs);
      } else if (k === 2) {
        // the cloud tears open: a lumpy ring of lobes
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * TAU;
          cumulus(r, ri(at.x + Math.cos(a) * 24), ri(at.y + Math.sin(a) * 13), [[0, 0, 5], [2, 1, 3.5]], true, i % 3 === 0 ? 1 : 0);
        }
      } else if (k === 3) {
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * TAU + 0.2;
          cumulus(r, ri(at.x + Math.cos(a) * 30), ri(at.y + Math.sin(a) * 16), [[0, 0, 3.5]], false, 1);
        }
      } else r.ring(at.x, at.y, 34, 18, PAL.void2);
    });
  }).then(() => r.destroy());
  const down = new Plumes(scene, at.x - 120, at.y - 90, 240, 190, DEPTH.HUD + 9);
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * TAU + rr(rnd, -0.15, 0.15);
    const v = rr(rnd, 80, 170);
    const heavy = i % 3 === 0;
    down.add({ x: at.x + Math.cos(a) * 14, y: at.y + Math.sin(a) * 7, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 30, len: heavy ? (i % 2 ? 8 : 7) : i % 3 === 1 ? 3 : 2, grav: 45, drag: 2.8, life: rr(rnd, 900, 1300), ang: a, ink: heavy, swing: heavy ? 1.1 : 0.7 }, rnd);
  }
  down.close();
}

/** The pillow death (see the header): `amount` = the prevented battle damage. */
async function pillowDeath(ctx: Ctx<'destroy'>, L: Leave | null, amount: number, owner: PlayerId): Promise<void> {
  const sc = ctx.scene;
  const u = L?.unit ?? null;
  const rnd = mulberry32((u?.uid ?? 7) * 41 + amount);
  let labelRef: Phaser.GameObjects.BitmapText | null = null;
  const home = L?.home ?? zoneXY(ctx.ev.player, 'monster', ctx.ev.zone);
  const pan = panAt(home.x);
  let burstAt: XY = { x: home.x, y: home.y - 18 };
  if (u && live(u)) {
    // (FIX r2) NO field pillow: the hug's build-up plays on (squeeze, shudder, feathers slipping
    // out) to the brief swell (special f5, release − 3), and from there it bursts straight into the
    // cloud — the pillow shape is kept for the panel (the payoff)
    const REL = u.markFrame('special', 'release', 8);
    const SWELL = Math.max(1, REL - 3);
    atFrame(u, 'special', SWELL, () => play('wiStuff', { volume: 0.6, pan }), { late: false });
    const held = clutched.has(u) && u.frameInfo().anim === 'special' ? u.frameInfo().frame : 0;
    clutched.delete(u);
    const from = Math.min(SWELL - 1, held);
    await u.asClaimant(() => u.playRange('special', from, SWELL, { timeScale: 1.3 }));
    burstAt = artPoint(u, 'special', SWELL, 'core');
    burstAt = { x: burstAt.x, y: burstAt.y - 4 };
    await sleep(sc, 60);
  }
  play('wiCloud', { volume: 0.9, pan });
  void lightFlash(sc, burstAt.x, burstAt.y, PAL.white, 26, 300, { floorY: home.y, air: 0.8, intensity: 0.75 });
  let lift!: (v: { rim: number; c: XY }) => void;
  const lifted = new Promise<{ rim: number; c: XY }>((res) => (lift = res));
  const cloudDone = burstCloud(sc, burstAt, (u?.sprite.depth ?? DEPTH.FX) + 0.5, rnd, (rim, c) => lift({ rim, c }));
  // the flash covers the body: it is gone from this frame on
  L?.finish();
  const lf = await lifted;
  burstAt = lf.c;
  // ---- the cloud streams to the owner's LP panel (HUD space)
  const from = fx.screenPoint(ctx, burstAt);
  const lp = fx.lpPoint(ctx, owner);
  const top = lp.y < GAME_H / 2;
  const at = { x: ri(lp.x), y: ri(lp.y) };
  const flight = start('wiFlock', { volume: 0.85, pan: panAt(at.x) });
  const FLY = 420;
  await flock(sc, from, at, rnd, FLY, lf.rim);
  void cloudDone;
  flight.stop(80);
  // ---- it packs into a pillow (the ghost's face on it)
  play('wiStuff', { volume: 0.9, pan: panAt(at.x) });
  // its tail hangs off the side away from the field (the panel's outer side)
  const P = pillowView(sc, at, at.x < GAME_W / 2 ? -1 : 1);
  // it packs in with a plump overshoot (whole-pixel sizes, one per beat)
  const sizes: [number, number, number][] = [
    [14, 6, 30],
    [22, 10, 30],
    [31, 14, 36],
    [27, 12, 34],
    [29, 13, 24],
  ];
  // the prevented damage is already on its way while the pillow plumps up: it comes in from the
  // field side of the panel (where the blow came from) and drops onto the pillow
  const num = pixelText(sc, 0, 0, `-${amount}`, { size: 'md', color: PAL.crim3, originX: 0.5, originY: 0.5 }).setDepth(DEPTH.HUD + 10).setVisible(false);
  const hitY = at.y + (top ? 6 : -6);
  const n0 = { x: at.x + (at.x < GAME_W / 2 ? 46 : -46), y: at.y + (top ? 46 : -44) };
  const ctrl = { x: lerp(n0.x, at.x, 0.35), y: Math.min(n0.y, hitY) - 22 };
  let inbound: Promise<void> = Promise.resolve();
  for (let i = 0; i < sizes.length; i++) {
    const [a, b, ms] = sizes[i];
    P.set(a, b, 'open');
    if (i === 1) {
      num.setPosition(ri(n0.x), ri(n0.y)).setVisible(true);
      inbound = animate(sc, 180, (t) => {
        const q = qbez(n0, ctrl, { x: at.x, y: hitY }, t * t);
        num.setPosition(ri(q.x), ri(q.y));
      });
    }
    await sleep(sc, ms);
  }
  await inbound;
  play('wiCatch', { volume: 0.95, pan: panAt(at.x) });
  // squash: wide and flat, the eyes squeeze, the number sinks into the down; then it springs
  // back up tall, wobbles twice and settles — the blow is soaked up, nothing gets through
  const squash: [number, number, Face, number, number][] = [
    [34, 7, 'squeeze', 64, 3],
    [32, 9, 'squeeze', 44, 4],
    [26, 16, 'wide', 44, 0],
    [31, 11, 'wide', 44, 0],
    [27, 14, 'open', 40, 0],
    [29, 13, 'happy', 34, 0],
  ];
  for (const [a, b, face, ms, sink] of squash) {
    P.set(a, b, face, top ? -Math.min(1, sink) : Math.min(1, sink));
    if (sink > 0) num.setPosition(at.x, hitY + (top ? -sink : sink));
    else num.setVisible(false);
    await sleep(sc, ms);
  }
  num.destroy();
  // "0 · KORUNDU": it pops in big and settles (whole text sizes), a gold glint sweeps along it and
  // a sparkle flashes on the bell; meanwhile the pillow breathes, smug ("^ ^")
  play('wiSafe', { volume: 0.85, pan: panAt(at.x) });
  const pr = panelRect(owner);
  const ly = top ? pr.y + pr.h + 9 : pr.y - 9;
  // it pops: out of the panel edge with a whole-pixel overshoot (−4, +1, 0 px), a white first frame
  const pop = top ? 1 : -1;
  const label = pixelText(sc, at.x, ly - pop * 4, '0 · KORUNDU', { size: 'md', color: PAL.white, originX: 0.5, originY: 0.5 }).setDepth(DEPTH.HUD + 10);
  labelRef = label;
  void panelFlash(sc, at);
  const shine = labelShine(sc, at.x, ly, 64);
  const breathe: [number, number][] = [
    [30, 12],
    [29, 13],
    [28, 14],
    [29, 13],
  ];
  for (let i = 0; i < 4; i++) {
    const [ba, bb] = breathe[i];
    P.set(ba, bb, 'happy');
    if (i === 1) {
      // a tuft pops out of the pillow's top seam on the breath and rocks away
      const tuft = new Plumes(sc, at.x - 60, at.y - 60, 120, 110, DEPTH.HUD + 9);
      tuft.add({ x: at.x + 8, y: at.y - bb - 1, vx: 26, vy: -60, len: 7, grav: 60, drag: 1.8, life: 520, ang: -1.2, ink: true, swing: 1.1, hz: 2.2 }, rnd);
      tuft.close();
    }
    if (label.active) {
      if (i === 1) label.setTint(PAL.gold4).setY(ly + pop);
      else if (i === 2) label.setY(ly);
    }
    await sleep(sc, 75);
  }
  // ---- POF
  play('wiPof', { volume: 1, pan: panAt(at.x) });
  P.destroy();
  pof(sc, at, rnd);
  shine.end();
  // the label blinks out with the pof (whole frames, no alpha)
  const lab = labelRef;
  void (async () => {
    for (let i = 0; i < 3 && lab && lab.active; i++) {
      lab.setVisible(false);
      await sleep(sc, 40);
      lab.setVisible(true);
      await sleep(sc, 40);
    }
    lab?.destroy();
    if (label.active) label.destroy();
  })();
  await (L?.landed() ?? Promise.resolve());
}

/**
 * The label's shine: a gold-white 4-point glint that runs along the top edge of the label (w px
 * wide) and ends in a sparkle burst at its right end, on the chime (HUD space).
 */
function labelShine(scene: Phaser.Scene, x: number, y: number, w: number): { end(): void } {
  const r = new Raster(scene, x - w / 2 - 8, y - 14, w + 16, 28, DEPTH.HUD + 11);
  const stop = onFrame(scene, (_dt, el) => {
    r.begin();
    const t = el / 220;
    if (t < 1) {
      const gx = ri(x - w / 2 + w * t);
      const gy = ri(y - 5);
      r.px(gx, gy, PAL.white);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) r.px(gx + dx, gy + dy, PAL.gold4);
      r.px(gx - 3, gy + 1, PAL.gold3);
    } else if (t < 1.8) {
      // the sparkle: a 4-point star that flares and shrinks
      const k = t < 1.25 ? 3 : t < 1.5 ? 2 : 1;
      const sx = ri(x + w / 2 - 2);
      const sy = ri(y - 6);
      r.px(sx, sy, PAL.white);
      for (let i = 1; i <= k; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) r.px(sx + dx * i, sy + dy * i, i === k ? PAL.gold3 : PAL.gold4);
      if (k >= 2) for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) r.px(sx + dx, sy + dy, PAL.gold3);
    }
    r.end();
    return el < 500;
  });
  return {
    end() {
      stop();
      r.destroy();
    },
  };
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

// ================================================================ the clutch: no idle after the lethal blow

/**
 * The engine's activation breaks the battle kit's consequence scan, so the blow that kills the wisp
 * plays as a non-lethal reaction and the body would spring back to idle — alive again for a beat —
 * before the effect arrives. Here: when a battle's wisp (target or attacker) has its own activation
 * coming in the same batch, the moment its hit reaction lets go of the sprite it is held in the
 * pillow's HUG pose (special f1: eyes shut, clutching itself), which the effect hook then plays on
 * from. One watcher per battle, ends on the hold, the unit leaving, or after 4 s.
 */
const clutched = new WeakSet<MonsterUnit>();
const CLUTCH_FRAME = 1;
if (LOOK_V3)
  registerObserver((ev, ctx) => {
    if (ev.type !== 'battle') return;
    const i0 = ctx.events.indexOf(ev);
    if (i0 < 0) return;
    const uids = [ev.targetUid, ev.attackerUid].filter((x): x is number => typeof x === 'number');
    for (const uid of uids) {
      if (ctx.cardId(uid) !== ID) continue;
      let comes = false;
      for (let i = i0 + 1; i < ctx.events.length; i++) {
        const e = ctx.events[i];
        if (e.type === 'battle') break;
        if (e.type === 'activate' && e.kind === 'monsterEffect' && e.uid === uid) {
          comes = true;
          break;
        }
      }
      const u = ctx.unit(uid);
      if (!comes || !live(u)) continue;
      const sc = ctx.scene;
      const atk = ev.attackerUid;
      // the blow lands (the battle kit's contact): from the next frame on, the moment the body is
      // back in its idle loop (straight away, or once a hit reaction lets go) it is held in the hug
      const onContact = (who: number): void => {
        if (who !== atk) return;
        sc.events.off('v3:contact', onContact);
        let t0 = 0;
        let held = false;
        let lastEsc = 0;
        // feathers already escaping the hold: whole inked feathers slip off its back and float up
        const esc = new Plumes(sc, u.home.x - 70, u.home.y - 110, 140, 130, u.sprite.depth + 0.3);
        const escRnd = mulberry32(u.uid * 7 + 3);
        onFrame(sc, (_dt, el) => {
          const quit = (): false => {
            esc.close();
            return false;
          };
          if (!live(u) || u.retired || el > 3000) return quit();
          if (el < 50) return true;
          if (held && !clutched.has(u)) return quit(); // the effect took over
          if (!held) {
            if (u.frameInfo().anim !== 'idle') return true;
            held = true;
            u.pose('special', CLUTCH_FRAME);
            clutched.add(u);
            t0 = el;
            return true;
          }
          // (FIX r2) a living hold, not a frozen egg: after the hug (f1) it squeezes and shudders
          // through the build-up frames f2 → f3 → f4 → f3 … while feathers slip out of it
          const fi = u.frameInfo();
          if (fi.anim !== 'special' || fi.frame > CLUTCH_FRAME + 3) return quit();
          const beat = Math.floor((el - t0) / 100);
          const want = beat === 0 ? CLUTCH_FRAME : CLUTCH_FRAME + [1, 2, 3, 2][(beat - 1) % 4];
          if (fi.frame !== want) u.pose('special', want);
          if (beat >= 1 && el - lastEsc > 170) {
            lastEsc = el;
            const c = u.core();
            const side = u.flipX ? 1 : -1;
            const a = -Math.PI / 2 + side * rr(escRnd, 0.3, 1.3);
            esc.add({ x: c.x + Math.cos(a) * 10, y: c.y - 6 + Math.sin(a) * 8, vx: Math.cos(a) * rr(escRnd, 20, 40), vy: rr(escRnd, -45, -25), len: rr(escRnd, 0, 1) < 0.5 ? 6 : 7, grav: -8, drag: 1.4, life: rr(escRnd, 520, 720), ang: a + Math.PI / 2, ink: true, swing: 1.1, hz: 2 }, escRnd);
          }
          return true;
        });
      };
      sc.events.on('v3:contact', onContact);
      void sleep(sc, 8000).then(() => sc.events.off('v3:contact', onContact));
    }
  });

export type { GameEvent };
