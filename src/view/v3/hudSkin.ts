// HUD v3 skin — docs/v3/A6_PLAN.md F10 (lane A6-B, step B0), on the frozen frame language of contract
// S-1 (src/art/frame-v3.ts): a dark body in two flat bands (night1 over night0), a 1-px ink outline with
// cut corners and ONE 1-px trim (one tone lighter on the top / left edges, one darker on the bottom /
// right); no bevel, gradient, dither, alpha or ADD glow. Every pixel is a PAL tone — text included:
// glyphs are baked with an exact palette fill and an exact PAL.ink outline (never a multiply tint, whose
// outline would leave the palette), so the HUD region measures 100 % palette (tools/palcheck.mjs).
// The layout, sizes and hit areas are today's (layout.ts UI, v1 geometry — the v3 look forces it).
//
// Painters (pure PixelCanvas; node-safe — tests and tools import them):
//   styleRamp(style) / styleTrim(style, lift) / styleTone(style, step)   UiStyle → palette ramp / Trim
//   panelBodyV3(player)                 the LP panel body: bands, header rule, emblem, "LP" label
//   emblemV3(player)                    the player emblem (hexagon, trim ring, number)
//   buttonBodyV3(w, h, pressed)         a button body (frame without trim; 1 px of press room)
//   plateBodyV3(w, h, step)             a plate body (hint line, tooltip, phase bar, turn badge)
//   trimPixels(w, h, cut)               the light / dark pixels of a frame's trim (frameRectV3's own)
//   textCanvas(text, size, color)       a string as palette pixels (fill + 1-px ink outline, ×size)
//   recolorIcon(src, tones)             an ICON glyph (white / mist / steel / night3 + ink) re-toned
// Runtime helpers (Phaser objects, no Phaser runtime import — like ui-kit.ts):
//   PalText                             text as per-glyph images (exact palette, any string)
//   TrimGfx                             a trim drawn with Graphics (re-toned per state) + a running node
//   ButtonSkinV3                        the Button v3 branch (src/view/Button.ts)
//
//   const t = new PalText(scene, 8, capYV3('md', 5), 'OYUNCU 1', { size: 'md', color: PAL.cyan3 });
//   const trim = new TrimGfx(scene, container, 0, 0, 148, 64);  trim.set(styleTrim('p1', +1));
//   trim.runNode(true);                                         // the active panel's light node (F10)

import type Phaser from 'phaser';
import { frameRGBA } from '../../art/atlas';
import { FRAME_V3, frameRectV3, type Trim } from '../../art/frame-v3';
import { getFont } from '../../art/font';
import { PAL, RAMPS, type Ramp } from '../../art/palette';
import { PixelCanvas, type Pt } from '../../art/pixel';
import type { PlayerId } from '../../engine/types';
import { sanitizeText, textMetrics, type TextSize } from '../../ui/text';
import type { ButtonState, UiStyle } from '../ui-textures';
import { REDUCED_MOTION } from './motion';
import { rimPath } from './ui-kit';

// ================================================================ layout (today's v1 HUD geometry)

/** The HUD's geometry (unchanged from HudView v1; the v3 look always runs on the v1 board). */
export const HUD3 = Object.freeze({
  panel: Object.freeze({ w: 148, h: 64, header: 15 }),
  name: Object.freeze({ x: 8, cap: 5 }),
  lpLabel: Object.freeze({ x: 8, cap: 28 }),
  lp: Object.freeze({ x: 22, cap: 19 }),
  bar: Object.freeze({ x: 8, y: 37, w: 132, h: 4 }),
  emblem: Object.freeze({ x: 115, y: 13, w: 25, h: 23 }),
  /** Count groups (deck / hand / grave): icon left x; icons centred on cy. */
  counts: Object.freeze({ cy: 50, x: Object.freeze([8, 54, 100]) }),
  chip: Object.freeze({ w: 34, h: 11, y: 2, right: 6 }),
  phase: Object.freeze({ segW: 54, segX0: 4, cap: 5, sepY: 7, pillY: 1, pillH: 14 }),
  turn: Object.freeze({ dx: -46, w: 42, h: 16, labelX: 6, labelCap: 6, numCap: 5, numCx: 33 }),
  mainBtn: Object.freeze({ h: 25, y1: 1, y2: 30 }),
  toolbar: Object.freeze({ y: 4, h: 16 }),
  hint: Object.freeze({ y: 252, cx: 320, h: 17, padL: 16, padR: 8 }),
  /** The active panel's light node: one lap of the trim (F10: 2.4 s), then a rest before the next. */
  nodeLapMs: 2400,
  nodeRestMs: 1600,
  /** A button asking to be pressed (setAttention): the same node, a shorter trim. */
  attentionLapMs: 1400,
  attentionRestMs: 1000,
});

