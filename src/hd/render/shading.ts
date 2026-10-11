// HD render — lighting + tone quantization for one part's G-buffer.
//
// Model (per pixel, then snapped to the material's palette ramp):
//   I = wrap-diffuse(n · key)            one baked key light from the top-left (+ toward viewer)
//     − ambient occlusion (depth creases inside the part)
//     + rim (optional baked bounce light on the shadow side)
//     + bias (author decals) + spec boost
//   tone = band(I^gamma)                  5–7 tones, no dithering
// then: specular glints (Blinn-Phong ≥ threshold → glint color), crystal edge light (brighter
// side of a facet edge +1), fur clump lines (−1 where a later clump overlaps), and a despeckle
// pass so every tone forms a clean cluster (no lonely pixels).
//
// The ambient term is "soft": it does not add light, it shapes the bands (wrap + gamma), so
// the darkest tone is a narrow navy/purple core shadow and most of the form sits in mid tones.

import { EMPTY, GBuffer } from './gbuffer';
import type { HDMaterial } from './materials';
import { type V3, clamp01, norm3 } from './math';

export interface LightRig {
  /** Unit direction TOWARD the key light (x right, y down, z toward viewer). */
  key: V3;
  /** Default diffuse wrap (0 = hard terminator). Materials may override. */
  wrap: number;
  /** Ambient-occlusion sample radius (px) and strength (intensity units). */
  aoRadius: number;
  aoStrength: number;
  /**
   * Optional baked rim light: adds intensity where the surface turns away from the viewer AND
   * faces `dir` (e.g. cool bounce from the arena below-right). Dynamic side lights are the app's
   * job (normal map); keep this subtle or off.
   */
  rim?: { dir: V3; strength: number; power?: number };
  /**
   * Reflected light from the ground / arena: lifts the core shadow on surfaces facing `dir`
   * (default: from below, slightly right), so shadow sides read as round instead of flat.
   */
  bounce?: { dir: V3; strength: number };
}

/** Key light from the top-left, slightly toward the viewer (the game's light direction). */
export const KEY_LIGHT: V3 = norm3([-0.5, -0.74, 0.46]);

export const DEFAULT_RIG: LightRig = {
  key: KEY_LIGHT,
  wrap: 0.3,
  aoRadius: 3,
  aoStrength: 0.45,
  bounce: { dir: norm3([0.35, 1, 0.15]), strength: 0.22 },
};

/** Tone value of a glint pixel (uses the material's spec color). */
export const GLINT = 120;
/** Tone value of an empty pixel in part tone buffers. */
export const NO_TONE = -100;

/** Precomputed per-material data for the hot loops. */
export interface MatInfo {
  m: HDMaterial;
  n: number;
  ramp: Int32Array;
  /** Tone boundaries in raw intensity space (gamma already folded in): tone = #(th ≤ I). */
  th: Float32Array;
  gamma: number;
  wrap: number;
  occ: number;
  spec: { power: number; min: number; color: number; nhGlint: number; nhBoost: number } | null;
  rim: boolean;
  transmit: number;
  emissive: boolean;
  edgeLight: boolean;
  clumpLines: boolean;
  despeckle: boolean;
  translucent: boolean;
}

export function matInfo(m: HDMaterial, rig: LightRig): MatInfo {
  const n = m.ramp.length;
  const gamma = m.gamma ?? 1;
  // I^gamma ≥ t  ⟺  I ≥ t^(1/gamma): fold the gamma into the thresholds (no pow per pixel)
  const base = m.thresholds ? Array.from(m.thresholds) : Array.from({ length: n - 1 }, (_, k) => (k + 1) / n);
  const th = Float32Array.from(base.map((t) => Math.pow(Math.max(0, t), 1 / gamma)));
  return {
    m,
    n,
    ramp: Int32Array.from(m.ramp),
    th,
    gamma,
    wrap: m.wrap ?? rig.wrap,
    occ: m.occlusion ?? 1,
    spec: m.spec
      ? {
          power: m.spec.power,
          min: m.spec.min,
          color: m.spec.color ?? m.ramp[m.ramp.length - 1],
          // (n·h)^power ≥ min  ⟺  n·h ≥ min^(1/power); below nhBoost the boost is negligible (< 0.02)
          nhGlint: Math.pow(m.spec.min, 1 / m.spec.power),
          nhBoost: Math.pow(0.02, 1 / m.spec.power),
        }
      : null,
    rim: m.rim ?? true,
    transmit: m.transmit ?? 0,
    emissive: !!m.emissive,
    edgeLight: !!m.edgeLight,
    clumpLines: !!m.clumpLines,
    despeckle: m.despeckle !== false,
    translucent: !!m.translucent,
  };
}

