// MonsterUnit — one face-up monster standing on its tile: the animated sprite, a drop shadow
// and the ATK/DEF badge, plus aura slots (equip glow, volcano flames...).
//
//   const u = field.unit(uid)!;
//   await u.attackToImpact();          // plays 'attack', resolves on attackImpactFrame
//   const m = u.worldPoint('muzzle');  // frame point → world (flip / origin / scale aware)
//   await u.play('roar');              // one-shot, resolves on complete, then back to idle/guard
//   u.pose('attack', 3);               // stop and hold one frame (manual control)
//   await u.playRange('attack', 4);    // frames 4…end, then rest (to: stop and hold frame `to`)
//   const p = u.tryPlay('death');      // false when the art lacks a v3 extra anim → own fallback
//   await wait(scene, u.impactMs);     // timings: impactMs / frameMs / rangeMs / animMs / markMs
//   await u.setStats(3500, 2300);      // badge rolls green
//   await u.setPosition('defense');    // guard loop + the tile card turns sideways
//
// The sprite is a plain top-level Sprite (NOT inside a container) so every VFX helper that
// takes a sprite (lunge, shatter, materialize, chainsBind, chasm, swordForge...) works on it
// directly. Its origin sits on the art anchor (mirrored for player 2, who uses flipX); the
// sprite is lifted by `art.hover`. Depth = unitDepth(ground y).
//
// P2 lighting (v3): a monster whose art has `p2: 'relight'` shows its second sheet
// `mon:<id>:p2` (drawn lit from the frame's top-right) while player 2 controls it, so the
// mirrored sprite is still lit from the screen's top-left; applyFacing picks the sheet and
// UnitSprite.syncSheet keeps every frame on it (anim keys and events stay `mon:<id>:<anim>`).
// 'mirror' monsters (all of today's) keep one sheet: nothing changes for them.
//
// `lift` (px, default 0): set it while you move the sprite UP off the ground (jumps, dives) so
// the shadow stays on the floor and shrinks instead of following the sprite into the air.
//
// Guard-pose rule (art review): a DEFENSE-position unit never snaps into its upright 'hit'
// recoil. Every path that would show it — unit.play('hit'), unit.playToFrame('hit', f),
// sprite.play(<hit anim>), sprite.setFrame('hit:N') (e.g. a death holding a hit frame) — is
// answered from the guard pose instead: guard frames, a white flash frame, a small hex-shield
// glint on the side the blow came from and a 2–3 px knock-back away from the attacker
// (unit.guardHit; with the v3 weight profiles the knock-back follows the monster's weight class,
// src/duel/motion.ts). The sprite is a UnitSprite (a plain Sprite subclass) so this lives in one
// place and holds for every cinematic, shatter and death flavour (also for the v3 'hitHeavy' /
// 'hitMagic' recoils).
//
// Timing unity (v3 A1): every animation duration — the attack impact, the safety nets, the
// kits' pose / playFrom helpers (thin wrappers over pose / playRange) — is read through the
// helpers in the "animation timing" section (src/art/animtime.ts), so per-frame AnimSpec.holds
// are honoured everywhere. Without holds every value is bit-identical to the old
// `(frames / fps) * 1000` arithmetic, so the old monsters keep their exact timings.

import Phaser from 'phaser';
import { CARDS, isMonster, type Attribute, type MonsterCardDef, type MonsterId } from '../data/cards';
import { monsterArt } from '../art/monsters';
import { PAL } from '../art/palette';
import { PixelCanvas } from '../art/pixel';
import { monsterAnimKey, monsterFrame, monsterFrameName, monsterP2TextureKey, monsterSheetKey, monsterTextureKey, warmMonsterSheet } from '../art/textures';
import type { AnimMark, AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterArt } from '../art/types';
import { animLengthMs, animSpec, artMarkFrame, frameMs as specFrameMs, frameStartMs, impactFrame as artImpactFrame, impactMs as artImpactMs, rangeMs as specRangeMs } from '../art/animtime';
import type { PlayerId, Position, Uid } from '../engine/types';
import { DEPTH, LOOK_V3, type XY, unitDepth, zoneXY } from '../view/layout';
import type { TileCard } from '../view/TileCard';
import { wait } from '../vfx/core';
import { framePointToWorld } from '../vfx/combat';
import { clearHologram, getHologram } from '../vfx/hologram';
import { Raster, run } from '../vfx/setpieces';
import type { Disposable } from './types';
import { StatBadge } from './StatBadge';
import { motionProfile, reactGuardPushPx, reactGuardReturnEase } from './motion';
import { onDuelStart } from './seeds';
import { contactFlash } from '../cinematics/_v3/flash';

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

/** Drop-shadow half-width of a monster (from its idle silhouette). */
function shadowRx(id: MonsterId): number {
  return Math.max(7, Math.round(opaqueWidth(id) * 0.36));
}

/**
 * Warm (v3 A1 item 11): create a monster's drop-shadow texture (`duel:shadow:<rx>x<ry>`) ahead of
 * its first unit. Returns the key.
 */
export function warmUnitShadow(scene: Phaser.Scene, id: MonsterId): string {
  return shadowKey(scene, shadowRx(id));
}

const UNIT_SEED0 = 0x9e3779b1;
let unitSeed = UNIT_SEED0;
onDuelStart(() => (unitSeed = UNIT_SEED0));
function rnd(): number {
  unitSeed = (unitSeed * 1664525 + 1013904223) >>> 0;
  return unitSeed / 4294967296;
}

