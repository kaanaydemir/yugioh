// Base for the title sub-screens (how to play, gallery, settings): a full-screen dim, a
// chamfered panel that unfolds from a bright scan line, a header, a close button and an
// "ESC" hint. Content is screen-space at depth OV_UI.
//
// Depth sandwich (so the real world-space VFX can be used inside the panels while the
// title camera rests at scroll 0,0):
//   arena tiles ≤ 34  <  OV_DIM 36  <  OV_BG 38  <  OV_FLOOR 39 (illustration tiles)
//   <  floor VFX 40..57 (circles, shockwaves)  <  units / VFX 100..1100  <  OV_UI (MENU 2300+)
// The title hides the arena's own floor-FX layer (40..49) while an overlay is open.

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { sfx } from '../../audio/sfx';
import { pixelText, upper } from '../../ui/text';
import { Button } from '../../view/Button';
import { DEPTH, GAME_H, GAME_W } from '../../view/layout';
import { GLOW_PAD, ICON, UI_RAMP, glowTex, panelTex, type UiStyle } from '../../view/ui-textures';
import { tween, wait } from '../../vfx/core';

export const OV_DIM = 36;
export const OV_BG = 38;
export const OV_FLOOR = 39;
export const OV_UI = DEPTH.MENU;

export const HEADER_H = 20;

export abstract class Overlay {
  readonly scene: Phaser.Scene;
  /** Screen-space UI container (depth OV_UI). */
  readonly root: Phaser.GameObjects.Container;
  /** Fired after close() finishes. */
  onClose: (() => void) | null = null;
  readonly px: number;
  readonly py: number;
  readonly pw: number;
  readonly ph: number;
  protected readonly style: UiStyle;
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly bg: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly scan: Phaser.GameObjects.Rectangle;
  private closeBtn: Button | null = null;
  private readonly owned: Phaser.GameObjects.GameObject[] = [];
  protected isOpen = false;
  private closing = false;

  constructor(scene: Phaser.Scene, w: number, h: number, title: string, style: UiStyle = 'neutral') {
    this.scene = scene;
    this.pw = w;
    this.ph = h;
    this.px = Math.round((GAME_W - w) / 2);
    this.py = Math.round((GAME_H - h) / 2);
    this.style = style;
    const R = UI_RAMP[style];
    this.dim = scene.add.rectangle(-8, -8, GAME_W + 16, GAME_H + 16, PAL.ink, 1).setOrigin(0).setScrollFactor(0).setDepth(OV_DIM).setAlpha(0);
    this.dim.setInteractive(); // swallow clicks meant for the arena
    this.glow = scene.add
      .image(this.px - GLOW_PAD, this.py - GLOW_PAD, glowTex(scene, w, h))
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(OV_BG - 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(R[2])
      .setAlpha(0);
    this.bg = scene.add
      .image(this.px, this.py + h / 2, panelTex(scene, style, w, h, { header: HEADER_H, alpha: 244 }))
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(OV_BG)
      .setScale(1, 0)
      .setVisible(false);
    this.scan = scene.add
      .rectangle(this.px + w / 2, this.py + h / 2, w, 2, PAL.white)
      .setScrollFactor(0)
      .setDepth(OV_UI + 50)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.root = scene.add.container(this.px, this.py).setScrollFactor(0).setDepth(OV_UI).setVisible(false);
    const head = pixelText(scene, 12, Math.round(HEADER_H / 2), upper(title), { size: 'md', originY: 0.5, color: PAL.white });
    head.setTint(R[4], R[4], R[3], R[3]);
    const hint = pixelText(scene, w - 34, Math.round(HEADER_H / 2), 'ESC', { size: 'sm', originX: 1, originY: 0.5, color: PAL.steel });
    this.root.add([head, hint]);
  }

  /** Track a world-space (or root-level) object so close() destroys it. */
  protected own<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.owned.push(o);
    return o;
  }

