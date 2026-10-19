// rigkit / passes / gather — the body re-forms from flying crystal fragments (crystal revive; A2 wyrm).
//
// COPIED from crystal_wyrm-rig.ts (cellMap / fragment / gatherBody / shardFace / shard). The wyrm
// cached its partition and the core point in module singletons; here the partition is a value the
// caller builds once per frame size (CellPartition) and the core is passed in.
//
// The frame is cut into fragments (a fixed jittered-grid Voronoi partition, `cell` px cells); each
// flies in from outside along a gentle spiral and locks into place, the inner ones first. While
// flying a fragment is a clean shard (a straight-edged rhombus on 2:1 or 45° steps, sized by its
// cell, two flat tones split along its ridge inside its own 1-px ink outline, white along the lit
// edge of the few largest); once locked it shows the body.

import { PAL } from '../../palette';
import type { PixelCanvas } from '../../pixel';
import { DEG, add, clamp, len, mul, norm, rnd, rotV, sub, type V } from '../geom';
import type { Light } from '../light';
import { hashIdx } from './types';

/** The fixed fragment partition of a frame (A2: 7 px cells). Immutable once built. */
export class CellPartition {
  readonly w: number;
  readonly h: number;
  readonly cell: number;
  readonly seeds: readonly V[];
  /** pixel → fragment index */
  readonly map: Int16Array;

  constructor(w: number, h: number, cell = 7) {
    this.w = w;
    this.h = h;
    this.cell = cell;
    const GX = Math.ceil(w / cell) + 1;
    const GY = Math.ceil(h / cell) + 1;
    const seeds: V[] = [];
    for (let gy = 0; gy < GY; gy++)
      for (let gx = 0; gx < GX; gx++) {
        const i = gy * GX + gx;
        seeds.push([gx * cell + 0.5 + hashIdx(i, 1) * 6, gy * cell + 0.5 + hashIdx(i, 2) * 6]);
      }
    const m = new Int16Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const gx = Math.floor(x / cell);
        const gy = Math.floor(y / cell);
        let best = Infinity;
        let bi = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const cx = gx + dx;
            const cy = gy + dy;
            if (cx < 0 || cy < 0 || cx >= GX || cy >= GY) continue;
            const i = cy * GX + cx;
            const d = (seeds[i][0] - x - 0.5) ** 2 + (seeds[i][1] - y - 0.5) ** 2;
            if (d < best) [best, bi] = [d, i];
          }
        m[y * w + x] = bi;
      }
    this.seeds = Object.freeze(seeds);
    this.map = m;
  }
}

/** Arrival (0..1) and offset of fragment i (seed point) at this gather progress, flying to `core`. */
export function fragment(i: number, seed: V, gather: number, core: V): { a: number; off: V } {
  const d = len(sub(seed, core));
  const delay = 0.5 * clamp(d / 52, 0, 1) + 0.1 * hashIdx(i, 3);
  const a = clamp((gather - delay) / 0.4, 0, 1);
  let dir = norm(sub(seed, core));
  // fragments come in from the sides and from above, never from under the floor
  if (dir[1] > -0.1) dir = norm([dir[0] || (hashIdx(i, 4) < 0.5 ? -1 : 1), -0.1]);
  const k = 1 - a;
  // the spiral turns upward on both sides: they arc in from above
  const swirl = k * 40 * DEG * (dir[0] > 0 ? -1 : 1);
  const dist = (8 + 10 * hashIdx(i, 5)) * k * k;
  return { a, off: mul(rotV(dir, swirl), dist) };
}

/**
 * Is (x, y) inside a shard of long half-size L: kind 0 a flat rhombus (2:1 edges, ridge across),
 * 1 a tall rhombus (2:1, ridge up), 2 a 45° diamond (ridge along the diagonal away from the light).
 * Returns 0 outside, 1 the lit face, 2 the shadow face.
 */
