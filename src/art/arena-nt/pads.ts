// Neon Tower painter: PADS (the duelists' corner pads) — owner A1 (docs/v3/ARENA_NEON_TOWER.md §2 / §3).
// Readability pass: calmer slate top, softer cyan (P1) / crimson (P2) border with less neon glow.
// Pure PixelCanvas code (no Phaser).

import { type Color, PixelCanvas } from '../pixel';
import { NT_PAL } from './palette';
import { type Atlas, packAtlas } from './platform-pack';

export const NT_PADS_KEY = 'nt:pads';

/** Pad canvas: the rhombus + 1 px outline + its thickness; its rhombus centre is at (CX, CY). Kept at 58×35 so the layer's placement is unchanged. */
export const PAD_CANVAS = { w: 58, h: 35, cx: 29, cy: 15 } as const;

/** Half width / height of the pad rhombus (a 40×20 diamond) and its raised rim thickness (px). */
export const PAD_HALF = { w: 20, h: 10, thick: 3 } as const;

export const padFrame = (player: 0 | 1, level: number): string => `pad:${player}:${level}`;

const N = NT_PAL.metal;
const G = NT_PAL.graphite;

function paintPad(player: 0 | 1, level: number): PixelCanvas {
  const { w, h, cx, cy } = PAD_CANVAS;
  const p = new PixelCanvas(w, h);
  const ramp = player === 0 ? NT_PAL.blue : NT_PAL.red;
  const neon: Color = ramp[Math.min(2, 1 + (level >> 1))];
  const glow: Color = N[0];
  const dvOf = (i: number, j: number): number => PAD_HALF.h - (Math.abs(i + 0.5 - cx) * (PAD_HALF.h / PAD_HALF.w) + Math.abs(j + 0.5 - cy));
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const dv = dvOf(i, j);
      if (dv >= 0) continue;
      if (j + 0.5 <= cy) continue;
      const depth = -dv;
      const T = PAD_HALF.thick;
      if (depth > T) continue;
      p.set(i, j, depth > T - 1 ? N[0] : i + 0.5 < cx ? (depth < 1 ? N[2] : depth < 2 ? N[1] : N[0]) : depth < 1 ? N[1] : N[0]);
    }
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const dv = dvOf(i, j);
      if (dv < 0) continue;
      let c: Color;
      if (dv < 1) c = i + 0.5 < cx ? N[2] : N[1];
      else if (dv < 2) c = neon;
      else if (dv < 3) c = glow;
      else c = G[1];
      p.set(i, j, c);
    }
  }
  p.outline(NT_PAL.ink);
  return p;
}

export interface PadsArt {
  atlas: Atlas;
  ms: number;
}

let cached: PadsArt | null = null;

export function buildPadsArt(): PadsArt {
  if (cached) return cached;
  const t0 = performance.now();
  const list: [string, PixelCanvas][] = [];
  for (const player of [0, 1] as const) for (let level = 0; level < 4; level++) list.push([padFrame(player, level), paintPad(player, level)]);
  cached = { atlas: packAtlas(list, 256), ms: Math.round((performance.now() - t0) * 10) / 10 };
  return cached;
}

/** Skeleton-compatible painter: the pads atlas canvas. */
export function paintPads(): PixelCanvas {
  return buildPadsArt().atlas.canvas;
}
