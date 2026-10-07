// Card art: faces, back, artwork windows, isometric "lying on a tile" variants and the
// tiny 3D pose renderer that animates cards between upright and flat (flip, rotate, stand).
//
// Texture keys (built at boot by src/boot/30-cards.ts → buildCardTextures):
//   card:face:<id>              48×68 upright face           cardFaceKey(id)
//   card:back                   48×68 upright back           CARD_BACK
//   card:art:<id>               44×34 artwork window         cardArtKey(id)
//   card:iso:<id|back>:<o>[:p2] flat card on a tile          cardIsoKey(id | 'back', 'up' | 'side', player)
//   card:sil / card:glow / card:glowrun / card:sheen / card:foil   upright overlays
//   card:iso:sil|glow|sheen:<o>                                    iso overlays
//
// Iso textures are ISO_TEX_W × ISO_TEX_H with the tile center at (ISO_CX, ISO_CY): place them
// with setOrigin(ISO_CX / ISO_TEX_W, ISO_CY / ISO_TEX_H) at zoneXY(...).

import type Phaser from 'phaser';
import type { Attribute, CardDef, CardId, MonsterCardDef, MonsterId } from '../data/cards';
import { ALL_CARD_IDS, cardDef, isMonster } from '../data/cards';
import type { PlayerId } from '../engine/types';
import { cardArtwork } from './cardart';
import { monsterArt } from './monsters';
import { ATTRIBUTE_RAMP, PAL, RAMPS, type Ramp } from './palette';
import { PixelCanvas, mix, mulberry32, rgb } from './pixel';
import { monsterFrame } from './textures';
import { CARD_ART_H, CARD_ART_W } from './types';

export const FACE_W = 48;
export const FACE_H = 68;

// ---------------------------------------------------------------- keys

export type CardOrientation = 'up' | 'side';

export const CARD_BACK = 'card:back';
/** White card silhouette (48×68) — tint/ADD for flashes. */
export const CARD_SIL = 'card:sil';
/** Glow ring around the upright card: (FACE_W + 2*GLOW_PAD) × (FACE_H + 2*GLOW_PAD), white. */
export const CARD_GLOW = 'card:glow';
/** Same size as CARD_GLOW; frames `run:<i>` with bright pixels running around the rim. */
export const CARD_GLOW_RUN = 'card:glowrun';
export const GLOW_RUN_FRAMES = 24;
/** Upright light sweep, frames `s:<i>` (48×68, white). */
export const CARD_SHEEN = 'card:sheen';
/** Upright rainbow holo-foil sweep for aces, frames `s:<i>` (48×68). */
export const CARD_FOIL = 'card:foil';
export const SHEEN_FRAMES = 14;
export const GLOW_PAD = 3;

export function cardFaceKey(id: CardId): string {
  return `card:face:${id}`;
}
export function cardArtKey(id: CardId): string {
  return `card:art:${id}`;
}
/** Flat card lying on a tile. Player 2's cards are rotated 180° (their top faces player 1). */
export function cardIsoKey(id: CardId | 'back', orientation: CardOrientation, player: PlayerId = 0): string {
  return `card:iso:${id}:${orientation}${player === 1 ? ':p2' : ''}`;
}
/** White flat-card silhouette (same for both players). */
export function cardIsoSilKey(orientation: CardOrientation): string {
  return `card:iso:sil:${orientation}`;
}
/** White glow ring around the flat card; frames `g:0` (steady) and `run:<i>` (running highlight). */
export function cardIsoGlowKey(orientation: CardOrientation): string {
  return `card:iso:glow:${orientation}`;
}
/** Diagonal light sweep across the flat card, frames `s:<i>`. */
export function cardIsoSheenKey(orientation: CardOrientation): string {
  return `card:iso:sheen:${orientation}`;
}

// ---------------------------------------------------------------- kind / accent colors

export type CardKind = CardDef['kind'];

export function kindRamp(kind: CardKind): Ramp {
  return kind === 'monster' ? RAMPS.gold : kind === 'spell' ? RAMPS.teal : RAMPS.mag;
}

/** Accent ramp for a card: attribute ramp for monsters, teal for spells, magenta for traps. */
export function cardAccentRamp(id: CardId): Ramp {
  const d = cardDef(id);
  return isMonster(d) ? ATTRIBUTE_RAMP[d.attribute] : kindRamp(d.kind);
}

/** Brightest readable accent color for a card (glows, trails, dissolve embers). */
export function cardAccent(id: CardId): number {
  return cardAccentRamp(id)[3];
}

// ---------------------------------------------------------------- small helpers

const DITHER_LEVELS = 16;

/** Vertical gradient through `colors` (top → bottom), Bayer-dithered between steps. */
function vgrad(p: PixelCanvas, x: number, y: number, w: number, h: number, colors: readonly number[], mask = false): void {
  const n = colors.length - 1;
  for (let yy = 0; yy < h; yy++) {
    const t = h <= 1 ? 0 : (yy / (h - 1)) * n;
    const i = Math.min(n - 1, Math.floor(t));
    const f = t - i;
    for (let xx = 0; xx < w; xx++) {
      const c = n === 0 ? colors[0] : PixelCanvas.ditherAt(x + xx, y + yy, Math.round(f * DITHER_LEVELS)) ? colors[i + 1] : colors[i];
      if (mask) p.paint(x + xx, y + yy, c);
      else p.set(x + xx, y + yy, c);
    }
  }
}

/** Radial gradient centered at (cx, cy), radius r, through `colors` (center → edge). */
function rgrad(
  p: PixelCanvas,
  x: number,
  y: number,
  w: number,
  h: number,
  cx: number,
  cy: number,
  r: number,
  colors: readonly number[],
  sy = 1,
): void {
  const n = colors.length - 1;
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) {
      const d = Math.min(1, Math.hypot(xx + 0.5 - cx, (yy + 0.5 - cy) * sy) / r) * n;
      const i = Math.min(n - 1, Math.floor(d));
      const f = d - i;
      p.set(xx, yy, PixelCanvas.ditherAt(xx, yy, Math.round(f * DITHER_LEVELS)) ? colors[i + 1] : colors[i]);
    }
}

/** Radial gradient painted only where `mask` is opaque. */
function rgradMasked(p: PixelCanvas, mask: PixelCanvas, cx: number, cy: number, r: number, colors: readonly number[]): void {
  const n = colors.length - 1;
  for (let y = 0; y < mask.h; y++)
    for (let x = 0; x < mask.w; x++) {
      if (!mask.isOpaque(x, y)) continue;
      const d = Math.min(1, Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r) * n;
      const i = Math.min(n - 1, Math.floor(d));
      p.set(x, y, PixelCanvas.ditherAt(x, y, Math.round((d - i) * DITHER_LEVELS)) ? colors[i + 1] : colors[i]);
    }
}

/** Recessed panel: dark top/left edge, light bottom/right edge. */
function inset(p: PixelCanvas, x: number, y: number, w: number, h: number, dark: number, light: number): void {
  p.hline(x, x + w - 1, y, dark);
  p.vline(x, y, y + h - 1, dark);
  p.hline(x + 1, x + w - 1, y + h - 1, light);
  p.vline(x + w - 1, y + 1, y + h - 1, light);
}

/** Raised bevel: light top/left edge, dark bottom/right edge. */
function raised(p: PixelCanvas, x: number, y: number, w: number, h: number, light: number, dark: number): void {
  inset(p, x, y, w, h, light, dark);
}

const PALETTE_LIST: number[] = Object.values(PAL) as number[];

/** Nearest palette color (weighted RGB distance). */
export function quantize(c: number): number {
  const [r, g, b] = rgb(c);
  let best = PALETTE_LIST[0];
  let bd = Infinity;
  for (const q of PALETTE_LIST) {
    const [qr, qg, qb] = rgb(q);
    const d = (r - qr) * (r - qr) * 0.3 + (g - qg) * (g - qg) * 0.59 + (b - qb) * (b - qb) * 0.11;
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  return best;
}

/** Area-averaged downsample to w×h, snapped to the palette (keeps the image on-palette). */
function downsample(src: PixelCanvas, w: number, h: number): PixelCanvas {
  const out = new PixelCanvas(w, h);
  const sx = src.w / w;
  const sy = src.h / h;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      const x0 = x * sx;
      const x1 = (x + 1) * sx;
      const y0 = y * sy;
      const y1 = (y + 1) * sy;
      for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++)
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
          const wx = Math.min(x1, xx + 1) - Math.max(x0, xx);
          const wy = Math.min(y1, yy + 1) - Math.max(y0, yy);
          const wgt = wx * wy;
          const c = src.get(xx, yy);
          if (c === null || wgt <= 0) continue;
          const [cr, cg, cb] = rgb(c);
          // Boost bright pixels a little so small highlights (eyes, sparks) survive the shrink.
          const lum = (cr * 0.3 + cg * 0.59 + cb * 0.11) / 255;
          const k = wgt * (1 + lum * lum * 1.6);
          r += cr * k;
          g += cg * k;
          b += cb * k;
          a += k;
        }
      if (a <= 0) continue;
      out.set(x, y, quantize((Math.round(r / a) << 16) | (Math.round(g / a) << 8) | Math.round(b / a)));
    }
  return out;
}

