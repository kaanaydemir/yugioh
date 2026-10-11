// Arena v2 stadium runtime: everything around the platform that lives and moves — the night sky
// (twinkling stars, drifting clouds, sweeping searchlights), the packed crowd (bobbing frames,
// waving flags, rippling banners, blinking phone lights, camera flashes, a roving follow spot),
// the LED boards and the scoreboard (scrolling pixel text), the six floodlight banks, camera
// drones on the sidelines, referee light pylons on the corners, maintenance lights.

import Phaser from 'phaser';
import { AK2, BEACON_FRAMES, CLOUD_H, CLOUD_W, CROWD_FRAMES, SKY_RECT, STAD_RECT, arenaV2Layout, texOrigin2 } from '../../art/arena-v2';
import { PYLONS, TOWERS } from '../../art/arena-v2/geom';
import { BANNER_FRAMES, BANNER_LEN, FLAG_FRAMES, FLAG_H, PYLON_H, PYLON_LAMP, PYLON_W, SCORE_CABLE, SCORE_SCREEN } from '../../art/arena-v2/props';
import { type LedBoard, ledText, roofPoint } from '../../art/arena-v2/stands';
import { PAL, PLAYER_COLOR } from '../../art/palette';
import { mix, mulberry32 } from '../../art/pixel';
import type { PlayerId } from '../../engine/types';
import { TEX } from '../../vfx/core';
import { type BoardCtx, D2 } from './types';

type Img = Phaser.GameObjects.Image;
const ADD = Phaser.BlendModes.ADD;

/** Parallax scroll factors of the far layers (the stadium itself is the iso world, factor 1). */
const SF = { sky: 0.2, clouds: 0.3 } as const;

interface Star {
  img: Img;
  speed: number;
  phase: number;
  maxFrame: number;
}

interface Drone {
  body: Img;
  red: Img;
  green: Img;
  cx: number;
  cy: number;
  ax: number;
  ay: number;
  w: number;
  phase: number;
  x: number;
  y: number;
}

interface Led {
  board: LedBoard;
  mask: Uint8Array;
  tex: Phaser.Textures.CanvasTexture;
  ctx: CanvasRenderingContext2D;
  data: ImageData;
  img: Img;
  mode: 'text' | 'chase' | 'flag';
  text: { w: number; h: number; bits: Uint8Array; start: Int16Array };
  offset: number;
  color: PlayerId | null;
}

export class Stadium {
  private skyHot: Img;
  private clouds: Phaser.GameObjects.TileSprite[] = [];
  private stars: Star[] = [];
  private search: { img: Img; base: number; amp: number; period: number; phase: number; tint: number }[] = [];
  private stadium: Img;
  private stadiumHot: Img;
  private crowd: Img;
  private flags: { img: Img; side: PlayerId; design: number; phase: number; speed: number }[] = [];
  private banners: { img: Img; side: PlayerId; design: number; phase: number }[] = [];
  private phones: { img: Img; on: number; next: number }[] = [];
  private roofLights: { img: Img; phase: number }[] = [];
  private lamps: { lit: Img; glow: Img; halo: Img }[] = [];
  private floorPools: Img[] = [];
  private followSpots: { img: Img; stand: 0 | 1; phase: number }[] = [];
  private leds: Led[] = [];
  private scoreTex: Phaser.Textures.CanvasTexture;
  private scoreCtx: CanvasRenderingContext2D;
  private scoreData: ImageData;
  private scoreText = ledText('NEON DÜELLO');
  private scoreOffset = 0;
  private drones: Drone[] = [];
  private pylons: { lamp: Img; glow: Img; phase: number }[] = [];
  private blinkers: { img: Img; phase: number; rate: number; color: number }[] = [];
  private flashClock = 0;
  private stepClock = 0;
  private crowdClock = 0;
  private crowdFrame = 0;
  private excite = 0;
  private active: PlayerId | null = null;
  private keys: string[] = [];
  private readonly r = mulberry32(99);

