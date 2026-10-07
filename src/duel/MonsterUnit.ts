// MonsterUnit — one face-up monster standing on its tile: the animated sprite, a drop shadow
// and the ATK/DEF badge, plus aura slots (equip glow, volcano flames...).
//
//   const u = field.unit(uid)!;
//   await u.attackToImpact();          // plays 'attack', resolves on attackImpactFrame
//   const m = u.worldPoint('muzzle');  // frame point → world (flip / origin / scale aware)
//   await u.play('roar');              // one-shot, resolves on complete, then back to idle/guard
//   await u.setStats(3500, 2300);      // badge rolls green
//   await u.setPosition('defense');    // guard loop + the tile card turns sideways
//
// The sprite is a plain top-level Sprite (NOT inside a container) so every VFX helper that
// takes a sprite (lunge, shatter, materialize, chainsBind, chasm, swordForge...) works on it
// directly. Its origin sits on the art anchor (mirrored for player 2, who uses flipX); the
// sprite is lifted by `art.hover`. Depth = unitDepth(ground y).
//
// `lift` (px, default 0): set it while you move the sprite UP off the ground (jumps, dives) so
// the shadow stays on the floor and shrinks instead of following the sprite into the air.

import Phaser from 'phaser';
import { CARDS, isMonster, type Attribute, type MonsterCardDef, type MonsterId } from '../data/cards';
import { monsterArt } from '../art/monsters';
import { PAL } from '../art/palette';
import { PixelCanvas } from '../art/pixel';
import { monsterAnimKey, monsterFrame, monsterFrameName, monsterTextureKey } from '../art/textures';
import type { MonsterAnim, MonsterArt } from '../art/types';
import type { PlayerId, Position, Uid } from '../engine/types';
import { DEPTH, type XY, unitDepth, zoneXY } from '../view/layout';
import type { TileCard } from '../view/TileCard';
import { wait } from '../vfx/core';
import { framePointToWorld } from '../vfx/combat';
import { clearHologram, getHologram } from '../vfx/hologram';
import type { Disposable } from './types';
import { StatBadge } from './StatBadge';

export type UnitPoint = 'muzzle' | 'core' | 'anchor' | 'top' | 'feet';

/** Badge offset from the tile centre (on the front half of the tile). */
const BADGE_DY = 11;

function shadowKey(scene: Phaser.Scene, rx: number): string {
  const ry = Math.max(2, Math.round(rx * 0.42));
  const key = `duel:shadow:${rx}x${ry}`;
  if (scene.textures.exists(key)) return key;
  const W = rx * 2 + 1;
  const H = ry * 2 + 1;
  const p = new PixelCanvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = (x - rx) / (rx + 0.5);
      const dy = (y - ry) / (ry + 0.5);
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      // solid core, dithered rim (no smooth alpha in pixel art)
      if (d < 0.45) p.set(x, y, PAL.ink);
      else if (d < 0.75) {
        if ((x + y) % 2 === 0) p.set(x, y, PAL.ink);
      } else if ((x % 2 === 0 && y % 2 === 0) || (x % 2 === 1 && y % 2 === 1 && (x + y) % 4 === 0)) p.set(x, y, PAL.ink);
    }
  scene.textures.addCanvas(key, p.toCanvas());
  return key;
}

const widthCache = new Map<MonsterId, number>();
function opaqueWidth(id: MonsterId): number {
  let w = widthCache.get(id);
  if (w === undefined) {
    const b = monsterFrame(id, 'idle', 0).bounds();
    w = b ? b.w : 24;
    widthCache.set(id, w);
  }
  return w;
}

let unitSeed = 0x9e3779b1;
function rnd(): number {
  unitSeed = (unitSeed * 1664525 + 1013904223) >>> 0;
  return unitSeed / 4294967296;
}

export interface MonsterUnitOpts {
  uid: Uid;
  cardId: MonsterId;
  /** Controller (whose side it stands on; facing). */
  player: PlayerId;
  zone: number;
  position: Position;
  atk: number;
  def: number;
  /** Start hidden (summon cinematics reveal it). Default false. */
  hidden?: boolean;
}

