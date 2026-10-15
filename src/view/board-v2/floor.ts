// Arena v2 pitch life: the floor around the platform. The marble's bounce light and the neon's
// coloured spill on the ground at the slab's base, the front-face LED strips running a chase in
// the player colours, low ground fog drifting across, floodlight pools with a lamp-hum flicker,
// maintenance LEDs chasing along the floor cables, marker lights along the painted boundary, a
// camera dolly gliding on its rail and a camera operator at work by the pitch side.

import Phaser from 'phaser';
import { AK2, FOG_H, FOG_W, arenaV2Layout, texOrigin2 } from '../../art/arena-v2';
import { CAM_FRAMES, CAM_H, CAM_W } from '../../art/arena-v2/props';
import type { TrimClass } from '../../art/arena-v2/geom';
import { PAL, PLAYER_RAMP } from '../../art/palette';
import { mix } from '../../art/pixel';
import type { PlayerId } from '../../engine/types';
import { TEX } from '../../vfx/core';
import { LIGHT_TEX, LT } from '../light/textures';
import { type BoardCtx, D2 } from './types';

type Img = Phaser.GameObjects.Image;
const ADD = Phaser.BlendModes.ADD;
const SCREEN = Phaser.BlendModes.SCREEN;

/** What the floor needs from the board. */
export interface FloorHost extends BoardCtx {
  readonly activeSide: PlayerId | null;
  readonly sideLevel: readonly [number, number, number];
  heatColor(c: number): number;
}

const CLS_RAMP = (cls: TrimClass) => (cls === 2 ? ([PAL.night4, PAL.steel, PAL.mist, PAL.white, PAL.white] as const) : PLAYER_RAMP[cls]);

export class Floor {
  private bounce: Img;
  private spill: Img[] = [];
  private lavaGlow: Img;
  private fog: { ts: Phaser.GameObjects.TileSprite; speed: number; alpha: number }[] = [];
  private pools: { img: Img; base: number; humAt: number; humUntil: number }[] = [];
  private faceFx: Phaser.GameObjects.Graphics;
  private floorFx: Phaser.GameObjects.Graphics;
  private dolly: Img;
  private dollyTally: Img;
  private cam: Img;
  private camTally: Img;
  private runs: { x: number; y: number; cls: TrimClass; s: number }[][] = [[], [], []];
  private runLen: [number, number, number] = [1, 1, 1];

