// Neon Tower painter: screens — owner B2 (docs/v3/ARENA_NEON_TOWER.md §2 / §5 / §6 / §10; J3: ANGLED screens, a thick lit bezel,
// visible raster lines). The two portrait screens hang on the back wall (layout-nt SCREENS, 92 × 79 including the shear): the
// left one is the player's (blue), the right one the opponent's (crimson). Pure PixelCanvas code (no Phaser): runs in Node for
// tests and tools.
//
// ANGLE: the screens are not flat rectangles. Both are panels hung parallel to the platform's far edges, so each is sheared in
// whole-pixel steps: ONE pixel of height per SHEAR (6) columns — the left screen's inner (right) edge is the high one, the right
// screen's inner (left) edge too (a "V" opening to the board). Every piece below (bezel, picture, lit copy, patches, name plate) is
// painted flat and then moved column by column with the same `dyAt`, so they stay registered; the bezel is painted directly in
// the sheared space. The left screen's lower inner corner is also cut along the platform's upper-left edge (y = 194 − x/2), so it
// never sits under the plate.
//
// What is baked (one atlas, `nt:screens`, ≈ 0.2 MB):
//   frame:<who>:<0|1>      the bezel: ink rim, two metal tones, a lit top / left edge, a 1-px neon line round the window, corner
//                          screws, a status-LED row; 0 = dim neon, 1 = bright neon. The window stays transparent.
//   pic:<who>              the 80 × 56 portrait (portraits.ts) with a raster line every 3rd row (one tone down), sheared.
//   lit:<who>              the same picture one tone brighter in every pixel (a sweep / flicker / flash shows it through a crop).
//   ov:<who>:<kind>        small replacement patches (blink, hurt, glad, hair sway −1 / +1), sheared; `at` says where each sits.
//   scan:<who>             one sheared scan line (a dithered 1-px lit row, a dim row under it) that rolls down the picture.
// Everything is flat tone bands, opaque or fully transparent: no alpha anywhere.

import { PAL, RAMPS } from '../palette';
import { PixelCanvas } from '../pixel';
import { PORTRAIT_H, PORTRAIT_W, type PortraitMood, paintPortrait } from './portraits';
import { type AtlasRect, type NtAtlas, packAtlas } from './wall-kit';

/** Texture key of this layer's atlas / sheet (frames named inside). */
export const NT_SCREENS_KEY = 'nt:screens';

/** Bezel: 6 px left / right, 4 px top / bottom around the 80 × 56 window. */
export const FRAME_W = 92;
export const FLAT_H = 64;
/** One pixel of height per this many columns. */
export const SHEAR = 6;
/** Rows the shear adds to the frame (the whole sheared frame is FRAME_H rows high). */
export const SHEAR_ROWS = Math.floor((FRAME_W - 1) / SHEAR);
export const FRAME_H = FLAT_H + SHEAR_ROWS;
/** Where the picture sits inside the (flat) frame. */
export const PIC_AT = { x: 6, y: 4 } as const;
/** Where the screens hang (the layout-nt SCREENS rects: tests keep them equal). */
export const SCREEN_AT: readonly { x: number; y: number }[] = [
  { x: 148, y: 22 },
  { x: 396, y: 22 },
];
/** The platform's upper-left edge the left screen is cut along (screen y = PLATE_CUT_A − x / 2). */
export const PLATE_CUT_A = 194;

type Pt = readonly [number, number];

// ------------------------------------------------------------------------------------------ tone steps

/** Brighter / darker neighbour of a palette colour inside its ramp (the shared dark → light chains). */
const CHAINS: readonly (readonly number[])[] = [
  [PAL.ink, PAL.night0, PAL.night1, PAL.night2, PAL.night3, PAL.night4, PAL.steel, PAL.mist, PAL.white],
  [...RAMPS.cyan, PAL.white],
  [...RAMPS.crim, PAL.white],
  [...RAMPS.earth, PAL.skin4],
  [...RAMPS.skin],
  [...RAMPS.water, PAL.white],
  [...RAMPS.void, PAL.white],
];
const UP = new Map<number, number>();
const DOWN = new Map<number, number>();
for (const chain of CHAINS)
  for (let i = 0; i < chain.length; i++) {
    if (!UP.has(chain[i])) UP.set(chain[i], chain[Math.min(chain.length - 1, i + 1)]);
    if (!DOWN.has(chain[i])) DOWN.set(chain[i], chain[Math.max(0, i - 1)]);
  }