// ================================================================ tones

const NEUTRAL: Ramp = [PAL.night3, PAL.night4, PAL.steel, PAL.mist, PAL.white];

/** UiStyle → the ramp its v3 trim steps on and the trim's base step (the darker edge). */
const STYLE_RAMPS: Readonly<Record<UiStyle, { ramp: Ramp; base: number }>> = Object.freeze({
  neutral: { ramp: NEUTRAL, base: 2 },
  p1: { ramp: RAMPS.cyan, base: 2 },
  p2: { ramp: RAMPS.crim, base: 2 },
  gold: { ramp: RAMPS.gold, base: 2 },
  spell: { ramp: RAMPS.teal, base: 2 },
  trap: { ramp: RAMPS.mag, base: 2 },
  // SAVAŞ (style 'fire') wears crim2 / crim3 in v3 (F10), and so does a 'fire' hint flash (F5 tone)
  fire: { ramp: RAMPS.crim, base: 2 },
  leaf: { ramp: RAMPS.leaf, base: 2 },
  stone: { ramp: RAMPS.stone, base: 2 },
  void: { ramp: RAMPS.void, base: 2 },
});

/** The ramp a UiStyle's v3 trim steps on (dark → light). */
export function styleRamp(style: UiStyle): Ramp {
  return (STYLE_RAMPS[style] ?? STYLE_RAMPS.neutral).ramp;
}

/** The tone `step` steps above the style's trim base (0 = the trim's dark edge, 1 = its light edge); clamped. */
export function styleTone(style: UiStyle, step: number): number {
  const r = STYLE_RAMPS[style] ?? STYLE_RAMPS.neutral;
  return r.ramp[Math.max(0, Math.min(4, r.base + Math.round(step)))];
}

/** A style's trim, `lift` tones up (+1 hover / active, −2 disabled), like frame-v3's trimV3. */
export function styleTrim(style: UiStyle, lift = 0): Trim {
  return Object.freeze({ dark: styleTone(style, lift), light: styleTone(style, lift + 1) });
}

/** One flat tone for both edges (a white flash frame, a reject frame). */
export function flatTrim(c: number): Trim {
  return Object.freeze({ dark: c, light: c });
}

export function playerStyleV3(p: PlayerId): UiStyle {
  return p === 0 ? 'p1' : 'p2';
}

/** Hex of a colour for texture keys. */
export function hex(c: number): string {
  return c.toString(16).padStart(6, '0');
}

// ================================================================ text (palette pixels)

const SIZE: Readonly<Record<TextSize, { font: 'sm' | 'md'; k: number }>> = { sm: { font: 'sm', k: 1 }, md: { font: 'md', k: 1 }, lg: { font: 'md', k: 2 }, xl: { font: 'md', k: 3 } };

/** Text y so that the caps of `size` start at `capTop` (HudView's capY). */
export function capYV3(size: TextSize, capTop: number): number {
  return capTop - textMetrics(size).capTop;
}

/** One glyph placed in a laid-out line: its char, the quad's left x (game px) and the quad's width. */
export interface GlyphPlace {
  ch: string;
  code: number;
  x: number;
  w: number;
}

/**
 * Lay out one line exactly as pixelText() does with the outline font (letterSpacing −1: neighbours
 * share their outline column): glyph quads (ink width + 2) × k at pen × k, pen += ink width + 1.
 * Unknown characters are skipped (as the bitmap font does); spaces advance and draw nothing.
 */
export function layoutLine(text: string, size: TextSize): { glyphs: GlyphPlace[]; w: number; h: number } {
  const s = SIZE[size] ?? SIZE.sm;
  const f = getFont(s.font);
  const line = sanitizeText(text).split('\n')[0] ?? '';
  const glyphs: GlyphPlace[] = [];
  let pen = 0;
  let n = 0;
  for (const ch of line) {
    const code = ch.charCodeAt(0);
    const g = f.glyphs.get(code);
    if (!g) continue;
    if (ch !== ' ') glyphs.push({ ch, code, x: pen * s.k, w: (g.w + 2) * s.k });
    pen += g.w + 1;
    n++;
  }
  const w = n === 0 ? 0 : (pen - 1 + 2) * s.k;
  return { glyphs, w, h: (f.def.cellH + 2) * s.k };
}

