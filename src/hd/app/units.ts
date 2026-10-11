// HDMonsterSprite — one HD monster standing on a tile: a lit Sprite (normal-mapped, flipX for player 2 with the
// normals mirrored by the lighting pipeline), a soft contact shadow, an optional owner rim light.
//
//   const tex = await ensureMonsterTextures(scene, 'crystal_wyrm');
//   const u = new HDMonsterSprite(scene, tex, 0, hdZoneXY(0, 'monster', 1));   // player 0 faces right, player 1 is flipped
//   u.idle();                          // looping idle
//   await u.playOnce('attack');        // one-shot, resolves on complete and returns to idle (guard if u.guarding)
//   u.point('muzzle')                  // frame point → world (flip / origin / scale aware); also 'core' | 'anchor'
//   u.rim = getLighting(scene).ownerRimLight(u.player, u)   // follows the unit via corePoint()
//
// Conventions follow src/duel/MonsterUnit.ts: origin on the art anchor (mirrored for flipX), lifted by art.hover,
// depth = unitDepth(ground y). `lift` (px) raises the sprite off the ground (jumps) while the shadow stays down.

import Phaser from 'phaser';
import type { MonsterAnim } from '../../art/types';
import type { PlayerId } from '../../engine/types';
import { DEPTH, unitDepth, type XY } from '../../view/layout';
import type { HDMonsterArt } from '../contracts';
import type { MonsterTextures } from './assets';
import { SOFT } from './fx';
import { getKit } from './kit';
import { HD_LIGHT, setLitMaterial, type RimLightHandle } from './lighting';

export type UnitPoint = 'muzzle' | 'core' | 'anchor';

export class HDMonsterSprite extends Phaser.GameObjects.Sprite {
  readonly art: HDMonsterArt;
  readonly tex: MonsterTextures;
  readonly player: PlayerId;
  /** Ground contact point of the tile (the sprite's anchor sits `hover + lift` above it). */
  ground: XY;
  /** Extra height above the ground, px (the shadow stays on the floor and shrinks). */
  lift = 0;
  guarding = false;
  rim: RimLightHandle | null = null;
  readonly shadow: Phaser.GameObjects.Image;
  /**
   * Additive copy of the art's `emissive` layer (flames, eyes, veins; only when the HD art returns `emissive` per frame),
   * living in the front bloom layer: the emissive parts glow and bloom while the monster's own pixels stay sharp.
   */
  readonly glow: Phaser.GameObjects.Sprite | null = null;
  /** Strength of the emissive overlay (0 = off). Animate it for pulses / charge-ups. */
  emissiveGain = 0.6;
  private shadowBase: number;
  private autoDepth = true;

  constructor(scene: Phaser.Scene, tex: MonsterTextures, player: PlayerId, ground: XY) {
    super(scene, ground.x, ground.y - tex.art.hover, tex.key, tex.frameName('idle', 0));
    scene.add.existing(this);
    this.art = tex.art;
    this.tex = tex;
    this.player = player;
    this.ground = { ...ground };
    this.setPipeline(HD_LIGHT);
    // bright saturated texels (flames, eyes, veins) stay self-lit under the ambient light
    setLitMaterial(this, { emissive: 0.45 });
    this.setFlipX(player === 1);
    const a = this.art;
    this.setOrigin((this.flipX ? a.w - a.anchorX : a.anchorX) / a.w, a.anchorY / a.h);
    this.setDepth(unitDepth(ground.y));
    const sw = Math.max(40, tex.bodyW * 0.62);
    this.shadowBase = sw;
    this.shadow = scene.add
      .image(ground.x, ground.y, SOFT.shadow)
      .setDepth(DEPTH.SHADOW)
      .setDisplaySize(sw, sw * 0.42)
      .setAlpha(0.7);
    if (tex.emissiveKey) {
      this.glow = scene.add.sprite(this.x, this.y, tex.emissiveKey, tex.frameName('idle', 0)).setBlendMode(Phaser.BlendModes.ADD);
      getKit(scene).fx.glow(this.glow, 'front');
    }
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.rim?.destroy();
      this.shadow.destroy();
      this.glow?.destroy();
    });
  }

  /** Detach the automatic depth (cinematics that fly over other things set their own depth). */
  setAutoDepth(on: boolean): this {
    this.autoDepth = on;
    return this;
  }

  /** Move to a new ground point (position, depth, shadow). */
  setGround(x: number, y: number): this {
    this.ground.x = x;
    this.ground.y = y;
    this.setPosition(x, y - this.art.hover - this.lift);
    return this;
  }

  idle(): this {
    this.guarding = false;
    this.play(this.tex.animKey('idle'));
    return this;
  }

  guard(): this {
    this.guarding = true;
    this.play(this.tex.animKey('guard'));
    return this;
  }

  /** Play a one-shot animation; resolves when it completes, then returns to idle (or guard). */
  playOnce(anim: MonsterAnim): Promise<void> {
    const key = this.tex.animKey(anim);
    return new Promise((resolve) => {
      const done = () => {
        this.off(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + key, done);
        this.off(Phaser.Animations.Events.ANIMATION_STOP, done);
        if (this.active) (this.guarding ? this.guard() : this.idle());
        resolve();
      };
      this.once(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + key, done);
      this.play(key);
    });
  }

  /** World position of a pixel of the current frame (origin / flip / scale aware). */
  framePoint(px: number, py: number): XY {
    const a = this.art;
    const fx = this.flipX ? a.w - px : px;
    return { x: this.x + (fx - this.originX * a.w) * this.scaleX, y: this.y + (py - this.originY * a.h) * this.scaleY };
  }

  point(which: UnitPoint): XY {
    const a = this.art;
    if (which === 'muzzle') return this.framePoint(a.muzzle.x, a.muzzle.y);
    if (which === 'anchor') return this.framePoint(a.anchorX, a.anchorY);
    return this.framePoint(a.core.x, a.core.y);
  }

  /** Where rim lights aim (the visual centre). */
  corePoint(): XY {
    return this.point('core');
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    // the shadow stays on the floor under the sprite and shrinks with height
    const up = Math.max(0, this.art.hover + this.lift);
    const k = Math.max(0.5, 1 - up / 140);
    this.shadow
      .setPosition(this.x, this.ground.y + 2)
      .setDisplaySize(this.shadowBase * k, this.shadowBase * 0.42 * k)
      .setAlpha(0.7 * k)
      .setVisible(this.visible);
    if (this.autoDepth) this.setDepth(unitDepth(this.ground.y));
    const g = this.glow;
    if (g && g.active) {
      if (g.texture.has(this.frame.name as string)) g.setFrame(this.frame.name);
      g.setPosition(this.x, this.y)
        .setOrigin(this.originX, this.originY)
        .setFlipX(this.flipX)
        .setScale(this.scaleX, this.scaleY)
        .setAngle(this.angle)
        .setAlpha(this.alpha * this.emissiveGain)
        .setVisible(this.visible && this.emissiveGain > 0)
        .setDepth(this.depth);
    }
  }
}
