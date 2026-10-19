// rigkit / raster — the little deferred G-buffer of the v3 rigs (A3_MIMARI §3.1; REHBER IŞ-3, IŞ-4).
//
// COPIED from the slice (crystal_wyrm-gbuf.ts: class G, render, despeckle, gEll / gTube / gFacet /
// gShard, the canvas pools) and made instance-scoped: the frame size, the light and the material
// table belong to the Raster (no module W / H, LIGHT, MATS), and the pools belong to a Workspace the
// caller owns. Every formula keeps the slice's order, so with the A2 CraftOpts (the default) the
// output is byte-identical to the slice (tests/art/rigkit-fidelity*.test.ts).
//
// How a part is drawn: primitives write (material, normal, depth, bias) per pixel — the nearest
// surface wins — and render() lights each pixel with the key light, quantizes it into the
// material's flat value planes (thresholds on n·L + bias: IŞ-3) and despeckles the result
// (two 4-neighbour passes: IŞ-4). "Direct" materials take the bias as the ramp index (hand-toned
// planes: glass cells, head planes, horn bands).

import { PixelCanvas } from '../pixel';
import { add, clamp, dot, fillPoly, len, lerp, mul, norm, sub, type V, type V3 } from './geom';
import type { Light } from './light';

// ------------------------------------------------------------------ materials (raster view)

/** What the raster needs of a material: its ramp and thresholds (src/art/materials draw.ramp / th). */
export interface RasterMat {
  /** PAL tones dark → light */
  readonly ramp: readonly number[];
  /** ascending intensity thresholds, length = ramp.length − 1; [] with `direct` */
  readonly th: readonly number[];
  /** the pixel's bias IS the ramp index (hand-toned planes) */
  readonly direct?: boolean;
}

/** Index (the G-buffer's material byte, 0…127) → material. Sparse tables are fine. */
export type MaterialTable = readonly (RasterMat | undefined)[];
/** A slot of a MaterialTable. */
export type MatRef = number;

/** Anything with a draw.ramp / draw.th (a src/art/materials MaterialDef fits structurally). */
export interface RasterMatSource {
  readonly draw: { readonly ramp: readonly number[]; readonly th: readonly number[] };
}

/** A raster material from a material definition: th [] means hand-toned (direct). */
export function rasterMat(m: RasterMat | RasterMatSource): RasterMat {
  if ('draw' in m) return Object.freeze({ ramp: m.draw.ramp, th: m.draw.th, direct: m.draw.th.length === 0 });
  return m;
}

/**
 * Build a frozen material table (slot i = entries[i]; undefined slots stay empty). Throws when a
 * lit material's thresholds do not match its ramp (th.length must be ramp.length − 1) or the table
 * is larger than the G-buffer's material byte.
 *
 * Deviation from §3.1 (`materialTable(ids, light)`): the material library (src/art/materials, Y4)
 * is not imported by the core, so the table is built from the definitions themselves (a
 * MaterialDef fits RasterMatSource) — the caller resolves ids with materialOf(). The light does not
 * change a material's ramp, so it is not a parameter.
 */
export function materialTable(entries: readonly (RasterMat | RasterMatSource | undefined)[]): MaterialTable {
  if (entries.length > 127) throw new Error(`rigkit: material table has ${entries.length} slots (max 127)`);
  const out: (RasterMat | undefined)[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e) {
      out[i] = undefined;
      continue;
    }
    const m = rasterMat(e);
    if (!m.direct && m.th.length !== m.ramp.length - 1) throw new Error(`rigkit: material slot ${i}: th.length ${m.th.length} ≠ ramp.length − 1 (${m.ramp.length - 1})`);
    out[i] = m;
  }
  return Object.freeze(out);
}

function toneOf(m: RasterMat, i: number): number {
  let k = 0;
  while (k < m.th.length && i >= m.th[k]) k++;
  return k;
}

// ------------------------------------------------------------------ craft options

/**
 * Behaviour switches of the core. Every field defaults to the A2 behaviour; a new behaviour is
 * only ever added here as an opt-in (A3_MIMARI §3.6), so existing arts never change.
 */
export interface CraftOpts {
  /** despeckle passes after quantization (IŞ-4). A2: 2. */
  readonly despecklePasses?: 2;
  /** craft revision. A2: 1. */
  readonly v?: 1;
}
/** The A2 craft (the default of every Raster). */
export const CRAFT_A2: Required<CraftOpts> = Object.freeze({ despecklePasses: 2, v: 1 });

// ------------------------------------------------------------------ despeckle

