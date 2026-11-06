// Talih Zarı (lucky_die) — the "+N00" of the roll, pinned to ITS monster (critic round 1: the shared impact number rose
// 18 px and stacked upward, so on a crowded caster row it ended on the OPPONENT's monsters and outlived the scene).
//
//   boostNumber(scene, x, y, 600, { delay })   // pops at (x, y), rises ≤ 3 px, gone after LIFE ms; resolves at the end
//
// Same digit sheets as every number (fx:num:*, built by buildNumberTextures): one white flash frame, then the GOLD
// "buff" sheet (the die's colour). Whole pixels: two frames one size up (2×), then 1×; a 4-px hop that settles back,
// a tiny float, a stepped fade (alpha 1 → .6 → .3). Runs on scene time (the show's tempo), so the scene can await it
// and hand control back only once every number is gone.

import type Phaser from 'phaser';
import { DEPTH } from '../../view/layout';
import { buildNumberTextures } from '../../vfx/numbers';
import { onFrame } from '../../vfx/setpieces';

/** Whole life of a number (scene ms). */
export const NUMBER_LIFE = 900;
const BIG_MS = 34;
const FLASH_MS = 50;

/** Glyph cell widths of the digit sheet (frame width − 3, as numbers.ts lays them out). */
function widthOf(scene: Phaser.Scene, ch: string): number {
  return Math.max(1, (scene.textures.getFrame('fx:num:buff', ch)?.width ?? 8) - 3);
}

/** Pixel width of "+amount" on the digit sheet (for collision checks). */
export function numberWidth(scene: Phaser.Scene, amount: number): number {
  buildNumberTextures(scene);
  const text = '+' + String(Math.abs(Math.round(amount)));
  return [...text].reduce((a, ch) => a + widthOf(scene, ch) + 1, 0) + 2;
}

export function boostNumber(scene: Phaser.Scene, x: number, y: number, amount: number, o: { rise?: number; life?: number; depth?: number } = {}): Promise<void> {
  buildNumberTextures(scene);
  const life = o.life ?? NUMBER_LIFE;
  const rise = Math.max(0, Math.min(3, o.rise ?? 3));
  const text = '+' + String(Math.abs(Math.round(amount)));
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const c = scene.add.container(x0, y0).setDepth(o.depth ?? DEPTH.FX_TOP + 50);
  const widths = [...text].map((ch) => widthOf(scene, ch));
  const total = widths.reduce((a, w) => a + w + 1, 0) - 1;
  let gx = -Math.floor(total / 2);
  const gs = [...text].map((ch, i) => {
    const w = widths[i];
    const cx = gx + (w + 3) / 2 - 1;
    gx += w + 1;
    const img = scene.add.image(Math.round(cx), 0, 'fx:num:flash', ch).setOrigin(0.5, 0.5);
    c.add(img);
    return { img, ch };
  });
  let swapped = false;
  return new Promise<void>((resolve) => {
    const draw = (el: number) => {
      if (!swapped && el > FLASH_MS) {
        swapped = true;
        for (const g of gs) g.img.setTexture('fx:num:buff', g.ch);
      }
      c.setScale(el < BIG_MS ? 2 : 1);
      // a 4-px hop that lands back 1 px over its start, then the small float
      const hop = el < 180 ? Math.round(Math.sin((el / 180) * Math.PI) * 4) : 0;
      const drift = Math.round(Math.min(1, el / life) * rise);
      c.setPosition(x0, y0 - hop - drift);
      const fadeAt = life - 200;
      c.setAlpha(el < fadeAt ? 1 : el < fadeAt + 100 ? 0.6 : 0.3);
    };
    draw(0);
    onFrame(scene, (_dt, el) => {
      if (!c.active) {
        resolve();
        return false;
      }
      if (el >= life) {
        c.destroy();
        resolve();
        return false;
      }
      draw(el);
      return true;
    });
  });
}
