// BoardView — the stage: night sky, stadium, floating platform and the 5×5 zone tiles, all
// gently alive (twinkling stars, sweeping searchlights, drifting fog, motes, pulsing neon).
//
//   const board = new BoardView(scene);                 // builds every layer at its DEPTH band
//   board.setActivePlayer(0);                           // that side's neon trim brightens
//   board.highlightZone(0, 'monster', 1, PAL.cyan3);    // animated target outline (null clears)
//   await board.flashTile(1, 'spellTrap', 0, PAL.mag3, 300);
//   await board.pulseSide(0);                           // turn-start wave across a side
//   const z = board.zoneAt(pointer.worldX, pointer.worldY);   // { player, spot, index } | null
//   await board.setTheme('volcano', true, 0);           // lava cracks spread from P1's field zone
//
// Ambient motion runs on scene time scaled by scene.time.timeScale, so hit-stop freezes it and
// fast-forward speeds it up together with everything else.

import Phaser from 'phaser';
import {
  AK,
  AURORA_SIZE,
  BRIDGE_RECT,
  CORE_XY,
  type ArenaTheme,
  type CrackField,
  FLOW_FRAMES,
  FOG_SIZE,
  MARCH_FRAMES,
  RING_FRAMES,
  SKY_RECT,
  SLAB_RECT,
  SMOKE_SIZE,
  STADIUM_RECT,
  THRUSTERS,
  TOWERS,
  type TrimClass,
  type ZoneHit,
  buildArenaTextures,
  buildCrackField,
  cellZone,
  paintCracks,
  rimY,
  standsBottomY,
  texOrigin,
  trimPath,
} from '../art/arena';
import { PAL, PLAYER_COLOR } from '../art/palette';
import { mix, mulberry32 } from '../art/pixel';
import type { PlayerId } from '../engine/types';
import { TEX, shake } from '../vfx/core';
import { BOARD_COLS, BOARD_ROWS, type BoardSpot, DEPTH, GAME_H, GAME_W, isoToScreen, screenToIso, zoneCell } from './layout';

export type { ArenaTheme, ZoneHit } from '../art/arena';

type Img = Phaser.GameObjects.Image;
type TSprite = Phaser.GameObjects.TileSprite;

const ADD = Phaser.BlendModes.ADD;

/** Sub-depths inside the layout DEPTH bands. */
const D = {
  sky: DEPTH.SKY,
  skyHot: DEPTH.SKY + 0.5,
  smoke: DEPTH.SKY + 1,
  aurora: DEPTH.SKY + 1.5,
  stars: DEPTH.SKY + 2,
  beams: DEPTH.SKY + 5,
  stadium: DEPTH.STADIUM,
  rim: DEPTH.STADIUM + 1,
  crowd: DEPTH.STADIUM + 2,
  flashes: DEPTH.STADIUM + 2.5,
  led: DEPTH.STADIUM + 3,
  lamps: DEPTH.STADIUM + 3.5,
  fogFar: DEPTH.STADIUM + 5,
  motesFar: DEPTH.STADIUM + 6,
  fogLow: DEPTH.PLATFORM - 5,
  under: DEPTH.PLATFORM - 4,
  rings: DEPTH.PLATFORM - 3,
  coreBeam: DEPTH.PLATFORM - 2,
  slab: DEPTH.PLATFORM,
  trim: DEPTH.PLATFORM + 1,
  trimGlow: DEPTH.PLATFORM + 2,
  runner: DEPTH.PLATFORM + 3,
  core: DEPTH.PLATFORM + 4,
  fogNear: DEPTH.PLATFORM + 6,
  tile: DEPTH.TILE,
  bridgeFlow: DEPTH.TILE + 1,
  tileGlow: DEPTH.TILE + 2,
  lava: DEPTH.TILE + 3,
  lavaGlow: DEPTH.TILE + 4,
  hlFill: DEPTH.TILE_FX,
  hlOutline: DEPTH.TILE_FX + 1,
  hlMarch: DEPTH.TILE_FX + 2,
  hlTips: DEPTH.TILE_FX + 3,
  flash: DEPTH.TILE_FX + 5,
  motesNear: DEPTH.TILE_FX + 8,
} as const;

/** Parallax scroll factors (camera pans/zooms move far layers less). */
const SF = { sky: 0.2, stadium: 0.5, fogFar: 0.6, fogNear: 1.15 } as const;

const HOT_TINT = PAL.fire3;

interface TileRec {
  col: number;
  row: number;
  zone: ZoneHit;
  img: Img;
  glow: Img;
  phase: number;
  boost: number;
  color: number;
}

interface Highlight {
  color: number;
  x: number;
  y: number;
  fill: Img;
  outline: Img;
  march: Img;
  tips: Img[];
  /** 0..1 appear / disappear */
  k: number;
  dying: boolean;
  born: number;
  sparkAt: number;
}

interface Star {
  img: Img;
  speed: number;
  phase: number;
  maxFrame: number;
  base: number;
}

interface Beam {
  img: Img;
  glow: Img;
  lamp: Img;
  tower: number;
}

interface Particle {
  img: Img;
  kind: 'mote' | 'moteFar' | 'ember' | 'ash' | 'spark';
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  sway: number;
  phase: number;
  alpha: number;
  alive: boolean;
}

interface Job {
  delay: number;
  t: number;
  dur: number;
  ease: (v: number) => number;
  fn: (k: number) => void;
  done: () => void;
}

/** 0→1→0 envelope: rise over `up`, hold, fall over `down` (k is 0..1 over the whole span). */
function envelope(k: number, up: number, hold: number, down: number): number {
  const t = k * (up + hold + down);
  if (t < up) {
    const u = t / up;
    return 1 - (1 - u) * (1 - u);
  }
  if (t < up + hold) return 1;
  const d = Math.min(1, (t - up - hold) / down);
  return 1 - d * d;
}

export interface BoardViewOptions {
  theme?: ArenaTheme;
  /** Whose turn it is (their trim glows). null = neither emphasised. */
  active?: PlayerId | null;
  /** Stadium floodlights on (default true). Use false + setLights(true) for the duel intro. */
  lights?: boolean;
  /** Origin of the volcano cracks when constructed with theme 'volcano'. */
  volcanoFrom?: PlayerId | null;
}

let instanceCounter = 0;

export class BoardView {
  readonly scene: Phaser.Scene;
  private readonly id = ++instanceCounter;
  private readonly objs: Phaser.GameObjects.GameObject[] = [];
  private readonly rnd = mulberry32(1337);
  private t = 0;
  private frame = 0;
  private destroyed = false;

