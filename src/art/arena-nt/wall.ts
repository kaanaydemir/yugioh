// Neon Tower painter: WALL — owner A2 (docs/v3/ARENA_NEON_TOWER.md §2 / §3 / §5 / §6).
// The dark navy / violet hall behind the platform: the repeating wall band (panels, ceiling truss, plinth), the tall
// symmetrical tower with the original winged-shield emblem and the small corridor, flanking pillars with a dim
// neon tube, hanging banners, the empty screen bays (B2 fills them), the hologram socles (B2's plinth sits on
// them), the visible ceiling lamp fixtures, status LEDs, tiny data panels and the iso floor of the hall.
// Everything is data here (frames + placements + animation descriptors); src/view/board-nt/wall.ts only turns
// it into game objects. Pure PixelCanvas code: runs in Node for tests and the scratch renders.

import { PixelCanvas } from '../pixel';
import { paintEmblem } from './wall-emblem';
import { T, packAtlas, type NtAtlas } from './wall-kit';
import {
  BAY_H,
  BAY_W,
  PANEL_H,
  PANEL_W,
  SOCLE_H,
  SOCLE_W,
  WALL_Y0,
  paintBay,
  paintBayMount,
  paintBanner,
  paintDataPanel,
  paintCable,
  paintFloorTile,
  paintHatch,
  paintVent,
  paintLamp,
  paintLed,
  paintMote,
  paintPanelTile,
  paintPillar,
  paintRod,
  paintSocle,
} from './wall-parts';
import { EMBLEM_AT, ENERGY_LINE, TOWER_H, TOWER_W, paintTower } from './wall-tower';

/** Texture keys. NT_WALL_KEY is the atlas (decor, banners, LEDs, emblem, tower); the tiles are their own textures. */
export const NT_WALL_KEY = 'nt:wall';
export const NT_WALL_PANEL_KEY = 'nt:wall:panel';
export const NT_HALL_FLOOR_KEY = 'nt:hall:floor';

/** Where the tower texture sits on screen (TOWER rect of layout-nt: x 236, y 0). */
export const TOWER_POS = { x: 236, y: 0 } as const;
/** The emblem plate on screen. */
export const EMBLEM_POS = { x: TOWER_POS.x + EMBLEM_AT.x, y: TOWER_POS.y + EMBLEM_AT.y } as const;
/** Screen x of the two energy-line pixels (above the emblem). */
export const ENERGY_X = TOWER_POS.x + ENERGY_LINE.x;

/** Sub-depths inside the wall band (NT_DEPTH.wall = 10 … wallLights 12). */
export const WALL_Z = {
  ink: 9.9,
  floor: 9.95,
  floorProp: 9.97,
  panel: 10,
  decor: 10.2,
  tower: 10.3,
  emblem: 10.4,
  socle: 10.6,
  anim: 10.8,
  motes: 12.2,
} as const;

// ------------------------------------------------------------------ the atlas

export function paintWallAtlas(): NtAtlas {
  const f: [string, PixelCanvas][] = [];
  f.push(['tower', paintTower()]);
  f.push(['emblem:0', paintEmblem(0)]);
  f.push(['emblem:1', paintEmblem(1)]);
  f.push(['pillar:c', paintPillar([T.c0, T.c1])]);
  f.push(['pillar:v', paintPillar([T.v1, T.v2])]);
  f.push(['bay', paintBay()]);
  f.push(['bayMount', paintBayMount()]);
  f.push(['rod', paintRod()]);
  f.push(['socle:c', paintSocle([T.c0, T.c1])]);
  f.push(['socle:v', paintSocle([T.v1, T.v2])]);
  f.push(['lamp:0', paintLamp(0)]);
  f.push(['lamp:1', paintLamp(1)]);
  for (let i = 0; i < 3; i++) {
    f.push([`banner:c:${i}`, paintBanner([T.n1, T.n2, T.c0], [T.c1, T.c0], i as 0 | 1 | 2)]);
    f.push([`banner:r:${i}`, paintBanner([T.n1, T.n2, T.r0], [T.r1, T.r0], i as 0 | 1 | 2)]);
    f.push([`bannerS:r:${i}`, paintBanner([T.n1, T.n2, T.r0], [T.r1, T.r0], i as 0 | 1 | 2, 36)]);
  }
  const leds: [string, readonly [number, number, number]][] = [
    ['c', [T.n1, T.c1, T.c2]],
    ['r', [T.n1, T.r1, T.r2]],
    ['g', [T.n1, T.g1, T.g2]],
    ['v', [T.n1, T.v1, T.v2]],
  ];
  for (const [k, ramp] of leds) for (let s = 0; s < 3; s++) f.push([`led:${k}:${s}`, paintLed(ramp, s as 0 | 1 | 2)]);
  for (let i = 0; i < 4; i++) {
    f.push([`data:c:${i}`, paintDataPanel(i, [T.c0, T.c1])]);
    f.push([`data:v:${i}`, paintDataPanel(i, [T.v1, T.v2])]);
  }
  for (let i = 0; i < 2; i++) {
    f.push([`hatch:c:${i}`, paintHatch(i as 0 | 1, [T.c0, T.c1])]);
    f.push([`hatch:r:${i}`, paintHatch(i as 0 | 1, [T.r0, T.r1])]);
  }
  f.push(['vent', paintVent()]);
  f.push(['cable:c', paintCable(0)]);
  f.push(['cable:r', paintCable(1)]);
  f.push(['mote:0', paintMote(T.n3)]);
  f.push(['mote:1', paintMote(T.n4)]);
  f.push(['pulse', new PixelCanvas(2, 3).rect(0, 0, 2, 3, T.c3)]);
  return packAtlas(f, 256);
}

