// Neon Tower painter: holo — owner B2 (docs/v3/ARENA_NEON_TOWER.md §2 / §5 / §6 / §9; J3: a real round pedestal, a light cone,
// a strong summon flare). The static parts of the two hologram stations (the creature frames are baked later, in slices, by
// src/view/board-nt/holograms.ts from the monsters' own v3 idle frames with holo-bake.ts):
//   ped:<side>        the round pedestal: a stippled glow on the floor round it, a cylinder side (lit left, shade right,
//                     a neon band, plate seams), the top face (dark graphite, a 2-px lit rim, a dithered light pool)
//   ring:<side>:<k>   the light ring on the pedestal top (dim ellipse + a bright arc chasing round it), 4 frames
//   cone:<side>       the projector's light cone: a vertical-streak dither that thins out upward
//   flare:<side>:<k>  the summon flare's expanding floor ring (5 frames, white → ramp)
//   beam:<side>       the summon flare's upward light beam (a bright core, ramp sides, a stipple edge)
//   hot:<side>        a bright ring that climbs the creature during the flare
//   mote:<side>:<k>   1-3 px digital motes
// Pure PixelCanvas code, no alpha.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { HOLO_LOOKS } from './holo-bake';
import { type NtAtlas, packAtlas } from './wall-kit';

/** Texture key of the static atlas; the creatures are `nt:holo:c0` / `nt:holo:c1`. */
export const NT_HOLO_KEY = 'nt:holo';
export const ntHoloCreatureKey = (side: 0 | 1): string => `nt:holo:c${side}`;

/** The pedestal: top-ellipse radii, height of the cylinder side, the margin of the floor glow. */
export const PED = { rx: 54, ry: 12, side: 9, pad: 8 } as const;
/** The pedestal image (origin = the centre of the top ellipse at PED_AT). */
export const PED_W = 2 * (PED.rx + PED.pad) + 2;
export const PED_AT = { x: PED.rx + PED.pad + 1, y: PED.ry + 5 } as const;
export const PED_H = PED_AT.y + PED.side + PED.ry + 6;
/** The ring overlay (the top ellipse's inner ring, 4 chase frames). */
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

const N = { ink: PAL.ink, n0: PAL.night0, n1: PAL.night1, n2: PAL.night2, n3: PAL.night3, n4: PAL.night4, steel: PAL.steel } as const;

/** Ellipse arc y (top / bottom) of column x for an ellipse at (cx, cy) with radii (rx, ry). */
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
  // ---- the glow on the floor round the pedestal: a sparse stipple of the ramp's darkest tone, thinning outward
  for (let y = 0; y < PED_H; y++)
    for (let x = 0; x < PED_W; x++) {
      const dx = (x - cx) / (rx + PED.pad);
      const dy = (y - (cy + H / 2 + 2)) / (ry + H / 2 + 5);
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      const level = d < 0.55 ? 5 : d < 0.8 ? 3 : 1;
      if (BAYER[(y & 3) * 4 + (x & 3)] < level) c.set(x, y, R[0]);
    }
  // ---- the cylinder side, column by column between the top ellipse's lower arc and the bottom ellipse's lower arc
  for (let x = cx - rx; x <= cx + rx; x++) {
    const top = cy + Math.round(arcY(cx, cy, rx, ry, x));
    const bot = cy + H + Math.round(arcY(cx, cy, rx, ry, x));
    const u = (x - cx) / rx;
    // shading: lit left, mid, shade right
    const base = u < -0.55 ? N.n3 : u < -0.1 ? N.n2 : u < 0.5 ? N.n1 : N.n0;
    for (let y = top; y <= bot; y++) {
      const r = y - top;
      let col: number = base;
      if (r < 2) col = u < 0 ? N.n4 : N.n3;
      else if (r === 4) col = u < 0.4 ? R[3] : R[2]; // the neon band
      else if (r === 5) col = R[1];
      else if (r > 5 && (x - cx + 80) % 14 === 0) col = N.n0; // plate seams
      if (y === bot) col = N.ink;
      c.set(x, y, col);
    }
  }
  // the end columns' outline
  for (const x of [cx - rx, cx + rx]) c.vline(x, cy, cy + H, N.ink);
  // ---- the top face: ink outline, a 2-px lit rim (brighter on the left), dark graphite, a dithered light pool
  c.ellipse(cx, cy, rx + 1, ry + 1, N.ink);
  c.ellipse(cx, cy, rx, ry, N.n3);
  c.ellipse(cx, cy, rx - 2, ry - 1, N.n1);
  c.ellipse(cx, cy, rx - 4, ry - 2, N.n0);
  // the lit part of the rim: the upper-left half one tone up
  for (let a = Math.PI * 0.55; a < Math.PI * 1.45; a += 0.012) c.set(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), N.n4);
  // the pool: dither rings of the ramp inside the dark face
  for (let y = 0; y < PED_H; y++)
    for (let x = 0; x < PED_W; x++) {
      const dx = (x - cx) / (rx - 8);
      const dy = (y - cy) / (ry - 3);
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      const level = Math.round((1 - d) * 11);
      if (BAYER[(y & 3) * 4 + (x & 3)] < level) c.set(x, y, d < 0.35 ? R[2] : R[1]);
    }
  // the lit spot under the creature's feet
  c.ellipse(cx, cy, 16, 3, R[1]);
  c.ellipse(cx, cy, 10, 2, R[2]);
  return c;
}

