// Neon Tower painter: holo — owner B2 (docs/v3/ARENA_NEON_TOWER.md §2 / §5 / §6 / §9).
// The static parts of the two hologram stations (the creature frames are baked later, in slices, by
// src/view/board-nt/holograms.ts from the monsters' own v3 idle frames with holo-bake.ts):
//   ring:<side>:<k>   the light ring on the plinth top (outer + inner ellipse, 1 px lines), 4 frames: a bright arc
//                     chases round the dim ellipse
//   pool:<side>       the plinth's lit top face: a sparse dither of the ramp's darkest tone
//   cone:<side>:<k>   the projector's light cone, a dither that thins out upward (2 phases, a slow shimmer)
//   hot:<side>        a bright ring used by the summon flare (rises up the creature)
//   mote:<side>:<k>   1-3 px digital motes
// Pure PixelCanvas code, no alpha.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { HOLO_LOOKS } from './holo-bake';
import { type NtAtlas, packAtlas } from './wall-kit';

/** Texture key of the static atlas; the creatures are `nt:holo:c0` / `nt:holo:c1`. */
export const NT_HOLO_KEY = 'nt:holo';
export const ntHoloCreatureKey = (side: 0 | 1): string => `nt:holo:c${side}`;

export const RING_W = 90;
export const RING_H = 17;
export const CONE_W = 70;
export const CONE_H = 56;
export const RING_FRAMES = 4;
export const CONE_FRAMES = 1;
export const MOTE_FRAMES = 3;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function paintRing(side: 0 | 1, k: number): PixelCanvas {
  const R = HOLO_LOOKS[side].ramp;
  const c = new PixelCanvas(RING_W, RING_H);
  const cx = RING_W / 2;
  const cy = (RING_H - 1) / 2;
  c.ellipseRing(cx, cy, 44, 8, R[1]);
  c.ellipseRing(cx, cy, 31, 5, R[0]);
  // the chasing arc: bright pixels of the outer ellipse within a window of angles
  const a0 = (k / RING_FRAMES) * Math.PI * 2 + side * 1.9;
  for (let i = 0; i < 48; i++) {
    const a = a0 + (i / 48) * 1.1;
    const x = Math.round(cx + Math.cos(a) * 44);
    const y = Math.round(cy + Math.sin(a) * 8);
    c.set(x, y, i > 30 ? R[4] : i > 12 ? R[3] : R[2]);
  }
  return c;
}

function paintPool(side: 0 | 1): PixelCanvas {
  const R = HOLO_LOOKS[side].ramp;
  const c = new PixelCanvas(RING_W, RING_H);
  const cx = RING_W / 2;
  const cy = (RING_H - 1) / 2;
  for (let y = 0; y < RING_H; y++)
    for (let x = 0; x < RING_W; x++) {
      const dx = (x - cx) / 40;
      const dy = (y - cy) / 7;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      // denser toward the rim
      const level = 2 + Math.floor(d * 5);
      if (BAYER[(y & 3) * 4 + (x & 3)] < level) c.set(x, y, R[0]);
    }
  return c;
}

function paintCone(side: 0 | 1, k: number): PixelCanvas {
  const R = HOLO_LOOKS[side].ramp;
  const c = new PixelCanvas(CONE_W, CONE_H);
  for (let y = 0; y < CONE_H; y++) {
    const u = y / (CONE_H - 1); // 0 top … 1 bottom
    const half = 20 + u * 15;
    const level = Math.round(u * 3);
    for (let x = 0; x < CONE_W; x++) {
      if (Math.abs(x - CONE_W / 2 + 0.5) > half) continue;
      if (BAYER[((y + k) & 3) * 4 + ((x + k * 2) & 3)] < level) c.set(x, y, R[0]);
    }
  }
  return c;
}

function paintHot(side: 0 | 1): PixelCanvas {
  const R = HOLO_LOOKS[side].ramp;
  const c = new PixelCanvas(RING_W, RING_H);
  c.ellipseRing(RING_W / 2, (RING_H - 1) / 2, 44, 8, R[4]);
  c.ellipseRing(RING_W / 2, (RING_H - 1) / 2, 43, 7, R[2]);
  return c;
}

function paintMote(side: 0 | 1, k: number): PixelCanvas {
  const R = HOLO_LOOKS[side].ramp;
  const c = new PixelCanvas(3, 2);
  if (k === 0) c.set(0, 0, R[3]);
  else if (k === 1) c.hline(0, 1, 0, R[4]);
  else (c.set(1, 0, R[5]), c.set(1, 1, R[3]));
  return c;
}

export const ringName = (side: 0 | 1, k: number): string => `ring:${side}:${k}`;
export const poolName = (side: 0 | 1): string => `pool:${side}`;
export const coneName = (side: 0 | 1, k: number): string => `cone:${side}:${k}`;
export const hotName = (side: 0 | 1): string => `hot:${side}`;
export const moteName = (side: 0 | 1, k: number): string => `mote:${side}:${k}`;

let cache: NtAtlas | null = null;
export function holoStaticBake(): NtAtlas {
  if (cache) return cache;
  const parts: [string, PixelCanvas][] = [];
  for (const side of [0, 1] as const) {
    for (let k = 0; k < RING_FRAMES; k++) parts.push([ringName(side, k), paintRing(side, k)]);
    for (let k = 0; k < CONE_FRAMES; k++) parts.push([coneName(side, k), paintCone(side, k)]);
    parts.push([poolName(side), paintPool(side)], [hotName(side), paintHot(side)]);
    for (let k = 0; k < MOTE_FRAMES; k++) parts.push([moteName(side, k), paintMote(side, k)]);
  }
  cache = packAtlas(parts, 200);
  return cache;
}

/** Skeleton-compatible painter (the boot step registers it). */
export function paintHolo(): PixelCanvas {
  return holoStaticBake().canvas;
}

export { PAL };
