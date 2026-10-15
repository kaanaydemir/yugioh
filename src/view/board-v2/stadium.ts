// Arena v2 stadium runtime: everything around the platform that lives and moves — the night sky
// (twinkling stars, drifting clouds, sweeping searchlights), the packed crowd (bobbing frames,
// hand flags, waving flags, rippling banners, blinking phone lights, camera flashes, a roving
// follow spot, and reactions: cheers, gasps, roars, a wave running round both stands), the LED
// boards and the scoreboard, the six floodlight banks, camera drones on the sidelines, referee
// light pylons on the corners, the players' booth and the maintenance lights.

import Phaser from 'phaser';
import { AK2, BEACON_FRAMES, CLOUD_H, CLOUD_W, CROWD_FRAMES, SKY_RECT, STAD_RECT, arenaV2Layout, texOrigin2 } from '../../art/arena-v2';
import { PYLONS, TOWERS } from '../../art/arena-v2/geom';
import { BANNER_FRAMES, BANNER_LEN, FLAG_FRAMES, FLAG_H, FLAG_S_FRAMES, FLAG_S_H, PYLON_H, PYLON_LAMP, PYLON_W } from '../../art/arena-v2/props';
import { CROWD_UP_FRAMES, roofPoint } from '../../art/arena-v2/stands';
import { PAL, PLAYER_COLOR } from '../../art/palette';
import { mix, mulberry32 } from '../../art/pixel';
import type { PlayerId } from '../../engine/types';
import { TEX } from '../../vfx/core';
import { LIGHT_TEX, LT } from '../light/textures';
import { LedBoards, Scoreboard } from './led';
import { type BoardCtx, type CrowdReaction, D2 } from './types';

type Img = Phaser.GameObjects.Image;
const ADD = Phaser.BlendModes.ADD;
const SCREEN = Phaser.BlendModes.SCREEN;

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

interface Chunk {
  img: Img;
  stand: 0 | 1;
  a: number;
  /** order around both stands (left far end → back corner → right far end), 0..1 */
  ring: number;
  /** until when (board time) this chunk shows an "up" set, and which */
  upUntil: number;
  upSet: '0' | '1' | 'a';
  upPhase: number;
}

export class Stadium {
  private skyHot: Img;
  private clouds: Phaser.GameObjects.TileSprite[] = [];
  private stars: Star[] = [];
  private search: { img: Img; base: number; amp: number; period: number; phase: number; tint: number }[] = [];
  private stadiumHot: Img;
  private chunks: Chunk[] = [];
  private flags: { img: Img; side: PlayerId; design: number; phase: number; speed: number; small: boolean }[] = [];
  private banners: { img: Img; side: PlayerId; design: number; phase: number }[] = [];
  private phones: { img: Img; on: number; next: number; side: PlayerId }[] = [];
  private roofLights: { img: Img; phase: number }[] = [];
  private lamps: { lit: Img; glow: Img; halo: Img }[] = [];
  private followSpots: { img: Img; stand: 0 | 1; phase: number }[] = [];
  private leds: LedBoards;
  private score: Scoreboard;
  private drones: Drone[] = [];
  private pylons: { lamp: Img; glow: Img; phase: number }[] = [];
  private blinkers: { img: Img; phase: number; rate: number; color: number }[] = [];
  private booth: Phaser.GameObjects.Graphics;
  private boothLeds: { x: number; y: number }[];
  private flashClock = 0;
  private crowdClock = 0;
  private crowdFrame = 0;
  private excite = 0;
  /** gasp: the stands dim and the crowd holds still */
  private hush = 0;
  private phoneBurst = 0;
  private active: PlayerId | null = null;
  private readonly r = mulberry32(99);

