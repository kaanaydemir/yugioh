// The v3 hand (K1) — lane A6-A, step A2 (docs/v3/A6_PLAN.md §3 K1, §4.4 KO-1 … KO-3, KO-9; S-9).
// HandView keeps its state and API; with lane A6-A on (V3_A6_A) its v3 branches use this module:
//   - the cards stand straight (no rotation, ever); the fan is a y curve only (the outer cards sit
//     1–4 px lower); every card breathes 0 / −1 px (2400 ms, the phase 300 ms later per card)
//   - a playable card wears a 1-px rim in its owner's tone (PLAYER_RAMP[p][3]) with a running light
//     node (CardV3.setRim); a locked hand dims the rims a tone and holds the nodes
//   - hover: 0 → −18 px (easeOutCubic, 100 ms), settles on −16 (40 ms) with two white frames on the
//     rim, the top / left edges lit; the neighbours open ±12 / ±7 / ±4 px (120 ms); leave −16 → 0
//   - select: press −16 → −13 (40 ms, two white frames), −13 → −17 → −16 (70 ms), a gold rim with
//     two nodes; mark (discard pick): up 9 px with a crimson rim + node; reject: x +2 −2 +1 −1 0
//     (30 ms steps) with two crimson frames
// Everything lands on whole pixels: HandMotion steps every card itself (its own whole-pixel tracks
// on the scene's scaled clock, as the tweens did: speed / hit-stop / pause aware) and nothing else
// moves a hand card while it rests in the hand. Reduced motion (KO-9): no breathing, no press, no
// shake, no node travel; the lift is one 60 ms move.
//
//   const motion = new HandMotion(scene);
//   motion.place(sprite, x, y, 'hover', true, i * HAND3.breathStep);   // every layout
//   motion.reject(sprite);                                              // the shake
//   motion.release(sprite);                                             // a cinematic takes the card
//
// No runtime Phaser import (the scene is given), so the pure parts are unit-tested in node.

import type Phaser from 'phaser';
import { PAL, PLAYER_RAMP, RAMPS, type Ramp } from '../../art/palette';
import type { PlayerId } from '../../engine/types';
import type { RimStyle } from './CardV3';
import { REDUCED_MOTION } from './motion';

/** The v3 hand's numbers (K1; v1 geometry: the hand band of layout.ts UI_V1). */
export const HAND3 = Object.freeze({
  /** Card centre y at rest: the bottom edge on the screen edge (as v1). */
  baseY: 326,
  /** The fan's y curve: the outermost cards sit this many px lower at most (1–4). */
  maxDip: 4,
  /** Hover: rise past the lift, then settle on it. */
  rise: 18,
  lift: 16,
  riseMs: 100,
  settleMs: 40,
  /** Leave: back to rest, no overshoot. */
  leaveMs: 100,
  /** Select: press to −13, pop to −17, back on −16. */
  press: 13,
  pop: 17,
  pressMs: 40,
  popMs: 35,
  backMs: 35,
  /** Mark (end-phase discard pick): up 9 px. */
  mark: 9,
  markMs: 90,
  /** Neighbours open ±12 / ±7 / ±4 px (1, 2, ≥ 3 cards away). */
  spread: Object.freeze([12, 7, 4]),
  spreadMs: 120,
  /** Breathing: 0 / −1 px, period and the phase step per card. */
  breathMs: 2400,
  breathStep: 300,
  /** Reject: the x offsets, one per step. */
  reject: Object.freeze([2, -2, 1, -1, 0]),
  rejectStepMs: 30,
  /** Rim flashes: two frames (white on a settle / press, crimson on a reject). */
  flashMs: 34,
  /** Reduced motion: the lift in one move. */
  reducedLiftMs: 60,
  /** Widest step between card centres (as v1). */
  maxStep: 52,
  /** The hand's face-down wave (setFaceDown): ms between cards and per turn (today's 55 / 240). */
  waveStepMs: 55,
  turnMs: 240,
});

/** What a hand card is doing (its lift above the fan). */
export type LiftState = 'rest' | 'hover' | 'select' | 'mark';

/** The lift of a state (px up, positive). */
export function liftOf(state: LiftState): number {
  return state === 'hover' || state === 'select' ? HAND3.lift : state === 'mark' ? HAND3.mark : 0;
}

