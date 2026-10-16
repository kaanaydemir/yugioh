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
import { drawArena, SLOTS, topAt } from './arena';
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
  [PAL.void0, PAL.night0], // a hover shadow stays one step above black
  [PAL.void1, PAL.void0],
  [PAL.void2, PAL.void1],
]);

/** Cyan spill from the crystal wyrm on the matte floor (one step). */
const CYAN_LIGHT: Lut = new Map<Color, Color>([
  [PAL.night0, PAL.water0],
  [PAL.night1, PAL.cyan0],
  [PAL.stone0, PAL.cyan0],
]);

/** Violet spill from the magus' orb on the matte floor (one step up, never darker). */
const VIOLET_LIGHT: Lut = new Map<Color, Color>([
  [PAL.night0, PAL.void1],
  [PAL.night1, PAL.void1],
  [PAL.stone0, PAL.void1],
]);

/**
 * The wizard's hover shadow: one flat step below the bare pad (night0, the same tone as the dragon's
 * contact shadow but with no ink core — it floats), whatever light lies under it.
 */
const HOVER_SHADOW: Lut = new Map<Color, Color>([
  [PAL.night1, PAL.night0],
  [PAL.void1, PAL.night0],
]);

/**
 * Remap the floor pixels inside the iso ellipse (cx, cy, rx, ry) through `lut`.
 * `padOnly`: only the matte interior of the zone pads (light never washes over the neon lines, the
 * pad-coloured ring outside them, the joins or the slab border, so a pool stays a clean shape
 * inside its zone line and leaves no stray lit pixels).
 */
function stepEllipse(p: PixelCanvas, cx: number, cy: number, rx: number, ry: number, lut: Lut, padOnly = false): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const t = topAt(x, y);
      if (!t || (padOnly && t.kind !== 'pad' && t.kind !== 'pile')) continue;
      const c = p.get(x, y);
      if (c === null) continue;
      const n = lut.get(c);
      if (n !== undefined && n !== c) p.set(x, y, n);
    }
}

// ---------------------------------------------------------------- lights + shadows

function drawLights(p: PixelCanvas): void {
  // each monster gets ONE flat seat of its own light on its pad, drawn before the contact shadows so
  // the shadow lands inside it (one light ring around one shadow step — no gradient, no stray pools)
  // wyrm: a cyan pool around its feet (the crystal body + wings glow right above it)
  const d = SLOTS.dragon;
  stepEllipse(p, d.x + 3, d.y - 1, 22, 8, CYAN_LIGHT, true);
  // magus: a violet pool from its orb, one flat void1 step as strong as the dragon's cyan seat, so
  // the zone reads lit and the small hover shadow (lower-right) sits in the light instead of
  // filling the seat
  const w = SLOTS.wizard;
  stepEllipse(p, w.x + 1, w.y, 16, 6, VIOLET_LIGHT, true);
}

function drawShadows(p: PixelCanvas): void {
  // all shadows fall lower-right of their contact point (key light top-left)
  const d = SLOTS.dragon;
  // dragon: the body shadow under both feet + a darker contact core under the planted feet,
  // and a thin one under the lowest curve of the tail
  stepEllipse(p, d.x + 7, d.y, 15, 4.5, SHADOW);
  stepEllipse(p, d.x + 5, d.y, 8, 2.5, SHADOW);
  stepEllipse(p, d.x - 29, d.y - 8, 11, 2.5, SHADOW);
  // wizard (hover 6): one small flat step at the ground point, much narrower than its robe — it
  // floats above its lit spot
  const w = SLOTS.wizard;
  stepEllipse(p, w.x + 4, w.y + 1, 7, 2, HOVER_SHADOW);
}

export function renderStill(): PixelCanvas {
  const p = new PixelCanvas(GAME_W, GAME_H);
  const { wyrm, magus } = stillParts();
  drawArena(p);
  drawLights(p);
  drawShadows(p);
  const w = placeOf(WYRM, SLOTS.dragon, false);
  const m = placeOf(MAGUS, SLOTS.wizard, true);
  // back-to-front: the wizard stands further back (smaller y)
  p.blit(magus, m.x, m.y, { flipX: true });
  p.blit(wyrm, w.x, w.y);
  return p;
}
