// Art Lab C — arena: the ORIGINAL Neon Düello night stadium (v1) around a stretched v1 board.
//
// Reused read-only from the game (src/art/arena.ts; BootScene has already baked the v1 set, and
// buildArenaTextures() is idempotent): the sky with its milky way, both aurora curtains, the star
// sheet, the stadium bowl (stands, roof rim light, haze, crowd lights, LED ribbon, light towers),
// the fog banks, the energy glow under the platform, the core beam / rings / thruster shafts, the
// glows and motes, and every zone tile with its glyph glow. Drawn here in the exact v1 style
// (arena-board.ts): the 5×8 slab with its podiums, hull and neon trim, the lane tiles and the
// two-row energy bridge, the pre-rotated searchlight beams and the soft floor light.
//
// Layers (LAB_DEPTH):
//   SKY         sky, aurora, twinkling stars, searchlight beams (behind the bowl)
//   BACKDROP    haze, stadium, roof rim, crowd, camera flashes, LED ribbon, lamps, far fog, far motes
//   PLATFORM    low fog, under-glow, core rings/beam, shafts, slab, trims (+glow), runners, core,
//               near fog, tiles, bridge flow, tile glows, the inlay and slot light pools
//   (FLOOR_FX - 2 / - 1: the actors' contact shadows — above every floor light here)
//   FLOOR_FX+3  near motes (below the actors: nothing of the arena ever covers a character)
// The game animates this with tweens and random timers; here every motion is a pure function of
// lab time t (update(t)), so pause / speed / seek / restart need nothing from us.
// setFx(false) hides the soft light layer and the ambient particles; the drawn arena stays.

import type Phaser from 'phaser';
import {
  AK,
  AURORA_SIZE,
  FOG_SIZE,
  RING_FRAMES,
  RING_H,
  RING_W,
  SKY_RECT,
  STADIUM_RECT,
  TOWERS,
  buildArenaTextures,
  rimY,
  standsBottomY,
  texOrigin,
} from '../../art/arena';
import { PAL, PLAYER_COLOR } from '../../art/palette';
import { PixelCanvas, mix, mulberry32 } from '../../art/pixel';
import { canvasTexture, sheetTexture } from '../../art/textures';
import { LAB_DEPTH, type LabArena } from '../types';
import {
  BEAM_A0,
  BEAM_A1,
  BEAM_STEP,
  FLOW_FRAMES,
  SLAB_R,
  beamFrame,
  bridgeArt,
  bridgeFlow,
  floorPool,
  laneGlowFrames,
  laneTile,
  onBoardTop,
  slabArt,
  softGlow,
  trimLayer,
} from './arena-board';
import {
  BRIDGE_RECT,
  COLS,
  CORE_XY,
  PODIUM_XY,
  ROWS,
  SLOT_DRAGON,
  SLOT_WIZARD,
  THRUSTERS,
  backness,
  cellAt,
  hash,
  isoI,
  screenToGrid,
  trimPath,
  type XY,
} from './arena-geo';

/** The night behind everything (the sky's deepest band). */
export const BACKGROUND_C = PAL.ink;

const KEY = 'artlab:C:arena:';
const ADD = 1; // Phaser.BlendModes.ADD

type Img = Phaser.GameObjects.Image;
type TSprite = Phaser.GameObjects.TileSprite;

