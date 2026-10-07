// Hand-designed proportional bitmap fonts for Neon Düello + the atlas builders behind
// src/ui/text.ts.
//
// Two fonts, both authored here as glyph bitmaps ('#' = ink, '.' = empty):
//
//   sm — body font. Cap height 5, x-height 4, 2px descenders. Card text, labels.
//   md — bold UI/title font. Cap height 7, x-height 5, 3px descenders, 2px stems.
//        (lg = md at 2×, xl = md at 3× — scaled by the text API, never redrawn.)
//
// Every glyph lives in a fixed-height CELL so lines stack on a shared baseline. The cell
// reserves room above the caps for Turkish accents (Ğ breve, Ü/Ö dots, İ dot, Â caret)
// and room below the baseline for descenders and cedillas (Ç Ş ç ş), so diacritics of one
// line never touch the line above or below:
//
//   sm (10 rows)                     md (13 rows)
//   0  Ğ breve top / Â caret         0-1  uppercase accents (2 rows)
//   1  Ü Ö İ dots, Ğ breve bottom    2    gap
//   2  gap  | lowercase dots ü ö i   3-9  caps (5-9 = x-height)
//   3-7 caps (4-7 = x-height)        2-3  lowercase accents, 4 gap
//   8-9 descenders, cedillas         10-12 descenders, cedillas
//
// Glyph spec: [topRow, 'row row row ...'] — rows are space separated, all the same width;
// the first row lands on `topRow` of the cell. Width = row length (proportional font).
// Digits are tabular (all the same width) so counting LP numbers never wobble.
//
// Atlas: each glyph is baked twice — `outline` (white fill + 1px PAL.ink 8-neighbour
// outline, quad = (w+2)×(cellH+2)) and `plain` (white fill only, quad = w×cellH). Fill is
// pure white so a Phaser tint gives the exact palette color; the ink stays near-black.

import { PAL } from './palette';
import { PixelCanvas } from './pixel';

export type FontId = 'sm' | 'md';

export interface FontDef {
  id: FontId;
  /** Rows in a glyph cell (without outline). */
  cellH: number;
  /** First row of capitals / ascenders. */
  capTop: number;
  capH: number;
  /** First row of lowercase x-height. */
  xTop: number;
  /** Last row that sits ON the baseline (bottom of 'H'). */
  baseline: number;
  /** Width of the word space (pen advance is width + 1 like every glyph). */
  spaceW: number;
  glyphs: Record<string, readonly [number, string]>;
}

// ============================================================================ sm

