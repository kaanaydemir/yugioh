// Presentation hooks of the deck builder. Step 1 (layout) ships a small, quiet default: a thumbnail hops
// from the collection card to its deck entry. Step 2 (rich add / remove feedback, drag & drop, living
// details) replaces `defaultDeckFx` with its own DeckFx; the scene calls only these methods.

import Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import { tween } from '../../vfx/core';
import { deckThumbTex } from './art';
import { REDUCED_MOTION } from './ui';

export interface Pt {
  x: number;
  y: number;
}

export interface DeckFx {
  /** One copy of `id` joined the deck: `from` = the collection card's centre (null: added from the deck list / keys), `to` = its deck entry's centre (null: scrolled away). */
  added(id: CardId, from: Pt | null, to: Pt | null): void;
  /** One copy left the deck (`at` = the entry or card it was taken from). */
  removed(id: CardId, at: Pt | null): void;
  /** Adding was refused (`at` = where the click was). The scene already shows the reason. */
  blocked(id: CardId, at: Pt | null): void;
  /** Several cards changed at once (auto-fill, preset, classic, clear). */
  bulk(kind: 'auto' | 'preset' | 'classic' | 'clear'): void;
  /** The deck was saved to its slot. */
  saved(): void;
}

export function defaultDeckFx(scene: Phaser.Scene): DeckFx {
  return {
    added(id, from, to) {
      if (REDUCED_MOTION || !from || !to) return;
      const img = scene.add.image(from.x, from.y, deckThumbTex(scene, id)).setDepth(700);
      const o = { t: 0 };
      void tween(scene, {
        targets: o,
        t: 1,
        duration: 200,
        ease: 'Cubic.In',
        onUpdate: () => {
          const t = o.t;
          img.setPosition(Math.round(from.x + (to.x - from.x) * t), Math.round(from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * 16));
        },
      }).then(() => img.destroy());
    },
    removed() {},
    blocked() {},
    bulk() {},
    saved() {},
  };
}