// ================================================================ the fan (pure)

/** The fan's y dip (px down) of card i of n: 0 in the middle, up to 1–4 px for the outer cards. */
export function fanDip(i: number, n: number): number {
  if (n <= 1) return 0;
  const half = (n - 1) / 2;
  const off = i - half;
  const max = Math.min(HAND3.maxDip, n - 1);
  return Math.round((max * off * off) / (half * half));
}

/** The horizontal step between card centres for n cards in a band `bandW` wide (as v1). */
export function fanStep(n: number, bandW: number, cardW: number): number {
  return n <= 1 ? 0 : Math.min(HAND3.maxStep, (bandW - cardW - 8) / (n - 1));
}

/** How far card i moves aside when card h is raised (0 for h itself or no h). */
export function spreadOf(i: number, h: number): number {
  if (h < 0 || i === h) return 0;
  const d = i - h;
  const a = Math.abs(d);
  return Math.sign(d) * HAND3.spread[Math.min(a, HAND3.spread.length) - 1];
}

/**
 * The x of every card of n with card h raised (−1 = none): the resting fan, the neighbours opened
 * ±12 / ±7 / ±4 px — and, as the cards stand straight with only a few px between them, a card that
 * had a gap to its inner neighbour keeps at least 2 px of it (the farther cards open less, so the
 * plain numbers would close the gap behind the first neighbour). Whole pixels.
 */
export function fanXs(n: number, h: number, band: { x: number; w: number }, cardW: number): number[] {
  const cx = band.x + band.w / 2;
  const step = fanStep(n, band.w, cardW);
  const rest = Array.from({ length: n }, (_, i) => cx + (i - (n - 1) / 2) * step);
  const xs = rest.map((x, i) => Math.round(x + spreadOf(i, h)));
  if (h >= 0 && h < n) {
    const keep = step - cardW >= 2 ? cardW + 2 : 0;
    if (keep)
      for (let i = h + 2; i < n; i++) xs[i] = Math.max(xs[i], xs[i - 1] + keep);
    if (keep)
      for (let i = h - 2; i >= 0; i--) xs[i] = Math.min(xs[i], xs[i + 1] - keep);
  }
  return xs;
}

/**
 * The resting (unlifted) whole-pixel pose of card i of n with card h raised (−1 = none): x with the
 * neighbours opened (fanXs), y on the fan's curve. Never rotated.
 */
export function fanPose(i: number, n: number, h: number, band: { x: number; w: number }, cardW: number): { x: number; y: number } {
  return { x: fanXs(n, h, band, cardW)[i], y: HAND3.baseY + fanDip(i, n) };
}

/** Breathing offset (0 or −1 px) of a card at hand time `t` with phase `phase` (ms). */
export function breathOf(t: number, phase: number, reduced: boolean = REDUCED_MOTION): number {
  if (reduced) return 0;
  const P = HAND3.breathMs;
  const u = (((t - phase) % P) + P) % P;
  return u < P / 2 ? 0 : -1;
}

/** The reject shake's x offset `t` ms into it (0 after the last step). */
export function rejectOffset(t: number): number {
  const i = Math.floor(t / HAND3.rejectStepMs);
  return i >= 0 && i < HAND3.reject.length ? HAND3.reject[i] : 0;
}

/**
 * The pentatonic note ladder of a hover over card i (K1 "nota merdiveni"): a playback-rate
 * multiplier, A minor pentatonic climbing left → right around the hand's middle (S5: kept quiet).
 */
export function hoverPitch(i: number, n: number): number {
  const DEG = [0, 3, 5, 7, 10];
  const k = i - Math.floor((Math.max(1, n) - 1) / 2);
  const oct = Math.floor(k / 5);
  const semis = DEG[((k % 5) + 5) % 5] + 12 * oct;
  return 1.2 * Math.pow(2, semis / 12);
}

// ================================================================ the rim (pure)

/** Everything a hand card's rim depends on. */
export interface HandRimState {
  owner: PlayerId;
  faceDown: boolean;
  playable: boolean;
  hover: boolean;
  selected: boolean;
  marked: boolean;
  markColor: number;
  /** The hand is locked (a cinematic plays): rims a tone down, nodes held. */
  locked: boolean;
}

