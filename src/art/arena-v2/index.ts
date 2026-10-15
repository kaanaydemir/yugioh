// Arena v2 textures ("floodlit night match", docs/ARENA_V2.md). Built at boot by
// src/boot/15-arena.ts when ARENA_VARIANT === 'v2' and animated by src/view/board-v2/.
//
// Big layers are drawn in WORLD pixel coordinates; sparse ones are cropped to their opaque
// bounds and placed with texOrigin2(key). Multi-frame layers (crowd) share one cropped rect.

import Phaser from 'phaser';
import type { BoardSpot } from '../../view/layout';
import { buildArenaSharedTextures } from '../arena';
import { PAL, RAMPS, type Ramp } from '../palette';
import { PixelCanvas } from '../pixel';
import { addStaticCanvas, canvasTexture, sheetTexture } from '../textures';
import {
  HL_H,
  HL_W,
  MARCH_FRAMES,
  RING_FRAMES,
  RING_H,
  RING_W,
  drawCone,
  FOG_H,
  FOG_W,
  drawConfetti,
  drawFog,
  drawHlMarch,
  drawHlOutline,
  drawPinLight,
  drawPool,
  drawRing,
  drawSearchBeam,
  drawSoftCone,
  drawTileFill,
  drawTip,
} from './fx';
import { SKY_RECT, SLAB_RECT, STAD_RECT, TOWERS, type TrimClass, type WorldRect } from './geom';
import { BRIDGE_RECT, CHEVRONS, type FacePx, SPILL_RECT, buildPlatform } from './platform';
import {
  BANNER_H,
  BANNER_LEN,
  BEACON_FRAMES,
  CAM_H,
  CAM_W,
  DRONE_H,
  DRONE_W,
  FLAG_H,
  FLAG_S_H,
  FLAG_S_W,
  FLAG_W,
  LED_GH,
  LED_GW,
  PYLON_H,
  PYLON_W,
  drawBanners,
  drawBeacons,
  drawCableReel,
  drawCameraman,
  drawDrones,
  drawFlags,
  drawFlightCase,
  drawLedFont,
  drawPylon,
  drawScoreboard,
  drawSmallFlags,
} from './props';
import { drawClouds2, drawSky2 } from './sky';
import { CROWD_FRAMES, type LedBoard, type PitchLayout, type StandsArt, buildStands, drawPitch, drawTowers, towerLamps } from './stands';
import { fastCrop, remap, unionBounds } from './util';
import type { Color } from '../pixel';

