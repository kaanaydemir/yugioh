// Neon Tower — shared helpers of the two hologram painters (owner B2; holo-dragon.ts, holo-magus.ts).
// Pure PixelCanvas code, no Phaser, no Math.random, no alpha. The hologram creatures are PAINTED here (not baked from the monster
// sprites): every part is a polygon cut into flat facets (a Voronoi cell per seed point, the seeds ride along with the part when it moves),
// every facet gets ONE tone of the ramp (a hard step, never a dither), the silhouette gets a bright 1-px rim that is whitest on the lit edges.

import type { PixelCanvas } from '../pixel';

/** A deterministic 0..1 hash of three integers. */
export function h3(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export type Pt = readonly [number, number];

/** Rotate p about c by a radians. */
export function rot(p: Pt, c: Pt, a: number): Pt {
  const s = Math.sin(a);
  const k = Math.cos(a);
  const dx = p[0] - c[0];
  const dy = p[1] - c[1];
  return [c[0] + dx * k - dy * s, c[1] + dx * s + dy * k];
}

/** Even-odd point-in-polygon test (pixel centres). */
export function inPoly(poly: readonly Pt[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Distance from p to the segment a-b. */
export function segDist(px: number, py: number, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2));
  return Math.hypot(px - (a[0] + dx * t), py - (a[1] + dy * t));
}

/** The label plane of a creature frame: per pixel a part-local facet id (>= 0) and a tone (0..5), or -1 for empty. */
export class Plane {
  readonly tone: Int8Array;
  readonly cell: Int32Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.tone = new Int8Array(w * h).fill(-1);
    this.cell = new Int32Array(w * h).fill(-1);
  }
  has(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.tone[y * this.w + x] >= 0;
  }
  at(x: number, y: number): number {
    return this.tone[y * this.w + x];
  }
  put(x: number, y: number, tone: number, cell = -1): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.tone[y * this.w + x] = tone;
    this.cell[y * this.w + x] = cell;
  }
}

export interface FacetPart {
  /** outline (already posed) */
  poly: readonly Pt[];
  /** facet seed points (already posed) */
  seeds: readonly Pt[];
  /** base tone of the part (0..4), the light adds -1.5 … +1.5 on top */
  base: number;
  /** light direction (unit-ish): facets whose seed lies towards it are brighter */
  light?: Pt;
  /** how strongly the light moves the tone (default 1.6) */
  gain?: number;
  /** salt of the per-facet jitter */
  salt: number;
  /** jitter amplitude in tones (default 0.9) */
  jitter?: number;
  /** lowest / highest tone a facet may take (default 0 / 4) */
  lo?: number;
  hi?: number;
  /** a wire line (one tone up) along this fraction of the facet borders (default 0.5) */
  wires?: number;
  /** id offset so the cells of different parts never match */
  idBase: number;
  /** extra tones for a facet by its seed (the travelling shimmer) */
  boost?: (s: Pt) => number;
  /** a 1-px contour of this tone where the part meets another part (separates overlapping limbs / head from the body) */
  sep?: number;
}

/** Paint one faceted part over the plane (later parts overwrite earlier ones). */
export function paintFacets(pl: Plane, p: FacetPart): void {
  const { poly, seeds } = p;
  if (!seeds.length) return;
  let cx = 0;
  let cy = 0;
  for (const s of seeds) {
    cx += s[0];
    cy += s[1];
  }
  cx /= seeds.length;
  cy /= seeds.length;
  let rad = 1;
  for (const s of seeds) rad = Math.max(rad, Math.hypot(s[0] - cx, s[1] - cy));
  const L = p.light ?? [-0.6, -0.8];
  const gain = p.gain ?? 1.6;
  const jit = p.jitter ?? 0.9;
  const lo = p.lo ?? 0;
  const hi = p.hi ?? 4;
  const tones = seeds.map((s, i) => {
    const lit = ((s[0] - cx) * L[0] + (s[1] - cy) * L[1]) / rad;
    const t = p.base + lit * gain + (h3(p.salt, i, 1) - 0.5) * 2 * jit;
    return Math.max(lo, Math.min(hi, Math.round(t))) + (p.boost ? p.boost(s) : 0);
  });
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const q of poly) {
    x0 = Math.min(x0, q[0]);
    y0 = Math.min(y0, q[1]);
    x1 = Math.max(x1, q[0]);
    y1 = Math.max(y1, q[1]);
  }
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(pl.h - 1, Math.ceil(y1)); y++)
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(pl.w - 1, Math.ceil(x1)); x++) {
      if (!inPoly(poly, x + 0.5, y + 0.5)) continue;
      let best = 0;
      let bd = Infinity;
      for (let i = 0; i < seeds.length; i++) {
        const d = (seeds[i][0] - x - 0.5) ** 2 + (seeds[i][1] - y - 0.5) ** 2;
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      pl.put(x, y, tones[best], p.idBase + best);
    }
  if (p.sep !== undefined) {
    const mineId = (c: number): boolean => c >= p.idBase && c < p.idBase + seeds.length;
    const mark: number[] = [];
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(pl.h - 1, Math.ceil(y1)); y++)
      for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(pl.w - 1, Math.ceil(x1)); x++) {
        if (!mineId(pl.cell[y * pl.w + x])) continue;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= pl.w || ny >= pl.h) continue;
          const n = pl.cell[ny * pl.w + nx];
          if (n >= 0 && !mineId(n)) {
            mark.push(y * pl.w + x);
            break;
          }
        }
      }
    for (const i of mark) pl.tone[i] = p.sep;
  }
  // wire lines on the facet borders: the pixel of the DARKER facet, one tone above the brighter one (so the border reads as a lit edge)
  const wires = p.wires ?? 0.5;
  if (wires <= 0) return;
  const mine = (c: number): boolean => c >= p.idBase && c < p.idBase + seeds.length;
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(pl.h - 1, Math.ceil(y1)); y++)
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(pl.w - 1, Math.ceil(x1)); x++) {
      const c = pl.cell[y * pl.w + x];
      if (!mine(c)) continue;
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= pl.w || ny >= pl.h) continue;
        const n = pl.cell[ny * pl.w + nx];
        if (!mine(n) || n === c) continue;
        if (h3(p.salt, Math.min(c, n), Math.max(c, n)) > wires) continue;
        const tc = pl.tone[y * pl.w + x];
        const tn = pl.tone[ny * pl.w + nx];
        const up = Math.min(hi + 1, Math.max(tc, tn) + 1);
        // the lit side of the border is the pixel of the brighter facet; draw the line on the darker one
        if (tc <= tn) pl.tone[y * pl.w + x] = up;
        else pl.tone[ny * pl.w + nx] = up;
      }
    }
}

