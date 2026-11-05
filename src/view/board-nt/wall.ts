// Neon Tower layer: WALL (tower + emblem + back wall + hall floor) — owner A2.
// Readability pass: calm, dark background wall with no distracting energy pulses or bright tower test-pixel dots.

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import {
  EMBLEM_POS,
  ENERGY_X,
  NT_HALL_FLOOR_KEY,
  NT_WALL_KEY,
  NT_WALL_PANEL_KEY,
  TOWER_POS,
  WALL_BANNERS,
  WALL_DATA,
  WALL_LEDS,
  WALL_MOTES,
  WALL_Z,
  bannerFrame,
  dataFrame,
  ledState,
  paintHallFloor,
  paintWallAtlas,
  paintWallPanel,
  wallDecor,
} from '../../art/arena-nt/wall';
import type { NtAtlas } from '../../art/arena-nt/wall-kit';
import { PixelCanvas } from '../../art/pixel';
import { BRICKWALL_AT, BRICK_BANNERS, BRICK_BOXES, BRICK_TORCHES, NT_BRICKWALL_KEY, paintBrickWall, paintPoolFlicker, poolRect } from '../../art/arena-nt/brickwall';
import { HALL_PILLARS, HALL_PIPES, NT_BANNER_KEY, NT_PILLAR_KEY, NT_PIPES_KEY, ensureBackHallTextures } from './backhall';
import { type NtCtx, type NtLayer } from './layer';
import { ensureNtTexture } from './textures';

let atlasCache: NtAtlas | null = null;
function wallAtlas(): NtAtlas {
  return (atlasCache ??= paintWallAtlas());
}

export function ensureWallTextures(scene: Phaser.Scene): void {
  ensureNtTexture(scene, 'wall', NT_WALL_KEY, () => wallAtlas().canvas);
  const tex = scene.textures.get(NT_WALL_KEY);
  for (const [name, r] of Object.entries(wallAtlas().frames)) if (!tex.has(name)) tex.add(name, 0, r.x, r.y, r.w, r.h);
  ensureNtTexture(scene, 'wall', NT_WALL_PANEL_KEY, paintWallPanel);
  ensureNtTexture(scene, 'wall', NT_HALL_FLOOR_KEY, paintHallFloor);
  // hedef-gorunum-3 back wall: its own layer name so the wall's navy lift (calm-remap LIFT_LAYERS) does not touch it
  ensureNtTexture(scene, 'brickwall', NT_BRICKWALL_KEY, () => paintBrickWall());
  BRICK_TORCHES.forEach((_, i) => ensureNtTexture(scene, 'brickwall', `${NT_BRICKWALL_KEY}:pool:${i}`, () => paintPoolFlicker(i)));
  // hedef-gorunum-3: the centre emblem as a steel-grey wall ornament (the navy emblem frame, recoloured; no lift remap)
  ensureNtTexture(scene, 'brickwall', NT_STEEL_EMBLEM_KEY, paintSteelEmblem);
}

const NT_STEEL_EMBLEM_KEY = 'nt:wall:brick:emblem';
const STEEL_OF: ReadonlyMap<number, number> = new Map([
  [PAL.night1, PAL.stone0],
  [PAL.night2, PAL.stone1],
  [PAL.night3, PAL.stone2],
  [PAL.night4, PAL.stone3],
]);
function paintSteelEmblem(): PixelCanvas {
  const r = wallAtlas().frames['emblem:0'];
  const p = wallAtlas().canvas.crop(r.x, r.y, r.w, r.h);
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const c = p.get(x, y);
      const m = c === null ? undefined : STEEL_OF.get(c);
      if (m !== undefined) p.set(x, y, m);
    }
  return p;
}

/** Atlas frames of the old navy wall that the brick wall replaces (pillars, ceiling lamps, the dithered screen spill). */
const BRICK_REPLACES = /^(pillar:|lamp:|glow:)/;

type Bob = Phaser.GameObjects.Bob;