/** 2:1 mode downsample (each 2×2 block → its most common color). */
function halve(src: PixelCanvas): PixelCanvas {
  const w = Math.floor(src.w / 2);
  const h = Math.floor(src.h / 2);
  const out = new PixelCanvas(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const cs: (number | null)[] = [src.get(2 * x, 2 * y), src.get(2 * x + 1, 2 * y), src.get(2 * x, 2 * y + 1), src.get(2 * x + 1, 2 * y + 1)];
      const count = new Map<number, number>();
      let opaque = 0;
      for (const c of cs) if (c !== null) (count.set(c, (count.get(c) ?? 0) + 1), opaque++);
      if (opaque < 2) continue;
      let best = -1;
      let bn = 0;
      for (const [c, n] of count) if (n > bn || (n === bn && lum(c) > lum(best))) ((best = c), (bn = n));
      out.set(x, y, best);
    }
  return out;
}

function lum(c: number): number {
  if (c < 0) return -1;
  const [r, g, b] = rgb(c);
  return r * 0.3 + g * 0.59 + b * 0.11;
}

// ---------------------------------------------------------------- glyphs

/** 3×5 digits for ATK/DEF. */
const DIGITS: Record<string, string[]> = {
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

/** Draw a number in the 3×5 digit font. Returns the width drawn. */
export function drawDigits(p: PixelCanvas, x: number, y: number, s: string, color: number, shadow?: number): number {
  let cx = x;
  for (const ch of s) {
    const g = DIGITS[ch];
    if (!g) {
      cx += 2;
      continue;
    }
    if (shadow !== undefined) p.stamp(g, { '#': shadow }, cx + 1, y + 1);
    p.stamp(g, { '#': color }, cx, y);
    cx += 4;
  }
  return cx - x - 1;
}

export function digitsWidth(s: string): number {
  return s.length * 4 - 1;
}

/** 5×5 attribute symbols ('#' = symbol color, 'o' = symbol shade). */
const ATTR_GLYPH: Record<Attribute, string[]> = {
  LIGHT: ['#.#.#', '.###.', '##o##', '.###.', '#.#.#'],
  DARK: ['.###.', '##o..', '#o...', '##o..', '.###.'],
  FIRE: ['.#...', '.##.#', '.#o##', '#ooo#', '.###.'],
  WATER: ['..#..', '..#..', '.#o#.', '#ooo#', '.###.'],
  EARTH: ['.....', '..#..', '.#o#.', '#ooo#', '#####'],
  WIND: ['.###.', '#...#', '..#.#', '.#..#', '#.##.'],
};

const SPELL_GLYPH = ['..#..', '.#o#.', '#ooo#', '.#o#.', '..#..'];
const TRAP_GLYPH = ['#####', '#ooo#', '.#o#.', '.#o#.', '..#..'];

/** 5×5 spell/trap type icons. */
const TYPE_ICON: Record<'normal' | 'equip' | 'field' | 'trap', string[]> = {
  normal: ['..#..', '..#..', '##o##', '..#..', '..#..'],
  equip: ['....#', '...#.', '#.#..', '.#...', '#.#..'],
  field: ['.....', '...#.', '.#.##', '#o#o#', '#####'],
  trap: ['#.#.#', '#####', '.....', '#####', '#.#.#'],
};

const STAR = ['..#..', '..#..', '#####', '.###.', '.#.#.'];
const STAR_SHADE = ['..a..', '..a..', 'abcbb', '.bcb.', '.c.c.'];

const SWORD = ['..#', '.#.', '#..'];

// ---------------------------------------------------------------- icons

/** 9×9 attribute orb (with ink rim). */
export function drawAttributeOrb(p: PixelCanvas, x: number, y: number, attr: Attribute | 'SPELL' | 'TRAP'): void {
  const ramp: Ramp = attr === 'SPELL' ? RAMPS.teal : attr === 'TRAP' ? RAMPS.mag : ATTRIBUTE_RAMP[attr];
  const cx = x + 4.5;
  const cy = y + 4.5;
  p.disc(cx, cy, 4.6, PAL.ink);
  p.disc(cx, cy, 3.6, ramp[1]);
  p.disc(cx - 0.6, cy - 0.6, 2.9, ramp[2]);
  p.set(x + 2, y + 2, ramp[3]);
  p.set(x + 3, y + 1, ramp[3]);
  p.set(x + 1, y + 3, ramp[3]);
  const glyph = attr === 'SPELL' ? SPELL_GLYPH : attr === 'TRAP' ? TRAP_GLYPH : ATTR_GLYPH[attr];
  const sym = attr === 'LIGHT' ? PAL.white : ramp[4];
  p.stamp(glyph, { '#': sym, o: attr === 'LIGHT' ? PAL.gold3 : ramp[3] }, x + 2, y + 2);
}

function drawStar(p: PixelCanvas, x: number, y: number): void {
  p.stamp(STAR_SHADE, { a: PAL.gold4, b: PAL.gold3, c: PAL.fire3 }, x, y);
}

function drawTypeIcon(p: PixelCanvas, x: number, y: number, kind: 'normal' | 'equip' | 'field' | 'trap', ramp: Ramp): void {
  p.rect(x - 1, y - 1, 7, 7, PAL.ink);
  p.rect(x, y, 5, 5, ramp[1]);
  p.stamp(TYPE_ICON[kind], { '#': ramp[4], o: ramp[3] }, x, y);
}

// ---------------------------------------------------------------- artwork window

const ART_BG: Record<Attribute, (p: PixelCanvas, rnd: () => number) => void> = {
  LIGHT(p, rnd) {
    rgrad(p, 0, 0, CARD_ART_W, CARD_ART_H, 22, 13, 30, [PAL.gold4, PAL.gold3, PAL.gold2, PAL.gold1, PAL.gold0], 1.25);
    // god rays
    for (let a = 0; a < 12; a++) {
      if (a % 2) continue;
      const ang = (a / 12) * Math.PI * 2 + 0.2;
      for (let r = 6; r < 34; r++) {
        const x = 22 + Math.cos(ang) * r;
        const y = 13 + Math.sin(ang) * r * 0.8;
        const c = p.get(x, y);
        if (c !== null && PixelCanvas.ditherAt(Math.floor(x), Math.floor(y), 9)) p.set(x, y, mix(c, PAL.gold4, 0.45));
      }
    }
    for (let i = 0; i < 9; i++) p.set(Math.floor(rnd() * 44), Math.floor(rnd() * 34), PAL.white);
  },
  DARK(p, rnd) {
    rgrad(p, 0, 0, CARD_ART_W, CARD_ART_H, 22, 15, 30, [PAL.void2, PAL.void1, PAL.void0, PAL.ink]);
    // swirl arms
    for (let arm = 0; arm < 3; arm++)
      for (let t = 0; t < 60; t++) {
        const ang = arm * 2.094 + t * 0.09;
        const r = 3 + t * 0.42;
        const x = 22 + Math.cos(ang) * r;
        const y = 15 + Math.sin(ang) * r * 0.75;
        p.set(x, y, t < 30 ? PAL.void3 : PAL.void2, 150);
      }
    for (let i = 0; i < 12; i++) p.set(Math.floor(rnd() * 44), Math.floor(rnd() * 34), rnd() < 0.4 ? PAL.void4 : PAL.void3);
  },
  FIRE(p, rnd) {
    vgrad(p, 0, 0, CARD_ART_W, CARD_ART_H, [PAL.fire0, PAL.fire1, PAL.fire2, PAL.fire3]);
    // heat licks rising from the bottom
    for (let x = 0; x < CARD_ART_W; x++) {
      const hgt = 7 + Math.round(4 * Math.sin(x * 0.7) + 3 * Math.sin(x * 1.9 + 1));
      for (let y = CARD_ART_H - hgt; y < CARD_ART_H; y++) {
        const t = (y - (CARD_ART_H - hgt)) / hgt;
        p.set(x, y, t > 0.6 ? PAL.fire4 : PAL.fire3, PixelCanvas.ditherAt(x, y, 10) ? 255 : 120);
      }
    }
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(rnd() * 44);
      const y = Math.floor(rnd() * 26);
      p.set(x, y, rnd() < 0.5 ? PAL.fire4 : PAL.fire3);
    }
  },
  WATER(p, rnd) {
    vgrad(p, 0, 0, CARD_ART_W, CARD_ART_H, [PAL.water2, PAL.water1, PAL.water1, PAL.water0]);
    // caustic light ribbons
    for (let k = 0; k < 4; k++) {
      const y0 = 4 + k * 7;
      for (let x = 0; x < CARD_ART_W; x++) {
        const y = y0 + Math.round(1.6 * Math.sin(x * 0.45 + k * 1.7));
        p.set(x, y, k < 2 ? PAL.water3 : PAL.water2, PixelCanvas.ditherAt(x, y, 11) ? 220 : 90);
      }
    }
    for (let i = 0; i < 7; i++) {
      const x = 2 + Math.floor(rnd() * 40);
      const y = 2 + Math.floor(rnd() * 30);
      if (rnd() < 0.5) p.ring(x, y, 1.5, PAL.water4, 200);
      else p.set(x, y, PAL.water4);
    }
  },
  EARTH(p, rnd) {
    vgrad(p, 0, 0, CARD_ART_W, CARD_ART_H, [PAL.earth3, PAL.earth2, PAL.earth1, PAL.earth0]);
    // distant mesa silhouettes
    for (let x = 0; x < CARD_ART_W; x++) {
      const top = 14 + Math.round(3 * Math.sin(x * 0.21 + 0.6) + (x > 26 && x < 36 ? -4 : 0));
      for (let y = top; y < CARD_ART_H; y++) p.set(x, y, y === top ? PAL.earth2 : PAL.earth1);
    }
    // strata
    for (let k = 0; k < 3; k++)
      for (let x = 0; x < CARD_ART_W; x++) {
        const y = 21 + k * 4 + Math.round(Math.sin(x * 0.3 + k) * 1.2);
        if (PixelCanvas.ditherAt(x, y, 10)) p.set(x, y, PAL.earth0);
      }
    for (let i = 0; i < 8; i++) p.set(Math.floor(rnd() * 44), 20 + Math.floor(rnd() * 14), PAL.earth3);
  },
  WIND(p, rnd) {
    vgrad(p, 0, 0, CARD_ART_W, CARD_ART_H, [PAL.leaf3, PAL.leaf2, PAL.leaf1, PAL.leaf0]);
    // wind streaks
    for (let k = 0; k < 6; k++) {
      const y0 = 3 + k * 5 + Math.floor(rnd() * 3);
      const x0 = Math.floor(rnd() * 20) - 4;
      const len = 12 + Math.floor(rnd() * 16);
      for (let i = 0; i < len; i++) {
        const x = x0 + i;
        const y = y0 + Math.round(Math.sin(i * 0.25 + k) * 1.5);
        p.set(x, y, k % 2 ? PAL.leaf4 : PAL.leaf3, i < 3 || i > len - 4 ? 110 : 210);
      }
    }
    for (let i = 0; i < 6; i++) p.set(Math.floor(rnd() * 44), Math.floor(rnd() * 34), PAL.leaf4);
  },
};

