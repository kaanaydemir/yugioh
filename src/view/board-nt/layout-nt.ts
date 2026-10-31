// Neon Tower — the screen layout map (docs/v3/ARENA_NEON_TOWER.md §3). ONE source of truth for every
// pixel rectangle the arena layers draw into; the doc cites this file, ?ntdebug=1 outlines it over
// the game, tests/view/board-nt-layout.test.ts guards it against the HUD.
//
// The camera never changes (640×360, zoom 1, integer 2:1 projection). The platform is drawn AROUND
// the existing tiles: layout.ts (zoneXY / isoToScreen / DEPTH) is read, never changed. The platform
// is ALWAYS drawn for the 5+5 board — a 7-column × 5-row grid of 64×32 tiles at origin (288, 80) —
// whatever LANES is: with ?zones=3 the v1 board (origin (320, 96), 5 columns) is exactly columns
// 2..4 of that grid (same screen pixels), so 3+3 uses the middle of the same platform, the outer
// two lanes' cells simply stay empty graphite. `ntIso` is the 7×5 grid projection used for the
// platform geometry only; slot art is positioned with layout.ts zoneXY like everything else.
//
// All numbers are screen pixels (x right, y down), integer. Rect = {x, y, w, h}.

import { DEPTH, UI, type Rect, type XY } from '../layout';

// ---------------------------------------------------------------- the fixed 7×5 reference grid

export const NT_COLS = 7;
export const NT_ROWS = 5;
export const NT_OX = 288;
export const NT_OY = 80;

/** Centre of cell (col, row) of the fixed 7×5 reference grid (the 5+5 board's projection). */
export function ntIso(col: number, row: number): XY {
  return { x: NT_OX + (col - row) * 32, y: NT_OY + (col + row) * 16 };
}

// ---------------------------------------------------------------- platform

/**
 * The plate is ONE chamfered slab (an octagon: two long diagonal edges, a flat far edge, a flat near edge and two vertical end
 * caps), the duelist pads stand ON it. It is the rectangle cols PLATE_C0..PLATE_C1 × rows PLATE_R0..PLATE_R1 of the 7×5 grid
 * (the margin beyond the tiles is 0.375 tile on the column sides; 1.4 tiles on the row sides, so the pads fit inside the edge
 * band), its four corners cut by the screen lines x = PLATE_X0 / PLATE_X1 (vertical end caps) and y = PLATE_Y0 / PLATE_Y1
 * (flat far / near edges). Every vertex lands on a whole screen pixel; the slab is point-symmetric about the board centre (320, 160).
 */
export const PLATE_C0 = -0.875;
export const PLATE_C1 = NT_COLS - 0.5 + 0.375; // 6.875
export const PLATE_R0 = -1.9375;
export const PLATE_R1 = NT_ROWS - 0.5 + 1.9375; // 5.9375
/** The chamfer lines (screen px): vertical end caps x, flat far / near edges y. */
export const PLATE_X0 = 114;
export const PLATE_X1 = 526;
export const PLATE_Y0 = 58;
export const PLATE_Y1 = 262;
/**
 * Height of the side armour below the top edge (J1: 28, was 18): coping 3 + groove, upper armour plate 7, light channel 4,
 * lower armour plate 8, ledge + skirt 4, bottom outline 1. The stands / crowd sit below it (armour bottom y = 154 + x/2 on the
 * left face, 472 − x/2 on the right face, 290 on the flat near edge).
 */
export const FACE_H = 28;

/** Grid coordinates of a screen point (inverse of ntIso). */
export function ntGrid(x: number, y: number): [number, number] {
  const u = (x - NT_OX) / 32;
  const s = (y - NT_OY) / 16;
  return [(s + u) / 2, (s - u) / 2];
}

/**
 * Platform top outline (grid coords), duelist pads inside it: the eight vertices of the octagon, clockwise on screen, starting
 * at the near-left corner (index 6 is the near-right end of the flat near edge: arena-nt/lights.ts splits blue / crimson there).
 */
export const PLATE_OUTLINE: readonly [number, number][] = [
  ntGrid(PLATE_X0, 183), // near-left corner (left face start)
  ntGrid(PLATE_X0, 139), // left end cap, top
  ntGrid(276, PLATE_Y0), // far flat edge, left end
  ntGrid(368, PLATE_Y0), // far flat edge, right end
  ntGrid(PLATE_X1, 137), // right end cap, top
  ntGrid(PLATE_X1, 181), // right end cap, bottom
  ntGrid(364, PLATE_Y1), // near flat edge, right end (the near corner of the right face)
  ntGrid(272, PLATE_Y1), // near flat edge, left end
];

