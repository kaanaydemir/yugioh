// Neon Tower layer: GLOW — arena v4 step 2 "lighting & value separation" (docs/v3/ref/hedef-gorunum-4-isik.png).
//
// The owner's ask: the monsters must pop from the floor through light and colour contrast, like the target's grayscale study.
// The environment (hall floor, back wall, stage top and walls, daises) is pushed down to dark, low-contrast, slightly
// desaturated cool tones; the light sources (wall torches, braziers, holograms, portrait screens, zone borders, daises)
// throw coloured light onto it. Golden rule 3: a soft light layer OVER the flat crisp pixels — no texture is repainted,
// every pixel of the arena art stays what it is; the light lives in a few pre-baked, static images:
//
//   depth                      image                       blend      what
//   10.95  (over wall/floor)   back veil (+ an upper rect)  MULTIPLY   the hall's light map: cool dim ambient, warm torch
//                                                                      pools on the bricks, the screens' and holograms' tint,
//                                                                      the braziers' floor pools, a gentle vignette
//   10.97                      back glow                    ADD        the coloured light itself: torch halos on the bricks
//                                                                      (2 flicker frames), screen spill, hologram floor tint
//   21.45  (over the stage)    stage veil                   MULTIPLY   per pixel of the stage art: stone → dark, cool, a little
//                                                                      desaturated (a stepped key pool on the top, the walls in
//                                                                      shade, warm brazier pools on the walls); neon stays
//   21.47                      stage glow                   ADD        the daises' owner-colour halo on the stage top, the
//                                                                      braziers' warm light on the stage walls
//   29.05  (over each dais)    dais veil                    MULTIPLY   the dais stone like the stage stone (its neon stays)
//   30.3   (over the slots)    zone glow                    ADD        every zone border's own colour spilling 1–3 px onto the
//                                                                      stone round it and onto the pad inside it
//
// The holograms (13–15), the portrait screens (11), the torches / braziers themselves, the stage's energy strips (22),
// the zone borders, the units and everything above are never under a veil. The bands are stepped (whole pixels, flat
// levels, a 4×4 ordered dither between two levels of the hall's light map), never a smooth gradient. Nothing is redrawn per
// frame: the torch halos swap between two baked frames, the glows fade in once with the floodlights (setLights).
// Arena v4 only (BOARD_V4); the monsters' own light (owner-colour rim, contact shadow, tile pool) is the light layer's
// (src/view/light/LightLayer.ts, SteppedUnitLight).

import Phaser from 'phaser';
import { frameRGBA } from '../../art/atlas';
import { BRICK_TORCHES } from '../../art/arena-nt/brickwall';
import { FLOOR_FRAMES, NT_FLOOR_KEY, SEAL_RAMP, fieldTheme } from '../../art/arena-nt/floor';
import type { FieldView } from '../../duel/FieldView';
import { BRAZIER, BRAZIERS } from '../../art/arena-nt/hallfloor';
import { NT_PADS_KEY, PAD_CANVAS, padFrame } from '../../art/arena-nt/pads';
import { NT_PLATFORM_KEY, PLATFORM_BOX } from '../../art/arena-nt/platform';
import { PAL, RAMPS } from '../../art/palette';
import { BANISH_PAD, BOARD_V4, zoneXY } from '../layout';
import { hasLight, lightEnabled } from '../light';
import { calmZones } from '../board-calm/art';
import { DUELIST_PADS, HOLOS, NT_DEPTH, PLATE_POLY, SCREENS, ntIso } from './layout-nt';
import type { NtCtx, NtLayer } from './layer';
import { WIDE_OX } from '../mobile';

type Img = Phaser.GameObjects.Image;
type RGB = [number, number, number];

/** Depths of the light images (see the table above). */
export const GLOW_Z = {
  backVeil: NT_DEPTH.wall + 0.95,
  backGlow: NT_DEPTH.wall + 0.97,
  stageVeil: NT_DEPTH.platform + 1.45,
  stageGlow: NT_DEPTH.platform + 1.47,
  daisVeil: NT_DEPTH.pads + 0.05,
  zoneGlow: NT_DEPTH.floor + 0.3,
  brazierVeil: NT_DEPTH.platform + 1.505,
} as const;