/** Depths inside the lab bands. */
const D = {
  sky: LAB_DEPTH.SKY,
  aurora: LAB_DEPTH.SKY + 1,
  stars: LAB_DEPTH.SKY + 2,
  beams: LAB_DEPTH.SKY + 5,
  haze: LAB_DEPTH.BACKDROP,
  stadium: LAB_DEPTH.BACKDROP + 0.5,
  rim: LAB_DEPTH.BACKDROP + 1,
  crowd: LAB_DEPTH.BACKDROP + 2,
  flashes: LAB_DEPTH.BACKDROP + 2.5,
  led: LAB_DEPTH.BACKDROP + 3,
  lamps: LAB_DEPTH.BACKDROP + 3.5,
  lampGlow: LAB_DEPTH.BACKDROP + 3.6,
  fogFar: LAB_DEPTH.BACKDROP + 5,
  motesFar: LAB_DEPTH.BACKDROP + 6,
  fogLow: LAB_DEPTH.PLATFORM,
  under: LAB_DEPTH.PLATFORM + 0.2,
  rings: LAB_DEPTH.PLATFORM + 0.4,
  coreBeam: LAB_DEPTH.PLATFORM + 0.6,
  slab: LAB_DEPTH.PLATFORM + 1,
  trim: LAB_DEPTH.PLATFORM + 1.5,
  trimGlow: LAB_DEPTH.PLATFORM + 2,
  runner: LAB_DEPTH.PLATFORM + 2.5,
  core: LAB_DEPTH.PLATFORM + 3,
  fogNear: LAB_DEPTH.PLATFORM + 3.5,
  tile: LAB_DEPTH.PLATFORM + 4,
  flow: LAB_DEPTH.PLATFORM + 4.5,
  tileGlow: LAB_DEPTH.PLATFORM + 5,
  pools: LAB_DEPTH.PLATFORM + 6,
  slotPools: LAB_DEPTH.PLATFORM + 6.5,
  motes: LAB_DEPTH.FLOOR_FX + 3,
} as const;

