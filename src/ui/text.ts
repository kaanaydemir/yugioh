// Pixel text API (contract). Bitmap fonts are hand-drawn in src/art/font.ts and registered
// as Phaser bitmap fonts at boot (src/boot/10-fonts.ts).
//
//   const t = pixelText(scene, 320, 40, 'DÜELLO!', { size: 'xl', color: PAL.gold3, originX: 0.5 });
//   t.setText('KAZANDIN');            // re-wraps / sanitizes like the original call
//   measureText('LP 4000', 'lg');     // exact box in game pixels
//
// Sizes: sm = body font (5px caps), md = bold UI font (7px caps), lg = md ×2, xl = md ×3.
// The text box is the glyph CELL: it includes room above the caps for Turkish accents and
// below the baseline for descenders (see textMetrics()). Boxes are exact to the ink: with
// outline the box includes the 1px outline on every side.
//
// Color: glyphs are white in the texture and colored with setTint (multiply), so any color
// works and the outline stays near-black. setTintFill(PAL.white) gives a solid flash frame.
import type Phaser from 'phaser';
import { PAL } from '../art/palette';
import { bitmapFontData, buildFontAtlas, getFont, phantomCode, type FontId } from '../art/font';

/**
 * sm — small body font (card text, labels). md — bold UI font (buttons, names).
 * lg — md at 2× (banners, LP numbers). xl — md at 3× (DÜELLO!, KAZANDIN).
 */
export type TextSize = 'sm' | 'md' | 'lg' | 'xl';

export interface TextOpts {
  size?: TextSize;
  /** Fill color 0xRRGGBB (default PAL.white). */
  color?: number;
  /** 1px dark outline around glyphs (default true) — keeps text readable over busy art. */
  outline?: boolean;
  align?: 'left' | 'center' | 'right';
  /** Word-wrap width in pixels (unscaled game pixels). */
  maxWidth?: number;
  /** Phaser origin; default (0, 0). */
  originX?: number;
  originY?: number;
  /**
   * Extra: solid PAL.ink drop shadow offset down-right, in FONT pixels (scaled with the
   * size, so 1 = 3 game px at xl). Gives titles a chunky extruded look. Default 0.
   */
  shadow?: number;
  /** Extra: added to the line pitch in font pixels (negative tightens). Default 0. */
  lineSpacing?: number;
}

export const TEXT_SIZES: readonly TextSize[] = ['sm', 'md', 'lg', 'xl'];

const SIZE_SPEC: Record<TextSize, { font: FontId; scale: number }> = {
  sm: { font: 'sm', scale: 1 },
  md: { font: 'md', scale: 1 },
  lg: { font: 'md', scale: 2 },
  xl: { font: 'md', scale: 3 },
};

/** Size spec with a safe fallback for bad input (unknown size → sm). */
function spec(size: TextSize | undefined): { font: FontId; scale: number } {
  return (size && SIZE_SPEC[size]) || SIZE_SPEC.sm;
}

/** Phaser bitmap-font cache / texture key for a size + outline variant. */
export function fontKey(size: TextSize, outline = true): string {
  return `font:${spec(size).font}${outline ? '' : ':plain'}`;
}

// ---------------------------------------------------------------- registration

/** Called once from BootScene (src/boot/10-fonts.ts). Idempotent; pixelText() calls it lazily too. */
export function registerFonts(scene: Phaser.Scene): void {
  for (const font of ['sm', 'md'] as const) {
    for (const outline of [true, false]) {
      const key = `font:${font}${outline ? '' : ':plain'}`;
      if (scene.cache.bitmapFont.exists(key) && scene.textures.exists(key)) continue;
      const atlas = buildFontAtlas(font, outline);
      if (scene.textures.exists(key)) scene.textures.remove(key);
      scene.textures.addCanvas(key, atlas.canvas.toCanvas());
      scene.cache.bitmapFont.add(key, { data: bitmapFontData(atlas, key), texture: key, frame: null });
    }
  }
}

// ---------------------------------------------------------------- Turkish helpers

/** Turkish-aware uppercase: i → İ, ı → I (use this, never plain toUpperCase()). */
export function upper(s: string): string {
  return s.toLocaleUpperCase('tr');
}

/** Turkish-aware lowercase: I → ı, İ → i. */
export function lower(s: string): string {
  return s.toLocaleLowerCase('tr');
}

