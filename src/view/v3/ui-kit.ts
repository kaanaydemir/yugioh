// v3 UI drawing kit — docs/v3/A6_PLAN.md §4.1 (rules KO-1 … KO-4, §1.5). The painters and the two
// runtime helpers both A6 lanes build their UI from. Written in A56.0 and FROZEN: a lane writes any
// extra helper in its own files.
//
// Painters (pure, into a PixelCanvas; palette tones only, whole pixels, 1-px lines, nothing
// alpha-blended or ADD):
//   rimRect(p, x, y, w, h, color, { cut, node })     1-px rim + a running light node (KO-3)
//   rimPath(x, y, w, h, cut)                         that rim's pixels, clockwise from the top left
//   brackets(p, x, y, w, h, color, { leg, gap })     four target corners (legs ≥ 4 px, ink outline)
//   plateFrame(p, x, y, w, h, trim, { step })        a plate (FRAME_V3) that can appear in palette steps
//   rejectStamp(p, cx, cy, { tone })                 the 7×7 crimson × with a 1-px ink contour (F5)
//   contour(src, color)                              1-px outline around a canvas's opaque pixels
//   paletteSteps(color, n, dir)                      the next n tones of a colour's ramp (stepped fades)
// Runtime (Phaser):
//   contourOf(sprite, color) / showContour(...)      the 1-px contour of a sprite's CURRENT frame
//   stampText(scene, x, y, text, opts)               text stamped one letter per frame (or per ms)

import type Phaser from 'phaser';
import { frameRGBA } from '../../art/atlas';
import { FRAME_V3, frameRectV3, trimV3, type FrameV3Opts, type Trim, type TrimName } from '../../art/frame-v3';
import { PAL, RAMPS } from '../../art/palette';
import { PixelCanvas, type Pt } from '../../art/pixel';
import { pixelText, revealText, type TextOpts } from '../../ui/text';
import { REDUCED_MOTION } from './motion';

// (No runtime import of Phaser or of modules that load it: the painters stay usable from node
// tools and tests. The runtime helpers only call methods of the scene / sprite they are given.)

/** A sprite or image whose current frame contourOf reads. */
export type FrameSprite = Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;

// ================================================================ rim + running node

/**
 * The pixels of a 1-px rectangle rim in walking order, clockwise from the top-left end of the
 * top edge. `cut` 0 = square corners, 1 = the corner pixels left out, 2 = a 1-px diagonal.
 */
export function rimPath(x: number, y: number, w: number, h: number, cut = 1): Pt[] {
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);
  const c = Math.max(0, Math.min(2, Math.round(cut)));
  const pts: Pt[] = [];
  if (w <= 0 || h <= 0) return pts;
  if (w === 1 || h === 1) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) pts.push([xx, yy]);
    return pts;
  }
  const r = x + w - 1;
  const b = y + h - 1;
  for (let xx = x + c; xx <= r - c; xx++) pts.push([xx, y]);
  if (c === 2) pts.push([r - 1, y + 1]);
  for (let yy = y + c; yy <= b - c; yy++) if (!(yy === y && c === 0)) pts.push([r, yy]);
  if (c === 2) pts.push([r - 1, b - 1]);
  for (let xx = r - c; xx >= x + c; xx--) if (!(xx === r && c === 0)) pts.push([xx, b]);
  if (c === 2) pts.push([x + 1, b - 1]);
  for (let yy = b - c; yy >= y + c; yy--) if (!(c === 0 && (yy === b || yy === y))) pts.push([x, yy]);
  if (c === 2) pts.push([x + 1, y + 1]);
  return pts;
}

/** The running node on a rim: its head at `t` (0..1 around the rim, clockwise) and a tail behind it. */
export interface RimNode {
  /** Position of the head, 0..1 around the rim (wraps). */
  t: number;
  /** Head tone. */
  head: number;
  /** Tail tones right behind the head (counter-clockwise), brightest first. Default: none. */
  tail?: readonly number[];
}

export interface RimOpts {
  /** Corner cut 0..2 (default FRAME_V3.cut). */
  cut?: number;
  /** The running node (null / absent = a still rim). With REDUCED_MOTION the caller keeps t fixed (KO-9). */
  node?: RimNode | null;
}

