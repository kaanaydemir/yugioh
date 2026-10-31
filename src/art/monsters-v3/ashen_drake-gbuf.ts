// Kül Ejderi (ashen_drake) v3 — frame constants and the material table on the rigkit core
// (docs/v3/kart-a/ashen_drake.md §1.3, §3.1, §3.4). Everything is drawn with the ONE standard key
// light (rigkit lightOf: P1 from the top-left, P2 relit from the top-right); no private vector.
//
// Materials (G-buffer slots, src/art/rigkit/raster.ts):
//   HIDE   compressed ash hide / bone: stone0…stone3 on the ash thresholds (§3.4)
//   FAR    the far side's parts: the same ramp one step darker (draw.far)
//   BONE   bare bone (ribs, talon claws, the wrist spurs' shafts): a calmer, lighter cut of the ramp
//   SPINE  smoke spines (crest, spur tips): stone1 → void1 body, void2 tips (direct: bias = index)
// Cloak plates are flat facets toned by cloakTone() (the same light, a plate's own planes).

import { PAL } from '../palette';
import ASH from '../materials/defs/ash';
import { materialTable, seamOf, stepDown, seamFrom, type Light, type V3 } from '../rigkit';

export const W = 120;
export const H = 104;
/** anchor: the ground line between the gripping talons */
export const AX = 52;
export const GY = 99;

export const M = { HIDE: 0, FAR: 1, BONE: 2, SPINE: 3, CLOAK: 4 } as const;

export const MATS = materialTable([
  { ramp: ASH.draw.ramp, th: ASH.draw.th },
  { ramp: ASH.draw.far.ramp, th: ASH.draw.far.th },
  { ramp: [PAL.stone1, PAL.stone2, PAL.stone3], th: [-0.35, 0.42] },
  { ramp: [PAL.stone1, PAL.void1, PAL.void2], th: [], direct: true },
  { ramp: [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3], th: [-0.55, 0.05, 0.86] },
]);

/** contact seam / crease between parts: one / two steps down the ash ramp (ink below stone0) */
export const SEAM = seamOf(ASH);
export const CREASE = seamFrom({ ...stepDown(ASH.draw.ramp, 2), [PAL.void1]: PAL.ink, [PAL.void2]: PAL.void1 });

/** the cloak ramp: stone0 deep fold, stone1 plate shadow, stone2 lit plate, stone3 only the brightest lips */
export const CLOAK_RAMP: readonly number[] = [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3];
export const CLOAK_TH: readonly number[] = [-0.42, 0.12, 0.92];

/** Tone index of a cloak facet (normal n, bias b) under the frame's light. */
export function cloakTone(light: Light, n: V3, b: number): number {
  const m = Math.hypot(n[0], n[1], n[2]) || 1;
  const I = (n[0] * light.v[0] + n[1] * light.v[1] + n[2] * light.v[2]) / m + b + light.lift;
  let k = 0;
  while (k < CLOAK_TH.length && I >= CLOAK_TH[k]) k++;
  return k;
}

/** one step darker on the ash ramp (stone0 stays) */
export const darker = (c: number): number => (c === PAL.stone3 ? PAL.stone2 : c === PAL.stone2 ? PAL.stone1 : c === PAL.stone1 ? PAL.stone0 : c === PAL.stone4 ? PAL.stone3 : c);
export const isStone = (c: number | null): boolean => c === PAL.stone0 || c === PAL.stone1 || c === PAL.stone2 || c === PAL.stone3;
export const EMBER = new Set<number>([PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4, PAL.gold4, PAL.white]);

/** deterministic hash 0…1 */
export function hash(a: number, b = 0, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
