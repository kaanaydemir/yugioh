// BoardViewCalm — the calm arena of the v3 look (?look=v3, docs/ANIMASYON_PLANI.md §0 "Arena",
// docs/v3/A0_ENVANTER.md §5.5): the still preview's board (src/still) in the game — the v1 board
// geometry as a dark matte slab, flat navy zone pads with one thin cyan / red outline, ONE neon
// trim along the platform edge, a calm ink sky with one violet haze band over a two-tier stadium.
// Served through src/view/BoardView.ts (same public API) when LOOK_V3.
//
// The light language is the still's: flat tone steps, never alpha. A lit pad is its interior mask
// tinted one tone toward the light's hue, a lit line / trim is one tone up its own ramp, and
// every overlay is opaque (tinted white masks are exact PAL colours). Motion is stepped too:
// ignition, pulses and flashes move through discrete tones; position changes are whole pixels.
//
// Ambient life (golden rule 1, calm): a light runner along the active side's trim, an occasional
// glint running round one zone line, a few dust motes drifting up past the platform, faint stars
// above the frame (seen in the opening descent). The volcano theme keeps the night sky: lava runs
// in the seams between the zones in flat fire tones, the haze band on the roof warms one step,
// the trim overheats to fire tones.
//
// The backdrop sits at the top of the stadium depth band (PLATFORM − 0.9 …), so the v1 / v2 volcano
// veil of vfx/setpieces.ts setVolcanoAmbience (a full-sky red overlay at STADIUM + 4 … PLATFORM − 1)
// stays hidden behind it: the calm volcano keeps its night sky (only its embers and ash, drawn in
// front of the board, still show).
//
// Ambient motion runs on scene time × scene.time.timeScale through the tick-driven job runner, so
// it is deterministic under the stepped QA clock and freezes during hit-stop.

import Phaser from 'phaser';
import { type ArenaTheme, type CrackField, SLAB_RECT, type ZoneHit, buildCrackField, cellZone } from '../../art/arena';
import { PAL, RAMPS } from '../../art/palette';
import { type Color, mulberry32 } from '../../art/pixel';
import type { PlayerId } from '../../engine/types';
import { TEX, shake } from '../../vfx/core';
import { type BoardSpot, DEPTH, GAME_W, isoToScreen, screenToIso, zoneCell } from '../layout';
import {
  CALM,
  CALM_BG_PARTS,
  CALM_BG_TONE,
  CALM_T,
  type CalmArt,
  type CalmBgPart,
  type TrimPiece,
  type TrimSide,
  calmColorAt,
  calmZones,
  chevronPositions,
} from './art';
import { buildCalmTextures } from './textures';

type Img = Phaser.GameObjects.Image;

/** Sub-depths inside the layout DEPTH bands. */
const D = {
  base: DEPTH.PLATFORM - 0.9,
  bg: DEPTH.PLATFORM - 0.8,
  stars: DEPTH.PLATFORM - 0.7,
  motesFar: DEPTH.PLATFORM - 0.6,
  slab: DEPTH.PLATFORM,
  trimDead: DEPTH.PLATFORM + 1,
  trim: DEPTH.PLATFORM + 1.1,
  trimFx: DEPTH.PLATFORM + 2,
  pad: DEPTH.TILE,
  padFill: DEPTH.TILE + 1,
  padLine: DEPTH.TILE + 2,
  padFx: DEPTH.TILE + 2.5,
  lava: DEPTH.TILE + 3,
  hlFill: DEPTH.TILE_FX,
  hlLine: DEPTH.TILE_FX + 1,
  hlMarch: DEPTH.TILE_FX + 2,
  hlTips: DEPTH.TILE_FX + 3,
  flash: DEPTH.TILE_FX + 5,
  ring: DEPTH.TILE_FX + 5.5,
  motes: DEPTH.TILE_FX + 8,
} as const;

// ---------------------------------------------------------------- tones

/** The neutral ramp the night tones step along (ink … white). */
const NEUTRAL: readonly Color[] = [PAL.ink, PAL.night0, PAL.night1, PAL.night2, PAL.night3, PAL.night4, PAL.steel, PAL.mist, PAL.white];
const HUE_RAMPS: readonly (readonly Color[])[] = Object.entries(RAMPS)
  .filter(([k]) => k !== 'night')
  .map(([, r]) => r);

/** The ramp a colour belongs to (nearest ramp colour when it is not a PAL ramp entry). */
function rampOf(c: Color): { ramp: readonly Color[]; i: number } {
  let i = NEUTRAL.indexOf(c);
  if (i >= 0) return { ramp: NEUTRAL, i };
  for (const r of HUE_RAMPS) {
    i = r.indexOf(c);
    if (i >= 0) return { ramp: r, i };
  }
  let best = Infinity;
  let out = { ramp: NEUTRAL, i: 0 };
  for (const r of [NEUTRAL, ...HUE_RAMPS])
    r.forEach((q, k) => {
      const d = (((q >> 16) & 255) - ((c >> 16) & 255)) ** 2 + (((q >> 8) & 255) - ((c >> 8) & 255)) ** 2 + ((q & 255) - (c & 255)) ** 2;
      if (d < best) {
        best = d;
        out = { ramp: r, i: k };
      }
    });
  return out;
}

/** `c` moved k tones along its ramp (clamped). */
function step(c: Color, k: number): Color {
  const { ramp, i } = rampOf(c);
  return ramp[Math.max(0, Math.min(ramp.length - 1, i + k))];
}

/** The pad interior lit one step toward hue `c` (the still's light LUT: a dark tone of the hue). */
function padLight(c: Color): Color {
  const { ramp } = rampOf(c);
  return ramp === NEUTRAL ? PAL.night2 : ramp[0];
}