/** Width in game px of one line of text at `size` (== measureText for one line). */
export function textWidthV3(text: string, size: TextSize): number {
  return layoutLine(text, size).w;
}

/** One glyph as palette pixels: fill `color`, 1-px PAL.ink 8-neighbour outline, scaled ×k (lg 2, xl 3). */
export function glyphCanvas(code: number, size: TextSize, color: number): PixelCanvas {
  const s = SIZE[size] ?? SIZE.sm;
  const f = getFont(s.font);
  const g = f.glyphs.get(code);
  const H = f.def.cellH;
  if (!g) return new PixelCanvas(1, H + 2);
  const p = new PixelCanvas(g.w + 2, H + 2);
  for (let j = 0; j < H; j++) for (let i = 0; i < g.w; i++) if (g.bits[j * g.w + i]) p.set(1 + i, 1 + j, color);
  p.outline(PAL.ink, { corners: true });
  return s.k > 1 ? p.scaled(s.k) : p;
}

/** A whole line as palette pixels (fill `color`, ink outline): the box pixelText() would draw. */
export function textCanvas(text: string, size: TextSize, color: number): PixelCanvas {
  const L = layoutLine(text, size);
  const p = new PixelCanvas(Math.max(1, L.w), L.h);
  for (const g of L.glyphs) p.blit(glyphCanvas(g.code, size, color), g.x, 0);
  return p;
}

/** Bake text into a canvas at (x, y) = the text box's top-left (as pixelText's position). */
export function paintText(p: PixelCanvas, x: number, y: number, text: string, size: TextSize, color: number): PixelCanvas {
  return p.blit(textCanvas(text, size, color), Math.round(x), Math.round(y));
}

// ================================================================ icons

/** Tones an ICON glyph is re-toned to: its white, mist, steel and night3 pixels (ink stays ink). */
export interface IconTones {
  w: number;
  m: number;
  s: number;
  n: number;
}

/** The icon tones of a style at a lift: white → light edge + 1, mist → light, steel → dark, night3 → dark − 1. */
export function iconTones(style: UiStyle, lift = 0): IconTones {
  return { w: styleTone(style, lift + 2), m: styleTone(style, lift + 1), s: styleTone(style, lift), n: styleTone(style, lift - 1) };
}

/** Disabled icon tones (night3 text, F10). */
export const ICON_DISABLED: IconTones = Object.freeze({ w: PAL.night4, m: PAL.night3, s: PAL.night3, n: PAL.night2 });

/**
 * Re-tone an ICON glyph (src/view/ui-textures ICON_ART: white / mist / steel / night3 art with a 1-px
 * ink outline) to palette tones. Any other colour is kept as it is (never seen in ICON art).
 */
export function recolorIcon(src: PixelCanvas, t: IconTones): PixelCanvas {
  const map = new Map<number, number>([
    [PAL.white, t.w],
    [PAL.mist, t.m],
    [PAL.steel, t.s],
    [PAL.night3, t.n],
  ]);
  return src.clone().map((c) => map.get(c) ?? c);
}

/** The ≡ menu glyph of the toolbar (HudView's menuIconTex, painted in palette tones). */
export function menuIconV3(t: IconTones): PixelCanvas {
  const p = new PixelCanvas(11, 11);
  for (const y of [2, 5, 8]) p.rect(2, y, 7, 2, y === 2 ? t.w : t.m);
  p.outline(PAL.ink);
  const b = p.bounds();
  return b ? p.crop(b.x, b.y, b.w, b.h) : p;
}

// ================================================================ frames

/**
 * The trim pixels of a w × h frame (frameRectV3's own geometry: inset 1, horizontal edges own the
 * corners), split by edge tone: `light` (top + left), `dark` (bottom + right).
 */