const SM_GLYPHS: Record<string, readonly [number, string]> = {
  // ---- uppercase (rows 3-7)
  A: [3, '.##. #..# #### #..# #..#'],
  B: [3, '###. #..# ###. #..# ###.'],
  C: [3, '.### #... #... #... .###'],
  D: [3, '###. #..# #..# #..# ###.'],
  E: [3, '#### #... ###. #... ####'],
  F: [3, '#### #... ###. #... #...'],
  G: [3, '.### #... #.## #..# .###'],
  H: [3, '#..# #..# #### #..# #..#'],
  I: [3, '### .#. .#. .#. ###'],
  J: [3, '...# ...# ...# #..# .##.'],
  K: [3, '#..# #.#. ##.. #.#. #..#'],
  L: [3, '#... #... #... #... ####'],
  M: [3, '#...# ##.## #.#.# #...# #...#'],
  N: [3, '#..# ##.# #.## #..# #..#'],
  O: [3, '.###. #...# #...# #...# .###.'],
  P: [3, '###. #..# ###. #... #...'],
  Q: [3, '.###. #...# #...# #..#. .##.#'],
  R: [3, '###. #..# ###. #.#. #..#'],
  S: [3, '.### #... .##. ...# ###.'],
  T: [3, '##### ..#.. ..#.. ..#.. ..#..'],
  U: [3, '#..# #..# #..# #..# .##.'],
  V: [3, '#...# #...# .#.#. .#.#. ..#..'],
  W: [3, '#...# #...# #.#.# ##.## #...#'],
  X: [3, '#...# .#.#. ..#.. .#.#. #...#'],
  Y: [3, '#...# .#.#. ..#.. ..#.. ..#..'],
  Z: [3, '#### ...# .##. #... ####'],

  // ---- Turkish + circumflex uppercase
  Ç: [3, '.### #... #... #... .### ..#. .#..'],
  Ğ: [0, '#..# .##. .... .### #... #.## #..# .###'],
  İ: [1, '.#. ... ### .#. .#. .#. ###'],
  Ö: [1, '.#.#. ..... .###. #...# #...# #...# .###.'],
  Ş: [3, '.### #... .##. ...# ###. .#.. #...'],
  Ü: [1, '#..# .... #..# #..# #..# #..# .##.'],
  Â: [0, '.##. #..# .... .##. #..# #### #..# #..#'],
  Î: [0, '.#. #.# ... ### .#. .#. .#. ###'],
  Û: [0, '.##. #..# .... #..# #..# #..# #..# .##.'],

  // ---- lowercase (x-height rows 4-7, ascenders from 3, descenders 8-9)
  a: [4, '.### #..# #..# .###'],
  b: [3, '#... ###. #..# #..# ###.'],
  c: [4, '.## #.. #.. .##'],
  d: [3, '...# .### #..# #..# .###'],
  e: [4, '.##. #### #... .###'],
  f: [3, '.## ### .#. .#. .#.'],
  g: [4, '.### #..# #..# .### ...# ###.'],
  h: [3, '#... ###. #..# #..# #..#'],
  i: [2, '# . # # # #'],
  ı: [4, '# # # #'],
  j: [2, '.# .. .# .# .# .# .# #.'],
  k: [3, '#... #.#. ##.. #.#. #..#'],
  l: [3, '#. #. #. #. .#'],
  m: [4, '####. #.#.# #.#.# #.#.#'],
  n: [4, '###. #..# #..# #..#'],
  o: [4, '.##. #..# #..# .##.'],
  p: [4, '###. #..# #..# ###. #... #...'],
  q: [4, '.### #..# #..# .### ...# ...#'],
  r: [4, '#.## ##.. #... #...'],
  s: [4, '.### ##.. ..## ###.'],
  t: [3, '.#. ### .#. .#. .##'],
  u: [4, '#..# #..# #..# .###'],
  v: [4, '#..# #..# .##. .##.'],
  w: [4, '#...# #...# #.#.# .#.#.'],
  x: [4, '#..# .##. .##. #..#'],
  y: [4, '#..# #..# #..# .### ...# ###.'],
  z: [4, '#### ..#. .#.. ####'],

  // ---- Turkish + circumflex lowercase
  ç: [4, '.## #.. #.. .## .#. #..'],
  ğ: [1, '#..# .##. .... .### #..# #..# .### ...# ###.'],
  ö: [2, '#..# .... .##. #..# #..# .##.'],
  ş: [4, '.### ##.. ..## ###. .#.. #...'],
  ü: [2, '#..# .... #..# #..# #..# .###'],
  â: [1, '.##. #..# .... .### #..# #..# .###'],
  î: [1, '.#. #.# ... .#. .#. .#. .#.'],
  û: [1, '.##. #..# .... #..# #..# #..# .###'],

  // ---- digits (tabular, 4 wide)
  '0': [3, '.##. #..# #..# #..# .##.'],
  '1': [3, '.#.. ##.. .#.. .#.. ###.'],
  '2': [3, '###. ...# .##. #... ####'],
  '3': [3, '###. ...# .##. ...# ###.'],
  '4': [3, '#..# #..# #### ...# ...#'],
  '5': [3, '#### #... ###. ...# ###.'],
  '6': [3, '.##. #... ###. #..# .##.'],
  '7': [3, '#### ...# ..#. .#.. .#..'],
  '8': [3, '.##. #..# .##. #..# .##.'],
  '9': [3, '.##. #..# .### ...# .##.'],

  // ---- punctuation
  '.': [7, '#'],
  ',': [7, '.# #.'],
  ':': [5, '# . #'],
  ';': [5, '.# .. .# #.'],
  '!': [3, '# # # . #'],
  '?': [3, '##. ..# .#. ... .#.'],
  "'": [3, '# #'],
  '"': [3, '#.# #.#'],
  '-': [5, '###'],
  '+': [4, '.#. ### .#.'],
  '/': [3, '..# ..# .#. #.. #..'],
  '\\': [3, '#.. #.. .#. ..# ..#'],
  '(': [3, '.# #. #. #. .#'],
  ')': [3, '#. .# .# .# #.'],
  '[': [3, '## #. #. #. ##'],
  ']': [3, '## .# .# .# ##'],
  '{': [3, '.## .#. ##. .#. .##'],
  '}': [3, '##. .#. .## .#. ##.'],
  '%': [3, '#...# ...#. ..#.. .#... #...#'],
  '*': [3, '#.# .#. #.#'],
  '#': [3, '.#.#. ##### .#.#. ##### .#.#.'],
  '&': [3, '.#... #.#.. .#.#. #..#. .##.#'],
  '=': [4, '### ... ###'],
  '<': [3, '..# .#. #.. .#. ..#'],
  '>': [3, '#.. .#. ..# .#. #..'],
  '_': [8, '####'],
  '|': [3, '# # # # # #'],
  '^': [3, '.#. #.#'],
  '~': [4, '.#.# #.#.'],
  '`': [3, '#. .#'],
  $: [2, '.#. .## #.. .#. ..# ##. .#.'],
  '@': [3, '.###. #..## #.#.# #.### .#...'],
  '°': [3, '.#. #.# .#.'],
  '·': [5, '#'],
  '•': [4, '.#. ### .#.'],
  '…': [7, '#.#.#'],
  '–': [5, '####'],
  '—': [5, '#####'],
  '★': [3, '..#.. ..#.. ##### .###. .#.#.'],
  '♥': [3, '##.## ##### ##### .###. ..#..'],
  '→': [3, '..#.. ...#. ##### ...#. ..#..'],
  '←': [3, '..#.. .#... ##### .#... ..#..'],
  '↑': [3, '..#.. .###. #.#.# ..#.. ..#..'],
  '↓': [3, '..#.. ..#.. #.#.# .###. ..#..'],
  '×': [4, '#.# .#. #.#'],
  '≥': [3, '##.. ..## ##.. .... ####'],
  '≤': [3, '..## ##.. ..## .... ####'],
  '±': [3, '.#. ### .#. ... ###'],
};

