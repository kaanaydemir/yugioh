// Art Lab control bar (shared by all variants): a compact neutral panel at the bottom of the
// screen, Turkish labels, mouse clicks + the keyboard shortcuts handled by the lab.
//
//  [Duraklat] [Baştan] [0,5×] [1×] [Yakınlaştır: Kapalı] [Efekt: Açık] [Varyant: A]   6,2 / 15,0 sn

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { measureText, pixelText } from '../../ui/text';
import { LAB_DEPTH } from '../types';
import { VARIANTS } from '../variants';
import type { ZoomTarget } from './camera';

export interface ControlsHost {
  isPlaying(): boolean;
  getSpeed(): number;
  getZoom(): ZoomTarget;
  getFx(): boolean;
  variantId(): string;
  timeText(): string;
  /** A short start-up note to show at the top (null: none). */
  noticeText(): string | null;
  ended(): boolean;
  togglePlay(): void;
  restart(): void;
  setSpeed(k: number): void;
  cycleZoom(): void;
  toggleFx(): void;
  setVariant(id: string): void;
}

export type ButtonId = 'play' | 'restart' | 'speed05' | 'speed1' | 'zoom' | 'fx' | 'variant';

interface Button {
  id: ButtonId;
  label: () => string;
  active?: () => boolean;
  run: () => void;
  border?: Phaser.GameObjects.Rectangle;
  bg?: Phaser.GameObjects.Rectangle;
  text?: Phaser.GameObjects.BitmapText;
  x: number;
  w: number;
}

const ZOOM_LABEL: Record<ZoomTarget, string> = { off: 'Kapalı', dragon: 'Ejder', wizard: 'Büyücü' };
const BAR_Y = 343;
const BAR_H = 17;
const BTN_Y = 346;
const BTN_H = 11;
const PAD = 4;
const GAP = 3;

export class LabControls {
  private readonly objs: Phaser.GameObjects.GameObject[] = [];
  private readonly buttons: Button[];
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly edge: Phaser.GameObjects.Rectangle;
  private readonly clock: Phaser.GameObjects.BitmapText;
  private readonly hint: Phaser.GameObjects.BitmapText;
  private readonly endMsg: Phaser.GameObjects.BitmapText;
  private readonly noticeMsg: Phaser.GameObjects.BitmapText;
  private readonly menu: Phaser.GameObjects.GameObject[] = [];
  private menuOpen = false;
  private shown = true;
  private sig = '';

  /**
   * @param uiBuild wraps object creation so that objects made later (the variant menu) are
   *   also marked as UI for the cameras.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly host: ControlsHost,
    private readonly uiBuild: <T>(fn: () => T) => T = (fn) => fn(),
  ) {
    const h = host;
    this.panel = this.track(scene.add.rectangle(0, BAR_Y, 640, BAR_H, PAL.ink, 0.78).setOrigin(0, 0).setDepth(LAB_DEPTH.UI));
    this.edge = this.track(scene.add.rectangle(0, BAR_Y, 640, 1, PAL.night3, 1).setOrigin(0, 0).setDepth(LAB_DEPTH.UI));
    // swallow clicks on the panel itself
    this.panel.setInteractive();
    this.buttons = [
      { id: 'play', label: () => (h.isPlaying() ? 'Duraklat' : 'Oynat'), run: () => h.togglePlay(), x: 0, w: 0 },
      { id: 'restart', label: () => 'Baştan', run: () => h.restart(), x: 0, w: 0 },
      { id: 'speed05', label: () => '0,5×', active: () => h.getSpeed() === 0.5, run: () => h.setSpeed(0.5), x: 0, w: 0 },
      { id: 'speed1', label: () => '1×', active: () => h.getSpeed() === 1, run: () => h.setSpeed(1), x: 0, w: 0 },
      { id: 'zoom', label: () => `Yakınlaştır: ${ZOOM_LABEL[h.getZoom()]}`, active: () => h.getZoom() !== 'off', run: () => h.cycleZoom(), x: 0, w: 0 },
      { id: 'fx', label: () => `Efekt: ${h.getFx() ? 'Açık' : 'Kapalı'}`, run: () => h.toggleFx(), x: 0, w: 0 },
      { id: 'variant', label: () => `Varyant: ${h.variantId()}`, active: () => this.menuOpen, run: () => this.toggleMenu(), x: 0, w: 0 },
    ];
    for (const b of this.buttons) {
      // crisp 1-px border: a filled rect with a filled inset (no half-pixel strokes)
      b.border = this.track(scene.add.rectangle(0, BTN_Y, 10, BTN_H, PAL.night3, 1).setOrigin(0, 0).setDepth(LAB_DEPTH.UI + 1));
      b.bg = this.track(scene.add.rectangle(1, BTN_Y + 1, 8, BTN_H - 2, PAL.night1, 1).setOrigin(0, 0).setDepth(LAB_DEPTH.UI + 1));
      b.border.setInteractive({ useHandCursor: true });
      b.border.on('pointerdown', () => this.press(b.id));
      b.text = this.track(pixelText(scene, 0, BTN_Y, '', { size: 'sm', outline: false, color: PAL.mist }).setDepth(LAB_DEPTH.UI + 2));
    }
    this.clock = this.track(pixelText(scene, 636, BTN_Y, '', { size: 'sm', outline: false, color: PAL.mist, originX: 1 }).setDepth(LAB_DEPTH.UI + 2));
    this.hint = this.track(pixelText(scene, 0, BTN_Y, 'Tuşlar: Boşluk R 1 2 Z F V H , .', { size: 'sm', outline: false, color: PAL.night4 }).setDepth(LAB_DEPTH.UI + 2));
    this.endMsg = this.track(
      pixelText(scene, 320, 8, 'Bitti — Baştan için R', { size: 'md', color: PAL.gold4, originX: 0.5 }).setDepth(LAB_DEPTH.UI + 2).setVisible(false),
    );
    this.noticeMsg = this.track(
      pixelText(scene, 320, 22, '', { size: 'md', color: PAL.mist, originX: 0.5 }).setDepth(LAB_DEPTH.UI + 2).setVisible(false),
    );
    this.refresh(true);
  }

  private track<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objs.push(o);
    return o;
  }

  /** Run a button's action (mouse click, or tests calling __artlab.press). */
  press(id: ButtonId): void {
    const b = this.buttons.find((q) => q.id === id);
    if (!b) return;
    if (id !== 'variant') this.closeMenu();
    b.run();
    this.refresh(true);
  }

