// Neon Tower layer: LIGHTS — owner C.
// Readability pass: layered slowly drifting billowy fog toward the edges & hologram statues,
// plus sculpted warm flickering torches with soft radial amber glow halos (matching docs/v3/ref/hedef-gorunum-2.png).

import type Phaser from 'phaser';
import {
  NT_LIGHTS_KEY,
  type LightsBake,
  TORCH_GLOW,
  TORCH_MOUNT,
  bakeLights,
  lightFrame,
  torchFrame,
} from '../../art/arena-nt/lights';
import { PAL } from '../../art/palette';
import { attributeLightColor, lightFlash } from '../light';
import type { Attribute } from '../../data/cards';
import type { GameEvent, PlayerId } from '../../engine/types';
import { zoneXY } from '../layout';
import { REDUCED_MOTION } from '../v3/motion';
import type { CrowdReaction } from './api';
import { NT_DEPTH } from './layout-nt';
import { NT_WALL_HALO_KEY, WALL_HALO, ensureBackHallTextures } from './backhall';
import { type NtCtx, type NtEventInfo, type NtLayer } from './layer';
import { ensureNtTexture } from './textures';

type Img = Phaser.GameObjects.Image;

const FOG_BANK_KEY = 'nt:fog:bank-v3';
const FOG_WISP_KEY = 'nt:fog:wisp-v3';
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
  glowOf: (f: number) => [string, string | undefined];
}

/**
 * hedef-gorunum-3: every torch is mounted — `x, y` is the FLAME centre.
 * - 'sconce': iron brackets on the back wall's pillars (beside the tower and outside the screens);
 * - 'post': braziers on stone posts standing on the hall floor (left / right of the stage, clear of the HUD).
 */
const TORCH_SPOTS: readonly { kind: 'sconce' | 'post'; x: number; y: number; depth: number; period: number; phase: number }[] = [
  // one sconce on the front face of each hall pillar (./backhall.ts HALL_PILLARS: x + 11, under the banner)
  { kind: 'sconce', x: 133, y: 82, depth: NT_DEPTH.wallLights + 0.5, period: 420, phase: 0 },
  { kind: 'sconce', x: 255, y: 88, depth: NT_DEPTH.wallLights + 0.5, period: 460, phase: 140 },
  { kind: 'sconce', x: 385, y: 88, depth: NT_DEPTH.wallLights + 0.5, period: 440, phase: 290 },
  { kind: 'sconce', x: 507, y: 104, depth: NT_DEPTH.wallLights + 0.5, period: 410, phase: 80 },
  { kind: 'post', x: 82, y: 212, depth: NT_DEPTH.platform + 1.5, period: 390, phase: 210 },
  { kind: 'post', x: 566, y: 222, depth: NT_DEPTH.platform + 1.5, period: 450, phase: 340 },
];