/** Draw a soft attribute-tinted backdrop (exported so cut-ins / inspect can reuse it). */
export function drawAttributeBackdrop(p: PixelCanvas, attr: Attribute, seed = 1): void {
  ART_BG[attr](p, mulberry32(seed));
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Card artwork for a monster: portrait if provided, else the idle frame cropped onto a backdrop. */
function monsterArtCanvas(def: MonsterCardDef): PixelCanvas {
  const art = monsterArt(def.id);
  if (art.portrait) {
    const p = new PixelCanvas(CARD_ART_W, CARD_ART_H);
    art.portrait(p);
    return p;
  }
  return monsterCropArt(def.id);
}

/** Fallback card art: the idle frame cropped onto an attribute backdrop (ignores portraits). */
export function monsterCropArt(id: MonsterId): PixelCanvas {
  const def = cardDef(id) as MonsterCardDef;
  const art = monsterArt(id);
  const p = new PixelCanvas(CARD_ART_W, CARD_ART_H);
  drawAttributeBackdrop(p, def.attribute, hashStr(def.id));
  const fr = monsterFrame(def.id, 'idle', 0);
  const b = fr.bounds();
  if (!b) return p;
  const W = CARD_ART_W;
  const H = CARD_ART_H;
  // Crop placement: fit the whole sprite if possible (feet near the bottom), otherwise
  // frame the head/upper body (monsters face right, heads sit high).
  let ox: number;
  let oy: number;
  if (b.w <= W - 4) ox = Math.round((W - b.w) / 2) - b.x;
  else ox = 0;
  if (b.h <= H - 3) oy = H - 2 - (b.y + b.h);
  else oy = 0;
  if (b.w > W - 4 || b.h > H - 3) {
    // Sprite bigger than the window: pick the most "interesting" window — coverage, plus bright
    // isolated pixels (eyes / energy points are the brightest single pixels), biased upward.
    const fw = fr.w;
    const fh = fr.h;
    const sat = new Float64Array((fw + 1) * (fh + 1));
    for (let y = 0; y < fh; y++) {
      let row = 0;
      for (let x = 0; x < fw; x++) {
        const c = fr.get(x, y);
        let v = 0;
        if (c !== null) {
          v = 0.25;
          const l = lum(c);
          if (l > 170) {
            let darker = 0;
            for (const [dx, dy] of [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ]) {
              const n = fr.get(x + dx, y + dy);
              if (n === null || lum(n) < l - 60) darker++;
            }
            if (darker >= 3) v += 6;
          }
          const ty = (y - b.y) / b.h;
          v *= 2.2 * Math.pow(1 - ty, 2) + 0.15;
        }
        row += v;
        sat[(y + 1) * (fw + 1) + x + 1] = sat[y * (fw + 1) + x + 1] + row;
      }
    }
    const sum = (x0: number, y0: number, x1: number, y1: number) => {
      x0 = Math.max(0, Math.min(fw, x0));
      x1 = Math.max(0, Math.min(fw, x1));
      y0 = Math.max(0, Math.min(fh, y0));
      y1 = Math.max(0, Math.min(fh, y1));
      return sat[y1 * (fw + 1) + x1] - sat[y0 * (fw + 1) + x1] - sat[y1 * (fw + 1) + x0] + sat[y0 * (fw + 1) + x0];
    };
    let best = -1;
    const xr: [number, number] = b.w > W - 4 ? [b.x - 2, b.x + b.w + 2 - W] : [b.x + b.w / 2 - W / 2, b.x + b.w / 2 - W / 2];
    const yr: [number, number] = b.h > H - 3 ? [b.y - 2, b.y + b.h + 2 - H] : [b.y + b.h + 2 - H, b.y + b.h + 2 - H];
    for (let wy = Math.round(yr[0]); wy <= Math.round(yr[1]); wy++)
      for (let wx = Math.round(xr[0]); wx <= Math.round(xr[1]); wx++) {
        const sc = sum(wx, wy, wx + W, wy + H);
        if (sc > best) {
          best = sc;
          ox = -wx;
          oy = -wy;
        }
      }
  }
  const [r0, , , r3, r4] = ATTRIBUTE_RAMP[def.attribute];
  // ground shadow under walkers
  const gy = art.anchorY + oy;
  if (gy < H + 2 && gy > 4) p.ellipse(art.anchorX + ox, gy, Math.min(16, b.w * 0.42), 2.4, r0, 200);
  // rim glow: dilated silhouette behind the sprite
  const glow = new PixelCanvas(W, H);
  glow.blit(fr, ox, oy);
  const halo = glow.clone().map(() => r4);
  halo.outline(r3);
  halo.outline(r3, { corners: true });
  halo.map((c, x, y) => (glow.isOpaque(x, y) ? null : c === r4 ? null : PixelCanvas.ditherAt(x, y, 9) ? c : null));
  p.blit(halo, 0, 0, { alpha: 0.85 });
  p.blit(fr, ox, oy);
  return p;
}

function fallbackArt(id: CardId): PixelCanvas {
  const d = cardDef(id);
  const p = new PixelCanvas(CARD_ART_W, CARD_ART_H);
  const r = kindRamp(d.kind);
  rgrad(p, 0, 0, CARD_ART_W, CARD_ART_H, 22, 17, 26, [r[3], r[2], r[1], r[0]]);
  p.disc(22, 17, 6, r[4]);
  return p;
}

const artCache = new Map<CardId, PixelCanvas>();

/** The 44×34 artwork of any card (cached). */
export function cardArtCanvas(id: CardId): PixelCanvas {
  let p = artCache.get(id);
  if (!p) {
    const d = cardDef(id);
    if (isMonster(d)) p = monsterArtCanvas(d);
    else {
      const a = cardArtwork(id);
      if (a) {
        p = new PixelCanvas(CARD_ART_W, CARD_ART_H);
        a.draw(p);
      } else p = fallbackArt(id);
    }
    artCache.set(id, p);
  }
  return p;
}

// ---------------------------------------------------------------- face

const FOIL = [PAL.cyan4, PAL.leaf4, PAL.gold4, PAL.mag4, PAL.void4];

function foilColor(x: number, y: number): number {
  const t = (((x - y * 0.8) / 9) % FOIL.length + FOIL.length) % FOIL.length;
  const i = Math.floor(t);
  return mix(FOIL[i], FOIL[(i + 1) % FOIL.length], t - i);
}

/** Greeked title: one 2px bar per word (length from the word), reads as a name at 1×. */
function pseudoText(p: PixelCanvas, x: number, y: number, maxW: number, text: string, color: number, shade2: number): void {
  let cx = x;
  for (const word of text.split(/\s+/)) {
    const len = Math.min(x + maxW - cx, word.length * 2 + 1);
    if (len < 3) return;
    p.hline(cx + 1, cx + len - 1, y, color);
    p.hline(cx, cx + len - 2, y + 1, color);
    p.set(cx + len - 1, y + 1, shade2);
    p.set(cx, y, shade2);
    cx += len + 3;
  }
}

function fakeTextLines(p: PixelCanvas, x: number, y: number, w: number, lines: number, seed: number, color: number, last = 0.55): void {
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

function drawFrameBody(p: PixelCanvas, ramp: Ramp, ace: boolean): void {
  const W = FACE_W;
  const H = FACE_H;
  // silhouette: ink with clipped corners
  p.rect(0, 0, W, H, PAL.ink);
  p.erase(0, 0).erase(W - 1, 0).erase(0, H - 1).erase(W - 1, H - 1);
  // brushed metal body
  vgrad(p, 1, 1, W - 2, H - 2, [ramp[1], ramp[1], ramp[1], ramp[0]]);
  const rnd = mulberry32(7);
  for (let y = 2; y < H - 2; y++) {
    if (y < 17) continue; // keep the plate / star rows clean
    if (rnd() < 0.3) {
      const x0 = 1 + Math.floor(rnd() * (W - 8));
      p.hline(x0, x0 + 2 + Math.floor(rnd() * 6), y, y < H * 0.4 ? ramp[2] : ramp[1], 255);
    }
  }
  // bevel
  raised(p, 1, 1, W - 2, H - 2, ramp[3], ramp[0]);
  p.hline(2, W - 3, 1, ramp[4]);
  p.set(1, 1, ramp[4]).set(1, 2, ramp[4]).set(1, 3, ramp[4]);
  if (ace) {
    p.hline(3, 14, 1, ramp[4]);
    p.vline(1, 3, 12, ramp[4]);
    p.set(W - 2, H - 2, PAL.gold3);
  }
}

function drawNamePlate(p: PixelCanvas, def: CardDef, ramp: Ramp, ace: boolean): void {
  const x = 2;
  const y = 2;
  const w = 35;
  const h = 8;
  if (ace) {
    vgrad(p, x, y, w, h, [PAL.gold4, PAL.gold3, PAL.gold2, PAL.gold3]);
    for (let yy = y + 1; yy < y + h - 1; yy++)
      for (let xx = x + 1; xx < x + w - 1; xx++)
        if (PixelCanvas.ditherAt(xx, yy, 5)) p.set(xx, yy, foilColor(xx, yy), 120);
    inset(p, x, y, w, h, PAL.gold1, PAL.gold4);
    pseudoText(p, x + 3, y + 3, w - 6, def.name, PAL.gold0, PAL.gold1);
    p.set(x + w - 3, y + 2, PAL.white);
  } else {
    vgrad(p, x, y, w, h, [PAL.night0, PAL.night1, PAL.night1, PAL.night2]);
    inset(p, x, y, w, h, PAL.ink, ramp[3]);
    pseudoText(p, x + 3, y + 3, w - 6, def.name, PAL.mist, PAL.steel);
  }
}

function drawArtWindow(p: PixelCanvas, id: CardId, accent: Ramp, ace: boolean): void {
  const ax = 2;
  const ay = 17;
  p.blit(cardArtCanvas(id), ax, ay);
  if (ace) {
    // holo foil: rainbow lives in the highlights; darks stay clean
    for (let y = ay + 1; y < ay + CARD_ART_H - 1; y++)
      for (let x = ax + 1; x < ax + CARD_ART_W - 1; x++) {
        const c = p.get(x, y);
        if (c === null) continue;
        const l = lum(c);
        if (l > 150) p.set(x, y, mix(c, foilColor(x, y), Math.min(0.45, ((l - 150) / 105) * 0.5)));
      }
    for (const [sx, sy] of [
      [ax + 3, ay + 3],
      [ax + CARD_ART_W - 5, ay + CARD_ART_H - 5],
    ]) {
      p.set(sx, sy, PAL.white).set(sx - 1, sy, PAL.cyan4).set(sx + 1, sy, PAL.mag4).set(sx, sy - 1, PAL.gold4).set(sx, sy + 1, PAL.cyan4);
    }
  }
  // inset frame on the window's border pixels
  for (let x = ax; x < ax + CARD_ART_W; x++) {
    const c = p.get(x, ay)!;
    p.set(x, ay, mix(c, PAL.ink, 0.75));
    p.set(x, ay + CARD_ART_H - 1, accent[3]);
  }
  for (let y = ay; y < ay + CARD_ART_H - 1; y++) {
    const c = p.get(ax, y)!;
    p.set(ax, y, mix(c, PAL.ink, 0.75));
    p.set(ax + CARD_ART_W - 1, y, accent[3]);
  }
  p.set(ax + CARD_ART_W - 1, ay, accent[2]);
  p.set(ax, ay + CARD_ART_H - 1, accent[2]);
}

function drawTextBox(p: PixelCanvas, def: CardDef, ramp: Ramp, accent: Ramp): void {
  const x = 2;
  const y = 52;
  const w = 44;
  const h = 14;
  vgrad(p, x, y, w, h, [PAL.night1, PAL.night0, PAL.night0]);
  inset(p, x, y, w, h, PAL.ink, ramp[3]);
  const seed = hashStr(def.id);
  if (isMonster(def)) {
    fakeTextLines(p, x + 3, y + 2, w - 6, 2, seed, def.text ? PAL.night4 : PAL.night3, 0.6);
    // divider
    for (let xx = x + 2; xx < x + w - 2; xx++) if ((xx & 1) === 0) p.set(xx, y + 6, accent[1]);
    // ATK / DEF
    const atk = String(def.atk);
    const dfs = String(def.def);
    const sy = y + 8;
    // sword icon (3×3 diagonal + hilt)
    const ix = x + 3;
    p.stamp(SWORD, { '#': PAL.fire4 }, ix, sy);
    p.set(ix, sy + 3, PAL.fire2).set(ix + 1, sy + 3, PAL.fire3).set(ix, sy + 4, PAL.fire2);
    p.set(ix + 2, sy + 2, PAL.fire3);
    drawDigits(p, ix + 4, sy, atk, PAL.white, PAL.ink);
    // shield icon
    const jx = x + 24;
    p.stamp(['###', '#o#', '#o#', '.#.'], { '#': PAL.water3, o: PAL.water4 }, jx, sy);
    drawDigits(p, jx + 4, sy, dfs, PAL.mist, PAL.ink);
  } else {
    fakeTextLines(p, x + 3, y + 2, w - 6, 5, seed, PAL.night4, 0.4);
    // little kind emblem bottom-right
    const ex = x + w - 7;
    const ey = y + h - 6;
    p.stamp(def.kind === 'spell' ? SPELL_GLYPH : TRAP_GLYPH, { '#': ramp[2], o: ramp[1] }, ex, ey);
  }
}

function drawLevelRow(p: PixelCanvas, def: CardDef, ramp: Ramp): void {
  const y = 11;
  if (isMonster(def)) {
    for (let i = 0; i < def.level; i++) drawStar(p, 40 - i * 6, y);
    return;
  }
  const t = def.kind === 'trap' ? 'trap' : def.spellType;
  const icon: 'normal' | 'equip' | 'field' | 'trap' = t === 'trap' ? 'trap' : t === 'equip' ? 'equip' : t === 'field' ? 'field' : 'normal';
  drawTypeIcon(p, 40, y, icon, ramp);
  // banner rule leading into the icon
  p.hline(4, 37, y + 2, ramp[3]);
  p.hline(5, 37, y + 3, ramp[0]);
  p.set(3, y + 2, ramp[4]).set(4, y + 1, ramp[4]).set(4, y + 3, ramp[4]);
}

function drawFace(id: CardId): PixelCanvas {
  const def = cardDef(id);
  const p = new PixelCanvas(FACE_W, FACE_H);
  const ramp = kindRamp(def.kind);
  const accent = cardAccentRamp(id);
  const ace = isMonster(def) && def.ace;
  drawFrameBody(p, ramp, ace);
  drawNamePlate(p, def, ramp, ace);
  drawAttributeOrb(p, 37, 1, isMonster(def) ? def.attribute : def.kind === 'spell' ? 'SPELL' : 'TRAP');
  drawLevelRow(p, def, ramp);
  drawArtWindow(p, id, isMonster(def) ? accent : ramp, ace);
  drawTextBox(p, def, ramp, accent);
  // attribute corner gems (monsters)
  if (isMonster(def)) {
    p.set(1, FACE_H - 2, accent[3]).set(FACE_W - 2, 1, accent[4]);
  }
  return p;
}

// ---------------------------------------------------------------- back

function hexPoints(cx: number, cy: number, r: number, sy = 1): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * sy]);
  }
  return pts;
}