  constructor(private readonly host: FloorHost) {
    const sc = host.scene;
    const L = arenaV2Layout();
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => host.add(o);
    const layer = (key: string, depth: number) => {
      const o = texOrigin2(key);
      return add(sc.add.image(o.x, o.y, key).setOrigin(0).setDepth(depth));
    };
    const soft = (x: number, y: number, w: number, h: number, blend: number, depth: number, tex: string = LT.radial) =>
      add(sc.add.image(x, y, tex).setScale(w / LIGHT_TEX, h / LIGHT_TEX).setBlendMode(blend).setDepth(depth));

    // the lava's glow on the pitch round the slab (volcano only)
    this.lavaGlow = soft(320, 200, 760, 330, SCREEN, D2.floorPool - 0.2, LT.wide).setTint(PAL.fire2).setAlpha(0);
    // floodlight pools on the pitch, each with its lamp's hum
    for (const [x, y, w, a] of [
      [70, 252, 170, 0.1],
      [590, 262, 160, 0.1],
      [140, 92, 140, 0.07],
      [520, 112, 140, 0.07],
      [300, 330, 190, 0.08],
    ] as const) {
      this.pools.push({ img: soft(x, y, w, w / 2, SCREEN, D2.floorPool - 0.1), base: a, humAt: 1500 + x * 7, humUntil: 0 });
    }
    // low ground fog drifting across the pitch (under the slab: the platform hides it)
    for (const [y, speed, alpha, key] of [
      [196, 0.0045, 0.2, 0],
      [244, -0.0032, 0.17, 1],
      [292, 0.0052, 0.21, 0],
      [326, -0.0038, 0.15, 1],
    ] as const) {
      const ts = add(sc.add.tileSprite(-60, y, 760, FOG_H, AK2.fog(key)).setOrigin(0).setDepth(D2.floorPool + 0.2).setTint(PAL.mist).setAlpha(alpha));
      ts.tilePositionX = Math.round(y * 3.3) % FOG_W;
      this.fog.push({ ts, speed, alpha });
    }
    // the marble's bounce light and the neon spill at the slab's base
    this.bounce = layer(AK2.bounce, D2.floorPool + 0.4).setBlendMode(SCREEN).setTint(PAL.mist);
    for (const cls of [0, 1, 2] as TrimClass[]) this.spill.push(layer(AK2.spill(cls), D2.floorPool + 0.5).setBlendMode(SCREEN).setTint(CLS_RAMP(cls)[3]));
    // chases (face LED strips on the slab; cable LEDs + markers on the floor)
    this.faceFx = add(sc.add.graphics()).setDepth(D2.trim + 0.1).setBlendMode(ADD);
    this.floorFx = add(sc.add.graphics()).setDepth(D2.stadium + 0.6).setBlendMode(ADD);
    for (const q of L.facePx) this.runs[q.cls].push(q);
    this.runs.forEach((r, i) => (this.runLen[i] = Math.max(1, r.length ? r[r.length - 1].s : 1)));
    // the camera dolly on its rail and the standing camera operator
    const P = L.pitch;
    this.dolly = add(sc.add.image(P.rail.a[0], P.rail.a[1], AK2.dollyCam, '0').setOrigin(8 / CAM_W, (CAM_H - 1) / CAM_H).setDepth(D2.props));
    this.dollyTally = add(sc.add.image(0, 0, TEX.px1).setDepth(D2.props + 0.01).setTint(PAL.crim3));
    this.cam = add(sc.add.image(P.cameraman.x, P.cameraman.y, AK2.cameraman, '0').setOrigin(8 / CAM_W, (CAM_H - 1) / CAM_H).setDepth(D2.props));
    this.camTally = add(sc.add.image(0, 0, TEX.px1).setDepth(D2.props + 0.01).setTint(PAL.crim3));
  }

