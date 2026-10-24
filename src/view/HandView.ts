// HandView — the active player's hand at UI.hand, plus a compact face-down mini-hand for the
// other player next to their panel (hot-seat: only the player at the screen sees cards).
//
//   const hand = new HandView(scene, { owner: 0 });
//   hand.onHover = (uid) => uid === null ? inspect.hide() : inspect.show(cardOf(uid));
//   hand.onSelect = (uid) => openMenuFor(uid);
//   hand.setCards([{ uid: 3, cardId: 'ember_wolf' }, ...], 0);   // instant (sync)
//   hand.setCards([...], 1);                                      // the other player → mini-hand count
//   await hand.addCard(9, 'judgment_bolt', deckXY);               // flies in, flips up, hand re-fans
//   const sprite = hand.takeCard(9);                              // detached CardSprite for a cinematic
//   hand.setPlayable([3, 9]);                                     // glowing outline in the player color
//   await hand.setOwner(1, true);                                 // hot-seat swap, P2's hand face-down
//   await hand.setFaceDown(false);                                // flip wave once P2 is ready
//   hand.setSelected(uid); hand.setHover(uid); hand.setEnabled(false);
//   hand.cardXY(uid) / hand.nextSlotXY() / hand.miniXY(player)    // anchors for cinematics
//   await hand.removeCard(uid);                                   // discard: rises + burns away
//
// Layout: cards fan on a wide arc with slight rotation; the hovered card straightens, rises
// and pushes its neighbours aside. Hover is resolved from the pointer x against the resting
// slots (no flicker), clicks select. Everything runs on scene tweens (speed / hit-stop aware).

import Phaser from 'phaser';
import type { CardId } from '../data/cards';
import { PAL, PLAYER_COLOR } from '../art/palette';
import { mix } from '../art/pixel';
import { sfx } from '../audio/sfx';
import type { PlayerId, Uid } from '../engine/types';
import { TEX, tween, wait } from '../vfx/core';
import { CardSprite } from './CardSprite';
import { ARENA_V2, CARD_H, CARD_W, DEPTH, GAME_H, UI, byArena, type XY, panelRect, zoneXY } from './layout';
import { MINI_CARD_H, MINI_CARD_W, miniCardKey, trayGlowTex } from './ui-textures';
import { V3_A6_A } from './v3flags';
import { miniHandBackKey } from './v3/cardBack';
import { createCardV3, type CardV3 } from './v3/CardV3';
import { EASE, HAND3, HandMotion, type LiftState, fanPose, handRim, hoverPitch, overshootEase, pxMove } from './v3/handV3';
import { REDUCED_MOTION } from './v3/motion';

export interface HandCard {
  uid: Uid;
  cardId: CardId;
}

interface Slot {
  uid: Uid;
  cardId: CardId;
  sprite: CardSprite;
  /** Being animated by someone else (fly-in): layout tweens leave it alone. */
  busy: boolean;
}

interface Pose {
  x: number;
  y: number;
  rot: number;
  /** v3: the slot's resting lean in whole degrees (baked, never a runtime rotation). */
  deg?: number;
}

const ADD = Phaser.BlendModes.ADD;
/**
 * Card center y at rest. v1: the bottom edge sits on the screen edge (326). v2 (compact HUD):
 * only the top ~42 px peek up (UI.handRestTop 318 → center 352); hovering lifts the card into
 * full view.
 */
const BASE_Y = byArena(326, UI.handRestTop + CARD_H / 2);
/** Extra lift of the hovered / selected card (CardSprite.hoverLift adds 6 more). */
const HOVER_LIFT = byArena(14, 22);
/** Neighbours move aside by this much when a card is hovered. */
const SPREAD = 13;
const MAX_STEP = 52;
const MAX_MINIS = 10;
/** Deepest dip of the outermost cards of the fan. */
const MAX_DIP = byArena(7, 4);
/** Lift of the cards marked in a multi-select (discard). */
const MARK_LIFT = byArena(9, 14);
/** v2: the lit tray strip the peeking hand rests on (screen-bottom glow behind the cards). */
const TRAY_H = 14;

export class HandView {
  onHover: ((uid: Uid | null) => void) | null = null;
  onSelect: ((uid: Uid) => void) | null = null;

  private readonly scene: Phaser.Scene;
  private ownerId: PlayerId;
  private faceDown: boolean;
  private readonly hands: Record<PlayerId, HandCard[]> = { 0: [], 1: [] };
  private slots: Slot[] = [];
  private hoverUid: Uid | null = null;
  private selectedUid: Uid | null = null;
  private playable = new Set<Uid>();
  /** Multi-select marks (end-phase discard): raised a little and outlined in markColor. */
  private marked = new Set<Uid>();
  private markColor: number = PAL.crim3;
  private enabled = true;
  private readonly zone: Phaser.GameObjects.Zone;
  private readonly minis: Record<PlayerId, Phaser.GameObjects.Image[]> = { 0: [], 1: [] };
  private miniCount: Record<PlayerId, number> = { 0: 0, 1: 0 };
  private pointer: XY | null = null;
  private swapping = false;
  /** v2 only: soft player-colored light under the peeking cards + its breathing tween. */
  private tray: Phaser.GameObjects.Image | null = null;
  private trayTween: Phaser.Tweens.Tween | null = null;
  private shimmerEvent: Phaser.Time.TimerEvent | null = null;
  /** v3 lane A6-A (K1): the whole-pixel stepper of the hand's cards (null: today's tweens). */
  private readonly motion: HandMotion | null = null;
  /** v3: when each card's last reject started (a second call within a frame or two joins it). */
  private readonly rejectAt = new Map<Uid, number>();
  /** v3: a face-down / face-up wave is turning the cards (rims off meanwhile). */
  private waving = false;

