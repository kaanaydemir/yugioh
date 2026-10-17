// Stepped light — the light language of the v3 look (docs/v3/A0_ENVANTER.md §5.5 "Işık", §6.1
// item 9; the reference is src/still/scene.ts stepEllipse / drawLights).
//
// No alpha, no blending, no soft glow textures: a light is a set of flat stamps (iso ellipses, an
// iso ring, a floor strip) on the floor, and inside a stamp every MATTE PAD pixel (the zone pads and
// the pile pads of the calm arena — never the neon zone lines, the gap ring, the border, the bridge
// or the slab edge) moves ONE or TWO tones along a fixed table toward the light's hue. The result is
// drawn opaque, at whole pixels, just above the calm board's pads (under its own pad fills / lava /
// highlights, the cards on the tiles and the unit shadows).
//
// Levels are quantised to quarter steps; a fraction becomes a world-aligned ordered dither (2×2
// Bayer), so a light fades in / out through 2–3 dither frames instead of alpha, and a pool's core
// (inner 55 %) can sit one step above its rim.
//
// The floor colour of a pixel comes from the still's topAt() (the calm arena is pixel-identical to
// src/still's drawArena, see src/view/board-calm/art.ts), memoised per screen pixel.

import type Phaser from 'phaser';
import { PAL, RAMPS } from '../../art/palette';
import type { Color } from '../../art/pixel';
import { topAt } from '../../still/arena';
import { DEPTH, GAME_H, GAME_W } from '../layout';

/** Depth of stepped floor light: over the calm board's pads (TILE), under its pad fills (TILE + 1). */
export const STEP_DEPTH = DEPTH.TILE + 0.5;

/** Max steps a light lifts a pad (the core of a strong flash). */
export const MAX_STEPS = 2;

// ---------------------------------------------------------------- the floor (memoised topAt)

/** Per screen pixel: −1 unknown, −2 not lightable, else the matte pad colour (0xRRGGBB). */
let floor: Int32Array | null = null;

/** The matte pad / pile colour at a screen pixel, or null when light must not touch it. */
export function padColorAt(x: number, y: number): Color | null {
  if (x < 0 || y < 0 || x >= GAME_W || y >= GAME_H) return null;
  if (!floor) floor = new Int32Array(GAME_W * GAME_H).fill(-1);
  const i = y * GAME_W + x;
  let v = floor[i];
  if (v === -1) {
    const t = topAt(x, y);
    v = t && (t.kind === 'pad' || t.kind === 'pile') ? t.color : -2;
    floor[i] = v;
  }
  return v === -2 ? null : v;
}

// ---------------------------------------------------------------- tone tables

const NEUTRAL: readonly Color[] = [PAL.ink, PAL.night0, PAL.night1, PAL.night2, PAL.night3, PAL.night4, PAL.steel, PAL.mist, PAL.white];
const HUES: readonly (readonly Color[])[] = Object.entries(RAMPS)
  .filter(([k]) => k !== 'night')
  .map(([, r]) => r);

const lum = (c: Color): number => 0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255);

/** The ramp a light colour belongs to (exact PAL ramp entry, else the nearest ramp colour). */
function rampOf(c: Color): readonly Color[] {
  if (NEUTRAL.includes(c)) return NEUTRAL;
  for (const r of HUES) if (r.includes(c)) return r;
  let best = Infinity;
  let out: readonly Color[] = NEUTRAL;
  for (const r of [NEUTRAL, ...HUES])
    for (const q of r) {
      const d = (((q >> 16) & 255) - ((c >> 16) & 255)) ** 2 + (((q >> 8) & 255) - ((c >> 8) & 255)) ** 2 + ((q & 255) - (c & 255)) ** 2;
      if (d < best) {
        best = d;
        out = r;
      }
    }
  return out;
}

const toneCache = new Map<string, Color>();

/**
 * `base` lit `n` steps (1 … MAX_STEPS) toward hue `hue`: step 1 is the first tone of the hue's ramp
 * that is not darker than the base (luminance ≥ 80 % of it — a dark saturated tone like fire0 still
 * reads as warm light on the navy pad, void0 does not), each further step one tone up the ramp.
 * On the calm pads: cyan light night1 → cyan0 → cyan1, violet night1 → void1 → void2 (the still's
 * CYAN_LIGHT / VIOLET_LIGHT seats), white night1 → night2 → night3.
 */