/** A 1-px rim in `color` around (x, y, w, h), with an optional running node (KO-3). */
export function rimRect(p: PixelCanvas, x: number, y: number, w: number, h: number, color: number, opts: RimOpts = {}): PixelCanvas {
  const path = rimPath(x, y, w, h, opts.cut ?? FRAME_V3.cut);
  for (const [px, py] of path) p.set(px, py, color);
  const n = opts.node;
  if (n && path.length) {
    const L = path.length;
    const head = ((Math.floor((((n.t % 1) + 1) % 1) * L) % L) + L) % L;
    const tail = n.tail ?? [];
    for (let i = tail.length; i >= 1; i--) {
      const [tx, ty] = path[(head - i + L * 4) % L];
      p.set(tx, ty, tail[i - 1]);
    }
    const [hx, hy] = path[head];
    p.set(hx, hy, n.head);
  }
  return p;
}

// ================================================================ target corners

export interface BracketOpts {
  /** Leg length in px (default 4; §1.5: ≥ 4). */
  leg?: number;
  /** Push the corners out by this many px (the closing animation steps 4 → 0; negative = inside). */
  gap?: number;
  /** 1-px outline tone around each corner (default PAL.ink; null = none). */
  outline?: number | null;
  /** Tone of the corner pixel itself (default `color`): e.g. one white frame on lock. */
  joint?: number;
  /** Which corners (default all four). */
  corners?: readonly ('tl' | 'tr' | 'bl' | 'br')[];
}

/** The pixels of the four L corners around the box (x, y, w, h), pushed out by `gap`. */
export function bracketPixels(x: number, y: number, w: number, h: number, opts: BracketOpts = {}): { corner: Pt[]; leg: Pt[] } {
  const leg = Math.max(1, Math.round(opts.leg ?? 4));
  const g = Math.round(opts.gap ?? 0);
  const x0 = Math.round(x) - g;
  const y0 = Math.round(y) - g;
  const x1 = Math.round(x) + Math.round(w) - 1 + g;
  const y1 = Math.round(y) + Math.round(h) - 1 + g;
  const corner: Pt[] = [];
  const legs: Pt[] = [];
  for (const c of opts.corners ?? (['tl', 'tr', 'bl', 'br'] as const)) {
    const cx = c === 'tl' || c === 'bl' ? x0 : x1;
    const cy = c === 'tl' || c === 'tr' ? y0 : y1;
    const dx = c === 'tl' || c === 'bl' ? 1 : -1;
    const dy = c === 'tl' || c === 'tr' ? 1 : -1;
    corner.push([cx, cy]);
    for (let k = 1; k < leg; k++) {
      legs.push([cx + dx * k, cy]);
      legs.push([cx, cy + dy * k]);
    }
  }
  return { corner, leg: legs };
}

/** Four target corners ("nişan köşeleri", F4): gold3 by default callers, 1-px ink outline, legs ≥ 4. */
export function brackets(p: PixelCanvas, x: number, y: number, w: number, h: number, color: number, opts: BracketOpts = {}): PixelCanvas {
  const { corner, leg } = bracketPixels(x, y, w, h, opts);
  const all = [...corner, ...leg];
  const outline = opts.outline === undefined ? PAL.ink : opts.outline;
  if (outline !== null) {
    const own = new Set(all.map(([a, b]) => `${a},${b}`));
    for (const [a, b] of all)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          if (!own.has(`${a + dx},${b + dy}`)) p.set(a + dx, b + dy, outline);
        }
  }
  for (const [a, b] of leg) p.set(a, b, color);
  for (const [a, b] of corner) p.set(a, b, opts.joint ?? color);
  return p;
}

// ================================================================ plates

export interface PlateOpts extends FrameV3Opts {
  /**
   * Palette step of the plate while it appears / fades (KO: "two palette steps"): 0 = full (default),
   * −1 = trim one tone down and the body one band (night0 only), −2 = trim two tones down, body night0.
   */
  step?: number;
}

/** A plate (turn / battle / result plate, prompts): the FRAME_V3 body + trim, with appear steps. */
export function plateFrame(p: PixelCanvas, x: number, y: number, w: number, h: number, trim: TrimName | Trim, opts: PlateOpts = {}): PixelCanvas {
  const step = Math.max(-2, Math.min(0, Math.round(opts.step ?? 0)));
  const t: Trim = typeof trim === 'string' ? trimV3(trim, step) : step === 0 ? trim : stepTrim(trim, step);
  const bands = step === 0 ? opts.bands : ([PAL.night0, PAL.night0] as const);
  return frameRectV3(p, x, y, w, h, t, { ...opts, bands });
}

