// Screen layout + isometric projection. Shared contract for every view, VFX and cinematic.
//
// Internal resolution is 640×360, scaled up by whole numbers (pixelArt mode).
//
// Two arena variants share this contract (ARENA_VARIANT, decided once at module init):
//
// ── v1 (default, the current game) ── a 5×5 isometric grid of 2:1 diamond tiles (64×32):
//
//   grid (col, row) → screen: x = BOARD_OX + (col - row) * 32
//                             y = BOARD_OY + (col + row) * 16      (tile center)
//
//   row 0: P2 spell/trap     row 1: P2 monsters     row 2: no-man's land
//   row 3: P1 monsters       row 4: P1 spell/trap
//   col 0 / col 4: field zone, graveyard and deck
//
// ── v2 (the "floodlit night match" demo, docs/ARENA_V2.md) ── a 7×6 grid of 80×40 tiles:
//
//   grid (col, row) → screen: x = 300 + (col - row) * 40
//                             y =  66 + (col + row) * 20          (tile center)
//
//   row 0: P2 spell/trap     row 1: P2 monsters
//   row 2, row 3: the energy bridge (two tiles deep — front rows are 3 rows apart)
//   row 4: P1 monsters       row 5: P1 spell/trap
//   cols 1 / 3 / 5: the three lanes (zone index 0 / 1 / 2 for P1);
//   cols 2 / 4: empty gap tiles between neighbouring zones (monsters never stand "dip dibe")
//   col 0 / col 6: outer pads — P1 field (0,4), banish (0,5), graveyard (6,4), deck (6,5)
//
// In both variants player 2's board is player 1's rotated 180° around the board center.
// Player 1 (id 0, cyan) sits at the lower-left, player 2 (id 1, crimson) at the upper-right.
// The duel axis runs lower-left → upper-right, so P1 sprites face RIGHT and P2 sprites are flipX.
//
// Every board/HUD constant below (TILE_W, BOARD_*, UI ...) is variant-valued: an `export const`
// computed once at init. v1 values are exactly the original ones.

import type { PlayerId, ZoneKind } from '../engine/types';

// ---------------------------------------------------------------- arena variant

export type ArenaVariant = 'v1' | 'v2';

/**
 * Which arena is active. Decided once at module init from `globalThis.__NEON_ARENA`
 * (demo.html sets it to 'v2' before booting), else the URL param `?arena=v2`, else 'v1'.
 */
export const ARENA_VARIANT: ArenaVariant = detectArenaVariant();
/** Shorthand for `ARENA_VARIANT === 'v2'`. */
export const ARENA_V2: boolean = ARENA_VARIANT === 'v2';

function detectArenaVariant(): ArenaVariant {
  try {
    const g = (globalThis as { __NEON_ARENA?: unknown }).__NEON_ARENA;
    if (g === 'v1' || g === 'v2') return g;
    if (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined') {
      const p = new URLSearchParams(location.search).get('arena');
      if (p === 'v1' || p === 'v2') return p;
    }
  } catch {
    /* no globals (tests, workers): fall through */
  }
  return 'v1';
}

/** Pick the v1 or the v2 value (for module-level constants elsewhere). */
export function byArena<T>(v1: T, v2: T): T {
  return ARENA_V2 ? v2 : v1;
}

// ---------------------------------------------------------------- grid + projection

export const GAME_W = 640;
export const GAME_H = 360;

export const TILE_W: number = byArena(64, 80);
export const TILE_H: number = byArena(32, 40);
export const BOARD_COLS: number = byArena(5, 7);
export const BOARD_ROWS: number = byArena(5, 6);
/** Screen position of the center of grid cell (0, 0). */
export const BOARD_OX: number = byArena(320, 300);
export const BOARD_OY: number = byArena(96, 66);

/** Grid rows of the no-man's land / energy bridge between the two front rows (v1 [2], v2 [2, 3]). */
export const BRIDGE_ROWS: readonly number[] = byArena([2], [2, 3]);
/** Grid columns of the three lanes (monster / spell-trap index 0..2 of player 1; v1 [1,2,3], v2 [1,3,5]). */
export const LANE_COLS: readonly number[] = byArena([1, 2, 3], [1, 3, 5]);
/** Fractional grid coords of the board center (v1 (2, 2), v2 (3, 2.5)). */
export const BOARD_MID_COL: number = (BOARD_COLS - 1) / 2;
export const BOARD_MID_ROW: number = (BOARD_ROWS - 1) / 2;

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

/** Screen center of the board (the middle of the no-man's land / energy bridge). v1 (320,160), v2 (320,176). */
export const BOARD_CENTER: XY = isoToScreen(BOARD_MID_COL, BOARD_MID_ROW);

