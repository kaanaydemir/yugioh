// Neon Tower painter: PADS (the duelists' corner pads) — owner A1 (docs/v3/ARENA_NEON_TOWER.md §2 / §3).
// A small raised pad on each duelist's bump of the plate: a 56×28 rhombus (layout-nt DUELIST_PADS; the
// duelist's feet = its centre), 5 px thick, lit slate top, a glowing border in the owner's colour (cyan P1 /
// crimson P2) at 4 brightness levels (the layer breathes between them) and a dark glow ring just inside it. The border is the only bright thing on it. Pure PixelCanvas code (no Phaser).

import { type Color, PixelCanvas } from '../pixel';
import { NT_PAL } from './palette';
import { type Atlas, packAtlas } from './platform-pack';

export const NT_PADS_KEY = 'nt:pads';

/** Pad canvas: the 56×28 rhombus + 1 px outline + 3 px of thickness; its rhombus centre is at (CX, CY). */
export const PAD_CANVAS = { w: 58, h: 35, cx: 29, cy: 15 } as const;

export const padFrame = (player: 0 | 1, level: number): string => `pad:${player}:${level}`;

const N = NT_PAL.metal;
const G = NT_PAL.graphite;

function paintPad(player: 0 | 1, level: number): PixelCanvas {
  const { w, h, cx, cy } = PAD_CANVAS;
  const p = new PixelCanvas(w, h);
  const ramp = player === 0 ? NT_PAL.blue : NT_PAL.red;
  const neon: Color = ramp[Math.min(4, level + 1)];
  const glow: Color = ramp[0];
  // dv: vertical px inside the rhombus edge (half-width 28, half-height 14)
  const dvOf = (i: number, j: number): number => 14 - (Math.abs(i + 0.5 - cx) / 2 + Math.abs(j + 0.5 - cy));
  // thickness: the lower edges' face, 3 px (left lit, right shaded), then the ink outline
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const dv = dvOf(i, j);
      if (dv >= 0) continue;
      // below the rhombus' lower edges only
      if (j + 0.5 <= cy) continue;
      const depth = -dv; // px under the lower edge (vertical)
      if (depth > 5) continue;
      // a 5-px raised rim: a lit lip, two armour tones, a dark foot (left faces lit, right faces shaded)
      p.set(i, j, depth > 4 ? NT_PAL.ink : depth > 3 ? N[0] : i + 0.5 < cx ? (depth < 1 ? N[4] : depth < 3 ? N[3] : N[2]) : depth < 1 ? N[3] : depth < 3 ? N[2] : N[1]);
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
      if ((dv >= 1 && dv < 3 && ((ax > 22 && ay < 4) || (ay > 10 && ax < 7))) && dv < 2) c = ramp[Math.min(4, level + 2)];
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
