// TargetMarks — the v3 target marks of lane A6-B (docs/v3/A6_PLAN.md §3 F4 / F5, step B3; built and
// called only under V3_A6_B). Everything is palette pixels on whole-pixel positions (KO-1 … KO-3): no
// rotation, no scaling, no alpha fade, no ADD; the stepped light layer only lights the floor.
//
//   AimMarks (F4)    the human's pick on the board (HumanInput pickZone / pickTributes): four target
//                    corners ("nişan köşeleri" — gold3, 1-px ink outline, 4-px legs; ui-kit brackets)
//                    3 px outside each candidate monster's opaque box (the union of its rest frames).
//                    They arrive from 4 px further out in three steps (0–90 ms, ui3AimOpen), then
//                    breathe 1 px in / out every 420 ms (each candidate 140 ms after the one on its
//                    left). Under the pointer: one white frame, the corners settle 2 px in, the unit
//                    gets a one-frame gold contour (ui3Aim, a pentatonic step per candidate). The click
//                    (confirm): the corners close onto the body in two steps with one white contour
//                    frame and are gone by 60 ms (ui3Lock) — the action is sent at 0 ms, the marks ride
//                    the cinematic's first frames; the other candidates' corners step out and fade.
//                    A tribute pick: a chosen tribute's corners turn white beside a "1/2" counter
//                    (ui3Mark / ui3Unmark). A candidate tile without a monster keeps the calm arena's
//                    floor highlight (no corners), as the storyboard says.
//   SelectMark       the selected attacker while its target is picked: white corners, still.
//   rejectClick (F5) an invalid click on the board: the tile's outline two crimson frames, at the
//                    click point a 7×7 crimson × (1-px ink contour, ui-kit rejectStamp) that shakes
//                    ±2 px three times in 30-ms steps and fades in two palette steps (180 ms), the
//                    clicked unit's one-frame crimson contour, the selected attacker's corners one
//                    crimson frame, a small crimson floor flash; ui3Error. It never locks anything.
//   ackClick         a valid click on a pile (the graveyard: the panel opens): its tile outline two
//                    white frames (KO-5 "every click answers where it lands").
//   lockTargets      the engine `target` event (V3HOOKS.target — cards without their own hook): the
//                    same corners close onto every target in two steps, one white contour frame and a
//                    gold floor flash at the lock; 240 ms.
// Reduced motion (KO-9): no arrival steps, no breathing, no shake, no stepping out; a confirm is one
// frame. Sounds: the ui3 family through ui3Sfx (today's sound stands in while A6-A's recipe is silent).
//
//   const aim = new AimMarks(scene, views, refs);  aim.setHot(ref);  aim.confirm(ref) | aim.cancel();
//   rejectClick(scene, views, worldXY, { tile: { player, spot, index }, unit, selected });

import type Phaser from 'phaser';
import { frameRGBA } from '../../art/atlas';
import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { sfx, type SfxName, type SfxOpts } from '../../audio/sfx';
import { UI_CARD_RECIPES, type UiCardSfxName } from '../../audio/v3/ui-cards';
import type { DuelViews } from '../../duel/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { PlayerId, ZoneRef } from '../../engine/types';
import { lightFlash, lightPool, type LightHandle } from '../light';
import { DEPTH, zoneXY, type BoardSpot, type XY } from '../layout';
import { frameRectV3 } from '../../art/frame-v3';
import { PalText, canvasTexture, capYV3, hex, textWidthV3, ui3Sfx } from './hudSkin';
import { REDUCED_MOTION } from './motion';
import { brackets, rejectStamp, showContour } from './ui-kit';

export type CornerName = 'tl' | 'tr' | 'bl' | 'br';
export const CORNERS: readonly CornerName[] = Object.freeze(['tl', 'tr', 'bl', 'br'] as CornerName[]);

/** An inclusive pixel box (x1 / y1 are the last opaque column / row). */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The F4 timings and sizes (ms at 1×, px). */
export const AIM = Object.freeze({
  /** Corners sit this far outside the candidate's opaque box. */
  gap: 3,
  /** Corner leg (§1.5: ≥ 4 px). */
  leg: 4,
  /** Arrival: the extra gap for each 30-ms step (three steps in: +4, +2, +1, then 0 from 90 ms). */
  arrive: Object.freeze([4, 2, 1]) as readonly number[],
  stepMs: 30,
  /** Breathing: the corners sit 1 px in for every other half period. */
  breathMs: 420,
  /** Each candidate breathes this much later than the one on its left. */
  breathStagger: 140,
  /** Under the pointer the corners settle this many px in (one px per 33-ms step). */
  hotIn: 2,
  /** The confirm: the gap of the two closing steps, then the fade frame; gone at confirmMs. */
  close: Object.freeze([-1, -3]) as readonly number[],
  confirmMs: 60,
  /** Stepping out (cancel / the candidates not chosen): +1 px gold2, +2 px gold1, gone (67 ms). */
  leaveMs: 67,
  /** World depth: over every unit and effect, under the HUD (scroll-fixed UI starts at 2000). */
  depth: DEPTH.FX_TOP + 60,
});