/**
 * Turn a plane into pixels: ramp tones, the silhouette rim (white on the edges facing the top-left light, one tone down elsewhere) and a
 * deep inner line one pixel inside the rim on the shaded sides (it gives the rim its weight).
 */
export function renderPlane(pl: Plane, ramp: readonly number[], out: PixelCanvas, opts: { rimLit?: number; rimDark?: number; flipLight?: boolean } = {}): void {
  const rimLit = opts.rimLit ?? 5;
  const rimDark = opts.rimDark ?? 3;
  const fl = opts.flipLight ?? false;
  const { w, h } = pl;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!pl.has(x, y)) continue;
      const l = !pl.has(x - 1, y);
      const r = !pl.has(x + 1, y);
      const u = !pl.has(x, y - 1);
      const d = !pl.has(x, y + 1);
      let t = pl.at(x, y);
      if (l || r || u || d) {
        const lit = (fl ? r : l) || u;
        t = lit ? rimLit : rimDark;
      } else {
        // the pixel just inside a shaded edge sinks one tone: the rim stands out as a bright, clean line
        const inner = (fl ? !pl.has(x - 2, y) : !pl.has(x + 2, y)) || !pl.has(x, y + 2);
        if (inner && t > 1) t -= 1;
      }
      out.set(x, y, ramp[Math.max(0, Math.min(ramp.length - 1, t))]);
    }
}

/** Clean up lone pixels: a pixel whose four neighbours all share another tone takes that tone (kills speckle). */
export function despeckle(pl: Plane): void {
  const { w, h } = pl;
  const src = pl.tone.slice();
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (src[i] < 0) continue;
      const a = src[i - 1];
      const b = src[i + 1];
      const c = src[i - w];
      const d = src[i + w];
      if (a >= 0 && a === b && b === c && c === d && a !== src[i]) pl.tone[i] = a;
    }
}

/** The tube round a centre line (a tail, a bone, a limb): the outline polygon for widths w0 → w1. */
export function tube(pts: readonly Pt[], w0: number, w1: number): Pt[] {
  const left: Pt[] = [];
  const right: Pt[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    const w = (w0 + (w1 - w0) * (i / Math.max(1, n - 1))) / 2;
    left.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
    right.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  return left.concat(right.reverse());
}

/** Tone ramp index of a colour (or -1). */
function toneOf(ramp: readonly number[], c: number): number {
  return ramp.indexOf(c);
}

/**
 * The flicker's opacity step WITHOUT a dither mask: every body pixel sinks `level` tones down the ramp (the rim keeps its tone), so a dim
 * frame is the same crisp facets, just darker.
 */
export function dimTones(f: PixelCanvas, ramp: readonly number[], level: number): PixelCanvas {
  const out = f.clone();
  for (let y = 0; y < f.h; y++)
    for (let x = 0; x < f.w; x++) {
      if (!f.isOpaque(x, y)) continue;
      const edge = !f.isOpaque(x - 1, y) || !f.isOpaque(x + 1, y) || !f.isOpaque(x, y - 1) || !f.isOpaque(x, y + 1);
      if (edge) continue;
      const t = toneOf(ramp, f.get(x, y)!);
      if (t >= 0) out.set(x, y, ramp[Math.max(0, t - level)]);
    }
  return out;
}

/** The summon flash: every tone climbs two steps, the rim is white. */
export function flashTones(f: PixelCanvas, ramp: readonly number[]): PixelCanvas {
  const out = f.clone();
  for (let y = 0; y < f.h; y++)
    for (let x = 0; x < f.w; x++) {
      if (!f.isOpaque(x, y)) continue;
      const edge = !f.isOpaque(x - 1, y) || !f.isOpaque(x + 1, y) || !f.isOpaque(x, y - 1) || !f.isOpaque(x, y + 1);
      const t = toneOf(ramp, f.get(x, y)!);
      out.set(x, y, ramp[edge ? 5 : Math.min(5, Math.max(3, t + 2))]);
    }
  return out;
}