/** v3: a monster sprite's scale within this of 1× is shown at 1× (see MonsterUnit.update). */
const SNAP_SCALE = 0.25;

/** v3: extra poses warmed as a unit takes the field (reactions, guard brace / break, death). */
const WARM_ON_FIELD: readonly AnyMonsterAnim[] = ['hitMagic', 'hitHeavy', 'death', 'toGuard', 'fromGuard'];

/** The recoil animations: in DEFENSE position they are answered from the guard pose (see the header). */
const HIT_ANIMS: readonly AnyMonsterAnim[] = ['hit', 'hitHeavy', 'hitMagic'];

function isHitAnim(anim: AnyMonsterAnim): boolean {
  return HIT_ANIMS.includes(anim);
}

/** A frame name of one of the recoil animations ('hit:N', 'hitHeavy:N', 'hitMagic:N')? */
function isHitFrameName(name: string): boolean {
  return name.startsWith('hit:') || name.startsWith('hitHeavy:') || name.startsWith('hitMagic:');
}

function clampFrame(v: number, last: number): number {
  const f = Math.round(v);
  return f < 0 ? 0 : f > last ? last : f;
}

/** Frame name of a setFrame() argument (null for numeric indices). */
function frameNameOf(frame: string | number | Phaser.Textures.Frame): string | null {
  if (typeof frame === 'string') return frame;
  if (frame instanceof Phaser.Textures.Frame) return String(frame.name);
  return null;
}

/**
 * The unit's sprite: a plain Phaser Sprite (every VFX helper takes it) that applies the
 * guard-pose rule — while its unit stands in DEFENSE position, playing the 'hit' anim becomes a
 * guard-pose reaction and showing a 'hit:N' frame shows the guard frame instead.
 */
export class UnitSprite extends Phaser.GameObjects.Sprite {
  /** Set by MonsterUnit right after construction. */
  unit: MonsterUnit | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, frame?: string | number) {
    super(scene, x, y, texture, frame);
    // P2 relight (v3): every animation frame change (play, update, chain, repeat...) goes through
    // AnimationState.setCurrentFrame, which sets the frame of the anim's own sheet (`mon:<id>`):
    // swap it to the same-named frame of the unit's sheet right after (see syncSheet).
    const anims = this.anims;
    const set = anims.setCurrentFrame.bind(anims);
    anims.setCurrentFrame = (f: Phaser.Animations.AnimationFrame) => {
      const r = set(f);
      this.syncSheet();
      return r;
    };
  }

  /**
   * Keep the sprite on its unit's sheet (MonsterUnit.sheetKey: the P2 'relight' sheet or the
   * default one). Both sheets share frame names and sizes, so only the texture changes; the anim
   * keys and their events stay `mon:<id>:<anim>`. A no-op for 'mirror' monsters (one sheet) and
   * while the sprite shows some other texture.
   */
  syncSheet(): void {
    const u = this.unit;
    const cur = this.texture?.key;
    if (!u || !this.scene || !this.frame || cur === u.sheetKey || (cur !== u.p1Key && cur !== u.p2Key)) return;
    const name = this.frame.name;
    const tex = this.scene.textures.get(u.sheetKey);
    if (!tex.has(name)) return;
    this.texture = tex;
    super.setFrame(name, false, false); // the base setFrame: frame + crop UVs (no guard rule)
  }

  override play(key: string | Phaser.Animations.Animation | Phaser.Types.Animations.PlayAnimationConfig, ignoreIfPlaying?: boolean): this {
    const u = this.unit;
    // v3 claim: a caller outside the claimant (a strike still running) no longer drives the sprite
    if (u && u.locked) return this;
    const hit = u && u.guarding ? u.hitAnimOfKey(key) : null;
    if (u && hit) {
      u.guardHitFromSprite(hit);
      return this;
    }
    return super.play(key, ignoreIfPlaying);
  }

  override setFrame(frame: string | number | Phaser.Textures.Frame, updateSize?: boolean, updateOrigin?: boolean): this {
    const u = this.unit;
    if (u && u.locked) return this;
    if (u && u.guarding) {
      const name = frameNameOf(frame);
      if (name && isHitFrameName(name)) frame = u.guardFrameName();
    }
    super.setFrame(frame, updateSize, updateOrigin);
    this.syncSheet();
    return this;
  }
}

/**
 * A small hexagonal shield glint (pixel raster, ~300 ms): a flattened hexagon facing `face`
 * (−1 left / +1 right) flashes white, its rim ripples blue, a light streak crosses it, it fades.
 */
function guardGlint(scene: Phaser.Scene, x: number, y: number, face: number, depth: number, R = 11, ms = 300): void {
  x = Math.round(x);
  y = Math.round(y);
  const ras = Raster.around(scene, x, y, Math.ceil(R * 1.4) * 2 + 6, Math.ceil(R * 1.15) * 2 + 6, depth, Phaser.BlendModes.ADD);
  const sq = 0.55;
  const hex = (r: number): XY[] => {
    const pts: XY[] = [];
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      pts.push({ x: x + Math.cos(a) * r * sq, y: y + Math.sin(a) * r });
    }
    return pts;
  };
  void run(scene, ms, (t) => {
    ras.draw((g) => {
      const r = R * (t < 0.2 ? 0.75 + (t / 0.2) * 0.3 : 1.05 - (t - 0.2) * 0.06);
      const lv = t < 0.15 ? 1 : 1 - (t - 0.15) / 0.85;
      const outer = hex(r);
      if (t < 0.1) g.poly(outer, PAL.white, 0.45);
      g.path(outer, t < 0.15 ? PAL.white : PAL.water3, lv);
      if (t < 0.6) g.path(hex(r - 3), PAL.water4, lv * 0.6);
      const sx = x + (-r * sq + 2 * r * sq * Math.min(1, t * 2.4)) * (face >= 0 ? 1 : -1);
      if (t < 0.42) g.line(sx - 1, y - r * 0.6, sx + 1, y + r * 0.6, PAL.white, 1 - t * 2.2);
    });
  }).then(() => ras.destroy());
}

