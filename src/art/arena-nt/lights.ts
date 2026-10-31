// Neon Tower — the baked LIGHT stipples of the lights layer (owner C, docs/v3/ARENA_NEON_TOWER.md §11).
// The v3 look has no alpha light: a light is a set of flat pixels in a palette tone, faded through ordered-dither
// density steps (the language of src/view/light/stepped.ts). Everything here is pure PixelCanvas code (no Phaser,
// no Math.random): a SHAPE is a density field D(x, y) in 0…1 and a LEVEL (1…3) lights the pixels whose density
// beats the 4×4 Bayer threshold of the pixel (world-aligned for the sparse tiles, so tiles repeat seamlessly).
//
//   cone       a ceiling spotlight under a lamp fixture (lean = px of drift per row), 3 density levels
//   pool       an iso ellipse of light on the hall floor (hologram plinths, the floors in front of the stands)
//   halo       a frame of light around a screen bay (screens glow on the wall around them)
//   edge tiles the contact glow on the hall floor just below the platform's near faces (sparse 16×16 tiles, de-duplicated)
//
// Cone / pool / halo texels are pure white: the runtime tints them with ONE palette tone (setTint multiplies white
// by that exact colour), so one frame serves both sides (flipX). Edge tiles carry their palette tones baked in.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { FACE_H, PLATE_OUTLINE, ntIso } from '../../view/board-nt/layout-nt';
import { type NtAtlas, packAtlas } from './wall-kit';

export const NT_LIGHTS_KEY = 'arena-nt:lights';

/** Density multiplier of each level (index = level; 0 = dark). Bayer threshold test: lit when D × LV > threshold. */
export const LIGHT_LV = [0, 0.4, 0.66, 0.92] as const;
export const LIGHT_LEVELS = 3;

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;
/** The 4×4 Bayer threshold (0…1) of a world pixel. */
export const bayer4 = (x: number, y: number): number => (BAYER4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

/** Names of the atlas frames. */
export const lightFrame = {
  cone: (shape: number, level: number): string => `cone:${shape}:${level}`,
  pool: (shape: number, level: number): string => `pool:${shape}:${level}`,
  halo: (level: number): string => `halo:${level}`,
  tile: (side: 0 | 1, level: number, i: number): string => `edge:${side}:${level}:${i}`,
};

// ---------------------------------------------------------------------------------------------- shapes

export interface ConeShape {
  /** Drift per row: the cone leans (px of x per row; negative = left). */
  lean: number;
  /** Rows. */
  h: number;
  /** Half-width at the lens / growth per row. */
  hw0: number;
  grow: number;
}
/** The two cone shapes (the right pair mirrors them with flipX): the outer lamp leans out, the inner one stands almost straight. */
export const CONES: readonly ConeShape[] = [
  { lean: -0.42, h: 84, hw0: 2.5, grow: 0.36 },
  { lean: -0.14, h: 76, hw0: 2.5, grow: 0.3 },
];

/** A cone's canvas size and where its apex (the lens centre) sits inside it. */
export function coneBox(c: ConeShape): { w: number; h: number; ax: number } {
  const reach = c.hw0 + c.h * c.grow;
  const drift = Math.abs(c.lean) * c.h;
  const w = Math.ceil(2 * reach + drift) + 2;
  const ax = c.lean < 0 ? Math.ceil(reach + drift) + 1 : Math.ceil(reach) + 1;
  return { w, h: c.h, ax };
}

function paintCone(c: ConeShape, level: number): PixelCanvas {
  const { w, h, ax } = coneBox(c);
  const p = new PixelCanvas(w, h);
  for (let r = 0; r < h; r++) {
    const cx = ax + c.lean * r;
    const hw = c.hw0 + c.grow * r;
    const fall = Math.pow(1 - r / h, 1.25);
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
      const u = Math.abs(x + 0.5 - cx) / hw;
      if (u > 1) continue;
      const d = 0.95 * fall * (1 - 0.6 * u * u);
      if (d * LIGHT_LV[level] > bayer4(x, r)) p.set(x, r, PAL.white);
    }
  }
  return p;
}

