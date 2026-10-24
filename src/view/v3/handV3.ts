// The v3 hand (K1) — lane A6-A, step A2 (docs/v3/A6_PLAN.md §3 K1, §4.4 KO-1 … KO-3, KO-9; S-9).
// HandView keeps its state and API; with lane A6-A on (V3_A6_A) its v3 branches use this module:
//   - the cards sit on v1's gentle arc (user decision, 24 Oct: "el yay şeklinde, kartlar hafif
//     dönük"): the outer cards dip up to 7 px and lean outwards a little (v1's angles, ≤ ~6°) — but
//     never rotated at runtime: each lean is BAKED in half-degree steps the pixel-art way
//     (RotSprite, src/art/rotsprite.ts, on the card + its rim ring), cached lazily and shown unrotated
//     on whole pixels (TiltView); a hovered / selected card turns upright through the steps (90 ms)
//     and is then the plain crisp CardV3; every card breathes 0 / −1 px (2400 ms, phase +300 ms/card)
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
// shake, no node travel; the lift is one 60 ms move, the lean changes in one step.
//
//   const motion = new HandMotion(scene, { px1: TEX.px1 });
//   motion.place(sprite, x, y, 'hover', true, i * HAND3.breathStep, deg);   // every layout
//   motion.reject(sprite);                                                   // the shake
//   motion.release(sprite);                                                  // a cinematic takes the card
//
// A leaning card is drawn by its TiltView: one small live canvas per card holding the baked turn of
// what the CardV3 would show upright — its side (face / back, or a flip's turn frame), its rim ring
// with the flash tones and the running light node, the ace foil sweep — while the CardV3's own
// layers are hidden. Upright (0°) the CardV3 draws itself, as before.
// No runtime Phaser import (the scene is given), so the pure parts are unit-tested in node.

import type Phaser from 'phaser';
import { frameRGBA, type FrameLike } from '../../art/atlas';
import { PAL, PLAYER_RAMP, RAMPS, type Ramp } from '../../art/palette';
import { PixelCanvas, mix } from '../../art/pixel';
import { colorsOf, edgeDecisions, nearest8, quantizeDeg, rotMap, upscale8, type RotMap, type UpScaled } from '../../art/rotsprite';
import { cardDef, isMonster, type CardId } from '../../data/cards';
import type { PlayerId } from '../../engine/types';
import type { RimStyle } from './CardV3';
import { rimPath } from './ui-kit';
import { REDUCED_MOTION } from './motion';

