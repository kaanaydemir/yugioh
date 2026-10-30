// Neon Tower layer: WALL (tower + emblem + back wall + hall floor) — owner A2 (docs/v3/ARENA_NEON_TOWER.md §2, §3, §8).
// Draws the dark navy / violet hall: an ink base over everything the camera can reach (replaces BoardViewCalm's
// ink base, bg masks and stars: BoardViewNt passes skip.background), the iso hall floor, the wall band (panels,
// ceiling truss, plinth), the tall symmetrical tower with the original winged-shield emblem and the small
// corridor, flanking pillars with a dim neon tube, hanging banners, the empty screen bays (B2 fills the
// screens) and the hologram socles (B2's plinth sits on them), ceiling lamp fixtures, status LEDs, tiny data
// panels and a few dust motes. Rich but calm: bright neon only as thin dim lines, everything on the scene clock
// (tick), no tweens, no per-object timers: the whole layer is ~10 game objects.
// Depth: NT_DEPTH.wall … wallLights (wall.ts art: WALL_Z). Painter: src/art/arena-nt/wall*.ts.

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
import { type NtCtx, type NtLayer } from './layer';
import { ensureNtTexture } from './textures';

let atlasCache: NtAtlas | null = null;
function wallAtlas(): NtAtlas {
  return (atlasCache ??= paintWallAtlas());
}

/** Register the wall's textures once (boot step 23 and, as a fallback, the layer): atlas + frames, panel tile, floor tile. */
export function ensureWallTextures(scene: Phaser.Scene): void {
  ensureNtTexture(scene, 'wall', NT_WALL_KEY, () => wallAtlas().canvas);
  const tex = scene.textures.get(NT_WALL_KEY);
  for (const [name, r] of Object.entries(wallAtlas().frames)) if (!tex.has(name)) tex.add(name, 0, r.x, r.y, r.w, r.h);
  ensureNtTexture(scene, 'wall', NT_WALL_PANEL_KEY, paintWallPanel);
  // the floor tile feeds a TileSprite (which needs power-of-two sizes: 64 × 32 is)
  ensureNtTexture(scene, 'wall', NT_HALL_FLOOR_KEY, paintHallFloor);
}

type Bob = Phaser.GameObjects.Bob;