export function trimPixels(w: number, h: number, cut: number = FRAME_V3.cut): { light: Pt[]; dark: Pt[] } {
  // only the trim is painted on an empty canvas, so its two tones mark the two edge sets
  const LIGHT = PAL.white;
  const DARK = PAL.ink;
  const p = new PixelCanvas(Math.max(1, w), Math.max(1, h));
  frameRectV3(p, 0, 0, w, h, { light: LIGHT, dark: DARK }, { body: false, outline: false, cut });
  const light: Pt[] = [];
  const dark: Pt[] = [];
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const c = p.get(x, y);
      if (c === LIGHT) light.push([x, y]);
      else if (c === DARK) dark.push([x, y]);
    }
  return { light, dark };
}

/** A frame body without its trim (outline + the two bands); the trim is drawn on top (TrimGfx). */
export function bodyV3(w: number, h: number, opts: { split?: number; cut?: number; bands?: readonly [number, number] } = {}): PixelCanvas {
  const p = new PixelCanvas(w, h);
  frameRectV3(p, 0, 0, w, h, null, { split: opts.split, cut: opts.cut, bands: opts.bands });
  // the trim row / column is body colour underneath (TrimGfx covers it): paint it with the bands so a
  // missing trim never shows a hole
  return p;
}

/** A plate body (phase bar, turn badge, hint line, tooltip): `step` −2 / −1 / 0 = the appear steps. */
export function plateBodyV3(w: number, h: number, step = 0): PixelCanvas {
  const s = Math.max(-2, Math.min(0, Math.round(step)));
  return bodyV3(w, h, { bands: s === 0 ? [FRAME_V3.bodyTop, FRAME_V3.bodyBottom] : [PAL.night0, PAL.night0] });
}

/**
 * A button body: the frame (outline + bands) in rows 0 … h−2 (normal) or 1 … h−1 (pressed: the whole
 * face 1 px down, whole pixel, F10); the other row stays empty so the hit area never moves.
 */
export function buttonBodyV3(w: number, h: number, pressed: boolean): PixelCanvas {
  const p = new PixelCanvas(w, h);
  frameRectV3(p, 0, pressed ? 1 : 0, w, h - 1, null, {});
  return p;
}

/** The hexagonal player emblem (25 × 23): ink outline, a trim ring lit from the top left, two bands, the number. */
export function emblemV3(player: PlayerId): PixelCanvas {
  const { w, h } = HUD3.emblem;
  const R = player === 0 ? RAMPS.cyan : RAMPS.crim;
  const p = new PixelCanvas(w, h);
  const mid = (h - 1) / 2;
  const hexPts = (i: number): Pt[] => [
    [6 + i, i],
    [w - 7 - i, i],
    [w - 1 - i, mid],
    [w - 7 - i, h - 1 - i],
    [6 + i, h - 1 - i],
    [i, mid],
  ];
  // rings by successive fills: ink outline, the trim ring (dark tone), the body (lower band)
  p.poly(hexPts(0), PAL.ink);
  p.poly(hexPts(1), R[2]);
  p.poly(hexPts(2), FRAME_V3.bodyBottom);
  // light from the top left: the ring's upper half (and the left tip) one tone up; the body's upper band
  p.map((c, x, y) => {
    if (c === R[2]) return y < mid || (x < 3 && y <= mid) ? R[3] : R[2];
    if (c === FRAME_V3.bodyBottom) return y < mid ? FRAME_V3.bodyTop : FRAME_V3.bodyBottom;
    return c;
  });
  // the number, caps centred on the middle row (HudView v1: capY('md', -3) from the centre)
  const num = textCanvas(String(player + 1), 'md', R[3]);
  p.blit(num, 12 + Math.round(0.5 - num.w / 2), mid - 3 - textMetrics('md').capTop);
  return p;
}

/**
 * The LP panel body (148 × 64): outline, header band (night1) over the body (night0), a 1-px rule
 * under the header in the trim's dark tone, the emblem and the "LP" label. The trim, the name, the
 * digits, the bar and the counts are live objects on top (HudV3).
 */
export function panelBodyV3(player: PlayerId): PixelCanvas {
  const { w, h, header } = HUD3.panel;
  const p = bodyV3(w, h, { split: header });
  // header rule: night2, from the trim to the emblem (the emblem breaks it)
  p.hline(2, w - 3, header, PAL.night2);
  p.blit(emblemV3(player), HUD3.emblem.x, HUD3.emblem.y);
  paintText(p, HUD3.lpLabel.x, capYV3('sm', HUD3.lpLabel.cap), 'LP', 'sm', PAL.mist);
  return p;
}