function stepTrim(t: Trim, step: number): Trim {
  const light = paletteSteps(t.light, -step, -1);
  const dark = paletteSteps(t.dark, -step, -1);
  return { light: light[light.length - 1] ?? t.light, dark: dark[dark.length - 1] ?? t.dark };
}

// ================================================================ reject stamp (F5)

const REJECT_X = ['X.....X', 'XX...XX', '.XX.XX.', '..XXX..', '.XX.XX.', 'XX...XX', 'X.....X'];

/**
 * The reject stamp: a 7×7 × centred on (cx, cy) in crimson with a 1-px ink contour (9×9 in all).
 * `tone` 0 = crim3 (default), 1 = crim2, 2 = crim1 (its two fade steps); `color` overrides.
 */
export function rejectStamp(p: PixelCanvas, cx: number, cy: number, opts: { tone?: number; color?: number; outline?: number | null } = {}): PixelCanvas {
  const tones = [PAL.crim3, PAL.crim2, PAL.crim1];
  const col = opts.color ?? tones[Math.max(0, Math.min(2, Math.round(opts.tone ?? 0)))];
  const x0 = Math.round(cx) - 3;
  const y0 = Math.round(cy) - 3;
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < 7 && y < 7 && REJECT_X[y][x] === 'X';
  const outline = opts.outline === undefined ? PAL.ink : opts.outline;
  if (outline !== null)
    for (let y = -1; y <= 7; y++)
      for (let x = -1; x <= 7; x++) {
        if (on(x, y)) continue;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) near = on(x + dx, y + dy);
        if (near) p.set(x0 + x, y0 + y, outline);
      }
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) if (on(x, y)) p.set(x0 + x, y0 + y, col);
  return p;
}

// ================================================================ contours

/**
 * A 1-px contour around the opaque pixels of `src`: a canvas 2 px larger each way (src sits at
 * (1, 1)), the contour in `color`, everything else transparent. 4-connected by default (the
 * classic sprite outline); `corners` adds the diagonal neighbours.
 */
export function contour(src: PixelCanvas, color: number, opts: { corners?: boolean } = {}): PixelCanvas {
  const out = new PixelCanvas(src.w + 2, src.h + 2);
  const op = (x: number, y: number) => src.isOpaque(x - 1, y - 1);
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++) {
      if (op(x, y)) continue;
      const hit = op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1) || (!!opts.corners && (op(x - 1, y - 1) || op(x + 1, y - 1) || op(x - 1, y + 1) || op(x + 1, y + 1)));
      if (hit) out.set(x, y, color);
    }
  return out;
}

/**
 * The 1-px contour of a sprite's CURRENT frame in world pixels ("contourOf(sprite)", K7 / F1 / F4):
 * `px` to draw with its top-left at (x, y), flipX respected. null when the sprite has no readable
 * frame, or is rotated / scaled off 1× (v3 never draws those: KO-1).
 */
export function contourOf(sprite: FrameSprite, color: number, opts: { corners?: boolean } = {}): { px: PixelCanvas; x: number; y: number } | null {
  if (sprite.rotation !== 0 || Math.abs(sprite.scaleX) !== 1 || Math.abs(sprite.scaleY) !== 1) return null;
  const frame = sprite.frame;
  if (!frame) return null;
  const data = frameRGBA(frame);
  if (!data) return null;
  const src = new PixelCanvas(frame.realWidth, frame.realHeight);
  if (data.length !== src.data.length) return null;
  src.data.set(data);
  if (!src.bounds()) return null;
  let px = contour(src, color, opts);
  if (sprite.flipX) px = px.flippedX();
  if (sprite.flipY) {
    const f = new PixelCanvas(px.w, px.h);
    f.blit(px, 0, 0, { flipY: true });
    px = f;
  }
  const left = Math.round(sprite.x - sprite.displayOriginX) - 1;
  const top = Math.round(sprite.y - sprite.displayOriginY) - 1;
  return { px, x: left, y: top };
}

let contourSeq = 0;

/**
 * Show a sprite's current-frame contour as an image (one texture per call). The caller destroys
 * the handle (its texture goes with it). null when contourOf gives nothing.
 */
