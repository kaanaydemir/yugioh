// HD Neon arena — runtime: builds every layer at its depth band and keeps it alive.
//
// Ambient life (all driven from the scene's update delta × time scale, so it is deterministic under the stepped
// test clock and follows the shell's Space 3× speed): star twinkle + shooting stars, aurora drift and breathing,
// searchlight sweeps, crowd blink layers + a Mexican wave + camera flashes, LED ribbon chase, fog drift, the core
// crystal's pulse and descending rings, thruster shafts, trim runners on the active side, tile pulse waves, the
// bridge's energy flow, dust motes that only shine inside light shafts, and one slow wandering spotlight that
// glides over the board (a real Light2D light: the floor's normal maps answer it with glints).

import Phaser from 'phaser';
import { PAL, PLAYER_COLOR } from '../../../art/palette';
import { mix, mulberry32 } from '../../../art/pixel';
import type { PlayerId } from '../../../engine/types';
import { DEPTH, type BoardSpot, zoneCell } from '../../../view/layout';
import { HD_BLOOM, SOFT } from '../../app/fx';
import { getKit, type HDKit } from '../../app/kit';
import { makeLitTexture, useLighting, type LightHandle } from '../../app/lighting';
import type { ArenaBuildOptions, ArenaHandle } from '../../contracts';
import { BRIDGE_RECT, CORE_XY, SKY_RECT, SLAB_RECT, STADIUM_RECT, THRUSTERS, TOWERS, TW, type TrimClass, cellZone, iso, rimY, screenToGrid, standsBottomY, trimPath, type ZoneHit } from './geo';
import { drawPlatform } from './platform';
import { Raster, cropped, toCanvas } from './raster';
import { addTex, softTex } from './tex';
import { AURORA, BEAM, beamAlpha, drawAurora, drawSky, drawStarFrame } from './sky';
import { CROWD_STRIPS, FOG, SOFT_Q, drawLamp, drawStadium, fogAlpha, hazeAlpha, reflection } from './stadium';
import { FLOW_FRAMES, TILE_SPOTS, drawBridge, drawBridgeFlow, drawTile, drawTileFill } from './tiles';

type Img = Phaser.GameObjects.Image;
type TSprite = Phaser.GameObjects.TileSprite;
const ADD = Phaser.BlendModes.ADD;

/** Sub-depths inside the layout DEPTH bands. */
const D = {
  sky: DEPTH.SKY,
  aurora: DEPTH.SKY + 1.5,
  stars: DEPTH.SKY + 2,
  shooting: DEPTH.SKY + 2.5,
  beams: DEPTH.SKY + 5,
  haze: DEPTH.STADIUM - 1,
  stadium: DEPTH.STADIUM,
  farGlow: DEPTH.STADIUM + 3,
  reflect: DEPTH.STADIUM + 4,
  fogFar: DEPTH.STADIUM + 5,
  motesFar: DEPTH.STADIUM + 6,
  fogLow: DEPTH.PLATFORM - 5,
  under: DEPTH.PLATFORM - 4,
  rings: DEPTH.PLATFORM - 3,
  shafts: DEPTH.PLATFORM - 2,
  slab: DEPTH.PLATFORM,
  fogNear: DEPTH.PLATFORM + 6,
  tile: DEPTH.TILE,
  motesNear: DEPTH.TILE_FX + 8,
} as const;

/** Parallax scroll factors (camera pushes move far layers less). */
const SF = { sky: 0.2, stadium: 0.5, fogFar: 0.6, fogNear: 1.15 } as const;

/** Floor material for the lit pipeline: glossy glass / obsidian, saturated neon stays self-lit. */
const FLOOR_MAT = { spec: 0.95, shine: 34, emissive: 0.32 };
const SLAB_MAT = { spec: 0.7, shine: 26, emissive: 0.32 };

// ---------------------------------------------------------------- texture cache (per env pixel, survives scene restarts)

const origins = new Map<string, { x: number; y: number }>();
const key = (name: string, P: number) => `hd:neon:${name}:${P}`;

