// PileView — a deck or graveyard stack on its corner tile.
//
// The stack is a column of iso card images (one layer per ~2 cards, 1 px apart) so its height
// reads the count at a glance; the top layer is the card back (deck) or the latest card face
// (graveyard). A small count tag sits on the tile's front corner.
//
// v3 (lane A6-A, V3_A6_A; docs/v3/A6_PLAN.md K4 "not confused with the deck"): the stack reads as a
// block of card edges, never as one card lying on a pad — one layer per card (up to V3_MAX_LAYERS),
// each lower layer a flat silhouette in paper-edge tones (lit left face, shaded right face, the two
// alternating card by card) instead of a darkened copy of the card, an ink contact line under it,
// and an opaque count tag. The top layer is the same S-2 back (or face) as before.

import Phaser from 'phaser';
import type { CardId } from '../data/cards';
import { ISO_CX, ISO_CY, ISO_TEX_H, ISO_TEX_W, cardIsoKey, isoCanvas } from '../art/cards';
import { PAL, PLAYER_RAMP } from '../art/palette';
import { PixelCanvas, mix } from '../art/pixel';
import { addStaticCanvas } from '../art/textures';
import type { PlayerId } from '../engine/types';
import { pixelText } from '../ui/text';
import { DEPTH, type XY, zoneXY } from '../view/layout';
import { V3_A6_A } from '../view/v3flags';
import { tween, wait } from '../vfx/core';

export type PileKind = 'deck' | 'graveyard';

const MAX_LAYERS = 9;
/** v3: one layer per card up to this many (the stack's height reads the count card by card). */
const V3_MAX_LAYERS = 8;

/**
 * v3: the paper-edge tones of the stack's layers, from the layer right under the top card down:
 * [lit (left face), shaded (right face)], alternating card by card; the lowest layer is the ink
 * contact line.
 */
const V3_EDGES: readonly (readonly [number, number])[] = [
  [PAL.mist, PAL.steel],
  [PAL.night3, PAL.night2],
];

/**
 * v3: a lower layer of the stack — the resting iso card's silhouette, flat, split at its bottom
 * vertex into a lit left and a shaded right face (only its bottom edge shows under the layer above).
 */
function pileEdgeKey(scene: Phaser.Scene, player: PlayerId, lit: number, shade: number): string {
  const key = `v3pile:edge:p${player + 1}:${lit.toString(16)}:${shade.toString(16)}`;
  if (scene.textures.exists(key)) return key;
  const src = isoCanvas('back', 'up', player);
  // the bottom vertex: the middle of the lowest opaque row
  let vx = src.w / 2;
  for (let y = src.h - 1; y >= 0; y--) {
    let x0 = -1;
    let x1 = -1;
    for (let x = 0; x < src.w; x++)
      if (src.isOpaque(x, y)) {
        if (x0 < 0) x0 = x;
        x1 = x;
      }
    if (x0 >= 0) {
      vx = (x0 + x1) / 2;
      break;
    }
  }
  const p = new PixelCanvas(src.w, src.h);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) if (src.isOpaque(x, y)) p.set(x, y, x + 0.5 < vx ? lit : shade);
  addStaticCanvas(scene, key, p.toCanvas());
  return key;
}

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
    if (V3_A6_A) return Math.min(V3_MAX_LAYERS, n);
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
      if (V3_A6_A && !isTop) {
        // v3: a paper edge (the layer right under the top card is the lit one; the lowest is ink)
        const k = L - 2 - i;
        const [lit, shade] = i === 0 && L > 2 ? [PAL.ink, PAL.ink] : V3_EDGES[k % 2];
        const edge = this.scene.add.image(this.home.x, this.home.y - i, pileEdgeKey(this.scene, this.player, lit, shade)).setOrigin(ox, oy).setDepth(DEPTH.CARD_ON_TILE + i * 0.01);
        this.layers.push(edge);
        continue;
      }
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
      this.tag.fillStyle(PAL.ink, V3_A6_A ? 1 : 0.85).fillRect(x, y, w, 9);
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