/** The v3 hand's numbers (K1; v1 geometry: the hand band of layout.ts UI_V1). */
export const HAND3 = Object.freeze({
  /** Card centre y at rest: the bottom edge on the screen edge (as v1). */
  baseY: 326,
  /**
   * The fan's arc — v1's (src/view/HandView.ts pose(), user decision 24 Oct): card i sits
   * off² · min(dipK, maxDip / half²) px lower (off = i − (n − 1) / 2, half = max(1, (n − 1) / 2)) …
   */
  maxDip: 7,
  dipK: 1.4,
  /**
   * … and leans off · min(rotStep, rotSpan / (n − 1)) rad outwards, baked in `degStep` steps (half
   * degrees: every lean within 0.25° of v1's — the four-card hand's ±1.43° / ±4.30° are ±1.5° / ±4.5°).
   */
  rotStep: 0.05,
  rotSpan: 0.22,
  degStep: 0.5,
  /** A raised card turns upright through the baked steps (and back when it sinks), in this time. */
  tiltMs: 90,
  /** RotSprite smooths only the card's outer band of this many px (edgeDecisions): digits stay whole. */
  tiltBand: 2,
  /**
   * The card row a lean's sampling phase keeps whole: the middle of the v3 face's ATK / DEF digits
   * (src/art/cardface-v3/frame.ts: text box y 52, digits y 59..63) — a small turn's row step then
   * falls above or below them, never through them.
   */
  keepRow: 61,
  /**
   * What a lean's 1-px step costs where it jogs a face's edges (tiltPhase), per region (face pixels
   * x0, y0, x1, y1, later ones over earlier ones; src/art/cardface-v3/frame.ts): a kink reads least in
   * the painting (art x 3..44, y 18..49) and the greeked name / rules text, most in a small symbol — the
   * attribute / kind orb, the star / type icon row, a spell's or trap's kind emblem. Elsewhere 1.
   */
  jogWeights: Object.freeze([
    Object.freeze({ box: Object.freeze([3, 18, 44, 49] as const), w: 0.25 }),
    Object.freeze({ box: Object.freeze([3, 52, 44, 65] as const), w: 0.25 }),
    Object.freeze({ box: Object.freeze([2, 2, 35, 9] as const), w: 0.5 }),
    Object.freeze({ box: Object.freeze([36, 2, 45, 10] as const), w: 4 }),
    Object.freeze({ box: Object.freeze([3, 11, 44, 15] as const), w: 4 }),
    Object.freeze({ box: Object.freeze([36, 56, 44, 64] as const), w: 4 }),
  ]),
  /**
   * Where a side's small symbols are found (face / back pixels x0, y0, x1, y1): each piece there off
   * the box's ground, at most symbolMax px across, is kept whole by a lean when its phase allows
   * (tiltPhase) — the face's orb, star / icon row and (not on a lettered face: its DEF digits) kind
   * emblem; the back's pins and corner marks (its upper and lower field) and the N on its emblem.
   */
  symbolBoxes: Object.freeze([Object.freeze([36, 2, 45, 10] as const), Object.freeze([3, 11, 44, 15] as const), Object.freeze([36, 56, 44, 64] as const)]),
  backSymbolBoxes: Object.freeze([Object.freeze([4, 4, 43, 33] as const), Object.freeze([4, 34, 43, 63] as const), Object.freeze([19, 29, 29, 39] as const)]),
  symbolMax: 11,
  /** Hot-seat swap (v1's): a falling card leans this much further out (0.25 rad), a rising one closes from 3× its lean (≤ 20°). */
  swapLean: 14,
  swapFan: 3,
  swapFanMax: 20,
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

/** The fan's y dip (px down) of card i of n: v1's arc — 0 in the middle, up to 7 px for the outer cards. */
export function fanDip(i: number, n: number): number {
  if (n <= 1) return 0;
  const off = i - (n - 1) / 2;
  const half = Math.max(1, (n - 1) / 2);
  return Math.round(off * off * Math.min(HAND3.dipK, HAND3.maxDip / (half * half)));
}

/**
 * The lean of card i of n (degrees, clockwise; `degStep` steps): v1's turn off · dRot, the
 * left cards leaning left, the right ones right — at most ~6° for the outermost of a full hand.
 */
export function fanDeg(i: number, n: number): number {
  if (n <= 1) return 0;
  const off = i - (n - 1) / 2;
  const dRot = Math.min(HAND3.rotStep, HAND3.rotSpan / Math.max(1, n - 1));
  return leanStep((off * dRot * 180) / Math.PI);
}

/** A lean snapped to the baked steps, mirror-symmetric (±1.5 → ±2: the fan's two sides match). */
function leanStep(deg: number): number {
  const q = quantizeDeg(Math.abs(deg), HAND3.degStep);
  return q === 0 ? 0 : Math.sign(deg) * q;
}

/** The lean a card shows in a lift state: upright when raised (hover / select), half when marked (as v1). */
export function tiltOf(state: LiftState, rest: number): number {
  if (state === 'hover' || state === 'select') return 0;
  return state === 'mark' ? leanStep(rest / 2) : rest;
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
 * neighbours opened (fanXs), y on the fan's arc, and the card's resting lean (deg; the lift state
 * decides what is shown — tiltOf). Never rotated at runtime: the lean is a baked texture (TiltView).
 */
export function fanPose(i: number, n: number, h: number, band: { x: number; w: number }, cardW: number): { x: number; y: number; deg: number } {
  return { x: fanXs(n, h, band, cardW)[i], y: HAND3.baseY + fanDip(i, n), deg: fanDeg(i, n) };
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

// ================================================================ the baked lean (RotSprite, pure)
//
// A leaning card is the CardV3's own pixels turned the pixel-art way: its side (48 × 68) and its rim
// ring (1 px outside the card, corners cut, as CardV3's paintRing) are laid out in one composite — an
// empty pixel, the ring, the card — and turned by RotSprite (src/art/rotsprite.ts) deciding on the
// card's outer band only (edgeDecisions: outline and trim smooth as lines, the art inside sampled
// plain); a monster's ATK / DEF line is then re-lettered glyph by glyph, each digit / icon set down
// whole on the slope (glyphsOf / holdGlyphs). The bake is an INDEX map: the ring is coloured per frame
// (playable / hover / locked / a flash), an overlay frame (the ace foil sweep) maps through it at the
// cost of a lookup, and the ring's turned pixels in walking order carry the running light node.

/** Where the card sits in its composite: one empty pixel, then the 1-px rim ring. */
export const TILT_IN = 2;
/** The ring's stand-in decision colour (not an RGB value: whatever tone the rim takes, it turns the same). */
const RING_MARK = 0x1000001;
/**
 * Up-scales kept (≈ 140 KB each, ≈ 0.3 ms to make: every side a hot-seat swap, a wave or a fresh hand
 * turns at once fits — the old hand's faces, the new hand's sides, a wave's turn frames — so none is
 * made twice in one move) and baked leans kept (≈ 25 KB each).
 */
const UP_CAP = 16;
const BAKE_CAP = 160;

/** A card size's composite: per pixel its rim edge (0 none, 1 top / left = tl, 2 bottom / right = br) and walking position. */
interface RingGeo {
  readonly W: number;
  readonly H: number;
  readonly edge: Uint8Array;
  readonly pos: Int32Array;
  readonly len: number;
}

const ringGeos = new Map<string, RingGeo>();

function ringGeo(w: number, h: number): RingGeo {
  const key = `${w}x${h}`;
  let g = ringGeos.get(key);
  if (g) return g;
  const W = w + 2 * TILT_IN;
  const H = h + 2 * TILT_IN;
  const edge = new Uint8Array(W * H);
  const pos = new Int32Array(W * H).fill(-1);
  // CardV3's ring: rimPath(0, 0, w + 2, h + 2, 1); its top + left edges take tl, the rest br
  const path = rimPath(0, 0, w + 2, h + 2, 1);
  path.forEach(([x, y], k) => {
    const i = (y + TILT_IN - 1) * W + (x + TILT_IN - 1);
    edge[i] = y === 0 || x === 0 ? 1 : 2;
    pos[i] = k;
  });
  g = { W, H, edge, pos, len: path.length };
  ringGeos.set(key, g);
  return g;
}

/** A card side's lean, baked. */
export interface TiltBake {
  readonly deg: number;
  /** The turned composite (index = y · W + x of the composite; the pivot — the card's centre — lands on map.px / py). */
  readonly map: RotMap;
  /** The output pixels (k = y · map.w + x) of the rim ring in walking order, clockwise from the top-left (as rimPath). */
  readonly ring: Int32Array;
  readonly geo: RingGeo;
  /** The side's size. */
  readonly w: number;
  readonly h: number;
}

let sideSeq = 0;
const sideIds = new WeakMap<PixelCanvas, number>();
/** Full-width sides by content (size + hash → the first one's pixels and id); ≈ 13 KB each. */
const contentIds = new Map<string, { data: Uint8ClampedArray; id: number }>();
const CONTENT_CAP = 128;

/** FNV-1a over a canvas's pixels (32-bit words). */
function hashOf(d: Uint8ClampedArray): number {
  let hsh = 0x811c9dc5;
  const n = d.length >> 2;
  const words = d.byteOffset % 4 === 0 ? new Uint32Array(d.buffer, d.byteOffset, n) : null;
  for (let i = 0; i < n; i++) {
    hsh ^= words ? words[i] : d[i * 4] | (d[i * 4 + 1] << 8) | (d[i * 4 + 2] << 16) | (d[i * 4 + 3] << 24);
    hsh = Math.imul(hsh, 0x01000193);
  }
  return hsh >>> 0;
}

function samePixels(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * A stable id per side (the caches and the TiltView's change check). A full-width side is known by
 * its pixels: a flip's last frame (a clone of the side it turns to) and that side itself, or one
 * card's back and the next card's, share one id — one up-scale, one lettering, the same bakes, and
 * no repaint when the flip hands over to the side. A flip's narrow turn frames: one id each.
 */
function sideId(p: PixelCanvas): number {
  let id = sideIds.get(p);
  if (id !== undefined) return id;
  if (!isTurnFrame(p)) {
    const key = `${p.w}x${p.h}:${hashOf(p.data)}`;
    const hit = contentIds.get(key);
    if (hit && samePixels(hit.data, p.data)) id = hit.id;
    else if (!hit) {
      contentIds.set(key, { data: p.data, id: (id = ++sideSeq) });
      if (contentIds.size > CONTENT_CAP) contentIds.delete(contentIds.keys().next().value!);
    }
  }
  if (id === undefined) id = ++sideSeq;
  sideIds.set(p, id);
  return id;
}

const ups = new Map<number, UpScaled>();
const bakes = new Map<string, TiltBake>();

/** A side's composite decision colours (the ring as RING_MARK); `band`: RotSprite's edge-band decisions. */
function compositeOf(side: PixelCanvas, band: boolean): Int32Array {
  const g = ringGeo(side.w, side.h);
  const col = new Int32Array(g.W * g.H).fill(-1);
  const src = colorsOf(side);
  const dec = band ? edgeDecisions(src, side.w, side.h, HAND3.tiltBand) : src;
  for (let y = 0; y < side.h; y++) col.set(dec.subarray(y * side.w, (y + 1) * side.w), (y + TILT_IN) * g.W + TILT_IN);
  for (let i = 0; i < col.length; i++) if (g.edge[i]) col[i] = RING_MARK;
  return col;
}

function upOf(side: PixelCanvas): UpScaled {
  const id = sideId(side);
  let u = ups.get(id);
  if (u) {
    ups.delete(id);
    ups.set(id, u);
    return u;
  }
  const g = ringGeo(side.w, side.h);
  u = upscale8(compositeOf(side, true), g.W, g.H);
  ups.set(id, u);
  if (ups.size > UP_CAP) ups.delete(ups.keys().next().value!);
  return u;
}

const nears = new WeakMap<PixelCanvas, UpScaled>();

/** A flip's narrow turn frame on the 8× grid without Scale2x (nearest8: no up-scale to make). */
function nearOf(side: PixelCanvas): UpScaled {
  let u = nears.get(side);
  if (!u) {
    const g = ringGeo(side.w, side.h);
    nears.set(side, (u = nearest8(compositeOf(side, false), g.W, g.H)));
  }
  return u;
}

const squeezes = new WeakMap<PixelCanvas, boolean>();

/**
 * Is `side` a flip's narrow turn frame — a card squeezed narrower than its canvas (the first or the
 * last column empty)? Shown ≈ 35 ms each, they turn plain nearest (nearest8): a card's long straight
 * edges step alike either way, RotSprite's Scale2x only shapes the cut corners, and a wave turns
 * five such frames per card. Every full-width side (a face, a back, a flip's last frame) is RotSprite.
 */
export function isTurnFrame(side: PixelCanvas): boolean {
  let s = squeezes.get(side);
  if (s === undefined) {
    let left = false;
    let right = false;
    const d = side.data;
    for (let y = 0; y < side.h && !(left && right); y++) {
      if (d[y * side.w * 4 + 3]) left = true;
      if (d[(y * side.w + side.w - 1) * 4 + 3]) right = true;
    }
    squeezes.set(side, (s = !(left && right)));
  }
  return s;
}

/**
 * `side` (a card side, or a flip's turn frame) leaning `deg` (degrees on the `degStep` grid, clockwise) with its rim
 * ring, baked RotSprite style about the card's centre (CardV3's origin: the pixel floor(w / 2),
 * floor(h / 2)), its 1-px steps slid off its symbols (tiltPhase; `search` false: a lean shown in
 * passing keeps the preferred phase). `glyphs` (a monster's face): its ATK / DEF line moves glyph by
 * glyph, each whole (glyphsOf); `face` (a face up, not a back): its layout's regions weigh the steps
 * (HAND3.jogWeights, symbolBoxes). Cached (LRU); at 0° it is the composite pixel for pixel.
 */
export function tiltBake(side: PixelCanvas, deg: number, glyphs = false, face = glyphs, search = true): TiltBake {
  const key = bakeKey(side, deg, glyphs, face, search);
  let b = bakes.get(key);
  if (b) {
    bakes.delete(key);
    bakes.set(key, b);
    return b;
  }
  const g = ringGeo(side.w, side.h);
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  // a flip's narrow turn frame: plain nearest, no lettering (its digits are squeezed anyway)
  const turn = isTurnFrame(side);
  const line = glyphs && !turn ? glyphsOf(side) : null;
  // the sampling phase: where the turn's 1-px steps fall (tiltPhase: where they jog the fewest edges)
  const pivot = [TILT_IN + Math.floor(side.w / 2), TILT_IN + Math.floor(side.h / 2)] as const;
  const shift = turn ? ([0, 0] as const) : tiltPhase(side, deg, line, face, search);
  const map = rotMap(turn ? nearOf(side) : upOf(side), deg, pivot, shift);
  if (line) holdGlyphs(map, line, g.W);
  b = { deg, map, ring: ringWalk(map, g, side.w, side.h, cos, sin), geo: g, w: side.w, h: side.h };
  bakes.set(key, b);
  if (bakes.size > BAKE_CAP) bakes.delete(bakes.keys().next().value!);
  return b;
}

/** A bake's cache key (a lean steeper than PHASE_MAX_DEG is never searched: one entry either way). */
function bakeKey(side: PixelCanvas, deg: number, glyphs: boolean, face: boolean, search: boolean): string {
  const q = !search || Math.abs(deg) > PHASE_MAX_DEG;
  return `${sideId(side)}:${deg}${glyphs ? ':g' : ''}${face ? ':f' : ''}${q ? ':q' : ''}`;
}

/** Is this lean of `side` baked (tiltBake's cache, same flags)? */
export function hasTiltBake(side: PixelCanvas, deg: number, glyphs = false, face = glyphs, search = true): boolean {
  return bakes.has(bakeKey(side, deg, glyphs, face, search));
}

/**
 * The output pixels of a turned map that show a ring pixel, in walking order: by that ring pixel's
 * place on the walk (a bucket per place, filled in output order), two showing the same ring pixel
 * by their place along the walking direction turned with the card (w × h: the side's size).
 */
function ringWalk(map: RotMap, g: RingGeo, w: number, h: number, cos: number, sin: number): Int32Array {
  const L = g.len;
  const idx = map.idx;
  const start = new Int32Array(L + 1);
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k];
    if (i >= 0 && g.pos[i] >= 0) start[g.pos[i] + 1]++;
  }
  for (let p = 0; p < L; p++) start[p + 1] += start[p];
  const ring = new Int32Array(start[L]);
  const at = start.slice(0, L);
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k];
    if (i >= 0 && g.pos[i] >= 0) ring[at[g.pos[i]]++] = k;
  }
  const along = (k: number): number => {
    const p = g.pos[idx[k]];
    const [dx, dy] = p < w ? [1, 0] : p < w + h ? [0, 1] : p < 2 * w + h ? [-1, 0] : [0, -1];
    return (k % map.w) * (dx * cos - dy * sin) + Math.floor(k / map.w) * (dx * sin + dy * cos);
  };
  // a ring pixel shown twice (a turn's step): the two in the walking direction (insertion: stable)
  for (let p = 0; p < L; p++)
    for (let a = start[p] + 1; a < start[p + 1]; a++) {
      const k = ring[a];
      const v = along(k);
      let j = a - 1;
      while (j >= start[p] && along(ring[j]) > v) {
        ring[j + 1] = ring[j];
        j--;
      }
      ring[j + 1] = k;
    }
  return ring;
}

/** An overlay frame mapped through a lean (the foil / sheen sweep): RGBA w × h, blended NORMAL or ADD. */
export interface TiltOverlay {
  readonly rgba: Uint8ClampedArray;
  readonly alpha: number;
  readonly add: boolean;
}

/**
 * Paint a baked lean: the side's pixels (the overlay blended over them as the upright card shows it),
 * the rim ring's top / left edges in `tl` and the rest in `br` (null: not drawn).
 */
export function paintTilt(b: TiltBake, side: PixelCanvas, tl: number | null, br: number | null, over: TiltOverlay | null = null, into?: PixelCanvas): PixelCanvas {
  const { W, edge } = b.geo;
  const { w, h } = b;
  const sd = side.data;
  const m = b.map;
  const out = into && into.w === m.w && into.h === m.h ? into.clear() : new PixelCanvas(m.w, m.h);
  const d = out.data;
  for (let k = 0; k < m.idx.length; k++) {
    const i = m.idx[k];
    if (i < 0) continue;
    const x = (i % W) - TILT_IN;
    const y = Math.floor(i / W) - TILT_IN;
    let c: number | null = null;
    if (x >= 0 && y >= 0 && x < w && y < h) {
      const s = (y * w + x) * 4;
      if (sd[s + 3] === 0) continue;
      c = (sd[s] << 16) | (sd[s + 1] << 8) | sd[s + 2];
      const oa = over ? over.rgba[s + 3] : 0;
      if (over && oa > 0) {
        const o = (over.rgba[s] << 16) | (over.rgba[s + 1] << 8) | over.rgba[s + 2];
        const a = over.alpha * (oa / 255);
        if (!over.add) c = mix(c, o, a);
        else {
          const ch = (sh: number) => Math.min(255, ((c! >> sh) & 255) + Math.round(((o >> sh) & 255) * a));
          c = (ch(16) << 16) | (ch(8) << 8) | ch(0);
        }
      }
    } else if (edge[i] === 1) c = tl;
    else if (edge[i] === 2) c = br;
    if (c === null) continue;
    const o = k * 4;
    d[o] = (c >> 16) & 255;
    d[o + 1] = (c >> 8) & 255;
    d[o + 2] = c & 255;
    d[o + 3] = 255;
  }
  return out;
}

/** A side's step costs: what a lean's 1-px shear step jogs where it falls (stepCostOf). */
export interface StepCost {
  /** A row step between composite rows y − 1 | y, where it meets the column boundary x − 1 | x (index y · W + x). */
  readonly row: Float32Array;
  /** A column step between composite columns x − 1 | x, where it meets the row boundary y − 1 | y. */
  readonly col: Float32Array;
  /** A lettered face: the column steps inside its ATK (2) or DEF (1) number, on the line's rows; else null. */
  readonly inNumber: Uint8Array | null;
  /** The side's small symbols (symbolsOf). */
  readonly symbols: readonly SmallSymbol[];
}

/** A small symbol: its composite box (x0, y0 … x1, y1) and which of the box's pixels are the symbol's. */
export interface SmallSymbol {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly member: Uint8Array;
  readonly count: number;
  /** What breaking it costs, in SYMBOL_BREAKs: its size (a back's N before a corner mark). */
  readonly weight: number;
}

const stepCosts = new Map<string, StepCost>();
/** Step costs kept (≈ 30 KB each). */
const STEP_CAP = 32;
/** Phases tried per axis: PHASE_DENSITY / sin(deg) — about one per place a step can fall — at most PHASES. */
const PHASES = 32;
const PHASE_DENSITY = 1;
/** A phase's pull to the preferred one (jogged edges per px of phase): a lean moves its steps only for a real gain. */
const PHASE_PULL = 1;
/** A row step through the ATK / DEF line, or a column step inside its ATK number (up to FLAT_DEG; half that in DEF): per jog. */
const LETTER_JOG = 100;
/**
 * Up to this lean each number of the ATK / DEF line keeps one row — its column steps fall between the
 * numbers; where the slope leaves no room for both (3°), the DEF number takes the drop, not the ATK.
 */
const FLAT_DEG = 3;
/** A symbol a lean breaks (brokenSymbols): as many jogged edges, times its weight (25 px: 1). */
const SYMBOL_BREAK = 20;
/**
 * Leans steeper than this (a hot-seat swap's fall and rise: a frame or two each, in motion) keep the
 * preferred phase — no search (the hand's own leans, rest and hover, stay within ±6.5°).
 */
const PHASE_MAX_DEG = 7;

/**
 * Where a step of the turn costs, on a side's own pixels: a row step shears two rows apart, so every
 * vertical edge running through both jogs a pixel; a column step does the same to horizontal edges
 * (the ring's and frame's long lines cost alike wherever a step falls). A face weighs its regions
 * (HAND3.jogWeights); a lettered face's ATK / DEF line takes no row step and, up to FLAT_DEG, no
 * column step inside a number (LETTER_JOG). Cached per side (and flags).
 */
export function stepCostOf(side: PixelCanvas, line: Glyphs | null, face: boolean): StepCost {
  const key = stepKey(side, line, face);
  let sc = stepCosts.get(key);
  if (sc) return sc;
  const { W, H } = ringGeo(side.w, side.h);
  const P = compositeOf(side, false);
  const row = new Float32Array(W * H);
  const col = new Float32Array(W * H);
  // per composite pixel boundary (the 2 × 2 block ending at x, y): the weight of a jog there
  const wt = new Float32Array(W * H).fill(1);
  const mark = (box: readonly number[], v: number): void => {
    const [x0, y0, x1, y1] = box.map((q) => q + TILT_IN);
    for (let y = y0 + 1; y <= y1; y++) for (let x = x0 + 1; x <= x1; x++) wt[y * W + x] = v;
  };
  if (face) for (const { box, w } of HAND3.jogWeights) mark(box, w);
  for (let y = 1; y < H; y++)
    for (let x = 1; x < W; x++) {
      const a = P[(y - 1) * W + x - 1];
      const b = P[(y - 1) * W + x];
      const c = P[y * W + x - 1];
      const d = P[y * W + x];
      const w = wt[y * W + x];
      // a b   a row step: the edge between a | b running on into c | d jogs
      // c d   a column step: the edge between a / c running on into b / d jogs
      if (a !== b && c !== d && (a === c || b === d)) row[y * W + x] = w;
      if (a !== c && b !== d && (a === b || c === d)) col[y * W + x] = w;
    }
  let inNumber: Uint8Array | null = null;
  if (line) {
    for (let y = line.y0 + 1; y <= line.y1; y++) for (let x = line.x0; x <= line.x1 + 1; x++) row[y * W + x] += LETTER_JOG;
    inNumber = new Uint8Array(W * H);
    numberSpans(line, W).forEach(([lo, hi], n) => {
      for (let y = line.y0; y <= line.y1 + 1; y++) for (let x = lo + 1; x <= hi; x++) inNumber![y * W + x] = n === 0 ? 2 : 1;
    });
  }
  sc = { row, col, inNumber, symbols: symbolsOf(side, face, line !== null) };
  stepCosts.set(key, sc);
  if (stepCosts.size > STEP_CAP) stepCosts.delete(stepCosts.keys().next().value!);
  return sc;
}

function stepKey(side: PixelCanvas, line: Glyphs | null, face: boolean): string {
  return `${sideId(side)}${line ? ':g' : ''}${face ? ':f' : ''}`;
}

/**
 * Make the next missing part of a lean's bake (tiltBake, searched): the ATK / DEF lettering, the
 * step costs, each pass of the phase search, the up-scale, then the turn itself — each a fraction
 * of the whole, so a bake made ahead spreads over frames (HandMotion.bakeAhead). False: it is
 * baked (nothing done).
 */
export function tiltBakeStep(side: PixelCanvas, deg: number, glyphs = false, face = glyphs): boolean {
  if (hasTiltBake(side, deg, glyphs, face)) return false;
  if (!isTurnFrame(side)) {
    if (glyphs && !glyphLines.has(sideId(side))) return glyphsOf(side), true;
    const line = glyphs ? glyphsOf(side) : null;
    if (searchable(deg)) {
      if (!stepCosts.has(stepKey(side, line, face))) return stepCostOf(side, line, face), true;
      if (tiltPhaseStep(side, deg, line, face)) return true;
    }
    if (!ups.has(sideId(side))) return upOf(side), true;
  }
  tiltBake(side, deg, glyphs, face);
  return true;
}

/**
 * A side's small symbols: in each of its symbol boxes, every 4-connected piece neither the box's
 * ground (its commonest tone) nor its ink (the darkest tone off the ground) — a star's gold, the
 * sigil's green, the orb's fire — with the ink round it (a contour two stars share belongs to both);
 * 3+ px, at most symbolMax across.
 */
function symbolsOf(side: PixelCanvas, face: boolean, lettered: boolean): SmallSymbol[] {
  const out: SmallSymbol[] = [];
  const boxes = face ? HAND3.symbolBoxes.slice(0, lettered ? 2 : 3) : HAND3.backSymbolBoxes;
  const lim = HAND3.symbolMax;
  const col = colorsOf(side);
  for (const [bx0, by0, bx1, by1] of boxes) {
    const x0 = Math.max(0, bx0);
    const y0 = Math.max(0, by0);
    const x1 = Math.min(side.w - 1, bx1);
    const y1 = Math.min(side.h - 1, by1);
    if (x1 < x0 || y1 < y0) continue;
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    const N = bw * bh;
    // the box's tones (−1: empty), its ground (the commonest, the first counted on a tie) and ink
    const at = new Int32Array(N);
    for (let y = 0; y < bh; y++) at.set(col.subarray((y + y0) * side.w + x0, (y + y0) * side.w + x1 + 1), y * bw);
    const tally = new Map<number, number>();
    for (let k = 0; k < N; k++) if (at[k] >= 0) tally.set(at[k], (tally.get(at[k]) ?? 0) + 1);
    let ground = -1;
    let most = 0;
    for (const [c, n] of tally) if (n > most) [ground, most] = [c, n];
    let ink = -1;
    for (const c of tally.keys()) if (c !== ground && lum(c) < lum(ground) && (ink < 0 || lum(c) < lum(ink))) ink = c;
    const core = (k: number): boolean => at[k] >= 0 && at[k] !== ground && at[k] !== ink;
    const seen = new Uint8Array(N);
    // (box indices: a piece's pixels, then its ink; the ink each piece took, by the piece's serial)
    const px = new Int32Array(2 * N);
    const stack = new Int32Array(N);
    const inkOf = new Int32Array(N);
    let serial = 0;
    for (let k0 = 0; k0 < N; k0++) {
      if (seen[k0] || !core(k0)) continue;
      // the piece (4-connected)
      let n = 0;
      let sp = 0;
      stack[sp++] = k0;
      seen[k0] = 1;
      let sx0 = bw;
      let sy0 = bh;
      let sx1 = -1;
      let sy1 = -1;
      while (sp) {
        const k = stack[--sp];
        px[n++] = k;
        const x = k % bw;
        const y = (k - x) / bw;
        if (x < sx0) sx0 = x;
        if (x > sx1) sx1 = x;
        if (y < sy0) sy0 = y;
        if (y > sy1) sy1 = y;
        if (x > 0 && !seen[k - 1] && core(k - 1)) (seen[k - 1] = 1), (stack[sp++] = k - 1);
        if (x < bw - 1 && !seen[k + 1] && core(k + 1)) (seen[k + 1] = 1), (stack[sp++] = k + 1);
        if (y > 0 && !seen[k - bw] && core(k - bw)) (seen[k - bw] = 1), (stack[sp++] = k - bw);
        if (y < bh - 1 && !seen[k + bw] && core(k + bw)) (seen[k + bw] = 1), (stack[sp++] = k + bw);
      }
      // too big already: no symbol (its ink would only widen it)
      if (sx1 - sx0 + 1 > lim || sy1 - sy0 + 1 > lim) continue;
      // the ink touching it (a contour two stars share belongs to both)
      serial++;
      let m = n;
      if (ink >= 0)
        for (let j = 0; j < n; j++) {
          const k = px[j];
          const x = k % bw;
          const y = (k - x) / bw;
          for (let v = Math.max(0, y - 1); v <= Math.min(bh - 1, y + 1); v++)
            for (let u = Math.max(0, x - 1); u <= Math.min(bw - 1, x + 1); u++) {
              const q = v * bw + u;
              if (at[q] !== ink || inkOf[q] === serial) continue;
              inkOf[q] = serial;
              px[m++] = q;
              if (u < sx0) sx0 = u;
              if (u > sx1) sx1 = u;
              if (v < sy0) sy0 = v;
              if (v > sy1) sy1 = v;
            }
        }
      if (m < 3 || sx1 - sx0 + 1 > lim || sy1 - sy0 + 1 > lim) continue;
      const mw = sx1 - sx0 + 1;
      const member = new Uint8Array(mw * (sy1 - sy0 + 1));
      for (let j = 0; j < m; j++) {
        const x = px[j] % bw;
        member[((px[j] - x) / bw - sy0) * mw + x - sx0] = 1;
      }
      out.push({ x0: x0 + sx0 + TILT_IN, y0: y0 + sy0 + TILT_IN, x1: x0 + sx1 + TILT_IN, y1: y0 + sy1 + TILT_IN, member, count: m, weight: Math.max(0.5, Math.min(3, m / 25)) });
    }
  }
  return out;
}

const symbolHits = new Int32Array(HAND3.symbolMax * HAND3.symbolMax);

/**
 * How much of a side's symbols (by weight) a lean at phase (fx, fy) breaks — rotMap's sampling round each: a
 * symbol is whole when every pixel of it shows exactly once, all moved alike (no step, and no step
 * crossing where a pixel doubles or drops, falls in it).
 */
function brokenSymbols(syms: readonly SmallSymbol[], cx: number, cy: number, s: number, c: number, fx: number, fy: number, upTo = Infinity): number {
  let broken = 0;
  for (const sym of syms) {
    if (broken > upTo) break;
    const mw = sym.x1 - sym.x0 + 1;
    const hits = symbolHits;
    hits.fill(0, 0, sym.member.length);
    // where the symbol's middle turns to (output, from the pivot), and a margin round it
    const dX = (sym.x0 + sym.x1 + 1) / 2 - cx - fx;
    const dY = (sym.y0 + sym.y1 + 1) / 2 - cy - fy;
    const uc = dX * c - dY * s;
    const vc = dX * s + dY * c;
    const mh = sym.y1 - sym.y0 + 1;
    const ru = (mw * Math.abs(c) + mh * Math.abs(s)) / 2 + 1;
    const rv = (mw * Math.abs(s) + mh * Math.abs(c)) / 2 + 1;
    let ox = NaN;
    let oy = NaN;
    let whole = true;
    let n = 0;
    for (let iv = Math.floor(vc - rv); iv <= Math.ceil(vc + rv) && whole; iv++)
      for (let iu = Math.floor(uc - ru); iu <= Math.ceil(uc + ru); iu++) {
        const u = iu + 0.5;
        const v = iv + 0.5;
        const x = Math.floor(cx + fx + u * c + v * s);
        const y = Math.floor(cy + fy - u * s + v * c);
        if (x < sym.x0 || x > sym.x1 || y < sym.y0 || y > sym.y1) continue;
        const k = (y - sym.y0) * mw + x - sym.x0;
        if (!sym.member[k]) continue;
        if (hits[k]++ || (n++ && (iu - x !== ox || iv - y !== oy))) {
          whole = false;
          break;
        }
        ox = iu - x;
        oy = iv - y;
      }
    if (!whole || n !== sym.count) broken += sym.weight;
  }
  return broken;
}

/** The ATK and the DEF number's ink columns (composite x, first and last): the line's glyphs either side of its widest gap. */
function numberSpans(line: Glyphs, W: number): [number, number][] {
  const spans: [number, number][] = [];
  for (const left of [true, false]) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const px of line.blocks)
      for (const i of px) {
        const x = i % W;
        if (line.shade[i] || x < line.gapX !== left) continue;
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
      }
    if (lo < hi) spans.push([lo, hi]);
  }
  return spans;
}