export class MonsterUnit {
  readonly scene: Phaser.Scene;
  readonly uid: Uid;
  readonly cardId: MonsterId;
  readonly card: MonsterCardDef;
  readonly art: MonsterArt;
  readonly attribute: Attribute;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;
  readonly badge: StatBadge;
  player: PlayerId;
  zone: number;
  position: Position;
  /** The TileCard under it (set by FieldView). */
  tile: TileCard | null = null;
  /** Height above the floor while airborne (keeps the shadow on the ground). */
  lift = 0;
  /** Retired (left the field); objects are destroyed shortly after. */
  retired = false;
  /**
   * A cinematic holds the sprite in a deliberate pose across events (e.g. the attack wind-up
   * kept while the defender decides on a trap): FieldView.sync will not settle it. Clear it
   * (and call settle()) when done.
   */
  posed = false;
  private readonly auras = new Map<string, Disposable>();
  private shown = true;
  private playToken = 0;
  private readonly waiters: (() => void)[] = [];
  private readonly shadowBase: number;
  private readonly updateFn: () => void;

  constructor(scene: Phaser.Scene, o: MonsterUnitOpts) {
    this.scene = scene;
    this.uid = o.uid;
    this.cardId = o.cardId;
    const def = CARDS[o.cardId];
    if (!isMonster(def)) throw new Error(`not a monster: ${o.cardId}`);
    this.card = def;
    this.attribute = def.attribute;
    this.art = monsterArt(o.cardId);
    this.player = o.player;
    this.zone = o.zone;
    this.position = o.position;
    const home = this.home;
    const rx = Math.max(7, Math.round(opaqueWidth(o.cardId) * 0.36));
    this.shadowBase = this.art.hover > 0 ? Math.max(0.55, 1 - this.art.hover / 30) : 1;
    this.shadow = scene.add.image(home.x, home.y, shadowKey(scene, rx)).setDepth(DEPTH.SHADOW).setAlpha(0.5).setScale(this.shadowBase);
    this.sprite = scene.add.sprite(home.x, home.y - this.art.hover, monsterTextureKey(o.cardId), monsterFrameName('idle', 0));
    this.applyFacing();
    this.sprite.setDepth(unitDepth(home.y));
    this.badge = new StatBadge(scene, home.x, home.y + BADGE_DY, {
      player: o.player,
      position: o.position,
      atk: o.atk,
      def: o.def,
      baseAtk: def.atk,
      baseDef: def.def,
    });
    this.rest(true);
    if (o.hidden) this.hide();
    this.updateFn = () => this.update();
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.updateFn);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  // ================================================================ geometry

  /** Floor point: the tile centre of its zone. */
  get home(): XY {
    return zoneXY(this.player, 'monster', this.zone);
  }

  get hover(): number {
    return this.art.hover;
  }

  /** Resting sprite position (origin on the art anchor, lifted by hover). */
  get rest0(): XY {
    const h = this.home;
    return { x: h.x, y: h.y - this.art.hover };
  }

  get flipX(): boolean {
    return this.player === 1;
  }

  /** Current animation name and frame index (0-based) of the sprite. */
  frameInfo(): { anim: MonsterAnim | null; frame: number } {
    const name = String(this.sprite.frame?.name ?? '');
    const i = name.indexOf(':');
    if (i < 0) return { anim: null, frame: 0 };
    return { anim: name.slice(0, i) as MonsterAnim, frame: Number(name.slice(i + 1)) || 0 };
  }

  /** A frame point of the art in world space (follows the sprite's current position/flip/scale). */
  framePoint(fx: number, fy: number): XY {
    return framePointToWorld(this.sprite, fx, fy);
  }

  /**
   * Named points: 'muzzle' (beam / projectile origin at the attack impact frame), 'core'
   * (centre of mass: hit sparks, lock-on), 'anchor' (the art's ground-contact point on the
   * sprite), 'feet' (the floor under the sprite, ignoring hover), 'top' (top of the body).
   */
  worldPoint(kind: UnitPoint): XY {
    const a = this.art;
    switch (kind) {
      case 'muzzle':
        return this.framePoint(a.muzzle.x, a.muzzle.y);
      case 'core':
        return this.framePoint(a.core.x, a.core.y);
      case 'anchor':
        return this.framePoint(a.anchorX, a.anchorY);
      case 'feet': {
        const p = this.framePoint(a.anchorX, a.anchorY);
        return { x: p.x, y: p.y + a.hover + this.lift };
      }
      case 'top': {
        const b = monsterFrame(this.cardId, 'idle', 0).bounds();
        const top = b ? b.y : 0;
        return this.framePoint(a.core.x, top);
      }
    }
  }

  core(): XY {
    return this.worldPoint('core');
  }

  muzzle(): XY {
    return this.worldPoint('muzzle');
  }

  // ================================================================ animation

  /** Loop idle (attack position) or guard (defense position). */
  rest(randomStart = false): void {
    const anim: MonsterAnim = this.position === 'defense' ? 'guard' : 'idle';
    const key = monsterAnimKey(this.cardId, anim);
    if (!this.scene.anims.exists(key)) return;
    const n = this.art.anims[anim].frames;
    this.sprite.play({ key, repeat: -1, startFrame: randomStart ? Math.floor(rnd() * n) : 0 });
    this.flushWaiters();
  }