  tick(dt: number, t: number, heat: number, light: number): void {
    void dt;
    const h = this.host;
    this.lavaGlow.setAlpha(heat * (0.3 + 0.06 * Math.sin(t / 480))).setVisible(heat > 0.001);
    for (const p of this.pools) {
      if (t >= p.humAt) {
        p.humUntil = t + 80;
        p.humAt = t + 2800 + ((p.humAt * 7919) % 5200);
      }
      const hum = t < p.humUntil ? 0.45 : 1;
      p.img.setAlpha(light * p.base * hum * (1 - 0.6 * heat) * (0.9 + 0.1 * Math.sin(t / 1900 + p.base * 50))).setTint(mix(PAL.white, PAL.fire3, heat));
    }
    for (const f of this.fog) {
      f.ts.tilePositionX = ((Math.round(t * f.speed) % FOG_W) + FOG_W) % FOG_W;
      f.ts.setAlpha(f.alpha * (0.6 + 0.4 * light)).setTint(mix(PAL.mist, PAL.fire3, heat * 0.7));
    }
    this.bounce.setAlpha(light * (0.13 + 0.02 * Math.sin(t / 2100))).setTint(mix(PAL.mist, PAL.fire4, heat));

    // ---- face LED strips: a player-colour chase (faster and brighter on the active side)
    const g = this.faceFx;
    g.clear();
    const act = h.activeSide;
    for (const cls of [0, 1, 2] as TrimClass[]) {
      const run = this.runs[cls];
      const ramp = CLS_RAMP(cls);
      const isActive = cls !== 2 && act === cls;
      const dir = cls === 1 ? -1 : 1;
      const speed = isActive ? 0.034 : 0.018;
      const period = cls === 2 ? 40 : 48;
      const seg = isActive ? 12 : 9;
      const amp = (cls === 2 ? 0.55 : isActive ? 1 : 0.55) * h.sideLevel[cls];
      const head = h.heatColor(ramp[4]);
      const body = h.heatColor(ramp[3]);
      for (const q of run) {
        const ph = (((q.s - dir * t * speed) % period) + period) % period;
        if (ph >= seg) continue;
        const k = ph / seg; // 0 = head
        const front = dir > 0 ? 1 - k : k;
        g.fillStyle(front > 0.8 ? head : body, amp * (0.25 + 0.75 * front));
        g.fillRect(q.x, q.y, 1, 1);
      }
      this.spill[cls].setAlpha(light * (cls === 2 ? 0.22 : isActive ? 0.42 + 0.06 * Math.sin(t / 400) : 0.26) * h.sideLevel[cls]).setTint(h.heatColor(ramp[3]));
    }

    // ---- floor: maintenance LEDs chase along the cables, markers along the boundary line
    const f = this.floorFx;
    f.clear();
    const P = arenaV2Layout().pitch;
    P.cableLeds.forEach((run, i) => {
      if (!run.length) return;
      const n = run.length;
      const pos = Math.floor(t / 140 + i * 3) % (n + 4);
      run.forEach((q, j) => {
        const d = pos - j;
        if (d >= 0 && d < 3) {
          f.fillStyle(d === 0 ? PAL.leaf4 : PAL.leaf3, d === 0 ? 1 : 0.5 / d);
          f.fillRect(q.x, q.y, 1, 1);
        } else if (j % 3 === 0) {
          f.fillStyle(PAL.leaf2, 0.3);
          f.fillRect(q.x, q.y, 1, 1);
        }
      });
    });
    const nm = P.markers.length;
    const mpos = (t / 95) % (nm + 6);
    P.markers.forEach((q, j) => {
      const d = mpos - j;
      const lit = d >= 0 && d < 3;
      const pulse = 0.35 + 0.25 * Math.sin(t / 600 + j * 0.9);
      f.fillStyle(lit ? PAL.gold4 : act === null ? PAL.mist : h.heatColor(PLAYER_RAMP[act][3]), lit ? 1 - d / 3 : pulse);
      f.fillRect(q.x, q.y, 1, 1);
    });
    for (const [i, q] of P.caseLeds.entries()) {
      const on = Math.floor(t / (300 + i * 70)) % 3 !== 0;
      f.fillStyle(q.color, on ? 0.9 : 0.25);
      f.fillRect(q.x, q.y, 1, 1);
    }
    // the open case's little monitor: a scrolling picture of the match
    const m = P.monitor;
    for (let x = 0; x < m.w; x++)
      for (let y = 0; y < m.h; y++) {
        const v = Math.sin((x + Math.floor(t / 160)) * 1.3 + y * 2.1);
        f.fillStyle(v > 0.3 ? PAL.cyan3 : v > -0.4 ? PAL.steel : PAL.crim3, 0.55);
        f.fillRect(m.x + x, m.y + y, 1, 1);
      }

    // ---- the camera dolly glides back and forth on its rail; the operator pans
    const u = 0.5 - 0.5 * Math.cos((t / 13000) * Math.PI * 2);
    const dx = Math.round(P.rail.a[0] + (P.rail.b[0] - P.rail.a[0]) * u);
    const dy = Math.round(P.rail.a[1] + (P.rail.b[1] - P.rail.a[1]) * u);
    this.dolly.setPosition(dx, dy).setFrame(String(Math.floor(t / 520) % CAM_FRAMES));
    const tally = Math.floor(t / 600) % 4 !== 3;
    this.dollyTally.setPosition(dx - 3, dy - 13).setAlpha(tally ? 1 : 0.2);
    this.cam.setFrame(String(Math.floor(t / 700 + 2) % CAM_FRAMES));
    this.camTally.setPosition(this.cam.x - 3, this.cam.y - 9).setAlpha(Math.floor(t / 600 + 1) % 4 !== 0 ? 1 : 0.2);
  }
}