  // sky
  private skyHot!: Img;
  private aurora: TSprite[] = [];
  private smoke!: TSprite;
  private stars: Star[] = [];
  // stadium
  private rimCool!: Img;
  private stadiumWarm!: Img;
  private haze!: Img;
  private stadiumDark!: Phaser.GameObjects.Rectangle;
  private rimHot!: Img;
  private crowd: Img[] = [];
  private led: Img[] = [];
  private beams: Beam[] = [];
  private towerLevel: number[] = TOWERS.map(() => 1);
  private fogs: { spr: TSprite; speed: number; cool: number; hot: number; alpha: number }[] = [];
  // platform
  private under: Img[] = [];
  private core!: Img;
  private coreBeam!: Img;
  private rings: { img: Img; age: number }[] = [];
  private shafts: { img: Img; cls: TrimClass; phase: number }[] = [];
  private ringClock = 0;
  private trims: { cool: Img; hot: Img; coolGlow: Img; hotGlow: Img }[] = [];
  private sideLevel: [number, number, number] = [0.85, 0.85, 0.8];
  private sideFlash: [number, number] = [0, 0];
  private runners: { head: Img; trail: Img[]; path: { x: number; y: number }[]; len: number; seg: number[] }[] = [];
  // tiles
  private tiles: TileRec[] = [];
  private bridgeFlow!: Img;
  private highlights = new Map<string, Highlight>();
  // particles
  private parts: Particle[] = [];
  private flashClock = 0;
  // theme
  private themeName: ArenaTheme = 'normal';
  private heat = 0; // sky / atmosphere mix
  private trimHeat = 0; // trim mix
  private lavaHeat = 0;
  private lavaAlpha = 0;
  private crack: CrackField | null = null;
  private crackKey = '';
  private crackFront = 0;
  private crackFlow = false;
  private lavaTex: Phaser.Textures.CanvasTexture | null = null;
  private lavaImgData: ImageData | null = null;
  private lavaImg: Img | null = null;
  private lavaGlow: Img | null = null;
  private themeToken = 0;
  private active: PlayerId | null = null;
  private activeToken = 0;
  /** Internal animations, advanced by tick() on scene time (deterministic under frame stepping). */
  private jobs: Job[] = [];

  constructor(scene: Phaser.Scene, opts: BoardViewOptions = {}) {
    this.scene = scene;
    buildArenaTextures(scene);
    this.buildSky();
    this.buildStadium();
    this.buildPlatform();
    this.buildTiles();
    this.buildParticles();
    this.setActivePlayer(opts.active ?? null, false);
    if (opts.lights === false) {
      this.towerLevel = TOWERS.map(() => 0);
    }
    if (opts.theme === 'volcano') void this.setTheme('volcano', false, opts.volcanoFrom ?? null);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.tick(0, 0);
  }

  // ================================================================ public API

  get theme(): ArenaTheme {
    return this.themeName;
  }

  get activePlayer(): PlayerId | null {
    return this.active;
  }

  /** Zone under a world-space point (pointer.worldX/worldY), pixel-accurate to the drawn diamonds. */
  zoneAt(x: number, y: number): ZoneHit | null {
    const g = screenToIso(Math.floor(x) + 0.5, Math.floor(y) + 0.5);
    return cellZone(Math.round(g.col), Math.round(g.row));
  }

  /** The tile image of a zone (for cinematics that want to shake / hide / tint it). */
  tileImage(player: PlayerId, spot: BoardSpot, index = 0): Img | null {
    const c = zoneCell(player, spot, index);
    return this.tiles.find((t) => t.col === c.col && t.row === c.row)?.img ?? null;
  }

  /** Animated glowing outline on a zone (valid targets, selections). color null removes it. */
  highlightZone(player: PlayerId, spot: BoardSpot, index: number, color: number | null): void {
    const key = `${player}:${spot}:${index}`;
    const cur = this.highlights.get(key);
    if (color === null) {
      if (cur) cur.dying = true;
      return;
    }
    if (cur) {
      cur.dying = false;
      if (cur.color !== color) {
        cur.color = color;
        this.tintHighlight(cur);
      }
      return;
    }
    const c = zoneCell(player, spot, index);
    const s = isoToScreen(c.col, c.row);
    const mk = (key2: string, depth: number) => this.add(this.scene.add.image(s.x, s.y, key2).setDepth(depth).setBlendMode(ADD));
    const h: Highlight = {
      color,
      x: s.x,
      y: s.y,
      fill: mk(AK.tileFill, D.hlFill),
      outline: mk(AK.hlOutline, D.hlOutline),
      march: mk(AK.hlMarch, D.hlMarch).setFrame('0'),
      tips: [AK.hlTipT, AK.hlTipL, AK.hlTipT, AK.hlTipL].map((k, i) => {
        const img = this.add(this.scene.add.image(0, 0, k).setOrigin(0).setDepth(D.hlTips).setBlendMode(ADD));
        if (i === 2) img.setFlipY(true);
        if (i === 3) img.setFlipX(true);
        return img;
      }),
      k: 0,
      dying: false,
      born: this.t,
      sparkAt: this.t + 120,
    };
    this.tintHighlight(h);
    this.highlights.set(key, h);
    this.updateHighlight(h, 0);
  }

  /** Remove every highlight. */
  clearHighlights(): void {
    for (const h of this.highlights.values()) h.dying = true;
  }

  /** A bright flash on one tile (impact, set card, effect target). Resolves when it has faded. */
  flashTile(player: PlayerId, spot: BoardSpot, index: number, color: number, ms = 320): Promise<void> {
    const c = zoneCell(player, spot, index);
    return this.flashCell(c.col, c.row, color, ms);
  }

  /** Turn-start pulse: a wave of light rolls across `player`'s tiles from their back row forward. */
  async pulseSide(player: PlayerId): Promise<void> {
    const color = this.heatColor(PLAYER_COLOR[player]);
    const jobs: Promise<void>[] = [];
    jobs.push(this.run(760, (k) => (this.sideFlash[player] = 1 - k), 'Quad.Out'));
    // ripple out from the duelist's podium
    const pod = player === 0 ? { col: 2, row: 5.35 } : { col: 2, row: -1.35 };
    this.shockwave(pod.col, pod.row, 0, color, 640, 170);
    for (const t of this.tiles) {
      if (t.zone.player !== player) continue;
      const delay = Math.round((Math.hypot(t.col - pod.col, t.row - pod.row) - 1) * 130);
      const fill = this.add(this.scene.add.image(isoToScreen(t.col, t.row).x, isoToScreen(t.col, t.row).y, AK.tileFill))
        .setDepth(D.flash)
        .setBlendMode(ADD)
        .setTint(color)
        .setAlpha(0);
      jobs.push(
        this.run(
          260,
          (k) => {
            const e = envelope(k, 80, 40, 140);
            t.boost = Math.max(t.boost, e * 0.9);
            fill.setAlpha(e * 0.45);
          },
          'Linear',
          delay,
        ).then(() => this.remove(fill)),
      );
    }
    // a burst of motes off the side's trim
    const path = trimPath(player);
    for (let i = 0; i < 14; i++) {
      const a = path[Math.floor(this.rnd() * path.length)];
      const b = path[Math.min(path.length - 1, path.indexOf(a) + 1)];
      const k = this.rnd();
      this.spawn('spark', Math.round(a.x + (b.x - a.x) * k), Math.round(a.y + (b.y - a.y) * k), color);
    }
    await Promise.all(jobs);
  }

