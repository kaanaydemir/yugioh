// Arena v2 textures ("floodlit night match", docs/ARENA_V2.md). Built at boot by
// src/boot/15-arena.ts when ARENA_VARIANT === 'v2' and animated by src/view/board-v2/.
//
// Big layers are drawn in WORLD pixel coordinates; sparse ones are cropped to their opaque
// bounds and placed with texOrigin2(key). Multi-frame layers (crowd) share one cropped rect.

import type Phaser from 'phaser';
import type { BoardSpot } from '../../view/layout';
import { buildArenaSharedTextures } from '../arena';
import { PAL, RAMPS, type Ramp } from '../palette';
import { PixelCanvas } from '../pixel';
import { canvasTexture, sheetTexture } from '../textures';
import {
  HL_H,
  HL_W,
  MARCH_FRAMES,
  RING_FRAMES,
  RING_H,
  RING_W,
  drawCone,
  drawConfetti,
  drawHlMarch,
  drawHlOutline,
  drawPinLight,
  drawPool,
  drawRing,
  drawSearchBeam,
  drawTileFill,
  drawTip,
} from './fx';
import { SKY_RECT, SLAB_RECT, STAD_RECT, TOWERS, type TrimClass, type WorldRect } from './geom';
import { BRIDGE_RECT, CHEVRONS, FLOW_FRAMES, buildPlatform, drawBridgeFlow } from './platform';
import {
  BANNER_FRAMES,
  BANNER_H,
  BANNER_LEN,
  BEACON_FRAMES,
  DRONE_H,
  DRONE_W,
  FLAG_H,
  FLAG_W,
  PYLON_H,
  PYLON_W,
  drawBanners,
  drawBeacons,
  drawDrones,
  drawFlags,
  drawPylon,
  drawScoreboard,
} from './props';
import { drawClouds2, drawSky2 } from './sky';
import { CROWD_FRAMES, type StandsArt, buildStands, drawCables, drawTowers, towerLamps } from './stands';
import { fastCrop, remap, unionBounds } from './util';

export const AK2 = {
  sky: 'arena2:sky',
  skyHot: 'arena2:sky:hot',
  clouds: 'arena2:clouds',
  stadium: 'arena2:stadium',
  stadiumHot: 'arena2:stadium:hot',
  crowd: 'arena2:crowd', // sheet '0'..'7', placed at texOrigin2(AK2.crowd)
  flags: 'arena2:flags', // sheet `${side}:${design}:${f}`
  bannersL: 'arena2:banners:l', // sheet `${side}:${d}:${f}` (left stand wall slope)
  bannersR: 'arena2:banners:r',
  lampLit: (i: number) => `arena2:lamp:${i}`,
  towers: 'arena2:towers',
  drone: 'arena2:drone', // sheet `${tilt}:${rotor}`
  pylon: 'arena2:pylon',
  beacon: 'arena2:beacon', // sheet '0'..'5'
  scoreboard: 'arena2:scoreboard',
  deck: 'arena2:deck',
  zoneTile: (col: number, row: number) => `arena2:zt:${col},${row}`,
  glyphGlow: (spot: BoardSpot) => `arena2:gg:${spot}`,
  glyphHalo: (spot: BoardSpot) => `arena2:gh:${spot}`,
  trim: (hot: boolean, cls: TrimClass) => `arena2:trim:${hot ? 'hot' : 'cool'}:${cls}`,
  bridgeFlow: 'arena2:bridgeflow', // sheet, frames '0'..'15'
  chevron: (i: number) => `arena2:chev:${i}`,
  hlOutline: 'arena2:hl:outline',
  hlMarch: 'arena2:hl:march', // sheet, frames '0'..'15'
  hlTipT: 'arena2:hl:tipT',
  hlTipL: 'arena2:hl:tipL',
  tileFill: 'arena2:tilefill',
  pool: 'arena2:pool', // big soft iso light pool (white, for ADD)
  poolCore: 'arena2:poolcore',
  cone: 'arena2:cone', // floodlight cone pointing down
  search: 'arena2:search', // searchlight beam pointing right
  ringFx: 'arena2:ringfx', // sheet '0'..'7'
  confetti: 'arena2:confetti', // sheet '0'..'4'
  pin: 'arena2:pin', // 3×3 pin light
} as const;

/** The stadium as lit by lava: cool night tones remapped to dark embers. */
const HEAT_MAP = new Map<number, number>([
  [PAL.night0, PAL.ink],
  [PAL.night1, PAL.crim0],
  [PAL.night2, PAL.fire0],
  [PAL.night3, PAL.fire1],
  [PAL.night4, PAL.crim1],
  [PAL.steel, PAL.fire2],
  [PAL.mist, PAL.fire3],
  [PAL.cyan0, PAL.fire0],
  [PAL.cyan1, PAL.fire1],
  [PAL.cyan2, PAL.fire2],
  [PAL.crim1, PAL.fire1],
  [PAL.crim2, PAL.fire2],
  [PAL.gold0, PAL.fire0],
  [PAL.gold1, PAL.fire2],
]);