const KEY = {
  backVeil: 'nt:v4light:backveil',
  backGlow: (f: number): string => `nt:v4light:backglow:${f}`,
  stageVeil: 'nt:v4light:stageveil',
  stageGlow: 'nt:v4light:stageglow',
  daisVeil: (p: number): string => `nt:v4light:daisveil:${p}`,
  zoneGlow: 'nt:v4light:zoneglow',
  zoneGlowWhite: 'nt:v4light:zoneglow:white',
  brazierVeil: (i: number): string => `nt:v4light:brazierveil:${i}`,
} as const;

// ---------------------------------------------------------------- tuning (QA: window.__neon.ntGlow)

/** The hall's ambient light (multiply: what is left of the wall / floor art far from every light). */
const AMBIENT: RGB = [0.5, 0.53, 0.66];
/** Back veil overscan (the camera leans / shakes a few px) and the area it covers. */
// wide phones (src/view/wide.ts): the veils run on into the side bars (the vignette keeps darkening outward)
const BACK = { x: -16 - WIDE_OX, y: -16, w: 672 + WIDE_OX * 2, h: 392 } as const;
/** The back glow's area: the wall and the hall floor round the hologram plinths (nothing glows lower down). */
const BACK_GLOW = { x: -16 - WIDE_OX, y: -16, w: 672 + WIDE_OX * 2, h: 224 } as const;

const rgb = (c: number): RGB => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];

/** 4×4 Bayer threshold of a world pixel (0 … 15/16): fixed to the floor, so the dither never crawls. */
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer4 = (x: number, y: number): number => (BAYER4[(x & 3) + ((y & 3) << 2)] + 0.5) / 16;

/** Stepped falloff of a light: 1 in the core, then two flat rims (no gradient). `d` = normalised distance. */
function stepFall(d: number): number {
  if (d >= 1) return 0;
  if (d < 0.38) return 1;
  if (d < 0.68) return 0.62;
  return 0.3;
}

interface BackLight {
  x: number;
  y: number;
  rx: number;
  ry: number;
  color: RGB;
  k: number;
}

/** The hall's light sources (back veil): torches on the bricks, screens on the wall, holograms + braziers on the floor. */
function backLights(): BackLight[] {
  const out: BackLight[] = [];
  const warm: RGB = [1, 0.74, 0.46];
  for (const t of BRICK_TORCHES) out.push({ x: t.x, y: t.y + 8, rx: 52, ry: 40, color: warm, k: 0.58 });
  for (const t of BRICK_TORCHES) out.push({ x: t.x, y: t.y + 4, rx: 22, ry: 20, color: warm, k: 0.3 });
  SCREENS.forEach((r, i) => {
    const c: RGB = i === 0 ? [0.42, 0.8, 1] : [1, 0.45, 0.55];
    out.push({ x: r.x + r.w / 2, y: r.y + r.h / 2, rx: r.w / 2 + 18, ry: r.h / 2 + 14, color: c, k: 0.32 });
  });
  for (const h of HOLOS) {
    const c: RGB = h.side === 0 ? [0.42, 0.82, 1] : [0.78, 0.5, 1];
    // the floor round the plinth and the wall behind the creature
    out.push({ x: h.pedestal.cx, y: h.pedestal.cy + 4, rx: h.pedestal.rx + 44, ry: h.pedestal.ry + 22, color: c, k: 0.52 });
    out.push({ x: h.box.x + h.box.w / 2, y: h.box.y + h.box.h * 0.45, rx: h.box.w * 0.62, ry: h.box.h * 0.55, color: c, k: 0.26 });
  }
  for (const b of BRAZIERS) out.push({ x: b.x, y: b.y + 2, rx: 76, ry: 34, color: warm, k: 0.55 });
  return out;
}

/** The back veil's light at a world pixel (multiply factor per channel, ≤ 1). */
function backLight(x: number, y: number, lights: readonly BackLight[]): RGB {
  // gentle vignette toward the frame edges (stepped by the quantiser)
  const vx = (x - 320) / 360;
  const vy = (y - 175) / 230;
  const vig = 1 - 0.34 * Math.min(1, Math.max(0, vx * vx + vy * vy - 0.25) / 0.75);
  const out: RGB = [AMBIENT[0] * vig, AMBIENT[1] * vig, AMBIENT[2] * vig];
  for (const l of lights) {
    const dx = (x + 0.5 - l.x) / l.rx;
    const dy = (y + 0.5 - l.y) / l.ry;
    const f = stepFall(Math.sqrt(dx * dx + dy * dy));
    if (f <= 0) continue;
    for (let c = 0; c < 3; c++) out[c] += l.color[c] * l.k * f;
  }
  return out;
}