export function createWallLayer(ctx: NtCtx): NtLayer {
  const scene = ctx.scene;
  ensureWallTextures(scene);

  // ---- base: ink over everything the camera can reach (the opening descends above the frame), then the floor
  // (the wall and the floor cover the frame; the ink only fills the far top the descending opening camera can reach)
  ctx.add(scene.add.rectangle(-200, -520, 1040, 120, PAL.ink).setOrigin(0).setDepth(WALL_Z.ink));
  // iso floor: tile origin (0,0) mod (64,32) so its seams run on the platform's 2:1 grid (diamond centre = world (288, 80))
  ctx.add(scene.add.tileSprite(-64, 96, 768, 320, NT_HALL_FLOOR_KEY).setOrigin(0).setDepth(WALL_Z.floor));
  // wall band: the 128-px panel tile repeated (6 images)
  for (let x = -8; x < 648; x += 128) ctx.add(scene.add.image(x, -8, NT_WALL_PANEL_KEY).setOrigin(0).setDepth(WALL_Z.panel));

  // the opening camera descends from high above the frame: stack the wall upward (a blitter, one object) so it shows hall, not void
  const upper = ctx.add(scene.add.blitter(0, 0, NT_WALL_PANEL_KEY).setDepth(WALL_Z.panel).setVisible(false));
  for (let y = -118; y > -480; y -= 110) for (let x = -8; x < 648; x += 128) upper.create(x, y);

  // ---- static decor in three blitters (one per sub-depth)
  const blit = (z: number): Phaser.GameObjects.Blitter => ctx.add(scene.add.blitter(0, 0, NT_WALL_KEY).setDepth(z));
  const blitters = new Map<number, Phaser.GameObjects.Blitter>();
  for (const d of wallDecor()) {
    const z = WALL_Z[d.z];
    let b = blitters.get(z);
    if (!b) blitters.set(z, (b = blit(z)));
    b.create(d.x, d.y, d.frame);
  }

  // ---- the tower and its emblem
  ctx.add(scene.add.image(TOWER_POS.x, TOWER_POS.y, NT_WALL_KEY, 'tower').setOrigin(0).setDepth(WALL_Z.tower));
  const emblem = ctx.add(scene.add.image(EMBLEM_POS.x, EMBLEM_POS.y, NT_WALL_KEY, 'emblem:0').setOrigin(0).setDepth(WALL_Z.emblem));
  const energy = ctx.add(scene.add.image(ENERGY_X, -4, NT_WALL_KEY, 'pulse').setOrigin(0).setDepth(WALL_Z.emblem).setVisible(false));

  // ---- living details (animated blitter: LEDs, banners, data panels)
  const live = blit(WALL_Z.anim);
  const ledBobs: Bob[] = WALL_LEDS.map((l) => live.create(l.x, l.y, `led:${l.hue}:${ledState(l, 0)}`));
  const ledLast: number[] = WALL_LEDS.map((l) => ledState(l, 0));
  const bannerBobs: Bob[] = WALL_BANNERS.map((b) => live.create(b.x, b.y, `banner${b.short ? 'S' : ''}:${b.hue}:${bannerFrame(b, 0)}`));
  const bannerLast: number[] = WALL_BANNERS.map((b) => bannerFrame(b, 0));
  const dataBobs: Bob[] = WALL_DATA.map((d) => live.create(d.x, d.y, `data:${d.hue}:${dataFrame(d, 0)}`));
  const dataLast: number[] = WALL_DATA.map((d) => dataFrame(d, 0));

  // ---- dust motes (above the screens, calm)
  const moteB = ctx.add(scene.add.blitter(0, 0, NT_WALL_KEY).setDepth(WALL_Z.motes));
  const moteBobs: Bob[] = WALL_MOTES.map((m) => moteB.create(m.x, m.y, `mote:${m.tone}`));
  const moteLast: number[] = WALL_MOTES.map(() => -1);

  let emblemLast = 0;

  return {
    name: 'wall',
    owner: 'A2',
    tick(_dt: number, t: number): void {
      // the upper wall is only needed while the opening camera looks above the frame
      const up = scene.cameras.main.scrollY < -2;
      if (up !== upper.visible) upper.setVisible(up);
      // status LEDs: only touch a bob when its state changes
      for (let i = 0; i < WALL_LEDS.length; i++) {
        const s = ledState(WALL_LEDS[i], t);
        if (s !== ledLast[i]) {
          ledLast[i] = s;
          ledBobs[i].setFrame(`led:${WALL_LEDS[i].hue}:${s}`);
        }
      }
      for (let i = 0; i < WALL_BANNERS.length; i++) {
        const f = bannerFrame(WALL_BANNERS[i], t);
        if (f !== bannerLast[i]) {
          bannerLast[i] = f;
          const b = WALL_BANNERS[i];
          bannerBobs[i].setFrame(`banner${b.short ? 'S' : ''}:${b.hue}:${f}`);
        }
      }
      for (let i = 0; i < WALL_DATA.length; i++) {
        const f = dataFrame(WALL_DATA[i], t);
        if (f !== dataLast[i]) {
          dataLast[i] = f;
          dataBobs[i].setFrame(`data:${WALL_DATA[i].hue}:${f}`);
        }
      }
      // emblem: a slow pulse, one tone brighter for 500 ms every 4.6 s
      const e = t % 4600 < 500 ? 1 : 0;
      if (e !== emblemLast) {
        emblemLast = e;
        emblem.setFrame(`emblem:${e}`);
      }
      // a bright dot climbs the tower's energy line, one pass every 3.7 s (700 ms of travel)
      const u = (t % 3700) / 700;
      if (u < 1) {
        energy.setVisible(true).setY(Math.floor(21 - 24 * u));
      } else if (energy.visible) energy.setVisible(false);
      // dust motes: drift up and sway, whole pixels only
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
    destroy(): void {
      /* objects are owned by the view (ctx.add) */
    },
  };
}

// painter fallbacks for tests / tools that want a canvas without Phaser
export { paintWallAtlas, paintWallPanel, paintHallFloor };
export type { PixelCanvas };
