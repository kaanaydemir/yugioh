// BoardViewV2 — the arena v2 stage ("floodlit night match", docs/ARENA_V2.md): a bright marble
// platform with cyan / crimson neon inlays and a wide energy bridge, inside a packed night stadium
// under six floodlight towers. Served through src/view/BoardView.ts (same public API) when
// ARENA_VARIANT === 'v2'.
//
// Ambient motion runs on scene time × scene.time.timeScale through the tick-driven job runner,
// so it is deterministic under the stepped QA clock and freezes during hit-stop.

import Phaser from 'phaser';
import type { ArenaTheme, ZoneHit } from '../../art/arena';
import { AK2, arenaV2Layout, buildArenaV2Textures, texOrigin2 } from '../../art/arena-v2';
import { HL_H, HL_W, MARCH_FRAMES, RING_FRAMES } from '../../art/arena-v2/fx';
import { FACE_T, HH, HW, P, SLAB_RECT, type TrimClass, TOWERS } from '../../art/arena-v2/geom';
import { BRIDGE_RECT, FLOW_FRAMES, HALO_PAD } from '../../art/arena-v2/platform';
import { PAL, PLAYER_COLOR } from '../../art/palette';
import { mix, mulberry32 } from '../../art/pixel';
import type { PlayerId } from '../../engine/types';
import { TEX, shake } from '../../vfx/core';
import {
  BOARD_COLS,
  BOARD_ROWS,
  type BoardSpot,
  DEPTH,
  GAME_H,
  GAME_W,
  cellKind,
  duelistXY,
  isoToScreen,
  screenToIso,
  zoneAtCell,
  zoneCell,
} from '../layout';
import { Lava } from './lava';
import { Stadium } from './stadium';
import { type BoardCtx, D2, type Particle, envelope } from './types';

type Img = Phaser.GameObjects.Image;

const ADD = Phaser.BlendModes.ADD;

const HOT_TINT = PAL.fire3;

interface TileRec {
  col: number;
  row: number;
  zone: ZoneHit;
  img: Img;
  glow: Img;
  halo: Img;
  phase: number;
  boost: number;
}

interface Highlight {
  color: number;
  x: number;
  y: number;
  fill: Img;
  outline: Img;
  march: Img;
  tips: Img[];
  k: number;
  dying: boolean;
  born: number;
  sparkAt: number;
}

interface Job {
  delay: number;
  t: number;
  dur: number;
  ease: (v: number) => number;
  fn: (k: number) => void;
  done: () => void;
}

export interface BoardViewV2Options {
  theme?: ArenaTheme;
  active?: PlayerId | null;
  lights?: boolean;
  volcanoFrom?: PlayerId | null;
}

/** The public BoardView object that owns this implementation (for the turn probe). */
export type BoardOwner = object;

let instanceCounter = 0;

export class BoardViewV2 implements BoardCtx {
  readonly scene: Phaser.Scene;
  readonly id = ++instanceCounter;
  private readonly objs: Phaser.GameObjects.GameObject[] = [];
  readonly rnd = mulberry32(2026);
  t = 0;
  private frame = 0;
  private destroyed = false;
  private jobs: Job[] = [];

  private stadium!: Stadium;
  private lava!: Lava;
  // platform
  private trims: { cool: Img; hot: Img; coolGlow: Img; hotGlow: Img }[] = [];
  private sideLevel: [number, number, number] = [0.85, 0.85, 0.8];
  private sideFlash: [number, number] = [0, 0];
  private runners: { head: Img; trail: Img[]; path: { x: number; y: number }[]; len: number; seg: number[] }[] = [];
  private faceLights: { img: Img; phase: number; cls: TrimClass; rate: number }[] = [];
  // tiles
  private tiles: TileRec[] = [];
  private bridgeFlow!: Img;
  private chevrons: { img: Img; player: PlayerId; step: number; col: number }[] = [];
  private highlights = new Map<string, Highlight>();
  // light layer
  private pools: { img: Img; core: Img; base: number; tower: number; phase: number }[] = [];
  private cones: { img: Img; tower: number; base: number }[] = [];
  private dark!: Phaser.GameObjects.Rectangle;
  private lavaWash!: Img;
  // particles
  private parts: Particle[] = [];
  // state
  private themeName: ArenaTheme = 'normal';
  heat = 0;
  trimHeat = 0;
  private themeToken = 0;
  private active: PlayerId | null = null;
  private activeToken = 0;
  towerLevel: number[] = TOWERS.map(() => 1);
  private turn: number | null = null;
  private turnExplicit = false;