/** Quantise a multiply factor to 1/Q steps with an ordered dither (crisp, pixel-aligned bands). */
function quant(v: number, x: number, y: number, q = 20): number {
  const s = Math.floor(Math.min(1, Math.max(0, v)) * q + bayer4(x, y));
  return Math.min(255, Math.round((Math.min(q, s) / q) * 255));
}

function bakeBackVeil(): Uint8ClampedArray {
  const lights = backLights();
  const d = new Uint8ClampedArray(BACK.w * BACK.h * 4);
  for (let j = 0; j < BACK.h; j++)
    for (let i = 0; i < BACK.w; i++) {
      const x = BACK.x + i;
      const y = BACK.y + j;
      const l = backLight(x, y, lights);
      const o = (j * BACK.w + i) * 4;
      d[o] = quant(l[0], x, y);
      d[o + 1] = quant(l[1], x, y);
      d[o + 2] = quant(l[2], x, y);
      d[o + 3] = 255;
    }
  return d;
}

// ---------------------------------------------------------------- glow (ADD) helpers

/** A flat-banded ADD stamp: `color` × level into `d` (w × h, origin ox, oy), the brightest stamp wins per channel. */
function stamp(d: Uint8ClampedArray, w: number, h: number, ox: number, oy: number, cx: number, cy: number, rx: number, ry: number, color: number, k: number, bands: readonly number[] = [1, 0.55, 0.25]): void {
  const c = rgb(color);
  const x0 = Math.max(0, Math.floor(cx - rx - ox));
  const x1 = Math.min(w - 1, Math.ceil(cx + rx - ox));
  const y0 = Math.max(0, Math.floor(cy - ry - oy));
  const y1 = Math.min(h - 1, Math.ceil(cy + ry - oy));
  const n = bands.length;
  for (let j = y0; j <= y1; j++)
    for (let i = x0; i <= x1; i++) {
      const dx = (ox + i + 0.5 - cx) / rx;
      const dy = (oy + j + 0.5 - cy) / ry;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r >= 1) continue;
      const lv = bands[Math.min(n - 1, Math.floor(r * n))] * k;
      const o = (j * w + i) * 4;
      for (let ch = 0; ch < 3; ch++) d[o + ch] = Math.max(d[o + ch], Math.round(c[ch] * 255 * lv));
      d[o + 3] = 255;
    }
}

function bakeBackGlow(frame: number): Uint8ClampedArray {
  const BACK = BACK_GLOW;
  const d = new Uint8ClampedArray(BACK.w * BACK.h * 4);
  // torch halos on the bricks: a small hot core and a warm rim (frame 1 one notch wider: the flicker)
  for (const t of BRICK_TORCHES) {
    stamp(d, BACK.w, BACK.h, BACK.x, BACK.y, t.x, t.y + 2, 26 + frame * 3, 22 + frame * 2, PAL.fire2, 0.34, [1, 0.6, 0.32]);
    stamp(d, BACK.w, BACK.h, BACK.x, BACK.y, t.x, t.y, 9 + frame, 8 + frame, PAL.fire3, 0.42, [1, 0.6]);
  }
  // the screens spill their colour on the wall round the bezel (the bezel itself draws over the core)
  SCREENS.forEach((r, i) => {
    stamp(d, BACK.w, BACK.h, BACK.x, BACK.y, r.x + r.w / 2, r.y + r.h / 2, r.w / 2 + 12, r.h / 2 + 10, i === 0 ? PAL.cyan1 : PAL.crim1, 0.55, [1, 0.6, 0.3]);
  });
  // the holograms tint the hall floor round their plinths
  for (const h of HOLOS) {
    const c = h.side === 0 ? PAL.cyan1 : PAL.void2;
    stamp(d, BACK.w, BACK.h, BACK.x, BACK.y, h.pedestal.cx, h.pedestal.cy + 6, h.pedestal.rx + 34, h.pedestal.ry + 18, c, 0.5, [1, 0.62, 0.34]);
  }
  return d;
}

// ---------------------------------------------------------------- per-pixel veils (stage, daises)

const EMISSIVE_RAMPS: readonly (readonly number[])[] = [RAMPS.cyan, RAMPS.crim, RAMPS.teal, RAMPS.mag, RAMPS.fire, RAMPS.leaf];
const EMISSIVE = new Set<number>([...EMISSIVE_RAMPS.flatMap((r) => r.slice(2)), PAL.gold3, PAL.gold4, PAL.void3, PAL.void4, PAL.water3, PAL.water4, PAL.white]);
/** Lit trims (the stage's gold bevel): kept, a touch down. */
const TRIM = new Set<number>([PAL.gold2]);