const N_SIGIL = ['##...##', '###..##', '###..##', '####.##', '##.####', '##..###', '##..###', '##...##', '##...##'];

function drawBack(): PixelCanvas {
  const W = FACE_W;
  const H = FACE_H;
  const p = new PixelCanvas(W, H);
  p.rect(0, 0, W, H, PAL.ink);
  p.erase(0, 0).erase(W - 1, 0).erase(0, H - 1).erase(W - 1, H - 1);
  // steel frame
  vgrad(p, 1, 1, W - 2, H - 2, [PAL.steel, PAL.night4, PAL.night3, PAL.night2]);
  raised(p, 1, 1, W - 2, H - 2, PAL.mist, PAL.night1);
  p.set(1, 1, PAL.white);
  // inner panel
  const px = 4;
  const py = 4;
  const pw = W - 8;
  const ph = H - 8;
  rgrad(p, px, py, pw, ph, 24, 34, 34, [PAL.night3, PAL.night2, PAL.night1, PAL.night0], 0.8);
  // lattice of tiny hexes
  for (let y = py; y < py + ph; y++)
    for (let x = px; x < px + pw; x++) {
      const gx = (x - px + (Math.floor((y - py) / 6) % 2) * 3) % 6;
      const gy = (y - py) % 6;
      if ((gy === 0 && gx < 3) || (gx === 3 && gy > 0 && gy < 3)) {
        const c = p.get(x, y)!;
        p.set(x, y, mix(c, PAL.night4, 0.35));
      }
    }
  inset(p, px - 1, py - 1, pw + 2, ph + 2, PAL.ink, PAL.night4);
  // neon trim line + corner brackets
  p.frame(px + 1, py + 1, pw - 2, ph - 2, PAL.void2);
  for (const [cx, cy, dx, dy] of [
    [px + 1, py + 1, 1, 1],
    [px + pw - 2, py + 1, -1, 1],
    [px + 1, py + ph - 2, 1, -1],
    [px + pw - 2, py + ph - 2, -1, -1],
  ] as const) {
    for (let i = 0; i < 4; i++) {
      p.set(cx + dx * i, cy, i === 0 ? PAL.cyan4 : PAL.cyan2);
      p.set(cx, cy + dy * i, i === 0 ? PAL.cyan4 : PAL.cyan2);
    }
    p.set(cx + dx * 2, cy + dy * 2, PAL.cyan1);
  }
  // emblem
  const cx = 24;
  const cy = 34;
  // circuit traces from the hex vertices out to the panel, ending in nodes
  const traces: [number, number, number, number, number, number][] = [
    [24, 18, 24, 12, 24, 12],
    [24, 50, 24, 56, 24, 56],
    [10, 26, 7, 23, 7, 14],
    [38, 26, 41, 23, 41, 14],
    [10, 42, 7, 45, 7, 54],
    [38, 42, 41, 45, 41, 54],
  ];
  for (const [x0, y0, x1, y1, x2, y2] of traces) {
    p.line(x0, y0, x1, y1, PAL.void3);
    p.line(x1, y1, x2, y2, PAL.void3);
    p.set(x2, y2, PAL.cyan3);
    p.set(x2, y2 + (y2 < cy ? -1 : 1), PAL.cyan1);
  }
  // soft cyan halo around the hex
  for (let y = cy - 22; y <= cy + 22; y++)
    for (let x = cx - 22; x <= cx + 22; x++) {
      const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 0.95);
      if (d > 17 && d < 21 && PixelCanvas.ditherAt(x, y, Math.round((21 - d) * 2.5))) {
        const c = p.get(x, y);
        if (c !== null) p.set(x, y, mix(c, PAL.cyan2, 0.45));
      }
    }
  p.poly(hexPoints(cx, cy, 18), PAL.void1, 200);
  p.poly(hexPoints(cx, cy, 17.2), PAL.ink);
  const outer = new PixelCanvas(W, H);
  outer.poly(hexPoints(cx, cy, 16.2), 0xffffff);
  rgradMasked(p, outer, cx, cy, 16, [PAL.void2, PAL.void1, PAL.void0, PAL.void0, PAL.void1]);
  p.polyline(hexPoints(cx, cy, 16), PAL.cyan3, true);
  p.polyline(hexPoints(cx, cy, 15), PAL.cyan1, true);
  // rune ticks on the ring (between the two hexes)
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 6 + Math.PI / 12;
    const rx = cx + Math.cos(a) * 12.6;
    const ry = cy + Math.sin(a) * 12.6;
    p.set(rx, ry, i % 2 ? PAL.void3 : PAL.cyan3);
  }
  // inner hex: hot magenta core
  const core = new PixelCanvas(W, H);
  core.poly(hexPoints(cx, cy, 9.6), 0xffffff);
  rgradMasked(p, core, cx, cy, 9.5, [PAL.mag2, PAL.mag1, PAL.void1, PAL.void0]);
  p.polyline(hexPoints(cx, cy, 10), PAL.mag3, true);
  // studs on the outer vertices
  for (const [vx, vy] of hexPoints(cx, cy, 16)) {
    const ix = Math.round(vx - 0.5);
    const iy = Math.round(vy - 0.5);
    p.rect(ix - 1, iy - 1, 3, 3, PAL.ink);
    p.set(ix, iy, PAL.gold4);
  }
  // N sigil: ink drop shadow, white→cyan two-tone, glint
  p.stamp(N_SIGIL, { '#': PAL.ink }, cx - 3, cy - 3);
  p.stamp(N_SIGIL, { '#': PAL.ink }, cx - 4, cy - 5);
  p.stamp(N_SIGIL.slice(0, 4), { '#': PAL.white }, cx - 4, cy - 4);
  p.stamp(N_SIGIL.slice(4), { '#': PAL.cyan4 }, cx - 4, cy);
  p.stamp(['', '', '', '', '', '', '', '##...##', '##...##'], { '#': PAL.cyan3 }, cx - 4, cy - 4);
  // top/bottom ornaments
  for (const oy of [9, H - 10]) {
    p.hline(14, 33, oy, PAL.night4);
    p.set(23, oy - 1, PAL.cyan3).set(24, oy - 1, PAL.cyan3);
    p.rect(23, oy, 2, 1, PAL.cyan4);
    p.set(23, oy + 1, PAL.cyan3).set(24, oy + 1, PAL.cyan3);
    p.set(13, oy, PAL.cyan2).set(34, oy, PAL.cyan2);
  }
  return p;
}

