// Phone controls of the deck builder (only built when MOBILE: the Expo app or ?mobile=1). The desktop
// mouse + keyboard controls of DeckScene stay exactly as they were.
//
//   tap a card            show it, whole, in the middle panel (it is not added: a tap is for looking)
//   big - / +             under that panel: take a copy out / put a copy in
//   drag a card           from the collection onto the deck panel = add; from the deck out of it = remove
//                         (a mostly sideways drag, or a long press then any direction)
//   swipe up / down       scroll the collection, the deck list or the card text, with iOS-like momentum
//
// The scene hands over a narrow DeckTouchHost; this module never touches its state directly.

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { CARDS, type CardId } from '../../data/cards';
import { sfx } from '../../audio/sfx';
import { pixelText } from '../../ui/text';
import { Button } from '../../view/Button';
import { deckThumbTex, miniCardTex } from './art';
import type { Pt } from './fx';

/** Height of the big - / + buttons (the scene keeps this much room under the card text). */
export const TOUCH_STEP_H = 28;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CardHit {
  id: CardId;
  /** Collection index (pool) or flat deck entry (deck). */
  index: number;
  at: Pt;
}

export interface DeckTouchHost {
  /** A modal (rename, help, sort menu) or a scene change holds the screen. */
  blocked(): boolean;
  poolAt(x: number, y: number): CardHit | null;
  deckAt(x: number, y: number): CardHit | null;
  selectPool(index: number): void;
  selectDeck(flat: number): void;
  scrollPool(rows: number): void;
  scrollDeck(lines: number): void;
  scrollDetail(dir: number): void;
  add(id: CardId, poolIndex: number): void;
  remove(id: CardId, at: Pt | null): void;
  copies(id: CardId): number;
  canAdd(id: CardId): boolean;
  shown(): CardId | null;
  focusIndex(): number;
  say(text: string, tone: 'info' | 'ok' | 'bad' | 'gold'): void;
  /** Height of one deck list line (the deck scroll step). */
  rowPitch(): number;
  geo: {
    /** The collection grid. */
    pool: Rect;
    /** Collection row pitch (one scroll step). */
    poolPitch: number;
    /** The deck list (scrolls) and the whole deck panel (drop target). */
    deckList: Rect;
    deckPanel: Rect;
    /** The card text of the middle panel (scrolls) and the strip for the big buttons. */
    detailText: Rect;
    steps: Rect;
  };
}

type Region = 'pool' | 'deck' | 'detail' | null;
type Mode = 'pending' | 'scroll' | 'drag' | 'off';

/** Finger travel (game px) before a press becomes a swipe or a drag. */
const SLOP = 6;
/** Press-and-hold time (ms) that turns a still finger into a drag in any direction. */
const HOLD_MS = 280;
/** Momentum: velocity decay per 16.7 ms frame and the speed (px/ms) under which it stops. */
const FRICTION = 0.92;
const MIN_V = 0.04;