  /** Emphasise the active player's half (brighter trim, livelier tiles). null = neutral. */
  setActivePlayer(player: PlayerId | null, animate = true): void {
    this.active = player;
    const target: [number, number] = player === null ? [0.85, 0.85] : player === 0 ? [1, 0.5] : [0.5, 1];
    if (!animate) {
      this.sideLevel[0] = target[0];
      this.sideLevel[1] = target[1];
      return;
    }
    const from: [number, number] = [this.sideLevel[0], this.sideLevel[1]];
    const token = ++this.activeToken;
    void this.run(
      450,
      (k) => {
        if (token !== this.activeToken) return;
        this.sideLevel[0] = from[0] + (target[0] - from[0]) * k;
        this.sideLevel[1] = from[1] + (target[1] - from[1]) * k;
      },
      'Sine.InOut',
    );
  }

  /**
   * Switch the arena theme. 'volcano' (Volkan Arenası): lava cracks spread between the tiles from
   * `from`'s field zone (or the board center), the sky turns ember red, the trim goes orange,
   * embers and ash drift. ~1.2 s when animated (includes a low rumble shake).
   */
  async setTheme(theme: ArenaTheme, animate = true, from: PlayerId | null = null): Promise<void> {
    const token = ++this.themeToken;
    if (theme === 'volcano') {
      const origin = from === null ? { col: 2, row: 2 } : zoneCell(from, 'field');
      this.ensureLava(origin);
      const f = this.crack!;
      const end = f.maxDist + 16;
      this.themeName = 'volcano';
      if (!animate) {
        this.heat = 1;
        this.trimHeat = 1;
        this.lavaHeat = 1;
        this.lavaAlpha = 1;
        this.crackFront = end;
        this.crackFlow = true;
        this.paintLava();
        return;
      }
      this.crackFlow = false;
      this.crackFront = 0;
      this.lavaAlpha = 1;
      this.lavaHeat = 1;
      this.lavaImg!.clearTint();
      this.paintLava();
      void shake(this.scene, 1150, 2);
      // the field tile erupts: white-hot flash, a heat shockwave rolls over the platform
      void this.flashCell(origin.col, origin.row, PAL.fire4, 380);
      this.shockwave(origin.col, origin.row, 0, PAL.fire4, 640, 170);
      this.shockwave(origin.col, origin.row, 130, PAL.fire2, 760, 150);
      const jobs = [
        this.tweenNum(40, 0, f.mostDist, 900, (v) => token === this.themeToken && (this.crackFront = v), 'Sine.Out').then(() =>
          this.tweenNum(0, f.mostDist, end, 200, (v) => token === this.themeToken && (this.crackFront = v)),
        ),
        this.tweenNum(120, this.heat, 1, 1050, (v) => token === this.themeToken && (this.heat = v), 'Sine.InOut'),
        this.tweenNum(330, this.trimHeat, 1, 520, (v) => {
          if (token !== this.themeToken) return;
          // neon sputters as it overheats
          const flick = v < 0.85 && Math.sin(v * 47) > 0.55 ? 0.35 : 1;
          this.trimHeat = v * flick;
        }),
      ];
      await Promise.all(jobs);
      if (token !== this.themeToken) return;
      this.trimHeat = 1;
      this.heat = 1;
      this.crackFront = end;
      this.crackFlow = true;
      return;
    }
    // back to normal: the lava cools and fades, the night returns
    this.themeName = 'normal';
    if (!animate || !this.lavaImg) {
      this.heat = 0;
      this.trimHeat = 0;
      this.lavaAlpha = 0;
      this.lavaHeat = 0;
      this.crackFlow = false;
      this.syncLava();
      return;
    }
    await Promise.all([
      this.tweenNum(0, this.heat, 0, 1000, (v) => token === this.themeToken && (this.heat = v), 'Sine.InOut'),
      this.tweenNum(0, this.trimHeat, 0, 500, (v) => token === this.themeToken && (this.trimHeat = v), 'Sine.InOut'),
      this.tweenNum(0, this.lavaHeat, 0, 700, (v) => token === this.themeToken && (this.lavaHeat = v), 'Quad.Out'),
      this.tweenNum(0, this.lavaAlpha, 0, 900, (v) => token === this.themeToken && (this.lavaAlpha = v), 'Quad.In'),
    ]);
    if (token === this.themeToken) this.crackFlow = false;
  }

  /**
   * Floodlights. With animate the towers ignite one by one (flicker → full) and their searchlights
   * fade in — the "stadium lights come on" beat of the duel intro (~1.6 s).
   */
  async setLights(on: boolean, animate = true): Promise<void> {
    if (!animate) {
      this.towerLevel = TOWERS.map(() => (on ? 1 : 0));
      return;
    }
    if (!on) {
      await this.tweenNum(0, 1, 0, 400, (v) => (this.towerLevel = this.towerLevel.map((l) => Math.min(l, v))), 'Quad.In');
      return;
    }
    // ignite from the outside in, alternating sides
    const order = [0, 7, 1, 6, 2, 5, 3, 4];
    const jobs = order.map((ti, k) =>
      this.wait(k * 170).then(async () => {
        const seq = [0.8, 0.1, 0.9, 0.3, 1];
        for (const v of seq) {
          this.towerLevel[ti] = v;
          await this.wait(45);
        }
        this.towerLevel[ti] = 1;
        // the lamp "pops" with a bright glow
        const t = TOWERS[ti];
        const g = this.add(this.scene.add.image(t.x, t.lampY, AK.glow))
          .setDepth(D.lamps + 0.1)
          .setBlendMode(ADD)
          .setScrollFactor(SF.stadium)
          .setTint(PAL.gold4)
          .setScale(1.6);
        await this.run(380, (k) => g.setAlpha(1 - k).setScale(1.6 - k), 'Quad.Out');
        this.remove(g);
      }),
    );
    await Promise.all(jobs);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.themeToken++;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    for (const o of this.objs) {
      this.scene.tweens.killTweensOf(o);
      o.destroy();
    }
    this.objs.length = 0;
    this.highlights.clear();
    const pending = this.jobs;
    this.jobs = [];
    for (const j of pending) j.done();
    if (this.lavaTex) {
      const key = this.lavaTex.key;
      this.lavaTex = null;
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    }
  }

  // ================================================================ building

