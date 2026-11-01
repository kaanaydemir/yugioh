// Neon Tower painter: holo — owner B2.
// Readability pass: dim, low-contrast hologram pedestals, rings, and cones that blend into the edge fog.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { HOLO_LOOKS } from './holo-bake';
import { type NtAtlas, packAtlas } from './wall-kit';

export const NT_HOLO_KEY = 'nt:holo';
export const ntHoloCreatureKey = (side: 0 | 1): string => `nt:holo:c${side}`;

export const PED = { rx: 54, ry: 12, side: 9, pad: 8 } as const;
export const PED_W = 2 * (PED.rx + PED.pad) + 2;
export const PED_AT = { x: PED.rx + PED.pad + 1, y: PED.ry + 5 } as const;
export const PED_H = PED_AT.y + PED.side + PED.ry + 6;
export const RING_W = 2 * PED.rx + 3;
export const RING_H = 2 * PED.ry + 3;
export const RING_FRAMES = 4;
export const CONE_W = 124;
export const CONE_H = 118;
export const CONE_FRAMES = 1;
export const MOTE_FRAMES = 4;
export const FLARE_FRAMES = 5;
export const FLARE_W = 2 * 66 + 3;
export const FLARE_H = 2 * 15 + 3;
export const BEAM_W = 30;
export const BEAM_H = 150;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const N = { ink: PAL.ink, n0: PAL.night0, n1: PAL.night1, n2: PAL.night2 } as const;

function arcY(cx: number, cy: number, rx: number, ry: number, x: number): number {
  const u = (x - cx) / rx;
  return ry * Math.sqrt(Math.max(0, 1 - u * u));
}

function paintPed(side: 0 | 1): PixelCanvas {
  const R = HOLO_LOOKS[side].ramp;
  const c = new PixelCanvas(PED_W, PED_H);
  const cx = PED_AT.x;
  const cy = PED_AT.y;
  const { rx, ry } = PED;
  const H = PED.side;
  for (let x = cx - rx; x <= cx + rx; x++) {
    const top = cy + Math.round(arcY(cx, cy, rx, ry, x));
    const bot = cy + H + Math.round(arcY(cx, cy, rx, ry, x));
    const u = (x - cx) / rx;
    const base = u < -0.3 ? N.n1 : N.n0;
    for (let y = top; y <= bot; y++) {
      const r = y - top;
      let col: number = base;
      if (r < 1) col = N.n1;
      else if (r === 4) col = R[1];
      if (y === bot) col = N.ink;
      c.set(x, y, col);
    }
  }
  for (const x of [cx - rx, cx + rx]) c.vline(x, cy, cy + H, N.ink);
  c.ellipse(cx, cy, rx + 1, ry + 1, N.ink);
  c.ellipse(cx, cy, rx, ry, N.n1);
  c.ellipse(cx, cy, rx - 2, ry - 1, N.n0);
  c.ellipse(cx, cy, rx - 5, ry - 2, N.ink);
  c.ellipse(cx, cy, 14, 3, R[0]);
  return c;
}

function paintRing(side: 0 | 1, k: number): PixelCanvas {
  const R = HOLO_LOOKS[side].ramp;
  const c = new PixelCanvas(RING_W, RING_H);
  const cx = (RING_W - 1) / 2;
  const cy = (RING_H - 1) / 2;
  c.ellipseRing(cx, cy, PED.rx - 5, PED.ry - 2, R[0]);
  const a0 = (k / RING_FRAMES) * Math.PI * 2 + side * 1.9;
  for (let i = 0; i < 40; i++) {
    const a = a0 + (i / 40) * 1.2;
    const x = Math.round(cx + Math.cos(a) * (PED.rx - 5));
    const y = Math.round(cy + Math.sin(a) * (PED.ry - 2));
    c.set(x, y, i > 28 ? R[2] : R[1]);
  }
  return c;
}