/** The extreme points of the plate's top (screen): the middle of the flat far edge, the right / left end caps, the middle of the flat near edge. */
export const PLATE_CORNERS = {
  apex: { x: 322, y: PLATE_Y0 },
  right: { x: PLATE_X1, y: 159 },
  bottom: { x: 318, y: PLATE_Y1 },
  left: { x: PLATE_X0, y: 161 },
} as const;

/** Screen bounding box of the plate top (duelist pads are inside it). */
export const PLATE_TOP: Rect = { x: PLATE_X0, y: PLATE_Y0, w: PLATE_X1 - PLATE_X0, h: PLATE_Y1 - PLATE_Y0 };
/** Plate + side armour (the lowest point is the flat near edge: y 262 + FACE_H = 290, behind the hint plate / hand: HUD draws over it). */
export const PLATE_FULL: Rect = { x: PLATE_X0, y: PLATE_Y0, w: PLATE_X1 - PLATE_X0, h: PLATE_Y1 - PLATE_Y0 + FACE_H };
/** Soft contact shadow under the platform (ink, stepped): may run under the HUD, never above y 140. */
export const PLATE_SHADOW: Rect = { x: 88, y: 140, w: 464, h: 176 };

/** The two duelist pads: the 58×35 canvas box (cell 56×28) around the duelist's feet = layout.duelistXY; the pad diamond itself is 40×20 (art/arena-nt/pads.ts PAD_HALF). */
export const DUELIST_PADS: readonly Rect[] = [
  { x: 185, y: 200, w: 56, h: 28 }, // P1, feet (213, 214), cyan border
  { x: 399, y: 92, w: 56, h: 28 }, // P2, feet (427, 106), crimson border
];

/** The neutral centre strip (no-man's land, row 2): its emblem is a tiny original mark, 16×8, at the board centre. */
export const CENTER_EMBLEM: Rect = { x: 312, y: 156, w: 16, h: 8 };

// ---------------------------------------------------------------- back wall, tower, screens

/** The dark back wall band (panels, LED strips, banners) behind everything; x/y overshoot the frame for the camera lean. */
export const WALL: Rect = { x: -8, y: -8, w: 656, h: 110 };
/** The tall symmetrical tower mass at the back centre. */
export const TOWER: Rect = { x: 236, y: 0, w: 168, h: 64 };
/** The original winged-shield tournament emblem plate on the tower (the phase bar hides y < 20, so it sits at 22..48). */
export const EMBLEM: Rect = { x: 284, y: 21, w: 72, h: 38 };
/** The small corridor / gate under the emblem: the platform's far corner (288, 52) hides its lower half. */
export const CORRIDOR: Rect = { x: 306, y: 58, w: 28, h: 10 };
/**
 * The two ANGLED digital screens (J3): panels hung parallel to the platform's far edges, so each is sheared in whole-pixel steps (1 px of
 * height per 6 columns; src/art/arena-nt/screens.ts SCREEN_AT / FRAME_W / FRAME_H must stay equal to these rects). The rect is the
 * bounding box of the sheared bezel: the inner edge (right side of the left screen, left side of the right one) is the high one, its top
 * y 22 stays under the phase bar (y 4..19); the right screen ends at x 488 where the (compact) P2 panel begins. The left screen's lower
 * inner corner is cut along the platform's upper-left edge (y = 194 − x / 2). Left = the player (blue), right = the opponent (crimson).
 * Inner portrait area: 80×56 inside.
 */
export const SCREENS: readonly Rect[] = [
  { x: 148, y: 22, w: 92, h: 79 },
  { x: 396, y: 22, w: 92, h: 79 },
];
export const SCREEN_INNER = { w: 80, h: 56 } as const;

// ---------------------------------------------------------------- holograms

export interface HoloSpot {
  /** Creature box (translucent sprite, 1× integer scale, bottom-aligned on the feet line). */
  box: Rect;
  /** Pedestal ellipse centre / radii (the round plinth with a light ring). */
  pedestal: { cx: number; cy: number; rx: number; ry: number };
  /** The monster it always shows (user decision). */
  monster: 'crystal_wyrm' | 'abyss_magus';
  /** Which duelist's side (blue left, violet/red right). */
  side: 0 | 1;
}
export const HOLOS: readonly HoloSpot[] = [
  // left: Kristal Ejder at 4/3 (≈ 116×122 px); the top of its horns stays under the toolbar (y ≥ 20); the round pedestal (rx 54, ry 12,
  // side 9) sits behind the first stand tiers (stands draw over it)
  { box: { x: 2, y: 19, w: 116, h: 122 }, pedestal: { cx: 60, cy: 141, rx: 54, ry: 12 }, monster: 'crystal_wyrm', side: 0 },
  // right: Uçurum Büyücüsü at 1.5 (≈ 84×110 px) under the compact P2 panel (bottom y 50); pedestal right end at the screen edge
  { box: { x: 548, y: 51, w: 84, h: 110 }, pedestal: { cx: 588, cy: 161, rx: 54, ry: 12 }, monster: 'abyss_magus', side: 1 },
];