export interface PoolShape {
  rx: number;
  ry: number;
  /** Light strength at the centre (0…1). */
  peak: number;
}
/** Pool 0: the hologram plinth's floor pool. Pool 1: the floor in front of a grandstand. */
export const POOLS: readonly PoolShape[] = [
  { rx: 74, ry: 28, peak: 0.85 },
  { rx: 66, ry: 24, peak: 0.7 },
];

function paintPool(s: PoolShape, level: number): PixelCanvas {
  const w = s.rx * 2 + 1;
  const h = s.ry * 2 + 1;
  const p = new PixelCanvas(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (x - s.rx) / (s.rx + 0.5);
      const dy = (y - s.ry) / (s.ry + 0.5);
      const d2 = dx * dx + dy * dy;
      if (d2 >= 1) continue;
      const d = s.peak * (1 - d2);
      // a flat contour (no dither): the level decides how far the light reaches, the edge is one clean 2:1 ellipse step
      if (d * LIGHT_LV[level] > 0.24) p.set(x, y, PAL.white);
    }
  return p;
}

/** The glow frame around a screen bay: a hole of the bay's size, `HALO_M` px of light around it. */
export const HALO_M = 8;
export const HALO_BAY = { w: 98, h: 74 } as const;

function paintHalo(level: number): PixelCanvas {
  const W = HALO_BAY.w + 2 * HALO_M;
  const H = HALO_BAY.h + 2 * HALO_M;
  const p = new PixelCanvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ox = Math.max(HALO_M - x - 1, x - (HALO_M + HALO_BAY.w), 0);
      const oy = Math.max(HALO_M - y - 1, y - (HALO_M + HALO_BAY.h), 0);
      if (ox === 0 && oy === 0) continue; // inside the bay: the bay is opaque, nothing to light
      const d = Math.hypot(ox, oy);
      if (d > HALO_M) continue;
      const f = 0.8 * (1 - (d - 0.5) / HALO_M);
      if (f * LIGHT_LV[level] > bayer4(x, y)) p.set(x, y, PAL.white);
    }
  return p;
}

// ---------------------------------------------------------------------------------------------- edge glow (sparse tiles)

export const EDGE_TILE = 16;
/** How far below the platform's near faces the contact glow reaches (px). */
export const EDGE_REACH = 24;
/** Rows below the slab that the apron's footing flange (ring + front face) already covers: the glow starts past it. */
const EDGE_SKIP = 14;
/** The tile grid origin (screen) and size covering the plate + armour. */
const EDGE_BOX = { x: 96, y: 140, w: 464, h: 208 } as const;

/** Coverage mask of the platform's silhouette (plate top + the FACE_H armour below it) in screen pixels. */
function plateMask(): PixelCanvas {
  const m = new PixelCanvas(EDGE_BOX.w, EDGE_BOX.h);
  const pts = PLATE_OUTLINE.map(([c, r]) => {
    const s = ntIso(c, r);
    return [Math.round(s.x) - EDGE_BOX.x, Math.round(s.y) - EDGE_BOX.y] as const;
  });
  for (let dy = 0; dy <= FACE_H; dy++) m.poly(pts.map(([x, y]) => [x, y + dy] as const), PAL.white);
  return m;
}

export interface EdgeTile {
  side: 0 | 1;
  /** Screen position of the tile's top-left. */
  x: number;
  y: number;
  /** The frame per level (index 1…3; 0 unused). */
  frames: readonly [string, string, string, string];
}

export interface EdgeArt {
  tiles: EdgeTile[];
  parts: [string, PixelCanvas][];
}

