// ActionMenu — small context menu next to a card / tile with Turkish verbs.
//
//   const menu = new ActionMenu(scene);
//   const id = await menu.open(x, y, [
//     { id: 'summon', label: 'Çağır' },
//     { id: 'set', label: 'Kapalı Koy' },
//     { id: 'activate', label: 'Aktive Et', enabled: false },
//   ], { style: 'p1', title: 'Kor Kurdu' });
//   // → 'summon' | 'set' | null (İptal / Esc / click outside / right click)
//
// Mouse + keyboard: 1–9 pick a row, ↑/↓ move, Enter/Space confirm, Esc cancel. An "İptal" row is
// appended automatically unless an option with id 'cancel' exists (opts.cancelRow = false hides it).
// The menu unfolds from the anchor with a pointer notch, the selection bar glides between rows,
// a chosen row flashes before the menu folds away.

import Phaser from 'phaser';
import { PAL } from '../art/palette';
import { mix } from '../art/pixel';
import { sfx } from '../audio/sfx';
import { measureText, pixelText, textMetrics, type TextSize } from '../ui/text';
import { TEX, tween } from '../vfx/core';
import { DEPTH, GAME_H, GAME_W } from './layout';
import { GLOW_PAD, ICON, UI_RAMP, type UiStyle, glowTex, panelTex, pushUiKeys } from './ui-textures';

export interface MenuOption {
  id: string;
  label: string;
  /** Default true. Disabled rows are greyed and buzz when picked. */
  enabled?: boolean;
}

export interface MenuOpts {
  style?: UiStyle;
  /** Small header line (e.g. the card name). */
  title?: string;
  /** Append an "İptal" row (default true). */
  cancelRow?: boolean;
}

const ROW_H = 14;
const PAD_X = 5;
const PAD_TOP = 5;
const PAD_BOTTOM = 5;
const TITLE_H = 13;
const ADD = Phaser.BlendModes.ADD;

function capY(size: TextSize, capTop: number): number {
  return capTop - textMetrics(size).capTop;
}

interface Row {
  opt: MenuOption;
  y: number;
  key: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.BitmapText;
  enabled: boolean;
}

export class ActionMenu {
  private readonly scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container | null = null;
  private blocker: Phaser.GameObjects.Zone | null = null;
  private hit: Phaser.GameObjects.Zone | null = null;
  private bar: Phaser.GameObjects.Graphics | null = null;
  private caret: Phaser.GameObjects.Image | null = null;
  private rows: Row[] = [];
  private hover = -1;
  private barY = 0;
  private resolve: ((id: string | null) => void) | null = null;
  private releaseKeys: (() => void) | null = null;
  private style: UiStyle = 'neutral';
  private w = 0;
  private h = 0;
  private bodyTop = 0;
  private closing = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  get isOpen(): boolean {
    return this.root !== null;
  }

