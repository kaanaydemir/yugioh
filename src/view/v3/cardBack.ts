// The ONE card-back source of the v3 look — contract S-2 (docs/v3/A6_PLAN.md §4.1 / §5.0.2 item 3,
// K4; A5_PLAN.md §3.7.4). Every back in the game comes from here when lane A6-A is on (V3_A6_A): the
// hand and mini-hands (CardSprite → cardBackKey / cardBackCanvas), the board (TileCard's static iso
// texture, its 3D pose renderer and dissolve → cardMip('back', player) / isoCanvas), the piles, the
// shuffle ghost, and the A2 / A5 openings' standUp / layDown. The wiring lives in src/art/cards.ts
// (its back-face lines, frozen in A56.0); this file only paints.
//
// The v3 back (lane A6-A, step A1) speaks the FRAME_V3 language (src/art/frame-v3.ts, S-1): a dark
// body of two flat night bands, a 1-px ink outline with cut corners, ONE 1-px trim in the OWNER's
// tone (P1 cyan, P2 crimson; light on the top / left edges, dark on the bottom / right), and an
// owner-toned hex emblem — no bevel, gradient, dither or glow, palette tones only, light from the
// top left (IŞ-1). The owner reads at a glance on the board, and a face-down card no longer looks
// like any other card's back (K4: not confused with the deck, the graveyard or an empty pad).
//
//   cardBackV3(p)        48×68 upright back (hand, flights, standing cards)       cached per player
//   cardBackMipV3(p)     the pose renderer's smaller levels: 24×34 and the 18×26 mini level the iso
//                        textures come from (no outline of its own: the renderer draws it), + edge
//   miniHandBackV3(p)    9×13 back of the mini-hands next to the LP panels (HandView, v3 only)
//   paintBackV3(p, …)    any of these into a canvas (the dev page and tests)
//
// The silhouettes stay exactly today's (48×68 with the four corner pixels empty, a full 18×26 mini
// level), so the overlay textures derived from them (card:sil / glow / sheen, the iso silhouettes)
// keep their pixels: only the back's own textures change (card-hash: the back groups).
//
// Note for the painter: src/art/cards.ts IMPORTS this module. Do not read cards.ts bindings at this
// module's top level (an import cycle would see them uninitialised); read them inside functions.

import type Phaser from 'phaser';
import { frameRectV3 } from '../../art/frame-v3';
import { PAL, PLAYER_RAMP, type Ramp } from '../../art/palette';
import { PixelCanvas, type Pt } from '../../art/pixel';
import type { PlayerId } from '../../engine/types';

let todayBack: (() => PixelCanvas) | null = null;

/** src/art/cards.ts hands over today's back painter at its module init (no import cycle). */
export function provideTodayBack(paint: () => PixelCanvas): void {
  todayBack = paint;
}

/** Today's back (the v1 pixels), for comparisons and the dev page. */
export function todayBackCanvas(): PixelCanvas {
  if (!todayBack) throw new Error('cardBack: src/art/cards.ts has not provided the back painter yet');
  return todayBack();
}

// ================================================================ sizes

export const BACK_W = 48;
export const BACK_H = 68;
/** The pose renderer's half level. */
export const BACK_HALF_W = 24;
export const BACK_HALF_H = 34;
/** The mini level the iso textures are rendered from (cards.ts MINI_W × MINI_H). */
export const BACK_MINI_W = 18;
export const BACK_MINI_H = 26;
/** The mini-hand card (ui-textures MINI_CARD_W × MINI_CARD_H). */
export const BACK_HAND_W = 9;
export const BACK_HAND_H = 13;

/** The size levels paintBackV3 draws by hand. */
export type BackLevel = 'full' | 'half' | 'mini' | 'hand';

// ================================================================ tones

/** The owner's tones of a back: trim, emblem and the card-stock edge. */
export interface BackTones {
  ramp: Ramp;
  /** Trim: top / left edges. */
  lit: number;
  /** Trim: bottom / right edges. */
  shade: number;
}

export function backTones(player: PlayerId): BackTones {
  const ramp = PLAYER_RAMP[player];
  return { ramp, lit: ramp[3], shade: ramp[2] };
}