/** The ramp a mark colour belongs to (for the node's tail). */
function rampFor(color: number): Ramp {
  for (const r of Object.values(RAMPS)) if ((r as readonly number[]).includes(color)) return r;
  return RAMPS.crim;
}

/**
 * A hand card's rim (KO-3): selected → gold, two nodes; marked → the mark colour + node; playable →
 * the owner's tone + node (hovered: the top / left edges a tone lighter; locked: a tone down, the
 * node held); an unplayable card under the pointer → a neutral top / left light strip only.
 */
export function handRim(s: HandRimState): RimStyle | null {
  if (s.faceDown) return null;
  const R = PLAYER_RAMP[s.owner];
  if (s.selected) return { tl: PAL.gold3, br: PAL.gold3, nodes: 2, ramp: RAMPS.gold };
  if (s.marked) return { tl: s.markColor, br: s.markColor, nodes: 1, ramp: rampFor(s.markColor) };
  if (s.playable) {
    if (s.locked) return { tl: R[2], br: R[2], nodes: 1, run: false, ramp: R };
    if (s.hover) return { tl: R[4], br: R[3], nodes: 1, ramp: R };
    return { tl: R[3], br: R[3], nodes: 1, ramp: R };
  }
  if (s.hover && !s.locked) return { tl: PAL.mist, br: null };
  return null;
}

// ================================================================ whole-pixel tracks

export type Ease = (k: number) => number;

export const EASE = Object.freeze({
  linear: (k: number) => k,
  outQuad: (k: number) => 1 - (1 - k) * (1 - k),
  inQuad: (k: number) => k * k,
  outCubic: (k: number) => 1 - Math.pow(1 - k, 3),
  inCubic: (k: number) => k * k * k,
  inOutQuad: (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2),
});

/** One key of a track: reach `v` at `at` ms (from the track's start), eased over the segment. */
export interface TrackKey {
  at: number;
  v: number;
  ease: Ease;
}

/** A value moved through keys on a clock; read it rounded (whole pixels). */
export class Track {
  value: number;
  private from: number;
  private keys: TrackKey[] = [];
  private el = 0;

  constructor(v: number) {
    this.value = v;
    this.from = v;
  }

  /** Set at once (no motion). */
  jump(v: number): void {
    this.value = v;
    this.from = v;
    this.keys = [];
    this.el = 0;
  }

  /** Move from where it is now through `keys`. */
  play(keys: TrackKey[]): void {
    this.from = this.value;
    this.keys = keys.filter((k) => k.at > 0);
    this.el = 0;
    if (!this.keys.length && keys.length) this.jump(keys[keys.length - 1].v);
  }

  get moving(): boolean {
    return this.keys.length > 0;
  }

  /** Where it ends (its last key, or where it is). */
  get end(): number {
    return this.keys.length ? this.keys[this.keys.length - 1].v : this.value;
  }

  step(dt: number): void {
    if (!this.keys.length) return;
    this.el += dt;
    let t0 = 0;
    let v0 = this.from;
    for (const k of this.keys) {
      if (this.el < k.at) {
        const u = (this.el - t0) / (k.at - t0);
        this.value = v0 + (k.v - v0) * k.ease(Math.max(0, Math.min(1, u)));
        return;
      }
      t0 = k.at;
      v0 = k.v;
    }
    this.value = v0;
    this.keys = [];
    this.el = 0;
  }
}

/** The vertical keys of a lift change from `prev` to `next` (target y = base − lift(next)). */
export function liftKeys(prev: LiftState, next: LiftState, base: number, reduced: boolean = REDUCED_MOTION): TrackKey[] {
  const target = base - liftOf(next);
  if (reduced) return [{ at: next === 'rest' ? HAND3.leaveMs : HAND3.reducedLiftMs, v: target, ease: EASE.outQuad }];
  if (next === 'hover' && prev !== 'hover' && prev !== 'select')
    return [
      { at: HAND3.riseMs, v: base - HAND3.rise, ease: EASE.outCubic },
      { at: HAND3.riseMs + HAND3.settleMs, v: target, ease: EASE.outQuad },
    ];
  if (next === 'select' && prev !== 'select')
    return [
      { at: HAND3.pressMs, v: base - HAND3.press, ease: EASE.outQuad },
      { at: HAND3.pressMs + HAND3.popMs, v: base - HAND3.pop, ease: EASE.outQuad },
      { at: HAND3.pressMs + HAND3.popMs + HAND3.backMs, v: target, ease: EASE.inOutQuad },
    ];
  if (next === 'mark' && prev !== 'mark') return [{ at: HAND3.markMs, v: target, ease: EASE.outCubic }];
  if (next === 'rest' && prev !== 'rest') return [{ at: HAND3.leaveMs, v: target, ease: EASE.outQuad }];
  // same state, the fan moved (a card came / went): glide with the neighbours
  return [{ at: HAND3.spreadMs, v: target, ease: EASE.outCubic }];
}