export function stepTone(base: Color, hue: Color, n: number): Color {
  if (n <= 0) return base;
  const k = `${base}:${hue}:${n}`;
  let out = toneCache.get(k);
  if (out !== undefined) return out;
  const ramp = rampOf(hue);
  const lb = lum(base);
  let i = ramp.findIndex((q) => q !== base && lum(q) >= lb * 0.8);
  if (i < 0) i = ramp.length - 1;
  out = ramp[Math.min(ramp.length - 1, i + Math.min(MAX_STEPS, n) - 1)];
  toneCache.set(k, out);
  return out;
}

/** Quantise a light level to quarter steps in [0, MAX_STEPS]. */
export function quantize(level: number): number {
  if (!(level > 0)) return 0;
  return Math.min(MAX_STEPS, Math.round(level * 4) / 4);
}

/** 2×2 Bayer threshold of a world pixel (0, .25, .5, .75): fixed to the floor, so dither never crawls. */
const bayer = (x: number, y: number): number => [0, 0.5, 0.75, 0.25][(x & 1) + ((y & 1) << 1)];

/** Whole steps at a pixel for a (quantised) level: the fraction is the dither density. */
export function stepsAt(level: number, x: number, y: number): number {
  const n = Math.floor(level);
  return n + (level - n > bayer(x, y) ? 1 : 0);
}

// ---------------------------------------------------------------- stamps

/** A flat iso ellipse on the floor: `core` (0..1 of the radius) carries `level`, the rim min(level, 1). */
export interface EllipseStamp {
  kind: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  level: number;
  hue: Color;
  /** Inner fraction of the radius at full `level` (default 0.55); outside it the rim is capped at 1 step. */
  core?: number;
}

/** An iso ring (expanding shock light): pixels within `width` px inside the ellipse edge. */
export interface RingStamp {
  kind: 'ring';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  width: number;
  level: number;
  hue: Color;
}

/** A light strip lying on the floor from a to b, `width` px across (iso: measured with y × 2). */
export interface StripStamp {
  kind: 'strip';
  ax: number;
  ay: number;
  bx: number;
  by: number;
  width: number;
  level: number;
  hue: Color;
}

export type Stamp = EllipseStamp | RingStamp | StripStamp;

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function boxOf(s: Stamp): Box {
  if (s.kind === 'strip') {
    const h = s.width / 2 + 1;
    return { x0: Math.floor(Math.min(s.ax, s.bx) - h), y0: Math.floor(Math.min(s.ay, s.by) - h / 2), x1: Math.ceil(Math.max(s.ax, s.bx) + h), y1: Math.ceil(Math.max(s.ay, s.by) + h / 2) };
  }
  return { x0: Math.floor(s.cx - s.rx), y0: Math.floor(s.cy - s.ry), x1: Math.ceil(s.cx + s.rx), y1: Math.ceil(s.cy + s.ry) };
}

/** Steps a stamp gives the pixel (x, y) (before dither: a quantised level, 0 = outside). */
function levelAt(s: Stamp, x: number, y: number): number {
  const px = x + 0.5;
  const py = y + 0.5;
  if (s.kind === 'strip') {
    const dx = s.bx - s.ax;
    const dy = (s.by - s.ay) * 2;
    const L2 = dx * dx + dy * dy;
    const qx = px - s.ax;
    const qy = (py - s.ay) * 2;
    const t = L2 > 0 ? Math.max(0, Math.min(1, (qx * dx + qy * dy) / L2)) : 0;
    const ex = qx - t * dx;
    const ey = qy - t * dy;
    const d = Math.sqrt(ex * ex + ey * ey) / (s.width / 2);
    if (d > 1) return 0;
    return d <= 0.45 ? s.level : Math.min(s.level, 1);
  }
  const ux = (px - s.cx) / s.rx;
  const uy = (py - s.cy) / s.ry;
  const d2 = ux * ux + uy * uy;
  if (d2 > 1) return 0;
  if (s.kind === 'ring') {
    const inner = Math.max(0, 1 - s.width / Math.max(1, s.rx));
    return d2 >= inner * inner ? s.level : 0;
  }
  const c = s.core ?? 0.55;
  return d2 <= c * c ? s.level : Math.min(s.level, 1);
}

