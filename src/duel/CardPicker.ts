// CardPicker — choose one card from a small set that is not on the board (e.g. Ruh Çağrısı:
// a monster from either graveyard). Cards fan out over a dimmed screen; click one (or 1–9),
// İPTAL / Esc cancels. Resolves with the chosen uid or null.

import Phaser from 'phaser';
import type { CardId } from '../data/cards';
import { PAL } from '../art/palette';
import { sfx } from '../audio/sfx';
import type { PlayerId, Uid } from '../engine/types';
import { pixelText } from '../ui/text';
import { Button } from '../view/Button';
import { CardSprite } from '../view/CardSprite';
import { DEPTH, GAME_H, GAME_W } from '../view/layout';
import { ICON } from '../view/ui-textures';
import { tween } from '../vfx/core';

export interface PickCard {
  uid: Uid;
  cardId: CardId;
  /** Shown as the owner tint (whose graveyard). */
  owner: PlayerId;
}

export async function pickCard(scene: Phaser.Scene, title: string, cards: PickCard[], o: { cancel?: boolean } = {}): Promise<Uid | null> {
  const root = scene.add.container(0, 0).setDepth(DEPTH.OVERLAY - 10).setScrollFactor(0);
  const dim = scene.add.rectangle(0, 0, GAME_W, GAME_H, PAL.ink, 1).setOrigin(0).setAlpha(0).setInteractive();
  root.add(dim);
  void tween(scene, { targets: dim, alpha: 0.62, duration: 180 });
  const head = pixelText(scene, GAME_W / 2, 64, title, { size: 'md', color: PAL.gold4, originX: 0.5, originY: 0.5, shadow: 1 });
  root.add(head);
  const n = cards.length;
  const step = Math.min(58, Math.floor((GAME_W - 80) / Math.max(1, n)));
  const x0 = GAME_W / 2 - ((n - 1) * step) / 2;
  const sprites: CardSprite[] = [];
  let resolve!: (v: Uid | null) => void;
  const result = new Promise<Uid | null>((r) => (resolve = r));
  let done = false;
  const finish = (v: Uid | null) => {
    if (done) return;
    done = true;
    resolve(v);
  };
  cards.forEach((c, i) => {
    const s = new CardSprite(scene, x0 + i * step, 160, c.cardId, { faceUp: true, player: c.owner });
    s.setScrollFactor(0).setAlpha(0);
    root.add(s);
    sprites.push(s);
    s.setInteractive({ useHandCursor: true });
    s.on(Phaser.Input.Events.POINTER_OVER, () => {
      void s.hoverLift(true);
      s.setHighlight(PAL.gold3);
      sfx.play('uiHover', { volume: 0.4 });
    });
    s.on(Phaser.Input.Events.POINTER_OUT, () => {
      void s.hoverLift(false);
      s.setHighlight(null);
    });
    s.on(Phaser.Input.Events.POINTER_UP, () => {
      sfx.play('uiConfirm');
      finish(c.uid);
    });
    void tween(scene, { targets: s, alpha: 1, y: 150, duration: 220, delay: i * 50, ease: 'Back.Out' });
  });
  let cancel: Button | null = null;
  if (o.cancel ?? true) {
    cancel = new Button(scene, GAME_W / 2 - 36, 214, { w: 72, h: 18, label: 'İPTAL', size: 'sm', icon: ICON.close, style: 'neutral' });
    cancel.setScrollFactor(0);
    cancel.onClick = () => finish(null);
    root.add(cancel);
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && (o.cancel ?? true)) finish(null);
    const k = Number(e.key);
    if (Number.isInteger(k) && k >= 1 && k <= n) finish(cards[k - 1].uid);
  };
  window.addEventListener('keydown', onKey);
  const v = await result;
  window.removeEventListener('keydown', onKey);
  await tween(scene, { targets: root, alpha: 0, duration: 160 });
  root.destroy();
  return v;
}