/** The SIRA chip (34 × 11): a small plate with the owner's trim, the caret and "SIRA" in the light tone. */
export function chipV3(player: PlayerId, caretDx = 0): PixelCanvas {
  const { w, h } = HUD3.chip;
  const style = playerStyleV3(player);
  const t = styleTrim(style, 1);
  const p = new PixelCanvas(w, h);
  frameRectV3(p, 0, 0, w, h, t, { bands: [PAL.night1, PAL.night1] });
  // caret ▶ (3 × 5) and the word
  const cx = 4 + caretDx;
  for (let i = 0; i < 3; i++) p.vline(cx + i, 3 + i, 7 - i, t.light);
  paintText(p, 10, capYV3('sm', 3), 'SIRA', 'sm', styleTone(style, 3));
  return p;
}

// ================================================================ runtime helpers

/** Whole-pixel 1 × 1 rects drawn into a Graphics (exact palette colours, no texture). */
function px(g: Phaser.GameObjects.Graphics, pts: readonly Pt[], c: number, dx = 0, dy = 0): void {
  g.fillStyle(c, 1);
  for (const [x, y] of pts) g.fillRect(x + dx, y + dy, 1, 1);
}

/** Merge the rows of a pixel list into runs (fewer fillRects for long trims). */
function runs(pts: readonly Pt[]): { x: number; y: number; w: number; h: number }[] {
  const out: { x: number; y: number; w: number; h: number }[] = [];
  const rows = new Map<number, number[]>();
  for (const [x, y] of pts) {
    const r = rows.get(y);
    if (r) r.push(x);
    else rows.set(y, [x]);
  }
  for (const [y, xs] of rows) {
    xs.sort((a, b) => a - b);
    let s = xs[0];
    let prev = xs[0];
    for (let i = 1; i <= xs.length; i++) {
      const x = xs[i];
      if (x === prev + 1) {
        prev = x;
        continue;
      }
      out.push({ x: s, y, w: prev - s + 1, h: 1 });
      s = x;
      prev = x;
    }
  }
  return out;
}

/** Add a canvas as a static texture once (cached by key). */
export function canvasTexture(scene: Phaser.Scene, key: string, paint: () => PixelCanvas): string {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, paint().toCanvas());
  return key;
}

/** The texture of one glyph at a size and colour (cached). */
export function glyphTexture(scene: Phaser.Scene, code: number, size: TextSize, color: number): string {
  return canvasTexture(scene, `ui3:g:${size}:${hex(color)}:${code}`, () => glyphCanvas(code, size, color));
}

export interface PalTextOpts {
  size?: TextSize;
  color?: number;
}

/**
 * Text in exact palette pixels: one image per glyph (textures cached per size × colour × character,
 * so any string — a rolling LP number, a hint line — costs no new texture once its glyphs exist).
 * (x, y) is the text box's top-left, as pixelText(); whole pixels only.
 */
export class PalText {
  readonly root: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private glyphs: Phaser.GameObjects.Image[] = [];
  private _text = '';
  private _size: TextSize;
  private _color: number;
  private _w = 0;
  private _h = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, opts: PalTextOpts = {}) {
    this.scene = scene;
    this._size = opts.size ?? 'sm';
    this._color = opts.color ?? PAL.white;
    this.root = scene.add.container(Math.round(x), Math.round(y));
    this.setText(text);
  }

  get text(): string {
    return this._text;
  }
  get width(): number {
    return this._w;
  }
  get height(): number {
    return this._h;
  }
  get color(): number {
    return this._color;
  }
  get x(): number {
    return this.root.x;
  }
  get y(): number {
    return this.root.y;
  }

  setText(text: string): this {
    const s = String(text ?? '');
    if (s === this._text && this.glyphs.length) return this;
    this._text = s;
    this.rebuild();
    return this;
  }

  setColor(color: number): this {
    if (color === this._color) return this;
    this._color = color;
    const L = layoutLine(this._text, this._size);
    L.glyphs.forEach((g, i) => this.glyphs[i]?.setTexture(glyphTexture(this.scene, g.code, this._size, color)));
    return this;
  }

  setPosition(x: number, y: number): this {
    this.root.setPosition(Math.round(x), Math.round(y));
    return this;
  }

  setVisible(b: boolean): this {
    this.root.setVisible(b);
    return this;
  }

  destroy(): void {
    this.root.destroy();
    this.glyphs = [];
  }

  private rebuild(): void {
    const L = layoutLine(this._text, this._size);
    this._w = L.w;
    this._h = L.h;
    while (this.glyphs.length > L.glyphs.length) this.glyphs.pop()!.destroy();
    L.glyphs.forEach((g, i) => {
      const key = glyphTexture(this.scene, g.code, this._size, this._color);
      let img = this.glyphs[i];
      if (!img) {
        img = this.scene.add.image(g.x, 0, key).setOrigin(0, 0);
        this.root.add(img);
        this.glyphs.push(img);
      } else img.setTexture(key).setPosition(g.x, 0);
    });
  }
}