  constructor(
    scene: Phaser.Scene,
    opts: BoardViewV2Options = {},
    private readonly owner: BoardOwner | null = null,
  ) {
    this.scene = scene;
    buildArenaV2Textures(scene);
    this.stadium = new Stadium(this);
    this.buildPlatform();
    this.buildTiles();
    this.buildLights();
    this.buildParticles();
    this.lava = new Lava(this);
    if (opts.lights === false) this.towerLevel = TOWERS.map(() => 0);
    this.setActivePlayer(opts.active ?? null, false);
    if (opts.theme === 'volcano') void this.setTheme('volcano', false, opts.volcanoFrom ?? null);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.tick(0, 0);
    // the duel's QA state appears once DuelScene has wired its views: read the turn then
    void this.wait(400).then(() => {
      if (this.destroyed || this.turnExplicit) return;
      const t = this.probeTurn();
      if (t !== this.turn) {
        this.turn = t;
        this.stadium.setActive(this.active, t);
      }
    });
  }

  // ================================================================ public API

  get theme(): ArenaTheme {
    return this.themeName;
  }

  get activePlayer(): PlayerId | null {
    return this.active;
  }

  /** Zone under a world-space point, pixel-accurate to the drawn 80×40 diamonds. */
  zoneAt(x: number, y: number): ZoneHit | null {
    const g = screenToIso(Math.floor(x) + 0.5, Math.floor(y) + 0.5);
    return zoneAtCell(Math.round(g.col), Math.round(g.row));
  }