/**
 * White silhouette over a sprite for `frames` real frames (it keeps flashing through a hit-stop).
 * It is an overlay that follows the sprite, so the sprite's own tint — and any other flash
 * running on it (combat.whiteFlash saves / restores the tint and must not capture this one) —
 * is never touched.
 */
function flashOverlay(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite, frames: number): void {
  if (!s.active || !s.visible || !s.frame) return;
  const g = scene.add
    .image(s.x, s.y, s.texture.key, s.frame.name)
    .setOrigin(s.originX, s.originY)
    .setFlipX(s.flipX)
    .setScale(s.scaleX, s.scaleY)
    .setAngle(s.angle)
    .setDepth(s.depth + 0.05)
    .setTintFill(PAL.white);
  let k = 0;
  const end = () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, tick);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, end);
    if (g.active) g.destroy();
  };
  const tick = () => {
    if (++k > frames || !s.active || !g.active) return end();
    g.setPosition(s.x, s.y).setFrame(s.frame.name).setFlipX(s.flipX).setScale(s.scaleX, s.scaleY).setVisible(s.visible);
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, tick);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, end);
}

export interface GuardHitOpts {
  /** Direction of the blow (attacker → this unit); the knock-back follows it. */
  dir?: XY;
  /** Where the blow comes from (used for the direction when `dir` is not given). */
  from?: XY;
  /**
   * 1 light (2 px knock-back) · 2–3 heavy (3 px, longer flash). Default 2. With the weight
   * profiles on (v3) the knock-back is also scaled by this monster's class (motion.ts).
   */
  power?: 1 | 2 | 3;
  /** Stay pushed (a death follows) instead of springing back. */
  hold?: boolean;
  /**
   * Default true: the guard answers with its pose (v3: the brace through the toGuard frames, else
   * the guard loop holds). false: flash, glint and knock-back only — the caller owns the pose (a
   * lethal blow that breaks the guard, _v3/guardbreak.ts).
   */
  pose?: boolean;
}

/** Options of MonsterUnit.play(). */
export interface PlayOpts extends GuardHitOpts {
  /** Stay on the last frame instead of returning to idle/guard (also the guard-hit hold). */
  hold?: boolean;
  /**
   * Played instead when this monster's art lacks `anim` (e.g. 'special' → 'roar', 'hitHeavy' →
   * 'hit'). Without it a missing anim resolves at once. See also tryPlay().
   */
  fallback?: AnyMonsterAnim;
}

/**
 * Options of MonsterUnit.playRange(). The defaults behave like play(); the cinematic kits'
 * playFrom wrappers pass their own (historical) settings so their timing stays identical.
 */
export interface PlayRangeOpts {
  /** Without `to`: stay on the last frame instead of returning to idle/guard. */
  hold?: boolean;
  /** sprite.anims.timeScale for this play (set when it starts, back to 1 when it ends). Default: untouched. */
  timeScale?: number;
  /**
   * Default true: the play owns the unit like play() — pending play() / playToFrame() promises
   * resolve now, and an earlier one-shot can no longer send the sprite back to rest when it ends.
   * false: a side play that leaves them alone (what the kits' playFrom helpers always did).
   */
  exclusive?: boolean;
  /** Return to rest at the end only while the sprite still shows `anim`. Default false. */
  restIfCurrent?: boolean;
  /** Also return to rest when the safety timeout ends the wait. Default true. */
  restOnTimeout?: boolean;
  /**
   * Safety net that ends the wait if the end never comes (superseded, stopped). Gets the
   * hold-aware ms still to play; default `wait(scene, ms × 1.6 + 300)` (scene time).
   */
  safety?: (ms: number) => Promise<unknown>;
}

