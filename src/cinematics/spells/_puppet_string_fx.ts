// Kukla İpi (puppet_string) — the pixel pieces of its scenes (only this card uses them): the puppeteer's cross
// (big + the small one that hangs over the borrowed monster for the rest of the turn), the star hooks, the spiral
// glint, and the string layer (one full-screen raster the scene redraws every frame). Palette only, whole pixels,
// 1-px ink outlines on the wooden matter; light (strings, stars, the glint) is never outlined.

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { DEPTH, type XY } from '../../view/layout';
import { Raster } from '../../vfx/setpieces';

export const CROSS_KEY = 'e:puppet:cross2';
export const CROSS_MID_KEY = 'e:puppet:crossM';
export const CROSS_SMALL_KEY = 'e:puppet:crossS';
export const STAR_KEY = 'e:puppet:star2';
export const SPIRAL_KEY = 'e:puppet:spiral3';

/** Big cross: 43 × 23, origin = its heart knot (21, 7). */
export const CROSS_W = 43;
export const CROSS_H = 23;
export const CROSS_O = { x: 21, y: 7 } as const;
/** Big cross extent around the knot (for keeping it clear of the HUD): left, top, right, bottom. */
export const CROSS_EXT = { l: 21, t: 7, r: 21, b: 15 } as const;
/** Mid cross (the settle's in-between frame): 25 × 14, origin (12, 4). */
export const CROSS_M_O = { x: 12, y: 4 } as const;
/**
 * The five hook eyes, relative to the knot (big cross), in string order:
 * left hand bar end, left foot bar end, the head (bottom of the upright), right foot, right hand.
 */
export const CROSS_HOOKS: readonly XY[] = [
  { x: -20, y: 3 },
  { x: -11, y: 10 },
  { x: 0, y: 14 },
  { x: 11, y: 10 },
  { x: 20, y: 3 },
];
/** Small cross: 13 × 9, origin (6, 3); its one string leaves from (0, 5). */
export const CROSS_S_O = { x: 6, y: 3 } as const;
/** Small cross extent around its origin. */
export const CROSS_S_EXT = { l: 6, t: 3, r: 6, b: 6 } as const;

/**
 * The big cross: a dark-gold wooden marionette control — a knobbed upright, a long hand bar with round caps, a
 * foot bar, and a 5 × 4 heart knot carved at the crossing. Flat tone bands (lit top / mid / shadow), ink outline.
 */
function paintCross(): PixelCanvas {
  const p = new PixelCanvas(CROSS_W, CROSS_H);
  const ox = CROSS_O.x;
  // the upright (3 wide): lit left, mid, shadow right
  for (let y = 3; y <= 20; y++) {
    p.set(ox - 1, y, PAL.gold3);
    p.set(ox, y, PAL.gold2);
    p.set(ox + 1, y, PAL.gold1);
  }
  // the knob on top (5 wide, 2 rows)
  p.hline(ox - 1, ox + 1, 1, PAL.gold4);
  p.set(ox - 2, 2, PAL.gold3);
  p.hline(ox - 1, ox, 2, PAL.gold3);
  p.set(ox + 1, 2, PAL.gold2);
  p.set(ox + 2, 2, PAL.gold1);
  // hand bar (3 rows), x 2 .. 40, round caps (5 tall) at both ends
  p.hline(2, 40, 6, PAL.gold3);
  p.hline(2, 40, 7, PAL.gold2);
  p.hline(2, 40, 8, PAL.gold1);
  for (const x of [1, 41]) {
    p.set(x, 5, PAL.gold4);
    p.set(x, 6, PAL.gold3);
    p.set(x, 7, PAL.gold2);
    p.set(x, 8, PAL.gold1);
    p.set(x, 9, PAL.gold1);
  }
  p.set(2, 5, PAL.gold3);
  p.set(40, 5, PAL.gold3);
  p.set(2, 9, PAL.gold0);
  p.set(40, 9, PAL.gold0);
  // foot bar (2 rows), x 11 .. 31, caps (4 tall)
  p.hline(11, 31, 14, PAL.gold2);
  p.hline(11, 31, 15, PAL.gold1);
  for (const x of [10, 32]) {
    p.set(x, 13, PAL.gold3);
    p.set(x, 14, PAL.gold2);
    p.set(x, 15, PAL.gold1);
    p.set(x, 16, PAL.gold0);
  }
  // wood grain: one darker tick per bar segment (flat bands, no noise)
  for (const x of [7, 13, 29, 35]) p.set(x, 7, PAL.gold1);
  for (const x of [15, 27]) p.set(x, 15, PAL.gold0);
  p.set(ox + 1, 12, PAL.gold0);
  // the heart knot over the crossing (fire ramp: the one warm accent), 5 × 4
  const heart = ['.#.#.', '#####', '.###.', '..#..'];
  heart.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && p.set(ox - 2 + x, 5 + y, PAL.fire2)));
  p.set(ox - 1, 5, PAL.fire4);
  p.set(ox - 2, 6, PAL.fire3);
  p.set(ox - 1, 6, PAL.fire3);
  p.set(ox + 1, 7, PAL.fire1);
  p.set(ox, 8, PAL.fire1);
  p.outline(PAL.ink, { corners: false });
  // the hook eyes (light, on top of the outline)
  for (const h of CROSS_HOOKS) p.set(ox + h.x, CROSS_O.y + h.y, PAL.gold4);
  return p;
}

