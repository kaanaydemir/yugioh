// HD Neon arena — texture upload helpers (browser only; the generators in raster.ts stay DOM/Phaser free).

import Phaser from 'phaser';
import { clamp01, toCanvas } from './raster';

/** Register a canvas as a static texture (replacing an older one). */
export function addTex(scene: Phaser.Scene, key: string, cv: HTMLCanvasElement, linear = false): Phaser.Textures.Texture {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const t = scene.textures.addImage(key, cv as unknown as HTMLImageElement)!;
  if (linear) t.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return t;
}

/** A soft (linear-filtered) texture drawn with an alpha function a(u, v) in 0..1 over a w×h canvas, white RGB. */
export function softTex(scene: Phaser.Scene, key: string, w: number, h: number, alpha: (x: number, y: number) => number, rgb?: (x: number, y: number) => number): Phaser.Textures.Texture {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const a = clamp01(alpha(x + 0.5, y + 0.5));
      if (a <= 0) continue;
      const o = (y * w + x) * 4;
      const c = rgb ? rgb(x + 0.5, y + 0.5) : 0xffffff;
      d[o] = (c >> 16) & 255;
      d[o + 1] = (c >> 8) & 255;
      d[o + 2] = c & 255;
      d[o + 3] = Math.round(a * 255);
    }
  return addTex(scene, key, toCanvas(d, w, h), true);
}

