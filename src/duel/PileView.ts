// PileView — a deck or graveyard stack on its corner tile.
//
// The stack is a column of iso card images (one layer per ~2 cards, 1 px apart) so its height
// reads the count at a glance; the top layer is the card back (deck) or the latest card face
// (graveyard). A small count tag sits on the tile's front corner.

import Phaser from 'phaser';
import type { CardId } from '../data/cards';
import { ISO_CX, ISO_CY, ISO_TEX_H, ISO_TEX_W, cardIsoKey } from '../art/cards';
import { PAL, PLAYER_RAMP } from '../art/palette';
import { mix } from '../art/pixel';
import type { PlayerId } from '../engine/types';
import { pixelText } from '../ui/text';
import { DEPTH, type XY, zoneXY } from '../view/layout';
import { tween, wait } from '../vfx/core';

export type PileKind = 'deck' | 'graveyard';

const MAX_LAYERS = 9;

export class PileView {
  readonly scene: Phaser.Scene;
  readonly player: PlayerId;
  readonly kind: PileKind;
  readonly home: XY;
  private layers: Phaser.GameObjects.Image[] = [];
  private readonly label: Phaser.GameObjects.BitmapText;
  private readonly tag: Phaser.GameObjects.Graphics;
  private n = 0;
  private top: CardId | null = null;

  constructor(scene: Phaser.Scene, player: PlayerId, kind: PileKind) {
    this.scene = scene;
    this.player = player;
    this.kind = kind;
    this.home = zoneXY(player, kind);
    this.tag = scene.add.graphics().setDepth(DEPTH.CARD_ON_TILE + 5);
    this.label = pixelText(scene, 0, 0, '0', { size: 'sm', color: PAL.mist, originX: 0.5, originY: 0.5 }).setDepth(DEPTH.CARD_ON_TILE + 6);
    this.render();
  }

  get count(): number {
    return this.n;
  }

  get topCard(): CardId | null {
    return this.top;
  }

  /** World point on top of the stack (where cards fly to / from). */
  topXY(): XY {
    return { x: this.home.x, y: this.home.y - this.layerCount(this.n) };
  }

  /** Instant. */
  set(count: number, topCard: CardId | null): void {
    if (count === this.n && topCard === this.top) return;
    this.n = Math.max(0, count);
    this.top = this.n > 0 ? topCard : null;
    this.render();
  }

  /** Small squash on the stack (a card landed / left). */
  bump(): void {
    const top = this.layers[this.layers.length - 1];
    if (!top) return;
    const y = top.y;
    this.scene.tweens.killTweensOf(top);
    top.y = y + 1;
    void tween(this.scene, { targets: top, y, duration: 160, ease: 'Back.Out' });
  }

  /** Highlight the top card (e.g. soul_recall picks from this graveyard). */
  async flash(color: number = PAL.white): Promise<void> {
    const top = this.layers[this.layers.length - 1];
    if (!top) return;
    top.setTintFill(color);
    await wait(this.scene, 90);
    if (top.active) top.clearTint();
  }

  setVisible(b: boolean): void {
    for (const l of this.layers) l.setVisible(b);
    this.label.setVisible(b && this.n > 0);
    this.tag.setVisible(b && this.n > 0);
  }

  destroy(): void {
    for (const l of this.layers) l.destroy();
    this.layers = [];
    this.label.destroy();
    this.tag.destroy();
  }

  private layerCount(n: number): number {
    if (n <= 0) return 0;
    return Math.min(MAX_LAYERS, Math.ceil(n / 2));
  }

  private render(): void {
    for (const l of this.layers) l.destroy();
    this.layers = [];
    const L = this.layerCount(this.n);
    const ox = ISO_CX / ISO_TEX_W;
    const oy = ISO_CY / ISO_TEX_H;
    for (let i = 0; i < L; i++) {
      const isTop = i === L - 1;
      const key = isTop && this.kind === 'graveyard' && this.top ? cardIsoKey(this.top, 'up', this.player) : cardIsoKey('back', 'up', this.player);
      const img = this.scene.add.image(this.home.x, this.home.y - i, key).setOrigin(ox, oy).setDepth(DEPTH.CARD_ON_TILE + i * 0.01);
      if (!isTop) {
        // lower layers: only their lit edge shows; darken so the stack reads as thickness
        const k = 0.45 + 0.35 * (i / Math.max(1, L - 1));
        img.setTint(mix(PAL.night1, PAL.white, k));
      } else if (this.kind === 'graveyard') img.setTint(mix(PAL.mist, PAL.white, 0.5));
      this.layers.push(img);
    }
    // count tag on the tile's front corner
    const R = PLAYER_RAMP[this.player];
    const s = String(this.n);
    const w = s.length * 4 + 5;
    const x = Math.round(this.home.x - w / 2);
    const y = Math.round(this.home.y + 8);
    this.tag.clear();
    if (this.n > 0) {
      this.tag.fillStyle(PAL.ink, 0.85).fillRect(x, y, w, 9);
      this.tag.fillStyle(R[1], 1).fillRect(x + 1, y, w - 2, 1);
      this.tag.fillStyle(R[0], 1).fillRect(x + 1, y + 8, w - 2, 1);
    }
    this.label.setText(s);
    this.label.setPosition(Math.round(this.home.x), y + 5);
    this.label.setTint(this.kind === 'deck' && this.n <= 3 ? PAL.crim3 : PAL.mist);
    this.label.setVisible(this.n > 0);
    this.tag.setVisible(this.n > 0);
  }
}