/** The mid cross (the settle shrinks big → mid → small): 25 × 14. */
function paintCrossMid(): PixelCanvas {
  const p = new PixelCanvas(25, 14);
  const ox = CROSS_M_O.x;
  for (let y = 1; y <= 12; y++) {
    p.set(ox, y, PAL.gold2);
    p.set(ox + 1, y, PAL.gold1);
  }
  p.hline(ox, ox + 1, 1, PAL.gold4);
  p.hline(1, 23, 4, PAL.gold3);
  p.hline(1, 23, 5, PAL.gold1);
  p.hline(6, 18, 9, PAL.gold2);
  p.set(ox - 1, 4, PAL.fire3);
  p.set(ox, 4, PAL.fire4);
  p.set(ox + 1, 4, PAL.fire3);
  p.set(ox, 5, PAL.fire2);
  p.outline(PAL.ink, { corners: false });
  return p;
}

/** The small cross that hangs over the borrowed monster: 13 × 9. */
function paintCrossSmall(): PixelCanvas {
  const p = new PixelCanvas(13, 9);
  const ox = CROSS_S_O.x;
  for (let y = 1; y <= 7; y++) {
    p.set(ox, y, PAL.gold2);
  }
  p.set(ox, 1, PAL.gold4);
  p.hline(1, 11, 3, PAL.gold3);
  p.hline(1, 11, 4, PAL.gold1);
  p.set(ox, 3, PAL.fire3);
  p.set(ox, 4, PAL.fire2);
  p.outline(PAL.ink, { corners: false });
  p.set(ox, 8, PAL.gold4);
  return p;
}

/** Star hook frames: 's' a 7 × 7 four-point star (gold3 body, gold4 core, white heart), 'f' its 9 × 9 bite flash, 't' tiny 3 × 3. */
function paintStars(): PixelCanvas {
  const p = new PixelCanvas(23, 9);
  const key = (ch: string) => (ch === 'W' ? PAL.white : ch === 'c' ? PAL.gold4 : ch === 'b' ? PAL.gold3 : PAL.gold2);
  const s = ['...a...', '...b...', '..bcb..', 'abcWcba', '..bcb..', '...b...', '...a...'];
  s.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && p.set(1 + x, 1 + y, key(ch))));
  const f = ['....c....', '....b....', '...bcb...', '..bcWcb..', 'cbcWWWcbc', '..bcWcb..', '...bcb...', '....b....', '....c....'];
  f.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && p.set(9 + x, y, key(ch))));
  const t = ['.b.', 'bcb', '.b.'];
  t.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && p.set(19 + x, 3 + y, key(ch))));
  return p;
}

/**
 * Spiral glint, one per eye: 4 frames of a 3 × 3 turning arc around a white pupil (teal4 head, teal3 / teal2
 * tail), plus 'fl' — the first-frame flash (a 5 × 5 teal4 star).
 */
function paintSpirals(): PixelCanvas {
  const ring: [number, number][] = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]];
  const p = new PixelCanvas(17, 5);
  for (let f = 0; f < 4; f++) {
    const ox = f * 3;
    p.set(ox + 1, 1 + 1, PAL.white);
    const head = f * 2;
    const cols = [PAL.teal4, PAL.teal3, PAL.teal3, PAL.teal2];
    cols.forEach((c, k) => {
      const [x, y] = ring[(head - k + 8) % 8];
      p.set(ox + x, 1 + y, c);
    });
  }
  const fl = ['..a..', '.aWa.', 'aWWWa', '.aWa.', '..a..'];
  fl.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && p.set(12 + x, y, ch === 'W' ? PAL.white : PAL.teal4)));
  return p;
}

/** Create the textures once per scene. */
export function puppetTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(CROSS_KEY)) scene.textures.addCanvas(CROSS_KEY, paintCross().toCanvas());
  if (!scene.textures.exists(CROSS_MID_KEY)) scene.textures.addCanvas(CROSS_MID_KEY, paintCrossMid().toCanvas());
  if (!scene.textures.exists(CROSS_SMALL_KEY)) scene.textures.addCanvas(CROSS_SMALL_KEY, paintCrossSmall().toCanvas());
  if (!scene.textures.exists(STAR_KEY)) {
    const t = scene.textures.addCanvas(STAR_KEY, paintStars().toCanvas())!;
    t.add('s', 0, 1, 1, 7, 7);
    t.add('f', 0, 9, 0, 9, 9);
    t.add('t', 0, 19, 3, 3, 3);
  }
  if (!scene.textures.exists(SPIRAL_KEY)) {
    const t = scene.textures.addCanvas(SPIRAL_KEY, paintSpirals().toCanvas())!;
    for (let f = 0; f < 4; f++) t.add(`f${f}`, 0, f * 3, 1, 3, 3);
    t.add('fl', 0, 12, 0, 5, 5);
  }
}