/** Neon that is off: the glass of a dead tube. [P1, P2, neutral] for front / back edges. */
const TRIM_DEAD = { front: [PAL.cyan0, PAL.crim0, PAL.night2], back: [PAL.night1, PAL.night1, PAL.night1] } as const;
/** Overheated trim (volcano). */
const TRIM_HOT = { front: [PAL.fire2, PAL.fire2, PAL.fire1], back: [PAL.fire1, PAL.fire1, PAL.fire0] } as const;
const LINE_DEAD: Record<PlayerId, Color> = { 0: PAL.cyan0, 1: PAL.crim0 };
/** Background tones with the stadium lights off, and in the volcano theme (the roof's haze band reflects the lava: one warm step). */
const BG_DARK: Record<CalmBgPart, Color> = { haze: PAL.ink, stands: PAL.night0, standsLow: PAL.ink, disc: PAL.ink };
const BG_HOT: Record<CalmBgPart, Color> = { haze: PAL.crim0, stands: PAL.night1, standsLow: PAL.night0, disc: PAL.night0 };
/** Lava light on the matte floor next to a seam (one flat step toward fire; the neon is not lit). */
const FIRE_STEP = new Map<Color, Color>([
  [PAL.ink, PAL.fire0],
  [PAL.night0, PAL.fire0],
  [PAL.night1, PAL.fire0],
  [PAL.stone0, PAL.fire0],
  [PAL.night2, PAL.crim0],
]);
const LAVA = [PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4] as const;
const COOL = [PAL.stone1, PAL.stone0] as const;

// ---------------------------------------------------------------- records

interface Zone {
  ref: ZoneHit;
  col: number;
  row: number;
  x: number;
  y: number;
  pad: Img;
  fill: Img;
  line: Img;
  base: Color;
  lit: boolean;
  /** per-frame overrides written by the running effects (null = rest) */
  lineOv: Color | null;
  fillOv: Color | null;
  /** grid distance to the owner's podium */
  podDist: number;
}

interface Trim {
  piece: TrimPiece;
  dead: Img;
  lit: Img;
}

interface Highlight {
  zone: Zone;
  color: Color;
  fill: Img;
  line: Img;
  tips: Img[];
  march: Img[];
  k: number;
  dying: boolean;
  born: number;
  sparkAt: number;
}

interface Particle {
  img: Img;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  sway: number;
  phase: number;
  tones: readonly Color[];
  kind: 'dust' | 'spark';
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

interface Star {
  img: Img;
  tone: Color;
  next: number;
  until: number;
}

export interface BoardViewCalmOptions {
  theme?: ArenaTheme;
  active?: PlayerId | null;
  lights?: boolean;
  volcanoFrom?: PlayerId | null;
}

let instanceCounter = 0;

export class BoardViewCalm {
  readonly scene: Phaser.Scene;
  private readonly id = ++instanceCounter;
  private readonly art: CalmArt;
  private readonly objs: Phaser.GameObjects.GameObject[] = [];
  private readonly rnd = mulberry32(3301);
  private t = 0;
  private frame = 0;
  private destroyed = false;
  private jobs: Job[] = [];

  private bg = {} as Record<CalmBgPart, Img[]>;
  private bgLit: Record<CalmBgPart, boolean> = { haze: true, stands: true, standsLow: true, disc: true };
  private bgHot: Record<CalmBgPart, boolean> = { haze: false, stands: false, standsLow: false, disc: false };
  private zones: Zone[] = [];
  private trims: Trim[] = [];
  /** lit part of each side's strip, as [lo, hi] in strip px (the ignition grows it from the podium) */
  private reveal: Record<TrimSide, [number, number]> = { 0: [0, Infinity], 1: [0, Infinity], 2: [0, Infinity] };
  /** per trim piece: show the hot (volcano) tone */
  private trimHot: boolean[] = [];
  private highlights = new Map<string, Highlight>();
  private parts: Particle[] = [];
  private stars: Star[] = [];
  private fxPx: Img[] = [];
  private fxUsed = 0;
  private ring: Phaser.GameObjects.Graphics;

  private themeName: ArenaTheme = 'normal';
  private themeToken = 0;
  private active: PlayerId | null = null;
  /** runner along the active side's trim: side, its start time and whether it stops at the end */
  private runner: { side: 0 | 1; t0: number; last: boolean } | null = null;
  private glintAt = 1800;

  // lava (volcano)
  private crack: CrackField | null = null;
  private crackKey = '';
  private crackFront = 0;
  private crackFlow = false;
  /** 0 = hot, 1…4 = cooling steps (4 = gone) */
  private lavaCool = 4;
  private haloTone: Int32Array | null = null;
  private lavaTex: Phaser.Textures.CanvasTexture | null = null;
  private lavaData: ImageData | null = null;
  private lavaImg: Img | null = null;