/** An inclusive pixel box. */
export interface Box {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/**
 * Light quantization leaves crumbs along tone borders. A pixel with no 4-neighbour of its own
 * colour takes the colour its neighbours share most (4-neighbours weigh 2, diagonals 1), `passes`
 * times (stops early when nothing changes); a 1-px sliver at the silhouette (≤ 1 opaque
 * 4-neighbour) keeps its colour. `box` limits the pixels examined (default: the whole canvas).
 */
export function despeckle(c: PixelCanvas, passes = 2, box?: Box) {
  const W = c.w;
  const H = c.h;
  const bx0 = box?.x0 ?? 0;
  const by0 = box?.y0 ?? 0;
  const bx1 = box?.x1 ?? W - 1;
  const by1 = box?.y1 ?? H - 1;
  const d = c.data;
  const col = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return -1;
    const i = (y * W + x) * 4;
    return d[i + 3] ? (d[i] << 16) | (d[i + 1] << 8) | d[i + 2] : -1;
  };
  const vc = new Array<number>(8);
  const vw = new Array<number>(8);
  for (let pass = 0; pass < passes; pass++) {
    const fix: number[] = [];
    for (let y = by0; y <= by1; y++)
      for (let x = bx0; x <= bx1; x++) {
        const c0 = col(x, y);
        if (c0 < 0) continue;
        let same = false;
        let opaque4 = 0;
        let nv = 0;
        for (let dy = -1; dy <= 1 && !same; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const n = col(x + dx, y + dy);
            if (n < 0) continue;
            const four = !(dx && dy);
            if (four) opaque4++;
            if (n === c0) {
              if (four) {
                same = true;
                break;
              }
              continue;
            }
            const w = four ? 2 : 1;
            let k = 0;
            while (k < nv && vc[k] !== n) k++;
            if (k === nv) {
              vc[nv] = n;
              vw[nv++] = w;
            } else vw[k] += w;
          }
        if (same || nv === 0 || opaque4 <= 1) continue;
        let best = -1;
        let bv = 0;
        for (let k = 0; k < nv; k++) if (vw[k] > bv) [best, bv] = [vc[k], vw[k]];
        fix.push(x, y, best);
      }
    if (!fix.length) break;
    for (let i = 0; i < fix.length; i += 3) c.set(fix[i], fix[i + 1], fix[i + 2]);
  }
}

// ------------------------------------------------------------------ primitives' options

export interface PrimOpt {
  /** depth offset (the nearest surface wins) */
  readonly z?: number;
  /** constant intensity bias (direct materials: the ramp index) */
  readonly bias?: number;
  /** squash of the normal's z (higher = flatter, calmer planes) */
  readonly flat?: number;
}
export interface TubeOpt extends PrimOpt {
  /** extra bias per pixel: u along the tube 0…1, v across −1…1, (ox, oy) the normalised offset */
  readonly biasAt?: (u: number, v: number, ox: number, oy: number) => number;
}
/** A facet's bias: constant or per pixel. */
export type Bias = number | ((x: number, y: number) => number);

/** The flat, camera-facing normal. */
export const FLAT_N: V3 = Object.freeze([0, 0, 1]) as V3;

export interface RenderOpts {
  /** intensity shift of the whole layer (darker < 0 < lighter). Default 0. */
  readonly shift?: number;
  /** despeckle after quantizing (IŞ-4). Default true. */
  readonly speck?: boolean;
}

// ------------------------------------------------------------------ the G-buffer

export class Raster {
  readonly w: number;
  readonly h: number;
  readonly mats: MaterialTable;
  readonly craft: Required<CraftOpts>;
  /** the light render() and shard() use; reset(light) changes it (pooled rasters) */
  light: Light;
  readonly mat: Int8Array;
  readonly nx: Float32Array;
  readonly ny: Float32Array;
  readonly nz: Float32Array;
  readonly z: Float32Array;
  readonly bias: Float32Array;
  /** bounding box of the written pixels (render() only walks it) */
  x0: number;
  y0: number;
  x1 = -1;
  y1 = -1;

  constructor(w: number, h: number, light: Light, mats: MaterialTable, craft?: CraftOpts) {
    this.w = w;
    this.h = h;
    this.light = light;
    this.mats = mats;
    this.craft = { ...CRAFT_A2, ...craft };
    const n = w * h;
    this.mat = new Int8Array(n).fill(-1);
    this.nx = new Float32Array(n);
    this.ny = new Float32Array(n);
    this.nz = new Float32Array(n);
    this.z = new Float32Array(n).fill(-1e9);
    this.bias = new Float32Array(n);
    this.x0 = w;
    this.y0 = h;
  }

  /** Empty the buffer (and optionally switch the light) for the next part. */
  reset(light?: Light): this {
    if (light) this.light = light;
    this.mat.fill(-1);
    this.z.fill(-1e9);
    this.x0 = this.w;
    this.y0 = this.h;
    this.x1 = -1;
    this.y1 = -1;
    return this;
  }