/**
 * The multiply factor that turns stone colour `c` (0xRRGGBB) into its graded tone: `desat` toward its luminance, × k, × a cool
 * tint. Clamped per channel to ≤ 1 (multiply can only darken: a channel that would have to rise stays as it is).
 */
function gradeFactor(c: number, k: number, desat: number, tint: RGB): RGB {
  const r = ((c >> 16) & 255) / 255;
  const g = ((c >> 8) & 255) / 255;
  const b = (c & 255) / 255;
  const l = 0.299 * r + 0.587 * g + 0.114 * b;
  const t: RGB = [(r + (l - r) * desat) * k * tint[0], (g + (l - g) * desat) * k * tint[1], (b + (l - b) * desat) * k * tint[2]];
  const src: RGB = [r, g, b];
  return [0, 1, 2].map((i) => (src[i] <= 0.004 ? 1 : Math.min(1, t[i] / src[i]))) as RGB;
}

const COOL: RGB = [0.92, 0.96, 1.08];
const WARM: RGB = [1.08, 0.94, 0.78];
/** Arena v5 step 1: the stage top's grade tint (violet-grey slate) and switch. */
const VIOLET: RGB = [1.04, 0.88, 1.08];
const V5_TOP = BOARD_V4;

/** Is (x, y) on the stage TOP (the octagon), not its side walls? */
function onTop(x: number, y: number, poly: readonly { x: number; y: number }[]): boolean {
  let k = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) k = !k;
  }
  return k;
}

/** Brightness of the stage stone at a pixel: a stepped key pool on the top (bright in the middle), the walls in shade, warm brazier pools. */
function stageK(x: number, y: number, top: boolean): { k: number; warm: number } {
  let warm = 0;
  for (const b of BRAZIERS) {
    const fy = b.y - BRAZIER.h + 1 + BRAZIER.flameY;
    const dx = (x - b.x) / 70;
    const dy = (y - (fy + 18)) / 46;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r < 1) warm = Math.max(warm, r < 0.45 ? 2 : 1);
  }
  // arena v5 step 2: the stone-and-metal walls a notch up (their courses, panels, rivets must read; still well under the top)
  if (!top) return V5_TOP ? { k: warm === 2 ? 0.74 : warm === 1 ? 0.64 : 0.56, warm } : { k: warm === 2 ? 0.66 : warm === 1 ? 0.56 : 0.46, warm };
  // step 3 (a): ONE flat level on the bare stage top. The three-band key pool (0.6 / 0.55 / 0.5) left faint elliptical contour
  // rings on the flat stone; the pools of light on the top are the units' own (LightLayer) and the zone borders' spill.
  void x;
  void y;
  return { k: 0.56, warm: 0 };
}

function veilPixel(d: Uint8ClampedArray, o: number, f: RGB): void {
  d[o] = Math.round(f[0] * 255);
  d[o + 1] = Math.round(f[1] * 255);
  d[o + 2] = Math.round(f[2] * 255);
  d[o + 3] = 255;
}

function bakeStageVeil(px: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  const poly = PLATE_POLY.map(([c, r]) => ntIso(c, r));
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const o = (j * w + i) * 4;
      if (px[o + 3] < 128) {
        veilPixel(d, o, [1, 1, 1]);
        continue;
      }
      const c = (px[o] << 16) | (px[o + 1] << 8) | px[o + 2];
      if (EMISSIVE.has(c)) {
        veilPixel(d, o, [1, 1, 1]);
        continue;
      }
      const x = PLATFORM_BOX.x + i;
      const y = PLATFORM_BOX.y + j;
      if (TRIM.has(c)) {
        veilPixel(d, o, [0.86, 0.84, 0.86]);
        continue;
      }
      const top = onTop(x + 0.5, y + 0.5, poly);
      const { k, warm } = stageK(x + 0.5, y + 0.5, top);
      // arena v5 step 1: the flagstone top keeps more of the slate ramp's violet (hedef-gorunum-5: violet-grey stone), a little
      // less darkening on its now textured tones (the stage's MEAN stays where it was: the painter's flags are mostly stone1)
      // step 2: the top a clear mid-tone slate (target ≈ 75–83 mean luma): much less darkening, the violet tint kept
      if (top && V5_TOP) veilPixel(d, o, gradeFactor(c, 0.9, 0.1, VIOLET));
      else veilPixel(d, o, gradeFactor(c, k, 0.32, warm ? WARM : COOL));
    }
  return d;
}