/** The card-stock edge tone of the back (the 1-px thickness the pose renderer draws under it). */
export function backEdgeTone(player: PlayerId): number {
  return PLAYER_RAMP[player][1];
}

// ================================================================ shapes

/**
 * A pointy-top hexagon with vertical sides on columns x0 and x1 (x1 − x0 + 1 even), side rows
 * y0..y1 and 2:1 slopes (2 columns per row) up to a flat top / bottom of 2–4 px: its rim pixels,
 * split by the light rule (top + left = lit, right + bottom = shade), and its rows' inner spans.
 */
function hexShape(x0: number, x1: number, y0: number, y1: number): { lit: Pt[]; shade: Pt[]; spans: [number, number, number][] } {
  const n = x1 - x0 + 1;
  const half = Math.floor(n / 2);
  const lit: Pt[] = [];
  const shade: Pt[] = [];
  // rows → [left, right] boundary of the ring on that row
  const rows = new Map<number, [number, number]>();
  const widen = (y: number, l: number, r: number) => {
    const cur = rows.get(y);
    rows.set(y, cur ? [Math.min(cur[0], l), Math.max(cur[1], r)] : [l, r]);
  };
  for (let i = 0; i < half; i++) {
    const d = Math.floor(i / 2);
    const top = y0 - 1 - d;
    const bot = y1 + 1 + d;
    lit.push([x0 + i, top], [x1 - i, top]);
    shade.push([x0 + i, bot], [x1 - i, bot]);
    widen(top, x0 + i, x1 - i);
    widen(bot, x0 + i, x1 - i);
  }
  for (let y = y0; y <= y1; y++) {
    lit.push([x0, y]);
    shade.push([x1, y]);
    widen(y, x0, x1);
  }
  const spans: [number, number, number][] = [];
  for (const [y, [l, r]] of rows) spans.push([y, l, r]);
  spans.sort((a, b) => a[0] - b[0]);
  return { lit, shade, spans };
}

function paintHex(p: PixelCanvas, ox: number, oy: number, x0: number, x1: number, y0: number, y1: number, lit: number, shade: number, fill: number | null): void {
  const h = hexShape(x0, x1, y0, y1);
  if (fill !== null) for (const [y, l, r] of h.spans) p.hline(ox + l, ox + r, oy + y, fill);
  for (const [x, y] of h.shade) p.set(ox + x, oy + y, shade);
  for (const [x, y] of h.lit) p.set(ox + x, oy + y, lit);
}

/** The "N" of Neon Düello, 8×8 and the same when turned 180° (P2's cards lie rotated on the board). */
const N8 = ['##....##', '###...##', '####..##', '##.##.##', '##.##.##', '##..####', '##...###', '##....##'];

// ================================================================ levels