function ensureTextures(scene: Phaser.Scene, P: number): void {
  const done = key('done', P);
  if (scene.textures.exists(done) && origins.has(key('slab', P))) return;
  const t0 = performance.now();
  const ms: Record<string, number> = {};
  const timed = (name: string, fn: () => void) => {
    const a = performance.now();
    fn();
    ms[name] = Math.round(performance.now() - a);
  };
  const layer = (name: string, r: Raster, which: 'col' | 'glw' = 'col', linear = false) => {
    const c = cropped(r, which);
    const k = key(name, P);
    if (!c) {
      addTex(scene, k, toCanvas(new Uint8ClampedArray(4), 1, 1));
      origins.set(k, { x: 0, y: 0 });
      return;
    }
    addTex(scene, k, c.cv, linear);
    origins.set(k, { x: c.x, y: c.y });
  };

  timed('sky', () => {
    addTex(scene, key('sky', P), drawSky(P).colorCanvas());
    for (let i = 0; i < 2; i++) addTex(scene, key(`aurora${i}`, P), drawAurora(P, 11 + i * 7).colorCanvas());
    // star frames sheet
    const n = P === 1 ? 9 : 5;
    const frames = [0, 1, 2, 3].map((f) => drawStarFrame(P, f));
    const sheet = new Uint8ClampedArray(n * 4 * n * 4);
    frames.forEach((fr, f) => {
      for (let j = 0; j < n; j++) sheet.set(fr.col.subarray(j * n * 4, (j + 1) * n * 4), (j * n * 4 + f * n) * 4);
    });
    const tex = addTex(scene, key('star', P), toCanvas(sheet, n * 4, n));
    for (let f = 0; f < 4; f++) tex.add(String(f), 0, f * n, 0, n, n);
    softTex(scene, key('beam', 1), BEAM.w, BEAM.h, beamAlpha);
  });

  timed('stadium', () => {
    const st = drawStadium(P);
    addTex(scene, key('stadium', P), st.base.colorCanvas());
    st.crowd.forEach((strips, l) => strips.forEach((r, s) => layer(`crowd${l}_${s}`, r)));
    st.led.forEach((r, i) => layer(`led${i}`, r));
    layer('ring', st.ring, 'glw');
    addTex(scene, key('lamp', P), drawLamp(P).colorCanvas());
  });

  timed('soft', () => {
    const q = SOFT_Q;
    const R = STADIUM_RECT;
    softTex(scene, key('haze', 1), Math.ceil(R.w / q), Math.ceil(380 / q), (x, y) => hazeAlpha(R.x + x * q, R.y + y * q));
    // LED reflections: colour + alpha
    {
      const w = Math.ceil(R.w / q);
      const h = Math.ceil(360 / q);
      const y0 = 228;
      const d = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          let rr = 0;
          let gg = 0;
          let bb = 0;
          let aa = 0;
          // supersample 2×2 (streaks are thin)
          for (const [sx, sy] of [
            [0.25, 0.25],
            [0.75, 0.25],
            [0.25, 0.75],
            [0.75, 0.75],
          ]) {
            const s = reflection(R.x + (x + sx) * q, y0 + (y + sy) * q);
            rr += ((s.c >> 16) & 255) * s.a;
            gg += ((s.c >> 8) & 255) * s.a;
            bb += (s.c & 255) * s.a;
            aa += s.a;
          }
          const o = (y * w + x) * 4;
          if (aa <= 0) continue;
          d[o] = rr / aa;
          d[o + 1] = gg / aa;
          d[o + 2] = bb / aa;
          d[o + 3] = Math.min(255, (aa / 4) * 255);
        }
      addTex(scene, key('reflect', 1), toCanvas(d, w, h), true);
      origins.set(key('reflect', 1), { x: R.x, y: y0 });
    }
    for (let k = 0; k < 3; k++) softTex(scene, key(`fog${k}`, 1), FOG.w, FOG.h, (x, y) => fogAlpha(k, x, y));
    // energy glow beneath the platform: cyan (P1, left) → crimson (P2, right), hot center
    const uw = 316;
    const uh = 128;
    softTex(
      scene,
      key('under', 1),
      uw,
      uh,
      (x, y) => {
        const ex = (x - uw / 2) / (uw / 2);
        const ey = (y - uh * 0.42) / (uh * 0.55);
        const r = Math.hypot(ex, ey);
        return r >= 1 ? 0 : Math.pow(1 - r, 1.5);
      },
      (x, y) => {
        const ex = (x - uw / 2) / (uw / 2);
        const ey = (y - uh * 0.42) / (uh * 0.55);
        const t = Math.max(0, Math.min(1, (ex + 0.25) / 0.5));
        const c = mix(PAL.cyan2, PAL.crim2, t);
        return Math.hypot(ex, ey) < 0.3 ? mix(c, PAL.white, 0.35 * (1 - Math.hypot(ex, ey) / 0.3)) : c;
      },
    );
    // thruster shaft and core beam: soft cones fading downward
    softTex(scene, key('shaft', 1), 24, 128, (x, y) => {
      const t = y / 128;
      const half = 2.2 + t * 8;
      const off = Math.abs(x - 12);
      return off > half ? 0 : Math.pow(1 - off / half, 1.4) * Math.pow(1 - t, 1.7);
    });
    softTex(scene, key('corebeam', 1), 64, 176, (x, y) => {
      const t = y / 176;
      const half = 4 + t * 26;
      const off = Math.abs(x - 32);
      return off > half ? 0 : Math.pow(1 - off / half, 1.3) * Math.pow(1 - t, 1.25);
    });
    // light pools where the shafts touch the floor
    softTex(scene, key('pool', 1), 64, 32, (x, y) => {
      const r = Math.hypot((x - 32) / 32, (y - 16) / 16);
      return r >= 1 ? 0 : Math.pow(1 - r, 2);
    });
  });

  timed('platform', () => {
    const pl = drawPlatform(P);
    makeLitTexture(scene, key('slab', P), pl.slab.colorCanvas(), pl.slab.normalCanvas());
    origins.set(key('slab', P), { x: SLAB_RECT.x, y: SLAB_RECT.y });
    pl.glow.forEach((r, cls) => layer(`trim${cls}`, r, 'glw'));
  });

  timed('tiles', () => {
    for (const spot of TILE_SPOTS)
      for (const pl of [0, 1] as PlayerId[]) {
        const r = drawTile(spot, pl, P);
        makeLitTexture(scene, key(`tile_${spot}_${pl}`, P), r.colorCanvas(), r.normalCanvas());
        addTex(scene, key(`tileglow_${spot}_${pl}`, P), r.glowCanvas());
      }
    addTex(scene, key('tilefill', P), drawTileFill(P).colorCanvas());
    const br = drawBridge(P);
    makeLitTexture(scene, key('bridge', P), br.colorCanvas(), br.normalCanvas());
    addTex(scene, key('bridgeglow', P), br.glowCanvas());
    // flow frames (sheet)
    const fw = Math.ceil(BRIDGE_RECT.w / P);
    const fh = Math.ceil(BRIDGE_RECT.h / P);
    const cols = Math.min(FLOW_FRAMES, Math.floor(4096 / fw));
    const rows = Math.ceil(FLOW_FRAMES / cols);
    const sheet = new Uint8ClampedArray(cols * fw * rows * fh * 4);
    for (let f = 0; f < FLOW_FRAMES; f++) {
      const fr = drawBridgeFlow(P, f);
      const ox = (f % cols) * fw;
      const oy = Math.floor(f / cols) * fh;
      for (let j = 0; j < fh; j++) sheet.set(fr.col.subarray(j * fw * 4, (j + 1) * fw * 4), ((oy + j) * cols * fw + ox) * 4);
    }
    const tex = addTex(scene, key('flow', P), toCanvas(sheet, cols * fw, rows * fh));
    for (let f = 0; f < FLOW_FRAMES; f++) tex.add(String(f), 0, (f % cols) * fw, Math.floor(f / cols) * fh, fw, fh);
  });

  timed('small', () => {
    // descending energy rings (crisp ellipses) under the core
    const RW = 204;
    const RH = 108;
    const n = 8;
    const fw = Math.ceil(RW / P);
    const fh = Math.ceil(RH / P);
    const sheet = new Uint8ClampedArray(fw * n * fh * 4);
    for (let f = 0; f < n; f++) {
      const r = new Raster({ x: -RW / 2, y: -RH / 2, w: RW, h: RH }, P);
      const rx = 15 + (f / (n - 1)) * 81;
      const inE = (i: number, j: number, k: number) => {
        const dx = r.wx(i) / (rx - k);
        const dy = r.wy(j) / ((rx - k) / 2);
        return dx * dx + dy * dy <= 1;
      };
      r.each((i, j) => {
        for (const [k, c] of [
          [0, 0xffffff],
          [2.2 * P, 0x707070],
        ] as const) {
          if (k > 0 && f < 2) continue;
          if (inE(i, j, k) && !(inE(i + 1, j, k) && inE(i - 1, j, k) && inE(i, j + 1, k) && inE(i, j - 1, k))) r.put(i, j, c);
        }
      });
      for (let j = 0; j < fh; j++) sheet.set(r.col.subarray(j * fw * 4, (j + 1) * fw * 4), (j * fw * n + f * fw) * 4);
    }
    const tex = addTex(scene, key('rings', P), toCanvas(sheet, fw * n, fh));
    for (let f = 0; f < n; f++) tex.add(String(f), 0, f * fw, 0, fw, fh);
    // motes: a single art pixel and a small plus
    const px = new Uint8ClampedArray([255, 255, 255, 255]);
    addTex(scene, key('px', 1), toCanvas(px, 1, 1));
    const plus = new Uint8ClampedArray(9 * 4);
    for (const [i, v] of [
      [1, 128],
      [3, 128],
      [4, 255],
      [5, 128],
      [7, 128],
    ]) {
      plus.set([v, v, v, 255], i * 4);
    }
    addTex(scene, key('plus', 1), toCanvas(plus, 3, 3));
    // crowd camera flash: 4-point star
    const fl = new Uint8ClampedArray(7 * 7 * 4);
    for (let k = -3; k <= 3; k++) {
      const v = k === 0 ? 255 : Math.abs(k) === 1 ? 190 : Math.abs(k) === 2 ? 110 : 50;
      fl.set([v, v, v, 255], ((3) * 7 + 3 + k) * 4);
      if (Math.abs(k) < 3) fl.set([v, v, v, 255], ((3 + k) * 7 + 3) * 4);
    }
    addTex(scene, key('flash', 1), toCanvas(fl, 7, 7));
  });
  addTex(scene, done, toCanvas(new Uint8ClampedArray(4), 1, 1));
  const total = Math.round(performance.now() - t0);
  const neon = window.__neon as unknown as Record<string, unknown> | undefined;
  if (neon) neon.hdArenaBuild = { P, total, ...ms };
}