  constructor(private readonly ctx: BoardCtx & { id: number }) {
    const sc = ctx.scene;
    const L = arenaV2Layout();
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => ctx.add(o);

    // ---- sky
    add(sc.add.image(SKY_RECT.x, SKY_RECT.y, AK2.sky).setOrigin(0).setDepth(D2.sky).setScrollFactor(SF.sky));
    this.skyHot = add(sc.add.image(SKY_RECT.x, SKY_RECT.y, AK2.skyHot).setOrigin(0).setDepth(D2.skyHot).setScrollFactor(SF.sky).setAlpha(0));
    for (let i = 0; i < 2; i++) {
      const c = add(sc.add.tileSprite(SKY_RECT.x, -80 + i * 46, SKY_RECT.w, CLOUD_H, AK2.clouds))
        .setOrigin(0)
        .setDepth(D2.sky + 1 + i * 0.1)
        .setScrollFactor(SF.clouds)
        .setAlpha(i ? 0.35 : 0.5);
      c.tilePositionX = i * 140;
      this.clouds.push(c);
    }
    const sr = mulberry32(31);
    for (let i = 0; i < 60; i++) {
      const x = Math.floor(SKY_RECT.x + 8 + sr() * (SKY_RECT.w - 16));
      const y = Math.floor(SKY_RECT.y + 8 + sr() * 200);
      const big = i < 20;
      const img = add(sc.add.image(x, y, 'arena:star', big ? '2' : '1').setDepth(D2.stars).setScrollFactor(SF.sky));
      this.stars.push({ img, speed: 0.0012 + sr() * 0.003, phase: sr() * Math.PI * 2, maxFrame: big ? 3 : 1 });
    }
    // searchlights sweeping the sky from the stand roofs
    const sl: [0 | 1, number, number, number, number, number][] = [
      [0, 2.2, -1.75, 0.42, 9800, PAL.cyan4],
      [0, 6.5, -2.25, 0.32, 12600, PAL.white],
      [1, 2.4, -1.35, 0.4, 11200, PAL.crim4],
      [1, 6.8, -0.95, 0.3, 13400, PAL.white],
    ];
    sl.forEach(([stand, a, base, amp, period, tint], i) => {
      const [x, y] = roofPoint(stand, a);
      const img = add(sc.add.image(Math.round(x), Math.round(y), AK2.search).setOrigin(0, 0.5).setDepth(D2.search).setBlendMode(ADD));
      this.search.push({ img, base, amp, period, phase: i * 0.27, tint });
    });

    // ---- stadium (floor, stands, roof, masts) + crowd
    this.stadium = add(sc.add.image(STAD_RECT.x, STAD_RECT.y, AK2.stadium).setOrigin(0).setDepth(D2.stadium));
    this.stadiumHot = add(sc.add.image(STAD_RECT.x, STAD_RECT.y, AK2.stadiumHot).setOrigin(0).setDepth(D2.stadiumHot).setAlpha(0));
    const co = texOrigin2(AK2.crowd);
    this.crowd = add(sc.add.image(co.x, co.y, AK2.crowd, '0').setOrigin(0).setDepth(D2.crowd));
    for (const f of L.stands.flags) {
      const img = add(sc.add.image(f.x - 1, f.y - FLAG_H + 1, AK2.flags, `${f.side}:${f.design}:0`).setOrigin(0).setDepth(D2.flags + f.row * -0.001));
      this.flags.push({ img, side: f.side, design: f.design, phase: f.phase, speed: 95 + this.r() * 40 });
    }
    for (const b of L.stands.banners) {
      const key = b.stand === 0 ? AK2.bannersL : AK2.bannersR;
      const y = b.stand === 0 ? b.y - BANNER_LEN / 2 : b.y;
      const x = b.stand === 0 ? b.x : b.x;
      const img = add(sc.add.image(x, y, key, `${b.side}:${b.design}:0`).setOrigin(0).setDepth(D2.flags + 0.1));
      this.banners.push({ img, side: b.side, design: b.design, phase: Math.floor(this.r() * BANNER_FRAMES) });
    }
    for (const ph of L.stands.phones) {
      const img = add(sc.add.image(ph.x, ph.y, TEX.px1).setDepth(D2.phones).setTint(this.r() < 0.6 ? PAL.white : ph.side === 0 ? PAL.cyan4 : PAL.crim4).setAlpha(0));
      this.phones.push({ img, on: 0, next: this.r() * 3000 });
    }
    for (const rl of L.stands.roofLights) {
      const img = add(sc.add.image(rl.x, rl.y, TEX.px1).setDepth(D2.phones).setTint(PAL.gold4));
      this.roofLights.push({ img, phase: this.r() * Math.PI * 2 });
    }
    // roving follow spots over each stand's crowd
    for (const stand of [0, 1] as const) {
      const img = add(sc.add.image(0, 0, AK2.poolCore).setDepth(D2.spot).setBlendMode(ADD).setScale(0.55, 0.42));
      this.followSpots.push({ img, stand, phase: stand * 0.37 });
    }
    // floodlight spill on the floor around the platform
    for (const [x, y, s] of [
      [70, 250, 1.0],
      [590, 262, 1.0],
      [140, 92, 0.8],
      [520, 112, 0.8],
    ] as const) {
      const img = add(sc.add.image(x, y, AK2.pool).setDepth(D2.floorPool).setBlendMode(ADD).setScale(s * 0.9, s * 0.9));
      this.floorPools.push(img);
    }

    // ---- floodlight banks (lit lamps shine through the lights-off darkness)
    const to = texOrigin2(AK2.towers);
    add(sc.add.image(to.x, to.y, AK2.towers).setOrigin(0).setDepth(D2.towers));
    TOWERS.forEach((t, i) => {
      const halo = add(sc.add.image(t.x, t.y, AK2.pool).setDepth(D2.lamps - 0.05).setBlendMode(ADD).setScale(0.34, 0.4));
      const lo = L.lampOrigins[i];
      const lit = add(sc.add.image(lo.x, lo.y, AK2.lampLit(i)).setOrigin(0).setDepth(D2.lamps));
      const glow = add(sc.add.image(t.x, t.y, 'arena:glow').setDepth(D2.lamps + 0.05).setBlendMode(ADD).setScale(1.15, 0.85));
      this.lamps.push({ lit, glow, halo });
    });

    // ---- LED boards on the stand walls
    L.stands.boards.forEach((board, i) => {
      const key = `arena2:led:${ctx.id}:${i}`;
      this.keys.push(key);
      if (sc.textures.exists(key)) sc.textures.remove(key);
      const cv = document.createElement('canvas');
      cv.width = board.w;
      cv.height = board.h;
      const c2 = cv.getContext('2d', { willReadFrequently: true })!;
      const tex = sc.textures.addCanvas(key, cv)!;
      const img = add(sc.add.image(board.x, board.y, key).setOrigin(0).setDepth(D2.led));
      const modes: Led['mode'][] = ['text', 'chase', 'text', 'text', 'flag', 'text'];
      this.leds.push({ board, mask: L.boardMasks[i], tex, ctx: c2, data: c2.createImageData(board.w, board.h), img, mode: modes[i % modes.length], text: ledText(' NEON DÜELLO • '), offset: i * 37, color: board.stand === 0 ? 0 : 1 });
    });

    // ---- scoreboard hung above the left stand, between the towers
    const sbx = 68;
    const sby = 20 - SCORE_CABLE;
    add(sc.add.image(sbx, sby, AK2.scoreboard).setOrigin(0).setDepth(D2.led));
    const skey = `arena2:score:${ctx.id}`;
    this.keys.push(skey);
    if (sc.textures.exists(skey)) sc.textures.remove(skey);
    const scv = document.createElement('canvas');
    scv.width = SCORE_SCREEN.w;
    scv.height = SCORE_SCREEN.h;
    this.scoreCtx = scv.getContext('2d', { willReadFrequently: true })!;
    this.scoreTex = sc.textures.addCanvas(skey, scv)!;
    this.scoreData = this.scoreCtx.createImageData(SCORE_SCREEN.w, SCORE_SCREEN.h);
    add(sc.add.image(sbx + SCORE_SCREEN.x, sby + SCORE_CABLE + SCORE_SCREEN.y, skey).setOrigin(0).setDepth(D2.led + 0.01));

    // ---- drones on the sidelines
    const dr: [number, number, number, number, number, number][] = [
      [150, 76, 34, 9, 0.00021, D2.dronesBack],
      [560, 128, 30, 10, 0.00017, D2.dronesBack],
      [70, 250, 40, 12, 0.00019, D2.props],
      [585, 262, 34, 10, 0.00023, D2.props],
    ];
    dr.forEach(([cx, cy, ax, ay, w, depth], i) => {
      const body = add(sc.add.image(cx, cy, AK2.drone, '0:0').setDepth(depth));
      const red = add(sc.add.image(cx, cy, TEX.px1).setDepth(depth + 0.01).setTint(PAL.crim3).setBlendMode(ADD));
      const green = add(sc.add.image(cx, cy, TEX.px1).setDepth(depth + 0.01).setTint(PAL.leaf3).setBlendMode(ADD));
      this.drones.push({ body, red, green, cx, cy, ax, ay, w, phase: i * 1.9, x: cx, y: cy });
    });

    // ---- referee light pylons on the platform corners (beacon shows whose turn it is)
    PYLONS.forEach((p, i) => {
      add(sc.add.image(p.x - Math.floor(PYLON_W / 2), p.y - PYLON_H + 2, AK2.pylon).setOrigin(0).setDepth(D2.props));
      const lx = p.x - Math.floor(PYLON_W / 2) + PYLON_LAMP.x - 2;
      const ly = p.y - PYLON_H + 2 + PYLON_LAMP.y - 4 + 1;
      const lamp = add(sc.add.image(lx, ly, AK2.beacon, '0').setOrigin(0).setDepth(D2.props + 0.01));
      const glow = add(sc.add.image(lx + 2, ly + 4, 'arena:glow').setDepth(D2.props + 0.02).setBlendMode(ADD).setScale(0.45));
      this.pylons.push({ lamp, glow, phase: i * 0.25 });
    });

    // ---- maintenance lights on the platform faces and at the cable boxes
    L.faceLights.forEach((f, i) => {
      const color = i % 3 === 0 ? PAL.gold3 : f.cls === 0 ? PAL.cyan3 : f.cls === 1 ? PAL.crim3 : PAL.leaf3;
      const img = add(sc.add.image(f.x, f.y, TEX.px1).setDepth(D2.faceLights).setTint(color));
      this.blinkers.push({ img, phase: this.r() * 10, rate: 0.6 + this.r() * 1.6, color });
    });
    L.floorLights.forEach((f) => {
      const img = add(sc.add.image(f.x, f.y, TEX.px1).setDepth(D2.stadium + 0.5).setTint(PAL.leaf3));
      this.blinkers.push({ img, phase: this.r() * 10, rate: 1.2, color: PAL.leaf3 });
    });
    this.paintScore();
  }

