// Neon Tower painter: PADS (the duelists' corner pads) — owner A1 (docs/v3/ARENA_NEON_TOWER.md §2 / §3).
// A small raised pad standing ON the plate's top at each duelist's feet (the plate outline has no bump for it): a 40×20
// rhombus (PAD_HALF; layout-nt DUELIST_PADS is its canvas cell, the duelist's feet = its centre), 3 px thick, lit slate top,
// a glowing border in the owner's colour (cyan P1 / crimson P2) at 4 brightness levels (the layer breathes between them) and
// a dark glow ring just inside it. The border is the only bright thing on it. Pure PixelCanvas code (no Phaser).

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
  const neon: Color = ramp[Math.min(4, level + 2)];
  const glow: Color = ramp[1];
  // dv: vertical px inside the rhombus edge
  const dvOf = (i: number, j: number): number => PAD_HALF.h - (Math.abs(i + 0.5 - cx) * (PAD_HALF.h / PAD_HALF.w) + Math.abs(j + 0.5 - cy));
  // thickness: the lower edges' face (left lit, right shaded), then the ink outline
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const dv = dvOf(i, j);
      if (dv >= 0) continue;
      // below the rhombus' lower edges only
      if (j + 0.5 <= cy) continue;
      const depth = -dv; // px under the lower edge (vertical)
      const T = PAD_HALF.thick;
      if (depth > T) continue;
      // a raised rim: a lit lip, an armour tone, a dark foot (left faces lit, right faces shaded)
      p.set(i, j, depth > T - 1 ? N[0] : i + 0.5 < cx ? (depth < 1 ? N[4] : depth < 2 ? N[3] : N[2]) : depth < 1 ? N[3] : depth < 2 ? N[2] : N[1]);
    }
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const dv = dvOf(i, j);
      if (dv < 0) continue;
      let c: Color;
      if (dv < 1) c = i + 0.5 < cx ? N[4] : N[3];
      else if (dv < 2) c = neon;
      else if (dv < 3) c = glow;
      else c = G[2];
      // four corner brackets: the border's colour one step up at the rhombus' vertices
      const ax = Math.abs(i + 0.5 - cx);
      const ay = Math.abs(j + 0.5 - cy);
      if ((dv >= 1 && dv < 3 && ((ax > PAD_HALF.w - 5 && ay < 3) || (ay > PAD_HALF.h - 3 && ax < 6))) && dv < 2) c = ramp[Math.min(4, level + 2)];
      p.set(i, j, c);
    }
  }
  // the outline: ink around everything
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