  constructor(private readonly ctx: BoardCtx & { id: number }) {
    const sc = ctx.scene;
    const L = arenaV2Layout();
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => ctx.add(o);
    const soft = (x: number, y: number, w: number, h: number, blend: number, depth: number) =>
      add(sc.add.image(x, y, LT.radial).setScale(w / LIGHT_TEX, h / LIGHT_TEX).setBlendMode(blend).setDepth(depth));

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

    // ---- stadium (floor, stands, roof, masts) + the lava-lit version + the crowd chunks
    add(sc.add.image(STAD_RECT.x, STAD_RECT.y, AK2.stadium).setOrigin(0).setDepth(D2.stadium));
    this.stadiumHot = add(sc.add.image(STAD_RECT.x, STAD_RECT.y, AK2.stadiumHot).setOrigin(0).setDepth(D2.stadiumHot).setAlpha(0));
    const maxA = Math.max(...L.crowd.map((c) => c.a));
    for (const ch of L.crowd) {
      const img = add(sc.add.image(ch.x, ch.y, ch.key, 'i0').setOrigin(0).setDepth(D2.crowd));
      // left stand: far end (ring 0) → back corner (0.5); right stand: corner (0.5) → far end (1)
      const ring = ch.stand === 0 ? 0.5 - (0.5 * ch.a) / maxA : 0.5 + (0.5 * ch.a) / maxA;
      this.chunks.push({ img, stand: ch.stand, a: ch.a, ring, upUntil: -1, upSet: 'a', upPhase: 0 });
    }
    for (const f of L.stands.flags) {
      const img = f.small
        ? add(sc.add.image(f.x, f.y - FLAG_S_H + 1, AK2.flagsSmall, `${f.side}:0`).setOrigin(0).setDepth(D2.flags + f.row * -0.001))
        : add(sc.add.image(f.x - 1, f.y - FLAG_H + 1, AK2.flags, `${f.side}:${f.design}:0`).setOrigin(0).setDepth(D2.flags + f.row * -0.001));
      this.flags.push({ img, side: f.side, design: f.design, phase: f.phase, speed: 95 + this.r() * 40, small: f.small });
    }
    for (const b of L.stands.banners) {
      const key = b.stand === 0 ? AK2.bannersL : AK2.bannersR;
      const y = b.stand === 0 ? b.y - BANNER_LEN / 2 : b.y;
      const img = add(sc.add.image(b.x, y, key, `${b.side}:${b.design}:0`).setOrigin(0).setDepth(D2.flags + 0.1));
      this.banners.push({ img, side: b.side, design: b.design, phase: Math.floor(this.r() * BANNER_FRAMES) });
    }
    for (const ph of L.stands.phones) {
      const img = add(sc.add.image(ph.x, ph.y, TEX.px1).setDepth(D2.phones).setTint(this.r() < 0.6 ? PAL.white : ph.side === 0 ? PAL.cyan4 : PAL.crim4).setAlpha(0));
      this.phones.push({ img, on: 0, next: this.r() * 3000, side: ph.side });
    }
    for (const rl of L.stands.roofLights) {
      const img = add(sc.add.image(rl.x, rl.y, TEX.px1).setDepth(D2.phones).setTint(PAL.gold4));
      this.roofLights.push({ img, phase: this.r() * Math.PI * 2 });
    }
    // roving follow spots over each stand's crowd
    for (const stand of [0, 1] as const) {
      const img = soft(0, 0, 70, 40, SCREEN, D2.spot);
      this.followSpots.push({ img, stand, phase: stand * 0.37 });
    }

    // ---- floodlight banks (lit lamps shine through the lights-off darkness): a smooth halo
    const to = texOrigin2(AK2.towers);
    add(sc.add.image(to.x, to.y, AK2.towers).setOrigin(0).setDepth(D2.towers));
    TOWERS.forEach((t, i) => {
      const halo = soft(t.x, t.y, 120, 74, ADD, D2.lamps - 0.05);
      const lo = L.lampOrigins[i];
      const lit = add(sc.add.image(lo.x, lo.y, AK2.lampLit(i)).setOrigin(0).setDepth(D2.lamps));
      const glow = soft(t.x, t.y, 40, 26, ADD, D2.lamps + 0.05);
      this.lamps.push({ lit, glow, halo });
    });

    // ---- LED boards on the stand walls + the scoreboard (letters as images: no repaints)
    this.leds = new LedBoards(ctx);
    this.score = new Scoreboard(ctx);

    // ---- the players' booth's team LED strip (a slow crimson chase)
    this.boothLeds = L.stands.boothLeds.slice().sort((p, q) => p.x - q.x);
    this.booth = add(sc.add.graphics()).setDepth(D2.stadium + 0.6).setBlendMode(ADD);

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

    // ---- referee light pylons (beacon shows whose turn it is)
    PYLONS.forEach((p, i) => {
      add(sc.add.image(p.x - Math.floor(PYLON_W / 2), p.y - PYLON_H + 2, AK2.pylon).setOrigin(0).setDepth(D2.props));
      const lx = p.x - Math.floor(PYLON_W / 2) + PYLON_LAMP.x - 2;
      const ly = p.y - PYLON_H + 2 + PYLON_LAMP.y - 4 + 1;
      const lamp = add(sc.add.image(lx, ly, AK2.beacon, '0').setOrigin(0).setDepth(D2.props + 0.01));
      const glow = soft(lx + 2, ly + 4, 22, 22, ADD, D2.props + 0.02);
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
    this.setActive(null, null);
  }

  // ================================================================ hooks from the board

  setActive(player: PlayerId | null, turn: number | null): void {
    this.active = player;
    this.score.setTurn(turn, player);
    this.leds.setTexts(` NEON DÜELLO • ${turn !== null ? `TUR ${turn} • ` : ''}`, (stand) => ` ${stand === 0 ? 'OYUNCU 1' : 'OYUNCU 2'} • NEON DÜELLO • `);
  }

  setScore(lp0: number, lp1: number): void {
    this.score.setScore(lp0, lp1);
  }

  scoreFlash(text: string, color: number | null, ms: number): void {
    this.score.flash(text, color, ms);
  }

  /**
   * The crowd reacts. 'cheer': that side's fans jump with their arms up, flags at 2×, flashes and
   * phone lights; 'gasp': phones up, the stands dim and hold still for a beat; 'roar': everyone
   * up, a wave around both stands, both confetti cannons.
   */
  crowd(kind: CrowdReaction, side: PlayerId | null, power = 1): void {
    const c = this.ctx;
    const k = Math.max(0.4, Math.min(2, power));
    const now = c.t;
    if (kind === 'gasp') {
      void c.run(260, (v) => (this.hush = Math.max(this.hush, v)), 'Quad.Out').then(() => c.run(700 * k, (v) => (this.hush = Math.min(this.hush, 1 - v)), 'Quad.In', 420 * k));
      this.phoneBurst = Math.max(this.phoneBurst, 1400 * k);
      return;
    }
    this.excite = 1;
    void c.run(1400 * k, (v) => (this.excite = Math.max(0, 1 - v)), 'Quad.In');
    const set: '0' | '1' | 'a' = kind === 'roar' || side === null ? 'a' : side === 0 ? '0' : '1';
    const dur = 620 * k;
    if (kind === 'roar') {
      // everyone up, then a wave runs around both stands
      for (const ch of this.chunks) {
        ch.upUntil = now + dur;
        ch.upSet = 'a';
        ch.upPhase = Math.floor(this.r() * CROWD_UP_FRAMES);
      }
      const waveMs = 1500;
      for (const ch of this.chunks) {
        const at = dur + ch.ring * waveMs;
        void c.run(1, () => {
          ch.upUntil = c.t + 300;
          ch.upSet = 'a';
        }, 'Linear', at);
      }
      this.cannon(0, 22);
      this.cannon(1, 22);
      this.phoneBurst = Math.max(this.phoneBurst, 2200);
    } else {
      for (const ch of this.chunks) {
        ch.upUntil = now + dur * (0.85 + this.r() * 0.3);
        ch.upSet = set;
        ch.upPhase = Math.floor(this.r() * CROWD_UP_FRAMES);
      }
      this.phoneBurst = Math.max(this.phoneBurst, 900 * k);
      if (side !== null && k >= 0.8) this.cannon(side, Math.round(12 * k));
    }
    const flashes = Math.round((kind === 'roar' ? 14 : 7) * k);
    for (let i = 0; i < flashes; i++) void c.run(1, () => this.cameraFlash(side ?? (this.r() < 0.5 ? 0 : 1)), 'Linear', i * 70);
  }

  /** A confetti cannon from a side's stand corner. */
  private cannon(player: PlayerId, n: number): void {
    const c = this.ctx;
    const [x, y] = player === 0 ? roofPoint(0, 3.2) : roofPoint(1, 3.2);
    for (let i = 0; i < n; i++) {
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
    const sc = this.ctx.scene;
    const g = this.ctx.add(sc.add.image(t.x, t.y, LT.radial).setDepth(D2.lamps + 0.1).setBlendMode(ADD).setTint(PAL.gold4));
    void this.ctx
      .run(
        420,
        (k) => {
          const s = (150 - k * 80) / LIGHT_TEX;
          g.setAlpha(0.9 * (1 - k)).setScale(s, s * 0.7);
        },
        'Quad.Out',
      )
      .then(() => this.ctx.remove(g));
  }

  destroy(): void {
    /* every texture here is boot-built and shared; images go with the board's objects */
  }

  // ================================================================ tick

  tick(dt: number, t: number, heat: number, towerLevel: number[]): void {
    const light = towerLevel.reduce((a, b) => a + b, 0) / towerLevel.length;
    // sky
    this.skyHot.setAlpha(heat).setVisible(heat > 0.001);
    this.clouds.forEach((c, i) => {
      c.tilePositionX = Math.round(t * (i ? 0.0021 : 0.0034)) % CLOUD_W;
      c.setTint(mix(PAL.white, PAL.crim4, heat * 0.4));
    });
    for (const s of this.stars) {
      const v = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
      s.img.setFrame(String(Math.min(s.maxFrame, Math.floor(v * (s.maxFrame + 0.999))))).setAlpha((0.45 + 0.55 * v) * (1 - 0.3 * heat));
    }
    for (const s of this.search) {
      const ang = s.base + s.amp * Math.sin((t / s.period + s.phase) * Math.PI * 2);
      s.img.setRotation(ang).setAlpha(light * (0.16 + 0.04 * Math.sin(t / 900 + s.phase * 7)) * (1 - 0.4 * heat)).setTint(mix(s.tint, PAL.fire3, heat * 0.6));
    }

    // stadium + crowd: lava light from the platform warms the walls and the lower tiers
    this.stadiumHot.setAlpha(heat).setVisible(heat > 0.001);
    this.crowdClock += dt * (1 + this.excite * 1.4) * (1 - 0.85 * this.hush);
    if (this.crowdClock >= 120) {
      this.crowdClock %= 120;
      this.crowdFrame = (this.crowdFrame + 1) % (CROWD_FRAMES * CROWD_UP_FRAMES);
    }
    // a smooth warm multiply tint under the volcano (no checker), a dim when the crowd gasps
    const dim = 1 - 0.38 * this.hush;
    const warm = mix(PAL.white, PAL.fire2, 0.3 * heat);
    const tint = mix(PAL.ink, warm, dim);
    for (const ch of this.chunks) {
      const up = t < ch.upUntil;
      const f = up ? `u${ch.upSet}:${(this.crowdFrame + ch.upPhase) % CROWD_UP_FRAMES}` : `i${this.crowdFrame % CROWD_FRAMES}`;
      if (ch.img.frame.name !== f) ch.img.setFrame(f);
      ch.img.setTint(tint);
    }
    for (const f of this.flags) {
      const speed = (1 + this.excite) * (1 - 0.7 * this.hush);
      const fr = Math.floor((t * speed) / f.speed + f.phase);
      f.img.setFrame(f.small ? `${f.side}:${fr % FLAG_S_FRAMES}` : `${f.side}:${f.design}:${fr % FLAG_FRAMES}`);
      f.img.setTint(tint);
    }
    for (const b of this.banners) b.img.setFrame(`${b.side}:${b.design}:${(Math.floor(t / 170) + b.phase) % BANNER_FRAMES}`);
    this.phoneBurst = Math.max(0, this.phoneBurst - dt);
    const burst = this.phoneBurst > 0;
    for (const ph of this.phones) {
      ph.next -= dt;
      if (ph.next <= 0) {
        ph.on = ph.on > 0 ? 0 : 1;
        ph.next = ph.on ? 400 + this.r() * 2600 : 600 + this.r() * 4000 * (1 - this.excite * 0.7);
      }
      const tw = 0.75 + 0.25 * Math.sin(t / 90 + ph.next);
      ph.img.setAlpha((burst ? 1 : ph.on) * tw);
    }
    for (const rl of this.roofLights) rl.img.setAlpha(0.55 + 0.45 * Math.sin(t / 700 + rl.phase));
    for (const fs of this.followSpots) {
      const L = arenaV2Layout().stands.crowdSpan[fs.stand];
      const k = 0.5 - 0.5 * Math.cos((t / 7000 + fs.phase) * Math.PI * 2);
      const x = L.a[0] + (L.b[0] - L.a[0]) * k;
      const y = L.a[1] + (L.b[1] - L.a[1]) * k;
      fs.img.setPosition(Math.round(x), Math.round(y)).setAlpha(light * 0.16 * (1 - heat) * dim).setTint(fs.stand === 0 ? PAL.cyan4 : PAL.crim4);
    }

    // floodlight banks
    this.lamps.forEach((l, i) => {
      const lvl = towerLevel[i];
      l.lit.setAlpha(lvl).setTint(mix(PAL.white, PAL.fire4, heat));
      l.glow.setAlpha(lvl * (0.5 + 0.06 * Math.sin(t / 300 + i))).setTint(mix(PAL.gold4, PAL.fire3, heat));
      l.halo.setAlpha(lvl * 0.24).setTint(mix(PAL.white, PAL.fire3, heat));
    });

    // camera flashes in the stands
    this.flashClock -= dt * (1 + this.excite * 3);
    if (this.flashClock <= 0) {
      this.flashClock = 220 + this.r() * 800;
      this.cameraFlash(this.r() < 0.5 ? 0 : 1);
    }

    this.leds.tick(dt, heat);
    this.score.tick(dt, t, heat);

    // the players' booth strip: a slow crimson chase
    const g = this.booth;
    g.clear();
    const n = this.boothLeds.length;
    for (let i = 0; i < n; i++) {
      const q = this.boothLeds[i];
      const ph = (((q.x - t * 0.02) % 16) + 16) % 16;
      if (ph < 5) {
        g.fillStyle(heat > 0.5 ? PAL.fire3 : ph < 1 ? PAL.crim4 : PAL.crim3, ph < 1 ? 0.9 : 0.6);
        g.fillRect(q.x, q.y, 1, 1);
      }
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
      p.glow.setTint(col).setAlpha(f === 1 || f === 2 ? 0.55 : 0.28);
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
    const sc = this.ctx.scene;
    const star = this.ctx.add(sc.add.image(x, y, TEX.spark).setDepth(D2.phones).setBlendMode(ADD).setTint(c));
    const glow = this.ctx.add(sc.add.image(x, y, LT.radial).setDepth(D2.phones).setBlendMode(ADD).setTint(c).setScale(18 / LIGHT_TEX).setAlpha(0.5));
    void this.ctx
      .run(
        160,
        (kk) => {
          star.setAlpha(1 - kk);
          glow.setAlpha(0.5 * (1 - kk));
        },
        'Quad.In',
        50,
      )
      .then(() => {
        this.ctx.remove(star);
        this.ctx.remove(glow);
      });
  }
}
