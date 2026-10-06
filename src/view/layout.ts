// Screen layout + isometric projection. Shared contract for every view, VFX and cinematic.
//
// Internal resolution is 640×360, scaled up by whole numbers (pixelArt mode).
// The board is a 5×5 isometric grid of 2:1 diamond tiles (64×32):
//
//   grid (col, row) → screen: x = BOARD_OX + (col - row) * 32
//                             y = BOARD_OY + (col + row) * 16      (tile center)
//
//   row 0: P2 spell/trap     row 1: P2 monsters     row 2: no-man's land
//   row 3: P1 monsters       row 4: P1 spell/trap
//   col 0 / col 4: field zone, graveyard and deck
//
// Player 1 (id 0, cyan) sits at the lower-left, player 2 (id 1, crimson) at the upper-right.
// The duel axis runs lower-left → upper-right, so P1 sprites face RIGHT and P2 sprites are flipX.

import type { PlayerId, ZoneKind } from '../engine/types';

export const GAME_W = 640;
export const GAME_H = 360;

export const TILE_W = 64;
export const TILE_H = 32;
export const BOARD_COLS = 5;
export const BOARD_ROWS = 5;
export const BOARD_OX = 320;
export const BOARD_OY = 96;

export interface XY {
  x: number;
  y: number;
}

/** Center of grid tile (col, row) in screen pixels. Accepts fractional coords for in-between points. */
export function isoToScreen(col: number, row: number): XY {
  return { x: BOARD_OX + (col - row) * (TILE_W / 2), y: BOARD_OY + (col + row) * (TILE_H / 2) };
}

/** Inverse projection: screen → fractional grid coords. */
export function screenToIso(x: number, y: number): { col: number; row: number } {
  const a = (x - BOARD_OX) / (TILE_W / 2);
  const b = (y - BOARD_OY) / (TILE_H / 2);
  return { col: (a + b) / 2, row: (b - a) / 2 };
}

export type BoardSpot = ZoneKind | 'graveyard' | 'deck' | 'banish';

/** Grid cell of a zone. Player 2's board is player 1's rotated 180° around the center. */
export function zoneCell(player: PlayerId, spot: BoardSpot, index = 0): { col: number; row: number } {
  let c: { col: number; row: number };
  switch (spot) {
    case 'monster':
      c = { col: 1 + index, row: 3 };
      break;
    case 'spellTrap':
      c = { col: 1 + index, row: 4 };
      break;
    case 'field':
      c = { col: 0, row: 3 };
      break;
    case 'graveyard':
      c = { col: 4, row: 3 };
      break;
    case 'deck':
      c = { col: 4, row: 4 };
      break;
    case 'banish':
      c = { col: 0, row: 4 };
      break;
  }
  return player === 0 ? c : { col: BOARD_COLS - 1 - c.col, row: BOARD_ROWS - 1 - c.row };
}

/** Screen center of a zone tile. */
export function zoneXY(player: PlayerId, spot: BoardSpot, index = 0): XY {
  const c = zoneCell(player, spot, index);
  return isoToScreen(c.col, c.row);
}

/** Unit vector (screen space) pointing from `player`'s side toward the opponent. */
export function forward(player: PlayerId): XY {
  const l = Math.hypot(TILE_W, TILE_H);
  return player === 0 ? { x: TILE_W / l, y: -TILE_H / l } : { x: -TILE_W / l, y: TILE_H / l };
}

/** Sprite facing: P1 faces right (flipX false), P2 faces left (flipX true). */
export function facesLeft(player: PlayerId): boolean {
  return player === 1;
}

/** Where a player's duelist avatar stands (behind their back row). */
export function duelistXY(player: PlayerId): XY {
  return player === 0 ? isoToScreen(2, 5.35) : isoToScreen(2, -1.35);
}

// ---------------------------------------------------------------- depth bands

export const DEPTH = {
  SKY: 0,
  STADIUM: 10,
  PLATFORM: 20,
  TILE: 30,
  TILE_FX: 40, // glow on tiles, magic circles lying on the floor
  CARD_ON_TILE: 50,
  SHADOW: 60,
  /** Units are sorted inside this band by screen y: depth = UNIT + y. */
  UNIT: 100,
  /** Effects in front of units. */
  FX: 1000,
  FX_TOP: 1100,
  HUD: 2000,
  HAND: 2100,
  INSPECT: 2200,
  MENU: 2300,
  BANNER: 2500,
  CUTIN: 3000,
  OVERLAY: 4000,
  TRANSITION: 5000,
  DEBUG: 9000,
} as const;

export function unitDepth(y: number): number {
  return DEPTH.UNIT + y;
}

// ---------------------------------------------------------------- HUD regions

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Card sizes. Hand cards are drawn at 1×; the inspect panel shows a 2× card. */
export const CARD_W = 48;
export const CARD_H = 68;

export const UI = {
  /** Phase track (Çekme · Ana · Savaş · Bitiş). */
  phaseBar: { x: 208, y: 4, w: 224, h: 16 } as Rect,
  /** Player 1 status panel (LP, deck/hand counts, name) — lower left. */
  p1Panel: { x: 4, y: 292, w: 148, h: 64 } as Rect,
  /** Player 2 status panel — upper right. */
  p2Panel: { x: 488, y: 4, w: 148, h: 64 } as Rect,
  /** Active player's hand — bottom center. Cards peek up from the bottom edge. */
  hand: { x: 160, y: 284, w: 320, h: 76 } as Rect,
  /** Card inspect panel (big card + text) — upper left. */
  inspect: { x: 4, y: 24, w: 128, h: 236 } as Rect,
  /** Main action buttons (Savaş / Turu Bitir) — lower right. */
  buttons: { x: 500, y: 300, w: 136, h: 56 } as Rect,
  /** Banner line (turn start, phase change, "TUZAK!") — screen center. */
  bannerY: 150,
} as const;

export function panelRect(player: PlayerId): Rect {
  return player === 0 ? UI.p1Panel : UI.p2Panel;
}
