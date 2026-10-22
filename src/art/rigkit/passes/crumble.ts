// rigkit / passes / crumble — stone breaking up in PART space (the stone death, A3 Y8; the revive's
// `reassemble` runs it backwards). Material-generic: the tones come from a style (the stone ramp for
// the pilot, basalt for the Titan later).
//
// Two halves around the frame's outline, so the outline follows the broken edge and the falling
// matter is never outlined (IŞ-9 matter vs light: debris is small matter, like the hit kit's chips):
//   crumblePass(f, o)        BEFORE the outline. Cracks open along a sparse cell network of the rest
//                            space (a Voronoi border: straight fissures meeting at angles, the way
//                            stone breaks), spreading out from an origin as the progress grows; then
//                            chunks on the silhouette's edge break away: their outer pixels are
//                            erased (the outline then runs round the notch) and their inner pixels
//                            turn into the dark recess they leave. Returns the debris.
//   drawDebris(p, d, o)      AFTER the outline. The broken-off chunks, in their own tones, falling
//                            under gravity and drifting away from the body, resting on the floor.
//
// Everything is a pure function of the progress and the part-space coordinates (restOf): the
// pattern rides the parts (a crack stays on its block when the block moves), nothing crawls, and the
// same progress gives the same frame. Reassemble = the same field read at 1 − progress (the chunks
// fly back up the paths they fell along, the cracks close), optionally with light in the closing
// cracks (the binding light of a revive).

import { PAL } from '../../palette';
import type { PixelCanvas } from '../../pixel';
import { DIR4, type PartComp, type StepTable } from '../composite';
import { clamp, type V } from '../geom';
import type { Light } from '../light';
import { hash2 } from './types';

export interface CrumbleStyle {
  /** colours a crack may cut → the groove tone (A3 stone: two ramp steps down) */
  readonly groove: StepTable;
  /** colours a loose chunk may carry (stone, moss on it); glow, ink and anything else stay */
  readonly chunk: ReadonlySet<number>;
  /** the recess a broken-off chunk leaves on the inner side → its tone (one or two steps down) */
  readonly recess: StepTable;
  /** the lit lip beside a groove (the wall facing the light, one step up); absent = no lip */
  readonly lip?: StepTable;
  /** light in the cracks (reassemble: the binding light), dim → hot */
  readonly glow?: readonly number[];
}

export interface CrumbleOpts {
  /** progress 0…1: cracks open over [crackFrom, crackEnd], edge chunks break away from fallFrom on */
  readonly t: number;
  /** rest-space (part space) coordinates of pixel (x, y) owned by `part` (1-based); null = never crumbles */
  readonly restOf: (part: number, x: number, y: number) => V | null;
  readonly light: Light;
  readonly style: CrumbleStyle;
  /** the floor row (frame px) the falling chunks come to rest on */
  readonly floorY: number;
  /** the frame column the debris drifts away from (the body's centre line) */
  readonly centreX: number;
  /** rest-space point the cracks run out from (where the binding fails) */
  readonly origin: V;
  /** rest px the crack front covers per unit of progress. Default 90. */
  readonly spread?: number;
  /** progress the first crack opens at / by which the network is fully open. Default 0.05 / 0.7. */
  readonly crackFrom?: number;
  /** cell size of the crack network (rest px). Default 7. */
  readonly cell?: number;
  /** share of the network's segments that ever open (a sparse web, not a mosaic). Default 0.42. */
  readonly density?: number;
  /** progress the first chunk breaks away at. Default 0.3. */
  readonly fallFrom?: number;
  /** share of the edge chunks that break away by t = 1. Default 0.3. */
  readonly fallShare?: number;
  /** chunk size (px). Default 2. */
  readonly chunk?: number;
  /**
   * (fix round 1) the fewest pixels a chunk breaks away with: an edge cell holding fewer stays on the
   * body (a 1-px crumb on the floor reads as speckle). Default 1 (every edge cell may fall).
   */
  readonly minChunk?: number;
  /** px of fall per unit of progress² (gravity in progress time). Default 220. */
  readonly gravity?: number;
  /** 0…1: light in the cracks (style.glow), 0 = dark grooves. Default 0. */
  readonly glow?: number;
  readonly seed?: number;
  /** how wide a crack runs (px of distance difference at the cell border; 1 ≈ one to two px). Default 1. */
  readonly crackWidth?: number;
  /** the crack network at all (default true; false = joints / chunks only) */
  readonly cracks?: boolean;
  /**
   * The JOINTS between blocks open: where a part meets a part drawn in front of it, the pixel of the
   * one behind turns into a groove (the mortar line opening; masonry comes apart at its joints
   * before it breaks). `joint(behind, front)` says which boundaries open (default: none); they open
   * from progress `jointFrom` on, spreading from the origin twice as fast as the cracks.
   */
  readonly joint?: (behind: number, front: number) => boolean;
  readonly jointFrom?: number;
  /** draw order of the parts (higher = in front). Default: the part id. */
  readonly order?: (part: number) => number;
}