/** A running light node on a trim: head + tail tones, its lap and the rest between laps (ms). */
export interface TrimNode {
  head: number;
  tail: readonly number[];
  lapMs: number;
  restMs: number;
}

/**
 * A frame's trim drawn with Graphics in exact palette tones (set() re-tones it; no texture per
 * state) and an optional running light node along it (KO-3: "1 px kenar + koşan düğüm"). The node
 * runs on the scene clock (speed / hit-stop) through tick(dt); with REDUCED_MOTION it stays put (KO-9).
 */
export class TrimGfx {
  readonly g: Phaser.GameObjects.Graphics;
  readonly nodeG: Phaser.GameObjects.Graphics;
  private readonly light: { x: number; y: number; w: number; h: number }[];
  private readonly dark: { x: number; y: number; w: number; h: number }[];
  private readonly path: Pt[];
  private trim: Trim | null = null;
  private node: TrimNode | null = null;
  private t = 0;
  private dy = 0;

  /** (x, y) = the frame's top-left inside `parent`; w × h the frame (the trim sits 1 px inside). */
  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container | null, x: number, y: number, w: number, h: number, cut: number = FRAME_V3.cut) {
    const tp = trimPixels(w, h, cut);
    this.light = runs(tp.light);
    this.dark = runs(tp.dark);
    const tc = Math.max(0, cut - 1);
    this.path = rimPath(1, 1, w - 2, h - 2, tc);
    this.g = scene.add.graphics().setPosition(Math.round(x), Math.round(y));
    this.nodeG = scene.add.graphics().setPosition(Math.round(x), Math.round(y));
    if (parent) parent.add([this.g, this.nodeG]);
  }

  /** Re-tone the trim (null hides it). */
  set(trim: Trim | null): this {
    if (trim && this.trim && trim.light === this.trim.light && trim.dark === this.trim.dark) return this;
    this.trim = trim;
    this.redraw();
    return this;
  }

  get current(): Trim | null {
    return this.trim;
  }

  /** Shift the whole trim (and node) by dy px (a pressed button's face). */
  setOffsetY(dy: number): this {
    const d = Math.round(dy);
    if (d === this.dy) return this;
    this.dy = d;
    this.redraw();
    this.drawNode();
    return this;
  }

  /** Start (a TrimNode) or stop (null) the running node; a new node starts at the top-left. */
  setNode(node: TrimNode | null): this {
    this.node = node;
    this.t = 0;
    this.drawNode();
    return this;
  }

  get running(): boolean {
    return this.node !== null;
  }

  /** Advance the node by dt scene-ms (call from the owner's update). */
  tick(dt: number): void {
    if (!this.node) return;
    if (!REDUCED_MOTION) this.t += dt;
    this.drawNode();
  }

  setVisible(b: boolean): this {
    this.g.setVisible(b);
    this.nodeG.setVisible(b);
    return this;
  }

  destroy(): void {
    this.g.destroy();
    this.nodeG.destroy();
  }

  private redraw(): void {
    const g = this.g;
    g.clear();
    const t = this.trim;
    if (!t) return;
    g.fillStyle(t.light, 1);
    for (const r of this.light) g.fillRect(r.x, r.y + this.dy, r.w, r.h);
    g.fillStyle(t.dark, 1);
    for (const r of this.dark) g.fillRect(r.x, r.y + this.dy, r.w, r.h);
  }

  private drawNode(): void {
    const g = this.nodeG;
    g.clear();
    const n = this.node;
    const L = this.path.length;
    if (!n || L === 0) return;
    const cycle = n.lapMs + n.restMs;
    const k = ((this.t % cycle) + cycle) % cycle;
    if (k >= n.lapMs) return; // resting between laps
    const head = Math.min(L - 1, Math.floor((k / n.lapMs) * L));
    for (let i = n.tail.length; i >= 1; i--) {
      const j = head - i;
      if (j < 0) continue; // the tail does not wrap back over the seam
      px(g, [this.path[j]], n.tail[i - 1], 0, this.dy);
    }
    px(g, [this.path[head]], n.head, 0, this.dy);
  }
}