function paintRing(side: 0 | 1, k: number): PixelCanvas {
  const R = HOLO_LOOKS[side].ramp;
  const c = new PixelCanvas(RING_W, RING_H);
  const cx = (RING_W - 1) / 2;
  const cy = (RING_H - 1) / 2;
  // the dim rings: the rim of the lit face and an inner ring
  c.ellipseRing(cx, cy, PED.rx - 5, PED.ry - 2, R[1]);
  c.ellipseRing(cx, cy, PED.rx - 17, PED.ry - 5, R[0]);
  // the chasing arc: bright pixels of the outer ring within a window of angles, tail → head
  const a0 = (k / RING_FRAMES) * Math.PI * 2 + side * 1.9;
  for (let i = 0; i < 80; i++) {
    const a = a0 + (i / 80) * 1.7;
    const x = Math.round(cx + Math.cos(a) * (PED.rx - 5));
    const y = Math.round(cy + Math.sin(a) * (PED.ry - 2));
    c.set(x, y, i > 66 ? R[5] : i > 50 ? R[4] : i > 28 ? R[3] : R[2]);
  }
  // four small light nodes on the inner ring (they step round with the arc)
  for (let n = 0; n < 4; n++) {
    const a = a0 + (n * Math.PI) / 2 + 0.8;
    c.set(Math.round(cx + Math.cos(a) * (PED.rx - 17)), Math.round(cy + Math.sin(a) * (PED.ry - 5)), R[4]);
  }
  return c;
}

function paintCone(side: 0 | 1): PixelCanvas {
  const R = HOLO_LOOKS[side].ramp;
  const c = new PixelCanvas(CONE_W, CONE_H);
  for (let y = 0; y < CONE_H; y++) {
    const u = 1 - y / (CONE_H - 1); // 1 at the pedestal (bottom) … 0 at the top
    const half = 36 + (1 - u) * 24;
    const level = Math.round(u * 5);
    for (let x = 0; x < CONE_W; x++) {
      const dx = Math.abs(x - CONE_W / 2 + 0.5);
      if (dx > half) continue;
      // vertical streaks: some 2-px columns stay dark
      if (((x >> 1) + (y >> 4)) % 3 === 0) continue;
      if (BAYER[(y & 3) * 4 + (x & 3)] < level) c.set(x, y, R[0]);
      // the cone's two edges: a sparse 1-px line
      if (dx > half - 1 && (y + (x & 1)) % 3 === 0) c.set(x, y, u > 0.3 ? R[1] : R[0]);
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
  const tone = [5, 5, 4, 3, 2][k];
  c.ellipseRing(cx, cy, rx, ry, R[tone]);
  if (k < 4) c.ellipseRing(cx, cy, rx - 1, ry - 1, R[Math.max(2, tone - 1)]);
  if (k > 0) c.ellipseRing(cx, cy, Math.round(rx * 0.7), Math.max(2, Math.round(ry * 0.7)), R[Math.max(1, tone - 2)]);
  return c;
}

function paintBeam(side: 0 | 1): PixelCanvas {
  const R = HOLO_LOOKS[side].ramp;
  const c = new PixelCanvas(BEAM_W, BEAM_H);
  const cx = BEAM_W / 2;
  for (let y = 0; y < BEAM_H; y++) {
    const u = 1 - y / (BEAM_H - 1); // 1 at the base … 0 at the top
    // the beam narrows a little as it climbs and thins out into a stipple
    const half = 3 + Math.round(u * 9);
    for (let x = 0; x < BEAM_W; x++) {
      const dx = Math.abs(x - cx + 0.5);
      if (dx > half + 2) continue;
      const fade = Math.round(u * 16);
      if (dx < 2) c.set(x, y, BAYER[(y & 3) * 4 + (x & 3)] < fade + 4 ? R[5] : R[4]);
      else if (dx < half - 3) c.set(x, y, BAYER[(y & 3) * 4 + (x & 3)] < fade + 3 ? R[4] : R[3]);
      else if (dx < half) {
        if (BAYER[(y & 3) * 4 + (x & 3)] < fade + 2) c.set(x, y, R[3]);
      } else if (BAYER[(y & 3) * 4 + (x & 3)] < Math.round(fade / 2)) c.set(x, y, R[2]);
    }
  }
  return c;
}

function paintHot(side: 0 | 1): PixelCanvas {
  const R = HOLO_LOOKS[side].ramp;
  const c = new PixelCanvas(RING_W, 22);
  c.ellipseRing(RING_W / 2, 10, PED.rx - 6, 9, R[5]);
  c.ellipseRing(RING_W / 2, 10, PED.rx - 7, 8, R[3]);
  return c;
}

function paintMote(side: 0 | 1, k: number): PixelCanvas {
  const R = HOLO_LOOKS[side].ramp;
  if (k === 3) {
    // a small plus
    const p = new PixelCanvas(3, 3);
    p.set(1, 0, R[4]);
    p.set(0, 1, R[4]);
    p.set(2, 1, R[4]);
    p.set(1, 2, R[4]);
    p.set(1, 1, R[5]);
    return p;
  }
  const c = new PixelCanvas(3, 2);
  if (k === 0) c.set(0, 0, R[3]);
  else if (k === 1) c.hline(0, 1, 0, R[4]);
  else (c.set(1, 0, R[5]), c.set(1, 1, R[3]));
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

/** Skeleton-compatible painter (the boot step registers it). */
export function paintHolo(): PixelCanvas {
  return holoStaticBake().canvas;
}

export { PAL };
