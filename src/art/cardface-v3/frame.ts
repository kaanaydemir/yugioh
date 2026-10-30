// The v3 card face's own frame parts (lane A5-B, step B-1) — docs/v3/A5_PLAN.md §3.7.1 (face),
// §3.7.3 (mini level frame), §3.7.5 (overlays); built on the frozen frame language of
// src/art/frame-v3.ts (contract S-1: FRAME_V3, frameRectV3, trimV3 — no tone of it is copied here).
//
// Every pixel is a PAL tone (light from the top left, IŞ-1; flat bands, no bevel / gradient /
// dither / blend), and the geometry is today's (48×68 face: name plate (2,2) 35×8, star / icon row
// y 11, art window (2,17) 44×34, text box (2,52) 44×14; 18×26 mini level: art 16×12 at (1,4)), so
// the hand, CardSprite, TileCard and the pose renderer's mip levels keep their geometry.
//
//   paintFaceV3(id, art)          48×68 face: dark body + ONE kind trim, ink-cut panels, the art inside
//   paintArtWindowV3(p, id, art)  the art window alone (art + its bezel) — the living art (B-5) repaints
//                                 only this region
//   paintMiniFaceV3(id, art16)    18×26 mini level the iso textures come from (no outline: the pose
//                                 renderer draws it), night body + kind trim on the border pixels
//   sheenFramesV3 / foilFramesV3  `card:sheen` / `card:foil` frames: one crisp 1–2 px diagonal glint of
//                                 opaque palette pixels on a transparent sheet (S-5: blended NORMAL)
//
// The face, from the outside in (x / y in face pixels):
//   outline  1-px ink, corners cut (frameRectV3)              trim  x 1 / 46, y 1 / 66: kind tone,
//   body     night1 over night0 (split y 34)                        lit top / left, dark bottom / right
//   plate    night0, its shadow line (ink; gold3 on aces) on y 9 and x 36; greeked name in mist / steel
//   orb      the attribute / kind orb at (37,1), set over the top trim like a gem
//   row      stars (ink contour, one gold4 light pixel) or the spell / trap type icon + its rule
//   window   ink line above (y 16) and below (y 51), ink sides (x 2 / 45), bezel row lit on top
//            (y 17, kind ramp[3]) and dark at the bottom (y 50, kind ramp[2]): the card trim beside
//            it is the lit left / dark right edge — the art shows through x 3..44, y 18..49
//   text     night0 box (y 52..65): night3 greeked lines; monsters ATK (white) / DEF (mist) with the
//            fire4 sword / water3 shield; spells / traps their kind emblem
//   ace      the gold3 plate rule + FRAME_V3's 3-px gold L corners (top left, bottom right), on top

import type { Attribute, CardDef, CardId } from '../../data/cards';
import { cardDef, isMonster } from '../../data/cards';
import { FRAME_V3, frameRectV3, type Trim } from '../frame-v3';
import { ATTRIBUTE_RAMP, KIND_RAMP, PAL, RAMPS, type Ramp } from '../palette';
import { PixelCanvas, mulberry32 } from '../pixel';
import { CARD_ART_H, CARD_ART_W } from '../types';

// ================================================================ geometry (today's, unchanged)

export const FACE_V3_W = 48;
export const FACE_V3_H = 68;
/** The art window's top-left corner on the face (CARD_ART_W × CARD_ART_H). */
export const ART_X = 2;
export const ART_Y = 17;
/** The 18×26 mini level and its 16×12 art window at (1, 4). */
export const MINI_V3_W = 18;
export const MINI_V3_H = 26;
export const MINI_ART_X = 1;
export const MINI_ART_Y = 4;
export const MINI_ART_W = 16;
export const MINI_ART_H = 12;

const PLATE_X = 2;
const PLATE_Y = 2;
const PLATE_W = 35;
const PLATE_H = 8;
const ROW_Y = 11;
const TEXT_X = 2;
const TEXT_Y = 52;
const TEXT_W = 44;
const TEXT_H = 14;
/** Where the body's lower (night0) band starts. */
const BODY_SPLIT = 34;

// ================================================================ tones

/** The kind's ramp (monster gold, spell teal, trap magenta) — the trim's ramp. */
export function kindRampV3(def: CardDef): Ramp {
  return KIND_RAMP[def.kind];
}