function inside(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

export class DeckTouch {
  private readonly scene: Phaser.Scene;
  private readonly host: DeckTouchHost;
  private mode: Mode = 'off';
  private region: Region = null;
  private hit: { from: 'pool' | 'deck'; card: CardHit } | null = null;
  private sx = 0;
  private sy = 0;
  private lastY = 0;
  private lastT = 0;
  private vel = 0;
  private acc = 0;
  private holdTimer: Phaser.Time.TimerEvent | null = null;
  private ghost: Phaser.GameObjects.Image | null = null;
  private dropGlow: Phaser.GameObjects.Rectangle | null = null;
  private coast: { region: Exclude<Region, null>; v: number } | null = null;
  private readonly minus: Button;
  private readonly plus: Button;
  private readonly hint: Phaser.GameObjects.BitmapText;

  constructor(scene: Phaser.Scene, host: DeckTouchHost) {
    this.scene = scene;
    this.host = host;
    const g = host.geo.steps;
    const bw = Math.floor((g.w - 4) / 2);
    this.minus = new Button(scene, g.x, g.y, { w: bw, h: TOUCH_STEP_H, label: '-', size: 'md', style: 'fire', depth: 20 });
    this.plus = new Button(scene, g.x + g.w - bw, g.y, { w: bw, h: TOUCH_STEP_H, label: '+', size: 'md', style: 'p1', depth: 20 });
    this.minus.onClick = () => this.step(-1);
    this.plus.onClick = () => this.step(1);
    this.hint = pixelText(scene, g.x + g.w / 2, g.y + 8, 'Tap a card', { size: 'sm', color: PAL.steel, originX: 0.5 }).setDepth(21);

    const inp = scene.input;
    const down = (p: Phaser.Input.Pointer) => this.onDown(p);
    const move = (p: Phaser.Input.Pointer) => this.onMove(p);
    const up = (p: Phaser.Input.Pointer) => this.onUp(p);
    const upd = (_t: number, dt: number) => this.tick(dt);
    inp.on(Phaser.Input.Events.POINTER_DOWN, down);
    inp.on(Phaser.Input.Events.POINTER_MOVE, move);
    inp.on(Phaser.Input.Events.POINTER_UP, up);
    inp.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, up);
    scene.events.on(Phaser.Scenes.Events.UPDATE, upd);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      inp.off(Phaser.Input.Events.POINTER_DOWN, down);
      inp.off(Phaser.Input.Events.POINTER_MOVE, move);
      inp.off(Phaser.Input.Events.POINTER_UP, up);
      inp.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, up);
      scene.events.off(Phaser.Scenes.Events.UPDATE, upd);
      this.endDrag(false);
    });
  }

  /** The big - / + follow the card shown in the middle panel. */
  renderSteps(id: CardId | null): void {
    const has = !!id;
    this.minus.setVisible(has);
    this.plus.setVisible(has);
    this.hint.setVisible(!has);
    if (!id) return;
    this.minus.setEnabled(this.host.copies(id) > 0);
    this.plus.setEnabled(this.host.canAdd(id));
  }

  // ------------------------------------------------------------ buttons

  private step(dir: 1 | -1): void {
    const id = this.host.shown();
    if (!id) return;
    if (dir > 0) {
      const i = this.host.focusIndex();
      this.host.add(id, i);
    } else if (this.host.copies(id) > 0) this.host.remove(id, null);
    this.renderSteps(this.host.shown());
  }

  // ------------------------------------------------------------ pointer

  private regionAt(x: number, y: number): Region {
    const g = this.host.geo;
    if (inside(g.pool, x, y)) return 'pool';
    if (inside(g.deckList, x, y)) return 'deck';
    if (inside(g.detailText, x, y)) return 'detail';
    return null;
  }

  private onDown(p: Phaser.Input.Pointer): void {
    this.coast = null;
    if (this.host.blocked()) {
      this.mode = 'off';
      return;
    }
    this.region = this.regionAt(p.x, p.y);
    if (!this.region) {
      this.mode = 'off';
      return;
    }
    const pool = this.region === 'pool' ? this.host.poolAt(p.x, p.y) : null;
    const deck = this.region === 'deck' ? this.host.deckAt(p.x, p.y) : null;
    this.hit = pool ? { from: 'pool', card: pool } : deck ? { from: 'deck', card: deck } : null;
    this.mode = 'pending';
    this.sx = p.x;
    this.sy = p.y;
    this.lastY = p.y;
    this.lastT = p.event?.timeStamp ?? this.scene.time.now;
    this.vel = 0;
    this.acc = 0;
    this.holdTimer?.remove();
    this.holdTimer = this.hit
      ? this.scene.time.delayedCall(HOLD_MS, () => {
          if (this.mode === 'pending' && this.hit) this.startDrag(p.x, p.y);
        })
      : null;
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!p.isDown || this.mode === 'off') return;
    const dx = p.x - this.sx;
    const dy = p.y - this.sy;
    if (this.mode === 'pending') {
      if (Math.hypot(dx, dy) < SLOP) return;
      this.holdTimer?.remove();
      this.holdTimer = null;
      // sideways = take the card along; up / down = scroll the panel under the finger
      if (this.hit && Math.abs(dx) > Math.abs(dy) * 1.2) this.startDrag(p.x, p.y);
      else this.mode = 'scroll';
    }
    if (this.mode === 'scroll') {
      const now = p.event?.timeStamp ?? this.scene.time.now;
      const d = this.lastY - p.y; // finger up = content moves up = scroll forward
      const dt = Math.max(1, now - this.lastT);
      this.vel = this.vel * 0.4 + (d / dt) * 0.6;
      this.lastY = p.y;
      this.lastT = now;
      this.scrollBy(this.region, d);
    } else if (this.mode === 'drag') this.moveDrag(p.x, p.y);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    this.holdTimer?.remove();
    this.holdTimer = null;
    const mode = this.mode;
    this.mode = 'off';
    if (mode === 'pending' && this.hit) {
      // a tap: show the card
      if (this.hit.from === 'pool') this.host.selectPool(this.hit.card.index);
      else this.host.selectDeck(this.hit.card.index);
    } else if (mode === 'scroll' && this.region) {
      const now = p.event?.timeStamp ?? this.scene.time.now;
      // a finger that stopped before lifting does not fling
      if (now - this.lastT > 80) this.vel = 0;
      if (Math.abs(this.vel) > MIN_V) this.coast = { region: this.region, v: Math.max(-2, Math.min(2, this.vel)) };
    } else if (mode === 'drag') this.drop(p.x, p.y);
    this.hit = null;
  }

  // ------------------------------------------------------------ scrolling

  private stepOf(region: Exclude<Region, null>): number {
    if (region === 'pool') return Math.round(this.host.geo.poolPitch * 0.8);
    if (region === 'deck') return this.host.rowPitch();
    return 18;
  }

  private scrollBy(region: Region, px: number): void {
    if (!region) return;
    const stepPx = this.stepOf(region);
    this.acc += px;
    while (Math.abs(this.acc) >= stepPx) {
      const dir = this.acc > 0 ? 1 : -1;
      this.acc -= dir * stepPx;
      if (region === 'pool') this.host.scrollPool(dir);
      else if (region === 'deck') this.host.scrollDeck(dir);
      else this.host.scrollDetail(dir);
    }
  }

  private tick(dt: number): void {
    const c = this.coast;
    if (!c) return;
    this.scrollBy(c.region, c.v * dt);
    c.v *= Math.pow(FRICTION, dt / 16.7);
    if (Math.abs(c.v) < MIN_V) {
      this.coast = null;
      this.acc = 0;
    }
  }

  // ------------------------------------------------------------ drag & drop

  private startDrag(x: number, y: number): void {
    if (!this.hit) return;
    this.mode = 'drag';
    const { id } = this.hit.card;
    const tex = this.hit.from === 'pool' ? miniCardTex(this.scene, id) : deckThumbTex(this.scene, id);
    this.ghost = this.scene.add.image(Math.round(x), Math.round(y), tex).setDepth(900).setAlpha(0.92);
    this.scene.tweens.add({ targets: this.ghost, scale: { from: 1, to: 1.15 }, duration: 110, ease: 'Back.Out' });
    const dp = this.host.geo.deckPanel;
    // pool → deck: the deck panel glows as the target; deck → out: everything left of it is the target
    this.dropGlow = this.scene.add
      .rectangle(dp.x + 1, dp.y + 1, dp.w - 2, dp.h - 2)
      .setOrigin(0)
      .setStrokeStyle(2, this.hit.from === 'pool' ? PAL.cyan3 : PAL.crim3)
      .setDepth(899)
      .setAlpha(0.25);
    sfx.play('uiHover', { volume: 0.5, pitch: 1.2 });
    this.host.say(this.hit.from === 'pool' ? `${CARDS[id].name}: drop it on the deck to add` : `${CARDS[id].name}: drop it outside the deck to remove`, 'info');
    this.moveDrag(x, y);
  }

  private overTarget(x: number, y: number): boolean {
    if (!this.hit) return false;
    const onDeck = inside(this.host.geo.deckPanel, x, y);
    return this.hit.from === 'pool' ? onDeck : !onDeck;
  }

  private moveDrag(x: number, y: number): void {
    if (!this.ghost) return;
    this.ghost.setPosition(Math.round(x), Math.round(y - 6));
    const hot = this.overTarget(x, y);
    this.ghost.setAlpha(hot ? 1 : 0.8);
    this.dropGlow?.setAlpha(this.hit?.from === 'pool' ? (hot ? 1 : 0.35) : hot ? 0.15 : 0.6);
  }

  private drop(x: number, y: number): void {
    const hit = this.hit;
    const ok = !!hit && this.overTarget(x, y);
    if (hit && ok) {
      if (hit.from === 'pool') this.host.add(hit.card.id, hit.card.index);
      else this.host.remove(hit.card.id, { x: Math.round(x), y: Math.round(y) });
      this.renderSteps(this.host.shown());
    }
    this.endDrag(!ok, hit?.card.at ?? null);
  }

  private endDrag(back: boolean, home: Pt | null = null): void {
    const g = this.ghost;
    this.ghost = null;
    this.dropGlow?.destroy();
    this.dropGlow = null;
    if (!g) return;
    if (back && home) {
      // not dropped on a target: the card floats home
      this.scene.tweens.add({ targets: g, x: home.x, y: home.y, scale: 1, alpha: 0, duration: 180, ease: 'Cubic.Out', onComplete: () => g.destroy() });
    } else if (back) g.destroy();
    else this.scene.tweens.add({ targets: g, scale: 0.6, alpha: 0, duration: 120, ease: 'Quad.In', onComplete: () => g.destroy() });
  }
}