const AO_DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0.7071, 0.7071],
  [-0.7071, 0.7071],
  [0.7071, -0.7071],
  [-0.7071, -0.7071],
];

const aoCache = new Map<number, { dx: Int32Array; dy: Int32Array }>();
function aoOffsets(r: number) {
  let o = aoCache.get(r);
  if (!o) {
    o = { dx: Int32Array.from(AO_DIRS.map((d) => Math.round(d[0] * r))), dy: Int32Array.from(AO_DIRS.map((d) => Math.round(d[1] * r))) };
    aoCache.set(r, o);
  }
  return o;
}

/**
 * Light + quantize a part. Writes ramp indices (or GLINT) into `tone` for every covered pixel
 * of `g` (NO_TONE elsewhere inside the dirty box). `tmp` is scratch of the same size.
 */
export function shadePart(g: GBuffer, mats: MatInfo[], rig: LightRig, tone: Int8Array, tmp: Int8Array): void {
  if (g.empty) return;
  const W = g.w;
  const { x0, y0, x1, y1 } = g;
  const L = rig.key;
  // Blinn half vector between key light and viewer
  const H = norm3([L[0], L[1], L[2] + 1]);
  const aoR = rig.aoRadius;
  const aoS = rig.aoStrength;
  const rim = rig.rim;
  const rimDir = rim ? norm3(rim.dir) : null;
  const rimPow = rim?.power ?? 2;
  const gm = g.mat;
  const gz = g.z;
  const gH = g.h;
  const { dx: aoX, dy: aoY } = aoOffsets(aoR);
  const aoK = 1 / (aoR * 1.5);
  const L0 = L[0];
  const L1 = L[1];
  const L2 = L[2];
  const bnc = rig.bounce && rig.bounce.strength > 0 ? rig.bounce : null;
  const bd = bnc ? norm3(bnc.dir) : ([0, 0, 0] as const);
  const bx = bd[0];
  const by = bd[1];
  const bz = bd[2];
  const bs = bnc ? bnc.strength : 0;
  const Lxl = Math.hypot(L[0], L[1]) || 1;
  const Lxy0 = L[0] / Lxl;
  const Lxy1 = L[1] / Lxl;
  const H0 = H[0];
  const H1 = H[1];
  const H2 = H[2];

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      const mi = gm[i];
      if (mi === EMPTY) {
        tone[i] = NO_TONE;
        continue;
      }
      const M = mats[mi];
      const forced = g.tone[i];
      if (forced >= 0) {
        tone[i] = Math.min(M.n - 1, forced);
        continue;
      }
      if (M.emissive) {
        const h = clamp01(g.heat[i] + g.bias[i]);
        tone[i] = Math.min(M.n - 1, Math.floor(h * M.n));
        continue;
      }
      const nx = g.nx[i];
      const ny = g.ny[i];
      const nz = g.nz[i];
      const d = nx * L0 + ny * L1 + nz * L2;
      let I = (d + M.wrap) / (1 + M.wrap);
      if (I < 0) I = 0;
      // ambient occlusion from depth creases (only neighbours of this part count)
      if (aoS > 0 && M.occ > 0) {
        const zi = gz[i] + 0.6;
        let occ = 0;
        for (let k = 0; k < 8; k++) {
          const sx = x + aoX[k];
          const sy = y + aoY[k];
          if (sx < 0 || sy < 0 || sx >= W || sy >= gH) continue;
          const j = sy * W + sx;
          if (gm[j] === EMPTY) continue;
          const dz = gz[j] - zi;
          if (dz > 0) occ += dz * aoK < 1 ? dz * aoK : 1;
        }
        if (occ > 0) I -= occ * 0.125 * aoS * M.occ;
      }
      if (bnc && M.rim) {
        const f = nx * bx + ny * by + nz * bz;
        if (f > 0) I += f * bs;
      }
      if (M.transmit > 0) {
        // light exits through the far side of a clear solid: away from the key, near the rim
        const away = -(nx * Lxy0 + ny * Lxy1);
        if (away > 0) I += M.transmit * away * (1 - nz) * 1.6;
      }
      if (rimDir && M.rim) {
        const facing = nx * rimDir[0] + ny * rimDir[1] + nz * rimDir[2];
        if (facing > 0) I += Math.pow(1 - nz, rimPow) * facing * rim!.strength;
      }
      I += g.bias[i];
      const sp = M.spec;
      if (sp) {
        const nh = nx * H0 + ny * H1 + nz * H2;
        if (nh >= sp.nhGlint) {
          tone[i] = GLINT;
          continue;
        }
        if (nh > sp.nhBoost) I += Math.pow(nh, sp.power) * 0.35;
      }
      const th = M.th;
      let t = 0;
      while (t < th.length && I >= th[t]) t++;
      tone[i] = t;
    }
  }

  despeckle(g, mats, tone, tmp);

  // crystal / metal edge light: brighter side of a facet edge gets +1
  // fur clump lines: −1 where a later clump (higher id) overlaps this one
  tmp.fill(0, y0 * W, (y1 + 1) * W);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      const mi = gm[i];
      if (mi === EMPTY) continue;
      const M = mats[mi];
      if (!M.edgeLight && !M.clumpLines) continue;
      const t = tone[i];
      if (t === GLINT || g.tone[i] >= 0) continue;
      if (M.edgeLight) {
        const id = g.id[i];
        for (let k = 0; k < 4; k++) {
          const sx = x + (k === 0 ? 1 : k === 1 ? -1 : 0);
          const sy = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
          if (sx < 0 || sy < 0 || sx >= W || sy >= g.h) continue;
          const j = sy * W + sx;
          if (gm[j] !== mi || g.id[j] === id) continue;
          const tj = tone[j];
          if (tj !== GLINT && tj < t && t >= M.n / 2) {
            tmp[i] = 1;
            break;
          }
        }
      }
      if (M.clumpLines) {
        const id = g.id[i];
        for (let k = 0; k < 4; k++) {
          const sx = x + (k === 0 ? 1 : k === 1 ? -1 : 0);
          const sy = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
          if (sx < 0 || sy < 0 || sx >= W || sy >= g.h) continue;
          const j = sy * W + sx;
          if (gm[j] === EMPTY) continue;
          if (g.id[j] > id) {
            tmp[i] = -1;
            break;
          }
        }
      }
    }
  }
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      const d = tmp[i];
      if (!d) continue;
      const M = mats[gm[i]];
      tone[i] = Math.max(0, Math.min(M.n - 1, tone[i] + d));
    }
  }
}

