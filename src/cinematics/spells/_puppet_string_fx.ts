// Kukla İpi (puppet_string) — the pixel pieces of its scenes (only this card uses them): the puppeteer's cross
// (big + the small one that hangs over the borrowed monster for the rest of the turn), the star hooks, the spiral
// glint, and the string layer (one full-screen raster the scene redraws every frame). Palette only, whole pixels,
// 1-px ink outlines on the wooden matter; light (strings, stars, the glint) is never outlined.

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { DEPTH, type XY } from '../../view/layout';
import { Raster } from '../../vfx/setpieces';

export const CROSS_KEY = 'e:puppet:cross';
export const CROSS_SMALL_KEY = 'e:puppet:crossS';
export const STAR_KEY = 'e:puppet:star';
export const SPIRAL_KEY = 'e:puppet:spiral';

/** Big cross: 35 × 19, origin = its heart knot (17, 7). */
export const CROSS_W = 35;
export const CROSS_H = 19;
export const CROSS_O = { x: 17, y: 7 } as const;
/**
 * The five hook eyes, relative to the knot (big cross), in string order:
 * left hand bar end, left foot bar end, the head (bottom of the upright), right foot, right hand.
 */
export const CROSS_HOOKS: readonly XY[] = [
  { x: -16, y: 2 },
  { x: -8, y: 8 },
  { x: 0, y: 11 },
  { x: 8, y: 8 },
  { x: 16, y: 2 },
];
/** Small cross: 13 × 9, origin (6, 3); its one string leaves from (0, 5). */
export const CROSS_S_O = { x: 6, y: 3 } as const;

/** The big cross: a dark gold wooden marionette control — hand bar, upright with a knob, foot bar, a heart knot. */
function paintCross(): PixelCanvas {
  const p = new PixelCanvas(CROSS_W, CROSS_H);
  const ox = CROSS_O.x;
  // the upright (3 wide): lit left, mid, shadow right; knob on top
  for (let y = 0; y <= 17; y++) {
    p.set(ox - 1, y, PAL.gold3);
    p.set(ox, y, PAL.gold2);
    p.set(ox + 1, y, PAL.gold1);
  }
  p.hline(ox - 1, ox + 1, 0, PAL.gold4);
  // hand bar (3 rows), from x 1 to 33
  p.hline(1, 33, 5, PAL.gold3);
  p.hline(1, 33, 6, PAL.gold2);
  p.hline(1, 33, 7, PAL.gold1);
  p.set(1, 5, PAL.gold4);
  // the bar ends: little rounded caps, a ring eye under each
  for (const x of [1, 33]) {
    p.set(x, 8, PAL.gold0);
  }
  // foot bar (2 rows), x 8 .. 26
  p.hline(9, 25, 13, PAL.gold2);
  p.hline(9, 25, 14, PAL.gold1);
  p.set(9, 13, PAL.gold3);
  // wood grain: one darker tick per bar segment (flat bands, no noise)
  for (const x of [6, 12, 22, 28]) p.set(x, 6, PAL.gold1);
  for (const x of [13, 21]) p.set(x, 14, PAL.gold0);
  // the heart knot over the crossing (fire ramp: the one warm accent)
  const heart = ['.#.#.', '#####', '.###.', '..#..'];
  heart.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && p.set(ox - 2 + x, 4 + y, PAL.fire2)));
  p.set(ox - 1, 4, PAL.fire4);
  p.set(ox - 2, 5, PAL.fire3);
  p.set(ox - 1, 5, PAL.fire3);
  p.outline(PAL.ink, { corners: false });
  // the hook eyes (light, on top of the outline): gold4 rings under the bar ends, the foot bar ends, the upright
  for (const h of CROSS_HOOKS) p.set(ox + h.x, CROSS_O.y + h.y, PAL.gold4);
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

/** Star hook frames: 0 small (5 × 5), 1 flash (7 × 7), 2 tiny (3 × 3). */
function paintStars(): PixelCanvas {
  const p = new PixelCanvas(21, 7);
  // small: a four-point star, white heart
  const s = ['..#..', '..#..', '##W##', '..#..', '..#..'];
  s.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && p.set(1 + x, 1 + y, ch === 'W' ? PAL.white : PAL.gold4)));
  // flash
  const f = ['...#...', '...#...', '..#W#..', '##WWW##', '..#W#..', '...#...', '...#...'];
  f.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && p.set(7 + x, y, ch === 'W' ? PAL.white : PAL.gold3)));
  // tiny
  const t = ['.#.', '#W#', '.#.'];
  t.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && p.set(15 + x, 2 + y, ch === 'W' ? PAL.white : PAL.gold4)));
  return p;
}

/** Spiral glint: 4 rotations of a 5 × 5 spiral (teal light, white heart). */
function paintSpirals(): PixelCanvas {
  const base = ['.###.', '#...#', '#.W.#', '#..#.', '.##..'];
  const p = new PixelCanvas(20, 5);
  for (let f = 0; f < 4; f++) {
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 5; x++) {
        // rotate (x, y) by f × 90°
        let sx = x;
        let sy = y;
        for (let k = 0; k < f; k++) {
          const nx = sy;
          const ny = 4 - sx;
          sx = nx;
          sy = ny;
        }
        const ch = base[sy][sx];
        if (ch === '#') p.set(f * 5 + x, y, PAL.teal4);
        else if (ch === 'W') p.set(f * 5 + x, y, PAL.white);
      }
  }
  return p;
}

/** Create the textures once per scene. */
export function puppetTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(CROSS_KEY)) scene.textures.addCanvas(CROSS_KEY, paintCross().toCanvas());
  if (!scene.textures.exists(CROSS_SMALL_KEY)) scene.textures.addCanvas(CROSS_SMALL_KEY, paintCrossSmall().toCanvas());
  if (!scene.textures.exists(STAR_KEY)) {
    const t = scene.textures.addCanvas(STAR_KEY, paintStars().toCanvas())!;
    t.add('s', 0, 1, 1, 5, 5);
    t.add('f', 0, 7, 0, 7, 7);
    t.add('t', 0, 15, 2, 3, 3);
  }
  if (!scene.textures.exists(SPIRAL_KEY)) {
    const t = scene.textures.addCanvas(SPIRAL_KEY, paintSpirals().toCanvas())!;
    for (let f = 0; f < 4; f++) t.add(`f${f}`, 0, f * 5, 0, 5, 5);
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
  const main = s.level < 0.5 ? PAL.gold2 : PAL.gold4;
  const len = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
  const n = Math.max(2, Math.ceil(len / 3));
  const line = (t0: number, t1: number, dy = 0) => {
    let prev = pt(s, t0, frame);
    const k0 = Math.floor(t0 * n);
    const k1 = Math.ceil(t1 * n);
    for (let k = k0 + 1; k <= k1; k++) {
      const p = pt(s, Math.min(t1, k / n), frame);
      r.line(prev.x, prev.y + dy, p.x, p.y + dy, main);
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
