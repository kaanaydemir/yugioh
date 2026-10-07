// "BAŞLAMAK İÇİN TIKLA" — the pulsing click-to-start prompt with bouncing chevrons.

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { pixelText, upper } from '../../ui/text';
import { ICON } from '../../view/ui-textures';
import { tween } from '../../vfx/core';

export class StartPrompt {
  readonly root: Phaser.GameObjects.Container;
  private readonly text: Phaser.GameObjects.BitmapText;
  private readonly caretL: Phaser.GameObjects.Image;
  private readonly caretR: Phaser.GameObjects.Image;
  private readonly bar: Phaser.GameObjects.Rectangle;
  private readonly onUpdate: (t: number) => void;
  private t0 = 0;
  private live = false;
  private readonly half: number;

  constructor(
    private readonly scene: Phaser.Scene,
    cx: number,
    y: number,
    label = 'Başlamak için tıkla',
    depth = 2000,
  ) {
    this.root = scene.add.container(Math.round(cx), Math.round(y)).setScrollFactor(0).setDepth(depth);
    this.text = pixelText(scene, 0, 0, upper(label), { size: 'md', align: 'center', originX: 0.5, originY: 0.5 });
    this.half = Math.ceil(this.text.width / 2);
    this.bar = scene.add.rectangle(0, 0, this.text.width + 40, 13, PAL.ink, 0.55).setOrigin(0.5);
    this.caretL = scene.add.image(-this.half - 12, 0, ICON.caret).setTint(PAL.cyan3);
    this.caretR = scene.add.image(this.half + 12, 0, ICON.caret).setTint(PAL.crim3).setFlipX(true);
    this.root.add([this.bar, this.caretL, this.caretR, this.text]);
    this.root.setAlpha(0);
    this.onUpdate = (t) => this.update(t);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate));
  }

  async show(): Promise<void> {
    this.t0 = this.scene.time.now;
    this.live = true;
    this.root.setScale(1, 0.1);
    await tween(this.scene, { targets: this.root, alpha: 1, scaleY: 1, duration: 220, ease: 'Back.Out' });
  }

  /** Confirm flash, then collapse. */
  async confirm(): Promise<void> {
    this.live = false;
    this.text.setTintFill(PAL.white);
    this.caretL.setX(-this.half - 6);
    this.caretR.setX(this.half + 6);
    await tween(this.scene, { targets: this.root, scaleX: 1.15, duration: 70, ease: 'Quad.Out' });
    this.text.setTint(PAL.white);
    await tween(this.scene, { targets: this.root, scaleX: 1.4, scaleY: 0, alpha: 0, duration: 180, ease: 'Quad.In' });
    this.root.setVisible(false);
  }

  hide(): void {
    this.live = false;
    this.root.setVisible(false);
  }

  private update(t: number): void {
    if (!this.live) return;
    const e = (t - this.t0) / 1000;
    const w = 0.5 + 0.5 * Math.sin(e * Math.PI * 1.6);
    // stepped pulse: pixel-art friendly alpha bands
    const a = w > 0.75 ? 1 : w > 0.45 ? 0.8 : w > 0.2 ? 0.6 : 0.45;
    this.text.setAlpha(a);
    this.text.setTint(w > 0.85 ? PAL.white : PAL.gold4, w > 0.85 ? PAL.white : PAL.gold4, PAL.gold3, PAL.gold3);
    const b = Math.round(Math.abs(Math.sin(e * Math.PI * 1.6)) * 3);
    this.caretL.setX(-this.half - 13 + b);
    this.caretR.setX(this.half + 13 - b);
  }
}