export function paintWallPanel(): PixelCanvas {
  return paintPanelTile();
}
export function paintHallFloor(): PixelCanvas {
  return paintFloorTile();
}

// ------------------------------------------------------------------ static placements (screen px)

export interface Deco {
  frame: string;
  x: number;
  y: number;
  /** sub-depth key of WALL_Z */
  z: keyof typeof WALL_Z;
}

/**
 * The two screen bays. J3: the screens are now ANGLED quads (src/art/arena-nt/screens.ts, they carry their own ceiling rods), so the wall
 * paints no rectangular bay recess / mount / LED behind them any more: the list is empty.
 */
export const BAYS: readonly { x: number; y: number }[] = [];
export { BAY_W, BAY_H };

/** Hologram socle top-face centres. J3: the hologram layer paints its own round pedestal (src/art/arena-nt/holo.ts), so the wall has none. */
export const SOCLES: readonly { frame: string; cx: number; cy: number }[] = [];

/** Hatches, vents and cable runs on the floor (screen px of the 34×18 sprite). Blue side left, crimson side right. */
export const FLOOR_PROPS: readonly { frame: string; x: number; y: number }[] = [
  { frame: 'hatch:c:0', x: 14, y: 236 },
  { frame: 'vent', x: 62, y: 256 },
  { frame: 'cable:c', x: 96, y: 226 },
  { frame: 'vent', x: 8, y: 196 },
  { frame: 'hatch:r:1', x: 590, y: 246 },
  { frame: 'cable:r', x: 520, y: 262 },
  { frame: 'vent', x: 470, y: 274 },
  { frame: 'hatch:r:0', x: 560, y: 276 },
];

export function wallDecor(): Deco[] {
  const out: Deco[] = [];
  // pillars flanking the holograms (the tube is dim; blue left, violet right)
  out.push({ frame: 'pillar:c', x: 104, y: WALL_Y0, z: 'decor' });
  out.push({ frame: 'pillar:v', x: 524, y: WALL_Y0, z: 'decor' });
  // the screens hang from the ceiling truss
  for (const b of BAYS) {
    out.push({ frame: 'rod', x: b.x + 14, y: 3, z: 'decor' });
    out.push({ frame: 'rod', x: b.x + BAY_W - 16, y: 3, z: 'decor' });
    out.push({ frame: 'bay', x: b.x, y: b.y, z: 'decor' });
    out.push({ frame: 'bayMount', x: b.x + (BAY_W - 22) / 2, y: b.y + BAY_H - 2, z: 'decor' });
  }
  // ceiling lamps (visible fixtures; the cones are the light layer's job)
  for (const x of [98, 122, 440, 466]) out.push({ frame: 'lamp:1', x, y: 3, z: 'decor' });
  // floor props around the stands (flat iso pieces on the hall floor, below everything else in the band)
  for (const f of FLOOR_PROPS) out.push({ frame: f.frame, x: f.x, y: f.y, z: 'floorProp' });
  for (const s of SOCLES) out.push({ frame: s.frame, x: s.cx - SOCLE_W / 2, y: s.cy - 14, z: 'socle' });
  return out;
}
export { SOCLE_W, SOCLE_H, PANEL_W, PANEL_H, TOWER_W, TOWER_H };

// ------------------------------------------------------------------ living details (descriptors)

export interface WallLed {
  x: number;
  y: number;
  hue: 'c' | 'r' | 'g' | 'v';
  /** ms per cycle and phase offset (ms) — every LED has its own, nothing blinks in unison */
  period: number;
  phase: number;
  mode: 'blink' | 'pulse' | 'flick' | 'steady';
}