// ================================================================ HandMotion

interface Cue {
  at: number;
  fn: () => void;
}

interface Motion {
  sprite: Phaser.GameObjects.Container;
  x: Track;
  y: Track;
  state: LiftState;
  /** The y this card's fan slot rests on (without lift / breath). */
  base: number;
  phase: number;
  /** Time into the reject shake (null: none). */
  shake: number | null;
  /** Time since the last state change, and what to do at given times (e.g. the settle flash). */
  el: number;
  cues: Cue[];
}

/**
 * Steps the hand's cards on whole pixels (see the header). One per HandView; the cards it holds are
 * moved by nothing else (a card in flight is released first and adopted again where it lands).
 */
export class HandMotion {
  private readonly scene: Phaser.Scene;
  private readonly map = new Map<Phaser.GameObjects.Container, Motion>();
  /** The hand's own clock (scaled ms; breathing reads it). */
  private clock = 0;
  private alive = true;
  private readonly onUpdate = (_t: number, dt: number) => this.tick(dt);

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    scene.events.on('update', this.onUpdate);
  }

  /** Is this card held (stepped) by the hand? */
  has(sprite: Phaser.GameObjects.Container): boolean {
    return this.map.has(sprite);
  }

  /** The lift state of a held card (null: not held). */
  stateOf(sprite: Phaser.GameObjects.Container): LiftState | null {
    return this.map.get(sprite)?.state ?? null;
  }

  /**
   * Hold a card in its fan slot: x / base y (unlifted), its lift state and breathing phase. A card
   * not held yet is adopted where it is (e.g. where its flight landed). `animate` false: at once.
   */
  place(sprite: Phaser.GameObjects.Container, x: number, base: number, state: LiftState, animate: boolean, phase: number): void {
    let m = this.map.get(sprite);
    if (!m) {
      const cx = Math.round(sprite.x);
      const cy = Math.round(sprite.y);
      // a card adopted mid-air keeps where it is; its "state" is whatever its height says
      m = { sprite, x: new Track(cx), y: new Track(cy), state: 'rest', base, phase, shake: null, el: 0, cues: [] };
      const up = base - cy;
      if (up >= HAND3.lift - 1) m.state = 'hover';
      else if (up >= HAND3.mark - 1) m.state = 'mark';
      this.map.set(sprite, m);
    }
    m.phase = phase;
    const target = base - liftOf(state);
    if (!animate) {
      m.x.jump(x);
      m.y.jump(target);
      m.base = base;
      if (m.state !== state) {
        m.state = state;
        m.el = 0;
        m.cues = [];
      }
      this.apply(m);
      return;
    }
    if (m.x.end !== x) m.x.play([{ at: HAND3.spreadMs, v: x, ease: EASE.outCubic }]);
    if (m.state !== state) {
      // a pressed card that stays under the pointer (e.g. a discard pick) finishes its press
      const keepPress = m.state === 'select' && state === 'hover' && m.y.end === target;
      if (!keepPress) m.y.play(liftKeys(m.state, state, base));
      m.state = state;
      m.el = 0;
      m.cues = [];
    } else if (m.y.end !== target) m.y.play(liftKeys(state, state, base));
    m.base = base;
  }

  /** Run `fn` `ms` into the card's current state (dropped when its state changes first). */
  cue(sprite: Phaser.GameObjects.Container, ms: number, fn: () => void): void {
    const m = this.map.get(sprite);
    if (!m) return;
    m.cues.push({ at: m.el + ms, fn });
  }

  /** Replay the select press on a held card (a second click on the selected card). */
  press(sprite: Phaser.GameObjects.Container): void {
    const m = this.map.get(sprite);
    if (!m || REDUCED_MOTION) return;
    m.y.play(liftKeys('hover', 'select', m.base));
    m.state = 'select';
    m.el = 0;
    m.cues = [];
  }

  /** The reject shake (x +2 −2 +1 −1 0, 30 ms steps). Reduced motion: none. */
  reject(sprite: Phaser.GameObjects.Container): void {
    const m = this.map.get(sprite);
    if (!m || REDUCED_MOTION) return;
    m.shake = 0;
  }

  /** Let go of a card (a cinematic takes it, it is destroyed, or it flies). */
  release(sprite: Phaser.GameObjects.Container): void {
    this.map.delete(sprite);
  }

  /** Let go of every card. */
  clear(): void {
    this.map.clear();
  }

  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    this.map.clear();
    this.scene?.events?.off('update', this.onUpdate);
  }

  private apply(m: Motion): void {
    const s = m.sprite;
    const dx = m.shake === null ? 0 : rejectOffset(m.shake);
    const breath = m.y.moving ? 0 : breathOf(this.clock, m.phase);
    s.setPosition(Math.round(m.x.value) + dx, Math.round(m.y.value) + breath);
  }

  private tick(rawDt: number): void {
    if (!this.alive) return;
    const scale = this.scene.tweens?.timeScale ?? 1;
    const dt = Math.min(50, rawDt) * scale;
    this.clock += dt;
    for (const [sprite, m] of this.map) {
      if (!sprite.active || !sprite.scene) {
        this.map.delete(sprite);
        continue;
      }
      m.x.step(dt);
      m.y.step(dt);
      if (m.shake !== null) {
        m.shake += dt;
        if (m.shake >= HAND3.rejectStepMs * HAND3.reject.length) m.shake = null;
      }
      m.el += dt;
      if (m.cues.length) {
        const due = m.cues.filter((c) => c.at <= m.el);
        if (due.length) {
          m.cues = m.cues.filter((c) => c.at > m.el);
          for (const c of due) c.fn();
        }
      }
      this.apply(m);
    }
  }
}

