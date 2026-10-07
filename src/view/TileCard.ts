// TileCard — a card lying on a board tile at zoneXY(player, spot, index).
//
// At rest it shows a pre-rendered iso texture (cardIsoKey). While animating (slam-in, flip,
// rotate, stand-up) it switches to a private canvas that the tiny 3D card renderer in
// src/art/cards.ts redraws every frame, so the card genuinely tilts, turns over and stands up
// in the isometric projection — pixel-crisp, sampled from the closest resolution level.
//
//   const tc = new TileCard(scene, 0, 'monster', 1, 'ember_wolf', true, 'up');
//   await tc.slamIn({ x: 320, y: 340 });      // from the hand
//   await tc.rotateTo('side');                 // to defense
//   await tc.standUp();                        // trap activation pose (reveals by default)
//
// Player 2's cards are rotated 180° (their tops face player 1).

import Phaser from 'phaser';
import type { CardId } from '../data/cards';
import { cardDef, isMonster } from '../data/cards';
import type { PlayerId } from '../engine/types';
import {
  CARD_GLOW,
  CARD_SIL,
  FLAT_H,
  FLAT_W,
  ISO_CX,
  ISO_CY,
  ISO_GLOW_PAD,
  ISO_TEX_H,
  ISO_TEX_W,
  ANIM_GLOW_RUN,
  STAND_H,
  STAND_W,
  ZS,
  animIsoGlowRun,
  animIsoSheen,
  cardAccent,
  cardIsoGlowKey,
  cardIsoKey,
  cardIsoSheenKey,
  cardIsoSilKey,
  cardMip,
  isoCanvas,
  isoProject,
  poseAxes,
  qAxis,
  qMul,
  qRot,
  qSlerp,
  renderCard,
  restQuat,
  standQuat,
  type CardOrientation,
  type Quat,
} from '../art/cards';
import { PAL, PLAYER_COLOR } from '../art/palette';
import { PixelCanvas, mix } from '../art/pixel';
import { TEX, shake, tween, tweenValue } from '../vfx/core';
import { burnAway } from './CardSprite';
import { DEPTH, TILE_H, TILE_W, unitDepth, zoneXY, type BoardSpot, type XY } from './layout';

const LIVE = 128;
const LC = 64;
/** Gap (grid units) between a standing card's bottom edge and the tile. */
const STAND_HOVER = 2;

interface Pose {
  /** Specular streak position (see RenderOpts.glint). */
  glint?: number;
  q: Quat;
  /** Card size in grid units. */
  w: number;
  h: number;
  /** Height of the card center above the tile (grid units). */
  z: number;
  /** Extra screen offset from the tile center (flights). */
  off: [number, number];
  light: number;
  tint?: number;
  tintAmt?: number;
}

export interface SlamOpts {
  /** Scale of the upright card at the start (match the CardSprite you replace; default 1). */
  fromScale?: number;
  /** Apex height above the tile in px (default 34). */
  arc?: number;
  /** Camera shake on impact in px (default 0 — the cinematic decides). */
  shake?: number;
  /** Player-colored spark trail during the flight (default true). */
  trail?: boolean;
  /** Dust puff + tile flash on impact (default true). */
  impact?: boolean;
}

export interface StandOpts {
  /** Turn the front toward the camera while rising (default true — the trap reveal). */
  reveal?: boolean;
  /** 1 = full-size 48×68 crisp face (default); 0.5 = half size. */
  scale?: number;
}

// ---------------------------------------------------------------- easing