export function showContour(scene: Phaser.Scene, sprite: FrameSprite, color: number, opts: { depth?: number; corners?: boolean } = {}): { img: Phaser.GameObjects.Image; destroy(): void } | null {
  const c = contourOf(sprite, color, opts);
  if (!c) return null;
  const key = `ui3:contour:${++contourSeq}`;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  // a static texture (no CanvasTexture read-back), like art/textures addStaticCanvas
  scene.textures.addImage(key, c.px.toCanvas() as unknown as HTMLImageElement);
  const img = scene.add.image(c.x, c.y, key).setOrigin(0, 0).setDepth(opts.depth ?? sprite.depth + 0.01);
  let alive = true;
  return {
    img,
    destroy() {
      if (!alive) return;
      alive = false;
      if (img.active) img.destroy();
      if (scene.textures.exists(key)) scene.textures.remove(key);
    },
  };
}

// ================================================================ palette steps

const STEP_RAMPS: readonly (readonly number[])[] = [
  [PAL.ink, ...RAMPS.night],
  [PAL.night3, PAL.night4, PAL.steel, PAL.mist, PAL.white],
  ...Object.values(RAMPS).filter((r) => r !== RAMPS.night),
];

/**
 * The next `n` tones of `color`'s ramp, one step each (dir −1 = darker, +1 = lighter), clamped at
 * the ramp's end: the stepped fades of the v3 UI (no alpha). A colour outside every ramp repeats.
 * Night tones step down to ink; steel / mist / white use the neutral ramp (night3 … white).
 */
export function paletteSteps(color: number, n: number, dir: -1 | 1 = -1): number[] {
  const k = Math.max(0, Math.round(n));
  const ramp = STEP_RAMPS.find((r) => r.includes(color));
  const out: number[] = [];
  if (!ramp) {
    for (let i = 0; i < k; i++) out.push(color);
    return out;
  }
  let i = ramp.indexOf(color);
  for (let s = 0; s < k; s++) {
    i = Math.max(0, Math.min(ramp.length - 1, i + dir));
    out.push(ramp[i]);
  }
  return out;
}

// ================================================================ stamped text

export interface StampTextOpts extends TextOpts {
  /** Scene ms per letter (default one frame, 1000 / 60). */
  msPerLetter?: number;
  /** Show everything at once (default: REDUCED_MOTION). */
  instant?: boolean;
}

/**
 * Text stamped one letter per frame ("kare başına harf"): a pixelText at whole pixels whose letters
 * appear in order on the scene clock (speed / hit-stop aware); the layout never moves while it
 * fills. `done` resolves when every letter is shown; `finish()` shows the rest at once.
 */
export function stampText(scene: Phaser.Scene, x: number, y: number, text: string, opts: StampTextOpts = {}): { text: Phaser.GameObjects.BitmapText; done: Promise<void>; finish(): void } {
  const t = pixelText(scene, Math.round(x), Math.round(y), text, opts);
  const total = revealText(t, 0);
  let finished = false;
  const finish = () => {
    finished = true;
    if (t.active) revealText(t, Infinity);
  };
  if (opts.instant ?? REDUCED_MOTION) {
    finish();
    return { text: t, done: Promise.resolve(), finish };
  }
  const per = Math.max(1, opts.msPerLetter ?? 1000 / 60);
  const done = scaledRun(scene, per * Math.max(1, total), (el) => {
    if (finished || !t.active) return;
    // (+1e-6: the QA clock's frame is one float step under 1000 / 60 — still one letter per frame)
    revealText(t, Math.min(total, Math.floor(el / per + 1e-6) + 1));
  }).then(() => {
    if (!finished) finish();
  });
  return { text: t, done, finish };
}

/**
 * fn(elapsed) on every scene update for `ms` of SCALED time (the scene's tween time scale: speed /
 * hit-stop, as vfx/setpieces run), once at once (elapsed 0); resolves after the last call. Stops
 * (resolves) on scene shutdown.
 */
function scaledRun(scene: Phaser.Scene, ms: number, fn: (el: number) => void): Promise<void> {
  return new Promise((resolve) => {
    let el = 0;
    let over = false;
    const stop = () => {
      if (over) return;
      over = true;
      scene.events.off('update', tick);
      scene.events.off('shutdown', stop);
      resolve();
    };
    const tick = (_t: number, delta: number) => {
      el += Math.min(50, delta) * scene.tweens.timeScale;
      fn(Math.min(el, ms));
      if (el >= ms - 1e-6) stop();
    };
    scene.events.on('update', tick);
    scene.events.once('shutdown', stop);
    fn(0);
    if (ms <= 0) stop();
  });
}
