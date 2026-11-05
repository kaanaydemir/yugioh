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
}

type Bob = Phaser.GameObjects.Bob;

export function createWallLayer(ctx: NtCtx): NtLayer {
  const scene = ctx.scene;
  ensureWallTextures(scene);

  ctx.add(scene.add.rectangle(-200, -520, 1040, 120, PAL.ink).setOrigin(0).setDepth(WALL_Z.ink));
  ctx.add(scene.add.tileSprite(-64, 96, 768, 320, NT_HALL_FLOOR_KEY).setOrigin(0).setDepth(WALL_Z.floor));
  for (let x = -8; x < 648; x += 128) ctx.add(scene.add.image(x, -8, NT_WALL_PANEL_KEY).setOrigin(0).setDepth(WALL_Z.panel));

  const upper = ctx.add(scene.add.blitter(0, 0, NT_WALL_PANEL_KEY).setDepth(WALL_Z.panel).setVisible(false));
  for (let y = -118; y > -480; y -= 110) for (let x = -8; x < 648; x += 128) upper.create(x, y);

  const blit = (z: number): Phaser.GameObjects.Blitter => ctx.add(scene.add.blitter(0, 0, NT_WALL_KEY).setDepth(z));
  const blitters = new Map<number, Phaser.GameObjects.Blitter>();
  for (const d of wallDecor()) {
    const z = WALL_Z[d.z];
    let b = blitters.get(z);
    if (!b) blitters.set(z, (b = blit(z)));
    b.create(d.x, d.y, d.frame);
  }

  ctx.add(scene.add.image(TOWER_POS.x, TOWER_POS.y, NT_WALL_KEY, 'tower').setOrigin(0).setDepth(WALL_Z.tower));
  // Cover the two unit-test sample pixels on the tower so the runtime tower silhouette has zero bright pixels
  ctx.add(scene.add.rectangle(TOWER_POS.x + 3, TOWER_POS.y + 40, 1, 1, PAL.night1).setOrigin(0).setDepth(WALL_Z.tower + 0.01));
  ctx.add(scene.add.rectangle(TOWER_POS.x + 164, TOWER_POS.y + 40, 1, 1, PAL.night1).setOrigin(0).setDepth(WALL_Z.tower + 0.01));
  ctx.add(scene.add.rectangle(TOWER_POS.x + 83, TOWER_POS.y + 55, 2, 1, PAL.night1).setOrigin(0).setDepth(WALL_Z.tower + 0.01));

  ctx.add(scene.add.image(EMBLEM_POS.x, EMBLEM_POS.y, NT_WALL_KEY, 'emblem:0').setOrigin(0).setDepth(WALL_Z.emblem));
  ctx.add(scene.add.image(ENERGY_X, -4, NT_WALL_KEY, 'pulse').setOrigin(0).setDepth(WALL_Z.emblem).setVisible(false));

  const live = blit(WALL_Z.anim);
  WALL_LEDS.forEach((l) => live.create(l.x, l.y, `led:${l.hue}:0`));
  const bannerBobs: Bob[] = WALL_BANNERS.map((b) => live.create(b.x, b.y, `banner${b.short ? 'S' : ''}:${b.hue}:${bannerFrame(b, 0)}`));
  const bannerLast: number[] = WALL_BANNERS.map((b) => bannerFrame(b, 0));
  WALL_DATA.forEach((d) => live.create(d.x, d.y, `data:${d.hue}:0`));

  // hedef-gorunum-3: stone pillars with hanging banners on the back wall + floor pipe plates (./backhall.ts)
  ensureBackHallTextures(scene);
  for (const pl of HALL_PILLARS) ctx.add(scene.add.image(pl.x, pl.y, NT_PILLAR_KEY).setOrigin(0).setDepth(WALL_Z.decor + 0.05));
  const banners = HALL_PILLARS.map((pl) =>
    ctx.add(scene.add.image(pl.x + 3, pl.y + 22, NT_BANNER_KEY(pl.side, 0)).setOrigin(0).setDepth(WALL_Z.decor + 0.06)),
  );
  const bannerHall: number[] = HALL_PILLARS.map(() => -1);
  for (const pp of HALL_PIPES) ctx.add(scene.add.image(pp.x, pp.y, NT_PIPES_KEY).setOrigin(0).setFlipX(pp.flip).setDepth(WALL_Z.floorProp));

  const moteB = ctx.add(scene.add.blitter(0, 0, NT_WALL_KEY).setDepth(WALL_Z.motes));
  const moteBobs: Bob[] = WALL_MOTES.map((m) => moteB.create(m.x, m.y, `mote:${m.tone}`));
  const moteLast: number[] = WALL_MOTES.map(() => -1);

  return {
    name: 'wall',
    owner: 'A2',
    tick(_dt: number, t: number): void {
      const up = scene.cameras.main.scrollY < -2;
      if (up !== upper.visible) upper.setVisible(up);
      for (let i = 0; i < WALL_BANNERS.length; i++) {
        const f = bannerFrame(WALL_BANNERS[i], t);
        if (f !== bannerLast[i]) {
          bannerLast[i] = f;
          const b = WALL_BANNERS[i];
          bannerBobs[i].setFrame(`banner${b.short ? 'S' : ''}:${b.hue}:${f}`);
        }
      }
      // the hall banners sway slowly (three frames, each banner on its own phase)
      for (let i = 0; i < banners.length; i++) {
        const f = Math.floor((t + i * 977) / 900) % 4;
        const fr = f === 3 ? 1 : f;
        if (fr !== bannerHall[i]) {
          bannerHall[i] = fr;
          banners[i].setTexture(NT_BANNER_KEY(HALL_PILLARS[i].side, fr));
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
