// CardSprite — an upright card (hand, flying, inspect). 48×68 at scale 1, centered on (x, y).
//
//   const c = new CardSprite(scene, x, y, 'crystal_wyrm');      // face-up
//   const d = new CardSprite(scene, x, y, null);                // face-down (card back)
//   await c.flyTo(320, 160, { ms: 420, arc: 50, scale: 1.4 });
//   await d.flip(true);                                          // needs setCard(id) first to reveal a face
//
// Structure: this (position/scale/rotation — owned by flyTo / the caller)
//            └ shadow                 (drop shadow when lifted)
//            └ inner (lift/flip/squash — owned by the card's own effects)
//                └ glow ring + running comets (highlight), face, sheen/foil, flash
// All animations are promise-based and respect scene time (fast-forward, hit-stop).

import Phaser from 'phaser';
import type { CardId } from '../data/cards';
import { cardDef, isMonster } from '../data/cards';
import type { PlayerId } from '../engine/types';
import {
  ANIM_FOIL,
  ANIM_GLOW_RUN,
  ANIM_SHEEN,
  CARD_BACK,
  CARD_FOIL,
  CARD_GLOW,
  CARD_GLOW_RUN,
  CARD_SHEEN,
  CARD_SIL,
  cardAccent,
  cardBackCanvas,
  cardFaceCanvas,
  cardFaceKey,
} from '../art/cards';
import { PAL, PLAYER_COLOR } from '../art/palette';
import type { PixelCanvas } from '../art/pixel';
import { mix } from '../art/pixel';
import { TEX, tween, tweenValue } from '../vfx/core';
import { CARD_H, CARD_W } from './layout';

export interface FlyOpts {
  /** Flight time (default 420). */
  ms?: number;
  /** Height of the arc's control point above the straight path, px (default 40). */
  arc?: number;
  /** Final scale (default: unchanged). */
  scale?: number;
  /** Final rotation in radians (default 0). */
  rotation?: number;
  /** Phaser ease for travel progress (default 'Cubic.Out' after an anticipation, else 'Sine.InOut'). */
  ease?: string;
  /** Short pull-back before launching (default true when ms ≥ 200). */
  anticipate?: boolean;
  /** Extra full spins during the flight (default 0). */
  spin?: number;
  /** Little landing squash at the end (default true). */
  land?: boolean;
  /** Flip face-up mid-flight (needs a cardId) — the "draw" reveal. */
  reveal?: boolean;
}

/** Topmost container depth of a game object (particles spawned at scene root use it). */
export function rootDepth(go: Phaser.GameObjects.GameObject & { depth?: number }): number {
  let d = go.depth ?? 0;
  let p = go.parentContainer;
  while (p) {
    d = p.depth;
    p = p.parentContainer;
  }
  return d;
}

interface Ember {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Burn time (ms from start). */
  tb: number;
  life: number;
  color: number;
  char: number;
  phase: number;
  flies: boolean;
  spark: boolean;
  state: 0 | 1 | 2;
}

/**
 * Burn `img` away from the bottom up: a ragged, charring burn front climbs the card; pixels it
 * passes flare white-hot, then either wink out or lift off as embers that accelerate upward,
 * sway and fade (the classic card "dissolve"). `pc` must hold img's pixels. Hides img.
 */