/** The kind's trim (FRAME_V3: monster gold2 / gold3, spell teal2 / teal3, trap mag2 / mag3). */
export function kindTrimV3(def: CardDef): Trim {
  return FRAME_V3.trims[def.kind];
}

function isAce(def: CardDef): boolean {
  return isMonster(def) && def.ace;
}

// ================================================================ glyphs (today's shapes)

/** 3×5 digits (today's ATK / DEF font). */
const DIGITS: Record<string, readonly string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '..#', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  '?': ['###', '..#', '.##', '...', '.#.'],
};

function digits(p: PixelCanvas, x: number, y: number, s: string, color: number, shadow: number): void {
  let cx = x;
  for (const ch of s) {
    const g = DIGITS[ch];
    if (!g) {
      cx += 2;
      continue;
    }
    p.stamp(g, { '#': shadow }, cx + 1, y + 1);
    p.stamp(g, { '#': color }, cx, y);
    cx += 4;
  }
}

/** 5×5 attribute symbols ('#' symbol, 'o' its shade) — today's. */
const ATTR_GLYPH: Record<Attribute, readonly string[]> = {
  LIGHT: ['#.#.#', '.###.', '##o##', '.###.', '#.#.#'],
  DARK: ['.###.', '##o..', '#o...', '##o..', '.###.'],
  FIRE: ['.#...', '.##.#', '.#o##', '#ooo#', '.###.'],
  WATER: ['..#..', '..#..', '.#o#.', '#ooo#', '.###.'],
  EARTH: ['.....', '..#..', '.#o#.', '#ooo#', '#####'],
  WIND: ['.###.', '#...#', '..#.#', '.#..#', '#.##.'],
};
const SPELL_GLYPH = ['..#..', '.#o#.', '#ooo#', '.#o#.', '..#..'];
const TRAP_GLYPH = ['#####', '#ooo#', '.#o#.', '.#o#.', '..#..'];

/** 5×5 spell / trap type icons — today's. */
const TYPE_ICON: Record<'normal' | 'equip' | 'field' | 'continuous' | 'trap', readonly string[]> = {
  normal: ['..#..', '..#..', '##o##', '..#..', '..#..'],
  equip: ['....#', '...#.', '#.#..', '.#...', '#.#..'],
  field: ['.....', '...#.', '.#.##', '#o#o#', '#####'],
  continuous: ['.###.', '#...#', '#.o.#', '#...#', '.###.'],
  trap: ['#.#.#', '#####', '.....', '#####', '#.#.#'],
};

/** Today's star shape: 'a' the one light pixel, 'b' its body, 'c' the shade (lower right). */
const STAR = ['..a..', '..b..', 'bbbbc', '.bbc.', '.c.c.'];
/** Sword (ATK) and shield (DEF) icons of the text box. */
const SWORD = ['..#', '.#.', '#..'];
const SHIELD = ['###', '#o#', '#o#', '.#.'];

/** The pixels of a glyph's 4-neighbour ring (its 1-px contour), not counting the glyph itself. */
function contourOf(rows: readonly string[]): [number, number][] {
  const on = (x: number, y: number) => y >= 0 && y < rows.length && x >= 0 && x < rows[y].length && rows[y][x] !== '.';
  const out: [number, number][] = [];
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  for (let y = -1; y <= h; y++)
    for (let x = -1; x <= w; x++) {
      if (on(x, y)) continue;
      if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) out.push([x, y]);
    }
  return out;
}

const STAR_RING = contourOf(STAR);