// ================================================================ whole-pixel moves (non-hand objects)

const moves = new WeakMap<object, Phaser.Tweens.Tween>();

/**
 * Move an object to (x, y) on whole pixels over `ms` scene ms (`ease` 0..1 → 0..1, may overshoot by
 * whole pixels), after `delay`. A newer move of the same object replaces the running one (its
 * promise resolves). For the mini-hands and the hot-seat swap.
 */
export function pxMove(
  scene: Phaser.Scene,
  obj: Phaser.GameObjects.Components.Transform & { active?: boolean },
  to: { x?: number; y?: number },
  ms: number,
  ease: Ease = EASE.outCubic,
  delay = 0,
): Promise<void> {
  return new Promise((resolve) => {
    moves.get(obj)?.stop();
    const x0 = obj.x;
    const y0 = obj.y;
    const x1 = to.x ?? x0;
    const y1 = to.y ?? y0;
    const set = (k: number) => {
      if (obj.active === false) return;
      const e = ease(k);
      obj.setPosition(Math.round(x0 + (x1 - x0) * e), Math.round(y0 + (y1 - y0) * e));
    };
    if (ms <= 0 && delay <= 0) {
      set(1);
      return resolve();
    }
    const t = scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: Math.max(1, ms),
      delay,
      onUpdate: (tw) => set(tw.getValue() ?? 0),
      onComplete: () => {
        set(1);
        moves.delete(obj);
        resolve();
      },
      onStop: () => {
        moves.delete(obj);
        resolve();
      },
    });
    moves.set(obj, t);
  });
}

/** An overshoot ease: past 1 by `over` (of the move) at 70 %, back on 1 at the end (pxMove rounds it). */
export function overshootEase(over: number): Ease {
  return (k: number) => {
    if (k >= 1) return 1;
    if (k < 0.7) {
      const u = k / 0.7;
      return (1 + over) * (1 - (1 - u) * (1 - u));
    }
    const u = (k - 0.7) / 0.3;
    return 1 + over * (1 - u * u * (3 - 2 * u));
  };
}