const FALLBACK: Record<string, string> = {
  '\u00a0': ' ',
  '\u2009': ' ',
  '\u202f': ' ',
  '“': '"',
  '”': '"',
  '„': '"',
  '‘': "'",
  '’': "'",
  '‚': ',',
  '«': '<',
  '»': '>',
  '‹': '<',
  '›': '>',
  '−': '-',
  '‐': '-',
  '‑': '-',
  '☆': '★',
  '❤': '♥',
  '⇒': '→',
  '⇐': '←',
  '✕': '×',
  '✖': '×',
  '∙': '·',
};

/**
 * Make any string drawable: NFC, Turkish dotted-i cleanup (i + U+0307 → i), tabs → spaces,
 * unknown letters → their base letter (é → e), anything else → '?'.
 */
export function sanitizeText(text: string | number): string {
  const s = String(text).normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, '  ').replace(/i\u0307/g, 'i');
  const sm = getFont('sm').glyphs;
  let out = '';
  for (const ch of s) {
    if (ch === '\n' || sm.has(ch.charCodeAt(0))) {
      out += ch;
      continue;
    }
    const mapped = FALLBACK[ch] ?? ch.normalize('NFD')[0];
    if (mapped && mapped !== ch && sm.has(mapped.charCodeAt(0))) out += mapped;
    else if (!/\p{M}/u.test(ch)) out += '?'; // stray combining marks are dropped
  }
  return out;
}

// ---------------------------------------------------------------- measuring + wrapping

/** Width of one line in FONT pixels (exact to the ink, incl. outline). */
function lineWidthFont(font: FontId, line: string, outline: boolean): number {
  const glyphs = getFont(font).glyphs;
  let w = 0;
  let n = 0;
  for (let i = 0; i < line.length; i++) {
    const g = glyphs.get(line.charCodeAt(i));
    if (!g) continue;
    w += g.w + 1;
    n++;
  }
  return n === 0 ? 0 : w - 1 + (outline ? 2 : 0);
}

/** Break opportunities: spaces, plus after '/' '-' '—' inside words (Büyü/Tuzak). */
const SEGMENT = / +|[^ ]+?[/\-–—](?=[^ ])|[^ ]+/g;

function wrapParagraph(p: string, fits: (s: string) => boolean): string[] {
  const segs = p.match(SEGMENT) ?? [''];
  const lines: string[] = [];
  let cur = '';
  let space = '';
  const pushLong = (word: string) => {
    // hard-break a word that alone is wider than the box
    let piece = '';
    for (const ch of word) {
      if (piece && !fits(piece + ch)) {
        lines.push(piece);
        piece = ch;
      } else piece += ch;
    }
    cur = piece;
  };
  for (const seg of segs) {
    if (seg[0] === ' ') {
      if (cur || lines.length === 0) space += seg;
      continue;
    }
    const cand = cur + space + seg;
    if (fits(cand)) cur = cand;
    else if (!cur) pushLong(space + seg);
    else {
      lines.push(cur);
      if (fits(seg)) cur = seg;
      else pushLong(seg);
    }
    space = '';
  }
  lines.push(cur);
  return lines;
}

/** Sanitized + wrapped lines exactly as pixelText() lays them out. */
export function wrapText(text: string | number, size: TextSize = 'sm', maxWidth?: number, outline = true): string[] {
  const { font, scale } = spec(size);
  const paras = sanitizeText(text).split('\n');
  if (!maxWidth || maxWidth <= 0) return paras;
  const fits = (s: string) => lineWidthFont(font, s, outline) * scale <= maxWidth;
  return paras.flatMap((p) => wrapParagraph(p, fits));
}

/** Size in game pixels of `text` rendered at `size` (after wrapping to maxWidth if given). */
export function measureText(text: string, size: TextSize = 'sm', maxWidth?: number, outline = true, lineSpacing = 0): { w: number; h: number } {
  const { font, scale } = spec(size);
  const lines = wrapText(text, size, maxWidth, outline);
  const def = getFont(font).def;
  const glyphs = getFont(font).glyphs;
  let w = 0;
  let last = -1;
  lines.forEach((l, i) => {
    w = Math.max(w, lineWidthFont(font, l, outline));
    for (let k = 0; k < l.length; k++) if (glyphs.has(l.charCodeAt(k))) last = i;
  });
  const pitch = def.cellH + 1 + lineSpacing;
  const h = last < 0 ? 0 : last * pitch + def.cellH + (outline ? 2 : 0);
  return { w: w * scale, h: h * scale };
}