  private add<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objs.push(o);
    return o;
  }

  private remove(o: Phaser.GameObjects.GameObject): void {
    const i = this.objs.indexOf(o);
    if (i >= 0) this.objs.splice(i, 1);
    o.destroy();
  }

  private img(x: number, y: number, key: string, depth: number, sf = 1): Img {
    return this.add(this.scene.add.image(x, y, key).setOrigin(0).setDepth(depth).setScrollFactor(sf));
  }

  /** A cropped layer texture placed at its recorded world origin. */
  private layer(key: string, depth: number, sf = 1): Img {
    const o = texOrigin(key);
    return this.img(o.x, o.y, key, depth, sf);
  }

  private buildSky(): void {
    const R = SKY_RECT;
    this.img(R.x, R.y, AK.sky, D.sky, SF.sky);
    this.skyHot = this.img(R.x, R.y, AK.skyHot, D.skyHot, SF.sky).setAlpha(0);
    for (let i = 0; i < 2; i++) {
      const a = this.add(this.scene.add.tileSprite(R.x, -70 + i * 14, R.w, AURORA_SIZE.h, AK.aurora(i)))
        .setOrigin(0)
        .setDepth(D.aurora + i * 0.1)
        .setScrollFactor(SF.sky)
        .setBlendMode(ADD);
      this.aurora.push(a);
    }
    this.smoke = this.add(this.scene.add.tileSprite(R.x, -40, R.w, SMOKE_SIZE.h, AK.smoke))
      .setOrigin(0)
      .setDepth(D.smoke)
      .setScrollFactor(SF.sky)
      .setAlpha(0);
    // bright twinkling stars (tier 3) + some twinkling mid stars
    const r = mulberry32(77);
    for (let i = 0; i < 46; i++) {
      const x = Math.floor(R.x + 8 + r() * (R.w - 16));
      const y = Math.floor(R.y + 8 + r() * (R.h - 16));
      if (y > rimY(x) - 10) continue;
      const big = i < 18;
      const img = this.add(this.scene.add.image(x, y, AK.star, big ? '2' : '1'))
        .setDepth(D.stars)
        .setScrollFactor(SF.sky);
      this.stars.push({ img, speed: 0.0012 + r() * 0.003, phase: r() * Math.PI * 2, maxFrame: big ? 3 : 1, base: big ? 1 : 0.8 });
    }
    // searchlight beams (behind the stadium silhouette)
    TOWERS.forEach((t, i) => {
      const lamp = this.add(this.scene.add.image(t.x - 6, t.lampY - 3, AK.lamp))
        .setOrigin(0)
        .setDepth(D.lamps)
        .setScrollFactor(SF.stadium);
      const glow = this.add(this.scene.add.image(t.x, t.lampY, AK.glow))
        .setDepth(D.lamps + 0.05)
        .setScrollFactor(SF.stadium)
        .setBlendMode(ADD)
        .setTint(PAL.gold3);
      const beam = this.add(this.scene.add.image(t.x, t.lampY, AK.beam))
        .setOrigin(0, 0.5)
        .setDepth(D.beams)
        .setScrollFactor(SF.stadium)
        .setBlendMode(ADD)
        .setVisible(!!t.beam);
      this.beams.push({ img: beam, glow, lamp, tower: i });
    });
  }

  private buildStadium(): void {
    const R = STADIUM_RECT;
    this.haze = this.layer(AK.haze, D.stadium - 1, SF.stadium).setBlendMode(ADD);
    this.img(R.x, R.y, AK.stadium, D.stadium, SF.stadium);
    this.rimCool = this.layer(AK.rimCool, D.rim, SF.stadium);
    this.rimHot = this.layer(AK.rimHot, D.rim + 0.1, SF.stadium).setAlpha(0);
    // volcano: the whole bowl picks up the lava's red light
    this.stadiumWarm = this.img(R.x, R.y, AK.stadiumHot, D.stadium + 0.5, SF.stadium).setAlpha(0);
    // darkness while the floodlights are off (the crowd's phone lights still shine through)
    this.stadiumDark = this.add(this.scene.add.rectangle(R.x, R.y, R.w, R.h, PAL.ink))
      .setOrigin(0)
      .setDepth(D.rim + 0.5)
      .setScrollFactor(SF.stadium)
      .setAlpha(0);
    for (let i = 0; i < 3; i++) this.crowd.push(this.layer(AK.crowd(i), D.crowd, SF.stadium));
    for (let i = 0; i < 3; i++) this.led.push(this.layer(AK.led(i), D.led, SF.stadium));
    // fog: far haze at the stadium floor, a bank under the platform, wisps in the foreground
    const fogDefs = [
      { i: 0, y: 156, depth: D.fogFar, sf: SF.fogFar, speed: 0.004, cool: PAL.night4, hot: PAL.fire1, alpha: 0.42 },
      { i: 0, y: 196, depth: D.fogFar + 0.1, sf: SF.fogFar, speed: -0.006, cool: PAL.night4, hot: PAL.crim2, alpha: 0.36 },
      { i: 1, y: 250, depth: D.fogLow, sf: 1, speed: 0.009, cool: PAL.steel, hot: PAL.fire2, alpha: 0.24 },
      { i: 2, y: 304, depth: D.fogNear, sf: SF.fogNear, speed: 0.016, cool: PAL.mist, hot: PAL.fire3, alpha: 0.13 },
    ];
    for (const f of fogDefs) {
      const spr = this.add(this.scene.add.tileSprite(-48, f.y, GAME_W + 96, FOG_SIZE[f.i].h, AK.fog(f.i)))
        .setOrigin(0)
        .setDepth(f.depth)
        .setScrollFactor(f.sf)
        .setAlpha(f.alpha);
      spr.tilePositionX = Math.floor(this.rnd() * 300);
      this.fogs.push({ spr, speed: f.speed, cool: f.cool, hot: f.hot, alpha: f.alpha });
    }
  }

  private buildPlatform(): void {
    const S = SLAB_RECT;
    // energy glow beneath the platform
    for (const hot of [false, true]) {
      this.under.push(
        this.add(this.scene.add.image(320, 282, AK.under(hot)))
          .setDepth(D.under)
          .setBlendMode(ADD)
          .setAlpha(hot ? 0 : 0.6),
      );
    }
    this.coreBeam = this.add(this.scene.add.image(CORE_XY.x, CORE_XY.y - 6, AK.coreBeam).setOrigin(0.5, 0)).setDepth(D.coreBeam).setBlendMode(ADD);
    for (let i = 0; i < 3; i++) {
      const img = this.add(this.scene.add.image(CORE_XY.x, CORE_XY.y, AK.ringFx, '0')).setDepth(D.rings).setBlendMode(ADD).setAlpha(0);
      this.rings.push({ img, age: -1 });
    }
    // anti-gravity shafts under the first hull tier
    THRUSTERS.forEach((th, i) => {
      const img = this.add(this.scene.add.image(th.x, th.y - 1, AK.shaft).setOrigin(0.5, 0))
        .setDepth(D.coreBeam)
        .setBlendMode(ADD);
      this.shafts.push({ img, cls: th.cls, phase: i * 1.7 });
    });
    this.img(S.x, S.y, AK.slab, D.slab);
    for (const cls of [0, 1, 2] as TrimClass[]) {
      this.trims.push({
        cool: this.layer(AK.trim(false, cls), D.trim),
        hot: this.layer(AK.trim(true, cls), D.trim + 0.1).setAlpha(0),
        coolGlow: this.layer(AK.trim(false, cls), D.trimGlow).setBlendMode(ADD).setAlpha(0),
        hotGlow: this.layer(AK.trim(true, cls), D.trimGlow + 0.1).setBlendMode(ADD).setAlpha(0),
      });
    }
    this.core = this.add(this.scene.add.image(CORE_XY.x, CORE_XY.y, AK.glow)).setDepth(D.core).setBlendMode(ADD).setScale(0.75);
    // light runners racing along each side's trim
    for (const p of [0, 1] as PlayerId[]) {
      const path = trimPath(p);
      const seg: number[] = [0];
      for (let i = 1; i < path.length; i++) seg.push(seg[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
      const head = this.add(this.scene.add.image(0, 0, AK.dot)).setDepth(D.runner).setBlendMode(ADD);
      const trail = [0, 1, 2, 3, 4, 5, 6].map(() => this.add(this.scene.add.image(0, 0, AK.mote)).setDepth(D.runner).setBlendMode(ADD));
      this.runners.push({ head, trail, path, len: seg[seg.length - 1], seg });
    }
  }

  private buildTiles(): void {
    for (let row = 0; row < BOARD_ROWS; row++)
      for (let col = 0; col < BOARD_COLS; col++) {
        const zone = cellZone(col, row);
        if (!zone) continue;
        const s = isoToScreen(col, row);
        const img = this.add(this.scene.add.image(s.x, s.y, AK.tile(zone.spot, zone.player))).setDepth(D.tile);
        const glow = this.add(this.scene.add.image(s.x, s.y, AK.tileGlow(zone.spot)))
          .setDepth(D.tileGlow)
          .setBlendMode(ADD)
          .setTint(PLAYER_COLOR[zone.player]);
        const back = zone.player === 0 ? 4 - row : row;
        this.tiles.push({ col, row, zone, img, glow, phase: back * 1.1 + Math.abs(col - 2) * 0.45, boost: 0, color: PLAYER_COLOR[zone.player] });
      }
    const B = BRIDGE_RECT;
    this.img(B.x, B.y, AK.bridge, D.tile);
    this.bridgeFlow = this.img(B.x, B.y, AK.bridgeFlow, D.bridgeFlow).setFrame('0').setBlendMode(ADD).setTint(PAL.mist);
  }

  private buildParticles(): void {
    for (let i = 0; i < 90; i++) {
      const img = this.add(this.scene.add.image(0, 0, AK.mote)).setVisible(false).setBlendMode(ADD);
      this.parts.push({ img, kind: 'mote', x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, sway: 0, phase: 0, alpha: 1, alive: false });
    }
    // seed the ambient motes mid-life so the first frame is already alive
    for (let i = 0; i < 16; i++) this.spawnAmbient('mote', true);
    for (let i = 0; i < 12; i++) this.spawnAmbient('moteFar', true);
  }

  // ================================================================ highlights & flashes

  private tintHighlight(h: Highlight): void {
    const c = h.color;
    h.fill.setTint(c);
    h.outline.setTint(c);
    h.march.setTint(mix(c, PAL.white, 0.55));
    for (const t of h.tips) t.setTint(mix(c, PAL.white, 0.25));
  }

  private updateHighlight(h: Highlight, dt: number): boolean {
    h.k = Math.max(0, Math.min(1, h.k + (h.dying ? -dt / 140 : dt / 160)));
    if (h.dying && h.k <= 0) {
      for (const o of [h.fill, h.outline, h.march, ...h.tips]) this.remove(o);
      return false;
    }
    const age = this.t - h.born;
    const w = 0.5 + 0.5 * Math.sin(age / 150);
    h.fill.setAlpha(h.k * (0.1 + 0.12 * w));
    h.outline.setAlpha(h.k * (0.7 + 0.3 * w));
    h.march.setAlpha(h.k).setFrame(String(Math.floor(age / 55) % MARCH_FRAMES));
    // tips lock on from further out, then breathe 0..2 px
    const settle = Math.max(0, 1 - age / 220);
    const off = Math.round(1 - Math.cos(age / 190) + settle * settle * 8);
    const [tt, tl, tb, tr] = h.tips;
    tt.setPosition(h.x - 11, h.y - 16 - 2 - off - 5);
    tb.setPosition(h.x - 11, h.y + 16 + 2 + off);
    tl.setPosition(h.x - 32 - 2 - 2 * off - 10, h.y - 7);
    tr.setPosition(h.x + 32 + 2 + 2 * off, h.y - 7);
    for (const t of h.tips) t.setAlpha(h.k);
    // rising sparkles from the target's edges
    if (!h.dying && this.t >= h.sparkAt) {
      h.sparkAt = this.t + 160 + this.rnd() * 160;
      const a = this.rnd() * Math.PI * 2;
      const r = 0.82 + this.rnd() * 0.12;
      this.spawn('spark', Math.round(h.x + Math.cos(a) * 32 * r), Math.round(h.y + Math.sin(a) * 16 * r), mix(h.color, PAL.white, 0.3));
    }
    return true;
  }

  private flashCell(col: number, row: number, color: number, ms: number): Promise<void> {
    const s = isoToScreen(col, row);
    const fill = this.add(this.scene.add.image(s.x, s.y, AK.tileFill)).setDepth(D.flash).setBlendMode(ADD).setTint(color).setAlpha(0.95);
    const tile = this.tiles.find((t) => t.col === col && t.row === row);
    if (tile) void this.run(ms * 1.4, (k) => (tile.boost = Math.max(tile.boost, 1 - k)), 'Quad.Out');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + this.rnd();
      this.spawn('spark', Math.round(s.x + Math.cos(a) * 26), Math.round(s.y + Math.sin(a) * 12), mix(color, PAL.white, 0.4), -(18 + this.rnd() * 22));
    }
    return Promise.all([
      this.run(ms, (k) => fill.setAlpha(0.95 * (1 - k)), 'Quad.Out').then(() => this.remove(fill)),
      this.diamondRing(s.x, s.y, color, ms * 1.1, 12),
    ]).then(() => undefined);
  }

  /** A crisp 1px tile-shaped outline that grows outward by `grow` px while fading. */
  private diamondRing(x: number, y: number, color: number, ms: number, grow: number): Promise<void> {
    const g = this.add(this.scene.add.graphics()).setDepth(D.flash + 0.5).setBlendMode(ADD);
    return this.run(
      ms,
      (k) => {
        const hw = 32 + Math.round(k * grow * 2);
        const hh = hw / 2;
        g.clear();
        g.lineStyle(1, color, 1 - k);
        g.strokePoints(
          [
            { x, y: y - hh },
            { x: x + hw, y },
            { x, y: y + hh },
            { x: x - hw, y },
          ],
          true,
          true,
        );
      },
      'Cubic.Out',
    ).then(() => this.remove(g));
  }

  // ================================================================ theme internals

  private heatColor(c: number): number {
    return this.trimHeat > 0.5 ? mix(c, HOT_TINT, 0.65) : c;
  }

  /** An expanding iso ring along the platform plane (1px crisp vector line). */
  private shockwave(col: number, row: number, delay: number, color: number, ms: number, reach = 190): void {
    const s = isoToScreen(col, row);
    const g = this.add(this.scene.add.graphics()).setDepth(D.flash + 1).setBlendMode(ADD);
    void this.run(
      ms,
      (k) => {
        g.clear();
        const rx = Math.round(24 + k * reach);
        const a = 1 - k;
        g.lineStyle(2, color, a);
        g.strokeEllipse(s.x, s.y, rx * 2, rx);
        g.lineStyle(1, color, a * 0.5);
        g.strokeEllipse(s.x, s.y, rx * 2 - 12, rx - 6);
      },
      'Cubic.Out',
      delay,
    ).then(() => this.remove(g));
  }

  private ensureLava(origin: { col: number; row: number }): void {
    const key = `${origin.col},${origin.row}`;
    if (this.crack && this.crackKey === key) return;
    this.crack = buildCrackField(origin);
    this.crackKey = key;
    if (!this.lavaTex) {
      const texKey = `arena:lava:${this.id}`;
      if (this.scene.textures.exists(texKey)) this.scene.textures.remove(texKey);
      this.lavaTex = this.scene.textures.createCanvas(texKey, SLAB_RECT.w, SLAB_RECT.h);
      if (!this.lavaTex) throw new Error('arena: cannot create lava canvas');
      this.lavaImgData = this.lavaTex.getContext().createImageData(SLAB_RECT.w, SLAB_RECT.h);
      this.lavaImg = this.img(SLAB_RECT.x, SLAB_RECT.y, texKey, D.lava);
      this.lavaGlow = this.img(SLAB_RECT.x, SLAB_RECT.y, texKey, D.lavaGlow).setBlendMode(ADD).setAlpha(0);
    }
  }

  private paintLava(): void {
    if (!this.crack || !this.lavaTex || !this.lavaImgData) return;
    paintCracks(this.crack, this.lavaImgData.data, this.crackFront, this.crackFlow ? this.t : null, 1);
    this.lavaTex.getContext().putImageData(this.lavaImgData, 0, 0);
    this.lavaTex.refresh();
  }

  private syncLava(): void {
    if (!this.lavaImg || !this.lavaGlow) return;
    const vis = this.lavaAlpha > 0.001;
    this.lavaImg.setVisible(vis).setAlpha(this.lavaAlpha);
    // cooling: the glow darkens toward rock as heat drops
    const k = this.lavaHeat;
    this.lavaImg.setTint(k >= 1 ? 0xffffff : mix(PAL.stone1, 0xffffff, k));
    this.lavaGlow.setVisible(vis).setAlpha(this.lavaAlpha * k * (0.32 + 0.12 * Math.sin(this.t / 420)));
  }

  /**
   * Animate k: 0→1 over `ms` of board time after `delay`. Driven by tick() from the game loop's
   * delta (× scene.time.timeScale), NOT by Phaser's TweenManager (which runs on Date.now()), so it is
   * deterministic under frame stepping and freezes during hit-stop like the rest of the board.
   */
  private run(ms: number, fn: (k: number) => void, ease = 'Linear', delay = 0): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    return new Promise((done) => {
      const e = Phaser.Tweens.Builders.GetEaseFunction(ease) as (v: number) => number;
      this.jobs.push({ delay, t: 0, dur: Math.max(1, ms), ease: e, fn, done });
    });
  }

  private tweenNum(delay: number, from: number, to: number, ms: number, fn: (v: number) => void, ease = 'Linear'): Promise<void> {
    return this.run(ms, (k) => fn(from + (to - from) * k), ease, delay);
  }

  private wait(ms: number): Promise<void> {
    return this.run(ms, () => undefined);
  }

  private stepJobs(dt: number): void {
    if (!this.jobs.length) return;
    const list = this.jobs;
    this.jobs = [];
    const keep: Job[] = [];
    for (const j of list) {
      if (j.delay > 0) {
        j.delay -= dt;
        if (j.delay > 0) {
          keep.push(j);
          continue;
        }
        j.t = -j.delay;
        j.delay = 0;
      } else j.t += dt;
      const k = Math.min(1, j.t / j.dur);
      j.fn(j.ease(k));
      if (k >= 1) j.done();
      else keep.push(j);
    }
    this.jobs = keep.concat(this.jobs);
  }

  // ================================================================ particles

  private spawn(kind: Particle['kind'], x: number, y: number, color: number, vy?: number): Particle | null {
    const p = this.parts.find((q) => !q.alive);
    if (!p) return null;
    const r = this.rnd;
    p.alive = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.age = 0;
    p.phase = r() * Math.PI * 2;
    p.vx = 0;
    switch (kind) {
      case 'spark':
        p.vy = vy ?? -(10 + r() * 14);
        p.life = 500 + r() * 400;
        p.sway = 1.5;
        p.alpha = 1;
        p.img.setTexture(AK.mote).setDepth(D.motesNear);
        break;
      case 'mote':
        p.vy = -(3 + r() * 6);
        p.life = 4000 + r() * 4000;
        p.sway = 4 + r() * 6;
        p.alpha = 0.35 + r() * 0.45;
        p.img.setTexture(r() < 0.3 ? AK.mote : TEX.px1).setDepth(D.motesNear);
        break;
      case 'moteFar':
        p.vy = -(2 + r() * 4);
        p.life = 5000 + r() * 5000;
        p.sway = 6 + r() * 8;
        p.alpha = 0.3 + r() * 0.4;
        p.img.setTexture(r() < 0.2 ? AK.mote : TEX.px1).setDepth(D.motesFar);
        break;
      case 'ember':
        p.vy = vy ?? -(14 + r() * 26);
        p.vx = (r() - 0.5) * 8;
        p.life = 1200 + r() * 1600;
        p.sway = 3 + r() * 4;
        p.alpha = 1;
        p.img.setTexture(r() < 0.35 ? TEX.px2 : TEX.px1).setDepth(D.motesNear);
        break;
      case 'ash':
        p.vy = 5 + r() * 9;
        p.vx = 3 + r() * 6;
        p.life = 5000 + r() * 4000;
        p.sway = 5 + r() * 6;
        p.alpha = 0.5 + r() * 0.4;
        p.img.setTexture(r() < 0.3 ? TEX.px2 : TEX.px1).setDepth(D.motesNear);
        break;
    }
    p.img.setTint(color).setScrollFactor(kind === 'moteFar' ? SF.fogFar : 1).setBlendMode(kind === 'ash' ? Phaser.BlendModes.NORMAL : ADD);
    p.img.setVisible(true);
    return p;
  }

  private spawnAmbient(kind: 'mote' | 'moteFar' | 'ash', midLife = false): void {
    const r = this.rnd;
    let x: number;
    let y: number;
    let color: number;
    if (kind === 'ash') {
      x = Math.floor(-20 + r() * (GAME_W + 20));
      y = Math.floor(-10 + (midLife ? r() * GAME_H : 0));
      color = r() < 0.5 ? PAL.stone2 : PAL.stone3;
    } else if (kind === 'moteFar') {
      x = Math.floor(r() * GAME_W);
      y = Math.floor(170 + r() * 190);
      color = x < 280 ? PAL.cyan3 : x > 360 ? PAL.crim3 : PAL.mist;
      if (r() < 0.3) color = PAL.mist;
    } else {
      // around and below the platform, a few over the board
      x = Math.floor(120 + r() * 400);
      y = Math.floor(150 + r() * 170);
      const g = screenToIso(x, y);
      color = g.row > 2.6 ? PAL.cyan4 : g.row < 1.4 ? PAL.crim4 : PAL.mist;
    }
    const p = this.spawn(kind, x, y, color);
    if (p && midLife) p.age = p.life * (0.2 + r() * 0.5);
  }

  private updateParticles(dt: number): void {
    const s = dt / 1000;
    const heat = this.heat;
    let motes = 0;
    let far = 0;
    let ash = 0;
    for (const p of this.parts) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.alive = false;
        p.img.setVisible(false);
        continue;
      }
      if (p.kind === 'mote') motes++;
      else if (p.kind === 'moteFar') far++;
      else if (p.kind === 'ash') ash++;
      p.x += p.vx * s;
      p.y += p.vy * s;
      const k = p.age / p.life;
      const env = Math.sin(Math.PI * Math.min(1, k * 1.15));
      let a = p.alpha * env;
      if (p.kind === 'mote' || p.kind === 'moteFar') a *= 1 - heat;
      if (p.kind === 'ash') a *= heat;
      if (p.kind === 'ember') {
        a *= 0.65 + 0.35 * Math.sin(this.t / 40 + p.phase * 9);
        p.vy *= 1 - 0.25 * s;
        p.img.setTint(k < 0.35 ? PAL.fire4 : k < 0.7 ? PAL.fire3 : PAL.fire2);
      }
      const sx = Math.sin(this.t / 900 + p.phase) * p.sway;
      p.img.setPosition(Math.round(p.x + sx), Math.round(p.y)).setAlpha(Math.max(0, a));
    }
    // keep the ambient population topped up
    if (motes < 16 * (1 - heat) && this.rnd() < 0.08) this.spawnAmbient('mote');
    if (far < 12 * (1 - heat) && this.rnd() < 0.06) this.spawnAmbient('moteFar');
    if (ash < 26 * heat && this.rnd() < 0.12) this.spawnAmbient('ash');
    // embers from the lava
    if (this.crack && this.lavaAlpha > 0.3 && this.lavaHeat > 0.5) {
      const spreading = !this.crackFlow;
      const rate = spreading ? 0.9 : 0.16;
      if (this.rnd() < rate) {
        const pts = this.crack.embers;
        const e = pts[Math.floor(this.rnd() * pts.length)];
        if (e.d <= this.crackFront && (!spreading || e.d > this.crackFront - 24)) {
          this.spawn('ember', e.x, e.y - 1, PAL.fire4, spreading ? -(30 + this.rnd() * 40) : undefined);
        }
      }
    }
  }

  // ================================================================ tick

  private tick(_time: number, delta: number): void {
    if (this.destroyed) return;
    const dt = Math.min(50, delta) * this.scene.time.timeScale;
    this.t += dt;
    this.frame++;
    this.stepJobs(dt);
    const t = this.t;
    const heat = this.heat;

    // ---- sky
    this.skyHot.setAlpha(heat).setVisible(heat > 0.001);
    this.smoke.setAlpha(heat * 0.85).setVisible(heat > 0.001);
    this.smoke.tilePositionX = Math.round(t * 0.006);
    this.aurora.forEach((a, i) => {
      a.tilePositionX = Math.round(t * (i ? -0.0021 : 0.0035));
      const breathe = 0.5 + 0.5 * Math.sin(t / (i ? 5300 : 3700) + i * 2);
      a.setAlpha((1 - heat) * (i ? 0.12 + 0.12 * breathe : 0.16 + 0.14 * breathe));
    });
    for (const s of this.stars) {
      const v = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
      const f = Math.min(s.maxFrame, Math.floor(v * (s.maxFrame + 0.999)));
      s.img.setFrame(String(f)).setAlpha(s.base * (0.45 + 0.55 * v) * (1 - 0.75 * heat));
    }

    // ---- stadium lights
    const lightAvg = this.towerLevel.reduce((a, b) => a + b, 0) / this.towerLevel.length;
    this.rimCool.setAlpha((0.25 + 0.75 * lightAvg) * (1 - heat));
    this.stadiumDark.setAlpha((1 - lightAvg) * 0.55).setVisible(lightAvg < 0.999);
    this.haze.setTint(mix(PAL.void1, PAL.fire1, heat)).setAlpha((0.35 + 0.65 * lightAvg) * (0.75 + 0.1 * Math.sin(t / 2100)));
    this.rimHot.setAlpha(heat).setVisible(heat > 0.001);
    this.stadiumWarm.setAlpha(heat).setVisible(heat > 0.001);
    for (const b of this.beams) {
      const tw = TOWERS[b.tower];
      const lvl = this.towerLevel[b.tower];
      b.lamp.setAlpha(lvl);
      b.glow.setAlpha(lvl * (0.5 + 0.06 * Math.sin(t / 300 + b.tower))).setTint(mix(PAL.gold3, PAL.fire3, heat));
      if (tw.beam) {
        const bm = tw.beam;
        const ang = bm.angle + bm.amp * Math.sin((t / bm.period + bm.phase) * Math.PI * 2);
        b.img.setRotation(ang).setAlpha(lvl * (0.3 + 0.06 * Math.sin(t / 700 + b.tower)) * (1 - 0.35 * heat));
        b.img.setTint(mix(bm.tint, PAL.fire3, heat));
      }
    }
    this.crowd.forEach((c, i) => c.setAlpha(0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t / (1300 + i * 370) + i * 2.1))));
    const ledPhase = Math.floor(t / 120) % 3;
    this.led.forEach((l, i) => l.setAlpha(i === ledPhase ? 1 : 0.18));
    // crowd camera flashes
    this.flashClock -= dt;
    if (this.flashClock <= 0) {
      this.flashClock = 250 + this.rnd() * 900;
      this.cameraFlash();
    }
    for (const f of this.fogs) {
      f.spr.tilePositionX = Math.round(t * f.speed);
      f.spr.setTint(mix(f.cool, f.hot, heat)).setAlpha(f.alpha * (1 + 0.4 * heat));
    }

    // ---- platform energy
    const breath = 0.5 + 0.5 * Math.sin(t / 1600);
    this.under[0].setAlpha((0.62 + 0.18 * breath) * (1 - heat));
    this.under[1].setAlpha((0.55 + 0.2 * breath) * heat).setVisible(heat > 0.001);
    this.core.setAlpha(0.75 + 0.25 * Math.sin(t / 230)).setTint(mix(PAL.cyan4, PAL.fire4, heat));
    this.coreBeam.setAlpha(0.28 + 0.1 * breath).setTint(mix(PAL.mist, PAL.fire3, heat));
    for (const sh of this.shafts) {
      const base = sh.cls === 0 ? PAL.cyan3 : sh.cls === 1 ? PAL.crim3 : PAL.mist;
      const flick = 0.5 + 0.5 * Math.sin(t / 310 + sh.phase) * Math.sin(t / 830 + sh.phase * 2);
      sh.img.setTint(mix(base, PAL.fire3, heat)).setAlpha(0.22 + 0.16 * flick);
    }
    this.ringClock -= dt;
    if (this.ringClock <= 0) {
      this.ringClock = 1250;
      const free = this.rings.find((r) => r.age < 0);
      if (free) free.age = 0;
    }
    for (const r of this.rings) {
      if (r.age < 0) continue;
      r.age += dt;
      const k = r.age / 1900;
      if (k >= 1) {
        r.age = -1;
        r.img.setAlpha(0);
        continue;
      }
      r.img
        .setFrame(String(Math.min(RING_FRAMES - 1, Math.floor(k * RING_FRAMES))))
        .setPosition(CORE_XY.x, Math.round(CORE_XY.y + k * 34))
        .setAlpha((1 - k) * 0.55)
        .setTint(mix(PAL.mist, PAL.fire3, heat));
    }

    // ---- trim (per side)
    const th = this.trimHeat;
    this.trims.forEach((tr, cls) => {
      const lvl = cls === 2 ? this.sideLevel[2] : this.sideLevel[cls];
      const flash = cls === 2 ? 0 : this.sideFlash[cls];
      const isActive = cls !== 2 && this.active === cls;
      tr.cool.setAlpha(lvl * (1 - th));
      tr.hot.setAlpha(lvl * th).setVisible(th > 0.001);
      const pulse = isActive ? 0.22 + 0.16 * (0.5 + 0.5 * Math.sin(t / 520)) : 0.06;
      const g = Math.min(1, pulse + flash * 0.9);
      tr.coolGlow.setAlpha(g * (1 - th));
      tr.hotGlow.setAlpha(g * th).setVisible(th > 0.001);
    });
    this.updateRunners();

    // ---- tiles
    for (const tile of this.tiles) {
      const isActive = this.active === tile.zone.player;
      const w = 0.5 + 0.5 * Math.sin(t / 420 - tile.phase);
      const base = tile.zone.spot === 'banish' ? 0.08 : isActive ? 0.2 : this.active === null ? 0.16 : 0.1;
      const amp = tile.zone.spot === 'banish' ? 0.08 : isActive ? 0.34 : 0.18;
      tile.glow.setAlpha(Math.min(1, base + amp * w + tile.boost));
      tile.boost = Math.max(0, tile.boost - dt / 600);
    }
    this.bridgeFlow.setFrame(String(Math.floor(t / 70) % FLOW_FRAMES)).setTint(mix(PAL.mist, PAL.fire3, heat));
    this.bridgeFlow.setAlpha(0.75 + 0.25 * Math.sin(t / 800));

    // ---- lava
    if (this.crack && this.lavaImg) {
      const spreading = !this.crackFlow && this.lavaAlpha > 0 && this.themeName === 'volcano';
      if (spreading || (this.crackFlow && this.frame % 4 === 0)) this.paintLava();
      this.syncLava();
    }

    // ---- highlights & particles
    for (const [k, h] of this.highlights) if (!this.updateHighlight(h, dt)) this.highlights.delete(k);
    this.updateParticles(dt);
  }

  private updateRunners(): void {
    const speed = 0.075; // px per ms
    this.runners.forEach((rn, p) => {
      const isActive = this.active === p;
      const show = isActive ? 1 : 0;
      const cycle = rn.len + 260;
      const s0 = (this.t * speed + p * 300) % cycle;
      const color = mix(PLAYER_COLOR[p as PlayerId], PAL.fire4, this.trimHeat);
      const at = (s: number) => {
        let i = 1;
        while (i < rn.seg.length - 1 && rn.seg[i] < s) i++;
        const a = rn.path[i - 1];
        const b = rn.path[i];
        const k = (s - rn.seg[i - 1]) / Math.max(1e-6, rn.seg[i] - rn.seg[i - 1]);
        return { x: Math.round(a.x + (b.x - a.x) * k), y: Math.round(a.y + (b.y - a.y) * k) };
      };
      const fade = (s: number) => Math.max(0, Math.min(1, s / 30, (rn.len - s) / 30));
      const vis = s0 <= rn.len && show > 0;
      rn.head.setVisible(vis);
      rn.trail.forEach((tr) => tr.setVisible(vis));
      if (!vis) return;
      const h = at(s0);
      rn.head.setPosition(h.x, h.y).setTint(mix(color, PAL.white, 0.45)).setAlpha(fade(s0));
      rn.trail.forEach((tr, i) => {
        const s = s0 - (i + 1) * 4;
        if (s < 0) {
          tr.setVisible(false);
          return;
        }
        const q = at(s);
        tr.setPosition(q.x, q.y).setTint(color).setAlpha(0.7 * (1 - i / rn.trail.length) * fade(s));
      });
    });
  }

  private cameraFlash(): void {
    const r = this.rnd;
    // pick a point in the visible side stands
    const left = r() < 0.5;
    const x = Math.floor(left ? -40 + r() * 190 : 480 + r() * 200);
    const top = rimY(x) + 3;
    const bot = standsBottomY(x) - 2;
    const y = Math.floor(top + r() * (bot - top));
    const c = r() < 0.75 ? PAL.white : PAL.gold4;
    const star = this.add(this.scene.add.image(x, y, TEX.spark))
      .setDepth(D.flashes)
      .setScrollFactor(SF.stadium)
      .setBlendMode(ADD)
      .setTint(c);
    const glow = this.add(this.scene.add.image(x, y, AK.glow))
      .setDepth(D.flashes)
      .setScrollFactor(SF.stadium)
      .setBlendMode(ADD)
      .setTint(c)
      .setScale(0.35)
      .setAlpha(0.6);
    void this.run(
      160,
      (k) => {
        star.setAlpha(1 - k);
        glow.setAlpha(0.6 * (1 - k));
      },
      'Quad.In',
      50,
    ).then(() => {
      this.remove(star);
      this.remove(glow);
    });
  }
}