// ---------------------------------------------------------------- mini (iso source) levels

export const MINI_W = 18;
export const MINI_H = 26;

function drawMiniFace(id: CardId): PixelCanvas {
  const def = cardDef(id);
  const ramp = kindRamp(def.kind);
  const accent = cardAccentRamp(id);
  const ace = isMonster(def) && def.ace;
  const W = MINI_W;
  const H = MINI_H;
  const p = new PixelCanvas(W, H);
  vgrad(p, 0, 0, W, H, [ramp[2], ramp[1], ramp[1], ramp[0]]);
  raised(p, 0, 0, W, H, ramp[3], ramp[0]);
  p.set(0, 0, ramp[4]);
  // header: plate + orb
  p.hline(1, 12, 1, ace ? PAL.gold4 : PAL.night0);
  p.hline(1, 12, 2, ace ? PAL.gold2 : PAL.night1);
  const orb = isMonster(def) ? ATTRIBUTE_RAMP[def.attribute] : ramp;
  p.rect(14, 1, 2, 2, orb[3]);
  p.set(14, 1, orb[4]);
  p.set(16, 1, orb[1]).set(16, 2, orb[1]);
  // art window 16×12
  const art = downsample(cardArtCanvas(id), 16, 12);
  p.blit(art, 1, 4);
  p.hline(1, 16, 3, PAL.ink);
  p.hline(1, 16, 16, accent[3]);
  // text box
  p.rect(1, 17, 16, 7, PAL.night0);
  p.hline(1, 16, 17, PAL.night1);
  if (isMonster(def)) {
    p.hline(3, 7, 21, PAL.mist);
    p.hline(10, 14, 21, PAL.steel);
  } else {
    p.hline(3, 13, 19, PAL.night3);
    p.hline(3, 9, 21, PAL.night3);
  }
  p.hline(1, 16, 24, ramp[1]);
  return p;
}