  /**
   * Play an animation. Looping anims resolve immediately. One-shots resolve on completion and
   * then return to idle/guard (opts.hold = stay on the last frame). Superseded plays resolve.
   */
  play(anim: MonsterAnim, opts: { hold?: boolean } = {}): Promise<void> {
    const key = monsterAnimKey(this.cardId, anim);
    if (!this.scene.anims.exists(key) || !this.sprite.active) return Promise.resolve();
    this.flushWaiters();
    const token = ++this.playToken;
    const spec = this.art.anims[anim];
    if (spec.loop) {
      this.sprite.play({ key, repeat: -1 });
      return Promise.resolve();
    }
    this.sprite.play({ key, repeat: 0 });
    return new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + key, onComplete);
        resolve();
      };
      const onComplete = () => {
        if (token === this.playToken && !opts.hold && !this.retired) this.rest();
        finish();
      };
      this.waiters.push(finish);
      this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + key, onComplete);
      // safety net (scene time follows speed / hit-stop like the animation clock)
      const ms = (spec.frames / spec.fps) * 1000;
      void wait(this.scene, ms * 1.6 + 300).then(() => {
        if (done) return;
        if (token === this.playToken && !opts.hold && !this.retired) this.rest();
        finish();
      });
    });
  }

  /** Resolve when the current animation `anim` reaches `frame` (0-based). Starts it if needed. */
  playToFrame(anim: MonsterAnim, frame: number): Promise<void> {
    const key = monsterAnimKey(this.cardId, anim);
    if (!this.scene.anims.exists(key) || !this.sprite.active) return Promise.resolve();
    const cur = this.frameInfo();
    if (cur.anim !== anim || !this.sprite.anims.isPlaying) void this.play(anim);
    return new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        this.sprite.off(Phaser.Animations.Events.ANIMATION_UPDATE, onUpdate);
        resolve();
      };
      const onUpdate = (a: Phaser.Animations.Animation, f: Phaser.Animations.AnimationFrame) => {
        if (a.key !== key) return finish();
        if (f.index - 1 >= frame) finish();
      };
      if (this.frameInfo().anim === anim && this.frameInfo().frame >= frame) return finish();
      this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, onUpdate);
      this.waiters.push(finish);
      const spec = this.art.anims[anim];
      void wait(this.scene, ((frame + 1) / spec.fps) * 1000 * 1.6 + 300).then(finish);
    });
  }

  /** Play 'attack' and resolve on the art's attackImpactFrame (the rest plays on). */
  attackToImpact(): Promise<void> {
    void this.play('attack');
    return this.playToFrame('attack', this.art.attackImpactFrame);
  }

  /** ms from the start of 'attack' to its impact frame. */
  get impactMs(): number {
    return (this.art.attackImpactFrame / this.art.anims.attack.fps) * 1000;
  }

  // ================================================================ state

  /** Roll the badge to new values (green up / red down). */
  setStats(atk: number, def: number, animate = true): Promise<void> {
    return this.badge.set(atk, def, animate);
  }

  get shownStats(): { atk: number; def: number } {
    return { atk: this.badge.atk, def: this.badge.def };
  }

  /** Attack ↔ defense: guard/idle loop, the tile card turns, a short flourish when animated. */
  async setPosition(pos: Position, animate = true): Promise<void> {
    if (pos === this.position && (!this.tile || this.tile.orientation === (pos === 'defense' ? 'side' : 'up'))) return;
    this.position = pos;
    this.badge.setPosition(pos);
    const o = pos === 'defense' ? 'side' : 'up';
    if (!animate) {
      this.rest();
      if (this.tile && this.tile.orientation !== o) this.tile.sync(this.tile.cardId, this.tile.faceUp, o);
      return;
    }
    const jobs: Promise<void>[] = [];
    if (this.tile && this.tile.orientation !== o) jobs.push(this.tile.rotateTo(o, 340));
    if (pos === 'attack') jobs.push(this.play('roar'));
    else this.rest();
    await Promise.all(jobs);
  }

  setController(p: PlayerId, zone: number): void {
    this.player = p;
    this.zone = zone;
    this.badge.setPlayer(p);
    this.applyFacing();
  }

  /** Aura slot (equip glow, volcano flames...). Replacing destroys the old one; null clears. */
  setAura(key: string, handle: Disposable | null): void {
    const old = this.auras.get(key);
    if (old && old !== handle) {
      try {
        old.destroy();
      } catch {
        /* ignore */
      }
    }
    if (handle) this.auras.set(key, handle);
    else this.auras.delete(key);
  }

  aura(key: string): Disposable | null {
    return this.auras.get(key) ?? null;
  }

  hasAura(key: string): boolean {
    return this.auras.has(key);
  }

  /** Whole unit visible (sprite + badge + shadow). */
  get visible(): boolean {
    return this.shown;
  }

  hide(): void {
    this.shown = false;
    this.sprite.setVisible(false);
    this.badge.setVisible(false);
  }

  show(): void {
    this.shown = true;
    this.sprite.setVisible(true);
    this.badge.setVisible(true);
  }

  /** Show only the sprite (the badge pops later, e.g. on the summon impact beat). */
  showSprite(): void {
    this.shown = true;
    this.sprite.setVisible(true);
  }

  /**
   * Back to the canonical look: home position, scale 1, no tint / crop / hologram, visible,
   * idle or guard looping. Used by FieldView.sync between cinematics.
   */
  settle(): void {
    if (this.retired || !this.sprite.active) return;
    const r = this.rest0;
    const s = this.sprite;
    this.scene.tweens.killTweensOf(s);
    s.setPosition(r.x, r.y).setScale(1).setAngle(0).setAlpha(1).setVisible(true);
    this.lift = 0;
    s.setCrop();
    if (s.isTinted) s.clearTint();
    if (getHologram(s)) clearHologram(s);
    this.applyFacing();
    s.setDepth(unitDepth(this.home.y));
    const want: MonsterAnim = this.position === 'defense' ? 'guard' : 'idle';
    const cur = this.frameInfo().anim;
    if (cur !== want || !s.anims.isPlaying) {
      const busyOneShot = s.anims.isPlaying && (cur === 'roar' || cur === 'hit' || cur === 'attack');
      if (!busyOneShot) this.rest();
    }
    this.badge.setPosition(this.position);
    this.badge.moveTo(this.home.x, this.home.y + BADGE_DY);
    if (!this.badge.visible) this.badge.setVisible(true);
    this.shown = true;
  }

  /** True when the sprite is not in its canonical resting state. */
  get displaced(): boolean {
    if (this.posed) return false;
    const s = this.sprite;
    const r = this.rest0;
    return (
      !s.visible || s.alpha < 0.99 || Math.abs(s.x - r.x) > 0.5 || Math.abs(s.y - r.y) > 0.5 || s.scaleX !== 1 || s.scaleY !== 1 || s.angle !== 0 || s.flipX !== this.flipX || !this.badge.visible
    );
  }

  /** Leave the field: hide now (auras fade), destroy the objects a bit later (VFX may still read them). */
  retire(delayMs = 1600): void {
    if (this.retired) return;
    this.retired = true;
    for (const k of [...this.auras.keys()]) this.setAura(k, null);
    this.badge.setVisible(false);
    this.sprite.setVisible(false);
    this.shadow.setVisible(false);
    this.flushWaiters();
    this.scene.time.delayedCall(delayMs, () => this.destroy());
  }

  destroy(): void {
    this.retired = true;
    this.flushWaiters();
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.updateFn);
    for (const k of [...this.auras.keys()]) this.setAura(k, null);
    if (this.sprite.active) this.sprite.destroy();
    if (this.shadow.active) this.shadow.destroy();
    this.badge.destroy();
  }

  // ================================================================ internals

  private applyFacing(): void {
    const a = this.art;
    const flip = this.flipX;
    this.sprite.setFlipX(flip);
    this.sprite.setOrigin((flip ? a.w - a.anchorX : a.anchorX) / a.w, a.anchorY / a.h);
  }

  private flushWaiters(): void {
    const w = this.waiters.splice(0);
    for (const f of w) f();
  }

  private update(): void {
    const s = this.sprite;
    if (!s.active) return;
    const vis = s.visible && !this.retired && s.alpha > 0.05;
    this.shadow.setVisible(vis);
    if (!vis) return;
    // the shadow stays on the floor under the sprite and shrinks with the height above it
    const h = this.art.hover + this.lift;
    this.shadow.setPosition(Math.round(s.x), Math.round(s.y + h));
    const k = Math.max(0.35, this.shadowBase * (1 - this.lift / 90)) * Math.abs(s.scaleX);
    this.shadow.setScale(k);
    this.shadow.setAlpha(0.5 * Math.min(1, s.alpha) * (this.lift > 0 ? Math.max(0.35, 1 - this.lift / 80) : 1));
  }
}