// ---------------------------------------------------------------- runtime

interface TileRec {
  col: number;
  row: number;
  zone: ZoneHit;
  img: Img;
  glow: Img;
  phase: number;
  boost: number;
}

interface Particle {
  img: Img;
  kind: 'mote' | 'moteFar' | 'spark';
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

export class NeonArena implements ArenaHandle {
  readonly P: 1 | 2;
  private readonly scene: Phaser.Scene;
  private readonly kit: HDKit;
  private readonly objs: Phaser.GameObjects.GameObject[] = [];
  private readonly rnd = mulberry32(1337);
  private t = 0;
  private destroyed = false;
  private jobs: Job[] = [];
  private farGlow!: Phaser.GameObjects.Layer;

  // sky
  private aurora: TSprite[] = [];
  private stars: { img: Img; speed: number; phase: number; maxFrame: number; base: number }[] = [];
  private beams: { img: Img; glow: Img; lamp: Img; tower: number }[] = [];
  private shootClock = 2600;
  // stadium
  private haze!: Img;
  private crowd: { img: Img; layer: number; strip: number }[] = [];
  private led: Img[] = [];
  private ring!: Img;
  private reflect!: Img;
  private flashClock = 0;
  private fogs: { spr: TSprite; speed: number; alpha: number }[] = [];
  // platform
  private under!: Img;
  private floorPools: Img[] = [];
  private core!: Img;
  private coreHalo!: Img;
  private coreBeam!: Img;
  private rings: { img: Img; age: number }[] = [];
  private shafts: { img: Img; pool: Img; cls: TrimClass; phase: number }[] = [];
  private ringClock = 0;
  private trims: Img[] = [];
  private sideLevel: [number, number, number] = [0.8, 0.8, 0.75];
  private sideFlash: [number, number] = [0, 0];
  private runners: { head: Img; dots: Img[]; path: { x: number; y: number }[]; len: number; seg: number[] }[] = [];
  // tiles
  private tiles: TileRec[] = [];
  private bridgeFlow!: Img;
  private bridgeGlow!: Img;
  private waveClock = 3200;
  private waveSide: PlayerId = 0;
  // particles & lights
  private parts: Particle[] = [];
  private spot: LightHandle | null = null;
  private active: PlayerId | null = null;
  private activeToken = 0;
  private gated = false;

  constructor(scene: Phaser.Scene, opts: ArenaBuildOptions) {
    this.scene = scene;
    this.P = opts.envPixel === 2 ? 2 : 1;
    this.kit = getKit(scene);
    ensureTextures(scene, this.P);
    this.farGlow = scene.add.layer().setDepth(D.farGlow);
    this.farGlow.setPostPipeline(HD_BLOOM);
    this.buildSky();
    this.buildStadium();
    this.buildPlatform();
    this.buildTiles();
    this.buildParticles();
    this.buildLights();
    this.setActivePlayer(opts.activePlayer ?? null, false);
    const params = (scene.registry.get('params') as URLSearchParams | undefined) ?? new URLSearchParams(location.search);
    this.tick(0, 0);
    this.gated = params.has('test');
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    // debug / test handle: window.__neon.hdArena.flashTile(0, 'monster', 1, 0xffd447)
    const neon = window.__neon as unknown as Record<string, unknown> | undefined;
    if (neon) neon.hdArena = this;
  }

  // ================================================================ ArenaHandle

  setActivePlayer(p: PlayerId | null, animate = true): void {
    this.active = p;
    const target: [number, number] = p === null ? [0.8, 0.8] : p === 0 ? [1, 0.5] : [0.5, 1];
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
    if (p !== null) void this.pulseSide(p);
  }

