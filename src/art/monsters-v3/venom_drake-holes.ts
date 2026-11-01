// Zehir Ejderi (venom_drake) — THE hole generator of the card (docs/v3/kart-a/venom_drake.md §4 death, §5.0).
// One mask for both stories so the attack and the death rhyme: the acid holes the glob eats into a victim
// (src/cinematics/kart-a/venom_drake-acid.ts) and the drake's own self-corrosion (venom_drake-rig.ts eatHoles)
// come from the same Voronoi web.
//   - the sites sit on a jittered brick grid (cell `CELL` px), seeded;
//   - the SEAM WEB is the set of pixels near a bisector of two sites (where the scales meet), its NODES the
//     pixels near a Voronoi vertex (three sites nearly equidistant);
//   - the holes eat each cell from its SITE outward: step 1 opens round holes (≥ 3 px) in some cells, step 2
//     opens every cell wider so the holes join, step 3 leaves only the web: a lace of 1–2 px strands.
// Pure and deterministic (no module state). Coordinates are in the caller's space (part space for the rig,
// the victim's frame for the overlay); `seed` decorrelates two users.

export const CELL = 8;

function h2(x: number, y: number, s: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export interface WebSample {
  /** distance to the nearest site */
  d1: number;
  /** distance to the second nearest site minus d1 (≈ 2 × the distance to the seam) */
  edge: number;
  /** d3 − d1 (small near a node) */
  node: number;
  /** the nearest site's hash (0…1): which cells open first */
  rank: number;
}

/** The web at (x, y): distances to the three nearest jittered sites. */
export function webAt(x: number, y: number, seed = 0): WebSample {
  const cx = Math.floor(x / CELL);
  const cy = Math.floor(y / CELL);
  let d1 = 1e9;
  let d2 = 1e9;
  let d3 = 1e9;
  let rank = 0;
  for (let j = cy - 1; j <= cy + 1; j++)
    for (let i = cx - 2; i <= cx + 1; i++) {
      const ox = (j & 1) * (CELL / 2);
      const sx = i * CELL + ox + 1.5 + h2(i, j, seed) * (CELL - 3);
      const sy = j * CELL + 1.5 + h2(i, j, seed + 7) * (CELL - 3);
      const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy);
      if (d < d1) {
        d3 = d2;
        d2 = d1;
        d1 = d;
        rank = h2(i, j, seed + 13);
      } else if (d < d2) {
        d3 = d2;
        d2 = d;
      } else if (d < d3) d3 = d;
    }
  return { d1, edge: d2 - d1, node: d3 - d1, rank };
}

/** Seam web strength at (x, y): 0 none · 1 seam · 2 node (a junction of three scales). */
export function seamAt(x: number, y: number, seed = 0): 0 | 1 | 2 {
  const w = webAt(x, y, seed);
  if (w.node < 1.7 && w.edge < 1.2) return 2;
  return w.edge < 0.9 ? 1 : 0;
}

/**
 * Is (x, y) eaten at `step` (0…3, fractional steps interpolate the radius)? `coverage` 0…1 scales how many
 * cells open (the victim's power: ≤ 6 / 10 / 12 % of the silhouette); the self-corrosion uses 1.
 */
export function holeAt(x: number, y: number, step: number, seed = 0, coverage = 1): boolean {
  if (step <= 0) return false;
  const w = webAt(x, y, seed);
  if (step >= 3) return w.edge > 2.2; // the lace: only the strands along the web remain
  const open = step < 2 ? 0.45 * coverage : (0.45 + 0.5 * (step - 1)) * coverage;
  if (w.rank > open) return false;
  const r = step < 2 ? 1.6 + (step - 1) * 1.2 : 2.8 + (step - 2) * 1.6;
  return w.d1 <= r;
}