// ---------------------------------------------------------------- stands + crowd

export interface StandBlock {
  /** Blue (P1) stands on the left, crimson (P2) on the right. */
  side: 0 | 1;
  /** Tiers (rows), front (nearest the platform) first. */
  rows: number;
  /** Feet line of row 0: y = a + x·slope (slope +½ left, −½ right). */
  feet0: { a: number; slope: number };
  /** x range of row 0 (feet x of the first / last spectator slot). */
  x0: number;
  x1: number;
  /** Every further tier lies this many px LOWER at the same x (tier pitch: a spectator + its railing). */
  rowDy: number;
  /** Row k covers x0 + shiftA·k … min(xMax, x1 + shiftB·k): the tiers step outward along the iso diagonal. */
  shiftA: number;
  shiftB: number;
  xMax: number;
  /** Spectator slot pitch along x. */
  pitch: number;
}
export const STANDS: readonly StandBlock[] = [
  // left: lower-left plate edge (104,144)→(352,268); armour bottom y = 110 + x/2; row 0 feet 18 px below it. Head tops stay
  // below y 148 (the top-left corner x<150,y<150 belongs to the hologram).
  { side: 0, rows: 5, feet0: { a: 128, slope: 0.5 }, x0: 76, x1: 150, rowDy: 13, shiftA: -16, shiftB: -16, xMax: 150, pitch: 8 },
  // right: lower-right plate edge (352,268)→(536,176); armour bottom y = 462 − x/2; row 0 feet 18 px below it. Starts right of
  // the hint plate (x 466), ends at the screen edge; head tops stay below y 148 (top-right corner = hologram).
  { side: 1, rows: 5, feet0: { a: 480, slope: -0.5 }, x0: 476, x1: 626, rowDy: 13, shiftA: 16, shiftB: 0, xMax: 626, pitch: 8 },
];
/** Spectator sprite cell (feet at the bottom centre) and the pre-baked looks (atlas, docs §8). */
export const CROWD_CELL = { w: 14, h: 22 } as const;
export const CROWD_LOOKS = 9;

// ---------------------------------------------------------------- HUD keep-out (never covered by the arena)

/** UI rects the arena must leave readable (HUD draws above the arena by depth, but nothing may be designed under them). */
export const KEEP_OUT: Record<string, Rect> = {
  toolbar: { x: 4, y: 4, w: 92, h: 16 },
  phaseBar: { x: 160, y: 4, w: 274, h: 16 },
  p2Panel: { x: UI.p2Panel.x, y: UI.p2Panel.y, w: UI.p2Panel.w, h: UI.p2Panel.h },
  p2MiniHand: { x: 540, y: 68, w: 46, h: 12 },
  inspect: { x: UI.inspect.x, y: UI.inspect.y, w: UI.inspect.w, h: UI.inspect.h },
  hint: { x: 174, y: 262, w: 292, h: 26 },
  p1Panel: { x: UI.p1Panel.x, y: UI.p1Panel.y, w: UI.p1Panel.w, h: UI.p1Panel.h },
  hand: { x: UI.hand.x, y: 290, w: UI.hand.w, h: 70 },
  buttons: { x: 500, y: 300, w: 136, h: 56 },
};

// ---------------------------------------------------------------- depth order (docs §4)

/**
 * The NT depth map inside layout.ts DEPTH bands. Far → near. The calm arena's own layers keep their
 * numbers (base 19.1, bg 19.2 … slab 20, pads 30 …); NT layers that replace them take their place
 * once BoardViewCalm's `skip` flags are on (docs §8 handover).
 */