// ============================================================================ md (bold)

const MD_GLYPHS: Record<string, readonly [number, string]> = {
  // ---- uppercase (rows 3-9)
  A: [3, '.####. ##..## ##..## ###### ##..## ##..## ##..##'],
  B: [3, '#####. ##..## ##..## #####. ##..## ##..## #####.'],
  C: [3, '.####. ##..## ##.... ##.... ##.... ##..## .####.'],
  D: [3, '#####. ##..## ##..## ##..## ##..## ##..## #####.'],
  E: [3, '##### ##... ##... ####. ##... ##... #####'],
  F: [3, '##### ##... ##... ####. ##... ##... ##...'],
  G: [3, '.####. ##..## ##.... ##.### ##..## ##..## .####.'],
  H: [3, '##..## ##..## ##..## ###### ##..## ##..## ##..##'],
  I: [3, '#### .##. .##. .##. .##. .##. ####'],
  J: [3, '....## ....## ....## ....## ##..## ##..## .####.'],
  K: [3, '##..## ##.##. ####.. ###... ####.. ##.##. ##..##'],
  L: [3, '##... ##... ##... ##... ##... ##... #####'],
  M: [3, '##...## ###.### ####### ##.#.## ##...## ##...## ##...##'],
  N: [3, '##...## ###..## ####.## ##.#### ##..### ##...## ##...##'],
  O: [3, '.####. ##..## ##..## ##..## ##..## ##..## .####.'],
  P: [3, '#####. ##..## ##..## #####. ##.... ##.... ##....'],
  Q: [3, '.####. ##..## ##..## ##..## ##..## ##.##. .##.##'],
  R: [3, '#####. ##..## ##..## #####. ##.##. ##..## ##..##'],
  S: [3, '.####. ##..## ##.... .####. ....## ##..## .####.'],
  T: [3, '###### ..##.. ..##.. ..##.. ..##.. ..##.. ..##..'],
  U: [3, '##..## ##..## ##..## ##..## ##..## ##..## .####.'],
  V: [3, '##..## ##..## ##..## ##..## ##..## .####. ..##..'],
  W: [3, '##...## ##...## ##...## ##.#.## ####### ###.### ##...##'],
  X: [3, '##..## ##..## .####. ..##.. .####. ##..## ##..##'],
  Y: [3, '##..## ##..## ##..## .####. ..##.. ..##.. ..##..'],
  Z: [3, '###### ....## ...##. ..##.. .##... ##.... ######'],

  // ---- Turkish + circumflex uppercase
  Ç: [3, '.####. ##..## ##.... ##.... ##.... ##..## .####. ..##.. .##...'],
  Ğ: [0, '#....# .####. ...... .####. ##..## ##.... ##.### ##..## ##..## .####.'],
  İ: [0, '.##. .##. .... #### .##. .##. .##. .##. .##. ####'],
  Ö: [0, '##..## ##..## ...... .####. ##..## ##..## ##..## ##..## ##..## .####.'],
  Ş: [3, '.####. ##..## ##.... .####. ....## ##..## .####. ..##.. .##...'],
  Ü: [0, '##..## ##..## ...... ##..## ##..## ##..## ##..## ##..## ##..## .####.'],
  Â: [0, '..##.. .#..#. ...... .####. ##..## ##..## ###### ##..## ##..## ##..##'],
  Î: [0, '.##. #..# .... #### .##. .##. .##. .##. .##. ####'],
  Û: [0, '..##.. .#..#. ...... ##..## ##..## ##..## ##..## ##..## ##..## .####.'],

  // ---- lowercase (x-height rows 5-9, ascenders from 3, descenders 10-12)
  a: [5, '.####. ....## .##### ##..## .#####'],
  b: [3, '##.... ##.... #####. ##..## ##..## ##..## #####.'],
  c: [5, '.#### ##... ##... ##... .####'],
  d: [3, '....## ....## .##### ##..## ##..## ##..## .#####'],
  e: [5, '.####. ##..## ###### ##.... .####.'],
  f: [3, '..### .##.. ####. .##.. .##.. .##.. .##..'],
  g: [5, '.##### ##..## ##..## ##..## .##### ....## ....## .####.'],
  h: [3, '##.... ##.... #####. ##..## ##..## ##..## ##..##'],
  i: [2, '## ## .. ## ## ## ## ##'],
  ı: [5, '## ## ## ## ##'],
  j: [2, '..## ..## .... ..## ..## ..## ..## ..## ..## ..## ###.'],
  k: [3, '##.... ##.... ##..## ##.##. ####.. ##.##. ##..##'],
  l: [3, '##. ##. ##. ##. ##. ##. .##'],
  m: [5, '#######. ##.##.## ##.##.## ##.##.## ##.##.##'],
  n: [5, '#####. ##..## ##..## ##..## ##..##'],
  o: [5, '.####. ##..## ##..## ##..## .####.'],
  p: [5, '#####. ##..## ##..## ##..## #####. ##.... ##.... ##....'],
  q: [5, '.##### ##..## ##..## ##..## .##### ....## ....## ....##'],
  r: [5, '##.## ##### ##... ##... ##...'],
  s: [5, '.##### ##.... .####. ....## #####.'],
  t: [4, '.##.. ##### .##.. .##.. .##.. ..###'],
  u: [5, '##..## ##..## ##..## ##..## .#####'],
  v: [5, '##..## ##..## ##..## .####. ..##..'],
  w: [5, '##...## ##...## ##.#.## ####### .##.##.'],
  x: [5, '##..## .####. ..##.. .####. ##..##'],
  y: [5, '##..## ##..## ##..## ##..## .##### ....## ....## .####.'],
  z: [5, '###### ...##. ..##.. .##... ######'],

  // ---- Turkish + circumflex lowercase
  ç: [5, '.#### ##... ##... ##... .#### .##.. ##...'],
  ğ: [2, '#....# .####. ...... .##### ##..## ##..## ##..## .##### ....## ....## .####.'],
  ö: [2, '##..## ##..## ...... .####. ##..## ##..## ##..## .####.'],
  ş: [5, '.##### ##.... .####. ....## #####. ..##.. .##...'],
  ü: [2, '##..## ##..## ...... ##..## ##..## ##..## ##..## .#####'],
  â: [2, '..##.. .#..#. ...... .####. ....## .##### ##..## .#####'],
  î: [2, '.##. #..# .... .##. .##. .##. .##. .##.'],
  û: [2, '..##.. .#..#. ...... ##..## ##..## ##..## ##..## .#####'],

  // ---- digits (tabular, 6 wide)
  '0': [3, '.####. ##..## ##..## ##..## ##..## ##..## .####.'],
  '1': [3, '..##.. .###.. ..##.. ..##.. ..##.. ..##.. .####.'],
  '2': [3, '.####. ##..## ....## ...##. ..##.. .##... ######'],
  '3': [3, '.####. ##..## ....## ..###. ....## ##..## .####.'],
  '4': [3, '##..## ##..## ##..## ###### ....## ....## ....##'],
  '5': [3, '###### ##.... #####. ....## ....## ##..## .####.'],
  '6': [3, '.####. ##.... ##.... #####. ##..## ##..## .####.'],
  '7': [3, '###### ....## ...##. ..##.. ..##.. ..##.. ..##..'],
  '8': [3, '.####. ##..## ##..## .####. ##..## ##..## .####.'],
  '9': [3, '.####. ##..## ##..## .##### ....## ....## .####.'],

  // ---- punctuation
  '.': [8, '## ##'],
  ',': [8, '## ## #.'],
  ':': [5, '## ## .. ## ##'],
  ';': [5, '## ## .. ## ## #.'],
  '!': [3, '## ## ## ## .. ## ##'],
  '?': [3, '.####. ##..## ...##. ..##.. ...... ..##.. ..##..'],
  "'": [3, '## ## #.'],
  '"': [3, '##.## ##.## #..#.'],
  '-': [6, '#### ####'],
  '+': [4, '..##.. ..##.. ###### ###### ..##.. ..##..'],
  '/': [3, '....## ...##. ...##. ..##.. .##... .##... ##....'],
  '\\': [3, '##.... .##... .##... ..##.. ...##. ...##. ....##'],
  '(': [3, '.## ##. ##. ##. ##. ##. .##'],
  ')': [3, '##. .## .## .## .## .## ##.'],
  '[': [3, '### ##. ##. ##. ##. ##. ###'],
  ']': [3, '### .## .## .## .## .## ###'],
  '{': [3, '..## .##. .##. ##.. .##. .##. ..##'],
  '}': [3, '##.. .##. .##. ..## .##. .##. ##..'],
  '%': [3, '##...# ##..## ...##. ..##.. .##... ##..## #...##'],
  '*': [4, '.#.#. ..#.. ##### ..#.. .#.#.'],
  '#': [3, '.#..#. .#..#. ###### .#..#. ###### .#..#. .#..#.'],
  '&': [3, '.###.. ##.##. .###.. .##..# ##.### ##.##. .###.#'],
  '=': [4, '##### ##### ..... ##### #####'],
  '<': [3, '...## ..##. .##.. ##... .##.. ..##. ...##'],
  '>': [3, '##... .##.. ..##. ...## ..##. .##.. ##...'],
  '_': [10, '######'],
  '|': [3, '## ## ## ## ## ## ## ##'],
  '^': [3, '..##.. .####. ##..##'],
  '~': [6, '.###.## ##.###.'],
  '`': [3, '##. .##'],
  $: [3, '..##.. .##### ##.... .####. ....## #####. ..##..'],
  '@': [3, '.#####. ##...## ##.#### ##.##.# ##.#### ##..... .######'],
  '°': [3, '.##. #..# .##.'],
  '·': [6, '## ##'],
  '•': [5, '.##. #### #### .##.'],
  '…': [8, '##.##.## ##.##.##'],
  '–': [6, '###### ######'],
  '—': [6, '######## ########'],
  '★': [3, '...#... ..###.. ####### .#####. ..###.. .##.##. .#...#.'],
  '♥': [3, '.##.##. ####### ####### ####### .#####. ..###.. ...#...'],
  '→': [4, '...##.. ....##. ####### ####### ....##. ...##..'],
  '←': [4, '..##... .##.... ####### ####### .##.... ..##...'],
  '↑': [3, '..##.. .####. ###### ..##.. ..##.. ..##.. ..##..'],
  '↓': [3, '..##.. ..##.. ..##.. ..##.. ###### .####. ..##..'],
  '×': [4, '##..## .####. ..##.. .####. ##..##'],
  '≥': [3, '##.... .###.. ...### .###.. ##.... ...... ######'],
  '≤': [3, '....## ..###. ###... ..###. ....## ...... ######'],
  '±': [3, '..##.. ..##.. ###### ..##.. ..##.. ...... ######'],
};