  /** Write one surface pixel (kept only when nearer than what is there). */
  put(x: number, y: number, mat: MatRef, nx: number, ny: number, nz: number, z: number, bias = 0) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    if (z < this.z[i]) return;
    if (x < this.x0) this.x0 = x;
    if (x > this.x1) this.x1 = x;
    if (y < this.y0) this.y0 = y;
    if (y > this.y1) this.y1 = y;
    const m = Math.hypot(nx, ny, nz) || 1;
    this.mat[i] = mat;
    this.nx[i] = nx / m;
    this.ny[i] = ny / m;
    this.nz[i] = nz / m;
    this.z[i] = z;
    this.bias[i] = bias;
  }

  /**
   * Light + quantize into `into` (expected clear, of the raster's size), then despeckle so every
   * tone forms a calm cluster. Returns `into`.
   */
  render(into: PixelCanvas, o: RenderOpts = {}): PixelCanvas {
    const shift = o.shift ?? 0;
    const speck = o.speck ?? true;
    const W = this.w;
    const L = this.light.v;
    const lift = this.light.lift;
    const d = into.data;
    for (let y = this.y0; y <= this.y1; y++)
      for (let x = this.x0, i = y * W + this.x0; x <= this.x1; x++, i++) {
        const mi = this.mat[i];
        if (mi < 0) continue;
        const m = this.mats[mi];
        if (!m) throw new Error(`rigkit: material slot ${mi} is empty`);
        const I = this.nx[i] * L[0] + this.ny[i] * L[1] + this.nz[i] * L[2] + this.bias[i] + shift + lift;
        const k = m.direct ? clamp(Math.round(this.bias[i]), 0, m.ramp.length - 1) : toneOf(m, I);
        const c = m.ramp[k];
        const oi = i * 4;
        d[oi] = (c >> 16) & 255;
        d[oi + 1] = (c >> 8) & 255;
        d[oi + 2] = c & 255;
        d[oi + 3] = 255;
      }
    if (speck && this.x1 >= 0) despeckle(into, this.craft.despecklePasses, { x0: this.x0, y0: this.y0, x1: this.x1, y1: this.y1 });
    return into;
  }

  // ---------------------------------------------------------------- primitives

  /** Ellipsoid (rx, ry, rotated by ang radians) with dome normals. */
  ell(c: V, rx: number, ry: number, ang: number, mat: MatRef, o: PrimOpt = {}) {
    const cs = Math.cos(ang);
    const sn = Math.sin(ang);
    const R = Math.max(rx, ry) + 1;
    const z0 = o.z ?? 0;
    const flat = o.flat ?? 1;
    for (let y = Math.floor(c[1] - R); y <= Math.ceil(c[1] + R); y++) {
      for (let x = Math.floor(c[0] - R); x <= Math.ceil(c[0] + R); x++) {
        const dx = x + 0.5 - c[0];
        const dy = y + 0.5 - c[1];
        const lx_ = (dx * cs + dy * sn) / rx;
        const ly_ = (-dx * sn + dy * cs) / ry;
        const d2 = lx_ * lx_ + ly_ * ly_;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2);
        this.put(x, y, mat, lx_ * cs - ly_ * sn, lx_ * sn + ly_ * cs, nz * flat, z0 + nz * Math.min(rx, ry), o.bias ?? 0);
      }
    }
  }

  /** Tapered tube along a polyline with cylinder normals (cross-section v: −1 … 1 across). */
  tube(path: readonly V[], w0: number, w1: number, mat: MatRef, o: TubeOpt = {}) {
    if (path.length < 2) return;
    const lens = [0];
    for (let i = 1; i < path.length; i++) lens.push(lens[i - 1] + len(sub(path[i], path[i - 1])));
    const total = lens[lens.length - 1] || 1;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of path) {
      x0 = Math.min(x0, p[0]);
      y0 = Math.min(y0, p[1]);
      x1 = Math.max(x1, p[0]);
      y1 = Math.max(y1, p[1]);
    }
    const R = Math.max(w0, w1) / 2 + 1;
    const z0 = o.z ?? 0;
    const flat = o.flat ?? 1;
    for (let y = Math.floor(y0 - R); y <= Math.ceil(y1 + R); y++) {
      for (let x = Math.floor(x0 - R); x <= Math.ceil(x1 + R); x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        let best = Infinity;
        let bu = 0;
        let bqx = 0;
        let bqy = 0;
        let btx = 1;
        let bty = 0;
        for (let i = 1; i < path.length; i++) {
          const ax = path[i - 1][0];
          const ay = path[i - 1][1];
          const sx = path[i][0] - ax;
          const sy = path[i][1] - ay;
          const sl2 = sx * sx + sy * sy || 1;
          const t = clamp(((px - ax) * sx + (py - ay) * sy) / sl2, 0, 1);
          const qx = ax + sx * t;
          const qy = ay + sy * t;
          const d2 = (px - qx) * (px - qx) + (py - qy) * (py - qy);
          if (d2 < best) {
            best = d2;
            bu = lens[i - 1] + Math.sqrt(sl2) * t;
            bqx = qx;
            bqy = qy;
            const sl = Math.sqrt(sl2);
            btx = sx / sl;
            bty = sy / sl;
          }
        }
        const r = lerp(w0, w1, bu / total) / 2;
        const d = Math.sqrt(best);
        if (d > r) continue;
        const ox = (px - bqx) / Math.max(r, 0.5);
        const oy = (py - bqy) / Math.max(r, 0.5);
        const o2 = Math.min(1, ox * ox + oy * oy);
        const hz = Math.sqrt(1 - o2);
        const v = clamp(ox * -bty + oy * btx, -1, 1);
        const bias = (o.bias ?? 0) + (o.biasAt ? o.biasAt(bu / total, v, ox, oy) : 0);
        this.put(x, y, mat, ox, oy, hz * flat, z0 + hz * r, bias);
      }
    }
  }

  /** Flat polygon with one normal (a plate, a cell, a facet). */
  facet(pts: readonly V[], mat: MatRef, n: V3, z = 0, bias: Bias = 0) {
    fillPoly(pts, (x, y) => this.put(x, y, mat, n[0], n[1], n[2], z, typeof bias === 'number' ? bias : bias(x, y)));
  }

  /**
   * Faceted crystal shard, two values (for a direct material: bias 3 lit facet, 1 deep facet; the
   * facet facing the key light takes the bright one); `glow` ≥ 0.75 lifts both one step. Small
   * shards (length < 4.6) are one flat tone (two tones on a 3-pixel shard is just noise).
   */
  shard(base: V, dir: V, length: number, hw: number, mat: MatRef, z = 0, glow = 0) {
    const d = norm(dir);
    const p: V = [-d[1], d[0]];
    const tip = add(base, mul(d, length));
    const b0 = sub(base, mul(d, 2));
    const l = add(b0, mul(p, hw));
    const r = sub(b0, mul(p, hw));
    const up = glow >= 0.75 ? 1 : 0;
    if (length < 4.6) {
      this.facet([l, tip, r], mat, FLAT_N, z, 2 + up);
      return;
    }
    const sl = add(add(base, mul(p, hw * 0.85)), mul(d, length * 0.45));
    const sr = add(sub(base, mul(p, hw * 0.85)), mul(d, length * 0.45));
    const lit1 = dot(p, this.light.v2) > 0;
    this.facet([l, sl, tip, b0], mat, FLAT_N, z, (lit1 ? 3 : 1) + up);
    this.facet([b0, tip, sr, r], mat, FLAT_N, z, (lit1 ? 1 : 3) + up);
  }
}

