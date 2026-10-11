// CardPicker — choose one card from a small set that is not on the board (e.g. Ruh Çağrısı:
// a monster from either graveyard). Cards fan out over a dimmed screen, each with a small
// caption (whose graveyard); the hovered card's name and stats show in a line under the fan.
// Click one (or 1–9), İPTAL / Esc / right click cancels. Resolves with the chosen uid or null.
//
// Keys go through the shared UI focus stack (pushUiKeys), so Esc / digits never leak to the
// duel's own hotkeys (pause menu, B / E) while the picker is open.

import Phaser from 'phaser';
import { cardDef, isMonster, type CardId } from '../data/cards';
import { PAL, PLAYER_COLOR } from '../art/palette';
import { sfx } from '../audio/sfx';
import type { PlayerId, Uid } from '../engine/types';
import { pixelText } from '../ui/text';
import { Button } from '../view/Button';
import { CardSprite } from '../view/CardSprite';
import { CARD_H, DEPTH, GAME_H, GAME_W } from '../view/layout';
import { ICON, pushUiKeys } from '../view/ui-textures';
import { tween } from '../vfx/core';

export interface PickCard {
  uid: Uid;
  cardId: CardId;
  /** Shown as the owner tint (whose graveyard). */
  owner: PlayerId;
  /** Small caption under the card (e.g. "SENİN MEZARLIĞIN"). */
  label?: string;
}

export interface PickOpts {
  cancel?: boolean;
  /** Second, smaller line under the title. */
  subtitle?: string;
}

const CARD_Y = 150;

export async function pickCard(scene: Phaser.Scene, title: string, cards: PickCard[], o: PickOpts = {}): Promise<Uid | null> {
  const canCancel = o.cancel ?? true;
  const root = scene.add.container(0, 0).setDepth(DEPTH.OVERLAY - 10).setScrollFactor(0);
  const dim = scene.add.rectangle(0, 0, GAME_W, GAME_H, PAL.ink, 1).setOrigin(0).setAlpha(0).setInteractive();
  root.add(dim);
  void tween(scene, { targets: dim, alpha: 0.7, duration: 180 });
  const head = pixelText(scene, GAME_W / 2, 58, title, { size: 'md', color: PAL.gold4, originX: 0.5, originY: 0.5, shadow: 1 });
  root.add(head);
  if (o.subtitle) root.add(pixelText(scene, GAME_W / 2, 72, o.subtitle, { size: 'sm', color: PAL.mist, originX: 0.5, originY: 0.5 }));
  const info = pixelText(scene, GAME_W / 2, CARD_Y + CARD_H / 2 + 26, '', { size: 'sm', color: PAL.white, originX: 0.5, originY: 0.5 });
  root.add(info);
  const n = cards.length;
  const step = Math.min(60, Math.floor((GAME_W - 80) / Math.max(1, n)));
  const x0 = GAME_W / 2 - ((n - 1) * step) / 2;
  let resolve!: (v: Uid | null) => void;
  const result = new Promise<Uid | null>((r) => (resolve = r));
  let done = false;
  const finish = (v: Uid | null) => {
    if (done) return;
    done = true;
    resolve(v);
  };
  const describe = (c: PickCard) => {
    const d = cardDef(c.cardId);
    const stats = isMonster(d) ? ` · ATK ${d.atk} / DEF ${d.def}` : '';
    info.setText(`${d.name}${stats}`).setTint(PAL.white);
  };
  cards.forEach((c, i) => {
    const x = Math.round(x0 + i * step);
    const s = new CardSprite(scene, x, CARD_Y + 10, c.cardId, { faceUp: true, player: c.owner });
    s.setScrollFactor(0).setAlpha(0);
    root.add(s);
    if (c.label) {
      const cap = pixelText(scene, x, CARD_Y + CARD_H / 2 + 8, c.label, { size: 'sm', color: PLAYER_COLOR[c.owner], originX: 0.5, originY: 0.5 });
      root.add(cap);
    }
    if (n > 1 && i < 9) root.add(pixelText(scene, x - 22, CARD_Y - CARD_H / 2 - 6, String(i + 1), { size: 'sm', color: PAL.steel, originX: 0.5, originY: 0.5 }));
    s.setInteractive({ useHandCursor: true });
    s.on(Phaser.Input.Events.POINTER_OVER, () => {
      void s.hoverLift(true);
      s.setHighlight(PAL.gold3);
      describe(c);
      sfx.play('uiHover', { volume: 0.4 });
    });
    s.on(Phaser.Input.Events.POINTER_OUT, () => {
      void s.hoverLift(false);
      s.setHighlight(null);
    });
    s.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => {
      if (p.rightButtonReleased()) return;
      sfx.play('uiConfirm');
      finish(c.uid);
    });
    void tween(scene, { targets: s, alpha: 1, y: CARD_Y, duration: 220, delay: i * 50, ease: 'Back.Out' });
  });
  if (n) describe(cards[0]);
  let cancel: Button | null = null;
  if (canCancel) {
    cancel = new Button(scene, GAME_W / 2 - 36, CARD_Y + CARD_H / 2 + 40, { w: 72, h: 18, label: 'İPTAL', size: 'sm', icon: ICON.close, style: 'neutral' });
    cancel.setScrollFactor(0);
    cancel.onClick = () => {
      sfx.play('uiBack', { volume: 0.6 });
      finish(null);
    };
    root.add(cancel);
    dim.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => {
      if (p.rightButtonReleased()) finish(null);
    });
  }
  const release = pushUiKeys((e) => {
    if (e.key === 'Escape') {
      if (canCancel) {
        sfx.play('uiBack', { volume: 0.6 });
        finish(null);
      }
      return true;
    }
    const k = Number(e.key);
    if (Number.isInteger(k) && k >= 1 && k <= Math.min(9, n)) {
      sfx.play('uiConfirm');
      finish(cards[k - 1].uid);
      return true;
    }
    return e.key === 'Enter' || e.key === ' ';
  });
  const onShutdown = () => finish(null);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
  const v = await result;
  release();
  scene.events.off(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
  if (root.active) {
    await tween(scene, { targets: root, alpha: 0, duration: 160 });
    root.destroy();
  }
  return v;
}
