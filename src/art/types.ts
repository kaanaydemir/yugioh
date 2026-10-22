// Art contracts. Every sprite in the game is generated in code from these specs at boot.

import type { CardId, MonsterId } from '../data/cards';
import type { PixelCanvas } from './pixel';

/**
 * Monster animations. Sprites are drawn FACING RIGHT (player 1); player 2 uses flipX.
 *  - idle:   looping "alive" cycle (breathing, wing beats, flicker). Frame 0 = neutral pose.
 *  - roar:   one-shot entrance/celebration right after a summon (rear up, roar, spread wings).
 *  - attack: one-shot. Anticipation (wind-up) → strike at `attackImpactFrame` → recovery.
 *            Beam/projectile attackers open the mouth/hands at the impact frame (VFX spawn at `muzzle`).
 *  - hit:    one-shot recoil when taking damage (knock back, squint), returns to neutral.
 *  - guard:  looping defense-position pose (crouched, wings/arms/shield closed). Calmer than idle.
 */
export type MonsterAnim = 'idle' | 'roar' | 'attack' | 'hit' | 'guard';
export const MONSTER_ANIMS: MonsterAnim[] = ['idle', 'roar', 'attack', 'hit', 'guard'];

/**
 * v3 (A1) OPTIONAL extra animations — a monster draws only the ones it has (`extraAnims` +
 * `drawExtra`); for the rest the cinematics keep their current fallbacks (hologram summon,
 * shatter death, roar...). Usually one-shots (their AnimSpec.loop says). Frame names on the sheet
 * are `<anim>:<i>` like the base ones; check with animtime.hasAnim / textures.hasMonsterAnim.
 *  - summon:    its own entrance poses (curled → unfurl → land → shake out).      marks: land
 *  - death:     continues from hit: stagger → collapse → the body erodes.          marks: dissolve
 *  - revive:    soul recall: re-forms from fragments, first breath.                marks: land
 *  - special:   on-field effect / targeted cast (point, channel, release).         marks: charge, release
 *  - hitHeavy:  big recoil (lethal-ish or heavy attacker).                          marks: impact, recover
 *  - hitMagic:  recoil from a spell / beam (flinch, singe).                         marks: impact, recover
 *  - victory:   short celebration ending in a held pose.
 *  - toGuard:   attack → defense transition (ends on guard frame 0).
 *  - fromGuard: defense → attack transition (ends on idle frame 0).
 */
export type MonsterAnimExtra =
  | 'summon'
  | 'death'
  | 'revive'
  | 'special'
  | 'hitHeavy'
  | 'hitMagic'
  | 'victory'
  | 'toGuard'
  | 'fromGuard';
/** Canonical order of the extra animations (sheet layout order after MONSTER_ANIMS). */
export const MONSTER_ANIMS_EXTRA: MonsterAnimExtra[] = ['summon', 'death', 'revive', 'special', 'hitHeavy', 'hitMagic', 'victory', 'toGuard', 'fromGuard'];
/** Any animation a monster may have: the five base ones (always) plus the optional extras. */
export type AnyMonsterAnim = MonsterAnim | MonsterAnimExtra;

/**
 * Motion character (src/duel/motion.ts maps it to curves, anticipation / recovery times,
 * hit-stop and shake). Absent → 'medium'.
 */
export type WeightClass = 'heavy' | 'mediumHeavy' | 'medium' | 'mediumLight' | 'light' | 'floater' | 'caster';
export const WEIGHT_CLASSES: WeightClass[] = ['heavy', 'mediumHeavy', 'medium', 'mediumLight', 'light', 'floater', 'caster'];

/**
 * Named beats of an animation → frame index (see AnimSpec.marks). The battle timeline syncs to
 * these: 'impact' (the strike lands / beam fires; on `attack` it falls back to
 * MonsterArt.attackImpactFrame), 'release' (projectile leaves), 'contact' (body touches target),
 * 'land' (feet hit the floor), 'dissolve' (erosion starts), 'recover' (first recovery frame),
 * 'charge' (gathering starts).
 */
export type AnimMark = 'impact' | 'release' | 'contact' | 'land' | 'dissolve' | 'recover' | 'charge';
export const ANIM_MARKS: AnimMark[] = ['impact', 'release', 'contact', 'land', 'dissolve', 'recover', 'charge'];

export interface AnimSpec {
  frames: number;
  /** Frames per second. Without `holds` every frame lasts 1000/fps ms (and it stays the fallback). */
  fps: number;
  loop: boolean;
  /**
   * OPTIONAL per-frame hold times in ms (length === frames): long anticipation, short strike.
   * A missing / non-positive entry falls back to 1000/fps. Read timings only through
   * src/art/animtime.ts (Phaser's Animation.duration ignores holds).
   */
  holds?: number[];
  /** OPTIONAL named beats → frame index (see AnimMark). */
  marks?: Partial<Record<AnimMark, number>>;
}

/** Options for drawing a frame (v3). Old monsters ignore them. */
export interface DrawOpts {
  /**
   * Frame edge the key light comes from. Default 'left' (lit from the screen top-left as drawn,
   * facing right). The optional P2 sheet ('relight') is drawn with 'right': mirrored by flipX it
   * is lit from the screen top-left again.
   */
  lightFrom: 'left' | 'right';
}