/** Internal: how a one-shot wait ends (see MonsterUnit.untilComplete). */
interface OneShotCtl {
  hold: boolean;
  /** play-slot token (exclusive plays) or null (side plays) */
  token: number | null;
  restIfCurrent: boolean;
  restOnTimeout: boolean;
  timeScale: number | undefined;
  safety: (ms: number) => Promise<unknown>;
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
  /**
   * v3: a lethal blow broke the guard (_v3/guardbreak.ts): the unit no longer answers hits from
   * its guard pose (guarding is false), so the guard can open into the recoil and the death.
   */
  guardBroken = false;
  /** The default sheet `mon:<id>` and the optional P2 'relight' sheet key `mon:<id>:p2`. */
  readonly p1Key: string;
  readonly p2Key: string;
  /**
   * The sheet the sprite shows (UnitSprite.syncSheet keeps it there): `mon:<id>:p2` while player 2
   * controls a monster that has a P2 relight sheet, else `mon:<id>`. Set by applyFacing.
   */
  sheetKey: string;
  private readonly auras = new Map<string, Disposable>();
  private shown = true;
  private playToken = 0;
  private readonly waiters: (() => void)[] = [];
  private readonly shadowBase: number;
  private readonly updateFn: () => void;
  /** Guard-hit knock-back in progress: the spot it springs back to, and its token. */
  private kbBase: XY | null = null;
  private kbToken = 0;
  private kbTween: Phaser.Tweens.Tween | null = null;
  /** v3 guard brace in progress (see brace()): its token. */
  private braceToken = 0;
  /** v3 claim (see claim()): the pinned spot (null: not claimed, or claimed without a pin), the pin handler, the claimant call depth. */
  private claimed_ = false;
  private claimPin: { x: number; y: number; depth: number; lift: number } | null = null;
  private claimFn: (() => void) | null = null;
  private claimDepth = 0;

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
    this.p1Key = monsterTextureKey(o.cardId);
    this.p2Key = monsterP2TextureKey(o.cardId);
    this.sheetKey = this.p1Key;
    const home = this.home;
    const rx = shadowRx(o.cardId);
    this.shadowBase = this.art.hover > 0 ? Math.max(0.55, 1 - this.art.hover / 30) : 1;
    this.shadow = scene.add.image(home.x, home.y, shadowKey(scene, rx)).setDepth(DEPTH.SHADOW).setAlpha(0.5).setScale(this.shadowBase);
    const sprite = new UnitSprite(scene, home.x, home.y - this.art.hover, monsterTextureKey(o.cardId), monsterFrameName('idle', 0));
    sprite.unit = this;
    scene.add.existing(sprite);
    this.sprite = sprite;
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
  frameInfo(): { anim: AnyMonsterAnim | null; frame: number } {
    const name = String(this.sprite.frame?.name ?? '');
    const i = name.indexOf(':');
    if (i < 0) return { anim: null, frame: 0 };
    return { anim: name.slice(0, i) as AnyMonsterAnim, frame: Number(name.slice(i + 1)) || 0 };
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
    if (!this.sprite.active || this.locked) return;
    const anim: MonsterAnim = this.position === 'defense' ? 'guard' : 'idle';
    const key = monsterAnimKey(this.cardId, anim);
    if (!this.scene.anims.exists(key)) return;
    const n = this.art.anims[anim].frames;
    this.sprite.play({ key, repeat: -1, startFrame: randomStart ? Math.floor(rnd() * n) : 0 });
    this.flushWaiters();
  }

  /**
   * Play an animation (any MonsterAnim or, when this monster's art has it, an extra one).
   * Looping anims resolve immediately. One-shots resolve on completion and then return to
   * idle/guard (opts.hold = stay on the last frame). Superseded plays resolve. A recoil ('hit',
   * 'hitHeavy', 'hitMagic') in DEFENSE position is the guard-pose reaction (guardHit;
   * opts.dir / from / power steer it) — the upright recoil frames are never shown then.
   * An anim the art lacks plays opts.fallback instead, or resolves at once (see tryPlay).
   */
  play(anim: AnyMonsterAnim, opts: PlayOpts = {}): Promise<void> {
    if (this.locked) return Promise.resolve();
    if (opts.fallback && !this.has(anim) && this.has(opts.fallback)) anim = opts.fallback;
    const key = monsterAnimKey(this.cardId, anim);
    const spec = this.spec(anim);
    if (!spec || !this.scene.anims.exists(key) || !this.sprite.active) return Promise.resolve();
    if (isHitAnim(anim) && this.guarding) return this.guardHit(opts);
    this.flushWaiters();
    const token = ++this.playToken;
    if (spec.loop) {
      this.sprite.play({ key, repeat: -1 });
      return Promise.resolve();
    }
    this.sprite.play({ key, repeat: 0 });
    // safety net: scene time follows speed / hit-stop like the animation clock
    return this.untilComplete(key, anim, animLengthMs(spec), {
      hold: !!opts.hold,
      token,
      restIfCurrent: false,
      restOnTimeout: true,
      timeScale: undefined,
      safety: (ms) => wait(this.scene, ms * 1.6 + 300),
    });
  }

  /**
   * play() if this monster draws `anim`, else `false` and nothing happens — the caller runs its
   * own fallback (hologram summon, shatter death...):
   *   const p = u.tryPlay('death', { hold: true });
   *   if (p) await p; else await shatterDeath(u);
   */
  tryPlay(anim: AnyMonsterAnim, opts: Omit<PlayOpts, 'fallback'> = {}): Promise<void> | false {
    if (!this.has(anim)) return false;
    return this.play(anim, opts);
  }