function paintCone(side: 0 | 1): PixelCanvas {
  const R = HOLO_LOOKS[side].ramp;
  const c = new PixelCanvas(CONE_W, CONE_H);
  for (let y = 0; y < CONE_H; y++) {
    const u = 1 - y / (CONE_H - 1);
    const half = 34 + (1 - u) * 20;
    const level = Math.round(u * 2);
    for (let x = 0; x < CONE_W; x++) {
      const dx = Math.abs(x - CONE_W / 2 + 0.5);
      if (dx > half) continue;
      if (((x >> 1) + (y >> 4)) % 3 === 0) continue;
      if (BAYER[(y & 3) * 4 + (x & 3)] < level) c.set(x, y, R[0]);
    }
  }
  return c;
}

const FLARE_RX = [14, 26, 38, 50, 62];
function paintFlare(side: 0 | 1, k: number): PixelCanvas {
  const R = HOLO_LOOKS[side].ramp;
  const c = new PixelCanvas(FLARE_W, FLARE_H);
  const cx = (FLARE_W - 1) / 2;
  const cy = (FLARE_H - 1) / 2;
  const rx = FLARE_RX[k];
  const ry = Math.max(3, Math.round(rx * 0.24));
  const tone = [4, 4, 3, 2, 1][k];
  c.ellipseRing(cx, cy, rx, ry, R[tone]);
  return c;
}

function paintBeam(side: 0 | 1): PixelCanvas {
  const R = HOLO_LOOKS[side].ramp;
  const c = new PixelCanvas(BEAM_W, BEAM_H);
  const cx = BEAM_W / 2;
  for (let y = 0; y < BEAM_H; y++) {
    const u = 1 - y / (BEAM_H - 1);
    const half = 2 + Math.round(u * 7);
    for (let x = 0; x < BEAM_W; x++) {
      const dx = Math.abs(x - cx + 0.5);
      if (dx > half) continue;
      const fade = Math.round(u * 10);
      if (BAYER[(y & 3) * 4 + (x & 3)] < fade) c.set(x, y, dx < 2 ? R[3] : R[1]);
    }
  }
  return c;
}

function paintHot(side: 0 | 1): PixelCanvas {
  const R = HOLO_LOOKS[side].ramp;
  const c = new PixelCanvas(RING_W, 22);
  c.ellipseRing(RING_W / 2, 10, PED.rx - 6, 9, R[3]);
  return c;
}

function paintMote(side: 0 | 1, _k: number): PixelCanvas {
  const R = HOLO_LOOKS[side].ramp;
  const c = new PixelCanvas(2, 2);
  c.set(0, 0, R[1]);
  return c;
}

export const pedName = (side: 0 | 1): string => `ped:${side}`;
export const ringName = (side: 0 | 1, k: number): string => `ring:${side}:${k}`;
export const coneName = (side: 0 | 1): string => `cone:${side}`;
export const flareName = (side: 0 | 1, k: number): string => `flare:${side}:${k}`;
export const beamName = (side: 0 | 1): string => `beam:${side}`;
export const hotName = (side: 0 | 1): string => `hot:${side}`;
export const moteName = (side: 0 | 1, k: number): string => `mote:${side}:${k}`;

let cache: NtAtlas | null = null;
export function holoStaticBake(): NtAtlas {
  if (cache) return cache;
  const parts: [string, PixelCanvas][] = [];
  for (const side of [0, 1] as const) {
    parts.push([pedName(side), paintPed(side)]);
    for (let k = 0; k < RING_FRAMES; k++) parts.push([ringName(side, k), paintRing(side, k)]);
    parts.push([coneName(side), paintCone(side)]);
    for (let k = 0; k < FLARE_FRAMES; k++) parts.push([flareName(side, k), paintFlare(side, k)]);
    parts.push([beamName(side), paintBeam(side)], [hotName(side), paintHot(side)]);
    for (let k = 0; k < MOTE_FRAMES; k++) parts.push([moteName(side, k), paintMote(side, k)]);
  }
  cache = packAtlas(parts, 512);
  return cache;
}

export function paintHolo(): PixelCanvas {
  return holoStaticBake().canvas;
}

export { PAL };