// ---------------------------------------------------------------- the patch (one light's pixels)

let patchSeq = 0;

/**
 * One light's stepped pixels: an opaque image of exactly the lit pad pixels, redrawn only when its
 * stamps change (position / radius / level are whole pixels and quarter steps, so a steady light
 * costs nothing per frame).
 */
export class StepPatch {
  private readonly scene: Phaser.Scene;
  private readonly key: string;
  private tex: Phaser.Textures.CanvasTexture | null = null;
  readonly img: Phaser.GameObjects.Image;
  private sig = '';
  private shown = true;
  private dead = false;

  constructor(scene: Phaser.Scene, depth = STEP_DEPTH) {
    this.scene = scene;
    this.key = `light:step:${++patchSeq}`;
    this.img = scene.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(depth).setVisible(false);
  }

  /** Lit pixels in the patch now (QA). */
  pixels = 0;

  /** Show these stamps (an empty list / all levels 0 hides the patch). */
  draw(stamps: readonly Stamp[]): void {
    if (this.dead) return;
    const live = stamps.filter((s) => s.level > 0 && (s.kind === 'strip' || (s.rx >= 1 && s.ry >= 1)));
    const sig = live.map((s) => JSON.stringify(s)).join('|');
    if (sig === this.sig) return;
    this.sig = sig;
    if (!live.length) {
      this.pixels = 0;
      this.img.setVisible(false);
      return;
    }
    const b = live.map(boxOf).reduce((a, q) => ({ x0: Math.min(a.x0, q.x0), y0: Math.min(a.y0, q.y0), x1: Math.max(a.x1, q.x1), y1: Math.max(a.y1, q.y1) }));
    const x0 = Math.max(0, b.x0);
    const y0 = Math.max(0, b.y0);
    const x1 = Math.min(GAME_W - 1, b.x1);
    const y1 = Math.min(GAME_H - 1, b.y1);
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    if (w <= 0 || h <= 0) {
      this.pixels = 0;
      this.img.setVisible(false);
      return;
    }
    const data = new Uint8ClampedArray(w * h * 4);
    let lit = 0;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const base = padColorAt(x, y);
        if (base === null) continue;
        // the strongest stamp at this pixel lights it (its hue)
        let best = 0;
        let hue = 0;
        for (const s of live) {
          const l = levelAt(s, x, y);
          if (l > best) {
            best = l;
            hue = s.hue;
          }
        }
        const n = best > 0 ? stepsAt(best, x, y) : 0;
        if (n <= 0) continue;
        const c = stepTone(base, hue, n);
        if (c === base) continue;
        const o = ((y - y0) * w + (x - x0)) * 4;
        data[o] = (c >> 16) & 255;
        data[o + 1] = (c >> 8) & 255;
        data[o + 2] = c & 255;
        data[o + 3] = 255;
        lit++;
      }
    this.pixels = lit;
    if (!lit) {
      this.img.setVisible(false);
      return;
    }
    this.upload(data, w, h);
    this.img.setPosition(x0, y0).setVisible(this.shown);
  }

  private upload(data: Uint8ClampedArray, w: number, h: number): void {
    const tm = this.scene.textures;
    if (!this.tex || this.tex.width < w || this.tex.height < h) {
      const W = Math.max(w, this.tex?.width ?? 0);
      const H = Math.max(h, this.tex?.height ?? 0);
      if (this.tex) this.tex.setSize(W, H);
      else {
        this.tex = tm.createCanvas(this.key, W, H);
      }
      if (!this.tex) return;
      this.img.setTexture(this.key);
    }
    const ctx = this.tex.getContext();
    ctx.clearRect(0, 0, this.tex.width, this.tex.height);
    ctx.putImageData(new ImageData(data as unknown as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0);
    this.tex.refresh();
    this.img.setSizeToFrame();
  }

  setShown(on: boolean): void {
    this.shown = on;
    this.img.setVisible(on && this.pixels > 0);
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    if (this.img.active) this.img.destroy();
    if (this.tex) this.scene.textures.remove(this.key);
    this.tex = null;
  }
}
