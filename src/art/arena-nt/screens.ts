// Neon Tower painter: screens — owner B2 (docs/v3/ARENA_NEON_TOWER.md §2 / §5 / §6 / §10).
// The two portrait screens hanging in the wall bays (layout-nt SCREENS, 90×62 with the frame, 80×56 picture):
// left = the player (blue frame), right = the opponent (crimson frame). Pure PixelCanvas code (no Phaser):
// runs in Node for tests and tools.
//
// What is baked (one atlas, `nt:screens`, ≈ 0.17 MB):
//   frame:<who>:<0|1>      the bezel (ink rim, two metal tones, a 1-px neon line round the picture) with a
//                          transparent window; 0 = dim neon, 1 = bright neon. The window's lower inner corner
//                          is chamfered (the left screen's lower-right, the right one's lower-left: the corners
//                          that face the platform), so the screens read as angled panels hung in their bays.
//   pic:<who>              the 80×56 portrait (src/art/arena-nt/portraits.ts), a dark raster line baked into the
//                          dark parts every 4th row.
//   lit:<who>              the same picture one tone brighter in every pixel: a sweep / flicker / flash shows it
//                          through a crop (never an alpha blend).
//   ov:<who>:<kind>        small replacement patches (blink, hurt, glad, hair sway −1 / +1): the bounding box
//                          where that variant differs from `pic`, drawn over it for the length of the reaction.
// Everything is flat tone bands, opaque or fully transparent: no alpha anywhere.

import { PAL, RAMPS } from '../palette';
import { PixelCanvas } from '../pixel';
import { PORTRAIT_H, PORTRAIT_W, type PortraitMood, paintPortrait } from './portraits';
import { type AtlasRect, type NtAtlas, packAtlas } from './wall-kit';

/** Texture key of this layer's atlas / sheet (frames named inside). */
export const NT_SCREENS_KEY = 'nt:screens';

export const FRAME_W = 90;
export const FRAME_H = 62;
/** Where the picture sits inside the frame. */
export const PIC_AT = { x: 5, y: 3 } as const;
/** Size of the chamfer on the inner lower corner (frame px). */
export const CHAMFER = 9;

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

function lum(c: number): number {
  return ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;
}

// ------------------------------------------------------------------------------------------ geometry

/** The chamfered rectangle (frame space) inset by (ix, iy); `who` 0 cuts the lower-right corner, 1 the lower-left. */
function chamfered(who: 0 | 1, ix: number, iy: number, cut: number): Pt[] {
  const x0 = ix;
  const y0 = iy;
  const x1 = FRAME_W - 1 - ix;
  const y1 = FRAME_H - 1 - iy;
  const c = Math.max(1, cut);
  return who === 0
    ? [
        [x0, y0],
        [x1, y0],
        [x1, y1 - c],
        [x1 - c, y1],
        [x0, y1],
      ]
    : [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0 + c, y1],
        [x0, y1 - c],
      ];
}

/** Mask of the picture window: the inner chamfered rectangle (true = inside). */
function windowMask(who: 0 | 1): Uint8Array {
  const m = new PixelCanvas(FRAME_W, FRAME_H);
  m.poly(chamfered(who, PIC_AT.x, PIC_AT.y, CHAMFER - 4), 0xffffff);
  const out = new Uint8Array(FRAME_W * FRAME_H);
  for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) out[y * FRAME_W + x] = m.isOpaque(x, y) ? 1 : 0;
  return out;
}

const WINDOW: [Uint8Array, Uint8Array] = [windowMask(0), windowMask(1)];

/** Clip a picture-space canvas (80×56) to the chamfered window. */
function clipToWindow(c: PixelCanvas, who: 0 | 1): void {
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (!WINDOW[who][(y + PIC_AT.y) * FRAME_W + x + PIC_AT.x]) c.erase(x, y);
}

// ------------------------------------------------------------------------------------------ the frame

/**
 * The bezel round a screen. Metal is the arena's night ramp, lit from the top-left; the 1-px neon line
 * round the window is the only bright thing (dim: tone 1 of the player's ramp; bright: tone 3 + a white
 * glint on each corner). `bright` also lifts the metal one tone.
 */