/**
 * Screen bounding box of the whole tile grid (the four outer diamond corners; no slab / hull).
 * v1 {x:160, y:80, w:320, h:160}, v2 {x:60, y:46, w:520, h:260}.
 */
export const BOARD_BOUNDS: Rect = (() => {
  const top = isoToScreen(-0.5, -0.5);
  const right = isoToScreen(BOARD_COLS - 0.5, -0.5);
  const bottom = isoToScreen(BOARD_COLS - 0.5, BOARD_ROWS - 0.5);
  const left = isoToScreen(-0.5, BOARD_ROWS - 0.5);
  return { x: left.x, y: top.y, w: right.x - left.x, h: bottom.y - top.y };
})();

export type BoardSpot = ZoneKind | 'graveyard' | 'deck' | 'banish';

/** Grid cell of a zone. Player 2's board is player 1's rotated 180° around the center. */
export function zoneCell(player: PlayerId, spot: BoardSpot, index = 0): { col: number; row: number } {
  const c = ARENA_V2 ? zoneCellV2(spot, index) : zoneCellV1(spot, index);
  return player === 0 ? c : { col: BOARD_COLS - 1 - c.col, row: BOARD_ROWS - 1 - c.row };
}

/** Player 1's cell of a zone in the v1 5×5 grid. */
function zoneCellV1(spot: BoardSpot, index: number): { col: number; row: number } {
  switch (spot) {
    case 'monster':
      return { col: 1 + index, row: 3 };
    case 'spellTrap':
      return { col: 1 + index, row: 4 };
    case 'field':
      return { col: 0, row: 3 };
    case 'graveyard':
      return { col: 4, row: 3 };
    case 'deck':
      return { col: 4, row: 4 };
    case 'banish':
      return { col: 0, row: 4 };
  }
}

/** Player 1's cell of a zone in the v2 7×6 grid (lanes on cols 1/3/5, gap tiles on 2/4). */
function zoneCellV2(spot: BoardSpot, index: number): { col: number; row: number } {
  switch (spot) {
    case 'monster':
      return { col: 1 + 2 * index, row: 4 };
    case 'spellTrap':
      return { col: 1 + 2 * index, row: 5 };
    case 'field':
      return { col: 0, row: 4 };
    case 'graveyard':
      return { col: 6, row: 4 };
    case 'deck':
      return { col: 6, row: 5 };
    case 'banish':
      return { col: 0, row: 5 };
  }
}

/** A zone of the board: who owns it, which spot, which index (0 for the single pads). */
export interface ZoneRef {
  player: PlayerId;
  spot: BoardSpot;
  index: number;
}

const ZONE_BY_CELL: Map<string, ZoneRef> = (() => {
  const m = new Map<string, ZoneRef>();
  const spots: [BoardSpot, number][] = [
    ['monster', 3],
    ['spellTrap', 3],
    ['field', 1],
    ['graveyard', 1],
    ['deck', 1],
    ['banish', 1],
  ];
  for (const player of [0, 1] as PlayerId[])
    for (const [spot, n] of spots)
      for (let index = 0; index < n; index++) {
        const c = zoneCell(player, spot, index);
        m.set(`${c.col},${c.row}`, { player, spot, index });
      }
  return m;
})();

/**
 * Inverse of zoneCell: which zone grid cell (col, row) is (integer coords), or null for the
 * bridge / no-man's-land rows, the v2 gap tiles and anything outside the grid.
 * (Same answers as art/arena.ts `cellZone` in v1.)
 */
export function zoneAtCell(col: number, row: number): ZoneRef | null {
  const z = ZONE_BY_CELL.get(`${col},${row}`);
  return z ? { ...z } : null;
}

/** What lies on a grid cell: a zone pad, a v2 gap tile between lanes, the bridge — or null outside the grid. */
export type CellKind = 'zone' | 'gap' | 'bridge';

export function cellKind(col: number, row: number): CellKind | null {
  if (!Number.isInteger(col) || !Number.isInteger(row)) return null;
  if (col < 0 || row < 0 || col >= BOARD_COLS || row >= BOARD_ROWS) return null;
  if (BRIDGE_ROWS.includes(row)) return 'bridge';
  return ZONE_BY_CELL.has(`${col},${row}`) ? 'zone' : 'gap';
}

/** Grid row of a player's monster row (v1 P1 3 / P2 1, v2 P1 4 / P2 1). */
export function monsterRow(player: PlayerId): number {
  return zoneCell(player, 'monster', 0).row;
}

/** Grid row of a player's spell/trap (back) row (v1 P1 4 / P2 0, v2 P1 5 / P2 0). */
export function backRow(player: PlayerId): number {
  return zoneCell(player, 'spellTrap', 0).row;
}