// ================================================================ Button v3 branch

/** What the Button hands its v3 skin (the Container and its parts). */
export interface ButtonHost {
  readonly scene: Phaser.Scene;
  readonly w: number;
  readonly h: number;
  add(child: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[]): unknown;
}

/** ICON art re-toned for a button / HUD (cached per icon key and tones). */
export function iconTexture(scene: Phaser.Scene, iconKey: string, t: IconTones): string | null {
  const key = `ui3:icon:${iconKey}:${hex(t.w)}${hex(t.m)}${hex(t.s)}${hex(t.n)}`;
  if (scene.textures.exists(key)) return key;
  if (!scene.textures.exists(iconKey)) return null;
  const src = iconCanvas(scene, iconKey);
  if (!src) return null;
  return canvasTexture(scene, key, () => recolorIcon(src, t));
}

/** Read an icon texture's pixels back into a PixelCanvas (ui-textures ICON art: opaque palette pixels). */
export function iconCanvas(scene: Phaser.Scene, key: string): PixelCanvas | null {
  const frame = scene.textures.getFrame(key);
  const data = frameRGBA(frame);
  if (!frame || !data) return null;
  const p = new PixelCanvas(frame.realWidth, frame.realHeight);
  if (data.length !== p.data.length) return null;
  p.data.set(data);
  // ICON art is opaque palette pixels or empty: snap any read-back edge alpha
  for (let i = 0; i < p.data.length; i += 4) {
    if (p.data[i + 3] < 128) p.data.fill(0, i, i + 4);
    else p.data[i + 3] = 255;
  }
  return p;
}

/**
 * The v3 look of a Button (F10): a dark body + one trim in the style's tones; label and icon in the
 * trim's light tone. Hover: trim one tone up, its first frame white; press: the face 1 px down (whole
 * pixel); disabled: trim two tones down, label night3; attention: a light node runs the trim (KO-3).
 * No glow, sheen, ADD flash or sparks. Button.ts owns the state machine and the input; this skin only
 * draws a state.
 */
export class ButtonSkinV3 {
  readonly bg: Phaser.GameObjects.Image;
  readonly content: Phaser.GameObjects.Container;
  private readonly trim: TrimGfx;
  private readonly host: ButtonHost;
  private label: PalText | null = null;
  private icon: Phaser.GameObjects.Image | null = null;
  private iconKey: string | null = null;
  private dead = false;
  private labelText = '';
  private size: TextSize = 'md';
  private style: UiStyle = 'neutral';
  private state: ButtonState = 'n';
  private attention = false;
  /** Frames left of a flat white trim (hover-in / click), counted on the scene clock. */
  private flashMs = 0;
  private readonly updateFn: (t: number, dt: number) => void;

  constructor(host: ButtonHost, opts: { label?: string; icon?: string | null; style?: UiStyle; size?: TextSize }) {
    this.host = host;
    const sc = host.scene;
    this.style = opts.style ?? 'neutral';
    this.size = opts.size ?? 'md';
    this.labelText = opts.label ?? '';
    this.iconKey = opts.icon ?? null;
    this.bg = sc.add.image(0, 0, this.bodyKey(false)).setOrigin(0);
    this.content = sc.add.container(0, 0);
    host.add([this.bg]);
    this.trim = new TrimGfx(sc, null, 0, 0, host.w, host.h - 1);
    host.add([this.trim.g, this.trim.nodeG, this.content]);
    this.buildContent();
    this.updateFn = (_t, dt) => this.tick(dt);
    sc.events.on('update', this.updateFn);
  }

  /** The hit target (input is wired on it by Button). */
  get hit(): Phaser.GameObjects.Image {
    return this.bg;
  }

  setStyle(style: UiStyle): void {
    this.style = style;
  }

  setLabel(s: string): void {
    this.labelText = s;
    this.buildContent();
  }