export interface TextMetrics {
  /** Integer zoom of the font (1, 1, 2, 3). */
  scale: number;
  /** Distance between consecutive lines' tops. */
  lineHeight: number;
  /** Height of a one-line text box. */
  height: number;
  /** y of the first cap row inside the box. */
  capTop: number;
  capHeight: number;
  /** y of the first x-height row inside the box. */
  xTop: number;
  /** y just below the baseline row (where descenders start). */
  baseline: number;
}

/** Vertical metrics in game pixels, relative to a text box's top edge. */
export function textMetrics(size: TextSize = 'sm', outline = true): TextMetrics {
  const { font, scale } = spec(size);
  const d = getFont(font).def;
  const o = outline ? 1 : 0;
  return {
    scale,
    lineHeight: (d.cellH + 1) * scale,
    height: (d.cellH + 2 * o) * scale,
    capTop: (d.capTop + o) * scale,
    capHeight: d.capH * scale,
    xTop: (d.xTop + o) * scale,
    baseline: (d.baseline + 1 + o) * scale,
  };
}

// ---------------------------------------------------------------- game objects

interface PixelTextState {
  size: TextSize;
  outline: boolean;
  maxWidth?: number;
  /** Last unwrapped text given to setText(). */
  source: string;
  /** Phaser's own setText (no sanitizing / wrapping). */
  raw: (value: string) => Phaser.GameObjects.BitmapText;
}

function configure(t: Phaser.GameObjects.BitmapText, size: TextSize, opts: TextOpts): void {
  const outline = opts.outline ?? true;
  const { scale } = spec(size);
  t.setLetterSpacing(outline ? -1 : 1);
  t.setLineSpacing((outline ? -1 : 1) + (opts.lineSpacing ?? 0));
  t.setTint(opts.color ?? PAL.white);
  if (opts.shadow) t.setDropShadow(opts.shadow * scale, opts.shadow * scale, PAL.ink, 1);
}

/** Create crisp pixel text. Supports Turkish letters (ç ğ ı İ ö ş ü Ç Ğ Ö Ş Ü). */
export function pixelText(scene: Phaser.Scene, x: number, y: number, text: string, opts: TextOpts = {}): Phaser.GameObjects.BitmapText {
  registerFonts(scene);
  const size = opts.size ?? 'sm';
  const outline = opts.outline ?? true;
  const { font, scale } = spec(size);
  const t = scene.add.bitmapText(Math.round(x), Math.round(y), fontKey(size, outline), '', getFont(font).def.capH * scale);
  configure(t, size, opts);
  const align = opts.align ?? 'left';
  if (align === 'center') t.setCenterAlign();
  else if (align === 'right') t.setRightAlign();
  else t.setLeftAlign();
  t.setOrigin(opts.originX ?? 0, opts.originY ?? 0);

  // setText() keeps sanitizing + wrapping like this call did.
  const rawSetText = t.setText;
  const state: PixelTextState = { size, outline, maxWidth: opts.maxWidth, source: '', raw: (v) => rawSetText.call(t, v) };
  t.setText = ((value: string | number | string[]) => {
    state.source = String(Array.isArray(value) ? value.join('\n') : (value ?? ''));
    return rawSetText.call(t, wrapText(state.source, state.size, state.maxWidth, state.outline).join('\n'));
  }) as typeof t.setText;
  t.setData('pixelText', state);
  t.setText(text);
  return t;
}

/**
 * Extra: show only the first `count` characters (spaces and line breaks not counted) of a
 * pixelText() object. Hidden characters keep their advance, so the layout, bounds and
 * origin never move while text is revealed. revealText(t, Infinity) shows everything.
 * Returns the number of revealable characters.
 */
export function revealText(t: Phaser.GameObjects.BitmapText, count: number): number {
  const state = t.getData('pixelText') as PixelTextState | undefined;
  if (!state) return 0;
  const full = wrapText(state.source, state.size, state.maxWidth, state.outline).join('\n');
  let shown = 0;
  let out = '';
  for (const ch of full) {
    if (ch === '\n' || ch === ' ') {
      out += ch;
      continue;
    }
    out += shown < count ? ch : String.fromCharCode(phantomCode(ch.charCodeAt(0)) || 32);
    shown++;
  }
  state.raw(out);
  return shown;
}

