// Button — chunky pixel button with hover / press / disabled states and micro-animations.
//
//   const b = new Button(scene, 500, 300, { w: 136, h: 26, label: 'SAVAŞ', icon: ICON.swords, style: 'fire' });
//   b.onClick = () => engine.enterBattle();
//   b.setEnabled(false);        // stone look; clicks buzz (uiError) and wiggle
//   b.setAttention(true);       // breathing glow + periodic light sweep ("press me")
//
// (x, y) is the TOP-LEFT corner. The button is a Container (depth/scrollFactor set by the
// caller or opts). Hover: face brightens, light sweep, outer glow, label lifts. Press: face
// drops onto its lip, label follows. Release: white flash + sparks, then onClick.

import Phaser from 'phaser';
import { PAL } from '../art/palette';
import { mix } from '../art/pixel';
import { sfx } from '../audio/sfx';
import { measureText, pixelText, type TextSize } from '../ui/text';
import { TEX } from '../vfx/core';
import { rootDepth } from './CardSprite';
import {
  BUTTON_PRESS,
  type ButtonState,
  GLOW_PAD,
  SHEEN_FRAMES,
  UI_RAMP,
  type UiStyle,
  buttonSheenTex,
  buttonTex,
  glowTex,
  silTex,
} from './ui-textures';

export interface ButtonOpts {
  w: number;
  h: number;
  label?: string;
  /** Icon texture key (see ICON in ui-textures). Drawn left of the label. */
  icon?: string;
  style?: UiStyle;
  /** Label size (default 'md'). */
  size?: TextSize;
  depth?: number;
  onClick?: () => void;
  /** Play UI sounds (default true). */
  sound?: boolean;
  /** Tooltip-ish secondary text under the label (small). Optional. */
  enabled?: boolean;
}