export function createWallLayer(ctx: NtCtx): NtLayer {
  const scene = ctx.scene;
  ensureWallTextures(scene);

  ctx.add(scene.add.rectangle(-200, -520, 1040, 120, PAL.ink).setOrigin(0).setDepth(WALL_Z.ink));
  ctx.add(scene.add.tileSprite(-64, 96, 768, 320, NT_HALL_FLOOR_KEY).setOrigin(0).setDepth(WALL_Z.floor));
  // hedef-gorunum-3: one full-width brick back wall (pillars, plaque, warm sconce pools baked per brick)
  ctx.add(scene.add.image(BRICKWALL_AT.x, BRICKWALL_AT.y, NT_BRICKWALL_KEY).setOrigin(0).setDepth(WALL_Z.panel));
  // the sconce pools breathe: each torch's pool steps one notch wider now and then (an opaque palette overlay, no alpha)
  const pools = BRICK_TORCHES.map((_, i) => {
    const r = poolRect(i);
    return { img: ctx.add(scene.add.image(r.x, r.y, `${NT_BRICKWALL_KEY}:pool:${i}`).setOrigin(0).setDepth(WALL_Z.panel + 0.01).setVisible(false)), last: -1 };
  });
  let lit = true;

  const upper = ctx.add(scene.add.blitter(0, 0, NT_WALL_PANEL_KEY).setDepth(WALL_Z.panel).setVisible(false));
  for (let y = -118; y > -480; y -= 110) for (let x = -8; x < 648; x += 128) upper.create(x, y);

  const blit = (z: number): Phaser.GameObjects.Blitter => ctx.add(scene.add.blitter(0, 0, NT_WALL_KEY).setDepth(z));
  const blitters = new Map<number, Phaser.GameObjects.Blitter>();
  for (const d of wallDecor()) {
    if (BRICK_REPLACES.test(d.frame)) continue;
    const z = WALL_Z[d.z];
    let b = blitters.get(z);
    if (!b) blitters.set(z, (b = blit(z)));
    b.create(d.x, d.y, d.frame);
  }

  // hedef-gorunum-3: the navy reactor tower is gone; the emblem hangs on the brick wall's stone plaque
  void TOWER_POS;

  ctx.add(scene.add.image(EMBLEM_POS.x, EMBLEM_POS.y, NT_STEEL_EMBLEM_KEY).setOrigin(0).setDepth(WALL_Z.emblem));
  ctx.add(scene.add.image(ENERGY_X, -4, NT_WALL_KEY, 'pulse').setOrigin(0).setDepth(WALL_Z.emblem).setVisible(false));

  // hedef-gorunum-3: the tower's LEDs / data panels / neon banners went with the tower (lists kept for the tests)
  void WALL_LEDS;
  void WALL_DATA;
  void ledState;
  void dataFrame;
  const bannerBobs: Bob[] = [];
  const bannerLast: number[] = [];
  const WALL_BANNERS_LIVE: typeof WALL_BANNERS = [];

  // hedef-gorunum-3: crimson banners with a gold sigil hang on the brick wall + floor pipe plates (./backhall.ts)
  ensureBackHallTextures(scene);
  void HALL_PILLARS;
  void NT_PILLAR_KEY;
  const banners = BRICK_BANNERS.map((b) => ctx.add(scene.add.image(b.x, b.y, NT_BANNER_KEY(1, 0)).setOrigin(0).setDepth(WALL_Z.decor + 0.06)));
  const bannerHall: number[] = BRICK_BANNERS.map(() => -1);
  // status-box LEDs: each blinks on its own slow rhythm (lit = the LED colour, off = ink baked in the wall)
  const boxLeds = BRICK_BOXES.flatMap((b, bi) =>
    b.leds.map(([lx, ly, c], li) => ({
      dot: ctx.add(scene.add.rectangle(b.x + lx, b.y + ly, 1, 1, c).setOrigin(0).setDepth(WALL_Z.decor + 0.07)),
      period: 1700 + ((bi * 7 + li * 13) % 9) * 410,
      phase: (bi * 1931 + li * 787) % 3000,
      on: true,
    })),
  );
  for (const pp of HALL_PIPES) ctx.add(scene.add.image(pp.x, pp.y, NT_PIPES_KEY).setOrigin(0).setFlipX(pp.flip).setDepth(WALL_Z.floorProp));

  const moteB = ctx.add(scene.add.blitter(0, 0, NT_WALL_KEY).setDepth(WALL_Z.motes));
  const moteBobs: Bob[] = WALL_MOTES.map((m) => moteB.create(m.x, m.y, `mote:${m.tone}`));
  const moteLast: number[] = WALL_MOTES.map(() => -1);

  return {
    name: 'wall',
    owner: 'A2',
    setLights(on: boolean): Promise<void> {
      lit = on;
      return Promise.resolve();
    },
    tick(_dt: number, t: number): void {
      const up = scene.cameras.main.scrollY < -2;
      if (up !== upper.visible) upper.setVisible(up);
      for (let i = 0; i < pools.length; i++) {
        // a slow irregular breath: 260 ms buckets, wide on ~40 % of them, each torch on its own hash
        const b = Math.floor((t + i * 613) / 260);
        const on = lit && ((Math.imul(b ^ (i * 0x45d9f3b), 0x27d4eb2d) >>> 0) % 100 < 40) ? 1 : 0;
        if (on !== pools[i].last) {
          pools[i].last = on;
          pools[i].img.setVisible(on === 1);
        }
      }
      for (const l of boxLeds) {
        const u = ((t + l.phase) % l.period) / l.period;
        const on = u < 0.55 || (u > 0.7 && u < 0.78);
        if (on !== l.on) {
          l.on = on;
          l.dot.setVisible(on);
        }
      }
      for (let i = 0; i < WALL_BANNERS_LIVE.length; i++) {
        const f = bannerFrame(WALL_BANNERS_LIVE[i], t);
        if (f !== bannerLast[i]) {
          bannerLast[i] = f;
          const b = WALL_BANNERS_LIVE[i];
          bannerBobs[i].setFrame(`banner${b.short ? 'S' : ''}:${b.hue}:${f}`);
        }
      }
      // the hall banners sway slowly (three frames, each banner on its own phase)
      for (let i = 0; i < banners.length; i++) {
        const f = Math.floor((t + i * 977) / 900) % 4;
        const fr = f === 3 ? 1 : f;
        if (fr !== bannerHall[i]) {
          bannerHall[i] = fr;
          banners[i].setTexture(NT_BANNER_KEY(1, fr));
        }
      }
      for (let i = 0; i < WALL_MOTES.length; i++) {
        const m = WALL_MOTES[i];
        const span = 100;
        const y = 12 + ((((m.y - 12 - (m.vy * (t + m.phase)) / 1000) % span) + span) % span);
        const x = m.x + Math.round(m.amp * Math.sin(((t + m.phase) / m.swayP) * Math.PI * 2));
        const key = Math.floor(y) * 1000 + x;
        if (key !== moteLast[i]) {
          moteLast[i] = key;
          moteBobs[i].x = x;
          moteBobs[i].y = Math.floor(y);
        }
      }
    },
    destroy(): void {},
  };
}

export { paintWallAtlas, paintWallPanel, paintHallFloor };
export type { PixelCanvas };