/** One broken-off chunk: its pixels (frame px at rest in the frame, original tones) and where it falls. */
export interface DebrisChunk {
  /** the part it broke off */
  readonly part: number;
  /** x, y, colour triples */
  readonly px: readonly number[];
  /** the fall so far (px, whole) */
  readonly dx: number;
  readonly dy: number;
}

export interface Debris {
  readonly chunks: readonly DebrisChunk[];
}

const EMPTY: Debris = Object.freeze({ chunks: Object.freeze([]) });

/** The two nearest cell seeds of a rest-space point: distances and seed ids. */
function nearest2(rx: number, ry: number, cell: number, seed: number): { d1: number; d2: number; a: number; b: number } {
  const ci = Math.floor(rx / cell);
  const cj = Math.floor(ry / cell);
  let d1 = Infinity;
  let d2 = Infinity;
  let a = 0;
  let b = 0;
  for (let j = cj - 1; j <= cj + 1; j++)
    for (let i = ci - 1; i <= ci + 1; i++) {
      const sx = (i + 0.15 + 0.7 * hash2(i, j, seed + 1)) * cell;
      const sy = (j + 0.15 + 0.7 * hash2(i, j, seed + 2)) * cell;
      const d = Math.hypot(rx + 0.5 - sx, ry + 0.5 - sy);
      const id = ((i & 0xffff) << 16) | (j & 0xffff);
      if (d < d1) {
        d2 = d1;
        b = a;
        d1 = d;
        a = id;
      } else if (d < d2) {
        d2 = d;
        b = id;
      }
    }
  return { d1, d2, a, b };
}

/**
 * The crack field and the edge chunks of the frame `f` at progress o.t (see the header). Works on
 * f.p in place (BEFORE the outline) and clears the part id of every erased pixel; returns the debris
 * for drawDebris (AFTER the outline).
 */