  // ================================================================ hooks from the board

  setActive(player: PlayerId | null, turn: number | null): void {
    this.active = player;
    const who = player === null ? '' : player === 0 ? 'OYUNCU 1' : 'OYUNCU 2';
    const parts = ['NEON DÜELLO'];
    if (turn !== null) parts.push(`TUR ${turn}`);
    if (player !== null) parts.push(`SIRA: ${who}`);
    this.scoreText = ledText(` ${parts.join(' • ')} •`);
    for (const l of this.leds) {
      if (l.mode !== 'text') continue;
      const own = l.board.stand === 0 ? 'OYUNCU 1' : 'OYUNCU 2';
      l.text = ledText(l.board.x < 200 && l.board.stand === 0 ? ` NEON DÜELLO • ${turn !== null ? `TUR ${turn} • ` : ''}` : ` ${own} • NEON DÜELLO • `);
    }
  }

  /** A side scores the turn: the crowd jumps, flashes pop, a confetti cannon fires. */
  cheer(player: PlayerId): void {
    this.excite = 1;
    const c = this.ctx;
    void c.run(1400, (k) => (this.excite = 1 - k), 'Quad.In');
    for (let i = 0; i < 6; i++) void c.run(1, () => this.cameraFlash(player), 'Linear', i * 90);
    // a confetti cannon from that side's stand corner
    const [x, y] = player === 0 ? roofPoint(0, 3.2) : roofPoint(1, 3.2);
    for (let i = 0; i < 14; i++) {
      const p = c.spawn('confetti', Math.round(x + (c.rnd() - 0.5) * 40), Math.round(y + 10 + c.rnd() * 30), [PAL.gold3, PAL.white, PLAYER_COLOR[player], PAL.gold4][i % 4]);
      if (p) {
        p.vy = 10 + c.rnd() * 10;
        p.vx = (player === 0 ? 8 : -8) + (c.rnd() - 0.5) * 10;
        p.life = 3500 + c.rnd() * 2000;
      }
    }
  }