export const NT_DEPTH = {
  wall: DEPTH.STADIUM + 0, // 10  back wall panels, tower, emblem, corridor
  screens: DEPTH.STADIUM + 1, // 11  the two portrait screens (+ their scanline)
  wallLights: DEPTH.STADIUM + 2, // 12  LED strips, banners' glow, spot cones (flat stepped)
  holoPed: DEPTH.STADIUM + 3, // 13  pedestals + light rings
  holo: DEPTH.STADIUM + 4, // 14  the two translucent creatures
  holoFx: DEPTH.STADIUM + 5, // 15  motes, scan sweep, summon flare
  stands: DEPTH.STADIUM + 6, // 16  grandstand steps / rails
  crowd: DEPTH.STADIUM + 7, // 17  spectators
  crowdFx: DEPTH.STADIUM + 8, // 18  glow sticks, reaction sparks
  shadow: DEPTH.PLATFORM - 1, // 19  contact shadow under the platform
  platform: DEPTH.PLATFORM, // 20  hull, side armour, top plate, energy strips
  platformFx: DEPTH.PLATFORM + 2, // 22  strip runners, corner glints
  pads: DEPTH.TILE - 1, // 29  duelist pads
  floor: DEPTH.TILE, // 30  slots (borders, centre strip, emblem) — calm: pad 30 / padFill 31 / padLine 32
  floorFx: DEPTH.TILE_FX, // 40  hover / selection highlight, flashes (as calm hl*)
  debug: DEPTH.DEBUG - 1,
} as const;

// ---------------------------------------------------------------- the debug overlay's rect list

export interface NtRegion {
  name: string;
  layer: string;
  rect: Rect;
  color: number;
  /**
   * 'clear': must not intersect any KEEP_OUT rect (screens, emblem, pads …).
   * 'behind': background mass that HUD draws over by depth (wall, platform armour, shadow, hologram
   * boxes, stands). It may sit under KEEP_OUT rects, but nothing that must stay readable is designed there.
   */
  hud: 'clear' | 'behind';
}

/** Every layer's region, for ?ntdebug=1 and the layout test. */
export function ntRegions(): NtRegion[] {
  const R = (name: string, layer: string, rect: Rect, color: number, hud: NtRegion['hud']): NtRegion => ({ name, layer, rect, color, hud });
  const out: NtRegion[] = [
    R('platform', 'platform', PLATE_FULL, 0xffd447, 'behind'),
    R('shadow', 'platform', PLATE_SHADOW, 0x393846, 'behind'),
    R('pad P1', 'pads', DUELIST_PADS[0], 0x3fe0ea, 'clear'),
    R('pad P2', 'pads', DUELIST_PADS[1], 0xff4d5e, 'clear'),
    R('wall', 'wall', WALL, 0x3b4c91, 'behind'),
    R('tower', 'wall', TOWER, 0x6578b4, 'behind'),
    R('emblem', 'wall', EMBLEM, 0xb6fbff, 'clear'),
    R('corridor', 'wall', CORRIDOR, 0xa3b1da, 'clear'),
    R('screen L', 'screens', SCREENS[0], 0x3fe0ea, 'clear'),
    R('screen R', 'screens', SCREENS[1], 0xff4d5e, 'clear'),
    R('holo L', 'holograms', HOLOS[0].box, 0x3ea2ff, 'behind'),
    R('holo R', 'holograms', HOLOS[1].box, 0x914fe6, 'behind'),
  ];
  for (const h of HOLOS) {
    const p = h.pedestal;
    out.push(R(`plinth ${h.side}`, 'holograms', { x: p.cx - p.rx, y: p.cy - p.ry, w: 2 * p.rx, h: 2 * p.ry }, 0x3ea2ff, 'behind'));
  }
  for (const b of STANDS) out.push(R(`stands ${b.side}`, 'stands', standsBounds(b), b.side === 0 ? 0x0f9db5 : 0xbd1f3e, 'behind'));
  return out;
}

/** Bounding rect of a stand block (all rows, spectators 14×22 and the outer skirt included). */
export function standsBounds(b: StandBlock): Rect {
  let xa = Infinity;
  let xb = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let k = 0; k < b.rows; k++) {
    const ra = b.x0 + b.shiftA * k;
    const rb = Math.min(b.xMax, b.x1 + b.shiftB * k);
    xa = Math.min(xa, ra - CROWD_CELL.w / 2);
    xb = Math.max(xb, rb + CROWD_CELL.w / 2);
    for (const x of [ra, rb]) {
      const fy = b.feet0.a + b.feet0.slope * x + b.rowDy * k;
      y0 = Math.min(y0, fy - CROWD_CELL.h);
      y1 = Math.max(y1, fy + (k === b.rows - 1 ? STAND_SKIRT_H : 0));
    }
  }
  return { x: Math.round(xa), y: Math.round(y0), w: Math.round(xb - xa), h: Math.round(y1 - y0) };
}
/** Height of the outer skirt face under the last tier's feet line. */
export const STAND_SKIRT_H = 22;

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