// ------------------------------------------------------------------ the workspace (pools)

/**
 * Rasters and canvases of one frame size, recycled within a frame (allocation was the boot hot
 * spot). Owned by the caller — one per art, or one per frame — never by the core. begin() starts a
 * frame with its light; raster() / canvas() hand out cleared buffers until the next begin().
 */
export class Workspace {
  readonly w: number;
  readonly h: number;
  readonly mats: MaterialTable;
  readonly craft?: CraftOpts;
  private light: Light;
  private readonly rasters: Raster[] = [];
  private readonly canvases: PixelCanvas[] = [];
  private nextR = 0;
  private nextC = 0;

  constructor(w: number, h: number, light: Light, mats: MaterialTable, craft?: CraftOpts) {
    this.w = w;
    this.h = h;
    this.light = light;
    this.mats = mats;
    this.craft = craft;
  }

  /** Start a frame: every buffer is free again; `light` (when given) lights the new frame. */
  begin(light?: Light): this {
    if (light) this.light = light;
    this.nextR = 0;
    this.nextC = 0;
    return this;
  }

  /** The light of the current frame. */
  get frameLight(): Light {
    return this.light;
  }

  /** A cleared raster lit by the frame's light. */
  raster(): Raster {
    if (this.nextR >= this.rasters.length) this.rasters.push(new Raster(this.w, this.h, this.light, this.mats, this.craft));
    return this.rasters[this.nextR++].reset(this.light);
  }

  /** A cleared canvas of the frame size. */
  canvas(): PixelCanvas {
    if (this.nextC >= this.canvases.length) this.canvases.push(new PixelCanvas(this.w, this.h));
    return this.canvases[this.nextC++].clear();
  }

  /** Render a raster into a fresh pooled canvas. */
  render(r: Raster, o?: RenderOpts): PixelCanvas {
    return r.render(this.canvas(), o);
  }
}