/** 48×68: the full back. */
function paintFull(p: PixelCanvas, ox: number, oy: number, t: BackTones): void {
  const R = t.ramp;
  const W = BACK_W;
  const H = BACK_H;
  frameRectV3(p, ox, oy, W, H, { light: t.lit, dark: t.shade }, { split: H / 2 });
  // engraved inner panel: a 1-px line three pixels in (lit top / left, shaded bottom / right)
  const ix = 3;
  const iy = 3;
  const iw = W - 6;
  const ih = H - 6;
  p.hline(ox + ix + 1, ox + ix + iw - 2, oy + iy, PAL.night3);
  p.vline(ox + ix, oy + iy + 1, oy + iy + ih - 2, PAL.night3);
  p.hline(ox + ix + 1, ox + ix + iw - 2, oy + iy + ih - 1, PAL.night2);
  p.vline(ox + ix + iw - 1, oy + iy + 1, oy + iy + ih - 2, PAL.night2);
  // owner-toned corner brackets inside the panel (the top-left one catches the light)
  const legs = 4;
  const corners: [number, number, number, number, number, number][] = [
    [ix + 2, iy + 2, 1, 1, R[3], R[2]],
    [ix + iw - 3, iy + 2, -1, 1, R[2], R[2]],
    [ix + 2, iy + ih - 3, 1, -1, R[2], R[1]],
    [ix + iw - 3, iy + ih - 3, -1, -1, R[2], R[1]],
  ];
  for (const [cx, cy, dx, dy, joint, leg] of corners) {
    for (let k = 1; k <= legs; k++) {
      p.set(ox + cx + dx * k, oy + cy, leg);
      p.set(ox + cx, oy + cy + dy * k, leg);
    }
    p.set(ox + cx, oy + cy, joint);
  }
  // stems from the panel's top and bottom to the emblem, ending in owner-toned nodes
  const cx0 = W / 2 - 1; // the two centre columns: cx0, cx0 + 1
  for (let y = 9; y <= 16; y++) p.rect(ox + cx0, oy + y, 2, 1, PAL.night3);
  for (let y = H - 17; y <= H - 10; y++) p.rect(ox + cx0, oy + y, 2, 1, PAL.night2);
  p.rect(ox + cx0 - 1, oy + 7, 4, 2, R[2]);
  p.rect(ox + cx0, oy + 7, 2, 1, R[4]);
  p.rect(ox + cx0 - 1, oy + H - 9, 4, 2, R[1]);
  p.rect(ox + cx0, oy + H - 9, 2, 1, R[3]);
  // the emblem: an owner-dark hex plate with a lit rim, an engraved inner ring and the N
  paintHex(p, ox, oy, 10, 37, 25, 42, R[3], R[2], R[0]);
  paintHex(p, ox, oy, 13, 34, 27, 40, R[2], R[1], null);
  // the lit vertex of the plate catches one bright pixel
  p.set(ox + 10, oy + 25, R[4]);
  const nx = W / 2 - 4;
  const ny = H / 2 - 4;
  p.stamp(N8, { '#': PAL.ink }, ox + nx + 1, oy + ny + 1);
  p.stamp(N8.slice(0, 4), { '#': R[4] }, ox + nx, oy + ny);
  p.stamp(N8.slice(4), { '#': R[3] }, ox + nx, oy + ny + 4);
  p.set(ox + nx, oy + ny, PAL.white);
}

/** 24×34: the pose renderer's half level (cards turning / flying at about half size). */
function paintHalf(p: PixelCanvas, ox: number, oy: number, t: BackTones): void {
  const R = t.ramp;
  const W = BACK_HALF_W;
  const H = BACK_HALF_H;
  frameRectV3(p, ox, oy, W, H, { light: t.lit, dark: t.shade }, { split: H / 2 });
  // emblem: hex plate + core
  paintHex(p, ox, oy, 6, 17, 14, 19, R[3], R[2], R[0]);
  p.rect(ox + 11, oy + 15, 2, 4, R[3]);
  p.rect(ox + 11, oy + 15, 2, 2, R[4]);
  p.set(ox + 11, oy + 15, PAL.white);
  // pips above and below
  p.rect(ox + 11, oy + 4, 2, 1, R[2]);
  p.rect(ox + 11, oy + H - 5, 2, 1, R[1]);
}

/**
 * 18×26: the mini level the board's iso cards are sampled from (1:1). No outline: the renderer
 * draws the ink outline around it, so the trim sits on the border pixels, just inside that outline.
 */
function paintMini(p: PixelCanvas, ox: number, oy: number, t: BackTones): void {
  const R = t.ramp;
  const W = BACK_MINI_W;
  const H = BACK_MINI_H;
  // one night step lighter than the upright back: the card lies on the night floor of the board
  // and has to read as an object on it (and never as an empty pad)
  for (let y = 0; y < H; y++) p.hline(ox, ox + W - 1, oy + y, y < H / 2 ? PAL.night2 : PAL.night1);
  p.hline(ox, ox + W - 1, oy, t.lit);
  p.vline(ox, oy + 1, oy + H - 2, t.lit);
  p.vline(ox + W - 1, oy + 1, oy + H - 2, t.shade);
  p.hline(ox, ox + W - 1, oy + H - 1, t.shade);
  // the hex emblem, owner-toned, with a bright core
  paintHex(p, ox, oy, 3, 14, 10, 15, R[3], R[2], R[0]);
  p.rect(ox + 8, oy + 10, 2, 6, R[3]);
  p.rect(ox + 8, oy + 10, 2, 3, R[4]);
  p.set(ox + 8, oy + 10, PAL.white);
}