/** The F5 reject: the stamp's 30-ms steps (x offset, palette step), then gone (180 ms). */
export const REJECT = Object.freeze({
  stepMs: 30,
  offsets: Object.freeze([0, 2, -2, 2, 0, 0]) as readonly number[],
  tones: Object.freeze([0, 0, 0, 0, 1, 2]) as readonly number[],
  totalMs: 180,
  /** The clicked tile's crimson outline lasts this many frames; the unit's contour one. */
  tileFrames: 2,
});

/** The engine target lock (V3HOOKS.target): gap per beat, the lock (white contour) frame and the end. */
export const LOCK = Object.freeze({
  /** [from ms, gap] — the corners appear 4 px out, close in two steps onto the body. */
  steps: Object.freeze([
    [0, 4],
    [40, 2],
    [80, 0],
  ]) as readonly (readonly [number, number])[],
  lockAt: 80,
  fadeAt: 200,
  ms: 240,
});

/** A minor pentatonic steps (A C D E G A'): ui3Aim's pitch by the candidate's order (left → right). */
export const PENTA: readonly number[] = Object.freeze([1, 6 / 5, 4 / 3, 3 / 2, 9 / 5, 2]);

const FRAME_MS = 1000 / 60;

// ================================================================ pure geometry (tested)

/** The extra gap (px past AIM.gap) `ms` after the corners opened: 4 → 2 → 1 → 0 (reduced: 0). */
export function arriveExtra(ms: number, reduced: boolean = REDUCED_MOTION): number {
  if (reduced || ms >= AIM.stepMs * AIM.arrive.length) return 0;
  return AIM.arrive[Math.max(0, Math.floor(ms / AIM.stepMs))];
}

/** Breathing: −1 (1 px in) for every other half period, staggered by the candidate's order (reduced: 0). */
export function breathIn(ms: number, order: number, reduced: boolean = REDUCED_MOTION): number {
  if (reduced) return 0;
  const t = ms - order * AIM.breathStagger;
  if (t < 0) return 0;
  return Math.floor(t / AIM.breathMs) % 2 === 1 ? -1 : 0;
}

/** Top-left of corner `c`'s 6×6 image for box `b` pushed out by `gap` (its corner pixel at canvas 1 / 4). */
export function cornerXY(c: CornerName, b: Box, gap: number): XY {
  const left = c === 'tl' || c === 'bl';
  const top = c === 'tl' || c === 'tr';
  return { x: left ? b.x0 - gap - 1 : b.x1 + gap - 4, y: top ? b.y0 - gap - 1 : b.y1 + gap - 4 };
}

/** The tightest gap the corners may close to on box `b` (they never cross: legs stay apart). */
export function minGap(b: Box): number {
  const w = b.x1 - b.x0 + 1;
  const h = b.y1 - b.y0 + 1;
  return -Math.max(0, Math.floor((Math.min(w, h) - 2 * AIM.leg - 2) / 2));
}

/** One corner (6×6): the L in `tone` (its corner pixel `joint`), legs AIM.leg, 1-px ink outline. */
export function cornerCanvas(c: CornerName, tone: number, joint: number = tone): PixelCanvas {
  const p = new PixelCanvas(6, 6);
  return brackets(p, 1, 1, 4, 4, tone, { corners: [c], leg: AIM.leg, joint });
}

/** The reject stamp's x offset and palette step `ms` after the click (null = gone). */
export function rejectStep(ms: number, reduced: boolean = REDUCED_MOTION): { dx: number; tone: number } | null {
  if (ms >= REJECT.totalMs) return null;
  const i = Math.max(0, Math.floor(ms / REJECT.stepMs));
  if (i >= REJECT.offsets.length) return null;
  return { dx: reduced ? 0 : REJECT.offsets[i], tone: REJECT.tones[i] };
}

/** The engine lock's gap `ms` into it (LOCK.steps). */
export function lockGap(ms: number): number {
  let g = LOCK.steps[0][1];
  for (const [from, gap] of LOCK.steps) if (ms >= from) g = gap;
  return g;
}