function bakeDaisVeil(frames: (Uint8ClampedArray | null)[], w: number, h: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  const base = frames[1] ?? frames[0];
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const o = (j * w + i) * 4;
      if (!base || base[o + 3] < 128) {
        veilPixel(d, o, [1, 1, 1]);
        continue;
      }
      // a pixel that is neon in ANY breathing frame keeps its light
      let lit = false;
      for (const f of frames) {
        if (!f || f[o + 3] < 128) continue;
        if (EMISSIVE.has((f[o] << 16) | (f[o + 1] << 8) | f[o + 2])) lit = true;
      }
      if (lit) {
        veilPixel(d, o, [1, 1, 1]);
        continue;
      }
      const c = (base[o] << 16) | (base[o + 1] << 8) | base[o + 2];
      veilPixel(d, o, TRIM.has(c) ? [0.86, 0.84, 0.86] : gradeFactor(c, 0.62, 0.32, COOL));
    }
  return d;
}

/** Step 3 (b): the brazier posts' veil (stone → dark, warm-lit from the flame above; the flame pixels of every frame stay). */
function bakePostVeil(frames: (Uint8ClampedArray | null)[], w: number, h: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  const base = frames[0];
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const o = (j * w + i) * 4;
      let lit = false;
      for (const f of frames) if (f && f[o + 3] >= 128 && EMISSIVE.has((f[o] << 16) | (f[o + 1] << 8) | f[o + 2])) lit = true;
      if (!base || base[o + 3] < 128 || lit) {
        veilPixel(d, o, [1, 1, 1]);
        continue;
      }
      const c = (base[o] << 16) | (base[o + 1] << 8) | base[o + 2];
      // the post's top (near the fire) a notch brighter than its foot
      const k = j < BRAZIER.flameY + 8 ? 0.62 : j < BRAZIER.flameY + 20 ? 0.52 : j < BRAZIER.h - 22 ? 0.44 : 0.56; // v5: the stepped base sits in its own light pool
      // v5 step 3: the stepped base's treads (warm stone, painted lit by the fire) keep more of their light
      const tread = c === PAL.earth2 || c === PAL.earth3 || c === PAL.earth4;
      veilPixel(d, o, TRIM.has(c) ? [0.9, 0.82, 0.72] : gradeFactor(c, tread ? 0.72 : k, 0.3, WARM));
    }
  return d;
}

// ---------------------------------------------------------------- stage glow (daises, braziers on the walls)

const STAGE = PLATFORM_BOX;

function bakeStageGlow(stagePx: Uint8ClampedArray | null): Uint8ClampedArray {
  const { w, h } = STAGE;
  const d = new Uint8ClampedArray(w * h * 4);
  // the daises glow in their owner's colour (equal for both): a flat-banded halo round the dais foot on the stage top
  DUELIST_PADS.forEach((r, p) => {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2 + 6;
    stamp(d, w, h, STAGE.x, STAGE.y, cx, cy, 46, 25, p === 0 ? PAL.cyan2 : PAL.crim2, 0.62, [1, 0.62, 0.36, 0.18]);
  });
  // the braziers light the stage walls next to them (warm)
  for (const b of BRAZIERS) {
    const fy = b.y - BRAZIER.h + 1 + BRAZIER.flameY;
    stamp(d, w, h, STAGE.x, STAGE.y, b.x, fy + 16, 58, 40, PAL.fire2, 0.22, [1, 0.58, 0.28]);
  }
  // light lands on stone only (never on the transparent hall around the stage)
  if (stagePx) for (let o = 0; o < d.length; o += 4) if (stagePx[o + 3] < 128) d[o] = d[o + 1] = d[o + 2] = d[o + 3] = 0;
  return d;
}

// ---------------------------------------------------------------- zone glow (slot borders)

/** Bounding box of every slot image (the plate top). */
const ZONE_BOX = { x: 100, y: 24, w: 440, h: 276 } as const;

/** The resting frame of a zone's slot image (arena v4 step 3: the field seal and the deck / graveyard pads are their own frames). */
function zoneFrame(player: 0 | 1, spot: string): string {
  if (spot === 'field') return FLOOR_FRAMES.seal(player, 'none');
  if (spot === 'deck' || spot === 'graveyard') return FLOOR_FRAMES.pile(player, spot);
  return FLOOR_FRAMES.slot(player, spot !== 'monster' && spot !== 'spellTrap', 0, 0, spot === 'spellTrap');
}