const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
const easeInQuad = (t: number) => t * t;
const easeInCubic = (t: number) => t * t * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutSine = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);
const easeOutSine = (t: number) => Math.sin((Math.PI * t) / 2);
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t: number, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
/** Damped spring 1 → 0 with one undershoot (squash recovery). */
const spring = (t: number) => Math.cos(t * Math.PI * 2.2) * Math.pow(1 - t, 2.2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

let liveCounter = 0;

export class TileCard extends Phaser.GameObjects.Container {
  readonly player: PlayerId;
  spot: BoardSpot;
  index: number;
  cardId: CardId | null;
  faceUp: boolean;
  orientation: CardOrientation;
  /** True while in the standing (trap activation) pose. */
  standing = false;
  /** Tile center in screen pixels. */
  readonly home: XY;

  private standScale = 1;
  private readonly img: Phaser.GameObjects.Image;
  private readonly shadowG: Phaser.GameObjects.Graphics;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly glowRun: Phaser.GameObjects.Sprite;
  private readonly sheen: Phaser.GameObjects.Sprite;
  private readonly flashImg: Phaser.GameObjects.Image;
  private live: Phaser.Textures.CanvasTexture | null = null;
  private liveKey = '';
  private buf: PixelCanvas | null = null;
  private pose: Pose | null = null;
  private busy = 0;
  private sheenEvent: Phaser.Time.TimerEvent | null = null;
  private highlight: number | null = null;
  private glowTween: Phaser.Tweens.Tween | null = null;
  private bobTween: Phaser.Tweens.Tween | null = null;
  private rngState: number;

  constructor(
    scene: Phaser.Scene,
    player: PlayerId,
    spot: BoardSpot,
    index: number,
    cardId: CardId | null,
    faceUp: boolean,
    orientation: CardOrientation = 'up',
  ) {
    const home = zoneXY(player, spot, index);
    super(scene, home.x, home.y);
    this.home = home;
    this.player = player;
    this.spot = spot;
    this.index = index;
    this.cardId = cardId;
    this.faceUp = faceUp;
    this.orientation = orientation;
    this.rngState = (home.x * 31 + home.y * 17 + player * 7) >>> 0;

    this.shadowG = scene.add.graphics();
    this.glow = scene.add.image(0, 0, cardIsoGlowKey(orientation), 'g:0').setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
    this.glowRun = scene.add.sprite(0, 0, cardIsoGlowKey(orientation), 'run:0').setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
    this.img = scene.add.image(0, 0, this.staticKey);
    this.sheen = scene.add.sprite(0, 0, cardIsoSheenKey(orientation), 's:0').setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
    this.flashImg = scene.add.image(0, 0, cardIsoSilKey(orientation)).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.add([this.shadowG, this.glow, this.glowRun, this.img, this.sheen, this.flashImg]);
    this.sheen.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.sheen.setVisible(false));
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.cleanup());
    this.setDepth(DEPTH.CARD_ON_TILE);
    this.settle();
    scene.add.existing(this);
  }

  // ------------------------------------------------------------ state

  private get staticKey(): string {
    return cardIsoKey(this.faceUp && this.cardId ? this.cardId : 'back', this.orientation, this.player);
  }

  private get frontMip() {
    return cardMip(this.cardId ?? 'back');
  }

  private rnd(): number {
    this.rngState = (this.rngState * 1664525 + 1013904223) >>> 0;
    return this.rngState / 4294967296;
  }

  /** Instantly set what is shown (used by views.sync). Cancels the standing pose. */
  sync(cardId: CardId | null, faceUp: boolean, orientation: CardOrientation = this.orientation): this {
    this.cardId = cardId;
    this.faceUp = faceUp;
    this.orientation = orientation;
    this.standing = false;
    this.setAlpha(1).setVisible(true);
    this.img.setVisible(true);
    this.settle();
    return this;
  }

  setCard(cardId: CardId | null): this {
    this.cardId = cardId;
    if (this.busy === 0) this.settle();
    return this;
  }

  setFaceUp(b: boolean): this {
    this.faceUp = b;
    if (this.busy === 0) this.settle();
    return this;
  }

  setOrientation(o: CardOrientation): this {
    this.orientation = o;
    if (this.busy === 0) this.settle();
    return this;
  }

  private restPose(): Pose {
    if (this.standing) {
      const s = this.standScale;
      const q = this.faceUp ? standQuat() : qMul(standQuat(), qAxis([0, 1, 0], Math.PI));
      return { q, w: STAND_W * s, h: STAND_H * s, z: (STAND_H * s) / 2 + STAND_HOVER, off: [0, 0], light: 0 };
    }
    return { q: restQuat(this.player, this.orientation, this.faceUp), w: FLAT_W, h: FLAT_H, z: 0, off: [0, 0], light: 0 };
  }

  private ensureLive(): void {
    if (this.live) return;
    this.liveKey = `tilecard:live:${++liveCounter}`;
    this.live = this.scene.textures.createCanvas(this.liveKey, LIVE, LIVE)!;
    this.buf = new PixelCanvas(LIVE, LIVE);
  }

  private drawPose(p: Pose): void {
    this.ensureLive();
    const buf = this.buf!;
    buf.clear();
    const { ex, ey, n } = poseAxes(p.q, p.w, p.h);
    renderCard(buf, LC, LC, ex, ey, n, this.frontMip, cardMip('back'), {
      light: p.light,
      tint: p.tint,
      tintAmt: p.tintAmt,
      glint: p.glint,
    });
    this.live!.context.putImageData(buf.toImageData(), 0, 0);
    this.live!.refresh();
    const [, py] = isoProject([0, 0, p.z]);
    this.img
      .setTexture(this.liveKey)
      .setOrigin(LC / LIVE, LC / LIVE)
      .setPosition(Math.round(p.off[0]), Math.round(p.off[1] + py));
    this.drawShadow(p);
    this.pose = p;
  }

  private drawShadow(p: Pose): void {
    const g = this.shadowG;
    g.clear();
    if (p.z < 0.6) return;
    const pts: Phaser.Math.Vector2[] = [];
    for (const [u, v] of [
      [-0.5, -0.5],
      [0.5, -0.5],
      [0.5, 0.5],
      [-0.5, 0.5],
    ]) {
      const c = qRot(p.q, [u * p.w, v * p.h, 0]);
      const [sx, sy] = isoProject([c[0], c[1], 0]);
      pts.push(new Phaser.Math.Vector2(Math.round(p.off[0] + sx), Math.round(p.off[1] + sy)));
    }
    const near = clamp01(1 - Math.hypot(p.off[0], p.off[1]) / 48);
    const alpha = Math.max(0.12, 0.42 - p.z * 0.006) * near;
    if (alpha < 0.02) return;
    // footprint (lifted flat cards) or contact ellipse (standing / edge-on cards)
    const area = Math.abs((pts[1].x - pts[0].x) * (pts[3].y - pts[0].y) - (pts[3].x - pts[0].x) * (pts[1].y - pts[0].y));
    g.fillStyle(PAL.ink, alpha);
    if (area > 60) g.fillPoints(pts, true);
    else {
      const xs = pts.map((q) => q.x);
      const wdt = Math.max(10, Math.max(...xs) - Math.min(...xs)) + 6;
      g.fillEllipse(Math.round(p.off[0]), Math.round(p.off[1]) + 1, wdt, Math.max(5, wdt * 0.32));
    }
  }

  /** Back to the resting look (static texture when flat, live canvas when standing). */
  private settle(): void {
    this.bobTween?.stop();
    this.bobTween = null;
    if (this.standing) {
      this.drawPose(this.restPose());
      this.setDepth(this.liftDepth);
      const y0 = this.img.y;
      this.bobTween = this.scene.tweens.add({ targets: this.img, y: y0 - 1, duration: 700, ease: 'Sine.InOut', yoyo: true, repeat: -1 });
    } else {
      this.pose = null;
      this.img.setTexture(this.staticKey).setOrigin(ISO_CX / ISO_TEX_W, ISO_CY / ISO_TEX_H).setPosition(0, 0);
      this.shadowG.clear();
      this.setDepth(DEPTH.CARD_ON_TILE);
    }
    this.placeOverlays();
  }

  /** Point the glow / sheen / flash overlays at the current resting shape. */
  private placeOverlays(): void {
    if (this.standing) {
      const s = this.standScale;
      const cx = this.img.x;
      const cy = this.img.y;
      this.glow.setTexture(CARD_GLOW, 'g:0').setOrigin(0.5).setPosition(cx, cy).setScale(s);
      this.glowRun.setTexture(CARD_GLOW, 'g:0').setOrigin(0.5).setPosition(cx, cy).setScale(s);
      this.flashImg.setTexture(CARD_SIL).setOrigin(0.5).setPosition(cx, cy).setScale(s);
      this.sheen.setVisible(false);
    } else {
      const o = this.orientation;
      const ox = (ISO_CX + ISO_GLOW_PAD) / (ISO_TEX_W + ISO_GLOW_PAD * 2);
      const oy = (ISO_CY + ISO_GLOW_PAD) / (ISO_TEX_H + ISO_GLOW_PAD * 2);
      this.glow.setTexture(cardIsoGlowKey(o), 'g:0').setOrigin(ox, oy).setPosition(0, 0).setScale(1);
      this.glowRun.setTexture(cardIsoGlowKey(o), 'run:0').setOrigin(ox, oy).setPosition(0, 0).setScale(1);
      this.flashImg.setTexture(cardIsoSilKey(o)).setOrigin(ISO_CX / ISO_TEX_W, ISO_CY / ISO_TEX_H).setPosition(0, 0).setScale(1);
      this.sheen.setTexture(cardIsoSheenKey(o), 's:0').setOrigin(ISO_CX / ISO_TEX_W, ISO_CY / ISO_TEX_H).setPosition(0, 0);
    }
    if (this.highlight !== null) this.applyHighlight(this.highlight);
  }

  private get liftDepth(): number {
    return unitDepth(this.home.y) - 1;
  }

  /** Run a pose animation over `ms`; fn(t) returns the pose for t in 0..1. */
  private animate(ms: number, fn: (t: number) => Pose): Promise<void> {
    this.busy++;
    this.bobTween?.stop();
    this.bobTween = null;
    this.glow.setVisible(false);
    this.glowRun.setVisible(false);
    this.sheen.setVisible(false);
    this.drawPose(fn(0));
    return tweenValue(this.scene, 0, 1, ms, (t) => {
      if (this.active) this.drawPose(fn(t));
    }).then(() => {
      this.busy--;
    });
  }

  // ------------------------------------------------------------ animations

  /**
   * Fly in from `from` (screen px, e.g. the hand card's position) on an arc: the upright card
   * tilts back as it travels, hangs at the apex, slams flat onto the tile (15% squash spring),
   * kicks up a dust ring and flashes the tile.
   */
  async slamIn(from: XY, ms = 480, opts: SlamOpts = {}): Promise<void> {
    this.standing = false;
    this.setVisible(true).setAlpha(1);
    this.img.setVisible(true);
    const rest = this.restPose();
    const s0 = opts.fromScale ?? 1;
    const qStart = this.faceUp ? standQuat() : qMul(standQuat(), qAxis([0, 1, 0], Math.PI));
    const start: [number, number] = [from.x - this.home.x, from.y - this.home.y];
    // apex height in grid units (default ≈ 40px above the tile)
    const apex = (opts.arc ?? 34) / ZS;
    const side = start[0] >= 0 ? -1 : 1;
    const tHit = 0.74;
    const trailCol = PLAYER_COLOR[this.player];
    let hit = false;
    let lastSpark = -1;
    this.setDepth(DEPTH.FX);
    await this.animate(ms, (t) => {
      if (t < tHit) {
        const k = t / tHit;
        // travel over to the tile (decelerating), sweeping slightly sideways
        const tr = easeOutCubic(clamp01(k / 0.66));
        const bulge = Math.sin(Math.PI * tr) * 14 * side;
        const off: [number, number] = [start[0] * (1 - tr) + bulge, start[1] * (1 - tr)];
        // height: rise, hang at the apex, then an accelerating slam
        const z = k < 0.66 ? apex * easeOutQuad(k / 0.66) : apex * (1 - easeInCubic((k - 0.66) / 0.34));
        const o = easeInOutSine(clamp01(k / 0.82));
        const grow = 1 + 0.2 * Math.sin(Math.PI * clamp01(k / 0.82));
        if (opts.trail !== false && t - lastSpark > 0.025) {
          lastSpark = t;
          const [, zy] = isoProject([0, 0, z]);
          this.spark(this.home.x + off[0], this.home.y + off[1] + zy, trailCol, lerp(20, 9, o));
          if (k > 0.7) this.speedLine(this.home.x + off[0], this.home.y + off[1] + zy, trailCol);
        }
        return {
          q: qSlerp(qStart, rest.q, o),
          w: lerp(STAND_W * s0, FLAT_W, o) * grow,
          h: lerp(STAND_H * s0, FLAT_H, o) * grow,
          z,
          off,
          light: 0.12 * Math.sin(Math.PI * o),
          glint: o > 0.15 && o < 0.95 ? lerp(-1.2, 1.2, (o - 0.15) / 0.8) : undefined,
        };
      }
      const k = (t - tHit) / (1 - tHit);
      if (!hit) {
        hit = true;
        this.setDepth(DEPTH.CARD_ON_TILE);
        if (opts.impact !== false) {
          this.dust(16, 1);
          this.tileFlash(trailCol);
          this.ringBurst(mix(trailCol, PAL.white, 0.4));
        }
        if (opts.shake) void shake(this.scene, 140, opts.shake);
      }
      const sq = 1 + 0.16 * spring(k);
      return { ...rest, w: FLAT_W * sq, h: FLAT_H * sq, tint: PAL.white, tintAmt: 0.6 * Math.pow(1 - k, 2) };
    });
    this.settle();
  }

  /** Turn a face-down card face-up: press, hop up while rolling over its long edge with a glint, slam down. */
  async flipUp(ms = 480): Promise<void> {
    if (this.faceUp) return;
    const standing = this.standing;
    this.faceUp = true;
    const restUp = this.restPose();
    this.faceUp = false;
    const base = restUp.q;
    const accent = this.cardId ? cardAccent(this.cardId) : PAL.white;
    const hop = standing ? 8 : 16;
    let landed = false;
    this.setDepth(this.liftDepth);
    await this.animate(ms, (t) => {
      if (t < 0.15) {
        const k = t / 0.15;
        const s = 1 - 0.07 * easeOutQuad(k);
        return { ...restUp, q: qMul(base, qAxis([0, 1, 0], Math.PI)), w: restUp.w * s, h: restUp.h * s, light: -0.18 * k };
      }
      if (t < 0.8) {
        const k = (t - 0.15) / 0.65;
        const e = easeInOutCubic(k);
        const sz = 1 + 0.1 * Math.sin(Math.PI * k);
        return {
          ...restUp,
          q: qMul(base, qAxis([0, 1, 0], Math.PI * (1 - e))),
          w: restUp.w * sz,
          h: restUp.h * sz,
          z: restUp.z + hop * Math.sin(Math.PI * k),
          light: 0.18 * Math.pow(Math.sin(Math.PI * e), 3),
          glint: e < 0.5 ? lerp(1.1, -0.2, e * 2) : lerp(1.1, -1.1, (e - 0.5) * 2),
        };
      }
      const k = (t - 0.8) / 0.2;
      if (!landed) {
        landed = true;
        this.faceUp = true;
        if (!standing) {
          this.dust(10, 0.7);
          this.ringBurst(accent);
        }
      }
      const sq = 1 + 0.12 * spring(k);
      return { ...restUp, w: restUp.w * sq, h: restUp.h * sq, tint: accent, tintAmt: 0.55 * Math.pow(1 - k, 2) };
    });
    this.faceUp = true;
    this.settle();
  }

  /** Turn a face-up card face-down (rare: e.g. effects/sync). */
  async flipDown(ms = 420): Promise<void> {
    if (!this.faceUp) return;
    const base = this.restPose().q;
    this.faceUp = false;
    const restDown = this.restPose();
    await this.animate(ms, (t) => {
      const e = easeInOutCubic(t);
      return { ...restDown, q: qMul(base, qAxis([0, 1, 0], Math.PI * e)), z: restDown.z + 12 * Math.sin(Math.PI * t), light: 0.4 * Math.sin(Math.PI * e) };
    });
    this.settle();
  }

  /** Rotate on the tile to attack ('up') or defense ('side') position, with lift and overshoot. */
  async rotateTo(o: CardOrientation, ms = 340): Promise<void> {
    if (o === this.orientation) return;
    if (this.standing) {
      this.orientation = o;
      return;
    }
    const q0 = restQuat(this.player, this.orientation, this.faceUp);
    const q1 = restQuat(this.player, o, this.faceUp);
    const rest0 = this.restPose();
    let landed = false;
    this.setDepth(this.liftDepth);
    await this.animate(ms, (t) => {
      if (t < 0.12) {
        const k = t / 0.12;
        const s = 1 - 0.05 * easeOutQuad(k);
        return { ...rest0, w: FLAT_W * s, h: FLAT_H * s };
      }
      const k = (t - 0.12) / 0.88;
      const e = easeOutBack(clamp01(k * 1.15), 2.4);
      if (k > 0.75 && !landed) {
        landed = true;
        this.dust(8, 0.5);
      }
      const sq = k > 0.75 ? 1 + 0.07 * spring((k - 0.75) / 0.25) : 1 + 0.05 * Math.sin(Math.PI * k);
      return {
        ...rest0,
        q: qSlerp(q0, q1, e),
        w: FLAT_W * sq,
        h: FLAT_H * sq,
        z: 5 * Math.sin(Math.PI * clamp01(k * 1.33)),
        light: 0.12 * Math.sin(Math.PI * k),
      };
    });
    this.orientation = o;
    this.settle();
  }

  /**
   * Spring the card upright on its tile (trap activation pose): press, then it swings up on
   * its bottom edge with overshoot and grows to a crisp full-size face hovering over the tile.
   */
  async standUp(ms = 460, opts: StandOpts = {}): Promise<void> {
    if (this.standing) return;
    const flat = this.restPose();
    const front = (opts.reveal ?? true) || this.faceUp;
    const s = opts.scale ?? 1;
    const q1 = front ? standQuat() : qMul(standQuat(), qAxis([0, 1, 0], Math.PI));
    const w1 = STAND_W * s;
    const h1 = STAND_H * s;
    const z1 = h1 / 2 + STAND_HOVER;
    const accent = this.cardId && front ? cardAccent(this.cardId) : PAL.white;
    this.setDepth(this.liftDepth);
    await this.animate(ms, (t) => {
      if (t < 0.16) {
        const k = t / 0.16;
        const sq = 1 - 0.08 * easeOutQuad(k);
        return { ...flat, w: FLAT_W * sq, h: FLAT_H * sq, light: -0.2 * k };
      }
      const k = (t - 0.16) / 0.84;
      const e = easeOutBack(k, 1.9);
      const es = easeOutCubic(clamp01(k * 1.2));
      return {
        q: qSlerp(flat.q, q1, e),
        w: lerp(FLAT_W, w1, es),
        h: lerp(FLAT_H, h1, es),
        z: lerp(0, z1, es) + 7 * Math.sin(Math.PI * clamp01(k * 1.4)) * (1 - k),
        off: [0, 0],
        light: 0,
        tint: accent,
        tintAmt: 0.32 * Math.max(0, Math.sin(Math.PI * clamp01((k - 0.2) / 0.6))),
        glint: k > 0.15 && k < 0.85 ? lerp(-1.3, 1.3, (k - 0.15) / 0.7) : undefined,
      };
    });
    this.standing = true;
    this.standScale = s;
    this.faceUp = front;
    this.settle();
  }

  /** Fall back flat onto the tile from the standing pose (slam + dust). */
  async layDown(ms = 380): Promise<void> {
    if (!this.standing) return;
    const st = this.restPose();
    this.standing = false;
    const flat = this.restPose();
    let landed = false;
    await this.animate(ms, (t) => {
      if (t < 0.7) {
        const k = t / 0.7;
        const e = easeInQuad(k);
        return {
          q: qSlerp(st.q, flat.q, e),
          w: lerp(st.w, FLAT_W, e),
          h: lerp(st.h, FLAT_H, e),
          z: lerp(st.z, 0, e),
          off: [0, 0],
          light: 0.15 * Math.sin(Math.PI * k),
        };
      }
      const k = (t - 0.7) / 0.3;
      if (!landed) {
        landed = true;
        this.setDepth(DEPTH.CARD_ON_TILE);
        this.dust(12, 0.8);
      }
      const sq = 1 + 0.12 * spring(k);
      return { ...flat, w: FLAT_W * sq, h: FLAT_H * sq };
    });
    this.settle();
  }

  /** Flash the card with a color and a ring burst. */
  pulse(color: number, ms = 420): Promise<void> {
    this.flashImg.setTint(color).setAlpha(0.95);
    const ring = this.scene.add
      .image(this.glow.x, this.glow.y, this.glow.texture.key, 'g:0')
      .setOrigin(this.glow.originX, this.glow.originY)
      .setScale(this.glow.scaleX)
      .setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.add(ring);
    const s0 = this.glow.scaleX;
    return Promise.all([
      tween(this.scene, { targets: this.flashImg, alpha: 0, duration: ms, ease: 'Quad.Out' }),
      tween(this.scene, { targets: ring, scaleX: s0 * 1.35, scaleY: s0 * 1.35, alpha: 0, duration: ms, ease: 'Quad.Out' }),
    ]).then(() => {
      ring.destroy();
      this.flashImg.clearTint();
    });
  }

  /** Animated glowing outline (playable / targetable / selected). null removes it. */
  setHighlight(color: number | null): this {
    this.highlight = color;
    this.glowTween?.stop();
    this.glowTween = null;
    if (color === null) {
      this.glow.setVisible(false);
      this.glowRun.setVisible(false).stop();
      return this;
    }
    this.applyHighlight(color);
    return this;
  }

  private applyHighlight(color: number): void {
    if (this.busy > 0) return;
    this.glow.setVisible(true).setTint(color).setAlpha(0.8);
    this.glowRun.setVisible(true).setTint(mix(color, PAL.white, 0.55)).setAlpha(1);
    this.glowRun.play(this.standing ? ANIM_GLOW_RUN : animIsoGlowRun(this.orientation));
    this.glowTween?.stop();
    this.glowTween = this.scene.tweens.add({
      targets: this.glow,
      alpha: { from: 1, to: 0.45 },
      duration: 460,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    });
  }

  /** Periodic diagonal light sweep while resting: face-down cards (player tint), face-up aces (gold foil). */
  setSheen(on: boolean): this {
    this.sheenEvent?.remove();
    this.sheenEvent = null;
    if (!on) {
      this.sheen.setVisible(false);
      return this;
    }
    const period = 3000 + Math.floor(this.rnd() * 1600);
    this.sheenEvent = this.scene.time.addEvent({
      delay: period,
      startAt: Math.floor(this.rnd() * period * 0.8),
      loop: true,
      callback: () => this.playSheen(),
    });
    return this;
  }

  /** One sheen sweep now (if resting face-down, or a face-up ace). */
  playSheen(): void {
    if (!this.active || this.busy > 0 || this.standing || !this.visible) return;
    let tint: number;
    if (!this.faceUp) tint = mix(PLAYER_COLOR[this.player], PAL.white, 0.5);
    else {
      const d = this.cardId ? cardDef(this.cardId) : null;
      if (!d || !isMonster(d) || !d.ace) return;
      tint = PAL.gold4;
    }
    this.sheen.setVisible(true).setTint(tint).setAlpha(0.75).play(animIsoSheen(this.orientation));
  }

  /** Fade away (sink a pixel); hides the card at the end. */
  async fadeOut(ms = 320): Promise<void> {
    this.setHighlight(null);
    await tween(this.scene, { targets: this, alpha: 0, y: this.home.y + 2, duration: ms, ease: 'Quad.In' });
    this.setVisible(false);
    this.y = this.home.y;
  }

  /** Burn into rising pixel embers (destroyed spell/trap). Hides the card at the end. */
  async dissolve(ms = 600): Promise<void> {
    this.setHighlight(null);
    this.bobTween?.stop();
    this.sheen.setVisible(false);
    this.shadowG.clear();
    const ember = this.faceUp && this.cardId ? cardAccent(this.cardId) : PLAYER_COLOR[this.player];
    const pc = this.pose ? this.buf!.clone() : isoCanvas(this.faceUp && this.cardId ? this.cardId : 'back', this.orientation, this.player);
    await burnAway(this.scene, this.img, pc, ms, ember, { keep: 0.8, seed: this.rngState });
    this.setVisible(false);
    this.img.setVisible(true);
  }

  // ------------------------------------------------------------ small fx

  private spark(x: number, y: number, color: number, spread: number): void {
    for (let i = 0; i < 2; i++) {
      const a = this.rnd() * Math.PI * 2;
      const r = this.rnd() * spread;
      const sp = this.scene.add
        .image(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.8), i ? TEX.px1 : TEX.px2)
        .setTint(i ? PAL.white : color)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(DEPTH.FX - 1);
      this.scene.tweens.add({
        targets: sp,
        alpha: 0,
        y: sp.y + 2 + this.rnd() * 5,
        duration: 220 + this.rnd() * 200,
        ease: 'Quad.Out',
        onComplete: () => sp.destroy(),
      });
    }
  }

  /** Vertical speed streak above a falling card. */
  private speedLine(x: number, y: number, color: number): void {
    for (let i = 0; i < 2; i++) {
      const lx = Math.round(x + (this.rnd() - 0.5) * 34);
      const len = 6 + Math.floor(this.rnd() * 10);
      const ln = this.scene.add
        .image(lx, Math.round(y - 14 - this.rnd() * 10), TEX.px1)
        .setOrigin(0.5, 1)
        .setScale(1, len)
        .setTint(i ? PAL.white : color)
        .setAlpha(0.8)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(DEPTH.FX - 1);
      this.scene.tweens.add({ targets: ln, alpha: 0, scaleY: len * 0.4, y: ln.y - 6, duration: 160, onComplete: () => ln.destroy() });
    }
  }

  /** Expanding glow ring around the resting card shape. */
  ringBurst(color: number, ms = 360): void {
    const o = this.orientation;
    const ox = (ISO_CX + ISO_GLOW_PAD) / (ISO_TEX_W + ISO_GLOW_PAD * 2);
    const oy = (ISO_CY + ISO_GLOW_PAD) / (ISO_TEX_H + ISO_GLOW_PAD * 2);
    const ring = this.scene.add
      .image(this.home.x, this.home.y, cardIsoGlowKey(o), 'g:0')
      .setOrigin(ox, oy)
      .setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.CARD_ON_TILE + 1);
    this.scene.tweens.add({ targets: ring, scale: 1.55, alpha: 0, duration: ms, ease: 'Cubic.Out', onComplete: () => ring.destroy() });
  }

  /** Ring of dust kicked out from under the card. */
  dust(n = 14, power = 1): void {
    const parts: { img: Phaser.GameObjects.Image; vx: number; vy: number; up: number }[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.rnd() * 0.4;
      const rx = Math.cos(a);
      const ry = Math.sin(a) * 0.5;
      const img = this.scene.add
        .image(Math.round(this.home.x + rx * 20), Math.round(this.home.y + ry * 20), this.rnd() < 0.35 ? TEX.px2 : TEX.px1)
        .setTint([PAL.mist, PAL.steel, PAL.night4][i % 3])
        .setDepth(DEPTH.CARD_ON_TILE + 1);
      parts.push({ img, vx: rx * (14 + this.rnd() * 18) * power, vy: ry * (14 + this.rnd() * 18) * power, up: 3 + this.rnd() * 5 * power });
    }
    const x0 = parts.map((p) => p.img.x);
    const y0 = parts.map((p) => p.img.y);
    void tweenValue(this.scene, 0, 1, 420, (t) => {
      const e = easeOutCubic(t);
      parts.forEach((p, i) => {
        p.img.x = Math.round(x0[i] + p.vx * e);
        p.img.y = Math.round(y0[i] + p.vy * e - p.up * Math.sin(Math.PI * Math.min(1, t * 1.3)));
        p.img.setAlpha(1 - t * t);
      });
    }).then(() => parts.forEach((p) => p.img.destroy()));
  }

  /** Flash the tile diamond (ADD) with an expanding outline. */
  tileFlash(color: number, ms = 300): void {
    const g = this.scene.add.graphics({ x: this.home.x, y: this.home.y }).setDepth(DEPTH.TILE_FX).setBlendMode(Phaser.BlendModes.ADD);
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    const diamond = (k: number) => [
      new Phaser.Math.Vector2(0, -hh * k),
      new Phaser.Math.Vector2(hw * k, 0),
      new Phaser.Math.Vector2(0, hh * k),
      new Phaser.Math.Vector2(-hw * k, 0),
    ];
    void tweenValue(this.scene, 0, 1, ms, (t) => {
      g.clear();
      g.fillStyle(color, 0.55 * Math.pow(1 - t, 2));
      g.fillPoints(diamond(1), true);
      g.lineStyle(1, mix(color, PAL.white, 0.5), 1 - t);
      g.strokePoints(diamond(1 + 0.4 * easeOutCubic(t)), true);
    }).then(() => g.destroy());
  }

  private cleanup(): void {
    this.sheenEvent?.remove();
    this.glowTween?.stop();
    this.bobTween?.stop();
    if (this.liveKey && this.scene?.textures.exists(this.liveKey)) this.scene.textures.remove(this.liveKey);
  }
}

export type { CardOrientation };