/** A union of boxes (null when none). */
export function unionBox(a: Box | null, b: Box | null): Box | null {
  if (!a) return b ? { ...b } : null;
  if (!b) return { ...a };
  return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
}

/** The opaque box of RGBA pixels (w × h), or null when nothing is opaque. */
export function opaqueBox(data: ArrayLike<number>, w: number, h: number): Box | null {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      if (data[row + x * 4 + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

// ================================================================ unit boxes

type FrameSprite = Phaser.GameObjects.Sprite;

/** Frame-local opaque box of every frame of an animation in a texture (union), by `texture|anim`. */
const restBoxCache = new Map<string, Box | null>();

function frameBox(frame: Phaser.Textures.Frame | null | undefined): Box | null {
  if (!frame) return null;
  const data = frameRGBA(frame as unknown as Parameters<typeof frameRGBA>[0]);
  if (!data || data.length !== frame.realWidth * frame.realHeight * 4) return null;
  return opaqueBox(data, frame.realWidth, frame.realHeight);
}

/** The union of the opaque boxes of the frames of the sprite's current animation (its rest loop). */
function restBox(s: FrameSprite): Box | null {
  const tex = s.texture;
  const name = String(s.frame?.name ?? '');
  const i = name.indexOf(':');
  const anim = i < 0 ? name : name.slice(0, i);
  const key = `${tex.key}|${anim}`;
  if (restBoxCache.has(key)) return restBoxCache.get(key) ?? null;
  let u: Box | null = null;
  if (i >= 0) {
    for (const n of tex.getFrameNames()) if (n.startsWith(`${anim}:`)) u = unionBox(u, frameBox(tex.get(n)));
  }
  u = unionBox(u, frameBox(s.frame));
  restBoxCache.set(key, u);
  return u;
}

/** A unit's rest box in world pixels (null when it is hidden, retired or not drawn at 1×). */
export function unitBox(u: MonsterUnit | null | undefined): Box | null {
  if (!u || u.retired) return null;
  const s = u.sprite;
  if (!s || !s.active || !s.visible || s.rotation !== 0 || Math.abs(s.scaleX) !== 1 || Math.abs(s.scaleY) !== 1) return null;
  const lb = restBox(s);
  if (!lb) return null;
  const W = s.frame.realWidth;
  const left = Math.round(s.x - s.displayOriginX);
  const top = Math.round(s.y - s.displayOriginY);
  const x0 = s.flipX ? W - 1 - lb.x1 : lb.x0;
  const x1 = s.flipX ? W - 1 - lb.x0 : lb.x1;
  return { x0: left + x0, y0: top + lb.y0, x1: left + x1, y1: top + lb.y1 };
}

/** A box around a zone without a unit (a set card lying on its tile). */
export function tileBox(player: PlayerId, spot: BoardSpot, index: number): Box {
  const c = zoneXY(player, spot, index);
  return { x0: c.x - 18, y0: c.y - 11, x1: c.x + 17, y1: c.y + 7 };
}

// ================================================================ sounds

/** A ui3 card-family sound (ui-cards.ts) or today's stand-in while its recipe is the silent skeleton. */
export function ui3CardSfx(name: UiCardSfxName, opts: SfxOpts = {}, fallback: SfxName | null = null, fallbackOpts: SfxOpts = opts): void {
  const r = UI_CARD_RECIPES[name] as { play: (...a: unknown[]) => void } | undefined;
  if (r && r.play.length >= 1) sfx.play(name, opts);
  else if (fallback) sfx.play(fallback, fallbackOpts);
}

// ================================================================ corner sets

function cornerKey(scene: Phaser.Scene, c: CornerName, tone: number, joint: number): string {
  return canvasTexture(scene, `ui3:aim:${c}:${hex(tone)}:${hex(joint)}`, () => cornerCanvas(c, tone, joint));
}

/** Four corner images around a box (whole pixels, AIM.depth). */
class CornerSet {
  private readonly imgs: Phaser.GameObjects.Image[];
  private readonly scene: Phaser.Scene;
  private key = '';
  private dead = false;

  constructor(scene: Phaser.Scene, depth: number = AIM.depth) {
    this.scene = scene;
    this.imgs = CORNERS.map((c) => scene.add.image(0, 0, cornerKey(scene, c, PAL.gold3, PAL.gold3)).setOrigin(0, 0).setDepth(depth).setVisible(false));
  }

  /** Draw the corners around `b` at `gap` in `tone` (null box / tone = hidden). */
  draw(b: Box | null, gap: number, tone: number | null, joint: number | null = tone): void {
    if (this.dead) return;
    if (!b || tone === null) {
      for (const i of this.imgs) i.setVisible(false);
      return;
    }
    const g = Math.max(minGap(b), Math.round(gap));
    const j = joint ?? tone;
    const k = `${tone}|${j}`;
    CORNERS.forEach((c, n) => {
      const img = this.imgs[n];
      if (k !== this.key) img.setTexture(cornerKey(this.scene, c, tone, j));
      const p = cornerXY(c, b, g);
      img.setPosition(p.x, p.y).setVisible(true);
    });
    this.key = k;
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const i of this.imgs) if (i.active) i.destroy();
  }
}

/**
 * Short-lived contours / outlines, each shown for exactly `frames` rendered frames: one added during
 * frame N (input, timers, tweens or a post-update tick) is drawn in N … N + frames − 1 and destroyed
 * by the first tick of frame N + frames (counted on the game loop's frame number).
 */
class Flashes {
  private readonly scene: Phaser.Scene;
  private readonly list: { h: { destroy(): void }; until: number }[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  private frame(): number {
    return this.scene.game?.getFrame?.() ?? 0;
  }

  add(h: { destroy(): void } | null, frames = 1): void {
    if (h) this.list.push({ h, until: this.frame() + Math.max(1, frames) });
  }

  /** Drop the ones whose frames have been shown (call it first thing on a post-update tick). */
  tick(): void {
    const now = this.frame();
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (now < this.list[i].until) continue;
      this.list[i].h.destroy();
      this.list.splice(i, 1);
    }
  }

  get size(): number {
    return this.list.length;
  }

  clear(): void {
    for (const f of this.list.splice(0)) f.h.destroy();
  }
}

/** A frame clock on the scene's post-update (dt × the tween time scale: speed and pauses respected). */
function onFrames(scene: Phaser.Scene, fn: (dt: number) => boolean | void): () => void {
  let on = true;
  const tick = (_t: number, delta: number) => {
    if (!on) return;
    const k = scene.time?.timeScale ?? 1;
    const d = Math.min(50, Math.max(0, delta)) * (Number.isFinite(k) ? k : 1);
    if (fn(d) === false) stop();
  };
  const stop = () => {
    if (!on) return;
    on = false;
    scene.events.off('postupdate', tick);
    scene.events.off('shutdown', stop);
  };
  scene.events.on('postupdate', tick);
  scene.events.once('shutdown', stop);
  return stop;
}

// ================================================================ F4: the human's pick

type AimState = 'arrive' | 'idle' | 'hot' | 'unhot' | 'marked' | 'close' | 'leave' | 'dead';

interface AimEntry {
  ref: ZoneRef;
  unit: MonsterUnit;
  order: number;
  set: CornerSet;
  state: AimState;
  /** ms and frames in the current state; ms since the marks opened (the breathing phase). */
  t: number;
  frames: number;
  age: number;
  /** A one-frame tone (e.g. the reject's crimson), frames left. */
  flash: { tone: number; frames: number } | null;
  label: CounterTag | null;
  /** The confirm's white contour frame was shown. */
  contoured: boolean;
}

const sameRef = (a: ZoneRef, b: ZoneRef) => a.player === b.player && a.zone === b.zone && a.index === b.index;

/**
 * The F4 marks of one board pick (see the header). Only candidates with a monster on screen get
 * corners; `size` says how many. The marks dispose of themselves after confirm() / cancel().
 */
export class AimMarks {
  private readonly scene: Phaser.Scene;
  private readonly views: DuelViews;
  private readonly entries: AimEntry[] = [];
  private readonly flashes: Flashes;
  private readonly stop: () => void;
  private hot: AimEntry | null = null;
  /** The warm floor pool under the candidate under the pointer (stepped light layer, G4). */
  private pool: LightHandle | null = null;
  private ended = false;
  private dead = false;

  constructor(scene: Phaser.Scene, views: DuelViews, refs: readonly ZoneRef[], opts: { sound?: boolean } = {}) {
    this.scene = scene;
    this.views = views;
    this.flashes = new Flashes(scene);
    const withUnits: { ref: ZoneRef; unit: MonsterUnit; x: number }[] = [];
    for (const r of refs) {
      if (r.zone !== 'monster') continue;
      const u = views.field.unitAt(r.player, r.index);
      if (!u || !unitBox(u)) continue;
      withUnits.push({ ref: r, unit: u, x: u.home.x });
    }
    withUnits.sort((a, b) => a.x - b.x);
    withUnits.forEach((w, order) => {
      this.entries.push({ ref: w.ref, unit: w.unit, order, set: new CornerSet(scene), state: 'arrive', t: 0, frames: 0, age: 0, flash: null, label: null, contoured: false });
    });
    if (this.entries.length && opts.sound !== false) ui3Sfx('ui3AimOpen', {});
    this.stop = onFrames(scene, (dt) => this.tick(dt));
    scene.events.once('shutdown', () => this.destroy());
  }

  /** Candidates that carry corners. */
  get size(): number {
    return this.entries.length;
  }

  /** Does `ref` carry corners? */
  has(ref: ZoneRef): boolean {
    return this.entries.some((e) => sameRef(e.ref, ref));
  }

  /** The candidate under the pointer (null: none): its corners settle in, one white frame, a gold contour frame. */
  setHot(ref: ZoneRef | null): void {
    if (this.ended) return;
    const e = ref ? (this.entries.find((x) => sameRef(x.ref, ref)) ?? null) : null;
    if (e === this.hot) return;
    const prev = this.hot;
    this.hot = e;
    if (prev && prev.state === 'hot') this.enter(prev, 'unhot');
    this.setPool(e);
    if (!e) return;
    if (e.state === 'marked') return;
    this.enter(e, 'hot');
    this.flashes.add(showContour(this.scene, e.unit.sprite, PAL.gold3, { depth: e.unit.sprite.depth + 0.02 }));
    ui3Sfx('ui3Aim', { pitch: PENTA[e.order % PENTA.length] }, 'uiHover', { volume: 0.3, pitch: 1.3 });
  }

  /** A tribute pick: `label` ("1/2") marks the candidate white beside its counter; null unmarks it. */
  mark(ref: ZoneRef, label: string | null, sound = true): void {
    if (this.ended) return;
    const e = this.entries.find((x) => sameRef(x.ref, ref));
    if (!e) return;
    if (label === null) {
      if (e.state !== 'marked') return;
      e.label?.destroy();
      e.label = null;
      this.enter(e, e === this.hot ? 'hot' : 'unhot');
      if (sound) ui3CardSfx('ui3Unmark', {}, 'uiClick', { volume: 0.7 });
      return;
    }
    if (!e.label) e.label = new CounterTag(this.scene, label);
    else e.label.setText(label);
    if (e.state !== 'marked') {
      this.enter(e, 'marked');
      if (sound) ui3CardSfx('ui3Mark', {}, 'uiClick', { volume: 0.7 });
    }
  }

  /** The candidate's corners one frame in `tone` (the reject's crimson). */
  flash(ref: ZoneRef | null, tone: number = PAL.crim3): void {
    for (const e of this.entries) if (!ref || sameRef(e.ref, ref)) e.flash = { tone, frames: 1 };
  }

  /** The click: `chosen` close onto their bodies (60 ms), the others step out; then the marks are gone. */
  confirm(chosen: ZoneRef | readonly ZoneRef[], sound = true): void {
    if (this.ended) return;
    this.ended = true;
    const list = Array.isArray(chosen) ? (chosen as readonly ZoneRef[]) : [chosen as ZoneRef];
    for (const e of this.entries) {
      e.label?.destroy();
      e.label = null;
      this.enter(e, list.some((r) => sameRef(r, e.ref)) ? 'close' : 'leave');
    }
    if (sound) ui3Sfx('ui3Lock', {}, 'uiClick', { volume: 0.7 });
    // the lock lights the chosen floor once (gold, stepped); the pointer's pool goes with it
    this.setPool(null);
    for (const e of this.entries) {
      if (!list.some((r) => sameRef(r, e.ref))) continue;
      const h = e.unit.home;
      void lightFlash(this.scene, h.x, h.y, PAL.gold3, 24, 220, { intensity: 0.9 });
    }
  }

  /** The pick ended without a choice (Esc, İPTAL, a QA dispatch): every corner steps out and fades. */
  cancel(): void {
    if (this.ended) return;
    this.ended = true;
    this.setPool(null);
    for (const e of this.entries) {
      e.label?.destroy();
      e.label = null;
      this.enter(e, 'leave');
    }
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.ended = true;
    this.stop();
    this.flashes.clear();
    this.pool?.destroy();
    this.pool = null;
    for (const e of this.entries) {
      e.set.destroy();
      e.label?.destroy();
      e.state = 'dead';
    }
  }

  /** A warm gold pool on the floor under `e` (null: the current one fades). */
  private setPool(e: AimEntry | null): void {
    const old = this.pool;
    this.pool = null;
    if (old?.alive) void old.fadeOut(100);
    if (!e) return;
    const h = e.unit.home;
    this.pool = lightPool(this.scene, h.x, h.y, { color: PAL.gold3, radius: 22, intensity: 0, fadeIn: 0 });
    this.pool.setIntensity(0.75, REDUCED_MOTION ? 0 : 60);
  }

  private enter(e: AimEntry, s: AimState): void {
    e.state = s;
    e.t = 0;
    e.frames = 0;
  }

  private tick(dt: number): boolean {
    if (this.dead) return false;
    this.flashes.tick();
    let alive = 0;
    for (const e of this.entries) {
      if (e.state === 'dead') continue;
      // draw this frame from the time reached so far, then advance to the next frame
      this.render(e, dt);
      e.t += dt;
      e.age += dt;
      e.frames++;
      if ((e.state as AimState) !== 'dead') alive++;
    }
    if (this.ended && !alive && !this.flashes.size) {
      this.destroy();
      return false;
    }
    return true;
  }

  private render(e: AimEntry, _dt: number): void {
    const box = unitBox(e.unit);
    let gap: number = AIM.gap;
    let tone: number | null = PAL.gold3;
    let joint: number | null = null;
    switch (e.state) {
      case 'arrive': {
        if (REDUCED_MOTION || e.t >= AIM.stepMs * AIM.arrive.length) {
          this.enter(e, 'idle');
          gap += breathIn(e.age, e.order);
          break;
        }
        gap += arriveExtra(e.t);
        tone = e.t < AIM.stepMs ? PAL.gold2 : PAL.gold3;
        break;
      }
      case 'idle':
        gap += breathIn(e.age, e.order);
        break;
      case 'hot':
        gap -= REDUCED_MOTION || e.t >= 33 ? AIM.hotIn : 1;
        if (e.frames === 0) tone = PAL.white;
        break;
      case 'unhot':
        if (REDUCED_MOTION || e.t >= 33) {
          this.enter(e, 'idle');
          gap += breathIn(e.age, e.order);
        } else gap -= 1;
        break;
      case 'marked':
        gap -= 1;
        tone = PAL.white;
        break;
      case 'close': {
        if (REDUCED_MOTION) {
          if (e.frames >= 1) return this.kill(e);
          gap = 0;
          tone = PAL.white;
          break;
        }
        if (e.t >= AIM.confirmMs) return this.kill(e);
        // whole frames (the frozen QA clock's frame is a float step under 1000 / 60)
        const step = Math.min(2, e.frames);
        gap = AIM.close[Math.min(1, step)];
        tone = step === 0 ? PAL.gold4 : step === 1 ? PAL.white : PAL.gold2;
        if (step === 1 && !e.contoured) {
          e.contoured = true;
          this.flashes.add(showContour(this.scene, e.unit.sprite, PAL.white, { depth: e.unit.sprite.depth + 0.02 }));
        }
        break;
      }
      case 'leave': {
        const ms = REDUCED_MOTION ? 2 * FRAME_MS : AIM.leaveMs;
        if (e.t >= ms) return this.kill(e);
        const first = e.t < ms / 2;
        gap += REDUCED_MOTION ? 0 : first ? 1 : 2;
        tone = first ? PAL.gold2 : PAL.gold1;
        break;
      }
      case 'dead':
        return;
    }
    if (e.flash && e.flash.frames > 0) {
      tone = e.flash.tone;
      joint = e.flash.tone;
      e.flash.frames--;
    }
    e.set.draw(box, gap, tone, joint ?? tone);
    // the counter tag sits just off the top-right corner, its middle on the corner's top leg
    if (e.label && box) {
      const g = Math.max(minGap(box), gap);
      e.label.setPosition(box.x1 + g + 3, box.y0 - g - Math.floor(TAG_H / 2));
    }
  }

  private kill(e: AimEntry): void {
    e.state = 'dead';
    e.set.destroy();
    e.label?.destroy();
    e.label = null;
  }
}

/** The tribute counter tag's height (a dark plate, 1-px ink outline, white trim, sm digits). */
const TAG_H = 11;

/** "1/2" beside a chosen tribute (F4 "Kurban seçimi"): a tiny v3 plate with white digits. */
class CounterTag {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Image;
  private readonly text: PalText;
  private label = '';

  constructor(scene: Phaser.Scene, label: string) {
    this.scene = scene;
    this.root = scene.add.container(0, 0).setDepth(AIM.depth + 1);
    this.bg = scene.add.image(0, 0, '__WHITE').setOrigin(0, 0);
    this.text = new PalText(scene, 3, capYV3('sm', 3), '', { size: 'sm', color: PAL.white });
    this.root.add([this.bg, this.text.root]);
    this.setText(label);
  }

  setText(label: string): void {
    if (label === this.label) return;
    this.label = label;
    const w = textWidthV3(label, 'sm') + 6;
    const key = canvasTexture(this.scene, `ui3:aim:tag:${w}`, () =>
      frameRectV3(new PixelCanvas(w, TAG_H), 0, 0, w, TAG_H, { light: PAL.white, dark: PAL.mist }),
    );
    this.bg.setTexture(key);
    this.text.setText(label);
  }

  setPosition(x: number, y: number): void {
    this.root.setPosition(Math.round(x), Math.round(y));
  }

  destroy(): void {
    this.text.destroy();
    if (this.root.active) this.root.destroy();
  }
}

/** The selected attacker during its target pick: white corners, still (F4 / F5). */
export class SelectMark {
  private readonly set: CornerSet;
  private readonly unit: MonsterUnit;
  private readonly stop: () => void;
  private flashTone: number | null = null;
  private flashFrames = 0;
  private leaving = -1;
  private dead = false;

  constructor(scene: Phaser.Scene, unit: MonsterUnit) {
    this.unit = unit;
    this.set = new CornerSet(scene);
    this.draw();
    this.stop = onFrames(scene, (dt) => {
      if (this.dead) return false;
      if (this.leaving >= (REDUCED_MOTION ? 2 * FRAME_MS : AIM.leaveMs)) {
        this.destroy();
        return false;
      }
      this.draw();
      if (this.leaving >= 0) this.leaving += dt;
      return true;
    });
    scene.events.once('shutdown', () => this.destroy());
  }

  /** One frame (or `frames`) in `tone`: the reject's crimson. */
  flash(tone: number = PAL.crim3, frames = 1): void {
    this.flashTone = tone;
    this.flashFrames = frames;
  }

  /** Step out and fade (two palette steps), then gone. */
  release(): void {
    if (this.leaving < 0) this.leaving = 0;
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.stop?.();
    this.set.destroy();
  }

  private draw(): void {
    if (this.dead) return;
    let gap: number = AIM.gap - 1;
    let tone: number = PAL.white;
    if (this.leaving >= 0) {
      const first = this.leaving < AIM.leaveMs / 2;
      gap += REDUCED_MOTION ? 0 : first ? 1 : 2;
      tone = first ? PAL.gold2 : PAL.gold1;
    }
    if (this.flashFrames > 0 && this.flashTone !== null) {
      tone = this.flashTone;
      this.flashFrames--;
    }
    this.set.draw(unitBox(this.unit), gap, tone);
  }
}

// ================================================================ F5: the reject

function stampKey(scene: Phaser.Scene, tone: number): string {
  return canvasTexture(scene, `ui3:reject:${tone}`, () => rejectStamp(new PixelCanvas(9, 9), 4, 4, { tone }));
}

export interface RejectOpts {
  /** The clicked tile (its outline goes crimson for two frames; a small crimson floor flash). */
  tile?: { player: PlayerId; spot: BoardSpot; index: number } | null;
  /** The clicked unit (a one-frame crimson contour). */
  unit?: MonsterUnit | null;
  /** The selected attacker's corners (one crimson frame). */
  selected?: SelectMark | null;
  /** The pick's marks (their corners one crimson frame), e.g. a tribute pick. */
  aim?: AimMarks | null;
  /** Play ui3Error (default true); `fallback` today's sound while the recipe is silent. */
  sound?: boolean;
  fallbackVolume?: number;
}

/**
 * F5: an invalid click at world point `at` (see the header). Starts on the click's own frame,
 * gone by 180 ms; never locks. Returns a handle that stops it early (e.g. scene teardown).
 */
export function rejectClick(scene: Phaser.Scene, views: DuelViews, at: XY, o: RejectOpts = {}): { destroy(): void } {
  const x = Math.round(at.x);
  const y = Math.round(at.y);
  const img = scene.add.image(x - 4, y - 4, stampKey(scene, 0)).setOrigin(0, 0).setDepth(AIM.depth + 2);
  const flashes = new Flashes(scene);
  if (o.tile) {
    const pad = views.board.tileImage(o.tile.player, o.tile.spot, o.tile.index);
    if (pad && pad.visible) flashes.add(showContour(scene, pad as unknown as Phaser.GameObjects.Image, PAL.crim3), REJECT.tileFrames);
    const c = zoneXY(o.tile.player, o.tile.spot, o.tile.index);
    void lightFlash(scene, c.x, c.y, PAL.crim3, 14, 160, { intensity: 0.45 });
  }
  if (o.unit && unitBox(o.unit)) flashes.add(showContour(scene, o.unit.sprite, PAL.crim3, { depth: o.unit.sprite.depth + 0.02 }));
  o.selected?.flash(PAL.crim3, 1);
  o.aim?.flash(null, PAL.crim3);
  if (o.sound !== false) ui3Sfx('ui3Error', {}, 'uiError', { volume: o.fallbackVolume ?? 0.4 });
  let t = 0;
  let tone = 0;
  let dead = false;
  const end = () => {
    if (dead) return;
    dead = true;
    stop();
    flashes.clear();
    if (img.active) img.destroy();
  };
  const stop = onFrames(scene, (dt) => {
    flashes.tick();
    const s = rejectStep(t);
    t += dt;
    if (!s) {
      end();
      return false;
    }
    if (s.tone !== tone) {
      tone = s.tone;
      img.setTexture(stampKey(scene, tone));
    }
    img.setPosition(x - 4 + s.dx, y - 4);
    return true;
  });
  scene.events.once('shutdown', end);
  return { destroy: end };
}

/** KO-5: a valid click on a pile tile (the graveyard): its outline two white frames. */
export function ackClick(scene: Phaser.Scene, views: DuelViews, tile: { player: PlayerId; spot: BoardSpot; index: number }): void {
  const pad = views.board.tileImage(tile.player, tile.spot, tile.index);
  if (!pad || !pad.visible) return;
  const flashes = new Flashes(scene);
  flashes.add(showContour(scene, pad as unknown as Phaser.GameObjects.Image, PAL.white), REJECT.tileFrames);
  const stop = onFrames(scene, () => {
    flashes.tick();
    if (flashes.size) return true;
    stop();
    return false;
  });
  scene.events.once('shutdown', () => flashes.clear());
}

// ================================================================ the engine target lock

/**
 * V3HOOKS.target: the corners close onto every target (LOCK: 4 → 2 → 0 px by 80 ms), one white
 * contour frame and a gold floor flash at the lock (ui3Lock), a gold2 fade from 200 ms; resolves at
 * 240 ms. A target without a unit on screen (a set card) gets the corners round its tile.
 */
export function lockTargets(scene: Phaser.Scene, views: DuelViews, refs: readonly ZoneRef[]): Promise<void> {
  const marks = refs.map((r) => {
    const unit = r.zone === 'monster' ? views.field.unitAt(r.player, r.index) : null;
    const hasUnit = !!unitBox(unit);
    return { r, unit: hasUnit ? unit : null, set: new CornerSet(scene), contoured: false };
  });
  const flashes = new Flashes(scene);
  let t = 0;
  let locked = false;
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      stop();
      flashes.clear();
      for (const m of marks) m.set.destroy();
      resolve();
    };
    const draw = () => {
      const g = REDUCED_MOTION ? 0 : lockGap(t);
      // the lock frame is the first frame drawn at or past lockAt (exactly one, whatever the frame length)
      const lockFrame = !locked && t >= LOCK.lockAt;
      const tone = t >= LOCK.fadeAt ? PAL.gold2 : lockFrame ? PAL.white : PAL.gold3;
      for (const m of marks) {
        const b = m.unit ? unitBox(m.unit) : tileBox(m.r.player, m.r.zone, m.r.index);
        m.set.draw(b, g, tone);
        if (lockFrame && m.unit && !m.contoured) {
          m.contoured = true;
          flashes.add(showContour(scene, m.unit.sprite, PAL.white, { depth: m.unit.sprite.depth + 0.02 }));
        }
      }
      if (lockFrame) {
        locked = true;
        ui3Sfx('ui3Lock', {}, 'lockOn', { volume: 0.7 });
        for (const m of marks) {
          const c = zoneXY(m.r.player, m.r.zone, m.r.index);
          void lightFlash(scene, c.x, c.y, PAL.gold3, 22, 200, { intensity: 0.8 });
        }
      }
    };
    draw();
    const stop = onFrames(scene, (dt) => {
      flashes.tick();
      if (t >= LOCK.ms) {
        finish();
        return false;
      }
      draw();
      t += dt;
      return true;
    });
    scene.events.once('shutdown', finish);
  });
}
