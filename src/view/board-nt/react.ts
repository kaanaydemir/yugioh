// Neon Tower layer: REACT — arena v4 step 4 "living details + reactive arena" (owner C). BOARD_V4 only (index.ts).
//
// The arena answers the duel and breathes on its own. Everything is a few pre-baked white masks / tiny particle frames, tinted
// and stepped at run time (flat crisp pixels, a soft light layer over them; no per-frame allocation, no tweens):
//
//   turn sweep    the turn passes: a band of the new player's light crosses the stage top from their edge to the far one
//                 (a parallelogram mask parallel to the long edges, three flat levels with a bright leading edge, moved in
//                 whole-pixel iso steps, cropped to the stage's end caps / flat edges), their side wall's light strip fills out
//                 from the dais both ways and settles; the dais' own double pulse is the pads layer's. ~0.7 s, under the turn
//                 plate (it starts 90 ms after the active side changes). A soft air sweep crosses the stereo field with it.
//   shockwaves    battle damage / a destroyed card: from the impact (the target zone, the hit duelist's dais for a direct
//                 attack) the zone borders flash in sequence by distance — white, the colour, a dim step, gone — reaching one
//                 lane for a small hit and the whole board (with a second, weaker echo ring) for a big one; a stone thump and
//                 a run of tile ticks under it. The cards' own animations are untouched (it only lights the floor art).
//   low-LP alarm  a player at ≤ 1000 LP: their side wall's light strip, their dais ring and a faint band of their stage
//                 edge pulse red, slowly (2.4 s), with a muffled heartbeat that thins out over time (every beat at first,
//                 then every second, then every fourth one, quieter each time) and comes back when they are hit again.
//   field spells  Volcano: a few embers lift off the stage's walls (and the theme's zone-border glow is held lower — the
//                 lava is busy enough); Tidal Bay: caustic glints wander over the stage stone; Shadow Cavern: the hall
//                 darkens a notch toward violet and motes drift through it; Festival: confetti falls behind the stage and
//                 the torches' light warms up like lanterns. The ambience bed retunes with it.
//   idle life     dust motes turning in the wall torches' light, a spark leaving a torch or brazier now and then, a portrait
//                 screen glitching for two frames every ten seconds or so. Rare and low-contrast.
//   ambience      the hall's room tone (src/audio/ambience.ts) runs while the arena does.
// Reduced motion (?motion=reduced): no sweep travel (the wall strip lifts in place), no shockwave cascade (only the impact
// tile flashes once), the alarm holds a steady level, no particles.

import Phaser from 'phaser';
import { type SealTheme, type ZoneShape, zoneShapeMask } from '../../art/arena-nt/floor';
import { NT_PAL } from '../../art/arena-nt/palette';
import { NT_PADS_KEY, PAD_CANVAS, padFrame } from '../../art/arena-nt/pads';
import { NT_PLATFORM_KEY, PLATFORM_BOX, STRIP_TONES } from '../../art/arena-nt/platform';
import { BRICK_TORCHES } from '../../art/arena-nt/brickwall';
import { BRAZIER, BRAZIERS } from '../../art/arena-nt/hallfloor';
import { frameRGBA } from '../../art/atlas';
import { PAL, PLAYER_RAMP, RAMPS } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { ambience } from '../../audio/ambience';
import { sfx } from '../../audio/sfx';
import type { GameEvent, PlayerId } from '../../engine/types';
import { BANISH_PAD, type BoardSpot, duelistXY, zoneXY } from '../layout';
import { calmZones } from '../board-calm/art';
import { REDUCED_MOTION } from '../v3/motion';
import { TEX } from '../../vfx/core';
import { LOW_LP, fieldThemeWatcher, readLp } from './duel-watch';
import { DUELIST_PADS, NT_DEPTH, PLATE_C0, PLATE_C1, PLATE_POLY, PLATE_R0, PLATE_R1, PLATE_X0, PLATE_X1, PLATE_Y0, PLATE_Y1, SCREENS, SCREEN_INNER, ntGrid, ntIso } from './layout-nt';
import type { NtCtx, NtLayer } from './layer';
import { ensureNtTexture } from './textures';
import { WIDE_OX } from '../mobile';

type Img = Phaser.GameObjects.Image;
type Bob = Phaser.GameObjects.Bob;

const Z = {
  floorTint: NT_DEPTH.platform + 1.4745,
  sweep: NT_DEPTH.platform + 1.476,
  caustic: NT_DEPTH.platform + 1.4765,
  wall: NT_DEPTH.platform + 1.477,
  hallDark: NT_DEPTH.wall + 0.96,
  lantern: NT_DEPTH.wall + 0.975,
  dust: NT_DEPTH.wallLights + 0.6,
  airFx: NT_DEPTH.crowdFx + 0.5,
  daisAlarm: NT_DEPTH.pads + 0.06,
  tile: NT_DEPTH.floor + 0.34,
  ember: NT_DEPTH.floor + 0.4,
  spark: NT_DEPTH.platform + 1.52,
  screenFx: NT_DEPTH.screens + 0.5,
} as const;

const KEY = {
  band: (p: number): string => `nt:react:band:${p}`,
  tint: 'nt:react:lowtint',
  wall: (p: number): string => `nt:react:wall:${p}`,
  dais: (p: number): string => `nt:react:dais:${p}`,
  zline: (s: ZoneShape): string => `nt:react:zline:${s}`,
  fx: 'nt:react:fx',
} as const;

// ---------------------------------------------------------------- tuning (QA: window.__neon.ntReact)