/** 9×13: the mini-hand card next to the LP panel. */
function paintHand(p: PixelCanvas, ox: number, oy: number, t: BackTones): void {
  const R = t.ramp;
  frameRectV3(p, ox, oy, BACK_HAND_W, BACK_HAND_H, { light: t.lit, dark: t.shade }, { split: 6 });
  // a 3×5 gem, lit from the top left, bright core
  p.set(ox + 4, oy + 4, R[3]);
  p.vline(ox + 3, oy + 5, oy + 7, R[3]);
  p.vline(ox + 5, oy + 5, oy + 7, R[2]);
  p.set(ox + 4, oy + 8, R[2]);
  p.set(ox + 4, oy + 5, R[4]).set(ox + 4, oy + 6, R[4]).set(ox + 4, oy + 7, R[3]);
}

/** Paint `player`'s v3 back at one of the hand-drawn levels into `p` at (x, y). */
export function paintBackV3(p: PixelCanvas, x: number, y: number, player: PlayerId, level: BackLevel = 'full'): PixelCanvas {
  const t = backTones(player);
  const ox = Math.round(x);
  const oy = Math.round(y);
  if (level === 'full') paintFull(p, ox, oy, t);
  else if (level === 'half') paintHalf(p, ox, oy, t);
  else if (level === 'mini') paintMini(p, ox, oy, t);
  else paintHand(p, ox, oy, t);
  return p;
}

export function backLevelSize(level: BackLevel): { w: number; h: number } {
  if (level === 'full') return { w: BACK_W, h: BACK_H };
  if (level === 'half') return { w: BACK_HALF_W, h: BACK_HALF_H };
  if (level === 'mini') return { w: BACK_MINI_W, h: BACK_MINI_H };
  return { w: BACK_HAND_W, h: BACK_HAND_H };
}

/** A fresh canvas holding `player`'s back at `level`. */
export function drawBackV3(player: PlayerId, level: BackLevel = 'full'): PixelCanvas {
  const { w, h } = backLevelSize(level);
  return paintBackV3(new PixelCanvas(w, h), 0, 0, player, level);
}

// ================================================================ the S-2 sources (cached)

const fullCache = new Map<PlayerId, PixelCanvas>();
const mipCache = new Map<PlayerId, { levels: PixelCanvas[]; edge: number }>();
const handCache = new Map<PlayerId, PixelCanvas>();

/**
 * S-2 — the upright 48×68 back of `player`'s cards (the v3 back, cached per player; cards.ts calls
 * it only while lane A6-A is on).
 */
export function cardBackV3(player: PlayerId): PixelCanvas {
  let p = fullCache.get(player);
  if (!p) {
    p = drawBackV3(player, 'full');
    fullCache.set(player, p);
  }
  return p;
}

/**
 * S-2 — the pose renderer's smaller levels of `player`'s v3 back (largest first: the 24×34 half and
 * the 18×26 mini level the iso textures come from) and its card-stock edge tone; cards.ts puts the
 * 48×68 back in front of them.
 */
export function cardBackMipV3(player: PlayerId): { levels: PixelCanvas[]; edge: number } | null {
  let m = mipCache.get(player);
  if (!m) {
    m = { levels: [drawBackV3(player, 'half'), drawBackV3(player, 'mini')], edge: backEdgeTone(player) };
    mipCache.set(player, m);
  }
  return m;
}

/** The 9×13 mini-hand back of `player` (v3 only: HandView's mini-hands). */
export function miniHandBackV3(player: PlayerId): PixelCanvas {
  let p = handCache.get(player);
  if (!p) {
    p = drawBackV3(player, 'hand');
    handCache.set(player, p);
  }
  return p;
}

/**
 * Texture key of `player`'s 9×13 mini-hand back, added to the scene's texture manager on first use
 * (lane A6-A on only: the mini-hands of HandView; v1 keeps ui-textures' miniCardKey and no new
 * texture is ever made).
 */
export function miniHandBackKey(scene: Phaser.Scene, player: PlayerId): string {
  const key = `cv3:minihand:p${player + 1}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, miniHandBackV3(player).toCanvas());
  return key;
}