/**
 * Quantization leaves lonely pixels along tone borders. Any pixel with no 8-neighbour of the
 * same (material, tone) takes the tone most of its same-material neighbours share
 * (4-neighbours weigh double). Two passes. Glints and forced tones are left alone.
 */
function despeckle(g: GBuffer, mats: MatInfo[], tone: Int8Array, tmp: Int8Array): void {
  const W = g.w;
  const { x0, y0, x1, y1 } = g;
  const gm = g.mat;
  const gH = g.h;
  const votes = new Int32Array(16);
  for (let pass = 0; pass < 2; pass++) {
    let changed = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x;
        tmp[i] = tone[i];
        const mi = gm[i];
        if (mi === EMPTY) continue;
        const t = tone[i];
        if (t === GLINT || g.tone[i] >= 0 || !mats[mi].despeckle) continue;
        // fast path: any 8-neighbour of the same material and tone?
        let same = false;
        for (let dy = -1; dy <= 1 && !same; dy++) {
          const sy = y + dy;
          if (sy < 0 || sy >= gH) continue;
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const sx = x + dx;
            if (sx < 0 || sx >= W) continue;
            const j = sy * W + sx;
            if (gm[j] === mi && tone[j] === t) {
              same = true;
              break;
            }
          }
        }
        if (same) continue;
        votes.fill(0);
        let any = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const sx = x + dx;
            const sy = y + dy;
            if (sx < 0 || sy < 0 || sx >= W || sy >= gH) continue;
            const j = sy * W + sx;
            if (gm[j] !== mi) continue;
            const tj = tone[j];
            if (tj < 0 || tj >= 16) continue;
            votes[tj] += dx && dy ? 1 : 2;
            any = true;
          }
        }
        if (!any) continue;
        let best = t;
        let bv = 0;
        for (let k = 0; k < 16; k++)
          if (votes[k] > bv) {
            bv = votes[k];
            best = k;
          }
        tmp[i] = best;
        changed++;
      }
    }
    for (let y = y0; y <= y1; y++) {
      const a = y * W + x0;
      tone.set(tmp.subarray(a, y * W + x1 + 1), a);
    }
    if (!changed) break;
  }
}