  /** A bright flash on one tile: neon fill, a crisp expanding diamond, sparks and a real light pulse on the floor. */
  flashTile(player: PlayerId, spot: BoardSpot, index: number, color: number, ms = 400): Promise<void> {
    const c = zoneCell(player, spot, index);
    return this.flashCell(c.col, c.row, color, ms);
  }

  /** Turn-start wave: light rolls across `player`'s tiles from their podium forward (not part of the contract). */
  async pulseSide(player: PlayerId): Promise<void> {
    const color = PLAYER_COLOR[player];
    const jobs: Promise<void>[] = [this.run(760, (k) => (this.sideFlash[player] = 1 - k), 'Quad.Out')];
    const pod = player === 0 ? { col: 2, row: 5.35 } : { col: 2, row: -1.35 };
    for (const t of this.tiles) {
      if (t.zone.player !== player) continue;
      const delay = Math.round((Math.hypot(t.col - pod.col, t.row - pod.row) - 1) * 130);
      const s = iso(t.col, t.row);
      const fill = this.kit.fx.glow(this.add(this.scene.add.image(s.x, s.y, key('tilefill', this.P)).setScale(this.P).setBlendMode(ADD).setTint(color).setAlpha(0)), 'back');
      jobs.push(
        this.run(
          300,
          (k) => {
            const e = envelope(k, 80, 50, 170);
            t.boost = Math.max(t.boost, e * 0.8);
            fill.setAlpha(e * 0.32);
          },
          'Linear',
          delay,
        ).then(() => this.remove(fill)),
      );
    }
    const path = trimPath(player);
    for (let i = 0; i < 16; i++) {
      const a = Math.floor(this.rnd() * (path.length - 1));
      const k = this.rnd();
      this.spawn('spark', path[a].x + (path[a + 1].x - path[a].x) * k, path[a].y + (path[a + 1].y - path[a].y) * k, color);
    }
    await Promise.all(jobs);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.spot?.destroy();
    this.spot = null;
    for (const o of this.objs) {
      this.scene.tweens.killTweensOf(o);
      if (o.active || o.scene) o.destroy();
    }
    this.objs.length = 0;
    if (this.farGlow.scene) this.farGlow.destroy();
    const pending = this.jobs;
    this.jobs = [];
    for (const j of pending) j.done();
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

  /** Image at a world top-left, art pixels scaled ×P. */
  private img(x: number, y: number, k: string, depth: number, sf = 1, scale: number = this.P): Img {
    return this.add(this.scene.add.image(x, y, k).setOrigin(0).setDepth(depth).setScrollFactor(sf).setScale(scale));
  }

  private layerImg(name: string, depth: number, sf = 1): Img {
    const k = key(name, this.P);
    const o = origins.get(k) ?? { x: 0, y: 0 };
    return this.img(o.x, o.y, k, depth, sf);
  }

  private buildSky(): void {
    const P = this.P;
    const R = SKY_RECT;
    this.img(R.x, R.y, key('sky', P), D.sky, SF.sky);
    for (let i = 0; i < 2; i++) {
      const a = this.add(this.scene.add.tileSprite(R.x, -118 + i * 20, Math.ceil(R.w / P), Math.ceil(AURORA.h / P), key(`aurora${i}`, P)))
        .setOrigin(0)
        .setScale(P)
        .setDepth(D.aurora + i * 0.1)
        .setScrollFactor(SF.sky)
        .setBlendMode(ADD);
      a.tilePositionX = i * 230;
      this.aurora.push(a);
    }
    // bright twinkling stars
    const r = mulberry32(77);
    for (let i = 0; i < 64; i++) {
      const x = Math.floor(R.x + 12 + r() * (R.w - 24));
      const y = Math.floor(R.y + 12 + r() * (R.h - 24));
      if (y > rimY(x) - 14) continue;
      const big = i < 22;
      const img = this.add(this.scene.add.image(Math.round(x / P) * P, Math.round(y / P) * P, key('star', P), big ? '2' : '1'))
        .setScale(P)
        .setDepth(D.stars)
        .setScrollFactor(SF.sky);
      this.stars.push({ img, speed: 0.0011 + r() * 0.003, phase: r() * Math.PI * 2, maxFrame: big ? 3 : 1, base: big ? 1 : 0.8 });
    }
    // searchlights: beams behind the stands, lit lamp banks and their glow (lamps bloom in the far glow layer)
    TOWERS.forEach((t, i) => {
      const lamp = this.img(t.x - 11, t.lampY - 7, key('lamp', P), D.farGlow, SF.stadium);
      this.farGlow.add(lamp);
      const glow = this.add(this.scene.add.image(t.x, t.lampY, SOFT.glow).setDisplaySize(70, 70).setScrollFactor(SF.stadium).setBlendMode(ADD).setTint(PAL.gold3));
      this.farGlow.add(glow);
      const beam = this.add(this.scene.add.image(t.x, t.lampY, key('beam', 1)))
        .setOrigin(0, 0.5)
        .setDepth(D.beams)
        .setScrollFactor(SF.stadium)
        .setBlendMode(ADD)
        .setScale(1.1, 1.15)
        .setVisible(!!t.beam);
      this.beams.push({ img: beam, glow, lamp, tower: i });
    });
  }

  private buildStadium(): void {
    const P = this.P;
    const R = STADIUM_RECT;
    this.haze = this.img(R.x, R.y, key('haze', 1), D.haze, SF.stadium, SOFT_Q).setBlendMode(ADD);
    this.img(R.x, R.y, key('stadium', P), D.stadium, SF.stadium);
    const ro = origins.get(key('reflect', 1))!;
    this.reflect = this.img(ro.x, ro.y, key('reflect', 1), D.reflect, SF.stadium, SOFT_Q).setBlendMode(ADD);
    this.ring = this.layerImg('ring', D.farGlow, SF.stadium).setBlendMode(ADD);
    this.farGlow.add(this.ring);
    for (let l = 0; l < 3; l++)
      for (let s = 0; s < CROWD_STRIPS; s++) {
        const im = this.layerImg(`crowd${l}_${s}`, D.farGlow, SF.stadium).setBlendMode(ADD);
        this.farGlow.add(im);
        this.crowd.push({ img: im, layer: l, strip: s });
      }
    for (let i = 0; i < 3; i++) {
      const im = this.layerImg(`led${i}`, D.farGlow, SF.stadium).setBlendMode(ADD);
      this.farGlow.add(im);
      this.led.push(im);
    }
    // fog: far haze at the stadium floor (two banks), a bank under the platform, wisps in the foreground
    const defs = [
      { k: 0, y: 228, h: 84, depth: D.fogFar, sf: SF.fogFar, speed: 0.006, color: PAL.night4, alpha: 0.4 },
      { k: 0, y: 290, h: 90, depth: D.fogFar + 0.1, sf: SF.fogFar, speed: -0.009, color: PAL.night4, alpha: 0.34 },
      { k: 1, y: 360, h: 130, depth: D.fogLow, sf: 1, speed: 0.0135, color: PAL.steel, alpha: 0.22 },
      { k: 2, y: 450, h: 100, depth: D.fogNear, sf: SF.fogNear, speed: 0.024, color: PAL.mist, alpha: 0.12 },
    ];
    for (const f of defs) {
      const spr = this.add(this.scene.add.tileSprite(-96, f.y, Math.ceil(1152 / 4), FOG.h, key(`fog${f.k}`, 1)))
        .setOrigin(0)
        .setScale(4, f.h / FOG.h)
        .setDepth(f.depth)
        .setScrollFactor(f.sf)
        .setTint(f.color)
        .setAlpha(f.alpha);
      spr.tilePositionX = Math.floor(this.rnd() * FOG.w);
      this.fogs.push({ spr, speed: f.speed, alpha: f.alpha });
    }
  }

  private buildPlatform(): void {
    const P = this.P;
    this.under = this.add(this.scene.add.image(480, 426, key('under', 1)).setDisplaySize(760, 300).setDepth(D.under).setBlendMode(ADD).setAlpha(0.6));
    // the side colours pooling on the glossy arena floor under each half of the platform
    for (const [x, y, c] of [
      [318, 470, PAL.cyan2],
      [642, 452, PAL.crim2],
    ] as const) {
      const pool = this.add(this.scene.add.image(x, y, SOFT.glow).setDisplaySize(420, 150).setDepth(D.under).setBlendMode(ADD).setTint(c).setAlpha(0.3));
      this.floorPools.push(pool);
    }
    this.coreBeam = this.add(this.scene.add.image(CORE_XY.x, CORE_XY.y - 8, key('corebeam', 1)).setOrigin(0.5, 0).setDepth(D.shafts).setBlendMode(ADD));
    for (let i = 0; i < 3; i++) {
      const img = this.add(this.scene.add.image(CORE_XY.x, CORE_XY.y, key('rings', P), '0')).setScale(P).setDepth(D.rings).setBlendMode(ADD).setAlpha(0);
      this.rings.push({ img, age: -1 });
    }
    THRUSTERS.forEach((th, i) => {
      const img = this.add(this.scene.add.image(th.x, th.y - 1, key('shaft', 1)).setOrigin(0.5, 0).setDepth(D.shafts).setBlendMode(ADD).setScale(1, 0.95));
      const pool = this.add(this.scene.add.image(th.x, th.y + 118, key('pool', 1)).setDepth(D.under).setBlendMode(ADD).setScale(1.3, 0.9));
      this.shafts.push({ img, pool, cls: th.cls, phase: i * 1.7 });
    });
    const o = origins.get(key('slab', P))!;
    useLighting(this.img(o.x, o.y, key('slab', P), D.slab), SLAB_MAT);
    for (let cls = 0; cls < 3; cls++) this.trims.push(this.kit.fx.glow(this.layerImg(`trim${cls}`, D.slab + 1).setBlendMode(ADD), 'back'));
    // the energy crystal's halo (bloom) and a hot core
    this.coreHalo = this.kit.fx.glowSprite(CORE_XY.x, CORE_XY.y - 2, PAL.cyan3, 72, 0.5, 'back');
    this.core = this.kit.fx.glowSprite(CORE_XY.x, CORE_XY.y - 3, PAL.cyan4, 22, 0.9, 'back', SOFT.core);
    this.add(this.coreHalo);
    this.add(this.core);
    // light runners racing along each side's trim
    for (const p of [0, 1] as PlayerId[]) {
      const path = trimPath(p);
      const seg: number[] = [0];
      for (let i = 1; i < path.length; i++) seg.push(seg[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
      const head = this.kit.fx.glowSprite(0, 0, PAL.white, 16, 0, 'back', SOFT.core);
      this.add(head);
      const dots = Array.from({ length: 9 }, () => this.kit.fx.glow(this.add(this.scene.add.image(0, 0, key('px', 1)).setScale(P * 2, P).setBlendMode(ADD)), 'back'));
      this.runners.push({ head, dots, path, len: seg[seg.length - 1], seg });
    }
  }

  private buildTiles(): void {
    const P = this.P;
    for (let row = 0; row < 5; row++)
      for (let col = 0; col < 5; col++) {
        const zone = cellZone(col, row);
        if (!zone) continue;
        const s = iso(col, row);
        const img = this.add(this.scene.add.image(s.x, s.y, key(`tile_${zone.spot}_${zone.player}`, P)).setScale(P).setDepth(D.tile));
        useLighting(img, FLOOR_MAT);
        const glow = this.kit.fx.glow(this.add(this.scene.add.image(s.x, s.y, key(`tileglow_${zone.spot}_${zone.player}`, P)).setScale(P).setBlendMode(ADD)), 'back');
        const back = zone.player === 0 ? 4 - row : row;
        this.tiles.push({ col, row, zone, img, glow, phase: back * 1.1 + Math.abs(col - 2) * 0.45, boost: 0 });
      }
    const B = BRIDGE_RECT;
    useLighting(this.img(B.x, B.y, key('bridge', P), D.tile), FLOOR_MAT);
    this.bridgeGlow = this.kit.fx.glow(this.img(B.x, B.y, key('bridgeglow', P), D.tile).setBlendMode(ADD), 'back');
    this.bridgeFlow = this.kit.fx.glow(this.img(B.x, B.y, key('flow', P), D.tile + 1).setFrame('0').setBlendMode(ADD).setTint(PAL.mist), 'back');
  }

  private buildParticles(): void {
    for (let i = 0; i < 110; i++) {
      const img = this.add(this.scene.add.image(0, 0, key('px', 1)).setVisible(false).setBlendMode(ADD));
      this.parts.push({ img, kind: 'mote', x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, sway: 0, phase: 0, alpha: 1, alive: false });
    }
    for (let i = 0; i < 22; i++) this.spawnAmbient('mote', true);
    for (let i = 0; i < 14; i++) this.spawnAmbient('moteFar', true);
  }

  private buildLights(): void {
    // a slow, soft searchlight spot wandering over the board: the floor's normal maps answer it with glints
    this.spot = this.kit.lighting.addPointLight(480, 240, 0xdfe6ff, 190, 0.38, 120);
  }

  // ================================================================ flashes

  private flashCell(col: number, row: number, color: number, ms: number): Promise<void> {
    const P = this.P;
    const s = iso(col, row);
    const fill = this.kit.fx.glow(this.add(this.scene.add.image(s.x, s.y, key('tilefill', P)).setScale(P).setBlendMode(ADD).setTint(color).setAlpha(0.95)), 'back');
    const tile = this.tiles.find((t) => t.col === col && t.row === row);
    if (tile) void this.run(ms * 1.4, (k) => (tile.boost = Math.max(tile.boost, 1 - k)), 'Quad.Out');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + this.rnd();
      this.spawn('spark', s.x + Math.cos(a) * 40, s.y + Math.sin(a) * 19, mix(color, PAL.white, 0.4), -(26 + this.rnd() * 30));
    }
    void this.kit.lighting.flashLight(s.x, s.y - 6, color, ms * 1.3, 1.15, 170, 50);
    return Promise.all([
      this.run(ms, (k) => fill.setAlpha(0.95 * (1 - k)), 'Quad.Out').then(() => this.remove(fill)),
      this.diamondRing(s.x, s.y, color, ms * 1.1, 18),
    ]).then(() => undefined);
  }

  /** A crisp tile-shaped outline growing outward by `grow` px while fading. */
  private diamondRing(x: number, y: number, color: number, ms: number, grow: number): Promise<void> {
    const P = this.P;
    const g = this.kit.fx.glow(this.add(this.scene.add.graphics().setBlendMode(ADD)), 'back');
    return this.run(
      ms,
      (k) => {
        const hw = TW / 2 + Math.round((k * grow * 2) / (2 * P)) * 2 * P;
        const hh = hw / 2;
        g.clear();
        g.lineStyle(P, color, 1 - k);
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

  // ================================================================ jobs (deterministic, tick-driven)

  private run(ms: number, fn: (k: number) => void, ease = 'Linear', delay = 0): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    return new Promise((done) => {
      const e = Phaser.Tweens.Builders.GetEaseFunction(ease) as (v: number) => number;
      this.jobs.push({ delay, t: 0, dur: Math.max(1, ms), ease: e, fn, done });
    });
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
    const P = this.P;
    p.alive = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.age = 0;
    p.phase = r() * Math.PI * 2;
    p.vx = 0;
    switch (kind) {
      case 'spark':
        p.vy = vy ?? -(14 + r() * 20);
        p.life = 520 + r() * 420;
        p.sway = 2;
        p.alpha = 1;
        p.img.setTexture(key(r() < 0.4 ? 'plus' : 'px', 1)).setDepth(D.motesNear);
        break;
      case 'mote':
        p.vy = -(4 + r() * 8);
        p.life = 4000 + r() * 4000;
        p.sway = 5 + r() * 8;
        p.alpha = 0.4 + r() * 0.5;
        p.img.setTexture(key(r() < 0.25 ? 'plus' : 'px', 1)).setDepth(D.motesNear);
        break;
      case 'moteFar':
        p.vy = -(3 + r() * 5);
        p.life = 5000 + r() * 5000;
        p.sway = 8 + r() * 10;
        p.alpha = 0.3 + r() * 0.4;
        p.img.setTexture(key(r() < 0.15 ? 'plus' : 'px', 1)).setDepth(D.motesFar);
        break;
    }
    p.img.setScale(P).setTint(color).setScrollFactor(kind === 'moteFar' ? SF.fogFar : 1).setVisible(true);
    return p;
  }

  private spawnAmbient(kind: 'mote' | 'moteFar', midLife = false): void {
    const r = this.rnd;
    let x: number;
    let y: number;
    let color: number;
    if (kind === 'moteFar') {
      x = r() * 960;
      y = 255 + r() * 285;
      color = x < 420 ? PAL.cyan3 : x > 540 ? PAL.crim3 : PAL.mist;
      if (r() < 0.3) color = PAL.mist;
    } else if (r() < 0.55) {
      // in the light shafts under the platform
      const th = THRUSTERS[Math.floor(r() * THRUSTERS.length)];
      const under = r() < 0.3;
      x = under ? CORE_XY.x + (r() - 0.5) * 50 : th.x + (r() - 0.5) * 16;
      y = (under ? CORE_XY.y : th.y) + r() * 110;
      color = under ? PAL.cyan4 : th.cls === 0 ? PAL.cyan4 : th.cls === 1 ? PAL.crim4 : PAL.mist;
    } else {
      // around and above the board
      x = 180 + r() * 600;
      y = 225 + r() * 255;
      const g = screenToGrid(x, y);
      color = g.row > 2.6 ? PAL.cyan4 : g.row < 1.4 ? PAL.crim4 : PAL.mist;
    }
    const p = this.spawn(kind, x, y, color);
    if (p && midLife) p.age = p.life * (0.2 + r() * 0.5);
  }

  /** How much light falls on a point from the under-platform shafts (dust only shines inside light). */
  private shaftLight(x: number, y: number): number {
    let best = 0;
    for (const th of THRUSTERS) {
      const dy = y - th.y;
      if (dy < 0 || dy > 130) continue;
      const half = 3 + dy * 0.075;
      const v = Math.max(0, 1 - Math.abs(x - th.x) / (half * 1.6)) * (1 - dy / 130);
      if (v > best) best = v;
    }
    const dy = y - CORE_XY.y;
    if (dy > -10 && dy < 170) {
      const half = 6 + Math.max(0, dy) * 0.15;
      best = Math.max(best, Math.max(0, 1 - Math.abs(x - CORE_XY.x) / (half * 1.5)) * (1 - Math.max(0, dy) / 170));
    }
    return best;
  }

  private updateParticles(dt: number): void {
    const s = dt / 1000;
    let motes = 0;
    let far = 0;
    const P = this.P;
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
      p.x += p.vx * s;
      p.y += p.vy * s;
      const k = p.age / p.life;
      const env = Math.sin(Math.PI * Math.min(1, k * 1.15));
      let a = p.alpha * env;
      const sx = Math.sin(this.t / 900 + p.phase) * p.sway;
      const x = p.x + sx;
      if (p.kind === 'mote') {
        // under the platform: only visible inside a light shaft; over the board: lit by the neon
        const lit = p.y > 300 ? this.shaftLight(x, p.y) : 0.55;
        a *= Math.min(1, 0.12 + lit * 1.4);
      }
      p.img.setPosition(Math.round(x / P) * P, Math.round(p.y / P) * P).setAlpha(Math.max(0, a));
    }
    if (motes < 22 && this.rnd() < 0.1) this.spawnAmbient('mote');
    if (far < 14 && this.rnd() < 0.06) this.spawnAmbient('moteFar');
  }

  // ================================================================ tick

  private tick(_time: number, delta: number): void {
    if (this.destroyed) return;
    // ?test runs: the arena's clock starts at the first freeze() so films are reproducible from t = 0
    if (this.gated) {
      if (!(window.__neon as unknown as { hdFrozen?: boolean } | undefined)?.hdFrozen) return;
      this.gated = false;
      delta = 0;
    }
    const dt = Math.min(50, delta) * this.scene.time.timeScale;
    this.t += dt;
    this.stepJobs(dt);
    const t = this.t;
    const P = this.P;

    // ---- sky
    this.aurora.forEach((a, i) => {
      a.tilePositionX = Math.round(i * 230 + t * (i ? -0.0026 : 0.0042) / P);
      const breathe = 0.5 + 0.5 * Math.sin(t / (i ? 5300 : 3700) + i * 2);
      a.setAlpha(i ? 0.22 + 0.16 * breathe : 0.3 + 0.2 * breathe);
    });
    for (const s of this.stars) {
      const v = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
      const f = Math.min(s.maxFrame, Math.floor(v * (s.maxFrame + 0.999)));
      s.img.setFrame(String(f)).setAlpha(s.base * (0.45 + 0.55 * v));
    }
    this.shootClock -= dt;
    if (this.shootClock <= 0) {
      this.shootClock = 6500 + this.rnd() * 6000;
      this.shootingStar();
    }

    // ---- stadium
    this.haze.setTint(PAL.void2).setAlpha(0.26 + 0.05 * Math.sin(t / 2100));
    for (const b of this.beams) {
      const tw = TOWERS[b.tower];
      b.glow.setAlpha(0.42 + 0.06 * Math.sin(t / 300 + b.tower));
      if (tw.beam) {
        const bm = tw.beam;
        const ang = bm.angle + bm.amp * Math.sin((t / bm.period + bm.phase) * Math.PI * 2);
        b.img.setRotation(ang).setAlpha(0.22 + 0.05 * Math.sin(t / 700 + b.tower)).setTint(bm.tint);
      }
    }
    // crowd: three blink layers + a Mexican wave travelling around the bowl
    const wavePos = ((t / 14000) % 1) * (CROWD_STRIPS + 6) - 3;
    for (const c of this.crowd) {
      const blink = 0.5 + 0.5 * Math.sin(t / (1300 + c.layer * 370) + c.layer * 2.1 + c.strip * 0.35);
      const w = Math.max(0, 1 - Math.abs(c.strip - wavePos) / 1.6);
      c.img.setAlpha(Math.min(1, 0.28 + 0.6 * blink + 0.7 * w));
    }
    const ledPhase = Math.floor(t / 120) % 3;
    this.led.forEach((l, i) => l.setAlpha(i === ledPhase ? 1 : 0.2));
    this.reflect.setAlpha(0.26 + 0.05 * Math.sin(t / 400));
    this.ring.setAlpha(0.55 + 0.15 * Math.sin(t / 1900));
    this.flashClock -= dt;
    if (this.flashClock <= 0) {
      this.flashClock = 220 + this.rnd() * 800;
      this.cameraFlash();
    }
    for (const f of this.fogs) f.spr.tilePositionX = Math.round(t * f.speed);

    // ---- platform energy
    const breath = 0.5 + 0.5 * Math.sin(t / 1600);
    this.under.setAlpha(0.62 + 0.18 * breath);
    this.floorPools.forEach((p, i) => p.setAlpha(0.26 + 0.08 * Math.sin(t / 1900 + i * 2.2)));
    const corePulse = 0.5 + 0.5 * Math.sin(t / 230);
    this.core.setAlpha(0.75 + 0.25 * corePulse);
    this.coreHalo.setAlpha(0.35 + 0.15 * breath + 0.1 * corePulse);
    this.coreBeam.setAlpha(0.3 + 0.1 * breath).setTint(PAL.mist);
    for (const sh of this.shafts) {
      const base = sh.cls === 0 ? PAL.cyan3 : sh.cls === 1 ? PAL.crim3 : PAL.mist;
      const flick = 0.5 + 0.5 * Math.sin(t / 310 + sh.phase) * Math.sin(t / 830 + sh.phase * 2);
      sh.img.setTint(base).setAlpha(0.32 + 0.2 * flick);
      sh.pool.setTint(base).setAlpha(0.2 + 0.1 * flick);
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
        .setFrame(String(Math.min(7, Math.floor(k * 8))))
        .setPosition(CORE_XY.x, Math.round((CORE_XY.y + k * 51) / P) * P)
        .setAlpha((1 - k) * 0.55)
        .setTint(PAL.mist);
    }

    // ---- trim (per side)
    this.trims.forEach((tr, cls) => {
      const lvl = this.sideLevel[cls];
      const flash = cls === 2 ? 0 : this.sideFlash[cls];
      const isActive = cls !== 2 && this.active === cls;
      const pulse = isActive ? 0.72 + 0.2 * Math.sin(t / 520) : 0.6 + 0.08 * Math.sin(t / 900 + cls);
      tr.setAlpha(Math.min(1, lvl * pulse + flash * 0.6));
    });
    this.updateRunners();

    // ---- tiles: breathing glow + travelling pulse waves
    this.waveClock -= dt;
    if (this.waveClock <= 0) {
      this.waveClock = 5200;
      const side = this.active ?? this.waveSide;
      this.waveSide = (1 - this.waveSide) as PlayerId;
      this.tileWave(side);
    }
    for (const tile of this.tiles) {
      const isActive = this.active === tile.zone.player;
      const w = 0.5 + 0.5 * Math.sin(t / 420 - tile.phase);
      const ban = tile.zone.spot === 'banish';
      const base = ban ? 0.3 : isActive ? 0.66 : this.active === null ? 0.6 : 0.42;
      const amp = ban ? 0.1 : isActive ? 0.3 : 0.16;
      tile.glow.setAlpha(Math.min(1, base + amp * w + tile.boost));
      tile.boost = Math.max(0, tile.boost - dt / 600);
    }
    this.bridgeFlow.setFrame(String(Math.floor(t / 70) % FLOW_FRAMES)).setAlpha((P === 1 ? 0.6 : 0.42) + 0.18 * Math.sin(t / 800));
    this.bridgeGlow.setAlpha(0.6 + 0.1 * Math.sin(t / 1100));

    // ---- wandering spotlight
    if (this.spot) {
      const u = t / 1000;
      this.spot.setPosition(480 + Math.sin(u * 0.23) * 190 + Math.sin(u * 0.61) * 40, 236 + Math.sin(u * 0.37 + 1) * 70);
    }

    this.updateParticles(dt);
  }

  private tileWave(side: PlayerId): void {
    const pod = side === 0 ? { col: 2, row: 5.35 } : { col: 2, row: -1.35 };
    for (const tl of this.tiles) {
      if (tl.zone.player !== side) continue;
      const delay = Math.round((Math.hypot(tl.col - pod.col, tl.row - pod.row) - 1) * 160);
      void this.run(520, (k) => (tl.boost = Math.max(tl.boost, envelope(k, 120, 60, 340) * 0.35)), 'Linear', delay);
    }
  }

  private updateRunners(): void {
    const speed = 0.11; // px per ms
    const P = this.P;
    this.runners.forEach((rn, p) => {
      const isActive = this.active === p;
      const cycle = rn.len + 380;
      const s0 = (this.t * speed + p * 450) % cycle;
      const color = PLAYER_COLOR[p as PlayerId];
      const at = (s: number) => {
        let i = 1;
        while (i < rn.seg.length - 1 && rn.seg[i] < s) i++;
        const a = rn.path[i - 1];
        const b = rn.path[i];
        const k = (s - rn.seg[i - 1]) / Math.max(1e-6, rn.seg[i] - rn.seg[i - 1]);
        return { x: Math.round((a.x + (b.x - a.x) * k) / P) * P, y: Math.round((a.y + (b.y - a.y) * k) / P) * P };
      };
      const fade = (s: number) => Math.max(0, Math.min(1, s / 40, (rn.len - s) / 40));
      const vis = isActive && s0 <= rn.len;
      rn.head.setVisible(vis);
      rn.dots.forEach((d) => d.setVisible(vis));
      if (!vis) return;
      const h = at(s0);
      rn.head.setPosition(h.x, h.y).setTint(mix(color, PAL.white, 0.5)).setAlpha(0.9 * fade(s0));
      rn.dots.forEach((d, i) => {
        const s = s0 - i * 5;
        if (s < 0) {
          d.setVisible(false);
          return;
        }
        const q = at(s);
        d.setPosition(q.x, q.y).setTint(i < 2 ? mix(color, PAL.white, 0.6) : color).setAlpha((1 - i / rn.dots.length) * fade(s));
      });
    });
  }

  private cameraFlash(): void {
    const r = this.rnd;
    const left = r() < 0.5;
    const x = left ? -40 + r() * 300 : 700 + r() * 300;
    const top = rimY(x) + 4;
    const bot = standsBottomY(x) - 3;
    const y = top + r() * (bot - top);
    const c = r() < 0.75 ? PAL.white : PAL.gold4;
    const P = this.P;
    const star = this.add(this.scene.add.image(Math.round(x / P) * P, Math.round(y / P) * P, key('flash', 1)).setScale(P).setScrollFactor(SF.stadium).setBlendMode(ADD).setTint(c));
    const glow = this.add(this.scene.add.image(x, y, SOFT.glow).setDisplaySize(26, 26).setScrollFactor(SF.stadium).setBlendMode(ADD).setTint(c).setAlpha(0.6));
    this.farGlow.add([star, glow]);
    void this.run(
      170,
      (k) => {
        star.setAlpha(1 - k);
        glow.setAlpha(0.6 * (1 - k));
      },
      'Quad.In',
      40,
    ).then(() => {
      this.remove(star);
      this.remove(glow);
    });
  }

  private shootingStar(): void {
    const r = this.rnd;
    const x0 = 120 + r() * 720;
    const y0 = -10 + r() * 90;
    const dir = r() < 0.5 ? -1 : 1;
    const ang = dir < 0 ? Math.PI - 0.42 - r() * 0.25 : 0.42 + r() * 0.25;
    const len = 150 + r() * 90;
    const P = this.P;
    const trail = this.add(this.scene.add.image(x0, y0, SOFT.streak).setOrigin(1, 0.5).setDepth(D.shooting).setScrollFactor(SF.sky).setBlendMode(ADD).setTint(PAL.cyan4).setRotation(ang).setAlpha(0));
    const head = this.add(this.scene.add.image(x0, y0, key('px', 1)).setScale(P * 2).setDepth(D.shooting).setScrollFactor(SF.sky).setBlendMode(ADD));
    void this.run(
      620,
      (k) => {
        const x = x0 + Math.cos(ang) * len * k;
        const y = y0 + Math.sin(ang) * len * k;
        const a = Math.sin(Math.PI * Math.min(1, k * 1.1));
        head.setPosition(Math.round(x / P) * P, Math.round(y / P) * P).setAlpha(a);
        trail.setPosition(x, y).setDisplaySize(40 + 70 * k, 6).setAlpha(a * 0.8);
      },
      'Sine.In',
    ).then(() => {
      this.remove(trail);
      this.remove(head);
    });
  }
}