function drawMiniBack(): PixelCanvas {
  const W = MINI_W;
  const H = MINI_H;
  const p = new PixelCanvas(W, H);
  vgrad(p, 0, 0, W, H, [PAL.night4, PAL.night3, PAL.night2]);
  raised(p, 0, 0, W, H, PAL.mist, PAL.night1);
  rgrad(p, 2, 2, W - 4, H - 4, 9, 13, 12, [PAL.night2, PAL.night1, PAL.night0]);
  p.frame(2, 2, W - 4, H - 4, PAL.void2);
  const cx = 9;
  const cy = 13;
  p.poly(hexPoints(cx, cy, 6.5), PAL.void0);
  p.polyline(hexPoints(cx, cy, 6), PAL.cyan3, true);
  p.polyline(hexPoints(cx, cy, 3.4), PAL.mag3, true);
  p.rect(8, 12, 2, 2, PAL.cyan4);
  p.set(8, 12, PAL.white);
  return p;
}

// ---------------------------------------------------------------- caches

export interface CardMip {
  /** Source levels, largest first. */
  levels: PixelCanvas[];
  /** Card stock edge color for this side. */
  edge: number;
}

const faceCache = new Map<CardId, PixelCanvas>();
const mipCache = new Map<CardId | 'back', CardMip>();
let backCanvas: PixelCanvas | null = null;

/** Upright face pixels (48×68), cached. */
export function cardFaceCanvas(id: CardId): PixelCanvas {
  let p = faceCache.get(id);
  if (!p) {
    p = drawFace(id);
    faceCache.set(id, p);
  }
  return p;
}

/** Upright back pixels (48×68), cached. */
export function cardBackCanvas(): PixelCanvas {
  if (!backCanvas) backCanvas = drawBack();
  return backCanvas;
}

/** Multi-resolution sources for the pose renderer. */
export function cardMip(id: CardId | 'back'): CardMip {
  let m = mipCache.get(id);
  if (!m) {
    if (id === 'back') {
      const full = cardBackCanvas();
      m = { levels: [full, halve(full), drawMiniBack()], edge: PAL.night1 };
    } else {
      const full = cardFaceCanvas(id);
      m = { levels: [full, halve(full), drawMiniFace(id)], edge: kindRamp(cardDef(id).kind)[0] };
    }
    mipCache.set(id, m);
  }
  return m;
}

/** Drop caches (e.g. after monster art hot-reloads). */
export function resetCardCaches(): void {
  faceCache.clear();
  mipCache.clear();
  artCache.clear();
  backCanvas = null;
}

// ---------------------------------------------------------------- 3D pose math
//
// Board space ("grid units"): gx along columns, gy along rows, gz up; 1 tile = 32 units.
// Dimetric 2:1 projection: screen = (gx - gy, (gx + gy) / 2 - gz * ZS). ZS = √1.5 makes the
// projection orthographic, so a card perpendicular to the view direction shows undistorted.
// Card local frame: u = width (+gx at rest), v = top→bottom (+gy at rest), n = front normal (+gz).

export type V3 = [number, number, number];
export type Quat = [number, number, number, number];

export const ZS = Math.sqrt(1.5);
export const Q_ID: Quat = [0, 0, 0, 1];

export function isoProject(g: V3): [number, number] {
  return [g[0] - g[1], (g[0] + g[1]) / 2 - g[2] * ZS];
}

export function qAxis(axis: V3, angle: number): Quat {
  const l = Math.hypot(axis[0], axis[1], axis[2]) || 1;
  const s = Math.sin(angle / 2) / l;
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)];
}

