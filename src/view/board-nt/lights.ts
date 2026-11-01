// Neon Tower layer: LIGHTS — owner C.
// Readability pass: layered slowly drifting billowy fog toward the edges & hologram statues,
// plus sculpted warm flickering torches with soft radial amber glow halos (matching docs/v3/ref/hedef-gorunum-2.png).

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
    g.addColorStop(0, `rgba(92, 118, 164, ${l.a0})`);
    g.addColorStop(0.45, `rgba(58, 78, 118, ${l.a1})`);
    g.addColorStop(0.78, `rgba(28, 40, 68, ${(l.a1 * 0.48).toFixed(3)})`);
    g.addColorStop(1, 'rgba(12, 18, 34, 0)');
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

  if (!scene.textures.exists(FOG_BANK_KEY)) {
    const ct = scene.textures.createCanvas(FOG_BANK_KEY, 280, 150);
    if (ct) {
      paintMultiLobeFog(ct.getContext(), 280, 150, [
        { cx: 92, cy: 78, rx: 90, ry: 52, a0: 0.52, a1: 0.28 },
        { cx: 168, cy: 70, rx: 98, ry: 56, a0: 0.48, a1: 0.26 },
        { cx: 132, cy: 94, rx: 106, ry: 48, a0: 0.44, a1: 0.22 },
        { cx: 58, cy: 92, rx: 60, ry: 38, a0: 0.38, a1: 0.18 },
        { cx: 212, cy: 88, rx: 64, ry: 40, a0: 0.36, a1: 0.18 },
      ]);
      ct.refresh();
    }
  }

  if (!scene.textures.exists(FOG_WISP_KEY)) {
    const ct = scene.textures.createCanvas(FOG_WISP_KEY, 220, 114);
    if (ct) {
      paintMultiLobeFog(ct.getContext(), 220, 114, [
        { cx: 78, cy: 58, rx: 72, ry: 38, a0: 0.48, a1: 0.24 },
        { cx: 142, cy: 52, rx: 76, ry: 40, a0: 0.44, a1: 0.22 },
        { cx: 110, cy: 68, rx: 82, ry: 34, a0: 0.38, a1: 0.18 },
      ]);
      ct.refresh();
    }
  }

  if (!scene.textures.exists(TORCH_GLOW_KEY)) {
    const ct = scene.textures.createCanvas(TORCH_GLOW_KEY, 88, 72);
    if (ct) {
      const ctx = ct.getContext();
      ctx.clearRect(0, 0, 88, 72);
      ctx.save();
      ctx.translate(44, 34);
      ctx.scale(1, 0.82);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 42);
      g.addColorStop(0, 'rgba(255, 206, 112, 0.56)');
      g.addColorStop(0.28, 'rgba(246, 144, 52, 0.32)');
      g.addColorStop(0.64, 'rgba(192, 72, 24, 0.12)');
      g.addColorStop(1, 'rgba(120, 32, 12, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ct.refresh();
    }
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
}

/**
 * Torch positions matching docs/v3/ref/hedef-gorunum-2.png:
 * - Upper-left pillar sconce (115, 52) between left dragon statue and P1 screen
 * - Back-wall sconces flanking the top emblem (254, 46) and (384, 46)
 * - Right wall sconce below P2 screen (508, 82)
 * - Lower-left and lower-right platform apron braziers (148, 282) and (554, 242)
 */
const TORCH_SPOTS: readonly { x: number; y: number; depth: number; period: number; phase: number }[] = [
  { x: 115, y: 52, depth: NT_DEPTH.wallLights + 0.5, period: 420, phase: 0 },
  { x: 254, y: 46, depth: NT_DEPTH.wallLights + 0.5, period: 460, phase: 140 },
  { x: 384, y: 46, depth: NT_DEPTH.wallLights + 0.5, period: 440, phase: 290 },
  { x: 508, y: 82, depth: NT_DEPTH.wallLights + 0.5, period: 410, phase: 80 },
  { x: 148, y: 282, depth: NT_DEPTH.platform + 1.5, period: 390, phase: 210 },
  { x: 554, y: 242, depth: NT_DEPTH.platform + 1.5, period: 450, phase: 340 },
];

export function createLightsLayer(ctx: NtCtx): NtLayer {
  const scene = ctx.scene;
  ensureLightsTextures(scene);

  const fogs: FogDrifter[] = [];
  const addFog = (
    key: string,
    x: number,
    y: number,
    flipX: boolean,
    depth: number,
    alpha: number,
    ampX: number,
    ampY: number,
    period: number,
    phase: number,
  ): void => {
    const img = ctx.add(
      scene.add
        .image(x, y, key)
        .setOrigin(0)
        .setFlipX(flipX)
        .setAlpha(alpha)
        .setDepth(depth),
    );
    fogs.push({ img, baseX: x, baseY: y, ampX, ampY, period, phase, lastX: x, lastY: y });
  };

  // 1. Mid-ground billowy fog enveloping the hologram statues and stands
  addFog(FOG_BANK_KEY, -46, 36, false, NT_DEPTH.holo + 0.6, 0.90, 6, 2, 9200, 0);
  addFog(FOG_BANK_KEY, 406, 40, true, NT_DEPTH.holo + 0.6, 0.90, -6, 2, 9800, 2400);

  // 2. Lower hologram base & mid-stand mist clouds
  addFog(FOG_WISP_KEY, -18, 102, false, NT_DEPTH.holo + 0.75, 0.88, 8, 3, 7800, 900);
  addFog(FOG_WISP_KEY, 438, 106, true, NT_DEPTH.holo + 0.75, 0.88, -8, 3, 8300, 3200);

  // 3. Foreground edge fog banks drifting across lower corners and apron around the platform
  addFog(FOG_BANK_KEY, -48, 160, false, NT_DEPTH.platform - 0.18, 0.96, 7, 2, 10600, 1500);
  addFog(FOG_BANK_KEY, 408, 160, true, NT_DEPTH.platform - 0.18, 0.96, -7, 2, 11200, 4100);

  // 4. Lower corner mist wisps hugging the bottom edges around the platform
  addFog(FOG_WISP_KEY, 0, 204, false, NT_DEPTH.platform - 0.12, 0.88, 7, 2, 8600, 2100);
  addFog(FOG_WISP_KEY, 420, 204, true, NT_DEPTH.platform - 0.12, 0.88, -7, 2, 9000, 4900);

  // 5. Sculpted warm flickering torches + smooth radial amber glow halos
  const torches: TorchLight[] = TORCH_SPOTS.map((spot) => {
    const glow = ctx.add(
      scene.add
        .image(spot.x - 44, spot.y - 34, TORCH_GLOW_KEY)
        .setOrigin(0)
        .setDepth(spot.depth - 0.05),
    );
    const img = ctx.add(
      scene.add
        .image(spot.x - 9, spot.y - 12, NT_LIGHTS_KEY, lightFrame.torch(0))
        .setOrigin(0)
        .setDepth(spot.depth),
    );
    return { img, glow, period: spot.period, phase: spot.phase, lastFrame: 0 };
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
              tr.img.setFrame(lightFrame.torch(step));
              tr.glow.setAlpha(step === 0 ? 0.92 : step === 1 ? 1.0 : 0.85);
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