// ================================================================ strings

export interface StringSpec {
  /** Top (the cross hook) and bottom (the limb) in world px. */
  a: XY;
  b: XY;
  /** 0..1: how far the string has dropped from `a`. */
  drop: number;
  /** Sideways slack (px at the middle; signed). */
  sag: number;
  /** Pluck vibration: ms left (alternates ±1 px every frame while > 0). */
  buzz: number;
  /** A bright bead running down (0..1, < 0 = none). */
  bead: number;
  /** Cut: the string is broken at this fraction (null: whole). */
  cut: number | null;
  /** Broken: the upper piece retracts (0..1 of it gone), the lower piece falls (px). */
  up: number;
  fall: number;
  /** Visibility 0..1 (stepped: < 0.5 draws the darker tone). */
  level: number;
  /** Whether a star hook shows at the limb. */
  star: boolean;
}

export function newString(a: XY, b: XY): StringSpec {
  return { a, b, drop: 0, sag: 0, buzz: 0, bead: -1, cut: null, up: 0, fall: 0, level: 1, star: false };
}

/** A full-screen raster for the strings (over the units). */
export function stringLayer(scene: Phaser.Scene): Raster {
  return new Raster(scene, 0, 0, 640, 360, DEPTH.FX + 6);
}

function pt(s: StringSpec, t: number, frame: number): XY {
  const x0 = s.a.x;
  const y0 = s.a.y;
  const x1 = s.b.x;
  const y1 = s.b.y;
  const bow = Math.sin(Math.PI * t) * s.sag + (s.buzz > 0 ? (frame % 2 ? 1 : -1) * Math.sin(Math.PI * t) : 0);
  return { x: Math.round(x0 + (x1 - x0) * t + bow), y: Math.round(y0 + (y1 - y0) * t) };
}

/** Draw one string into the raster (call inside raster.draw). */
export function drawString(r: Raster, s: StringSpec, frame: number): void {
  if (s.level <= 0.05) return;
  const main = s.level < 0.5 ? PAL.gold2 : PAL.gold3;
  const hi = s.level < 0.5 ? PAL.gold3 : PAL.gold4;
  const len = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
  const n = Math.max(2, Math.ceil(len / 3));
  const line = (t0: number, t1: number, dy = 0) => {
    let prev = pt(s, t0, frame);
    const k0 = Math.floor(t0 * n);
    const k1 = Math.ceil(t1 * n);
    for (let k = k0 + 1; k <= k1; k++) {
      const p = pt(s, Math.min(t1, k / n), frame);
      r.line(prev.x, prev.y + dy, p.x, p.y + dy, main);
      // a gold4 glint every 4th sample (the light running in the thread), fixed to the string, not the frame
      if (k % 4 === 0) r.px(p.x, p.y + dy, hi);
      prev = p;
    }
  };
  if (s.cut === null) {
    if (s.drop <= 0) return;
    line(0, s.drop);
    const head = pt(s, s.drop, frame);
    if (s.drop < 1) {
      // the falling tip: a white pixel and a gold3 one above it
      r.px(head.x, head.y, PAL.white);
    }
    if (s.bead >= 0 && s.bead <= s.drop) {
      const b = pt(s, s.bead, frame);
      r.px(b.x, b.y, PAL.white);
      r.px(b.x, b.y - 1, PAL.gold4);
    }
    return;
  }
  // broken: the upper piece pulls back up to the cross, the lower one drops away (stepped)
  const c = s.cut;
  const upTo = c * (1 - s.up);
  if (upTo > 0.01) line(0, upTo);
  if (s.fall < 40) {
    const lower0 = c + (1 - c) * Math.min(0.8, s.fall / 50);
    let prev = pt(s, lower0, frame);
    const m = 6;
    for (let k = 1; k <= m; k++) {
      const t = lower0 + ((1 - lower0) * k) / m;
      const p = pt(s, t, frame);
      // the loose end curls: every other segment kinks sideways as it falls
      const kink = s.fall > 3 ? (k % 2 ? 1 : -1) * Math.min(2, Math.floor(s.fall / 6)) : 0;
      r.line(prev.x, prev.y + s.fall, p.x + kink, p.y + s.fall, s.fall > 18 ? PAL.gold2 : PAL.gold3);
      prev = { x: p.x + kink, y: p.y };
    }
  }
}