/**
 * The edges a lean's row steps (`rows`) or column steps jog, for each phase in `phases` of that axis
 * (the other axis's phase: `other`) — rotMap's sampling: the output pixel (u, v) from the pivot shows
 * the source pixel at (cx + fx + u·c + v·s, cy + fy − u·s + v·c). Walks only the steps: along each
 * output column the source column moves on (a row step), along each output row the source row does (a
 * column step); a step's boundary looks its cost up. `letter`: a column step inside a number costs
 * LETTER_JOG more.
 */
export function phaseCosts(sc: StepCost, W: number, H: number, cx: number, cy: number, deg: number, other: number, rows: boolean, letter: boolean, phases: ArrayLike<number>): Float64Array {
  const out = new Float64Array(phases.length);
  const r = (deg * Math.PI) / 180;
  const s = Math.sin(r);
  const c = Math.cos(r);
  if (s === 0) return out;
  const tbl = rows ? sc.row : sc.col;
  const extra = !rows && letter ? sc.inNumber : null;
  const ext = rows ? W : H; // the moving coordinate's extent
  const lim = rows ? H : W; // the cross coordinate's
  const m0 = rows ? cx : cy;
  const n0 = rows ? cy + other : cx + other;
  const dm = rows ? s : -s;
  const dn = rows ? -s : s;
  // the lines whose moving coordinate comes near the composite (for any phase), and per line the
  // pixels i whose cross coordinate lies in it — with that cross coordinate's row / column (q) and
  // whether it moves on between i − 1 and i (a step there shows: else it repeats a pixel)
  const reach = Math.abs(s) * lim + 3;
  const k0 = Math.floor((-reach - m0) / c - 0.5);
  const k1 = Math.ceil((ext + reach - m0) / c - 0.5);
  // per line (an output column for rows, an output row for columns): its moving coordinate at phase 0,
  // its pixel range, and per pixel the cross row / column a step there lands on (−1: none, the pixel
  // repeats its neighbour's or lies outside)
  const nl = Math.max(0, k1 - k0 + 1);
  const span = Math.ceil(lim / c) + 3;
  const LM = new Float64Array(nl);
  const LLo = new Int32Array(nl);
  const LHi = new Int32Array(nl);
  const Q = new Int32Array(nl * span).fill(-1);
  let m = 0;
  for (let k = k0; k <= k1; k++) {
    const t = k + 0.5;
    const N0 = n0 + t * dn;
    const lo = Math.ceil(-N0 / c - 0.5);
    const hi = Math.min(lo + span - 1, Math.ceil((lim - N0) / c - 0.5) - 1);
    if (hi <= lo) continue;
    LM[m] = m0 + t * c;
    LLo[m] = lo;
    LHi[m] = hi;
    const o = m * span - lo;
    let prev = Math.floor(N0 + (lo + 0.5) * c);
    for (let i = lo + 1; i <= hi; i++) {
      const v = Math.floor(N0 + (i + 0.5) * c);
      if (v !== prev && v > 0 && v < lim) Q[o + i] = v;
      prev = v;
    }
    m++;
  }
  const inv = 1 / dm;
  for (let j = 0; j < phases.length; j++) {
    const f = phases[j];
    let cost = 0;
    for (let l = 0; l < m; l++) {
      const M0 = LM[l] + f;
      const lo = LLo[l];
      const hi = LHi[l];
      const a = Math.floor(M0 + (lo + 0.5) * dm);
      const b = Math.floor(M0 + (hi + 0.5) * dm);
      if (a === b) continue;
      const base = l * span - lo;
      if (b > a) {
        for (let n = a + 1; n <= b; n++) {
          if (n <= 0 || n >= ext) continue;
          // the first pixel reaching n (the estimate, made exact)
          let i = Math.ceil((n - M0) * inv - 0.5);
          while (Math.floor(M0 + (i - 0.5) * dm) >= n) i--;
          while (Math.floor(M0 + (i + 0.5) * dm) < n) i++;
          const v = Q[base + i];
          if (v < 0) continue;
          const at = rows ? v * W + n : n * W + v;
          cost += tbl[at];
          if (extra !== null && extra[at]) cost += (LETTER_JOG * extra[at]) / 2;
        }
      } else {
        for (let n = a; n > b; n--) {
          if (n <= 0 || n >= ext) continue;
          // the first pixel below n
          let i = Math.ceil((n - M0) * inv - 0.5);
          while (Math.floor(M0 + (i - 0.5) * dm) < n) i--;
          while (Math.floor(M0 + (i + 0.5) * dm) >= n) i++;
          const v = Q[base + i];
          if (v < 0) continue;
          const at = rows ? v * W + n : n * W + v;
          cost += tbl[at];
          if (extra !== null && extra[at]) cost += (LETTER_JOG * extra[at]) / 2;
        }
      }
    }
    out[j] = cost;
  }
  return out;
}

