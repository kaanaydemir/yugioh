// Kum Saati Cücesi v3 — the local paint kit: ramps, flat value planes cut from a shape by the frame's
// light, ASCII maps with tone runs that relight for P2, seams. (Copied/restyled from the sentinel /
// magus ideas; nothing in the shared rigkit is edited.)
//
// REHBER IŞ-3: every form is 2–4 FLAT value planes — no gradient, no dither, no bevel. A shape is
// drawn once in a marker colour and then cut row by row into lit | mid | shade runs measured from the
// shape's own edges: the lit run is on the light side (P1: left, P2 relit: right), so a relit sheet
// never has a "wrong way" plane (IŞ-2). A pixel with open air above it takes the lit tone one step up
// (a lit top edge), one with open air below it the shade tone one step down (the under-edge).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { seamFrom, stepDown, type SeamFn } from '../rigkit/composite';
import type { Light } from '../rigkit/light';

export interface Tones {
  readonly deep: number;
  readonly shade: number;
  readonly mid: number;
  readonly lit: number;
  readonly hi: number;
}

const T = (r: readonly number[]): Tones => Object.freeze({ deep: r[0], shade: r[1], mid: r[2], lit: r[3], hi: r[4] });

/** sky-blue cloth (robe, hat, sleeves) */
export const SKY: Tones = T([PAL.water0, PAL.water1, PAL.water2, PAL.water3, PAL.water4]);
/** gold (trim, hourglass frame, sand) */
export const GOLD: Tones = T([PAL.gold0, PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4]);
/** skin */
export const SKIN: Tones = T([PAL.skin0, PAL.skin1, PAL.skin2, PAL.skin3, PAL.skin4]);
/** the white beard */
export const BEARD: Tones = T([PAL.night4, PAL.steel, PAL.mist, PAL.white, PAL.white]);
/** leather (boots, belt) and wood (the staff's shaft) */
export const WOOD: Tones = T([PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4]);

const RAMPS: readonly (readonly number[])[] = [
  [PAL.water0, PAL.water1, PAL.water2, PAL.water3, PAL.water4],
  [PAL.gold0, PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4],
  [PAL.skin0, PAL.skin1, PAL.skin2, PAL.skin3, PAL.skin4],
  [PAL.night4, PAL.steel, PAL.mist, PAL.white],
  [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4],
];

const SEAM_T: Record<number, number> = {};
const CREASE_T: Record<number, number> = {};
for (const r of RAMPS) {
  Object.assign(SEAM_T, stepDown(r, 1, PAL.night0));
  Object.assign(CREASE_T, stepDown(r, 2, PAL.night0));
}
// IŞ-11 (≤ 20 colours a frame): a seam never goes below a ramp's shade tone — on the shade it is the outline ink
for (const r of RAMPS) {
  if (r.length < 5) continue;
  SEAM_T[r[1]] = PAL.ink;
  CREASE_T[r[1]] = PAL.ink;
  CREASE_T[r[2]] = r[1];
}
SEAM_T[PAL.white] = PAL.mist;
CREASE_T[PAL.white] = PAL.steel;
/** one step down the part's own ramp (the contact seam) */
export const SEAM: SeamFn = seamFrom(SEAM_T);
/** two steps down (a junction crease) */
export const CREASE: SeamFn = seamFrom(CREASE_T);

/** The ramp index of a colour (-1 when it is on none of the creature's ramps) and one step along it. */
export function stepOf(c: number, k: number): number {
  for (const r of RAMPS) {
    const i = r.indexOf(c);
    if (i >= 0) return r[Math.max(0, Math.min(r.length - 1, i + k))];
  }
  return c;
}

// ------------------------------------------------------------------ planes

const MK = 0xff00ff;
let scratch: PixelCanvas | null = null;
function scratchFor(w: number, h: number): PixelCanvas {
  if (!scratch || scratch.w !== w || scratch.h !== h) scratch = new PixelCanvas(w, h);
  else scratch.clear();
  return scratch;
}

export interface PlaneOpts {
  /** share of a run's width that is the lit plane (default 0.4) */
  lit?: number;
  /** share that is the shade plane (default 0.22) */
  shade?: number;
  /** a pixel with open air above takes the lit tone one step brighter (default true) */
  top?: boolean;
  /** a pixel with open air below takes a shade (default true) */
  under?: boolean;
  /** one tone only */
  flat?: keyof Tones;
  /** extra lit px forced at the light side of every run (a rim of the hi tone) */
  rim?: boolean;
}

/**
 * Draw a shape with `draw` (into a marker canvas) and lay it on `dst` as flat planes under `light`.
 * Returns nothing; pixels of `dst` outside the shape are untouched.
 */