export class Button extends Phaser.GameObjects.Container {
  onClick: (() => void) | null;
  /** Fired on hover enter/leave (true/false). */
  onHover: ((on: boolean) => void) | null = null;
  readonly w: number;
  readonly h: number;
  private style: UiStyle;
  private readonly bg: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly sheen: Phaser.GameObjects.Image;
  private readonly flashImg: Phaser.GameObjects.Image;
  private readonly content: Phaser.GameObjects.Container;
  private label: Phaser.GameObjects.BitmapText | null = null;
  private icon: Phaser.GameObjects.Image | null = null;
  private labelText: string;
  private iconKey: string | null;
  private readonly size: TextSize;
  private readonly sound: boolean;
  private _enabled = true;
  private hovered = false;
  private pressed = false;
  private attention = false;
  private glowTween: Phaser.Tweens.Tween | null = null;
  private attentionEvent: Phaser.Time.TimerEvent | null = null;
  private sheenTween: Phaser.Tweens.Tween | null = null;
  private locked = false;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: ButtonOpts) {
    super(scene, Math.round(x), Math.round(y));
    this.w = Math.round(opts.w);
    this.h = Math.round(opts.h);
    this.style = opts.style ?? 'neutral';
    this.size = opts.size ?? 'md';
    this.sound = opts.sound ?? true;
    this.onClick = opts.onClick ?? null;
    this.labelText = opts.label ?? '';
    this.iconKey = opts.icon ?? null;

    this.glow = scene.add
      .image(-GLOW_PAD, -GLOW_PAD, glowTex(scene, this.w, this.h))
      .setOrigin(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    this.bg = scene.add.image(0, 0, buttonTex(scene, this.style, 'n', this.w, this.h)).setOrigin(0);
    this.sheen = scene.add
      .image(0, 0, buttonSheenTex(scene, this.w, this.h), 's:0')
      .setOrigin(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.content = scene.add.container(0, 0);
    this.flashImg = scene.add
      .image(0, 0, silTex(scene, this.w, this.h - BUTTON_PRESS))
      .setOrigin(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    this.add([this.glow, this.bg, this.sheen, this.content, this.flashImg]);
    this.buildContent();
    this.applyStyle();
    if (opts.depth !== undefined) this.setDepth(opts.depth);

    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on(Phaser.Input.Events.POINTER_OVER, () => this.setHover(true));
    this.bg.on(Phaser.Input.Events.POINTER_OUT, () => {
      this.setHover(false);
      if (this.pressed) this.setPressed(false);
    });
    this.bg.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) return;
      if (!this._enabled || this.locked) {
        if (this._enabled === false && !this.locked) this.buzz();
        return;
      }
      this.setPressed(true);
    });
    this.bg.on(Phaser.Input.Events.POINTER_UP, () => {
      if (!this.pressed) return;
      this.setPressed(false);
      this.fire();
    });
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.glowTween?.stop();
      this.sheenTween?.stop();
      this.attentionEvent?.remove();
    });
    scene.add.existing(this);
  }

  get enabled(): boolean {
    return this._enabled;
  }

  /** Enabled = clickable. Disabled buttons turn to stone and buzz when clicked. */
  setEnabled(b: boolean): this {
    if (b === this._enabled) return this;
    this._enabled = b;
    if (!b) {
      this.pressed = false;
      this.setAttention(false);
    }
    this.applyStyle();
    if (b) {
      // waking up: quick light sweep + flash
      this.playSheen();
      this.flashImg.setTint(UI_RAMP[this.style][4]).setAlpha(0.5);
      this.scene.tweens.add({ targets: this.flashImg, alpha: 0, duration: 220, ease: 'Quad.Out' });
    }
    return this;
  }

  /** Temporarily ignore input without changing the look (e.g. during cinematics). */
  setLocked(b: boolean): this {
    this.locked = b;
    if (b) {
      this.pressed = false;
      if (this.hovered) this.setHover(false);
    }
    this.applyStyle();
    return this;
  }

  setStyle(style: UiStyle): this {
    if (style === this.style) return this;
    this.style = style;
    this.applyStyle();
    return this;
  }

  setLabel(s: string): this {
    if (s === this.labelText) return this;
    this.labelText = s;
    this.buildContent();
    this.applyStyle();
    return this;
  }

  setIcon(key: string | null): this {
    if (key === this.iconKey) return this;
    this.iconKey = key;
    this.buildContent();
    this.applyStyle();
    return this;
  }

  /** "Press me": breathing outer glow and a light sweep every ~1.8 s. */
  setAttention(on: boolean): this {
    if (on && !this._enabled) on = false;
    if (on === this.attention) return this;
    this.attention = on;
    this.attentionEvent?.remove();
    this.attentionEvent = null;
    if (on) {
      this.attentionEvent = this.scene.time.addEvent({ delay: 1800, loop: true, callback: () => this.playSheen() });
      this.playSheen();
    }
    this.updateGlow();
    return this;
  }

  /** Programmatic click (keyboard shortcut): same feedback as a mouse click. */
  click(): void {
    if (!this._enabled || this.locked) {
      if (!this._enabled) this.buzz();
      return;
    }
    this.setPressed(true);
    this.scene.time.delayedCall(70, () => {
      this.setPressed(false);
      this.fire();
    });
  }

  // ------------------------------------------------------------ internals

  private buildContent(): void {
    this.content.removeAll(true);
    this.label = null;
    this.icon = null;
    const faceH = this.h - BUTTON_PRESS;
    const gap = this.labelText && this.iconKey ? 4 : 0;
    let iw = 0;
    let ih = 0;
    if (this.iconKey) {
      const f = this.scene.textures.getFrame(this.iconKey);
      iw = f?.width ?? 0;
      ih = f?.height ?? 0;
    }
    const m = this.labelText ? measureText(this.labelText, this.size) : { w: 0, h: 0 };
    // text boxes include accent room above the caps; center on the caps instead
    const capTop = this.size === 'sm' ? 4 : this.size === 'md' ? 4 : this.size === 'lg' ? 8 : 12;
    const capH = this.size === 'sm' ? 5 : this.size === 'md' ? 7 : this.size === 'lg' ? 14 : 21;
    const total = iw + gap + m.w;
    let x = Math.round((this.w - total) / 2);
    const cy = Math.floor(faceH / 2);
    if (this.iconKey) {
      this.icon = this.scene.add.image(x, Math.round(cy - ih / 2), this.iconKey).setOrigin(0);
      this.content.add(this.icon);
      x += iw + gap;
    }
    if (this.labelText) {
      const ty = Math.round(cy - capH / 2 - capTop);
      this.label = pixelText(this.scene, x, ty, this.labelText, { size: this.size });
      this.content.add(this.label);
    }
  }

  private visualState(): ButtonState {
    if (!this._enabled) return 'd';
    if (this.pressed) return 'p';
    if (this.hovered && !this.locked) return 'h';
    return 'n';
  }

  private applyStyle(): void {
    const st = this.visualState();
    this.bg.setTexture(buttonTex(this.scene, this.style, st, this.w, this.h));
    this.content.y = st === 'p' ? BUTTON_PRESS : st === 'h' ? -1 : 0;
    this.sheen.y = st === 'p' ? BUTTON_PRESS : 0;
    this.flashImg.y = st === 'p' ? BUTTON_PRESS : 0;
    const R = UI_RAMP[this.style];
    const textCol = st === 'd' ? PAL.stone3 : PAL.white;
    const iconCol = st === 'd' ? PAL.stone2 : st === 'h' ? PAL.white : mix(R[4], PAL.white, 0.4);
    this.label?.setTint(textCol);
    this.icon?.setTint(iconCol);
    this.glow.setTint(R[3]);
    this.bg.input && (this.bg.input.cursor = this._enabled && !this.locked ? 'pointer' : 'default');
    this.updateGlow();
  }

  private updateGlow(): void {
    this.glowTween?.stop();
    this.glowTween = null;
    const st = this.visualState();
    if (st === 'd') {
      this.scene.tweens.add({ targets: this.glow, alpha: 0, duration: 120 });
      return;
    }
    if (st === 'h' || st === 'p') {
      this.glowTween = this.scene.tweens.add({ targets: this.glow, alpha: 0.85, duration: 110, ease: 'Quad.Out' });
      return;
    }
    if (this.attention) {
      this.glow.setAlpha(Math.max(this.glow.alpha, 0.2));
      this.glowTween = this.scene.tweens.add({
        targets: this.glow,
        alpha: { from: 0.2, to: 0.75 },
        duration: 700,
        ease: 'Sine.InOut',
        yoyo: true,
        repeat: -1,
      });
      return;
    }
    this.glowTween = this.scene.tweens.add({ targets: this.glow, alpha: 0, duration: 160, ease: 'Quad.Out' });
  }

  private setHover(on: boolean): void {
    if (on === this.hovered) return;
    this.hovered = on;
    if (on && this._enabled && !this.locked) {
      if (this.sound) sfx.play('uiHover', { volume: 0.5 });
      this.playSheen();
    }
    this.onHover?.(on);
    this.applyStyle();
  }

  private setPressed(on: boolean): void {
    this.pressed = on;
    if (on && this.sound) sfx.play('uiClick', { volume: 0.6, pitch: 0.9 });
    this.applyStyle();
  }

  private playSheen(): void {
    if (!this.active) return;
    this.sheenTween?.stop();
    const o = { f: 0 };
    this.sheen.setVisible(true).setFrame('s:0');
    this.sheenTween = this.scene.tweens.add({
      targets: o,
      f: SHEEN_FRAMES - 1,
      duration: 340,
      ease: 'Sine.InOut',
      onUpdate: () => this.sheen.setFrame(`s:${Math.round(o.f)}`),
      onComplete: () => this.sheen.setVisible(false),
    });
  }

  private fire(): void {
    if (this.sound) sfx.play('uiConfirm', { volume: 0.7 });
    const R = UI_RAMP[this.style];
    this.flashImg.setTint(PAL.white).setAlpha(0.9);
    this.scene.tweens.add({ targets: this.flashImg, alpha: 0, duration: 200, ease: 'Quad.Out' });
    this.sparks(R[4]);
    this.onClick?.();
  }

  /** Tiny pixel sparks bursting off the button rim. */
  private sparks(color: number): void {
    const m = this.getWorldTransformMatrix();
    const ox = m.tx;
    const oy = m.ty;
    const depth = rootDepth(this) + 1;
    const n = 14;
    for (let i = 0; i < n; i++) {
      const top = i % 2 === 0;
      const x = ox + 3 + ((i * 37) % (this.w - 6));
      const y = oy + (top ? 1 : this.h - 2);
      const sp = this.scene.add
        .image(Math.round(x), Math.round(y), i % 5 === 0 ? TEX.plus : TEX.px1)
        .setTint(i % 3 === 0 ? PAL.white : color)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScrollFactor(0)
        .setDepth(depth);
      this.scene.tweens.add({
        targets: sp,
        y: y + (top ? -1 : 1) * (4 + ((i * 13) % 7)),
        x: x + (((i * 29) % 9) - 4),
        alpha: 0,
        duration: 220 + ((i * 41) % 160),
        ease: 'Cubic.Out',
        onComplete: () => sp.destroy(),
      });
    }
  }

  /** Disabled-click feedback: short horizontal wiggle + error blip. */
  private buzz(): void {
    if (this.sound) sfx.play('uiError', { volume: 0.5 });
    const x0 = this.x;
    const o = { t: 0 };
    this.scene.tweens.add({
      targets: o,
      t: 1,
      duration: 220,
      onUpdate: () => {
        this.x = x0 + Math.round(Math.sin(o.t * Math.PI * 6) * 2 * (1 - o.t));
      },
      onComplete: () => {
        this.x = x0;
      },
    });
  }
}