  /** A floodlight bank "pops" on (setLights intro). */
  lampPop(i: number): void {
    const t = TOWERS[i];
    const g = this.ctx.add(this.ctx.scene.add.image(t.x, t.y, 'arena:glow').setDepth(D2.lamps + 0.1).setBlendMode(ADD).setTint(PAL.gold4).setScale(2.2));
    void this.ctx.run(420, (k) => g.setAlpha(1 - k).setScale(2.2 - k * 1.2), 'Quad.Out').then(() => this.ctx.remove(g));
  }

  destroy(): void {
    const sc = this.ctx.scene;
    for (const k of this.keys) if (sc.textures.exists(k)) sc.textures.remove(k);
    this.keys = [];
  }

  // ================================================================ tick

  tick(dt: number, t: number, heat: number, towerLevel: number[]): void {
    const light = towerLevel.reduce((a, b) => a + b, 0) / towerLevel.length;
    // sky
    this.skyHot.setAlpha(heat).setVisible(heat > 0.001);
    this.clouds.forEach((c, i) => {
      c.tilePositionX = Math.round(t * (i ? 0.0021 : 0.0034)) % CLOUD_W;
      c.setTint(mix(PAL.white, PAL.fire2, heat));
    });
    for (const s of this.stars) {
      const v = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
      s.img.setFrame(String(Math.min(s.maxFrame, Math.floor(v * (s.maxFrame + 0.999))))).setAlpha((0.45 + 0.55 * v) * (1 - 0.75 * heat));
    }
    for (const s of this.search) {
      const ang = s.base + s.amp * Math.sin((t / s.period + s.phase) * Math.PI * 2);
      s.img.setRotation(ang).setAlpha(light * (0.16 + 0.04 * Math.sin(t / 900 + s.phase * 7)) * (1 - 0.4 * heat)).setTint(mix(s.tint, PAL.fire3, heat));
    }

    // stadium + crowd
    this.stadiumHot.setAlpha(heat).setVisible(heat > 0.001);
    // the crowd's frames: a calm loop, twice as fast when cheering
    this.crowdClock += dt * (1 + this.excite * 1.4);
    if (this.crowdClock >= 120) {
      this.crowdClock %= 120;
      this.crowdFrame = (this.crowdFrame + 1) % CROWD_FRAMES;
      this.crowd.setFrame(String(this.crowdFrame));
    }
    // lava light from below: the crowd darkens to silhouettes with an ember rim (no hue tint:
    // a warm multiply would turn the cyan fans green)
    this.crowd.setTint(mix(PAL.white, PAL.stone3, heat * 0.55));
    for (const f of this.flags) {
      const fr = Math.floor((t * (1 + this.excite)) / f.speed + f.phase) % FLAG_FRAMES;
      f.img.setFrame(`${f.side}:${f.design}:${fr}`);
    }
    for (const b of this.banners) b.img.setFrame(`${b.side}:${b.design}:${(Math.floor(t / 170) + b.phase) % BANNER_FRAMES}`);
    for (const ph of this.phones) {
      ph.next -= dt;
      if (ph.next <= 0) {
        ph.on = ph.on > 0 ? 0 : 1;
        ph.next = ph.on ? 400 + this.r() * 2600 : 600 + this.r() * 4000 * (1 - this.excite * 0.7);
      }
      const tw = 0.75 + 0.25 * Math.sin(t / 90 + ph.next);
      ph.img.setAlpha(ph.on * tw);
    }
    for (const rl of this.roofLights) rl.img.setAlpha(0.55 + 0.45 * Math.sin(t / 700 + rl.phase));
    for (const fs of this.followSpots) {
      const L = arenaV2Layout().stands.crowdSpan[fs.stand];
      const k = 0.5 - 0.5 * Math.cos((t / 7000 + fs.phase) * Math.PI * 2);
      const x = L.a[0] + (L.b[0] - L.a[0]) * k;
      const y = L.a[1] + (L.b[1] - L.a[1]) * k;
      fs.img.setPosition(Math.round(x), Math.round(y)).setAlpha(light * 0.14 * (1 - heat)).setTint(fs.stand === 0 ? PAL.cyan4 : PAL.crim4);
    }
    for (const fp of this.floorPools) fp.setAlpha(light * 0.07 * (1 - 0.5 * heat)).setTint(mix(PAL.white, PAL.fire3, heat));

    // floodlight banks
    this.lamps.forEach((l, i) => {
      const lvl = towerLevel[i];
      l.lit.setAlpha(lvl).setTint(mix(PAL.white, PAL.fire4, heat));
      l.glow.setAlpha(lvl * (0.55 + 0.05 * Math.sin(t / 300 + i))).setTint(mix(PAL.gold4, PAL.fire3, heat));
      l.halo.setAlpha(lvl * 0.22).setTint(mix(PAL.white, PAL.fire3, heat));
    });

    // camera flashes in the stands
    this.flashClock -= dt * (1 + this.excite * 3);
    if (this.flashClock <= 0) {
      this.flashClock = 220 + this.r() * 800;
      this.cameraFlash(this.r() < 0.5 ? 0 : 1);
    }

    // LED boards + scoreboard: scroll 2px along the wall every 90ms
    this.stepClock += dt;
    if (this.stepClock >= 90) {
      this.stepClock %= 90;
      for (const l of this.leds) {
        l.offset += 2;
        this.paintLed(l, t, heat);
      }
      this.scoreOffset += 1;
      this.paintScore();
    }

    // drones: slow patrol loops, bob, tilt into the direction of travel, blinking nav lights
    for (const d of this.drones) {
      const a = t * d.w + d.phase;
      const x = d.cx + d.ax * Math.sin(a);
      const y = d.cy + d.ay * Math.sin(a * 1.7 + 0.6) + Math.sin(t / 260 + d.phase) * 1.2;
      const vx = Math.cos(a) * d.ax * d.w;
      const tilt = vx > 0.0035 ? 1 : vx < -0.0035 ? -1 : 0;
      d.x = Math.round(x);
      d.y = Math.round(y);
      d.body.setPosition(d.x, d.y).setFrame(`${tilt}:${Math.floor(t / 35) % 4}`);
      const blink = Math.floor(t / 130 + d.phase * 3) % 8;
      d.red.setPosition(d.x - 8, d.y + Math.round((-8 / 9) * tilt)).setAlpha(blink === 0 ? 1 : 0.35);
      d.green.setPosition(d.x + 8, d.y + Math.round((8 / 9) * tilt)).setAlpha(blink === 4 ? 1 : 0.35);
    }

    // pylons: rotating beacons in the active player's color
    const pc = this.active === null ? PAL.mist : PLAYER_COLOR[this.active];
    const col = mix(pc, PAL.fire3, heat);
    for (const p of this.pylons) {
      const f = Math.floor(t / 85 + p.phase * BEACON_FRAMES) % BEACON_FRAMES;
      p.lamp.setFrame(String(f)).setTint(col);
      p.glow.setTint(col).setAlpha(f === 1 || f === 2 ? 0.75 : 0.4);
    }
    for (const b of this.blinkers) {
      const v = Math.sin(t * 0.004 * b.rate + b.phase);
      b.img.setAlpha(v > 0.2 ? 1 : 0.25);
    }
  }

