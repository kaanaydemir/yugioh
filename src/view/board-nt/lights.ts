// Neon Tower layer: LIGHTS — owner C.
// Readability pass: replaces loud neon floor pools and edge strips with layered slowly drifting fog toward the edges
// and small warm flickering torch lights around the perimeter (matching docs/v3/ref/hedef-gorunum-2.png).

import type Phaser from 'phaser';
import {
  NT_LIGHTS_KEY,
  type LightsBake,
  bakeLights,
  lightFrame,
} from '../../art/arena-nt/lights';
import { PAL } from '../../art/palette';
import { attributeLightColor, lightFlash } from '../light';
import type { Attribute } from '../../data/cards';
import type { GameEvent, PlayerId } from '../../engine/types';
import { zoneXY } from '../layout';
import { REDUCED_MOTION } from '../v3/motion';
import type { CrowdReaction } from './api';
import { NT_DEPTH } from './layout-nt';
import { type NtCtx, type NtEventInfo, type NtLayer } from './layer';
import { ensureNtTexture } from './textures';

type Img = Phaser.GameObjects.Image;

let bakeCache: LightsBake | null = null;
function lightsBake(): LightsBake {
  return (bakeCache ??= bakeLights());
}

export function ensureLightsTextures(scene: Phaser.Scene): void {
  ensureNtTexture(scene, 'lights', NT_LIGHTS_KEY, () => lightsBake().canvas);
  const tex = scene.textures.get(NT_LIGHTS_KEY);
  for (const [name, r] of Object.entries(lightsBake().frames)) if (!tex.has(name)) tex.add(name, 0, r.x, r.y, r.w, r.h);
}

interface FogDrifter {
  img: Img;
  baseX: number;
  baseY: number;
  ampX: number;
  ampY: number;
  period: number;
  phase: number;
  frames: readonly [string, string];
  lastX: number;
  lastY: number;
  lastFrame: number;
}

interface TorchLight {
  img: Img;
  period: number;
  phase: number;
  lastFrame: number;
}

/** Perimeter positions for the small warm flickering torches (matching hedef-gorunum-2.png). */
const TORCH_SPOTS: readonly { x: number; y: number; depth: number; period: number; phase: number }[] = [
  // Upper-left & upper-right wall/stand perimeter
  { x: 58, y: 76, depth: NT_DEPTH.stands + 2.2, period: 420, phase: 0 },
  { x: 166, y: 96, depth: NT_DEPTH.stands + 2.2, period: 470, phase: 190 },
  { x: 474, y: 96, depth: NT_DEPTH.stands + 2.2, period: 450, phase: 310 },
  { x: 582, y: 76, depth: NT_DEPTH.stands + 2.2, period: 410, phase: 90 },
  // Mid/lower perimeter beside the hologram plinths and front stands
  { x: 66, y: 178, depth: NT_DEPTH.platform - 0.08, period: 390, phase: 140 },
  { x: 132, y: 234, depth: NT_DEPTH.platform - 0.08, period: 460, phase: 270 },
  { x: 508, y: 234, depth: NT_DEPTH.platform - 0.08, period: 440, phase: 60 },
  { x: 574, y: 178, depth: NT_DEPTH.platform - 0.08, period: 400, phase: 350 },
];

export function createLightsLayer(ctx: NtCtx): NtLayer {
  const scene = ctx.scene;
  ensureLightsTextures(scene);

  const fogs: FogDrifter[] = [];
  const addFog = (
    x: number,
    y: number,
    flipX: boolean,
    depth: number,
    ampX: number,
    ampY: number,
    period: number,
    phase: number,
    frames: readonly [string, string],
  ): void => {
    const img = ctx.add(
      scene.add
        .image(x, y, NT_LIGHTS_KEY, frames[0])
        .setOrigin(0)
        .setFlipX(flipX)
        .setDepth(depth),
    );
    fogs.push({ img, baseX: x, baseY: y, ampX, ampY, period, phase, frames, lastX: x, lastY: y, lastFrame: 0 });
  };

  // 1. Mid-ground fog banks over stands and hologram statues (above holo, below platform)
  addFog(-12, 38, false, NT_DEPTH.holo + 0.6, 5, 2, 9200, 0, [lightFrame.fogBack(0), lightFrame.fogBack(1)]);
  addFog(442, 38, true, NT_DEPTH.holo + 0.6, -5, 2, 9800, 2400, [lightFrame.fogBack(0), lightFrame.fogBack(1)]);

  // 2. Foreground edge fog banks over lower stands and apron floor around the platform
  addFog(-16, 178, false, NT_DEPTH.platform - 0.18, 6, 2, 10800, 1200, [lightFrame.fogFront(0), lightFrame.fogFront(1)]);
  addFog(406, 178, true, NT_DEPTH.platform - 0.18, -6, 2, 11400, 4100, [lightFrame.fogFront(0), lightFrame.fogFront(1)]);

  // 3. Drifting mist wisps that glide slowly across the edges and hologram bases
  addFog(8, 112, false, NT_DEPTH.holo + 0.8, 8, 3, 7600, 600, [lightFrame.fogWisp(0), lightFrame.fogWisp(1)]);
  addFog(482, 112, true, NT_DEPTH.holo + 0.8, -8, 3, 8100, 3100, [lightFrame.fogWisp(0), lightFrame.fogWisp(1)]);
  addFog(22, 224, false, NT_DEPTH.platform - 0.12, 7, 2, 8500, 1900, [lightFrame.fogWisp(1), lightFrame.fogWisp(0)]);
  addFog(468, 224, true, NT_DEPTH.platform - 0.12, -7, 2, 8900, 4700, [lightFrame.fogWisp(1), lightFrame.fogWisp(0)]);

  // 4. Warm flickering torches around the arena perimeter
  const torches: TorchLight[] = TORCH_SPOTS.map((spot) => {
    const img = ctx.add(
      scene.add
        .image(spot.x - 18, spot.y - 14, NT_LIGHTS_KEY, lightFrame.torch(0))
        .setOrigin(0)
        .setDepth(spot.depth),
    );
    return { img, period: spot.period, phase: spot.phase, lastFrame: 0 };
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
      for (const t of torches) t.img.setVisible(on);
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
          const nf = Math.sin(rad * 0.5) >= 0 ? 0 : 1;
          if (nx !== f.lastX || ny !== f.lastY) {
            f.lastX = nx;
            f.lastY = ny;
            f.img.setPosition(nx, ny);
          }
          if (nf !== f.lastFrame) {
            f.lastFrame = nf;
            f.img.setFrame(f.frames[nf]);
          }
        }
        if (lights) {
          for (const tr of torches) {
            const step = Math.floor((t + tr.phase) / (tr.period / 3)) % 3;
            if (step !== tr.lastFrame) {
              tr.lastFrame = step;
              tr.img.setFrame(lightFrame.torch(step));
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