export const FONT_DEFS: Record<FontId, FontDef> = {
  sm: { id: 'sm', cellH: 10, capTop: 3, capH: 5, xTop: 4, baseline: 7, spaceW: 2, glyphs: SM_GLYPHS },
  md: { id: 'md', cellH: 13, capTop: 3, capH: 7, xTop: 5, baseline: 9, spaceW: 3, glyphs: MD_GLYPHS },
};

// ============================================================================ parsed glyphs

export interface Glyph {
  ch: string;
  code: number;
  /** Ink width (no outline). */
  w: number;
  /** cellH × w bitmap, 1 = ink. */
  bits: Uint8Array;
}

export interface Font {
  def: FontDef;
  glyphs: Map<number, Glyph>;
}

const parsed = new Map<FontId, Font>();

function parseGlyph(def: FontDef, ch: string, spec: readonly [number, string]): Glyph {
  const [top, src] = spec;
  const rows = src.trim().split(/\s+/);
  const w = rows[0].length;
  if (rows.some((r) => r.length !== w)) throw new Error(`font ${def.id}: glyph '${ch}' has ragged rows`);
  if (top < 0 || top + rows.length > def.cellH) throw new Error(`font ${def.id}: glyph '${ch}' does not fit the cell`);
  const bits = new Uint8Array(w * def.cellH);
  rows.forEach((r, j) => {
    for (let i = 0; i < w; i++) if (r[i] === '#') bits[(top + j) * w + i] = 1;
  });
  return { ch, code: ch.charCodeAt(0), w, bits };
}