export function paintFrame(who: 0 | 1, bright: boolean): PixelCanvas {
  const R = who === 0 ? RAMPS.cyan : RAMPS.crim;
  const neon = bright ? R[3] : R[1];
  const c = new PixelCanvas(FRAME_W, FRAME_H);
  const metal = bright ? [PAL.night2, PAL.night3, PAL.night4] : [PAL.night1, PAL.night2, PAL.night3];
  // rings, outer → inner: ink rim, shade, lit metal, shade (the side margins are 5 wide, top / bottom 3)
  c.poly(chamfered(who, 0, 0, CHAMFER + 4), PAL.ink);
  c.poly(chamfered(who, 1, 1, CHAMFER + 3), metal[0]);
  c.poly(chamfered(who, 2, 1, CHAMFER + 2), metal[1]);
  c.poly(chamfered(who, 3, 2, CHAMFER), PAL.night0);
  // top-left rim light on the metal (1 px)
  c.hline(2, FRAME_W - 4, 1, metal[2]);
  c.vline(2, 2, FRAME_H - 8, metal[2]);
  // the neon line round the window
  c.polyline(chamfered(who, 4, 2, CHAMFER - 2), neon, true);
  // clear the window
  for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) if (WINDOW[who][y * FRAME_W + x]) c.erase(x, y);
  // corner screws and the lower-edge status LEDs
  for (const [x, y] of [
    [2, 3],
    [FRAME_W - 3, 3],
  ] as const)
    c.set(x, y, PAL.night4);
  const lx = who === 0 ? 8 : FRAME_W - 12;
  for (let i = 0; i < 3; i++) c.set(lx + i * 2, FRAME_H - 2, i === 0 ? neon : PAL.night2);
  if (bright) {
    c.set(4, 2, PAL.white);
    c.set(FRAME_W - 5, 2, PAL.white);
  }
  return c;
}

// ------------------------------------------------------------------------------------------ pictures

/** A dark raster line every 4th row, only over the dark parts (the face stays clean). */
function raster(c: PixelCanvas): PixelCanvas {
  for (let y = 3; y < c.h; y += 4)
    for (let x = 0; x < c.w; x++) {
      const col = c.get(x, y);
      if (col !== null && lum(col) < 64) c.set(x, y, toneDown(col));
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

export interface ScreensBake extends NtAtlas {
  /** Where each overlay patch sits in picture space (x, y of its top-left). */
  overlayAt: Record<string, { x: number; y: number }>;
}

export const frameName = (who: 0 | 1, bright: boolean): string => `frame:${who}:${bright ? 1 : 0}`;
export const picName = (who: 0 | 1): string => `pic:${who}`;
export const litName = (who: 0 | 1): string => `lit:${who}`;
export const overlayName = (who: 0 | 1, kind: ScreenOverlayKind): string => `ov:${who}:${kind}`;

let cache: ScreensBake | null = null;

/** Bake every screen texture (pure, deterministic, ≈ 25 ms in Node). */
export function screensBake(): ScreensBake {
  if (cache) return cache;
  const parts: [string, PixelCanvas][] = [];
  const overlayAt: Record<string, { x: number; y: number }> = {};
  for (const who of [0, 1] as const) {
    const base = paintPortrait(who);
    const basePic = raster(base.clone());
    clipToWindow(basePic, who);
    parts.push([picName(who), basePic]);
    const lit = litCopy(basePic);
    parts.push([litName(who), lit]);
    for (const kind of OVERLAY_KINDS) {
      const v = variantOf(who, kind);
      const box = diffBox(base, v);
      if (!box) continue;
      const patch = raster(v.clone()).crop(box.x, box.y, box.w, box.h);
      // a patch must be opaque only where the picture is (the chamfer never reaches the patches' boxes)
      parts.push([overlayName(who, kind), patch]);
      overlayAt[overlayName(who, kind)] = { x: box.x, y: box.y };
    }
    parts.push([frameName(who, false), paintFrame(who, false)]);
    parts.push([frameName(who, true), paintFrame(who, true)]);
  }
  const atlas = packAtlas(parts, 272);
  cache = { ...atlas, overlayAt };
  return cache;
}

/** Placeholder-compatible painter (the boot step registers `screensBake().canvas`). */
export function paintScreens(): PixelCanvas {
  return screensBake().canvas;
}

export type { AtlasRect };
export { PORTRAIT_H, PORTRAIT_W };