  setIcon(key: string | null): void {
    this.iconKey = key;
    this.buildContent();
  }

  setAttention(on: boolean): void {
    this.attention = on;
    this.applyNode();
  }

  /** A flat white trim for `ms` (hover-in: one frame; click / wake: two frames). */
  flash(ms = 17): void {
    this.flashMs = Math.max(this.flashMs, ms);
    this.drawTrim();
  }

  /** Draw a visual state (Button.visualState()). */
  apply(state: ButtonState): void {
    this.state = state;
    const pressed = state === 'p';
    this.bg.setTexture(this.bodyKey(pressed));
    this.content.y = pressed ? 1 : 0;
    this.trim.setOffsetY(pressed ? 1 : 0);
    this.drawTrim();
    this.toneContent();
    this.applyNode();
  }

  destroy(): void {
    this.dead = true;
    this.host.scene?.events?.off('update', this.updateFn);
    this.trim.destroy();
  }

  private tick(dt: number): void {
    // A button destroyed by an earlier 'update' listener of the same frame (a tween's onComplete,
    // a timer, the QA input) is still called once: the emitter walks the listener list it started
    // with. Its scene is gone by then.
    const sc = this.host.scene;
    if (this.dead || !sc) return;
    const k = sc.time?.timeScale ?? 1;
    if (this.flashMs > 0) {
      this.flashMs -= dt * k;
      if (this.flashMs <= 0) {
        this.flashMs = 0;
        this.drawTrim();
      }
    }
    this.trim.tick(dt * k);
  }

  private lift(): number {
    return this.state === 'd' ? -2 : this.state === 'h' || this.state === 'p' ? 1 : 0;
  }

  private drawTrim(): void {
    this.trim.set(this.flashMs > 0 && this.state !== 'd' ? flatTrim(PAL.white) : styleTrim(this.style, this.lift()));
  }

  private applyNode(): void {
    const on = this.attention && this.state !== 'd';
    if (on === this.trim.running) return;
    this.trim.setNode(
      on
        ? { head: PAL.white, tail: [styleTone(this.style, 3), styleTone(this.style, 2)], lapMs: HUD3.attentionLapMs, restMs: HUD3.attentionRestMs }
        : null,
    );
  }

  private toneContent(): void {
    const d = this.state === 'd';
    const lift = this.lift();
    this.label?.setColor(d ? PAL.night3 : styleTone(this.style, lift + 1));
    if (this.icon && this.iconKey) {
      const k = iconTexture(this.host.scene, this.iconKey, d ? ICON_DISABLED : iconTones(this.style, lift));
      if (k) this.icon.setTexture(k);
    }
  }

  private bodyKey(pressed: boolean): string {
    const { w, h } = this.host;
    return canvasTexture(this.host.scene, `ui3:btn:${w}x${h}:${pressed ? 'p' : 'n'}`, () => buttonBodyV3(w, h, pressed));
  }

  private buildContent(): void {
    const sc = this.host.scene;
    this.content.removeAll(true);
    this.label?.destroy();
    this.label = null;
    this.icon = null;
    const faceH = this.host.h - 1;
    const gap = this.labelText && this.iconKey ? 4 : 0;
    let iw = 0;
    let ih = 0;
    let iconTex: string | null = null;
    if (this.iconKey) {
      iconTex = iconTexture(sc, this.iconKey, iconTones(this.style, 0));
      const f = iconTex ? sc.textures.getFrame(iconTex) : null;
      iw = f?.width ?? 0;
      ih = f?.height ?? 0;
    }
    const tw = this.labelText ? textWidthV3(this.labelText, this.size) : 0;
    const capTop = textMetrics(this.size).capTop;
    const capH = textMetrics(this.size).capHeight;
    let x = Math.round((this.host.w - (iw + gap + tw)) / 2);
    const cy = Math.floor(faceH / 2);
    if (iconTex) {
      this.icon = sc.add.image(x, Math.round(cy - ih / 2), iconTex).setOrigin(0);
      this.content.add(this.icon);
      x += iw + gap;
    }
    if (this.labelText) {
      const ty = Math.round(cy - capH / 2 - capTop);
      this.label = new PalText(sc, x, ty, this.labelText, { size: this.size, color: styleTone(this.style, 1) });
      this.content.add(this.label.root);
    }
    this.toneContent();
  }
}