/** The sweep band's width across the stage (tiles of the 7×5 reference grid) and its levels, leading edge first. */
const BAND_W = 1.25;
const BAND_LEVELS: readonly [number, number][] = [
  [0.1, 1],
  [0.3, 0.62],
  [0.55, 0.38],
  [0.8, 0.2],
  [1.01, 0.09],
];
const SWEEP = { delay: 90, ms: 680, alpha: 0.5 } as const;
/** The low-LP pulse: period, the stepped envelope (fraction of the period → level 0..2). */
const ALARM_MS = 2400;
const alarmLevel = (u: number): 0 | 1 | 2 => (u < 0.1 ? 1 : u < 0.26 ? 2 : u < 0.4 ? 1 : 0);
const ALARM_ALPHA = { wall: [0.12, 0.38, 0.62], dais: [0.14, 0.4, 0.66], floor: [0.05, 0.1, 0.16] } as const;
/** Shockwave front speed (iso px / ms; iso distance = hypot(dx, 2·dy)) and the flash's stepped decay per tile. */
const SHOCK_SPEED = 0.5;
const tileStep = (a: number): number => (a < 0 ? 0 : a < 50 ? 3 : a < 120 ? 2 : a < 220 ? 1 : 0);

// ---------------------------------------------------------------- masks (pure)

/** Stage-top parallelogram band (c ∈ [C0, C1], r ∈ [r0, r0 + BAND_W]) at r0 = 0: texture size and its top-left. */
const BAND_BOX = { w: Math.round((PLATE_C1 - PLATE_C0 + BAND_W) * 32), h: Math.round((PLATE_C1 - PLATE_C0 + BAND_W) * 16) };
function bandTopLeft(r0: number): { x: number; y: number } {
  return { x: Math.round(288 + (PLATE_C0 - r0 - BAND_W) * 32), y: Math.round(80 + (PLATE_C0 + r0) * 16) };
}

/** `p` 0: the leading edge at low r (P1 sweeps toward the far side); 1: at high r (P2 sweeps toward the near side). */
function paintBand(p: 0 | 1): PixelCanvas {
  const c = new PixelCanvas(BAND_BOX.w, BAND_BOX.h);
  const o = bandTopLeft(0);
  for (let j = 0; j < c.h; j++)
    for (let i = 0; i < c.w; i++) {
      const [gc, gr] = ntGrid(o.x + i + 0.5, o.y + j + 0.5);
      if (gc < PLATE_C0 || gc > PLATE_C1 || gr < 0 || gr > BAND_W) continue;
      const u = p === 0 ? gr / BAND_W : 1 - gr / BAND_W;
      const lv = BAND_LEVELS.find(([e]) => u < e)?.[1] ?? 0;
      const v = Math.round(255 * lv);
      const k = (j * c.w + i) * 4;
      c.data[k] = c.data[k + 1] = c.data[k + 2] = v;
      c.data[k + 3] = 255;
    }
  return c;
}

const onStage = (x: number, y: number): boolean => {
  if (x < PLATE_X0 || x >= PLATE_X1 || y < PLATE_Y0 || y >= PLATE_Y1) return false;
  const [gc, gr] = ntGrid(x + 0.5, y + 0.5);
  return gc >= PLATE_C0 && gc <= PLATE_C1 && gr >= PLATE_R0 && gr <= PLATE_R1;
};

/** The low-LP floor tint of P1's stage edge (three flat bands from the edge inward); P2's is this rotated 180°. */
const TINT_BOX = (() => {
  let x0 = 640;
  let y0 = 360;
  let x1 = 0;
  let y1 = 0;
  for (let y = PLATE_Y0; y < PLATE_Y1; y++)
    for (let x = PLATE_X0; x < PLATE_X1; x++) {
      if (!onStage(x, y)) continue;
      if (ntGrid(x + 0.5, y + 0.5)[1] < PLATE_R1 - 3) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
})();
function paintLowTint(): PixelCanvas {
  const c = new PixelCanvas(TINT_BOX.w, TINT_BOX.h);
  for (let j = 0; j < c.h; j++)
    for (let i = 0; i < c.w; i++) {
      const x = TINT_BOX.x + i;
      const y = TINT_BOX.y + j;
      if (!onStage(x, y)) continue;
      const d = PLATE_R1 - ntGrid(x + 0.5, y + 0.5)[1];
      const lv = d < 0.75 ? 1 : d < 1.75 ? 0.6 : d < 3 ? 0.28 : 0;
      if (!lv) continue;
      const k = (j * c.w + i) * 4;
      c.data[k] = c.data[k + 1] = c.data[k + 2] = Math.round(255 * lv);
      c.data[k + 3] = 255;
    }
  return c;
}

/** White mask of the pixels of `px` (w × h) whose colour is in `levels` (colour → level 0..1), cropped to their bounds. */
function maskOf(px: Uint8ClampedArray, w: number, h: number, levels: Map<number, number>): { canvas: PixelCanvas; x: number; y: number } | null {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const o = (j * w + i) * 4;
      if (px[o + 3] < 128 || !levels.has((px[o] << 16) | (px[o + 1] << 8) | px[o + 2])) continue;
      x0 = Math.min(x0, i);
      y0 = Math.min(y0, j);
      x1 = Math.max(x1, i);
      y1 = Math.max(y1, j);
    }
  if (x1 < 0) return null;
  const c = new PixelCanvas(x1 - x0 + 1, y1 - y0 + 1);
  for (let j = y0; j <= y1; j++)
    for (let i = x0; i <= x1; i++) {
      const o = (j * w + i) * 4;
      if (px[o + 3] < 128) continue;
      const lv = levels.get((px[o] << 16) | (px[o + 1] << 8) | px[o + 2]);
      if (lv === undefined) continue;
      const k = ((j - y0) * c.w + (i - x0)) * 4;
      c.data[k] = c.data[k + 1] = c.data[k + 2] = Math.round(255 * lv);
      c.data[k + 3] = 255;
    }
  return { canvas: c, x: x0, y: y0 };
}

// ---------------------------------------------------------------- particle frames