export function crumblePass(f: PartComp, o: CrumbleOpts): Debris {
  const t = clamp(o.t, 0, 1);
  if (t <= 0) return EMPTY;
  const { p, id } = f;
  const W = p.w;
  const H = p.h;
  const cell = o.cell ?? 7;
  const seed = o.seed ?? 0;
  const spread = o.spread ?? 90;
  const crackFrom = o.crackFrom ?? 0.05;
  const density = o.density ?? 0.42;
  const fallFrom = o.fallFrom ?? 0.3;
  const fallShare = o.fallShare ?? 0.3;
  const K = o.chunk ?? 2;
  const gravity = o.gravity ?? 220;
  const glow = clamp(o.glow ?? 0, 0, 1);
  const st = o.style;
  const lipDx = -o.light.side; // the groove's wall on the side away from the light faces it

  // ---- the owner of every opaque pixel (an outline-free frame: every body pixel has its part)
  const restX = new Int16Array(W * H);
  const restY = new Int16Array(W * H);
  const has = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!p.isOpaque(x, y) || id[i] === 0) continue;
      const r = o.restOf(id[i], x, y);
      if (!r) continue;
      restX[i] = Math.round(r[0]);
      restY[i] = Math.round(r[1]);
      has[i] = 1;
    }

  // ---- cracks: Voronoi borders of the rest space, a sparse share of segments, opening outward
  const crack = new Uint8Array(W * H);
  const withCracks = o.cracks ?? true;
  for (let i = 0; i < W * H; i++) {
    if (!has[i] || !withCracks) continue;
    const c = p.get(i % W, (i / W) | 0)!;
    if (st.groove[c] === undefined) continue;
    const rx = restX[i];
    const ry = restY[i];
    const n = nearest2(rx, ry, cell, seed);
    if (n.d2 - n.d1 >= (o.crackWidth ?? 1)) continue;
    const lo = Math.min(n.a, n.b);
    const hi = Math.max(n.a, n.b);
    const seg = hash2(lo, hi, seed + 3);
    if (seg >= density) continue;
    const front = crackFrom + 0.2 * hash2(lo, hi, seed + 4) + Math.hypot(rx - o.origin[0], ry - o.origin[1]) / spread;
    if (t >= front) crack[i] = 1;
  }
  // ---- joints: the boundary pixel of the part behind, where a part in front meets it
  if (o.joint) {
    const order = o.order ?? ((part: number) => part);
    const from = o.jointFrom ?? 0;
    for (let i = 0; i < W * H; i++) {
      if (!has[i] || crack[i]) continue;
      const x = i % W;
      const y = (i / W) | 0;
      const c = p.get(x, y)!;
      if (st.groove[c] === undefined) continue;
      const me = id[i];
      for (const [dx, dy] of DIR4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const them = id[ny * W + nx];
        if (them === 0 || them === me || !has[ny * W + nx] || order(them) <= order(me) || !o.joint(me, them)) continue;
        if (t >= from + Math.hypot(restX[i] - o.origin[0], restY[i] - o.origin[1]) / (2 * spread)) crack[i] = 2;
        break;
      }
    }
  }
  const grooves: number[] = [];
  const lips: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (!crack[i]) continue;
    const x = i % W;
    const y = (i / W) | 0;
    const c = p.get(x, y)!;
    const tone = glow > 0 && st.glow?.length && crack[i] === 1 ? st.glow[Math.min(st.glow.length - 1, Math.floor(glow * st.glow.length))] : st.groove[c];
    grooves.push(x, y, tone);
    if (st.lip && glow === 0 && crack[i] === 1) {
      const j = i + lipDx;
      const lx = x + lipDx;
      if (lx >= 0 && lx < W && has[j] && !crack[j]) {
        const cl = p.get(lx, y)!;
        if (st.lip[cl] !== undefined) lips.push(lx, y, st.lip[cl]);
      }
    }
  }
  for (let k = 0; k < lips.length; k += 3) p.set(lips[k], lips[k + 1], lips[k + 2]);
  for (let k = 0; k < grooves.length; k += 3) p.set(grooves[k], grooves[k + 1], grooves[k + 2]);
  if (t < fallFrom) return EMPTY;

  // ---- edge chunks: K×K cells of each part's rest space with a pixel on the silhouette's edge
  const outer = (x: number, y: number) => {
    for (const [dx, dy] of DIR4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || !p.isOpaque(nx, ny)) return true;
    }
    return false;
  };
  type Chunk = { part: number; cx: number; cy: number; px: number[]; edge: boolean };
  const chunks = new Map<string, Chunk>();
  for (let i = 0; i < W * H; i++) {
    if (!has[i]) continue;
    const x = i % W;
    const y = (i / W) | 0;
    const c = p.get(x, y)!;
    if (!st.chunk.has(c)) continue;
    const cx = Math.floor(restX[i] / K);
    const cy = Math.floor(restY[i] / K);
    const key = `${id[i]}:${cx}:${cy}`;
    let ch = chunks.get(key);
    if (!ch) {
      ch = { part: id[i], cx, cy, px: [], edge: false };
      chunks.set(key, ch);
    }
    ch.px.push(x, y, c);
    if (outer(x, y)) ch.edge = true;
  }
  const out: DebrisChunk[] = [];
  const erase: number[] = [];
  const recess: number[] = [];
  const minPx = Math.max(1, o.minChunk ?? 1);
  for (const ch of chunks.values()) {
    if (!ch.edge || ch.px.length / 3 < minPx) continue;
    if (hash2(ch.cx, ch.cy, seed + 5 + ch.part) >= fallShare) continue;
    const thr = fallFrom + (1 - fallFrom) * 0.8 * hash2(ch.cx, ch.cy, seed + 6 + ch.part);
    if (t < thr) continue;
    const u = t - thr;
    let bottom = -Infinity;
    let sx = 0;
    for (let k = 0; k < ch.px.length; k += 3) {
      bottom = Math.max(bottom, ch.px[k + 1]);
      sx += ch.px[k];
    }
    sx /= ch.px.length / 3;
    const away = sx < o.centreX ? -1 : 1;
    const dy = Math.round(Math.min(gravity * u * u, Math.max(0, o.floorY - bottom)));
    const dx = Math.round(away * (1 + 3 * hash2(ch.cx, ch.cy, seed + 7 + ch.part)) * Math.min(1, u * 2.5));
    for (let k = 0; k < ch.px.length; k += 3) {
      const x = ch.px[k];
      const y = ch.px[k + 1];
      if (outer(x, y)) erase.push(x, y);
      else {
        const r = st.recess[ch.px[k + 2]];
        if (r !== undefined) recess.push(x, y, r);
      }
    }
    out.push({ part: ch.part, px: ch.px, dx, dy });
  }
  for (let k = 0; k < recess.length; k += 3) p.set(recess[k], recess[k + 1], recess[k + 2]);
  for (let k = 0; k < erase.length; k += 2) {
    p.erase(erase[k], erase[k + 1]);
    id[erase[k + 1] * W + erase[k]] = 0;
  }
  return { chunks: out };
}

