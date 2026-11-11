// Neon Tower layer: LIGHTS — owner C.
// Readability pass: layered slowly drifting billowy fog toward the edges & hologram statues,
// plus sculpted warm flickering torches with soft radial amber glow halos (matching docs/v3/ref/hedef-gorunum-2.png).

import {
  NT_LIGHTS_KEY,
  type LightsBake,
  TORCH_GLOW,
  TORCH_MOUNT,
  bakeLights,
  lightFrame,
  torchFrame,
} from '../../art/arena-nt/lights';
import { RIBBONS, RIBBON_FRAMES, paintRibbon, ribbonKey } from '../../art/arena-nt/fog-ribbons';
import { CLOUDS, CLOUD_FRAMES, cloudKey, paintCloud } from '../../art/arena-nt/fog-clouds';
import { BRICK_TORCHES, NT_WALL_TORCH_KEY, WALL_TORCH, paintWallTorch } from '../../art/arena-nt/brickwall';
import { BRAZIER, BRAZIERS, BRAZIER_POOL, brazierPool, paintBrazier } from '../../art/arena-nt/hallfloor';
import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { attributeLightColor, lightFlash } from '../light';
import type { Attribute } from '../../data/cards';
import type { GameEvent, PlayerId } from '../../engine/types';
import { BOARD_V4, zoneXY } from '../layout';
import { REDUCED_MOTION } from '../v3/motion';
import type { CrowdReaction } from './api';
import { NT_DEPTH } from './layout-nt';
import { type NtCtx, type NtEventInfo, type NtLayer } from './layer';
import { ensureNtTexture } from './textures';

type Img = Phaser.GameObjects.Image;

const FOG_BANK_KEY = 'nt:fog:bank-v3';
/** Arena v4: the fog's light (multiply tint): the hall's cool dim ambient (board-nt/glow.ts AMBIENT), a notch brighter. */
const FOG_TINT_V4 = 0x8c90b0;
const FOG_WISP_KEY = 'nt:fog:wisp-v3';
/** Arena v5 step 3: the fog banks' light (multiply tint): the grey banks turn the target's cool lavender, the back ones dimmer. */
const FOG_CLOUD_TINT = { back: 0x8a80b4, front: 0xa898d0 } as const;
const TORCH_GLOW_KEY = 'nt:torch:glow-v3';

let bakeCache: LightsBake | null = null;
function lightsBake(): LightsBake {
  return (bakeCache ??= bakeLights());
}