  /**
   * Play frames `from`…`to` of `anim` (indices clamped; one-shot whatever the spec's loop).
   *  - `to` omitted: play to the end; resolves on completion, then back to idle/guard unless
   *    o.hold — the kits' playFrom(u, anim, from).
   *  - `to` given: stops ON frame `to` (the sprite holds it, like pose()) and resolves when it
   *    shows; to <= from just poses `to`.
   * Timing (and the safety net) follows the spec's per-frame holds. A recoil on a guarding unit
   * is answered from the guard pose (UnitSprite). See PlayRangeOpts for the options.
   */
  playRange(anim: AnyMonsterAnim, from = 0, to?: number, o: PlayRangeOpts = {}): Promise<void> {
    if (this.locked) return Promise.resolve();
    const s = this.sprite;
    const key = monsterAnimKey(this.cardId, anim);
    const spec = this.spec(anim);
    if (!spec || !s.active || !this.scene.anims.exists(key)) return Promise.resolve();
    const last = spec.frames - 1;
    const f0 = clampFrame(from, last);
    const exclusive = o.exclusive ?? true;
    if (exclusive) this.flushWaiters();
    const token = exclusive ? ++this.playToken : null;
    const safety = o.safety ?? ((ms: number) => wait(this.scene, ms * 1.6 + 300));
    if (to === undefined) {
      if (o.timeScale !== undefined) s.anims.timeScale = o.timeScale;
      s.play({ key, repeat: 0, startFrame: f0 });
      return this.untilComplete(key, anim, specRangeMs(spec, from, spec.frames), {
        hold: !!o.hold,
        token,
        restIfCurrent: o.restIfCurrent ?? false,
        restOnTimeout: o.restOnTimeout ?? true,
        timeScale: o.timeScale,
        safety,
      });
    }
    const f1 = clampFrame(to, last);
    if (f1 <= f0) {
      this.pose(anim, f1);
      return Promise.resolve();
    }
    if (isHitAnim(anim) && this.guarding) {
      void this.guardHit();
      return wait(this.scene, specRangeMs(spec, f0, f1));
    }
    if (o.timeScale !== undefined) s.anims.timeScale = o.timeScale;
    s.play({ key, repeat: 0, startFrame: f0 });
    return new Promise<void>((resolve) => {
      let done = false;
      const close = () => {
        if (done) return;
        done = true;
        s.off(Phaser.Animations.Events.ANIMATION_UPDATE, onUpdate);
        if (o.timeScale !== undefined && s.active) s.anims.timeScale = 1;
        resolve();
      };
      const onUpdate = (a: Phaser.Animations.Animation, f: Phaser.Animations.AnimationFrame) => {
        if (a.key !== key) return close();
        if (f.index - 1 < f1) return;
        s.anims.stop();
        close();
      };
      s.on(Phaser.Animations.Events.ANIMATION_UPDATE, onUpdate);
      if (token !== null) this.waiters.push(close);
      void safety(specRangeMs(spec, f0, f1)).then(close);
    });
  }

  /**
   * Stop the animation and show one frame of `anim` (rounded, clamped) — full manual control.
   * false when the art lacks `anim`. A pending play() is NOT cancelled (as the kit helpers this
   * replaces); a 'hit:N' frame on a guarding unit shows the guard pose (UnitSprite.setFrame).
   */
  pose(anim: AnyMonsterAnim, frame: number): boolean {
    const s = this.sprite;
    if (!s.active || this.locked) return false;
    const n = this.frameCount(anim);
    if (!n) return false;
    s.anims.stop();
    s.setFrame(monsterFrameName(anim, clampFrame(frame, n - 1)));
    return true;
  }

