// CounterBadge — the little round counter on the tile of a continuous spell (Şafak Kılıçları): 3 / 2 / 1.
//
//   (3)  a 9×9 plate, ink outline, a dawn ring, the digit from the 3×5 card font. The ring and the digit warm
//        from gold (3) to orange (2) to crimson (1): the last turn of the lock reads at a glance. A new value
//        punches the plate (scale overshoot, whole-pixel positions). Drawn in a tiny PixelCanvas, palette only.
// Lives at DEPTH.FX - 19 (just over the stat badges); FieldView owns one per counted spell/trap tile.

import Phaser from 'phaser';
import { PAL } from '../art/palette';
import { PixelCanvas } from '../art/pixel';
import { drawDigits } from '../art/cards';
import { DEPTH } from '../view/layout';
import { tween } from '../vfx/core';

let badgeSeq = 0;

export const COUNTER_BADGE_DEPTH = DEPTH.FX - 19;

/** Ring / digit tones of a count: gold → orange → crimson as the lock runs out. */
function tones(v: number): { ring: number; lit: number; digit: number } {
  if (v <= 1) return { ring: PAL.crim2, lit: PAL.crim3, digit: PAL.crim4 };
  if (v === 2) return { ring: PAL.fire2, lit: PAL.fire3, digit: PAL.fire4 };
  return { ring: PAL.gold2, lit: PAL.gold3, digit: PAL.gold4 };
}

/** The 9×9 plate for `value` (exported for the dev preview / tests). */
export function counterBadgeCanvas(value: number): PixelCanvas {
  const p = new PixelCanvas(9, 9);
  const t = tones(value);
  p.disc(4.5, 4.5, 4.6, PAL.ink);
  p.disc(4.5, 4.5, 3.7, t.ring);
  p.disc(4.5, 4.5, 2.8, PAL.night0);
  p.set(2, 1, t.lit).set(3, 1, t.lit).set(1, 2, t.lit).set(1, 3, t.lit); // the lit upper-left edge of the ring
  drawDigits(p, 3, 2, String(Math.max(0, Math.min(9, value))), t.digit);
  return p;
}

export class CounterBadge {
  readonly scene: Phaser.Scene;
  readonly image: Phaser.GameObjects.Image;
  private readonly key: string;
  private tex: Phaser.Textures.CanvasTexture | null = null;
  private value: number;
  private token = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, value: number) {
    this.scene = scene;
    this.value = value;
    this.key = `duel:counter:${++badgeSeq}`;
    this.image = scene.add.image(Math.round(x), Math.round(y), '__DEFAULT').setDepth(COUNTER_BADGE_DEPTH);
    this.render();
  }

  get shown(): number {
    return this.value;
  }

  moveTo(x: number, y: number): void {
    this.image.setPosition(Math.round(x), Math.round(y));
  }

  /** Show `value`; a change punches the plate (animate) — the digit changes at the top of the punch. */
  async set(value: number, animate = true): Promise<void> {
    if (value === this.value) return;
    const token = ++this.token;
    if (!animate || !this.image.active || !this.image.visible) {
      this.value = value;
      this.render();
      return;
    }
    await tween(this.scene, { targets: this.image, scale: 1.4, duration: 90, ease: 'Quad.Out' });
    if (token !== this.token || !this.image.active) return;
    this.value = value;
    this.render();
    await tween(this.scene, { targets: this.image, scale: 1, duration: 160, ease: 'Back.Out' });
  }

  destroy(): void {
    this.token++;
    if (this.image.active) {
      this.scene.tweens.killTweensOf(this.image);
      this.image.destroy();
    }
    if (this.tex) {
      this.tex.destroy();
      this.tex = null;
    }
  }

  private render(): void {
    if (!this.image.active) return;
    const canvas = counterBadgeCanvas(this.value).toCanvas();
    if (!this.tex) {
      if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
      this.tex = this.scene.textures.createCanvas(this.key, 9, 9);
      if (!this.tex) return;
      this.image.setTexture(this.key);
    }
    const ctx = this.tex.getContext();
    ctx.clearRect(0, 0, 9, 9);
    ctx.drawImage(canvas, 0, 0);
    this.tex.refresh();
    this.image.setSize(9, 9);
  }
}