/** Named points of interest of one frame (frame pixels, as drawn facing right). */
export type MonsterPointName = 'muzzle' | 'core' | 'head' | 'hand' | 'staff' | 'claw' | 'feet' | 'grip';
export const MONSTER_POINT_NAMES: MonsterPointName[] = ['muzzle', 'core', 'head', 'hand', 'staff', 'claw', 'feet', 'grip'];
export type MonsterPoints = Partial<Record<MonsterPointName, { x: number; y: number }>>;

export interface MonsterArt {
  id: MonsterId;
  /** Frame size in pixels (all frames share it). Keep generous empty margin for wind-up poses. */
  w: number;
  h: number;
  /** Ground-contact point (between the feet / bottom of the body) in frame pixels. */
  anchorX: number;
  anchorY: number;
  /** Pixels the body floats above the ground (fliers/ghosts) — used for the drop shadow. 0 for walkers. */
  hover: number;
  /** Where beams/projectiles/slashes originate at the attack impact frame (frame pixels). */
  muzzle: { x: number; y: number };
  /** Visual center of mass (frame pixels) — hit sparks, auras and lock-on reticles aim here. */
  core: { x: number; y: number };
  /** Per-animation frame counts and speeds. */
  anims: Record<MonsterAnim, AnimSpec>;
  /** Index into the attack animation where the strike lands / the beam fires. */
  attackImpactFrame: number;
  /**
   * Draw one frame onto `p` (already cleared, size w×h). Must be deterministic.
   * Include the 1px dark outline (PAL.ink) yourself — e.g. call p.outline(PAL.ink) at the end.
   * `o` (v3, optional): see DrawOpts; old monsters ignore it.
   */
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts): void;
  /**
   * Optional card artwork (CARD_ART_W × CARD_ART_H) — a framed close-up for the card face.
   * If omitted, the card renderer crops the idle frame 0 around `core`.
   */
  portrait?(p: PixelCanvas): void;

  // ---- v3 (A1) optional extensions — absent on the old monsters, which render unchanged ----

  /** Extra animations this monster draws (see MonsterAnimExtra). Needs `drawExtra`. */
  extraAnims?: Partial<Record<MonsterAnimExtra, AnimSpec>>;
  /** Draw one frame of an extra animation (same rules as `draw`). */
  drawExtra?(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts): void;
  /** Motion character; absent → 'medium'. */
  weight?: WeightClass;
  /**
   * Per-frame points of interest (frame pixels, facing right). Missing names fall back to the
   * fixed `muzzle` / `core` (and the anchor for 'feet').
   */
  points?(anim: AnyMonsterAnim, frame: number): MonsterPoints;
  /**
   * How player 2 sees it: 'mirror' (default, today's flipX of the P1 sheet) or 'relight' (a
   * second sheet drawn with { lightFrom: 'right' }, then flipped, so the light stays top-left).
   */
  p2?: 'mirror' | 'relight';

  // ---- v3 (A3) optional extensions (docs/v3/A3_MIMARI.md §3.5) ----

  /**
   * v3 (A3): how a recoil moves the body (§10). 'sprite' (absent = default): the reaction kit shoves
   * the sprite whole pixels, starting at the first frame change AFTER contact (never on the contact
   * frame). 'pose': the recoil poses draw `poseKnockPx[power]` px of the travel themselves (feet
   * planted, the struck region leads); the kit adds only the rest, by the same trigger.
   */
  knock?: 'sprite' | 'pose';
  /** v3 (A3), with knock 'pose': whole px of body travel the recoil poses draw, for power 1 / 2 / 3. */
  poseKnockPx?: readonly [number, number, number];
  /** v3 (A3): the body plan (and its pinned version) the art was built on (sameness groups, gallery). */
  bodyPlan?: { id: string; version: number };
  /** v3 (A3): rig joints of one frame in art pixels — read by the sameness tool only, never at runtime. */
  joints?(anim: AnyMonsterAnim, frame: number): Readonly<Record<string, { x: number; y: number }>>;
}

/** Card artwork window size (pixels) used by the card renderer and portraits. */
export const CARD_ART_W = 44;
export const CARD_ART_H = 34;

/**
 * Full-screen ace cut-in portrait (close-up, drawn facing right). Animated a few frames
 * (eyes flare, jaw opens). Backgrounds (speed lines, burst, banner) are added at runtime
 * by the cut-in cinematic, so draw only the character on transparency.
 */
export interface CutinArt {
  id: MonsterId;
  w: number;
  h: number;
  frames: number;
  fps: number;
  /** Ramp-ish accent colors for the runtime background (speed lines, burst). */
  accent: number;
  accentDark: number;
  /** `o` (v3, optional): see DrawOpts — a 'relight' portrait honours `lightFrom`; old ones ignore it. */
  draw(p: PixelCanvas, frame: number, o?: DrawOpts): void;
  /**
   * Optional card-specific rhythm (v3 look): ms each frame shows, played ONCE and ending held on
   * the last frame (length = frames). Absent: the shared cutinSequence timeline.
   */
  holds?: readonly number[];
  /**
   * How player 2 sees it (v3 look, like MonsterArt.p2): 'mirror' (default, the P1 frames flipped)
   * or 'relight' (a second set of frames drawn with { lightFrom: 'right' }, texture
   * `cutin:<id>:p2`, then flipped, so the key light stays on the screen's top-left).
   */
  p2?: 'mirror' | 'relight';
}

/** Artwork for spell/trap cards (CARD_ART_W × CARD_ART_H). */
export interface CardArtwork {
  id: CardId;
  draw(p: PixelCanvas): void;
}