/**
 * The zone-border spill. `white`: every border's spill in neutral white at the same levels (the theme glow: tinted at run time
 * with the active Field Spell's colour, crossfaded against the players' own colours).
 */
function bakeZoneGlow(slotPx: (player: 0 | 1, frame: string) => Uint8ClampedArray | null, white = false): Uint8ClampedArray {
  const { w, h } = ZONE_BOX;
  const d = new Uint8ClampedArray(w * h * 4);
  const OUT = [0, 0.34, 0.17, 0.07];
  const IN = [0, 0.26, 0.1];
  for (const z of calmZones()) {
    if (!BANISH_PAD && z.spot === 'banish') continue;
    const px = slotPx(z.player, zoneFrame(z.player, z.spot));
    if (!px) continue;
    const c = zoneXY(z.player, z.spot, z.index);
    const sx = Math.round(c.x) - 32;
    const sy = Math.round(c.y) - 16;
    const col: RGB = white ? [1, 1, 1] : rgb(z.player === 0 ? PAL.cyan2 : PAL.crim2);
    const neon = (u: number, v: number): boolean => {
      if (u < 0 || v < 0 || u >= 64 || v >= 32) return false;
      const o = (v * 64 + u) * 4;
      return px[o + 3] >= 128 && EMISSIVE.has((px[o] << 16) | (px[o + 1] << 8) | px[o + 2]);
    };
    for (let v = -3; v < 35; v++)
      for (let u = -3; u < 67; u++) {
        if (neon(u, v)) continue;
        // Chebyshev distance to the nearest border pixel (1 … 3)
        let dist = 9;
        for (let r = 1; r <= 3 && dist === 9; r++)
          for (let a = -r; a <= r && dist === 9; a++)
            for (let b = -r; b <= r; b++)
              if ((Math.abs(a) === r || Math.abs(b) === r) && neon(u + a, v + b)) {
                dist = r;
                break;
              }
        if (dist === 9) continue;
        const inside = u >= 0 && v >= 0 && u < 64 && v < 32 && px[(v * 64 + u) * 4 + 3] >= 128;
        // step 2: the crimson spill inside a slot held lower (red on the dark pit floor read muddy next to the cyan side)
        const lv = inside ? (IN[dist] ?? 0) * (z.player === 1 && !white ? 0.55 : 1) : OUT[dist];
        if (!lv) continue;
        const X = sx + u - ZONE_BOX.x;
        const Y = sy + v - ZONE_BOX.y;
        if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const o = (Y * w + X) * 4;
        for (let ch = 0; ch < 3; ch++) d[o + ch] = Math.max(d[o + ch], Math.round(col[ch] * 255 * lv));
        d[o + 3] = 255;
      }
  }
  return d;
}

// ---------------------------------------------------------------- the active Field Spell

/**
 * Which face-up Field Spell lights the board (step 3 (c)): read from the duel's FieldView every 150 ms. With both players' field
 * zones lit, the one that came up last wins. `color` = the theme's light tone.
 */
function fieldWatcher(scene: Phaser.Scene): { current(t: number): { color: number; fire: boolean } | null } {
  let next = 0;
  let cur: { color: number; fire: boolean } | null = null;
  const seen: (string | null)[] = [null, null];
  let lastUp: 0 | 1 | null = null;
  return {
    current(t) {
      if (t < next) return cur;
      next = t + 150;
      const f = (scene as unknown as { views?: { field?: FieldView } }).views?.field ?? null;
      const ids: (string | null)[] = [0, 1].map((p) => {
        try {
          const e = f?.entry(p as 0 | 1, 'field', 0);
          return e && e.tile.faceUp ? e.cardId : null;
        } catch {
          return null;
        }
      });
      for (const p of [0, 1] as const) if (ids[p] && ids[p] !== seen[p]) lastUp = p;
      seen[0] = ids[0];
      seen[1] = ids[1];
      const p = lastUp !== null && ids[lastUp] ? lastUp : ids[0] ? 0 : ids[1] ? 1 : null;
      const th = p === null ? 'none' : fieldTheme(ids[p]);
      cur = th === 'none' ? null : { color: SEAL_RAMP[th][3], fire: th === 'fire' };
      return cur;
    },
  };
}

