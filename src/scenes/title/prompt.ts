// "BAŞLAMAK İÇİN TIKLA" — the click-to-start prompt: a lit gold plate with a breathing glow,
// the pulsing label, bouncing chevrons either side and a small "veya bir tuşa bas" line under it
// (so a first-time player knows the keyboard works too).

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { pixelText, upper } from '../../ui/text';
import { GLOW_PAD, ICON, glowTex, panelTex } from '../../view/ui-textures';
import { tween } from '../../vfx/core';

const PLATE_H = 21;

export class StartPrompt {
  readonly root: Phaser.GameObjects.Container;
  private readonly text: Phaser.GameObjects.BitmapText;
  private readonly sub: Phaser.GameObjects.BitmapText;
  private readonly caretL: Phaser.GameObjects.Image;
  private readonly caretR: Phaser.GameObjects.Image;
  private readonly plate: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
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
    subLabel = 'veya bir tuşa bas',
  ) {
    this.root = scene.add.container(Math.round(cx), Math.round(y)).setScrollFactor(0).setDepth(depth);
    this.text = pixelText(scene, 0, 0, upper(label), { size: 'md', align: 'center', originX: 0.5, originY: 0.5 });
    const w = Math.ceil(this.text.width) + 34;
    this.half = Math.ceil(w / 2);
    this.glow = scene.add
      .image(-this.half - GLOW_PAD, -Math.ceil(PLATE_H / 2) - GLOW_PAD, glowTex(scene, w, PLATE_H))
      .setOrigin(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(PAL.gold3)
      .setAlpha(0.4);
    this.plate = scene.add.image(-this.half, -Math.ceil(PLATE_H / 2), panelTex(scene, 'gold', w, PLATE_H, { alpha: 236 })).setOrigin(0);
    this.caretL = scene.add.image(-this.half - 10, 0, ICON.caret).setTint(PAL.cyan3);
    this.caretR = scene.add.image(this.half + 10, 0, ICON.caret).setTint(PAL.crim3).setFlipX(true);
    this.sub = pixelText(scene, 0, Math.ceil(PLATE_H / 2) + 8, upper(subLabel), { size: 'sm', align: 'center', originX: 0.5, originY: 0.5, color: PAL.mist });
    const subBg = scene.add.rectangle(0, this.sub.y, Math.ceil(this.sub.width) + 12, 9, PAL.ink, 0.6).setOrigin(0.5);
    this.root.add([this.glow, this.plate, subBg, this.sub, this.caretL, this.caretR, this.text]);
    this.root.setAlpha(0);
    this.onUpdate = (t) => this.update(t);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate));
  }

  async show(): Promise<void> {
    this.t0 = this.scene.time.now;
    this.live = true;
    this.root.setVisible(true);
    this.root.setScale(1, 0.1);
    await tween(this.scene, { targets: this.root, alpha: 1, scaleY: 1, duration: 220, ease: 'Back.Out' });
  }

  /** Confirm flash, then collapse. */
  async confirm(): Promise<void> {
    this.live = false;
    this.text.setTintFill(PAL.white);
    this.plate.setTintFill(PAL.gold4);
    this.glow.setAlpha(0.9);
    this.caretL.setX(-this.half - 4);
    this.caretR.setX(this.half + 4);
    await tween(this.scene, { targets: this.root, scaleX: 1.15, duration: 70, ease: 'Quad.Out' });
    this.text.setTint(PAL.white);
    this.plate.clearTint();
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
    // stepped pulse: pixel-art friendly bands; the label never drops below a readable level
    this.text.setAlpha(w > 0.3 ? 1 : 0.85);
    this.text.setTint(w > 0.85 ? PAL.white : PAL.gold4, w > 0.85 ? PAL.white : PAL.gold4, w > 0.5 ? PAL.gold4 : PAL.gold3, w > 0.5 ? PAL.gold4 : PAL.gold3);
    this.glow.setAlpha(w > 0.75 ? 0.75 : w > 0.4 ? 0.55 : 0.35);
    const b = Math.round(Math.abs(Math.sin(e * Math.PI * 1.6)) * 3);
    this.caretL.setX(-this.half - 11 + b);
    this.caretR.setX(this.half + 11 - b);
  }
}