  constructor(scene: Phaser.Scene, opts: { owner?: PlayerId; faceDown?: boolean } = {}) {
    this.scene = scene;
    this.ownerId = opts.owner ?? 0;
    this.faceDown = opts.faceDown ?? false;
    if (V3_A6_A) this.motion = new HandMotion(scene, { px1: TEX.px1 });
    const r = UI.hand;
    this.zone = scene.add
      .zone(r.x, r.y - 18, r.w, r.h + 18)
      .setOrigin(0)
      .setDepth(DEPTH.HAND - 1)
      .setScrollFactor(0)
      .setInteractive();
    this.zone.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      this.pointer = { x: p.x, y: p.y };
      this.updateHover();
    });
    this.zone.on(Phaser.Input.Events.POINTER_OUT, () => {
      this.pointer = null;
      this.updateHover();
    });
    this.zone.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => {
      if (p.rightButtonReleased()) return;
      this.pointer = { x: p.x, y: p.y };
      this.updateHover();
      if (!this.enabled || this.swapping || this.hoverUid === null) return;
      const s = this.slot(this.hoverUid);
      if (!s) return;
      if (this.motion) return this.clickV3(s);
      sfx.play('uiClick', { volume: 0.6 });
      void s.sprite.punch(0.1, 160);
      this.onSelect?.(s.uid);
    });
    if (ARENA_V2) this.buildTray();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /**
   * v2 living detail: the peeking cards stand in a soft strip of their owner's light (ADD,
   * breathing slowly), and every few seconds a light sweep ripples across the playable cards.
   */
  private buildTray(): void {
    const sc = this.scene;
    const r = UI.hand;
    this.tray = sc.add
      .image(r.x + r.w / 2, GAME_H, trayGlowTex(sc, r.w + 24, TRAY_H))
      .setOrigin(0.5, 1)
      .setBlendMode(ADD)
      .setTint(PLAYER_COLOR[this.ownerId])
      .setAlpha(0.3)
      .setDepth(DEPTH.HAND - 1)
      .setScrollFactor(0);
    this.trayTween = sc.tweens.add({ targets: this.tray, alpha: { from: 0.28, to: 0.55 }, duration: 1600, ease: 'Sine.InOut', yoyo: true, repeat: -1 });
    this.shimmerEvent = sc.time.addEvent({ delay: 3400, startAt: 1500, loop: true, callback: () => this.shimmer() });
  }

  /** A sweep of light travels left → right over the playable (glowing) cards. */
  private shimmer(): void {
    if (!this.enabled || this.swapping || this.faceDown) return;
    let k = 0;
    for (const s of this.slots) {
      if (s.busy || !this.playable.has(s.uid) || s.uid === this.hoverUid || s.uid === this.selectedUid) continue;
      const sprite = s.sprite;
      this.scene.time.delayedCall(k++ * 90, () => sprite.active && sprite.playSweep(false));
    }
  }

  // ================================================================ state

  get owner(): PlayerId {
    return this.ownerId;
  }

  get isFaceDown(): boolean {
    return this.faceDown;
  }

  /** Uids shown in the main hand (left → right). */
  get uids(): Uid[] {
    return this.slots.map((s) => s.uid);
  }

  /** The CardSprite of a hand card (still owned by the hand). */
  sprite(uid: Uid): CardSprite | null {
    return this.slot(uid)?.sprite ?? null;
  }

  /** Resting screen position of a hand card. */
  cardXY(uid: Uid): XY | null {
    const i = this.slots.findIndex((s) => s.uid === uid);
    if (i < 0) return null;
    const p = this.pose(i, this.slots.length, -1);
    return { x: p.x, y: p.y };
  }

  /** Where the next drawn card will land (for draw cinematics). */
  nextSlotXY(): XY {
    const p = this.pose(this.slots.length, this.slots.length + 1, -1);
    return { x: p.x, y: p.y };
  }

  /** Screen point of the mini-hand of a (non-owner) player. */
  miniXY(player: PlayerId, index = this.miniCount[player]): XY {
    const n = Math.min(MAX_MINIS, Math.max(index + 1, this.miniCount[player]));
    return this.miniPos(player, Math.min(index, MAX_MINIS - 1), n);
  }

  /**
   * Force the hovered card (keyboard navigation, tutorials, dev previews). null clears.
   * Pointer movement over the hand overrides it again.
   */
  setHover(uid: Uid | null): void {
    if (uid !== null && !this.slot(uid)) uid = null;
    if (uid === this.hoverUid) return;
    this.hoverUid = uid;
    this.layout(true);
    this.onHover?.(uid);
  }

  /** Enable / disable hover + click (cinematics). Clears the hover state when disabled. */
  setEnabled(b: boolean): void {
    this.enabled = b;
    this.updateHover();
    if (this.motion) this.applyHighlights(); // v3: a locked hand dims its rims and holds the nodes
  }

  /**
   * Instantly replace a player's hand (views.sync). If it is the owner's hand, the sprites
   * are rebuilt in their resting fan; otherwise only the mini-hand count changes.
   */
  setCards(list: HandCard[], player: PlayerId = this.ownerId): void {
    this.hands[player] = list.map((c) => ({ ...c }));
    if (player !== this.ownerId) {
      this.setMiniCount(player, list.length, false);
      return;
    }
    const keep = new Map(this.slots.map((s) => [s.uid, s]));
    const next: Slot[] = [];
    for (const c of list) {
      const old = keep.get(c.uid);
      if (old && old.cardId === c.cardId && !old.busy) {
        keep.delete(c.uid);
        next.push(old);
      } else next.push(this.makeSlot(c));
    }
    for (const s of keep.values()) s.sprite.destroy();
    this.slots = next;
    if (this.hoverUid !== null && !this.slot(this.hoverUid)) this.hoverUid = null;
    if (this.selectedUid !== null && !this.slot(this.selectedUid)) this.selectedUid = null;
    for (const s of this.slots) {
      s.sprite.setFaceUp(!this.faceDown).setPlayerTint(this.ownerId).setVisible(true).setAlpha(1);
      s.sprite.inner.setScale(1);
    }
    this.setMiniCount(this.ownerId, 0, false);
    this.applyHighlights();
    this.layout(false);
  }

  /** Explicitly set the mini-hand size of a non-owner player. */
  setOpponentCount(player: PlayerId, n: number, animate = true): void {
    if (player === this.ownerId) return;
    this.setMiniCount(player, n, animate);
  }

  /** Cards that can be played now: glowing outline in the owner's color. */
  setPlayable(uids: Iterable<Uid>): void {
    this.playable = new Set(uids);
    this.applyHighlights();
  }

  /** Mark cards of a multi-select (e.g. the cards to discard): raised + outlined. [] clears. */
  setMarked(uids: Iterable<Uid>, color: number = PAL.crim3): void {
    this.marked = new Set(uids);
    this.markColor = color;
    this.applyHighlights();
    this.layout(true);
  }

  /** Keep a card raised + gold outlined (while its action menu is open). null clears. */
  setSelected(uid: Uid | null): void {
    this.selectedUid = uid;
    this.applyHighlights();
    this.layout(true);
  }

  // ================================================================ animations

  /**
   * Draw: a card flies in from `from` (default: the owner's deck tile), flips face-up mid-air
   * and lands in its slot while the hand re-fans. For a non-owner player the card shrinks
   * into their mini-hand instead.
   */
  async addCard(uid: Uid, cardId: CardId, from?: XY, player: PlayerId = this.ownerId): Promise<void> {
    const start = from ?? zoneXY(player, 'deck');
    sfx.play('cardDraw');
    if (player !== this.ownerId) {
      this.hands[player].push({ uid, cardId });
      const idx = this.miniCount[player];
      const target = this.miniXY(player, idx);
      const c = new CardSprite(this.scene, start.x, start.y, null, { player }).setDepth(DEPTH.HAND + 30).setScale(0.5);
      c.setScrollFactor(0);
      c.setTrail(true);
      await c.flyTo(target.x, target.y, { ms: 340, arc: 30, scale: MINI_CARD_W / CARD_W, land: false });
      c.destroy();
      this.setMiniCount(player, this.miniCount[player] + 1, true);
      return;
    }
    this.hands[player].push({ uid, cardId });
    const s = this.makeSlot({ uid, cardId });
    s.busy = true;
    s.sprite.setPosition(start.x, start.y).setScale(0.5).setFaceUp(false).setDepth(DEPTH.HAND + 30);
    this.slots.push(s);
    this.applyHighlights();
    this.layout(true);
    const n = this.slots.length;
    const target = this.pose(n - 1, n, this.hoverIndex());
    s.sprite.setTrail(true);
    await s.sprite.flyTo(target.x, target.y, { ms: 360, arc: 54, scale: 1, rotation: target.rot, reveal: !this.faceDown, land: false });
    s.busy = false;
    // a sync (setCards) or takeCard during the flight replaced / removed this slot
    if (!this.slots.includes(s) || !s.sprite.active) return;
    s.sprite.setTrail(false);
    this.layout(true);
    sfx.play('cardPlace', { volume: 0.5 });
    await s.sprite.punch(0.12, 200);
  }

  /**
   * Detach a card from the hand and hand its CardSprite to the caller (summon / set / spell
   * cinematics). It stays where it is (top of the hand band); the rest of the hand closes up.
   */
  takeCard(uid: Uid): CardSprite | null {
    return this.detach(uid, false);
  }

  /** takeCard; v3: `keepLean` leaves a leaning card leaning (the caller straightens it, removeCard). */
  private detach(uid: Uid, keepLean: boolean): CardSprite | null {
    const i = this.slots.findIndex((s) => s.uid === uid);
    if (i < 0) return null;
    const s = this.slots[i];
    this.slots.splice(i, 1);
    this.hands[this.ownerId] = this.hands[this.ownerId].filter((c) => c.uid !== uid);
    if (this.hoverUid === uid) {
      this.hoverUid = null;
      this.onHover?.(null);
    }
    if (this.selectedUid === uid) this.selectedUid = null;
    this.motion?.release(s.sprite, keepLean);
    this.scene.tweens.killTweensOf(s.sprite);
    s.sprite.setHighlight(null);
    void s.sprite.hoverLift(false);
    s.sprite.setDepth(DEPTH.HAND + 30);
    this.layout(true);
    return s.sprite;
  }

  /** Remove a card with an effect: 'dissolve' (discard: burns into embers) or 'fade'. */
  async removeCard(uid: Uid, how: 'dissolve' | 'fade' = 'dissolve'): Promise<void> {
    const mo = this.motion;
    const c = this.detach(uid, mo !== null);
    if (!c) return;
    if (mo) {
      // v3: whole-pixel moves, no fade (the dissolve itself is the card's); a leaning card turns
      // upright through its baked steps as it lifts (v1 turned it to 0 in the same move)
      const up = mo.lean(c, 0, HAND3.tiltMs);
      if (how === 'dissolve') {
        await Promise.all([pxMove(this.scene, c, { y: c.y - 16 }, 160, EASE.outQuad), up]);
        mo.release(c);
        await c.dissolve(620);
      } else {
        await Promise.all([pxMove(this.scene, c, { y: c.y + 20 }, 220, EASE.inQuad), up]);
        mo.release(c);
        c.setVisible(false);
      }
    } else if (how === 'dissolve') {
      await tween(this.scene, { targets: c, y: c.y - 16, rotation: 0, duration: 160, ease: 'Quad.Out' });
      await c.dissolve(620);
    } else await tween(this.scene, { targets: c, alpha: 0, y: c.y + 20, duration: 220 });
    c.destroy();
  }

  /** Flip the whole hand face-down / face-up in a left-to-right wave. */
  async setFaceDown(faceDown: boolean): Promise<void> {
    if (this.motion) return this.waveFaceDown(faceDown, HAND3.waveStepMs); // v3: sharp turn frames
    if (faceDown === this.faceDown) return;
    this.faceDown = faceDown;
    if (!faceDown) sfx.play('cardFlip');
    const jobs = this.slots.map(async (s, i) => {
      await wait(this.scene, i * 55);
      await s.sprite.flip(!faceDown, 240);
    });
    await Promise.all(jobs);
    this.applyHighlights();
  }

  // ---------------------------------------------------------------- v3 lane interfaces (S-9)
  // A56.0 stubs with frozen signatures (docs/v3/A6_PLAN.md §4.1): today's behaviour. Lane A6-A
  // (step A2) fills them behind V3_A6_A; lane A6-B calls them from day one (F5 reject, F7 curtain).

  /**
   * Refuse a click on hand card `uid` (K1 / F5): x +2 −2 +1 −1 0 in 30 ms steps (150 ms) with two
   * crimson frames on its rim, uiError. Never locks. A second call within 60 ms joins the running
   * one (the hand already refuses clicks on unplayable cards itself). Lane A6-A off: nothing (today).
   */
  async reject(uid: Uid): Promise<void> {
    const mo = this.motion;
    if (!mo) return;
    const s = this.slot(uid);
    if (!s || s.busy || !s.sprite.active) return;
    const now = this.scene.time.now;
    const last = this.rejectAt.get(uid);
    if (last !== undefined && now - last >= 0 && now - last < 60) return;
    this.rejectAt.set(uid, now);
    sfx.play('uiError', { volume: 0.4 });
    (s.sprite as CardV3).flashRim(PAL.crim3, REDUCED_MOTION ? HAND3.flashMs * 2 : HAND3.flashMs);
    mo.reject(s.sprite);
    await wait(this.scene, HAND3.rejectStepMs * HAND3.reject.length);
  }

  /**
   * Turn the whole hand face-down / face-up in a wave, `msPerCard` apart (F7 curtain: 30 ms), each
   * card in its sharp turn frames (S-9). Lane A6-A off: today's setFaceDown wave.
   */
  async waveFaceDown(down: boolean, msPerCard = 30): Promise<void> {
    if (!this.motion) {
      void msPerCard;
      await this.setFaceDown(down);
      return;
    }
    if (down === this.faceDown) return;
    this.faceDown = down;
    if (!down) sfx.play('cardFlip');
    this.waving = true;
    this.applyHighlights();
    const jobs = this.slots.map(async (s, i) => {
      if (i > 0) await wait(this.scene, i * Math.max(0, msPerCard));
      if (!s.sprite.active) return;
      await s.sprite.flip(!down, HAND3.turnMs);
    });
    await Promise.all(jobs);
    this.waving = false;
    this.applyHighlights();
  }

  /**
   * Hot-seat swap: the current hand drops out of view in a wave, the mini-hands trade
   * places, and `player`'s hand rises in (face-down if asked). Same owner → setFaceDown.
   */
  async setOwner(player: PlayerId, faceDown = false): Promise<void> {
    if (player === this.ownerId) {
      await this.setFaceDown(faceDown);
      return;
    }
    if (this.motion) return this.setOwnerV3(player, faceDown);
    this.swapping = true;
    if (this.hoverUid !== null) {
      this.hoverUid = null;
      this.onHover?.(null);
    }
    this.selectedUid = null;
    const old = this.slots;
    const prev = this.ownerId;
    sfx.play('cardSlide');
    // 1. outgoing: little lift, then drop out of view (wave from the outside in)
    const mid = (old.length - 1) / 2;
    const outgoing = Promise.all(
      old.map(async (s, i) => {
        s.sprite.setHighlight(null);
        await wait(this.scene, Math.abs(i - mid) * 40);
        this.scene.tweens.killTweensOf(s.sprite);
        await tween(this.scene, { targets: s.sprite, y: s.sprite.y - 6, duration: 90, ease: 'Quad.Out' });
        await tween(this.scene, {
          targets: s.sprite,
          y: GAME_H + CARD_H,
          rotation: s.sprite.rotation + (i < mid ? -0.25 : 0.25),
          duration: 230,
          ease: 'Back.In',
        });
        s.sprite.destroy();
      }),
    );
    // 2. while they fall, the previous owner becomes a mini-hand and the new owner's minis leave
    await wait(this.scene, 200);
    this.ownerId = player;
    this.faceDown = faceDown;
    this.tray?.setTint(PLAYER_COLOR[player]);
    this.setMiniCount(player, 0, true);
    this.setMiniCount(prev, this.hands[prev].length, true);
    // 3. incoming: rise from below in a wave from the center out, overlapping the exit
    this.slots = this.hands[player].map((c) => this.makeSlot(c));
    const n = this.slots.length;
    const m2 = (n - 1) / 2;
    sfx.play('cardSlide', { pitch: 1.15 });
    const incoming = Promise.all(
      this.slots.map(async (s, i) => {
        const p = this.pose(i, n, -1);
        s.busy = true;
        s.sprite.setPosition(p.x, GAME_H + CARD_H).setRotation(p.rot * 3).setFaceUp(!faceDown);
        await wait(this.scene, 90 + Math.abs(i - m2) * 50);
        await tween(this.scene, { targets: s.sprite, x: p.x, y: p.y, rotation: p.rot, duration: 340, ease: 'Back.Out', easeParams: [1.4] });
        s.busy = false;
      }),
    );
    await Promise.all([outgoing, incoming]);
    this.swapping = false;
    this.applyHighlights();
    this.layout(false);
    this.updateHover();
  }

  destroy(): void {
    this.motion?.destroy();
    this.trayTween?.stop();
    this.shimmerEvent?.remove();
    this.tray?.destroy();
    this.tray = null;
    for (const s of this.slots) s.sprite.destroy();
    this.slots = [];
    for (const p of [0, 1] as PlayerId[]) for (const m of this.minis[p]) m.destroy();
    this.zone.destroy();
  }

  // ================================================================ internals

  private slot(uid: Uid): Slot | undefined {
    return this.slots.find((s) => s.uid === uid);
  }

  private makeSlot(c: HandCard): Slot {
    const at = { x: UI.hand.x + UI.hand.w / 2, y: GAME_H + CARD_H };
    const sprite = this.motion
      ? createCardV3(this.scene, c.cardId, { x: at.x, y: at.y, faceUp: !this.faceDown, player: this.ownerId }) // v3 (K1, KO-1)
      : new CardSprite(this.scene, at.x, at.y, c.cardId, {
          faceUp: !this.faceDown,
          player: this.ownerId,
        });
    sprite.setDepth(DEPTH.HAND).setScrollFactor(0);
    return { uid: c.uid, cardId: c.cardId, sprite, busy: false };
  }

  private hoverIndex(): number {
    const uid = this.hoverUid ?? this.selectedUid;
    return uid === null ? -1 : this.slots.findIndex((s) => s.uid === uid);
  }

  /** Resting fan pose of card i of n, with card h raised (−1 = none). */
  private pose(i: number, n: number, h: number): Pose {
    if (this.motion) return { ...fanPose(i, n, h, UI.hand, CARD_W), rot: 0 }; // v3: v1's arc, the lean baked (deg)
    const r = UI.hand;
    const cx = r.x + r.w / 2;
    const step = n <= 1 ? 0 : Math.min(MAX_STEP, (r.w - CARD_W - 8) / (n - 1));
    const off = i - (n - 1) / 2;
    const dRot = Math.min(0.05, 0.22 / Math.max(1, n - 1));
    let x = cx + off * step;
    // arc: the outer cards dip like a held hand, at most MAX_DIP px however many cards there are
    const half = Math.max(1, (n - 1) / 2);
    let y = BASE_Y + off * off * Math.min(1.4, MAX_DIP / (half * half));
    let rot = off * dRot;
    if (h >= 0 && i !== h) {
      const d = i - h;
      const push = SPREAD * Math.max(0.35, 1 - (Math.abs(d) - 1) * 0.35);
      x += Math.sign(d) * push;
    }
    if (i === h) {
      y = BASE_Y - HOVER_LIFT;
      rot = 0;
    } else if (this.marked.size && this.slots[i] && this.marked.has(this.slots[i].uid)) {
      y = BASE_Y - MARK_LIFT;
      rot *= 0.5;
    }
    return { x: Math.round(x), y: Math.round(y), rot };
  }

  /** Move every card to its fan pose. */
  private layout(animate: boolean): void {
    if (this.motion) return this.layoutV3(animate);
    const n = this.slots.length;
    const h = this.hoverIndex();
    this.slots.forEach((s, i) => {
      const p = this.pose(i, n, h);
      const raised = i === h;
      if (!s.busy) s.sprite.setDepth(raised ? DEPTH.HAND + 20 : DEPTH.HAND + i);
      if (s.busy) return;
      this.scene.tweens.killTweensOf(s.sprite);
      if (!animate) {
        s.sprite.setPosition(p.x, p.y).setRotation(p.rot);
      } else {
        this.scene.tweens.add({
          targets: s.sprite,
          x: p.x,
          y: p.y,
          rotation: p.rot,
          duration: raised ? 150 : 220,
          ease: raised ? 'Back.Out' : 'Cubic.Out',
        });
      }
      void s.sprite.hoverLift(raised);
    });
  }

  private applyHighlights(): void {
    if (this.motion) return this.applyRimsV3();
    const col = PLAYER_COLOR[this.ownerId];
    for (const s of this.slots) {
      if (this.faceDown) s.sprite.setHighlight(null);
      else if (s.uid === this.selectedUid) s.sprite.setHighlight(PAL.gold3);
      else if (this.marked.has(s.uid)) s.sprite.setHighlight(this.markColor);
      else if (this.playable.has(s.uid)) s.sprite.setHighlight(col);
      else s.sprite.setHighlight(null);
    }
  }

  /** Nearest resting slot to the pointer (hand region only). */
  private updateHover(): void {
    let next: Uid | null = null;
    const n = this.slots.length;
    if (this.enabled && !this.swapping && this.pointer && n > 0) {
      const { x, y } = this.pointer;
      const first = this.pose(0, n, -1);
      const last = this.pose(n - 1, n, -1);
      const top = BASE_Y - CARD_H / 2 - (this.hoverUid !== null ? (this.motion ? HAND3.lift : HOVER_LIFT + 6) : 0);
      if (x >= first.x - CARD_W / 2 - 2 && x <= last.x + CARD_W / 2 + 2 && y >= top) {
        let best = Infinity;
        for (let i = 0; i < n; i++) {
          const p = this.pose(i, n, -1);
          const d = Math.abs(p.x - x);
          if (d < best) {
            best = d;
            next = this.slots[i].uid;
          }
        }
      }
    }
    if (next === this.hoverUid) return;
    this.hoverUid = next;
    // a hand card under the pointer is clickable: show it
    this.scene.input.setDefaultCursor(next !== null ? 'pointer' : 'default');
    if (next !== null) {
      // v3: the hover ticks climb a pentatonic ladder across the hand (K1)
      const i = this.motion ? this.slots.findIndex((s) => s.uid === next) : -1;
      sfx.play('uiHover', { volume: 0.35, pitch: this.motion ? hoverPitch(i, n) : 1.2 });
    }
    this.layout(true);
    this.onHover?.(next);
  }

  // ---------------------------------------------------------------- v3 (lane A6-A, K1)

  /** v3: every card to its fan slot through HandMotion (whole pixels, the lean baked), rims refreshed. */
  private layoutV3(animate: boolean): void {
    const mo = this.motion!;
    const n = this.slots.length;
    const h = this.hoverIndex();
    this.slots.forEach((s, i) => {
      if (s.busy) {
        mo.release(s.sprite, true);
        return;
      }
      const p = this.pose(i, n, h);
      const selected = s.uid === this.selectedUid;
      const raised = i === h;
      s.sprite.setDepth(raised || selected ? DEPTH.HAND + 20 : DEPTH.HAND + i);
      const state: LiftState = selected ? 'select' : raised ? 'hover' : this.marked.has(s.uid) ? 'mark' : 'rest';
      const was = mo.stateOf(s.sprite);
      mo.place(s.sprite, p.x, p.y, state, animate, i * HAND3.breathStep, p.deg ?? 0);
      // the settle (K1 "Oturma"): two white frames on the rim as the card lands on its lift
      if (animate && state === 'hover' && was !== null && was !== 'hover' && was !== 'select' && !REDUCED_MOTION) {
        const card = s.sprite as CardV3;
        mo.cue(card, HAND3.riseMs, () => card.flashRim(PAL.white, HAND3.flashMs, 'style'));
      }
    });
    this.applyRimsV3();
  }

  /** v3: the rims (KO-3) — playable / hovered / selected / marked / locked (handRim). */
  private applyRimsV3(): void {
    for (const s of this.slots) {
      const c = s.sprite as CardV3;
      if (!c.active || typeof c.setRim !== 'function') continue;
      if (s.busy || this.waving) {
        c.setRim(null);
        continue;
      }
      c.setRim(
        handRim({
          owner: this.ownerId,
          faceDown: this.faceDown,
          playable: this.playable.has(s.uid),
          hover: s.uid === this.hoverUid,
          selected: s.uid === this.selectedUid,
          marked: this.marked.has(s.uid),
          markColor: this.markColor,
          locked: !this.enabled,
        }),
      );
    }
  }

  /**
   * v3 click (K1 / F5): a card that can be played now is pressed (two white rim frames, −16 → −13 →
   * −17 → −16) and selected; any other is refused where it is (reject). The choice goes on to the
   * input either way (it shows the reason in the hint line, as today).
   */
  private clickV3(s: Slot): void {
    if (this.faceDown || s.busy) {
      this.onSelect?.(s.uid);
      return;
    }
    if (this.playable.has(s.uid) || s.uid === this.selectedUid) {
      sfx.play('uiClick', { volume: 0.6 });
      (s.sprite as CardV3).flashRim(PAL.white, HAND3.flashMs);
      this.motion!.press(s.sprite);
    } else void this.reject(s.uid);
    this.onSelect?.(s.uid);
  }

  /**
   * v3 hot-seat swap: today's choreography and timing (the outgoing hand drops in a wave from the
   * outside in, the incoming one rises from the centre out) on whole pixels, the rise landing with a
   * 2-px overshoot (KO-2). The leans are v1's, baked: a falling card leans 14° further outwards, a
   * rising one closes from three times its lean onto its slot's.
   */
  private async setOwnerV3(player: PlayerId, faceDown: boolean): Promise<void> {
    const mo = this.motion!;
    this.swapping = true;
    if (this.hoverUid !== null) {
      this.hoverUid = null;
      this.onHover?.(null);
    }
    this.selectedUid = null;
    const old = this.slots;
    const prev = this.ownerId;
    sfx.play('cardSlide');
    const mid = (old.length - 1) / 2;
    const outgoing = Promise.all(
      old.map(async (s, i) => {
        mo.release(s.sprite, true);
        s.sprite.setHighlight(null);
        await wait(this.scene, Math.abs(i - mid) * 40);
        if (!s.sprite.active) return;
        await pxMove(this.scene, s.sprite, { y: s.sprite.y - 6 }, 90, EASE.outQuad);
        if (!s.sprite.active) return;
        const out = mo.leanOf(s.sprite) + (i < mid ? -HAND3.swapLean : HAND3.swapLean);
        await Promise.all([pxMove(this.scene, s.sprite, { y: GAME_H + CARD_H }, 230, EASE.inCubic), mo.lean(s.sprite, out, 230)]);
        s.sprite.destroy();
      }),
    );
    await wait(this.scene, 200);
    this.ownerId = player;
    this.faceDown = faceDown;
    this.setMiniCount(player, 0, true);
    this.setMiniCount(prev, this.hands[prev].length, true);
    this.slots = this.hands[player].map((c) => this.makeSlot(c));
    const n = this.slots.length;
    const m2 = (n - 1) / 2;
    sfx.play('cardSlide', { pitch: 1.15 });
    const incoming = Promise.all(
      this.slots.map(async (s, i) => {
        const p = this.pose(i, n, -1);
        s.busy = true;
        s.sprite.setPosition(p.x, GAME_H + CARD_H).setFaceUp(!faceDown);
        await wait(this.scene, 90 + Math.abs(i - m2) * 50);
        const dist = Math.max(1, GAME_H + CARD_H - p.y);
        const deg = p.deg ?? 0;
        const fan = Math.max(-HAND3.swapFanMax, Math.min(HAND3.swapFanMax, deg * HAND3.swapFan));
        if (s.sprite.active)
          await Promise.all([
            pxMove(this.scene, s.sprite, { x: p.x, y: p.y }, 340, REDUCED_MOTION ? EASE.outCubic : overshootEase(2 / dist)),
            mo.lean(s.sprite, deg, 340, fan),
          ]);
        s.busy = false;
      }),
    );
    await Promise.all([outgoing, incoming]);
    this.swapping = false;
    this.applyHighlights();
    // animated: a card drawn while the hand rose (the v3 turn runs the handover in the background)
    // re-fanned the hand under the rising cards — they glide to their new slots and lean through
    // the baked steps instead of jumping there in one frame (nothing changed: nothing moves)
    this.layout(true);
    this.updateHover();
  }

  /**
   * v3 mini-hand (K1 "P2"): the owner's v3 backs (S-2) tucked behind the panel edge; a new card
   * slides out of the panel, a leaving one slides back in, the rest re-fan — whole pixels, no
   * scale pop, no tint flash, no ADD sparks.
   */
  private setMiniCountV3(player: PlayerId, n: number, animate: boolean): void {
    n = Math.max(0, n);
    const list = this.minis[player];
    const shown = Math.min(n, MAX_MINIS);
    this.miniCount[player] = n;
    const move = animate && !REDUCED_MOTION;
    // P1's minis sit above its panel (they tuck down into it), P2's below its panel (up into it)
    const tuck = player === 0 ? 6 : -6;
    while (list.length > shown) {
      const img = list.pop()!;
      if (move) void pxMove(this.scene, img, { y: img.y + tuck }, 100, EASE.inQuad).then(() => img.active && img.destroy());
      else img.destroy();
    }
    const first = list.length;
    while (list.length < shown) {
      const i = list.length;
      const p = this.miniPos(player, i, shown);
      const img = this.scene.add
        .image(p.x, p.y + (move ? tuck : 0), miniHandBackKey(this.scene, player))
        .setOrigin(Math.floor(MINI_CARD_W / 2) / MINI_CARD_W, Math.floor(MINI_CARD_H / 2) / MINI_CARD_H)
        .setDepth(DEPTH.HUD - 1 + i * 0.01)
        .setScrollFactor(0);
      list.push(img);
    }
    list.forEach((img, i) => {
      const p = this.miniPos(player, i, shown);
      if (!move) img.setPosition(p.x, p.y);
      else void pxMove(this.scene, img, { x: p.x, y: p.y }, 160, EASE.outCubic, i >= first ? (i - first) * 30 : 0);
    });
  }

  // ---------------------------------------------------------------- mini-hands

  /**
   * Mini-hand fan: centered on the panel, tucked half behind its edge (below P2's panel,
   * above P1's), the outer cards dipping a little like a held hand.
   */
  private miniPos(player: PlayerId, i: number, n: number): XY {
    const r = panelRect(player);
    const off = i - (n - 1) / 2;
    const dip = Math.round(off * off * 0.35);
    const x = Math.round(r.x + r.w / 2 + off * 7);
    if (player === 0) return { x, y: r.y - 5 + dip };
    return { x, y: r.y + r.h + 5 - dip };
  }

  private setMiniCount(player: PlayerId, n: number, animate: boolean): void {
    if (this.motion) return this.setMiniCountV3(player, n, animate);
    n = Math.max(0, n);
    const list = this.minis[player];
    const shown = Math.min(n, MAX_MINIS);
    this.miniCount[player] = n;
    // remove (the newest leave first)
    while (list.length > shown) {
      const img = list.pop()!;
      if (animate) {
        this.scene.tweens.killTweensOf(img);
        this.scene.tweens.add({
          targets: img,
          y: img.y + (player === 0 ? -12 : 12),
          alpha: 0,
          duration: 200,
          ease: 'Quad.In',
          onComplete: () => img.destroy(),
        });
      } else img.destroy();
    }
    // add
    while (list.length < shown) {
      const i = list.length;
      const p = this.miniPos(player, i, shown);
      const img = this.scene.add
        .image(p.x, p.y, V3_A6_A ? miniHandBackKey(this.scene, player) : miniCardKey(player)) // v3 A6-A: the owner's v3 back (S-2)
        .setDepth(DEPTH.HUD - 1 + i * 0.01)
        .setScrollFactor(0);
      list.push(img);
      if (animate) {
        // pops in with a one-frame white flash as it lands (not a white blob while growing)
        img.setScale(0);
        this.scene.tweens.add({
          targets: img,
          scale: 1,
          duration: 200,
          ease: 'Back.Out',
          easeParams: [2.2],
          delay: i * 30,
          onComplete: () => {
            if (!img.active) return;
            img.setTintFill(mix(PLAYER_COLOR[player], PAL.white, 0.6));
            this.scene.time.delayedCall(34, () => img.active && img.clearTint());
          },
        });
        this.scene.time.delayedCall(i * 30, () => this.miniSpark(p, PLAYER_COLOR[player]));
      }
    }
    // re-fan
    list.forEach((img, i) => {
      const p = this.miniPos(player, i, shown);
      if (!animate) img.setPosition(p.x, p.y);
      else this.scene.tweens.add({ targets: img, x: p.x, y: p.y, duration: 200, ease: 'Cubic.Out' });
    });
  }

  private miniSpark(p: XY, color: number): void {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const sp = this.scene.add
        .image(p.x, p.y, TEX.px1)
        .setTint(k % 2 ? color : mix(color, PAL.white, 0.6))
        .setBlendMode(ADD)
        .setDepth(DEPTH.HUD + 2)
        .setScrollFactor(0);
      this.scene.tweens.add({
        targets: sp,
        x: p.x + Math.cos(a) * 9,
        y: p.y + Math.sin(a) * 11,
        alpha: 0,
        duration: 260,
        ease: 'Cubic.Out',
        onComplete: () => sp.destroy(),
      });
    }
  }
}