/**
 * The sampling phase (source px, both |·| < 0.5) of a lean of `side`: a small turn shears whole rows
 * a pixel every 1 / sin(deg) rows and drops columns a pixel every 1 / sin(deg) columns; the phase
 * slides those steps, and each step jogs every edge it crosses — so they are slid to where they jog
 * the fewest (stepCostOf, phaseCosts) and break no small symbol if they can help it (brokenSymbols:
 * a star, the type sigil, the orb, a back's pins): between the star row and the art, past the sigil.
 * A lettered face's ATK / DEF line takes no row step, and a column step only between its numbers
 * up to FLAT_DEG. Rows, columns, rows again, each from a grid of phases with the preferred one first
 * (kept on a tie, and pulling: PHASE_PULL): a lettered face's tiltShift / tiltPhaseY, else 0. ≈ 0.3 ms,
 * so the hand searches only the lean a card comes to rest at (`search` false: the preferred phase),
 * ahead of time and a pass a frame where it can (tiltPhaseStep); a search is kept (phaseJobs).
 */
export function tiltPhase(side: PixelCanvas, deg: number, line: Glyphs | null, face: boolean, search = true): readonly [number, number] {
  const pref = preferredPhase(side, deg, line);
  if (!search || !searchable(deg)) return pref;
  const job = phaseJob(side, deg, line, face, pref);
  while (job.pass < 3) phasePass(side, deg, line, face, pref, job);
  return [job.fx, job.fy];
}