  /** Open at anchor (x, y). Resolves with the chosen option id, or null when cancelled. */
  open(x: number, y: number, options: MenuOption[], opts: MenuOpts = {}): Promise<string | null> {
    if (this.root) this.finish(null, false);
    const sc = this.scene;
    this.style = opts.style ?? 'neutral';
    const R = UI_RAMP[this.style];
    const list = [...options];
    if ((opts.cancelRow ?? true) && !list.some((o) => o.id === 'cancel')) list.push({ id: 'cancel', label: 'İptal' });
    const title = opts.title ?? '';
    const labelW = Math.max(...list.map((o) => measureText(o.label, 'md').w), title ? measureText(title, 'sm').w - 12 : 0);
    this.w = Math.max(70, PAD_X * 2 + 13 + labelW + 8);
    this.bodyTop = PAD_TOP + (title ? TITLE_H : 0);
    this.h = this.bodyTop + list.length * ROW_H + PAD_BOTTOM;
    // place: centered on x, above the anchor if it fits, else below
    const above = y - this.h - 10 >= 22;
    let left = Math.round(x - this.w / 2);
    left = Math.max(4, Math.min(GAME_W - 4 - this.w, left));
    const top = above ? Math.round(y - this.h - 9) : Math.round(Math.min(GAME_H - 4 - this.h, y + 9));

    // full-screen click catcher (click outside = cancel)
    this.blocker = sc.add
      .zone(0, 0, GAME_W, GAME_H)
      .setOrigin(0)
      .setDepth(DEPTH.MENU - 1)
      .setScrollFactor(0)
      .setInteractive();
    this.blocker.on(Phaser.Input.Events.POINTER_DOWN, () => this.cancel());

    // root pivots on the edge facing the anchor, so the menu unfolds out of it
    const pivotY = above ? top + this.h : top;
    const root = sc.add.container(left, pivotY).setDepth(DEPTH.MENU).setScrollFactor(0);
    this.root = root;
    const oy = above ? -this.h : 0;
    const glow = sc.add
      .image(-GLOW_PAD, oy - GLOW_PAD, glowTex(sc, this.w, this.h))
      .setOrigin(0)
      .setBlendMode(ADD)
      .setTint(R[3])
      .setAlpha(0.5);
    const bg = sc.add.image(0, oy, panelTex(sc, this.style, this.w, this.h, { header: title ? TITLE_H + 2 : 0, alpha: 246 })).setOrigin(0);
    root.add([glow, bg]);
    // pointer notch toward the anchor
    const notch = sc.add.graphics();
    const nx = Math.max(8, Math.min(this.w - 9, Math.round(x - left)));
    if (above) {
      const ny = 0;
      notch.fillStyle(PAL.ink).fillRect(nx - 4, ny - 1, 9, 1).fillRect(nx - 3, ny, 7, 1).fillRect(nx - 2, ny + 1, 5, 1).fillRect(nx - 1, ny + 2, 3, 1).fillRect(nx, ny + 3, 1, 1);
      notch.fillStyle(R[2]).fillRect(nx - 3, ny - 1, 7, 1).fillRect(nx - 2, ny, 5, 1).fillRect(nx - 1, ny + 1, 3, 1).fillRect(nx, ny + 2, 1, 1);
    } else {
      const ny = 0;
      notch.fillStyle(PAL.ink).fillRect(nx - 4, ny, 9, 1).fillRect(nx - 3, ny - 1, 7, 1).fillRect(nx - 2, ny - 2, 5, 1).fillRect(nx - 1, ny - 3, 3, 1).fillRect(nx, ny - 4, 1, 1);
      notch.fillStyle(R[3]).fillRect(nx - 3, ny, 7, 1).fillRect(nx - 2, ny - 1, 5, 1).fillRect(nx - 1, ny - 2, 3, 1).fillRect(nx, ny - 3, 1, 1);
    }
    root.add(notch);
    if (title) {
      const t = pixelText(sc, PAD_X + 2, oy + capY('sm', PAD_TOP + 2), title, { size: 'sm', color: R[4] });
      root.add(t);
    }
    this.bar = sc.add.graphics();
    root.add(this.bar);
    this.caret = sc.add.image(0, 0, ICON.caret).setOrigin(0).setTint(PAL.white).setVisible(false);
    root.add(this.caret);

    this.rows = list.map((opt, i) => {
      const ry = oy + this.bodyTop + i * ROW_H;
      const enabled = opt.enabled ?? true;
      const key = sc.add.container(PAD_X + 4, ry + 2);
      const kg = sc.add.graphics();
      const kc = enabled ? R[2] : PAL.night3;
      kg.fillStyle(PAL.ink).fillRect(0, 0, 9, 10);
      kg.fillStyle(kc).fillRect(1, 1, 7, 8);
      kg.fillStyle(enabled ? R[3] : PAL.night4).fillRect(1, 1, 7, 1);
      kg.fillStyle(mix(kc, PAL.ink, 0.35)).fillRect(1, 8, 7, 1);
      const isCancel = opt.id === 'cancel';
      const kt = pixelText(sc, 0, capY('sm', 3), isCancel ? 'X' : String(i + 1), { size: 'sm', color: enabled ? PAL.white : PAL.steel, outline: false });
      kt.x = Math.round(4.5 - kt.width / 2);
      key.add([kg, kt]);
      const label = pixelText(sc, PAD_X + 17, capY('md', ry + 4), opt.label, {
        size: 'md',
        color: !enabled ? PAL.night4 : isCancel ? PAL.mist : PAL.white,
      });
      label.setData('x0', label.x);
      root.add([key, label]);
      return { opt, y: ry, key, label, enabled };
    });

    // hit area over the rows (scene-level so the unfold scale does not matter)
    // (covers the whole panel so clicks on the title / padding do not fall through and cancel)
    this.hit = sc.add
      .zone(left, top, this.w, this.h)
      .setOrigin(0)
      .setDepth(DEPTH.MENU + 1)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.hit.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      const i = Math.floor((p.y - (top + this.bodyTop)) / ROW_H);
      if (i >= 0 && i < this.rows.length) this.setHover(i, true);
    });
    this.hit.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) return this.cancel();
      const i = Math.floor((p.y - (top + this.bodyTop)) / ROW_H);
      if (i >= 0 && i < this.rows.length) this.pick(i);
    });

    this.releaseKeys = pushUiKeys((e) => this.onKey(e));

    // unfold; the rows slide in to their resting x (the initially hovered row sits 2px in)
    sfx.play('uiClick', { volume: 0.5, pitch: 1.2 });
    root.setScale(0.92, 0.2).setAlpha(0);
    sc.tweens.add({ targets: root, scaleX: 1, scaleY: 1, alpha: 1, duration: 170, ease: 'Back.Out', easeParams: [1.6] });
    const firstEnabled = Math.max(0, this.rows.findIndex((r) => r.enabled && r.opt.id !== 'cancel'));
    this.rows.forEach((r, i) => {
      const x0 = r.label.getData('x0') as number;
      const to = x0 + (i === firstEnabled && r.enabled ? 2 : 0);
      r.label.setAlpha(0).setX(x0 - 6);
      r.key.setAlpha(0);
      sc.tweens.add({ targets: r.label, x: to, alpha: 1, delay: 50 + i * 28, duration: 150, ease: 'Cubic.Out' });
      sc.tweens.add({ targets: r.key, alpha: 1, delay: 50 + i * 28, duration: 120 });
    });
    this.barY = this.rows[firstEnabled].y;
    this.setHover(firstEnabled, false, false);
    this.closing = false;
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  /** Close as cancelled (resolves null). */
  close(): void {
    if (this.root) this.finish(null, true);
  }

  destroy(): void {
    if (this.root) this.finish(null, false);
  }

  // ------------------------------------------------------------ internals

  private setHover(i: number, sound: boolean, nudge = true): void {
    if (i === this.hover || !this.root || !this.bar) return;
    this.hover = i;
    const r = this.rows[i];
    if (sound && r.enabled) sfx.play('uiHover', { volume: 0.35, pitch: 1.1 + i * 0.04 });
    this.rows.forEach((row, k) => {
      const isCancel = row.opt.id === 'cancel';
      row.label.setTint(!row.enabled ? PAL.night4 : k === i ? PAL.white : isCancel ? PAL.mist : mix(PAL.white, PAL.mist, 0.4));
    });
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      barY: r.y,
      duration: 90,
      ease: 'Quad.Out',
      onUpdate: () => this.drawBar(),
    });
    this.drawBar();
    if (!nudge) return;
    // label nudge: the hovered (enabled) row steps 2px in, the others return to their base x
    this.rows.forEach((row) => {
      const bx = row.label.getData('x0') as number;
      const to = row === r && r.enabled ? bx + 2 : bx;
      this.scene.tweens.killTweensOf(row.label);
      row.label.setAlpha(1);
      if (row.label.x !== to) this.scene.tweens.add({ targets: row.label, x: to, duration: 90, ease: 'Quad.Out' });
    });
  }

  private drawBar(): void {
    const g = this.bar;
    if (!g || !this.caret) return;
    const R = UI_RAMP[this.style];
    const r = this.rows[this.hover];
    const en = r?.enabled ?? false;
    const y = Math.round(this.barY);
    g.clear();
    const x = 3;
    const w = this.w - 6;
    g.fillStyle(en ? mix(R[1], PAL.night1, 0.2) : PAL.night2).fillRect(x, y, w, ROW_H);
    g.fillStyle(en ? R[2] : PAL.night3).fillRect(x, y, w, 1);
    g.fillStyle(en ? mix(R[1], PAL.ink, 0.3) : PAL.night1).fillRect(x, y + ROW_H - 1, w, 1);
    g.fillStyle(en ? R[4] : PAL.night4).fillRect(x, y, 2, ROW_H);
    // dither fade toward the right
    g.fillStyle(PAL.night1);
    for (let yy = 1; yy < ROW_H - 1; yy++) for (let xx = w - 14; xx < w; xx++) if (((xx + yy) & 1) === 0 && xx > w - 14 + ((yy * 3) % 5)) g.fillRect(x + xx, y + yy, 1, 1);
    this.caret.setVisible(false);
  }

  /** Keyboard: 1–9 pick, ↑/↓ move, Enter/Space confirm, Esc cancel. Returns true when used. */
  private onKey(e: KeyboardEvent): boolean {
    if (!this.root) return false;
    const nav = ['Escape', 'ArrowDown', 'ArrowUp', 'Enter', ' '];
    if (this.closing) return nav.includes(e.key) || /^[1-9]$/.test(e.key);
    if (e.key === 'Escape') {
      this.cancel();
      return true;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      let i = this.hover;
      for (let k = 0; k < this.rows.length; k++) {
        i = (i + dir + this.rows.length) % this.rows.length;
        if (this.rows[i].enabled) break;
      }
      this.setHover(i, true);
      return true;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      if (this.hover >= 0) this.pick(this.hover);
      return true;
    }
    if (/^[1-9]$/.test(e.key)) {
      const i = Number(e.key) - 1;
      if (i >= this.rows.length) return true;
      if (this.rows[i].opt.id === 'cancel') {
        this.cancel();
        return true;
      }
      this.setHover(i, false);
      this.pick(i);
      return true;
    }
    return false;
  }

  private pick(i: number): void {
    if (this.closing) return;
    const r = this.rows[i];
    if (r.opt.id === 'cancel') return this.cancel();
    if (!r.enabled) {
      sfx.play('uiError', { volume: 0.5 });
      const x0 = r.label.getData('x0') as number;
      this.scene.tweens.killTweensOf(r.label);
      const o = { t: 0 };
      this.scene.tweens.add({
        targets: o,
        t: 1,
        duration: 200,
        onUpdate: () => r.label.setX(x0 + Math.round(Math.sin(o.t * Math.PI * 6) * 2 * (1 - o.t))),
      });
      return;
    }
    sfx.play('uiConfirm', { volume: 0.7 });
    this.closing = true;
    // chosen row flashes, sparks fly off the bar, then fold
    r.label.setTint(PAL.white);
    const R = UI_RAMP[this.style];
    this.sparkRow(r, R[4]);
    this.scene.time.delayedCall(50, () => r.label.setTint(R[4]));
    this.scene.time.delayedCall(100, () => r.label.setTint(PAL.white));
    this.scene.time.delayedCall(150, () => this.finish(r.opt.id, true));
  }

  private cancel(): void {
    if (this.closing || !this.root) return;
    sfx.play('uiBack', { volume: 0.6 });
    this.closing = true;
    this.finish(null, true);
  }

  private sparkRow(r: Row, color: number): void {
    if (!this.root) return;
    const m = this.root.getWorldTransformMatrix();
    const y = m.ty + r.y + ROW_H / 2;
    for (let k = 0; k < 10; k++) {
      const x = m.tx + 6 + ((k * 23) % (this.w - 12));
      const sp = this.scene.add
        .image(Math.round(x), Math.round(y + (k % 2 ? -5 : 5)), k % 4 === 0 ? TEX.plus : TEX.px1)
        .setTint(k % 3 ? color : PAL.white)
        .setBlendMode(ADD)
        .setDepth(DEPTH.MENU + 2)
        .setScrollFactor(0);
      this.scene.tweens.add({
        targets: sp,
        y: sp.y + (k % 2 ? -6 : 6),
        alpha: 0,
        duration: 220,
        ease: 'Cubic.Out',
        onComplete: () => sp.destroy(),
      });
    }
  }

  private finish(id: string | null, animate: boolean): void {
    const root = this.root;
    const resolve = this.resolve;
    this.root = null;
    this.resolve = null;
    this.blocker?.destroy();
    this.hit?.destroy();
    this.blocker = null;
    this.hit = null;
    this.bar = null;
    this.caret = null;
    this.rows = [];
    this.hover = -1;
    this.scene.tweens.killTweensOf(this);
    this.releaseKeys?.();
    this.releaseKeys = null;
    if (root) {
      if (animate)
        void tween(this.scene, { targets: root, scaleY: 0.1, scaleX: 0.95, alpha: 0, duration: 120, ease: 'Quad.In' }).then(() => root.destroy());
      else root.destroy();
    }
    resolve?.(id);
  }
}