/** Bake the contact-glow tiles of both near faces: left (cyan, x < the near corner) and right (crimson). */
export function paintEdgeGlow(): EdgeArt {
  const S = plateMask();
  const corner = Math.round(ntIso(PLATE_OUTLINE[6][0], PLATE_OUTLINE[6][1]).x); // the near corner's x (352)
  // density per pixel: k = rows below the silhouette (1…EDGE_REACH), only where the column's pixel above is the silhouette
  const dens = new Float32Array(EDGE_BOX.w * EDGE_BOX.h);
  const kk = new Uint8Array(EDGE_BOX.w * EDGE_BOX.h);
  for (let x = 0; x < EDGE_BOX.w; x++)
    for (let y = 1; y < EDGE_BOX.h; y++) {
      if (S.isOpaque(x, y)) continue;
      let k = 0;
      for (let j = 1; j <= EDGE_REACH && y - j >= 0; j++)
        if (S.isOpaque(x, y - j)) {
          k = j;
          break;
        }
      if (k === 0) continue;
      kk[y * EDGE_BOX.w + x] = k;
      dens[y * EDGE_BOX.w + x] = 1;
    }
  const tones = (side: 0 | 1): readonly [number, number] => (side === 0 ? [PAL.cyan1, PAL.cyan0] : [PAL.crim1, PAL.crim0]);
  const cols = Math.ceil(EDGE_BOX.w / EDGE_TILE);
  const rows = Math.ceil(EDGE_BOX.h / EDGE_TILE);
  const seen = new Map<string, string>();
  const parts: [string, PixelCanvas][] = [];
  const tiles: EdgeTile[] = [];
  for (let ty = 0; ty < rows; ty++)
    for (let tx = 0; tx < cols; tx++) {
      const sx = EDGE_BOX.x + tx * EDGE_TILE;
      const side: 0 | 1 = sx + EDGE_TILE / 2 < corner ? 0 : 1;
      const frames: string[] = [''];
      let any = false;
      for (let L = 1; L <= LIGHT_LEVELS; L++) {
        const t = new PixelCanvas(EDGE_TILE, EDGE_TILE);
        let n = 0;
        for (let y = 0; y < EDGE_TILE; y++)
          for (let x = 0; x < EDGE_TILE; x++) {
            const gx = tx * EDGE_TILE + x;
            const gy = ty * EDGE_TILE + y;
            if (gx >= EDGE_BOX.w || gy >= EDGE_BOX.h) continue;
            const i = gy * EDGE_BOX.w + gx;
            if (dens[i] <= 0) continue;
            // flat bands past the footing (no dither): level 1 = one thin band, 2 = + a second, 3 = + a wider outer one
            const k = kk[i] - EDGE_SKIP;
            if (k < 1 || k > 3 * L) continue;
            t.set(x, y, k <= 3 ? (L === 1 ? tones(side)[1] : tones(side)[0]) : tones(side)[1]);
            n++;
          }
        if (n === 0) {
          frames.push('');
          continue;
        }
        any = true;
        const key = `${side}:${L}:${Array.from(t.data).join(',')}`;
        let name = seen.get(key);
        if (!name) {
          name = lightFrame.tile(side, L, seen.size);
          seen.set(key, name);
          parts.push([name, t]);
        }
        frames.push(name);
      }
      if (any) tiles.push({ side, x: sx, y: EDGE_BOX.y + ty * EDGE_TILE, frames: frames as unknown as EdgeTile['frames'] });
    }
  return { tiles, parts };
}

// ---------------------------------------------------------------------------------------------- the atlas

export interface LightsBake extends NtAtlas {
  tiles: EdgeTile[];
}

export function bakeLights(): LightsBake {
  const parts: [string, PixelCanvas][] = [];
  CONES.forEach((c, i) => {
    for (let L = 1; L <= LIGHT_LEVELS; L++) parts.push([lightFrame.cone(i, L), paintCone(c, L)]);
  });
  POOLS.forEach((s, i) => {
    for (let L = 1; L <= LIGHT_LEVELS; L++) parts.push([lightFrame.pool(i, L), paintPool(s, L)]);
  });
  for (let L = 1; L <= LIGHT_LEVELS; L++) parts.push([lightFrame.halo(L), paintHalo(L)]);
  const edge = paintEdgeGlow();
  parts.push(...edge.parts);
  const atlas = packAtlas(parts, 512);
  return { ...atlas, tiles: edge.tiles };
}