/** A little hash for stable per-item variety without Math.random. */
function h(n: number): number {
  let x = (Math.imul(n | 0, 0x9e3779b1) ^ 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) >>> 0;
  x = Math.imul(x ^ (x >>> 12), 0x297a2d39) >>> 0;
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}

function leds(): WallLed[] {
  const out: WallLed[] = [];
  const add = (x: number, y: number, hue: WallLed['hue'], mode: WallLed['mode']): void => {
    const k = out.length + 1;
    out.push({ x, y, hue, mode, period: 1800 + Math.floor(h(k) * 4200), phase: Math.floor(h(k + 99) * 6000) });
  };
  // tower: outer buttress LEDs (left x 243…, mirrored right), the spine flank LEDs
  const T0 = TOWER_POS.x;
  for (const [dx, dy, hue, mode] of [
    [7, 30, 'r', 'blink'],
    [12, 44, 'c', 'pulse'],
    [7, 58, 'c', 'steady'],
    [34, 56, 'g', 'flick'],
    [36, 25, 'c', 'blink'],
    [33, 90, 'r', 'pulse'],
  ] as const) {
    add(T0 + dx, dy, hue, mode);
    add(T0 + TOWER_W - 3 - dx, dy, hue === 'r' ? 'c' : hue === 'c' ? 'r' : hue, mode === 'blink' ? 'pulse' : mode === 'pulse' ? 'blink' : mode);
  }
  // pillars
  for (const [px, hue] of [
    [111, 'c'],
    [531, 'v'],
  ] as const)
    for (const y of [26, 50, 74]) add(px, y, hue, 'pulse');
  // bay mounts: each screen has a power LED under it
  for (const b of BAYS) add(b.x + BAY_W / 2 - 1, b.y + BAY_H + 3, b.x < 300 ? 'c' : 'r', 'steady');
  return out;
}
export const WALL_LEDS: readonly WallLed[] = leds();

/** LED state (0 off, 1 dim, 2 lit) at scene time t (ms). */
export function ledState(l: WallLed, t: number): 0 | 1 | 2 {
  const u = ((t + l.phase) % l.period) / l.period;
  switch (l.mode) {
    case 'blink':
      return u < 0.12 ? 2 : u < 0.2 ? 1 : 0;
    case 'pulse':
      return u < 0.25 ? 1 : u < 0.5 ? 2 : u < 0.75 ? 1 : 0;
    case 'flick':
      return u < 0.04 ? 0 : u < 0.1 ? 2 : u < 0.13 ? 0 : 1;
    default:
      return 1;
  }
}

export interface WallBanner {
  x: number;
  y: number;
  hue: 'c' | 'r';
  short: boolean;
  period: number;
  phase: number;
}
export const WALL_BANNERS: readonly WallBanner[] = [
  { x: 122, y: 16, hue: 'c', short: false, period: 3400, phase: 0 },
  { x: 498, y: 64, hue: 'r', short: true, period: 3800, phase: 1300 },
];
/** Sway frame 0 / 1 / 2 / 1 over one period. */
export function bannerFrame(b: WallBanner, t: number): 0 | 1 | 2 {
  const u = Math.floor((((t + b.phase) % b.period) / b.period) * 4);
  return ([1, 0, 1, 2] as const)[u];
}

export interface WallData {
  x: number;
  y: number;
  hue: 'c' | 'v';
  period: number;
  phase: number;
}
/** Small data panels on the tower flanks (4 frames, a slow bar chart). */
export const WALL_DATA: readonly WallData[] = [
  { x: TOWER_POS.x + 29, y: 21, hue: 'c', period: 2600, phase: 0 },
  { x: TOWER_POS.x + TOWER_W - 43, y: 21, hue: 'c', period: 3100, phase: 900 },
];
export function dataFrame(d: WallData, t: number): number {
  return Math.floor((((t + d.phase) % d.period) / d.period) * 4) % 4;
}

/** Dust motes drifting in the hall (a handful; the calm board has its own). */
export interface WallMote {
  x: number;
  y: number;
  /** px per second up / sway amplitude (px) and period (ms) */
  vy: number;
  amp: number;
  swayP: number;
  phase: number;
  tone: 0 | 1;
}
export const WALL_MOTES: readonly WallMote[] = Array.from({ length: 12 }, (_, i) => ({
  x: Math.floor(h(i * 7 + 1) * 640),
  y: 14 + Math.floor(h(i * 7 + 2) * 96),
  vy: 3 + h(i * 7 + 3) * 4,
  amp: 2 + Math.floor(h(i * 7 + 4) * 3),
  swayP: 4000 + Math.floor(h(i * 7 + 5) * 4000),
  phase: Math.floor(h(i * 7 + 6) * 8000),
  tone: (i % 3 === 0 ? 1 : 0) as 0 | 1,
}));
