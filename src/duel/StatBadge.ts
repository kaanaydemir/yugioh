// StatBadge — the little ATK/DEF plate on the tile in front of a monster.
//
//   [ 2800 / 2300 ]   the stat of the current position is bright, the other dim;
//                     raised values are green, lowered red (vs the printed card values).
//
// Drawn into a tiny PixelCanvas with the 3×5 card digit font (crisp at 1×) and re-rendered
// while a value rolls. Lives at DEPTH.FX - 20 so other units never hide it.

import Phaser from 'phaser';
import { PAL, PLAYER_RAMP } from '../art/palette';
import { PixelCanvas } from '../art/pixel';
import { digitsWidth, drawDigits } from '../art/cards';
import type { PlayerId, Position } from '../engine/types';
import { DEPTH } from '../view/layout';
import { tween, tweenValue } from '../vfx/core';

let badgeSeq = 0;

export const BADGE_DEPTH = DEPTH.FX - 20;

export class StatBadge {
  readonly scene: Phaser.Scene;
  readonly image: Phaser.GameObjects.Image;
  private readonly key: string;
  private tex: Phaser.Textures.CanvasTexture | null = null;
  private player: PlayerId;
  private position: Position;
  private baseAtk: number;
  private baseDef: number;
  /** Displayed (possibly mid-roll) values. */
  private shownAtk: number;
  private shownDef: number;
  /** Target values. */
  atk: number;
  def: number;
  private flashT = 0;
  private rollToken = 0;
  private shown = true;

  constructor(scene: Phaser.Scene, x: number, y: number, o: { player: PlayerId; position: Position; atk: number; def: number; baseAtk: number; baseDef: number }) {
    this.scene = scene;
    this.player = o.player;
    this.position = o.position;
    this.baseAtk = o.baseAtk;
    this.baseDef = o.baseDef;
    this.atk = this.shownAtk = o.atk;
    this.def = this.shownDef = o.def;
    this.key = `duel:badge:${++badgeSeq}`;
    this.image = scene.add.image(Math.round(x), Math.round(y), '__DEFAULT').setDepth(BADGE_DEPTH);
    this.render();
  }

  setPlayer(p: PlayerId): void {
    if (p === this.player) return;
    this.player = p;
    this.render();
  }

  setPosition(pos: Position): void {
    if (pos === this.position) return;
    this.position = pos;
    this.render();
  }

  moveTo(x: number, y: number): void {
    this.image.setPosition(Math.round(x), Math.round(y));
  }

  get visible(): boolean {
    return this.shown;
  }

  setVisible(b: boolean): void {
    this.shown = b;
    this.scene.tweens.killTweensOf(this.image);
    this.image.setVisible(b).setScale(1).setAlpha(1);
  }

  /** Pop in (summon impact beat): scale overshoot. */
  async pop(): Promise<void> {
    this.shown = true;
    this.scene.tweens.killTweensOf(this.image);
    this.image.setVisible(true).setAlpha(1).setScale(0.2);
    this.flashT = 1;
    this.render();
    await tween(this.scene, { targets: this.image, scale: 1.35, duration: 120, ease: 'Quad.Out' });
    this.flashT = 0;
    this.render();
    await tween(this.scene, { targets: this.image, scale: 1, duration: 160, ease: 'Back.Out' });
  }

  /** Set values; animate = roll the digits (green/red), punch at the end. */
  async set(atk: number, def: number, animate = true): Promise<void> {
    const token = ++this.rollToken;
    this.atk = atk;
    this.def = def;
    if (!animate || !this.image.visible) {
      this.shownAtk = atk;
      this.shownDef = def;
      this.render();
      return;
    }
    const a0 = this.shownAtk;
    const d0 = this.shownDef;
    if (a0 === atk && d0 === def) return;
    this.scene.tweens.killTweensOf(this.image);
    void tween(this.scene, { targets: this.image, scale: 1.3, duration: 110, ease: 'Quad.Out' });
    await tweenValue(this.scene, 0, 1, 520, (k) => {
      if (token !== this.rollToken) return;
      this.shownAtk = Math.round(a0 + (atk - a0) * k);
      this.shownDef = Math.round(d0 + (def - d0) * k);
      this.flashT = 1 - k;
      this.render();
    }, 'Cubic.Out');
    if (token !== this.rollToken) return;
    this.shownAtk = atk;
    this.shownDef = def;
    this.flashT = 0;
    this.render();
    await tween(this.scene, { targets: this.image, scale: 1, duration: 180, ease: 'Back.Out' });
  }

  destroy(): void {
    this.rollToken++;
    this.scene.tweens.killTweensOf(this.image);
    this.image.destroy();
    if (this.tex) {
      this.tex.destroy();
      this.tex = null;
    }
  }

  private color(v: number, base: number, active: boolean): number {
    if (v > base) return active ? PAL.leaf3 : PAL.leaf2;
    if (v < base) return active ? PAL.crim3 : PAL.crim2;
    return active ? PAL.white : PAL.steel;
  }

  private render(): void {
    if (!this.image.active) return;
    const a = String(Math.max(0, this.shownAtk));
    const d = String(Math.max(0, this.shownDef));
    const aw = digitsWidth(a);
    const dw = digitsWidth(d);
    const W = 3 + aw + 5 + dw + 3;
    const H = 9;
    const p = new PixelCanvas(W, H);
    const R = PLAYER_RAMP[this.player];
    const atkActive = this.position === 'attack';
    // plate: ink body, player-colour rim, lit top edge
    p.rect(1, 0, W - 2, H, PAL.ink);
    p.rect(0, 1, W, H - 2, PAL.ink);
    p.rect(1, 1, W - 2, H - 2, PAL.night0);
    for (let x = 2; x < W - 2; x++) p.set(x, 0, R[1]);
    for (let x = 2; x < W - 2; x++) p.set(x, H - 1, R[0]);
    p.set(0, 2, R[1]).set(W - 1, 2, R[1]);
    // the active half gets a faint lit backing
    const ax0 = 1;
    const ax1 = 2 + aw + 2;
    const dx0 = ax1;
    if (atkActive) p.rect(ax0 + 1, 1, ax1 - ax0 - 1, H - 2, PAL.night1);
    else p.rect(dx0, 1, W - dx0 - 2, H - 2, PAL.night1);
    const flash = this.flashT > 0.5;
    drawDigits(p, 3, 2, a, flash && atkActive ? PAL.white : this.color(this.shownAtk, this.baseAtk, atkActive));
    // separator
    p.set(3 + aw + 2, 2, PAL.night3).set(3 + aw + 2, 3, PAL.night3).set(3 + aw + 1, 4, PAL.night3).set(3 + aw + 1, 5, PAL.night3).set(3 + aw + 1, 6, PAL.night3);
    drawDigits(p, 3 + aw + 5, 2, d, flash && !atkActive ? PAL.white : this.color(this.shownDef, this.baseDef, !atkActive));
    // tiny marker under the active stat
    const mx = atkActive ? 3 + Math.floor(aw / 2) : 3 + aw + 5 + Math.floor(dw / 2);
    p.set(mx, H - 1, R[3]);
    const canvas = p.toCanvas();
    if (!this.tex || this.tex.width !== W || this.tex.height !== H) {
      if (this.tex) {
        this.tex.destroy();
        this.tex = null;
      }
      if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
      this.tex = this.scene.textures.createCanvas(this.key, W, H);
      if (!this.tex) return;
      this.image.setTexture(this.key);
    }
    const ctx = this.tex.getContext();
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(canvas, 0, 0);
    this.tex.refresh();
    this.image.setSize(W, H);
  }
}