/** One more pass of a lean's phase search (tiltBakeStep: a bake made ahead, part by part). False: searched already, or not searched at all. */
export function tiltPhaseStep(side: PixelCanvas, deg: number, line: Glyphs | null, face: boolean): boolean {
  if (!searchable(deg)) return false;
  const pref = preferredPhase(side, deg, line);
  const job = phaseJob(side, deg, line, face, pref);
  if (job.pass >= 3) return false;
  phasePass(side, deg, line, face, pref, job);
  return true;
}

/** A lean's phase search so far: passes done (rows, columns, rows again) and the phases found. */
interface PhaseJob {
  pass: number;
  fx: number;
  fy: number;
}

const phaseJobs = new Map<string, PhaseJob>();
/** Phase searches kept (a few numbers each: a bake the bake cache let go of is made again without searching). */
const PHASE_CAP = 1024;

function searchable(deg: number): boolean {
  return Math.sin((deg * Math.PI) / 180) !== 0 && Math.abs(deg) <= PHASE_MAX_DEG;
}

/** The phase a lean keeps unsearched: a lettered face's tiltShift / tiltPhaseY (its digits off the steps), else 0. */
function preferredPhase(side: PixelCanvas, deg: number, line: Glyphs | null): readonly [number, number] {
  return line ? ([tiltShift(deg, side.h), tiltPhaseY(deg, line.gapX, TILT_IN + Math.floor(side.w / 2))] as const) : ([0, 0] as const);
}

function phaseJob(side: PixelCanvas, deg: number, line: Glyphs | null, face: boolean, pref: readonly [number, number]): PhaseJob {
  const key = `${stepKey(side, line, face)}@${deg}`;
  let job = phaseJobs.get(key);
  if (!job) {
    phaseJobs.set(key, (job = { pass: 0, fx: pref[0], fy: pref[1] }));
    if (phaseJobs.size > PHASE_CAP) phaseJobs.delete(phaseJobs.keys().next().value!);
  }
  return job;
}

/**
 * The next pass of a phase search: the rows with the columns at their preferred phase, the columns
 * over those rows, then the rows again over those columns (a symbol is whole only when no step of
 * either axis crosses it). Each pass picks from a grid of n phases with the preferred one first
 * (kept on a tie, and pulling: PHASE_PULL), cheapest jogs first, each then paying for the symbols it
 * breaks (only while it can still win).
 */
function phasePass(side: PixelCanvas, deg: number, line: Glyphs | null, face: boolean, pref: readonly [number, number], job: PhaseJob): void {
  const sc = stepCostOf(side, line, face);
  const { W, H } = ringGeo(side.w, side.h);
  const cx = TILT_IN + Math.floor(side.w / 2);
  const cy = TILT_IN + Math.floor(side.h / 2);
  const r = (deg * Math.PI) / 180;
  const sin = Math.sin(r);
  const cos = Math.cos(r);
  const n = Math.max(8, Math.min(PHASES, Math.ceil(PHASE_DENSITY / Math.abs(sin))));
  const letter = line !== null && Math.abs(deg) <= FLAT_DEG;
  const pick = (rows: boolean, other: number, p: number): number => {
    // the preferred phase first (kept on a tie), then n spread over (−0.5, 0.5)
    const phases = new Float64Array(n + 1);
    phases[0] = p;
    for (let k = 0; k < n; k++) phases[k + 1] = -0.5 + (k + 0.5) / n;
    const cost = phaseCosts(sc, W, H, cx, cy, deg, other, rows, letter, phases);
    for (let k = 1; k <= n; k++) cost[k] += PHASE_PULL * Math.abs(phases[k] - p);
    const order = Array.from(phases.keys()).sort((a, b) => cost[a] - cost[b] || a - b);
    let best = order[0];
    let bv = Infinity;
    for (const k of order) {
      if (cost[k] >= bv) break;
      const f = phases[k];
      // (counting stops once this one cannot win any more)
      const upTo = bv === Infinity ? Infinity : (bv - cost[k]) / SYMBOL_BREAK;
      const v = cost[k] + SYMBOL_BREAK * brokenSymbols(sc.symbols, cx, cy, sin, cos, rows ? f : other, rows ? other : f, upTo);
      if (v < bv) {
        bv = v;
        best = k;
      }
    }
    return phases[best];
  };
  if (job.pass === 0) job.fx = pick(true, pref[1], pref[0]);
  else if (job.pass === 1) job.fy = pick(false, job.fx, pref[1]);
  else job.fx = pick(true, job.fy, pref[0]);
  job.pass++;
}

/**
 * The sampling phase (source px, |·| ≤ 0.5) of a lean: a small turn shears whole rows one pixel
 * every 1 / sin(deg) rows; this puts HAND3.keepRow — the ATK / DEF digits — midway between two such
 * steps, so the digits are never cut in two (at ±1°, ±3°, ±5° a step would otherwise fall in them).
 */
export function tiltShift(deg: number, h: number): number {
  const s = Math.sin((deg * Math.PI) / 180);
  const dyc = HAND3.keepRow + 0.5 - Math.floor(h / 2);
  return Math.round(dyc * s) - dyc * s;
}

/**
 * The vertical sampling phase (source px, |·| ≤ 0.5) of a lettered lean: a turn drops a row one
 * pixel every 1 / sin(deg) columns; this puts one such step at `gapX` — the gap between the ATK and
 * DEF numbers — so a number keeps its own row as long as the slope allows (at 1.5° the line drops
 * once, between the numbers, not between a number's last two digits). `pivotX`: the turn's pivot.
 */
export function tiltPhaseY(deg: number, gapX: number, pivotX: number): number {
  const v = (gapX - pivotX) * Math.sin((deg * Math.PI) / 180) + 0.5;
  return v - Math.round(v);
}

/** Bake every `degStep` step between 0 and `deg` of a side ahead (a tool for previews and tests; the hand bakes on demand). */
export function prebakeTilt(side: PixelCanvas, deg: number, glyphs = false): void {
  const n = Math.round(Math.abs(deg) / HAND3.degStep);
  const step = Math.sign(deg) * HAND3.degStep;
  for (let k = 1; k <= n; k++) tiltBake(side, k * step, glyphs);
}

// ---------------------------------------------------------------- the ATK / DEF line, glyph by glyph

/**
 * A monster face's ATK / DEF line as rigid blocks — the two icons and every digit with its drop
 * shadow. A lean moves each block as ONE piece (upright, whole pixels, to where the turn takes it), so
 * the lettering steps along the slope BETWEEN glyphs, as a pixel artist letters a tilted card; turned
 * pixel by pixel a 3-px digit kinks wherever a 1-px step of the turn falls in it (at ±4° a "0" reads
 * "d", an "8" reads "4"). Found on the face itself: the rows around HAND3.keepRow that carry ink on a
 * flat ground (the v3 face's y 59..63, the a5=off face's 60..64), cut at the ink-free columns; the
 * drop shadow is the line's darkest tone, beside and under the ink.
 */
export interface Glyphs {
  /** Each block's pixels, as composite indices (y + TILT_IN) · W + (x + TILT_IN). */
  readonly blocks: readonly Int32Array[];
  /** Composite index → its block (−1: none). */
  readonly of: Int32Array;
  /** The line's composite box (ink rows + the shadow row; inside the frame's two outer columns). */
  readonly y0: number;
  readonly y1: number;
  readonly x0: number;
  readonly x1: number;
  /** Per composite row y0 … y1: a composite index of that row's ground (what a moved glyph leaves). */
  readonly ground: Int32Array;
  /** Composite pixels of bare ground just above / below the line (2 rows): a glyph may land there too. */
  readonly bare: Uint8Array;
  /** Composite pixels of the drop shadow (the line's darkest tone): a glyph's optional part. */
  readonly shade: Uint8Array;
  /** The composite x of the line's widest gap between two glyphs (between the ATK and DEF numbers). */
  readonly gapX: number;
}

const glyphLines = new Map<number, Glyphs | null>();
const lum = (c: number): number => ((c >> 16) & 255) * 299 + ((c >> 8) & 255) * 587 + (c & 255) * 114;

