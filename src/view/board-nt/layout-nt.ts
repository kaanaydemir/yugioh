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

/** The plate extends this many tiles beyond the tile grid (as the calm slab: left tip stays at x 104). */
export const PLATE_E = 0.375;
export const PLATE_G0 = -0.5 - PLATE_E; // -0.875
export const PLATE_G1X = NT_COLS - 0.5 + PLATE_E; // 6.875
export const PLATE_G1Y = NT_ROWS - 0.5 + PLATE_E; // 4.875
/** The duelist pads' column span (centre lane ±0.75) and how far they stand out of the plate (rows −2 / 6). */
export const PAD_C0 = 2.25;
export const PAD_C1 = 3.75;
/** Height of the side armour below the top edge: rim 2 + armour panel 11 + skirt 5. */
export const FACE_H = 18;

/** Platform top outline (grid coords, CCW), duelist pads included. Same footprint as the calm slab. */
export const PLATE_OUTLINE: readonly [number, number][] = [
  [PLATE_G0, PLATE_G0],
  [PAD_C0, PLATE_G0],
  [PAD_C0, -2],
  [PAD_C1, -2],
  [PAD_C1, PLATE_G0],
  [PLATE_G1X, PLATE_G0],
  [PLATE_G1X, PLATE_G1Y],
  [PAD_C1, PLATE_G1Y],
  [PAD_C1, 6],
  [PAD_C0, 6],
  [PAD_C0, PLATE_G1Y],
  [PLATE_G0, PLATE_G1Y],
];

/** The four corners of the plate's top (screen): apex (far), right tip, bottom (near), left tip. */
export const PLATE_CORNERS = {
  apex: ntIso(PLATE_G0, PLATE_G0), // (288, 52)
  right: ntIso(PLATE_G1X, PLATE_G0), // (536, 176)
  bottom: ntIso(PLATE_G1X, PLATE_G1Y), // (352, 268)
  left: ntIso(PLATE_G0, PLATE_G1Y), // (104, 144)
} as const;

/** Screen bounding box of the plate top (duelist pads are inside it). */
export const PLATE_TOP: Rect = { x: 104, y: 52, w: 432, h: 216 };
/** Plate + side armour (the lowest point is the near corner: y 268 + FACE_H = 286, the hint plate's bottom). */
export const PLATE_FULL: Rect = { x: 104, y: 52, w: 432, h: 234 };
/** Soft contact shadow under the platform (ink, stepped): may run under the HUD, never above y 140. */
export const PLATE_SHADOW: Rect = { x: 88, y: 140, w: 464, h: 170 };

/** The two duelist pads (diamond 56×28 around the duelist's feet = layout.duelistXY). */
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
export const EMBLEM: Rect = { x: 298, y: 22, w: 44, h: 26 };
/** The small corridor / gate under the emblem: the platform's far corner (288, 52) hides its lower half. */
export const CORRIDOR: Rect = { x: 306, y: 48, w: 28, h: 10 };
/**
 * The two angled digital screens (frame included). The left one's lower-right corner is cut along
 * the platform's upper-left edge (y = 196 − x/2 − 2), so it never sits under the plate. Left = the
 * player (blue frame), right = the opponent (crimson frame). Inner portrait area: 80×56 inside.
 */
export const SCREENS: readonly Rect[] = [
  { x: 146, y: 20, w: 90, h: 62 },
  { x: 398, y: 20, w: 90, h: 62 },
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
  { box: { x: 0, y: 36, w: 104, h: 104 }, pedestal: { cx: 52, cy: 136, rx: 46, ry: 10 }, monster: 'crystal_wyrm', side: 0 },
  { box: { x: 536, y: 36, w: 104, h: 104 }, pedestal: { cx: 588, cy: 136, rx: 46, ry: 10 }, monster: 'abyss_magus', side: 1 },
];

// ---------------------------------------------------------------- stands + crowd

export interface StandBlock {
  /** Blue (P1) stands on the left, crimson (P2) on the right. */
  side: 0 | 1;
  /** Rows, front (nearest the platform) first. */
  rows: number;
  /** Feet line of row 0: y = a + x·slope (slope −½ right, +½ left); row k is 4 px lower and its x range shifts 10 px outward. */
  feet0: { a: number; slope: number };
  /** x range of row 0 (feet x of the first / last spectator slot). */
  x0: number;
  x1: number;
  /** Row k covers x0 − 10k … x1 (left) / x0 … x1 + 10k clipped to xMax (right). */
  xMax: number;
  /** Spectator slot pitch along x. */
  pitch: number;
}
export const STANDS: readonly StandBlock[] = [
  // left: lower-left plate edge (104,144)→(352,268): E(x) = 92 + x/2, feet = E + 26 = 118 + x/2
  { side: 0, rows: 3, feet0: { a: 118, slope: 0.5 }, x0: 88, x1: 156, xMax: 156, pitch: 9 },
  // right: lower-right plate edge (352,268)→(536,176): E(x) = 444 − x/2, feet = E + 26 = 470 − x/2
  { side: 1, rows: 3, feet0: { a: 470, slope: -0.5 }, x0: 466, x1: 628, xMax: 628, pitch: 9 },
];
/** Spectator sprite cell (feet at the bottom centre) and the pre-baked looks / poses (atlas, docs §6). */
export const CROWD_CELL = { w: 12, h: 16 } as const;
export const CROWD_LOOKS = 8;
export const CROWD_POSES = 5;

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

/** Bounding rect of a stand block (all rows, spectators 12×16 included). */
export function standsBounds(b: StandBlock): Rect {
  const last = b.rows - 1;
  const xa = b.side === 0 ? b.x0 - 10 * last - CROWD_CELL.w / 2 : b.x0 - CROWD_CELL.w / 2;
  const xb = b.side === 0 ? b.x1 + CROWD_CELL.w / 2 : Math.min(b.xMax, b.x1 + 10 * last) + CROWD_CELL.w / 2;
  const ys: number[] = [];
  for (const x of [xa, xb]) for (let k = 0; k < b.rows; k++) ys.push(b.feet0.a + b.feet0.slope * (b.side === 0 ? x + 10 * k : x - 10 * k) + 4 * k);
  const y0 = Math.min(...ys) - CROWD_CELL.h;
  const y1 = Math.max(...ys);
  return { x: Math.round(xa), y: Math.round(y0), w: Math.round(xb - xa), h: Math.round(y1 - y0) };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