  tileImage(player: PlayerId, spot: BoardSpot, index = 0): Img | null {
    const c = zoneCell(player, spot, index);
    return this.tiles.find((t) => t.col === c.col && t.row === c.row)?.img ?? null;
  }

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
    const s = zoneXYi(player, spot, index);
    // on bright marble an additive outline vanishes: the pieces are opaque color (NORMAL blend)
    const mk = (k: string, depth: number) => this.add(this.scene.add.image(s.x, s.y, k).setDepth(depth));
    const h: Highlight = {
      color,
      x: s.x,
      y: s.y,
      fill: mk(AK2.tileFill, D2.hlFill),
      outline: mk(AK2.hlOutline, D2.hlOutline),
      march: mk(AK2.hlMarch, D2.hlMarch).setFrame('0'),
      tips: [AK2.hlTipT, AK2.hlTipL, AK2.hlTipT, AK2.hlTipL].map((k, i) => {
        const img = this.add(this.scene.add.image(0, 0, k).setOrigin(0).setDepth(D2.hlTips));
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

  clearHighlights(): void {
    for (const h of this.highlights.values()) h.dying = true;
  }

  flashTile(player: PlayerId, spot: BoardSpot, index: number, color: number, ms = 320): Promise<void> {
    const c = zoneCell(player, spot, index);
    return this.flashCell(c.col, c.row, color, ms);
  }

  /** Turn-start pulse: a shockwave from the duelist's podium rolls over that side's tiles. */
  async pulseSide(player: PlayerId): Promise<void> {
    const color = this.heatColor(PLAYER_COLOR[player]);
    const jobs: Promise<void>[] = [];
    jobs.push(this.run(760, (k) => (this.sideFlash[player] = 1 - k), 'Quad.Out'));
    const pod = player === 0 ? { col: 3, row: 6.25 } : { col: 3, row: -1.25 };
    this.shockwave(pod.col, pod.row, 0, color, 680, 230);
    this.stadium.cheer(player);
    for (const t of this.tiles) {
      if (t.zone.player !== player) continue;
      const delay = Math.round((Math.hypot(t.col - pod.col, t.row - pod.row) - 1) * 110);
      const s = isoToScreen(t.col, t.row);
      const fill = this.add(this.scene.add.image(s.x, s.y, AK2.tileFill)).setDepth(D2.flash).setTint(color).setAlpha(0);
      jobs.push(
        this.run(
          280,
          (k) => {
            const e = envelope(k, 80, 40, 160);
            t.boost = Math.max(t.boost, e * 0.9);
            fill.setAlpha(e * 0.32);
          },
          'Linear',
          delay,
        ).then(() => this.remove(fill)),
      );
    }
    // sparks off the side's trim
    const path = this.runners[player].path;
    for (let i = 0; i < 18; i++) {
      const k = Math.floor(this.rnd() * (path.length - 1));
      const a = path[k];
      const b = path[k + 1];
      const u = this.rnd();
      this.spawn('spark', Math.round(a.x + (b.x - a.x) * u), Math.round(a.y + (b.y - a.y) * u), color);
    }
    await Promise.all(jobs);
  }

  setActivePlayer(player: PlayerId | null, animate = true): void {
    this.active = player;
    if (!this.turnExplicit) this.turn = this.probeTurn();
    this.stadium.setActive(player, this.turn);
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
   * The duel's current turn when this board belongs to the running DuelScene (read through its
   * public QA state, window.__neon.duel.state()); null when unknown (previews, title screen).
   * An explicit setTurn() takes precedence.
   */
  private probeTurn(): number | null {
    try {
      type Qa = { views?: { board?: unknown }; state?: () => { turn?: unknown } };
      const qa = (globalThis as { __neon?: { duel?: Qa } }).__neon?.duel;
      if (!qa || !this.owner || qa.views?.board !== this.owner || typeof qa.state !== 'function') return null;
      const t = qa.state().turn;
      return typeof t === 'number' && t > 0 ? t : null;
    } catch {
      return null;
    }
  }

  /** The turn number for the scoreboard (null = unknown). */
  setTurn(turn: number | null): void {
    this.turn = turn;
    this.turnExplicit = turn !== null;
    this.stadium.setActive(this.active, this.turn);
  }

  /**
   * 'volcano': lava glows up through cracks in the marble from `from`'s field pad (or the board
   * center), the night sky turns to embers, the neon overheats to orange. ~1.2 s animated
   * (includes its own low rumble shake). 'normal': the lava cools to stone and the night returns.
   */
  async setTheme(theme: ArenaTheme, animate = true, from: PlayerId | null = null): Promise<void> {
    const token = ++this.themeToken;
    if (theme === 'volcano') {
      const origin = from === null ? { col: 3, row: 2.5 } : zoneCell(from, 'field');
      this.themeName = 'volcano';
      if (!animate) {
        this.heat = 1;
        this.trimHeat = 1;
        this.lava.erupt(origin, false);
        return;
      }
      void shake(this.scene, 1150, 2);
      void this.flashCell(Math.round(origin.col), Math.round(origin.row), PAL.fire4, 380);
      this.shockwave(origin.col, origin.row, 0, PAL.fire4, 640, 220);
      this.shockwave(origin.col, origin.row, 130, PAL.fire2, 760, 190);
      const jobs = [
        this.lava.erupt(origin, true),
        this.tweenNum(120, this.heat, 1, 1050, (v) => token === this.themeToken && (this.heat = v), 'Sine.InOut'),
        this.tweenNum(330, this.trimHeat, 1, 520, (v) => {
          if (token !== this.themeToken) return;
          const flick = v < 0.85 && Math.sin(v * 47) > 0.55 ? 0.35 : 1;
          this.trimHeat = v * flick;
        }),
      ];
      await Promise.all(jobs);
      if (token !== this.themeToken) return;
      this.trimHeat = 1;
      this.heat = 1;
      return;
    }
    this.themeName = 'normal';
    if (!animate) {
      this.heat = 0;
      this.trimHeat = 0;
      this.lava.cool(false);
      return;
    }
    await Promise.all([
      this.tweenNum(0, this.heat, 0, 1000, (v) => token === this.themeToken && (this.heat = v), 'Sine.InOut'),
      this.tweenNum(0, this.trimHeat, 0, 500, (v) => token === this.themeToken && (this.trimHeat = v), 'Sine.InOut'),
      this.lava.cool(true),
    ]);
  }

  /**
   * Floodlights. Animated: the six towers ignite one by one (flicker → full, a glow pop), their
   * cones and pools come up and the marble brightens — the duel intro's "lights on" beat (~1.6 s).
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
    const order = [0, 5, 1, 4, 2, 3];
    const jobs = order.map((ti, k) =>
      this.wait(k * 190).then(async () => {
        for (const v of [0.7, 0.1, 0.85, 0.25, 1]) {
          this.towerLevel[ti] = v;
          await this.wait(45);
        }
        this.towerLevel[ti] = 1;
        this.stadium.lampPop(ti);
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
    // canvas textures go after the images that showed them
    this.stadium.destroy();
    this.lava.destroy();
    this.highlights.clear();
    const pending = this.jobs;
    this.jobs = [];
    for (const j of pending) j.done();
  }

  // ================================================================ ctx services

  add<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objs.push(o);
    return o;
  }

  remove(o: Phaser.GameObjects.GameObject): void {
    const i = this.objs.indexOf(o);
    if (i >= 0) this.objs.splice(i, 1);
    o.destroy();
  }

  /** Animate k: 0→1 over `ms` of board time after `delay` (tick-driven, deterministic). */
  run(ms: number, fn: (k: number) => void, ease = 'Linear', delay = 0): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    return new Promise((done) => {
      const e = Phaser.Tweens.Builders.GetEaseFunction(ease) as (v: number) => number;
      this.jobs.push({ delay, t: 0, dur: Math.max(1, ms), ease: e, fn, done });
    });
  }

  tweenNum(delay: number, from: number, to: number, ms: number, fn: (v: number) => void, ease = 'Linear'): Promise<void> {
    return this.run(ms, (k) => fn(from + (to - from) * k), ease, delay);
  }

  wait(ms: number): Promise<void> {
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

  // ================================================================ building

  private img(x: number, y: number, key: string, depth: number): Img {
    return this.add(this.scene.add.image(x, y, key).setOrigin(0).setDepth(depth));
  }

  private layer(key: string, depth: number): Img {
    const o = texOrigin2(key);
    return this.img(o.x, o.y, key, depth);
  }

  private buildPlatform(): void {
    const S = SLAB_RECT;
    this.img(S.x, S.y, AK2.deck, D2.deck);
    for (const cls of [0, 1, 2] as TrimClass[]) {
      this.trims.push({
        cool: this.layer(AK2.trim(false, cls), D2.trim),
        hot: this.layer(AK2.trim(true, cls), D2.trim + 0.05).setAlpha(0),
        coolGlow: this.layer(AK2.trim(false, cls), D2.trimGlow).setBlendMode(ADD).setAlpha(0),
        hotGlow: this.layer(AK2.trim(true, cls), D2.trimGlow + 0.05).setBlendMode(ADD).setAlpha(0),
      });
    }
    // light runners racing along each side's border trim
    for (const p of [0, 1] as PlayerId[]) {
      const path = trimPath2(p);
      const seg: number[] = [0];
      for (let i = 1; i < path.length; i++) seg.push(seg[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
      const head = this.add(this.scene.add.image(0, 0, 'arena:dot')).setDepth(D2.trimGlow + 0.2).setBlendMode(ADD);
      const trail = [0, 1, 2, 3, 4, 5, 6, 7].map(() => this.add(this.scene.add.image(0, 0, 'arena:mote')).setDepth(D2.trimGlow + 0.2).setBlendMode(ADD));
      this.runners.push({ head, trail, path, len: seg[seg.length - 1], seg });
    }
  }

  private buildTiles(): void {
    for (let row = 0; row < BOARD_ROWS; row++)
      for (let col = 0; col < BOARD_COLS; col++) {
        const zone = zoneAtCell(col, row);
        if (!zone) continue;
        const s = isoToScreen(col, row);
        const img = this.add(this.scene.add.image(s.x, s.y, AK2.zoneTile(col, row))).setDepth(D2.tile);
        const color = PLAYER_COLOR[zone.player];
        const halo = this.add(this.scene.add.image(s.x, s.y, AK2.glyphHalo(zone.spot))).setDepth(D2.halo).setTint(color).setAlpha(0);
        const glow = this.add(this.scene.add.image(s.x, s.y, AK2.glyphGlow(zone.spot))).setDepth(D2.tileGlow).setBlendMode(ADD).setTint(color);
        const back = zone.player === 0 ? BOARD_ROWS - 1 - row : row;
        this.tiles.push({ col, row, zone, img, glow, halo, phase: back * 1.1 + Math.abs(col - 3) * 0.4, boost: 0 });
      }
    const B = BRIDGE_RECT;
    this.bridgeFlow = this.img(B.x, B.y, AK2.bridgeFlow, D2.bridgeFlow).setFrame('0').setBlendMode(ADD).setTint(PAL.mist);
    // lane chevrons on the bridge (they chase toward the opponent of the active player)
    for (const ch of arenaV2Layout().chevrons) {
      const img = this.add(this.scene.add.image(ch.x, ch.y, ch.key).setOrigin(0).setDepth(D2.chevron).setBlendMode(ADD).setAlpha(0));
      this.chevrons.push({ img, player: ch.player, step: ch.step, col: ch.col });
    }
  }

  private buildLights(): void {
    // the lights-off darkness (the intro): everything below the emissive layers
    this.dark = this.add(this.scene.add.rectangle(-200, -500, GAME_W + 400, GAME_H + 900, PAL.ink)).setOrigin(0).setDepth(D2.dark).setAlpha(0);
    // volcano: the lava's warm light washing over the marble
    this.lavaWash = this.add(this.scene.add.image(320, 186, AK2.pool)).setDepth(D2.pools - 0.1).setBlendMode(ADD).setScale(2.1, 2.3).setTint(PAL.fire3).setAlpha(0);
    // floodlight pools on the marble: one per tower, where its cone lands
    TOWERS.forEach((tw, i) => {
      const [x, y] = P(tw.aim.c, tw.aim.r);
      const img = this.add(this.scene.add.image(Math.round(x), Math.round(y), AK2.pool)).setDepth(D2.pools).setBlendMode(ADD);
      const core = this.add(this.scene.add.image(Math.round(x), Math.round(y), AK2.poolCore)).setDepth(D2.pools).setBlendMode(ADD);
      this.pools.push({ img, core, base: 0.1, tower: i, phase: i * 1.3 });
      // the cone from the lamp down to the pool
      const dx = x - tw.x;
      const dy = y - tw.y;
      const len = Math.hypot(dx, dy);
      const cone = this.add(this.scene.add.image(tw.x, tw.y, AK2.cone))
        .setOrigin(0.5, 0)
        .setDepth(D2.cones)
        .setBlendMode(ADD)
        .setRotation(Math.atan2(dy, dx) - Math.PI / 2)
        .setScale(1, len / 220);
      this.cones.push({ img: cone, tower: i, base: 0.05 });
    });
  }

  private buildParticles(): void {
    for (let i = 0; i < 140; i++) {
      const img = this.add(this.scene.add.image(0, 0, 'arena:mote')).setVisible(false).setBlendMode(ADD);
      this.parts.push({ img, kind: 'mote', x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, sway: 0, phase: 0, alpha: 1, spin: 0, alive: false });
    }
    for (let i = 0; i < 14; i++) this.spawnAmbient('mote', true);
    for (let i = 0; i < 26; i++) this.spawnAmbient('confetti', true);
  }

  // ================================================================ highlights & flashes

  private tintHighlight(h: Highlight): void {
    const c = h.color;
    h.fill.setTint(c);
    h.outline.setTint(c);
    h.march.setTint(mix(c, PAL.white, 0.6));
    for (const t of h.tips) t.setTint(c);
  }

  private updateHighlight(h: Highlight, dt: number): boolean {
    h.k = Math.max(0, Math.min(1, h.k + (h.dying ? -dt / 140 : dt / 160)));
    if (h.dying && h.k <= 0) {
      for (const o of [h.fill, h.outline, h.march, ...h.tips]) this.remove(o);
      return false;
    }
    const age = this.t - h.born;
    const w = 0.5 + 0.5 * Math.sin(age / 150);
    h.fill.setAlpha(h.k * (0.16 + 0.1 * w));
    h.outline.setAlpha(h.k * (0.85 + 0.15 * w));
    h.march.setAlpha(h.k).setFrame(String(Math.floor(age / 55) % MARCH_FRAMES));
    const settle = Math.max(0, 1 - age / 220);
    const off = Math.round(1 - Math.cos(age / 190) + settle * settle * 9);
    const [tt, tl, tb, tr] = h.tips;
    tt.setPosition(h.x - 13, h.y - HH - 2 - off - 6);
    tb.setPosition(h.x - 13, h.y + HH + 2 + off);
    tl.setPosition(h.x - HW - 2 - 2 * off - 12, h.y - 8);
    tr.setPosition(h.x + HW + 2 + 2 * off, h.y - 8);
    for (const t of h.tips) t.setAlpha(h.k);
    if (!h.dying && this.t >= h.sparkAt) {
      h.sparkAt = this.t + 150 + this.rnd() * 150;
      const a = this.rnd() * Math.PI * 2;
      const r = 0.82 + this.rnd() * 0.12;
      this.spawn('spark', Math.round(h.x + Math.cos(a) * HW * r), Math.round(h.y + Math.sin(a) * HH * r), mix(h.color, PAL.white, 0.3));
    }
    return true;
  }

  flashCell(col: number, row: number, color: number, ms: number): Promise<void> {
    const s = isoToScreen(col, row);
    // a color wash (reads on white marble) + an additive bloom (reads on glass and in the dark)
    const fill = this.add(this.scene.add.image(s.x, s.y, AK2.tileFill)).setDepth(D2.flash).setTint(color).setAlpha(0.7);
    const bloom = this.add(this.scene.add.image(s.x, s.y, AK2.tileFill)).setDepth(D2.flash + 0.2).setBlendMode(ADD).setTint(mix(color, PAL.white, 0.5)).setAlpha(0.6);
    const tile = this.tiles.find((t) => t.col === col && t.row === row);
    if (tile) void this.run(ms * 1.4, (k) => (tile.boost = Math.max(tile.boost, 1 - k)), 'Quad.Out');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + this.rnd();
      this.spawn('spark', Math.round(s.x + Math.cos(a) * 32), Math.round(s.y + Math.sin(a) * 15), mix(color, PAL.white, 0.4), -(18 + this.rnd() * 22));
    }
    return Promise.all([
      this.run(ms, (k) => {
        fill.setAlpha(0.7 * (1 - k));
        bloom.setAlpha(0.6 * (1 - k) * (1 - k));
      }, 'Quad.Out').then(() => {
        this.remove(fill);
        this.remove(bloom);
      }),
      this.diamondRing(s.x, s.y, color, ms * 1.1, 14),
    ]).then(() => undefined);
  }

  private diamondRing(x: number, y: number, color: number, ms: number, grow: number): Promise<void> {
    const g = this.add(this.scene.add.graphics()).setDepth(D2.flash + 0.5);
    return this.run(
      ms,
      (k) => {
        const hw = HW + Math.round(k * grow * 2);
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

  heatColor(c: number): number {
    return this.trimHeat > 0.5 ? mix(c, HOT_TINT, 0.65) : c;
  }

  /** An expanding iso ring along the platform plane. */
  shockwave(col: number, row: number, delay: number, color: number, ms: number, reach = 230): void {
    const s = isoToScreen(col, row);
    const g = this.add(this.scene.add.graphics()).setDepth(D2.flash + 1);
    void this.run(
      ms,
      (k) => {
        g.clear();
        const rx = Math.round(30 + k * reach);
        const a = 1 - k;
        g.lineStyle(2, color, a);
        g.strokeEllipse(s.x, s.y, rx * 2, rx);
        g.lineStyle(1, color, a * 0.5);
        g.strokeEllipse(s.x, s.y, rx * 2 - 14, rx - 7);
      },
      'Cubic.Out',
      delay,
    ).then(() => this.remove(g));
  }

  // ================================================================ particles

  spawn(kind: Particle['kind'], x: number, y: number, color: number, vy?: number): Particle | null {
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
    p.spin = 0;
    switch (kind) {
      case 'spark':
        p.vy = vy ?? -(10 + r() * 14);
        p.life = 500 + r() * 400;
        p.sway = 1.5;
        p.alpha = 1;
        p.img.setTexture('arena:mote').setDepth(D2.motes);
        break;
      case 'mote':
        p.vy = -(2 + r() * 5);
        p.vx = (r() - 0.5) * 3;
        p.life = 4000 + r() * 4000;
        p.sway = 4 + r() * 6;
        p.alpha = 0.3 + r() * 0.4;
        p.img.setTexture(r() < 0.25 ? 'arena:mote' : TEX.px1).setDepth(D2.motes);
        break;
      case 'confetti':
        p.vy = 6 + r() * 7;
        p.vx = 2 + r() * 4;
        p.life = 6000 + r() * 5000;
        p.sway = 5 + r() * 7;
        p.alpha = 1;
        p.spin = 90 + r() * 120;
        p.img.setTexture(AK2.confetti, '0').setDepth(D2.motes);
        break;
      case 'ember':
        p.vy = vy ?? -(14 + r() * 26);
        p.vx = (r() - 0.5) * 8;
        p.life = 1200 + r() * 1600;
        p.sway = 3 + r() * 4;
        p.alpha = 1;
        p.img.setTexture(r() < 0.35 ? TEX.px2 : TEX.px1).setDepth(D2.motes);
        break;
      case 'ash':
        p.vy = 5 + r() * 9;
        p.vx = 3 + r() * 6;
        p.life = 5000 + r() * 4000;
        p.sway = 5 + r() * 6;
        p.alpha = 0.5 + r() * 0.4;
        p.img.setTexture(r() < 0.3 ? TEX.px2 : TEX.px1).setDepth(D2.motes);
        break;
    }
    const normal = kind === 'ash' || kind === 'confetti';
    p.img.setTint(color).setBlendMode(normal ? Phaser.BlendModes.NORMAL : ADD).setVisible(true);
    return p;
  }

  private spawnAmbient(kind: 'mote' | 'confetti' | 'ash', midLife = false): void {
    const r = this.rnd;
    let x: number;
    let y: number;
    let color: number;
    if (kind === 'ash') {
      x = Math.floor(-20 + r() * (GAME_W + 20));
      y = Math.floor(-10 + (midLife ? r() * GAME_H : 0));
      color = r() < 0.5 ? PAL.stone2 : PAL.stone3;
    } else if (kind === 'confetti') {
      // drifting down through the floodlight cones
      const tw = TOWERS[Math.floor(r() * TOWERS.length)];
      const [ax, ay] = P(tw.aim.c, tw.aim.r);
      const k = midLife ? 0.2 + r() * 0.7 : r() * 0.25;
      x = Math.floor(tw.x + (ax - tw.x) * k + (r() - 0.5) * 50 * (0.3 + k));
      y = Math.floor(tw.y + (ay - tw.y) * k);
      const cs = [PAL.gold3, PAL.gold4, PAL.cyan3, PAL.crim3, PAL.mag3, PAL.teal3, PAL.white, PAL.cyan4, PAL.crim4];
      color = cs[Math.floor(r() * cs.length)];
    } else {
      // dust motes hanging in the floodlight cones
      const tw = TOWERS[Math.floor(r() * TOWERS.length)];
      const [ax, ay] = P(tw.aim.c, tw.aim.r);
      const k = 0.15 + r() * 0.8;
      x = Math.floor(tw.x + (ax - tw.x) * k + (r() - 0.5) * 70 * k);
      y = Math.floor(tw.y + (ay - tw.y) * k);
      color = r() < 0.5 ? PAL.white : PAL.gold4;
    }
    const p = this.spawn(kind, x, y, color);
    if (p && midLife) p.age = p.life * (0.1 + r() * 0.5);
  }

  private updateParticles(dt: number): void {
    const s = dt / 1000;
    const heat = this.heat;
    const light = this.lightAvg();
    let motes = 0;
    let conf = 0;
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
      else if (p.kind === 'confetti') conf++;
      else if (p.kind === 'ash') ash++;
      p.x += p.vx * s;
      p.y += p.vy * s;
      const k = p.age / p.life;
      const env = Math.sin(Math.PI * Math.min(1, k * 1.15));
      let a = p.alpha * env;
      if (p.kind === 'mote') a *= (1 - heat) * light * (0.6 + 0.4 * Math.sin(this.t / 300 + p.phase * 5));
      if (p.kind === 'confetti') {
        a = p.alpha * Math.min(1, k * 8, (1 - k) * 6) * (1 - heat);
        // tumble: 4 shapes + an edge-on sliver
        const f = Math.floor((this.t * p.spin) / 60000 + p.phase * 3) % 5;
        p.img.setFrame(String(f));
      }
      if (p.kind === 'ash') a *= heat;
      if (p.kind === 'ember') {
        a *= 0.65 + 0.35 * Math.sin(this.t / 40 + p.phase * 9);
        p.vy *= 1 - 0.25 * s;
        p.img.setTint(k < 0.35 ? PAL.fire4 : k < 0.7 ? PAL.fire3 : PAL.fire2);
      }
      const sx = Math.sin(this.t / 900 + p.phase) * p.sway;
      p.img.setPosition(Math.round(p.x + sx), Math.round(p.y)).setAlpha(Math.max(0, a));
    }
    if (motes < 22 * (1 - heat) && this.rnd() < 0.1) this.spawnAmbient('mote');
    if (conf < 30 * (1 - heat) && this.rnd() < 0.08) this.spawnAmbient('confetti');
    if (ash < 26 * heat && this.rnd() < 0.12) this.spawnAmbient('ash');
    this.lava.emberTick();
  }

  // ================================================================ tick

  lightAvg(): number {
    return this.towerLevel.reduce((a, b) => a + b, 0) / this.towerLevel.length;
  }

  private tick(_time: number, delta: number): void {
    if (this.destroyed) return;
    const dt = Math.min(50, delta) * this.scene.time.timeScale;
    this.t += dt;
    this.frame++;
    this.stepJobs(dt);
    const t = this.t;
    const heat = this.heat;
    const light = this.lightAvg();

    this.stadium.tick(dt, t, heat, this.towerLevel);

    // ---- lights-off darkness and the floodlight layer
    this.dark.setAlpha((1 - light) * 0.62).setVisible(light < 0.999);
    this.lavaWash.setAlpha(heat * (0.16 + 0.04 * Math.sin(t / 520))).setVisible(heat > 0.001);
    for (const pl of this.pools) {
      const lvl = this.towerLevel[pl.tower];
      const breathe = 0.5 + 0.5 * Math.sin(t / 2300 + pl.phase);
      const tint = mix(PAL.white, PAL.fire4, heat);
      pl.img.setAlpha(lvl * (0.11 + 0.025 * breathe) * (1 - 0.45 * heat)).setTint(tint);
      pl.core.setAlpha(lvl * (0.09 + 0.025 * breathe) * (1 - 0.45 * heat)).setTint(tint);
    }
    for (const c of this.cones) {
      const lvl = this.towerLevel[c.tower];
      c.img.setAlpha(lvl * (0.26 + 0.05 * Math.sin(t / 1700 + c.tower))).setTint(mix(PAL.white, PAL.fire3, heat));
    }

    // ---- trim (per side)
    const th = this.trimHeat;
    this.trims.forEach((tr, cls) => {
      const lvl = cls === 2 ? this.sideLevel[2] : this.sideLevel[cls];
      const flash = cls === 2 ? 0 : this.sideFlash[cls];
      const isActive = cls !== 2 && this.active === cls;
      tr.cool.setAlpha(lvl * (1 - th));
      tr.hot.setAlpha(lvl * th).setVisible(th > 0.001);
      const pulse = isActive ? 0.24 + 0.16 * (0.5 + 0.5 * Math.sin(t / 520)) : 0.08;
      const g = Math.min(1, pulse + flash * 0.9);
      tr.coolGlow.setAlpha(g * (1 - th));
      tr.hotGlow.setAlpha(g * th).setVisible(th > 0.001);
    });
    this.updateRunners();

    // ---- tiles: neon inlays pulse; the halo spills colored light on the marble
    for (const tile of this.tiles) {
      const pl = tile.zone.player;
      const isActive = this.active === pl;
      const w = 0.5 + 0.5 * Math.sin(t / 420 - tile.phase);
      const lvl = this.sideLevel[pl];
      const base = isActive ? 0.22 : this.active === null ? 0.16 : 0.1;
      const amp = isActive ? 0.3 : 0.16;
      const color = this.heatColor(PLAYER_COLOR[pl]);
      tile.glow.setAlpha(Math.min(1, base + amp * w + tile.boost)).setTint(color);
      tile.halo.setAlpha(Math.min(0.6, (0.1 + 0.07 * w) * lvl + tile.boost * 0.3)).setTint(color);
      tile.boost = Math.max(0, tile.boost - dt / 600);
    }
    this.bridgeFlow.setFrame(String(Math.floor(t / 70) % FLOW_FRAMES)).setTint(mix(PAL.mist, PAL.fire3, heat));
    this.bridgeFlow.setAlpha(0.7 + 0.25 * Math.sin(t / 800));
    // lane chevrons chase toward the opponent of the active player
    for (const ch of this.chevrons) {
      const on = this.active === ch.player;
      const ph = ((t / 140 - ch.step) % 4 + 4) % 4;
      const k = on ? (ph < 1 ? 1 - ph : 0) : 0;
      ch.img.setAlpha(on ? 0.25 + 0.75 * k : 0.12).setTint(this.heatColor(PLAYER_COLOR[ch.player]));
    }

    this.lava.tick(dt);

    // ---- highlights & particles
    for (const [k, h] of this.highlights) if (!this.updateHighlight(h, dt)) this.highlights.delete(k);
    this.updateParticles(dt);
  }

  private updateRunners(): void {
    const speed = 0.085;
    this.runners.forEach((rn, p) => {
      const isActive = this.active === p;
      const cycle = rn.len + 300;
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
      const vis = s0 <= rn.len && isActive;
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
}

/** Integer screen center of a zone (v2 tile centers are whole pixels). */
function zoneXYi(player: PlayerId, spot: BoardSpot, index: number): { x: number; y: number } {
  const c = zoneCell(player, spot, index);
  const s = isoToScreen(c.col, c.row);
  return { x: Math.round(s.x), y: Math.round(s.y) };
}

/** Polyline (world px) of a player's border trim: their half of the platform rim. */
export function trimPath2(player: PlayerId): { x: number; y: number }[] {
  // the trim runs 4.5px (vertical) inside the outer edge: inset 4.5/40 grid units
  const e = 4.5 / 40;
  const c0 = -0.8 + e;
  const c1 = BOARD_COLS - 0.5 + 0.3 - e;
  const r0 = -0.8 + e;
  const r1 = BOARD_ROWS - 0.5 + 0.3 - e;
  const pts: [number, number][] =
    player === 0
      ? [
          [c0, 3.5],
          [c0, r1],
          [c1, r1],
          [c1, 3.5],
        ]
      : [
          [c1, 1.5],
          [c1, r0],
          [c0, r0],
          [c0, 1.5],
        ];
  return pts.map(([c, r]) => {
    const [x, y] = P(c, r);
    return { x: Math.round(x), y: Math.round(y) };
  });
}

export { cellKind, duelistXY, FACE_T, HALO_PAD, HL_H, HL_W, RING_FRAMES };
