// rigkit / maps — hand-painted part maps (helmets, faces, emblems, plates) (A3_MIMARI §3.1;
// REHBER IŞ-2, IŞ-12).
//
// COPIED from the slice (abyss_magus-rig.ts stampMap, abyss_magus-maps.ts MAP_KEY / PartMap) and
// generalised: the key is a parameter, a MapPair carries the P1 (left) and P2 (right) paintings,
// and a ToneMap names ROLES (lit / mid / shadow / rim / emissive / ink) that a material resolves.
// Rigid parts are maps moved by whole pixels only (IŞ-12): `at` is floored.

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import type { V } from './geom';
import type { Light } from './light';

/** A map and where its top-left pixel sits relative to the part's anchor. '.' = empty, 'x' = cast shadow. */
export interface PartMap {
  readonly rows: readonly string[];
  readonly ox: number;
  readonly oy: number;
}
/** IŞ-2: the same part painted for each light (lit and shaded planes swapped plate by plate). */
export interface MapPair {
  readonly left: PartMap;
  readonly right: PartMap;
}
/** Tone roles: Lit plane, Mid plane, Shadow plane, Rim (bounce), Emissive, inK. */
export type ToneRole = 'L' | 'M' | 'S' | 'R' | 'E' | 'K';
/**
 * A map whose letters name tone roles (resolved from a material, see toneOfRole). It is painted for
 * the P1 light; under the other light its lit and shadow roles swap (IŞ-2's plate-by-plate swap),
 * the rest stay. Letters not in `roles` fall back to the stamp key.
 */
export interface ToneMap extends PartMap {
  readonly roles: Readonly<Record<string, ToneRole>>;
}

/** The slice's palette key (abyss_magus-maps.ts MAP_KEY). */
export const MAP_KEY_A2: Readonly<Record<string, number>> = Object.freeze({
  k: PAL.ink,
  '0': PAL.night0,
  '1': PAL.night1,
  '2': PAL.night2,
  '3': PAL.night3,
  '4': PAL.night4,
  s: PAL.steel,
  m: PAL.mist,
  w: PAL.white,
  a: PAL.void0,
  b: PAL.void1,
  c: PAL.void2,
  d: PAL.void3,
  e: PAL.void4,
  A: PAL.mag1,
  B: PAL.mag2,
  C: PAL.mag3,
  D: PAL.mag4,
});

/** What a ToneMap reads of a material (a src/art/materials MaterialDef fits structurally). */
export interface ToneSource {
  readonly draw: {
    readonly ramp: readonly number[];
    readonly rim: number | null;
    readonly emissive?: { readonly tones: readonly number[] };
  };
}

/**
 * The tone of a role on a material: L = the top of the ramp, M one below, S two below, R its rim
 * colour (else the ramp's darkest), E its first emissive tone (else the top), K ink.
 */
export function toneOfRole(m: ToneSource, role: ToneRole): number {
  const r = m.draw.ramp;
  const n = r.length;
  switch (role) {
    case 'L':
      return r[n - 1];
    case 'M':
      return r[Math.max(0, n - 2)];
    case 'S':
      return r[Math.max(0, n - 3)];
    case 'R':
      return m.draw.rim ?? r[0];
    case 'E':
      return m.draw.emissive?.tones[0] ?? r[n - 1];
    case 'K':
      return PAL.ink;
  }
}

const isPair = (m: PartMap | MapPair | ToneMap): m is MapPair => 'left' in m;
const isTone = (m: PartMap | ToneMap): m is ToneMap => 'roles' in m;

/** The map a light uses (a MapPair's painting for it; any other map as is). */
export function mapFor(m: PartMap | MapPair | ToneMap, light: Light): PartMap | ToneMap {
  return isPair(m) ? m[light.from] : m;
}

export interface StampOpts {
  /** letter → colour (default MAP_KEY_A2) */
  readonly key?: Readonly<Record<string, number>>;
}

/**
 * Draw a part map with its anchor at `at` (map origin = anchor + its offset). Returns the
 * cast-shadow pixels ('x') as a flat [x, y, …] list (paint them with PartComp.shadow once the parts
 * under them are down). A ToneMap needs `mat`.
 */
export function stamp(c: PixelCanvas, m: PartMap | MapPair | ToneMap, at: V, light: Light, mat?: ToneSource, o: StampOpts = {}): number[] {
  const map = mapFor(m, light);
  const key = o.key ?? MAP_KEY_A2;
  const tone = isTone(map) ? map : null;
  if (tone && !mat) throw new Error('rigkit: stamp() of a ToneMap needs a material');
  const swap = tone !== null && light.from === 'right';
  const cast: number[] = [];
  const x0 = Math.floor(at[0]) + map.ox;
  const y0 = Math.floor(at[1]) + map.oy;
  for (let j = 0; j < map.rows.length; j++) {
    const row = map.rows[j];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      if (ch === 'x') {
        cast.push(x0 + i, y0 + j);
        continue;
      }
      let col: number | undefined;
      const role = tone?.roles[ch];
      if (role !== undefined) col = toneOfRole(mat!, swap && role === 'L' ? 'S' : swap && role === 'S' ? 'L' : role);
      else col = key[ch];
      if (col !== undefined) c.set(x0 + i, y0 + j, col);
    }
  }
  return cast;
}