/** a ∘ b (apply b first, then a). */
export function qMul(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export function qRot(q: Quat, v: V3): V3 {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
}

export function qSlerp(a: Quat, b: Quat, t: number): Quat {
  let [bx, by, bz, bw] = b;
  let cos = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (cos < 0) {
    cos = -cos;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  let k0: number;
  let k1: number;
  if (cos > 0.9995) {
    k0 = 1 - t;
    k1 = t;
  } else {
    const th = Math.acos(Math.min(1, cos));
    const s = Math.sin(th);
    k0 = Math.sin((1 - t) * th) / s;
    k1 = Math.sin(t * th) / s;
  }
  const q: Quat = [a[0] * k0 + bx * k1, a[1] * k0 + by * k1, a[2] * k0 + bz * k1, a[3] * k0 + bw * k1];
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

/** Quaternion whose rotation maps the base axes (x, y, z) onto (u, v, n) (orthonormalized). */
export function qFromBasis(u: V3, v: V3): Quat {
  const nu = norm(u);
  let nv = norm(v);
  const nn = norm(cross(nu, nv));
  nv = cross(nn, nu);
  const m00 = nu[0];
  const m10 = nu[1];
  const m20 = nu[2];
  const m01 = nv[0];
  const m11 = nv[1];
  const m21 = nv[2];
  const m02 = nn[0];
  const m12 = nn[1];
  const m22 = nn[2];
  const tr = m00 + m11 + m22;
  let q: Quat;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s];
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
  }
  return q;
}

export function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
export function norm(a: V3): V3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

/** Rest size of a flat card on a tile, in grid units (= mini source pixels at 1:1). */
export const FLAT_W = MINI_W;
export const FLAT_H = MINI_H;
/** Grid-unit size of a card standing vertically that projects to exactly FACE_W × FACE_H px. */
export const STAND_W = FACE_W / Math.SQRT2;
export const STAND_H = FACE_H / ZS;

/** Orientation of a card resting flat on a tile. */
export function restQuat(player: PlayerId, orientation: CardOrientation, faceUp: boolean): Quat {
  let q: Quat = orientation === 'side' ? qAxis([0, 0, 1], -Math.PI / 2) : Q_ID;
  if (player === 1) q = qMul(qAxis([0, 0, 1], Math.PI), q);
  if (!faceUp) q = qMul(q, qAxis([0, 1, 0], Math.PI));
  return q;
}

/** Card standing vertically, front facing the camera (u → screen right, v → screen down). */
export function standQuat(): Quat {
  return qFromBasis([Math.SQRT1_2, -Math.SQRT1_2, 0], [0, 0, -1]);
}

export interface RenderOpts {
  /** Add the 1px ink outline (default true). */
  outline?: boolean;
  /** Draw the card's stock edge (thickness, default true). */
  thickness?: boolean;
  /** -1..1: < 0 darkens toward ink, > 0 brightens toward white (glints while turning). */
  light?: number;
  /** Mix every pixel toward this color by tintAmt (flashes). */
  tint?: number;
  tintAmt?: number;
  /** Paint a solid color instead of sampling (silhouettes). */
  solid?: number;
  /** Specular streak across the face: diagonal band center in card units (~-1..1 sweeps across). */
  glint?: number;
  /** Streak half-width in card units (default 0.14). */
  glintW?: number;
}

const PINK = PAL.ink;

/**
 * Rasterize a card with screen axes ex (card width) and ey (card height, top→bottom)
 * centered on (cx, cy) of `dst`. Front is shown when the projected frame is right-handed.
 * Sampling is nearest-neighbor from the mip level closest in scale (crisp pixels at 1:1).
 * Returns the number of covered pixels.
 */
export function renderCard(
  dst: PixelCanvas,
  cx: number,
  cy: number,
  ex: readonly [number, number],
  ey: readonly [number, number],
  nrm: V3,
  front: CardMip,
  back: CardMip,
  opts: RenderOpts = {},
): number {
  const det = ex[0] * ey[1] - ey[0] * ex[1];
  const side = det >= 0 ? front : back;
  const area = Math.abs(det);
  let lvl = side.levels[side.levels.length - 1];
  let best = Infinity;
  for (const l of side.levels) {
    const s = Math.abs(Math.log((area + 1e-6) / (l.w * l.h)));
    if (s < best - 0.05) {
      best = s;
      lvl = l;
    }
  }
  const W = dst.w;
  const H = dst.h;
  const cover = new Uint8Array(W * H);
  const hx = Math.abs(ex[0]) / 2 + Math.abs(ey[0]) / 2;
  const hy = Math.abs(ex[1]) / 2 + Math.abs(ey[1]) / 2;
  const x0 = Math.max(0, Math.floor(cx - hx) - 1);
  const x1 = Math.min(W - 1, Math.ceil(cx + hx) + 1);
  const y0 = Math.max(0, Math.floor(cy - hy) - 1);
  const y1 = Math.min(H - 1, Math.ceil(cy + hy) + 1);
  const lw = lvl.w;
  const lh = lvl.h;
  const sd = lvl.data;
  const dd = dst.data;
  const light = opts.light ?? 0;
  const lc = light > 0 ? 255 : 7;
  const la = Math.min(1, Math.abs(light));
  const tintA = opts.tint !== undefined ? Math.min(1, opts.tintAmt ?? 1) : 0;
  const [tr, tg, tb] = rgb(opts.tint ?? 0);
  const [sr, sg, sb] = rgb(opts.solid ?? 0);
  const glint = opts.glint;
  const gw = opts.glintW ?? 0.14;
  let n = 0;
  const lenE = Math.hypot(ex[0], ex[1]);
  const lenF = Math.hypot(ey[0], ey[1]);
  const thin = area / Math.max(lenE, lenF, 1e-6);
  if (area > 1e-6 && thin >= 0.9) {
    const inv = 1 / det;
    const i00 = ey[1] * inv;
    const i01 = -ey[0] * inv;
    const i10 = -ex[1] * inv;
    const i11 = ex[0] * inv;
    const mirror = det < 0;
    for (let y = y0; y <= y1; y++) {
      const ry = y + 0.5 - cy;
      for (let x = x0; x <= x1; x++) {
        const rx = x + 0.5 - cx;
        const u = i00 * rx + i01 * ry;
        const v = i10 * rx + i11 * ry;
        if (u < -0.5 || u >= 0.5 || v < -0.5 || v >= 0.5) continue;
        let sx = Math.floor((u + 0.5) * lw);
        const sy = Math.floor((v + 0.5) * lh);
        if (mirror) sx = lw - 1 - sx;
        const si = (sy * lw + sx) * 4;
        if (sd[si + 3] === 0) continue;
        const di = (y * W + x) * 4;
        let r = sd[si];
        let g = sd[si + 1];
        let b = sd[si + 2];
        if (opts.solid !== undefined) {
          r = sr;
          g = sg;
          b = sb;
        } else {
          if (la > 0) {
            r += (lc - r) * la;
            g += (lc - g) * la;
            b += (lc - b) * la;
          }
          if (tintA > 0) {
            r += (tr - r) * tintA;
            g += (tg - g) * tintA;
            b += (tb - b) * tintA;
          }
          if (glint !== undefined) {
            const gd = Math.abs(u + v * 0.6 - glint);
            if (gd < gw) {
              const k = gd < gw * 0.45 ? 0.85 : 0.45;
              r += (255 - r) * k;
              g += (255 - g) * k;
              b += (255 - b) * k;
            }
          }
        }
        dd[di] = r;
        dd[di + 1] = g;
        dd[di + 2] = b;
        dd[di + 3] = 255;
        cover[y * W + x] = 1;
        n++;
      }
    }
  } else {
    // Edge-on: draw the card as a sliver along its longer axis.
    const ax = lenE > lenF ? ex : ey;
    const edge = opts.solid ?? (light > 0.3 ? mix(side.edge, PAL.white, 0.6) : mix(side.edge, PAL.mist, 0.4));
    const steps = Math.ceil(Math.hypot(ax[0], ax[1]) * 2) + 1;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps - 0.5;
      const x = Math.floor(cx + ax[0] * t);
      const y = Math.floor(cy + ax[1] * t);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      dst.set(x, y, edge);
      cover[y * W + x] = 1;
      n++;
    }
  }
  if (opts.thickness !== false && n > 0) {
    const nc: V3 = det >= 0 ? nrm : [-nrm[0], -nrm[1], -nrm[2]];
    const [px, py] = isoProject([-nc[0], -nc[1], -nc[2]]);
    const dx = Math.abs(px) >= 0.5 ? Math.sign(px) : 0;
    const dy = Math.abs(py) >= 0.5 ? Math.sign(py) : 0;
    if (dx || dy) {
      const edge = opts.solid ?? side.edge;
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          if (!cover[y * W + x]) continue;
          const tx = x + dx;
          const ty = y + dy;
          if (tx < 0 || ty < 0 || tx >= W || ty >= H || cover[ty * W + tx]) continue;
          dst.set(tx, ty, edge);
        }
    }
  }
  if (opts.outline !== false && n > 0) dst.outline(opts.solid !== undefined ? opts.solid : PINK);
  return n;
}

/** Screen axes + normal of a card pose (size in grid units). */
export function poseAxes(q: Quat, w: number, h: number): { ex: [number, number]; ey: [number, number]; n: V3 } {
  const U = qRot(q, [w, 0, 0]);
  const V = qRot(q, [0, h, 0]);
  const N = qRot(q, [0, 0, 1]);
  return { ex: isoProject(U), ey: isoProject(V), n: N };
}

// ---------------------------------------------------------------- iso textures

export const ISO_TEX_W = 50;
export const ISO_TEX_H = 30;
export const ISO_CX = 25;
export const ISO_CY = 15;
/** Padding of the iso glow texture (its center is at ISO_CX + pad, ISO_CY + pad). */
export const ISO_GLOW_PAD = 2;

/** Render a flat resting card (for static textures / tests). */
export function renderFlat(id: CardId | 'back', orientation: CardOrientation, player: PlayerId, opts: RenderOpts = {}): PixelCanvas {
  const p = new PixelCanvas(ISO_TEX_W, ISO_TEX_H);
  const faceUp = id !== 'back';
  const q = restQuat(player, orientation, faceUp);
  const { ex, ey, n } = poseAxes(q, FLAT_W, FLAT_H);
  const front = cardMip(id === 'back' ? 'back' : id);
  const back = cardMip('back');
  renderCard(p, ISO_CX, ISO_CY, ex, ey, n, front, back, opts);
  return p;
}

// ---------------------------------------------------------------- overlays

function silhouette(src: PixelCanvas): PixelCanvas {
  return src.clone().map(() => 0xffffff);
}

