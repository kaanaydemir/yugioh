// Şafak Kılıçları (dawn_swords), lane E — the caged monsters' COLD (used only by ./_dawn_e.ts).
//
// Round 4 (critic: "the frost speckle turns the caged units into noise"): the cold is a FLAT TONE-BAND RECOLOUR of
// each sprite's own pixels, never a speckle on the body. Every opaque pixel of the current frame is ranked by its
// luminance into five bands (pixel-weighted quantiles of that frame), and the ink outline is left alone:
//   - the COLD SWEEP (the beat): the whole body, top → `sweep` (0 … 1 of its height), drawn in the cold ramp
//     night3 | water1 | water2 | water3 | water4 — the monster turns into a blue, still-readable statue of itself;
//   - the LASTING cold (while the cage stands): only the darkest band is recoloured (→ night3): the shadows go cold,
//     every lit band stays the monster's own; plus a few frost pixels on its lowest row (every third column).
// The overlay follows the sprite's frame, position, flip and scale (a squash too). Whole pixels, palette tones.

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { frameRGBA } from '../../art/atlas';
import { Raster, onFrame } from '../../vfx/setpieces';

type Sprite = Phaser.GameObjects.Sprite;

const FULL = [PAL.night3, PAL.water1, PAL.water2, PAL.water3, PAL.water4] as const;
const LASTING_DARK = PAL.night3;

interface FrameInfo {
  data: Uint8ClampedArray;
  w: number;
  h: number;
  /** rgb → band (0 … 4), −1 for the ink outline. */
  band: Map<number, number>;
}

const frames = new Map<string, FrameInfo | null>();

function infoOf(s: Sprite): FrameInfo | null {
  const fr = s.frame;
  if (!fr) return null;
  const key = `${fr.texture.key}|${fr.name}`;
  if (frames.has(key)) return frames.get(key) ?? null;
  let data: Uint8ClampedArray | null = null;
  try {
    data = frameRGBA(fr);
  } catch {
    data = null;
  }
  if (!data) {
    frames.set(key, null);
    return null;
  }
  const w = fr.realWidth;
  const h = fr.realHeight;
  // pixel-weighted luminance quantiles of the non-ink pixels
  const count = new Map<number, number>();
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] === 0) continue;
    const rgb = (data[i * 4] << 16) | (data[i * 4 + 1] << 8) | data[i * 4 + 2];
    count.set(rgb, (count.get(rgb) ?? 0) + 1);
  }
  const lum = (c: number) => 0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255);
  const cols = [...count.keys()].filter((c) => lum(c) >= 22).sort((a, b) => lum(a) - lum(b));
  const total = cols.reduce((n, c) => n + (count.get(c) ?? 0), 0);
  const band = new Map<number, number>();
  let acc = 0;
  for (const c of cols) {
    const mid = (acc + (count.get(c) ?? 0) / 2) / Math.max(1, total);
    acc += count.get(c) ?? 0;
    band.set(c, mid < 0.2 ? 0 : mid < 0.45 ? 1 : mid < 0.7 ? 2 : mid < 0.9 ? 3 : 4);
  }
  for (const c of count.keys()) if (!band.has(c)) band.set(c, -1);
  const info = { data, w, h, band };
  frames.set(key, info);
  return info;
}

export class ColdSkin {
  private ras = new Map<Sprite, Raster>();
  private sweep = new Map<Sprite, number>();
  private stop: () => void;
  private gone = false;
  /** The lasting cold (dark band + feet frost) is on. */
  lasting = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly units: () => Sprite[],
  ) {
    this.stop = onFrame(scene, () => {
      if (this.gone) return false;
      this.frame();
      return true;
    });
  }

  /** The cold sweep of sprite `s`: the top `f` (0 … 1) of its body in the full cold ramp. */
  setSweep(s: Sprite, f: number): void {
    if (f <= 0) this.sweep.delete(s);
    else this.sweep.set(s, Math.min(1, f));
  }

  private frame(): void {
    const live = new Set(this.units().filter((s) => s.active && s.visible));
    for (const s of this.sweep.keys()) if (s.active && s.visible) live.add(s);
    for (const [s, r] of [...this.ras]) {
      if (!live.has(s)) {
        r.destroy();
        this.ras.delete(s);
      }
    }
    for (const s of live) {
      const sw = this.sweep.get(s) ?? 0;
      if (!this.lasting && sw <= 0) {
        this.ras.get(s)?.draw(() => undefined);
        continue;
      }
      const fi = infoOf(s);
      if (!fi) continue;
      const sx = s.scaleX || 1;
      const sy = s.scaleY || 1;
      const ox = s.x - s.originX * fi.w * sx;
      const oy = s.y - s.originY * fi.h * sy;
      const L = Math.floor(Math.min(ox, ox + fi.w * sx));
      const T = Math.floor(Math.min(oy, oy + fi.h * sy));
      const W = Math.ceil(Math.max(ox, ox + fi.w * sx)) - L;
      const H = Math.ceil(Math.max(oy, oy + fi.h * sy)) - T;
      let r = this.ras.get(s);
      if (!r || r.w < W + 2 || r.h < H + 2) {
        r?.destroy();
        r = new Raster(this.scene, L - 1, T - 1, W + 6, H + 6, s.depth + 0.01);
        this.ras.set(s, r);
      }
      r.moveTo(L - 1, T - 1);
      r.img.setDepth(s.depth + 0.01);
      const sample = (x: number, y: number): number => {
        let fx = Math.floor((x + 0.5 - ox) / sx);
        const fy = Math.floor((y + 0.5 - oy) / sy);
        if (s.flipX) fx = fi.w - 1 - fx;
        if (fx < 0 || fy < 0 || fx >= fi.w || fy >= fi.h) return -1;
        const i = (fy * fi.w + fx) * 4;
        if (fi.data[i + 3] === 0) return -1;
        return (fi.data[i] << 16) | (fi.data[i + 1] << 8) | fi.data[i + 2];
      };
      // the body's drawn extent (for the sweep line and the feet)
      let top = Infinity;
      let bottom = -Infinity;
      const low = new Map<number, number>();
      for (let y = T; y < T + H; y++)
        for (let x = L; x < L + W; x++) {
          if (sample(x, y) < 0) continue;
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
          low.set(x, Math.max(low.get(x) ?? -Infinity, y));
        }
      if (bottom < top) continue;
      const cut = top + Math.round((bottom - top + 1) * sw);
      r.draw((q) => {
        for (let y = T; y < T + H; y++)
          for (let x = L; x < L + W; x++) {
            const c = sample(x, y);
            if (c < 0) continue;
            const b = fi.band.get(c) ?? -1;
            if (b < 0) continue;
            if (y < cut) q.px(x, y, FULL[b]);
            else if (this.lasting && b === 0) q.px(x, y, LASTING_DARK);
          }
        if (this.lasting) for (const [x, y] of low) if (((x % 3) + 3) % 3 === 0 && y >= cut) q.px(x, y, PAL.water4);
      });
    }
  }

  destroy(): void {
    if (this.gone) return;
    this.gone = true;
    this.stop();
    for (const r of this.ras.values()) r.destroy();
    this.ras.clear();
    this.sweep.clear();
  }
}