/** The ATK / DEF line of a face (null: none found). Cached per side (by sideId: its pixels). */
export function glyphsOf(side: PixelCanvas): Glyphs | null {
  const id = sideId(side);
  let g = glyphLines.get(id);
  if (g === undefined) {
    glyphLines.set(id, (g = findGlyphs(side)));
    if (glyphLines.size > CONTENT_CAP) glyphLines.delete(glyphLines.keys().next().value!);
  }
  return g;
}

function findGlyphs(side: PixelCanvas): Glyphs | null {
  const { w, h } = side;
  const k = HAND3.keepRow;
  if (w < 8 || k + 1 >= h) return null;
  const x0 = 2;
  const x1 = w - 3;
  // the ground: the commonest tone around the line (its rows and the bare rows framing it: inside the
  // line alone a digit's dark counters and shadows can outnumber it); the shadow: the darkest tone
  // darker than the ground
  const tally = new Map<number, number>();
  for (let y = Math.max(0, k - 3); y <= Math.min(h - 1, k + 4); y++)
    for (let x = x0; x <= x1; x++) {
      const c = side.get(x, y);
      if (c !== null) tally.set(c, (tally.get(c) ?? 0) + 1);
    }
  let B = -1;
  let most = 0;
  for (const [c, n] of tally) if (n > most) [B, most] = [c, n];
  if (B < 0) return null;
  let S: number | null = null;
  for (let y = Math.max(0, k - 3); y <= Math.min(h - 1, k + 4); y++)
    for (let x = x0; x <= x1; x++) {
      const c = side.get(x, y);
      if (c !== null && c !== B && lum(c) < lum(B) && (S === null || lum(c) < lum(S))) S = c;
    }
  const ink = (x: number, y: number): boolean => {
    const c = side.get(x, y);
    return c !== null && c !== B && c !== S;
  };
  // ink lives in x0 … xi; x1 is a shadow column only (the last digit's shadow, beside the frame's own
  // pixels — a corner ornament, an inner frame line — which stay where the turn puts them)
  const xi = x1 - 1;
  // a row of the line: some glyph ink (3+ px), and at least an eighth of it bare ground (a frame bar
  // has none; four dense digits with dark counters leave ~ a fifth)
  const lineRow = (y: number): boolean => {
    let inked = 0;
    let ground = 0;
    for (let x = x0; x <= x1; x++) {
      if (side.get(x, y) === B) ground++;
      else if (x <= xi && ink(x, y)) inked++;
    }
    return inked >= 3 && ground * 8 >= x1 - x0 + 1;
  };
  if (!lineRow(k)) return null;
  let r0 = k;
  let r1 = k;
  while (r0 > 0 && lineRow(r0 - 1)) r0--;
  while (r1 < h - 1 && lineRow(r1 + 1)) r1++;
  if (r1 - r0 + 1 > 8) return null;
  const rs = Math.min(h - 1, r1 + 1); // the drop shadow's row
  const W = w + 2 * TILT_IN;
  const at = (x: number, y: number): number => (y + TILT_IN) * W + (x + TILT_IN);
  const of = new Int32Array(W * (h + 2 * TILT_IN)).fill(-1);
  const blocks: Int32Array[] = [];
  const inkCol = (x: number): boolean => {
    for (let y = r0; y <= r1; y++) if (ink(x, y)) return true;
    return false;
  };
  for (let x = x0; x <= xi; ) {
    if (!inkCol(x)) {
      x++;
      continue;
    }
    const a = x;
    while (x + 1 <= xi && inkCol(x + 1)) x++;
    const b = x;
    x++;
    if (b - a + 1 > 7) continue; // a bar, not a glyph
    // the glyph: its columns' ink, counters and shadow in the line; the shadow alone beside it
    // (column b + 1) and in the row under it
    const px: number[] = [];
    for (let y = r0; y <= rs; y++)
      for (let xx = a; xx <= Math.min(x1, b + 1); xx++) {
        const c = side.get(xx, y);
        if (c !== null && (y <= r1 && xx <= b ? c !== B : c === S)) px.push(at(xx, y));
      }
    if (!px.length) continue;
    for (const i of px) of[i] = blocks.length;
    blocks.push(Int32Array.from(px));
  }
  if (!blocks.length) return null;
  // each row's ground: its commonest tone outside the glyphs, the instance nearest the middle
  const ground = new Int32Array(rs - r0 + 1);
  for (let y = r0; y <= rs; y++) {
    const n = new Map<number, number>();
    for (let x = x0; x <= x1; x++) {
      const c = side.get(x, y);
      if (c !== null && of[at(x, y)] < 0) n.set(c, (n.get(c) ?? 0) + 1);
    }
    let G: number | null = null;
    let gm = 0;
    for (const [c, m] of n) if (m > gm) [G, gm] = [c, m];
    if (G === null) return null;
    let gx = -1;
    for (let d = 0; d <= w && gx < 0; d++)
      for (const x of [(w >> 1) - d, (w >> 1) + d]) if (gx < 0 && x >= x0 && x <= x1 && side.get(x, y) === G && of[at(x, y)] < 0) gx = x;
    ground[y - r0] = at(gx, y);
  }
  // a steep lean takes an upright glyph's corner a row past the turned line: bare ground there takes it
  const bare = new Uint8Array(of.length);
  for (const y of [r0 - 2, r0 - 1, rs + 1, rs + 2])
    if (y >= 0 && y < h) for (let x = x0; x <= x1; x++) if (side.get(x, y) === B) bare[at(x, y)] = 1;
  const shade = new Uint8Array(of.length);
  for (const px of blocks) for (const i of px) if (side.get((i % W) - TILT_IN, Math.floor(i / W) - TILT_IN) === S) shade[i] = 1;
  // the widest gap between two neighbouring glyphs' ink (blocks run left to right)
  let gapX = TILT_IN + Math.floor(w / 2);
  let widest = -1;
  const inkSpan = (px: Int32Array): [number, number] => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const i of px)
      if (!shade[i]) {
        lo = Math.min(lo, i % W);
        hi = Math.max(hi, i % W);
      }
    return [lo, hi];
  };
  for (let k = 1; k < blocks.length; k++) {
    const a = inkSpan(blocks[k - 1])[1];
    const b = inkSpan(blocks[k])[0];
    if (b - a > widest) {
      widest = b - a;
      gapX = (a + 1 + b) / 2;
    }
  }
  return { blocks, of, y0: r0 + TILT_IN, y1: rs + TILT_IN, x0: x0 + TILT_IN, x1: x1 + TILT_IN, ground, bare, shade, gapX };
}

/**
 * Re-letter a turned map: every output pixel showing a glyph pixel shows that row's ground instead,
 * then each glyph is set down whole — shifted by the (rounded) mean of where the turn took its pixels —
 * onto the line or the bare ground right by it only (never the frame, the ring or outside the card:
 * a pixel that would land there — a shadow corner at a steep lean on the a5=off face — is left out).
 */
/** How far (px) a glyph may move from where the turn takes it to stay whole. */
const GLYPH_REACH = 3;

function holdGlyphs(m: RotMap, gl: Glyphs, W: number): void {
  const n = gl.blocks.length;
  const sx = new Float64Array(n);
  const sy = new Float64Array(n);
  const cnt = new Int32Array(n);
  const idx = m.idx;
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k];
    if (i < 0) continue;
    const b = gl.of[i];
    if (b < 0) continue;
    sx[b] += (k % m.w) - (i % W);
    sy[b] += Math.floor(k / m.w) - Math.floor(i / W);
    cnt[b]++;
    idx[k] = gl.ground[Math.floor(i / W) - gl.y0];
  }
  // where glyph pixel i may land with shift (tx, ty): on the line or the bare ground by it, not on a
  // glyph set down already — except that ink covers a neighbour's drop shadow (output position, or −1)
  const spot = (i: number, tx: number, ty: number): number => {
    const ox = (i % W) + tx;
    const oy = Math.floor(i / W) + ty;
    if (ox < 0 || oy < 0 || ox >= m.w || oy >= m.h) return -1;
    const k = oy * m.w + ox;
    const cur = idx[k];
    if (cur < 0 || (gl.of[cur] >= 0 && (gl.shade[i] || !gl.shade[cur]))) return -1;
    const cx = cur % W;
    const cy = Math.floor(cur / W);
    return cx < gl.x0 || cx > gl.x1 || ((cy < gl.y0 || cy > gl.y1) && !gl.bare[cur]) ? -1 : k;
  };
  for (let b = 0; b < n; b++) {
    if (!cnt[b]) continue;
    const px = gl.blocks[b];
    const mx = sx[b] / cnt[b];
    const my = sy[b] / cnt[b];
    let tx = Math.round(mx);
    let ty = Math.round(my);
    // the rounded mean, else the nearest shift (up to 3 px away) that sets the glyph's ink down whole:
    // a half-degree or a steep lean (the hot-seat swap's fall) takes an end glyph's corner onto the
    // frame — it moves in instead of losing ink (a drop-shadow pixel with no room is left out)
    const whole = (x: number, y: number): boolean => px.every((i) => gl.shade[i] === 1 || spot(i, x, y) >= 0);
    if (!whole(tx, ty)) {
      let best = Infinity;
      for (let dy = -GLYPH_REACH; dy <= GLYPH_REACH; dy++)
        for (let dx = -GLYPH_REACH; dx <= GLYPH_REACH; dx++) {
          const x = Math.round(mx) + dx;
          const y = Math.round(my) + dy;
          const d = (x - mx) * (x - mx) + (y - my) * (y - my);
          if ((dx || dy) && d < best && whole(x, y)) {
            best = d;
            tx = x;
            ty = y;
          }
        }
    }
    // the ink, then its drop shadow where there is room for it
    for (const ink of [true, false])
      for (const i of px) {
        if (gl.shade[i] === (ink ? 1 : 0)) continue;
        const k = spot(i, tx, ty);
        if (k >= 0) idx[k] = i;
      }
  }
}