  constructor(scene: Phaser.Scene, opts: BoardViewCalmOptions = {}) {
    this.scene = scene;
    this.art = buildCalmTextures(scene);
    this.ring = this.add(scene.add.graphics()).setDepth(D.ring);
    this.buildBackground();
    this.buildSlab();
    this.buildZones();
    this.buildParticles();
    this.setActivePlayer(opts.active ?? null, false);
    if (opts.lights === false) void this.setLights(false, false);
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

  /** Zone under a world-space point, pixel-accurate to the drawn diamonds (v1 rule). */
  zoneAt(x: number, y: number): ZoneHit | null {
    const g = screenToIso(Math.floor(x) + 0.5, Math.floor(y) + 0.5);
    return cellZone(Math.round(g.col), Math.round(g.row));
  }

  /** The pad image of a zone (its own pixels: gap ring, zone line, pad). */
  tileImage(player: PlayerId, spot: BoardSpot, index = 0): Img | null {
    return this.zoneOf(player, spot, index)?.pad ?? null;
  }

  /**
   * Target outline on a zone: the zone line takes `color`, the pad steps one tone toward it, four
   * chevrons lock on from outside and breathe, a 3-px light runs round the line. null removes it.
   */
  highlightZone(player: PlayerId, spot: BoardSpot, index: number, color: number | null): void {
    const key = `${player}:${spot}:${index}`;
    const cur = this.highlights.get(key);
    if (color === null) {
      if (cur) cur.dying = true;
      return;
    }
    if (cur) {
      cur.dying = false;
      cur.color = color;
      return;
    }
    const zone = this.zoneOf(player, spot, index);
    if (!zone) return;
    const mk = (frame: string, depth: number) => this.add(this.scene.add.image(zone.x, zone.y, CALM.atlas, frame).setDepth(depth));
    const tip = (frame: string, fx: boolean, fy: boolean) => this.add(this.scene.add.image(0, 0, CALM.atlas, frame).setOrigin(0).setDepth(D.hlTips).setFlip(fx, fy));
    const h: Highlight = {
      zone,
      color,
      fill: mk(CALM.maskFill, D.hlFill),
      line: mk(CALM.maskLine, D.hlLine),
      tips: [tip(CALM.tipT, false, false), tip(CALM.tipT, false, true), tip(CALM.tipL, false, false), tip(CALM.tipL, true, false)],
      march: [0, 1, 2].map(() => this.add(this.scene.add.image(0, 0, TEX.px1).setOrigin(0).setDepth(D.hlMarch))),
      k: 0,
      dying: false,
      born: this.t,
      sparkAt: this.t + 140,
    };
    this.highlights.set(key, h);
    this.updateHighlight(h, 0);
  }

  clearHighlights(): void {
    for (const h of this.highlights.values()) h.dying = true;
  }

  /** A stepped flash on one zone (impact, set card, effect target). Resolves when it has faded. */
  flashTile(player: PlayerId, spot: BoardSpot, index: number, color: number, ms = 320): Promise<void> {
    const zone = this.zoneOf(player, spot, index);
    if (!zone) return Promise.resolve();
    return this.flashZone(zone, color, ms);
  }

  /** Turn start: light fronts run out along `player`'s trim from the podium, the side's pads pulse in a wave. */
  async pulseSide(player: PlayerId): Promise<void> {
    const P = this.art.paths[player];
    const jobs: Promise<void>[] = [];
    // two fronts along the trim, out from the podium
    const reach = Math.max(P.podium, P.len - P.podium);
    jobs.push(
      this.run(
        reach / 0.6,
        (k) => {
          const r = k * reach;
          for (const dir of [-1, 1]) for (let i = 0; i < 6; i++) this.trimPx(player, P.podium + dir * (r - i), i === 0 ? 2 : 1);
        },
        'Linear',
      ),
    );
    // the pads: back row first (nearest the podium), each a short stepped swell
    for (const z of this.zones) {
      if (z.ref.player !== player) continue;
      const lit = padLight(PLAYER_TONE[player]);
      jobs.push(
        this.run(
          300,
          (k) => {
            const ms = k * 300;
            z.fillOv = lit;
            z.lineOv = step(z.base, ms < 70 || ms > 220 ? 1 : 2);
          },
          'Linear',
          Math.round(40 + (z.podDist - 1) * 130),
        ),
      );
    }
    await Promise.all(jobs);
  }

  /** The active side: a light runner travels its trim (null = neither side). */
  setActivePlayer(player: PlayerId | null, animate = true): void {
    if (player === this.active) return;
    this.active = player;
    if (!animate || !this.runner) {
      this.runner = player === null ? null : { side: player, t0: this.t, last: false };
      return;
    }
    // the old runner finishes its lap, the new one starts at its seam
    this.runner.last = true;
    if (player !== null) {
      const old = this.runner;
      const P = this.art.paths[old.side];
      const left = Math.max(0, (P.len - this.runnerPos(old)) / RUNNER_SPEED);
      void this.wait(Math.min(left, 900)).then(() => {
        if (this.active === player) this.runner = { side: player, t0: this.t, last: false };
      });
    } else this.runner.last = true;
  }

  /**
   * 'volcano' (Volkan Arenası): from `from`'s field zone (or the board centre) the field pad
   * erupts, lava runs out through the seams between the zones in flat fire tones, the trim
   * sputters and overheats, the haze band on the roof warms one step. The sky stays night.
   * 'normal': the lava cools through stone tones and goes, the neon cools back. ~1.2 s animated.
   */
  async setTheme(theme: ArenaTheme, animate = true, from: PlayerId | null = null): Promise<void> {
    const token = ++this.themeToken;
    if (theme === 'volcano') {
      const origin = from === null ? { col: 2, row: 2 } : zoneCell(from, 'field');
      this.ensureLava(origin);
      const f = this.crack!;
      const end = f.maxDist + 16;
      this.themeName = 'volcano';
      this.lavaCool = 0;
      if (!animate) {
        this.crackFront = end;
        this.crackFlow = true;
        for (const p of CALM_BG_PARTS) this.bgHot[p] = true;
        this.trimHot = this.trims.map(() => true);
        this.paintLava();
        return;
      }
      this.crackFlow = false;
      this.crackFront = 0;
      this.paintLava();
      void shake(this.scene, 1150, 2);
      const fz = from === null ? null : this.zoneOf(from, 'field', 0);
      if (fz) void this.flashZone(fz, PAL.fire3, 380);
      this.shockwave(origin.col, origin.row, [PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1], 640, 170);
      const ok = () => token === this.themeToken;
      const jobs = [
        this.run(900, (k) => ok() && (this.crackFront = k * f.mostDist), 'Sine.Out').then(() =>
          this.run(200, (k) => ok() && (this.crackFront = f.mostDist + k * (end - f.mostDist))),
        ),
        // the haze band on the roof picks up the lava light as it spreads
        this.wait(420).then(() => ok() && (this.bgHot.haze = true)),
        // the neon sputters as it overheats (each piece on its own beat), then holds the fire tone
        ...this.trims.map((tr, i) =>
          this.run(
            520,
            (k) => {
              if (!ok()) return;
              const beat = Math.floor(k * 8 + (i % 3));
              this.trimHot[i] = k >= 1 || beat % 2 === 1;
            },
            'Linear',
            330 + ((i * 47) % 160),
          ),
        ),
      ];
      await Promise.all(jobs);
      if (!ok()) return;
      this.crackFront = end;
      this.crackFlow = true;
      this.trimHot = this.trims.map(() => true);
      return;
    }
    // back to normal: the lava cools in steps and goes, the neon and the haze cool back
    this.themeName = 'normal';
    if (!animate || !this.crack) {
      this.lavaCool = 4;
      for (const p of CALM_BG_PARTS) this.bgHot[p] = false;
      this.trimHot = this.trims.map(() => false);
      this.syncLava();
      return;
    }
    const ok = () => token === this.themeToken;
    this.crackFlow = false;
    await Promise.all([
      this.run(900, (k) => ok() && (this.lavaCool = Math.min(4, Math.floor(k * 5))), 'Quad.In'),
      this.wait(250).then(() => ok() && (this.trimHot = this.trims.map(() => false))),
      this.wait(400).then(() => ok() && (this.bgHot.haze = false)),
    ]);
    if (ok()) {
      this.lavaCool = 4;
      this.syncLava();
    }
  }

  /**
   * The stadium lights. With animate (from dark) the stands step up out of the dark, the neon trim
   * ignites from each duelist's podium outward along the platform edge, then the zone lines
   * sputter on row by row (~1.5 s). Without: at once.
   */
  async setLights(on: boolean, animate = true): Promise<void> {
    const allLit = () => CALM_BG_PARTS.every((p) => this.bgLit[p]) && this.zones.every((z) => z.lit);
    if (!animate || (on && allLit())) {
      for (const p of CALM_BG_PARTS) this.bgLit[p] = on;
      for (const z of this.zones) z.lit = on;
      for (const s of [0, 1, 2] as TrimSide[]) this.reveal[s] = on ? [0, Infinity] : [0, -1];
      return;
    }
    if (!on) {
      // lights out: the zone lines, then the trim, then the stands (stepped, ~0.4 s)
      for (const z of this.zones) z.lit = false;
      await this.wait(120);
      for (const s of [0, 1, 2] as TrimSide[]) this.reveal[s] = [0, -1];
      await this.wait(140);
      this.bgLit.haze = this.bgLit.stands = false;
      await this.wait(140);
      this.bgLit.standsLow = this.bgLit.disc = false;
      return;
    }
    // ignition from dark
    for (const p of CALM_BG_PARTS) this.bgLit[p] = false;
    for (const z of this.zones) z.lit = false;
    for (const s of [0, 1, 2] as TrimSide[]) this.reveal[s] = [0, -1];
    const jobs: Promise<unknown>[] = [
      this.wait(80).then(() => (this.bgLit.standsLow = true)),
      this.wait(170).then(() => (this.bgLit.disc = true)),
      this.wait(260).then(() => (this.bgLit.stands = true)),
      this.wait(380).then(() => (this.bgLit.haze = true)),
    ];
    for (const side of [0, 1] as const) {
      const P = this.art.paths[side];
      const reach = Math.max(P.podium, P.len - P.podium) + 2;
      jobs.push(
        this.run(
          reach / 0.42,
          (k) => {
            const r = k * reach;
            this.reveal[side] = [P.podium - r, P.podium + r];
            // the ignition spark at both fronts
            for (const dir of [-1, 1]) for (let i = 0; i < 3; i++) this.trimPx(side, P.podium + dir * (r - i), i === 0 ? 2 : 1);
          },
          'Linear',
          side === 0 ? 300 : 420,
        ),
      );
    }
    // the neutral band pieces sputter on once both fronts have passed them
    jobs.push(
      this.run(
        180,
        (k) => {
          const ms = k * 180;
          this.reveal[2] = ms < 40 || (ms > 80 && ms < 110) || ms >= 150 ? [0, Infinity] : [0, -1];
        },
        'Linear',
        880,
      ),
    );
    // zone lines: back row first, each sputters on
    for (const z of this.zones) {
      jobs.push(
        this.run(
          200,
          (k) => {
            const ms = k * 200;
            const on = ms < 50 || (ms >= 90 && ms < 150);
            z.lineOv = on ? step(z.base, 1) : k >= 1 ? null : LINE_DEAD[z.ref.player];
            if (on) z.fillOv = padLight(z.base);
            if (k >= 1) z.lit = true;
          },
          'Linear',
          Math.round(700 + (z.podDist - 1) * 150 + (z.ref.player === 1 ? 90 : 0)),
        ),
      );
    }
    await Promise.all(jobs);
    for (const p of CALM_BG_PARTS) this.bgLit[p] = true;
    for (const z of this.zones) z.lit = true;
    for (const s of [0, 1, 2] as TrimSide[]) this.reveal[s] = [0, Infinity];
  }

  /** The current turn number (arena v2 scoreboard; the calm arena has none — kept for the API). */
  setTurn(_turn: number | null): void {
    /* no scoreboard */
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

  private img(x: number, y: number, key: string, depth: number, frame?: string): Img {
    return this.add(this.scene.add.image(x, y, key, frame).setOrigin(0).setDepth(depth));
  }

  private buildBackground(): void {
    // ink everywhere the camera can reach (sky, roof, the ground far below), the masks on top
    this.add(this.scene.add.rectangle(-200, -480, GAME_W + 400, 1000, CALM_T.sky).setOrigin(0).setDepth(D.base));
    CALM_BG_PARTS.forEach((part, i) => {
      this.bg[part] = this.art.bg[part].map((L, k) => this.img(L.x, L.y, CALM.bg, D.bg + i * 0.01, CALM.bgFrame(part, k)).setTint(CALM_BG_TONE[part]));
    });
    // a few faint stars above the frame (they show as the opening camera descends)
    const r = mulberry32(91);
    for (let i = 0; i < 44; i++) {
      const x = Math.floor(-70 + r() * (GAME_W + 140));
      const y = Math.floor(-330 + r() * 316);
      const tone = r() < 0.2 ? PAL.night4 : r() < 0.6 ? PAL.night3 : PAL.night2;
      const img = this.img(x, y, TEX.px1, D.stars).setTint(tone);
      this.stars.push({ img, tone, next: 400 + r() * 5000, until: 0 });
    }
  }

  private buildSlab(): void {
    const S = this.art.slab;
    this.img(S.x, S.y, CALM.slab, D.slab);
    for (const piece of this.art.trims) {
      const L = piece.layer;
      const dead = this.img(L.x, L.y, CALM.atlas, D.trimDead, CALM.trim(piece.n)).setVisible(false);
      const lit = this.img(L.x, L.y, CALM.atlas, D.trim, CALM.trim(piece.n));
      this.trims.push({ piece, dead, lit });
      this.trimHot.push(false);
    }
  }

  private buildZones(): void {
    for (const z of calmZones()) {
      const c = zoneCell(z.player, z.spot, z.index);
      const s = isoToScreen(c.col, c.row);
      const pod = z.player === 0 ? { col: 2, row: 5.35 } : { col: 2, row: -1.35 };
      this.zones.push({
        ref: { player: z.player, spot: z.spot, index: z.index },
        col: c.col,
        row: c.row,
        x: s.x,
        y: s.y,
        pad: this.add(this.scene.add.image(s.x, s.y, CALM.atlas, CALM.pad(z.player, z.spot, z.index)).setDepth(D.pad)),
        fill: this.add(this.scene.add.image(s.x, s.y, CALM.atlas, CALM.maskFill).setDepth(D.padFill).setVisible(false)),
        line: this.add(this.scene.add.image(s.x, s.y, CALM.atlas, CALM.maskLine).setDepth(D.padLine).setVisible(false)),
        base: CALM_T.line[z.player],
        lit: true,
        lineOv: null,
        fillOv: null,
        podDist: Math.hypot(c.col - pod.col, c.row - pod.row),
      });
    }
  }

  private buildParticles(): void {
    for (let i = 0; i < 40; i++) {
      const img = this.add(this.scene.add.image(0, 0, TEX.px1).setOrigin(0).setVisible(false));
      this.parts.push({ img, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, sway: 0, phase: 0, tones: DUST, kind: 'dust', alive: false });
    }
    for (let i = 0; i < DUST_N; i++) this.spawnDust(true);
  }

  private zoneOf(player: PlayerId, spot: BoardSpot, index: number): Zone | undefined {
    return this.zones.find((z) => z.ref.player === player && z.ref.spot === spot && z.ref.index === index);
  }

  // ================================================================ effects

  /** Stepped flash: the pad steps down the hue ramp, the line from its top, a ring runs out. */
  private flashZone(z: Zone, color: Color, ms: number): Promise<void> {
    const { ramp } = rampOf(color);
    const top = ramp.length - 1;
    const fills = [ramp[Math.max(0, top - 2)], ramp[Math.max(0, top - 3)], padLight(color)];
    const lines = [ramp[top], ramp[Math.max(0, top - 1)], ramp[Math.max(0, top - 2)]];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + this.rnd();
      this.spark(Math.round(z.x + Math.cos(a) * 26), Math.round(z.y + Math.sin(a) * 12), [ramp[top], ramp[Math.max(0, top - 1)], ramp[Math.max(0, top - 2)]], -(18 + this.rnd() * 22));
    }
    return Promise.all([
      this.run(ms, (k) => {
        const s = k < 0.22 ? 0 : k < 0.55 ? 1 : 2;
        z.fillOv = fills[s];
        z.lineOv = lines[s];
      }),
      this.diamondRing(z.x, z.y, [ramp[top], ramp[Math.max(0, top - 1)], ramp[Math.max(0, top - 2)]], ms * 1.1, 12),
    ]).then(() => undefined);
  }

  /** A crisp 1-px tile-shaped ring growing `grow` px outward, stepping down `tones`. */
  private diamondRing(x: number, y: number, tones: readonly Color[], ms: number, grow: number): Promise<void> {
    const g = this.add(this.scene.add.graphics()).setDepth(D.flash);
    return this.run(
      ms,
      (k) => {
        g.clear();
        if (k >= 1) return;
        const hw = 32 + 2 * Math.round(k * grow);
        g.fillStyle(tones[Math.min(tones.length - 1, Math.floor(k * tones.length))], 1);
        stairDiamond(g, x, y, hw, null);
      },
      'Cubic.Out',
    ).then(() => this.remove(g));
  }

  /** The volcano eruption: a tile-shaped ring runs out over the platform top only. */
  private shockwave(col: number, row: number, tones: readonly Color[], ms: number, reach: number): void {
    const s = isoToScreen(col, row);
    const kinds = this.art.kinds;
    const g = this.ring;
    void this.run(
      ms,
      (k) => {
        g.clear();
        if (k >= 1) return;
        const hw = 32 + 2 * Math.round(k * reach);
        g.fillStyle(tones[Math.min(tones.length - 1, Math.floor(k * tones.length))], 1);
        stairDiamond(g, s.x, s.y, hw, (x, y) => x >= 0 && y >= 0 && x < GAME_W && kinds[y * GAME_W + x] > 0);
      },
      'Cubic.Out',
    ).then(() => g.clear());
  }

  // ================================================================ lava (volcano)

  private ensureLava(origin: { col: number; row: number }): void {
    const key = `${origin.col},${origin.row}`;
    if (!(this.crack && this.crackKey === key)) {
      this.crack = buildCrackField(origin);
      this.crackKey = key;
      // the halo ring next to each seam: the floor there takes one step toward fire
      const f = this.crack;
      const tones = new Int32Array(f.halo.length).fill(-1);
      for (let k = 0; k < f.halo.length; k++) {
        if (f.haloRing[k] !== 1) continue;
        const i = f.halo[k];
        const x = (i % SLAB_RECT.w) + SLAB_RECT.x;
        const y = Math.floor(i / SLAB_RECT.w) + SLAB_RECT.y;
        const t = FIRE_STEP.get(calmColorAt(this.art, x, y));
        if (t !== undefined) tones[k] = t;
      }
      this.haloTone = tones;
    }
    if (!this.lavaTex) {
      const texKey = `calm:lava:${this.id}`;
      if (this.scene.textures.exists(texKey)) this.scene.textures.remove(texKey);
      const cv = document.createElement('canvas');
      cv.width = SLAB_RECT.w;
      cv.height = SLAB_RECT.h;
      cv.getContext('2d', { willReadFrequently: true });
      this.lavaTex = this.scene.textures.addCanvas(texKey, cv);
      if (!this.lavaTex) throw new Error('calm arena: cannot create lava canvas');
      this.lavaData = this.lavaTex.getContext().createImageData(SLAB_RECT.w, SLAB_RECT.h);
      this.lavaImg = this.img(SLAB_RECT.x, SLAB_RECT.y, texKey, D.lava);
    }
  }

  /** Paint the cracks in flat tones: the white-hot front, flowing fire tones, cooling to stone. */
  private paintLava(): void {
    const f = this.crack;
    if (!f || !this.lavaTex || !this.lavaData) return;
    const data = this.lavaData.data;
    data.fill(0);
    const front = this.crackFront;
    const flow = this.crackFlow ? this.t : null;
    const cool = this.lavaCool;
    const put = (o: number, c: Color) => {
      data[o] = (c >> 16) & 255;
      data[o + 1] = (c >> 8) & 255;
      data[o + 2] = c & 255;
      data[o + 3] = 255;
    };
    if (cool < 4) {
      for (let k = 0; k < f.core.length; k++) {
        const d = f.coreDist[k];
        if (d > front) continue;
        const age = front - d;
        let tone: number;
        if (flow === null && age < 3) tone = 3;
        else {
          tone = 1 + (f.coreTone[k] >> 1);
          if (flow !== null) {
            const w = 0.5 + 0.5 * Math.sin((d - flow * 0.045) / 7);
            if (w > 0.9) tone = 3;
            else if (w > 0.62) tone = Math.max(tone, 2);
            else if (w < 0.15) tone = Math.max(0, tone - 1);
          } else tone = age < 10 ? 3 : age < 40 ? Math.max(tone, 2) : tone;
        }
        tone -= cool;
        put(f.core[k] * 4, tone >= 0 ? LAVA[Math.min(3, tone)] : COOL[Math.min(1, -tone - 1)]);
      }
      const halo = this.haloTone;
      if (halo && cool < 2)
        for (let k = 0; k < f.halo.length; k++) {
          if (halo[k] < 0 || f.haloDist[k] > front) continue;
          put(f.halo[k] * 4, halo[k]);
        }
    }
    this.lavaTex.getContext().putImageData(this.lavaData, 0, 0);
    this.lavaTex.refresh();
  }

  private syncLava(): void {
    if (!this.lavaImg) return;
    this.lavaImg.setVisible(this.lavaCool < 4);
  }

  // ================================================================ trim + pixel fx

  private runnerPos(r: { t0: number }): number {
    return (this.t - r.t0) * RUNNER_SPEED;
  }

  /** Light the strip pixel at position s of `side` `up` tones above its current tone (this frame only). */
  private trimPx(side: 0 | 1, s: number, up: number): void {
    const P = this.art.paths[side];
    const i = Math.round(s);
    if (i < 0 || i >= P.len) return;
    const q = P.px[i];
    const [lo, hi] = this.reveal[side];
    const lit = i >= lo && i <= hi;
    const hot = this.themeName === 'volcano' && this.trimHot.some((h) => h);
    const front = q.tone === CALM_T.trim[side];
    const base = !lit ? (front ? TRIM_DEAD.front[side] : TRIM_DEAD.back[side]) : hot ? (front ? TRIM_HOT.front[side] : TRIM_HOT.back[side]) : q.tone;
    this.fxDot(q.x, q.y, step(base, up), D.trimFx);
  }

  /** A 1-px fx dot for this frame (pooled). */
  private fxDot(x: number, y: number, color: Color, depth: number): void {
    let img = this.fxPx[this.fxUsed];
    if (!img) {
      img = this.add(this.scene.add.image(0, 0, TEX.px1).setOrigin(0));
      this.fxPx.push(img);
    }
    this.fxUsed++;
    img.setPosition(x, y).setTint(color).setDepth(depth).setVisible(true);
  }

  private spark(x: number, y: number, tones: readonly Color[], vy: number): void {
    const p = this.parts.find((q) => !q.alive);
    if (!p) return;
    p.alive = true;
    p.kind = 'spark';
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = vy;
    p.age = 0;
    p.life = 420 + this.rnd() * 300;
    p.sway = 1.5;
    p.phase = this.rnd() * Math.PI * 2;
    p.tones = tones;
    p.img.setDepth(D.motes).setVisible(true);
  }

  private spawnDust(midLife = false): void {
    const p = this.parts.find((q) => !q.alive);
    if (!p) return;
    const r = this.rnd;
    p.alive = true;
    p.kind = 'dust';
    p.x = Math.floor(110 + r() * 420);
    p.y = Math.floor(90 + r() * 230);
    p.vx = (r() - 0.5) * 2;
    p.vy = -(2.5 + r() * 4.5);
    p.age = 0;
    p.life = 5000 + r() * 5000;
    p.sway = 3 + r() * 5;
    p.phase = r() * Math.PI * 2;
    p.tones = DUST;
    // behind the platform when it starts below the slab's far edge, else in front
    p.img.setDepth(r() < 0.35 ? D.motesFar : D.motes).setVisible(true);
    if (midLife) p.age = p.life * (0.15 + r() * 0.6);
  }

  // ================================================================ highlights

  private updateHighlight(h: Highlight, dt: number): boolean {
    h.k = Math.max(0, Math.min(1, h.k + (h.dying ? -dt / 110 : dt / 130)));
    if (h.dying && h.k <= 0) {
      for (const o of [h.fill, h.line, ...h.tips, ...h.march]) this.remove(o);
      return false;
    }
    const c = h.color;
    const z = h.zone;
    const age = this.t - h.born;
    const stage = h.k < 0.34 ? 0 : h.k < 0.67 ? 1 : 2;
    h.line.setTint(step(c, stage - 2));
    h.fill.setVisible(stage > 0).setTint(padLight(c));
    // chevrons lock on from further out, then breathe 0..2 px
    const settle = h.dying ? 1 - h.k : Math.max(0, 1 - age / 220);
    const d = 2 + Math.round(1 - Math.cos(age / 190) + settle * settle * 6);
    const pos = chevronPositions(z.x, z.y, d);
    const [tt, tb, tl, tr] = h.tips;
    tt.setPosition(pos.t.x, pos.t.y);
    tb.setPosition(pos.b.x, pos.b.y);
    tl.setPosition(pos.l.x, pos.l.y);
    tr.setPosition(pos.r.x, pos.r.y);
    for (const t of h.tips) t.setTint(stage === 2 ? c : step(c, -1)).setVisible(stage > 0);
    // a 3-px light runs round the zone line
    const L = this.art.linePath;
    const head = Math.floor(age * 0.06) % L.length;
    h.march.forEach((m, i) => {
      const q = L[(head - i + L.length) % L.length];
      m.setPosition(z.x - 32 + q.x, z.y - 16 + q.y)
        .setTint(step(c, i === 0 ? 1 : 0))
        .setVisible(stage === 2);
    });
    // a spark rises off the outline now and then
    if (!h.dying && stage === 2 && this.t >= h.sparkAt) {
      h.sparkAt = this.t + 200 + this.rnd() * 260;
      const q = L[Math.floor(this.rnd() * L.length)];
      this.spark(z.x - 32 + q.x, z.y - 16 + q.y, [step(c, 1), c, step(c, -1)], -(12 + this.rnd() * 12));
    }
    return true;
  }

  // ================================================================ job runner

  /**
   * Animate k: 0→1 over `ms` of board time after `delay`, driven by tick() from the game loop's
   * delta × scene.time.timeScale (deterministic under frame stepping, frozen by hit-stop).
   */
  private run(ms: number, fn: (k: number) => unknown, ease = 'Linear', delay = 0): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    return new Promise((done) => {
      const e = Phaser.Tweens.Builders.GetEaseFunction(ease) as (v: number) => number;
      this.jobs.push({ delay, t: 0, dur: Math.max(1, ms), ease: e, fn: (k) => void fn(k), done });
    });
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

  // ================================================================ tick

  private tick(_time: number, delta: number): void {
    if (this.destroyed) return;
    const dt = Math.min(50, delta) * this.scene.time.timeScale;
    this.t += dt;
    this.frame++;
    for (const z of this.zones) {
      z.lineOv = null;
      z.fillOv = null;
    }
    this.fxUsed = 0;
    this.stepJobs(dt);

    // ---- background
    for (const part of CALM_BG_PARTS) {
      const tone = !this.bgLit[part] ? BG_DARK[part] : this.bgHot[part] ? BG_HOT[part] : CALM_BG_TONE[part];
      for (const im of this.bg[part]) im.setTint(tone);
    }
    for (const s of this.stars) {
      if (this.t >= s.next) {
        s.until = this.t + 90 + this.rnd() * 120;
        s.next = this.t + 2500 + this.rnd() * 6000;
      }
      s.img.setTint(this.t < s.until ? step(s.tone, 2) : s.tone);
    }

    // ---- trims
    this.trims.forEach((tr, i) => {
      const p = tr.piece;
      const [lo, hi] = this.reveal[p.side];
      const deadTone = (p.back ? TRIM_DEAD.back : TRIM_DEAD.front)[p.side];
      const litTone = this.trimHot[i] ? (p.back ? TRIM_HOT.back : TRIM_HOT.front)[p.side] : (p.back ? CALM_T.trimBack : CALM_T.trim)[p.side];
      const a = p.px[0].s;
      const b = p.px[p.px.length - 1].s;
      if (hi < a || lo > b) {
        tr.lit.setVisible(false);
        tr.dead.setVisible(true).setTint(deadTone);
        return;
      }
      tr.lit.setVisible(true).setTint(litTone);
      if (lo <= a && hi >= b) {
        tr.lit.setCrop();
        tr.dead.setVisible(false);
        return;
      }
      // partly lit (ignition): crop the lit image to the revealed run, the dead one shows the rest
      let x0 = Infinity;
      let x1 = -Infinity;
      for (const q of p.px)
        if (q.s >= lo && q.s <= hi) {
          x0 = Math.min(x0, q.x);
          x1 = Math.max(x1, q.x);
        }
      const L = p.layer;
      tr.lit.setCrop(x0 - L.x, 0, x1 - x0 + 1, L.canvas.h);
      tr.dead.setVisible(true).setTint(deadTone);
    });

    // ---- the active side's runner (a 4-px light, one tone up, a lap every ~8 s)
    if (this.runner) {
      const r = this.runner;
      const P = this.art.paths[r.side];
      const cycle = P.len + RUNNER_PAUSE * RUNNER_SPEED;
      let s = this.runnerPos(r);
      if (r.last && s > P.len + 4) this.runner = null;
      else {
        if (!r.last) s %= cycle;
        for (let i = 0; i < 4; i++) this.trimPx(r.side, s - i, 1);
      }
    }

    // ---- a glint runs once round one zone line now and then
    this.glintAt -= dt;
    if (this.glintAt <= 0) {
      this.glintAt = 2200 + this.rnd() * 2600;
      const pool = this.zones.filter((z) => z.lit && (this.active === null || z.ref.player === this.active));
      const z = pool[Math.floor(this.rnd() * pool.length)];
      if (z) {
        const L = this.art.linePath;
        const start = Math.floor(this.rnd() * L.length);
        void this.run(L.length / 0.11, (k) => {
          if (k >= 1) return;
          for (let i = 0; i < 4; i++) {
            const q = L[(start + Math.floor(k * L.length) - i + L.length) % L.length];
            this.fxDot(z.x - 32 + q.x, z.y - 16 + q.y, step(z.base, 1), D.padFx);
          }
        });
      }
    }

    // ---- zones
    for (const z of this.zones) {
      const line = z.lineOv ?? (z.lit ? z.base : LINE_DEAD[z.ref.player]);
      z.line.setVisible(line !== z.base).setTint(line);
      z.fill.setVisible(z.fillOv !== null);
      if (z.fillOv !== null) z.fill.setTint(z.fillOv);
    }

    // ---- lava
    if (this.crack && this.lavaImg) {
      const spreading = !this.crackFlow && this.themeName === 'volcano';
      const cooling = this.themeName === 'normal' && this.lavaCool < 4;
      if (spreading || cooling || (this.crackFlow && this.frame % 4 === 0)) this.paintLava();
      this.syncLava();
    }

    // ---- highlights, particles, unused fx dots
    for (const [k, h] of this.highlights) if (!this.updateHighlight(h, dt)) this.highlights.delete(k);
    this.updateParticles(dt);
    for (let i = this.fxUsed; i < this.fxPx.length; i++) this.fxPx[i].setVisible(false);
  }

  private updateParticles(dt: number): void {
    const s = dt / 1000;
    const hot = this.themeName === 'volcano';
    let dust = 0;
    for (const p of this.parts) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.alive = false;
        p.img.setVisible(false);
        continue;
      }
      if (p.kind === 'dust') dust++;
      p.x += p.vx * s;
      p.y += p.vy * s * (hot && p.kind === 'dust' ? 2.2 : 1);
      const k = p.age / p.life;
      const tones = p.kind === 'dust' && hot ? EMBER : p.tones;
      // dust: rises through its tones and back (a slow stepped glimmer); sparks step down
      const idx = p.kind === 'dust' ? Math.min(tones.length - 1, Math.floor((1 - Math.abs(1 - 2 * k)) * tones.length)) : Math.min(tones.length - 1, Math.floor(k * tones.length));
      const sx = Math.sin(this.t / 900 + p.phase) * p.sway;
      p.img.setPosition(Math.round(p.x + sx), Math.round(p.y)).setTint(tones[idx]);
    }
    if (dust < DUST_N && this.rnd() < 0.05) this.spawnDust();
  }
}