  /** Resolve when the current animation `anim` reaches `frame` (0-based). Starts it if needed. */
  playToFrame(anim: AnyMonsterAnim, frame: number): Promise<void> {
    if (this.locked) return Promise.resolve();
    const key = monsterAnimKey(this.cardId, anim);
    const spec = this.spec(anim);
    if (!spec || !this.scene.anims.exists(key) || !this.sprite.active) return Promise.resolve();
    if (isHitAnim(anim) && this.guarding) {
      // guard pose: react, and resolve when that hit frame would have shown
      void this.guardHit();
      return wait(this.scene, frameStartMs(spec, Math.max(0, frame)));
    }
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
      // safety net: until frame `frame` would have ended
      void wait(this.scene, specRangeMs(spec, 0, frame + 1) * 1.6 + 300).then(finish);
    });
  }

  /** Play 'attack' and resolve on its impact frame (impactFrame; the rest plays on). */
  attackToImpact(): Promise<void> {
    void this.play('attack');
    return this.playToFrame('attack', this.impactFrame);
  }

  /**
   * Wait for a one-shot `key` that was just started: complete → rest (per `c`) and resolve; the
   * safety net resolves anyway (resting only with c.restOnTimeout). An exclusive play (token) is
   * also resolved by flushWaiters() — rest() itself flushes, which ends it first, as before.
   */
  private untilComplete(key: string, anim: AnyMonsterAnim, ms: number, c: OneShotCtl): Promise<void> {
    const s = this.sprite;
    const ev = Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + key;
    return new Promise<void>((resolve) => {
      let done = false;
      const release = () => {
        s.off(ev, onComplete);
        if (c.timeScale !== undefined && s.active) s.anims.timeScale = 1;
      };
      const close = () => {
        if (done) return;
        done = true;
        release();
        resolve();
      };
      const end = (mayRest: boolean) => {
        if (done) return;
        release();
        if (mayRest && this.mayRest(anim, c)) this.rest();
        close();
      };
      const onComplete = () => end(true);
      if (c.token !== null) this.waiters.push(close);
      s.once(ev, onComplete);
      void c.safety(ms).then(() => end(c.restOnTimeout));
    });
  }

  private mayRest(anim: AnyMonsterAnim, c: OneShotCtl): boolean {
    if (c.hold || this.retired || !this.sprite.active) return false;
    if (c.token !== null && c.token !== this.playToken) return false;
    return !c.restIfCurrent || this.frameInfo().anim === anim;
  }

  // ================================================================ animation timing
  //
  // Read every animation duration through these (src/art/animtime.ts): they follow the
  // AnimSpec's per-frame `holds` (v3) and fall back to 1000/fps per frame — for the old
  // monsters (no holds) every value is bit-identical to the `(n / fps) * 1000` it replaces.
  // Missing anims give 0.

  /** The AnimSpec of one of this monster's animations (undefined when its art lacks it). */
  spec(anim: AnyMonsterAnim): AnimSpec | undefined {
    return animSpec(this.art, anim);
  }

  /** Does this monster's art draw `anim`? (The five base anims always; extras when defined.) */
  has(anim: AnyMonsterAnim): boolean {
    return !!this.spec(anim);
  }

  /** Number of frames of `anim` (0 when missing). */
  frameCount(anim: AnyMonsterAnim): number {
    return this.spec(anim)?.frames ?? 0;
  }

  /** How long frame `frame` of `anim` stays on screen (ms; its hold, else 1000/fps). */
  frameMs(anim: AnyMonsterAnim, frame = 0): number {
    const spec = this.spec(anim);
    return spec ? specFrameMs(spec, frame) : 0;
  }

  /** ms from the start of frame `from` to the start of frame `to` of `anim` (to = frames: the end). */
  rangeMs(anim: AnyMonsterAnim, from: number, to: number): number {
    const spec = this.spec(anim);
    return spec ? specRangeMs(spec, from, to) : 0;
  }

  /** Total length of one pass of `anim` (ms). */
  animMs(anim: AnyMonsterAnim): number {
    const spec = this.spec(anim);
    return spec ? animLengthMs(spec) : 0;
  }

  /** Frame of a named beat of `anim` (spec.marks; attack 'impact' → attackImpactFrame; else `fallback` ?? 0). */
  markFrame(anim: AnyMonsterAnim, mark: AnimMark, fallback?: number): number {
    return artMarkFrame(this.art, anim, mark, fallback);
  }

  /** ms from the start of `anim` to a named beat (see markFrame). */
  markMs(anim: AnyMonsterAnim, mark: AnimMark, fallback?: number): number {
    const spec = this.spec(anim);
    return spec ? frameStartMs(spec, this.markFrame(anim, mark, fallback)) : 0;
  }

  /** The attack's impact frame: marks.impact of 'attack', else the art's attackImpactFrame. */
  get impactFrame(): number {
    return artImpactFrame(this.art);
  }

  /** ms from the start of 'attack' to its impact frame. */
  get impactMs(): number {
    return artImpactMs(this.art);
  }

  // ================================================================ guard pose

  /** True while hits are answered from the guard pose (defense position, live, has a guard anim). */
  get guarding(): boolean {
    return this.position === 'defense' && !this.guardBroken && !this.retired && this.sprite.active && this.scene.anims.exists(monsterAnimKey(this.cardId, 'guard'));
  }

  /** Is `key` (a play() argument) this unit's 'hit' animation? */
  isHitKey(key: string | Phaser.Animations.Animation | Phaser.Types.Animations.PlayAnimationConfig): boolean {
    return this.hitAnimOfKey(key) === 'hit';
  }

  /** The recoil anim ('hit' / 'hitHeavy' / 'hitMagic') a play() argument names, else null. */
  hitAnimOfKey(key: string | Phaser.Animations.Animation | Phaser.Types.Animations.PlayAnimationConfig): AnyMonsterAnim | null {
    const k = typeof key === 'string' ? key : key instanceof Phaser.Animations.Animation ? key.key : key?.key;
    const name = typeof k === 'string' ? k : k instanceof Phaser.Animations.Animation ? k.key : null;
    if (name === null) return null;
    for (const a of HIT_ANIMS) if (name === monsterAnimKey(this.cardId, a)) return a;
    return null;
  }

  /** The guard frame to show instead of a 'hit:N' frame (the current guard frame, else guard:0). */
  guardFrameName(): string {
    const f = String(this.sprite.frame?.name ?? '');
    return f.startsWith('guard:') ? f : monsterFrameName('guard', 0);
  }

  /** Default blow direction when none is known: from the opponent's side toward this unit's back. */
  private defaultBlow(): XY {
    return this.player === 0 ? { x: -1, y: 0.5 } : { x: 1, y: -0.5 };
  }

  /**
   * The defense-position hit reaction, FROM THE GUARD POSE: the guard frames stay (never the
   * upright 'hit' recoil), a 2–3 frame white flash, a small hex-shield glint on the face the
   * blow came from and a 2–3 px knock-back along the blow that springs back (opts.hold: stays
   * pushed — a death follows). Resolves when the motion is done (~0.3 s; ~60 ms with hold).
   * With the weight profiles on (src/duel/motion.ts, v3 look) the knock-back and its spring-back
   * follow this monster's weight class: a heavy guard (Taş Muhafız) holds still, at most 1 px;
   * a light one is knocked 3 px. Timings are the same either way.
   */
  guardHit(o: GuardHitOpts = {}): Promise<void> {
    const s = this.sprite;
    if (!s.active || this.retired) return Promise.resolve();
    const sc = this.scene;
    const power = o.power ?? 2;
    let dir = o.dir;
    if (!dir && o.from) dir = { x: this.home.x - o.from.x, y: this.home.y - o.from.y };
    const d = dir ?? this.defaultBlow();
    const l = Math.hypot(d.x, d.y) || 1;
    const blow = { x: d.x / l, y: d.y / l };
    // 1. the guard answers: v3 — the contact zone gives first (the ward / shield wing opens a
    //    frame or more back along toGuard, by power) and closes again (brace()); else the guard
    //    pose holds (the loop keeps breathing; a held non-guard frame goes back to it)
    if (o.pose !== false) {
      if (LOOK_V3 && !o.hold && this.frameCount('toGuard') >= 3) this.brace(power);
      else if (this.frameInfo().anim !== 'guard' || !s.anims.isPlaying) this.rest();
    }
    // 2. white silhouette frame(s) (an overlay: never fights another flash over the tint); the
    //    v3 look lights only the face the blow lands on (≤ half the silhouette, A0 §6.2 item 1)
    if (LOOK_V3) contactFlash(sc, s, blow, { frames: power >= 3 ? 3 : 2, coverage: power >= 3 ? 0.45 : 0.4 });
    else flashOverlay(sc, s, power >= 3 ? 3 : 2);
    // 3. hex-shield glint on the side the blow came from (bigger for heavier blows)
    const c = this.core();
    guardGlint(sc, c.x - blow.x * 6, c.y - blow.y * 6 - 2, -blow.x, s.depth + 0.5, 9 + power * 2);
    // 4. knock-back along the blow (integer px), then spring back to where it stood
    const token = ++this.kbToken;
    this.kbTween?.stop();
    const base = this.kbBase ?? { x: s.x, y: s.y };
    this.kbBase = base;
    const k = reactGuardPushPx(this.art, power); // legacy: power >= 2 ? 3 : 2
    const backEase = reactGuardReturnEase(this.art); // legacy: 'Back.Out'
    const to = { x: Math.round(base.x + blow.x * k), y: Math.round(base.y + blow.y * k * 0.6) };
    // v3: the knock-back steps whole pixels (the eases leave sub-pixel in-betweens otherwise)
    const snap = LOOK_V3 ? () => s.setPosition(Math.round(s.x), Math.round(s.y)) : undefined;
    return new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (token === this.kbToken) {
          this.kbBase = null;
          this.kbTween = null;
        }
        resolve();
      };
      this.kbTween = sc.tweens.add({
        targets: s,
        x: to.x,
        y: to.y,
        duration: 60,
        ease: 'Quad.Out',
        onUpdate: snap,
        onStop: finish,
        onComplete: () => {
          if (o.hold || !s.active || token !== this.kbToken) return finish();
          this.kbTween = sc.tweens.add({ targets: s, x: base.x, y: base.y, duration: 240, ease: backEase, onUpdate: snap, onComplete: finish, onStop: finish });
        },
      });
      // safety net: settle() / killTweensOf may remove the tweens without any event
      void wait(sc, o.hold ? 200 : 600).then(finish);
    });
  }

  /** sprite.play(<hit anim>) on a guarding unit: react, then report the hit anim's completion. */
  guardHitFromSprite(hit: AnyMonsterAnim = 'hit'): void {
    void this.guardHit();
    const s = this.sprite;
    const key = monsterAnimKey(this.cardId, hit);
    const anim = this.scene.anims.get(key);
    void wait(this.scene, this.animMs(hit)).then(() => {
      if (s.active) s.emit(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + key, anim, anim?.frames[anim.frames.length - 1], s, '');
    });
  }

  /**
   * v3 guard brace (plan §4 "önce temas bölgesi, sonra diğer uzuvlar"): the drawn toGuard frames
   * played backwards and forwards again — guard → toGuard[n-2] (the ward / shield wing gives at
   * contact) → deeper by power (n-3, n-4) → back up → toGuard[n-1] (= the guard pose) → the guard
   * loop. Holds 40 / 60 out, 90 back, 120 on the closing frame, scaled by the weight class's
   * recovery (motion.ts: a heavy guard settles slower). A later guardHit, any other pose or play,
   * a claim or a retire ends it where it is.
   */
  private brace(power: 1 | 2 | 3): void {
    const n = this.frameCount('toGuard');
    const depth = Math.max(1, Math.min(power, n - 2));
    const k = motionProfile(this.art).recoveryMs / 280;
    const seq: { f: number; ms: number }[] = [];
    for (let i = 1; i <= depth; i++) seq.push({ f: n - 1 - i, ms: Math.round((i === 1 ? 40 : 60) * k) });
    for (let i = depth - 1; i >= 1; i--) seq.push({ f: n - 1 - i, ms: Math.round(90 * k) });
    seq.push({ f: n - 1, ms: Math.round(120 * k) });
    const token = ++this.braceToken;
    const shown = (f: number) => {
      const fi = this.frameInfo();
      return fi.anim === 'toGuard' && fi.frame === f && !this.sprite.anims.isPlaying;
    };
    const step = (i: number, prev: number | null) => {
      if (token !== this.braceToken || this.retired || !this.sprite.active || this.locked) return;
      // something else took the sprite over: leave it alone
      if (prev !== null && !shown(prev)) return;
      if (i >= seq.length) {
        this.rest();
        return;
      }
      if (!this.pose('toGuard', seq[i].f)) return;
      void wait(this.scene, seq[i].ms).then(() => step(i + 1, seq[i].f));
    };
    step(0, null);
  }

  // ================================================================ claim (v3)

  /**
   * v3: a cinematic takes the unit over from another one that is still running — a legacy strike
   * whose attacker loses a melee clash would carry the sprite home, but its death starts where it
   * was struck, in front of the target (battle/battle.ts). While claimed:
   *   - the sprite is pinned to the spot it was claimed on (whole pixels, scale 1, no rotation,
   *     its depth and lift) on every frame, after every tween and per-frame motion (PRE_RENDER);
   *   - the animation API (play / playRange / pose / playToFrame / rest / settle, and
   *     UnitSprite.play / setFrame) ignores every caller that does not go through asClaimant() —
   *     the death and reaction kits (src/cinematics/_v3) call through it.
   * retire() / destroy() end the claim. Returns false when there is nothing to claim.
   */
  claim(o: { pin?: boolean } = {}): boolean {
    const s = this.sprite;
    if (this.claimed_ || this.retired || !s.active) return false;
    this.braceToken++;
    this.claimed_ = true;
    // { pin: false }: the animation API is claimed, the position is not (a strike still carries
    // the sprite: a blocked melee attacker's rebound — battle/battle.ts); it stays on whole pixels,
    // at scale 1, unrotated (no legacy squash / tumble angle on a claimed sprite)
    if (o.pin === false) {
      const keep = () => {
        if (!s.active) return;
        if (s.x !== Math.round(s.x) || s.y !== Math.round(s.y)) s.setPosition(Math.round(s.x), Math.round(s.y));
        if (s.scaleX !== 1 || s.scaleY !== 1) s.setScale(1);
        if (s.angle !== 0) s.setAngle(0);
      };
      keep();
      this.claimFn = keep;
      this.scene.events.on(Phaser.Scenes.Events.PRE_RENDER, keep);
      return true;
    }
    this.scene.tweens.killTweensOf(s);
    this.kbToken++;
    this.kbBase = null;
    this.kbTween = null;
    this.claimPin = { x: Math.round(s.x), y: Math.round(s.y), depth: s.depth, lift: Math.max(0, Math.round(this.lift)) };
    const pin = () => {
      const p = this.claimPin;
      if (!p || !s.active) return;
      if (s.x !== p.x || s.y !== p.y) s.setPosition(p.x, p.y);
      if (s.scaleX !== 1 || s.scaleY !== 1) s.setScale(1);
      if (s.angle !== 0) s.setAngle(0);
      if (s.depth !== p.depth) s.setDepth(p.depth);
      this.lift = p.lift;
      this.update(); // the shadow follows the pinned sprite
    };
    pin();
    this.claimFn = pin;
    this.scene.events.on(Phaser.Scenes.Events.PRE_RENDER, pin);
    return true;
  }

  /** Is the unit claimed (see claim())? */
  get claimed(): boolean {
    return this.claimed_;
  }

  /** True while a caller outside the claimant must be ignored (claimed, not inside asClaimant). */
  get locked(): boolean {
    return this.claimed_ && this.claimDepth === 0;
  }

  /** Run `fn` as the claimant (its MonsterUnit / sprite animation calls go through); unclaimed: just runs it. */
  asClaimant<T>(fn: () => T): T {
    this.claimDepth++;
    try {
      return fn();
    } finally {
      this.claimDepth--;
    }
  }

  /** End the claim (the pin stops; the API answers everyone again). */
  unclaim(): void {
    if (this.claimFn) this.scene.events.off(Phaser.Scenes.Events.PRE_RENDER, this.claimFn);
    this.claimFn = null;
    this.claimPin = null;
    this.claimed_ = false;
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
    if (this.retired || !this.sprite.active || this.claimed_) return;
    const r = this.rest0;
    const s = this.sprite;
    this.scene.tweens.killTweensOf(s);
    this.kbToken++;
    this.kbBase = null;
    this.kbTween = null;
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
      // a one-shot still running (roar / attack / hit, or a v3 extra anim) plays out first
      const busyOneShot = s.anims.isPlaying && cur !== null && cur !== 'idle' && cur !== 'guard';
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
    this.unclaim();
    for (const k of [...this.auras.keys()]) this.setAura(k, null);
    this.badge.setVisible(false);
    this.sprite.setVisible(false);
    this.shadow.setVisible(false);
    this.flushWaiters();
    this.scene.time.delayedCall(delayMs, () => this.destroy());
  }

  destroy(): void {
    this.retired = true;
    this.unclaim();
    this.flushWaiters();
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.updateFn);
    for (const k of [...this.auras.keys()]) this.setAura(k, null);
    if (this.sprite.active) this.sprite.destroy();
    if (this.shadow.active) this.shadow.destroy();
    this.badge.destroy();
  }

  // ================================================================ internals

  /**
   * Facing and sheet follow the controller (construction, setController, settle): player 2 is
   * mirrored (flipX, origin on the mirrored anchor) and shows the P2 'relight' sheet when the
   * monster has one (art.p2 === 'relight'; see textures.monsterSheetKey), else the P1 sheet.
   */
  private applyFacing(): void {
    const a = this.art;
    const flip = this.flipX;
    const key = monsterSheetKey(this.cardId, this.player);
    this.sheetKey = key !== this.p1Key && this.scene.textures.exists(key) ? key : this.p1Key;
    // v3: the poses a blow may need are painted first, in the background, as the unit takes the
    // field (A2 tech review r2 #12: never painted synchronously on a contact frame)
    if (LOOK_V3) warmMonsterSheet(this.sheetKey, WARM_ON_FIELD);
    if (this.sprite instanceof UnitSprite) this.sprite.syncSheet();
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
    // v3 (A2 tech review r3 #9, interim until the old monsters get their v3 strikes in A4): a monster
    // sprite is never rotated, and a legacy strike's squash / stretch (an old monster's tweened
    // 0.97–1.07 scale) shows at 1×, as a claimed sprite does (claim keep()). A grow / shrink well
    // away from 1× (an exit, a tween from 0) is left alone.
    if (LOOK_V3) {
      if (s.angle !== 0) s.setAngle(0);
      if ((s.scaleX !== 1 || s.scaleY !== 1) && Math.abs(s.scaleX - 1) <= SNAP_SCALE && Math.abs(s.scaleY - 1) <= SNAP_SCALE) s.setScale(1);
    }
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
