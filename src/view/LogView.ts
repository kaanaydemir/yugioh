// LogView — collapsible battle log in the right column (below the P2 panel, above the buttons).
//
//   const log = new LogView(scene);
//   hud.onLog = () => log.toggle();
//   log.add('Oyuncu 1 Kor Kurdu çağırdı', 0);     // player-colored bullet
//   log.add('Ayna Kalkanı açıldı!', PAL.mag3);     // explicit color
//
// Closed: each new line pops up as a short-lived toast above the buttons. Open: a panel with
// the latest lines (newest at the bottom), sliding in from the right edge.

import Phaser from 'phaser';
import { PAL, PLAYER_COLOR } from '../art/palette';
import { mix } from '../art/pixel';
import { sfx } from '../audio/sfx';
import type { PlayerId } from '../engine/types';
import { measureText, pixelText, textMetrics, wrapText } from '../ui/text';
import { DEPTH, GAME_W, UI } from './layout';
import { GLOW_PAD, glowTex, panelTex } from './ui-textures';

interface Entry {
  text: string;
  color: number;
}

const ADD = Phaser.BlendModes.ADD;
const MAX = 60;
const LINE = 10;

export class LogView {
  private readonly scene: Phaser.Scene;
  private readonly entries: Entry[] = [];
  private readonly rect = { x: 488, y: 96, w: 148, h: 196 };
  private panel: Phaser.GameObjects.Container | null = null;
  private lines: Phaser.GameObjects.Container | null = null;
  private toast: Phaser.GameObjects.Container | null = null;
  private toastTimer: Phaser.Time.TimerEvent | null = null;
  private _open = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  get open(): boolean {
    return this._open;
  }

  /** Append a line. `color` is a PlayerId (0/1 → player color) or a 0xRRGGBB color. */
  add(text: string, color: PlayerId | number = PAL.mist): void {
    const c = color === 0 || color === 1 ? PLAYER_COLOR[color as PlayerId] : color;
    this.entries.push({ text, color: c });
    if (this.entries.length > MAX) this.entries.shift();
    if (this._open) this.renderLines(true);
    else this.showToast(text, c);
  }

  clear(): void {
    this.entries.length = 0;
    if (this._open) this.renderLines(false);
  }

  toggle(): void {
    this.setOpen(!this._open);
  }

  setOpen(b: boolean): void {
    if (b === this._open) return;
    this._open = b;
    sfx.play(b ? 'uiConfirm' : 'uiBack', { volume: 0.5 });
    if (b) this.build();
    else if (this.panel) {
      const p = this.panel;
      this.panel = null;
      this.lines = null;
      this.scene.tweens.add({ targets: p, x: GAME_W + 8, duration: 180, ease: 'Quad.In', onComplete: () => p.destroy() });
    }
  }

  destroy(): void {
    this.toastTimer?.remove();
    this.panel?.destroy();
    this.toast?.destroy();
    this.panel = null;
    this.toast = null;
  }

  // ------------------------------------------------------------ internals

  private build(): void {
    const sc = this.scene;
    const { x, y, w, h } = this.rect;
    this.toast?.destroy();
    this.toast = null;
    const p = sc.add.container(GAME_W + 8, y).setDepth(DEPTH.MENU - 10).setScrollFactor(0);
    const glow = sc.add.image(-GLOW_PAD, -GLOW_PAD, glowTex(sc, w, h)).setOrigin(0).setBlendMode(ADD).setTint(PAL.steel).setAlpha(0.35);
    const bg = sc.add.image(0, 0, panelTex(sc, 'neutral', w, h, { header: 15, alpha: 240 })).setOrigin(0);
    const title = pixelText(sc, 8, 5 - textMetrics('md').capTop, 'SAVAŞ GÜNLÜĞÜ', { size: 'md', color: PAL.mist });
    p.add([glow, bg, title]);
    this.lines = sc.add.container(0, 0);
    p.add(this.lines);
    this.panel = p;
    this.renderLines(false);
    sc.tweens.add({ targets: p, x, duration: 240, ease: 'Back.Out' });
  }

  private renderLines(animateLast: boolean): void {
    const L = this.lines;
    if (!L) return;
    L.removeAll(true);
    const { w, h } = this.rect;
    const maxW = w - 18;
    const top = 19;
    const bottom = h - 6;
    // lay out from the newest upward
    let yb = bottom;
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const e = this.entries[i];
      const wrapped = wrapText(e.text, 'sm', maxW);
      const blockH = wrapped.length * LINE;
      if (yb - blockH < top) break;
      yb -= blockH;
      const bullet = this.scene.add.rectangle(7, yb + 4, 3, 3, e.color).setOrigin(0);
      const t = pixelText(this.scene, 13, yb - 2, e.text, { size: 'sm', color: i === this.entries.length - 1 ? PAL.white : mix(PAL.mist, PAL.steel, 0.3), maxWidth: maxW, lineSpacing: -1 });
      L.add([bullet, t]);
      if (animateLast && i === this.entries.length - 1) {
        t.setTint(e.color);
        this.scene.time.delayedCall(90, () => t.active && t.setTint(PAL.white));
        t.x += 6;
        t.setAlpha(0);
        this.scene.tweens.add({ targets: t, x: 13, alpha: 1, duration: 160, ease: 'Cubic.Out' });
      }
      yb -= 1;
    }
  }

  private showToast(text: string, color: number): void {
    const sc = this.scene;
    this.toast?.destroy();
    this.toastTimer?.remove();
    const maxW = 140;
    const m = measureText(text, 'sm', maxW);
    const w = m.w + 16;
    const h = m.h + 6;
    const right = UI.buttons.x + UI.buttons.w;
    const y = UI.buttons.y - h - 6;
    const c = sc.add.container(right - w, y).setDepth(DEPTH.HUD + 5).setScrollFactor(0);
    const bg = sc.add.image(0, 0, panelTex(sc, 'neutral', w, h, { alpha: 225, scan: false, chamfer: 2 })).setOrigin(0);
    const bar = sc.add.rectangle(3, 3, 2, h - 6, color).setOrigin(0);
    const t = pixelText(sc, 9, 2, text, { size: 'sm', color: PAL.white, maxWidth: maxW, lineSpacing: -1 });
    c.add([bg, bar, t]);
    this.toast = c;
    c.x = GAME_W + 4;
    sc.tweens.add({ targets: c, x: right - w, duration: 200, ease: 'Back.Out' });
    this.toastTimer = sc.time.delayedCall(2600, () => {
      sc.tweens.add({
        targets: c,
        alpha: 0,
        x: c.x + 10,
        duration: 260,
        onComplete: () => {
          c.destroy();
          if (this.toast === c) this.toast = null;
        },
      });
    });
  }
}