export function plane(dst: PixelCanvas, light: Light, tones: Tones, draw: (m: PixelCanvas) => void, o: PlaneOpts = {}): void {
  const m = scratchFor(dst.w, dst.h);
  draw(m.clear());
  const litF = o.lit ?? 0.4;
  const shadeF = o.shade ?? 0.22;
  const top = o.top ?? true;
  const under = o.under ?? true;
  const flip = light.from === 'right';
  const mk = (x: number, y: number) => m.get(x, y) === MK;
  const grid = new Map<number, number>();
  const K = (x: number, y: number) => y * m.w + x;
  for (let y = 0; y < m.h; y++) {
    let x = 0;
    while (x < m.w) {
      if (!mk(x, y)) {
        x++;
        continue;
      }
      let x1 = x;
      while (x1 + 1 < m.w && mk(x1 + 1, y)) x1++;
      const n = x1 - x + 1;
      for (let xx = x; xx <= x1; xx++) {
        let t = n === 1 ? 0.5 : (xx - x) / (n - 1);
        if (flip) t = 1 - t;
        let tone: number;
        if (o.flat) tone = tones[o.flat];
        else if (n <= 2) tone = t < 0.5 ? tones.lit : tones.mid;
        else if (t < litF) tone = tones.lit;
        else if (t > 1 - shadeF) tone = tones.shade;
        else tone = tones.mid;
        if (!o.flat) {
          if (top && !mk(xx, y - 1) && tone === tones.mid) tone = tones.lit;
          else if (top && !mk(xx, y - 1) && tone === tones.lit && o.rim) tone = tones.hi;
          if (under && !mk(xx, y + 1) && tone === tones.lit && n > 2) tone = tones.mid;
          else if (under && !mk(xx, y + 1) && tone === tones.mid && n > 2) tone = tones.shade;
        }
        grid.set(K(xx, y), tone);
      }
      x = x1 + 1;
    }
  }
  // IŞ-4: no tone crumbs — a pixel none of whose 4 neighbours (inside the shape) shares its tone takes the
  // tone two or more of them share (two passes)
  if (!o.flat)
    for (let pass = 0; pass < 2; pass++) {
      const fix: [number, number][] = [];
      for (const [k, tone] of grid) {
        const x = k % m.w;
        const y = (k / m.w) | 0;
        const nb = [grid.get(K(x - 1, y)), grid.get(K(x + 1, y)), grid.get(K(x, y - 1)), grid.get(K(x, y + 1))].filter((v): v is number => v !== undefined);
        if (nb.length < 2 || nb.includes(tone)) continue;
        const cnt = new Map<number, number>();
        for (const v of nb) cnt.set(v, (cnt.get(v) ?? 0) + 1);
        let best = -1;
        let bc = 1;
        for (const [v, c] of cnt) if (c > bc) {
          best = v;
          bc = c;
        }
        if (best >= 0) fix.push([k, best]);
      }
      for (const [k, v] of fix) grid.set(k, v);
    }
  for (const [k, tone] of grid) dst.set(k % m.w, (k / m.w) | 0, tone);
}

/** Marker colour for shapes drawn inside a `plane` callback. */
export const MARK = MK;

// ------------------------------------------------------------------ ascii maps

export interface Map2 {
  /** rows; '.' and ' ' are empty */
  readonly rows: readonly string[];
  /** top-left in the part's rest frame */
  readonly ox: number;
  readonly oy: number;
}

/**
 * Relight a map for P2: in every row each contiguous run of TONE letters has its letters reversed
 * (left ↔ right), so the lit side moves to the other edge while the shape and every detail letter
 * stay where they are.
 */
export function relightRows(rows: readonly string[], tone: ReadonlySet<string>): string[] {
  return rows.map((row) => {
    const a = [...row];
    let i = 0;
    while (i < a.length) {
      if (!tone.has(a[i])) {
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < a.length && tone.has(a[j + 1])) j++;
      const seg = a.slice(i, j + 1).reverse();
      for (let k = 0; k < seg.length; k++) a[i + k] = seg[k];
      i = j + 1;
    }
    return a.join('');
  });
}

/** Stamp a letter map into `dst` at (x, y) with a colour key; empty chars are skipped. */
export function stampRows(dst: PixelCanvas, rows: readonly string[], key: Readonly<Record<string, number>>, x: number, y: number, flip = false): void {
  for (let j = 0; j < rows.length; j++)
    for (let i = 0; i < rows[j].length; i++) {
      const c = key[rows[j][i]];
      if (c !== undefined) dst.set(x + i, y + j, c);
    }
  void flip;
}

/** Integer hash → [0, 1) (cluster noise that rides the part, never crawls). */
export function hash(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export const rnd = (v: number): number => Math.round(v);
