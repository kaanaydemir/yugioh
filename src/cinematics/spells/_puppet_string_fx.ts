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
export const SPIRAL_KEY = 'e:puppet:spiral4';
/** The cross reveal (the orb unspools into the cross): frames 'r0' 'r1' 'r2' of a hot, un-outlined cross. */
export const CROSS_REVEAL_KEY = 'e:puppet:crossR';

/** Big cross: 43 × 23, origin = its heart knot (21, 7). */
export const CROSS_W = 43;
export const CROSS_H = 23;
export const CROSS_O = { x: 21, y: 7 } as const;
/** Big cross extent around the knot (for keeping it clear of the HUD): left, top, right, bottom. */
export const CROSS_EXT = { l: 21, t: 7, r: 21, b: 15 } as const;
/**
 * The take's cross extent (HUD clearance): the cross appears POP_DY px over its hanging spot and drops into it,
 * and its knot glint reaches 4 px over the top of the knob — both stay inside this.
 */
export const CROSS_POP_DY = 6;
export const CROSS_POP_EXT = { l: 22, t: 7 + CROSS_POP_DY + 4, r: 22, b: 15 } as const;
/** The hop's cross extent: the cross jerks 6 px up on every yank. */
export const CROSS_HOP_EXT = { l: 21, t: 7 + 6, r: 21, b: 15 } as const;
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
function paintCrossBase(): PixelCanvas {
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
  return p;
}

function paintCross(): PixelCanvas {
  const p = paintCrossBase();
  p.outline(PAL.ink, { corners: false });
  // the hook eyes (light, on top of the outline)
  for (const h of CROSS_HOOKS) p.set(CROSS_O.x + h.x, CROSS_O.y + h.y, PAL.gold4);
  return p;
}

/**
 * The reveal: the orb unspools into the cross in three hot frames before the inked wood (frame 3 = CROSS_KEY).
 *   r0  the core: the heart knot white-hot (gold4 / fire4) and the upright's first 2 px each way (|dx| ≤ 2, |dy| ≤ 3)
 *   r1  the bars grow out stepwise: |dx| ≤ 10, all of the upright, everything glowing gold4 / gold3
 *   r2  full length, still hot and un-outlined (gold4 lit band, gold3 body, gold2 shadow; the heart fire3 / fire4)
 * Packed side by side, each CROSS_W × CROSS_H, same origin as the big cross.
 */
