// Art Lab contracts (?dev=art-lab) — an isolated sandbox for choosing the monsters' drawing and
// animation quality. NOTHING in the game (src/art, src/view, src/duel, src/cinematics, src/scenes)
// imports from src/artlab, and src/artlab does not register anything with the game: monster art
// here is NOT a MonsterArt and is not picked up by src/art/monsters/index.ts.
//
// A lab monster is drawn frame by frame into a PixelCanvas, exactly like the game's monsters, but
// with its own, local animation set (the shared MonsterAnim contract is untouched) and per-frame
// hold times, so anticipation / impact / recovery poses can be held for as long as they need.

import type Phaser from 'phaser';
import type { PixelCanvas } from '../art/pixel';

export interface XY {
  x: number;
  y: number;
}

/** One animation: every frame is a DRAWN pose with its own hold time. */
export interface LabAnim {
  /** Hold time of each frame in ms; the length is the frame count. Uneven holds are encouraged. */
  durations: number[];
  /** Loops (idle) or plays once and holds its last frame. */
  loop: boolean;
  /** Named beats → frame index, used by the battle timeline (see the role anim docs below). */
  marks?: Record<string, number>;
}

/** Points of interest of one frame, in FRAME pixels (as drawn, facing right). */
export interface LabFramePoints {
  /** Visual centre of mass — hit sparks, lights and lock-on aim here. */
  core: XY;
  /** Where an attack leaves the body on this frame (dragon: mouth, wizard: staff orb centre). */
  muzzle?: XY;
  /** Optional extras (eyes, head, orb, chest...). */
  [k: string]: XY | undefined;
}

export interface LabMonsterArt<A extends string = string> {
  id: string;
  /** Turkish display name. */
  name: string;
  /** Frame size in pixels (all frames share it). Leave room so no pose is ever clipped. */
  w: number;
  h: number;
  /** Ground-contact point (between the feet / bottom of the robe) in frame pixels. */
  anchorX: number;
  anchorY: number;
  /** Pixels the body floats above the ground (0 for walkers). */
  hover: number;
  anims: Record<A, LabAnim>;
  /** Draw one frame onto `p` (already cleared, size w×h). Must be deterministic. Facing RIGHT. */
  draw(p: PixelCanvas, anim: A, frame: number): void;
  /** Points of interest for one frame (frame pixels, facing right). */
  points(anim: A, frame: number): LabFramePoints;
}

/**
 * Dragon animations (player side, lower-left, faces right toward the wizard):
 *  - summon:  its OWN entrance poses (e.g. curled in its wings → unfurl → land → shake out).
 *             marks: { land } — the frame its feet hit the floor (dust / ring).
 *  - idle:    looping breathing; wings, tail and head move on their own (offset) rhythms.
 *  - hit:     takes the wizard's bolt: recoil pose(s) → stagger → recovery back to the idle pose.
 *             marks: { impact } (frame shown at the moment of the hit), { recover } (first recovery frame).
 *  - attack:  crystal breath: weight shift back (anticipation) → neck stretches forward → mouth open,
 *             breath (held frames) → close → recovery.  marks: { fire, fireEnd } (breath from..to).
 *  - victory: a short happy celebration (hop / wing flare / head toss) ending in a held pose.
 */
export type DragonAnim = 'summon' | 'idle' | 'hit' | 'attack' | 'victory';

/**
 * Wizard animations (opponent side, upper-right; drawn facing RIGHT and shown flipped):
 *  - summon:  its OWN entrance poses (e.g. rises out of a portal, hat first; brim flips up; staff twirl).
 *             marks: { land }.
 *  - idle:    looping; robe hem, sleeves and staff sway with lag; eyes/orb pulse.
 *  - attack:  cast: gather (anticipation) → raise / point the staff → release → follow-through → recover.
 *             marks: { charge } (orb starts charging), { release } (bolt leaves the orb).
 *  - hit:     the breath hits: recoil, posture breaks (hat knocked askew...). marks: { impact }.
 *  - death:   continues from hit: stagger → collapse poses → the body itself erodes into purple
 *             pixels (drawn in the frames) until nothing is left (last frame empty).
 *             marks: { dissolve } — first frame of the erosion (particles start).
 */
export type WizardAnim = 'summon' | 'idle' | 'attack' | 'hit' | 'death';

/** Effect palette of a variant (ramps run dark → light). Shared effect code reads only these. */
export interface LabFxSettings {
  /** Wizard magic (bolt, orb charge, dissolve particles, its summon). */
  magic: number[];
  /** Dragon crystal breath / ice shards / its summon. */
  crystal: number[];
  /** Neutral hit sparks / dust. */
  spark: number[];
  dust: number[];
  /** Summon circles of each side. */
  sideP1: number[];
  sideP2: number[];
  /** Soft light colours (the light layer). */
  lightMagic: number;
  lightCrystal: number;
  lightWarm: number;
  /** Screen-shake ceiling in game px (integer). */
  maxShake: number;
}

/** Ground spots of the two monsters on the arena (game pixels, integers). */
export interface LabSlots {
  dragon: XY;
  wizard: XY;
}

/** The arena of a variant, built into the lab scene. All motion is a pure function of lab time. */
export interface LabArena {
  slots: LabSlots;
  /** Advance ambient life to lab time `t` (ms). Pure function of t → pause/restart/seek safe. */
  update(t: number): void;
  /** Show/hide the arena's soft light layer and ambient particles (the lab's "effects" toggle). */
  setFx(on: boolean): void;
  destroy(): void;
}

/** Depth bands of the lab scene (world camera). */
export const LAB_DEPTH = {
  SKY: 0,
  BACKDROP: 10,
  PLATFORM: 20,
  FLOOR_FX: 30,
  /** Actors are y-sorted inside [ACTORS, ACTORS + 9]. */
  ACTORS: 40,
  PROPS_FRONT: 55,
  FX: 60,
  LIGHT: 70,
  UI: 100,
} as const;

export interface ArtVariant {
  id: 'A' | 'B' | 'C' | 'D';
  /** Turkish name shown in the switcher. */
  name: string;
  dragon: LabMonsterArt<DragonAnim>;
  wizard: LabMonsterArt<WizardAnim>;
  fx: LabFxSettings;
  /** Background colour behind everything (game camera). */
  background: number;
  buildArena(scene: Phaser.Scene): LabArena;
}