export const toneUp = (c: number): number => UP.get(c) ?? c;
export const toneDown = (c: number): number => DOWN.get(c) ?? c;

// ------------------------------------------------------------------------------------------ the shear

/** Rows a column x (flat frame space) is lowered by: the left screen's outer (left) side is low, the right screen's outer (right) side. */
export function dyAt(who: 0 | 1, x: number): number {
  return who === 0 ? Math.floor((FRAME_W - 1 - x) / SHEAR) : Math.floor(x / SHEAR);
}

/** A flat piece (top-left at (ox, oy) of the flat frame) moved column by column; `x` / `y` = its top-left in the sheared frame. */
export interface Sheared {
  canvas: PixelCanvas;
  x: number;
  y: number;
}
export function shearPiece(c: PixelCanvas, who: 0 | 1, ox: number, oy: number): Sheared {
  let mn = Infinity;
  let mx = -Infinity;
  for (let i = 0; i < c.w; i++) {
    const d = dyAt(who, ox + i);
    mn = Math.min(mn, d);
    mx = Math.max(mx, d);
  }
  const out = new PixelCanvas(c.w, c.h + (mx - mn));
  for (let i = 0; i < c.w; i++) {
    const d = dyAt(who, ox + i) - mn;
    for (let j = 0; j < c.h; j++) if (c.isOpaque(i, j)) out.set(i, j + d, c.get(i, j)!);
  }
  return { canvas: out, x: ox, y: oy + mn };
}

/** The platform cut of the left screen: the lowest frame row (sheared frame space) allowed at column x, or Infinity (right screen). */
function cutRow(who: 0 | 1, x: number): number {
  if (who === 1) return Infinity;
  return Math.floor(PLATE_CUT_A - (SCREEN_AT[0].x + x) / 2) - SCREEN_AT[0].y;
}

/** Last row of the bezel at column x (sheared frame space): the sheared bottom, cut along the platform for the left screen. */
function bottomRow(who: 0 | 1, x: number): number {
  return Math.min(dyAt(who, x) + FLAT_H - 1, cutRow(who, x));
}

/** Fill the sheared bezel shape inset by (ix, iy). */
function fillShape(c: PixelCanvas, who: 0 | 1, ix: number, iy: number, col: number): void {
  for (let x = ix; x <= FRAME_W - 1 - ix; x++) {
    const y0 = dyAt(who, x) + iy;
    const y1 = bottomRow(who, x) - iy;
    if (y1 >= y0) c.vline(x, y0, y1, col);
  }
}

/** Mask of the picture window (sheared frame space): the inner shape inset by (PIC_AT.x, PIC_AT.y). */
function windowMask(who: 0 | 1): Uint8Array {
  const out = new Uint8Array(FRAME_W * FRAME_H);
  for (let x = PIC_AT.x; x <= FRAME_W - 1 - PIC_AT.x; x++) {
    const y0 = dyAt(who, x) + PIC_AT.y;
    const y1 = bottomRow(who, x) - PIC_AT.y;
    for (let y = y0; y <= y1; y++) out[y * FRAME_W + x] = 1;
  }
  return out;
}
const WINDOW: [Uint8Array, Uint8Array] = [windowMask(0), windowMask(1)];

// ------------------------------------------------------------------------------------------ the frame

/**
 * The bezel round a screen. Metal is the arena's night ramp, lit from the top-left; the 1-px neon line round the window is the
 * only bright thing (dim: tone 1 of the player's ramp; bright: tone 3 + white glints). `bright` also lifts the metal one tone.
 */