/** Which player's half a (fractional) grid row lies on; null on the bridge / no-man's land. */
export function sideOfRow(row: number): PlayerId | null {
  const lo = Math.min(...BRIDGE_ROWS) - 0.5;
  const hi = Math.max(...BRIDGE_ROWS) + 0.5;
  if (row >= hi) return 0;
  if (row < lo) return 1;
  return null;
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

/**
 * Where a player's duelist avatar stands (behind their back row, on the board's center column).
 * v1 P1 isoToScreen(2, 5.35) ≈ (212.8, 213.6), P2 isoToScreen(2, -1.35) ≈ (427.2, 106.4).
 * v2 P1 isoToScreen(3, 6.25) = (170, 251), P2 isoToScreen(3, -1.25) = (470, 101) — whole pixels.
 */
export function duelistXY(player: PlayerId): XY {
  if (ARENA_V2) return player === 0 ? isoToScreen(3, 6.25) : isoToScreen(3, -1.25);
  return player === 0 ? isoToScreen(2, 5.35) : isoToScreen(2, -1.35);
}

// ---------------------------------------------------------------- deck corners (additive)
//
// In v2 the deck pads sit on the board's extreme corners: P1's on the bottom corner (340, 286),
// right above the resting hand, P2's on the back corner (300, 66), right under the phase bar.
// With the count tag centered under the stack and a referee pylon on the very corner, the deck
// box, the tag, the pylon and the hand's top edge all stacked on one x (critic: "bottom corner
// clutter"). The two contracts below spread the corner out, mirrored for P2:
//
//      P1 bottom corner (v2):   [pylon]  [deck box]  [16]        P2 back corner:  [16]  [deck box]  [pylon]
//
//  - pileTagAnchor: the pile count tag goes BESIDE its stack, on the tile's outer side tip.
//  - deckPylonXY:   the pylon on each deck corner slides along the trim, away from the deck.
// v1 values reproduce exactly what is drawn today (tag centered under the stack; v1 has no pylons).

/** Height of a pile count tag (px). */
export const PILE_TAG_H = 9;

/** How a tag's anchor x is read: its center, its left edge (grows right) or its right edge (grows left). */
export type TagAlign = 'center' | 'left' | 'right';

export interface TagAnchor {
  /** 'center': the tag's center x; 'left': its first (leftmost) pixel column; 'right': one past its last column. */
  x: number;
  /** The tag's top pixel row (the tag is PILE_TAG_H tall). */
  y: number;
  align: TagAlign;
}

/** v2: horizontal distance (px) from a pile tile's center to the near edge of its side tag (the stack reaches ±21). */
const PILE_TAG_SIDE_DX = 23;

/**
 * Where a deck / graveyard pile's count tag goes (integer screen px).
 *  - v1: centered under the stack on the tile's front corner: { x: home.x, y: round(home.y + 8), 'center' }
 *    — exactly what PileView draws today.
 *  - v2: beside the stack on the tile's outer side tip, vertically centered on the tile center:
 *    P1 right of the stack ('left', grows right), P2 left of it ('right', grows left) — pixel mirror.
 *    P1 deck {363, 282}, P1 graveyard {403, 262}, P2 deck {277, 62}, P2 graveyard {237, 82}.
 *    A 2-digit tag (w 13) then covers x 363..375 / 403..415 / 264..276 / 224..236, y a.y..a.y+8.
 * Use with tagLeft(); the count label's x is tagLeft(a, w) + floor(w / 2), its y a.y + 5 (as today).
 */
export function pileTagAnchor(player: PlayerId, kind: 'deck' | 'graveyard'): TagAnchor {
  const home = zoneXY(player, kind);
  if (!ARENA_V2) return { x: home.x, y: Math.round(home.y + 8), align: 'center' };
  const y = Math.round(home.y) - Math.floor(PILE_TAG_H / 2);
  const x = Math.round(home.x);
  return player === 0 ? { x: x + PILE_TAG_SIDE_DX, y, align: 'left' } : { x: x - PILE_TAG_SIDE_DX, y, align: 'right' };
}

/** Left pixel column of a tag `w` px wide placed at anchor `a` (center: round(a.x − w/2), as PileView does today). */
export function tagLeft(a: TagAnchor, w: number): number {
  if (a.align === 'center') return Math.round(a.x - w / 2);
  return a.align === 'left' ? a.x : a.x - w;
}

/**
 * v2: how far (grid units, ≈ 44.7 px each along the trim) the referee pylon on each deck corner
 * slides away from the deck. 0 in v1 (which has no pylons) — the result is just the corner point.
 */
export const DECK_PYLON_SLIDE: number = byArena(0, 0.7);

/**
 * Grid point (fractional) of the referee pylon on a player's deck corner. `outset` = how far the
 * pylon base sits outside the tile grid edge, in grid units (art/arena-v2/geom.ts: BORDER − 0.14
 * = 0.16). On the very corner the pylon stood behind the deck stack and its tag, right above the
 * resting hand (P1) / under the phase bar (P2); it slides DECK_PYLON_SLIDE along the trim instead:
 * P1 (bottom corner) toward −col (screen up-left), P2 (back corner) toward +col (screen
 * down-right) — the board's 180° rotation. The other two corner pylons (left, right) stay put.
 */
export function deckPylonCell(player: PlayerId, outset: number): { col: number; row: number } {
  const c = { col: BOARD_COLS - 0.5 + outset - DECK_PYLON_SLIDE, row: BOARD_ROWS - 0.5 + outset };
  return player === 0 ? c : { col: BOARD_COLS - 1 - c.col, row: BOARD_ROWS - 1 - c.row };
}

/**
 * Screen point (whole px) of the deck-corner pylon's base on the trim — the same point
 * geom.ts PYLONS holds (P() of the grid point, rounded). v2 with outset 0.16: P1 (312, 298),
 * P2 (328, 54); the 11×24 pylon then spans x 307..317 / 323..333, clear of the deck stacks
 * (x 319..361 / 279..321), and P2's pylon top drops from y 18 to y 32 (the phase bar ends at y 17).
 */
export function deckPylonXY(player: PlayerId, outset: number): XY {
  const c = deckPylonCell(player, outset);
  const s = isoToScreen(c.col, c.row);
  return { x: Math.round(s.x), y: Math.round(s.y) };
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

export interface UiLayout {
  /** Phase track (Çekme · Ana · Savaş · Bitiş). */
  readonly phaseBar: Rect;
  /** Player 1 status panel (LP, deck/hand counts, name) — lower left. */
  readonly p1Panel: Rect;
  /** Player 2 status panel — upper right. */
  readonly p2Panel: Rect;
  /** Active player's hand — bottom center. Cards peek up from the bottom edge. */
  readonly hand: Rect;
  /**
   * Screen y of a resting (not hovered) hand card's top edge at the fan's center (additive).
   * v1 292 (HandView BASE_Y 326 − CARD_H/2), v2 318 (≈ 42 px of the card peeks up; the P1 deck
   * pad's bottom corner is at y 306).
   */
  readonly handRestTop: number;
  /** Card inspect panel (big card + text) — upper left. */
  readonly inspect: Rect;
  /** Main action buttons (Savaş / Turu Bitir) — lower right. */
  readonly buttons: Rect;
  /** Banner line (turn start, phase change, "TUZAK!") — screen center. */
  readonly bannerY: number;
}

const UI_V1: UiLayout = {
  phaseBar: { x: 208, y: 4, w: 224, h: 16 },
  p1Panel: { x: 4, y: 292, w: 148, h: 64 },
  p2Panel: { x: 488, y: 4, w: 148, h: 64 },
  hand: { x: 160, y: 284, w: 320, h: 76 },
  handRestTop: 292,
  inspect: { x: 4, y: 24, w: 128, h: 236 },
  buttons: { x: 500, y: 300, w: 136, h: 56 },
  bannerY: 150,
};

/**
 * v2 compact HUD. The four screen corners outside the board diamond hold the panels; nothing
 * covers a zone in normal play:
 *  - phaseBar sits above the board's top corner (P2 deck pad top at y 46; an ace on P2's
 *    top lane reaches up to y ≈ 17).
 *  - inspect fills the free upper-left triangle (the board edge passes (124,134); P1 field pad).
 *  - hand: resting cards should show at most ~40 px (tops at y ≥ 318); the P1 deck pad's
 *    bottom corner is at (340, 306). With the deck-corner contract (pileTagAnchor, deckPylonXY)
 *    the deck tag ends at y 290 and the deck pylon's foot at y 299, so the resting tops clear both.
 *  - p1Panel / buttons sit under the board's lower edges; p2Panel right of the P2 duelist.
 */
const UI_V2: UiLayout = {
  phaseBar: { x: 224, y: 3, w: 192, h: 14 },
  p1Panel: { x: 4, y: 316, w: 128, h: 40 },
  p2Panel: { x: 508, y: 4, w: 128, h: 40 },
  hand: { x: 176, y: 306, w: 288, h: 54 },
  handRestTop: 318,
  inspect: { x: 4, y: 22, w: 116, h: 110 },
  buttons: { x: 540, y: 316, w: 96, h: 40 },
  bannerY: 172,
};

export const UI: UiLayout = byArena(UI_V1, UI_V2);

export function panelRect(player: PlayerId): Rect {
  return player === 0 ? UI.p1Panel : UI.p2Panel;
}
