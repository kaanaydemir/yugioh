// Kor Kurdu HD — the flames light the wolf's own fur. After a part is lit by the key light, every
// fur pixel that faces a nearby flame (its normal toward the flame, with distance falloff) is
// re-toned with the warm table (materials.ts WARM): faint → lit → hot. The result is a warm rim
// on the edges that face the paws, the mane and the tail plume, and cool charcoal everywhere
// else — the complementary contrast that makes a dark beast read on a night board.

import type { Part, V2 } from '../../render';
import { WARM } from './materials';

export interface FireLight {
  /** Light position (frame px) and height toward the viewer (px; − = behind the body). */
  p: V2;
  z: number;
  /** Falloff radius (px) and strength (~1). */
  r: number;
  k: number;
}

/** Thresholds of the three warm levels on the accumulated fire intensity. */
const LV = [0.2, 0.46, 0.8];

/** Queue the fire-light pass on a part (runs after its lighting, before compositing). */
export function fireLight(part: Part, lights: readonly FireLight[], gain = 1): void {
  if (!lights.length || gain <= 0) return;
  part.detail((d) => {
    const g = part.g;
    if (g.empty) return;
    const W = g.w;
    const x0 = g.x0;
    const y0 = g.y0;
    const bw = g.x1 - x0 + 1;
    const bh = g.y1 - y0 + 1;
    const lvl = new Int8Array(bw * bh);
    // smoothed normals (5×5 box inside the part): fur clumps keep their own bands under the key
    // light, but the warm light follows the big volume → clean rims instead of speckle
    const SN = 2;
    const sx = new Float32Array(bw * bh);
    const sy = new Float32Array(bw * bh);
    const sz = new Float32Array(bw * bh);
    for (let y = y0; y <= g.y1; y++)
      for (let x = x0; x <= g.x1; x++) {
        const i = y * W + x;
        if (g.mat[i] < 0) continue;
        let ax = 0;
        let ay = 0;
        let az = 0;
        for (let dy = -SN; dy <= SN; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= g.h) continue;
          for (let dx = -SN; dx <= SN; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= W) continue;
            const j = yy * W + xx;
            if (g.mat[j] < 0) continue;
            ax += g.nx[j];
            ay += g.ny[j];
            az += g.nz[j];
          }
        }
        // edge pixels keep more of their own normal (rims stay crisp)
        ax = ax * 0.6 + g.nx[i] * 4;
        ay = ay * 0.6 + g.ny[i] * 4;
        az = az * 0.6 + g.nz[i] * 4;
        const m = Math.hypot(ax, ay, az) || 1;
        const k = (y - y0) * bw + (x - x0);
        sx[k] = ax / m;
        sy[k] = ay / m;
        sz[k] = az / m;
      }
    for (let y = y0; y <= g.y1; y++)
      for (let x = x0; x <= g.x1; x++) {
        const i = y * W + x;
        if (g.mat[i] < 0) continue;
        const t = d.tone(x, y);
        if (t < 0) continue;
        const k = (y - y0) * bw + (x - x0);
        const nx = sx[k];
        const ny = sy[k];
        const nz = sz[k];
        let I = 0;
        for (const L of lights) {
          const dx = L.p[0] - (x + 0.5);
          const dy = L.p[1] - (y + 0.5);
          const dz = L.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
          if (dist >= L.r) continue;
          const ndl = (nx * dx + ny * dy + nz * dz) / dist;
          if (ndl <= 0) continue;
          const f = 1 - dist / L.r;
          I += L.k * ndl * f * (0.55 + 0.45 * f);
        }
        I *= gain;
        lvl[(y - y0) * bw + (x - x0)] = I >= LV[2] ? 3 : I >= LV[1] ? 2 : I >= LV[0] ? 1 : 0;
      }
    // no lonely warm pixels: a level with no 8-neighbour at ≥ that level drops one step
    for (let y = 0; y < bh; y++)
      for (let x = 0; x < bw; x++) {
        const v = lvl[y * bw + x];
        if (!v) continue;
        let ok = false;
        for (let dy = -1; dy <= 1 && !ok; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const sx = x + dx;
            const sy = y + dy;
            if (sx < 0 || sy < 0 || sx >= bw || sy >= bh) continue;
            if (lvl[sy * bw + sx] >= v) {
              ok = true;
              break;
            }
          }
        if (!ok) lvl[y * bw + x] = v - 1;
      }
    for (let y = 0; y < bh; y++)
      for (let x = 0; x < bw; x++) {
        const v = lvl[y * bw + x];
        if (!v) continue;
        const X = x + x0;
        const Y = y + y0;
        const m = d.material(X, Y);
        const t = d.tone(X, Y);
        if (!m || t < 0 || m.emissive) continue;
        const warm = WARM.get(m.ramp[t]);
        if (warm) d.set(X, Y, warm[v - 1]);
      }
  });
}