export function paintFrame(who: 0 | 1, bright: boolean): PixelCanvas {
  const R = who === 0 ? RAMPS.cyan : RAMPS.crim;
  const neon = bright ? R[3] : R[1];
  const c = new PixelCanvas(FRAME_W, FRAME_H);
  const metal = bright ? [PAL.night2, PAL.night3, PAL.night4, PAL.steel] : [PAL.night1, PAL.night2, PAL.night3, PAL.night4];
  // rings, outer → inner (the side margins are 6 wide, top / bottom 4)
  fillShape(c, who, 0, 0, PAL.ink);
  fillShape(c, who, 1, 1, metal[0]);
  fillShape(c, who, 2, 1, metal[1]);
  fillShape(c, who, 3, 2, metal[0]);
  fillShape(c, who, 4, 2, PAL.night0);
  fillShape(c, who, 5, 3, neon);
  fillShape(c, who, PIC_AT.x, PIC_AT.y, PAL.ink);
  // the lit edge: the top rim and the outer-left (left screen) / outer-right (right screen) side rim one tone up, 1 px
  for (let x = 2; x <= FRAME_W - 3; x++) c.set(x, dyAt(who, x) + 1, metal[2]);
  const outer = who === 0 ? 2 : FRAME_W - 3;
  for (let y = dyAt(who, outer) + 1; y <= bottomRow(who, outer) - 1; y++) c.set(outer, y, metal[2]);
  // a hard shadow row on the bottom rim
  for (let x = 2; x <= FRAME_W - 3; x++) {
    const b = bottomRow(who, x);
    if (b - 1 > dyAt(who, x) + 5) c.set(x, b - 1, PAL.night0);
  }
  // clear the window
  for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) if (WINDOW[who][y * FRAME_W + x]) c.erase(x, y);
  // corner screws (top corners) and the status LED row on the lower bezel
  for (const x of [3, FRAME_W - 4]) c.set(x, dyAt(who, x) + 2, metal[3]);
  const lx = who === 0 ? 10 : FRAME_W - 18;
  for (let i = 0; i < 4; i++) {
    const x = lx + i * 2;
    c.set(x, bottomRow(who, x) - 1, i === 0 ? neon : PAL.night3);
  }
  if (bright) {
    c.set(4, dyAt(who, 4) + 1, PAL.white);
    c.set(FRAME_W - 5, dyAt(who, FRAME_W - 5) + 1, PAL.white);
    // the neon line's lit corners
    c.set(PIC_AT.x - 1, dyAt(who, PIC_AT.x - 1) + 3, R[4]);
    c.set(FRAME_W - PIC_AT.x, dyAt(who, FRAME_W - PIC_AT.x) + 3, R[4]);
  }
  return c;
}

// ------------------------------------------------------------------------------------------ pictures

function lum(c: number): number {
  return ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;
}

/** A raster line every 3rd row, one tone down in every pixel but the brightest highlights (the lines stay visible at 1×). */
function raster(c: PixelCanvas): PixelCanvas {
  for (let y = 2; y < c.h; y += 3)
    for (let x = 0; x < c.w; x++) {
      const col = c.get(x, y);
      if (col !== null && lum(col) < 200) c.set(x, y, toneDown(col));
    }
  return c;
}

function litCopy(src: PixelCanvas): PixelCanvas {
  const o = src.clone();
  o.map((col) => toneUp(col));
  return o;
}

/** Bounding box (picture space) where `v` differs from `base`, or null. */
function diffBox(base: PixelCanvas, v: PixelCanvas): { x: number; y: number; w: number; h: number } | null {
  let x0 = base.w;
  let y0 = base.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < base.h; y++)
    for (let x = 0; x < base.w; x++) if (base.get(x, y) !== v.get(x, y)) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export type ScreenOverlayKind = 'blink' | 'hurt' | 'glad' | 'swayN' | 'swayP';
export const OVERLAY_KINDS: readonly ScreenOverlayKind[] = ['blink', 'hurt', 'glad', 'swayN', 'swayP'];

/** The portrait variant each overlay kind replaces its patch with. */
function variantOf(who: 0 | 1, kind: ScreenOverlayKind): PixelCanvas {
  switch (kind) {
    case 'blink':
    case 'hurt':
    case 'glad':
      return paintPortrait(who, { mood: kind as PortraitMood });
    case 'swayN':
      return paintPortrait(who, { sway: -1 });
    case 'swayP':
      return paintPortrait(who, { sway: 1 });
  }
}

/** The scan line: a dithered lit row over a dim row, 80 wide, sheared like the picture (flat row 0 = the line). */
function paintScan(who: 0 | 1): Sheared {
  const R = who === 0 ? RAMPS.cyan : RAMPS.crim;
  const flat = new PixelCanvas(PORTRAIT_W, 2);
  for (let x = 0; x < PORTRAIT_W; x++) {
    if (x % 2 === 0) flat.set(x, 0, R[2]);
    flat.set(x, 1, x % 4 === 1 ? R[1] : R[0]);
  }
  return shearPiece(flat, who, PIC_AT.x, PIC_AT.y);
}