/**
 * The debris of crumblePass (AFTER the outline): each chunk in its own tones at its fallen place,
 * clipped to the frame; a chunk that has not moved yet is left out (it still sits in its notch: the
 * recess and the outline show the break). With the frame's part ids and draw order, a chunk falling
 * behind a part drawn in front of its own (a far pauldron's chip behind the shield) stays hidden.
 */
export function drawDebris(p: PixelCanvas, d: Debris, o: { floorY: number; margin?: number; comp?: PartComp; order?: (part: number) => number }): void {
  const m = o.margin ?? 2;
  const order = o.order ?? ((part: number) => part);
  for (const ch of d.chunks) {
    if (ch.dx === 0 && ch.dy === 0) continue;
    const mine = order(ch.part);
    for (let k = 0; k < ch.px.length; k += 3) {
      const x = ch.px[k] + ch.dx;
      const y = ch.px[k + 1] + ch.dy;
      if (x < m || y < m || x >= p.w - m || y >= p.h - m || y > o.floorY) continue;
      const under = o.comp ? o.comp.owner(x, y) : 0;
      if (under !== 0 && under !== ch.part && order(under) > mine) continue;
      p.set(x, y, ch.px[k + 2]);
    }
  }
}

/**
 * The A3 stone style (Taş Muhafız; the Titan's basalt brings its own): grooves two steps down like the
 * still's creases, no lip (a bright lip read as a scratch at 1×), the rune gold as the binding light.
 */
export const CRUMBLE_STONE: CrumbleStyle = Object.freeze({
  groove: Object.freeze({ [PAL.stone4]: PAL.stone2, [PAL.stone3]: PAL.stone1, [PAL.stone2]: PAL.stone0, [PAL.stone1]: PAL.stone0 }),
  chunk: new Set<number>([PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4, PAL.leaf0, PAL.leaf1, PAL.leaf2, PAL.leaf3]),
  recess: Object.freeze({ [PAL.stone4]: PAL.stone2, [PAL.stone3]: PAL.stone1, [PAL.stone2]: PAL.stone1, [PAL.stone1]: PAL.stone0, [PAL.leaf3]: PAL.leaf1, [PAL.leaf2]: PAL.leaf1, [PAL.leaf1]: PAL.leaf0 }),
  glow: Object.freeze([PAL.gold1, PAL.gold2, PAL.gold3]),
});