export const CLOUD_W = 320;
export const CLOUD_H = 44;

const ORIGINS = new Map<string, { x: number; y: number }>();

/** World position of the top-left of a cropped layer texture. */
export function texOrigin2(key: string): { x: number; y: number } {
  const o = ORIGINS.get(key);
  if (!o) throw new Error(`arena v2: no origin for ${key}`);
  return o;
}

/** Milliseconds per build step of the last buildArenaV2Textures() (boot profiling). */
export const ARENA_V2_BUILD_MS: Record<string, number> = {};

function timed<T>(name: string, fn: () => T): T {
  const t0 = performance.now();
  const r = fn();
  ARENA_V2_BUILD_MS[name] = Math.round((performance.now() - t0) * 10) / 10;
  return r;
}

/** Trim colors per theme and class; level indexes the ramp. */
export function trimRamp2(hot: boolean, cls: TrimClass): Ramp {
  if (hot) return cls === 2 ? [PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4, PAL.white] : RAMPS.fire;
  if (cls === 0) return RAMPS.cyan;
  if (cls === 1) return RAMPS.crim;
  return [PAL.steel, PAL.mist, PAL.mist, PAL.white, PAL.white];
}

/** Runtime placement data produced with the textures (valid after buildArenaV2Textures). */
export interface ArenaV2Layout {
  faceLights: { x: number; y: number; cls: TrimClass }[];
  floorLights: { x: number; y: number }[];
  stands: Omit<StandsArt, 'base' | 'crowd'>;
  /** Per LED board: 1 where a tower mast covers the board (do not paint there). */
  boardMasks: Uint8Array[];
  /** Top-left of each tower's lit lamp texture (AK2.lampLit(i)). */
  lampOrigins: { x: number; y: number }[];
  chevrons: { key: string; x: number; y: number; col: number; player: 0 | 1; step: number }[];
}

let layoutCache: ArenaV2Layout | null = null;

export function arenaV2Layout(): ArenaV2Layout {
  if (!layoutCache) throw new Error('arena v2: textures not built');
  return layoutCache;
}