// ---------------------------------------------------------------- the layer

function texFrom(scene: Phaser.Scene, key: string, w: number, h: number, data: () => Uint8ClampedArray): string {
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.createCanvas(key, w, h);
  if (!t) return '__DEFAULT';
  t.getContext().putImageData(new ImageData(data() as unknown as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0);
  t.refresh();
  return key;
}

function framePx(scene: Phaser.Scene, key: string, frame?: string): Uint8ClampedArray | null {
  if (!scene.textures.exists(key)) return null;
  const tex = scene.textures.get(key);
  if (frame !== undefined && !tex.has(frame)) return null;
  return frameRGBA(tex.get(frame));
}

export function createGlowLayer(ctx: NtCtx): NtLayer {
  const scene = ctx.scene;
  const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => ctx.add(o);
  const MUL = Phaser.BlendModes.MULTIPLY;
  const ADD = Phaser.BlendModes.ADD;

  // ---- back (hall floor, apron, brick wall)
  const backVeilKey = texFrom(scene, KEY.backVeil, BACK.w, BACK.h, bakeBackVeil);
  const veils: Phaser.GameObjects.GameObject[] = [];
  const veil = <T extends Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle>(o: T): T => {
    veils.push(o);
    add(o);
    return o;
  };
  veil(scene.add.image(BACK.x, BACK.y, backVeilKey).setOrigin(0).setDepth(GLOW_Z.backVeil).setBlendMode(MUL));
  // above the frame (seen while the intro pans up into the vault): the veil's top row colour, flat
  const top = backLight(320, BACK.y, backLights());
  const topCol = (Math.round(top[0] * 255) << 16) | (Math.round(top[1] * 255) << 8) | Math.round(top[2] * 255);
  veil(scene.add.rectangle(BACK.x, BACK.y - 600, BACK.w, 600, topCol).setOrigin(0).setDepth(GLOW_Z.backVeil).setBlendMode(MUL));
  const backGlowKeys = [0, 1].map((f) => texFrom(scene, KEY.backGlow(f), BACK_GLOW.w, BACK_GLOW.h, () => bakeBackGlow(f)));
  const backGlow = add(scene.add.image(BACK_GLOW.x, BACK_GLOW.y, backGlowKeys[0]).setOrigin(0).setDepth(GLOW_Z.backGlow).setBlendMode(ADD));

  // ---- stage
  const stagePx = framePx(scene, NT_PLATFORM_KEY);
  const glows: Img[] = [backGlow];
  if (stagePx) {
    const k = texFrom(scene, KEY.stageVeil, STAGE.w, STAGE.h, () => bakeStageVeil(stagePx, STAGE.w, STAGE.h));
    veil(scene.add.image(STAGE.x, STAGE.y, k).setOrigin(0).setDepth(GLOW_Z.stageVeil).setBlendMode(MUL));
  }
  const stageGlowKey = texFrom(scene, KEY.stageGlow, STAGE.w, STAGE.h, () => bakeStageGlow(stagePx));
  glows.push(add(scene.add.image(STAGE.x, STAGE.y, stageGlowKey).setOrigin(0).setDepth(GLOW_Z.stageGlow).setBlendMode(ADD)));

  // ---- daises
  DUELIST_PADS.forEach((r, p) => {
    const frames = [0, 1, 2, 3].map((lv) => framePx(scene, NT_PADS_KEY, padFrame(p as 0 | 1, lv)));
    if (!frames[1] && !frames[0]) return;
    const k = texFrom(scene, KEY.daisVeil(p), PAD_CANVAS.w, PAD_CANVAS.h, () => bakeDaisVeil(frames, PAD_CANVAS.w, PAD_CANVAS.h));
    veil(scene.add.image(r.x + 28 - PAD_CANVAS.cx, r.y + 14 - PAD_CANVAS.cy, k).setOrigin(0).setDepth(GLOW_Z.daisVeil).setBlendMode(MUL));
  });

  // ---- step 3 (b): the braziers' stone posts are veiled like the stage stone (warm, from their own fire); every pixel that is
  // flame in ANY of the six frames keeps its light, so the flames stay bright
  BRAZIERS.forEach((b, i) => {
    const frames = Array.from({ length: BRAZIER.frames }, (_, f) => framePx(scene, `nt:hall:brazier:${f}`));
    if (!frames[0]) return;
    const k = texFrom(scene, KEY.brazierVeil(i), BRAZIER.w, BRAZIER.h, () => bakePostVeil(frames, BRAZIER.w, BRAZIER.h));
    veil(scene.add.image(b.x - BRAZIER.cx, b.y - BRAZIER.h + 1, k).setOrigin(0).setDepth(GLOW_Z.brazierVeil).setBlendMode(MUL));
  });

  // ---- zone borders
  const slotPx = (player: 0 | 1, frame: string): Uint8ClampedArray | null => framePx(scene, NT_FLOOR_KEY, frame);
  const zoneKey = texFrom(scene, KEY.zoneGlow, ZONE_BOX.w, ZONE_BOX.h, () => bakeZoneGlow(slotPx));
  const zoneGlow = add(scene.add.image(ZONE_BOX.x, ZONE_BOX.y, zoneKey).setOrigin(0).setDepth(GLOW_Z.zoneGlow).setBlendMode(ADD));
  // step 3 (c): the same spill in white, tinted with the active Field Spell's theme colour; the two crossfade in stepped notches
  const themeKey = texFrom(scene, KEY.zoneGlowWhite, ZONE_BOX.w, ZONE_BOX.h, () => bakeZoneGlow(slotPx, true));
  const themeGlow = add(scene.add.image(ZONE_BOX.x, ZONE_BOX.y, themeKey).setOrigin(0).setDepth(GLOW_Z.zoneGlow + 0.001).setBlendMode(ADD).setVisible(false));
  const field = fieldWatcher(scene);
  let themeMix = 0; // 0 … 4 notches toward the theme
  let themeShown = -1;
  let themeTint = -1;
  let themeStepAt = 0;

  let lights = true;
  let veilsOn = true;
  let onAt = 0;
  let now = 0;
  let flick = -1;
  let shownLv = -1;
  const debug = { glows, keys: KEY };
  const neon = (globalThis as { __neon?: Record<string, unknown> }).__neon;
  if (neon) neon.ntGlow = debug;

  return {
    name: 'glow',
    owner: 'C',
    setLights(on, animate) {
      lights = on;
      // the glows come up with the floor lines (floor layer: +900 ms), in three stepped notches
      onAt = on ? now + (animate ? 900 : 0) : 0;
      return Promise.resolve();
    },
    tick(_dt, t) {
      now = t;
      // ?light=0 / the L key (light layer off) also takes the arena's light off (A/B)
      const enabled = !hasLight(scene) || lightEnabled(scene);
      if (enabled !== veilsOn) {
        veilsOn = enabled;
        for (const v of veils) (v as Phaser.GameObjects.Image).setVisible(enabled);
      }
      const k = !lights || !enabled ? 0 : t < onAt ? 0 : Math.min(1, Math.floor((t - onAt) / 90 + 1) / 3);
      if (k !== shownLv) {
        shownLv = k;
        for (const g of glows) g.setVisible(k > 0).setAlpha(k);
        themeShown = -1;
      }
      // the zone borders' spill takes the active Field Spell's colour (one notch per 80 ms toward / away from it)
      const fs = field.current(t);
      if (t >= themeStepAt) {
        themeStepAt = t + 80;
        const goal = fs ? 4 : 0;
        if (themeMix !== goal) themeMix += goal > themeMix ? 1 : -1;
      }
      if (fs && fs.color !== themeTint) {
        themeTint = fs.color;
        themeGlow.setTint(fs.color);
      }
      const mixKey = themeMix * 10 + Math.round(k * 3) + (fs?.fire ? 100 : 0);
      if (mixKey !== themeShown) {
        themeShown = mixKey;
        const m = themeMix / 4;
        zoneGlow.setVisible(k > 0 && m < 1).setAlpha(k * (1 - 0.8 * m));
        // step 4: Volcano is the busiest theme (its lava runs through the seams) — its border glow is held lower
        themeGlow.setVisible(k > 0 && m > 0).setAlpha(k * m * (fs?.fire ? 0.6 : 1.25));
      }
      // the torch halos flicker with the flames (two baked frames on an irregular rhythm)
      const b = Math.floor(t / 230);
      const f = (Math.imul(b ^ 0x2c1b3c6d, 0x297a2d39) >>> 0) % 100 < 38 ? 1 : 0;
      if (f !== flick) {
        flick = f;
        backGlow.setTexture(backGlowKeys[f]);
      }
    },
    destroy() {
      const n = (globalThis as { __neon?: Record<string, unknown> }).__neon;
      if (n && n.ntGlow === debug) delete n.ntGlow;
    },
  };
}
