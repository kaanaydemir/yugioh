// Neon Düello still preview — composes the single 640×360 scene: arena, local light pools, contact
// shadows, then the two refined monsters on the original zones (the wizard mirrored, exactly as the
// game places P2). Pure PixelCanvas drawing; no Phaser, nothing animated.
//
// Light and shadow are flat tone steps, not blends: inside a mask every floor pixel moves one step
// along a fixed palette table (shadow: one step darker; light: one step toward the light's hue).
// Emissive pixels (the neon zone lines / trim) are not changed by light, only dimmed by shadow.
// One key light for everything: top-left (the original sprites' light), so shadows fall lower-right.

import { PAL } from '../art/palette';
import { type Color, PixelCanvas } from '../art/pixel';
import { GAME_H, GAME_W } from '../view/layout';
import { drawArena, onPlatformTop, SLOTS } from './arena';
import { drawMagus, MAGUS } from './magus';
import { drawWyrm, WYRM } from './wyrm';

export interface StillParts {
  wyrm: PixelCanvas;
  magus: PixelCanvas;
}

export function stillParts(): StillParts {
  const wyrm = new PixelCanvas(WYRM.w, WYRM.h);
  drawWyrm(wyrm);
  const magus = new PixelCanvas(MAGUS.w, MAGUS.h);
  drawMagus(magus);
  return { wyrm, magus };
}

/** Top-left of a sprite placed like MonsterUnit does (origin on the anchor, mirrored for P2). */
export function placeOf(g: { w: number; anchorX: number; anchorY: number; hover: number }, home: { x: number; y: number }, flip: boolean) {
  return { x: home.x - (flip ? g.w - g.anchorX : g.anchorX), y: home.y - g.hover - g.anchorY };
}

// ---------------------------------------------------------------- tone-step tables

type Lut = ReadonlyMap<Color, Color>;

/** One step darker (contact shadow). */
const SHADOW: Lut = new Map<Color, Color>([
  [PAL.ink, PAL.ink],
  [PAL.night0, PAL.ink],
  [PAL.night1, PAL.night0],
  [PAL.night2, PAL.night1],
  [PAL.night3, PAL.night2],
  [PAL.night4, PAL.night3],
  [PAL.stone0, PAL.night0],
  [PAL.cyan0, PAL.night0],
  [PAL.cyan1, PAL.cyan0],
  [PAL.cyan2, PAL.cyan1],
  [PAL.crim0, PAL.ink],
  [PAL.crim1, PAL.crim0],
  [PAL.crim2, PAL.crim1],
  [PAL.void0, PAL.ink],
  [PAL.void1, PAL.void0],
]);

/** Cyan spill from the crystal wyrm on the matte floor. */
const CYAN_LIGHT: Lut = new Map<Color, Color>([
  [PAL.night0, PAL.water0],
  [PAL.night1, PAL.cyan0],
  [PAL.stone0, PAL.cyan0],
]);

/** Violet spill from the magus' orb on the matte floor. */
const VIOLET_LIGHT: Lut = new Map<Color, Color>([
  [PAL.night0, PAL.void0],
  [PAL.night1, PAL.void1],
  [PAL.stone0, PAL.void1],
]);

/** Remap every floor pixel inside the iso ellipse (cx, cy, rx, ry) through `lut`. */
function stepEllipse(p: PixelCanvas, cx: number, cy: number, rx: number, ry: number, lut: Lut): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1 || !onPlatformTop(x, y)) continue;
      const c = p.get(x, y);
      if (c === null) continue;
      const n = lut.get(c);
      if (n !== undefined && n !== c) p.set(x, y, n);
    }
}

// ---------------------------------------------------------------- lights + shadows

/** The orb's floor point: straight under the staff head (frame 56,19 facing right) at the wizard's depth. */
function orbFloor(): { x: number; y: number } {
  const tl = placeOf(MAGUS, SLOTS.wizard, true);
  return { x: tl.x + (MAGUS.w - 1 - 56), y: SLOTS.wizard.y };
}

function drawLights(p: PixelCanvas): void {
  const d = SLOTS.dragon;
  stepEllipse(p, d.x + 2, d.y - 1, 30, 14, CYAN_LIGHT);
  const o = orbFloor();
  stepEllipse(p, o.x + 4, o.y, 20, 9, VIOLET_LIGHT);
}

function drawShadows(p: PixelCanvas): void {
  const d = SLOTS.dragon;
  // dragon: a body shadow under both feet, a darker contact core under the planted feet,
  // and a thin one under the lowest curve of the tail; all nudged lower-right (key light top-left)
  stepEllipse(p, d.x + 8, d.y, 20, 6, SHADOW);
  stepEllipse(p, d.x + 6, d.y, 10, 3, SHADOW);
  stepEllipse(p, d.x - 29, d.y - 8, 11, 2.5, SHADOW);
  // wizard (hover 6): one soft step, smaller than its robe — it floats above its spot
  const w = SLOTS.wizard;
  stepEllipse(p, w.x + 2, w.y, 16, 5, SHADOW);
  stepEllipse(p, w.x + 2, w.y, 8, 2.5, SHADOW);
}

export function renderStill(): PixelCanvas {
  const p = new PixelCanvas(GAME_W, GAME_H);
  drawArena(p);
  drawLights(p);
  drawShadows(p);
  const { wyrm, magus } = stillParts();
  const w = placeOf(WYRM, SLOTS.dragon, false);
  const m = placeOf(MAGUS, SLOTS.wizard, true);
  // back-to-front: the wizard stands further back (smaller y)
  p.blit(magus, m.x, m.y, { flipX: true });
  p.blit(wyrm, w.x, w.y);
  return p;
}