export const AK2 = {
  sky: 'arena2:sky',
  skyHot: 'arena2:sky:hot',
  clouds: 'arena2:clouds',
  stadium: 'arena2:stadium',
  stadiumHot: 'arena2:stadium:hot',
  crowdChunk: (i: number) => `arena2:crowd:${i}`, // sheet 'i0'..'i7', `u${0|1|a}:${f}` (see stands.ts)
  flags: 'arena2:flags', // sheet `${side}:${design}:${f}`
  flagsSmall: 'arena2:flags:s', // sheet `${side}:${f}`
  ledFont: (scheme: LedScheme) => `arena2:ledfont:${scheme}`, // sheet, frame = char code
  ledBg: (i: number) => `arena2:ledbg:${i}`, // placed at the board's (x, y)
  ledFx: (i: number, hot: boolean) => `arena2:ledfx:${i}:${hot ? 'h' : 'c'}`, // sheet '0'..
  cameraman: 'arena2:cameraman', // sheet '0'..'5'
  dollyCam: 'arena2:dollycam', // sheet '0'..'5'
  fog: (i: number) => `arena2:fog:${i}`,
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
  /** Zone pad tile with its neon one tone brighter / dimmer (the inlays breathe by band swaps). */
  zoneTileB: (col: number, row: number) => `arena2:ztb:${col},${row}`,
  zoneTileD: (col: number, row: number) => `arena2:ztd:${col},${row}`,
  trim: (hot: boolean, cls: TrimClass) => `arena2:trim:${hot ? 'hot' : 'cool'}:${cls}`,
  bridgeHalf: (p: 0 | 1) => `arena2:bridgehalf:${p}`, // placed at texOrigin2(key)
  spill: (cls: TrimClass) => `arena2:spill:${cls}`, // neon spill on the floor under the faces
  bounce: 'arena2:bounce', // the marble's bounce light on the floor around the slab
  coneSoft: 'arena2:cone:soft', // smooth floodlight cone (light layer; LINEAR filtered)
  chevron: (i: number) => `arena2:chev:${i}`,
  hlOutline: 'arena2:hl:outline',
  hlOutlineHot: 'arena2:hl:outline:hot',
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

/** Neon one tone up / down (zone pad breathing by band swap; marble and grooves stay). */
const NEON_UP = new Map<number, number>([
  [PAL.cyan2, PAL.cyan3],
  [PAL.cyan3, PAL.cyan4],
  [PAL.cyan4, PAL.white],
  [PAL.crim2, PAL.crim3],
  [PAL.crim3, PAL.crim4],
  [PAL.crim4, PAL.white],
]);
const NEON_DOWN = new Map<number, number>([
  [PAL.cyan4, PAL.cyan3],
  [PAL.cyan3, PAL.cyan2],
  [PAL.cyan2, PAL.cyan1],
  [PAL.crim4, PAL.crim3],
  [PAL.crim3, PAL.crim2],
  [PAL.crim2, PAL.crim1],
]);

/** LED colour schemes: cyan (P1), crimson (P2), hot (volcano), white, gold. */
export type LedScheme = 'c' | 'r' | 'h' | 'w' | 'g';
export const LED_COLORS: Record<LedScheme, { on: Color; hi: Color; dim: Color }> = {
  c: { on: PAL.cyan3, hi: PAL.cyan4, dim: PAL.cyan0 },
  r: { on: PAL.crim3, hi: PAL.crim4, dim: PAL.crim0 },
  h: { on: PAL.fire3, hi: PAL.fire4, dim: PAL.fire0 },
  w: { on: PAL.mist, hi: PAL.white, dim: PAL.night1 },
  g: { on: PAL.gold3, hi: PAL.gold4, dim: PAL.gold0 },
};
export const LED_FX_FRAMES = { chase: 12, flag: 16 } as const;

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
  stands: Omit<StandsArt, 'base' | 'hot' | 'crowd'>;
  /** Crowd chunk images: texture key + world top-left, stand and along-stand position. */
  crowd: { key: string; x: number; y: number; stand: 0 | 1; a: number }[];
  /** Per LED board: for each column u, 1 when something nearer (a mast, the platform) covers it. */
  boardCovered: Uint8Array[];
  /** Cables, marker lights, the dolly rail and the pitch-side props. */
  pitch: PitchLayout;
  /** Per LED board: 1 where a tower mast covers the board (do not paint there). */
  boardMasks: Uint8Array[];
  /** Top-left of each tower's lit lamp texture (AK2.lampLit(i)). */
  lampOrigins: { x: number; y: number }[];
  chevrons: { key: string; x: number; y: number; col: number; player: 0 | 1; step: number }[];
  /** Front-face LED strip pixels (world px), ordered along each class's run. */
  facePx: FacePx[];
  /** The bridge's two energy lines (world px), P1 side and P2 side, ordered along the bridge. */
  bridgeLines: [{ x: number; y: number; c: number }[], { x: number; y: number; c: number }[]];
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

  // ---- stadium: floor, stands, roof, masts, pitch props + the crowd chunks
  const st = timed('stands', () => buildStands());
  const pitch = drawPitch(st.base, st.hot, { cases: [drawFlightCase(0), drawFlightCase(1), drawFlightCase(2)], reel: drawCableReel() });
  timed('stadiumUpload', () => add(AK2.stadium, st.base));
  timed('stadiumHot', () => add(AK2.stadiumHot, st.hot));
  const crowd = timed('crowd', () =>
    st.crowd.map((ch, i) => {
      const key = AK2.crowdChunk(i);
      sheetTexture(scene, key, ch.w, ch.h, ch.frames);
      return { key, x: ch.x, y: ch.y, stand: ch.stand, a: ch.a };
    }),
  );
  sheetTexture(scene, AK2.flagsSmall, FLAG_S_W, FLAG_S_H, drawSmallFlags());
  sheetTexture(scene, AK2.cameraman, CAM_W, CAM_H, drawCameraman(false));
  sheetTexture(scene, AK2.dollyCam, CAM_W, CAM_H, drawCameraman(true));
  add(AK2.fog(0), drawFog(17));
  add(AK2.fog(1), drawFog(53));
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
  const boardCovered = st.boards.map((b, i) => {
    const m = boardMasks[i];
    return Uint8Array.from(b.cols, (col) => {
      for (let k = 0; k < b.rows; k++) if (m[(col.y - b.y + k) * b.w + (col.x - b.x)]) return 1;
      return 0;
    });
  });
  timed('led', () => {
    for (const sc of ['c', 'r', 'h', 'w', 'g'] as LedScheme[]) sheetTexture(scene, AK2.ledFont(sc), LED_GW, LED_GH, drawLedFont(LED_COLORS[sc].on, LED_COLORS[sc].hi));
    st.boards.forEach((b, i) => {
      const scheme: LedScheme = b.stand === 0 ? 'c' : 'r';
      add(AK2.ledBg(i), ledBoardBg(b, boardMasks[i], LED_COLORS[scheme].dim));
      const mode = b.mode;
      if (mode === 'text') return;
      for (const hot of [false, true]) {
        const C = LED_COLORS[hot ? 'h' : scheme];
        const n = LED_FX_FRAMES[mode];
        sheetTexture(scene, AK2.ledFx(i, hot), b.w, b.h, Array.from({ length: n }, (_, f) => [String(f), ledBoardFx(b, boardMasks[i], mode, f, n, C)] as [string, PixelCanvas]));
      }
    });
  });
  sheetTexture(scene, AK2.drone, DRONE_W, DRONE_H, drawDrones());
  add(AK2.pylon, drawPylon());
  sheetTexture(scene, AK2.beacon, 5, 8, drawBeacons());
  add(AK2.scoreboard, drawScoreboard());

  add(AK2.deck, plat.deck);
  for (const [k, t] of plat.zoneTiles) {
    const [c, r] = k.split(',').map(Number);
    add(AK2.zoneTile(c, r), t);
    add(AK2.zoneTileB(c, r), remap(t, NEON_UP));
    add(AK2.zoneTileD(c, r), remap(t, NEON_DOWN));
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
  addLayer(AK2.bridgeHalf(0), plat.bridgeHalf[0], SLAB_RECT);
  addLayer(AK2.bridgeHalf(1), plat.bridgeHalf[1], SLAB_RECT);
  for (const cls of [0, 1, 2] as TrimClass[]) addLayer(AK2.spill(cls), plat.spill[cls], SPILL_RECT);
  addLayer(AK2.bounce, plat.bounce, SPILL_RECT);
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
    add(AK2.hlOutlineHot, drawHlOutline(true));
    sheetTexture(scene, AK2.hlMarch, HL_W, HL_H, Array.from({ length: MARCH_FRAMES }, (_, f) => [String(f), drawHlMarch(f)] as [string, PixelCanvas]));
    add(AK2.hlTipT, drawTip(true));
    add(AK2.hlTipL, drawTip(false));
    add(AK2.tileFill, drawTileFill());
    add(AK2.pool, drawPool(300, 150, 1.25, 1, 7));
    add(AK2.poolCore, drawPool(130, 65, 1.1, 1, 5));
    add(AK2.cone, drawCone(220, 12, 160));
    addStaticCanvas(scene, AK2.coneSoft, drawSoftCone(220, 10, 150).toCanvas()).setFilter(Phaser.Textures.FilterMode.LINEAR);
    add(AK2.search, drawSearchBeam(340, 56));
    sheetTexture(scene, AK2.ringFx, RING_W, RING_H, Array.from({ length: RING_FRAMES }, (_, f) => [String(f), drawRing(f)] as [string, PixelCanvas]));
    sheetTexture(scene, AK2.confetti, 3, 3, drawConfetti());
    add(AK2.pin, drawPinLight());
  });

  const { base: _b, hot: _h, crowd: _c, ...standsRest } = st;
  layoutCache = {
    faceLights: plat.faceLights,
    floorLights: pitch.boxLights,
    stands: standsRest,
    crowd,
    chevrons,
    boardMasks,
    boardCovered,
    lampOrigins,
    facePx: plat.facePx,
    bridgeLines: plat.bridgeLines,
    pitch,
  };
  ARENA_V2_BUILD_MS.total = Math.round(performance.now() - tAll);
}