export function burnAway(
  scene: Phaser.Scene,
  img: Phaser.GameObjects.Image,
  pc: PixelCanvas,
  ms: number,
  ember: number,
  opts: { keep?: number; depth?: number; seed?: number } = {},
): Promise<void> {
  const m = img.getWorldTransformMatrix().decomposeMatrix();
  const rot = m.rotation;
  const sx = m.scaleX;
  const sy = m.scaleY;
  const as = Math.max(Math.abs(sx), Math.abs(sy));
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const ox = img.originX * pc.w;
  const oy = img.originY * pc.h;
  const depth = opts.depth ?? rootDepth(img) + 1;
  const keep = opts.keep ?? 0.42;
  let seed = (opts.seed ?? 1234) >>> 0;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // ragged front: smooth per-column jitter
  const jitter: number[] = [];
  let j = 0;
  for (let x = 0; x < pc.w; x++) {
    j = j * 0.6 + (rnd() - 0.5) * 4;
    jitter.push(j);
  }
  const burnEnd = ms * 0.58;
  const hot = mix(ember, PAL.white, 0.65);
  const parts: Ember[] = [];
  for (let y = 0; y < pc.h; y++)
    for (let x = 0; x < pc.w; x++) {
      const c = pc.get(x, y);
      if (c === null) continue;
      const lx = (x + 0.5 - ox) * sx;
      const ly = (y + 0.5 - oy) * sy;
      const wx = m.translateX + lx * cos - ly * sin;
      const wy = m.translateY + lx * sin + ly * cos;
      const e = scene.add.image(wx, wy, TEX.px1).setScale(Math.abs(sx), Math.abs(sy)).setRotation(rot).setDepth(depth).setTint(c);
      const tb = burnEnd * Math.min(1, Math.max(0, 1 - (y + jitter[x]) / (pc.h + 2))) + rnd() * ms * 0.05;
      const spark = rnd() < 0.12;
      parts.push({
        img: e,
        x: wx,
        y: wy,
        vx: (rnd() - 0.5) * (spark ? 44 : 24) * as,
        vy: -(34 + rnd() * 90) * as * (spark ? 1.5 : 1),
        tb,
        life: 300 + rnd() * 320,
        spark,
        color: c,
        char: mix(c, PAL.fire1, 0.55),
        phase: rnd() * 6.28,
        flies: spark || rnd() < keep,
        state: 0,
      });
    }
  img.setVisible(false);
  return tweenValue(scene, 0, ms, ms, (t) => {
    for (const p of parts) {
      if (p.state === 2) continue;
      const dt = t - p.tb;
      if (dt < -70) continue;
      if (dt < 0) {
        // charring just ahead of the front
        if (p.state === 0 && dt > -45) {
          p.img.setTint(p.char);
          p.state = 1;
        }
        continue;
      }
      const k = dt / p.life;
      if (k >= 1 || (!p.flies && dt > 45)) {
        p.img.destroy();
        p.state = 2;
        continue;
      }
      if (!p.flies) {
        p.img.setTint(hot);
        continue;
      }
      const s = dt / 1000;
      p.img.x = p.x + p.vx * s + Math.sin(p.phase + dt * 0.014) * 3 * as * k;
      p.img.y = p.y + p.vy * s - 110 * as * s * s;
      if (p.spark) p.img.setTint(k < 0.5 ? hot : ember);
      else p.img.setTint(k < 0.1 ? hot : k < 0.3 ? ember : k < 0.6 ? p.color : mix(p.color, ember, 0.5));
      p.img.setAlpha(1 - Math.pow(k, 1.6));
      const sc = 1 - k * 0.5;
      p.img.setScale(Math.abs(sx) * sc, Math.abs(sy) * sc);
    }
  }).then(() => {
    for (const p of parts) if (p.state !== 2) p.img.destroy();
  });
}

export class CardSprite extends Phaser.GameObjects.Container {
  cardId: CardId | null;
  faceUp: boolean;
  /** Inner container: flip / hover lift / squash live here. */
  readonly inner: Phaser.GameObjects.Container;
  private readonly face: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly glowRun: Phaser.GameObjects.Sprite;
  private readonly sheen: Phaser.GameObjects.Sprite;
  private readonly flashImg: Phaser.GameObjects.Image;
  private readonly rim: Phaser.GameObjects.Image;
  private glowTween: Phaser.Tweens.Tween | null = null;
  private highlight: number | null = null;
  private player: PlayerId | null = null;
  private trailEvent: Phaser.Time.TimerEvent | null = null;
  private foilEvent: Phaser.Time.TimerEvent | null = null;
  private lifted = false;
  private seed = 0x9e3779b9;