/** The tiny particle frames (one atlas): embers, motes, confetti, caustic glints, dust, sparks. */
function paintFx(): { canvas: PixelCanvas; frames: Map<string, { x: number; y: number; w: number; h: number }> } {
  const parts: [string, PixelCanvas][] = [];
  const dot = (name: string, rows: readonly string[], key: Record<string, number>): void => {
    const c = new PixelCanvas(Math.max(...rows.map((r) => r.length)), rows.length);
    rows.forEach((r, j) => [...r].forEach((ch, i) => key[ch] !== undefined && c.set(i, j, key[ch])));
    parts.push([name, c]);
  };
  // embers (bright → dying): a 2-px hot ember, then 1-px tones
  dot('e3', ['a', 'b'], { a: PAL.fire4, b: PAL.fire3 });
  dot('e2', ['a'], { a: PAL.fire3 });
  dot('e1', ['a'], { a: PAL.fire2 });
  dot('e0', ['a'], { a: PAL.fire1 });
  // violet motes (a 3-px plus at its brightest)
  dot('v2', ['.a.', 'aba', '.a.'], { a: PAL.void3, b: PAL.void4 });
  dot('v1', ['a'], { a: PAL.void3 });
  dot('v0', ['a'], { a: PAL.void2 });
  // confetti: six palette colours, three faces of the flutter (flat, on edge, the other flat)
  const CONF = [RAMPS.gold, RAMPS.crim, RAMPS.cyan, RAMPS.leaf, RAMPS.mag, RAMPS.teal];
  CONF.forEach((r, k) => {
    // a 2 × 2 paper square lit on top, turning edge-on (2 × 1), and its back face (darker)
    dot(`c${k}a`, ['aa', 'bb'], { a: r[4], b: r[3] });
    dot(`c${k}b`, ['ab'], { a: r[3], b: r[2] });
    dot(`c${k}c`, ['bb', 'cc'], { b: r[3], c: r[2] });
  });
  // caustic glints (teal, a little web line that forms and breaks)
  dot('q0', ['a'], { a: PAL.teal2 });
  dot('q1', ['aab'], { a: PAL.teal2, b: PAL.teal3 });
  dot('q2', ['..bb..', 'aa..ba'], { a: PAL.teal2, b: PAL.teal3 });
  dot('q3', ['..cbb.', 'bb...c'], { b: PAL.teal3, c: PAL.teal4 });
  dot('q4', ['...bb', 'aab..'], { a: PAL.teal2, b: PAL.teal3 });
  // dust in the torch light, sparks
  dot('d0', ['a'], { a: PAL.stone3 });
  dot('d1', ['a'], { a: PAL.earth3 });
  dot('s0', ['a'], { a: PAL.fire4 });
  dot('s1', ['a'], { a: PAL.fire3 });
  dot('s2', ['a'], { a: PAL.fire2 });
  // the screen glitch: a 1-px line (stretched) and a 3-px block
  dot('g0', ['a'], { a: PAL.white });
  // lantern warmth (festival): small paper lanterns glow
  // (light only: the torches' baked halos, tinted — see the layer)
  const W = 64;
  let x = 0;
  let y = 0;
  let rowH = 0;
  const frames = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const [n, c] of parts) {
    if (x + c.w > W) {
      x = 0;
      y += rowH + 1;
      rowH = 0;
    }
    frames.set(n, { x, y, w: c.w, h: c.h });
    x += c.w + 1;
    rowH = Math.max(rowH, c.h);
  }
  const canvas = new PixelCanvas(W, y + rowH);
  for (const [n, c] of parts) canvas.blit(c, frames.get(n)!.x, frames.get(n)!.y);
  return { canvas, frames };
}

/** A zone outline mask with a 1-px half-bright spill round it (the flash reads as light on the stone, not a thin wire). */
function haloLine(m: PixelCanvas): PixelCanvas {
  const c = new PixelCanvas(m.w, m.h);
  const on = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < m.w && j < m.h && m.data[(j * m.w + i) * 4 + 3] > 0;
  for (let j = 0; j < m.h; j++)
    for (let i = 0; i < m.w; i++) {
      const k = (j * m.w + i) * 4;
      const v = on(i, j) ? 255 : on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1) ? 96 : 0;
      if (!v) continue;
      c.data[k] = c.data[k + 1] = c.data[k + 2] = v;
      c.data[k + 3] = 255;
    }
  return c;
}