  // ================================================================ painting

  private cameraFlash(side: PlayerId): void {
    const L = arenaV2Layout().stands.crowdSpan[side];
    const k = this.r();
    const x = Math.round(L.a[0] + (L.b[0] - L.a[0]) * k + (this.r() - 0.5) * 20);
    const y = Math.round(L.a[1] + (L.b[1] - L.a[1]) * k + (this.r() - 0.5) * 40);
    const c = this.r() < 0.75 ? PAL.white : PAL.gold4;
    const star = this.ctx.add(this.ctx.scene.add.image(x, y, TEX.spark).setDepth(D2.phones).setBlendMode(ADD).setTint(c));
    const glow = this.ctx.add(this.ctx.scene.add.image(x, y, 'arena:glow').setDepth(D2.phones).setBlendMode(ADD).setTint(c).setScale(0.35).setAlpha(0.6));
    void this.ctx
      .run(
        160,
        (kk) => {
          star.setAlpha(1 - kk);
          glow.setAlpha(0.6 * (1 - kk));
        },
        'Quad.In',
        50,
      )
      .then(() => {
        this.ctx.remove(star);
        this.ctx.remove(glow);
      });
  }

  private paintLed(l: Led, t: number, heat: number): void {
    const d = l.data.data;
    d.fill(0);
    const B = l.board;
    const side = l.color ?? 0;
    const hot = heat > 0.5;
    const on = hot ? [255, 138, 30] : side === 0 ? [63, 224, 234] : [255, 77, 94];
    const hi = hot ? [255, 218, 102] : side === 0 ? [182, 251, 255] : [255, 182, 187];
    const dim = hot ? [56, 11, 5] : side === 0 ? [5, 50, 65] : [58, 8, 25];
    const bg = [11, 13, 31];
    const len = B.cols.length;
    const put = (x: number, y: number, c: number[]) => {
      if (x < 0 || y < 0 || x >= B.w || y >= B.h || l.mask[y * B.w + x]) return;
      const o = (y * B.w + x) * 4;
      d[o] = c[0];
      d[o + 1] = c[1];
      d[o + 2] = c[2];
      d[o + 3] = 255;
    };
    // the dark LED matrix band follows the wall's slope
    for (const col of B.cols) {
      for (let k = 0; k < B.rows; k++) {
        let c = (col.u + k) % 2 === 0 ? dim : bg;
        if (l.mode === 'chase') {
          const seg = Math.floor((col.u + l.offset) / 6) % 4;
          if (seg === 0 && k > 0 && k < B.rows - 1) c = on;
          else if (seg === 1 && k > 1 && k < B.rows - 2) c = dim;
        } else if (l.mode === 'flag') {
          const w = Math.sin((col.u / len) * Math.PI * 4 - t / 300) * 1.5;
          if (k + w > 3) c = on;
          else if (k + w > 2) c = hi;
        }
        put(col.x - B.x, col.y - B.y + k, c);
      }
    }
    if (l.mode !== 'text') {
      l.ctx.putImageData(l.data, 0, 0);
      l.tex.refresh();
      return;
    }
    // text: every letter stays upright; whole letters step along the slope (LED modules)
    const tw = l.text.w;
    const slope = B.cols.length > 1 ? (B.cols[B.cols.length - 1].y - B.cols[0].y) / (B.cols.length - 1) : 0;
    const topAt = (i: number) => {
      if (i >= 0 && i < B.cols.length) return B.cols[i].y;
      return B.cols[0].y + Math.round(slope * i);
    };
    B.cols.forEach((col, i) => {
      const u = (((col.u + l.offset) % tw) + tw) % tw;
      const i0 = i - (u - l.text.start[u]);
      const top = topAt(i0) - B.y;
      for (let k = 0; k < B.rows; k++) if (l.text.bits[k * tw + u]) put(col.x - B.x, top + k, k < 2 ? hi : on);
    });
    l.ctx.putImageData(l.data, 0, 0);
    l.tex.refresh();
  }

