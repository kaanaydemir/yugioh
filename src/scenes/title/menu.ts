// Main menu: a neon list on a chamfered panel. Mouse (hover selects, click activates) and
// keyboard (↑↓/W S, Enter/Space, 1–6). The selection bar glides between rows and recolours
// to the item's style; the description line under the list types on.

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { PixelCanvas, mix } from '../../art/pixel';
import { sfx } from '../../audio/sfx';
import { pixelText, revealText, upper } from '../../ui/text';
import { GLOW_PAD, ICON, UI_RAMP, glowTex, panelTex, type UiStyle } from '../../view/ui-textures';
import { TEX, tween, tweenValue, wait } from '../../vfx/core';

export interface MenuEntry {
  id: string;
  label: string;
  desc: string;
  icon: string;
  style: UiStyle;
}

const ROW_H = 24;
const HEADER = 20;

function barTex(scene: Phaser.Scene, style: UiStyle, w: number, h: number): string {
  const key = `title:menubar:${style}:${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const R = UI_RAMP[style];
  const p = new PixelCanvas(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const left = Math.floor((h - 1 - y) / 2);
      const right = w - 1 - Math.floor(y / 2);
      if (x < left || x > right) continue;
      const t = x / w;
      const lvl = Math.round((1 - t) * 16);
      if (!PixelCanvas.ditherAt(x, y, Math.min(16, lvl + 2))) continue;
      let c = mix(R[1], PAL.night1, 0.2 + t * 0.5);
      if (y === 0) c = mix(R[3], R[1], t);
      else if (y === h - 1) c = mix(R[0], PAL.ink, 0.3);
      else if (y === 1) c = mix(R[2], R[1], t);
      if (x - left < 3) c = x - left < 2 ? R[4] : R[3];
      p.set(x, y, c, Math.round(240 - t * 90));
    }
  scene.textures.addCanvas(key, p.toCanvas());
  return key;
}

interface Row {
  entry: MenuEntry;
  y: number;
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.BitmapText;
  num: Phaser.GameObjects.BitmapText;
  zone: Phaser.GameObjects.Zone;
}

export class MainMenu {
  readonly root: Phaser.GameObjects.Container;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Called with the entry id when an item is activated. */
  onSelect: ((id: string) => void) | null = null;
  index = 0;
  private readonly scene: Phaser.Scene;
  private readonly rows: Row[] = [];
  private readonly panel: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly bar: Phaser.GameObjects.Image;
  private readonly barFlash: Phaser.GameObjects.Image;
  private readonly caret: Phaser.GameObjects.Image;
  private readonly desc: Phaser.GameObjects.BitmapText;
  private readonly header: Phaser.GameObjects.BitmapText;
  private readonly sep: Phaser.GameObjects.Rectangle;
  private enabled = false;
  private shown = false;
  private busy = false;
  private pressed = -1;
  private caretT = 0;
  private readonly onUpdate: (t: number, dt: number) => void;
  private descGen = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, entries: MenuEntry[], opts: { w?: number; depth?: number; title?: string } = {}) {
    this.scene = scene;
    this.x = Math.round(x);
    this.y = Math.round(y);
    this.w = opts.w ?? 214;
    const listH = entries.length * ROW_H + 6;
    this.h = HEADER + listH + 34;
    const depth = opts.depth ?? 2010;
    this.root = scene.add.container(this.x, this.y).setScrollFactor(0).setDepth(depth);
    this.glow = scene.add
      .image(-GLOW_PAD, -GLOW_PAD, glowTex(scene, this.w, this.h))
      .setOrigin(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(PAL.cyan2)
      .setAlpha(0.35);
    this.panel = scene.add.image(0, 0, panelTex(scene, 'neutral', this.w, this.h, { header: HEADER, alpha: 226 })).setOrigin(0);
    this.header = pixelText(scene, 12, Math.round(HEADER / 2), upper(opts.title ?? 'Ana Menü'), { size: 'md', originY: 0.5, color: PAL.mist });
    const gem = scene.add.image(this.w - 14, Math.round(HEADER / 2), TEX.spark).setTint(PAL.gold3);
    this.bar = scene.add.image(4, 0, barTex(scene, entries[0]?.style ?? 'p1', this.w - 8, ROW_H - 4)).setOrigin(0);
    this.barFlash = scene.add.image(4, 0, barTex(scene, 'neutral', this.w - 8, ROW_H - 4)).setOrigin(0).setTintFill(PAL.white).setAlpha(0);
    this.caret = scene.add.image(10, 0, ICON.caret).setTint(PAL.white);
    this.root.add([this.glow, this.panel, this.header, gem, this.bar, this.barFlash, this.caret]);

    entries.forEach((entry, i) => {
      const ry = HEADER + 4 + i * ROW_H + (i >= 3 ? 4 : 0);
      const cy = ry + Math.floor((ROW_H - 4) / 2);
      const icon = scene.add.image(28, cy, entry.icon).setTint(PAL.steel);
      const label = pixelText(scene, 40, cy, upper(entry.label), { size: 'md', originY: 0.5, color: PAL.mist });
      const num = pixelText(scene, this.w - 12, cy, String(i + 1), { size: 'sm', originX: 1, originY: 0.5, color: PAL.night4 });
      const zone = scene.add
        .zone(this.x + 4, this.y + ry, this.w - 8, ROW_H - 2)
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(depth + 1)
        .setInteractive({ useHandCursor: true });
      zone.on(Phaser.Input.Events.POINTER_OVER, () => {
        if (!this.enabled) return;
        this.select(i, true);
      });
      zone.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
        if (!this.enabled || p.rightButtonDown()) return;
        this.select(i, false);
        this.pressed = i;
        sfx.play('uiClick', { volume: 0.6, pitch: 0.9 });
        this.layout();
      });
      zone.on(Phaser.Input.Events.POINTER_UP, () => {
        if (!this.enabled || this.pressed !== i) return;
        this.pressed = -1;
        void this.activate();
      });
      zone.on(Phaser.Input.Events.POINTER_OUT, () => {
        if (this.pressed === i) {
          this.pressed = -1;
          this.layout();
        }
      });
      this.root.add([icon, label, num]);
      this.rows.push({ entry, y: ry, icon, label, num, zone });
    });
    const sepY = HEADER + 4 + 3 * ROW_H + 1;
    this.sep = scene.add.rectangle(14, sepY, this.w - 28, 1, PAL.night4).setOrigin(0);
    this.root.add(this.sep);
    this.desc = pixelText(scene, 12, this.h - 27, '', { size: 'sm', color: PAL.mist, maxWidth: this.w - 24 });
    this.root.add(this.desc);
    const descLine = scene.add.rectangle(10, this.h - 31, this.w - 20, 1, PAL.night3).setOrigin(0);
    this.root.add(descLine);

    this.root.setVisible(false);
    this.setZones(false);
    this.onUpdate = (_t, dt) => this.update(dt);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate));
    this.layout(true);
  }

  get visible(): boolean {
    return this.shown;
  }

  private setZones(on: boolean): void {
    for (const r of this.rows) {
      if (r.zone.input) r.zone.input.enabled = on;
    }
  }

  setEnabled(b: boolean): void {
    this.enabled = b;
    this.setZones(b);
    if (!b) this.pressed = -1;
  }

  // ------------------------------------------------------------ selection

  /** Move the selection by d rows (wraps). */
  move(d: number): void {
    if (!this.enabled) return;
    const n = this.rows.length;
    this.select((this.index + d + n) % n, true);
  }

  select(i: number, sound: boolean): void {
    if (i === this.index) return;
    this.index = i;
    if (sound) sfx.play('uiHover', { volume: 0.55 });
    this.layout();
    this.updateDesc();
  }

  private barY(i: number): number {
    return this.rows[i].y;
  }

  private layout(instant = false): void {
    const i = this.index;
    const row = this.rows[i];
    if (!row) return;
    const R = UI_RAMP[row.entry.style];
    const by = this.barY(i) + (this.pressed === i ? 1 : 0);
    this.bar.setTexture(barTex(this.scene, row.entry.style, this.w - 8, ROW_H - 4));
    this.glow.setTint(R[2]);
    if (instant) this.bar.y = by;
    else {
      this.scene.tweens.killTweensOf(this.bar);
      void tween(this.scene, { targets: this.bar, y: by, duration: 110, ease: 'Cubic.Out' });
    }
    this.rows.forEach((r, k) => {
      const sel = k === i;
      this.scene.tweens.killTweensOf(r.label);
      const tx = sel ? (this.pressed === k ? 46 : 44) : 40;
      if (instant) r.label.x = tx;
      else void tween(this.scene, { targets: r.label, x: tx, duration: 110, ease: 'Cubic.Out' });
      r.label.setTint(sel ? PAL.white : PAL.mist);
      r.icon.setTint(sel ? UI_RAMP[r.entry.style][4] : PAL.steel);
      r.icon.x = sel ? 30 : 28;
      r.num.setTint(sel ? R[3] : PAL.night4);
    });
  }

  /** Type the selected entry's description on (a newer selection cancels an older one). */
  private updateDesc(): void {
    const gen = ++this.descGen;
    const row = this.rows[this.index];
    this.desc.setText(row.entry.desc);
    const total = revealText(this.desc, 0);
    void tweenValue(this.scene, 0, total, (total / 260) * 1000, (v) => {
      if (gen === this.descGen && this.desc.active) revealText(this.desc, Math.floor(v + 1));
    }).then(() => {
      if (gen === this.descGen && this.desc.active) revealText(this.desc, Infinity);
    });
  }

  private update(dt: number): void {
    if (!this.shown) return;
    this.caretT += dt;
    const row = this.rows[this.index];
    if (!row) return;
    const b = Math.floor(this.caretT / 180) % 3;
    this.caret.setPosition(12 + (b === 1 ? 1 : 0), this.bar.y + Math.floor((ROW_H - 4) / 2));
    this.caret.setAlpha(this.bar.alpha <= 0 ? 0 : this.caretT % 900 < 700 ? 1 : 0.35);
  }

  // ------------------------------------------------------------ activation

  async activate(): Promise<void> {
    if (!this.enabled || this.busy) return;
    this.busy = true;
    const row = this.rows[this.index];
    const R = UI_RAMP[row.entry.style];
    sfx.play('uiConfirm', { volume: 0.75 });
    this.sparks(R[4]);
    this.barFlash.y = this.bar.y;
    this.barFlash.setAlpha(0.95);
    row.label.setTintFill(PAL.white);
    void tween(this.scene, { targets: this.barFlash, alpha: 0, duration: 260, ease: 'Quad.Out' });
    await wait(this.scene, 90);
    row.label.setTint(PAL.white);
    this.busy = false;
    this.onSelect?.(row.entry.id);
  }

  private sparks(color: number): void {
    const s = this.scene;
    const y0 = this.y + this.bar.y + (ROW_H - 4) / 2;
    for (let i = 0; i < 16; i++) {
      const x = this.x + 8 + ((i * 41) % (this.w - 16));
      const top = i % 2 === 0;
      const y = y0 + (top ? -9 : 9);
      const sp = s.add
        .image(Math.round(x), Math.round(y), i % 5 === 0 ? TEX.plus : TEX.px1)
        .setTint(i % 3 === 0 ? PAL.white : color)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScrollFactor(0)
        .setDepth(this.root.depth + 2);
      void tween(s, {
        targets: sp,
        y: y + (top ? -1 : 1) * (4 + ((i * 13) % 8)),
        x: x + (((i * 29) % 9) - 4),
        alpha: 0,
        duration: 240 + ((i * 37) % 160),
        ease: 'Cubic.Out',
      }).then(() => sp.destroy());
    }
  }

  // ------------------------------------------------------------ show / hide

  async show(): Promise<void> {
    const s = this.scene;
    this.shown = true;
    this.root.setVisible(true).setAlpha(1);
    this.root.x = this.x;
    this.panel.setScale(1, 0.04);
    this.glow.setAlpha(0);
    const kids = [this.header, this.bar, this.caret, this.sep, this.desc, ...this.rows.flatMap((r) => [r.icon, r.label, r.num])];
    for (const k of kids) (k as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0);
    sfx.play('cardSlide', { volume: 0.4, pitch: 1.3 });
    await tween(s, { targets: this.panel, scaleY: 1, duration: 200, ease: 'Cubic.Out' });
    void tween(s, { targets: this.glow, alpha: 0.35, duration: 300 });
    this.header.setAlpha(1);
    this.sep.setAlpha(1);
    this.rows.forEach((r, i) => {
      for (const o of [r.icon, r.label, r.num]) {
        const x1 = o.x;
        o.x = x1 - 14;
        void wait(s, i * 40).then(() =>
          tween(s, { targets: o, x: x1, alpha: 1, duration: 180, ease: 'Cubic.Out' }),
        );
      }
    });
    await wait(s, this.rows.length * 40 + 120);
    this.bar.setAlpha(1);
    this.caret.setAlpha(1);
    this.barFlash.y = this.bar.y;
    this.barFlash.setAlpha(0.8);
    void tween(s, { targets: this.barFlash, alpha: 0, duration: 240 });
    this.desc.setAlpha(1);
    this.layout(true);
    this.updateDesc();
    this.setEnabled(true);
  }

  async hide(): Promise<void> {
    const s = this.scene;
    this.setEnabled(false);
    await tween(s, { targets: this.root, x: this.x - 30, alpha: 0, duration: 200, ease: 'Cubic.In' });
    this.root.setVisible(false);
    this.root.x = this.x;
    this.shown = false;
  }
}