function paintCrossReveal(): PixelCanvas {
  const base = paintCrossBase();
  const out = new PixelCanvas(CROSS_W * 3, CROSS_H);
  const hot: Record<number, readonly [number, number, number]> = {
    [PAL.gold0]: [PAL.gold3, PAL.gold3, PAL.gold2],
    [PAL.gold1]: [PAL.gold3, PAL.gold3, PAL.gold2],
    [PAL.gold2]: [PAL.gold4, PAL.gold4, PAL.gold3],
    [PAL.gold3]: [PAL.gold4, PAL.gold4, PAL.gold4],
    [PAL.gold4]: [PAL.white, PAL.gold4, PAL.gold4],
    [PAL.fire1]: [PAL.fire4, PAL.fire3, PAL.fire2],
    [PAL.fire2]: [PAL.fire4, PAL.fire4, PAL.fire3],
    [PAL.fire3]: [PAL.fire4, PAL.fire4, PAL.fire3],
    [PAL.fire4]: [PAL.white, PAL.fire4, PAL.fire4],
  };
  const reach = [
    (dx: number, dy: number) => Math.abs(dx) <= 2 && Math.abs(dy) <= 3,
    (dx: number) => Math.abs(dx) <= 10,
    () => true,
  ];
  for (let f = 0; f < 3; f++)
    for (let y = 0; y < CROSS_H; y++)
      for (let x = 0; x < CROSS_W; x++) {
        const c = base.get(x, y);
        if (c === null || !reach[f](x - CROSS_O.x, y - CROSS_O.y)) continue;
        out.set(f * CROSS_W + x, y, (hot[c] ?? [PAL.gold4, PAL.gold4, PAL.gold3])[f]);
      }
  return out;
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

/** The spiral glint: 7 × 7, frame 0 (rotated a quarter per frame for f1..f3). k ink (ring + the gaps), a teal4 core, b teal3, c teal2 tail. */
export const SPIRAL_SIZE = 7;
const SPIRAL0 = ['..kkk..', '.kbbbk.', 'kckkkbk', 'kckakak', 'kckaaak', '.kckkk.', '..kkk..'];

/** Spiral glint: 4 frames of a hand-pixelled 7 × 7 spiral turning a quarter per frame (no white core: not a star). */
function paintSpirals(): PixelCanvas {
  const S = SPIRAL_SIZE;
  const p = new PixelCanvas(S * 4, S);
  const col = (ch: string) => (ch === 'k' ? PAL.ink : ch === 'a' ? PAL.teal4 : ch === 'b' ? PAL.teal3 : ch === 'c' ? PAL.teal2 : null);
  for (let f = 0; f < 4; f++)
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        // rotate clockwise f quarters: (x, y) of frame f reads (y, S-1-x) of frame f-1
        let sx = x;
        let sy = y;
        for (let k = 0; k < f; k++) {
          const nx = sy;
          sy = S - 1 - sx;
          sx = nx;
        }
        const c = col(SPIRAL0[sy][sx]);
        if (c !== null) p.set(f * S + x, y, c);
      }
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
    for (let f = 0; f < 4; f++) t.add(`f${f}`, 0, f * SPIRAL_SIZE, 0, SPIRAL_SIZE, SPIRAL_SIZE);
  }
  if (!scene.textures.exists(CROSS_REVEAL_KEY)) {
    const t = scene.textures.addCanvas(CROSS_REVEAL_KEY, paintCrossReveal().toCanvas())!;
    for (let f = 0; f < 3; f++) t.add(`r${f}`, 0, f * CROSS_W, 0, CROSS_W, CROSS_H);
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

// ================================================================ occlusion (other units vs the strings)

/** Another unit's silhouette the strings pass: `front` units hide them, units behind dim them. */
export interface Occluder {
  top: number;
  bottom: number;
  spanAt(y: number): [number, number] | null;
  front: boolean;
}

/** Does a front occluder cover world pixel (x, y)? */
export function covered(occ: readonly Occluder[], x: number, y: number): boolean {
  for (const o of occ) {
    if (!o.front || y < o.top || y >= o.bottom) continue;
    const sp = o.spanAt(y + 0.5);
    if (sp && x >= sp[0] && x < sp[1]) return true;
  }
  return false;
}

/**
 * After the strings are drawn: a unit standing in front of the puppet hides the string pixels over its
 * silhouette (cut out); a unit behind it dims them to gold1 (the thread visibly passes in front of it, but never
 * reads as hooking it). Row spans of the silhouette (spriteBox.spanAt), whole pixels.
 */
export function occludeStrings(r: Raster, occ: readonly Occluder[]): void {
  const d = r.pc.data;
  const W = r.w;
  const dim = PAL.gold1;
  const dr = (dim >> 16) & 255;
  const dg = (dim >> 8) & 255;
  const db = dim & 255;
  for (const o of occ) {
    const y0 = Math.max(r.y, Math.ceil(o.top));
    const y1 = Math.min(r.y + r.h, Math.floor(o.bottom));
    for (let y = y0; y < y1; y++) {
      const sp = o.spanAt(y + 0.5);
      if (!sp) continue;
      const x0 = Math.max(r.x, Math.ceil(sp[0]));
      const x1 = Math.min(r.x + W, Math.floor(sp[1]));
      for (let x = x0; x < x1; x++) {
        const i = ((y - r.y) * W + (x - r.x)) * 4;
        if (d[i + 3] === 0) continue;
        if (o.front) d[i + 3] = 0;
        else {
          d[i] = dr;
          d[i + 1] = dg;
          d[i + 2] = db;
        }
      }
    }
  }
}
