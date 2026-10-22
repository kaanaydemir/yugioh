// rigkit / passes — shared names and hashes of the material death / revive passes (A3_MIMARI §2, §5).
//
// A pass works on a finished frame in PART space (the pattern rides the parts, never crawls). The
// crystal passes (cracks, drain, split, gather) are the wyrm's, the shadow pass (dissolve + motes)
// the magus'; crumble / reassemble (stone) arrive with the pilot (Y8).

/** Name of a death / revive pass (MaterialDef.death.pass / .revive). */
export type PassId = 'cracks' | 'drain' | 'split' | 'gather' | 'dissolve' | 'motes' | 'crumble' | 'reassemble' | (string & {});

/** The A3 pass names (the core's; a later pass adds its name here). */
export const PASS_IDS: readonly PassId[] = Object.freeze(['cracks', 'drain', 'split', 'gather', 'dissolve', 'motes']);
// 'motes' = the shadow revive's spiralling motes (motes.ts gatherMotes); the shadow death's rising
// motes are part of 'dissolve' (dissolvePass motes: true).

/** Integer hash → [0, 1) (abyss_magus-rig.ts hash2): cluster noise in part space. */
export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Index hash → [0, 1) (crystal_wyrm-rig.ts hash): per-fragment jitter. */
export function hashIdx(i: number, k: number): number {
  let h = (i * 374761393 + k * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