// ---------------------------------------------------------------- constants + helpers

const PLAYER_TONE: Record<PlayerId, Color> = { 0: PAL.cyan3, 1: PAL.crim3 };
const RUNNER_SPEED = 0.05; // px per ms
const RUNNER_PAUSE = 1400; // ms between laps
const DUST_N = 12;
/** Dust: night tones up to steel and back. */
const DUST: readonly Color[] = [PAL.night2, PAL.night3, PAL.night4, PAL.steel];
const EMBER: readonly Color[] = [PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4];

/**
 * Fill the 1-px outer ring of a 2:1 diamond of half-width `hw` (even) centred at (cx, cy) — the
 * same stairs as the 64×32 tiles (local dv ∈ [0, 1)), two pixels per column. `keep` filters pixels.
 */
function stairDiamond(g: Phaser.GameObjects.Graphics, cx: number, cy: number, hw: number, keep: ((x: number, y: number) => boolean) | null): void {
  const hh = hw / 2;
  for (let i = 0; i < 2 * hw; i++) {
    const a = Math.abs(i + 0.5 - hw) / 2;
    const u = Math.floor(hh - a - 0.5) + 0.5;
    if (u < 0.5 || u <= hh - a - 1) continue;
    const x = cx - hw + i;
    for (const y of [cy - u - 0.5, cy + u - 0.5]) if (!keep || keep(x, y)) g.fillRect(x, y, 1, 1);
  }
}