  /** Build the content (called once the panel has unfolded). */
  protected abstract build(): void | Promise<void>;
  /** Keyboard while open. Return true if handled. */
  abstract onKey(e: KeyboardEvent): boolean;
  /** Tear down timers / loops before the panel folds. */
  protected teardown(): void {}

  async open(): Promise<void> {
    const s = this.scene;
    this.isOpen = true;
    void tween(s, { targets: this.dim, alpha: 0.74, duration: 220, ease: 'Quad.Out' });
    this.scan.setVisible(true).setScale(0.05, 1).setAlpha(1);
    sfx.play('cardSlide', { volume: 0.45, pitch: 1.15 });
    await tween(s, { targets: this.scan, scaleX: 1, duration: 150, ease: 'Cubic.Out' });
    this.bg.setVisible(true);
    void tween(s, { targets: this.scan, alpha: 0, duration: 260 });
    void tween(s, { targets: this.glow, alpha: 0.45, duration: 300 });
    await tween(s, { targets: this.bg, scaleY: 1, duration: 210, ease: 'Cubic.Out' });
    this.root.setVisible(true).setAlpha(0);
    void tween(s, { targets: this.root, alpha: 1, duration: 140 });
    this.closeBtn = new Button(s, this.px + this.pw - 26, this.py + 2, { w: 22, h: 16, icon: ICON.close, style: 'neutral', depth: OV_UI + 10 });
    this.closeBtn.setScrollFactor(0, 0, true);
    this.closeBtn.onClick = () => void this.close();
    await this.build();
  }

  async close(): Promise<void> {
    if (!this.isOpen || this.closing) return;
    this.closing = true;
    const s = this.scene;
    sfx.play('uiBack', { volume: 0.7 });
    this.teardown();
    this.closeBtn?.destroy();
    this.closeBtn = null;
    await tween(s, { targets: this.root, alpha: 0, duration: 120 });
    for (const o of this.owned) if (o.active) o.destroy();
    this.owned.length = 0;
    void tween(s, { targets: this.glow, alpha: 0, duration: 200 });
    await tween(s, { targets: this.bg, scaleY: 0, duration: 180, ease: 'Cubic.In' });
    this.scan.setAlpha(1).setScale(1, 1);
    void tween(s, { targets: this.scan, scaleX: 0, alpha: 0, duration: 160, ease: 'Cubic.In' });
    await tween(s, { targets: this.dim, alpha: 0, duration: 200 });
    await wait(s, 10);
    this.root.destroy();
    this.bg.destroy();
    this.glow.destroy();
    this.dim.destroy();
    this.scan.destroy();
    this.isOpen = false;
    this.onClose?.();
  }

  get open_(): boolean {
    return this.isOpen && !this.closing;
  }
}

// ---------------------------------------------------------------- small widgets

/** A clickable screen-space hit zone at the scene root (depth OV_UI+1). */
export function hitZone(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.Zone {
  return scene.add
    .zone(Math.round(x), Math.round(y), w, h)
    .setOrigin(0)
    .setScrollFactor(0)
    .setDepth(OV_UI + 1)
    .setInteractive({ useHandCursor: true });
}

/** Key shortcut hint chip: [KEY] label (sm). Returns the container (screen-space). */
export function keyHint(scene: Phaser.Scene, x: number, y: number, key: string, label: string): Phaser.GameObjects.Container {
  const c = scene.add.container(Math.round(x), Math.round(y)).setScrollFactor(0);
  const k = pixelText(scene, 3, 0, key, { size: 'sm', originY: 0.5, color: PAL.white });
  const kw = Math.ceil(k.width) + 6;
  const bg = scene.add.image(0, -6, panelTex(scene, 'neutral', kw, 12, { chamfer: 2, scan: false })).setOrigin(0);
  const l = pixelText(scene, kw + 3, 0, upper(label), { size: 'sm', originY: 0.5, color: PAL.mist });
  c.add([bg, k, l]);
  c.setSize(kw + 3 + Math.ceil(l.width), 12);
  return c;
}