// ================================================================ small painters

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Greeked title: one 2-px bar per word (today's look), in `color` with `edge` on its two ends. */
function greekedName(p: PixelCanvas, x: number, y: number, maxW: number, text: string, color: number, edge: number): void {
  let cx = x;
  for (const word of text.split(/\s+/)) {
    const len = Math.min(x + maxW - cx, word.length * 2 + 1);
    if (len < 3) return;
    p.hline(cx + 1, cx + len - 1, y, color);
    p.hline(cx, cx + len - 2, y + 1, color);
    p.set(cx + len - 1, y + 1, edge);
    p.set(cx, y, edge);
    cx += len + 3;
  }
}

/** Greeked rules text: `lines` rows of 1-px words every 2 px (seeded, deterministic). */
function greekedLines(p: PixelCanvas, x: number, y: number, w: number, lines: number, seed: number, color: number, last: number): void {
  const rnd = mulberry32(seed);
  for (let l = 0; l < lines; l++) {
    const lw = l === lines - 1 ? Math.floor(w * last) : w;
    let cx = x;
    while (cx < x + lw) {
      const word = 2 + Math.floor(rnd() * 5);
      const end = Math.min(x + lw, cx + word);
      p.hline(cx, end - 1, y + l * 2, color);
      cx = end + 1;
    }
  }
}

/**
 * The attribute / kind orb (9×9 at x, y): ink rim, two flat tones (ramp[1] body, ramp[2] lit upper
 * left), ONE light pixel, today's glyph on top.
 */
function paintOrb(p: PixelCanvas, x: number, y: number, attr: Attribute | 'SPELL' | 'TRAP'): void {
  const ramp: Ramp = attr === 'SPELL' ? RAMPS.teal : attr === 'TRAP' ? RAMPS.mag : ATTRIBUTE_RAMP[attr];
  const cx = x + 4.5;
  const cy = y + 4.5;
  p.disc(cx, cy, 4.6, PAL.ink);
  p.disc(cx, cy, 3.6, ramp[1]);
  p.disc(cx - 0.6, cy - 0.6, 2.9, ramp[2]);
  p.set(x + 2, y + 2, ramp[3]);
  const glyph = attr === 'SPELL' ? SPELL_GLYPH : attr === 'TRAP' ? TRAP_GLYPH : ATTR_GLYPH[attr];
  const sym = attr === 'LIGHT' ? PAL.white : ramp[4];
  p.stamp(glyph, { '#': sym, o: attr === 'LIGHT' ? PAL.gold3 : ramp[3] }, x + 2, y + 2);
}

/** One level star at (x, y): ink contour, gold3 body, gold2 shade, one gold4 light pixel. */
function paintStar(p: PixelCanvas, x: number, y: number): void {
  for (const [dx, dy] of STAR_RING) p.set(x + dx, y + dy, PAL.ink);
  p.stamp(STAR, { a: PAL.gold4, b: PAL.gold3, c: PAL.gold2 }, x, y);
}

// ================================================================ the face's parts

function paintPlate(p: PixelCanvas, def: CardDef): void {
  const x0 = PLATE_X;
  const y0 = PLATE_Y;
  const x1 = PLATE_X + PLATE_W - 1;
  const y1 = PLATE_Y + PLATE_H - 1;
  p.rect(x0, y0, PLATE_W - 1, PLATE_H - 1, PAL.night0);
  // its edge on the body: ink below and right (the plate sits on the card, light from the top left);
  // an ace's plate has one gold3 rule instead of the ink line below
  p.hline(x0, x1, y1, isAce(def) ? PAL.gold3 : PAL.ink);
  p.vline(x1, y0, y1 - 1, PAL.ink);
  greekedName(p, x0 + 3, y0 + 3, PLATE_W - 7, def.name, PAL.mist, PAL.steel);
}

function paintRow(p: PixelCanvas, def: CardDef): void {
  if (isMonster(def)) {
    for (let i = 0; i < def.level; i++) paintStar(p, 40 - i * 6, ROW_Y);
    return;
  }
  const R = kindRampV3(def);
  const t = def.kind === 'trap' ? 'trap' : def.spellType;
  const icon: 'normal' | 'equip' | 'field' | 'continuous' | 'trap' = t === 'trap' ? 'trap' : t === 'equip' ? 'equip' : t === 'field' ? 'field' : t === 'continuous' ? 'continuous' : 'normal';
  // the type rule leading into the icon: one kind line, a 3-px arrow head lit
  p.hline(5, 37, ROW_Y + 2, R[2]);
  p.set(3, ROW_Y + 2, R[3]).set(4, ROW_Y + 1, R[3]).set(4, ROW_Y + 2, R[3]).set(4, ROW_Y + 3, R[3]);
  // the type icon: ink box, ramp[1] field, today's glyph, one light pixel
  p.rect(39, ROW_Y - 1, 7, 7, PAL.ink);
  p.rect(40, ROW_Y, 5, 5, R[1]);
  p.stamp(TYPE_ICON[icon], { '#': R[3], o: R[2] }, 40, ROW_Y);
  const g = TYPE_ICON[icon];
  for (let yy = 0; yy < 5; yy++) {
    const xx = g[yy].indexOf('#');
    if (xx >= 0) {
      p.set(40 + xx, ROW_Y + yy, R[4]);
      break;
    }
  }
}

/**
 * The art window at (ART_X, ART_Y): `art` (CARD_ART_W × CARD_ART_H) and its bezel. Ink lines above
 * (y 16) and below (y 51) and on the sides (x 2 / 45); the bezel row is lit on top (kind ramp[3]) and
 * dark at the bottom (kind ramp[2]). Repaints exactly the rows 16..51 between the trims (x 2..45).
 */
export function paintArtWindowV3(p: PixelCanvas, id: CardId, art: PixelCanvas): PixelCanvas {
  const def = cardDef(id);
  const R = kindRampV3(def);
  const x0 = ART_X;
  const y0 = ART_Y;
  const x1 = ART_X + CARD_ART_W - 1;
  const y1 = ART_Y + CARD_ART_H - 1;
  p.rect(x0, y0, CARD_ART_W, CARD_ART_H, PAL.ink);
  p.blit(art, x0, y0);
  p.hline(x0, x1, y0 - 1, PAL.ink);
  p.hline(x0, x1, y1 + 1, PAL.ink);
  p.vline(x0, y0, y1, PAL.ink);
  p.vline(x1, y0, y1, PAL.ink);
  p.hline(x0 + 1, x1 - 1, y0, R[3]);
  p.hline(x0 + 1, x1 - 1, y1, R[2]);
  return p;
}

function paintTextBox(p: PixelCanvas, def: CardDef): void {
  const x = TEXT_X;
  const y = TEXT_Y;
  p.rect(x, y, TEXT_W, TEXT_H, PAL.night0);
  const seed = hashStr(def.id);
  if (isMonster(def)) {
    // the box's rows start one row higher than today's (all kinds): a 1-px margin above the bottom
    // trim, and the ATK / DEF row clears an ace's L corner
    greekedLines(p, x + 3, y + 1, TEXT_W - 6, 2, seed, PAL.night3, 0.6);
    // divider
    for (let xx = x + 2; xx < x + TEXT_W - 2; xx++) if ((xx & 1) === 0) p.set(xx, y + 5, PAL.night2);
    const sy = y + 7;
    // ATK: the fire4 sword (fire3 / fire2 hilt) + white digits
    const ix = x + 3;
    p.stamp(SWORD, { '#': PAL.fire4 }, ix, sy);
    p.set(ix, sy + 3, PAL.fire2).set(ix + 1, sy + 3, PAL.fire3).set(ix, sy + 4, PAL.fire2);
    p.set(ix + 2, sy + 2, PAL.fire3);
    digits(p, ix + 4, sy, String(def.atk), PAL.white, PAL.ink);
    // DEF: the water3 shield (water4 face) + mist digits
    const jx = x + 24;
    p.stamp(SHIELD, { '#': PAL.water3, o: PAL.water4 }, jx, sy);
    digits(p, jx + 4, sy, String(def.def), PAL.mist, PAL.ink);
  } else {
    greekedLines(p, x + 3, y + 1, TEXT_W - 6, 5, seed, PAL.night3, 0.4);
    const R = kindRampV3(def);
    p.stamp(def.kind === 'spell' ? SPELL_GLYPH : TRAP_GLYPH, { '#': R[2], o: R[1] }, x + TEXT_W - 7, y + TEXT_H - 6);
  }
}

// ================================================================ face

/** The v3 face (48×68) of `id` with `art` (CARD_ART_W × CARD_ART_H) in its window. */
export function paintFaceV3(id: CardId, art: PixelCanvas): PixelCanvas {
  const def = cardDef(id);
  const p = new PixelCanvas(FACE_V3_W, FACE_V3_H);
  frameRectV3(p, 0, 0, FACE_V3_W, FACE_V3_H, kindTrimV3(def), { split: BODY_SPLIT });
  paintPlate(p, def);
  paintOrb(p, 37, 1, isMonster(def) ? def.attribute : def.kind === 'spell' ? 'SPELL' : 'TRAP');
  paintRow(p, def);
  paintArtWindowV3(p, id, art);
  paintTextBox(p, def);
  // the ace's gold L corners go on top of the plate and the text box corners
  if (isAce(def)) frameRectV3(p, 0, 0, FACE_V3_W, FACE_V3_H, null, { body: false, outline: false, trimLine: false, ace: true });
  return p;
}

// ================================================================ mini level (18×26)

/**
 * The 18×26 mini level of `id` (the iso textures are rendered from it 1:1) with `art16` (16×12) in
 * its window. No outline (the pose renderer draws the ink outline around it): the kind trim sits on
 * the border pixels, the body is one night step lighter than the face (night2 over night1, as the
 * v3 back's mini level) so the card reads as an object on the night floor of the board.
 */
export function paintMiniFaceV3(id: CardId, art16: PixelCanvas): PixelCanvas {
  const def = cardDef(id);
  const t = kindTrimV3(def);
  const W = MINI_V3_W;
  const H = MINI_V3_H;
  const p = new PixelCanvas(W, H);
  for (let y = 0; y < H; y++) p.hline(0, W - 1, y, y < H / 2 ? PAL.night2 : PAL.night1);
  p.hline(0, W - 1, 0, t.light);
  p.vline(0, 1, H - 2, t.light);
  p.vline(W - 1, 1, H - 2, t.dark);
  p.hline(0, W - 1, H - 1, t.dark);
  // header: the plate (night0) and the orb (attribute / kind tones, one light pixel)
  p.hline(1, 12, 1, PAL.night0);
  p.hline(1, 12, 2, isAce(def) ? PAL.gold3 : PAL.night0);
  const orb = isMonster(def) ? ATTRIBUTE_RAMP[def.attribute] : kindRampV3(def);
  p.rect(14, 1, 2, 2, orb[2]);
  p.set(14, 1, orb[4]);
  // art window: ink above, the art, kind ramp[2] below
  p.hline(MINI_ART_X, MINI_ART_X + MINI_ART_W - 1, MINI_ART_Y - 1, PAL.ink);
  p.blit(art16, MINI_ART_X, MINI_ART_Y);
  p.hline(MINI_ART_X, MINI_ART_X + MINI_ART_W - 1, MINI_ART_Y + MINI_ART_H, kindRampV3(def)[2]);
  // text box
  p.rect(1, 17, 16, 7, PAL.night0);
  if (isMonster(def)) {
    p.hline(3, 7, 20, PAL.white);
    p.hline(10, 14, 20, PAL.mist);
  } else {
    p.hline(3, 13, 19, PAL.night3);
    p.hline(3, 9, 21, PAL.night3);
  }
  return p;
}

// ================================================================ overlays (S-5: opaque palette pixels)

/**
 * The glint's pixels on frame f of n: a steep 1:2 diagonal ('/': two rows per column) running from
 * the card's top-left corner to its bottom-right corner, clipped to `mask`; `width` columns, the
 * leading one first.
 */
function glintFrames(mask: PixelCanvas, n: number, tones: readonly number[]): PixelCanvas[] {
  const out: PixelCanvas[] = [];
  const w = tones.length;
  const span = mask.w + Math.ceil(mask.h / 2) + w;
  for (let f = 0; f < n; f++) {
    const p = new PixelCanvas(mask.w, mask.h);
    const pos = Math.round((f / Math.max(1, n - 1)) * span) - 1;
    for (let y = 0; y < mask.h; y++) {
      const lead = pos - (y >> 1);
      for (let k = 0; k < w; k++) {
        const x = lead - k;
        if (x < 0 || x >= mask.w || !mask.isOpaque(x, y)) continue;
        p.set(x, y, tones[k]);
      }
    }
    out.push(p);
  }
  return out;
}

/** `card:sheen` (v3): a 1-px white glint across the card (n frames). */
export function sheenFramesV3(mask: PixelCanvas, n: number): PixelCanvas[] {
  return glintFrames(mask, n, [PAL.white]);
}

/** `card:foil` (v3, aces): a 2-px glint, white leading edge and a gold4 trail (n frames). */
export function foilFramesV3(mask: PixelCanvas, n: number): PixelCanvas[] {
  return glintFrames(mask, n, [PAL.white, PAL.gold4]);
}