export function createLightsLayer(ctx: NtCtx): NtLayer {
  const scene = ctx.scene;
  ensureLightsTextures(scene);

  const fogs: FogDrifter[] = [];
  // hedef-gorunum-3 + pixel rules: the fog is the baked ordered-dither fog of the lights atlas (palette only, opaque
  // pixels, no alpha); it lies LOW (hall floor, the stage's foot, the hologram plinths) in layers that drift slowly.
  const addFog = (frame: string, x: number, y: number, flipX: boolean, depth: number, ampX: number, ampY: number, period: number, phase: number): void => {
    const img = ctx.add(scene.add.image(x, y, NT_LIGHTS_KEY, frame).setOrigin(0).setFlipX(flipX).setDepth(depth));
    fogs.push({ img, baseX: x, baseY: y, ampX, ampY, period, phase, lastX: x, lastY: y });
  };
  void FOG_BANK_KEY;
  void FOG_WISP_KEY;

  // 1. back layer: around the hologram plinths (behind the stage)
  addFog(lightFrame.fogBack(0), -60, 96, false, NT_DEPTH.holo + 0.6, 6, 2, 9200, 0);
  addFog(lightFrame.fogBack(1), 490, 106, true, NT_DEPTH.holo + 0.6, -6, 2, 9800, 2400);
  // 2. mid layer: low banks on the hall floor beside the stage
  addFog(lightFrame.fogFront(0), -70, 210, false, NT_DEPTH.platform - 0.18, 7, 2, 10600, 1500);
  addFog(lightFrame.fogFront(1), 460, 214, true, NT_DEPTH.platform - 0.18, -7, 2, 11200, 4100);
  // 3. thin wisps gliding over the low banks
  addFog(lightFrame.fogWisp(0), 6, 252, false, NT_DEPTH.platform - 0.12, 10, 2, 8600, 2100);
  addFog(lightFrame.fogWisp(1), 486, 246, true, NT_DEPTH.platform - 0.12, -10, 2, 9000, 4900);
  // h4-2 (owner loves the fog): three LOW BANDS (lights atlas fogBand) drifting slowly, in alternate directions, along the
  // floor and the screen edges. They lie behind the stage (they never cover the board's tiles) and hug the bottom / the
  // hologram plinths; the near band runs under the stage's foot so the wall rises out of it.
  addFog(lightFrame.fogBand(0), -40, 118, false, NT_DEPTH.holo + 0.8, 16, 2, 14000, 0);
  addFog(lightFrame.fogBand(1), 360, 132, true, NT_DEPTH.holo + 0.8, -16, 2, 15500, 3800);
  addFog(lightFrame.fogBand(2), -60, 278, false, NT_DEPTH.platform - 0.1, 22, 2, 17000, 1200);
  addFog(lightFrame.fogBand(0), 380, 282, true, NT_DEPTH.platform - 0.1, -22, 2, 16200, 7400);
  addFog(lightFrame.fogBand(1), 150, 306, false, NT_DEPTH.platform - 0.1, 18, 1, 18800, 5100);

  // 4. mounted torches (wall sconces / post braziers) with an ordered-dither warm glow behind them
  ensureBackHallTextures(scene);
  const torches: TorchLight[] = TORCH_SPOTS.map((spot) => {
    void TORCH_GLOW_KEY;
    // sconces: a small warm halo on the wall around the flame; post braziers: the bigger dithered glow (+ a floor pool, below)
    const glow =
      spot.kind === 'sconce'
        ? ctx.add(scene.add.image(spot.x - WALL_HALO.cx, spot.y - WALL_HALO.cy, NT_WALL_HALO_KEY(0)).setOrigin(0).setDepth(spot.depth - 0.05))
        : ctx.add(scene.add.image(spot.x - TORCH_GLOW.cx, spot.y - TORCH_GLOW.cy, NT_LIGHTS_KEY, torchFrame.glow(0)).setOrigin(0).setDepth(spot.depth - 0.05));
    const frameOf = (f: number): string => (spot.kind === 'sconce' ? torchFrame.sconce(f) : torchFrame.post(f));
    const img = ctx.add(
      scene.add
        .image(spot.x - TORCH_MOUNT.cx, spot.y - TORCH_MOUNT.flameY, NT_LIGHTS_KEY, frameOf(0))
        .setOrigin(0)
        .setDepth(spot.depth),
    );
    const glowOf = (f: number): [string, string | undefined] => (spot.kind === 'sconce' ? [NT_WALL_HALO_KEY(f), undefined] : [NT_LIGHTS_KEY, torchFrame.glow(f)]);
    return { img, glow, period: spot.period, phase: spot.phase, lastFrame: 0, frameOf, glowOf };
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
            const step = Math.floor((t + tr.phase) / (tr.period / 3)) % 3;
            if (step !== tr.lastFrame) {
              tr.lastFrame = step;
              tr.img.setFrame(tr.frameOf(step));
              // the glow flickers by swapping its dither level (no alpha: palette-crisp)
              const [gk, gf] = tr.glowOf(step);
              tr.glow.setTexture(gk, gf);
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