  /** Screen rectangles of the buttons (game px) — for tests that click with synthetic events. */
  rects(): Record<string, { x: number; y: number; w: number; h: number }> {
    const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const b of this.buttons) out[b.id] = { x: b.x, y: BTN_Y, w: b.w, h: BTN_H };
    return out;
  }

  get visible(): boolean {
    return this.shown;
  }

  setVisible(on: boolean): void {
    this.shown = on;
    if (!on) this.closeMenu();
    this.refresh(true);
  }

  toggleMenu(): void {
    if (this.menuOpen) this.closeMenu();
    else this.uiBuild(() => this.openMenu());
  }

  get menuIsOpen(): boolean {
    return this.menuOpen;
  }

  private openMenu(): void {
    this.closeMenu();
    this.menuOpen = true;
    const vb = this.buttons.find((b) => b.id === 'variant')!;
    const rowH = 12;
    // as wide as the longest label (5 px in, 5 px spare; at least the original 112 px): C's
    // "C — Orijinal Neon, Yüksek Detay" ran past the fixed 112-px box
    const w = Math.max(112, ...VARIANTS.map((v) => measureText(v.label, 'sm', undefined, false).w + 10));
    const x = Math.min(640 - w - 2, vb.x);
    const y0 = BAR_Y - 2 - VARIANTS.length * rowH - 4;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.menu.push(o);
      return o;
    };
    add(this.scene.add.rectangle(x - 1, y0 - 1, w + 2, VARIANTS.length * rowH + 6, PAL.night3, 1).setOrigin(0, 0).setDepth(LAB_DEPTH.UI + 3));
    add(this.scene.add.rectangle(x, y0, w, VARIANTS.length * rowH + 4, PAL.ink, 1).setOrigin(0, 0).setDepth(LAB_DEPTH.UI + 3)).setInteractive();
    VARIANTS.forEach((v, i) => {
      const ry = y0 + 2 + i * rowH;
      const ready = !!v.load;
      const current = v.id === this.host.variantId();
      const row = add(this.scene.add.rectangle(x + 2, ry, w - 4, rowH - 1, current ? PAL.night2 : PAL.ink, current ? 1 : 0.01).setOrigin(0, 0).setDepth(LAB_DEPTH.UI + 4));
      if (ready) {
        row.setInteractive({ useHandCursor: true });
        row.on('pointerdown', () => {
          this.closeMenu();
          this.host.setVariant(v.id);
        });
      }
      add(
        pixelText(this.scene, x + 5, ry, v.label, { size: 'sm', outline: false, color: ready ? (current ? PAL.gold3 : PAL.mist) : PAL.night4 }).setDepth(LAB_DEPTH.UI + 5),
      );
    });
  }

  closeMenu(): void {
    for (const o of this.menu) o.destroy();
    this.menu.length = 0;
    this.menuOpen = false;
  }

  /** Update labels / layout (cheap; re-lays out only when something changed). */
  refresh(force = false): void {
    const h = this.host;
    const sig = [this.shown, ...this.buttons.map((b) => b.label() + (b.active?.() ? '*' : ''))].join('|');
    if (force || sig !== this.sig) {
      this.sig = sig;
      let x = PAD;
      for (const b of this.buttons) {
        const label = b.label();
        b.text!.setText(label);
        const tw = Math.ceil(b.text!.width);
        b.w = tw + 8;
        b.x = x;
        const act = b.active?.() ?? false;
        b.border!.setPosition(x, BTN_Y).setSize(b.w, BTN_H).setFillStyle(act ? PAL.gold2 : PAL.night3, 1);
        b.border!.input?.hitArea.setTo(0, 0, b.w, BTN_H);
        b.bg!.setPosition(x + 1, BTN_Y + 1).setSize(b.w - 2, BTN_H - 2).setFillStyle(act ? PAL.gold1 : PAL.night1, 1);
        b.text!.setPosition(x + 4, BTN_Y + 1).setTint(act ? PAL.gold4 : PAL.mist);
        x += b.w + GAP;
      }
      this.hint.setPosition(x + 6, BTN_Y + 1);
      this.hint.setVisible(this.shown && x + 6 + this.hint.width < 640 - 70);
      for (const o of this.objs) if (o !== this.hint) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(this.shown);
    }
    this.clock.setText(h.timeText());
    this.endMsg.setVisible(this.shown && h.ended());
    const note = h.noticeText();
    if (note && this.noticeMsg.text !== note) this.noticeMsg.setText(note);
    this.noticeMsg.setVisible(this.shown && !!note);
  }

  destroy(): void {
    this.closeMenu();
    for (const o of this.objs) o.destroy();
    this.objs.length = 0;
  }
}