/** A sheared plate (a neon border round an ink field) holding `text`, for the name plate: its canvas + where it sits in the picture. */
export function paintPlate(who: 0 | 1, label: PixelCanvas): { canvas: PixelCanvas; x: number; y: number } {
  const R = who === 0 ? RAMPS.cyan : RAMPS.crim;
  // the label's ink rows (the glyph canvas has 3 empty rows above): crop to its bounds
  const b = label.bounds();
  if (b) label = label.crop(b.x, b.y, b.w, b.h);
  const w = label.w + 6;
  const h = label.h + 3;
  const flat = new PixelCanvas(w, h);
  flat.rect(0, 0, w, h, R[1]);
  flat.rect(1, 1, w - 2, h - 2, PAL.ink);
  flat.blit(label, 3, 1);
  // sits in the picture's lower corner on the side of the screen's own colour (left: lower-left, right: lower-right)
  const fx = who === 0 ? PIC_AT.x + 3 : PIC_AT.x + PORTRAIT_W - 3 - w;
  const fy = PIC_AT.y + PORTRAIT_H - 3 - h;
  const s = shearPiece(flat, who, fx, fy);
  return { canvas: s.canvas, x: s.x, y: s.y };
}

export interface ScreensBake extends NtAtlas {
  /** Where each picture-space piece sits in the sheared frame (x, y of its top-left): pic, lit, scan and the overlay patches. */
  at: Record<string, { x: number; y: number }>;
}

export const frameName = (who: 0 | 1, bright: boolean): string => `frame:${who}:${bright ? 1 : 0}`;
export const picName = (who: 0 | 1): string => `pic:${who}`;
export const litName = (who: 0 | 1): string => `lit:${who}`;
export const scanName = (who: 0 | 1): string => `scan:${who}`;
export const overlayName = (who: 0 | 1, kind: ScreenOverlayKind): string => `ov:${who}:${kind}`;

let cache: ScreensBake | null = null;

/** Clip a sheared piece (at (x, y) of the sheared frame) to the window. */
function clipToWindow(s: Sheared, who: 0 | 1): void {
  for (let j = 0; j < s.canvas.h; j++)
    for (let i = 0; i < s.canvas.w; i++) {
      const fx = s.x + i;
      const fy = s.y + j;
      if (fx < 0 || fy < 0 || fx >= FRAME_W || fy >= FRAME_H || !WINDOW[who][fy * FRAME_W + fx]) s.canvas.erase(i, j);
    }
}

/** Bake every screen texture (pure, deterministic, ≈ 40 ms in Node). */
export function screensBake(): ScreensBake {
  if (cache) return cache;
  const parts: [string, PixelCanvas][] = [];
  const at: Record<string, { x: number; y: number }> = {};
  for (const who of [0, 1] as const) {
    const base = paintPortrait(who);
    const basePic = shearPiece(raster(base.clone()), who, PIC_AT.x, PIC_AT.y);
    clipToWindow(basePic, who);
    parts.push([picName(who), basePic.canvas]);
    at[picName(who)] = { x: basePic.x, y: basePic.y };
    parts.push([litName(who), litCopy(basePic.canvas)]);
    at[litName(who)] = { x: basePic.x, y: basePic.y };
    for (const kind of OVERLAY_KINDS) {
      const v = variantOf(who, kind);
      const box = diffBox(base, v);
      if (!box) continue;
      const patch = shearPiece(raster(v.clone()).crop(box.x, box.y, box.w, box.h), who, PIC_AT.x + box.x, PIC_AT.y + box.y);
      clipToWindow(patch, who);
      parts.push([overlayName(who, kind), patch.canvas]);
      at[overlayName(who, kind)] = { x: patch.x, y: patch.y };
    }
    const scan = paintScan(who);
    parts.push([scanName(who), scan.canvas]);
    at[scanName(who)] = { x: scan.x, y: scan.y };
    parts.push([frameName(who, false), paintFrame(who, false)]);
    parts.push([frameName(who, true), paintFrame(who, true)]);
  }
  const atlas = packAtlas(parts, 300);
  cache = { ...atlas, at };
  return cache;
}

/** Placeholder-compatible painter (the boot step registers `screensBake().canvas`). */
export function paintScreens(): PixelCanvas {
  return screensBake().canvas;
}

export type { AtlasRect, Pt };
export { PORTRAIT_H, PORTRAIT_W };
