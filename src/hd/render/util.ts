// HD render — helpers for consumers of rendered frames: frame caching, a horizontally mirrored
// frame with the normal map's X inverted (for baking P2 sprites), and a CPU re-light preview of
// a normal map (debug sheets / tests — the game uses Phaser Light2D instead).

import { PixelCanvas } from '../../art/pixel';
import type { HDFrame } from '../contracts';
import type { V3 } from './math';

/**
 * Memoize a deterministic frame function: render(anim, frame) is computed once per key.
 * (The renderer itself reuses its buffers, so each call returns fresh canvases — cache them.)
 */
export function memoFrames<A extends string, F extends HDFrame>(fn: (anim: A, frame: number) => F): ((anim: A, frame: number) => F) & { clear(): void; size(): number } {
  const cache = new Map<string, F>();
  const f = ((anim: A, frame: number) => {
    const k = anim + ':' + frame;
    let v = cache.get(k);
    if (!v) {
      v = fn(anim, frame);
      cache.set(k, v);
    }
    return v;
  }) as ((anim: A, frame: number) => F) & { clear(): void; size(): number };
  f.clear = () => cache.clear();
  f.size = () => cache.size;
  return f;
}

/** Mirror a canvas horizontally; with `normal` the map's X channel is inverted too. */
export function flipCanvasX(src: PixelCanvas, normal = false): PixelCanvas {
  const out = new PixelCanvas(src.w, src.h);
  const s = src.data;
  const d = out.data;
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      const j = (y * src.w + (src.w - 1 - x)) * 4;
      d[j] = normal && s[i + 3] ? 255 - s[i] : s[i];
      d[j + 1] = s[i + 1];
      d[j + 2] = s[i + 2];
      d[j + 3] = s[i + 3];
    }
  return out;
}

/** Mirror a whole frame (color + normal map with X inverted). */
export function flipFrame(f: HDFrame): HDFrame {
  return { color: flipCanvasX(f.color), normal: flipCanvasX(f.normal, true) };
}

export interface PreviewLight {
  /** Light position in frame pixels; z = height toward the viewer (px). */
  pos: V3;
  color: number;
  /** Multiplier on the light's contribution (default 1). */
  intensity?: number;
  /** Falloff radius in px (default: infinite). */
  radius?: number;
}

/**
 * CPU preview of dynamic lighting: color × (ambient + Σ lambert(normal, light)). Matches the
 * spirit of Phaser Light2D (not its exact falloff). Emissive pixels (if a mask is given) stay
 * at full brightness. Use it to check that normals read correctly.
 */
export function relight(f: HDFrame, lights: readonly PreviewLight[], ambient: number = 0x2a2f55, emissive?: PixelCanvas): PixelCanvas {
  const out = new PixelCanvas(f.color.w, f.color.h);
  const c = f.color.data;
  const n = f.normal.data;
  const e = emissive?.data;
  const d = out.data;
  const ar = ((ambient >> 16) & 255) / 255;
  const ag = ((ambient >> 8) & 255) / 255;
  const ab = (ambient & 255) / 255;
  const W = f.color.w;
  for (let i = 0; i < W * f.color.h; i++) {
    const o = i * 4;
    if (!c[o + 3]) continue;
    const x = (i % W) + 0.5;
    const y = Math.floor(i / W) + 0.5;
    const nx = n[o] / 127.5 - 1;
    const ny = -(n[o + 1] / 127.5 - 1); // map is +Y up; screen is +Y down
    const nz = n[o + 2] / 127.5 - 1;
    let r = ar;
    let g = ag;
    let b = ab;
    for (const L of lights) {
      let lx = L.pos[0] - x;
      let ly = L.pos[1] - y;
      let lz = L.pos[2];
      const dist = Math.hypot(lx, ly, lz) || 1;
      lx /= dist;
      ly /= dist;
      lz /= dist;
      const k = Math.max(0, nx * lx + ny * ly + nz * lz) * (L.intensity ?? 1) * (L.radius ? Math.max(0, 1 - dist / L.radius) : 1);
      r += (((L.color >> 16) & 255) / 255) * k;
      g += (((L.color >> 8) & 255) / 255) * k;
      b += ((L.color & 255) / 255) * k;
    }
    const em = e ? e[o + 3] / 255 : 0;
    d[o] = Math.min(255, c[o] * (r + (1 - r) * em));
    d[o + 1] = Math.min(255, c[o + 1] * (g + (1 - g) * em));
    d[o + 2] = Math.min(255, c[o + 2] * (b + (1 - b) * em));
    d[o + 3] = c[o + 3];
  }
  return out;
}