/** Generate every arena v2 texture (idempotent). */
export function buildArenaV2Textures(scene: Phaser.Scene): void {
  if (layoutCache && scene.textures.exists(AK2.deck)) return;
  const tAll = performance.now();
  buildArenaSharedTextures(scene);
  const add = (key: string, pc: PixelCanvas) => canvasTexture(scene, key, pc);
  const addLayer = (key: string, pc: PixelCanvas, at: WorldRect) => {
    const b = unionBounds([pc]);
    ORIGINS.set(key, { x: at.x + b.x, y: at.y + b.y });
    canvasTexture(scene, key, fastCrop(pc, b.x, b.y, b.w, b.h));
  };

  // ---- sky
  timed('sky', () => add(AK2.sky, drawSky2(false)));
  timed('skyHot', () => add(AK2.skyHot, drawSky2(true)));
  add(AK2.clouds, drawClouds2(CLOUD_W, CLOUD_H, 61));

  // ---- platform (built first: the stadium's emissive bits are masked by it)
  const plat = timed('platform', () => buildPlatform());

  // ---- stadium: floor, stands, roof, masts, cables + the crowd frames
  const st = timed('stands', () => buildStands());
  const floorLights = drawCables(st.base);
  timed('stadiumUpload', () => add(AK2.stadium, st.base));
  timed('stadiumHot', () => add(AK2.stadiumHot, remap(st.base, HEAT_MAP)));
  timed('crowd', () => {
    const b = unionBounds(st.crowd);
    ORIGINS.set(AK2.crowd, { x: STAD_RECT.x + b.x, y: STAD_RECT.y + b.y });
    sheetTexture(
      scene,
      AK2.crowd,
      b.w,
      b.h,
      st.crowd.map((p, f) => [String(f), fastCrop(p, b.x, b.y, b.w, b.h)] as [string, PixelCanvas]),
    );
  });
  sheetTexture(scene, AK2.flags, FLAG_W, FLAG_H, drawFlags());
  sheetTexture(scene, AK2.bannersL, BANNER_LEN, BANNER_H + BANNER_LEN / 2 + 3, drawBanners(-1));
  sheetTexture(scene, AK2.bannersR, BANNER_LEN, BANNER_H + BANNER_LEN / 2 + 3, drawBanners(1));
  // floodlight towers (in front of the crowd) and their lit lamp banks
  const towers = timed('towers', () => drawTowers());
  addLayer(AK2.towers, towers, STAD_RECT);
  const lampOrigins: { x: number; y: number }[] = [];
  TOWERS.forEach((t, i) => {
    const cells = towerLamps(t);
    const x0 = Math.min(...cells.map((q) => q.x));
    const y0 = Math.min(...cells.map((q) => q.y));
    const lit = new PixelCanvas(Math.max(...cells.map((q) => q.x)) - x0 + 1, Math.max(...cells.map((q) => q.y)) - y0 + 1);
    cells.forEach((q, k) => lit.set(q.x - x0, q.y - y0, k % 6 === 0 ? PAL.white : k % 6 < 3 ? PAL.gold4 : PAL.white));
    add(AK2.lampLit(i), lit);
    lampOrigins.push({ x: x0, y: y0 });
  });
  // stand lights hidden behind a tower mast or the platform are dropped; LED boards get a mask
  // (they are drawn above the lights-off darkness, so they must not paint over nearer things)
  const covered = (x: number, y: number) => towers.alpha(x - STAD_RECT.x, y - STAD_RECT.y) > 0 || plat.deck.alpha(x - SLAB_RECT.x, y - SLAB_RECT.y) > 0;
  st.phones = st.phones.filter((q) => !covered(q.x, q.y));
  st.roofLights = st.roofLights.filter((q) => !covered(q.x, q.y));
  const boardMasks = st.boards.map((b) => {
    const m = new Uint8Array(b.w * b.h);
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) m[y * b.w + x] = covered(b.x + x, b.y + y) ? 1 : 0;
    return m;
  });
  sheetTexture(scene, AK2.drone, DRONE_W, DRONE_H, drawDrones());
  add(AK2.pylon, drawPylon());
  sheetTexture(scene, AK2.beacon, 5, 8, drawBeacons());
  add(AK2.scoreboard, drawScoreboard());

  add(AK2.deck, plat.deck);
  for (const [k, t] of plat.zoneTiles) {
    const [c, r] = k.split(',').map(Number);
    add(AK2.zoneTile(c, r), t);
  }
  for (const [spot, t] of plat.glyphGlow) add(AK2.glyphGlow(spot), t);
  for (const [spot, t] of plat.glyphHalo) add(AK2.glyphHalo(spot), t);
  timed('trims', () => {
    for (const hot of [false, true])
      for (const cls of [0, 1, 2] as TrimClass[]) {
        const p = new PixelCanvas(SLAB_RECT.w, SLAB_RECT.h);
        const ramp = trimRamp2(hot, cls);
        for (const lvl of [0, 1, 2, 3, 4]) for (const m of plat.marks) if (m.cls === cls && m.level === lvl) p.set(m.x, m.y, ramp[lvl]);
        addLayer(AK2.trim(hot, cls), p, SLAB_RECT);
      }
  });
  timed('bridgeFlow', () =>
    sheetTexture(
      scene,
      AK2.bridgeFlow,
      BRIDGE_RECT.w,
      BRIDGE_RECT.h,
      Array.from({ length: FLOW_FRAMES }, (_, f) => [String(f), drawBridgeFlow(f)] as [string, PixelCanvas]),
    ),
  );
  const chevrons: ArenaV2Layout['chevrons'] = [];
  CHEVRONS.forEach((ch, i) => {
    const xs = ch.px.map((q) => q[0]);
    const ys = ch.px.map((q) => q[1]);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    const p = new PixelCanvas(Math.max(...xs) - x0 + 1, Math.max(...ys) - y0 + 1);
    for (const [x, y] of ch.px) p.set(x - x0, y - y0, 0xffffff);
    const key = AK2.chevron(i);
    add(key, p);
    chevrons.push({ key, x: x0, y: y0, col: ch.col, player: ch.player, step: ch.step });
  });

  // ---- fx
  timed('fx', () => {
    add(AK2.hlOutline, drawHlOutline());
    sheetTexture(scene, AK2.hlMarch, HL_W, HL_H, Array.from({ length: MARCH_FRAMES }, (_, f) => [String(f), drawHlMarch(f)] as [string, PixelCanvas]));
    add(AK2.hlTipT, drawTip(true));
    add(AK2.hlTipL, drawTip(false));
    add(AK2.tileFill, drawTileFill());
    add(AK2.pool, drawPool(300, 150, 1.25, 1, 7));
    add(AK2.poolCore, drawPool(130, 65, 1.1, 1, 5));
    add(AK2.cone, drawCone(220, 12, 160));
    add(AK2.search, drawSearchBeam(340, 56));
    sheetTexture(scene, AK2.ringFx, RING_W, RING_H, Array.from({ length: RING_FRAMES }, (_, f) => [String(f), drawRing(f)] as [string, PixelCanvas]));
    sheetTexture(scene, AK2.confetti, 3, 3, drawConfetti());
    add(AK2.pin, drawPinLight());
  });

  const { base: _b, crowd: _c, ...standsRest } = st;
  layoutCache = { faceLights: plat.faceLights, floorLights, stands: standsRest, chevrons, boardMasks, lampOrigins };
  ARENA_V2_BUILD_MS.total = Math.round(performance.now() - tAll);
}

export { BEACON_FRAMES, CROWD_FRAMES, DRONE_H, DRONE_W, PYLON_H, PYLON_W, SKY_RECT, STAD_RECT };