/** The unlit LED matrix of a board: sparse dim dots along the sheared band (no checker). */
function ledBoardBg(b: LedBoard, mask: Uint8Array, dim: Color): PixelCanvas {
  const p = new PixelCanvas(b.w, b.h);
  for (const col of b.cols)
    for (let k = 0; k < b.rows; k++) {
      const x = col.x - b.x;
      const y = col.y - b.y + k;
      if (mask[y * b.w + x]) continue;
      p.set(x, y, col.u % 2 === 0 && k % 2 === 1 ? dim : PAL.night0);
    }
  return p;
}

/** One frame of a board's chase / waving-flag animation (lit pixels only). */
function ledBoardFx(b: LedBoard, mask: Uint8Array, mode: 'chase' | 'flag', f: number, n: number, C: { on: Color; hi: Color; dim: Color }): PixelCanvas {
  const p = new PixelCanvas(b.w, b.h);
  const len = b.cols.length;
  for (const col of b.cols)
    for (let k = 0; k < b.rows; k++) {
      const x = col.x - b.x;
      const y = col.y - b.y + k;
      if (mask[y * b.w + x]) continue;
      let c: Color | null = null;
      if (mode === 'chase') {
        const seg = Math.floor((col.u + f * 2) / 6) % 4;
        if (seg === 0 && k > 1 && k < b.rows - 2) c = k === 2 ? C.hi : C.on;
        else if (seg === 1 && k > 2 && k < b.rows - 3) c = C.dim;
      } else {
        const w = Math.sin((col.u / len) * Math.PI * 4 - (f / n) * Math.PI * 2) * 1.5;
        if (k > 0 && k < b.rows - 1) {
          if (k + w > 5) c = C.on;
          else if (k + w > 4) c = C.hi;
        }
      }
      if (c !== null) p.set(x, y, c);
    }
  return p;
}

export { BEACON_FRAMES, BRIDGE_RECT, CROWD_FRAMES, DRONE_H, DRONE_W, FOG_H, FOG_W, PYLON_H, PYLON_W, SKY_RECT, SPILL_RECT, STAD_RECT };