  private paintScore(): void {
    const W = SCORE_SCREEN.w;
    const H = SCORE_SCREEN.h;
    const d = this.scoreData.data;
    const ac = this.active === null ? [163, 177, 218] : this.active === 0 ? [63, 224, 234] : [255, 77, 94];
    const glow = this.active === null ? [40, 53, 111] : this.active === 0 ? [8, 98, 122] : [118, 16, 48];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 4;
        // dark LED matrix background with a faint grid
        let c = (x + y) % 2 === 0 ? [18, 22, 58] : [11, 13, 31];
        // header bar: two little team badges + a pulsing center line
        if (y === 0 || y === H - 1) c = [27, 35, 82];
        if (y >= 1 && y <= 6) {
          if (x >= 2 && x <= 9) c = this.active === 0 ? [63, 224, 234] : [8, 98, 122];
          if (x >= W - 10 && x <= W - 3) c = this.active === 1 ? [255, 77, 94] : [118, 16, 48];
          if (x === 5 || x === 6 || x === W - 7 || x === W - 6) if (y >= 3 && y <= 4) c = [244, 247, 255];
          // centered "VS"
          const vs = ['#.#.##', '#.#.#.', '#.#.##', '.#...#', '.#..##'];
          const vx = x - (Math.floor(W / 2) - 3);
          const vy = y - 1;
          if (vx >= 0 && vx < 6 && vy >= 0 && vy < 5 && vs[vy][vx] === '#') c = [255, 212, 71];
        }
        // scrolling ticker in the lower half
        if (y >= 9 && y < 16) {
          const tw = this.scoreText.w;
          const u = (((x + this.scoreOffset) % tw) + tw) % tw;
          if (this.scoreText.bits[(y - 9) * tw + u]) c = y - 9 < 2 ? [244, 247, 255] : ac;
          else if ((x + y) % 2 === 0) c = glow.map((v) => v >> 2);
        }
        d[o] = c[0];
        d[o + 1] = c[1];
        d[o + 2] = c[2];
        d[o + 3] = 255;
      }
    this.scoreCtx.putImageData(this.scoreData, 0, 0);
    this.scoreTex.refresh();
  }
}