/** The node tail tones of a rim (CardV3's rampOf: the ramp a tone belongs to, else the neutral one). */
function nodeRamp(color: number): Ramp {
  for (const r of [PLAYER_RAMP[0], PLAYER_RAMP[1], ...Object.values(RAMPS)]) if ((r as readonly number[]).includes(color)) return r;
  return [PAL.night3, PAL.night4, PAL.steel, PAL.mist, PAL.white];
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
  /** The lean (degrees; shown in whole baked steps). */
  tilt: Track;
  /** The lean this card's fan slot rests at (the lift state decides what is shown: tiltOf). */
  rest: number;
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

/** A card let go of that still eases its lean (the hot-seat swap, a discard). */
interface Loose {
  tilt: Track;
  done: () => void;
}

export interface HandMotionOpts {
  /** The 1 × 1 white texture (the rim's light node pixels; TEX.px1). */
  px1: string;
}

/**
 * Steps the hand's cards on whole pixels (see the header). One per HandView; the cards it holds are
 * moved by nothing else (a card in flight is released first and adopted again where it lands).
 */
export class HandMotion {
  private readonly scene: Phaser.Scene;
  private readonly px1: string;
  private readonly map = new Map<Phaser.GameObjects.Container, Motion>();
  private readonly loose = new Map<Phaser.GameObjects.Container, Loose>();
  private readonly views = new Map<Phaser.GameObjects.Container, TiltView>();
  /** The side a held card turns to (a wave's turn: expect), its lean to bake ahead. */
  private readonly expected = new Map<Phaser.GameObjects.Container, { side: PixelCanvas; faceUp: boolean }>();
  /** The hand's own clock (scaled ms; breathing reads it). */
  private clock = 0;
  private alive = true;
  private readonly onUpdate = (_t: number, dt: number) => this.tick(dt);

  constructor(scene: Phaser.Scene, opts: HandMotionOpts) {
    this.scene = scene;
    this.px1 = opts.px1;
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

  /** The lean a card shows now (degrees on the `degStep` grid; 0: upright or not leaning). */
  leanOf(sprite: Phaser.GameObjects.Container): number {
    return this.views.get(sprite)?.deg ?? 0;
  }

  /**
   * Hold a card in its fan slot: x / base y (unlifted), its lift state, breathing phase and resting
   * lean (`deg`: the lift state decides what is shown — upright when raised, half when marked). A card
   * not held yet is adopted where it is and as it leans (e.g. where its flight landed). `animate`
   * false: at once.
   */
  place(sprite: Phaser.GameObjects.Container, x: number, base: number, state: LiftState, animate: boolean, phase: number, deg = 0): void {
    let m = this.map.get(sprite);
    if (!m) {
      const cx = Math.round(sprite.x);
      const cy = Math.round(sprite.y);
      // a card adopted mid-air keeps where it is; its "state" is whatever its height says
      m = { sprite, x: new Track(cx), y: new Track(cy), tilt: new Track(this.leanOf(sprite)), rest: deg, state: 'rest', base, phase, shake: null, el: 0, cues: [] };
      const up = base - cy;
      if (up >= HAND3.lift - 1) m.state = 'hover';
      else if (up >= HAND3.mark - 1) m.state = 'mark';
      this.map.set(sprite, m);
      this.settleLoose(sprite);
    }
    m.phase = phase;
    m.rest = deg;
    const target = base - liftOf(state);
    const lean = tiltOf(state, deg);
    if (!animate) {
      m.x.jump(x);
      m.y.jump(target);
      m.tilt.jump(lean);
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
    if (m.tilt.end !== lean) {
      // upright through the baked steps (reduced motion: in one step)
      if (REDUCED_MOTION) m.tilt.jump(lean);
      else m.tilt.play([{ at: HAND3.tiltMs, v: lean, ease: EASE.outCubic }]);
    }
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

  /**
   * Ease the lean of a card that is not held (`from`: what it shows now) to `deg` over `ms` — the
   * hot-seat swap's cards, a discarded card straightening as it lifts. Resolves when it is there;
   * at 0 the CardV3 draws itself again. Reduced motion: at once.
   */
  lean(sprite: Phaser.GameObjects.Container, deg: number, ms: number, from = this.leanOf(sprite)): Promise<void> {
    this.settleLoose(sprite);
    if (this.map.has(sprite) || !sprite.active) return Promise.resolve();
    if (REDUCED_MOTION || ms <= 0 || from === deg) {
      this.show(sprite, deg);
      return Promise.resolve();
    }
    const tilt = new Track(from);
    tilt.play([{ at: ms, v: deg, ease: EASE.outCubic }]);
    this.showTrack(sprite, tilt);
    return new Promise((done) => this.loose.set(sprite, { tilt, done }));
  }

  /**
   * Let go of a card (a cinematic takes it, it is destroyed, or it flies). It stands upright at once
   * (the CardV3 draws itself) unless `keepLean`: then it keeps leaning as it is (the swap's drop).
   */
  release(sprite: Phaser.GameObjects.Container, keepLean = false): void {
    this.map.delete(sprite);
    if (keepLean) return;
    this.settleLoose(sprite);
    this.dropView(sprite);
  }

  /**
   * A held card is about to turn to `side` (`faceUp`: its face; e.g. a flip's last frame, the side
   * at full width): its lean of that side is baked ahead while it turns (bakeAhead), so the turn
   * lands on a ready bake.
   */
  expect(sprite: Phaser.GameObjects.Container, side: PixelCanvas, faceUp: boolean): void {
    if (this.map.has(sprite)) this.expected.set(sprite, { side, faceUp });
  }

  /** Let go of every card (all upright). */
  clear(): void {
    this.expected.clear();
    this.map.clear();
    for (const s of [...this.loose.keys()]) this.settleLoose(s);
    for (const s of [...this.views.keys()]) this.dropView(s);
  }

  destroy(): void {
    if (!this.alive) return;
    this.clear();
    this.alive = false;
    this.scene?.events?.off('update', this.onUpdate);
  }

  private settleLoose(sprite: Phaser.GameObjects.Container): void {
    const l = this.loose.get(sprite);
    if (!l) return;
    this.loose.delete(sprite);
    l.done();
  }

  private dropView(sprite: Phaser.GameObjects.Container): void {
    this.views.get(sprite)?.destroy();
    this.views.delete(sprite);
  }

  /**
   * Show a card leaning `deg` (on the `degStep` grid): its TiltView, made on the first lean. `rest`:
   * the lean it comes to rest at — baked with its steps searched off its symbols (tiltPhase); a lean
   * shown in passing (a hover's turn, the swap's fall and rise) keeps the preferred phase, cheap.
   */
  private show(sprite: Phaser.GameObjects.Container, deg: number, rest = true): void {
    let v = this.views.get(sprite);
    if (!v) {
      if (deg === 0 || !isTiltCard(sprite) || !sprite.active) return;
      v = new TiltView(this.scene, sprite, this.px1, () => this.views.delete(sprite));
      this.views.set(sprite, v);
    }
    v.show(deg, rest);
  }

  /** Show a lean track's value; at rest where the track ends. */
  private showTrack(sprite: Phaser.GameObjects.Container, tilt: Track): void {
    const deg = quantizeDeg(tilt.value, HAND3.degStep);
    this.show(sprite, deg, deg === quantizeDeg(tilt.end, HAND3.degStep));
  }

  private apply(m: Motion): void {
    const s = m.sprite;
    const dx = m.shake === null ? 0 : rejectOffset(m.shake);
    const breath = m.y.moving ? 0 : breathOf(this.clock, m.phase);
    s.setPosition(Math.round(m.x.value) + dx, Math.round(m.y.value) + breath);
    this.showTrack(s, m.tilt);
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
      m.tilt.step(dt);
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
    for (const [sprite, l] of this.loose) {
      if (!sprite.active) {
        this.settleLoose(sprite);
        continue;
      }
      l.tilt.step(dt);
      this.showTrack(sprite, l.tilt);
      if (!l.tilt.moving) this.settleLoose(sprite);
    }
    // every leaning card follows its CardV3's look (side, rim, flash, light node, sweep)
    for (const v of this.views.values()) v.update();
    this.bakeAhead();
  }

  /**
   * Bake ahead, in what is left of the frame (one part of a bake — tiltBakeStep — then more up to
   * AHEAD_MS), the leans cards are about to come to rest at: where a moving lean track ends (a
   * re-fan, a mark, the swap's rise) and the side a held card turns to (expect). A card then lands
   * on a ready bake: a new side's step costs, up-scale and phase search (≈ 1.5 ms in all; more while
   * the code is not warm yet) never pile up on the frame a whole hand settles in together.
   */
  private bakeAhead(): void {
    const t0 = performance.now();
    let worked = false;
    const spent = (): boolean => worked && performance.now() - t0 > AHEAD_MS;
    // a lean's bake, part by part (tiltBakeStep) while the frame allows; true: baked (or nothing to bake)
    const ahead = (sprite: Phaser.GameObjects.Container, end: number, side: PixelCanvas | null, faceUp: boolean): boolean => {
      const deg = quantizeDeg(end, HAND3.degStep);
      if (deg === 0 || Math.abs(deg) > PHASE_MAX_DEG || !sprite.active || !isTiltCard(sprite)) return true;
      const px = side ?? sprite.shownPixels();
      // (only a card shown at its texture size leans; a flip's turn frame is never searched)
      if ((side === null && (sprite.displayW !== px.w || sprite.displayH !== px.h)) || isTurnFrame(px)) return true;
      const { glyphs, face } = leanFlags(sprite, faceUp);
      while (!spent()) {
        if (!tiltBakeStep(px, deg, glyphs, face)) return true;
        worked = true;
      }
      return false;
    };
    for (const [sprite, e] of this.expected) {
      if (spent()) return;
      const m = this.map.get(sprite);
      if (!m || ahead(sprite, m.tilt.end, e.side, e.faceUp)) this.expected.delete(sprite);
    }
    for (const [sprite, m] of this.map) {
      if (spent()) return;
      if (m.tilt.moving && isTiltCard(sprite)) ahead(sprite, m.tilt.end, null, sprite.faceUp);
    }
    for (const [sprite, l] of this.loose) {
      if (spent()) return;
      if (l.tilt.moving && isTiltCard(sprite)) ahead(sprite, l.tilt.end, null, sprite.faceUp);
    }
  }
}

/** Bake-ahead's share of a frame (ms) once it has made one bake (HandMotion.bakeAhead). */
const AHEAD_MS = 1;

/** A card's lean flags (tiltBake): a face up (`faceUp`) of a known card; a monster's: its ATK / DEF line lettered. */
function leanFlags(card: TiltCard, faceUp: boolean): { glyphs: boolean; face: boolean } {
  const id = card.cardId;
  const face = faceUp && id !== null;
  return { face, glyphs: face && isMonster(cardDef(id)) };
}

// ================================================================ TiltView (a leaning card, drawn)

/** What a TiltView needs of a CardV3 (structural: no runtime import of the card class). */
type TiltCard = Phaser.GameObjects.Container & {
  readonly inner: Phaser.GameObjects.Container;
  readonly crisp: boolean;
  readonly rimStyle: Readonly<RimStyle> | null;
  readonly displayW: number;
  readonly displayH: number;
  /** CardSprite's public side state: a known monster face up gets its ATK / DEF line held whole. */
  readonly faceUp: boolean;
  readonly cardId: CardId | null;
  shownPixels(): PixelCanvas;
};

function isTiltCard(s: Phaser.GameObjects.Container): s is TiltCard {
  const c = s as unknown as Partial<TiltCard>;
  return c.crisp === true && typeof c.shownPixels === 'function' && !!c.inner;
}

/** The sheen / foil sprite of a card, as far as a TiltView reads it. */
interface SheenLike {
  visible: boolean;
  alpha: number;
  blendMode: number | string;
  frame: { name: string };
  texture: { key: string };
}

/**
 * What the upright CardV3 shows right now beyond its public state: the rim flash (tone + shape), the
 * running node's phase and the foil / sheen sweep. CardV3 keeps these private (it draws them itself
 * when upright); a TiltView reads them so the leaning copy flashes and runs its light node frame for
 * frame with the card it stands in for — tests/v3/a6-cards.test.ts guards the field names.
 */
function upright(card: TiltCard): { flash: number | null; shape: 'full' | 'style'; nodeT: number; sheen: SheenLike | null } {
  const c = card as unknown as { nodeT?: unknown; flashTone?: unknown; flashShape?: unknown; sheen?: unknown };
  const sheen = c.sheen as SheenLike | undefined;
  return {
    flash: typeof c.flashTone === 'number' ? c.flashTone : null,
    shape: c.flashShape === 'style' ? 'style' : 'full',
    nodeT: typeof c.nodeT === 'number' ? c.nodeT : 0,
    sheen: sheen && sheen.visible && sheen.alpha > 0 ? sheen : null,
  };
}

/** The pixels of an overlay frame (read once from its texture source; null when unreadable). */
const overlayPixels = new WeakMap<object, Uint8ClampedArray | null>();
function overlayOf(frame: object): Uint8ClampedArray | null {
  if (!overlayPixels.has(frame)) overlayPixels.set(frame, frameRGBA(frame as unknown as FrameLike));
  return overlayPixels.get(frame) ?? null;
}

let tiltSeq = 0;

/**
 * One leaning hand card on screen: the baked lean in ONE small live canvas (re-painted only when what
 * it shows changes — the lean step, the side or turn frame, the rim tones, a sweep frame) plus the
 * rim's running light node (3 px1 pixels per node), all children of the card's container at whole
 * pixels and unrotated; the CardV3's own layers (its `inner`) are hidden meanwhile. At 0° it hides
 * itself and the CardV3 draws itself upright again.
 */
class TiltView {
  deg = 0;
  private img: Phaser.GameObjects.Image | null = null;
  private tex: Phaser.Textures.CanvasTexture | null = null;
  private key = '';
  private readonly nodes: Phaser.GameObjects.Image[] = [];
  private sig = '';
  private rest = true;
  private bake: TiltBake | null = null;
  private buf: PixelCanvas | undefined;
  /** An ImageData over `buf`'s own pixels (no copy per paint), and the size last put on the texture. */
  private bufImg: ImageData | null = null;
  private putW = 0;
  private putH = 0;
  private dead = false;
  private readonly onDestroy = () => this.destroy();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly card: TiltCard,
    private readonly px1: string,
    private readonly onGone: () => void,
  ) {
    card.once('destroy', this.onDestroy);
  }

  /** Lean `deg` degrees (0: upright, the CardV3 draws itself); `rest`: the lean it rests at (tiltBake's search). */
  show(deg: number, rest = true): void {
    if (this.dead || (deg === this.deg && rest === this.rest)) return;
    this.deg = deg;
    this.rest = rest;
    if (deg === 0) this.hide();
    else this.update();
  }

  /** Follow the card's look; every frame while it leans (cheap when nothing changed). */
  update(): void {
    if (this.dead || this.deg === 0) return;
    const card = this.card;
    if (!card.active) return;
    const side = card.shownPixels();
    // only a card shown at its texture size leans (a cinematic's raster is the CardV3's own business)
    if (card.displayW !== side.w || card.displayH !== side.h) {
      this.hide();
      return;
    }
    const st = card.rimStyle;
    const look = upright(card);
    // the ring's tones, exactly as CardV3.placeRim picks them (a 'style' flash lights only the drawn edges)
    const flash = look.flash;
    const partial = flash !== null && look.shape === 'style' && st !== null;
    const tl = partial ? (st!.tl !== null ? flash : null) : (flash ?? st?.tl ?? null);
    const br = partial ? (st!.br !== null ? flash : null) : (flash ?? st?.br ?? null);
    let over: TiltOverlay | null = null;
    let sweep = '-';
    const sh = look.sheen;
    if (sh) {
      const rgba = overlayOf(sh.frame);
      if (rgba && rgba.length === side.w * side.h * 4) {
        over = { rgba, alpha: sh.alpha, add: sh.blendMode === 1 || sh.blendMode === 'ADD' };
        sweep = `${sh.texture.key}#${sh.frame.name}@${sh.alpha}`;
      }
    }
    const sig = `${sideId(side)}|${this.deg}|${this.rest}|${tl}|${br}|${sweep}`;
    if (sig !== this.sig) {
      this.sig = sig;
      this.paint(side, tl, br, over);
    }
    const b = this.bake!;
    const ix = Math.round(card.inner.x) - b.map.px;
    const iy = Math.round(card.inner.y) - b.map.py;
    this.img!.setPosition(ix, iy).setVisible(true);
    card.inner.setVisible(false);
    this.placeNodes(st, look.nodeT, flash !== null, ix, iy);
  }

  private paint(side: PixelCanvas, tl: number | null, br: number | null, over: TiltOverlay | null): void {
    const { glyphs, face } = leanFlags(this.card, this.card.faceUp);
    // one bake per new step, when it is first shown (a passing step ≈ 0.15 ms; a hover's turn shows
    // two or three, one a frame) — only the lean a card comes to rest at, searched, is baked ahead
    // (HandMotion.bakeAhead): a fresh hand paints each card once, not every step to upright
    const b = (this.bake = tiltBake(side, this.deg, glyphs, face, this.rest));
    this.buf = paintTilt(b, side, tl, br, over, this.buf);
    const { w, h } = b.map;
    const sc = this.scene;
    if (!this.tex || this.tex.width < w || this.tex.height < h) {
      if (this.key && sc.textures.exists(this.key)) {
        this.img?.setTexture('__DEFAULT');
        sc.textures.remove(this.key);
      }
      this.key = `hand3:tilt:${++tiltSeq}`;
      this.tex = sc.textures.createCanvas(this.key, Math.max(96, w), Math.max(96, h))!;
    }
    const tex = this.tex;
    if (!this.bufImg || this.bufImg.data !== this.buf.data) this.bufImg = new ImageData(this.buf.data as Uint8ClampedArray<ArrayBuffer>, w, h);
    // putImageData replaces its rectangle outright: clear only what a bigger last bake left outside it
    if (this.putW > w || this.putH > h) tex.context.clearRect(0, 0, this.putW, this.putH);
    tex.context.putImageData(this.bufImg, 0, 0);
    this.putW = w;
    this.putH = h;
    const name = `t${w}x${h}`;
    if (!tex.has(name)) tex.add(name, 0, 0, 0, w, h);
    tex.refresh();
    if (!this.img) {
      this.img = sc.add.image(0, 0, this.key, name).setOrigin(0);
      this.card.add(this.img);
    } else this.img.setTexture(this.key, name);
  }

  /** The rim's running light node on the leaning ring (CardV3.placeNode, on the baked ring path). */
  private placeNodes(st: Readonly<RimStyle> | null, nodeT: number, flashing: boolean, ix: number, iy: number): void {
    const count = st ? Math.max(0, Math.min(2, Math.round(st.nodes ?? 0))) : 0;
    const ring = this.bake!.ring;
    const L = ring.length;
    if (count === 0 || flashing || L === 0) {
      for (const n of this.nodes) n.setVisible(false);
      return;
    }
    while (this.nodes.length < count * 3) {
      const img = this.scene.add.image(0, 0, this.px1).setOrigin(0);
      this.card.add(img);
      this.nodes.push(img);
    }
    const R = st!.ramp ?? nodeRamp(st!.tl ?? st!.br ?? PAL.mist);
    const tones = [PAL.white, R[4], R[2]];
    const mw = this.bake!.map.w;
    for (let k = count * 3; k < this.nodes.length; k++) this.nodes[k].setVisible(false);
    for (let n = 0; n < count; n++) {
      const t = nodeT + n / count;
      const head = Math.floor((((t % 1) + 1) % 1) * L) % L;
      for (let i = 0; i < 3; i++) {
        const k = ring[(head - i + L * 2) % L];
        this.nodes[n * 3 + i].setPosition(ix + (k % mw), iy + Math.floor(k / mw)).setTint(tones[i]).setVisible(true);
      }
    }
  }

  private hide(): void {
    this.img?.setVisible(false);
    for (const n of this.nodes) n.setVisible(false);
    if (this.card.active) this.card.inner.setVisible(true);
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.card.off('destroy', this.onDestroy);
    this.hide();
    this.img?.destroy();
    this.img = null;
    for (const n of this.nodes) n.destroy();
    this.nodes.length = 0;
    if (this.key && this.scene.textures?.exists(this.key)) this.scene.textures.remove(this.key);
    this.tex = null;
    this.onGone();
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
