// Texture helper of the Neon Tower layers: one idempotent registration point, used by the
// boot steps (src/boot/NN-arena-nt-<layer>.ts) and, as a fallback, by the layer itself.
// Records boot ms / bytes per layer for tools/texmem.mjs (window.__neon.ntArena).

import type Phaser from 'phaser';
import type { PixelCanvas } from '../../art/pixel';
import { canvasTexture } from '../../art/textures';

/** Build profile of the Neon Tower textures built so far (ms per layer, texture bytes / count). */
export const NT_BUILD: { ms: Record<string, number>; bytes: number; textures: number } = { ms: {}, bytes: 0, textures: 0 };

/** Register `paint()`'s canvas as texture `key` once (no-op when it exists). Returns the key. */
export function ensureNtTexture(scene: Phaser.Scene, layer: string, key: string, paint: () => PixelCanvas): string {
  if (scene.textures.exists(key)) return key;
  const t0 = performance.now();
  const pc = paint();
  canvasTexture(scene, key, pc);
  NT_BUILD.ms[layer] = Math.round((performance.now() - t0) * 10) / 10;
  NT_BUILD.bytes += pc.w * pc.h * 4;
  NT_BUILD.textures++;
  const neon = (globalThis as { __neon?: Record<string, unknown> }).__neon;
  if (neon) neon.ntArena = NT_BUILD;
  return key;
}