/** Glow around a silhouette: `ring` = solid ring at distance 1 + dithered ring at 2; `inner` = distance-1 ring only. */
function glowRing(sil: PixelCanvas, pad: number): { ring: PixelCanvas; inner: PixelCanvas } {
  const base = new PixelCanvas(sil.w + pad * 2, sil.h + pad * 2);
  base.blit(sil, pad, pad);
  const r1 = base.clone().outline(0xffffff);
  const r2 = r1.clone().outline(0xffffff, { corners: true });
  const ring = new PixelCanvas(base.w, base.h);
  const inner = new PixelCanvas(base.w, base.h);
  for (let y = 0; y < base.h; y++)
    for (let x = 0; x < base.w; x++) {
      if (base.isOpaque(x, y)) continue;
      if (r1.isOpaque(x, y)) {
        ring.set(x, y, 0xffffff);
        inner.set(x, y, 0xffffff);
      } else if (r2.isOpaque(x, y) && PixelCanvas.ditherAt(x, y, 8)) ring.set(x, y, 0xffffff, 200);
    }
  return { ring, inner };
}

/** Perimeter pixels of a ring in walking order (approximate, by angle around the center). */
function perimeter(ring: PixelCanvas): [number, number][] {
  const pts: [number, number, number][] = [];
  const cx = ring.w / 2;
  const cy = ring.h / 2;
  for (let y = 0; y < ring.h; y++)
    for (let x = 0; x < ring.w; x++) {
      if (!ring.isOpaque(x, y)) continue;
      // keep the solid inner ring only: neighbors with the silhouette side
      pts.push([x, y, Math.atan2((y + 0.5 - cy) / ring.h, (x + 0.5 - cx) / ring.w)]);
    }
  pts.sort((a, b) => a[2] - b[2]);
  return pts.map(([x, y]) => [x, y]);
}

function runFrames(ring: PixelCanvas, frames: number, comets = 2, len = 0.12): PixelCanvas[] {
  const per = perimeter(ring);
  const out: PixelCanvas[] = [];
  for (let f = 0; f < frames; f++) {
    const p = new PixelCanvas(ring.w, ring.h);
    for (let c = 0; c < comets; c++) {
      const head = (f / frames + c / comets) % 1;
      per.forEach(([x, y], i) => {
        const t = i / per.length;
        let d = head - t;
        if (d < 0) d += 1;
        if (d < len) p.set(x, y, 0xffffff, Math.round(255 * (1 - d / len)));
      });
    }
    out.push(p);
  }
  return out;
}

/** Diagonal sweep frames clipped to a silhouette. */
function sweepFrames(sil: PixelCanvas, frames: number, rainbow: boolean, width = 6): PixelCanvas[] {
  const out: PixelCanvas[] = [];
  const span = sil.w + sil.h + width * 2;
  for (let f = 0; f < frames; f++) {
    const p = new PixelCanvas(sil.w, sil.h);
    const pos = -width + (f / (frames - 1)) * span;
    for (let y = 0; y < sil.h; y++)
      for (let x = 0; x < sil.w; x++) {
        if (!sil.isOpaque(x, y)) continue;
        const d = x + y * 0.6 - pos;
        const ad = Math.abs(d);
        if (ad > width) continue;
        const core = ad < width * 0.35;
        if (!core && !PixelCanvas.ditherAt(x, y, Math.round(16 * (1 - ad / width)))) continue;
        const c = rainbow ? foilColor(x * 2, y) : 0xffffff;
        p.set(x, y, c, core ? 255 : 170);
      }
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- texture building

function addTex(scene: Phaser.Scene, key: string, p: PixelCanvas): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, p.toCanvas());
}

function addSheet(scene: Phaser.Scene, key: string, frames: [string, PixelCanvas][]): void {
  const w = frames[0][1].w;
  const h = frames[0][1].h;
  const cols = Math.max(1, Math.min(frames.length, Math.floor(2048 / w)));
  const rows = Math.ceil(frames.length / cols);
  const sheet = new PixelCanvas(cols * w, rows * h);
  frames.forEach(([, pc], i) => sheet.blit(pc, (i % cols) * w, Math.floor(i / cols) * h));
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, sheet.toCanvas())!;
  frames.forEach(([name], i) => tex.add(name, 0, (i % cols) * w, Math.floor(i / cols) * h, w, h));
}

function addAnim(scene: Phaser.Scene, key: string, tex: string, names: string[], fps: number, repeat: number): void {
  if (scene.anims.exists(key)) scene.anims.remove(key);
  scene.anims.create({ key, frames: names.map((frame) => ({ key: tex, frame })), frameRate: fps, repeat });
}

export const ANIM_GLOW_RUN = 'card:glowrun';
export const ANIM_SHEEN = 'card:sheen';
export const ANIM_FOIL = 'card:foil';
export function animIsoGlowRun(o: CardOrientation): string {
  return `card:iso:glowrun:${o}`;
}
export function animIsoSheen(o: CardOrientation): string {
  return `card:iso:sheen:${o}`;
}

/** Pixel caches of the iso textures (for dissolve particles etc.). */
const isoCache = new Map<string, PixelCanvas>();
export function isoCanvas(id: CardId | 'back', o: CardOrientation, player: PlayerId = 0): PixelCanvas {
  const k = cardIsoKey(id, o, player);
  let p = isoCache.get(k);
  if (!p) {
    p = renderFlat(id, o, player);
    isoCache.set(k, p);
  }
  return p;
}

/** Build every card texture + overlay animation. Called once at boot. */
export function buildCardTextures(scene: Phaser.Scene): void {
  isoCache.clear();
  // upright
  for (const id of ALL_CARD_IDS) {
    addTex(scene, cardArtKey(id), cardArtCanvas(id));
    addTex(scene, cardFaceKey(id), cardFaceCanvas(id));
  }
  addTex(scene, CARD_BACK, cardBackCanvas());
  const sil = silhouette(cardBackCanvas());
  addTex(scene, CARD_SIL, sil);
  const glow = glowRing(sil, GLOW_PAD);
  const run = runFrames(glow.inner, GLOW_RUN_FRAMES, 2, 0.1);
  addSheet(scene, CARD_GLOW, [['g:0', glow.ring]]);
  addSheet(
    scene,
    CARD_GLOW_RUN,
    run.map((p, i) => [`run:${i}`, p] as [string, PixelCanvas]),
  );
  addAnim(scene, ANIM_GLOW_RUN, CARD_GLOW_RUN, run.map((_, i) => `run:${i}`), 18, -1);
  const inner = sil.clone().map((c, x, y) => (x < 1 || y < 1 || x > FACE_W - 2 || y > FACE_H - 2 ? null : c));
  const sheen = sweepFrames(inner, SHEEN_FRAMES, false, 7);
  addSheet(scene, CARD_SHEEN, sheen.map((p, i) => [`s:${i}`, p] as [string, PixelCanvas]));
  addAnim(scene, ANIM_SHEEN, CARD_SHEEN, sheen.map((_, i) => `s:${i}`), 30, 0);
  const foil = sweepFrames(inner, SHEEN_FRAMES, true, 10);
  addSheet(scene, CARD_FOIL, foil.map((p, i) => [`s:${i}`, p] as [string, PixelCanvas]));
  addAnim(scene, ANIM_FOIL, CARD_FOIL, foil.map((_, i) => `s:${i}`), 24, 0);

  // iso
  for (const o of ['up', 'side'] as CardOrientation[]) {
    for (const player of [0, 1] as PlayerId[]) {
      for (const id of [...ALL_CARD_IDS, 'back' as const]) addTex(scene, cardIsoKey(id, o, player), isoCanvas(id, o, player));
    }
    const isil = renderFlat('back', o, 0, { solid: 0xffffff, outline: false });
    addTex(scene, cardIsoSilKey(o), isil);
    // glow ring around silhouette incl. outline
    const isilOut = renderFlat('back', o, 0, { solid: 0xffffff });
    const iglow = glowRing(isilOut, ISO_GLOW_PAD);
    const irun = runFrames(iglow.inner, GLOW_RUN_FRAMES, 2, 0.12);
    addSheet(scene, cardIsoGlowKey(o), [['g:0', iglow.ring], ...irun.map((p, i) => [`run:${i}`, p] as [string, PixelCanvas])]);
    addAnim(scene, animIsoGlowRun(o), cardIsoGlowKey(o), irun.map((_, i) => `run:${i}`), 18, -1);
    const isw = sweepFrames(isil, 12, false, 5);
    addSheet(scene, cardIsoSheenKey(o), isw.map((p, i) => [`s:${i}`, p] as [string, PixelCanvas]));
    addAnim(scene, animIsoSheen(o), cardIsoSheenKey(o), isw.map((_, i) => `s:${i}`), 26, 0);
  }
}