/** A small deterministic hash (0 … 1). */
function h01(a: number, b: number, c = 0): number {
  let h = Math.imul(a ^ 0x2c1b3c6d, 0x297a2d39) ^ Math.imul(b + 0x51ed27, 0x85ebca6b) ^ Math.imul(c + 0x3c6ef372, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- the layer

interface Wave {
  x: number;
  y: number;
  t0: number;
  reach: number;
  strength: number;
  color: number;
}

interface Tile {
  img: Img;
  x: number;
  y: number;
  shown: number;
}

interface Particle {
  bob: Bob;
  t0: number;
  life: number;
  x: number;
  y: number;
  /** per-kind parameters (rise / fall distance, sway amplitude, frame set) */
  a: number;
  b: number;
  k: number;
  key: string;
}

export function createReactLayer(ctx: NtCtx): NtLayer {
  const scene = ctx.scene;
  const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => ctx.add(o);
  const ADD = Phaser.BlendModes.ADD;
  const MUL = Phaser.BlendModes.MULTIPLY;

  // ---- textures
  const bandKeys = [0, 1].map((p) => ensureNtTexture(scene, 'react', KEY.band(p), () => paintBand(p as 0 | 1)));
  const tintKey = ensureNtTexture(scene, 'react', KEY.tint, paintLowTint);
  const fxArt = paintFx();
  const fxKey = ensureNtTexture(scene, 'react', KEY.fx, () => fxArt.canvas);
  {
    const tex = scene.textures.get(fxKey);
    for (const [n, r] of fxArt.frames) if (!tex.has(n)) tex.add(n, 0, r.x, r.y, r.w, r.h);
  }
  const lineKeys: Record<ZoneShape, string> = {
    slot: ensureNtTexture(scene, 'react', KEY.zline('slot'), () => haloLine(zoneShapeMask('slot', 'line'))),
    seal: ensureNtTexture(scene, 'react', KEY.zline('seal'), () => haloLine(zoneShapeMask('seal', 'line'))),
    pile: ensureNtTexture(scene, 'react', KEY.zline('pile'), () => haloLine(zoneShapeMask('pile', 'line'))),
  };

  // the side walls' owner-colour light (strip, windows) as masks, cut from the stage art itself
  const stagePx = scene.textures.exists(NT_PLATFORM_KEY) ? frameRGBA(scene.textures.get(NT_PLATFORM_KEY).get()) : null;
  const walls = ([0, 1] as const).map((p) => {
    if (!stagePx) return null;
    const T = STRIP_TONES[p];
    const lv = new Map<number, number>([
      [T[4], 1],
      [T[2], 0.75],
      [T[3], 0.45],
    ]);
    const m = maskOf(stagePx, PLATFORM_BOX.w, PLATFORM_BOX.h, lv);
    if (!m) return null;
    const key = ensureNtTexture(scene, 'react', KEY.wall(p), () => m.canvas);
    const x = PLATFORM_BOX.x + m.x;
    const y = PLATFORM_BOX.y + m.y;
    const lift = add(scene.add.image(x, y, key).setOrigin(0).setDepth(Z.wall).setBlendMode(ADD).setTint(PLAYER_RAMP[p][4]).setVisible(false));
    const alarm = add(scene.add.image(x, y, key).setOrigin(0).setDepth(Z.wall + 0.0001).setTint(p === 0 ? PAL.crim3 : PAL.crim4).setVisible(false));
    return { lift, alarm, x, w: m.canvas.w, h: m.canvas.h, shown: '' };
  });

  // the daises' ring + owner lines (the brightest breathing frame), for the alarm
  const daises = ([0, 1] as const).map((p) => {
    const tex = scene.textures.exists(NT_PADS_KEY) ? scene.textures.get(NT_PADS_KEY) : null;
    const fr = tex && tex.has(padFrame(p, 3)) ? frameRGBA(tex.get(padFrame(p, 3))) : null;
    if (!fr) return null;
    const ramp = p === 0 ? NT_PAL.blue : NT_PAL.red;
    const lv = new Map<number, number>([
      [ramp[4], 1],
      [ramp[3], 1],
      [ramp[2], 0.7],
      [ramp[1], 0.4],
    ]);
    const m = maskOf(fr, PAD_CANVAS.w, PAD_CANVAS.h, lv);
    if (!m) return null;
    const key = ensureNtTexture(scene, 'react', KEY.dais(p), () => m.canvas);
    const r = DUELIST_PADS[p];
    return add(
      scene.add
        .image(r.x + 28 - PAD_CANVAS.cx + m.x, r.y + 14 - PAD_CANVAS.cy + m.y, key)
        .setOrigin(0)
        .setDepth(Z.daisAlarm)
        .setTint(p === 0 ? PAL.crim3 : PAL.crim4)
        .setVisible(false),
    );
  });

  // ---- turn sweep
  const band = add(scene.add.image(0, 0, bandKeys[0]).setOrigin(0).setDepth(Z.sweep).setBlendMode(ADD).setVisible(false));
  const sweep = { p: 0 as PlayerId, at: -1e9, last: '' };
  const lifts = [-1e9, -1e9];

  // ---- low LP
  const tints = ([0, 1] as const).map((p) => {
    const img = add(scene.add.image(TINT_BOX.x, TINT_BOX.y, tintKey).setOrigin(0).setDepth(Z.floorTint).setBlendMode(ADD).setTint(PAL.crim2).setVisible(false));
    if (p === 1) img.setFlip(true, true).setPosition(640 - TINT_BOX.x - TINT_BOX.w, 320 - TINT_BOX.y - TINT_BOX.h);
    return img;
  });
  const alarm = [
    { on: false, since: 0, beats: 0, lastBeat: -1, lp: -1, shown: -1 },
    { on: false, since: 0, beats: 0, lastBeat: -1, lp: -1, shown: -1 },
  ];
  let nextLpPoll = 0;

  // ---- shockwaves
  const tiles: Tile[] = calmZones()
    .filter((z) => BANISH_PAD || z.spot !== 'banish')
    .map((z) => {
      const c = zoneXY(z.player, z.spot, z.index);
      const shape: ZoneShape = z.spot === 'field' ? 'seal' : z.spot === 'deck' || z.spot === 'graveyard' ? 'pile' : 'slot';
      const img = add(scene.add.image(Math.round(c.x) - 32, Math.round(c.y) - 16, lineKeys[shape]).setOrigin(0).setDepth(Z.tile).setBlendMode(ADD).setVisible(false));
      return { img, x: c.x, y: c.y, shown: -1 };
    });
  const waves: Wave[] = [];
  let lastBattle: { at: number; x: number; y: number; defender: PlayerId } | null = null;

  // ---- field ambience
  const field = fieldThemeWatcher(scene);
  let theme: Exclude<SealTheme, 'none'> | null = null;
  let themeK = 0; // 0 … 4 notches in
  let themeStepAt = 0;
  const hallDark = add(scene.add.rectangle(-16 - WIDE_OX, -616, 672 + WIDE_OX * 2, 992, PAL.mist).setOrigin(0).setDepth(Z.hallDark).setBlendMode(MUL).setVisible(false));
  // festival: the torches' baked light halos once more, warm (lantern light)
  const lantern = scene.textures.exists('nt:v4light:backglow:1')
    ? add(scene.add.image(-16, -16, 'nt:v4light:backglow:1').setOrigin(0).setDepth(Z.lantern).setBlendMode(ADD).setTint(PAL.gold3).setVisible(false))
    : null;
  const fxGround = add(scene.add.blitter(0, 0, fxKey).setDepth(Z.caustic));
  const fxFloor = add(scene.add.blitter(0, 0, fxKey).setDepth(Z.ember));
  const fxAir = add(scene.add.blitter(0, 0, fxKey).setDepth(Z.airFx));
  const fxDust = add(scene.add.blitter(0, 0, fxKey).setDepth(Z.dust));
  const fxSpark = add(scene.add.blitter(0, 0, fxKey).setDepth(Z.spark));
  const pool = (b: Phaser.GameObjects.Blitter, n: number, frame: string): Particle[] =>
    Array.from({ length: n }, () => {
      const bob = b.create(0, 0, frame);
      bob.visible = false;
      return { bob, t0: -1, life: 1, x: 0, y: 0, a: 0, b: 0, k: 0, key: '' };
    });
  const embers = pool(fxFloor, 7, 'e2');
  const caustics = pool(fxGround, 44, 'q0');
  const motes = pool(fxAir, 14, 'v1');
  const confetti = pool(fxAir, 34, 'c0a');
  const dust = pool(fxDust, BRICK_TORCHES.length * 2, 'd0');
  const sparks = pool(fxSpark, 4, 's0');
  // the caustics' places: hashed points on the stage top (fixed: the light plays on the same stone)
  const causticAt: { x: number; y: number }[] = [];
  for (let k = 0; causticAt.length < caustics.length && k < 400; k++) {
    const x = Math.floor(PLATE_X0 + 8 + h01(k, 1) * (PLATE_X1 - PLATE_X0 - 16));
    const y = Math.floor(PLATE_Y0 + 6 + h01(k, 2) * (PLATE_Y1 - PLATE_Y0 - 12));
    if (onStage(x, y) && onStage(x + 5, y + 2) && onStage(x - 2, y - 2)) causticAt.push({ x, y });
  }
  // the ember spawn line: the top edge of the stage's visible walls (near-left long edge, near flat edge, near-right edge)
  const wallTop: { x: number; y: number }[] = [];
  {
    const seg = (a: { x: number; y: number }, b: { x: number; y: number }): void => {
      const n = Math.max(1, Math.round(Math.abs(b.x - a.x) / 6));
      for (let i = 0; i <= n; i++) wallTop.push({ x: Math.round(a.x + ((b.x - a.x) * i) / n), y: Math.round(a.y + ((b.y - a.y) * i) / n) });
    };
    // arena v5 step 2: the visible wall tops of PLATE_POLY (the near-left edge with P1's tab, the near-right edge)
    const P = PLATE_POLY.map(([c, r]) => ntIso(c, r));
    const n = P.length;
    for (let i = 0; i < n; i++) {
      const a = P[i];
      const b = P[(i + 1) % n];
      // a wall faces the camera when the edge runs left → right along the bottom of the outline (clockwise: b.x < a.x, going back)
      if (b.x < a.x && Math.abs(b.y - a.y) > 0 && a.y > 140) seg({ x: Math.round(b.x), y: Math.round(b.y) }, { x: Math.round(a.x), y: Math.round(a.y) });
    }
  }

  // ---- idle life: the screen glitch
  const glitchLines = [0, 1, 2].map(() => add(scene.add.image(0, 0, TEX.px1).setOrigin(0).setDepth(Z.screenFx).setVisible(false)));
  const glitch = { at: -1e9, side: 0, seed: 0, next: 7000 };

  let lights = true;
  let onAt = 0;
  let active: PlayerId | null = null;
  let now = 0;
  let nextAudio = 0;
  ambience.start();

  // ================================================================ reactions

  function startSweep(p: PlayerId): void {
    sweep.p = p;
    sweep.at = now + SWEEP.delay;
    sweep.last = '';
    lifts[p] = now + 40;
    sfx.play(p === 0 ? 'arenaSweepP1' : 'arenaSweepP2', { volume: 0.55 });
  }

  function updateSweep(t: number): void {
    const a = t - sweep.at;
    if (a < 0 || a > SWEEP.ms || REDUCED_MOTION) {
      if (sweep.last !== '') {
        sweep.last = '';
        band.setVisible(false);
      }
      return;
    }
    const k = a / SWEEP.ms;
    // eased travel in 1/16-tile steps (2 px, 1 px): quick from the player's edge, settling at the far one
    const e = 1 - (1 - k) * (1 - k);
    const from = sweep.p === 0 ? PLATE_R1 - BAND_W : PLATE_R0;
    const to = sweep.p === 0 ? PLATE_R0 : PLATE_R1 - BAND_W;
    const r0 = Math.round((from + (to - from) * e) * 16) / 16;
    const al = a < 40 ? 1 / 3 : a < 80 ? 2 / 3 : a > SWEEP.ms - 60 ? 1 / 3 : a > SWEEP.ms - 130 ? 2 / 3 : 1;
    const key = `${sweep.p}:${r0}:${al}`;
    if (key === sweep.last) return;
    sweep.last = key;
    const o = bandTopLeft(r0);
    const cx = Math.max(0, PLATE_X0 - o.x);
    const cy = Math.max(0, PLATE_Y0 - o.y);
    const cw = Math.min(BAND_BOX.w, PLATE_X1 - o.x) - cx;
    const ch = Math.min(BAND_BOX.h, PLATE_Y1 - o.y) - cy;
    if (cw <= 0 || ch <= 0) {
      band.setVisible(false);
      return;
    }
    band
      .setTexture(bandKeys[sweep.p])
      .setPosition(o.x, o.y)
      .setCrop(cx, cy, cw, ch)
      .setTint(PLAYER_RAMP[sweep.p][3])
      .setAlpha(SWEEP.alpha * al)
      .setVisible(true);
  }

  /** The wall strip: the turn lift (fills out from the dais both ways, then steps down) and the low-LP alarm. */
  function updateWalls(t: number): void {
    walls.forEach((w, p) => {
      if (!w) return;
      const a = t - lifts[p];
      let key = '';
      if (a >= 0 && a < 900) {
        const dx = duelistXY(p as PlayerId).x - w.x;
        const r = REDUCED_MOTION ? w.w : Math.min(w.w, Math.round((Math.min(1, a / 420) * w.w) / 4) * 4);
        const lv = a < 520 ? 0.85 : a < 640 ? 0.55 : a < 760 ? 0.3 : 0.12;
        const x0 = Math.max(0, Math.round(dx - r));
        const x1 = Math.min(w.w, Math.round(dx + r));
        key = `${x0}:${x1}:${lv}`;
        if (key !== w.shown) w.lift.setCrop(x0, 0, x1 - x0, w.h).setAlpha(lv).setVisible(x1 > x0);
      } else if (w.shown !== '') w.lift.setVisible(false);
      w.shown = key;
    });
  }

  function updateAlarm(t: number): void {
    if (t >= nextLpPoll) {
      nextLpPoll = t + 200;
      for (const p of [0, 1] as const) {
        const lp = readLp(scene, p);
        const s = alarm[p];
        const low = lights && lp !== null && lp > 0 && lp <= LOW_LP;
        if (low && !s.on) {
          s.on = true;
          s.since = t;
          s.beats = 0;
        } else if (!low && s.on) s.on = false;
        // hit again while low: the heartbeat comes back
        if (low && lp !== null && s.lp >= 0 && lp < s.lp) s.beats = 0;
        s.lp = lp ?? -1;
      }
    }
    for (const p of [0, 1] as const) {
      const s = alarm[p];
      let lv = -1;
      if (s.on) {
        const ph = t - s.since;
        const beat = Math.floor(ph / ALARM_MS);
        lv = REDUCED_MOTION ? 1 : alarmLevel((ph % ALARM_MS) / ALARM_MS);
        // the heartbeat on the pulse's peak: every beat at first, then thinner and quieter (never a nagging loop)
        if (lv === 2 && beat !== s.lastBeat) {
          s.lastBeat = beat;
          const n = s.beats++;
          const every = n < 6 ? 1 : n < 14 ? 2 : 4;
          if (n % every === 0 && !REDUCED_MOTION) sfx.play('arenaHeart', { volume: Math.max(0.16, 0.5 * Math.pow(0.93, n)), pan: p === 0 ? -0.25 : 0.25 });
        }
      }
      if (lv === s.shown) continue;
      s.shown = lv;
      const w = walls[p];
      const d = daises[p];
      if (lv < 0) {
        w?.alarm.setVisible(false);
        d?.setVisible(false);
        tints[p].setVisible(false);
        continue;
      }
      w?.alarm.setAlpha(ALARM_ALPHA.wall[lv]).setVisible(true);
      d?.setAlpha(ALARM_ALPHA.dais[lv]).setVisible(true);
      tints[p].setAlpha(ALARM_ALPHA.floor[lv]).setVisible(true);
    }
  }

  function shock(x: number, y: number, amount: number, color: number): void {
    if (!lights) return;
    const big = amount >= 1500;
    const reach = amount >= 1500 ? 330 : amount >= 600 ? 160 : 80;
    const strength = amount >= 1500 ? 1 : amount >= 600 ? 0.85 : 0.7;
    // a second event on the same spot (a battle's damage and its destroy) widens the first wave
    for (const w of waves)
      if (now - w.t0 < 300 && Math.abs(w.x - x) + Math.abs(w.y - y) < 12) {
        w.reach = Math.max(w.reach, reach);
        w.strength = Math.max(w.strength, strength);
        return;
      }
    if (waves.length >= 4) waves.shift();
    waves.push({ x, y, t0: now, reach: REDUCED_MOTION ? 1 : reach, strength, color });
    if (big && !REDUCED_MOTION) waves.push({ x, y, t0: now + 260, reach: reach * 0.75, strength: 0.55, color });
    sfx.play(big ? 'arenaShockL' : 'arenaShockS', { volume: big ? 0.6 : 0.45, pan: Math.max(-0.6, Math.min(0.6, (x - 320) / 320)) });
  }

  function updateTiles(t: number): void {
    for (let i = waves.length - 1; i >= 0; i--) if (t - waves[i].t0 > waves[i].reach / SHOCK_SPEED + 400) waves.splice(i, 1);
    for (const tl of tiles) {
      let lv = 0;
      let col: number = PAL.white;
      for (const w of waves) {
        const d = Math.hypot(tl.x - w.x, (tl.y - w.y) * 2);
        if (d > w.reach + 16) continue;
        const peak = Math.max(1, Math.ceil(w.strength * (1 - Math.max(0, d - 16) / w.reach) * 3));
        const s = Math.min(peak, tileStep(t - w.t0 - d / SHOCK_SPEED));
        if (s > lv) {
          lv = s;
          col = s >= 3 ? PAL.white : w.color;
        }
      }
      const key = lv * 0x1000000 + col;
      if (key === tl.shown) continue;
      tl.shown = key;
      if (lv === 0) tl.img.setVisible(false);
      else tl.img.setTint(col).setAlpha([0, 0.35, 0.7, 1][lv]).setVisible(true);
    }
  }

  // ---------------------------------------------------------------- particles

  function hide(list: Particle[]): void {
    for (const q of list) if (q.bob.visible) q.bob.visible = false;
  }
  function setFrame(q: Particle, f: string): void {
    if (q.key !== f) {
      q.key = f;
      q.bob.setFrame(f);
    }
  }

  function updateField(t: number): void {
    const th = lights ? field.current(t) : null;
    if (th !== null && th !== theme && themeK === 0) theme = th;
    if (t >= themeStepAt) {
      themeStepAt = t + 120;
      const goal = th !== null && th === theme ? 4 : 0;
      if (themeK !== goal) themeK += goal > themeK ? 1 : -1;
      if (themeK === 0 && th !== theme) theme = th;
      ambience.setTheme((themeK > 0 ? theme : null) ?? 'none');
    }
    const k = themeK / 4;
    const motion = !REDUCED_MOTION;
    // ---- shadow cavern: the hall a notch darker, toward violet (multiply, four stepped notches)
    const dark = theme === 'void' ? k : 0;
    hallDark.setVisible(dark > 0).setAlpha(dark * 0.8);
    // ---- festival: lantern light on the torches' pools, breathing in two flat steps
    if (lantern) {
      const on = theme === 'gold' ? k : 0;
      const breath = Math.floor(t / 900) % 3 === 0 ? 0.5 : 0.4;
      lantern.setVisible(on > 0).setAlpha(on * breath);
    }
    // ---- volcano embers
    if (theme === 'fire' && k > 0 && motion)
      embers.forEach((q, i) => {
        const period = 1700 + i * 230;
        const u = t + i * 613;
        const lap = Math.floor(u / period);
        const f = (u - lap * period) / period;
        const start = wallTop[Math.floor(h01(i, lap, 3) * wallTop.length)];
        const rise = 16 + Math.floor(h01(i, lap, 4) * 22);
        const x = start.x + Math.round(Math.sin(f * 6 + i) * 2);
        const y = start.y - 2 - Math.floor(f * rise);
        // a third of the laps rest (sparse), the rest fade e3 → e0 as they climb
        const live = h01(i, lap, 5) < 0.66 * k;
        q.bob.visible = live;
        if (!live) return;
        setFrame(q, f < 0.2 ? 'e3' : f < 0.5 ? 'e2' : f < 0.8 ? 'e1' : 'e0');
        q.bob.x = x;
        q.bob.y = y;
      });
    else hide(embers);
    // ---- tidal bay caustics: each glint forms, peaks and breaks on its own period
    if (theme === 'water' && k > 0 && motion)
      caustics.forEach((q, i) => {
        const at = causticAt[i];
        if (!at) return;
        const period = 1400 + Math.floor(h01(i, 7) * 1100);
        const f = ((t + h01(i, 8) * period) % period) / period;
        const lap = Math.floor((t + h01(i, 8) * period) / period);
        const seq = ['q0', 'q1', 'q2', 'q3', 'q4', 'q1', 'q0'];
        const s = Math.floor(f * 10);
        const live = s < seq.length && h01(i, lap, 9) < 0.5 + 0.5 * k;
        q.bob.visible = live;
        if (!live) return;
        setFrame(q, seq[s]);
        // the glint drifts a pixel per lap (the light moves with the water)
        q.bob.x = at.x + (lap % 3) - 1;
        q.bob.y = at.y + ((lap >> 1) % 2);
      });
    else hide(caustics);
    // ---- shadow cavern motes: drifting up and sideways through the hall air at both sides and above the far wall
    if (theme === 'void' && k > 0 && motion)
      motes.forEach((q, i) => {
        const period = 5200 + i * 410;
        const u = t + i * 1777;
        const lap = Math.floor(u / period);
        const f = (u - lap * period) / period;
        const side = i % 2 === 0;
        const x0 = side ? 8 + h01(i, lap, 1) * 104 : 528 + h01(i, lap, 1) * 104;
        const y0 = 120 + h01(i, lap, 2) * 150;
        q.bob.visible = h01(i, lap, 3) < 0.8 * k;
        if (!q.bob.visible) return;
        q.bob.x = Math.round(x0 + Math.sin(f * 4 + i) * 6);
        q.bob.y = Math.round(y0 - f * 46);
        setFrame(q, f < 0.12 || f > 0.88 ? 'v0' : f < 0.25 || f > 0.75 ? 'v1' : 'v2');
      });
    else hide(motes);
    // ---- festival confetti: falling behind the stage, fluttering (three faces), swaying
    if (theme === 'gold' && k > 0 && motion)
      confetti.forEach((q, i) => {
        const period = 4200 + (i % 7) * 520;
        const u = t + i * 911;
        const lap = Math.floor(u / period);
        const f = (u - lap * period) / period;
        const x0 = h01(i, lap, 1) * 640;
        q.bob.visible = h01(i, lap, 2) < 0.85 * k;
        if (!q.bob.visible) return;
        q.bob.x = Math.round(x0 + Math.sin(f * 7 + i) * 8);
        q.bob.y = Math.round(-4 + f * 250);
        const col = Math.floor(h01(i, lap, 3) * 6);
        const face = ['a', 'b', 'c', 'b'][Math.floor((t + i * 37) / 140) % 4];
        setFrame(q, `c${col}${face}`);
      });
    else hide(confetti);
  }

  function updateIdle(t: number): void {
    const motion = !REDUCED_MOTION && lights;
    // dust turning in the wall torches' light: two motes per torch, each visible part of its slow lap
    if (motion)
      dust.forEach((q, i) => {
        const tc = BRICK_TORCHES[i >> 1];
        const period = 6400 + i * 530;
        const u = t + i * 2311;
        const lap = Math.floor(u / period);
        const f = (u - lap * period) / period;
        const live = f > 0.1 && f < 0.85 && h01(i, lap, 4) < 0.7;
        q.bob.visible = live;
        if (!live) return;
        q.bob.x = Math.round(tc.x - 18 + h01(i, lap, 5) * 36 + Math.sin(f * 5 + i) * 4);
        q.bob.y = Math.round(tc.y + 4 + h01(i, lap, 6) * 22 - f * 10);
        setFrame(q, f > 0.35 && f < 0.6 && i % 2 === 0 ? 'd1' : 'd0');
      });
    else hide(dust);
    // a spark leaves a torch / brazier now and then (one at a time per slot, rare)
    if (motion)
      sparks.forEach((q, i) => {
        const period = 2600 + i * 900;
        const u = t + i * 1300;
        const lap = Math.floor(u / period);
        const f = (u - lap * period) / 600; // 600 ms of flight at the start of a lap
        const src = Math.floor(h01(i, lap, 1) * (BRICK_TORCHES.length + BRAZIERS.length));
        const live = f < 1 && h01(i, lap, 2) < 0.45;
        q.bob.visible = live;
        if (!live) return;
        const fx = src < BRICK_TORCHES.length ? BRICK_TORCHES[src].x : BRAZIERS[src - BRICK_TORCHES.length].x;
        const fy = src < BRICK_TORCHES.length ? BRICK_TORCHES[src].y - 3 : BRAZIERS[src - BRICK_TORCHES.length].y - BRAZIER.h + 1 + BRAZIER.flameY - 4;
        const dir = h01(i, lap, 3) < 0.5 ? -1 : 1;
        q.bob.x = Math.round(fx + dir * f * (3 + h01(i, lap, 4) * 4));
        q.bob.y = Math.round(fy - f * (7 + h01(i, lap, 5) * 8) + f * f * 3);
        setFrame(q, f < 0.35 ? 's0' : f < 0.7 ? 's1' : 's2');
      });
    else hide(sparks);
    // a portrait screen glitches for two frames every ~10 s: a bright line slips, a dark one tears under it
    if (motion && t >= glitch.next) {
      glitch.at = t;
      glitch.side = Math.floor(h01(Math.floor(t), 11) * 2);
      glitch.seed = Math.floor(t);
      glitch.next = t + 8500 + h01(Math.floor(t), 12) * 7000;
      sfx.play('arenaGlitch', { volume: 0.07, pan: glitch.side === 0 ? -0.5 : 0.5 });
    }
    const ga = t - glitch.at;
    const on = motion && ga >= 0 && ga < 140;
    glitchLines.forEach((g, i) => {
      if (!on) {
        if (g.visible) g.setVisible(false);
        return;
      }
      const r = SCREENS[glitch.side];
      const ix = r.x + Math.round((r.w - SCREEN_INNER.w) / 2);
      const iy = r.y + Math.round((r.h - SCREEN_INNER.h) / 2);
      const fr = ga < 70 ? 0 : 1;
      const row = Math.floor(h01(glitch.seed, i, fr) * (SCREEN_INNER.h - 2));
      const w = 10 + Math.floor(h01(glitch.seed, i + 5, fr) * (SCREEN_INNER.w - 10));
      const x = Math.floor(h01(glitch.seed, i + 9, fr) * (SCREEN_INNER.w - w));
      const ramp = PLAYER_RAMP[glitch.side as PlayerId];
      g.setPosition(ix + x, iy + row)
        .setScale(w, 1)
        .setTint(i === 2 ? PAL.ink : ramp[4])
        .setAlpha(i === 2 ? 0.7 : 0.6)
        .setVisible(i < 2 || fr === 1);
    });
  }

  // ================================================================ debug (QA)

  const debug = {
    sweep: (p: PlayerId): void => startSweep(p),
    shock: (p: PlayerId, spot: BoardSpot, index: number, amount: number): void => {
      const c = spot === 'banish' ? duelistXY(p) : zoneXY(p, spot, index);
      shock(c.x, c.y, amount, PLAYER_RAMP[p][3]);
    },
    glitch: (): void => {
      glitch.next = now;
    },
    state: () => ({ active, theme, themeK, conf: confetti.filter((q) => q.bob.visible).map((q) => [q.bob.x, q.bob.y, q.key]).slice(0, 4), lantern: lantern ? [lantern.visible, lantern.alpha] : null, alarm: alarm.map((a) => ({ ...a })), waves: waves.length }),
  };
  const neon = (globalThis as { __neon?: Record<string, unknown> }).__neon;
  if (neon) neon.ntReact = debug;

  return {
    name: 'react',
    owner: 'C',
    setActivePlayer(p, animate = true) {
      if (p !== null && p !== active && active !== null && animate && lights && now >= onAt) startSweep(p);
      active = p;
    },
    setLights(on, animate) {
      lights = on;
      onAt = on ? now + (animate ? 1200 : 0) : 0;
      return Promise.resolve();
    },
    onGameEvent(ev: GameEvent) {
      if (ev.type === 'battle') {
        const defender = (1 - ev.player) as PlayerId;
        const c = ev.targetZone === null ? duelistXY(defender) : zoneXY(defender, 'monster', ev.targetZone);
        lastBattle = { at: now, x: c.x, y: c.y, defender };
      } else if (ev.type === 'damage') {
        const b = ev.source === 'battle' && lastBattle && now - lastBattle.at < 6000 && lastBattle.defender === ev.player ? lastBattle : null;
        const c = b ?? duelistXY(ev.player);
        shock(c.x, c.y, ev.amount, PLAYER_RAMP[ev.player][3]);
      } else if (ev.type === 'destroy') {
        const spot: BoardSpot = ev.location;
        const c = zoneXY(ev.player, spot, ev.zone);
        shock(c.x, c.y, ev.location === 'monster' ? 900 : 400, PLAYER_RAMP[ev.player][3]);
      }
    },
    tick(_dt, t) {
      now = t;
      if (t >= nextAudio) {
        nextAudio = t + 500;
        ambience.update();
      }
      updateSweep(t);
      updateWalls(t);
      updateAlarm(t);
      updateTiles(t);
      updateField(t);
      updateIdle(t);
    },
    destroy() {
      ambience.stop(500);
      const n = (globalThis as { __neon?: Record<string, unknown> }).__neon;
      if (n && n.ntReact === debug) delete n.ntReact;
    },
  };
}
