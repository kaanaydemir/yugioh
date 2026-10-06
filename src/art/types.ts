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

export interface AnimSpec {
  frames: number;
  /** Frames per second. */
  fps: number;
  loop: boolean;
}

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
   */
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number): void;
  /**
   * Optional card artwork (CARD_ART_W × CARD_ART_H) — a framed close-up for the card face.
   * If omitted, the card renderer crops the idle frame 0 around `core`.
   */
  portrait?(p: PixelCanvas): void;
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
  draw(p: PixelCanvas, frame: number): void;
}

/** Artwork for spell/trap cards (CARD_ART_W × CARD_ART_H). */
export interface CardArtwork {
  id: CardId;
  draw(p: PixelCanvas): void;
}
