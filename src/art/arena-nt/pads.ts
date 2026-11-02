// Neon Tower painter: PADS (the duelists' corner pads) — owner A1 (docs/v3/ARENA_NEON_TOWER.md §2 / §3).
// Readability pass: calmer slate top, softer cyan (P1) / crimson (P2) border with less neon glow.
// Pure PixelCanvas code (no Phaser).

import { type Color, PixelCanvas } from '../pixel';
import { NT_PAL } from './palette';
import { type Atlas, packAtlas } from './platform-pack';

export const NT_PADS_KEY = 'nt:pads';

/**
 * Pad canvas: the rhombus + 1 px outline + its thickness; its rhombus centre is at (CX, CY) = the duelist's feet.
 * hedef-gorunum-3: the pad is the top of a 3-step dais (DAIS below), so the canvas is wider and taller.
 */
export const PAD_CANVAS = { w: 86, h: 52, cx: 43, cy: 15 } as const;

/** hedef-gorunum-3: the dais under the pad — 3 steps, each wider by STEP_W / STEP_H and RISE px tall. */
export const DAIS = { steps: 3, stepW: 6, stepH: 3, rise: 4 } as const;

/** Half width / height of the pad rhombus (a 40×20 diamond) and its raised rim thickness (px). */
export const PAD_HALF = { w: 20, h: 10, thick: 3 } as const;

export const padFrame = (player: 0 | 1, level: number): string => `pad:${player}:${level}`;

const N = NT_PAL.metal;
const G = NT_PAL.graphite;

/**
 * hedef-gorunum-3: the stepped dais, painted bottom step first. Each step is a diamond (hw × hh) whose top sits RISE px
 * above the next lower one: a lit top face (left), a riser with a 1-px player-colour light line, ink outline.
 */
function paintDais(p: PixelCanvas, player: 0 | 1, level: number): void {
  const { cx, cy } = PAD_CANVAS;
  const ramp = player === 0 ? NT_PAL.blue : NT_PAL.red;
  const line: Color = ramp[Math.min(3, 1 + level)];
  for (let s = DAIS.steps; s >= 1; s--) {
    const hw = PAD_HALF.w + s * DAIS.stepW;
    const hh = PAD_HALF.h + s * DAIS.stepH;
    const top = cy + s * DAIS.rise; // this step's top-diamond centre y
    // riser: the lower half of the diamond pushed down by RISE
    for (let j = 0; j < p.h; j++)
      for (let i = 0; i < p.w; i++) {
        const dx = Math.abs(i + 0.5 - cx) / hw;
        for (let d = 0; d < DAIS.rise; d++) {
          const dy = (j + 0.5 - (top + d)) / hh;
          if (dy >= 0 && dx + dy <= 1 && dx + dy > 1 - 1 / hh) {
            // the riser band: player-colour light line on its first row, dark faces below (left lit, right shaded)
            const left = i + 0.5 < cx;
            p.set(i, j, d === 1 ? line : d === 0 ? (left ? N[2] : N[1]) : left ? N[1] : N[0]);
          }
        }
      }
    // the step's top face
    for (let j = 0; j < p.h; j++)
      for (let i = 0; i < p.w; i++) {
        const k = Math.abs(i + 0.5 - cx) / hw + Math.abs(j + 0.5 - top) / hh;
        if (k > 1) continue;
        const rim = k > 1 - 1.2 / hh;
        p.set(i, j, rim ? (i + 0.5 < cx && j + 0.5 < top ? N[3] : N[1]) : j + 0.5 < top ? G[1] : G[0]);
      }
  }
}

function paintPad(player: 0 | 1, level: number): PixelCanvas {
  const { w, h, cx, cy } = PAD_CANVAS;
  const p = new PixelCanvas(w, h);
  paintDais(p, player, level);
  const ramp = player === 0 ? NT_PAL.blue : NT_PAL.red;
  const neon: Color = ramp[Math.min(3, 1 + (level >> 1) + 1)];
  const glow: Color = ramp[Math.min(2, 1 + (level >> 1))];
  const dvOf = (i: number, j: number): number => PAD_HALF.h - (Math.abs(i + 0.5 - cx) * (PAD_HALF.h / PAD_HALF.w) + Math.abs(j + 0.5 - cy));
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const dv = dvOf(i, j);
      if (dv >= 0) continue;
      if (j + 0.5 <= cy) continue;
      const depth = -dv;
      const T = PAD_HALF.thick;
      if (depth > T) continue;
      p.set(i, j, depth > T - 1 ? N[0] : i + 0.5 < cx ? (depth < 1 ? N[3] : depth < 2 ? N[2] : N[1]) : depth < 1 ? N[1] : N[0]);
    }
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const dv = dvOf(i, j);
      if (dv < 0) continue;
      let c: Color;
      if (dv < 1) c = i + 0.5 < cx ? (player === 0 ? N[4] : N[3]) : N[2];
      else if (dv < 2) c = neon;
      else if (dv < 3) c = glow;
      else {
        // Lighter slate podium top so the dark contact shadow under the duelist's feet contrasts clearly
        const dx = (i - cx) / 10.5;
        const dy = (j - cy) / 4.8;
        const r2 = dx * dx + dy * dy;
        c = r2 < 0.42 ? NT_PAL.ink : r2 < 0.92 ? N[0] : r2 < 1.35 ? G[0] : G[2];
      }
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