export function buildArenaC(scene: Phaser.Scene): LabArena {
  // the v1 arena set normally exists already (boot step 15); idempotent otherwise
  buildArenaTextures(scene);

  const objs: Phaser.GameObjects.GameObject[] = [];
  const fxObjs: (Img | TSprite)[] = [];
  const keys: string[] = [];
  const animators: ((t: number) => void)[] = [];
  let fxOn = true;
  let lastT: number | null = null;

  const tex = (name: string, pc: PixelCanvas): string => {
    const k = canvasTexture(scene, KEY + name, pc);
    keys.push(k);
    return k;
  };
  const sheet = (name: string, frames: PixelCanvas[]): string => {
    const k = sheetTexture(
      scene,
      KEY + name,
      frames[0].w,
      frames[0].h,
      frames.map((f, i) => [String(i), f] as [string, PixelCanvas]),
    );
    keys.push(k);
    return k;
  };
  const image = (x: number, y: number, key: string, depth: number, frame?: string): Img => {
    const im = scene.add.image(Math.round(x), Math.round(y), key, frame).setOrigin(0, 0).setDepth(depth);
    objs.push(im);
    return im;
  };
  /** A soft-light sprite (white texture, tinted, ADD) at an integer top-left; part of the fx layer. */
  const light = (x: number, y: number, key: string, depth: number, tint: number, alpha: number, frame?: string): Img => {
    const im = image(x, y, key, depth, frame).setTint(tint).setBlendMode(ADD).setAlpha(alpha);
    fxObjs.push(im);
    return im;
  };
  const tiled = (x: number, y: number, w: number, h: number, key: string, depth: number): TSprite => {
    const ts = scene.add.tileSprite(x, y, w, h, key).setOrigin(0, 0).setDepth(depth);
    objs.push(ts);
    return ts;
  };
  const wave = (t: number, period: number, phase = 0) => 0.5 + 0.5 * Math.sin(t / period + phase);

  // ================================================================ sky
  const S = SKY_RECT;
  image(S.x, S.y, AK.sky, D.sky);
  for (let i = 0; i < 2; i++) {
    const a = tiled(S.x, -70 + i * 14, S.w, AURORA_SIZE.h, AK.aurora(i), D.aurora + i * 0.1).setBlendMode(ADD);
    a.tilePositionX = 0;
    animators.push((t) => {
      a.tilePositionX = Math.round(t * (i ? -0.0021 : 0.0035)) + (i ? 97 : 0);
      const b = wave(t, i ? 5300 : 3700, i * 2);
      a.setAlpha(i ? 0.12 + 0.12 * b : 0.16 + 0.14 * b);
    });
  }
  // bright twinkling stars — the game's own placement (mulberry32(77)), frames 0..3 of AK.star
  {
    const r = mulberry32(77);
    for (let i = 0; i < 46; i++) {
      const x = Math.floor(S.x + 8 + r() * (S.w - 16));
      const y = Math.floor(S.y + 8 + r() * (S.h - 16));
      if (y > rimY(x) - 10) continue;
      const big = i < 18;
      const speed = 0.0012 + r() * 0.003;
      const phase = r() * Math.PI * 2;
      if (y < -6 || y > 366 || x < -6 || x > 646) continue;
      const maxFrame = big ? 3 : 1;
      const base = big ? 1 : 0.8;
      const im = image(x - 3, y - 3, AK.star, D.stars, big ? '2' : '1');
      animators.push((t) => {
        const v = 0.5 + 0.5 * Math.sin(t * speed + phase);
        const f = Math.min(maxFrame, Math.floor(v * (maxFrame + 0.999)));
        im.setFrame(String(f)).setAlpha(base * (0.45 + 0.55 * v));
      });
    }
  }

  // ---- light towers: lit lamp banks, their halo, and the searchlight sweeps (pre-rotated frames)
  const nBeam = Math.round((BEAM_A1 - BEAM_A0) / BEAM_STEP) + 1;
  const beamFrames = Array.from({ length: nBeam }, (_, k) => beamFrame(BEAM_A0 + k * BEAM_STEP));
  const beamKeys = beamFrames.map((b, k) => tex(`beam${k}`, b.pc));
  const lampGlow = tex('lampglow', softGlow(23, 2.2));
  TOWERS.forEach((tw, i) => {
    image(tw.x - 6, tw.lampY - 3, AK.lamp, D.lamps);
    const g = light(tw.x - 23, tw.lampY - 23, lampGlow, D.lampGlow, PAL.gold3, 0.5);
    animators.push((t) => g.setAlpha(0.5 + 0.06 * Math.sin(t / 300 + i)));
    const bm = tw.beam;
    if (!bm) return;
    const im = light(0, 0, beamKeys[0], D.beams, bm.tint, 0.3);
    animators.push((t) => {
      const ang = bm.angle + bm.amp * Math.sin((t / bm.period + bm.phase) * Math.PI * 2);
      const left = Math.cos(ang) < 0;
      const a = left ? -Math.PI - ang : ang;
      const k = Math.max(0, Math.min(nBeam - 1, Math.round((a - BEAM_A0) / BEAM_STEP)));
      const fr = beamFrames[k];
      im.setTexture(beamKeys[k]).setFlipX(left);
      const ox = left ? fr.pc.w - fr.ox : fr.ox;
      im.setPosition(tw.x - Math.round(ox), tw.lampY - Math.round(fr.oy));
      im.setAlpha(0.3 + 0.06 * Math.sin(t / 700 + i));
    });
  });

  // ================================================================ stadium
  const R = STADIUM_RECT;
  const layer = (key: string, depth: number) => {
    const o = texOrigin(key);
    return image(o.x, o.y, key, depth);
  };
  const haze = layer(AK.haze, D.haze).setBlendMode(ADD).setTint(PAL.void1);
  fxObjs.push(haze);
  animators.push((t) => haze.setAlpha(0.75 + 0.1 * Math.sin(t / 2100)));
  image(R.x, R.y, AK.stadium, D.stadium);
  layer(AK.rimCool, D.rim);
  const crowd = [0, 1, 2].map((i) => layer(AK.crowd(i), D.crowd));
  animators.push((t) => crowd.forEach((c, i) => c.setAlpha(0.35 + 0.65 * wave(t, 1300 + i * 370, i * 2.1))));
  const led = [0, 1, 2].map((i) => layer(AK.led(i), D.led));
  animators.push((t) => {
    const ph = Math.floor(t / 120) % 3;
    led.forEach((l, i) => l.setAlpha(i === ph ? 1 : 0.18));
  });

  // crowd camera flashes: a fixed schedule (hash of the slot index) instead of the game's random timer
  {
    const SLOT = 300;
    const flashKey = tex('flash-glow', softGlow(5, 1.4, 4));
    const star = image(0, 0, AK.star, D.flashes, '2').setBlendMode(ADD);
    const glow = light(0, 0, flashKey, D.flashes, PAL.white, 0);
    fxObjs.push(star);
    animators.push((t) => {
      const n = Math.floor(t / SLOT);
      const age = t - n * SLOT - 50;
      const on = hash(n, 1, 511) < 0.5 && age >= 0 && age < 160;
      star.setVisible(fxOn && on);
      glow.setVisible(fxOn && on);
      if (!on) return;
      const leftSide = hash(n, 2, 511) < 0.5;
      const x = Math.floor(leftSide ? -40 + hash(n, 3, 511) * 190 : 480 + hash(n, 3, 511) * 200);
      const top = rimY(x) + 3;
      const bot = standsBottomY(x) - 2;
      const y = Math.floor(top + hash(n, 4, 511) * (bot - top));
      const c = hash(n, 5, 511) < 0.75 ? PAL.white : PAL.gold4;
      const k = age / 160;
      const a = 1 - k * k; // Quad.In fade
      star.setPosition(x - 3, y - 3).setTint(c).setAlpha(a);
      glow.setPosition(x - 5, y - 5).setTint(c).setAlpha(0.6 * a);
    });
  }

  // fog: far haze at the stadium floor, a bank under the platform, wisps in the foreground (v1 defs)
  const fogDefs = [
    { i: 0, y: 156, depth: D.fogFar, speed: 0.004, tint: PAL.night4, alpha: 0.42, x0: 37 },
    { i: 0, y: 196, depth: D.fogFar + 0.1, speed: -0.006, tint: PAL.night4, alpha: 0.36, x0: 211 },
    { i: 1, y: 262, depth: D.fogLow, speed: 0.009, tint: PAL.steel, alpha: 0.24, x0: 120 },
    { i: 2, y: 306, depth: D.fogNear, speed: 0.016, tint: PAL.mist, alpha: 0.13, x0: 64 },
  ];
  for (const f of fogDefs) {
    const ts = tiled(-48, f.y, 640 + 96, FOG_SIZE[f.i].h, AK.fog(f.i), f.depth).setTint(f.tint).setAlpha(f.alpha);
    animators.push((t) => {
      ts.tilePositionX = Math.round(t * f.speed) + f.x0;
    });
  }

  // ================================================================ platform
  // energy glow on the stadium floor beneath the platform (left cyan, right crimson)
  const under = light(320 - 210, 292 - 85, AK.under(false), D.under, 0xffffff, 0.7);
  animators.push((t) => under.setAlpha(0.62 + 0.18 * wave(t, 1600)));
  // the core's light falling down, its rings, the thruster shafts
  const coreBeam = light(CORE_XY.x - 20, CORE_XY.y - 6, AK.coreBeam, D.coreBeam, PAL.mist, 0.3);
  animators.push((t) => coreBeam.setAlpha(0.28 + 0.1 * wave(t, 1600)));
  const rings = [0, 1, 2].map(() => light(0, 0, AK.ringFx, D.rings, PAL.mist, 0, '0'));
  animators.push((t) => {
    for (const r of rings) r.setAlpha(0);
    const n = Math.floor(t / 1250);
    for (const m of [n, n - 1]) {
      if (m < 0) continue;
      const k = (t - m * 1250) / 1900;
      if (k < 0 || k >= 1) continue;
      rings[((m % 3) + 3) % 3]
        .setFrame(String(Math.min(RING_FRAMES - 1, Math.floor(k * RING_FRAMES))))
        .setPosition(CORE_XY.x - RING_W / 2, Math.round(CORE_XY.y + k * 34) - RING_H / 2)
        .setAlpha((1 - k) * 0.55);
    }
  });
  THRUSTERS.forEach((th, i) => {
    const base = th.cls === 0 ? PAL.cyan3 : th.cls === 1 ? PAL.crim3 : PAL.mist;
    const sh = light(th.x - 6, th.y - 1, AK.shaft, D.coreBeam, base, 0.3);
    const phase = i * 1.7;
    animators.push((t) => sh.setAlpha(0.22 + 0.16 * (0.5 + 0.5 * Math.sin(t / 310 + phase) * Math.sin(t / 830 + phase * 2))));
  });

  // the slab and its neon trim (+ an additive copy that breathes)
  const { slab, marks } = slabArt();
  image(SLAB_R.x, SLAB_R.y, tex('slab', slab), D.slab);
  for (const cls of [0, 1, 2] as const) {
    const pc = trimLayer(marks, cls);
    const b = pc.bounds();
    if (!b) continue;
    const k = tex(`trim${cls}`, pc.crop(b.x, b.y, b.w, b.h));
    image(SLAB_R.x + b.x, SLAB_R.y + b.y, k, D.trim);
    const g = light(SLAB_R.x + b.x, SLAB_R.y + b.y, k, D.trimGlow, 0xffffff, 0.08);
    const ph = cls * 1.9;
    animators.push((t) => g.setAlpha(cls === 2 ? 0.05 : 0.07 + 0.08 * wave(t, 900, ph)));
  }
  const coreGlow = light(CORE_XY.x - 17, CORE_XY.y - 17, tex('coreglow', softGlow(17, 2.2)), D.core, PAL.cyan4, 0.8);
  animators.push((t) => coreGlow.setAlpha(0.75 + 0.25 * Math.sin(t / 230)));

  // light runners racing along each side's trim (v1 shows the active player's; the lab runs both)
  for (const pl of [0, 1] as const) {
    const path = trimPath(pl);
    const seg: number[] = [0];
    for (let i = 1; i < path.length; i++) seg.push(seg[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
    const len = seg[seg.length - 1];
    const color = PLAYER_COLOR[pl];
    const head = light(0, 0, AK.dot, D.runner, mix(color, PAL.white, 0.45), 0);
    const trail = [0, 1, 2, 3, 4, 5, 6].map(() => light(0, 0, AK.mote, D.runner, color, 0));
    const at = (s: number): XY => {
      let i = 1;
      while (i < seg.length - 1 && seg[i] < s) i++;
      const a = path[i - 1];
      const b = path[i];
      const k = (s - seg[i - 1]) / Math.max(1e-6, seg[i] - seg[i - 1]);
      return { x: Math.round(a.x + (b.x - a.x) * k), y: Math.round(a.y + (b.y - a.y) * k) };
    };
    const fade = (s: number) => Math.max(0, Math.min(1, s / 30, (len - s) / 30));
    const cycle = len + 900;
    animators.push((t) => {
      const s0 = (t * 0.075 + pl * cycle * 0.5) % cycle;
      const vis = s0 <= len;
      head.setVisible(fxOn && vis);
      if (!vis) {
        for (const tr of trail) tr.setVisible(false);
        return;
      }
      const h = at(s0);
      head.setPosition(h.x - 4, h.y - 4).setAlpha(fade(s0));
      trail.forEach((tr, i) => {
        const s = s0 - (i + 1) * 4;
        tr.setVisible(fxOn && s >= 0);
        if (s < 0) return;
        const q = at(s);
        tr.setPosition(q.x - 1, q.y - 1).setAlpha(0.7 * (1 - i / trail.length) * fade(s));
      });
    });
  }

  // ================================================================ tiles
  const laneKeys = {
    0: tex('lane0', laneTile([PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4], 1)),
    1: tex('lane1', laneTile([PAL.crim0, PAL.crim1, PAL.crim2, PAL.crim3, PAL.crim4], -1)),
  } as const;
  const laneGlow = { 0: sheet('laneglow0', laneGlowFrames(1)), 1: sheet('laneglow1', laneGlowFrames(-1)) } as const;
  const LANE_STEPS = 8; // frames 0..4 = the chase (guide → studs toward the enemy), then a rest
  for (let row = 0; row < ROWS; row++)
    for (let col = 0; col < COLS; col++) {
      const cell = cellAt(col, row);
      if (!cell || cell.kind === 'bridge') continue;
      const s = isoI(col, row);
      if (cell.kind === 'zone') {
        image(s.x - 32, s.y - 16, AK.tile(cell.spot, cell.player), D.tile);
        const g = light(s.x - 32, s.y - 16, AK.tileGlow(cell.spot), D.tileGlow, PLAYER_COLOR[cell.player], 0.2);
        const phase = backness(row) * 1.1 + Math.abs(col - 2) * 0.45;
        const ban = cell.spot === 'banish';
        animators.push((t) => {
          const w = 0.5 + 0.5 * Math.sin(t / 420 - phase);
          g.setAlpha(ban ? 0.08 + 0.08 * w : 0.16 + 0.18 * w);
        });
      } else {
        const pl = cell.player;
        image(s.x - 32, s.y - 16, laneKeys[pl], D.tile);
        const g = light(s.x - 32, s.y - 16, laneGlow[pl], D.tileGlow, PLAYER_COLOR[pl], 0.3, '0');
        const off = (pl === 0 ? col : COLS - 1 - col) * 90 + pl * 420;
        animators.push((t) => {
          const step = Math.floor((t + off) / 180) % LANE_STEPS;
          g.setFrame(String(Math.min(4, step)));
          g.setAlpha(step < 5 ? 0.42 : 0.26);
        });
      }
    }
  // the two-row energy bridge and its flowing light
  image(BRIDGE_RECT.x, BRIDGE_RECT.y, tex('bridge', bridgeArt()), D.tile);
  const flowKey = sheet(
    'bridgeflow',
    Array.from({ length: FLOW_FRAMES }, (_, f) => bridgeFlow(f)),
  );
  const flow = image(BRIDGE_RECT.x, BRIDGE_RECT.y, flowKey, D.flow, '0').setBlendMode(ADD).setTint(PAL.mist);
  animators.push((t) => {
    flow.setFrame(String(Math.floor(t / 70) % FLOW_FRAMES));
    flow.setAlpha(0.75 + 0.25 * Math.sin(t / 800));
  });

  // a soft line of light along the bridge's central channel
  {
    const ch = floorPool(2, 3.5, 3.1, 0.42, 0.11, onBoardTop, 8, 1.2);
    const im = light(ch.x, ch.y, tex('pool-channel', ch.pc), D.pools, PAL.mist, 1);
    animators.push((t) => im.setAlpha(0.75 + 0.25 * Math.sin(t / 800)));
  }

  // ================================================================ soft floor light
  // each half glows faintly in its own neon (the inlays' spill), a little more light around the slots
  {
    const p1 = floorPool(2, 6.1, 3.4, 2.2, 0.1, onBoardTop);
    const p2 = floorPool(2, 0.9, 3.4, 2.2, 0.1, onBoardTop);
    const a = light(p1.x, p1.y, tex('pool-p1', p1.pc), D.pools, PAL.cyan3, 1);
    const b = light(p2.x, p2.y, tex('pool-p2', p2.pc), D.pools, PAL.crim3, 1);
    animators.push((t) => {
      a.setAlpha(0.85 + 0.15 * wave(t, 2300));
      b.setAlpha(0.85 + 0.15 * wave(t, 2300, Math.PI));
    });
    const gd = screenToGrid(SLOT_DRAGON.x, SLOT_DRAGON.y);
    const gw = screenToGrid(SLOT_WIZARD.x, SLOT_WIZARD.y);
    const sd = floorPool(gd.col, gd.row, 1.15, 0.95, 0.16, onBoardTop, 8, 1.3);
    const sw = floorPool(gw.col, gw.row, 1.15, 0.95, 0.16, onBoardTop, 8, 1.3);
    const c = light(sd.x, sd.y, tex('slot-p1', sd.pc), D.slotPools, PAL.cyan4, 1);
    const d = light(sw.x, sw.y, tex('slot-p2', sw.pc), D.slotPools, PAL.crim4, 1);
    animators.push((t) => {
      c.setAlpha(0.9 + 0.1 * wave(t, 1400));
      d.setAlpha(0.9 + 0.1 * wave(t, 1400, 1.3));
    });
  }

  // the empty duelist podiums keep their hologram pedestal humming: a soft pad light and a few
  // motes rising off the ring
  for (const pl of [0, 1] as const) {
    const c = PODIUM_XY[pl];
    const g = screenToGrid(c.x, c.y);
    const pad = floorPool(g.col, g.row, 0.62, 0.5, 0.22, onBoardTop, 6, 1.1);
    const im = light(pad.x, pad.y, tex(`pad${pl}`, pad.pc), D.pools, PLAYER_COLOR[pl], 1);
    animators.push((t) => im.setAlpha(0.7 + 0.3 * wave(t, 600, pl * 2.2) * wave(t, 1700, pl)));
    for (let i = 0; i < 4; i++) {
      const h = (j: number) => hash(i + pl * 8, j, 433);
      const m = image(0, 0, AK.mote, D.motes).setBlendMode(ADD).setTint(mix(PLAYER_COLOR[pl], PAL.white, 0.3));
      fxObjs.push(m);
      const ang = h(1) * Math.PI * 2;
      const x0 = c.x + Math.round(Math.cos(ang) * 12);
      const y0 = c.y + Math.round(Math.sin(ang) * 6);
      const per = 1900 + h(2) * 1300;
      const t0 = h(3) * per;
      const rise = 16 + h(4) * 10;
      animators.push((t) => {
        const k = ((t + t0) % per) / per;
        m.setVisible(fxOn).setPosition(x0 - 1, Math.round(y0 - rise * k) - 1).setAlpha(Math.sin(Math.PI * k) * 0.7);
      });
    }
  }

  // ================================================================ ambient motes (fx)
  const px1 = tex('px1', new PixelCanvas(1, 1).set(0, 0, 0xffffff));
  const motes = (n: number, seed: number, far: boolean) => {
    for (let i = 0; i < n; i++) {
      const h = (j: number) => hash(i, j, seed);
      const big = h(1) < (far ? 0.2 : 0.3);
      const im = image(0, 0, big ? AK.mote : px1, far ? D.motesFar : D.motes).setBlendMode(ADD);
      fxObjs.push(im);
      const x0 = far ? h(2) * 640 : 120 + h(2) * 400;
      const y0 = far ? 170 + h(3) * 190 : 150 + h(3) * 170;
      const vy = -(far ? 2 + h(4) * 4 : 3 + h(4) * 6);
      const life = far ? 5000 + h(5) * 5000 : 4000 + h(5) * 4000;
      const per = life + 600 + h(6) * 2400;
      const sway = far ? 6 + h(7) * 8 : 4 + h(7) * 6;
      const ph = h(8) * Math.PI * 2;
      const alpha = far ? 0.3 + h(9) * 0.4 : 0.35 + h(9) * 0.45;
      const t0 = h(10) * per;
      let color: number;
      if (far) color = h(11) < 0.3 ? PAL.mist : x0 < 280 ? PAL.cyan3 : x0 > 360 ? PAL.crim3 : PAL.mist;
      else {
        const g = screenToGrid(x0, y0);
        color = g.row > 4.6 ? PAL.cyan4 : g.row < 2.4 ? PAL.crim4 : PAL.mist;
      }
      im.setTint(color);
      const off = big ? 1 : 0;
      animators.push((t) => {
        const tau = (t + t0) % per;
        if (tau > life) {
          im.setVisible(false);
          return;
        }
        const k = tau / life;
        const env = Math.sin(Math.PI * Math.min(1, k * 1.15));
        const x = x0 + Math.sin(t / 900 + ph) * sway;
        const y = y0 + (vy * tau) / 1000;
        im.setVisible(fxOn).setPosition(Math.round(x) - off, Math.round(y) - off).setAlpha(Math.max(0, alpha * env));
      });
    }
  };
  motes(16, 401, false);
  motes(12, 402, true);

  const applyFx = () => {
    for (const o of fxObjs) o.setVisible(fxOn);
  };

  return {
    slots: { dragon: { ...SLOT_DRAGON }, wizard: { ...SLOT_WIZARD } },
    update(t: number) {
      lastT = t;
      for (const a of animators) a(t);
      if (!fxOn) applyFx();
    },
    setFx(on: boolean) {
      fxOn = on;
      applyFx();
      // re-pose at once: sprites that are between appearances (runners, motes, flashes) hide again
      if (lastT !== null) for (const a of animators) a(lastT);
      if (!fxOn) applyFx();
    },
    destroy() {
      for (const o of objs) o.destroy();
      objs.length = 0;
      fxObjs.length = 0;
      animators.length = 0;
      for (const k of keys) if (scene.textures.exists(k)) scene.textures.remove(k);
      keys.length = 0;
    },
  };
}
