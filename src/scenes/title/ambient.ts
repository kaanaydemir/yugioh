// Title ambience: drifting light motes (parallax with the camera drift) and the tagline.

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { mulberry32 } from '../../art/pixel';
import { pixelText, upper } from '../../ui/text';
import { TEX, tween } from '../../vfx/core';

interface Mote {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vy: number;
  vx: number;
  phase: number;
  speed: number;
  base: number;
}

const COLORS = [PAL.cyan3, PAL.cyan4, PAL.crim3, PAL.gold3, PAL.gold4, PAL.mag3, PAL.white];

/** Slowly rising, twinkling motes across the whole screen. */
export class Motes {
  private readonly motes: Mote[] = [];
  private readonly rnd = mulberry32(99);
  private readonly onUpdate: (t: number, dt: number) => void;
  private level = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    n = 46,
    depth = 1150,
  ) {
    for (let i = 0; i < n; i++) {
      const far = i % 3 !== 0;
      const img = scene.add
        .image(0, 0, far ? TEX.px1 : i % 7 === 0 ? TEX.plus : TEX.px2)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(COLORS[i % COLORS.length])
        .setScrollFactor(far ? 0.35 : 0.75)
        .setDepth(depth);
      const m: Mote = {
        img,
        x: this.rnd() * 700 - 30,
        y: this.rnd() * 400 - 20,
        vy: -(far ? 4 : 9) - this.rnd() * 6,
        vx: (this.rnd() - 0.5) * 3,
        phase: this.rnd() * Math.PI * 2,
        speed: 0.6 + this.rnd() * 1.6,
        base: far ? 0.45 : 0.8,
      };
      this.motes.push(m);
    }
    this.onUpdate = (_t, dt) => this.update(dt);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate));
  }

  /** Fade the whole field (0..1). */
  setLevel(v: number, ms = 400): void {
    void tween(this.scene, { targets: this, level: v, duration: ms });
  }

  private update(dt: number): void {
    const k = dt / 1000;
    for (const m of this.motes) {
      m.y += m.vy * k;
      m.x += (m.vx + Math.sin(m.phase) * 2) * k;
      m.phase += k * m.speed;
      if (m.y < -24) {
        m.y = 380 + this.rnd() * 20;
        m.x = this.rnd() * 700 - 30;
      }
      const tw = 0.5 + 0.5 * Math.sin(m.phase * 3.1);
      const a = m.base * this.level * (tw > 0.8 ? 1 : tw > 0.4 ? 0.6 : 0.25);
      m.img.setPosition(Math.round(m.x), Math.round(m.y)).setAlpha(a);
    }
  }
}

const LINE = 64;

/** "— İKİ KİŞİLİK HOLOGRAM KART DÜELLOSU —" under the logo: lines draw out, then the text types on. */
export class Tagline {
  readonly root: Phaser.GameObjects.Container;
  private readonly text: Phaser.GameObjects.BitmapText;
  private readonly left: Phaser.GameObjects.Rectangle;
  private readonly right: Phaser.GameObjects.Rectangle;
  private readonly gemL: Phaser.GameObjects.Image;
  private readonly gemR: Phaser.GameObjects.Image;
  private readonly half: number;

  constructor(
    private readonly scene: Phaser.Scene,
    cx: number,
    y: number,
    label = 'HOLOGRAM KART DÜELLOSU',
    depth = 2000,
  ) {
    this.root = scene.add.container(Math.round(cx), Math.round(y)).setScrollFactor(0).setDepth(depth);
    this.text = pixelText(scene, 0, 0, upper(label), { size: 'md', align: 'center', originX: 0.5, originY: 0.5 });
    this.text.setTint(PAL.gold4, PAL.gold4, PAL.gold2, PAL.gold2);
    this.half = Math.ceil(this.text.width / 2) + 8;
    this.left = scene.add.rectangle(-this.half, 0, LINE, 1, PAL.gold2).setOrigin(1, 0.5);
    this.right = scene.add.rectangle(this.half, 0, LINE, 1, PAL.gold2).setOrigin(0, 0.5);
    this.gemL = scene.add.image(-this.half + 3, 0, TEX.plus).setTint(PAL.gold4);
    this.gemR = scene.add.image(this.half - 3, 0, TEX.plus).setTint(PAL.gold4);
    this.root.add([this.left, this.right, this.gemL, this.gemR, this.text]);
    this.root.setAlpha(0);
  }

  async show(): Promise<void> {
    const s = this.scene;
    this.root.setAlpha(1);
    this.text.setAlpha(0);
    this.left.scaleX = 0;
    this.right.scaleX = 0;
    void tween(s, { targets: [this.left, this.right], scaleX: 1, duration: 420, ease: 'Cubic.Out' });
    await tween(s, { targets: this.text, alpha: 1, duration: 300, ease: 'Stepped', easeParams: [3] });
  }

  setVisible(b: boolean): void {
    this.root.setVisible(b);
  }
}