/** Parsed glyph tables (cached). Space is synthesized from `spaceW`. */
export function getFont(id: FontId): Font {
  let f = parsed.get(id);
  if (f) return f;
  const def = FONT_DEFS[id];
  const glyphs = new Map<number, Glyph>();
  for (const [ch, spec] of Object.entries(def.glyphs)) {
    const g = parseGlyph(def, ch, spec);
    glyphs.set(g.code, g);
  }
  glyphs.set(32, { ch: ' ', code: 32, w: def.spaceW, bits: new Uint8Array(def.spaceW * def.cellH) });
  f = { def, glyphs };
  parsed.set(id, f);
  return f;
}

/** Every character the fonts can draw (same set for sm and md), in a stable order. */
export function fontCharset(id: FontId = 'sm'): string[] {
  return [...getFont(id).glyphs.values()].map((g) => g.ch);
}

/** True when both fonts have a glyph for `ch`. */
export function hasGlyph(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return getFont('sm').glyphs.has(c) && getFont('md').glyphs.has(c);
}

// ============================================================================ glyph rendering

/** Draw one glyph's fill at (x, y) (cell top-left) with color `c`. */
export function drawGlyph(p: PixelCanvas, g: Glyph, cellH: number, x: number, y: number, c: number): void {
  for (let j = 0; j < cellH; j++) for (let i = 0; i < g.w; i++) if (g.bits[j * g.w + i]) p.set(x + i, y + j, c);
}

