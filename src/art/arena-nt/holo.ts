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
//   halo:<side>:<k>   the creature's BLOOM: a big stepped ellipse of dark ramp tones, drawn with ADD blend behind the creature (2 breathing sizes)
//   spill:<side>:<k>  the light SPILL on the floor / the stands round the pedestal (ADD blend, over the crowd)
//   orb:<k>           the magus staff's magenta orb light (3 pulse sizes), ADD blend
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

/** Bloom sizes: the halo round a creature (centre on the creature), the spill on the floor / stands (centre under the pedestal), the orb. */
export const HALO = [
  { rx: 76, ry: 60 },
  { rx: 74, ry: 60 },
] as const;
export const HALO_FRAMES = 2;
export const SPILL = { rx: 96, ry: 40 } as const;
export const SPILL_FRAMES = 2;
export const ORB_R = 40;
export const ORB_FRAMES = 3;

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
  // ---- the glow on the floor round the pedestal: a flat disc of the ramp's darkest tone, its rim a one-pixel checker
  for (let y = 0; y < PED_H; y++)
    for (let x = 0; x < PED_W; x++) {
      const dx = (x - cx) / (rx + PED.pad);
      const dy = (y - (cy + H / 2 + 2)) / (ry + H / 2 + 5);
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      if (d < 0.62 || ((x + y) & 1) === 0) c.set(x, y, R[0]);
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
  // the pool: three flat steps of the ramp inside the dark face, each edge a one-pixel checker
  for (let y = 0; y < PED_H; y++)
    for (let x = 0; x < PED_W; x++) {
      const dx = (x - cx) / (rx - 8);
      const dy = (y - cy) / (ry - 3);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1) continue;
      const ck = ((x + y) & 1) === 0;
      let t = d < 0.3 ? 2 : d < 0.64 ? 1 : 0;
      if (Math.abs(d - 0.3) < 0.05 && ck) t = 1;
      if (Math.abs(d - 0.64) < 0.05 && ck) t = 0;
      if (Math.abs(d - 0.92) < 0.08 && ck) t = -1;
      if (t >= 0 && !(t === 0 && d > 0.8)) c.set(x, y, t === 2 ? R[2] : t === 1 ? R[1] : R[0]);
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
  // the cone's light falls off with distance from the pedestal's centre (curved contours, never horizontal bands): two flat steps whose
  // edges are a one-pixel checker, and a 1-px lit rim on both flanks
  for (let y = 0; y < CONE_H; y++) {
    const u = 1 - y / (CONE_H - 1); // 1 at the pedestal (bottom) … 0 at the top
    const half = 36 + (1 - u) * 24;
    for (let x = 0; x < CONE_W; x++) {
      const dx = Math.abs(x - CONE_W / 2 + 0.5);
      if (dx > half) continue;
      const across = 1 - dx / half;
      const v = across * 0.55 + u * 0.7 - 0.2;
      const ck = ((x + y) & 1) === 0;
      let t = v > 0.62 ? 2 : v > 0.3 ? 1 : 0;
      if (Math.abs(v - 0.62) < 0.05 && ck) t = 1;
      if (Math.abs(v - 0.3) < 0.05 && ck) t = 0;
      if (v > 0.12 && t >= 1) c.set(x, y, t === 2 ? R[1] : R[0]);
      else if (v > 0.2 && t === 0 && ck) c.set(x, y, R[0]);
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
    // the beam narrows a little as it climbs and thins into a checker
    const half = 3 + Math.round(u * 9);
    for (let x = 0; x < BEAM_W; x++) {
      const dx = Math.abs(x - cx + 0.5);
      if (dx > half + 2) continue;
      const ck = ((x + y) & 1) === 0;
      const hi = u > 0.35 || ck;
      if (dx < 2) c.set(x, y, hi ? R[5] : R[4]);
      else if (dx < half - 3) c.set(x, y, hi ? R[4] : R[3]);
      else if (dx < half) {
        if (u > 0.2 || ck) c.set(x, y, R[3]);
      } else if (ck && u > 0.25) c.set(x, y, R[2]);
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

/**
 * A stepped glow: concentric flat steps of `tones` (outer → inner), each step edge softened by a 2×2 checker one pixel wide (never a
 * 4×4 Bayer noise). `grow` widens every step a little (the breathing variant).
 */
function paintGlow(w: number, h: number, rx: number, ry: number, tones: readonly number[], grow: number, skew = 0): PixelCanvas {
  const c = new PixelCanvas(w, h);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const n = tones.length;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / (rx + grow);
      const dy = (y - cy) / (ry + grow * 0.8);
      const d = Math.sqrt(dx * dx + dy * dy) + skew * Math.sin(Math.atan2(dy, dx) * 3) * 0.02;
      if (d >= 1) continue;
      // step edges at d = 1 - (i+1)/n ... a quadratic falloff so the core is small and the rim wide
      const v = (1 - d) * (1 - d);
      const f = v * n * 1.6;
      let lvl = Math.floor(f);
      const fr = f - lvl;
      if (fr > 0.78 && ((x + y) & 1) === 0) lvl += 1;
      if (lvl <= 0) continue;
      c.set(x, y, tones[Math.min(n, lvl) - 1]);
    }
  return c;
}

function paintHalo(side: 0 | 1, k: number): PixelCanvas {
  const R = HOLO_LOOKS[side].ramp;
  const { rx, ry } = HALO[side];
  // violet adds more light per tone than blue does: its bloom starts one ramp step darker
  const t = side === 0 ? [R[0], R[0], R[1], R[1]] : [PAL.void0, PAL.void0, PAL.void1];
  return paintGlow(2 * rx + 3, 2 * ry + 3, rx, ry, t, k * 2, 1);
}
function paintSpill(side: 0 | 1, k: number): PixelCanvas {
  const R = HOLO_LOOKS[side].ramp;
  const t = side === 0 ? [R[0], R[1], R[1], R[1]] : [PAL.void0, PAL.void0, PAL.void1, PAL.void1];
  return paintGlow(2 * SPILL.rx + 3, 2 * SPILL.ry + 3, SPILL.rx, SPILL.ry, t, k * 3, 1);
}
function paintOrb(k: number): PixelCanvas {
  const g = [PAL.mag0, PAL.mag0, PAL.mag1, PAL.mag1, PAL.mag2];
  return paintGlow(2 * ORB_R + 3, 2 * ORB_R + 3, ORB_R - 6 + k * 3, ORB_R - 6 + k * 3, g, 0);
}

export const pedName = (side: 0 | 1): string => `ped:${side}`;
export const ringName = (side: 0 | 1, k: number): string => `ring:${side}:${k}`;
export const coneName = (side: 0 | 1): string => `cone:${side}`;
export const flareName = (side: 0 | 1, k: number): string => `flare:${side}:${k}`;
export const beamName = (side: 0 | 1): string => `beam:${side}`;
export const hotName = (side: 0 | 1): string => `hot:${side}`;
export const moteName = (side: 0 | 1, k: number): string => `mote:${side}:${k}`;
export const haloName = (side: 0 | 1, k: number): string => `halo:${side}:${k}`;
export const spillName = (side: 0 | 1, k: number): string => `spill:${side}:${k}`;
export const orbName = (k: number): string => `orb:${k}`;

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
    for (let k = 0; k < HALO_FRAMES; k++) parts.push([haloName(side, k), paintHalo(side, k)]);
    for (let k = 0; k < SPILL_FRAMES; k++) parts.push([spillName(side, k), paintSpill(side, k)]);
  }
  for (let k = 0; k < ORB_FRAMES; k++) parts.push([orbName(k), paintOrb(k)]);
  cache = packAtlas(parts, 640);
  return cache;
}

/** Skeleton-compatible painter (the boot step registers it). */
export function paintHolo(): PixelCanvas {
  return holoStaticBake().canvas;
}

export { PAL };