function paintMultiLobeFog(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  lobes: readonly { cx: number; cy: number; rx: number; ry: number; a0: number; a1: number }[],
): void {
  ctx.clearRect(0, 0, w, h);
  for (const l of lobes) {
    ctx.save();
    ctx.translate(l.cx, l.cy);
    ctx.scale(1, l.ry / l.rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, l.rx);
    // cool grey-violet fog: hedef-2's fog over hedef-1's navy / violet hall
    g.addColorStop(0, `rgba(106, 108, 136, ${l.a0})`);
    g.addColorStop(0.45, `rgba(72, 74, 104, ${l.a1})`);
    g.addColorStop(0.78, `rgba(38, 40, 64, ${(l.a1 * 0.48).toFixed(3)})`);
    g.addColorStop(1, 'rgba(18, 20, 38, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, l.rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function ensureLightsTextures(scene: Phaser.Scene): void {
  ensureNtTexture(scene, 'lights', NT_LIGHTS_KEY, () => lightsBake().canvas);
  const tex = scene.textures.get(NT_LIGHTS_KEY);
  for (const [name, r] of Object.entries(lightsBake().frames)) if (!tex.has(name)) tex.add(name, 0, r.x, r.y, r.w, r.h);
  // hedef-gorunum-3 + pixel rules: no smooth canvas fog / glow any more (the atlas has the dithered ones)
  void paintMultiLobeFog;
  // arena v5 step 3: the fog banks, the brazier frames and their light pools are baked at boot too
  if (BOARD_V4) {
    CLOUDS.forEach((spec, i) => {
      for (let f = 0; f < CLOUD_FRAMES; f++) ensureNtTexture(scene, 'fog-cloud', cloudKey(i, f), () => paintCloud(spec, f));
    });
    for (let f = 0; f < BRAZIER.frames; f++) ensureNtTexture(scene, 'brazier', NT_BRAZIER_KEY(f), () => paintBrazier(f));
    for (let f = 0; f < BRAZIER_POOL.frames; f++) ensureBrazierPool(scene, f);
  }
}

interface FogDrifter {
  img: Img;
  baseX: number;
  baseY: number;
  ampX: number;
  ampY: number;
  period: number;
  phase: number;
  lastX: number;
  lastY: number;
}

interface TorchLight {
  img: Img;
  glow: Img;
  period: number;
  phase: number;
  lastFrame: number;
  frameOf: (f: number) => string;
  wall: boolean;
  pool: Img | null;
}

/**
 * hedef-gorunum-3: every torch is mounted — `x, y` is the FLAME centre.
 * - 'sconce': iron brackets on the back wall's pillars (beside the tower and outside the screens);
 * - 'post': braziers on stone posts standing on the hall floor (left / right of the stage, clear of the HUD).
 */
const TORCH_SPOTS: readonly { kind: 'sconce' | 'post'; x: number; y: number; depth: number; period: number; phase: number }[] = [
  // wall sconces on the brick back wall (src/art/arena-nt/brickwall.ts BRICK_TORCHES; their warm pools are baked per brick)
  ...BRICK_TORCHES.map((b, i) => ({
    kind: 'sconce' as const,
    x: b.x,
    y: b.y,
    depth: NT_DEPTH.wallLights + 0.5,
    period: [420, 460, 440, 410][i % 4],
    phase: [0, 140, 290, 80][i % 4],
  })),
  // arena v3 "floor and braziers": stone-post braziers at hedef-gorunum-3's spots (x, y = flame centre); their warm
  // stepped floor pools are baked into the hall floor (art/arena-nt/hallfloor.ts)
  ...BRAZIERS.map((b) => ({
    kind: 'post' as const,
    x: b.x,
    y: b.y - BRAZIER.h + 1 + BRAZIER.flameY,
    depth: NT_DEPTH.platform + 1.5,
    period: b.period,
    phase: b.phase,
  })),
];
const NT_BRAZIER_KEY = (f: number): string => `nt:hall:brazier:${f}`;
/** arena v5 step 3: the braziers' soft light pool on the hall floor (ADD, light layer), three flicker frames. */
const NT_BRAZIER_POOL_KEY = (f: number): string => `nt:hall:brazierpool:${f}`;
/** The pool's warm tint (the fire's orange) and its depth: over the hall floor and its veil, under the stage and the fog. */
const BRAZIER_POOL_TINT = PAL.fire3;
const BRAZIER_POOL_Z = NT_DEPTH.wall + 0.98;
/** Brazier frame (flame height 15 16 17 16 14 15) → pool frame (low / mid / tall). */
const POOL_OF_FRAME = [0, 1, 2, 1, 0, 0] as const;
function ensureBrazierPool(scene: Phaser.Scene, f: number): string {
  const key = NT_BRAZIER_POOL_KEY(f);
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.createCanvas(key, BRAZIER_POOL.w, BRAZIER_POOL.h);
  if (!t) return '__DEFAULT';
  const img = new ImageData(BRAZIER_POOL.w, BRAZIER_POOL.h);
  img.data.set(brazierPool(f));
  t.getContext().putImageData(img, 0, 0);
  t.refresh();
  return key;
}

export function createLightsLayer(ctx: NtCtx): NtLayer {
  const scene = ctx.scene;
  ensureLightsTextures(scene);

  const fogs: FogDrifter[] = [];
  // hedef-gorunum-3 + pixel rules: the fog is the baked ordered-dither fog of the lights atlas (palette only, opaque
  // pixels, no alpha); it lies LOW (hall floor, the stage's foot, the hologram plinths) in layers that drift slowly.
  const addFog = (frame: string, x: number, y: number, flipX: boolean, depth: number, ampX: number, ampY: number, period: number, phase: number): void => {
    const img = ctx.add(scene.add.image(x, y, NT_LIGHTS_KEY, frame).setOrigin(0).setFlipX(flipX).setDepth(depth));
    // arena v4 step 2 (value separation): the fog lies in the hall's dim light like the floor under it (a multiply tint —
    // the light layer's job, the baked fog pixels stay as they are), so it never reads brighter than the monsters
    if (BOARD_V4) img.setTint(FOG_TINT_V4);
    fogs.push({ img, baseX: x, baseY: y, ampX, ampY, period, phase, lastX: x, lastY: y });
  };
  void FOG_BANK_KEY;
  void FOG_WISP_KEY;

  // arena v3 "Fog" (hedef-gorunum-3): low cumulus streaks (art/arena-nt/lights.ts FOG_BANKS) lying on the hall floor at
  // both edges, under the stage's depth (never over the board), clear of the brazier pools; each one sways slowly on its
  // own period (big banks slow, thin wisps a little faster) so the layers slide past each other.
  // [bank, x, y, flipX, ampX, ampY, period ms, phase ms] — back banks (0–3) first, then the lit-cap front banks; every
  // placement has its own baked bank (no flipX), so all caps face the same upper-left light
  const BANKS: readonly [number, number, number, boolean, number, number, number, number][] = [
    // back layer
    [0, -74, 148, false, 6, 1, 26000, 0],
    [3, -46, 226, false, 7, 1, 23000, 9000],
    [2, 486, 156, false, -6, 1, 27000, 4000],
    [1, 518, 228, false, -7, 1, 24000, 15000],
    [14, -64, 120, false, 6, 1, 25000, 12000],
    [19, 494, 132, false, -6, 1, 25500, 3000],
    // left edge, front
    [15, 18, 136, false, 9, 1, 16500, 4400],
    [4, -28, 166, false, 9, 1, 17000, 2000],
    [8, 32, 192, false, 12, 0, 13000, 6400],
    [5, -52, 204, false, 8, 1, 21000, 5200],
    [6, -18, 246, false, 9, 1, 15000, 9100],
    [9, 8, 282, false, 12, 0, 12000, 3300],
    // right edge, front
    [12, 578, 150, false, -12, 0, 13500, 8800],
    [10, 536, 176, false, -9, 1, 18000, 7400],
    [7, 514, 200, false, -7, 1, 16000, 1800],
    [11, 552, 252, false, -8, 1, 19000, 11800],
    [13, 492, 286, false, -12, 0, 12500, 6100],
    // stage base skirts + right plinth foot
    [16, 50, 206, false, 8, 1, 17500, 10200],
    [17, 190, 262, false, 9, 1, 15500, 4700],
    [18, 408, 258, false, -8, 1, 16500, 12300],
    [20, 540, 148, false, -8, 1, 18500, 7000],
    // pixel/polish crit round 2 #3: denser low banks along the floor at the lower left / lower right (target)
    [2, -118, 222, false, 5, 1, 29000, 6000],
    [0, 512, 236, false, -5, 1, 28000, 13000],
    // pixel/polish crit round 3 #3: one more layered front bank in each lower margin (below y 230, clear of the board)
    [5, 46, 236, false, 7, 1, 22500, 7600],
    [7, 470, 262, false, -7, 1, 20500, 3900],
  ];
  if (!BOARD_V4)
    BANKS.forEach(([i, x, y, flip, ax, ay, period, phase], k) =>
      addFog(lightFrame.fogBank(i), x, y, flip, NT_DEPTH.platform - 0.18 + k * 0.001, ax, ay, period, phase),
    );

  // arena v5 step 3 (target hedef-gorunum-5: chunky lavender fog banks in the hall's corners): soft pixel-art fog CLOUDS
  // (art/arena-nt/fog-clouds.ts) replace the v4 ribbons. Back banks lie behind the stage (under its depth: they wrap the stage
  // foot and the hologram plinths' feet), front banks sit in the hall's lower corners over the floor (above the stage veil,
  // under the braziers). Each bank boils through its baked frames on its own rhythm and drifts slowly along x; none ever
  // reaches the stage top, and the HUD / hand / buttons / hint bar draw above every bank.
  void RIBBONS;
  void RIBBON_FRAMES;
  void paintRibbon;
  void ribbonKey;
  const ribbons: { img: Img; frames: string[]; ms: number; off: number; last: number; baseX: number; ampX: number; period: number; phase: number; lastX: number }[] = [];
  if (BOARD_V4) {
    const keys = CLOUDS.map((spec, i) => Array.from({ length: CLOUD_FRAMES }, (_, f) => ensureNtTexture(scene, 'fog-cloud', cloudKey(i, f), () => paintCloud(spec, f))));
    // [bank, x, y, front, ampX, drift period ms, ms per frame, phase ms, flipX]
    const PLACE: readonly [number, number, number, boolean, number, number, number, number, boolean][] = [
      // back: round the left plinth's foot and along the stage's left foot
      [1, -66, 162, false, 8, 34000, 420, 0, false],
      [2, -120, 172, false, 10, 30000, 380, 7000, true],
      // back: round the right plinth's foot and behind the stage's right foot
      [1, 590, 180, false, -8, 32000, 400, 11000, true],
      [2, 440, 208, false, -10, 29000, 430, 5000, false],
      [0, 420, 252, false, -7, 35000, 410, 16000, true],
      // front: the lower-left corner (two banks stacked)
      [3, -44, 256, true, 7, 26000, 360, 2000, false],
      [5, 48, 274, true, 6, 24000, 340, 8000, true],
      // front: the lower-right corner and the right edge
      [3, 582, 270, true, -7, 27000, 370, 6000, true],
      [5, 530, 284, true, -6, 23000, 350, 12000, false],
      [4, 606, 206, true, -8, 25000, 380, 1000, true],
    ];
    PLACE.forEach(([i, x, y, front, ampX, period, ms, phase, flip], k) => {
      const depth = front ? NT_DEPTH.platform + 1.48 + k * 0.0001 : NT_DEPTH.platform - 0.18 + k * 0.001;
      const img = ctx.add(scene.add.image(x, y, keys[i][0]).setOrigin(0).setFlipX(flip).setDepth(depth).setTint(front ? FOG_CLOUD_TINT.front : FOG_CLOUD_TINT.back));
      ribbons.push({ img, frames: keys[i], ms, off: (k * 3) % CLOUD_FRAMES, last: -1, baseX: x, ampX, period, phase, lastX: x });
    });
  }

  // 4. mounted torches (wall sconces / post braziers) with an ordered-dither warm glow behind them
  const torches: TorchLight[] = TORCH_SPOTS.map((spot) => {
    void TORCH_GLOW_KEY;
    const glow = ctx.add(
      scene.add
        .image(spot.x - TORCH_GLOW.cx, spot.y - TORCH_GLOW.cy, NT_LIGHTS_KEY, torchFrame.glow(0))
        .setOrigin(0)
        .setDepth(spot.depth - 0.05)
        // a wall sconce's light is the stepped brick pool baked into the back wall (brickwall.ts): no dithered halo
        // posts: the pool is baked into the floor; no dithered halo (it read as a dotted fringe)
        .setAlpha(0),
    );
    const wall = spot.kind === 'sconce';
    // wall sconces: the dedicated wall torch of brickwall.ts (own textures); posts: the brazier frames of the lights atlas
    const frameOf = (f: number): string => (wall ? NT_WALL_TORCH_KEY(f) : NT_BRAZIER_KEY(f));
    if (wall) for (let f = 0; f < WALL_TORCH.frames; f++) ensureNtTexture(scene, 'brickwall', NT_WALL_TORCH_KEY(f), () => paintWallTorch(f));
    else for (let f = 0; f < BRAZIER.frames; f++) ensureNtTexture(scene, 'brazier', NT_BRAZIER_KEY(f), () => paintBrazier(f));
    void TORCH_MOUNT;
    const img = ctx.add(
      (wall
        ? scene.add.image(spot.x - WALL_TORCH.cx, spot.y - WALL_TORCH.flameY, frameOf(0))
        : scene.add.image(spot.x - BRAZIER.cx, spot.y - BRAZIER.flameY, frameOf(0))
      )
        .setOrigin(0)
        .setDepth(spot.depth),
    );
    // v5 step 3: the brazier's warm pool on the floor flickers with its flame (ADD, light layer only; the floor art is unlit)
    const pool =
      BOARD_V4 && !wall
        ? ctx.add(
            scene.add
              .image(spot.x - BRAZIER_POOL.cx, spot.y - BRAZIER.flameY + BRAZIER.h - 1 - BRAZIER_POOL.cy, ensureBrazierPool(scene, 0))
              .setOrigin(0)
              .setDepth(BRAZIER_POOL_Z)
              .setBlendMode(Phaser.BlendModes.ADD)
              .setTint(BRAZIER_POOL_TINT),
          )
        : null;
    if (pool) for (let f = 1; f < BRAZIER_POOL.frames; f++) ensureBrazierPool(scene, f);
    return { img, glow, pool, period: spot.period, phase: spot.phase, lastFrame: 0, frameOf, wall };
  });

  let lights = true;

  const burst = (p: PlayerId, zone: number, color: number): void => {
    if (REDUCED_MOTION) return;
    const c = zoneXY(p, 'monster', zone);
    void lightFlash(scene, c.x, c.y, color, 34, 240, { floorY: c.y });
  };

  const debug = {
    levels: (): number[] => torches.map((t) => t.lastFrame + 1),
    pulse: (): void => {},
    floor: (): number => 0,
  };
  const neon = (globalThis as { __neon?: Record<string, unknown> }).__neon;
  if (neon) neon.ntLights = debug;

  return {
    name: 'lights',
    owner: 'C',
    setActivePlayer(_p) {},
    setLights(on, _animate) {
      lights = on;
      for (const t of torches) {
        t.img.setVisible(on);
        t.glow.setVisible(on);
        t.pool?.setVisible(on);
      }
      return Promise.resolve();
    },
    crowd(_kind: CrowdReaction, _side: PlayerId | null, _power: number) {},
    onGameEvent(ev: GameEvent, info?: NtEventInfo) {
      if (ev.type === 'attackDeclare') {
        const attr = info?.attackerAttribute ?? null;
        burst(ev.player, ev.attackerZone, attr ? attributeLightColor(attr as Attribute) : ev.player === 0 ? PAL.cyan3 : PAL.crim3);
      }
    },
    tick(_dt, t) {
      if (!REDUCED_MOTION) {
        for (const r of ribbons) {
          const f = (Math.floor((t + r.phase) / r.ms) + r.off) % r.frames.length;
          if (f !== r.last) {
            r.last = f;
            r.img.setTexture(r.frames[f]);
          }
          const nx = r.baseX + Math.round(Math.sin(((t + r.phase) / r.period) * Math.PI * 2) * r.ampX);
          if (nx !== r.lastX) {
            r.lastX = nx;
            r.img.setX(nx);
          }
        }
        for (const f of fogs) {
          const rad = ((t + f.phase) / f.period) * Math.PI * 2;
          const nx = f.baseX + Math.round(Math.sin(rad) * f.ampX);
          const ny = f.baseY + Math.round(Math.cos(rad) * f.ampY);
          if (nx !== f.lastX || ny !== f.lastY) {
            f.lastX = nx;
            f.lastY = ny;
            f.img.setPosition(nx, ny);
          }
        }
        if (lights) {
          for (const tr of torches) {
            const n = tr.wall ? 3 : BRAZIER.frames;
            const step = Math.floor((t + tr.phase) / (tr.period / n)) % n;
            if (step !== tr.lastFrame) {
              tr.lastFrame = step;
              tr.img.setTexture(tr.frameOf(step));
              // the glow flickers by swapping its dither level (no alpha: palette-crisp)
              tr.glow.setFrame(torchFrame.glow(step % 3));
              tr.pool?.setTexture(NT_BRAZIER_POOL_KEY(POOL_OF_FRAME[step % POOL_OF_FRAME.length]));
            }
          }
        }
      }
    },
    destroy() {
      const n = (globalThis as { __neon?: Record<string, unknown> }).__neon;
      if (n && n.ntLights === debug) delete n.ntLights;
    },
  };
}