/** One glyph as its own canvas: fill white (0xffffff) + optional 1px ink outline (8-neighbour). */
export function glyphCanvas(font: Font, g: Glyph, outline: boolean): PixelCanvas {
  const H = font.def.cellH;
  if (!outline) {
    const p = new PixelCanvas(Math.max(1, g.w), H);
    drawGlyph(p, g, H, 0, 0, 0xffffff);
    return p;
  }
  const p = new PixelCanvas(g.w + 2, H + 2);
  drawGlyph(p, g, H, 1, 1, 0xffffff);
  p.outline(PAL.ink, { corners: true });
  return p;
}

// ============================================================================ atlas

export interface AtlasFrame {
  code: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Ink width of the glyph (without outline). */
  inkW: number;
}

export interface FontAtlas {
  font: Font;
  outline: boolean;
  canvas: PixelCanvas;
  frames: AtlasFrame[];
}

/** Pack every glyph of `id` into one canvas (1px transparent gutter between quads). */
export function buildFontAtlas(id: FontId, outline: boolean, maxW = 512): FontAtlas {
  const font = getFont(id);
  const quadH = font.def.cellH + (outline ? 2 : 0);
  const items = [...font.glyphs.values()].map((g) => ({ g, pc: glyphCanvas(font, g, outline) }));
  // shelf packing, fixed row height
  let x = 1;
  let y = 1;
  const placed: { g: Glyph; pc: PixelCanvas; x: number; y: number }[] = [];
  for (const it of items) {
    if (x + it.pc.w + 1 > maxW) {
      x = 1;
      y += quadH + 1;
    }
    placed.push({ ...it, x, y });
    x += it.pc.w + 1;
  }
  const texH = nextPow2(y + quadH + 1);
  const canvas = new PixelCanvas(maxW, texH);
  const frames: AtlasFrame[] = [];
  for (const p of placed) {
    canvas.blit(p.pc, p.x, p.y);
    frames.push({ code: p.g.code, x: p.x, y: p.y, w: p.pc.w, h: p.pc.h, inkW: p.g.w });
  }
  return { font, outline, canvas, frames };
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Phaser bitmap font character data (same shape ParseXMLBitmapFont produces). */
export interface BitmapCharData {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  xOffset: number;
  yOffset: number;
  xAdvance: number;
  data: object;
  kerning: Record<number, number>;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export interface BitmapFontDataLike {
  font: string;
  size: number;
  lineHeight: number;
  retroFont: boolean;
  chars: Record<number, BitmapCharData>;
}

/**
 * Bitmap font data for Phaser's cache. Metric trick (see text.ts): xAdvance is the full
 * quad width so Phaser's bounds end exactly at the last ink pixel; the BitmapText then
 * uses letterSpacing −1 (outline: neighbours share the outline column) or +1 (plain).
 * lineHeight likewise is the full quad height with lineSpacing −1 / +1.
 */
export function bitmapFontData(atlas: FontAtlas, name: string): BitmapFontDataLike {
  const { font, outline, canvas } = atlas;
  const W = canvas.w;
  const H = canvas.h;
  const chars: Record<number, BitmapCharData> = {};
  for (const f of atlas.frames) {
    const blank = f.code === 32;
    const width = blank ? 0 : f.w;
    const height = blank ? 0 : f.h;
    chars[f.code] = {
      x: f.x,
      y: f.y,
      width,
      height,
      centerX: Math.floor(width / 2),
      centerY: Math.floor(height / 2),
      xOffset: 0,
      yOffset: 0,
      xAdvance: f.inkW + (outline ? 2 : 0),
      data: {},
      kerning: {},
      u0: f.x / W,
      v0: f.y / H,
      u1: (f.x + width) / W,
      v1: (f.y + height) / H,
    };
    // invisible twin with the same advance (typewriter reveal keeps the layout fixed)
    const ph = phantomCode(f.code);
    if (ph) chars[ph] = { ...chars[f.code], width: 0, height: 0, centerX: 0, centerY: 0, u1: f.x / W, v1: f.y / H, data: {}, kerning: {} };
  }
  return { font: name, size: font.def.capH, lineHeight: font.def.cellH + (outline ? 2 : 0), retroFont: false, chars };
}

// ============================================================================ phantom glyphs

const PHANTOM_BASE = 0xe000;
let phantomMap: Map<number, number> | null = null;

/**
 * Private-use code of the invisible twin of `code` (same advance, no ink), or 0 if none.
 * Used by revealText()/typeText() in src/ui/text.ts.
 */
export function phantomCode(code: number): number {
  if (!phantomMap) {
    phantomMap = new Map();
    const codes = [...getFont('sm').glyphs.keys()].filter((c) => c !== 32).sort((a, b) => a - b);
    codes.forEach((c, i) => phantomMap!.set(c, PHANTOM_BASE + i));
  }
  return phantomMap.get(code) ?? 0;
}