/**
 * Extra: promise-based typewriter on a pixelText() object (scene time, so it follows the
 * global speed). `cps` = characters per second. `onChar` fires per revealed character
 * (hook a typing blip there). Resolves when the whole text is visible.
 */
export function typeText(
  scene: Phaser.Scene,
  t: Phaser.GameObjects.BitmapText,
  cps = 45,
  onChar?: (ch: string, index: number) => void,
): Promise<void> {
  const total = revealText(t, 0);
  const chars = [...sanitizeText((t.getData('pixelText') as PixelTextState | undefined)?.source ?? '')].filter((c) => c !== ' ' && c !== '\n');
  if (total === 0) return Promise.resolve();
  return new Promise((resolve) => {
    let n = 0;
    scene.time.addEvent({
      delay: 1000 / Math.max(1, cps),
      repeat: total - 1,
      callback: () => {
        n++;
        if (!t.active) return resolve();
        revealText(t, n);
        onChar?.(chars[n - 1] ?? '', n - 1);
        if (n >= total) resolve();
      },
    });
  });
}

/** Change the wrap width of a pixelText() object and re-layout its text. Extra helper. */
export function setTextMaxWidth(t: Phaser.GameObjects.BitmapText, maxWidth: number | undefined): void {
  const state = t.getData('pixelText') as PixelTextState | undefined;
  if (!state) return;
  state.maxWidth = maxWidth;
  t.setText(state.source);
}

export interface PixelLetter {
  /** One BitmapText per visible character, origin (0.5, 0.5) at the glyph cell center. */
  obj: Phaser.GameObjects.BitmapText;
  ch: string;
  /** Resting position (where it sits in the laid-out word). */
  x: number;
  y: number;
  /** Line and index of the character in reading order. */
  line: number;
  index: number;
}

/**
 * Extra: lay out `text` exactly like pixelText() would, but as one object per character so
 * banners can animate letters individually (drop-in, squash, wave, shake). Origin options
 * place the whole block; every letter is centered on its own cell for scale/rotate tweens.
 * Returns the letters plus the block's box (left/top/width/height in game pixels).
 */
export function pixelLetters(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  opts: TextOpts = {},
): { letters: PixelLetter[]; left: number; top: number; w: number; h: number } {
  registerFonts(scene);
  const size = opts.size ?? 'sm';
  const outline = opts.outline ?? true;
  const { font, scale } = spec(size);
  const f = getFont(font);
  const lines = wrapText(text, size, opts.maxWidth, outline);
  const box = measureText(text, size, opts.maxWidth, outline, opts.lineSpacing ?? 0);
  const left = Math.round(x) - (opts.originX ?? 0) * box.w;
  const top = Math.round(y) - (opts.originY ?? 0) * box.h;
  const widths = lines.map((l) => lineWidthFont(font, l, outline) * scale);
  const longest = Math.max(0, ...widths);
  const pitch = (f.def.cellH + 1 + (opts.lineSpacing ?? 0)) * scale;
  const quadH = (f.def.cellH + (outline ? 2 : 0)) * scale;
  const letters: PixelLetter[] = [];
  let index = 0;
  lines.forEach((line, li) => {
    const off = opts.align === 'center' ? (longest - widths[li]) / 2 : opts.align === 'right' ? longest - widths[li] : 0;
    let pen = 0;
    for (const ch of line) {
      const g = f.glyphs.get(ch.charCodeAt(0));
      if (!g) continue;
      if (ch !== ' ') {
        const qw = (g.w + (outline ? 2 : 0)) * scale;
        const cx = left + off + pen * scale + qw / 2;
        const cy = top + li * pitch + quadH / 2;
        const obj = scene.add.bitmapText(cx, cy, fontKey(size, outline), ch, f.def.capH * scale);
        configure(obj, size, opts);
        obj.setOrigin(0.5, 0.5);
        letters.push({ obj, ch, x: cx, y: cy, line: li, index: index++ });
      }
      pen += g.w + 1;
    }
  });
  return { letters, left, top, w: box.w, h: box.h };
}