  constructor(scene: Phaser.Scene, x: number, y: number, cardId: CardId | null, opts: { faceUp?: boolean; player?: PlayerId } = {}) {
    super(scene, x, y);
    this.cardId = cardId;
    this.faceUp = opts.faceUp ?? cardId !== null;
    this.shadow = scene.add.image(2, 3, CARD_SIL).setTint(PAL.ink).setAlpha(0);
    this.inner = scene.add.container(0, 0);
    this.rim = scene.add.image(0, 0, CARD_GLOW, 'g:0').setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
    this.glow = scene.add.image(0, 0, CARD_GLOW, 'g:0').setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
    this.glowRun = scene.add.sprite(0, 0, CARD_GLOW_RUN, 'run:0').setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
    this.face = scene.add.image(0, 0, CARD_BACK);
    this.sheen = scene.add.sprite(0, 0, CARD_SHEEN, 's:0').setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
    this.flashImg = scene.add.image(0, 0, CARD_SIL).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.inner.add([this.rim, this.glow, this.glowRun, this.face, this.sheen, this.flashImg]);
    this.add([this.shadow, this.inner]);
    this.setSize(CARD_W, CARD_H);
    this.refreshFace();
    if (opts.player !== undefined) this.setPlayerTint(opts.player);
    this.sheen.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.sheen.setVisible(false));
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.cleanup());
    scene.add.existing(this);
  }

  // ------------------------------------------------------------ state

  /** Change the card (null = unknown card, always shown as the back). */
  setCard(cardId: CardId | null): this {
    this.cardId = cardId;
    if (cardId === null) this.faceUp = false;
    this.refreshFace();
    return this;
  }

  setFaceUp(b: boolean): this {
    this.faceUp = b && this.cardId !== null;
    this.refreshFace();
    return this;
  }

  /** Texture key currently shown. */
  get textureKey(): string {
    return this.faceUp && this.cardId ? cardFaceKey(this.cardId) : CARD_BACK;
  }

  /** Pixels of the shown side (for custom VFX). */
  get pixels(): PixelCanvas {
    return this.faceUp && this.cardId ? cardFaceCanvas(this.cardId) : cardBackCanvas();
  }

  private get isAce(): boolean {
    if (!this.cardId) return false;
    const d = cardDef(this.cardId);
    return isMonster(d) && d.ace;
  }

  private refreshFace(): void {
    this.face.setTexture(this.textureKey);
    // Aces shimmer with a periodic holo-foil sweep while face-up.
    if (this.faceUp && this.isAce) {
      if (!this.foilEvent) {
        const first = 900 + ((this.cardId!.length * 337) % 1500);
        this.foilEvent = this.scene.time.addEvent({
          delay: 3200,
          startAt: 3200 - first,
          loop: true,
          callback: () => this.playSweep(true),
        });
      }
    } else if (this.foilEvent) {
      this.foilEvent.remove();
      this.foilEvent = null;
    }
  }

  /** Play one light sweep across the card (foil = rainbow holo sweep). */
  playSweep(foil = false): void {
    if (!this.active) return;
    this.sheen.setTexture(foil ? CARD_FOIL : CARD_SHEEN, 's:0').setVisible(true).setAlpha(foil ? 0.75 : 0.6);
    this.sheen.play(foil ? ANIM_FOIL : ANIM_SHEEN);
  }

  // ------------------------------------------------------------ looks

  /** Glowing animated outline (playable / selected). null removes it. */
  setHighlight(color: number | null): this {
    if (color === this.highlight) return this;
    this.highlight = color;
    this.glowTween?.stop();
    this.glowTween = null;
    if (color === null) {
      this.scene.tweens.add({
        targets: [this.glow, this.glowRun],
        alpha: 0,
        duration: 120,
        onComplete: () => {
          if (this.highlight !== null) return;
          this.glow.setVisible(false);
          this.glowRun.setVisible(false).stop();
        },
      });
      return this;
    }
    this.glow.setVisible(true).setTint(color).setAlpha(0.7);
    this.glowRun.setVisible(true).setTint(mix(color, PAL.white, 0.55)).setAlpha(1);
    if (!this.glowRun.anims.isPlaying) this.glowRun.play(ANIM_GLOW_RUN);
    this.glowTween = this.scene.tweens.add({
      targets: this.glow,
      alpha: { from: 1, to: 0.45 },
      duration: 480,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    });
    return this;
  }

  /** Lift the card a few px (hover). A light sweep plays on the way up. */
  hoverLift(on: boolean): Promise<void> {
    if (on === this.lifted) return Promise.resolve();
    this.lifted = on;
    if (on) this.playSweep(false);
    return Promise.all([
      tween(this.scene, { targets: this.inner, y: on ? -6 : 0, duration: on ? 150 : 130, ease: on ? 'Back.Out' : 'Quad.Out' }),
      tween(this.scene, { targets: this.shadow, alpha: on ? 0.38 : 0, x: on ? 3 : 2, y: on ? 5 : 3, duration: 140 }),
    ]).then(() => undefined);
  }

  /** Player color for the trail, default highlight and a faint rim light. null clears. */
  setPlayerTint(player: PlayerId | null): this {
    this.player = player;
    if (player === null) this.rim.setVisible(false);
    else this.rim.setVisible(true).setTint(PLAYER_COLOR[player]).setAlpha(0.28);
    return this;
  }

  private rnd(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private get trailColor(): number {
    if (this.player !== null) return PLAYER_COLOR[this.player];
    return this.faceUp && this.cardId ? cardAccent(this.cardId) : PAL.cyan3;
  }

  /** Afterimage trail + pixel sparks while the card moves. */
  setTrail(on: boolean): this {
    if (!on) {
      this.trailEvent?.remove();
      this.trailEvent = null;
      return this;
    }
    if (this.trailEvent) return this;
    let lastX = NaN;
    let lastY = NaN;
    this.trailEvent = this.scene.time.addEvent({
      delay: 26,
      loop: true,
      callback: () => {
        if (!this.active || !this.visible) return;
        const m = this.face.getWorldTransformMatrix().decomposeMatrix();
        const moved = Math.hypot(m.translateX - lastX, m.translateY - lastY);
        lastX = m.translateX;
        lastY = m.translateY;
        if (!(moved > 1.5)) return;
        const depth = rootDepth(this) - 0.5;
        const col = this.trailColor;
        const ghost = this.scene.add
          .image(m.translateX, m.translateY, this.textureKey)
          .setRotation(m.rotation)
          .setScale(m.scaleX, m.scaleY)
          .setTint(col)
          .setTintFill(col)
          .setAlpha(0.3)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(depth);
        this.scene.tweens.add({
          targets: ghost,
          alpha: 0,
          scaleX: m.scaleX * 0.86,
          scaleY: m.scaleY * 0.86,
          duration: 180,
          ease: 'Quad.Out',
          onComplete: () => ghost.destroy(),
        });
        for (let i = 0; i < 3; i++) {
          const a = this.rnd() * Math.PI * 2;
          const sp = this.scene.add
            .image(m.translateX + Math.cos(a) * 20 * m.scaleX, m.translateY + Math.sin(a) * 28 * m.scaleY, i ? TEX.px1 : TEX.px2)
            .setTint(i === 2 ? PAL.white : col)
            .setDepth(depth)
            .setBlendMode(Phaser.BlendModes.ADD);
          this.scene.tweens.add({
            targets: sp,
            alpha: 0,
            y: sp.y + 3 + this.rnd() * 6,
            duration: 240 + this.rnd() * 180,
            onComplete: () => sp.destroy(),
          });
        }
      },
    });
    return this;
  }

  // ------------------------------------------------------------ motion

  /**
   * Flip to the given side: anticipation dip → squash to an edge while lifting with a
   * bright glint → swap → unsquash with overshoot and settle.
   */
  async flip(toFaceUp: boolean, ms = 260): Promise<void> {
    if (toFaceUp && this.cardId === null) toFaceUp = false;
    const sc = this.scene;
    const b = this.inner;
    const baseY = this.lifted ? -6 : 0;
    const t1 = ms * 0.16;
    const t2 = ms * 0.34;
    const t3 = ms * 0.5;
    this.shadow.setAlpha(0.3);
    // anticipation: tiny widen + dip
    await tween(sc, { targets: b, scaleX: 1.06, scaleY: 0.97, y: baseY + 1, duration: t1, ease: 'Quad.Out' });
    // close to an edge, rising, flash building
    await Promise.all([
      tween(sc, { targets: b, scaleX: 0.045, scaleY: 1.06, y: baseY - 7, duration: t2, ease: 'Quad.In' }),
      tween(sc, { targets: this.flashImg, alpha: 0.85, duration: t2, ease: 'Quad.In' }),
      tween(sc, { targets: this.shadow, scaleX: 0.15, alpha: 0.18, duration: t2, ease: 'Quad.In' }),
    ]);
    this.faceUp = toFaceUp;
    this.refreshFace();
    // open with overshoot, drop back, flash decays
    await Promise.all([
      tween(sc, { targets: b, scaleX: 1, duration: t3, ease: 'Back.Out', easeParams: [2.6] }),
      tween(sc, { targets: b, scaleY: 1, y: baseY, duration: t3, ease: 'Quad.In' }),
      tween(sc, { targets: this.flashImg, alpha: 0, duration: t3 * 1.2, ease: 'Quad.Out' }),
      tween(sc, { targets: this.shadow, scaleX: 1, alpha: this.lifted ? 0.38 : 0, duration: t3, ease: 'Quad.Out' }),
    ]);
    if (toFaceUp) {
      this.playSweep(this.isAce);
      this.burst(this.cardId ? cardAccent(this.cardId) : PAL.cyan3);
    }
  }

  /** Ring of sparkles shooting out from the card edges (reveals). */
  burst(color: number, n = 12): void {
    const m = this.inner.getWorldTransformMatrix().decomposeMatrix();
    const depth = rootDepth(this) + 1;
    const sx = Math.abs(m.scaleX);
    const sy = Math.abs(m.scaleY);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.rnd() * 0.3;
      const ex = Math.cos(a);
      const ey = Math.sin(a);
      // start on the card rim
      const k = Math.min(24 / Math.abs(ex || 1e-6), 34 / Math.abs(ey || 1e-6));
      const x0 = m.translateX + ex * k * sx;
      const y0 = m.translateY + ey * k * sy;
      const big = i % 3 === 0;
      const sp = this.scene.add
        .image(Math.round(x0), Math.round(y0), big ? TEX.spark : TEX.px2)
        .setTint(big ? PAL.white : color)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(depth);
      const dist = (10 + this.rnd() * 14) * Math.max(sx, sy);
      this.scene.tweens.add({
        targets: sp,
        x: x0 + ex * dist,
        y: y0 + ey * dist,
        alpha: 0,
        scale: big ? 0.4 : 0.6,
        duration: 260 + this.rnd() * 160,
        ease: 'Cubic.Out',
        onComplete: () => sp.destroy(),
      });
    }
  }

  /**
   * Fly along a quadratic arc to (x, y) in the parent's space: anticipation pull-back,
   * eased travel leaning into the motion (and puffing toward the camera mid-arc), landing squash.
   */
  async flyTo(x: number, y: number, opts: FlyOpts = {}): Promise<void> {
    const sc = this.scene;
    const ms = opts.ms ?? 420;
    const arc = opts.arc ?? 40;
    const s1 = opts.scale ?? this.scaleX;
    const r1 = opts.rotation ?? 0;
    const spin = opts.spin ?? 0;
    const anticipate = opts.anticipate ?? ms >= 200;
    let x0 = this.x;
    let y0 = this.y;
    const s0 = this.scaleX;
    const r0 = this.rotation;
    const dx = x - x0;
    const dy = y - y0;
    const len = Math.hypot(dx, dy) || 1;
    const dir = Math.sign(dx) || 1;
    if (anticipate) {
      const a = Math.min(ms * 0.16, 90);
      await tween(sc, {
        targets: this,
        x: x0 - (dx / len) * 4,
        y: y0 - (dy / len) * 4 + 2,
        rotation: r0 - dir * 0.06,
        scaleX: s0 * 0.96,
        scaleY: s0 * 0.96,
        duration: a,
        ease: 'Quad.Out',
      });
      x0 = this.x;
      y0 = this.y;
    }
    const cx = (x0 + x) / 2;
    const cy = (y0 + y) / 2 - arc;
    const sStart = this.scaleX;
    const rStart = this.rotation;
    const travel = anticipate ? ms - Math.min(ms * 0.16, 90) : ms;
    const lean = Math.min(0.32, (Math.abs(dx) / 400) * 0.3 + 0.06) * dir;
    if (opts.reveal && !this.faceUp && this.cardId) {
      const flipMs = Math.max(160, travel * 0.42);
      sc.time.delayedCall(travel * 0.3, () => void this.flip(true, flipMs));
    }
    await tweenValue(
      sc,
      0,
      1,
      travel,
      (t) => {
        const u = 1 - t;
        this.x = u * u * x0 + 2 * u * t * cx + t * t * x;
        this.y = u * u * y0 + 2 * u * t * cy + t * t * y;
        const bump = Math.sin(Math.PI * t);
        this.rotation = rStart + (r1 - rStart) * t + lean * bump + spin * Math.PI * 2 * t;
        const s = (sStart + (s1 - sStart) * t) * (1 + 0.1 * bump);
        this.setScale(s);
      },
      opts.ease ?? (anticipate ? 'Cubic.Out' : 'Sine.InOut'),
    );
    this.setPosition(x, y).setRotation(r1).setScale(s1);
    if (opts.land ?? true) {
      this.inner.setScale(1.08, 0.9);
      await tween(sc, { targets: this.inner, scaleX: 1, scaleY: 1, duration: 160, ease: 'Back.Out', easeParams: [3] });
    }
  }

  /** Short squash-and-stretch punch (landing in hand, selection). */
  punch(amount = 0.12, ms = 180): Promise<void> {
    this.inner.setScale(1 + amount, 1 - amount);
    return tween(this.scene, { targets: this.inner, scaleX: 1, scaleY: 1, duration: ms, ease: 'Back.Out', easeParams: [3] });
  }

  /** Flash the card with a color (ADD silhouette) — reveals, power-ups. */
  pulse(color: number = PAL.white, ms = 320): Promise<void> {
    this.flashImg.setTint(color).setAlpha(0.95);
    return tween(this.scene, { targets: this.flashImg, alpha: 0, duration: ms, ease: 'Quad.Out' }).then(() => {
      this.flashImg.clearTint();
    });
  }

  /** Burn the card into rising pixel embers (discard / spell resolution). Hides the card. */
  async dissolve(ms = 650): Promise<void> {
    const ember = this.faceUp && this.cardId ? cardAccent(this.cardId) : PAL.cyan3;
    this.setHighlight(null);
    this.sheen.setVisible(false);
    this.shadow.setAlpha(0);
    this.rim.setVisible(false);
    // a white-hot edge flash right before it goes
    this.flashImg.setTint(ember).setAlpha(0.6);
    this.scene.tweens.add({ targets: this.flashImg, alpha: 0, duration: ms * 0.3 });
    await burnAway(this.scene, this.face, this.pixels, ms, ember, { seed: (this.cardId?.length ?? 7) * 97 });
    this.setVisible(false);
    this.face.setVisible(true);
    this.flashImg.setAlpha(0);
  }

  private cleanup(): void {
    this.trailEvent?.remove();
    this.foilEvent?.remove();
    this.glowTween?.stop();
    this.trailEvent = null;
    this.foilEvent = null;
  }
}