export function shardFace(kind: number, L: number, x: number, y: number, light: Light): number {
  const s = -light.side; // +1: the key light is at the frame's left
  if (kind === 0) {
    const w = L;
    const h = Math.ceil(L / 2);
    if (Math.abs(x) / w + Math.abs(y) / h > 1) return 0;
    return y <= 0 ? 1 : 2;
  }
  if (kind === 1) {
    const w = Math.ceil(L / 2);
    const h = L;
    if (Math.abs(x) / w + Math.abs(y) / h > 1) return 0;
    return x * s <= 0 ? 1 : 2;
  }
  const r = Math.ceil(L * 0.75);
  if (Math.abs(x) + Math.abs(y) > r) return 0;
  return x * s + y <= 0 ? 1 : 2;
}

export interface ShardTones {
  readonly lit: number;
  readonly shadow: number;
  readonly edge: number;
}
/** A2: cyan3 lit face, cyan1 shadow face, white lit edge. */
export const SHARD_TONES_A2: ShardTones = Object.freeze({ lit: PAL.cyan3, shadow: PAL.cyan1, edge: PAL.white });

/** One flying shard at c (hash h picks its kind): ink outline ring, two flat faces, a white lit edge. */
export function flyingShard(p: PixelCanvas, c: V, L: number, h: number, whiteEdge: boolean, light: Light, tones: ShardTones = SHARD_TONES_A2) {
  const W = p.w;
  const H = p.h;
  const kind = h < 0.4 ? 0 : h < 0.65 ? 1 : 2;
  const R = L + 1;
  const inside = (x: number, y: number) => x >= -R && x <= R && y >= -R && y <= R && shardFace(kind, L, x, y, light) > 0;
  const put = (x: number, y: number, col: number) => {
    const X = c[0] + x;
    const Y = c[1] + y;
    if (X >= 1 && Y >= 1 && X < W - 1 && Y < H - 1) p.set(X, Y, col);
  };
  for (let y = -R; y <= R; y++)
    for (let x = -R; x <= R; x++)
      if (!inside(x, y) && (inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1))) put(x, y, PAL.ink);
  const s = -light.side;
  for (let y = -R; y <= R; y++)
    for (let x = -R; x <= R; x++) {
      const f = inside(x, y) ? shardFace(kind, L, x, y, light) : 0;
      if (!f) continue;
      // the lit edge: a lit-face pixel whose neighbour toward the light (above, or on the light's
      // side) is outside the shard
      const edge = f === 1 && (!inside(x, y - 1) || !inside(x - s, y));
      put(x, y, f === 2 ? tones.shadow : whiteEdge && edge ? tones.edge : tones.lit);
    }
}

/**
 * Gather the frame `p` (the finished body) at progress `gather` (0 = all fragments away, 1 = whole):
 * locked fragments show the body, flying ones are shards (largest drawn last; white edges on the
 * four largest in flight). `scratch` (optional, the frame's size) avoids an allocation.
 */
export function gatherBody(p: PixelCanvas, cells: CellPartition, core: V, gather: number, light: Light, scratch?: PixelCanvas, tones?: ShardTones) {
  const W = p.w;
  const H = p.h;
  const map = cells.map;
  const src = scratch ?? p.clone();
  if (scratch) src.data.set(p.data);
  p.clear();
  const N = cells.seeds.length;
  const frag = new Array<{ a: number; off: V }>(N);
  for (let i = 0; i < N; i++) frag[i] = fragment(i, cells.seeds[i], gather, core);
  const cnt = new Int32Array(N);
  const sx = new Float64Array(N);
  const sy = new Float64Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const cur = src.get(x, y);
      if (cur === null) continue;
      const i = map[y * W + x];
      cnt[i]++;
      sx[i] += x;
      sy[i] += y;
      if (frag[i].a >= 1) p.set(x, y, cur);
    }
  const fly: number[] = [];
  for (let i = 0; i < N; i++) if (cnt[i] >= 4 && frag[i].a > 0 && frag[i].a < 1) fly.push(i);
  fly.sort((a, b) => cnt[a] - cnt[b] || a - b);
  const lit = new Set(fly.slice(-4));
  for (const i of fly) {
    const c = rnd(add([sx[i] / cnt[i], sy[i] / cnt[i]], frag[i].off));
    flyingShard(p, c, Math.max(2, Math.min(5, Math.round(Math.sqrt(cnt[i]) * 0.8))), hashIdx(i, 7), lit.has(i), light, tones);
  }
}
